/**
 * CSSMV_NO_FALLBACK_TITLE 20260425 #109 — Jing
 * ------------------------------------------------------------------
 *
 *   "现在不是'未标题'了，可是 CSS MV 和'未标题'有什么区别呢？请不要
 *    再 fallback 任何默认的标题，没有标题，就启动歌词引擎去输出，
 *    缺啥补啥，补齐所有引擎遗漏的内容，不要再 fallback 任何默认的
 *    兜底的内容."
 *
 * Two complementary jobs:
 *
 *   1. SCRUB display fallbacks. Several places render
 *      `loginCopy("Untitled")`, `loginCopy("CSS MV")`, or
 *      `loginCopy("未标题")` when a title is missing. We post-process
 *      the rendered text in the few high-visibility surfaces (watch
 *      panel header) to strip the fake-title segment.
 *
 *   2. KICK lyrics engine. When a Watch panel is visible AND the
 *      active title is empty AND no lyrics-seed request is in flight,
 *      fire requestLyricsSeedWithRetryModule("music_video") so the
 *      engine actually generates a title. The "fill whatever's
 *      missing" doctrine — same hook can be extended to other
 *      engine-output gaps later.
 *
 * Implementation is deliberately additive: we never delete the
 * fallback string from upstream code (too many call sites); we just
 * post-process the rendered output and trigger backfill.
 */
(function attachNoFallbackTitle(global) {
  "use strict";

  // Patterns that indicate "fake title was rendered." Match in EN/ZH/JA.
  const FAKE_TITLE_PATTERNS = [
    /\bCSS\s+MV\b/i,
    /\bcssMV\b/i,
    /\bUntitled\b/i,
    /未\s*标题/,
    /未\s*命名/,
    /無\s*題/,
    /\bUntitled\s+theme\b/i
  ];

  function looksFake(text) {
    if (!text) return false;
    return FAKE_TITLE_PATTERNS.some((re) => re.test(text));
  }

  // Strip the "· Untitled" / "· CSS MV" segment from a separator-joined
  // header string like "Watch · Untitled · stage 42%".
  function scrubSegment(text) {
    if (!text) return text;
    // Split on the two common separators (• / · / |) keeping the rest.
    const parts = String(text).split(/\s*[·•|]\s*/);
    const cleaned = parts.filter((p) => !looksFake(String(p || "").trim()));
    if (cleaned.length === parts.length) return text;
    return cleaned.join(" · ");
  }

  function scrubPanelTitle() {
    const el = document.querySelector("#watch-panel .panel-title");
    if (!el) return;
    const cur = el.textContent || "";
    const cleaned = scrubSegment(cur);
    if (cleaned !== cur) el.textContent = cleaned;
  }

  // Watch-frame title (#mv-title or .cssmv-mv-title): if it equals a
  // fake placeholder, blank it out so the placeholder doesn't hijack
  // the random-font glyph treatment.
  function scrubMvTitle() {
    const candidates = [
      document.getElementById("mv-title"),
      document.querySelector(".cssmv-mv-title"),
      document.querySelector("#watch-panel .watch-title")
    ].filter(Boolean);
    candidates.forEach((el) => {
      const cur = String(el.textContent || "").trim();
      if (cur && looksFake(cur)) {
        el.textContent = "";
      }
    });
  }

  // ---------------------------------------------------------------- backfill kick
  let _lastKickAt = 0;
  const KICK_COOLDOWN_MS = 25 * 1000; // don't spam the lyrics endpoint

  function isWatchPanelVisible() {
    const panel = document.getElementById("watch-panel");
    if (!panel) return false;
    if (panel.hidden) return false;
    const cs = window.getComputedStyle(panel);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    return true;
  }

  function currentTitleText() {
    let t = "";
    try {
      t =
        String(
          (global.state && global.state.songSeed && global.state.songSeed.title) ||
          (global.state && global.state.title) ||
          (global.currentWatchPreviewWork && global.currentWatchPreviewWork.title) ||
          ""
        );
    } catch (_e) { /* no-op */ }
    return t.trim();
  }

  function lyricsAlreadyPending() {
    try {
      return !!(global.lyricsSeedRequestState && global.lyricsSeedRequestState.pending);
    } catch (_e) {
      return false;
    }
  }

  function maybeKickLyrics() {
    if (!isWatchPanelVisible()) return;
    if (Date.now() - _lastKickAt < KICK_COOLDOWN_MS) return;
    if (lyricsAlreadyPending()) return;
    const t = currentTitleText();
    if (t && !looksFake(t)) return;
    if (typeof global.requestLyricsSeedWithRetryModule !== "function") return;
    _lastKickAt = Date.now();
    try {
      global.requestLyricsSeedWithRetryModule("music_video", { attempts: 1 })
        .catch(() => { /* swallow — next tick will retry after cooldown */ });
    } catch (_e) { /* no-op */ }
  }

  // ---------------------------------------------------------------- observers
  function attachPanelTitleObserver() {
    const el = document.querySelector("#watch-panel .panel-title");
    if (!el) return false;
    if (el.dataset.cssmvNoFallbackBound === "1") return true;
    el.dataset.cssmvNoFallbackBound = "1";
    const mo = new MutationObserver(() => {
      // Avoid re-entrant loop with our own scrub.
      if (el.dataset.cssmvNoFallbackScrubbing === "1") return;
      el.dataset.cssmvNoFallbackScrubbing = "1";
      try { scrubPanelTitle(); } finally {
        setTimeout(() => { el.dataset.cssmvNoFallbackScrubbing = "0"; }, 0);
      }
    });
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    return true;
  }

  function attachMvTitleObserver() {
    const candidates = [
      document.getElementById("mv-title"),
      document.querySelector(".cssmv-mv-title")
    ].filter(Boolean);
    candidates.forEach((el) => {
      if (el.dataset.cssmvNoFallbackTitleBound === "1") return;
      el.dataset.cssmvNoFallbackTitleBound = "1";
      const mo = new MutationObserver(() => {
        if (el.dataset.cssmvNoFallbackTitleScrubbing === "1") return;
        el.dataset.cssmvNoFallbackTitleScrubbing = "1";
        try { scrubMvTitle(); } finally {
          setTimeout(() => { el.dataset.cssmvNoFallbackTitleScrubbing = "0"; }, 0);
        }
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  function boot() {
    attachPanelTitleObserver();
    attachMvTitleObserver();
    // Initial pass + interval as a safety net for late-mounted nodes.
    scrubPanelTitle();
    scrubMvTitle();
    // CSSOS_PHASE2_LIGHT_BOOT 20260505 — Jing
    // Was 500ms × 600 = 5 min of polling — observers already cover the
    // common cases. Drop to 2 s × 30 = 1 min as a thin safety net for
    // late-mounted nodes; the MutationObservers above handle the rest.
    let tries = 0;
    const iv = setInterval(() => {
      attachPanelTitleObserver();
      attachMvTitleObserver();
      scrubPanelTitle();
      scrubMvTitle();
      maybeKickLyrics();
      if (++tries > 30) clearInterval(iv);
    }, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // Expose for manual debug.
  global.CSSMV_scrubFallbackTitles = function () {
    scrubPanelTitle();
    scrubMvTitle();
  };
  global.CSSMV_kickLyricsForMissingTitle = maybeKickLyrics;
})(typeof globalThis !== "undefined" ? globalThis : window);
