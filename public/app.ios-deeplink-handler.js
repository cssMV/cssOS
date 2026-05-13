/* CSSOS_WAVE_123 20260513 — Jing
 *
 * iOS native deep-link handler for OAuth return.
 *
 * Flow:
 *   1. User taps "Sign in with Google/X/GitHub/…" in the app
 *   2. app.login-panel.js opens platform.url via Capacitor.Plugins.Browser
 *      (SFSafariViewController; shared with system Safari cookies)
 *   3. OAuth completes on the web, server redirects to
 *      https://cssstudio.app/auth/return?...
 *   4. /auth/return is an Associated Domain (Universal Link → AASA),
 *      so iOS hands the URL straight to the installed app
 *   5. This handler catches the appUrlOpen event, closes the
 *      SFSafariViewController overlay, then loads the return URL
 *      inside the app's main webview so the existing /auth/return
 *      JS picks up where it left off (session cookie is now set
 *      because Browser plugin shares cookies).
 *
 * No-op on web/Android/macOS Safari.
 */
(function () {
  if (globalThis.__cssosIosDeeplinkWired) return;
  globalThis.__cssosIosDeeplinkWired = true;

  function isIosNative() {
    try {
      var cap = globalThis.Capacitor;
      if (!cap) return false;
      if (typeof cap.isNativePlatform === "function" && !cap.isNativePlatform()) return false;
      var p = typeof cap.getPlatform === "function" ? cap.getPlatform() : "";
      return String(p).toLowerCase() === "ios";
    } catch (_) { return false; }
  }

  if (!isIosNative()) return;

  function getApp() {
    try {
      var cap = globalThis.Capacitor;
      return (cap && cap.Plugins && cap.Plugins.App) || null;
    } catch (_) { return null; }
  }
  function getBrowser() {
    try {
      var cap = globalThis.Capacitor;
      return (cap && cap.Plugins && cap.Plugins.Browser) || null;
    } catch (_) { return null; }
  }

  function wire() {
    var App = getApp();
    if (!App || typeof App.addListener !== "function") {
      // Plugins not ready yet — retry shortly.
      setTimeout(wire, 250);
      return;
    }
    App.addListener("appUrlOpen", function (event) {
      var url = String(event && event.url || "");
      if (!url) return;
      console.log("[ios-deeplink] appUrlOpen:", url);
      // Close any open SFSafariViewController overlay so the user is
      // back in the app webview, then navigate the webview to the
      // return path so the existing /auth/return JS / redirect can run.
      var Browser = getBrowser();
      if (Browser && typeof Browser.close === "function") {
        try { Browser.close(); } catch (_) {}
      }
      try {
        // Strip scheme+host; we always want to land on a relative path
        // inside the app's own webview (cssstudio.app is loaded as the
        // server.url root).
        var u = new URL(url);
        var rel = u.pathname + u.search + u.hash;
        // Don't double-navigate if already on the path.
        if (window.location.pathname + window.location.search === rel) return;
        window.location.href = rel || "/";
      } catch (err) {
        console.warn("[ios-deeplink] URL parse failed; redirecting raw", err);
        window.location.href = url;
      }
    });
    console.log("[ios-deeplink] appUrlOpen listener wired");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
