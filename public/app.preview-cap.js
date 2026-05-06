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
    /* Per Jing — keep the user inside cinema fullscreen. Instead of
     * exiting fullscreen and opening the login/subscribe panel, expand
     * an inline dropdown ON the overlay with OAuth provider buttons.
     * OAuth itself runs in a popup window so the main page never
     * navigates and fullscreen is preserved. On popup close we re-fetch
     * the work URL — if access widened (auth succeeded), playback
     * resumes from the cap point with the full-access source. */
    var dropdown = null;
    function closeDropdown() {
      if (dropdown && dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
      dropdown = null;
    }
    function buildDropdown(kind /* "login" | "subscription" */) {
      closeDropdown();
      dropdown = document.createElement("div");
      dropdown.style.cssText =
        "margin-top:6px;padding:10px;border-radius:14px;" +
        "background:rgba(8,18,16,0.96);" +
        "border:1px solid rgba(0,245,160,0.35);" +
        "box-shadow:0 14px 32px rgba(0,0,0,0.55);" +
        "display:flex;flex-direction:column;gap:8px;min-width:240px;" +
        "pointer-events:auto;position:relative;z-index:2;";
      function providerBtn(label, url) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText =
          "all:unset;cursor:pointer;padding:10px 14px;border-radius:8px;" +
          "background:rgba(0,245,160,0.16);border:1px solid rgba(0,245,160,0.3);" +
          "color:#daffee;font:600 13px/1.1 -apple-system,system-ui,sans-serif;" +
          "text-align:center;pointer-events:auto;";
        b.addEventListener("mouseenter", function () {
          b.style.background = "rgba(0,245,160,0.26)";
        });
        b.addEventListener("mouseleave", function () {
          b.style.background = "rgba(0,245,160,0.16)";
        });
        b.addEventListener("click", function (e) {
          e.preventDefault(); e.stopPropagation();
          openOAuthPopup(url);
        });
        return b;
      }
      if (kind === "login") {
        dropdown.appendChild(providerBtn(tt("Continue with Google", "使用 Google 登录"), "/auth/google"));
        dropdown.appendChild(providerBtn(tt("Continue with GitHub", "使用 GitHub 登录"), "/auth/github"));
      } else {
        // Subscription — open the subscription panel in a popup so the
        // user stays in cinema fullscreen. The popup hosts the full
        // subscription / payment flow.
        dropdown.appendChild(providerBtn(tt("View subscription plans", "查看订阅方案"), "/?cssOpen=subscription"));
      }
      var hint = document.createElement("div");
      hint.textContent = tt(
        "Opens in a popup — you'll stay in cinema mode.",
        "在弹窗中打开——保留影院模式。"
      );
      hint.style.cssText = "font:400 10px/1.3 ui-monospace,monospace;color:rgba(218,255,238,0.55);text-align:center;padding-top:2px;";
      dropdown.appendChild(hint);
      overlayEl.appendChild(dropdown);
    }
    /* Open the OAuth / subscription URL in a popup window so the main
     * page never navigates. Watch for popup close → re-probe the cap
     * (which re-runs the HEAD probe of the secure-artifacts URL). If
     * access widened, the cap returns null and the cap-hit state is
     * cleared so playback continues. */
    function openOAuthPopup(url) {
      var w = 500, h = 640;
      var x = Math.max(0, (window.screen.availWidth - w) / 2);
      var y = Math.max(0, (window.screen.availHeight - h) / 2);
      var feat = "popup,width=" + w + ",height=" + h + ",left=" + x + ",top=" + y;
      var popup = window.open(url, "cssos_auth", feat);
      if (!popup) {
        // Popup blocker — fall back to a new tab.
        window.open(url, "_blank");
        return;
      }
      // Snapshot pre-popup auth state so we can detect a real change.
      var preAuth = null;
      fetch("/api/me", { credentials: "include", headers: { Accept: "application/json" } })
        .then(function (r) { return r.json().catch(function () { return null; }); })
        .then(function (j) {
          var d = (j && (j.data || j)) || {};
          preAuth = { authed: !!d.authenticated, tier: String(d.tier || ""), uid: (d.user && d.user.id) || null };
        })
        .catch(function () {});
      var t = setInterval(function () {
        if (!popup.closed) return;
        clearInterval(t);
        // Re-check /api/me — only widen access if something actually
        // changed (auth flipped, tier upgraded, new entitlement).
        fetch("/api/me", { credentials: "include", headers: { Accept: "application/json" } })
          .then(function (r) { return r.json().catch(function () { return null; }); })
          .then(function (j) {
            var d = (j && (j.data || j)) || {};
            var post = { authed: !!d.authenticated, tier: String(d.tier || ""), uid: (d.user && d.user.id) || null };
            var changed = !preAuth ||
              preAuth.authed !== post.authed ||
              preAuth.tier !== post.tier ||
              preAuth.uid !== post.uid;
            if (changed) {
              if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
              overlayEl = null;
              // Broadcast so any other tabs also pick up the change.
              try { localStorage.setItem("cssos_auth_change", String(Date.now())); } catch (_e) {}
              ["watch-video", "watch-audio-preview"].forEach(function (id) {
                var el = document.getElementById(id);
                if (!el) return;
                try { el.dispatchEvent(new Event("cssos:refresh-access")); } catch (_e) {}
                try {
                  var ct = el.currentTime || 0;
                  el.load();
                  el.currentTime = ct;
                  el.play().catch(function () {});
                } catch (_e) {}
              });
            }
            // No change → leave overlay up. User cancelled or popup
            // didn't complete the flow.
          })
          .catch(function () {});
      }, 700);
    }
    /* Tier-aware buttons. Per Jing:
     *   Guest        → Sign in · Subscribe
     *   Free user    → Subscribe · Buy listen · Buy view · Buy out
     *   Subscriber   → Buy listen · Buy view · Buy out
     *   Owner/Admin  → no overlay (server already grants fullAccess)
     * The buttons are rebuilt after /api/me resolves. We render a
     * temporary "Sign in / Subscribe" pair first so the overlay isn't
     * empty during the round trip. */
    function readWorkId() {
      var w = globalThis.currentWatchPreviewWork;
      if (w && (w.id || w.work_id)) return String(w.id || w.work_id).trim();
      try {
        var sp = new URLSearchParams(window.location.search);
        var fromUrl = String(sp.get("cssMV") || "").trim();
        if (fromUrl) return fromUrl;
      } catch (_e) {}
      return "";
    }
    function buildBuyUrl(workId, kind) {
      // Open the work's market page with an explicit purchase intent.
      // The market-commerce module already accepts ?cssMV=…&cssBuy=…
      // (or falls back to opening the work's panel). Popup-friendly.
      var base = "/?cssMV=" + encodeURIComponent(workId) + "&cssBuy=" + encodeURIComponent(kind);
      return base;
    }
    function renderRowForTier(meInfo) {
      // Clear any existing buttons.
      while (row.firstChild) row.removeChild(row.firstChild);
      var authed = !!(meInfo && meInfo.authenticated);
      var tier = String((meInfo && meInfo.tier) || "guest").toLowerCase();
      var paid = ["pro", "studio", "enterprise", "vip", "admin"].indexOf(tier) >= 0;
      var workId = readWorkId();
      if (!authed) {
        // Guest — login or subscribe (no direct purchase).
        row.appendChild(pillBtn(tt("Sign in", "登录"), function () {
          buildDropdown("login");
        }));
        row.appendChild(pillBtn(tt("Subscribe", "订阅"), function () {
          buildDropdown("subscription");
        }));
        return;
      }
      if (!paid) {
        // Free user — subscribe + per-work purchase options.
        row.appendChild(pillBtn(tt("Subscribe", "订阅"), function () {
          buildDropdown("subscription");
        }));
        if (workId) {
          row.appendChild(pillBtn(tt("Listen access", "聆听权"), function () {
            openOAuthPopup(buildBuyUrl(workId, "listen"));
          }));
          row.appendChild(pillBtn(tt("View access", "观赏权"), function () {
            openOAuthPopup(buildBuyUrl(workId, "view"));
          }));
          row.appendChild(pillBtn(tt("Buy out", "买断"), function () {
            openOAuthPopup(buildBuyUrl(workId, "buyout"));
          }));
        }
        return;
      }
      // Subscriber on someone else's paid work — direct purchase only.
      if (workId) {
        row.appendChild(pillBtn(tt("Listen access", "聆听权"), function () {
          openOAuthPopup(buildBuyUrl(workId, "listen"));
        }));
        row.appendChild(pillBtn(tt("View access", "观赏权"), function () {
          openOAuthPopup(buildBuyUrl(workId, "view"));
        }));
        row.appendChild(pillBtn(tt("Buy out", "买断"), function () {
          openOAuthPopup(buildBuyUrl(workId, "buyout"));
        }));
      }
    }
    // Initial render with the safe default (guest), then refine after
    // /api/me resolves.
    renderRowForTier(null);
    overlayEl.appendChild(row);
    fetch("/api/me", { credentials: "include", headers: { Accept: "application/json" } })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        var data = (j && (j.data || j)) || null;
        if (!data) return;
        renderRowForTier({
          authenticated: !!data.authenticated,
          tier: data.tier,
          role: data.role,
        });
        // Update headline copy by tier.
        if (data.authenticated) {
          var t = String(data.tier || "").toLowerCase();
          if (["pro", "studio", "enterprise", "vip", "admin"].indexOf(t) >= 0) {
            headline.textContent = tt(
              "Preview ended — purchase access to keep watching.",
              "30 秒预览结束——购买权限即可继续观看。"
            );
          } else {
            headline.textContent = tt(
              "Preview ended — subscribe or buy access to keep watching.",
              "30 秒预览结束——订阅或购买权限即可继续观看。"
            );
          }
        }
      })
      .catch(function () {});
    /* 10-second auto-advance — Jing's spec:
     *   - Cap fires → overlay shows with a visible countdown (10s)
     *   - User interacts (clicks any button, drops a dropdown, etc.)
     *     → cancel countdown, wait for them
     *   - No interaction by t=0 → autoAdvance() to next work
     * The countdown is paused on pointerover anywhere in the overlay,
     * resumed on pointerout — same affordance YouTube uses on its
     * "next video in 5s" autoplay nag. */
    var COUNTDOWN_S = 10;
    var countdownLeft = COUNTDOWN_S;
    var countdownTimer = 0;
    var countdownPaused = false;
    var countdownStopped = false;
    var countdownLabel = document.createElement("div");
    countdownLabel.style.cssText =
      "margin-top:4px;font:500 11px/1.2 ui-monospace,monospace;" +
      "color:rgba(218,255,238,0.55);text-align:center;letter-spacing:.04em;";
    function paintCountdown() {
      if (countdownStopped) {
        countdownLabel.textContent = "";
        return;
      }
      countdownLabel.textContent = tt(
        "Skipping to next in " + countdownLeft + "s · hover or click to stay",
        countdownLeft + " 秒后跳到下一首 · 悬停或点击可暂停"
      );
    }
    function stopCountdown(reason /* "user" | "advance" */) {
      if (countdownStopped) return;
      countdownStopped = true;
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = 0; }
      paintCountdown();
    }
    function startCountdown() {
      paintCountdown();
      countdownTimer = setInterval(function () {
        if (countdownStopped) return;
        if (countdownPaused) { paintCountdown(); return; }
        countdownLeft -= 1;
        if (countdownLeft <= 0) {
          stopCountdown("advance");
          // Tear down overlay + auto-advance.
          if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
          overlayEl = null;
          autoAdvance(videoEl);
          return;
        }
        paintCountdown();
      }, 1000);
    }
    overlayEl.appendChild(countdownLabel);
    // Any click inside the overlay → user is engaging → cancel countdown.
    overlayEl.addEventListener("click", function () { stopCountdown("user"); }, { capture: true });
    // Hover-pause: while pointer is over the overlay, freeze the countdown.
    overlayEl.addEventListener("pointerenter", function () { countdownPaused = true; paintCountdown(); });
    overlayEl.addEventListener("pointerleave", function () { countdownPaused = false; paintCountdown(); });
    // Share-link single-work view has no queue to advance into — disable
    // countdown entirely so the user just sees the buttons.
    if (globalThis.__cssosShareLinkActive) {
      countdownStopped = true;
      countdownLabel.textContent = "";
    } else {
      startCountdown();
    }

    var dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = tt("Dismiss", "关闭");
    dismiss.style.cssText =
      "background:transparent;border:0;color:rgba(218,255,238,0.6);" +
      "font:400 12px/1 ui-monospace,monospace;cursor:pointer;padding:6px 10px;";
    dismiss.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      stopCountdown("user");
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
      // Frontend safeguard — free works should never be capped, even if
      // the backend mistakenly minted a preview-kind token. Read the
      // listen-price off the loaded work payload; <= 0 cents → free.
      try {
        var w = globalThis.currentWatchPreviewWork || {};
        var cents = Number(
          w.current_listen_price_cents != null ? w.current_listen_price_cents : (w.listen_price_cents || 0)
        );
        if (isFinite(cents) && cents <= 0 && w.is_free !== false) {
          // Treat as free — bail out of cap entirely.
          return;
        }
        // Also honor explicit fullAccess hints from server.
        if (w.is_owner === true || w.fullAccess === true || w.full_access === true) return;
      } catch (_e) {}
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
        // Per Jing: always show the tier-aware paywall when the cap
        // hits, with a 10s auto-advance countdown. The overlay itself
        // handles: user interaction → cancel countdown, t=0 → call
        // autoAdvance() to next work. Share-link single-work visitors
        // skip the countdown (no queue to advance into).
        showPaywallOverlay(videoEl);
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
