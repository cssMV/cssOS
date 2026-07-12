// CSSOS_PHASE2_ASPECT_RATIO 20260418 — shared output aspect-ratio spec for MV.
// Single source of truth that flows to:
//   1) cover image generation (/api/mv/cover ratio param),
//   2) video generation       (/api/mv/video ratio param),
//   3) ffmpeg composition     (preserved via stream-copy, no re-encode),
//   4) watch preview frame    (--cssos-output-ar CSS variable).
//
// Runway Gen-4 native ratios (our preset maps to the closest supported one
// for each endpoint; we preserve orientation rather than raw ratio if a
// direct match isn't available):
//   image:  1920:1080, 1080:1920, 1024:1024, 1360:768, 1080:1080,
//           1168:880, 1440:1080, 1080:1440, 1808:768, 2112:912
//   video:  1280:720, 720:1280, 1104:832, 832:1104, 960:960, 1584:672
//
// Public API (globals + legacy-var aliases):
//   resolveCreationAspectRatio(options) ->
//     { presetKey, label, tagline, width, height, ratioFloat,
//       orientation, runwayImageRatio, runwayVideoRatio, cssAspect, warning }
//   applyAspectRatioCssVar(spec?)            // sets --cssos-output-ar on <html>
//   normalizeAspectPresetKey(str)            // alias/fallback normalizer
//   ASPECT_PRESETS                            // map of preset metadata
//   ASPECT_PRESET_ORDER                       // display order for the selector

// English is the single source of truth; T() routes UI strings through the
// W210 lazy-translation pipeline (loginCopy → tr) at render time.
const T = (en) => (typeof globalThis.loginCopy === "function" ? globalThis.loginCopy(en) : en);

const ASPECT_PRESETS = Object.freeze({
  "16:9": {
    key: "16:9",
    label: "Landscape 16:9",
    tagline: "Standard widescreen",
    w: 1920, h: 1080,
    runwayImageRatio: "1920:1080",
    runwayVideoRatio: "1280:720"
  },
  "9:16": {
    key: "9:16",
    label: "Portrait 9:16",
    tagline: "Mobile / shorts",
    w: 1080, h: 1920,
    runwayImageRatio: "1080:1920",
    runwayVideoRatio: "720:1280"
  },
  // CSSOS_WAVE_188 20260516 — Jing: 「手机真全屏」要动态检测当前设备
  // 屏幕规格，不同手机不一样。Default w/h here is just a sensible
  // fallback for non-mobile contexts (server-side render, desktop
  // preview). resolveCreationAspectRatioModule overrides these with
  // the user's REAL device pixel grid (screen.width × DPR portrait-
  // oriented) when this preset is active — so iPhone SE gets 750×1334,
  // iPhone 14 Pro gets 1179×2556, Pixel 7 gets 1080×2400, etc.
  "9:19.5": {
    key: "9:19.5",
    label: "Phone Fullscreen (device-fit)",
    tagline: "Auto-detects device + current orientation at render time",
    w: 1170, h: 2532,
    runwayImageRatio: null, // resolved at render-time from live orientation
    runwayVideoRatio: null,
    isDeviceFit: true
  },
  "1:1": {
    key: "1:1",
    label: "Square 1:1",
    tagline: "Feed / album art",
    w: 1080, h: 1080,
    runwayImageRatio: "1080:1080",
    runwayVideoRatio: "960:960"
  },
  "4:5": {
    key: "4:5",
    label: "Social Portrait 4:5",
    tagline: "Instagram portrait",
    w: 1080, h: 1350,
    runwayImageRatio: "1080:1440",
    runwayVideoRatio: "832:1104"
  },
  "21:9": {
    key: "21:9",
    label: "Widescreen Cinema 21:9",
    tagline: "Modern cinematic",
    w: 2520, h: 1080,
    runwayImageRatio: "2112:912",
    runwayVideoRatio: "1584:672"
  },
  "2.39:1": {
    key: "2.39:1",
    label: "Anamorphic 2.39:1",
    tagline: "Classic cinema scope",
    w: 2560, h: 1072,
    runwayImageRatio: "1808:768",
    runwayVideoRatio: "1584:672"
  },
  "32:9": {
    key: "32:9",
    label: "Super-wide 32:9",
    tagline: "Dual-monitor / UHD banner",
    w: 3840, h: 1080,
    runwayImageRatio: "1808:768",
    runwayVideoRatio: "1584:672",
    warning: "Beyond Runway's native range — cover will generate at ~2.39:1 and be letterboxed to 32:9 by ffmpeg."
  },
  "custom": {
    key: "custom",
    label: "Custom W×H",
    tagline: "Pick any pixel dimensions",
    w: null, h: null,
    runwayImageRatio: null,
    runwayVideoRatio: null
  }
});

const ASPECT_PRESET_ORDER = Object.freeze([
  "16:9", "9:16", "9:19.5", "1:1", "4:5", "21:9", "2.39:1", "32:9", "custom"
]);

// Master list of Runway Gen-4 ratios. Kept verbatim from the Runway docs;
// used when a custom ratio needs to fall back to the closest native one.
const RUNWAY_IMAGE_RATIOS = Object.freeze([
  "1920:1080", "1080:1920", "1024:1024", "1360:768", "1080:1080",
  "1168:880",  "1440:1080", "1080:1440", "1808:768", "2112:912"
]);
const RUNWAY_VIDEO_RATIOS = Object.freeze([
  "1280:720", "720:1280", "1104:832", "832:1104", "960:960", "1584:672"
]);

function parseRatioFloatModule(s) {
  if (!s || typeof s !== "string") return null;
  const parts = s.split(":");
  if (parts.length !== 2) return null;
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return w / h;
}

function pickClosestRunwayRatioModule(targetFloat, pool) {
  if (!Number.isFinite(targetFloat) || targetFloat <= 0) return pool[0];
  let best = pool[0];
  let bestDelta = Infinity;
  for (const r of pool) {
    const f = parseRatioFloatModule(r);
    if (f === null) continue;
    // Log-distance keeps 1920/1080 equidistant from 1080/1920 when target is 1:1,
    // and gives us a stable "closest ratio" metric across orientations.
    const delta = Math.abs(Math.log(f) - Math.log(targetFloat));
    if (delta < bestDelta) {
      bestDelta = delta;
      best = r;
    }
  }
  return best;
}

function clampCustomDimensionModule(value, fallback, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(min, Math.min(max, n));
}

// CSSOS_WAVE_189 20260516 — Jing: 手机真全屏要按当前设备 + 当前横竖屏
// 状态实时检测，每次输出前都重新测一遍，不再 cache.
// 横屏手机就按横屏真全屏出，竖屏手机就按竖屏真全屏出。
//
// Detection chain:
//   1. screen.width × DPR  /  screen.height × DPR     — physical pixels
//   2. window.innerWidth × DPR  /  innerHeight × DPR  — viewport fallback
// Honors the CURRENT orientation (does NOT force portrait — landscape
// phones get a landscape device-fit, portrait phones get portrait).
// Clamps to [320..4096] × [320..8192] for safety against weird zooms.
// NO memoization — every call re-reads the live screen so the user
// can rotate up until the moment they hit "Start Pipeline".
function detectDeviceFullscreenPixelsModule() {
  if (typeof window === "undefined" || typeof screen === "undefined") return null;
  try {
    const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
    // Prefer screen.* — that's the device's display, independent of
    // address-bar collapse / split-screen window cropping. We DO want
    // its orientation though, so read width/height honestly.
    let cssW = Number(screen.width) || 0;
    let cssH = Number(screen.height) || 0;
    if (!(cssW > 0 && cssH > 0)) {
      cssW = Number(window.innerWidth) || 0;
      cssH = Number(window.innerHeight) || 0;
    }
    if (!(cssW > 0 && cssH > 0)) return null;

    // screen.width/height on some browsers stays "natural orientation"
    // (e.g. tablet portrait-native reports portrait even when held
    // landscape). Cross-check with the live viewport orientation so we
    // honor how the device is held RIGHT NOW.
    const viewportLandscape = (Number(window.innerWidth) || 0) >= (Number(window.innerHeight) || 0);
    const screenLandscape   = cssW >= cssH;
    if (viewportLandscape !== screenLandscape) {
      // Swap to match the live viewport orientation.
      const t = cssW; cssW = cssH; cssH = t;
    }

    let pxW = Math.round(cssW * dpr);
    let pxH = Math.round(cssH * dpr);
    pxW = Math.max(320, Math.min(4096, pxW));
    pxH = Math.max(320, Math.min(8192, pxH));
    return { w: pxW, h: pxH, dpr, orientation: pxW >= pxH ? "landscape" : "portrait" };
  } catch (_) {
    return null;
  }
}

function normalizeAspectPresetKeyModule(key) {
  if (!key || typeof key !== "string") return "16:9";
  const trimmed = key.trim();
  if (Object.prototype.hasOwnProperty.call(ASPECT_PRESETS, trimmed)) return trimmed;
  const aliases = {
    "landscape": "16:9", "horizontal": "16:9", "widescreen": "16:9", "16x9": "16:9",
    "portrait": "9:16", "vertical": "9:16", "9x16": "9:16",
    "square": "1:1", "1x1": "1:1",
    "cinema": "2.39:1", "anamorphic": "2.39:1", "239": "2.39:1",
    "ultrawide": "32:9", "superwide": "32:9", "32x9": "32:9"
  };
  const lowered = trimmed.toLowerCase();
  return aliases[lowered] || "16:9";
}

// CSSOS_WAVE_189 20260516 — Jing: 手机端 (无论横竖) 默认 device-fit 真全屏;
// 桌面端横屏默认电影风格 2.39:1，桌面端竖屏窗口默认 9:16 单曲短视频.
//
// 不再用固定 9:16 兜底手机. 用 device-fit 预设, 它会按用户当前手持的
// 横竖屏状态实时输出对应分辨率的真全屏媒体.
//
// Detection: pointer:coarse OR small viewport → mobile/touch device.
// Mobile → "9:19.5" (the device-fit preset; it adapts to current
// orientation at resolve time). Desktop landscape → "2.39:1" cinema.
// Desktop portrait window (rare) → "9:16". Server-rendered → 2.39:1.
function defaultAspectByOrientationModule() {
  try {
    if (typeof window === "undefined") return "2.39:1";
    const isMobile = (typeof window.matchMedia === "function")
      && (window.matchMedia("(pointer: coarse)").matches
          || window.matchMedia("(max-width: 768px)").matches);
    if (isMobile) return "9:19.5";
    const w = Number(window.innerWidth || 0);
    const h = Number(window.innerHeight || 0);
    if (!w || !h) return "2.39:1";
    return w >= h ? "2.39:1" : "9:16";
  } catch (_e) {
    return "2.39:1";
  }
}
if (typeof globalThis !== "undefined") {
  globalThis.cssmvDefaultAspectByOrientation = defaultAspectByOrientationModule;
}

function resolveCreationAspectRatioModule(options) {
  const opts = options && typeof options === "object" ? options : {};
  const stateLike = opts.state
    || (typeof globalThis.creationState !== "undefined" ? globalThis.creationState : {});

  const rawKey = stateLike.aspectRatio
    || stateLike.outputAspectRatio
    || defaultAspectByOrientationModule();
  const presetKey = normalizeAspectPresetKeyModule(rawKey);
  const preset = ASPECT_PRESETS[presetKey] || ASPECT_PRESETS["16:9"];

  let w, h;
  if (presetKey === "custom") {
    w = clampCustomDimensionModule(stateLike.customWidth, 1920, 64, 8192);
    h = clampCustomDimensionModule(stateLike.customHeight, 1080, 64, 8192);
  } else if (preset.isDeviceFit) {
    // CSSOS_WAVE_188 — read the user's ACTUAL device pixel grid so the
    // output media truly fills THAT phone. Forces portrait (smaller is
    // width, larger is height). Detection runs only in a browser
    // context; falls back to the preset defaults otherwise.
    const detected = detectDeviceFullscreenPixelsModule();
    if (detected) {
      w = detected.w;
      h = detected.h;
    } else {
      w = preset.w;
      h = preset.h;
    }
  } else {
    w = preset.w;
    h = preset.h;
  }

  const ratioFloat = w / h;
  const orientation =
    Math.abs(ratioFloat - 1) < 0.02 ? "square"
    : ratioFloat > 1 ? "landscape"
    : "portrait";

  const runwayImageRatio = preset.runwayImageRatio
    || pickClosestRunwayRatioModule(ratioFloat, RUNWAY_IMAGE_RATIOS);
  const runwayVideoRatio = preset.runwayVideoRatio
    || pickClosestRunwayRatioModule(ratioFloat, RUNWAY_VIDEO_RATIOS);

  // English is authored here; T() lazily localizes via the W210 pipeline.
  const label   = preset.label   ? T(preset.label)   : presetKey;
  const tagline = preset.tagline ? T(preset.tagline) : "";
  const warning = preset.warning ? T(preset.warning) : "";

  return {
    presetKey,
    label,
    tagline,
    width: w,
    height: h,
    ratioFloat,
    orientation,
    runwayImageRatio,
    runwayVideoRatio,
    cssAspect: `${w} / ${h}`,
    warning
  };
}

function applyAspectRatioCssVarModule(spec) {
  if (typeof document === "undefined" || !document.documentElement) return null;
  const resolved = spec && spec.cssAspect ? spec : resolveCreationAspectRatioModule();
  document.documentElement.style.setProperty("--cssos-output-ar", resolved.cssAspect);
  document.documentElement.setAttribute("data-output-orientation", resolved.orientation);
  return resolved;
}

Object.assign(globalThis, {
  ASPECT_PRESETS,
  ASPECT_PRESET_ORDER,
  RUNWAY_IMAGE_RATIOS,
  RUNWAY_VIDEO_RATIOS,
  resolveCreationAspectRatioModule,
  resolveCreationAspectRatio: resolveCreationAspectRatioModule,
  applyAspectRatioCssVarModule,
  applyAspectRatioCssVar: applyAspectRatioCssVarModule,
  normalizeAspectPresetKey: normalizeAspectPresetKeyModule,
  normalizeAspectPresetKeyModule,
  // CSSOS_WAVE_188 — surface the detector so other modules (e.g. the
  // pipeline panel caption) can show "(detected 1170×2532)".
  detectDeviceFullscreenPixelsModule
});

// Legacy var bindings for scripts that may reference these symbols directly.
// eslint-disable-next-line no-var
var resolveCreationAspectRatio = resolveCreationAspectRatioModule;
// eslint-disable-next-line no-var
var applyAspectRatioCssVar = applyAspectRatioCssVarModule;

// CSSOS_PHASE2_P2_53_OUTPUT_AR 20260418 — auto-apply the default spec on page
// load so the Watch preview frame always has a concrete --cssos-output-ar set
// on :root, not just the stylesheet fallback. We run once on DOMContentLoaded
// and once again after 'load' in case creationState is populated late.
(function autoApplyOnLoad() {
  if (typeof document === "undefined" || !document.documentElement) return;
  function apply() {
    try { applyAspectRatioCssVarModule(); } catch (_e) { /* non-fatal */ }
  }
  if (document.readyState === "complete" || document.readyState === "interactive") {
    apply();
  } else {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  }
  window.addEventListener("load", apply, { once: true });
})();
