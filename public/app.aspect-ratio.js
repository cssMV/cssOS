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

const ASPECT_PRESETS = Object.freeze({
  "16:9": {
    key: "16:9",
    label: { en: "Landscape 16:9", zh: "横屏 16:9" },
    tagline: { en: "Standard widescreen", zh: "标准宽屏" },
    w: 1920, h: 1080,
    runwayImageRatio: "1920:1080",
    runwayVideoRatio: "1280:720"
  },
  "9:16": {
    key: "9:16",
    label: { en: "Portrait 9:16", zh: "竖屏 9:16" },
    tagline: { en: "Mobile / shorts", zh: "手机 / 短视频" },
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
    label: { en: "Phone Fullscreen (device-fit)", zh: "手机真全屏（按本机）" },
    tagline: { en: "Detected from your device — fills bezel to bezel", zh: "按当前手机屏幕规格自动检测，满铺无黑边" },
    w: 1170, h: 2532,
    runwayImageRatio: "1080:1920",
    runwayVideoRatio: "720:1280",
    isDeviceFit: true
  },
  "1:1": {
    key: "1:1",
    label: { en: "Square 1:1", zh: "方形 1:1" },
    tagline: { en: "Feed / album art", zh: "社媒 / 专辑封面" },
    w: 1080, h: 1080,
    runwayImageRatio: "1080:1080",
    runwayVideoRatio: "960:960"
  },
  "4:5": {
    key: "4:5",
    label: { en: "Social Portrait 4:5", zh: "社媒竖屏 4:5" },
    tagline: { en: "Instagram portrait", zh: "Instagram 竖图" },
    w: 1080, h: 1350,
    runwayImageRatio: "1080:1440",
    runwayVideoRatio: "832:1104"
  },
  "21:9": {
    key: "21:9",
    label: { en: "Widescreen Cinema 21:9", zh: "宽屏电影 21:9" },
    tagline: { en: "Modern cinematic", zh: "现代电影感" },
    w: 2520, h: 1080,
    runwayImageRatio: "2112:912",
    runwayVideoRatio: "1584:672"
  },
  "2.39:1": {
    key: "2.39:1",
    label: { en: "Anamorphic 2.39:1", zh: "变形宽银幕 2.39:1" },
    tagline: { en: "Classic cinema scope", zh: "经典宽银幕" },
    w: 2560, h: 1072,
    runwayImageRatio: "1808:768",
    runwayVideoRatio: "1584:672"
  },
  "32:9": {
    key: "32:9",
    label: { en: "Super-wide 32:9", zh: "超宽屏 32:9" },
    tagline: { en: "Dual-monitor / UHD banner", zh: "双屏 / 超宽横幅" },
    w: 3840, h: 1080,
    runwayImageRatio: "1808:768",
    runwayVideoRatio: "1584:672",
    warning: {
      en: "Beyond Runway's native range — cover will generate at ~2.39:1 and be letterboxed to 32:9 by ffmpeg.",
      zh: "超出 Runway 原生范围——封面将按约 2.39:1 生成，由 ffmpeg 补边至 32:9。"
    }
  },
  "custom": {
    key: "custom",
    label: { en: "Custom W×H", zh: "自定义 宽×高" },
    tagline: { en: "Pick any pixel dimensions", zh: "输入任意像素宽高" },
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

// CSSOS_WAVE_188 20260516 — Jing: 手机真全屏要按当前设备测一遍.
// Read the device's actual physical pixel grid for portrait fullscreen
// playback. Resolution priority:
//   1. screen.width × DPR  /  screen.height × DPR  → physical pixels
//   2. window.innerWidth × DPR  /  innerHeight × DPR  → viewport fallback
// Forces portrait (smaller value = width). Clamps to a safe 320–4096
// range so a weird browser zoom can't ship a tiny or huge canvas. Memo
// once per page load — re-detecting on every resolve is unnecessary and
// would shift the spec mid-pipeline if the user rotates.
let __cssosDetectedDeviceFitCache = null;
function detectDeviceFullscreenPixelsModule() {
  if (__cssosDetectedDeviceFitCache !== null) return __cssosDetectedDeviceFitCache;
  if (typeof window === "undefined" || typeof screen === "undefined") {
    __cssosDetectedDeviceFitCache = null;
    return null;
  }
  try {
    const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
    // Prefer screen.* — that's the device's display, independent of
    // address-bar collapse / split-screen window cropping.
    let cssW = Number(screen.width) || 0;
    let cssH = Number(screen.height) || 0;
    if (!(cssW > 0 && cssH > 0)) {
      cssW = Number(window.innerWidth) || 0;
      cssH = Number(window.innerHeight) || 0;
    }
    if (!(cssW > 0 && cssH > 0)) {
      __cssosDetectedDeviceFitCache = null;
      return null;
    }
    let pxW = Math.round(cssW * dpr);
    let pxH = Math.round(cssH * dpr);
    // Force portrait: smaller is width.
    if (pxW > pxH) { const t = pxW; pxW = pxH; pxH = t; }
    // Clamp into a sane range. 320×480 covers ancient devices;
    // 4096×8192 covers iPad Pro 12.9 (2048×2732) with headroom.
    pxW = Math.max(320, Math.min(4096, pxW));
    pxH = Math.max(480, Math.min(8192, pxH));
    __cssosDetectedDeviceFitCache = { w: pxW, h: pxH, dpr };
    return __cssosDetectedDeviceFitCache;
  } catch (_) {
    __cssosDetectedDeviceFitCache = null;
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

// CSSOS_PHASE2_DEFAULT_AR_BY_ORIENTATION 20260426 #138 — Jing
// "视频默认输出电影风格的Anamorphic 2.39:1，特别注意，输出之前，请检测正在
//  输出设备的横竖状态，不管是桌面端还是移动端，横屏状态，默认输出电影风格
//  的Anamorphic 2.39:1，竖屏（一般是手机端）默认输出Portrait 9:16。"
//
// Pick a default aspect ratio based on the user's current viewport
// orientation when neither state.aspectRatio nor state.outputAspectRatio
// has been set explicitly. Landscape → cinema 2.39:1, portrait → 9:16.
// Server-rendered or null window falls back to 2.39:1 (cinema first).
function defaultAspectByOrientationModule() {
  try {
    if (typeof window === "undefined") return "2.39:1";
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

  // Language-aware labels. Default to English when the runtime doesn't expose
  // an `html[lang]` — avoids leaking Chinese strings into an English UI.
  const lang = (typeof document !== "undefined" && document.documentElement
    && String(document.documentElement.lang || "").toLowerCase().startsWith("zh"))
    ? "zh" : "en";
  const label   = (preset.label   && preset.label[lang])   || (preset.label   && preset.label.en)   || presetKey;
  const tagline = (preset.tagline && preset.tagline[lang]) || (preset.tagline && preset.tagline.en) || "";
  const warning = preset.warning ? (preset.warning[lang] || preset.warning.en || "") : "";

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
