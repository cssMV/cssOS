/* CSSOS_WAVE_1707 — 圣诗庄严播放器(圣诗画廊点进去的目标)。
 *
 * 为什么自建而不是塞进影院栈: 影院的字幕/卡拉OK 深绑 work 记录与音频权威, 硬接集成风险大。
 * 圣诗要的其实很纯粹 —— 逐字流光(= 情绪字幕的灵魂)+ 忠实音频, 且【庄严】(无彩纸火花)。
 * 所以做一个自足的播放器: 逐字点亮直接由乐谱精确时间驱动, 每次都分毫不差。
 *
 * 忠实原则:
 *   ① 逐字点亮时刻 = 字幕 JSON 的 t_start(来自乐谱, 零估算)。
 *   ② 【庄严】: 柔和金光逐字亮起, 无全屏闪/彩纸/火花 —— 像会众捧圣诗本跟唱。
 *   ③ 不做逐字情绪分析(字幕 JSON 已统一 serene)。
 *
 * 公开: globalThis.cssosPlayHymn({ audioUrl, subtitleUrl, title, composer, mvUrl })
 */
(function () {
  "use strict";
  if (globalThis.cssosPlayHymn) return;

  function injectStyle() {
    if (document.getElementById("cssos-hymn-style")) return;
    var st = document.createElement("style"); st.id = "cssos-hymn-style";
    st.textContent = [
      "#cssos-hymn{position:fixed;inset:0;z-index:2147483000;color:#f6efe0;",
      "  background:radial-gradient(120% 90% at 50% 8%,#1b2530,#0c1218 60%,#05080c);",
      "  font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Songti SC','STSong',serif;}",
      "#cssos-hymn .hy-bgvid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.32;filter:saturate(0.85) brightness(0.7);}",
      // W1723 — 没有 MV 时, 用封面图当背景静帧(纯音频+封面的圣乐也有画面, 和有 MV 的一致)。
      "#cssos-hymn .hy-bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.32;filter:saturate(0.85) brightness(0.7);}",
      "#cssos-hymn .hy-veil{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 10%,transparent,rgba(4,8,12,0.55) 72%,rgba(4,8,12,0.9));}",
      "#cssos-hymn .hy-head{position:absolute;top:0;left:0;right:0;padding:18px 22px;display:flex;align-items:center;gap:12px;z-index:3;}",
      "#cssos-hymn .hy-title{font-size:19px;font-weight:600;letter-spacing:0.3px;text-shadow:0 2px 10px rgba(0,0,0,0.6);}",
      "#cssos-hymn .hy-sub{font-size:13px;opacity:0.7;}",
      "#cssos-hymn .hy-back{width:38px;height:38px;border-radius:50%;border:1px solid rgba(246,239,224,0.25);",
      "  background:rgba(0,0,0,0.3);color:#f6efe0;font-size:24px;line-height:1;cursor:pointer;margin-right:12px;flex:0 0 auto;}",
      "#cssos-hymn .hy-share{margin-left:auto;width:38px;height:38px;border-radius:50%;border:1px solid rgba(246,239,224,0.25);",
      "  background:rgba(0,0,0,0.3);color:#f6efe0;font-size:17px;cursor:pointer;margin-right:10px;}",
      "#cssos-hymn .hy-x{width:38px;height:38px;border-radius:50%;border:1px solid rgba(246,239,224,0.25);",
      "  background:rgba(0,0,0,0.3);color:#f6efe0;font-size:18px;cursor:pointer;}",
      // 字幕区: 当前一行, 逐字点亮。W1709 — 中间底部(不再垂直居中抢画面), 上方留给画面。
      "#cssos-hymn .hy-stage{position:absolute;left:0;right:0;bottom:15vh;z-index:2;text-align:center;padding:0 6vw;}",
      "#cssos-hymn .hy-line{font-size:clamp(24px,3.8vw,46px);line-height:1.45;font-weight:500;",
      "  text-shadow:0 2px 14px rgba(0,0,0,0.7);}",   // 底衬阴影, 压住画面不糊
      "#cssos-hymn .hy-w{display:inline-block;opacity:0.14;transform:translateZ(0);white-space:pre;",
      "  transition:opacity .5s ease,text-shadow .5s ease,color .5s ease,transform .5s cubic-bezier(.2,.9,.25,1);}",
      "#cssos-hymn .hy-w.seen{opacity:0.6;}",   // 已唱过: 留存, 稍暗
      // W1709 — 「爆而不张扬」: 正在唱=金光 + 极轻微上浮/放大(scale 1.05), 庄严不喧哗。
      // W1721 — 逐字点亮的辉光按 tradition 换色(--hyH 色相, 缺省 42=金)。基督教留金, 各传统各色。
      "#cssos-hymn .hy-w.on{opacity:1;color:hsl(var(--hyH,42),100%,92%);transform:scale(1.05) translateY(-1px);",
      "  text-shadow:0 0 14px hsla(var(--hyH,42),100%,70%,0.8),0 0 34px hsla(var(--hyH,42),95%,60%,0.4);}",
      "#cssos-hymn .hy-ctrl{position:absolute;bottom:0;left:0;right:0;z-index:3;padding:20px 22px 26px;display:flex;align-items:center;gap:14px;",
      "  background:linear-gradient(0deg,rgba(4,8,12,0.75),transparent);}",
      "#cssos-hymn .hy-play{width:52px;height:52px;border-radius:50%;border:1px solid rgba(246,239,224,0.3);background:rgba(0,0,0,0.35);color:#f6efe0;font-size:20px;cursor:pointer;flex:0 0 auto;}",
      "#cssos-hymn .hy-bar{flex:1;height:5px;border-radius:3px;background:rgba(246,239,224,0.16);overflow:hidden;cursor:pointer;}",
      "#cssos-hymn .hy-fill{height:100%;width:0;background:linear-gradient(90deg,hsl(var(--hyH,42),100%,76%),hsl(var(--hyH,42),82%,58%));}",
      "#cssos-hymn .hy-t{font-size:12px;opacity:0.65;min-width:84px;text-align:right;font-family:ui-monospace,monospace;}",
      "#cssos-hymn .hy-badge{position:absolute;bottom:74px;left:22px;z-index:3;font-size:11px;opacity:0.55;letter-spacing:0.4px;}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(sec) { sec = Math.max(0, sec | 0); var m = (sec / 60) | 0, s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }

  // 字幕 JSON → 扁平行列表: [{ t0, t1, words:[{text,t0,t1}] }]
  function flatten(json) {
    var out = [];
    try {
      var L = (json.languages && json.languages[0]) || null;
      if (!L || !Array.isArray(L.sections)) return out;
      L.sections.forEach(function (sec) {
        (sec.lines || []).forEach(function (ln) {
          var toks = (ln.tokens || []).map(function (t) {
            return { text: String(t.text || t.char || ""), t0: Number(t.t_start) || 0, t1: Number(t.t_end) || 0 };
          }).filter(function (t) { return t.text; });
          if (!toks.length && ln.text) toks = [{ text: String(ln.text), t0: Number(ln.t_start) || 0, t1: Number(ln.t_end) || 0 }];
          if (toks.length) out.push({ t0: Number(ln.t_start) || toks[0].t0, t1: Number(ln.t_end) || toks[toks.length - 1].t1, words: toks });
        });
      });
    } catch (_e) {}
    out.sort(function (a, b) { return a.t0 - b.t0; });
    return out;
  }

  globalThis.cssosPlayHymn = function (opts) {
    opts = opts || {};
    if (!opts.audioUrl) return;
    injectStyle();
    globalThis.cssosReverentMode = true;   // W1705 — 庄严档: 砍嘉年华(本播放器本就不放, 双保险给别处)

    /* W1711 — Jing「参照面对面, 进圣诗播放器就关掉 MV 面板」。不是暂停, 是【关面板 + 断源释放
     * 解码器】—— 与 app.actor-gallery.js 的 _agCloseAllPanels / _agPauseBgMedia 同一套(那两个是
     * f2f 私有、且排除 f2f 自身层, 无法直接复用, 故在此复刻通用逻辑, 排除圣诗浮层自身)。
     * 关闭圣诗后不自动重开面板 —— 与 f2f 一致(f2f 退出也不重开)。 */
    var _restoreCinema = (function () {
      var prevSubOff = globalThis.cssosEmotionSubtitlesOff;
      try { globalThis.cssosEmotionSubtitlesOff = true; } catch (_e) {}   // 停传统情绪字幕/特效
      try { if (typeof globalThis.cssosClearAllBurstFx === "function") globalThis.cssosClearAllBurstFx(); } catch (_e) {}
      try { globalThis.cssosAudioIntentPaused = true; } catch (_e) {}     // 音频权威让位(W1676 契约)

      function closeAllPanels() {
        try {
          document.querySelectorAll(".panel:not(.hidden)").forEach(function (p) {
            if (p.id === "cssos-hymn" || p.closest("#cssos-hymn")) return;
            if (p.classList.contains("logo-panel")) return;    // 保留 logo 底座
            var btn = p.querySelector('[data-i18n-aria="action.close"]') || p.querySelector('[aria-label="Close"]');
            if (btn) { try { btn.click(); } catch (e) {} }
            else { try { p.classList.add("hidden"); } catch (e2) {} }
          });
        } catch (e) {}
      }
      function detachBgMedia() {
        try {
          document.querySelectorAll("video,audio").forEach(function (m) {
            if (m.closest("#cssos-hymn")) return;             // 圣诗自己的媒体不动
            try { if (!m.paused) m.pause(); } catch (e) {}
            try { if (!m.muted) m.muted = true; } catch (e2) {}
            try { if (m.srcObject) m.srcObject = null; } catch (e3) {}   // 断源释放解码器(W1645)
            var had = false;
            try { if (m.getAttribute("src")) { m.removeAttribute("src"); had = true; } } catch (e4) {}
            try { var ss = m.querySelectorAll("source"); for (var k = 0; k < ss.length; k++) { ss[k].removeAttribute("src"); had = true; } } catch (e5) {}
            try { if (had) m.load(); } catch (e6) {}
          });
        } catch (e) {}
      }
      closeAllPanels(); detachBgMedia();
      // 补一刀: 自动续播/延迟挂载的媒体(feed/幻灯)在 700ms 后再压一次(与 f2f 同策略)。
      var t = setTimeout(function () { closeAllPanels(); detachBgMedia(); }, 700);

      return function () {
        try { clearTimeout(t); } catch (_e) {}
        try { globalThis.cssosEmotionSubtitlesOff = prevSubOff; } catch (_e) {}
        try { globalThis.cssosAudioIntentPaused = false; } catch (_e) {}
        // 不自动重开面板 —— 与 f2f 退出行为一致。
      };
    })();

    var ov = document.getElementById("cssos-hymn");
    if (ov) { try { ov.remove(); } catch (_e) {} }
    ov = document.createElement("div"); ov.id = "cssos-hymn";
    // W1721 — 播放器按 tradition 换色(逐字辉光 + 进度条)。基督教留金(42); 未知 → 金。
    var TRAD_HUE = { christian: 42, catholic: 42, orthodox: 45, buddhist: 36, taoist: 48,
      islamic: 158, hindu: 26, jewish: 220, sikh: 30, bahai: 265, secular: 265, other: 200 };
    var _th = String(opts.tradition || "").toLowerCase();
    try { ov.style.setProperty("--hyH", String(TRAD_HUE[_th] != null ? TRAD_HUE[_th] : 42)); } catch (_e) {}
    // 背景: 有 MV → 放视频; 否则有封面图 → 静帧封面; 都没有 → 暗金渐变(下同)。
    var bgUrl = opts.posterUrl || opts.coverUrl || "";
    ov.innerHTML =
      (opts.mvUrl ? '<video class="hy-bgvid" muted playsinline loop src="' + esc(opts.mvUrl) + '"></video>'
        : (bgUrl ? '<img class="hy-bgimg" src="' + esc(bgUrl) + '" alt="" />' : '')) +
      '<div class="hy-veil"></div>' +
      '<div class="hy-head">' +
      '<button class="hy-back" title="Back to Sacred Scores">‹</button>' +   // W1719 — 左上返回圣殿
      '<div><div class="hy-title">' + esc(opts.title || "Hymn") + '</div>' +
        (opts.composer ? '<div class="hy-sub">' + esc(opts.composer) + '</div>' : '') +
      '</div>' +
      (opts.id ? '<button class="hy-share" title="Share">⤴</button>' : '') +
      '<button class="hy-x" title="Close">×</button></div>' +
      '<div class="hy-stage"><div class="hy-line"></div></div>' +
      '<div class="hy-badge">♪ faithful to the score · word timing exact</div>' +
      '<div class="hy-ctrl"><button class="hy-play">∥</button>' +
        '<div class="hy-bar"><div class="hy-fill"></div></div><div class="hy-t">0:00</div></div>';
    document.body.appendChild(ov);

    var au = new Audio(); au.src = opts.audioUrl; au.preload = "auto";
    var vid = ov.querySelector(".hy-bgvid");
    var lineEl = ov.querySelector(".hy-line");
    var fill = ov.querySelector(".hy-fill");
    var tEl = ov.querySelector(".hy-t");
    var playBtn = ov.querySelector(".hy-play");
    var lines = [], curLine = -1, raf = 0;

    function close() {
      if (raf) cancelAnimationFrame(raf);
      try { au.pause(); } catch (_e) {}
      try { if (vid) vid.pause(); } catch (_e) {}
      globalThis.cssosReverentMode = false;
      try { _restoreCinema(); } catch (_e) {}   // W1709 — 恢复被噤声的影院
      try { ov.remove(); } catch (_e) {}
    }
    ov.querySelector(".hy-x").onclick = close;
    var backBtn = ov.querySelector(".hy-back");
    if (backBtn) backBtn.addEventListener("click", function () {
      close();
      try { if (typeof globalThis.cssosOpenHymnGallery === "function") globalThis.cssosOpenHymnGallery(); } catch (_e) {}
    });
    var shareBtn = ov.querySelector(".hy-share");
    if (shareBtn) shareBtn.addEventListener("click", function () {
      var t = opts.title || "Hymn";
      var txt = "🎼 " + t + (opts.composer ? " — " + opts.composer : "") +
        "\nA faithful hymn transcription on CSS Studio — every note and every word exact to the score.";
      try {
        if (typeof globalThis.openCssosShareDialog === "function") {
          globalThis.openCssosShareDialog({
            url: "/h/" + encodeURIComponent(opts.id),   // SSR og: 海报图 + MV 视频 + 文案
            title: t, text: txt,
            headerLabel: (typeof globalThis.loginCopy === "function" ? globalThis.loginCopy("Share this piece", "分享这首圣乐") : "Share this piece"),
          });
        } else { try { navigator.clipboard.writeText(location.origin + "/?hymn=" + opts.id); } catch (_e) {} }
      } catch (_e) {}
    });
    document.addEventListener("keydown", function esc2(e) { if (e.key === "Escape" && document.getElementById("cssos-hymn")) { close(); document.removeEventListener("keydown", esc2); } });

    function renderLine(idx) {
      var ln = lines[idx]; if (!ln) { lineEl.innerHTML = ""; return; }
      lineEl.innerHTML = ln.words.map(function (w, i) {
        return '<span class="hy-w" data-i="' + i + '">' + esc(w.text) + (i < ln.words.length - 1 ? " " : "") + "</span>";
      }).join("");
    }

    function tick() {
      var ms = (au.currentTime || 0) * 1000;
      // 找当前行
      var idx = -1;
      for (var i = 0; i < lines.length; i++) { if (ms >= lines[i].t0) idx = i; else break; }
      if (idx !== curLine) { curLine = idx; renderLine(idx); }
      // 当前行内逐字点亮
      if (curLine >= 0) {
        var ws = lines[curLine].words;
        var spans = lineEl.children;
        for (var k = 0; k < ws.length; k++) {
          var sp = spans[k]; if (!sp) continue;
          var on = ms >= ws[k].t0 && ms < ws[k].t1;
          var seen = ms >= ws[k].t1;
          sp.className = "hy-w" + (on ? " on" : seen ? " seen" : "");
        }
      }
      var dur = au.duration && isFinite(au.duration) ? au.duration : 0;
      if (dur) fill.style.width = ((au.currentTime / dur) * 100).toFixed(2) + "%";
      tEl.textContent = fmt(au.currentTime) + (dur ? " / " + fmt(dur) : "");
      raf = requestAnimationFrame(tick);
    }

    playBtn.onclick = function () { if (au.paused) { au.play().catch(function () {}); if (vid) vid.play().catch(function () {}); } else { au.pause(); if (vid) vid.pause(); } };
    au.addEventListener("play", function () { playBtn.textContent = "∥"; });
    au.addEventListener("pause", function () { playBtn.textContent = "▶"; });
    ov.querySelector(".hy-bar").onclick = function (e) {
      var r = this.getBoundingClientRect(); var p = (e.clientX - r.left) / r.width;
      if (au.duration) { au.currentTime = p * au.duration; if (vid && vid.duration) vid.currentTime = Math.min(vid.duration, au.currentTime); }
    };

    // 拉字幕 → 播放
    fetch(opts.subtitleUrl, { credentials: "omit" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) lines = flatten(j); })
      .catch(function () {})
      .then(function () {
        raf = requestAnimationFrame(tick);
        au.play().then(function () { if (vid) vid.play().catch(function () {}); }).catch(function () { playBtn.textContent = "▶"; });
      });
  };

  /* W1708 — 按 id 播放一首圣诗。供 ?hymn=<id> 深链 + 画廊卡片调用。
   *   与 cssosPlayHymn 的区别: 这个先去 /api/hymns/:id 解析资源 URL, 再交给播放器。 */
  globalThis.cssosOpenHymn = function (id) {
    id = String(id || "").trim();
    if (!id) return;
    fetch("/api/hymns/" + encodeURIComponent(id), { credentials: "omit" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) return;
        if (!j.ready) { try { if (globalThis.cssosToast) globalThis.cssosToast("This hymn is still rendering…"); } catch (_e) {} return; }
        globalThis.cssosPlayHymn({
          id: id, audioUrl: j.audio_url, subtitleUrl: j.subtitle_url, mvUrl: j.mv_url,
          posterUrl: j.poster_url,   // W1723 — 无 MV 时当背景静帧
          title: j.title || "Hymn", composer: "", tradition: j.tradition || "secular",
        });
      }).catch(function () {});
  };

  /* 三类下方链接同族: ?cssMV= · ?actor= · ?hymn=<id>。另留 ?hymndemo=1 = Foster 静态样片。 */
  function maybeDeepLink() {
    try {
      var q = location.search || "";
      var m = q.match(/[?&]hymn=([^&]+)/);
      if (m && m[1]) { globalThis.cssosOpenHymn(decodeURIComponent(m[1])); return; }
      if (/[?&]hymndemo=1/.test(q)) {
        globalThis.cssosPlayHymn({
          audioUrl: "/uploads/demo/foster-organ.mp3",
          subtitleUrl: "/uploads/demo/foster.subtitles.json",
          mvUrl: "/uploads/demo/foster-mv.mp4",
          title: "Jeanie With The Light Brown Hair",
          composer: "Stephen Foster · 1854 · public domain",
        });
      }
    } catch (_e) {}
  }
  if (document.readyState !== "loading") setTimeout(maybeDeepLink, 600);
  else window.addEventListener("DOMContentLoaded", function () { setTimeout(maybeDeepLink, 600); });
})();
