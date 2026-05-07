/* CSSOS_KARAOKE_ACTIVE_WORD 20260506 — Jing
 *
 * Phase 1 fancy-font karaoke. The existing line renderer paints
 * <span class="watch-karaoke-word"> per word. This module marks ONE
 * word at a time with .cssmv-word-hot — that class is what the CSS
 * here animates: fancy-font swap, scale +25%, random-colour shadow,
 * breath glow, optional explode.
 *
 * Phase 1 timing model — when the karaoke line changes, snapshot the
 * media currentTime as line-start. Estimate line duration from the
 * actual gap between line changes (rolling average; default 4s).
 * Distribute words evenly across the line duration. On every audio
 * timeupdate, advance the hot-word index.
 *
 * Phase 2 (when the backend ships per-word timestamps from a Whisper
 * pass during the pipeline) — replace the even-distribution with
 * exact word boundaries by reading `globalThis.cssosKaraokeWords` =
 * [{ text, t_start, t_end }, …]. The renderer below auto-prefers
 * that array if present.
 */
(function () {
  "use strict";

  function ensureStyles() {
    if (document.getElementById("cssos-karaoke-word-style")) return;
    var s = document.createElement("style");
    s.id = "cssos-karaoke-word-style";
    s.textContent =
      ".watch-karaoke-word{transition:transform .18s ease,color .18s ease,letter-spacing .18s ease;}" +
      ".cssmv-word-hot{" +
        "display:inline-block;" +
        "font-family:'Bungee Shade','Rubik Wet Paint','Ranchers','Bungee','Eater','Faster One',cursive,sans-serif !important;" +
        "transform:scale(1.28) translateY(-2px);" +
        "color:#fff !important;" +
        "letter-spacing:0.02em;" +
        "animation:cssmv-word-breath 1.2s ease-in-out infinite,cssmv-word-glow 0.7s ease-in-out infinite alternate;" +
        "padding:0 0.06em;" +
      "}" +
      "@keyframes cssmv-word-breath{" +
        "0%,100%{transform:scale(1.22) translateY(-1px);}" +
        "50%   {transform:scale(1.34) translateY(-3px);}" +
      "}" +
      "@keyframes cssmv-word-glow{" +
        "0%  {text-shadow:0 0 6px rgba(0,245,160,0.85),0 0 14px rgba(255,200,80,0.55),0 0 22px rgba(120,180,255,0.35);}" +
        "33% {text-shadow:0 0 8px rgba(255,80,180,0.85),0 0 16px rgba(255,160,40,0.55),0 0 26px rgba(0,245,160,0.45);}" +
        "66% {text-shadow:0 0 7px rgba(255,255,80,0.9),0 0 14px rgba(120,255,200,0.55),0 0 24px rgba(180,80,255,0.45);}" +
        "100%{text-shadow:0 0 9px rgba(120,180,255,0.9),0 0 18px rgba(255,80,80,0.55),0 0 26px rgba(0,245,160,0.45);}" +
      "}" +
      ".cssmv-word-explode{animation:cssmv-word-explode 0.45s ease-out forwards !important;}" +
      "@keyframes cssmv-word-explode{" +
        "0%  {transform:scale(1.28);filter:blur(0);}" +
        "50% {transform:scale(1.55);filter:blur(0.5px);}" +
        "100%{transform:scale(1.20);filter:blur(0);}" +
      "}";
    document.head.appendChild(s);
  }

  /* Rolling line duration. Start with a safe default; updated when we
   * see the second line change. */
  var lineDurEstimate = 4.0;
  var lastLineChangeTime = -1;

  /* State for current line. */
  var lineWords = [];        // [{ el, text }]
  var lineStartedAt = 0;     // media currentTime when line first appeared
  var hotIdx = -1;

  function getActiveMedia() {
    var v = document.getElementById("watch-video");
    if (v && !v.paused && v.readyState >= 2) return v;
    var a = document.getElementById("watch-audio-preview");
    if (a && !a.paused && a.readyState >= 2) return a;
    return v || a || null;
  }

  function unhotAll() {
    lineWords.forEach(function (w) {
      try { w.el.classList.remove("cssmv-word-hot", "cssmv-word-explode"); } catch (_e) {}
    });
  }

  function snapshotLine() {
    var line = document.querySelector("#watch-karaoke-line, .watch-karaoke-line, .watch-karaoke-current");
    if (!line) { lineWords = []; return; }
    var spans = Array.from(line.querySelectorAll(".watch-karaoke-word"));
    if (!spans.length) {
      // Fall back to splitting raw text into words on the fly.
      var raw = String(line.textContent || "").trim();
      if (!raw) { lineWords = []; return; }
      // Don't mutate the line if no per-word spans exist — just bail
      // (Phase 1 needs per-word spans the renderer already emits).
      lineWords = [];
      return;
    }
    lineWords = spans.map(function (el) {
      return { el: el, text: el.textContent || "" };
    });
  }

  function onLineChanged() {
    var media = getActiveMedia();
    var now = media ? Number(media.currentTime || 0) : 0;
    if (lastLineChangeTime > 0) {
      var dur = Math.max(1.0, Math.min(15.0, now - lastLineChangeTime));
      // Smooth: 70% old, 30% new (responsive but not noisy).
      lineDurEstimate = lineDurEstimate * 0.7 + dur * 0.3;
    }
    lastLineChangeTime = now;
    unhotAll();
    snapshotLine();
    lineStartedAt = now;
    hotIdx = -1;
  }

  /* Phase 2 path — if per-word timings exist, prefer them. Returns
   * the index of the active word at time `t`, or -1 if outside. */
  function indexFromGlobalWords(t) {
    var arr = globalThis.cssosKaraokeWords;
    if (!Array.isArray(arr) || !arr.length) return null;
    for (var i = 0; i < arr.length; i++) {
      var w = arr[i];
      var s = Number(w && w.t_start || 0);
      var e = Number(w && w.t_end || 0);
      if (t >= s && t <= e) return i;
    }
    return -1;
  }

  function tick() {
    if (!lineWords.length) return;
    var media = getActiveMedia();
    if (!media) return;
    var t = Number(media.currentTime || 0);
    var phase2 = indexFromGlobalWords(t);
    var idx;
    if (phase2 !== null) {
      idx = phase2;
    } else {
      // Phase 1 — even distribution within the estimated line duration.
      var elapsed = Math.max(0, t - lineStartedAt);
      var perWord = Math.max(0.08, lineDurEstimate / lineWords.length);
      idx = Math.min(lineWords.length - 1, Math.floor(elapsed / perWord));
    }
    if (idx === hotIdx) return;
    if (hotIdx >= 0 && lineWords[hotIdx]) {
      var prev = lineWords[hotIdx].el;
      // Brief explode on hand-off so the eye notices the swap.
      prev.classList.add("cssmv-word-explode");
      setTimeout(function () {
        try { prev.classList.remove("cssmv-word-hot", "cssmv-word-explode"); } catch (_e) {}
      }, 280);
    }
    hotIdx = idx;
    if (idx >= 0 && lineWords[idx]) {
      lineWords[idx].el.classList.add("cssmv-word-hot");
    }
  }

  function bindObserver() {
    var line = document.querySelector("#watch-karaoke-line, .watch-karaoke-line");
    if (!line || line.dataset.cssosKwBound === "1") return;
    line.dataset.cssosKwBound = "1";
    var mo = new MutationObserver(function () { onLineChanged(); });
    mo.observe(line, { childList: true, characterData: true, subtree: true });
    // First snapshot in case the line is already populated.
    onLineChanged();
  }

  function bindMedia() {
    ["watch-video", "watch-audio-preview"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.cssosKwTickBound === "1") return;
      el.dataset.cssosKwTickBound = "1";
      el.addEventListener("timeupdate", tick, { passive: true });
      el.addEventListener("emptied", function () {
        unhotAll();
        lineWords = [];
        hotIdx = -1;
        lastLineChangeTime = -1;
      }, { passive: true });
    });
  }

  function init() {
    ensureStyles();
    bindObserver();
    bindMedia();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(function () {
      bindObserver();
      bindMedia();
    }).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosKaraokeWord = {
    lineDur: function () { return lineDurEstimate; },
    hotIndex: function () { return hotIdx; },
    /** Phase 2 hook: hand in [{text, t_start, t_end}, …]. */
    setWordTimings: function (arr) {
      globalThis.cssosKaraokeWords = Array.isArray(arr) ? arr : null;
    },
  };
})();
