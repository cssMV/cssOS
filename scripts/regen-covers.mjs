#!/usr/bin/env node
/* CSSOS_WAVE_210b 20260516 — Jing: 给 152 个永久 404 的过期 cover 重生.
 *
 * For each user_works row whose cover_image points at a known-expired
 * host (replicate/fal/aiquickdraw) — call the cssOS image router via
 * the local Rust API, save the result to /srv/cssos/artifacts/mv-fallback,
 * and UPDATE user_works.cover_image + preview_image_url.
 *
 * Prompt = `${title} · ${style || 'cinematic'} — album cover, dramatic
 * lighting, no text`. Aspect 1024x1024.
 *
 * Cost: ~$0.001-0.003 per image (fal/replicate/openai per-tier).
 *
 * Usage (run on api-vm):
 *   sudo -u jing node /srv/cssos/repo/scripts/regen-covers.mjs --dry-run
 *   sudo -u jing node /srv/cssos/repo/scripts/regen-covers.mjs --run
 *   sudo -u jing node /srv/cssos/repo/scripts/regen-covers.mjs --run --limit 10
 *
 * Concurrency capped at 2 (image gen is expensive + we don't want to
 * blow through provider rate limits on a backfill).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import https from "node:https";
import http from "node:http";
import pg from "pg";

const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = !ARGS.has("--run");
const LIMIT = (() => {
  const idx = process.argv.indexOf("--limit");
  return idx >= 0 ? Number(process.argv[idx + 1]) : 0;
})();
const FALLBACK_DIR = "/srv/cssos/artifacts/mv-fallback";
const PUBLIC_BASE = process.env.CSSOS_PUBLIC_BASE || "https://cssstudio.app";
const COVER_API = process.env.CSSMV_COVER_API || "http://127.0.0.1:8081/api/mv/cover";
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL missing"); process.exit(1); }

const SESSION_TOKEN = process.env.CSSOS_ADMIN_SESSION || "";

function fetchBin(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https://") ? https : http;
    const req = lib.get(url, { signal: AbortSignal.timeout(timeoutMs) }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBin(res.headers.location, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

function postJson(url, body, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = Buffer.from(JSON.stringify(body));
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request({
      hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": data.length },
      signal: AbortSignal.timeout(timeoutMs),
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks).toString("utf8");
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try { results[i] = await fn(items[i], i); }
      catch (e) { results[i] = { error: e?.message || String(e) }; }
      // Polite spacing — providers throttle ~5 req/s
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

const pool = new pg.Pool({ connectionString: DB_URL });

async function listStillExpired() {
  const sql = `
    SELECT id, title, style
    FROM user_works
    WHERE parent_work_id IS NULL
      AND (
        cover_image LIKE '%replicate.delivery%' OR
        cover_image LIKE '%fal.media%' OR
        cover_image LIKE '%aiquickdraw%'
      )
    ORDER BY created_at DESC
    ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ""}
  `;
  const r = await pool.query(sql);
  return r.rows;
}

/* Build a short, MV-friendly prompt from the work's title + style. */
function buildPrompt(row) {
  const title = String(row.title || "").trim() || "abstract cover";
  const style = String(row.style || "").split(/[,，\/]/)[0].trim() || "cinematic";
  return [
    title,
    style,
    "album cover, dramatic lighting, beautiful composition, no text, no watermark",
  ].join(" · ");
}

/* CSSOS_WAVE_210b — Pollinations (free, no key, returns image bytes
 * directly via GET). Safest backfill provider since it has no balance/
 * quota concern. The response IS the image — no need for a second hop. */
async function callPollinationsOnce(prompt, timeoutMs) {
  const encoded = encodeURIComponent(prompt.slice(0, 500));
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1e9)}`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { signal: AbortSignal.timeout(timeoutMs) }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { signal: AbortSignal.timeout(timeoutMs) }, (r2) => {
          if (r2.statusCode !== 200) return reject(new Error(`pollinations HTTP ${r2.statusCode}`));
          const chunks = [];
          r2.on("data", (c) => chunks.push(c));
          r2.on("end", () => resolve({ kind: "bytes", buf: Buffer.concat(chunks) }));
          r2.on("error", reject);
        }).on("error", reject);
        return;
      }
      if (res.statusCode !== 200) return reject(new Error(`pollinations HTTP ${res.statusCode}`));
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ kind: "bytes", buf: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}
async function callPollinations(prompt) {
  /* CSSOS_WAVE_210b — Pollinations queue can timeout under load. Try
   * 120s, then one retry with 180s before giving up. Different seed
   * each call so we don't replay an identical request. */
  try { return await callPollinationsOnce(prompt, 120000); }
  catch (e) {
    await new Promise((r) => setTimeout(r, 3000));
    return await callPollinationsOnce(prompt, 180000);
  }
}

async function regenOne(row) {
  try {
    const prompt = buildPrompt(row);
    let result;
    try {
      result = await callPollinations(prompt);
    } catch (e) {
      return { id: row.id, title: row.title, status: "api_failed", detail: String(e?.message || e).slice(0, 100) };
    }
    const buf = result?.buf;
    if (!buf || buf.length < 1024) return { id: row.id, title: row.title, status: "tiny_response", size: buf?.length || 0 };
    let ext = "webp", bytes = buf;
    try {
      const sharp = (await import("sharp")).default;
      bytes = await sharp(buf, { failOn: "none" }).webp({ quality: 85 }).toBuffer();
    } catch (_e) { ext = "bin"; }
    const hash = crypto.createHash("sha1").update(String(row.id)).digest("hex").slice(0, 8);
    const rand = crypto.randomBytes(4).toString("hex");
    const fname = `cover-rg-${hash}-${Date.now()}-${rand}.${ext}`;
    if (!DRY_RUN) {
      fs.writeFileSync(path.join(FALLBACK_DIR, fname), bytes, { mode: 0o644 });
    }
    const publicUrl = `${PUBLIC_BASE}/artifacts/mv-fallback/${fname}`;
    if (!DRY_RUN) {
      await pool.query(
        `UPDATE user_works SET cover_image = $2, preview_image_url = $2, updated_at = now() WHERE id = $1`,
        [row.id, publicUrl],
      );
    }
    return { id: row.id, title: row.title, status: "regenerated", to: publicUrl };
  } catch (e) {
    return { id: row.id, title: row.title, status: "exception", error: String(e?.message || e).slice(0, 100) };
  }
}

(async () => {
  console.log(`mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}  limit=${LIMIT || "all"}`);
  console.log(`cover API: ${COVER_API}`);
  const rows = await listStillExpired();
  console.log(`candidates: ${rows.length}`);
  const out = await mapWithLimit(rows, 2, regenOne);
  const counts = out.reduce((a, r) => {
    const k = r?.status || "unknown";
    a[k] = (a[k] || 0) + 1;
    return a;
  }, {});
  console.log("---");
  console.log("results:", JSON.stringify(counts, null, 2));
  ["regenerated", "api_failed", "no_url", "exception"].forEach((k) => {
    const samp = out.filter((r) => r?.status === k).slice(0, 3);
    if (samp.length) console.log(`\n${k} (sample 3):`, JSON.stringify(samp, null, 2));
  });
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
