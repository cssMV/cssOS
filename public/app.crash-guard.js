/* CSSOS_WAVE_117_CRASH_GUARD 20260512 — Jing
 * "手机移动端，随便点击一个图标，一个按钮，都会导致系统刷新，
 *  从而使已经输入的数据付之东流"
 *
 * Four protections, in load order (this file must be the FIRST script
 * in <head> so it catches errors thrown by everything that loads after):
 *
 *   1. Auto-persist <input>/<textarea> values to sessionStorage so
 *      that if a refresh DOES happen (intentional or not), the user's
 *      typed text is restored on the next page load.
 *
 *   2. Trap window.onerror + onunhandledrejection so an uncaught
 *      throw shows a friendly toast and is reported to /api/admin/
 *      crash-log, instead of bubbling up into the Capacitor webview
 *      watchdog (which on iOS native will kill+restart the webview).
 *
 *   3. Instrument location.reload / location.href= / window.location=
 *      with console.trace + beacon to /api/admin/crash-log so we can
 *      see WHICH button is doing accidental reloads. (We don't BLOCK
 *      them — too risky given 33 existing call sites — just log.)
 *
 *   4. beforeunload sentinel: log why a navigation/unload is about to
 *      happen, with the most recent click target. Sends via
 *      navigator.sendBeacon so it survives the unload.
 *
 * Zero deps. Inlined into index.html could shave one round-trip later.
 */
(function () {
  "use strict";
  if (globalThis.__cssosCrashGuardInstalled) return;
  globalThis.__cssosCrashGuardInstalled = true;

  // ─────────────────────────────────────────────────────────────────
  // 1 · Form input persistence (sessionStorage)
  // ─────────────────────────────────────────────────────────────────
  const FORM_KEY_PREFIX = "cssos.formstate.v1.";
  const formDebounce = new Map(); // id → timeout handle
  function fieldKey(el) {
    const id = el.id || el.name || el.getAttribute("data-cssmv-field") || "";
    if (!id) return null;
    return FORM_KEY_PREFIX + id;
  }
  function persistField(el) {
    const k = fieldKey(el);
    if (!k) return;
    try {
      const v = String(el.value || "");
      if (v.length > 0) sessionStorage.setItem(k, v);
      else sessionStorage.removeItem(k);
    } catch (_) {}
  }
  function restoreField(el) {
    const k = fieldKey(el);
    if (!k) return;
    try {
      const v = sessionStorage.getItem(k);
      if (v != null && !el.value && el.dataset.cssmvNoRestore !== "1") {
        el.value = v;
        // fire input so listeners (creationState sync etc.) pick it up
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (_) {}
  }
  function wireField(el) {
    if (!el || el.dataset.cgWired === "1") return;
    if (el.type === "password" || el.type === "hidden") return;
    if (el.dataset.cssmvNoPersist === "1") return;
    el.dataset.cgWired = "1";
    restoreField(el);
    el.addEventListener("input", () => {
      const k = fieldKey(el);
      if (!k) return;
      clearTimeout(formDebounce.get(k));
      formDebounce.set(k, setTimeout(() => persistField(el), 220));
    });
  }
  function scanForms(root) {
    (root || document).querySelectorAll("input, textarea").forEach(wireField);
  }
  // Initial scan + MutationObserver for dynamically added inputs
  function startFormPersist() {
    scanForms(document);
    try {
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.matches?.("input,textarea")) wireField(n);
            n.querySelectorAll?.("input,textarea").forEach(wireField);
          }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }
  // Public clear (call after successful submit)
  globalThis.cssosClearFormPersistence = function (id) {
    if (id) {
      try { sessionStorage.removeItem(FORM_KEY_PREFIX + id); } catch (_) {}
      return;
    }
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(FORM_KEY_PREFIX)) sessionStorage.removeItem(k);
      }
    } catch (_) {}
  };

  // ─────────────────────────────────────────────────────────────────
  // 2 · Uncaught error + promise rejection trap
  // ─────────────────────────────────────────────────────────────────
  function beacon(payload) {
    try {
      const body = JSON.stringify({
        ts: Date.now(),
        url: String(location.href || ""),
        ua: String(navigator.userAgent || "").slice(0, 240),
        ...payload,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/admin/crash-log",
          new Blob([body], { type: "application/json" }),
        );
        return;
      }
      fetch("/api/admin/crash-log", {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {});
    } catch (_) {}
  }
  // CSSOS_WAVE_208 20260516 — Jing: 关掉对普通用户的"后台异步出错"
  // toast — 它没行动价值, 反而吓人("以为哪里出错了, 用不了了"). 只
  // 给 admin / @cssstudio.app 显示, 其他人完全静默. Beacon 和
  // preventDefault 都保留不变, 所以服务端 journalctl 依然记录每一次
  // 异常, 系统看门狗依然被骗过去不会强刷.
  /* CSSOS_WAVE_233 20260519 — Jing: Apple 审核员用的就是 vip@cssstudio.app,
   * 之前 VIP 在管理员名单 + 域名通配, 看见了所有 admin-only 调试 UI.
   * 收紧: 只有真正的 admin 邮箱有调试权限, 不再放宽域名通配. VIP 是
   * 付费等级测试账号, 不应有调试视图. */
  const ADMIN_EMAIL_DOMAINS = [];
  const ADMIN_EMAIL_EXACT = new Set([
    "admin@cssstudio.app",
    "jingdudc@gmail.com",
    "jing@cssstudio.app",
  ]);
  function viewerIsAdminCrashGuard() {
    try {
      const email = String(globalThis.authState?.user?.email || "").trim().toLowerCase();
      if (!email) return false;
      if (ADMIN_EMAIL_EXACT.has(email)) return true;
      for (const dom of ADMIN_EMAIL_DOMAINS) {
        if (email.endsWith("@" + dom)) return true;
      }
      if (typeof globalThis.isAdminEmailModule === "function") {
        return !!globalThis.isAdminEmailModule(email);
      }
    } catch (_) {}
    return false;
  }
  function showFriendlyToast(msg) {
    // Non-admin users see nothing — silent swallow. Avoids the
    // "is the app broken? am I locked out?" panic when the underlying
    // glitch is something cosmetic / cacheable / already-handled.
    if (!viewerIsAdminCrashGuard()) {
      try { console.warn("[cssos-crash-guard][silent]", msg); } catch (_) {}
      return;
    }
    try {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(msg);
        return;
      }
    } catch (_) {}
    try { console.warn("[cssos-crash-guard]", msg); } catch (_) {}
  }
  // CSSOS_WAVE_184 20260516 — localStorage quota recovery.
  // Jing's session was hitting QuotaExceededError on Safari (localStorage
  // capped at ~5 MB per origin), which cascaded into "auth state not
  // restored / panels won't open" because every helper that tried
  // setItem failed mid-init. When we see a QuotaExceededError, sweep
  // the OLDEST cssos.* keys (preserving the auth + session sentinels)
  // and retry the offending write once.
  const STORAGE_KEEP = new Set([
    "cssos.agent.session_id",
    "cssos.locale",
    "CSSOS_LANG",
    "cssos.theme",
  ]);
  // CSSOS_WAVE_184 — proactive startup check. Probe localStorage with
  // a tiny write; if it throws Quota, prune BEFORE any other module
  // boots so panels load cleanly. Safari's 5 MB cap is the common
  // tripwire here.
  try {
    const probeKey = "__cssos_storage_probe__";
    localStorage.setItem(probeKey, "1");
    localStorage.removeItem(probeKey);
  } catch (probeErr) {
    if (/Quota|quota/i.test(String(probeErr?.name || probeErr?.message || ""))) {
      try { console.warn("[cssos-crash-guard] localStorage near full on boot — pruning"); } catch (_) {}
      // Pruning helper isn't defined yet at this hoisted point in IIFE
      // execution; safe to delegate to a quick inline sweep that mirrors
      // pruneCssosStorage. We can't share the function until after it's
      // declared below, so duplicate the body once for the boot probe.
      try {
        const entries = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith("cssos.")) continue;
          if (k === "cssos.agent.session_id" || k === "cssos.locale" || k === "cssos.theme") continue;
          const v = localStorage.getItem(k) || "";
          entries.push({ k, size: v.length });
        }
        entries.sort((a, b) => b.size - a.size);
        for (const e of entries.slice(0, 25)) {
          try { localStorage.removeItem(e.k); } catch (_) {}
        }
      } catch (_) {}
    }
  }

  function pruneCssosStorage() {
    try {
      const entries = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("cssos.") || STORAGE_KEEP.has(k)) continue;
        const v = localStorage.getItem(k) || "";
        entries.push({ k, size: v.length });
      }
      // Drop the BIGGEST 25 first — biggest blobs free the most space.
      entries.sort((a, b) => b.size - a.size);
      let dropped = 0;
      for (const e of entries.slice(0, 25)) {
        try { localStorage.removeItem(e.k); dropped += e.size; } catch (_) {}
      }
      console.warn("[cssos-crash-guard] localStorage pruned, freed ~" + dropped + " bytes");
      return dropped > 0;
    } catch (_) { return false; }
  }

  // CSSOS_WAVE_199 20260516 — monkey-patch localStorage.setItem so EVERY
  // write self-heals on QuotaExceeded. The W184 startup probe + window
  // .error fallback only catch SOME setItem throws; many callers wrap
  // their setItem in try/catch that swallows the QuotaExceeded and
  // silently leaves a stale value behind, so the auth / panel state
  // never restores. This wrapper runs the same prune-and-retry
  // recovery used elsewhere and ALWAYS returns void instead of
  // throwing, so callers never see the error.
  try {
    const proto = (typeof Storage !== "undefined" && Storage.prototype) || null;
    if (proto && typeof proto.setItem === "function" && !proto.__cssosQuotaGuarded) {
      const origSet = proto.setItem;
      proto.setItem = function patched_setItem(key, value) {
        try {
          return origSet.call(this, key, value);
        } catch (err) {
          const name = String((err && (err.name || err.message)) || "");
          if (!/Quota|quota|NS_ERROR_DOM_QUOTA/.test(name)) {
            // Not a quota issue — re-throw so unrelated storage errors
            // (e.g. SecurityError in private mode) surface to callers.
            throw err;
          }
          try { pruneCssosStorage(); } catch (_) {}
          try {
            // Retry once after prune. If it still throws, swallow —
            // we'd rather drop a single cache write than crash the app.
            return origSet.call(this, key, value);
          } catch (_) { /* second-pass quota — give up silently */ }
          // Don't toast for every dropped write (would be noisy on a
          // tight quota). The W184 window.error path still fires its
          // user-facing toast when the underlying throw escapes to
          // window scope (e.g. via async unwrapped paths).
          return undefined;
        }
      };
      Object.defineProperty(proto, "__cssosQuotaGuarded", { value: true, writable: false });
    }
  } catch (_) { /* Storage prototype access blocked — bail */ }

  // CSSOS_WAVE_389 20260524 — Jing: crash-log de-noise. Opaque cross-origin
  // "Script error." (no stack, masked at :0:0 — from 3rd-party/WKWebView-injected
  // scripts we can't de-opaque) carried ZERO actionable detail yet flooded the
  // crash-log (57 in 6h), drowning real signals like the W388 Works crash. Keep
  // a few as evidence, then drop; also dedup any identical signature so one
  // recurring error can't spam the beacon. Sharper signal = better App-stability
  // monitoring (parity with desktop observability).
  let __opaqueSent = 0;
  const __sigCounts = Object.create(null);
  function shouldBeacon(message, stack, filename) {
    const opaque = !stack && !filename &&
      (message === "Script error." || message === "Script error");
    if (opaque) { __opaqueSent += 1; return __opaqueSent <= 3; }
    const sig = String(message).slice(0, 120) + "|" + String(stack).slice(0, 160);
    const n = (__sigCounts[sig] = (__sigCounts[sig] || 0) + 1);
    return n <= 3 || n % 25 === 0; // first 3, then 1-in-25, per signature
  }

  window.addEventListener("error", (ev) => {
    const msg = String(ev.message || ev.error?.message || "unknown_error");
    const stack = String(ev.error?.stack || "").slice(0, 2000);
    const src = `${ev.filename || ""}:${ev.lineno || 0}:${ev.colno || 0}`;
    if (shouldBeacon(msg, stack, ev.filename)) {
      beacon({ kind: "window.error", message: msg, stack, source: src });
    }
    // CSSOS_WAVE_184 — auto-recover from localStorage quota errors.
    if (/QuotaExceededError|quota.*exceeded|exceeded.*quota|NS_ERROR_DOM_QUOTA/i.test(msg)) {
      const freed = pruneCssosStorage();
      if (freed) {
        showFriendlyToast(
          "本地缓存满了，已自动清理一部分。请刷新一下。 / Local cache was full — pruned. Please refresh."
        );
        ev.preventDefault?.();
        return;
      }
    }
    /* CSSOS_WAVE_238 20260520 — Jing: 这条 sync-error toast 一律不再
     * 弹给任何人 (含 admin), 会吓到用户. 只 console.warn, beacon 仍记录,
     * preventDefault 仍骗过看门狗. 跟 W221 的 async 处理对齐. */
    try { console.warn("[cssos-crash-guard][silent-sync]", msg); } catch (_e) {}
    // Prevent webview watchdog from treating as fatal
    ev.preventDefault?.();
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason));
    const rMsg = String(reason.message || "").slice(0, 500);
    const rStack = String(reason.stack || "").slice(0, 2000);
    if (shouldBeacon(rMsg, rStack, "rejection")) {
      beacon({ kind: "unhandledrejection", message: rMsg, stack: rStack });
    }
    // CSSOS_WAVE_221 20260517 — Jing: 异步错误的 toast 即使对 admin
     // 也不再弹了, 太频繁、太分散注意力. Beacon + preventDefault 保留,
     // 服务端日志仍有记录, 看门狗仍被骗过. 控制台 console.warn 也保留,
     // 方便 DevTools 排查. 视觉上完全静默.
    try { console.warn("[cssos-crash-guard][silent-async]", String(reason.message || reason)); } catch (_) {}
    ev.preventDefault?.();
  });

  // ─────────────────────────────────────────────────────────────────
  // 3 · Wrap location.reload / location.href / location.assign /
  //     window.location to log the caller
  // ─────────────────────────────────────────────────────────────────
  try {
    const _reload = location.reload.bind(location);
    location.reload = function patched_reload(...args) {
      const stack = new Error("location.reload called").stack || "";
      console.warn("[crash-guard] location.reload from:", stack);
      beacon({ kind: "location.reload", stack: stack.slice(0, 2000) });
      return _reload(...args);
    };
  } catch (_) {}
  try {
    const _assign = location.assign.bind(location);
    location.assign = function patched_assign(url, ...rest) {
      const stack = new Error("location.assign called").stack || "";
      console.warn("[crash-guard] location.assign → " + url + " from:", stack);
      beacon({ kind: "location.assign", target: String(url), stack: stack.slice(0, 2000) });
      return _assign(url, ...rest);
    };
  } catch (_) {}
  // CSSOS_WAVE_519 20260530 — Jing「iPhone 主界面几秒后 navType=navigate 重新加载真凶」:
  // navType=navigate(非 reload)只可能来自 location.replace / href= 赋值。assign/reload 已插桩,
  // 唯独 replace(login-panel / ios-handoff 用的就是它)是盲区。补上 → 下一次真机一加载,
  // 谁在跳 "/" 立刻带堆栈上报 crash-log。轻量, 仅一次包裹, 无 DOM 扫描(区别于已移除的重探针)。
  try {
    const _replace = location.replace.bind(location);
    location.replace = function patched_replace(url, ...rest) {
      const stack = new Error("location.replace called").stack || "";
      console.warn("[crash-guard] location.replace → " + url + " from:", stack);
      beacon({ kind: "location.replace", target: String(url), stack: stack.slice(0, 2000) });
      return _replace(url, ...rest);
    };
  } catch (_) {}

  // ─────────────────────────────────────────────────────────────────
  // 4 · beforeunload sentinel — log why the page is about to die
  // ─────────────────────────────────────────────────────────────────
  let lastClickInfo = null;
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const a = t.closest("a, button, [role=button], [data-msrc-apply], [data-advanced-apply-render]");
    lastClickInfo = {
      tag: (a || t).tagName,
      id: (a || t).id || "",
      cls: ((a || t).className || "").toString().slice(0, 120),
      text: ((a || t).textContent || "").trim().slice(0, 80),
      href: (a && (a.href || a.getAttribute("href"))) || "",
      ts: Date.now(),
    };
  }, true);
  window.addEventListener("beforeunload", () => {
    beacon({
      kind: "beforeunload",
      lastClick: lastClickInfo,
      sinceClickMs: lastClickInfo ? Date.now() - lastClickInfo.ts : null,
    });
  });

  // CSSOS_WAVE_519 — 极轻心跳(纯字符串, 无 DOM 扫描)。稳定页面会留下 alive-5s;
  // 重载循环的页面只会反复 beforeunload 而永远到不了 alive-5s → 一眼判定循环 vs 稳定。
  try {
    setTimeout(function () {
      beacon({ kind: "alive-5s", navType: (function () {
        try {
          var nav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || null;
          return (nav && nav.type) || (performance.navigation && performance.navigation.type) || "?";
        } catch (_) { return "?"; }
      })() });
    }, 5000);
  } catch (_) {}

  // Boot order: form persistence after DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startFormPersist);
  } else {
    startFormPersist();
  }

  // Expose minimal admin surface
  globalThis.cssosCrashGuard = Object.freeze({
    version: "wave-117-step-1",
    clearPersistence: globalThis.cssosClearFormPersistence,
  });

  // CSSOS_WAVE_536 — 静音启动 install 日志(保持控制台干净)。
})();
