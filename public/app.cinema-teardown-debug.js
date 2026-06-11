/* CSSOS_WAVE_655 20260606 — 影院拆台探针(临时, 默认关). 抓"分享链接进来 1-2s 就退出真全屏影院"
 * 的真凶: 谁移除了影院 class / 退了全屏 / 暂停了媒体 —— 连【调用栈】一起记进 localStorage(熬过
 * 跳转, 事后可读)。开关: localStorage.cssos:cinemaDebug="1"。读: cssosCinemaDebugDump() 或
 * localStorage['cssos:cinemaDebugLog']。off 时整段不执行, 零影响。 */
(function () {
  "use strict";
  try { if (localStorage.getItem("cssos:cinemaDebug") !== "1") return; } catch (e) { return; }

  var LOG = [];
  var KEY = "cssos:cinemaDebugLog";
  function st() { try { return (new Error().stack || "").split("\n").slice(2, 8).map(function (s) { return s.trim(); }).join("  <<  "); } catch (e) { return ""; } }
  function rec(tag, detail) {
    var e = { t: Date.now(), ms: (typeof performance !== "undefined" ? Math.round(performance.now()) : 0), tag: tag, detail: detail || "", stack: st() };
    LOG.push(e);
    try { localStorage.setItem(KEY, JSON.stringify(LOG.slice(-80))); } catch (_) {}
    try { console.warn("[cinema-dbg]", e.ms + "ms", tag, detail, "\n  ", e.stack); } catch (_) {}
  }

  var CINE = ["cssos-cinema-mode", "is-cssmv-fullscreen", "cssos-watch-theater", "cssos-watch-idle"];
  // 1) 谁 remove 影院 class
  try {
    var origRemove = DOMTokenList.prototype.remove;
    DOMTokenList.prototype.remove = function () {
      for (var i = 0; i < arguments.length; i++) {
        if (CINE.indexOf(arguments[i]) >= 0) rec("classRemove:" + arguments[i], String(this.value || "").slice(0, 50));
      }
      return origRemove.apply(this, arguments);
    };
  } catch (_) {}
  // 2) 谁退全屏
  try {
    ["exitFullscreen", "webkitExitFullscreen"].forEach(function (fn) {
      if (typeof document[fn] === "function") {
        var o = document[fn];
        document[fn] = function () { rec(fn, ""); return o.apply(document, arguments); };
      }
    });
  } catch (_) {}
  // 3) 谁暂停了 watch 媒体
  try {
    var origPause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () {
      if (this.id === "watch-video" || this.id === "watch-audio-preview") rec("mediaPause:" + this.id, "t=" + (this.currentTime || 0).toFixed(2));
      return origPause.apply(this, arguments);
    };
  } catch (_) {}
  // 4) 谁把 #watch-panel 隐藏/改类
  try {
    var arm = function () {
      var wp = document.getElementById("watch-panel");
      if (!wp) { setTimeout(arm, 300); return; }
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.attributeName === "hidden") rec("panel.hidden", wp.hidden ? "HIDDEN" : "shown");
          if (m.attributeName === "class") rec("panel.class", String(wp.className || "").slice(0, 80));
          if (m.attributeName === "style") rec("panel.style", String(wp.getAttribute("style") || "").slice(0, 60));
        });
      }).observe(wp, { attributes: true, attributeFilter: ["hidden", "class", "style"] });
      rec("armed", "watching #watch-panel");
    };
    arm();
  } catch (_) {}

  globalThis.cssosCinemaDebugDump = function () { return JSON.stringify(LOG, null, 2); };
  try { localStorage.removeItem(KEY); } catch (_) {} // 每次开始清旧
  console.info("[cinema-dbg] ARMED. 重现后: copy(cssosCinemaDebugDump())");
})();
