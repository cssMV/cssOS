/* CSSOS_WAVE_220A 20260517 — Jing: central Guided-Action error router.
 *
 * Pairs with app.guided-action-dialog.js. Instead of peppering 50+ call
 * sites with "if error X, open panel Y", we patch globalThis.fetch ONCE
 * and inspect every response. Known error shapes get routed to the
 * appropriate guided dialog with a 10s auto-navigation countdown.
 *
 * Routed signals (in priority order, only the FIRST match fires):
 *
 *   (a) HTTP 401 — anywhere except auth endpoints themselves.
 *       → "Session expired" dialog → opens Login panel
 *
 *   (b) HTTP 402 / 403 with `error: "tier_required"` OR
 *       `code: "UPGRADE_REQUIRED"` OR text matches "membership tier".
 *       → "Upgrade required" dialog → opens Subscription panel
 *
 *   (c) /api/i18n/translate non-2xx response.
 *       → "Translation service hiccup" → opens Language panel
 *
 * Site-specific signals that don't fit the global pattern:
 *   - insufficient_balance: handled at MV PIPELINE (W218/W220A) where
 *     we have the stage context. Router avoids double-firing by
 *     checking `error === "insufficient_balance"` and bailing.
 *   - generation timeout: exposed as `cssmvShowGenerationTimeout()` so
 *     pipeline timeout handlers call it explicitly with retry context.
 *
 * De-dup: at most ONE guided dialog at a time (cssmvShowGuidedAction
 * already enforces this), and we throttle 401 routing to once per 15s
 * to avoid a thundering herd of dialogs when many parallel requests
 * race after a session lapse.
 */
(function () {
  if (globalThis.cssmvGuidedErrorRouter) return;

  // ─── Helpers ──────────────────────────────────────────────────────
  function tr(en, _zh) {
    if (typeof globalThis.tr === "function") return globalThis.tr(en);
    if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en);
    return en;
  }
  function showGuided(opts) {
    if (typeof globalThis.cssmvShowGuidedAction !== "function") return false;
    globalThis.cssmvShowGuidedAction(opts);
    return true;
  }

  // Last-fired timestamps for dedup throttling.
  const lastFired = { auth: 0, tier: 0, i18n: 0 };
  function throttleOk(key, ms) {
    const now = Date.now();
    if (now - lastFired[key] < ms) return false;
    lastFired[key] = now;
    return true;
  }

  // ─── Panel openers (graceful fallback if module unavailable) ──────
  function openLoginPanel() {
    try {
      if (typeof globalThis.openLoginPanel === "function" && globalThis.openLoginPanel !== openLoginPanel) {
        return globalThis.openLoginPanel();
      }
      if (typeof globalThis.openPanelModule === "function") {
        return globalThis.openPanelModule("login-panel");
      }
      if (typeof globalThis.openPanel === "function" && globalThis.loginPanel) {
        return globalThis.openPanel(globalThis.loginPanel);
      }
    } catch (e) { console.warn("[guided-router] openLogin threw:", e); }
  }
  function openSubscriptionPanel() {
    try {
      if (typeof globalThis.openSubscriptionPanelModule === "function") {
        return globalThis.openSubscriptionPanelModule();
      }
      if (typeof globalThis.openPanel === "function" && globalThis.subscriptionPanel) {
        return globalThis.openPanel(globalThis.subscriptionPanel);
      }
    } catch (e) { console.warn("[guided-router] openSubscription threw:", e); }
  }
  function openLanguagePanel() {
    try {
      if (typeof globalThis.openPanel === "function" && globalThis.languagePanel) {
        return globalThis.openPanel(globalThis.languagePanel);
      }
      if (typeof globalThis.openPanelModule === "function") {
        return globalThis.openPanelModule("language-panel");
      }
    } catch (e) { console.warn("[guided-router] openLanguage threw:", e); }
  }
  function openBugReport() {
    try {
      if (typeof globalThis.cssosOpenBugReport === "function") {
        return globalThis.cssosOpenBugReport();
      }
    } catch (e) { console.warn("[guided-router] openBug threw:", e); }
  }

  // ─── Routing classifiers ──────────────────────────────────────────
  // Bail on auth endpoints — 401 from /api/login/* means "wrong password",
  // not "session expired", and the login UI handles it locally.
  function isAuthEndpoint(url) {
    return /\/api\/(login|logout|signup|auth|session)/i.test(String(url || ""));
  }
  function isI18nEndpoint(url) {
    return /\/api\/i18n\//i.test(String(url || ""));
  }
  // Known "you need to upgrade" shapes across the backend.
  function looksLikeTierRequired(json, status) {
    if (!json) return false;
    const err  = String(json.error || "").toLowerCase();
    const code = String(json.code || "").toLowerCase();
    const msg  = String(json.message || json.hint || "").toLowerCase();
    if (err  === "tier_required" || err === "tier_quota_exceeded") return true;
    if (code === "upgrade_required" || code === "premium_required" || code === "tier_required") return true;
    if (/membership.*tier|higher.*tier|upgrade.*subscription|tier.*upgrade/.test(msg)) return true;
    if (status === 402 && /upgrade/.test(msg)) return true;
    return false;
  }
  // Insufficient balance is handled at site (W218) — do not double-fire.
  function looksLikeInsufficientBalance(json) {
    return !!(json && json.error === "insufficient_balance");
  }

  // ─── Routers ──────────────────────────────────────────────────────
  function fireAuthExpired() {
    if (!throttleOk("auth", 15000)) return;
    showGuided({
      icon: "🔒",
      title: tr("Session expired", "登录已过期"),
      message: tr(
        "Your sign-in has lapsed. Sign back in to keep working — opening the Login panel in 10 seconds…",
        "登录已失效，请重新登录。10 秒后自动打开登录面板…",
      ),
      primaryLabel: tr("Sign in", "重新登录"),
      primaryFn: openLoginPanel,
      secondaryLabel: tr("Not now", "稍后"),
      countdownSec: 10,
    });
  }
  function fireTierRequired(json) {
    if (!throttleOk("tier", 8000)) return;
    const hint = String(json?.hint || json?.message || "").slice(0, 240);
    showGuided({
      icon: "⭐",
      title: tr("Upgrade required", "需要升级订阅"),
      message: hint || tr(
        "This action needs a higher subscription tier. Opening Subscription in 10 seconds so you can pick a plan…",
        "此操作需要更高订阅档位。10 秒后自动打开订阅面板…",
      ),
      primaryLabel: tr("See plans", "查看订阅"),
      primaryFn: openSubscriptionPanel,
      secondaryLabel: tr("Not now", "稍后"),
      countdownSec: 10,
    });
  }
  function fireI18nFailure() {
    if (!throttleOk("i18n", 60000)) return;  // 1 min — i18n failures bursty
    showGuided({
      icon: "🌐",
      title: tr("Translation hiccup", "翻译服务异常"),
      message: tr(
        "Our translator stumbled. The UI is showing English for now — you can switch language in 10 seconds…",
        "翻译服务暂时异常，界面先用英文显示。10 秒后自动打开语言面板…",
      ),
      primaryLabel: tr("Change language", "选择语言"),
      primaryFn: openLanguagePanel,
      secondaryLabel: tr("Stay in English", "保持英文"),
      countdownSec: 10,
    });
  }

  // ─── Public: explicit generation-timeout entry ────────────────────
  // Called by pipeline timeout handlers because the router can't see
  // a "timeout" — there's no HTTP response at all when the abort fires.
  globalThis.cssmvShowGenerationTimeout = function (opts) {
    const o = opts || {};
    const stage = String(o.stage || "this stage");
    const retryFn = typeof o.retryFn === "function" ? o.retryFn : null;
    showGuided({
      icon: "⏱️",
      title: tr("Generation timed out", "生成超时"),
      message: tr(
        `The ${stage} stage didn't respond in time. We'll retry automatically in 10 seconds — or you can cancel and report the issue.`,
        `${stage} 阶段超时未响应。10 秒后自动重试，也可以稍后再试或上报问题。`,
      ),
      primaryLabel: retryFn ? tr("Retry now", "立即重试") : tr("OK", "知道了"),
      primaryFn: retryFn || function () {},
      secondaryLabel: tr("Report instead", "上报问题"),
      secondaryFn: openBugReport,
      countdownSec: 10,
    });
  };

  // ─── Patch fetch ──────────────────────────────────────────────────
  const origFetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : null;
  if (!origFetch) {
    console.warn("[guided-router] no globalThis.fetch — router disabled");
    return;
  }
  globalThis.fetch = function (...args) {
    const reqUrl = (() => {
      try {
        const r = args[0];
        if (typeof r === "string") return r;
        if (r && r.url) return r.url;
        return "";
      } catch (_) { return ""; }
    })();

    const p = origFetch(...args);
    // Use .then to inspect — never alter the response chain seen by
    // the original caller. Errors in inspection must NOT propagate.
    p.then(async function (res) {
      try {
        if (!res || res.ok) return;
        const status = res.status;

        // Fast classifiers first (no body read).
        if (status === 401 && !isAuthEndpoint(reqUrl)) {
          fireAuthExpired();
          return;
        }

        // Body-inspection classifiers — only for likely matches.
        if (status === 402 || status === 403 || status === 400) {
          // Clone before body read so the original caller still owns
          // the unread stream.
          let json = null;
          try { json = await res.clone().json(); } catch (_) { json = null; }
          if (looksLikeInsufficientBalance(json)) return; // site-handled
          if (looksLikeTierRequired(json, status)) {
            fireTierRequired(json);
            return;
          }
        }

        // i18n failure (W210).
        if (isI18nEndpoint(reqUrl) && status >= 500) {
          fireI18nFailure();
          return;
        }
      } catch (_e) {
        // Inspection must never break the caller's promise chain.
      }
    }).catch(function () { /* swallow — the original caller handles */ });
    return p;
  };

  globalThis.cssmvGuidedErrorRouter = {
    fireAuthExpired,
    fireTierRequired,
    fireI18nFailure,
    openLoginPanel,
    openSubscriptionPanel,
    openLanguagePanel,
    openBugReport,
  };

  console.log("[guided-router] W220.A armed — auth / tier / i18n routed centrally.");
})();
