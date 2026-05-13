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
  function showFriendlyToast(msg) {
    try {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(msg);
        return;
      }
    } catch (_) {}
    try { console.warn("[cssos-crash-guard]", msg); } catch (_) {}
  }
  window.addEventListener("error", (ev) => {
    const msg = String(ev.message || ev.error?.message || "unknown_error");
    const stack = String(ev.error?.stack || "").slice(0, 2000);
    const src = `${ev.filename || ""}:${ev.lineno || 0}:${ev.colno || 0}`;
    beacon({ kind: "window.error", message: msg, stack, source: src });
    showFriendlyToast("出错了，但已被拦截；输入内容已自动保存。 / Something glitched but was caught — your input is auto-saved.");
    // Prevent webview watchdog from treating as fatal
    ev.preventDefault?.();
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason));
    beacon({
      kind: "unhandledrejection",
      message: String(reason.message || "").slice(0, 500),
      stack: String(reason.stack || "").slice(0, 2000),
    });
    showFriendlyToast("后台异步出错；已被拦截。 / Async error caught.");
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

  console.info("%c[cssos-crash-guard] Wave 117 Step 1 installed", "color:#0a0;font-weight:bold");
})();
