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
  //   0.5 = default (15s per frame)
  //   0.85 = near-video (≈4.5s per frame) — WAVE_444d new default
  //   1.0 = fast (3s per frame, energetic music-video)
  // Persisted to localStorage. Reads back on init so the user's last
  // preference survives reloads.
  const STORAGE_KEY = "cssmv.slideshow.intensity";
  // WAVE_444d 20260526: raised default from 0.5→0.85 for near-video feel.
  // Users who previously saved a preference keep theirs (localStorage wins).
  let intensity = 0.85;
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
    // WAVE_444e 20260526 — 12 Ken Burns variants for near-video feel:
    //   0-3  zoom-in  to the four corners
    //   4-7  zoom-out FROM the four corners (特写→全图)
    //   8-9  horizontal pan L→R / R→L
    //   10-11 vertical pan  U→D / D→U
    // Each slide picks variant = __kbCounter % 12 so adjacent frames
    // never repeat the same motion.
    const totalMs = FADE_IN_MS + MAIN_MS + FADE_OUT_MS;
    st.textContent = `
/* --- zoom-in to corner --- */
@keyframes cssmv-kb-0  { from{transform:scale(1.00)translate( 0%,  0%)} to{transform:scale(1.14)translate(-3%,-3%)} }
@keyframes cssmv-kb-1  { from{transform:scale(1.00)translate( 0%,  0%)} to{transform:scale(1.14)translate( 3%,-3%)} }
@keyframes cssmv-kb-2  { from{transform:scale(1.00)translate( 0%,  0%)} to{transform:scale(1.14)translate(-3%, 3%)} }
@keyframes cssmv-kb-3  { from{transform:scale(1.00)translate( 0%,  0%)} to{transform:scale(1.14)translate( 3%, 3%)} }
/* --- zoom-out from corner (特写→全图) --- */
@keyframes cssmv-kb-4  { from{transform:scale(1.16)translate(-4%,-4%)} to{transform:scale(1.00)translate( 0%,  0%)} }
@keyframes cssmv-kb-5  { from{transform:scale(1.16)translate( 4%,-4%)} to{transform:scale(1.00)translate( 0%,  0%)} }
@keyframes cssmv-kb-6  { from{transform:scale(1.16)translate(-4%, 4%)} to{transform:scale(1.00)translate( 0%,  0%)} }
@keyframes cssmv-kb-7  { from{transform:scale(1.16)translate( 4%, 4%)} to{transform:scale(1.00)translate( 0%,  0%)} }
/* --- horizontal pan --- */
@keyframes cssmv-kb-8  { from{transform:scale(1.07)translate( 3%, 0%)} to{transform:scale(1.07)translate(-3%,  0%)} }
@keyframes cssmv-kb-9  { from{transform:scale(1.07)translate(-3%, 0%)} to{transform:scale(1.07)translate( 3%,  0%)} }
/* --- vertical pan --- */
@keyframes cssmv-kb-10 { from{transform:scale(1.07)translate(0%,  3%)} to{transform:scale(1.07)translate(  0%,-3%)} }
@keyframes cssmv-kb-11 { from{transform:scale(1.07)translate(0%, -3%)} to{transform:scale(1.07)translate(  0%, 3%)} }
/* --- WAVE_446: focal-point smart zoom (transform-origin set per-element) --- */
/* zoom-in: wide → 特写 (pull viewer toward subject) */
@keyframes cssmv-kb-focal-in  { from{transform:scale(1.00)} to{transform:scale(1.26)} }
/* zoom-out: 特写 → wide (cinematic reveal, "real video" feel) */
@keyframes cssmv-kb-focal-out { from{transform:scale(1.26)} to{transform:scale(1.00)} }

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
  will-change: transform, opacity;
}
.cssmv-cover-slide.is-visible {
  opacity: 1;
  animation-duration: ${totalMs}ms;
  animation-timing-function: ease-in-out;
  animation-fill-mode: both;
}
.cssmv-cover-slide.cssmv-kb-0.is-visible  { animation-name: cssmv-kb-0;  }
.cssmv-cover-slide.cssmv-kb-1.is-visible  { animation-name: cssmv-kb-1;  }
.cssmv-cover-slide.cssmv-kb-2.is-visible  { animation-name: cssmv-kb-2;  }
.cssmv-cover-slide.cssmv-kb-3.is-visible  { animation-name: cssmv-kb-3;  }
.cssmv-cover-slide.cssmv-kb-4.is-visible  { animation-name: cssmv-kb-4;  }
.cssmv-cover-slide.cssmv-kb-5.is-visible  { animation-name: cssmv-kb-5;  }
.cssmv-cover-slide.cssmv-kb-6.is-visible  { animation-name: cssmv-kb-6;  }
.cssmv-cover-slide.cssmv-kb-7.is-visible  { animation-name: cssmv-kb-7;  }
.cssmv-cover-slide.cssmv-kb-8.is-visible  { animation-name: cssmv-kb-8;  }
.cssmv-cover-slide.cssmv-kb-9.is-visible  { animation-name: cssmv-kb-9;  }
.cssmv-cover-slide.cssmv-kb-10.is-visible { animation-name: cssmv-kb-10; }
.cssmv-cover-slide.cssmv-kb-11.is-visible { animation-name: cssmv-kb-11; }
.cssmv-cover-slide.cssmv-kb-focal-in.is-visible  { animation-name: cssmv-kb-focal-in;  }
.cssmv-cover-slide.cssmv-kb-focal-out.is-visible { animation-name: cssmv-kb-focal-out; }
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
    const newSlides = cleaned.filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
    if (!newSlides.length) return;
    /* W335 20260522 — skip re-render if slides are identical to avoid the
     * flash caused by multiple callers (pre-paint + media-layout render)
     * each injecting a new slide on top of the existing one. */
    const same = newSlides.length === state.slides.length &&
      newSlides.every((u, i) => u === state.slides[i]);
    if (same) return;
    state.slides = newSlides;
    // WAVE_446: kick off background focal-point detection so it is cached
    // by the time each slide is displayed.
    _prefetchFocal(newSlides);
    // Only re-render current frame when the slideshow is already running —
    // if it hasn't started yet, startMv/startMusic will render frame 0.
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

  // CSSOS_WAVE_617 — Jing「幻灯帧池串台: 上一首/最新封面混进别的歌」根治: 加【清空池】API。
  // 此前 cssmvSetCoverSlides([]) 因 !newSlides.length 直接 return, 根本清不掉池 → 切到无帧作品时
  // 旧帧残留。切作品时(work-id-binding flush)调本函数, 保证每首只用自己的帧(严格按 ID)。
  globalThis.cssmvClearCoverSlides = function cssmvClearCoverSlides() {
    state.slides = [];
    state.mvIndex = 0;
    state.musicIndex = 0;
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

  // CSSOS_WAVE_1000 20260619 — Jing「揪后台吸血鬼」: 面板被盖住(covered≠closed)时, 幻灯定时器
  // 仍每 ~4.5s 增删带 will-change 的 slide DOM = 没人看却在后台 churn 吃内存。这里给换帧加
  // 【可见性闸】: 文档隐藏、或 watch 面板/宿主元素当前不可见时, 直接跳过换帧(不增删 DOM, 不跑
  // 运镜动画), 内存与合成开销归零; 面板重新可见时下一拍自然继续。timer 本身极廉, 不必拆。
  function _slideshowVisible(host) {
    try {
      if (document.hidden) return false;
      if (!host) return false;
      // offsetParent===null ⇒ 元素或其祖先 display:none / 被隐藏面板包住 ⇒ 不可见。
      if (host.offsetParent === null && host.tagName !== "BODY") {
        // fixed 定位元素 offsetParent 恒 null, 用 getClientRects 兜底判可见。
        if (!host.getClientRects || host.getClientRects().length === 0) return false;
      }
      var wp = document.getElementById("watch-panel");
      if (wp && wp.classList.contains("hidden")) return false;
    } catch (_e) {}
    return true;
  }

  // ---------- MV tab host (#watch-svg) ----------

  function mvHost() { return document.getElementById("watch-svg"); }

  function startMv() {
    const host = mvHost();
    if (!host) return;
    if (state.mvActive) return;
    if (host.tagName !== "IMG") host.classList.add("cssmv-slideshow-host");
    state.mvActive = true;
    // CSSOS_WAVE_1001b 20260619 — Jing回归修复: 纯一次性导致【无视频作品(create_work 多部曲)】
    // 封面幻灯渲染时机错过就永久空白 → 主人"画面不显示"。恢复循环换帧【保证画面一定出现】, 但保留
    // W1000 可见性闸: 面板被盖/隐藏时跳过换帧(不 churn DOM、不吃内存)。两全。
    state.mvIndex = state.slides.length ? Math.floor(Math.random() * state.slides.length) : 0;
    if (state.slides.length) renderMvFrame(state.mvIndex);
    state.mvTimer = setInterval(() => {
      if (!state.slides.length) return;
      if (!_slideshowVisible(mvHost())) return;   // W1000 — 不可见不 churn
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
    // CSSOS_WAVE_1001b — 恢复循环 + 保留可见性闸(见 startMv 说明)。
    state.musicIndex = state.slides.length ? Math.floor(Math.random() * state.slides.length) : 0;
    if (state.slides.length) renderMusicFrame(state.musicIndex);
    state.musicTimer = setInterval(() => {
      if (!state.slides.length) return;
      if (!_slideshowVisible(musicHosts()[0])) return;   // W1000 — 不可见不 churn
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

  let __kbCounter = 0; // WAVE_444d: cycles through 0-3 Ken Burns variants

  // ── WAVE_446 20260526 Smart focal-point Ken Burns ────────────────────────
  // Detect the visual centre-of-interest for each cover image and use it as
  // transform-origin so the Ken Burns zoom-in/out motion is anchored to the
  // subject rather than a fixed corner.
  //
  // Detection pipeline (two strategies, whichever succeeds first):
  //   1. FaceDetector API — face bounding-box centre (no CORS needed)
  //   2. Canvas pixel analysis — find 8×8 grid cell with highest saliency
  //      (weighted sum of brightness + colour saturation)
  //   Fallback: upper-centre rule-of-thirds (50%, 38%).
  //
  // Results are cached by URL so repeated frames have zero extra cost.
  // Detection is kicked off eagerly when cssmvSetCoverSlides() is called
  // (background prefetch) so by the time injectSlide() needs the value it is
  // almost always already in the cache.  injectSlide() itself stays
  // synchronous — it reads from cache and falls back to the default if the
  // async work has not yet completed.
  // ─────────────────────────────────────────────────────────────────────────

  const focalCache = new Map(); // url → {x, y}  (0–100 each)
  const FOCAL_DEFAULT = { x: 50, y: 38 }; // upper-centre, rule of thirds

  function _focalClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  async function _detectFocalPoint(url) {
    if (focalCache.has(url)) return focalCache.get(url);

    // CSSOS_WAVE_440 20260526 — Jing「DevTools: CORS 报错 + net::ERR_FAILED」: covers now
    // live on cdn.cssstudio.app (R2), whose custom-domain serving does NOT send
    // Access-Control-Allow-Origin. A crossOrigin Image of a cross-origin cover is
    // CORS-blocked (the catch already falls back, but it spams the console + wastes a
    // fetch). Cross-origin images can't be read into a canvas anyway, so skip focal
    // detection for them entirely → center default, no error, no extra request.
    try {
      if (new URL(url, location.href).origin !== location.origin) {
        focalCache.set(url, FOCAL_DEFAULT);
        return FOCAL_DEFAULT;
      }
    } catch (_e) {}

    // Load image ONCE for both strategies.
    // crossOrigin="anonymous" is required for canvas getImageData().
    // If the URL is already cached by the browser without CORS headers (because
    // CSS backgroundImage loaded it first), the browser re-fetches it — acceptable
    // one-time cost.  If the server refuses CORS entirely, img.onerror fires and
    // we go straight to FOCAL_DEFAULT.
    let img;
    try {
      img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    } catch (_) {
      focalCache.set(url, FOCAL_DEFAULT);
      return FOCAL_DEFAULT;
    }

    // --- Strategy 1: FaceDetector (reuses already-loaded img, no extra fetch) ---
    if (typeof FaceDetector !== "undefined") {
      try {
        const det = new FaceDetector({ maxDetectedFaces: 1, fastMode: true });
        const faces = await det.detect(img);
        if (faces.length > 0) {
          const b = faces[0].boundingBox;
          const x = _focalClamp(Math.round(((b.x + b.width  * 0.5) / img.naturalWidth)  * 100), 10, 90);
          const y = _focalClamp(Math.round(((b.y + b.height * 0.4) / img.naturalHeight) * 100), 10, 85);
          const result = { x, y };
          focalCache.set(url, result);
          return result;
        }
      } catch (_) { /* API unsupported or blocked — fall through */ }
    }

    // --- Strategy 2: Canvas local-contrast saliency ---
    // Bug-fix vs first draft: instead of "find brightest+most-saturated cell"
    // (which latches onto skies and light sources), we measure each cell's
    // LOCAL CONTRAST — how much its average colour deviates from the whole-image
    // mean.  The most-deviating cell is where the eye naturally goes.
    // A small centre-weighting bias nudges ties toward the compositional centre.
    try {
      const SIZE = 32, GRID = 8, CELL = SIZE / GRID;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE); // throws if CORS-tainted

      // Compute whole-image mean luminance and mean saturation.
      let sumL = 0, sumS = 0;
      const N = SIZE * SIZE;
      for (let i = 0; i < N * 4; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        sumL += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        sumS += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      }
      const meanL = sumL / N;
      const meanS = sumS / N;

      let maxSal = -1, bx = GRID >> 1, by = GRID >> 1;
      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          // Cell mean
          let cL = 0, cS = 0;
          for (let py = 0; py < CELL; py++) {
            for (let px = 0; px < CELL; px++) {
              const i = ((gy * CELL + py) * SIZE + (gx * CELL + px)) * 4;
              const r = data[i], g = data[i + 1], b = data[i + 2];
              cL += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              cS += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
            }
          }
          cL /= CELL * CELL;
          cS /= CELL * CELL;
          // Local contrast = deviation from whole-image mean
          const contrast = Math.abs(cL - meanL) * 0.6 + Math.abs(cS - meanS) * 0.4;
          // Centre-proximity bonus: cells closer to (cx, cy) get +0.08 max
          const cx = (GRID - 1) / 2, cy = (GRID - 1) / 2;
          const dist = Math.sqrt((gx - cx) ** 2 + (gy - cy) ** 2) / (GRID * 0.7);
          const sal = contrast + 0.08 * Math.max(0, 1 - dist);
          if (sal > maxSal) { maxSal = sal; bx = gx; by = gy; }
        }
      }
      const x = _focalClamp(Math.round(((bx + 0.5) / GRID) * 100), 5, 95);
      const y = _focalClamp(Math.round(((by + 0.5) / GRID) * 100), 5, 95);
      const result = { x, y };
      focalCache.set(url, result);
      return result;
    } catch (_) { /* CORS-tainted canvas or unsupported */ }

    // Fallback: upper-centre rule-of-thirds
    focalCache.set(url, FOCAL_DEFAULT);
    return FOCAL_DEFAULT;
  }

  // Kick off background detection for a list of URLs without blocking callers.
  function _prefetchFocal(urls) {
    for (const url of urls) {
      if (!focalCache.has(url)) {
        _detectFocalPoint(url).catch(() => {});
      }
    }
  }

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
    // WAVE_445e: Remove ALL existing slides (visible + fading-out) to prevent
    // GPU layer accumulation on rapid work-switches. At intensity 0.85 (~4.5s
    // frames) rapid switching desynchronises self-fade timers and orphaned
    // .is-fading-out slides with will-change:transform pile up invisible in DOM.
    host.querySelectorAll(".cssmv-cover-slide").forEach((el) => {
      try { el.remove(); } catch (_e) {}
    });
    const next = document.createElement("div");

    // WAVE_446: use focal-point animation when we have a cached focal point;
    // fall back to the classic 12-variant cycling otherwise.
    // Alternate focal-in / focal-out every other frame for cinematic variety.
    const focal = focalCache.get(url) || null;
    let kbClass;
    if (focal) {
      // Even counter → zoom-out (特写→全图, most "real video" feel)
      // Odd counter  → zoom-in  (wide→特写)
      kbClass = (__kbCounter % 2 === 0) ? "cssmv-kb-focal-out" : "cssmv-kb-focal-in";
      next.style.transformOrigin = `${focal.x}% ${focal.y}%`;
    } else {
      kbClass = "cssmv-kb-" + (__kbCounter % 12);
    }
    __kbCounter++;

    next.className = "cssmv-cover-slide " + kbClass;
    next.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
    host.appendChild(next);
    // Force reflow then mark visible so the 5s opacity transition runs.
    void next.offsetWidth;
    next.classList.add("is-visible");
    // CSSOS_WAVE_1001b — 恢复 self-fade(配合循环换帧), 否则多帧叠加。每帧 FADE_IN+MAIN 后淡出。
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

  // CSSOS_WAVE_1007 20260619 — Jing「MV 黑屏有声无画面, 改了好几波都没好」根因: 播放有多条
  // 路径(openMarketWorkPreview / hydrateWatchFromRunPayload / queue-advance / cinema), 逐个修
  // 不可靠 —— 总有一条没把封面喂给幻灯。改用【路径无关的兜底看门狗】: 只要 watch 面板可见、
  // 且没有视频在出画面、且幻灯也空, 就用【当前作品封面】强行铺满。封面来源按优先级从多个全局取,
  // 不依赖任何单一 play 路径。可见时才跑(W1000 闸), 不可见不工作。
  function _currentCoverUrl() {
    var cands = [];
    try { cands.push(globalThis.cssmvPipelineLastResult && globalThis.cssmvPipelineLastResult.coverUrl); } catch (_e) {}
    try { cands.push(globalThis.currentPreviewCoverUrl); } catch (_e) {}
    try { cands.push(globalThis.currentWatchPreviewWork && (globalThis.currentWatchPreviewWork.cover_image_url || globalThis.currentWatchPreviewWork.cover_image || globalThis.currentWatchPreviewWork.preview_image_url)); } catch (_e) {}
    for (var i = 0; i < cands.length; i++) {
      var u = (typeof cands[i] === "string") ? cands[i].trim() : "";
      if (u) return u;
    }
    return "";
  }
  function _watchVisible() {
    if (document.hidden) return false;
    var wp = document.getElementById("watch-panel");
    return !!(wp && !wp.classList.contains("hidden") && wp.dataset.minimized !== "true");
  }
  function _videoShowingPicture() {
    var v = document.getElementById("watch-video");
    if (!v) return false;
    var hasSrc = !!String(v.currentSrc || v.src || "").trim();
    // readyState>=2 = 有当前帧可显示; opacity 0 = 被兜底隐藏(不算在出画面)。
    var visible = true;
    try { visible = getComputedStyle(v).opacity !== "0" && v.style.opacity !== "0"; } catch (_e) {}
    return hasSrc && v.readyState >= 2 && visible;
  }
  setInterval(function () {
    try {
      if (document.hidden) return;
      // CSSOS_WAVE_1018 20260619 — 影院层(#cssos-cinema-stage)兜底已删: 该元素是早期设计遗留,
      //   现已无任何代码创建它(真全屏影院 = watch 面板最大化)。只保留 watch 面板兜底。
      // —— watch 面板兜底 ——
      if (!_watchVisible()) return;
      if (_videoShowingPicture()) return;          // 视频在出画面 → 不插手
      // CSSOS_WAVE_1009 — 空的 #watch-video(无 src)若不透明会盖住下层封面幻灯 → 仍黑。
      // 没视频在出画面时, 把视频元素隐藏(opacity 0), 让封面幻灯透出。视频回来时其它路径会复位。
      try {
        var _wv = document.getElementById("watch-video");
        if (_wv && !String(_wv.currentSrc || _wv.src || "").trim()) {
          _wv.style.opacity = "0";
        }
      } catch (_e) {}
      var cover = _currentCoverUrl();
      if (!cover) return;                          // 实在没封面也没办法
      // 当前封面已在幻灯里就不重复设(避免每 1.5s 重渲染), 否则设上并启动。
      if (!(state.mvActive && state.slides.length === 1 && state.slides[0] === cover)) {
        globalThis.cssmvSetCoverSlides([cover]);
      }
      startMv();                                   // 幂等; 保证铺满当前封面, 黑屏消除
    } catch (_e) {}
  }, 1500);
})();
