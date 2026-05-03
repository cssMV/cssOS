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
    // Sources may not exist at first boot; retry briefly.
    let tries = 0;
    const iv = setInterval(() => {
      attachObservers();
      if (++tries > 40) clearInterval(iv);
    }, 250);
    // Initial sync once everything is wired.
    setTimeout(schedule, 600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
