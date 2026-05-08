#!/usr/bin/env node
/* Wave 97 — backfill /srv/cssos/artifacts/* into Cloudflare R2.
 *
 * Walks the artifacts dir, uploads each PNG/JPEG/WEBP/MP4/MP3 not yet in R2,
 * generates WebP + thumb variants for raster images, and updates DB rows
 * (user_works.cover_image, .cover_image_webp, .cover_thumb_url; final_mv_url;
 * person_profiles.portrait_url et al.) to point at the CDN URL.
 *
 * Idempotent: skips rows whose URL is already prefixed with R2_PUBLIC_URL.
 *
 * Usage:
 *   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
 *   R2_BUCKET=cssos-artifacts R2_PUBLIC_URL=https://cdn.cssstudio.app \
 *   DATABASE_URL=postgres://... \
 *   node scripts/migrate-artifacts-to-r2.mjs --dry-run
 *
 *   (drop --dry-run to actually upload + write DB)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.CSSOS_ARTIFACTS_DIR || "/srv/cssos/artifacts";
const DRY = process.argv.includes("--dry-run");

const {
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_BUCKET, R2_PUBLIC_URL, DATABASE_URL,
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) {
  console.error("Missing R2 env vars. See header docstring.");
  process.exit(1);
}
const PUBLIC = R2_PUBLIC_URL.replace(/\/+$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

function ctype(p) {
  const ext = path.extname(p).toLowerCase();
  return ({
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm",
    ".mp3": "audio/mpeg", ".wav": "audio/wav",
  })[ext] || "application/octet-stream";
}

async function existsInR2(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function upload(localPath, key) {
  if (DRY) { console.log("[dry] PUT", key); return `${PUBLIC}/${key}`; }
  if (await existsInR2(key)) { return `${PUBLIC}/${key}`; }
  const Body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, Body,
    ContentType: ctype(localPath),
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${PUBLIC}/${key}`;
}

async function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile()) yield p;
  }
}

async function maybeMakeVariants(localPath, keyBase) {
  const ext = path.extname(localPath).toLowerCase();
  const isImg = ext === ".png" || ext === ".jpg" || ext === ".jpeg";
  if (!isImg) return { webp: null, thumb: null };
  const webpAbs = `${localPath}.gen.webp`;
  const thumbAbs = `${localPath}.gen.thumb.webp`;
  try {
    if (!fs.existsSync(webpAbs)) await sharp(localPath).webp({ quality: 80 }).toFile(webpAbs);
    if (!fs.existsSync(thumbAbs)) await sharp(localPath).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 75 }).toFile(thumbAbs);
  } catch (e) {
    console.warn("variant gen failed", localPath, e.message); return { webp: null, thumb: null };
  }
  const webpUrl = await upload(webpAbs, `${keyBase}.webp`);
  const thumbUrl = await upload(thumbAbs, `${keyBase}.thumb.webp`);
  try { fs.unlinkSync(webpAbs); } catch {}
  try { fs.unlinkSync(thumbAbs); } catch {}
  return { webp: webpUrl, thumb: thumbUrl };
}

async function main() {
  if (!fs.existsSync(ROOT)) {
    console.error("Artifacts dir not found:", ROOT); process.exit(1);
  }
  let nUploaded = 0, nSkipped = 0;
  const map = new Map(); // local /artifacts/... path -> { url, webp, thumb }
  for await (const abs of walk(ROOT)) {
    const ext = path.extname(abs).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mp3"].includes(ext)) continue;
    const rel = path.relative(ROOT, abs);
    const key = `artifacts/${rel}`.replace(/\\/g, "/");
    const exists = await existsInR2(key);
    if (exists) { nSkipped++; continue; }
    const url = await upload(abs, key);
    const base = key.replace(/\.[^.]+$/, "");
    const variants = await maybeMakeVariants(abs, base);
    const publicPath = `/artifacts/${rel}`.replace(/\\/g, "/");
    map.set(publicPath, { url, webp: variants.webp, thumb: variants.thumb });
    nUploaded++;
    if (nUploaded % 25 === 0) console.log(`[progress] uploaded=${nUploaded} skipped=${nSkipped}`);
  }
  console.log(`upload pass done: uploaded=${nUploaded} skipped=${nSkipped}`);

  if (!DATABASE_URL) {
    console.warn("DATABASE_URL not set; skipping DB rewrite."); return;
  }
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  let nRows = 0;
  try {
    for (const [localUrl, v] of map) {
      if (DRY) continue;
      const r1 = await client.query(
        `UPDATE user_works
            SET cover_image=$2,
                cover_image_webp=COALESCE($3, cover_image_webp),
                cover_thumb_url=COALESCE($4, cover_thumb_url)
          WHERE cover_image=$1`,
        [localUrl, v.url, v.webp, v.thumb],
      );
      const r2 = await client.query(
        `UPDATE user_works SET final_mv_url=$2 WHERE final_mv_url=$1`,
        [localUrl, v.url],
      );
      const r3 = await client.query(
        `UPDATE person_profiles
            SET portrait_url=$2,
                portrait_webp=COALESCE($3, portrait_webp),
                portrait_thumb_url=COALESCE($4, portrait_thumb_url)
          WHERE portrait_url=$1`,
        [localUrl, v.url, v.webp, v.thumb],
      ).catch(() => ({ rowCount: 0 }));
      nRows += (r1.rowCount || 0) + (r2.rowCount || 0) + (r3.rowCount || 0);
    }
  } finally {
    await client.end();
  }
  console.log(`db rewrite done: rows updated=${nRows}${DRY ? " (DRY)" : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
