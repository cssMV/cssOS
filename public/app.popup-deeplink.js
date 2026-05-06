/* CSSOS_POPUP_DEEPLINK 20260506 — Jing
 *
 * The paywall overlay (app.preview-cap.js) opens its purchase /
 * subscription / login flows in a popup window via URL params:
 *
 *   /?cssOpen=subscription          — open the subscription panel
 *   /?cssOpen=login                 — open the login panel
 *   /?cssMV=<id>&cssBuy=<kind>      — open the work + flag a buy intent
 *
 * Without a handler the popup just shows the home page and the user
 * is stranded. This module reads the params on load and routes to the
 * right surface, then strips the params so the URL stays clean.
 *
 * Once the user completes their action (subscription paid, work
 * purchased, login successful), they close the popup → the parent
 * window's preview-cap dismisses its overlay and re-fetches the
 * signed media URL. With the new tier/entitlement, fullAccess is
 * granted server-side and playback resumes uncapped.
 */
(function () {
  "use strict";

  function readParams() {
    try {
      var sp = new URLSearchParams(window.location.search);
      return {
        cssOpen: String(sp.get("cssOpen") || "").trim().toLowerCase(),
        cssBuy: String(sp.get("cssBuy") || "").trim().toLowerCase(),
        cssMV: String(sp.get("cssMV") || "").trim(),
      };
    } catch (_e) { return { cssOpen: "", cssBuy: "", cssMV: "" }; }
  }

  function stripParam(name) {
    try {
      var sp = new URLSearchParams(window.location.search);
      sp.delete(name);
      var qs = sp.toString();
      var url = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
      window.history.replaceState({}, "", url);
    } catch (_e) {}
  }

  /* Wait for a panel-open helper to appear, or a dock button, then
   * trigger the action. Polls for up to ~5s with exponential backoff. */
  function tryAction(check, run, deadlineMs) {
    var start = Date.now();
    var step = 80;
    function attempt() {
      try { if (check()) { run(); return; } } catch (_e) {}
      if (Date.now() - start > deadlineMs) return;
      step = Math.min(step * 1.4, 400);
      setTimeout(attempt, step);
    }
    attempt();
  }

  function openSubscription() {
    tryAction(
      function () {
        return typeof globalThis.openSubscriptionPanelModule === "function" ||
               !!document.querySelector('.dock-item[data-action="subscription"]');
      },
      function () {
        if (typeof globalThis.openSubscriptionPanelModule === "function") {
          globalThis.openSubscriptionPanelModule();
        } else {
          var btn = document.querySelector('.dock-item[data-action="subscription"]');
          if (btn) btn.click();
        }
        stripParam("cssOpen");
      },
      5000
    );
  }

  function openLogin() {
    tryAction(
      function () {
        return !!document.querySelector('.dock-item[data-action="login"]') ||
               !!document.getElementById("login-panel");
      },
      function () {
        var btn = document.querySelector('.dock-item[data-action="login"]');
        if (btn) {
          btn.click();
        } else {
          var panel = document.getElementById("login-panel");
          if (panel && typeof globalThis.openPanel === "function") {
            globalThis.openPanel(panel, { userInitiated: true });
          }
        }
        stripParam("cssOpen");
      },
      5000
    );
  }

  function openBuyForWork(workId, kind) {
    // app.market-commerce.js renders purchase CTAs as
    // <button data-market-action="listen|buyout"> in the work card +
    // info overlay. There's no separate "view" action — audio
    // (聆听权) and video (观赏权) both run through the same listen
    // commerce flow. Map "view" → "listen" so user intent matches.
    var actionMap = { listen: "listen", view: "listen", buyout: "buyout" };
    var action = actionMap[kind] || "listen";
    tryAction(
      function () {
        return !!document.querySelector('[data-market-action="' + action + '"]:not([disabled])') ||
               !!document.querySelector("#watch-panel .cssmv-info-btn");
      },
      function () {
        var btn = document.querySelector(
          '[data-market-action="' + action + '"]:not([disabled])'
        );
        if (btn) {
          try { btn.click(); } catch (_e) {}
        } else {
          // Open the info / details surface so user can find purchase
          // controls. The cssmv-info-btn toggles the overlay where the
          // CTAs are rendered.
          var info = document.querySelector("#watch-panel .cssmv-info-btn");
          if (info) {
            try { info.click(); } catch (_e) {}
          }
        }
        stripParam("cssBuy");
      },
      5000
    );
  }

  /* Cross-window auth signal — when this page lands as a popup after
   * OAuth callback OR as the parent receiving the success ping, broadcast
   * via localStorage so any open tab/window dismisses its paywall and
   * re-fetches the work URL with the new session cookie. */
  function broadcastAuthSuccess() {
    try {
      localStorage.setItem("cssos_auth_change", String(Date.now()));
      // Some browsers don't fire the storage event in the writing tab,
      // so dispatch a custom in-tab event too for the parent if we're
      // somehow the same window.
      try {
        window.dispatchEvent(new CustomEvent("cssos:auth-change", {
          detail: { source: "deeplink-broadcast", ts: Date.now() },
        }));
      } catch (_e) {}
    } catch (_e) {}
  }
  function isOnAuthCallbackPath() {
    var p = String(window.location.pathname || "");
    return /^\/auth\/(google|github)\/callback/.test(p) ||
           /^\/api\/auth\/(google|github)\/callback/.test(p);
  }

  /* Listener side — runs in the parent window. When another tab/window
   * writes cssos_auth_change to localStorage, dismiss any open paywall
   * and force the active media element to refetch its URL. */
  function wireAuthListener() {
    window.addEventListener("storage", function (e) {
      if (e.key !== "cssos_auth_change") return;
      handleAuthChanged();
    });
    // Same-window event for popups that postMessage back.
    window.addEventListener("cssos:auth-change", handleAuthChanged);
    window.addEventListener("message", function (e) {
      if (!e || !e.data) return;
      if (e.data === "cssos:auth-change" ||
          (typeof e.data === "object" && e.data.type === "cssos:auth-change")) {
        handleAuthChanged();
      }
    });
  }
  function handleAuthChanged() {
    // Tear down any visible paywall overlay.
    var pw = document.getElementById("cssos-preview-paywall");
    if (pw && pw.parentNode) pw.parentNode.removeChild(pw);
    // Force the active <video> to refetch its URL — server-side will
    // mint a fresh full-access token now that the session is paid /
    // entitled / authed.
    ["watch-video", "watch-audio-preview"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      try { el.dispatchEvent(new Event("cssos:refresh-access")); } catch (_e) {}
      try {
        var t = el.currentTime || 0;
        el.load();
        el.currentTime = t;
        el.play().catch(function () {});
      } catch (_e) {}
    });
  }

  function init() {
    // Broadcast on the OAuth callback page so the original tab learns.
    if (isOnAuthCallbackPath()) {
      broadcastAuthSuccess();
      // Also try to close ourselves if we're a popup — the parent has
      // what it needs.
      try { if (window.opener) setTimeout(function () { window.close(); }, 800); } catch (_e) {}
    }
    wireAuthListener();
    var p = readParams();
    if (p.cssOpen === "subscription") return openSubscription();
    if (p.cssOpen === "login") return openLogin();
    if (p.cssBuy && p.cssMV) return openBuyForWork(p.cssMV, p.cssBuy);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
