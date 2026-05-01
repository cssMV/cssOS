// app.watch-music-ring.js
// CSSOS_PHASE2_MUSIC_RING_SINGLE 20260419 — single outer circular progress ring
// for the Music pane, sibling of the rounded-rect perimeter bar in
// app.watch-stage-bars.js.
//
// CSSOS_PHASE2_MUSIC_TIMECODE_SHARED_ARC 20260420 — both timecodes now ride
// the same full-circle path (per Jing 2026-04-20):
//   "Music进度条的两个时间码（总时长/进度时长），开始播放时是重叠的，
//    进度时长时间码跟进度条移动。播放结束，两个时间码再度重叠，
//    闪爆一下进度条和时间码消失。"
// Layout:
//   • One invisible full-circle <path> starting at 12 o'clock clockwise.
//   • "total" <textPath> pinned at startOffset=0% (always 12 o'clock).
//   • "current" <textPath> startOffset advances 0%→100% with progress,
//     wrapping back to 0% at end → both timecodes overlap at start AND at
//     100% playback.
//   • On `ended`: flash-explode (brightness/scale burst) then opacity fade
//     the ring + both timecodes to 0.
//
// Public API
//   cssmvMusicRingInit()   — idempotent wiring of the SVG overlay + events
//   cssmvMusicRingReset()  — force back to 0%, clear time codes
//   cssmvMusicRingShow()   — show the overlay (also called on init)
//   cssmvMusicRingHide()   — hide the overlay (e.g. when leaving the pane)

(function initWatchMusicRingModule() {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  // ------------------------------------------------------------------
  // Geometry / style constants
  // ------------------------------------------------------------------
  const VB_SIZE = 200;
  const STROKE_SVG = 10;
  const RING_RADIUS = (VB_SIZE - STROKE_SVG) / 2 - 1;
  const CENTER = VB_SIZE / 2;
  const PERIMETER = 2 * Math.PI * RING_RADIUS;

  // Time-code curve radius — slightly outside the ring stroke so digits sit
  // on top of the border.
  const TIME_TEXT_RADIUS = RING_RADIUS + STROKE_SVG * 0.55;
  const TIME_TEXT_SIZE = 9.2;

  const GRADIENT_HUE_COUNT = 7;
  const HUE_FLOW_MS = 4200;
  const FADE_MS = 260;
  // CSSOS_PHASE2_MV_FLASH_EXPLODE 20260420 — how long the flash-explode runs
  // before we hide the overlay entirely.
  const END_BURST_MS = 820;

  const UID = Math.random().toString(36).slice(2, 8);

  // ------------------------------------------------------------------
  // Styles (injected once per page load)
  // ------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("cssos-music-ring-style")) return;
    const style = document.createElement("style");
    style.id = "cssos-music-ring-style";
    style.textContent = `
.watch-music-ring.has-cssmv-music-ring {
  background: transparent !important;
}
.watch-music-ring.has-cssmv-music-ring::before {
  display: none !important;
}

.cssmv-music-ring-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  opacity: 0;
  transition: opacity ${FADE_MS}ms ease-in-out;
}
.cssmv-music-ring-overlay.is-visible {
  opacity: 1;
}
.cssmv-music-ring-overlay > svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cssmv-music-ring-trail {
  fill: none;
  stroke-width: ${STROKE_SVG};
  stroke-linecap: round;
  transform-origin: ${CENTER}px ${CENTER}px;
  transform: rotate(-90deg);
  filter: drop-shadow(0 0 8px hsl(210, 92%, 62%));
  transition: stroke-dasharray 280ms cubic-bezier(0.4, 0, 0.2, 1);
}
.cssmv-music-ring-overlay.is-playback .cssmv-music-ring-trail {
  transition: none;
}

.cssmv-music-ring-time {
  font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace;
  font-size: ${TIME_TEXT_SIZE}px;
  font-weight: 600;
  letter-spacing: 0.08em;
  fill: rgba(255, 255, 255, 0.92);
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 0.8;
}

/* CSSOS_PHASE2_MV_FLASH_EXPLODE 20260420 — flash-explode burst applied to
 * trail + both text elements when playback ends. */
.cssmv-music-ring-overlay.is-end-burst .cssmv-music-ring-trail,
.cssmv-music-ring-overlay.is-end-burst .cssmv-music-ring-time {
  animation: cssmvMusicRingBurst ${END_BURST_MS}ms cubic-bezier(0.2, 0.8, 0.3, 1) 1 forwards;
}
@keyframes cssmvMusicRingBurst {
  0%   { filter: brightness(1)   saturate(1)   drop-shadow(0 0 8px hsl(210, 92%, 62%)); opacity: 1; transform-origin: ${CENTER}px ${CENTER}px; }
  25%  { filter: brightness(2.6) saturate(1.8) drop-shadow(0 0 22px hsl(60, 100%, 70%)); opacity: 1; }
  55%  { filter: brightness(1.9) saturate(1.4) drop-shadow(0 0 18px hsl(300, 90%, 70%));  opacity: 0.75; }
  100% { filter: brightness(1)   saturate(1)   drop-shadow(0 0 0 transparent);           opacity: 0; }
}
.cssmv-music-ring-overlay.is-end-burst .cssmv-music-ring-trail {
  transform: rotate(-90deg) scale(1.08);
}
`;
    document.head.appendChild(style);
  }

  // ------------------------------------------------------------------
  // SVG construction
  // ------------------------------------------------------------------
  function buildGradient(defs) {
    const grad = document.createElementNS(SVG_NS, "linearGradient");
    const gid = `cssmv-music-rainbow-${UID}`;
    grad.setAttribute("id", gid);
    grad.setAttribute("gradientUnits", "userSpaceOnUse");
    const PERIOD = VB_SIZE / 2;
    grad.setAttribute("x1", "0");
    grad.setAttribute("y1", "0");
    grad.setAttribute("x2", String(PERIOD));
    grad.setAttribute("y2", String(PERIOD));
    grad.setAttribute("spreadMethod", "repeat");
    for (let i = 0; i < GRADIENT_HUE_COUNT; i++) {
      const stop = document.createElementNS(SVG_NS, "stop");
      const offset = i / (GRADIENT_HUE_COUNT - 1);
      const hue = Math.round((i * 360) / (GRADIENT_HUE_COUNT - 1));
      stop.setAttribute("offset", String(offset));
      stop.setAttribute("stop-color", `hsl(${hue}, 92%, 60%)`);
      grad.appendChild(stop);
    }
    const anim = document.createElementNS(SVG_NS, "animateTransform");
    anim.setAttribute("attributeName", "gradientTransform");
    anim.setAttribute("type", "rotate");
    anim.setAttribute("from", `0 ${CENTER} ${CENTER}`);
    anim.setAttribute("to", `360 ${CENTER} ${CENTER}`);
    anim.setAttribute("dur", `${HUE_FLOW_MS}ms`);
    anim.setAttribute("repeatCount", "indefinite");
    anim.setAttribute("additive", "replace");
    grad.appendChild(anim);
    defs.appendChild(grad);
    return gid;
  }

  // CSSOS_PHASE2_MUSIC_TIMECODE_SHARED_ARC 20260420 —
  // Single invisible full-circle path: starts at 12 o'clock, goes clockwise
  // through 3→6→9 and back to 12 o'clock. Both timecodes bind to this path;
  // their startOffset picks the point along the circumference.
  function buildSharedTimePath(defs) {
    const r = TIME_TEXT_RADIUS;
    const path = document.createElementNS(SVG_NS, "path");
    const pid = `cssmv-music-timepath-shared-${UID}`;
    path.setAttribute("id", pid);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "none");
    // Start at 12 o'clock: (CENTER, CENTER - r)
    // Arc 1: clockwise 180° → 6 o'clock: (CENTER, CENTER + r)
    // Arc 2: clockwise 180° → back to 12 o'clock: (CENTER, CENTER - r)
    const top = { x: CENTER, y: CENTER - r };
    const bottom = { x: CENTER, y: CENTER + r };
    path.setAttribute(
      "d",
      `M ${top.x} ${top.y.toFixed(3)} ` +
      `A ${r} ${r} 0 1 1 ${bottom.x} ${bottom.y.toFixed(3)} ` +
      `A ${r} ${r} 0 1 1 ${top.x} ${top.y.toFixed(3)}`,
    );
    defs.appendChild(path);
    return pid;
  }

  function buildSvg() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${VB_SIZE} ${VB_SIZE}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("aria-hidden", "true");

    const defs = document.createElementNS(SVG_NS, "defs");
    const gid = buildGradient(defs);
    const pidShared = buildSharedTimePath(defs);
    svg.appendChild(defs);

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("class", "cssmv-music-ring-trail");
    circle.setAttribute("cx", String(CENTER));
    circle.setAttribute("cy", String(CENTER));
    circle.setAttribute("r", String(RING_RADIUS));
    circle.setAttribute("stroke", `url(#${gid})`);
    circle.setAttribute("stroke-dasharray", `0 ${PERIMETER}`);
    circle.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(circle);

    // Helper: build a <text><textPath> bound to the shared full-circle path,
    // with a given initial startOffset (percent).
    const mkText = (pid, initialOffsetPct, extraClass) => {
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("class", "cssmv-music-ring-time" + (extraClass ? " " + extraClass : ""));
      text.setAttribute("dy", "3.2");
      const tp = document.createElementNS(SVG_NS, "textPath");
      tp.setAttribute("href", `#${pid}`);
      tp.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${pid}`);
      tp.setAttribute("startOffset", initialOffsetPct + "%");
      tp.setAttribute("text-anchor", "middle");
      tp.textContent = "0:00";
      text.appendChild(tp);
      return { text, tp };
    };
    // Total sits at the start of the path (12 o'clock, anchor=middle so text
    // is centered on the 12 o'clock point).
    const dur = mkText(pidShared, 0, "is-total");
    // Current starts at the same place (0%) → overlaps with total at t=0.
    const cur = mkText(pidShared, 0, "is-current");
    svg.appendChild(dur.text);
    svg.appendChild(cur.text);

    return {
      svg,
      trail: circle,
      curText: cur.tp,
      durText: dur.tp,
    };
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const state = {
    wired: false,
    ring: null,
    overlay: null,
    trail: null,
    curText: null,
    durText: null,
    audio: null,
    rafId: 0,
    playing: false,
    burstTimer: 0,
  };

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  function fmtTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function computePct() {
    const a = state.audio;
    if (!a) return 0;
    const d = a.duration;
    const t = a.currentTime;
    if (!Number.isFinite(d) || d <= 0) return 0;
    return Math.max(0, Math.min(100, (t / d) * 100));
  }

  function render() {
    if (!state.trail) return;
    const pct = computePct();
    const visible = (pct / 100) * PERIMETER;
    const rest = Math.max(0, PERIMETER - visible);
    if (pct >= 99.98) {
      state.trail.setAttribute("stroke-dasharray", `${PERIMETER} 0`);
      state.trail.style.opacity = "1";
    } else if (pct < 0.05) {
      state.trail.setAttribute("stroke-dasharray", `0 ${PERIMETER}`);
      state.trail.style.opacity = "0";
    } else {
      state.trail.setAttribute(
        "stroke-dasharray",
        `${visible.toFixed(3)} ${rest.toFixed(3)}`,
      );
      state.trail.style.opacity = "1";
    }

    const a = state.audio;
    if (state.curText) {
      state.curText.textContent = fmtTime(a ? a.currentTime : 0);
      // CSSOS_PHASE2_MUSIC_TIMECODE_SHARED_ARC 20260420 —
      // Ride the progress head: startOffset = pct%.
      // At 0% and 100% this sits on the total (both at 12 o'clock) →
      // the "overlap at start, overlap at end" behavior the user asked for.
      state.curText.setAttribute("startOffset", pct.toFixed(3) + "%");
    }
    if (state.durText) {
      state.durText.textContent = fmtTime(
        a && Number.isFinite(a.duration) ? a.duration : 0,
      );
      // Stay pinned at 12 o'clock.
      state.durText.setAttribute("startOffset", "0%");
    }
  }

  function startLoop() {
    if (state.rafId) return;
    const tick = () => {
      state.rafId = 0;
      render();
      if (state.playing) {
        state.rafId = requestAnimationFrame(tick);
      }
    };
    state.rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  // CSSOS_PHASE2_MV_FLASH_EXPLODE 20260420 — 闪爆 then vanish.
  // Puts the ring + timecodes at the overlap point (100% → 12 o'clock),
  // fires the flash keyframe via a class toggle, then hides the overlay.
  function triggerEndBurst() {
    if (!state.overlay) return;
    // Snap to the "both overlap at end" state before the burst so the flash
    // happens on the fully-filled ring with both timecodes stacked at 12.
    if (state.trail) {
      state.trail.setAttribute("stroke-dasharray", `${PERIMETER} 0`);
      state.trail.style.opacity = "1";
    }
    if (state.curText) state.curText.setAttribute("startOffset", "0%");
    // Force a reflow so the animation restart takes effect if ended re-fires.
    state.overlay.classList.remove("is-end-burst");
    void state.overlay.offsetWidth;
    state.overlay.classList.add("is-end-burst");

    if (state.burstTimer) clearTimeout(state.burstTimer);
    state.burstTimer = setTimeout(() => {
      state.burstTimer = 0;
      state.overlay.classList.remove("is-end-burst");
      state.overlay.classList.remove("is-visible");
      // Reset to 0% so next play starts clean.
      if (state.trail) {
        state.trail.setAttribute("stroke-dasharray", `0 ${PERIMETER}`);
        state.trail.style.opacity = "0";
      }
      if (state.curText) state.curText.setAttribute("startOffset", "0%");
    }, END_BURST_MS + 40);
  }

  // ------------------------------------------------------------------
  // Media wiring
  // ------------------------------------------------------------------
  function wireAudio() {
    if (!state.audio || state.audio.__cssmvMusicRingWired) return;
    state.audio.__cssmvMusicRingWired = true;

    const onPlay = () => {
      state.playing = true;
      if (state.overlay) {
        state.overlay.classList.add("is-playback");
        // Clear any lingering burst state from a prior ended event.
        state.overlay.classList.remove("is-end-burst");
        state.overlay.classList.add("is-visible");
      }
      if (state.burstTimer) { clearTimeout(state.burstTimer); state.burstTimer = 0; }
      show();
      startLoop();
    };
    const onPause = () => {
      state.playing = false;
      if (state.overlay) state.overlay.classList.remove("is-playback");
      render();
      stopLoop();
    };
    const onEnded = () => {
      state.playing = false;
      if (state.overlay) state.overlay.classList.remove("is-playback");
      stopLoop();
      triggerEndBurst();
    };
    const onTime = () => {
      render();
    };
    const onMeta = () => {
      render();
    };

    state.audio.addEventListener("play", onPlay);
    state.audio.addEventListener("playing", onPlay);
    state.audio.addEventListener("pause", onPause);
    state.audio.addEventListener("ended", onEnded);
    state.audio.addEventListener("timeupdate", onTime);
    state.audio.addEventListener("seeking", onTime);
    state.audio.addEventListener("seeked", onTime);
    state.audio.addEventListener("durationchange", onMeta);
    state.audio.addEventListener("loadedmetadata", onMeta);
    state.audio.addEventListener("emptied", () => {
      state.playing = false;
      render();
    });
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  function show() {
    if (state.overlay) state.overlay.classList.add("is-visible");
  }

  function hide() {
    if (state.overlay) state.overlay.classList.remove("is-visible");
  }

  function reset() {
    state.playing = false;
    if (state.overlay) {
      state.overlay.classList.remove("is-playback");
      state.overlay.classList.remove("is-end-burst");
    }
    if (state.trail) {
      state.trail.setAttribute("stroke-dasharray", `0 ${PERIMETER}`);
    }
    if (state.curText) {
      state.curText.textContent = "0:00";
      state.curText.setAttribute("startOffset", "0%");
    }
    if (state.durText) {
      state.durText.textContent = "0:00";
      state.durText.setAttribute("startOffset", "0%");
    }
    stopLoop();
  }

  function init() {
    if (state.wired) return;
    const ring = document.getElementById("watch-music-ring");
    if (!ring) return;
    const audio = document.getElementById("watch-audio-preview");
    if (!audio) return;
    injectStyles();

    const overlay = document.createElement("div");
    overlay.className = "cssmv-music-ring-overlay";

    const built = buildSvg();
    overlay.appendChild(built.svg);
    ring.appendChild(overlay);
    ring.classList.add("has-cssmv-music-ring");

    state.wired = true;
    state.ring = ring;
    state.overlay = overlay;
    state.trail = built.trail;
    state.curText = built.curText;
    state.durText = built.durText;
    state.audio = audio;

    wireAudio();
    reset();
    show();
  }

  window.cssmvMusicRingInit = init;
  window.cssmvMusicRingShow = show;
  window.cssmvMusicRingHide = hide;
  window.cssmvMusicRingReset = reset;

  function whenReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }
  whenReady(() => {
    init();
    setTimeout(init, 1000);
    setTimeout(init, 2500);
  });
})();
