/* CSSOS_PHASE_C_PREVIEW_CAP 20260506 — Jing
 *
 * "Phase C: 签名 URL + 30 秒预览（媒体防爬）"
 *
 * Server-side companion: src/index.ts /secure/artifacts/:wid/:file
 * stamps "X-Preview-Limit-Seconds" on any preview-kind token. This
 * client module reads that header (via a cheap HEAD probe at first
 * play), and if present, hard-stops playback when currentTime reaches
 * the cap. After the stop we paint a small overlay nudging the user
 * to sign in / subscribe to keep watching.
 *
 * Phase C.2 will add server-side clip files so the bytes themselves
 * are short — at that point this module just becomes the UI layer.
 *
 * Public API (in case other code wants to drive it manually):
 *   globalThis.cssosPreviewCap.attachToVideo(videoEl, opts?)
 *   globalThis.cssosPreviewCap.detach(videoEl)
 */
(function () {
  "use strict";

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("zh") === 0 && zh) return zh;
    return en;
  }

  function isSecureMediaUrl(url) {
    return typeof url === "string" && url.indexOf("/secure/artifacts/") >= 0;
  }

  /** Returns Promise<number|null>. null → no cap (full access). */
  function probeCap(url) {
    if (!isSecureMediaUrl(url)) return Promise.resolve(null);
    return fetch(url, { method: "HEAD", credentials: "include" })
      .then(function (res) {
        var s = res.headers.get("X-Preview-Limit-Seconds");
        var n = Number(s || 0);
        return n > 0 && isFinite(n) ? n : null;
      })
      .catch(function () { return null; });
  }

  var overlayEl = null;
  function showPaywallOverlay(videoEl) {
    var panel = videoEl && videoEl.closest && videoEl.closest("#watch-panel");
    if (!panel) panel = document.body;
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = document.createElement("div");
    overlayEl.id = "cssos-preview-paywall";
    overlayEl.style.cssText =
      "position:absolute;inset:0;z-index:2147483646;display:flex;flex-direction:column;" +
      "align-items:center;justify-content:center;gap:14px;" +
      "background:radial-gradient(circle at 50% 40%,rgba(0,0,0,0.6),rgba(0,0,0,0.92));" +
      "color:#daffee;font:14px/1.4 -apple-system,system-ui,sans-serif;" +
      "backdrop-filter:blur(6px);" +
      // Critical — cinema chrome-hide CSS sets pointer-events:none on
      // hidden overlays. Force auto so the Sign in / Subscribe buttons
      // work even if the user is in cinema fullscreen.
      "pointer-events:auto;";
    var headline = document.createElement("div");
    headline.textContent = tt(
      "Preview ended — sign in or subscribe to keep watching.",
      "30 秒预览结束——登录或订阅即可观看完整版。"
    );
    headline.style.cssText = "font:600 16px/1.3 -apple-system,system-ui,sans-serif;text-align:center;max-width:480px;";
    overlayEl.appendChild(headline);
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;";
    function pillBtn(label, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText =
        "padding:9px 18px;border-radius:999px;cursor:pointer;" +
        "font:600 13px/1 -apple-system,system-ui,sans-serif;" +
        "background:rgba(0,245,160,0.85);color:#001b14;border:0;" +
        // Same belt-and-suspenders as the overlay itself — chrome-hide
        // CSS occasionally flips pointer-events on descendants.
        "pointer-events:auto;position:relative;z-index:1;";
      b.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        fn && fn();
      });
      return b;
    }
    /* Robust opener — try every known surface in order. The dock
     * action click is the most reliable because it goes through the
     * full openPanel(loginPanel) wiring including settings, density,
     * and focus. */
    function openByDockAction(action) {
      // 0. Exit cinema fullscreen first — login/subscribe panels open
      //    behind the fullscreen surface otherwise.
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(function () {});
        }
      } catch (_e) {}
      var dockBtn = document.querySelector('.dock-item[data-action="' + action + '"]');
      if (dockBtn) { try { dockBtn.click(); return true; } catch (_e) {} }
      try {
        if (typeof globalThis.handleGlobalAction === "function") {
          globalThis.handleGlobalAction(action);
          return true;
        }
      } catch (_e) {}
      if (action === "subscription" && typeof globalThis.openSubscriptionPanelModule === "function") {
        try { globalThis.openSubscriptionPanelModule(); return true; } catch (_e) {}
      }
      // Last resort — open the panel element directly if exposed.
      var panelId = action === "login" ? "login-panel" : "subscription-panel";
      var panelEl = document.getElementById(panelId);
      if (panelEl && typeof globalThis.openPanel === "function") {
        try { globalThis.openPanel(panelEl, { userInitiated: true }); return true; } catch (_e) {}
      }
      return false;
    }
    row.appendChild(pillBtn(tt("Sign in", "登录"), function () {
      openByDockAction("login");
    }));
    row.appendChild(pillBtn(tt("Subscribe", "订阅"), function () {
      openByDockAction("subscription");
    }));
    overlayEl.appendChild(row);
    var dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = tt("Dismiss", "关闭");
    dismiss.style.cssText =
      "background:transparent;border:0;color:rgba(218,255,238,0.6);" +
      "font:400 12px/1 ui-monospace,monospace;cursor:pointer;padding:6px 10px;";
    dismiss.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
      overlayEl = null;
    });
    overlayEl.appendChild(dismiss);
    var frame = panel.querySelector(".watch-frame") || panel;
    var prevPos = getComputedStyle(frame).position;
    if (prevPos === "static") frame.style.position = "relative";
    frame.appendChild(overlayEl);
  }

  /* Try every reasonable surface for "play the next work" without
   * coupling tightly to any one of them. Returns true if we kicked
   * something off. */
  function autoAdvance(videoEl) {
    // 1. Direct global hook, if a future module exposes it.
    try {
      if (typeof globalThis.cssosWatchNext === "function") {
        globalThis.cssosWatchNext({ reason: "preview-cap" });
        return true;
      }
    } catch (_e) {}
    // 2. Up-next strip "next" button by data attribute or class name.
    var sel = [
      "[data-action='mv-next']",
      "#watch-panel .cssmv-up-next-next",
      "#watch-panel .up-next-next",
      "#watch-panel .watch-next-btn",
      "#watch-panel [data-cssos-up-next-next]",
    ].join(",");
    var btn = document.querySelector(sel);
    if (btn) {
      try { btn.click(); return true; } catch (_e) {}
    }
    // 3. First clickable thumbnail in the up-next strip.
    var thumb = document.querySelector(
      "#watch-panel .cssmv-up-next [data-work-id], #watch-panel .up-next-strip [data-work-id]"
    );
    if (thumb) {
      try { thumb.click(); return true; } catch (_e) {}
    }
    return false;
  }

  function clearPaywallOverlay() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
  }

  function attachToVideo(videoEl) {
    if (!videoEl || videoEl.dataset.cssosPreviewCapBound === "1") return;
    videoEl.dataset.cssosPreviewCapBound = "1";
    var capSeconds = null;
    var lastSrc = "";
    function refreshCap() {
      var src = String(videoEl.currentSrc || videoEl.src || "");
      if (src === lastSrc) return;
      lastSrc = src;
      capSeconds = null;
      clearPaywallOverlay();
      probeCap(src).then(function (n) {
        capSeconds = n;
      });
    }
    videoEl.addEventListener("loadstart", refreshCap, { passive: true });
    videoEl.addEventListener("emptied", refreshCap, { passive: true });
    var capHit = false;
    videoEl.addEventListener("timeupdate", function () {
      if (capSeconds == null) return;
      if (capHit) return;
      if (videoEl.currentTime >= capSeconds - 0.1) {
        capHit = true;
        try { videoEl.pause(); } catch (_e) {}
        try { videoEl.currentTime = Math.max(0, capSeconds - 0.05); } catch (_e) {}
        // Per Jing: in normal browsing, don't halt — auto-advance to
        // the next work in the up-next strip. But share-link visitors
        // (typically guests landing on a single work) should see the
        // login/subscribe nudge — there's no queue context for them
        // and "advance to nothing" would just be a confusing pause.
        if (globalThis.__cssosShareLinkActive) {
          showPaywallOverlay(videoEl);
        } else if (!autoAdvance(videoEl)) {
          showPaywallOverlay(videoEl);
        }
      }
    }, { passive: true });
    videoEl.addEventListener("emptied", function () { capHit = false; }, { passive: true });
    videoEl.addEventListener("loadstart", function () { capHit = false; }, { passive: true });
    videoEl.addEventListener("seeking", function () {
      if (capSeconds == null) return;
      if (videoEl.currentTime > capSeconds + 0.1) {
        try { videoEl.currentTime = capSeconds - 0.05; } catch (_e) {}
      }
    });
    refreshCap();
  }

  function bindAll() {
    var v = document.getElementById("watch-video");
    if (v) attachToVideo(v);
    var a = document.getElementById("watch-audio-preview");
    if (a) attachToVideo(a);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAll);
  } else {
    bindAll();
  }
  // re-bind whenever a new media element appears
  if (document.body) {
    new MutationObserver(bindAll).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosPreviewCap = {
    attachToVideo: attachToVideo,
    probeCap: probeCap,
    showPaywall: showPaywallOverlay,
    clearPaywall: clearPaywallOverlay,
  };
})();
