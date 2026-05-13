/* CSSOS_WAVE_117_IOS_STATUSBAR 20260513 — Jing
 * "手机移动端，希望系统时间栏在媒体播放时隐藏，让媒体充满整个屏幕"
 *
 * Hides the iOS native status bar (the row with time / LTE / battery)
 * whenever the watch panel enters cinema mode, and brings it back on
 * exit. Uses the Capacitor StatusBar plugin when available (iOS native);
 * in pure web mode this is a no-op. Web fullscreen video already gets
 * the equivalent effect via the Fullscreen API.
 *
 * Also forces `<meta viewport content="...,viewport-fit=cover">` so the
 * webview is allowed to draw under the notch / home indicator. Without
 * that, even hiding the status bar leaves a black bar.
 */
(function () {
  "use strict";
  if (globalThis.__cssosCinemaStatusbarWired) return;
  globalThis.__cssosCinemaStatusbarWired = true;

  // 1. Force viewport-fit=cover so webview can draw under the notch.
  try {
    let mv = document.querySelector('meta[name="viewport"]');
    if (!mv) {
      mv = document.createElement("meta");
      mv.setAttribute("name", "viewport");
      document.head.appendChild(mv);
    }
    const cur = String(mv.getAttribute("content") || "");
    if (!/viewport-fit=cover/i.test(cur)) {
      mv.setAttribute(
        "content",
        cur ? cur.replace(/\s*$/, "") + ", viewport-fit=cover" : "width=device-width, initial-scale=1, viewport-fit=cover",
      );
    }
  } catch (_) {}

  function getStatusBar() {
    try {
      const cap = globalThis.Capacitor;
      if (!cap) return null;
      if (typeof cap.isNativePlatform === "function" && !cap.isNativePlatform()) return null;
      // Capacitor v6: plugin is at Capacitor.Plugins.StatusBar
      return (cap.Plugins && cap.Plugins.StatusBar) || null;
    } catch (_) { return null; }
  }

  let lastState = null; // "hidden" | "visible"
  function applyState(wantHidden) {
    const state = wantHidden ? "hidden" : "visible";
    if (state === lastState) return;
    lastState = state;
    const sb = getStatusBar();
    if (!sb) return;
    try {
      if (wantHidden) {
        sb.hide?.({ animation: "FADE" });
        sb.setOverlaysWebView?.({ overlay: true });
      } else {
        sb.show?.({ animation: "FADE" });
        sb.setOverlaysWebView?.({ overlay: false });
      }
    } catch (_) {}
  }

  // CSSOS_WAVE_117_HIDE_STATUSBAR_GLOBAL 20260513 — Jing: "启动 app 就
  // 隐藏系统时间栏，不然和面板的三按钮打架". On iOS native, ALWAYS keep
  // the status bar hidden — every cssOS surface is treated as immersive.
  // The status bar overlays the panel chrome (top-right minimize / close
  // buttons) and steals tap targets. On web/Android we leave it alone.
  function start() {
    const sb = getStatusBar();
    if (sb) {
      // Native iOS: hide on launch, keep hidden for the whole session.
      applyState(true);
      // Re-apply after orientation flip or backgrounding-return (some
      // iOS versions reset the bar to visible after coming back from
      // a system sheet / Apple Sign-In modal).
      const reapply = () => { lastState = null; applyState(true); };
      window.addEventListener("orientationchange", reapply);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) reapply();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
