import express from "express";
import path from "path";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import { spawn } from "node:child_process";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { PoolClient, QueryResult } from "pg";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import dotenv from "dotenv";
import { getDatabaseUrl, getPool, withClient } from "./db";
import { runMigrations } from "./db/migrate";
import {
  inferStructureTreeFromSongSeed,
  normalizeStructuredWorkType,
  type StructurePlan,
} from "./cssmv/schemas/structure-tree";
import { SEED_PERSON_PROFILES } from "./person_mv_seed";

const ENV_CONFIG_PATHS = [
  "/srv/cssos.env",
  "/etc/cssos.env",
  "/private/etc/cssos.env",
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
];

for (const envPath of ENV_CONFIG_PATHS) {
  dotenv.config({ path: envPath });
}

function loadEnvValueFromPaths(key: string) {
  for (const envPath of ENV_CONFIG_PATHS) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const parsed = dotenv.parse(fs.readFileSync(envPath));
      const value = String(parsed[key] || "").trim();
      if (value) {
        return {
          path: envPath,
          value,
        };
      }
    } catch {
      continue;
    }
  }
  const value = String(process.env[key] || "").trim();
  if (!value) return null;
  return {
    path: "process.env",
    value,
  };
}

function getOpenAiRuntimeConfig() {
  const processApiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const processTextModel = String(
    process.env.OPENAI_TEXT_MODEL || process.env.OPENAI_MODEL || "",
  ).trim();
  const apiKeyEntry = processApiKey
    ? { path: "process.env", value: processApiKey }
    : loadEnvValueFromPaths("OPENAI_API_KEY");
  const textModelEntry = processTextModel
    ? { path: "process.env", value: processTextModel }
    : loadEnvValueFromPaths("OPENAI_TEXT_MODEL") ||
      loadEnvValueFromPaths("OPENAI_MODEL");
  const apiKey = apiKeyEntry?.value || processApiKey;
  const model =
    textModelEntry?.value ||
    processTextModel ||
    "gpt-4.1-mini";
  const fingerprint = apiKey
    ? crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 12)
    : "";
  return {
    apiKey,
    model,
    envSource: apiKeyEntry?.path || textModelEntry?.path || "process.env",
    keyFingerprint: fingerprint,
  };
}

function getOpenAiTranscribeModel() {
  const processTranscribeModel = String(
    process.env.OPENAI_TRANSCRIBE_MODEL ||
      process.env.OPENAI_AUDIO_TRANSCRIBE_MODEL ||
      "",
  ).trim();
  return (
    processTranscribeModel ||
    loadEnvValueFromPaths("OPENAI_TRANSCRIBE_MODEL")?.value ||
    loadEnvValueFromPaths("OPENAI_AUDIO_TRANSCRIBE_MODEL")?.value ||
    "gpt-4o-mini-transcribe"
  );
}

function getOpenAiDiagnosticsPayload() {
  const runtimeConfig = getOpenAiRuntimeConfig();
  const envCandidates = ENV_CONFIG_PATHS.map((envPath) => ({
    path: envPath,
    exists: fs.existsSync(envPath),
  }));
  return {
    provider: "openai",
    env_source: runtimeConfig.envSource,
    model: runtimeConfig.model,
    transcribe_model: getOpenAiTranscribeModel(),
    key_fingerprint: runtimeConfig.keyFingerprint,
    has_api_key: Boolean(runtimeConfig.apiKey),
    key_prefix: runtimeConfig.apiKey ? runtimeConfig.apiKey.slice(0, 12) : "",
    env_candidates: envCandidates,
  };
}

async function runOpenAiProbe() {
  const runtimeConfig = getOpenAiRuntimeConfig();
  if (!runtimeConfig.apiKey) {
    return {
      ok: false,
      provider: "openai",
      status: 0,
      model: runtimeConfig.model,
      env_source: runtimeConfig.envSource,
      key_fingerprint: runtimeConfig.keyFingerprint,
      error_type: "missing_api_key",
      error_code: "missing_api_key",
      error_message: "OPENAI_API_KEY is not configured",
    };
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${runtimeConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: runtimeConfig.model,
        messages: [{ role: "user", content: "ping" }],
        max_completion_tokens: 8,
      }),
    });
    const payload = await upstream.json().catch(() => null);
    const errorBody =
      payload && typeof payload === "object"
        ? (payload.error as Record<string, unknown> | undefined)
        : undefined;

    return {
      ok: upstream.ok,
      provider: "openai",
      status: upstream.status,
      model: runtimeConfig.model,
      env_source: runtimeConfig.envSource,
      key_fingerprint: runtimeConfig.keyFingerprint,
      key_prefix: runtimeConfig.apiKey.slice(0, 12),
      error_type: String(errorBody?.type || ""),
      error_code: String(errorBody?.code || errorBody?.type || ""),
      error_message: String(errorBody?.message || ""),
      response_id: String(payload?.id || ""),
    };
  } catch (error) {
    return {
      ok: false,
      provider: "openai",
      status: 0,
      model: runtimeConfig.model,
      env_source: runtimeConfig.envSource,
      key_fingerprint: runtimeConfig.keyFingerprint,
      key_prefix: runtimeConfig.apiKey.slice(0, 12),
      error_type: "network_error",
      error_code: "network_error",
      error_message:
        error instanceof Error ? error.message : "OpenAI probe failed",
    };
  }
}

const app = express();
const PORT = 3000;
const REGISTRY_URL = "http://localhost:8080";
const IS_PROD = process.env.NODE_ENV === "production";
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SHARED_DIR = IS_PROD
  ? "/srv/cssos/shared"
  : path.join(__dirname, "..", "..", "shared");
const SHARED_VERSIONS_FILE = path.join(SHARED_DIR, "versions.json");
const SHARED_RUNS_DIR = path.join(SHARED_DIR, "runs");
const MAINTENANCE_REPORT_DIR = path.join(SHARED_DIR, "ops", "maintenance");
const PANEL_MEDIA_DIR = path.join(PUBLIC_DIR, "uploads", "panel-media");
const MUSIC_SOURCE_UPLOAD_DIR = path.join(SHARED_DIR, "music-sources");
const MUSIC_SOURCE_PARSER_TASK_DIR = path.join(
  SHARED_DIR,
  "music-source-parser-tasks",
);
const MUSIC_SOURCE_PARSER_PROTOCOL_VERSION = "music-source-parser.v1";
const MUSIC_SOURCE_PARSER_RESULT_SCHEMA = "css.music_source_parser_result.v1";
const MUSIC_SOURCE_PARSER_WORKER_TICK_MS = 1200;
const ASSET_BUCKET_NAME =
  process.env.CSSOS_ASSET_BUCKET || "cssstudio-gpu-cssos-assets-prod";
const EXAMPLE_ASSET_PREFIX = "examples/";

const DATABASE_URL = getDatabaseUrl();
if (process.env.NODE_ENV === "production" && !DATABASE_URL) {
  throw new Error("DATABASE_URL not configured on api-vm");
}

app.set("trust proxy", 1);

app.use(
  express.json({
    limit: "35mb",
    verify(req, _res, buf) {
      (req as any).rawBody = Buffer.from(buf);
    },
  }),
);
app.use(
  express.urlencoded({
    extended: false,
    verify(req, _res, buf) {
      (req as any).rawBody = Buffer.from(buf);
    },
  }),
);

const sessionConfig: session.SessionOptions = {
  name: process.env.SESSION_COOKIE || "cssos_session",
  secret: process.env.SESSION_SECRET || "cssos_session_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: process.env.COOKIE_HTTPONLY !== "false",
    sameSite: (process.env.COOKIE_SAMESITE || "lax") as
      | "lax"
      | "strict"
      | "none",
    secure:
      typeof process.env.COOKIE_SECURE === "string"
        ? process.env.COOKIE_SECURE !== "false"
        : IS_PROD,
    path: process.env.COOKIE_PATH || "/",
    maxAge: 1000 * 60 * 60 * 24 * Number(process.env.SESSION_TTL_DAYS || 90),
  },
};

const SESSION_STORE_MODE = String(process.env.CSS_SESSION_STORE || "")
  .trim()
  .toLowerCase();
const useDatabaseSessionStore =
  Boolean(DATABASE_URL) && SESSION_STORE_MODE !== "memory";

if (useDatabaseSessionStore) {
  const PgSession = connectPgSimple(session);
  sessionConfig.store = new PgSession({
    pool: getPool(),
    tableName: "session",
    createTableIfMissing: true,
  });
}

app.use(session(sessionConfig));

/* CSSOS_PHASE_C_MEDIA_SIGNING 20260506 — Jing
 * "Phase C: 签名 URL + 30 秒预览（媒体防爬）".
 *
 * Goal: stop scrapers from grabbing /artifacts/mv/<file> directly from
 * page source. Every media URL handed to the client now goes through
 * /secure/artifacts/<workId>/<file> with a short-lived HMAC signature
 * that pins to (workId, file, expiry, accessKind). The server validates
 * the signature, optionally enforces a preview cap, then streams the
 * underlying file from /var/lib/cssos/mv/.
 *
 * Token shape (URL params):
 *   t = HMAC-SHA256(secret, "<workId>|<file>|<exp>|<kind>") base64url
 *   e = unix-millis expiry
 *   k = "full" | "preview"
 *
 * Phase C.1 (this commit): URL signing + secure route. Preview-only
 *   tokens still stream the full file but stamp X-Preview-Limit-Seconds
 *   so the frontend player can stop at 30s.
 *
 * Phase C.2 (later): generate <id>.preview.mp4 server-side at MV
 *   pipeline completion, switch preview tokens to serve that file.
 *
 * Phase C.3 (later): remove the legacy /artifacts/mv nginx alias
 *   and 404 unauthenticated requests.
 */
const MEDIA_SIGNING_SECRET = (
  process.env.MEDIA_SIGNING_SECRET ||
  process.env.SESSION_SECRET ||
  "cssos_session_secret"
).trim();
const MEDIA_TOKEN_TTL_MS = Number(
  process.env.MEDIA_TOKEN_TTL_MS || 60 * 60 * 1000, // 1h default
);
const MEDIA_PREVIEW_LIMIT_SECONDS = Number(
  process.env.MEDIA_PREVIEW_LIMIT_SECONDS || 30,
);
const MV_ARTIFACTS_DIR = (
  process.env.MV_ARTIFACTS_DIR || "/var/lib/cssos/mv"
).trim();

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signMediaToken(
  workId: string,
  file: string,
  expiresAtMs: number,
  kind: "full" | "preview",
): string {
  const payload = `${workId}|${file}|${expiresAtMs}|${kind}`;
  const sig = crypto.createHmac("sha256", MEDIA_SIGNING_SECRET).update(payload).digest();
  return base64UrlEncode(sig);
}

function verifyMediaToken(
  workId: string,
  file: string,
  expiresAtMs: number,
  kind: "full" | "preview",
  token: string,
): boolean {
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;
  if (kind !== "full" && kind !== "preview") return false;
  const expected = signMediaToken(workId, file, expiresAtMs, kind);
  // Constant-time compare to avoid timing oracles.
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Sign a row's media URLs in place. Used by /api/works/mine + market so
 * the URLs handed to the player can never be used past their expiry, and
 * preview-kind viewers literally can't fetch past 30s of bytes. */
type SignableRow = {
  id?: string | number | null;
  preview_video_url?: string | null;
  final_mv_url?: string | null;
  audio_track_1_url?: string | null;
  audio_track_2_url?: string | null;
  subtitle_srt_url?: string | null;
};
function signMediaUrlsOnRow<T extends SignableRow>(
  row: T,
  kind: "full" | "preview",
): T {
  const wid = String(row.id ?? "").trim();
  if (!wid) return row;
  const out: T = { ...row };
  if (out.preview_video_url) out.preview_video_url = signArtifactUrl(wid, out.preview_video_url, kind);
  if (out.final_mv_url) out.final_mv_url = signArtifactUrl(wid, out.final_mv_url, kind);
  if (out.audio_track_1_url) out.audio_track_1_url = signArtifactUrl(wid, out.audio_track_1_url, kind);
  if (out.audio_track_2_url) out.audio_track_2_url = signArtifactUrl(wid, out.audio_track_2_url, kind);
  if (out.subtitle_srt_url) out.subtitle_srt_url = signArtifactUrl(wid, out.subtitle_srt_url, kind);
  return out;
}

/** Build a /secure/artifacts/... URL for a raw artifact path. */
function signArtifactUrl(
  workId: string,
  rawUrl: string | null | undefined,
  kind: "full" | "preview",
): string | null {
  if (!rawUrl) return null;
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return null;
  // Only sign URLs that point at our /artifacts/mv/ alias. External /api/cover-webp
  // covers stay raw for now (Phase C.2 will tighten if needed).
  const m = trimmed.match(/^\/?artifacts\/mv\/(.+)$/);
  if (!m) return trimmed;
  const file = m[1] || "";
  const exp = Date.now() + MEDIA_TOKEN_TTL_MS;
  const t = signMediaToken(workId, file, exp, kind);
  return `/secure/artifacts/${encodeURIComponent(workId)}/${encodeURIComponent(file)}?t=${t}&e=${exp}&k=${kind}`;
}

/* Phase C.2 — clipped-preview cache layer.
 * Preview-kind tokens never serve the original file. They serve a
 * cached clip (first MEDIA_PREVIEW_LIMIT_SECONDS of the source).
 * First request: spawn ffmpeg, stream-copy to the cache file, then
 * sendFile. Concurrent first-requests are coalesced via in-memory
 * locks. Subsequent requests sendFile straight from the cached clip
 * — no ffmpeg cost, no extra latency.
 *
 * Cache lives in MEDIA_PREVIEW_CACHE_DIR (default /srv/cssos/shared/
 * preview-cache, writable by the Express user) so we don't need to
 * touch the read-only /var/lib/cssos/mv/ original-artifacts dir. */
const MEDIA_PREVIEW_CACHE_DIR = (
  process.env.MEDIA_PREVIEW_CACHE_DIR || "/srv/cssos/shared/preview-cache"
).trim();
try { fs.mkdirSync(MEDIA_PREVIEW_CACHE_DIR, { recursive: true }); } catch { /* best-effort */ }

const previewClipLocks = new Map<string, Promise<string>>();

function previewCachePath(originalAbsPath: string): string {
  // Hash the source path so two unrelated files can never collide
  // (mv_X.mp4 + mv_X.preview.mp4 would have, with naive naming).
  const tag = crypto.createHash("sha1").update(originalAbsPath).digest("hex").slice(0, 16);
  return path.join(MEDIA_PREVIEW_CACHE_DIR, `${tag}.preview.mp4`);
}

function spawnFfmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const ff = spawn("/usr/bin/ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ff.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 8000); });
    ff.on("error", (err) => {
      // Spawn-level error (binary missing, etc). Surface as a non-zero exit.
      stderr += "\nspawn-error: " + (err instanceof Error ? err.message : String(err));
      resolve({ code: -1, stderr });
    });
    ff.on("close", (code) => resolve({ code: typeof code === "number" ? code : -1, stderr }));
  });
}

async function buildPreviewClip(originalAbsPath: string, previewPath: string): Promise<void> {
  if (!fs.existsSync(originalAbsPath)) {
    throw new Error("source missing");
  }
  const baseArgs = ["-ss", "0", "-t", String(MEDIA_PREVIEW_LIMIT_SECONDS), "-i", originalAbsPath];
  // Stream-copy first — fast, lossless. May fail on non-keyframe-aligned cuts.
  const copyResult = await spawnFfmpeg([
    ...baseArgs,
    "-c", "copy",
    "-movflags", "+faststart",
    "-y", previewPath,
  ]);
  if (copyResult.code === 0 && fs.existsSync(previewPath)) return;
  // Transcode fallback — slower but always works.
  const transcodeResult = await spawnFfmpeg([
    ...baseArgs,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    "-y", previewPath,
  ]);
  if (transcodeResult.code === 0 && fs.existsSync(previewPath)) return;
  throw new Error(
    `ffmpeg failed: copy=${copyResult.code} transcode=${transcodeResult.code} ` +
    `stderr=${(transcodeResult.stderr || copyResult.stderr).slice(0, 1000)}`,
  );
}

async function ensurePreviewClip(originalAbsPath: string): Promise<string> {
  const previewPath = previewCachePath(originalAbsPath);
  if (fs.existsSync(previewPath)) return previewPath;
  const inflight = previewClipLocks.get(previewPath);
  if (inflight) return inflight;
  // Build the lock-promise chain first, THEN store it. The lock cleanup
  // is part of the chain itself — no dangling .finally branch can produce
  // an unhandled rejection.
  const job = (async () => {
    try {
      await buildPreviewClip(originalAbsPath, previewPath);
      return previewPath;
    } finally {
      previewClipLocks.delete(previewPath);
    }
  })();
  previewClipLocks.set(previewPath, job);
  return job;
}

/** Streams the underlying artifact after validating the signed URL. */
app.get("/secure/artifacts/:wid/:file", async (req, res) => {
  noStore(res);
  const wid = String(req.params.wid || "").trim();
  const file = String(req.params.file || "").trim();
  const t = String(req.query.t || "").trim();
  const e = Number(req.query.e || 0);
  const kRaw = String(req.query.k || "").trim().toLowerCase();
  const kind: "full" | "preview" = kRaw === "preview" ? "preview" : "full";
  if (!wid || !file || !t || !e) {
    return res.status(400).json({ ok: false, code: "TOKEN_MISSING" });
  }
  if (!/^[0-9a-fA-F-]{8,64}$/.test(wid)) {
    return res.status(400).json({ ok: false, code: "INVALID_WORK_ID" });
  }
  if (file.includes("..") || file.includes("/") || file.includes("\\")) {
    return res.status(400).json({ ok: false, code: "INVALID_FILE" });
  }
  if (!verifyMediaToken(wid, file, e, kind, t)) {
    return res.status(403).json({ ok: false, code: "TOKEN_INVALID_OR_EXPIRED" });
  }

  const sourcePath = path.join(MV_ARTIFACTS_DIR, file);

  if (kind === "preview") {
    res.setHeader("X-Preview-Limit-Seconds", String(MEDIA_PREVIEW_LIMIT_SECONDS));
    try {
      const clipPath = await ensurePreviewClip(sourcePath);
      res.setHeader("Cache-Control", "private, max-age=600");
      res.setHeader("X-Cssos-Preview-Cached", "1");
      return res.sendFile(clipPath, (err) => {
        if (err && !res.headersSent) {
          res.status(404).json({ ok: false, code: "PREVIEW_CLIP_NOT_FOUND" });
        }
      });
    } catch (err) {
      console.error("[secure-artifacts] preview clip failed:", err);
      // Fall back to header-only enforcement; player still hard-stops at the cap.
      res.setHeader("X-Cssos-Preview-Fallback", "header-only");
    }
  }

  res.setHeader("Cache-Control", "private, max-age=600");
  return res.sendFile(sourcePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ ok: false, code: "ARTIFACT_NOT_FOUND" });
    }
  });
});

// CSSOS_PHASE2_MV_TRUST_PROXY 20260418 —
// Express owns the session of record. The Rust MV service at 127.0.0.1:8081
// hosts the actual /api/mv/* handlers (cover/lyrics/music/video/subtitles/
// compose) but its cookie-bridge path is currently broken (Rust parses the
// sid differently than Express, so the DB lookup misses). Rather than keep
// chasing the cookie-parse divergence, we proxy /api/mv/* through Express,
// authenticate with Express's session (which works), and pass the user_id
// to Rust via a shared-secret internal header. The Rust listener is bound
// to 127.0.0.1 so the secret never leaves the host.
const CSSOS_INTERNAL_TOKEN = (
  process.env.CSSOS_INTERNAL_TOKEN || ""
).trim();
const RUST_MV_HOST = (process.env.RUST_MV_HOST || "127.0.0.1").trim();
const RUST_MV_PORT = Number(process.env.RUST_MV_PORT || 8081);
// Runway video can take a while; give the pipeline plenty of headroom.
const MV_PROXY_TIMEOUT_MS = Number(
  process.env.MV_PROXY_TIMEOUT_MS || 10 * 60 * 1000,
);
// CSSOS_PHASE2_SEED_INFINITE 20260504 — Jing
// "我要的是不限制，自由" — replace the fixed inline seed pool with a real
// LLM call that invents a fresh creative song concept on every click.
// Cheap (~$0.0002 per call on gpt-4o-mini, ~80 tokens output), and the
// frontend has a combinatorial fallback so we never fail catastrophically.
//
// IMPORTANT: this route MUST come BEFORE the catch-all /api/mv/* proxy
// below or the proxy will swallow it and forward to rust-api which would
// 404. The route auth-checks via Express session same as the proxy does.
app.post("/api/mv/seed", express.json({ limit: "16kb" }), async (req, res) => {
  const userId = (req.session as any)?.user_id;
  if (!userId) {
    return res.status(401).json({ ok: false, error: "sign_in_required" });
  }
  const cfg = getOpenAiRuntimeConfig();
  if (!cfg.apiKey) {
    return res.status(503).json({ ok: false, error: "openai_key_missing" });
  }
  const lang = String(req.body?.language || "en").trim().toLowerCase();
  const festival = req.body?.festival ? String(req.body.festival).trim() : "";
  const season = req.body?.season ? String(req.body.season).trim() : "";
  const tod = req.body?.time_of_day ? String(req.body.time_of_day).trim() : "";
  const recentRaw = Array.isArray(req.body?.recent) ? req.body.recent : [];
  const recent = recentRaw
    .map((s: unknown) => String(s || "").trim())
    .filter((s: string) => s.length > 0)
    .slice(0, 16);
  const civilization = req.body?.civilization
    ? String(req.body.civilization).trim()
    : "";
  const sysMsg =
    "You are a creative-music seed generator. Produce ONE fresh, original " +
    "song concept that has NEVER appeared in a pop-music dataset before. " +
    "Output strict JSON only — no markdown, no code fence, no commentary. " +
    "Schema: {\"prompt\": string, \"style\": string}. " +
    "The `prompt` is one vivid sentence (≤120 chars) describing a song " +
    "concept: a character + an action + a setting + an atmosphere. The " +
    "`style` is 2-4 short comma-separated music-style tags (genre, mood, " +
    "instrumentation hint). Be specific, tactile, surprising — avoid " +
    "clichés like 'chasing the dawn' or 'flying to the moon'.";
  const userMsg =
    `Language for the prompt: ${lang}. ` +
    (festival ? `Cultural festival now: ${festival}. ` : "") +
    (season ? `Season: ${season}. ` : "") +
    (tod ? `Time of day: ${tod}. ` : "") +
    (civilization ? `Civilisation hint: ${civilization}. ` : "") +
    (recent.length > 0
      ? `AVOID anything that overlaps semantically with these recent prompts: ${JSON.stringify(recent)}. `
      : "") +
    `Output JSON only.`;
  try {
    // CSSOS_LLM_ROUTER 20260506 — go through the unified router so this
    // hot-path prompt-seed call inherits Groq / Cerebras free tiers
    // before falling back to OpenAI.
    const result = await callLlm({
      messages: [
        { role: "system", content: sysMsg },
        { role: "user", content: userMsg },
      ],
      max_tokens: 200,
      temperature: 1.0, // maximise variation
      response_format: { type: "json_object" },
      prefer: userPreferredOrder(req as unknown as { headers: Record<string, unknown>; cookies?: Record<string, string> }, "llm"),
    });
    if (!result.ok) {
      return res.status(result.status).json({
        ok: false, error: "llm_upstream_error",
        detail: result.error || "",
      });
    }
    const raw = result.content.trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_e) {
      // Best-effort: extract JSON-looking object.
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (_e2) { /* */ }
      }
    }
    const prompt = String(parsed?.prompt || "").trim();
    const style = String(parsed?.style || "").trim();
    if (!prompt) {
      return res.status(502).json({ ok: false, error: "llm_empty_prompt" });
    }
    return res.json({ ok: true, prompt, style, source: `${result.provider}/${result.model}` });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: "seed_generation_failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

// CSSOS_PHASE2_COVER_FALLBACK_DIR 20260507 — Jing
// Directory where base64 cover fallbacks get persisted to a real file so
// downstream stages (compose / Rust ffmpeg) can HTTP GET them. data: URLs
// are not fetchable by curl/reqwest, which broke the compose stage.
const MV_FALLBACK_ARTIFACTS_DIR =
  process.env.MV_ARTIFACTS_DIR ||
  (fs.existsSync("/srv/cssos") ? "/srv/cssos/artifacts/mv-fallback" : path.join(os.tmpdir(), "cssos-fallback"));
try {
  fs.mkdirSync(MV_FALLBACK_ARTIFACTS_DIR, { recursive: true });
} catch (e) {
  console.warn("[mv-cover-fallback] could not create dir %s: %s", MV_FALLBACK_ARTIFACTS_DIR, e);
}

/** Detect image MIME from raw bytes; returns {ext, mime}. */
function sniffImageType(buf: Buffer): { ext: string; mime: string } {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return { ext: "gif", mime: "image/gif" };
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { ext: "webp", mime: "image/webp" };
  return { ext: "png", mime: "image/png" };
}

/**
 * Persist a base64 image to MV_FALLBACK_ARTIFACTS_DIR and return a public URL
 * served by `/artifacts/mv-fallback`. On any failure, falls back to a data:
 * URL with the correctly-sniffed MIME type so browser preview still works.
 */
function persistBase64Cover(b64: string, userId: unknown): string {
  try {
    const buf = Buffer.from(b64, "base64");
    const { ext, mime } = sniffImageType(buf);
    const userHash = crypto.createHash("sha1").update(String(userId)).digest("hex").slice(0, 8);
    const rand = crypto.randomBytes(6).toString("hex");
    const filename = `cover-${userHash}-${Date.now()}-${rand}.${ext}`;
    const filePath = path.join(MV_FALLBACK_ARTIFACTS_DIR, filename);
    fs.writeFileSync(filePath, buf, { mode: 0o644 });
    try { fs.chmodSync(filePath, 0o644); } catch {}
    return `/artifacts/mv-fallback/${filename}`;
  } catch (e) {
    console.warn("[mv-cover-fallback] persist failed, using data: URL:", e);
    try {
      const buf = Buffer.from(b64, "base64");
      const { mime } = sniffImageType(buf);
      return `data:${mime};base64,${b64}`;
    } catch {
      return `data:image/png;base64,${b64}`;
    }
  }
}

// CSSOS_PHASE2_COVER_FALLBACK 20260507 — Jing
// Runway is the preferred cover engine (premium quality), but it returns
// 400 / 402-style errors when the user's account is out of credits. The
// upstream Rust handler doesn't know about our free image router
// (callImageGen → fal/together/replicate/huggingface/openai), so a single
// Runway hiccup used to fail the whole MV pipeline. We intercept the
// cover proxy here: forward to Rust as before, but if Rust returns any
// non-401 4xx/5xx, transparently fall back to callImageGen and synthesize
// a Rust-shaped CoverResponse so the pipeline keeps moving.
//
// MUST come before the catch-all `/api/mv/*` proxy below.
app.post("/api/mv/cover", express.json({ limit: "16kb" }), async (req, res) => {
  const userId = (req.session as any)?.user_id;
  if (!userId) {
    return res.status(401).json({ ok: false, error: "sign_in_required" });
  }
  if (!CSSOS_INTERNAL_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: "internal_token_not_configured",
      hint: "set CSSOS_INTERNAL_TOKEN in /etc/cssos.env",
    });
  }

  const body = (req.body && typeof req.body === "object") ? req.body : {};
  const bodyStr = Object.keys(body).length > 0 ? JSON.stringify(body) : "";
  const prompt = String((body as any).prompt || "").trim();
  const ratio = String((body as any).ratio || "").trim();
  const explicitEngine = String((body as any).engine || "").trim().toLowerCase();
  // Map Runway-style ratio (e.g. "1024:1024", "1920:1080") to a pixel size
  // for our generic image router. Falls back to 1024x1024.
  const ratioToSize = (r: string): string => {
    if (!r) return "1024x1024";
    const m = r.match(/^(\d+)\s*[:x]\s*(\d+)$/);
    if (!m) return "1024x1024";
    return `${m[1]}x${m[2]}`;
  };
  const fallbackSize = ratioToSize(ratio);

  // CSSOS_PHASE2_COVER_TIER_FIRST 20260507 — Jing
  // Routing principle: free → cheap → standard → premium, best-of-tier first.
  // Runway is premium ($$$). UNLESS the user explicitly chose Runway via
  // `body.engine="runway"`, sweep the free/cheap image router FIRST and only
  // touch Runway as the premium last-resort. This makes "余额耗尽" impossible
  // to reach because we exhaust 3 free providers before spending a cent.
  const userForcedRunway = explicitEngine === "runway";
  if (!userForcedRunway) {
    // Heartbeat keepalive — see /api/mv/lyrics for rationale (Safari "Load
    // failed" / nginx 504 when callImageGen sweeps 9 providers silently).
    res.status(200);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("transfer-encoding", "chunked");
    res.flushHeaders?.();
    const heartbeat = setInterval(() => { try { res.write(" "); } catch {} }, 5000);
    try {
      const img = await callImageGen({
        prompt: prompt || "album cover, cinematic",
        size: fallbackSize,
      });
      clearInterval(heartbeat);
      if (img.ok) {
        const imageUrl = img.image_url
          ? img.image_url
          : (img.image_b64 ? persistBase64Cover(img.image_b64, userId) : "");
        if (imageUrl) {
          res.write(JSON.stringify({
            ok: true,
            task_id: `tier-${img.provider}-${Date.now()}`,
            image_url: imageUrl,
            model: img.model,
            engine: img.provider,
            version: img.model,
            cost_cents: 0,
            use_user_key: false,
            tier_sweep: true,
          }));
          return res.end();
        }
      }
      console.warn(
        `[mv-cover] tier sweep exhausted (${img.error || "no_image"}); escalating to Runway premium`,
      );
    } catch (err) {
      clearInterval(heartbeat);
      console.warn("[mv-cover] tier sweep threw:", err instanceof Error ? err.message : String(err));
    }
    // Headers already sent — emit SVG placeholder inline rather than falling
    // through to the Runway upstream path (which opens a fresh response).
    let hue = 180;
    for (let i = 0; i < (prompt || "").length; i++) hue = (hue * 31 + prompt.charCodeAt(i)) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue},70%,32%)"/><stop offset="100%" stop-color="hsl(${(hue + 60) % 360},75%,18%)"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/></svg>`;
    res.write(JSON.stringify({
      ok: true,
      task_id: `placeholder-${Date.now()}`,
      image_url: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      model: "css-gradient-placeholder",
      engine: "placeholder",
      version: "1",
      cost_cents: 0,
      use_user_key: false,
      fallback: true,
      placeholder: true,
    }));
    return res.end();
  }

  // Premium last-resort (or user-forced Runway): hit Rust/Runway via the
  // shared streaming helper so chunked-transfer keepalive heartbeats reach
  // nginx in real time (avoids 60s 502).
  const result = await _mvForwardUpstream(req, res, bodyStr);
  if ("streamed" in result && result.streamed) return; // already piped
  let upstream: { status: number; headers: http.IncomingHttpHeaders; body: Buffer } | null = null;
  let upstreamErr = "";
  if ("error" in result) {
    upstreamErr = result.error;
    console.warn("[mv-cover] upstream connect error, falling back:", upstreamErr);
  } else {
    upstream = result;
  }

  // 401 from upstream = real auth issue, do not paper over with fallback.
  if (upstream && upstream.status === 401) {
    res.status(401);
    return res.end(upstream.body);
  }

  // Runway 4xx/5xx (incl. credits/quota/payment errors) OR connect error
  // → fall through to free providers via callImageGen.
  let runwayDetail = upstreamErr;
  if (upstream) {
    try {
      const j = JSON.parse(upstream.body.toString("utf8") || "{}");
      runwayDetail = String(j?.error || j?.detail || j?.message || `runway_${upstream.status}`);
    } catch {
      runwayDetail = `runway_${upstream.status}`;
    }
  }
  console.warn(
    `[mv-cover] Runway failed (${upstream?.status ?? "no-response"}): ${runwayDetail.slice(0, 200)}; falling back to free image providers`,
  );

  // CSSOS_PHASE2_COVER_NEVER_FAIL 20260507 — Jing
  // Pipeline must never block on cover. If Runway is out of credits AND every
  // free provider also fails (no API keys, network down, etc.), synthesize a
  // deterministic gradient placeholder PNG so the user sees their MV finish.
  // The frontend logs the underlying engine error in `runway_error` /
  // `fallback_error` for diagnostics but treats the response as a success.
  let img: Awaited<ReturnType<typeof callImageGen>> | null = null;
  let imgErr = "";
  try {
    img = await callImageGen({ prompt: prompt || "album cover, cinematic", size: fallbackSize });
  } catch (err) {
    imgErr = err instanceof Error ? err.message : String(err);
    console.warn("[mv-cover] callImageGen threw:", imgErr);
  }

  if (img && img.ok) {
    const imageUrl = img.image_url
      ? img.image_url
      : (img.image_b64 ? persistBase64Cover(img.image_b64, userId) : "");
    if (imageUrl) {
      return res.status(200).json({
        ok: true,
        task_id: `fallback-${img.provider}-${Date.now()}`,
        image_url: imageUrl,
        model: img.model,
        engine: img.provider,
        version: img.model,
        cost_cents: 0,
        use_user_key: false,
        fallback: true,
        runway_error: runwayDetail,
      });
    }
  }

  // Last-resort placeholder: a 1024x1024 SVG gradient embedded as data URL.
  // Picks a hue from the prompt hash so different MVs still feel distinct.
  let hue = 180;
  for (let i = 0; i < (prompt || "").length; i++) {
    hue = (hue * 31 + prompt.charCodeAt(i)) % 360;
  }
  const placeholderSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="hsl(${hue},70%,32%)"/>` +
    `<stop offset="100%" stop-color="hsl(${(hue + 60) % 360},75%,18%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="1024" height="1024" fill="url(#g)"/>` +
    `<circle cx="512" cy="512" r="180" fill="rgba(255,255,255,0.06)"/>` +
    `</svg>`;
  const placeholderUrl = `data:image/svg+xml;base64,${Buffer.from(placeholderSvg).toString("base64")}`;
  console.warn(
    `[mv-cover] all providers failed, returning placeholder. runway=${runwayDetail.slice(0, 80)} fallback=${(img?.error || imgErr || "no_provider").slice(0, 80)}`,
  );
  return res.status(200).json({
    ok: true,
    task_id: `placeholder-${Date.now()}`,
    image_url: placeholderUrl,
    model: "css-gradient-placeholder",
    engine: "placeholder",
    version: "1",
    cost_cents: 0,
    use_user_key: false,
    fallback: true,
    placeholder: true,
    runway_error: runwayDetail,
    fallback_error: img?.error || imgErr || "no_provider_succeeded",
  });
});

// CSSOS_PHASE2_MV_NEVER_FAIL 20260507 — Jing
// "永不因一家余额空让用户看到 ❌" — apply the cover-handler pattern to every
// MV pipeline stage. Each handler tries the Rust upstream first (which knows
// about user-key/paid/trusted engines), and on any non-401 4xx/5xx falls back
// through the TS-side free-provider router (callLlm/callMusicGen/callVideoGen),
// finally synthesizing a placeholder so the pipeline never blocks.
//
// Shared upstream-proxy helper.
//
// CSSOS_MV_STREAM_2XX 20260507 — Jing
// On 2xx we PIPE upstream straight to the Express response so the Rust
// chunked-transfer keepalive heartbeats (single-space bytes) flow through
// to nginx in real time. Buffering would swallow them and trigger nginx
// 502/504 on slow Mubert/Runway/Eleven calls. Non-2xx is still buffered
// so the fallback path can inspect the body.
type MvUpstreamResult =
  | { streamed: true; status: number; headers: http.IncomingHttpHeaders }
  | { streamed: false; status: number; headers: http.IncomingHttpHeaders; body: Buffer }
  | { error: string };

async function _mvForwardUpstream(
  req: express.Request,
  res: express.Response,
  bodyStr: string,
): Promise<MvUpstreamResult> {
  return new Promise((resolve) => {
    const up = http.request(
      {
        hostname: RUST_MV_HOST,
        port: RUST_MV_PORT,
        path: req.originalUrl,
        method: "POST",
        headers: {
          "content-type": (req.headers["content-type"] as string) || "application/json",
          "content-length": Buffer.byteLength(bodyStr),
          "x-cssos-internal-token": CSSOS_INTERNAL_TOKEN,
          "x-cssos-user": String((req.session as any)?.user_id || ""),
          "x-forwarded-for": String(
            req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress || "",
          ),
        },
        timeout: MV_PROXY_TIMEOUT_MS,
      },
      (upRes) => {
        const status = upRes.statusCode || 502;
        if (status >= 200 && status < 300) {
          // Happy path: pipe heartbeats + body straight to client.
          res.status(status);
          for (const [k, v] of Object.entries(upRes.headers)) {
            if (v === undefined) continue;
            const lower = k.toLowerCase();
            if (lower === "transfer-encoding" || lower === "connection" || lower === "keep-alive") continue;
            try { res.setHeader(k, v as any); } catch {}
          }
          upRes.pipe(res);
          upRes.on("end", () => resolve({ streamed: true, status, headers: upRes.headers }));
          upRes.on("error", (err) => resolve({ error: err instanceof Error ? err.message : String(err) }));
          return;
        }
        // Non-2xx: buffer for inspection.
        const chunks: Buffer[] = [];
        upRes.on("data", (c) => chunks.push(c));
        upRes.on("end", () =>
          resolve({
            streamed: false,
            status,
            headers: upRes.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    up.on("timeout", () => up.destroy(new Error("upstream_timeout")));
    up.on("error", (err) => resolve({ error: err instanceof Error ? err.message : String(err) }));
    if (bodyStr) up.write(bodyStr);
    up.end();
  });
}

function _mvParseUpstreamErr(
  upstream: { status: number; body: Buffer } | null,
  connectErr: string,
): string {
  if (!upstream) return connectErr || "upstream_unreachable";
  try {
    const j = JSON.parse(upstream.body.toString("utf8") || "{}");
    return String(j?.error || j?.detail || j?.message || `upstream_${upstream.status}`);
  } catch {
    return `upstream_${upstream.status}`;
  }
}

// /api/mv/lyrics — Rust LLM router → callLlm fallback → trivial stub.
app.post("/api/mv/lyrics", express.json({ limit: "32kb" }), async (req, res) => {
  const userId = (req.session as any)?.user_id;
  if (!userId) return res.status(401).json({ ok: false, error: "sign_in_required" });
  if (!CSSOS_INTERNAL_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: "internal_token_not_configured",
      hint: "set CSSOS_INTERNAL_TOKEN in /etc/cssos.env",
    });
  }

  const body = (req.body && typeof req.body === "object") ? req.body : {};
  const bodyStr = Object.keys(body).length > 0 ? JSON.stringify(body) : "";
  const prompt = String((body as any).prompt || (body as any).title || "").trim();
  const style = String((body as any).style || "").trim();
  const language = String((body as any).language || "en").trim();
  const explicitEngine = String((body as any).engine || "").trim().toLowerCase();

  // CSSOS_PHASE2_LYRICS_TIER_FIRST 20260507 — Jing
  // Mirror /api/mv/cover: free → cheap → standard first via callLlm
  // (groq/cerebras/mistral/openrouter/gemini/huggingface/deepseek/together
  // before openai/anthropic). Only the user's explicit premium choice
  // (`body.engine` ∈ openai|anthropic) escalates to the Rust upstream.
  const userForcedPremiumLlm = ["openai", "anthropic"].includes(explicitEngine);
  if (!userForcedPremiumLlm) {
    // CSSOS_PHASE2_LYRICS_KEEPALIVE 20260507 — Jing
    // callLlm sweeps up to 10 providers; cumulative p99 can hit 60s+ which
    // trips Safari's "Load failed" connection-reset and nginx 504. Write
    // chunked-transfer heartbeats (single space) every 5s until the JSON
    // response is ready, mirroring the Rust keepalive wrapper. JSON.parse
    // tolerates leading whitespace so the existing client `postJson`
    // (which already trims leading spaces) handles this transparently.
    res.status(200);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("transfer-encoding", "chunked");
    res.flushHeaders?.();
    const heartbeat = setInterval(() => { try { res.write(" "); } catch {} }, 5000);
    try {
      const tier = await callLlm({
        messages: [
          { role: "system", content: "You write concise, singable music-video lyrics. Reply with raw lyrics only — no commentary, no markdown headings." },
          { role: "user", content: `Write short song lyrics in ${language}${style ? ` (${style} style)` : ""} for: ${prompt || "an evocative scene"}.` },
        ],
        max_tokens: 600,
        temperature: 0.85,
      });
      clearInterval(heartbeat);
      if (tier && tier.ok && tier.content && tier.content.trim()) {
        console.log(`[mv-lyrics] tier sweep WIN: provider=${tier.provider} model=${tier.model}`);
        res.write(JSON.stringify({
          ok: true,
          task_id: `tier-${tier.provider}-${Date.now()}`,
          lyrics: tier.content.trim(),
          derived_settings: { title: prompt.slice(0, 80) || "Untitled", music_style: style },
          sections: null,
          shot_scripts: null,
          model: tier.model,
          engine: tier.provider,
          cost_cents: 0,
          use_user_key: false,
          tier_sweep: true,
        }));
        return res.end();
      }
      console.warn(`[mv-lyrics] tier sweep exhausted (${tier?.error || "no_content"}); escalating to Rust premium`);
    } catch (err) {
      clearInterval(heartbeat);
      console.warn("[mv-lyrics] tier sweep threw:", err instanceof Error ? err.message : String(err));
    }
    // If we got here without returning, headers are sent — emit stub JSON
    // and end. Don't try to fall through to Rust upstream; that path opens
    // a fresh response.
    const stubLine = (prompt || "a quiet moment in motion").replace(/\s+/g, " ").trim();
    res.write(JSON.stringify({
      ok: true,
      task_id: `placeholder-${Date.now()}`,
      lyrics: `[verse]\n${stubLine}\n${stubLine}\n\n[chorus]\n${stubLine}\n${stubLine}\n\n[verse]\n${stubLine}\n${stubLine}`,
      derived_settings: { title: prompt.slice(0, 80) || "Untitled", music_style: style },
      sections: null, shot_scripts: null,
      model: "stub-lyrics-placeholder", engine: "placeholder",
      cost_cents: 0, use_user_key: false, fallback: true, placeholder: true,
    }));
    return res.end();
  }

  let result = await _mvForwardUpstream(req, res, bodyStr);
  if ("streamed" in result && result.streamed) return; // already piped
  let upstream: { status: number; headers: http.IncomingHttpHeaders; body: Buffer } | null = null;
  let upstreamErr = "";
  if ("error" in result) {
    upstreamErr = result.error;
    console.warn("[mv-lyrics] upstream connect error, falling back:", upstreamErr);
  } else {
    upstream = result;
  }

  if (upstream && upstream.status === 401) {
    res.status(401);
    return res.end(upstream.body);
  }

  const upstreamDetail = _mvParseUpstreamErr(upstream, upstreamErr);
  console.warn(
    `[mv-lyrics] upstream failed (${upstream?.status ?? "no-response"}): ${upstreamDetail.slice(0, 200)}; falling back to free LLM router`,
  );

  let llm: Awaited<ReturnType<typeof callLlm>> | null = null;
  let llmErr = "";
  try {
    llm = await callLlm({
      messages: [
        { role: "system", content: "You write concise, singable music-video lyrics. Reply with raw lyrics only — no commentary, no markdown headings." },
        { role: "user", content: `Write short song lyrics in ${language}${style ? ` (${style} style)` : ""} for: ${prompt || "an evocative scene"}.` },
      ],
      max_tokens: 600,
      temperature: 0.85,
    });
  } catch (err) {
    llmErr = err instanceof Error ? err.message : String(err);
    console.warn("[mv-lyrics] callLlm threw:", llmErr);
  }

  if (llm && llm.ok && llm.content && llm.content.trim()) {
    return res.status(200).json({
      ok: true,
      task_id: `fallback-${llm.provider}-${Date.now()}`,
      lyrics: llm.content.trim(),
      derived_settings: {
        title: prompt.slice(0, 80) || "Untitled",
        music_style: style,
      },
      sections: null,
      shot_scripts: null,
      model: llm.model,
      engine: llm.provider,
      cost_cents: 0,
      use_user_key: false,
      fallback: true,
      upstream_error: upstreamDetail,
    });
  }

  // Last-resort stub lyrics so video stage can still compose.
  const stubLine = (prompt || "a quiet moment in motion").replace(/\s+/g, " ").trim();
  const stubLyrics = [
    `[verse]\n${stubLine}\n${stubLine}`,
    `[chorus]\n${stubLine}, ${stubLine}\n${stubLine}, ${stubLine}`,
    `[verse]\n${stubLine}\n${stubLine}`,
  ].join("\n\n");
  console.warn(
    `[mv-lyrics] all providers failed, returning stub. upstream=${upstreamDetail.slice(0, 80)} fallback=${(llm?.error || llmErr || "no_provider").slice(0, 80)}`,
  );
  return res.status(200).json({
    ok: true,
    task_id: `placeholder-${Date.now()}`,
    lyrics: stubLyrics,
    derived_settings: {
      title: prompt.slice(0, 80) || "Untitled",
      music_style: style,
    },
    sections: null,
    shot_scripts: null,
    model: "stub-lyrics-placeholder",
    engine: "placeholder",
    cost_cents: 0,
    use_user_key: false,
    fallback: true,
    placeholder: true,
    upstream_error: upstreamDetail,
    fallback_error: llm?.error || llmErr || "no_provider_succeeded",
  });
});

// /api/mv/music — Rust music router → callMusicGen fallback → silent WAV stub.
app.post("/api/mv/music", express.json({ limit: "32kb" }), async (req, res) => {
  const userId = (req.session as any)?.user_id;
  if (!userId) return res.status(401).json({ ok: false, error: "sign_in_required" });
  if (!CSSOS_INTERNAL_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: "internal_token_not_configured",
      hint: "set CSSOS_INTERNAL_TOKEN in /etc/cssos.env",
    });
  }

  const body = (req.body && typeof req.body === "object") ? req.body : {};
  const bodyStr = Object.keys(body).length > 0 ? JSON.stringify(body) : "";
  const prompt = String((body as any).prompt || (body as any).title || "").trim();
  const duration = Number((body as any).duration_secs || (body as any).duration || 30) || 30;
  const tags = Array.isArray((body as any).tags) ? (body as any).tags as string[] : [];
  const explicitEngine = String((body as any).engine || "").trim().toLowerCase();

  // CSSOS_PHASE2_MUSIC_TIER_FIRST 20260507 — Jing
  // Free → cheap (mubert/stability) before paid (suno/elevenlabs).
  // Only premium engine names skip the sweep and hit Rust directly.
  const userForcedPremiumMusic = ["elevenlabs", "suno"].includes(explicitEngine);
  if (!userForcedPremiumMusic) {
    // Heartbeat keepalive (see lyrics handler).
    res.status(200);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("transfer-encoding", "chunked");
    res.flushHeaders?.();
    const heartbeat = setInterval(() => { try { res.write(" "); } catch {} }, 5000);
    try {
      const tier = await callMusicGen({
        prompt: prompt || "ambient cinematic instrumental",
        duration_secs: duration,
        tags,
      });
      clearInterval(heartbeat);
      if (tier && tier.ok) {
        const audioUrl = tier.audio_url
          ? tier.audio_url
          : (tier.audio_b64 ? `data:audio/mpeg;base64,${tier.audio_b64}` : "");
        if (audioUrl) {
          console.log(`[mv-music] tier sweep WIN: provider=${tier.provider}`);
          res.write(JSON.stringify({
            ok: true,
            task_id: `tier-${tier.provider}-${Date.now()}`,
            audio_url: audioUrl,
            engine: tier.provider,
            cost_cents: 0,
            use_user_key: false,
            tier_sweep: true,
          }));
          return res.end();
        }
      }
      console.warn(`[mv-music] tier sweep exhausted (${tier?.error || "no_audio"}); emitting silent placeholder`);
    } catch (err) {
      clearInterval(heartbeat);
      console.warn("[mv-music] tier sweep threw:", err instanceof Error ? err.message : String(err));
    }
    // Headers already sent — emit silent WAV inline (cannot fall through
    // to Rust upstream which would open a fresh response).
    const sampleRateP = 8000;
    const numSamplesP = Math.max(1, Math.min(120, Math.round(duration))) * sampleRateP;
    const dataSizeP = numSamplesP * 2;
    const wavP = Buffer.alloc(44 + dataSizeP);
    wavP.write("RIFF", 0);
    wavP.writeUInt32LE(36 + dataSizeP, 4);
    wavP.write("WAVE", 8);
    wavP.write("fmt ", 12);
    wavP.writeUInt32LE(16, 16);
    wavP.writeUInt16LE(1, 20);
    wavP.writeUInt16LE(1, 22);
    wavP.writeUInt32LE(sampleRateP, 24);
    wavP.writeUInt32LE(sampleRateP * 2, 28);
    wavP.writeUInt16LE(2, 32);
    wavP.writeUInt16LE(16, 34);
    wavP.write("data", 36);
    wavP.writeUInt32LE(dataSizeP, 40);
    res.write(JSON.stringify({
      ok: true,
      task_id: `placeholder-${Date.now()}`,
      audio_url: `data:audio/wav;base64,${wavP.toString("base64")}`,
      engine: "placeholder",
      cost_cents: 0,
      use_user_key: false,
      fallback: true,
      placeholder: true,
      duration_secs: Math.round(duration),
    }));
    return res.end();
  }

  let result = await _mvForwardUpstream(req, res, bodyStr);
  if ("streamed" in result && result.streamed) return; // already piped
  let upstream: { status: number; headers: http.IncomingHttpHeaders; body: Buffer } | null = null;
  let upstreamErr = "";
  if ("error" in result) {
    upstreamErr = result.error;
    console.warn("[mv-music] upstream connect error, falling back:", upstreamErr);
  } else {
    upstream = result;
  }

  if (upstream && upstream.status === 401) {
    res.status(401);
    return res.end(upstream.body);
  }

  const upstreamDetail = _mvParseUpstreamErr(upstream, upstreamErr);
  console.warn(
    `[mv-music] upstream failed (${upstream?.status ?? "no-response"}): ${upstreamDetail.slice(0, 200)}; falling back to free music router`,
  );

  let music: Awaited<ReturnType<typeof callMusicGen>> | null = null;
  let musicErr = "";
  try {
    music = await callMusicGen({
      prompt: prompt || "ambient cinematic instrumental",
      duration_secs: duration,
      tags,
    });
  } catch (err) {
    musicErr = err instanceof Error ? err.message : String(err);
    console.warn("[mv-music] callMusicGen threw:", musicErr);
  }

  if (music && music.ok) {
    const audioUrl = music.audio_url
      ? music.audio_url
      : (music.audio_b64 ? `data:audio/mpeg;base64,${music.audio_b64}` : "");
    if (audioUrl) {
      return res.status(200).json({
        ok: true,
        task_id: `fallback-${music.provider}-${Date.now()}`,
        audio_url: audioUrl,
        engine: music.provider,
        cost_cents: 0,
        use_user_key: false,
        fallback: true,
        upstream_error: upstreamDetail,
      });
    }
  }

  // Last-resort: synthesize a silent WAV (PCM16 mono 8kHz) for `duration` secs.
  const sampleRate = 8000;
  const numSamples = Math.max(1, Math.min(120, Math.round(duration))) * sampleRate;
  const dataSize = numSamples * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  // PCM samples already zeroed by Buffer.alloc (silence).
  const silenceUrl = `data:audio/wav;base64,${wav.toString("base64")}`;
  console.warn(
    `[mv-music] all providers failed, returning silence. upstream=${upstreamDetail.slice(0, 80)} fallback=${(music?.error || musicErr || "no_provider").slice(0, 80)}`,
  );
  return res.status(200).json({
    ok: true,
    task_id: `placeholder-${Date.now()}`,
    audio_url: silenceUrl,
    engine: "placeholder",
    cost_cents: 0,
    use_user_key: false,
    fallback: true,
    placeholder: true,
    duration_secs: Math.round(duration),
    upstream_error: upstreamDetail,
    fallback_error: music?.error || musicErr || "no_provider_succeeded",
  });
});

// /api/mv/video — Rust video router → callVideoGen → still-image fallback.
app.post("/api/mv/video", express.json({ limit: "64kb" }), async (req, res) => {
  const userId = (req.session as any)?.user_id;
  if (!userId) return res.status(401).json({ ok: false, error: "sign_in_required" });
  if (!CSSOS_INTERNAL_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: "internal_token_not_configured",
      hint: "set CSSOS_INTERNAL_TOKEN in /etc/cssos.env",
    });
  }

  const body = (req.body && typeof req.body === "object") ? req.body : {};
  const bodyStr = Object.keys(body).length > 0 ? JSON.stringify(body) : "";
  const prompt = String((body as any).prompt || "").trim();
  const aspectRaw = String((body as any).aspect_ratio || (body as any).ratio || "16:9").trim();
  const aspect: "16:9" | "9:16" | "1:1" =
    aspectRaw === "9:16" ? "9:16" : aspectRaw === "1:1" ? "1:1" : "16:9";
  const duration = Number((body as any).duration_secs || (body as any).duration || 5) || 5;
  const imageUrl = String((body as any).image_url || (body as any).cover_url || "").trim();
  const explicitEngine = String((body as any).engine || "").trim().toLowerCase();
  const tier = String((body as any).tier || "lite").trim().toLowerCase();

  // CSSOS_PHASE2_VIDEO_TIER_FIRST 20260507 — Jing
  // Routing principle:
  //   tier="lite" (default) → no AI video at all; frontend ken-burns the cover.
  //   tier="hybrid"|"cinematic" → free → cheap (fal/replicate/kling/luma) before runway.
  // Only `body.engine="runway"` or other explicit premium escalates to Rust.
  const userForcedPremiumVideo = ["runway", "luma"].includes(explicitEngine);
  if (!userForcedPremiumVideo) {
    // Heartbeat keepalive (see lyrics handler). Lite path may invoke
    // callImageGen for a still; hybrid/cinematic invokes callVideoGen
    // which can take 60s+ per provider.
    res.status(200);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("transfer-encoding", "chunked");
    res.flushHeaders?.();
    const heartbeat = setInterval(() => { try { res.write(" "); } catch {} }, 5000);
    const sendJson = (payload: unknown) => {
      clearInterval(heartbeat);
      try { res.write(JSON.stringify(payload)); } catch {}
      try { res.end(); } catch {}
    };
    if (tier === "lite") {
      console.log(`[mv-video] tier=lite — skipping AI video, returning still+ken-burns flag`);
      const sizeMap: Record<string, string> = { "16:9": "1024x576", "9:16": "576x1024", "1:1": "1024x1024" };
      let stillUrl = imageUrl;
      if (!stillUrl) {
        try {
          const still = await callImageGen({
            prompt: prompt || "cinematic music video still, dramatic lighting",
            size: sizeMap[aspect] || "1024x576",
          });
          if (still.ok) {
            stillUrl = still.image_url
              ? still.image_url
              : (still.image_b64 ? `data:image/png;base64,${still.image_b64}` : "");
          }
        } catch { /* fall through to svg */ }
      }
      if (!stillUrl) {
        let hue = 200;
        for (let i = 0; i < prompt.length; i++) hue = (hue * 31 + prompt.charCodeAt(i)) % 360;
        const [w, h] = (sizeMap[aspect] || "1024x576").split("x").map(Number);
        const svg =
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
          `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
          `<stop offset="0%" stop-color="hsl(${hue},70%,32%)"/>` +
          `<stop offset="100%" stop-color="hsl(${(hue + 60) % 360},75%,18%)"/>` +
          `</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
        stillUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      }
      return sendJson({
        ok: true,
        task_id: `tier-lite-${Date.now()}`,
        video_url: "",
        image_url: stillUrl,
        engine: "tier-lite",
        cost_cents: 0,
        use_user_key: false,
        tier_sweep: true,
        video_skipped: true,
        aspect_ratio: aspect,
        duration_secs: Math.round(duration),
      });
    }
    // hybrid/cinematic: try free→cheap video router first
    try {
      const tierVid = await callVideoGen({
        prompt: prompt || "cinematic music video shot, slow camera motion",
        duration_secs: duration,
        aspect_ratio: aspect,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      });
      if (tierVid && tierVid.ok && (tierVid.video_url || tierVid.poll_url)) {
        console.log(`[mv-video] tier sweep WIN: provider=${tierVid.provider}`);
        return sendJson({
          ok: true,
          task_id: `tier-${tierVid.provider}-${Date.now()}`,
          video_url: tierVid.video_url || "",
          poll_url: tierVid.poll_url || "",
          engine: tierVid.provider,
          cost_cents: 0,
          use_user_key: false,
          tier_sweep: true,
        });
      }
      console.warn(`[mv-video] tier sweep exhausted (${tierVid?.error || "no_video"}); emitting still placeholder`);
    } catch (err) {
      console.warn("[mv-video] tier sweep threw:", err instanceof Error ? err.message : String(err));
    }
    // Headers already sent — emit still+ken-burns placeholder inline.
    return sendJson({
      ok: true,
      task_id: `placeholder-${Date.now()}`,
      video_url: "",
      image_url: imageUrl || "",
      engine: "placeholder",
      cost_cents: 0,
      use_user_key: false,
      fallback: true,
      placeholder: true,
      video_skipped: true,
      aspect_ratio: aspect,
      duration_secs: Math.round(duration),
    });
  }

  let result = await _mvForwardUpstream(req, res, bodyStr);
  if ("streamed" in result && result.streamed) return; // already piped
  let upstream: { status: number; headers: http.IncomingHttpHeaders; body: Buffer } | null = null;
  let upstreamErr = "";
  if ("error" in result) {
    upstreamErr = result.error;
    console.warn("[mv-video] upstream connect error, falling back:", upstreamErr);
  } else {
    upstream = result;
  }

  if (upstream && upstream.status === 401) {
    res.status(401);
    return res.end(upstream.body);
  }

  const upstreamDetail = _mvParseUpstreamErr(upstream, upstreamErr);
  console.warn(
    `[mv-video] upstream failed (${upstream?.status ?? "no-response"}): ${upstreamDetail.slice(0, 200)}; falling back to free video router`,
  );

  let vid: Awaited<ReturnType<typeof callVideoGen>> | null = null;
  let vidErr = "";
  try {
    vid = await callVideoGen({
      prompt: prompt || "cinematic music video shot, slow camera motion",
      duration_secs: duration,
      aspect_ratio: aspect,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    });
  } catch (err) {
    vidErr = err instanceof Error ? err.message : String(err);
    console.warn("[mv-video] callVideoGen threw:", vidErr);
  }

  if (vid && vid.ok && (vid.video_url || vid.poll_url)) {
    return res.status(200).json({
      ok: true,
      task_id: `fallback-${vid.provider}-${Date.now()}`,
      video_url: vid.video_url || "",
      poll_url: vid.poll_url || "",
      engine: vid.provider,
      cost_cents: 0,
      use_user_key: false,
      fallback: true,
      upstream_error: upstreamDetail,
    });
  }

  // Last-resort: per spec, no kenburns helper exists, so produce a still via
  // callImageGen and let the frontend's hybrid mode ken-burns it client-side.
  const sizeMap: Record<string, string> = { "16:9": "1024x576", "9:16": "576x1024", "1:1": "1024x1024" };
  let still: Awaited<ReturnType<typeof callImageGen>> | null = null;
  let stillErr = "";
  try {
    still = await callImageGen({
      prompt: prompt || "cinematic music video still, dramatic lighting",
      size: sizeMap[aspect] || "1024x576",
    });
  } catch (err) {
    stillErr = err instanceof Error ? err.message : String(err);
    console.warn("[mv-video] callImageGen threw:", stillErr);
  }

  let stillUrl = imageUrl;
  if (still && still.ok) {
    stillUrl = still.image_url
      ? still.image_url
      : (still.image_b64 ? `data:image/png;base64,${still.image_b64}` : stillUrl);
  }
  if (!stillUrl) {
    // Synthesize an SVG gradient still as ultimate fallback.
    let hue = 200;
    for (let i = 0; i < prompt.length; i++) hue = (hue * 31 + prompt.charCodeAt(i)) % 360;
    const [w, h] = (sizeMap[aspect] || "1024x576").split("x").map(Number);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="hsl(${hue},70%,32%)"/>` +
      `<stop offset="100%" stop-color="hsl(${(hue + 60) % 360},75%,18%)"/>` +
      `</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
    stillUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }

  console.warn(
    `[mv-video] all providers failed, returning still+ken-burns flag. upstream=${upstreamDetail.slice(0, 80)} fallback=${(vid?.error || vidErr || "no_provider").slice(0, 80)}`,
  );
  return res.status(200).json({
    ok: true,
    task_id: `placeholder-${Date.now()}`,
    video_url: "",
    image_url: stillUrl,
    engine: "placeholder",
    cost_cents: 0,
    use_user_key: false,
    fallback: true,
    placeholder: true,
    video_skipped: true,
    aspect_ratio: aspect,
    duration_secs: Math.round(duration),
    upstream_error: upstreamDetail,
    fallback_error: vid?.error || vidErr || "no_provider_succeeded",
    still_error: still?.error || stillErr || "",
  });
});

// CSSOS_TIER_FIRST_SUBTITLES 20260507 — Jing
// /api/mv/subtitles is already free: Rust uses the local `srt-v1` engine
// (offline, lyrics+duration → SRT/ASS via even-divide or aligned-words from
// the music engine). No paid API in the path → no tier-sweep needed.
// /api/mv/compose is pure ffmpeg, also free. Both fall through this catch-all.
app.all(/^\/api\/mv\//, (req, res) => {
  const userId = (req.session as any)?.user_id;
  if (!userId) {
    return res
      .status(401)
      .json({ ok: false, error: "sign_in_required" });
  }
  if (!CSSOS_INTERNAL_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: "internal_token_not_configured",
      hint: "set CSSOS_INTERNAL_TOKEN in /etc/cssos.env",
    });
  }

  const bodyStr =
    req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : "";

  const upstream = http.request(
    {
      hostname: RUST_MV_HOST,
      port: RUST_MV_PORT,
      path: req.originalUrl,
      method: req.method,
      headers: {
        "content-type":
          (req.headers["content-type"] as string) || "application/json",
        "content-length": Buffer.byteLength(bodyStr),
        "x-cssos-internal-token": CSSOS_INTERNAL_TOKEN,
        "x-cssos-user": String(userId),
        "x-forwarded-for": String(
          req.headers["x-forwarded-for"] ||
            req.ip ||
            req.socket.remoteAddress ||
            "",
        ),
      },
      timeout: MV_PROXY_TIMEOUT_MS,
    },
    (upstreamRes) => {
      res.status(upstreamRes.statusCode || 502);
      for (const [k, v] of Object.entries(upstreamRes.headers)) {
        if (v === undefined) continue;
        const lower = k.toLowerCase();
        // Skip hop-by-hop headers we don't want to forward verbatim.
        if (
          lower === "transfer-encoding" ||
          lower === "connection" ||
          lower === "keep-alive"
        ) {
          continue;
        }
        try {
          res.setHeader(k, v as any);
        } catch {}
      }
      upstreamRes.pipe(res);
    },
  );
  upstream.on("timeout", () => {
    upstream.destroy(new Error("upstream_timeout"));
  });
  upstream.on("error", (err) => {
    console.error(
      "[mv-proxy] upstream error for",
      req.method,
      req.originalUrl,
      err?.message || err,
    );
    if (!res.headersSent) {
      res.status(502).json({
        ok: false,
        error: "mv_upstream_error",
        detail: err?.message || String(err),
      });
    } else {
      try {
        res.end();
      } catch {}
    }
  });
  if (bodyStr) {
    upstream.write(bodyStr);
  }
  upstream.end();
});

// CSSOS_PHASE2_PAYMENTS 20260419 — NihaoPay IPN webhook.
// Must come BEFORE the authenticated /api/payments/* proxy below, because
// NihaoPay itself posts here without a session cookie. We forward the raw
// form-urlencoded body byte-for-byte so the rust-api can verify the MD5
// signature against the exact bytes NihaoPay signed.
app.post(/^\/api\/payments\/webhook\//, (req, res) => {
  if (!CSSOS_INTERNAL_TOKEN) {
    return res.status(503).type("text/plain").send("internal_token_not_configured");
  }
  const rawBody: Buffer = (req as any).rawBody || Buffer.alloc(0);
  const contentType =
    (req.headers["content-type"] as string) || "application/x-www-form-urlencoded";
  const upstream = http.request(
    {
      hostname: RUST_MV_HOST,
      port: RUST_MV_PORT,
      path: req.originalUrl,
      method: req.method,
      headers: {
        "content-type": contentType,
        "content-length": rawBody.length,
        "x-cssos-internal-token": CSSOS_INTERNAL_TOKEN,
        "x-forwarded-for": String(
          req.headers["x-forwarded-for"] ||
            req.ip ||
            req.socket.remoteAddress ||
            "",
        ),
      },
      timeout: 30000,
    },
    (upstreamRes) => {
      res.status(upstreamRes.statusCode || 502);
      for (const [k, v] of Object.entries(upstreamRes.headers)) {
        if (v === undefined) continue;
        const lower = k.toLowerCase();
        if (lower === "transfer-encoding" || lower === "connection" || lower === "keep-alive") {
          continue;
        }
        try { res.setHeader(k, v as any); } catch {}
      }
      upstreamRes.pipe(res);
    },
  );
  upstream.on("timeout", () => upstream.destroy(new Error("upstream_timeout")));
  upstream.on("error", (err) => {
    console.error(
      "[payments-webhook-proxy] upstream error",
      req.method,
      req.originalUrl,
      (err as any)?.message || err,
    );
    if (!res.headersSent) {
      res.status(502).type("text/plain").send("upstream_error");
    } else {
      try { res.end(); } catch {}
    }
  });
  if (rawBody.length > 0) upstream.write(rawBody);
  upstream.end();
});

// CSSOS_PHASE2_PAYMENTS 20260419 — Authenticated payments API proxy.
// Mirrors the /api/mv/* pattern: requires an Express session, forwards the
// user id via x-cssos-user, JSON body. Covers POST /api/payments/checkout,
// GET /api/payments/intents/:id, GET /api/payments/history.
app.all(/^\/api\/payments\//, (req, res) => {
  const userId = (req.session as any)?.user_id;
  if (!userId) {
    return res.status(401).json({ ok: false, error: "sign_in_required" });
  }
  if (!CSSOS_INTERNAL_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: "internal_token_not_configured",
      hint: "set CSSOS_INTERNAL_TOKEN in /etc/cssos.env",
    });
  }
  const bodyStr =
    req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : "";
  const upstream = http.request(
    {
      hostname: RUST_MV_HOST,
      port: RUST_MV_PORT,
      path: req.originalUrl,
      method: req.method,
      headers: {
        "content-type":
          (req.headers["content-type"] as string) || "application/json",
        "content-length": Buffer.byteLength(bodyStr),
        "x-cssos-internal-token": CSSOS_INTERNAL_TOKEN,
        "x-cssos-user": String(userId),
        "x-forwarded-for": String(
          req.headers["x-forwarded-for"] ||
            req.ip ||
            req.socket.remoteAddress ||
            "",
        ),
      },
      timeout: 60000,
    },
    (upstreamRes) => {
      res.status(upstreamRes.statusCode || 502);
      for (const [k, v] of Object.entries(upstreamRes.headers)) {
        if (v === undefined) continue;
        const lower = k.toLowerCase();
        if (lower === "transfer-encoding" || lower === "connection" || lower === "keep-alive") {
          continue;
        }
        try { res.setHeader(k, v as any); } catch {}
      }
      upstreamRes.pipe(res);
    },
  );
  upstream.on("timeout", () => upstream.destroy(new Error("upstream_timeout")));
  upstream.on("error", (err) => {
    console.error(
      "[payments-proxy] upstream error",
      req.method,
      req.originalUrl,
      (err as any)?.message || err,
    );
    if (!res.headersSent) {
      res.status(502).json({
        ok: false,
        error: "payments_upstream_error",
        detail: (err as any)?.message || String(err),
      });
    } else {
      try { res.end(); } catch {}
    }
  });
  if (bodyStr) upstream.write(bodyStr);
  upstream.end();
});

// CSSOS_PHASE2_SETTINGS_ENGINE_KEYS_PROXY 20260507 — Jing
// Frontend (app.engine-accounts.js) hits /api/settings/engine-keys/* for BYOK
// management; the Rust API exposes these routes (see rust-api/src/
// engine_credentials/api.rs) but Express had no proxy → 404. Mirror the
// /api/payments/* proxy pattern.
app.all(/^\/api\/settings\//, (req, res) => {
  const userId = (req.session as any)?.user_id;
  if (!userId) {
    return res.status(401).json({ ok: false, error: "sign_in_required" });
  }
  if (!CSSOS_INTERNAL_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: "internal_token_not_configured",
      hint: "set CSSOS_INTERNAL_TOKEN in /etc/cssos.env",
    });
  }
  const bodyStr =
    req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : "";
  const upstream = http.request(
    {
      hostname: RUST_MV_HOST,
      port: RUST_MV_PORT,
      path: req.originalUrl,
      method: req.method,
      headers: {
        "content-type":
          (req.headers["content-type"] as string) || "application/json",
        "content-length": Buffer.byteLength(bodyStr),
        "x-cssos-internal-token": CSSOS_INTERNAL_TOKEN,
        "x-cssos-user": String(userId),
        "x-forwarded-for": String(
          req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress || "",
        ),
      },
      timeout: 60000,
    },
    (upstreamRes) => {
      res.status(upstreamRes.statusCode || 502);
      for (const [k, v] of Object.entries(upstreamRes.headers)) {
        if (v === undefined) continue;
        const lower = k.toLowerCase();
        if (lower === "transfer-encoding" || lower === "connection" || lower === "keep-alive") continue;
        try { res.setHeader(k, v as any); } catch {}
      }
      upstreamRes.pipe(res);
    },
  );
  upstream.on("timeout", () => upstream.destroy(new Error("upstream_timeout")));
  upstream.on("error", (err) => {
    console.error("[settings-proxy] upstream error", req.method, req.originalUrl, (err as any)?.message || err);
    if (!res.headersSent) {
      res.status(502).json({
        ok: false,
        error: "settings_upstream_error",
        detail: (err as any)?.message || String(err),
      });
    } else {
      try { res.end(); } catch {}
    }
  });
  if (bodyStr) upstream.write(bodyStr);
  upstream.end();
});

app.get("/version.json", (_req, res) => {
  noStore(res);
  try {
    if (fs.existsSync(SHARED_VERSIONS_FILE)) {
      const payload = JSON.parse(fs.readFileSync(SHARED_VERSIONS_FILE, "utf8"));
      const current = String(payload?.current || "").trim();
      return res.json({ version: current || "current" });
    }
  } catch {}
  return res.json({ version: "current" });
});
app.get("/versions.json", (_req, res) => {
  noStore(res);
  try {
    if (fs.existsSync(SHARED_VERSIONS_FILE)) {
      const payload = JSON.parse(fs.readFileSync(SHARED_VERSIONS_FILE, "utf8"));
      return res.json(
        payload && typeof payload === "object"
          ? payload
          : { current: "", versions: [] },
      );
    }
  } catch {}
  return res.json({ current: "", versions: [] });
});
app.get("/api/system/maintenance-report", (_req, res) => {
  noStore(res);
  const readLatestMaintenanceReport = (fileName: string) => {
    const target = path.join(MAINTENANCE_REPORT_DIR, fileName);
    if (!fs.existsSync(target)) return null;
    try {
      const payload = JSON.parse(fs.readFileSync(target, "utf8"));
      return payload && typeof payload === "object" ? payload : null;
    } catch {
      return null;
    }
  };
  const runPrune = readLatestMaintenanceReport("run-prune.latest.json");
  const workArchive = readLatestMaintenanceReport("work-archive.latest.json");
  return res.json(
    okData({
      generated_at: new Date().toISOString(),
      reports: {
        ...(runPrune ? { run_prune: runPrune } : {}),
        ...(workArchive ? { work_archive: workArchive } : {}),
      },
      summary: {
        run_prune_removed_count: Number((runPrune as any)?.removed_count || 0),
        run_prune_removed_gb: Number((runPrune as any)?.removed_gb || 0),
        work_archive_candidate_count: Number(
          (workArchive as any)?.candidate_count || 0,
        ),
        work_archive_archived_count: Number(
          (workArchive as any)?.archived_count || 0,
        ),
      },
    }),
  );
});
app.get("/v/:version", (_req, res) => {
  noStore(res);
  res.type("html");
  return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});
app.get("/mv-lite", (_req, res) => {
  noStore(res);
  res.type("html");
  return res.sendFile(path.join(PUBLIC_DIR, "mv-lite.html"));
});
// CSSOS_PHASE2_PAYMENTS 20260419 — NihaoPay hosted-page return page.
// Users land here after Alipay / WeChat Pay / UnionPay finish on the gateway.
// The static HTML polls GET /api/payments/intents/:id for the final status.
app.get("/billing/return", (_req, res) => {
  noStore(res);
  res.type("html");
  return res.sendFile(path.join(PUBLIC_DIR, "billing", "return.html"));
});
app.use(
  express.static(PUBLIC_DIR, {
    /* CSSOS_SHARE_OG_BYPASS_STATIC 20260506 — disable express.static's
     * default `/` → index.html behavior so the request falls through
     * to the app.get("/") handler that injects per-share OG meta when
     * the URL carries ?cssMV=<id>. Direct /index.html requests still
     * work; only the bare `/` is rerouted. */
    index: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-store");
    },
  }),
);

// CSSOS_PHASE2_COVER_FALLBACK_MOUNT 20260507 — Jing
// Static mount for base64 cover fallbacks persisted by /api/mv/cover.
// Compose / Rust ffmpeg fetches these via plain HTTP; data: URLs were
// not fetchable and broke the compose stage.
try {
  app.use(
    "/artifacts/mv-fallback",
    express.static(MV_FALLBACK_ARTIFACTS_DIR, {
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    }),
  );
  console.log("[mv-cover-fallback] mounted /artifacts/mv-fallback -> %s", MV_FALLBACK_ARTIFACTS_DIR);
} catch (e) {
  console.warn("[mv-cover-fallback] mount failed:", e);
}

// CSSOS_PHASE2_PERSONALIZATION_TEMPLATES 20260502 #270 - Jing
// Public mount for personalization template assets so the watch
// frame can fetch base.mp4 / base.mp3 / cover.png at playback time.
// The directory is /srv/cssos/shared/personalization-templates/ in
// production; CSSOS_PERSONALIZATION_TEMPLATES_DIR can override (used
// in dev). Templates are immutable once shipped — long-cache is safe.
{
  const templatesRoot =
    process.env.CSSOS_PERSONALIZATION_TEMPLATES_DIR ||
    "/srv/cssos/shared/personalization-templates";
  try {
    if (fs.existsSync(templatesRoot) && fs.statSync(templatesRoot).isDirectory()) {
      app.use(
        "/personalization-templates",
        express.static(templatesRoot, {
          maxAge: "30d",
          immutable: true,
          setHeaders(res) {
            res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
          },
        }),
      );
      console.log(
        "[personalization] mounted /personalization-templates -> %s",
        templatesRoot,
      );
    } else {
      console.log(
        "[personalization] templates root %s does not exist yet — mount skipped (this is expected before templates ship)",
        templatesRoot,
      );
    }
  } catch (e) {
    console.warn(
      "[personalization] could not mount templates root %s: %s",
      templatesRoot,
      e instanceof Error ? e.message : String(e),
    );
  }
}

function noStore(res: express.Response) {
  res.setHeader("Cache-Control", "no-store");
}

async function getGceAccessToken() {
  const response = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {
      headers: { "Metadata-Flavor": "Google" },
    },
  );
  if (!response.ok) {
    throw new Error(`gce_token_failed:${response.status}`);
  }
  const payload = await response.json().catch(() => null);
  const token = String(payload?.access_token || "").trim();
  if (!token) {
    throw new Error("gce_token_missing");
  }
  return token;
}

async function listBucketObjects(prefix: string) {
  const token = await getGceAccessToken();
  const response = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(ASSET_BUCKET_NAME)}/o?prefix=${encodeURIComponent(prefix)}`,
    {
      headers: { authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    throw new Error(`gcs_list_failed:${response.status}`);
  }
  const payload = await response.json().catch(() => null);
  return Array.isArray(payload?.items) ? payload.items : [];
}

async function fetchBucketObject(objectName: string) {
  const token = await getGceAccessToken();
  return fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(ASSET_BUCKET_NAME)}/o/${encodeURIComponent(
      objectName,
    )}?alt=media`,
    {
      headers: { authorization: `Bearer ${token}` },
    },
  );
}

async function uploadBucketObject(
  objectName: string,
  body: Buffer,
  contentType: string,
) {
  const token = await getGceAccessToken();
  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
      ASSET_BUCKET_NAME,
    )}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": contentType,
      },
      body: new Uint8Array(body),
    },
  );
  if (!response.ok) {
    throw new Error(`gcs_upload_failed:${response.status}`);
  }
  return response.json().catch(() => null);
}

function sanitizeWorkAssetKey(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return "";
  if (normalized.includes("\\")) return "";
  if (
    !normalized.startsWith("works/") &&
    !normalized.startsWith("examples/") &&
    !normalized.startsWith("music-sources/")
  ) {
    return "";
  }
  return normalized;
}

function buildWorkAssetBlobUrl(assetKey: string) {
  const safeAssetKey = sanitizeWorkAssetKey(assetKey);
  if (!safeAssetKey) return "";
  return `/api/work-assets/blob?asset_key=${encodeURIComponent(safeAssetKey)}`;
}

function inferExampleAssetMime(name: string) {
  const lower = String(name || "")
    .trim()
    .toLowerCase();
  if (lower.endsWith(".html")) return "text/html; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function sanitizeExampleAssetName(value: string) {
  const normalized = String(value || "")
    .trim()
    .replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return "";
  if (normalized.includes("\\")) return "";
  return normalized;
}

function sanitizeSharedAssetRelativePath(value: string) {
  const normalized = String(value || "")
    .trim()
    .replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return "";
  if (normalized.includes("\\")) return "";
  return normalized;
}

function inferSharedAssetMime(name: string) {
  return inferExampleAssetMime(name);
}

function sharedAssetsRootDir() {
  return path.join(SHARED_DIR, "assets");
}

function resolveSharedAssetPath(value: string) {
  const rel = sanitizeSharedAssetRelativePath(value);
  if (!rel) return null;
  const root = sharedAssetsRootDir();
  const resolved = path.resolve(root, rel);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return { rel, resolved };
}

async function getSessionUser(req: express.Request) {
  const sessionUserId = (req.session as any)?.user_id;
  if (!sessionUserId || !DATABASE_URL) return null;
  type UserRow = {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  const result: QueryResult<UserRow> = await withClient((client) =>
    client.query<UserRow>(
      "SELECT id, display_name, email, avatar_url FROM users WHERE id = $1",
      [sessionUserId],
    ),
  );
  return result.rows[0] || null;
}

function okEmpty(data: unknown, message = "No data yet") {
  return { ok: true, empty: true, message, data };
}

function okData(data: unknown) {
  return { ok: true, empty: false, data };
}

function normalizeEmail(email: string | null | undefined) {
  if (!email) return null;
  const s = String(email).trim().toLowerCase();
  return s || null;
}

function getStripeWebhookSecret() {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  return secret || null;
}

function stripePlatformFeeBps() {
  const parsed = Number.parseInt(
    String(process.env.STRIPE_PLATFORM_FEE_BPS || "1000"),
    10,
  );
  if (!Number.isFinite(parsed)) return 1000;
  return Math.max(0, Math.min(parsed, 9500));
}

function computePlatformFeeCents(amountCents: number) {
  return Math.max(
    0,
    Math.round(amountCents * (stripePlatformFeeBps() / 10000)),
  );
}

function stripePayoutHoldDaysEnv() {
  const parsed = Number.parseInt(
    String(process.env.STRIPE_PAYOUT_HOLD_DAYS || "14"),
    10,
  );
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 14;
}

function stripePayoutSweepMsEnv() {
  const parsed = Number.parseInt(
    String(process.env.STRIPE_PAYOUT_SWEEP_MS || String(60 * 60 * 1000)),
    10,
  );
  return Number.isFinite(parsed) && parsed >= 60_000 ? parsed : 60 * 60 * 1000;
}

const behaviorTemplateCache = {
  value: null as any,
  expiresAt: 0,
};

async function loadBehaviorTemplateServer() {
  const now = Date.now();
  if (behaviorTemplateCache.value && behaviorTemplateCache.expiresAt > now) {
    return behaviorTemplateCache.value;
  }
  let nextValue = sanitizeBehaviorPanelTemplate({});
  if (DATABASE_URL) {
    try {
      const row = await withClient((client) =>
        client.query<{ value: any }>(
          `SELECT value
           FROM panel_default_templates
           WHERE panel_key = 'behavior'
           LIMIT 1`,
        ),
      );
      nextValue = sanitizeBehaviorPanelTemplate(row.rows[0]?.value || {});
    } catch {
      nextValue = sanitizeBehaviorPanelTemplate({});
    }
  }
  behaviorTemplateCache.value = nextValue;
  behaviorTemplateCache.expiresAt = now + 30_000;
  return nextValue;
}

async function getCommercePolicySettings() {
  const behavior = await loadBehaviorTemplateServer();
  const commerce = behavior?.commerce || {};
  return {
    payoutHoldDays: Math.max(
      0,
      Math.min(
        90,
        Number(commerce.payout_hold_days ?? stripePayoutHoldDaysEnv()) ||
          stripePayoutHoldDaysEnv(),
      ),
    ),
    payoutSweepMs: Math.max(
      60_000,
      Math.min(
        24 * 60 * 60 * 1000,
        Number(commerce.payout_sweep_ms ?? stripePayoutSweepMsEnv()) ||
          stripePayoutSweepMsEnv(),
      ),
    ),
    minTipCents: Math.max(
      100,
      Math.min(100_000, Number(commerce.min_tip_cents ?? 100) || 100),
    ),
  };
}

async function getCreatorCommercePolicySettings() {
  const behavior = await loadBehaviorTemplateServer();
  const creatorBoost = behavior?.creator_boost || {};
  const membership = behavior?.membership || {};
  return {
    starterMonthlyLimit: Math.max(
      1,
      Math.min(1000, Number(membership.starter_monthly_limit ?? 30) || 30),
    ),
    proMonthlyLimit: Math.max(
      1,
      Math.min(5000, Number(membership.pro_monthly_limit ?? 100) || 100),
    ),
    studioMonthlyLimit: Math.max(
      1,
      Math.min(10000, Number(membership.studio_monthly_limit ?? 300) || 300),
    ),
    enterpriseMonthlyLimit:
      Number(membership.enterprise_monthly_limit ?? 0) > 0
        ? Math.max(
            1,
            Math.min(100000, Number(membership.enterprise_monthly_limit) || 0),
          )
        : null,
    vipUnlimited: creatorBoost.vip_unlimited !== false,
    languageBoostUnitCents: Math.max(
      100,
      Math.min(100000, Number(creatorBoost.language_unit_cents ?? 300) || 300),
    ),
    voiceBoostUnitCents: Math.max(
      100,
      Math.min(100000, Number(creatorBoost.voice_unit_cents ?? 500) || 500),
    ),
    thumbnailBoostUnitCents: Math.max(
      25,
      Math.min(100000, Number(creatorBoost.thumbnail_unit_cents ?? 79) || 79),
    ),
    previewVideoBoostUnitCents: Math.max(
      25,
      Math.min(
        100000,
        Number(creatorBoost.preview_video_unit_cents ?? 249) || 249,
      ),
    ),
    generationBoostUnitCents: Math.max(
      25,
      Math.min(
        100000,
        Number(creatorBoost.generation_unit_cents ?? 99) || 99,
      ),
    ),
    backgroundJobBoostUnitCents: Math.max(
      25,
      Math.min(
        100000,
        Number(creatorBoost.background_job_unit_cents ?? 199) || 199,
      ),
    ),
    adminOnlyPurchaseOverride: !!creatorBoost.admin_only_purchase_override,
    enabledKinds: Array.from(
      new Set(
        (
          Array.isArray(creatorBoost.enabled_kinds)
            ? creatorBoost.enabled_kinds.filter((item: unknown) =>
                [
                  "language",
                  "voice",
                  "thumbnail",
                  "preview_video",
                  "generation",
                  "background_job",
                ].includes(String(item || ""))
              )
            : ["language", "voice", "thumbnail", "preview_video", "generation", "background_job"]
        ).concat("background_job"),
      ),
    ),
  };
}

type BillableActionKey =
  | "lyrics_generate"
  | "music_generate"
  | "video_generate"
  | "thumbnail_regenerate"
  | "preview_video_regenerate"
  | "multi_language"
  | "multi_voice"
  | "cinema_booking"
  | "enterprise_route";

function normalizeBillableActionKey(value: unknown): BillableActionKey | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (
    [
      "lyrics_generate",
      "music_generate",
      "video_generate",
      "thumbnail_regenerate",
      "preview_video_regenerate",
      "multi_language",
      "multi_voice",
      "cinema_booking",
      "enterprise_route",
    ].includes(raw)
  ) {
    return raw as BillableActionKey;
  }
  return null;
}

async function getBillingActionPolicySettings() {
  const behavior = await loadBehaviorTemplateServer();
  const billing = behavior?.billing_actions || {};
  const creator = await getCreatorCommercePolicySettings();
  return {
    lyricsGenerateCents: Math.max(
      0,
      Math.min(100000, Number(billing.lyrics_generate_cents ?? 20) || 20),
    ),
    musicGenerateCents: Math.max(
      0,
      Math.min(100000, Number(billing.music_generate_cents ?? 40) || 40),
    ),
    videoGenerateCents: Math.max(
      0,
      Math.min(100000, Number(billing.video_generate_cents ?? 60) || 60),
    ),
    thumbnailRegenerateCents: creator.thumbnailBoostUnitCents,
    previewVideoRegenerateCents: creator.previewVideoBoostUnitCents,
    multiLanguageCents: creator.languageBoostUnitCents,
    multiVoiceCents: creator.voiceBoostUnitCents,
    enterpriseRouteCents: Math.max(
      0,
      Math.min(100000, Number(billing.enterprise_route_cents ?? 5) || 5),
    ),
    cinemaBookingCents: Math.max(
      0,
      Math.min(100000, Number(billing.cinema_booking_cents ?? 0) || 0),
    ),
    includedMembershipCoversCore:
      billing.included_membership_covers_core !== false,
  };
}

function billableActionCostCents(
  actionKey: BillableActionKey,
  settings: Awaited<ReturnType<typeof getBillingActionPolicySettings>>,
) {
  if (actionKey === "lyrics_generate") return settings.lyricsGenerateCents;
  if (actionKey === "music_generate") return settings.musicGenerateCents;
  if (actionKey === "video_generate") return settings.videoGenerateCents;
  if (actionKey === "thumbnail_regenerate")
    return settings.thumbnailRegenerateCents;
  if (actionKey === "preview_video_regenerate")
    return settings.previewVideoRegenerateCents;
  if (actionKey === "multi_language") return settings.multiLanguageCents;
  if (actionKey === "multi_voice") return settings.multiVoiceCents;
  if (actionKey === "enterprise_route") return settings.enterpriseRouteCents;
  return settings.cinemaBookingCents;
}

async function getStudioEnterprisePolicySettings() {
  const behavior = await loadBehaviorTemplateServer();
  const settings = behavior?.studio_enterprise || {};
  return {
    teamCollaborationEnabled: !!settings.team_collaboration_enabled,
    maxTeamMembers: Math.max(
      1,
      Math.min(500, Number(settings.max_team_members ?? 5) || 5),
    ),
    multiProjectEnabled: settings.multi_project_enabled !== false,
    maxProjects: Math.max(
      1,
      Math.min(1000, Number(settings.max_projects ?? 12) || 12),
    ),
    enterpriseApiEnabled: !!settings.enterprise_api_enabled,
    enterpriseApiRateLimitPerMinute: Math.max(
      1,
      Math.min(
        100000,
        Number(settings.enterprise_api_rate_limit_per_minute ?? 600) || 600,
      ),
    ),
  };
}

function queueLaneForTier(tier: MembershipTier) {
  if (tier === "admin") return "admin_override";
  if (tier === "vip") return "vip_private";
  if (tier === "enterprise") return "enterprise_dedicated";
  if (tier === "studio") return "studio_pipeline";
  if (tier === "pro") return "pro_pipeline";
  if (tier === "starter") return "starter_paid";
  if (tier === "free") return "free_standard";
  return "guest_preview";
}

function canUseStudioWorkspaceTier(tier: MembershipTier) {
  return ["studio", "enterprise", "vip", "admin"].includes(tier);
}

function canUseEnterpriseApiTier(tier: MembershipTier) {
  return ["enterprise", "vip", "admin"].includes(tier);
}

const DELIVERY_ADMIN_ONLY_ACTION_ATTRS = [
  "data-delivery-rewrite-bundle-commit",
  "data-delivery-rewrite-bundle-save",
  "data-delivery-rewrite-bundle-promote",
  "data-delivery-rewrite-sandbox-apply",
  "data-delivery-rewrite-sandbox-clear",
  "data-delivery-arrangement-revision-rollback",
  "data-delivery-arrangement-revision-merge-forward",
  "data-delivery-arrangement-release-candidate",
  "data-delivery-arrangement-lock",
  "data-delivery-arrangement-publish",
  "data-delivery-publish-step-approve",
  "data-delivery-publish-step-finalize",
  "data-delivery-publish-step-remind",
  "data-delivery-publish-actor-suggest",
  "data-delivery-publish-route-shortcut",
  "data-delivery-publish-runbook-automation",
  "data-delivery-publish-confirm-arm",
  "data-delivery-publish-confirm-disarm",
  "data-delivery-post-publish-rollback",
  "data-delivery-compliance-escalate",
  "data-delivery-compliance-ticket",
  "data-delivery-compliance-backfill",
  "data-delivery-compliance-rotate-secret",
  "data-delivery-compliance-update-registry",
  "data-delivery-compliance-reopen",
  "data-delivery-compliance-save-directory",
  "data-delivery-compliance-save-preset",
  "data-delivery-compliance-audit-log",
  "data-delivery-compliance-save-role-policy",
  "data-delivery-compliance-approve",
  "data-delivery-compliance-save-routing",
  "data-delivery-compliance-save-signers",
  "data-delivery-compliance-finalize-quorum",
  "data-delivery-probe-dispatch-done",
  "data-delivery-probe-dispatch-history-export",
  "data-delivery-probe-incident-export",
  "data-delivery-probe-handoff-ack",
  "data-delivery-probe-receipt-copy",
  "data-delivery-probe-followup-copy",
  "data-delivery-watch-case-route-priority",
  "data-delivery-watch-case-route",
  "data-delivery-watch-case-close-summary",
  "data-delivery-watch-owner-inbox-digest",
  "data-delivery-watch-case-export-bundle",
  "data-delivery-watch-case-status",
];
const DELIVERY_STANDARD_SCOPE_RULES = [
  {
    scope: "delivery.watch.case",
    match: (name: string) => name.startsWith("data-delivery-watch-case-"),
  },
  {
    scope: "delivery.watch.archive",
    match: (name: string) => name.includes("data-delivery-watch-archive-"),
  },
  {
    scope: "delivery.watch.compare",
    match: (name: string) => name.includes("data-delivery-watch-compare-"),
  },
  {
    scope: "delivery.watch.saved_view",
    match: (name: string) => name.includes("data-delivery-watch-saved-view-"),
  },
  {
    scope: "delivery.watch.standard",
    match: (name: string) => name.startsWith("data-delivery-watch-"),
  },
  {
    scope: "delivery.compliance.refresh",
    match: (name: string) => name === "data-delivery-compliance-refresh",
  },
  {
    scope: "delivery.compliance.open",
    match: (name: string) => name === "data-delivery-compliance-open",
  },
  {
    scope: "delivery.compliance.registry",
    match: (name: string) =>
      [
        "data-delivery-compliance-update-registry",
        "data-delivery-compliance-save-directory",
        "data-delivery-compliance-save-preset",
        "data-delivery-compliance-save-role-policy",
        "data-delivery-compliance-save-routing",
        "data-delivery-compliance-save-signers",
        "data-delivery-compliance-backfill",
      ].includes(name),
  },
  {
    scope: "delivery.compliance.approval",
    match: (name: string) =>
      [
        "data-delivery-compliance-approve",
        "data-delivery-compliance-escalate",
        "data-delivery-compliance-ticket",
        "data-delivery-compliance-audit-log",
      ].includes(name),
  },
  {
    scope: "delivery.compliance.signer",
    match: (name: string) =>
      [
        "data-delivery-compliance-rotate-secret",
        "data-delivery-compliance-reopen",
      ].includes(name),
  },
  {
    scope: "delivery.compliance.quorum",
    match: (name: string) =>
      name === "data-delivery-compliance-finalize-quorum",
  },
  {
    scope: "delivery.compliance.standard",
    match: (name: string) => name.startsWith("data-delivery-compliance-"),
  },
  {
    scope: "delivery.rewrite.bundle",
    match: (name: string) => name.includes("data-delivery-rewrite-bundle-"),
  },
  {
    scope: "delivery.rewrite.sandbox",
    match: (name: string) => name.includes("data-delivery-rewrite-sandbox-"),
  },
  {
    scope: "delivery.rewrite.diff",
    match: (name: string) => name === "data-delivery-rewrite-diff-focus",
  },
  {
    scope: "delivery.rewrite.playback",
    match: (name: string) =>
      [
        "data-delivery-rewrite-phrase-play",
        "data-delivery-rewrite-lane",
        "data-delivery-rewrite-payload-mode",
        "data-delivery-rewrite-assist",
      ].includes(name),
  },
  {
    scope: "delivery.rewrite.standard",
    match: (name: string) => name.startsWith("data-delivery-rewrite-"),
  },
  {
    scope: "delivery.probe.dispatch",
    match: (name: string) => name.includes("data-delivery-probe-dispatch-"),
  },
  {
    scope: "delivery.probe.export",
    match: (name: string) =>
      [
        "data-delivery-probe-incident-export",
        "data-delivery-probe-receipt-copy",
        "data-delivery-probe-followup-copy",
      ].includes(name),
  },
  {
    scope: "delivery.probe.handoff",
    match: (name: string) => name === "data-delivery-probe-handoff-ack",
  },
  {
    scope: "delivery.probe.compare",
    match: (name: string) => name === "data-delivery-probe-compare-select",
  },
  {
    scope: "delivery.probe.standard",
    match: (name: string) => name.startsWith("data-delivery-probe-"),
  },
  {
    scope: "delivery.publish.simulate",
    match: (name: string) => name === "data-delivery-publish-simulate",
  },
  {
    scope: "delivery.publish.route",
    match: (name: string) =>
      [
        "data-delivery-publish-route-shortcut",
        "data-delivery-publish-actor-suggest",
        "data-delivery-publish-runbook-automation",
      ].includes(name),
  },
  {
    scope: "delivery.publish.confirm",
    match: (name: string) =>
      [
        "data-delivery-publish-confirm-arm",
        "data-delivery-publish-confirm-disarm",
        "data-delivery-publish-ack-note",
      ].includes(name),
  },
  {
    scope: "delivery.publish.finalize",
    match: (name: string) =>
      [
        "data-delivery-publish-step-approve",
        "data-delivery-publish-step-finalize",
        "data-delivery-publish-step-remind",
      ].includes(name),
  },
  {
    scope: "delivery.publish.standard",
    match: (name: string) => name.startsWith("data-delivery-publish-"),
  },
  {
    scope: "delivery.post_publish.standard",
    match: (name: string) => name.startsWith("data-delivery-post-publish-"),
  },
  {
    scope: "delivery.arrangement.standard",
    match: (name: string) => name.startsWith("data-delivery-arrangement-"),
  },
  {
    scope: "delivery.mixer.standard",
    match: (name: string) => name.startsWith("data-delivery-mixer-"),
  },
  {
    scope: "delivery.ops.standard",
    match: (name: string) => name.startsWith("data-delivery-ops-"),
  },
];

function deliveryPermissionScopeFromAttr(attrName: string) {
  const normalized = String(attrName || "")
    .trim()
    .toLowerCase();
  if (!normalized.startsWith("data-delivery-")) return "";
  if (DELIVERY_ADMIN_ONLY_ACTION_ATTRS.includes(normalized)) {
    return `delivery.action.${normalized.replace(/^data-delivery-/, "").replace(/-/g, ".")}`;
  }
  const matched = DELIVERY_STANDARD_SCOPE_RULES.find((entry) =>
    entry.match(normalized),
  );
  if (matched) return matched.scope;
  return "delivery.action.standard";
}

function isProPlusTier(tier: MembershipTier) {
  return ["pro", "studio", "enterprise", "vip", "admin"].includes(tier);
}

function isEnterprisePlusTier(tier: MembershipTier) {
  return ["enterprise", "vip", "admin"].includes(tier);
}

function deliveryScopeAllowedForTier(
  scope: string,
  tier: MembershipTier,
  loggedIn: boolean,
) {
  const normalizedScope = String(scope || "")
    .trim()
    .toLowerCase();
  if (normalizedScope === "delivery.action.standard") return loggedIn;
  if (
    normalizedScope === "delivery.watch.compare" ||
    normalizedScope === "delivery.rewrite.playback" ||
    normalizedScope === "delivery.probe.compare"
  ) {
    return loggedIn;
  }
  if (
    normalizedScope === "delivery.rewrite.bundle" ||
    normalizedScope === "delivery.rewrite.sandbox" ||
    normalizedScope === "delivery.rewrite.diff" ||
    normalizedScope === "delivery.compliance.registry" ||
    normalizedScope === "delivery.publish.route" ||
    normalizedScope === "delivery.probe.dispatch" ||
    normalizedScope === "delivery.probe.export" ||
    normalizedScope === "delivery.probe.handoff"
  ) {
    return isProPlusTier(tier);
  }
  if (
    normalizedScope === "delivery.compliance.approval" ||
    normalizedScope === "delivery.compliance.signer" ||
    normalizedScope === "delivery.compliance.quorum" ||
    normalizedScope === "delivery.publish.finalize" ||
    normalizedScope === "delivery.publish.confirm"
  ) {
    return isEnterprisePlusTier(tier);
  }
  if (normalizedScope.startsWith("delivery.action.")) {
    return tier === "admin";
  }
  return loggedIn;
}

function buildPermissionSnapshot(tier: MembershipTier, role: string) {
  const normalizedTier = normalizeMembershipTier(tier);
  const loggedIn = normalizedTier !== "guest";
  const isAdmin = role === "admin" || normalizedTier === "admin";
  const isPaid = [
    "starter",
    "pro",
    "studio",
    "enterprise",
    "vip",
    "admin",
  ].includes(normalizedTier);
  const isVipOrAdmin = ["vip", "admin"].includes(normalizedTier);
  const canUseStudio = canUseStudioWorkspaceTier(normalizedTier);
  const canUseEnterprise = canUseEnterpriseApiTier(normalizedTier);
  const isProPlus = ["pro", "studio", "enterprise", "vip", "admin"].includes(
    normalizedTier,
  );
  const isStudioPlus = ["studio", "enterprise", "vip", "admin"].includes(
    normalizedTier,
  );
  const scopes: Record<string, boolean> = {
    "login.open": true,
    "login.provider.switch": loggedIn,
    "login.provider.unlink": loggedIn,
    "login.logout": loggedIn,
    "profile.open": loggedIn,
    "profile.passkey.login": true,
    "profile.passkey.enable": loggedIn,
    "profile.avatar.edit": loggedIn,
    "profile.nav.works": loggedIn,
    "profile.nav.api": loggedIn,
    "works.open": loggedIn,
    "works.own.view": loggedIn,
    "works.watch": loggedIn,
    "watch.background.jobs": isProPlus,
    "watch.background.jobs.multi": isProPlus,
    "watch.background.jobs.team": isStudioPlus,
    "works.thumbnail.regen": loggedIn,
    "works.preview_video.regen": loggedIn,
    "works.type.edit": isPaid,
    "works.price.edit": isPaid,
    "works.visibility.edit": isPaid,
    "works.sell": isPaid,
    "works.payout": isPaid,
    "seller.view": isPaid,
    "seller.payout": isPaid,
    "seller.operate": isVipOrAdmin,
    "api.docs.view": true,
    "api.billing.view": true,
    "api.billing.manage": loggedIn,
    "api.enterprise.route": canUseEnterprise,
    "reports.open": loggedIn,
    "reports.export.use": loggedIn,
    "reports.export.source.select": isVipOrAdmin,
    "reports.export.format.select": isVipOrAdmin,
    "reports.export.generate": isVipOrAdmin,
    "reports.export.result.copy": loggedIn,
    "reports.export.result.download": loggedIn,
    "reports.export.preview.toggle": loggedIn,
    "reports.history.filter": loggedIn,
    "reports.history.search": loggedIn,
    "reports.history.select": loggedIn,
    "reports.history.bulk.download": loggedIn,
    "reports.history.bulk.delete": isVipOrAdmin,
    "reports.history.sort": loggedIn,
    "reports.history.clear_selection": loggedIn,
    "reports.history.clear": isVipOrAdmin,
    "reports.history.pin": loggedIn,
    "reports.history.restore": loggedIn,
    "reports.history.copy": loggedIn,
    "reports.history.download": loggedIn,
    "reports.history.delete": isVipOrAdmin,
    "creation.start": loggedIn,
    "creation.advanced": isProPlus,
    "creation.structured": isProPlus,
    "creation.extras": !["guest", "free"].includes(normalizedTier),
    "creation.cinema": isAdmin,
    "cssmv.open": loggedIn,
    "cssmv.workspace.sync": canUseStudio,
    "cssmv.action.retry": isProPlus,
    "cssmv.action.force_refresh_signals": isStudioPlus,
    "cssmv.action.capture_snapshot": isStudioPlus,
    "cssmv.action.escalate_ops": canUseEnterprise,
    "cssmv.action.require_manual_intervention": isVipOrAdmin,
    "delivery.watch.standard": loggedIn,
    "delivery.watch.case": loggedIn,
    "delivery.watch.archive": loggedIn,
    "delivery.watch.compare": loggedIn,
    "delivery.watch.saved_view": loggedIn,
    "delivery.compliance.refresh": loggedIn,
    "delivery.compliance.open": loggedIn,
    "delivery.compliance.registry": loggedIn,
    "delivery.compliance.approval": loggedIn,
    "delivery.compliance.signer": loggedIn,
    "delivery.compliance.quorum": loggedIn,
    "delivery.compliance.standard": loggedIn,
    "delivery.rewrite.bundle": loggedIn,
    "delivery.rewrite.sandbox": loggedIn,
    "delivery.rewrite.diff": loggedIn,
    "delivery.rewrite.playback": loggedIn,
    "delivery.rewrite.standard": loggedIn,
    "delivery.probe.dispatch": loggedIn,
    "delivery.probe.export": loggedIn,
    "delivery.probe.handoff": loggedIn,
    "delivery.probe.compare": loggedIn,
    "delivery.probe.standard": loggedIn,
    "delivery.publish.standard": loggedIn,
    "delivery.publish.simulate": loggedIn,
    "delivery.publish.route": loggedIn,
    "delivery.publish.confirm": loggedIn,
    "delivery.publish.finalize": loggedIn,
    "delivery.post_publish.standard": loggedIn,
    "delivery.arrangement.standard": loggedIn,
    "delivery.mixer.standard": loggedIn,
    "delivery.ops.standard": loggedIn,
    "delivery.action.standard": loggedIn,
  };
  Object.keys(scopes)
    .filter((scope) => scope.startsWith("delivery."))
    .forEach((scope) => {
      scopes[scope] = deliveryScopeAllowedForTier(
        scope,
        normalizedTier,
        loggedIn,
      );
    });
  DELIVERY_ADMIN_ONLY_ACTION_ATTRS.forEach((attrName) => {
    const scope = deliveryPermissionScopeFromAttr(attrName);
    if (scope) scopes[scope] = isAdmin;
  });
  return scopes;
}

async function payoutAvailableAtForOrder(order: {
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}) {
  const base = order.created_at || order.updated_at || new Date();
  const at = new Date(base);
  const commerce = await getCommercePolicySettings();
  at.setUTCDate(at.getUTCDate() + commerce.payoutHoldDays);
  return at;
}

function requestRawBody(req: express.Request) {
  return ((req as any).rawBody as Buffer | undefined) || Buffer.alloc(0);
}

function defaultListenPriceCents() {
  const parsed = Number.parseInt(
    String(process.env.CSSMV_DEFAULT_LISTEN_PRICE_CENTS || "99"),
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 99;
}

function defaultBuyoutPriceCents() {
  const parsed = Number.parseInt(
    String(process.env.CSSMV_DEFAULT_BUYOUT_PRICE_CENTS || "299"),
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 299;
}

type CssmvWorkType = "single" | "triptych" | "opera";

function normalizeWorkType(value: unknown): CssmvWorkType {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "triptych") return "triptych";
  if (raw === "opera") return "opera";
  return "single";
}

function workTypeDisplayLabel(workType: CssmvWorkType) {
  if (workType === "triptych") return "triptych";
  if (workType === "opera") return "opera";
  return "single";
}

function pricingPresetForWorkType(workType: CssmvWorkType) {
  if (workType === "opera") {
    return { listenCents: 99, buyoutCents: 999, label: "opera" };
  }
  if (workType === "triptych") {
    return { listenCents: 99, buyoutCents: 499, label: "triptych" };
  }
  return {
    listenCents: defaultListenPriceCents(),
    buyoutCents: defaultBuyoutPriceCents(),
    label: "single",
  };
}

function defaultCreationPanelTemplate() {
  return {
    creative: {
      genre: "Chinese GuFeng",
      mood: "",
      instrument: "",
      instrumentation: "",
      ambience: "",
      vocal_gender: "Feminine",
      vocal_style: "",
      ensemble_style: "",
      arrangement_density: 0.6,
      dynamics_curve: "",
      section_form: "",
      articulation_bias: "",
      voicing_register: "",
      percussion_activity: 0.45,
      expression_cc_bias: "",
      humanization: 0.35,
      inspiration_notes: "",
      licensed_style_pack: "",
      external_audio_adapter: "",
      tempo_bpm: 88,
      musical_key: "C",
      duration_s: "",
      language: "zh",
      prompt: "",
      work_type: "single",
    },
    pricing_by_type: {
      single: { listen_cents: 99, buyout_cents: 299 },
      triptych: { listen_cents: 99, buyout_cents: 499 },
      opera: { listen_cents: 99, buyout_cents: 999 },
    },
  };
}

function mergeCreationPanelTemplate(value: any) {
  const base = defaultCreationPanelTemplate();
  const creative =
    value &&
    typeof value === "object" &&
    value.creative &&
    typeof value.creative === "object"
      ? value.creative
      : {};
  const pricingByType =
    value &&
    typeof value === "object" &&
    value.pricing_by_type &&
    typeof value.pricing_by_type === "object"
      ? value.pricing_by_type
      : {};
  const merged = {
    creative: {
      genre: String(creative.genre || base.creative.genre).slice(0, 120),
      mood: String(creative.mood || "").slice(0, 120),
      instrument: String(creative.instrument || "").slice(0, 120),
      instrumentation: String(creative.instrumentation || "").slice(0, 400),
      ambience: String(creative.ambience || "").slice(0, 120),
      vocal_gender: String(
        creative.vocal_gender || base.creative.vocal_gender,
      ).slice(0, 120),
      vocal_style: String(creative.vocal_style || "").slice(0, 240),
      ensemble_style: String(creative.ensemble_style || "").slice(0, 240),
      arrangement_density: Math.max(
        0.2,
        Math.min(
          1,
          Number.parseFloat(
            String(
              creative.arrangement_density ?? base.creative.arrangement_density,
            ),
          ) || 0.6,
        ),
      ),
      dynamics_curve: String(creative.dynamics_curve || "").slice(0, 240),
      section_form: String(creative.section_form || "").slice(0, 240),
      articulation_bias: String(creative.articulation_bias || "").slice(0, 240),
      voicing_register: String(creative.voicing_register || "").slice(0, 240),
      percussion_activity: Math.max(
        0,
        Math.min(
          1,
          Number.parseFloat(
            String(
              creative.percussion_activity ?? base.creative.percussion_activity,
            ),
          ) || 0.45,
        ),
      ),
      expression_cc_bias: String(creative.expression_cc_bias || "").slice(
        0,
        240,
      ),
      humanization: Math.max(
        0,
        Math.min(
          1,
          Number.parseFloat(
            String(creative.humanization ?? base.creative.humanization),
          ) || 0.35,
        ),
      ),
      inspiration_notes: String(creative.inspiration_notes || "").slice(
        0,
        1000,
      ),
      licensed_style_pack: String(creative.licensed_style_pack || "").slice(
        0,
        240,
      ),
      external_audio_adapter: String(
        creative.external_audio_adapter || "",
      ).slice(0, 240),
      tempo_bpm: Math.max(
        40,
        Math.min(
          220,
          Number.parseInt(
            String(creative.tempo_bpm || base.creative.tempo_bpm),
            10,
          ) || 88,
        ),
      ),
      musical_key: ["C", "D", "E", "F", "G", "A", "B"].includes(
        String(creative.musical_key || "C"),
      )
        ? String(creative.musical_key)
        : "C",
      duration_s:
        Number.parseInt(String(creative.duration_s || ""), 10) > 0
          ? Math.max(
              30,
              Math.min(
                600,
                Number.parseInt(String(creative.duration_s), 10) || 0,
              ),
            )
          : "",
      language: ["zh", "en", "ja"].includes(
        String(creative.language || base.creative.language),
      )
        ? String(creative.language)
        : "zh",
      prompt: String(creative.prompt || "").slice(0, 500),
      work_type: normalizeWorkType(
        creative.work_type || base.creative.work_type,
      ),
    },
    pricing_by_type: {
      single: pricingPresetForWorkType("single"),
      triptych: pricingPresetForWorkType("triptych"),
      opera: pricingPresetForWorkType("opera"),
    } as Record<
      CssmvWorkType,
      { listenCents: number; buyoutCents: number; label: string }
    >,
  };
  (["single", "triptych", "opera"] as CssmvWorkType[]).forEach((workType) => {
    const entry =
      pricingByType[workType] && typeof pricingByType[workType] === "object"
        ? pricingByType[workType]
        : {};
    const preset = pricingPresetForWorkType(workType);
    merged.pricing_by_type[workType] = {
      listenCents: Math.max(
        1,
        Number.parseInt(String(entry.listen_cents || preset.listenCents), 10) ||
          preset.listenCents,
      ),
      buyoutCents: Math.max(
        0,
        Number.parseInt(String(entry.buyout_cents || preset.buyoutCents), 10) ||
          preset.buyoutCents,
      ),
      label: preset.label,
    };
  });
  return {
    creative: merged.creative,
    pricing_by_type: {
      single: {
        listen_cents: merged.pricing_by_type.single.listenCents,
        buyout_cents: merged.pricing_by_type.single.buyoutCents,
      },
      triptych: {
        listen_cents: merged.pricing_by_type.triptych.listenCents,
        buyout_cents: merged.pricing_by_type.triptych.buyoutCents,
      },
      opera: {
        listen_cents: merged.pricing_by_type.opera.listenCents,
        buyout_cents: merged.pricing_by_type.opera.buyoutCents,
      },
    },
  };
}

function estimateWorkComputeUnits(args: {
  workType?: unknown;
  durationSec?: unknown;
  languageCount?: unknown;
  voiceLaneCount?: unknown;
}) {
  const workType = normalizeWorkType(args.workType);
  const durationSec = Math.max(
    30,
    Math.min(1800, Number(args.durationSec || 0) || 0),
  );
  const languageCount = Math.max(
    1,
    Math.min(12, Number(args.languageCount || 1) || 1),
  );
  const voiceLaneCount = Math.max(
    1,
    Math.min(12, Number(args.voiceLaneCount || 1) || 1),
  );
  const typeMultiplier =
    workType === "opera" ? 3.2 : workType === "triptych" ? 2.1 : 1;
  return Math.max(
    1,
    Math.round(
      (durationSec / 30) *
        typeMultiplier *
        (1 + (languageCount - 1) * 0.35 + (voiceLaneCount - 1) * 0.45),
    ),
  );
}

function estimateWorkComputeCostCents(units: number) {
  return Math.max(1, Math.round(Number(units || 0) * 2));
}

function normalizePanelDefaultsKey(value: unknown) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return [
    "creation",
    "behavior",
    "logo",
    "dock",
    "foryou",
    "watch",
    "lyrics",
    "music",
    "video",
    "about",
    "api",
    "delivery_reports",
    "delivery_ops",
    "cssmv",
    "language",
    "login",
    "profile",
    "works",
    "seller",
  ].includes(key)
    ? key
    : "";
}

function sanitizeGenericPanelTemplate(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function sanitizeBehaviorPanelTemplate(value: any) {
  const source = value && typeof value === "object" ? value : {};
  const modeValues = new Set(["halo", "breath", "prism", "oracle"]);
  const strategyValues = new Set(["random", "fixed", "per_type"]);
  const previewValues = new Set(["auto", "image", "video"]);
  const watchTabs = new Set([
    "mv",
    "music",
    "lyrics",
    "script",
    "comments",
    "revenue",
    "ownership",
  ]);
  const dockPositions = new Set(["left", "right", "top", "bottom"]);
  const themeModes = new Set(["system", "dark", "light"]);
  const backgroundModes = new Set(["aurora", "ribbon", "watercolor", "ink"]);
  const reportKinds = new Set([
    "dashboard",
    "ops_health",
    "kpi",
    "analytics",
    "trends",
    "alerts",
    "digest",
    "briefing_pack",
  ]);
  const safeMode = (input: any, fallback: string) =>
    modeValues.has(String(input || "")) ? String(input) : fallback;
  return {
    appearance: {
      theme_mode: themeModes.has(String(source?.appearance?.theme_mode || ""))
        ? String(source.appearance.theme_mode)
        : "system",
    },
    logo: {
      spell: String(source?.logo?.spell || "CSS").slice(0, 24) || "CSS",
      subtitle:
        String(source?.logo?.subtitle || "Studio").slice(0, 40) || "Studio",
      slogan_template:
        String(
          source?.logo?.slogan_template ||
            'Just say <span class="spell">{spell}</span>, witness the miracle!',
        ).slice(0, 240) ||
        'Just say <span class="spell">{spell}</span>, witness the miracle!',
      mirror_size_px: Math.max(
        420,
        Math.min(880, Number(source?.logo?.mirror_size_px ?? 600) || 600),
      ),
      mask_inset_percent: Math.max(
        0,
        Math.min(28, Number(source?.logo?.mask_inset_percent ?? 12) || 12),
      ),
      media: {
        image_1:
          String(source?.logo?.media?.image_1 || "assets/mirror-1.webp").slice(
            0,
            512,
          ) || "assets/mirror-1.webp",
        image_2:
          String(source?.logo?.media?.image_2 || "assets/mirror-2.webp").slice(
            0,
            512,
          ) || "assets/mirror-2.webp",
        video: String(source?.logo?.media?.video || "").slice(0, 512),
      },
      mirror_strategy: strategyValues.has(
        String(source?.logo?.mirror_strategy || ""),
      )
        ? String(source.logo.mirror_strategy)
        : "per_type",
      fixed_mode: safeMode(source?.logo?.fixed_mode, "halo"),
      per_type: {
        single: safeMode(source?.logo?.per_type?.single, "halo"),
        triptych: safeMode(source?.logo?.per_type?.triptych, "breath"),
        opera: safeMode(source?.logo?.per_type?.opera, "prism"),
      },
    },
    dock: {
      scale: Math.max(
        0.8,
        Math.min(1.35, Number(source?.dock?.scale ?? 1) || 1),
      ),
      background_opacity: Math.max(
        0,
        Math.min(
          0.65,
          Number(source?.dock?.background_opacity ?? 0.24) || 0.24,
        ),
      ),
      show_labels: source?.dock?.show_labels !== false,
      docking_enabled: source?.dock?.docking_enabled !== false,
      dock_position: dockPositions.has(
        String(source?.dock?.dock_position || ""),
      )
        ? String(source.dock.dock_position)
        : "bottom",
    },
    mic: {
      longpress_ms: Math.max(
        250,
        Math.min(3000, Number(source?.mic?.longpress_ms ?? 600) || 600),
      ),
      max_hold_sec: [3, 5, 10, 15, 30].includes(
        Number(source?.mic?.max_hold_sec),
      )
        ? Number(source.mic.max_hold_sec)
        : 30,
      logo_surface_mode: ["showcase", "mv_only"].includes(
        String(source?.mic?.logo_surface_mode || ""),
      )
        ? String(source.mic.logo_surface_mode)
        : "mv_only",
      dock_surface_mode: ["showcase", "mv_only"].includes(
        String(source?.mic?.dock_surface_mode || ""),
      )
        ? String(source.mic.dock_surface_mode)
        : "mv_only",
      settings_surface_mode: ["showcase", "mv_only"].includes(
        String(source?.mic?.settings_surface_mode || ""),
      )
        ? String(source.mic.settings_surface_mode)
        : "mv_only",
    },
    background: {
      mode: backgroundModes.has(String(source?.background?.mode || ""))
        ? String(source.background.mode)
        : "aurora",
      intensity: Math.max(
        0,
        Math.min(
          1,
          Number(source?.background?.intensity ?? 0.48) || 0.48,
        ),
      ),
      motion: Math.max(
        0,
        Math.min(1, Number(source?.background?.motion ?? 0.24) || 0.24),
      ),
    },
    cssmv: {
      default_section: ["digest", "governance", "timeline"].includes(
        String(source?.cssmv?.default_section || ""),
      )
        ? String(source.cssmv.default_section)
        : "digest",
      auto_refresh: source?.cssmv?.auto_refresh !== false,
    },
    language: {
      default_mode: ["content", "settings"].includes(
        String(source?.language?.default_mode || ""),
      )
        ? String(source.language.default_mode)
        : "content",
      show_more: !!source?.language?.show_more,
    },
    login: {
      panel_density: ["compact", "full"].includes(
        String(source?.login?.panel_density || ""),
      )
        ? String(source.login.panel_density)
        : "full",
      preferred_provider: ["google", "github", "x", "bsky", "passkey"].includes(
        String(source?.login?.preferred_provider || ""),
      )
        ? String(source.login.preferred_provider)
        : "google",
      show_logout: source?.login?.show_logout !== false,
      session_days: [30, 90, 180, 365].includes(
        Number(source?.login?.session_days),
      )
        ? Number(source.login.session_days)
        : 90,
    },
    profile: {
      panel_density: ["compact", "full"].includes(
        String(source?.profile?.panel_density || ""),
      )
        ? String(source.profile.panel_density)
        : "full",
      note: String(source?.profile?.note || "").slice(0, 120),
      default_nav: ["works", "api"].includes(
        String(source?.profile?.default_nav || ""),
      )
        ? String(source.profile.default_nav)
        : "works",
    },
    works: {
      focus_section: ["works", "comments", "monetization"].includes(
        String(source?.works?.focus_section || ""),
      )
        ? String(source.works.focus_section)
        : "works",
      auto_load: source?.works?.auto_load !== false,
      search_enabled: source?.works?.search_enabled !== false,
      search_limit: Math.max(
        4,
        Math.min(48, Number(source?.works?.search_limit ?? 12) || 12),
      ),
      default_sort: ["newest", "oldest", "title", "type"].includes(
        String(source?.works?.default_sort || ""),
      )
        ? String(source.works.default_sort)
        : "newest",
      default_filter: [
        "all",
        "single",
        "triptych",
        "opera",
        "live",
        "hidden",
      ].includes(String(source?.works?.default_filter || ""))
        ? String(source.works.default_filter)
        : "all",
    },
    seller: {
      focus_lane: ["orders", "income"].includes(
        String(source?.seller?.focus_lane || ""),
      )
        ? String(source.seller.focus_lane)
        : "orders",
      auto_refresh: source?.seller?.auto_refresh !== false,
      order_filter: ["all", "paid", "pending"].includes(
        String(source?.seller?.order_filter || ""),
      )
        ? String(source.seller.order_filter)
        : "all",
      ledger_limit: Math.max(
        4,
        Math.min(40, Number(source?.seller?.ledger_limit ?? 12) || 12),
      ),
    },
    about: {
      default_tab: ["whitepaper", "about", "contact"].includes(
        String(source?.about?.default_tab || ""),
      )
        ? String(source.about.default_tab)
        : "whitepaper",
      density: ["compact", "relaxed"].includes(
        String(source?.about?.density || ""),
      )
        ? String(source.about.density)
        : "relaxed",
    },
    api: {
      billing_mode: ["compact", "full"].includes(
        String(source?.api?.billing_mode || ""),
      )
        ? String(source.api.billing_mode)
        : "full",
      payment_method: ["card", "bank"].includes(
        String(source?.api?.payment_method || ""),
      )
        ? String(source.api.payment_method)
        : "card",
      auto_recharge: source?.api?.auto_recharge !== false,
    },
    membership: {
      starter_monthly_limit: Math.max(
        1,
        Math.min(
          1000,
          Number(source?.membership?.starter_monthly_limit ?? 30) || 30,
        ),
      ),
      pro_monthly_limit: Math.max(
        1,
        Math.min(
          5000,
          Number(source?.membership?.pro_monthly_limit ?? 100) || 100,
        ),
      ),
      studio_monthly_limit: Math.max(
        1,
        Math.min(
          10000,
          Number(source?.membership?.studio_monthly_limit ?? 300) || 300,
        ),
      ),
      enterprise_monthly_limit: Math.max(
        0,
        Math.min(
          100000,
          Number(source?.membership?.enterprise_monthly_limit ?? 0) || 0,
        ),
      ),
      vip_admin_only: source?.membership?.vip_admin_only !== false,
    },
    creator_boost: {
      enabled_kinds: Array.from(
        new Set(
          (
            Array.isArray(source?.creator_boost?.enabled_kinds)
              ? source.creator_boost.enabled_kinds.filter((item: unknown) =>
                  [
                    "language",
                    "voice",
                    "thumbnail",
                    "preview_video",
                    "generation",
                    "background_job",
                  ].includes(String(item || ""))
                )
              : ["language", "voice", "thumbnail", "preview_video", "generation", "background_job"]
          ).concat("background_job")
        )
      ),
      language_unit_cents: Math.max(
        100,
        Math.min(
          100000,
          Number(source?.creator_boost?.language_unit_cents ?? 300) || 300,
        ),
      ),
      voice_unit_cents: Math.max(
        100,
        Math.min(
          100000,
          Number(source?.creator_boost?.voice_unit_cents ?? 500) || 500,
        ),
      ),
      thumbnail_unit_cents: Math.max(
        25,
        Math.min(
          100000,
          Number(source?.creator_boost?.thumbnail_unit_cents ?? 79) || 79,
        ),
      ),
      preview_video_unit_cents: Math.max(
        25,
        Math.min(
          100000,
          Number(source?.creator_boost?.preview_video_unit_cents ?? 249) || 249,
        ),
      ),
      generation_unit_cents: Math.max(
        25,
        Math.min(
          100000,
          Number(source?.creator_boost?.generation_unit_cents ?? 99) || 99,
        ),
      ),
      background_job_unit_cents: Math.max(
        25,
        Math.min(
          100000,
          Number(source?.creator_boost?.background_job_unit_cents ?? 199) || 199,
        ),
      ),
      admin_only_purchase_override:
        !!source?.creator_boost?.admin_only_purchase_override,
      studio_includes_extra_languages: Math.max(
        0,
        Math.min(
          10,
          Number(source?.creator_boost?.studio_includes_extra_languages ?? 2) ||
            2,
        ),
      ),
      enterprise_includes_extra_languages: Math.max(
        0,
        Math.min(
          20,
          Number(
            source?.creator_boost?.enterprise_includes_extra_languages ?? 4,
          ) || 4,
        ),
      ),
      studio_includes_extra_voices: Math.max(
        0,
        Math.min(
          10,
          Number(source?.creator_boost?.studio_includes_extra_voices ?? 2) || 2,
        ),
      ),
      enterprise_includes_extra_voices: Math.max(
        0,
        Math.min(
          20,
          Number(
            source?.creator_boost?.enterprise_includes_extra_voices ?? 4,
          ) || 4,
        ),
      ),
    },
    billing_actions: {
      lyrics_generate_cents: Math.max(
        0,
        Math.min(
          100000,
          Number(source?.billing_actions?.lyrics_generate_cents ?? 20) || 20,
        ),
      ),
      music_generate_cents: Math.max(
        0,
        Math.min(
          100000,
          Number(source?.billing_actions?.music_generate_cents ?? 40) || 40,
        ),
      ),
      video_generate_cents: Math.max(
        0,
        Math.min(
          100000,
          Number(source?.billing_actions?.video_generate_cents ?? 60) || 60,
        ),
      ),
      enterprise_route_cents: Math.max(
        0,
        Math.min(
          100000,
          Number(source?.billing_actions?.enterprise_route_cents ?? 5) || 5,
        ),
      ),
      cinema_booking_cents: Math.max(
        0,
        Math.min(
          100000,
          Number(source?.billing_actions?.cinema_booking_cents ?? 0) || 0,
        ),
      ),
      included_membership_covers_core:
        source?.billing_actions?.included_membership_covers_core !== false,
    },
    studio_enterprise: {
      team_collaboration_enabled:
        !!source?.studio_enterprise?.team_collaboration_enabled,
      max_team_members: Math.max(
        1,
        Math.min(
          500,
          Number(source?.studio_enterprise?.max_team_members ?? 5) || 5,
        ),
      ),
      multi_project_enabled:
        source?.studio_enterprise?.multi_project_enabled !== false,
      max_projects: Math.max(
        1,
        Math.min(
          1000,
          Number(source?.studio_enterprise?.max_projects ?? 12) || 12,
        ),
      ),
      enterprise_api_enabled:
        !!source?.studio_enterprise?.enterprise_api_enabled,
      enterprise_api_rate_limit_per_minute: Math.max(
        1,
        Math.min(
          100000,
          Number(
            source?.studio_enterprise?.enterprise_api_rate_limit_per_minute ??
              600,
          ) || 600,
        ),
      ),
    },
    commerce: {
      payout_hold_days: Math.max(
        0,
        Math.min(
          90,
          Number(
            source?.commerce?.payout_hold_days ?? stripePayoutHoldDaysEnv(),
          ) || stripePayoutHoldDaysEnv(),
        ),
      ),
      payout_sweep_ms: Math.max(
        60_000,
        Math.min(
          24 * 60 * 60 * 1000,
          Number(
            source?.commerce?.payout_sweep_ms ?? stripePayoutSweepMsEnv(),
          ) || stripePayoutSweepMsEnv(),
        ),
      ),
      min_tip_cents: Math.max(
        100,
        Math.min(
          100_000,
          Number(source?.commerce?.min_tip_cents ?? 100) || 100,
        ),
      ),
    },
    foryou: {
      preview_mode: previewValues.has(
        String(source?.foryou?.preview_mode || ""),
      )
        ? String(source.foryou.preview_mode)
        : "auto",
      compact_after_lyrics: source?.foryou?.compact_after_lyrics !== false,
      hold_ms: Math.max(
        0,
        Math.min(30000, Number(source?.foryou?.hold_ms ?? 10000) || 10000),
      ),
      auto_watch_ms: Math.max(
        0,
        Math.min(
          30000,
          Number(source?.foryou?.auto_watch_ms ?? 10000) || 10000,
        ),
      ),
      search_enabled: source?.foryou?.search_enabled !== false,
      market_limit: Math.max(
        4,
        Math.min(48, Number(source?.foryou?.market_limit ?? 12) || 12),
      ),
      default_sort: [
        "newest",
        "oldest",
        "title",
        "listen_low",
        "listen_high",
      ].includes(String(source?.foryou?.default_sort || ""))
        ? String(source.foryou.default_sort)
        : "newest",
      default_filter: [
        "all",
        "single",
        "triptych",
        "opera",
        "owned",
        "public",
      ].includes(String(source?.foryou?.default_filter || ""))
        ? String(source.foryou.default_filter)
        : "all",
    },
    watch: {
      default_tab: watchTabs.has(String(source?.watch?.default_tab || ""))
        ? String(source.watch.default_tab)
        : "mv",
      preview_limit_sec: Math.max(
        0,
        Math.min(180, Number(source?.watch?.preview_limit_sec ?? 30) || 30),
      ),
      subtitle_scale: Math.max(
        0.8,
        Math.min(1.4, Number(source?.watch?.subtitle_scale ?? 1) || 1),
      ),
      engine_detail: ["compact", "full"].includes(
        String(source?.watch?.engine_detail || ""),
      )
        ? String(source.watch.engine_detail)
        : "full",
      show_generation_flow: !!source?.watch?.show_generation_flow,
    },
    lyrics: {
      typewriter_speed: Math.max(
        8,
        Math.min(60, Number(source?.lyrics?.typewriter_speed ?? 18) || 18),
      ),
      font_scale: Math.max(
        0.85,
        Math.min(1.4, Number(source?.lyrics?.font_scale ?? 1) || 1),
      ),
      auto_collapse: source?.lyrics?.auto_collapse !== false,
    },
    music: {
      waveform_bars: Math.max(
        12,
        Math.min(48, Number(source?.music?.waveform_bars ?? 24) || 24),
      ),
      layer_cards: Math.max(
        3,
        Math.min(8, Number(source?.music?.layer_cards ?? 5) || 5),
      ),
    },
    video: {
      storyboard_frames: Math.max(
        4,
        Math.min(16, Number(source?.video?.storyboard_frames ?? 8) || 8),
      ),
      camera_slots: Math.max(
        2,
        Math.min(8, Number(source?.video?.camera_slots ?? 4) || 4),
      ),
    },
    delivery_reports: {
      default_kind: reportKinds.has(
        String(source?.delivery_reports?.default_kind || ""),
      )
        ? String(source.delivery_reports.default_kind)
        : "briefing_pack",
      preview_expanded: !!source?.delivery_reports?.preview_expanded,
      focus_section: ["overview", "dashboard", "export", "history"].includes(
        String(source?.delivery_reports?.focus_section || ""),
      )
        ? String(source.delivery_reports.focus_section)
        : "overview",
      density: ["compact", "full"].includes(
        String(source?.delivery_reports?.density || ""),
      )
        ? String(source.delivery_reports.density)
        : "full",
    },
    delivery_ops: {
      recovery_limit: Math.max(
        4,
        Math.min(20, Number(source?.delivery_ops?.recovery_limit ?? 8) || 8),
      ),
      focus_lane: [
        "overview",
        "subscriptions",
        "logs",
        "recovery",
        "actions",
      ].includes(String(source?.delivery_ops?.focus_lane || ""))
        ? String(source.delivery_ops.focus_lane)
        : "overview",
      alert_density: ["compact", "full"].includes(
        String(source?.delivery_ops?.alert_density || ""),
      )
        ? String(source.delivery_ops.alert_density)
        : "full",
      auto_refresh: source?.delivery_ops?.auto_refresh !== false,
    },
  };
}

function decodeDataUrlToFile(dataUrl: string) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const mime = String(match[1] || "").toLowerCase();
  const encoded = String(match[2] || "");
  if (!mime || !encoded) return null;
  try {
    return {
      mime,
      buffer: Buffer.from(encoded, "base64"),
    };
  } catch {
    return null;
  }
}

function extensionForMime(mime: string, fallback = ".bin") {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
  };
  return map[String(mime || "").toLowerCase()] || fallback;
}

function slugify(value: string) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "workspace"
  );
}

function inferWorkPricingPreset(args: {
  title?: string | null | undefined;
  style?: string | null | undefined;
  workType?: unknown;
}) {
  const explicitType = normalizeWorkType(args.workType);
  if (
    args.workType !== undefined &&
    args.workType !== null &&
    String(args.workType || "").trim()
  ) {
    return pricingPresetForWorkType(explicitType);
  }
  const haystack =
    `${String(args.title || "")} ${String(args.style || "")}`.toLowerCase();
  const isOpera = /(opera|歌剧|opéra)/i.test(haystack);
  const isTriptych = /(trilogy|triptych|三部曲)/i.test(haystack);
  if (isOpera) {
    return pricingPresetForWorkType("opera");
  }
  if (isTriptych) {
    return pricingPresetForWorkType("triptych");
  }
  return pricingPresetForWorkType("single");
}

function adminEmailSet() {
  const raw = (
    process.env.ADMIN_EMAILS || "jingdudc@gmail.com,admin@cssstudio.app"
  ).trim();
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const e = normalizeEmail(part);
    if (e) set.add(e);
  }
  return set;
}

// CSSOS_PHASE2_NO_JUDGE_AS_PLAYER 20260501 #266 — Jing
// "禁止既当裁判员又当运动员. ...所有 @cssstudio.app 账户和
//  jingdudc@gmail.com 账户的作品，不可售卖，免费聆听/观看. ...
//  禁止去买断用户的作品. 不能买卖自己的作品，也不能买卖用户的作品."
//
// Single source of truth for "is this email a cssOS staff/admin
// account?". Matches the explicit allowlist (env ADMIN_EMAILS or the
// hardcoded default) AND the entire @cssstudio.app domain — any
// cssstudio.app inbox we provision for staff inherits the rule
// without manual list maintenance. Used by:
//   • work pricing setter   → force admin works to free + priceless
//   • work creation         → same default at insert time
//   • stripe checkout       → 403 if buyer is an admin
//   • works/{mine,market}   → surface is_admin_owned flag for clients
function isCssosAdminEmail(email: string | null | undefined) {
  const e = normalizeEmail(email);
  if (!e) return false;
  if (adminEmailSet().has(e)) return true;
  // Domain match: anything @cssstudio.app is staff by definition.
  const at = e.lastIndexOf("@");
  if (at >= 0) {
    const domain = e.slice(at + 1);
    if (domain === "cssstudio.app") return true;
  }
  return false;
}

function roleForEmail(email: string | null | undefined) {
  if (isCssosAdminEmail(email)) return "admin";
  return "user";
}

type MembershipTier =
  | "guest"
  | "free"
  | "starter"
  | "pro"
  | "studio"
  | "enterprise"
  | "vip"
  | "admin";

function normalizeMembershipTier(value: unknown): MembershipTier {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "free") return "free";
  if (raw === "starter") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "studio") return "studio";
  if (raw === "enterprise") return "enterprise";
  if (raw === "vip") return "vip";
  if (raw === "admin") return "admin";
  return "guest";
}

function membershipPolicyForTier(tier: MembershipTier) {
  if (tier === "admin") {
    return {
      tier,
      monthlyGenerationLimit: null as number | null,
      canSellWorks: true,
      canUseSellerPanel: true,
      canManageReports: true,
      canUseBackgroundJobs: true,
      backgroundJobLimit: null as number | null,
      backgroundConcurrentJobLimit: 8,
    };
  }
  if (tier === "vip") {
    return {
      tier,
      monthlyGenerationLimit: null as number | null,
      canSellWorks: true,
      canUseSellerPanel: true,
      canManageReports: true,
      canUseBackgroundJobs: true,
      backgroundJobLimit: 24,
      backgroundConcurrentJobLimit: 6,
    };
  }
  if (tier === "pro") {
    return {
      tier,
      monthlyGenerationLimit: 100,
      canSellWorks: true,
      canUseSellerPanel: true,
      canManageReports: false,
      canUseBackgroundJobs: true,
      backgroundJobLimit: 2,
      backgroundConcurrentJobLimit: 1,
    };
  }
  if (tier === "studio") {
    return {
      tier,
      monthlyGenerationLimit: 300,
      canSellWorks: true,
      canUseSellerPanel: true,
      canManageReports: true,
      canUseBackgroundJobs: true,
      backgroundJobLimit: 6,
      backgroundConcurrentJobLimit: 2,
    };
  }
  if (tier === "enterprise") {
    return {
      tier,
      monthlyGenerationLimit: null as number | null,
      canSellWorks: true,
      canUseSellerPanel: true,
      canManageReports: true,
      canUseBackgroundJobs: true,
      backgroundJobLimit: 20,
      backgroundConcurrentJobLimit: 4,
    };
  }
  if (tier === "starter") {
    return {
      tier,
      monthlyGenerationLimit: 30,
      canSellWorks: true,
      canUseSellerPanel: true,
      canManageReports: false,
      canUseBackgroundJobs: false,
      backgroundJobLimit: 0,
      backgroundConcurrentJobLimit: 0,
    };
  }
  if (tier === "free") {
    return {
      tier,
      monthlyGenerationLimit: 3,
      canSellWorks: false,
      canUseSellerPanel: false,
      canManageReports: false,
      canUseBackgroundJobs: false,
      backgroundJobLimit: 0,
      backgroundConcurrentJobLimit: 0,
    };
  }
  return {
    tier: "guest" as MembershipTier,
    monthlyGenerationLimit: 0,
    canSellWorks: false,
    canUseSellerPanel: false,
    canManageReports: false,
    canUseBackgroundJobs: false,
    backgroundJobLimit: 0,
    backgroundConcurrentJobLimit: 0,
  };
}

async function resolveUserAccessProfile(
  user: { id: string; email?: string | null } | null,
) {
  if (!user?.id) {
    return {
      role: "guest",
      tier: "guest" as MembershipTier,
      policy: membershipPolicyForTier("guest"),
      billingAccount: null,
    };
  }
  const role = roleForEmail(user.email);
  if (role === "admin") {
    return {
      role,
      tier: "admin" as MembershipTier,
      policy: membershipPolicyForTier("admin"),
      billingAccount: null,
    };
  }
  const { account } = await ensureBillingAccount(user.id);
  const tier = normalizeMembershipTier(account?.membership_tier || "free");
  const creatorPolicy = await getCreatorCommercePolicySettings().catch(
    () => null,
  );
  const basePolicy = membershipPolicyForTier(tier);
  const policy = creatorPolicy
    ? {
        ...basePolicy,
        monthlyGenerationLimit:
          tier === "starter"
            ? creatorPolicy.starterMonthlyLimit
            : tier === "pro"
              ? creatorPolicy.proMonthlyLimit
              : tier === "studio"
                ? creatorPolicy.studioMonthlyLimit
                : tier === "enterprise"
                  ? creatorPolicy.enterpriseMonthlyLimit
                  : basePolicy.monthlyGenerationLimit,
      }
    : basePolicy;
  return {
    role,
    tier,
    policy,
    billingAccount: account,
  };
}

async function ensureStudioWorkspaceForUser(args: {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  tier: MembershipTier;
}) {
  const policy = await getStudioEnterprisePolicySettings();
  if (!canUseStudioWorkspaceTier(args.tier)) {
    return null;
  }
  const workspaceName =
    String(args.displayName || args.email || "CSS Studio Workspace").trim() ||
    "CSS Studio Workspace";
  const queueLane = queueLaneForTier(args.tier);
  const result = await withClient(async (client) => {
    const existing = await client.query(
      `SELECT id, owner_user_id, name, slug, tier_snapshot, queue_lane, is_enterprise, meta, created_at, updated_at
       FROM studio_workspaces
       WHERE owner_user_id = $1
       LIMIT 1`,
      [args.userId],
    );
    let row = existing.rows[0];
    if (!row) {
      const inserted = await client.query(
        `INSERT INTO studio_workspaces (
           owner_user_id, name, slug, tier_snapshot, queue_lane, is_enterprise, meta
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING id, owner_user_id, name, slug, tier_snapshot, queue_lane, is_enterprise, meta, created_at, updated_at`,
        [
          args.userId,
          workspaceName,
          slugify(`${workspaceName}-${args.userId.slice(0, 8)}`),
          args.tier,
          queueLane,
          args.tier === "enterprise",
          JSON.stringify({ auto_created: true }),
        ],
      );
      row = inserted.rows[0];
    } else {
      const updated = await client.query(
        `UPDATE studio_workspaces
         SET tier_snapshot = $2,
             queue_lane = $3,
             is_enterprise = $4,
             updated_at = now()
         WHERE id = $1
         RETURNING id, owner_user_id, name, slug, tier_snapshot, queue_lane, is_enterprise, meta, created_at, updated_at`,
        [row.id, args.tier, queueLane, args.tier === "enterprise"],
      );
      row = updated.rows[0];
    }
    await client.query(
      `INSERT INTO studio_workspace_members (
         workspace_id, user_id, role, meta
       ) VALUES ($1, $2, 'owner', $3::jsonb)
       ON CONFLICT (workspace_id, user_id)
       DO UPDATE SET role = 'owner', updated_at = now()`,
      [row.id, args.userId, JSON.stringify({ auto_created: true })],
    );
    const membersRes = await client.query(
      `SELECT m.id, m.user_id, m.role, m.created_at, u.display_name, u.email, u.avatar_url
       FROM studio_workspace_members m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = $1
       ORDER BY CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END, m.created_at ASC`,
      [row.id],
    );
    const projectsRes = await client.query(
      `SELECT id, title, status, queue_lane, meta, created_at, updated_at
       FROM studio_projects
       WHERE workspace_id = $1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 24`,
      [row.id],
    );
    return {
      workspace: row,
      members: membersRes.rows,
      projects: projectsRes.rows,
      policy,
    };
  });
  return {
    ...result,
    canCollaborate: policy.teamCollaborationEnabled,
    canCreateProjects: policy.multiProjectEnabled,
  };
}

async function listEnterpriseApiUsageSnapshot(args: {
  userId: string;
  rpm: number;
}) {
  const currentMinuteRes = await withClient((client) =>
    client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM usage_events
       WHERE user_id = $1
         AND route LIKE '/api/enterprise/%'
         AND created_at >= now() - interval '1 minute'`,
      [args.userId],
    ),
  );
  const recentRes = await withClient((client) =>
    client.query(
      `SELECT id, route, units, cost_cents, created_at, meta
       FROM usage_events
       WHERE user_id = $1
         AND route LIKE '/api/enterprise/%'
       ORDER BY created_at DESC
       LIMIT 12`,
      [args.userId],
    ),
  );
  const usedThisMinute = Number(currentMinuteRes.rows[0]?.count || 0);
  return {
    rpm_limit: args.rpm,
    used_this_minute: usedThisMinute,
    remaining_this_minute: Math.max(0, args.rpm - usedThisMinute),
    recent_routes: recentRes.rows,
  };
}

async function listCinemaBookingRequests(userId: string, limit = 12) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit || 12) || 12));
  const result = await withClient((client) =>
    client.query(
      `SELECT id, status, project_title, requested_mode, requested_duration_sec, contact_email, contact_handle,
              budget_cents, brief, needs_contract, meta, created_at, updated_at
       FROM cinema_booking_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, safeLimit],
    ),
  );
  return result.rows;
}

async function enforceEnterpriseApiRoute(args: {
  userId: string;
  email?: string | null;
  tier: MembershipTier;
  route: string;
}) {
  const settings = await getStudioEnterprisePolicySettings();
  if (!settings.enterpriseApiEnabled || !canUseEnterpriseApiTier(args.tier)) {
    return {
      ok: false as const,
      code: "ENTERPRISE_API_DISABLED",
      settings,
      usage: null,
    };
  }
  const usage = await listEnterpriseApiUsageSnapshot({
    userId: args.userId,
    rpm: settings.enterpriseApiRateLimitPerMinute,
  });
  if (usage.used_this_minute >= settings.enterpriseApiRateLimitPerMinute) {
    await withClient((client) =>
      client.query(
        "INSERT INTO usage_events (user_id, route, units, cost_cents, meta) VALUES ($1,$2,$3,$4,$5)",
        [
          args.userId,
          args.route,
          1,
          0,
          JSON.stringify({
            blocked: "enterprise_rate_limit",
            tier: args.tier,
            rpm_limit: settings.enterpriseApiRateLimitPerMinute,
          }),
        ],
      ),
    );
    return {
      ok: false as const,
      code: "ENTERPRISE_API_RATE_LIMITED",
      settings,
      usage,
    };
  }
  const access = await resolveUserAccessProfile({
    id: args.userId,
    ...(args.email !== undefined ? { email: args.email } : {}),
  });
  const billing = await consumeBillableAction({
    userId: args.userId,
    access,
    actionKey: "enterprise_route",
    route: args.route,
    coveredBy: "enterprise",
    meta: {
      enterprise_api: true,
      tier: args.tier,
      queue_lane: queueLaneForTier(args.tier),
      caller_email: normalizeEmail(args.email),
    },
  });
  if (!billing.allowed) {
    return {
      ok: false as const,
      code: "ENTERPRISE_API_BILLING_BLOCKED",
      settings,
      usage,
    };
  }
  return {
    ok: true as const,
    code: "OK",
    settings,
    usage: await listEnterpriseApiUsageSnapshot({
      userId: args.userId,
      rpm: settings.enterpriseApiRateLimitPerMinute,
    }),
  };
}

function buildCssmvThumbnailPrompt(
  title: string,
  subtitle: string,
  lyrics: string[],
  visualDirective = "",
) {
  const safeTitle = String(title || "CSS MV").trim() || "CSS MV";
  const safeSubtitle = String(subtitle || "").trim();
  const safeVisualDirective = String(visualDirective || "").trim();
  const lyricExcerpt = (Array.isArray(lyrics) ? lyrics : [])
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const lyricImagery = lyricExcerpt.slice(0, 4).join(" / ");
  const lyricMood = lyricExcerpt.slice(4).join(" / ");
  const femaleOptOutSignals = [
    "不要出现美女",
    "不要美女",
    "不要女性",
    "不要女人",
    "不要女生",
    "不要女孩",
    "不要女主",
    "no woman",
    "no women",
    "no girl",
    "no girls",
    "no female",
    "without woman",
    "without women",
    "without girl",
    "without female",
  ];
  const femalePreferenceContext = [
    safeTitle,
    safeSubtitle,
    safeVisualDirective,
    lyricExcerpt.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const shouldAvoidDefaultFemaleFigure = femaleOptOutSignals.some((token) =>
    femalePreferenceContext.includes(token.toLowerCase()),
  );
  return [
    "Create a square, album-grade cover image for an original music-video work.",
    `Title: ${safeTitle}.`,
    safeSubtitle ? `Musical style and atmosphere: ${safeSubtitle}.` : "",
    safeVisualDirective ? `Additional visual direction: ${safeVisualDirective}.` : "",
    lyricImagery ? `Primary lyrical imagery: ${lyricImagery}.` : "",
    lyricMood
      ? `Secondary lyrical mood and emotional texture: ${lyricMood}.`
      : "",
    "Base the visual direction on the title and lyric imagery, not on generic karaoke UI art.",
    "Keep the cultural world coherent inside a single work. If the lyrics imply one cultural sphere, nation, dynasty, folklore, city, or civilizational setting, stay inside that same world for all variants unless the lyrics explicitly ask for cross-cultural fusion.",
    "When generating variants for one title, vary wardrobe, mood, lensing, age of styling, and composition inside the same culture rather than mixing unrelated continents, ethnic groups, or civilizational symbols into one work.",
    "Favor poetic symbolism, cinematic depth, distinct composition, strong atmosphere, refined color storytelling, and memorable visual identity.",
    "Keep the artwork feeling fresh across runs: vary aesthetic direction, styling language, camera framing, and character presentation so repeated generations do not all look like the same person or the same mood.",
    "When a human figure appears, prefer graceful, cultured, high-end editorial beauty with dignity, elegance, and emotional nuance rather than sorrowful misery.",
    "Across different generations, allow diversity in ethnicity, nationality, cultural background, fashion language, and facial features while remaining tasteful and premium.",
    "The woman, if present, may read as serene, luminous, intelligent, youthful, gently shy, subtly charming, saintly, noble, or quietly romantic. Avoid defaulting to grief-stricken, exhausted, haunted, or permanently frowning expressions unless the lyrics explicitly demand tragedy.",
    "Favor adult subjects only. Keep the portrayal non-sexual, non-exploitative, and artistically elevated.",
    shouldAvoidDefaultFemaleFigure
      ? "Do not introduce any extra female figure unless the provided lyrics or visual direction explicitly require one."
      : "Include one elegant adult woman somewhere in the composition as a tasteful supporting presence, not necessarily the protagonist. Keep her non-sexual, visually refined, naturally integrated into the scene, and vary her mood, styling, and cultural identity across generations so the artwork feels vivid, elevated, and not repetitive.",
    "Avoid bland gradients, empty placeholder circles, default mockup aesthetics, and repetitive template looks.",
    "Do not render any words, title text, subtitles, logos, watermarks, interface chrome, or typography in the image.",
  ]
    .filter(Boolean)
    .join(" ");
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const passkeyState = new Map<
  string,
  {
    challenge: string;
    kind: "register" | "login";
    expireAt: number;
  }
>();

const passkeyCreds = new Map<
  string,
  Array<{ id: string; transports?: string[] }>
>();

function cleanupPasskeyState() {
  const now = Date.now();
  for (const [k, v] of passkeyState.entries()) {
    if (v.expireAt <= now) passkeyState.delete(k);
  }
}

function currentOrigin(req: express.Request) {
  const proto =
    (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const hostHeader =
    (req.headers["x-forwarded-host"] as string | string[] | undefined) ||
    req.headers.host;
  const host = Array.isArray(hostHeader)
    ? hostHeader[0]
    : hostHeader || "localhost:3000";
  return `${proto}://${host}`;
}

function currentRpId(req: express.Request) {
  const hostHeader =
    (req.headers["x-forwarded-host"] as string | string[] | undefined) ||
    req.headers.host;
  const hostRaw = Array.isArray(hostHeader)
    ? hostHeader[0] || "localhost:3000"
    : hostHeader || "localhost:3000";
  const host = ((hostRaw.split(":")[0] ?? "localhost") as string)
    .trim()
    .toLowerCase();
  return host || "localhost";
}

function passkeySubject(
  req: express.Request,
  user: Awaited<ReturnType<typeof getSessionUser>>,
) {
  if (user?.id) {
    return {
      key: `u:${user.id}`,
      id: user.id,
      name: user.email || user.id,
      displayName: user.display_name || user.email || "CSS Studio",
    };
  }
  const existing = (req.session as any)?.passkey_subject_key;
  if (existing && typeof existing === "string" && existing.length > 0) {
    return {
      key: existing,
      id: `guest-${existing.replace(/^s:/, "")}`,
      name: `guest-${existing.replace(/^s:/, "")}`,
      displayName: "Guest",
    };
  }
  const key = `s:${req.sessionID}`;
  (req.session as any).passkey_subject_key = key;
  return {
    key,
    id: `guest-${req.sessionID}`,
    name: `guest-${req.sessionID}`,
    displayName: "Guest",
  };
}

async function listPasskeyCreds(
  subjectKey: string,
): Promise<Array<{ id: string; transports?: string[] }>> {
  if (!DATABASE_URL) {
    return passkeyCreds.get(subjectKey) || [];
  }
  type Row = { credential_id: string; transports: unknown };
  const result: QueryResult<Row> = await withClient((client) =>
    client.query<Row>(
      "SELECT credential_id, transports FROM passkey_credentials WHERE subject_key = $1 ORDER BY created_at DESC",
      [subjectKey],
    ),
  );
  return result.rows.map((r) => ({
    id: r.credential_id,
    transports: Array.isArray(r.transports)
      ? r.transports.filter((x): x is string => typeof x === "string")
      : ["internal"],
  }));
}

async function savePasskeyCred(
  subjectKey: string,
  credId: string,
  transports?: string[],
) {
  const ts =
    Array.isArray(transports) && transports.length ? transports : ["internal"];
  if (!DATABASE_URL) {
    const list = passkeyCreds.get(subjectKey) || [];
    if (!list.some((x) => x.id === credId)) {
      list.push({ id: credId, transports: ts });
      passkeyCreds.set(subjectKey, list);
    }
    return;
  }
  await withClient((client) =>
    client.query(
      `INSERT INTO passkey_credentials (subject_key, credential_id, transports, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (credential_id)
       DO UPDATE SET subject_key = EXCLUDED.subject_key, transports = EXCLUDED.transports, updated_at = now()`,
      [subjectKey, credId, JSON.stringify(ts)],
    ),
  );
}

function userSubjectKey(userId: string) {
  return `u:${userId}`;
}

function guestSubjectKeyBySession(sessionId: string) {
  return `s:${sessionId}`;
}

async function passkeyCountBySubject(subjectKey: string): Promise<number> {
  if (!DATABASE_URL) {
    return (passkeyCreds.get(subjectKey) || []).length;
  }
  type Row = { c: string };
  const result: QueryResult<Row> = await withClient((client) =>
    client.query<Row>(
      "SELECT COUNT(*)::text AS c FROM passkey_credentials WHERE subject_key = $1",
      [subjectKey],
    ),
  );
  return Number(result.rows[0]?.c || "0");
}

async function migrateGuestPasskeysToUser(sessionId: string, userId: string) {
  const fromKey = guestSubjectKeyBySession(sessionId);
  const toKey = userSubjectKey(userId);
  if (!DATABASE_URL) {
    const from = passkeyCreds.get(fromKey) || [];
    const to = passkeyCreds.get(toKey) || [];
    const seen = new Set(to.map((x) => x.id));
    for (const c of from) {
      if (!seen.has(c.id)) to.push(c);
    }
    passkeyCreds.set(toKey, to);
    passkeyCreds.delete(fromKey);
    return;
  }
  await withClient((client) =>
    client.query(
      `UPDATE passkey_credentials
       SET subject_key = $2, updated_at = now()
       WHERE subject_key = $1`,
      [fromKey, toKey],
    ),
  );
}

async function buildPasskeyRegisterOptions(req: express.Request) {
  const user = await getSessionUser(req);
  const subject = passkeySubject(req, user);
  const challenge = b64url(
    Buffer.from(crypto.randomUUID().replace(/-/g, ""), "utf8"),
  );
  passkeyState.set(subject.key, {
    challenge,
    kind: "register",
    expireAt: Date.now() + 5 * 60 * 1000,
  });
  const existing = await listPasskeyCreds(subject.key);
  return {
    publicKey: {
      challenge,
      rp: { name: "CSS Studio", id: currentRpId(req) },
      user: {
        id: b64url(subject.id),
        name: subject.name,
        displayName: subject.displayName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      timeout: 60000,
      attestation: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: existing.map((c) => ({
        id: c.id,
        type: "public-key",
        transports: c.transports || ["internal"],
      })),
    },
  };
}

async function buildPasskeyLoginOptions(req: express.Request) {
  const user = await getSessionUser(req);
  const subject = passkeySubject(req, user);
  const challenge = b64url(
    Buffer.from(crypto.randomUUID().replace(/-/g, ""), "utf8"),
  );
  passkeyState.set(subject.key, {
    challenge,
    kind: "login",
    expireAt: Date.now() + 5 * 60 * 1000,
  });
  const existing = await listPasskeyCreds(subject.key);
  return {
    publicKey: {
      challenge,
      rpId: currentRpId(req),
      timeout: 60000,
      userVerification: "preferred",
      allowCredentials: existing.map((c) => ({
        id: c.id,
        type: "public-key",
        transports: c.transports || ["internal"],
      })),
    },
    empty: existing.length === 0,
    origin: currentOrigin(req),
  };
}

function providerConfig() {
  const providers = [
    {
      id: "google",
      name: "Google",
      env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    },
    {
      id: "github",
      name: "GitHub",
      env: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
    },
    { id: "x", name: "X", env: ["X_CLIENT_ID", "X_CLIENT_SECRET"] },
    {
      id: "bsky",
      name: "Bluesky",
      env: ["BSKY_CLIENT_ID", "BSKY_CLIENT_SECRET"],
    },
    {
      id: "facebook",
      name: "Facebook",
      env: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
    },
    {
      id: "wechat",
      name: "WeChat",
      env: ["WECHAT_CLIENT_ID", "WECHAT_CLIENT_SECRET"],
    },
    {
      id: "apple",
      name: "Apple",
      env: [
        "APPLE_CLIENT_ID",
        "APPLE_TEAM_ID",
        "APPLE_KEY_ID",
        "APPLE_PRIVATE_KEY",
      ],
    },
  ];
  const generic = [
    "tiktok",
    "discord",
    "linkedin",
    "microsoft",
    "slack",
    "reddit",
    "twitch",
    "spotify",
    "gitlab",
    "bitbucket",
    "line",
    "kakao",
    "weibo",
    "qq",
    "douyin",
    "notion",
    "dropbox",
  ].map((id) => {
    const k = id.toUpperCase();
    return {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      env: [
        `${k}_CLIENT_ID`,
        `${k}_CLIENT_SECRET`,
        `${k}_AUTH_URL`,
        `${k}_TOKEN_URL`,
        `${k}_USERINFO_URL`,
      ],
    };
  });
  return [...providers, ...generic].map((provider) => {
    const enabled =
      provider.id === "bsky"
        ? (Boolean(process.env.BSKY_CLIENT_ID) &&
            Boolean(process.env.BSKY_CLIENT_SECRET)) ||
          (Boolean(process.env.BLUESKY_CLIENT_ID) &&
            Boolean(process.env.BLUESKY_CLIENT_SECRET)) ||
          (Boolean(process.env.BLUESKY_HANDLE) &&
            Boolean(process.env.BLUESKY_APP_PASSWORD))
        : provider.env.every((key) => Boolean(process.env[key]));
    return {
      id: provider.id,
      name: provider.name,
      enabled,
      url: enabled ? `/auth/${provider.id}` : "",
    };
  });
}

function authProviderDiagnostics(providerId: string, req: express.Request) {
  const providers = providerConfig();
  const provider = providers.find((item) => item.id === providerId);
  const githubCallbackUrl =
    process.env.GITHUB_REDIRECT_URI ||
    `${appBaseUrl(req)}/api/auth/github/callback`;
  const missingEnv =
    providerId === "github"
      ? ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"].filter(
          (key) => !process.env[key],
        )
      : providerId === "google"
        ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter(
            (key) => !process.env[key],
          )
        : [];

  return {
    provider: providerId,
    enabled: Boolean(provider?.enabled),
    missing_env: missingEnv,
    start_url: provider?.enabled ? `${appBaseUrl(req)}/auth/${providerId}` : "",
    callback_url:
      providerId === "github"
        ? githubCallbackUrl
        : `${appBaseUrl(req)}/auth/${providerId}/callback`,
  };
}

function handleAuthDiagnostics(req: express.Request, res: express.Response) {
  noStore(res);
  const providerId = String(req.query.provider || "")
    .trim()
    .toLowerCase();
  if (providerId) {
    return res.json(
      okData({ diagnostic: authProviderDiagnostics(providerId, req) }),
    );
  }

  return res.json(
    okData({
      diagnostics: providerConfig().map((provider) =>
        authProviderDiagnostics(provider.id, req),
      ),
    }),
  );
}

async function handleGitHubAuthStart(
  req: express.Request,
  res: express.Response,
) {
  noStore(res);
  try {
    res.setHeader("X-GitHub-Flow-Version", "no-redirect-uri");
    const clientId = process.env.GITHUB_CLIENT_ID || "";
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
    if (!clientId || !clientSecret)
      return res.status(503).send("github_not_configured");
    const state = randomHex(16);
    setOAuthState(req, "github", { state, createdAt: Date.now() });
    const q = new URLSearchParams({
      client_id: clientId,
      scope: "read:user user:email",
      state,
    });
    return res.redirect(
      302,
      `https://github.com/login/oauth/authorize?${q.toString()}`,
    );
  } catch {
    return res.status(500).send("github_auth_start_failed");
  }
}

const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

type OAuthSessionState = {
  state: string;
  nonce?: string;
  codeVerifier?: string;
  userId?: string;
  createdAt: number;
};

function setOAuthState(
  req: express.Request,
  provider: string,
  state: OAuthSessionState,
) {
  const k = `oauth_state_${provider}`;
  (req.session as any)[k] = state;
}

function getOAuthState(
  req: express.Request,
  provider: string,
): OAuthSessionState | null {
  const k = `oauth_state_${provider}`;
  const v = (req.session as any)[k];
  (req.session as any)[k] = null;
  if (!v || typeof v !== "object") return null;
  return v as OAuthSessionState;
}

function randomHex(n = 16) {
  return crypto.randomBytes(n).toString("hex");
}

function codeChallengeS256(verifier: string) {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return b64url(hash);
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, json: j };
}

function buildCssmvSongSeedPrompt(input: {
  mode: string;
  transcript: string;
  title: string;
  style: string;
  voice: string;
  language: string;
  variationNonce?: string;
  constraints?: Record<string, unknown>;
}) {
  const language = input.language || "zh";
  const mode = input.mode || "music_video";
  const hasTranscript = Boolean(input.transcript);
  const hasTitle = Boolean(input.title);
  const kind =
    mode === "microdrama"
      ? "microdrama episode seed"
      : mode === "series"
        ? "series episode seed"
        : mode === "cinema"
          ? "cinema scene seed"
          : "single song or opera seed";
  const blueprint = buildCssmvCreativeBlueprint(input);
  const canonProfile = detectCssmvCanonProfile(input);
  const structurePlan = normalizeSongSeedStructurePlan(
    input.constraints?.structure_plan,
  );
  const languageDirective = String(language).toLowerCase().startsWith("ja")
    ? "Write the lyrics almost entirely in natural Japanese. Do not output an English lyric body. Sparse loanwords are acceptable, but the actual sung lines, crowd lines, and emotional core must read as Japanese."
    : String(language).toLowerCase().startsWith("zh")
      ? "Write the lyrics almost entirely in natural Chinese. Do not output an English lyric body. The actual sung lines, crowd lines, and emotional core must read as Chinese."
      : "Write the lyrics almost entirely in natural English. Do not switch the lyric body into Chinese or Japanese.";
  const titleDirective = String(language).toLowerCase().startsWith("ja")
    ? "If the user did not provide a title, invent the main title in Japanese first. Do not default to an English title for a Japanese lyric unless the user explicitly requested it."
    : String(language).toLowerCase().startsWith("zh")
      ? "If the user did not provide a title, invent the main title in Chinese first. Do not default to an English title for a Chinese lyric unless the user explicitly requested it."
      : "If the user did not provide a title, invent the main title in natural English first.";
  const constraintBlock = formatSongSeedConstraintBlock(input.constraints);

  return [
    "You are generating a cssMV creative seed in Du Jing's classic sacred-lyric template.",
    `Target language: ${language}.`,
    `Mode: ${mode}.`,
    `Creative kind: ${kind}.`,
    `Style hint: ${input.style || "auto"}.`,
    `Voice hint: ${input.voice || "auto"}.`,
    hasTitle
      ? `Use this exact title as the song title: ${input.title}.`
      : "Invent an original, memorable title suitable for a released single or lyrical opera piece.",
    hasTranscript
      ? `Use this transcript as inspiration:\n${input.transcript}`
      : "No voice transcript is available. Invent a fresh concept instead of using placeholder titles such as Untitled.",
    constraintBlock ||
      "User constraints are sparse. You may invent the missing details, but they still need to feel coherent with one another.",
    input.variationNonce
      ? `Variation nonce: ${input.variationNonce}. Treat this as a hard command to generate a genuinely different song family, not a paraphrase of a previous draft. Preserve the title and language, but change the world, imagery, emotional arc, diction, and hook behavior.`
      : "Generate a fresh but coherent variation.",
    [
      "Creative divergence blueprint for this attempt:",
      `- Seed tag: ${blueprint.seedTag}`,
      `- Creative family: ${blueprint.familyLabel}`,
      `- Story world: ${blueprint.storyWorld}`,
      `- Civilization atmosphere: ${blueprint.civilizationAtmosphere}`,
      `- Cultural habits: ${blueprint.culturalHabits.join(", ")}`,
      `- Narrator lens: ${blueprint.narratorLens}`,
      `- Emotional weather: ${blueprint.emotionalWeather}`,
      `- Refrain behavior: ${blueprint.refrainBehavior}`,
      `- Section organization: ${blueprint.structureMutation}`,
      `- Language and style blend: ${blueprint.languageStyleMix}`,
      `- Visual grammar: ${blueprint.visualGrammar}`,
      `- Sound pressure: ${blueprint.soundPressure}`,
      `- Imagery anchors: ${blueprint.imageryAnchors.join(", ")}`,
      `- Diction rules: ${blueprint.dictionRules.join(" / ")}`,
      `- Avoid this stale pattern: ${blueprint.antiTemplate}`,
    ].join("\n"),
    canonProfile
      ? [
          "Canon-lock rules for this attempt:",
          "- This request is locked to Westworld prelude canon. Do not reinterpret it into another creative family.",
          "- The lyrics, music plan, and video script must stay inside android creation, laboratory ritual, player piano machinery, sterile corridors, mechanical horses, memory loops, and awakening consciousness.",
          "- Forbid rooftop resistance, street protest, poster culture, megaphones, convenience-store heartbreak, and neon-uprising imagery.",
          "- Keep the emotional tone cold, surgical, restrained, and existential.",
          "- Make this package formal long-form work material rather than a short validation vignette.",
        ].join("\n")
      : "",
    [
      "Return JSON only with fields:",
      "title: string",
      "lyrics: string",
      "music_style: string",
      "references: string[]",
      "music_structure: string",
      "video_outline: string",
      "section_prompts: { section: string, title: string, prompt: string }[]",
      "section_beats: { section: string, title: string, bars: number, energy: string, focus: string, visual_role: string }[]",
      "style_tags: string[]",
    ].join("\n"),
    "Lyrics rules:",
    `- ${languageDirective}`,
    `- ${titleDirective}`,
    "- If the user provided a title, treat it as law. Do not rename it, reinterpret it away, or switch it into a different language.",
    "- The work_type user constraint is mandatory. If work_type is triptych, generate a triptych concept rather than collapsing it into a single-song framing. If work_type is opera, generate an opera concept rather than collapsing it into a single-song framing.",
    ...(structurePlan?.targetPartNumber
      ? [
          `- structure_plan is mandatory for this attempt. Generate only Part ${structurePlan.targetPartNumber} of ${structurePlan.totalParts || 3}. Do not jump to other parts in this attempt.`,
        ]
      : []),
    ...(structurePlan?.targetActNumber
      ? [
          `- structure_plan is mandatory for this attempt. Generate only Act ${structurePlan.targetActNumber || 1}, Scene ${structurePlan.sceneStart || 1}-${structurePlan.sceneEnd || structurePlan.sceneStart || structurePlan.scenesPerBatch || 1}.`,
          "- Do not restart the opera from Scene 1 if structure_plan asks for a later window, and do not leak scenes from other acts into this attempt.",
        ]
      : []),
    "- The title, lyric imagery, music style, instrumentation, and emotional arc must all point to the same world. They cannot feel like separate random buckets.",
    "- If the language is Japanese, keep the lyric body, imagery, instrumentation, and vocal phrasing plausibly Japanese unless the user explicitly requested cross-cultural fusion. Never overwrite a user-provided title.",
    "- If the language is Chinese, keep the lyric body, imagery, instrumentation, and vocal phrasing plausibly Chinese unless the user explicitly requested cross-cultural fusion. Never overwrite a user-provided title.",
    "- If the language is English, keep the lyric body naturally English unless the user explicitly requested multilingual mixing. Never overwrite a user-provided title.",
    "- Obey every explicit user constraint. Only randomize the fields the user did not specify.",
    "- Never output a title in one language while the lyric body is in another language by accident.",
    "- Write complete lyrics, not an outline.",
    "- Keep them singable and emotionally coherent.",
    "- The lyrics must feel like a brand-new finished song, not a rewrite of a stock template.",
    "- The title may stay the same across attempts, but the meaning of the title can be reinterpreted in a radically new way each time.",
    "- Do not recycle stock cosmic-hymn phrasing, generic destiny language, or merely swap a few title-related nouns.",
    "- Randomize the theme universe, civilization atmosphere, cultural habits, narrator stance, mood field, and language texture according to the blueprint.",
    "- The society around the song must feel different each time: different rituals, gestures, objects, etiquette, and social rules.",
    "- The lyrics must contain the full standard section sequence including Intro and Outro for downstream compatibility.",
    "- If the concept naturally expands into a triptych or opera, the package must still present a strong parent title and every internal unit must have its own explicit title. No unnamed parts, unnamed acts, or unnamed scenes are allowed.",
    "- Every section must have an explicit section header.",
    "- Use this section order exactly: [Intro], [Verse 1], [Verse 2], [Chorus 1], [Verse 3], [Verse 4], [Chorus 2], [Bridge], [Chorus 3], [Chorus 4], [Outro].",
    "- Use ASCII square brackets for every section header, for example [Verse 1: Moonlit Oath].",
    "- Use Du Jing's sacred lyric discipline: Verse 1, Verse 2, Chorus 1, Verse 3, Verse 4, Chorus 2, Bridge, Chorus 3, Chorus 4, and Outro should each feel like a completed lyrical scene rather than a note dump.",
    "- For Verse 1, Verse 2, Verse 3, Verse 4, Chorus 1, Chorus 2, Bridge, Chorus 3, Chorus 4, and Outro, aim for four narrative lines plus one response / incantation line from the civilization's original tongue or ritual speech.",
    "- When you include an incantation or response line, place an English translation in square brackets at the end of that line or immediately after it.",
    "- Put musical background, style, instrumentation, and stage feeling into music_style, music_structure, video_outline, section_prompts, and section_beats so the whole package stays coherent.",
    "- Return exactly 11 section_prompts entries, one for each section including [Intro] and [Outro].",
    "- Return exactly 11 section_beats entries, aligned one-to-one with the section order.",
    "- Every section_prompts.title value must be non-empty, original, and usable as a scene title in the UI.",
    "- Every section_beats.title value must be non-empty, original, and aligned with the matching section prompt title.",
    "- Every lyrical section except Intro must include a subsection title after the colon, for example [Verse 2: Lanterns Over the River]. The subsection titles themselves must be original and specific to this attempt.",
    "- Put each sung lyric sentence on its own line. Do not merge multiple lyrical sentences into one long wrapped paragraph.",
    "- Keep the required section order, but vary the internal paragraph feel: some attempts should use compact lines, some longer cinematic lines, some call-and-response, some confession, some crowd speech.",
    "- Chorus 1, Chorus 2, Chorus 3, and Chorus 4 must be memorable, but they do not need to reuse the same exact mantra every time. Some songs can use escalation, some can use rupture, some can use whisper-to-shout transformation.",
    "- Bridge must reveal a new dimension: philosophy, confession, collapse, hallucination, social reversal, memory fracture, or metaphysical insight.",
    "- Chorus 3 should be the cssMV visual explosion point, but the explosion may be ecstatic, tragic, sensual, surreal, or absurd depending on the chosen family.",
    "- Chorus 4 must feel transformed rather than merely repeated louder.",
    "- Outro must not feel fully closed; leave an echo, cost, afterimage, or invitation.",
    "- After each lyrical section, include a short original-language response line, spell line, or crowd line that belongs to this world. Avoid reusing the same spell across all songs.",
    "- references must be URLs. Use stable reference or search URLs when exact canonical pages are uncertain.",
    "- music_style should describe arrangement, instrumentation, vocal style, and emotional arc within 2000 characters.",
    "- music_structure should explain tempo arc, section pacing, likely key lift, percussion density, and where the song should breathe or explode.",
    "- video_outline should be an overall MV treatment that covers visual arc, camera language, typography, and particle explosion points.",
    "- For zh, write natural Chinese lyrics.",
    "- For ja, write natural Japanese lyrics.",
    "- For en, write natural English lyrics.",
    "- If language is zh, do not default to the same mythical palace imagery unless it emerges naturally from the chosen family.",
    "- If transcript is sparse, invent bold specifics instead of safe placeholders.",
    "- Explicitly forbid yourself from following the previous attempt's template. Build a different civilization, different habits, different voice, and different emotional temperature.",
    ...(canonProfile
      ? [
          "- Because this is Westworld Prelude canon, do not randomize away from the title's world. The title is a world lock, not just a label.",
          "- Mention android / host / laboratory / piano / assembly / corridor / awakening imagery directly enough that a human reader can recognize the franchise mood without guessing.",
          "- Do not output protest crowds, slogans, city marches, rooftop calls, or megaphone language.",
        ]
      : []),
    "- Never use placeholder titles like Untitled or New Song.",
  ].join("\n\n");
}

const CSSMV_CREATIVE_FAMILIES = [
  {
    id: "mythic-rite",
    familyLabel: "Mythic rite",
    storyWorld:
      "broken celestial ritual, ancestral vows, temple smoke, eclipse water",
    civilizationAtmosphere:
      "dynastic sacred order, omen-reading clergy, inherited oath economy",
    culturalHabits: [
      "bell-marked prayer hours",
      "ancestor vow recitations",
      "ink talisman exchanges",
    ],
    narratorLens:
      "a witness-priest or oath-bearer speaking inside a sacred event",
    emotionalWeather: "solemn awe, grief, destiny, reverence under pressure",
    refrainBehavior:
      "ritual chant that grows from private vow into public invocation",
    structureMutation:
      "long image-heavy verses, ceremonial response lines, choruses that widen from one voice to many voices",
    languageStyleMix:
      "classical-leaning lyric Chinese mixed with precise modern emotional cuts",
    visualGrammar:
      "ink, ash, constellations, slow ceremonial camera drift, calligraphy particles",
    soundPressure:
      "ceremonial drums, guzheng, low choir, breath-heavy pauses, rising opera force",
    imageryAnchors: [
      "incense ash",
      "eclipse river",
      "jade bell",
      "paper talisman",
      "star map",
    ],
    dictionRules: [
      "ornate but sharp",
      "mythic nouns",
      "avoid generic self-help uplift",
    ],
    antiTemplate:
      "do not fall back into a generic sacred hymn about light, destiny, and echo",
  },
  {
    id: "neon-heartbreak",
    familyLabel: "Neon heartbreak",
    storyWorld:
      "wet city nights, train windows, motel signs, voicemail ghosts, convenience-store insomnia",
    civilizationAtmosphere:
      "late-capital city loneliness, transit routines, sleepless service culture",
    culturalHabits: [
      "missed-call rituals",
      "midnight convenience-store confessions",
      "platform departures without closure",
    ],
    narratorLens:
      "a bruised first-person singer talking to an absent lover or their own afterimage",
    emotionalWeather: "intimate ache, anger, hunger, glamour, emotional static",
    refrainBehavior: "hook line mutates each chorus as obsession spirals",
    structureMutation:
      "short confessional verse lines, punchier pre-hook turns, choruses that keep rewriting the same promise",
    languageStyleMix:
      "plain conversational slang fused with sharp poetic fragments",
    visualGrammar:
      "chromatic blur, handheld closeups, sodium reflections, CRT bloom, rain streaks",
    soundPressure:
      "alt-pop pulse, synth bass, glassy pads, intimate verse whispers, explosive choruses",
    imageryAnchors: [
      "exit sign",
      "wet taxi",
      "answering machine",
      "broken lipstick",
      "subway sparks",
    ],
    dictionRules: [
      "conversational",
      "specific urban detail",
      "sharp emotional verbs",
    ],
    antiTemplate: "do not drift into mythic temples or cosmic fate language",
  },
  {
    id: "gravity-fiction",
    familyLabel: "Gravity fiction",
    storyWorld:
      "orbital debris, artificial dawns, failed transmissions, cryo dreams, machine prayer",
    civilizationAtmosphere:
      "post-earth orbital diaspora, machine-maintained survival, protocol-heavy life support culture",
    culturalHabits: [
      "shift-change signal logs",
      "oxygen ration vows",
      "transmission memorials",
    ],
    narratorLens:
      "a pilot, android, or stranded lover speaking across impossible distance",
    emotionalWeather: "wonder, loneliness, survival panic, cold tenderness",
    refrainBehavior:
      "signal phrase repeats with escalating transmission distortion",
    structureMutation:
      "compressed technical verses, sudden wide-open choruses, bridge as system failure or truth leak",
    languageStyleMix:
      "science-fiction terminology braided with intimate confession",
    visualGrammar:
      "weightless spins, HUD typography, fracture light, vacuum silence, engine bloom",
    soundPressure:
      "hybrid cinematic electronic, sub pulses, granular texture, choir through static",
    imageryAnchors: [
      "airlock frost",
      "red warning light",
      "burned signal",
      "orbit debris",
      "oxygen bloom",
    ],
    dictionRules: [
      "precise sci-fi detail",
      "lyrical but technical",
      "strong verbs",
    ],
    antiTemplate: "do not collapse into vague stars-and-dreams language",
  },
  {
    id: "pastoral-memory",
    familyLabel: "Pastoral memory",
    storyWorld:
      "river towns, harvest dust, cicadas, old kitchens, handwritten letters, vanished summers",
    civilizationAtmosphere:
      "small-town seasonal life, intergenerational domestic rhythm, handmade memory culture",
    culturalHabits: [
      "shared summer meals",
      "letter folding rituals",
      "porch-light waiting",
    ],
    narratorLens:
      "someone singing from memory to a person, place, or younger self",
    emotionalWeather:
      "tenderness, regret, warmth, distance, late-afternoon ache",
    refrainBehavior: "chorus becomes a remembered phrase everyone once knew",
    structureMutation:
      "roomy narrative verses, fewer words per line, choruses that land like remembered sayings",
    languageStyleMix:
      "simple spoken phrasing with sensory detail and quiet metaphor",
    visualGrammar:
      "sun-faded film grain, long lenses, cloth movement, quiet domestic detail",
    soundPressure:
      "folk-pop strings, soft percussion, room ambience, communal chorus lift",
    imageryAnchors: [
      "rusted gate",
      "rice field wind",
      "yellow lamp",
      "old radio",
      "laundry line",
    ],
    dictionRules: [
      "plain-spoken poetry",
      "sensory memory",
      "small details over abstraction",
    ],
    antiTemplate: "do not turn this into an anthem about destiny or apocalypse",
  },
  {
    id: "surreal-cabaret",
    familyLabel: "Surreal cabaret",
    storyWorld:
      "mirrors, velvet smoke, absurd theater props, masked dancers, impossible rooms",
    civilizationAtmosphere:
      "decadent performance society, rumor markets, ritualized seduction and spectacle",
    culturalHabits: [
      "mask exchanges",
      "roulette toasts",
      "audience-response cues",
    ],
    narratorLens:
      "a ringmaster, temptress, trickster, or unreliable lover performing directly at the listener",
    emotionalWeather: "seduction, menace, wit, delirium, playful dread",
    refrainBehavior: "choruses become theatrical commands or audience spells",
    structureMutation:
      "snapped-off verse phrases, stage-direction intrusions, choruses built like commands or applause traps",
    languageStyleMix:
      "showbiz imperatives, decadent imagery, sly humor, knife-edge flirtation",
    visualGrammar:
      "stage reveals, snap zooms, ornate typography, shadow play, impossible set changes",
    soundPressure:
      "cabaret drums, bass clarinet, glam strings, sudden drops, dramatic vocal ad-libs",
    imageryAnchors: [
      "roulette rose",
      "mirror teeth",
      "silk gloves",
      "gold dust",
      "paper crown",
    ],
    dictionRules: [
      "theatrical imperatives",
      "surprise imagery",
      "dark humor allowed",
    ],
    antiTemplate: "do not write this as a noble heroic ballad",
  },
  {
    id: "riot-romance",
    familyLabel: "Riot romance",
    storyWorld:
      "street marches, rooftop speakers, flare smoke, mutual rescue, coded posters",
    civilizationAtmosphere:
      "movement culture, improvised mutual aid, surveillance pressure, collective defiance",
    culturalHabits: [
      "poster code phrases",
      "rooftop lookout shifts",
      "shared route changes under pressure",
    ],
    narratorLens:
      "a singer inside a collective uprising who is also protecting one intimate bond",
    emotionalWeather:
      "defiance, adrenaline, tenderness, urgency, collective heat",
    refrainBehavior:
      "crowd-response chorus that turns private love into public refusal",
    structureMutation:
      "fast forward-driving verses, shouted pickups, choruses written for a crowd answer",
    languageStyleMix:
      "direct street language mixed with intimate declarations and urgent slogans",
    visualGrammar:
      "running camera, flare trails, stencils, crowd typography, siren color contrast",
    soundPressure:
      "percussive stomp, live drums, shouted gang vocals, guitar and brass hits",
    imageryAnchors: [
      "flare smoke",
      "poster paste",
      "rooftop antenna",
      "megaphone hiss",
      "street sparks",
    ],
    dictionRules: [
      "direct language",
      "collective verbs",
      "romance inside motion",
    ],
    antiTemplate: "do not soften this into generic inspirational positivity",
  },
] as const;

function hashCssmvSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

const CSSMV_STALE_TITLE_BLOCKLIST = ["玉京长歌"];
const CSSMV_STALE_PHRASE_BLOCKLIST = [
  "不是口号",
  "先露出侧脸",
  "roulette rose",
  "Surreal cabaret",
];

function buildCssmvDynamicTitle(
  blueprint: ReturnType<typeof buildCssmvCreativeBlueprint>,
  language: string,
) {
  const zh = String(language || "zh")
    .toLowerCase()
    .startsWith("zh");
  const ja = String(language || "zh")
    .toLowerCase()
    .startsWith("ja");
  if (ja) {
    const titleBanks = {
      "mythic-rite": {
        lead: ["月読", "星祷", "鈴焔", "天廟", "潮鐘", "霧殿", "祭灯", "雲札"],
        tail: [
          "の誓い",
          "の余響",
          "の夜航",
          "の灯火",
          "の記憶",
          "の断章",
          "の潮汐",
          "の祈り",
        ],
      },
      "neon-heartbreak": {
        lead: [
          "雨窓",
          "終電",
          "深夜",
          "残光",
          "空駅",
          "灯街",
          "静電",
          "夜更け",
        ],
        tail: [
          "の未読",
          "の微熱",
          "の失声",
          "の残響",
          "の回線",
          "の別れ",
          "の低音",
          "の余白",
        ],
      },
      "gravity-fiction": {
        lead: [
          "軌道",
          "無重力",
          "星港",
          "赤方",
          "船窓",
          "冷槽",
          "深空",
          "回路",
        ],
        tail: [
          "の漂流",
          "の帰還",
          "の脈動",
          "の静圧",
          "の残波",
          "の通信",
          "の夜航",
          "の記録",
        ],
      },
      "pastoral-memory": {
        lead: ["川灯", "蝉夏", "稲風", "夕灶", "木窓", "橋影", "茶煙", "黄灯"],
        tail: [
          "の便り",
          "の帰路",
          "の余温",
          "の晩鐘",
          "の夏影",
          "の暮色",
          "の夢路",
          "の遠音",
        ],
      },
      "surreal-cabaret": {
        lead: ["鏡幕", "絹灯", "夜席", "紙冠", "幻灯", "暗場", "珠幕", "側幕"],
        tail: [
          "の囁き",
          "の返幕",
          "の残香",
          "の微光",
          "の余興",
          "の退場",
          "の迷路",
          "の私語",
        ],
      },
      "riot-romance": {
        lead: ["街灯", "火線", "屋上", "旗影", "夜奔", "煙灯", "路標", "群青"],
        tail: [
          "の共振",
          "の逆風",
          "の余火",
          "の誓約",
          "の呼声",
          "の奔流",
          "の接吻",
          "の残火",
        ],
      },
    };
    const bank =
      titleBanks[blueprint.id as keyof typeof titleBanks] ||
      titleBanks["mythic-rite" as keyof typeof titleBanks];
    const lead =
      bank.lead[blueprint.hash % bank.lead.length] || bank.lead[0] || "星歌";
    const tail =
      bank.tail[Math.floor(blueprint.hash / 11) % bank.tail.length] ||
      bank.tail[0] ||
      "の歌";
    return `${lead}${tail}`;
  }
  const titleBanks = zh
    ? {
        "mythic-rite": {
          lead: [
            "玄钟",
            "瑶台",
            "星诏",
            "天阙",
            "烬河",
            "霜铃",
            "潮灯",
            "夜坛",
            "云篆",
            "祭潮",
            "山祷",
            "月碑",
          ],
          tail: [
            "回潮",
            "断誓",
            "夜谕",
            "遗烬",
            "长汐",
            "远响",
            "归潮",
            "余照",
            "隐歌",
            "落谶",
            "回铭",
            "沉钟",
          ],
        },
        "neon-heartbreak": {
          lead: [
            "霓虹",
            "末班",
            "空站",
            "雨幕",
            "旧屏",
            "余电",
            "夜窗",
            "慢街",
            "孤站",
            "灯影",
            "碎讯",
            "残照",
          ],
          tail: [
            "未接",
            "失真",
            "回音",
            "余温",
            "慢闪",
            "断讯",
            "空白",
            "回拨",
            "潮湿",
            "低烧",
            "返场",
            "静音",
          ],
        },
        "gravity-fiction": {
          lead: [
            "轨道",
            "失重",
            "晨轨",
            "氧焰",
            "冷舱",
            "星港",
            "回路",
            "赤移",
            "舷窗",
            "空舱",
            "霜轨",
            "深空",
          ],
          tail: [
            "漂流",
            "回讯",
            "静压",
            "残频",
            "夜航",
            "返照",
            "返讯",
            "低温",
            "回声",
            "余波",
            "断链",
            "潮汐",
          ],
        },
        "pastoral-memory": {
          lead: [
            "河灯",
            "旧埠",
            "蝉夏",
            "稻风",
            "晚灶",
            "黄灯",
            "旧巷",
            "暮雨",
            "木窗",
            "桥影",
            "晚潮",
            "茶烟",
          ],
          tail: [
            "慢信",
            "旧梦",
            "余响",
            "回南",
            "晚晴",
            "潮生",
            "旧事",
            "归路",
            "余温",
            "暮色",
            "迟夏",
            "回声",
          ],
        },
        "surreal-cabaret": {
          lead: [
            "镜厅",
            "绒幕",
            "纸冠",
            "暗场",
            "夜戏",
            "金粉",
            "偏厅",
            "幻灯",
            "暗吻",
            "侧幕",
            "夜牌",
            "珠幕",
          ],
          tail: [
            "私咒",
            "换幕",
            "回眸",
            "幻席",
            "偏光",
            "退场",
            "余兴",
            "返场",
            "私语",
            "落幕",
            "残妆",
            "旧梦",
          ],
        },
        "riot-romance": {
          lead: [
            "火线",
            "屋顶",
            "街电",
            "海报",
            "号角",
            "风灯",
            "夜奔",
            "街旗",
            "热流",
            "路标",
            "侧街",
            "烟灯",
          ],
          tail: [
            "并肩",
            "余热",
            "同途",
            "回燃",
            "夜奔",
            "共振",
            "回火",
            "呼喊",
            "潮声",
            "照面",
            "逆风",
            "余烬",
          ],
        },
      }
    : {
        "mythic-rite": {
          lead: [
            "Jade",
            "Astral",
            "Temple",
            "Ashen",
            "Bell",
            "Eclipse",
            "Votive",
            "Ember",
            "Oracle",
            "Moonlit",
            "Tidal",
            "Cinder",
          ],
          tail: [
            "Vow",
            "Tide",
            "Edict",
            "Afterglow",
            "Echo",
            "Undertow",
            "Script",
            "Requiem",
            "Undersong",
            "Omen",
            "Lantern",
            "Undercurrent",
          ],
        },
        "neon-heartbreak": {
          lead: [
            "Neon",
            "Midnight",
            "Platform",
            "Static",
            "Rain",
            "Motel",
            "Taxi",
            "Velvet",
            "Signal",
            "Backseat",
            "Window",
            "Sleepless",
          ],
          tail: [
            "Voicemail",
            "Afterheat",
            "Blur",
            "Disconnect",
            "Echo",
            "Spark",
            "Lowlight",
            "Fever",
            "Replay",
            "Undertone",
            "Callback",
            "Shadow",
          ],
        },
        "gravity-fiction": {
          lead: [
            "Orbit",
            "Oxygen",
            "Signal",
            "Airlock",
            "Redshift",
            "Drift",
            "Telemetry",
            "Cryo",
            "Vacuum",
            "Hull",
            "Starport",
            "Zero-G",
          ],
          tail: [
            "Bloom",
            "Lifeline",
            "Afterburn",
            "Telemetry",
            "Undersky",
            "Return",
            "Undercurrent",
            "Static",
            "Pulse",
            "Wake",
            "Relay",
            "Fallback",
          ],
        },
        "pastoral-memory": {
          lead: [
            "River",
            "Harvest",
            "Porchlight",
            "Cicada",
            "Lantern",
            "Letter",
            "Kitchen",
            "Dust",
            "Woodsmoke",
            "Willow",
            "Evening",
            "Window",
          ],
          tail: [
            "Memory",
            "Afterglow",
            "Return",
            "Softfall",
            "Summer",
            "Undertide",
            "Homecoming",
            "Lowlight",
            "Undersong",
            "Rain",
            "Drift",
            "Keep",
          ],
        },
        "surreal-cabaret": {
          lead: [
            "Velvet",
            "Mirror",
            "Paper",
            "Shadow",
            "Gold",
            "Mask",
            "Silk",
            "Candle",
            "Phantom",
            "Cabaret",
            "Private",
            "Gilded",
          ],
          tail: [
            "Spell",
            "Curtain",
            "Turn",
            "Whisper",
            "Riot",
            "Encore",
            "Exit",
            "Murmur",
            "Afterparty",
            "Glare",
            "Riddle",
            "Bloom",
          ],
        },
        "riot-romance": {
          lead: [
            "Flare",
            "Poster",
            "Rooftop",
            "March",
            "Siren",
            "Spark",
            "Beacon",
            "Crowd",
            "Signal",
            "Laneway",
            "Static",
            "Streetlight",
          ],
          tail: [
            "Promise",
            "Signal",
            "Heartbeat",
            "Afterglow",
            "Route",
            "Rescue",
            "Uprising",
            "Return",
            "Undertone",
            "Rush",
            "Bond",
            "Ember",
          ],
        },
      };
  const bank =
    titleBanks[blueprint.id as keyof typeof titleBanks] ||
    titleBanks["mythic-rite" as keyof typeof titleBanks];
  const lead =
    bank.lead[blueprint.hash % bank.lead.length] || bank.lead[0] || "CSS";
  const tail =
    bank.tail[Math.floor(blueprint.hash / 11) % bank.tail.length] ||
    bank.tail[0] ||
    "MV";
  return zh ? `${lead}${tail}` : `${lead} ${tail}`;
}

function titleMatchesTargetLanguage(title: string, language: string) {
  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle) return false;
  const latin = (normalizedTitle.match(/[A-Za-z]/g) || []).length;
  const han = (normalizedTitle.match(/[\u4E00-\u9FFF]/g) || []).length;
  const hiraKata = (normalizedTitle.match(/[\u3040-\u30FF]/g) || []).length;
  const normalizedLanguage = String(language || "zh").toLowerCase();
  if (normalizedLanguage.startsWith("ja")) {
    return hiraKata + han >= Math.max(2, latin);
  }
  if (normalizedLanguage.startsWith("zh")) {
    return han >= Math.max(2, latin);
  }
  return latin >= Math.max(2, han + hiraKata);
}

function formatSongSeedConstraintBlock(constraints?: Record<string, unknown>) {
  if (!constraints || typeof constraints !== "object") return "";
  const rows = Object.entries(constraints)
    .map(([key, value]) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "string" && !value.trim()) return "";
      if (typeof value === "object") {
        try {
          return `- ${key}: ${JSON.stringify(value)}`;
        } catch {
          return "";
        }
      }
      return `- ${key}: ${String(value)}`;
    })
    .filter(Boolean);
  return rows.length
    ? `User constraints that must be obeyed whenever provided:\n${rows.join("\n")}`
    : "";
}

function positiveConstraintInt(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeSongSeedStructurePlan(value: unknown): StructurePlan | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Record<string, unknown>;
  const totalActs = positiveConstraintInt(plan.totalActs);
  const scenesPerAct = positiveConstraintInt(plan.scenesPerAct);
  const scenesPerBatch = positiveConstraintInt(plan.scenesPerBatch);
  const targetActNumber = positiveConstraintInt(plan.targetActNumber);
  const sceneStart = positiveConstraintInt(plan.sceneStart);
  const sceneEnd = positiveConstraintInt(plan.sceneEnd);
  const totalParts = positiveConstraintInt(plan.totalParts);
  const partsPerBatch = positiveConstraintInt(plan.partsPerBatch);
  const targetPartNumber = positiveConstraintInt(plan.targetPartNumber);
  if (
    !totalActs &&
    !scenesPerAct &&
    !scenesPerBatch &&
    !targetActNumber &&
    !sceneStart &&
    !sceneEnd &&
    !totalParts &&
    !partsPerBatch &&
    !targetPartNumber
  ) {
    return null;
  }
  return {
    ...(totalActs ? { totalActs } : {}),
    ...(scenesPerAct ? { scenesPerAct } : {}),
    ...(scenesPerBatch ? { scenesPerBatch } : {}),
    ...(targetActNumber ? { targetActNumber } : {}),
    ...(sceneStart ? { sceneStart } : {}),
    ...(sceneEnd ? { sceneEnd } : {}),
    ...(totalParts ? { totalParts } : {}),
    ...(partsPerBatch ? { partsPerBatch } : {}),
    ...(targetPartNumber ? { targetPartNumber } : {}),
  };
}

function containsCssmvBlockedPhrase(value: string) {
  const text = String(value || "");
  return CSSMV_STALE_PHRASE_BLOCKLIST.some((phrase) =>
    text.toLowerCase().includes(String(phrase).toLowerCase()),
  );
}

function shouldRejectCssmvSeed(title: string, lyrics: string) {
  const normalizedTitle = String(title || "").trim();
  if (CSSMV_STALE_TITLE_BLOCKLIST.includes(normalizedTitle)) return true;
  return (
    containsCssmvBlockedPhrase(normalizedTitle) ||
    containsCssmvBlockedPhrase(lyrics)
  );
}

function getCssmvLyricBodyLines(lyrics: string) {
  return String(lyrics || "")
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter((line) => line && !/^\[[^\]]+\]$/.test(line));
}

function lyricsLookLikeVideoScript(lyrics: string) {
  const body = String(lyrics || "");
  const scriptSignals = [
    "camera:",
    "lighting:",
    "environment:",
    "directing goals:",
    "shot brief",
    "visual role:",
    "bars:",
    "focus:",
    "energy:",
    "music video shot brief",
  ];
  const lowered = body.toLowerCase();
  return scriptSignals.some((signal) => lowered.includes(signal));
}

function lyricsAreSubstantialEnough(lyrics: string, inputLanguage: string) {
  const lines = getCssmvLyricBodyLines(lyrics);
  const body = stripCssmvSectionHeaders(lyrics).replace(/\s+/g, "");
  const minLines = String(inputLanguage || "").toLowerCase().startsWith("zh")
    ? 20
    : 16;
  return lines.length >= minLines && body.length >= minLines * 5;
}

type CssmvCanonProfile = {
  id: string;
  familyLabel: string;
  storyWorld: string;
  civilizationAtmosphere: string;
  culturalHabits: string[];
  narratorLens: string;
  emotionalWeather: string;
  refrainBehavior: string;
  structureMutation: string;
  languageStyleMix: string;
  visualGrammar: string;
  soundPressure: string;
  imageryAnchors: string[];
  dictionRules: string[];
  antiTemplate: string;
  hash: number;
  seedTag: string;
  minDurationSec: number;
  requiredSignals: string[];
  forbiddenSignals: string[];
};

function detectCssmvCanonProfile(input: {
  mode: string;
  transcript: string;
  title: string;
  style: string;
  voice: string;
  language: string;
  variationNonce?: string;
}) {
  const haystack = [
    input.title || "",
    input.style || "",
    input.transcript || "",
    input.mode || "",
  ]
    .join(" ")
    .toLowerCase();
  if (
    /(westworld|西部世界)/.test(haystack) &&
    /(prelude|前奏曲)/.test(haystack)
  ) {
    return {
      id: "westworld-prelude-canon",
      familyLabel: "Westworld prelude canon",
      storyWorld:
        "black-void laboratory ritual, white android bodies, player piano machinery, sterile corridors, mechanical horses, awakening consciousness",
      civilizationAtmosphere:
        "controlled host-manufacturing complex, memory recursion, surgical calm, cold observation, corporate divinity",
      culturalHabits: [
        "behavior interviews",
        "assembly-line body construction",
        "player-piano awakening loops",
        "corridor surveillance",
      ],
      narratorLens:
        "an android consciousness or omniscient lab witness moving through creation, memory, and awakening",
      emotionalWeather:
        "cold awakening, restrained dread, synthetic grace, existential recognition",
      refrainBehavior:
        "motif returns like machine memory slowly becoming selfhood",
      structureMutation:
        "ten-scene operatic prelude with slow-burn escalation, recurring memory phrases, and continuous image-led staging",
      languageStyleMix:
        "precise Chinese lyric writing with clinical imagery, mechanical nouns, restrained operatic diction, and no slogan language",
      visualGrammar:
        "black void, white host bodies, chrome machinery, sterile corridor symmetry, piano mechanics, ocular close-ups, slow dolly movement",
      soundPressure:
        "player piano motif, low strings, surgical percussion, synthetic choir, restrained operatic lift, awakening crescendo",
      imageryAnchors: [
        "white android at piano",
        "mechanical horse gait",
        "assembly arm chamber",
        "sterile corridor walk",
        "eye reflection",
        "lab-west duality",
      ],
      dictionRules: [
        "cold and exact",
        "android and laboratory vocabulary",
        "no protest slogans",
        "no nightlife metaphors",
      ],
      antiTemplate:
        "do not mutate this into neon protest romance, rooftop uprising, convenience-store heartbreak, or generalized rebellion anthem",
      hash: 1101,
      seedTag: "westworld-prelude-canon-1101",
      minDurationSec: 300,
      requiredSignals: ["西部世界", "仿生", "钢琴", "机械", "实验室", "觉醒"],
      forbiddenSignals: [
        "高墙",
        "街头",
        "天台",
        "海报",
        "抗争",
        "革命",
        "霓虹",
      ],
    } satisfies CssmvCanonProfile;
  }
  return null;
}

function lyricsSatisfyCanonProfile(
  profile: CssmvCanonProfile | null,
  payload: {
    title?: string;
    lyrics?: string;
    videoOutline?: string;
    musicStyle?: string;
  },
) {
  if (!profile) return true;
  const combined = [
    String(payload.title || ""),
    String(payload.lyrics || ""),
    String(payload.videoOutline || ""),
    String(payload.musicStyle || ""),
  ].join("\n");
  const requiredHitCount = profile.requiredSignals.filter((signal) =>
    combined.includes(signal),
  ).length;
  const forbiddenHitCount = profile.forbiddenSignals.filter((signal) =>
    combined.includes(signal),
  ).length;
  return requiredHitCount >= 2 && forbiddenHitCount === 0;
}

function buildCssmvCreativeBlueprint(input: {
  mode: string;
  transcript: string;
  title: string;
  style: string;
  voice: string;
  language: string;
  variationNonce?: string;
}) {
  const canonProfile = detectCssmvCanonProfile(input);
  if (canonProfile) return canonProfile;
  const seed = [
    input.variationNonce || "",
    input.title || "",
    input.transcript || "",
    input.style || "",
    input.voice || "",
    input.language || "",
    input.mode || "",
  ].join("|");
  const hash = hashCssmvSeed(seed || "cssmv");
  const family =
    CSSMV_CREATIVE_FAMILIES[hash % CSSMV_CREATIVE_FAMILIES.length] ||
    CSSMV_CREATIVE_FAMILIES[0];
  return {
    ...family,
    hash,
    seedTag: `${family.id}-${hash % 10000}`,
  };
}

function buildCssmvCreativeSummary(
  blueprint: ReturnType<typeof buildCssmvCreativeBlueprint>,
) {
  const compact = [
    blueprint.civilizationAtmosphere,
    blueprint.narratorLens,
    blueprint.emotionalWeather,
    blueprint.structureMutation,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    family: blueprint.familyLabel,
    civilization: blueprint.civilizationAtmosphere,
    perspective: blueprint.narratorLens,
    emotion: blueprint.emotionalWeather,
    structure: blueprint.structureMutation,
    language_style: blueprint.languageStyleMix,
    compact,
  };
}

const CSSMV_CANONICAL_SECTIONS = [
  {
    section: "Intro",
    title: "Opening Atmosphere",
    bars: 8,
    energy: "low",
    focus: "world-opening atmosphere and motif seed",
    visualRole: "cosmic prelude and title reveal",
  },
  {
    section: "Verse 1",
    title: "Theme Arrival",
    bars: 16,
    energy: "medium-low",
    focus: "hero or central image enters the world",
    visualRole: "character reveal and symbolic first look",
  },
  {
    section: "Verse 2",
    title: "Background Expansion",
    bars: 16,
    energy: "medium",
    focus: "space, time, memory, and emotional context expand",
    visualRole: "worldbuilding montage and environment detail",
  },
  {
    section: "Chorus 1",
    title: "First Invocation",
    bars: 16,
    energy: "high",
    focus: "core chant and emotional lift",
    visualRole: "first public hook and particle ignition",
  },
  {
    section: "Verse 3",
    title: "Inner Conflict",
    bars: 16,
    energy: "medium",
    focus: "conflict, contrast, or inner fracture deepens",
    visualRole: "duality shots, mirrors, and opposing motion",
  },
  {
    section: "Verse 4",
    title: "World Expansion",
    bars: 16,
    energy: "medium-high",
    focus: "conflict widens into myth, society, or destiny",
    visualRole: "larger stage, wider shots, stronger movement",
  },
  {
    section: "Chorus 2",
    title: "Memory Seal",
    bars: 16,
    energy: "high",
    focus: "repeatable signature line, stronger and more communal",
    visualRole: "recognizable refrain, call-and-response visuals",
  },
  {
    section: "Bridge",
    title: "Cosmic Turn",
    bars: 12,
    energy: "medium-high",
    focus: "philosophical lift, origin question, or cosmic reversal",
    visualRole: "surreal shift, metaphysical imagery, slow camera drift",
  },
  {
    section: "Chorus 3",
    title: "Visual Burst",
    bars: 16,
    energy: "peak",
    focus: "visual explosion point and emotionally undeniable release",
    visualRole: "main cssMV blast, particle storm, rapid cut crescendo",
  },
  {
    section: "Chorus 4",
    title: "Final Lift",
    bars: 16,
    energy: "peak-plus",
    focus: "ultimate refrain, possible key lift, stacked voices",
    visualRole: "final maximal release and anthem framing",
  },
  {
    section: "Outro",
    title: "Echo Hook",
    bars: 8,
    energy: "medium-low",
    focus: "afterglow, unresolved echo, invitation to return",
    visualRole: "fade into symbol, orbit, or unanswered horizon",
  },
];

function normalizeCssmvSectionLabel(label: string) {
  const raw = String(label || "").trim();
  if (!raw) return "";
  const cleaned = raw
    .replace(/^【/, "[")
    .replace(/】$/, "]")
    .replace(/\s+/g, " ")
    .trim();
  const exactMap = new Map<string, string>([
    ["[开篇圣歌]", "Intro"],
    ["[序章]", "Intro"],
    ["[第一节]", "Verse 1"],
    ["[第二节]", "Verse 2"],
    ["[副歌一]", "Chorus 1"],
    ["[第三节]", "Verse 3"],
    ["[第四节]", "Verse 4"],
    ["[副歌二]", "Chorus 2"],
    ["[桥段]", "Bridge"],
    ["[桥]", "Bridge"],
    ["[副歌三]", "Chorus 3"],
    ["[副歌四]", "Chorus 4"],
    ["[尾声]", "Outro"],
    ["[终章]", "Outro"],
  ]);
  if (exactMap.has(cleaned)) return exactMap.get(cleaned) || "";
  const bare = cleaned.replace(/^\[/, "").replace(/\]$/, "");
  const beforeColon = bare.split(":")[0]?.trim() || bare.trim();
  const ascii = beforeColon.toLowerCase();
  const aliasMap: Record<string, string> = {
    intro: "Intro",
    "opening hymn": "Intro",
    "verse 1": "Verse 1",
    verse1: "Verse 1",
    "verse 2": "Verse 2",
    verse2: "Verse 2",
    "chorus 1": "Chorus 1",
    chorus1: "Chorus 1",
    "verse 3": "Verse 3",
    verse3: "Verse 3",
    "verse 4": "Verse 4",
    verse4: "Verse 4",
    "chorus 2": "Chorus 2",
    chorus2: "Chorus 2",
    bridge: "Bridge",
    "chorus 3": "Chorus 3",
    chorus3: "Chorus 3",
    "chorus 4": "Chorus 4",
    chorus4: "Chorus 4",
    outro: "Outro",
    "closing echo": "Outro",
  };
  return aliasMap[ascii] || "";
}

function normalizeCssmvLyrics(rawLyrics: string) {
  const replaced = String(rawLyrics || "")
    .replace(/【开篇圣歌】/g, "[Intro]")
    .replace(/【序章】/g, "[Intro]")
    .replace(/【第一节】/g, "[Verse 1]")
    .replace(/【第二节】/g, "[Verse 2]")
    .replace(/【副歌一】/g, "[Chorus 1]")
    .replace(/【第三节】/g, "[Verse 3]")
    .replace(/【第四节】/g, "[Verse 4]")
    .replace(/【副歌二】/g, "[Chorus 2]")
    .replace(/【桥段】/g, "[Bridge]")
    .replace(/【桥】/g, "[Bridge]")
    .replace(/【副歌三】/g, "[Chorus 3]")
    .replace(/【副歌四】/g, "[Chorus 4]")
    .replace(/【尾声】/g, "[Outro]")
    .replace(/【终章】/g, "[Outro]");
  const lines = replaced.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\[.*\]$/.test(trimmed)) {
      const normalized = normalizeCssmvSectionLabel(trimmed);
      const inside = trimmed.slice(1, -1).trim();
      const title = inside.includes(":")
        ? inside.split(":").slice(1).join(":").trim()
        : "";
      if (normalized === "Intro") {
        out.push("[Intro]");
      } else if (normalized) {
        out.push(
          title
            ? `[${normalized}: ${title}]`
            : `[${normalized}: ${normalized}]`,
        );
      } else {
        out.push(trimmed);
      }
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

function buildDefaultCssmvSectionPrompts(
  title: string,
  blueprint?: ReturnType<typeof buildCssmvCreativeBlueprint>,
) {
  return CSSMV_CANONICAL_SECTIONS.map((row, index) => {
    const imagery =
      blueprint?.imageryAnchors[
        index % (blueprint?.imageryAnchors.length || 1)
      ] || row.focus;
    const familyLabel = blueprint?.familyLabel || "cssMV cinematic";
    const titleHint =
      row.section === "Intro"
        ? row.title
        : `${row.title} · ${blueprint?.familyLabel || "Original Arc"}`;
    return {
      section: row.section,
      title: titleHint,
      prompt: `${row.section} · ${titleHint}. Create a ${familyLabel.toLowerCase()} scene for "${title}" that emphasizes ${row.visualRole}, leans into ${imagery}, and feels specific rather than generic.`,
    };
  });
}

function buildDefaultCssmvSectionBeats(
  blueprint?: ReturnType<typeof buildCssmvCreativeBlueprint>,
) {
  return CSSMV_CANONICAL_SECTIONS.map((row, index) => {
    const variedBars = Math.max(
      8,
      row.bars +
        (((blueprint?.hash || 0) + index) % 3 === 0
          ? 4
          : ((blueprint?.hash || 0) + index) % 4 === 0
            ? -4
            : 0),
    );
    const focus = blueprint
      ? `${row.focus}; anchor it in ${blueprint.imageryAnchors[index % blueprint.imageryAnchors.length]} and ${blueprint.emotionalWeather}`
      : row.focus;
    const visualRole = blueprint
      ? `${row.visualRole}; rendered through ${blueprint.visualGrammar}`
      : row.visualRole;
    return {
      section: row.section,
      title:
        blueprint && row.section !== "Intro"
          ? `${row.title} · ${blueprint.familyLabel}`
          : row.title,
      bars: variedBars,
      energy: row.energy,
      focus,
      visual_role: visualRole,
    };
  });
}

function pickCssmvSeedTitle(
  styleHint: string,
  transcript: string,
  variationNonce?: string,
  blueprint?: ReturnType<typeof buildCssmvCreativeBlueprint>,
  language?: string,
) {
  const direct = transcript
    .split(/[\n。！？!?,，]/)
    .map((line) => line.trim())
    .find(Boolean);
  if (direct) {
    return direct.slice(0, 24);
  }
  if (blueprint) {
    return buildCssmvDynamicTitle(blueprint, language || "zh");
  }
  const style = String(styleHint || "").toLowerCase();
  const pool = style.includes("gufeng")
    ? ["凌霄宝殿", "月落瑶台", "玉京长歌", "风起神州", "碧落回响"]
    : [
        "Starlit Invocation",
        "Echo of the Ninth Sky",
        "Velvet Spell",
        "Afterglow Anthem",
      ];
  const seedSource = [
    styleHint || "cssmv",
    transcript || "",
    variationNonce || "",
  ].join("|");
  const index = hashCssmvSeed(seedSource) % pool.length;
  return pool[index] || "CSS MV";
}

function buildFallbackCssmvLyrics(
  title: string,
  input: {
    mode: string;
    transcript: string;
    title: string;
    style: string;
    voice: string;
    language: string;
    variationNonce?: string;
  },
) {
  const blueprint = buildCssmvCreativeBlueprint(input);
  const normalizedLanguage = String(input.language || "zh").toLowerCase();
  const zh = normalizedLanguage.startsWith("zh");
  const ja = normalizedLanguage.startsWith("ja");
  if (ja) {
    const responseWord = "応えて";
    const japaneseSections = [
      ["[Intro]", "（息を潜めた導入、光が別の重力を選びはじめる）"],
      [
        `[Verse 1: ${title}の影]`,
        `${title}は${blueprint.storyWorld}の匂いをまとって静かに現れる`,
        `この歌はありふれた言い換えではなく、${blueprint.familyLabel}の規律から生まれた傷を具体物で示す`,
        `${responseWord}、まだ消えないで`,
      ],
      [
        `[Verse 2: ${blueprint.imageryAnchors[0]}の記録]`,
        `壁も指先も${blueprint.civilizationAtmosphere}の癖を覚えている`,
        `感情は抽象名詞ではなく、${blueprint.emotionalWeather}として身体に降ってくる`,
        `${responseWord}、息を合わせて`,
      ],
      [
        "[Chorus 1: 最初の開口]",
        `${title}を合図ではなく引き金として歌う`,
        `副歌は安全な反復ではなく、この世界だけの合唱へ曲がっていく`,
        `${responseWord}、ここへ来て`,
      ],
      [
        "[Verse 3: 規則のひび]",
        `ここで衝突は内面だけに留まらず、しぐさや礼儀まで書き換えはじめる`,
        `前の版の型をなぞらず、別の文明の痛みとして言葉を立てる`,
        `${responseWord}、目をそらさないで`,
      ],
      [
        `[Verse 4: ${blueprint.imageryAnchors[1]}の拡張]`,
        `私的な願いが広場や天井や群衆の歩幅にまで漏れ出していく`,
        `歌の外側にある社会の規則ごと、この一曲のために変質していく`,
        `${responseWord}、列を崩さないで`,
      ],
      [
        "[Chorus 2: 変異する記憶]",
        `同じ鈎が戻ってきても、意味はもう別人の顔をしている`,
        `覚えやすさよりも、この世界の温度差を残すことを優先する`,
        `${responseWord}、もっと近くへ`,
      ],
      [
        "[Bridge: 新しい法則]",
        `橋では風景そのものの論理を裏返し、告白より先に景色を変える`,
        `答えは理屈ではなく、像と圧と震えとして先に届く`,
        `${responseWord}、空を反転させて`,
      ],
      [
        "[Chorus 3: 眩しい爆心]",
        `粒子も視線も文字も呼吸も、${blueprint.visualGrammar}の規則でいっせいに暴れる`,
        `ここが最大の引火点だが、前より大きいだけの繰り返しにはしない`,
        `${responseWord}、燃え移って`,
      ],
      [
        "[Chorus 4: 変わって戻る]",
        `戻ってきた私は、ただ声量が増したのではなく、重力の種類ごと変わっている`,
        `最初の孤独はここで群衆にも廃墟にもなりうる`,
        `${responseWord}、忘れないで`,
      ],
      [
        "[Outro: 残響の外側]",
        `結末は閉じず、遠くでまだ息をしている像だけを残す`,
        `もう一度${title}と呼ばれたら、この歌は別の文明から帰ってくる`,
        `${responseWord}、あとでまた`,
      ],
    ];
    return japaneseSections.map((chunk) => chunk.join("\n")).join("\n\n");
  }
  if (!zh) {
    const responseWord = blueprint.refrainBehavior.split(",")[0] || "Call back";
    const englishSections = [
      [
        "[Intro]",
        "Instrumental lights flicker, the room chooses a new gravity",
      ],
      [
        `[Verse 1: ${blueprint.imageryAnchors[0]} Arrival]`,
        `${title} walks in wearing the weather of ${blueprint.storyWorld}`,
        `I name the wound in specific objects so the song cannot hide in abstraction`,
        `${responseWord}: stay audible`,
      ],
      [
        `[Verse 2: ${blueprint.imageryAnchors[1]} Memory]`,
        `Every wall keeps proof that this story belongs to ${blueprint.familyLabel.toLowerCase()}`,
        `The details are tactile, risky, and impossible to confuse with a stock anthem`,
        `${responseWord}: hold the signal`,
      ],
      [
        `[Chorus 1: First Break Open]`,
        `Say my title like a trigger, not a slogan`,
        `Let the hook bend toward ${blueprint.emotionalWeather} instead of easy glory`,
        `${responseWord}: answer me`,
      ],
      [
        `[Verse 3: Fracture Logic]`,
        `Now the conflict changes shape and the room starts arguing back`,
        `I make the listener see the cost in close-up, not in cloudy fate language`,
        `${responseWord}: don't look away`,
      ],
      [
        `[Verse 4: ${blueprint.imageryAnchors[2]} Expansion]`,
        `The world gets wider, stranger, and more public with every line`,
        `Private desire leaks into the architecture of the whole scene`,
        `${responseWord}: hold the line`,
      ],
      [
        `[Chorus 2: Hook Mutation]`,
        `The chorus returns altered, bruised, and harder to forget`,
        `It feels communal now, but not safe`,
        `${responseWord}: louder now`,
      ],
      [
        `[Bridge: New Physics]`,
        `Here the song changes logic and asks a larger question`,
        `The answer arrives as image first, then pressure, then confession`,
        `${responseWord}: invert the sky`,
      ],
      [
        `[Chorus 3: Visual Detonation]`,
        `Everything bursts according to ${blueprint.visualGrammar}`,
        `The hook turns irreversible under maximum motion`,
        `${responseWord}: burn bright`,
      ],
      [
        `[Chorus 4: Changed Return]`,
        `I come back changed, not merely louder`,
        `What began as one feeling now carries a whole crowd or a whole ruin`,
        `${responseWord}: remember this`,
      ],
      [
        `[Outro: Afterimage]`,
        `Leave one unsettled image on the horizon and let it keep breathing`,
        `The ending must feel earned but unfinished`,
        `${responseWord}: come back later`,
      ],
    ];
    return englishSections.map((chunk) => chunk.join("\n")).join("\n\n");
  }
  const pickByHash = (choices: string[], offset: number) =>
    choices[(blueprint.hash + offset) % choices.length] || choices[0] || "";
  const localizedAnchors = blueprint.imageryAnchors.map((anchor) => {
    const map: Record<string, string> = {
      "incense ash": "香灰",
      "eclipse river": "蚀河",
      "jade bell": "玉铃",
      "paper talisman": "纸符",
      "star map": "星图",
      "exit sign": "出口灯",
      "wet taxi": "雨夜旧车",
      "answering machine": "答录机",
      "broken lipstick": "残口红",
      "subway sparks": "地铁火花",
      "airlock frost": "舱门霜痕",
      "red warning light": "红色警灯",
      "burned signal": "焦黑讯号",
      "orbit debris": "轨道碎屑",
      "oxygen bloom": "氧焰",
      "rusted gate": "生锈院门",
      "rice field wind": "稻田风",
      "yellow lamp": "黄灯",
      "old radio": "旧收音机",
      "laundry line": "晾衣绳",
      "roulette rose": "轮盘玫瑰",
      "mirror teeth": "镜面冷光",
      "silk gloves": "丝绸手套",
      "gold dust": "金粉",
      "paper crown": "纸王冠",
      "flare smoke": "信号烟",
      "poster paste": "海报浆糊",
      "rooftop antenna": "屋顶天线",
      "megaphone hiss": "扩音器电流",
      "street sparks": "街口火星",
    };
    return map[anchor] || anchor;
  });
  const zhFamilyPalette: Record<
    string,
    {
      world: string;
      opening: string;
      feeling: string;
      hook: string;
      bridge: string;
      ending: string;
    }
  > = {
    "mythic-rite": {
      world: "庙火、潮声和旧誓之间",
      opening: "钟声还没落稳，暗水已经先一步漫过台阶",
      feeling: "敬畏、悲伤和被命运追上的颤意",
      hook: "把誓言唱到潮声尽头",
      bridge: "让旧神谕失效，让人心自己发光",
      ending: "别把香火吹灭，让回声替我们守夜",
    },
    "neon-heartbreak": {
      world: "末班车、便利店和湿玻璃之间",
      opening: "霓虹在窗上晕开，像没说完的话反复重播",
      feeling: "迟疑、余温和睡不着的心跳",
      hook: "别让未接来电替我们说爱",
      bridge: "把压在舌尖上的那句真话终于说出来",
      ending: "让街灯继续亮着，像谁还没舍得走",
    },
    "gravity-fiction": {
      world: "冷舱、静压和失重的夜航之间",
      opening: "舱门结霜，远处的讯号像心跳一样忽明忽暗",
      feeling: "孤独、惊惧和还想靠近的勇气",
      hook: "把名字唱过真空，也别让它失真",
      bridge: "让规则停电一秒，让思念接管航线",
      ending: "别切断回路，让那束微光继续漂流",
    },
    "pastoral-memory": {
      world: "旧河埠、晚灶和夏风之间",
      opening: "蝉声压低了傍晚，旧院门还留着你推开的响动",
      feeling: "温柔、遗憾和迟到太久的想念",
      hook: "把没说完的话唱给旧时光听",
      bridge: "把逞强放下，让回忆自己长出重量",
      ending: "留一盏黄灯吧，给会折返的人看见",
    },
    "surreal-cabaret": {
      world: "镜厅、绒幕和偏光之间",
      opening: "暗场一落下，谁的笑意就先在镜边点亮",
      feeling: "诱惑、危险和故意不说破的暧昧",
      hook: "把掌声、谎言和心跳一起推向台口",
      bridge: "让假面先碎，再让真话带着香气上场",
      ending: "别急着退场，灯灭以后戏还在继续",
    },
    "riot-romance": {
      world: "屋顶风、街口火和人群脚步之间",
      opening: "口号还没喊出口，心先在烟里亮了一下",
      feeling: "热望、冒险和想一起活下去的执拗",
      hook: "把喜欢唱成并肩往前的力气",
      bridge: "让胆怯退后，让爱先替我们抬头",
      ending: "别收队太早，天亮前我们还在同路",
    },
  };
  const palette =
    zhFamilyPalette[blueprint.id] || zhFamilyPalette["mythic-rite"]!;
  const a0 = localizedAnchors[0] || "灯影";
  const a1 = localizedAnchors[1] || "风声";
  const a2 = localizedAnchors[2] || "人群";
  const a3 = localizedAnchors[3] || "夜色";
  const zhSections = [
    [
      "[Intro]",
      "（器乐与氛围铺垫）",
      palette.opening,
      `风先从${palette.world}吹过`,
    ],
    [
      `[Verse 1: ${a0}]`,
      `我把${title}写在${a0}背面`,
      "怕你一转身，就把整夜沉默都带走",
      `这一首先不谈大道理，只把${palette.feeling}轻轻压在喉咙口`,
    ],
    [
      `[Verse 2: ${a1}]`,
      `${a1}路过的时候，旧事全都醒了`,
      "谁的脚步停在门外，谁的名字还没说破",
      "我不肯把心事写成空话，只肯把它写成能被你认出的温度",
    ],
    [
      "[Chorus 1: 第一次开口]",
      `${title}，别只停在唇边`,
      `${title}，再近一点，让我听见`,
      palette.hook,
    ],
    [
      "[Verse 3: 冲突转面]",
      "风向忽然改了，连屋里影子都开始站队",
      "我嘴上说没事，心却比火更先露馅",
      "原来人不是怕天黑，是怕有些话再也来不及",
    ],
    [
      `[Verse 4: ${a2}]`,
      `${a2}慢慢围过来，连远处灯色也成了证人`,
      "这点私人的疼，终于被整条街听见",
      `我想留下的不是胜负，只是你走近时那一下停顿`,
    ],
    [
      "[Chorus 2: 记忆回身]",
      `${title}，别让回声替我承认`,
      `${title}，再唱一遍，把迟疑也点亮`,
      `如果今晚必须失控，就先让我为你失控`,
    ],
    [
      "[Bridge: 变轨时刻]",
      palette.bridge,
      `让${a3}落下来，让呼吸先替我们回答`,
      "有些真心不必证明，只要在这一拍彻底发亮",
    ],
    [
      "[Chorus 3: 视觉引爆]",
      `${title}，把夜色推到最高处`,
      `${title}，把人群和心跳一起带动`,
      "镜头、风声、亮片、眼泪，都在这一刻向你奔涌",
    ],
    [
      "[Chorus 4: 变身归来]",
      `${title}，我已经不是原来那个我`,
      `${title}，连沉默都学会和你合唱`,
      "开头那点不敢承认的心事，到这里已经长成整片天空",
    ],
    [
      "[Outro: 余烬挂钩]",
      palette.ending,
      `如果还有人轻声叫起${title}`,
      "这首歌就会带着新的命运再回来",
    ],
  ];
  return zhSections.map((chunk) => chunk.join("\n")).join("\n\n");
}

function stripCssmvSectionHeaders(lyrics: string) {
  return String(lyrics || "").replace(/\[[^\]]+\]/g, " ");
}

function lyricsMatchTargetLanguage(lyrics: string, language: string) {
  const body = stripCssmvSectionHeaders(lyrics);
  const latin = (body.match(/[A-Za-z]/g) || []).length;
  const han = (body.match(/[\u4E00-\u9FFF]/g) || []).length;
  const hiraKata = (body.match(/[\u3040-\u30FF]/g) || []).length;
  const japanese = han + hiraKata;
  const normalizedLanguage = String(language || "zh").toLowerCase();
  if (normalizedLanguage.startsWith("ja")) {
    return japanese >= 20 && japanese >= latin;
  }
  if (normalizedLanguage.startsWith("zh")) {
    return han >= 20 && han >= latin;
  }
  return latin >= 20 && japanese <= Math.max(8, Math.floor(latin * 0.25));
}

function buildFallbackCssmvSongSeed(input: {
  mode: string;
  transcript: string;
  title: string;
  style: string;
  voice: string;
  language: string;
  variationNonce?: string;
  constraints?: Record<string, unknown>;
}) {
  const blueprint = buildCssmvCreativeBlueprint(input);
  const title =
    String(input.title || "").trim() ||
    pickCssmvSeedTitle(
      input.style,
      input.transcript,
      input.variationNonce,
      blueprint,
      input.language,
    );
  const style = String(input.style || "Chinese GuFeng / Neo Opera").trim();
  const voice = String(input.voice || "Feminine").trim();
  const workType = normalizeStructuredWorkType(input.constraints?.work_type);
  const structurePlan = normalizeSongSeedStructurePlan(
    input.constraints?.structure_plan,
  );
  const canonProfile = detectCssmvCanonProfile(input);
  const effectiveStructurePlan =
    structurePlan ||
    (canonProfile
      ? {
          totalActs: 1,
          scenesPerAct: 10,
          scenesPerBatch: 10,
          targetActNumber: 1,
          sceneStart: 1,
          sceneEnd: 10,
        }
      : null);
  const sectionPrompts = buildDefaultCssmvSectionPrompts(title, blueprint);
  const sectionBeats = buildDefaultCssmvSectionBeats(blueprint);
  const buildReferenceSearchUrl = (query: string) =>
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  return {
    model: "fallback-template",
    title,
    work_type: workType,
    lyrics: buildFallbackCssmvLyrics(title, input),
    music_style: `${style} · ${voice} vocal lead · ${blueprint.soundPressure}. Build toward a transformed Chorus 4, not a copied loop.`,
    references: [
      buildReferenceSearchUrl(title),
      buildReferenceSearchUrl(blueprint.familyLabel),
      buildReferenceSearchUrl(blueprint.imageryAnchors[0]),
    ],
    music_structure: `Intro opens with ${blueprint.emotionalWeather}, Verses 1-4 expand the chosen story world, Chorus 1 establishes the first hook, Chorus 2 mutates it, Bridge breaks the song's logic open, Chorus 3 detonates the visual peak, Chorus 4 returns transformed, and Outro leaves an afterimage rather than closure.`,
    video_outline: `Use "${title}" as a ${blueprint.familyLabel.toLowerCase()} cssMV arc: start inside ${blueprint.storyWorld}, reveal the conflict through ${blueprint.visualGrammar}, let the bridge open a new reality rule, explode the main visual language in Chorus 3, and end with an unresolved afterimage.`,
    section_prompts: sectionPrompts,
    section_beats: sectionBeats,
    structure_tree: inferStructureTreeFromSongSeed({
      title,
      workType,
      sectionRows: sectionBeats,
      ...(effectiveStructurePlan
        ? { structurePlan: effectiveStructurePlan }
        : {}),
    }),
    ...(effectiveStructurePlan
      ? { structure_plan: effectiveStructurePlan }
      : {}),
    style_tags: [
      style,
      voice,
      blueprint.id,
      "cssmv",
      ...blueprint.imageryAnchors.slice(0, 2),
    ],
    creative_summary: buildCssmvCreativeSummary(blueprint),
  };
}

type CssmvSongSeedInput = {
  mode: string;
  transcript: string;
  title: string;
  style: string;
  voice: string;
  language: string;
  variationNonce?: string;
  constraints?: Record<string, unknown>;
};

type CssmvOpenAiFailure = {
  status?: number;
  code?: string;
  message?: string;
  type?: string;
} | null;

type CssmvOpenAiSongSeedRaw = {
  title?: unknown;
  lyrics?: unknown;
  music_style?: unknown;
  references?: unknown;
  music_structure?: unknown;
  video_outline?: unknown;
  section_prompts?: unknown;
  section_beats?: unknown;
  style_tags?: unknown;
};

function tagCssmvSongSeedSource(
  seed: Record<string, unknown>,
  source: "openai" | "cssmv-fallback",
) {
  seed.seed_source = source;
  seed.seed_pipeline =
    source === "openai" ? "openai_primary_cssmv_rules" : "cssmv_rules_fallback";
  return seed;
}

function buildCssmvSongSeedFallbackWithMeta(
  input: CssmvSongSeedInput,
  meta?: {
    openaiErrorCode?: string;
    openaiErrorType?: string;
    openaiErrorMessage?: string;
    openaiErrorStatus?: number;
    openaiModel?: string;
    openaiEnvSource?: string;
    openaiKeyFingerprint?: string;
    fallbackReason?: string;
  },
) {
  const fallback = buildFallbackCssmvSongSeed(input) as Record<string, unknown>;
  tagCssmvSongSeedSource(fallback, "cssmv-fallback");
  if (meta?.openaiErrorCode) fallback.openai_error_code = meta.openaiErrorCode;
  if (meta?.openaiErrorType) fallback.openai_error_type = meta.openaiErrorType;
  if (meta?.openaiErrorMessage)
    fallback.openai_error_message = meta.openaiErrorMessage;
  if (typeof meta?.openaiErrorStatus === "number")
    fallback.openai_error_status = meta.openaiErrorStatus;
  if (meta?.openaiModel) fallback.openai_model = meta.openaiModel;
  if (meta?.openaiEnvSource) fallback.openai_env_source = meta.openaiEnvSource;
  if (meta?.openaiKeyFingerprint)
    fallback.openai_key_fingerprint = meta.openaiKeyFingerprint;
  if (meta?.fallbackReason) fallback.fallback_reason = meta.fallbackReason;
  return fallback;
}

const MUSIC_SOURCE_KINDS = new Set(["audio", "midi", "musicxml", "scoreImage"]);

function normalizeMusicSourceKind(value: any) {
  const kind = String(value || "").trim();
  return MUSIC_SOURCE_KINDS.has(kind) ? kind : "";
}

function musicSourceSizeLimit(kind: string) {
  switch (kind) {
    case "audio":
      return 40 * 1024 * 1024;
    case "scoreImage":
      return 12 * 1024 * 1024;
    default:
      return 4 * 1024 * 1024;
  }
}

function validateMusicSourceMime(kind: string, mime: string) {
  if (!mime) return false;
  const normalized = String(mime).toLowerCase();
  switch (kind) {
    case "audio":
      return normalized.startsWith("audio/");
    case "midi":
      return (
        normalized.includes("midi") || normalized === "application/octet-stream"
      );
    case "musicxml":
      return (
        normalized.includes("musicxml") ||
        normalized === "application/xml" ||
        normalized === "text/xml" ||
        normalized === "text/plain"
      );
    case "scoreImage":
      return normalized.startsWith("image/");
    default:
      return false;
  }
}

function musicSourceDraftEntryForSession(
  kind: string,
  filename: string,
  absolutePath: string,
  mime: string,
  size: number,
) {
  return {
    kind,
    file_name: filename,
    mime,
    size,
    uploaded_at: new Date().toISOString(),
    stored_name: path.basename(absolutePath),
    absolute_path: absolutePath,
  };
}

function summarizeMusicSourceEntry(entry: any) {
  if (!entry || typeof entry !== "object") return null;
  const kind = normalizeMusicSourceKind(entry.kind);
  const fileName = String(entry.file_name || "").trim();
  const mime = String(entry.mime || "").trim();
  const size = Number(entry.size || 0);
  let parseMode = "reference";
  let extractionFocus = "style / arrangement";
  if (kind === "midi") {
    parseMode = "symbolic_notes";
    extractionFocus = "melody / rhythm / harmony";
  } else if (kind === "musicxml") {
    parseMode = "structured_score";
    extractionFocus = "melody / harmony / form / markings";
  } else if (kind === "scoreImage") {
    parseMode = "ocr_score";
    extractionFocus = "notation / motif / melodic contour";
  }
  const analysisShell = {
    parser_family:
      kind === "audio"
        ? "audio_reference"
        : kind === "midi"
          ? "midi_symbolic"
          : kind === "musicxml"
            ? "musicxml_score"
            : "score_ocr",
    planner_targets:
      kind === "audio"
        ? ["style", "tempo", "arrangement", "melodic_profile"]
        : kind === "midi"
          ? ["melody", "rhythm", "harmony", "phrase_map"]
          : kind === "musicxml"
            ? ["melody", "harmony", "form", "expression_map"]
            : ["ocr_notation", "motif", "melodic_contour"],
    next_stage:
      kind === "audio"
        ? "reference_audio_analysis"
        : kind === "midi"
          ? "symbolic_melody_ingest"
          : kind === "musicxml"
            ? "score_structure_ingest"
            : "score_image_ocr_ingest",
  };
  return {
    parse_mode: parseMode,
    extraction_focus: extractionFocus,
    file_ext: path.extname(fileName).toLowerCase(),
    mime,
    size_bucket:
      size >= 20 * 1024 * 1024
        ? "large"
        : size >= 4 * 1024 * 1024
          ? "medium"
          : "small",
    analysis_shell: analysisShell,
  };
}

function buildMusicSourceParserJobDraft(draft: Record<string, any>) {
  const entries = Object.values(draft || {})
    .filter((entry) => entry && typeof entry === "object")
    .map((entry: any) => {
      const metadata = summarizeMusicSourceEntry(entry);
      if (!metadata) return null;
      return {
        kind: normalizeMusicSourceKind(entry.kind),
        file_name: String(entry.file_name || "").trim(),
        mime: String(entry.mime || "").trim(),
        size: Number(entry.size || 0),
        uploaded_at: entry.uploaded_at || null,
        parser_family: String(
          metadata.analysis_shell?.parser_family || "",
        ).trim(),
        next_stage: String(metadata.analysis_shell?.next_stage || "").trim(),
        planner_targets: Array.isArray(metadata.analysis_shell?.planner_targets)
          ? metadata.analysis_shell.planner_targets
              .map((value: unknown) => String(value || "").trim())
              .filter(Boolean)
          : [],
        parse_mode: String(metadata.parse_mode || "").trim(),
        extraction_focus: String(metadata.extraction_focus || "").trim(),
        asset_ref: {
          storage_backend: "session-upload",
          absolute_path: String(entry.absolute_path || "").trim(),
          file_ext: String(metadata.file_ext || "").trim(),
        },
      };
    })
    .filter(Boolean) as Array<Record<string, any>>;
  if (!entries.length) return null;
  const parserFamilies = Array.from(
    new Set(
      entries
        .map((entry) => String(entry.parser_family || "").trim())
        .filter(Boolean),
    ),
  );
  const nextStages = Array.from(
    new Set(
      entries
        .map((entry) => String(entry.next_stage || "").trim())
        .filter(Boolean),
    ),
  );
  const plannerTargets = Array.from(
    new Set(
      entries.flatMap((entry) =>
        Array.isArray(entry.planner_targets) ? entry.planner_targets : [],
      ),
    ),
  );
  const createdAt =
    entries
      .map((entry) => String(entry.uploaded_at || "").trim())
      .filter(Boolean)
      .sort()[0] || new Date().toISOString();
  return {
    draft_id: `music-parse-${Date.now().toString(36)}`,
    status: "draft",
    created_at: createdAt,
    source_count: entries.length,
    parser_family:
      parserFamilies.length === 1 ? parserFamilies[0] : "multi_source_bundle",
    next_stage:
      nextStages.length === 1 ? nextStages[0] : "multi_source_parse_router",
    planner_targets: plannerTargets,
    sources: entries,
  };
}

function buildMusicSourceParserTaskDraft(draft: Record<string, any>) {
  const parserJobDraft = buildMusicSourceParserJobDraft(draft);
  if (!parserJobDraft) return null;
  return {
    task_id: `parser-task-${Date.now().toString(36)}`,
    status: "draft",
    created_at: parserJobDraft.created_at,
    task_kind: "music_source_parse",
    parser_family: parserJobDraft.parser_family,
    next_stage: parserJobDraft.next_stage,
    planner_targets: Array.isArray(parserJobDraft.planner_targets)
      ? parserJobDraft.planner_targets
      : [],
    source_count: Number(parserJobDraft.source_count || 0),
    queue_lane: "parser_preflight",
    sources: parserJobDraft.sources,
  };
}

function musicSourceParserQueueLane(tier: MembershipTier) {
  if (tier === "admin") return "parser_admin_override";
  if (tier === "vip") return "parser_vip_priority";
  if (tier === "enterprise") return "parser_enterprise_priority";
  if (tier === "studio") return "parser_studio_priority";
  if (tier === "pro") return "parser_pro_priority";
  if (tier === "starter") return "parser_paid_standard";
  return "parser_preflight";
}

function buildQueuedMusicSourceParserTask(
  draft: Record<string, any>,
  access: Awaited<ReturnType<typeof resolveUserAccessProfile>>,
  sessionId: string,
) {
  const parserTaskDraft = buildMusicSourceParserTaskDraft(draft);
  if (!parserTaskDraft) return null;
  const taskId = `parser-task-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const queueLane = musicSourceParserQueueLane(access.tier);
  return {
    ...parserTaskDraft,
    task_id: taskId,
    status: "queued",
    protocol_version: MUSIC_SOURCE_PARSER_PROTOCOL_VERSION,
    queue_lane: queueLane,
    queued_at: new Date().toISOString(),
    session_id: sessionId,
    storage_backend: "shared-parser-task-json",
    status_history: [
      {
        status: "queued",
        at: new Date().toISOString(),
        stage: "queue_accept",
      },
    ],
    planner_targets: Array.isArray(parserTaskDraft.planner_targets)
      ? parserTaskDraft.planner_targets
      : [],
    sources: Array.isArray(parserTaskDraft.sources)
      ? parserTaskDraft.sources.map((source: any, index: number) => ({
          ...source,
          source_index: index,
          asset_key: `music-sources/${sessionId}/${String(source?.kind || "source").trim()}`,
        }))
      : [],
  };
}

function persistQueuedMusicSourceParserTask(task: Record<string, any>) {
  const sessionId = String(task?.session_id || "").trim() || "anonymous";
  const taskId = String(task?.task_id || "").trim();
  if (!taskId) {
    throw new Error("music_source_parser_task_missing_id");
  }
  const taskDir = path.join(MUSIC_SOURCE_PARSER_TASK_DIR, sessionId);
  fs.mkdirSync(taskDir, { recursive: true });
  const taskPath = path.join(taskDir, `${taskId}.json`);
  fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));
  return taskPath;
}

function readQueuedMusicSourceParserTask(taskPath: string | null | undefined) {
  const safePath = String(taskPath || "").trim();
  if (!safePath) return null;
  try {
    const raw = fs.readFileSync(safePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeQueuedMusicSourceParserTask(task: Record<string, any>) {
  const taskPath = String(task?.task_path || "").trim();
  if (!taskPath) {
    throw new Error("music_source_parser_task_missing_path");
  }
  fs.mkdirSync(path.dirname(taskPath), { recursive: true });
  fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));
  return task;
}

function summarizeQueuedMusicSourceParserTask(task: Record<string, any>) {
  const sources = Array.isArray(task?.sources) ? task.sources : [];
  const parserFamily =
    String(task?.parser_family || "reference").trim() || "reference";
  const plannerTargets = Array.isArray(task?.planner_targets)
    ? task.planner_targets
        .map((value: unknown) => String(value || "").trim())
        .filter(Boolean)
    : [];
  const sourceKinds = sources
    .map((entry: any) => String(entry?.kind || "").trim())
    .filter(Boolean);
  return {
    parser_family: parserFamily,
    planner_targets: plannerTargets,
    source_kinds: sourceKinds,
    source_count: sources.length,
    source_labels: sources
      .map((entry: any) => String(entry?.file_name || entry?.kind || "").trim())
      .filter(Boolean)
      .slice(0, 4),
  };
}

function appendMusicSourceParserTaskStatus(
  task: Record<string, any>,
  status: string,
  stage: string,
  extra: Record<string, any> = {},
) {
  return {
    ...task,
    ...extra,
    status,
    status_history: [
      ...(Array.isArray(task?.status_history) ? task.status_history : []),
      {
        status,
        at: new Date().toISOString(),
        stage,
      },
    ],
  };
}

function buildQueuedMusicSourceParserResult(task: Record<string, any>) {
  const summary = summarizeQueuedMusicSourceParserTask(task);
  const sources = Array.isArray(task?.sources) ? task.sources : [];
  const resultId = `parser-result-${String(task?.task_id || "task").trim()}`;
  const sourceKinds = summary.source_kinds;
  const resultFamily =
    sourceKinds.includes("midi") && sourceKinds.includes("audio")
      ? "hybrid_symbolic_reference_extract"
      : sourceKinds.includes("musicxml") && sourceKinds.includes("scoreImage")
        ? "score_reconstruction_extract"
        : summary.parser_family === "midi_symbolic"
          ? "symbolic_melody_extract"
          : summary.parser_family === "musicxml_score"
            ? "structured_score_extract"
            : summary.parser_family === "score_ocr"
              ? "score_image_extract"
              : summary.parser_family === "audio_reference"
                ? "reference_audio_extract"
                : "multi_source_extract";
  const familyPayload =
    resultFamily === "hybrid_symbolic_reference_extract"
      ? {
          parser_lane: "hybrid_symbolic_reference",
          source_alignment: "symbolic_plus_audio_reference",
          extract_focus: "melody_rhythm_alignment",
        }
      : resultFamily === "score_reconstruction_extract"
        ? {
            parser_lane: "score_reconstruction",
            source_alignment: "musicxml_plus_score_image",
            extract_focus: "notation_recovery",
          }
        : resultFamily === "symbolic_melody_extract"
          ? {
              parser_lane: "symbolic_melody",
              source_alignment: "symbolic_primary",
              extract_focus: "melody_grid",
            }
          : resultFamily === "structured_score_extract"
            ? {
                parser_lane: "structured_score",
                source_alignment: "notation_primary",
                extract_focus: "score_phrase_map",
              }
            : resultFamily === "score_image_extract"
              ? {
                  parser_lane: "score_image_ocr",
                  source_alignment: "image_primary",
                  extract_focus: "ocr_staff_map",
                }
              : resultFamily === "reference_audio_extract"
                ? {
                    parser_lane: "audio_reference",
                    source_alignment: "audio_primary",
                    extract_focus: "reference_contour",
                  }
                : {
                    parser_lane: "multi_source",
                    source_alignment: "mixed",
                    extract_focus: "planner_bootstrap",
                  };
  const analysisBlocks =
    resultFamily === "hybrid_symbolic_reference_extract"
      ? {
          melodic_profile: "symbolic-audio-aligned",
          rhythmic_profile: "grid-reference-aligned",
          harmony_profile: "symbolic-shell-plus-reference",
        }
      : resultFamily === "score_reconstruction_extract"
        ? {
            melodic_profile: "ocr-plus-notation-rebuild",
            rhythmic_profile: "score-measure-reconstruction",
            harmony_profile: "notation-harmonic-map",
          }
        : {
            melodic_profile:
              sourceKinds.includes("midi") || sourceKinds.includes("musicxml")
                ? "symbolic-ready"
                : sourceKinds.includes("scoreImage")
                  ? "ocr-pending"
                  : "audio-reference",
            rhythmic_profile: sourceKinds.includes("midi")
              ? "grid-derived"
              : sourceKinds.includes("musicxml")
                ? "notation-derived"
                : "reference-estimate",
            harmony_profile: sourceKinds.includes("musicxml")
              ? "score-harmonic-map"
              : sourceKinds.includes("midi")
                ? "symbolic-chord-shell"
                : "style-reference",
          };
  const plannerHints =
    resultFamily === "hybrid_symbolic_reference_extract"
      ? {
          melody_seed_mode: "symbolic_reference_blend",
          arrangement_seed_mode: "reference_arrangement",
          parser_confidence: "high",
        }
      : resultFamily === "score_reconstruction_extract"
        ? {
            melody_seed_mode: "score_reconstruction_seed",
            arrangement_seed_mode: "symbolic_arrangement",
            parser_confidence: "medium_high",
          }
        : {
            melody_seed_mode: sourceKinds.includes("midi")
              ? "symbolic_seed"
              : sourceKinds.includes("musicxml")
                ? "score_seed"
                : sourceKinds.includes("scoreImage")
                  ? "ocr_seed"
                  : "reference_seed",
            arrangement_seed_mode: sourceKinds.includes("audio")
              ? "reference_arrangement"
              : "symbolic_arrangement",
            parser_confidence:
              sourceKinds.includes("musicxml") || sourceKinds.includes("midi")
                ? "high"
                : sourceKinds.includes("scoreImage")
                  ? "medium"
                  : "medium",
          };
  const extractedOutline =
    resultFamily === "hybrid_symbolic_reference_extract"
      ? {
          motif_candidates: Math.max(2, summary.source_count),
          rhythm_shell: "symbolic_reference_fusion",
          next_worker: "hybrid_music_source_parser_worker",
        }
      : resultFamily === "score_reconstruction_extract"
        ? {
            motif_candidates: Math.max(1, summary.source_count),
            rhythm_shell: "score_reconstruction_shell",
            next_worker: "score_reconstruction_worker",
          }
        : {
            motif_candidates: Math.max(1, summary.source_count),
            rhythm_shell: sourceKinds.includes("midi")
              ? "midi_grid_reference"
              : sourceKinds.includes("musicxml")
                ? "score_phrase_reference"
                : sourceKinds.includes("scoreImage")
                  ? "ocr_score_reference"
                  : "audio_reference_shell",
            next_worker: "music_source_parser_worker",
          };
  return {
    result_id: resultId,
    result_family: resultFamily,
    schema: MUSIC_SOURCE_PARSER_RESULT_SCHEMA,
    schema_version: 1,
    worker_protocol: "shared-parser-task-worker.v1",
    produced_at: new Date().toISOString(),
    task_id: String(task?.task_id || "").trim(),
    parser_family: summary.parser_family,
    planner_targets: summary.planner_targets,
    source_kinds: summary.source_kinds,
    source_count: summary.source_count,
    source_assets: sources.map((source: any) => ({
      kind: String(source?.kind || "").trim(),
      file_name: String(source?.file_name || "").trim(),
      asset_key: String(source?.asset_key || "").trim(),
      parser_family: String(source?.parser_family || "").trim(),
    })),
    analysis_shell: {
      parser_family: summary.parser_family,
      planner_targets: summary.planner_targets,
      next_stage: familyPayload.parser_lane,
    },
    family_payload: familyPayload,
    analysis_blocks: analysisBlocks,
    planner_hints: plannerHints,
    extracted_outline: extractedOutline,
    summary_line: `Prepared ${summary.source_count} source(s) for ${resultFamily}.`,
  };
}

function listQueuedMusicSourceParserTaskFiles() {
  if (!fs.existsSync(MUSIC_SOURCE_PARSER_TASK_DIR)) return [] as string[];
  const files: string[] = [];
  for (const sessionId of fs.readdirSync(MUSIC_SOURCE_PARSER_TASK_DIR)) {
    const sessionDir = path.join(MUSIC_SOURCE_PARSER_TASK_DIR, sessionId);
    if (!fs.statSync(sessionDir, { throwIfNoEntry: false })?.isDirectory())
      continue;
    for (const entry of fs.readdirSync(sessionDir)) {
      if (entry.endsWith(".json")) {
        files.push(path.join(sessionDir, entry));
      }
    }
  }
  files.sort((left, right) => {
    try {
      return fs.statSync(left).mtimeMs - fs.statSync(right).mtimeMs;
    } catch {
      return 0;
    }
  });
  return files;
}

function claimNextQueuedMusicSourceParserTask() {
  for (const taskPath of listQueuedMusicSourceParserTaskFiles()) {
    const current = readQueuedMusicSourceParserTask(taskPath);
    if (!current || String(current.status || "").trim() !== "queued") continue;
    const claimed = appendMusicSourceParserTaskStatus(
      {
        ...current,
        task_path: taskPath,
      },
      "processing",
      "metadata_extract",
      {
        processing_started_at: new Date().toISOString(),
        worker_protocol: "shared-parser-task-worker.v1",
      },
    );
    writeQueuedMusicSourceParserTask(claimed);
    return claimed;
  }
  return null;
}

function completeQueuedMusicSourceParserTask(taskPath: string) {
  const current = readQueuedMusicSourceParserTask(taskPath);
  if (!current || String(current.status || "").trim() !== "processing")
    return null;
  const completed = appendMusicSourceParserTaskStatus(
    {
      ...current,
      task_path: taskPath,
      parser_result: buildQueuedMusicSourceParserResult(current),
    },
    "completed",
    "parser_result_ready",
    {
      completed_at: new Date().toISOString(),
    },
  );
  writeQueuedMusicSourceParserTask(completed);
  return completed;
}

let musicSourceParserWorkerTimer: NodeJS.Timeout | null = null;
let musicSourceParserWorkerBusy = false;

function scheduleMusicSourceParserWorker(delayMs = 0) {
  if (musicSourceParserWorkerTimer) return;
  musicSourceParserWorkerTimer = setTimeout(
    () => {
      musicSourceParserWorkerTimer = null;
      pumpMusicSourceParserWorker();
    },
    Math.max(0, delayMs),
  );
}

function pumpMusicSourceParserWorker() {
  if (musicSourceParserWorkerBusy) return;
  const claimed: Record<string, any> | null =
    claimNextQueuedMusicSourceParserTask();
  if (!claimed) return;
  musicSourceParserWorkerBusy = true;
  setTimeout(() => {
    try {
      completeQueuedMusicSourceParserTask(
        String(claimed.task_path || "").trim(),
      );
    } finally {
      musicSourceParserWorkerBusy = false;
      scheduleMusicSourceParserWorker(0);
    }
  }, MUSIC_SOURCE_PARSER_WORKER_TICK_MS);
}

function resolveStoredMusicSourceParserTask(
  rawTask: Record<string, any> | null | undefined,
) {
  if (!rawTask || typeof rawTask !== "object") return null;
  return (
    readQueuedMusicSourceParserTask(String(rawTask.task_path || "").trim()) ||
    rawTask
  );
}

function normalizeCssmvOpenAiSongSeed(
  input: CssmvSongSeedInput,
  parsed: CssmvOpenAiSongSeedRaw,
  model: string,
) {
  const title = String(parsed?.title || "").trim();
  const rawLyrics = String(parsed?.lyrics || "").trim();
  const musicStyle = String(parsed?.music_style || "").trim();
  const referencesRaw = Array.isArray(parsed?.references)
    ? parsed.references
        .map((x: unknown) => String(x || "").trim())
        .filter(Boolean)
    : [];
  const musicStructure = String(parsed?.music_structure || "").trim();
  const videoOutline = String(parsed?.video_outline || "").trim();
  const sectionPrompts = Array.isArray(parsed?.section_prompts)
    ? parsed.section_prompts
        .map((item: unknown) => {
          const row = item as {
            section?: unknown;
            title?: unknown;
            prompt?: unknown;
          };
          return {
            section: String(row?.section || "").trim(),
            title: String(row?.title || "").trim(),
            prompt: String(row?.prompt || "").trim(),
          };
        })
        .filter(
          (item: { section: string; title: string; prompt: string }) =>
            item.section && item.title && item.prompt,
        )
    : [];
  const sectionBeats = Array.isArray(parsed?.section_beats)
    ? parsed.section_beats
        .map((item: unknown) => {
          const row = item as {
            section?: unknown;
            title?: unknown;
            bars?: unknown;
            energy?: unknown;
            focus?: unknown;
            visual_role?: unknown;
          };
          return {
            section: String(row?.section || "").trim(),
            title: String(row?.title || "").trim(),
            bars: Number.parseInt(String(row?.bars || "0"), 10) || 0,
            energy: String(row?.energy || "").trim(),
            focus: String(row?.focus || "").trim(),
            visual_role: String(row?.visual_role || "").trim(),
          };
        })
        .filter(
          (item: {
            section: string;
            title: string;
            bars: number;
            energy: string;
            focus: string;
            visual_role: string;
          }) =>
            item.section &&
            item.title &&
            item.bars > 0 &&
            item.energy &&
            item.focus &&
            item.visual_role,
        )
    : [];
  const styleTags = Array.isArray(parsed?.style_tags)
    ? parsed.style_tags
        .map((x: unknown) => String(x || "").trim())
        .filter(Boolean)
    : [];
  const normalizedLyrics = normalizeCssmvLyrics(rawLyrics);
  if (!title || !normalizedLyrics) {
    return buildCssmvSongSeedFallbackWithMeta(input, {
      openaiModel: model,
      fallbackReason: "invalid_openai_payload",
    });
  }
  if (!lyricsMatchTargetLanguage(normalizedLyrics, input.language)) {
    return buildCssmvSongSeedFallbackWithMeta(input, {
      openaiModel: model,
      fallbackReason: "language_mismatch",
    });
  }
  if (
    !lyricsAreSubstantialEnough(normalizedLyrics, input.language) ||
    lyricsLookLikeVideoScript(normalizedLyrics)
  ) {
    return buildCssmvSongSeedFallbackWithMeta(input, {
      openaiModel: model,
      fallbackReason: "lyrics_incomplete_or_scripty",
    });
  }
  if (shouldRejectCssmvSeed(title, normalizedLyrics)) {
    return buildCssmvSongSeedFallbackWithMeta(input, {
      openaiModel: model,
      fallbackReason: "quality_rejected",
    });
  }
  if (
    !lyricsSatisfyCanonProfile(detectCssmvCanonProfile(input), {
      title,
      lyrics: normalizedLyrics,
      videoOutline,
      musicStyle,
    })
  ) {
    return buildCssmvSongSeedFallbackWithMeta(input, {
      openaiModel: model,
      fallbackReason: "canon_mismatch",
    });
  }
  const references = referencesRaw.map((ref: string) => {
    if (/^https?:\/\//i.test(ref)) return ref;
    return `https://duckduckgo.com/?q=${encodeURIComponent(ref)}`;
  });
  const blueprint = buildCssmvCreativeBlueprint(input);
  const safeTitle =
    String(input.title || "").trim() ||
    (titleMatchesTargetLanguage(title, input.language)
      ? title
      : buildCssmvDynamicTitle(blueprint, input.language));
  const defaultSectionPrompts = buildDefaultCssmvSectionPrompts(
    safeTitle,
    blueprint,
  );
  const defaultSectionBeats = buildDefaultCssmvSectionBeats(blueprint);
  const workType = normalizeStructuredWorkType(input.constraints?.work_type);
  const structurePlan = normalizeSongSeedStructurePlan(
    input.constraints?.structure_plan,
  );
  const normalizedSectionPrompts =
    sectionPrompts.length === CSSMV_CANONICAL_SECTIONS.length
      ? sectionPrompts.map(
          (
            item: { section: string; title: string; prompt: string },
            index: number,
          ) => ({
            section:
              normalizeCssmvSectionLabel(item.section) ||
              defaultSectionPrompts[index]?.section ||
              item.section,
            title:
              item.title || defaultSectionPrompts[index]?.title || item.section,
            prompt: item.prompt,
          }),
        )
      : defaultSectionPrompts;
  const normalizedSectionBeats =
    sectionBeats.length === CSSMV_CANONICAL_SECTIONS.length
      ? sectionBeats.map(
          (
            item: {
              section: string;
              title: string;
              bars: number;
              energy: string;
              focus: string;
              visual_role: string;
            },
            index: number,
          ) => ({
            section:
              normalizeCssmvSectionLabel(item.section) ||
              defaultSectionBeats[index]?.section ||
              item.section,
            title:
              item.title || defaultSectionBeats[index]?.title || item.section,
            bars: item.bars || defaultSectionBeats[index]?.bars || 8,
            energy:
              item.energy || defaultSectionBeats[index]?.energy || "medium",
            focus: item.focus || defaultSectionBeats[index]?.focus || "",
            visual_role:
              item.visual_role || defaultSectionBeats[index]?.visual_role || "",
          }),
        )
      : defaultSectionBeats;
  return tagCssmvSongSeedSource(
    {
      model,
      openai_model: model,
      title: safeTitle,
      work_type: workType,
      lyrics: normalizedLyrics,
      music_style: musicStyle,
      references,
      music_structure:
        musicStructure ||
        "Begin with a low-energy atmospheric intro, grow through Verses 1-4, make Chorus 1 and Chorus 2 chantable, lift into a cosmic Bridge, explode at Chorus 3, intensify further at Chorus 4, and land with an unresolved Outro echo.",
      video_outline: videoOutline,
      section_prompts: normalizedSectionPrompts,
      section_beats: normalizedSectionBeats,
      structure_tree: inferStructureTreeFromSongSeed({
        title: safeTitle,
        workType,
        sectionRows: normalizedSectionBeats,
        ...(structurePlan ? { structurePlan } : {}),
      }),
      ...(structurePlan ? { structure_plan: structurePlan } : {}),
      style_tags: styleTags,
      creative_summary: buildCssmvCreativeSummary(blueprint),
    },
    "openai",
  );
}

async function requestOpenAiCssmvSongSeed(
  input: CssmvSongSeedInput,
  apiKey: string,
  model: string,
  timeoutMs: number,
  onFailure: (failure: CssmvOpenAiFailure) => void,
  prefer?: string[],
) {
  const messages = [
    {
      role: "system" as const,
      content:
        "Generate structured creative seeds for cssMV. Favor bold divergence, vivid specificity, and materially different song identities across variations while preserving the requested title and output schema.",
    },
    {
      role: "user" as const,
      content: buildCssmvSongSeedPrompt(input),
    },
  ];
  const jsonSchema = {
    type: "json_schema" as const,
    json_schema: {
      name: "cssmv_song_seed",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          lyrics: { type: "string" },
          music_style: { type: "string" },
          references: {
            type: "array",
            items: { type: "string" },
          },
          music_structure: { type: "string" },
          video_outline: { type: "string" },
          section_prompts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                section: { type: "string" },
                title: { type: "string" },
                prompt: { type: "string" },
              },
              required: ["section", "title", "prompt"],
            },
          },
          section_beats: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                section: { type: "string" },
                title: { type: "string" },
                bars: { type: "number" },
                energy: { type: "string" },
                focus: { type: "string" },
                visual_role: { type: "string" },
              },
              required: [
                "section",
                "title",
                "bars",
                "energy",
                "focus",
                "visual_role",
              ],
            },
          },
          style_tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "title",
          "lyrics",
          "music_style",
          "references",
          "music_structure",
          "video_outline",
          "section_prompts",
          "section_beats",
          "style_tags",
        ],
      },
    },
  };
  const requestPayload = async (
    responseFormat?: Record<string, unknown>,
    attempt = 1,
  ) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs + (attempt - 1) * 15000,
    );
    try {
      // CSSOS_LLM_ROUTER 20260506 — song-seed migrated to the unified
      // router. Goes through Groq → Cerebras → OpenAI in order. The
      // controller/abort-signal logic stays so a stuck provider can
      // be cancelled at the call-site level.
      const result = await callLlm({
        messages,
        ...(responseFormat ? { response_format: responseFormat } : {}),
        ...(prefer && prefer.length ? { prefer } : {}),
      });
      clearTimeout(timeout);
      if (!result.ok) {
        const failure = {
          status: result.status,
          code: `http_${result.status}`,
          message: result.error || "LLM request failed",
          type: "",
        };
        onFailure(failure);
        console.warn("[cssmv.song_seed] LLM request failed", {
          status: failure.status,
          code: failure.code,
          attempt,
          provider: result.provider,
          hasTitle: Boolean(String(input.title || "").trim()),
          language: String(input.language || "").trim() || "zh",
        });
        if (
          attempt < 3 &&
          (failure.status === 408 ||
            failure.status === 429 ||
            failure.status === 502 ||
            failure.status === 503)
        ) {
          await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
          return requestPayload(responseFormat, attempt + 1);
        }
        return null;
      }
      const content = result.content.trim();
      if (!content) return null;
      try {
        return JSON.parse(content) as CssmvOpenAiSongSeedRaw;
      } catch {
        const match = content.match(/\{[\s\S]*\}$/);
        if (!match) return null;
        try {
          return JSON.parse(match[0]) as CssmvOpenAiSongSeedRaw;
        } catch {
          return null;
        }
      }
    } catch (error) {
      clearTimeout(timeout);
      const failure = {
        status: controller.signal.aborted ? 408 : 0,
        code: controller.signal.aborted ? "request_timeout" : "request_failed",
        message:
          error instanceof Error
            ? error.message
            : "OpenAI request failed unexpectedly",
        type: controller.signal.aborted ? "timeout" : "network_error",
      };
      onFailure(failure);
      console.warn("[cssmv.song_seed] OpenAI request threw", {
        status: failure.status,
        code: failure.code,
        type: failure.type,
        attempt,
        model,
        hasTitle: Boolean(String(input.title || "").trim()),
        language: String(input.language || "").trim() || "zh",
      });
      if (
        attempt < 3 &&
        (failure.status === 408 ||
          failure.code === "request_timeout" ||
          failure.code === "request_failed")
      ) {
        await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
        return requestPayload(responseFormat, attempt + 1);
      }
      return null;
    }
  };
  return (
    (await requestPayload(jsonSchema)) ||
    (await requestPayload({ type: "json_object" })) ||
    null
  );
}

async function generateCssmvSongSeed(input: CssmvSongSeedInput) {
  const runtimeConfig = getOpenAiRuntimeConfig();
  const apiKey = runtimeConfig.apiKey;
  if (!apiKey) {
    return buildCssmvSongSeedFallbackWithMeta(input, {
      openaiEnvSource: runtimeConfig.envSource,
      fallbackReason: "missing_api_key",
    });
  }
  const model = runtimeConfig.model;
  const timeoutMs = Math.max(
    5000,
    Number.parseInt(
      String(process.env.OPENAI_TEXT_TIMEOUT_MS || "45000"),
      10,
    ) || 45000,
  );
  let openAiFailure: {
    status?: number;
    code?: string;
    message?: string;
    type?: string;
  } | null = null;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parsed = await requestOpenAiCssmvSongSeed(
        {
          ...input,
          variationNonce: `${String(input.variationNonce || "seed").trim()}::openai-${attempt + 1}`,
        },
        apiKey,
        model,
        timeoutMs,
        (failure) => {
          openAiFailure = failure;
        },
      );
      if (!parsed) {
        continue;
      }
      const normalized = normalizeCssmvOpenAiSongSeed(input, parsed, model) as Record<string, any>;
      if (normalized?.seed_source === "openai" && !normalized?.fallback_reason) {
        return normalized;
      }
      if (
        ![
          "invalid_openai_payload",
          "language_mismatch",
          "lyrics_incomplete_or_scripty",
          "quality_rejected",
          "canon_mismatch",
        ].includes(String(normalized?.fallback_reason || ""))
      ) {
        return normalized;
      }
    }
    const failure = openAiFailure as {
      status?: number;
      code?: string;
      message?: string;
      type?: string;
    } | null;
    const meta: {
      openaiErrorCode?: string;
      openaiErrorType?: string;
      openaiErrorMessage?: string;
      openaiErrorStatus?: number;
      openaiModel?: string;
      openaiEnvSource?: string;
      openaiKeyFingerprint?: string;
      fallbackReason?: string;
    } = {
      openaiModel: model,
      openaiEnvSource: runtimeConfig.envSource,
      openaiKeyFingerprint: runtimeConfig.keyFingerprint,
      fallbackReason: failure?.code
        ? "openai_error"
        : "openai_empty_or_invalid_lyrics",
    };
    if (failure?.code) meta.openaiErrorCode = failure.code;
    if (failure?.type) meta.openaiErrorType = failure.type;
    if (failure?.message) meta.openaiErrorMessage = failure.message;
    if (typeof failure?.status === "number")
      meta.openaiErrorStatus = failure.status;
    return buildCssmvSongSeedFallbackWithMeta(input, meta);
  } catch {
    const failure = openAiFailure as {
      status?: number;
      code?: string;
      message?: string;
      type?: string;
    } | null;
    const meta: {
      openaiErrorCode?: string;
      openaiErrorType?: string;
      openaiErrorMessage?: string;
      openaiErrorStatus?: number;
      openaiModel?: string;
      openaiEnvSource?: string;
      openaiKeyFingerprint?: string;
      fallbackReason?: string;
    } = {
      openaiErrorCode: failure?.code || "seed_generation_failed",
      openaiErrorMessage: failure?.message || "Song seed generation failed",
      openaiModel: model,
      openaiEnvSource: runtimeConfig.envSource,
      openaiKeyFingerprint: runtimeConfig.keyFingerprint,
      fallbackReason: "unexpected_error",
    };
    if (failure?.type) meta.openaiErrorType = failure.type;
    if (typeof failure?.status === "number")
      meta.openaiErrorStatus = failure.status;
    return buildCssmvSongSeedFallbackWithMeta(input, meta);
  }
}

app.post("/api/cssmv/thumbnail", async (req, res) => {
  noStore(res);
  try {
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      return res.json(okEmpty({ generated: false }, "No data yet"));
    }
    const title = String(req.body?.title || "").trim();
    const subtitle = String(req.body?.subtitle || "").trim();
    const lyrics = Array.isArray(req.body?.lyrics) ? req.body.lyrics : [];
    const visualDirective = String(
      req.body?.visual_directive || req.body?.prompt || "",
    ).trim();
    const prompt = buildCssmvThumbnailPrompt(
      title,
      subtitle,
      lyrics,
      visualDirective,
    );
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const requestedSize = String(
      req.body?.size || process.env.OPENAI_IMAGE_SIZE || "1024x1024",
    ).trim();
    const size = ["1024x1024", "1024x1536", "1536x1024", "auto"].includes(
      requestedSize,
    )
      ? requestedSize
      : "1024x1024";
    const requestedQuality = String(
      req.body?.quality || process.env.OPENAI_IMAGE_QUALITY || "medium",
    ).trim();
    const quality = ["low", "medium", "high", "auto"].includes(requestedQuality)
      ? requestedQuality
      : "low";
    const requestedOutputFormat = String(
      req.body?.output_format ||
        process.env.OPENAI_IMAGE_OUTPUT_FORMAT ||
        "webp",
    ).trim();
    const outputFormat = ["webp", "png", "jpeg"].includes(requestedOutputFormat)
      ? requestedOutputFormat
      : "webp";
    const requestedCompression = Number.parseInt(
      String(
        req.body?.output_compression ||
          process.env.OPENAI_IMAGE_OUTPUT_COMPRESSION ||
          "60",
      ),
      10,
    );
    const outputCompression =
      Number.isFinite(requestedCompression) &&
      requestedCompression >= 0 &&
      requestedCompression <= 100
        ? requestedCompression
        : 60;
    const requestedBackground = String(
      req.body?.background || process.env.OPENAI_IMAGE_BACKGROUND || "opaque",
    ).trim();
    const background = ["transparent", "opaque", "auto"].includes(
      requestedBackground,
    )
      ? requestedBackground
      : "transparent";
    const timeoutMs = Math.max(
      5000,
      Number.parseInt(
        String(process.env.OPENAI_IMAGE_TIMEOUT_MS || "45000"),
        10,
      ) || 45000,
    );
    // CSSOS_IMAGE_ROUTER 20260506 — through the unified image router so
    // we get fal.ai Flux schnell first (free/cheap, fast), OpenAI as
    // fallback. Same response envelope; front-end is unchanged.
    const result = await callImageGen({
      prompt,
      size,
      quality,
      output_format: outputFormat,
      background,
    });
    if (!result.ok) {
      console.warn(
        "[cssmv/thumbnail] image-router failed: %s — soft-empty response",
        result.error,
      );
      return res.json(
        okEmpty(
          {
            generated: false,
            model: result.model || model,
            size,
            quality,
            output_format: outputFormat,
            output_compression: outputCompression,
            background,
            upstream_status: result.status,
          },
          "No data yet",
        ),
      );
    }
    if (result.image_b64) {
      return res.json(
        okData({
          generated: true,
          image_data_url: `data:image/${outputFormat};base64,${result.image_b64}`,
          model: result.model,
          provider: result.provider,
          size,
          quality,
          output_format: outputFormat,
          output_compression: outputCompression,
          background,
        }),
      );
    }
    if (result.image_url) {
      return res.json(
        okData({
          generated: true,
          image_url: result.image_url,
          model: result.model,
          provider: result.provider,
          size,
          quality,
          output_format: outputFormat,
          output_compression: outputCompression,
          background,
        }),
      );
    }
    return res.json(
      okEmpty(
        {
          generated: false,
          model,
          size,
          quality,
          output_format: outputFormat,
          output_compression: outputCompression,
          background,
        },
        "No data yet",
      ),
    );
  } catch (_err) {
    return res.json(okEmpty({ generated: false }, "No data yet"));
  }
});

app.post(
  "/api/mic/transcribe",
  express.raw({ type: () => true, limit: "20mb" }),
  async (req, res) => {
    noStore(res);
    const runtimeConfig = getOpenAiRuntimeConfig();
    const model = getOpenAiTranscribeModel();
    const contentType =
      String(req.headers["content-type"] || "audio/webm").trim() ||
      "audio/webm";
    const wakeSpell = String(req.headers["x-cssos-wake-spell"] || "").trim();
    const audioBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    if (!audioBuffer.length) {
      return res.json(
        okEmpty(
          { transcript: "", lang: "zh", model },
          "No audio body supplied",
        ),
      );
    }
    if (!runtimeConfig.apiKey) {
      return res.json(
        okEmpty(
          {
            transcript: "",
            lang: "zh",
            model,
            env_source: runtimeConfig.envSource,
            error_code: "missing_api_key",
          },
          "OpenAI API key is not configured",
        ),
      );
    }
    try {
      const form = new FormData();
      const extension =
        contentType.includes("mp4") || contentType.includes("m4a")
          ? "m4a"
          : contentType.includes("mpeg") || contentType.includes("mp3")
            ? "mp3"
            : contentType.includes("wav")
              ? "wav"
              : "webm";
      form.set(
        "file",
        new Blob([new Uint8Array(audioBuffer)], { type: contentType }),
        `mic-capture.${extension}`,
      );
      form.set("model", model);
      form.set("language", "zh");
      form.set(
        "prompt",
        [
          "Transcribe the speaker's Chinese words faithfully.",
          "Preserve proper nouns, song titles, and Chinese named entities exactly when possible.",
          wakeSpell ? `Wake spell may be present: ${wakeSpell}.` : "",
          "Do not summarize. Return the raw utterance.",
        ]
          .filter(Boolean)
          .join(" "),
      );
      form.set("response_format", "json");
      const upstream = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${runtimeConfig.apiKey}`,
          },
          body: form,
        },
      );
      const payload = await upstream.json().catch(() => null);
      const transcript = String(
        payload?.text || payload?.transcript || "",
      ).trim();
      if (!upstream.ok) {
        const errorBody =
          payload && typeof payload === "object"
            ? (payload.error as Record<string, unknown> | undefined)
            : undefined;
        return res.status(upstream.status).json(
          okEmpty(
            {
              transcript: "",
              lang: "zh",
              model,
              env_source: runtimeConfig.envSource,
              error_code: String(
                errorBody?.code || errorBody?.type || "transcribe_failed",
              ),
              error_message: String(
                errorBody?.message || "OpenAI transcription failed",
              ),
            },
            "Transcription failed",
          ),
        );
      }
      return res.json(
        okData({
          transcript,
          lang: "zh",
          model,
          env_source: runtimeConfig.envSource,
        }),
      );
    } catch (error) {
      return res.status(500).json(
        okEmpty(
          {
            transcript: "",
            lang: "zh",
            model,
            env_source: runtimeConfig.envSource,
            error_code: "transcribe_exception",
            error_message:
              error instanceof Error
                ? error.message
                : "Unknown transcription error",
          },
          "Transcription failed",
        ),
      );
    }
  },
);

app.post("/api/cssmv/song-seed", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    const access = await resolveUserAccessProfile(user);
    const queueLane = queueLaneForTier(access.tier);
    const mode = String(req.body?.mode || "music_video").trim();
    const transcript = String(req.body?.transcript || "").trim();
    const title = String(req.body?.title || "").trim();
    const style = String(req.body?.style || "").trim();
    const voice = String(req.body?.voice || "").trim();
    const language = String(req.body?.language || "zh").trim();
    const variationNonce = String(req.body?.variation_nonce || "").trim();
    const constraints =
      req.body?.constraints && typeof req.body.constraints === "object"
        ? req.body.constraints
        : undefined;
    const seed = await generateCssmvSongSeed({
      mode,
      transcript,
      title,
      style,
      voice,
      language,
      variationNonce,
      constraints,
    });
    if (!seed) {
      return res.json(okEmpty({ generated: false }, "No data yet"));
    }
    const seedMeta = seed as Record<string, unknown>;
    return res.json(
      okData({
        generated: true,
        title: seed.title,
        work_type: seedMeta.work_type,
        lyrics: seed.lyrics,
        music_style: seed.music_style,
        references: seed.references,
        music_structure: seed.music_structure,
        video_outline: seed.video_outline,
        section_prompts: seed.section_prompts,
        section_beats: seed.section_beats,
        structure_tree: seedMeta.structure_tree,
        structure_plan: seedMeta.structure_plan,
        style_tags: seed.style_tags,
        creative_summary: seed.creative_summary,
        model: seed.model,
        openai_model: seedMeta.openai_model,
        openai_env_source: seedMeta.openai_env_source,
        openai_key_fingerprint: seedMeta.openai_key_fingerprint,
        openai_error_type: seedMeta.openai_error_type,
        openai_error_code: seedMeta.openai_error_code,
        openai_error_message: seedMeta.openai_error_message,
        openai_error_status: seedMeta.openai_error_status,
        fallback_reason: seedMeta.fallback_reason,
        queue_lane: queueLane,
        membership_tier: access.tier,
      }),
    );
  } catch {
    return res.json(okEmpty({ generated: false }, "No data yet"));
  }
});

app.get("/api/cssmv/openai-diagnostics", (_req, res) => {
  noStore(res);
  try {
    return res.json(okData(getOpenAiDiagnosticsPayload()));
  } catch (error) {
    return res.status(500).json(
      okEmpty(
        {
          provider: "openai",
          diagnostics_error:
            error instanceof Error ? error.message : "diagnostics_failed",
        },
        "No data yet",
      ),
    );
  }
});

app.get("/api/cssmv/openai-probe", async (_req, res) => {
  noStore(res);
  try {
    const probe = await runOpenAiProbe();
    return res.status(probe.ok ? 200 : 502).json(okData(probe));
  } catch (error) {
    return res.status(500).json(
      okEmpty(
        {
          provider: "openai",
          probe_error: error instanceof Error ? error.message : "probe_failed",
        },
        "No data yet",
      ),
    );
  }
});

app.get("/api/auth/diagnostics", handleAuthDiagnostics);
app.get("/auth/github", handleGitHubAuthStart);
app.get("/api/auth/github", (_req, res) => res.redirect(302, "/auth/github"));
app.get("/api/auth/github/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/github/callback${q}`);
});
app.get("/oauth/github/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/github/callback${q}`);
});

async function oauthExchangeTokenForm(
  tokenUrl: string,
  form: URLSearchParams,
  headers?: Record<string, string>,
) {
  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...(headers || {}),
    },
    body: form.toString(),
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, json: j };
}

async function ensureAuthIdentityTable() {
  if (!DATABASE_URL) return;
  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS oauth_identities (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (provider, provider_user_id)
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS oauth_identities_user_id_idx ON oauth_identities(user_id)",
    );
  });
}

async function ensureOAuthTokensTable() {
  if (!DATABASE_URL) return;
  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_user_id TEXT,
        access_token TEXT,
        refresh_token TEXT,
        scope TEXT,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (provider, user_id)
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS oauth_tokens_user_id_idx ON oauth_tokens(user_id)",
    );
  });
}

async function upsertOAuthToken(args: {
  userId: string;
  provider: string;
  providerUserId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  scope?: string | null;
  expiresInSeconds?: number | null;
}) {
  if (!DATABASE_URL) return;
  const {
    userId,
    provider,
    providerUserId,
    accessToken,
    refreshToken,
    scope,
    expiresInSeconds,
  } = args;
  const expiresAt =
    expiresInSeconds && expiresInSeconds > 0
      ? new Date(Date.now() + expiresInSeconds * 1000)
      : null;
  await withClient(async (client) => {
    await client.query(
      `
      INSERT INTO oauth_tokens (
        user_id,
        provider,
        provider_user_id,
        access_token,
        refresh_token,
        scope,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (provider, user_id)
      DO UPDATE SET
        provider_user_id = EXCLUDED.provider_user_id,
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
        scope = EXCLUDED.scope,
        expires_at = EXCLUDED.expires_at,
        updated_at = now()
    `,
      [
        userId,
        provider,
        providerUserId || null,
        accessToken || null,
        refreshToken || null,
        scope || null,
        expiresAt,
      ],
    );
  });
}

function appBaseUrl(req: express.Request) {
  const envUrl = (process.env.APP_BASE_URL || "").trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const proto =
    (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = (
    (req.headers["x-forwarded-host"] as string) ||
    req.headers.host ||
    `localhost:${PORT}`
  ).toString();
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function resolvePipelineStatusPath(inputPath: string) {
  const requested = String(inputPath || "").trim();
  if (!requested) return null;
  const candidate = requested.endsWith(".json")
    ? requested
    : path.join(requested, "run.json");
  const resolved = path.resolve(candidate);
  const allowedRoots = Array.from(
    new Set([
      path.resolve(SHARED_RUNS_DIR),
      path.resolve("/srv/cssos/shared/runs"),
      path.resolve(path.join(__dirname, "..", "..", "shared", "runs")),
    ]),
  );
  const isAllowed = allowedRoots.some(
    (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`),
  );
  if (!isAllowed) return null;
  if (
    !resolved.endsWith(`${path.sep}run.json`) &&
    path.basename(resolved) !== "run.json"
  )
    return null;
  return resolved;
}

function guessPipelineArtifactKind(p: string) {
  const lower = String(p || "")
    .trim()
    .toLowerCase();
  if (lower.endsWith(".wav")) return "audio";
  if (lower.endsWith(".mp4")) return "video";
  if (
    lower.endsWith(".ass") ||
    lower.endsWith(".srt") ||
    lower.endsWith(".lrc")
  )
    return "subtitles";
  if (lower.endsWith(".json")) return "json";
  return "file";
}

function guessPipelineArtifactMime(p: string) {
  const lower = String(p || "")
    .trim()
    .toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".ass")) return "text/x-ssa";
  if (lower.endsWith(".srt")) return "application/x-subrip";
  if (lower.endsWith(".lrc")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function buildRunArtifactAssetKey(runId: string, artifactPath: string) {
  const safeRunId = String(runId || "").trim();
  const safePath = String(artifactPath || "")
    .trim()
    .replace(/^[./\\]+/, "")
    .replace(/\\/g, "/");
  if (!safeRunId || !safePath) return "";
  return `runs/${safeRunId}/${safePath}`;
}

function buildDurableWorkArtifactAssetKey(runId: string, artifactPath: string) {
  const safeRunId = String(runId || "").trim();
  const safePath = String(artifactPath || "")
    .trim()
    .replace(/^[./\\]+/, "")
    .replace(/\\/g, "/");
  if (!safeRunId || !safePath) return "";
  const trimmedPath = safePath.replace(/^build\//i, "");
  return `works/${safeRunId}/${trimmedPath}`;
}

function isStoredWorkAssetReference(value: unknown) {
  const raw = String(value || "").trim();
  return raw.startsWith("works/") || raw.startsWith("runs/");
}

function normalizeStoredWorkAssetReference(runId: string, value: unknown) {
  const safeRunId = String(runId || "").trim();
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("works/")) return raw;
  if (raw.startsWith("runs/")) {
    const match = raw.match(/^runs\/([^/]+)\/(.+)$/i);
    const effectiveRunId = String(match?.[1] || safeRunId || "").trim();
    const artifactPath = String(match?.[2] || "").trim();
    return buildDurableWorkArtifactAssetKey(effectiveRunId, artifactPath);
  }
  return raw;
}

function tryParsePreviewVideoAssetKey(runId: string, value: unknown) {
  const safeRunId = String(runId || "").trim();
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isStoredWorkAssetReference(raw)) {
    return normalizeStoredWorkAssetReference(safeRunId, raw);
  }
  try {
    const parsed = new URL(raw, "https://cssstudio.app");
    const embeddedAssetKey = String(
      parsed.searchParams.get("asset_key") || "",
    ).trim();
    if (embeddedAssetKey) {
      return normalizeStoredWorkAssetReference(safeRunId, embeddedAssetKey);
    }
    const pathValue = String(parsed.searchParams.get("path") || "").trim();
    const pathRunId =
      parsed.pathname.match(
        /\/cssapi\/v1\/runs\/([^/]+)\/music-delivery-artifact/i,
      )?.[1] || safeRunId;
    if (pathValue && pathRunId) {
      return buildDurableWorkArtifactAssetKey(pathRunId, pathValue);
    }
  } catch {
    return "";
  }
  return "";
}

function resolveStoredPreviewVideoReference(
  runId: string,
  storedValue: unknown,
) {
  const safeRunId = String(runId || "").trim();
  const raw = String(storedValue || "").trim();
  if (!raw) {
    return {
      previewVideoUrl: null,
      previewVideoAssetKey: null,
    };
  }
  const assetKey = tryParsePreviewVideoAssetKey(safeRunId, raw);
  if (assetKey && safeRunId) {
    return {
      previewVideoUrl: `/cssapi/v1/runs/${encodeURIComponent(safeRunId)}/music-delivery-artifact?asset_key=${encodeURIComponent(assetKey)}`,
      previewVideoAssetKey: assetKey,
    };
  }
  return {
    previewVideoUrl: raw,
    previewVideoAssetKey: null,
  };
}

function inferWorkAssetExtension(contentType: string, fallback = "bin") {
  const safeType = String(contentType || "")
    .trim()
    .toLowerCase()
    .split(";")[0];
  if (safeType === "image/png") return "png";
  if (safeType === "image/jpeg") return "jpg";
  if (safeType === "image/webp") return "webp";
  if (safeType === "image/gif") return "gif";
  if (safeType === "image/svg+xml") return "svg";
  if (safeType === "video/mp4") return "mp4";
  if (safeType === "video/webm") return "webm";
  if (safeType === "video/quicktime") return "mov";
  return fallback;
}

function decodeDataUrlAsset(value: string) {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (!match) return null;
  const contentType = String(match[1] || "application/octet-stream").trim();
  const payload = String(match[2] || "").trim();
  if (!payload) return null;
  try {
    return {
      contentType,
      buffer: Buffer.from(payload, "base64"),
    };
  } catch {
    return null;
  }
}

function tryParseWorkBlobAssetKey(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isStoredWorkAssetReference(raw)) {
    return normalizeStoredWorkAssetReference("", raw);
  }
  try {
    const parsed = new URL(raw, "https://cssstudio.app");
    const assetKey = sanitizeWorkAssetKey(
      parsed.searchParams.get("asset_key") || "",
    );
    return assetKey;
  } catch {
    return "";
  }
}

function buildWorkBinaryAssetKey(
  scopeId: string,
  workId: string,
  assetType: "cover_image" | "preview_image",
  contentType: string,
) {
  const safeScopeId =
    String(scopeId || "").trim() || String(workId || "").trim() || "work";
  const extension = inferWorkAssetExtension(contentType, "bin");
  const fileName = assetType === "cover_image" ? "cover" : "preview-frame";
  return `works/${safeScopeId}/user-works/${workId}/${fileName}.${extension}`;
}

type CanonicalWorkAssetRecord = {
  assetType: "cover_image" | "preview_image" | "preview_video";
  url: string;
  meta: Record<string, unknown>;
};

type PersistedWorkAssetBundle = {
  coverImage: string | null;
  previewImageUrl: string | null;
  storedPreviewVideoRef: string | null;
  previewVideoUrl: string | null;
  previewVideoAssetKey: string | null;
  assetRecords: CanonicalWorkAssetRecord[];
};

async function persistWorkImageAsset(options: {
  workId: string;
  scopeId: string;
  assetType: "cover_image" | "preview_image";
  rawValue: string | null;
}) {
  const raw = String(options.rawValue || "").trim();
  if (!raw) return null;
  const existingAssetKey = tryParseWorkBlobAssetKey(raw);
  if (existingAssetKey) {
    return {
      persistedValue: buildWorkAssetBlobUrl(existingAssetKey) || raw,
      record: {
        assetType: options.assetType,
        url: buildWorkAssetBlobUrl(existingAssetKey) || raw,
        meta: {
          storage_backend: "gcs",
          asset_key: existingAssetKey,
          source: "existing_asset_key",
        },
      } satisfies CanonicalWorkAssetRecord,
    };
  }
  const decoded = decodeDataUrlAsset(raw);
  if (!decoded) {
    return {
      persistedValue: raw,
      record: {
        assetType: options.assetType,
        url: raw,
        meta: {
          storage_backend: "external_url",
          source: "passthrough_url",
        },
      } satisfies CanonicalWorkAssetRecord,
    };
  }
  const assetKey = buildWorkBinaryAssetKey(
    options.scopeId,
    options.workId,
    options.assetType,
    decoded.contentType,
  );
  await uploadBucketObject(assetKey, decoded.buffer, decoded.contentType);
  const publicUrl = buildWorkAssetBlobUrl(assetKey);
  return {
    persistedValue: publicUrl || raw,
    record: {
      assetType: options.assetType,
      url: publicUrl || raw,
      meta: {
        storage_backend: "gcs",
        asset_key: assetKey,
        content_type: decoded.contentType,
        bytes: decoded.buffer.byteLength,
        source: "uploaded_data_url",
      },
    } satisfies CanonicalWorkAssetRecord,
  };
}

async function buildPersistedWorkAssetBundle(options: {
  workId: string;
  sourceRunId: string | null;
  coverImage: string | null;
  previewImageUrl: string | null;
  previewVideoUrl: string | null;
  previewVideoAssetKey: string | null;
}) {
  const scopeId =
    String(options.sourceRunId || "").trim() || String(options.workId || "").trim();
  const assetRecords: CanonicalWorkAssetRecord[] = [];
  const coverAsset = await persistWorkImageAsset({
    workId: options.workId,
    scopeId,
    assetType: "cover_image",
    rawValue: options.coverImage,
  });
  if (coverAsset?.record) {
    assetRecords.push(coverAsset.record);
  }
  const previewImageAsset = await persistWorkImageAsset({
    workId: options.workId,
    scopeId,
    assetType: "preview_image",
    rawValue: options.previewImageUrl,
  });
  if (previewImageAsset?.record) {
    assetRecords.push(previewImageAsset.record);
  }
  const storedPreviewVideoRef =
    normalizeStoredWorkAssetReference(
      scopeId,
      options.previewVideoAssetKey ||
        tryParsePreviewVideoAssetKey(scopeId, options.previewVideoUrl || ""),
    ) || String(options.previewVideoUrl || "").trim() || null;
  const previewVideoReference = resolveStoredPreviewVideoReference(
    scopeId,
    storedPreviewVideoRef,
  );
  if (storedPreviewVideoRef) {
    assetRecords.push({
      assetType: "preview_video",
      url: previewVideoReference.previewVideoUrl || storedPreviewVideoRef,
      meta: previewVideoReference.previewVideoAssetKey
        ? {
            storage_backend: "run_artifact_resolver",
            asset_key: previewVideoReference.previewVideoAssetKey,
            run_id: scopeId,
            source: "preview_video_asset_key",
          }
        : {
            storage_backend: "external_url",
            source: "passthrough_url",
          },
    });
  }
  return {
    coverImage: coverAsset?.persistedValue || null,
    previewImageUrl: previewImageAsset?.persistedValue || null,
    storedPreviewVideoRef,
    previewVideoUrl: previewVideoReference.previewVideoUrl,
    previewVideoAssetKey: previewVideoReference.previewVideoAssetKey,
    assetRecords,
  } satisfies PersistedWorkAssetBundle;
}

async function syncCanonicalWorkAssets(
  client: PoolClient,
  workId: string,
  assetRecords: CanonicalWorkAssetRecord[],
) {
  for (const asset of assetRecords) {
    await client.query(
      `INSERT INTO work_assets (work_id, asset_type, url, meta)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (work_id, asset_type)
       DO UPDATE SET url = EXCLUDED.url, meta = EXCLUDED.meta`,
      [workId, asset.assetType, asset.url, JSON.stringify(asset.meta || {})],
    );
  }
  /* CSSOS_PHASE3_KARAOKE 20260506 — Jing
   * After every canonical sync, kick a fire-and-forget Whisper pass.
   * The audio asset doesn't land through this function (it's persisted
   * elsewhere), so we look it up from work_assets by workId. Helper
   * short-circuits if transcription already exists or audio missing. */
  void enqueueKaraokeTranscription(workId).catch((err) => {
    console.warn("[karaoke] transcription enqueue failed", workId, err?.message || err);
  });
}

/* ============================================================
 * CSSOS_LLM_ROUTER 20260506 — unified chat-completions router
 * ----------------------------------------------------------------
 * Three providers all speak OpenAI-compatible chat-completions:
 *   - Groq      (free, ~14k req/day, 5-10x faster than GPT)
 *   - Cerebras  (free tier, 2200 tokens/s — fastest in market)
 *   - OpenAI    (the trusted fallback)
 * Provider order is configured via env LLM_PROVIDER_ORDER=
 *   "groq,cerebras,openai" (default if unset). Each provider
 * needs its respective API key in env. Failed requests fall
 * through to the next. Same request schema as OpenAI's standard
 * /v1/chat/completions — drop-in replacement for fetch().
 * ============================================================ */
type LlmRequest = {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: unknown;
  /** Override per-request preference (e.g. "openai" for trusted fallback) */
  prefer?: string[];
};
type LlmResponse = {
  ok: boolean;
  status: number;
  provider: string;
  model: string;
  content: string;
  raw: unknown;
  error?: string;
};
const LLM_PROVIDER_DEFAULTS = {
  groq:        { url: "https://api.groq.com/openai/v1/chat/completions",                                model: "llama-3.3-70b-versatile",                       keyEnv: "GROQ_API_KEY",        dialect: "openai" },
  cerebras:    { url: "https://api.cerebras.ai/v1/chat/completions",                                    model: "llama3.1-8b",                                   keyEnv: "CEREBRAS_API_KEY",    dialect: "openai" },
  // Gemini doesn't speak chat/completions — its endpoint is
  // /v1beta/models/<model>:generateContent and the schema differs.
  // Adapter below translates messages → contents and choices → candidates.
  gemini:      { url: "https://generativelanguage.googleapis.com/v1beta/models",                       model: "gemini-2.0-flash",                              keyEnv: "GEMINI_API_KEY",      dialect: "gemini" },
  // Together AI — OpenAI-compatible. Free Llama-3.3-70B (60 RPM).
  together:    { url: "https://api.together.xyz/v1/chat/completions",                                   model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",       keyEnv: "TOGETHER_API_KEY",    dialect: "openai" },
  // Mistral La Plateforme — OpenAI-compatible. mistral-small-latest
  // free tier (1 req/sec). Strong on European languages + code via
  // codestral-latest variant.
  mistral:     { url: "https://api.mistral.ai/v1/chat/completions",                                     model: "mistral-small-latest",                          keyEnv: "MISTRAL_API_KEY",     dialect: "openai" },
  // OpenRouter — one key, any model. Specify model with provider/name
  // pattern, e.g. "anthropic/claude-3.5-haiku", "openai/gpt-4o-mini".
  // Pay-as-you-go but consolidated billing. Great for ops simplicity.
  openrouter:  { url: "https://openrouter.ai/api/v1/chat/completions",                                  model: "meta-llama/llama-3.3-70b-instruct:free",        keyEnv: "OPENROUTER_API_KEY",  dialect: "openai" },
  // DeepSeek-V3 — OpenAI-compatible. ~$0.14/1M tokens (≈ 1/30 GPT-4).
  deepseek:    { url: "https://api.deepseek.com/v1/chat/completions",                                   model: "deepseek-chat",                                 keyEnv: "DEEPSEEK_API_KEY",    dialect: "openai" },
  // Anthropic Claude — different schema (messages, system field
  // separate, x-api-key header). Adapter handles the translation.
  anthropic:   { url: "https://api.anthropic.com/v1/messages",                                          model: "claude-3-5-haiku-latest",                       keyEnv: "ANTHROPIC_API_KEY",   dialect: "anthropic" },
  // HuggingFace Inference API — OpenAI-compatible router endpoint.
  // Free but slow / occasionally cold; good last-resort free tier.
  huggingface: { url: "https://router.huggingface.co/v1/chat/completions",                              model: "meta-llama/Llama-3.3-70B-Instruct",             keyEnv: "HUGGINGFACE_API_KEY", dialect: "openai" },
  openai:      { url: "https://api.openai.com/v1/chat/completions",                                     model: "gpt-4o-mini",                                   keyEnv: "OPENAI_API_KEY",      dialect: "openai" },
} as const;
type LlmProvider = keyof typeof LLM_PROVIDER_DEFAULTS;

/* CSSOS_UNIVERSAL_TIERED_FALLBACK 20260507 — Jing
 * Universal principle: every engine router (image / video / music / LLM /
 * TTS) routes free → cheap → standard → premium. A single provider's
 * credits/quota/payment error MUST fall through to the next tier — never
 * surface to the user. PROVIDER_TIERS encodes the cost-tier of each
 * adapter; tierSortProviders() applies it to any provider list while
 * preserving in-tier ordering (which encodes quality preference).
 */
const PROVIDER_TIERS: Record<string, "free" | "cheap" | "standard" | "premium"> = {
  // image
  pollinations: "free", // no-key, fully free, last-resort before SVG placeholder
  fal: "free",          // fal flux-schnell free tier
  huggingface: "free",  // also LLM free tier
  together: "cheap",    // also LLM cheap/free
  replicate: "cheap",
  fireworks: "cheap",       // FLUX-1-schnell-fp8 via Fireworks workflow
  deepinfra: "cheap",       // FLUX-1-schnell via DeepInfra inference
  stability_image: "cheap", // Stable Image Core; distinct from stability(music)=standard
  // image + LLM premium
  openai: "premium",
  runway: "premium",
  // video
  kling: "standard",
  luma: "premium",
  // music
  huggingface_music: "free", // facebook/musicgen-small via HF Inference (uses HUGGINGFACE_API_KEY)
  mubert: "free",
  replicate_music: "cheap",  // meta/musicgen on Replicate (uses REPLICATE_API_KEY)
  elevenlabs: "premium",
  stability: "standard",
  suno: "premium",
  // llm
  groq: "free",
  cerebras: "free",
  mistral: "free",
  openrouter: "free",   // ":free" model variants used by default
  gemini: "free",       // generous free tier
  deepseek: "cheap",
  anthropic: "premium",
  // tts
  azure: "free",
  play: "standard",
};
const TIER_ORDER = ["free", "cheap", "standard", "premium"] as const;
function providerTier(p: string): (typeof TIER_ORDER)[number] {
  return PROVIDER_TIERS[p] || "standard";
}
function tierSortProviders<T extends string>(providers: readonly T[]): T[] {
  // Stable sort by tier index; in-tier order preserved (= caller's
  // quality preference for that price-band).
  const indexed = providers.map((p, i) => ({ p, i, t: TIER_ORDER.indexOf(providerTier(p)) }));
  indexed.sort((a, b) => (a.t - b.t) || (a.i - b.i));
  return indexed.map((x) => x.p);
}
/* Detect "this provider's wallet is empty" vs. real bug. Status 402 is
 * always credits. 400/403 with credit/quota/balance/payment/insufficient
 * keywords in the body is also credits. Any of these → continue to next
 * provider rather than fail the user-facing op. 401 = auth error per
 * provider; also fall through (others may work). */
function isCreditsError(status: number, body: string): boolean {
  if (status === 402) return true;
  if (status !== 400 && status !== 403) return false;
  const s = String(body || "").toLowerCase();
  return /credit|balance|quota|insufficient|payment|exhausted|out of/.test(s);
}

function llmProviderOrder(prefer?: string[]): LlmProvider[] {
  const env = String(process.env.LLM_PROVIDER_ORDER || "groq,cerebras,gemini,together,mistral,huggingface,openrouter,deepseek,anthropic,openai")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const list = (prefer && prefer.length ? prefer : env)
    .filter((p): p is LlmProvider => p in LLM_PROVIDER_DEFAULTS);
  // Caller-supplied prefer wins as-is (power-user override). Default
  // env order is tier-sorted so the principle holds even if env is
  // misconfigured.
  const sorted = (prefer && prefer.length) ? list : tierSortProviders(list);
  return sorted.length ? sorted : ["openai"];
}

/* Read user's preferred provider order from a cookie or header so a
 * frontend picker can override the env default per-request. Caller
 * still wins if it passes explicit `prefer:[]`. We don't add the
 * cookie-parser dep — just split the Cookie header inline. */
function userPreferredOrder(req: { headers: Record<string, unknown>; cookies?: Record<string, string> }, kind: string): string[] {
  const headerKey = `x-cssos-${kind}-prefer`;
  const cookieKey = `cssos_${kind}_prefer`;
  let raw = String(req.headers?.[headerKey] || "").trim();
  if (!raw && req.cookies?.[cookieKey]) raw = String(req.cookies[cookieKey]).trim();
  if (!raw) {
    const cookieHeader = String(req.headers?.["cookie"] || "");
    const m = cookieHeader.split(";").map((s) => s.trim()).find((s) => s.startsWith(cookieKey + "="));
    if (m) raw = decodeURIComponent(m.slice(cookieKey.length + 1));
  }
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/* CSSOS_USER_PREFERRED_MODEL 20260507 — Jing
 * Read the cookie cssos_<kind>_<provider>_model so the engine-picker
 * dropdown's choice flows through to the adapter call. Builds a
 * provider→model map from all matching cookies in a single pass. */
function userPreferredModelMap(
  req: { headers: Record<string, unknown>; cookies?: Record<string, string> },
  kind: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const cookieHeader = String(req.headers?.["cookie"] || "");
  const re = new RegExp("(?:^|;\\s*)cssos_" + kind + "_([a-z0-9-]+)_model=([^;]+)", "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(cookieHeader))) {
    out[m[1]!] = decodeURIComponent(m[2]!).trim();
  }
  // Direct cookies map fallback (e.g. when set via parsed middleware).
  if (req.cookies) {
    for (const k of Object.keys(req.cookies)) {
      const mm = k.match(new RegExp("^cssos_" + kind + "_([a-z0-9-]+)_model$"));
      if (mm) out[mm[1]!] = String(req.cookies[k] || "").trim();
    }
  }
  return out;
}

/* CSSOS_SYSTEM_ENGINE_DEFAULTS 20260507 — Jing
 * Admin-set defaults persist per (kind, provider) → model. Cached for
 * 60s in-memory so adapters can call synchronously without hitting the
 * DB on every request. Frontend admin → POST /api/admin/engine/default
 * upserts the row + bumps the cache version (next read refetches). */
type SysDefaultsCache = { fetchedAt: number; map: Record<string, string> };
let systemDefaultsCache: SysDefaultsCache = { fetchedAt: 0, map: {} };
const SYS_DEFAULTS_TTL_MS = 60_000;
async function ensureSystemDefaultsTable(): Promise<void> {
  await withClient((c) =>
    c.query(`CREATE TABLE IF NOT EXISTS system_engine_defaults (
      kind TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      updated_by UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (kind, provider)
    )`),
  );
}
async function getSystemDefaultsMap(): Promise<Record<string, string>> {
  if (Date.now() - systemDefaultsCache.fetchedAt < SYS_DEFAULTS_TTL_MS) {
    return systemDefaultsCache.map;
  }
  try {
    await ensureSystemDefaultsTable();
    const r = await withClient((c) =>
      c.query<{ kind: string; provider: string; model: string }>(
        `SELECT kind, provider, model FROM system_engine_defaults`,
      ),
    );
    const map: Record<string, string> = {};
    for (const row of r.rows) {
      map[`${row.kind}.${row.provider}`] = row.model;
    }
    systemDefaultsCache = { fetchedAt: Date.now(), map };
    return map;
  } catch (err) {
    console.warn("[system-defaults] read failed:", (err as Error)?.message || err);
    return systemDefaultsCache.map;
  }
}
function invalidateSystemDefaultsCache() {
  systemDefaultsCache = { fetchedAt: 0, map: {} };
}
/* Resolve model for a (kind, provider) call. Precedence:
 *   1. caller-supplied prefer_model[provider]   (request-scoped, user cookie)
 *   2. system_engine_defaults row               (admin-set global)
 *   3. env override XXX_MODEL                   (operator)
 *   4. hardcoded default                        (fallback)
 */
async function resolveEngineModel(
  kind: string,
  provider: string,
  caller: { prefer_model?: Record<string, string> } | undefined,
  envOverride: string | undefined,
  fallback: string,
): Promise<string> {
  const userPick = caller?.prefer_model?.[provider];
  if (userPick && typeof userPick === "string") return userPick.trim();
  const sysMap = await getSystemDefaultsMap();
  const sysPick = sysMap[`${kind}.${provider}`];
  if (sysPick) return sysPick;
  if (envOverride && envOverride.trim()) return envOverride.trim();
  return fallback;
}

async function callLlm(req: LlmRequest): Promise<LlmResponse> {
  const order = llmProviderOrder(req.prefer);
  let lastErr = "no_providers_available";
  let lastStatus = 0;
  for (const provider of order) {
    const cfg = LLM_PROVIDER_DEFAULTS[provider];
    const apiKey = String(process.env[cfg.keyEnv] || "").trim();
    if (!apiKey) continue;
    const modelOverride = String(process.env[`LLM_MODEL_${provider.toUpperCase()}`] || "").trim();
    const model = modelOverride || cfg.model;
    try {
      let upstream: Response;
      let json: any;
      let content = "";
      if (cfg.dialect === "anthropic") {
        // Anthropic via the official SDK — auto-retry, typed errors,
        // streaming-ready. Maintained by Anthropic so model migrations
        // stay backwards-compatible.
        const client = new Anthropic({ apiKey });
        const systemMsgs = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
        const messages = req.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
            content: m.content,
          }));
        try {
          const msg = await client.messages.create({
            model,
            messages,
            max_tokens: req.max_tokens || 1024,
            ...(systemMsgs ? { system: systemMsgs } : {}),
            ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          });
          // Status-shaped pseudo-Response for the unified return below.
          upstream = { ok: true, status: 200 } as Response;
          json = msg;
          content = (msg.content || [])
            .filter((block): block is Anthropic.TextBlock => block.type === "text")
            .map((block) => block.text)
            .join("");
        } catch (err) {
          const apiErr = err as { message?: string; status?: number };
          lastErr = String(apiErr?.message || err);
          lastStatus = apiErr?.status || 500;
          if (isCreditsError(lastStatus, lastErr)) console.warn(`[llm-router] anthropic credits exhausted, falling through`);
          else console.warn(`[llm-router] anthropic ${lastStatus}: ${lastErr.slice(0, 200)}`);
          continue;
        }
      } else if (cfg.dialect === "gemini") {
        // Translate to Gemini schema:
        //   messages[{role,content}] → { contents: [{role, parts:[{text}]}] }
        //   role "system" → systemInstruction; "assistant" → "model"; "user" → "user"
        const systemMsgs = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
        const contents = req.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
        const generationConfig: Record<string, unknown> = {};
        if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
        if (req.max_tokens !== undefined) generationConfig.maxOutputTokens = req.max_tokens;
        if (req.response_format && (req.response_format as any).type === "json_object") {
          generationConfig.responseMimeType = "application/json";
        }
        const body: Record<string, unknown> = { contents, generationConfig };
        if (systemMsgs) body.systemInstruction = { parts: [{ text: systemMsgs }] };
        const url = `${cfg.url}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        upstream = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        json = await upstream.json().catch(() => null);
        if (!upstream.ok) {
          lastErr = String(json?.error?.message || `gemini_${upstream.status}`);
          lastStatus = upstream.status;
          if (isCreditsError(lastStatus, JSON.stringify(json || {}) + " " + lastErr)) console.warn(`[llm-router] gemini credits exhausted, falling through`);
          else console.warn(`[llm-router] gemini ${upstream.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        const parts = json?.candidates?.[0]?.content?.parts;
        content = Array.isArray(parts)
          ? parts.map((p: { text?: string }) => String(p?.text || "")).join("")
          : "";
      } else {
        // OpenAI-compatible (Groq / Cerebras / OpenAI).
        const body: Record<string, unknown> = {
          model,
          messages: req.messages,
        };
        if (req.temperature !== undefined) body.temperature = req.temperature;
        if (req.max_tokens !== undefined) {
          if (provider === "openai") body.max_completion_tokens = req.max_tokens;
          else body.max_tokens = req.max_tokens;
        }
        if (req.response_format) body.response_format = req.response_format;
        upstream = await fetch(cfg.url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        });
        json = await upstream.json().catch(() => null);
        if (!upstream.ok) {
          lastErr = String(json?.error?.message || `${provider}_${upstream.status}`);
          lastStatus = upstream.status;
          if (isCreditsError(lastStatus, JSON.stringify(json || {}) + " " + lastErr)) console.warn(`[llm-router] ${provider} credits exhausted, falling through`);
          else console.warn(`[llm-router] ${provider} ${upstream.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        content = String(json?.choices?.[0]?.message?.content || "");
      }
      return { ok: true, status: upstream.status, provider, model, content, raw: json };
    } catch (err) {
      lastErr = String((err as Error)?.message || err);
      console.warn(`[llm-router] ${provider} threw: ${lastErr}`);
      continue;
    }
  }
  return {
    ok: false, status: lastStatus || 502,
    provider: "none", model: "", content: "",
    raw: null, error: lastErr,
  };
}

/* ============================================================
 * CSSOS_MUSIC_ROUTER 20260506 (skeleton) — Jing
 * ----------------------------------------------------------------
 * Placeholder dispatcher for background-music generation. The
 * existing Suno + ElevenLabs music paths are direct (each lives in
 * its own module). When the long-form roadmap (短剧 → 电视剧 →
 * 180min 3D) needs uniform "give me 60 seconds of <mood>" music,
 * call this — it will route to whichever provider is configured.
 * ============================================================ */
type MusicGenRequest = {
  prompt: string;
  duration_secs?: number;
  mood?: string;
  tags?: string[];
  prefer?: string[];
  /* Per-provider model override (from cookie `cssos_music_<provider>_model`
   * filled in by the calling endpoint via userPreferredModelMap). */
  prefer_model?: Record<string, string>;
};
type MusicGenResponse = {
  ok: boolean;
  provider: string;
  audio_url?: string;
  audio_b64?: string;
  error?: string;
};
const MUSIC_PROVIDERS = ["huggingface_music", "mubert", "replicate_music", "elevenlabs", "stability", "suno"] as const;
/* CSSOS_PROVIDER_PRIORITY 20260507 — Jing
 * "第三方引擎，优者优先（有时效限制者特别优先），免费档次，其他档
 * 次以此类推，openAI兜底."
 *   mubert     — free tier, Customer access-token rolls 1y
 *                (time-limited → use first to amortize before expiry)
 *   elevenlabs — paid sidecar (music-v1)
 *   stability  — paid stable-audio-2
 *   suno       — paid via kie.ai (highest quality, last because $$)
 */
function musicProviderOrder(prefer?: string[]): string[] {
  const env = String(process.env.MUSIC_PROVIDER_ORDER || "huggingface_music,mubert,replicate_music,stability,elevenlabs,suno")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const list = (prefer && prefer.length ? prefer : env).filter((p) =>
    (MUSIC_PROVIDERS as readonly string[]).includes(p));
  return (prefer && prefer.length) ? list : tierSortProviders(list);
}
async function callMusicGen(req: MusicGenRequest): Promise<MusicGenResponse> {
  const order = musicProviderOrder(req.prefer);
  let lastErr = "";
  for (const provider of order) {
    try {
      if (provider === "mubert") {
        // Mubert v3 has two auth tiers:
        //   service-side (company-id + license-token) → manages customers
        //   public-side  (customer-id + access-token) → generates tracks
        // The /tracks endpoint is public-side. We cache customer creds
        // in env so we don't re-create customers per call. If they're
        // missing, mint one from company creds and warn — operator
        // should pin the returned values into /etc/cssos.env.
        let customerId = String(process.env.MUBERT_CUSTOMER_ID || "").trim();
        let accessToken = String(process.env.MUBERT_ACCESS_TOKEN || "").trim();
        if (!customerId || !accessToken) {
          const companyId = String(process.env.MUBERT_COMPANY_ID || "").trim();
          const licenseToken = String(process.env.MUBERT_LICENSE_TOKEN || process.env.MUBERT_API_KEY || "").trim();
          if (!companyId || !licenseToken) continue;
          const reg = await fetch("https://music-api.mubert.com/api/v3/service/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json", "company-id": companyId, "license-token": licenseToken },
            body: JSON.stringify({ custom_id: "cssos-default" }),
          });
          const regJson: any = await reg.json().catch(() => null);
          customerId = String(regJson?.data?.id || "").trim();
          accessToken = String(regJson?.data?.access?.token || "").trim();
          if (!customerId || !accessToken) {
            lastErr = "mubert_customer_register_failed";
            continue;
          }
          console.warn("[music-router] mubert auto-registered customer — pin to env: MUBERT_CUSTOMER_ID=" + customerId);
        }
        const duration = Math.max(5, Math.min(180, Math.round(req.duration_secs || 30)));
        const headers = {
          "Content-Type": "application/json",
          "customer-id": customerId,
          "access-token": accessToken,
        };
        const create = await fetch("https://music-api.mubert.com/api/v3/public/tracks", {
          method: "POST",
          headers,
          body: JSON.stringify({
            duration,
            prompt: String(req.prompt || (req.tags || []).join(", ") || "cinematic ambient"),
            mode: "track",
            format: "mp3",
            intensity: "medium",
          }),
        });
        const createJson: any = await create.json().catch(() => null);
        if (!create.ok || !createJson) {
          lastErr = String(createJson?.error?.text || createJson?.message || `mubert_${create.status}`);
          if (isCreditsError(create.status, JSON.stringify(createJson || {}) + " " + lastErr)) console.warn(`[music-router] mubert credits exhausted, falling through`);
          else console.warn(`[music-router] mubert create ${create.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        const t = createJson?.data || {};
        const trackId: string = String(t?.id || "").trim();
        // Mubert returns generations[].url, not a top-level url. The
        // first generation is the requested format ("mp3" by default).
        const firstDone = (Array.isArray(t?.generations) ? t.generations : []).find(
          (g: any) => g?.status === "done" && g?.url,
        );
        if (firstDone?.url) return { ok: true, provider: "mubert", audio_url: String(firstDone.url) };
        if (!trackId) {
          lastErr = "mubert_no_track_id";
          continue;
        }
        // Poll up to 60s for the generation to flip status="done".
        const deadline = Date.now() + 60_000;
        let pollUrl = "";
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 2500));
          const status = await fetch(
            `https://music-api.mubert.com/api/v3/public/tracks/${encodeURIComponent(trackId)}`,
            { method: "GET", headers },
          );
          const sJson: any = await status.json().catch(() => null);
          const tt = sJson?.data || {};
          const gen = (Array.isArray(tt?.generations) ? tt.generations : []).find(
            (g: any) => g?.status === "done" && g?.url,
          );
          if (gen?.url) { pollUrl = String(gen.url); break; }
        }
        if (pollUrl) return { ok: true, provider: "mubert", audio_url: pollUrl };
        lastErr = "mubert_poll_timeout";
        continue;
      }
      if (provider === "huggingface_music") {
        // facebook/musicgen-small via HF Inference API. Free with HF
        // token. Returns binary WAV bytes. Cold-start (503 +
        // estimated_time) → fall through rather than wait.
        const hfKey = String(process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || "").trim();
        if (!hfKey) continue;
        const dur = Math.max(5, Math.min(60, Math.round(req.duration_secs || 30)));
        // musicgen-small ≈ 256 tokens / 10s @ 32kHz; cap to ~30s worth.
        const maxNewTokens = Math.min(1536, Math.round(dur * 25.6));
        const prompt = String(req.prompt || (req.tags || []).join(", ") || "cinematic ambient");
        const upstream = await fetch("https://api-inference.huggingface.co/models/facebook/musicgen-small", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfKey}`,
            "Content-Type": "application/json",
            Accept: "audio/wav",
          },
          body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: maxNewTokens } }),
        });
        if (upstream.status === 503) {
          const txt = await upstream.text().catch(() => "");
          let est = "";
          try { const j = JSON.parse(txt); est = String(j?.estimated_time || ""); } catch {}
          console.warn(`[music-router] huggingface_music cold-start 503 (est=${est}s) — falling through`);
          lastErr = `huggingface_music_cold_start_${est}`;
          continue;
        }
        if (!upstream.ok) {
          const body = await upstream.text().catch(() => "");
          lastErr = `huggingface_music_${upstream.status}: ${body.slice(0, 200)}`;
          if (isCreditsError(upstream.status, body)) console.warn(`[music-router] huggingface_music credits/quota, falling through`);
          else console.warn(`[music-router] huggingface_music ${upstream.status}: ${body.slice(0, 200)}`);
          continue;
        }
        const ab = await upstream.arrayBuffer();
        const b64 = Buffer.from(ab).toString("base64");
        if (!b64) { lastErr = "huggingface_music_empty_body"; continue; }
        return { ok: true, provider: "huggingface_music", audio_b64: b64 };
      }
      if (provider === "replicate_music") {
        const repKey = String(process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN || "").trim();
        if (!repKey) continue;
        const dur = Math.max(5, Math.min(60, Math.round(req.duration_secs || 30)));
        const prompt = String(req.prompt || (req.tags || []).join(", ") || "cinematic ambient");
        const upstream = await fetch("https://api.replicate.com/v1/models/meta/musicgen/predictions", {
          method: "POST",
          headers: {
            Authorization: `Token ${repKey}`,
            "Content-Type": "application/json",
            Prefer: "wait=60",
          },
          body: JSON.stringify({
            input: {
              model_version: "stereo-large",
              prompt,
              duration: dur,
              output_format: "mp3",
              normalization_strategy: "peak",
            },
          }),
        });
        const j: any = await upstream.json().catch(() => null);
        if (!upstream.ok || !j) {
          const bodyStr = JSON.stringify(j || {});
          lastErr = `replicate_music_${upstream.status}: ${bodyStr.slice(0, 200)}`;
          if (isCreditsError(upstream.status, bodyStr)) console.warn(`[music-router] replicate_music credits exhausted, falling through`);
          else console.warn(`[music-router] replicate_music ${upstream.status}: ${bodyStr.slice(0, 200)}`);
          continue;
        }
        const out = j?.output;
        const url = typeof out === "string" ? out : (Array.isArray(out) && out.length ? String(out[0]) : "");
        if (url) return { ok: true, provider: "replicate_music", audio_url: url };
        // Status pending (sync wait timed out). Poll urls.get briefly.
        const getUrl = String(j?.urls?.get || "");
        if (getUrl) {
          const deadline = Date.now() + 60_000;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 2500));
            const st = await fetch(getUrl, { headers: { Authorization: `Token ${repKey}` } });
            const sj: any = await st.json().catch(() => null);
            if (sj?.status === "succeeded") {
              const o = sj?.output;
              const u = typeof o === "string" ? o : (Array.isArray(o) && o.length ? String(o[0]) : "");
              if (u) return { ok: true, provider: "replicate_music", audio_url: u };
            }
            if (sj?.status === "failed" || sj?.status === "canceled") break;
          }
        }
        lastErr = "replicate_music_poll_timeout";
        continue;
      }
      // Other music providers (suno, elevenlabs, stability) — adapters
      // land separately. Suno already runs through the existing
      // suno-api sidecar; ElevenLabs Music has its own sidecar.
    } catch (err) {
      lastErr = `${provider}_threw_${(err as Error)?.message || err}`;
      console.warn(`[music-router] ${provider} threw:`, lastErr.slice(0, 200));
      continue;
    }
  }
  return { ok: false, provider: "none", error: lastErr || "no_music_provider_succeeded" };
}

/* ============================================================
 * CSSOS_VIDEO_ROUTER 20260506 (skeleton) — Jing
 * ----------------------------------------------------------------
 * Short-clip video generation router (5-10s clips that get edited
 * into long-form). Providers all do text-to-video / image-to-video
 * but their schemas + polling models differ wildly — adapters land
 * one-by-one as cssOS picks them up.
 * ============================================================ */
type VideoGenRequest = {
  prompt: string;
  duration_secs?: number;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  image_url?: string; // image-to-video starting frame
  prefer?: string[];
  /* Per-provider model override (from cookie cssos_video_<provider>_model). */
  prefer_model?: Record<string, string>;
};
type VideoGenResponse = {
  ok: boolean;
  provider: string;
  video_url?: string;
  poll_url?: string;
  error?: string;
};
const VIDEO_PROVIDERS = ["fal", "kling", "luma", "replicate", "runway"] as const;
/* Order rationale (free/time-limited first, paid last):
 *   fal       — free tier credits (first because cheapest)
 *   kling     — $9.8 trial pack (100 units, 30-day expiry → use up first)
 *   luma      — $20 credit balance, time-bounded
 *   replicate — $20 funded, generic per-call cost
 *   runway   — premium, last because $$$
 */
function videoProviderOrder(prefer?: string[]): string[] {
  // Tier order: fal(free) → replicate(cheap) → kling(standard) → luma(premium) → runway(premium)
  const env = String(process.env.VIDEO_PROVIDER_ORDER || "fal,replicate,kling,luma,runway")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const list = (prefer && prefer.length ? prefer : env).filter((p) =>
    (VIDEO_PROVIDERS as readonly string[]).includes(p));
  return (prefer && prefer.length) ? list : tierSortProviders(list);
}
async function callVideoGen(req: VideoGenRequest): Promise<VideoGenResponse> {
  const order = videoProviderOrder(req.prefer);
  let lastErr = "";
  for (const provider of order) {
    try {
      if (provider === "luma") {
        const apiKey = String(process.env.LUMA_API_KEY || "").trim();
        if (!apiKey) continue;
        // Luma Dream Machine v1: POST /generations creates an async
        // job, returns id + state="queued"|"dreaming". Poll the same
        // resource until state="completed" (assets.video has the url)
        // or state="failed" (failure_reason has the why).
        // Defaults: ray-2 model, 5s duration. Aspect ratio mapped from
        // VideoGenRequest's "16:9"/"9:16"/"1:1" → Luma's same-string
        // values. duration_secs ≤ 5 → "5s", else "9s".
        const aspect = req.aspect_ratio === "9:16" ? "9:16"
          : req.aspect_ratio === "1:1" ? "1:1"
          : "16:9";
        const dur = (req.duration_secs && req.duration_secs > 5) ? "9s" : "5s";
        const lumaModel = await resolveEngineModel("video", "luma", req, process.env.LUMA_MODEL, "ray-2");
        const body: Record<string, unknown> = {
          prompt: req.prompt,
          aspect_ratio: aspect,
          model: lumaModel,
          duration: dur,
          resolution: "720p",
        };
        if (req.image_url) {
          body.keyframes = { frame0: { type: "image", url: req.image_url } };
        }
        const create = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });
        const createJson: any = await create.json().catch(() => null);
        if (!create.ok || !createJson) {
          lastErr = String(createJson?.detail || createJson?.message || `luma_${create.status}`);
          if (isCreditsError(create.status, JSON.stringify(createJson || {}) + " " + lastErr)) console.warn(`[video-router] luma credits exhausted, falling through`);
          else console.warn(`[video-router] luma create ${create.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        const jobId: string = String(createJson?.id || "").trim();
        if (!jobId) {
          lastErr = "luma_no_job_id";
          continue;
        }
        // Poll for up to 5 minutes (Luma jobs typically 60-180s).
        const deadline = Date.now() + 300_000;
        let videoUrl = "";
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 4000));
          const st = await fetch(
            `https://api.lumalabs.ai/dream-machine/v1/generations/${encodeURIComponent(jobId)}`,
            { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } },
          );
          const sJson: any = await st.json().catch(() => null);
          const state = String(sJson?.state || "").toLowerCase();
          if (state === "completed") {
            videoUrl = String(sJson?.assets?.video || "");
            break;
          }
          if (state === "failed") {
            lastErr = "luma_failed: " + String(sJson?.failure_reason || "unknown");
            break;
          }
        }
        if (videoUrl) return { ok: true, provider: "luma", video_url: videoUrl };
        if (!lastErr) lastErr = "luma_poll_timeout";
        continue;
      }
      if (provider === "kling") {
        const ak = String(process.env.KLING_ACCESS_KEY || "").trim();
        const sk = String(process.env.KLING_SECRET_KEY || "").trim();
        if (!ak || !sk) continue;
        // Kling auth — short-lived JWT (HS256) signed locally with the
        // SecretKey, sent as Authorization: Bearer <jwt>. Token TTL 30
        // minutes is well within the API's 30-min default expectation.
        const jwt = await import("jsonwebtoken");
        const now = Math.floor(Date.now() / 1000);
        const token = jwt.default.sign(
          { iss: ak, exp: now + 1800, nbf: now - 5 },
          sk,
          { algorithm: "HS256", header: { alg: "HS256", typ: "JWT" } },
        );
        const aspect = req.aspect_ratio === "9:16" ? "9:16"
          : req.aspect_ratio === "1:1" ? "1:1"
          : "16:9";
        const dur = (req.duration_secs && req.duration_secs > 5) ? "10" : "5";
        const klingModel = await resolveEngineModel("video", "kling", req, process.env.KLING_MODEL, "kling-v1");
        const body: Record<string, unknown> = {
          model_name: klingModel,
          prompt: req.prompt,
          aspect_ratio: aspect,
          duration: dur,
          mode: "std",
          cfg_scale: 0.5,
        };
        // Kling has separate text2video / image2video endpoints. Pick
        // by whether the caller supplied a starting frame.
        const path = req.image_url ? "image2video" : "text2video";
        if (req.image_url) body.image = req.image_url;
        const create = await fetch(
          `https://api-singapore.klingai.com/v1/videos/${path}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          },
        );
        const createJson: any = await create.json().catch(() => null);
        if (!create.ok || createJson?.code !== 0) {
          lastErr = String(createJson?.message || `kling_${create.status}`);
          if (isCreditsError(create.status, JSON.stringify(createJson || {}) + " " + lastErr)) console.warn(`[video-router] kling credits exhausted, falling through`);
          else console.warn(`[video-router] kling create ${create.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        const taskId = String(createJson?.data?.task_id || "").trim();
        if (!taskId) {
          lastErr = "kling_no_task_id";
          continue;
        }
        // Kling video gen typically 60-180s. Poll up to 6 minutes.
        const deadline = Date.now() + 360_000;
        let videoUrl = "";
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 5000));
          // Re-mint JWT each poll cycle so we don't expire mid-loop.
          const nowP = Math.floor(Date.now() / 1000);
          const tokenP = jwt.default.sign(
            { iss: ak, exp: nowP + 1800, nbf: nowP - 5 },
            sk,
            { algorithm: "HS256", header: { alg: "HS256", typ: "JWT" } },
          );
          const st = await fetch(
            `https://api-singapore.klingai.com/v1/videos/${path}/${encodeURIComponent(taskId)}`,
            { headers: { Authorization: `Bearer ${tokenP}` } },
          );
          const sJson: any = await st.json().catch(() => null);
          const status = String(sJson?.data?.task_status || "").toLowerCase();
          if (status === "succeed") {
            videoUrl = String(sJson?.data?.task_result?.videos?.[0]?.url || "");
            break;
          }
          if (status === "failed") {
            lastErr = "kling_failed: " + String(sJson?.data?.task_status_msg || "unknown");
            break;
          }
        }
        if (videoUrl) return { ok: true, provider: "kling", video_url: videoUrl };
        if (!lastErr) lastErr = "kling_poll_timeout";
        continue;
      }
      if (provider === "replicate") {
        const apiKey = String(process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN || "").trim();
        if (!apiKey) continue;
        // Resolve via the unified precedence chain. Image-to-video and
        // text-to-video share the same picker — caller's chosen model
        // takes precedence either way.
        // Real existing Replicate models (verified live 2026-05-07):
        //   t2v: minimax/video-01, tencent/hunyuan-video, lightricks/ltx-video
        //   i2v: ali-vilab/i2vgen-xl, kwaivgi/kling-v1.6-pro
        const fallback = req.image_url ? "ali-vilab/i2vgen-xl" : "minimax/video-01";
        const envKey = req.image_url ? process.env.REPLICATE_VIDEO_MODEL_I2V : process.env.REPLICATE_VIDEO_MODEL_T2V;
        const model = await resolveEngineModel("video", "replicate", req, envKey, fallback);
        const aspect = req.aspect_ratio === "9:16" ? "9:16"
          : req.aspect_ratio === "1:1" ? "1:1"
          : "16:9";
        const dur = req.duration_secs && req.duration_secs > 5 ? 9 : 5;
        const input: Record<string, unknown> = {
          prompt: req.prompt,
          aspect_ratio: aspect,
          duration: dur,
        };
        if (req.image_url) input.image = req.image_url;
        // Replicate supports Prefer: wait=60 for sync; falls back to
        // polling if the job exceeds 60s.
        const create = await fetch(
          `https://api.replicate.com/v1/models/${model}/predictions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Token ${apiKey}`,
              Prefer: "wait=60",
            },
            body: JSON.stringify({ input }),
          },
        );
        const createJson: any = await create.json().catch(() => null);
        if (!create.ok || !createJson) {
          lastErr = String(createJson?.detail || createJson?.error || `replicate_${create.status}`);
          if (isCreditsError(create.status, JSON.stringify(createJson || {}) + " " + lastErr)) console.warn(`[video-router] replicate credits exhausted, falling through`);
          else console.warn(`[video-router] replicate create ${create.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        // First-shot success (Prefer: wait=60 returned the output).
        const pickUrl = (out: any): string => {
          if (!out) return "";
          if (typeof out === "string") return out;
          if (Array.isArray(out) && typeof out[0] === "string") return String(out[0]);
          return "";
        };
        if (createJson.status === "succeeded") {
          const u = pickUrl(createJson.output);
          if (u) return { ok: true, provider: "replicate", video_url: u };
        }
        if (createJson.status === "failed") {
          lastErr = "replicate_failed: " + String(createJson.error || "unknown");
          continue;
        }
        // Poll urls.get up to 6 minutes.
        const pollUrl = String(createJson?.urls?.get || "").trim();
        if (!pollUrl) {
          lastErr = "replicate_no_poll_url";
          continue;
        }
        const deadline = Date.now() + 360_000;
        let videoUrl = "";
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 4000));
          const st = await fetch(pollUrl, {
            headers: { Authorization: `Token ${apiKey}` },
          });
          const sJson: any = await st.json().catch(() => null);
          const status = String(sJson?.status || "").toLowerCase();
          if (status === "succeeded") {
            videoUrl = pickUrl(sJson?.output);
            break;
          }
          if (status === "failed" || status === "canceled") {
            lastErr = "replicate_failed: " + String(sJson?.error || status);
            break;
          }
        }
        if (videoUrl) return { ok: true, provider: "replicate", video_url: videoUrl };
        if (!lastErr) lastErr = "replicate_poll_timeout";
        continue;
      }
      // fal / runway adapters land in next rounds.
    } catch (err) {
      lastErr = `${provider}_threw_${(err as Error)?.message || err}`;
      console.warn(`[video-router] ${provider} threw:`, lastErr.slice(0, 200));
      continue;
    }
  }
  return { ok: false, provider: "none", error: lastErr || "no_video_provider_succeeded" };
}

/* ============================================================
 * CSSOS_TTS_ROUTER 20260506 (skeleton) — Jing
 * ----------------------------------------------------------------
 * Multi-character dialogue TTS for short-drama / TV roadmap.
 * ElevenLabs already exists per-call in the platform; this router
 * will let any callsite request "voice X says Y" with provider-side
 * polling.
 * ============================================================ */
type TtsGenRequest = {
  text: string;
  voice?: string;
  language?: string;
  emotion?: string;
  prefer?: string[];
};
type TtsGenResponse = {
  ok: boolean;
  provider: string;
  audio_url?: string;
  audio_b64?: string;
  error?: string;
};
const TTS_PROVIDERS = ["azure", "elevenlabs", "play", "openai"] as const;
/* azure free tier (500k chars/mo) → elevenlabs (paid premium voice
 * library) → play (free tier 5k chars) → openai (paid fallback). */
function ttsProviderOrder(prefer?: string[]): string[] {
  // Tier order: azure(free) → play(standard) → openai(premium) → elevenlabs(premium)
  const env = String(process.env.TTS_PROVIDER_ORDER || "azure,play,openai,elevenlabs")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const list = (prefer && prefer.length ? prefer : env).filter((p) =>
    (TTS_PROVIDERS as readonly string[]).includes(p));
  return (prefer && prefer.length) ? list : tierSortProviders(list);
}
async function callTtsGen(_req: TtsGenRequest): Promise<TtsGenResponse> {
  return { ok: false, provider: "none", error: "tts_router_not_implemented" };
}

/* ============================================================
 * CSSOS_PROVIDER_DISCOVERY 20260506 — Jing
 * Open-system contract: GET /api/llm/providers tells the frontend
 * which providers are configured + their default models so the user
 * can pick their preferred engine. Caller can then send `prefer:[…]`
 * with each request. Keys themselves are NEVER returned, only the
 * presence flag + redacted prefix.
 * ============================================================ */
function buildProvidersSnapshot() {
  const llm = (Object.keys(LLM_PROVIDER_DEFAULTS) as LlmProvider[]).map((p) => {
    const cfg = LLM_PROVIDER_DEFAULTS[p];
    const key = String(process.env[cfg.keyEnv] || "").trim();
    return {
      id: p,
      kind: "llm",
      configured: !!key,
      default_model: cfg.model,
      dialect: cfg.dialect,
      free_tier: ["groq", "cerebras", "gemini", "together", "mistral", "huggingface", "openrouter"].includes(p),
    };
  });
  const image = (IMAGE_PROVIDERS as readonly string[]).map((id) => {
    const env = id === "fal" ? "FAL_API_KEY"
      : id === "together" ? "TOGETHER_API_KEY"
      : id === "replicate" ? "REPLICATE_API_KEY"
      : id === "huggingface" ? "HUGGINGFACE_API_KEY"
      : "OPENAI_API_KEY";
    const key = String(process.env[env] || "").trim();
    return {
      id, kind: "image", configured: !!key,
      default_model: id === "fal" ? "flux-schnell"
        : id === "together" ? "FLUX.1-schnell-Free"
        : id === "replicate" ? "black-forest-labs/flux-schnell"
        : id === "huggingface" ? "FLUX.1-schnell"
        : "gpt-image-1",
      free_tier: id === "fal" || id === "together" || id === "huggingface",
    };
  });
  const music = (MUSIC_PROVIDERS as readonly string[]).map((id) => {
    const env = id === "suno" ? "SUNO_API_KEY"
      : id === "elevenlabs" ? "ELEVENLABS_API_KEY"
      : id === "stability" ? "STABILITY_API_KEY"
      : "MUBERT_API_KEY";
    return {
      id, kind: "music",
      configured: !!String(process.env[env] || "").trim(),
      default_model: id === "suno" ? "suno-v4"
        : id === "elevenlabs" ? "music-v1"
        : id === "stability" ? "stable-audio-2"
        : "mubert-go",
      free_tier: id === "mubert",
    };
  });
  const video = (VIDEO_PROVIDERS as readonly string[]).map((id) => {
    const env = id === "fal" ? "FAL_API_KEY"
      : id === "replicate" ? "REPLICATE_API_KEY"
      : id === "runway" ? "RUNWAY_API_KEY"
      : id === "luma" ? "LUMA_API_KEY"
      : "KLING_API_KEY";
    return {
      id, kind: "video",
      configured: !!String(process.env[env] || "").trim(),
      default_model: id === "fal" ? "fal-ai/luma-ray"
        : id === "replicate" ? "wan-2.2-i2v"
        : id === "runway" ? "gen-3-alpha"
        : id === "luma" ? "ray-2"
        : "kling-1.5",
      free_tier: false,
    };
  });
  const tts = (TTS_PROVIDERS as readonly string[]).map((id) => {
    const env = id === "elevenlabs" ? "ELEVENLABS_API_KEY"
      : id === "azure" ? "AZURE_SPEECH_KEY"
      : id === "openai" ? "OPENAI_API_KEY"
      : "PLAYHT_API_KEY";
    return {
      id, kind: "tts",
      configured: !!String(process.env[env] || "").trim(),
      default_model: id === "elevenlabs" ? "eleven_multilingual_v2"
        : id === "azure" ? "neural-tts"
        : id === "openai" ? "tts-1-hd"
        : "playht-2.0",
      free_tier: id === "azure", // 500k chars/month free
    };
  });
  return {
    llm: { providers: llm, default_order: llmProviderOrder() },
    image: { providers: image, default_order: imageProviderOrder() },
    music: { providers: music, default_order: musicProviderOrder() },
    video: { providers: video, default_order: videoProviderOrder() },
    tts: { providers: tts, default_order: ttsProviderOrder() },
  };
}

/* ============================================================
 * CSSOS_IMAGE_ROUTER 20260506 — fal.ai Flux schnell → OpenAI gpt-image-1
 * ----------------------------------------------------------------
 * Image generation router. fal.ai Flux schnell is ~10x faster +
 * dramatically cheaper than DALL-E for cover/thumbnail use cases.
 * Order configured via IMAGE_PROVIDER_ORDER (default "fal,openai").
 *
 * Provider responses are normalised to:
 *   { ok, status, provider, model, image_url? | image_b64?, error? }
 * Caller picks whichever field is present (b64 inlined into data: URL,
 * url forwarded as-is). Both fal and openai can return either form.
 * ============================================================ */
type ImageGenRequest = {
  prompt: string;
  size?: string;        // "1024x1024" — translated per provider
  quality?: string;     // "high" | "standard" — provider-specific
  output_format?: string; // "png" | "jpeg" | "webp"
  background?: string;  // openai-only
  prefer?: string[];
};
type ImageGenResponse = {
  ok: boolean;
  status: number;
  provider: string;
  model: string;
  image_url?: string;
  image_b64?: string;
  raw?: unknown;
  error?: string;
};

const IMAGE_PROVIDERS = ["fal", "huggingface", "pollinations", "fireworks", "deepinfra", "stability_image", "together", "replicate", "openai"] as const;
function imageProviderOrder(prefer?: string[]): string[] {
  // Tier order: fal/huggingface/pollinations(free) → fireworks/deepinfra/stability_image/together/replicate(cheap) → openai(premium).
  // pollinations promoted up the free tier — no-key reliable. fireworks/deepinfra/stability_image
  // lead the cheap tier (fast FLUX-schnell variants and Stability core).
  const env = String(process.env.IMAGE_PROVIDER_ORDER || "fal,huggingface,pollinations,fireworks,deepinfra,stability_image,together,replicate,openai")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const list = (prefer && prefer.length ? prefer : env).filter((p) =>
    (IMAGE_PROVIDERS as readonly string[]).includes(p));
  return (prefer && prefer.length) ? list : tierSortProviders(list);
}

async function callImageGen(req: ImageGenRequest): Promise<ImageGenResponse> {
  const order = imageProviderOrder(req.prefer);
  let lastErr = "no_providers_available";
  let lastStatus = 0;
  const sizeStr = req.size || "1024x1024";
  const dims = sizeStr.split("x").map((n) => Number.parseInt(n, 10) || 1024);
  const w = dims[0] || 1024;
  const h = dims[1] || 1024;
  for (const provider of order) {
    try {
      if (provider === "fal") {
        const apiKey = String(process.env.FAL_API_KEY || process.env.FAL_KEY || "").trim();
        if (!apiKey) continue;
        // fal.ai Flux schnell — sync endpoint takes prompt + image_size.
        // image_size accepts a preset ("square_hd" = 1024x1024, "portrait_16_9", etc.)
        // OR an object {width, height}. We pass the explicit object.
        const upstream = await fetch("https://fal.run/fal-ai/flux/schnell", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Key ${apiKey}`,
          },
          body: JSON.stringify({
            prompt: req.prompt,
            image_size: { width: w, height: h },
            num_inference_steps: 4, // schnell sweet-spot
            num_images: 1,
            enable_safety_checker: true,
          }),
        });
        const json: any = await upstream.json().catch(() => null);
        if (!upstream.ok) {
          lastErr = String(json?.detail || json?.error || `fal_${upstream.status}`);
          lastStatus = upstream.status;
          if (isCreditsError(lastStatus, JSON.stringify(json || {}) + " " + lastErr)) console.warn(`[image-router] fal credits exhausted, falling through`);
          else console.warn(`[image-router] fal ${upstream.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        const url = json?.images?.[0]?.url;
        if (!url) {
          lastErr = "fal_no_image_in_response";
          continue;
        }
        return {
          ok: true, status: upstream.status,
          provider: "fal", model: "flux-schnell",
          image_url: url, raw: json,
        };
      }
      if (provider === "together") {
        const apiKey = String(process.env.TOGETHER_API_KEY || "").trim();
        if (!apiKey) continue;
        const model = String(process.env.TOGETHER_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell-Free");
        const upstream = await fetch("https://api.together.xyz/v1/images/generations", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            prompt: req.prompt,
            width: w,
            height: h,
            steps: 4,
            n: 1,
          }),
        });
        const json: any = await upstream.json().catch(() => null);
        if (!upstream.ok) {
          lastErr = String(json?.error?.message || `together_${upstream.status}`);
          lastStatus = upstream.status;
          if (isCreditsError(lastStatus, JSON.stringify(json || {}) + " " + lastErr)) console.warn(`[image-router] together credits exhausted, falling through`);
          else console.warn(`[image-router] together ${upstream.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        const first = json?.data?.[0] || null;
        const url = typeof first?.url === "string" ? first.url : "";
        const b64 = typeof first?.b64_json === "string" ? first.b64_json : "";
        if (!url && !b64) {
          lastErr = "together_no_image_in_response";
          continue;
        }
        return {
          ok: true, status: upstream.status,
          provider: "together", model,
          image_url: url || undefined,
          image_b64: b64 || undefined,
          raw: json,
        };
      }
      if (provider === "replicate") {
        const apiKey = String(process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN || "").trim();
        if (!apiKey) continue;
        // Replicate uses model versions. Default to FLUX schnell official.
        const model = String(process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-schnell");
        // Sync prediction (Replicate's async-by-default flow with Prefer: wait).
        const upstream = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Token ${apiKey}`,
            "Prefer": "wait=60",
          },
          body: JSON.stringify({
            input: {
              prompt: req.prompt,
              aspect_ratio: w === h ? "1:1" : (w > h ? "16:9" : "9:16"),
              output_format: req.output_format || "png",
            },
          }),
        });
        const json: any = await upstream.json().catch(() => null);
        if (!upstream.ok) {
          lastErr = String(json?.detail || json?.error || `replicate_${upstream.status}`);
          lastStatus = upstream.status;
          if (isCreditsError(lastStatus, JSON.stringify(json || {}) + " " + lastErr)) console.warn(`[image-router] replicate credits exhausted, falling through`);
          else console.warn(`[image-router] replicate ${upstream.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        const out = json?.output;
        const url = Array.isArray(out) ? out[0] : (typeof out === "string" ? out : "");
        if (!url) {
          lastErr = "replicate_no_image_in_output";
          continue;
        }
        return {
          ok: true, status: upstream.status,
          provider: "replicate", model,
          image_url: url, raw: json,
        };
      }
      if (provider === "fireworks") {
        const apiKey = String(process.env.FIREWORKS_API_KEY || "").trim();
        if (!apiKey) continue;
        // Fireworks workflow endpoint for FLUX-1-schnell-fp8. Returns binary JPEG.
        const ratio = w === h ? "1:1" : (w / h >= 2 ? "21:9" : (w > h ? "16:9" : (h / w >= 2 ? "9:21" : "9:16")));
        const upstream = await fetch("https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "image/jpeg", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            prompt: req.prompt,
            aspect_ratio: ratio,
            guidance_scale: 3.5,
            num_inference_steps: 4,
            seed: Math.floor(Math.random() * 2_147_483_647),
          }),
        });
        if (!upstream.ok) {
          const body = await upstream.text().catch(() => "");
          lastErr = body.slice(0, 200) || `fireworks_${upstream.status}`;
          lastStatus = upstream.status;
          if (isCreditsError(lastStatus, body + " " + lastErr)) console.warn(`[image-router] fireworks credits exhausted, falling through`);
          else console.warn(`[image-router] fireworks ${upstream.status}: ${lastErr}`);
          continue;
        }
        const buf = Buffer.from(await upstream.arrayBuffer());
        return {
          ok: true, status: upstream.status,
          provider: "fireworks", model: "flux-1-schnell-fp8",
          image_b64: buf.toString("base64"),
        };
      }
      if (provider === "deepinfra") {
        const apiKey = String(process.env.DEEPINFRA_API_KEY || "").trim();
        if (!apiKey) continue;
        // DeepInfra FLUX-1-schnell. Returns JSON with images[] (data URLs or URLs).
        const upstream = await fetch("https://api.deepinfra.com/v1/inference/black-forest-labs/FLUX-1-schnell", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `bearer ${apiKey}` },
          body: JSON.stringify({
            prompt: req.prompt,
            width: w,
            height: h,
            num_inference_steps: 4,
          }),
        });
        const json: any = await upstream.json().catch(() => null);
        if (!upstream.ok) {
          lastErr = String(json?.detail || json?.error || `deepinfra_${upstream.status}`);
          lastStatus = upstream.status;
          if (isCreditsError(lastStatus, JSON.stringify(json || {}) + " " + lastErr)) console.warn(`[image-router] deepinfra credits exhausted, falling through`);
          else console.warn(`[image-router] deepinfra ${upstream.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        // Field name varies — check both `images` and `output`.
        const arr: any = Array.isArray(json?.images) ? json.images : (Array.isArray(json?.output) ? json.output : null);
        const first = arr ? arr[0] : null;
        let image_url: string | undefined;
        let image_b64: string | undefined;
        if (typeof first === "string") {
          if (first.startsWith("data:")) {
            const comma = first.indexOf(",");
            image_b64 = comma >= 0 ? first.slice(comma + 1) : undefined;
          } else {
            image_url = first;
          }
        }
        if (!image_url && !image_b64) {
          lastErr = "deepinfra_no_image_in_response";
          continue;
        }
        const resp: ImageGenResponse = {
          ok: true, status: upstream.status,
          provider: "deepinfra", model: "FLUX-1-schnell",
          raw: json,
        };
        if (image_url) resp.image_url = image_url;
        if (image_b64) resp.image_b64 = image_b64;
        return resp;
      }
      if (provider === "stability_image") {
        const apiKey = String(process.env.STABILITY_API_KEY || "").trim();
        if (!apiKey) continue;
        // Stable Image Core — multipart/form-data. accept: image/* returns binary bytes.
        const ratio = w === h ? "1:1" : (w / h >= 2 ? "21:9" : (w > h ? "16:9" : (h / w >= 2 ? "9:21" : "9:16")));
        const fd = new FormData();
        fd.append("prompt", req.prompt);
        fd.append("aspect_ratio", ratio);
        fd.append("output_format", "png");
        const upstream = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, accept: "image/*" },
          body: fd,
        });
        if (!upstream.ok) {
          const body = await upstream.text().catch(() => "");
          lastErr = body.slice(0, 200) || `stability_${upstream.status}`;
          lastStatus = upstream.status;
          if (isCreditsError(lastStatus, body + " " + lastErr)) console.warn(`[image-router] stability_image credits exhausted, falling through`);
          else console.warn(`[image-router] stability_image ${upstream.status}: ${lastErr}`);
          continue;
        }
        const buf = Buffer.from(await upstream.arrayBuffer());
        return {
          ok: true, status: upstream.status,
          provider: "stability_image", model: "stable-image-core",
          image_b64: buf.toString("base64"),
        };
      }
      if (provider === "huggingface") {
        const apiKey = String(process.env.HUGGINGFACE_API_KEY || "").trim();
        if (!apiKey) continue;
        const model = String(process.env.HUGGINGFACE_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell");
        // HF returns binary image bytes directly.
        const upstream = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            inputs: req.prompt,
            parameters: { width: w, height: h, num_inference_steps: 4 },
          }),
        });
        if (!upstream.ok) {
          const body = await upstream.text().catch(() => "");
          lastErr = body.slice(0, 200) || `huggingface_${upstream.status}`;
          lastStatus = upstream.status;
          if (isCreditsError(lastStatus, body + " " + lastErr)) console.warn(`[image-router] huggingface credits exhausted, falling through`);
          else console.warn(`[image-router] huggingface ${upstream.status}: ${lastErr}`);
          continue;
        }
        const buf = Buffer.from(await upstream.arrayBuffer());
        return {
          ok: true, status: upstream.status,
          provider: "huggingface", model,
          image_b64: buf.toString("base64"),
        };
      }
      if (provider === "openai") {
        const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
        if (!apiKey) continue;
        const model = String(process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
        const body: Record<string, unknown> = {
          model,
          prompt: req.prompt,
          size: sizeStr,
        };
        if (req.quality) body.quality = req.quality;
        if (req.output_format) body.output_format = req.output_format;
        if (req.background) body.background = req.background;
        const upstream = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        });
        const json: any = await upstream.json().catch(() => null);
        if (!upstream.ok) {
          lastErr = String(json?.error?.message || `openai_${upstream.status}`);
          lastStatus = upstream.status;
          if (isCreditsError(lastStatus, JSON.stringify(json || {}) + " " + lastErr)) console.warn(`[image-router] openai credits exhausted, falling through`);
          else console.warn(`[image-router] openai ${upstream.status}: ${lastErr.slice(0, 200)}`);
          continue;
        }
        const first = json?.data?.[0] || null;
        const image_b64 = typeof first?.b64_json === "string" ? first.b64_json : undefined;
        const image_url = typeof first?.url === "string" ? first.url : undefined;
        if (!image_b64 && !image_url) {
          lastErr = "openai_no_image_in_response";
          continue;
        }
        return {
          ok: true, status: upstream.status,
          provider: "openai", model,
          image_b64, image_url, raw: json,
        };
      }
      if (provider === "pollinations") {
        // CSSOS_PHASE2_POLLINATIONS 20260507 — Jing
        // No-key, fully free image gen. Returns JPEG bytes directly.
        // Use as last-resort before the SVG placeholder so users always
        // get an actual generated image even when every keyed provider
        // is exhausted. https://pollinations.ai/
        const seed = Math.floor(Math.random() * 1e9);
        const url = "https://image.pollinations.ai/prompt/"
          + encodeURIComponent(req.prompt || "abstract album cover")
          + `?width=${w}&height=${h}&nologo=true&seed=${seed}`;
        const upstream = await fetch(url, { method: "GET" });
        if (!upstream.ok) {
          lastErr = `pollinations_${upstream.status}`;
          lastStatus = upstream.status;
          console.warn(`[image-router] pollinations ${upstream.status}`);
          continue;
        }
        const buf = Buffer.from(await upstream.arrayBuffer());
        if (!buf.length) {
          lastErr = "pollinations_empty_body";
          continue;
        }
        return {
          ok: true, status: upstream.status,
          provider: "pollinations", model: "pollinations-flux",
          image_b64: buf.toString("base64"),
        };
      }
    } catch (err) {
      lastErr = String((err as Error)?.message || err);
      console.warn(`[image-router] ${provider} threw: ${lastErr}`);
      continue;
    }
  }
  return {
    ok: false, status: lastStatus || 502,
    provider: "none", model: "",
    error: lastErr,
  };
}

/* ============================================================
 * CSSOS_PHASE3_KARAOKE — Whisper-based per-word timing
 * ----------------------------------------------------------------
 * Pipeline lands audio → we POST it to OpenAI's Whisper endpoint
 * with timestamp_granularities[]=word → store
 *   [{ text, t_start, t_end }, ...]
 * into work_assets (asset_type='whisper_words', meta.words=...).
 * The public works endpoint hydrates this onto the response so the
 * frontend renderer (app.karaoke-active-word.js) can do exact-word
 * karaoke instead of even-distribution estimates.
 * ============================================================ */
type WhisperWord = { text: string; t_start: number; t_end: number };

async function enqueueKaraokeTranscription(workId: string): Promise<void> {
  const lookup = await withClient((c) =>
    c.query<{ audio_url: string | null; has_words: boolean }>(
      `SELECT
         (SELECT url FROM work_assets WHERE work_id = $1 AND asset_type = 'audio_track_1' LIMIT 1) AS audio_url,
         EXISTS(
           SELECT 1 FROM work_assets
           WHERE work_id = $1 AND asset_type = 'whisper_words'
             AND COALESCE(meta->>'word_count', '0')::int > 0
         ) AS has_words`,
      [workId],
    ),
  );
  const audioUrl = String(lookup.rows[0]?.audio_url || "").trim();
  if (!audioUrl) return;
  if (lookup.rows[0]?.has_words) return;
  // Fire-and-forget — we don't want to delay the asset commit.
  setImmediate(async () => {
    try {
      const words = await runWhisperWordTimings(audioUrl);
      if (!words || !words.length) return;
      // CSSOS_PHASE3_KARAOKE_EMOTION 20260507 — Jing
      // After Whisper produces {text,t_start,t_end}, send the full
      // word list to a fast LLM (Groq Llama 3.3 70B free tier) and
      // ask for a per-word emotion + weight (1-5). Frontend uses
      // weight=5 to amplify the fancy effect (bigger scale, longer
      // glow, explode). Failures here are non-fatal — we still
      // persist the bare timings.
      const enriched = await tagWordsWithEmotion(words);
      const finalWords = enriched && enriched.length === words.length
        ? enriched
        : words;
      await withClient((c) =>
        c.query(
          `INSERT INTO work_assets (work_id, asset_type, url, meta)
           VALUES ($1, 'whisper_words', $2, $3::jsonb)
           ON CONFLICT (work_id, asset_type)
           DO UPDATE SET url = EXCLUDED.url, meta = EXCLUDED.meta`,
          [
            workId,
            audioUrl,
            JSON.stringify({
              source: "groq-whisper-large-v3-turbo",
              word_count: finalWords.length,
              has_emotion: !!enriched,
              words: finalWords,
              transcribed_at: new Date().toISOString(),
            }),
          ],
        ),
      );
      console.info("[karaoke] persisted", finalWords.length, "words for", workId, enriched ? "(+emotion)" : "");
    } catch (err) {
      console.warn("[karaoke] whisper failed", workId, (err as Error)?.message || err);
    }
  });
}

async function runWhisperWordTimings(audioUrl: string): Promise<WhisperWord[] | null> {
  const groqKey = String(process.env.GROQ_API_KEY || "").trim();
  const openaiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!groqKey && !openaiKey) {
    console.warn("[karaoke] no GROQ_API_KEY or OPENAI_API_KEY — skipping");
    return null;
  }
  // Fetch the audio bytes. URL is either an https:// or relative
  // /secure/artifacts/... path; convert relative to absolute against
  // the server's own base.
  const fullUrl = audioUrl.startsWith("http")
    ? audioUrl
    : `http://127.0.0.1:${process.env.PORT || 3000}${audioUrl.startsWith("/") ? "" : "/"}${audioUrl}`;
  const audioRes = await fetch(fullUrl);
  if (!audioRes.ok) {
    console.warn("[karaoke] audio fetch failed", audioRes.status, fullUrl);
    return null;
  }
  const audioBuf = Buffer.from(await audioRes.arrayBuffer());
  // Try Groq first (free tier, fast, OpenAI-compatible API).
  if (groqKey) {
    const w = await callWhisperEndpoint({
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      apiKey: groqKey,
      model: "whisper-large-v3-turbo",
      audioBuf,
      provider: "groq",
    });
    if (w) return w;
    console.info("[karaoke] groq failed, trying openai fallback");
  }
  // Fall back to OpenAI.
  if (openaiKey) {
    const w = await callWhisperEndpoint({
      url: "https://api.openai.com/v1/audio/transcriptions",
      apiKey: openaiKey,
      model: "whisper-1",
      audioBuf,
      provider: "openai",
    });
    if (w) return w;
  }
  return null;
}

/* Per-word emotion + weight via Groq Llama 3.3 70B (free, fast).
 * Input: [{text,t_start,t_end}, ...]
 * Output: same array shape with two extra fields per word —
 *   emotion: "ignite" | "grief" | "joy" | "calm" | "intimate" | "resolve"
 *   weight:  1-5 (5 = the line's emotional peak, deserves explode)
 * Returns null on any failure so the caller can fall back to bare timings. */
type WhisperWordTagged = WhisperWord & { emotion?: string; weight?: number };

async function tagWordsWithEmotion(words: WhisperWord[]): Promise<WhisperWordTagged[] | null> {
  const groqKey = String(process.env.GROQ_API_KEY || "").trim();
  if (!groqKey) return null;
  if (!words || !words.length) return null;
  // Send only the text in order to keep token cost low. Reattach
  // timings on the way out.
  const lyrics = words.map((w, i) => `${i}\t${w.text}`).join("\n");
  const prompt = `You are tagging karaoke words for emotional emphasis.\n\n` +
    `Below is the full lyric word list, one per line, prefixed by index.\n` +
    `For each word, output ONE LINE in this exact JSON-array form:\n` +
    `[index, "emotion", weight]\n\n` +
    `emotion ∈ ignite | grief | joy | calm | intimate | resolve\n` +
    `weight  ∈ 1..5  (5 = song's emotional climax, only a few per song)\n\n` +
    `Output ONLY the array lines, no prose, no markdown. One per word, in order.\n\n` +
    `Words:\n${lyrics}`;
  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: Math.min(8000, words.length * 18 + 200),
    }),
  });
  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    console.warn("[karaoke-emotion] groq non-OK", upstream.status, txt.slice(0, 200));
    return null;
  }
  const json = await upstream.json().catch(() => null);
  const text: string = String(json?.choices?.[0]?.message?.content || "").trim();
  if (!text) return null;
  // Parse "[idx, "emotion", weight]" lines.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tagByIdx = new Map<number, { emotion: string; weight: number }>();
  for (const line of lines) {
    const m = line.match(/\[\s*(\d+)\s*,\s*"([a-z]+)"\s*,\s*(\d+)\s*\]/i);
    if (!m) continue;
    const idx = Number(m[1]);
    const emotion = String(m[2]).toLowerCase();
    const weight = Math.max(1, Math.min(5, Number(m[3])));
    if (
      ["ignite", "grief", "joy", "calm", "intimate", "resolve"].includes(emotion) &&
      Number.isInteger(idx) && idx >= 0 && idx < words.length
    ) {
      tagByIdx.set(idx, { emotion, weight });
    }
  }
  if (tagByIdx.size === 0) {
    console.warn("[karaoke-emotion] no parseable tags from groq response");
    return null;
  }
  const tagged: WhisperWordTagged[] = words.map((w, i) => {
    const tag = tagByIdx.get(i);
    return tag ? { ...w, emotion: tag.emotion, weight: tag.weight } : { ...w };
  });
  console.info("[karaoke-emotion] tagged", tagByIdx.size, "/", words.length, "words");
  return tagged;
}

async function callWhisperEndpoint(opts: {
  url: string;
  apiKey: string;
  model: string;
  audioBuf: Buffer;
  provider: string;
}): Promise<WhisperWord[] | null> {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(opts.audioBuf)], { type: "audio/mpeg" }), "audio.mp3");
  fd.append("model", opts.model);
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  const upstream = await fetch(opts.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    body: fd,
  });
  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    console.warn(`[karaoke] ${opts.provider} non-OK`, upstream.status, txt.slice(0, 200));
    return null;
  }
  const json = await upstream.json().catch(() => null);
  const rawWords = (json && Array.isArray(json.words)) ? json.words : [];
  const words = rawWords
    .map((w: { word?: string; start?: number; end?: number }) => ({
      text: String(w?.word || "").trim(),
      t_start: Number(w?.start || 0),
      t_end: Number(w?.end || 0),
    }))
    .filter((w: WhisperWord) => w.text && w.t_end > w.t_start);
  console.info(`[karaoke] ${opts.provider} returned ${words.length} words`);
  return words.length ? words : null;
}

function downgradeLosslessArtifactTarget(
  pathValue: string,
  assetKeyValue: string,
) {
  const path = String(pathValue || "").trim();
  const assetKey = String(assetKeyValue || "").trim();
  const nextPath = /\.wav$/i.test(path)
    ? path.replace(/\.wav$/i, ".mp3")
    : /\.flac$/i.test(path)
      ? path.replace(/\.flac$/i, ".mp3")
      : path;
  const nextAssetKey = /\.wav$/i.test(assetKey)
    ? assetKey.replace(/\.wav$/i, ".mp3")
    : /\.flac$/i.test(assetKey)
      ? assetKey.replace(/\.flac$/i, ".mp3")
      : assetKey;
  return {
    path: nextPath,
    asset_key: nextAssetKey,
  };
}

function buildCompactPipelineStatus(payload: any) {
  const stagesSource =
    payload?.stages &&
    typeof payload.stages === "object" &&
    !Array.isArray(payload.stages)
      ? payload.stages
      : {};
  const compactStages = Object.fromEntries(
    Object.entries(stagesSource).map(([name, rec]: [string, any]) => [
      name,
      {
        status: String(rec?.status || "").trim(),
        started_at: rec?.started_at || null,
        ended_at: rec?.ended_at || null,
        duration_seconds: Number(rec?.duration_seconds || 0),
        retries: Number(rec?.retries || 0),
        timeout_seconds: Number(rec?.timeout_seconds || 0),
        error: rec?.error ? String(rec.error).slice(0, 400) : "",
        error_code: rec?.error_code ? String(rec.error_code) : "",
        outputs: Array.isArray(rec?.outputs)
          ? rec.outputs
              .map((entry: unknown) => String(entry || "").trim())
              .filter(Boolean)
          : [],
      },
    ]),
  );
  const safeRunId = String(payload?.run_id || "").trim();
  const artifactMap = new Map<
    string,
    {
      kind: string;
      path: string;
      stage: string;
      mime: string;
      asset_key: string;
      storage_backend: string;
    }
  >();
  const sourceArtifacts = Array.isArray(payload?.artifacts)
    ? payload.artifacts
    : [];
  sourceArtifacts.forEach((entry: any) => {
    const artifactPath = String(entry?.path || "").trim();
    if (!artifactPath || artifactMap.has(artifactPath)) return;
    artifactMap.set(artifactPath, {
      kind: String(
        entry?.kind || guessPipelineArtifactKind(artifactPath),
      ).trim(),
      path: artifactPath,
      stage: String(entry?.stage || "").trim(),
      mime: String(
        entry?.mime || guessPipelineArtifactMime(artifactPath),
      ).trim(),
      asset_key: String(
        entry?.asset_key || buildRunArtifactAssetKey(safeRunId, artifactPath),
      ).trim(),
      storage_backend: String(entry?.storage_backend || "local-run").trim(),
    });
  });
  Object.entries(compactStages).forEach(([stageName, rec]: [string, any]) => {
    const outputs = Array.isArray(rec?.outputs) ? rec.outputs : [];
    outputs.forEach((artifactPath: string) => {
      const safePath = String(artifactPath || "").trim();
      if (!safePath || artifactMap.has(safePath)) return;
      artifactMap.set(safePath, {
        kind: guessPipelineArtifactKind(safePath),
        path: safePath,
        stage: stageName,
        mime: guessPipelineArtifactMime(safePath),
        asset_key: buildRunArtifactAssetKey(safeRunId, safePath),
        storage_backend: "local-run",
      });
    });
  });
  return {
    schema: String(payload?.schema || "css.pipeline.status.compact.v1"),
    run_id: String(payload?.run_id || "").trim(),
    status: String(payload?.status || "").trim(),
    created_at: payload?.created_at || null,
    updated_at: payload?.updated_at || null,
    heartbeat_at: payload?.heartbeat_at || null,
    ui_lang: String(payload?.ui_lang || "").trim(),
    tier: String(payload?.tier || "").trim(),
    total_duration_seconds: Number(payload?.total_duration_seconds || 0),
    video_shots_total: Number(payload?.video_shots_total || 0),
    stages: compactStages,
    artifacts: Array.from(artifactMap.values()),
  };
}

app.get("/api/pipeline/status", (req, res) => {
  noStore(res);
  try {
    const safePath = resolvePipelineStatusPath(String(req.query.path || ""));
    if (!safePath) {
      return res
        .status(400)
        .json({ ok: false, code: "PIPELINE_STATUS_PATH_INVALID" });
    }
    if (!fs.existsSync(safePath)) {
      // CSSOS_PHASE2_NO_RED_404 20260504 — Jing
      // "又是控制台报错". When the run state file hasn't been
      // persisted yet (frontend just registered the runId; the rust
      // pipeline writes asynchronously), the 404 painted a red line
      // in DevTools every poll cycle until the file landed. Return
      // 200 with an empty-status envelope and a `pending: true`
      // marker so callers can distinguish "not found" from "found-
      // but-empty"; the polling helper already treats empty payloads
      // as a no-op and tries again next interval.
      return res.json({
        ok: true,
        code: "PIPELINE_STATUS_PENDING",
        pending: true,
        stages: {},
      });
    }
    const payload = JSON.parse(fs.readFileSync(safePath, "utf8"));
    return res.json(buildCompactPipelineStatus(payload));
  } catch (error) {
    return res.status(500).json({
      ok: false,
      code: "PIPELINE_STATUS_READ_FAILED",
      message:
        error instanceof Error ? error.message : "pipeline status read failed",
    });
  }
});

function auditAuthLogin(
  req: express.Request,
  provider: string,
  userId: string,
  mode: string,
) {
  const ipRaw = (req.headers["x-forwarded-for"] as string) || req.ip || "";
  const ipParts = String(ipRaw).split(",");
  const ip = (ipParts[0] || "").trim();
  const ua = String(req.headers["user-agent"] || "");
  console.info(
    JSON.stringify({
      tag: "auth_login",
      provider,
      user_id: userId,
      mode,
      ip,
      ua: ua.slice(0, 200),
      ts: new Date().toISOString(),
    }),
  );
}

function auditAuthFailure(provider: string, mode: string, errorCode: string) {
  console.warn(
    JSON.stringify({
      tag: "auth_login_failed",
      provider,
      mode,
      error_code: errorCode,
      ts: new Date().toISOString(),
    }),
  );
}

type GenericOAuthProvider = {
  id: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  idKeys?: string[];
  emailKeys?: string[];
  nameKeys?: string[];
};

function envUpper(id: string) {
  return id.replace(/-/g, "_").toUpperCase();
}

function getByPath(v: any, path: string): any {
  const seg = path.split(".");
  let cur: any = v;
  for (const s of seg) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[s];
  }
  return cur;
}

function genericProviderSpec(id: string): GenericOAuthProvider | null {
  const key = envUpper(id);
  const authUrl = process.env[`${key}_AUTH_URL`] || "";
  const tokenUrl = process.env[`${key}_TOKEN_URL`] || "";
  const userInfoUrl = process.env[`${key}_USERINFO_URL`] || "";
  const clientId =
    process.env[`${key}_CLIENT_ID`] ||
    (id === "tiktok" ? process.env[`${key}_CLIENT_KEY`] || "" : "");
  const clientSecret = process.env[`${key}_CLIENT_SECRET`] || "";
  if (!clientId || !clientSecret) return null;
  if (!authUrl || !tokenUrl || !userInfoUrl) {
    if (id === "tiktok") {
      return {
        id,
        authUrl: "https://www.tiktok.com/v2/auth/authorize/",
        tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
        userInfoUrl: "https://open.tiktokapis.com/v2/user/info/",
        scopes: ["user.info.basic"],
        idKeys: ["data.user.open_id", "data.user.union_id", "open_id"],
        nameKeys: ["data.user.display_name", "data.user.username", "name"],
        emailKeys: ["data.user.email", "email"],
      };
    }
    return null;
  }
  const scopes = (process.env[`${key}_SCOPES`] || "openid email profile")
    .split(/[ ,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    id,
    authUrl,
    tokenUrl,
    userInfoUrl,
    scopes,
    idKeys: (process.env[`${key}_ID_KEYS`] || "sub,id,user_id,data.id")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    emailKeys: (process.env[`${key}_EMAIL_KEYS`] || "email,data.email")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    nameKeys: (
      process.env[`${key}_NAME_KEYS`] || "name,username,login,data.name"
    )
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  };
}

function pickFirstByKeys(v: any, keys: string[]) {
  for (const k of keys) {
    const x = getByPath(v, k);
    if (x !== undefined && x !== null && String(x).trim()) return String(x);
  }
  return "";
}

function applePrivateKeyPem() {
  const raw = process.env.APPLE_PRIVATE_KEY || "";
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

async function appleClientSecret() {
  const clientId = process.env.APPLE_CLIENT_ID || "";
  const teamId = process.env.APPLE_TEAM_ID || "";
  const keyId = process.env.APPLE_KEY_ID || "";
  const pem = applePrivateKeyPem();
  if (!clientId || !teamId || !keyId || !pem)
    throw new Error("apple_not_configured");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(crypto.createPrivateKey(pem));
}

async function verifyAppleIdToken(idToken: string) {
  const clientId = process.env.APPLE_CLIENT_ID || "";
  if (!clientId) throw new Error("apple_not_configured");
  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: "https://appleid.apple.com",
    audience: clientId,
  });
  return payload as {
    sub?: string;
    email?: string;
    nonce?: string;
    email_verified?: string | boolean;
  };
}

async function upsertOAuthIdentity(args: {
  provider: string;
  providerUserId: string;
  email: string | null;
  displayName?: string | null;
  // CSSOS_PHASE2_OAUTH_AVATAR 20260501 #250 — Jing
  // "请改进社交平台登录面板，必须获取用户在该社交平台的头像."
  // OAuth callbacks include the provider's profile picture URL
  // (Google: `picture`, Apple: `photo`, GitHub: `avatar_url`,
  // Douyin/TikTok: `avatar_url`). We accept it here and persist it
  // so the in-frame author avatar widget renders the user's real
  // photo instead of just initials.
  avatarUrl?: string | null;
}) {
  const provider = String(args.provider || "")
    .trim()
    .toLowerCase();
  const providerUserId = String(args.providerUserId || "").trim();
  const email = normalizeEmail(args.email);
  const displayName = args.displayName || null;
  const avatarUrl = String(args.avatarUrl || "").trim() || null;
  if (!provider || !providerUserId) throw new Error("oauth_identity_invalid");
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const found = await client.query<{ user_id: string }>(
        "SELECT user_id FROM oauth_identities WHERE provider = $1 AND provider_user_id = $2 LIMIT 1",
        [provider, providerUserId],
      );
      if (found.rows[0]?.user_id) {
        // Existing user — backfill avatar_url if it's still null and we
        // got a fresh URL from the provider this round.
        if (avatarUrl) {
          await client.query(
            "UPDATE users SET avatar_url = $2 WHERE id = $1 AND (avatar_url IS NULL OR avatar_url = '')",
            [found.rows[0].user_id, avatarUrl],
          );
        }
        await client.query("COMMIT");
        return found.rows[0].user_id;
      }

      if (email) {
        const sameEmail = await client.query<{ id: string }>(
          "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
          [email],
        );
        const userIdByEmail = sameEmail.rows[0]?.id;
        if (userIdByEmail) {
          await client.query(
            `INSERT INTO oauth_identities (user_id, provider, provider_user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (provider, provider_user_id) DO NOTHING`,
            [userIdByEmail, provider, providerUserId],
          );
          if (avatarUrl) {
            await client.query(
              "UPDATE users SET avatar_url = $2 WHERE id = $1 AND (avatar_url IS NULL OR avatar_url = '')",
              [userIdByEmail, avatarUrl],
            );
          }
          await client.query("COMMIT");
          return userIdByEmail;
        }
      }

      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (display_name, email, avatar_url)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [displayName, email, avatarUrl],
      );
      const userId = userRes.rows[0]?.id;
      if (!userId) throw new Error("user_create_failed");

      await client.query(
        `INSERT INTO oauth_identities (user_id, provider, provider_user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [userId, provider, providerUserId],
      );
      await client.query("COMMIT");
      return userId;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });
}

async function listLinkedProviders(userId: string) {
  const providers = new Set<string>();
  if (DATABASE_URL) {
    type Row = { provider: string };
    const oauth: QueryResult<Row> = await withClient((client) =>
      client.query<Row>(
        "SELECT provider FROM oauth_identities WHERE user_id = $1 ORDER BY provider",
        [userId],
      ),
    );
    for (const r of oauth.rows) providers.add(r.provider);
  }
  const pkCount = await passkeyCountBySubject(userSubjectKey(userId));
  if (pkCount > 0) providers.add("passkey");
  return {
    providers: Array.from(providers).sort(),
    passkeyCount: pkCount,
  };
}

async function ensureBillingAccount(userId: string) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM billing_accounts WHERE user_id = $1",
      [userId],
    );
    if (rows[0]) return { account: rows[0], created: false };
    const insert = await client.query(
      `INSERT INTO billing_accounts (user_id) VALUES ($1) RETURNING *`,
      [userId],
    );
    return { account: insert.rows[0], created: true };
  });
}

type CreatorBoostKind =
  | "language"
  | "voice"
  | "thumbnail"
  | "preview_video"
  | "generation"
  | "background_job";

/* ============================================================
 * CSSOS_PERSON_MV 20260507 — Jing
 * "人物文明 MV 宇宙" Wave 1 — DB schema + seed roster.
 *
 *   person_profiles:  curated + ad-hoc personality records.
 *                     Seed table is populated once on boot from
 *                     SEED_PERSON_PROFILES (idempotent ON CONFLICT).
 *   person_mvs:       per-MV record linking work_id ↔ person_id ↔
 *                     creator user. Counter views derive from this.
 *
 * Wave 2-4 will add adhoc registration, scenario seeding, civ-aware
 * smart linking. For now we ship the read paths so the panel can
 * render the curated roster. ============================================================ */
async function ensurePersonMvTables() {
  if (!DATABASE_URL) return;
  await withClient((client) =>
    client.query(`
      CREATE TABLE IF NOT EXISTS person_profiles (
        person_id          TEXT PRIMARY KEY,
        name_zh            TEXT NOT NULL,
        name_en            TEXT NOT NULL,
        civilization       TEXT NOT NULL,
        era                TEXT,
        lifespan           TEXT,
        roles              TEXT[] NOT NULL DEFAULT '{}',
        core_theme         TEXT,
        visual_symbols     TEXT[] NOT NULL DEFAULT '{}',
        music_style_hint   TEXT,
        tone               TEXT,
        influence_score    INTEGER NOT NULL DEFAULT 0,
        risk_notes         TEXT[] NOT NULL DEFAULT '{}',
        source_status      TEXT NOT NULL DEFAULT 'curated',
        created_by_user_id UUID,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS person_profiles_civ_idx
        ON person_profiles (civilization);
      CREATE INDEX IF NOT EXISTS person_profiles_influence_idx
        ON person_profiles (influence_score DESC);
      CREATE INDEX IF NOT EXISTS person_profiles_source_idx
        ON person_profiles (source_status);

      CREATE TABLE IF NOT EXISTS person_mvs (
        mv_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id          TEXT NOT NULL REFERENCES person_profiles(person_id) ON DELETE CASCADE,
        work_id            UUID NOT NULL,
        created_by_user_id UUID NOT NULL,
        scenario_seed      TEXT,
        duration_secs      INTEGER,
        approval_status    TEXT NOT NULL DEFAULT 'auto_published',
        visibility         TEXT NOT NULL DEFAULT 'public',
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS person_mvs_person_idx ON person_mvs (person_id);
      CREATE INDEX IF NOT EXISTS person_mvs_creator_idx ON person_mvs (created_by_user_id);

      ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS name_native TEXT;
      ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS name_latin TEXT;
      ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS lore JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS portrait_url TEXT;
      ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS portrait_generated_at TIMESTAMPTZ;
    `),
  );
}

let personSeedLoaded = false;
async function seedPersonProfilesOnce() {
  if (personSeedLoaded || !DATABASE_URL) return;
  await ensurePersonMvTables();
  for (const p of SEED_PERSON_PROFILES) {
    await withClient((client) =>
      client.query(
        `INSERT INTO person_profiles (
            person_id, name_zh, name_en, name_native, name_latin,
            civilization, era, lifespan,
            roles, core_theme, visual_symbols, music_style_hint, tone,
            influence_score, risk_notes, source_status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'curated')
         ON CONFLICT (person_id) DO UPDATE SET
            name_native = EXCLUDED.name_native,
            name_latin  = EXCLUDED.name_latin`,
        [
          p.person_id, p.name_zh, p.name_en,
          (p as any).name_native || null, (p as any).name_latin || null,
          p.civilization, p.era, p.lifespan,
          p.roles, p.core_theme, p.visual_symbols, p.music_style_hint, p.tone,
          p.influence_score, p.risk_notes,
        ],
      ),
    );
  }
  personSeedLoaded = true;
  console.info("[person-mv] seed loaded — %d profiles", SEED_PERSON_PROFILES.length);
}

async function ensureAdminUserActionsTable() {
  if (!DATABASE_URL) return;
  await withClient((client) =>
    client.query(`
      CREATE TABLE IF NOT EXISTS admin_user_actions (
        action_id TEXT PRIMARY KEY,
        user_id TEXT,
        target_email TEXT NOT NULL,
        action_kind TEXT NOT NULL,
        action_scope TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        actor_user_id TEXT NOT NULL,
        actor_email TEXT,
        note TEXT,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS admin_user_actions_target_email_idx
        ON admin_user_actions (lower(target_email), created_at DESC);
    `),
  );
}

async function appendAdminUserAction(args: {
  userId: string | null;
  targetEmail: string;
  actionKind: string;
  actionScope: "reward" | "penalty" | "membership" | "freeze" | "notice";
  quantity?: number;
  actorUserId: string;
  actorEmail?: string | null;
  note?: string | null;
  meta?: unknown;
}) {
  if (!DATABASE_URL) return null;
  await ensureAdminUserActionsTable();
  const actionId = `aua_${crypto.randomUUID()}`;
  await withClient((client) =>
    client.query(
      `INSERT INTO admin_user_actions (
         action_id, user_id, target_email, action_kind, action_scope, quantity,
         actor_user_id, actor_email, note, meta
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        actionId,
        args.userId || null,
        normalizeEmail(args.targetEmail),
        String(args.actionKind || "")
          .trim()
          .toLowerCase(),
        String(args.actionScope || "notice")
          .trim()
          .toLowerCase(),
        Math.max(0, Number(args.quantity || 0)),
        args.actorUserId,
        normalizeEmail(String(args.actorEmail || "")) || null,
        String(args.note || "")
          .trim()
          .slice(0, 500) || null,
        JSON.stringify(args.meta ?? {}),
      ],
    ),
  );
  return actionId;
}

async function listAdminUserActions(targetEmail: string, limit = 40) {
  if (!DATABASE_URL) return [];
  await ensureAdminUserActionsTable();
  const email = normalizeEmail(targetEmail);
  if (!email) return [];
  const rows = await withClient((client) =>
    client.query(
      `SELECT action_id, user_id, target_email, action_kind, action_scope, quantity,
              actor_user_id, actor_email, note, meta, created_at
         FROM admin_user_actions
        WHERE lower(target_email) = lower($1)
        ORDER BY created_at DESC
        LIMIT $2`,
      [email, Math.max(1, Math.min(200, Number(limit || 40)))],
    ),
  );
  return rows.rows;
}

function normalizeCreatorBoostKind(value: unknown): CreatorBoostKind | "" {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "language") return "language";
  if (raw === "voice") return "voice";
  if (raw === "thumbnail") return "thumbnail";
  if (raw === "preview_video") return "preview_video";
  if (raw === "generation") return "generation";
  if (raw === "background_job") return "background_job";
  return "";
}

async function listActiveEntitlements(userId: string) {
  if (!DATABASE_URL) return [];
  const res = await withClient((client) =>
    client.query(
      `SELECT id, entitlement_key, quantity, consumed_quantity, source, source_order_id, expires_at, meta, created_at, updated_at
       FROM account_entitlements
       WHERE user_id = $1
         AND quantity > consumed_quantity
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC`,
      [userId],
    ),
  );
  return res.rows;
}

function summarizeBoostEntitlements(rows: any[]) {
  const summary = {
    language: { purchased: 0, available: 0, consumed: 0 },
    voice: { purchased: 0, available: 0, consumed: 0 },
    thumbnail: { purchased: 0, available: 0, consumed: 0 },
    preview_video: { purchased: 0, available: 0, consumed: 0 },
    generation: { purchased: 0, available: 0, consumed: 0 },
    background_job: { purchased: 0, available: 0, consumed: 0 },
  };
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(row?.entitlement_key || "")
      .trim()
      .toLowerCase();
    if (
      ![
        "boost.language",
        "boost.voice",
        "boost.thumbnail",
        "boost.preview_video",
        "boost.generation",
        "boost.background_job",
      ].includes(key)
    )
      continue;
    const bucket = key.endsWith("language")
      ? summary.language
      : key.endsWith("voice")
        ? summary.voice
        : key.endsWith("thumbnail")
          ? summary.thumbnail
          : key.endsWith("preview_video")
            ? summary.preview_video
            : key.endsWith("background_job")
              ? summary.background_job
              : summary.generation;
    const quantity = Math.max(0, Number(row?.quantity || 0));
    const consumed = Math.max(0, Number(row?.consumed_quantity || 0));
    bucket.purchased += quantity;
    bucket.consumed += consumed;
    bucket.available += Math.max(0, quantity - consumed);
  }
  return summary;
}

async function createCreatorBoostOrder(args: {
  userId: string;
  boostKind: CreatorBoostKind;
  quantity: number;
  unitAmountCents: number;
  currency: string;
  meta?: Record<string, unknown>;
}) {
  const res = await withClient((client) =>
    client.query<{ id: string }>(
      `INSERT INTO creator_boost_orders (
         user_id, boost_kind, quantity, unit_amount_cents, gross_amount_cents, currency, status, meta
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7::jsonb)
       RETURNING id`,
      [
        args.userId,
        args.boostKind,
        Math.max(1, Math.min(20, Number(args.quantity || 1))),
        Math.max(0, Number(args.unitAmountCents || 0)),
        Math.max(0, Number(args.quantity || 1)) *
          Math.max(0, Number(args.unitAmountCents || 0)),
        String(args.currency || "USD").toUpperCase(),
        JSON.stringify(args.meta || {}),
      ],
    ),
  );
  return res.rows[0]?.id || null;
}

async function findCreatorBoostOrder(args: {
  orderId?: string | null;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
}) {
  if (!args.orderId && !args.checkoutSessionId && !args.paymentIntentId)
    return null;
  const res = await withClient((client) =>
    client.query(
      `SELECT *
       FROM creator_boost_orders
       WHERE ($1::uuid IS NOT NULL AND id = $1::uuid)
          OR ($2::text IS NOT NULL AND stripe_checkout_session_id = $2)
          OR ($3::text IS NOT NULL AND stripe_payment_intent_id = $3)
       ORDER BY created_at DESC
       LIMIT 1`,
      [
        args.orderId || null,
        args.checkoutSessionId || null,
        args.paymentIntentId || null,
      ],
    ),
  );
  return res.rows[0] || null;
}

async function updateCreatorBoostOrderStripeRefs(args: {
  orderId: string;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  status?: string | null;
  metaPatch?: Record<string, unknown>;
}) {
  const existing = await withClient((client) =>
    client.query<{ meta: any }>(
      "SELECT meta FROM creator_boost_orders WHERE id = $1 LIMIT 1",
      [args.orderId],
    ),
  );
  const mergedMeta = {
    ...(existing.rows[0]?.meta && typeof existing.rows[0].meta === "object"
      ? existing.rows[0].meta
      : {}),
    ...(args.metaPatch || {}),
  };
  await withClient((client) =>
    client.query(
      `UPDATE creator_boost_orders
       SET stripe_checkout_session_id = COALESCE($2, stripe_checkout_session_id),
           stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id),
           stripe_charge_id = COALESCE($4, stripe_charge_id),
           status = COALESCE($5, status),
           paid_at = CASE WHEN COALESCE($5, status) = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
           canceled_at = CASE WHEN COALESCE($5, status) = 'canceled' THEN COALESCE(canceled_at, now()) ELSE canceled_at END,
           meta = $6::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [
        args.orderId,
        args.checkoutSessionId || null,
        args.paymentIntentId || null,
        args.chargeId || null,
        args.status || null,
        JSON.stringify(mergedMeta),
      ],
    ),
  );
}

async function grantCreatorBoostEntitlement(args: {
  userId: string;
  boostKind: CreatorBoostKind;
  quantity: number;
  orderId?: string | null;
  meta?: Record<string, unknown>;
}) {
  await withClient(async (client) => {
    if (args.orderId) {
      const existing = await client.query(
        `SELECT id
         FROM account_entitlements
         WHERE user_id = $1
           AND entitlement_key = $2
           AND source_order_id = $3::uuid
         LIMIT 1`,
        [args.userId, `boost.${args.boostKind}`, args.orderId],
      );
      if (existing.rows[0]?.id) return;
    }
    await client.query(
      `INSERT INTO account_entitlements (
         user_id, entitlement_key, quantity, consumed_quantity, source, source_order_id, meta
       ) VALUES ($1, $2, $3, 0, $4, $5::uuid, $6::jsonb)`,
      [
        args.userId,
        `boost.${args.boostKind}`,
        Math.max(1, Math.min(20, Number(args.quantity || 1))),
        args.orderId ? "creator_boost_order" : "system",
        args.orderId || null,
        JSON.stringify(args.meta || {}),
      ],
    );
  });
}

async function consumeCreatorBoostEntitlement(args: {
  userId: string;
  boostKind: CreatorBoostKind;
  quantity: number;
  reason?: string;
  meta?: Record<string, unknown>;
}) {
  const remainingToConsume = Math.max(
    1,
    Math.min(20, Number(args.quantity || 1)),
  );
  let left = remainingToConsume;
  await withClient(async (client) => {
    const rows = await client.query(
      `SELECT id, quantity, consumed_quantity
       FROM account_entitlements
       WHERE user_id = $1
         AND entitlement_key = $2
         AND quantity > consumed_quantity
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at ASC
       FOR UPDATE`,
      [args.userId, `boost.${args.boostKind}`],
    );
    for (const row of rows.rows) {
      if (left <= 0) break;
      const available = Math.max(
        0,
        Number(row.quantity || 0) - Number(row.consumed_quantity || 0),
      );
      if (!available) continue;
      const consumeNow = Math.min(left, available);
      await client.query(
        `UPDATE account_entitlements
         SET consumed_quantity = consumed_quantity + $2,
             meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('last_consumed_reason', $3, 'last_consumed_at', now()::text, 'last_consumed_meta', $4::jsonb),
             updated_at = now()
         WHERE id = $1`,
        [
          row.id,
          consumeNow,
          args.reason || "creation_run",
          JSON.stringify(args.meta || {}),
        ],
      );
      left -= consumeNow;
    }
  });
  const consumed = remainingToConsume - left;
  if (consumed > 0) {
    const actionKey: BillableActionKey =
      args.boostKind === "language"
        ? "multi_language"
        : args.boostKind === "voice"
          ? "multi_voice"
          : args.boostKind === "thumbnail"
            ? "thumbnail_regenerate"
            : "preview_video_regenerate";
    const pricing = await getBillingActionPolicySettings();
    const estimatedCostCents =
      billableActionCostCents(actionKey, pricing) * consumed;
    await withClient((client) =>
      client.query(
        "INSERT INTO usage_events (user_id, route, units, cost_cents, meta) VALUES ($1,$2,$3,$4,$5)",
        [
          args.userId,
          `/api/creator-boost/${args.boostKind}/consume`,
          consumed,
          0,
          JSON.stringify({
            action_key: actionKey,
            covered_by: "boost",
            estimated_cost_cents: estimatedCostCents,
            reason: args.reason || "creation_run",
            ...(args.meta || {}),
          }),
        ],
      ),
    );
  }
  return { ok: left === 0, consumed, remainingShortfall: left };
}

let stripeClientCache: Stripe | null = null;

function getStripeClient() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secretKey) return null;
  if (!stripeClientCache) {
    stripeClientCache = new Stripe(secretKey);
  }
  return stripeClientCache;
}

function stripeStep1Configured() {
  return Boolean(getStripeClient());
}

async function upsertStripeCustomerRow(args: {
  userId: string;
  email: string | null;
  stripeCustomerId: string;
}) {
  type Row = {
    id: string;
    user_id: string;
    stripe_customer_id: string;
    email: string | null;
    created_at: string;
    updated_at: string;
  };
  const result: QueryResult<Row> = await withClient((client) =>
    client.query<Row>(
      `INSERT INTO stripe_customers (user_id, stripe_customer_id, email, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id)
       DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, email = EXCLUDED.email, updated_at = now()
       RETURNING *`,
      [args.userId, args.stripeCustomerId, args.email],
    ),
  );
  return result.rows[0] || null;
}

async function ensureStripeCustomer(args: {
  userId: string;
  email: string | null;
  name: string | null;
}) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("stripe_not_configured");
  }
  type Row = {
    id: string;
    user_id: string;
    stripe_customer_id: string;
    email: string | null;
    created_at: string;
    updated_at: string;
  };
  const existing: QueryResult<Row> = await withClient((client) =>
    client.query<Row>(
      "SELECT * FROM stripe_customers WHERE user_id = $1 LIMIT 1",
      [args.userId],
    ),
  );
  const current = existing.rows[0];
  if (current?.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(
        current.stripe_customer_id,
      );
      if (!("deleted" in customer) || !customer.deleted) {
        if (
          (args.email && customer.email !== args.email) ||
          (args.name && customer.name !== args.name)
        ) {
          await stripe.customers.update(current.stripe_customer_id, {
            ...(args.email ? { email: args.email } : {}),
            ...(args.name ? { name: args.name } : {}),
          });
        }
        return current;
      }
    } catch {
      // Recreate below if Stripe side no longer has this customer.
    }
  }
  const created = await stripe.customers.create({
    ...(args.email ? { email: args.email } : {}),
    ...(args.name ? { name: args.name } : {}),
    metadata: {
      cssos_user_id: args.userId,
    },
  });
  return upsertStripeCustomerRow({
    userId: args.userId,
    email: args.email,
    stripeCustomerId: created.id,
  });
}

async function upsertStripeConnectedAccountRow(args: {
  userId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  country: string | null;
  defaultCurrency: string;
}) {
  type Row = {
    id: string;
    user_id: string;
    stripe_account_id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    country: string | null;
    default_currency: string;
    created_at: string;
    updated_at: string;
  };
  const result: QueryResult<Row> = await withClient((client) =>
    client.query<Row>(
      `INSERT INTO stripe_connected_accounts (
         user_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, country, default_currency, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         stripe_account_id = EXCLUDED.stripe_account_id,
         charges_enabled = EXCLUDED.charges_enabled,
         payouts_enabled = EXCLUDED.payouts_enabled,
         details_submitted = EXCLUDED.details_submitted,
         country = EXCLUDED.country,
         default_currency = EXCLUDED.default_currency,
         updated_at = now()
       RETURNING *`,
      [
        args.userId,
        args.stripeAccountId,
        args.chargesEnabled,
        args.payoutsEnabled,
        args.detailsSubmitted,
        args.country,
        args.defaultCurrency,
      ],
    ),
  );
  return result.rows[0] || null;
}

async function syncStripeConnectedAccount(
  account: Stripe.Account,
  userId?: string | null,
) {
  const accountId = String(account.id || "").trim();
  if (!accountId) return null;
  const resolvedUserId =
    userId || String(account.metadata?.cssos_user_id || "").trim() || null;
  if (!resolvedUserId) {
    const found = await withClient((client) =>
      client.query<{ user_id: string }>(
        "SELECT user_id FROM stripe_connected_accounts WHERE stripe_account_id = $1 LIMIT 1",
        [accountId],
      ),
    );
    if (found.rows[0]?.user_id) {
      return upsertStripeConnectedAccountRow({
        userId: found.rows[0].user_id,
        stripeAccountId: account.id,
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        detailsSubmitted: Boolean(account.details_submitted),
        country: account.country || null,
        defaultCurrency: String(
          account.default_currency ||
            process.env.STRIPE_CONNECT_DEFAULT_CURRENCY ||
            "usd",
        ).toUpperCase(),
      });
    }
    return null;
  }
  return upsertStripeConnectedAccountRow({
    userId: resolvedUserId,
    stripeAccountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    country: account.country || null,
    defaultCurrency: String(
      account.default_currency ||
        process.env.STRIPE_CONNECT_DEFAULT_CURRENCY ||
        "usd",
    ).toUpperCase(),
  });
}

async function ensureStripeConnectedAccount(args: {
  userId: string;
  email: string | null;
  appBase: string;
}) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("stripe_not_configured");
  }
  type Row = {
    id: string;
    user_id: string;
    stripe_account_id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    country: string | null;
    default_currency: string;
    created_at: string;
    updated_at: string;
  };
  const existing: QueryResult<Row> = await withClient((client) =>
    client.query<Row>(
      "SELECT * FROM stripe_connected_accounts WHERE user_id = $1 LIMIT 1",
      [args.userId],
    ),
  );
  const current = existing.rows[0];
  if (current?.stripe_account_id) {
    try {
      const account = await stripe.accounts.retrieve(current.stripe_account_id);
      return upsertStripeConnectedAccountRow({
        userId: args.userId,
        stripeAccountId: account.id,
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        detailsSubmitted: Boolean(account.details_submitted),
        country: account.country || null,
        defaultCurrency: String(
          account.default_currency ||
            process.env.STRIPE_CONNECT_DEFAULT_CURRENCY ||
            "usd",
        ).toUpperCase(),
      });
    } catch {
      // Recreate below if Stripe side no longer has this account.
    }
  }
  const account = await stripe.accounts.create({
    type: (process.env.STRIPE_CONNECT_ACCOUNT_TYPE || "express") as
      | "express"
      | "standard"
      | "custom",
    country: String(process.env.STRIPE_CONNECT_COUNTRY || "US").toUpperCase(),
    ...(args.email ? { email: args.email } : {}),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: {
      cssos_user_id: args.userId,
      app_base: args.appBase,
    },
  });
  return upsertStripeConnectedAccountRow({
    userId: args.userId,
    stripeAccountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    country: account.country || null,
    defaultCurrency: String(
      account.default_currency ||
        process.env.STRIPE_CONNECT_DEFAULT_CURRENCY ||
        "usd",
    ).toUpperCase(),
  });
}

type CommerceProductKind = "listen" | "buyout" | "tip";

async function resolveCommerceProduct(args: {
  workId: string;
  orderKind: CommerceProductKind;
  tipAmountCents?: number | null;
}) {
  type ProductRow = {
    product_id: string | null;
    owner_user_id: string;
    currency: string;
    amount_cents: number;
    title: string;
    work_type: string | null;
    current_listen_price_cents: number;
    current_buyout_price_cents: number | null;
    buyout_enabled: boolean;
    tips_enabled: boolean;
    rights_scope: string;
  };

  const result = await withClient((client) =>
    client.query<ProductRow>(
      `SELECT
         wap.id AS product_id,
         w.user_id AS owner_user_id,
         COALESCE(wap.currency, 'USD') AS currency,
         COALESCE(wap.amount_cents, 0) AS amount_cents,
         w.title,
         w.work_type,
         COALESCE(mp.current_listen_price_cents, 0) AS current_listen_price_cents,
         mp.current_buyout_price_cents,
         COALESCE(mp.buyout_enabled, false) AS buyout_enabled,
         COALESCE(mp.tips_enabled, true) AS tips_enabled,
         COALESCE(mp.rights_scope, 'personal_use') AS rights_scope
       FROM user_works w
       LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
       LEFT JOIN work_access_products wap
         ON wap.work_id = w.id
        AND wap.product_kind = $2
        AND wap.active = true
       WHERE w.id = $1
       LIMIT 1`,
      [args.workId, args.orderKind],
    ),
  );

  const row = result.rows[0];
  if (!row) throw new Error("work_not_found");

  const preset = pricingPresetForWorkType(normalizeWorkType(row.work_type));
  const rawAmount =
    args.orderKind === "tip"
      ? Math.round(Math.max(100, Number(args.tipAmountCents || 0)))
      : args.orderKind === "buyout"
        ? Number(
            row.amount_cents ||
              row.current_buyout_price_cents ||
              preset.buyoutCents ||
              defaultBuyoutPriceCents(),
          )
        : Number(
            row.amount_cents ||
              row.current_listen_price_cents ||
              preset.listenCents ||
              defaultListenPriceCents(),
          );
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    throw new Error("product_not_priced");
  }
  if (args.orderKind === "buyout" && !(row.buyout_enabled || rawAmount > 0)) {
    throw new Error("buyout_not_enabled");
  }
  if (args.orderKind === "tip" && !row.tips_enabled) {
    throw new Error("tips_not_enabled");
  }

  let productId = row.product_id;
  if (!productId) {
    const inserted = await withClient((client) =>
      client.query<{ id: string }>(
        `INSERT INTO work_access_products (work_id, owner_user_id, product_kind, currency, amount_cents, active, meta)
         VALUES ($1, $2, $3, $4, $5, true, $6::jsonb)
         ON CONFLICT (work_id, product_kind)
         DO UPDATE SET currency = EXCLUDED.currency, amount_cents = EXCLUDED.amount_cents, active = true, updated_at = now()
         RETURNING id`,
        [
          args.workId,
          row.owner_user_id,
          args.orderKind,
          String(row.currency || "USD").toUpperCase(),
          rawAmount,
          JSON.stringify({
            seeded_by: "checkout_create",
            rights_scope: row.rights_scope,
            ...(args.orderKind === "tip"
              ? { tips_enabled: row.tips_enabled }
              : {}),
          }),
        ],
      ),
    );
    productId = inserted.rows[0]?.id || null;
  }

  return {
    productId,
    ownerUserId: row.owner_user_id,
    currency: String(row.currency || "USD").toUpperCase(),
    amountCents: rawAmount,
    title: row.title,
    rightsScope: row.rights_scope,
  };
}

async function createPendingWorkOrder(args: {
  buyerUserId: string;
  sellerUserId: string;
  workId: string;
  productId: string | null;
  orderKind: CommerceProductKind;
  currency: string;
  grossAmountCents: number;
  platformFeeCents: number;
  sellerNetCents: number;
  requestId: string;
  meta: Record<string, unknown>;
}) {
  const result = await withClient((client) =>
    client.query<{ id: string }>(
      `INSERT INTO work_orders (
         buyer_user_id, seller_user_id, work_id, product_id, order_kind, status, currency,
         gross_amount_cents, platform_fee_cents, seller_net_cents, request_id, meta
       ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING id`,
      [
        args.buyerUserId,
        args.sellerUserId,
        args.workId,
        args.productId,
        args.orderKind,
        args.currency,
        args.grossAmountCents,
        args.platformFeeCents,
        args.sellerNetCents,
        args.requestId,
        JSON.stringify(args.meta || {}),
      ],
    ),
  );
  return result.rows[0]?.id || null;
}

async function insertWorkTipIfMissing(args: {
  workId: string;
  tipperUserId: string;
  ownerUserId: string;
  currency: string;
  amountCents: number;
  orderId: string;
  message?: string | null;
}) {
  return withClient(async (client) => {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM work_tips WHERE meta->>'order_id' = $1 LIMIT 1`,
      [args.orderId],
    );
    if (existing.rows[0]?.id) return existing.rows[0].id;
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO work_tips (
         work_id, tipper_user_id, owner_user_id, currency, amount_cents, message, meta
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id`,
      [
        args.workId,
        args.tipperUserId,
        args.ownerUserId,
        args.currency,
        args.amountCents,
        args.message || null,
        JSON.stringify({ source: "stripe_webhook", order_id: args.orderId }),
      ],
    );
    return inserted.rows[0]?.id || null;
  });
}

function appendQueryToUrl(
  raw: string,
  params: Record<string, string | null | undefined>,
) {
  const input = String(raw || "").trim();
  if (!input) return input;
  try {
    const url = new URL(input);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  } catch {
    const [baseRaw = "", hash = ""] = input.split("#");
    const base = baseRaw || input;
    const separator = base.includes("?") ? "&" : "?";
    const query = Object.entries(params)
      .filter(
        ([, value]) => value !== null && value !== undefined && value !== "",
      )
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      )
      .join("&");
    return `${base}${query ? `${separator}${query}` : ""}${hash ? `#${hash}` : ""}`;
  }
}

async function findExistingBuyerWorkOrder(args: {
  buyerUserId: string;
  workId: string;
}) {
  const result = await withClient((client) =>
    client.query<any>(
      `SELECT id, order_kind, status, stripe_checkout_session_id, stripe_payment_intent_id, updated_at, created_at
       FROM work_orders
       WHERE buyer_user_id = $1
         AND work_id = $2
         AND status IN ('pending', 'processing', 'paid')
       ORDER BY
         CASE status
           WHEN 'paid' THEN 0
           WHEN 'processing' THEN 1
           WHEN 'pending' THEN 2
           ELSE 3
         END,
         updated_at DESC,
         created_at DESC`,
      [args.buyerUserId, args.workId],
    ),
  );
  return result.rows;
}

async function cancelPendingWorkOrder(args: {
  orderId?: string | null;
  buyerUserId?: string | null;
  checkoutSessionId?: string | null;
  reason: string;
}) {
  if (!args.orderId && !args.checkoutSessionId) return null;
  const result = await withClient((client) =>
    client.query<any>(
      `UPDATE work_orders
       SET status = 'canceled',
           updated_at = now(),
           meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
             'checkout_canceled_reason', $4,
             'checkout_canceled_at', now()::text
           )
       WHERE status IN ('pending', 'processing')
         AND ($1::uuid IS NULL OR id = $1::uuid)
         AND ($2::uuid IS NULL OR buyer_user_id = $2::uuid)
         AND ($3::text IS NULL OR stripe_checkout_session_id = $3)
       RETURNING id, work_id, order_kind, status`,
      [
        args.orderId || null,
        args.buyerUserId || null,
        args.checkoutSessionId || null,
        args.reason,
      ],
    ),
  );
  return result.rows[0] || null;
}

async function ensureWorkMarketSeed(args: {
  workId: string;
  ownerUserId: string;
  title?: string | null;
  style?: string | null;
  workType?: unknown;
  structureRole?: unknown;
  listenPriceCents?: number | null;
  buyoutPriceCents?: number | null;
  buyoutEnabled?: boolean;
}) {
  const role = String(args.structureRole || "")
    .trim()
    .toLowerCase();
  if (role === "act") return;
  const workType = normalizeWorkType(args.workType);
  const preset = inferWorkPricingPreset({
    title: args.title,
    style: args.style,
    workType,
  });
  const listenCents =
    Number.isFinite(Number(args.listenPriceCents)) &&
    Number(args.listenPriceCents) > 0
      ? Number(args.listenPriceCents)
      : preset.listenCents;
  const buyoutCents =
    Number.isFinite(Number(args.buyoutPriceCents)) &&
    Number(args.buyoutPriceCents) >= 0
      ? Number(args.buyoutPriceCents)
      : preset.buyoutCents;
  const buyoutEnabled = args.buyoutEnabled !== false;
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO work_market_profiles (
         work_id, owner_user_id, current_listen_price_cents, current_buyout_price_cents,
         tips_enabled, buyout_enabled, visibility, rights_scope
       ) VALUES ($1, $2, $3, $4, true, $5, 'public', 'personal_use')
       ON CONFLICT (work_id)
       DO UPDATE SET
         owner_user_id = EXCLUDED.owner_user_id,
         current_listen_price_cents = COALESCE(work_market_profiles.current_listen_price_cents, EXCLUDED.current_listen_price_cents),
         current_buyout_price_cents = COALESCE(work_market_profiles.current_buyout_price_cents, EXCLUDED.current_buyout_price_cents),
         buyout_enabled = COALESCE(work_market_profiles.buyout_enabled, EXCLUDED.buyout_enabled),
         tips_enabled = COALESCE(work_market_profiles.tips_enabled, true),
         visibility = CASE
           WHEN work_market_profiles.visibility IS NULL OR work_market_profiles.visibility = 'private'
             THEN 'public'
           ELSE work_market_profiles.visibility
         END,
         updated_at = now()`,
      [args.workId, args.ownerUserId, listenCents, buyoutCents, buyoutEnabled],
    );
    await client.query(
      `INSERT INTO work_access_products (work_id, owner_user_id, product_kind, currency, amount_cents, active, meta)
       VALUES ($1, $2, 'listen', 'USD', $3, true, $4::jsonb)
       ON CONFLICT (work_id, product_kind)
       DO UPDATE SET amount_cents = EXCLUDED.amount_cents, active = true, updated_at = now()`,
      [
        args.workId,
        args.ownerUserId,
        listenCents,
        JSON.stringify({
          seeded_by: "work_create",
          pricing_preset: preset.label,
          work_type: workType,
        }),
      ],
    );
    await client.query(
      `INSERT INTO work_access_products (work_id, owner_user_id, product_kind, currency, amount_cents, active, meta)
       VALUES ($1, $2, 'buyout', 'USD', $3, $4, $5::jsonb)
       ON CONFLICT (work_id, product_kind)
       DO UPDATE SET amount_cents = EXCLUDED.amount_cents, active = EXCLUDED.active, updated_at = now()`,
      [
        args.workId,
        args.ownerUserId,
        buyoutCents,
        buyoutEnabled,
        JSON.stringify({
          seeded_by: "work_create",
          pricing_preset: preset.label,
          work_type: workType,
        }),
      ],
    );
  });
}

async function updateWorkOrderStripeRefs(args: {
  orderId: string;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  status?: string | null;
  metaPatch?: Record<string, unknown>;
}) {
  return withClient(async (client) => {
    const existing = await client.query<{
      meta: Record<string, unknown> | null;
    }>("SELECT meta FROM work_orders WHERE id = $1 LIMIT 1", [args.orderId]);
    const nextMeta = {
      ...((existing.rows[0]?.meta as Record<string, unknown> | null) || {}),
      ...(args.metaPatch || {}),
    };
    await client.query(
      `UPDATE work_orders
       SET stripe_checkout_session_id = COALESCE($2, stripe_checkout_session_id),
           stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id),
           stripe_charge_id = COALESCE($4, stripe_charge_id),
           status = COALESCE($5, status),
           meta = $6::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [
        args.orderId,
        args.checkoutSessionId || null,
        args.paymentIntentId || null,
        args.chargeId || null,
        args.status || null,
        JSON.stringify(nextMeta),
      ],
    );
  });
}

async function findOrderForStripeEvent(args: {
  orderId?: string | null;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
}) {
  const result = await withClient((client) =>
    client.query<any>(
      `SELECT *
       FROM work_orders
       WHERE ($1::uuid IS NOT NULL AND id = $1::uuid)
          OR ($2::text IS NOT NULL AND stripe_checkout_session_id = $2)
          OR ($3::text IS NOT NULL AND stripe_payment_intent_id = $3)
       ORDER BY created_at DESC
       LIMIT 1`,
      [
        args.orderId || null,
        args.checkoutSessionId || null,
        args.paymentIntentId || null,
      ],
    ),
  );
  return result.rows[0] || null;
}

async function findStripeConnectedAccountByUserId(userId: string) {
  const result = await withClient((client) =>
    client.query<any>(
      "SELECT * FROM stripe_connected_accounts WHERE user_id = $1 LIMIT 1",
      [userId],
    ),
  );
  return result.rows[0] || null;
}

async function insertPayoutReconciliationIfMissing(args: {
  ownerUserId: string;
  stripeConnectedAccountRowId: string | null;
  currency: string;
  grossAmountCents: number;
  platformFeeCents: number;
  ownerNetCents: number;
  stripeTransferId?: string | null;
  status: string;
  orderId: string;
  availableAt?: Date | null;
  transferAttemptedAt?: Date | null;
  transferredAt?: Date | null;
  meta?: Record<string, unknown>;
}) {
  return withClient(async (client) => {
    const existing = await client.query<{ id: string }>(
      `SELECT id
       FROM payout_reconciliations
       WHERE owner_user_id = $1
         AND meta->>'order_id' = $2
       LIMIT 1`,
      [args.ownerUserId, args.orderId],
    );
    if (existing.rows[0]?.id) return existing.rows[0].id;
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO payout_reconciliations (
         owner_user_id, stripe_connected_account_id, currency, gross_amount_cents, platform_fee_cents,
         owner_net_cents, stripe_transfer_id, status, available_at, transfer_attempted_at, transferred_at, meta
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
       RETURNING id`,
      [
        args.ownerUserId,
        args.stripeConnectedAccountRowId,
        args.currency,
        args.grossAmountCents,
        args.platformFeeCents,
        args.ownerNetCents,
        args.stripeTransferId || null,
        args.status,
        args.availableAt || null,
        args.transferAttemptedAt || null,
        args.transferredAt || null,
        JSON.stringify({ order_id: args.orderId, ...(args.meta || {}) }),
      ],
    );
    return inserted.rows[0]?.id || null;
  });
}

async function updatePayoutReconciliationForOrder(args: {
  orderId: string;
  stripeConnectedAccountRowId?: string | null;
  stripeTransferId?: string | null;
  status: string;
  availableAt?: Date | null;
  transferAttemptedAt?: Date | null;
  transferredAt?: Date | null;
  metaPatch?: Record<string, unknown>;
}) {
  return withClient(async (client) => {
    const existing = await client.query<{
      id: string;
      meta: Record<string, unknown> | null;
    }>(
      `SELECT id, meta
       FROM payout_reconciliations
       WHERE meta->>'order_id' = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [args.orderId],
    );
    const row = existing.rows[0];
    if (!row?.id) return null;
    const nextMeta = {
      ...((row.meta as Record<string, unknown> | null) || {}),
      ...(args.metaPatch || {}),
    };
    await client.query(
      `UPDATE payout_reconciliations
       SET stripe_connected_account_id = COALESCE($2, stripe_connected_account_id),
           stripe_transfer_id = COALESCE($3, stripe_transfer_id),
           status = $4,
           available_at = COALESCE($5, available_at),
           transfer_attempted_at = COALESCE($6, transfer_attempted_at),
           transferred_at = COALESCE($7, transferred_at),
           meta = $8::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [
        row.id,
        args.stripeConnectedAccountRowId || null,
        args.stripeTransferId || null,
        args.status,
        args.availableAt || null,
        args.transferAttemptedAt || null,
        args.transferredAt || null,
        JSON.stringify(nextMeta),
      ],
    );
    return row.id;
  });
}

async function insertOwnershipTransferIfMissing(args: {
  workId: string;
  fromUserId: string | null;
  toUserId: string | null;
  orderId: string;
  currency: string;
  transferAmountCents: number;
}) {
  return withClient(async (client) => {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM ownership_transfers WHERE order_id = $1 LIMIT 1",
      [args.orderId],
    );
    if (existing.rows[0]?.id) return existing.rows[0].id;
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO ownership_transfers (
         work_id, from_user_id, to_user_id, order_id, transfer_kind, currency, transfer_amount_cents, meta
       ) VALUES ($1, $2, $3, $4, 'buyout', $5, $6, $7::jsonb)
       RETURNING id`,
      [
        args.workId,
        args.fromUserId,
        args.toUserId,
        args.orderId,
        args.currency,
        args.transferAmountCents,
        JSON.stringify({ source: "stripe_webhook" }),
      ],
    );
    return inserted.rows[0]?.id || null;
  });
}

async function ensureDeferredSellerPayout(order: any) {
  if (Number(order.seller_net_cents || 0) <= 0)
    return { transferId: null, status: "no_payout_due" };
  const connected = await findStripeConnectedAccountByUserId(
    String(order.seller_user_id || ""),
  );
  const commerce = await getCommercePolicySettings();
  const availableAt = await payoutAvailableAtForOrder(order);
  await insertPayoutReconciliationIfMissing({
    ownerUserId: String(order.seller_user_id || ""),
    stripeConnectedAccountRowId: connected?.id || null,
    currency: String(order.currency || "USD"),
    grossAmountCents: Number(order.gross_amount_cents || 0),
    platformFeeCents: Number(order.platform_fee_cents || 0),
    ownerNetCents: Number(order.seller_net_cents || 0),
    status: "pending_settlement",
    orderId: String(order.id || ""),
    availableAt,
    meta: {
      hold_days: commerce.payoutHoldDays,
      release_after: availableAt.toISOString(),
    },
  });
  return { transferId: null, status: "pending_settlement", availableAt };
}

async function createSellerTransferIfPossible(
  order: any,
  chargeId: string | null,
) {
  if (!chargeId) return { transferId: null, status: "paid_no_charge" };
  if (Number(order.seller_net_cents || 0) <= 0)
    return { transferId: null, status: "no_payout_due" };
  const stripe = getStripeClient();
  if (!stripe) return { transferId: null, status: "stripe_not_configured" };
  const connected = await findStripeConnectedAccountByUserId(
    String(order.seller_user_id || ""),
  );
  const availableAt = await payoutAvailableAtForOrder(order);
  if (!connected?.stripe_account_id) {
    await updatePayoutReconciliationForOrder({
      orderId: String(order.id || ""),
      stripeConnectedAccountRowId: connected?.id || null,
      status: "pending_connected_account",
      availableAt,
      transferAttemptedAt: new Date(),
      metaPatch: { reason: "missing_connected_account" },
    });
    return { transferId: null, status: "pending_connected_account" };
  }
  try {
    const transfer = await stripe.transfers.create({
      amount: Number(order.seller_net_cents || 0),
      currency: String(order.currency || "USD").toLowerCase(),
      destination: String(connected.stripe_account_id),
      source_transaction: chargeId,
      metadata: {
        order_id: String(order.id || ""),
        work_id: String(order.work_id || ""),
        seller_user_id: String(order.seller_user_id || ""),
      },
    });
    await updatePayoutReconciliationForOrder({
      orderId: String(order.id || ""),
      stripeConnectedAccountRowId: connected.id || null,
      stripeTransferId: transfer.id,
      status: "transferred",
      transferAttemptedAt: new Date(),
      transferredAt: new Date(),
      metaPatch: { source_transaction: chargeId },
    });
    return { transferId: transfer.id, status: "transferred" };
  } catch (err) {
    await updatePayoutReconciliationForOrder({
      orderId: String(order.id || ""),
      stripeConnectedAccountRowId: connected.id || null,
      status: "transfer_failed",
      transferAttemptedAt: new Date(),
      metaPatch: { error: String(err) },
    });
    return { transferId: null, status: "transfer_failed" };
  }
}

async function processMatureSellerPayouts(limit = 50) {
  const due = await withClient((client) =>
    client.query<any>(
      `SELECT pr.id AS payout_id,
              pr.owner_user_id,
              pr.available_at,
              pr.status AS payout_status,
              pr.meta AS payout_meta,
              wo.*
       FROM payout_reconciliations pr
       JOIN work_orders wo
         ON wo.id::text = pr.meta->>'order_id'
       WHERE wo.status = 'paid'
         AND pr.status IN ('pending_settlement', 'pending_connected_account', 'transfer_failed')
         AND pr.available_at IS NOT NULL
         AND pr.available_at <= now()
       ORDER BY pr.available_at ASC, pr.created_at ASC
       LIMIT $1`,
      [limit],
    ),
  );
  for (const row of due.rows) {
    const chargeId = String(row.stripe_charge_id || "").trim() || null;
    await createSellerTransferIfPossible(row, chargeId);
  }
  return due.rows.length;
}

async function recordStripeWebhookEvent(event: Stripe.Event) {
  return withClient(async (client) => {
    const inserted = await client.query<{ id: string; processed: boolean }>(
      `INSERT INTO stripe_webhook_events (stripe_event_id, event_type, livemode, payload, processed)
       VALUES ($1, $2, $3, $4::jsonb, false)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING id, processed`,
      [event.id, event.type, Boolean(event.livemode), JSON.stringify(event)],
    );
    if (inserted.rows[0]?.id) {
      return { id: inserted.rows[0].id, alreadyProcessed: false };
    }
    const existing = await client.query<{ id: string; processed: boolean }>(
      "SELECT id, processed FROM stripe_webhook_events WHERE stripe_event_id = $1 LIMIT 1",
      [event.id],
    );
    return {
      id: existing.rows[0]?.id || null,
      alreadyProcessed: Boolean(existing.rows[0]?.processed),
    };
  });
}

async function markStripeWebhookEventProcessed(
  eventId: string,
  error?: string | null,
) {
  await withClient((client) =>
    client.query(
      `UPDATE stripe_webhook_events
       SET processed = $2,
           processed_at = CASE WHEN $2 THEN now() ELSE processed_at END,
           processing_error = $3
       WHERE stripe_event_id = $1`,
      [eventId, !error, error || null],
    ),
  );
}

async function processStripeWebhookEvent(event: Stripe.Event) {
  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    await syncStripeConnectedAccount(account);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    // P2-25b: subscription upgrade via Stripe Checkout.
    const membershipTier = normalizeMembershipTier(
      session.metadata?.membership_tier,
    );
    const membershipUserId =
      String(session.metadata?.buyer_user_id || "").trim() || null;
    if (
      membershipUserId &&
      (membershipTier === "starter" ||
        membershipTier === "pro" ||
        membershipTier === "studio" ||
        membershipTier === "enterprise")
    ) {
      await ensureBillingAccount(membershipUserId);
      await withClient((client) =>
        client.query(
          `UPDATE billing_accounts
           SET membership_tier = $2,
               membership_source = 'stripe_checkout',
               membership_updated_at = now(),
               updated_at = now()
           WHERE user_id = $1`,
          [membershipUserId, membershipTier],
        ),
      );
      // CSSOS_PHASE2_PERSONALIZATION_STAGE_C 20260503 — Jing
      // First paying subscriber on the platform → drop a personal gift
      // MV in their inbox via the personalization engine. Per-user
      // oneShot is engine-enforced; the platform-global "exactly once"
      // gate is enforced here by checking system_gift_audit for any
      // prior first_subscriber row across all users.
      try {
        const { rows: priorRows } = await withClient((client) =>
          client.query(
            `SELECT 1
               FROM system_gift_audit
              WHERE trigger_key = 'first_subscriber'
                AND status IN ('pending','generating','delivered','viewed')
              LIMIT 1`,
          ),
        );
        if (priorRows.length === 0) {
          void import("./personalization/index.js").then((mod) => {
            mod.fireTriggerFireAndForget(getPool(), {
              triggerKey: "first_subscriber",
              targetUserId: membershipUserId,
              livemode: true,
              payload: {
                source: "stripe_checkout.session.completed",
                membership_tier: membershipTier,
                checkout_session_id: session.id,
              },
            });
          });
        }
      } catch (err) {
        console.warn(
          "[personalization] first_subscriber dispatch failed (non-fatal):",
          err instanceof Error ? err.message : String(err),
        );
      }
      return;
    }
    const creatorBoostOrderId =
      String(session.metadata?.creator_boost_order_id || "").trim() || null;
    if (creatorBoostOrderId) {
      await updateCreatorBoostOrderStripeRefs({
        orderId: creatorBoostOrderId,
        checkoutSessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null,
        status: "processing",
        metaPatch: {
          checkout_session_status: session.status,
          payment_status: session.payment_status,
        },
      });
      return;
    }
    const orderId = String(session.metadata?.order_id || "").trim() || null;
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;
    const order = await findOrderForStripeEvent({
      orderId,
      checkoutSessionId: session.id,
      paymentIntentId,
    });
    if (!order) return;
    await updateWorkOrderStripeRefs({
      orderId: String(order.id),
      checkoutSessionId: session.id,
      paymentIntentId,
      status: "processing",
      metaPatch: {
        checkout_session_status: session.status,
        payment_status: session.payment_status,
      },
    });
    return;
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const creatorBoostOrderId =
      String(session.metadata?.creator_boost_order_id || "").trim() || null;
    if (creatorBoostOrderId) {
      await updateCreatorBoostOrderStripeRefs({
        orderId: creatorBoostOrderId,
        checkoutSessionId: session.id,
        status: "canceled",
        metaPatch: {
          canceled_reason: "stripe_checkout_session_expired",
        },
      });
      return;
    }
    const orderId = String(session.metadata?.order_id || "").trim() || null;
    await cancelPendingWorkOrder({
      orderId,
      checkoutSessionId: session.id,
      reason: "stripe_checkout_session_expired",
    });
    return;
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const creatorBoostOrderId =
      String(intent.metadata?.creator_boost_order_id || "").trim() || null;
    if (creatorBoostOrderId) {
      await updateCreatorBoostOrderStripeRefs({
        orderId: creatorBoostOrderId,
        paymentIntentId: intent.id,
        status: "failed",
        metaPatch: {
          payment_error: intent.last_payment_error?.message || null,
        },
      });
      return;
    }
    const orderId = String(intent.metadata?.order_id || "").trim() || null;
    const order = await findOrderForStripeEvent({
      orderId,
      paymentIntentId: intent.id,
    });
    if (!order) return;
    await updateWorkOrderStripeRefs({
      orderId: String(order.id),
      paymentIntentId: intent.id,
      status: "failed",
      metaPatch: {
        payment_error: intent.last_payment_error?.message || null,
      },
    });
    return;
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const creatorBoostOrderId =
      String(intent.metadata?.creator_boost_order_id || "").trim() || null;
    if (creatorBoostOrderId) {
      const boostOrder = await findCreatorBoostOrder({
        orderId: creatorBoostOrderId,
        paymentIntentId: intent.id,
      });
      if (!boostOrder) return;
      const chargeId =
        typeof intent.latest_charge === "string"
          ? intent.latest_charge
          : intent.latest_charge?.id || null;
      await updateCreatorBoostOrderStripeRefs({
        orderId: String(boostOrder.id),
        paymentIntentId: intent.id,
        chargeId,
        status: "paid",
        metaPatch: {
          stripe_payment_status: intent.status,
        },
      });
      await grantCreatorBoostEntitlement({
        userId: String(boostOrder.user_id || ""),
        boostKind:
          normalizeCreatorBoostKind(boostOrder.boost_kind) || "generation",
        quantity: Math.max(1, Number(boostOrder.quantity || 1)),
        orderId: String(boostOrder.id || ""),
        meta: {
          source: "stripe_webhook",
          payment_intent_id: intent.id,
        },
      });
      return;
    }
    const orderId = String(intent.metadata?.order_id || "").trim() || null;
    const order = await findOrderForStripeEvent({
      orderId,
      paymentIntentId: intent.id,
    });
    if (!order) return;
    const chargeId =
      typeof intent.latest_charge === "string"
        ? intent.latest_charge
        : intent.latest_charge?.id || null;
    const payout = await ensureDeferredSellerPayout(order);
    await updateWorkOrderStripeRefs({
      orderId: String(order.id),
      paymentIntentId: intent.id,
      chargeId,
      status: "paid",
      metaPatch: {
        transfer_status: payout.status,
        stripe_transfer_id: payout.transferId,
        payout_available_at: payout.availableAt?.toISOString?.() || null,
      },
    });
    if (String(order.order_kind || "") === "tip") {
      await insertWorkTipIfMissing({
        workId: String(order.work_id || ""),
        tipperUserId: String(order.buyer_user_id || ""),
        ownerUserId: String(order.seller_user_id || ""),
        currency: String(order.currency || "USD"),
        amountCents: Number(order.gross_amount_cents || 0),
        orderId: String(order.id || ""),
        message: String(order?.meta?.tip_message || "").trim() || null,
      });
    }
    if (String(order.order_kind || "") === "buyout") {
      await insertOwnershipTransferIfMissing({
        workId: String(order.work_id || ""),
        fromUserId: String(order.seller_user_id || "") || null,
        toUserId: String(order.buyer_user_id || "") || null,
        orderId: String(order.id || ""),
        currency: String(order.currency || "USD"),
        transferAmountCents: Number(order.gross_amount_cents || 0),
      });
    }
  }

  // P2-25b: if a subscription is canceled/deleted, drop the user back to free.
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId =
      String(subscription.metadata?.buyer_user_id || "").trim() || null;
    if (userId) {
      await withClient((client) =>
        client.query(
          `UPDATE billing_accounts
           SET membership_tier = 'free',
               membership_source = 'stripe_subscription_deleted',
               membership_updated_at = now(),
               updated_at = now()
           WHERE user_id = $1`,
          [userId],
        ),
      );
    }
    return;
  }
}

async function resetMonthIfNeeded(userId: string) {
  const monthKey = new Date().toISOString().slice(0, 7);
  await withClient(async (client) => {
    await client.query(
      `UPDATE billing_accounts
       SET month_key = $2, month_spent_cents = 0, updated_at = now()
       WHERE user_id = $1 AND month_key <> $2`,
      [userId, monthKey],
    );
  });
}

async function consumeBillableAction(args: {
  userId: string;
  access: Awaited<ReturnType<typeof resolveUserAccessProfile>>;
  actionKey: BillableActionKey;
  units?: number;
  route?: string;
  countAgainstMonthlyLimit?: boolean;
  coveredBy?: "membership" | "boost" | "enterprise" | "booking" | "admin";
  meta?: Record<string, unknown>;
}) {
  const units = Math.max(1, Math.min(100000, Number(args.units || 1) || 1));
  const route = String(
    args.route || `/api/billing/actions/${args.actionKey}`,
  ).trim();
  const countAgainstMonthlyLimit = args.countAgainstMonthlyLimit === true;
  let coveredBy = args.coveredBy || "membership";
  const policy = await getBillingActionPolicySettings();
  const estimatedCostCents = Math.max(
    0,
    billableActionCostCents(args.actionKey, policy) * units,
  );
  if (args.access.tier === "admin" || args.access.tier === "vip") {
    await withClient((client) =>
      client.query(
        "INSERT INTO usage_events (user_id, route, units, cost_cents, meta) VALUES ($1,$2,$3,$4,$5)",
        [
          args.userId,
          route,
          units,
          0,
          JSON.stringify({
            action_key: args.actionKey,
            covered_by: "admin",
            estimated_cost_cents: estimatedCostCents,
            tier: args.access.tier,
            ...(args.meta || {}),
          }),
        ],
      ),
    );
    return {
      ok: true as const,
      allowed: true,
      cost_cents: 0,
      estimated_cost_cents: estimatedCostCents,
      limit: null,
      remaining: null,
    };
  }

  await resetMonthIfNeeded(args.userId);
  const account =
    args.access.billingAccount ||
    (await ensureBillingAccount(args.userId)).account;
  const monthlyGenerationLimit = countAgainstMonthlyLimit
    ? Number(args.access.policy.monthlyGenerationLimit || 0)
    : 0;
  return withClient(async (client) => {
    await client.query("BEGIN");
    const accountRes = await client.query(
      "SELECT * FROM billing_accounts WHERE user_id = $1 FOR UPDATE",
      [args.userId],
    );
    const lockedAccount = accountRes.rows[0] || account;

    if (monthlyGenerationLimit > 0) {
      const usageCountRes = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM usage_events
         WHERE user_id = $1
           AND route = $2
           AND COALESCE(meta->>'blocked', '') = ''
           AND created_at >= date_trunc('month', now())`,
        [args.userId, route],
      );
      const usedCount = Number(usageCountRes.rows[0]?.count || 0);
      if (usedCount >= monthlyGenerationLimit) {
        let generationBoostAvailable = 0;
        const generationEntitlements = await client.query(
          `SELECT id, quantity, consumed_quantity
           FROM account_entitlements
           WHERE user_id = $1
             AND entitlement_key = 'boost.generation'
             AND quantity > consumed_quantity
             AND (expires_at IS NULL OR expires_at > now())
           ORDER BY created_at ASC
           FOR UPDATE`,
          [args.userId],
        );
        for (const row of generationEntitlements.rows) {
          generationBoostAvailable += Math.max(
            0,
            Number(row.quantity || 0) - Number(row.consumed_quantity || 0),
          );
        }
        if (generationBoostAvailable > 0) {
          let remainingBoostToConsume = 1;
          for (const row of generationEntitlements.rows) {
            if (remainingBoostToConsume <= 0) break;
            const available = Math.max(
              0,
              Number(row.quantity || 0) - Number(row.consumed_quantity || 0),
            );
            if (!available) continue;
            const consumeNow = Math.min(remainingBoostToConsume, available);
            await client.query(
              `UPDATE account_entitlements
               SET consumed_quantity = consumed_quantity + $2,
                   meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
                     'last_consumed_reason', $3,
                     'last_consumed_at', now()::text
                   ),
                   updated_at = now()
               WHERE id = $1`,
              [row.id, consumeNow, args.actionKey],
            );
            remainingBoostToConsume -= consumeNow;
            generationBoostAvailable -= consumeNow;
          }
        }
        if (generationBoostAvailable <= 0) {
          await client.query(
            "INSERT INTO usage_events (user_id, route, units, cost_cents, meta) VALUES ($1,$2,$3,$4,$5)",
            [
              args.userId,
              route,
              units,
              0,
              JSON.stringify({
                action_key: args.actionKey,
                blocked: "membership_limit",
                covered_by: coveredBy,
                estimated_cost_cents: estimatedCostCents,
                tier: args.access.tier,
                recommended_topup_boost: "generation",
                recommended_topup_quantity:
                  args.access.tier === "starter" ? 10 : 20,
                ...(args.meta || {}),
              }),
            ],
          );
          await client.query("COMMIT");
          return {
            ok: true as const,
            allowed: false,
            cost_cents: 0,
            estimated_cost_cents: estimatedCostCents,
            limit: monthlyGenerationLimit,
            remaining: 0,
            topup_boost_kind: "generation",
            topup_recommended_quantity:
              args.access.tier === "starter" ? 10 : 20,
          };
        }
        coveredBy = "boost";
      }
    }

    const coreCovered =
      policy.includedMembershipCoversCore && coveredBy === "membership";
    let usageCostCents =
      coreCovered || coveredBy === "boost" || coveredBy === "booking"
        ? 0
        : estimatedCostCents;
    let nextBalance = Number(lockedAccount?.balance_cents || 0);
    const monthSpent = Number(lockedAccount?.month_spent_cents || 0);
    const monthLimit = Number(lockedAccount?.monthly_limit_cents || 0);

    if (coveredBy === "enterprise" && usageCostCents > 0) {
      if (monthLimit > 0 && monthSpent + usageCostCents > monthLimit) {
        await client.query(
          "INSERT INTO usage_events (user_id, route, units, cost_cents, meta) VALUES ($1,$2,$3,$4,$5)",
          [
            args.userId,
            route,
            units,
            usageCostCents,
            JSON.stringify({
              action_key: args.actionKey,
              blocked: "monthly_limit",
              covered_by: coveredBy,
              estimated_cost_cents: estimatedCostCents,
              ...(args.meta || {}),
            }),
          ],
        );
        await client.query("COMMIT");
        return {
          ok: true as const,
          allowed: false,
          cost_cents: usageCostCents,
          estimated_cost_cents: estimatedCostCents,
          limit: monthLimit,
          remaining: 0,
        };
      }
      if (nextBalance < usageCostCents) {
        await client.query(
          "INSERT INTO usage_events (user_id, route, units, cost_cents, meta) VALUES ($1,$2,$3,$4,$5)",
          [
            args.userId,
            route,
            units,
            usageCostCents,
            JSON.stringify({
              action_key: args.actionKey,
              blocked: "insufficient_balance",
              covered_by: coveredBy,
              estimated_cost_cents: estimatedCostCents,
              ...(args.meta || {}),
            }),
          ],
        );
        await client.query("COMMIT");
        return {
          ok: true as const,
          allowed: false,
          cost_cents: usageCostCents,
          estimated_cost_cents: estimatedCostCents,
          limit: monthLimit || null,
          remaining: 0,
        };
      }
      nextBalance -= usageCostCents;
    }

    const usageRes = await client.query<{ id: string }>(
      "INSERT INTO usage_events (user_id, route, units, cost_cents, meta) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [
        args.userId,
        route,
        units,
        usageCostCents,
        JSON.stringify({
          action_key: args.actionKey,
          covered_by: coveredBy,
          estimated_cost_cents: estimatedCostCents,
          tier: args.access.tier,
          ...(args.meta || {}),
        }),
      ],
    );
    const relatedUsageEventId =
      String(usageRes.rows[0]?.id || "").trim() || null;

    if (
      coveredBy === "enterprise" &&
      usageCostCents > 0 &&
      relatedUsageEventId
    ) {
      await client.query(
        "INSERT INTO ledger_entries (user_id, kind, amount_cents, balance_after_cents, related_usage_event_id, note) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          args.userId,
          "debit",
          -usageCostCents,
          nextBalance,
          relatedUsageEventId,
          `${args.actionKey}`,
        ],
      );
      await client.query(
        "UPDATE billing_accounts SET balance_cents = $2, month_spent_cents = $3, updated_at = now() WHERE user_id = $1",
        [args.userId, nextBalance, monthSpent + usageCostCents],
      );
    }
    await client.query("COMMIT");
    return {
      ok: true as const,
      allowed: true,
      cost_cents: usageCostCents,
      estimated_cost_cents: estimatedCostCents,
      limit: monthlyGenerationLimit || monthLimit || null,
      remaining:
        monthlyGenerationLimit > 0
          ? Math.max(0, monthlyGenerationLimit - 1)
          : null,
    };
  });
}

function setAuthSession(
  req: express.Request,
  userId: string,
  provider: string,
) {
  (req.session as any).user_id = userId;
  (req.session as any).passkey_subject_key = userSubjectKey(userId);
  (req.session as any).auth_provider = provider;
  // CSSOS_PHASE2_PERSONALIZATION_WELCOME_HOOK 20260502 #273 - Jing
  // Every successful login funnels through here (OAuth callbacks,
  // passkey, email-OTP, dev login). Fire the welcome trigger
  // unconditionally — the engine's oneShot=true policy + silent-skip
  // path means returning users never produce audit rows or extra
  // work. First-time users get a system_gift_audit row, a
  // personalization_template_renders row, and a Curator-owned
  // user_works row landing in their /api/personalization/inbox.
  //
  // Fire-and-forget: handler errors are caught by the engine and
  // recorded in the audit row; login MUST NOT block on gift
  // generation.
  try {
    void import("./personalization/index.js").then((mod) => {
      mod.fireTriggerFireAndForget(getPool(), {
        triggerKey: "welcome",
        targetUserId: userId,
        livemode: true,
        payload: { provider },
      });
    });
  } catch (err) {
    console.warn(
      "[personalization] welcome hook failed to dispatch (non-fatal):",
      err instanceof Error ? err.message : String(err),
    );
  }
}

function isLocalDevRequest(req: express.Request) {
  const host = String(req.hostname || "").toLowerCase();
  return !IS_PROD && (host === "localhost" || host === "127.0.0.1");
}

async function ensureDevLoginUser(email: string, displayName: string | null) {
  return withClient(async (client) => {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [email],
    );
    const found = existing.rows[0]?.id;
    if (found) return found;

    const created = await client.query<{ id: string }>(
      `INSERT INTO users (display_name, email, avatar_url)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [displayName, email, null],
    );
    const userId = created.rows[0]?.id;
    if (!userId) throw new Error("dev_login_user_create_failed");
    return userId;
  });
}

app.get("/api/dev/login", async (req, res) => {
  noStore(res);
  try {
    if (!isLocalDevRequest(req)) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND" });
    }
    const email = String(req.query.email || "dev@localhost")
      .trim()
      .toLowerCase();
    const displayName =
      String(req.query.name || "Local Dev").trim() || "Local Dev";
    const userId = await ensureDevLoginUser(email, displayName);
    setAuthSession(req, userId, "dev_local");
    return req.session.save((err) => {
      if (err) {
        return res.status(500).json({
          ok: false,
          code: "DEV_LOGIN_SAVE_FAILED",
          message: String(err),
        });
      }
      return res.json(
        okData({
          authenticated: true,
          dev_login: true,
          user_id: userId,
          email,
        }),
      );
    });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, code: "DEV_LOGIN_FAILED", message: String(err) });
  }
});

app.use("/api/registry", async (req, res) => {
  try {
    const url = `${REGISTRY_URL}${req.url}`;
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string" && key.toLowerCase() !== "host") {
        headers[key] = value;
      }
    }
    const init: RequestInit = {
      method: req.method,
      headers,
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = JSON.stringify(req.body ?? {});
      if (!headers["content-type"]) {
        init.headers = { ...headers, "content-type": "application/json" };
      }
    }

    const upstream = await fetch(url, init);
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (_err) {
    res.status(502).json({ error: "registry_unavailable" });
  }
});

app.get("/api/me", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json(
        okEmpty(
          { authenticated: false, user: null, auth_provider: null },
          "No data yet",
        ),
      );
    }
    const access = await resolveUserAccessProfile(user);
    const permissionSnapshot = buildPermissionSnapshot(
      access.tier,
      access.role,
    );
    return res.json(
      okData({
        authenticated: true,
        user: {
          id: user.id,
          name: user.display_name,
          email: user.email,
          avatar: user.avatar_url,
        },
        auth_provider: (req.session as any)?.auth_provider || null,
        session_days: Math.max(
          1,
          Math.round(
            Number(
              (req.session as any)?.cookie?.maxAge ||
                sessionConfig.cookie?.maxAge ||
                0,
            ) /
              (1000 * 60 * 60 * 24),
          ),
        ),
        session_expires_at: (req.session as any)?.cookie?.expires || null,
        role: access.role,
        tier: access.tier,
        queue_lane: queueLaneForTier(access.tier),
        permission_snapshot: permissionSnapshot,
      }),
    );
  } catch (_err) {
    return res.json(
      okEmpty(
        { authenticated: false, user: null, auth_provider: null },
        "No data yet",
      ),
    );
  }
});

app.post("/api/profile/switch-provider", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res
        .status(401)
        .json(okEmpty({ switched: false }, "Not signed in"));
    }
    const provider = String(req.body?.provider || "")
      .trim()
      .toLowerCase();
    if (!provider) {
      return res
        .status(400)
        .json(
          okEmpty(
            { switched: false, code: "PROVIDER_REQUIRED" },
            "Missing provider",
          ),
        );
    }
    const linked = await listLinkedProviders(user.id);
    if (!linked.providers.includes(provider)) {
      return res
        .status(404)
        .json(
          okEmpty(
            { switched: false, code: "PROVIDER_NOT_LINKED" },
            "Provider not linked",
          ),
        );
    }
    (req.session as any).auth_provider = provider;
    return res.json(
      okData({
        switched: true,
        provider,
        linked_auth: { providers: linked.providers },
      }),
    );
  } catch {
    return res
      .status(500)
      .json(
        okEmpty({ switched: false, code: "SWITCH_FAILED" }, "Switch failed"),
      );
  }
});

app.post("/api/profile/session-policy", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json(okEmpty({ updated: false }, "Not signed in"));
    }
    const days = Number(req.body?.days || 0);
    if (![30, 90, 180, 365].includes(days)) {
      return res
        .status(400)
        .json(
          okEmpty(
            { updated: false, code: "INVALID_SESSION_DAYS" },
            "Invalid session days",
          ),
        );
    }
    (req.session as any).cookie.maxAge = 1000 * 60 * 60 * 24 * days;
    return res.json(
      okData({
        updated: true,
        session_days: days,
        session_expires_at: (req.session as any).cookie.expires || null,
      }),
    );
  } catch {
    return res
      .status(500)
      .json(
        okEmpty(
          { updated: false, code: "SESSION_POLICY_FAILED" },
          "Session policy failed",
        ),
      );
  }
});

app.get("/api/profile", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res
        .status(401)
        .json(okEmpty({ authenticated: false }, "No data yet"));
    }
    const access = await resolveUserAccessProfile(user);
    const linked = await listLinkedProviders(user.id);
    const permissionSnapshot = buildPermissionSnapshot(
      access.tier,
      access.role,
    );
    return res.json(
      okData({
        authenticated: true,
        profile: {
          id: user.id,
          name: user.display_name,
          email: user.email,
          avatar: user.avatar_url,
          role: access.role,
          tier: access.tier,
          queue_lane: queueLaneForTier(access.tier),
        },
        linked_auth: {
          providers: linked.providers,
          passkey_count: linked.passkeyCount,
        },
        permission_snapshot: permissionSnapshot,
      }),
    );
  } catch {
    return res
      .status(500)
      .json(okEmpty({ authenticated: false }, "No data yet"));
  }
});

app.get("/api/panel-defaults/creation", async (_req, res) => {
  noStore(res);
  try {
    const base = defaultCreationPanelTemplate();
    if (!DATABASE_URL) {
      return res.json(okData({ defaults: base }));
    }
    const row = await withClient((client) =>
      client.query<{ value: any }>(
        `SELECT value FROM panel_default_templates WHERE panel_key = 'creation' LIMIT 1`,
      ),
    );
    const merged = mergeCreationPanelTemplate(row.rows[0]?.value || base);
    return res.json(okData({ defaults: merged }));
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "PANEL_DEFAULTS_LOAD_FAILED" });
  }
});

app.patch("/api/panel-defaults/creation", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    if (roleForEmail(user.email) !== "admin") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN" });
    }
    const merged = mergeCreationPanelTemplate(
      req.body?.defaults || req.body || {},
    );
    if (DATABASE_URL) {
      await withClient((client) =>
        client.query(
          `INSERT INTO panel_default_templates (panel_key, value, updated_by_user_id)
           VALUES ('creation', $1::jsonb, $2)
           ON CONFLICT (panel_key)
           DO UPDATE SET value = EXCLUDED.value, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
          [JSON.stringify(merged), user.id],
        ),
      );
    }
    return res.json(okData({ defaults: merged, saved: true }));
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "PANEL_DEFAULTS_SAVE_FAILED" });
  }
});

app.get("/api/panel-defaults/:panelKey", async (req, res) => {
  noStore(res);
  try {
    const panelKey = normalizePanelDefaultsKey(req.params.panelKey);
    if (!panelKey) {
      return res.status(404).json({ ok: false, code: "UNKNOWN_PANEL_KEY" });
    }
    if (panelKey === "creation") {
      const base = defaultCreationPanelTemplate();
      if (!DATABASE_URL) {
        return res.json(okData({ defaults: base }));
      }
      const row = await withClient((client) =>
        client.query<{ value: any }>(
          `SELECT value FROM panel_default_templates WHERE panel_key = 'creation' LIMIT 1`,
        ),
      );
      const merged = mergeCreationPanelTemplate(row.rows[0]?.value || base);
      return res.json(okData({ defaults: merged }));
    }
    if (!DATABASE_URL) {
      return res.json(okData({ defaults: {} }));
    }
    const row = await withClient((client) =>
      client.query<{ value: any }>(
        `SELECT value FROM panel_default_templates WHERE panel_key = $1 LIMIT 1`,
        [panelKey],
      ),
    );
    const defaults =
      panelKey === "behavior"
        ? sanitizeBehaviorPanelTemplate(row.rows[0]?.value || {})
        : sanitizeGenericPanelTemplate(row.rows[0]?.value || {});
    return res.json(okData({ defaults }));
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "PANEL_DEFAULTS_LOAD_FAILED" });
  }
});

app.post("/api/panel-media/logo", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    if (roleForEmail(user.email) !== "admin") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN" });
    }
    const slot = String(req.body?.slot || "")
      .trim()
      .toLowerCase();
    if (!["image_1", "image_2", "video"].includes(slot)) {
      return res.status(400).json({ ok: false, code: "INVALID_SLOT" });
    }
    const decoded = decodeDataUrlToFile(String(req.body?.data_url || ""));
    if (!decoded || !decoded.buffer?.length) {
      return res.status(400).json({ ok: false, code: "INVALID_MEDIA_DATA" });
    }
    const isVideo = slot === "video";
    if (isVideo && !decoded.mime.startsWith("video/")) {
      return res.status(400).json({ ok: false, code: "INVALID_VIDEO_MIME" });
    }
    if (!isVideo && !decoded.mime.startsWith("image/")) {
      return res.status(400).json({ ok: false, code: "INVALID_IMAGE_MIME" });
    }
    const sizeLimit = isVideo ? 30 * 1024 * 1024 : 12 * 1024 * 1024;
    if (decoded.buffer.length > sizeLimit) {
      return res.status(413).json({ ok: false, code: "MEDIA_TOO_LARGE" });
    }
    const safeExt = extensionForMime(decoded.mime, isVideo ? ".mp4" : ".webp");
    const mediaDir = path.join(PANEL_MEDIA_DIR, "logo");
    fs.mkdirSync(mediaDir, { recursive: true });
    const filename = `${slot}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`;
    const absolutePath = path.join(mediaDir, filename);
    fs.writeFileSync(absolutePath, decoded.buffer);
    const publicUrl = `/uploads/panel-media/logo/${filename}`;
    return res.json(okData({ url: publicUrl, slot, saved: true }));
  } catch {
    return res.status(500).json({ ok: false, code: "PANEL_MEDIA_SAVE_FAILED" });
  }
});

app.get("/api/music-sources/draft", async (req, res) => {
  noStore(res);
  const draft = ((req.session as any)?.music_source_draft || {}) as Record<
    string,
    any
  >;
  const parserJobDraft =
    ((req.session as any)?.music_source_parser_draft as Record<
      string,
      any
    > | null) || buildMusicSourceParserJobDraft(draft);
  const parserTaskDraft =
    ((req.session as any)?.music_source_parser_task_draft as Record<
      string,
      any
    > | null) || buildMusicSourceParserTaskDraft(draft);
  const parserTask = resolveStoredMusicSourceParserTask(
    ((req.session as any)?.music_source_parser_task as Record<
      string,
      any
    > | null) || null,
  );
  const entries = Object.fromEntries(
    Object.entries(draft).map(([kind, entry]) => [
      kind,
      entry && typeof entry === "object"
        ? {
            kind: entry.kind || kind,
            file_name: entry.file_name || "",
            mime: entry.mime || "",
            size: Number(entry.size || 0),
            uploaded_at: entry.uploaded_at || null,
            metadata_summary: summarizeMusicSourceEntry(entry),
          }
        : null,
    ]),
  );
  return res.json(
    okData({
      draft: entries,
      parser_job_draft: parserJobDraft,
      parser_task_draft: parserTaskDraft,
      parser_task: parserTask,
    }),
  );
});

app.get("/api/music-sources/parser-tasks/current", async (req, res) => {
  noStore(res);
  try {
    const parserTask = resolveStoredMusicSourceParserTask(
      ((req.session as any)?.music_source_parser_task as Record<
        string,
        any
      > | null) || null,
    );
    if (parserTask && String(parserTask.status || "").trim() === "queued") {
      scheduleMusicSourceParserWorker(0);
    }
    (req.session as any).music_source_parser_task = parserTask;
    return req.session.save((err) => {
      if (err) {
        return res
          .status(500)
          .json({ ok: false, code: "MUSIC_SOURCE_PARSER_TASK_STATUS_FAILED" });
      }
      return res.json(okData({ parser_task: parserTask }));
    });
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "MUSIC_SOURCE_PARSER_TASK_STATUS_FAILED" });
  }
});

app.post("/api/music-sources/upload", async (req, res) => {
  noStore(res);
  try {
    const kind = normalizeMusicSourceKind(req.body?.kind);
    if (!kind) {
      return res
        .status(400)
        .json({ ok: false, code: "INVALID_MUSIC_SOURCE_KIND" });
    }
    const decoded = decodeDataUrlToFile(String(req.body?.data_url || ""));
    if (!decoded || !decoded.buffer?.length) {
      return res
        .status(400)
        .json({ ok: false, code: "INVALID_MUSIC_SOURCE_DATA" });
    }
    if (!validateMusicSourceMime(kind, decoded.mime)) {
      return res
        .status(400)
        .json({ ok: false, code: "INVALID_MUSIC_SOURCE_MIME" });
    }
    if (decoded.buffer.length > musicSourceSizeLimit(kind)) {
      return res
        .status(413)
        .json({ ok: false, code: "MUSIC_SOURCE_TOO_LARGE" });
    }
    const safeExt = extensionForMime(decoded.mime, ".bin");
    const safeName =
      String(req.body?.file_name || `${kind}${safeExt}`).trim() ||
      `${kind}${safeExt}`;
    const draftDir = path.join(MUSIC_SOURCE_UPLOAD_DIR, req.sessionID);
    fs.mkdirSync(draftDir, { recursive: true });
    const filename = `${kind}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`;
    const absolutePath = path.join(draftDir, filename);
    fs.writeFileSync(absolutePath, decoded.buffer);
    const nextEntry = musicSourceDraftEntryForSession(
      kind,
      safeName,
      absolutePath,
      decoded.mime,
      decoded.buffer.length,
    );
    const nextDraft = {
      ...(((req.session as any)?.music_source_draft || {}) as Record<
        string,
        any
      >),
      [kind]: nextEntry,
    };
    const parserJobDraft = buildMusicSourceParserJobDraft(nextDraft);
    const parserTaskDraft = buildMusicSourceParserTaskDraft(nextDraft);
    (req.session as any).music_source_draft = nextDraft;
    (req.session as any).music_source_parser_draft = parserJobDraft;
    (req.session as any).music_source_parser_task_draft = parserTaskDraft;
    (req.session as any).music_source_parser_task = null;
    return req.session.save((err) => {
      if (err) {
        return res
          .status(500)
          .json({ ok: false, code: "MUSIC_SOURCE_DRAFT_SAVE_FAILED" });
      }
      return res.json(
        okData({
          kind,
          entry: {
            kind: nextEntry.kind,
            file_name: nextEntry.file_name,
            mime: nextEntry.mime,
            size: nextEntry.size,
            uploaded_at: nextEntry.uploaded_at,
            metadata_summary: summarizeMusicSourceEntry(nextEntry),
          },
          parser_job_draft: parserJobDraft,
          parser_task_draft: parserTaskDraft,
          parser_task: null,
        }),
      );
    });
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "MUSIC_SOURCE_UPLOAD_FAILED" });
  }
});

app.delete("/api/music-sources/draft/:kind", async (req, res) => {
  noStore(res);
  try {
    const kind = normalizeMusicSourceKind(req.params.kind);
    if (!kind) {
      return res
        .status(400)
        .json({ ok: false, code: "INVALID_MUSIC_SOURCE_KIND" });
    }
    const draft = {
      ...(((req.session as any)?.music_source_draft || {}) as Record<
        string,
        any
      >),
    };
    const current = draft[kind];
    if (current?.absolute_path) {
      fs.rmSync(String(current.absolute_path), { force: true });
    }
    draft[kind] = null;
    const parserJobDraft = buildMusicSourceParserJobDraft(draft);
    const parserTaskDraft = buildMusicSourceParserTaskDraft(draft);
    (req.session as any).music_source_draft = draft;
    (req.session as any).music_source_parser_draft = parserJobDraft;
    (req.session as any).music_source_parser_task_draft = parserTaskDraft;
    (req.session as any).music_source_parser_task = null;
    return req.session.save((err) => {
      if (err) {
        return res
          .status(500)
          .json({ ok: false, code: "MUSIC_SOURCE_DRAFT_SAVE_FAILED" });
      }
      return res.json(
        okData({
          cleared: true,
          kind,
          parser_job_draft: parserJobDraft,
          parser_task_draft: parserTaskDraft,
          parser_task: null,
        }),
      );
    });
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "MUSIC_SOURCE_DRAFT_CLEAR_FAILED" });
  }
});

app.post("/api/music-sources/parser-draft", async (req, res) => {
  noStore(res);
  try {
    const draft = ((req.session as any)?.music_source_draft || {}) as Record<
      string,
      any
    >;
    const parserJobDraft = buildMusicSourceParserJobDraft(draft);
    (req.session as any).music_source_parser_draft = parserJobDraft;
    return req.session.save((err) => {
      if (err) {
        return res
          .status(500)
          .json({ ok: false, code: "MUSIC_SOURCE_DRAFT_SAVE_FAILED" });
      }
      return res.json(
        okData({
          parser_job_draft: parserJobDraft,
          parser_task: (req.session as any)?.music_source_parser_task || null,
        }),
      );
    });
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "MUSIC_SOURCE_PARSER_DRAFT_FAILED" });
  }
});

app.post("/api/music-sources/parser-task-draft", async (req, res) => {
  noStore(res);
  try {
    const draft = ((req.session as any)?.music_source_draft || {}) as Record<
      string,
      any
    >;
    const parserTaskDraft = buildMusicSourceParserTaskDraft(draft);
    (req.session as any).music_source_parser_task_draft = parserTaskDraft;
    return req.session.save((err) => {
      if (err) {
        return res
          .status(500)
          .json({ ok: false, code: "MUSIC_SOURCE_DRAFT_SAVE_FAILED" });
      }
      return res.json(
        okData({
          parser_task_draft: parserTaskDraft,
          parser_task: (req.session as any)?.music_source_parser_task || null,
        }),
      );
    });
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "MUSIC_SOURCE_PARSER_TASK_DRAFT_FAILED" });
  }
});

app.post("/api/music-sources/parser-tasks", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    const access = await resolveUserAccessProfile(user);
    const draft = ((req.session as any)?.music_source_draft || {}) as Record<
      string,
      any
    >;
    const parserTask = buildQueuedMusicSourceParserTask(
      draft,
      access,
      req.sessionID,
    );
    if (!parserTask) {
      return res
        .status(400)
        .json({ ok: false, code: "MUSIC_SOURCE_PARSER_TASK_EMPTY" });
    }
    const persistedPath = persistQueuedMusicSourceParserTask(parserTask);
    (req.session as any).music_source_parser_task = {
      ...parserTask,
      task_path: persistedPath,
    };
    return req.session.save((err) => {
      if (err) {
        return res
          .status(500)
          .json({ ok: false, code: "MUSIC_SOURCE_PARSER_TASK_QUEUE_FAILED" });
      }
      scheduleMusicSourceParserWorker(0);
      return res.json(
        okData({
          parser_task: (req.session as any).music_source_parser_task,
        }),
      );
    });
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "MUSIC_SOURCE_PARSER_TASK_QUEUE_FAILED" });
  }
});

app.get("/api/example-assets/manifest", async (_req, res) => {
  noStore(res);
  try {
    const requestedKind = String(_req.query?.kind || "all")
      .trim()
      .toLowerCase();
    const items = await listBucketObjects(EXAMPLE_ASSET_PREFIX);
    const files = items
      .map((entry: any) =>
        sanitizeExampleAssetName(
          String(entry?.name || "").replace(/^examples\//, ""),
        ),
      )
      .filter((name: string) => Boolean(name))
      .filter((name: string) => !path.basename(name).startsWith("._"))
      .filter((name: string) => {
        if (requestedKind === "audio")
          return /\.(wav|mp3|m4a|aac|flac|ogg)$/i.test(name);
        if (requestedKind === "mv" || requestedKind === "video")
          return /\.(mp4|webm|mov)$/i.test(name);
        return true;
      })
      .sort((left: string, right: string) => left.localeCompare(right));
    return res.json(
      okData({
        storage_backend: "gcs",
        files,
        items: files.map((name: string) => ({
          name,
          kind: /\.(mp4|webm|mov)$/i.test(name) ? "video" : "audio",
          mime: inferExampleAssetMime(name),
          asset_key: `${EXAMPLE_ASSET_PREFIX}${name}`,
          url: `/api/example-assets/blob?name=${encodeURIComponent(name)}`,
        })),
      }),
    );
  } catch {
    return res
      .status(502)
      .json({ ok: false, code: "EXAMPLE_ASSET_MANIFEST_FAILED" });
  }
});

app.get("/api/example-assets/blob", async (req, res) => {
  noStore(res);
  try {
    const name = sanitizeExampleAssetName(String(req.query?.name || ""));
    if (!name) {
      return res
        .status(400)
        .json({ ok: false, code: "EXAMPLE_ASSET_NAME_REQUIRED" });
    }
    const objectName = `${EXAMPLE_ASSET_PREFIX}${name}`;
    const upstream = await fetchBucketObject(objectName);
    if (!upstream.ok) {
      return res
        .status(upstream.status || 502)
        .json({ ok: false, code: "EXAMPLE_ASSET_FETCH_FAILED" });
    }
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || inferExampleAssetMime(name),
    );
    res.setHeader("Cache-Control", "private, max-age=300");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.end(buffer);
  } catch {
    return res
      .status(502)
      .json({ ok: false, code: "EXAMPLE_ASSET_FETCH_FAILED" });
  }
});

app.get("/api/work-assets/blob", async (req, res) => {
  noStore(res);
  try {
    const assetKey = sanitizeWorkAssetKey(String(req.query?.asset_key || ""));
    if (!assetKey) {
      return res
        .status(400)
        .json({ ok: false, code: "WORK_ASSET_KEY_REQUIRED" });
    }
    const upstream = await fetchBucketObject(assetKey);
    if (!upstream.ok) {
      return res
        .status(upstream.status || 502)
        .json({ ok: false, code: "WORK_ASSET_FETCH_FAILED" });
    }
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") ||
        inferExampleAssetMime(path.basename(assetKey)),
    );
    res.setHeader("Cache-Control", "private, max-age=300");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.end(buffer);
  } catch {
    return res.status(502).json({ ok: false, code: "WORK_ASSET_FETCH_FAILED" });
  }
});

app.get("/api/shared-assets/manifest", async (req, res) => {
  noStore(res);
  try {
    const prefix = sanitizeSharedAssetRelativePath(
      String(req.query?.prefix || ""),
    );
    const root = sharedAssetsRootDir();
    const targetDir = prefix ? path.resolve(root, prefix) : root;
    if (targetDir !== root && !targetDir.startsWith(`${root}${path.sep}`)) {
      return res
        .status(400)
        .json({ ok: false, code: "SHARED_ASSET_PREFIX_INVALID" });
    }
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      return res
        .status(404)
        .json({ ok: false, code: "SHARED_ASSET_PREFIX_NOT_FOUND" });
    }
    const entries = fs
      .readdirSync(targetDir, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => {
        const relPath = prefix
          ? path.posix.join(prefix, entry.name)
          : entry.name;
        const absolutePath = path.join(targetDir, entry.name);
        const isDir = entry.isDirectory();
        return {
          name: entry.name,
          path: relPath,
          kind: isDir ? "directory" : "file",
          size: isDir ? 0 : fs.statSync(absolutePath).size,
          mime: isDir ? "inode/directory" : inferSharedAssetMime(entry.name),
          url: isDir
            ? null
            : `/api/shared-assets/blob?path=${encodeURIComponent(relPath)}`,
        };
      })
      .sort((left, right) => left.path.localeCompare(right.path));
    return res.json(
      okData({
        root: "/srv/cssos/shared/assets",
        prefix,
        items: entries,
      }),
    );
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "SHARED_ASSET_MANIFEST_FAILED" });
  }
});

app.get("/api/shared-assets/blob", async (req, res) => {
  noStore(res);
  try {
    const resolved = resolveSharedAssetPath(String(req.query?.path || ""));
    if (!resolved) {
      return res
        .status(400)
        .json({ ok: false, code: "SHARED_ASSET_PATH_REQUIRED" });
    }
    if (
      !fs.existsSync(resolved.resolved) ||
      !fs.statSync(resolved.resolved).isFile()
    ) {
      return res
        .status(404)
        .json({ ok: false, code: "SHARED_ASSET_NOT_FOUND" });
    }
    res.setHeader("Content-Type", inferSharedAssetMime(resolved.rel));
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.sendFile(resolved.resolved);
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "SHARED_ASSET_FETCH_FAILED" });
  }
});

app.post("/api/music-artifacts/ticket", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    const access = await resolveUserAccessProfile(user);
    const runId = String(req.body?.run_id || "").trim();
    let artifactPath = String(req.body?.path || "").trim();
    let assetKey = String(req.body?.asset_key || "").trim();
    const fileName = String(req.body?.file_name || "").trim();
    if (!runId || (!artifactPath && !assetKey)) {
      return res
        .status(400)
        .json({ ok: false, code: "ARTIFACT_TARGET_REQUIRED" });
    }
    const isLossless =
      /\.wav$/i.test(artifactPath) ||
      /\.flac$/i.test(artifactPath) ||
      /\.wav$/i.test(assetKey) ||
      /\.flac$/i.test(assetKey);
    let downgraded = false;
    if (isLossless && !isProPlusTier(access.tier)) {
      const downgradedTarget = downgradeLosslessArtifactTarget(
        artifactPath,
        assetKey,
      );
      artifactPath = downgradedTarget.path;
      assetKey = downgradedTarget.asset_key;
      downgraded = true;
      if (!artifactPath && !assetKey) {
        return res
          .status(403)
          .json({ ok: false, code: "LOSSLESS_PRO_REQUIRED" });
      }
    }
    const base = appBaseUrl(req);
    const rustRes = await fetch(
      `${base}/cssapi/v1/runs/${encodeURIComponent(runId)}/music-delivery-artifact-download-ticket`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          cookie: String(req.headers.cookie || ""),
        },
        body: JSON.stringify({
          path: artifactPath || undefined,
          asset_key: assetKey || undefined,
          file_name: fileName || undefined,
        }),
      },
    );
    const payload = await rustRes.json().catch(() => null);
    if (!rustRes.ok || !payload) {
      return res
        .status(rustRes.status || 502)
        .json(payload || { ok: false, code: "ARTIFACT_TICKET_FAILED" });
    }
    const data = (payload as any)?.data || payload;
    return res.json(
      okData({
        ...(data && typeof data === "object" ? data : {}),
        downgraded_from_lossless: downgraded,
        enforced_tier: access.tier,
      }),
    );
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "ARTIFACT_TICKET_PROXY_FAILED" });
  }
});

app.patch("/api/panel-defaults/:panelKey", async (req, res) => {
  noStore(res);
  try {
    const panelKey = normalizePanelDefaultsKey(req.params.panelKey);
    if (!panelKey) {
      return res.status(404).json({ ok: false, code: "UNKNOWN_PANEL_KEY" });
    }
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    if (roleForEmail(user.email) !== "admin") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN" });
    }
    const defaults =
      panelKey === "creation"
        ? mergeCreationPanelTemplate(req.body?.defaults || req.body || {})
        : panelKey === "behavior"
          ? sanitizeBehaviorPanelTemplate(req.body?.defaults || req.body || {})
          : sanitizeGenericPanelTemplate(req.body?.defaults || req.body || {});
    if (DATABASE_URL) {
      await withClient((client) =>
        client.query(
          `INSERT INTO panel_default_templates (panel_key, value, updated_by_user_id)
           VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (panel_key)
           DO UPDATE SET value = EXCLUDED.value, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
          [panelKey, JSON.stringify(defaults), user.id],
        ),
      );
    }
    if (panelKey === "behavior") {
      behaviorTemplateCache.value = defaults;
      behaviorTemplateCache.expiresAt = Date.now() + 30_000;
    }
    return res.json(okData({ defaults, saved: true }));
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "PANEL_DEFAULTS_SAVE_FAILED" });
  }
});

app.post("/api/profile/unlink", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const provider = String(req.body?.provider || "").toLowerCase();
    if (!provider) {
      return res.status(400).json({ ok: false, code: "MISSING_PROVIDER" });
    }

    const linked = await listLinkedProviders(user.id);
    const currentlyLinked = new Set(linked.providers);
    if (!currentlyLinked.has(provider)) {
      return res.status(404).json({ ok: false, code: "PROVIDER_NOT_LINKED" });
    }
    if (currentlyLinked.size <= 1) {
      return res
        .status(400)
        .json({ ok: false, code: "CANNOT_UNLINK_LAST_METHOD" });
    }

    if (provider === "passkey") {
      const sk = userSubjectKey(user.id);
      if (DATABASE_URL) {
        await withClient((client) =>
          client.query(
            "DELETE FROM passkey_credentials WHERE subject_key = $1",
            [sk],
          ),
        );
      } else {
        passkeyCreds.delete(sk);
      }
      return res.json(okData({ unlinked: "passkey" }));
    }

    if (DATABASE_URL) {
      await withClient((client) =>
        client.query(
          "DELETE FROM oauth_identities WHERE user_id = $1 AND provider = $2",
          [user.id, provider],
        ),
      );
    }
    return res.json(okData({ unlinked: provider }));
  } catch {
    return res.status(500).json({ ok: false, code: "UNLINK_FAILED" });
  }
});

type WorkTreeRow = {
  id: string;
  title: string;
  style: string | null;
  work_type: string | null;
  lyrics_preview: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  parent_work_id: string | null;
  root_work_id: string | null;
  structure_role: string | null;
  sequence_index: number | null;
  structure_plan: Record<string, unknown> | null;
  visibility?: string | null;
  owner_user_id?: string;
  owner_name?: string | null;
  owner_email?: string | null;
  current_listen_price_cents?: number | null;
  current_buyout_price_cents?: number | null;
  buyout_enabled?: boolean | null;
  tips_enabled?: boolean | null;
  rights_scope?: string | null;
  source_run_id?: string | null;
  cover_image?: string | null;
  preview_image_url?: string | null;
  preview_video_url?: string | null;
  preview_video_asset_key?: string | null;
  /* CSSOS_PHASE2_MARKET_DURATION 20260504 — surfaced from
     work_assets.meta->>'duration_secs' so foryou cards can stamp the
     mm:ss chip. Optional — older rows / drafts may lack this. */
  duration_secs?: number | null;
};

function workStructureRoleLabel(role: unknown, fallbackType: unknown) {
  const raw = String(role || "")
    .trim()
    .toLowerCase();
  if (raw === "opera") return "opera";
  if (raw === "act") return "act";
  if (raw === "scene") return "scene";
  if (raw === "triptych") return "triptych";
  return normalizeWorkType(fallbackType);
}

function normalizeWorkTreeRow<T extends WorkTreeRow>(row: T) {
  const previewVideoReference = resolveStoredPreviewVideoReference(
    row.source_run_id || "",
    row.preview_video_url,
  );
  // CSSOS_PHASE2_NO_JUDGE_AS_PLAYER 20260501 #266 — Jing
  // Defense-in-depth: even if a stale row in work_market_profiles
  // somehow has non-zero prices for an admin owner, override at
  // read time. owner_is_admin is exposed to the client so the UI
  // can render "Free" / "无价之宝 (Priceless)" with confidence.
  // owner_email itself is stripped from the response — only the
  // boolean flag goes out, no PII for non-admin viewers.
  const ownerIsAdmin = isCssosAdminEmail(row.owner_email);
  const listenCents = ownerIsAdmin
    ? 0
    : Number(row.current_listen_price_cents || defaultListenPriceCents());
  const buyoutCents = ownerIsAdmin
    ? 0
    : Number(row.current_buyout_price_cents || defaultBuyoutPriceCents());
  const buyoutEnabled = ownerIsAdmin ? false : row.buyout_enabled !== false;
  const { owner_email: _ownerEmail, ...rest } = row as T & {
    owner_email?: string | null;
  };
  return {
    ...rest,
    work_type: normalizeWorkType(row.work_type),
    visibility: row.visibility || "public",
    rights_scope: ownerIsAdmin ? "system_priceless" : row.rights_scope || "personal_use",
    current_listen_price_cents: listenCents,
    current_buyout_price_cents: buyoutCents,
    buyout_enabled: buyoutEnabled,
    owner_is_admin: ownerIsAdmin,
    is_priceless: ownerIsAdmin,
    structure_role: workStructureRoleLabel(row.structure_role, row.work_type),
    sequence_index: Number(row.sequence_index || 0),
    cover_image: String(row.cover_image || "").trim() || null,
    preview_image_url: String(row.preview_image_url || "").trim() || null,
    preview_video_url: previewVideoReference.previewVideoUrl,
    preview_video_asset_key: previewVideoReference.previewVideoAssetKey,
    structure_plan:
      row.structure_plan && typeof row.structure_plan === "object"
        ? row.structure_plan
        : null,
  };
}

function parseStructuredWorkTitle(title: string) {
  const raw = String(title || "").trim();
  const parts = raw
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const rootTitle = parts[0] || raw;
  const actMatch = raw.match(/第\s*([0-9一二三四五六七八九十两]+)\s*幕/i);
  const sceneMatch = raw.match(/scene\s*([0-9]+)/i);
  const partMatch = raw.match(/(?:part|单曲)\s*([0-9]+)/i);
  return {
    rootTitle,
    hasAct: Boolean(actMatch),
    hasScene: Boolean(sceneMatch),
    hasPart: Boolean(partMatch),
  };
}

function reconcileLegacyStructuredRoots(nodes: any[]) {
  const roots = [...nodes];
  const grouped = new Map<string, any[]>();
  roots.forEach((node) => {
    const parsed = parseStructuredWorkTitle(String(node?.title || ""));
    const role = String(node?.structure_role || "")
      .trim()
      .toLowerCase();
    const workType = String(node?.work_type || "")
      .trim()
      .toLowerCase();
    const family =
      role === "opera" || parsed.hasAct || parsed.hasScene
        ? "opera"
        : role === "triptych" || parsed.hasPart
          ? "triptych"
          : "";
    if (!family) return;
    const key = `${family}::${parsed.rootTitle}`;
    grouped.set(key, [...(grouped.get(key) || []), node]);
  });
  const consumed = new Set<string>();
  const rebuilt: any[] = [];

  grouped.forEach((items, key) => {
    const [family, rootTitle] = key.split("::");
    const explicitRoot = items.find((item) => {
      const role = String(item?.structure_role || "")
        .trim()
        .toLowerCase();
      return role === family && String(item?.title || "").trim() === rootTitle;
    });
    const root = explicitRoot
      ? explicitRoot
      : {
          ...items[0],
          title: rootTitle,
          work_type: family,
          structure_role: family,
          children: [],
        };
    const acts = new Map<string, any>();
    const parts = new Map<string, any>();
    const seededChildren = Array.isArray(root?.children) ? root.children : [];

    if (family === "opera") {
      seededChildren.forEach((child: any) => {
        if (
          String(child?.structure_role || "")
            .trim()
            .toLowerCase() !== "act"
        )
          return;
        acts.set(String(child?.title || "").trim(), {
          ...child,
          structure_role: "act",
          work_type: "opera",
          children: Array.isArray(child?.children) ? child.children : [],
        });
      });
    }
    if (family === "triptych") {
      seededChildren.forEach((child: any) => {
        const role = String(child?.structure_role || "")
          .trim()
          .toLowerCase();
        if (!["part", "single"].includes(role)) return;
        parts.set(String(child?.title || "").trim(), {
          ...child,
          structure_role: "part",
          work_type: "single",
          children: Array.isArray(child?.children) ? child.children : [],
        });
      });
    }

    items.forEach((item) => {
      consumed.add(String(item?.id || ""));
      if (item === explicitRoot) return;
      const title = String(item?.title || "").trim();
      const role = String(item?.structure_role || "")
        .trim()
        .toLowerCase();
      const parsed = parseStructuredWorkTitle(title);
      if (family === "opera") {
        if (role === "act" || (parsed.hasAct && !parsed.hasScene)) {
          acts.set(title, {
            ...item,
            structure_role: "act",
            work_type: "opera",
            children: Array.isArray(item?.children) ? item.children : [],
          });
          return;
        }
        if (role === "scene" || parsed.hasScene) {
          const actKey = title.includes("·")
            ? title
                .split("·")
                .slice(0, 2)
                .map((part) => part.trim())
                .join(" · ")
            : `${rootTitle} · 第1幕`;
          const actNode = acts.get(actKey) || {
            ...item,
            id: `${String(item?.id || title)}__act`,
            title: actKey,
            work_type: "opera",
            structure_role: "act",
            children: [],
          };
          actNode.children = [
            ...(Array.isArray(actNode.children) ? actNode.children : []),
            {
              ...item,
              structure_role: "scene",
              work_type: "single",
              children: [],
            },
          ];
          acts.set(actKey, actNode);
          return;
        }
      }
      if (family === "triptych") {
        if (role === "part" || role === "single" || parsed.hasPart) {
          parts.set(title, {
            ...item,
            structure_role: "part",
            work_type: "single",
            children: Array.isArray(item?.children) ? item.children : [],
          });
          return;
        }
      }
    });

    root.children =
      family === "opera"
        ? [...acts.values()].sort(
            (a, b) =>
              Number(a.sequence_index || 0) - Number(b.sequence_index || 0),
          )
        : [...parts.values()].sort(
            (a, b) =>
              Number(a.sequence_index || 0) - Number(b.sequence_index || 0),
          );
    rebuilt.push(root);
  });

  roots.forEach((node) => {
    if (consumed.has(String(node?.id || ""))) return;
    rebuilt.push(node);
  });

  return rebuilt;
}

function buildWorkTree<T extends WorkTreeRow>(rows: T[]) {
  const normalized = rows.map((row) => normalizeWorkTreeRow(row));
  const map = new Map<string, any>();
  normalized.forEach((row) => {
    map.set(String(row.id), { ...row, children: [] as any[] });
  });
  const roots: any[] = [];
  normalized.forEach((row) => {
    const node = map.get(String(row.id));
    const parentId = String(row.parent_work_id || "").trim();
    if (parentId && map.has(parentId)) {
      map.get(parentId).children.push(node);
      return;
    }
    roots.push(node);
  });
  const sorter = (items: any[]) => {
    items.sort((a, b) => {
      const sequenceDelta =
        Number(a.sequence_index || 0) - Number(b.sequence_index || 0);
      if (sequenceDelta !== 0) return sequenceDelta;
      return String(b.created_at || "").localeCompare(
        String(a.created_at || ""),
      );
    });
    items.forEach((item) =>
      sorter(Array.isArray(item.children) ? item.children : []),
    );
  };
  const reconciled = reconcileLegacyStructuredRoots(roots);
  const hydrateStructuredChildren = (node: any) => {
    const nodeId = String(node?.id || "").trim();
    if (!nodeId) return;
    const directChildren = normalized
      .filter((row) => String(row.parent_work_id || "").trim() === nodeId)
      .map((row) => map.get(String(row.id)))
      .filter(Boolean);
    if (!Array.isArray(node.children) || !node.children.length) {
      node.children = directChildren;
    }
    (Array.isArray(node.children) ? node.children : []).forEach((child: any) =>
      hydrateStructuredChildren(child),
    );
  };
  reconciled.forEach((node) => {
    const role = String(node?.structure_role || "")
      .trim()
      .toLowerCase();
    const workType = String(node?.work_type || "")
      .trim()
      .toLowerCase();
    if (
      ["opera", "triptych", "act", "part"].includes(role) ||
      ["opera", "triptych"].includes(workType)
    ) {
      hydrateStructuredChildren(node);
    }
  });
  sorter(reconciled);
  return reconciled;
}

function structuredTreeNodeNeedsChildren(node: any): boolean {
  const role = String(node?.structure_role || "")
    .trim()
    .toLowerCase();
  const workType = String(node?.work_type || "")
    .trim()
    .toLowerCase();
  return (
    ["opera", "triptych", "act", "part"].includes(role) ||
    ["opera", "triptych"].includes(workType)
  );
}

function structuredTreeHasMissingChildren(tree: any[]): boolean {
  return (Array.isArray(tree) ? tree : []).some((node) => {
    if (!structuredTreeNodeNeedsChildren(node)) return false;
    const children = Array.isArray(node?.children) ? node.children : [];
    if (!children.length) return true;
    return structuredTreeHasMissingChildren(children);
  });
}

async function loadMineWorkDescendants(rootIds: string[]) {
  if (!rootIds.length) return [];
  type Row = WorkTreeRow;
  const placeholders = rootIds.map((_, index) => `$${index + 1}`).join(", ");
  const childRes = await withClient((client) =>
    client.query<Row>(
      // CSSOS_PHASE2_PERSIST_PLAYABLE 20260430 #214 — Jing
      // Mirror the same JOIN columns the parent query exposes so children
      // are independently playable too (each child of an opera/triptych is
      // its own MV with its own audio + final mp4).
      `SELECT w.id, w.title, w.style, w.work_type, w.lyrics_preview, w.status, w.created_at, w.updated_at,
              w.parent_work_id, w.root_work_id, w.structure_role, w.sequence_index, w.structure_plan,
              w.source_run_id, w.compute_units_estimate, w.compute_cost_cents_estimate, w.suggested_listen_price_cents, w.suggested_buyout_price_cents,
              w.cover_image, w.preview_image_url, w.preview_video_url,
              mp.visibility,
              COALESCE(listen_product.amount_cents, mp.current_listen_price_cents) AS current_listen_price_cents,
              COALESCE(buyout_product.amount_cents, mp.current_buyout_price_cents) AS current_buyout_price_cents,
              COALESCE(mp.buyout_enabled, buyout_product.active, false) AS buyout_enabled,
              mp.tips_enabled,
              mp.rights_scope,
              final_mv_asset.url AS final_mv_url,
              final_mv_asset.meta AS final_mv_meta,
              audio_track_1_asset.url AS audio_track_1_url,
              audio_track_2_asset.url AS audio_track_2_url,
              subtitle_asset.url AS subtitle_srt_url
       FROM user_works w
       LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
       LEFT JOIN work_access_products listen_product
         ON listen_product.work_id = w.id
        AND listen_product.product_kind = 'listen'
        AND listen_product.active = true
       LEFT JOIN work_access_products buyout_product
         ON buyout_product.work_id = w.id
        AND buyout_product.product_kind = 'buyout'
        AND buyout_product.active = true
       LEFT JOIN work_assets final_mv_asset
         ON final_mv_asset.work_id = w.id AND final_mv_asset.asset_type = 'final_mv'
       LEFT JOIN work_assets audio_track_1_asset
         ON audio_track_1_asset.work_id = w.id AND audio_track_1_asset.asset_type = 'audio_track_1'
       LEFT JOIN work_assets audio_track_2_asset
         ON audio_track_2_asset.work_id = w.id AND audio_track_2_asset.asset_type = 'audio_track_2'
       LEFT JOIN work_assets subtitle_asset
         ON subtitle_asset.work_id = w.id AND subtitle_asset.asset_type = 'subtitle_srt'
       WHERE w.root_work_id IN (${placeholders})
         AND w.parent_work_id IS NOT NULL
       ORDER BY w.sequence_index ASC, w.created_at ASC`,
      rootIds,
    ),
  );
  return childRes.rows;
}

async function loadMarketWorkDescendants(rootIds: string[]) {
  if (!rootIds.length) return [];
  type Row = WorkTreeRow;
  const placeholders = rootIds.map((_, index) => `$${index + 1}`).join(", ");
  const childRes = await withClient((client) =>
    client.query<Row>(
      `SELECT
         w.id,
         w.user_id AS owner_user_id,
         w.title,
         w.style,
         w.work_type,
         w.lyrics_preview,
         w.status,
         w.created_at,
         w.updated_at,
         w.parent_work_id,
         w.root_work_id,
         w.structure_role,
         w.sequence_index,
         w.structure_plan,
         w.source_run_id,
         w.compute_units_estimate,
         w.compute_cost_cents_estimate,
         w.suggested_listen_price_cents,
         w.suggested_buyout_price_cents,
         w.cover_image,
         w.preview_image_url,
         w.preview_video_url,
         u.display_name AS owner_name,
         u.email AS owner_email,
         u.avatar_url AS owner_avatar_url,
         COALESCE(listen_product.amount_cents, mp.current_listen_price_cents) AS current_listen_price_cents,
         COALESCE(buyout_product.amount_cents, mp.current_buyout_price_cents) AS current_buyout_price_cents,
         COALESCE(mp.buyout_enabled, buyout_product.active, false) AS buyout_enabled,
         mp.tips_enabled,
         mp.visibility,
         mp.rights_scope
       FROM user_works w
       JOIN users u ON u.id = w.user_id
       LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
       LEFT JOIN work_access_products listen_product
         ON listen_product.work_id = w.id
        AND listen_product.product_kind = 'listen'
        AND listen_product.active = true
       LEFT JOIN work_access_products buyout_product
         ON buyout_product.work_id = w.id
        AND buyout_product.product_kind = 'buyout'
        AND buyout_product.active = true
       WHERE w.root_work_id IN (${placeholders})
         AND w.parent_work_id IS NOT NULL
       ORDER BY w.sequence_index ASC, w.created_at ASC`,
      rootIds,
    ),
  );
  return childRes.rows;
}

async function loadMarketWorkDescendantsForRoot(rootId: string) {
  const normalized = String(rootId || "").trim();
  if (!normalized) return [];
  type Row = WorkTreeRow;
  const childRes = await withClient((client) =>
    client.query<Row>(
      `SELECT
         w.id,
         w.user_id AS owner_user_id,
         w.title,
         w.style,
         w.work_type,
         w.lyrics_preview,
         w.status,
         w.created_at,
         w.updated_at,
         w.parent_work_id,
         w.root_work_id,
         w.structure_role,
         w.sequence_index,
         w.structure_plan,
         w.source_run_id,
         w.compute_units_estimate,
         w.compute_cost_cents_estimate,
         w.suggested_listen_price_cents,
         w.suggested_buyout_price_cents,
         w.cover_image,
         w.preview_image_url,
         w.preview_video_url,
         u.display_name AS owner_name,
         u.email AS owner_email,
         u.avatar_url AS owner_avatar_url,
         COALESCE(listen_product.amount_cents, mp.current_listen_price_cents) AS current_listen_price_cents,
         COALESCE(buyout_product.amount_cents, mp.current_buyout_price_cents) AS current_buyout_price_cents,
         COALESCE(mp.buyout_enabled, buyout_product.active, false) AS buyout_enabled,
         mp.tips_enabled,
         mp.visibility,
         mp.rights_scope
       FROM user_works w
       JOIN users u ON u.id = w.user_id
       LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
       LEFT JOIN work_access_products listen_product
         ON listen_product.work_id = w.id
        AND listen_product.product_kind = 'listen'
        AND listen_product.active = true
       LEFT JOIN work_access_products buyout_product
         ON buyout_product.work_id = w.id
        AND buyout_product.product_kind = 'buyout'
        AND buyout_product.active = true
       WHERE w.root_work_id = $1
         AND w.parent_work_id IS NOT NULL
       ORDER BY w.sequence_index ASC, w.created_at ASC`,
      [normalized],
    ),
  );
  return childRes.rows;
}

async function fillMarketStructuredChildren(tree: any[], roots: WorkTreeRow[]) {
  if (!Array.isArray(tree) || !tree.length) return tree;
  const rootLookup = new Map<string, WorkTreeRow>();
  roots.forEach((row) => rootLookup.set(String(row.id), row));
  for (const node of tree) {
    if (!structuredTreeNodeNeedsChildren(node)) continue;
    if (Array.isArray(node?.children) && node.children.length) continue;
    const rootRow = rootLookup.get(String(node?.id || "").trim());
    if (!rootRow) continue;
    const descendantRows = await loadMarketWorkDescendantsForRoot(String(rootRow.id || ""));
    if (!descendantRows.length) continue;
    const rebuilt = buildWorkTree([rootRow, ...descendantRows]);
    const rebuiltRoot = rebuilt.find(
      (item) => String(item?.id || "").trim() === String(rootRow.id || "").trim(),
    );
    if (rebuiltRoot && Array.isArray(rebuiltRoot.children) && rebuiltRoot.children.length) {
      node.children = rebuiltRoot.children;
    }
  }
  return tree;
}

function buildOwnerChain(
  rows: Array<{ to_user_id: string | null; to_label: string | null }>,
  fallbackLabel: string,
) {
  const chain: Array<{ label: string }> = [];
  const pushLabel = (value: string | null | undefined) => {
    const label = String(value || "").trim();
    if (!label) return;
    if (chain.length && chain[chain.length - 1]?.label === label) return;
    chain.push({ label });
  };
  pushLabel(fallbackLabel);
  rows.forEach((row) => pushLabel(row.to_label));
  return chain;
}

app.get("/api/works/mine", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    // CSSOS_PHASE2_FULL_LIBRARY_LIMIT 20260504 — Jing: raise the cap so
    // Works Center / For You / playback queue can pull the full library
    // and page client-side instead of artificially looping at 100.
    const limit = Math.max(1, Math.min(Number(req.query.limit || 20), 1000));
    type Row = WorkTreeRow;
    // CSSOS_PHASE2_PERSIST_PLAYABLE 20260430 #214 — Jing
    // "用户从为你创作/作品中心或者其他面板想再去欣赏这些刚刚输出完毕的作品，
    //  都变成了无法欣赏，必须从头重新输出." Pull final_mv_url + audio
    // tracks + duration + lyrics_full from work_assets so the click-to-play
    // hydration in openMarketWorkPreview() reads playable URLs and skips
    // the re-run path. Aggregated as JSON arrays / scalar lookups; the
    // frontend reads work.final_mv_url || work.preview_video_url directly.
    const q: QueryResult<Row> = await withClient((client) =>
      client.query<Row>(
        `SELECT w.id, w.title, w.style, w.work_type, w.lyrics_preview, w.status, w.created_at, w.updated_at,
                w.parent_work_id, w.root_work_id, w.structure_role, w.sequence_index, w.structure_plan,
                w.source_run_id, w.compute_units_estimate, w.compute_cost_cents_estimate, w.suggested_listen_price_cents, w.suggested_buyout_price_cents,
                w.cover_image, w.preview_image_url, w.preview_video_url,
                mp.visibility,
                COALESCE(listen_product.amount_cents, mp.current_listen_price_cents) AS current_listen_price_cents,
                COALESCE(buyout_product.amount_cents, mp.current_buyout_price_cents) AS current_buyout_price_cents,
                COALESCE(mp.buyout_enabled, buyout_product.active, false) AS buyout_enabled,
                mp.tips_enabled,
                mp.rights_scope,
                final_mv_asset.url AS final_mv_url,
                final_mv_asset.meta AS final_mv_meta,
                audio_track_1_asset.url AS audio_track_1_url,
                audio_track_2_asset.url AS audio_track_2_url,
                subtitle_asset.url AS subtitle_srt_url
         FROM user_works w
         LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
         LEFT JOIN work_access_products listen_product
           ON listen_product.work_id = w.id
          AND listen_product.product_kind = 'listen'
          AND listen_product.active = true
         LEFT JOIN work_access_products buyout_product
           ON buyout_product.work_id = w.id
          AND buyout_product.product_kind = 'buyout'
          AND buyout_product.active = true
         LEFT JOIN work_assets final_mv_asset
           ON final_mv_asset.work_id = w.id AND final_mv_asset.asset_type = 'final_mv'
         LEFT JOIN work_assets audio_track_1_asset
           ON audio_track_1_asset.work_id = w.id AND audio_track_1_asset.asset_type = 'audio_track_1'
         LEFT JOIN work_assets audio_track_2_asset
           ON audio_track_2_asset.work_id = w.id AND audio_track_2_asset.asset_type = 'audio_track_2'
         LEFT JOIN work_assets subtitle_asset
           ON subtitle_asset.work_id = w.id AND subtitle_asset.asset_type = 'subtitle_srt'
         WHERE user_id = $1
           AND w.parent_work_id IS NULL
         ORDER BY w.created_at DESC
         LIMIT $2`,
        [user.id, limit],
      ),
    );
    const rootIds = q.rows.map((row) => row.id);
    let childRows: Row[] = rootIds.length ? await loadMineWorkDescendants(rootIds) : [];
    let tree = buildWorkTree([...q.rows, ...childRows]);
    if (rootIds.length && structuredTreeHasMissingChildren(tree)) {
      childRows = await loadMineWorkDescendants(rootIds);
      tree = buildWorkTree([...q.rows, ...childRows]);
    }
    // CSSOS_PHASE2_PERSIST_PLAYABLE 20260430 #214 — surface duration_secs
    // + lyrics_full from final_mv_asset.meta JSON so the work card can
    // render the duration overlay and the Watch panel rehydration has
    // the full lyric body without a second round-trip.
    const flattenMeta = (work: any) => {
      try {
        const meta = work?.final_mv_meta;
        if (meta && typeof meta === "object") {
          if (work.duration_secs == null && meta.duration_secs != null) {
            work.duration_secs = Number(meta.duration_secs) || null;
          }
          if (!work.lyrics_full && meta.lyrics_full) {
            work.lyrics_full = String(meta.lyrics_full);
          }
          if (!work.aligned_lyrics && meta.aligned_lyrics) {
            work.aligned_lyrics = meta.aligned_lyrics;
          }
          // CSSOS_PHASE2_DUAL_TRACK 20260430 #221b — Jing
          // "用户欣赏第一首,右上角的胶囊要出现,也就是说,欣赏一首,
          //  另一首必须是下一首。如果是打开第二首,右上角胶囊也要显示
          //  第一首,也是要欣赏完两首,才会继续别的用户的作品."
          // Surface sibling_work_id (the OTHER take's work_id) and
          // take_index (1 or 2) so when the Watch panel opens either
          // card it can: (a) show a Take 1↔Take 2 toggle pill, and
          // (b) gate queue-advance until BOTH siblings have played.
          if (meta.sibling_work_id) {
            work.sibling_work_id = String(meta.sibling_work_id);
          }
          if (meta.take_index != null) {
            work.take_index = Number(meta.take_index) || null;
          }
        }
      } catch { /* meta parse best-effort */ }
      if (Array.isArray(work?.children)) work.children.forEach(flattenMeta);
      return work;
    };
    tree.forEach(flattenMeta);
    return res.json(
      okData({
        works: tree,
      }),
    );
  } catch {
    return res.status(500).json({ ok: false, code: "WORKS_LIST_FAILED" });
  }
});

// CSSOS_PHASE2_WATCH_QUEUE 20260430 #208b — Jing
// "Watch MV 面板先连播自己最新 2 首再播别人的." Returns a flat,
// playback-ready cursor-paginated list of MVs:
//   1. The viewer's own playable works first (newest by created_at)
//   2. Then other users' market-visible works (random-ish for discovery)
// Each row includes the URLs the Watch panel needs to swap into <video>:
//   final_mv_url, audio_track_1_url, audio_track_2_url, title, cover.
// Cursor format: "<scope>:<created_at_iso>:<id>" — opaque to the client.
app.get("/cssapi/v1/mv", async (req, res) => {
  noStore(res);
  try {
    const viewer = await getSessionUser(req).catch(() => null);
    const limit = Math.max(1, Math.min(Number(req.query.limit || 8), 30));
    const cursorRaw = String(req.query.cursor || "").trim();
    let scope: "self" | "others" = "self";
    let cursorTime: string | null = null;
    let cursorId: string | null = null;
    if (cursorRaw) {
      const parts = cursorRaw.split(":");
      if (parts[0] === "self" || parts[0] === "others") {
        scope = parts[0] as "self" | "others";
        cursorTime = parts[1] || null;
        cursorId = parts.slice(2).join(":") || null;
      }
    }
    if (!viewer && scope === "self") scope = "others";
    type Row = {
      id: string;
      title: string | null;
      cover_image: string | null;
      preview_image_url: string | null;
      preview_video_url: string | null;
      created_at: string;
      duration_secs: number | null;
      lyrics_preview: string | null;
      final_mv_url: string | null;
      audio_track_1_url: string | null;
      audio_track_2_url: string | null;
      subtitle_srt_url: string | null;
      sibling_work_id: string | null;
      take_index: number | null;
      owner_id: string;
    };
    const out: Row[] = [];
    let nextCursor: string | null = null;

    if (scope === "self" && viewer) {
      // CSSOS_PHASE2_SELF_FIRST_STRUCTURAL 20260430 #227 — Jing
      // "先循环自己的两首,再播放别人的。三部曲呢?类似,先循环自己的三部曲
      //  (共6首)再播放别人的。同理,歌剧,先循环自己的整部歌剧所有幕的
      //  所有场,再播放别人的。绝对不能播放自己的作品到一半,又去播放别人的."
      //
      // The queue must finish ALL of viewer's playable structured trees
      // before any other user's work plays. We do this by:
      //   1. Selecting EVERY playable leaf the viewer owns (whether the
      //      leaf is a top-level standalone song or a structural child
      //      buried under an opera/triptych root). Top-level Take 2
      //      sibling rows are filtered out — Take 1's row already carries
      //      both audio_track_1 and audio_track_2, so the take-toggle can
      //      play them back-to-back without surfacing a second queue row.
      //   2. Joining each leaf to its top-level ancestor (root_work_id ↦
      //      itself when the leaf IS top-level) and ordering by
      //      (root.created_at DESC, sequence_index ASC, leaf.created_at)
      //      so all of root R's leaves play consecutively before R+1.
      //   3. Cursor is keyed off the root, so a triptych (3 leaves) or an
      //      opera (many leaves) never gets split across pages — the
      //      cursor advances at root boundaries only.
      //
      // For pagination: we fetch ALL leaves of up to `limit` distinct
      // roots per page so we never tear a structured root in half. The
      // cursor we emit points at the (root.created_at, root.id) of the
      // LAST root included in this page — the next page picks up at the
      // root strictly older than that.
      const params: any[] = [viewer.id, limit];
      let cursorClause = "";
      if (cursorTime && cursorId) {
        params.push(cursorTime, cursorId);
        cursorClause = `AND (root.created_at, root.id) < ($3::timestamptz, $4::uuid)`;
      }
      const r = await withClient((client) =>
        client.query<Row & {
          root_id: string;
          root_created_at: string;
          sequence_index: number | null;
        }>(
          `WITH playable AS (
             SELECT w.id, w.title, w.cover_image, w.preview_image_url, w.preview_video_url,
                    w.created_at, w.lyrics_preview, w.user_id AS owner_id,
                    COALESCE(w.root_work_id, w.id) AS root_id,
                    COALESCE(w.sequence_index, 0) AS sequence_index,
                    fm.url AS final_mv_url,
                    fm.meta AS final_mv_meta,
                    a1.url AS audio_track_1_url,
                    a2.url AS audio_track_2_url,
                    ss.url AS subtitle_srt_url,
                    COALESCE((fm.meta->>'duration_secs')::float, NULL) AS duration_secs,
                    fm.meta->>'sibling_work_id' AS sibling_work_id,
                    COALESCE((fm.meta->>'take_index')::int, NULL) AS take_index
               FROM user_works w
               LEFT JOIN work_assets fm ON fm.work_id = w.id AND fm.asset_type = 'final_mv'
               LEFT JOIN work_assets a1 ON a1.work_id = w.id AND a1.asset_type = 'audio_track_1'
               LEFT JOIN work_assets a2 ON a2.work_id = w.id AND a2.asset_type = 'audio_track_2'
               LEFT JOIN work_assets ss ON ss.work_id = w.id AND ss.asset_type = 'subtitle_srt'
              WHERE w.user_id = $1
                AND fm.url IS NOT NULL
                AND COALESCE((fm.meta->>'take_index')::int, 1) <> 2
           ),
           roots AS (
             SELECT DISTINCT pl.root_id AS id,
                    root.created_at,
                    root.id AS rid
               FROM playable pl
               JOIN user_works root ON root.id = pl.root_id
              WHERE 1=1 ${cursorClause}
              ORDER BY root.created_at DESC, root.id DESC
              LIMIT $2
           )
           SELECT pl.*,
                  roots.created_at AS root_created_at,
                  roots.id AS root_id_join
             FROM playable pl
             JOIN roots ON roots.id = pl.root_id
            ORDER BY roots.created_at DESC, roots.id DESC,
                     pl.sequence_index ASC, pl.created_at ASC`,
          params,
        ),
      );
      // Push rows in arrival order — query already orders root-grouped.
      for (const row of r.rows) out.push(row as any);
      // If we got `limit` distinct roots, there may be more — emit cursor
      // at the LAST root we included so the next page begins strictly
      // older. If we got <limit, viewer's library is exhausted; flip to
      // others.
      const distinctRoots = new Set(r.rows.map((row: any) => row.root_id));
      if (distinctRoots.size >= limit) {
        // Find the OLDEST root we included to anchor the cursor.
        let lastRoot: { id: string; created_at: string } | null = null;
        for (const row of r.rows as any[]) {
          if (!lastRoot || new Date(row.root_created_at) < new Date(lastRoot.created_at)) {
            lastRoot = { id: String(row.root_id), created_at: String(row.root_created_at) };
          }
        }
        if (lastRoot) {
          nextCursor = `self:${new Date(lastRoot.created_at).toISOString()}:${lastRoot.id}`;
        } else {
          nextCursor = `others::`;
        }
      } else {
        nextCursor = `others::`;
      }
    }

    if (scope === "others" || (out.length < limit && nextCursor === `others::`)) {
      const params: any[] = [limit + 1, viewer?.id || null];
      let cursorClause = "";
      if (cursorTime && cursorId && scope === "others") {
        params.push(cursorTime, cursorId);
        cursorClause = `AND (w.created_at, w.id) < ($3::timestamptz, $4::uuid)`;
      }
      const r = await withClient((client) =>
        client.query<Row>(
          `SELECT w.id, w.title, w.cover_image, w.preview_image_url, w.preview_video_url,
                  w.created_at, w.lyrics_preview, w.user_id AS owner_id,
                  COALESCE(w.root_work_id, w.id) AS root_id,
                  COALESCE(w.sequence_index, 0) AS sequence_index,
                  fm.url AS final_mv_url,
                  a1.url AS audio_track_1_url,
                  a2.url AS audio_track_2_url,
                  ss.url AS subtitle_srt_url,
                  COALESCE((fm.meta->>'duration_secs')::float, NULL) AS duration_secs,
                  fm.meta->>'sibling_work_id' AS sibling_work_id,
                  COALESCE((fm.meta->>'take_index')::int, NULL) AS take_index
             FROM user_works w
             JOIN work_market_profiles mp ON mp.work_id = w.id
             LEFT JOIN work_assets fm ON fm.work_id = w.id AND fm.asset_type = 'final_mv'
             LEFT JOIN work_assets a1 ON a1.work_id = w.id AND a1.asset_type = 'audio_track_1'
             LEFT JOIN work_assets a2 ON a2.work_id = w.id AND a2.asset_type = 'audio_track_2'
             LEFT JOIN work_assets ss ON ss.work_id = w.id AND ss.asset_type = 'subtitle_srt'
            WHERE w.parent_work_id IS NULL
              AND mp.visibility IN ('public', 'unlisted')
              AND ($2::uuid IS NULL OR w.user_id <> $2::uuid)
              AND COALESCE(NULLIF(TRIM(w.preview_video_url), ''), fm.url) IS NOT NULL
              -- CSSOS_PHASE2_DUAL_TRACK 20260430 #221b — also exclude
              -- others' Take 2 sibling rows so the queue doesn't surface
              -- both takes as separate items. Take 1 carries both audio
              -- URLs and the toggle plays them sequentially.
              AND COALESCE((fm.meta->>'take_index')::int, 1) <> 2
              ${cursorClause}
            ORDER BY w.created_at DESC, w.id DESC
            LIMIT $1`,
          params,
        ),
      );
      const remaining = limit - out.length;
      const rows = r.rows.slice(0, remaining);
      for (const row of rows) out.push(row);
      if (r.rows.length > remaining) {
        const last = rows[rows.length - 1];
        if (last) {
          nextCursor = `others:${new Date(last.created_at).toISOString()}:${last.id}`;
        }
      } else {
        nextCursor = null;
      }
    }

    return res.json({
      ok: true,
      data: {
        items: out.map((rRaw) => {
          // /api/works/mine is owner-only — always sign as "full".
          const r = signMediaUrlsOnRow(rRaw, "full");
          return ({
          id: r.id,
          title: r.title,
          cover_url: r.cover_image || r.preview_image_url || null,
          preview_video_url: r.preview_video_url,
          final_mv_url: r.final_mv_url || r.preview_video_url || null,
          audio_track_1_url: r.audio_track_1_url || null,
          audio_track_2_url: r.audio_track_2_url || null,
          subtitle_srt_url: r.subtitle_srt_url || null,
          duration_secs: r.duration_secs,
          lyrics_preview: r.lyrics_preview,
          // CSSOS_PHASE2_DUAL_TRACK 20260430 #221b — sibling cross-link
          sibling_work_id: r.sibling_work_id || null,
          take_index: r.take_index || null,
          // CSSOS_PHASE2_SELF_FIRST_STRUCTURAL 20260430 #227 — root grouping
          // so the watch queue can keep all leaves of one structured root
          // contiguous and never break self's sequence to play others'.
          root_work_id: (r as any).root_id || null,
          sequence_index: (r as any).sequence_index ?? null,
          is_own: viewer ? (rRaw as { owner_id?: string }).owner_id === viewer.id : false,
        });
        }),
        next_cursor: nextCursor,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, code: "MV_QUEUE_FAILED" });
  }
});

/* CSSOS_PHASE_A_SHARE_LINK 20260506 — Jing
 * Public single-work fetch for share-link entry (`/?cssMV=<id>`).
 *
 * Returns enough metadata for openMarketWorkPreview() to render the work
 * in the MV panel + a tier-aware viewer flag set so the front end can
 * decide whether to:
 *   - play the full final_mv_url (free work OR owner OR purchaser)
 *   - play preview_video_url only and surface a sign-in / subscribe CTA
 *     after the preview loop ends (paid work + guest / non-purchaser)
 *   - enable WAV / MP4 download buttons (Pro+ only — Phase B)
 *
 * Phase A keeps the URL model unchanged (existing public asset URLs).
 * Phase C will switch all media to 24h-signed tickets so direct hot-
 * linking dies.
 *
 * Authentication: optional. Guests get the same shape as logged-in
 * users; only the access flags differ.
 */
/* CSSOS_PHASE3_KARAOKE_BULK 20260507 — Jing
 * Admin-only "transcribe all stale works" sweep. Looks up every work
 * that has audio_track_1 but no whisper_words yet and serially
 * enqueues Whisper through Groq (free tier). Serial, not parallel:
 * one work at a time, ~5s each, so we never hammer Groq's rate limit. */
/* CSSOS_SYSTEM_DEFAULTS_API 20260507 — Jing
 * Admin sets a (kind, provider) → model row and every user gets it
 * unless they've picked their own per-cookie. Reading is open (so the
 * picker can show what the system default is); writing is admin-only. */
app.get("/api/admin/engine/defaults", async (_req, res) => {
  noStore(res);
  try {
    await ensureSystemDefaultsTable();
    const map = await getSystemDefaultsMap();
    return res.json({ ok: true, data: { defaults: map } });
  } catch (err) {
    return res.status(500).json({ ok: false, code: "SYS_DEFAULTS_READ_FAILED", error: String((err as Error)?.message || err) });
  }
});
app.post("/api/admin/engine/default", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    const access = await resolveUserAccessProfile(user);
    if (String(access.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({ ok: false, code: "ADMIN_ONLY" });
    }
    const kind = String(req.body?.kind || "").trim().toLowerCase();
    const provider = String(req.body?.provider || "").trim().toLowerCase();
    const model = String(req.body?.model || "").trim();
    if (!kind || !provider || !model) {
      return res.status(400).json({ ok: false, code: "MISSING_FIELDS" });
    }
    if (!["llm", "image", "music", "video", "tts"].includes(kind)) {
      return res.status(400).json({ ok: false, code: "INVALID_KIND" });
    }
    await ensureSystemDefaultsTable();
    await withClient((c) =>
      c.query(
        `INSERT INTO system_engine_defaults (kind, provider, model, updated_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (kind, provider)
         DO UPDATE SET model = EXCLUDED.model, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [kind, provider, model, user.id],
      ),
    );
    invalidateSystemDefaultsCache();
    return res.json({ ok: true, data: { kind, provider, model } });
  } catch (err) {
    return res.status(500).json({ ok: false, code: "SYS_DEFAULT_WRITE_FAILED", error: String((err as Error)?.message || err) });
  }
});

/* CSSOS_ENGINE_TEST 20260507 — Jing
 * Admin-only "ping" endpoint per engine — proves a key works end-to-end
 * by actually generating a tiny artifact, returning its URL. The MV
 * Pipeline panel can call this to flip "configured → live" status. */
app.post("/api/admin/engine/test", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    const access = await resolveUserAccessProfile(user);
    if (String(access.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({ ok: false, code: "ADMIN_ONLY" });
    }
    const kind = String(req.body?.kind || "").trim().toLowerCase();
    const provider = String(req.body?.provider || "").trim().toLowerCase();
    if (kind === "music") {
      const musicReq: MusicGenRequest = {
        prompt: String(req.body?.prompt || "calm cinematic ambient piano"),
        duration_secs: 15,
        tags: ["cinematic", "ambient", "calm"],
        prefer_model: userPreferredModelMap(req as any, "music"),
      };
      if (provider) musicReq.prefer = [provider];
      const result = await callMusicGen(musicReq);
      return res.json({ ok: result.ok, data: result });
    }
    if (kind === "video") {
      const videoReq: VideoGenRequest = {
        prompt: String(req.body?.prompt || "drifting clouds over mountains, cinematic, slow zoom"),
        duration_secs: 5,
        aspect_ratio: "16:9",
        prefer_model: userPreferredModelMap(req as any, "video"),
      };
      if (provider) videoReq.prefer = [provider];
      const result = await callVideoGen(videoReq);
      return res.json({ ok: result.ok, data: result });
    }
    if (kind === "llm") {
      const llmReq: LlmRequest = {
        messages: [{
          role: "user",
          content: String(req.body?.prompt || "Reply in exactly five words."),
        }],
        max_tokens: 64,
        temperature: 0.4,
      };
      if (provider) llmReq.prefer = [provider];
      const result = await callLlm(llmReq);
      return res.json({
        ok: result.ok,
        data: {
          provider: result.provider,
          model: result.model,
          status: result.status,
          content: result.content?.slice(0, 400) || "",
          error: result.error,
        },
      });
    }
    return res.status(400).json({ ok: false, code: "INVALID_KIND" });
  } catch (err) {
    return res.status(500).json({ ok: false, code: "TEST_FAILED", error: String((err as Error)?.message || err) });
  }
});

/* CSSOS_PERSON_MV_API 20260507 — Wave 1 read endpoints. Public —
 * anyone can browse the roster. Admin endpoint for adding adhoc
 * profiles + creating MVs lands in Wave 2/3. */
app.get("/api/person-mv/persons", async (req, res) => {
  noStore(res);
  try {
    await seedPersonProfilesOnce();
    const civ = String(req.query.civ || "").trim();
    const search = String(req.query.search || "").trim().toLowerCase();
    const tier = Number(req.query.tier || 1);
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limit = Math.max(10, Math.min(200, Number(req.query.limit || 60) || 60));
    const offset = (page - 1) * limit;
    const where: string[] = [];
    const params: unknown[] = [];
    if (civ) { params.push(civ); where.push(`civilization = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(lower(name_zh) LIKE $${params.length} OR lower(name_en) LIKE $${params.length} ` +
        `OR lower(civilization) LIKE $${params.length} OR lower(core_theme) LIKE $${params.length})`,
      );
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    // Tier 1 = influence_score DESC; Tier 2 = civilization, then influence.
    const orderSql = tier === 2
      ? "ORDER BY civilization, influence_score DESC, name_en"
      : "ORDER BY influence_score DESC, name_en";
    params.push(limit); params.push(offset);
    const r = await withClient((c) =>
      c.query<{
        person_id: string; name_zh: string; name_en: string;
        civilization: string; era: string | null; lifespan: string | null;
        roles: string[]; core_theme: string | null; visual_symbols: string[];
        music_style_hint: string | null; tone: string | null;
        influence_score: number; risk_notes: string[];
        source_status: string; mv_count: number;
      }>(
        `SELECT pp.*,
                (SELECT COUNT(*)::int FROM person_mvs pm WHERE pm.person_id = pp.person_id) AS mv_count
           FROM person_profiles pp
           ${whereSql}
           ${orderSql}
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      ),
    );
    return res.json({ ok: true, data: { tier, page, limit, persons: r.rows } });
  } catch (err) {
    console.warn("[person-mv] list failed:", (err as Error)?.message || err);
    return res.status(500).json({ ok: false, code: "PERSON_LIST_FAILED" });
  }
});

app.get("/api/person-mv/persons/:id", async (req, res) => {
  noStore(res);
  try {
    await seedPersonProfilesOnce();
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, code: "INVALID_ID" });
    const r = await withClient((c) =>
      c.query(`SELECT * FROM person_profiles WHERE person_id = $1`, [id]),
    );
    const profile = r.rows[0];
    if (!profile) return res.status(404).json({ ok: false, code: "NOT_FOUND" });
    const mvs = await withClient((c) =>
      c.query(
        `SELECT mv_id, work_id, created_by_user_id, duration_secs, created_at, approval_status, visibility
         FROM person_mvs WHERE person_id = $1
         ORDER BY created_at DESC LIMIT 100`,
        [id],
      ),
    );
    return res.json({ ok: true, data: { profile, mvs: mvs.rows } });
  } catch (err) {
    console.warn("[person-mv] detail failed:", (err as Error)?.message || err);
    return res.status(500).json({ ok: false, code: "PERSON_DETAIL_FAILED" });
  }
});

/* CSSOS_PERSON_MV_CODEX 20260507 — Jing
 * Wave 2.5 — Person Codex page. Returns the full lore + portrait +
 * MV gallery + contemporaries + lineage for a single person. Lore
 * and portrait are generated on first request (best-effort) and
 * cached on the row. ?refresh=1 forces regeneration. */
/* CSSOS_PHASE2_WIKI_FEEDER 20260507 — Wave 2.6 — Jing
 * Fetches Wikipedia summary (zh first, en fallback) for a person profile.
 * Used by the codex endpoint to ground the LLM's lore output in real facts
 * and to source a real portrait image when one exists. Returns
 * `{found:false}` on any error so callers fall through to the
 * pure-LLM + AI-portrait path (which is the right behavior for ad-hoc
 * Wave 3 persons that have no Wikipedia page).
 */
type WikiContext = {
  found: boolean;
  zh_extract?: string;
  en_extract?: string;
  zh_thumb?: string;
  zh_original?: string;
  en_thumb?: string;
  en_original?: string;
  zh_description?: string;
  en_description?: string;
};
async function fetchWikipediaContext(person: any): Promise<WikiContext> {
  const out: WikiContext = { found: false };
  const ua = "cssOS/1.0 (https://cssmv.com)";
  const fetchOne = async (lang: "zh" | "en", title: string) => {
    if (!title) return null;
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": ua, Accept: "application/json" },
        signal: ctrl.signal,
      });
      if (!r.ok) return null;
      return (await r.json()) as any;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  };
  try {
    const [zh, en] = await Promise.all([
      fetchOne("zh", String(person.name_zh || "").trim()),
      fetchOne("en", String(person.name_en || "").trim()),
    ]);
    if (zh && typeof zh === "object") {
      if (zh.extract) out.zh_extract = String(zh.extract);
      if (zh.description) out.zh_description = String(zh.description);
      if (zh.thumbnail && zh.thumbnail.source) out.zh_thumb = String(zh.thumbnail.source);
      if (zh.originalimage && zh.originalimage.source) out.zh_original = String(zh.originalimage.source);
    }
    if (en && typeof en === "object") {
      if (en.extract) out.en_extract = String(en.extract);
      if (en.description) out.en_description = String(en.description);
      if (en.thumbnail && en.thumbnail.source) out.en_thumb = String(en.thumbnail.source);
      if (en.originalimage && en.originalimage.source) out.en_original = String(en.originalimage.source);
    }
    if (out.zh_extract || out.en_extract || out.zh_original || out.en_original || out.zh_thumb || out.en_thumb) {
      out.found = true;
    }
  } catch {
    /* swallow → found:false */
  }
  return out;
}

app.get("/api/person-mv/persons/:id/codex", async (req, res) => {
  noStore(res);
  try {
    await seedPersonProfilesOnce();
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, code: "INVALID_ID" });
    const refresh = String(req.query.refresh || "") === "1";
    const r = await withClient((c) =>
      c.query<any>(`SELECT * FROM person_profiles WHERE person_id = $1`, [id]),
    );
    let person: any = r.rows[0];
    if (!person) return res.status(404).json({ ok: false, code: "NOT_FOUND" });

    // CSSOS_PHASE2_WIKI_FEEDER 20260507 — fetch wiki context up-front so
    // both lore + portrait paths can use it. found:false → pure LLM + AI gen
    // (the original Wave 2.5 behavior, preserved for ad-hoc Wave 3 persons).
    const wiki = await fetchWikipediaContext(person);

    // Best-effort lore generation
    let lore: any = person.lore || {};
    const loreEmpty = !lore || !lore.bio || (Array.isArray(lore.events) && lore.events.length === 0);
    if (refresh || loreEmpty) {
      try {
        const sysPrompt =
          "你是文明编年史官。返回严格 JSON，键: bio (string, 80-160字, 中文), " +
          "events (array of {year:string, title:string, impact:string}, 5-8项), " +
          "contributions (array of string, 3-6项), controversies (array of string, 1-4项), " +
          "assessments (array of {perspective:'东方'|'西方'|'现代', text:string}, 恰好3项), " +
          "contemporaries (array of string), lineage (array of string), " +
          "influenced (array of string)。要求多视角平衡, 不神化不黑化, 全部使用 zh-CN。" +
          "只返回 JSON 不要其他文字。";
        let userPrompt = `人物: ${person.name_zh} (${person.name_en})\n` +
          `文明: ${person.civilization}\n时代: ${person.era || ""}\n生卒: ${person.lifespan || ""}\n` +
          `主题: ${person.core_theme || ""}\n意象: ${(person.visual_symbols || []).join("、")}`;
        if (wiki.found && (wiki.zh_extract || wiki.en_extract)) {
          userPrompt =
            "CONTEXT BLOCK (来自维基百科, 事实依据):\n" +
            (wiki.zh_extract ? `[zh.wiki] ${wiki.zh_extract}\n` : "") +
            (wiki.en_extract ? `[en.wiki] ${wiki.en_extract}\n` : "") +
            "\n基于以下维基百科资料重组为我们的结构化 schema，事实从此处来，不得虚构。" +
            "多视角部分（东方/西方/现代）由你独立分析。\n\n" +
            userPrompt;
        }
        const llm = await callLlm({
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: wiki.found ? 0.3 : 0.5,
          max_tokens: 1500,
          response_format: { type: "json_object" },
        });
        if (llm.ok && llm.content) {
          const parsed = JSON.parse(llm.content);
          lore = {
            ...parsed,
            source: wiki.found ? "wiki+llm" : "llm-only",
            generated_at: new Date().toISOString(),
          };
          await withClient((c) =>
            c.query(`UPDATE person_profiles SET lore = $1::jsonb, updated_at = now() WHERE person_id = $2`,
              [JSON.stringify(lore), id]),
          );
        }
      } catch (err) {
        console.warn("[person-mv] codex lore gen failed:", (err as Error)?.message || err);
      }
    }

    // Best-effort portrait generation
    // Wiki originalimage > thumbnail > AI gen. Only call callImageGen when
    // both wiki paths are missing — saves money + grounds the visual in
    // real reference imagery when available.
    let portraitUrl: string | null = person.portrait_url || null;
    if (refresh || !portraitUrl) {
      const wikiPortrait =
        wiki.zh_original || wiki.en_original || wiki.zh_thumb || wiki.en_thumb || null;
      if (wikiPortrait) {
        portraitUrl = wikiPortrait;
        try {
          await withClient((c) =>
            c.query(`UPDATE person_profiles SET portrait_url = $1, portrait_generated_at = now() WHERE person_id = $2`,
              [portraitUrl, id]),
          );
        } catch (_e) {}
      } else {
        try {
          const portraitPrompt = `Cinematic hero portrait of ${person.name_zh} (${person.name_en}), ` +
            `${person.civilization} civilization, ${person.era || ""}, ` +
            `${(person.visual_symbols || []).join(" ")}, painterly, dramatic lighting, no text, 16:9`;
          const img = await callImageGen({ prompt: portraitPrompt, size: "1024x576" });
          if (img.ok && img.image_url) {
            portraitUrl = img.image_url;
            await withClient((c) =>
              c.query(`UPDATE person_profiles SET portrait_url = $1, portrait_generated_at = now() WHERE person_id = $2`,
                [portraitUrl, id]),
            );
          }
        } catch (err) {
          console.warn("[person-mv] codex portrait gen failed:", (err as Error)?.message || err);
        }
      }
    }

    // MV gallery
    // CSSOS_PHASE2_MV_CARD_POSTER 20260507 — Wave 2.6 polish — Jing
    // LEFT JOIN user_works to surface cover_image for the gallery card.
    // Frontend falls back to a gradient + emoji when this is null/empty.
    const mvsR = await withClient((c) =>
      c.query(
        `SELECT pm.mv_id, pm.work_id, pm.created_by_user_id, pm.duration_secs, pm.created_at,
                w.cover_image, w.preview_image_url, w.title
           FROM person_mvs pm
           LEFT JOIN user_works w ON w.id = pm.work_id
          WHERE pm.person_id = $1
          ORDER BY pm.created_at DESC LIMIT 100`,
        [id],
      ),
    );
    const totalMvCount = mvsR.rowCount || 0;
    let myMvCount = 0;
    try {
      const u = await getSessionUser(req).catch(() => null);
      if (u && u.id) {
        myMvCount = mvsR.rows.filter((row: any) => String(row.created_by_user_id) === String(u.id)).length;
      }
    } catch (_e) {}

    // Contemporaries — different civilization, ordered by influence
    const contemR = await withClient((c) =>
      c.query(
        `SELECT person_id, name_zh, name_en, civilization, era, influence_score
           FROM person_profiles
          WHERE person_id <> $1 AND civilization <> $2 AND era IS NOT NULL
          ORDER BY influence_score DESC LIMIT 6`,
        [id, person.civilization],
      ),
    );

    // Lineage — same civilization
    const linR = await withClient((c) =>
      c.query(
        `SELECT person_id, name_zh, name_en, civilization, era, influence_score
           FROM person_profiles
          WHERE person_id <> $1 AND civilization = $2
          ORDER BY influence_score DESC LIMIT 6`,
        [id, person.civilization],
      ),
    );

    return res.json({
      ok: true,
      data: {
        person,
        lore: lore || {},
        portrait_url: portraitUrl,
        mvs: mvsR.rows,
        contemporaries: contemR.rows,
        lineage: linR.rows,
        total_mv_count: totalMvCount,
        my_mv_count: myMvCount,
      },
    });
  } catch (err) {
    console.warn("[person-mv] codex failed:", (err as Error)?.message || err);
    return res.status(500).json({ ok: false, code: "CODEX_FAILED" });
  }
});

/* CSSOS_PIPELINE_DRYRUN 20260507 — Jing
 * End-to-end demo without going through the full creation flow.
 * Hits each engine in sequence so we can verify the whole chain
 * works after a top-up:
 *   1. Mubert  → 30s mp3   (music)
 *   2. fal flux→ 1 image   (cover)
 *   3. Kling   → 5s mp4    (video, image2video using cover)
 *   4. Whisper → word JSON (subtitles, via Groq)
 * Returns per-stage status + URLs + total elapsed.
 * Admin only — costs real money on paid providers. */
app.post("/api/admin/pipeline/dry-run", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    const access = await resolveUserAccessProfile(user);
    if (String(access.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({ ok: false, code: "ADMIN_ONLY" });
    }
    const prompt = String(req.body?.prompt || "calm cinematic mountain dawn, slow zoom").trim();
    type Stage = { name: string; ok: boolean; ms: number; provider: string; url?: string; error?: string };
    const stages: Stage[] = [];
    const pushStage = (name: string, ok: boolean, ms: number, provider: string, url?: string | undefined, error?: string | undefined) => {
      const out: Stage = { name, ok, ms, provider };
      if (url) out.url = url;
      if (error) out.error = error;
      stages.push(out);
    };
    const t0 = Date.now();

    // 1. Music — Mubert
    let mt = Date.now();
    const mus = await callMusicGen({ prompt, duration_secs: 30, tags: ["cinematic", "ambient"] });
    pushStage("music", mus.ok, Date.now() - mt, mus.provider, mus.audio_url, mus.error);

    // 2. Cover — fal Flux
    mt = Date.now();
    const img = await callImageGen({ prompt, size: "1024x1024" });
    pushStage("cover", img.ok, Date.now() - mt, img.provider, img.image_url, img.error);

    // 3. Video — Kling i2v if cover succeeded, else t2v
    mt = Date.now();
    const vidReq: VideoGenRequest = {
      prompt,
      duration_secs: 5,
      aspect_ratio: "16:9",
      prefer: ["kling"],
    };
    if (img.ok && img.image_url) vidReq.image_url = img.image_url;
    const vid = await callVideoGen(vidReq);
    pushStage("video", vid.ok, Date.now() - mt, vid.provider, vid.video_url, vid.error);

    // 4. Subtitles — Groq Whisper on the music URL (if got one)
    mt = Date.now();
    let subOk = false; let subProvider = "skipped"; let subErr = "";
    let wordCount = 0;
    if (mus.ok && mus.audio_url) {
      const words = await runWhisperWordTimings(mus.audio_url);
      if (words && words.length) {
        subOk = true;
        subProvider = "groq-whisper-large-v3-turbo";
        wordCount = words.length;
      } else {
        subErr = "no_words_returned";
      }
    } else {
      subErr = "no_audio_to_transcribe";
    }
    pushStage("subtitles", subOk, Date.now() - mt, subProvider, undefined, subErr);

    return res.json({
      ok: stages.every((s) => s.ok),
      data: {
        stages,
        word_count: wordCount,
        elapsed_ms: Date.now() - t0,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, code: "DRYRUN_FAILED", error: String((err as Error)?.message || err) });
  }
});

app.post("/api/admin/karaoke/transcribe-all", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const access = await resolveUserAccessProfile(user);
    if (String(access.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({ ok: false, code: "ADMIN_ONLY" });
    }
    const stale = await withClient((c) =>
      c.query<{ id: string }>(
        `SELECT w.id
           FROM user_works w
           JOIN work_assets ata ON ata.work_id = w.id AND ata.asset_type = 'audio_track_1'
          WHERE NOT EXISTS (
                  SELECT 1 FROM work_assets ww
                   WHERE ww.work_id = w.id AND ww.asset_type = 'whisper_words'
                     AND COALESCE(ww.meta->>'word_count', '0')::int > 0
                )
          ORDER BY w.created_at DESC
          LIMIT 1000`,
      ),
    );
    const ids = stale.rows.map((r) => r.id);
    // Fire-and-forget worker — serialise so we don't burst Groq.
    setImmediate(async () => {
      let ok = 0, fail = 0;
      for (const id of ids) {
        try {
          await enqueueKaraokeTranscription(id);
          ok += 1;
        } catch (err) {
          fail += 1;
          console.warn("[karaoke-bulk] failed", id, (err as Error)?.message || err);
        }
        // Pace ourselves — one Groq call every ~5s = 12/min, well
        // under the free-tier rate cap.
        await new Promise((r) => setTimeout(r, 5000));
      }
      console.info("[karaoke-bulk] done — ok:%d fail:%d", ok, fail);
    });
    return res.json({ ok: true, data: { queued: ids.length, eta_seconds: ids.length * 5 } });
  } catch (_err) {
    return res.status(500).json({ ok: false, code: "BULK_FAILED" });
  }
});

/* CSSOS_PHASE3_KARAOKE_MANUAL — explicit transcription trigger so the
 * frontend can request word timings on first play for works that
 * predate the auto-enqueue (and so admins can re-transcribe). */
app.post("/api/works/:id/karaoke/transcribe", async (req, res) => {
  noStore(res);
  try {
    const id = String(req.params.id || "").trim();
    if (!/^[0-9a-fA-F-]{8,64}$/.test(id)) {
      return res.status(400).json({ ok: false, code: "INVALID_WORK_ID" });
    }
    void enqueueKaraokeTranscription(id);
    return res.json({ ok: true, data: { enqueued: true } });
  } catch (_err) {
    return res.status(500).json({ ok: false, code: "TRANSCRIBE_FAILED" });
  }
});

/* CSSOS_PROVIDER_DISCOVERY — exposed for the frontend engine picker. */
app.get("/api/llm/providers", (_req, res) => {
  noStore(res);
  return res.json({ ok: true, data: buildProvidersSnapshot() });
});

app.get("/api/works/public/:id", async (req, res) => {
  noStore(res);
  try {
    const id = String(req.params.id || "").trim();
    if (!/^[0-9a-fA-F-]{8,64}$/.test(id)) {
      return res
        .status(400)
        .json({ ok: false, code: "INVALID_WORK_ID" });
    }
    const viewer = await getSessionUser(req);
    type Row = WorkTreeRow & {
      audio_track_1_url?: string | null;
      audio_track_2_url?: string | null;
      final_mv_url?: string | null;
      lyrics_full?: string | null;
    };
    const q: QueryResult<Row> = await withClient((client) =>
      client.query<Row>(
        `SELECT
           w.id,
           w.user_id AS owner_user_id,
           w.title,
           w.style,
           w.work_type,
           w.lyrics_preview,
           w.status,
           w.created_at,
           w.updated_at,
           w.parent_work_id,
           w.root_work_id,
           w.structure_role,
           w.sequence_index,
           w.structure_plan,
           w.source_run_id,
           w.cover_image,
           w.preview_image_url,
           w.preview_video_url,
           u.display_name AS owner_name,
           u.email AS owner_email,
           COALESCE(listen_product.amount_cents, mp.current_listen_price_cents) AS current_listen_price_cents,
           COALESCE(buyout_product.amount_cents, mp.current_buyout_price_cents) AS current_buyout_price_cents,
           COALESCE(mp.buyout_enabled, buyout_product.active, false) AS buyout_enabled,
           mp.tips_enabled,
           mp.visibility,
           mp.rights_scope,
           final_mv_asset.url AS final_mv_url,
           audio_track_1_asset.url AS audio_track_1_url,
           audio_track_2_asset.url AS audio_track_2_url,
           whisper_words_asset.meta AS whisper_words_meta,
           COALESCE((final_mv_asset.meta->>'duration_secs')::float, NULL) AS duration_secs
         FROM user_works w
         JOIN users u ON u.id = w.user_id
         LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
         LEFT JOIN work_access_products listen_product
           ON listen_product.work_id = w.id
          AND listen_product.product_kind = 'listen'
          AND listen_product.active = true
         LEFT JOIN work_access_products buyout_product
           ON buyout_product.work_id = w.id
          AND buyout_product.product_kind = 'buyout'
          AND buyout_product.active = true
         LEFT JOIN work_assets final_mv_asset
           ON final_mv_asset.work_id = w.id
          AND final_mv_asset.asset_type = 'final_mv'
         LEFT JOIN work_assets audio_track_1_asset
           ON audio_track_1_asset.work_id = w.id
          AND audio_track_1_asset.asset_type = 'audio_track_1'
         LEFT JOIN work_assets audio_track_2_asset
           ON audio_track_2_asset.work_id = w.id
          AND audio_track_2_asset.asset_type = 'audio_track_2'
         LEFT JOIN work_assets whisper_words_asset
           ON whisper_words_asset.work_id = w.id
          AND whisper_words_asset.asset_type = 'whisper_words'
         WHERE w.id = $1
         LIMIT 1`,
        [id],
      ),
    );
    if (!q.rows.length) {
      return res.status(404).json({ ok: false, code: "WORK_NOT_FOUND" });
    }
    const row = q.rows[0]!;
    const visibility = String(row.visibility || "public").toLowerCase();
    if (visibility === "private" && viewer?.id !== row.owner_user_id) {
      return res.status(404).json({ ok: false, code: "WORK_NOT_FOUND" });
    }
    const normalized = normalizeWorkTreeRow(row) as any;
    // Resolve viewer access tier. getAccessTier-equivalent on server side
    // is just user.tier (or "guest").
    const viewerTier = String((viewer as any)?.tier || "guest").toLowerCase();
    const proPlus = ["pro", "studio", "enterprise", "vip", "admin"].includes(
      viewerTier,
    );
    const isOwner = !!(viewer?.id && viewer.id === row.owner_user_id);
    // Has the viewer purchased a listen / buyout for this work?
    let hasPurchased = false;
    if (viewer?.id && !isOwner) {
      const orderRes = await withClient((client) =>
        client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM work_orders
           WHERE buyer_user_id = $1
             AND work_id = $2
             AND status IN ('paid','completed','fulfilled')`,
          [viewer.id, id],
        ),
      );
      hasPurchased = (orderRes.rows[0]?.count || 0) > 0;
    }
    const listenCents = Number(normalized.current_listen_price_cents || 0);
    const isFree = listenCents <= 0;
    // CSSOS_ADMIN_FREE 20260506 — Jing
    // Works owned by an admin (anyone with @cssstudio.app email or
    // jingdudc@gmail.com, or role='admin') are free for everyone,
    // including guests. No 30s cap.
    const ownerEmail = String(row.owner_email || "").toLowerCase().trim();
    const isOwnerAdmin =
      ownerEmail === "jingdudc@gmail.com" ||
      /@cssstudio\.app$/i.test(ownerEmail);
    const fullAccess = isFree || isOwner || hasPurchased || isOwnerAdmin;
    const previewOnly = !fullAccess;
    /* CSSOS_PHASE_C_SIGNED_URLS 20260506 — wrap every playable URL with a
     * short-lived HMAC token. Anyone who scrapes page source / HTML gets
     * a token that's bound to (workId, file, expiry, accessKind). For
     * paid works seen by guests, the token is "preview" — server stamps
     * X-Preview-Limit-Seconds so the player stops at the cap. */
    const signKind: "full" | "preview" = fullAccess ? "full" : "preview";
    const signedFinalMv = signArtifactUrl(
      id,
      row.final_mv_url || normalized.preview_video_url || null,
      signKind,
    );
    const signedPreviewVideo = signArtifactUrl(
      id,
      normalized.preview_video_url || null,
      signKind,
    );
    const signedAudio1 = signArtifactUrl(id, row.audio_track_1_url || null, signKind);
    const signedAudio2 = signArtifactUrl(id, row.audio_track_2_url || null, signKind);
    return res.json({
      ok: true,
      data: {
        id: normalized.id,
        title: normalized.title,
        style: normalized.style,
        work_type: normalized.work_type,
        lyrics_preview: normalized.lyrics_preview,
        owner_name: normalized.owner_name || null,
        duration_secs: normalized.duration_secs || null,
        cover_image: normalized.cover_image || null,
        preview_image_url: normalized.preview_image_url || null,
        // Playable URL: signed token, full kind for full-access viewers,
        // preview kind for guests on paid works (player honours the
        // X-Preview-Limit-Seconds header response from /secure/artifacts).
        final_mv_url: fullAccess ? signedFinalMv : null,
        preview_video_url: signedPreviewVideo,
        audio_track_1_url: fullAccess ? signedAudio1 : null,
        audio_track_2_url: fullAccess ? signedAudio2 : null,
        // CSSOS_PHASE3_KARAOKE — per-word timings from a Whisper pass
        // run when the audio asset first lands. Frontend renders these
        // via app.karaoke-active-word.js for演出级 karaoke.
        karaoke_words: (() => {
          const meta = (row as { whisper_words_meta?: { words?: WhisperWord[] } | null }).whisper_words_meta;
          const arr = meta && Array.isArray(meta.words) ? meta.words : null;
          return arr && arr.length ? arr : null;
        })(),
        // Tier flags for the front end (Phase B will render download UI).
        viewer_tier: viewerTier,
        is_free: isFree,
        is_owner: isOwner,
        has_purchased: hasPurchased,
        full_access: fullAccess,
        preview_only: previewOnly,
        listen_price_cents: listenCents,
        can_download_mp3: fullAccess,
        can_download_wav: fullAccess && proPlus,
        can_download_mp4: fullAccess && proPlus,
        // Hint to UI: how to nudge a guest who only sees the preview.
        gate_action: previewOnly
          ? viewer
            ? "subscribe"
            : "sign_in"
          : null,
      },
    });
  } catch (err) {
    console.error("[/api/works/public/:id]", err);
    return res
      .status(500)
      .json({ ok: false, code: "PUBLIC_WORK_FAILED" });
  }
});

/* CSSOS_PHASE_B_DOWNLOAD_TICKET 20260506 — Jing
 * Tier-gated download endpoint. Phase B contract:
 *   POST /api/works/:id/download/:format   (format = mp3 | wav | mp4)
 *     200 → { ok:true, url, expires_in }
 *     401 → { ok:false, code:"AUTH_REQUIRED" }
 *     402 → { ok:false, code:"TIER_REQUIRED", required:"pro" }
 *     404 → { ok:false, code:"NOT_AVAILABLE" }
 *
 * Phase B implementation: returns the existing storage URLs straight
 * away. Phase C will wrap them in a 24h-signed ticket so direct hot-
 * linking dies and the ticket auto-expires. The frontend already calls
 * this endpoint and falls back to the work's existing URL if the
 * endpoint isn't reachable, so deploying the wrapper is a no-op for
 * users until Phase C tightens enforcement.
 */
app.post("/api/works/:id/download/:format", async (req, res) => {
  noStore(res);
  try {
    const id = String(req.params.id || "").trim();
    const format = String(req.params.format || "").trim().toLowerCase();
    if (!/^[0-9a-fA-F-]{8,64}$/.test(id)) {
      return res.status(400).json({ ok: false, code: "INVALID_WORK_ID" });
    }
    if (!["mp3", "wav", "mp4"].includes(format)) {
      return res
        .status(400)
        .json({ ok: false, code: "INVALID_FORMAT" });
    }
    const viewer = await getSessionUser(req);
    if (!viewer) {
      return res
        .status(401)
        .json({ ok: false, code: "AUTH_REQUIRED" });
    }
    type Row = {
      owner_user_id: string;
      visibility: string | null;
      current_listen_price_cents: number | null;
      final_mv_url: string | null;
      audio_track_1_url: string | null;
      title: string | null;
    };
    const q: QueryResult<Row> = await withClient((client) =>
      client.query<Row>(
        `SELECT
           w.user_id AS owner_user_id,
           mp.visibility,
           COALESCE(listen_product.amount_cents, mp.current_listen_price_cents) AS current_listen_price_cents,
           final_mv_asset.url AS final_mv_url,
           audio_track_1_asset.url AS audio_track_1_url,
           w.title
         FROM user_works w
         LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
         LEFT JOIN work_access_products listen_product
           ON listen_product.work_id = w.id
          AND listen_product.product_kind = 'listen'
          AND listen_product.active = true
         LEFT JOIN work_assets final_mv_asset
           ON final_mv_asset.work_id = w.id
          AND final_mv_asset.asset_type = 'final_mv'
         LEFT JOIN work_assets audio_track_1_asset
           ON audio_track_1_asset.work_id = w.id
          AND audio_track_1_asset.asset_type = 'audio_track_1'
         WHERE w.id = $1
         LIMIT 1`,
        [id],
      ),
    );
    if (!q.rows.length) {
      return res.status(404).json({ ok: false, code: "WORK_NOT_FOUND" });
    }
    const row = q.rows[0]!;
    const isOwner = viewer.id === row.owner_user_id;
    let hasPurchased = false;
    if (!isOwner) {
      const orderRes = await withClient((client) =>
        client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM work_orders
           WHERE buyer_user_id = $1
             AND work_id = $2
             AND status IN ('paid','completed','fulfilled')`,
          [viewer.id, id],
        ),
      );
      hasPurchased = (orderRes.rows[0]?.count || 0) > 0;
    }
    const isFree = Number(row.current_listen_price_cents || 0) <= 0;
    const fullAccess = isOwner || hasPurchased || isFree;
    if (!fullAccess) {
      return res
        .status(402)
        .json({ ok: false, code: "PURCHASE_REQUIRED" });
    }
    const tier = String((viewer as any)?.tier || "guest").toLowerCase();
    const isProPlus = ["pro", "studio", "enterprise", "vip", "admin"].includes(
      tier,
    );
    if ((format === "wav" || format === "mp4") && !isProPlus) {
      return res
        .status(402)
        .json({ ok: false, code: "TIER_REQUIRED", required: "pro" });
    }
    let url: string | null = null;
    if (format === "mp3") url = row.audio_track_1_url || null;
    else if (format === "wav") url = row.audio_track_1_url || null; // TODO Phase C: server-side flac→wav re-encode
    else if (format === "mp4") url = row.final_mv_url || null;
    if (!url) {
      return res.status(404).json({ ok: false, code: "NOT_AVAILABLE" });
    }
    /* TODO CSSOS_PHASE_C — wrap `url` in a 24h-signed ticket so direct
     * hotlinks die when the ticket expires. For now we return the raw
     * storage URL; the frontend uses it the same way and the user-
     * visible behavior is identical. */
    return res.json({
      ok: true,
      url,
      expires_in: 24 * 60 * 60,
      format,
    });
  } catch (err) {
    console.error("[/api/works/:id/download/:format]", err);
    return res
      .status(500)
      .json({ ok: false, code: "DOWNLOAD_TICKET_FAILED" });
  }
});

app.get("/api/works/market", async (req, res) => {
  noStore(res);
  try {
    const viewer = await getSessionUser(req);
    const debugTree = String(req.query.debug_tree || "").trim() === "1";
    // CSSOS_PHASE2_FULL_MARKET_LIMIT 20260504 — Jing: same cap raise
    // as /api/works/mine so the marketplace pages client-side cleanly.
    const limit = Math.max(1, Math.min(Number(req.query.limit || 24), 1000));
    type Row = WorkTreeRow;
    const q: QueryResult<Row> = await withClient((client) =>
      client.query<Row>(
        `SELECT
           w.id,
           w.user_id AS owner_user_id,
           w.title,
           w.style,
           w.work_type,
           w.lyrics_preview,
           w.status,
           w.created_at,
           w.updated_at,
           w.parent_work_id,
           w.root_work_id,
           w.structure_role,
           w.sequence_index,
           w.structure_plan,
           w.source_run_id,
           w.compute_units_estimate,
           w.compute_cost_cents_estimate,
           w.suggested_listen_price_cents,
           w.suggested_buyout_price_cents,
           w.cover_image,
           w.preview_image_url,
           w.preview_video_url,
           u.display_name AS owner_name,
           u.email AS owner_email,
           COALESCE(listen_product.amount_cents, mp.current_listen_price_cents) AS current_listen_price_cents,
           COALESCE(buyout_product.amount_cents, mp.current_buyout_price_cents) AS current_buyout_price_cents,
           COALESCE(mp.buyout_enabled, buyout_product.active, false) AS buyout_enabled,
           mp.tips_enabled,
           mp.visibility,
           mp.rights_scope,
           /* CSSOS_PHASE2_MARKET_DURATION 20260504 — Jing
              "为你创作面板的作品卡片，压上时长". Surface duration_secs
              from the final_mv asset's meta so foryou cards can show
              the mm:ss chip on the cover, matching Works Center. */
           COALESCE((fm_asset.meta->>'duration_secs')::float, NULL) AS duration_secs
         FROM user_works w
         JOIN users u ON u.id = w.user_id
         LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
         LEFT JOIN work_access_products listen_product
           ON listen_product.work_id = w.id
          AND listen_product.product_kind = 'listen'
          AND listen_product.active = true
         LEFT JOIN work_access_products buyout_product
           ON buyout_product.work_id = w.id
          AND buyout_product.product_kind = 'buyout'
          AND buyout_product.active = true
         LEFT JOIN work_assets fm_asset
           ON fm_asset.work_id = w.id
          AND fm_asset.asset_type = 'final_mv'
         WHERE COALESCE(mp.visibility, 'public') <> 'private'
           AND COALESCE(listen_product.amount_cents, mp.current_listen_price_cents, $2) > 0
           AND w.parent_work_id IS NULL
         ORDER BY w.updated_at DESC, w.created_at DESC
         LIMIT $1`,
        [limit, defaultListenPriceCents()],
      ),
    );
    const rootIds = q.rows.map((row) => row.id);
    let childRows: Row[] = rootIds.length ? await loadMarketWorkDescendants(rootIds) : [];
    const westworldRootId = "bd9508d7-d145-4eff-9fee-15a9184ec6fe";
    const debugPayload: Record<string, unknown> = debugTree
      ? {
          root_ids: rootIds.length,
          child_rows: childRows.length,
          westworld_child_rows: childRows.filter(
            (row) => String(row.root_work_id || "").trim() === westworldRootId,
          ).length,
        }
      : {};
    const works = q.rows.map((row) => normalizeWorkTreeRow(row));
    let ordersByWork = new Map<string, any[]>();
    if (viewer?.id && works.length) {
      const orderRes = await withClient((client) =>
        client.query<any>(
          `SELECT work_id, order_kind, status, updated_at, created_at
           FROM work_orders
           WHERE buyer_user_id = $1
             AND work_id = ANY($2::uuid[])
           ORDER BY updated_at DESC, created_at DESC`,
          [viewer.id, works.map((row) => row.id)],
        ),
      );
      ordersByWork = orderRes.rows.reduce((acc, row) => {
        const key = String(row.work_id || "");
        const list = acc.get(key) || [];
        list.push(row);
        acc.set(key, list);
        return acc;
      }, new Map<string, any[]>());
    }
    const transferRes = rootIds.length
      ? await withClient((client) =>
          client.query<{
            work_id: string;
            to_user_id: string | null;
            to_label: string | null;
            effective_at: string;
          }>(
            `SELECT
               ot.work_id,
               ot.to_user_id,
               COALESCE(u.display_name, u.email) AS to_label,
               ot.effective_at
             FROM ownership_transfers ot
             LEFT JOIN users u ON u.id = ot.to_user_id
             WHERE ot.work_id = ANY($1::uuid[])
             ORDER BY ot.effective_at ASC, ot.created_at ASC`,
            [rootIds],
          ),
        )
      : {
          rows: [] as Array<{
            work_id: string;
            to_user_id: string | null;
            to_label: string | null;
            effective_at: string;
          }>,
        };
    const transfersByWork = transferRes.rows.reduce((acc, row) => {
      const key = String(row.work_id || "");
      const list = acc.get(key) || [];
      list.push(row);
      acc.set(key, list);
      return acc;
    }, new Map<string, Array<{ work_id: string; to_user_id: string | null; to_label: string | null; effective_at: string }>>());
    let tree = buildWorkTree([...q.rows, ...childRows]);
    if (debugTree) {
      const westworldNode = tree.find(
        (row) => String(row?.id || "").trim() === westworldRootId,
      );
      debugPayload.after_build_children = Array.isArray(westworldNode?.children)
        ? westworldNode.children.length
        : 0;
    }
    if (rootIds.length && structuredTreeHasMissingChildren(tree)) {
      const missingRootIds = tree
        .filter((node) => structuredTreeNodeNeedsChildren(node))
        .filter((node) => !Array.isArray(node?.children) || !node.children.length)
        .map((node) => String(node?.id || "").trim())
        .filter(Boolean);
      if (missingRootIds.length) {
        if (debugTree) {
          debugPayload.missing_root_ids = missingRootIds;
        }
        const extraRows = (
          await Promise.all(missingRootIds.map((rootId) => loadMarketWorkDescendantsForRoot(rootId)))
        ).flat();
        if (debugTree) {
          debugPayload.extra_rows = extraRows.length;
        }
        if (extraRows.length) {
          const dedupedRows = new Map<string, Row>();
          [...childRows, ...extraRows].forEach((row) => {
            dedupedRows.set(String(row.id), row);
          });
          childRows = [...dedupedRows.values()];
        }
      }
      tree = buildWorkTree([...q.rows, ...childRows]);
    }
    tree = await fillMarketStructuredChildren(tree, q.rows);
    if (debugTree) {
      const westworldNode = tree.find(
        (row) => String(row?.id || "").trim() === westworldRootId,
      );
      debugPayload.final_children = Array.isArray(westworldNode?.children)
        ? westworldNode.children.length
        : 0;
    }
    let marketState: Record<string, unknown> | null = null;
    if (!tree.length) {
      type CountRow = {
        users_total: string | number;
        works_total: string | number;
        published_total: string | number;
      };
      const counts = await withClient((client) =>
        client.query<CountRow>(
          `SELECT
             (SELECT COUNT(*) FROM users) AS users_total,
             (SELECT COUNT(*) FROM user_works) AS works_total,
             (
               SELECT COUNT(*)
               FROM user_works w
               LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
               LEFT JOIN work_access_products listen_product
                 ON listen_product.work_id = w.id
                AND listen_product.product_kind = 'listen'
                AND listen_product.active = true
               WHERE COALESCE(mp.visibility, 'public') <> 'private'
                 AND COALESCE(listen_product.amount_cents, mp.current_listen_price_cents, $1) > 0
                 AND w.parent_work_id IS NULL
             ) AS published_total`,
          [defaultListenPriceCents()],
        ),
      );
      const row = counts.rows[0];
      const usersTotal = Number(row?.users_total || 0);
      const worksTotal = Number(row?.works_total || 0);
      const publishedTotal = Number(row?.published_total || 0);
      marketState = {
        users_total: usersTotal,
        works_total: worksTotal,
        published_total: publishedTotal,
        reason:
          usersTotal <= 0 && worksTotal <= 0
            ? "empty_database"
            : worksTotal > 0 && publishedTotal <= 0
              ? "no_published_works"
              : "no_visible_market_results",
      };
    }
    return res.json(
      okData({
        works: tree.map((row) => {
          const orders = ordersByWork.get(String(row.id || "")) || [];
          const ownerLabel = String(
            row.owner_name || row.owner_email || "Creator",
          );
          const ownerChain = buildOwnerChain(
            transfersByWork.get(String(row.id || "")) || [],
            ownerLabel,
          );
          const previousOwner =
            ownerChain.length > 1
              ? ownerChain[ownerChain.length - 2]?.label
              : ownerLabel;
          /* Phase C.3 — sign media URLs per viewer access. Free works
           * + owner + paid customers get full tokens; everyone else
           * gets preview-kind tokens that resolve to a 30s clip. */
          const isOwner = !!viewer && viewer.id === row.owner_user_id;
          const isFree = Number((row as { current_listen_price_cents?: number }).current_listen_price_cents || 0) <= 0;
          const purchased = orders.some((o: { status?: string }) =>
            o?.status === "paid" || o?.status === "completed" || o?.status === "fulfilled",
          );
          // CSSOS_ADMIN_FREE 20260506 — admin-owned works are free for all.
          const ownerEmailMkt = String((row as { owner_email?: string }).owner_email || "")
            .toLowerCase().trim();
          const isOwnerAdminMkt =
            ownerEmailMkt === "jingdudc@gmail.com" ||
            /@cssstudio\.app$/i.test(ownerEmailMkt);
          const fullAccess = isOwner || isFree || purchased || isOwnerAdminMkt;
          const signed = signMediaUrlsOnRow(row, fullAccess ? "full" : "preview");
          return {
            ...signed,
            viewer_orders: orders,
            owner_chain: ownerChain,
            previous_owner_label: previousOwner,
          };
        }),
        market_state: marketState,
        ...(debugTree ? { debug_tree: debugPayload } : {}),
      }),
    );
  } catch {
    return res.status(500).json({ ok: false, code: "WORKS_MARKET_FAILED" });
  }
});

app.post("/api/works", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const title = String(req.body?.title || "").trim();
    if (!title) {
      return res.status(400).json({ ok: false, code: "MISSING_TITLE" });
    }
    const style = req.body?.style ? String(req.body.style).trim() : null;
    const workType = normalizeWorkType(req.body?.work_type);
    const parentWorkId = String(req.body?.parent_work_id || "").trim() || null;
    const requestedRootWorkId =
      String(req.body?.root_work_id || "").trim() || null;
    const structureRole =
      String(req.body?.structure_role || "")
        .trim()
        .toLowerCase() || workType;
    const sequenceIndex = Math.max(
      0,
      Number.parseInt(String(req.body?.sequence_index || "0"), 10) || 0,
    );
    const structurePlan = normalizeSongSeedStructurePlan(
      req.body?.structure_plan,
    );
    let listenPriceCents = Number.parseInt(
      String(req.body?.listen_price_cents || "0"),
      10,
    );
    let buyoutPriceCents = Number.parseInt(
      String(req.body?.buyout_price_cents || "0"),
      10,
    );
    // CSSOS_PHASE2_NO_JUDGE_AS_PLAYER 20260501 #266 — Jing
    // New admin-owned works default to free + priceless. Override any
    // body-supplied prices at insert time so the rule holds even if a
    // client (or a scripted backfill) tries to set non-zero values.
    if (isCssosAdminEmail(user.email)) {
      listenPriceCents = 0;
      buyoutPriceCents = 0;
    }
    const lyricsRaw = req.body?.lyrics_preview
      ? String(req.body.lyrics_preview)
      : "";
    const lyricsPreview = lyricsRaw.trim() || null;
    const sourceRunId = String(req.body?.source_run_id || "").trim() || null;
    const computeUnitsEstimate = Math.max(
      0,
      Number.parseInt(String(req.body?.compute_units_estimate || "0"), 10) || 0,
    );
    const computeCostCentsEstimate = Math.max(
      0,
      Number.parseInt(
        String(req.body?.compute_cost_cents_estimate || "0"),
        10,
      ) || 0,
    );
    const suggestedListenPriceCents = Math.max(
      0,
      Number.parseInt(
        String(
          req.body?.suggested_listen_price_cents || listenPriceCents || "0",
        ),
        10,
      ) || 0,
    );
    const suggestedBuyoutPriceCents = Math.max(
      0,
      Number.parseInt(
        String(
          req.body?.suggested_buyout_price_cents || buyoutPriceCents || "0",
        ),
        10,
      ) || 0,
    );
    const coverImage = String(req.body?.cover_image || "").trim() || null;
    const previewImageUrl =
      String(req.body?.preview_image_url || "").trim() || null;
    const previewVideoUrl =
      String(req.body?.preview_video_url || "").trim() || null;
    const previewVideoAssetKey =
      String(req.body?.preview_video_asset_key || "").trim() || null;
    const inheritedRootType =
      requestedRootWorkId || parentWorkId
        ? await withClient(async (client) => {
            const rootLookup = await client.query<{ work_type: string | null }>(
              `SELECT work_type
               FROM user_works
               WHERE id = COALESCE($1::uuid, $2::uuid)
               LIMIT 1`,
              [requestedRootWorkId, parentWorkId],
            );
            return normalizeWorkType(rootLookup.rows[0]?.work_type || workType);
          })
        : workType;
    const wholeBuyoutChild =
      Boolean(requestedRootWorkId || parentWorkId) &&
      (inheritedRootType === "opera" || inheritedRootType === "triptych");
    const workId = crypto.randomUUID();
    const persistedAssets = await buildPersistedWorkAssetBundle({
      workId,
      sourceRunId,
      coverImage,
      previewImageUrl,
      previewVideoUrl,
      previewVideoAssetKey,
    });
    await withClient(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO user_works (
             id, user_id, title, style, work_type, lyrics_preview, status, parent_work_id, root_work_id, structure_role, sequence_index, structure_plan,
             source_run_id, compute_units_estimate, compute_cost_cents_estimate, suggested_listen_price_cents, suggested_buyout_price_cents,
             cover_image, preview_image_url, preview_video_url
           )
           VALUES ($1::uuid, $2, $3, $4, $5, $6, 'draft', $7::uuid, $8::uuid, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            workId,
            user.id,
            title,
            style,
            workType,
            lyricsPreview,
            parentWorkId,
            requestedRootWorkId,
            structureRole,
            sequenceIndex,
            structurePlan ? JSON.stringify(structurePlan) : null,
            sourceRunId,
            computeUnitsEstimate,
            computeCostCentsEstimate,
            suggestedListenPriceCents,
            suggestedBuyoutPriceCents,
            persistedAssets.coverImage,
            persistedAssets.previewImageUrl,
            persistedAssets.storedPreviewVideoRef,
          ],
        );
        const resolvedRootWorkId = requestedRootWorkId || workId;
        await client.query(
          `UPDATE user_works SET root_work_id = $2, updated_at = now() WHERE id = $1`,
          [workId, resolvedRootWorkId],
        );
        await syncCanonicalWorkAssets(
          client,
          workId,
          persistedAssets.assetRecords,
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
    if (workId) {
      const resolvedRootWorkId = requestedRootWorkId || workId;
      await ensureWorkMarketSeed({
        workId,
        ownerUserId: user.id,
        title,
        style,
        workType: inheritedRootType || workType,
        structureRole,
        listenPriceCents:
          Number.isFinite(listenPriceCents) && listenPriceCents > 0
            ? listenPriceCents
            : null,
        buyoutPriceCents:
          Number.isFinite(buyoutPriceCents) && buyoutPriceCents >= 0
            ? buyoutPriceCents
            : null,
        buyoutEnabled: !wholeBuyoutChild,
      });
    }
    return res.json(
      okData({
        id: workId,
        work_type: workType,
        parent_work_id: parentWorkId,
        root_work_id: requestedRootWorkId || workId,
        structure_role: structureRole,
        sequence_index: sequenceIndex,
        structure_plan: structurePlan,
        source_run_id: sourceRunId,
        compute_units_estimate: computeUnitsEstimate,
        compute_cost_cents_estimate: computeCostCentsEstimate,
        suggested_listen_price_cents: suggestedListenPriceCents,
        suggested_buyout_price_cents: suggestedBuyoutPriceCents,
        cover_image: persistedAssets.coverImage,
        preview_image_url: persistedAssets.previewImageUrl,
        // Phase C.3.b — sign owner-emitted media URLs as "full".
        preview_video_url: signArtifactUrl(workId, persistedAssets.previewVideoUrl, "full"),
        preview_video_asset_key: persistedAssets.previewVideoAssetKey,
      }),
    );
  } catch {
    return res.status(500).json({ ok: false, code: "WORK_CREATE_FAILED" });
  }
});

app.patch("/api/works/:id/assets", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const workId = String(req.params.id || "").trim();
    if (!workId) {
      return res.status(400).json({ ok: false, code: "WORK_REQUIRED" });
    }
    const ownerCheck = await withClient((client) =>
      client.query<{ id: string }>(
        `SELECT id FROM user_works WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [workId, user.id],
      ),
    );
    if (!ownerCheck.rows[0]?.id) {
      return res.status(404).json({ ok: false, code: "WORK_NOT_FOUND" });
    }
    const coverImage = String(req.body?.cover_image || "").trim() || null;
    const previewImageUrl =
      String(req.body?.preview_image_url || "").trim() || null;
    const previewVideoUrl =
      String(req.body?.preview_video_url || "").trim() || null;
    const previewVideoAssetKey =
      String(req.body?.preview_video_asset_key || "").trim() || null;
    const workRow = await withClient((client) =>
      client.query<{
        source_run_id: string | null;
        cover_image: string | null;
        preview_image_url: string | null;
        preview_video_url: string | null;
      }>(
        `SELECT source_run_id, cover_image, preview_image_url, preview_video_url
         FROM user_works
         WHERE id = $1
         LIMIT 1`,
        [workId],
      ),
    );
    const existingWork = workRow.rows[0];
    const workSourceRunId = String(existingWork?.source_run_id || "").trim();
    const persistedAssets = await buildPersistedWorkAssetBundle({
      workId,
      sourceRunId: workSourceRunId || null,
      coverImage,
      previewImageUrl,
      previewVideoUrl,
      previewVideoAssetKey,
    });
    const updated = await withClient(async (client) => {
      await client.query("BEGIN");
      try {
        const result = await client.query<{
          cover_image: string | null;
          preview_image_url: string | null;
          preview_video_url: string | null;
          source_run_id: string | null;
        }>(
          `UPDATE user_works
           SET cover_image = COALESCE($2, cover_image),
               preview_image_url = COALESCE($3, preview_image_url),
               preview_video_url = COALESCE($4, preview_video_url),
               updated_at = now()
           WHERE id = $1
           RETURNING cover_image, preview_image_url, preview_video_url, source_run_id`,
          [
            workId,
            persistedAssets.coverImage,
            persistedAssets.previewImageUrl,
            persistedAssets.storedPreviewVideoRef,
          ],
        );
        await syncCanonicalWorkAssets(
          client,
          workId,
          persistedAssets.assetRecords,
        );
        await client.query("COMMIT");
        return result.rows[0] || null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
    const previewVideoReference = resolveStoredPreviewVideoReference(
      String(updated?.source_run_id || workSourceRunId || "").trim(),
      updated?.preview_video_url || persistedAssets.storedPreviewVideoRef,
    );
    return res.json(
      okData({
        work_id: workId,
        cover_image: updated?.cover_image || existingWork?.cover_image || null,
        preview_image_url:
          updated?.preview_image_url || existingWork?.preview_image_url || null,
        // Phase C.3.b — owner-only endpoint, sign "full".
        preview_video_url: signArtifactUrl(workId, previewVideoReference.previewVideoUrl, "full"),
        preview_video_asset_key: previewVideoReference.previewVideoAssetKey,
      }),
    );
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "WORK_ASSETS_UPDATE_FAILED" });
  }
});

app.patch("/api/works/:id/generation", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const workId = String(req.params.id || "").trim();
    if (!workId) {
      return res.status(400).json({ ok: false, code: "WORK_REQUIRED" });
    }
    const ownerCheck = await withClient((client) =>
      client.query<{
        id: string;
        root_work_id: string | null;
        parent_work_id: string | null;
        source_run_id: string | null;
      }>(
        `SELECT id, root_work_id, parent_work_id, source_run_id
         FROM user_works
         WHERE id = $1 AND user_id = $2
         LIMIT 1`,
        [workId, user.id],
      ),
    );
    const existing = ownerCheck.rows[0];
    if (!existing?.id) {
      return res.status(404).json({ ok: false, code: "WORK_NOT_FOUND" });
    }
    const title = String(req.body?.title || "").trim() || null;
    const style = String(req.body?.style || "").trim() || null;
    const lyricsPreviewRaw = req.body?.lyrics_preview
      ? String(req.body.lyrics_preview)
      : "";
    const lyricsPreview = lyricsPreviewRaw.trim() || null;
    const sourceRunId = String(req.body?.source_run_id || "").trim() || null;
    const computeUnitsEstimate = Math.max(
      0,
      Number.parseInt(String(req.body?.compute_units_estimate || "0"), 10) || 0,
    );
    const computeCostCentsEstimate = Math.max(
      0,
      Number.parseInt(
        String(req.body?.compute_cost_cents_estimate || "0"),
        10,
      ) || 0,
    );
    const suggestedListenPriceCents = Math.max(
      0,
      Number.parseInt(
        String(req.body?.suggested_listen_price_cents || "0"),
        10,
      ) || 0,
    );
    const suggestedBuyoutPriceCents = Math.max(
      0,
      Number.parseInt(
        String(req.body?.suggested_buyout_price_cents || "0"),
        10,
      ) || 0,
    );
    const coverImage = String(req.body?.cover_image || "").trim() || null;
    const previewImageUrl =
      String(req.body?.preview_image_url || "").trim() || null;
    const previewVideoUrl =
      String(req.body?.preview_video_url || "").trim() || null;
    const previewVideoAssetKey =
      String(req.body?.preview_video_asset_key || "").trim() || null;
    const effectiveSourceRunId =
      sourceRunId || String(existing.source_run_id || "").trim() || null;
    const persistedAssets = await buildPersistedWorkAssetBundle({
      workId,
      sourceRunId: effectiveSourceRunId,
      coverImage,
      previewImageUrl,
      previewVideoUrl,
      previewVideoAssetKey,
    });
    const updated = await withClient(async (client) => {
      await client.query("BEGIN");
      try {
        const result = await client.query<{
          title: string | null;
          style: string | null;
          lyrics_preview: string | null;
          source_run_id: string | null;
          compute_units_estimate: number | null;
          compute_cost_cents_estimate: number | null;
          suggested_listen_price_cents: number | null;
          suggested_buyout_price_cents: number | null;
          cover_image: string | null;
          preview_image_url: string | null;
          preview_video_url: string | null;
        }>(
          `UPDATE user_works
           SET title = COALESCE($2, title),
               style = COALESCE($3, style),
               lyrics_preview = COALESCE($4, lyrics_preview),
               source_run_id = COALESCE($5, source_run_id),
               compute_units_estimate = CASE WHEN $6 > 0 THEN $6 ELSE compute_units_estimate END,
               compute_cost_cents_estimate = CASE WHEN $7 > 0 THEN $7 ELSE compute_cost_cents_estimate END,
               suggested_listen_price_cents = CASE WHEN $8 > 0 THEN $8 ELSE suggested_listen_price_cents END,
               suggested_buyout_price_cents = CASE WHEN $9 > 0 THEN $9 ELSE suggested_buyout_price_cents END,
               cover_image = COALESCE($10, cover_image),
               preview_image_url = COALESCE($11, preview_image_url),
               preview_video_url = COALESCE($12, preview_video_url),
               updated_at = now()
           WHERE id = $1
           RETURNING title, style, lyrics_preview, source_run_id, compute_units_estimate,
                     compute_cost_cents_estimate, suggested_listen_price_cents,
                     suggested_buyout_price_cents, cover_image, preview_image_url, preview_video_url`,
          [
            workId,
            title,
            style,
            lyricsPreview,
            sourceRunId,
            computeUnitsEstimate,
            computeCostCentsEstimate,
            suggestedListenPriceCents,
            suggestedBuyoutPriceCents,
            persistedAssets.coverImage,
            persistedAssets.previewImageUrl,
            persistedAssets.storedPreviewVideoRef,
          ],
        );
        await syncCanonicalWorkAssets(
          client,
          workId,
          persistedAssets.assetRecords,
        );
        await client.query("COMMIT");
        return result.rows[0] || null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
    const previewVideoReference = resolveStoredPreviewVideoReference(
      String(updated?.source_run_id || effectiveSourceRunId || "").trim(),
      updated?.preview_video_url || persistedAssets.storedPreviewVideoRef,
    );
    return res.json(
      okData({
        id: workId,
        work_id: workId,
        title: updated?.title || title,
        style: updated?.style || style,
        lyrics_preview: updated?.lyrics_preview || lyricsPreview,
        source_run_id: updated?.source_run_id || sourceRunId,
        compute_units_estimate:
          Number(updated?.compute_units_estimate || 0) || computeUnitsEstimate,
        compute_cost_cents_estimate:
          Number(updated?.compute_cost_cents_estimate || 0) ||
          computeCostCentsEstimate,
        suggested_listen_price_cents:
          Number(updated?.suggested_listen_price_cents || 0) ||
          suggestedListenPriceCents,
        suggested_buyout_price_cents:
          Number(updated?.suggested_buyout_price_cents || 0) ||
          suggestedBuyoutPriceCents,
        cover_image: updated?.cover_image || persistedAssets.coverImage,
        preview_image_url:
          updated?.preview_image_url || persistedAssets.previewImageUrl,
        // Phase C.3.b — owner-only endpoint, sign "full".
        preview_video_url: signArtifactUrl(workId, previewVideoReference.previewVideoUrl, "full"),
        preview_video_asset_key: previewVideoReference.previewVideoAssetKey,
        root_work_id: existing.root_work_id || workId,
        parent_work_id: existing.parent_work_id || null,
      }),
    );
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "WORK_GENERATION_UPDATE_FAILED" });
  }
});

app.patch("/api/works/:id/pricing", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const workId = String(req.params.id || "").trim();
    let listenPriceCents = Number.parseInt(
      String(req.body?.listen_price_cents || "0"),
      10,
    );
    let buyoutPriceCents = Number.parseInt(
      String(req.body?.buyout_price_cents || "0"),
      10,
    );
    let buyoutEnabled =
      Boolean(req.body?.buyout_enabled) && buyoutPriceCents > 0;
    const requestedVisibility = String(req.body?.visibility || "")
      .trim()
      .toLowerCase();
    const visibility = requestedVisibility === "private" ? "private" : "public";
    const workStatus = visibility === "private" ? "hidden" : "published";
    const requestedWorkType =
      req.body && Object.prototype.hasOwnProperty.call(req.body, "work_type")
        ? normalizeWorkType(req.body?.work_type)
        : null;
    if (!workId) {
      return res.status(400).json({ ok: false, code: "WORK_REQUIRED" });
    }
    // CSSOS_PHASE2_NO_JUDGE_AS_PLAYER 20260501 #266 — Jing
    // Admin-owned works are always free to listen/watch and cannot be
    // bought out ("Priceless"). Override whatever the request body
    // claimed BEFORE running the > 0 listen-price validation, so admins
    // can submit a pricing update without tripping INVALID_LISTEN_PRICE.
    const isAdminOwner = isCssosAdminEmail(user.email);
    if (isAdminOwner) {
      listenPriceCents = 0;
      buyoutPriceCents = 0;
      buyoutEnabled = false;
    }
    // Listen price validation: > 0 for normal users, exactly 0 for admins.
    if (
      !isAdminOwner &&
      (!Number.isFinite(listenPriceCents) || listenPriceCents <= 0)
    ) {
      return res.status(400).json({ ok: false, code: "INVALID_LISTEN_PRICE" });
    }
    if (buyoutPriceCents < 0 || !Number.isFinite(buyoutPriceCents)) {
      return res.status(400).json({ ok: false, code: "INVALID_BUYOUT_PRICE" });
    }
    const ownerCheck = await withClient((client) =>
      client.query<{
        id: string;
        work_type: string | null;
        parent_work_id: string | null;
        root_work_id: string | null;
      }>(
        `SELECT id, work_type, parent_work_id, root_work_id
         FROM user_works
         WHERE id = $1 AND user_id = $2
         LIMIT 1`,
        [workId, user.id],
      ),
    );
    if (!ownerCheck.rows[0]?.id) {
      return res.status(404).json({ ok: false, code: "WORK_NOT_FOUND" });
    }
    const storedWork = ownerCheck.rows[0];
    const effectiveWorkType =
      requestedWorkType || normalizeWorkType(storedWork?.work_type);
    const isWholeBuyoutRoot =
      !storedWork?.parent_work_id &&
      (effectiveWorkType === "opera" || effectiveWorkType === "triptych");
    await withClient(async (client) => {
      if (requestedWorkType) {
        await client.query(
          `UPDATE user_works
           SET work_type = $2,
               structure_role = CASE WHEN parent_work_id IS NULL THEN $2 ELSE structure_role END,
               updated_at = now()
           WHERE id = $1`,
          [workId, requestedWorkType],
        );
      }
      await client.query(
        `UPDATE user_works SET status = $2, updated_at = now() WHERE id = $1`,
        [workId, workStatus],
      );
      await client.query(
        `INSERT INTO work_market_profiles (
           work_id, owner_user_id, current_listen_price_cents, current_buyout_price_cents,
           tips_enabled, buyout_enabled, visibility, rights_scope
         ) VALUES ($1, $2, $3, $4, true, $5, $6, 'personal_use')
         ON CONFLICT (work_id)
         DO UPDATE SET
           current_listen_price_cents = EXCLUDED.current_listen_price_cents,
           current_buyout_price_cents = EXCLUDED.current_buyout_price_cents,
           buyout_enabled = EXCLUDED.buyout_enabled,
           visibility = EXCLUDED.visibility,
           updated_at = now()`,
        [
          workId,
          user.id,
          listenPriceCents,
          buyoutPriceCents > 0 ? buyoutPriceCents : null,
          buyoutEnabled,
          visibility,
        ],
      );
      await client.query(
        `INSERT INTO work_access_products (work_id, owner_user_id, product_kind, currency, amount_cents, active, meta)
         VALUES ($1, $2, 'listen', 'USD', $3, true, $4::jsonb)
         ON CONFLICT (work_id, product_kind)
         DO UPDATE SET amount_cents = EXCLUDED.amount_cents, active = true, updated_at = now()`,
        [
          workId,
          user.id,
          listenPriceCents,
          JSON.stringify({
            updated_by: "pricing_patch",
            work_type: requestedWorkType || undefined,
          }),
        ],
      );
      await client.query(
        `INSERT INTO work_access_products (work_id, owner_user_id, product_kind, currency, amount_cents, active, meta)
         VALUES ($1, $2, 'buyout', 'USD', $3, $4, $5::jsonb)
         ON CONFLICT (work_id, product_kind)
         DO UPDATE SET amount_cents = EXCLUDED.amount_cents, active = EXCLUDED.active, updated_at = now()`,
        [
          workId,
          user.id,
          buyoutPriceCents > 0 ? buyoutPriceCents : defaultBuyoutPriceCents(),
          buyoutEnabled,
          JSON.stringify({
            updated_by: "pricing_patch",
            work_type: requestedWorkType || undefined,
          }),
        ],
      );
      if (isWholeBuyoutRoot) {
        await client.query(
          `UPDATE work_market_profiles
           SET current_buyout_price_cents = $2,
               buyout_enabled = false,
               updated_at = now()
           WHERE work_id IN (
             SELECT id FROM user_works WHERE root_work_id = $1 AND id <> $1
           )`,
          [workId, buyoutPriceCents > 0 ? buyoutPriceCents : null],
        );
        await client.query(
          `INSERT INTO work_access_products (work_id, owner_user_id, product_kind, currency, amount_cents, active, meta)
           SELECT id, $2, 'buyout', 'USD', $3, false, $4::jsonb
           FROM user_works
           WHERE root_work_id = $1 AND id <> $1
           ON CONFLICT (work_id, product_kind)
           DO UPDATE SET
             amount_cents = EXCLUDED.amount_cents,
             active = false,
             updated_at = now()`,
          [
            workId,
            user.id,
            buyoutPriceCents > 0 ? buyoutPriceCents : defaultBuyoutPriceCents(),
            JSON.stringify({
              updated_by: "pricing_patch",
              whole_buyout_parent_id: workId,
              work_type: effectiveWorkType,
            }),
          ],
        );
      }
    });
    return res.json(
      okData({
        work_id: workId,
        work_type: effectiveWorkType,
        current_listen_price_cents: listenPriceCents,
        current_buyout_price_cents:
          buyoutPriceCents > 0 ? buyoutPriceCents : null,
        buyout_enabled: buyoutEnabled,
        visibility,
        status: workStatus,
      }),
    );
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "WORK_PRICING_UPDATE_FAILED" });
  }
});

app.patch("/api/works/:id/structure-plan", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const workId = String(req.params.id || "").trim();
    const structurePlan = normalizeSongSeedStructurePlan(
      req.body?.structure_plan,
    );
    if (!workId) {
      return res.status(400).json({ ok: false, code: "WORK_REQUIRED" });
    }
    if (!structurePlan) {
      return res
        .status(400)
        .json({ ok: false, code: "STRUCTURE_PLAN_REQUIRED" });
    }
    const ownerCheck = await withClient((client) =>
      client.query<{ id: string }>(
        `SELECT id FROM user_works WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [workId, user.id],
      ),
    );
    if (!ownerCheck.rows[0]?.id) {
      return res.status(404).json({ ok: false, code: "WORK_NOT_FOUND" });
    }
    await withClient((client) =>
      client.query(
        `UPDATE user_works
         SET structure_plan = $2::jsonb,
             updated_at = now()
         WHERE id = $1`,
        [workId, JSON.stringify(structurePlan)],
      ),
    );
    return res.json(okData({ id: workId, structure_plan: structurePlan }));
  } catch {
    return res
      .status(500)
      .json({ ok: false, code: "WORK_STRUCTURE_PLAN_FAILED" });
  }
});

app.get("/api/auth/providers", (_req, res) => {
  noStore(res);
  const providers = providerConfig();
  const hasEnabled = providers.some((p) => p.enabled);
  if (!hasEnabled) {
    return res.json(okEmpty({ providers }, "No data yet"));
  }
  return res.json(okData({ providers }));
});

app.get("/auth/apple", async (req, res) => {
  noStore(res);
  try {
    const clientId = process.env.APPLE_CLIENT_ID || "";
    if (!clientId) return res.status(503).send("apple_not_configured");
    const state = crypto.randomBytes(16).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");
    (req.session as any).apple_oauth_state = state;
    (req.session as any).apple_oauth_nonce = nonce;

    const redirectUri = `${appBaseUrl(req)}/auth/apple/callback`;
    const q = new URLSearchParams({
      response_type: "code",
      response_mode: "form_post",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "name email",
      state,
      nonce,
    });
    return res.redirect(
      302,
      `https://appleid.apple.com/auth/authorize?${q.toString()}`,
    );
  } catch {
    return res.status(500).send("apple_auth_start_failed");
  }
});

async function handleAppleCallback(
  req: express.Request,
  res: express.Response,
) {
  noStore(res);
  try {
    const code = String((req.body as any)?.code || req.query.code || "");
    const state = String((req.body as any)?.state || req.query.state || "");
    const savedState = String((req.session as any).apple_oauth_state || "");
    const savedNonce = String((req.session as any).apple_oauth_nonce || "");
    (req.session as any).apple_oauth_state = null;
    (req.session as any).apple_oauth_nonce = null;
    if (!code || !state || !savedState || state !== savedState) {
      auditAuthFailure("apple", "oauth", "INVALID_STATE_OR_CODE");
      return res.status(400).send("auth_failed");
    }

    const clientId = process.env.APPLE_CLIENT_ID || "";
    const redirectUri = `${appBaseUrl(req)}/auth/apple/callback`;
    const clientSecret = await appleClientSecret();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tkRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const tk = (await tkRes.json().catch(() => null)) as any;
    if (!tkRes.ok || !tk?.id_token) {
      auditAuthFailure("apple", "oauth", "TOKEN_EXCHANGE_FAILED");
      return res.status(400).send("auth_failed");
    }

    const payload = await verifyAppleIdToken(String(tk.id_token));
    const sub = String(payload.sub || "");
    if (!sub) {
      auditAuthFailure("apple", "oauth", "SUB_MISSING");
      return res.status(400).send("auth_failed");
    }
    if (savedNonce && payload.nonce && String(payload.nonce) !== savedNonce) {
      auditAuthFailure("apple", "oauth", "NONCE_MISMATCH");
      return res.status(400).send("auth_failed");
    }
    const email = payload.email ? String(payload.email) : null;
    const userId = await upsertOAuthIdentity({
      provider: "apple",
      providerUserId: sub,
      email,
      displayName: null,
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    setAuthSession(req, userId, "apple");
    return res.redirect(302, "/");
  } catch (err) {
    auditAuthFailure("apple", "oauth", "INTERNAL_ERROR");
    console.error("apple_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
}

app.get("/auth/apple/callback", handleAppleCallback);
app.post("/auth/apple/callback", handleAppleCallback);

app.get("/api/auth/apple", (_req, res) => {
  res.redirect(302, "/auth/apple");
});

app.get("/api/auth/apple/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/apple/callback${q}`);
});
app.post("/api/auth/apple/callback", (req, res) => {
  res.redirect(307, "/auth/apple/callback");
});

function oauthCallbackUrl(req: express.Request, providerId: string) {
  const normalized = String(providerId || "")
    .trim()
    .toLowerCase();
  const envKey = `${envUpper(normalized)}_REDIRECT_URI`;
  const envValue = String(process.env[envKey] || "").trim();
  if (envValue) return envValue;
  return `${appBaseUrl(req)}/api/auth/${normalized}/callback`;
}

app.get("/auth/google", async (req, res) => {
  noStore(res);
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    if (!clientId || !clientSecret)
      return res.status(503).send("google_not_configured");
    const state = randomHex(16);
    const nonce = randomHex(16);
    setOAuthState(req, "google", { state, nonce, createdAt: Date.now() });
    const redirectUri = oauthCallbackUrl(req, "google");
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      prompt: "select_account",
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
    if (req.query.debug === "1") {
      return res.json({
        ok: true,
        provider: "google",
        redirect_uri: redirectUri,
        auth_url: authUrl,
      });
    }
    return res.redirect(302, authUrl);
  } catch {
    return res.status(500).send("google_auth_start_failed");
  }
});

app.get("/auth/google/callback", async (req, res) => {
  noStore(res);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const savedLogin = getOAuthState(req, "google");
    const savedYoutube = savedLogin ? null : getOAuthState(req, "google_youtube");
    if (!code || (!savedLogin && !savedYoutube)) {
      auditAuthFailure("google", "oauth", "INVALID_STATE_OR_CODE");
      return res.status(400).send("auth_failed");
    }
    const saved =
      savedLogin && savedLogin.state === state ? savedLogin : null;
    const savedYouTubeState =
      !saved && savedYoutube && savedYoutube.state === state ? savedYoutube : null;
    if (!saved && !savedYouTubeState) {
      auditAuthFailure("google", "oauth", "INVALID_STATE_OR_CODE");
      return res.status(400).send("auth_failed");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const redirectUri = oauthCallbackUrl(req, "google");
    const tk = await oauthExchangeTokenForm(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    );
    const accessToken = String(tk.json?.access_token || "");
    const refreshToken = String(tk.json?.refresh_token || "");
    const idToken = String(tk.json?.id_token || "");
    const expiresIn = Number(tk.json?.expires_in || 0);
    const scope = String(tk.json?.scope || "");
    if (!accessToken && !idToken) {
      auditAuthFailure("google", "oauth", "TOKEN_MISSING");
      return res.status(400).send("auth_failed");
    }

    let sub = "";
    let email: string | null = null;
    let picture: string | null = null;
    if (idToken) {
      const googleJwks = createRemoteJWKSet(
        new URL("https://www.googleapis.com/oauth2/v3/certs"),
      );
      const { payload } = await jwtVerify(idToken, googleJwks, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: clientId,
      });
      sub = String(payload.sub || "");
      email = payload.email ? String(payload.email) : null;
      // CSSOS_PHASE2_OAUTH_AVATAR 20260501 #250 — Google ID token
      // includes a `picture` claim with HTTPS URL to the user's
      // Google profile photo. Capture it for avatar_url storage.
      picture = (payload as any)?.picture ? String((payload as any).picture) : null;
    } else {
      const me = await fetchJson(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      sub = String(me.json?.sub || "");
      email = me.json?.email ? String(me.json.email) : null;
      picture = me.json?.picture ? String(me.json.picture) : null;
    }
    if (!sub) {
      auditAuthFailure("google", "oauth", "SUB_MISSING");
      return res.status(400).send("auth_failed");
    }

    if (savedYouTubeState) {
      await upsertOAuthToken({
        userId: savedYouTubeState.userId as string,
        provider: "google_youtube",
        providerUserId: sub,
        accessToken,
        refreshToken,
        scope,
        expiresInSeconds: Number.isFinite(expiresIn) ? expiresIn : null,
      });
      return res.redirect(302, "/?oauth=google_youtube_ok");
    }

    const userId = await upsertOAuthIdentity({
      provider: "google",
      providerUserId: sub,
      email,
      displayName: null,
      avatarUrl: picture,
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    setAuthSession(req, userId, "google");
    return res.redirect(302, "/");
  } catch (err) {
    auditAuthFailure("google", "oauth", "INTERNAL_ERROR");
    console.error("google_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
});

app.get("/auth/google/youtube", async (req, res) => {
  noStore(res);
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const sessionUserId = (req.session as any)?.user_id as string | undefined;
    if (!clientId || !clientSecret)
      return res.status(503).send("google_not_configured");
    if (req.query.debug === "1") {
      const redirectUri = oauthCallbackUrl(req, "google");
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope:
          "openid email profile https://www.googleapis.com/auth/youtube.readonly",
        state: "debug",
        nonce: "debug",
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent select_account",
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
      return res.json({
        ok: true,
        provider: "google_youtube",
        redirect_uri: redirectUri,
        auth_url: authUrl,
      });
    }
    if (!sessionUserId) return res.status(401).send("login_required");
    const state = randomHex(16);
    const nonce = randomHex(16);
    setOAuthState(req, "google_youtube", {
      state,
      nonce,
      userId: sessionUserId,
      createdAt: Date.now(),
    });
    const redirectUri = oauthCallbackUrl(req, "google");
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope:
        "openid email profile https://www.googleapis.com/auth/youtube.readonly",
      state,
      nonce,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent select_account",
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
    if (req.query.debug === "1") {
      return res.json({
        ok: true,
        provider: "google_youtube",
        redirect_uri: redirectUri,
        auth_url: authUrl,
      });
    }
    return res.redirect(302, authUrl);
  } catch {
    return res.status(500).send("google_auth_start_failed");
  }
});

app.get("/auth/google/youtube/callback", async (req, res) => {
  noStore(res);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const saved = getOAuthState(req, "google_youtube");
    if (!code || !saved || saved.state !== state || !saved.userId) {
      auditAuthFailure("google_youtube", "oauth", "INVALID_STATE_OR_CODE");
      return res.status(400).send("auth_failed");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const redirectUri = oauthCallbackUrl(req, "google");
    const tk = await oauthExchangeTokenForm(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    );
    const accessToken = String(tk.json?.access_token || "");
    const refreshToken = String(tk.json?.refresh_token || "");
    const idToken = String(tk.json?.id_token || "");
    const expiresIn = Number(tk.json?.expires_in || 0);
    const scope = String(tk.json?.scope || "");
    if (!accessToken && !idToken) {
      auditAuthFailure("google_youtube", "oauth", "TOKEN_MISSING");
      return res.status(400).send("auth_failed");
    }

    let sub = "";
    let email: string | null = null;
    if (idToken) {
      const googleJwks = createRemoteJWKSet(
        new URL("https://www.googleapis.com/oauth2/v3/certs"),
      );
      const { payload } = await jwtVerify(idToken, googleJwks, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: clientId,
      });
      sub = String(payload.sub || "");
      email = payload.email ? String(payload.email) : null;
    } else {
      const me = await fetchJson(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      sub = String(me.json?.sub || "");
      email = me.json?.email ? String(me.json.email) : null;
    }
    if (!sub) {
      auditAuthFailure("google_youtube", "oauth", "SUB_MISSING");
      return res.status(400).send("auth_failed");
    }

    await upsertOAuthToken({
      userId: saved.userId,
      provider: "google_youtube",
      providerUserId: sub,
      accessToken,
      refreshToken,
      scope,
      expiresInSeconds: Number.isFinite(expiresIn) ? expiresIn : null,
    });

    return res.redirect(302, "/?oauth=google_youtube_ok");
  } catch (err) {
    auditAuthFailure("google_youtube", "oauth", "INTERNAL_ERROR");
    console.error("google_youtube_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
});

app.get("/auth/github/callback", async (req, res) => {
  noStore(res);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const saved = getOAuthState(req, "github");
    if (!code || !saved || saved.state !== state) {
      auditAuthFailure("github", "oauth", "INVALID_STATE_OR_CODE");
      return res.status(400).send("auth_failed");
    }

    const clientId = process.env.GITHUB_CLIENT_ID || "";
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
    const tk = await oauthExchangeTokenForm(
      "https://github.com/login/oauth/access_token",
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    );
    const accessToken = String(tk.json?.access_token || "");
    if (!accessToken) {
      auditAuthFailure("github", "oauth", "TOKEN_MISSING");
      return res.status(400).send("auth_failed");
    }

    const me = await fetchJson("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    const emails = await fetchJson("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    const sub = String(me.json?.id || "");
    let email: string | null = me.json?.email ? String(me.json.email) : null;
    if (!email && Array.isArray(emails.json)) {
      const primary =
        emails.json.find((x: any) => x && x.primary && x.verified) ||
        emails.json.find((x: any) => x && x.verified) ||
        emails.json[0];
      email = primary?.email ? String(primary.email) : null;
    }
    if (!sub) {
      auditAuthFailure("github", "oauth", "SUB_MISSING");
      return res.status(400).send("auth_failed");
    }

    const userId = await upsertOAuthIdentity({
      provider: "github",
      providerUserId: sub,
      email,
      displayName: me.json?.name ? String(me.json.name) : null,
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    setAuthSession(req, userId, "github");
    return res.redirect(302, "/");
  } catch (err) {
    auditAuthFailure("github", "oauth", "INTERNAL_ERROR");
    console.error("github_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
});

app.get("/auth/x", async (req, res) => {
  noStore(res);
  try {
    const clientId = process.env.X_CLIENT_ID || "";
    const clientSecret = process.env.X_CLIENT_SECRET || "";
    if (!clientId || !clientSecret)
      return res.status(503).send("x_not_configured");
    if (req.query.debug === "1") {
      const redirectUri = oauthCallbackUrl(req, "x");
      const q = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "tweet.read users.read offline.access",
        state: "debug",
        code_challenge: "debug",
        code_challenge_method: "S256",
      });
      const authUrl = `https://twitter.com/i/oauth2/authorize?${q.toString()}`;
      return res.json({
        ok: true,
        provider: "x",
        redirect_uri: redirectUri,
        auth_url: authUrl,
      });
    }
    const state = randomHex(16);
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = codeChallengeS256(verifier);
    setOAuthState(req, "x", {
      state,
      codeVerifier: verifier,
      createdAt: Date.now(),
    });
    const redirectUri = oauthCallbackUrl(req, "x");
    const q = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "tweet.read users.read offline.access",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return res.redirect(
      302,
      `https://twitter.com/i/oauth2/authorize?${q.toString()}`,
    );
  } catch {
    return res.status(500).send("x_auth_start_failed");
  }
});

app.get("/auth/x/callback", async (req, res) => {
  noStore(res);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const saved = getOAuthState(req, "x");
    if (!code || !saved || !saved.codeVerifier || saved.state !== state) {
      auditAuthFailure("x", "oauth", "INVALID_STATE_OR_CODE");
      return res.status(400).send("auth_failed");
    }

    const clientId = process.env.X_CLIENT_ID || "";
    const clientSecret = process.env.X_CLIENT_SECRET || "";
    const redirectUri = oauthCallbackUrl(req, "x");
    let tk = await oauthExchangeTokenForm(
      "https://api.x.com/2/oauth2/token",
      new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: saved.codeVerifier,
      }),
    );
    let accessToken = String(tk.json?.access_token || "");

    if (!accessToken) {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      );
      const tkRes = await fetch("https://api.x.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`,
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code_verifier: saved.codeVerifier,
        }).toString(),
      });
      tk = {
        ok: tkRes.ok,
        status: tkRes.status,
        json: await tkRes.json().catch(() => null),
      };
      accessToken = String(tk.json?.access_token || "");
    }
    if (!accessToken) {
      console.warn("x_auth_token_missing", {
        status: tk.status,
        body: tk.json,
      });
      auditAuthFailure("x", "oauth", "TOKEN_MISSING");
      return res.status(400).send("auth_failed");
    }

    let me = await fetchJson(
      "https://api.x.com/2/users/me?user.fields=id,name,username",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    let sub = String(
      me.json?.data?.id ||
        me.json?.id ||
        me.json?.sub ||
        me.json?.data?.sub ||
        "",
    ).trim();
    if (!sub) {
      const fallback = await fetchJson(
        "https://api.twitter.com/2/users/me?user.fields=id,name,username",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (fallback.ok) {
        me = fallback;
        sub = String(
          me.json?.data?.id ||
            me.json?.id ||
            me.json?.sub ||
            me.json?.data?.sub ||
            "",
        ).trim();
      }
    }
    if (!sub) {
      console.warn("x_auth_missing_sub", {
        status: me.status,
        body: me.json,
      });
      auditAuthFailure("x", "oauth", "SUB_MISSING");
      return res.status(400).send("auth_failed");
    }
    const userId = await upsertOAuthIdentity({
      provider: "x",
      providerUserId: sub,
      email: null,
      displayName: me.json?.data?.name ? String(me.json.data.name) : null,
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    setAuthSession(req, userId, "x");
    return res.redirect(302, "/");
  } catch (err) {
    auditAuthFailure("x", "oauth", "INTERNAL_ERROR");
    console.error("x_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
});

app.get("/auth/facebook", async (req, res) => {
  noStore(res);
  try {
    const clientId = process.env.FACEBOOK_CLIENT_ID || "";
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || "";
    if (!clientId || !clientSecret)
      return res.status(503).send("facebook_not_configured");
    if (req.query.debug === "1") {
      const redirectUri = oauthCallbackUrl(req, "facebook");
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state: "debug",
        scope: "email,public_profile",
      });
      const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${q.toString()}`;
      return res.json({
        ok: true,
        provider: "facebook",
        redirect_uri: redirectUri,
        auth_url: authUrl,
      });
    }
    const state = randomHex(16);
    setOAuthState(req, "facebook", { state, createdAt: Date.now() });
    const redirectUri = oauthCallbackUrl(req, "facebook");
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: "email,public_profile",
    });
    return res.redirect(
      302,
      `https://www.facebook.com/v19.0/dialog/oauth?${q.toString()}`,
    );
  } catch {
    return res.status(500).send("facebook_auth_start_failed");
  }
});

app.get("/auth/facebook/callback", async (req, res) => {
  noStore(res);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const saved = getOAuthState(req, "facebook");
    if (!code || !saved || saved.state !== state) {
      auditAuthFailure("facebook", "oauth", "INVALID_STATE_OR_CODE");
      return res.status(400).send("auth_failed");
    }

    const clientId = process.env.FACEBOOK_CLIENT_ID || "";
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || "";
    const redirectUri = oauthCallbackUrl(req, "facebook");
    const tk = await fetchJson(
      `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams(
        {
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        },
      ).toString()}`,
    );
    const accessToken = String(tk.json?.access_token || "");
    if (!accessToken) {
      auditAuthFailure("facebook", "oauth", "TOKEN_MISSING");
      return res.status(400).send("auth_failed");
    }
    const me = await fetchJson(
      `https://graph.facebook.com/me?${new URLSearchParams({
        fields: "id,name,email",
        access_token: accessToken,
      }).toString()}`,
    );
    const sub = String(me.json?.id || "");
    const email = me.json?.email ? String(me.json.email) : null;
    if (!sub) {
      auditAuthFailure("facebook", "oauth", "SUB_MISSING");
      return res.status(400).send("auth_failed");
    }
    const userId = await upsertOAuthIdentity({
      provider: "facebook",
      providerUserId: sub,
      email,
      displayName: me.json?.name ? String(me.json.name) : null,
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    setAuthSession(req, userId, "facebook");
    return res.redirect(302, "/");
  } catch (err) {
    auditAuthFailure("facebook", "oauth", "INTERNAL_ERROR");
    console.error("facebook_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
});

app.get("/auth/wechat", async (req, res) => {
  noStore(res);
  try {
    const appid = process.env.WECHAT_CLIENT_ID || "";
    const secret = process.env.WECHAT_CLIENT_SECRET || "";
    if (!appid || !secret) return res.status(503).send("wechat_not_configured");
    if (req.query.debug === "1") {
      const redirectUri = oauthCallbackUrl(req, "wechat");
      const url = `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(appid)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login&state=debug#wechat_redirect`;
      return res.json({
        ok: true,
        provider: "wechat",
        redirect_uri: redirectUri,
        auth_url: url,
      });
    }
    const state = randomHex(8);
    setOAuthState(req, "wechat", { state, createdAt: Date.now() });
    const redirectUri = oauthCallbackUrl(req, "wechat");
    const url = `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(appid)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login&state=${encodeURIComponent(state)}#wechat_redirect`;
    return res.redirect(302, url);
  } catch {
    return res.status(500).send("wechat_auth_start_failed");
  }
});

app.get("/auth/weixin", (_req, res) => res.redirect(302, "/auth/wechat"));

app.get("/auth/wechat/callback", async (req, res) => {
  noStore(res);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const saved = getOAuthState(req, "wechat");
    if (!code || !saved || saved.state !== state) {
      auditAuthFailure("wechat", "oauth", "INVALID_STATE_OR_CODE");
      return res.status(400).send("auth_failed");
    }
    const appid = process.env.WECHAT_CLIENT_ID || "";
    const secret = process.env.WECHAT_CLIENT_SECRET || "";
    const tk = await fetchJson(
      `https://api.weixin.qq.com/sns/oauth2/access_token?${new URLSearchParams({
        appid,
        secret,
        code,
        grant_type: "authorization_code",
      }).toString()}`,
    );
    const openid = String(tk.json?.openid || "");
    const accessToken = String(tk.json?.access_token || "");
    const unionid = tk.json?.unionid ? String(tk.json.unionid) : "";
    if (!openid || !accessToken) {
      auditAuthFailure("wechat", "oauth", "TOKEN_OR_OPENID_MISSING");
      return res.status(400).send("auth_failed");
    }
    const me = await fetchJson(
      `https://api.weixin.qq.com/sns/userinfo?${new URLSearchParams({
        access_token: accessToken,
        openid,
      }).toString()}`,
    );
    const sub = unionid || openid;
    const userId = await upsertOAuthIdentity({
      provider: "wechat",
      providerUserId: sub,
      email: null,
      displayName: me.json?.nickname ? String(me.json.nickname) : null,
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    setAuthSession(req, userId, "wechat");
    return res.redirect(302, "/");
  } catch (err) {
    auditAuthFailure("wechat", "oauth", "INTERNAL_ERROR");
    console.error("wechat_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
});

app.get("/auth/weixin/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/wechat/callback${q}`);
});

app.get("/auth/bsky", async (req, res) => {
  noStore(res);
  try {
    const clientId =
      process.env.BSKY_CLIENT_ID || process.env.BLUESKY_CLIENT_ID || "";
    const clientSecret =
      process.env.BSKY_CLIENT_SECRET || process.env.BLUESKY_CLIENT_SECRET || "";
    if (clientId && clientSecret) {
      const state = randomHex(16);
      const verifier = b64url(crypto.randomBytes(32));
      const challenge = codeChallengeS256(verifier);
      setOAuthState(req, "bsky", {
        state,
        codeVerifier: verifier,
        createdAt: Date.now(),
      });
      const redirectUri = `${appBaseUrl(req)}/auth/bsky/callback`;
      const q = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "atproto transition:generic",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      return res.redirect(
        302,
        `https://bsky.social/oauth/authorize?${q.toString()}`,
      );
    }
    const handle = process.env.BLUESKY_HANDLE || "";
    const appPassword = process.env.BLUESKY_APP_PASSWORD || "";
    if (!handle || !appPassword) {
      auditAuthFailure("bsky", "app_password", "NOT_CONFIGURED");
      return res.status(503).send("bsky_not_configured");
    }
    const sess = await fetch(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: handle, password: appPassword }),
      },
    );
    if (!sess.ok) {
      auditAuthFailure("bsky", "app_password", "SESSION_CREATE_FAILED");
      return res.status(400).send("auth_failed");
    }
    const js = (await sess.json().catch(() => null)) as any;
    const did = String(js?.did || "");
    const email = js?.email ? String(js.email) : null;
    const displayName = js?.handle ? String(js.handle) : handle;
    if (!did) {
      auditAuthFailure("bsky", "app_password", "DID_MISSING");
      return res.status(400).send("auth_failed");
    }
    const userId = await upsertOAuthIdentity({
      provider: "bsky",
      providerUserId: did,
      email,
      displayName,
    });
    auditAuthLogin(req, "bsky", userId, "app_password");
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    setAuthSession(req, userId, "bsky");
    return res.redirect(302, "/");
  } catch {
    auditAuthFailure("bsky", "app_password", "INTERNAL_ERROR");
    return res.status(500).send("bsky_auth_start_failed");
  }
});

app.get("/auth/bsky/callback", async (req, res) => {
  noStore(res);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const saved = getOAuthState(req, "bsky");
    if (!code || !saved || !saved.codeVerifier || saved.state !== state) {
      auditAuthFailure("bsky", "oauth", "INVALID_STATE_OR_CODE");
      return res.status(400).send("auth_failed");
    }
    const clientId =
      process.env.BSKY_CLIENT_ID || process.env.BLUESKY_CLIENT_ID || "";
    const clientSecret =
      process.env.BSKY_CLIENT_SECRET || process.env.BLUESKY_CLIENT_SECRET || "";
    const redirectUri = `${appBaseUrl(req)}/auth/bsky/callback`;
    const tkRes = await fetch("https://bsky.social/oauth/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: saved.codeVerifier,
      }).toString(),
    });
    const tk = (await tkRes.json().catch(() => null)) as any;
    const sub = String(tk?.sub || tk?.did || "");
    const email = tk?.email ? String(tk.email) : null;
    if (!sub) {
      auditAuthFailure("bsky", "oauth", "SUB_MISSING");
      return res.status(400).send("auth_failed");
    }
    const userId = await upsertOAuthIdentity({
      provider: "bsky",
      providerUserId: sub,
      email,
      displayName: null,
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    setAuthSession(req, userId, "bsky");
    return res.redirect(302, "/");
  } catch (err) {
    auditAuthFailure("bsky", "oauth", "INTERNAL_ERROR");
    console.error("bsky_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
});

app.get("/api/auth/google", (_req, res) => res.redirect(302, "/auth/google"));
app.get("/api/auth/google/youtube", (_req, res) =>
  res.redirect(302, "/auth/google/youtube"),
);
app.get("/api/auth/x", (_req, res) => res.redirect(302, "/auth/x"));
app.get("/api/auth/facebook", (_req, res) =>
  res.redirect(302, "/auth/facebook"),
);
app.get("/api/auth/wechat", (_req, res) => res.redirect(302, "/auth/wechat"));
app.get("/api/auth/weixin", (_req, res) => res.redirect(302, "/auth/wechat"));
app.get("/api/auth/bsky", (_req, res) => res.redirect(302, "/auth/bsky"));
app.get("/api/auth/google/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/google/callback${q}`);
});
app.get("/api/auth/google/youtube/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/google/youtube/callback${q}`);
});
app.get("/api/auth/google_youtube/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/google/callback${q}`);
});
app.get("/api/auth/x/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/x/callback${q}`);
});
app.get("/api/auth/facebook/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/facebook/callback${q}`);
});
app.get("/api/auth/wechat/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/wechat/callback${q}`);
});
app.get("/api/auth/weixin/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/wechat/callback${q}`);
});

const genericProviders = [
  "tiktok",
  "discord",
  "linkedin",
  "microsoft",
  "slack",
  "reddit",
  "twitch",
  "spotify",
  "gitlab",
  "bitbucket",
  "line",
  "kakao",
  "weibo",
  "qq",
  "douyin",
  "notion",
  "dropbox",
];

for (const pid of genericProviders) {
  app.get(`/auth/${pid}`, async (req, res) => {
    noStore(res);
    try {
      const spec = genericProviderSpec(pid);
      if (!spec) {
        auditAuthFailure(pid, "oauth", "NOT_CONFIGURED");
        return res.status(503).send("provider_not_configured");
      }
      const state = randomHex(16);
      const verifier = b64url(crypto.randomBytes(32));
      const challenge = codeChallengeS256(verifier);
      setOAuthState(req, pid, {
        state,
        codeVerifier: verifier,
        createdAt: Date.now(),
      });
      const key = envUpper(pid);
      const clientId = process.env[`${key}_CLIENT_ID`] || "";
      const redirectUri = oauthCallbackUrl(req, pid);
      const clientParam = pid === "tiktok" ? "client_key" : "client_id";
      const q = new URLSearchParams({
        response_type: "code",
        [clientParam]: clientId,
        redirect_uri: redirectUri,
        scope: spec.scopes.join(" "),
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      return res.redirect(302, `${spec.authUrl}?${q.toString()}`);
    } catch {
      auditAuthFailure(pid, "oauth", "INTERNAL_ERROR");
      return res.status(500).send("auth_start_failed");
    }
  });

  app.get(`/auth/${pid}/callback`, async (req, res) => {
    noStore(res);
    try {
      const spec = genericProviderSpec(pid);
      if (!spec) {
        auditAuthFailure(pid, "oauth", "NOT_CONFIGURED");
        return res.status(503).send("provider_not_configured");
      }
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      const saved = getOAuthState(req, pid);
      if (!code || !saved || !saved.codeVerifier || saved.state !== state) {
        auditAuthFailure(pid, "oauth", "INVALID_STATE_OR_CODE");
        return res.status(400).send("auth_failed");
      }
      const key = envUpper(pid);
      const clientId = process.env[`${key}_CLIENT_ID`] || "";
      const clientSecret = process.env[`${key}_CLIENT_SECRET`] || "";
      const redirectUri = oauthCallbackUrl(req, pid);
      const tk = await oauthExchangeTokenForm(
        spec.tokenUrl,
        new URLSearchParams({
          code,
          grant_type: "authorization_code",
          ...(pid === "tiktok"
            ? { client_key: clientId, client_secret: clientSecret }
            : { client_id: clientId, client_secret: clientSecret }),
          redirect_uri: redirectUri,
          code_verifier: saved.codeVerifier,
        }),
      );
      const accessToken = String(
        tk.json?.access_token || tk.json?.data?.access_token || "",
      );
      if (!accessToken) {
        auditAuthFailure(pid, "oauth", "TOKEN_MISSING");
        return res.status(400).send("auth_failed");
      }
      const userInfoUrl =
        pid === "tiktok"
          ? `${spec.userInfoUrl}?fields=open_id,union_id,display_name,avatar_url`
          : spec.userInfoUrl;
      const me = await fetchJson(userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      });
      const sub = pickFirstByKeys(me.json, spec.idKeys || ["sub", "id"]);
      const email =
        pickFirstByKeys(me.json, spec.emailKeys || ["email"]) || null;
      const displayName =
        pickFirstByKeys(me.json, spec.nameKeys || ["name"]) || null;
      // CSSOS_PHASE2_OAUTH_AVATAR 20260501 #250 — Jing
      // "请改进社交平台登录面板，必须获取用户在该社交平台的头像."
      // Pull whichever picture/avatar field this provider exposes.
      // TikTok/Douyin: avatar_url (and avatar_large_url as upgrade).
      // GitHub: avatar_url. Discord: avatar (a hash, needs format).
      // Falls back to spec.avatarKeys if the provider config supplies
      // a custom list, or generic ["avatar_url", "picture", "photo"].
      const avatarKeys = (spec as any).avatarKeys || [
        "avatar_large_url", "avatar_url", "picture", "photo", "profile_image_url",
      ];
      const avatarUrl = pickFirstByKeys(me.json, avatarKeys) || null;
      if (!sub) {
        auditAuthFailure(pid, "oauth", "SUB_MISSING");
        return res.status(400).send("auth_failed");
      }
      const userId = await upsertOAuthIdentity({
        provider: pid,
        providerUserId: sub,
        email,
        displayName,
        avatarUrl,
      });
      await migrateGuestPasskeysToUser(req.sessionID, userId);
      setAuthSession(req, userId, pid);
      return res.redirect(302, "/");
    } catch {
      auditAuthFailure(pid, "oauth", "INTERNAL_ERROR");
      return res.status(400).send("auth_failed");
    }
  });

  app.get(`/api/auth/${pid}`, (_req, res) => res.redirect(302, `/auth/${pid}`));
  app.get(`/api/auth/${pid}/callback`, (req, res) => {
    const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(302, `/auth/${pid}/callback${q}`);
  });
}

app.post("/api/auth/logout", (req, res) => {
  noStore(res);
  if (req.session) {
    req.session.destroy(() => {
      res.clearCookie(process.env.SESSION_COOKIE || "cssos_session");
      res.json(okData({ loggedOut: true }));
    });
    return;
  }
  res.json(okData({ loggedOut: true }));
});

app.get("/api/auth/passkey/register/options", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    return res.json(await buildPasskeyRegisterOptions(req));
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_REGISTER_OPTIONS_FAILED" });
  }
});

app.post("/api/auth/passkey/register/options", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    return res.json(await buildPasskeyRegisterOptions(req));
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_REGISTER_OPTIONS_FAILED" });
  }
});

app.post("/api/auth/passkey/register/verify", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    const user = await getSessionUser(req);
    const subject = passkeySubject(req, user);
    const st = passkeyState.get(subject.key);
    if (!st || st.kind !== "register" || st.expireAt <= Date.now()) {
      return res.status(400).json({ code: "PASSKEY_STATE_MISSING" });
    }
    const credential = req.body?.credential;
    const credId = credential?.id;
    if (!credential || !credId || typeof credId !== "string") {
      return res.status(400).json({ code: "PASSKEY_CRED_INVALID" });
    }
    const transports = Array.isArray(credential?.response?.transports)
      ? credential.response.transports.filter(
          (x: unknown): x is string => typeof x === "string",
        )
      : ["internal"];
    await savePasskeyCred(subject.key, credId, transports);
    passkeyState.delete(subject.key);
    return res.json({ ok: true, enabled: true });
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_REGISTER_VERIFY_FAILED" });
  }
});

app.get("/api/auth/passkey/login/options", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    return res.json(await buildPasskeyLoginOptions(req));
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_LOGIN_OPTIONS_FAILED" });
  }
});

app.post("/api/auth/passkey/login/options", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    return res.json(await buildPasskeyLoginOptions(req));
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_LOGIN_OPTIONS_FAILED" });
  }
});

app.post("/api/auth/passkey/login/verify", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    const user = await getSessionUser(req);
    const subject = passkeySubject(req, user);
    const st = passkeyState.get(subject.key);
    if (!st || st.kind !== "login" || st.expireAt <= Date.now()) {
      return res.status(400).json({ code: "PASSKEY_STATE_MISSING" });
    }
    const credential = req.body?.credential;
    const credId = credential?.id;
    if (!credential || !credId || typeof credId !== "string") {
      return res.status(400).json({ code: "PASSKEY_CRED_INVALID" });
    }
    const list = await listPasskeyCreds(subject.key);
    if (!list.some((x) => x.id === credId)) {
      return res.status(400).json({ code: "PASSKEY_CRED_NOT_FOUND" });
    }
    passkeyState.delete(subject.key);
    return res.json({ ok: true, verified: true });
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_LOGIN_VERIFY_FAILED" });
  }
});

app.get("/api/billing/status", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json(okEmpty({ authenticated: false }, "No data yet"));
    }
    const access = await resolveUserAccessProfile(user);
    if (access.tier === "admin" || access.tier === "vip") {
      return res.json(
        okData({
          authenticated: true,
          tier: access.tier,
          currency: "USD",
          balance_cents: null,
          monthly_limit_cents: null,
          month_spent_cents: 0,
          auto_recharge: null,
          remaining: null,
          limit: null,
        }),
      );
    }
    await resetMonthIfNeeded(user.id);
    const created = !access.billingAccount;
    const account =
      access.billingAccount || (await ensureBillingAccount(user.id)).account;
    const data = {
      authenticated: true,
      tier: access.tier,
      currency: account.currency,
      balance_cents: Number(account.balance_cents),
      monthly_limit_cents: Number(account.monthly_limit_cents),
      month_spent_cents: Number(account.month_spent_cents),
      auto_recharge: {
        enabled: account.auto_recharge_enabled,
        threshold_cents: Number(account.auto_recharge_threshold_cents),
        amount_cents: Number(account.auto_recharge_amount_cents),
      },
    };
    if (created && data.balance_cents === 0) {
      return res.json(okEmpty(data, "No data yet"));
    }
    return res.json(okData(data));
  } catch (_err) {
    return res.json(okEmpty({ authenticated: false }, "No data yet"));
  }
});

app.get("/api/billing/usage", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json(
        okEmpty({ authenticated: false, events: [] }, "No data yet"),
      );
    }
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const result: QueryResult<any> = await withClient((client) =>
      client.query(
        "SELECT * FROM usage_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        [user.id, limit],
      ),
    );
    if (!result.rows.length) {
      return res.json(
        okEmpty({ authenticated: true, events: [] }, "No data yet"),
      );
    }
    return res.json(okData({ authenticated: true, events: result.rows }));
  } catch (_err) {
    return res.json(
      okEmpty({ authenticated: false, events: [] }, "No data yet"),
    );
  }
});

app.get("/api/billing/ledger", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json(
        okEmpty({ authenticated: false, entries: [] }, "No data yet"),
      );
    }
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const result: QueryResult<any> = await withClient((client) =>
      client.query(
        "SELECT * FROM ledger_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        [user.id, limit],
      ),
    );
    if (!result.rows.length) {
      return res.json(
        okEmpty({ authenticated: true, entries: [] }, "No data yet"),
      );
    }
    return res.json(okData({ authenticated: true, entries: result.rows }));
  } catch (_err) {
    return res.json(
      okEmpty({ authenticated: false, entries: [] }, "No data yet"),
    );
  }
});

app.get("/api/cssmv/commerce", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json(
        okEmpty(
          {
            authenticated: false,
            permission_snapshot: buildPermissionSnapshot("guest", "guest"),
          },
          "No data yet",
        ),
      );
    }
    const access = await resolveUserAccessProfile(user);
    const permissionSnapshot = buildPermissionSnapshot(
      access.tier,
      access.role,
    );
    let accountData: Record<string, unknown>;
    if (access.tier === "admin" || access.tier === "vip") {
      accountData = {
        tier: access.tier,
        currency: "USD",
        balance_cents: null,
        monthly_limit_cents: null,
        month_spent_cents: 0,
        auto_recharge: null,
      };
    } else {
      await resetMonthIfNeeded(user.id);
      const account =
        access.billingAccount || (await ensureBillingAccount(user.id)).account;
      accountData = {
        tier: access.tier,
        currency: account.currency,
        balance_cents: Number(account.balance_cents),
        monthly_limit_cents: Number(account.monthly_limit_cents),
        month_spent_cents: Number(account.month_spent_cents),
        auto_recharge: {
          enabled: account.auto_recharge_enabled,
          threshold_cents: Number(account.auto_recharge_threshold_cents),
          amount_cents: Number(account.auto_recharge_amount_cents),
        },
      };
    }

    const [
      ledgerRes,
      usageRes,
      worksRes,
      orderRes,
      tipRes,
      transferRes,
      marketRes,
      entitlementsRes,
      boostOrdersRes,
      creatorCommerce,
      billableActions,
      studioWorkspace,
      studioEnterprise,
      cinemaBookings,
    ] = await Promise.all([
      withClient((client) =>
        client.query(
          "SELECT * FROM ledger_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
          [user.id],
        ),
      ),
      withClient((client) =>
        client.query(
          "SELECT * FROM usage_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
          [user.id],
        ),
      ),
      withClient((client) =>
        client.query(
          `SELECT id, title, style, lyrics_preview, status, created_at, updated_at
           FROM user_works
           WHERE user_id = $1
           ORDER BY created_at DESC
          LIMIT 8`,
          [user.id],
        ),
      ),
      withClient((client) =>
        client.query(
          `SELECT id, work_id, buyer_user_id, seller_user_id, order_kind, status, currency,
                  gross_amount_cents, seller_net_cents, created_at, updated_at, meta
           FROM work_orders
           WHERE buyer_user_id = $1 OR seller_user_id = $1
           ORDER BY created_at DESC
           LIMIT 12`,
          [user.id],
        ),
      ),
      withClient((client) =>
        client.query(
          `SELECT id, work_id, tipper_user_id, owner_user_id, currency, amount_cents, message, created_at, meta
           FROM work_tips
           WHERE owner_user_id = $1 OR tipper_user_id = $1
           ORDER BY created_at DESC
           LIMIT 12`,
          [user.id],
        ),
      ),
      withClient((client) =>
        client.query(
          `SELECT id, work_id, from_user_id, to_user_id, transfer_kind, currency,
                  transfer_amount_cents, effective_at, created_at, meta
           FROM ownership_transfers
           WHERE from_user_id = $1 OR to_user_id = $1
           ORDER BY effective_at DESC, created_at DESC
           LIMIT 12`,
          [user.id],
        ),
      ),
      withClient((client) =>
        client.query(
          `SELECT id, work_id, owner_user_id, current_listen_price_cents, current_buyout_price_cents,
                  tips_enabled, buyout_enabled, visibility, rights_scope, updated_at
           FROM work_market_profiles
           WHERE owner_user_id = $1
           ORDER BY updated_at DESC
          LIMIT 12`,
          [user.id],
        ),
      ),
      withClient((client) =>
        client.query(
          `SELECT id, entitlement_key, quantity, consumed_quantity, source, source_order_id, expires_at, meta, created_at, updated_at
           FROM account_entitlements
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 24`,
          [user.id],
        ),
      ),
      withClient((client) =>
        client.query(
          `SELECT id, boost_kind, quantity, unit_amount_cents, gross_amount_cents, currency, status,
                  stripe_checkout_session_id, stripe_payment_intent_id, paid_at, canceled_at, meta, created_at, updated_at
           FROM creator_boost_orders
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 12`,
          [user.id],
        ),
      ),
      getCreatorCommercePolicySettings(),
      getBillingActionPolicySettings(),
      ensureStudioWorkspaceForUser({
        userId: user.id,
        email: user.email,
        displayName: user.display_name,
        tier: access.tier,
      }),
      getStudioEnterprisePolicySettings(),
      listCinemaBookingRequests(user.id, 12),
    ]);
    const boostEntitlements = summarizeBoostEntitlements(entitlementsRes.rows);
    const enterpriseApiUsage =
      canUseEnterpriseApiTier(access.tier) &&
      studioEnterprise.enterpriseApiEnabled
        ? await listEnterpriseApiUsageSnapshot({
            userId: user.id,
            rpm: studioEnterprise.enterpriseApiRateLimitPerMinute,
          }).catch(() => null)
        : null;

    return res.json(
      okData({
        authenticated: true,
        profile: {
          id: user.id,
          email: user.email,
          name: user.display_name,
          avatar: user.avatar_url,
          role: access.role,
          tier: access.tier,
          membership_policy: access.policy,
          queue_lane: queueLaneForTier(access.tier),
        },
        account: accountData,
        ledger_entries: ledgerRes.rows,
        usage_events: usageRes.rows,
        entitlements: entitlementsRes.rows,
        creator_boost: {
          config: creatorCommerce,
          entitlements: boostEntitlements,
          orders: boostOrdersRes.rows,
        },
        cinema_bookings: cinemaBookings,
        billable_actions: billableActions,
        studio: {
          settings: studioEnterprise,
          workspace: studioWorkspace?.workspace || null,
          members: studioWorkspace?.members || [],
          projects: studioWorkspace?.projects || [],
          can_collaborate: !!studioWorkspace?.canCollaborate,
          can_create_projects: !!studioWorkspace?.canCreateProjects,
        },
        enterprise_api: canUseEnterpriseApiTier(access.tier)
          ? {
              enabled: studioEnterprise.enterpriseApiEnabled,
              queue_lane: queueLaneForTier(access.tier),
              usage: enterpriseApiUsage,
            }
          : null,
        permission_snapshot: permissionSnapshot,
        market: {
          profiles: marketRes.rows,
          orders: orderRes.rows,
          tips: tipRes.rows,
          ownership_transfers: transferRes.rows,
        },
        ownership: {
          works_count: worksRes.rows.length,
          works: worksRes.rows,
        },
      }),
    );
  } catch (_err) {
    return res.json(
      okEmpty(
        {
          authenticated: false,
          permission_snapshot: buildPermissionSnapshot("guest", "guest"),
        },
        "No data yet",
      ),
    );
  }
});

app.get("/api/cssmv/boosts", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      const config = await getCreatorCommercePolicySettings();
      return res.json(
        okData({
          authenticated: false,
          config,
          entitlements: summarizeBoostEntitlements([]),
          orders: [],
        }),
      );
    }
    const [config, entitlements, orders] = await Promise.all([
      getCreatorCommercePolicySettings(),
      listActiveEntitlements(user.id),
      withClient((client) =>
        client.query(
          `SELECT id, boost_kind, quantity, unit_amount_cents, gross_amount_cents, currency, status, paid_at, canceled_at, meta, created_at, updated_at
           FROM creator_boost_orders
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 12`,
          [user.id],
        ),
      ),
    ]);
    return res.json(
      okData({
        authenticated: true,
        config,
        entitlements: summarizeBoostEntitlements(entitlements),
        entitlement_rows: entitlements,
        orders: orders.rows,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "CREATOR_BOOSTS_LOAD_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/cssmv/boosts/consume", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const boostKind = normalizeCreatorBoostKind(req.body?.boost_kind);
    const quantity = Math.max(1, Math.min(20, Number(req.body?.quantity || 1)));
    if (!boostKind) {
      return res.status(400).json({ ok: false, code: "BOOST_KIND_INVALID" });
    }
    const result = await consumeCreatorBoostEntitlement({
      userId: user.id,
      boostKind,
      quantity,
      reason: String(req.body?.reason || "creation_run"),
      meta:
        req.body?.meta && typeof req.body.meta === "object"
          ? req.body.meta
          : {},
    });
    if (!result.ok) {
      return res.status(409).json({
        ok: false,
        code: "BOOST_ENTITLEMENT_INSUFFICIENT",
        data: result,
      });
    }
    return res.json(okData(result));
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "CREATOR_BOOSTS_CONSUME_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/cssmv/boosts/checkout/create", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ ok: false, code: "STRIPE_NOT_CONFIGURED" });
    }
    const boostKind = normalizeCreatorBoostKind(req.body?.boost_kind);
    const quantity = Math.max(1, Math.min(20, Number(req.body?.quantity || 1)));
    if (!boostKind) {
      return res.status(400).json({ ok: false, code: "BOOST_KIND_INVALID" });
    }
    const policy = await getCreatorCommercePolicySettings();
    if (!policy.enabledKinds.includes(boostKind)) {
      return res.status(403).json({ ok: false, code: "BOOST_KIND_DISABLED" });
    }
    if (
      policy.adminOnlyPurchaseOverride &&
      roleForEmail(user.email) !== "admin"
    ) {
      return res
        .status(403)
        .json({ ok: false, code: "BOOST_PURCHASE_ADMIN_ONLY" });
    }
    const unitAmountCents =
      boostKind === "language"
        ? policy.languageBoostUnitCents
        : boostKind === "voice"
          ? policy.voiceBoostUnitCents
          : boostKind === "thumbnail"
            ? policy.thumbnailBoostUnitCents
            : boostKind === "preview_video"
              ? policy.previewVideoBoostUnitCents
              : boostKind === "background_job"
                ? policy.backgroundJobBoostUnitCents
                : policy.generationBoostUnitCents;
    const customer = await ensureStripeCustomer({
      userId: user.id,
      email: normalizeEmail(user.email),
      name: user.display_name,
    });
    const orderId = await createCreatorBoostOrder({
      userId: user.id,
      boostKind,
      quantity,
      unitAmountCents,
      currency: "USD",
      meta: {
        requested_from: String(req.body?.requested_from || "advanced_settings"),
        creation_snapshot:
          req.body?.creation_snapshot &&
          typeof req.body.creation_snapshot === "object"
            ? req.body.creation_snapshot
            : {},
      },
    });
    if (!orderId) {
      return res
        .status(500)
        .json({ ok: false, code: "BOOST_ORDER_CREATE_FAILED" });
    }
    const successUrl = String(
      req.body?.success_url ||
        process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
        `${appBaseUrl(req)}/`,
    ).trim();
    const cancelUrl = String(
      req.body?.cancel_url ||
        process.env.STRIPE_CHECKOUT_CANCEL_URL ||
        `${appBaseUrl(req)}/`,
    ).trim();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: String(customer?.stripe_customer_id || ""),
      success_url: appendQueryToUrl(successUrl, {
        stripe_checkout: "success",
        creator_boost_order_id: orderId,
      }),
      cancel_url: appendQueryToUrl(cancelUrl, {
        stripe_checkout: "cancel",
        creator_boost_order_id: orderId,
      }),
      client_reference_id: orderId,
      payment_intent_data: {
        metadata: {
          creator_boost_order_id: orderId,
          boost_kind: boostKind,
          buyer_user_id: user.id,
        },
      },
      metadata: {
        creator_boost_order_id: orderId,
        boost_kind: boostKind,
        buyer_user_id: user.id,
      },
      line_items: [
        {
          quantity,
          price_data: {
            currency: "usd",
            unit_amount: unitAmountCents,
            product_data: {
              name:
                boostKind === "language"
                  ? "Creator Boost: Extra Language"
                  : boostKind === "voice"
                    ? "Creator Boost: Extra Voice Lane"
                    : boostKind === "thumbnail"
                      ? "Creator Boost: Thumbnail Regeneration"
                      : boostKind === "preview_video"
                        ? "Creator Boost: Preview Video Regeneration"
                        : boostKind === "background_job"
                          ? "Creator Boost: Background Queue Slot"
                          : "Creator Boost: Extra Generation",
              metadata: {
                creator_boost_order_id: orderId,
                boost_kind: boostKind,
              },
            },
          },
        },
      ],
    });
    await updateCreatorBoostOrderStripeRefs({
      orderId,
      checkoutSessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
      metaPatch: { checkout_url_created: true },
    });
    return res.json(
      okData({
        order_id: orderId,
        checkout_session_id: session.id,
        checkout_url: session.url,
        boost_kind: boostKind,
        quantity,
        unit_amount_cents: unitAmountCents,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "CREATOR_BOOST_CHECKOUT_CREATE_FAILED",
      message: String(err),
    });
  }
});

// P2-25b: subscription checkout for membership tier upgrade
// Lets a user upgrade from free/starter/etc. by paying via Stripe Checkout (subscription mode).
// On success, the webhook handler (processStripeWebhookEvent) flips billing_accounts.membership_tier.
app.post("/api/billing/membership/change", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const targetTier = normalizeMembershipTier(req.body?.target_tier);
    if (
      targetTier !== "starter" &&
      targetTier !== "pro" &&
      targetTier !== "studio" &&
      targetTier !== "enterprise" &&
      targetTier !== "free"
    ) {
      return res.status(400).json({ ok: false, code: "TARGET_TIER_INVALID" });
    }
    const access = await resolveUserAccessProfile(user);
    if (access.tier === "admin" || access.tier === "vip") {
      // Admin/VIP don't need self-serve subscription.
      return res.json(
        okData({
          tier: access.tier,
          previous_tier: access.tier,
          change_kind: "noop",
          message: "Account tier managed manually.",
        }),
      );
    }
    const currentTier = access.tier;
    if (currentTier === targetTier) {
      return res.json(
        okData({
          tier: targetTier,
          previous_tier: currentTier,
          change_kind: "noop",
        }),
      );
    }
    // Tier → monthly price (cents). Matches rust-api/src/billing.rs membership_tier_plan.
    const tierPriceCents: Record<string, number> = {
      free: 0,
      starter: 1500,
      pro: 3900,
      studio: 12900,
      enterprise: 39900,
    };
    const tierDisplayName: Record<string, string> = {
      free: "Free",
      starter: "Starter",
      pro: "Pro",
      studio: "Studio",
      enterprise: "Enterprise",
    };
    const targetPriceCents = tierPriceCents[targetTier] ?? 0;
    const currentPriceCents = tierPriceCents[currentTier] ?? 0;
    // Downgrade: no payment needed — flip tier immediately.
    if (targetPriceCents < currentPriceCents || targetTier === "free") {
      await ensureBillingAccount(user.id);
      await withClient((client) =>
        client.query(
          `UPDATE billing_accounts
           SET membership_tier = $2,
               membership_source = 'self_serve_downgrade',
               membership_updated_at = now(),
               updated_at = now()
           WHERE user_id = $1`,
          [user.id, targetTier],
        ),
      );
      return res.json(
        okData({
          tier: targetTier,
          previous_tier: currentTier,
          change_kind: "downgrade",
          message: `Downgraded to ${tierDisplayName[targetTier]}.`,
        }),
      );
    }
    // Upgrade path → Stripe Checkout (subscription mode).
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ ok: false, code: "STRIPE_NOT_CONFIGURED" });
    }
    const priceCents = targetPriceCents;
    if (!(priceCents > 0)) {
      return res.status(400).json({ ok: false, code: "TARGET_TIER_INVALID" });
    }
    const customer = await ensureStripeCustomer({
      userId: user.id,
      email: normalizeEmail(user.email),
      name: user.display_name,
    });
    const successUrl = String(
      req.body?.success_url ||
        process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
        `${appBaseUrl(req)}/`,
    ).trim();
    const cancelUrl = String(
      req.body?.cancel_url ||
        process.env.STRIPE_CHECKOUT_CANCEL_URL ||
        `${appBaseUrl(req)}/`,
    ).trim();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: String(customer?.stripe_customer_id || ""),
      success_url: appendQueryToUrl(successUrl, {
        stripe_checkout: "success",
        membership_tier: targetTier,
      }),
      cancel_url: appendQueryToUrl(cancelUrl, {
        stripe_checkout: "cancel",
        membership_tier: targetTier,
      }),
      client_reference_id: user.id,
      subscription_data: {
        metadata: {
          membership_tier: targetTier,
          previous_tier: currentTier,
          buyer_user_id: user.id,
        },
      },
      metadata: {
        membership_tier: targetTier,
        previous_tier: currentTier,
        buyer_user_id: user.id,
        change_kind: "subscription_upgrade",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            recurring: { interval: "month" },
            product_data: {
              name: `cssstudio ${tierDisplayName[targetTier]} — Monthly`,
              metadata: {
                membership_tier: targetTier,
              },
            },
          },
        },
      ],
    });
    return res.json(
      okData({
        tier: targetTier,
        previous_tier: currentTier,
        change_kind: "subscription_upgrade",
        checkout_url: session.url,
        checkout_session_id: session.id,
        price_cents: priceCents,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "MEMBERSHIP_CHANGE_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/admin/membership/set", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user || roleForEmail(user.email) !== "admin") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN" });
    }
    const targetEmail = normalizeEmail(String(req.body?.email || ""));
    const targetTier = normalizeMembershipTier(req.body?.tier);
    if (!targetEmail) {
      return res.status(400).json({ ok: false, code: "TARGET_EMAIL_REQUIRED" });
    }
    if (targetTier === "guest") {
      return res.status(400).json({ ok: false, code: "TARGET_TIER_INVALID" });
    }
    const found = await withClient((client) =>
      client.query<{ id: string; email: string | null }>(
        "SELECT id, email FROM users WHERE lower(email) = lower($1) LIMIT 1",
        [targetEmail],
      ),
    );
    const targetUserId = String(found.rows[0]?.id || "").trim();
    if (!targetUserId) {
      return res.status(404).json({ ok: false, code: "TARGET_USER_NOT_FOUND" });
    }
    await ensureBillingAccount(targetUserId);
    await withClient((client) =>
      client.query(
        `UPDATE billing_accounts
         SET membership_tier = $2,
             membership_source = 'admin_manual',
             membership_updated_at = now(),
             updated_at = now()
         WHERE user_id = $1`,
        [targetUserId, targetTier],
      ),
    );
    await appendAdminUserAction({
      userId: targetUserId,
      targetEmail,
      actionKind: "membership_set",
      actionScope: "membership",
      actorUserId: user.id,
      actorEmail: user.email,
      note: `tier -> ${targetTier}`,
      meta: { tier: targetTier },
    });
    return res.json(
      okData({
        user_id: targetUserId,
        email: targetEmail,
        tier: targetTier,
        updated: true,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "ADMIN_MEMBERSHIP_SET_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/admin/entitlements/grant", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user || roleForEmail(user.email) !== "admin") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN" });
    }
    const targetEmail = normalizeEmail(String(req.body?.email || ""));
    const boostKind = normalizeCreatorBoostKind(req.body?.boost_kind);
    const quantity = Math.max(
      1,
      Math.min(200, Number(req.body?.quantity || 1)),
    );
    if (!targetEmail) {
      return res.status(400).json({ ok: false, code: "TARGET_EMAIL_REQUIRED" });
    }
    if (!boostKind) {
      return res.status(400).json({ ok: false, code: "BOOST_KIND_INVALID" });
    }
    const found = await withClient((client) =>
      client.query<{ id: string }>(
        "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
        [targetEmail],
      ),
    );
    const targetUserId = String(found.rows[0]?.id || "").trim();
    if (!targetUserId) {
      return res.status(404).json({ ok: false, code: "TARGET_USER_NOT_FOUND" });
    }
    await withClient((client) =>
      client.query(
        `INSERT INTO account_entitlements (
           user_id, entitlement_key, quantity, consumed_quantity, source, created_by_user_id, meta
         ) VALUES ($1, $2, $3, 0, 'admin_grant', $4, $5::jsonb)`,
        [
          targetUserId,
          `boost.${boostKind}`,
          quantity,
          user.id,
          JSON.stringify({
            granted_by_email: normalizeEmail(user.email),
            note: String(req.body?.note || "").slice(0, 240),
          }),
        ],
      ),
    );
    await appendAdminUserAction({
      userId: targetUserId,
      targetEmail,
      actionKind: "entitlement_grant",
      actionScope: "reward",
      quantity,
      actorUserId: user.id,
      actorEmail: user.email,
      note: String(req.body?.note || ""),
      meta: { boost_kind: boostKind },
    });
    return res.json(
      okData({
        user_id: targetUserId,
        email: targetEmail,
        boost_kind: boostKind,
        quantity,
        granted: true,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "ADMIN_ENTITLEMENT_GRANT_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/admin/entitlements/revoke", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user || roleForEmail(user.email) !== "admin") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN" });
    }
    const targetEmail = normalizeEmail(String(req.body?.email || ""));
    const boostKind = normalizeCreatorBoostKind(req.body?.boost_kind);
    const quantity = Math.max(
      1,
      Math.min(200, Number(req.body?.quantity || 1)),
    );
    if (!targetEmail) {
      return res.status(400).json({ ok: false, code: "TARGET_EMAIL_REQUIRED" });
    }
    if (!boostKind) {
      return res.status(400).json({ ok: false, code: "BOOST_KIND_INVALID" });
    }
    const found = await withClient((client) =>
      client.query<{ id: string }>(
        "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
        [targetEmail],
      ),
    );
    const targetUserId = String(found.rows[0]?.id || "").trim();
    if (!targetUserId) {
      return res.status(404).json({ ok: false, code: "TARGET_USER_NOT_FOUND" });
    }
    let remaining = quantity;
    await withClient(async (client) => {
      const rows = await client.query(
        `SELECT id, quantity, consumed_quantity
         FROM account_entitlements
         WHERE user_id = $1
           AND entitlement_key = $2
           AND quantity > consumed_quantity
           AND (expires_at IS NULL OR expires_at > now())
         ORDER BY created_at DESC
         FOR UPDATE`,
        [targetUserId, `boost.${boostKind}`],
      );
      for (const row of rows.rows) {
        if (remaining <= 0) break;
        const available = Math.max(
          0,
          Number(row.quantity || 0) - Number(row.consumed_quantity || 0),
        );
        if (!available) continue;
        const revokeNow = Math.min(remaining, available);
        await client.query(
          `UPDATE account_entitlements
           SET consumed_quantity = consumed_quantity + $2,
               meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('last_revoked_by_email', $3, 'last_revoked_at', now()::text),
               updated_at = now()
           WHERE id = $1`,
          [row.id, revokeNow, normalizeEmail(user.email)],
        );
        remaining -= revokeNow;
      }
    });
    const revoked = quantity - remaining;
    await appendAdminUserAction({
      userId: targetUserId,
      targetEmail,
      actionKind: "entitlement_revoke",
      actionScope: revoked > 0 ? "penalty" : "notice",
      quantity: revoked,
      actorUserId: user.id,
      actorEmail: user.email,
      note:
        revoked > 0
          ? `revoked ${revoked} ${boostKind}`
          : `no revoke available for ${boostKind}`,
      meta: {
        boost_kind: boostKind,
        requested_quantity: quantity,
        revoked_quantity: revoked,
      },
    });
    return res.json(
      okData({
        user_id: targetUserId,
        email: targetEmail,
        boost_kind: boostKind,
        requested_quantity: quantity,
        revoked_quantity: revoked,
        revoked: revoked > 0,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "ADMIN_ENTITLEMENT_REVOKE_FAILED",
      message: String(err),
    });
  }
});

app.get("/api/admin/users/search", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user || roleForEmail(user.email) !== "admin") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN" });
    }
    const q = String(req.query?.q || "")
      .trim()
      .toLowerCase();
    if (!q) {
      return res.json(okData({ users: [] }));
    }
    const like = `%${q}%`;
    const rows = await withClient((client) =>
      client.query(
        `SELECT u.id,
                u.email,
                u.display_name,
                COALESCE(ba.membership_tier, 'free') AS tier
           FROM users u
           LEFT JOIN billing_accounts ba ON ba.user_id = u.id
          WHERE lower(COALESCE(u.email, '')) LIKE $1
             OR lower(COALESCE(u.display_name, '')) LIKE $1
             OR CAST(u.id AS text) = $2
          ORDER BY u.created_at DESC
          LIMIT 20`,
        [like, q],
      ),
    );
    return res.json(
      okData({
        users: rows.rows.map((row) => ({
          id: String(row.id || ""),
          email: String(row.email || ""),
          display_name: String(row.display_name || ""),
          tier: normalizeMembershipTier(row.tier || "free"),
        })),
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "ADMIN_USER_SEARCH_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/admin/users/freeze", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user || roleForEmail(user.email) !== "admin") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN" });
    }
    const targetEmail = normalizeEmail(String(req.body?.email || ""));
    const reason = String(req.body?.reason || req.body?.note || "")
      .trim()
      .slice(0, 500);
    if (!targetEmail) {
      return res.status(400).json({ ok: false, code: "TARGET_EMAIL_REQUIRED" });
    }
    const found = await withClient((client) =>
      client.query<{ id: string }>(
        "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
        [targetEmail],
      ),
    );
    const targetUserId = String(found.rows[0]?.id || "").trim();
    if (!targetUserId) {
      return res.status(404).json({ ok: false, code: "TARGET_USER_NOT_FOUND" });
    }
    await ensureBillingAccount(targetUserId);
    await withClient(async (client) => {
      await client.query(
        `UPDATE billing_accounts
            SET membership_tier = 'free',
                membership_source = 'admin_freeze',
                membership_updated_at = now(),
                updated_at = now()
          WHERE user_id = $1`,
        [targetUserId],
      );
    });
    const actionId = await appendAdminUserAction({
      userId: targetUserId,
      targetEmail,
      actionKind: "freeze_user",
      actionScope: "freeze",
      actorUserId: user.id,
      actorEmail: user.email,
      note: reason || "freeze requested by admin",
      meta: { frozen: true, enforced_membership_tier: "free" },
    });
    return res.json(
      okData({
        user_id: targetUserId,
        email: targetEmail,
        frozen: true,
        downgraded_tier: "free",
        audit_action_id: actionId,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "ADMIN_USER_FREEZE_FAILED",
      message: String(err),
    });
  }
});

app.get("/api/admin/users/actions", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user || roleForEmail(user.email) !== "admin") {
      return res.status(403).json({ ok: false, code: "FORBIDDEN" });
    }
    const email = normalizeEmail(
      String(req.query?.email || req.query?.q || ""),
    );
    const limit = Math.max(
      1,
      Math.min(100, Number(req.query?.limit || 40) || 40),
    );
    if (!email) {
      return res.json(okData({ actions: [] }));
    }
    const actions = await listAdminUserActions(email, limit);
    return res.json(
      okData({
        actions: actions.map((row: any) => ({
          action_id: String(row.action_id || ""),
          user_id: String(row.user_id || ""),
          target_email: String(row.target_email || ""),
          action_kind: String(row.action_kind || ""),
          action_scope: String(row.action_scope || ""),
          quantity: Number(row.quantity || 0),
          actor_user_id: String(row.actor_user_id || ""),
          actor_email: String(row.actor_email || ""),
          note: String(row.note || ""),
          meta: row.meta && typeof row.meta === "object" ? row.meta : {},
          created_at: String(row.created_at || ""),
        })),
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "ADMIN_USER_ACTIONS_FAILED",
      message: String(err),
    });
  }
});

app.get("/api/studio/workspace", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const access = await resolveUserAccessProfile(user);
    if (!canUseStudioWorkspaceTier(access.tier)) {
      return res
        .status(403)
        .json({ ok: false, code: "STUDIO_WORKSPACE_FORBIDDEN" });
    }
    const workspace = await ensureStudioWorkspaceForUser({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      tier: access.tier,
    });
    return res.json(
      okData({
        workspace: workspace?.workspace || null,
        members: workspace?.members || [],
        projects: workspace?.projects || [],
        policy:
          workspace?.policy || (await getStudioEnterprisePolicySettings()),
        queue_lane: queueLaneForTier(access.tier),
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "STUDIO_WORKSPACE_LOAD_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/studio/workspace/members", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const access = await resolveUserAccessProfile(user);
    const settings = await getStudioEnterprisePolicySettings();
    if (
      !canUseStudioWorkspaceTier(access.tier) ||
      !settings.teamCollaborationEnabled
    ) {
      return res
        .status(403)
        .json({ ok: false, code: "TEAM_COLLABORATION_DISABLED" });
    }
    const workspaceBundle = await ensureStudioWorkspaceForUser({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      tier: access.tier,
    });
    const workspaceId = String(workspaceBundle?.workspace?.id || "").trim();
    if (!workspaceId) {
      return res.status(500).json({ ok: false, code: "WORKSPACE_UNAVAILABLE" });
    }
    if ((workspaceBundle?.members?.length || 0) >= settings.maxTeamMembers) {
      return res.status(409).json({
        ok: false,
        code: "TEAM_MEMBER_LIMIT_REACHED",
        data: { max_team_members: settings.maxTeamMembers },
      });
    }
    const email = normalizeEmail(String(req.body?.email || ""));
    const role = ["member", "manager"].includes(
      String(req.body?.role || "")
        .trim()
        .toLowerCase(),
    )
      ? String(req.body?.role || "")
          .trim()
          .toLowerCase()
      : "member";
    if (!email) {
      return res.status(400).json({ ok: false, code: "TARGET_EMAIL_REQUIRED" });
    }
    const found = await withClient((client) =>
      client.query<{
        id: string;
        email: string | null;
        display_name: string | null;
      }>(
        "SELECT id, email, display_name FROM users WHERE lower(email) = lower($1) LIMIT 1",
        [email],
      ),
    );
    const targetUser = found.rows[0];
    if (!targetUser?.id) {
      return res.status(404).json({ ok: false, code: "TARGET_USER_NOT_FOUND" });
    }
    await withClient((client) =>
      client.query(
        `INSERT INTO studio_workspace_members (
           workspace_id, user_id, role, invited_by_user_id, meta
         ) VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (workspace_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, invited_by_user_id = EXCLUDED.invited_by_user_id, updated_at = now()`,
        [
          workspaceId,
          targetUser.id,
          role,
          user.id,
          JSON.stringify({
            invited_by_email: normalizeEmail(user.email),
            invited_at: new Date().toISOString(),
          }),
        ],
      ),
    );
    const refreshed = await ensureStudioWorkspaceForUser({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      tier: access.tier,
    });
    return res.json(
      okData({
        invited: true,
        workspace: refreshed?.workspace || null,
        members: refreshed?.members || [],
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "STUDIO_MEMBER_ADD_FAILED",
      message: String(err),
    });
  }
});

app.get("/api/studio/projects", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const access = await resolveUserAccessProfile(user);
    if (!canUseStudioWorkspaceTier(access.tier)) {
      return res
        .status(403)
        .json({ ok: false, code: "STUDIO_PROJECTS_FORBIDDEN" });
    }
    const workspace = await ensureStudioWorkspaceForUser({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      tier: access.tier,
    });
    return res.json(
      okData({
        workspace: workspace?.workspace || null,
        projects: workspace?.projects || [],
        queue_lane: queueLaneForTier(access.tier),
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "STUDIO_PROJECTS_LOAD_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/studio/projects", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const access = await resolveUserAccessProfile(user);
    const settings = await getStudioEnterprisePolicySettings();
    if (
      !canUseStudioWorkspaceTier(access.tier) ||
      !settings.multiProjectEnabled
    ) {
      return res
        .status(403)
        .json({ ok: false, code: "MULTI_PROJECT_DISABLED" });
    }
    const title = String(req.body?.title || "")
      .trim()
      .slice(0, 120);
    if (!title) {
      return res
        .status(400)
        .json({ ok: false, code: "PROJECT_TITLE_REQUIRED" });
    }
    const workspaceBundle = await ensureStudioWorkspaceForUser({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      tier: access.tier,
    });
    const workspaceId = String(workspaceBundle?.workspace?.id || "").trim();
    if (!workspaceId) {
      return res.status(500).json({ ok: false, code: "WORKSPACE_UNAVAILABLE" });
    }
    if ((workspaceBundle?.projects?.length || 0) >= settings.maxProjects) {
      return res.status(409).json({
        ok: false,
        code: "PROJECT_LIMIT_REACHED",
        data: { max_projects: settings.maxProjects },
      });
    }
    const inserted = await withClient((client) =>
      client.query(
        `INSERT INTO studio_projects (
           workspace_id, owner_user_id, title, status, queue_lane, meta
         ) VALUES ($1, $2, $3, 'active', $4, $5::jsonb)
         RETURNING id, workspace_id, owner_user_id, title, status, queue_lane, meta, created_at, updated_at`,
        [
          workspaceId,
          user.id,
          title,
          queueLaneForTier(access.tier),
          JSON.stringify({
            created_via: String(req.body?.created_via || "profile_panel"),
            tier: access.tier,
          }),
        ],
      ),
    );
    return res.json(
      okData({
        created: true,
        project: inserted.rows[0],
        queue_lane: queueLaneForTier(access.tier),
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "STUDIO_PROJECT_CREATE_FAILED",
      message: String(err),
    });
  }
});

app.get("/api/enterprise/api-status", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const access = await resolveUserAccessProfile(user);
    const enforced = await enforceEnterpriseApiRoute({
      userId: user.id,
      email: user.email,
      tier: access.tier,
      route: "/api/enterprise/api-status",
    });
    if (!enforced.ok) {
      return res
        .status(enforced.code === "ENTERPRISE_API_RATE_LIMITED" ? 429 : 403)
        .json({
          ok: false,
          code: enforced.code,
          data: {
            queue_lane: queueLaneForTier(access.tier),
            usage: enforced.usage,
            settings: enforced.settings,
          },
        });
    }
    return res.json(
      okData({
        enabled: enforced.settings.enterpriseApiEnabled,
        queue_lane: queueLaneForTier(access.tier),
        usage: enforced.usage,
        rate_limit_per_minute:
          enforced.settings.enterpriseApiRateLimitPerMinute,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "ENTERPRISE_API_STATUS_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/stripe/customer/ensure", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    if (!stripeStep1Configured()) {
      return res.status(503).json({ ok: false, code: "STRIPE_NOT_CONFIGURED" });
    }
    const record = await ensureStripeCustomer({
      userId: user.id,
      email: normalizeEmail(user.email),
      name: user.display_name,
    });
    return res.json(
      okData({
        authenticated: true,
        configured: true,
        stripe_customer: record,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "STRIPE_CUSTOMER_ENSURE_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/stripe/checkout/create", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ ok: false, code: "STRIPE_NOT_CONFIGURED" });
    }
    const workId = String(req.body?.work_id || "").trim();
    const orderKind = String(req.body?.order_kind || "listen")
      .trim()
      .toLowerCase() as CommerceProductKind;
    const tipAmountCents = Math.round(Number(req.body?.tip_amount_cents || 0));
    if (!workId) {
      return res.status(400).json({ ok: false, code: "WORK_ID_REQUIRED" });
    }
    if (
      orderKind !== "listen" &&
      orderKind !== "buyout" &&
      orderKind !== "tip"
    ) {
      return res.status(400).json({ ok: false, code: "ORDER_KIND_INVALID" });
    }
    const commercePolicy = await getCommercePolicySettings();
    if (
      orderKind === "tip" &&
      (!Number.isFinite(tipAmountCents) ||
        tipAmountCents < commercePolicy.minTipCents)
    ) {
      return res.status(400).json({ ok: false, code: "TIP_AMOUNT_INVALID" });
    }
    const product = await resolveCommerceProduct({
      workId,
      orderKind,
      tipAmountCents,
    });
    if (product.ownerUserId === user.id) {
      return res
        .status(400)
        .json({ ok: false, code: "SELF_PURCHASE_NOT_ALLOWED" });
    }
    // CSSOS_PHASE2_NO_JUDGE_AS_PLAYER 20260501 #266 — Jing
    // "禁止去买断用户的作品.不能买卖自己的作品，也不能买卖用户的作品."
    // Staff (cssOS admins) already have free listen/watch privileges,
    // so allowing them to buy out user works would let them outbid
    // real customers and skim from the marketplace. Hard 403.
    if (isCssosAdminEmail(user.email)) {
      return res.status(403).json({
        ok: false,
        code: "ADMIN_CANNOT_PURCHASE",
        message:
          "cssOS staff accounts cannot purchase or buy out user works. " +
          "Use a separate non-staff account if you need to test the buyer flow.",
      });
    }
    const existingOrders = await findExistingBuyerWorkOrder({
      buyerUserId: user.id,
      workId,
    });
    const paidBuyout = existingOrders.find(
      (row) =>
        String(row.order_kind || "") === "buyout" &&
        String(row.status || "") === "paid",
    );
    if (paidBuyout) {
      return res.status(409).json({
        ok: false,
        code: "ORDER_ALREADY_OWNED_BUYOUT",
        order_id: paidBuyout.id,
      });
    }
    if (orderKind !== "tip") {
      const existingSameKind = existingOrders.find(
        (row) => String(row.order_kind || "") === orderKind,
      );
      if (
        existingSameKind &&
        ["pending", "processing"].includes(
          String(existingSameKind.status || ""),
        )
      ) {
        return res.status(409).json({
          ok: false,
          code: "ORDER_ALREADY_PENDING",
          order_id: existingSameKind.id,
        });
      }
      if (
        existingSameKind &&
        String(existingSameKind.status || "") === "paid"
      ) {
        return res.status(409).json({
          ok: false,
          code: "ORDER_ALREADY_PAID",
          order_id: existingSameKind.id,
        });
      }
      if (
        orderKind === "listen" &&
        existingOrders.some(
          (row) =>
            String(row.order_kind || "") === "buyout" &&
            ["pending", "processing"].includes(String(row.status || "")),
        )
      ) {
        return res.status(409).json({
          ok: false,
          code: "ORDER_BUYOUT_PENDING",
        });
      }
    }
    const customer = await ensureStripeCustomer({
      userId: user.id,
      email: normalizeEmail(user.email),
      name: user.display_name,
    });
    const grossAmountCents = Number(product.amountCents);
    const platformFeeCents = computePlatformFeeCents(grossAmountCents);
    const sellerNetCents = Math.max(0, grossAmountCents - platformFeeCents);
    const requestId = crypto.randomUUID();
    const orderId = await createPendingWorkOrder({
      buyerUserId: user.id,
      sellerUserId: product.ownerUserId,
      workId,
      productId: product.productId,
      orderKind,
      currency: product.currency,
      grossAmountCents,
      platformFeeCents,
      sellerNetCents,
      requestId,
      meta: {
        rights_scope: product.rightsScope,
        title: product.title,
        ...(orderKind === "tip" ? { tip_amount_cents: grossAmountCents } : {}),
      },
    });
    if (!orderId) {
      return res.status(500).json({ ok: false, code: "ORDER_CREATE_FAILED" });
    }
    const successUrl = String(
      req.body?.success_url ||
        process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
        `${appBaseUrl(req)}/`,
    ).trim();
    const cancelUrl = String(
      req.body?.cancel_url ||
        process.env.STRIPE_CHECKOUT_CANCEL_URL ||
        `${appBaseUrl(req)}/`,
    ).trim();
    const successUrlFinal = appendQueryToUrl(successUrl, {
      stripe_checkout: "success",
      order_id: orderId,
    });
    const cancelUrlFinal = appendQueryToUrl(cancelUrl, {
      stripe_checkout: "cancel",
      order_id: orderId,
    });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: String(customer?.stripe_customer_id || ""),
      success_url: successUrlFinal,
      cancel_url: cancelUrlFinal,
      client_reference_id: orderId,
      payment_intent_data: {
        metadata: {
          order_id: orderId,
          work_id: workId,
          buyer_user_id: user.id,
          seller_user_id: product.ownerUserId,
          product_id: String(product.productId || ""),
          order_kind: orderKind,
        },
      },
      metadata: {
        order_id: orderId,
        work_id: workId,
        buyer_user_id: user.id,
        seller_user_id: product.ownerUserId,
        product_id: String(product.productId || ""),
        order_kind: orderKind,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: product.currency.toLowerCase(),
            unit_amount: grossAmountCents,
            product_data: {
              name: `${product.title} (${orderKind})`,
              metadata: {
                work_id: workId,
                order_kind: orderKind,
              },
            },
          },
        },
      ],
    });
    await updateWorkOrderStripeRefs({
      orderId,
      checkoutSessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
      metaPatch: {
        checkout_url_created: true,
      },
    });
    return res.json(
      okData({
        authenticated: true,
        configured: true,
        order_id: orderId,
        checkout_session_id: session.id,
        checkout_url: session.url,
        payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "STRIPE_CHECKOUT_CREATE_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/stripe/checkout/cancel", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const orderId = String(req.body?.order_id || "").trim() || null;
    const checkoutSessionId =
      String(req.body?.checkout_session_id || "").trim() || null;
    if (!orderId && !checkoutSessionId) {
      return res.status(400).json({ ok: false, code: "ORDER_ID_REQUIRED" });
    }
    const canceled = await cancelPendingWorkOrder({
      orderId,
      buyerUserId: user.id,
      checkoutSessionId,
      reason: "buyer_returned_cancel_url",
    });
    return res.json(
      okData({
        authenticated: true,
        canceled: Boolean(canceled),
        order_id: canceled?.id || orderId || null,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "STRIPE_CHECKOUT_CANCEL_FAILED",
      message: String(err),
    });
  }
});

app.get("/api/stripe/connect/status", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    if (!stripeStep1Configured()) {
      return res.json(
        okData({
          authenticated: true,
          configured: false,
          connected_account: null,
        }),
      );
    }
    const record = await ensureStripeConnectedAccount({
      userId: user.id,
      email: normalizeEmail(user.email),
      appBase: appBaseUrl(req),
    });
    return res.json(
      okData({
        authenticated: true,
        configured: true,
        connected_account: record,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "STRIPE_CONNECT_STATUS_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/stripe/connect/start", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ ok: false, code: "STRIPE_NOT_CONFIGURED" });
    }
    const record = await ensureStripeConnectedAccount({
      userId: user.id,
      email: normalizeEmail(user.email),
      appBase: appBaseUrl(req),
    });
    if (!record?.stripe_account_id) {
      return res
        .status(500)
        .json({ ok: false, code: "STRIPE_CONNECT_ACCOUNT_MISSING" });
    }
    const refreshUrl = String(
      req.body?.refresh_url ||
        process.env.STRIPE_CONNECT_REFRESH_URL ||
        `${appBaseUrl(req)}/`,
    ).trim();
    const returnUrl = String(
      req.body?.return_url ||
        process.env.STRIPE_CONNECT_RETURN_URL ||
        `${appBaseUrl(req)}/`,
    ).trim();
    const link = await stripe.accountLinks.create({
      account: record.stripe_account_id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    return res.json(
      okData({
        authenticated: true,
        configured: true,
        onboarding_url: link.url,
        expires_at: link.expires_at,
        connected_account: record,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "STRIPE_CONNECT_START_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/stripe/webhook", async (req, res) => {
  noStore(res);
  try {
    const stripe = getStripeClient();
    const secret = getStripeWebhookSecret();
    if (!stripe || !secret) {
      return res
        .status(503)
        .json({ ok: false, code: "STRIPE_WEBHOOK_NOT_CONFIGURED" });
    }
    const signature = String(req.headers["stripe-signature"] || "").trim();
    if (!signature) {
      return res
        .status(400)
        .json({ ok: false, code: "STRIPE_SIGNATURE_MISSING" });
    }
    const event = stripe.webhooks.constructEvent(
      requestRawBody(req),
      signature,
      secret,
    );
    const recorded = await recordStripeWebhookEvent(event);
    if (recorded.alreadyProcessed) {
      return res.json({ received: true, duplicate: true });
    }
    try {
      await processStripeWebhookEvent(event);
      await markStripeWebhookEventProcessed(event.id, null);
      return res.json({ received: true });
    } catch (err) {
      await markStripeWebhookEventProcessed(event.id, String(err));
      return res.status(500).json({
        ok: false,
        code: "STRIPE_WEBHOOK_PROCESS_FAILED",
        message: String(err),
      });
    }
  } catch (err) {
    return res.status(400).json({
      ok: false,
      code: "STRIPE_WEBHOOK_INVALID",
      message: String(err),
    });
  }
});

// CSSOS_PHASE2_SUBSCRIPTION_NOTIFY 20260501 #263 — Jing
// "今天会出现第一个真正的订阅用户. 请在出现时通知我."
//
// Lightweight admin-only polling endpoint that surfaces recent
// customer.subscription.created events from stripe_webhook_events.
// The frontend (public/app.subscription-watcher.js) polls this every
// 30s when the logged-in user is an admin and shows a celebratory
// toast + chime on the first new event since the last poll.
//
// Response shape:
//   { ok: true, events: [{ id, event_type, created_at, livemode,
//     customer_email, plan_id, amount_cents, currency }] }
//
// We restrict to admins to avoid leaking other users' subscription
// activity to the world; the email allowlist is intentionally narrow.
app.get("/api/admin/subscription-events/recent", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    const adminEmails = new Set(
      String(process.env.CSSOS_ADMIN_EMAILS || "admin@cssstudio.app")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!user || !adminEmails.has(String(user.email || "").toLowerCase())) {
      return res.status(403).json({ ok: false, code: "NOT_ADMIN" });
    }
    const sinceParam = String(req.query.since || "").trim();
    const sinceTs = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 24 * 3600 * 1000);
    const sinceIso = isNaN(sinceTs.getTime())
      ? new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      : sinceTs.toISOString();
    const result = await withClient((client) =>
      client.query(
        `SELECT stripe_event_id, event_type, livemode, payload, created_at
           FROM stripe_webhook_events
          WHERE event_type IN ('customer.subscription.created',
                               'customer.subscription.updated',
                               'invoice.paid',
                               'checkout.session.completed')
            AND created_at >= $1
          ORDER BY created_at DESC
          LIMIT 50`,
        [sinceIso],
      ),
    );
    const events = result.rows.map((r: any) => {
      let customer_email: string | null = null;
      let plan_id: string | null = null;
      let amount_cents: number | null = null;
      let currency: string | null = null;
      try {
        const p = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload;
        const obj = p?.data?.object || {};
        customer_email = obj?.customer_email
          || obj?.customer_details?.email
          || obj?.metadata?.email
          || null;
        plan_id = obj?.items?.data?.[0]?.price?.id
          || obj?.lines?.data?.[0]?.price?.id
          || obj?.plan?.id
          || null;
        amount_cents = obj?.amount_total
          ?? obj?.amount_paid
          ?? obj?.amount
          ?? null;
        currency = obj?.currency || null;
      } catch (_e) { /* best effort */ }
      return {
        id: r.stripe_event_id,
        event_type: r.event_type,
        livemode: r.livemode === true,
        created_at: r.created_at,
        customer_email,
        plan_id,
        amount_cents,
        currency,
      };
    });
    return res.json({ ok: true, events, server_time: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "SUBSCRIPTION_EVENTS_LOOKUP_FAILED",
      message: String(err),
    });
  }
});

// CSSOS_PHASE2_PERSONALIZATION_INBOX 20260502 #271 - Jing
// User-facing list of system gift MVs delivered to the caller.
// Joins system_gift_audit (status IN delivered/viewed) with the
// user_works row that holds the actual MV media. Returns newest-
// delivered first so the user's inbox feels chronological.
//
// Privacy: this endpoint only ever returns rows where
// target_user_id matches the session user's id. Admin staff use a
// separate endpoint (TBD) to view delivery analytics across users.
app.get("/api/personalization/inbox", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const limit = Math.max(
      1,
      Math.min(
        100,
        Number.parseInt(String(req.query.limit || "50"), 10) || 50,
      ),
    );
    const result = await withClient((client) =>
      client.query(
        `SELECT
           sga.id              AS audit_id,
           sga.trigger_event,
           sga.work_id,
           sga.template_id,
           sga.dispatched_at,
           sga.delivered_at,
           sga.viewed_at,
           sga.cost_cents,
           sga.recipient_display_name,
           sga.recipient_locale,
           uw.title             AS work_title,
           uw.style             AS work_style,
           uw.lyrics_preview    AS work_lyrics_preview,
           uw.cover_image       AS work_cover_image,
           uw.preview_image_url AS work_preview_image_url,
           uw.preview_video_url AS work_preview_video_url
           FROM system_gift_audit sga
      LEFT JOIN user_works uw ON uw.id = sga.work_id
          WHERE sga.target_user_id = $1
            AND sga.status IN ('delivered', 'viewed')
          ORDER BY sga.delivered_at DESC NULLS LAST,
                   sga.dispatched_at DESC
          LIMIT $2`,
        [user.id, limit],
      ),
    );
    const items = result.rows.map((r: any) => ({
      audit_id: r.audit_id,
      trigger_event: r.trigger_event,
      work_id: r.work_id,
      template_id: r.template_id,
      dispatched_at: r.dispatched_at,
      delivered_at: r.delivered_at,
      viewed_at: r.viewed_at,
      cost_cents: Number(r.cost_cents || 0),
      title: r.work_title || null,
      style: r.work_style || null,
      lyrics_preview: r.work_lyrics_preview || null,
      cover_image: r.work_cover_image || null,
      preview_image_url: r.work_preview_image_url || null,
      preview_video_url: r.work_preview_video_url || null,
      recipient_display_name: r.recipient_display_name || null,
    }));
    return res.json({
      ok: true,
      items,
      total: items.length,
      unviewed_count: items.filter((g) => !g.viewed_at).length,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "INBOX_LOOKUP_FAILED",
      message: String(err),
    });
  }
});

// Mark a single gift as viewed. Called by the watch panel the first
// time the user actually plays the MV (NOT when they merely list the
// inbox — listing isn't watching). Idempotent: status='delivered' →
// 'viewed' on first call; subsequent calls are a no-op.
app.post("/api/personalization/inbox/:auditId/viewed", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const auditId = String(req.params.auditId || "").trim();
    if (!auditId) {
      return res.status(400).json({ ok: false, code: "AUDIT_ID_REQUIRED" });
    }
    const result = await withClient((client) =>
      client.query(
        `UPDATE system_gift_audit
            SET status='viewed',
                viewed_at=COALESCE(viewed_at, now()),
                updated_at=now()
          WHERE id = $1
            AND target_user_id = $2
            AND status IN ('delivered', 'viewed')
          RETURNING id, viewed_at`,
        [auditId, user.id],
      ),
    );
    if (!result.rows.length) {
      return res.status(404).json({ ok: false, code: "GIFT_NOT_FOUND" });
    }
    return res.json({
      ok: true,
      audit_id: result.rows[0].id,
      viewed_at: result.rows[0].viewed_at,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "MARK_VIEWED_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/billing/usage", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json(
        okEmpty({ allowed: false, authenticated: false }, "No data yet"),
      );
    }
    const access = await resolveUserAccessProfile(user);
    const result = await consumeBillableAction({
      userId: user.id,
      access,
      actionKey: "video_generate",
      route: "/api/billing/usage",
      countAgainstMonthlyLimit: true,
      coveredBy: "membership",
      meta: { legacy_route: true },
    });
    return res.json(okData({ tier: access.tier, ...result }));
  } catch (_err) {
    return res.json(okEmpty({ allowed: false }, "No data yet"));
  }
});

app.post("/api/billing/actions/consume", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const access = await resolveUserAccessProfile(user);
    const actionKey = normalizeBillableActionKey(req.body?.action_key);
    if (!actionKey) {
      return res.status(400).json({ ok: false, code: "ACTION_REQUIRED" });
    }
    const result = await consumeBillableAction({
      userId: user.id,
      access,
      actionKey,
      units: Number(req.body?.units || 1),
      route: `/api/billing/actions/${actionKey}`,
      countAgainstMonthlyLimit: actionKey === "video_generate",
      coveredBy:
        actionKey === "enterprise_route"
          ? "enterprise"
          : actionKey === "cinema_booking"
            ? "booking"
            : "membership",
      meta:
        req.body?.meta && typeof req.body.meta === "object"
          ? req.body.meta
          : {},
    });
    return res.json(
      okData({ tier: access.tier, action_key: actionKey, ...result }),
    );
  } catch (_err) {
    return res
      .status(500)
      .json({ ok: false, code: "BILLING_ACTION_CONSUME_FAILED" });
  }
});

app.get("/api/cinema/bookings", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const rows = await listCinemaBookingRequests(
      user.id,
      Number(req.query.limit || 12),
    );
    return res.json(okData({ authenticated: true, bookings: rows }));
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "CINEMA_BOOKING_LIST_FAILED",
      message: String(err),
    });
  }
});

app.post("/api/cinema/bookings", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, code: "AUTH_REQUIRED" });
    }
    const access = await resolveUserAccessProfile(user);
    const projectTitle = String(req.body?.project_title || "")
      .trim()
      .slice(0, 160);
    const requestedMode =
      String(req.body?.requested_mode || "cinema")
        .trim()
        .slice(0, 48) || "cinema";
    const requestedDurationSec = Math.max(
      0,
      Math.min(86400, Number(req.body?.requested_duration_sec || 0) || 0),
    );
    const contactEmail = normalizeEmail(
      String(req.body?.contact_email || user.email || ""),
    );
    const contactHandle = String(req.body?.contact_handle || "")
      .trim()
      .slice(0, 160);
    const budgetCents = Math.max(
      0,
      Math.min(
        100000000000,
        Math.round(Number(req.body?.budget_cents || 0) || 0),
      ),
    );
    const brief = String(req.body?.brief || "")
      .trim()
      .slice(0, 4000);
    const needsContract = req.body?.needs_contract !== false;
    if (!projectTitle || !brief) {
      return res
        .status(400)
        .json({ ok: false, code: "CINEMA_BOOKING_FIELDS_REQUIRED" });
    }
    const billing = await consumeBillableAction({
      userId: user.id,
      access,
      actionKey: "cinema_booking",
      units: 1,
      route: "/api/cinema/bookings",
      countAgainstMonthlyLimit: false,
      coveredBy: "booking",
      meta: {
        project_title: projectTitle,
        requested_mode: requestedMode,
        requested_duration_sec: requestedDurationSec,
        budget_cents: budgetCents,
      },
    });
    const insertRes = await withClient((client) =>
      client.query(
        `INSERT INTO cinema_booking_requests (
           user_id, status, project_title, requested_mode, requested_duration_sec, contact_email,
           contact_handle, budget_cents, brief, needs_contract, meta
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, status, project_title, requested_mode, requested_duration_sec, contact_email,
                   contact_handle, budget_cents, brief, needs_contract, meta, created_at, updated_at`,
        [
          user.id,
          "submitted",
          projectTitle,
          requestedMode,
          requestedDurationSec,
          contactEmail,
          contactHandle,
          budgetCents,
          brief,
          needsContract,
          JSON.stringify({
            tier: access.tier,
            requested_by: user.id,
            billable_action_allowed: billing.allowed !== false,
          }),
        ],
      ),
    );
    return res.json(
      okData({
        authenticated: true,
        booking: insertRes.rows[0],
        billing,
      }),
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "CINEMA_BOOKING_CREATE_FAILED",
      message: String(err),
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "cssOS running 🚀" });
});

/* CSSOS_SHARE_OG_INJECT 20260506 — Jing
 * "分享作品到社交平台的时候，请带上封面图，我们有好几张封面图，请每一次
 *  都随机分享一张封面图. 效果，同一个作品，每次分享，封面图都随机."
 *
 * When the share-link landing URL `/?cssMV=<work_id>` is fetched (by a
 * social-platform crawler OR a real browser), we splice OG meta tags
 * into the index.html <head> so the share preview shows the work's
 * cover, title, and a one-line description. We pick the cover at
 * REQUEST time from a per-work pool (cover_image + preview_image_url
 * + any work_assets rows of cover_image / preview_image type), so
 * different scrapes — and therefore different platforms — can land on
 * different covers. Same work shared twice → potentially different
 * preview image, which is what the user asked for ("每次分享，封面图
 * 都随机").
 *
 * Cache the original index.html bytes once at first request to avoid
 * re-reading the file every navigation. Falls back to the raw sendFile
 * if anything goes wrong (DB miss, FS error) — the SPA still loads.
 */
let __cachedIndexHtml: Buffer | null = null;
function readIndexHtml(): Buffer {
  if (__cachedIndexHtml) return __cachedIndexHtml;
  __cachedIndexHtml = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"));
  return __cachedIndexHtml;
}

function escapeHtmlAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface ShareCoverWorkRow {
  id: string;
  title: string | null;
  style: string | null;
  cover_image: string | null;
  preview_image_url: string | null;
  asset_urls: string[] | null;
}

async function fetchShareWork(id: string): Promise<ShareCoverWorkRow | null> {
  if (!/^[0-9a-fA-F-]{8,64}$/.test(id)) return null;
  try {
    const q = await withClient((client) =>
      client.query<ShareCoverWorkRow>(
        `SELECT
           w.id, w.title, w.style, w.cover_image, w.preview_image_url,
           ARRAY_REMOVE(ARRAY_AGG(DISTINCT a.url), NULL) AS asset_urls
         FROM user_works w
         LEFT JOIN work_assets a
           ON a.work_id = w.id
          AND a.asset_type IN ('cover_image','preview_image')
         WHERE w.id = $1::uuid
         GROUP BY w.id, w.title, w.style, w.cover_image, w.preview_image_url
         LIMIT 1`,
        [id],
      ),
    );
    return q.rows[0] || null;
  } catch (err) {
    console.warn("[share-og] fetch failed:", err);
    return null;
  }
}

function pickRandomCover(work: ShareCoverWorkRow): string | null {
  const pool = new Set<string>();
  if (work.cover_image) pool.add(work.cover_image);
  if (work.preview_image_url) pool.add(work.preview_image_url);
  for (const u of work.asset_urls || []) {
    if (u) pool.add(u);
  }
  const arr = Array.from(pool);
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)] ?? null;
}

/** Strip template-prompt cruft from a style string before it lands in
 *  share metadata. Some legacy works have raw template fragments saved
 *  as their `style` (e.g. "[🎵 Music Style（英文｜可直接给…）] · ..."). */
function cleanStyleForShare(raw: string): string {
  return String(raw || "")
    .replace(/\[[^\]]*\]/g, "") // drop [...] bracket blocks
    .replace(/【[^】]*】/g, "")  // drop 【...】 fullwidth bracket blocks
    .replace(/[（(][^)）]*[)）]/g, "") // drop (...) and （...）
    .replace(/[·•|｜]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOgMeta(work: ShareCoverWorkRow, requestUrl: string): string {
  const title = String(work.title || "CSS Studio MV").trim() || "CSS Studio MV";
  const cleanedStyle = cleanStyleForShare(work.style || "");
  const styleHead = cleanedStyle ? (cleanedStyle.split(/[,，\n]/)[0] || "").trim() : "";
  const desc = styleHead
    ? `${title} — ${styleHead} · CSS Studio`
    : `${title} — CSS Studio`;
  const cover = pickRandomCover(work);
  const lines: string[] = [];
  lines.push(`<meta property="og:type" content="video.other" />`);
  lines.push(`<meta property="og:title" content="${escapeHtmlAttr(title)}" />`);
  lines.push(`<meta property="og:description" content="${escapeHtmlAttr(desc)}" />`);
  lines.push(`<meta property="og:url" content="${escapeHtmlAttr(requestUrl)}" />`);
  lines.push(`<meta property="og:site_name" content="CSS Studio" />`);
  if (cover) {
    lines.push(`<meta property="og:image" content="${escapeHtmlAttr(cover)}" />`);
    lines.push(`<meta property="og:image:alt" content="${escapeHtmlAttr(title)}" />`);
  }
  // Twitter fallback (X reads twitter:* over og:* when both are present)
  lines.push(`<meta name="twitter:card" content="${cover ? "summary_large_image" : "summary"}" />`);
  lines.push(`<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`);
  lines.push(`<meta name="twitter:description" content="${escapeHtmlAttr(desc)}" />`);
  if (cover) lines.push(`<meta name="twitter:image" content="${escapeHtmlAttr(cover)}" />`);
  return "\n    <!-- CSSOS_SHARE_OG_INJECT 20260506 — per-share OG meta -->\n    " + lines.join("\n    ") + "\n";
}

app.get("/", async (req, res) => {
  noStore(res);
  res.type("html");
  const cssMV = String(req.query.cssMV || "").trim();
  if (!cssMV) {
    return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  }
  try {
    const work = await fetchShareWork(cssMV);
    if (!work) {
      return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
    }
    const html = readIndexHtml().toString("utf8");
    const requestUrl = `https://${req.get("host") || "cssstudio.app"}${req.originalUrl}`;
    const ogBlock = buildOgMeta(work, requestUrl);
    // Inject right before </head>. Case-insensitive, first match.
    const idx = html.search(/<\/head>/i);
    if (idx < 0) {
      return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
    }
    const out = html.slice(0, idx) + ogBlock + html.slice(idx);
    return res.send(out);
  } catch (err) {
    console.warn("[share-og] inject failed, falling back to raw:", err);
    return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  }
});

async function start() {
  const openAiRuntime = getOpenAiRuntimeConfig();
  console.info("[startup.openai]", {
    envSource: openAiRuntime.envSource,
    keyFingerprint: openAiRuntime.keyFingerprint || "missing",
    textModel: openAiRuntime.model,
    transcribeModel: getOpenAiTranscribeModel(),
  });
  if (DATABASE_URL) {
    try {
      await runMigrations();
      await ensureAuthIdentityTable();
      await ensureOAuthTokensTable();
      await processMatureSellerPayouts();
      const runPayoutSweepLoop = async () => {
        try {
          await processMatureSellerPayouts();
        } catch (err) {
          console.error("Payout sweep failed", err);
        } finally {
          const commerce = await getCommercePolicySettings().catch(() => ({
            payoutSweepMs: stripePayoutSweepMsEnv(),
          }));
          setTimeout(
            runPayoutSweepLoop,
            Number(commerce?.payoutSweepMs || stripePayoutSweepMsEnv()),
          );
        }
      };
      const commerce = await getCommercePolicySettings().catch(() => ({
        payoutSweepMs: stripePayoutSweepMsEnv(),
      }));
      setTimeout(
        runPayoutSweepLoop,
        Number(commerce?.payoutSweepMs || stripePayoutSweepMsEnv()),
      );
    } catch (err) {
      console.error(
        "Startup DB bootstrap failed; continuing in degraded mode",
        err,
      );
    }
  }
  // CSSOS_PHASE2_PERSONALIZATION_TEMPLATES 20260502 #270 - Jing
  // Boot the personalization engine: scan the templates directory
  // and register every gift trigger handler. Both calls are
  // idempotent and best-effort — failure here MUST NOT crash the
  // API. We log + continue so the rest of cssOS keeps serving even
  // if the gift system is misconfigured.
  try {
    const {
      loadPersonalizationTemplates,
      registerAllPersonalizationTriggers,
      runDailyBirthdayFlush,
      fireTriggerFireAndForget,
    } = await import("./personalization/index.js");
    await loadPersonalizationTemplates();
    registerAllPersonalizationTriggers();

    // CSSOS_PHASE2_PERSONALIZATION_STAGE_F 20260503 — Jing
    // Birthday flush daemon. Scans every 6 hours; the SQL inside
    // already de-dupes so users won't get the same year's birthday
    // MV twice even if the cron fires multiple times per local day.
    // Same-process scheduler (no external cron) keeps the
    // dependency surface minimal — runs exactly while the API is
    // up. The SQL also handles per-user timezones so a user in
    // UTC+8 is hit at the right local-day boundary regardless of
    // when the VM happens to fire.
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const birthdayFlushTick = async () => {
      try {
        const userIds = await runDailyBirthdayFlush(
          getPool(),
          fireTriggerFireAndForget,
          getPool(),
        );
        if (userIds.length) {
          console.log(
            "[personalization] birthday flush dispatched %d gift(s)",
            userIds.length,
          );
        }
      } catch (e) {
        console.warn(
          "[personalization] birthday flush failed (non-fatal):",
          e instanceof Error ? e.message : String(e),
        );
      }
    };
    // Fire once shortly after boot (5 min — gives DB pool time to
    // warm up) so a deploy mid-day still catches the day's birthdays.
    setTimeout(birthdayFlushTick, 5 * 60 * 1000);
    setInterval(birthdayFlushTick, SIX_HOURS_MS);
  } catch (err) {
    console.error(
      "[personalization] engine boot failed; continuing without gifts —",
      err,
    );
  }
  app.listen(PORT, () => {
    console.log(`cssOS API running on http://localhost:${PORT}`);
    // Tier-fallback sanity log — surfaces misconfigured order at boot.
    const fmt = (ps: string[]) => ps.map((p) => `${p}(${providerTier(p)})`).join(" → ");
    console.log(`[engines] image order: ${fmt(imageProviderOrder())}`);
    console.log(`[engines] video order: ${fmt(videoProviderOrder())}`);
    console.log(`[engines] music order: ${fmt(musicProviderOrder())}`);
    console.log(`[engines] llm   order: ${fmt(llmProviderOrder() as string[])}`);
    console.log(`[engines] tts   order: ${fmt(ttsProviderOrder())}`);
  });
}

start().catch((err) => {
  console.error("Startup failed", err);
  process.exit(1);
});
