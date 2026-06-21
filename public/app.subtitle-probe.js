/* CSSOS_WAVE_1091 20260621 — Jing「传统/情绪字幕不显示, 定位断在哪一关」远程探针。
 * 播放进行到 >8s(字幕本该在唱)时, 采集一次:① 当前作品 + 它带没带字幕源
 * (subtitle_take1_json_url / srt);② #watch-subtitle 这个载体 存不存在 / 有没有内容
 * (textContent 长度 + 子节点数)/ 可不可见(display/opacity/visibility);③ 字幕引擎
 * 模块是否就位(ensureKaraokeAnalyser / derivePerTokenEmotion)。每作品上报一次,
 * 经 cssosReportError → /api/telemetry/error → error_reports(code=subtitle_probe),
 * Jing 真机一播, 服务端即可读到断点, 无需手动复制粘贴。诊断完即可删。 */
(function () {
  "use strict";
  if (globalThis.__cssosSubProbe) return;
  globalThis.__cssosSubProbe = true;
  var done = {};
  function currentWork() {
    try {
      return globalThis.currentWatchPreviewWork
        || (globalThis.cssmvPipelineLastResult && (globalThis.cssmvPipelineLastResult.work || globalThis.cssmvPipelineLastResult))
        || (typeof globalThis.cssosMvPipelinePanelState === "function" ? globalThis.cssosMvPipelinePanelState() : null)
        || {};
    } catch (_e) { return {}; }
  }
  function tick() {
    try {
      var a = document.getElementById("watch-audio-preview");
      if (!a || a.paused || !isFinite(a.duration) || a.duration < 5 || a.currentTime < 8) return;
      var w = currentWork();
      var wid = String((w && (w.id || w.work_id)) || "").trim();
      if (!wid || done[wid]) return;
      var s = document.getElementById("watch-subtitle");
      var cs = s ? getComputedStyle(s) : null;
      var p = {
        w: wid.slice(0, 8),
        t: String((w && w.title) || "").slice(0, 18),
        se: s ? 1 : 0,                                   // 字幕载体存在?
        sl: s ? (s.textContent || "").trim().length : -1, // 字幕有内容?(逐字 span 文本长度)
        sc: s ? s.childElementCount : -1,                // 子节点数(逐字 span 数)
        sd: cs ? cs.display : "",                        // 被 display:none 了?
        so: cs ? cs.opacity : "",                        // 被 opacity:0 了?
        sv: cs ? cs.visibility : "",                     // 被 visibility:hidden 了?
        t1: (w && w.subtitle_take1_json_url) ? 1 : 0,    // 作品带情绪字幕源?
        sr: (w && w.subtitle_srt_url) ? 1 : 0,           // 作品带 srt 源?
        km: (typeof globalThis.ensureKaraokeAnalyser === "function") ? 1 : 0,  // 卡拉OK/字幕引擎就位?
        ee: (typeof globalThis.derivePerTokenEmotion === "function") ? 1 : 0,  // 情绪派生引擎就位?
        at: Math.round(a.currentTime),
        ci: document.body.classList.contains("cssos-cinema-mode") ? 1 : 0
      };
      done[wid] = 1;
      if (typeof globalThis.cssosReportError === "function") {
        globalThis.cssosReportError("SUBPROBE " + JSON.stringify(p), "subtitle_probe");
      }
    } catch (_e) { /* probe must never throw */ }
  }
  setInterval(tick, 2500);
})();
