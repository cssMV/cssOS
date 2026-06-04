/* CSSOS_PHASE_A_SHARE_LINK_ROUTER 20260506 — Jing
 *
 * Reads `?cssMV=<work-id>` from the URL on boot. If present:
 *   1. Hits GET /api/works/public/<id> to resolve the work payload.
 *   2. Shapes a work-like object compatible with openMarketWorkPreview()
 *      (the existing entrypoint used by For You / Works Center).
 *   3. Calls openMarketWorkPreview(work) — which opens the MV panel
 *      and triggers the auto-cinema flow already wired in
 *      app.watch-media-layout-p2100.js + index.html's pure-cinema JS.
 *   4. Strips the cssMV query param from the URL bar so a refresh
 *      doesn't re-fire the share-open while the panel is already open.
 *
 * Loaded EARLY (before app.boot.js) so the work data is in flight by
 * the time the user could click anything else. We wait for
 * openMarketWorkPreview to be defined before invoking — boot order on a
 * cold cache is racy.
 */
(function () {
  "use strict";

  function readShareWorkId() {
    try {
      var sp = new URL(window.location.href).searchParams;
      var raw = (sp.get("cssMV") || sp.get("mv") || "").trim();
      // Accept UUID-ish (8-64 hex/dash) only.
      if (!/^[0-9a-fA-F-]{8,64}$/.test(raw)) return "";
      return raw;
    } catch (_e) {
      return "";
    }
  }

  function stripShareParam() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete("cssMV");
      url.searchParams.delete("mv");
      var clean = url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + url.hash;
      window.history.replaceState({}, document.title, clean);
    } catch (_e) {}
  }

  function shapeWorkFromPublicResponse(data) {
    if (!data || typeof data !== "object") return null;
    return {
      id: data.id,
      work_id: data.id,
      title: data.title || "",
      style: data.style || "",
      work_type: data.work_type || "",
      lyrics_preview: data.lyrics_preview || "",
      owner_name: data.owner_name || "",
      duration_secs: data.duration_secs || null,
      cover_image: data.cover_image || null,
      preview_image_url: data.preview_image_url || null,
      preview_video_url: data.preview_video_url || null,
      final_mv_url: data.final_mv_url || null,
      audio_track_1_url: data.audio_track_1_url || null,
      audio_track_2_url: data.audio_track_2_url || null,
      // Pass-through flags so downstream UI (Phase B download buttons
      // + preview-only sign-in CTA) can read them off the work object.
      __cssosShareLink: true,
      __cssosTier: data.viewer_tier || "guest",
      __cssosFullAccess: !!data.full_access,
      __cssosPreviewOnly: !!data.preview_only,
      __cssosCanDownloadMp3: !!data.can_download_mp3,
      __cssosCanDownloadWav: !!data.can_download_wav,
      __cssosCanDownloadMp4: !!data.can_download_mp4,
      __cssosGateAction: data.gate_action || null,
    };
  }

  /* CSSOS_SHARE_LINK_DIRECT_OPEN 20260506 — Jing
   * "面板跳来跳去，最终播放了一个不是分享的那个标题的作品" — even with
   * isShareLink guards inside the 645-line openMarketWorkPreview, the
   * function has too many side-effect branches (queue auto-chain, panel
   * default content, take-toggle hydration, market preview rendering)
   * for a share link to land cleanly. Bypass it entirely: pre-seed the
   * pipeline state, drop the watch-panel's .hidden, and let the existing
   * watch-ui hydration + cinema MutationObserver pick up from there. */
  function openShareLinkDirect(work) {
    // CSSOS_WAVE_220A 20260519 — Jing: mark the share-link work id so
    // canBypassPreviewLimit unlocks full playback (guests/free users
    // get the whole MV, then we nudge sign-in/subscribe on 'ended').
    try {
      globalThis.__cssosShareLinkWorkId = String(work.id || work.work_id || "");
    } catch (_e) {}
    var mvUrl = String(work.final_mv_url || work.preview_video_url || "").trim();
    var title = String(work.title || "").trim();
    var coverUrl = String(work.cover_image || work.preview_image_url || "").trim();
    var audioUrl = String(work.audio_track_1_url || "").trim();
    var altAudioUrl = String(work.audio_track_2_url || "").trim();
    var lyrics = String(work.lyrics_preview || "").trim();
    var style = String(work.style || "").trim();
    var duration = Number(work.duration_secs || 0) || null;

    // 1. Seed cssmvPipelineLastResult so watch-ui's hydration finds the
    //    URL + title without triggering a fresh pipeline run.
    try {
      globalThis.cssmvPipelineLastResult = {
        mvUrl: mvUrl || null,
        coverUrl: coverUrl || null,
        title: title || null,
        lyrics: lyrics || null,
        style: style || null,
        runId: null,
        audioUrl: audioUrl || null,
        altAudioUrl: altAudioUrl || null,
        durationSecs: duration,
        tsAt: Date.now(),
        // Long freshMs so any subsequent re-hydration check sees this
        // as authoritative. The single-source-of-truth principle: the
        // share-link UUID controls the panel, period.
        freshMs: 60 * 60 * 1000,
        source: "share-link"
      };
    } catch (_e) {}

    // 2. Mirror into mv-pipeline-panel state if it exists.
    try {
      var ps = globalThis.cssosMvPipelinePanelState
        ? globalThis.cssosMvPipelinePanelState()
        : null;
      if (ps) {
        ps.mvUrl = mvUrl || null;
        ps.audioUrl = audioUrl || null;
        ps.altAudioUrl = altAudioUrl || null;
        ps.duration = duration || 0;
        ps.title = title;
        ps.coverUrl = coverUrl;
        ps.lyrics = lyrics;
        ps.style = style;
        ps.workId = work.id || null;
        ps.ownerName = work.owner_name || "";
      }
    } catch (_e) {}

    // 3. Drop a single-entry, loop_single playlist so auto-advance can't hop.
    try {
      var pl = globalThis.cssosPlaylists;
      if (pl && typeof pl.populate === "function") {
        pl.populate("share-link", [work]);
        pl.setActive && pl.setActive("share-link");
        pl.setMode && pl.setMode("loop_single");
      }
    } catch (_e) {}

    // 4. Directly write the video + audio src so the panel plays this
    //    exact work even before any hydration helper runs.
    try {
      var v = document.getElementById("watch-video");
      var a = document.getElementById("watch-audio-preview");
      if (v && mvUrl) {
        v.src = mvUrl;
        v.removeAttribute("muted");
        v.muted = false;
        v.volume = 1;
        try { v.load && v.load(); } catch (_e) {}
        try { v.play && v.play().catch(function () {}); } catch (_e) {}
      }
      if (a && audioUrl) {
        // CSSOS_WAVE_220A 20260519 — Jing fix: ensure audio actually
        // loads + plays. preload="none" was blocking metadata; force
        // preload + playsInline + retry binding after watch-ui
        // hydration (which can clobber .src). 200ms + 1.2s retry.
        a.preload = "auto";
        a.playsInline = true;
        a.crossOrigin = a.crossOrigin || "anonymous";
        a.src = audioUrl;
        a.removeAttribute("muted");
        a.muted = false;
        var rebindAudio = function () {
          try {
            var aa = document.getElementById("watch-audio-preview");
            if (!aa) return;
            var cur = String(aa.src || "");
            if (cur.indexOf(audioUrl) === -1) {
              aa.preload = "auto";
              aa.playsInline = true;
              aa.src = audioUrl;
              aa.muted = false;
              aa.volume = 1;
              try { aa.load && aa.load(); } catch (_e) {}
            }
          } catch (_e) {}
        };
        setTimeout(rebindAudio, 200);
        setTimeout(rebindAudio, 1200);
        setTimeout(rebindAudio, 3000);
        a.volume = 1;
        try { a.load && a.load(); } catch (_e) {}
      }
      // Title overlay
      var t = document.getElementById("watch-title");
      if (t) t.textContent = title || "";
    } catch (_e) {}

    // 5. Open the watch panel — un-hide + run the shell module if present
    //    (this kicks the cinema-enter chain via MutationObserver).
    try {
      var watchPanel = document.getElementById("watch-panel");
      if (watchPanel) {
        watchPanel.classList.remove("hidden");
        watchPanel.dataset.minimized = "false";
        if (typeof globalThis.openWatchPanelShellModule === "function") {
          try { globalThis.openWatchPanelShellModule(); } catch (_e) {}
        }
        if (typeof globalThis.cssosEnterCinemaLayout === "function") {
          try { globalThis.cssosEnterCinemaLayout(); } catch (_e) {}
        }
        if (typeof globalThis.cssosRequestBrowserFullscreen === "function") {
          try { globalThis.cssosRequestBrowserFullscreen(); } catch (_e) {}
        }
      }
    } catch (_e) {}

    /* CSSOS_WAVE_222 20260518 — Jing: "用户点击分享链接进来要求默认
     * 进入真全屏影院模式". 浏览器要求 requestFullscreen 必须由 user
     * gesture 触发, 而 share-link 是 cold navigation, 上面 line 181
     * 那次同步调用会被静默拒绝 (Chrome/Safari 都更严了). 兜底: 在
     * <body> 上挂一个 ONE-SHOT 的 pointerdown 监听, 用户第一次随便
     * 点哪里 (Tap-to-play 蒙层、空白、任意按钮) 就立刻调一次
     * requestFullscreen + enterCinema. 一旦触发就摘掉自己. */
    try {
      if (globalThis.__cssosShareFullscreenArmed) return;
      globalThis.__cssosShareFullscreenArmed = true;
      var fire = function () {
        try { document.removeEventListener("pointerdown", fire, true); } catch (_e) {}
        try { document.removeEventListener("touchstart", fire, true); } catch (_e) {}
        try { document.removeEventListener("keydown", fire, true); } catch (_e) {}
        try {
          if (typeof globalThis.cssosEnterCinemaLayout === "function") {
            globalThis.cssosEnterCinemaLayout();
          }
        } catch (_e) {}
        try {
          if (typeof globalThis.cssosRequestBrowserFullscreen === "function") {
            globalThis.cssosRequestBrowserFullscreen();
          }
        } catch (_e) {}
        /* CSSOS_WAVE_226 — 兜底真全屏: 如果 panel 全屏被拒绝, 80ms 后试
         * 媒体框 (watch-video) / documentElement 三连. 浏览器只允许一个
         * 全屏目标, 任意一个成功即可. */
        setTimeout(function () {
          // CSSOS_WAVE_314 — App 端不调原生全屏(CSS 已全屏, 避免 iOS 原生 ✕).
          try { if (document.documentElement.classList.contains("cssos-app")) return; } catch (_e) {}
          if (document.fullscreenElement) return;
          try {
            var v = document.getElementById("watch-video");
            var fn = v && (v.requestFullscreen || v.webkitRequestFullscreen);
            if (fn) { fn.call(v); return; }
          } catch (_e) {}
          try {
            var de = document.documentElement;
            var fn2 = de.requestFullscreen || de.webkitRequestFullscreen;
            if (fn2) fn2.call(de);
          } catch (_e) {}
        }, 80);
        // Unblock autoplay while we're at it (same gesture授权所有媒体).
        try { document.getElementById("watch-video")?.play?.().catch(function(){}); } catch (_e) {}
        try { document.getElementById("watch-audio-preview")?.play?.().catch(function(){}); } catch (_e) {}
      };
      document.addEventListener("pointerdown", fire, true);
      document.addEventListener("touchstart", fire, true);
      document.addEventListener("keydown", fire, true);
    } catch (_e) {}

    /* CSSOS_WAVE_220A 20260519 — Jing: share-link visitors get full
     * playback (canBypassPreviewLimit short-circuits to true for the
     * share-link work id). On 'ended', nudge sign-in / subscribe ONCE
     * — only for guest tier; logged-in users just see the natural end. */
    try {
      if (globalThis.__cssosShareEndedNudgeArmed) return;
      globalThis.__cssosShareEndedNudgeArmed = true;
      var nudgeShown = false;
      /* CSSOS_WAVE_239 20260520 — Jing: $40 广告测试 0 注册. 漏斗在
       * "看完成品 → 行动" 这一步断裂. 把原来弱弱的 toast 换成强转化
       * 全屏 CTA 卡片: "🎁 你也能做一个 — 免费 3 次, 30 秒出片".
       * 只对 guest/free 弹一次. fire signup_intent 埋点用于追踪转化. */
      var fireConversionEvent = function (action) {
        try {
          var wid = globalThis.__cssosShareLinkWorkId || "";
          navigator.sendBeacon && navigator.sendBeacon(
            "/api/metrics/share-cta",
            new Blob([JSON.stringify({
              action: action, work_id: wid,
              utm: location.search || "", ts: Date.now()
            })], { type: "application/json" })
          );
        } catch (_e) {}
      };
      var openSignup = function () {
        fireConversionEvent("cta_click");
        if (typeof globalThis.openLoginPanelModule === "function") {
          globalThis.openLoginPanelModule();
        } else if (typeof globalThis.openLogin === "function") {
          globalThis.openLogin();
        } else {
          location.hash = "#login";
        }
      };
      // CSSOS_WAVE_424 20260525 — Jing「看完别冷拒, 按身份引导」: tiered post-watch CTA.
      //   guest      → sign in (3 free creations)
      //   free user  → subscribe (unlock unlimited)
      //   subscriber → "Want an MV like this?" → create one
      // Never a cold dead-end — even paying subscribers get invited to create.
      var renderCtaCard = function (mode) {
        if (document.getElementById("cssos-share-cta")) return;
        var zh = (function () {
          try { return String(navigator.language || "").toLowerCase().indexOf("zh") === 0; }
          catch (_e) { return false; }
        })();
        var L = function (en, cn) { return zh ? cn : en; };
        var copy = {
          guest: {
            emoji: "🎁",
            title: L("You can make one too.", "你也能做一个。"),
            sub: L("One sentence → a full music video in 30 seconds. 3 creations free, no card.",
              "一句话 → 30 秒一支完整 MV。免费 3 次，无需信用卡。"),
            cta: L("Sign in to start — free", "登录即可开始 — 免费"),
            go: function () { try { openSignup(); } catch (_e) {} },
          },
          free: {
            emoji: "✨",
            title: L("Want unlimited MVs?", "想要无限创作?"),
            sub: L("Subscribe to remove limits and unlock multilingual voices, buyouts, and more.",
              "订阅即可解除限制，解锁多语言声线、买断等更多功能。"),
            cta: L("See plans", "查看订阅方案"),
            go: function () {
              if (typeof globalThis.openSubscriptionPanelModule === "function") globalThis.openSubscriptionPanelModule();
              else { try { openSignup(); } catch (_e) {} }
            },
          },
          paid: {
            emoji: "🎬",
            title: L("Want an MV like this?", "想要一支这样的 MV?"),
            sub: L("Make your own in 30 seconds — one sentence is all it takes.",
              "30 秒做一支属于你的 —— 一句话就够。"),
            cta: L("Create one", "去创作"),
            go: function () {
              if (typeof globalThis.openMvPipelinePanel === "function") globalThis.openMvPipelinePanel({ origin: "share-cta" });
              else if (typeof globalThis.openCreationConsole === "function") globalThis.openCreationConsole();
            },
          },
        }[mode] || null;
        if (!copy) return;
        var ov = document.createElement("div");
        ov.id = "cssos-share-cta";
        ov.style.cssText =
          "position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;" +
          "align-items:center;justify-content:center;gap:18px;padding:32px;text-align:center;" +
          "background:radial-gradient(ellipse at center,rgba(4,14,10,.86),rgba(2,8,6,.95));" +
          "backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);" +
          "animation:cssosCtaIn .4s ease-out;";
        ov.innerHTML =
          '<div style="font-size:46px;line-height:1;">' + copy.emoji + '</div>' +
          '<div style="font:800 26px/1.25 -apple-system,system-ui,sans-serif;color:#eafff6;max-width:320px;">' +
          copy.title + '</div>' +
          '<div style="font:500 15px/1.5 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,.78);max-width:300px;">' +
          copy.sub + '</div>' +
          '<button id="cssos-share-cta-go" style="margin-top:8px;background:linear-gradient(135deg,#00f5a0,#00b87a);' +
          'border:0;color:#001b14;font:700 17px/1 -apple-system,system-ui,sans-serif;padding:16px 40px;' +
          'border-radius:999px;cursor:pointer;box-shadow:0 8px 28px rgba(0,245,160,.45);letter-spacing:.02em;">' +
          copy.cta + '</button>' +
          '<button id="cssos-share-cta-skip" style="background:transparent;border:0;color:rgba(255,255,255,.5);' +
          'font:500 13px/1 -apple-system,system-ui,sans-serif;padding:10px;cursor:pointer;">' +
          L("Maybe later", "稍后再说") + '</button>';
        if (!document.getElementById("cssos-cta-anim")) {
          var st = document.createElement("style");
          st.id = "cssos-cta-anim";
          st.textContent = "@keyframes cssosCtaIn{0%{opacity:0;transform:scale(.96)}100%{opacity:1;transform:scale(1)}}";
          document.head.appendChild(st);
        }
        document.body.appendChild(ov);
        fireConversionEvent("cta_shown");
        ov.querySelector("#cssos-share-cta-go").addEventListener("click", function (e) {
          e.stopPropagation();
          try { ov.remove(); } catch (_e) {}
          try { copy.go(); } catch (_e) {}
        });
        ov.querySelector("#cssos-share-cta-skip").addEventListener("click", function (e) {
          e.stopPropagation();
          fireConversionEvent("cta_dismiss");
          try { ov.remove(); } catch (_e) {}
        });
      };
      var maybeNudge = function () {
        if (nudgeShown) return;
        var u = globalThis.authState && globalThis.authState.user;
        var tier = String(
          (u && (u.tier || u.access_tier || u.membership_tier)) || "guest"
        ).toLowerCase();
        // W424 — tiered, never a cold dead-end (paid users now get the create nudge).
        var mode = !u ? "guest" : (tier === "guest" || tier === "free") ? "free" : "paid";
        nudgeShown = true;
        try { renderCtaCard(mode); } catch (_e) {}
      };
      // CSSOS_WAVE_220C 20260520 — Jing: the conversion CTA used to fire
      // ONLY on the media 'ended' event. But share-link playback runs in
      // loop_single (line ~144), and a looping media element NEVER fires
      // 'ended' — it silently restarts. Result: 11K TikTok viewers watched
      // Jerusalem on loop and the "You can make one too" CTA never showed,
      // converting nobody. Fix: ALSO trigger at 92% of the first play via
      // timeupdate, so the nudge fires regardless of loop mode.
      var progressNudge = function (e) {
        var el = e && e.target;
        if (!el || !el.duration || !isFinite(el.duration) || el.duration < 2) return;
        if ((el.currentTime / el.duration) >= 0.92) maybeNudge();
      };
      var attachOnce = function () {
        var v = document.getElementById("watch-video");
        var a = document.getElementById("watch-audio-preview");
        if (v && !v.__cssosShareEnded) {
          v.__cssosShareEnded = true;
          v.addEventListener("ended", maybeNudge);
          v.addEventListener("timeupdate", progressNudge);
        }
        if (a && !a.__cssosShareEnded) {
          a.__cssosShareEnded = true;
          a.addEventListener("ended", maybeNudge);
          a.addEventListener("timeupdate", progressNudge);
        }
      };
      attachOnce();
      // Also retry once after watch-ui hydration finishes injecting els.
      setTimeout(attachOnce, 1200);
    } catch (_e) {}
  }

  function openWhenReady(work, attempt) {
    attempt = attempt || 0;
    // Wait until the watch panel is in the DOM.
    var watchPanel = document.getElementById("watch-panel");
    if (watchPanel) {
      openShareLinkDirect(work);
      return;
    }
    if (attempt > 80) {
      console.warn("[share-link] watch-panel never appeared");
      return;
    }
    setTimeout(function () { openWhenReady(work, attempt + 1); }, 200);
  }

  async function bootShareLink() {
    var id = readShareWorkId();
    if (!id) return;
    stripShareParam();
    try {
      var res = await fetch("/api/works/public/" + encodeURIComponent(id), {
        credentials: "include",
        headers: { "Accept": "application/json" }
      });
      var payload = await res.json().catch(function () { return null; });
      if (!res.ok || !payload || !payload.ok) {
        console.warn("[share-link] /api/works/public failed:", res.status, payload);
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(
            (typeof globalThis.loginCopy === "function"
              ? globalThis.loginCopy("Share link not found.", "分享链接失效。")
              : "Share link not found.")
          );
        }
        return;
      }
      var work = shapeWorkFromPublicResponse(payload.data);
      if (!work) return;
      /* CSSOS_SHARE_LINK_SENTINEL 20260506 — Jing
       * Stamp a global flag so ensureWatchAutoChainOnOpenModule (and
       * any other "no media → regen pipeline" path) bails out for the
       * lifetime of this share session. The flag is cleared the moment
       * the user closes / minimizes the MV panel via the 3-button
       * close, or by their next manual action — see app.watch-ui.js. */
      globalThis.__cssosShareLinkActive = true;
      // Wait until DOM is ready AND openMarketWorkPreview is defined.
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          openWhenReady(work, 0);
        });
      } else {
        openWhenReady(work, 0);
      }
    } catch (err) {
      console.warn("[share-link] boot failed:", err);
    }
  }

  // Fire as soon as this script parses — fetch can race with the rest of
  // app.js loading; we'll just wait for the open fn before invoking.
  bootShareLink();

  // Expose for debugging / re-trigger.
  globalThis.__cssosShareLinkBoot = bootShareLink;
})();
