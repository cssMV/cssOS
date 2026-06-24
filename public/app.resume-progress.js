/* CSSOS_RESUME_PROGRESS 20260506 — Jing
 *
 * Persistent watch progress. When you stop mid-MV (close, switch
 * tabs, navigate away, browser crash) and come back to that work, the
 * player picks up from where you left off.
 *
 * Storage:
 *   localStorage.cssos_resume_<work_id> = { t: <seconds>, ts: <epoch_ms> }
 *
 * Behavior:
 *   - Every 5 s of timeupdate, snapshot currentTime keyed by the
 *     active work id. (Cheap. localStorage write is single-digit
 *     microseconds.)
 *   - On loadedmetadata, look up the saved t. Only resume if:
 *       • t is between 5 s and (duration - 10 s) — otherwise the
 *         start/end was effectively the natural choice
 *       • record is newer than 30 days
 *   - On ended event, clear the entry — finished works don't resume.
 *   - Cap stored entries at 200 to keep localStorage compact; oldest
 *     are evicted when the cap is reached.
 *
 * Public API: cssosResume.clear(workId?) — wipe one or all entries.
 */
(function () {
  "use strict";

  var KEY_PREFIX = "cssos_resume_";
  var INDEX_KEY = "cssos_resume_index";
  var SNAPSHOT_INTERVAL_MS = 5000;
  var MIN_RESUME_SECONDS = 5;
  var TAIL_BUFFER_SECONDS = 10;
  var MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  var MAX_ENTRIES = 200;

  function readIndex() {
    try {
      var raw = localStorage.getItem(INDEX_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(function (s) { return typeof s === "string"; }) : [];
    } catch (_e) { return []; }
  }
  function writeIndex(list) {
    try { localStorage.setItem(INDEX_KEY, JSON.stringify(list.slice(-MAX_ENTRIES))); } catch (_e) {}
  }
  function pruneIfNeeded(workId) {
    var idx = readIndex();
    var pos = idx.indexOf(workId);
    if (pos !== -1) idx.splice(pos, 1);
    idx.push(workId);
    if (idx.length > MAX_ENTRIES) {
      var dropped = idx.splice(0, idx.length - MAX_ENTRIES);
      dropped.forEach(function (id) {
        try { localStorage.removeItem(KEY_PREFIX + id); } catch (_e) {}
      });
    }
    writeIndex(idx);
  }

  function getCurrentWorkId() {
    var w = globalThis.currentWatchPreviewWork;
    if (w && (w.id || w.work_id)) return String(w.id || w.work_id).trim();
    // Try the share-link query param as a last resort.
    try {
      var sp = new URLSearchParams(window.location.search);
      var fromUrl = String(sp.get("cssMV") || "").trim();
      if (fromUrl) return fromUrl;
    } catch (_e) {}
    return "";
  }

  function readResume(workId) {
    if (!workId) return null;
    try {
      var raw = localStorage.getItem(KEY_PREFIX + workId);
      if (!raw) return null;
      var rec = JSON.parse(raw);
      if (!rec || typeof rec.t !== "number" || rec.t <= 0) return null;
      if (Date.now() - Number(rec.ts || 0) > MAX_AGE_MS) {
        // Expired — drop it.
        try { localStorage.removeItem(KEY_PREFIX + workId); } catch (_e) {}
        return null;
      }
      return rec;
    } catch (_e) { return null; }
  }
  function writeResume(workId, t) {
    if (!workId || !(t > 0)) return;
    try {
      localStorage.setItem(KEY_PREFIX + workId, JSON.stringify({ t: Math.floor(t), ts: Date.now() }));
      pruneIfNeeded(workId);
    } catch (_e) {}
  }
  function clearResume(workId) {
    if (workId) {
      try { localStorage.removeItem(KEY_PREFIX + workId); } catch (_e) {}
      var idx = readIndex().filter(function (s) { return s !== workId; });
      writeIndex(idx);
      return;
    }
    // Clear all
    readIndex().forEach(function (id) {
      try { localStorage.removeItem(KEY_PREFIX + id); } catch (_e) {}
    });
    writeIndex([]);
  }

  function bindMedia(el) {
    if (!el || el.dataset.cssosResumeBound === "1") return;
    el.dataset.cssosResumeBound = "1";
    var lastSnapshotAt = 0;
    var resumed = false;
    var tryResume = function () {
      if (resumed) return;
      if (!isFinite(el.duration) || el.duration < MIN_RESUME_SECONDS + TAIL_BUFFER_SECONDS) return;
      var workId = getCurrentWorkId();
      if (!workId) return;
      var rec = readResume(workId);
      if (!rec) return;
      if (rec.t < MIN_RESUME_SECONDS) return;
      if (rec.t > el.duration - TAIL_BUFFER_SECONDS) return;
      try {
        el.currentTime = rec.t;
        resumed = true;
        showResumeToast(rec.t);
      } catch (_e) {}
    };
    el.addEventListener("loadedmetadata", tryResume, { passive: true });
    el.addEventListener("canplay", tryResume, { passive: true });
    el.addEventListener("timeupdate", function () {
      var now = Date.now();
      if (now - lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return;
      lastSnapshotAt = now;
      var workId = getCurrentWorkId();
      if (!workId) return;
      writeResume(workId, el.currentTime);
    }, { passive: true });
    el.addEventListener("ended", function () {
      var workId = getCurrentWorkId();
      if (workId) clearResume(workId);
    }, { passive: true });
    el.addEventListener("emptied", function () {
      // Source switched — reset the resumed flag so the new source can
      // be re-resumed if applicable.
      resumed = false;
    }, { passive: true });
  }

  /* Subtle bottom-toast so the user knows we resumed (and can rewind
   * if they wanted to start over). Shown for 3 seconds, no buttons. */
  function showResumeToast(seconds) {
    var t = document.createElement("div");
    t.id = "cssos-resume-toast";
    var mm = Math.floor(seconds / 60);
    var ss = String(Math.floor(seconds) % 60).padStart(2, "0");
    var en = "Resumed at " + mm + ":" + ss;
    var zh = "从 " + mm + ":" + ss + " 续播";
    var lang = (navigator.language || "en").toLowerCase();
    t.textContent = lang.indexOf("zh") === 0 ? zh : en;
    t.style.cssText =
      "position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(8px);" +
      "z-index:2147483645;padding:8px 14px;border-radius:999px;" +
      "background:var(--panel-strong);color:var(--text);" +
      "font:500 12px/1 ui-monospace,monospace;letter-spacing:.04em;" +
      "border:1px solid rgba(0,245,160,0.3);" +
      "box-shadow:0 12px 28px rgba(0,0,0,0.45);" +
      "opacity:0;transition:opacity .25s ease,transform .25s ease;pointer-events:none;";
    document.body.appendChild(t);
    requestAnimationFrame(function () {
      t.style.opacity = "1";
      t.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(function () {
      t.style.opacity = "0";
      t.style.transform = "translateX(-50%) translateY(8px)";
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 3000);
  }

  function init() {
    bindMedia(document.getElementById("watch-video"));
    bindMedia(document.getElementById("watch-audio-preview"));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(function () {
      bindMedia(document.getElementById("watch-video"));
      bindMedia(document.getElementById("watch-audio-preview"));
    }).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosResume = {
    clear: clearResume,
    /** Read-only inspection helper for debugging. */
    readResume: readResume,
    listIds: readIndex,
  };
})();
