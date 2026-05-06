/* CSSOS_VOLUME_MEMORY 20260506 — Jing
 *
 * Persist <video>/<audio> volume + muted state across sessions. Same
 * affordance every native player has — set it once, it stays.
 *
 * Storage:
 *   localStorage.cssos_volume = "0.0".."1.0"   (string, default "1.0")
 *   localStorage.cssos_muted  = "0" | "1"      (default "0")
 *
 * Behavior:
 *   - On loadedmetadata, apply saved volume + muted to the element.
 *   - On `volumechange`, snapshot back to localStorage (debounced 200ms
 *     so a slider drag doesn't hammer storage).
 *   - Applies to both #watch-video and #watch-audio-preview so the
 *     audio-only fallback path stays in sync.
 */
(function () {
  "use strict";

  var KEY_VOL = "cssos_volume";
  var KEY_MUTE = "cssos_muted";
  var DEBOUNCE_MS = 200;

  function readVol() {
    var v = parseFloat(localStorage.getItem(KEY_VOL));
    if (!isFinite(v) || v < 0 || v > 1) return null;
    return v;
  }
  function readMuted() {
    return localStorage.getItem(KEY_MUTE) === "1";
  }
  function writeVol(v) {
    try { localStorage.setItem(KEY_VOL, String(v)); } catch (_e) {}
  }
  function writeMuted(m) {
    try { localStorage.setItem(KEY_MUTE, m ? "1" : "0"); } catch (_e) {}
  }

  function bind(el) {
    if (!el || el.dataset.cssosVolBound === "1") return;
    el.dataset.cssosVolBound = "1";

    var apply = function () {
      var v = readVol();
      if (v !== null) {
        try { el.volume = v; } catch (_e) {}
      }
      try { el.muted = readMuted(); } catch (_e) {}
    };
    apply();
    el.addEventListener("loadedmetadata", apply, { passive: true });

    var t = 0;
    el.addEventListener("volumechange", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        writeVol(el.volume);
        writeMuted(!!el.muted);
        // Mirror across siblings so video + audio-preview stay in sync
        // when the user only adjusts one.
        ["watch-video", "watch-audio-preview"].forEach(function (id) {
          var other = document.getElementById(id);
          if (other && other !== el) {
            try { other.volume = el.volume; } catch (_e) {}
            try { other.muted = el.muted; } catch (_e) {}
          }
        });
      }, DEBOUNCE_MS);
    }, { passive: true });
  }

  function init() {
    bind(document.getElementById("watch-video"));
    bind(document.getElementById("watch-audio-preview"));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(function () {
      bind(document.getElementById("watch-video"));
      bind(document.getElementById("watch-audio-preview"));
    }).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosVolumeMemory = {
    read: function () { return { volume: readVol(), muted: readMuted() }; },
    clear: function () {
      try { localStorage.removeItem(KEY_VOL); } catch (_e) {}
      try { localStorage.removeItem(KEY_MUTE); } catch (_e) {}
    },
  };
})();
