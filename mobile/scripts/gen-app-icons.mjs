#!/usr/bin/env node
/* CSSOS_GEN_APP_ICONS 20260508 — Jing
 *
 * Slice mobile/icon-source-1024.png into the full Apple AppIcon.appiconset.
 * 18 sub-sizes covering iPhone notification, settings, spotlight, app
 * (1×/2×/3×) + iPad (1×/2×) + Marketing 1024 + iOS 14+ "Single Size".
 *
 * Usage:
 *   cd mobile && node scripts/gen-app-icons.mjs
 *
 * Requires: sharp (already in repo deps for Wave 97).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE = process.env.ICON_SOURCE || path.join(ROOT, "icon-source-1024.png");
const OUT_DIR = path.join(ROOT, "ios/App/App/Assets.xcassets/AppIcon.appiconset");

if (!fs.existsSync(SOURCE)) {
  console.error(`[gen-app-icons] missing source: ${SOURCE}`);
  console.error(`Save your 1024×1024 master to that path, then re-run.`);
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) {
  console.error(`[gen-app-icons] missing AppIcon.appiconset: run 'npx cap add ios' first.`);
  process.exit(1);
}

/* All sizes Apple needs. Each entry: pt size + scale. Filename uses
 * pixel size (pt × scale). */
const TARGETS = [
  // iPhone Notification 20pt
  { size: 20, scale: 2, idiom: "iphone", filename: "AppIcon-20@2x.png" },
  { size: 20, scale: 3, idiom: "iphone", filename: "AppIcon-20@3x.png" },
  // iPhone Settings 29pt
  { size: 29, scale: 2, idiom: "iphone", filename: "AppIcon-29@2x.png" },
  { size: 29, scale: 3, idiom: "iphone", filename: "AppIcon-29@3x.png" },
  // iPhone Spotlight 40pt
  { size: 40, scale: 2, idiom: "iphone", filename: "AppIcon-40@2x.png" },
  { size: 40, scale: 3, idiom: "iphone", filename: "AppIcon-40@3x.png" },
  // iPhone App 60pt
  { size: 60, scale: 2, idiom: "iphone", filename: "AppIcon-60@2x.png" },
  { size: 60, scale: 3, idiom: "iphone", filename: "AppIcon-60@3x.png" },
  // iPad Notification 20pt
  { size: 20, scale: 1, idiom: "ipad", filename: "AppIcon-20@1x-ipad.png" },
  { size: 20, scale: 2, idiom: "ipad", filename: "AppIcon-20@2x-ipad.png" },
  // iPad Settings 29pt
  { size: 29, scale: 1, idiom: "ipad", filename: "AppIcon-29@1x-ipad.png" },
  { size: 29, scale: 2, idiom: "ipad", filename: "AppIcon-29@2x-ipad.png" },
  // iPad Spotlight 40pt
  { size: 40, scale: 1, idiom: "ipad", filename: "AppIcon-40@1x-ipad.png" },
  { size: 40, scale: 2, idiom: "ipad", filename: "AppIcon-40@2x-ipad.png" },
  // iPad App 76pt
  { size: 76, scale: 2, idiom: "ipad", filename: "AppIcon-76@2x.png" },
  // iPad Pro 83.5pt @2x = 167×167
  { size: 83.5, scale: 2, idiom: "ipad", filename: "AppIcon-83.5@2x.png" },
  // App Store / Marketing 1024
  { size: 1024, scale: 1, idiom: "ios-marketing", filename: "AppIcon-1024.png" },
];

async function main() {
  console.log(`[gen-app-icons] source=${SOURCE}`);
  console.log(`[gen-app-icons] out=${OUT_DIR}`);
  for (const t of TARGETS) {
    const px = Math.round(t.size * t.scale);
    const out = path.join(OUT_DIR, t.filename);
    await sharp(SOURCE)
      .resize(px, px, { fit: "cover", kernel: "lanczos3" })
      // Apple rejects PNGs with alpha for App Store icons — flatten to opaque.
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .png()
      .toFile(out);
    console.log(`  ${px}×${px}  →  ${t.filename}`);
  }

  // Write Contents.json (Xcode reads this to map files to the slots).
  const contents = {
    images: TARGETS.map((t) => ({
      idiom: t.idiom,
      size: `${t.size}x${t.size}`,
      scale: `${t.scale}x`,
      filename: t.filename,
    })),
    info: { version: 1, author: "cssos-gen-app-icons" },
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "Contents.json"),
    JSON.stringify(contents, null, 2),
  );
  console.log(`[gen-app-icons] wrote Contents.json`);
  console.log(`[gen-app-icons] DONE. ${TARGETS.length} icons generated.`);
}

main().catch((err) => {
  console.error("[gen-app-icons] failed:", err);
  process.exit(2);
});
