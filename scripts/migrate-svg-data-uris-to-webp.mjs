#!/usr/bin/env node
/**
 * CSSOS_WAVE_111D_NO_SVG_DATA_URI · one-shot migration
 *
 * Scans every column that historically held cover/preview URLs for
 * `data:image/svg+xml;base64,...` values left over from the old
 * placeholder code path, decodes each SVG, rasterizes it to WebP via
 * sharp, drops the file under public/uploads/fallbacks/, and updates
 * the column to point at the new public URL.
 *
 * Idempotent: hash-named files are reused on re-run.
 *
 * Run on api-vm with the live DB:
 *   ssh api-vm 'cd /srv/cssos/repo && node scripts/migrate-svg-data-uris-to-webp.mjs'
 */
import { Client } from "pg";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

// Write into the live public dir so the rasterized files are immediately
// served by the running cssOS process. Override with CSSOS_FALLBACK_DIR.
const FALLBACK_DIR = process.env.CSSOS_FALLBACK_DIR ||
  "/srv/cssos/current/public/uploads/fallbacks";
fs.mkdirSync(FALLBACK_DIR, { recursive: true });

// table, primary-key col, value col, default (w, h) when SVG has no viewBox
const TARGETS = [
  { table: "user_works", pk: "id", col: "cover_image",       w: 1024, h: 1024 },
  { table: "user_works", pk: "id", col: "preview_image_url", w: 1024, h: 576  },
];

async function rasterize(dataUri, w, h) {
  // Two historical formats: `;base64,<b64>` and `;utf8,<percent-encoded>`
  let svg;
  if (dataUri.startsWith("data:image/svg+xml;base64,")) {
    svg = Buffer.from(dataUri.slice("data:image/svg+xml;base64,".length), "base64").toString("utf8");
  } else if (dataUri.startsWith("data:image/svg+xml;utf8,")) {
    svg = decodeURIComponent(dataUri.slice("data:image/svg+xml;utf8,".length));
  } else if (dataUri.startsWith("data:image/svg+xml,")) {
    svg = decodeURIComponent(dataUri.slice("data:image/svg+xml,".length));
  } else {
    throw new Error("unsupported data URI format");
  }
  const hash = crypto.createHash("sha1").update(svg).digest("hex").slice(0, 12);
  const fname = `migrated-${w}x${h}-${hash}.webp`;
  const diskPath = path.join(FALLBACK_DIR, fname);
  if (!fs.existsSync(diskPath)) {
    try {
      await sharp(Buffer.from(svg, "utf8"), { density: 96 })
        .resize(w, h, { fit: "cover" })
        .webp({ quality: 82 })
        .toFile(diskPath);
    } catch (svgErr) {
      // Malformed historical SVG (unescaped text content etc.) — fall
      // back to a fresh gradient seeded by the original hash so the
      // user gets a stable, deterministic placeholder.
      let hue = 180;
      for (const ch of hash) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
      const safeSvg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0%" stop-color="hsl(${hue},70%,32%)"/>` +
        `<stop offset="100%" stop-color="hsl(${(hue + 60) % 360},75%,18%)"/>` +
        `</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
      await sharp(Buffer.from(safeSvg, "utf8"), { density: 96 })
        .resize(w, h, { fit: "cover" })
        .webp({ quality: 82 })
        .toFile(diskPath);
    }
    try { fs.chmodSync(diskPath, 0o644); } catch {}
  }
  return `/uploads/fallbacks/${fname}`;
}

const client = new Client({ connectionString: DB_URL });
await client.connect();
let total = 0, migrated = 0, failed = 0;
for (const t of TARGETS) {
  const { rows } = await client.query(
    `SELECT ${t.pk} AS id, ${t.col} AS val FROM ${t.table} WHERE ${t.col} LIKE 'data:image/svg+xml%'`
  );
  console.log(`[${t.table}.${t.col}] ${rows.length} rows`);
  total += rows.length;
  for (const r of rows) {
    try {
      const url = await rasterize(r.val, t.w, t.h);
      await client.query(`UPDATE ${t.table} SET ${t.col} = $1 WHERE ${t.pk} = $2`, [url, r.id]);
      migrated++;
    } catch (err) {
      console.warn(`  ✗ ${t.table}#${r.id}:`, err.message);
      failed++;
    }
  }
}
await client.end();
console.log(`\n✅ migrated ${migrated}/${total}  (failed ${failed})`);
console.log(`📂 ${FALLBACK_DIR}`);
