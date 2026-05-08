/* CSSOS_WAVE101 20260508 — Jing
 * pg_stat_statements adapter. Top-N slow queries + reset endpoint.
 * Graceful fallback when extension not preloaded on the server.
 */

import { withClient } from "../db";

export type SlowQueryRow = {
  query_truncated: string;
  calls: number;
  mean_ms: number;
  total_ms: number;
  rows: number;
};

export type SlowQueryResponse =
  | { ok: true; available: true; rows: SlowQueryRow[] }
  | { ok: true; available: false; reason: string };

const MAX_QUERY_LEN = 800;

export async function pgStatStatementsAvailable(): Promise<{ available: boolean; reason?: string }> {
  try {
    const r = await withClient((c) =>
      c.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
         ) AS exists`,
      ),
    );
    if (!r.rows[0]?.exists) {
      return { available: false, reason: "pg_stat_statements extension not enabled" };
    }
    return { available: true };
  } catch (err) {
    return { available: false, reason: (err as Error)?.message || String(err) };
  }
}

export async function loadSlowQueries(limit = 20): Promise<SlowQueryResponse> {
  const lim = Math.max(1, Math.min(100, Math.floor(limit) || 20));
  const avail = await pgStatStatementsAvailable();
  if (!avail.available) {
    return { ok: true, available: false, reason: avail.reason || "unknown" };
  }
  try {
    const r = await withClient((c) =>
      c.query<{ query: string; calls: string; mean_ms: string; total_ms: string; rows: string }>(
        `SELECT query, calls, mean_exec_time AS mean_ms, total_exec_time AS total_ms, rows
           FROM pg_stat_statements
          WHERE query NOT LIKE '%pg_stat_statements%'
            AND query NOT LIKE 'BEGIN%'
            AND query NOT LIKE 'COMMIT%'
            AND query NOT LIKE 'SELECT 1%'
          ORDER BY mean_exec_time DESC
          LIMIT $1`,
        [lim],
      ),
    );
    const rows: SlowQueryRow[] = r.rows.map((row) => ({
      query_truncated: String(row.query || "").slice(0, MAX_QUERY_LEN),
      calls: Number(row.calls) || 0,
      mean_ms: Number(row.mean_ms) || 0,
      total_ms: Number(row.total_ms) || 0,
      rows: Number(row.rows) || 0,
    }));
    return { ok: true, available: true, rows };
  } catch (err) {
    return { ok: true, available: false, reason: (err as Error)?.message || String(err) };
  }
}

export async function resetPgStatStatements(): Promise<{ ok: boolean; reason?: string }> {
  const avail = await pgStatStatementsAvailable();
  if (!avail.available) return { ok: false, reason: avail.reason || "unavailable" };
  try {
    await withClient((c) => c.query(`SELECT pg_stat_statements_reset()`));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error)?.message || String(err) };
  }
}
