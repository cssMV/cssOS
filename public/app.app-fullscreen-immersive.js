/* CSSOS_WAVE_192 20260516 — Jing
 *
 * "一旦启动 app 进入主界面开始，顶部时间栏就隐藏，
 *  底部的白色滑动条，只能无操作 2 秒自动隐藏。"
 *
 * CSSOS_WAVE_193 20260516 refinement — Jing: 把全屏请求收紧到
 * "真正的创作意图" 手势上，不要在随便点 chip / 登录按钮时就把
 * 浏览器壳子掀掉。
 *
 * iOS Safari only allows the top status bar / URL chrome / bottom
 * home-indicator pill to be hidden via the Fullscreen API, and that
 * API requires a user gesture. Earlier draft listened for ANY first
 * pointerdown — which fired fullscreen on incidental taps (chip,
 * dock icon, sign-in button). This version listens ONLY on signals
 * that mean "I'm starting to CREATE":
 *
 *   1. cssos:mic_hold_start         ← user holds the mirror to record
 *   2. cssos:enter-immersive        ← any module can dispatch this to
 *                                      request fullscreen explicitly
 *   3. click on #mvp-run            ← MV Pipeline "Start" button
 *   4. click on [data-cssos-fullscreen-trigger]
 *
 * Once any of these fire, iOS takes over: time bar hides, home
 * indicator dims after ~2 s of no touch and re-appears on next touch.
 *
 * Scoped to TOUCH devices only (pointer: coarse). Skips standalone
 * PWA mode (already chrome-less). Idempotent via __cssosAppFullscreenWired.
 */
(function () {
  "use strict";
  if (globalThis.__cssosAppFullscreenWired) return;
  globalThis.__cssosAppFullscreenWired = true;

  function shouldAttempt() {
    try {
      if (typeof window === "undefined" || typeof document === "undefined") return false;
      if (typeof window.matchMedia !== "function") return false;
      if (!window.matchMedia("(pointer: coarse)").matches) return false;
      if (window.matchMedia("(display-mode: standalone)").matches) return false;
      if (typeof navigator !== "undefined" && navigator.standalone === true) return false;
      // CSSOS_WAVE_314 20260521 — Jing: 在 Capacitor App(html.cssos-app)里【不】用
      // 网页 Fullscreen API 做沉浸. iOS WebKit 全屏会强加一个左上角原生 ✕ + "swipe
      // down to exit" 提示(那个删不掉、点了只退全屏不退影院, 纯误会). App 的状态栏
      // 沉浸由原生层负责(隐藏状态栏), 不该靠网页全屏. 桌面/普通浏览器不受影响.
      if (document.documentElement.classList.contains("cssos-app")) return false;
      return true;
    } catch (_) { return false; }
  }

  if (!shouldAttempt()) return;

  let fired = false;
  function enterFullscreen() {
    if (fired) return;
    // CSSOS_WAVE_438 20260526 — Jing「DevTools 手机模式: requestFullscreen can only be
    // initiated by a user gesture(×3)」: some auto-flow (panel-open / cinema-enter)
    // calls this OUTSIDE a gesture → the browser rejects it AND logs a console error.
    // Gate on transient user-activation: if there's no active gesture, skip silently
    // (don't even call the API → no error). Real taps still pass. Browsers without
    // the userActivation API fall through to the old best-effort path.
    try {
      if (typeof navigator !== "undefined" && navigator.userActivation &&
          navigator.userActivation.isActive === false) {
        return; // no active gesture → do not attempt (avoids the console error)
      }
    } catch (_) {}
    fired = true;
    try {
      const el = document.documentElement;
      const fn = el.requestFullscreen
        || el.webkitRequestFullscreen
        || el.webkitRequestFullScreen
        || el.mozRequestFullScreen
        || el.msRequestFullscreen;
      if (!fn) return;
      const p = fn.call(el);
      if (p && typeof p.catch === "function") {
        p.catch(function () { /* user denied or browser blocked — silent */ });
      }
    } catch (_) { /* never let this break the app */ }
  }

  // Expose the trigger so other modules can call it without dispatching
  // a custom event (e.g. createCreationSurface, Start Pipeline button).
  globalThis.cssosRequestAppFullscreen = enterFullscreen;

  function arm() {
    // 1. The mic-hold creation gesture — fires touchstart→pointerdown
    //    inside the SAME user-gesture window that getUserMedia uses,
    //    so fullscreen + mic permission share one tap.
    try {
      window.addEventListener("cssos:mic_hold_start", enterFullscreen, { passive: true });
    } catch (_) {}

    // 2. Explicit opt-in event any module can dispatch.
    try {
      window.addEventListener("cssos:enter-immersive", enterFullscreen, { passive: true });
    } catch (_) {}

    // 3. Click delegation: Start Pipeline button + any element opted in
    //    via data-cssos-fullscreen-trigger. Capture phase so we run
    //    before the button's own handler — both fire inside the same
    //    user gesture, so requestFullscreen + the click action both
    //    get the activation token.
    document.addEventListener("click", function (ev) {
      if (fired) return;
      const t = ev.target;
      if (!t || !t.closest) return;
      const hit = t.closest("#mvp-run, [data-cssos-fullscreen-trigger]");
      if (hit) enterFullscreen();
    }, { capture: true, passive: true });

    // 4. Pointerdown on the same intent targets — pointerdown beats click
    //    when iOS slow-tap detection holds; keeps fullscreen synchronous
    //    with the user's first contact.
    document.addEventListener("pointerdown", function (ev) {
      if (fired) return;
      const t = ev.target;
      if (!t || !t.closest) return;
      const hit = t.closest("#mvp-run, [data-cssos-fullscreen-trigger]");
      if (hit) enterFullscreen();
    }, { capture: true, passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arm, { once: true });
  } else {
    arm();
  }
})();
