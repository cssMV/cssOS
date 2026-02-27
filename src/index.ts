import express from "express";
import path from "path";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { QueryResult } from "pg";
import { getDatabaseUrl, getPool, withClient } from "./db";
import { runMigrations } from "./db/migrate";

const app = express();
const PORT = 3000;
const REGISTRY_URL = "http://localhost:8080";

const DATABASE_URL = getDatabaseUrl();
if (process.env.NODE_ENV === "production" && !DATABASE_URL) {
  throw new Error("DATABASE_URL not configured on api-vm");
}

app.set("trust proxy", 1);
app.disable("etag");

app.use(express.json());

if (DATABASE_URL) {
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        pool: getPool(),
        tableName: "session"
      }),
      name: process.env.SESSION_COOKIE || "cssos_session",
      secret: process.env.SESSION_SECRET || "cssos_session_secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: process.env.COOKIE_HTTPONLY !== "false",
        sameSite: (process.env.COOKIE_SAMESITE || "lax") as "lax" | "strict" | "none",
        secure: process.env.COOKIE_SECURE !== "false",
        path: process.env.COOKIE_PATH || "/",
        maxAge: 1000 * 60 * 60 * 24 * Number(process.env.SESSION_TTL_DAYS || 30)
      }
    })
  );
}
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

app.use(
  express.static(path.join(__dirname, "..", "public"), {
    etag: false,
    lastModified: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  })
);

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
    default_role: string | null;
  };
  const result: QueryResult<UserRow> = await withClient((client) =>
    client.query<UserRow>(
      "SELECT id, display_name, email, avatar_url, default_role FROM users WHERE id = $1",
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

function providerConfig() {
  const providers = [
    { id: "google", name: "Google", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
    { id: "github", name: "GitHub", env: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"] },
    { id: "x", name: "X", env: ["X_CLIENT_ID", "X_CLIENT_SECRET"] },
    { id: "bsky", name: "Bluesky", env: ["BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"] },
    { id: "tiktok", name: "TikTok", env: ["TIKTOK_CLIENT_ID", "TIKTOK_CLIENT_SECRET"] },
    { id: "facebook", name: "Facebook", env: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"] },
    { id: "wechat", name: "WeChat", env: ["WECHAT_CLIENT_ID", "WECHAT_CLIENT_SECRET"] }
  ];
  return providers.map((provider) => {
    const enabled = provider.env.every((key) => Boolean(process.env[key]));
    return {
      id: provider.id,
      name: provider.name,
      enabled,
      url: enabled ? `/api/auth/${provider.id}` : ""
    };
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
        role: user.default_role || "user",
        tier: user.default_role || "user"
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

    return res.json(okData({ tier: user.default_role || "user", ...result }));
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
  }
  app.listen(PORT, () => {
    console.log(`cssOS API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Startup failed", err);
  process.exit(1);
});
