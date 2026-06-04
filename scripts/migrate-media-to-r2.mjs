#!/usr/bin/env node
/* CSSOS_WAVE_418 20260524 — Jing「大文件(demo媒体/字体/封面/视频/音频)迁往 R2 资产服务器」
 *
 * cdn.cssstudio.app is a PUBLIC R2-backed serving source. Big media should live
 * there, not on api-vm's root disk. This script audits + migrates, SAFELY:
 *
 *   1) DRY-RUN (default — read-only, no uploads/deletes/DB writes):
 *        node scripts/migrate-media-to-r2.mjs
 *   2) APPLY (upload local→R2, verify cdn 200, update DB url; DOES NOT delete local):
 *        node scripts/migrate-media-to-r2.mjs --apply [--limit N] [--types a,b]
 *   3) DELETE-VERIFIED (only AFTER reviewing; removes local files whose DB url is
 *      already cdn AND the CDN returns 200 — reclaims disk; never touches anything
 *      unverified):
 *        node scripts/migrate-media-to-r2.mjs --delete-verified [--limit N]
 *
 * Jing's rule: 上传+校验先跑, 单独确认后再删本地. So --apply never deletes; deletion
 * is its own explicit pass that re-verifies the CDN copy first.
 *
 * Run ON api-vm (DATABASE_URL + R2_* env + the /artifacts dirs must be present):
 *   ssh api-vm 'cd /srv/cssos/repo && DATABASE_URL="…" R2_…  node scripts/migrate-media-to-r2.mjs --apply'
 */
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const MODE = process.argv.includes("--delete-verified") ? "delete"
  : process.argv.includes("--apply") ? "apply" : "dry";
const argVal = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const LIMIT = parseInt(argVal("--limit", "0"), 10) || 0; // 0 = no limit
const LIST_ONLY = process.argv.includes("--list-only"); // delete mode: print paths, don't unlink
const TYPE_FILTER = (argVal("--types", "") || "").split(",").map(s => s.trim()).filter(Boolean);

const DB = process.env.DATABASE_URL;
if (!DB) { console.error("DATABASE_URL not set"); process.exit(1); }

const R2 = {
  account: process.env.R2_ACCOUNT_ID || "",
  key: process.env.R2_ACCESS_KEY_ID || "",
  secret: process.env.R2_SECRET_ACCESS_KEY || "",
  bucket: process.env.R2_BUCKET || "",
  publicUrl: (process.env.R2_PUBLIC_URL || "https://cdn.cssstudio.app").replace(/\/+$/, ""),
};
const r2Enabled = !!(R2.account && R2.key && R2.secret && R2.bucket);
const s3 = r2Enabled ? new S3Client({
  region: "auto",
  endpoint: `https://${R2.account}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2.key, secretAccessKey: R2.secret },
}) : null;

const CDN_HOST = (() => { try { return new URL(R2.publicUrl).hostname; } catch { return "cdn.cssstudio.app"; } })();

// URL → candidate local file roots, keyed by /artifacts/<sub>/ prefix.
const ROOTS = {
  "mv": ["/var/lib/cssos/mv", "/srv/cssos/artifacts/mv"], // nginx aliases /artifacts/mv → /var/lib/cssos/mv
  "audio": ["/srv/cssos/artifacts/audio"],
  "mv-fallback": ["/srv/cssos/artifacts/mv-fallback"],
  "upscaled": ["/srv/cssos/artifacts/upscaled"],
  "exports": ["/srv/cssos/artifacts/exports"],
};

function urlClass(url) {
  const u = String(url || "").trim();
  if (!u) return "empty";
  if (u.startsWith("data:")) return "data";
  if (u.startsWith("/artifacts/")) return "local";          // relative local
  if (!/^https?:\/\//i.test(u)) return "other";
  let host = ""; try { host = new URL(u).hostname.toLowerCase(); } catch { return "other"; }
  if (host === CDN_HOST) return "r2";
  if (host === "cssstudio.app" && u.includes("/artifacts/")) return "local";
  if (/replicate\.delivery|fal\.media|aiquickdraw|suno|musicfile\.kie\.ai|tempfile/i.test(host)) return "temp";
  return "other";
}

// Extract the "/artifacts/<sub>/<rest>" key from a local url (absolute or relative).
function artifactKey(url) {
  const u = String(url || "");
  const i = u.indexOf("/artifacts/");
  if (i < 0) return null;
  return u.slice(i + 1).split(/[?#]/)[0]; // -> "artifacts/<sub>/<rest>"
}
function localPathForKey(key) {
  // key = "artifacts/<sub>/<rest...>"
  const m = key.match(/^artifacts\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const sub = m[1], rest = m[2];
  const roots = ROOTS[sub] || [`/srv/cssos/artifacts/${sub}`];
  for (const root of roots) {
    const p = path.join(root, rest);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function cdnUrlForKey(key) { return `${R2.publicUrl}/${key}`; }

function guessType(p) {
  const e = path.extname(p).toLowerCase();
  return ({ ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg",
    ".wav": "audio/wav", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".srt": "application/x-subrip" })[e] || "application/octet-stream";
}
async function uploadFile(localPath, key) {
  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: R2.bucket, Key: key, Body: body,
    ContentType: guessType(localPath),
    CacheControl: "public, max-age=31536000, immutable",
  }));
}
async function cdnOk(key) {
  try {
    const r = await fetch(cdnUrlForKey(key), { method: "HEAD" });
    return r.ok;
  } catch { return false; }
}

const client = new pg.Client({ connectionString: DB });
await client.connect();

// Build the unified candidate list: {kind, id, col, url, asset_type, update(newUrl)}
const ASSET_TYPES = ["slideshow_frame", "final_mv", "audio_track_1", "audio_track_2", "cover_image", "preview_image", "cover_slide"];
const typesWanted = TYPE_FILTER.length ? ASSET_TYPES.filter(t => TYPE_FILTER.includes(t)) : ASSET_TYPES;

const items = [];
for (const r of (await client.query(`SELECT id, asset_type, url FROM work_assets WHERE asset_type = ANY($1)`, [typesWanted])).rows) {
  items.push({ kind: "asset", id: r.id, asset_type: r.asset_type, url: r.url,
    update: (nu) => client.query(`UPDATE work_assets SET url=$2 WHERE id=$1`, [r.id, nu]) });
}
for (const col of ["preview_audio_url", "preview_video_url", "cover_image"]) {
  for (const r of (await client.query(`SELECT id, ${col} AS url FROM user_works WHERE ${col} IS NOT NULL`)).rows) {
    items.push({ kind: "work." + col, id: r.id, asset_type: col, url: r.url,
      update: (nu) => client.query(`UPDATE user_works SET ${col}=$2 WHERE id=$1`, [r.id, nu]) });
  }
}

console.log("=".repeat(64));
console.log(`CSSOS media → R2  (mode: ${MODE.toUpperCase()})  candidates: ${items.length}`);
console.log("=".repeat(64));

if (MODE === "dry") {
  const cls = {};
  for (const it of items) { const c = urlClass(it.url); (cls[c] ||= 0); cls[c]++; }
  console.log("URL classification:", JSON.stringify(cls));
  // local files present-on-disk + bytes
  let bytes = 0, present = 0, missing = 0;
  for (const it of items) {
    if (urlClass(it.url) !== "local") continue;
    const key = artifactKey(it.url); const lp = key && localPathForKey(key);
    if (lp) { present++; try { bytes += fs.statSync(lp).size; } catch {} } else { missing++; }
  }
  console.log(`local migratable: ${present} files present (${(bytes/1073741824).toFixed(2)} GB), ${missing} url-local-but-file-missing`);
  for (const d of ["/srv/cssos/artifacts", "/var/lib/cssos/mv"]) {
    try { console.log("  disk: " + execSync(`du -sh ${d} 2>/dev/null`).toString().trim()); } catch {}
  }
  console.log("\nNext: --apply to upload+verify+update-DB (no delete), then --delete-verified.");
  await client.end(); process.exit(0);
}

if (!r2Enabled) { console.error("R2 env not set — cannot apply."); await client.end(); process.exit(1); }

let uploaded = 0, verified = 0, dbUpdated = 0, skipMissing = 0, failed = 0, deleted = 0, processed = 0;

for (const it of items) {
  if (LIMIT && processed >= LIMIT) break;
  const cls = urlClass(it.url);

  if (MODE === "apply") {
    if (cls !== "local") continue;
    const key = artifactKey(it.url);
    const lp = key && localPathForKey(key);
    if (!lp) { skipMissing++; continue; }
    processed++;
    try {
      await uploadFile(lp, key); uploaded++;
      if (await cdnOk(key)) {
        verified++;
        await it.update(cdnUrlForKey(key)); dbUpdated++;
      } else {
        failed++;
        console.warn("  CDN verify FAILED (kept local url):", key);
      }
    } catch (e) { failed++; console.warn("  upload error:", key, e.message); }
    if (processed % 100 === 0) console.log(`  …${processed} processed (up=${uploaded} ok=${verified} db=${dbUpdated})`);
  }

  if (MODE === "delete") {
    // Only reclaim local files whose DB url is ALREADY cdn AND the cdn copy is live.
    if (cls !== "r2") continue;
    const key = artifactKey(it.url);
    const lp = key && localPathForKey(key);
    if (!lp) continue; // nothing local to reclaim
    processed++;
    if (await cdnOk(key)) {
      if (LIST_ONLY) {
        // Emit the verified-safe path for an external `sudo rm` (files are owned
        // by www-data/root; node runs as jing). Node stays read-only.
        console.log("RMOK\t" + lp);
        deleted++;
      } else {
        try { fs.unlinkSync(lp); deleted++; }
        catch (e) { console.warn("  unlink error:", lp, e.message); }
      }
    } else {
      console.warn("  CDN NOT ok — KEEPING local (safety):", key);
    }
    if (!LIST_ONLY && processed % 200 === 0) console.log(`  …${processed} checked (deleted=${deleted})`);
  }
}

console.log("\nRESULT:");
if (MODE === "apply") console.log(`  uploaded=${uploaded} verified200=${verified} dbUpdated=${dbUpdated} fileMissing=${skipMissing} failed=${failed}`);
if (MODE === "delete") console.log(`  localDeleted=${deleted} (only cdn-verified)`);
await client.end();
console.log("Done.");
