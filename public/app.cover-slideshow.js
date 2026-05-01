// app.cover-slideshow.js
// 5-image cover slideshow for Watch panel:
//   MV tab (#watch-svg): slideshow until video starts, then auto-handoff to video.
//   Music tab (#watch-music-art + #watch-music-disc vinyl center): slideshow always on.
//
// Timing (parameterized, per image): FADE_IN_MS + MAIN_MS + FADE_OUT_MS (defaults: 5s/5s/5s).
// Principles: 一切参数化 · 零输入时仍有体验 · i18n 不直接暴露（纯视觉）

(function initCoverSlideshowModule() {
  "use strict";
  // CSSOS_PHASE2_SLIDESHOW_INTENSITY 20260430 #200 — Jing
  // "幻灯片强度滑块." User-tunable speed via globalThis.cssmvSetSlideshowIntensity(0..1).
  //   0.0 = ultra-slow (60s per frame, contemplative cinema)
  //   0.5 = default (15s per frame, current behaviour)
  //   1.0 = fast (3s per frame, energetic music-video)
  // Persisted to localStorage. Reads back on init so the user's last
  // preference survives reloads.
  const STORAGE_KEY = "cssmv.slideshow.intensity";
  let intensity = 0.5;
  try {
    const v = parseFloat(localStorage.getItem(STORAGE_KEY) || "");
    if (Number.isFinite(v) && v >= 0 && v <= 1) intensity = v;
  } catch (_e) {}

  const computeTimings = (level) => {
    // Linear interpolation from slow→fast; same fade/main split kept
    // (~33% fade-in / 33% main / 33% fade-out) so the transitions stay
    // smooth at every speed.
    const totalMs = Math.round(60000 - (60000 - 3000) * level); // 60s..3s
    const each = Math.max(800, Math.floor(totalMs / 3));
    return { FADE_IN_MS: each, MAIN_MS: each, FADE_OUT_MS: each, TICK_MS: each * 3 };
  };

  let { FADE_IN_MS, MAIN_MS, FADE_OUT_MS, TICK_MS } = computeTimings(intensity);

  const state = {
    slides: [],             // string[] of URLs
    mvIndex: 0,
    musicIndex: 0,
    mvTimer: null,
    musicTimer: null,
    mvActive: false,
    musicActive: false
  };

  // Public setter so the watch panel slider can live-tune intensity.
  globalThis.cssmvSetSlideshowIntensity = function (level) {
    const v = Math.max(0, Math.min(1, Number(level) || 0));
    intensity = v;
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch (_e) {}
    const t = computeTimings(v);
    FADE_IN_MS = t.FADE_IN_MS;
    MAIN_MS = t.MAIN_MS;
    FADE_OUT_MS = t.FADE_OUT_MS;
    TICK_MS = t.TICK_MS;
    // Re-inject the CSS so existing slides pick up new transition durations.
    const old = document.getElementById("cssmv-cover-slideshow-styles");
    if (old) old.remove();
    if (typeof ensureStyles === "function") ensureStyles();
    return { intensity: v, frameMs: TICK_MS };
  };
  globalThis.cssmvGetSlideshowIntensity = function () { return intensity; };

  ensureStyles();

  function ensureStyles() {
    if (document.getElementById("cssmv-cover-slideshow-styles")) return;
    const st = document.createElement("style");
    st.id = "cssmv-cover-slideshow-styles";
    st.textContent = `
.cssmv-cover-slide {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  opacity: 0;
  transition: opacity ${FADE_IN_MS}ms ease-in-out;
  pointer-events: none;
  border-radius: inherit;
  z-index: 0;
}
.cssmv-cover-slide.is-visible { opacity: 1; }
.cssmv-cover-slide.is-fading-out { transition: opacity ${FADE_OUT_MS}ms ease-in-out; opacity: 0; }
#watch-music-art.cssmv-slideshow-host,
#watch-music-disc.cssmv-slideshow-host {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
#watch-svg.cssmv-slideshow-host { position: relative; overflow: hidden; }
`;
    document.head.appendChild(st);
  }

  // ---------- Public API ----------

  globalThis.cssmvSetCoverSlides = function cssmvSetCoverSlides(list) {
    if (!Array.isArray(list)) return;
    const cleaned = list
      .map((u) => (typeof u === "string" ? u.trim() : ""))
      .filter((u) => !!u);
    // de-dup while preserving order
    const seen = new Set();
    state.slides = cleaned.filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
    if (!state.slides.length) return;
    // Immediately render current frame on whichever host is active.
    if (state.mvActive) renderMvFrame(state.mvIndex % state.slides.length);
    if (state.musicActive) renderMusicFrame(state.musicIndex % state.slides.length);
  };

  globalThis.cssmvAddCoverSlide = function cssmvAddCoverSlide(url) {
    if (typeof url !== "string") return;
    const u = url.trim();
    if (!u) return;
    if (state.slides.includes(u)) return;
    state.slides.push(u);
    if (state.slides.length === 1) {
      if (state.mvActive) renderMvFrame(0);
      if (state.musicActive) renderMusicFrame(0);
    }
  };

  globalThis.cssmvStartCoverSlideshow = function cssmvStartCoverSlideshow(opts = {}) {
    const wantMv = opts.mv !== false;
    const wantMusic = opts.music !== false;
    if (wantMv) startMv();
    if (wantMusic) startMusic();
  };

  globalThis.cssmvStopCoverSlideshowMvOnly = function cssmvStopCoverSlideshowMvOnly() {
    stopMv();
  };

  globalThis.cssmvStopCoverSlideshow = function cssmvStopCoverSlideshow() {
    stopMv();
    stopMusic();
  };

  // ---------- MV tab host (#watch-svg) ----------

  function mvHost() { return document.getElementById("watch-svg"); }

  function startMv() {
    const host = mvHost();
    if (!host) return;
    if (state.mvActive) return;
    if (host.tagName !== "IMG") host.classList.add("cssmv-slideshow-host");
    state.mvActive = true;
    state.mvIndex = 0;
    if (state.slides.length) renderMvFrame(state.mvIndex);
    state.mvTimer = setInterval(() => {
      if (!state.slides.length) return;
      state.mvIndex = (state.mvIndex + 1) % state.slides.length;
      renderMvFrame(state.mvIndex);
    }, TICK_MS);
  }

  function stopMv() {
    if (state.mvTimer) {
      clearInterval(state.mvTimer);
      state.mvTimer = null;
    }
    state.mvActive = false;
    const host = mvHost();
    if (host) {
      if (host.tagName === "IMG") {
        host.style.display = "none";
        host.style.opacity = "";
        host.removeAttribute("src");
      } else {
        host.querySelectorAll(".cssmv-cover-slide").forEach((el) => el.remove());
        host.classList.remove("cssmv-slideshow-host");
      }
    }
  }

  function renderMvFrame(idx) {
    const host = mvHost();
    if (!host || !state.slides.length) return;
    const url = state.slides[idx % state.slides.length];
    if (!url) return;
    if (host.tagName === "IMG") {
      if (host.getAttribute("src") !== url) host.src = url;
      host.style.display = "block";
      host.style.opacity = "1";
      return;
    }
    injectSlide(host, url);
  }

  // ---------- Music tab hosts (#watch-music-art + #watch-music-disc) ----------

  function musicHosts() {
    const a = document.getElementById("watch-music-art");
    const d = document.getElementById("watch-music-disc");
    return [a, d].filter(Boolean);
  }

  function startMusic() {
    const hosts = musicHosts();
    if (!hosts.length) return;
    if (state.musicActive) return;
    hosts.forEach((h) => h.classList.add("cssmv-slideshow-host"));
    state.musicActive = true;
    state.musicIndex = 0;
    if (state.slides.length) renderMusicFrame(state.musicIndex);
    state.musicTimer = setInterval(() => {
      if (!state.slides.length) return;
      state.musicIndex = (state.musicIndex + 1) % state.slides.length;
      renderMusicFrame(state.musicIndex);
    }, TICK_MS);
  }

  function stopMusic() {
    if (state.musicTimer) {
      clearInterval(state.musicTimer);
      state.musicTimer = null;
    }
    state.musicActive = false;
    musicHosts().forEach((host) => {
      host.querySelectorAll(".cssmv-cover-slide").forEach((el) => el.remove());
      host.classList.remove("cssmv-slideshow-host");
    });
  }

  function renderMusicFrame(idx) {
    const hosts = musicHosts();
    if (!hosts.length || !state.slides.length) return;
    const url = state.slides[idx % state.slides.length];
    if (!url) return;
    hosts.forEach((h) => injectSlide(h, url));
    const stage = document.getElementById("watch-music-stage");
    if (stage) {
      const cssUrl = `url("${url.replace(/"/g, '\\"')}")`;
      stage.style.setProperty("--watch-music-art-image", cssUrl);
      stage.style.setProperty("--watch-music-backdrop-image", cssUrl);
    }
  }

  // ---------- slide injection (5s fade-in / 5s main / 5s fade-out) ----------

  function injectSlide(host, url) {
    // CSSMV_SLIDESHOW_STIFF_FIX 20260420 — Jing: previously we only
    // self-faded when slides.length <= 1 and relied on the next tick to
    // cross-fade multi-slide case. That caused the outgoing slide to
    // still be at full opacity when the next one arrived, so both fires
    // on the same frame and the transition looked "生硬". Now EVERY
    // slide self-fades at exactly FADE_IN_MS + MAIN_MS (10s), leaving
    // FADE_OUT_MS (5s) of clean empty-canvas before the next TICK_MS
    // rolls and the next slide fades in. That yields the user's spec
    // exactly: 5s fade-in + 5s stay + 5s fade-out per slide.
    // Fade out existing top slide(s) — only used if a new slide arrives
    // before self-fade fires (e.g. manual set on an active host).
    const existing = Array.from(host.querySelectorAll(".cssmv-cover-slide.is-visible"));
    existing.forEach((el) => {
      el.classList.remove("is-visible");
      el.classList.add("is-fading-out");
      setTimeout(() => { try { el.remove(); } catch (_e) {} }, FADE_OUT_MS + 200);
    });
    const next = document.createElement("div");
    next.className = "cssmv-cover-slide";
    next.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
    host.appendChild(next);
    // Force reflow then mark visible so the 5s opacity transition runs.
    void next.offsetWidth;
    next.classList.add("is-visible");
    // Self-fade at FADE_IN_MS + MAIN_MS so each slide completes its own
    // full in/stay/out cycle independent of the next tick.
    setTimeout(() => {
      if (!next.isConnected) return;
      if (!next.classList.contains("is-visible")) return;
      next.classList.remove("is-visible");
      next.classList.add("is-fading-out");
      setTimeout(() => { try { next.remove(); } catch (_e) {} }, FADE_OUT_MS + 200);
    }, FADE_IN_MS + MAIN_MS);
  }

  // ---------- Watch panel video-start (no handoff — keep slideshow running) ----------
  // CSSMV_SLIDESHOW_ALWAYS_ON 20260420 — Jing: the cover / backdrop / vinyl
  // should slideshow during BOTH output (generation) and playback. Previously
  // we stopped the MV slideshow as soon as the video started playing, which
  // hid the cycling backdrop. Now we leave it running; the video renders on
  // top of the slideshow, so the slideshow drives the visible frame area
  // around the video and stays ready if the user switches back to Music tab.
  document.addEventListener("DOMContentLoaded", wireVideoHandoff, { once: true });
  if (document.readyState === "interactive" || document.readyState === "complete") {
    wireVideoHandoff();
  }

  function wireVideoHandoff() {
    // Intentionally no-op: video start no longer stops the slideshow.
    // Kept as a hook so future per-play behaviors can land here without
    // touching pipeline code.
    return;
  }
})();
