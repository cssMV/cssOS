/* CSSOS Wave 97 — image optimization (WebP + thumbnails) via sharp.
 *
 * sharp picked over alternatives (jimp, imagemagick, squoosh-cli) because:
 *   - native libvips bindings → 5-10x faster than pure-JS jimp
 *   - excellent WebP encoder, used by Next.js / Vercel / Cloudflare
 *   - no external binary dep (vs imagemagick)
 *   - synchronous-friendly, streamable, and battle-tested for thumbnails
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { uploadToR2, r2Enabled } from "./r2";

export type OptimizeResult = {
  original_url: string | null;
  webp_url: string | null;
  thumb_url: string | null;
};

/** Convert a PNG/JPEG to WebP @ q=80. Returns true on success. */
export async function convertToWebp(localPath: string, output: string): Promise<boolean> {
  try {
    await sharp(localPath).webp({ quality: 80 }).toFile(output);
    return true;
  } catch (e) {
    console.warn("[image-optimize] convertToWebp failed:", (e as Error)?.message);
    return false;
  }
}

/** Resize to `size` width (preserving aspect ratio), encode WebP @ q=75. */
export async function generateThumbnail(
  localPath: string,
  output: string,
  size: number = 400,
): Promise<boolean> {
  try {
    await sharp(localPath)
      .resize({ width: size, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(output);
    return true;
  } catch (e) {
    console.warn("[image-optimize] generateThumbnail failed:", (e as Error)?.message);
    return false;
  }
}

/** Build the R2 key prefix for an artifact under MV_FALLBACK_ARTIFACTS_DIR.
 * Default: "artifacts/<basename>". Caller can override with `keyPrefix`. */
function defaultKey(localPath: string, keyPrefix: string): string {
  const base = path.basename(localPath);
  return `${keyPrefix.replace(/\/+$/, "")}/${base}`;
}

/** CSSOS_WAVE_110 20260510 — Jing
 *
 * WebP-only policy: jpg/png never land in our artifact dirs anymore
 * (persistBase64Cover encodes WebP directly). This helper now does
 * exactly two things:
 *
 *   1. If source is .webp → upload the existing webp + ensure a
 *      .thumb.webp sibling exists (generate from webp if missing),
 *      then upload the thumb. No "original" jpg/png ever touches R2.
 *   2. If source is jpg/png/jpeg (legacy paths) → still convert to
 *      webp + thumb on the fly and upload only the webp variants.
 *      Source jpg/png gets uploaded too for backward compat with
 *      records that already point at .jpg / .png URLs, BUT we no
 *      longer keep the original on disk if a webp companion was
 *      written — caller can clean up.
 *   3. Audio / mp4 / etc still upload as-is (untouched).
 *
 * Fire-and-forget safe: never throws.
 */
export async function optimizeAndUpload(
  localPath: string,
  keyPrefix: string = "artifacts",
): Promise<OptimizeResult> {
  const result: OptimizeResult = { original_url: null, webp_url: null, thumb_url: null };
  if (!fs.existsSync(localPath)) return result;

  const ext = path.extname(localPath).toLowerCase();
  const base = path.basename(localPath, ext);
  const dir = path.dirname(localPath);
  const cleanPrefix = keyPrefix.replace(/\/+$/, "");

  // For webp source, treat the source AS the webp_url and skip
  // re-encoding to avoid quality loss + cycles.
  if (ext === ".webp") {
    if (r2Enabled()) {
      const webpKey = `${cleanPrefix}/${base}.webp`;
      result.webp_url = await uploadToR2(localPath, webpKey, "image/webp");
    }
    const thumbAbs = path.join(dir, `${base}.thumb.webp`);
    if (!fs.existsSync(thumbAbs)) {
      // Generate thumb from the webp itself.
      await generateThumbnail(localPath, thumbAbs, 400);
    }
    if (fs.existsSync(thumbAbs) && r2Enabled()) {
      result.thumb_url = await uploadToR2(thumbAbs, `${cleanPrefix}/${base}.thumb.webp`, "image/webp");
    }
    return result;
  }

  // Non-image files (mp3/mp4/wav/etc) — upload as-is.
  const isLegacyImage = ext === ".png" || ext === ".jpg" || ext === ".jpeg";
  if (!isLegacyImage) {
    if (r2Enabled()) {
      result.original_url = await uploadToR2(localPath, defaultKey(localPath, keyPrefix));
    }
    return result;
  }

  // Legacy jpg/png path — still produce webp + thumb so consumers can
  // rely on the canonical companions. Original is uploaded for back
  // compat with old DB rows.
  if (r2Enabled()) {
    result.original_url = await uploadToR2(localPath, defaultKey(localPath, keyPrefix));
  }
  const webpAbs = path.join(dir, `${base}.webp`);
  if (await convertToWebp(localPath, webpAbs)) {
    if (r2Enabled()) {
      result.webp_url = await uploadToR2(webpAbs, `${cleanPrefix}/${base}.webp`, "image/webp");
    }
  }
  const thumbAbs = path.join(dir, `${base}.thumb.webp`);
  if (await generateThumbnail(localPath, thumbAbs, 400)) {
    if (r2Enabled()) {
      result.thumb_url = await uploadToR2(thumbAbs, `${cleanPrefix}/${base}.thumb.webp`, "image/webp");
    }
  }
  return result;
}

/** Fire-and-forget wrapper. Returns immediately; logs on completion. */
export function optimizeAndUploadAsync(localPath: string, keyPrefix: string = "artifacts"): void {
  setImmediate(() => {
    optimizeAndUpload(localPath, keyPrefix)
      .then((r) => {
        if (r.webp_url || r.original_url) {
          console.log("[image-optimize] uploaded", path.basename(localPath),
            "orig=", !!r.original_url, "webp=", !!r.webp_url, "thumb=", !!r.thumb_url);
        }
      })
      .catch(() => {});
  });
}
