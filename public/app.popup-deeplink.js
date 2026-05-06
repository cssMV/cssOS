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
    // The work share-link router will open the MV in cinema mode. We
    // also click the Listen / View / Buyout CTA on the market commerce
    // overlay once it's rendered. The exact CTA selectors depend on
    // app.market-commerce.js rendering — try a few known patterns and
    // fall back to surfacing the work info panel.
    tryAction(
      function () {
        return !!globalThis.currentWatchPreviewWork ||
               !!document.getElementById("watch-panel");
      },
      function () {
        var sel = {
          listen: ['[data-action="buy-listen"]', '[data-buy="listen"]', '.cssmv-buy-listen'],
          view:   ['[data-action="buy-view"]',   '[data-buy="view"]',   '.cssmv-buy-view'],
          buyout: ['[data-action="buy-buyout"]', '[data-buy="buyout"]', '.cssmv-buy-buyout'],
        };
        var arr = sel[kind] || [];
        var btn = null;
        for (var i = 0; i < arr.length; i++) {
          btn = document.querySelector(arr[i]);
          if (btn) break;
        }
        if (btn) {
          try { btn.click(); } catch (_e) {}
        } else {
          // Fall back: open the info / details surface so user can find
          // the purchase controls manually.
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

  function init() {
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
