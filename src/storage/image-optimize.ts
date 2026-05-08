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

/** Generate WebP + thumbnail next to the source, upload all three to R2.
 * Fire-and-forget safe: never throws. Returns nulls when R2 disabled or
 * source missing. The original is uploaded under its real extension; the
 * webp/thumb variants share the basename minus extension. */
export async function optimizeAndUpload(
  localPath: string,
  keyPrefix: string = "artifacts",
): Promise<OptimizeResult> {
  const result: OptimizeResult = { original_url: null, webp_url: null, thumb_url: null };
  if (!fs.existsSync(localPath)) return result;

  const ext = path.extname(localPath).toLowerCase();
  const base = path.basename(localPath, ext);
  const dir = path.dirname(localPath);

  // 1) Upload original
  const origKey = defaultKey(localPath, keyPrefix);
  if (r2Enabled()) {
    result.original_url = await uploadToR2(localPath, origKey);
  }

  // Only optimize raster images; skip mp4/audio/etc
  const isImage = ext === ".png" || ext === ".jpg" || ext === ".jpeg";
  if (!isImage) return result;

  // 2) WebP variant
  const webpAbs = path.join(dir, `${base}.webp`);
  if (await convertToWebp(localPath, webpAbs)) {
    if (r2Enabled()) {
      result.webp_url = await uploadToR2(webpAbs, `${keyPrefix.replace(/\/+$/, "")}/${base}.webp`, "image/webp");
    }
  }

  // 3) Thumbnail (400px wide WebP)
  const thumbAbs = path.join(dir, `${base}.thumb.webp`);
  if (await generateThumbnail(localPath, thumbAbs, 400)) {
    if (r2Enabled()) {
      result.thumb_url = await uploadToR2(thumbAbs, `${keyPrefix.replace(/\/+$/, "")}/${base}.thumb.webp`, "image/webp");
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
