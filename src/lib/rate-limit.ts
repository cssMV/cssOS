/**
 * CSSOS_WAVE103 20260508 — Jing — unified rate limiter.
 *
 * Two backends:
 *  - in-memory (default in dev / when DB unavailable): per-process Map.
 *  - DB-backed: rate_limit_buckets table, transactional UPSERT so multiple
 *    Express processes share a single counter.
 *
 * Pick via env: RATE_LIMIT_BACKEND="db" | "memory" (default "memory").
 *
 * Cleanup: a 1h cron deletes rows where last_hit < now() - interval '1 day'.
 */
import { withClient } from "../db";

export type RateLimitOpts = {
  key: string;
  windowMs: number;
  max: number;
  cost?: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetMs: number;
  retryAfterMs?: number;
};

const __memBuckets = new Map<string, { windowStart: number; hits: number }>();

function backend(): "db" | "memory" {
  const v = String(process.env.RATE_LIMIT_BACKEND || "").trim().toLowerCase();
  return v === "db" ? "db" : "memory";
}

async function checkMemory(opts: RateLimitOpts): Promise<RateLimitResult> {
  const cost = Math.max(1, Number(opts.cost || 1));
  const now = Date.now();
  const cur = __memBuckets.get(opts.key);
  let windowStart = cur?.windowStart ?? now;
  let hits = cur?.hits ?? 0;
  if (now - windowStart >= opts.windowMs) {
    windowStart = now;
    hits = 0;
  }
  if (hits + cost > opts.max) {
    const resetMs = windowStart + opts.windowMs - now;
    return {
      ok: false,
      remaining: Math.max(0, opts.max - hits),
      resetMs: Math.max(0, resetMs),
      retryAfterMs: Math.max(0, resetMs),
    };
  }
  hits += cost;
  __memBuckets.set(opts.key, { windowStart, hits });
  // Light cleanup
  if (__memBuckets.size > 10000) {
    for (const [k, v] of __memBuckets) {
      if (now - v.windowStart > 24 * 60 * 60 * 1000) __memBuckets.delete(k);
    }
  }
  return {
    ok: true,
    remaining: Math.max(0, opts.max - hits),
    resetMs: Math.max(0, windowStart + opts.windowMs - now),
  };
}

async function checkDb(opts: RateLimitOpts): Promise<RateLimitResult> {
  const cost = Math.max(1, Number(opts.cost || 1));
  return withClient(async (c) => {
    await c.query("BEGIN");
    try {
      // Lock row if present.
      const sel = await c.query<{ window_start: string; hits: number }>(
        `SELECT window_start, hits FROM rate_limit_buckets
          WHERE key = $1 FOR UPDATE`,
        [opts.key],
      );
      const now = Date.now();
      let windowStart: number;
      let hits: number;
      if (!sel.rows[0]) {
        windowStart = now;
        hits = 0;
      } else {
        windowStart = new Date(sel.rows[0].window_start).getTime();
        hits = Number(sel.rows[0].hits) || 0;
        if (now - windowStart >= opts.windowMs) {
          windowStart = now;
          hits = 0;
        }
      }
      if (hits + cost > opts.max) {
        await c.query("COMMIT");
        const resetMs = Math.max(0, windowStart + opts.windowMs - now);
        return {
          ok: false,
          remaining: Math.max(0, opts.max - hits),
          resetMs,
          retryAfterMs: resetMs,
        };
      }
      hits += cost;
      await c.query(
        `INSERT INTO rate_limit_buckets (key, window_start, hits, last_hit)
           VALUES ($1, to_timestamp($2 / 1000.0), $3, now())
         ON CONFLICT (key) DO UPDATE SET
           window_start = EXCLUDED.window_start,
           hits = EXCLUDED.hits,
           last_hit = now()`,
        [opts.key, windowStart, hits],
      );
      await c.query("COMMIT");
      return {
        ok: true,
        remaining: Math.max(0, opts.max - hits),
        resetMs: Math.max(0, windowStart + opts.windowMs - now),
      };
    } catch (err) {
      try { await c.query("ROLLBACK"); } catch { /* ignore */ }
      // Degrade to in-memory on DB error so we never hard-fail user requests.
      return checkMemory(opts);
    }
  });
}

export async function rateLimitCheck(opts: RateLimitOpts): Promise<RateLimitResult> {
  if (backend() === "db") {
    try { return await checkDb(opts); } catch { return checkMemory(opts); }
  }
  return checkMemory(opts);
}

/** Hourly cleanup of stale DB rows. Safe to call repeatedly. */
export async function rateLimitCleanup(): Promise<number> {
  if (backend() !== "db") return 0;
  try {
    return await withClient(async (c) => {
      const r = await c.query(
        `DELETE FROM rate_limit_buckets WHERE last_hit < now() - interval '1 day'`,
      );
      return r.rowCount || 0;
    });
  } catch {
    return 0;
  }
}
