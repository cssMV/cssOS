// app.watch-stage-bars.js
// CSSOS_PHASE2_BORDER_STAGE_ROTATE 20260420 — Jing: render mode now rotates
// through 6 full-perimeter stage bars every 5s instead of averaging.
// CSSOS_PHASE2_BORDER_NOTIF_WAVE 20260420 — Jing: "不要彩虹，要通知面板的
// 随机波动风格". Replaced the 7-stop 360° SMIL rainbow with the exact
// 6-stop seeded-hue palette the notifications panel uses, so the ring
// reads as a few flowing wave-colors instead of a full-spectrum rainbow.
//
// Spec (Phase-2):
//   * 6 pipeline stages share ONE full-perimeter rounded-rect bar:
//     cover → lyrics → music → video → subtitles → compose.
//   * Render mode rotates every ROTATION_MS (5 s). While a stage is
//     active, the bar reflects that stage's live pct (0–100%). When a
//     stage completes, its recorded pct stays at 100, so when the
//     rotation lands on it again the ring shows a closed loop — Jing's
//     "进度条驻留".
//   * Each stage gets its own hue SEED (STAGE_HUE below). The gradient
//     stops are computed as seed + {0, +36, +90, +180, +270, +360} and
//     rewritten on every rotation tick. This matches the notifications
//     panel's .notification-run-bar-fill gradient EXACTLY — same six
//     HSL stops, same hue-math. The only difference is surface (SVG
//     stroke on a rounded rect vs. DOM gradient on a horizontal bar).
//   * Period of the gradient is sized so only a sub-slice of the
//     palette is visible around the ring at any instant — the same
//     "bg-size 200%" trick the notification bar uses to avoid reading
//     as a full rainbow. As the tile translates, different triplets of
//     colors pass through, giving the "随机颜色波动" feel.
//   * Playback mode (video/audio #currentTime) still overrides rotation
//     and tracks time over the full perimeter, closing on `ended`.
//
// Public API (unchanged — app.mv-pipeline-panel.js call sites intact):
//   cssmvStageBarsShow()                    — show + start rotation
//   cssmvStageBarsHide()                    — fade out + stop rotation
//   cssmvStageBarsReset()                   — clear state, back to 0%
//   cssmvStageBarsSetProgress(key, pct)     — render-mode: record per-stage
//                                             progress, repaint if current
//   cssmvStageBarsSetDone(key)              — render-mode: mark stage 100%
//   cssmvStageBarsStageList()               — ordered stage id list

(function initWatchBorderSingleBarModule() {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  // Pipeline stage order. Source of truth lives in app.mv-pipeline-panel.js
  // (STAGE_ORDER); this array MUST stay in sync with it.
  // CSSOS_WAVE_157 20260514 — Jing: pipeline order is
  // 歌词→封面图→音乐→视频→字幕→合成. Lyrics first so the 京典 text
  // seeds the cover prompt, music mood, and subtitle timeline.
  const STAGES = ["lyrics", "cover", "music", "video", "subtitles", "compose"];
  // Watch panel border-radius. Matches style.css --radius (24px) on
  // desktop. CSSOS_WAVE_297 20260521 — Jing: 全屏 App 里进度环贴边(inset:0)
  // 走 MV 边框, 四角要顺着【设备屏幕圆角】走, 否则直角会被设备圆角裁掉. 现代
  // iPhone 屏幕圆角约 47–55 CSS px; 默认 55, 可用 localStorage.cssos_mv_corner_radius
  // 就地微调到刚好贴合自己机型(在哪用就在哪改).
  const PANEL_RADIUS_PX = 24;
  // CSSOS_WAVE_319 20260521 — Jing: 无法读设备物理圆角(Web 无此 API), 改【按设备
  // 类别】给合理默认: iPhone 40 / iPad 20 / 安卓(手机+平板, 各家不一)统一 20 /
  // 桌面用面板原圆角(24). localStorage.cssos_mv_corner_radius 仍可就地覆写兜底.
  function panelRadiusPx() {
    var isApp = false;
    try { isApp = document.documentElement.classList.contains("cssos-app"); } catch (_e) {}
    if (!isApp) return PANEL_RADIUS_PX; // 桌面/普通浏览器
    // 手动覆写优先(在哪用就在哪改).
    try {
      var v = parseFloat(localStorage.getItem("cssos_mv_corner_radius"));
      if (isFinite(v) && v >= 0 && v <= 200) return v;
    } catch (_e) {}
    try {
      var ua = navigator.userAgent || "";
      // iPadOS 13+ 在 Safari 里伪装成 Macintosh, 用 maxTouchPoints 兜底识别.
      var isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1);
      if (/Android/i.test(ua)) return 20;      // 安卓(手机/平板)统一 → 同 iPad
      if (isIPad) return 20;                    // iPad
      if (/iPhone|iPod/i.test(ua)) return 40;   // iPhone
      // 兜底: 按屏幕短边判平板/手机.
      var minSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
      return minSide >= 768 ? 20 : 40;
    } catch (_e) {}
    return 40;
  }
  // Bar stroke thickness. Jing earlier: "尺寸小一半" — halved from 10 → 5.
  const TRAIL_STROKE_PX = 5;

  // CSSOS_PHASE2_BORDER_NOTIF_WAVE 20260420 — copy the notifications panel
  // .notification-run-bar-fill gradient exactly. Six HSL stops centered on
  // a per-stage hue SEED. Offsets in percent (matches the notifications
  // CSS: 0%, 22%, 44%, 66%, 88%, 100%).
  const HUE_OFFSETS = [0, 36, 90, 180, 270, 360];
  const STOP_OFFSETS = [0, 0.22, 0.44, 0.66, 0.88, 1.0];
  const STOP_LIGHT = [62, 60, 58, 58, 60, 62];
  const STOP_SATURATION = 92;

  // CSSOS_PHASE2_BORDER_STAGE_ROTATE 20260420 — render mode rotates through
  // the 6 stage bars every 5 seconds. Each stage "owns" the full-perimeter
  // ring for ROTATION_MS, showing its live pct. Previously 3s with the old
  // 6-arc chase; Jing bumped to 5s so the eye has time to read the label
  // and the done-state closed loops.
  const ROTATION_MS = 5000;

  // Per-stage hue seed. Matches the engine-card hues set in
  // app.watch-ui.js (CSSOS_PHASE2_WATCH_ENGINE_LIVE 20260420). Each stage's
  // full seeded palette is distinct but the gradient still covers six
  // HSL offsets so the in-stage bar flows through several colors.
  const STAGE_HUE = {
    cover: 320,      // magenta-pink — the cover art stage
    lyrics: 145,     // green — matches the lyrics engine card
    music: 210,      // blue — matches the music engine card
    video: 290,      // purple — matches the video engine card
    subtitles: 36,   // amber — matches the kara/subtitles engine card
    compose: 0,      // red — the final compose/render mixdown
  };

  // Scroll cadence (ms) for the gradient translate animation. Shorter than
  // the old HUE_FLOW_MS so the "wave" clearly reads as motion on short
  // stroke segments (e.g. 5–20% progress = only a few hundred perimeter px
  // visible). Matches the notifications panel's 1800ms cycle feel.
  const HUE_FLOW_MS = 1800;

  // Smooth transition on dasharray while the bar is driven by render
  // progress (pct updates arrive a few times per second). Disabled during
  // playback so the bar stays exactly in lock-step with currentTime.
  const TRAIL_TRANSITION_MS_RENDER = 380;
  // Opacity fade-in / fade-out when show/hide is toggled.
  const FADE_MS = 600;

  // Keep in sync with the 820ms @keyframes cssmvBorderEndBurst duration.
  const END_BURST_MS = 820;

  // --------- state --------------------------------------------------------
  //
  // Tracks wiring, current visual mode (render vs playback), per-stage
  // percentages, rotation, and media-source refs. This block was lost in
  // a prior edit — restoring it here.
  const state = {
    wired: false,
    panel: null,
    svg: null,
    trail: null,
    gradientId: "",
    // Refs to the six <stop> elements so we can rewrite stop-color on
    // every stage rotation without rebuilding the SVG.
    gradientStops: [],
    perimeter: 0,
    mode: "idle",              // "idle" | "render" | "playback"
    timeSource: null,          // HTMLMediaElement when mode === "playback"
    rafId: 0,
    resizeObserver: null,
    endBurstTimer: 0,
    // Render-mode progress bookkeeping.
    perStage: {},              // stage key -> 0–100 pct
    done: {},                  // stage key -> bool
    // Rotation (render-mode only).
    rotationIndex: 0,          // index into STAGES; which stage owns the ring
    rotationTimer: 0,          // setInterval id
  };

  STAGES.forEach((k) => {
    state.perStage[k] = 0;
    state.done[k] = false;
  });

  ensureStyles();
  document.addEventListener("DOMContentLoaded", wireWhenReady, { once: true });
  if (document.readyState === "interactive" || document.readyState === "complete") {
    wireWhenReady();
  }

  function ensureStyles() {
    if (document.getElementById("cssmv-border-single-styles")) return;
    const st = document.createElement("style");
    st.id = "cssmv-border-single-styles";
    st.textContent = `
.cssmv-border-bar {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  /* Sit above the panel's own .panel-active::before border-flow layer
     (z-index: 2) so the bar reads on top. */
  z-index: 3;
  opacity: 0;
  transition: opacity ${FADE_MS}ms ease-in-out;
}
.cssmv-border-bar.is-active { opacity: 1; }
.cssmv-border-bar.is-fading { opacity: 0; }
/* CSSOS_WAVE_372 20260523 — Jing「进度条钉到屏幕边」: App 全屏里把这条边框进度环
   从【面板坐标系】解放到【视口坐标系】—— position:fixed + 挂到 document.body(避开
   面板的 transform 把 fixed 困住), inset:0 即真·屏幕四边. 不再追求"面板边=屏幕边",
   直接沿屏幕走. z 抬到媒体(10060)之上、卡拉OK(10070)之下. */
html.cssos-app .cssmv-border-bar.is-viewport {
  position: fixed;
  inset: 0;
  z-index: 10065;
}

.cssmv-trail {
  fill: none;
  stroke-width: ${TRAIL_STROKE_PX};
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  /* Drop-shadow glow — the seed hue is overwritten per-stage via a
     CSS custom property so the glow tints with the active stage. */
  filter: drop-shadow(0 0 8px hsl(var(--cssmv-bar-hue, 210), 92%, 62%));
  transition: stroke-dasharray ${TRAIL_TRANSITION_MS_RENDER}ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* During playback the bar must stay pixel-synced with currentTime, so we
   skip the smoothing transition — timeupdate is the animation. */
.cssmv-border-bar.mode-playback .cssmv-trail {
  transition: none;
}

/* CSSOS_PHASE2_MV_END_BURST 20260420 — 820ms "flash-then-gone" finale. */
@keyframes cssmvBorderEndBurst {
  0% {
    filter: drop-shadow(0 0 8px hsl(var(--cssmv-bar-hue, 210), 92%, 62%)) brightness(1) saturate(1);
    transform: scale(1);
    opacity: 1;
  }
  35% {
    filter: drop-shadow(0 0 22px hsl(55, 100%, 72%)) brightness(2.4) saturate(1.6);
    transform: scale(1.06);
    opacity: 1;
  }
  70% {
    filter: drop-shadow(0 0 16px hsl(300, 100%, 68%)) brightness(1.9) saturate(1.4);
    transform: scale(1.10);
    opacity: 0.85;
  }
  100% {
    filter: drop-shadow(0 0 4px hsl(var(--cssmv-bar-hue, 210), 92%, 62%)) brightness(1) saturate(1);
    transform: scale(1.12);
    opacity: 0;
  }
}

.cssmv-border-bar.is-end-burst .cssmv-trail {
  animation: cssmvBorderEndBurst 820ms cubic-bezier(0.2, 0.6, 0.2, 1) forwards;
  transition: none;
}

/* CSSOS_PHASE2_BORDER_WAITING_DOT_REMOVED 20260420 — Jing:
   "之前我说的输出未开始时，显示一个点随机颜色呼吸，现在你放在了媒体框
    上边框中间，太惹眼，请删除掉。"
   Kill the waiting-dot entirely. Keep the <circle> element in the DOM
   (removing it would require DOM surgery mid-render) but force-hide it
   and disable its animations/opacity under any state. */
.cssmv-border-dot,
.cssmv-border-bar.is-waiting .cssmv-border-dot {
  display: none !important;
  opacity: 0 !important;
  animation: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
/* When the ring is in the "waiting" state (pre-start, pct=0), show nothing
   at all — no ring, no dot. The panel stays quiet until output actually
   starts. */
.cssmv-border-bar.is-waiting .cssmv-trail {
  stroke-dasharray: 0 99999 !important;
  opacity: 0 !important;
}
@keyframes cssmvBorderDotPulse {
  0%, 100% { transform: scale(0.85); }
  50%      { transform: scale(1.25); }
}
@keyframes cssmvBorderDotHue {
  0%   { fill: hsl(0,   92%, 62%); filter: drop-shadow(0 0 10px hsl(0,   92%, 62%)); }
  16%  { fill: hsl(60,  92%, 62%); filter: drop-shadow(0 0 10px hsl(60,  92%, 62%)); }
  33%  { fill: hsl(120, 92%, 62%); filter: drop-shadow(0 0 10px hsl(120, 92%, 62%)); }
  50%  { fill: hsl(180, 92%, 62%); filter: drop-shadow(0 0 10px hsl(180, 92%, 62%)); }
  66%  { fill: hsl(240, 92%, 62%); filter: drop-shadow(0 0 10px hsl(240, 92%, 62%)); }
  83%  { fill: hsl(300, 92%, 62%); filter: drop-shadow(0 0 10px hsl(300, 92%, 62%)); }
  100% { fill: hsl(360, 92%, 62%); filter: drop-shadow(0 0 10px hsl(360, 92%, 62%)); }
}

/* CSSOS_PHASE2_BORDER_DONE_STATIC 20260420 — Jing: when a stage finishes
   (done=true) the ring should persist as a closed loop but stop flashing
   and stop the random-color wave. Swap the gradient stroke for a solid
   stage-seed HSL color (set from JS) and cancel any transition. */
.cssmv-border-bar.is-done-static .cssmv-trail {
  transition: none !important;
  filter: drop-shadow(0 0 6px hsl(var(--cssmv-bar-hue, 210), 82%, 58%));
}
`;
    document.head.appendChild(st);
  }

  function wireWhenReady() {
    if (state.wired) return;
    const panel = document.getElementById("watch-panel");
    if (!panel) return;
    const legacyLine = document.getElementById("watch-panel-progress-line");
    if (legacyLine) legacyLine.hidden = true;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.classList.add("cssmv-border-bar");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("preserveAspectRatio", "none");

    // <defs> + <linearGradient>. Six stops, seeded-hue palette matching
    // .notification-run-bar-fill EXACTLY. gradientUnits="userSpaceOnUse"
    // with a long period + spreadMethod="repeat" so only a sub-slice of
    // the palette is visible along the ring at once (mirrors the
    // notifications bar's bg-size:200% reveal). Translate animation
    // scrolls the tile so different triplets pass through = "随机波动".
    const defs = document.createElementNS(SVG_NS, "defs");
    const gradientId = `cssmv-wave-${Math.random().toString(36).slice(2, 8)}`;
    const lg = document.createElementNS(SVG_NS, "linearGradient");
    lg.setAttribute("id", gradientId);
    lg.setAttribute("gradientUnits", "userSpaceOnUse");
    // Diagonal period — large enough that only ~1 tile is visible across
    // the ring's bounding box at any instant (so the palette reads as
    // "a few colors flowing" instead of a full rainbow). The tile's
    // actual on-screen extent depends on panel size; 520×310 works well
    // for typical Watch panel dimensions (≈ 700–900 × 500–700). The
    // scroll animation below translates by exactly one period so the
    // loop is seamless.
    const PERIOD_PX_X = 520;
    const PERIOD_PX_Y = 310;
    lg.setAttribute("x1", "0");
    lg.setAttribute("y1", "0");
    lg.setAttribute("x2", String(PERIOD_PX_X));
    lg.setAttribute("y2", String(PERIOD_PX_Y));
    lg.setAttribute("spreadMethod", "repeat");

    // Build six <stop>s with placeholder colors — real hues are written
    // on the first applyStageHue() call below.
    const stops = [];
    for (let i = 0; i < STOP_OFFSETS.length; i += 1) {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", String(STOP_OFFSETS[i]));
      stop.setAttribute("stop-color", `hsl(0, ${STOP_SATURATION}%, ${STOP_LIGHT[i]}%)`);
      lg.appendChild(stop);
      stops.push(stop);
    }
    state.gradientStops = stops;

    // SMIL animateTransform on the gradient. Translate from (0,0) →
    // (PERIOD_PX_X, PERIOD_PX_Y). Because the tiling repeats exactly
    // every period, the end-state is visually identical to the start, so
    // the loop is perfectly seamless and the colors appear to wave
    // through the stroke.
    const anim = document.createElementNS(SVG_NS, "animateTransform");
    anim.setAttribute("attributeName", "gradientTransform");
    anim.setAttribute("type", "translate");
    anim.setAttribute("from", "0 0");
    anim.setAttribute("to", `${PERIOD_PX_X} ${PERIOD_PX_Y}`);
    anim.setAttribute("dur", `${HUE_FLOW_MS}ms`);
    anim.setAttribute("repeatCount", "indefinite");
    anim.setAttribute("additive", "replace");
    lg.appendChild(anim);
    defs.appendChild(lg);
    svg.appendChild(defs);

    const trail = document.createElementNS(SVG_NS, "rect");
    trail.classList.add("cssmv-trail");
    trail.setAttribute("fill", "none");
    trail.setAttribute("stroke", `url(#${gradientId})`);
    trail.setAttribute("stroke-dasharray", "0 99999");
    svg.appendChild(trail);

    // CSSOS_PHASE2_BORDER_WAITING_DOT 20260420 — Jing: the pulsing-dot
    // waiting indicator. Placed at top-center of the ring (x = w/2,
    // y = inset) and only visible when .is-waiting is set on the SVG.
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.classList.add("cssmv-border-dot");
    dot.setAttribute("r", String(TRAIL_STROKE_PX * 1.4));
    svg.appendChild(dot);

    // CSSOS_WAVE_372 — App 全屏: 进度环挂到 document.body 并标记 is-viewport,
    // 几何用视口尺寸(见 computeGeometry) → 沿真·屏幕边走, 不受面板未铺满底部影响.
    // 桌面: 仍挂在面板里、沿面板边框走(面板是可拖动的浮窗).
    const isApp = document.documentElement.classList.contains("cssos-app");
    state.viewport = isApp;
    if (isApp) {
      svg.classList.add("is-viewport");
      document.body.appendChild(svg);
    } else {
      panel.appendChild(svg);
    }

    state.panel = panel;
    state.svg = svg;
    state.trail = trail;
    state.dot = dot;
    state.gradientId = gradientId;
    state.wired = true;

    // Seed the stops with cover's hue so day-zero paint isn't black.
    applyStageHue(STAGE_HUE[STAGES[0]]);

    const ro = new ResizeObserver(() => {
      resize();
      render();
    });
    ro.observe(panel);
    state.resizeObserver = ro;
    // CSSOS_WAVE_372 — viewport mode also re-fits on window resize / rotation.
    if (state.viewport) {
      const onVp = () => { resize(); render(); };
      window.addEventListener("resize", onVp, { passive: true });
      window.addEventListener("orientationchange", onVp, { passive: true });
      state._vpResize = onVp;
    }

    resize();
    render();
    wireMediaSources();
  }

  // Rewrite the six gradient stops with a new hue seed. Called on every
  // rotation tick (render mode) and pre-wired for cover on init.
  function applyStageHue(seedHue) {
    if (!state.gradientStops.length) return;
    const seed = ((Number(seedHue) || 0) % 360 + 360) % 360;
    for (let i = 0; i < state.gradientStops.length; i += 1) {
      const hue = (seed + HUE_OFFSETS[i]) % 360;
      state.gradientStops[i].setAttribute(
        "stop-color",
        `hsl(${hue}, ${STOP_SATURATION}%, ${STOP_LIGHT[i]}%)`
      );
    }
    // Update the glow hue via a CSS custom property so the drop-shadow
    // filter also tints per-stage.
    if (state.svg) state.svg.style.setProperty("--cssmv-bar-hue", String(seed));
  }

  // Compute rounded-rect geometry and perimeter for the stroke path.
  // Perimeter formula for a rounded rect: 2(w+h) − 2·rx·(4−π).
  function computeGeometry() {
    // CSSOS_WAVE_372 — viewport mode (App fullscreen): trace the SCREEN edge,
    // not the panel (which may fall short at the bottom). Desktop: panel box.
    const w = state.viewport ? window.innerWidth : state.panel.clientWidth;
    const h = state.viewport ? window.innerHeight : state.panel.clientHeight;
    if (!w || !h) return null;
    const inset = TRAIL_STROKE_PX / 2;
    const rw = Math.max(0, w - TRAIL_STROKE_PX);
    const rh = Math.max(0, h - TRAIL_STROKE_PX);
    const rx = Math.max(0, panelRadiusPx() - inset);
    const perimeter = 2 * (rw + rh) - (2 * rx * (4 - Math.PI));
    return { w, h, inset, rw, rh, rx, perimeter };
  }

  function resize() {
    if (!state.wired || !state.panel || !state.svg) return;
    const g = computeGeometry();
    if (!g) return;
    state.perimeter = g.perimeter;
    state.svg.setAttribute("viewBox", `0 0 ${g.w} ${g.h}`);
    state.trail.setAttribute("x", g.inset);
    state.trail.setAttribute("y", g.inset);
    state.trail.setAttribute("width", g.rw);
    state.trail.setAttribute("height", g.rh);
    state.trail.setAttribute("rx", g.rx);
    state.trail.setAttribute("ry", g.rx);
    // Waiting dot sits on the top-center edge of the ring.
    if (state.dot) {
      state.dot.setAttribute("cx", String(g.w / 2));
      state.dot.setAttribute("cy", String(g.inset));
    }
  }

  // In render mode the bar shows whichever stage is currently "owning"
  // the rotation slot. Completed stages are pinned at 100% so the ring
  // reads as a closed loop when the rotation cycles back to them.
  function computeRenderCurrentPct() {
    const key = STAGES[state.rotationIndex % STAGES.length];
    if (state.done[key]) return 100;
    const raw = Number(state.perStage[key] || 0);
    return Math.max(0, Math.min(100, raw));
  }

  function computeCurrentPct() {
    if (state.mode === "playback" && state.timeSource) {
      const el = state.timeSource;
      const d = Number(el.duration);
      const t = Number(el.currentTime || 0);
      if (!isFinite(d) || d <= 0) return 0;
      return Math.max(0, Math.min(100, (t / d) * 100));
    }
    if (state.mode === "render") return computeRenderCurrentPct();
    return 0;
  }

  function render() {
    if (!state.wired || !state.perimeter) return;
    // CSSOS_PHASE2_BORDER_WAITING_DOT / _DONE_STATIC 20260420 — Jing:
    //   * pre-start (mode===render && !done && pct===0) → hide ring, show
    //     pulsing hue-cycling dot ("让人觉得在等待开始").
    //   * done (mode===render && done)                  → closed-ring at
    //     100%, SOLID stage-seed color (no gradient wave), no flash
    //     ("驻留，但不再闪烁，随机颜色不再流动").
    //   * active / playback                             → normal gradient
    //     wave on the partial ring up to pct.
    const key = STAGES[state.rotationIndex % STAGES.length];
    const isDone = !!state.done[key];
    const pct = computeCurrentPct();
    const isWaiting = state.mode === "render" && !isDone && pct === 0;

    state.svg.classList.toggle("mode-playback", state.mode === "playback");
    state.svg.classList.toggle("is-waiting", isWaiting);
    state.svg.classList.toggle("is-done-static", state.mode === "render" && isDone);

    if (isWaiting) {
      // Dot is rendered via CSS keyframes — nothing else to paint.
      state.trail.setAttribute("stroke-dasharray", "0 99999");
      return;
    }

    // Swap stroke between gradient-url (active/playback) and solid HSL
    // (done). Presentation attribute is authoritative vs. CSS, so we flip
    // the attribute directly instead of relying on !important.
    if (state.mode === "render" && isDone) {
      const hue = ((Number(STAGE_HUE[key]) || 0) % 360 + 360) % 360;
      // STOP_LIGHT[2] = 58 — middle lightness of the palette → reads as
      // the characteristic stage color without the wave's highlight/lowlight.
      state.trail.setAttribute("stroke", `hsl(${hue}, ${STOP_SATURATION}%, 58%)`);
    } else if (state.trail.getAttribute("stroke") !== `url(#${state.gradientId})`) {
      state.trail.setAttribute("stroke", `url(#${state.gradientId})`);
    }

    const visibleLen = (pct / 100) * state.perimeter;
    const rest = Math.max(0, state.perimeter - visibleLen);
    state.trail.setAttribute("stroke-dasharray", `${visibleLen} ${rest}`);
  }

  // ---------- rotation (render mode) --------------------------------------

  function advanceRotation() {
    state.rotationIndex = (state.rotationIndex + 1) % STAGES.length;
    const key = STAGES[state.rotationIndex];
    applyStageHue(STAGE_HUE[key]);
    render();
  }

  function startRotation() {
    if (state.rotationTimer) return;
    // Paint the current stage immediately so show() → startRotation() has
    // the right hue on frame 0 (before the first interval fires).
    const key = STAGES[state.rotationIndex % STAGES.length];
    applyStageHue(STAGE_HUE[key]);
    render();
    state.rotationTimer = setInterval(advanceRotation, ROTATION_MS);
  }

  function stopRotation() {
    if (state.rotationTimer) {
      clearInterval(state.rotationTimer);
      state.rotationTimer = 0;
    }
  }

  // ---------- playback loop -----------------------------------------------

  function startPlaybackLoop() {
    stopPlaybackLoop();
    const tick = () => {
      if (state.mode !== "playback" || !state.timeSource) {
        state.rafId = 0;
        return;
      }
      render();
      state.rafId = requestAnimationFrame(tick);
    };
    state.rafId = requestAnimationFrame(tick);
  }

  function stopPlaybackLoop() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  function wireMediaSources() {
    const video = document.getElementById("watch-video");
    const audio = document.getElementById("watch-audio-preview");
    [video, audio].forEach((el) => {
      if (!el) return;
      const onPlay = () => {
        state.mode = "playback";
        state.timeSource = el;
        // CSSOS_PHASE2_PLAYBACK_FLOWING_HUES 20260420 — Jing:
        //   "播放媒体时，进度条也和输出时一样，随机颜色流动，直到播放完毕，
        //    进度条闪爆一下就消失。"
        // Keep the 5s stage rotation running during playback so the gradient
        // palette keeps cycling through the 6 stage hues — that's the
        // "random colors flowing" the user wants, matching how the bar
        // looks during render/output. The bar's *length* is still driven by
        // currentTime/duration (playback mode), only the hue seed rotates.
        // The SMIL gradient translate (HUE_FLOW_MS) keeps doing the wave
        // inside each palette. The `ended` handler's flash-explode then
        // fade-out is unchanged.
        cancelEndBurst();
        show();
        startRotation();
        render();
        if (!el.paused) startPlaybackLoop();
      };
      const onPause = () => {
        if (state.timeSource !== el) return;
        render();
        stopPlaybackLoop();
      };
      const onEnded = () => {
        if (state.timeSource !== el) return;
        stopPlaybackLoop();
        if (state.perimeter > 0) {
          state.trail.setAttribute(
            "stroke-dasharray",
            `${state.perimeter} 0`
          );
        }
        triggerEndBurst();
      };
      el.addEventListener("play", onPlay);
      el.addEventListener("playing", onPlay);
      el.addEventListener("timeupdate", () => {
        if (state.mode === "playback" && state.timeSource === el) render();
      });
      el.addEventListener("pause", onPause);
      el.addEventListener("ended", onEnded);
      el.addEventListener("seeking", () => {
        if (state.mode === "playback" && state.timeSource === el) render();
      });
      el.addEventListener("seeked", () => {
        if (state.mode === "playback" && state.timeSource === el) render();
      });
    });
  }

  function triggerEndBurst() {
    if (!state.wired || !state.svg) return;
    cancelEndBurst();
    state.svg.classList.remove("is-end-burst");
    // eslint-disable-next-line no-unused-expressions
    state.svg.getBoundingClientRect();
    state.svg.classList.add("is-end-burst");
    state.endBurstTimer = setTimeout(() => {
      state.endBurstTimer = 0;
      if (!state.wired || !state.svg) return;
      state.svg.classList.remove("is-end-burst");
      hide();
      state.mode = "idle";
      state.timeSource = null;
    }, END_BURST_MS + 40);
  }

  function cancelEndBurst() {
    if (state.endBurstTimer) {
      clearTimeout(state.endBurstTimer);
      state.endBurstTimer = 0;
    }
    if (state.svg) state.svg.classList.remove("is-end-burst");
  }

  // ---------- show/hide/reset ---------------------------------------------

  function show() {
    if (!state.wired) return;
    state.svg.classList.remove("is-fading");
    state.svg.classList.add("is-active");
    if (state.mode === "render") startRotation();
  }

  function hide() {
    if (!state.wired) return;
    state.svg.classList.remove("is-active");
    state.svg.classList.add("is-fading");
    stopPlaybackLoop();
    stopRotation();
  }

  function reset() {
    if (!state.wired) return;
    STAGES.forEach((k) => {
      state.perStage[k] = 0;
      state.done[k] = false;
    });
    state.mode = "idle";
    state.timeSource = null;
    state.rotationIndex = 0;
    stopRotation();
    stopPlaybackLoop();
    state.svg.classList.remove("is-fading");
    state.svg.classList.remove("is-waiting");
    state.svg.classList.remove("is-done-static");
    // Restore gradient stroke in case a prior done-state left it solid.
    if (state.trail) state.trail.setAttribute("stroke", `url(#${state.gradientId})`);
    applyStageHue(STAGE_HUE[STAGES[0]]);
    render();
  }

  function setProgress(stageKey, pct) {
    if (!state.wired || !STAGES.includes(stageKey)) return;
    // During playback, ignore stray render events — playback is the
    // source of truth.
    if (state.mode === "playback") return;
    const firstRenderCall = state.mode !== "render";
    state.mode = "render";
    state.perStage[stageKey] = Math.max(0, Math.min(100, Number(pct) || 0));
    show();
    if (firstRenderCall) startRotation();
    render();
  }

  function setDone(stageKey) {
    if (!state.wired || !STAGES.includes(stageKey)) return;
    if (state.mode === "playback") return;
    const firstRenderCall = state.mode !== "render";
    state.mode = "render";
    state.done[stageKey] = true;
    state.perStage[stageKey] = 100;
    show();
    if (firstRenderCall) startRotation();
    render();
  }

  // Public API — same surface as the old cssmvStageBars module so existing
  // call sites in app.mv-pipeline-panel.js etc. keep working.
  globalThis.cssmvStageBarsShow = show;
  globalThis.cssmvStageBarsHide = hide;
  globalThis.cssmvStageBarsReset = reset;
  globalThis.cssmvStageBarsSetProgress = setProgress;
  globalThis.cssmvStageBarsSetDone = setDone;
  globalThis.cssmvStageBarsStageList = () => STAGES.slice();
})();
