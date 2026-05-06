// app.watch-media-chrome.js
// CSSOS_PHASE2_MV_CHROME_CLEANUP 20260420 —
// Playback-time chrome for Watch panel (post-cleanup edition):
//   • MV tab: linear media-frame progress + time-code (total + trailing remaining)
//     — progress bar uses a *flowing* rainbow gradient (per Jing 2026-04-20:
//       "进度条的随机颜色是游动的，不是静止的")
//   • Custom hollow/镂空 play/pause button (MV + Music), auto-hides after idle
//   • Removes native HTMLMedia default controls
//
// REMOVED in this cleanup pass:
//   - .cssmv-pb-border-*  (the 4 thin panel-perimeter bars — replaced by
//     app.watch-stage-bars.js rounded-rect perimeter progress)
//   - .cssmv-music-ring / -track / -fill  (the old inner purple ring on the
//     vinyl — replaced by app.watch-music-ring.js curved outer ring)
//   - .cssmv-music-timecode / -total / -remaining  (the old orbiting pill
//     timecodes — replaced by textPath-curved timecodes on the outer ring)
//   - pickNewPlaybackColor + color-refresh interval (colors now flow via CSS
//     keyframe animation on the gradient background-position, no JS poke needed)

(function initWatchMediaChromeModule() {
  "use strict";

  const CONFIG = {
    BUTTON_IDLE_HIDE_MS: 2500,
    END_GLOW_MS: 1600,
    // CSSOS_PHASE2_MV_CHROME_CLEANUP 20260420 — colors for the flowing rainbow
    // gradient on the MV frame bar. Kept parameterized so theme work can
    // re-tune the palette without touching the keyframes.
    HUE_FLOW_MS: 2400,
  };

  const VIDEO_ID = "watch-video";
  const AUDIO_ID = "watch-audio-preview";

  function formatTimecode(secs) {
    if (!Number.isFinite(secs) || secs < 0) secs = 0;
    const s = Math.floor(secs);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    if (mm < 60) return `${mm}:${String(ss).padStart(2, "0")}`;
    const hh = Math.floor(mm / 60);
    const mRem = mm % 60;
    return `${hh}:${String(mRem).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  // ---------- one-time style injection ----------

  function ensureStyles() {
    if (document.getElementById("cssmv-media-chrome-styles")) return;
    const st = document.createElement("style");
    st.id = "cssmv-media-chrome-styles";
    st.textContent = `
/* ===== MV media frame linear progress bar (flowing rainbow) =====
 *   CSSOS_PHASE2_MV_CHROME_CLEANUP 20260420
 *   Uses a scrolling rainbow gradient so the color "flows" (游动) rather
 *   than stepping discretely. Length of fill still tracks playback frac. */
.cssmv-mv-frame-progress {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 3px;
  pointer-events: none;
  z-index: 6;
  overflow: hidden;
  opacity: 0;
  transition: opacity 400ms ease;
}
.cssmv-mv-frame-progress.is-active { opacity: 1; }
.cssmv-mv-frame-progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  background: linear-gradient(90deg,
    hsl(0,  82%, 62%),
    hsl(45, 82%, 62%),
    hsl(90, 82%, 62%),
    hsl(160,82%, 62%),
    hsl(210,82%, 62%),
    hsl(280,82%, 62%),
    hsl(330,82%, 62%),
    hsl(0,  82%, 62%));
  background-size: 200% 100%;
  background-repeat: repeat-x;
  animation: cssmvMvFrameHueFlow ${CONFIG.HUE_FLOW_MS}ms linear infinite;
  box-shadow: 0 0 10px rgba(255,255,255,0.45);
  transition: width 0.18s linear;
}
@keyframes cssmvMvFrameHueFlow {
  0%   { background-position:   0% 50%; }
  100% { background-position: 200% 50%; }
}
/* CSSOS_PHASE2_MV_FLASH_EXPLODE 20260420 — flash-explode-fade on media end.
 * Shared keyframe used by MV frame bar + timecode + (wired separately by
 * app.watch-stage-bars and app.watch-music-ring for their own elements). */
.cssmv-mv-frame-progress.is-end-burst .cssmv-mv-frame-progress-fill,
.cssmv-mv-timecode.is-end-burst {
  animation: cssmvEndBurst 820ms cubic-bezier(0.2, 0.8, 0.3, 1) 1 forwards;
}
@keyframes cssmvEndBurst {
  0%   { filter: brightness(1)   saturate(1);   opacity: 1; transform: scale(1); }
  30%  { filter: brightness(2.4) saturate(1.6); opacity: 1; transform: scale(1.05); }
  60%  { filter: brightness(1.8) saturate(1.3); opacity: 0.85; transform: scale(1.08); }
  100% { filter: brightness(1)   saturate(1);   opacity: 0; transform: scale(1.12); }
}

/* ===== MV time-code overlay (total fixed at start, remaining trails playhead) ===== */
.cssmv-mv-timecode {
  position: absolute;
  left: 10px;
  bottom: 8px;
  z-index: 8;
  pointer-events: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.8), 0 0 2px rgba(0, 0, 0, 0.9);
  mix-blend-mode: screen;
  opacity: 0;
  transition: opacity 400ms ease;
}
.cssmv-mv-timecode.is-active { opacity: 1; }
.cssmv-mv-timecode-total,
.cssmv-mv-timecode-remaining {
  position: absolute;
  left: 0;
  top: 0;
  white-space: nowrap;
}
.cssmv-mv-timecode-remaining {
  transition: transform 0.18s linear;
  color: rgba(255,255,255,0.98);
}
.cssmv-mv-timecode.is-ended .cssmv-mv-timecode-remaining {
  transform: translateX(0) !important;
}

/* ===== Hollow/镂空 play button override ===== */
#watch-overlay-play.cssmv-hollow,
#watch-music-play.cssmv-hollow {
  background: transparent !important;
  border: 2px solid currentColor !important;
  color: rgba(255,255,255,0.95);
  box-shadow: 0 0 12px rgba(255,255,255,0.25), inset 0 0 10px rgba(255,255,255,0.08);
  backdrop-filter: blur(2px);
  transition: opacity 400ms ease, transform 200ms ease;
}
#watch-overlay-play.cssmv-hollow:hover,
#watch-music-play.cssmv-hollow:hover {
  color: #fff;
  box-shadow: 0 0 18px rgba(255,255,255,0.45), inset 0 0 14px rgba(255,255,255,0.14);
  transform: scale(1.04);
}
#watch-overlay-play.cssmv-auto-hidden,
#watch-music-play.cssmv-auto-hidden {
  opacity: 0;
  pointer-events: none;
}

/* Remove audio element native UI since we're providing our own chrome. */
audio#watch-audio-preview.cssmv-headless {
  display: none !important;
}
audio#watch-audio-preview.cssmv-headless-visible {
  display: block;
  width: 1px; height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* CSSOS_PHASE2_MV_BOTTOM_BAR_REMOVED 20260420 — Jing:
   "播放媒体时，进度条也有随机颜色流动，就像输出时那样，取消掉媒体框
    底部的播放时进度条，我们已经有了边框进度条，再来一条的话，太花眼了。"
   The border-ring from app.watch-stage-bars.js (MV) and the circular ring
   from app.watch-music-ring.js (Music) now handle playback progress in
   both modes. The 3px bottom linear bar + timecode pills are redundant
   chrome that crowds the frame. Force-hide them in every state so they
   never render, but leave the JS wiring in place to avoid a null-element
   cascade. */
.cssmv-mv-frame-progress,
.cssmv-mv-frame-progress.is-active,
.cssmv-mv-frame-progress.is-end-burst,
.cssmv-mv-frame-progress-fill,
.cssmv-mv-timecode,
.cssmv-mv-timecode.is-active,
.cssmv-mv-timecode.is-ended,
.cssmv-mv-timecode.is-end-burst,
.cssmv-mv-timecode-total,
.cssmv-mv-timecode-remaining {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  animation: none !important;
}
`;
    document.head.appendChild(st);
  }

  // ---------- DOM helpers ----------

  function $id(id) { return document.getElementById(id); }

  function ensureRelativePositioned(el) {
    if (!el) return;
    const cs = getComputedStyle(el);
    if (cs.position === "static") el.style.position = "relative";
  }

  // ---------- MV media-frame progress + timecode ----------

  let mvFrameProgress = null;
  let mvTimecode = null;
  let mvTimecodeTotalEl = null;
  let mvTimecodeRemainingEl = null;

  function ensureMvFrameChrome() {
    const screen = document.querySelector(".watch-frame .watch-screen") || document.querySelector(".watch-frame");
    if (!screen) return;
    ensureRelativePositioned(screen);
    if (!mvFrameProgress || !mvFrameProgress.isConnected) {
      const bar = document.createElement("div");
      bar.className = "cssmv-mv-frame-progress";
      const fill = document.createElement("div");
      fill.className = "cssmv-mv-frame-progress-fill";
      bar.appendChild(fill);
      screen.appendChild(bar);
      mvFrameProgress = bar;
    }
    if (!mvTimecode || !mvTimecode.isConnected) {
      const tc = document.createElement("div");
      tc.className = "cssmv-mv-timecode";
      const total = document.createElement("span");
      total.className = "cssmv-mv-timecode-total";
      total.textContent = "0:00";
      const rem = document.createElement("span");
      rem.className = "cssmv-mv-timecode-remaining";
      rem.textContent = "0:00";
      tc.appendChild(total);
      tc.appendChild(rem);
      screen.appendChild(tc);
      mvTimecode = tc;
      mvTimecodeTotalEl = total;
      mvTimecodeRemainingEl = rem;
    }
  }

  function setMvFrameProgress(frac, currentTime, duration) {
    const pct = Math.max(0, Math.min(1, frac)) * 100;
    const fill = mvFrameProgress?.querySelector(".cssmv-mv-frame-progress-fill");
    if (fill) fill.style.width = pct + "%";
    if (mvTimecode) {
      const total = Number.isFinite(duration) ? duration : 0;
      const playhead = Number.isFinite(currentTime) ? currentTime : 0;
      const remaining = Math.max(0, total - playhead);
      if (mvTimecodeTotalEl) mvTimecodeTotalEl.textContent = formatTimecode(total);
      if (mvTimecodeRemainingEl) mvTimecodeRemainingEl.textContent = formatTimecode(remaining);
      const screen = mvTimecode.parentElement;
      if (screen) {
        const w = screen.getBoundingClientRect().width;
        const leftMargin = 20;
        const travel = Math.max(0, w - leftMargin * 2);
        const tx = travel * (total > 0 ? (playhead / total) : 0);
        if (mvTimecodeRemainingEl) mvTimecodeRemainingEl.style.transform = `translateX(${tx.toFixed(1)}px)`;
      }
    }
  }

  function showMvFrameChrome(on) {
    if (mvFrameProgress) mvFrameProgress.classList.toggle("is-active", !!on);
    if (mvTimecode) mvTimecode.classList.toggle("is-active", !!on);
  }

  function markMvEnded(ended) {
    if (!mvTimecode || !mvFrameProgress) return;
    mvTimecode.classList.toggle("is-ended", !!ended);
    if (ended) {
      // CSSOS_PHASE2_MV_FLASH_EXPLODE 20260420 — flash-explode, then hide.
      mvFrameProgress.classList.add("is-end-burst");
      mvTimecode.classList.add("is-end-burst");
      setTimeout(() => {
        mvFrameProgress?.classList.remove("is-end-burst", "is-active");
        mvTimecode?.classList.remove("is-end-burst", "is-active");
        // Reset inline width so next play starts clean.
        const fill = mvFrameProgress?.querySelector(".cssmv-mv-frame-progress-fill");
        if (fill) fill.style.width = "0%";
      }, 900);
    } else {
      mvFrameProgress.classList.remove("is-end-burst");
      mvTimecode.classList.remove("is-end-burst");
    }
  }

  // ---------- Hollow play buttons + auto-hide + native-control removal ----------

  function applyHollowButtons() {
    const ov = $id("watch-overlay-play");
    const mp = $id("watch-music-play");
    [ov, mp].forEach((btn) => {
      if (!btn) return;
      btn.classList.add("cssmv-hollow");
    });
  }

  function removeNativeControls() {
    const audio = $id(AUDIO_ID);
    if (audio) {
      if (audio.hasAttribute("controls")) audio.removeAttribute("controls");
      audio.controls = false;
      audio.classList.add("cssmv-headless");
    }
    const video = $id(VIDEO_ID);
    if (video) {
      if (video.hasAttribute("controls")) video.removeAttribute("controls");
      video.controls = false;
      // Don't disable PiP — app.pip-button.js exposes our own ⊞ button
      // in the cluster. Safari caches disablePictureInPicture state in
      // the AVPlayer layer so flipping it back later doesn't restore
      // frame relay → PiP window paints black. Just leave it enabled.
      try { video.disablePictureInPicture = false; } catch (_e) {}
      try { video.disableRemotePlayback = true; } catch (_e) {}
      video.setAttribute("controlslist", "nodownload noplaybackrate nofullscreen");
    }
  }

  let overlayIdleTimer = null;
  let musicBtnIdleTimer = null;

  function resetIdleHide(which) {
    const btn = which === "mv" ? $id("watch-overlay-play") : $id("watch-music-play");
    if (!btn) return;
    btn.classList.remove("cssmv-auto-hidden");
    if (which === "mv" && overlayIdleTimer) clearTimeout(overlayIdleTimer);
    if (which === "music" && musicBtnIdleTimer) clearTimeout(musicBtnIdleTimer);
    const t = setTimeout(() => {
      const media = which === "mv" ? $id(VIDEO_ID) : $id(AUDIO_ID);
      if (!media) return;
      if (!media.paused && !media.ended) btn.classList.add("cssmv-auto-hidden");
    }, CONFIG.BUTTON_IDLE_HIDE_MS);
    if (which === "mv") overlayIdleTimer = t; else musicBtnIdleTimer = t;
  }

  function wireAutoHide() {
    const video = $id(VIDEO_ID);
    const audio = $id(AUDIO_ID);
    const panel = $id("watch-panel");
    const wake = (which) => () => resetIdleHide(which);
    ["mousemove", "pointermove", "pointerdown", "touchstart", "keydown"].forEach((evt) => {
      panel?.addEventListener(evt, wake("mv"));
      panel?.addEventListener(evt, wake("music"));
    });
    video?.addEventListener("play", wake("mv"));
    video?.addEventListener("pause", () => { $id("watch-overlay-play")?.classList.remove("cssmv-auto-hidden"); });
    audio?.addEventListener("play", wake("music"));
    audio?.addEventListener("pause", () => { $id("watch-music-play")?.classList.remove("cssmv-auto-hidden"); });
  }

  // ---------- Playback sync loop (MV frame only now) ----------

  let pbRAF = null;

  function playbackLoop() {
    const video = $id(VIDEO_ID);
    const videoPlaying = video && !video.paused && !video.ended && (video.duration || 0) > 0;

    if (videoPlaying) {
      const currentTime = video.currentTime || 0;
      const duration = video.duration || 0;
      const frac = duration > 0 ? currentTime / duration : 0;
      ensureMvFrameChrome();
      showMvFrameChrome(true);
      setMvFrameProgress(frac, currentTime, duration);
    }

    pbRAF = requestAnimationFrame(playbackLoop);
  }

  function startPlaybackLoop() {
    if (pbRAF != null) return;
    pbRAF = requestAnimationFrame(playbackLoop);
  }

  // ---------- End-of-media handling ----------

  function wireEndHandlers() {
    const video = $id(VIDEO_ID);
    video?.addEventListener("ended", () => {
      if (video.duration > 0) setMvFrameProgress(1, video.duration, video.duration);
      markMvEnded(true);
      $id("watch-overlay-play")?.classList.remove("cssmv-auto-hidden");
    });
    video?.addEventListener("play", () => markMvEnded(false));
    video?.addEventListener("playing", () => markMvEnded(false));
  }

  // ---------- Boot ----------

  function boot() {
    ensureStyles();
    ensureMvFrameChrome();
    applyHollowButtons();
    removeNativeControls();
    wireAutoHide();
    wireEndHandlers();
    startPlaybackLoop();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(boot, 0);
  } else {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }

  // Expose a small API for other modules to force a refresh after panel re-render.
  globalThis.cssmvRefreshMediaChrome = function () {
    ensureMvFrameChrome();
    applyHollowButtons();
    removeNativeControls();
  };
})();
