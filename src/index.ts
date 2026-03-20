import express from "express";
import path from "path";
import crypto from "node:crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { QueryResult } from "pg";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import Stripe from "stripe";
import dotenv from "dotenv";
import { getDatabaseUrl, getPool, withClient } from "./db";
import { runMigrations } from "./db/migrate";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const app = express();
const PORT = 3000;
const REGISTRY_URL = "http://localhost:8080";
const IS_PROD = process.env.NODE_ENV === "production";

const DATABASE_URL = getDatabaseUrl();
if (process.env.NODE_ENV === "production" && !DATABASE_URL) {
  throw new Error("DATABASE_URL not configured on api-vm");
}

app.set("trust proxy", 1);

app.use(
  express.json({
    verify(req, _res, buf) {
      (req as any).rawBody = Buffer.from(buf);
    }
  })
);
app.use(
  express.urlencoded({
    extended: false,
    verify(req, _res, buf) {
      (req as any).rawBody = Buffer.from(buf);
    }
  })
);

const sessionConfig: session.SessionOptions = {
  name: process.env.SESSION_COOKIE || "cssos_session",
  secret: process.env.SESSION_SECRET || "cssos_session_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: process.env.COOKIE_HTTPONLY !== "false",
    sameSite: (process.env.COOKIE_SAMESITE || "lax") as "lax" | "strict" | "none",
    secure:
      typeof process.env.COOKIE_SECURE === "string"
        ? process.env.COOKIE_SECURE !== "false"
        : IS_PROD,
    path: process.env.COOKIE_PATH || "/",
    maxAge: 1000 * 60 * 60 * 24 * Number(process.env.SESSION_TTL_DAYS || 30)
  }
};

if (DATABASE_URL) {
  const PgSession = connectPgSimple(session);
  sessionConfig.store = new PgSession({
    pool: getPool(),
    tableName: "session",
    createTableIfMissing: true
  });
}

app.use(session(sessionConfig));
app.use(express.static(path.join(__dirname, "..", "public")));

function noStore(res: express.Response) {
  res.setHeader("Cache-Control", "no-store");
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
      [sessionUserId]
    )
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
  const parsed = Number.parseInt(String(process.env.STRIPE_PLATFORM_FEE_BPS || "1000"), 10);
  if (!Number.isFinite(parsed)) return 1000;
  return Math.max(0, Math.min(parsed, 9500));
}

function computePlatformFeeCents(amountCents: number) {
  return Math.max(0, Math.round(amountCents * (stripePlatformFeeBps() / 10000)));
}

function stripePayoutHoldDays() {
  const parsed = Number.parseInt(String(process.env.STRIPE_PAYOUT_HOLD_DAYS || "14"), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 14;
}

function stripePayoutSweepMs() {
  const parsed = Number.parseInt(String(process.env.STRIPE_PAYOUT_SWEEP_MS || String(60 * 60 * 1000)), 10);
  return Number.isFinite(parsed) && parsed >= 60_000 ? parsed : 60 * 60 * 1000;
}

function payoutAvailableAtForOrder(order: { created_at?: string | Date | null; updated_at?: string | Date | null }) {
  const base = order.created_at || order.updated_at || new Date();
  const at = new Date(base);
  at.setUTCDate(at.getUTCDate() + stripePayoutHoldDays());
  return at;
}

function requestRawBody(req: express.Request) {
  return ((req as any).rawBody as Buffer | undefined) || Buffer.alloc(0);
}

function defaultListenPriceCents() {
  const parsed = Number.parseInt(String(process.env.CSSMV_DEFAULT_LISTEN_PRICE_CENTS || "99"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 99;
}

function defaultBuyoutPriceCents() {
  const parsed = Number.parseInt(String(process.env.CSSMV_DEFAULT_BUYOUT_PRICE_CENTS || "299"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 299;
}

type CssmvWorkType = "single" | "triptych" | "opera";

function normalizeWorkType(value: unknown): CssmvWorkType {
  const raw = String(value || "").trim().toLowerCase();
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
  return { listenCents: defaultListenPriceCents(), buyoutCents: defaultBuyoutPriceCents(), label: "single" };
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
      duration_s: 180,
      language: "zh",
      prompt: "",
      work_type: "single"
    },
    pricing_by_type: {
      single: { listen_cents: 99, buyout_cents: 299 },
      triptych: { listen_cents: 99, buyout_cents: 499 },
      opera: { listen_cents: 99, buyout_cents: 999 }
    }
  };
}

function mergeCreationPanelTemplate(value: any) {
  const base = defaultCreationPanelTemplate();
  const creative = value && typeof value === "object" && value.creative && typeof value.creative === "object"
    ? value.creative
    : {};
  const pricingByType = value && typeof value === "object" && value.pricing_by_type && typeof value.pricing_by_type === "object"
    ? value.pricing_by_type
    : {};
  const merged = {
    creative: {
      genre: String(creative.genre || base.creative.genre).slice(0, 120),
      mood: String(creative.mood || "").slice(0, 120),
      instrument: String(creative.instrument || "").slice(0, 120),
      instrumentation: String(creative.instrumentation || "").slice(0, 400),
      ambience: String(creative.ambience || "").slice(0, 120),
      vocal_gender: String(creative.vocal_gender || base.creative.vocal_gender).slice(0, 120),
      vocal_style: String(creative.vocal_style || "").slice(0, 240),
      ensemble_style: String(creative.ensemble_style || "").slice(0, 240),
      arrangement_density: Math.max(0.2, Math.min(1, Number.parseFloat(String(creative.arrangement_density ?? base.creative.arrangement_density)) || 0.6)),
      dynamics_curve: String(creative.dynamics_curve || "").slice(0, 240),
      section_form: String(creative.section_form || "").slice(0, 240),
      articulation_bias: String(creative.articulation_bias || "").slice(0, 240),
      voicing_register: String(creative.voicing_register || "").slice(0, 240),
      percussion_activity: Math.max(0, Math.min(1, Number.parseFloat(String(creative.percussion_activity ?? base.creative.percussion_activity)) || 0.45)),
      expression_cc_bias: String(creative.expression_cc_bias || "").slice(0, 240),
      humanization: Math.max(0, Math.min(1, Number.parseFloat(String(creative.humanization ?? base.creative.humanization)) || 0.35)),
      inspiration_notes: String(creative.inspiration_notes || "").slice(0, 1000),
      licensed_style_pack: String(creative.licensed_style_pack || "").slice(0, 240),
      external_audio_adapter: String(creative.external_audio_adapter || "").slice(0, 240),
      tempo_bpm: Math.max(40, Math.min(220, Number.parseInt(String(creative.tempo_bpm || base.creative.tempo_bpm), 10) || 88)),
      musical_key: ["C", "D", "E", "F", "G", "A", "B"].includes(String(creative.musical_key || "C")) ? String(creative.musical_key) : "C",
      duration_s: Math.max(30, Math.min(600, Number.parseInt(String(creative.duration_s || base.creative.duration_s), 10) || 180)),
      language: ["zh", "en", "ja"].includes(String(creative.language || base.creative.language)) ? String(creative.language) : "zh",
      prompt: String(creative.prompt || "").slice(0, 500),
      work_type: normalizeWorkType(creative.work_type || base.creative.work_type)
    },
    pricing_by_type: {
      single: pricingPresetForWorkType("single"),
      triptych: pricingPresetForWorkType("triptych"),
      opera: pricingPresetForWorkType("opera")
    } as Record<CssmvWorkType, { listenCents: number; buyoutCents: number; label: string }>
  };
  (["single", "triptych", "opera"] as CssmvWorkType[]).forEach((workType) => {
    const entry = pricingByType[workType] && typeof pricingByType[workType] === "object" ? pricingByType[workType] : {};
    const preset = pricingPresetForWorkType(workType);
    merged.pricing_by_type[workType] = {
      listenCents: Math.max(1, Number.parseInt(String(entry.listen_cents || preset.listenCents), 10) || preset.listenCents),
      buyoutCents: Math.max(0, Number.parseInt(String(entry.buyout_cents || preset.buyoutCents), 10) || preset.buyoutCents),
      label: preset.label
    };
  });
  return {
    creative: merged.creative,
    pricing_by_type: {
      single: {
        listen_cents: merged.pricing_by_type.single.listenCents,
        buyout_cents: merged.pricing_by_type.single.buyoutCents
      },
      triptych: {
        listen_cents: merged.pricing_by_type.triptych.listenCents,
        buyout_cents: merged.pricing_by_type.triptych.buyoutCents
      },
      opera: {
        listen_cents: merged.pricing_by_type.opera.listenCents,
        buyout_cents: merged.pricing_by_type.opera.buyoutCents
      }
    }
  };
}

function inferWorkPricingPreset(args: { title?: string | null | undefined; style?: string | null | undefined; workType?: unknown }) {
  const explicitType = normalizeWorkType(args.workType);
  if (args.workType !== undefined && args.workType !== null && String(args.workType || "").trim()) {
    return pricingPresetForWorkType(explicitType);
  }
  const haystack = `${String(args.title || "")} ${String(args.style || "")}`.toLowerCase();
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

function roleForEmail(email: string | null | undefined) {
  const e = normalizeEmail(email);
  if (e && adminEmailSet().has(e)) return "admin";
  return "user";
}

function buildCssmvThumbnailPrompt(
  title: string,
  subtitle: string,
  lyrics: string[]
) {
  const safeTitle = String(title || "CSS MV").trim() || "CSS MV";
  const safeSubtitle = String(subtitle || "").trim();
  const lyricExcerpt = (Array.isArray(lyrics) ? lyrics : [])
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" / ");
  return [
    "Create a square music video thumbnail for a futuristic karaoke-style creative studio.",
    `Title: ${safeTitle}.`,
    safeSubtitle ? `Mood and style: ${safeSubtitle}.` : "",
    lyricExcerpt ? `Lyric inspiration: ${lyricExcerpt}.` : "",
    "Use cinematic lighting, a bold central composition, and elegant typography-friendly negative space.",
    "Do not add watermarks or logos."
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
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const hostHeader = (req.headers["x-forwarded-host"] as string | string[] | undefined) || req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : (hostHeader || "localhost:3000");
  return `${proto}://${host}`;
}

function currentRpId(req: express.Request) {
  const hostHeader = (req.headers["x-forwarded-host"] as string | string[] | undefined) || req.headers.host;
  const hostRaw = Array.isArray(hostHeader) ? (hostHeader[0] || "localhost:3000") : (hostHeader || "localhost:3000");
  const host = ((hostRaw.split(":")[0] ?? "localhost") as string).trim().toLowerCase();
  return host || "localhost";
}

function passkeySubject(req: express.Request, user: Awaited<ReturnType<typeof getSessionUser>>) {
  if (user?.id) {
    return {
      key: `u:${user.id}`,
      id: user.id,
      name: user.email || user.id,
      displayName: user.display_name || user.email || "CSS Studio"
    };
  }
  const existing = (req.session as any)?.passkey_subject_key;
  if (existing && typeof existing === "string" && existing.length > 0) {
    return {
      key: existing,
      id: `guest-${existing.replace(/^s:/, "")}`,
      name: `guest-${existing.replace(/^s:/, "")}`,
      displayName: "Guest"
    };
  }
  const key = `s:${req.sessionID}`;
  (req.session as any).passkey_subject_key = key;
  return {
    key,
    id: `guest-${req.sessionID}`,
    name: `guest-${req.sessionID}`,
    displayName: "Guest"
  };
}

async function listPasskeyCreds(subjectKey: string): Promise<Array<{ id: string; transports?: string[] }>> {
  if (!DATABASE_URL) {
    return passkeyCreds.get(subjectKey) || [];
  }
  type Row = { credential_id: string; transports: unknown };
  const result: QueryResult<Row> = await withClient((client) =>
    client.query<Row>(
      "SELECT credential_id, transports FROM passkey_credentials WHERE subject_key = $1 ORDER BY created_at DESC",
      [subjectKey]
    )
  );
  return result.rows.map((r) => ({
    id: r.credential_id,
    transports: Array.isArray(r.transports)
      ? r.transports.filter((x): x is string => typeof x === "string")
      : ["internal"]
  }));
}

async function savePasskeyCred(subjectKey: string, credId: string, transports?: string[]) {
  const ts = Array.isArray(transports) && transports.length ? transports : ["internal"];
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
      [subjectKey, credId, JSON.stringify(ts)]
    )
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
    client.query<Row>("SELECT COUNT(*)::text AS c FROM passkey_credentials WHERE subject_key = $1", [subjectKey])
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
      [fromKey, toKey]
    )
  );
}

async function buildPasskeyRegisterOptions(req: express.Request) {
  const user = await getSessionUser(req);
  const subject = passkeySubject(req, user);
  const challenge = b64url(Buffer.from(crypto.randomUUID().replace(/-/g, ""), "utf8"));
  passkeyState.set(subject.key, {
    challenge,
    kind: "register",
    expireAt: Date.now() + 5 * 60 * 1000
  });
  const existing = await listPasskeyCreds(subject.key);
  return {
    publicKey: {
      challenge,
      rp: { name: "CSS Studio", id: currentRpId(req) },
      user: {
        id: b64url(subject.id),
        name: subject.name,
        displayName: subject.displayName
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      timeout: 60000,
      attestation: "none",
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      excludeCredentials: existing.map((c) => ({
        id: c.id,
        type: "public-key",
        transports: c.transports || ["internal"]
      }))
    }
  };
}

async function buildPasskeyLoginOptions(req: express.Request) {
  const user = await getSessionUser(req);
  const subject = passkeySubject(req, user);
  const challenge = b64url(Buffer.from(crypto.randomUUID().replace(/-/g, ""), "utf8"));
  passkeyState.set(subject.key, {
    challenge,
    kind: "login",
    expireAt: Date.now() + 5 * 60 * 1000
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
        transports: c.transports || ["internal"]
      }))
    },
    empty: existing.length === 0,
    origin: currentOrigin(req)
  };
}

function providerConfig() {
  const providers = [
    { id: "google", name: "Google", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
    { id: "github", name: "GitHub", env: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"] },
    { id: "x", name: "X", env: ["X_CLIENT_ID", "X_CLIENT_SECRET"] },
    { id: "bsky", name: "Bluesky", env: ["BSKY_CLIENT_ID", "BSKY_CLIENT_SECRET"] },
    { id: "facebook", name: "Facebook", env: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"] },
    { id: "wechat", name: "WeChat", env: ["WECHAT_CLIENT_ID", "WECHAT_CLIENT_SECRET"] },
    { id: "apple", name: "Apple", env: ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"] }
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
    "dropbox"
  ].map((id) => {
    const k = id.toUpperCase();
    return {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      env: [`${k}_CLIENT_ID`, `${k}_CLIENT_SECRET`, `${k}_AUTH_URL`, `${k}_TOKEN_URL`, `${k}_USERINFO_URL`]
    };
  });
  return [...providers, ...generic].map((provider) => {
    const enabled =
      provider.id === "bsky"
        ? (
            (Boolean(process.env.BSKY_CLIENT_ID) && Boolean(process.env.BSKY_CLIENT_SECRET)) ||
            (Boolean(process.env.BLUESKY_CLIENT_ID) && Boolean(process.env.BLUESKY_CLIENT_SECRET)) ||
            (Boolean(process.env.BLUESKY_HANDLE) && Boolean(process.env.BLUESKY_APP_PASSWORD))
          )
        : provider.env.every((key) => Boolean(process.env[key]));
    return {
      id: provider.id,
      name: provider.name,
      enabled,
      url: enabled ? `/auth/${provider.id}` : ""
    };
  });
}

function authProviderDiagnostics(providerId: string, req: express.Request) {
  const providers = providerConfig();
  const provider = providers.find((item) => item.id === providerId);
  const githubCallbackUrl =
    process.env.GITHUB_REDIRECT_URI || `${appBaseUrl(req)}/api/auth/github/callback`;
  const missingEnv =
    providerId === "github"
      ? ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"].filter((key) => !process.env[key])
      : providerId === "google"
        ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter((key) => !process.env[key])
        : [];

  return {
    provider: providerId,
    enabled: Boolean(provider?.enabled),
    missing_env: missingEnv,
    start_url: provider?.enabled ? `${appBaseUrl(req)}/auth/${providerId}` : "",
    callback_url: providerId === "github" ? githubCallbackUrl : `${appBaseUrl(req)}/auth/${providerId}/callback`
  };
}

function handleAuthDiagnostics(req: express.Request, res: express.Response) {
  noStore(res);
  const providerId = String(req.query.provider || "").trim().toLowerCase();
  if (providerId) {
    return res.json(okData({ diagnostic: authProviderDiagnostics(providerId, req) }));
  }

  return res.json(
    okData({
      diagnostics: providerConfig().map((provider) => authProviderDiagnostics(provider.id, req))
    })
  );
}

async function handleGitHubAuthStart(req: express.Request, res: express.Response) {
  noStore(res);
  try {
    res.setHeader("X-GitHub-Flow-Version", "no-redirect-uri");
    const clientId = process.env.GITHUB_CLIENT_ID || "";
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) return res.status(503).send("github_not_configured");
    const state = randomHex(16);
    setOAuthState(req, "github", { state, createdAt: Date.now() });
    const q = new URLSearchParams({
      client_id: clientId,
      scope: "read:user user:email",
      state
    });
    return res.redirect(302, `https://github.com/login/oauth/authorize?${q.toString()}`);
  } catch {
    return res.status(500).send("github_auth_start_failed");
  }
}

const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

type OAuthSessionState = {
  state: string;
  nonce?: string;
  codeVerifier?: string;
  createdAt: number;
};

function setOAuthState(req: express.Request, provider: string, state: OAuthSessionState) {
  const k = `oauth_state_${provider}`;
  (req.session as any)[k] = state;
}

function getOAuthState(req: express.Request, provider: string): OAuthSessionState | null {
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
  const languageDirective =
    String(language).toLowerCase().startsWith("ja")
      ? "Write the lyrics almost entirely in natural Japanese. Do not output an English lyric body. Sparse loanwords are acceptable, but the actual sung lines, crowd lines, and emotional core must read as Japanese."
      : String(language).toLowerCase().startsWith("zh")
        ? "Write the lyrics almost entirely in natural Chinese. Do not output an English lyric body. The actual sung lines, crowd lines, and emotional core must read as Chinese."
        : "Write the lyrics almost entirely in natural English. Do not switch the lyric body into Chinese or Japanese.";

  return [
    "You are generating a cssMV creative seed.",
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
      `- Avoid this stale pattern: ${blueprint.antiTemplate}`
    ].join("\n"),
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
      "style_tags: string[]"
    ].join("\n"),
    "Lyrics rules:",
    `- ${languageDirective}`,
    "- Write complete lyrics, not an outline.",
    "- Keep them singable and emotionally coherent.",
    "- The lyrics must feel like a brand-new finished song, not a rewrite of a stock template.",
    "- The title may stay the same across attempts, but the meaning of the title can be reinterpreted in a radically new way each time.",
    "- Do not recycle stock cosmic-hymn phrasing, generic destiny language, or merely swap a few title-related nouns.",
    "- Randomize the theme universe, civilization atmosphere, cultural habits, narrator stance, mood field, and language texture according to the blueprint.",
    "- The society around the song must feel different each time: different rituals, gestures, objects, etiquette, and social rules.",
    "- The lyrics must contain the full standard section sequence including Intro and Outro for downstream compatibility.",
    "- Every section must have an explicit section header.",
    "- Use this section order exactly: [Intro], [Verse 1], [Verse 2], [Chorus 1], [Verse 3], [Verse 4], [Chorus 2], [Bridge], [Chorus 3], [Chorus 4], [Outro].",
    "- Use ASCII square brackets for every section header, for example [Verse 1: Moonlit Oath].",
    "- Return exactly 11 section_prompts entries, one for each section including [Intro] and [Outro].",
    "- Return exactly 11 section_beats entries, aligned one-to-one with the section order.",
    "- Every lyrical section except Intro must include a subsection title after the colon, for example [Verse 2: Lanterns Over the River]. The subsection titles themselves must be original and specific to this attempt.",
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
    "- Never use placeholder titles like Untitled or New Song."
  ].join("\n\n");
}

const CSSMV_CREATIVE_FAMILIES = [
  {
    id: "mythic-rite",
    familyLabel: "Mythic rite",
    storyWorld: "broken celestial ritual, ancestral vows, temple smoke, eclipse water",
    civilizationAtmosphere: "dynastic sacred order, omen-reading clergy, inherited oath economy",
    culturalHabits: ["bell-marked prayer hours", "ancestor vow recitations", "ink talisman exchanges"],
    narratorLens: "a witness-priest or oath-bearer speaking inside a sacred event",
    emotionalWeather: "solemn awe, grief, destiny, reverence under pressure",
    refrainBehavior: "ritual chant that grows from private vow into public invocation",
    structureMutation: "long image-heavy verses, ceremonial response lines, choruses that widen from one voice to many voices",
    languageStyleMix: "classical-leaning lyric Chinese mixed with precise modern emotional cuts",
    visualGrammar: "ink, ash, constellations, slow ceremonial camera drift, calligraphy particles",
    soundPressure: "ceremonial drums, guzheng, low choir, breath-heavy pauses, rising opera force",
    imageryAnchors: ["incense ash", "eclipse river", "jade bell", "paper talisman", "star map"],
    dictionRules: ["ornate but sharp", "mythic nouns", "avoid generic self-help uplift"],
    antiTemplate: "do not fall back into a generic sacred hymn about light, destiny, and echo"
  },
  {
    id: "neon-heartbreak",
    familyLabel: "Neon heartbreak",
    storyWorld: "wet city nights, train windows, motel signs, voicemail ghosts, convenience-store insomnia",
    civilizationAtmosphere: "late-capital city loneliness, transit routines, sleepless service culture",
    culturalHabits: ["missed-call rituals", "midnight convenience-store confessions", "platform departures without closure"],
    narratorLens: "a bruised first-person singer talking to an absent lover or their own afterimage",
    emotionalWeather: "intimate ache, anger, hunger, glamour, emotional static",
    refrainBehavior: "hook line mutates each chorus as obsession spirals",
    structureMutation: "short confessional verse lines, punchier pre-hook turns, choruses that keep rewriting the same promise",
    languageStyleMix: "plain conversational slang fused with sharp poetic fragments",
    visualGrammar: "chromatic blur, handheld closeups, sodium reflections, CRT bloom, rain streaks",
    soundPressure: "alt-pop pulse, synth bass, glassy pads, intimate verse whispers, explosive choruses",
    imageryAnchors: ["exit sign", "wet taxi", "answering machine", "broken lipstick", "subway sparks"],
    dictionRules: ["conversational", "specific urban detail", "sharp emotional verbs"],
    antiTemplate: "do not drift into mythic temples or cosmic fate language"
  },
  {
    id: "gravity-fiction",
    familyLabel: "Gravity fiction",
    storyWorld: "orbital debris, artificial dawns, failed transmissions, cryo dreams, machine prayer",
    civilizationAtmosphere: "post-earth orbital diaspora, machine-maintained survival, protocol-heavy life support culture",
    culturalHabits: ["shift-change signal logs", "oxygen ration vows", "transmission memorials"],
    narratorLens: "a pilot, android, or stranded lover speaking across impossible distance",
    emotionalWeather: "wonder, loneliness, survival panic, cold tenderness",
    refrainBehavior: "signal phrase repeats with escalating transmission distortion",
    structureMutation: "compressed technical verses, sudden wide-open choruses, bridge as system failure or truth leak",
    languageStyleMix: "science-fiction terminology braided with intimate confession",
    visualGrammar: "weightless spins, HUD typography, fracture light, vacuum silence, engine bloom",
    soundPressure: "hybrid cinematic electronic, sub pulses, granular texture, choir through static",
    imageryAnchors: ["airlock frost", "red warning light", "burned signal", "orbit debris", "oxygen bloom"],
    dictionRules: ["precise sci-fi detail", "lyrical but technical", "strong verbs"],
    antiTemplate: "do not collapse into vague stars-and-dreams language"
  },
  {
    id: "pastoral-memory",
    familyLabel: "Pastoral memory",
    storyWorld: "river towns, harvest dust, cicadas, old kitchens, handwritten letters, vanished summers",
    civilizationAtmosphere: "small-town seasonal life, intergenerational domestic rhythm, handmade memory culture",
    culturalHabits: ["shared summer meals", "letter folding rituals", "porch-light waiting"],
    narratorLens: "someone singing from memory to a person, place, or younger self",
    emotionalWeather: "tenderness, regret, warmth, distance, late-afternoon ache",
    refrainBehavior: "chorus becomes a remembered phrase everyone once knew",
    structureMutation: "roomy narrative verses, fewer words per line, choruses that land like remembered sayings",
    languageStyleMix: "simple spoken phrasing with sensory detail and quiet metaphor",
    visualGrammar: "sun-faded film grain, long lenses, cloth movement, quiet domestic detail",
    soundPressure: "folk-pop strings, soft percussion, room ambience, communal chorus lift",
    imageryAnchors: ["rusted gate", "rice field wind", "yellow lamp", "old radio", "laundry line"],
    dictionRules: ["plain-spoken poetry", "sensory memory", "small details over abstraction"],
    antiTemplate: "do not turn this into an anthem about destiny or apocalypse"
  },
  {
    id: "surreal-cabaret",
    familyLabel: "Surreal cabaret",
    storyWorld: "mirrors, velvet smoke, absurd theater props, masked dancers, impossible rooms",
    civilizationAtmosphere: "decadent performance society, rumor markets, ritualized seduction and spectacle",
    culturalHabits: ["mask exchanges", "roulette toasts", "audience-response cues"],
    narratorLens: "a ringmaster, temptress, trickster, or unreliable lover performing directly at the listener",
    emotionalWeather: "seduction, menace, wit, delirium, playful dread",
    refrainBehavior: "choruses become theatrical commands or audience spells",
    structureMutation: "snapped-off verse phrases, stage-direction intrusions, choruses built like commands or applause traps",
    languageStyleMix: "showbiz imperatives, decadent imagery, sly humor, knife-edge flirtation",
    visualGrammar: "stage reveals, snap zooms, ornate typography, shadow play, impossible set changes",
    soundPressure: "cabaret drums, bass clarinet, glam strings, sudden drops, dramatic vocal ad-libs",
    imageryAnchors: ["roulette rose", "mirror teeth", "silk gloves", "gold dust", "paper crown"],
    dictionRules: ["theatrical imperatives", "surprise imagery", "dark humor allowed"],
    antiTemplate: "do not write this as a noble heroic ballad"
  },
  {
    id: "riot-romance",
    familyLabel: "Riot romance",
    storyWorld: "street marches, rooftop speakers, flare smoke, mutual rescue, coded posters",
    civilizationAtmosphere: "movement culture, improvised mutual aid, surveillance pressure, collective defiance",
    culturalHabits: ["poster code phrases", "rooftop lookout shifts", "shared route changes under pressure"],
    narratorLens: "a singer inside a collective uprising who is also protecting one intimate bond",
    emotionalWeather: "defiance, adrenaline, tenderness, urgency, collective heat",
    refrainBehavior: "crowd-response chorus that turns private love into public refusal",
    structureMutation: "fast forward-driving verses, shouted pickups, choruses written for a crowd answer",
    languageStyleMix: "direct street language mixed with intimate declarations and urgent slogans",
    visualGrammar: "running camera, flare trails, stencils, crowd typography, siren color contrast",
    soundPressure: "percussive stomp, live drums, shouted gang vocals, guitar and brass hits",
    imageryAnchors: ["flare smoke", "poster paste", "rooftop antenna", "megaphone hiss", "street sparks"],
    dictionRules: ["direct language", "collective verbs", "romance inside motion"],
    antiTemplate: "do not soften this into generic inspirational positivity"
  }
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
  "Surreal cabaret"
];

function buildCssmvDynamicTitle(
  blueprint: ReturnType<typeof buildCssmvCreativeBlueprint>,
  language: string
) {
  const zh = String(language || "zh").toLowerCase().startsWith("zh");
  const titleBanks = zh
    ? {
        "mythic-rite": {
          lead: ["玄钟", "瑶台", "星诏", "天阙", "烬河", "霜铃"],
          tail: ["回潮", "断誓", "夜谕", "遗烬", "长汐", "远响"]
        },
        "neon-heartbreak": {
          lead: ["霓虹", "末班", "空站", "雨幕", "旧屏", "余电"],
          tail: ["未接", "失真", "回音", "余温", "慢闪", "断讯"]
        },
        "gravity-fiction": {
          lead: ["轨道", "失重", "晨轨", "氧焰", "冷舱", "星港"],
          tail: ["漂流", "回讯", "静压", "残频", "夜航", "返照"]
        },
        "pastoral-memory": {
          lead: ["河灯", "旧埠", "蝉夏", "稻风", "晚灶", "黄灯"],
          tail: ["慢信", "旧梦", "余响", "回南", "晚晴", "潮生"]
        },
        "surreal-cabaret": {
          lead: ["镜厅", "绒幕", "纸冠", "暗场", "夜戏", "金粉"],
          tail: ["私咒", "换幕", "回眸", "幻席", "偏光", "退场"]
        },
        "riot-romance": {
          lead: ["火线", "屋顶", "街电", "海报", "号角", "风灯"],
          tail: ["并肩", "余热", "同途", "回燃", "夜奔", "共振"]
        }
      }
    : {
        "mythic-rite": {
          lead: ["Jade", "Astral", "Temple", "Ashen", "Bell", "Eclipse"],
          tail: ["Vow", "Tide", "Edict", "Afterglow", "Echo", "Undertow"]
        },
        "neon-heartbreak": {
          lead: ["Neon", "Midnight", "Platform", "Static", "Rain", "Motel"],
          tail: ["Voicemail", "Afterheat", "Blur", "Disconnect", "Echo", "Spark"]
        },
        "gravity-fiction": {
          lead: ["Orbit", "Oxygen", "Signal", "Airlock", "Redshift", "Drift"],
          tail: ["Bloom", "Lifeline", "Afterburn", "Telemetry", "Undersky", "Return"]
        },
        "pastoral-memory": {
          lead: ["River", "Harvest", "Porchlight", "Cicada", "Lantern", "Letter"],
          tail: ["Memory", "Afterglow", "Return", "Softfall", "Summer", "Undertide"]
        },
        "surreal-cabaret": {
          lead: ["Velvet", "Mirror", "Paper", "Shadow", "Gold", "Mask"],
          tail: ["Spell", "Curtain", "Turn", "Whisper", "Riot", "Encore"]
        },
        "riot-romance": {
          lead: ["Flare", "Poster", "Rooftop", "March", "Siren", "Spark"],
          tail: ["Promise", "Signal", "Heartbeat", "Afterglow", "Route", "Rescue"]
        }
      };
  const bank =
    titleBanks[blueprint.id as keyof typeof titleBanks] ||
    titleBanks["mythic-rite" as keyof typeof titleBanks];
  const lead = bank.lead[blueprint.hash % bank.lead.length] || bank.lead[0] || "CSS";
  const tail =
    bank.tail[Math.floor(blueprint.hash / 7) % bank.tail.length] || bank.tail[0] || "MV";
  return zh ? `${lead}${tail}` : `${lead} ${tail}`;
}

function containsCssmvBlockedPhrase(value: string) {
  const text = String(value || "");
  return CSSMV_STALE_PHRASE_BLOCKLIST.some((phrase) =>
    text.toLowerCase().includes(String(phrase).toLowerCase())
  );
}

function shouldRejectCssmvSeed(title: string, lyrics: string) {
  const normalizedTitle = String(title || "").trim();
  if (CSSMV_STALE_TITLE_BLOCKLIST.includes(normalizedTitle)) return true;
  return containsCssmvBlockedPhrase(normalizedTitle) || containsCssmvBlockedPhrase(lyrics);
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
  const seed = [
    input.variationNonce || "",
    input.title || "",
    input.transcript || "",
    input.style || "",
    input.voice || "",
    input.language || "",
    input.mode || ""
  ].join("|");
  const hash = hashCssmvSeed(seed || "cssmv");
  const family =
    CSSMV_CREATIVE_FAMILIES[hash % CSSMV_CREATIVE_FAMILIES.length] ||
    CSSMV_CREATIVE_FAMILIES[0];
  return {
    ...family,
    hash,
    seedTag: `${family.id}-${hash % 10000}`
  };
}

function buildCssmvCreativeSummary(
  blueprint: ReturnType<typeof buildCssmvCreativeBlueprint>
) {
  const compact = [
    blueprint.civilizationAtmosphere,
    blueprint.narratorLens,
    blueprint.emotionalWeather,
    blueprint.structureMutation
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
    compact
  };
}

const CSSMV_CANONICAL_SECTIONS = [
  {
    section: "Intro",
    title: "Opening Atmosphere",
    bars: 8,
    energy: "low",
    focus: "world-opening atmosphere and motif seed",
    visualRole: "cosmic prelude and title reveal"
  },
  {
    section: "Verse 1",
    title: "Theme Arrival",
    bars: 16,
    energy: "medium-low",
    focus: "hero or central image enters the world",
    visualRole: "character reveal and symbolic first look"
  },
  {
    section: "Verse 2",
    title: "Background Expansion",
    bars: 16,
    energy: "medium",
    focus: "space, time, memory, and emotional context expand",
    visualRole: "worldbuilding montage and environment detail"
  },
  {
    section: "Chorus 1",
    title: "First Invocation",
    bars: 16,
    energy: "high",
    focus: "core chant and emotional lift",
    visualRole: "first public hook and particle ignition"
  },
  {
    section: "Verse 3",
    title: "Inner Conflict",
    bars: 16,
    energy: "medium",
    focus: "conflict, contrast, or inner fracture deepens",
    visualRole: "duality shots, mirrors, and opposing motion"
  },
  {
    section: "Verse 4",
    title: "World Expansion",
    bars: 16,
    energy: "medium-high",
    focus: "conflict widens into myth, society, or destiny",
    visualRole: "larger stage, wider shots, stronger movement"
  },
  {
    section: "Chorus 2",
    title: "Memory Seal",
    bars: 16,
    energy: "high",
    focus: "repeatable signature line, stronger and more communal",
    visualRole: "recognizable refrain, call-and-response visuals"
  },
  {
    section: "Bridge",
    title: "Cosmic Turn",
    bars: 12,
    energy: "medium-high",
    focus: "philosophical lift, origin question, or cosmic reversal",
    visualRole: "surreal shift, metaphysical imagery, slow camera drift"
  },
  {
    section: "Chorus 3",
    title: "Visual Burst",
    bars: 16,
    energy: "peak",
    focus: "visual explosion point and emotionally undeniable release",
    visualRole: "main cssMV blast, particle storm, rapid cut crescendo"
  },
  {
    section: "Chorus 4",
    title: "Final Lift",
    bars: 16,
    energy: "peak-plus",
    focus: "ultimate refrain, possible key lift, stacked voices",
    visualRole: "final maximal release and anthem framing"
  },
  {
    section: "Outro",
    title: "Echo Hook",
    bars: 8,
    energy: "medium-low",
    focus: "afterglow, unresolved echo, invitation to return",
    visualRole: "fade into symbol, orbit, or unanswered horizon"
  }
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
    ["[终章]", "Outro"]
  ]);
  if (exactMap.has(cleaned)) return exactMap.get(cleaned) || "";
  const bare = cleaned.replace(/^\[/, "").replace(/\]$/, "");
  const beforeColon = bare.split(":")[0]?.trim() || bare.trim();
  const ascii = beforeColon.toLowerCase();
  const aliasMap: Record<string, string> = {
    intro: "Intro",
    "opening hymn": "Intro",
    "verse 1": "Verse 1",
    "verse1": "Verse 1",
    "verse 2": "Verse 2",
    "verse2": "Verse 2",
    "chorus 1": "Chorus 1",
    "chorus1": "Chorus 1",
    "verse 3": "Verse 3",
    "verse3": "Verse 3",
    "verse 4": "Verse 4",
    "verse4": "Verse 4",
    "chorus 2": "Chorus 2",
    "chorus2": "Chorus 2",
    bridge: "Bridge",
    "chorus 3": "Chorus 3",
    "chorus3": "Chorus 3",
    "chorus 4": "Chorus 4",
    "chorus4": "Chorus 4",
    outro: "Outro",
    "closing echo": "Outro"
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
      const title = inside.includes(":") ? inside.split(":").slice(1).join(":").trim() : "";
      if (normalized === "Intro") {
        out.push("[Intro]");
      } else if (normalized) {
        out.push(title ? `[${normalized}: ${title}]` : `[${normalized}: ${normalized}]`);
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
  blueprint?: ReturnType<typeof buildCssmvCreativeBlueprint>
) {
  return CSSMV_CANONICAL_SECTIONS.map((row, index) => {
    const imagery = blueprint?.imageryAnchors[index % (blueprint?.imageryAnchors.length || 1)] || row.focus;
    const familyLabel = blueprint?.familyLabel || "cssMV cinematic";
    const titleHint =
      row.section === "Intro"
        ? row.title
        : `${row.title} · ${blueprint?.familyLabel || "Original Arc"}`;
    return {
      section: row.section,
      title: titleHint,
      prompt: `${row.section} · ${titleHint}. Create a ${familyLabel.toLowerCase()} scene for "${title}" that emphasizes ${row.visualRole}, leans into ${imagery}, and feels specific rather than generic.`
    };
  });
}

function buildDefaultCssmvSectionBeats(blueprint?: ReturnType<typeof buildCssmvCreativeBlueprint>) {
  return CSSMV_CANONICAL_SECTIONS.map((row, index) => {
    const variedBars = Math.max(
      8,
      row.bars + (((blueprint?.hash || 0) + index) % 3 === 0 ? 4 : ((blueprint?.hash || 0) + index) % 4 === 0 ? -4 : 0)
    );
    const focus = blueprint
      ? `${row.focus}; anchor it in ${blueprint.imageryAnchors[index % blueprint.imageryAnchors.length]} and ${blueprint.emotionalWeather}`
      : row.focus;
    const visualRole = blueprint
      ? `${row.visualRole}; rendered through ${blueprint.visualGrammar}`
      : row.visualRole;
    return {
      section: row.section,
      title: blueprint && row.section !== "Intro" ? `${row.title} · ${blueprint.familyLabel}` : row.title,
      bars: variedBars,
      energy: row.energy,
      focus,
      visual_role: visualRole
    };
  });
}

function pickCssmvSeedTitle(
  styleHint: string,
  transcript: string,
  variationNonce?: string,
  blueprint?: ReturnType<typeof buildCssmvCreativeBlueprint>,
  language?: string
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
    : ["Starlit Invocation", "Echo of the Ninth Sky", "Velvet Spell", "Afterglow Anthem"];
  const seedSource = [styleHint || "cssmv", transcript || "", variationNonce || ""].join("|");
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
  }
) {
  const blueprint = buildCssmvCreativeBlueprint(input);
  const normalizedLanguage = String(input.language || "zh").toLowerCase();
  const zh = normalizedLanguage.startsWith("zh");
  const ja = normalizedLanguage.startsWith("ja");
  if (ja) {
    const responseWord = "応えて";
    const japaneseSections = [
      ["[Intro]", "（息を潜めた導入、光が別の重力を選びはじめる）"],
      [`[Verse 1: ${title}の影]`, `${title}は${blueprint.storyWorld}の匂いをまとって静かに現れる`, `この歌はありふれた言い換えではなく、${blueprint.familyLabel}の規律から生まれた傷を具体物で示す`, `${responseWord}、まだ消えないで`],
      [`[Verse 2: ${blueprint.imageryAnchors[0]}の記録]`, `壁も指先も${blueprint.civilizationAtmosphere}の癖を覚えている`, `感情は抽象名詞ではなく、${blueprint.emotionalWeather}として身体に降ってくる`, `${responseWord}、息を合わせて`],
      ["[Chorus 1: 最初の開口]", `${title}を合図ではなく引き金として歌う`, `副歌は安全な反復ではなく、この世界だけの合唱へ曲がっていく`, `${responseWord}、ここへ来て`],
      ["[Verse 3: 規則のひび]", `ここで衝突は内面だけに留まらず、しぐさや礼儀まで書き換えはじめる`, `前の版の型をなぞらず、別の文明の痛みとして言葉を立てる`, `${responseWord}、目をそらさないで`],
      [`[Verse 4: ${blueprint.imageryAnchors[1]}の拡張]`, `私的な願いが広場や天井や群衆の歩幅にまで漏れ出していく`, `歌の外側にある社会の規則ごと、この一曲のために変質していく`, `${responseWord}、列を崩さないで`],
      ["[Chorus 2: 変異する記憶]", `同じ鈎が戻ってきても、意味はもう別人の顔をしている`, `覚えやすさよりも、この世界の温度差を残すことを優先する`, `${responseWord}、もっと近くへ`],
      ["[Bridge: 新しい法則]", `橋では風景そのものの論理を裏返し、告白より先に景色を変える`, `答えは理屈ではなく、像と圧と震えとして先に届く`, `${responseWord}、空を反転させて`],
      ["[Chorus 3: 眩しい爆心]", `粒子も視線も文字も呼吸も、${blueprint.visualGrammar}の規則でいっせいに暴れる`, `ここが最大の引火点だが、前より大きいだけの繰り返しにはしない`, `${responseWord}、燃え移って`],
      ["[Chorus 4: 変わって戻る]", `戻ってきた私は、ただ声量が増したのではなく、重力の種類ごと変わっている`, `最初の孤独はここで群衆にも廃墟にもなりうる`, `${responseWord}、忘れないで`],
      ["[Outro: 残響の外側]", `結末は閉じず、遠くでまだ息をしている像だけを残す`, `もう一度${title}と呼ばれたら、この歌は別の文明から帰ってくる`, `${responseWord}、あとでまた`]
    ];
    return japaneseSections.map((chunk) => chunk.join("\n")).join("\n\n");
  }
  if (!zh) {
    const responseWord = blueprint.refrainBehavior.split(",")[0] || "Call back";
    const englishSections = [
      ["[Intro]", "Instrumental lights flicker, the room chooses a new gravity"],
      [`[Verse 1: ${blueprint.imageryAnchors[0]} Arrival]`, `${title} walks in wearing the weather of ${blueprint.storyWorld}`, `I name the wound in specific objects so the song cannot hide in abstraction`, `${responseWord}: stay audible`],
      [`[Verse 2: ${blueprint.imageryAnchors[1]} Memory]`, `Every wall keeps proof that this story belongs to ${blueprint.familyLabel.toLowerCase()}`, `The details are tactile, risky, and impossible to confuse with a stock anthem`, `${responseWord}: hold the signal`],
      [`[Chorus 1: First Break Open]`, `Say my title like a trigger, not a slogan`, `Let the hook bend toward ${blueprint.emotionalWeather} instead of easy glory`, `${responseWord}: answer me`],
      [`[Verse 3: Fracture Logic]`, `Now the conflict changes shape and the room starts arguing back`, `I make the listener see the cost in close-up, not in cloudy fate language`, `${responseWord}: don't look away`],
      [`[Verse 4: ${blueprint.imageryAnchors[2]} Expansion]`, `The world gets wider, stranger, and more public with every line`, `Private desire leaks into the architecture of the whole scene`, `${responseWord}: hold the line`],
      [`[Chorus 2: Hook Mutation]`, `The chorus returns altered, bruised, and harder to forget`, `It feels communal now, but not safe`, `${responseWord}: louder now`],
      [`[Bridge: New Physics]`, `Here the song changes logic and asks a larger question`, `The answer arrives as image first, then pressure, then confession`, `${responseWord}: invert the sky`],
      [`[Chorus 3: Visual Detonation]`, `Everything bursts according to ${blueprint.visualGrammar}`, `The hook turns irreversible under maximum motion`, `${responseWord}: burn bright`],
      [`[Chorus 4: Changed Return]`, `I come back changed, not merely louder`, `What began as one feeling now carries a whole crowd or a whole ruin`, `${responseWord}: remember this`],
      [`[Outro: Afterimage]`, `Leave one unsettled image on the horizon and let it keep breathing`, `The ending must feel earned but unfinished`, `${responseWord}: come back later`]
    ];
    return englishSections.map((chunk) => chunk.join("\n")).join("\n\n");
  }
  const pickByHash = (choices: string[], offset: number) =>
    choices[(blueprint.hash + offset) % choices.length] || choices[0] || "";
  const zhResponse = pickByHash(
    ["回应：先别退场", "回应：把火留住", "回应：别松开手", "回应：继续靠近", "回应：别让它停"],
    3
  );
  const zhSections = [
    [
      "[Intro]",
      "（器乐与氛围铺垫）",
      pickByHash(
        [
          `这一版从${blueprint.storyWorld}出发，不再重复旧模板`,
          `先把${blueprint.civilizationAtmosphere}点亮，再让旋律决定往哪种命运偏航`,
          `我不急着解释立场，先把${blueprint.storyWorld}推到你眼前`
        ],
        5
      )
    ],
    [
      `[Verse 1: ${blueprint.imageryAnchors[0]}入场]`,
      pickByHash(
        [
          `${title}先从${blueprint.imageryAnchors[0]}里显影，不向现成宣言借力`,
          `${title}先停在${blueprint.imageryAnchors[0]}旁边，再慢慢逼近人群的耳边`,
          `我让${title}先落在${blueprint.imageryAnchors[0]}上，再让整个现场学会怎么称呼它`
        ],
        7
      ),
      pickByHash(
        [
          `先把${blueprint.familyLabel}的空气、礼法和疼痛逐件摆出来，再让旋律开口`,
          `我拒绝空喊情绪，宁可先把${blueprint.familyLabel}的细节一件件钉在现场里`,
          `与其重复万能句，不如让${blueprint.familyLabel}的纹理、规矩和体温先长进歌词里`
        ],
        11
      ),
      zhResponse
    ],
    [
      `[Verse 2: ${blueprint.imageryAnchors[1]}存档]`,
      pickByHash(
        [
          `记忆落在${blueprint.imageryAnchors[1]}上，光线和气味都开始作证`,
          `${blueprint.imageryAnchors[1]}记下谁在迟疑，谁把沉默当成借口`,
          `我把证词压进${blueprint.imageryAnchors[1]}，让场景替人开口`
        ],
        13
      ),
      pickByHash(
        [
          `情绪不是抽象的命运，而是${blueprint.emotionalWeather}一步一步逼近胸口`,
          `${blueprint.emotionalWeather}不是旁白，它是贴着皮肤推进来的天气`,
          `这次情绪不躲在大词里，它直接带着${blueprint.emotionalWeather}来敲门`
        ],
        17
      ),
      pickByHash(["回应：把名字留下", "回应：继续作证", "回应：别把灯熄灭"], 19)
    ],
    [
      "[Chorus 1: 第一次破门]",
      pickByHash(
        [
          `把${title}唱成一把钥匙，不唱成空泛宣言`,
          `副歌第一次开门时，我只允许${title}像钥匙一样转动`,
          `我要把${title}唱成触发器，而不是谁都能借走的漂亮口号`
        ],
        23
      ),
      pickByHash(
        [
          `让副歌先撬开伤口，再把人群慢慢带进来`,
          `先让这一句把裂缝掰开，再让更多呼吸接进来`,
          `副歌不负责安慰，它先负责把门撞开`
        ],
        29
      ),
      pickByHash(["回应：跟上我", "回应：一起进来", "回应：别退回去"], 31)
    ],
    [
      "[Verse 3: 冲突转面]",
      pickByHash(
        [
          `此刻矛盾不再只在心里，它开始改写房间、街道和彼此的站位`,
          `冲突忽然有了形体，它挤进房间，也挤进彼此的步伐`,
          `从这一段起，问题不再只属于内心，它开始重新排列整个现场`
        ],
        37
      ),
      pickByHash(
        [
          `我不用旧神话兜底，我让风险直接长在句子里`,
          `我不借旧圣歌抬高自己，我让风险明晃晃地留在字面上`,
          `这次不靠熟模板撑场，我让危险直接写进每一行`
        ],
        41
      ),
      pickByHash(["回应：别移开眼", "回应：先承认它", "回应：站稳这里"], 43)
    ],
    [
      `[Verse 4: ${blueprint.imageryAnchors[2]}扩城]`,
      pickByHash(
        [
          `故事忽然变大，连远处的天色和噪声都加入了证词`,
          `${blueprint.imageryAnchors[2]}一出现，整个场景都被迫扩容`,
          `从这一拍开始，远处的风声、灯色、围观者都成了证人`
        ],
        47
      ),
      pickByHash(
        [
          `私人欲望推开了更大的舞台，世界被迫回应`,
          `一开始只是私人心愿，现在却把更大的秩序一起牵动`,
          `这点私人的偏执终于把整个世界都拖进回应里`
        ],
        53
      ),
      pickByHash(["回应：继续上行", "回应：再推远一点", "回应：把边界撑开"], 59)
    ],
    [
      "[Chorus 2: 副歌变体]",
      pickByHash(
        [
          `同一句钩子再回来时，意思已经变了，伤口也有了新纹路`,
          `副歌第二次归来时，已经不肯重复第一次的脸`,
          `同一句再度响起，已经带着不同的伤口和不同的命令`
        ],
        61
      ),
      pickByHash(
        [
          `这一次它更像集体回声，却依然带着危险`,
          `它开始像群体回声，但危险感一点没有变淡`,
          `它终于像合唱了，可里面还是藏着锋利的边`
        ],
        67
      ),
      pickByHash(["回应：一起喊出", "回应：抬高一点", "回应：别把声线收回"], 71)
    ],
    [
      "[Bridge: 新物理]",
      pickByHash(
        [
          `桥段不负责重复，它负责掀桌，负责提出更大的问题`,
          `桥段来到这里，不是为了过渡，而是为了改写规则`,
          `从桥开始，逻辑会换轨，问题也会突然变大`
        ],
        73
      ),
      pickByHash(
        [
          `答案先以画面降临，再以震动进入身体，最后才变成承认`,
          `先到达的不是结论，而是画面、压力和身体反应`,
          `承认来得最晚，先来的总是图像和震感`
        ],
        79
      ),
      pickByHash(["回应：把天翻过来", "回应：先让规则失效", "回应：把门轴扭断"], 83)
    ],
    [
      "[Chorus 3: 视觉引爆]",
      pickByHash(
        [
          `粒子、镜头、字体、呼吸在这里一起失控`,
          `这一轮副歌里，镜头、粒子和呼吸都不再服从原本秩序`,
          `到了这里，一切可见之物都开始跟着副歌偏航`
        ],
        89
      ),
      pickByHash(
        [
          `我要让这次爆发属于${blueprint.visualGrammar}，而不是任何熟悉圣歌的复制品`,
          `这次引爆只属于${blueprint.visualGrammar}，不借任何现成圣歌的壳`,
          `我要让它长成${blueprint.visualGrammar}的样子，而不是回头抄旧胜利姿态`
        ],
        97
      ),
      pickByHash(["回应：让它燃烧", "回应：别关掉镜头", "回应：把亮度推满"], 101)
    ],
    [
      "[Chorus 4: 变身归来]",
      pickByHash(
        [
          `最后一次副歌不是更大声而已，而是整个人已经换了重力`,
          `最后回来时，变化不止是音量，而是整个人的物理法则都不同了`,
          `这一轮归来不只是抬高声量，而是连重力和站姿都换掉了`
        ],
        103
      ),
      pickByHash(
        [
          `一开始的那点情绪，此刻要么变成人群，要么变成废墟里的新秩序`,
          `最初那点私人感受，到这里已经足够长成人群或秩序`,
          `开头那点隐秘情绪，现在已经可以变成广场，也可以变成废墟后的新规则`
        ],
        107
      ),
      pickByHash(["回应：记住现在", "回应：把这一刻留下", "回应：别让它退回去"], 109)
    ],
    [
      "[Outro: 余烬挂钩]",
      pickByHash(
        [
          `别把门关死，让最后一幅画面继续在远处呼吸`,
          `结尾别急着熄灯，让最后那幅景象继续留在远处喘息`,
          `我要把门留一道缝，让那幅画在远处继续呼吸`
        ],
        113
      ),
      pickByHash(
        [
          `如果有人再叫一次${title}，它就会从另一种命运里回来`,
          `下次谁再叫${title}，它会带着另一种命运折返`,
          `只要再有人叫起${title}，它就会从另一条命运线里归来`
        ],
        127
      ),
      pickByHash(["回应：未完待续", "回应：以后还会回来", "回应：把余烬留着"], 131)
    ]
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
}) {
  const blueprint = buildCssmvCreativeBlueprint(input);
  const title =
    String(input.title || "").trim() ||
    pickCssmvSeedTitle(input.style, input.transcript, input.variationNonce, blueprint, input.language);
  const style = String(input.style || "Chinese GuFeng / Neo Opera").trim();
  const voice = String(input.voice || "Feminine").trim();
  return {
    model: "fallback-template",
    title,
    lyrics: buildFallbackCssmvLyrics(title, input),
    music_style: `${style} · ${voice} vocal lead · ${blueprint.soundPressure}. Build toward a transformed Chorus 4, not a copied loop.`,
    references: [
      `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(title)}`,
      `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(blueprint.familyLabel)}`,
      `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(blueprint.imageryAnchors[0])}`
    ],
    music_structure: `Intro opens with ${blueprint.emotionalWeather}, Verses 1-4 expand the chosen story world, Chorus 1 establishes the first hook, Chorus 2 mutates it, Bridge breaks the song's logic open, Chorus 3 detonates the visual peak, Chorus 4 returns transformed, and Outro leaves an afterimage rather than closure.`,
    video_outline:
      `Use "${title}" as a ${blueprint.familyLabel.toLowerCase()} cssMV arc: start inside ${blueprint.storyWorld}, reveal the conflict through ${blueprint.visualGrammar}, let the bridge open a new reality rule, explode the main visual language in Chorus 3, and end with an unresolved afterimage.`,
    section_prompts: buildDefaultCssmvSectionPrompts(title, blueprint),
    section_beats: buildDefaultCssmvSectionBeats(blueprint),
    style_tags: [style, voice, blueprint.id, "cssmv", ...blueprint.imageryAnchors.slice(0, 2)],
    creative_summary: buildCssmvCreativeSummary(blueprint)
  };
}

async function generateCssmvSongSeed(input: {
  mode: string;
  transcript: string;
  title: string;
  style: string;
  voice: string;
  language: string;
  variationNonce?: string;
}) {
  const blankSeedRequest = !String(input.title || "").trim() && !String(input.transcript || "").trim();
  if (blankSeedRequest) return buildFallbackCssmvSongSeed(input);
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) return buildFallbackCssmvSongSeed(input);
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
  const timeoutMs = Math.max(
    5000,
    Number.parseInt(String(process.env.OPENAI_TEXT_TIMEOUT_MS || "30000"), 10) || 30000
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const messages = [
      {
        role: "system" as const,
        content:
          "Generate structured creative seeds for cssMV. Favor bold divergence, vivid specificity, and materially different song identities across variations while preserving the requested title and output schema."
      },
      {
        role: "user" as const,
        content: buildCssmvSongSeedPrompt(input)
      }
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
              items: { type: "string" }
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
                  prompt: { type: "string" }
                },
                required: ["section", "title", "prompt"]
              }
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
                  visual_role: { type: "string" }
                },
                required: ["section", "title", "bars", "energy", "focus", "visual_role"]
              }
            },
            style_tags: {
              type: "array",
              items: { type: "string" }
            }
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
            "style_tags"
          ]
        }
      }
    };
    const requestPayload = async (responseFormat?: Record<string, unknown>) => {
      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          ...(responseFormat ? { response_format: responseFormat } : {})
        }),
        signal: controller.signal
      });
      const payload = await upstream.json().catch(() => null);
      if (!upstream.ok) return null;
      const content = String(payload?.choices?.[0]?.message?.content || "").trim();
      if (!content) return null;
      try {
        return JSON.parse(content);
      } catch {
        const match = content.match(/\{[\s\S]*\}$/);
        if (!match) return null;
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
    };
    const parsed =
      (await requestPayload(jsonSchema)) ||
      (await requestPayload({ type: "json_object" })) ||
      null;
    if (!parsed) return buildFallbackCssmvSongSeed(input);
    const title = String(parsed?.title || "").trim();
    const rawLyrics = String(parsed?.lyrics || "").trim();
    const musicStyle = String(parsed?.music_style || "").trim();
    const referencesRaw = Array.isArray(parsed?.references)
      ? parsed.references.map((x: unknown) => String(x || "").trim()).filter(Boolean)
      : [];
    const musicStructure = String(parsed?.music_structure || "").trim();
    const videoOutline = String(parsed?.video_outline || "").trim();
    const sectionPrompts = Array.isArray(parsed?.section_prompts)
      ? parsed.section_prompts
          .map((item: unknown) => {
            const row = item as { section?: unknown; title?: unknown; prompt?: unknown };
            return {
              section: String(row?.section || "").trim(),
              title: String(row?.title || "").trim(),
              prompt: String(row?.prompt || "").trim()
            };
          })
          .filter((item: { section: string; title: string; prompt: string }) => item.section && item.title && item.prompt)
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
              visual_role: String(row?.visual_role || "").trim()
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
              item.visual_role
          )
      : [];
    const styleTags = Array.isArray(parsed?.style_tags)
      ? parsed.style_tags.map((x: unknown) => String(x || "").trim()).filter(Boolean)
      : [];
    const normalizedLyrics = normalizeCssmvLyrics(rawLyrics);
    const references = referencesRaw.map((ref: string) => {
      if (/^https?:\/\//i.test(ref)) return ref;
      return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(ref)}`;
    });
    if (!title || !normalizedLyrics) return buildFallbackCssmvSongSeed(input);
    if (!lyricsMatchTargetLanguage(normalizedLyrics, input.language)) {
      return buildFallbackCssmvSongSeed(input);
    }
    if (shouldRejectCssmvSeed(title, normalizedLyrics)) {
      return buildFallbackCssmvSongSeed(input);
    }
    const blueprint = buildCssmvCreativeBlueprint(input);
    const defaultSectionPrompts = buildDefaultCssmvSectionPrompts(title, blueprint);
    const defaultSectionBeats = buildDefaultCssmvSectionBeats(blueprint);
    return {
      model,
      title,
      lyrics: normalizedLyrics,
      music_style: musicStyle,
      references,
      music_structure:
        musicStructure ||
        "Begin with a low-energy atmospheric intro, grow through Verses 1-4, make Chorus 1 and Chorus 2 chantable, lift into a cosmic Bridge, explode at Chorus 3, intensify further at Chorus 4, and land with an unresolved Outro echo.",
      video_outline: videoOutline,
      section_prompts:
        sectionPrompts.length === CSSMV_CANONICAL_SECTIONS.length
          ? sectionPrompts.map((
              item: { section: string; title: string; prompt: string },
              index: number
            ) => ({
              section: normalizeCssmvSectionLabel(item.section) || defaultSectionPrompts[index]?.section || item.section,
              title: item.title || defaultSectionPrompts[index]?.title || item.section,
              prompt: item.prompt
            }))
          : defaultSectionPrompts,
      section_beats:
        sectionBeats.length === CSSMV_CANONICAL_SECTIONS.length
          ? sectionBeats.map((
              item: {
                section: string;
                title: string;
                bars: number;
                energy: string;
                focus: string;
                visual_role: string;
              },
              index: number
            ) => ({
              section: normalizeCssmvSectionLabel(item.section) || defaultSectionBeats[index]?.section || item.section,
              title: item.title || defaultSectionBeats[index]?.title || item.section,
              bars: item.bars || defaultSectionBeats[index]?.bars || 8,
              energy: item.energy || defaultSectionBeats[index]?.energy || "medium",
              focus: item.focus || defaultSectionBeats[index]?.focus || "",
              visual_role: item.visual_role || defaultSectionBeats[index]?.visual_role || ""
            }))
          : defaultSectionBeats,
      style_tags: styleTags,
      creative_summary: buildCssmvCreativeSummary(blueprint)
    };
  } catch {
    return buildFallbackCssmvSongSeed(input);
  } finally {
    clearTimeout(timeout);
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
    const prompt = buildCssmvThumbnailPrompt(title, subtitle, lyrics);
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const requestedSize = String(req.body?.size || process.env.OPENAI_IMAGE_SIZE || "1024x1024").trim();
    const size = ["1024x1024", "1024x1536", "1536x1024", "auto"].includes(requestedSize)
      ? requestedSize
      : "1024x1024";
    const requestedQuality = String(req.body?.quality || process.env.OPENAI_IMAGE_QUALITY || "low").trim();
    const quality = ["low", "medium", "high", "auto"].includes(requestedQuality)
      ? requestedQuality
      : "low";
    const requestedOutputFormat = String(
      req.body?.output_format || process.env.OPENAI_IMAGE_OUTPUT_FORMAT || "webp"
    ).trim();
    const outputFormat = ["webp", "png", "jpeg"].includes(requestedOutputFormat)
      ? requestedOutputFormat
      : "webp";
    const requestedCompression = Number.parseInt(
      String(req.body?.output_compression || process.env.OPENAI_IMAGE_OUTPUT_COMPRESSION || "60"),
      10
    );
    const outputCompression =
      Number.isFinite(requestedCompression) && requestedCompression >= 0 && requestedCompression <= 100
        ? requestedCompression
        : 60;
    const requestedBackground = String(
      req.body?.background || process.env.OPENAI_IMAGE_BACKGROUND || "transparent"
    ).trim();
    const background = ["transparent", "opaque", "auto"].includes(requestedBackground)
      ? requestedBackground
      : "transparent";
    const timeoutMs = Math.max(
      5000,
      Number.parseInt(String(process.env.OPENAI_IMAGE_TIMEOUT_MS || "45000"), 10) || 45000
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let upstream;
    let payload;
    try {
      upstream = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
          quality,
          output_format: outputFormat,
          output_compression: outputCompression,
          background
        }),
        signal: controller.signal
      });
      payload = await upstream.json().catch(() => null);
    } finally {
      clearTimeout(timeout);
    }
    if (!upstream.ok) {
      return res.status(upstream.status).json(
        okEmpty(
          { generated: false, model, size, quality, output_format: outputFormat, output_compression: outputCompression, background },
          "No data yet"
        )
      );
    }

    const first = payload?.data?.[0] || null;
    const b64 = typeof first?.b64_json === "string" ? first.b64_json : "";
    const imageUrl = typeof first?.url === "string" ? first.url : "";
    if (b64) {
      return res.json(
        okData({
          generated: true,
          image_data_url: `data:image/${outputFormat};base64,${b64}`,
          model,
          size,
          quality,
          output_format: outputFormat,
          output_compression: outputCompression,
          background
        })
      );
    }
    if (imageUrl) {
      return res.json(
        okData({
          generated: true,
          image_url: imageUrl,
          model,
          size,
          quality,
          output_format: outputFormat,
          output_compression: outputCompression,
          background
        })
      );
    }
    return res.json(
      okEmpty(
        { generated: false, model, size, quality, output_format: outputFormat, output_compression: outputCompression, background },
        "No data yet"
      )
    );
  } catch (_err) {
    return res.json(okEmpty({ generated: false }, "No data yet"));
  }
});

app.post("/api/cssmv/song-seed", async (req, res) => {
  noStore(res);
  try {
    const mode = String(req.body?.mode || "music_video").trim();
    const transcript = String(req.body?.transcript || "").trim();
    const title = String(req.body?.title || "").trim();
    const style = String(req.body?.style || "").trim();
    const voice = String(req.body?.voice || "").trim();
    const language = String(req.body?.language || "zh").trim();
    const variationNonce = String(req.body?.variation_nonce || "").trim();
    const seed = await generateCssmvSongSeed({
      mode,
      transcript,
      title,
      style,
      voice,
      language,
      variationNonce
    });
    if (!seed) {
      return res.json(okEmpty({ generated: false }, "No data yet"));
    }
    return res.json(
      okData({
        generated: true,
        title: seed.title,
        lyrics: seed.lyrics,
        music_style: seed.music_style,
        references: seed.references,
        music_structure: seed.music_structure,
        video_outline: seed.video_outline,
        section_prompts: seed.section_prompts,
        section_beats: seed.section_beats,
        style_tags: seed.style_tags,
        creative_summary: seed.creative_summary,
        model: seed.model
      })
    );
  } catch {
    return res.json(okEmpty({ generated: false }, "No data yet"));
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

async function oauthExchangeTokenForm(tokenUrl: string, form: URLSearchParams) {
  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form.toString()
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
    await client.query("CREATE INDEX IF NOT EXISTS oauth_identities_user_id_idx ON oauth_identities(user_id)");
  });
}

function appBaseUrl(req: express.Request) {
  const envUrl = (process.env.APP_BASE_URL || "").trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = ((req.headers["x-forwarded-host"] as string) || req.headers.host || `localhost:${PORT}`).toString();
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function auditAuthLogin(req: express.Request, provider: string, userId: string, mode: string) {
  const ipRaw =
    (req.headers["x-forwarded-for"] as string) ||
    req.ip ||
    "";
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
      ts: new Date().toISOString()
    })
  );
}

function auditAuthFailure(provider: string, mode: string, errorCode: string) {
  console.warn(
    JSON.stringify({
      tag: "auth_login_failed",
      provider,
      mode,
      error_code: errorCode,
      ts: new Date().toISOString()
    })
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
  const clientId = process.env[`${key}_CLIENT_ID`] || "";
  const clientSecret = process.env[`${key}_CLIENT_SECRET`] || "";
  if (!authUrl || !tokenUrl || !userInfoUrl || !clientId || !clientSecret) return null;
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
    idKeys: (process.env[`${key}_ID_KEYS`] || "sub,id,user_id,data.id").split(",").map((x) => x.trim()).filter(Boolean),
    emailKeys: (process.env[`${key}_EMAIL_KEYS`] || "email,data.email").split(",").map((x) => x.trim()).filter(Boolean),
    nameKeys: (process.env[`${key}_NAME_KEYS`] || "name,username,login,data.name").split(",").map((x) => x.trim()).filter(Boolean)
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
  if (!clientId || !teamId || !keyId || !pem) throw new Error("apple_not_configured");
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
    audience: clientId
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
}) {
  const provider = String(args.provider || "").trim().toLowerCase();
  const providerUserId = String(args.providerUserId || "").trim();
  const email = normalizeEmail(args.email);
  const displayName = args.displayName || null;
  if (!provider || !providerUserId) throw new Error("oauth_identity_invalid");
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const found = await client.query<{ user_id: string }>(
        "SELECT user_id FROM oauth_identities WHERE provider = $1 AND provider_user_id = $2 LIMIT 1",
        [provider, providerUserId]
      );
      if (found.rows[0]?.user_id) {
        await client.query("COMMIT");
        return found.rows[0].user_id;
      }

      if (email) {
        const sameEmail = await client.query<{ id: string }>(
          "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
          [email]
        );
        const userIdByEmail = sameEmail.rows[0]?.id;
        if (userIdByEmail) {
          await client.query(
            `INSERT INTO oauth_identities (user_id, provider, provider_user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (provider, provider_user_id) DO NOTHING`,
            [userIdByEmail, provider, providerUserId]
          );
          await client.query("COMMIT");
          return userIdByEmail;
        }
      }

      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (display_name, email, avatar_url)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [displayName, email, null]
      );
      const userId = userRes.rows[0]?.id;
      if (!userId) throw new Error("user_create_failed");

      await client.query(
        `INSERT INTO oauth_identities (user_id, provider, provider_user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [userId, provider, providerUserId]
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
        [userId]
      )
    );
    for (const r of oauth.rows) providers.add(r.provider);
  }
  const pkCount = await passkeyCountBySubject(userSubjectKey(userId));
  if (pkCount > 0) providers.add("passkey");
  return {
    providers: Array.from(providers).sort(),
    passkeyCount: pkCount
  };
}

async function ensureBillingAccount(userId: string) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM billing_accounts WHERE user_id = $1",
      [userId]
    );
    if (rows[0]) return { account: rows[0], created: false };
    const insert = await client.query(
      `INSERT INTO billing_accounts (user_id) VALUES ($1) RETURNING *`,
      [userId]
    );
    return { account: insert.rows[0], created: true };
  });
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
      [args.userId, args.stripeCustomerId, args.email]
    )
  );
  return result.rows[0] || null;
}

async function ensureStripeCustomer(args: { userId: string; email: string | null; name: string | null }) {
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
    client.query<Row>("SELECT * FROM stripe_customers WHERE user_id = $1 LIMIT 1", [args.userId])
  );
  const current = existing.rows[0];
  if (current?.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(current.stripe_customer_id);
      if (!("deleted" in customer) || !customer.deleted) {
        if ((args.email && customer.email !== args.email) || (args.name && customer.name !== args.name)) {
          await stripe.customers.update(current.stripe_customer_id, {
            ...(args.email ? { email: args.email } : {}),
            ...(args.name ? { name: args.name } : {})
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
      cssos_user_id: args.userId
    }
  });
  return upsertStripeCustomerRow({
    userId: args.userId,
    email: args.email,
    stripeCustomerId: created.id
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
        args.defaultCurrency
      ]
    )
  );
  return result.rows[0] || null;
}

async function syncStripeConnectedAccount(account: Stripe.Account, userId?: string | null) {
  const accountId = String(account.id || "").trim();
  if (!accountId) return null;
  const resolvedUserId =
    userId ||
    String(account.metadata?.cssos_user_id || "").trim() ||
    null;
  if (!resolvedUserId) {
    const found = await withClient((client) =>
      client.query<{ user_id: string }>(
        "SELECT user_id FROM stripe_connected_accounts WHERE stripe_account_id = $1 LIMIT 1",
        [accountId]
      )
    );
    if (found.rows[0]?.user_id) {
      return upsertStripeConnectedAccountRow({
        userId: found.rows[0].user_id,
        stripeAccountId: account.id,
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        detailsSubmitted: Boolean(account.details_submitted),
        country: account.country || null,
        defaultCurrency: String(account.default_currency || process.env.STRIPE_CONNECT_DEFAULT_CURRENCY || "usd").toUpperCase()
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
    defaultCurrency: String(account.default_currency || process.env.STRIPE_CONNECT_DEFAULT_CURRENCY || "usd").toUpperCase()
  });
}

async function ensureStripeConnectedAccount(args: { userId: string; email: string | null; appBase: string }) {
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
    client.query<Row>("SELECT * FROM stripe_connected_accounts WHERE user_id = $1 LIMIT 1", [args.userId])
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
        defaultCurrency: String(account.default_currency || process.env.STRIPE_CONNECT_DEFAULT_CURRENCY || "usd").toUpperCase()
      });
    } catch {
      // Recreate below if Stripe side no longer has this account.
    }
  }
  const account = await stripe.accounts.create({
    type: (process.env.STRIPE_CONNECT_ACCOUNT_TYPE || "express") as "express" | "standard" | "custom",
    country: String(process.env.STRIPE_CONNECT_COUNTRY || "US").toUpperCase(),
    ...(args.email ? { email: args.email } : {}),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    },
    business_type: "individual",
    metadata: {
      cssos_user_id: args.userId,
      app_base: args.appBase
    }
  });
  return upsertStripeConnectedAccountRow({
    userId: args.userId,
    stripeAccountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    country: account.country || null,
    defaultCurrency: String(account.default_currency || process.env.STRIPE_CONNECT_DEFAULT_CURRENCY || "usd").toUpperCase()
  });
}

type CommerceProductKind = "listen" | "buyout";

async function resolveCommerceProduct(args: { workId: string; orderKind: CommerceProductKind }) {
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
         COALESCE(mp.rights_scope, 'personal_use') AS rights_scope
       FROM user_works w
       LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
       LEFT JOIN work_access_products wap
         ON wap.work_id = w.id
        AND wap.product_kind = $2
        AND wap.active = true
       WHERE w.id = $1
       LIMIT 1`,
      [args.workId, args.orderKind]
    )
  );

  const row = result.rows[0];
  if (!row) throw new Error("work_not_found");

  const preset = pricingPresetForWorkType(normalizeWorkType(row.work_type));
  const rawAmount =
    args.orderKind === "buyout"
      ? Number(row.amount_cents || row.current_buyout_price_cents || preset.buyoutCents || defaultBuyoutPriceCents())
      : Number(row.amount_cents || row.current_listen_price_cents || preset.listenCents || defaultListenPriceCents());
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    throw new Error("product_not_priced");
  }
  if (args.orderKind === "buyout" && !(row.buyout_enabled || rawAmount > 0)) {
    throw new Error("buyout_not_enabled");
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
          JSON.stringify({ seeded_by: "checkout_create", rights_scope: row.rights_scope })
        ]
      )
    );
    productId = inserted.rows[0]?.id || null;
  }

  return {
    productId,
    ownerUserId: row.owner_user_id,
    currency: String(row.currency || "USD").toUpperCase(),
    amountCents: rawAmount,
    title: row.title,
    rightsScope: row.rights_scope
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
        JSON.stringify(args.meta || {})
      ]
    )
  );
  return result.rows[0]?.id || null;
}

function appendQueryToUrl(raw: string, params: Record<string, string | null | undefined>) {
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
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
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
      [args.buyerUserId, args.workId]
    )
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
      [args.orderId || null, args.buyerUserId || null, args.checkoutSessionId || null, args.reason]
    )
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
}) {
  const role = String(args.structureRole || "").trim().toLowerCase();
  if (role === "act") return;
  const workType = normalizeWorkType(args.workType);
  const preset = inferWorkPricingPreset({ title: args.title, style: args.style, workType });
  const listenCents = Number.isFinite(Number(args.listenPriceCents)) && Number(args.listenPriceCents) > 0
    ? Number(args.listenPriceCents)
    : preset.listenCents;
  const buyoutCents = Number.isFinite(Number(args.buyoutPriceCents)) && Number(args.buyoutPriceCents) >= 0
    ? Number(args.buyoutPriceCents)
    : preset.buyoutCents;
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO work_market_profiles (
         work_id, owner_user_id, current_listen_price_cents, current_buyout_price_cents,
         tips_enabled, buyout_enabled, visibility, rights_scope
       ) VALUES ($1, $2, $3, $4, true, true, 'public', 'personal_use')
       ON CONFLICT (work_id)
       DO UPDATE SET
         owner_user_id = EXCLUDED.owner_user_id,
         current_listen_price_cents = COALESCE(work_market_profiles.current_listen_price_cents, EXCLUDED.current_listen_price_cents),
         current_buyout_price_cents = COALESCE(work_market_profiles.current_buyout_price_cents, EXCLUDED.current_buyout_price_cents),
         buyout_enabled = COALESCE(work_market_profiles.buyout_enabled, true),
         tips_enabled = COALESCE(work_market_profiles.tips_enabled, true),
         visibility = CASE
           WHEN work_market_profiles.visibility IS NULL OR work_market_profiles.visibility = 'private'
             THEN 'public'
           ELSE work_market_profiles.visibility
         END,
         updated_at = now()`,
      [args.workId, args.ownerUserId, listenCents, buyoutCents]
    );
    await client.query(
      `INSERT INTO work_access_products (work_id, owner_user_id, product_kind, currency, amount_cents, active, meta)
       VALUES ($1, $2, 'listen', 'USD', $3, true, $4::jsonb)
       ON CONFLICT (work_id, product_kind)
       DO UPDATE SET amount_cents = EXCLUDED.amount_cents, active = true, updated_at = now()`,
      [args.workId, args.ownerUserId, listenCents, JSON.stringify({ seeded_by: "work_create", pricing_preset: preset.label, work_type: workType })]
    );
    await client.query(
      `INSERT INTO work_access_products (work_id, owner_user_id, product_kind, currency, amount_cents, active, meta)
       VALUES ($1, $2, 'buyout', 'USD', $3, true, $4::jsonb)
       ON CONFLICT (work_id, product_kind)
       DO UPDATE SET amount_cents = EXCLUDED.amount_cents, active = true, updated_at = now()`,
      [args.workId, args.ownerUserId, buyoutCents, JSON.stringify({ seeded_by: "work_create", pricing_preset: preset.label, work_type: workType })]
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
    const existing = await client.query<{ meta: Record<string, unknown> | null }>(
      "SELECT meta FROM work_orders WHERE id = $1 LIMIT 1",
      [args.orderId]
    );
    const nextMeta = {
      ...((existing.rows[0]?.meta as Record<string, unknown> | null) || {}),
      ...(args.metaPatch || {})
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
        JSON.stringify(nextMeta)
      ]
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
      [args.orderId || null, args.checkoutSessionId || null, args.paymentIntentId || null]
    )
  );
  return result.rows[0] || null;
}

async function findStripeConnectedAccountByUserId(userId: string) {
  const result = await withClient((client) =>
    client.query<any>("SELECT * FROM stripe_connected_accounts WHERE user_id = $1 LIMIT 1", [userId])
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
      [args.ownerUserId, args.orderId]
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
        JSON.stringify({ order_id: args.orderId, ...(args.meta || {}) })
      ]
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
    const existing = await client.query<{ id: string; meta: Record<string, unknown> | null }>(
      `SELECT id, meta
       FROM payout_reconciliations
       WHERE meta->>'order_id' = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [args.orderId]
    );
    const row = existing.rows[0];
    if (!row?.id) return null;
    const nextMeta = {
      ...((row.meta as Record<string, unknown> | null) || {}),
      ...(args.metaPatch || {})
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
        JSON.stringify(nextMeta)
      ]
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
      [args.orderId]
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
        JSON.stringify({ source: "stripe_webhook" })
      ]
    );
    return inserted.rows[0]?.id || null;
  });
}

async function ensureDeferredSellerPayout(order: any) {
  if (Number(order.seller_net_cents || 0) <= 0) return { transferId: null, status: "no_payout_due" };
  const connected = await findStripeConnectedAccountByUserId(String(order.seller_user_id || ""));
  const availableAt = payoutAvailableAtForOrder(order);
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
      hold_days: stripePayoutHoldDays(),
      release_after: availableAt.toISOString()
    }
  });
  return { transferId: null, status: "pending_settlement", availableAt };
}

async function createSellerTransferIfPossible(order: any, chargeId: string | null) {
  if (!chargeId) return { transferId: null, status: "paid_no_charge" };
  if (Number(order.seller_net_cents || 0) <= 0) return { transferId: null, status: "no_payout_due" };
  const stripe = getStripeClient();
  if (!stripe) return { transferId: null, status: "stripe_not_configured" };
  const connected = await findStripeConnectedAccountByUserId(String(order.seller_user_id || ""));
  const availableAt = payoutAvailableAtForOrder(order);
  if (!connected?.stripe_account_id) {
    await updatePayoutReconciliationForOrder({
      orderId: String(order.id || ""),
      stripeConnectedAccountRowId: connected?.id || null,
      status: "pending_connected_account",
      availableAt,
      transferAttemptedAt: new Date(),
      metaPatch: { reason: "missing_connected_account" }
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
        seller_user_id: String(order.seller_user_id || "")
      }
    });
    await updatePayoutReconciliationForOrder({
      orderId: String(order.id || ""),
      stripeConnectedAccountRowId: connected.id || null,
      stripeTransferId: transfer.id,
      status: "transferred",
      transferAttemptedAt: new Date(),
      transferredAt: new Date(),
      metaPatch: { source_transaction: chargeId }
    });
    return { transferId: transfer.id, status: "transferred" };
  } catch (err) {
    await updatePayoutReconciliationForOrder({
      orderId: String(order.id || ""),
      stripeConnectedAccountRowId: connected.id || null,
      status: "transfer_failed",
      transferAttemptedAt: new Date(),
      metaPatch: { error: String(err) }
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
      [limit]
    )
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
      [event.id, event.type, Boolean(event.livemode), JSON.stringify(event)]
    );
    if (inserted.rows[0]?.id) {
      return { id: inserted.rows[0].id, alreadyProcessed: false };
    }
    const existing = await client.query<{ id: string; processed: boolean }>(
      "SELECT id, processed FROM stripe_webhook_events WHERE stripe_event_id = $1 LIMIT 1",
      [event.id]
    );
    return {
      id: existing.rows[0]?.id || null,
      alreadyProcessed: Boolean(existing.rows[0]?.processed)
    };
  });
}

async function markStripeWebhookEventProcessed(eventId: string, error?: string | null) {
  await withClient((client) =>
    client.query(
      `UPDATE stripe_webhook_events
       SET processed = $2,
           processed_at = CASE WHEN $2 THEN now() ELSE processed_at END,
           processing_error = $3
       WHERE stripe_event_id = $1`,
      [eventId, !error, error || null]
    )
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
    const orderId = String(session.metadata?.order_id || "").trim() || null;
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
    const order = await findOrderForStripeEvent({
      orderId,
      checkoutSessionId: session.id,
      paymentIntentId
    });
    if (!order) return;
    await updateWorkOrderStripeRefs({
      orderId: String(order.id),
      checkoutSessionId: session.id,
      paymentIntentId,
      status: "processing",
      metaPatch: {
        checkout_session_status: session.status,
        payment_status: session.payment_status
      }
    });
    return;
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = String(session.metadata?.order_id || "").trim() || null;
    await cancelPendingWorkOrder({
      orderId,
      checkoutSessionId: session.id,
      reason: "stripe_checkout_session_expired"
    });
    return;
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = String(intent.metadata?.order_id || "").trim() || null;
    const order = await findOrderForStripeEvent({
      orderId,
      paymentIntentId: intent.id
    });
    if (!order) return;
    await updateWorkOrderStripeRefs({
      orderId: String(order.id),
      paymentIntentId: intent.id,
      status: "failed",
      metaPatch: {
        payment_error: intent.last_payment_error?.message || null
      }
    });
    return;
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = String(intent.metadata?.order_id || "").trim() || null;
    const order = await findOrderForStripeEvent({
      orderId,
      paymentIntentId: intent.id
    });
    if (!order) return;
    const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id || null;
    const payout = await ensureDeferredSellerPayout(order);
    await updateWorkOrderStripeRefs({
      orderId: String(order.id),
      paymentIntentId: intent.id,
      chargeId,
      status: "paid",
      metaPatch: {
        transfer_status: payout.status,
        stripe_transfer_id: payout.transferId,
        payout_available_at: payout.availableAt?.toISOString?.() || null
      }
    });
    if (String(order.order_kind || "") === "buyout") {
      await insertOwnershipTransferIfMissing({
        workId: String(order.work_id || ""),
        fromUserId: String(order.seller_user_id || "") || null,
        toUserId: String(order.buyer_user_id || "") || null,
        orderId: String(order.id || ""),
        currency: String(order.currency || "USD"),
        transferAmountCents: Number(order.gross_amount_cents || 0)
      });
    }
  }
}

async function resetMonthIfNeeded(userId: string) {
  const monthKey = new Date().toISOString().slice(0, 7);
  await withClient(async (client) => {
    await client.query(
      `UPDATE billing_accounts
       SET month_key = $2, month_spent_cents = 0, updated_at = now()
       WHERE user_id = $1 AND month_key <> $2`,
      [userId, monthKey]
    );
  });
}

function setAuthSession(req: express.Request, userId: string, provider: string) {
  (req.session as any).user_id = userId;
  (req.session as any).passkey_subject_key = userSubjectKey(userId);
  (req.session as any).auth_provider = provider;
}

function isLocalDevRequest(req: express.Request) {
  const host = String(req.hostname || "").toLowerCase();
  return !IS_PROD && (host === "localhost" || host === "127.0.0.1");
}

async function ensureDevLoginUser(email: string, displayName: string | null) {
  return withClient(async (client) => {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [email]
    );
    const found = existing.rows[0]?.id;
    if (found) return found;

    const created = await client.query<{ id: string }>(
      `INSERT INTO users (display_name, email, avatar_url)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [displayName, email, null]
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
    const email = String(req.query.email || "dev@localhost").trim().toLowerCase();
    const displayName = String(req.query.name || "Local Dev").trim() || "Local Dev";
    const userId = await ensureDevLoginUser(email, displayName);
    setAuthSession(req, userId, "dev_local");
    return req.session.save((err) => {
      if (err) {
        return res.status(500).json({ ok: false, code: "DEV_LOGIN_SAVE_FAILED", message: String(err) });
      }
      return res.json(
        okData({
          authenticated: true,
          dev_login: true,
          user_id: userId,
          email
        })
      );
    });
  } catch (err) {
    return res.status(500).json({ ok: false, code: "DEV_LOGIN_FAILED", message: String(err) });
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
      headers
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
        okEmpty({ authenticated: false, user: null, auth_provider: null }, "No data yet")
      );
    }
    return res.json(
      okData({
        authenticated: true,
        user: {
          id: user.id,
          name: user.display_name,
          email: user.email,
          avatar: user.avatar_url
        },
        auth_provider: (req.session as any)?.auth_provider || null,
        role: roleForEmail(user.email),
        tier: roleForEmail(user.email)
      })
    );
  } catch (_err) {
    return res.json(okEmpty({ authenticated: false, user: null, auth_provider: null }, "No data yet"));
  }
});

app.get("/api/profile", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json(okEmpty({ authenticated: false }, "No data yet"));
    }
    const linked = await listLinkedProviders(user.id);
    return res.json(
      okData({
        authenticated: true,
        profile: {
          id: user.id,
          name: user.display_name,
          email: user.email,
          avatar: user.avatar_url,
          role: roleForEmail(user.email),
          tier: roleForEmail(user.email)
        },
        linked_auth: {
          providers: linked.providers,
          passkey_count: linked.passkeyCount
        }
      })
    );
  } catch {
    return res.status(500).json(okEmpty({ authenticated: false }, "No data yet"));
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
        `SELECT value FROM panel_default_templates WHERE panel_key = 'creation' LIMIT 1`
      )
    );
    const merged = mergeCreationPanelTemplate(row.rows[0]?.value || base);
    return res.json(okData({ defaults: merged }));
  } catch {
    return res.status(500).json({ ok: false, code: "PANEL_DEFAULTS_LOAD_FAILED" });
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
    const merged = mergeCreationPanelTemplate(req.body?.defaults || req.body || {});
    if (DATABASE_URL) {
      await withClient((client) =>
        client.query(
          `INSERT INTO panel_default_templates (panel_key, value, updated_by_user_id)
           VALUES ('creation', $1::jsonb, $2)
           ON CONFLICT (panel_key)
           DO UPDATE SET value = EXCLUDED.value, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
          [JSON.stringify(merged), user.id]
        )
      );
    }
    return res.json(okData({ defaults: merged, saved: true }));
  } catch {
    return res.status(500).json({ ok: false, code: "PANEL_DEFAULTS_SAVE_FAILED" });
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
      return res.status(400).json({ ok: false, code: "CANNOT_UNLINK_LAST_METHOD" });
    }

    if (provider === "passkey") {
      const sk = userSubjectKey(user.id);
      if (DATABASE_URL) {
        await withClient((client) => client.query("DELETE FROM passkey_credentials WHERE subject_key = $1", [sk]));
      } else {
        passkeyCreds.delete(sk);
      }
      return res.json(okData({ unlinked: "passkey" }));
    }

    if (DATABASE_URL) {
      await withClient((client) =>
        client.query(
          "DELETE FROM oauth_identities WHERE user_id = $1 AND provider = $2",
          [user.id, provider]
        )
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
  visibility?: string | null;
  owner_user_id?: string;
  owner_name?: string | null;
  owner_email?: string | null;
  current_listen_price_cents?: number | null;
  current_buyout_price_cents?: number | null;
  buyout_enabled?: boolean | null;
  tips_enabled?: boolean | null;
  rights_scope?: string | null;
};

function workStructureRoleLabel(role: unknown, fallbackType: unknown) {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "opera") return "opera";
  if (raw === "act") return "act";
  if (raw === "scene") return "scene";
  if (raw === "triptych") return "triptych";
  return normalizeWorkType(fallbackType);
}

function normalizeWorkTreeRow<T extends WorkTreeRow>(row: T) {
  return {
    ...row,
    work_type: normalizeWorkType(row.work_type),
    visibility: row.visibility || "public",
    rights_scope: row.rights_scope || "personal_use",
    current_listen_price_cents: Number(row.current_listen_price_cents || defaultListenPriceCents()),
    current_buyout_price_cents: Number(row.current_buyout_price_cents || defaultBuyoutPriceCents()),
    buyout_enabled: row.buyout_enabled !== false,
    structure_role: workStructureRoleLabel(row.structure_role, row.work_type),
    sequence_index: Number(row.sequence_index || 0)
  };
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
      const sequenceDelta = Number(a.sequence_index || 0) - Number(b.sequence_index || 0);
      if (sequenceDelta !== 0) return sequenceDelta;
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
    items.forEach((item) => sorter(Array.isArray(item.children) ? item.children : []));
  };
  sorter(roots);
  return roots;
}

function buildOwnerChain(rows: Array<{ to_user_id: string | null; to_label: string | null }>, fallbackLabel: string) {
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
    const limit = Math.max(1, Math.min(Number(req.query.limit || 20), 100));
    type Row = WorkTreeRow;
    const q: QueryResult<Row> = await withClient((client) =>
      client.query<Row>(
        `SELECT w.id, w.title, w.style, w.work_type, w.lyrics_preview, w.status, w.created_at, w.updated_at,
                w.parent_work_id, w.root_work_id, w.structure_role, w.sequence_index,
                mp.visibility
         FROM user_works w
         LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
         WHERE user_id = $1
           AND w.parent_work_id IS NULL
         ORDER BY w.created_at DESC
         LIMIT $2`,
        [user.id, limit]
      )
    );
    const rootIds = q.rows.map((row) => row.id);
    let childRows: Row[] = [];
    if (rootIds.length) {
      const childRes = await withClient((client) =>
        client.query<Row>(
          `SELECT w.id, w.title, w.style, w.work_type, w.lyrics_preview, w.status, w.created_at, w.updated_at,
                  w.parent_work_id, w.root_work_id, w.structure_role, w.sequence_index,
                  mp.visibility
           FROM user_works w
           LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
           WHERE w.root_work_id = ANY($1::uuid[])
             AND w.parent_work_id IS NOT NULL
           ORDER BY w.sequence_index ASC, w.created_at ASC`,
          [rootIds]
        )
      );
      childRows = childRes.rows;
    }
    return res.json(
      okData({
        works: buildWorkTree([...q.rows, ...childRows])
      })
    );
  } catch {
    return res.status(500).json({ ok: false, code: "WORKS_LIST_FAILED" });
  }
});

app.get("/api/works/market", async (req, res) => {
  noStore(res);
  try {
    const viewer = await getSessionUser(req);
    const limit = Math.max(1, Math.min(Number(req.query.limit || 24), 100));
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
           u.display_name AS owner_name,
           u.email AS owner_email,
           mp.current_listen_price_cents,
           mp.current_buyout_price_cents,
           mp.buyout_enabled,
           mp.tips_enabled,
           mp.visibility,
           mp.rights_scope
         FROM user_works w
         JOIN users u ON u.id = w.user_id
         LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
         WHERE COALESCE(mp.visibility, 'public') <> 'private'
           AND COALESCE(mp.current_listen_price_cents, $3) > 0
           AND w.parent_work_id IS NULL
           AND ($1::uuid IS NULL OR w.user_id <> $1::uuid)
         ORDER BY w.updated_at DESC, w.created_at DESC
         LIMIT $2`,
        [viewer?.id || null, limit, defaultListenPriceCents()]
      )
    );
    const rootIds = q.rows.map((row) => row.id);
    let childRows: Row[] = [];
    if (rootIds.length) {
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
             u.display_name AS owner_name,
             u.email AS owner_email,
             mp.current_listen_price_cents,
             mp.current_buyout_price_cents,
             mp.buyout_enabled,
             mp.tips_enabled,
             mp.visibility,
             mp.rights_scope
           FROM user_works w
           JOIN users u ON u.id = w.user_id
           LEFT JOIN work_market_profiles mp ON mp.work_id = w.id
           WHERE w.root_work_id = ANY($1::uuid[])
             AND w.parent_work_id IS NOT NULL
           ORDER BY w.sequence_index ASC, w.created_at ASC`,
          [rootIds]
        )
      );
      childRows = childRes.rows;
    }
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
          [viewer.id, works.map((row) => row.id)]
        )
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
            [rootIds]
          )
        )
      : { rows: [] as Array<{ work_id: string; to_user_id: string | null; to_label: string | null; effective_at: string }> };
    const transfersByWork = transferRes.rows.reduce((acc, row) => {
      const key = String(row.work_id || "");
      const list = acc.get(key) || [];
      list.push(row);
      acc.set(key, list);
      return acc;
    }, new Map<string, Array<{ work_id: string; to_user_id: string | null; to_label: string | null; effective_at: string }>>());
    const tree = buildWorkTree([...q.rows, ...childRows]);
    return res.json(
      okData({
        works: tree.map((row) => {
          const orders = ordersByWork.get(String(row.id || "")) || [];
          const ownerLabel = String(row.owner_name || row.owner_email || "Creator");
          const ownerChain = buildOwnerChain(transfersByWork.get(String(row.id || "")) || [], ownerLabel);
          const previousOwner = ownerChain.length > 1 ? ownerChain[ownerChain.length - 2]?.label : ownerLabel;
          return {
            ...row,
            viewer_orders: orders,
            owner_chain: ownerChain,
            previous_owner_label: previousOwner
          };
        })
      })
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
    const requestedRootWorkId = String(req.body?.root_work_id || "").trim() || null;
    const structureRole = String(req.body?.structure_role || "").trim().toLowerCase() || workType;
    const sequenceIndex = Math.max(0, Number.parseInt(String(req.body?.sequence_index || "0"), 10) || 0);
    const listenPriceCents = Number.parseInt(String(req.body?.listen_price_cents || "0"), 10);
    const buyoutPriceCents = Number.parseInt(String(req.body?.buyout_price_cents || "0"), 10);
    const lyricsRaw = req.body?.lyrics_preview ? String(req.body.lyrics_preview) : "";
    const lyricsPreview = lyricsRaw.slice(0, 500) || null;
    type Row = { id: string };
    const inserted: QueryResult<Row> = await withClient((client) =>
      client.query<Row>(
        `INSERT INTO user_works (
           user_id, title, style, work_type, lyrics_preview, status, parent_work_id, root_work_id, structure_role, sequence_index
         )
         VALUES ($1, $2, $3, $4, $5, 'draft', $6::uuid, $7::uuid, $8, $9)
         RETURNING id`,
        [user.id, title, style, workType, lyricsPreview, parentWorkId, requestedRootWorkId, structureRole, sequenceIndex]
      )
    );
    const workId = inserted.rows[0]?.id || null;
    if (workId) {
      const resolvedRootWorkId = requestedRootWorkId || workId;
      await withClient((client) =>
        client.query(`UPDATE user_works SET root_work_id = $2, updated_at = now() WHERE id = $1`, [workId, resolvedRootWorkId])
      );
      await ensureWorkMarketSeed({
        workId,
        ownerUserId: user.id,
        title,
        style,
        workType,
        structureRole,
        listenPriceCents: Number.isFinite(listenPriceCents) && listenPriceCents > 0 ? listenPriceCents : null,
        buyoutPriceCents: Number.isFinite(buyoutPriceCents) && buyoutPriceCents >= 0 ? buyoutPriceCents : null
      });
    }
    return res.json(
      okData({
        id: workId,
        work_type: workType,
        parent_work_id: parentWorkId,
        root_work_id: requestedRootWorkId || workId,
        structure_role: structureRole,
        sequence_index: sequenceIndex
      })
    );
  } catch {
    return res.status(500).json({ ok: false, code: "WORK_CREATE_FAILED" });
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
    const listenPriceCents = Number.parseInt(String(req.body?.listen_price_cents || "0"), 10);
    const buyoutPriceCents = Number.parseInt(String(req.body?.buyout_price_cents || "0"), 10);
    const buyoutEnabled = Boolean(req.body?.buyout_enabled) && buyoutPriceCents > 0;
    const requestedVisibility = String(req.body?.visibility || "").trim().toLowerCase();
    const visibility = requestedVisibility === "private" ? "private" : "public";
    const workStatus = visibility === "private" ? "hidden" : "published";
    const requestedWorkType = req.body && Object.prototype.hasOwnProperty.call(req.body, "work_type")
      ? normalizeWorkType(req.body?.work_type)
      : null;
    if (!workId) {
      return res.status(400).json({ ok: false, code: "WORK_REQUIRED" });
    }
    if (!Number.isFinite(listenPriceCents) || listenPriceCents <= 0) {
      return res.status(400).json({ ok: false, code: "INVALID_LISTEN_PRICE" });
    }
    if (buyoutPriceCents < 0 || !Number.isFinite(buyoutPriceCents)) {
      return res.status(400).json({ ok: false, code: "INVALID_BUYOUT_PRICE" });
    }
    const ownerCheck = await withClient((client) =>
      client.query<{ id: string }>(
        `SELECT id FROM user_works WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [workId, user.id]
      )
    );
    if (!ownerCheck.rows[0]?.id) {
      return res.status(404).json({ ok: false, code: "WORK_NOT_FOUND" });
    }
    await withClient(async (client) => {
      if (requestedWorkType) {
        await client.query(
          `UPDATE user_works
           SET work_type = $2,
               structure_role = CASE WHEN parent_work_id IS NULL THEN $2 ELSE structure_role END,
               updated_at = now()
           WHERE id = $1`,
          [workId, requestedWorkType]
        );
      }
      await client.query(`UPDATE user_works SET status = $2, updated_at = now() WHERE id = $1`, [workId, workStatus]);
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
        [workId, user.id, listenPriceCents, buyoutPriceCents > 0 ? buyoutPriceCents : null, buyoutEnabled, visibility]
      );
      await client.query(
        `INSERT INTO work_access_products (work_id, owner_user_id, product_kind, currency, amount_cents, active, meta)
         VALUES ($1, $2, 'listen', 'USD', $3, true, $4::jsonb)
         ON CONFLICT (work_id, product_kind)
         DO UPDATE SET amount_cents = EXCLUDED.amount_cents, active = true, updated_at = now()`,
        [workId, user.id, listenPriceCents, JSON.stringify({ updated_by: "pricing_patch", work_type: requestedWorkType || undefined })]
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
          JSON.stringify({ updated_by: "pricing_patch", work_type: requestedWorkType || undefined })
        ]
      );
    });
    return res.json(
      okData({
        work_id: workId,
        work_type: requestedWorkType,
        current_listen_price_cents: listenPriceCents,
        current_buyout_price_cents: buyoutPriceCents > 0 ? buyoutPriceCents : null,
        buyout_enabled: buyoutEnabled,
        visibility,
        status: workStatus
      })
    );
  } catch {
    return res.status(500).json({ ok: false, code: "WORK_PRICING_UPDATE_FAILED" });
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
      nonce
    });
    return res.redirect(302, `https://appleid.apple.com/auth/authorize?${q.toString()}`);
  } catch {
    return res.status(500).send("apple_auth_start_failed");
  }
});

async function handleAppleCallback(req: express.Request, res: express.Response) {
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
      client_secret: clientSecret
    });

    const tkRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString()
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
      displayName: null
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

app.get("/auth/google", async (req, res) => {
  noStore(res);
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) return res.status(503).send("google_not_configured");
    const state = randomHex(16);
    const nonce = randomHex(16);
    setOAuthState(req, "google", { state, nonce, createdAt: Date.now() });
    const redirectUri = `${appBaseUrl(req)}/auth/google/callback`;
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      prompt: "select_account"
    });
    return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`);
  } catch {
    return res.status(500).send("google_auth_start_failed");
  }
});

app.get("/auth/google/callback", async (req, res) => {
  noStore(res);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const saved = getOAuthState(req, "google");
    if (!code || !saved || saved.state !== state) {
      auditAuthFailure("google", "oauth", "INVALID_STATE_OR_CODE");
      return res.status(400).send("auth_failed");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const redirectUri = `${appBaseUrl(req)}/auth/google/callback`;
    const tk = await oauthExchangeTokenForm(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    );
    const accessToken = String(tk.json?.access_token || "");
    const idToken = String(tk.json?.id_token || "");
    if (!accessToken && !idToken) {
      auditAuthFailure("google", "oauth", "TOKEN_MISSING");
      return res.status(400).send("auth_failed");
    }

    let sub = "";
    let email: string | null = null;
    if (idToken) {
      const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
      const { payload } = await jwtVerify(idToken, googleJwks, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: clientId
      });
      sub = String(payload.sub || "");
      email = payload.email ? String(payload.email) : null;
    } else {
      const me = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      sub = String(me.json?.sub || "");
      email = me.json?.email ? String(me.json.email) : null;
    }
    if (!sub) {
      auditAuthFailure("google", "oauth", "SUB_MISSING");
      return res.status(400).send("auth_failed");
    }

    const userId = await upsertOAuthIdentity({
      provider: "google",
      providerUserId: sub,
      email,
      displayName: null
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
        client_secret: clientSecret
      })
    );
    const accessToken = String(tk.json?.access_token || "");
    if (!accessToken) {
      auditAuthFailure("github", "oauth", "TOKEN_MISSING");
      return res.status(400).send("auth_failed");
    }

    const me = await fetchJson("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" }
    });
    const emails = await fetchJson("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" }
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
      displayName: me.json?.name ? String(me.json.name) : null
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
    if (!clientId || !clientSecret) return res.status(503).send("x_not_configured");
    const state = randomHex(16);
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = codeChallengeS256(verifier);
    setOAuthState(req, "x", { state, codeVerifier: verifier, createdAt: Date.now() });
    const redirectUri = `${appBaseUrl(req)}/auth/x/callback`;
    const q = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "tweet.read users.read offline.access",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });
    return res.redirect(302, `https://twitter.com/i/oauth2/authorize?${q.toString()}`);
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
    const redirectUri = `${appBaseUrl(req)}/auth/x/callback`;
    let tk = await oauthExchangeTokenForm(
      "https://api.x.com/2/oauth2/token",
      new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: saved.codeVerifier
      })
    );
    let accessToken = String(tk.json?.access_token || "");

    if (!accessToken) {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tkRes = await fetch("https://api.x.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code_verifier: saved.codeVerifier
        }).toString()
      });
      tk = { ok: tkRes.ok, status: tkRes.status, json: await tkRes.json().catch(() => null) };
      accessToken = String(tk.json?.access_token || "");
    }
    if (!accessToken) {
      auditAuthFailure("x", "oauth", "TOKEN_MISSING");
      return res.status(400).send("auth_failed");
    }

    const me = await fetchJson("https://api.x.com/2/users/me?user.fields=id,name,username", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const sub = String(me.json?.data?.id || "");
    if (!sub) {
      auditAuthFailure("x", "oauth", "SUB_MISSING");
      return res.status(400).send("auth_failed");
    }
    const userId = await upsertOAuthIdentity({
      provider: "x",
      providerUserId: sub,
      email: null,
      displayName: me.json?.data?.name ? String(me.json.data.name) : null
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
    if (!clientId || !clientSecret) return res.status(503).send("facebook_not_configured");
    const state = randomHex(16);
    setOAuthState(req, "facebook", { state, createdAt: Date.now() });
    const redirectUri = `${appBaseUrl(req)}/auth/facebook/callback`;
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: "email,public_profile"
    });
    return res.redirect(302, `https://www.facebook.com/v19.0/dialog/oauth?${q.toString()}`);
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
    const redirectUri = `${appBaseUrl(req)}/auth/facebook/callback`;
    const tk = await fetchJson(
      `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code
      }).toString()}`
    );
    const accessToken = String(tk.json?.access_token || "");
    if (!accessToken) {
      auditAuthFailure("facebook", "oauth", "TOKEN_MISSING");
      return res.status(400).send("auth_failed");
    }
    const me = await fetchJson(
      `https://graph.facebook.com/me?${new URLSearchParams({
        fields: "id,name,email",
        access_token: accessToken
      }).toString()}`
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
      displayName: me.json?.name ? String(me.json.name) : null
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
    const state = randomHex(8);
    setOAuthState(req, "wechat", { state, createdAt: Date.now() });
    const redirectUri = `${appBaseUrl(req)}/auth/wechat/callback`;
    const url = `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(appid)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login&state=${encodeURIComponent(state)}#wechat_redirect`;
    return res.redirect(302, url);
  } catch {
    return res.status(500).send("wechat_auth_start_failed");
  }
});

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
        grant_type: "authorization_code"
      }).toString()}`
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
        openid
      }).toString()}`
    );
    const sub = unionid || openid;
    const userId = await upsertOAuthIdentity({
      provider: "wechat",
      providerUserId: sub,
      email: null,
      displayName: me.json?.nickname ? String(me.json.nickname) : null
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

app.get("/auth/bsky", async (req, res) => {
  noStore(res);
  try {
    const clientId = process.env.BSKY_CLIENT_ID || process.env.BLUESKY_CLIENT_ID || "";
    const clientSecret = process.env.BSKY_CLIENT_SECRET || process.env.BLUESKY_CLIENT_SECRET || "";
    if (clientId && clientSecret) {
      const state = randomHex(16);
      const verifier = b64url(crypto.randomBytes(32));
      const challenge = codeChallengeS256(verifier);
      setOAuthState(req, "bsky", { state, codeVerifier: verifier, createdAt: Date.now() });
      const redirectUri = `${appBaseUrl(req)}/auth/bsky/callback`;
      const q = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "atproto transition:generic",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256"
      });
      return res.redirect(302, `https://bsky.social/oauth/authorize?${q.toString()}`);
    }
    const handle = process.env.BLUESKY_HANDLE || "";
    const appPassword = process.env.BLUESKY_APP_PASSWORD || "";
    if (!handle || !appPassword) {
      auditAuthFailure("bsky", "app_password", "NOT_CONFIGURED");
      return res.status(503).send("bsky_not_configured");
    }
    const sess = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: handle, password: appPassword })
    });
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
      displayName
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
    const clientId = process.env.BSKY_CLIENT_ID || process.env.BLUESKY_CLIENT_ID || "";
    const clientSecret = process.env.BSKY_CLIENT_SECRET || process.env.BLUESKY_CLIENT_SECRET || "";
    const redirectUri = `${appBaseUrl(req)}/auth/bsky/callback`;
    const tkRes = await fetch("https://bsky.social/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: saved.codeVerifier
      }).toString()
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
      displayName: null
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
app.get("/api/auth/x", (_req, res) => res.redirect(302, "/auth/x"));
app.get("/api/auth/facebook", (_req, res) => res.redirect(302, "/auth/facebook"));
app.get("/api/auth/wechat", (_req, res) => res.redirect(302, "/auth/wechat"));
app.get("/api/auth/bsky", (_req, res) => res.redirect(302, "/auth/bsky"));

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
  "dropbox"
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
      setOAuthState(req, pid, { state, codeVerifier: verifier, createdAt: Date.now() });
      const key = envUpper(pid);
      const clientId = process.env[`${key}_CLIENT_ID`] || "";
      const redirectUri = `${appBaseUrl(req)}/auth/${pid}/callback`;
      const q = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: spec.scopes.join(" "),
        state,
        code_challenge: challenge,
        code_challenge_method: "S256"
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
      const redirectUri = `${appBaseUrl(req)}/auth/${pid}/callback`;
      const tk = await oauthExchangeTokenForm(
        spec.tokenUrl,
        new URLSearchParams({
          code,
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code_verifier: saved.codeVerifier
        })
      );
      const accessToken = String(tk.json?.access_token || "");
      if (!accessToken) {
        auditAuthFailure(pid, "oauth", "TOKEN_MISSING");
        return res.status(400).send("auth_failed");
      }
      const me = await fetchJson(spec.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" }
      });
      const sub = pickFirstByKeys(me.json, spec.idKeys || ["sub", "id"]);
      const email = pickFirstByKeys(me.json, spec.emailKeys || ["email"]) || null;
      const displayName = pickFirstByKeys(me.json, spec.nameKeys || ["name"]) || null;
      if (!sub) {
        auditAuthFailure(pid, "oauth", "SUB_MISSING");
        return res.status(400).send("auth_failed");
      }
      const userId = await upsertOAuthIdentity({
        provider: pid,
        providerUserId: sub,
        email,
        displayName
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
      ? credential.response.transports.filter((x: unknown): x is string => typeof x === "string")
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
    const role = roleForEmail(user.email);
    if (role === "admin") {
      return res.json(
        okData({
          authenticated: true,
          tier: role,
          currency: "USD",
          balance_cents: null,
          monthly_limit_cents: null,
          month_spent_cents: 0,
          auto_recharge: null,
          remaining: null,
          limit: null
        })
      );
    }
    await resetMonthIfNeeded(user.id);
    const { account, created } = await ensureBillingAccount(user.id);
    const data = {
      authenticated: true,
      tier: role,
      currency: account.currency,
      balance_cents: Number(account.balance_cents),
      monthly_limit_cents: Number(account.monthly_limit_cents),
      month_spent_cents: Number(account.month_spent_cents),
      auto_recharge: {
        enabled: account.auto_recharge_enabled,
        threshold_cents: Number(account.auto_recharge_threshold_cents),
        amount_cents: Number(account.auto_recharge_amount_cents)
      }
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
      return res.json(okEmpty({ authenticated: false, events: [] }, "No data yet"));
    }
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const result: QueryResult<any> = await withClient((client) =>
      client.query(
        "SELECT * FROM usage_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        [user.id, limit]
      )
    );
    if (!result.rows.length) {
      return res.json(okEmpty({ authenticated: true, events: [] }, "No data yet"));
    }
    return res.json(okData({ authenticated: true, events: result.rows }));
  } catch (_err) {
    return res.json(okEmpty({ authenticated: false, events: [] }, "No data yet"));
  }
});

app.get("/api/billing/ledger", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json(okEmpty({ authenticated: false, entries: [] }, "No data yet"));
    }
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const result: QueryResult<any> = await withClient((client) =>
      client.query(
        "SELECT * FROM ledger_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        [user.id, limit]
      )
    );
    if (!result.rows.length) {
      return res.json(okEmpty({ authenticated: true, entries: [] }, "No data yet"));
    }
    return res.json(okData({ authenticated: true, entries: result.rows }));
  } catch (_err) {
    return res.json(okEmpty({ authenticated: false, entries: [] }, "No data yet"));
  }
});

app.get("/api/cssmv/commerce", async (req, res) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json(okEmpty({ authenticated: false }, "No data yet"));
    }
    const role = roleForEmail(user.email);
    let accountData: Record<string, unknown>;
    if (role === "admin") {
      accountData = {
        tier: role,
        currency: "USD",
        balance_cents: null,
        monthly_limit_cents: null,
        month_spent_cents: 0,
        auto_recharge: null
      };
    } else {
      await resetMonthIfNeeded(user.id);
      const { account } = await ensureBillingAccount(user.id);
      accountData = {
        tier: role,
        currency: account.currency,
        balance_cents: Number(account.balance_cents),
        monthly_limit_cents: Number(account.monthly_limit_cents),
        month_spent_cents: Number(account.month_spent_cents),
        auto_recharge: {
          enabled: account.auto_recharge_enabled,
          threshold_cents: Number(account.auto_recharge_threshold_cents),
          amount_cents: Number(account.auto_recharge_amount_cents)
        }
      };
    }

    const [ledgerRes, usageRes, worksRes, orderRes, tipRes, transferRes, marketRes] = await Promise.all([
      withClient((client) =>
        client.query(
          "SELECT * FROM ledger_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8",
          [user.id]
        )
      ),
      withClient((client) =>
        client.query(
          "SELECT * FROM usage_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8",
          [user.id]
        )
      ),
      withClient((client) =>
        client.query(
          `SELECT id, title, style, lyrics_preview, status, created_at, updated_at
           FROM user_works
           WHERE user_id = $1
           ORDER BY created_at DESC
          LIMIT 8`,
          [user.id]
        )
      ),
      withClient((client) =>
        client.query(
          `SELECT id, work_id, buyer_user_id, seller_user_id, order_kind, status, currency,
                  gross_amount_cents, seller_net_cents, created_at, updated_at, meta
           FROM work_orders
           WHERE buyer_user_id = $1 OR seller_user_id = $1
           ORDER BY created_at DESC
           LIMIT 12`,
          [user.id]
        )
      ),
      withClient((client) =>
        client.query(
          `SELECT id, work_id, tipper_user_id, owner_user_id, currency, amount_cents, message, created_at, meta
           FROM work_tips
           WHERE owner_user_id = $1 OR tipper_user_id = $1
           ORDER BY created_at DESC
           LIMIT 12`,
          [user.id]
        )
      ),
      withClient((client) =>
        client.query(
          `SELECT id, work_id, from_user_id, to_user_id, transfer_kind, currency,
                  transfer_amount_cents, effective_at, created_at, meta
           FROM ownership_transfers
           WHERE from_user_id = $1 OR to_user_id = $1
           ORDER BY effective_at DESC, created_at DESC
           LIMIT 12`,
          [user.id]
        )
      ),
      withClient((client) =>
        client.query(
          `SELECT id, work_id, owner_user_id, current_listen_price_cents, current_buyout_price_cents,
                  tips_enabled, buyout_enabled, visibility, rights_scope, updated_at
           FROM work_market_profiles
           WHERE owner_user_id = $1
           ORDER BY updated_at DESC
           LIMIT 12`,
          [user.id]
        )
      )
    ]);

    return res.json(
      okData({
        authenticated: true,
        profile: {
          id: user.id,
          email: user.email,
          name: user.display_name,
          avatar: user.avatar_url,
          role
        },
        account: accountData,
        ledger_entries: ledgerRes.rows,
        usage_events: usageRes.rows,
        market: {
          profiles: marketRes.rows,
          orders: orderRes.rows,
          tips: tipRes.rows,
          ownership_transfers: transferRes.rows
        },
        ownership: {
          works_count: worksRes.rows.length,
          works: worksRes.rows
        }
      })
    );
  } catch (_err) {
    return res.json(okEmpty({ authenticated: false }, "No data yet"));
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
      name: user.display_name
    });
    return res.json(
      okData({
        authenticated: true,
        configured: true,
        stripe_customer: record
      })
    );
  } catch (err) {
    return res.status(500).json({ ok: false, code: "STRIPE_CUSTOMER_ENSURE_FAILED", message: String(err) });
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
    const orderKind = String(req.body?.order_kind || "listen").trim().toLowerCase() as CommerceProductKind;
    if (!workId) {
      return res.status(400).json({ ok: false, code: "WORK_ID_REQUIRED" });
    }
    if (orderKind !== "listen" && orderKind !== "buyout") {
      return res.status(400).json({ ok: false, code: "ORDER_KIND_INVALID" });
    }
    const product = await resolveCommerceProduct({ workId, orderKind });
    if (product.ownerUserId === user.id) {
      return res.status(400).json({ ok: false, code: "SELF_PURCHASE_NOT_ALLOWED" });
    }
    const existingOrders = await findExistingBuyerWorkOrder({
      buyerUserId: user.id,
      workId
    });
    const paidBuyout = existingOrders.find(
      (row) => String(row.order_kind || "") === "buyout" && String(row.status || "") === "paid"
    );
    if (paidBuyout) {
      return res.status(409).json({
        ok: false,
        code: "ORDER_ALREADY_OWNED_BUYOUT",
        order_id: paidBuyout.id
      });
    }
    const existingSameKind = existingOrders.find(
      (row) => String(row.order_kind || "") === orderKind
    );
    if (existingSameKind && ["pending", "processing"].includes(String(existingSameKind.status || ""))) {
      return res.status(409).json({
        ok: false,
        code: "ORDER_ALREADY_PENDING",
        order_id: existingSameKind.id
      });
    }
    if (existingSameKind && String(existingSameKind.status || "") === "paid") {
      return res.status(409).json({
        ok: false,
        code: "ORDER_ALREADY_PAID",
        order_id: existingSameKind.id
      });
    }
    if (
      orderKind === "listen" &&
      existingOrders.some(
        (row) =>
          String(row.order_kind || "") === "buyout" &&
          ["pending", "processing"].includes(String(row.status || ""))
      )
    ) {
      return res.status(409).json({
        ok: false,
        code: "ORDER_BUYOUT_PENDING"
      });
    }
    const customer = await ensureStripeCustomer({
      userId: user.id,
      email: normalizeEmail(user.email),
      name: user.display_name
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
        title: product.title
      }
    });
    if (!orderId) {
      return res.status(500).json({ ok: false, code: "ORDER_CREATE_FAILED" });
    }
    const successUrl = String(
      req.body?.success_url || process.env.STRIPE_CHECKOUT_SUCCESS_URL || `${appBaseUrl(req)}/`
    ).trim();
    const cancelUrl = String(
      req.body?.cancel_url || process.env.STRIPE_CHECKOUT_CANCEL_URL || `${appBaseUrl(req)}/`
    ).trim();
    const successUrlFinal = appendQueryToUrl(successUrl, {
      stripe_checkout: "success",
      order_id: orderId
    });
    const cancelUrlFinal = appendQueryToUrl(cancelUrl, {
      stripe_checkout: "cancel",
      order_id: orderId
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
          order_kind: orderKind
        }
      },
      metadata: {
        order_id: orderId,
        work_id: workId,
        buyer_user_id: user.id,
        seller_user_id: product.ownerUserId,
        product_id: String(product.productId || ""),
        order_kind: orderKind
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
                order_kind: orderKind
              }
            }
          }
        }
      ]
    });
    await updateWorkOrderStripeRefs({
      orderId,
      checkoutSessionId: session.id,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      metaPatch: {
        checkout_url_created: true
      }
    });
    return res.json(
      okData({
        authenticated: true,
        configured: true,
        order_id: orderId,
        checkout_session_id: session.id,
        checkout_url: session.url,
        payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null
      })
    );
  } catch (err) {
    return res.status(500).json({ ok: false, code: "STRIPE_CHECKOUT_CREATE_FAILED", message: String(err) });
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
    const checkoutSessionId = String(req.body?.checkout_session_id || "").trim() || null;
    if (!orderId && !checkoutSessionId) {
      return res.status(400).json({ ok: false, code: "ORDER_ID_REQUIRED" });
    }
    const canceled = await cancelPendingWorkOrder({
      orderId,
      buyerUserId: user.id,
      checkoutSessionId,
      reason: "buyer_returned_cancel_url"
    });
    return res.json(
      okData({
        authenticated: true,
        canceled: Boolean(canceled),
        order_id: canceled?.id || orderId || null
      })
    );
  } catch (err) {
    return res.status(500).json({ ok: false, code: "STRIPE_CHECKOUT_CANCEL_FAILED", message: String(err) });
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
          connected_account: null
        })
      );
    }
    const record = await ensureStripeConnectedAccount({
      userId: user.id,
      email: normalizeEmail(user.email),
      appBase: appBaseUrl(req)
    });
    return res.json(
      okData({
        authenticated: true,
        configured: true,
        connected_account: record
      })
    );
  } catch (err) {
    return res.status(500).json({ ok: false, code: "STRIPE_CONNECT_STATUS_FAILED", message: String(err) });
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
      appBase: appBaseUrl(req)
    });
    if (!record?.stripe_account_id) {
      return res.status(500).json({ ok: false, code: "STRIPE_CONNECT_ACCOUNT_MISSING" });
    }
    const refreshUrl =
      String(req.body?.refresh_url || process.env.STRIPE_CONNECT_REFRESH_URL || `${appBaseUrl(req)}/`).trim();
    const returnUrl =
      String(req.body?.return_url || process.env.STRIPE_CONNECT_RETURN_URL || `${appBaseUrl(req)}/`).trim();
    const link = await stripe.accountLinks.create({
      account: record.stripe_account_id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding"
    });
    return res.json(
      okData({
        authenticated: true,
        configured: true,
        onboarding_url: link.url,
        expires_at: link.expires_at,
        connected_account: record
      })
    );
  } catch (err) {
    return res.status(500).json({ ok: false, code: "STRIPE_CONNECT_START_FAILED", message: String(err) });
  }
});

app.post("/api/stripe/webhook", async (req, res) => {
  noStore(res);
  try {
    const stripe = getStripeClient();
    const secret = getStripeWebhookSecret();
    if (!stripe || !secret) {
      return res.status(503).json({ ok: false, code: "STRIPE_WEBHOOK_NOT_CONFIGURED" });
    }
    const signature = String(req.headers["stripe-signature"] || "").trim();
    if (!signature) {
      return res.status(400).json({ ok: false, code: "STRIPE_SIGNATURE_MISSING" });
    }
    const event = stripe.webhooks.constructEvent(requestRawBody(req), signature, secret);
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
      return res.status(500).json({ ok: false, code: "STRIPE_WEBHOOK_PROCESS_FAILED", message: String(err) });
    }
  } catch (err) {
    return res.status(400).json({ ok: false, code: "STRIPE_WEBHOOK_INVALID", message: String(err) });
  }
});

app.post("/api/billing/usage", async (req, res) => {
  noStore(res);
  const unitPrice = Number(process.env.BILLING_UNIT_PRICE_CENTS || 1);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json(okEmpty({ allowed: false, authenticated: false }, "No data yet"));
    }
    const role = roleForEmail(user.email);
    if (role === "admin") {
      return res.json(
        okData({
          tier: role,
          allowed: true,
          remaining: null,
          limit: null
        })
      );
    }
    await resetMonthIfNeeded(user.id);

    const result = await withClient(async (client) => {
      await client.query("BEGIN");
      const accountRes = await client.query(
        "SELECT * FROM billing_accounts WHERE user_id = $1 FOR UPDATE",
        [user.id]
      );
      let account = accountRes.rows[0];
      if (!account) {
        const inserted = await client.query(
          "INSERT INTO billing_accounts (user_id) VALUES ($1) RETURNING *",
          [user.id]
        );
        account = inserted.rows[0];
      }

      const monthLimit = Number(account.monthly_limit_cents) || 0;
      const monthSpent = Number(account.month_spent_cents) || 0;
      const balance = Number(account.balance_cents) || 0;
      const cost = unitPrice;

      if (monthLimit > 0 && monthSpent + cost > monthLimit) {
        await client.query(
          "INSERT INTO usage_events (user_id, route, units, cost_cents, meta) VALUES ($1,$2,$3,$4,$5)",
          [user.id, "/api/billing/usage", 1, cost, JSON.stringify({ blocked: "monthly_limit" })]
        );
        await client.query("COMMIT");
        return { allowed: false, remaining: 0, limit: monthLimit };
      }

      let nextBalance = balance;
      if (account.auto_recharge_enabled && balance < account.auto_recharge_threshold_cents) {
        nextBalance += Number(account.auto_recharge_amount_cents || 0);
        await client.query(
          "INSERT INTO ledger_entries (user_id, kind, amount_cents, balance_after_cents, note) VALUES ($1,$2,$3,$4,$5)",
          [user.id, "credit", account.auto_recharge_amount_cents, nextBalance, "auto_recharge_simulated"]
        );
      }

      if (nextBalance < cost) {
        await client.query(
          "INSERT INTO usage_events (user_id, route, units, cost_cents, meta) VALUES ($1,$2,$3,$4,$5)",
          [user.id, "/api/billing/usage", 1, cost, JSON.stringify({ blocked: "insufficient_balance" })]
        );
        await client.query("COMMIT");
        return { allowed: false, remaining: 0, limit: monthLimit || null };
      }

      nextBalance -= cost;
      const usageRes = await client.query(
        "INSERT INTO usage_events (user_id, route, units, cost_cents) VALUES ($1,$2,$3,$4) RETURNING id",
        [user.id, "/api/billing/usage", 1, cost]
      );
      await client.query(
        "INSERT INTO ledger_entries (user_id, kind, amount_cents, balance_after_cents, related_usage_event_id) VALUES ($1,$2,$3,$4,$5)",
        [user.id, "debit", -cost, nextBalance, usageRes.rows[0].id]
      );

      await client.query(
        "UPDATE billing_accounts SET balance_cents = $2, month_spent_cents = $3, updated_at = now() WHERE user_id = $1",
        [user.id, nextBalance, monthSpent + cost]
      );
      await client.query("COMMIT");

      return { allowed: true, remaining: null, limit: monthLimit || null };
    });

    return res.json(okData({ tier: role, ...result }));
  } catch (_err) {
    return res.json(okEmpty({ allowed: false }, "No data yet"));
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "cssOS running 🚀" });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

async function start() {
  if (DATABASE_URL) {
    await runMigrations();
    await ensureAuthIdentityTable();
    await processMatureSellerPayouts();
    setInterval(() => {
      processMatureSellerPayouts().catch((err) => {
        console.error("Payout sweep failed", err);
      });
    }, stripePayoutSweepMs());
  }
  app.listen(PORT, () => {
    console.log(`cssOS API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Startup failed", err);
  process.exit(1);
});
