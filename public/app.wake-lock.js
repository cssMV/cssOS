/* CSSOS_WAVE_195 20260516 — Jing
 *
 * "输出/播放媒体时，禁止屏幕保护程序，禁止黑屏，必须保持屏幕亮着。"
 *
 * Screen Wake Lock API keeps the display on while a media element is
 * actively playing OR the MV pipeline is running. Auto-releases when
 * everything goes idle so battery isn't drained when the user is
 * just reading.
 *
 * Acquire reasons (ref-counted): "media-play" / "pipeline-run". A
 * lock is held as long as ≥ 1 reason is active. Re-acquires
 * automatically when the page comes back from background (iOS / Chrome
 * release locks on visibility hidden — we re-request on visible).
 *
 * Idempotent via __cssosWakeLockWired sentinel.
 */
(function () {
  "use strict";
  if (globalThis.__cssosWakeLockWired) return;
  globalThis.__cssosWakeLockWired = true;

  let sentinel = null;          // WakeLockSentinel
  const activeReasons = new Set();
  let acquiring = false;

  async function actuallyAcquire() {
    if (sentinel) return; // already held
    if (acquiring) return;
    acquiring = true;
    try {
      if (typeof navigator !== "undefined" && navigator.wakeLock && typeof navigator.wakeLock.request === "function") {
        const s = await navigator.wakeLock.request("screen");
        sentinel = s;
        // System can release (e.g. low battery, user lock). Clear our
        // reference so we know to re-acquire when something tries again.
        if (s && typeof s.addEventListener === "function") {
          s.addEventListener("release", () => {
            if (sentinel === s) sentinel = null;
          });
        }
      }
    } catch (_) {
      // Wake Lock API not granted or unsupported — fail silent.
      sentinel = null;
    } finally {
      acquiring = false;
    }
  }

  async function actuallyRelease() {
    if (!sentinel) return;
    const s = sentinel;
    sentinel = null;
    try { await s.release(); } catch (_) {}
  }

  function acquire(reason) {
    if (!reason) return;
    activeReasons.add(reason);
    actuallyAcquire();
  }
  function release(reason) {
    if (!reason) return;
    activeReasons.delete(reason);
    if (activeReasons.size === 0) actuallyRelease();
  }

  // Expose for explicit callers (pipeline runner, custom flows).
  globalThis.cssosWakeLockAcquire = acquire;
  globalThis.cssosWakeLockRelease = release;

  // Re-acquire when the page comes back from background — iOS / Chrome
  // release the lock automatically on visibility hidden.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && activeReasons.size > 0 && !sentinel) {
      actuallyAcquire();
    }
  });

  // ───────────────────────────────────────────────────────────────
  // Auto-wire: any <video> / <audio> on the page acquires "media-play"
  // when it starts and releases when it stops.
  // ───────────────────────────────────────────────────────────────
  function wireMediaElement(el) {
    if (!el || el.__cssosWakeLockBound) return;
    el.__cssosWakeLockBound = true;
    const onPlaying = () => acquire("media-play:" + (el.id || el.src || "anon"));
    const onPaused  = () => release("media-play:" + (el.id || el.src || "anon"));
    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause",   onPaused);
    el.addEventListener("ended",   onPaused);
    el.addEventListener("error",   onPaused);
  }
  function scanMedia() {
    document.querySelectorAll("video, audio").forEach(wireMediaElement);
  }

  // Pipeline run signals — broadcast events the pipeline already fires.
  function bindPipelineSignals() {
    try {
      window.addEventListener("cssos:run_started",  () => acquire("pipeline-run"), { passive: true });
      window.addEventListener("cssmv:run-started",  () => acquire("pipeline-run"), { passive: true });
      window.addEventListener("cssos:run_finished", () => release("pipeline-run"), { passive: true });
      window.addEventListener("cssmv:run-finish",   () => release("pipeline-run"), { passive: true });
      window.addEventListener("cssmv:stage-error",  () => release("pipeline-run"), { passive: true });
    } catch (_) {}
  }

  function init() {
    scanMedia();
    bindPipelineSignals();
    // Watch for media elements added later (cinema hero, watch panel,
    // chat work cards, etc.).
    try {
      const mo = new MutationObserver((records) => {
        for (const rec of records) {
          if (!rec.addedNodes) continue;
          for (const n of rec.addedNodes) {
            if (!n || n.nodeType !== 1) continue;
            if (n.tagName === "VIDEO" || n.tagName === "AUDIO") {
              wireMediaElement(n);
            } else if (typeof n.querySelectorAll === "function") {
              n.querySelectorAll("video, audio").forEach(wireMediaElement);
            }
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
