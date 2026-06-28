#!/usr/bin/env node
// CSSOS_WAVE_173 20260515 — Jing
// One-shot IAP sync to App Store Connect.
//
// Reads the canonical IAP_PRODUCT_CATALOG (from src/index.ts) and reconciles
// each product on App Store Connect:
//   1. Verify subscription record exists (already auto-created by app build)
//   2. Ensure en-US subscriptionLocalization is set (name + description)
//   3. Ensure a USA price is set matching amount_cents (Apple auto-converts
//      to all other territories via "equalization" base price)
//
// Idempotent: safe to re-run. Skips entries that already match desired state.
//
// Usage:
//   node scripts/iap-sync.mjs            # full sync
//   node scripts/iap-sync.mjs --dry-run  # report only, no writes
//
// Auth: reads APP_STORE_CONNECT_* from .env.local (Wave 171).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

/* ----- Load .env.local ----- */
const envFile = path.join(REPO_ROOT, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const KID = process.env.APP_STORE_CONNECT_KEY_ID;
const ISSUER = process.env.APP_STORE_CONNECT_ISSUER_ID;
const KEY_PATH = process.env.APP_STORE_CONNECT_KEY_PATH;
if (!KID || !ISSUER || !KEY_PATH) {
  console.error("Missing APP_STORE_CONNECT_* in .env.local");
  process.exit(1);
}
const KEY = fs.readFileSync(KEY_PATH);

/* ----- Catalog: source of truth (mirrors IAP_PRODUCT_CATALOG in src/index.ts) ----- */
// CSSOS_WAVE_1448 20260627 — Jing pricing reset. Studio Annual = $999.99.
// Annual = monthly × 10 (~17% off). Mirrors IAP_PRODUCT_CATALOG in
// src/index.ts. Enterprise retired as a purchasable SKU.
const CATALOG = {
  "app.cssstudio.studio.starter.monthly": {
    name: "Starter Monthly",
    description: "Bigger quotas. Longer videos. Faster queue.",
    usd: "9.99",
  },
  "app.cssstudio.studio.pro.monthly": {
    name: "Pro Monthly",
    description: "Pro tier: full civ × era MV pipeline access.",
    usd: "29.99",
  },
  "app.cssstudio.studio.studio.monthly": {
    name: "Studio Monthly",
    description: "Studio tier: unlimited + opera + collab.",
    usd: "99.99",
  },
  "app.cssstudio.studio.starter.annual": {
    name: "Starter Annual",
    description: "Bigger quotas. Save vs monthly. Faster queue.",
    usd: "99.99",
  },
  "app.cssstudio.studio.pro.annual": {
    name: "Pro Annual",
    description: "Pro tier: full pipeline, annual savings.",
    usd: "299.99",
  },
  "app.cssstudio.studio.studio.annual": {
    name: "Studio Annual",
    description: "Studio tier: unlimited + collab, annual.",
    usd: "999.99",
  },
};

/* ----- JWT mint (cached for ~9 min) ----- */
let cachedJwt = null, cachedAt = 0;
function jwt() {
  if (cachedJwt && Date.now() - cachedAt < 9 * 60_000) return cachedJwt;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = b64({ alg: "ES256", kid: KID, typ: "JWT" }) + "." +
    b64({ iss: ISSUER, iat: now, exp: now + 600, aud: "appstoreconnect-v1" });
  const sig = crypto.sign("SHA256", Buffer.from(unsigned), { key: KEY, dsaEncoding: "ieee-p1363" }).toString("base64url");
  cachedJwt = unsigned + "." + sig;
  cachedAt = Date.now();
  return cachedJwt;
}

function api(method, p, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const headers = { Authorization: "Bearer " + jwt(), "Content-Type": "application/json" };
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);
    const r = https.request({ hostname: "api.appstoreconnect.apple.com", path: p, method, headers }, (resp) => {
      let buf = "";
      resp.on("data", (c) => buf += c);
      resp.on("end", () => {
        let parsed = null; try { parsed = JSON.parse(buf); } catch (_) {}
        resolve({ status: resp.statusCode, body: parsed, raw: buf });
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

/* ----- Helpers ----- */
const APP_ID = "6768848996"; // cssOS
const COLOR = { green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m", reset: "\x1b[0m" };
const log = (sym, msg, color = "reset") => console.log(`${COLOR[color]}${sym} ${msg}${COLOR.reset}`);

async function listSubscriptions() {
  const groups = (await api("GET", `/v1/apps/${APP_ID}/subscriptionGroups?limit=20`)).body?.data || [];
  const subs = {};
  for (const g of groups) {
    const rows = (await api("GET", `/v1/subscriptionGroups/${g.id}/subscriptions?limit=50`)).body?.data || [];
    for (const r of rows) subs[r.attributes.productId] = { id: r.id, state: r.attributes.state, name: r.attributes.name };
  }
  return subs;
}

async function ensureLocalization(subId, desired) {
  const cur = (await api("GET", `/v1/subscriptions/${subId}/subscriptionLocalizations`)).body?.data || [];
  const enUs = cur.find((l) => l.attributes.locale === "en-US");
  if (enUs && enUs.attributes.name === desired.name && enUs.attributes.description === desired.description) {
    return { changed: false, action: "skip (already matches)" };
  }
  if (DRY_RUN) return { changed: true, action: `would PATCH/POST en-US loc` };
  if (enUs) {
    const r = await api("PATCH", `/v1/subscriptionLocalizations/${enUs.id}`, {
      data: { type: "subscriptionLocalizations", id: enUs.id, attributes: { name: desired.name, description: desired.description } },
    });
    if (r.status >= 200 && r.status < 300) return { changed: true, action: "patched" };
    return { changed: false, action: `PATCH failed ${r.status} ${(r.body?.errors||[])[0]?.detail||""}` };
  }
  const r = await api("POST", `/v1/subscriptionLocalizations`, {
    data: {
      type: "subscriptionLocalizations",
      attributes: { locale: "en-US", name: desired.name, description: desired.description },
      relationships: { subscription: { data: { type: "subscriptions", id: subId } } },
    },
  });
  if (r.status >= 200 && r.status < 300) return { changed: true, action: "created" };
  return { changed: false, action: `POST failed ${r.status} ${(r.body?.errors||[])[0]?.detail||""}` };
}

async function findUsaPricePoint(subId, usd) {
  // CSSOS_WAVE_173 — Apple has ~800 USA price points per subscription;
  // limit=200 returns only the first page. Paginate via links.next
  // until we find the exact customerPrice match (string comparison —
  // Apple returns "4.99" not 4.9).
  let next = `/v1/subscriptions/${subId}/pricePoints?filter[territory]=USA&limit=200`;
  while (next) {
    const r = await api("GET", next);
    const arr = r.body?.data || [];
    const exact = arr.find((p) => String(p.attributes.customerPrice) === usd);
    if (exact) return exact.id;
    const nextLink = r.body?.links?.next;
    next = nextLink ? nextLink.replace("https://api.appstoreconnect.apple.com", "") : null;
  }
  return null;
}

async function ensurePrice(subId, usd) {
  // CSSOS_WAVE_173 — Apple's App Store Connect API has a known limitation:
  // POST /v1/subscriptionPrices is for SCHEDULING FUTURE PRICE CHANGES,
  // not for setting initial prices. Empirically (May 2026), POSTing
  // with a valid subscriptionPricePoint relationship returns 201 but
  // server-side: startDate=null, pricePoint relationship lost. The
  // ~175 territory placeholder rows stay unset.
  //
  // Initial pricing MUST be set in the Web UI at:
  //   appstoreconnect.apple.com/apps/6768848996 → Monetization →
  //   Subscriptions → <product> → "Set Price"
  //
  // Once an initial USA price is established via the UI, *this* script
  // can then schedule future changes via subscriptionPrices POST.
  //
  // For now: detect whether any non-placeholder price exists, report.
  let next = `/v1/subscriptions/${subId}/prices?include=subscriptionPricePoint&limit=200`;
  const points = new Map();
  const rows = [];
  while (next) {
    const r = await api("GET", next);
    const j = r.body || {};
    for (const i of (j.included || [])) {
      if (i.type === "subscriptionPricePoints") points.set(i.id, i.attributes);
    }
    for (const row of (j.data || [])) rows.push(row);
    next = j.links?.next ? j.links.next.replace("https://api.appstoreconnect.apple.com", "") : null;
  }
  const usaRow = rows.find((row) => {
    const ppId = row.relationships?.subscriptionPricePoint?.data?.id;
    return ppId && points.get(ppId)?.territory === "USA";
  });
  if (usaRow) {
    const ppId = usaRow.relationships.subscriptionPricePoint.data.id;
    const pp = points.get(ppId);
    if (String(pp.customerPrice) === usd) return { changed: false, action: `skip (USA already $${usd})` };
    return { changed: false, action: `MANUAL: change USA from $${pp.customerPrice} to $${usd} in Web UI` };
  }
  return { changed: false, action: `MANUAL: set USA initial price to $${usd} in Web UI (API limitation)` };
}

/* ----- Main ----- */
(async () => {
  log("●", `IAP sync ${DRY_RUN ? "[DRY RUN]" : "[LIVE]"} — app ${APP_ID}`, "cyan");
  const subs = await listSubscriptions();
  let touched = 0, errors = 0;
  for (const [productId, desired] of Object.entries(CATALOG)) {
    const sub = subs[productId];
    if (!sub) { log("✗", `missing subscription record: ${productId}`, "red"); errors++; continue; }
    console.log(`\n${COLOR.cyan}► ${productId}${COLOR.reset} (id ${sub.id}, state=${sub.state})`);
    const locRes = await ensureLocalization(sub.id, desired);
    log(locRes.changed ? "✓" : "·", `localization: ${locRes.action}`, locRes.changed ? "green" : "yellow");
    if (locRes.changed) touched++;
    const priceRes = await ensurePrice(sub.id, desired.usd);
    log(priceRes.changed ? "✓" : (priceRes.action.includes("failed")||priceRes.action.includes("not found") ? "✗" : "·"), `price: ${priceRes.action}`, priceRes.changed ? "green" : (priceRes.action.includes("failed")||priceRes.action.includes("not found") ? "red" : "yellow"));
    if (priceRes.changed) touched++;
    if (priceRes.action.includes("failed") || priceRes.action.includes("not found")) errors++;
  }
  console.log();
  log("●", `done: ${touched} writes, ${errors} errors`, errors ? "red" : "green");
})();
