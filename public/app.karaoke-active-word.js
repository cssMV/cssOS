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

  /* ============== Parameters (read from localStorage + sane defaults)
   * Override at runtime via globalThis.cssosKaraokeWord.config({...}).
   * All values flow through CSS custom properties so changes apply
   * without rewriting the stylesheet. */
  var DEFAULTS = {
    enabled: true,
    lookahead_s: 0.18,        // ear-eye alignment offset
    scale_base: 1.6,          // hot word base size multiplier
    scale_breath_min: 1.55,   // breath bottom
    scale_breath_max: 1.78,   // breath peak
    scale_explode: 2.0,       // explode peak on hand-off
    breath_ms: 1000,          // breath cycle
    glow_ms: 600,             // glow cycle (alternates)
    explode_ms: 300,          // explode duration
    color: "#fff",            // hot word color
    letter_spacing_em: 0.04,  // hot word letter-spacing
    padding_em: 0.1,          // hot word horizontal padding
    font_pool: "'Bungee Shade','Rubik Wet Paint','Bungee Outline','Faster One','Monoton','Eater','Bungee','Permanent Marker','Lobster',cursive,sans-serif",
  };
  function readConfig() {
    var saved = {};
    try {
      var raw = localStorage.getItem("cssos_karaoke_config");
      if (raw) saved = JSON.parse(raw) || {};
    } catch (_e) {}
    return Object.assign({}, DEFAULTS, saved);
  }
  function writeConfig(patch) {
    var cfg = Object.assign(readConfig(), patch || {});
    try { localStorage.setItem("cssos_karaoke_config", JSON.stringify(cfg)); } catch (_e) {}
    applyConfigToCss(cfg);
    return cfg;
  }
  function applyConfigToCss(cfg) {
    cfg = cfg || readConfig();
    var root = document.documentElement;
    root.style.setProperty("--cssmv-kw-lookahead", String(cfg.lookahead_s));
    root.style.setProperty("--cssmv-kw-scale", String(cfg.scale_base));
    root.style.setProperty("--cssmv-kw-scale-breath-min", String(cfg.scale_breath_min));
    root.style.setProperty("--cssmv-kw-scale-breath-max", String(cfg.scale_breath_max));
    root.style.setProperty("--cssmv-kw-scale-explode", String(cfg.scale_explode));
    root.style.setProperty("--cssmv-kw-breath-ms", cfg.breath_ms + "ms");
    root.style.setProperty("--cssmv-kw-glow-ms", cfg.glow_ms + "ms");
    root.style.setProperty("--cssmv-kw-explode-ms", cfg.explode_ms + "ms");
    root.style.setProperty("--cssmv-kw-color", cfg.color);
    root.style.setProperty("--cssmv-kw-letter-spacing", cfg.letter_spacing_em + "em");
    root.style.setProperty("--cssmv-kw-padding", "0 " + cfg.padding_em + "em");
    root.style.setProperty("--cssmv-kw-font-pool", cfg.font_pool);
  }

  function ensureStyles() {
    if (document.getElementById("cssos-karaoke-word-style")) return;
    applyConfigToCss();
    var s = document.createElement("style");
    s.id = "cssos-karaoke-word-style";
    s.textContent =
      ".watch-karaoke-line .watch-karaoke-word{transition:transform .15s ease,letter-spacing .15s ease;}" +
      ".watch-karaoke-line .watch-karaoke-word.cssmv-word-hot," +
      ".watch-karaoke-current .watch-karaoke-word.cssmv-word-hot{" +
        "display:inline-block;" +
        "font-family:var(--cssmv-kw-font-pool) !important;" +
        "transform:scale(var(--cssmv-kw-scale)) translateY(-3px);" +
        "color:var(--cssmv-kw-color) !important;" +
        "letter-spacing:var(--cssmv-kw-letter-spacing);" +
        "animation:cssmv-word-breath var(--cssmv-kw-breath-ms) ease-in-out infinite," +
                  "cssmv-word-glow var(--cssmv-kw-glow-ms) ease-in-out infinite alternate !important;" +
        "padding:var(--cssmv-kw-padding);" +
        "z-index:10;position:relative;" +
      "}" +
      "@keyframes cssmv-word-breath{" +
        "0%,100%{transform:scale(var(--cssmv-kw-scale-breath-min)) translateY(-2px);}" +
        "50%   {transform:scale(var(--cssmv-kw-scale-breath-max)) translateY(-5px);}" +
      "}" +
      "@keyframes cssmv-word-glow{" +
        "0%  {text-shadow:0 0 6px rgba(0,245,160,1),0 0 14px rgba(255,200,80,0.7),0 0 24px rgba(120,180,255,0.5);}" +
        "33% {text-shadow:0 0 8px rgba(255,80,180,1),0 0 18px rgba(255,160,40,0.7),0 0 28px rgba(0,245,160,0.55);}" +
        "66% {text-shadow:0 0 7px rgba(255,255,80,1),0 0 16px rgba(120,255,200,0.7),0 0 26px rgba(180,80,255,0.55);}" +
        "100%{text-shadow:0 0 9px rgba(120,180,255,1),0 0 20px rgba(255,80,80,0.7),0 0 28px rgba(0,245,160,0.55);}" +
      "}" +
      ".watch-karaoke-line .watch-karaoke-word.cssmv-word-explode{animation:cssmv-word-explode var(--cssmv-kw-explode-ms) ease-out forwards !important;}" +
      "@keyframes cssmv-word-explode{" +
        "0%  {transform:scale(var(--cssmv-kw-scale));filter:blur(0);}" +
        "50% {transform:scale(var(--cssmv-kw-scale-explode));filter:blur(0.6px);}" +
        "100%{transform:scale(1.0);filter:blur(0);}" +
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

  /* Alignment lookahead — read from config so the user can tune. */
  function getLookahead() { return Number(readConfig().lookahead_s) || 0; }

  function applyHotByTime() {
    if (!readConfig().enabled) return;
    if (!lineWords.length) return;
    var media = getActiveMedia();
    if (!media) return;
    var t = Number(media.currentTime || 0) + getLookahead();
    var phase2 = indexFromGlobalWords(t);
    var idx;
    if (phase2 !== null && phase2 >= 0) {
      // Phase 2 path uses the GLOBAL word array (Whisper). But our
      // lineWords are the spans of the CURRENT line only. Map global
      // index → current line by matching text content.
      var arr = globalThis.cssosKaraokeWords;
      var hotText = arr[phase2] && arr[phase2].text ? String(arr[phase2].text).toLowerCase().replace(/[^\w一-鿿]/g, "") : "";
      if (hotText) {
        var found = -1;
        for (var i = 0; i < lineWords.length; i++) {
          var lt = String(lineWords[i].text || "").toLowerCase().replace(/[^\w一-鿿]/g, "");
          if (lt && (lt === hotText || lt.indexOf(hotText) >= 0 || hotText.indexOf(lt) >= 0)) {
            found = i; break;
          }
        }
        idx = found >= 0 ? found : -1;
      } else {
        idx = -1;
      }
    } else {
      // Phase 1 — even distribution within the estimated line duration.
      var elapsed = Math.max(0, t - lineStartedAt);
      var perWord = Math.max(0.08, lineDurEstimate / lineWords.length);
      idx = Math.min(lineWords.length - 1, Math.floor(elapsed / perWord));
    }
    if (idx === hotIdx) return;
    if (hotIdx >= 0 && lineWords[hotIdx]) {
      var prev = lineWords[hotIdx].el;
      prev.classList.add("cssmv-word-explode");
      setTimeout(function () {
        try { prev.classList.remove("cssmv-word-hot", "cssmv-word-explode"); } catch (_e) {}
      }, 220);
    }
    hotIdx = idx;
    if (idx >= 0 && lineWords[idx]) {
      var hotEl = lineWords[idx].el;
      hotEl.classList.add("cssmv-word-hot");
      // The renderer writes font-family inline (style="font-family:..."),
      // which beats class-based CSS even with !important. Override by
      // clearing the inline rule on the hot word so our class wins.
      try { hotEl.style.removeProperty("font-family"); } catch (_e) {}
    }
  }
  function tick() { applyHotByTime(); }

  function bindObserver() {
    var line = document.querySelector("#watch-karaoke-line, .watch-karaoke-line");
    if (!line || line.dataset.cssosKwBound === "1") return;
    line.dataset.cssosKwBound = "1";
    /* The renderer rebuilds .watch-karaoke-word spans on every
     * timeupdate (~4Hz). Each rebuild blows away our hot class. So
     * after every mutation: 1) detect if line text changed (new line
     * → reset line-start timer); 2) re-snapshot lineWords; 3) re-pick
     * hot index for the current time. The whole flow runs in <1ms. */
    var lastLineText = "";
    var mo = new MutationObserver(function () {
      var current = String(line.textContent || "").trim();
      var lineChanged = current !== lastLineText;
      lastLineText = current;
      if (lineChanged) {
        onLineChanged();
      } else {
        // Same line, renderer just rebuilt spans — re-snapshot + reapply.
        snapshotLine();
        hotIdx = -1; // force reapply
        applyHotByTime();
      }
    });
    mo.observe(line, { childList: true, characterData: true, subtree: true });
    onLineChanged();
    lastLineText = String(line.textContent || "").trim();
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

  /* CSSOS_PHASE3_KARAOKE_BRIDGE — pull per-word Whisper timings off
   * the loaded work payload (server attaches `karaoke_words` to the
   * /api/works/public/:id response when a Whisper pass has run). The
   * bridge polls the work-sync global periodically + reacts on every
   * src change so a queue-jump picks up the new song's words. */
  var _transcribeRequestedFor = "";
  function syncWordsFromWork() {
    var w = globalThis.currentWatchPreviewWork || {};
    var arr = (Array.isArray(w.karaoke_words) ? w.karaoke_words :
               Array.isArray(w.whisper_words) ? w.whisper_words : null);
    if (arr && arr.length) {
      globalThis.cssosKaraokeWords = arr;
      return;
    }
    // No transcription yet — fall back to Phase 1 even-distribution
    // and request a server-side Whisper pass so the next time the user
    // plays this work, exact word timings are ready.
    globalThis.cssosKaraokeWords = null;
    var workId = String(w.id || w.work_id || "").trim();
    if (!workId || _transcribeRequestedFor === workId) return;
    _transcribeRequestedFor = workId;
    try {
      fetch("/api/works/" + encodeURIComponent(workId) + "/karaoke/transcribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
      }).catch(function () {});
    } catch (_e) {}
  }

  function init() {
    ensureStyles();
    bindObserver();
    bindMedia();
    syncWordsFromWork();
    // Every loadstart on either media element = potentially a new
    // work — re-sync.
    ["watch-video", "watch-audio-preview"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("loadstart", syncWordsFromWork, { passive: true });
      el.addEventListener("emptied", syncWordsFromWork, { passive: true });
    });
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
    /** Read current config (defaults merged with localStorage). */
    config: function () { return readConfig(); },
    /** Patch config — partial object, persists to localStorage,
     * re-applies CSS variables immediately. */
    setConfig: function (patch) { return writeConfig(patch); },
    /** Restore to factory defaults. */
    resetConfig: function () {
      try { localStorage.removeItem("cssos_karaoke_config"); } catch (_e) {}
      applyConfigToCss();
      return readConfig();
    },
    /** Sugar — the most common knobs the user might want from the
     * console without remembering field names. */
    setLookahead: function (sec) { return writeConfig({ lookahead_s: Number(sec) }); },
    setScale: function (n) { return writeConfig({ scale_base: Number(n), scale_breath_min: Number(n) * 0.97, scale_breath_max: Number(n) * 1.11, scale_explode: Number(n) * 1.25 }); },
    enable: function (on) { return writeConfig({ enabled: !!on }); },
  };
})();
