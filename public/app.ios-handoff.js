/* CSSOS_WAVE_107_IOS_HANDOFF 20260509 — Jing
 *
 * Capacitor `appUrlOpen` listener — completes iOS-native OAuth.
 *
 * Flow recap (see docs/WAVE_107_IOS_NATIVE_OAUTH_HANDOFF.md):
 *   1. User taps Google in the iOS app → SFSafariViewController loads
 *      the OAuth URL (with intent=ios-app appended client-side, captured
 *      server-side at start time).
 *   2. After provider auth, the server callback issues a one-shot
 *      handoff token and 302's to https://cssstudio.app/auth/return?
 *      handoff=<token>&intent=ios-app. iOS Universal Link claims it
 *      and routes to the installed app instead of opening Safari.
 *   3. Capacitor fires `appUrlOpen` with the full URL.
 *   4. We POST the handoff to /api/auth/handoff/exchange from inside
 *      the WebView's cookie jar — backend setAuthSession's response
 *      Set-Cookie lands on this WKWebView.
 *   5. location.reload() → user is now signed in.
 *
 * Replay-safe: the token is single-use server-side. Errors fall through
 * to a localized toast.
 */
(function () {
  "use strict";

  function tr(en, zh) {
    try {
      const locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.locale) || "";
      if (String(locale).toLowerCase().startsWith("zh")) return zh;
    } catch (_) {}
    return en;
  }

  function showToastSafe(msg) {
    try {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(msg);
        return;
      }
    } catch (_) {}
    try { console.warn("[ios-handoff]", msg); } catch (_) {}
  }

  function isIosNative() {
    try {
      const cap = globalThis.Capacitor;
      if (!cap) return false;
      const isNative =
        typeof cap.isNativePlatform === "function"
          ? cap.isNativePlatform()
          : Boolean(cap.isNative);
      const platform =
        typeof cap.getPlatform === "function" ? cap.getPlatform() : "";
      return Boolean(isNative) && platform === "ios";
    } catch (_) {
      return false;
    }
  }

  function parseHandoffFromUrl(url) {
    try {
      const u = new URL(String(url));
      // Accept /auth/return on either cssstudio.app or any host the
      // app might be configured against in dev. Path is the signal.
      if (!u.pathname || !u.pathname.startsWith("/auth/return")) return null;
      const tok = u.searchParams.get("handoff");
      if (!tok) return null;
      return tok.trim();
    } catch (_) {
      return null;
    }
  }

  async function exchangeAndReload(handoff) {
    try {
      const r = await fetch("/api/auth/handoff/exchange", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handoff: handoff }),
      });
      const j = await r.json().catch(function () { return null; });
      if (!r.ok || !j || j.ok !== true) {
        const detail = (j && (j.error || j.code)) || ("http_" + r.status);
        console.warn("[ios-handoff] exchange rejected", { status: r.status, body: j });
        showToastSafe(tr(
          "Sign-in handoff failed: " + detail,
          "登录交接失败：" + detail,
        ));
        return false;
      }
      // Hard reload so every cached panel sees the new session.
      try {
        window.location.replace("/");
      } catch (_) {
        window.location.href = "/";
      }
      return true;
    } catch (err) {
      console.warn("[ios-handoff] exchange error", err);
      showToastSafe(tr(
        "Sign-in handoff network error.",
        "登录交接网络错误。",
      ));
      return false;
    }
  }

  function bind() {
    if (!isIosNative()) return;
    try {
      const cap = globalThis.Capacitor;
      const App = cap && cap.Plugins && cap.Plugins.App;
      if (!App || typeof App.addListener !== "function") {
        // @capacitor/app plugin not bridged. Most likely cap sync wasn't run.
        console.warn("[ios-handoff] @capacitor/app missing — run `npx cap sync ios`");
        return;
      }
      App.addListener("appUrlOpen", function (data) {
        try {
          const url = data && data.url;
          const handoff = parseHandoffFromUrl(url);
          if (!handoff) return; // Not a handoff link; ignore.
          void exchangeAndReload(handoff);
        } catch (err) {
          console.warn("[ios-handoff] appUrlOpen handler failed", err);
        }
      });

      // Cold-start case: the app may have been launched BY the
      // Universal Link itself. Capacitor exposes the launch URL via
      // App.getLaunchUrl().
      try {
        if (typeof App.getLaunchUrl === "function") {
          App.getLaunchUrl().then(function (res) {
            try {
              const handoff = parseHandoffFromUrl(res && res.url);
              if (handoff) void exchangeAndReload(handoff);
            } catch (_) {}
          }).catch(function () {});
        }
      } catch (_) {}
    } catch (err) {
      console.warn("[ios-handoff] bind failed", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
