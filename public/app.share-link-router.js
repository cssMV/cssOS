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

    /* CSSOS_WAVE_731d 20260612 — Jing「有声音了, 画面呢?」根因: 分享路由开场就调过
     * cssosEnterCinemaLayout(给 watch-panel 加 is-cssmv-fullscreen), 随后 home/主屏
     * 启动盖上来; 等用户点击 fire() 再调 cssosEnterCinemaLayout 时, 该函数开头
     * `if (panel.classList.contains("is-cssmv-fullscreen")) return;` 幂等早退 →
     * 没把面板重新顶到 home 之上 → 声音放了画面还停在 home。修: 直接、强制地把
     * watch-panel 顶到最前(高 z + 取消 hidden + 保证 cinema 类), 绕过那个早退。 */
    // CSSOS_WAVE_731h 20260612 — Jing「标题显示 MV Panel + 没进真全屏 + 开头闪」根因:
    // 之前手搓 bringWatchToFront 只加了 is-cssmv-fullscreen 半套类 + 自定义高 z(还和
    // 面板系统抢 → 闪烁), 没用平台【标准最大化入口】, 所以停在半吊子壳 UI(搜索框/dock/
    // 「MV Panel」占位标题都在)。改: 用 globalThis.togglePanelMaximizeModule(标准函数,
    // 一次性加 maximized + data-maximized + 触发真全屏 + 让 html.cssos-watch-open 藏 dock),
    // 并把 .panel-title 占位「MV Panel」改成作品标题。放弃自定义 z(交给 CSS .maximized 驱动)。
    function setSharePanelTitle() {
      try {
        var p = document.getElementById("watch-panel");
        if (!p || !title) return;
        var t = p.querySelector(".panel-title");
        if (t) {
          t.textContent = title;
          t.removeAttribute("data-i18n"); // 防 i18n 把它刷回「MV Panel」
        }
      } catch (_e) {}
    }
    function bringWatchToFront() {
      try {
        var p = document.getElementById("watch-panel");
        if (!p) return;
        p.classList.remove("hidden");
        p.dataset.minimized = "false";
        p.style.removeProperty("display");
        // 标准最大化 → 真影院(只在尚未最大化时调, 否则 toggle 会反向还原)。
        if (p.dataset.maximized !== "true"
            && typeof globalThis.togglePanelMaximizeModule === "function") {
          try { globalThis.togglePanelMaximizeModule(p); } catch (_e) {}
        }
        // 兜底: 标准函数不在时, 至少加影院类(CSS 全屏)。
        p.classList.add("is-cssmv-fullscreen");
        try { document.body.classList.add("cssos-cinema-mode"); } catch (_e) {}
        setSharePanelTitle();
      } catch (_e) {}
    }

    /* CSSOS_WAVE_731e 20260612 — Jing 实时 DOM 诊断实锤: video paused:false rs:4
     * vw1080×vh1920(画面在好好解码)、audio 在播, 但 panel.hidden=true 且 z 被
     * 改回 29 → 被 home 盖住。说明【我置顶之后, 别的模块(focusPanel/面板管理/
     * autoplay 收尾)又给 watch-panel 重新加了 hidden + 压低 z】, 单次置顶守不住。
     * 守护: 开场后 ~3.5s 内每 150ms 重申一次 front 状态, 谁来藏都按回去; 用户主动
     * 关闭(cssos:watch-close)或点了关闭三连就立即收手, 绝不跟用户的关闭意图打架。 */
    function armShareFrontGuardian() {
      try {
        if (globalThis.__cssosShareFrontGuardArmed) return;
        globalThis.__cssosShareFrontGuardArmed = true;
        var stop = false;
        var disarm = function () { stop = true; };
        try { document.addEventListener("cssos:watch-close", disarm); } catch (_e) {}
        try { window.addEventListener("cssos:watch-close", disarm); } catch (_e) {}
        var n = 0;
        var tick = function () {
          if (stop) return;
          var p = document.getElementById("watch-panel");
          // 只在【确实被藏了或被踢出最大化】时才纠正; 一旦稳定(未隐藏且已最大化)就不
          // 折腾, 避免每 tick 重写类导致闪烁。
          if (p) {
            if (p.classList.contains("hidden") || p.dataset.maximized !== "true") {
              bringWatchToFront();
            } else {
              setSharePanelTitle(); // 仅确保标题不被 i18n 刷回, 极轻量
            }
          }
          n++;
          if (n < 24) setTimeout(tick, 150); // 24 × 150ms ≈ 3.6s
        };
        setTimeout(tick, 120);
      } catch (_e) {}
    }

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
        bringWatchToFront();
        armShareFrontGuardian();
        if (typeof globalThis.cssosRequestBrowserFullscreen === "function") {
          try { globalThis.cssosRequestBrowserFullscreen(); } catch (_e) {}
        }
      }
    } catch (_e) {}

    /* CSSOS_WAVE_731i 20260612 — Jing「没有我们的招牌特色情绪字幕」: 分享路由绕过了
     * 标准水合, 而情绪字幕引擎(app.emotion-subtitle-engine.js)是靠 cssos:work-id-changed
     * 事件触发 loadForWork(拉该作品语言轨 + 加载逐字情绪字幕 JSON)。分享路由从没派
     * 这个事件 → 引擎没启动 → 招牌情绪字幕不出来。修: 主动派事件 + 直接调 loadForWork
     * (双保险), 并在媒体水合后补一次。 */
    try {
      var widSub = String(work.id || work.work_id || "");
      if (widSub) {
        try {
          window.dispatchEvent(new CustomEvent("cssos:work-id-changed", { detail: { workId: widSub } }));
        } catch (_e) {}
        var kickSubtitles = function () {
          try {
            var eng = globalThis.cssosEmotionSubtitle;
            if (eng && typeof eng.loadForWork === "function") eng.loadForWork(widSub);
          } catch (_e) {}
          // CSSOS_WAVE_731l 20260612 — Jing「有了情绪字幕, 但没有多语言/多声线胶囊」:
          // 标准路径(market-commerce 开作品)会调 cssosMountLanguagePill 渲染那个胶囊
          // (切语言/声线 + 右击=情绪字幕设置面板入口), 分享路由从没调 → 胶囊缺失。补上。
          try {
            globalThis.__cssosCurrentWorkId = widSub;
            if (typeof globalThis.cssosMountLanguagePill === "function") {
              globalThis.cssosMountLanguagePill(widSub);
            }
          } catch (_e) {}
        };
        setTimeout(kickSubtitles, 900);  // 等媒体元素就位
        setTimeout(kickSubtitles, 2600); // 水合后再补一次, 防被覆盖
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

      var fired = false;
      var fire = function () {
        if (fired) return;
        fired = true;
        try { document.removeEventListener("pointerdown", fire, true); } catch (_e) {}
        try { document.removeEventListener("touchstart", fire, true); } catch (_e) {}
        try { document.removeEventListener("keydown", fire, true); } catch (_e) {}
        try { removeTapVeil(); } catch (_e) {}
        try {
          if (typeof globalThis.cssosEnterCinemaLayout === "function") {
            globalThis.cssosEnterCinemaLayout();
          }
        } catch (_e) {}
        // CSSOS_WAVE_731d — 强制把面板顶到 home 之上(cssosEnterCinemaLayout 幂等早退
        // 不会重新置顶, 这里直接做)。
        try { bringWatchToFront(); } catch (_e) {}
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
          // CSSOS_WAVE_1042 20260620 — Jing「Console: requestFullscreen API can only be initiated by a
          //   user gesture」根治: 这是 80ms 延迟兜底, 那时用户手势已过期 → requestFullscreen 必被拒 +
          //   Chrome 记红字, 且本就成不了(无手势)。无活动手势就跳过 → 消报错 + 不做无用功。
          try { if (navigator.userActivation && navigator.userActivation.isActive === false) return; } catch (_e) {}
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
        // CSSOS_WAVE_731c — 显式取消静音 + 拉满音量再播声音源, 防别的模块
        // (watch-ui 水合 / 单一音频权威) 把音轨 muted 了导致点了还没声。
        try {
          var sv = document.getElementById("watch-video");
          if (sv) { sv.play && sv.play().catch(function(){}); }
        } catch (_e) {}
        try {
          var sa = document.getElementById("watch-audio-preview");
          if (sa) {
            sa.muted = false;
            sa.removeAttribute("muted");
            sa.volume = 1;
            sa.play && sa.play().catch(function(){});
          }
        } catch (_e) {}
      };
      document.addEventListener("pointerdown", fire, true);
      document.addEventListener("touchstart", fire, true);
      document.addEventListener("keydown", fire, true);

      /* CSSOS_WAVE_731 20260612 — Jing「分享链接被卡住了」: 浏览器(Safari/
       * Chrome)冷导航禁止无手势自动播放 → 上面的 play() 被静默拒绝 → 黑屏.
       * 旧兜底只是个隐形 pointerdown 监听, 没有任何可见提示, 用户看到的就是
       * "黑屏卡死、不知道点哪". 这里补一个**明确可见**的「▶ 点击播放」蒙层:
       *   - 能自动播就自动播(autoplay 允许时根本不显示这个蒙层);
       *   - 被拦了 → 给一个全屏大按钮, 点一下 = fire()(播放+影院+全屏);
       *   - 一旦媒体真的在播, 自动撤掉蒙层. */
      var removeTapVeil = function () {
        try { var n = document.getElementById("cssos-share-tap"); if (n) n.remove(); } catch (_e) {}
      };
      var showTapVeil = function () {
        if (fired) return;
        if (document.getElementById("cssos-share-tap")) return;
        var zh = false;
        try { zh = String(navigator.language || "").toLowerCase().indexOf("zh") === 0; } catch (_e) {}
        var ov = document.createElement("div");
        ov.id = "cssos-share-tap";
        ov.style.cssText =
          "position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;" +
          "align-items:center;justify-content:center;gap:16px;cursor:pointer;text-align:center;" +
          "background:radial-gradient(ellipse at center,rgba(4,10,16,.72),rgba(2,6,10,.9));" +
          "-webkit-tap-highlight-color:transparent;";
        ov.innerHTML =
          '<div style="width:96px;height:96px;border-radius:999px;display:flex;align-items:center;' +
          'justify-content:center;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.85);' +
          'box-shadow:0 8px 40px rgba(0,0,0,.5);">' +
          '<div style="width:0;height:0;border-style:solid;border-width:20px 0 20px 32px;' +
          'border-color:transparent transparent transparent #fff;margin-left:8px;"></div></div>';
        // The document-level capture listener will also catch this tap, but
        // bind directly too so it works even if something stops propagation.
        ov.addEventListener("pointerdown", fire, true);
        ov.addEventListener("click", fire, true);
        (document.body || document.documentElement).appendChild(ov);
      };

      /* CSSOS_WAVE_731c 20260612 — Jing「不再弹最新MV了, 但还是不自动播放」根因:
       * 浏览器【允许静音视频自动播】, 所以 #watch-video(静音画面)自动播了, 但
       * 声音在【另一个元素 #watch-audio-preview】(歌曲音轨), 它有声 → 被浏览器拦。
       * 旧判断 "视频在播 || 音频在播" 看到静音视频在播就误判成功 → 蒙层永不显示。
       * 修: 只认【声音源】—— 有独立音轨就盯 #watch-audio-preview, 否则盯 video;
       * 且必须 audible(未静音)才算真出声。蒙层只在声音源真出声时才撤。 */
      var soundEl = function () {
        return audioUrl
          ? document.getElementById("watch-audio-preview")
          : document.getElementById("watch-video");
      };
      var soundIsAudible = function () {
        var m = soundEl();
        return !!(m && !m.muted && m.volume > 0 && !m.paused && !m.ended
          && m.currentTime > 0 && m.readyState >= 2);
      };

      // If the SOUND source genuinely starts (audible), drop the veil.
      var bindAutoplaySuccess = function () {
        var m = soundEl();
        if (!m || m.__cssosShareAutoOk) return;
        m.__cssosShareAutoOk = true;
        m.addEventListener("playing", function () {
          if (soundIsAudible()) { try { removeTapVeil(); } catch (_e) {} }
        });
        m.addEventListener("volumechange", function () {
          if (soundIsAudible()) { try { removeTapVeil(); } catch (_e) {} }
        });
      };
      bindAutoplaySuccess();
      setTimeout(bindAutoplaySuccess, 600);

      // Decide after a short grace whether SOUND autoplay was blocked. If the
      // sound source isn't audibly playing, surface the visible tap veil.
      // App 端(原生已授权零手势出声)跳过。
      setTimeout(function () {
        if (fired) return;
        try { if (document.documentElement.classList.contains("cssos-app")) return; } catch (_e) {}
        if (!soundIsAudible()) showTapVeil();
      }, 900);
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
      /* CSSOS_WAVE_731f 20260612 — Jing「有声音, 无画面」真凶(实时诊断实锤): 这张转化
       * 卡 #cssos-share-cta(z 2147483600 + 86% 深色背景)在第 ~15s 就爆出来盖黑了
       * 正在播的视频。原因: 它挂在【视频元素】上判 92% 进度, 而视频 mv_*.mp4 是十几秒
       * 短循环、歌(音频)却 226s → 视频 15s 就到 92% → 卡片提前盖屏。修: 转化卡【只挂
       * 声音源(真歌曲, 有完整时长)】, 不挂短视频; 且必须真到尾声(≥92% 且已播 ≥45s)
       * 才弹, 短素材一律拦掉。 */
      var soundElNudge = function () {
        return audioUrl
          ? document.getElementById("watch-audio-preview")
          : document.getElementById("watch-video");
      };
      var progressNudge = function (e) {
        var el = e && e.target;
        if (!el || !el.duration || !isFinite(el.duration) || el.duration < 30) return;
        // 必须真到尾声: ≥92% 且至少已播 45s(挡住短素材/短循环误触发)。
        if (el.currentTime >= 45 && (el.currentTime / el.duration) >= 0.92) maybeNudge();
      };
      // CSSOS_WAVE_731f — 'ended' 也加锁: 开场多模块换 src(水合/音频权威/rebind)会
      // 触发【假 ended】→ 之前直接弹 CTA 盖屏。只有【真的播到结尾】(currentTime 接近
      // duration)才认, 假 ended 一律忽略。
      var endedNudge = function (e) {
        var el = e && e.target;
        if (!el || !isFinite(el.duration) || el.duration < 30) return;
        if (el.currentTime >= el.duration - 2) maybeNudge();
      };
      var attachOnce = function () {
        var s = soundElNudge();
        if (s && !s.__cssosShareEnded) {
          s.__cssosShareEnded = true;
          s.addEventListener("ended", endedNudge);
          s.addEventListener("timeupdate", progressNudge);
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
    /* CSSOS_WAVE_1499 — 《时间帝国》开场人物介绍: 点开主作品先弹开场页(model-viewer 三角色登场),
     * 开场页"进入电影/预告"链接带 &teskip=1 跳过, 本会话看过也跳过 → 防循环。 */
    try {
      var TE_FILM = "59578f73-7298-4aa7-b92c-38d5a649f2b8";
      var _sp = new URL(window.location.href).searchParams;
      var _skip = _sp.get("teskip") === "1" || sessionStorage.getItem("teIntroSeen") === "1";
      if (id === TE_FILM && !_skip) {
        sessionStorage.setItem("teIntroSeen", "1");
        window.location.replace("/timeempire-intro.html");
        return;
      }
    } catch (_e) {}
    /* CSSOS_WAVE_731 20260612 — Jing「分享链接被卡住」: 同步、尽早地点亮分享会话
     * 旗标 (在 stripShareParam 删掉 ?cssMV= 之前、在 async fetch 之前)。这样
     * app.autoplay-feed.js 那个延迟 1500ms 的「欣赏最新 MV?」提示 (hasBlockingDeepLink)
     * 无论 strip 多早、fetch 多慢, 都能判出"这是分享会话"而不弹、不抢播。 */
    try {
      globalThis.__cssosShareLinkActive = true;
      globalThis.__cssosShareLinkWorkId = String(id);
    } catch (_e) {}
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
