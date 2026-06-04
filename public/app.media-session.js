/* CSSOS_MEDIA_SESSION 20260506 — Jing
 *
 * Wire navigator.mediaSession so the OS knows what's playing:
 *   - title + artist + album-art on macOS Now Playing widget,
 *     Windows volume flyout, Android/iOS lockscreen
 *   - play/pause from BT headphones, AirPods double-tap, keyboard
 *     media keys
 *   - seek scrubber in Chrome's media-control dropdown
 *   - previous/next track wired to the up-next strip if present
 *
 * No new UI. Watches watch-video and watch-audio-preview, refreshes
 * metadata when the work changes (title mutation on .panel-title or
 * #cssos-mv-now-playing-title), updates positionState on timeupdate.
 *
 * Browsers without MediaSession (older Safari, some embedded WebViews)
 * silently no-op via the `if (!navigator.mediaSession) return` guard.
 */
(function () {
  "use strict";

  if (!("mediaSession" in navigator)) return;

  function getMedia() {
    var v = document.getElementById("watch-video");
    if (v && !v.paused && v.readyState >= 2) return v;
    var a = document.getElementById("watch-audio-preview");
    if (a && !a.paused && a.readyState >= 2) return a;
    return v || a || null;
  }

  function readWorkInfo() {
    var work =
      globalThis.currentWatchPreviewWork ||
      globalThis.cssmvPipelineLastResult ||
      {};
    var title = String(work.title || "").trim();
    if (!title) {
      var bar = document.querySelector("#watch-panel .panel-title");
      if (bar && bar.textContent) {
        var t = bar.textContent.trim();
        if (t && t.toUpperCase() !== "MV PANEL" && t.toUpperCase() !== "WATCH") title = t;
      }
    }
    var artist = String(work.artist || work.creator_name || work.author || "CSS Studio").trim();
    // WAVE_444c: check all field aliases + fall back to video poster / <meta og:image>
    var artwork = String(
      work.cover_image || work.cover || work.thumbnail ||
      work.cover_url || work.image_url || work.coverImage || ""
    ).trim();
    if (!artwork) {
      // Try the video element's poster (set during MV playback)
      var vid = document.getElementById("watch-video");
      if (vid && vid.poster) artwork = vid.poster;
    }
    if (!artwork) {
      // Try og:image meta tag (set by SSR for shareable work pages)
      var og = document.querySelector('meta[property="og:image"]');
      if (og && og.content) artwork = og.content;
    }
    return { title: title || "CSS Studio", artist: artist, artwork: artwork };
  }

  function pushMetadata() {
    var info = readWorkInfo();
    var artworks = [];
    if (info.artwork) {
      // Provide a few sizes — the OS picks the best fit. We don't
      // actually have multiple resolutions, but supplying the same URL
      // tagged with several `sizes` works fine on every implementation.
      ["96x96", "256x256", "512x512"].forEach(function (sz) {
        artworks.push({ src: info.artwork, sizes: sz, type: "image/jpeg" });
      });
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: info.title,
        artist: info.artist,
        album: "CSS Studio",
        artwork: artworks,
      });
    } catch (_e) {}
  }

  function pushPositionState() {
    var m = getMedia();
    if (!m || !isFinite(m.duration) || m.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: m.duration,
        playbackRate: m.playbackRate || 1,
        position: Math.max(0, Math.min(m.duration, m.currentTime || 0)),
      });
    } catch (_e) {}
  }

  function setPlaybackState() {
    var m = getMedia();
    if (!m) {
      try { navigator.mediaSession.playbackState = "none"; } catch (_e) {}
      return;
    }
    try {
      navigator.mediaSession.playbackState = m.paused ? "paused" : "playing";
    } catch (_e) {}
  }

  function pickActive() {
    var v = document.getElementById("watch-video");
    if (v && v.duration > 0) return v;
    var a = document.getElementById("watch-audio-preview");
    if (a && a.duration > 0) return a;
    return v || a;
  }

  function wireHandlers() {
    var H = navigator.mediaSession;
    var safe = function (action, handler) {
      try { H.setActionHandler(action, handler); } catch (_e) {}
    };
    safe("play", function () {
      var m = pickActive(); if (m) m.play().catch(function () {}); setPlaybackState();
    });
    safe("pause", function () {
      var m = pickActive(); if (m) m.pause(); setPlaybackState();
    });
    safe("seekbackward", function (d) {
      var m = pickActive(); if (!m) return;
      m.currentTime = Math.max(0, (m.currentTime || 0) - (d.seekOffset || 10));
      pushPositionState();
    });
    safe("seekforward", function (d) {
      var m = pickActive(); if (!m) return;
      m.currentTime = Math.min((m.duration || 0) - 0.1, (m.currentTime || 0) + (d.seekOffset || 10));
      pushPositionState();
    });
    safe("seekto", function (d) {
      var m = pickActive(); if (!m) return;
      if (d.fastSeek && typeof m.fastSeek === "function") m.fastSeek(d.seekTime);
      else m.currentTime = d.seekTime;
      pushPositionState();
    });
    safe("previoustrack", function () {
      var btn = document.querySelector(
        "#watch-panel .cssmv-up-next-prev, #watch-panel .up-next-prev, [data-action='mv-prev']"
      );
      if (btn) btn.click();
    });
    safe("nexttrack", function () {
      var btn = document.querySelector(
        "#watch-panel .cssmv-up-next-next, #watch-panel .up-next-next, [data-action='mv-next']"
      );
      if (btn) btn.click();
    });
    safe("stop", function () {
      var m = pickActive(); if (!m) return;
      m.pause(); m.currentTime = 0; setPlaybackState();
    });
  }

  function bindMedia(el) {
    if (!el || el.dataset.cssosMsBound === "1") return;
    el.dataset.cssosMsBound = "1";
    ["play", "playing", "pause", "ended", "loadedmetadata", "durationchange"].forEach(function (ev) {
      el.addEventListener(ev, function () {
        pushMetadata();
        pushPositionState();
        setPlaybackState();
      }, { passive: true });
    });
    var lastTu = 0;
    el.addEventListener("timeupdate", function () {
      var now = Date.now();
      if (now - lastTu < 1000) return; // throttle to 1Hz
      lastTu = now;
      pushPositionState();
    }, { passive: true });
    el.addEventListener("ratechange", pushPositionState, { passive: true });
  }

  function init() {
    wireHandlers();
    bindMedia(document.getElementById("watch-video"));
    bindMedia(document.getElementById("watch-audio-preview"));
    pushMetadata();
    pushPositionState();
    setPlaybackState();
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
      // Title mutations → refresh metadata.
      pushMetadata();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  globalThis.cssosMediaSession = {
    refresh: function () { pushMetadata(); pushPositionState(); setPlaybackState(); },
  };
})();
