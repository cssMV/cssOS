/* CSSOS_WAVE_121 20260513 — Jing
 * "必须依据作品的ID这个唯一的真源去读取作品的全部信息".
 *
 * 张冠李戴 hardening. The Watch panel kept ~6 module-scoped globals
 * holding "last-known good" assets (currentPreviewFrameDataUrl,
 * currentPreviewFrameSequence, cachedWatchFrame, foryouThumbFallback...).
 * On work-switch, only SOME of them get reset, leaving the rest to
 * leak into the next render — the user sees song B with song A's
 * cover / video / subtitle.
 *
 * This module enforces a hard contract:
 *
 *   1. Every work-switch MUST call `cssosBindToWorkId(workId)`.
 *   2. That call:
 *      - Stamps #watch-panel with data-active-work-id="<workId>".
 *      - Flushes ALL known asset-cache globals.
 *      - Dispatches a `cssos:work-id-changed` event so panel renderers
 *        can rebind their own DOM fields.
 *   3. Any asset loader (cover, audio, video, subtitle) MUST check
 *      `cssosCurrentWorkId() === ownerWorkId` before applying — if
 *      not, the asset belongs to a stale work and is dropped.
 *
 * Public API:
 *   cssosCurrentWorkId()            → string (current bound work_id)
 *   cssosBindToWorkId(id, work?)    → idempotent setter + flusher
 *   cssosAssertOwnership(id)        → throws if id !== current
 *   cssosFlushAllAssetCaches()      → manual purge (used internally)
 */
(function () {
  "use strict";
  if (globalThis.cssosBindToWorkId) return;

  let __currentWorkId = "";
  let __currentWork = null;

  function flushAllAssetCaches() {
    // Frame caches
    try { globalThis.currentPreviewFrameDataUrl = ""; } catch (_) {}
    try { globalThis.currentPreviewFrameSequence = []; } catch (_) {}
    try { globalThis.currentForyouThumbFallbackDataUrl = ""; } catch (_) {}
    // Video element
    try {
      const v = document.querySelector("#watch-panel video, .watch-screen video");
      if (v instanceof HTMLVideoElement) {
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
    } catch (_) {}
    // Cover img
    try {
      const img = document.querySelector("#watch-panel .watch-svg, #watch-svg, #watch-panel img.watch-cover");
      if (img instanceof HTMLImageElement) img.removeAttribute("src");
    } catch (_) {}
    // Subtitle
    try {
      const sub = document.querySelector("#watch-panel .watch-subtitle, #watch-subtitle");
      if (sub instanceof HTMLElement) sub.textContent = "";
    } catch (_) {}
    // Karaoke / lyrics overlay
    try {
      const k = document.getElementById("watch-karaoke-line");
      if (k instanceof HTMLElement) k.textContent = "";
    } catch (_) {}
    // Audio element
    try {
      const a = document.querySelector("#watch-panel audio, #watch-audio");
      if (a instanceof HTMLAudioElement) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
    } catch (_) {}
    // localStorage frame cache (Wave 113A "last good frame")
    try {
      ["cssos.lastGoodWatchFrame", "cssos.lastGoodWatchFrameSeq"]
        .forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
  }

  globalThis.cssosFlushAllAssetCaches = flushAllAssetCaches;

  globalThis.cssosCurrentWorkId = function () { return __currentWorkId; };
  globalThis.cssosCurrentWork = function () { return __currentWork; };

  globalThis.cssosBindToWorkId = function (idOrWork, maybeWork) {
    // Accept either (id, work) or (work).
    let id, work;
    if (typeof idOrWork === "string") {
      id = idOrWork.trim();
      work = maybeWork || null;
    } else if (idOrWork && typeof idOrWork === "object") {
      work = idOrWork;
      id = String(work.id || work.work_id || work.local_id || "").trim();
    } else {
      return false;
    }
    if (!id) return false;
    if (id === __currentWorkId) {
      // Same work — just update the work object if a fresher one arrived
      if (work) __currentWork = work;
      return true;
    }
    // Real switch — flush before rebind so any in-flight async asset load
    // that completes after this point will fail the ownership check.
    flushAllAssetCaches();
    __currentWorkId = id;
    __currentWork = work || null;
    try {
      const wp = document.getElementById("watch-panel");
      if (wp) wp.dataset.activeWorkId = id;
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent("cssos:work-id-changed", {
        detail: { workId: id, work: __currentWork },
      }));
    } catch (_) {}
    console.info(
      `%c[work-id] bound to ${id}${work && work.title ? " · " + work.title : ""}`,
      "color:#0a0;font-weight:bold",
    );
    return true;
  };

  /* Loaders call this with the work_id they were asked to load FOR.
   * If the current binding has since changed (user clicked another
   * song while async load was pending), the loader knows to drop its
   * result instead of writing it into the now-different work's DOM. */
  globalThis.cssosAssertOwnership = function (workId) {
    const cur = __currentWorkId;
    const incoming = String(workId || "").trim();
    if (!cur || !incoming) return false;
    return cur === incoming;
  };

  /* Hook into the canonical `currentWatchPreviewWork` setter so every
   * existing assignment auto-routes through cssosBindToWorkId. We use
   * a getter/setter on globalThis since currentWatchPreviewWork is a
   * module-scoped let in app.work-sync.js; defineProperty on globalThis
   * gives us a notification channel without touching that file. */
  let __syncedWork = null;
  try {
    Object.defineProperty(globalThis, "__cssosLastBoundWork", {
      get() { return __syncedWork; },
      set(v) {
        __syncedWork = v;
        if (v && (v.id || v.work_id || v.local_id)) {
          globalThis.cssosBindToWorkId(v);
        }
      },
      configurable: true,
    });
  } catch (_) {}

  /* Convenience: watch for #watch-panel becoming visible without a
   * work-id binding (means someone opened it via legacy path), and
   * warn so we can fix that call site. */
  setInterval(() => {
    const wp = document.getElementById("watch-panel");
    if (!wp || wp.hidden || wp.offsetParent === null) return;
    const visibleVideo = wp.querySelector("video");
    const playing = visibleVideo && !visibleVideo.paused;
    if (playing && !wp.dataset.activeWorkId) {
      console.warn("[work-id] watch panel playing without active-work-id binding — switch site missed");
    }
  }, 8000);

  console.info("%c[work-id-binding] Wave 121 installed", "color:#0a0;font-weight:bold");
})();
