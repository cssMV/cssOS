// CSSOS_PHASE2_MV_TITLE_SYNC 20260503 — Jing
// "切换歌曲时，标题栏和媒体框里的标题打架"
//
// Bulletproof safety net for the in-frame .cssmv-mv-title overlay.
//
// Several track-switch entry points (Loop list, mouse wheel, arrow keys,
// auto-advance, click on a playlist item, queue advance) update the
// watch-panel title bar (#watch-panel .panel-title, .watch-title-text,
// #watch-title-text, .watch-frame-title) but historically only some of
// them poked the big art-title overlay (.cssmv-mv-title) owned by
// app.watch-media-overlays.js. Result: the FIRST song's title froze on
// the video frame for the whole session.
//
// PR #6 fixed openMarketWorkPreview, PR #7 fixed applyWatchQueueItemModule.
// This module catches everything else by mirroring title-bar text changes
// straight to .cssmv-mv-title via a MutationObserver. Even if a future
// code path adds yet another track-switch surface, the mirror keeps the
// two titles in lockstep.
(function (global) {
  if (global.__cssmvMvTitleSyncBound) return;
  global.__cssmvMvTitleSyncBound = true;

  const TITLE_SOURCES = [
    "#watch-panel .panel-title",
    "#watch-panel .watch-title-text",
    "#watch-panel #watch-title-text",
    "#watch-panel .watch-frame-title",
    "#watch-panel #watch-frame-title"
  ];

  function readTitleSourceText() {
    for (const sel of TITLE_SOURCES) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const t = String(el.textContent || "").trim();
      if (!t) continue;
      // Strip leading "WATCH · " brand prefix if present.
      return t.replace(/^WATCH\s*[·•|:\-—]\s*/i, "").trim();
    }
    return "";
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const t = readTitleSourceText();
      if (!t) return;
      /* CSSOS_WAVE_1888 20260823 (Jing:「哪个代码 hold 住标题不放?不管切歌到哪里, 标题永远不变」)
       *
       * 本模块 2026-05 的使命已经完成, 并且【反转成了危害】:
       *   · 当年: 好几条切歌路径不广播 work-id-changed, 画面大标题冻在第一首 → 用镜像兜底。
       *   · 今天: W1886 已让所有切歌路径(step() 是唯一收口)都广播, 权威按 uuid 取标题;
       *     而本模块五个取值源有四个在 DOM 里已不存在, 只剩 .panel-title —— 连播不更新它。
       *   · 结果: 权威写对新标题后, 本模块立刻拿陈旧的 .panel-title 覆盖回去 = 标题永远不变。
       *
       * 让位规则: 权威已按 uuid(唯一真源)为当前作品定过标题 → 镜像不得改写。
       * 只有权威没发过话(极早期/异常路径)时, 镜像才继续做它的兜底老本行。 */
      try {
        const auth = String(global.__cssosTitleAuthorityValue || "").trim();
        if (auth && auth !== t) return;   // 权威说了算, 镜像闭嘴
      } catch (_e) {}
      try {
        if (typeof global.cssmvRenderMvArtTitle === "function") {
          global.cssmvRenderMvArtTitle(t);
        }
      } catch (_e) { /* non-fatal */ }
    });
  }

  function attachObservers() {
    let attached = 0;
    TITLE_SOURCES.forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el || el.dataset.cssmvMvTitleSync === "1") return;
      el.dataset.cssmvMvTitleSync = "1";
      const mo = new MutationObserver(schedule);
      mo.observe(el, { childList: true, characterData: true, subtree: true });
      attached += 1;
    });
    return attached;
  }

  function boot() {
    attachObservers();
    // CSSOS_PHASE2_LIGHT_BOOT 20260505 — was 250ms × 40 = 10s of
    // polling. Drop to 1s × 15 = 15s with a slower cadence.
    let tries = 0;
    const iv = setInterval(() => {
      attachObservers();
      if (++tries > 15) clearInterval(iv);
    }, 1000);
    setTimeout(schedule, 600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
