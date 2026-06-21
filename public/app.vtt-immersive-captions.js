/* CSSOS_WAVE_933 20260617 — Jing 愿景收尾: Apple Vision Pro 的 Immersive 系统影院。
 *
 * 真机实测(Jing, Vision Pro): visionOS 把全屏 <video> 强制接管进【系统沉浸影院播放器】,
 * 只渲染视频帧 + 原生字幕轨(WebVTT), 我们的 DOM 逐字情绪字幕全被丢弃(和 YouTube 一样
 * 只剩裸视频)。容器全屏在 visionOS 无效 —— 系统把 video 抽走了。
 *
 * 所以唯一能在沉浸巨幕里显示字幕的办法 = 给 #watch-video 挂一条【WebVTT 字幕轨】, 由系统
 * 播放器原生渲染。代价: 沉浸影院里是纯文字字幕(系统样式), 失去逐字颜色/emoji/动画那套
 * 招牌特效(那套只在普通窗口的 DOM 里有)。但字幕进巨幕了 —— 这是平台硬约束下的最优解。
 *
 * 画音分层铁律不破: 字幕仍是【独立轨】(VTT blob), 绝不烧进视频。
 *
 * 仅在【沉浸原生模式】(visionOS / ?immersive=1 / cssosSetImmersiveNative)启用并 showing,
 * 否则不挂轨, 普通浏览器继续用 DOM 情绪字幕(不出现双重字幕)。
 */
(function () {
  "use strict";
  if (globalThis.__cssosVttImmersiveWired) return;
  globalThis.__cssosVttImmersiveWired = true;

  function immersiveNativeOn() {
    try {
      var ua = String(navigator.userAgent || "").toLowerCase();
      if (/[?&]immersive=1\b/.test(String(location.search || ""))) {
        try { localStorage.setItem("cssos.immersive.native", "1"); } catch (_e) {}
      }
      // CSSOS_WAVE_934 — 仅【显式 opt-in】才挂 VTT(进系统空间影院的人)。visionOS 默认走
      //   CSS 全屏 + DOM 情绪字幕, 不挂 VTT(否则双重/冲突)。
      if (localStorage.getItem("cssos.immersive.native") === "1") return true;
    } catch (_e) {}
    return false;
  }

  function pad(n, w) { n = String(Math.floor(n)); while (n.length < w) n = "0" + n; return n; }
  function vttTime(sec) {
    var s = Math.max(0, Number(sec) || 0);
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    var whole = Math.floor(s);
    var ms = Math.round((s - whole) * 1000);
    return pad(h, 2) + ":" + pad(m, 2) + ":" + pad(whole, 2) + "." + pad(ms, 3);
  }

  // 行文本: 优先 line.text/line.line/line.lyric, 否则拼 tokens 的 char/text。
  function lineText(line) {
    var t = String(line.text || line.line || line.lyric || "").trim();
    if (t) return t;
    if (Array.isArray(line.tokens)) {
      return line.tokens.map(function (k) { return String(k.char || k.text || ""); }).join("").trim();
    }
    return "";
  }

  function buildVtt(aligned) {
    var out = "WEBVTT\n\n";
    var n = 0;
    for (var i = 0; i < aligned.length; i++) {
      var line = aligned[i] || {};
      var txt = lineText(line);
      if (!txt) continue;
      // 跳过结构标记行([Verse]/【副歌】/# 标题/**段名**)。
      if (/^[\[【][^\]】]*[\]】]$/.test(txt)) continue;
      if (/^#{1,6}\s/.test(txt) || /^[*_]{2}[^*_].*[*_]{2}$/.test(txt)) continue;
      var t0 = Number(line.t_start || 0) / 1000;
      var t1 = Number(line.t_end || 0) / 1000;
      if (!(t1 > t0)) {
        // 行级时间缺失 → 用 tokens 兜底; 再不行给个 3.5s 窗口顺延。
        if (Array.isArray(line.tokens) && line.tokens.length) {
          var ts = line.tokens.map(function (k) { return Number(k.t_start || 0) / 1000; }).filter(function (x) { return x > 0; });
          var te = line.tokens.map(function (k) { return Number(k.t_end || 0) / 1000; }).filter(function (x) { return x > 0; });
          if (ts.length) t0 = Math.min.apply(null, ts);
          if (te.length) t1 = Math.max.apply(null, te);
        }
        if (!(t1 > t0)) { t0 = t0 || (n * 3.8); t1 = t0 + 3.5; }
      }
      n++;
      out += n + "\n" + vttTime(t0) + " --> " + vttTime(t1) + "\n" + txt + "\n\n";
    }
    return n > 0 ? out : null;
  }

  var _lastSig = "";
  var _blobUrl = null;

  function sync() {
    if (!immersiveNativeOn()) return;     // 只在沉浸原生模式挂轨
    var video = document.getElementById("watch-video");
    if (!video) return;
    var ps = (typeof globalThis.cssosMvPipelinePanelState === "function")
      ? globalThis.cssosMvPipelinePanelState() : null;
    var aligned = ps && Array.isArray(ps.alignedLyrics) ? ps.alignedLyrics : null;
    if (!aligned || !aligned.length) return;
    var sig = String(ps.workId || ps.title || "") + "|" + aligned.length;
    if (sig === _lastSig && video.querySelector('track[data-cssos-vtt="1"]')) return;
    _lastSig = sig;
    var vtt = buildVtt(aligned);
    if (!vtt) return;
    // 清旧轨 + blob。
    try {
      video.querySelectorAll('track[data-cssos-vtt="1"]').forEach(function (t) { t.remove(); });
      if (_blobUrl) { URL.revokeObjectURL(_blobUrl); _blobUrl = null; }
    } catch (_e) {}
    try {
      _blobUrl = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
      var track = document.createElement("track");
      track.kind = "subtitles";
      track.label = "Lyrics";
      track.srclang = "und";
      track.default = true;
      track.src = _blobUrl;
      track.setAttribute("data-cssos-vtt", "1");
      video.appendChild(track);
      // 强制 showing(系统影院默认会读 default 轨, 这里再保一手)。
      setTimeout(function () {
        try {
          var tt = video.textTracks;
          for (var i = 0; i < tt.length; i++) {
            tt[i].mode = (tt[i].label === "Lyrics") ? "showing" : "disabled";
          }
        } catch (_e) {}
      }, 60);
    } catch (_e) {}
  }

  function start() {
    // 不是沉浸原生模式就完全不做(普通浏览器零影响, 继续 DOM 情绪字幕)。
    if (!immersiveNativeOn()) return;
    sync();
    ["cssos:work-changed", "cssos:work-id-changed", "cssos:playlist-advance"].forEach(function (ev) {
      try { document.addEventListener(ev, function () { setTimeout(sync, 200); }, { passive: true }); } catch (_e) {}
      try { window.addEventListener(ev, function () { setTimeout(sync, 200); }, { passive: true }); } catch (_e) {}
    });
    // alignedLyrics 是异步回填的 → 慢轮询补挂(每首拿到对齐数据后即生效)。
    setInterval(sync, 2500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  globalThis.cssosSyncImmersiveVtt = sync;   // 调试/手动
})();
