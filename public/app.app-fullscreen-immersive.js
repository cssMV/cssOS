/* CSSOS_WAVE_192 20260516 — Jing
 *
 * "一旦启动 app 进入主界面开始，顶部时间栏就隐藏，
 *  底部的白色滑动条，只能无操作 2 秒自动隐藏。"
 *
 * iOS Safari (and Android Chrome) only allows the top status bar /
 * URL chrome / bottom home-indicator pill to be hidden via the
 * Fullscreen API, and that API requires a user gesture. So this
 * module:
 *
 *   1. Waits for the FIRST user touch / click / keydown after boot.
 *   2. Requests document.documentElement.requestFullscreen() (with
 *      webkit prefix on older iOS).
 *   3. iOS then auto-hides the time bar AND auto-hides the home
 *      indicator after ~2-3 s of no interaction — the OS itself
 *      handles the "无操作自动隐藏" behavior once we're fullscreen.
 *
 * Scoped to TOUCH devices only (pointer: coarse) — auto-fullscreen
 * on desktop browsers feels invasive and the time bar isn't a
 * problem there anyway.
 *
 * Skips in standalone PWA mode (window.matchMedia('(display-mode:
 * standalone)')) since the app is already chrome-less in that mode.
 *
 * Idempotent: runs once per page load via a sentinel flag.
 */
(function () {
  "use strict";
  if (globalThis.__cssosAppFullscreenWired) return;
  globalThis.__cssosAppFullscreenWired = true;

  function shouldAttempt() {
    try {
      if (typeof window === "undefined" || typeof document === "undefined") return false;
      if (typeof window.matchMedia !== "function") return false;
      // Only touch devices.
      if (!window.matchMedia("(pointer: coarse)").matches) return false;
      // Already chrome-less in PWA / standalone mode.
      if (window.matchMedia("(display-mode: standalone)").matches) return false;
      if (typeof navigator !== "undefined" && navigator.standalone === true) return false;
      return true;
    } catch (_) { return false; }
  }

  if (!shouldAttempt()) return;

  let fired = false;
  function enterFullscreen() {
    if (fired) return;
    fired = true;
    try {
      const el = document.documentElement;
      const fn = el.requestFullscreen
        || el.webkitRequestFullscreen
        || el.webkitRequestFullScreen
        || el.mozRequestFullScreen
        || el.msRequestFullscreen;
      if (!fn) return; // unsupported — quietly bail
      const p = fn.call(el);
      if (p && typeof p.catch === "function") {
        p.catch(function () { /* user denied or browser blocked — silent */ });
      }
    } catch (_) { /* never let this break the app */ }
  }

  function arm() {
    // Listen for any of: first touch, first pointerdown, first click,
    // first keydown. Once any fires, request fullscreen and detach.
    const events = ["touchstart", "pointerdown", "click", "keydown"];
    const handler = function () {
      events.forEach(function (ev) {
        try { document.removeEventListener(ev, handler, { capture: true }); } catch (_) {}
      });
      enterFullscreen();
    };
    events.forEach(function (ev) {
      try {
        document.addEventListener(ev, handler, { capture: true, passive: true, once: true });
      } catch (_) {
        try { document.addEventListener(ev, handler, true); } catch (__) {}
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arm, { once: true });
  } else {
    arm();
  }
})();
