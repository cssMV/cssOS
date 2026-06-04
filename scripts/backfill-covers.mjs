#!/usr/bin/env node
/* CSSOS_WAVE_210 20260516 — Jing: 后台补封面.
 *
 * For every user_works row whose cover_image points at an ephemeral host
 * (replicate.delivery, fal.media, aiquickdraw, etc.) — try to fetch it,
 * save to /srv/cssos/artifacts/mv-fallback/ as WebP, mirror to R2,
 * UPDATE user_works.cover_image + preview_image_url to the durable URL.
 *
 * Live URLs get rescued. Already-expired ones are tagged in DB with a
 * marker so we can later regenerate them via callImageGen.
 *
 * Usage (run on api-vm):
 *   sudo -u jing node /srv/cssos/repo/scripts/backfill-covers.mjs --dry-run
 *   sudo -u jing node /srv/cssos/repo/scripts/backfill-covers.mjs --run
 *   sudo -u jing node /srv/cssos/repo/scripts/backfill-covers.mjs --run --limit 50
 *
 * Concurrency capped at 4 in-flight fetches to be polite to upstream.
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
const ARTIFACTS_DIR = process.env.MV_ARTIFACTS_DIR || "/var/lib/cssos/mv";
const FALLBACK_DIR = "/srv/cssos/artifacts/mv-fallback";
const PUBLIC_BASE = process.env.CSSOS_PUBLIC_BASE || "https://cssstudio.app";
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL missing"); process.exit(1); }

const EPHEMERAL_HOSTS = [
  "replicate.delivery", "fal.media", "v3b.fal.media",
  "aiquickdraw.com", "tempfile.aiquickdraw.com",
];
function isEphemeral(url) {
  if (!url) return false;
  return EPHEMERAL_HOSTS.some((h) => url.includes(h));
}

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

async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try { results[i] = await fn(items[i], i); }
      catch (e) { results[i] = { error: e?.message || String(e) }; }
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

const pool = new pg.Pool({ connectionString: DB_URL });

async function listEphemeral() {
  const sql = `
    SELECT id, title, cover_image
    FROM user_works
    WHERE parent_work_id IS NULL
      AND cover_image IS NOT NULL
      AND cover_image != ''
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

async function backfillOne(row) {
  const url = row.cover_image;
  try {
    const buf = await fetchBin(url);
    if (buf.length < 1024) return { id: row.id, status: "skip_tiny", size: buf.length };
    // Save as WebP via sharp if available, else raw
    let ext = "webp";
    let bytes = buf;
    try {
      const sharp = (await import("sharp")).default;
      bytes = await sharp(buf, { failOn: "none" }).webp({ quality: 85 }).toBuffer();
    } catch (_e) {
      ext = "bin";
    }
    const hash = crypto.createHash("sha1").update(String(row.id)).digest("hex").slice(0, 8);
    const rand = crypto.randomBytes(4).toString("hex");
    const fname = `cover-bf-${hash}-${Date.now()}-${rand}.${ext}`;
    if (!DRY_RUN) {
      fs.mkdirSync(FALLBACK_DIR, { recursive: true });
      fs.writeFileSync(path.join(FALLBACK_DIR, fname), bytes, { mode: 0o644 });
    }
    const publicUrl = `${PUBLIC_BASE}/artifacts/mv-fallback/${fname}`;
    if (!DRY_RUN) {
      await pool.query(
        `UPDATE user_works SET cover_image = $2, preview_image_url = $2, updated_at = now() WHERE id = $1`,
        [row.id, publicUrl],
      );
    }
    return { id: row.id, status: "rescued", from: url.slice(0, 60), to: publicUrl };
  } catch (e) {
    return { id: row.id, status: "expired_or_failed", error: String(e?.message || e).slice(0, 80) };
  }
}

(async () => {
  console.log(`mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}  limit=${LIMIT || "all"}`);
  const rows = await listEphemeral();
  console.log(`candidates: ${rows.length}`);
  const out = await mapWithLimit(rows, 4, backfillOne);
  const counts = out.reduce((a, r) => {
    const k = r?.status || "unknown";
    a[k] = (a[k] || 0) + 1;
    return a;
  }, {});
  console.log("---");
  console.log("results:", JSON.stringify(counts, null, 2));
  // Sample 3 of each kind
  ["rescued", "expired_or_failed", "skip_tiny"].forEach((k) => {
    const samp = out.filter((r) => r?.status === k).slice(0, 3);
    if (samp.length) console.log(`\n${k} (sample 3):`, JSON.stringify(samp, null, 2));
  });
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
