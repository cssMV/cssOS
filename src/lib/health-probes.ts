/* CSSOS_WAVE94 20260508 — Jing
 * Synthetic site-health probes. Fire-and-forget; never throws to caller.
 *
 *   - runHttpHealthProbes()  HTTP HEAD/GET against critical paths.
 *   - runDbQueryProbes()     SELECT 1, row counts, sample freshness.
 *   - runCanaryMv(runner)    end-to-end pipeline w/ deterministic seed.
 *
 * Each probe records one row in health_probe_log via logProbe().
 */

import { withClient } from "../db";

export type ProbeKind = "http_health" | "canary_mv" | "engine_health" | "db_query";

export type ProbeResult = {
  kind: ProbeKind;
  target: string;
  ok: boolean;
  duration_ms: number;
  status_code: number | null;
  detail: Record<string, unknown> | null;
};

export async function logProbe(r: ProbeResult): Promise<void> {
  try {
    await withClient((c) =>
      c.query(
        `INSERT INTO health_probe_log
           (probe_kind, target, ok, duration_ms, status_code, detail)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          r.kind,
          r.target.slice(0, 400),
          r.ok,
          r.duration_ms,
          r.status_code,
          r.detail ? JSON.stringify(r.detail).slice(0, 8000) : null,
        ],
      ),
    );
  } catch (err) {
    // never throw from probes
    console.warn("[health-probe] log insert failed:", (err as Error)?.message || err);
  }
}

/* ─── HTTP probes ──────────────────────────────────────────────────── */

function appBase(): string {
  return (process.env.APP_BASE_URL || "http://127.0.0.1:" + (process.env.PORT || "3000"))
    .replace(/\/+$/, "");
}

async function probeHttp(path: string, opts: { method?: "GET" | "HEAD"; admin?: boolean } = {}): Promise<ProbeResult> {
  const t0 = Date.now();
  const url = appBase() + path;
  const method = opts.method || "GET";
  const headers: Record<string, string> = {};
  if (opts.admin) {
    const tok = String(process.env.CSSOS_ADMIN_TOKEN || "").trim();
    if (tok) headers["X-Admin-Token"] = tok;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const r = await fetch(url, { method, headers, signal: ctrl.signal });
    clearTimeout(timer);
    const ok = r.status >= 200 && r.status < 400;
    return {
      kind: "http_health",
      target: path,
      ok,
      duration_ms: Date.now() - t0,
      status_code: r.status,
      detail: ok ? null : { method },
    };
  } catch (err) {
    return {
      kind: "http_health",
      target: path,
      ok: false,
      duration_ms: Date.now() - t0,
      status_code: null,
      detail: { error: (err as Error)?.message || String(err) },
    };
  }
}

export async function runHttpHealthProbes(): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  out.push(await probeHttp("/api/health"));
  out.push(await probeHttp("/", { method: "HEAD" }));
  out.push(await probeHttp("/api/person-mv/persons?limit=1"));
  out.push(await probeHttp("/api/admin/engine-health", { admin: true }));
  for (const r of out) await logProbe(r);
  return out;
}

/* ─── DB probes ────────────────────────────────────────────────────── */

export async function runDbQueryProbes(): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];

  // SELECT 1
  {
    const t0 = Date.now();
    try {
      await withClient((c) => c.query(`SELECT 1`));
      out.push({ kind: "db_query", target: "select_1", ok: true, duration_ms: Date.now() - t0, status_code: null, detail: null });
    } catch (err) {
      out.push({ kind: "db_query", target: "select_1", ok: false, duration_ms: Date.now() - t0, status_code: null, detail: { error: (err as Error)?.message || String(err) } });
    }
  }

  // person_profiles row count
  {
    const t0 = Date.now();
    try {
      const r = await withClient((c) => c.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM person_profiles`));
      const n = Number(r.rows[0]?.n || 0);
      out.push({ kind: "db_query", target: "person_profiles_count", ok: n >= 0, duration_ms: Date.now() - t0, status_code: null, detail: { count: n } });
    } catch (err) {
      out.push({ kind: "db_query", target: "person_profiles_count", ok: false, duration_ms: Date.now() - t0, status_code: null, detail: { error: (err as Error)?.message || String(err) } });
    }
  }

  // sample MV freshness — is_official_sample most-recent should be < 48h old
  {
    const t0 = Date.now();
    try {
      const r = await withClient((c) =>
        c.query<{ age_sec: number | null }>(
          `SELECT EXTRACT(EPOCH FROM (now() - max(created_at)))::int AS age_sec
             FROM person_mvs WHERE is_official_sample = true`,
        ),
      );
      const ageSec = r.rows[0]?.age_sec == null ? null : Number(r.rows[0].age_sec);
      const fresh = ageSec != null && ageSec < 48 * 3600;
      out.push({
        kind: "db_query",
        target: "sample_mv_freshness",
        ok: fresh,
        duration_ms: Date.now() - t0,
        status_code: null,
        detail: { age_sec: ageSec, threshold_sec: 48 * 3600 },
      });
    } catch (err) {
      out.push({ kind: "db_query", target: "sample_mv_freshness", ok: false, duration_ms: Date.now() - t0, status_code: null, detail: { error: (err as Error)?.message || String(err) } });
    }
  }

  for (const r of out) await logProbe(r);
  return out;
}

/* ─── Canary MV ────────────────────────────────────────────────────── */

// Deterministic canary seed: prefer Confucius profile, cinematic style.
// Pulled live from DB so the probe exercises a real person row, but the
// pick is deterministic (oldest by created_at among the 3 candidates).
const CANARY_PERSON_IDS = ["confucius", "mozart", "shakespeare"];

export type CanaryRunner = (person: any, opts: { systemUserId: string }) => Promise<{
  ok: boolean;
  stages: Array<{ name: string; ok: boolean; ms: number; error?: string }>;
  error?: string;
}>;

export async function runCanaryMv(runner: CanaryRunner, systemUserId: string): Promise<ProbeResult> {
  const t0 = Date.now();
  let person: any = null;
  try {
    const r = await withClient((c) =>
      c.query(
        `SELECT person_id, name_zh, name_en, core_theme, music_style_hint, tone, lore
           FROM person_profiles
          WHERE person_id = ANY($1::text[])
          ORDER BY array_position($1::text[], person_id) ASC
          LIMIT 1`,
        [CANARY_PERSON_IDS],
      ),
    );
    person = r.rows[0] || null;
  } catch (err) {
    const result: ProbeResult = {
      kind: "canary_mv",
      target: "canary_mv",
      ok: false,
      duration_ms: Date.now() - t0,
      status_code: null,
      detail: { stage: "load_seed", error: (err as Error)?.message || String(err) },
    };
    await logProbe(result);
    return result;
  }
  if (!person) {
    const result: ProbeResult = {
      kind: "canary_mv",
      target: "canary_mv",
      ok: false,
      duration_ms: Date.now() - t0,
      status_code: null,
      detail: { stage: "load_seed", error: "no canary person in db" },
    };
    await logProbe(result);
    return result;
  }
  // Force canary style
  person.music_style_hint = "cinematic";
  try {
    const out = await runner(person, { systemUserId });
    const failedStages = (out.stages || []).filter((s) => !s.ok).map((s) => ({ name: s.name, error: s.error || null, ms: s.ms }));
    const result: ProbeResult = {
      kind: "canary_mv",
      target: `canary:${person.person_id}`,
      ok: !!out.ok,
      duration_ms: Date.now() - t0,
      status_code: null,
      detail: {
        stages: out.stages,
        failed_stages: failedStages,
        error: out.error || null,
      },
    };
    await logProbe(result);
    return result;
  } catch (err) {
    const result: ProbeResult = {
      kind: "canary_mv",
      target: `canary:${person.person_id}`,
      ok: false,
      duration_ms: Date.now() - t0,
      status_code: null,
      detail: { error: (err as Error)?.message || String(err) },
    };
    await logProbe(result);
    return result;
  }
}

/* ─── Summary helper for /api/admin/health/summary ─────────────────── */

export async function loadHealthSummary24h(): Promise<{
  by_kind: Array<{ probe_kind: string; total: number; ok: number; pass_rate: number; avg_ms: number }>;
  recent_failures: Array<{ probe_kind: string; target: string; ts: string; status_code: number | null; detail: any }>;
}> {
  const byKind = await withClient((c) =>
    c.query<{ probe_kind: string; total: number; ok: number; avg_ms: number }>(
      `SELECT probe_kind,
              COUNT(*)::int AS total,
              SUM(CASE WHEN ok THEN 1 ELSE 0 END)::int AS ok,
              COALESCE(AVG(duration_ms), 0)::int AS avg_ms
         FROM health_probe_log
        WHERE ts > now() - interval '24 hours'
        GROUP BY probe_kind
        ORDER BY probe_kind`,
    ),
  );
  const recent = await withClient((c) =>
    c.query<{ probe_kind: string; target: string; ts: string; status_code: number | null; detail: any }>(
      `SELECT probe_kind, target, ts::text AS ts, status_code, detail
         FROM health_probe_log
        WHERE ok = false AND ts > now() - interval '24 hours'
        ORDER BY ts DESC
        LIMIT 20`,
    ),
  );
  return {
    by_kind: byKind.rows.map((r) => ({
      probe_kind: r.probe_kind,
      total: Number(r.total) || 0,
      ok: Number(r.ok) || 0,
      pass_rate: r.total ? Number(r.ok) / Number(r.total) : 1,
      avg_ms: Number(r.avg_ms) || 0,
    })),
    recent_failures: recent.rows,
  };
}
