/* CSSOS_TIER_C_MULTILINGUAL C5 20260520 — Jing
 *
 * 🌐 language pill + per-language progress for the Watch panel.
 *
 *   • Fetches /api/works/:id/language-tracks for the open work.
 *   • If the work has >1 language track (or any extra rendering), renders
 *     a 🌐 pill bar in the watch screen, styled with the TAB-PILL
 *     CONSTITUTION (.cssmv-pill-bar → 凸嵌凹 + convex-side border).
 *   • Clicking a READY language fully switches the MV: audio (+ later
 *     subtitle / lyrics). Video / slideshow is SHARED — picture keeps
 *     playing. Reuses the watch-audio-preview element + the same
 *     audio-first play sequence the ♪ take-toggle uses.
 *   • PENDING / RENDERING languages show as disabled pills with a live
 *     "…" progress hint; the bar re-polls every 8s until all settle, so
 *     a track that finishes mid-watch lights up without a reload.
 *
 * Public API:
 *   globalThis.cssosMountLanguagePill(workId)
 *   globalThis.cssosUnmountLanguagePill()
 */
(function () {
  "use strict";

  var POLL_MS = 8000;
  var _pollTimer = null;
  var _workId = null;
  var _activeLang = null;
  var _activeTake = 1; // 1 = audio_url, 2 = alt_audio_url
  // CSSOS_WAVE_587 20260531 — Jing「二维交叉: 语言×声线。两个模式胶囊一条轨, 谁激活显谁」。
  // _pillMode: 'lang' = 显各语言(每种原声线); 'voice' = 显【当前语言】的各声线。
  var _activeVoice = "auto";
  var _originVoice = ""; // CSSOS_WAVE_587 — 作品原声线(如 'feminine'), 用于把 auto 颗标真实声线名。
  globalThis.__cssosLangPillMode = globalThis.__cssosLangPillMode || "lang";

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var l = (navigator.language || "en").toLowerCase();
    return (l.indexOf("zh") === 0 && zh) ? zh : en;
  }

  // ISO code → short native label for the pill face.
  var LANG_FACE = {
    en: "EN", zh: "中", ja: "日", ko: "한", fr: "FR", de: "DE",
    es: "ES", pt: "PT", it: "IT", ru: "RU", ar: "ع", hi: "हि",
    // CSSOS_WAVE_434 — civilization-linked languages
    peo: "𐎠𐎭", fa: "فا", la: "LA", el: "ΕΛ", sa: "सं", bo: "བོད",
    ur: "اُر", vi: "VI", is: "IS", sv: "SV", sw: "SW", tr: "TR",
    he: "עב",
    // CSSOS_WAVE_625 — 原声哨兵 lang(老作品未记录 language 时的默认轨)。
    // 用语言中立的音符, 不硬编码任何语言文字(守 i18n 铁律); 显示=「这是作品原声」。
    orig: "♪",
  };
  function face(code) { return LANG_FACE[code] || String(code || "").toUpperCase().slice(0, 2); }

  function watchScreen() {
    return document.querySelector("#watch-panel .watch-screen") ||
           document.getElementById("watch-panel");
  }

  function stopPoll() {
    if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
  }

  function unmount() {
    stopPoll();
    var bar = document.getElementById("watch-language-pill");
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    var prog = document.getElementById("cssos-mv-progress"); // W433
    if (prog && prog.parentNode) prog.parentNode.removeChild(prog);
    _workId = null; _activeLang = null; _activeTake = 1;
    _autoPlayedFirstReady = false; // W431: re-arm 先出先播 for next work
    _lyricsJsonCache = null; _lyricsJsonFetching = false; // WAVE_440: reset per-work cache
    try { globalThis.cssosEmotionSubtitle?.reset(); } catch (_e) {} // WAVE_442
  }

  // CSSOS_WAVE_437 20260525 — suppress the legacy ♪1/♪2 take-toggle when the
  // unified language+take pill is showing. The old toggle sits top:12px right:12px
  // and collides with the panel-bar exit button in cinema mode.
  function suppressLegacyTakeToggle() {
    try {
      // Remove it from DOM if present.
      var old = document.getElementById("watch-take-toggle");
      if (old && old.parentNode) old.parentNode.removeChild(old);
      // Also prevent the injector from re-creating it.
      if (typeof globalThis.__cssosInjectTakeToggle === "function") {
        globalThis.__cssosInjectTakeToggle({ altAudioUrl: null });
      }
    } catch (_e) {}
  }

  // CSSOS_WAVE_587 — 全局唯一音源裁判。winner = 唯一允许发声的元素(通常是 #watch-audio-preview)。
  // 其余所有 <audio> 一律 pause+静音; 所有 <video> 一律静音(主视频保留播放当画面, 杂散视频 pause)。
  // 任何起播路径(语言/声线切换、先出先播、For-You)都该先调它, 确保「只有一个在唱」。
  function cssosAudioReferee(winner) {
    try {
      var mainV = document.getElementById("watch-video");
      globalThis.__cssosAudioWinner = winner || null;
      [].forEach.call(document.querySelectorAll("audio"), function (a) {
        if (a === winner) { a.muted = false; try { a.volume = 1; } catch (_e) {} }
        else { try { a.pause(); } catch (_e) {} a.muted = true; }
      });
      [].forEach.call(document.querySelectorAll("video"), function (v) {
        if (v.getAttribute && v.getAttribute("data-live-capture") === "1") return;   // 摄像头采集预览: 裁判豁免, 绝不暂停
        if (v === winner) { v.muted = false; try { v.volume = 1; } catch (_e) {} }
        // CSSOS_WAVE_587c — 主视频 muted=true(保留可自动播放, 又不放出烧录原声); 杂散视频 pause+mute。
        else if (v === mainV) { v.muted = true; }
        else { v.muted = true; try { v.pause(); } catch (_e) {} }
      });
      // 守卫: 若别的代码把烧录原唱视频取消静音(#40), 仅在【它主动改音量/重新 play】时重新静音(事件驱动,
      // 不用每秒 timeupdate —— 那会和暂停逻辑打架)。
      if (mainV && winner && winner.tagName === "AUDIO" && !mainV.__cssosMuteGuard2) {
        mainV.__cssosMuteGuard2 = true;
        var reMute = function () {
          var w = globalThis.__cssosAudioWinner;
          if (w && w.tagName === "AUDIO" && !w.paused && !mainV.muted) { mainV.muted = true; }
        };
        mainV.addEventListener("volumechange", reMute);
        mainV.addEventListener("play", reMute);
      }
    } catch (_e) {}
  }
  globalThis.cssosAudioReferee = cssosAudioReferee;

  // CSSOS_WAVE_626 — 「永不静音」兜底: 独立音频死链/报错/放不出时, 回退播主视频自带原声。
  // 绝不让用户停在"有画面、进度条在走、就是没声"的状态。若 W473b 已剥离视频 src(以为有独立
  // 音轨), 从它存的 data-fallback-src 恢复一个可播视频。再没有(纯音频死链)才放弃发声。
  // CSSOS_WAVE_628b 20260604 — Jing「Jerusalem 双声(一前一后)/ 孔子杏坛无声」根治。
  // 之前这里会【恢复并播放视频(data-fallback-src)】当兜底, 但很多作品视频里【有烧录原唱】,
  // 于是 烧录视频音 + 独立音频 同时响 = 双声/回声; 而把独立音频暂停去放【无声的】分离视频 = 无声。
  // 改为: 绝不再播视频出声 —— 只【重申单一音源(静音所有视频, 只留 #watch-audio-preview)】并
  // 重试独立音频。永远单声; 独立音频真死则保持静默(也好过双声)。
  function cssosFallbackToVideoAudio(reason) {
    try {
      var a = document.getElementById("watch-audio-preview");
      if (!a) return false;
      if (typeof globalThis.cssosAudioReferee === "function") globalThis.cssosAudioReferee(a); // 静音所有视频, 只留 a
      if (String(a.currentSrc || a.src || "").trim() && !a.ended) {
        a.muted = false; try { a.volume = 1; } catch (_e) {}
        var p = a.play && a.play(); if (p && p.catch) p.catch(function () {});
      }
      return true;
    } catch (_e) { return false; }
  }
  globalThis.cssosFallbackToVideoAudio = cssosFallbackToVideoAudio;

  // CSSOS_WAVE_628 20260604 — Jing「点一下响一下、随即又静音」根治(连旗舰款也中招)。
  // 症状=音频起播后被【某段抢改 .muted 的代码】立刻重新静音 → 只听到一瞬。与其逐个揪静音点,
  // 装一个【音频守护者】: 一旦本会话解锁过(用户已交互), 谁把 canonical 音频(#watch-audio-preview)
  // 重新【静音】, 就立刻弹回(unmute+play)。中和所有抢静音的代码。
  //   · 只在 watch 面板【开着】时生效(关闭面板的静音/暂停要尊重 → 不弹回);
  //   · 只对【muted】弹回, 不碰用户【主动暂停】(paused 但未静音);
  //   · 监听 volumechange(静音即触发); unmute 自身再次触发时 a.muted=false → no-op, 无死循环。
  (function installAudioKeeperOnce() {
    function watchOpen() {
      try {
        var wp = document.getElementById("watch-panel");
        return !!wp && !wp.classList.contains("hidden") && getComputedStyle(wp).display !== "none";
      } catch (_e) { return false; }
    }
    function attach() {
      var a = document.getElementById("watch-audio-preview");
      if (!a) { setTimeout(attach, 600); return; }
      if (a.__cssosKeeper) return;
      a.__cssosKeeper = true;
      var bounce = function () {
        try {
          if (!(globalThis.__cssosWatchAudioUnlocked || globalThis.__cssosAudioUnlocked)) return; // 没解锁不强播
          if (!watchOpen()) return;                       // 面板关了不响
          if (a.ended) return;                            // 播完不重启
          if (!String(a.currentSrc || a.src || "").trim()) return; // 没源不动
          if (a.muted) {                                  // 被静音(含"一出生就静音") → 弹回
            a.muted = false; try { a.volume = 1; } catch (_e) {}
            // 调 referee: 静音所有视频/其它音频, 只留 a, 并装上"视频被解静音就重静音"守卫 →
            // 根治 Jerusalem 这种【视频烧录原唱 + 独立音频同时响】的双声。
            if (typeof globalThis.cssosAudioReferee === "function") globalThis.cssosAudioReferee(a);
            else globalThis.__cssosAudioWinner = a;
            var p = a.play && a.play(); if (p && p.catch) p.catch(function () {});
          }
        } catch (_e) {}
      };
      // volumechange 抓"被重新静音"; play/canplay/loadeddata 抓"一出生就静音"。
      ["volumechange", "play", "canplay", "loadeddata"].forEach(function (ev) {
        a.addEventListener(ev, bounce, { passive: true });
      });
    }
    attach();
  })();

  // CSSOS_WAVE_731w 20260613 — Jing「约10首后没声」根因(真机探针实锤): #watch-audio-preview
  // 该响(paused:false, muted:false, 有 .mp3 源)却卡在 readyState 0、currentTime 不前进 —
  // 独立音轨【缓冲被切歌打断后没再起来】, 且没报 error(err:null)→ W626/W628 那套只认 error 的
  // 兜底从不触发 = 静默卡死。装【stall 看门狗】: 连续 ~2.4s 不前进就强制 load()+play() 重踢缓冲
  // (每个 src 最多 3 次, 不死循环)。仍是独立音轨, 绝不放视频声(尊重 W628b 画音分层)。
  (function installAudioStallWatchdog() {
    function watchOpen() {
      try { var wp = document.getElementById("watch-panel"); return !!wp && !wp.classList.contains("hidden") && getComputedStyle(wp).display !== "none"; }
      catch (_e) { return false; }
    }
    var lastT = -1, sameCount = 0, curSrc = "", reloads = 0, videoFallback = false;
    // W737B — 把当前播放中的视频解/复静音(.mp3 卡死时的兜底声源; 恢复则复静音, 防双声)。
    function setVideoFallback(on) {
      try {
        var vids = document.querySelectorAll("#watch-video, video");
        for (var i = 0; i < vids.length; i++) {
          var v = vids[i];
          if (!v) continue;
          if (on) { if (!v.paused && v.readyState >= 2) { v.muted = false; try { v.volume = 1; } catch (_e) {} } }
          else { v.muted = true; }
        }
      } catch (_e) {}
    }
    setInterval(function () {
      try {
        if (!watchOpen()) return;
        if (!(globalThis.__cssosWatchAudioUnlocked || globalThis.__cssosAudioUnlocked)) return;
        var a = document.getElementById("watch-audio-preview");
        if (!a) return;
        var src = String(a.currentSrc || a.src || "").trim();
        if (!src) { lastT = -1; sameCount = 0; return; }
        if (src !== curSrc) { curSrc = src; reloads = 0; lastT = -1; sameCount = 0; if (videoFallback) { setVideoFallback(false); videoFallback = false; } return; } // 换源→重置
        if (a.paused || a.ended || a.muted) return;            // 用户暂停/静音/播完 → 不干预
        if (a.readyState >= 2 && a.currentTime > 0) {          // .mp3 正常播
          lastT = a.currentTime; sameCount = 0;
          if (videoFallback) { setVideoFallback(false); videoFallback = false; } // .mp3 恢复 → 撤兜底, 防双声
          return;
        }
        // 此刻: 该响却 rs<2 或 t==0 → 疑似 stall
        if (a.currentTime === lastT) sameCount++; else { sameCount = 0; lastT = a.currentTime; }
        if (sameCount >= 2) {                                   // 连续 ~2.4s 不前进
          if (reloads < 6) {                                   // W737B — 重踢更狠: 重设 src + load + play, 最多 6 次
            reloads++;
            try { a.src = src; } catch (_e) {}                 // 重设 src 强制重新拉流(比单 load 更彻底)
            try { a.load && a.load(); } catch (_e) {}
            var p = a.play && a.play(); if (p && p.catch) p.catch(function () {});
            if (typeof globalThis.cssosAudioReferee === "function") { try { globalThis.cssosAudioReferee(a); } catch (_e) {} }
          } else if (!videoFallback) {
            // W737B — 重踢 6 次仍卡死 → 兜底: 解除正在播放视频的静音(此刻 .mp3 静默, 不会双声)。
            setVideoFallback(true); videoFallback = true;
          }
          sameCount = 0;
        }
      } catch (_e) {}
    }, 1200);
  })();

  // CSSOS_WAVE_587 — 全局音频解锁: 用户在页面任意一次手势后, 标记已解锁 → 之后切歌自动连播, 不再要求点击。
  (function () {
    if (globalThis.__cssosAudioUnlockWired) return;
    globalThis.__cssosAudioUnlockWired = true;
    // CSSOS_WAVE_588 — 统一两套解锁标记: 任意手势同时点亮 mv-language-pill 与 watch-ui 的旗标,
    // 否则一套解锁、另一套仍以为没交互 → 主播放器每歌静音。
    // CSSOS_WAVE_588x — Jing「播放时被静音、必须操作一下」根治: 第一次手势(页面任意处)不只点亮标记,
    // 还【立刻给当前卡住的 MV 解除静音 + 续播】—— 这首马上出声, 不用等切下一首, 也不用点特定按钮。
    var unlock = function () {
      globalThis.__cssosAudioUnlocked = true;
      globalThis.__cssosWatchAudioUnlocked = true;
      // CSSOS_WAVE_626 — Jing「现在静音、无法录屏」根治: 每次手势都救一次「卡在静音」的当前音频
      // (不再只首次)。用户绝不会"想要静音", 所以只要当前音频【被静音】或【标了 pending-unmute】,
      // 任意点击就立刻带声续播。注意: 只在 muted/pending 时介入, 不碰用户【主动暂停】(paused 但未静音)。
      try {
        var a = document.getElementById("watch-audio-preview");
        if (a && a.src && (a.muted || globalThis.__cssosWatchPendingUnmute)) {
          a.muted = false; try { a.volume = 1; } catch (_e) {}
          if (typeof globalThis.cssosAudioReferee === "function") globalThis.cssosAudioReferee(a);
          var p = a.play && a.play();
          if (p && p.catch) p.catch(function () {
            // 音频本身放不出(死链等)→ 回退视频原声, 绝不留静音。
            if (typeof globalThis.cssosFallbackToVideoAudio === "function") globalThis.cssosFallbackToVideoAudio("unlock-play-fail");
          });
        }
        globalThis.__cssosWatchPendingUnmute = false;
        // 收起「轻触出声」提示(若在显示)。
        if (typeof globalThis.hideWatchSoundHintModule === "function") globalThis.hideWatchSoundHintModule();
      } catch (_e) {}
      // CSSOS_WAVE_588y — 持久化「想要声音」意愿: 回头用户乐观直接试带声播。
      // 注意: 这不是浏览器许可证(策略仍可能每次加载要一次手势), 只是意愿提示 —
      // 真被拦仍会退到「一触出声」+ 提示, 绝不静默无声。
      try { localStorage.setItem("cssos:audioEngaged", "1"); } catch (_e) {}
    };
    ["pointerdown", "touchend", "click", "keydown"].forEach(function (ev) {
      try { document.addEventListener(ev, unlock, { capture: true, passive: true }); } catch (_e) {}
    });
    // CSSOS_WAVE_588y — 开机读取持久意愿: 之前互动过 → 标记 hint, 播放路径乐观直接试带声(不抑制提示)。
    try { if (localStorage.getItem("cssos:audioEngaged") === "1") globalThis.__cssosAudioEngagedHint = true; } catch (_e) {}
  })();

  // Full MV switch to a language track's audio (video stays).
  // take: 1 = audio_url (default), 2 = alt_audio_url
  function switchToLanguage(track, take) {
    if (!track || track.status !== "ready") return;
    take = (take === 2 && track.alt_audio_url) ? 2 : 1;
    var url = take === 2 ? track.alt_audio_url : track.audio_url;
    if (!url) return;
    _activeLang = track.lang;
    _activeVoice = String(track.voice || "auto");
    _activeTake = take;
    // CSSOS_WAVE_587 — 记住选择(本作品 + 全局上次), 下次播放自动恢复。
    try {
      var _p = JSON.stringify({ lang: _activeLang, voice: _activeVoice });
      localStorage.setItem("cssos:vpref:" + _workId, _p);
      localStorage.setItem("cssos:vpref:last", _p);
    } catch (_e) {}
    // The active line can't also be the 2nd subtitle — clear if conflict.
    if (_secondLang === track.lang) { _secondLang = null; _secondTimeline = null; }
    var audioEl = document.getElementById("watch-audio-preview");
    var videoEl = document.getElementById("watch-video");
    // W338 20260522 — Jing: 切换歌声时保留播放位置，从当前秒数接着唱.
    // 优先从正在播放的 audio 取时间; audio 没有就从 video 取.
    var resumeAt = 0;
    try {
      if (audioEl && audioEl.duration > 0 && !isNaN(audioEl.currentTime)) {
        resumeAt = audioEl.currentTime;
      } else if (videoEl && videoEl.duration > 0 && !isNaN(videoEl.currentTime)) {
        resumeAt = videoEl.currentTime;
      }
    } catch (_e) {}
    if (audioEl) {
      if (!audioEl.src || !audioEl.src.endsWith(url)) {
        audioEl.src = url;
        try { audioEl.load && audioEl.load(); } catch (_e) {}
        // CSSOS_WAVE_626 — 永不静音: 这条音轨若死链/加载失败, 回退播主视频原声。
        audioEl.addEventListener("error", function onAErr() {
          audioEl.removeEventListener("error", onAErr);
          if (typeof globalThis.cssosFallbackToVideoAudio === "function") globalThis.cssosFallbackToVideoAudio("track-audio-error");
        }, { once: true });
      }
      audioEl.muted = false; audioEl.volume = 1;
      // Seek to preserved position; clamp to new track duration once loadedmetadata.
      var seekWhenReady = function () {
        try {
          if (resumeAt > 0 && isFinite(audioEl.duration) && resumeAt < audioEl.duration) {
            audioEl.currentTime = resumeAt;
          } else if (resumeAt > 0) {
            // Duration not yet known — seek on first loadedmetadata.
            audioEl.addEventListener("loadedmetadata", function onMeta() {
              audioEl.removeEventListener("loadedmetadata", onMeta);
              try { if (resumeAt < audioEl.duration) audioEl.currentTime = resumeAt; } catch (_e) {}
            }, { once: true });
          }
        } catch (_e) {}
      };
      seekWhenReady();
    }
    // Keep video in sync at the same position (video = muted visuals).
    // CSSOS_WAVE_587c — 必须 muted=true(不是 volume=0): iOS/Safari 只让【静音】媒体自动播放;
    // volume=0 但未 muted 会被判定"有声"→ 自动播放被拦 → 所有多轨歌曲无声、要手势才响(严重回归)。
    // 守卫改事件驱动(referee 内), 不再每秒 timeupdate 那种把播放搞停的。
    if (videoEl) {
      try { videoEl.muted = true; } catch (_e) {}
      try { if (resumeAt > 0 && isFinite(videoEl.duration) && resumeAt < videoEl.duration) videoEl.currentTime = resumeAt; } catch (_e) {}
    }
    // CSSOS_WAVE_587 — 单音裁判: 切到这条音轨前, 先把页面上其它所有音视频【pause+静音】, 只留当前 audioEl 发声,
    // #watch-video 当画面(静音)。根治「点英文还在唱中文 / 多首歌同时在唱」(尤其中文烧在视频里时)。
    cssosAudioReferee(audioEl);
    var startVideo = function () { if (videoEl && videoEl.play) videoEl.play().catch(function () {}); };
    if (audioEl && audioEl.play) {
      // CSSOS_WAVE_587 — Jing「点一次后连续播放,别每歌必点」: play() 在源未就绪时会被拒(不是自动播放策略,
      // 是加载竞态)。被拒就【在 canplay 时自动重试】; 一旦解锁过(用户点过一次), 后续切歌绝不再要求点击。
      var tryPlay = function (allowCue) {
        var p = audioEl.play();
        if (p && p.then) p.then(function () { globalThis.__cssosAudioUnlocked = true; startVideo(); }).catch(function () {
          var onCanPlay = function () {
            audioEl.removeEventListener("canplay", onCanPlay);
            audioEl.play().then(function () { globalThis.__cssosAudioUnlocked = true; startVideo(); }).catch(function () {
              if (allowCue && !globalThis.__cssosAudioUnlocked) {
                if (videoEl) { try { videoEl.pause(); } catch (_e) {} }
                if (typeof globalThis.showToast === "function") globalThis.showToast(tt("Tap once to start — then it plays through.", "点一下开始 —— 之后整段连续播放。"));
              }
            });
          };
          audioEl.addEventListener("canplay", onCanPlay);
          // 兜底: 已就绪却没触发 canplay 时, 短延后再试一次。
          setTimeout(function () { if (!audioEl.paused) return; try { audioEl.play().then(function () { globalThis.__cssosAudioUnlocked = true; startVideo(); }).catch(function () {}); } catch (_e) {} }, 350);
        });
        else startVideo();
      };
      tryPlay(true);
    }
    // CSSOS_WAVE_442 — delegate karaoke/subtitle sync to emotion subtitle engine.
    // It fetches subtitle JSON (熟字幕 with per-char timing + emotion), feeds both
    // watchKaraokeTimelineCache and cssosKaraokeWords, then triggers re-render.
    // Falls back to Whisper timeline automatically if subtitle JSON unavailable.
    try {
      if (typeof globalThis.cssosEmotionSubtitle?.load === "function") {
        globalThis.cssosEmotionSubtitle.load(track, take);
      } else if (globalThis.watchKaraokeTimelineCache && Array.isArray(track.timeline)) {
        // Fallback if engine not yet loaded
        globalThis.watchKaraokeTimelineCache.data = track.timeline;
        globalThis.watchKaraokeTimelineCache.pending = false;
        globalThis.watchKaraokeTimelineCache.error = "";
      }
      // CSSOS_WAVE_434 — if ≥2 ready tracks, show merged lyrics; otherwise
      // show only the active track's lyrics (single-language fallback).
      var readyForMerge = _lastTracks.filter(function (t) { return t && t.status === "ready"; });
      if (readyForMerge.length >= 2) {
        // Re-order so active track is first (sets the section-header language).
        var ordered = [track].concat(readyForMerge.filter(function (t) { return t.lang !== track.lang; }));
        applyMergedLyrics(ordered);
      } else {
        // CSSOS_WAVE_436/440: write ONLY to the watch-panel DOM surface.
        // NEVER overwrite state.songSeed.lyrics.
        var _singleLyrics = resolveLyrics(track);
        if (_singleLyrics) {
          var le = document.getElementById("watch-lyrics-editor");
          if (le && "value" in le) le.value = _singleLyrics;
        }
      }
    } catch (_syncErr) { /* subtitle sync best-effort */ }
    // WAVE_444c: refresh lock-screen / Now Playing metadata on track switch
    try { globalThis.cssosMediaSession?.refresh(); } catch (_e) {}
    render(_lastTracks); // refresh active highlight
  }

  var _lastTracks = [];
  var _autoPlayedFirstReady = false; // W431: one-shot 先出先播 guard per work

  // CSSOS_WAVE_431 — auto-play the first ready language track when nothing is
  // playing yet (先出先播). NEVER interrupts existing playback.
  function isWatchMediaPlaying() {
    var v = document.getElementById("watch-video");
    var a = document.getElementById("watch-audio-preview");
    return !!((v && !v.paused && !v.ended && v.currentTime > 0) ||
              (a && !a.paused && !a.ended && a.currentTime > 0));
  }
  function maybeAutoPlayFirstReadyTrack(tracks) {
    if (_autoPlayedFirstReady) return;
    if (isWatchMediaPlaying()) { _autoPlayedFirstReady = true; return; } // already playing → don't fight
    var ready = (Array.isArray(tracks) ? tracks : []).filter(function (t) {
      return t && t.status === "ready" && (t.audio_url || t.alt_audio_url);
    });
    if (!ready.length) return;
    ready.sort(function (a, b) { return (a.track_order | 0) - (b.track_order | 0); });
    // CSSOS_WAVE_587 — 自动播放也要尊重【用户上次选的语言/声线】(本作品优先, 再全局上次), 否则胶囊高亮了
    // Jing 男高音、实际却自动播默认轨 → 不一致。偏好轨存在且就绪就播它, 否则才回落默认/首条。
    var pref = null;
    try { pref = JSON.parse(localStorage.getItem("cssos:vpref:" + _workId) || localStorage.getItem("cssos:vpref:last") || "null"); } catch (_e) { pref = null; }
    var prefTrack = pref && ready.find(function (t) {
      return t.lang === pref.lang && String(t.voice || "auto") === String(pref.voice || "auto");
    });
    var first = prefTrack || ready.filter(function (t) { return t.is_default; })[0] || ready[0];
    _autoPlayedFirstReady = true; // one-shot regardless of outcome
    try { switchToLanguage(first, 1); } catch (_e) {}
  }

  // ── CSSOS_WAVE_434 20260525 — Jing「多语言全输出」────────────────────
  // When a work has N ready language tracks (N≥2), merge ALL their lyrics
  // into a single interleaved document and show it in watch-lyrics-editor.
  // Each language contributes one "stanza block" per section, labelled by
  // its face code. Sections are split on double-newline OR [Header] lines.
  //
  // Format:
  //   [Verse 1]
  //   𐎤𐎢𐎽𐎢𐏁 …        ← peo
  //   Cyrus the Great…  ← en
  //   居鲁士大帝…        ← zh
  //
  //   [Chorus]
  //   …
  //
  // The MAIN karaoke line-1 keeps following the PLAYING track (word-level
  // Whisper timeline). Line-2 auto-pins to the 2nd ready track so the user
  // gets real-time dual subtitle without needing to long-press.
  // ── CSSOS_WAVE_440 20260525 — Lyrics JSON cache ──────────────────────────
  // The API now returns lyrics_json_url on every track (same URL for all tracks
  // of the same work). We fetch once and cache; on miss we fall back to
  // track.lyrics (old column — always present for backward compat).
  var _lyricsJsonCache = null;  // { url, data: LyricsJson } or null
  var _lyricsJsonFetching = false;

  // Convert a LyricsJson "sections" array back to the legacy lyrics text format
  // so all existing display code works unchanged.
  function sectionsToText(sections) {
    if (!sections || !sections.length) return "";
    return sections.map(function (s) {
      return "[" + s.tag + "]\n" + s.lines.join("\n");
    }).join("\n\n");
  }

  // Return raw lyrics text for a given language from the JSON cache, or null.
  function getLyricsFromCache(lang) {
    if (!_lyricsJsonCache || !_lyricsJsonCache.data) return null;
    var langEntry = (_lyricsJsonCache.data.languages || []).find(function (l) { return l.lang === lang; });
    if (!langEntry) return null;
    return sectionsToText(langEntry.sections || []);
  }

  // Ensure lyrics JSON is loaded. Calls cb() once data is available (or failed).
  function ensureLyricsJson(tracks, cb) {
    var url = tracks && tracks.length && tracks[0] && tracks[0].lyrics_json_url;
    if (!url) { cb(); return; }
    if (_lyricsJsonCache && _lyricsJsonCache.url === url) { cb(); return; }
    if (_lyricsJsonFetching) { cb(); return; }  // let current fetch finish
    _lyricsJsonFetching = true;
    fetch(url + "?t=" + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        _lyricsJsonCache = data ? { url: url, data: data } : null;
        _lyricsJsonFetching = false;
        cb();
      })
      .catch(function () { _lyricsJsonFetching = false; cb(); });
  }

  // Resolve lyrics text for a track: JSON cache first, track.lyrics fallback.
  function resolveLyrics(track) {
    var fromJson = getLyricsFromCache(track.lang);
    return fromJson !== null ? fromJson : (track.lyrics || "");
  }

  function splitSections(lyrics) {
    if (!lyrics) return [];
    // Split on blank lines (≥1 blank line = new section), preserving headers.
    return lyrics.split(/\n{2,}/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function buildMergedLyrics(readyTracks) {
    if (!readyTracks || readyTracks.length < 2) return null;
    // Each track → array of sections (use JSON cache if available).
    var perLang = readyTracks.map(function (t) {
      return { face: face(t.lang), sections: splitSections(resolveLyrics(t)) };
    });
    var maxSections = perLang.reduce(function (m, l) { return Math.max(m, l.sections.length); }, 0);
    if (!maxSections) return null;
    var out = [];
    for (var i = 0; i < maxSections; i++) {
      // If first language has a [Header] line, preserve it once.
      var header = "";
      var firstSection = (perLang[0].sections[i] || "");
      var headerMatch = firstSection.match(/^(\[[^\]]+\])/);
      if (headerMatch) header = headerMatch[1];

      var block = header ? [header] : [];
      perLang.forEach(function (l) {
        var sec = (l.sections[i] || "").trim();
        if (!sec) return;
        // Strip section header from non-first languages (avoid duplication).
        var bodyLines = sec.split("\n").filter(function (line) {
          return !/^\[[^\]]+\]$/.test(line.trim()); // remove standalone [Header] lines
        });
        // Prefix the lang face as a small label.
        if (bodyLines.length) {
          block.push("【" + l.face + "】 " + bodyLines.join("\n"));
        }
      });
      out.push(block.join("\n"));
    }
    return out.join("\n\n");
  }

  function applyMergedLyrics(readyTracks) {
    var merged = buildMergedLyrics(readyTracks);
    if (!merged) return;
    try {
      // CSSOS_WAVE_436: watch panel writes ONLY to its own DOM surface.
      // DO NOT touch state.songSeed.lyrics — that is the creation-panel's
      // mutable state and contaminating it causes previous-work lyrics to
      // appear in the next creation flow.
      var le = document.getElementById("watch-lyrics-editor");
      if (le && "value" in le) le.value = merged;
    } catch (_e) { /* best-effort */ }
  }

  // ── Dual subtitle (≤2) ────────────────────────────────────────────
  // Long-press / right-click a 🌐 pill to pin that language as the SECOND
  // subtitle line (shown under the active karaoke line). Long-press it
  // again (or pick another) to change; long-press the active language to
  // turn the second line off. Hard cap: the active playing language is
  // line 1, the pinned one is line 2 — never more than 2.
  var _secondLang = null;     // code pinned as 2nd subtitle, or null
  var _secondTimeline = null; // [{text,start_s,end_s}] for _secondLang
  var _dualRaf = 0;

  function ensureSecondLineEl() {
    var el = document.getElementById("watch-karaoke-line-2");
    if (el) return el;
    var anchor = document.getElementById("watch-karaoke-line");
    if (!anchor || !anchor.parentNode) return null;
    el = document.createElement("div");
    el.id = "watch-karaoke-line-2";
    el.className = "watch-karaoke-line-2";
    anchor.parentNode.insertBefore(el, anchor.nextSibling);
    return el;
  }

  function mediaClock() {
    var v = document.getElementById("watch-video");
    var a = document.getElementById("watch-audio-preview");
    var vt = Number((v && v.currentTime) || 0);
    var at = Number((a && a.currentTime) || 0);
    if (a && !a.paused && at > 0) return at;
    if (v && !v.paused && vt > 0) return vt;
    return Math.max(vt, at);
  }

  function cueAt(timeline, t) {
    if (!Array.isArray(timeline)) return "";
    // Group words into the line active at time t (word-level → join the
    // contiguous run whose [start,end] brackets t, fall back to nearest).
    var hit = null;
    for (var i = 0; i < timeline.length; i++) {
      var w = timeline[i];
      var s = Number(w.start_s || w.start || 0);
      var e = Number(w.end_s || w.end || s + 2);
      if (t >= s && t <= e) { hit = i; break; }
    }
    if (hit == null) return "";
    // Expand ±6 words around the hit for a readable line.
    var lo = Math.max(0, hit - 6), hi = Math.min(timeline.length, hit + 7);
    return timeline.slice(lo, hi).map(function (w) { return String(w.text || w.word || ""); }).join("").trim();
  }

  function dualLoop() {
    var el = document.getElementById("watch-karaoke-line-2");
    if (!_secondLang || !_secondTimeline) {
      if (el) el.textContent = "";
      _dualRaf = 0;
      return;
    }
    if (!el) el = ensureSecondLineEl();
    if (el) el.textContent = cueAt(_secondTimeline, mediaClock());
    _dualRaf = requestAnimationFrame(dualLoop);
  }

  function setSecondSubtitle(track) {
    if (!track || track.lang === _activeLang) {
      // turning off (picked active lang) or invalid
      _secondLang = null; _secondTimeline = null;
      var el = document.getElementById("watch-karaoke-line-2");
      if (el) el.textContent = "";
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tt("Dual subtitle off", "双语字幕关闭"));
      }
      render(_lastTracks);
      return;
    }
    _secondLang = track.lang;
    _secondTimeline = Array.isArray(track.timeline) ? track.timeline : null;
    if (!_dualRaf) _dualRaf = requestAnimationFrame(dualLoop);
    if (typeof globalThis.showToast === "function") {
      globalThis.showToast(tt("Dual subtitle: ", "双语字幕：") + face(track.lang));
    }
    render(_lastTracks);
  }

  // CSSOS_WAVE_433 20260525 — Jing「真进度」: a genuine progress caption at the
  // bottom-left of the watch screen showing WHICH language is being produced, the
  // STAGE, a REAL percentage, cover N/total, and the duration once a track lands.
  // Driven entirely by the backend's per-stage stage/progress_pct + cover counts —
  // never a fake bar. Shows while anything is pending/rendering; hides when all done.
  function stageLabel(stage) {
    switch (String(stage || "")) {
      case "lyrics":  return tt("writing lyrics", "歌词");
      case "music":   return tt("composing vocals", "演唱");
      case "align":   return tt("aligning subtitles", "字幕对齐");
      case "persist": return tt("finalizing", "收尾");
      case "ready":   return tt("ready", "完成");
      default:        return tt("queued", "排队中");
    }
  }
  function fmtDur(s) {
    var n = Number(s) || 0;
    if (n <= 0) return "";
    return Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0");
  }
  function renderProgressCaption(tracks, coverDone, coverTotal) {
    var screen = watchScreen();
    if (!screen) return;
    var list = Array.isArray(tracks) ? tracks : [];
    var active = list.filter(function (t) {
      if (!t || (t.status !== "rendering" && t.status !== "pending")) return false;
      // CSSOS_WAVE_1085 — Jing「左下角永驻 queued 0% 角标」: 已有音频的轨= 实际可播,
      //   绝不当作待渲染(回填灌了音频却没把 status 翻成 ready → 进度条永显假 queued)。
      if (t.audio_url || t.url || t.audioUrl || t.preview_audio_url || t.alt_audio_url) return false;
      return true;
    }).sort(function (a, b) { return (a.track_order | 0) - (b.track_order | 0); })[0];
    var el = document.getElementById("cssos-mv-progress");
    if (!active) {
      // Nothing generating → remove the caption (a brief "just finished" toast is
      // already handled by the pill lighting up + auto-play).
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = "cssos-mv-progress";
      el.style.cssText = [
        "position:absolute", "left:12px", "bottom:170px", "z-index:28",
        "max-width:calc(100% - 24px)", "pointer-events:none",
        "padding:7px 12px", "border-radius:12px",
        "background:rgba(8,18,16,0.62)", "-webkit-backdrop-filter:blur(10px)",
        "backdrop-filter:blur(10px)", "border:1px solid rgba(0,245,160,0.28)",
        "color:#eafff6", "font:600 12px/1.35 -apple-system,system-ui,sans-serif",
        "box-shadow:0 6px 20px rgba(0,0,0,0.4)",
      ].join(";");
      el.innerHTML = '<div class="cssos-mvp-line" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>' +
        '<div style="margin-top:5px;height:3px;border-radius:2px;background:rgba(255,255,255,0.15);overflow:hidden;">' +
        '<span class="cssos-mvp-fill" style="display:block;height:100%;width:0%;background:linear-gradient(90deg,#00f5a0,#0bf7ff);transition:width .4s ease;"></span></div>';
      screen.style.position = screen.style.position || "relative";
      screen.appendChild(el);
    }
    var pct = Math.max(0, Math.min(100, Number(active.progress_pct) || 0));
    var langTxt = face(active.lang);
    var line = "🎼 " + langTxt + " · " + stageLabel(active.stage) + " " + pct + "%";
    // Cover-pool progress (shared, not per-language) while frames still generate.
    var cd = Number(coverDone) || 0, ctot = Number(coverTotal) || 0;
    if (ctot > 0 && cd < ctot) line += "  ·  🖼 " + cd + "/" + ctot;
    var readyCount = list.filter(function (t) { return t && t.status === "ready"; }).length;
    if (readyCount > 0) {
      var lastReady = list.filter(function (t) { return t && t.status === "ready"; })
        .sort(function (a, b) { return (b.track_order | 0) - (a.track_order | 0); })[0];
      var d = fmtDur(lastReady && lastReady.duration_secs);
      line += "  ·  ✓ " + readyCount + (d ? " (" + d + ")" : "");
    }
    var lineEl = el.querySelector(".cssos-mvp-line");
    if (lineEl) lineEl.textContent = line;
    var fillEl = el.querySelector(".cssos-mvp-fill");
    if (fillEl) fillEl.style.width = pct + "%";
  }

  function render(tracks) {
    _lastTracks = Array.isArray(tracks) ? tracks : [];
    var screen = watchScreen();
    if (!screen) return;
    // CSSOS_WAVE_583 20260531 — Jing「有操作必显多语言选择器, 哪怕只有 1 种语言 —— 引导加语言→平台收入」。
    // 此前 <2 语言时移除整条 bar; 现在【始终渲染】(至少母语 1 颗), app.lang-flag-pills.js 会给单语言追加
    // ➕加语言 / ✨做多语言 引导胶囊。仅当一首语言都没有(异常)才不渲染。
    var meaningful = _lastTracks.filter(function (t) { return t && t.lang; });
    if (meaningful.length < 1) {
      var bar0 = document.getElementById("watch-language-pill");
      if (bar0 && bar0.parentNode) bar0.parentNode.removeChild(bar0);
      return;
    }

    // CSSOS_WAVE_437 — Fix 1: update panel-bar title with work title.
    // The .panel-title always showed the generic "MV Panel" string.
    // When a work is loaded, overwrite it with the actual title so the
    // panel bar reads the real song name instead of "Watch".
    try {
      var titleEl = document.querySelector("#watch-panel .panel-title");
      var workTitle = (typeof globalThis.cssosMvPipelinePanelState === "function")
        ? (globalThis.cssosMvPipelinePanelState()?.title || "")
        : "";
      if (!workTitle) {
        workTitle = document.getElementById("watch-title-text")?.textContent?.trim() || "";
      }
      if (titleEl && workTitle) titleEl.textContent = workTitle;
    } catch (_e) {}

    var bar = document.getElementById("watch-language-pill");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "watch-language-pill";
      bar.className = "cssmv-pill-bar watch-language-pill";
      // CSSOS_WAVE_437 — Fix 2: position at BOTTOM-RIGHT (not inside the screen
      // where it conflicts with the panel-bar close/cinema buttons at top).
      // Use inline style: bottom:12px right:12px; the pill is inside .watch-screen
      // which is position:relative. Cinema idle-hide rules in app.watch-ui.js
      // already reference #watch-language-pill so auto-hide still works.
      // CSSOS_WAVE_1258 20260628 — 撤回 W1257 的 absolute 居中。W1257 想让胶囊「底部居中」, 但用
      //   position:absolute 直接挂 .watch-screen = [[lang_voice_pill_center_rootcause]] (W1110) 点名的
      //   「胶囊总跑中央/浮在视频上」反模式: 收编前/收编失败时 bar 就绝对居中浮在视频上。
      //   正解(保留 W1257 的"底部居中"意图): bar 不自定位, 交给 #cssos-lang-fold 底部栈
      //   (#cssos-watch-bottomflow align-items:center 本就底部居中)收编。只保留轨道横滚/不换行。
      bar.style.cssText = [
        "position:static",
        "overflow-x:auto",
        "flex-wrap:nowrap",
      ].join(";");
      // screen 保持 relative(别的 absolute 层如情绪字幕靠它定位, 绝不动)。
      screen.style.position = screen.style.position || "relative";
      // 优先直接进底部 fold 栈(若已建); 否则退到 screen, 由 lang-flag-pills 的 enhance() 幂等收编进 fold。
      var _langFold = document.getElementById("cssos-lang-fold");
      if (_langFold) _langFold.appendChild(bar);
      else screen.appendChild(bar);
    }
    // Default active = is_default track, else first ready, else first.
    if (!_activeLang) {
      // CSSOS_WAVE_587 — 记住用户上次的选择: 优先恢复本作品偏好, 再退而求其次用全局上次偏好,
      // 只要该 (语言, 声线) 在本作品里存在且就绪。否则才用默认轨。
      var pref = null;
      try { pref = JSON.parse(localStorage.getItem("cssos:vpref:" + _workId) || localStorage.getItem("cssos:vpref:last") || "null"); } catch (_e) { pref = null; }
      var prefTrack = pref && meaningful.find(function (t) {
        return t.status === "ready" && t.lang === pref.lang && String(t.voice || "auto") === String(pref.voice || "auto");
      });
      if (prefTrack) { _activeLang = prefTrack.lang; _activeVoice = String(prefTrack.voice || "auto"); }
      else {
        var def = meaningful.find(function (t) { return t.is_default; })
          || meaningful.find(function (t) { return t.status === "ready"; })
          || meaningful[0];
        _activeLang = def && def.lang;
      }
    }

    // CSSOS_WAVE_437 — suppress legacy ♪1/♪2 toggle (now unified here)
    suppressLegacyTakeToggle();

    // CSSOS_WAVE_434 — multi-language lyrics display ─────────────────
    var readyTracks = meaningful.filter(function (t) { return t.status === "ready"; });
    if (readyTracks.length >= 2) {
      applyMergedLyrics(readyTracks);
      var autoSecond = readyTracks.find(function (t) { return t.lang !== _activeLang; });
      if (autoSecond && _secondLang !== autoSecond.lang) {
        _secondLang = autoSecond.lang;
        _secondTimeline = Array.isArray(autoSecond.timeline) ? autoSecond.timeline : null;
        if (!_dualRaf) _dualRaf = requestAnimationFrame(dualLoop);
      }
    }

    // CSSOS_WAVE_587 — 二维交叉 cell 渲染 ──────────────────────────────
    // 一条轨, 两个模式(lang/voice)。render 把所有 cell 都建出来(打 data-lang/
    // data-voice + class cssos-cell-lang / cssos-cell-voice), 由 app.lang-flag-pills.js
    // 的模式胶囊按当前模式 show/hide。这样切模式无需重渲染、不打断播放。
    //   · 语言 cell: 每种语言一颗(原声线 = voice 'auto' 或 is_default 或首个)。
    //   · 声线 cell: 仅【当前激活语言】的各声线(含原声 'auto')。
    bar.innerHTML = "";

    // CSSOS_WAVE_587 — 二维透视表(双向联动)。激活 = (语言, 声线) 一个格子。
    //   · 🌐多语言 cell = 全部语言(可随时换语言); 点击 → 切到(该语言, 当前声线)若存在, 否则该语言的原声。
    //   · 🎤多声线 cell = 全部声线(可随时换声线); 点击 → 切到(当前语言, 该声线)若存在, 否则任一拥有该声线的语言。
    //   · 计数互钉对方那一轴: 🌐 显示【当前声线有几种语言】, 🎤 显示【当前语言有几种声线】。
    function vof(t) { return String(t.voice || "auto"); }
    function trackAt(lang, voice) {
      return meaningful.find(function (t) { return t.lang === lang && vof(t) === voice; }) || null;
    }
    // 按首次出现顺序去重(语言/声线)。
    var distinctLangs = [], distinctVoices = [], langSeen = {}, vSeen = {};
    meaningful.slice().sort(function (a, b) { return (a.track_order | 0) - (b.track_order | 0); })
      .forEach(function (t) {
        if (!langSeen[t.lang]) { langSeen[t.lang] = 1; distinctLangs.push(t.lang); }
        var v = vof(t); if (!vSeen[v]) { vSeen[v] = 1; distinctVoices.push(v); }
      });
    // 'auto'(原声)永远排第一。
    distinctVoices.sort(function (a, b) { return (a === "auto" ? -1 : 0) - (b === "auto" ? -1 : 0); });

    // 钳制激活态在现有格子内。
    if (distinctLangs.indexOf(_activeLang) < 0) _activeLang = distinctLangs[0] || _activeLang;
    if (!trackAt(_activeLang, _activeVoice)) {
      // 当前语言没有当前声线 → 回落到该语言的原声(auto 优先)。
      var fallback = trackAt(_activeLang, "auto") || meaningful.find(function (t) { return t.lang === _activeLang; });
      _activeVoice = fallback ? vof(fallback) : "auto";
    }

    function mkCell(target, opts) {
      var ready = target && target.status === "ready";
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.lang = opts.lang;
      b.dataset.voice = opts.voice;
      b.dataset.take = "1";
      b.className = opts.cls;
      b.disabled = !ready;
      if (!ready) {
        var st = target && target.status;
        b.textContent = opts.faceTxt + (st === "pending" ? " ⋯" : st === "rendering" ? " ◌" : target ? " ⚠" : "");
      } else {
        b.textContent = opts.faceTxt;
      }
      b.title = ready ? opts.faceTxt
        : (target && target.status === "failed" ? tt("Render failed", "渲染失败")
           : target ? tt("Rendering…", "渲染中…") : tt("Not made yet", "尚未生成"));
      if (ready) {
        b.addEventListener("click", function () { switchToLanguage(target, 1); render(_lastTracks); });
        b.addEventListener("contextmenu", function (ev) { ev.preventDefault(); setSecondSubtitle(target); });
        var _lpTimer = null;
        b.addEventListener("touchstart", function () {
          _lpTimer = setTimeout(function () { setSecondSubtitle(target); }, 550);
        }, { passive: true });
        var _clr = function () { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } };
        b.addEventListener("touchend", _clr);
        b.addEventListener("touchmove", _clr);
      }
      return b;
    }

    // CSSOS_WAVE_678m — 二维交叉计数(Jing): 语言 cell 标【该语言有几声线 🎤N】; 声线 cell 标【该声线有几语言 🌐N】。
    // 仅 >1 时显示(单选不啰嗦)。max-content 列自适应容得下, 凹咬靠固定 +20 重叠不受影响。
    function voicesForLang(lang) { return distinctVoices.filter(function (v) { return !!trackAt(lang, v); }).length; }
    function langsForVoice(voice) { return distinctLangs.filter(function (l) { return !!trackAt(l, voice); }).length; }

    // 🌐语言 cell: 每种语言一颗。目标 = (lang, 当前声线)若存在, 否则该语言原声。
    // 二维计数存 dataset(faceTxt 保持干净), 由 app.lang-flag-pills 重排时读出补计数小 span(否则重排会丢)。
    distinctLangs.forEach(function (lang) {
      var target = trackAt(lang, _activeVoice) || trackAt(lang, "auto")
        || meaningful.find(function (t) { return t.lang === lang; });
      var b = mkCell(target, { cls: "cssos-cell cssos-cell-lang", lang: lang, voice: target ? vof(target) : "auto", faceTxt: face(lang) });
      b.dataset.xcount = String(voicesForLang(lang)); b.dataset.xkind = "voice"; // 该语言有几声线
      if (target && target.status === "ready" && lang === _activeLang) b.classList.add("active");
      bar.appendChild(b);
    });

    // 🎤声线 cell: 每种声线一颗。目标 = (当前语言, voice)若存在, 否则任一拥有该声线的(就绪)语言。
    distinctVoices.forEach(function (voice) {
      var target = trackAt(_activeLang, voice)
        || meaningful.find(function (t) { return vof(t) === voice && t.status === "ready"; })
        || meaningful.find(function (t) { return vof(t) === voice; });
      var b = mkCell(target, { cls: "cssos-cell cssos-cell-voice", lang: target ? target.lang : _activeLang, voice: voice, faceTxt: voice });
      b.dataset.xcount = String(langsForVoice(voice)); b.dataset.xkind = "lang"; // 该声线有几语言
      if (target && target.status === "ready" && voice === _activeVoice && target.lang === _activeLang) b.classList.add("active");
      bar.appendChild(b);
    });

    // 双向计数存到 dataset, 由 app.lang-flag-pills.js 的 paintModeSwitch 读取上屏。
    var langsForVoice = distinctLangs.filter(function (l) { return !!trackAt(l, _activeVoice); }).length;
    var voicesForLang = distinctVoices.filter(function (v) { return !!trackAt(_activeLang, v); }).length;
    bar.dataset.nLang = String(langsForVoice);   // 🌐 显示: 当前声线有几种语言
    bar.dataset.nVoice = String(voicesForLang);  // 🎤 显示: 当前语言有几种声线
    bar.dataset.originVoice = _originVoice;       // CSSOS_WAVE_587 — auto 颗标真实声线名(如女声)
  }

  async function poll() {
    if (!_workId) return;
    try {
      var r = await fetch("/api/works/" + encodeURIComponent(_workId) + "/language-tracks", {
        credentials: "include",
      });
      var j = await r.json();
      if (j && j.ok) {
        var tracks = j.tracks || [];
        _originVoice = String(j.origin_voice || ""); // CSSOS_WAVE_587
        // CSSOS_WAVE_440 — ensure lyrics JSON is cached before rendering so
        // resolveLyrics() has data when called from render() / switchToLanguage().
        ensureLyricsJson(tracks, function () { render(tracks); });
        // CSSOS_WAVE_431 20260525 — Jing「哪个引擎输出完毕就播放哪个(先出先播), 又失效了」:
        // when the FIRST language track reaches 'ready' and NOTHING is playing yet,
        // auto-play it. Conservative: never fights existing playback (if audio/video
        // already plays we just mark done), one-shot per work.
        try { maybeAutoPlayFirstReadyTrack(tracks); } catch (_e) {}
        // CSSOS_WAVE_433 20260525 — Jing「要真进度」: render the genuine per-stage
        // progress caption (which language · stage · % · cover N/total · duration).
        try { renderProgressCaption(tracks, j.cover_done, j.cover_total); } catch (_e) {}
        var pending = tracks.some(function (t) {
          return t.status === "pending" || t.status === "rendering";
        });
        stopPoll();
        if (pending) _pollTimer = setTimeout(poll, POLL_MS);
      }
    } catch (_e) {
      stopPoll();
      _pollTimer = setTimeout(poll, POLL_MS * 2);
    }
  }

  // CSSOS_WAVE_437 — Fix 1b: also update panel title on every mount so
  // even single-language works (which never reach render()) get the title.
  function updatePanelTitle() {
    try {
      var titleEl = document.querySelector("#watch-panel .panel-title");
      if (!titleEl) return;
      var t = "";
      if (typeof globalThis.cssosMvPipelinePanelState === "function") {
        t = (globalThis.cssosMvPipelinePanelState()?.title || "").trim();
      }
      if (!t) t = (document.getElementById("watch-title-text")?.textContent || "").trim();
      if (!t) {
        // Fall back to the share-info-chip title which is always accurate.
        var chip = document.getElementById("watch-share-info-chip");
        var chipTitle = chip?.querySelector("[data-share-title]")?.textContent?.trim();
        if (chipTitle) t = chipTitle;
      }
      if (t) titleEl.textContent = t;
    } catch (_e) {}
  }

  globalThis.cssosMountLanguagePill = function (workId) {
    if (!workId) { unmount(); return; }
    // CSSOS_WAVE_630 — 合成部件(…__part_N)归一到 root, 否则 /language-tracks 收 400 → 无音轨 → 无声。
    if (typeof globalThis.cssosRootWorkId === "function") workId = globalThis.cssosRootWorkId(workId);
    updatePanelTitle();
    suppressLegacyTakeToggle();
    if (_workId === workId) { poll(); return; }
    unmount();
    _workId = String(workId);
    _activeLang = null; _activeTake = 1;
    // CSSOS_WAVE_413 20260524 — Jing「接通多语言生成触发」: the language picker only
    // PRICED the selection; nothing ever POSTed it, so the paid tracks silently
    // never generated. When a freshly-created work mounts its pill, fire the
    // non-default languages at /api/works/:id/language-tracks ONCE. The default
    // (mother tongue / 1st) track is already the work's free main MV, so we send
    // only the extras. Server is idempotent (ON CONFLICT DO NOTHING) and gates
    // tier/balance, so a stray double-call is harmless.
    try { kickPendingLanguageTracks(_workId); } catch (_e) {}
    poll();
  };
  globalThis.cssosUnmountLanguagePill = unmount;

  // Consume a one-shot pending selection stashed at creation time.
  async function kickPendingLanguageTracks(workId) {
    var pend = globalThis.__cssosPendingLangTracks;
    if (!pend || !Array.isArray(pend.languages) || pend.languages.length < 2) return;
    // Only honor a FRESH stash (created at this creation flow), so replaying an
    // old work never re-triggers paid generation.
    if (!pend.ts || (Date.now() - pend.ts) > 10 * 60 * 1000) {
      globalThis.__cssosPendingLangTracks = null;
      return;
    }
    // Consume immediately (one-shot) to prevent re-fire on re-mount/poll.
    globalThis.__cssosPendingLangTracks = null;
    var mother = String(pend.languages[0] || "").toLowerCase();
    var extras = pend.languages
      .map(function (c) { return String(c || "").toLowerCase().trim(); })
      .filter(function (c, i) { return c && i > 0 && c !== mother; });
    // De-dupe.
    var seen = {}; extras = extras.filter(function (c) { return seen[c] ? false : (seen[c] = true); });
    if (!extras.length) return;
    try {
      var r = await fetch("/api/works/" + encodeURIComponent(workId) + "/language-tracks", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languages: extras, source_lang: mother }),
      });
      var j = await r.json().catch(function () { return null; });
      if (j && j.ok) {
        // Surface progress: poll immediately so the 🌐 pill shows the new
        // languages rendering.
        poll();
      }
    } catch (_e) { /* additive — never block playback */ }
  }
})();
