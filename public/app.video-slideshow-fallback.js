/* CSSOS_WAVE_789 20260615 — Jing「浏览器(特斯拉等)阻止播放视频 → fallback 到幻灯(封面图)」.
 * 独立 defer 脚本。MV 影院的 #watch-video 若【报错 / 长时间放不出(被策略拦/解码失败)】, 给
 * .watch-screen 加 watch-screen-audio-fallback(CSS 已把视频压到 opacity:0.1)→ 透出封面/幻灯层,
 * 并用 globalThis.cssmvSetCoverSlides 把当前作品封面喂给幻灯。音频(独立音轨)不受影响照常播。
 * 注: 带独立音轨的作品本就走 audio-fallback(幻灯)路径; 本脚本兜的是【纯视频被拦】的额外保险。 */
(function () {
  "use strict";
  if (globalThis.__cssosVideoSlideshowFallback) return;
  globalThis.__cssosVideoSlideshowFallback = true;

  function curCover() {
    try {
      var w = globalThis.cssosCurrentWork || null;
      var c = w && (w.cover_image || w.cover_url || w.preview_image_url || (w.cover_slides && w.cover_slides[0]));
      return String(c || "").trim();
    } catch (_e) { return ""; }
  }
  function reveal(reason) {
    try {
      var ws = document.querySelector(".watch-screen");
      if (ws && !ws.classList.contains("watch-screen-audio-fallback")) ws.classList.add("watch-screen-audio-fallback");
    } catch (_e) {}
    try {
      var cover = curCover();
      if (cover && typeof globalThis.cssmvSetCoverSlides === "function") globalThis.cssmvSetCoverSlides([cover]);
    } catch (_e) {}
  }

  function hasRealVideoSrc(v) {
    var s = String((v && (v.currentSrc || v.getAttribute("src"))) || "");
    return !!s && !/^data:image\/svg/i.test(s) && !/^data:/i.test(s);
  }

  function wire() {
    var v = document.getElementById("watch-video");
    if (!v || v.__cssosFbWired) return;
    v.__cssosFbWired = true;
    v.addEventListener("error", function () { reveal("video-error"); });
    v.addEventListener("stalled", function () { if (v.readyState < 2 && hasRealVideoSrc(v)) reveal("video-stalled"); });
  }

  // 轮询: 影院开着 + 视频有真源, 但 readyState 长时间为 0(被拦/解码不出)→ 透出幻灯。
  var stuckSince = 0;
  function poll() {
    wire();
    var panel = document.getElementById("watch-panel");
    var v = document.getElementById("watch-video");
    if (!panel || panel.classList.contains("hidden") || !v) { stuckSince = 0; return; }
    if (v.error) { reveal("video-error-state"); return; }
    if (hasRealVideoSrc(v) && v.readyState === 0) {
      // readyState 0 = 没拿到任何数据。给 4.5s 宽限(冷加载), 超过则判定被拦/放不出。
      var now = (globalThis.performance && performance.now) ? performance.now() : 0;
      if (!stuckSince) stuckSince = now;
      else if (now - stuckSince > 4500) { reveal("video-blocked"); stuckSince = 0; }
    } else { stuckSince = 0; }
  }

  function start() { wire(); setInterval(poll, 1500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
