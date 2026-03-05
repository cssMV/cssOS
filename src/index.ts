import express from "express";
import path from "path";
import crypto from "node:crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { QueryResult } from "pg";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { getDatabaseUrl, getPool, withClient } from "./db";
import { runMigrations } from "./db/migrate";

const app = express();
const PORT = 3000;
const REGISTRY_URL = "http://localhost:8080";
const IS_PROD = process.env.NODE_ENV === "production";

const DATABASE_URL = getDatabaseUrl();
if (process.env.NODE_ENV === "production" && !DATABASE_URL) {
  throw new Error("DATABASE_URL not configured on api-vm");
}

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

function adminEmailSet() {
  const raw = (process.env.ADMIN_EMAILS || "jingdudc@gmail.com").trim();
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
    { id: "tiktok", name: "TikTok", env: ["TIKTOK_CLIENT_ID", "TIKTOK_CLIENT_SECRET"] },
    { id: "facebook", name: "Facebook", env: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"] },
    { id: "wechat", name: "WeChat", env: ["WECHAT_CLIENT_ID", "WECHAT_CLIENT_SECRET"] },
    { id: "apple", name: "Apple", env: ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"] }
  ];
  return providers.map((provider) => {
    const enabled =
      provider.id === "bsky"
        ? (
            (Boolean(process.env.BSKY_CLIENT_ID) && Boolean(process.env.BSKY_CLIENT_SECRET)) ||
            (Boolean(process.env.BLUESKY_CLIENT_ID) && Boolean(process.env.BLUESKY_CLIENT_SECRET))
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
        okEmpty({ authenticated: false, user: null }, "No data yet")
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
        role: roleForEmail(user.email),
        tier: roleForEmail(user.email)
      })
    );
  } catch (_err) {
    return res.json(okEmpty({ authenticated: false, user: null }, "No data yet"));
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
    if (!tkRes.ok || !tk?.id_token) return res.status(400).send("auth_failed");

    const payload = await verifyAppleIdToken(String(tk.id_token));
    const sub = String(payload.sub || "");
    if (!sub) return res.status(400).send("auth_failed");
    if (savedNonce && payload.nonce && String(payload.nonce) !== savedNonce) {
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
    (req.session as any).user_id = userId;
    (req.session as any).passkey_subject_key = userSubjectKey(userId);
    return res.redirect(302, "/");
  } catch (err) {
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
    if (!code || !saved || saved.state !== state) return res.status(400).send("auth_failed");

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
    if (!accessToken && !idToken) return res.status(400).send("auth_failed");

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
    if (!sub) return res.status(400).send("auth_failed");

    const userId = await upsertOAuthIdentity({
      provider: "google",
      providerUserId: sub,
      email,
      displayName: null
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    (req.session as any).user_id = userId;
    (req.session as any).passkey_subject_key = userSubjectKey(userId);
    return res.redirect(302, "/");
  } catch (err) {
    console.error("google_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
});

app.get("/auth/github", async (req, res) => {
  noStore(res);
  try {
    const clientId = process.env.GITHUB_CLIENT_ID || "";
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) return res.status(503).send("github_not_configured");
    const state = randomHex(16);
    setOAuthState(req, "github", { state, createdAt: Date.now() });
    const redirectUri = `${appBaseUrl(req)}/auth/github/callback`;
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
      state
    });
    return res.redirect(302, `https://github.com/login/oauth/authorize?${q.toString()}`);
  } catch {
    return res.status(500).send("github_auth_start_failed");
  }
});

app.get("/auth/github/callback", async (req, res) => {
  noStore(res);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const saved = getOAuthState(req, "github");
    if (!code || !saved || saved.state !== state) return res.status(400).send("auth_failed");

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
    if (!accessToken) return res.status(400).send("auth_failed");

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
    if (!sub) return res.status(400).send("auth_failed");

    const userId = await upsertOAuthIdentity({
      provider: "github",
      providerUserId: sub,
      email,
      displayName: me.json?.name ? String(me.json.name) : null
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    (req.session as any).user_id = userId;
    (req.session as any).passkey_subject_key = userSubjectKey(userId);
    return res.redirect(302, "/");
  } catch (err) {
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
    if (!code || !saved || !saved.codeVerifier || saved.state !== state) return res.status(400).send("auth_failed");

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
    if (!accessToken) return res.status(400).send("auth_failed");

    const me = await fetchJson("https://api.x.com/2/users/me?user.fields=id,name,username", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const sub = String(me.json?.data?.id || "");
    if (!sub) return res.status(400).send("auth_failed");
    const userId = await upsertOAuthIdentity({
      provider: "x",
      providerUserId: sub,
      email: null,
      displayName: me.json?.data?.name ? String(me.json.data.name) : null
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    (req.session as any).user_id = userId;
    (req.session as any).passkey_subject_key = userSubjectKey(userId);
    return res.redirect(302, "/");
  } catch (err) {
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
    if (!code || !saved || saved.state !== state) return res.status(400).send("auth_failed");

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
    if (!accessToken) return res.status(400).send("auth_failed");
    const me = await fetchJson(
      `https://graph.facebook.com/me?${new URLSearchParams({
        fields: "id,name,email",
        access_token: accessToken
      }).toString()}`
    );
    const sub = String(me.json?.id || "");
    const email = me.json?.email ? String(me.json.email) : null;
    if (!sub) return res.status(400).send("auth_failed");
    const userId = await upsertOAuthIdentity({
      provider: "facebook",
      providerUserId: sub,
      email,
      displayName: me.json?.name ? String(me.json.name) : null
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    (req.session as any).user_id = userId;
    (req.session as any).passkey_subject_key = userSubjectKey(userId);
    return res.redirect(302, "/");
  } catch (err) {
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
    if (!code || !saved || saved.state !== state) return res.status(400).send("auth_failed");
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
    if (!openid || !accessToken) return res.status(400).send("auth_failed");
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
    (req.session as any).user_id = userId;
    (req.session as any).passkey_subject_key = userSubjectKey(userId);
    return res.redirect(302, "/");
  } catch (err) {
    console.error("wechat_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
});

app.get("/auth/bsky", async (req, res) => {
  noStore(res);
  try {
    const clientId = process.env.BSKY_CLIENT_ID || process.env.BLUESKY_CLIENT_ID || "";
    const clientSecret = process.env.BSKY_CLIENT_SECRET || process.env.BLUESKY_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) return res.status(503).send("bsky_not_configured");
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
  } catch {
    return res.status(500).send("bsky_auth_start_failed");
  }
});

app.get("/auth/bsky/callback", async (req, res) => {
  noStore(res);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const saved = getOAuthState(req, "bsky");
    if (!code || !saved || !saved.codeVerifier || saved.state !== state) return res.status(400).send("auth_failed");
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
    if (!sub) return res.status(400).send("auth_failed");
    const userId = await upsertOAuthIdentity({
      provider: "bsky",
      providerUserId: sub,
      email,
      displayName: null
    });
    await migrateGuestPasskeysToUser(req.sessionID, userId);
    (req.session as any).user_id = userId;
    (req.session as any).passkey_subject_key = userSubjectKey(userId);
    return res.redirect(302, "/");
  } catch (err) {
    console.error("bsky_callback_failed", err);
    return res.status(400).send("auth_failed");
  }
});

app.get("/api/auth/google", (_req, res) => res.redirect(302, "/auth/google"));
app.get("/api/auth/github", (_req, res) => res.redirect(302, "/auth/github"));
app.get("/api/auth/x", (_req, res) => res.redirect(302, "/auth/x"));
app.get("/api/auth/facebook", (_req, res) => res.redirect(302, "/auth/facebook"));
app.get("/api/auth/wechat", (_req, res) => res.redirect(302, "/auth/wechat"));
app.get("/api/auth/bsky", (_req, res) => res.redirect(302, "/auth/bsky"));

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
    await resetMonthIfNeeded(user.id);
    const { account, created } = await ensureBillingAccount(user.id);
    const data = {
      authenticated: true,
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

app.post("/api/billing/usage", async (req, res) => {
  noStore(res);
  const unitPrice = Number(process.env.BILLING_UNIT_PRICE_CENTS || 1);
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json(okEmpty({ allowed: false, authenticated: false }, "No data yet"));
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

    return res.json(okData({ tier: roleForEmail(user.email), ...result }));
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
  }
  app.listen(PORT, () => {
    console.log(`cssOS API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Startup failed", err);
  process.exit(1);
});
