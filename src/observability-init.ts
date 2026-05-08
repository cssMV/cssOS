/* CSSOS_WAVE94 20260508 — Jing — side-effect Sentry bootstrap.
 *
 * @sentry/node monkey-patches express on init. That patching only
 * works if Sentry.init() runs BEFORE `import express`. Importing
 * this module at the very top of src/index.ts (above the express
 * import) guarantees that ordering — running the init synchronously
 * at module-load time. No-op when SENTRY_DSN is unset.
 */
import { initSentry } from "./observability";

const _s = initSentry();
if (_s) {
  const release = String(process.env.SENTRY_RELEASE || process.env.GIT_SHA || "unknown");
  // eslint-disable-next-line no-console
  console.log(`[Sentry] initialized release=${release}`);
}
