/* CSSOS_WAVE_653 20260606 — 单一音频权威(Single Audio Authority).
 * ----------------------------------------------------------------
 * 断根: 历史上 watchAudioPreview 有【多个独立设源者】(语言胶囊 / 生成管线 final-audio /
 * watch-ui 自身多处), 互不协调 → 切歌时音频源【串台】(残留上一作品的 aud-)、新源卡在
 * readyState=0【从不加载】(= 用户"每首要点一下"才响)、还可能边播边被别处掐(断断续续)。
 *
 * 本模块是 watchAudioPreview 的【唯一协调者】: 按【当前 workId】解析"这首该放哪条音频", 强制
 * 清旧→设新→load()→(有手势/原生)play()+重试, 并保证视频静音(分离作品声音走 audio)。挂在
 * cssos:work-id-changed + 一个低频安全 tick(感知 DOM 当前作品 + 救活卡死源)。
 *
 * 零手势铁律: 原生 App(html.cssos-app)允许无手势出声(MainViewController killswitch, W370),
 * 故原生下不静音; Web 首次手势前静音占位(浏览器策略), 任一手势(本模块全局捕获)→ 标记
 * cssos:audioEngaged 并解静音, 之后【每首自动出声、零点击】。 */
(function () {
  "use strict";

  var _enforcedWork = "";
  var _enforcedUrl = "";
  var _enforcedOrigUrl = "";   // 全混(原唱)
  var _enforcedInstrUrl = "";  // 伴奏(卡拉 OK)
  var _busy = false;
  var _seq = 0;

  // CSSOS_WAVE_672 ① — 卡拉 OK: 读用户 stem 偏好(与 overlays 同一 key)。
  function stemPref() { try { return localStorage.getItem("cssmv.stemPreference") === "instrumental" ? "instrumental" : "vocals"; } catch (e) { return "vocals"; } }
  function matchUrl(cur, u) { return !!u && (cur === u || cur.endsWith(u)); }
  // 当前音频是否还在【本作品的某个 stem 上】(原唱 OR 伴奏)→ 用户切人声/伴奏不算"跑偏", 看门狗不夺回。
  function onTrack(cur) { return matchUrl(cur, _enforcedOrigUrl) || matchUrl(cur, _enforcedInstrUrl); }

  function aEl() { return document.getElementById("watch-audio-preview"); }
  function vEl() { return document.getElementById("watch-video"); }
  function isNativeApp() { try { return document.documentElement.classList.contains("cssos-app"); } catch (e) { return false; } }
  function engaged() { try { return localStorage.getItem("cssos:audioEngaged") === "1"; } catch (e) { return false; } }
  function soundAllowed() { return engaged() || isNativeApp(); }
  function rootId(id) { try { return (typeof globalThis.cssosRootWorkId === "function") ? globalThis.cssosRootWorkId(id) : id; } catch (e) { return id; } }
  function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || "")); }
  function domWorkId() { try { var wp = document.getElementById("watch-panel"); return wp ? String(wp.dataset.activeWorkId || "").trim() : ""; } catch (e) { return ""; } }

  // 与语言胶囊一致的选轨: 用户语言偏好 > is_default > 首个 ready 且有音频。
  function pickTrack(tracks, workId) {
    var ready = (tracks || []).filter(function (t) { return t && t.status === "ready" && (t.audio_url || t.alt_audio_url); });
    if (!ready.length) return null;
    var pref = null;
    try { pref = JSON.parse(localStorage.getItem("cssos:vpref:" + workId) || "null"); } catch (e) { pref = null; }
    if (pref && pref.lang) {
      for (var i = 0; i < ready.length; i++) {
        if (ready[i].lang === pref.lang) {
          return { track: ready[i], take: (pref.take === 2 && ready[i].alt_audio_url) ? 2 : 1 };
        }
      }
    }
    var def = null;
    for (var j = 0; j < ready.length; j++) { if (ready[j].is_default) { def = ready[j]; break; } }
    return { track: def || ready[0], take: 1 };
  }

  // CSSOS_WAVE_667 — 硬解静音锁: 一旦允许出声(原生 / 已交互), 把音频元素的 muted 属性【锁死为 false】,
  // 任何散落代码(watch-ui / 语言胶囊 / up-next / market 等)再写 a.muted=true 都被强制翻回 false。
  // 这是"把所有的静音都删除掉"的单一收口 —— 断绝多方抢改 .muted 导致的"放不出声/断断续续"(任务 #40)。
  function installUnmuteLock(a) {
    if (!a || a.__cssosUnmuteLocked) return;
    try {
      var d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "muted");
      if (!d || !d.set) return;
      a.__cssosUnmuteLocked = true;
      try { d.set.call(a, false); } catch (e) {}
      Object.defineProperty(a, "muted", {
        configurable: true,
        get: function () { return false; },
        set: function () { try { d.set.call(a, false); } catch (e) {} }
      });
    } catch (e) {}
  }

  // CSSOS_WAVE_1676 — 让位契约: 当某个 UI(波形逐字精修等)明确表达「用户要停」时置
  //   globalThis.cssosAudioIntentPaused=true, 本模块的救活逻辑必须闭嘴。否则 1.5s 安全 tick
  //   + 这里的 320ms 重试会把用户的暂停一次次 play() 回来 —— 正是 Jing「现在无法暂停」。
  function intentPaused() { try { return !!globalThis.cssosAudioIntentPaused; } catch (e) { return false; } }

  function tryPlay(a, mySeq) {
    if (!a || mySeq !== _seq) return;
    if (intentPaused()) return;
    try {
      var p = a.play();
      if (p && p.catch) {
        p.catch(function () {
          if (soundAllowed() && mySeq === _seq && !intentPaused()) {
            setTimeout(function () { try { if (mySeq === _seq && a.paused && !intentPaused()) a.play().catch(function () {}); } catch (e) {} }, 320);
          }
        });
      }
    } catch (e) {}
  }

  async function enforce(rawId) {
    var workId = rootId(String(rawId || "").trim());
    if (!isUuid(workId) || _busy) return;
    _busy = true;
    var mySeq = ++_seq;
    try {
      var a = aEl(), v = vEl();
      if (!a) return;
      if (soundAllowed()) installUnmuteLock(a);   // 允许出声 → 锁死不被任何代码再静音
      var tracks = null;
      try {
        var resp = await fetch("/api/works/" + encodeURIComponent(workId) + "/language-tracks");
        tracks = (await resp.json()).tracks;
      } catch (e) { tracks = null; }
      if (mySeq !== _seq) return; // 期间又切歌 → 放弃本次, 让最新的赢
      var sel = pickTrack(tracks, workId);
      if (!sel) { _enforcedWork = workId; _enforcedUrl = ""; _enforcedOrigUrl = ""; _enforcedInstrUrl = ""; return; } // 无分离音频 → 不接管(留旧路径)
      var orig = sel.take === 2 ? sel.track.alt_audio_url : sel.track.audio_url;
      if (!orig) return;
      var instr = String(sel.track.instrumental_url || "");
      // CSSOS_WAVE_672 ① — 给前端「Vocals/Instrumental」胶囊喂源(resolveStemUrls 读这俩全局)。
      try { globalThis.currentPreviewAudioOriginalUrl = orig; globalThis.currentPreviewAudioInstrumentalUrl = instr; } catch (e) {}
      // 卡拉 OK 偏好: 用户选了伴奏 → 本作品(及后续每首)都放伴奏。无伴奏则回退原唱。
      var url = (stemPref() === "instrumental" && instr) ? instr : orig;
      _enforcedOrigUrl = orig; _enforcedInstrUrl = instr;
      if (v) { try { v.muted = true; } catch (e) {} } // 分离作品: 视频永远静音, 声音只走 audio
      var cur = String(a.currentSrc || a.src || "").trim();
      // 已在本作品任一 stem(原唱/伴奏)上 → 视为同源, 不重置(别打断用户的卡拉 OK 切换)。
      var same = !!cur && (matchUrl(cur, url) || onTrack(cur));
      if (!same) {
        try { a.pause(); } catch (e) {}
        a.src = url;
        a.loop = false; a.playsInline = true; a.volume = 1;
        a.muted = !soundAllowed();
        a.style.display = "block";
        try { a.load(); } catch (e) {}
      } else {
        if (soundAllowed() && a.muted) { try { a.muted = false; } catch (e) {} }
        if (a.readyState === 0) { try { a.load(); } catch (e) {} }
      }
      if (a.paused) tryPlay(a, mySeq);
      _enforcedWork = workId;
      _enforcedUrl = url;
      // CSSOS_WAVE_667b — 起播看门狗: "爆一个音就没声"= 别处在起播后立刻换源/暂停掐掉。
      // 起播后短窗内多次复核: 源被换走→夺回(重设+load); 被暂停→续播。断"多设源者"互掐。
      [150, 400, 800, 1300, 2000].forEach(function (ms) {
        setTimeout(function () {
          try {
            if (mySeq !== _seq) return;            // 期间真的切歌了 → 不抢
            var aa = aEl(); if (!aa) return;
            var cur = String(aa.currentSrc || aa.src || "").trim();
            // 仍在本作品某 stem(原唱/伴奏)上 = 没跑偏(用户切卡拉 OK 不算)。只有真换走才夺回。
            var drifted = !(cur && (matchUrl(cur, url) || onTrack(cur)));
            if (drifted) { try { aa.pause(); } catch (e) {} aa.src = url; aa.volume = 1; if (soundAllowed()) installUnmuteLock(aa); try { aa.load(); } catch (e) {} tryPlay(aa, mySeq); return; }
            if (soundAllowed() && aa.paused) tryPlay(aa, mySeq);
          } catch (e) {}
        }, ms);
      });
    } finally {
      _busy = false;
    }
  }

  // 切歌事件 → 强制(略延时, 等视频/面板就位)。
  window.addEventListener("cssos:work-id-changed", function (ev) {
    var id = ev && ev.detail && ev.detail.workId;
    if (id) setTimeout(function () { enforce(id); }, 250);
  });

  // 安全 tick(1.5s): ① DOM 当前作品变了却没收到事件 → 补一刀; ② 正确源卡死(rs=0/paused 且
  // 允许出声)→ 救活(补上缺失的 load/play, 这正是"用户一点才响"那一脚)。低频, 不抢源。
  setInterval(function () {
    try {
      var dom = rootId(domWorkId());
      if (isUuid(dom) && dom !== _enforcedWork && !_busy) { enforce(dom); return; }
      var a = aEl();
      if (!a || !_enforcedUrl) return;
      var cur = String(a.currentSrc || a.src || "").trim();
      if (cur && onTrack(cur)) {   // 本作品原唱或伴奏都算"正确源"(卡拉 OK 不被救活逻辑打断)
        if (soundAllowed() && a.muted) { try { a.muted = false; } catch (e) {} }
        // W1676 — 用户明确要停时, 整个"救活"分支跳过(连 load() 也别做, 免得又抖一下)。
        if (!intentPaused() && soundAllowed() && (a.readyState === 0 || a.paused)) {
          if (a.readyState === 0) { try { a.load(); } catch (e) {} }
          tryPlay(a, _seq);
        }
      }
    } catch (e) {}
  }, 1500);

  // 手势捕获: 任一交互 → 记 audioEngaged + 立即解静音当前音频。之后每首自动出声、零点击。
  function markEngaged() {
    try { localStorage.setItem("cssos:audioEngaged", "1"); } catch (e) {}
    var a = aEl();
    if (a) {
      installUnmuteLock(a);   // 手势即解锁: 之后永不被静音
      if (a.muted) { try { a.muted = false; } catch (e) {} }
      if (a.paused) tryPlay(a, _seq);
    }
    var v = vEl();
    if (v) { try { v.muted = true; } catch (e) {} }
  }
  ["pointerdown", "touchstart", "keydown"].forEach(function (evt) {
    try { window.addEventListener(evt, markEngaged, { capture: true, passive: true }); } catch (e) {}
  });

  // W1740 — Jing「加空格键: 暂停/续播, 方便微调字幕」。全局 Space = 切当前作品音频播放/暂停。
  //   尊重让位契约: 用户停 → cssosAudioIntentPaused=true(权威不再救活), 续 → false。
  //   让行: 输入框/可编辑元素(别吞打字)、按钮/链接(让它们自己响应 Space)、波形编辑器(它自管 Space)。
  //   只在确有作品音频(有源)时接管, 免得在纯落地页吞掉空格。冒泡阶段, 不与聚焦控件抢。
  document.addEventListener("keydown", function (e) {
    if (e.key !== " " && e.key !== "Spacebar") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable ||
              t.tagName === "BUTTON" || t.tagName === "A" ||
              (t.getAttribute && t.getAttribute("role") === "button"))) return;
    if (document.getElementById("cssos-wave-editor")) return;   // 波形编辑器自管 Space
    var a = aEl();
    if (!a || !(a.currentSrc || a.getAttribute("src"))) return;
    e.preventDefault();
    try {
      if (a.paused) {
        try { globalThis.cssosAudioIntentPaused = false; } catch (_e1) {}
        var p = a.play(); if (p && p.catch) p.catch(function () {});
      } else {
        try { globalThis.cssosAudioIntentPaused = true; } catch (_e2) {}
        a.pause();
      }
    } catch (_e) {}
  }, false);

  // 暴露给外部/诊断。
  globalThis.cssosWatchAudioAuthority = enforce;
  globalThis.cssosAudioAuthorityState = function () {
    var a = aEl();
    return {
      enforcedWork: _enforcedWork,
      enforcedUrl: _enforcedUrl,
      engaged: engaged(),
      native: isNativeApp(),
      audio: a ? { src: (a.currentSrc || a.src || "").split("/").pop(), muted: a.muted, paused: a.paused, rs: a.readyState, t: +(a.currentTime || 0).toFixed(2) } : null,
    };
  };
})();
