/* CSSOS Wave 97 — Cloudflare R2 mirror.
 *
 * Thin wrapper over @aws-sdk/client-s3 (R2 is S3-compatible). When env vars
 * are unset, all helpers no-op gracefully and callers fall back to local
 * /artifacts/* serving (backward compat). Local files are always kept as
 * backup; R2 is a mirror, never the source of truth.
 *
 * Env:
 *   R2_ACCOUNT_ID         — Cloudflare account id
 *   R2_ACCESS_KEY_ID      — R2 API token access key
 *   R2_SECRET_ACCESS_KEY  — R2 API token secret
 *   R2_BUCKET             — bucket name (e.g. "cssos-artifacts")
 *   R2_PUBLIC_URL         — public CDN base, e.g. "https://cdn.cssstudio.app"
 */
import * as fs from "fs";
import * as path from "path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.R2_BUCKET || "";
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

let _client: S3Client | null = null;

export function r2Enabled(): boolean {
  return !!(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET && PUBLIC_URL);
}

function client(): S3Client | null {
  if (!r2Enabled()) return null;
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function r2PublicUrl(remotePath: string): string {
  const key = remotePath.replace(/^\/+/, "");
  return `${PUBLIC_URL}/${key}`;
}

/** Returns true if the URL is already an R2/CDN URL (idempotency check). */
export function isR2Url(url: string): boolean {
  if (!url || !PUBLIC_URL) return false;
  return url.startsWith(PUBLIC_URL + "/") || url.startsWith(PUBLIC_URL);
}

function guessContentType(p: string): string {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".srt": return "application/x-subrip";
    default: return "application/octet-stream";
  }
}

/** Upload a local file to R2 at remotePath. Returns public CDN URL on
 * success, null on failure or when R2 is disabled. */
export async function uploadToR2(
  localPath: string,
  remotePath: string,
  contentType?: string,
): Promise<string | null> {
  const c = client();
  if (!c) return null;
  try {
    if (!fs.existsSync(localPath)) return null;
    const body = fs.readFileSync(localPath);
    const key = remotePath.replace(/^\/+/, "");
    await c.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType || guessContentType(localPath),
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return r2PublicUrl(key);
  } catch (e) {
    console.warn("[r2] upload failed:", remotePath, (e as Error)?.message);
    return null;
  }
}

/** Returns true if `key` already exists in R2. Used by migration script. */
export async function r2Exists(remotePath: string): Promise<boolean> {
  const c = client();
  if (!c) return false;
  try {
    await c.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: remotePath.replace(/^\/+/, ""),
    }));
    return true;
  } catch {
    return false;
  }
}

/** Fire-and-forget upload for use inside hot pipeline paths. Never throws. */
export function uploadToR2Async(
  localPath: string,
  remotePath: string,
  contentType?: string,
): void {
  if (!r2Enabled()) return;
  // queue microtask so the caller's response isn't blocked
  setImmediate(() => {
    uploadToR2(localPath, remotePath, contentType).catch(() => {});
  });
}
