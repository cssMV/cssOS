#!/usr/bin/env node
/* CSSOS_GEN_SPLASH 20260508 — Jing
 *
 * Build the iOS launch-screen splash from icon-source-1024.png.
 * Capacitor's LaunchScreen.storyboard references a single image
 * named "Splash" sized 2732x2732 (universal, scaleAspectFill on
 * any device). We center the app icon on a black canvas at ~38%
 * so it matches the bounded look of the App Store icon.
 *
 * Outputs: mobile/ios/App/App/Assets.xcassets/Splash.imageset/
 *   splash-2732x2732.png
 *   splash-2732x2732-1.png  (dark mode — same image, black bg works)
 *   splash-2732x2732-2.png  (tinted — same)
 *
 * Usage: cd mobile && node scripts/gen-splash.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
/* Prefer the un-polished original (no corner glow) for splash —
 * the corner lights look great on the app icon but distracting on
 * the launch screen. Falls back to the polished file if no backup. */
const ORIG = path.join(ROOT, "icon-source-1024.original.png");
const POLISHED = path.join(ROOT, "icon-source-1024.png");
const SRC = fs.existsSync(ORIG) ? ORIG : POLISHED;
const OUT_DIR = path.join(
  ROOT,
  "ios/App/App/Assets.xcassets/Splash.imageset",
);

if (!fs.existsSync(SRC)) {
  console.error(`[splash] missing source: ${SRC}`);
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) {
  console.error(`[splash] missing imageset dir: ${OUT_DIR}`);
  process.exit(1);
}

const SIZE = 2732;
const LOGO_FRAC = 0.33;        // logo fills 1/3 of canvas (per Jing 20260508)
const LOGO_PX = Math.round(SIZE * LOGO_FRAC);

async function main() {
  const logo = await sharp(SRC)
    .resize(LOGO_PX, LOGO_PX, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const offset = Math.round((SIZE - LOGO_PX) / 2);

  const splash = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([{ input: logo, top: offset, left: offset }])
    .png({ quality: 95, compressionLevel: 9 })
    .toBuffer();

  for (const name of [
    "splash-2732x2732.png",
    "splash-2732x2732-1.png",
    "splash-2732x2732-2.png",
  ]) {
    const out = path.join(OUT_DIR, name);
    fs.writeFileSync(out, splash);
    console.log(`[splash] wrote ${out} (${splash.length} bytes)`);
  }
  console.log("[splash] DONE. Re-run: npx cap sync ios");
}

main().catch((e) => { console.error("[splash] failed:", e); process.exit(2); });
