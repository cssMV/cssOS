/* CSSOS_WAVE_121 20260513 — Jing
 * "必须依据作品的ID这个唯一的真源去读取作品的全部信息".
 *
 * 张冠李戴 hardening. The Watch panel kept ~6 module-scoped globals
 * holding "last-known good" assets (currentPreviewFrameDataUrl,
 * currentPreviewFrameSequence, cachedWatchFrame, foryouThumbFallback...).
 * On work-switch, only SOME of them get reset, leaving the rest to
 * leak into the next render — the user sees song B with song A's
 * cover / video / subtitle.
 *
 * This module enforces a hard contract:
 *
 *   1. Every work-switch MUST call `cssosBindToWorkId(workId)`.
 *   2. That call:
 *      - Stamps #watch-panel with data-active-work-id="<workId>".
 *      - Flushes ALL known asset-cache globals.
 *      - Dispatches a `cssos:work-id-changed` event so panel renderers
 *        can rebind their own DOM fields.
 *   3. Any asset loader (cover, audio, video, subtitle) MUST check
 *      `cssosCurrentWorkId() === ownerWorkId` before applying — if
 *      not, the asset belongs to a stale work and is dropped.
 *
 * Public API:
 *   cssosCurrentWorkId()            → string (current bound work_id)
 *   cssosBindToWorkId(id, work?)    → idempotent setter + flusher
 *   cssosAssertOwnership(id)        → throws if id !== current
 *   cssosFlushAllAssetCaches()      → manual purge (used internally)
 */
(function () {
  "use strict";
  if (globalThis.cssosBindToWorkId) return;

  let __currentWorkId = "";
  let __currentWork = null;

  function flushAllAssetCaches() {
    /* CSSOS_WAVE_204 20260516 — Jing: "关闭MV面板之后，从'为你创作'面板
     * 想再打开，标题/歌词/音频全乱套了，三个不同作品的数据混在一起，
     * 只有封面正确". Root cause: flushing DOM caches alone isn't enough
     * — the cssosMvPipelinePanelState singleton retains title/lyrics/
     * audioUrl/etc from the LAST pipeline run. When the watch path
     * re-opens a different work, half the surfaces read from the
     * freshly-set cssmvPipelineLastResult (correct) and the other half
     * still read from the stale pipelineState (the previous work's
     * data). Result: mixed-source split-brain UI.
     *
     * Fix: every work-switch also wipes the 25+ pipeline state output
     * fields, so downstream readers re-hydrate purely from the new
     * work's payload. */
    try {
      const ps = (typeof globalThis.cssosMvPipelinePanelState === "function")
        ? globalThis.cssosMvPipelinePanelState()
        : null;
      if (ps) {
        ps.title = "";
        ps.lyrics = "";
        ps.sections = null;
        ps.shotScripts = null;
        ps.derivedSettings = null;
        ps.derived_settings = null;
        ps.workType = null;
        ps.voiceGender = null;
        ps.tempoBpm = null;
        ps.musicKey = null;
        ps.genre = null;
        ps.mood = null;
        ps.instrument = null;
        ps.ambience = null;
        ps.vocalStyle = null;
        ps.ensembleStyle = null;
        ps.instrumentation = null;
        ps.sectionForm = null;
        ps.articulationBias = null;
        ps.voicingRegister = null;
        ps.expressionCcBias = null;
        ps.inspirationNotes = null;
        ps.referenceArtists = null;
        ps.audioUrl = "";
        ps.audioUrlBackendOnly = null;
        ps.altAudioUrl = "";
        ps.duration = 0;
        ps.altDuration = 0;
        ps.alignedLyrics = null;
        ps.karaJson = null;
        ps.targetDurationSecs = 0;
        ps.videoUrl = null;
        ps.videoSegments = null;
        ps.videoDurSecs = 0;
        ps.subtitlesSrt = null;
        ps.subtitlesAss = null;
        ps.engines = {};
        ps._lastPipelineLyrics = "";
        ps._lastPipelineTitle = "";
      }
    } catch (_e) {}
    /* CSSOS_WAVE_204 — also clear the global "last result" cache that
     * universal-entry freshness checks read from. cssmvPipelineLastResult
     * carries title/lyrics/audioUrl etc — same split-brain risk if it
     * stays populated with a previous work's data past a work-switch. */
    try { globalThis.cssmvPipelineLastResult = null; } catch (_e) {}
    /* CSSOS_WAVE_207 20260516 — Jing: "Du Fu × Yueyang Tower" 妖怪.
     * The in-frame art title overlay (cssmv-mv-title) is rehydrated
     * from a module-scoped mvTitleCachedText when the watch frame
     * remounts. If a previous work's title is still in that cache and
     * the new work hasn't had a chance to call cssmvRenderMvArtTitle
     * yet, the stale text shows up — and our 10s auto-hide didn't apply
     * to the rehydrate path. Hard-clear the overlay on every bind
     * (passing "" explicitly nukes the cache via the W207 fix above). */
    try {
      if (typeof globalThis.cssmvRenderMvArtTitle === "function") {
        globalThis.cssmvRenderMvArtTitle("");
      } else if (typeof globalThis.cssmvHideMvArtTitle === "function") {
        globalThis.cssmvHideMvArtTitle();
      }
    } catch (_e) {}
    // Frame caches
    try { globalThis.currentPreviewFrameDataUrl = ""; } catch (_) {}
    try { globalThis.currentPreviewFrameSequence = []; } catch (_) {}
    try { globalThis.currentForyouThumbFallbackDataUrl = ""; } catch (_) {}
    // CSSOS_WAVE_550 20260531 — Jing「按 ID 读取却张冠李戴」根治: 此前 flush 漏清了
    // 【封面/画作变体池】两个全局 → 上一首的封面/幻灯池残留到下一首(尤其新作品无 slideshow
    // 时, 旧池继续显示)= 张冠李戴。这里一并清掉 + 清常驻背景层 + 释放 motion clip + 重置视频帧标志。
    try { globalThis.currentResolvedWatchArtworkDataUrl = ""; } catch (_) {}
    try { globalThis.currentWatchArtworkVariantPool = []; } catch (_) {}
    // CSSOS_WAVE_617 — Jing「幻灯帧池串台」根治: 同时清掉 cover-slideshow 内部的 state.slides,
    // 否则切到无帧作品时上一首/最新封面的帧会残留 → 张冠李戴。每首只用自己的帧(严格按 ID)。
    try { if (typeof globalThis.cssmvClearCoverSlides === "function") globalThis.cssmvClearCoverSlides(); } catch (_) {}
    try { globalThis.currentPreviewVideoSourceKind = "none"; } catch (_) {}
    try { globalThis.currentPreviewVideoHasUsableFrame = false; } catch (_) {}
    try {
      if (globalThis.currentPreviewMotionClipUrl) {
        URL.revokeObjectURL(globalThis.currentPreviewMotionClipUrl);
        globalThis.currentPreviewMotionClipUrl = "";
      }
    } catch (_) {}
    // 常驻背景层(W333 稳定封面 backdrop)— 清掉旧封面, 由 bind 后用新作品封面立即重绘(见 cssosBindToWorkId)。
    try {
      const bd = document.getElementById("watch-screen-backdrop");
      if (bd) bd.style.backgroundImage = "";
    } catch (_) {}
    // Video element
    try {
      const v = document.querySelector("#watch-panel video, .watch-screen video");
      if (v instanceof HTMLVideoElement) {
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
    } catch (_) {}
    // Cover img
    try {
      const img = document.querySelector("#watch-panel .watch-svg, #watch-svg, #watch-panel img.watch-cover");
      if (img instanceof HTMLImageElement) img.removeAttribute("src");
    } catch (_) {}
    // Subtitle
    try {
      const sub = document.querySelector("#watch-panel .watch-subtitle, #watch-subtitle");
      if (sub instanceof HTMLElement) sub.textContent = "";
    } catch (_) {}
    // Karaoke / lyrics overlay
    try {
      const k = document.getElementById("watch-karaoke-line");
      if (k instanceof HTMLElement) k.textContent = "";
    } catch (_) {}
    // Audio element
    try {
      const a = document.querySelector("#watch-panel audio, #watch-audio");
      if (a instanceof HTMLAudioElement) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
    } catch (_) {}
    // localStorage frame cache (Wave 113A "last good frame")
    try {
      ["cssos.lastGoodWatchFrame", "cssos.lastGoodWatchFrameSeq"]
        .forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
  }

  globalThis.cssosFlushAllAssetCaches = flushAllAssetCaches;

  globalThis.cssosCurrentWorkId = function () { return __currentWorkId; };
  globalThis.cssosCurrentWork = function () { return __currentWork; };

  // CSSOS_WAVE_630 20260604 — Jing「孔子杏坛说教 无声 + 封面串台」根因: 多部作品的【合成部件】
  // id 形如 `<rootuuid>__part_3`(buildFallbackHierarchyChildren), 拿去请求 /api/works/:id/
  // {language-tracks,slideshow} 时, 非 36 位 uuid → 后端 400 → 没音轨(无声) + 没帧(串用上一首封面)。
  // 这些合成部件本就是【同一首歌的歌词分段视图】, 应当复用 root 的音轨+帧。统一把 id 归一到 root。
  globalThis.cssosRootWorkId = function (id) {
    var s = String(id || "").trim();
    if (!s) return s;
    // 去掉合成后缀 __part_N / __act_N / 任意 __xxx; 取第一段。
    var root = s.split("__")[0].trim();
    return root || s;
  };

  globalThis.cssosBindToWorkId = function (idOrWork, maybeWork) {
    // Accept either (id, work) or (work).
    let id, work;
    if (typeof idOrWork === "string") {
      id = idOrWork.trim();
      work = maybeWork || null;
    } else if (idOrWork && typeof idOrWork === "object") {
      work = idOrWork;
      id = String(work.id || work.work_id || work.local_id || "").trim();
    } else {
      return false;
    }
    if (!id) return false;
    // 归一到 root: 合成部件(…__part_N)复用 root 的音轨/帧, 避免 400 → 无声/封面串台。
    id = globalThis.cssosRootWorkId(id);
    if (id === __currentWorkId) {
      // Same work — just update the work object if a fresher one arrived
      if (work) __currentWork = work;
      return true;
    }
    // Real switch — flush before rebind so any in-flight async asset load
    // that completes after this point will fail the ownership check.
    flushAllAssetCaches();
    __currentWorkId = id;
    __currentWork = work || null;
    // CSSOS_WAVE_550 — flush 清空了 backdrop; 立刻用【新作品】封面重绘, 避免黑屏闪 + 杜绝旧封面残留。
    try {
      const cov = String((work && (work.cover_image || work.cover_url || work.preview_image_url)) || "").trim();
      const bd = document.getElementById("watch-screen-backdrop");
      if (bd && cov && !/^data:image\/svg/i.test(cov)) {
        const stable = (typeof globalThis.cssosThumb === "function") ? (globalThis.cssosThumb(cov, 800) || cov) : cov;
        bd.style.backgroundImage = 'url("' + String(stable).replace(/"/g, '\\"') + '")';
        bd.style.backgroundSize = "cover";
        bd.style.backgroundPosition = "center";
        globalThis.currentResolvedWatchArtworkDataUrl = cov;
        globalThis.currentWatchArtworkVariantPool = [cov];
      }
    } catch (_) {}
    try {
      const wp = document.getElementById("watch-panel");
      if (wp) wp.dataset.activeWorkId = id;
    } catch (_) {}
    // CSSOS_WAVE_733 — Jing: 播放时低调显示当前 work 🆔(角标, 跟 chrome 一起显隐, 见 style.watch.css)。
    // CSSOS_WAVE_737 — 左上角:【标题 - 作者】+【🆔】两行(原只显 id)。作者优先 owner_name。
    try {
      const idEl = document.getElementById("watch-work-id");
      if (idEl) {
        // CSSOS_WAVE_766 — Jing: 第一行【标题 - 作者】, 分隔符用 " - ", 作者补 owner_email(如 jingdudc@gmail.com)。
        const _t = String((work && work.title) || "").trim();
        const _au = String((work && (work.owner_name || work.owner_handle || work.owner_email)) || "").trim();
        const _titleLine = _t ? (_au ? _t + " - " + _au : _t) : "";
        // CSSOS_WAVE_744 — Jing「ID 不要 🆔 emoji, 太显眼; 用纯文本 ID, 更小、隐隐约约不抢戏」。
        idEl.innerHTML =
          '<span class="wid-title"></span>' +
          '<span class="wid-id">ID ' + id + "</span>";
        if (_titleLine) { const tn = idEl.querySelector(".wid-title"); if (tn) tn.textContent = _titleLine; }
        // CSSOS_WAVE_742 — Jing「标题-作者没回家」: 某些播放路径传给 bind 的 work 没带 title(只有 id)。
        // bind 在 openMarketWorkPreview 最前面跑(此时 pipelineState 还是上一首, 不能直接回退=会串台)。
        // 安全兜底: 稍后读【中央大标题】(openMarketWorkPreview 随后会填), 归属校验同一 id 才镜像。
        if (!_titleLine) {
          const _fillFromCenter = function () {
            try {
              if (__currentWorkId !== id) return;            // 已切走 → 丢弃
              const tn = idEl.querySelector(".wid-title");
              if (!tn || tn.textContent.trim()) return;       // 已有标题 → 不覆盖
              const ce = document.querySelector("#watch-title-text, .watch-title-text, .cssmv-mv-title");
              const ct = ce ? String(ce.textContent || "").trim() : "";
              const _bad = /^(watch|untitled|css mv|untitled mv)$/i.test(ct);
              // W766 — 兜底也补作者(owner_email 优先, 配合主路径"标题 - 作者")。
              const _w2 = work || globalThis.currentWatchPreviewWork || null;
              const _au2 = String((_w2 && (_w2.owner_name || _w2.owner_handle || _w2.owner_email)) || "").trim();
              if (ct && !_bad) tn.textContent = _au2 ? (ct + " - " + _au2) : ct;
            } catch (_e) {}
          };
          setTimeout(_fillFromCenter, 700);
          setTimeout(_fillFromCenter, 1800);
        }
      }
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent("cssos:work-id-changed", {
        detail: { workId: id, work: __currentWork },
      }));
    } catch (_) {}
    console.info(
      `%c[work-id] bound to ${id}${work && work.title ? " · " + work.title : ""}`,
      "color:#0a0;font-weight:bold",
    );
    // CSSOS_WAVE_122 20260513 · slideshow pool draw.
    // After binding, ask the server for a freshly-shuffled 15-of-30
    // slideshow draw and feed it into the watch frame loop. If the
    // server returns 0 frames (pool not yet generated), we silently
    // fall back to whatever the existing single-cover logic produces.
    // The draw is per-bind, so every replay sees a new visual mix.
    // CSSOS_WAVE_587 — Jing「纯幻灯作品要循环几遍才出画面」根因:
    // 帧池服务端是异步生成的, 首次 bind 时常返回 0 帧 → 旧代码直接 return 放弃,
    // 什么都不显示, 只能等下一次循环重新 bind 才碰巧拿到 → "循环几遍才出"。
    // 修复: 返回 0 帧 = 池子还没就绪 → 有界重试(带退避), 拿到就立即挂载。
    (function loadSlideshowWithRetry(attempt) {
      fetchSlideshow(id).then((urls) => {
        if (__currentWorkId !== id) return; // 归属校验: 用户已切到别的作品 → 丢弃
        if (!urls || urls.length === 0) {
          if (attempt < 6) setTimeout(function () { loadSlideshowWithRetry(attempt + 1); }, 1400 + attempt * 800);
          return; // 重试用尽 → 回落 legacy 单封面
        }
        try {
          globalThis.currentPreviewFrameSequence = urls;
          if (urls[0]) globalThis.currentPreviewFrameDataUrl = urls[0];
          if (typeof globalThis.startWatchFrameLoopModule === "function") {
            globalThis.startWatchFrameLoopModule(urls);
          }
          // WAVE_444d — feed full pool into the cover slideshow so it always runs (music + MV tabs).
          if (typeof globalThis.cssmvSetCoverSlides === "function") globalThis.cssmvSetCoverSlides(urls);
          if (typeof globalThis.cssmvStartCoverSlideshow === "function") globalThis.cssmvStartCoverSlideshow({ mv: true, music: true });
          window.dispatchEvent(new CustomEvent("cssos:slideshow-loaded", { detail: { workId: id, count: urls.length } }));
        } catch (_) {}
      }).catch(function () {
        if (__currentWorkId === id && attempt < 6) setTimeout(function () { loadSlideshowWithRetry(attempt + 1); }, 1400 + attempt * 800);
      });
    })(0);
    return true;
  };

  async function fetchSlideshow(workId) {
    try {
      workId = globalThis.cssosRootWorkId(workId); // W630 — 合成部件归一到 root, 否则 400 取不到帧
      // CSSOS_WAVE_127 — request the device-correct orientation. Desktop
      // / landscape viewport → cinema 16:9 frames; phone / portrait
      // viewport → 9:16 frames composed for mobile fullscreen. The
      // server tops up with the other orientation if the pool is short.
      var portrait = false;
      try {
        portrait = window.matchMedia &&
          window.matchMedia("(orientation: portrait)").matches &&
          window.innerWidth <= 900;
      } catch (_) {}
      const orient = portrait ? "portrait" : "landscape";
      const r = await fetch(
        `/api/works/${encodeURIComponent(workId)}/slideshow?orientation=${orient}`,
        { credentials: "include" },
      );
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j?.urls) ? j.urls.filter(Boolean) : [];
    } catch (_) { return []; }
  }

  /* Loaders call this with the work_id they were asked to load FOR.
   * If the current binding has since changed (user clicked another
   * song while async load was pending), the loader knows to drop its
   * result instead of writing it into the now-different work's DOM. */
  globalThis.cssosAssertOwnership = function (workId) {
    const cur = __currentWorkId;
    const incoming = String(workId || "").trim();
    if (!cur || !incoming) return false;
    return cur === incoming;
  };

  /* Hook into the canonical `currentWatchPreviewWork` setter so every
   * existing assignment auto-routes through cssosBindToWorkId. We use
   * a getter/setter on globalThis since currentWatchPreviewWork is a
   * module-scoped let in app.work-sync.js; defineProperty on globalThis
   * gives us a notification channel without touching that file. */
  let __syncedWork = null;
  try {
    Object.defineProperty(globalThis, "__cssosLastBoundWork", {
      get() { return __syncedWork; },
      set(v) {
        __syncedWork = v;
        if (v && (v.id || v.work_id || v.local_id)) {
          globalThis.cssosBindToWorkId(v);
        }
      },
      configurable: true,
    });
  } catch (_) {}

  /* Convenience: watch for #watch-panel becoming visible without a
   * work-id binding (means someone opened it via legacy path), and
   * warn so we can fix that call site. */
  setInterval(() => {
    const wp = document.getElementById("watch-panel");
    if (!wp || wp.hidden || wp.offsetParent === null) return;
    const visibleVideo = wp.querySelector("video");
    const playing = visibleVideo && !visibleVideo.paused;
    if (playing && !wp.dataset.activeWorkId) {
      console.warn("[work-id] watch panel playing without active-work-id binding — switch site missed");
    }
  }, 8000);

  // CSSOS_WAVE_733b — Jing「凡有音乐作品卡片处都显示时长」: 全平台共用时长格式化 helper。
  // 输入秒(接受多种字段名), 输出 m:ss; 无效返回 ""(调用方据此决定是否显示)。
  if (typeof globalThis.cssosFmtDur !== "function") {
    globalThis.cssosFmtDur = function (secsOrWork) {
      try {
        var s = secsOrWork;
        if (s && typeof s === "object") {
          s = s.duration_secs || s.audio_duration_secs || s.final_duration_secs
            || s.duration || s.alt_duration_secs || 0;
        }
        s = Number(s) || 0;
        if (!(s > 0)) return "";
        var m = Math.floor(s / 60), ss = Math.floor(s % 60);
        return m + ":" + String(ss).padStart(2, "0");
      } catch (_e) { return ""; }
    };
  }

  // CSSOS_WAVE_733 — Jing: work 🆔 角标兜底覆盖所有入口(分享链接 W731i 派发本事件但不走
  // cssosBindToWorkId)。监听 cssos:work-id-changed → 设角标文本。
  try {
    window.addEventListener("cssos:work-id-changed", function (ev) {
      try {
        var wid = ev && ev.detail && ev.detail.workId;
        var idEl = document.getElementById("watch-work-id");
        if (idEl && wid) idEl.textContent = "🆔 " + String(wid);
      } catch (_) {}
    });
  } catch (_) {}

  // CSSOS_WAVE_536 — 静音启动 install 日志(保持控制台干净)。
})();
