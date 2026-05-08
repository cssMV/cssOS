/* CSSOS_WAVE80 20260508 — Jing — Sentry init + web-vitals helpers.
 *
 * Sentry uses dynamic require so the module is OPTIONAL: if the
 * package isn't installed (or DSN is unset), every export is a
 * no-op. Per spec: "Sentry MUST handle missing DSN gracefully".
 */

type SentryLike = {
  init: (opts: any) => void;
  expressIntegration?: () => any;
  setupExpressErrorHandler?: (app: any) => void;
  expressErrorHandler?: () => any;
  addBreadcrumb?: (b: any) => void;
  captureException?: (err: unknown) => void;
};

let _sentry: SentryLike | null = null;
let _initialized = false;

export function initSentry(): SentryLike | null {
  if (_initialized) return _sentry;
  _initialized = true;
  const dsn = String(process.env.SENTRY_DSN || "").trim();
  if (!dsn) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry: SentryLike = require("@sentry/node");
    Sentry.init({
      dsn,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      environment: process.env.NODE_ENV || "development",
    });
    _sentry = Sentry;
    return Sentry;
  } catch (err) {
    console.warn("[sentry] init skipped:", String((err as Error)?.message || err));
    return null;
  }
}

export function attachSentryErrorHandler(app: any) {
  const s = _sentry;
  if (!s) return;
  try {
    if (typeof s.setupExpressErrorHandler === "function") {
      s.setupExpressErrorHandler(app);
    } else if (typeof s.expressErrorHandler === "function") {
      app.use(s.expressErrorHandler());
    }
  } catch (err) {
    console.warn("[sentry] error-handler attach failed:", String(err));
  }
}

export function sentryBreadcrumb(b: { category: string; message: string; data?: any }) {
  const s = _sentry;
  if (!s || typeof s.addBreadcrumb !== "function") return;
  try {
    s.addBreadcrumb({ level: "info", ...b });
  } catch {
    /* swallow */
  }
}

export function publicSentryDsn(): string {
  return String(process.env.SENTRY_DSN_PUBLIC || "").trim();
}

/* CSSOS_WAVE82 20260508 — Jing — server error log forwarder.
 *
 * Single fire-and-forget INSERT into server_error_log + a Sentry
 * breadcrumb. Caller passes a pg client factory (typed as a thunk
 * returning a Promise) to avoid pulling pg into observability.ts.
 * If the table is missing or DB is down, we swallow silently — the
 * Express request must never fail because the logger failed.
 */
export type ServerErrorLevel = "error" | "warn" | "fatal";
export type ServerErrorSource = "pipeline" | "auth" | "payment" | "engine" | "http" | "other";

export interface LogServerErrorCtx {
  user_id?: string | null;
  request_path?: string | null;
}

type DbExec = (sql: string, params: unknown[]) => Promise<unknown>;
let _dbExec: DbExec | null = null;
export function registerServerErrorSink(exec: DbExec) {
  _dbExec = exec;
}

export function logServerError(
  level: ServerErrorLevel,
  source: ServerErrorSource,
  err: unknown,
  ctx: LogServerErrorCtx = {},
): void {
  const message = String((err as Error)?.message || err || "").slice(0, 4000) || "unknown";
  const stack = String((err as Error)?.stack || "").slice(0, 2000) || null;
  try {
    sentryBreadcrumb({
      category: `server-error/${source}`,
      message: `${level}: ${message}`,
      data: { source, level, request_path: ctx.request_path || null },
    });
    const s = _sentry;
    if (s && typeof s.captureException === "function") {
      try { s.captureException(err); } catch { /* swallow */ }
    }
  } catch { /* swallow */ }
  const exec = _dbExec;
  if (!exec) return;
  // Fire-and-forget; do NOT await.
  void Promise.resolve()
    .then(() =>
      exec(
        `INSERT INTO server_error_log (level, source, message, stack_snippet, user_id, request_path)
         VALUES ($1, $2, $3, $4, $5::uuid, $6)`,
        [
          level,
          source,
          message,
          stack,
          ctx.user_id || null,
          (ctx.request_path || null) && String(ctx.request_path).slice(0, 400),
        ],
      ),
    )
    .catch(() => { /* table missing on fresh deploy — degrade silently */ });
}
