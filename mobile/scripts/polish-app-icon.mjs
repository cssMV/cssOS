#!/usr/bin/env node
/* CSSOS_POLISH_APP_ICON 20260508 — Jing
 *
 * Apple-style icon polish:
 *   1. Crop the source so the gem fills 92% of the canvas (was ~60%)
 *      — matches the visual density of Stripe/Connect/etc icons.
 *   2. Add corner glow: top-left + bottom-right brighter regions, like
 *      Stripe's icon (suggests "lit from corners" lighting).
 *   3. Re-flatten alpha to opaque black (App Store rule).
 *
 * Output: overwrites mobile/icon-source-1024.png with the polished
 * version (the original is in git history if you need it back).
 *
 * Usage:
 *   cd mobile && node scripts/polish-app-icon.mjs
 *   then re-run: node scripts/gen-app-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "icon-source-1024.png");
const OUT = path.join(ROOT, "icon-source-1024.png");
const BACKUP = path.join(ROOT, "icon-source-1024.original.png");

if (!fs.existsSync(SRC)) {
  console.error(`[polish] source missing: ${SRC}`);
  process.exit(1);
}

if (!fs.existsSync(BACKUP)) {
  fs.copyFileSync(SRC, BACKUP);
  console.log(`[polish] backed up original → ${BACKUP}`);
}

async function main() {
  /* Step 1 — center-crop the existing image to 92% of itself, then
   * scale back to 1024×1024. This makes the gem fill more of the
   * canvas. */
  const meta = await sharp(BACKUP).metadata();
  const W = meta.width || 1024;
  const H = meta.height || 1024;
  const cropFrac = 0.78;            // keep middle 78% (more aggressive zoom)
  const cropW = Math.round(W * cropFrac);
  const cropH = Math.round(H * cropFrac);
  const cropL = Math.round((W - cropW) / 2);
  const cropT = Math.round((H - cropH) / 2);

  const cropped = await sharp(BACKUP)
    .extract({ left: cropL, top: cropT, width: cropW, height: cropH })
    .resize(1024, 1024, { kernel: "lanczos3" })
    .toBuffer();

  /* Step 2 — corner glow. Composite a soft radial gradient at top-left
   * and bottom-right corners, screen-blended with the gem. Use SVG for
   * the gradients (sharp can composite SVG natively). */
  const tlGlow = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="0%" cy="0%" r="60%">
          <stop offset="0%" stop-color="white" stop-opacity="0.42"/>
          <stop offset="40%" stop-color="white" stop-opacity="0.10"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#g)"/>
    </svg>`.trim();

  const brGlow = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="100%" cy="100%" r="55%">
          <stop offset="0%" stop-color="white" stop-opacity="0.28"/>
          <stop offset="50%" stop-color="white" stop-opacity="0.06"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#g)"/>
    </svg>`.trim();

  const polished = await sharp(cropped)
    .composite([
      { input: Buffer.from(tlGlow), blend: "screen" },
      { input: Buffer.from(brGlow), blend: "screen" },
    ])
    /* App Store rejects PNG with alpha — flatten to black. */
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(OUT);

  console.log(`[polish] wrote ${OUT}`);
  console.log(`         ${polished.width}×${polished.height} ${polished.size} bytes`);
  console.log(`[polish] DONE. Now re-run: node scripts/gen-app-icons.mjs`);
}

main().catch((e) => { console.error("[polish] failed:", e); process.exit(2); });
