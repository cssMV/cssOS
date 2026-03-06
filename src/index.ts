import express from "express";
import path from "path";
import crypto from "node:crypto";
import fs from "node:fs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { PoolClient, QueryResult } from "pg";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { getDatabaseUrl, getPool, withClient } from "./db";
import { runMigrations } from "./db/migrate";

const app = express();
const PORT = 3000;
const REGISTRY_URL = "http://localhost:8080";
const CSSAPI_URL = process.env.CSSAPI_URL || "http://127.0.0.1:8081";
const IS_PROD = process.env.NODE_ENV === "production";

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const idx = trimmed.indexOf("=");
  if (idx <= 0) return null;
  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return key ? { key, value } : null;
}

function loadEnvFileIfExists(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const parsed = parseEnvLine(line);
      if (!parsed) return;
      const current = process.env[parsed.key];
      if (current === undefined || current === null || current === "") {
        process.env[parsed.key] = parsed.value;
      }
    });
  } catch {
    // ignore optional env fallback errors
  }
}

function hydrateAppleEnvFallback() {
  const required = ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"];
  const missing = required.some((key) => !process.env[key]);
  if (!missing) return;
  loadEnvFileIfExists("/etc/cssstudio/cssstudio.env");
  loadEnvFileIfExists("/etc/cssos.env");
}

hydrateAppleEnvFallback();

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
    role: string | null;
    is_admin: boolean | null;
  };
  const result: QueryResult<UserRow> = await withClient((client) =>
    client.query<UserRow>(
      "SELECT id, display_name, email, avatar_url, role, is_admin FROM users WHERE id = $1",
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

const appleOauthStateCache = new Map<
  string,
  {
    nonce: string;
    expireAt: number;
  }
>();
const AUTH_TICKET_TTL_MS = 3 * 60 * 1000;
const AUTH_TICKET_SECRET = process.env.AUTH_TICKET_SECRET || process.env.SESSION_SECRET || "cssos_auth_ticket_secret";
const AUTH_SESSION_COOKIE = process.env.AUTH_SESSION_COOKIE || "cssos_auth";
const AUTH_SESSION_TTL_MS =
  1000 * 60 * 60 * 24 * Number(process.env.AUTH_SESSION_TTL_DAYS || process.env.SESSION_TTL_DAYS || 30);

function cleanupPasskeyState() {
  const now = Date.now();
  for (const [k, v] of passkeyState.entries()) {
    if (v.expireAt <= now) passkeyState.delete(k);
  }
}

function cleanupAppleOauthState() {
  const now = Date.now();
  for (const [k, v] of appleOauthStateCache.entries()) {
    if (v.expireAt <= now) appleOauthStateCache.delete(k);
  }
}

function b64urlDecodeToBuffer(input: string) {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function createAuthTicket(userId: string) {
  const payload = { u: userId, e: Date.now() + AUTH_TICKET_TTL_MS };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sigB64 = b64url(crypto.createHmac("sha256", AUTH_TICKET_SECRET).update(payloadB64).digest());
  return `${payloadB64}.${sigB64}`;
}

function verifyAuthTicket(ticket: string): string | null {
  const raw = String(ticket || "").trim();
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const payloadB64 = parts[0] || "";
  const sigB64 = parts[1] || "";
  if (!payloadB64 || !sigB64) return null;
  const expectedSig = crypto.createHmac("sha256", AUTH_TICKET_SECRET).update(payloadB64).digest();
  const providedSig = b64urlDecodeToBuffer(sigB64);
  if (providedSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(providedSig, expectedSig)) return null;
  try {
    const payload = JSON.parse(b64urlDecodeToBuffer(payloadB64).toString("utf8")) as { u?: string; e?: number };
    if (!payload?.u || !payload?.e) return null;
    if (Number(payload.e) <= Date.now()) return null;
    return String(payload.u);
  } catch {
    return null;
  }
}

function authTokenHash(token: string) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
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

function normalizeEmailInput(input: unknown): string | null {
  const value = String(input || "").trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value;
}

function passkeyIdentifierFromReq(req: express.Request): string | null {
  const bodyIdentifier = normalizeEmailInput(req.body?.identifier);
  if (bodyIdentifier) return bodyIdentifier;
  return normalizeEmailInput(req.query?.identifier);
}

function passkeySubject(
  req: express.Request,
  user: Awaited<ReturnType<typeof getSessionUser>>,
  identifier?: string | null
) {
  const email = normalizeEmailInput(identifier || user?.email);
  if (email) {
    return {
      key: `e:${email}`,
      id: email,
      name: email,
      displayName: user?.display_name || email
    };
  }
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

async function ensureUserByEmail(email: string): Promise<string | null> {
  if (!DATABASE_URL) return null;
  return withClient(async (client) => {
    const found = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [email]
    );
    if (found.rows[0]?.id) return found.rows[0].id;
    const created = await client.query<{ id: string }>(
      `INSERT INTO users (display_name, email, avatar_url, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [null, email, null, "user"]
    );
    return created.rows[0]?.id || null;
  });
}

async function resolveUserIdForSubjectKey(subjectKey: string): Promise<string | null> {
  if (!subjectKey) return null;
  if (subjectKey.startsWith("u:")) {
    const id = subjectKey.slice(2).trim();
    return id || null;
  }
  if (subjectKey.startsWith("e:")) {
    const email = normalizeEmailInput(subjectKey.slice(2));
    if (!email) return null;
    return ensureUserByEmail(email);
  }
  return null;
}

async function findAnySubjectByCredential(credentialId: string): Promise<string | null> {
  if (!credentialId) return null;
  if (!DATABASE_URL) {
    for (const [subjectKey, creds] of passkeyCreds.entries()) {
      if (Array.isArray(creds) && creds.some((x) => x.id === credentialId)) {
        return subjectKey;
      }
    }
    return null;
  }
  const result: QueryResult<{ subject_key: string }> = await withClient((client) =>
    client.query<{ subject_key: string }>(
      "SELECT subject_key FROM passkey_credentials WHERE credential_id = $1 LIMIT 1",
      [credentialId]
    )
  );
  return result.rows[0]?.subject_key || null;
}

async function saveSessionAsync(req: express.Request) {
  if (!req.session) return;
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function readCookie(req: express.Request, name: string) {
  const raw = String(req.headers.cookie || "");
  if (!raw) return "";
  const found = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!found) return "";
  const value = found.slice(name.length + 1).trim();
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function setAuthTicketCookie(res: express.Response, ticket: string) {
  const sameSite = (sessionConfig.cookie?.sameSite || "lax") as "lax" | "strict" | "none";
  const secure = Boolean(sessionConfig.cookie?.secure);
  res.cookie("cssos_auth_ticket", ticket, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: 3 * 60 * 1000
  });
}

function clearAuthTicketCookie(res: express.Response) {
  const sameSite = (sessionConfig.cookie?.sameSite || "lax") as "lax" | "strict" | "none";
  const secure = Boolean(sessionConfig.cookie?.secure);
  res.clearCookie("cssos_auth_ticket", {
    httpOnly: true,
    sameSite,
    secure,
    path: "/"
  });
}

function setAuthSessionCookie(res: express.Response, token: string) {
  const sameSite = (sessionConfig.cookie?.sameSite || "lax") as "lax" | "strict" | "none";
  const secure = Boolean(sessionConfig.cookie?.secure);
  res.cookie(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: AUTH_SESSION_TTL_MS
  });
}

function clearAuthSessionCookie(res: express.Response) {
  const sameSite = (sessionConfig.cookie?.sameSite || "lax") as "lax" | "strict" | "none";
  const secure = Boolean(sessionConfig.cookie?.secure);
  res.clearCookie(AUTH_SESSION_COOKIE, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/"
  });
}

async function createDbAuthSession(userId: string): Promise<string | null> {
  if (!DATABASE_URL || !userId) return null;
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = authTokenHash(token);
  await withClient((client) =>
    client.query(
      `INSERT INTO auth_sessions (token_hash, user_id, expires_at, last_seen_at, updated_at)
       VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval, now(), now())`,
      [tokenHash, userId, String(AUTH_SESSION_TTL_MS)]
    )
  );
  return token;
}

async function resolveUserIdByDbAuthSession(token: string): Promise<string | null> {
  if (!DATABASE_URL || !token) return null;
  const tokenHash = authTokenHash(token);
  const result: QueryResult<{ user_id: string }> = await withClient((client) =>
    client.query<{ user_id: string }>(
      `SELECT user_id
         FROM auth_sessions
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        LIMIT 1`,
      [tokenHash]
    )
  );
  const userId = result.rows[0]?.user_id || null;
  if (!userId) return null;
  await withClient((client) =>
    client.query(
      `UPDATE auth_sessions
          SET last_seen_at = now(), updated_at = now()
        WHERE token_hash = $1`,
      [tokenHash]
    )
  );
  return userId;
}

async function revokeDbAuthSession(token: string): Promise<void> {
  if (!DATABASE_URL || !token) return;
  const tokenHash = authTokenHash(token);
  await withClient((client) =>
    client.query(
      `UPDATE auth_sessions
          SET revoked_at = now(), updated_at = now()
        WHERE token_hash = $1`,
      [tokenHash]
    )
  );
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

async function buildPasskeyRegisterOptions(req: express.Request, identifier?: string | null) {
  const user = await getSessionUser(req);
  const subject = passkeySubject(req, user, identifier);
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

async function buildPasskeyLoginOptions(req: express.Request, identifier?: string | null) {
  const user = await getSessionUser(req);
  const subject = passkeySubject(req, user, identifier);
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
    { id: "bsky", name: "Bluesky", env: ["BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"] },
    { id: "tiktok", name: "TikTok", env: ["TIKTOK_CLIENT_ID", "TIKTOK_CLIENT_SECRET"] },
    { id: "facebook", name: "Facebook", env: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"] },
    { id: "wechat", name: "WeChat", env: ["WECHAT_CLIENT_ID", "WECHAT_CLIENT_SECRET"] },
    { id: "apple", name: "Apple", env: ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"] }
  ];
  return providers.map((provider) => {
    const enabled = provider.env.every((key) => Boolean(process.env[key]));
    return {
      id: provider.id,
      name: provider.name,
      enabled,
      url: enabled ? `/auth/${provider.id}` : ""
    };
  });
}

app.use(async (req, res, next) => {
  try {
    if ((req.session as any)?.user_id) {
      next();
      return;
    }
    const authSessionToken = readCookie(req, AUTH_SESSION_COOKIE);
    if (authSessionToken) {
      const dbUserId = await resolveUserIdByDbAuthSession(authSessionToken);
      if (dbUserId) {
        (req.session as any).user_id = dbUserId;
        await saveSessionAsync(req);
        next();
        return;
      }
      clearAuthSessionCookie(res);
    }
    const qTicket =
      typeof req.query?.auth_ticket === "string" ? String(req.query.auth_ticket).trim() : "";
    const cTicket = readCookie(req, "cssos_auth_ticket");
    const ticket = qTicket || cTicket;
    if (!ticket) {
      next();
      return;
    }
    const userId = verifyAuthTicket(ticket);
    if (!userId) {
      if (cTicket) clearAuthTicketCookie(res);
      next();
      return;
    }
    (req.session as any).user_id = userId;
    await saveSessionAsync(req);
    if (cTicket || qTicket) clearAuthTicketCookie(res);
    next();
  } catch {
    next();
  }
});

const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

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

async function findUserIdByEmail(client: PoolClient, email: string): Promise<string | null> {
  const found = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
    [email]
  );
  return found.rows[0]?.id || null;
}

async function upsertAppleIdentity(args: { sub: string; email: string | null; preferredEmail?: string | null }) {
  const { sub, email, preferredEmail } = args;
  const preferred = normalizeEmailInput(preferredEmail || "");
  const primaryEmail = preferred || normalizeEmailInput(email || "");
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const found = await client.query<{ user_id: string }>(
        "SELECT user_id FROM oauth_identities WHERE provider = $1 AND provider_user_id = $2 LIMIT 1",
        ["apple", sub]
      );
      if (found.rows[0]?.user_id) {
        if (preferred) {
          const preferredUserId = await findUserIdByEmail(client, preferred);
          if (preferredUserId && preferredUserId !== found.rows[0].user_id) {
            await client.query(
              `UPDATE oauth_identities
                  SET user_id = $1
                WHERE provider = $2 AND provider_user_id = $3`,
              [preferredUserId, "apple", sub]
            );
            await client.query("COMMIT");
            return preferredUserId;
          }
        }
        await client.query("COMMIT");
        return found.rows[0].user_id;
      }

      let userId: string | null = null;
      if (primaryEmail) {
        userId = await findUserIdByEmail(client, primaryEmail);
      }

      if (!userId) {
        const userRes = await client.query<{ id: string }>(
          `INSERT INTO users (display_name, email, avatar_url, role)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [null, primaryEmail || email, null, "user"]
        );
        userId = userRes.rows[0]?.id || null;
      }
      if (!userId) throw new Error("user_create_failed");

      await client.query(
        `INSERT INTO oauth_identities (user_id, provider, provider_user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [userId, "apple", sub]
      );
      await client.query("COMMIT");
      return userId;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });
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

app.use("/cssapi", async (req, res) => {
  try {
    const url = `${CSSAPI_URL}${req.originalUrl}`;
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

    res.setHeader("Cache-Control", "no-store");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (_err) {
    res.status(502).json({ error: "cssapi_unavailable" });
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
    const effectiveRole = user.is_admin ? "admin" : (user.role || "user");
    return res.json(
      okData({
        authenticated: true,
        user: {
          id: user.id,
          name: user.display_name,
          email: user.email,
          avatar: user.avatar_url
        },
        role: effectiveRole,
        tier: effectiveRole
      })
    );
  } catch (_err) {
    return res.json(okEmpty({ authenticated: false, user: null }, "No data yet"));
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
    cleanupAppleOauthState();
    const clientId = process.env.APPLE_CLIENT_ID || "";
    if (!clientId) return res.status(503).send("apple_not_configured");
    const state = crypto.randomBytes(16).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");
    const identifier = normalizeEmailInput(req.query?.identifier);
    (req.session as any).apple_oauth_state = state;
    (req.session as any).apple_oauth_nonce = nonce;
    (req.session as any).apple_oauth_identifier = identifier || "";
    appleOauthStateCache.set(state, { nonce, expireAt: Date.now() + 5 * 60 * 1000 });

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

function readAuthParam(req: express.Request, key: string) {
  const fromBody = (req.body as Record<string, unknown> | undefined)?.[key];
  if (typeof fromBody === "string" && fromBody.length > 0) return fromBody;
  const fromQuery = req.query?.[key];
  if (typeof fromQuery === "string" && fromQuery.length > 0) return fromQuery;
  return "";
}

async function handleAppleCallback(req: express.Request, res: express.Response) {
  noStore(res);
  try {
    cleanupAppleOauthState();
    const code = readAuthParam(req, "code");
    const state = readAuthParam(req, "state");
    const savedState = String((req.session as any).apple_oauth_state || "");
    const savedNonce = String((req.session as any).apple_oauth_nonce || "");
    const preferredEmail = normalizeEmailInput((req.session as any).apple_oauth_identifier || "");
    const cached = state ? appleOauthStateCache.get(state) : null;
    const expectedState = savedState || (cached ? state : "");
    const expectedNonce = savedNonce || (cached?.nonce || "");
    (req.session as any).apple_oauth_state = null;
    (req.session as any).apple_oauth_nonce = null;
    (req.session as any).apple_oauth_identifier = null;
    if (state) appleOauthStateCache.delete(state);
    if (!code || !state || !expectedState || state !== expectedState) {
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
    if (expectedNonce && payload.nonce && String(payload.nonce) !== expectedNonce) {
      return res.status(400).send("auth_failed");
    }
    const email = payload.email ? String(payload.email) : null;
    const userId = await upsertAppleIdentity({ sub, email, preferredEmail });
    (req.session as any).user_id = userId;
    await saveSessionAsync(req);
    const authSessionToken = await createDbAuthSession(userId);
    if (authSessionToken) setAuthSessionCookie(res, authSessionToken);
    const authTicket = createAuthTicket(userId);
    setAuthTicketCookie(res, authTicket);
    return res.redirect(302, `/auth/finalize?auth_ticket=${encodeURIComponent(authTicket)}`);
  } catch {
    return res.status(400).send("auth_failed");
  }
}

app.get("/auth/apple/callback", async (req, res) => handleAppleCallback(req, res));
app.post("/auth/apple/callback", async (req, res) => handleAppleCallback(req, res));

app.get("/auth/finalize", async (req, res) => {
  noStore(res);
  try {
    const ticket = typeof req.query?.auth_ticket === "string" ? String(req.query.auth_ticket).trim() : "";
    const userId = verifyAuthTicket(ticket);
    if (userId) {
      (req.session as any).user_id = userId;
      await saveSessionAsync(req);
      const authSessionToken = await createDbAuthSession(userId);
      if (authSessionToken) setAuthSessionCookie(res, authSessionToken);
    }
    clearAuthTicketCookie(res);
    return res.redirect(302, "/");
  } catch {
    clearAuthTicketCookie(res);
    return res.redirect(302, "/");
  }
});

app.get("/api/auth/apple", (_req, res) => {
  res.redirect(302, "/auth/apple");
});

app.get("/api/auth/apple/callback", (req, res) => {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/auth/apple/callback${q}`);
});

app.post("/api/auth/logout", async (req, res) => {
  noStore(res);
  const authSessionToken = readCookie(req, AUTH_SESSION_COOKIE);
  await revokeDbAuthSession(authSessionToken).catch(() => {});
  clearAuthSessionCookie(res);
  if (req.session) {
    req.session.destroy(() => {
      res.clearCookie(process.env.SESSION_COOKIE || "cssos_session");
      clearAuthTicketCookie(res);
      res.json(okData({ loggedOut: true }));
    });
    return;
  }
  clearAuthTicketCookie(res);
  res.json(okData({ loggedOut: true }));
});

app.get("/api/auth/passkey/register/options", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    const identifier = passkeyIdentifierFromReq(req);
    return res.json(await buildPasskeyRegisterOptions(req, identifier));
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_REGISTER_OPTIONS_FAILED" });
  }
});

app.post("/api/auth/passkey/register/options", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    const identifier = passkeyIdentifierFromReq(req);
    return res.json(await buildPasskeyRegisterOptions(req, identifier));
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_REGISTER_OPTIONS_FAILED" });
  }
});

app.post("/api/auth/passkey/register/verify", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    const identifier = passkeyIdentifierFromReq(req);
    const user = await getSessionUser(req);
    const subject = passkeySubject(req, user, identifier);
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
    const userId = await resolveUserIdForSubjectKey(subject.key);
    if (userId) {
      (req.session as any).user_id = userId;
      await saveSessionAsync(req);
    }
    return res.json({ ok: true, enabled: true, user_id: userId || null });
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_REGISTER_VERIFY_FAILED" });
  }
});

app.get("/api/auth/passkey/login/options", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    const identifier = passkeyIdentifierFromReq(req);
    return res.json(await buildPasskeyLoginOptions(req, identifier));
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_LOGIN_OPTIONS_FAILED" });
  }
});

app.post("/api/auth/passkey/login/options", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    const identifier = passkeyIdentifierFromReq(req);
    return res.json(await buildPasskeyLoginOptions(req, identifier));
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_LOGIN_OPTIONS_FAILED" });
  }
});

app.post("/api/auth/passkey/login/verify", async (req, res) => {
  noStore(res);
  cleanupPasskeyState();
  try {
    const identifier = passkeyIdentifierFromReq(req);
    const user = await getSessionUser(req);
    const subject = passkeySubject(req, user, identifier);
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
    let matchedSubjectKey = subject.key;
    if (!list.some((x) => x.id === credId)) {
      const fallbackSubjectKey = await findAnySubjectByCredential(credId);
      if (!fallbackSubjectKey) {
        return res.status(400).json({ code: "PASSKEY_CRED_NOT_FOUND" });
      }
      matchedSubjectKey = fallbackSubjectKey;
      if (identifier && fallbackSubjectKey !== subject.key) {
        const transports = Array.isArray(credential?.response?.transports)
          ? credential.response.transports.filter((x: unknown): x is string => typeof x === "string")
          : ["internal"];
        await savePasskeyCred(subject.key, credId, transports);
        matchedSubjectKey = subject.key;
      }
    }
    passkeyState.delete(subject.key);
    const userId = await resolveUserIdForSubjectKey(matchedSubjectKey);
    if (userId) {
      (req.session as any).user_id = userId;
      await saveSessionAsync(req);
    }
    return res.json({ ok: true, verified: true, authenticated: Boolean(userId) });
  } catch (_err) {
    return res.status(500).json({ code: "PASSKEY_LOGIN_VERIFY_FAILED" });
  }
});

app.post("/api/auth/finalize", async (req, res) => {
  noStore(res);
  try {
    const ticket = String(req.body?.ticket || "").trim();
    if (!ticket) {
      const user = await getSessionUser(req);
      if (!user) return res.json(okEmpty({ authenticated: false }, "No data yet"));
      return res.json(okData({ authenticated: true }));
    }
    const userId = verifyAuthTicket(ticket);
    if (!userId) return res.status(400).json({ ok: false, error: "invalid_ticket" });
    (req.session as any).user_id = userId;
    await saveSessionAsync(req);
    const authSessionToken = await createDbAuthSession(userId);
    if (authSessionToken) setAuthSessionCookie(res, authSessionToken);
    clearAuthTicketCookie(res);
    return res.json(okData({ authenticated: true }));
  } catch {
    return res.status(500).json({ ok: false, error: "finalize_failed" });
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

    const effectiveRole = user.is_admin ? "admin" : (user.role || "user");
    return res.json(okData({ tier: effectiveRole, ...result }));
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

app.get("/profile", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/settings", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

async function start() {
  if (DATABASE_URL) {
    await runMigrations();
  }
  app.listen(PORT, () => {
    console.log(`cssOS API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Startup failed", err);
  process.exit(1);
});
