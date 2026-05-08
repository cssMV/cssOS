/* CSSOS_WAVE99 20260508 — Jing
 * Daily admin OPS report — composes a 24h ops digest and emails admins.
 * Reuses sendEmail() + admin email allowlist. Skippable when EMAIL_FROM
 * unset (dev). Same-process scheduler fires daily at 09:00 UTC.
 */

import { withClient } from "../db";
import { sendEmail } from "./weekly-digest";

export type OpsMetrics = {
  generated_at: string;
  window_hours: number;
  dau: number;
  new_signups: number;
  new_mvs: number;
  top_errors: Array<{ message: string; source: string; count: number }>;
  engine_usage: Array<{ engine_id: string; calls: number; cost_cents: number; failure_rate: number }>;
  engine_balances: Array<{ engine_id: string; balance: number | null; threshold: number | null; alert: boolean }>;
  web_vitals: Array<{ metric: string; p75: number; samples: number }>;
  storage: { db_row_estimate: number; artifact_dir_bytes: number | null };
  health_probes: Array<{ probe_kind: string; total: number; ok: number; pass_rate: number }>;
};

function esc(s: string): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

async function loadDau(): Promise<number> {
  return safe(
    withClient(async (c) => {
      const r = await c.query<{ n: number }>(
        `SELECT COUNT(DISTINCT user_id)::int AS n
           FROM usage_events
          WHERE created_at > now() - interval '24 hours'
            AND user_id IS NOT NULL`,
      );
      return Number(r.rows[0]?.n || 0);
    }),
    0,
  );
}

async function loadNewSignups(): Promise<number> {
  return safe(
    withClient(async (c) => {
      const r = await c.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM users WHERE created_at > now() - interval '24 hours'`,
      );
      return Number(r.rows[0]?.n || 0);
    }),
    0,
  );
}

async function loadNewMvs(): Promise<number> {
  return safe(
    withClient(async (c) => {
      const r = await c.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM person_mvs WHERE created_at > now() - interval '24 hours'`,
      );
      return Number(r.rows[0]?.n || 0);
    }),
    0,
  );
}

async function loadTopErrors(): Promise<OpsMetrics["top_errors"]> {
  return safe(
    withClient(async (c) => {
      const r = await c.query<{ message: string; source: string; count: number }>(
        `SELECT
           substr(message, 1, 200) AS message,
           source,
           COUNT(*)::int AS count
         FROM server_error_log
         WHERE occurred_at > now() - interval '24 hours'
         GROUP BY substr(message, 1, 200), source
         ORDER BY count DESC
         LIMIT 10`,
      );
      return r.rows.map((x) => ({ message: x.message, source: x.source, count: Number(x.count) || 0 }));
    }),
    [],
  );
}

async function loadEngineUsage(): Promise<OpsMetrics["engine_usage"]> {
  // Best-effort: usage_events.meta carries engine_id and an ok/error flag.
  return safe(
    withClient(async (c) => {
      const r = await c.query<{ engine_id: string; calls: number; cost_cents: number; failures: number }>(
        `SELECT
           COALESCE(NULLIF(meta->>'engine_id', ''), route, 'unknown') AS engine_id,
           COUNT(*)::int AS calls,
           COALESCE(SUM(cost_cents), 0)::int AS cost_cents,
           SUM(CASE WHEN (meta->>'ok') = 'false' OR (meta ? 'error') THEN 1 ELSE 0 END)::int AS failures
         FROM usage_events
         WHERE created_at > now() - interval '24 hours'
         GROUP BY 1
         ORDER BY calls DESC
         LIMIT 12`,
      );
      return r.rows.map((x) => ({
        engine_id: x.engine_id,
        calls: Number(x.calls) || 0,
        cost_cents: Number(x.cost_cents) || 0,
        failure_rate: x.calls ? Number(x.failures) / Number(x.calls) : 0,
      }));
    }),
    [],
  );
}

async function loadEngineBalances(): Promise<OpsMetrics["engine_balances"]> {
  // Most recent alert per engine within 7d gives us the alert flag/threshold.
  return safe(
    withClient(async (c) => {
      const r = await c.query<{ engine_id: string; balance: string | null; threshold: string | null }>(
        `SELECT DISTINCT ON (engine_id) engine_id,
                balance_at_alert::text AS balance,
                threshold::text AS threshold
           FROM engine_balance_alerts
          WHERE alerted_at > now() - interval '7 days'
          ORDER BY engine_id, alerted_at DESC`,
      );
      return r.rows.map((x) => ({
        engine_id: x.engine_id,
        balance: x.balance == null ? null : Number(x.balance),
        threshold: x.threshold == null ? null : Number(x.threshold),
        alert: true,
      }));
    }),
    [],
  );
}

async function loadWebVitals(): Promise<OpsMetrics["web_vitals"]> {
  return safe(
    withClient(async (c) => {
      const r = await c.query<{ metric: string; p75: number; samples: number }>(
        `SELECT metric,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::float AS p75,
                COUNT(*)::int AS samples
           FROM web_vitals_samples
          WHERE ts > now() - interval '24 hours'
            AND metric IN ('LCP','CLS','INP')
          GROUP BY metric
          ORDER BY metric`,
      );
      return r.rows.map((x) => ({ metric: x.metric, p75: Number(x.p75) || 0, samples: Number(x.samples) || 0 }));
    }),
    [],
  );
}

async function loadStorage(): Promise<OpsMetrics["storage"]> {
  let dbRows = 0;
  try {
    const r = await withClient((c) =>
      c.query<{ n: number }>(
        `SELECT COALESCE(SUM(reltuples), 0)::bigint::int AS n
           FROM pg_class WHERE relkind = 'r'`,
      ),
    );
    dbRows = Number(r.rows[0]?.n || 0);
  } catch { /* ignore */ }

  let artifactBytes: number | null = null;
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.resolve(process.cwd(), "artifacts");
    let total = 0;
    async function walk(d: string): Promise<void> {
      let entries: any[] = [];
      try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = path.join(d, e.name);
        try {
          if (e.isDirectory()) await walk(p);
          else if (e.isFile()) {
            const st = await fs.stat(p);
            total += st.size;
          }
        } catch { /* skip */ }
      }
    }
    await walk(dir);
    artifactBytes = total;
  } catch { /* ignore */ }
  return { db_row_estimate: dbRows, artifact_dir_bytes: artifactBytes };
}

async function loadHealthProbes(): Promise<OpsMetrics["health_probes"]> {
  return safe(
    withClient(async (c) => {
      const r = await c.query<{ probe_kind: string; total: number; ok: number }>(
        `SELECT probe_kind,
                COUNT(*)::int AS total,
                SUM(CASE WHEN ok THEN 1 ELSE 0 END)::int AS ok
           FROM health_probe_log
          WHERE ts > now() - interval '24 hours'
          GROUP BY probe_kind
          ORDER BY probe_kind`,
      );
      return r.rows.map((x) => ({
        probe_kind: x.probe_kind,
        total: Number(x.total) || 0,
        ok: Number(x.ok) || 0,
        pass_rate: x.total ? Number(x.ok) / Number(x.total) : 1,
      }));
    }),
    [],
  );
}

export async function gatherOpsMetrics(): Promise<OpsMetrics> {
  const [dau, signups, mvs, topErrors, eu, eb, wv, st, hp] = await Promise.all([
    loadDau(), loadNewSignups(), loadNewMvs(), loadTopErrors(),
    loadEngineUsage(), loadEngineBalances(), loadWebVitals(),
    loadStorage(), loadHealthProbes(),
  ]);
  return {
    generated_at: new Date().toISOString(),
    window_hours: 24,
    dau,
    new_signups: signups,
    new_mvs: mvs,
    top_errors: topErrors,
    engine_usage: eu,
    engine_balances: eb,
    web_vitals: wv,
    storage: st,
    health_probes: hp,
  };
}

function fmtBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function renderOpsReport(m: OpsMetrics): { subject: string; html: string; text: string } {
  const subject = `cssOS ops · ${m.generated_at.slice(0, 10)} · ${m.dau} DAU · ${m.new_mvs} MVs`;

  const errorsHtml = m.top_errors.length
    ? m.top_errors.map((e) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-family:ui-monospace,Menlo,monospace;font-size:12px;">${esc(e.message)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;">${esc(e.source)}</td>
            <td align="right" style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;">${e.count}</td></tr>`,
      ).join("")
    : `<tr><td colspan="3" style="padding:8px;color:#888;">No errors logged</td></tr>`;

  const usageHtml = m.engine_usage.length
    ? m.engine_usage.map((u) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(u.engine_id)}</td>
            <td align="right" style="padding:6px 8px;border-bottom:1px solid #eee;">${u.calls}</td>
            <td align="right" style="padding:6px 8px;border-bottom:1px solid #eee;">$${(u.cost_cents / 100).toFixed(2)}</td>
            <td align="right" style="padding:6px 8px;border-bottom:1px solid #eee;${u.failure_rate > 0.05 ? "color:#c00;font-weight:600;" : ""}">${(u.failure_rate * 100).toFixed(1)}%</td></tr>`,
      ).join("")
    : `<tr><td colspan="4" style="padding:8px;color:#888;">No usage events</td></tr>`;

  const balanceHtml = m.engine_balances.length
    ? m.engine_balances.map((b) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(b.engine_id)}</td>
            <td align="right" style="padding:6px 8px;border-bottom:1px solid #eee;">${b.balance ?? "—"}</td>
            <td align="right" style="padding:6px 8px;border-bottom:1px solid #eee;">${b.threshold ?? "—"}</td></tr>`,
      ).join("")
    : `<tr><td colspan="3" style="padding:8px;color:#888;">No balance alerts in 7d</td></tr>`;

  const vitalsHtml = m.web_vitals.length
    ? m.web_vitals.map((v) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(v.metric)}</td>
            <td align="right" style="padding:6px 8px;border-bottom:1px solid #eee;">${v.p75.toFixed(2)}</td>
            <td align="right" style="padding:6px 8px;border-bottom:1px solid #eee;color:#888;">${v.samples}</td></tr>`,
      ).join("")
    : `<tr><td colspan="3" style="padding:8px;color:#888;">No samples</td></tr>`;

  const probeHtml = m.health_probes.length
    ? m.health_probes.map((p) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(p.probe_kind)}</td>
            <td align="right" style="padding:6px 8px;border-bottom:1px solid #eee;">${p.ok} / ${p.total}</td>
            <td align="right" style="padding:6px 8px;border-bottom:1px solid #eee;${p.pass_rate < 0.95 ? "color:#c00;font-weight:600;" : ""}">${(p.pass_rate * 100).toFixed(1)}%</td></tr>`,
      ).join("")
    : `<tr><td colspan="3" style="padding:8px;color:#888;">No probes</td></tr>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(subject)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, .bg { background:#0c0c0d !important; color:#eaeaea !important; }
    .card { background:#16171a !important; color:#eaeaea !important; border-color:#2a2b2f !important; }
    .muted { color:#9aa0a6 !important; }
    a { color:#8ab4ff !important; }
  }
</style></head>
<body class="bg" style="margin:0;padding:24px;background:#f6f7f9;color:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div class="card" style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
    <div style="font-size:20px;font-weight:700;">cssOS · Daily OPS Report</div>
    <div class="muted" style="color:#666;font-size:13px;margin-bottom:18px;">${esc(m.generated_at)} · last ${m.window_hours}h</div>

    <table role="presentation" width="100%" style="border-collapse:collapse;margin:8px 0 18px;">
      <tr>
        <td style="padding:8px;background:#f1f5fb;border-radius:8px;text-align:center;">
          <div class="muted" style="font-size:12px;color:#666;">DAU</div>
          <div style="font-size:22px;font-weight:700;">${m.dau}</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:8px;background:#f1f5fb;border-radius:8px;text-align:center;">
          <div class="muted" style="font-size:12px;color:#666;">New signups</div>
          <div style="font-size:22px;font-weight:700;">${m.new_signups}</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:8px;background:#f1f5fb;border-radius:8px;text-align:center;">
          <div class="muted" style="font-size:12px;color:#666;">New MVs</div>
          <div style="font-size:22px;font-weight:700;">${m.new_mvs}</div>
        </td>
      </tr>
    </table>

    <h3 style="margin:16px 0 6px;font-size:14px;">Top errors</h3>
    <table width="100%" style="border-collapse:collapse;font-size:13px;"><tbody>${errorsHtml}</tbody></table>

    <h3 style="margin:20px 0 6px;font-size:14px;">Engine usage</h3>
    <table width="100%" style="border-collapse:collapse;font-size:13px;">
      <thead><tr><th align="left" style="padding:6px 8px;color:#666;">Engine</th><th align="right" style="padding:6px 8px;color:#666;">Calls</th><th align="right" style="padding:6px 8px;color:#666;">Cost</th><th align="right" style="padding:6px 8px;color:#666;">Fail %</th></tr></thead>
      <tbody>${usageHtml}</tbody>
    </table>

    <h3 style="margin:20px 0 6px;font-size:14px;">Engine balance alerts (7d)</h3>
    <table width="100%" style="border-collapse:collapse;font-size:13px;">
      <thead><tr><th align="left" style="padding:6px 8px;color:#666;">Engine</th><th align="right" style="padding:6px 8px;color:#666;">Balance</th><th align="right" style="padding:6px 8px;color:#666;">Threshold</th></tr></thead>
      <tbody>${balanceHtml}</tbody>
    </table>

    <h3 style="margin:20px 0 6px;font-size:14px;">Web vitals (p75)</h3>
    <table width="100%" style="border-collapse:collapse;font-size:13px;">
      <thead><tr><th align="left" style="padding:6px 8px;color:#666;">Metric</th><th align="right" style="padding:6px 8px;color:#666;">p75</th><th align="right" style="padding:6px 8px;color:#666;">Samples</th></tr></thead>
      <tbody>${vitalsHtml}</tbody>
    </table>

    <h3 style="margin:20px 0 6px;font-size:14px;">Health probes (24h)</h3>
    <table width="100%" style="border-collapse:collapse;font-size:13px;">
      <thead><tr><th align="left" style="padding:6px 8px;color:#666;">Kind</th><th align="right" style="padding:6px 8px;color:#666;">OK / Total</th><th align="right" style="padding:6px 8px;color:#666;">Pass</th></tr></thead>
      <tbody>${probeHtml}</tbody>
    </table>

    <h3 style="margin:20px 0 6px;font-size:14px;">Storage</h3>
    <div class="muted" style="color:#444;font-size:13px;">DB rows (estimate): <b>${m.storage.db_row_estimate.toLocaleString()}</b> · Artifacts dir: <b>${fmtBytes(m.storage.artifact_dir_bytes)}</b></div>
  </div>
</body></html>`;

  const lines = [
    `cssOS · Daily OPS Report (${m.generated_at}, last ${m.window_hours}h)`,
    "",
    `DAU: ${m.dau}   New signups: ${m.new_signups}   New MVs: ${m.new_mvs}`,
    "",
    "Top errors:",
    ...m.top_errors.map((e) => `  [${e.count}] (${e.source}) ${e.message}`),
    "",
    "Engine usage (calls / cost / fail%):",
    ...m.engine_usage.map((u) => `  ${u.engine_id}: ${u.calls} / $${(u.cost_cents / 100).toFixed(2)} / ${(u.failure_rate * 100).toFixed(1)}%`),
    "",
    "Engine balance alerts (7d):",
    ...m.engine_balances.map((b) => `  ${b.engine_id}: bal=${b.balance ?? "—"} thr=${b.threshold ?? "—"}`),
    "",
    "Web vitals p75:",
    ...m.web_vitals.map((v) => `  ${v.metric}: ${v.p75.toFixed(2)}  (n=${v.samples})`),
    "",
    "Health probes (24h):",
    ...m.health_probes.map((p) => `  ${p.probe_kind}: ${p.ok}/${p.total}  (${(p.pass_rate * 100).toFixed(1)}%)`),
    "",
    `Storage: db rows ~${m.storage.db_row_estimate}, artifacts ${fmtBytes(m.storage.artifact_dir_bytes)}`,
  ];

  return { subject, html, text: lines.join("\n") };
}

export async function composeDailyOpsReport(): Promise<{ metrics: OpsMetrics; subject: string; html: string; text: string }> {
  const metrics = await gatherOpsMetrics();
  const r = renderOpsReport(metrics);
  return { metrics, ...r };
}

function adminEmails(): string[] {
  const raw = (process.env.ADMIN_EMAILS || "jingdudc@gmail.com,admin@cssstudio.app").trim();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const e = part.trim().toLowerCase();
    if (e && e.includes("@")) out.push(e);
  }
  return out;
}

export async function sendDailyOpsReport(): Promise<{ ok: boolean; sent: number; skipped: boolean; reason?: string; errors: string[] }> {
  if (!process.env.EMAIL_FROM && !process.env.RESEND_API_KEY) {
    return { ok: true, sent: 0, skipped: true, reason: "EMAIL_FROM/RESEND_API_KEY unset", errors: [] };
  }
  const composed = await composeDailyOpsReport();
  const recipients = adminEmails();
  const errors: string[] = [];
  let sent = 0;
  for (const to of recipients) {
    const r = await sendEmail({
      to,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
    });
    if (r.ok) sent++;
    else errors.push(`${to}: ${r.error}`);
  }
  return { ok: errors.length === 0, sent, skipped: false, errors };
}
