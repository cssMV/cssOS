/* CSSOS_WAVE_628 / 629 20260604 — 音频诊断 (Jing「点进面板仍无声 / 幻灯霸屏串台」精确定位).
 * 两部分:
 *  (A) 自动遥测(常开, 每作品每会话最多 1 条): 当 watch/影院面板开着、某作品播放了几秒后
 *      【音频仍无声】(paused 或 muted 或 readyState 太低 或 error), 把真实状态 POST 到
 *      /api/telemetry/error(code=audio_diag), 让我们从服务器读到底卡在哪一种。也记录当前
 *      绑定的 work-id 与正在显示的封面/幻灯, 用于查"封面串台"。
 *  (B) 可视浮层(仅 #audiodiag 时显示)。 */
(function () {
  "use strict";

  function el(id) { return document.getElementById(id); }
  function short(u) { u = String(u || ""); return u ? u.slice(-40) : "(none)"; }
  function panelOpen() {
    try {
      var ids = ["watch-panel", "mv-pipeline-panel", "cssmv-cinema", "cinema-panel"];
      for (var i = 0; i < ids.length; i++) {
        var p = el(ids[i]);
        if (p && !p.classList.contains("hidden") && getComputedStyle(p).display !== "none" && p.offsetParent !== null) return ids[i];
      }
      return "";
    } catch (_e) { return ""; }
  }
  function activeWorkId() {
    try {
      var wp = el("watch-panel");
      return (wp && wp.getAttribute("data-active-work-id")) || globalThis.__cssosCurrentWorkId || "(?)";
    } catch (_e) { return "(?)"; }
  }
  function snap() {
    var a = el("watch-audio-preview"), v = el("watch-video");
    var coverBg = "";
    try {
      var c = document.querySelector(".watch-backdrop, .watch-cover, [data-cover-host], .cssos-cover-slide");
      coverBg = c ? short(getComputedStyle(c).backgroundImage || "") : "";
    } catch (_e) {}
    return {
      panel: panelOpen(), workId: activeWorkId(),
      unlocked: !!globalThis.__cssosAudioUnlocked, watchUnlocked: !!globalThis.__cssosWatchAudioUnlocked,
      pending: !!globalThis.__cssosWatchPendingUnmute,
      winner: globalThis.__cssosAudioWinner ? (globalThis.__cssosAudioWinner.id || globalThis.__cssosAudioWinner.tagName) : "none",
      a: a ? { src: short(a.currentSrc || a.src), muted: a.muted, paused: a.paused, rs: a.readyState, ct: +(a.currentTime || 0).toFixed(1), vol: a.volume, err: a.error ? a.error.code : 0 } : "missing",
      v: v ? { src: short(v.currentSrc || v.src), muted: v.muted, paused: v.paused, rs: v.readyState, ct: +(v.currentTime || 0).toFixed(1) } : "missing",
      cover: coverBg
    };
  }

  // 自动上报仅在排查模式(#audiodiag / localStorage)开启, 默认关。
  function diagAutoReportOn() {
    try {
      if (/audiodiag/i.test(location.hash || "")) return true;
      return localStorage.getItem("cssos:audiodiag") === "1";
    } catch (_e) { return /audiodiag/i.test(location.hash || ""); }
  }

  // ── (A) 自动遥测: 播放几秒后仍无声则上报一次/作品/会话 ──
  var reported = {};
  function maybeReport() {
    try {
      if (!panelOpen()) return;
      var a = el("watch-audio-preview");
      if (!a) return;
      var wid = activeWorkId();
      if (!wid || wid === "(?)") return;
      // "应该出声却没出声" 判据: 有 src 且 (muted 或 paused 或 readyState<2 或 error)
      var hasSrc = !!String(a.currentSrc || a.src || "").trim();
      var silent = a.muted || a.paused || a.readyState < 2 || (a.error && a.error.code);
      var noSrc = !hasSrc;
      if (!silent && !noSrc) return;          // 正常出声 → 不报
      if (reported[wid]) return;
      reported[wid] = true;
      var s = snap();
      var msg = "audio_diag wid=" + wid + " panel=" + s.panel + " unlocked=" + s.unlocked + "/" + s.watchUnlocked +
        " pending=" + s.pending + " winner=" + s.winner +
        " | A " + JSON.stringify(s.a) + " | V " + JSON.stringify(s.v) + " | cover=" + s.cover;
      fetch("/api/telemetry/error", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg.slice(0, 400), code: "audio_diag", panel: s.panel, action: "silent-playback" })
      }).catch(function () {});
    } catch (_e) {}
  }
  // CSSOS_WAVE_630 收尾 — 自动上报已完成使命(定位到 __part_N 合成 id 致 400 → 无声/封面串台,
  // 已 W630 修复)。默认【关闭】自动上报以免污染遥测 digest; 仅 #audiodiag 时才开, 供日后排查。
  if (diagAutoReportOn()) setInterval(maybeReport, 2500);

  // ── (B) 可视浮层 (仅 #audiodiag) ──
  function diagOn() {
    try {
      if (/audiodiag/i.test(location.hash || "")) localStorage.setItem("cssos:audiodiag", "1");
      return localStorage.getItem("cssos:audiodiag") === "1";
    } catch (_e) { return /audiodiag/i.test(location.hash || ""); }
  }
  if (!diagOn()) return;
  var box = document.createElement("div");
  box.id = "cssos-audio-diag";
  box.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;max-width:92vw;background:rgba(8,9,14,.92);color:#9effa0;font:11px/1.45 ui-monospace,Menlo,monospace;padding:8px 10px;border:1px solid #2a3344;border-radius:10px;white-space:pre;";
  box.addEventListener("click", function () {
    var a = el("watch-audio-preview"), v = el("watch-video");
    var s = (a && (a.currentSrc || a.src)) ? a : v;
    if (s) { s.muted = false; s.volume = 1; var p = s.play && s.play(); if (p && p.catch) p.catch(function (e) { box.dataset.err = String(e && e.name || e); }); }
  });
  (function add() { if (document.body) document.body.appendChild(box); else setTimeout(add, 200); })();
  setInterval(function () {
    try {
      var s = snap();
      box.textContent = "AUDIO-DIAG (tap=force sound)\nwid=" + s.workId + " panel=" + s.panel +
        "\nunlocked=" + s.unlocked + "/" + s.watchUnlocked + " pending=" + s.pending + " winner=" + s.winner +
        (box.dataset.err ? " tapErr=" + box.dataset.err : "") +
        "\nA " + JSON.stringify(s.a) + "\nV " + JSON.stringify(s.v);
    } catch (_e) {}
  }, 500);
})();
