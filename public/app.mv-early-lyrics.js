/* CSSOS_WAVE_324 20260522 — Jing「边出边播」Phase C: 预热歌词打字机.
 *
 * 音乐响起【之前】, 歌词阶段一完成(cssmv:lyrics-updated)就在 watch 媒体框【左下角】
 * 用打字机效果一句句显示歌词(估算节奏, 不依赖媒体时钟). 音频/视频一开始播放(东风
 * 来了) → 本叠层淡出, 交给同步卡拉OK(#watch-karaoke-line)接管, 无缝衔接.
 *
 * 纯叠加 UI, pointer-events:none, 不碰播放/合成/状态. 文案为用户歌词本身, 无需 i18n.
 */
(function () {
  "use strict";
  if (globalThis.__cssosEarlyLyricsWired) return;
  globalThis.__cssosEarlyLyricsWired = true;

  var box = null, timer = null, active = false;

  function screenEl() { return document.querySelector("#watch-panel .watch-screen"); }

  function ensureBox() {
    if (box && document.body.contains(box)) return box;
    var s = screenEl();
    if (!s) return null;
    box = document.getElementById("cssos-early-lyrics");
    if (!box) {
      box = document.createElement("div");
      box.id = "cssos-early-lyrics";
      box.style.cssText = [
        "position:absolute", "left:16px", "right:16px", "bottom:72px", "z-index:24",
        "pointer-events:none", "color:#fff", "text-align:left",
        "font:600 19px/1.5 -apple-system,system-ui,sans-serif",
        "text-shadow:0 2px 10px rgba(0,0,0,0.75)",
        "max-height:42%", "overflow:hidden",
        "transition:opacity .5s ease", "opacity:0",
        "white-space:pre-wrap", "word-break:break-word",
      ].join(";");
      s.appendChild(box);
    }
    return box;
  }

  function isPlaying() {
    try {
      var v = document.getElementById("watch-video");
      var a = document.getElementById("watch-audio-preview");
      return (v && !v.paused && !v.ended && (v.currentTime || 0) > 0) ||
        (a && !a.paused && !a.ended && (a.currentTime || 0) > 0);
    } catch (_e) { return false; }
  }

  function stop(fade) {
    active = false;
    if (timer) { clearTimeout(timer); timer = null; }
    if (box) {
      box.style.opacity = "0";
      if (!fade) { box.textContent = ""; }
      else { setTimeout(function () { if (box && !active) box.textContent = ""; }, 520); }
    }
  }

  function start(text) {
    if (isPlaying()) { stop(false); return; } // 东风已到 → 直接交给同步卡拉OK
    var b = ensureBox();
    if (!b) return;
    var lines = String(text || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) { stop(false); return; }
    active = true;
    b.textContent = "";
    b.style.opacity = "1";
    var li = 0, ci = 0, shown = [];
    var CHAR_MS = 65, LINE_PAUSE = 850, MAX_LINES = 3;
    function tick() {
      if (!active) return;
      if (isPlaying()) { stop(true); return; } // 播放一开始 → 交接淡出
      if (li >= lines.length) { // 打完了, 停在末尾等播放
        timer = setTimeout(function () { if (isPlaying()) stop(true); else tick2(); }, 800);
        return;
      }
      var line = lines[li];
      ci++;
      var view = shown.concat([line.slice(0, ci)]).slice(-MAX_LINES);
      b.textContent = view.join("\n");
      if (ci >= line.length) {
        shown.push(line); if (shown.length > MAX_LINES) shown.shift();
        li++; ci = 0;
        timer = setTimeout(tick, LINE_PAUSE);
      } else {
        timer = setTimeout(tick, CHAR_MS);
      }
    }
    function tick2() { timer = setTimeout(tick, 1); } // 复用 tick 的等待分支
    if (timer) clearTimeout(timer);
    tick();
  }

  // 歌词阶段完成 → 启动打字机. 仅 pipeline 输出来源(避免编辑歌词时误触发).
  document.addEventListener("cssmv:lyrics-updated", function (ev) {
    try {
      var d = ev && ev.detail;
      if (!d || !d.lyrics) return;
      if (d.source && d.source !== "mv-pipeline-panel") return;
      start(d.lyrics);
    } catch (_e) {}
  });

  // 播放一开始 → 交接淡出(委托捕获, 兼容元素晚于脚本出现).
  document.addEventListener("playing", function (ev) {
    var t = ev && ev.target;
    if (t && (t.id === "watch-audio-preview" || t.id === "watch-video")) stop(true);
  }, true);
})();
