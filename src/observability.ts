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
