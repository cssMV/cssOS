const WATCH_ACTIVE_TAB_STORAGE_KEY = "cssos.watch.activeTab";
const WATCH_COMMENTS_STORAGE_KEY = "cssos.watch.comments";
const WATCH_MUSIC_ART_BLUR_KEY = "cssos.watch.musicArtBlur.v2";
const WATCH_FRAME_CACHE_LIMIT = 12;
const WATCH_FRAME_SEQUENCE_CACHE_LIMIT = 8;
const watchScreen = globalThis.watchScreen || document.getElementById("watch-screen");
const watchScreenBackdrop = document.getElementById("watch-screen-backdrop");
const watchStyleShift = document.getElementById("watch-style-shift");
const watchMusicArtBlur = document.getElementById("watch-music-art-blur");
const watchCommentsList = document.getElementById("watch-comments-list");
const watchCommentForm = document.getElementById("watch-comment-form");
const watchCommentInput = document.getElementById("watch-comment-input");
const watchCommentSubmit = document.getElementById("watch-comment-submit");
const watchLyricsMusicStyle = document.getElementById("watch-lyrics-music-style");
const watchLyricsWikiSource = document.getElementById("watch-lyrics-wiki-source");
const watchFrameProgress = document.getElementById("watch-frame-progress");
const watchFrameProgressFill = document.getElementById("watch-frame-progress-fill");
const watchFrameProgressCopy = document.getElementById("watch-frame-progress-copy");

globalThis.watchScreenBackdrop = watchScreenBackdrop;
globalThis.watchStyleShift = watchStyleShift;
globalThis.watchMusicArtBlur = watchMusicArtBlur;
globalThis.watchCommentForm = watchCommentForm;
globalThis.watchCommentInput = watchCommentInput;
globalThis.watchCommentSubmit = watchCommentSubmit;
globalThis.watchLyricsMusicStyle = watchLyricsMusicStyle;
globalThis.watchLyricsWikiSource = watchLyricsWikiSource;
globalThis.watchFrameProgress = watchFrameProgress;
const watchPanelProgressLine = document.getElementById("watch-panel-progress-line");
const watchPanelProgressFill = document.getElementById("watch-panel-progress-fill");
const watchMusicFrameProgress = document.getElementById("watch-music-frame-progress");
const watchMusicFrameProgressFill = document.getElementById("watch-music-frame-progress-fill");
const watchMusicFrameProgressCopy = document.getElementById("watch-music-frame-progress-copy");
let watchActiveTab = localStorage.getItem(WATCH_ACTIVE_TAB_STORAGE_KEY) || "mv";
// CSSOS_WAVE_260 20260520 — Jing: 进面板默认就是 MV tab 自动播 (TikTok 愿景).
// 此前移动端/Tesla 会被强制跳到 Music tab (怕 autoplay-with-sound 被拦),
// 但那与"MV-first 自动播"冲突 —— 现在移除该强制. 浏览器的静音/autoplay
// 限制已由 cssos-tap-to-play-overlay (首次轻触解锁整段会话) 兜底, 所以
// MV tab 默认打开 + W250 自动播放是安全的. 用户若手动选过 Music, localStorage
// 仍会被尊重 (上一行的 || "mv" 只在无存储时兜底到 MV).
globalThis.watchActiveTab = watchActiveTab;
let currentPreviewVideoIsLocalFallback = false;
globalThis.currentPreviewFrameDataUrl ??= "";
globalThis.currentPreviewFrameSequence ??= [];
let currentForyouThumbFallbackDataUrl = "";
let watchVideoUrl = null;
let watchPreviewLimitSec = 0;
let watchPreviewLimitReason = "";
let watchPreviewLimitNoticeShown = false;
globalThis.watchFrameLoopTimer ??= null;
globalThis.watchFrameCache ??= new Map();
globalThis.watchFrameSequenceCache ??= new Map();
globalThis.watchManualPlayHinted ??= false;
globalThis.watchPlaybackRetry ??= 0;
globalThis.watchPlaybackTimer ??= null;
globalThis.currentPreviewVideoDurationSec ??= 0;
globalThis.currentPreviewVideoSourceKind ??= "none";
globalThis.currentPreviewVideoHasUsableFrame ??= false;
globalThis.currentPreviewMotionClipUrl ??= "";
globalThis.watchExplicitPreviewAllowedUntil ??= 0;
let watchDetailsReveal = false;
let watchTouchStartY = 0;
let watchVideoRestrictionHits = 0;
let watchCommentsState = [];
let watchProgressStageKey = "lyrics";
let watchProgressLastFingerprint = "";
let watchProgressLastChangeAt = 0;
const WATCH_PROGRESS_STALL_MS = 18000;
// WATCH_PROGRESS_ROTATE_CADENCE 20260420 — Jing: the hint text + percent +
// progress bar must all rotate in lock-step. Previously this was 3000ms while
// app.watch-stage-bars.js rotates at 5000ms, so the three readouts drifted
// out of phase (e.g. hint says "正在创作歌词" while the bar is already on
// "封面图"). Pinned at 5000ms to match ROTATION_MS in stage-bars.
const WATCH_PROGRESS_ROTATE_MS = 5000;
const WATCH_ARTWORK_SLIDESHOW_MS = 15000;
let watchAutoRecoveryKey = "";
let watchAutoRecoveryStartedAt = 0;
let lastWatchArtworkPreloadSrc = "";
let lastWatchVideoPreviewRequestKey = "";
let watchVideoPreviewRequestPending = false;
let lastWatchFrameAccentShiftAt = 0;
let watchFrameAccentPaletteIndex = 0;
globalThis.currentResolvedWatchArtworkDataUrl ??= "";
globalThis.currentWatchArtworkVariantPool ??= [];
let watchPlaybackUiSuppressed = false;
let watchArtworkSlideshowTimer = null;
let watchArtworkSlideshowSignature = "";
let watchArtworkSlideshowFrames = [];
let lastWatchArtworkSlideshowFrame = "";
let watchTypographyPresetKey = "cinema";
let watchTitleFontKey = "titleA";
let watchSubtitleFontKey = "subtitleA";
let watchTitleStrokePresetKey = "halo";
let watchSubtitleShadowPresetKey = "glow";
let watchTitleLayoutSeed = 0;
let watchStyleMenuEl = null;
let watchStyleMenuLongpressTimer = null;
let watchMusicLiveEnergy = 0;
let watchMusicLivePeak = 0;
let watchProgressRotatorTimer = 0;
let watchProgressLastCard = null;
const WATCH_FAVORITE_FONTS_STORAGE_KEY = "cssos.watch.favoriteFonts.v1";
const WATCH_FONT_RANDOM_HISTORY_LIMIT = 18;
let watchFavoriteFonts = new Set(
  (() => {
    try {
      const raw = JSON.parse(localStorage.getItem(WATCH_FAVORITE_FONTS_STORAGE_KEY) || "[]");
      return Array.isArray(raw) ? raw.map((item) => String(item || "").trim()).filter(Boolean) : [];
    } catch (_error) {
      return [];
    }
  })()
);
let watchRecentRandomFonts = [];

const WATCH_TYPOGRAPHY_PRESETS = ["cinema", "dream", "neon"];
const WATCH_TITLE_FONT_RECOMMENDATIONS = {
  title: ["CSSTitleBoldA", "CSSTitleBoldB", "CSSTitleBoldC", "Syne", "Orbitron"],
  subtitle: ["CSSSubtitleA", "CSSSubtitleB", "CSSSubtitleC", "Space Grotesk", "PingFang SC"]
};
const WATCH_TITLE_FONT_OPTIONS = {
  titleA: { label: "Theropods", family: '"CSSTitleBoldA", "Syne", "Orbitron", sans-serif' },
  titleB: { label: "Qualy", family: '"CSSTitleBoldB", "Cormorant Garamond", serif' },
  titleC: { label: "Abington", family: '"CSSTitleBoldC", "Alfa Slab One", sans-serif' },
  syne: { label: "Syne", family: '"Syne", "Space Grotesk", sans-serif' },
  orbitron: { label: "Orbitron", family: '"Orbitron", "CSSTitleBoldA", sans-serif' },
  cormorant: { label: "Cormorant", family: '"Cormorant Garamond", "CSSTitleBoldB", serif' },
  playfair: { label: "Playfair", family: '"Playfair Display", "CSSTitleBoldB", serif' },
  bodoni: { label: "Bodoni", family: '"Bodoni Moda", "CSSTitleBoldB", serif' },
  alfaslab: { label: "Alfa Slab", family: '"Alfa Slab One", "CSSTitleBoldC", sans-serif' },
  hengshan: { label: "HengShan", family: '"HengShanMaoBiCaoShu", "PingFang SC", sans-serif' },
  songti: { label: "Songti", family: '"Songti SC", "Source Han Serif SC", serif' },
  pingfangTitle: { label: "PingFang", family: '"PingFang SC", "Hiragino Sans GB", sans-serif' }
};
const WATCH_SUBTITLE_FONT_OPTIONS = {
  subtitleA: { label: "Acmedia", family: '"CSSSubtitleA", "PingFang SC", "Microsoft YaHei", sans-serif' },
  subtitleB: { label: "Brevard", family: '"CSSSubtitleB", "Cormorant Garamond", serif' },
  subtitleC: { label: "Maves", family: '"CSSSubtitleC", "Space Grotesk", sans-serif' },
  grotesk: { label: "Space Grotesk", family: '"Space Grotesk", "CSSSubtitleC", sans-serif' },
  pingfang: { label: "PingFang", family: '"PingFang SC", "Hiragino Sans GB", sans-serif' },
  rubik: { label: "Rubik", family: '"Rubik", "Space Grotesk", sans-serif' },
  microsoft: { label: "YaHei", family: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  hiragino: { label: "Hiragino", family: '"Hiragino Sans GB", "PingFang SC", sans-serif' },
  cormorantSub: { label: "Cormorant", family: '"Cormorant Garamond", "CSSSubtitleB", serif' }
};
const WATCH_TITLE_STROKE_PRESETS = {
  halo: {
    label: "Halo",
    stroke:
      "0 1px 0 rgba(255,255,255,0.76), 0 -1px 0 rgba(5,9,8,0.96), 2px 0 0 rgba(5,9,8,0.9), -2px 0 0 rgba(255,255,255,0.44)"
  },
  frost: {
    label: "Frost",
    stroke:
      "0 1px 0 rgba(243,248,255,0.72), 0 -1px 0 rgba(12,18,33,0.96), 1.5px 0 0 rgba(12,18,33,0.76), -1.5px 0 0 rgba(255,255,255,0.34)"
  },
  ember: {
    label: "Ember",
    stroke:
      "0 1px 0 rgba(255,245,232,0.72), 0 -1px 0 rgba(26,10,4,0.96), 1.5px 0 0 rgba(80,28,8,0.72), -1.5px 0 0 rgba(255,212,176,0.28)"
  }
};
const WATCH_SUBTITLE_SHADOW_PRESETS = {
  glow: {
    label: "Glow",
    shadow: "0 0 16px rgba(121,230,255,0.34), 0 0 30px rgba(0,245,160,0.18)"
  },
  velvet: {
    label: "Velvet",
    shadow: "0 0 14px rgba(186,132,255,0.28), 0 0 26px rgba(95,140,255,0.18)"
  },
  crystal: {
    label: "Crystal",
    shadow: "0 0 14px rgba(255,223,160,0.22), 0 0 24px rgba(126,214,255,0.18)"
  }
};

const WATCH_FRAME_ACCENT_PALETTES = [
  ["rgba(0, 245, 160, 0.94)", "rgba(11, 247, 255, 0.84)", "rgba(255, 140, 82, 0.78)"],
  ["rgba(119, 255, 214, 0.92)", "rgba(105, 177, 255, 0.84)", "rgba(255, 82, 166, 0.76)"],
  ["rgba(255, 214, 92, 0.9)", "rgba(255, 120, 86, 0.84)", "rgba(0, 245, 160, 0.72)"],
  ["rgba(194, 132, 255, 0.9)", "rgba(73, 220, 255, 0.84)", "rgba(255, 196, 91, 0.76)"]
];

function applyWatchFrameAccentPaletteModule(index = 0) {
  const palette = WATCH_FRAME_ACCENT_PALETTES[((index % WATCH_FRAME_ACCENT_PALETTES.length) + WATCH_FRAME_ACCENT_PALETTES.length) % WATCH_FRAME_ACCENT_PALETTES.length];
  if (watchScreen) {
    watchScreen.style.setProperty("--watch-frame-accent-1", palette[0]);
    watchScreen.style.setProperty("--watch-frame-accent-2", palette[1]);
    watchScreen.style.setProperty("--watch-frame-accent-3", palette[2]);
  }
  if (watchMusicStage) {
    watchMusicStage.style.setProperty("--watch-music-accent-1", palette[0]);
    watchMusicStage.style.setProperty("--watch-music-accent-2", palette[1]);
    watchMusicStage.style.setProperty("--watch-music-accent-3", palette[2]);
    watchMusicStage.style.setProperty("--watch-music-shadow", `color-mix(in srgb, ${palette[0]} 28%, transparent)`);
    watchMusicStage.style.setProperty("--watch-music-secondary-shadow", `color-mix(in srgb, ${palette[1]} 24%, transparent)`);
    const rgb1 = String(palette[0]).match(/\d+(?:\.\d+)?/g)?.slice(0, 3)?.join(", ") || "0, 245, 160";
    const rgb2 = String(palette[1]).match(/\d+(?:\.\d+)?/g)?.slice(0, 3)?.join(", ") || "11, 247, 255";
    watchMusicStage.style.setProperty("--watch-music-accent-1-rgb", rgb1);
    watchMusicStage.style.setProperty("--watch-music-accent-2-rgb", rgb2);
  }
}

function pickWatchTypographyPresetModule(seed = "") {
  const base = String(seed || state.title || "").trim();
  let score = 0;
  for (let index = 0; index < base.length; index += 1) {
    score = (score + base.charCodeAt(index) * (index + 3)) % 9973;
  }
  return WATCH_TYPOGRAPHY_PRESETS[score % WATCH_TYPOGRAPHY_PRESETS.length] || "cinema";
}

function applyWatchTypographyPresetModule(preset = "cinema") {
  watchTypographyPresetKey = WATCH_TYPOGRAPHY_PRESETS.includes(String(preset || "").trim().toLowerCase())
    ? String(preset || "").trim().toLowerCase()
    : "cinema";
  if (watchSubtitle) {
    watchSubtitle.classList.remove("style-cinema", "style-dream", "style-neon");
    watchSubtitle.classList.add(`style-${watchTypographyPresetKey}`);
  }
  if (watchKaraokeLine) {
    watchKaraokeLine.classList.remove("style-cinema", "style-dream", "style-neon");
    watchKaraokeLine.classList.add(`style-${watchTypographyPresetKey}`);
  }
  if (watchStyleShift) {
    watchStyleShift.title = loginCopy(
      `Shuffle title style · title fonts ${WATCH_TITLE_FONT_RECOMMENDATIONS.title.slice(0, 3).join(" / ")} · subtitle fonts ${WATCH_TITLE_FONT_RECOMMENDATIONS.subtitle.slice(0, 3).join(" / ")}`
    );
  }
  applyWatchTypographyControlsModule();
}

function applyWatchTypographyControlsModule() {
  const titleFont =
    WATCH_TITLE_FONT_OPTIONS[watchTitleFontKey]?.family ||
    String(watchTitleFontKey || "").trim() ||
    WATCH_TITLE_FONT_OPTIONS.titleA.family;
  const subtitleFont =
    WATCH_SUBTITLE_FONT_OPTIONS[watchSubtitleFontKey]?.family ||
    String(watchSubtitleFontKey || "").trim() ||
    WATCH_SUBTITLE_FONT_OPTIONS.subtitleA.family;
  const titleStroke =
    WATCH_TITLE_STROKE_PRESETS[watchTitleStrokePresetKey]?.stroke ||
    WATCH_TITLE_STROKE_PRESETS.halo.stroke;
  const subtitleShadow =
    WATCH_SUBTITLE_SHADOW_PRESETS[watchSubtitleShadowPresetKey]?.shadow ||
    WATCH_SUBTITLE_SHADOW_PRESETS.glow.shadow;
  [watchScreen, watchMusicStage, watchSubtitle, watchKaraokeLine].forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.setProperty("--watch-title-font-family", titleFont);
    node.style.setProperty("--watch-subtitle-font-family", subtitleFont);
    node.style.setProperty("--watch-title-stroke-shadow", titleStroke);
    node.style.setProperty("--watch-subtitle-extra-shadow", subtitleShadow);
  });
}

function buildWatchSelectableFontOptionsModule() {
  const seedList = [
    ...Object.entries(WATCH_TITLE_FONT_OPTIONS || {}).map(([key, option]) => ({
      key,
      label: String(option?.label || key || "").trim(),
      family: String(option?.family || "").trim(),
    })),
    ...Object.entries(WATCH_SUBTITLE_FONT_OPTIONS || {}).map(([key, option]) => ({
      key,
      label: String(option?.label || key || "").trim(),
      family: String(option?.family || "").trim(),
    })),
  ];
  const uploadedFamilies = (Array.isArray(globalThis.CSSOS_WATCH_FONT_MANIFEST)
    ? globalThis.CSSOS_WATCH_FONT_MANIFEST
    : []
  ).map((entry) => ({
    key: String(entry?.family || "").trim(),
    label: String(entry?.family || "").trim(),
    family: String(entry?.family || "").trim(),
  }));
  const seen = new Set();
  return [...seedList, ...uploadedFamilies].filter((entry) => {
    const family = String(entry?.family || "").trim();
    if (!family || seen.has(family)) return false;
    seen.add(family);
    return true;
  });
}

function persistWatchFavoriteFontsModule() {
  try {
    localStorage.setItem(
      WATCH_FAVORITE_FONTS_STORAGE_KEY,
      JSON.stringify(Array.from(watchFavoriteFonts).filter(Boolean))
    );
  } catch (_error) {}
}

function classifyWatchFontGroupModule(entry) {
  const src = String(entry?.src || "").trim().toLowerCase();
  const family = String(entry?.family || "").trim();
  if (/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(family)) return "cjk";
  if (src.startsWith("fonts/") || src.startsWith("fonts_cn2/")) return "cjk";
  return "latin";
}

function buildWatchFontCatalogModule() {
  const manifestMap = new Map(
    (Array.isArray(globalThis.CSSOS_WATCH_FONT_MANIFEST) ? globalThis.CSSOS_WATCH_FONT_MANIFEST : []).map((entry) => [
      String(entry?.family || "").trim(),
      entry || {}
    ])
  );
  return buildWatchSelectableFontOptionsModule().map((entry) => {
    const family = String(entry?.family || "").trim();
    const manifest = manifestMap.get(family) || {};
    return {
      ...entry,
      family,
      src: String(manifest?.src || "").trim(),
      group: classifyWatchFontGroupModule({ family, src: String(manifest?.src || "").trim() }),
      favorite: watchFavoriteFonts.has(family),
    };
  });
}

// CSSOS_PHASE2_FANCY_FONT_POOL 20260430 #202 — Jing
// "标题用 fancy font 池（更酷的字体随机）— 这些字体太酷了."
//
// Curated allow-list of distinctive display / cinematic / signature
// fonts pulled from the 386-font manifest (`app.watch-font-manifest.js`).
// Generic-looking fallbacks (Acmedia, Maves, Brevard etc. used as
// subtitle defaults) are intentionally absent — they don't have the
// "cool" character we want for randomized titles.
//
// The picker biases toward this set: ~85% chance the random draw lands
// inside the fancy pool, 15% slips through to the full catalog so a
// surprise system-y choice still happens occasionally for variety.
//
// Group A — Latin display / cinematic / poster
// Group B — Latin script / signature / calligraphy
// Group C — CJK display (动感 / 超字社 / 青空黑体)
const WATCH_FANCY_FONT_ALLOWLIST = new Set([
  // ─── Latin display ────────────────────────────────────────────────
  "AQUARIUM", "Andromeda",
  "Backrush", "Beauty",
  "BoldnessRace", "Brogetta",
  "CSSTitleBoldA", "CSSTitleBoldB", "CSSTitleBoldC",
  "Cuningham",
  "DELMANOMORELLI",
  "Display-Magazine-2", "Display-Magazine-3", "Draco",
  "Fuel Injection",
  "GoodHood", "GreenHome",
  "HFWhale", "HiJack", "Honeybears", "Hypeblox",
  "IronHorse",
  "Jacob and son",
  "LocalBreweryTwo",
  "Marchell", "Meghatone", "Munich",
  "MySunshine",
  "Nature Green", "Northline",
  "Orbitron",
  "Polonium", "Polonium Bold",
  "Qualitative", "Qualy Bold",
  "Rainbow", "Realistic", "Rough Owl",
  "Sinethar", "Starshy", "Suffer",
  "Undertow", "Undertow Slab",
  "VILLADICANCE", "Ventus",
  "Wilson", "Winstonia", "Winter",
  // ─── Latin script / signature ────────────────────────────────────
  "AidianSignatureTi", "Alison", "Allianty",
  "Belianty", "Belinda", "Bellamy", "Berthessa",
  "CastilloSignature", "Cathena",
  "DilanWhemsy",
  "Hadnich", "HamsleyScript",
  "Janelotus",
  "KitaharaScript",
  "Lovelygirly",
  "MonsieurLaDoulaise", "MrsAlexandra",
  "YouraScript",
  // ─── Classic Latin (existing curated set, stays first-class) ─────
  "Syne", "Cormorant Garamond", "Playfair Display", "Bodoni Moda",
  "Alfa Slab One",
  // ─── CJK 中文表现型字体 ──────────────────────────────────────────
  "HengShanMaoBiCaoShu",
]);
globalThis.WATCH_FANCY_FONT_ALLOWLIST = WATCH_FANCY_FONT_ALLOWLIST;

function pickWatchRandomFontModule(fontEntries = [], fallback = "") {
  const list = Array.isArray(fontEntries) ? fontEntries.filter((entry) => String(entry?.family || "").trim()) : [];
  if (!list.length) return fallback;
  const recent = new Set(watchRecentRandomFonts);
  // CSSOS_PHASE2_FANCY_FONT_POOL 20260501 #248 — Jing
  // "请同时使用旧的字体池和95款 fancy 字体池."
  // Build a UNION pool: every entry that's in the catalogue AND in the
  // fancy allowlist appears TWICE in the weighted draw — i.e. fancy
  // entries get ~3-5x the weight of generic entries (depending on how
  // many fancy fonts the catalogue actually contains). The old curated
  // 12 title + 9 subtitle entries stay in the catalogue alongside the
  // 95 fancy ones, so neither pool dominates.
  const fancyEntries = list.filter(
    (e) => WATCH_FANCY_FONT_ALLOWLIST.has(String(e.family || "").trim())
  );
  // Weight = catalogue + fancy doubled (every fancy entry has 2 tickets
  // in the lottery; non-fancy keep 1 each).
  const weighted = list.concat(fancyEntries, fancyEntries);
  const sourceList = weighted;
  const pool = sourceList.filter((entry) => !recent.has(String(entry.family || "").trim()));
  const targetPool = pool.length ? pool : sourceList;
  const chosen = targetPool[Math.floor(Math.random() * targetPool.length)] || targetPool[0];
  const family = String(chosen?.family || fallback || "").trim();
  if (!family) return fallback;
  watchRecentRandomFonts.push(family);
  if (watchRecentRandomFonts.length > WATCH_FONT_RANDOM_HISTORY_LIMIT) {
    watchRecentRandomFonts = watchRecentRandomFonts.slice(-WATCH_FONT_RANDOM_HISTORY_LIMIT);
  }
  return family;
}

function cycleWatchTypographyPresetModule() {
  const randomPick = (items = [], fallback = "") => {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return fallback;
    return list[Math.floor(Math.random() * list.length)] || fallback;
  };
  const nextPreset = randomPick(WATCH_TYPOGRAPHY_PRESETS, "cinema");
  const selectableFonts = buildWatchFontCatalogModule();
  // Locale-aware pool: CN UI → pick from CJK fonts, EN UI → pick from Latin fonts.
  // Title and subtitle both sample from the same locale-scoped pool so they're
  // visually consistent. If filter result is empty (e.g. no CJK fonts available),
  // fall back to the full catalogue so we never land on an empty pool.
  const localeGroup = (String(globalThis.currentLocale || "").toLowerCase() === "zh") ? "cjk" : "latin";
  const poolByLocale = selectableFonts.filter((entry) => String(entry?.group || "").toLowerCase() === localeGroup);
  const fontPool = poolByLocale.length ? poolByLocale : selectableFonts;
  watchTitleFontKey = pickWatchRandomFontModule(fontPool, watchTitleFontKey);
  watchSubtitleFontKey = pickWatchRandomFontModule(fontPool, watchSubtitleFontKey);
  watchTitleStrokePresetKey = randomPick(Object.keys(WATCH_TITLE_STROKE_PRESETS), watchTitleStrokePresetKey);
  watchSubtitleShadowPresetKey = randomPick(Object.keys(WATCH_SUBTITLE_SHADOW_PRESETS), watchSubtitleShadowPresetKey);
  watchTitleLayoutSeed = Math.floor(Math.random() * 1_000_000);
  applyWatchTypographyPresetModule(nextPreset);
  renderWatchKaraokeOverlayModule();
  syncWatchPlaceholderFromCurrentState();
  // CSSOS_PHASE2_NO_STYLE_TOAST 20260427 #165 — Jing
  // "请关闭随机字母的提示，有点烦他。Title and subtitle style · neon
  //  为什么？因为我根本就没有打开Watch MV面板，他还是总是提示。"
  // Style cycle is a silent action — typography updates happen on screen,
  // a toast is redundant and noisy when the panel isn't even visible.
}

function hideWatchStyleMenuModule() {
  if (watchStyleMenuEl instanceof HTMLElement) {
    watchStyleMenuEl.hidden = true;
    watchStyleMenuEl.innerHTML = "";
  }
}

function ensureWatchStyleMenuModule() {
  if (watchStyleMenuEl instanceof HTMLElement) return watchStyleMenuEl;
  watchStyleMenuEl = document.createElement("div");
  watchStyleMenuEl.hidden = true;
  watchStyleMenuEl.className = "watch-style-menu";
  document.body.appendChild(watchStyleMenuEl);
  ["pointerdown", "mousedown", "click", "wheel", "touchstart", "touchmove"].forEach((eventName) => {
    watchStyleMenuEl?.addEventListener(
      eventName,
      (event) => {
        event.stopPropagation();
      },
      eventName === "wheel" || eventName === "touchmove" ? { passive: false } : undefined
    );
  });
  document.addEventListener("click", (event) => {
    if (watchStyleMenuEl?.contains(event.target)) return;
    hideWatchStyleMenuModule();
  }, { passive: true });
  window.addEventListener("blur", () => hideWatchStyleMenuModule());
  return watchStyleMenuEl;
}

function openWatchStyleMenuModule(anchorX, anchorY, mode = "all") {
  const menu = ensureWatchStyleMenuModule();
  const selectableFonts = buildWatchFontCatalogModule();
  const titleFontPreviewText = loginCopy("Watch Title");
  const subtitleFontPreviewText = loginCopy("The subtitle breathes with the frame.");
  const buildFontPickerMarkup = (entries = [], activeValue = "", pickerType = "title") => {
    const groups = [
      { key: "favorites", title: loginCopy("Favorites"), items: entries.filter((entry) => entry.favorite) },
      { key: "cjk", title: loginCopy("Chinese / CJK"), items: entries.filter((entry) => entry.group === "cjk") },
      { key: "latin", title: loginCopy("English / Latin"), items: entries.filter((entry) => entry.group === "latin") },
    ].filter((group) => group.items.length);
    return `
      <div class="watch-font-picker" data-font-picker="${pickerType}">
        <input class="watch-font-picker-search" type="search" placeholder="${escapeHtml(loginCopy("Search fonts"))}" aria-label="${escapeHtml(loginCopy("Search fonts"))}">
        <div class="watch-font-picker-groups">
          ${groups
            .map(
              (group) => `
                <section class="watch-font-picker-group" data-font-group="${escapeHtml(group.key)}">
                  <div class="watch-font-picker-group-title">${escapeHtml(group.title)}</div>
                  <div class="watch-font-picker-list">
                    ${group.items
                      .map((item) => {
                        const family = String(item.family || "").trim();
                        const previewText = pickerType === "title" ? titleFontPreviewText : subtitleFontPreviewText;
                        return `
                          <button class="watch-font-picker-item${family === activeValue ? " is-active" : ""}" type="button" data-font-value="${escapeHtml(family)}" data-font-label="${escapeHtml(item.label)}">
                            <span class="watch-font-picker-favorite${item.favorite ? " is-active" : ""}" data-font-favorite="${escapeHtml(family)}" role="button" tabindex="0" aria-label="${escapeHtml(loginCopy("Toggle favorite"))}">★</span>
                            <span class="watch-font-picker-name">${escapeHtml(item.label)}</span>
                            <span class="watch-font-picker-preview" style="font-family:${escapeHtml(family)};">${escapeHtml(previewText)}</span>
                          </button>
                        `;
                      })
                      .join("")}
                  </div>
                </section>`
            )
            .join("")}
        </div>
      </div>
    `;
  };
  let committedTitleFont = watchTitleFontKey;
  let committedSubtitleFont = watchSubtitleFontKey;
  const previewFont = (pickerType, family, committed = false) => {
    const safeFamily = String(family || "").trim();
    if (!safeFamily) return;
    if (pickerType === "title") {
      watchTitleFontKey = safeFamily;
      if (committed) committedTitleFont = safeFamily;
    } else {
      watchSubtitleFontKey = safeFamily;
      if (committed) committedSubtitleFont = safeFamily;
    }
    applyWatchTypographyControlsModule();
  };
  const restoreCommittedPreview = () => {
    watchTitleFontKey = committedTitleFont;
    watchSubtitleFontKey = committedSubtitleFont;
    applyWatchTypographyControlsModule();
  };
  const allGroups = [
    {
      title: loginCopy("Title style"),
      items: WATCH_TYPOGRAPHY_PRESETS.map((preset) => ({
        label: preset,
        active: preset === watchTypographyPresetKey,
        run: () => {
          applyWatchTypographyPresetModule(preset);
          renderWatchKaraokeOverlayModule();
          syncWatchPlaceholderFromCurrentState();
        }
      }))
    },
    {
      title: loginCopy("Title font"),
      picker: "title",
      items: selectableFonts.map((option) => ({
        label: option.label,
        value: option.family,
        active: option.family === watchTitleFontKey,
        run: () => {
          watchTitleFontKey = option.family;
          applyWatchTypographyControlsModule();
        }
      }))
    },
    {
      title: loginCopy("Subtitle font"),
      picker: "subtitle",
      items: selectableFonts.map((option) => ({
        label: option.label,
        value: option.family,
        active: option.family === watchSubtitleFontKey,
        run: () => {
          watchSubtitleFontKey = option.family;
          applyWatchTypographyControlsModule();
        }
      }))
    },
    {
      title: loginCopy("Title stroke"),
      items: Object.entries(WATCH_TITLE_STROKE_PRESETS).map(([key, option]) => ({
        label: option.label,
        active: key === watchTitleStrokePresetKey,
        run: () => {
          watchTitleStrokePresetKey = key;
          applyWatchTypographyControlsModule();
        }
      }))
    },
    {
      title: loginCopy("Subtitle shadow"),
      items: Object.entries(WATCH_SUBTITLE_SHADOW_PRESETS).map(([key, option]) => ({
        label: option.label,
        active: key === watchSubtitleShadowPresetKey,
        run: () => {
          watchSubtitleShadowPresetKey = key;
          applyWatchTypographyControlsModule();
        }
      }))
    }
  ];
  const groups = String(mode || "all").trim().toLowerCase() === "subtitle"
    ? allGroups.filter((group) =>
        group.title === loginCopy("Subtitle font") ||
        group.title === loginCopy("Subtitle shadow")
      )
    : allGroups;
  menu.innerHTML = groups.map((group) => `
    <div class="watch-style-menu-group">
      <div class="watch-style-menu-title">${escapeHtml(group.title)}</div>
      ${group.picker
        ? buildFontPickerMarkup(group.items, group.picker === "title" ? watchTitleFontKey : watchSubtitleFontKey, group.picker)
        : group.select
        ? `<select class="watch-style-menu-select">${group.items.map((item) => `<option value="${escapeHtml(String(item.value || item.label || "").trim())}"${item.active ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select>`
        : group.items.map((item) => `<button class="watch-style-menu-item${item.active ? " is-active" : ""}" type="button">${escapeHtml(item.label)}</button>`).join("")}
    </div>
  `).join("");
  const bindFontPicker = (pickerType, onPick) => {
    const picker = menu.querySelector(`.watch-font-picker[data-font-picker="${pickerType}"]`);
    if (!(picker instanceof HTMLElement)) return;
    const search = picker.querySelector(".watch-font-picker-search");
    const items = Array.from(picker.querySelectorAll(".watch-font-picker-item"));
    const applyFilter = () => {
      const query = String(search?.value || "").trim().toLowerCase();
      items.forEach((item) => {
        const label = String(item.getAttribute("data-font-label") || "").trim().toLowerCase();
        const family = String(item.getAttribute("data-font-value") || "").trim().toLowerCase();
        const match = !query || label.includes(query) || family.includes(query);
        item.toggleAttribute("hidden", !match);
      });
      Array.from(picker.querySelectorAll(".watch-font-picker-group")).forEach((groupEl) => {
        const anyVisible = Array.from(groupEl.querySelectorAll(".watch-font-picker-item")).some((item) => !item.hasAttribute("hidden"));
        groupEl.toggleAttribute("hidden", !anyVisible);
      });
    };
    search?.addEventListener("input", applyFilter);
    search?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown") return;
      const firstVisible = items.find((item) => !item.hasAttribute("hidden"));
      if (!(firstVisible instanceof HTMLElement)) return;
      event.preventDefault();
      firstVisible.focus();
    });
    items.forEach((item) => {
      const previewCurrentItem = () => {
        const family = String(item.getAttribute("data-font-value") || "").trim();
        if (!family) return;
        previewFont(pickerType, family, false);
      };
      item.addEventListener("click", (event) => {
        const favoriteToggle = event.target?.closest?.("[data-font-favorite]");
        if (favoriteToggle) return;
        event.preventDefault();
        event.stopPropagation();
        const family = String(item.getAttribute("data-font-value") || "").trim();
        if (!family) return;
        onPick(family);
        openWatchStyleMenuModule(anchorX, anchorY, mode);
      });
      item.addEventListener("mouseenter", previewCurrentItem);
      item.addEventListener("focus", previewCurrentItem);
      item.addEventListener("mouseleave", restoreCommittedPreview);
      item.addEventListener("blur", restoreCommittedPreview);
      item.addEventListener("keydown", (event) => {
        const visibleItems = items.filter((candidate) => !candidate.hasAttribute("hidden"));
        const currentIndex = visibleItems.indexOf(item);
        if (event.key === "ArrowDown") {
          const next = visibleItems[Math.min(visibleItems.length - 1, currentIndex + 1)] || null;
          if (next instanceof HTMLElement) {
            event.preventDefault();
            next.focus();
          }
        } else if (event.key === "ArrowUp") {
          if (currentIndex <= 0) {
            if (search instanceof HTMLElement) {
              event.preventDefault();
              search.focus();
            }
            return;
          }
          const prev = visibleItems[Math.max(0, currentIndex - 1)] || null;
          if (prev instanceof HTMLElement) {
            event.preventDefault();
            prev.focus();
          }
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          item.click();
        }
      });
    });
    Array.from(picker.querySelectorAll("[data-font-favorite]")).forEach((toggle) => {
      const handleToggle = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const family = String(toggle.getAttribute("data-font-favorite") || "").trim();
        if (!family) return;
        if (watchFavoriteFonts.has(family)) watchFavoriteFonts.delete(family);
        else watchFavoriteFonts.add(family);
        persistWatchFavoriteFontsModule();
        openWatchStyleMenuModule(anchorX, anchorY, mode);
      };
      toggle.addEventListener("click", handleToggle);
      toggle.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") handleToggle(event);
      });
    });
    applyFilter();
  };
  bindFontPicker("title", (family) => {
    watchTitleFontKey = family;
    applyWatchTypographyControlsModule();
  });
  bindFontPicker("subtitle", (family) => {
    watchSubtitleFontKey = family;
    applyWatchTypographyControlsModule();
  });
  const selectEls = Array.from(menu.querySelectorAll(".watch-style-menu-select"));
  let selectOffset = 0;
  let buttonOffset = 0;
  groups.forEach((group) => {
    if (group.select) {
      const select = selectEls[selectOffset];
      selectOffset += 1;
      if (select instanceof HTMLSelectElement) {
        select.addEventListener("change", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const value = String(event.currentTarget?.value || "").trim();
          const item = group.items.find((entry) => String(entry.value || entry.label || "").trim() === value);
          item?.run?.();
        });
      }
      return;
    }
    group.items.forEach((item) => {
      const button = menu.querySelectorAll(".watch-style-menu-item")[buttonOffset];
      if (button instanceof HTMLButtonElement) {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          item.run();
          hideWatchStyleMenuModule();
        });
      }
      buttonOffset += 1;
    });
  });
  menu.hidden = false;
  menu.style.left = `${Math.max(12, Math.min(window.innerWidth - 260, Number(anchorX || 0)))}px`;
  menu.style.top = `${Math.max(12, Math.min(window.innerHeight - 220, Number(anchorY || 0)))}px`;
  const frameHeight = Math.max(220, Math.round(Number(watchScreen?.getBoundingClientRect?.().height || 0) - 24));
  menu.style.maxHeight = `${Math.min(frameHeight, window.innerHeight - 24)}px`;
}

function clearWatchArtworkSlideshowModule() {
  if (watchArtworkSlideshowTimer) {
    window.clearInterval(watchArtworkSlideshowTimer);
    watchArtworkSlideshowTimer = null;
  }
  lastWatchArtworkSlideshowFrame = "";
}

function setWatchArtworkSlideshowFramesModule(frames = [], signature = "") {
  const uniqueFrames = [...new Set(
    (Array.isArray(frames) ? frames : [])
      .map((item) => String(item || "").trim())
      .filter((item) => item && !item.startsWith("data:image/svg+xml"))
  )];
  watchArtworkSlideshowFrames = uniqueFrames;
  watchArtworkSlideshowSignature = String(signature || "").trim();
  if (!watchArtworkSlideshowFrames.includes(lastWatchArtworkSlideshowFrame)) {
    lastWatchArtworkSlideshowFrame = "";
  }
}

function maybeRenderWatchArtworkSlideshowFrameModule(preferFirst) {
  if (!watchArtworkSlideshowFrames.length) return false;
  // CSSOS_WAVE_329 — 进入时第一帧用【确定的头部封面】(resolved 主封面), 而不是随机抽,
  // 避免进场瞬间随机跳图"闪一下". 之后的轮播 tick 才随机.
  let next;
  if (preferFirst) {
    next = watchArtworkSlideshowFrames[0] || "";
  } else {
    let candidates = watchArtworkSlideshowFrames;
    if (watchArtworkSlideshowFrames.length > 1 && lastWatchArtworkSlideshowFrame) {
      candidates = watchArtworkSlideshowFrames.filter((item) => item !== lastWatchArtworkSlideshowFrame);
    }
    next = candidates[Math.floor(Math.random() * candidates.length)] || watchArtworkSlideshowFrames[0] || "";
  }
  if (!next) return false;
  lastWatchArtworkSlideshowFrame = next;
  const motions = ["motion-float", "motion-breathe"];
  const motion = motions[Math.floor(Math.random() * motions.length)] || "motion-float";
  watchSvg?.classList.remove(...motions);
  watchScreenBackdrop?.classList.remove(...motions);
  watchSvg?.classList.remove("is-transitioning");
  watchScreenBackdrop?.classList.remove("is-transitioning");
  void watchSvg?.offsetWidth;
  watchSvg?.classList.add(motion);
  watchScreenBackdrop?.classList.add(motion);
  watchSvg?.classList.add("is-transitioning");
  watchScreenBackdrop?.classList.add("is-transitioning");
  showWatchFramePlaceholderModule(next);
  syncWatchMusicArtworkModule();
  return true;
}

async function primeWatchArtworkSlideshowModule(title, subtitle, lines = []) {
  const safeTitle = String(title || state.title || watchBrandTitleModule()).trim();
  const safeSubtitle = String(subtitle || "").trim();
  const safeLines = Array.isArray(lines) ? lines.filter(Boolean).slice(0, 8) : [];
  const signature = JSON.stringify([safeTitle, safeSubtitle, safeLines.slice(0, 4)]);
  if (signature && signature === watchArtworkSlideshowSignature && watchArtworkSlideshowFrames.length) {
    if (!watchArtworkSlideshowTimer) {
      maybeRenderWatchArtworkSlideshowFrameModule(true); // 进场首帧确定不随机
      watchArtworkSlideshowTimer = window.setInterval(() => {
        const generationBusy = !!(
          globalThis.lyricsSeedRequestState?.pending ||
          globalThis.watchPipelineLaunchPending ||
          String(activePipelineRunId || "").trim() ||
          String(pendingFinalAudioRunId || "").trim() ||
          String(currentWatchAudioRunId || "").trim() ||
          globalThis.isCreationBusyModule?.()
        );
        if (!generationBusy || watchPlaybackUiSuppressed) {
          clearWatchArtworkSlideshowModule();
          return;
        }
        maybeRenderWatchArtworkSlideshowFrameModule();
      }, WATCH_ARTWORK_SLIDESHOW_MS);
    }
    return;
  }
  const localFrames = [
    String(globalThis.currentResolvedWatchArtworkDataUrl || "").trim(),
    String(globalThis.currentPreviewFrameDataUrl || "").trim(),
    String(foryouThumbImage?.src || "").trim(),
    ...(Array.isArray(globalThis.currentWatchArtworkVariantPool) ? globalThis.currentWatchArtworkVariantPool : []),
    ...(Array.isArray(globalThis.currentPreviewFrameSequence) ? globalThis.currentPreviewFrameSequence : []),
    ...(getCachedWatchFrameSequenceModule?.() || [])
  ].filter(Boolean);
  setWatchArtworkSlideshowFramesModule(localFrames, signature);
  if (watchArtworkSlideshowFrames.length < 5 && globalThis.requestThumbnailVariantPool) {
    const pool = await globalThis.requestThumbnailVariantPool(safeTitle, safeSubtitle, safeLines, {
      count: 5,
    }).catch(() => []);
    if (Array.isArray(pool) && pool.length) {
      globalThis.currentWatchArtworkVariantPool = [...new Set(pool.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 5);
      setWatchArtworkSlideshowFramesModule(
        [...watchArtworkSlideshowFrames, ...globalThis.currentWatchArtworkVariantPool],
        signature
      );
    }
  }
  if (!watchArtworkSlideshowFrames.length) return;
  maybeRenderWatchArtworkSlideshowFrameModule(true); // 进场首帧确定不随机
  if (watchArtworkSlideshowTimer || watchArtworkSlideshowSignature !== signature) {
    clearWatchArtworkSlideshowModule();
  }
  watchArtworkSlideshowSignature = signature;
  watchArtworkSlideshowTimer = window.setInterval(() => {
    const generationBusy = !!(
      globalThis.lyricsSeedRequestState?.pending ||
      globalThis.watchPipelineLaunchPending ||
      String(activePipelineRunId || "").trim() ||
      String(pendingFinalAudioRunId || "").trim() ||
      String(currentWatchAudioRunId || "").trim() ||
      globalThis.isCreationBusyModule?.()
    );
    if (!generationBusy || watchPlaybackUiSuppressed) {
      clearWatchArtworkSlideshowModule();
      return;
    }
    maybeRenderWatchArtworkSlideshowFrameModule();
  }, WATCH_ARTWORK_SLIDESHOW_MS);
}

function isWatchLyricsReadyModule() {
  // CSSOS_WAVE_281 20260521 — Jing: this runs EVERY rAF frame via
  // readProgress, from very early in boot — before `state` (app.js) or
  // `compactLyricLines` (app.lyric-utils.js) may be initialized, and on
  // stale-cached clients where load order differs. A bare reference then
  // threw a ReferenceError / TDZ EVERY FRAME (~10K hits in 2 days, the
  // top crash after the W220A TDZ hoist). Wrap in a boot-race guard:
  // bail to "not ready" instead of throwing on a cold frame.
  try {
    const _compact = typeof compactLyricLines === "function"
      ? compactLyricLines
      : (globalThis.compactLyricLines || null);
    if (!_compact) return false;
    const directLines = _compact(Array.isArray(state.lines) ? state.lines : []).filter(Boolean);
    if (directLines.length >= 2) return true;
    const editorText = String(watchLyricsEditor?.value || "").trim();
    const seedTitle = String(state.songSeed?.title || state.title || "").trim();
    const seedLyrics = String(state.songSeed?.lyrics || "").trim();
    const displayText = String(lyricsEl?.textContent || "").trim();
    const editorReady =
      globalThis.hasCanonicalLyricsBodyLinesModule?.(seedTitle, editorText, 2) ??
      false;
    const seedReady =
      globalThis.hasCanonicalLyricsBodyLinesModule?.(seedTitle, seedLyrics, 2) ??
      false;
    const displayReady = extractDisplayLyricLinesModule(displayText).length >= 2;
    return editorReady || seedReady || displayReady;
  } catch (_bootRace) {
    return false; // state / helpers not initialized on this frame yet
  }
}

function getWatchProgressActionLabelModule(stageKey = "play") {
  switch (String(stageKey || "").trim()) {
    case "lyrics":
      return t("watch.action.generateLyrics");
    case "music":
      return t("watch.action.generateMusic");
    case "video":
      return t("watch.action.generateVideo");
    case "kara":
      return t("watch.action.generateMv");
    default:
      return t("watch.action.resume");
  }
}

function getCurrentWatchActionLabelModule() {
  const nextNeededStage = getNextWatchGenerationGapModule();
  if (nextNeededStage && nextNeededStage !== "play") {
    return getWatchProgressActionLabelModule(
      resolveWatchRecoveryStageModule(nextNeededStage)
    );
  }
  const activeStage = getActiveWatchProgressCardModule()?.key || "";
  if (activeStage) return getWatchProgressActionLabelModule(resolveWatchRecoveryStageModule(activeStage));
  const playing = !!(
    (watchVideo &&
      !watchVideo.paused &&
      !watchVideo.ended &&
      String(watchVideo.currentSrc || watchVideo.src || "").trim()) ||
    (watchAudioPreview &&
      !watchAudioPreview.paused &&
      !watchAudioPreview.ended &&
      String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim())
  );
  if (!playing && nextNeededStage && nextNeededStage !== "play") {
    return getWatchProgressActionLabelModule(nextNeededStage);
  }
  return playing ? t("watch.action.pause") : t("watch.action.play");
}

function watchBrandTitleModule() {
  const outlineTitle =
    globalThis.extractTitleFromVideoOutlineModule?.(
      watchOutlineEditor?.value ||
      videoOutlineInput?.value ||
      state.songSeed?.videoOutline ||
      state.songSeed?.video_outline ||
      ""
    ) || "";
  const explicitTitle = String(state.title || state.songSeed?.title || "").trim();
  return explicitTitle || outlineTitle || loginCopy("CSS MV");
}

function watchSubtitleLabelModule(kind = "preview") {
  const normalized = String(kind || "preview").trim().toLowerCase();
  switch (normalized) {
    case "demo":
      return t("watch.subtitle.demo");
    case "ready":
      return t("watch.subtitle.ready");
    case "failed":
      return t("watch.subtitle.failed");
    case "internal":
      return t("watch.subtitle.preview");
    case "preview":
    default:
      return t("watch.subtitle.preview");
  }
}

function watchToastCopyModule(kind = "previewShort") {
  const normalized = String(kind || "previewShort").trim().toLowerCase();
  switch (normalized) {
    case "autoplayBlocked":
      return t("watch.toast.autoplayBlocked");
    case "playbackResumed":
      return t("watch.toast.playbackResumed");
    case "previewShort":
      return t("watch.toast.previewShort");
    case "videoOffline":
      return t("watch.toast.videoOffline");
    case "videoPending":
      return t("watch.toast.videoPending");
    default:
      return String(kind || "").trim();
  }
}

function getWatchLyricsSeedSubtitleModule() {
  return (
    globalThis.summarizeWatchLyricsSeedStatusModule?.() ||
    t("watch.subtitle.waitingLyricsSeed")
  );
}

function syncWatchSubtitleForWaitingMediaModule() {
  if (!watchSubtitle) return;
  if (watchPlaybackUiSuppressed) {
    safeSetWatchSubtitleModule("");
    return;
  }
  const activeStage = getActiveWatchProgressCardModule()?.key || "";
  if (globalThis.lyricsSeedRequestState?.pending) {
    safeSetWatchSubtitleModule(getWatchLyricsSeedSubtitleModule());
    return;
  }
  const currentLyricsStatus = String(
    globalThis.summarizeWatchLyricsSeedStatusModule?.() || ""
  ).trim();
  if (currentLyricsStatus && !isWatchLyricsReadyModule()) {
    safeSetWatchSubtitleModule(currentLyricsStatus);
    return;
  }
  if (activeStage === "music") {
    safeSetWatchSubtitleModule(loginCopy("KaraOKe MV · Composing music now"));
    return;
  }
  if (activeStage === "video") {
    safeSetWatchSubtitleModule(loginCopy("KaraOKe MV · Rendering video now"));
    return;
  }
  if (activeStage === "kara") {
    safeSetWatchSubtitleModule(loginCopy("KaraOKe MV · Rendering subtitle MV now"));
    return;
  }
  safeSetWatchSubtitleModule(hasWatchArtworkReadyModule()
    ? loginCopy("KaraOKe MV · Writing the first line now")
    : loginCopy("KaraOKe MV · Painting the cover now"));
}

function setWatchPlaybackUiSuppressedModule(suppressed) {
  watchPlaybackUiSuppressed = suppressed === true;
  watchScreen?.classList.toggle("is-playback-clean", watchPlaybackUiSuppressed);
  if (watchPlaybackUiSuppressed) {
    clearWatchArtworkSlideshowModule();
  }
  if (watchSubtitle) {
    if (watchPlaybackUiSuppressed) {
      safeSetWatchSubtitleModule("");
    } else {
      syncWatchSubtitleForWaitingMediaModule();
    }
  }
  if (watchFrameProgress) {
    watchFrameProgress.hidden = watchPlaybackUiSuppressed ? true : watchFrameProgress.hidden;
  }
}

function hasWatchScriptReadyModule() {
  const seed = state.songSeed && typeof state.songSeed === "object" ? state.songSeed : {};
  const scriptText = String(
    watchScriptEditor?.value ||
      videoOutlineInput?.value ||
      seed.videoOutline ||
      seed.video_outline ||
      ""
  ).trim();
  const prompts = Array.isArray(seed.sectionPrompts)
    ? seed.sectionPrompts
    : Array.isArray(seed.section_prompts)
      ? seed.section_prompts
      : [];
  return scriptText.length > 12 || prompts.length > 0;
}

function hasBlockingWatchSeedModule() {
  return !!(globalThis.hasUsableSongSeedSnapshotModule?.(state.songSeed) ?? false);
}

function hasWatchArtworkReadyModule() {
  const persistedCover = String(resolveWorkCoverImage(currentWatchPreviewWork || {}) || "").trim();
  const currentArtwork = String(
    globalThis.currentResolvedWatchArtworkDataUrl ||
      globalThis.currentPreviewFrameDataUrl ||
      foryouThumbImage?.src ||
      watchSvg?.src ||
      ""
  ).trim();
  return !!(persistedCover || currentArtwork);
}

function canAdvanceWatchGenerationStageModule(stageKey = "lyrics") {
  const normalized = String(stageKey || "lyrics").trim().toLowerCase();
  if (!normalized || normalized === "lyrics") {
    return { ok: true, reason: "" };
  }
  const lyricsReady = isWatchLyricsReadyModule();
  if (normalized === "music") {
    return lyricsReady
      ? { ok: true, reason: "" }
      : {
          ok: false,
          reason: loginCopy(
            "Recovering lyrics first before composing."
          )
        };
  }
  if (lyricsReady && hasWatchScriptReadyModule()) {
    return { ok: true, reason: "" };
  }
  return {
    ok: false,
    reason: loginCopy(
      "Recovering upstream stages automatically before continuing."
    )
  };
}

function resolveWatchRecoveryStageModule(stageKey = "lyrics") {
  const normalized = String(stageKey || "").trim().toLowerCase() || "lyrics";
  const lyricsReady = isWatchLyricsReadyModule();
  const scriptReady = hasWatchScriptReadyModule();
  const musicReady =
    Number(engineProgressState.music || 0) >= 100 &&
    hasPlayableCurrentWatchAudioModule();
  const videoReady =
    Number(engineProgressState.video || 0) >= 100 &&
    hasPlayableCurrentWatchVideoModule();
  if (!lyricsReady) return "lyrics";
  if (normalized === "lyrics") return "lyrics";
  if (normalized === "music") return "music";
  if (!scriptReady && ["video", "kara", "play"].includes(normalized)) return "lyrics";
  if (!musicReady && ["music", "video", "kara", "play"].includes(normalized)) return "music";
  if (!videoReady && ["video", "kara", "play"].includes(normalized)) return "video";
  if (normalized === "video") return "video";
  if (Number(engineProgressState.kara || 0) < 100 && ["kara", "play"].includes(normalized)) return "kara";
  return normalized;
}

function hasPlayableCurrentWatchAudioModule() {
  return !!(
    currentWatchAudioSourceKind === "final-artifact" ||
    getRememberedWatchFinalAudio()
  );
}

function hasPlayableCurrentWatchVideoModule() {
  return !!(watchVideo?.src && String(watchVideo.src).trim());
}

function hasCurrentRunInFlightModule() {
  return !!String(
    currentWatchAudioRunId ||
      pendingFinalAudioRunId ||
      activePipelineRunId ||
      currentWatchPreviewWork?.source_run_id ||
      ""
  ).trim();
}

function findActiveBackgroundRunIdForCurrentWorkModule() {
  const targetTitle = String(state.title || currentWatchPreviewWork?.title || "").trim();
  const items =
    (typeof globalThis.readNotificationsModule === "function"
      ? globalThis.readNotificationsModule()
      : []) || [];
  if (!targetTitle || !Array.isArray(items)) return "";
  const activeMatch = items.find((item) => {
    if (String(item?.stage || "").trim() !== "active") return false;
    const runId = String(item?.runId || "").trim();
    const workTitle = String(item?.workTitle || "").trim();
    return !!runId && workTitle === targetTitle;
  });
  return String(activeMatch?.runId || "").trim();
}

function getCurrentInFlightWatchRunIdModule() {
  return String(
    currentWatchAudioRunId ||
      activePipelineRunId ||
      pendingFinalAudioRunId ||
      findActiveBackgroundRunIdForCurrentWorkModule() ||
      currentWatchPreviewWork?.source_run_id ||
      ""
  ).trim();
}

function getNextWatchGenerationGapModule() {
  const lyricsReady = isWatchLyricsReadyModule();
  if (!lyricsReady) return "lyrics";
  const musicDone =
    Number(engineProgressState.music || 0) >= 100 &&
    hasPlayableCurrentWatchAudioModule();
  if (!musicDone) return "music";
  const scriptReady = hasWatchScriptReadyModule();
  if (!scriptReady) return "lyrics";
  const videoDone =
    Number(engineProgressState.video || 0) >= 100 &&
    hasPlayableCurrentWatchVideoModule();
  if (!videoDone) return "video";
  const karaDone = Number(engineProgressState.kara || 0) >= 100;
  if (!karaDone) return "kara";
  return "play";
}

function setBoundedWatchCacheEntryModule(cache, key, value, maxEntries) {
  if (!(cache instanceof Map) || !key) return;
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function armWatchExplicitPreviewIntent(ms = 15000) {
  globalThis.watchExplicitPreviewAllowedUntil = Date.now() + Math.max(1000, Number(ms) || 15000);
}

function syncForyouThumbFallbackModule(mode) {
  if (foryouThumbFallback) {
    foryouThumbFallback.style.display = "none";
  }
  if (foryouThumbVideo) {
    foryouThumbVideo.style.display = mode === "video" ? "block" : "none";
  }
  if (foryouThumbImage) {
    foryouThumbImage.style.display = mode === "image" ? "block" : "none";
  }
}

function getForyouPreviewModeModule() {
  const raw = String(
    foryouPanel?.dataset?.previewMode ||
      localStorage.getItem(FORYOU_PREVIEW_MODE_KEY) ||
      FORYOU_PREVIEW_MODES.AUTO
  ).trim().toLowerCase();
  if (Object.values(FORYOU_PREVIEW_MODES).includes(raw)) return raw;
  return FORYOU_PREVIEW_MODES.AUTO;
}

function buildForyouThumbSvgModule(title, subtitle, lines = []) {
  const safeSubtitle = String(subtitle || "").replace(/</g, "&lt;");
  const safeLine = String(lines.find((line) => String(line || "").trim()) || "")
    .replace(/</g, "&lt;")
    .slice(0, 56);
  const titleLines = globalThis.splitDisplayTitleLinesModule
    ? globalThis.splitDisplayTitleLinesModule(title || watchBrandTitleModule())
    : { secondary: "" };
  const titleMarkup = globalThis.titleLineMarkupModule
    ? globalThis.titleLineMarkupModule(title || watchBrandTitleModule(), {
        baseSize: 58,
        minSize: 30,
        centerY: 308,
        fill: "#f4fffb",
        stroke: "rgba(2, 10, 7, 0.82)",
        layoutSeed: watchTitleLayoutSeed
      })
    : `<text x="50%" y="44%" text-anchor="middle" font-family="Syne, sans-serif" font-size="68" fill="#f4fffb" letter-spacing="6">${escapeHtml(String(title || watchBrandTitleModule()))}</text>`;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
  <defs>
    <radialGradient id="foryouG" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="#12ffd2" stop-opacity="0.95"/>
      <stop offset="52%" stop-color="#0f6d5e" stop-opacity="0.68"/>
      <stop offset="100%" stop-color="#020302" stop-opacity="0.98"/>
    </radialGradient>
  </defs>
  <rect width="720" height="720" rx="80" fill="#020302"/>
  <circle cx="360" cy="296" r="214" fill="url(#foryouG)"/>
  ${titleMarkup}
  <text x="50%" y="${titleLines.secondary ? "59%" : "55%"}" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="22" fill="#9fead1" letter-spacing="4">${safeSubtitle}</text>
  <text x="50%" y="66%" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="20" fill="#dffef4" opacity="0.9">${safeLine}</text>
</svg>`
    )
  );
}

function syncForyouThumbFromLyricsModule(title, lines = []) {
  currentForyouThumbFallbackDataUrl = "";
  const currentArtwork = String(
    globalThis.currentPreviewFrameDataUrl ||
      globalThis.currentResolvedWatchArtworkDataUrl ||
      foryouThumbImage?.src ||
      watchSvg?.src ||
      ""
  ).trim();
  const hasRealArtwork = !!currentArtwork && !/^data:image\/svg\+xml/i.test(currentArtwork);
  if (hasRealArtwork) {
    syncWatchPlaceholderFromCurrentState();
    return true;
  }
  if (foryouThumbImage) {
    foryouThumbImage.removeAttribute("src");
  }
  if (watchScreenBackdrop) {
    watchScreenBackdrop.style.backgroundImage = "";
  }
  return true;
}

function setForyouThumbImageModule(uri) {
  if (!foryouThumbImage || !uri) return false;
  foryouThumbImage.src = uri;
  if (!/^data:image\/svg\+xml/i.test(String(uri || "").trim())) {
    globalThis.currentResolvedWatchArtworkDataUrl = String(uri || "").trim();
  }
  setForyouBackgroundImage(uri);
  syncForyouThumbFallbackModule("image");
  schedulePersistCurrentWorkAssets();
  return true;
}

function restoreForyouThumbFallbackModule() {
  currentForyouThumbFallbackDataUrl = "";
  syncForyouThumbFallbackModule("fallback");
  return false;
}

function setForyouBackgroundImageModule(uri) {
  if (!foryouPanel) return;
  if (!uri) {
    foryouPanel.classList.remove("has-preview-background");
    return;
  }
  foryouPanel.classList.add("has-preview-background");
}

function resetForyouThumbModule() {
  if (foryouThumbVideo) {
    foryouThumbVideo.pause?.();
    foryouThumbVideo.removeAttribute("src");
    foryouThumbVideo.load?.();
  }
  if (foryouThumbImage) {
    foryouThumbImage.removeAttribute("src");
  }
  setForyouBackgroundImageModule("");
  syncForyouThumbFallbackModule("image");
}

function cancelAutoEnjoyModule() {
  autoEnjoyArmed = false;
  if (autoEnjoyTimer) {
    clearTimeout(autoEnjoyTimer);
    autoEnjoyTimer = null;
  }
}

function setForyouCompactModule(enabled, options = {}) {
  const armAuto = options?.armAuto === true;
  if (!foryouPanel) return;
  if (enabled) {
    foryouPanel.classList.add("foryou-panel-compact");
    foryouPanel.classList.remove("foryou-lyrics-expanded");
    if (
      !String(foryouThumbImage?.src || "").trim() &&
      !String(foryouThumbVideo?.src || "").trim() &&
      state.title &&
      Array.isArray(state.lines) &&
      state.lines.length
    ) {
      syncWatchPlaceholderFromCurrentState();
    }
    if (armAuto) {
      armAutoEnjoy();
    } else {
      cancelAutoEnjoyModule();
    }
  } else {
    foryouPanel.classList.remove("foryou-panel-compact");
    foryouPanel.classList.remove("foryou-lyrics-expanded");
    cancelAutoEnjoyModule();
  }
}

function maybeCompactForyouAfterLyricsModule(options = {}) {
  const behavior = readPanelBehaviorSettingsLocal();
  if (behavior.foryou.compact_after_lyrics === false) return;
  setForyouCompactModule(true, options);
}

function clearForyouStructureModule() {
  if (foryouStructure) foryouStructure.innerHTML = "";
  currentForyouHierarchy = [];
  currentForyouLeafKey = "";
  foryouStructureNodeMap = new Map();
  if (foryouSelection) foryouSelection.hidden = true;
}

function syncForyouActionButtonsModule() {
  if (watchButton) {
    watchButton.textContent = loginCopy("Enjoy");
  }
}

function armAutoEnjoyModule(delayMs = 10000) {
  cancelAutoEnjoyModule();
  autoEnjoyArmed = true;
  // W346 20260523 — Jing: 立即锁定封面池到最新作品的单张封面，不等 delayMs.
  // 防止 app.foryou-seed-preview.js 设进来的 5 张杂图在延迟期间乱闪.
  // (async IIFE — 不阻塞主流程，失败无副作用)
  (async () => {
    try {
      let _latestWork = null;
      // 1. 先看 commerce state 有没有已加载的数据
      const _q = getLatestOwnedPlaybackQueueModule?.();
      if (_q?.items?.length) {
        _latestWork = _q.items[0];
      }
      // 2. 没有 → 直接打 market API 取最新作品(signed fresh URL)
      if (!_latestWork) {
        const _r = await fetch("/api/works/market?limit=1&offset=0");
        if (_r.ok) {
          const _d = await _r.json();
          const _ws = Array.isArray(_d?.data?.works) ? _d.data.works
            : Array.isArray(_d?.works) ? _d.works : [];
          if (_ws.length) _latestWork = _ws[0];
        }
      }
      if (!_latestWork) return;
      const _cov = String(
        _latestWork?.cover_image || _latestWork?.cover_url || _latestWork?.preview_image_url || ""
      ).trim();
      if (!_cov || /^data:image\/svg\+xml/i.test(_cov)) return;
      // 3. 立即把池锁到这一张，截断乱闪
      globalThis.currentWatchArtworkVariantPool = [_cov];
      globalThis.currentResolvedWatchArtworkDataUrl = _cov;
      // 4. 同步写到幻灯片层 + 背景层
      if (typeof globalThis.showWatchFramePlaceholderModule === "function") {
        globalThis.showWatchFramePlaceholderModule(_cov);
      }
      const _bd = document.getElementById("watch-screen-backdrop");
      if (_bd) {
        const _stable = typeof globalThis.cssosThumb === "function"
          ? globalThis.cssosThumb(_cov, 800) : _cov;
        _bd.style.backgroundImage = `url("${String(_stable).replace(/"/g, '\\"')}")`;
        _bd.style.backgroundSize = "cover";
        _bd.style.backgroundPosition = "center";
      }
    } catch (_e) { /* non-fatal */ }
  })();
  autoEnjoyTimer = setTimeout(async () => {
    if (!autoEnjoyArmed) return;
    autoEnjoyArmed = false;
    autoEnjoyTimer = null;
    const openedCurrent = await openCurrentGeneratedWatchPlaybackModule({ autoplay: true, preferVideo: true });
    if (openedCurrent) return;
    await openWatchPreviewFlowModule({ tryRegistry: true });
  }, Math.max(0, Number(delayMs ?? FORYOU_AUTO_ENJOY_DELAY_MS)));
}

function toggleForyouLyricsExpandedModule() {
  if (!foryouPanel || !state.lines?.length) return;
  if (!foryouPanel.classList.contains("foryou-panel-compact")) return;
  const nextExpanded = !foryouPanel.classList.contains("foryou-lyrics-expanded");
  if (nextExpanded && foryouSelectionTitle) {
    foryouSelectionTitle.textContent =
      String(state.title || watchBrandTitleModule()).trim() || loginCopy("Untitled");
  }
  if (nextExpanded && foryouSelectionKicker) {
    foryouSelectionKicker.textContent = loginCopy("Single Lyrics");
  }
  if (nextExpanded && foryouSelectionLyrics) {
    foryouSelectionLyrics.textContent = formatForyouLyricsDisplayModule(state.lines);
  }
  if (foryouSelection) {
    foryouSelection.hidden = !nextExpanded;
  }
  foryouPanel.classList.toggle("foryou-lyrics-expanded", nextExpanded);
  cancelAutoEnjoyModule();
}

function formatForyouLyricsDisplayModule(input) {
  const lines = Array.isArray(input)
    ? input
    : String(input || "")
        .split("\n")
        .map((line) => String(line || "").trim());
  const normalized = lines
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  return normalized.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

globalThis.formatForyouLyricsDisplayModule = formatForyouLyricsDisplayModule;

function buildSpacedLyricsTextModule(title, lines) {
  if (typeof globalThis.buildLyricsText === "function") {
    return globalThis.buildLyricsText(title, lines);
  }
  return formatForyouLyricsDisplayModule(lines || []);
}

// CSSOS_PHASE2_LYRICS_NORMALIZER 20260501 #261 — Jing
// "广播到别的面板的时候，请不要使用代码级的JSON格式，而是清爽的京典模版
//  (Verse 1, Verse 2, Chorus 1, Verse 3, Verse 4, Chorus 2, Bridge,
//  Chorus 3, Chorus 4, Outro) 每小节直接隔行."
//
// Normalize lyrics input from any shape into clean section-divided text:
//   • Already plain text with [Verse 1] / **Chorus** / blank-line
//     section breaks → leave as-is (just collapse triple newlines).
//   • JSON object { sections: [{section, lines}] } → emit
//     `[Section]\nline1\nline2\n\n[Next]\n...`.
//   • JSON object { lyrics: "...." } or { text: "...." } → unwrap.
//   • Stringified JSON ("{...}") → parse + re-format.
//   • Arrays of strings → join with \n\n.
//
// Keeps section markers in [Section Name] format so Suno + the music
// engine pick them up as structure hints (they emit better arrangements
// when they see the markers).
function normalizeLyricsTextModule(input) {
  if (input == null) return "";
  // Try to unwrap JSON (object or stringified-JSON).
  let parsed = input;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { parsed = JSON.parse(trimmed); } catch (_e) {
        // CSSOS_PHASE2_LYRICS_JSON_RESCUE 20260504 — Jing
        // "我希望是人类能够看得懂的纯歌词…而不是你们 AI 喜欢看的 JSON 代码".
        // Strict JSON.parse fails when the LLM emits slightly invalid
        // JSON (un-escaped quotes inside the string, trailing commas,
        // etc). Fall back to a regex that grabs the FIRST top-level
        // string keyed under "lyrics" / "text" / "content" — handles
        // 90 % of the flawed envelopes we see in the wild.
        const m = trimmed.match(/"(?:lyrics|text|content|value)"\s*:\s*"([\s\S]*?)"\s*[,}]/);
        if (m && m[1]) {
          parsed = m[1];
        } else {
          parsed = input;
        }
      }
    }
  }
  // Already plain text — unescape literal "\n", "\t", \" then collapse
  // triple+ newlines.
  if (typeof parsed === "string") {
    let s = parsed;
    // CSSOS_PHASE2_LYRICS_LITERAL_NEWLINES 20260504 — Jing
    // The lyrics card was showing literal "\n" (two chars: backslash
    // + n) instead of real line breaks. That happens when the upstream
    // emits a JSON-escaped string but we render it before JSON.parse
    // had a chance to decode the escapes — or when the content sneaks
    // past parse via the rescue regex above. Convert common literal
    // escape sequences to their real characters.
    if (/\\n/.test(s)) {
      s = s
        .replace(/\\r\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\");
    }
    // Make every [Section]/【小节】 marker its own line, with a blank
    // line before it so the user sees the structure clearly.
    s = s
      .replace(/\s*([\[【][^\]\n】]{1,40}[\]】])\s*/g, "\n\n$1\n")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
    return s.trim();
  }
  // Array of strings → join.
  if (Array.isArray(parsed)) {
    return parsed
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  if (parsed && typeof parsed === "object") {
    // { lyrics: "..." } / { text: "..." } / { content: "..." } shells.
    for (const key of ["lyrics", "text", "content", "value"]) {
      if (typeof parsed[key] === "string") {
        return normalizeLyricsTextModule(parsed[key]);
      }
    }
    // { sections: [{section: "Verse 1", lines: ["..."]}] } shape.
    const sections = Array.isArray(parsed.sections)
      ? parsed.sections
      : (Array.isArray(parsed.structure) ? parsed.structure : null);
    if (sections && sections.length) {
      const out = [];
      for (const sec of sections) {
        const name = String(sec?.section || sec?.name || sec?.title || "").trim();
        const lines = Array.isArray(sec?.lines)
          ? sec.lines
          : (typeof sec?.text === "string"
              ? sec.text.split(/\r?\n/)
              : (Array.isArray(sec?.body) ? sec.body : []));
        const cleanLines = lines.map((l) => String(l || "").trim()).filter(Boolean);
        if (!cleanLines.length) continue;
        if (name) out.push(`[${name}]`);
        out.push(cleanLines.join("\n"));
        out.push(""); // blank line between sections
      }
      return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    // Fallback: stringify and try line splits, or give up.
    try {
      const serialized = JSON.stringify(parsed, null, 2);
      // If this is a deeply nested non-lyrics object, return empty —
      // user shouldn't see raw JSON anywhere.
      return serialized.length > 4000 ? "" : "";
    } catch (_e) { return ""; }
  }
  return "";
}
globalThis.cssosNormalizeLyricsText = normalizeLyricsTextModule;

// 京典 10-section template — order matches Jing's preferred scaffold.
// Used by the lyrics generator prompt + as a default when assembling
// section labels for empty drafts.
const CSSOS_JINGDIAN_SECTIONS = Object.freeze([
  "Verse 1", "Verse 2", "Chorus 1", "Verse 3", "Verse 4",
  "Chorus 2", "Bridge", "Chorus 3", "Chorus 4", "Outro",
]);
globalThis.CSSOS_JINGDIAN_SECTIONS = CSSOS_JINGDIAN_SECTIONS;

function maybeFinalizeForyouPresentationModule() {
  if (foryouCompletionCommitted) return;
  if (
    !(
      typingState.completed &&
      engineProgressState.music >= 100 &&
      engineProgressState.video >= 100 &&
      engineProgressState.kara >= 100 &&
      karaCompletionAt > 0
    )
  ) {
    return;
  }
  foryouCompletionCommitted = true;
  stopPipelineProgressPolling();
  renderKaraEngineSnapshot(null, {
    currentStage: loginCopy("Final MV opening"),
    artifactDetail: loginCopy("Switching into the finished cut now")
  });
  finishCreationSession();
  clearTimeout(foryouCompletionHoldTimer);
  const delayMs = Math.max(0, FORYOU_POST_COMPLETE_HOLD_MS - (Date.now() - karaCompletionAt));
  foryouCompletionHoldTimer = setTimeout(() => {
    clearInterval(progressTimer);
    setEngineProgressVisible("lyrics", false);
    armAutoEnjoyModule(0);
    layoutShowcasePanels();
    foryouCompletionHoldTimer = null;
  }, delayMs);
}

function buildMarketPreviewSeedModule(work = {}) {
  const title = String(work?.title || "").trim() || loginCopy("Untitled");
  const lyrics = readWorkLyricsSourceTextModule(work);
  const musicStyle = String(work?.style || "").trim() || loginCopy("Creator preview");
  const baseLines = lyrics
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const sectionTitles = baseLines.length
    ? baseLines.slice(0, 4)
    : [loginCopy("Verse preview"), loginCopy("Hook preview")];
  const sectionBeats = sectionTitles.map((line, index) => ({
    section: index === 0 ? "Intro" : index === 1 ? "Verse" : index === 2 ? "Chorus" : `Section ${index + 1}`,
    title: line.slice(0, 48),
    bars: index === 2 ? 8 : 6,
    energy: index === 2 ? "high" : index === 0 ? "medium-low" : "medium",
    focus: line.slice(0, 36),
    visual_role: index === 2 ? "hook moment" : "character setup"
  }));
  return {
    title,
    lyrics,
    musicStyle,
    musicStructure: sectionBeats.map((item) => item.section).join(" · "),
    videoOutline: loginCopy(
      `30-second buyer preview for ${title} by ${String(work?.owner_name || work?.owner_email || "creator").trim() || "creator"}.`
    ),
    references: [],
    sectionPrompts: sectionBeats.map((item, index) => ({
      section: item.section,
      prompt: loginCopy(
        `Shot ${index + 1}: ${item.focus}. Keep it teaser-length and purchase-oriented.`
      )
    })),
    sectionBeats,
    styleTags: [musicStyle]
  };
}

function readWorkLyricsSourceTextModule(work = {}) {
  const direct = String(work?.lyrics_text || work?.lyrics_preview || "").trim();
  if (direct && !looksLikeVisualPromptSummaryModule(direct)) return direct;
  const childLyrics = (Array.isArray(work?.children) ? work.children : [])
    .map((child) => readWorkLyricsSourceTextModule(child))
    .filter(Boolean);
  if (childLyrics.length) return childLyrics.join("\n").trim();
  return "";
}

function workLyricsLinesModule(work = {}) {
  return extractDisplayLyricLinesModule(readWorkLyricsSourceTextModule(work));
}

function isInstructionalLyricLineModule(line) {
  const text = String(line || "").trim();
  if (!text) return true;
  const normalized = text.toLowerCase();
  if (/^#{1,6}\s+/.test(text)) return true;
  if (
    /^\[(title|scene|intro|verse|chorus|bridge|outro|pre-chorus|hook|interlude|refrain)([^\]]*)\]$/i.test(
      text,
    )
  ) {
    return false;
  }
  if (/^(把《.+》写成|写成一首|write .+ as a song|turn .+ into a song)/i.test(text)) return true;
  if (/^(保留|主歌先|副歌|结尾|让|避免|不要|先用|open with|keep the |let the |close the |push the |repeat the |describe )/i.test(text)) {
    return true;
  }
  if (/(示例模板标题|用户输入优先|建立这首歌的主场景|形成记忆点|不要离开原本题目|镜头慢慢拉远|camera pulling away)/i.test(normalized)) {
    return true;
  }
  return false;
}

function looksLikeVisualPromptSummaryModule(raw) {
  const text = String(raw || "").trim();
  if (!text) return false;
  const normalized = text.toLowerCase();
  if (
    /(camera:|lighting:|environment:|shot brief|visual role:|directing goals:|bars:|focus:|energy:)/i.test(
      normalized,
    )
  ) {
    return true;
  }
  const lines = text
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  if (lines.length !== 1) return false;
  const line = lines[0];
  const commaCount = (line.match(/,/g) || []).length;
  const wordCount = line.split(/\s+/).filter(Boolean).length;
  const hasLyricPunctuation = /[。！？!?]/.test(line);
  const promptTokens = [
    "android",
    "heroine",
    "neon",
    "memory loop",
    "metallic",
    "couture",
    "desert",
    "temple",
    "ballroom",
    "control room",
    "mist",
    "horizon",
    "warrior",
    "finale",
    "opera,",
  ];
  const looksLikePrompt =
    commaCount >= 3 &&
    wordCount >= 6 &&
    !hasLyricPunctuation &&
    promptTokens.some((token) => normalized.includes(token));
  return looksLikePrompt;
}

function extractDisplayLyricLinesModule(raw) {
  const parts =
    globalThis.splitLyricsTitleAndBodyModule?.("", raw) || {
      bodyLines: String(raw || "").split("\n"),
    };
  return (Array.isArray(parts.bodyLines) ? parts.bodyLines : [])
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .filter((line) => !isInstructionalLyricLineModule(line));
}

function buildDisplayLyricsPreviewTextModule(work = {}) {
  const lyricLines = workLyricsLinesModule(work);
  if (lyricLines.length) {
    return formatForyouLyricsDisplayModule(lyricLines);
  }
  const title = String(work?.title || "").trim() || loginCopy("Untitled");
  const style = String(work?.style || "").trim();
  return style ? `${title}\n${style}` : title;
}

function getWorkCommerceDetailsModule(workId) {
  const commerce = watchCommerceState.payload || null;
  const market = commerce?.market || null;
  const profiles = Array.isArray(market?.profiles) ? market.profiles : [];
  const profile = profiles.find((entry) => String(entry?.work_id || "") === String(workId || ""));
  const listenCents = Number(profile?.current_listen_price_cents || 0);
  const buyoutCents = Number(profile?.current_buyout_price_cents || 0);
  return {
    listenCents,
    buyoutCents,
    buyoutEnabled: Boolean(profile?.buyout_enabled) && buyoutCents > 0
  };
}

function canReceiveTipsModule(work = {}) {
  return Boolean(work?.tips_enabled !== false);
}

function resolveViewerOrderStateModule(viewerOrders = []) {
  const orders = Array.isArray(viewerOrders) ? viewerOrders : [];
  const hasPaid = (kind) =>
    orders.some((entry) => String(entry?.order_kind || "") === kind && String(entry?.status || "") === "paid");
  const hasPending = (kind) =>
    orders.some(
      (entry) =>
        String(entry?.order_kind || "") === kind &&
        ["pending", "processing"].includes(String(entry?.status || ""))
    );
  return {
    paidListen: hasPaid("listen"),
    paidBuyout: hasPaid("buyout"),
    paidTip: hasPaid("tip"),
    pendingListen: hasPending("listen"),
    pendingBuyout: hasPending("buyout"),
    pendingTip: hasPending("tip")
  };
}

function renderUsageHistoryMarkupModule(entries = [], emptyCopy, limit = 8) {
  const rows = Array.isArray(entries) ? entries.slice(0, limit) : [];
  if (!rows.length) {
    return `<div class="watch-activity-empty">${escapeHtml(emptyCopy || loginCopy("No action charge history yet."))}</div>`;
  }
  return rows
    .map((entry) => {
      const actionKey = resolveUsageActionKeyModule(entry);
      const estimatedCost = Math.max(0, Number(entry?.meta?.estimated_cost_cents || entry?.cost_cents || 0));
      const actualCost = Number(entry?.cost_cents || 0);
      const blocked = String(entry?.meta?.blocked || "").trim();
      const title = blocked
        ? `${billableActionLabelModule(actionKey)} · ${loginCopy("blocked")}`
        : billableActionLabelModule(actionKey);
      const detailParts = [
        loginCopy(`Actual ${formatUsdFromCents(actualCost, "$0.00")}`),
        loginCopy(`Estimate ${formatUsdFromCents(estimatedCost, "$0.00")}`),
        entry?.meta?.covered_by ? loginCopy(`covered by ${entry.meta.covered_by}`) : "",
        blocked ? loginCopy(`reason ${blocked}`) : ""
      ].filter(Boolean);
      return `
        <div class="watch-activity-item">
          <div class="watch-activity-title">${escapeHtml(title)}</div>
          <div class="watch-activity-meta">${escapeHtml(`${detailParts.join(" · ")} · ${formatDateTime(entry?.created_at)}`)}</div>
        </div>
      `;
    })
    .join("");
}

function billableActionLabelModule(actionKey = "") {
  const normalized = String(actionKey || "").trim().toLowerCase();
  const labels = {
    lyrics_generate: loginCopy("Lyrics generate"),
    music_generate: loginCopy("Music generate"),
    video_generate: loginCopy("Video generate"),
    thumbnail_regenerate: loginCopy("Thumbnail regenerate"),
    preview_video_regenerate: loginCopy("Preview clip regenerate"),
    multi_language: loginCopy("Extra lyric language"),
    multi_voice: loginCopy("Extra voice lane"),
    enterprise_route: loginCopy("Enterprise API route"),
    cinema_booking: loginCopy("Cinema booking")
  };
  return labels[normalized] || normalized || loginCopy("Action");
}

function resolveUsageActionKeyModule(entry = {}) {
  return String(entry?.meta?.action_key || entry?.note || entry?.kind || "").trim().toLowerCase();
}

function getWorkMatchedUsageEventsModule(work = {}, entries = []) {
  const workId = String(work?.id || work?.work_id || work?.local_id || "").trim();
  const sourceRunId = String(work?.source_run_id || "").trim();
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const metaWorkId = String(entry?.meta?.work_id || "").trim();
    const metaRunId = String(entry?.meta?.source_run_id || entry?.meta?.job_id || "").trim();
    return !!((workId && metaWorkId && metaWorkId === workId) || (sourceRunId && metaRunId && metaRunId === sourceRunId));
  });
}

function renderLedgerHistoryMarkupModule(entries = [], emptyCopy, limit = 8) {
  const rows = Array.isArray(entries) ? entries.slice(0, limit) : [];
  if (!rows.length) {
    return `<div class="watch-activity-empty">${escapeHtml(emptyCopy || loginCopy("No ledger entries yet."))}</div>`;
  }
  return rows
    .map((entry) => `
      <div class="watch-activity-item">
        <div class="watch-activity-title">${escapeHtml(String(entry?.note || entry?.kind || loginCopy("Ledger entry")))}</div>
        <div class="watch-activity-meta">${escapeHtml(`${formatUsdFromCents(Number(entry?.amount_cents || 0), "$0.00")} · ${formatDateTime(entry?.created_at)}`)}</div>
      </div>
    `)
    .join("");
}

/* CSSOS_WAVE_113J 20260511 — Jing
 * "在'作品中心'面板要显示明细总成本".
 * Decompose total compute cost into stage line items so creators see
 * exactly what they spent on Lyrics / Cover / Music / Video / Compose.
 * Until we ship a real cost_breakdown JSONB column (113K), the split
 * follows the empirical stage proportion of a single MV pipeline run.
 */
function _cssosCostFloorCents(workType, durationSecs) {
  var wt = String(workType || "single").toLowerCase();
  var d = Math.max(24, Math.min(1800, Number(durationSecs) || 180));
  var base = Math.round((d / 60) * 18); // ~18¢/minute floor
  if (wt === "triptych") base = Math.round(base * 2.4);
  else if (wt === "opera") base = Math.round(base * 3.6);
  return Math.max(15, base);
}
function _cssosCostBreakdown(totalCents, work = {}) {
  var t = Math.max(0, Number(totalCents) || 0);
  if (t <= 0) t = _cssosCostFloorCents(work.work_type, work.duration_secs);

  // CSSOS_WAVE_113K 20260511 — Jing
  // Prefer the real per-engine breakdown stored in DB (work.cost_breakdown
  // JSONB array of {stage, provider, model, cents, ts, ms}). When present,
  // aggregate by stage and render as real itemized lines. Fall back to
  // the 113J proportion-based decomposition when the column is empty
  // (legacy works pre-113K, or upload-imported works that bypassed the
  // full pipeline).
  var raw = work && (work.cost_breakdown || work.costBreakdown);
  if (Array.isArray(raw) && raw.length > 0) {
    var stageMap = {
      lyrics:   { zh: "歌词",      en: "Lyrics" },
      cover:    { zh: "封面",      en: "Cover" },
      music:    { zh: "音乐",      en: "Music" },
      video:    { zh: "视频",      en: "Video" },
      subtitle: { zh: "字幕",      en: "Subtitle" },
      compose:  { zh: "合成",      en: "Compose" },
      audio_upload: { zh: "音频上传", en: "Audio upload" },
      lyrics_parse: { zh: "歌词解析", en: "Lyrics parse" },
    };
    var byStage = {};
    var rowsReal = [];
    raw.forEach(function (e) {
      if (!e || !e.stage) return;
      var k = String(e.stage).toLowerCase();
      var cents = Math.max(0, Number(e.cents || 0) | 0);
      if (cents <= 0) return;
      if (!byStage[k]) {
        var m = stageMap[k] || { zh: k, en: k };
        byStage[k] = { key: k, zh: m.zh, en: m.en, cents: 0, providers: [] };
        rowsReal.push(byStage[k]);
      }
      byStage[k].cents += cents;
      var prov = String(e.provider || "").trim();
      if (prov && byStage[k].providers.indexOf(prov) < 0) {
        byStage[k].providers.push(prov);
      }
    });
    if (rowsReal.length > 0) {
      // Sort by display order for canonical pipeline.
      var order = ["lyrics","lyrics_parse","cover","music","video","subtitle","compose","audio_upload"];
      rowsReal.sort(function (a, b) {
        var ai = order.indexOf(a.key); if (ai < 0) ai = 99;
        var bi = order.indexOf(b.key); if (bi < 0) bi = 99;
        return ai - bi;
      });
      // Annotate with provider list for display.
      rowsReal.forEach(function (r) {
        if (r.providers.length) {
          r.en = r.en + " (" + r.providers.join(", ") + ")";
          r.zh = r.zh + "（" + r.providers.join("、") + "）";
        }
      });
      rowsReal.__real = true; // flag for caller (drops "approximate" disclaimer)
      return rowsReal;
    }
  }

  // 113J fallback: empirical proportion split.
  var split = [
    { key: "lyrics",   zh: "歌词",     en: "Lyrics",     pct: 0.05 },
    { key: "cover",    zh: "封面",     en: "Cover",      pct: 0.07 },
    { key: "music",    zh: "音乐",     en: "Music",      pct: 0.30 },
    { key: "video",    zh: "视频",     en: "Video",      pct: 0.50 },
    { key: "compose",  zh: "合成/字幕", en: "Compose+SRT", pct: 0.08 },
  ];
  var rows = split.map(function (s) {
    return { key: s.key, zh: s.zh, en: s.en, cents: Math.max(1, Math.round(t * s.pct)) };
  });
  var sum = rows.reduce(function (a, r) { return a + r.cents; }, 0);
  var drift = t - sum;
  if (drift !== 0) {
    var videoRow = rows.find(function (r) { return r.key === "video"; });
    if (videoRow) videoRow.cents = Math.max(1, videoRow.cents + drift);
  }
  return rows;
}

function renderWorkCostBillMarkupModule(work = {}, entries = []) {
  const computeUnits = Math.max(0, Number(work?.compute_units_estimate || 0));
  let computeCost = Math.max(0, Number(work?.compute_cost_cents_estimate || 0));
  // CSSOS_WAVE_113J — never display 0. Compute a floor based on
  // work_type + duration so even legacy rows show realistic spend.
  if (computeCost <= 0) {
    computeCost = _cssosCostFloorCents(work?.work_type, work?.duration_secs);
  }
  const suggestedListen = Math.max(99, Number(work?.suggested_listen_price_cents || 0));
  const suggestedBuyout = Math.max(299, Number(work?.suggested_buyout_price_cents || 0));
  const historyMarkup = renderUsageHistoryMarkupModule(
    getWorkMatchedUsageEventsModule(work, entries),
    loginCopy("This work does not yet have linked billable action rows."),
    4
  );
  const breakdown = _cssosCostBreakdown(computeCost, work);
  const isRealBreakdown = !!(breakdown && breakdown.__real);
  // CSSOS_WAVE_113K — sum-of-rows for real breakdowns (computeCost
  // pre-DB-save may be stale; rows from cost_breakdown JSONB are truth).
  const breakdownTotal = isRealBreakdown
    ? breakdown.reduce((acc, r) => acc + (Number(r.cents) || 0), 0)
    : computeCost;
  const breakdownRows = breakdown.map((r) => `
    <div class="work-billing-stat work-billing-stat-line">
      <span>${escapeHtml(loginCopy(r.en, r.zh))}</span>
      <strong>${escapeHtml(formatUsdFromCents(r.cents, "$0.00"))}</strong>
    </div>
  `).join("");
  return `
    <div class="work-billing-card">
      <div class="work-billing-title">${loginCopy("Work cost bill")}</div>
      <div class="work-billing-grid">
        <div class="work-billing-stat"><span>${loginCopy("Compute")}</span><strong>${escapeHtml(`${computeUnits}u`)}</strong></div>
        <div class="work-billing-stat"><span>${loginCopy("Total cost", "总成本")}</span><strong>${escapeHtml(formatUsdFromCents(breakdownTotal, "$0.00"))}</strong></div>
        <div class="work-billing-stat"><span>${loginCopy("Suggested listen")}</span><strong>${escapeHtml(formatUsdFromCents(suggestedListen, "$0.00"))}</strong></div>
        <div class="work-billing-stat"><span>${loginCopy("Suggested buyout")}</span><strong>${escapeHtml(formatUsdFromCents(suggestedBuyout, "$0.00"))}</strong></div>
      </div>
      <details class="work-billing-itemized" style="margin-top:8px;" ${isRealBreakdown ? "open" : ""}>
        <summary style="cursor:pointer;font-size:12px;opacity:0.85;">${escapeHtml(loginCopy("Itemized breakdown", "成本明细"))} ${isRealBreakdown ? "· ✅" : "· ≈"}</summary>
        <div class="work-billing-grid" style="grid-template-columns:1fr 1fr;gap:4px;margin-top:6px;">
          ${breakdownRows}
        </div>
        <div class="work-extra" style="font-size:11px;opacity:0.7;margin-top:6px;">${escapeHtml(isRealBreakdown ? loginCopy(
          "Real per-engine costs from this pipeline run (server compute + third-party engines).",
          "本次管线运行的逐项真实成本（服务器算力 + 第三方引擎）。"
        ) : loginCopy(
          "Breakdown approximates the standard MV pipeline split (lyrics 5% · cover 7% · music 30% · video 50% · compose 8%). Legacy work — exact per-engine costs not recorded.",
          "明细按典型 MV 管线比例分摊（歌词 5% · 封面 7% · 音乐 30% · 视频 50% · 合成 8%）。此为旧作品，未记录逐项真实成本。"
        ))}</div>
      </details>
      <div class="work-extra">${escapeHtml(loginCopy("Pricing can be higher or lower than the system suggestion, but the cost bill stays visible for creators."))}</div>
      <div class="watch-activity compact">${historyMarkup}</div>
    </div>
  `;
}

function revealEnginePanelModule(engine) {
  const showGenerationFlow =
    readPanelBehaviorSettingsLocal()?.watch?.show_generation_flow === true;
  const micBehavior = readPanelBehaviorSettingsLocal()?.mic || {};
  const currentSurfaceMode = String(
    globalThis.currentCreationSurfaceMode ||
      micBehavior.settings_surface_mode ||
      micBehavior.logo_surface_mode ||
      "mv_only"
  ).trim();
  if (!showGenerationFlow && currentSurfaceMode !== "showcase") {
    return;
  }
  const panel =
    engine === "lyrics"
      ? lyricsPanel
      : engine === "music"
        ? musicPanel
        : engine === "video"
          ? videoPanel
          : watchPanel;
  if (!panel) return;
  if (!enginePanelRevealState[engine]) {
    enginePanelRevealState[engine] = true;
  }
  if (engine === "kara") {
    openWatchPreviewShellModule({ fallbackTab: "mv" });
  } else {
    openPanel(panel);
  }
  focusPanel(panel);
}

function pinLyricsViewportToLiveEdgeModule() {
  if (!lyricsEl) return;
  requestAnimationFrame(() => {
    lyricsEl.scrollTop = lyricsEl.scrollHeight;
  });
}

function getEngineProgressShellModule(engine) {
  return engine === "lyrics"
    ? lyricsProgressShell
    : engine === "music"
      ? musicProgressShell
      : engine === "video"
        ? videoProgressShell
        : karaProgressShell;
}

function getEngineProgressBarModule(engine) {
  return engine === "lyrics"
    ? lyricsProgress
    : engine === "music"
      ? musicProgress
      : engine === "video"
        ? videoProgress
        : karaProgress;
}

function getEngineProgressTitleModule(engine) {
  return getEngineProgressShellModule(engine)?.querySelector(".engine-progress-title") || null;
}

function poeticEngineTitleModule(engine) {
  if (engine === "lyrics") return loginCopy("First Line");
  if (engine === "music") return loginCopy("Hook Lift");
  if (engine === "video") return loginCopy("Frame Relations");
  if (engine === "kara") return loginCopy("Lyric Landing");
  return String(engine || "").trim();
}

function syncPoeticEngineLabelsModule() {
  const mapping = {
    lyrics: "#lyrics-panel .panel-title",
    music: "#music-panel .panel-title",
    video: "#video-panel .panel-title",
    kara: "#kara-progress-shell .engine-progress-title"
  };
  Object.entries(mapping).forEach(([engine, selector]) => {
    const el = document.querySelector(selector);
    if (el) {
      el.textContent = poeticEngineTitleModule(engine);
    }
  });
  ["lyrics", "music", "video"].forEach((engine) => {
    const titleEl = getEngineProgressTitleModule(engine);
    const shell = getEngineProgressShellModule(engine);
    if (titleEl) {
      const title = poeticEngineTitleModule(engine);
      titleEl.textContent = title;
      if (shell) shell.dataset.baseTitle = title;
    }
  });
}

function setEngineProgressVisibleModule(engine, visible, options = {}) {
  const shell = getEngineProgressShellModule(engine);
  if (!shell) return;
  const showGenerationFlow = readPanelBehaviorSettingsLocal()?.watch?.show_generation_flow === true;
  if (!showGenerationFlow) {
    clearTimeout(engineProgressHideTimers[engine]);
    engineProgressHideTimers[engine] = null;
    shell.hidden = true;
    shell.classList.remove("is-fading");
    return;
  }
  clearTimeout(engineProgressHideTimers[engine]);
  engineProgressHideTimers[engine] = null;
  const immediate = options?.immediate === true;
  if (visible) {
    shell.hidden = false;
    shell.classList.remove("is-fading");
    return;
  }
  if (immediate) {
    shell.hidden = true;
    shell.classList.remove("is-fading");
    return;
  }
  const hideDelayMs =
    Number(options?.delayMs || 0) > 0
      ? Number(options.delayMs)
      : engine === "lyrics"
        ? 3600
        : 1400;
  shell.classList.add("is-fading");
  engineProgressHideTimers[engine] = setTimeout(() => {
    shell.hidden = true;
    shell.classList.remove("is-fading");
    engineProgressHideTimers[engine] = null;
  }, hideDelayMs);
}

function setEngineDetailModule(engine, detail) {
  engineDetailState[engine] = String(detail || "").trim();
  const target =
    engine === "lyrics"
      ? lyricsProgressDetail
      : engine === "music"
        ? musicProgressDetail
        : engine === "video"
          ? videoProgressDetail
          : karaProgressDetail;
  if (!target) return;
  target.textContent = engineDetailState[engine];
  syncWatchEngineGrid();
}

function setEngineStateModule(engine, state) {
  engineStates[engine] = state;
  const shell = getEngineProgressShellModule(engine);
  if (!shell) return;
  const titleEl = getEngineProgressTitleModule(engine);
  if (!shell.dataset.baseTitle && titleEl) {
    shell.dataset.baseTitle = titleEl.textContent;
  }
  shell.classList.remove("paused", "canceled", "running");
  if (state === "paused") {
    shell.classList.add("paused");
    setEngineProgressVisibleModule(engine, true, { immediate: true });
  }
  if (state === "running") {
    shell.classList.add("running");
    setEngineProgressVisibleModule(engine, true, { immediate: true });
  }
  if (state === "canceled") {
    shell.classList.add("canceled");
    const progressEl = getEngineProgressBarModule(engine);
    if (progressEl) setProgress(progressEl, 0);
    setEngineProgressVisibleModule(engine, false);
  }
  if (titleEl) {
    const base = shell.dataset.baseTitle || titleEl.textContent;
    const suffix =
      state === "paused" ? " · Paused" : state === "canceled" ? " · Canceled" : "";
    titleEl.textContent = `${base}${suffix}`;
  }
  if (engine === "video" && state === "canceled") {
    pruneSceneRows();
    sceneRows.forEach((entry) => {
      const current = entry?.statusEl?.dataset?.state || "queued";
      if (["done", "delete", "canceled"].includes(current)) return;
      setSceneState(entry.row, entry.statusEl, "canceled");
    });
  }
  syncWatchEngineGrid();
}

function cycleEngineStateModule(engine) {
  if (engine === "lyrics") {
    return;
  }
  const state = engineStates[engine];
  if (state === "running") {
    setEngineStateModule(engine, "paused");
    showToast(`${engine} paused`);
    return;
  }
  if (state === "paused") {
    setEngineStateModule(engine, "canceled");
    showToast(`${engine} canceled`);
  }
}

function initEngineControlsModule() {
  document.querySelectorAll("[data-engine-progress]").forEach((shell) => {
    const engine = shell.getAttribute("data-engine-progress");
    if (!engine) return;
    if (engine === "lyrics") {
      shell.title = loginCopy(
        "Lyrics engine status is view-only here to avoid accidental pause/cancel."
      );
      shell.style.cursor = "default";
      return;
    }
    shell.addEventListener("click", () => cycleEngineStateModule(engine));
  });
}

function resetEngineStatesModule() {
  setEngineStateModule("lyrics", "running");
  setEngineStateModule("music", "pending");
  setEngineStateModule("video", "pending");
  setEngineStateModule("kara", "pending");
  setEngineProgressVisibleModule("lyrics", true, { immediate: true });
}

function animateProgressModule() {
  clearInterval(progressTimer);
  ensureWatchProgressRotatorModule();
  progressTimer = setInterval(() => {
    if (engineStates.lyrics === "running" && lyricsProgress) {
      const current = lyricsEl?.textContent?.length || 0;
      const pct = lyricsTargetLength ? Math.min(100, (current / lyricsTargetLength) * 100) : 0;
      setProgress(lyricsProgress, pct);
    }
    if (!activePipelineRunId) {
      setProgress(musicProgress, engineProgressState.music);
      setProgress(videoProgress, engineProgressState.video);
      setProgress(karaProgress, engineProgressState.kara);
      syncSceneProgress(engineProgressState.video);
    }
    if (typingState.completed && !isLyricsProgressStillPinnedModule()) {
      setEngineProgressVisibleModule("lyrics", true);
    }
    syncWatchEngineGrid();
    syncWatchProgressRotatorModule();
    maybeFinalizeForyouPresentationModule();
  }, 420);
}

function resetTypingStateModule() {
  typingState = { paused: false, canceled: false, completed: false };
  globalThis.watchLyricsProgressPinnedUntil = 0;
  foryouCompletionCommitted = false;
  karaCompletionAt = 0;
  clearTimeout(foryouCompletionHoldTimer);
  foryouCompletionHoldTimer = null;
  stopPipelineProgressPolling();
  enginePanelRevealState.lyrics = false;
  enginePanelRevealState.music = false;
  enginePanelRevealState.video = false;
  enginePanelRevealState.kara = false;
  engineProgressState.music = 0;
  engineProgressState.video = 0;
  engineProgressState.kara = 0;
  if (musicProgress) setProgress(musicProgress, 0);
  if (videoProgress) setProgress(videoProgress, 0);
  if (karaProgress) setProgress(karaProgress, 0);
  if (lyricsEl) {
    lyricsEl.classList.remove("paused", "canceled");
    lyricsEl.textContent = "";
    lyricsEl.scrollTop = 0;
  }
  watchScreen?.classList.remove("is-live-border", "is-stalled");
  watchScreen?.classList.add("is-waiting");
  setWatchPlaybackUiSuppressedModule(false);
  enterLyricSpellcast();
  setEngineProgressVisibleModule("lyrics", true, { immediate: true });
  setEngineProgressVisibleModule("music", false, { immediate: true });
  setEngineProgressVisibleModule("video", false, { immediate: true });
  setEngineProgressVisibleModule("kara", false, { immediate: true });
  setEngineStateModule("lyrics", "running");
  setEngineStateModule("music", "pending");
  setEngineStateModule("video", "pending");
  setEngineStateModule("kara", "pending");
  setEngineDetailModule("lyrics", "stage: typing");
  setEngineDetailModule("music", "waiting for audio engine");
  setEngineDetailModule("video", "waiting for video engine");
  setEngineDetailModule("kara", "waiting for karaoke sync");
  if (lyricsProgress) setProgress(lyricsProgress, 0);
  revealEnginePanelModule("lyrics");
  syncWatchEngineGrid();
  ensureWatchProgressRotatorModule();
  renderWatchKaraokeOverlay(0);
  watchProgressStageKey = "lyrics";
  watchProgressLastFingerprint = "";
  watchProgressLastChangeAt = Date.now();
}

function pinLyricsProgressVisibilityModule(ms = 3600) {
  globalThis.watchLyricsProgressPinnedUntil = Date.now() + Math.max(800, Number(ms) || 3600);
}

function isLyricsProgressStillPinnedModule() {
  return Number(globalThis.watchLyricsProgressPinnedUntil || 0) > Date.now();
}

function cycleLyricsStateModule() {
  if (!lyricsEl) return;
  showToast(t("watch.toast.lyricsLocked"));
}

function initLyricsControlsModule() {
  if (!lyricsEl) return;
  lyricsEl.title = t("watch.tooltip.lyricsReadonly");
}

function setProgressModule(el, value) {
  if (!el) return;
  el.style.width = `${value}%`;
}

let __cssosLyricsPctCache = { sig: null, val: 0 };
function currentLyricsProgressPercentModule() {
  // CSSOS_WAVE_270 20260521 — Jing: readProgress 热路径节流. 此函数被进度
  // 定时器/旋转器反复调用, 原来每次都跑重的歌词解析(hasCanonicalLyricsBody
  // Lines + isWatchLyricsReady→compactLyricLines, 解析全文). 用便宜的输入指纹
  // 缓存: 输入未变就直接返回上次结果, 跳过重算 —— 长时间连播 / 低端机更顺.
  const sig =
    (typingState.completed ? 1 : 0) + "|" +
    String(state.songSeed?.lyrics || "").length + "|" +
    (Array.isArray(state.lines) ? state.lines.length : 0) + "|" +
    (watchLyricsEditor?.value || "").length + "|" +
    (lyricsInput?.value || "").length + "|" +
    (lyricsEl?.textContent?.length || 0) + "|" +
    (lyricsTargetLength || 0) + "|" +
    (globalThis.lyricsSeedRequestState?.pending ? 1 : 0) + "|" +
    String(state.songSeed?.title || state.title || "").length;
  if (__cssosLyricsPctCache.sig === sig) return __cssosLyricsPctCache.val;
  const requestState = globalThis.lyricsSeedRequestState || {};
  const hasSeedLyrics =
    (globalThis.hasCanonicalLyricsBodyLinesModule?.(
      String(state.songSeed?.title || state.title || "").trim(),
      state.songSeed?.lyrics || watchLyricsEditor?.value || lyricsInput?.value || "",
      2
    ) ?? false);
  let val;
  if (typingState.completed || isWatchLyricsReadyModule() || hasSeedLyrics) {
    val = 100;
  } else {
    const current = lyricsEl?.textContent?.length || 0;
    if (requestState.pending && !lyricsTargetLength && current <= 0) {
      val = 0;
    } else {
      val = lyricsTargetLength ? Math.min(100, (current / lyricsTargetLength) * 100) : 0;
    }
  }
  __cssosLyricsPctCache = { sig, val };
  return val;
}

function syncWatchEngineGridModule() {
  if (!watchEngineGrid) return;
  const showGenerationFlow = readPanelBehaviorSettingsLocal()?.watch?.show_generation_flow === true;
  watchEngineGrid.hidden = !showGenerationFlow;
  if (!showGenerationFlow) {
    clearChildren(watchEngineGrid);
    return;
  }
  syncPoeticEngineLabelsModule();
  const behavior = readPanelBehaviorSettingsLocal();
  const compactDetail = behavior.watch.engine_detail === "compact";
  const watchTone = ["opening", "lead", "group", "callback"].includes(String(globalThis.watchNarrativeTone || "").trim())
    ? String(globalThis.watchNarrativeTone || "").trim()
    : "opening";
  const cards = [
    {
      engine: "lyrics",
      title: poeticEngineTitleModule("lyrics"),
      progress: currentLyricsProgressPercentModule(),
      detail: engineDetailState.lyrics || loginCopy("Waiting"),
      hue: 145
    },
    {
      engine: "music",
      title: poeticEngineTitleModule("music"),
      progress: engineProgressState.music,
      detail: engineDetailState.music || loginCopy("Waiting"),
      hue: 210
    },
    {
      engine: "video",
      title: poeticEngineTitleModule("video"),
      progress: engineProgressState.video,
      detail: engineDetailState.video || loginCopy("Waiting"),
      hue: 290
    },
    {
      engine: "kara",
      title: poeticEngineTitleModule("kara"),
      progress: engineProgressState.kara,
      detail: engineDetailState.kara || loginCopy("Waiting"),
      hue: 36
    }
  ];
  // CSSOS_PHASE2_WATCH_ENGINE_LIVE 20260420 — mutate existing cards in place
  // instead of clearChildren+rebuild, so the CSS `transition: width` on the
  // fill bar actually animates between progress values. This makes the
  // engine cards feel real-time like the notifications panel even when the
  // server-side progress poll only ticks every ~1.2s.
  cards.forEach((cardInfo, idx) => {
    let card = watchEngineGrid.children[idx];
    if (!card || card.dataset.engine !== cardInfo.engine) {
      card = document.createElement("div");
      card.dataset.engine = cardInfo.engine;
      card.innerHTML =
        '<div class="watch-engine-title"></div>' +
        '<div class="watch-engine-progress"><span></span></div>' +
        '<div class="watch-engine-detail"></div>';
      if (watchEngineGrid.children[idx]) {
        watchEngineGrid.replaceChild(card, watchEngineGrid.children[idx]);
      } else {
        watchEngineGrid.appendChild(card);
      }
    }
    const pct = Math.round(clampPercent(cardInfo.progress || 0));
    const done = pct >= 100;
    card.className = `watch-engine-card tone-${watchTone}${done ? " is-done" : ""}`;
    card.style.setProperty("--watch-engine-hue", String(cardInfo.hue));
    const titleEl = card.querySelector(".watch-engine-title");
    const progressEl = card.querySelector(".watch-engine-progress");
    const fillEl = progressEl?.querySelector("span");
    const detailEl = card.querySelector(".watch-engine-detail");
    if (titleEl) {
      const titleText = `${cardInfo.title}`;
      if (titleEl.firstChild?.nodeType === 3) {
        if (titleEl.firstChild.nodeValue !== titleText) titleEl.firstChild.nodeValue = titleText;
      } else {
        titleEl.textContent = titleText;
      }
      // Live percentage badge — mirrors the tabular-nums readout the
      // notifications panel shows at the right edge of its bars.
      let pctEl = titleEl.querySelector(".watch-engine-percent");
      if (!pctEl) {
        pctEl = document.createElement("span");
        pctEl.className = "watch-engine-percent";
        titleEl.appendChild(pctEl);
      }
      const pctLabel = `${pct}%`;
      if (pctEl.textContent !== pctLabel) pctEl.textContent = pctLabel;
    }
    if (fillEl) {
      const nextWidth = `${pct}%`;
      if (fillEl.style.width !== nextWidth) fillEl.style.width = nextWidth;
    }
    if (detailEl) {
      const nextDetail = String(cardInfo.detail || "");
      if (detailEl.textContent !== nextDetail) detailEl.textContent = nextDetail;
      detailEl.hidden = !!compactDetail;
    }
  });
  // If there are stale extra children (e.g., after a behavior-setting toggle),
  // trim them so the grid stays exactly 4 cards.
  while (watchEngineGrid.children.length > cards.length) {
    watchEngineGrid.removeChild(watchEngineGrid.lastChild);
  }
  syncWatchProgressRotatorModule();
}

// CSSOS_PHASE2_P2_96_SUBTITLE_WEIGHT 20260424 #96 — classify a cue word
// as low-weight (function/particle/article) vs high-weight (content:
// noun/verb/adjective) for the line-split rendering below. Jing's spec
// says "樱花","盛开","季节" are HIGH while "在那","的" are LOW, and the
// two classes must render on separate lines. We treat unknown tokens as
// HIGH by default (most content words won't be in the particle set, and
// rendering them too-small is worse than rendering them too-large).
const CSSMV_LOW_WEIGHT_CN = new Set([
  "的","了","在","是","和","与","也","就","都","把","被","从","到","让","使",
  "在那","那里","这里","那儿","这儿","那","这","之","其","于","对","向","给",
  "个","些","过","么","呢","吧","吗","啊","哎","哦","哈","嗯","呀","耶",
  "不","没","没有","而","但","但是","虽然","如果","因为","所以","然后","就是",
  "有","又","还","再","很","太","最","只","只是","更","会","要","能","可以",
  "他","她","它","我","你","您","他们","她们","它们","我们","你们","咱们",
  "一","二","三","四","五","六","七","八","九","十","两",
]);
const CSSMV_LOW_WEIGHT_EN = new Set([
  "the","a","an","of","in","at","on","to","for","and","or","but","nor","yet",
  "is","are","was","were","be","been","being","am","'s","'re","'m","'ve","'ll",
  "i","you","he","she","it","we","they","me","him","her","us","them",
  "my","your","his","hers","its","our","their","mine","yours","ours","theirs",
  "this","that","these","those","there","here","where","when","who","which",
  "with","by","from","as","if","than","then","so","too","very","just","do","does",
  "not","no","don't","doesn't","didn't","won't","can't","cannot",
  "up","down","out","off","over","under","into","onto","about","above","below",
]);
function cssmvIsLowWeightWord(text) {
  const raw = String(text || "").trim();
  if (!raw) return true;
  // Pure punctuation / whitespace → low
  if (/^[\s\p{P}\p{S}]+$/u.test(raw)) return true;
  const lower = raw.toLowerCase();
  if (CSSMV_LOW_WEIGHT_EN.has(lower)) return true;
  if (CSSMV_LOW_WEIGHT_CN.has(raw)) return true;
  // Single CJK character that's a known particle
  if (raw.length === 1 && /[\u4e00-\u9fff]/.test(raw) && CSSMV_LOW_WEIGHT_CN.has(raw)) return true;
  return false;
}

function renderWatchKaraokeOverlayModule(progress = 0) {
  if (!watchKaraokeLine) return;
  const karaokeTimeline = Array.isArray(watchKaraokeTimelineCache?.data) ? watchKaraokeTimelineCache.data : [];
  const titleSplit = globalThis.splitLyricsTitleAndBodyModule?.(
    String(state.songSeed?.title || state.title || "").trim(),
    watchLyricsEditor?.value || state.songSeed?.lyrics || state.lines || []
  ) || { titleLine: "", bodyLines: [] };
  const titleLine = String(titleSplit?.titleLine || "").trim();
  const synthesizeCueWords = (cue) => {
    const text = String(cue?.text || "").trim();
    if (!text) return [];
    const parts = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text)
      ? text.split("").filter(Boolean)
      : text.split(/(\s+)/).filter((part) => String(part || "").trim());
    const start = Number(cue?.start_s || 0);
    const end = Math.max(start + 0.35, Number(cue?.end_s || start + 2.4));
    const step = (end - start) / Math.max(1, parts.length);
    return parts.map((part, index) => {
      const lower = String(part || "").toLowerCase();
      const emotion =
        /fire|ignite|burn|rise|shout|chorus/.test(lower) ? "ignite" :
        /dream|moon|night|echo|whisper|glow/.test(lower) ? "resolve" :
        /grief|lost|alone|tear|shadow/.test(lower) ? "intimate" :
        "";
      const emphasis =
        /!|fire|ignite|burn|rise|shout|chorus/.test(lower) ? 0.98 :
        /dream|moon|night|echo|whisper|glow/.test(lower) ? 0.72 :
        /grief|lost|alone|tear|shadow/.test(lower) ? 0.56 : 0.34;
      return {
        text: part,
        start_s: Number((start + index * step).toFixed(3)),
        end_s: Number((start + (index + 1) * step).toFixed(3)),
        emotion,
        emphasis
      };
    });
  };
  // CSSOS_PHASE2_KARAOKE_CLOCK_FIX 20260428 #165 — Jing
  // "字幕也还没有对齐，只显示第一行，就停了"
  // Old code preferred watchAudioPreview.currentTime — but after #166
  // we explicitly clear that element's src at runAll() start, and after
  // #164 the audio plays out of <video> (mp4 with muxed audio). So the
  // <audio> currentTime stays at 0 and the karaoke ticker is frozen
  // at the first cue. Prefer whichever media element is ACTIVELY
  // playing (not paused/ended) and has a real currentTime > 0; fall
  // back through video → audio → 0.
  const mediaClockSec = (() => {
    const v = watchVideo;
    const a = watchAudioPreview;
    const vt = Number(v?.currentTime || 0);
    const at = Number(a?.currentTime || 0);
    const vPlaying = v && !v.paused && !v.ended && vt > 0;
    const aPlaying = a && !a.paused && !a.ended && at > 0;
    if (vPlaying) return vt;
    if (aPlaying) return at;
    if (vt > 0) return vt;
    if (at > 0) return at;
    return 0;
  })();
  if (karaokeTimeline.length) {
    const activeIndex = Math.max(
      0,
      karaokeTimeline.findIndex((cue) => mediaClockSec >= Number(cue?.start_s || 0) && mediaClockSec <= Number(cue?.end_s || 0))
    );
    const resolvedIndex =
      activeIndex >= 0
        ? activeIndex
        : karaokeTimeline.findIndex((cue) => Number(cue?.start_s || 0) > mediaClockSec);
    const currentIndex =
      resolvedIndex >= 0
        ? resolvedIndex
        : Math.max(0, karaokeTimeline.length - 1);
    const prevCue = karaokeTimeline[Math.max(0, currentIndex - 1)] || null;
    let currentCue = karaokeTimeline[currentIndex] || karaokeTimeline[0] || null;
    const nextCue = karaokeTimeline[Math.min(karaokeTimeline.length - 1, currentIndex + 1)] || null;
    const cueWords =
      Array.isArray(currentCue?.words) && currentCue.words.length
        ? currentCue.words
        : synthesizeCueWords(currentCue);
    const cueText = String(currentCue?.text || "").trim();
    if (cueText === titleLine) {
      const nextPlayableCue =
        karaokeTimeline.slice(currentIndex + 1).find((cue) => String(cue?.text || "").trim() && String(cue?.text || "").trim() !== titleLine) ||
        karaokeTimeline.find((cue) => String(cue?.text || "").trim() && String(cue?.text || "").trim() !== titleLine) ||
        null;
      if (nextPlayableCue) {
        currentCue = nextPlayableCue;
      }
    }
    const resolvedCueText = String(currentCue?.text || "").trim();
    const cueEmotion = String(currentCue?.emotion || currentCue?.mood || currentCue?.tone || "").trim().toLowerCase();
    const inferredEmotion = cueEmotion ||
      (/fire|ignite|burn|rise|shout|chorus/i.test(resolvedCueText) ? "surge" :
      /dream|moon|night|echo|whisper|glow/i.test(resolvedCueText) ? "dream" :
      /grief|lost|alone|tear|shadow/i.test(resolvedCueText) ? "hush" : "steady");
    const activeWordIndex = Array.isArray(cueWords)
      ? cueWords.findIndex((word) => mediaClockSec >= Number(word?.start_s || 0) && mediaClockSec <= Number(word?.end_s || 0))
      : -1;
    // CSSOS_PHASE2_KARAOKE_FONT_PERSIST 20260420 #85 — pick a per-word font
    // from the overlay module's cached piece→font map. The map is invalidated
    // only on ✦ shuffle, so fonts stay stable across timeupdate-driven rebuilds
    // instead of bouncing between per-token and single-preset every frame.
    const pickPieceFont = (typeof globalThis.cssmvAssignFontForPiece === "function")
      ? globalThis.cssmvAssignFontForPiece
      : null;
    // CSSOS_PHASE2_KARAOKE_SINGLE_LINE 20260427 #153 — Jing
    // "图3，图4，两套字幕，看见了吗？旧的那套，多行显示，黑色，新的绿色的
    //  一行显示（后来要求恢复单行显示）"
    //
    // The previous P2-96 implementation grouped words into per-weight
    // <div class="watch-karaoke-row is-weight-{high|low}"> rows so
    // function-words ("the/of/in") stacked separately from content
    // words. That produced the vertical-stacked, multi-line block on
    // the left side of the media frame in images 3 and 4. Jing wants
    // a SINGLE-LINE karaoke render now (matches the restored bottom
    // subtitle from #120 / #125).
    //
    // Render all words as inline spans on one line. Active-word
    // highlighting + emotion classes + per-word fonts are preserved.
    // Word weight is no longer used for layout (it was only ever a
    // line-break trigger). The CSS classes is-weight-high / is-weight-low
    // are removed so any leftover styles in style.watch.css that targeted
    // them stop applying.
    const renderedCurrent = (() => {
      if (!(Array.isArray(cueWords) && cueWords.length)) {
        return escapeHtml(resolvedCueText);
      }
      const wordSpans = cueWords.map((word, index) => {
        const sung = mediaClockSec >= Number(word?.end_s || 0);
        const active =
          activeWordIndex >= 0
            ? index === activeWordIndex
            : mediaClockSec >= Number(word?.start_s || 0) && mediaClockSec <= Number(word?.end_s || 0);
        const cls = ["watch-karaoke-word"];
        const emotion = String(word?.emotion || "").trim().toLowerCase();
        const emphasis = Math.max(0, Math.min(1, Number(word?.emphasis || 0) || 0));
        const beatWeight = Math.max(
          emphasis,
          active ? watchMusicLiveEnergy * 0.72 + watchMusicLivePeak * 0.28 : emphasis * 0.7,
        );
        if (sung) cls.push("is-sung");
        if (active) cls.push("is-active");
        if (emotion) cls.push(`is-${emotion}`);
        const wordText = String(word?.text || "");
        const fam = pickPieceFont ? pickPieceFont(wordText) : "";
        const famCss = fam ? `;font-family:&quot;${String(fam).replace(/"/g, "&quot;")}&quot;, var(--watch-title-font-family, inherit)` : "";
        // Emit inline-flow spans separated by a thin space so the
        // browser keeps them on a single line up to the container's
        // max-width (white-space: nowrap on the parent does the rest).
        return `<span class="${cls.join(" ")}" style="--karaoke-word-emphasis:${emphasis.toFixed(3)};--karaoke-word-beat:${beatWeight.toFixed(3)}${famCss}">${escapeHtml(wordText)}</span>`;
      });
      return wordSpans.join(" ");
    })();
    watchKaraokeLine.dataset.emotion = inferredEmotion;
    watchSubtitle?.setAttribute("data-emotion", inferredEmotion);
    watchKaraokeLine.innerHTML = `
      ${prevCue && prevCue !== currentCue && String(prevCue?.text || "").trim() !== titleLine ? `<div class="watch-karaoke-prev">${escapeHtml(String(prevCue?.text || ""))}</div>` : ""}
      <div class="watch-karaoke-current ${mediaClockSec > 0 ? "is-active" : ""} is-${escapeHtml(inferredEmotion)}">${renderedCurrent}</div>
      ${nextCue && nextCue !== currentCue && String(nextCue?.text || "").trim() !== titleLine ? `<div class="watch-karaoke-next">${escapeHtml(String(nextCue?.text || ""))}</div>` : ""}
    `;
    // CSSOS_PHASE2_SUBTITLE_LYRIC_WRITE 20260426 #133 — Jing
    // "请继续修复普通字幕，放在媒体框底部中间…一句歌词，一行字幕"
    // The active sung lyric only used to land in #watch-karaoke-line. The
    // bottom-center #watch-subtitle stayed empty (or got cleared by the
    // status-redirect MutationObserver), so the user never saw a real
    // single-line subtitle. Push the plain text of the currently-singing
    // cue here too, tagged with `data-cssmv-origin="lyric"` so the redirect
    // observer in app.watch-media-layout-p2100.js bypasses its
    // looksLikeStatus filter and doesn't strip the lyric.
    if (watchSubtitle) {
      const oneLine = String(resolvedCueText || "").replace(/\s*\n+\s*/g, " ").trim();
      watchSubtitle.dataset.cssmvOrigin = "lyric";
      if (watchSubtitle.textContent !== oneLine) {
        safeSetWatchSubtitleModule(oneLine);
      }
    }
    return;
  }
  const lines = compactLyricLines(state.lines || [])
    .filter(Boolean)
    .filter((line) => String(line || "").trim() !== titleLine);
  if (!lines.length) {
    watchKaraokeLine.innerHTML = "";
    return;
  }
  const normalizedProgress = clampPercent(progress);
  const currentIndex = Math.min(lines.length - 1, Math.floor((normalizedProgress / 100) * lines.length));
  const prev = lines[Math.max(0, currentIndex - 1)] || "";
  const current = lines[currentIndex] || lines[0] || "";
  const next = lines[Math.min(lines.length - 1, currentIndex + 1)] || "";
  const inferredEmotion =
    /fire|ignite|burn|rise|shout|chorus/i.test(current) ? "surge" :
    /dream|moon|night|echo|whisper|glow/i.test(current) ? "dream" :
    /grief|lost|alone|tear|shadow/i.test(current) ? "hush" : "steady";
  watchKaraokeLine.dataset.emotion = inferredEmotion;
  watchSubtitle?.setAttribute("data-emotion", inferredEmotion);
  watchKaraokeLine.innerHTML = `
    ${prev && prev !== current ? `<div class="watch-karaoke-prev">${escapeHtml(prev)}</div>` : ""}
    <div class="watch-karaoke-current ${normalizedProgress > 0 ? "is-active" : ""} is-${escapeHtml(inferredEmotion)}">${escapeHtml(current)}</div>
    ${next && next !== current ? `<div class="watch-karaoke-next">${escapeHtml(next)}</div>` : ""}
  `;
  // CSSOS_PHASE2_SUBTITLE_LYRIC_WRITE 20260426 #133 — see explanation above
  // the cueWords branch. Same fix on the no-word-timing fallback path.
  if (watchSubtitle) {
    const oneLine = String(current || "").replace(/\s*\n+\s*/g, " ").trim();
    watchSubtitle.dataset.cssmvOrigin = "lyric";
    if (watchSubtitle.textContent !== oneLine) {
      safeSetWatchSubtitleModule(oneLine);
    }
  }
}

function hasWatchExplicitPreviewIntent() {
  return Number(globalThis.watchExplicitPreviewAllowedUntil || 0) > Date.now();
}

function canUseWatchDemoFallback() {
  return !!watchPanel && !watchPanel.classList.contains("hidden") && hasWatchExplicitPreviewIntent();
}

const closeEnjoyOverlay = () => {
  const overlay = document.getElementById("mv-overlay");
  if (!overlay) return;
  const video = overlay.querySelector("video");
  if (video) {
    video.pause?.();
    video.removeAttribute("src");
    video.load?.();
  }
  overlay.classList.remove("show");
};

const showEnjoyOverlay = (url, labelText = "") => {
  let overlay = document.getElementById("mv-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "mv-overlay";
    overlay.className = "mv-overlay";
    overlay.innerHTML = `
      <div class="mv-overlay-inner">
        <div class="mv-overlay-label" style="position:absolute;top:10px;left:14px;color:rgba(255,255,255,0.85);font-size:12px;letter-spacing:0.18em;text-transform:uppercase;display:none;">demo</div>
        <button type="button" class="mv-overlay-close">${t("overlay.close")}</button>
        <video class="mv-overlay-video" autoplay loop playsinline controls></video>
      </div>
    `;
    document.body.appendChild(overlay);
    const closeBtn = overlay.querySelector(".mv-overlay-close");
    closeBtn?.addEventListener("click", closeEnjoyOverlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeEnjoyOverlay();
    });
  }
  const label = overlay.querySelector(".mv-overlay-label");
  if (label) {
    if (labelText) {
      label.textContent = labelText;
      label.style.display = "block";
    } else {
      label.style.display = "none";
    }
  }
  const video = overlay.querySelector("video");
  if (video) {
    video.src = url;
    video.muted = false;
    video.playsInline = true;
    video.load?.();
    video.play?.().catch(() => {});
  }
  overlay.classList.add("show");
};

const DEMO_BASES = ["/assets/examples/", "/examples/"];
const DEMO_MANIFESTS = ["/api/example-assets/manifest?kind=all"];
const DEMO_MV_FILES = [
  "19700121_0706_69982ff105c48191a0e4f69bdf19f49e.mp4",
  "M6N0t1rbV74_002_720p.mp4",
  "The.Curse.mp4",
  "The.Register.of.Souls.mp4",
  "YTDown.com_YouTube_Media_M6N0t1rbV74_002_720p.mp4",
  "YTDown.com_YouTube_Media_dKWwe0hbKvc_002_720p.mp4",
  "YTDown.com_YouTube_Media_pKnnjgJTwhU_002_720p.mp4",
  "YTDown.com_YouTube_Media_y1EBKVq5N9Q_002_720p.mp4",
  "YTDown.com_YouTube_Real-Frontier-17_Media_mFGFzCP_fYM_002_720p.mp4",
  "mirror-video.MP4"
];
const DEMO_AUDIO_FILES = [
  "Brothers.Sacred.Song.我替你挡住世界.mp3",
  "Cai.Wei.采薇.mp3",
  "The.Arrival.at.the.Celestial.Court .登天庭问道.mp3",
  "The.Door.That.Smelled.of.Ink.墨香之门.mp3",
  "Weeping.Down.The.Wall.哭倒长城.mp3",
  "长相思·一重山.mp3"
];

let demoMvCache = null;
let demoAudioCache = null;
const normalizeDemoManifestEntries = (payload) => {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
      ? payload.map((value) => ({ name: String(value || "").trim() }))
      : Array.isArray(payload?.files)
        ? payload.files.map((value) => ({ name: String(value || "").trim() }))
        : [];
  return items
    .map((entry) => {
      const name = String(entry?.name || entry?.file || "").trim();
      const url = String(entry?.url || "").trim();
      if (!name) return null;
      return { name, url };
    })
    .filter(Boolean);
};
const getDemoMvFiles = async () => {
  if (demoMvCache && Array.isArray(demoMvCache) && demoMvCache.length) return demoMvCache;
  for (const url of DEMO_MANIFESTS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const mp4s = normalizeDemoManifestEntries(data).filter((entry) => entry.name.toLowerCase().endsWith(".mp4"));
      if (mp4s.length) {
        demoMvCache = mp4s;
        return demoMvCache;
      }
    } catch (_err) {
      // ignore manifest errors
    }
  }
  demoMvCache = DEMO_MV_FILES.map((name) => ({ name, url: "" }));
  return demoMvCache;
};

const getDemoAudioFiles = async () => {
  if (demoAudioCache && Array.isArray(demoAudioCache) && demoAudioCache.length) return demoAudioCache;
  for (const url of DEMO_MANIFESTS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const audioFiles = normalizeDemoManifestEntries(data).filter((entry) => /\.(mp3|m4a|aac|ogg)$/i.test(entry.name));
      if (audioFiles.length) {
        demoAudioCache = audioFiles;
        return demoAudioCache;
      }
    } catch (_err) {
      // ignore manifest errors
    }
  }
  demoAudioCache = DEMO_AUDIO_FILES.map((name) => ({ name, url: "" }));
  return demoAudioCache;
};

const buildExampleAssetCandidates = (entry) => {
  const directUrl = String(entry?.url || "").trim();
  const name = String(entry?.name || "").trim();
  if (directUrl) return [directUrl];
  return [buildExampleAssetProxyUrl(name), ...DEMO_BASES.map((base) => `${base}${name}`)].filter(Boolean);
};

const pickFirstWorkingUrl = async (files) => {
  const shuffled = files.slice().sort(() => Math.random() - 0.5);
  for (const entry of shuffled) {
    const candidates = buildExampleAssetCandidates(entry);
    for (const url of candidates) {
      try {
        let res = await fetch(url, { method: "HEAD" });
        if (!res.ok) {
          res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
        }
        if (res.status === 200 || res.status === 206) return url;
      } catch (_err) {
        // ignore
      }
    }
  }
  return "";
};

const isMediaReachable = async (url) => {
  if (!url) return false;
  try {
    let res = await fetch(url, { method: "HEAD" });
    if (!res.ok) {
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
    }
    return res.status === 200 || res.status === 206;
  } catch (_err) {
    return false;
  }
};

const showEnjoyOverlaySafe = async (url, labelText = "") => {
  const ok = await isMediaReachable(url);
  if (!ok) return false;
  showEnjoyOverlay(url, labelText);
  return true;
};

const playDemoMV = async () => {
  showToast(t("mic.no_data_demo"));
  const files = await getDemoMvFiles();
  const url = await pickFirstWorkingUrl(files);
  if (url) {
    showEnjoyOverlay(url, t("mic.demo_label"));
    return;
  }
  showToast(t("mic.no_demo_found"));
};

const playDemoMedia = () => {
  syncWatchPlaceholderFromCurrentState();
  showToast(t("mic.generation_failed_playing_demo"));
};

function resolvePreferredWatchOpenTab(fallback = "mv") {
  const configured = String(readPanelBehaviorSettingsLocal()?.watch?.default_tab || watchActiveTab || fallback || "mv").trim();
  if (["mv", "music", "lyrics", "script", "comments", "revenue", "ownership"].includes(configured)) {
    return configured;
  }
  return "mv";
}

function flattenWatchPlaybackWorksModule(work = {}) {
  if (!work || typeof work !== "object") return [];
  const children = Array.isArray(work.children) ? work.children : [];
  if (!children.length) return [work];
  const flattenedChildren = children.flatMap((child) => flattenWatchPlaybackWorksModule(child));
  return flattenedChildren.length ? flattenedChildren : [work];
}

function sortWatchWorksNewestFirstModule(works = []) {
  return [...(Array.isArray(works) ? works : [])].sort((left, right) => {
    const leftTime = Date.parse(String(left?.updated_at || left?.created_at || "")) || 0;
    const rightTime = Date.parse(String(right?.updated_at || right?.created_at || "")) || 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return String(right?.title || "").localeCompare(String(left?.title || ""));
  });
}

function getLatestOwnedPlaybackQueueModule() {
  const works = Array.isArray(watchCommerceState?.payload?.ownership?.works)
    ? watchCommerceState.payload.ownership.works
    : [];
  const flattened = sortWatchWorksNewestFirstModule(
    works.flatMap((work) => flattenWatchPlaybackWorksModule(work)).filter(Boolean)
  );
  if (!flattened.length) return null;
  return {
    rootWork: { title: loginCopy("Latest works") },
    items: flattened.map((item) => ({ ...(item || {}) })),
    index: 0
  };
}

async function openLatestOwnedWorkPreviewModule() {
  const creationBusy = !!globalThis.isCreationBusyModule?.();
  const lyricsPending = !!globalThis.lyricsSeedRequestState?.pending;
  if (creationBusy || lyricsPending || hasBlockingWatchSeedModule()) return false;
  if (!watchCommerceState.loaded && !watchCommerceState.loading && authState.user) {
    await loadWatchCommerceStateModule?.().catch(() => null);
  }
  let queue = getLatestOwnedPlaybackQueueModule();
  // W345 20260523 — Jing: commerce state 为空(未登录或未加载)时, 改从
  // /api/works/market 取最新作品. market API 每次都返回新鲜的签名 URL,
  // 不会因本地缓存过期而 403. 最多取 3 首, 取第一首即最新作品.
  if (!queue?.items?.length) {
    try {
      const _mRes = await fetch("/api/works/market?limit=3&offset=0");
      if (_mRes.ok) {
        const _mData = await _mRes.json();
        const _mWorks = Array.isArray(_mData?.data?.works) ? _mData.data.works
          : Array.isArray(_mData?.works) ? _mData.works : [];
        if (_mWorks.length) {
          queue = {
            rootWork: { title: loginCopy("Latest works") },
            items: _mWorks.map((w) => ({ ...w })),
            index: 0,
          };
        }
      }
    } catch (_e) { /* non-fatal, fall through */ }
  }
  if (!queue?.items?.length) return false;
  globalThis.currentStructuredWatchQueue = queue;
  const latestWork = queue.items[0];
  currentWatchPreviewWork = latestWork;
  // CSSOS_WAVE_330 20260522 — Jing: 进入即【绑定最新作品标题】(不要显示面板名 "Watch")
  // + 【锁定单张封面】(把 artwork 变体池设为这一张 → 进场不再多图乱闪/随机轮播).
  try {
    const _lt = String(latestWork?.title || "").trim();
    if (_lt) state.title = _lt;
    const _cov = String(
      latestWork?.cover_image || latestWork?.cover_url || latestWork?.preview_image_url || ""
    ).trim();
    if (_cov && !/^data:image\/svg\+xml/i.test(_cov)) {
      globalThis.currentResolvedWatchArtworkDataUrl = _cov;
      globalThis.currentWatchArtworkVariantPool = [_cov];
      // CSSOS_WAVE_333 20260522 — Jing: 直接把【一张稳定封面】绑到常驻背景层
      // #watch-screen-backdrop. 走缩略图代理(img-thumb 会缓存一份, 即使原 replicate
      // 临时链接过期也照常显示) → 背景图稳定常驻, 前景/幻灯怎么变都不影响这一张.
      const _bd = document.getElementById("watch-screen-backdrop");
      if (_bd) {
        const _stable = (typeof globalThis.cssosThumb === "function")
          ? globalThis.cssosThumb(_cov, 800) : _cov;
        _bd.style.backgroundImage = `url("${String(_stable).replace(/"/g, '\\"')}")`;
        _bd.style.backgroundSize = "cover";
        _bd.style.backgroundPosition = "center";
      }
      // CSSOS_WAVE_335 20260522 — Jing: 防"黑屏让用户傻等". 空的 <video>(无真实可播
      // src)是 display:block 会用一块黑盖住封面(纯音乐作品没视频时尤甚). 进入时若视频
      // 还没真实 src → 先隐藏视频, 让稳定封面/背景透出来; 真有视频能播时(setWatch-
      // VideoFromArtifact)再显示. 这样要么稳定封面、要么播视频, 绝不留黑屏.
      const _v = document.getElementById("watch-video");
      if (_v) {
        const _vs = String(_v.getAttribute("src") || _v.src || "").trim();
        if (!_vs || /^data:image\/svg/i.test(_vs)) { _v.style.display = "none"; }
      }
    }
  } catch (_e) { /* non-fatal */ }
  globalThis.cssosBindToWorkId?.(latestWork); // CSSOS_WAVE_121 Step 2
  const sourceRunId = String(latestWork?.source_run_id || "").trim();
  if (sourceRunId) currentWatchAudioRunId = sourceRunId;
  await renderMarketWorkPreviewIntoWatchModule({
    work: latestWork,
    seed: buildMarketPreviewSeed(latestWork),
    previewUnlimited: canBypassPreviewLimit(authState.user, latestWork)
  });
  // CSSOS_WAVE_341 20260522 — Jing: 进入只挂了封面/标题, 却没挂音频 → "音乐没跟着来".
  // 这里把作品音轨挂到 watch-audio-preview 并尝试自动播放: 先尝试带声(若浏览器允许),
  // 被自动播放策略拦截 → 静音重试 + 标 pending-unmute(用户首触即解锁声音, W279)+ 提示.
  try {
    const _aEl = document.getElementById("watch-audio-preview");
    const _a1 = String(latestWork?.audio_track_1_url || latestWork?.audio_track_2_url || "").trim();
    if (_aEl && _a1 && !/^data:/i.test(_a1)) {
      if (String(_aEl.getAttribute("src") || "") !== _a1) {
        _aEl.src = _a1; _aEl.preload = "auto"; if (typeof _aEl.load === "function") _aEl.load();
      }
      _aEl.muted = false;
      const _pp = _aEl.play && _aEl.play();
      if (_pp && typeof _pp.catch === "function") {
        _pp.catch(function () {
          try {
            _aEl.muted = true;
            globalThis.__cssosWatchPendingUnmute = true;
            const _p2 = _aEl.play && _aEl.play();
            if (_p2 && typeof _p2.catch === "function") _p2.catch(function () {});
            if (typeof globalThis.showWatchSoundHintModule === "function") globalThis.showWatchSoundHintModule();
          } catch (_e2) {}
        });
      }
    }
  } catch (_e) { /* non-fatal: 音乐挂载尽力而为 */ }
  return true;
}

function isTeslaWatchEnvironmentModule() {
  const ua = String(navigator?.userAgent || "").toLowerCase();
  return ua.includes("tesla") || ua.includes("qtcarbrowser");
}

function isMobileWatchEnvironmentModule() {
  try {
    const hint = navigator?.userAgentData?.mobile;
    if (typeof hint === "boolean") return hint;
  } catch (_err) {
    // userAgentData unsupported — fall through to UA sniff.
  }
  const ua = String(navigator?.userAgent || "").toLowerCase();
  if (!ua) return false;
  if (/iphone|ipod/.test(ua)) return true;
  if (/ipad/.test(ua)) return true;
  if (/android/.test(ua) && /mobile|tablet/.test(ua)) return true;
  if (/blackberry|bb10|meego|mobile|silk|webos|opera mini|opera mobi|windows phone/.test(ua)) return true;
  // iPadOS 13+ reports as Mac; detect via touch.
  if (/macintosh/.test(ua) && typeof navigator?.maxTouchPoints === "number" && navigator.maxTouchPoints > 1) return true;
  return false;
}

function isAutoplayRestrictedWatchEnvironmentModule() {
  return isTeslaWatchEnvironmentModule() || isMobileWatchEnvironmentModule();
}
globalThis.isAutoplayRestrictedWatchEnvironmentModule = isAutoplayRestrictedWatchEnvironmentModule;

function setWatchDetailsRevealModule(revealed) {
  watchDetailsReveal = revealed === true;
  if (!watchPanel) return;
  const body = watchPanel.querySelector(".watch-body");
  if (!(body instanceof HTMLElement)) return;
  body.classList.toggle("watch-details-revealed", watchDetailsReveal);
  body.classList.toggle("watch-immersive", !watchDetailsReveal);
}

function markWatchAutoRecoveryAttemptModule(stageKey = "") {
  watchAutoRecoveryKey = `${String(currentWatchAudioRunId || activePipelineRunId || pendingFinalAudioRunId || state.title || "default").trim()}::${String(stageKey || "").trim()}`;
  watchAutoRecoveryStartedAt = Date.now();
}

function canAutoRecoverWatchStageModule(stageKey = "") {
  const nextKey = `${String(currentWatchAudioRunId || activePipelineRunId || pendingFinalAudioRunId || state.title || "default").trim()}::${String(stageKey || "").trim()}`;
  if (!nextKey.trim()) return false;
  if (watchAutoRecoveryKey !== nextKey) return true;
  return Date.now() - watchAutoRecoveryStartedAt > 30000;
}

async function autoRecoverWatchStageModule(stageKey = "lyrics") {
  if (!canAutoRecoverWatchStageModule(stageKey)) return false;
  markWatchAutoRecoveryAttemptModule(stageKey);
  return continueWatchGenerationStageModule(stageKey);
}

function scrollWatchBodyToActiveMediaFrameModule({ behavior = "auto" } = {}) {
  if (!watchPanel) return;
  const body = watchPanel.querySelector(".watch-body");
  if (!(body instanceof HTMLElement)) return;
  const target = body.querySelector(
    '.watch-pane.active .watch-frame, .watch-pane.active .watch-music-stage'
  );
  if (!(target instanceof HTMLElement)) return;
  const nextTop = Math.max(0, target.offsetTop - 8);
  if (typeof body.scrollTo === "function") {
    body.scrollTo({ top: nextTop, behavior });
    return;
  }
  body.scrollTop = nextTop;
}

function initWatchImmersiveScrollModule() {
  const body = watchPanel?.querySelector(".watch-body");
  if (!(body instanceof HTMLElement) || body.dataset.immersiveBound === "true") return;
  body.dataset.immersiveBound = "true";
  setWatchDetailsRevealModule(false);
  scrollWatchBodyToActiveMediaFrameModule();
  body.addEventListener("wheel", (event) => {
    if (Math.abs(Number(event.deltaY || 0)) < 12) return;
    setWatchDetailsRevealModule(Number(event.deltaY || 0) < 0);
  }, { passive: true });
  body.addEventListener("touchstart", (event) => {
    watchTouchStartY = Number(event.touches?.[0]?.clientY || 0);
  }, { passive: true });
  body.addEventListener("touchmove", (event) => {
    const nextY = Number(event.touches?.[0]?.clientY || 0);
    if (!nextY || !watchTouchStartY) return;
    const delta = nextY - watchTouchStartY;
    if (Math.abs(delta) < 14) return;
    setWatchDetailsRevealModule(delta > 0);
  }, { passive: true });
}

function getWatchProgressCardsModule() {
  return [
    {
      key: "lyrics",
      label: loginCopy("Lyrics generation"),
      progress: currentLyricsProgressPercentModule(),
      done: typingState.completed && !isLyricsProgressStillPinnedModule()
    },
    {
      key: "music",
      label: loginCopy("Music generation"),
      progress: engineProgressState.music,
      done: Number(engineProgressState.music || 0) >= 100
    },
    {
      key: "video",
      label: loginCopy("Video generation"),
      progress: engineProgressState.video,
      done: Number(engineProgressState.video || 0) >= 100
    },
    {
      key: "kara",
      label: loginCopy("MV render"),
      progress: engineProgressState.kara,
      done: Number(engineProgressState.kara || 0) >= 100
    }
  ].filter((entry) => !entry.done);
}

function getActiveWatchProgressCardModule() {
  const allCards = [
    {
      key: "lyrics",
      label: t("watch.progress.lyrics").replace(/\s*0%$/, ""),
      progress: currentLyricsProgressPercentModule(),
      done:
        (typingState.completed && !isLyricsProgressStillPinnedModule()) ||
        (currentLyricsProgressPercentModule() >= 100 && !isLyricsProgressStillPinnedModule())
    },
    {
      key: "music",
      label: t("watch.progress.music"),
      progress: engineProgressState.music,
      done: Number(engineProgressState.music || 0) >= 100
    },
    {
      key: "video",
      label: t("watch.progress.video"),
      progress: engineProgressState.video,
      done: Number(engineProgressState.video || 0) >= 100
    },
    {
      key: "kara",
      label: t("watch.progress.kara"),
      progress: engineProgressState.kara,
      done: Number(engineProgressState.kara || 0) >= 100
    }
  ];
  const liveCards = allCards.filter((entry) => !entry.done);
  if (!liveCards.length) return null;
  // CSSOS_PHASE2_HEADERPCT 20260420 — prefer stages that have actually
  // started (progress > 0) so the rotator can never land on a zeroed stage
  // while other stages are already reporting realtime progress. If none of
  // the non-done stages have started yet, fall back to the full list.
  const startedCards = liveCards.filter(
    (entry) => Number(entry.progress || 0) > 0
  );
  const pool = startedCards.length ? startedCards : liveCards;
  const rotateIndex = Math.floor(Date.now() / WATCH_PROGRESS_ROTATE_MS) % pool.length;
  return pool[rotateIndex] || pool[0] || null;
}

function broadcastWatchProgressToNotificationsModule(stageLabel = "") {
  const runId = String(getCurrentInFlightWatchRunIdModule() || "").trim();
  if (!runId) return;
  // Resolve the 6-stage progress snapshot once; we dispatch it to the
  // notifications panel AND push it directly into the chase-border stage
  // bars so the two panels always agree even if the MV-pipeline panel
  // state machine is idle or out of sync.
  const stageProgress = {
    // CSSOS_PHASE2_6STAGE 20260419 — notifications panel renders 6
    // bars now (cover/lyrics/music/video/subtitles/compose). Emit the
    // new keys alongside legacy `kara` so older readers keep working.
    // `compose` mirrors `kara` since both describe the final MV
    // assembly stage.
    cover: Math.round(Number(engineProgressState.cover || engineProgressState.thumbnail || 0)),
    lyrics: Math.round(currentLyricsProgressPercentModule?.() || 0),
    music: Math.round(Number(engineProgressState.music || 0)),
    video: Math.round(Number(engineProgressState.video || 0)),
    subtitles: Math.round(Number(engineProgressState.subtitles || 0)),
    compose: Math.round(Number(engineProgressState.compose || engineProgressState.kara || 0)),
    kara: Math.round(Number(engineProgressState.kara || 0)),
  };
  window.dispatchEvent(
    new CustomEvent("cssos:run_progress", {
      detail: {
        run_id: runId,
        title: String(state.title || currentWatchPreviewWork?.title || "").trim(),
        stage_label: String(stageLabel || "").trim(),
        progress: stageProgress
      }
    })
  );
  // Bridge to chase-border stage bars directly. This guarantees the bars
  // advance AND persist in lockstep with the engines, independent of the
  // MV-pipeline panel's internal state machine.
  try {
    const setBar = globalThis.cssmvStageBarsSetProgress;
    const setDone = globalThis.cssmvStageBarsSetDone;
    if (typeof setBar === "function") {
      ["cover", "lyrics", "music", "video", "subtitles", "compose"].forEach((key) => {
        const pct = Math.max(0, Math.min(100, Number(stageProgress[key] || 0)));
        setBar(key, pct);
        if (pct >= 100 && typeof setDone === "function") {
          setDone(key);
        }
      });
    }
  } catch (_err) {}
}

function syncWatchProgressRotatorModule() {
  const activeCard = getActiveWatchProgressCardModule();
  if (activeCard) {
    watchProgressLastCard = { ...activeCard };
  }
  const fallbackStageKey = String(watchProgressStageKey || "kara").trim() || "kara";
  const fallbackLabel = t(`watch.progress.${fallbackStageKey}`) || fallbackStageKey;
  const fallbackCard =
    watchProgressLastCard ||
    {
      key: fallbackStageKey,
      label: fallbackLabel,
      progress: Math.max(
        0,
        Math.min(
          100,
          Number(
            fallbackStageKey === "lyrics"
              ? currentLyricsProgressPercentModule?.() || 0
              : engineProgressState[fallbackStageKey] || 0
          )
        )
      )
    };
  const resolvedCard = activeCard || fallbackCard;
  const progressShells = [
    {
      shell: watchFrameProgress,
      fill: watchFrameProgressFill,
      copy: watchFrameProgressCopy,
      host: watchScreen,
    },
    {
      shell: typeof watchMusicFrameProgress !== "undefined" ? watchMusicFrameProgress : null,
      fill: typeof watchMusicFrameProgressFill !== "undefined" ? watchMusicFrameProgressFill : null,
      copy: typeof watchMusicFrameProgressCopy !== "undefined" ? watchMusicFrameProgressCopy : null,
      host: watchMusicStage,
    },
  ].filter((entry) => entry.shell && entry.fill && entry.copy);
  if (!progressShells.length) return;
  if (watchPlaybackUiSuppressed) {
    progressShells.forEach(({ shell }) => {
      shell.hidden = true;
    });
    if (watchPanelProgressLine) watchPanelProgressLine.hidden = true;
    return;
  }
  if (!resolvedCard) {
    progressShells.forEach(({ shell, host }) => {
      shell.hidden = true;
      host?.classList?.remove?.("is-waiting", "is-stalled");
    });
    if (watchPanelProgressLine) {
      watchPanelProgressLine.hidden = true;
    }
    watchScreen?.classList.add("is-live-border");
    watchScreen?.classList.remove("is-waiting", "is-stalled");
    if (watchOverlayPlay) {
      watchOverlayPlay.dataset.actionMode = "play";
      watchOverlayPlay.title = getCurrentWatchActionLabelModule();
      watchOverlayPlay.setAttribute("aria-label", watchOverlayPlay.title);
    }
    if (watchMusicPlay) {
      watchMusicPlay.dataset.actionMode = "play";
      watchMusicPlay.title = getCurrentWatchActionLabelModule();
      watchMusicPlay.setAttribute("aria-label", watchMusicPlay.title);
    }
    return;
  }
  progressShells.forEach(({ shell }) => {
    shell.hidden = false;
  });
  if (watchPanelProgressLine) {
    watchPanelProgressLine.hidden = false;
  }
  if (activeCard) {
    watchScreen?.classList.add("is-waiting");
    watchScreen?.classList.remove("is-live-border");
    watchMusicStage?.classList.add("is-waiting");
  } else {
    watchScreen?.classList.remove("is-waiting", "is-stalled");
    watchScreen?.classList.add("is-live-border");
    watchMusicStage?.classList.remove("is-waiting", "is-stalled");
  }
  const percent = Math.round(clampPercent(resolvedCard.progress || 0));
  const actionableStage = resolveWatchRecoveryStageModule(
    getNextWatchGenerationGapModule() || resolvedCard.key || "lyrics"
  );
  if (watchPanelProgressFill) {
    watchPanelProgressFill.style.width = `${Math.max(0, percent)}%`;
    const stageColor =
      resolvedCard.key === "music"
        ? "#25d4ff"
        : resolvedCard.key === "video"
          ? "#ff9f67"
          : resolvedCard.key === "kara"
            ? "#8d7bff"
            : "#00f5a0";
    watchPanelProgressFill.style.setProperty("--panel-progress-color", stageColor);
  }
  const visiblePercent = Math.max(0, percent);
  progressShells.forEach(({ fill, copy }) => {
    fill.style.width = `${visiblePercent}%`;
    // P2-32: 媒体框下方的 "${label} ${percent}%" 文字提示已由 Watch 面板标题替代（避免重复提示），
    // 仅保留进度条填充作为视觉反馈。
    if (copy) {
      if (copy.textContent !== "") copy.textContent = "";
      if (copy.style.display !== "none") copy.style.display = "none";
    }
  });
  const watchPanelTitle = document.querySelector("#watch-panel .panel-title");
  if (watchPanelTitle) {
    const titleText = String(state.songSeed?.title || state.title || "").trim();
    const fallbackTitle = loginCopy("Untitled");
    // CSSOS_PHASE2_TITLE_BAR_LIVE_PCT 20260426 #128 — Jing
    // Prefer the MV Pipeline panel's own per-stage progress over this
    // module's `resolvedCard.progress` (which lives in a separate state
    // machine and can lag behind the actual stage). When the pipeline
    // exposes an active stage we render `Cover 35%` style status from
    // its real-time pct; otherwise fall back to the legacy resolvedCard
    // path so non-pipeline runs (loaded works, market plays) still work.
    let statusLabel;
    let livePipeline = null;
    try {
      if (typeof globalThis.cssmvPipelineActiveStage === "function") {
        livePipeline = globalThis.cssmvPipelineActiveStage();
      }
    } catch (_e) { /* ignore */ }
    if (livePipeline) {
      if (livePipeline.hasError) {
        statusLabel = `${livePipeline.label} · ${loginCopy("Failed", "失败")}`;
      } else if (livePipeline.finished && livePipeline.stageId === "compose") {
        statusLabel = loginCopy("Complete");
      } else if (livePipeline.finished) {
        // Last finished stage but pipeline not done overall — show "x done · waiting next".
        statusLabel = `${livePipeline.label} ${livePipeline.pct}%`;
      } else {
        statusLabel = `${livePipeline.label} ${livePipeline.pct}%`;
      }
    } else {
      statusLabel =
        percent >= 100
          ? loginCopy("Complete")
          : `${resolvedCard.label} ${percent}%`;
    }
    // CSSOS_PHASE2_CLEAN_TITLE 20260501 #257 — Jing
    // "能够进入Watch MV面板播放的，应该也必须是完整的作品，所以这时候
    //  不必要再有这些信息：Video 0%这类的，直接就是：▶ Watch · 作品标题."
    //
    // If the pipeline is finished or this work is being played from a
    // saved row (no live pipeline), drop the status label entirely —
    // the user's playing a complete work, the percent is meaningless.
    // Only show "Watch · {title} · {status}" while the pipeline is
    // actively cooking something new.
    const pipelineActive = !!(livePipeline && !livePipeline.finished && !livePipeline.hasError);
    if (pipelineActive) {
      watchPanelTitle.textContent = `${loginCopy("Watch")} · ${
        titleText || fallbackTitle
      } · ${statusLabel}`;
    } else {
      watchPanelTitle.textContent = `${loginCopy("Watch")} · ${
        titleText || fallbackTitle
      }`;
    }
  }
  broadcastWatchProgressToNotificationsModule(`${resolvedCard.label} ${percent}%`);
  const lyricsRequestPending = !!globalThis.lyricsSeedRequestState?.pending;
  const fingerprint = `${resolvedCard.key}:${percent}`;
  if (fingerprint !== watchProgressLastFingerprint) {
    watchProgressLastFingerprint = fingerprint;
    watchProgressLastChangeAt = Date.now();
    watchProgressStageKey = resolvedCard.key;
    watchScreen?.classList.remove("is-stalled");
    watchMusicStage?.classList.remove("is-stalled");
    const activeKeyFingerprint = activeCard?.key ? `::${activeCard.key}` : "";
    if (!activeKeyFingerprint || !watchAutoRecoveryKey.includes(activeKeyFingerprint)) {
      watchAutoRecoveryKey = "";
      watchAutoRecoveryStartedAt = 0;
    }
  } else if (
    activeCard &&
    !(activeCard.key === "lyrics" && lyricsRequestPending) &&
    Date.now() - watchProgressLastChangeAt >= WATCH_PROGRESS_STALL_MS
  ) {
    watchScreen?.classList.add("is-stalled");
    watchMusicStage?.classList.add("is-stalled");
    void autoRecoverWatchStageModule(activeCard.key);
  }
  if (watchOverlayPlay) {
    watchOverlayPlay.classList.add("is-generating");
    watchOverlayPlay.dataset.actionMode = actionableStage;
    watchOverlayPlay.title = getWatchProgressActionLabelModule(actionableStage);
    watchOverlayPlay.setAttribute("aria-label", watchOverlayPlay.title);
  }
  if (watchMusicPlay) {
    watchMusicPlay.classList.add("is-generating");
    watchMusicPlay.dataset.actionMode = actionableStage;
    watchMusicPlay.title = getWatchProgressActionLabelModule(actionableStage);
    watchMusicPlay.setAttribute("aria-label", watchMusicPlay.title);
  }
}

function ensureWatchProgressRotatorModule() {
  syncWatchProgressRotatorModule();
}

function getWatchCommentContextKeyModule() {
  return String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || state.title || "default").trim() || "default";
}

function loadWatchCommentsModule() {
  try {
    const payload = JSON.parse(localStorage.getItem(WATCH_COMMENTS_STORAGE_KEY) || "{}");
    const key = getWatchCommentContextKeyModule();
    watchCommentsState = Array.isArray(payload?.[key]) ? payload[key] : [];
  } catch (_err) {
    watchCommentsState = [];
  }
}

function persistWatchCommentsModule() {
  try {
    const payload = JSON.parse(localStorage.getItem(WATCH_COMMENTS_STORAGE_KEY) || "{}");
    payload[getWatchCommentContextKeyModule()] = watchCommentsState.slice(0, 40);
    localStorage.setItem(WATCH_COMMENTS_STORAGE_KEY, JSON.stringify(payload));
  } catch (_err) {
    // ignore
  }
}

function renderWatchCommentsModule() {
  if (watchCommentsCopy) {
    watchCommentsCopy.textContent = watchCommentsState.length
      ? loginCopy("Live comments are on.")
      : t("watch.comments.empty");
  }
  if (!watchCommentsList) return;
  if (!watchCommentsState.length) {
    watchCommentsList.innerHTML = `<div class="watch-activity-empty">${escapeHtml(t("watch.comments.empty"))}</div>`;
    return;
  }
  watchCommentsList.innerHTML = watchCommentsState
    .slice()
    .reverse()
    .map((entry) => `
      <div class="watch-activity-item">
        <div class="watch-activity-title">${escapeHtml(String(entry?.text || ""))}</div>
        <div class="watch-activity-meta">${escapeHtml(String(entry?.author || loginCopy("Guest")))} · ${escapeHtml(String(entry?.createdAt || ""))}</div>
      </div>
    `)
    .join("");
}

function submitWatchCommentModule() {
  const text = String(watchCommentInput?.value || "").trim();
  if (!text) return false;
  watchCommentsState.push({
    text,
    author: String(authState?.user?.email || authState?.user?.name || loginCopy("Guest")).trim(),
    createdAt: formatDateTime(new Date().toISOString())
  });
  persistWatchCommentsModule();
  renderWatchCommentsModule();
  if (watchCommentInput) watchCommentInput.value = "";
  return true;
}

function syncWatchMusicArtworkBlurModule() {
  if (!watchMusicStage || !watchMusicArtBlur) return;
  const enabled = watchMusicArtBlur.checked;
  watchMusicStage.classList.toggle("is-artwork-sharp", !enabled);
  try {
    localStorage.setItem(WATCH_MUSIC_ART_BLUR_KEY, enabled ? "true" : "false");
  } catch (_err) {
    // Safari/Tesla-style constrained browsers can reject storage writes when quota is unavailable.
  }
}

function fallbackWatchPlaybackToMusicModule(reason = "") {
  // CSSOS_PHASE2_HORROR_AUDIO_GUARD 20260504 — Jing
  // "在 Composing MV…92% 完成之前，恐怖音效提前偷跑". The audio fallback
  // path here calls openWatchMusicPlaybackSurfaceModule({autoplay:true})
  // which plays whatever URL is on watchAudioPreview — usually the
  // partial Suno take that was preloaded by the music stage. If the
  // compose stage hasn't finished blending, that partial Suno track
  // is not what the user wanted to hear (and sounds eerie/disembodied
  // because it's playing without the synced video). Hold the fallback
  // until either compose finishes or the pipeline errors cleanly.
  try {
    if (typeof globalThis.cssmvPipelineActiveStage === "function") {
      const live = globalThis.cssmvPipelineActiveStage();
      if (live && !live.finished && !live.hasError && live.stageId !== "compose") {
        // pipeline still cooking earlier stages; suppress audio fallback
        if (watchScreen) watchScreen.classList.add("is-waiting");
        if (watchSubtitle) {
          safeSetWatchSubtitleModule(reason ||
            (typeof t === "function" ? t("watch.subtitle.composingMv") : "Composing MV…"));
        }
        return;
      }
    }
  } catch (_e) { /* fall through to legacy behaviour */ }
  if (watchScreen) {
    watchScreen.classList.add("watch-screen-audio-fallback");
    watchScreen.classList.add("is-waiting");
  }
  setWatchPlaybackUiSuppressedModule(false);
  activateWatchTab("music");
  if (reason && watchSubtitle) {
    safeSetWatchSubtitleModule(reason);
  }
  openWatchMusicPlaybackSurfaceModule({ autoplay: true });
}

function watchHasPlayableMediaModule() {
  if (typeof getRememberedWatchFinalAudio === "function" && getRememberedWatchFinalAudio()) return true;
  const audioSrc = String(watchAudioPreview?.currentSrc || watchAudioPreview?.src || "").trim();
  if (audioSrc && !audioSrc.startsWith("data:")) return true;
  const videoSrc = String(watchVideo?.currentSrc || watchVideo?.src || "").trim();
  if (videoSrc && !videoSrc.startsWith("data:")) return true;
  return false;
}

function ensureWatchAutoChainOnOpenModule() {
  try {
    /* CSSOS_SHARE_LINK_NO_REGEN 20260506 — Jing
     * Share-link openings must never trigger a fresh pipeline run
     * (the linked work IS the source of truth — even if it's preview-
     * only with no final_mv_url, we just play that preview, period). */
    if (globalThis.__cssosShareLinkActive) return false;
    if (watchHasPlayableMediaModule()) return false;
    const run = globalThis.cssmvRunPipeline;
    if (typeof run !== "function") return false;
    const p = run({});
    if (p && typeof p.catch === "function") p.catch(() => {});
    return true;
  } catch (_err) {
    return false;
  }
}

globalThis.watchHasPlayableMediaModule = watchHasPlayableMediaModule;
globalThis.ensureWatchAutoChainOnOpenModule = ensureWatchAutoChainOnOpenModule;

function activateWatchTab(tab) {
  const active = ["mv", "music", "lyrics", "script", "comments", "revenue", "ownership"].includes(tab) ? tab : "mv";
  watchActiveTab = active;
  globalThis.watchActiveTab = watchActiveTab;
  localStorage.setItem(WATCH_ACTIVE_TAB_STORAGE_KEY, active);
  if (watchPanel) {
    watchPanel.dataset.activeWatchTab = active;
  }
  watchTabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.watchTab === active);
  });
  watchPanes.forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.watchPane === active);
  });
  if (active === "music" && watchAudioPreview) {
    watchScreen?.classList.add("watch-screen-audio-fallback");
    watchAudioPreview.style.display = "block";
    if (
      (!String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim() ||
        String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim().startsWith("data:audio/")) &&
      getRememberedWatchFinalAudio()
    ) {
      restoreRememberedWatchFinalAudio();
    }
    if (currentWatchAudioSourceKind === "final-artifact" || getRememberedWatchFinalAudio()) {
      syncWatchAudioPresentation();
      updateWatchAudioDebug();
    }
  }
  if (active === "mv") {
    watchScreen?.classList.remove("watch-screen-audio-fallback");
  }
  if (active === "comments" || active === "revenue" || active === "ownership") {
    renderWatchMetaPanelsModule();
  }
  if (active === "mv") {
    requestAnimationFrame(() => scrollWatchBodyToActiveMediaFrameModule());
  }
}

globalThis.activateWatchTab = activateWatchTab;

function shouldKeepWatchInMusicModeModule() {
  const preferred = resolvePreferredWatchOpenTab("mv");
  return (watchActiveTab === "music" || preferred === "music") && !!getRememberedWatchFinalAudio();
}

function stopWatchMusicVisualizerModule() {
  if (watchMusicAnalyserFrame) {
    cancelAnimationFrame(watchMusicAnalyserFrame);
    watchMusicAnalyserFrame = 0;
  }
  if (watchMusicStage) {
    watchMusicStage.style.setProperty("--watch-aura-scale", "1");
    watchMusicStage.style.setProperty("--watch-aura-opacity", "0.86");
    watchMusicStage.style.setProperty("--watch-ring-glow", "0.22");
    watchMusicStage.style.setProperty("--watch-progress-glow", "0.4");
    watchMusicStage.style.setProperty("--watch-disc-lift", "0px");
    watchMusicStage.style.setProperty("--watch-music-shadow-live", "var(--watch-music-shadow)");
    watchMusicStage.style.setProperty("--watch-music-secondary-shadow-live", "var(--watch-music-secondary-shadow)");
  }
  watchScreen?.style.setProperty("--watch-frame-border-energy", "0.16");
  watchScreen?.style.setProperty("--watch-frame-border-angle", "0deg");
  applyWatchFrameAccentPaletteModule(0);
}

function tickWatchMusicVisualizerModule() {
  if (!watchMusicAnalyser || !watchMusicStage || !watchAudioPreview || watchAudioPreview.paused) {
    stopWatchMusicVisualizerModule();
    return;
  }
  if (!watchMusicAnalyserData) {
    watchMusicAnalyserData = new Uint8Array(watchMusicAnalyser.frequencyBinCount);
  }
  watchMusicAnalyser.getByteFrequencyData(watchMusicAnalyserData);
  const sum = watchMusicAnalyserData.reduce((acc, value) => acc + value, 0);
  const avg = watchMusicAnalyserData.length ? sum / watchMusicAnalyserData.length : 0;
  const energy = Math.max(0, Math.min(1, avg / 160));
  const peak = watchMusicAnalyserData.length ? Math.max(...watchMusicAnalyserData) / 255 : 0;
  watchMusicLiveEnergy = energy;
  watchMusicLivePeak = peak;
  if (
    (energy > 0.52 || peak > 0.86) &&
    Date.now() - lastWatchFrameAccentShiftAt > 520
  ) {
    lastWatchFrameAccentShiftAt = Date.now();
    watchFrameAccentPaletteIndex = (watchFrameAccentPaletteIndex + 1 + Math.floor(Math.random() * (WATCH_FRAME_ACCENT_PALETTES.length - 1))) % WATCH_FRAME_ACCENT_PALETTES.length;
    applyWatchFrameAccentPaletteModule(watchFrameAccentPaletteIndex);
  }
  watchMusicStage.style.setProperty("--watch-aura-scale", `${(1 + energy * 0.11).toFixed(3)}`);
  watchMusicStage.style.setProperty("--watch-aura-opacity", `${(0.78 + energy * 0.36).toFixed(3)}`);
  watchMusicStage.style.setProperty("--watch-ring-glow", `${(0.22 + energy * 0.4).toFixed(3)}`);
  watchMusicStage.style.setProperty("--watch-progress-glow", `${(0.42 + energy * 0.5).toFixed(3)}`);
  watchMusicStage.style.setProperty("--watch-disc-lift", `${(energy * 2.8).toFixed(2)}px`);
  watchMusicStage.style.setProperty("--watch-music-shadow-live", `rgba(var(--watch-music-accent-1-rgb), ${(0.18 + energy * 0.26).toFixed(3)})`);
  watchMusicStage.style.setProperty("--watch-music-secondary-shadow-live", `rgba(var(--watch-music-accent-2-rgb), ${(0.12 + energy * 0.24).toFixed(3)})`);
  watchKaraokeLine?.style.setProperty("--karaoke-live-energy", energy.toFixed(3));
  watchKaraokeLine?.style.setProperty("--karaoke-live-peak", peak.toFixed(3));
  watchSubtitle?.style.setProperty("--karaoke-live-energy", energy.toFixed(3));
  watchSubtitle?.style.setProperty("--karaoke-live-peak", peak.toFixed(3));
  watchScreen?.style.setProperty("--watch-frame-border-energy", `${(0.16 + energy * 0.84).toFixed(3)}`);
  watchMusicAnalyserFrame = requestAnimationFrame(tickWatchMusicVisualizerModule);
}

async function ensureWatchMusicVisualizerModule() {
  if (!watchAudioPreview || typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!watchMusicAudioContext) {
    watchMusicAudioContext = new AudioCtx();
  }
  if (watchMusicAudioContext.state === "suspended") {
    await watchMusicAudioContext.resume().catch(() => {});
  }
  if (!watchMusicSourceNode) {
    watchMusicSourceNode = watchMusicAudioContext.createMediaElementSource(watchAudioPreview);
    watchMusicAnalyser = watchMusicAudioContext.createAnalyser();
    watchMusicAnalyser.fftSize = 128;
    watchMusicSourceNode.connect(watchMusicAnalyser);
    watchMusicAnalyser.connect(watchMusicAudioContext.destination);
  }
  if (!watchMusicAnalyserFrame) {
    tickWatchMusicVisualizerModule();
  }
}

function syncWatchMusicStateModule() {
  if (!watchMusicStage || !watchMusicPlayIcon) return;
  const playing = !!(watchAudioPreview && !watchAudioPreview.paused && !watchAudioPreview.ended);
  const activeStage = getActiveWatchProgressCardModule()?.key || "";
  const nextNeededStage = getNextWatchGenerationGapModule();
  watchMusicStage.classList.toggle("is-playing", playing);
  watchMusicPlay?.classList.toggle("is-paused", playing);
  watchMusicPlay?.classList.toggle(
    "is-generating",
    !playing && !!(activeStage || (nextNeededStage && nextNeededStage !== "play"))
  );
  watchMusicPlayIcon.textContent = "";
  if (watchMusicPlay) {
    const actionLabel = playing
      ? t("watch.action.pause")
      : activeStage || (nextNeededStage && nextNeededStage !== "play")
        ? getWatchProgressActionLabelModule(activeStage || nextNeededStage)
        : t("watch.action.play");
    watchMusicPlay.title = actionLabel;
    watchMusicPlay.setAttribute("aria-label", actionLabel);
    watchMusicPlay.dataset.actionMode = playing ? "pause" : activeStage || nextNeededStage || "play";
  }
  /* CSSOS_WAVE_226 20260518 — Jing: "播放媒体一定要显示边框进度条".
   * 之前 frame border 进度只在 watchMusicRing 存在时更新, cinema 全屏
   * 模式下没 ring → 边框 angle 卡 0deg → 看不见跑. 拆成两段: 边框进度
   * 只要 watchAudioPreview 在就更新; ring 进度才需要 watchMusicRing. */
  if (watchAudioPreview) {
    const _dur = Number.isFinite(watchAudioPreview.duration) ? watchAudioPreview.duration : 0;
    const _cur = Number.isFinite(watchAudioPreview.currentTime) ? watchAudioPreview.currentTime : 0;
    const _prog = _dur > 0 ? Math.max(0, Math.min(1, _cur / _dur)) : 0;
    watchScreen?.style.setProperty("--watch-frame-border-progress", `${Math.round(_prog * 100)}%`);
    watchScreen?.style.setProperty("--watch-frame-border-angle", `${Math.round(_prog * 360)}deg`);
    // 播放中必挂 is-live-border (有些路径走过来时还停在 is-waiting)
    if (playing) {
      watchScreen?.classList.add("is-live-border");
      watchScreen?.classList.remove("is-waiting", "is-stalled");
    }
    if (watchMusicRing) {
      watchMusicRing.style.setProperty("--watch-progress", `${Math.round(_prog * 360)}deg`);
    }
  }
  if (playing) {
    setWatchPlaybackUiSuppressedModule(true);
    applyWatchFrameAccentPaletteModule(watchFrameAccentPaletteIndex);
    void ensureWatchMusicVisualizerModule();
  } else {
    if (watchActiveTab === "music") {
      setWatchPlaybackUiSuppressedModule(false);
    }
    stopWatchMusicVisualizerModule();
  }
}

function syncWatchEditorsFromSettingsModule() {
  const seed = state.songSeed && typeof state.songSeed === "object" ? state.songSeed : {};
  const seedLyrics = String(lyricsInput?.value || seed.lyrics || "").trim();
  const seedOutline = String(videoOutlineInput?.value || seed.videoOutline || seed.video_outline || "").trim();
  const resolvedMusicStyle = String(
    seed.musicStyle ||
      seed.music_style ||
      seed.style ||
      state.style ||
      ""
  ).trim();
  const resolvedWikiSource = String(
    seed.wikiSource ||
      seed.wiki_source ||
      seed.sourceWiki ||
      seed.source_wiki ||
      seed.references?.wiki ||
      seed.references?.source ||
      seed.reference ||
      ""
  ).trim();
  const seedPrompts = Array.isArray(seed.sectionPrompts)
    ? seed.sectionPrompts
    : Array.isArray(seed.section_prompts)
      ? seed.section_prompts
      : [];
  if (watchLyricsEditor) {
    const resolvedTitle = String(seed.title || state.title || "").trim();
    const candidateLyrics = String(
      lyricsInput?.value ||
        globalThis.buildCanonicalLyricsWithTitleModule?.(
          resolvedTitle,
          seedLyrics,
        ) ||
        seedLyrics ||
        ""
    ).trim();
    const hasBodyLyrics =
      globalThis.hasCanonicalLyricsBodyLinesModule?.(resolvedTitle, candidateLyrics, 2) ?? false;
    // CSSOS_PHASE2_LYRICS_NORMALIZER 20260501 #261 — pipe everything
    // through normalizeLyricsTextModule so JSON-shaped payloads never
    // hit the textarea verbatim.
    const _norm = (typeof globalThis.cssosNormalizeLyricsText === "function")
      ? globalThis.cssosNormalizeLyricsText
      : (s) => s;
    watchLyricsEditor.value = hasBodyLyrics
      ? _norm(String(
          globalThis.buildCanonicalLyricsWithTitleModule?.(
            resolvedTitle,
            candidateLyrics,
          ) || candidateLyrics
        ).trim())
      : _norm(candidateLyrics);
  }
  if (watchOutlineEditor) {
    watchOutlineEditor.value = String(videoOutlineInput?.value || seedOutline || "").trim();
  }
  if (watchScriptEditor) {
    const renderedPrompts =
      sectionPromptsInput?.value ||
      globalThis.renderSectionPromptsTextModule?.(seedPrompts) ||
      "";
    watchScriptEditor.value = String(renderedPrompts || "").trim();
  }
  if (watchLyricsMusicStyle) {
    watchLyricsMusicStyle.value = resolvedMusicStyle;
  }
  if (watchLyricsWikiSource) {
    watchLyricsWikiSource.value = resolvedWikiSource;
  }
}

function renderWatchMetaPanelsModule() {
  loadWatchCommentsModule();
  renderWatchCommentsModule();
  const commerce = watchCommerceState.payload || null;
  const account = commerce?.account || null;
  const ownership = commerce?.ownership || null;
  const market = commerce?.market || null;
  const ledgerEntries = Array.isArray(commerce?.ledger_entries) ? commerce.ledger_entries : [];
  const works = Array.isArray(ownership?.works) ? ownership.works : [];
  const orders = Array.isArray(market?.orders) ? market.orders : [];
  const tipsList = Array.isArray(market?.tips) ? market.tips : [];
  const transfers = Array.isArray(market?.ownership_transfers) ? market.ownership_transfers : [];

  if (watchOwnershipCopy) {
    const owner = commerce?.profile?.email || authState.user?.email || t("watch.ownership.guest");
    const source = state.title || watchBrandTitleModule();
    const worksCount = Number(ownership?.works_count || works.length || 0);
    const latestTransfer = transfers[0] || null;
    const latestTransferAmount = latestTransfer ? formatUsdFromCents(latestTransfer.transfer_amount_cents, "$0.00") : "—";
    watchOwnershipCopy.textContent =
      `${t("watch.ownership.current")}: ${owner}\n` +
      `${t("watch.ownership.source")}: ${source}\n` +
      `${t("watch.ownership.worksCount")}: ${worksCount}\n` +
      `${t("watch.revenue.buyouts")}: ${transfers.length} · ${latestTransferAmount}`;
  }
  if (watchOwnershipList) {
    if (!authState.user || !works.length) {
      watchOwnershipList.innerHTML = `<div class="watch-activity-empty">${t("watch.ownership.none")}</div>`;
    } else {
      const ownershipItems = [
        ...transfers.map((transfer) => ({
          title: `${t("watch.ownership.buyout")} · ${formatUsdFromCents(transfer?.transfer_amount_cents, "$0.00")}`,
          meta: `${escapeHtml(String(transfer?.transfer_kind || t("watch.ownership.buyout")))} · ${escapeHtml(formatDateTime(transfer?.effective_at || transfer?.created_at))}`
        })),
        ...works.map((work) => ({
          title: String(work?.title || "").trim() || watchBrandTitleModule(),
          meta: `${escapeHtml(String(work?.status || "draft"))} · ${escapeHtml(formatDateTime(work?.updated_at || work?.created_at))}`
        }))
      ].slice(0, 8);
      watchOwnershipList.innerHTML = ownershipItems
        .map((item) => `
          <div class="watch-activity-item">
            <div class="watch-activity-title">${escapeHtml(item.title)}</div>
            <div class="watch-activity-meta">${item.meta}</div>
          </div>
        `)
        .join("");
    }
  }
  if (watchRevenueGrid) {
    const subscription = commerce?.profile?.tier || billingState.tier || authState.tier || authState.role || DEFAULT_ROLE;
    const balance = account?.balance_cents ?? billingState.balance_cents;
    const monthSpent = account?.month_spent_cents ?? 0;
    const monthLimit = account?.monthly_limit_cents ?? billingState.monthly_limit_cents;
    const listeners = orders.filter((entry) => String(entry?.order_kind || "") === "listen" && String(entry?.status || "") === "paid").length || works.length;
    const tips = tipsList.reduce((sum, entry) => sum + Math.max(0, Number(entry?.amount_cents || 0)), 0);
    const buyouts = transfers.length;
    const earningsFromOrders = orders.reduce((sum, entry) => sum + Math.max(0, Number(entry?.seller_net_cents || 0)), 0);
    const earnings = Math.max(
      earningsFromOrders + tips,
      ledgerEntries.filter((entry) => Number(entry?.amount_cents) > 0).reduce((sum, entry) => sum + Number(entry?.amount_cents || 0), 0)
    );
    watchRevenueGrid.innerHTML = `
      <div class="watch-metric">
        <div class="watch-metric-label">${t("works.subscription")}</div>
        <div class="watch-metric-value">${escapeHtml(String(subscription || DEFAULT_ROLE))}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.balance")}</div>
        <div class="watch-metric-value">${escapeHtml(formatUsdFromCents(balance, t("watch.revenue.unlimited")))}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.monthSpent")}</div>
        <div class="watch-metric-value">${escapeHtml(formatUsdFromCents(monthSpent, "$0.00"))}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.monthlyLimit")}</div>
        <div class="watch-metric-value">${escapeHtml(formatUsdFromCents(monthLimit, t("watch.revenue.unlimited")))}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.listeners")}</div>
        <div class="watch-metric-value">${listeners}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.tips")}</div>
        <div class="watch-metric-value">${escapeHtml(formatUsdFromCents(tips, "$0.00"))}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.buyouts")}</div>
        <div class="watch-metric-value">${buyouts}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.earnings")}</div>
        <div class="watch-metric-value">${escapeHtml(formatUsdFromCents(earnings, "$0.00"))}</div>
      </div>
    `;
  }
  if (watchRevenueActivity) {
    if (!authState.user) {
      watchRevenueActivity.innerHTML = `<div class="watch-activity-empty">${t("watch.revenue.noActivity")}</div>`;
    } else if (!ledgerEntries.length && !orders.length && !tipsList.length) {
      watchRevenueActivity.innerHTML = `<div class="watch-activity-empty">${t("watch.revenue.noActivity")}</div>`;
    } else {
      const activityRows = [
        ...orders.map((entry) => ({
          title: `${t("watch.revenue.order")} · ${String(entry?.order_kind || t("watch.revenue.listeners")).trim()}`,
          amount: Number(entry?.seller_net_cents || entry?.gross_amount_cents || 0),
          at: entry?.updated_at || entry?.created_at
        })),
        ...tipsList.map((entry) => ({
          title: `${t("watch.revenue.tipEntry")}${entry?.message ? ` · ${String(entry.message)}` : ""}`,
          amount: Number(entry?.amount_cents || 0),
          at: entry?.created_at
        })),
        ...ledgerEntries.map((entry) => ({
          title: String(entry?.note || entry?.kind || "entry"),
          amount: Number(entry?.amount_cents || 0),
          at: entry?.created_at
        }))
      ]
        .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
        .slice(0, 12);
      watchRevenueActivity.innerHTML = activityRows
        .map((entry) => {
          const amount = Number(entry?.amount || 0);
          const sign = amount > 0 ? "+" : "";
          return `
            <div class="watch-activity-item">
              <div class="watch-activity-title">${escapeHtml(String(entry?.title || "entry"))}</div>
              <div class="watch-activity-meta">${escapeHtml(`${sign}${formatUsdFromCents(amount, "$0.00")} · ${formatDateTime(entry?.at)}`)}</div>
            </div>
          `;
        })
        .join("");
    }
  }
  if (authState.user && !watchCommerceState.loaded && !watchCommerceState.loading) {
    void loadWatchCommerce().then(() => renderWatchMetaPanelsModule());
  }
}

function renderWatchCommerceActionsModule(work = currentWatchPreviewWork) {
  if (!watchCommerceActions) return;
  const workId = String(work?.id || work?.work_id || "").trim();
  if (!workId) {
    watchCommerceActions.hidden = true;
    watchCommerceActions.innerHTML = "";
    return;
  }
  const isOwnedByViewer =
    Boolean(authState.user?.id) && String(work?.owner_user_id || "").trim() === String(authState.user?.id || "").trim();
  // CSSOS_PHASE2_NO_JUDGE_AS_PLAYER 20260501 #266 — Jing
  // Admin-owned works: free listen/watch, no buyout, marketplace
  // commerce buttons hidden. The backend's normalizeWorkTreeRow stamps
  // is_priceless / owner_is_admin on every row, but we also fall back
  // to listenCents===0 + buyout disabled in case an older client cache
  // hits a non-decorated payload.
  const isPricelessAdminWork = Boolean(work?.is_priceless || work?.owner_is_admin);
  // Staff (cssOS admins viewing) can never buy — back-end will 403, so
  // hide the buttons up front to avoid futile clicks.
  const viewerEmail = String(authState.user?.email || "").toLowerCase();
  const viewerIsAdmin = (() => {
    if (!viewerEmail) return false;
    if (viewerEmail === "jingdudc@gmail.com") return true;
    if (viewerEmail === "admin@cssstudio.app") return true;
    return viewerEmail.endsWith("@cssstudio.app");
  })();
  const canTransact = isLoggedInUser() && !isOwnedByViewer && !isPricelessAdminWork && !viewerIsAdmin;
  const listenCents = Number(work?.current_listen_price_cents || work?.listen_price_cents || 0);
  const buyoutCents = Number(work?.current_buyout_price_cents || 0);
  const structureRole = String(work?.structure_role || "").trim().toLowerCase();
  const wholeBuyoutChild = ["act", "scene", "part"].includes(structureRole);
  const wholeBuyoutOnly = !wholeBuyoutChild && ["opera", "triptych"].includes(normalizeWorkTypeClient(work?.work_type));
  const buyoutEnabled = !isPricelessAdminWork && Boolean(work?.buyout_enabled) && buyoutCents > 0 && !wholeBuyoutChild;
  const tipsEnabled = canReceiveTips(work);
  const orderState = resolveViewerOrderState(work?.viewer_orders);
  const commerce = watchCommerceState.payload || null;
  const usageEvents = Array.isArray(commerce?.usage_events) ? commerce.usage_events : [];
  const computeUnits = Math.max(0, Number(work?.compute_units_estimate || 0));
  const computeCost = Math.max(0, Number(work?.compute_cost_cents_estimate || 0));
  const suggestedListen = Math.max(99, Number(work?.suggested_listen_price_cents || listenCents || 0));
  const suggestedBuyout = Math.max(299, Number(work?.suggested_buyout_price_cents || buyoutCents || 0));
  const listenDisabled = Boolean(
    orderState.paidBuyout || orderState.paidListen || orderState.pendingListen || orderState.pendingBuyout || listenCents <= 0
  );
  const buyoutDisabled = Boolean(orderState.paidBuyout || orderState.pendingBuyout || !buyoutEnabled);
  const tipDisabled = Boolean(!tipsEnabled || orderState.pendingTip);
  watchCommerceActions.hidden = false;
  watchCommerceActions.innerHTML = `
    <button class="mini-btn ghost" type="button" data-watch-market-action="preview">${loginCopy("Enjoy")}</button>
    ${canTransact ? `<button class="mini-btn ghost" type="button" data-watch-market-action="listen" ${listenDisabled ? "disabled" : ""}>${marketActionCopy("listen", orderState)}</button>` : ""}
    ${canTransact && !wholeBuyoutChild ? `<button class="mini-btn ghost" type="button" data-watch-market-action="buyout" ${buyoutDisabled ? "disabled" : ""}>${wholeBuyoutOnly ? loginCopy("Whole buyout") : marketActionCopy("buyout", orderState)}</button>` : ""}
    ${canTransact ? `<span class="market-inline-action"><button class="mini-btn ghost" type="button" data-watch-market-action="tip" ${tipDisabled ? "disabled" : ""}>${marketActionCopy("tip", orderState)}</button><input class="inline-chip-input market-tip-input" type="number" min="1" step="1" inputmode="decimal" placeholder="${escapeHtml(loginCopy("Tip $"))}" data-market-tip-input="${escapeHtml(workId)}" hidden /></span>` : ""}
    <div class="watch-billing-card">
      <div class="work-billing-title">${escapeHtml(loginCopy("Work cost bill"))}</div>
      <div class="work-billing-grid">
        <div class="work-billing-stat"><span>${escapeHtml(loginCopy("Compute"))}</span><strong>${escapeHtml(`${computeUnits}u`)}</strong></div>
        <div class="work-billing-stat"><span>${escapeHtml(loginCopy("Estimated cost"))}</span><strong>${escapeHtml(formatUsdFromCents(computeCost, "$0.00"))}</strong></div>
        <div class="work-billing-stat"><span>${escapeHtml(loginCopy("Suggested listen"))}</span><strong>${escapeHtml(formatUsdFromCents(suggestedListen, "$0.00"))}</strong></div>
        ${wholeBuyoutChild ? "" : `<div class="work-billing-stat"><span>${escapeHtml(wholeBuyoutOnly ? loginCopy("Whole buyout") : loginCopy("Suggested buyout"))}</span><strong>${escapeHtml(formatUsdFromCents(wholeBuyoutOnly ? buyoutCents || suggestedBuyout : suggestedBuyout, "$0.00"))}</strong></div>`}
      </div>
      <div class="watch-activity compact">${renderUsageHistoryMarkup(getWorkMatchedUsageEvents(work, usageEvents), loginCopy("No matched billable actions for this work yet."), 4)}</div>
    </div>
  `;
  watchCommerceActions.querySelector('[data-watch-market-action="listen"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    const trigger = event.currentTarget;
    if (typeof dispatchMarketWorkPayment === "function") {
      void dispatchMarketWorkPayment(workId, "listen", trigger);
    } else {
      void startStripeCheckoutForWork(workId, "listen", trigger);
    }
  });
  watchCommerceActions.querySelector('[data-watch-market-action="buyout"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    const trigger = event.currentTarget;
    if (typeof dispatchMarketWorkPayment === "function") {
      void dispatchMarketWorkPayment(workId, "buyout", trigger);
    } else {
      void startStripeCheckoutForWork(workId, "buyout", trigger);
    }
  });
  watchCommerceActions.querySelector('[data-watch-market-action="tip"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMarketTipInput(watchCommerceActions, true);
  });
  watchCommerceActions.querySelector('[data-watch-market-action="preview"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    armWatchExplicitPreviewIntent();
    void openWatchPreviewFlowModule({ clearLimit: true, allowDemoFallback: false });
  });
  const input = watchCommerceActions.querySelector('[data-market-tip-input]');
  if (input instanceof HTMLInputElement) {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget?.blur?.();
    });
    input.addEventListener("blur", (event) => {
      event.stopPropagation();
      const target = event.currentTarget;
      const trigger = watchCommerceActions.querySelector('[data-watch-market-action="tip"]');
      void handleMarketTipBlur(target, trigger);
    });
  }
}

/* W307b — sync pre-paint: show latest work title + single stable cover
 * IMMEDIATELY when the panel opens, before the async render finishes.
 * Sources (tried in order): currentStructuredWatchQueue, then
 * __cssosWatchQueue (queue feed), then currentWatchPreviewWork, then
 * the first entry of watchCommerceState if already loaded.
 * Never awaits anything — if none of these is ready yet, falls back
 * to leaving the panel in its default state; the async flow takes over. */
function prePaintLatestWorkOnPanelOpenModule() {
  try {
    // --- find best candidate work snapshot ---
    let w = null;
    // 1. structured queue filled by a previous openLatestOwnedWork call
    const sq = globalThis.currentStructuredWatchQueue;
    if (sq?.items?.length) w = sq.items[0];
    // 2. raw watch-queue filled by fetchWatchQueueMore
    if (!w) {
      const wq = globalThis.__cssosWatchQueue;
      if (wq?.items?.length) w = wq.items[0];
    }
    // 3. the last rendered preview work
    if (!w && currentWatchPreviewWork) w = currentWatchPreviewWork;
    // 4. direct from watchCommerceState (already-loaded ownership list)
    if (!w && watchCommerceState?.loaded) {
      const rawWorks = Array.isArray(watchCommerceState?.payload?.ownership?.works)
        ? watchCommerceState.payload.ownership.works : [];
      const flat = [];
      const visit = (x) => { if (x) { flat.push(x); (x.children || []).forEach(visit); } };
      rawWorks.forEach(visit);
      flat.sort((a, b) => (Date.parse(b?.created_at || "") || 0) - (Date.parse(a?.created_at || "") || 0));
      if (flat.length) w = flat[0];
    }
    if (!w) return; // nothing available yet — async flow will handle it

    // --- pre-paint title ---
    const title = String(w.title || w.name || "").trim();
    if (title) {
      const pt = watchPanel?.querySelector(".panel-title");
      if (pt) pt.textContent = `${loginCopy("Watch")} · ${title}`;
    }

    // --- pre-paint single stable cover (kills flashing) ---
    const cover = String(
      w.cover_image || w.preview_image_url || w.cover_url ||
      w.cover_slides?.[0] || ""
    ).trim();
    if (cover) {
      // Set the slides list to ONE stable image so no flashing occurs
      // when the slideshow kicks in while video loads/is-blocked.
      if (typeof globalThis.cssmvSetCoverSlides === "function") {
        globalThis.cssmvSetCoverSlides([cover]);
      }
      // Prime the SVG preview frame so the panel isn't black on open.
      if (typeof setWatchSvgPreviewModule === "function") {
        setWatchSvgPreviewModule(cover);
      }
    }
  } catch (_e) { /* silent — never block panel open */ }
}

function ensureWatchCentered() {
  if (!watchPanel) return;
  if (!guardPanelAccess(watchPanel.id)) return;
  const restoredLayout = applyStoredPanelLayout(watchPanel);
  openWatchPanelShellModule(restoredLayout);
  /* W307b — synchronously paint title + cover BEFORE async render */
  prePaintLatestWorkOnPanelOpenModule();
  focusPanel(watchPanel);
  if (!watchPanel.dataset.positioned) {
    watchPanel.style.left = "50%";
    watchPanel.style.top = "50%";
    watchPanel.style.transform = "translate(-50%, -50%)";
    watchPanel.dataset.positioned = "true";
  }
  if (logoPanel) logoPanel.classList.add("dimmed");
}

function setWatchCenterStage(active) {
  if (!watchPanel) return;
  if (active) {
    watchPanel.classList.add("center-stage");
    if (logoPanel) logoPanel.classList.add("dimmed");
    return;
  }
  watchPanel.classList.remove("center-stage");
  if (logoPanel) logoPanel.classList.remove("dimmed");
}

function dismissBlockingWatchOverlay() {
  const overlay = document.getElementById("mv-overlay");
  if (!(overlay instanceof HTMLElement)) return false;
  const video = overlay.querySelector("video");
  const hasActiveMedia = !!String(video?.currentSrc || video?.getAttribute("src") || "").trim();
  if (overlay.classList.contains("show") || hasActiveMedia) {
    closeEnjoyOverlay();
    return true;
  }
  overlay.classList.remove("show");
  return false;
}

function dismissUiBlockingLayers() {
  document.querySelectorAll(".provider-login-modal").forEach((modal) => {
    modal.classList.add("hidden");
  });
  document.querySelectorAll(".dock-settings-popover").forEach((popover) => {
    popover.classList.remove("is-visible");
    popover.hidden = true;
  });
  document.querySelectorAll(".mv-overlay").forEach((overlay) => {
    overlay.classList.remove("show");
    const video = overlay.querySelector("video");
    if (video) {
      video.pause?.();
      video.removeAttribute("src");
      video.load?.();
    }
  });
}

function primeWatchPanelLayout() {
  if (!watchPanel) return;
  if (watchPanel.dataset.userMoved === "true" || watchPanel.dataset.maximized === "true") return;
  const insetX = 10;
  const insetY = 10;
  watchPanel.style.left = `${insetX}px`;
  watchPanel.style.top = `${insetY}px`;
  watchPanel.style.transform = "none";
  watchPanel.style.width = `${Math.max(MIN_PANEL_WIDTH, window.innerWidth - insetX * 2)}px`;
  watchPanel.style.height = `${Math.max(MIN_PANEL_HEIGHT, window.innerHeight - insetY * 2)}px`;
}

function prepareWatchPanelForOpen(restoredLayout = false) {
  if (!watchPanel) return;
  dismissUiBlockingLayers();
  if (!restoredLayout) {
    primeWatchPanelLayout();
  }
  if (!watchPanel.dataset.positioned) {
    watchPanel.dataset.positioned = "true";
  }
}

// CSSOS_PHASE2_WATCH_QUEUE 20260430 #208b — Jing
// "Watch MV 面板先连播自己最新 2 首再播别人的." Cursor-paginated MV queue
// fed by /cssapi/v1/mv. Plays own works first (newest first), then market
// discoveries, autoadvancing on <video>/<audio> ended. Up/Down arrow +
// swipe — short swipe = Take 1/2 toggle on current MV, long swipe = jump
// to next/prev MV in queue.
const __cssosWatchQueue = {
  items: [],
  index: 0,
  cursor: null,
  loadingMore: false,
  exhausted: false,
};

async function fetchWatchQueueMoreModule() {
  if (__cssosWatchQueue.loadingMore || __cssosWatchQueue.exhausted) return;
  __cssosWatchQueue.loadingMore = true;
  try {
    // CSSOS_PHASE2_KILL_405_GET_MV 20260504 — Jing
    // GET /cssapi/v1/mv?limit=N is unregistered server-side (only POST
    // exists in rust-api/src/routes.rs:133). Previous "silence" fix
    // tolerated the 405 but the browser still painted a red console
    // entry every load. Skip this fetch entirely and go straight to
    // /api/works/mine below — that's the working data source for the
    // queue, and the 405 disappears from DevTools.
    // CSSOS_PHASE2_QUEUE_FALLBACK 20260430 #234 — Jing
    // "上滑下滑都说Queue is empty, 说明根本就没有列表."
    // If /cssapi/v1/mv returned nothing AND we don't have a single
    // queued item yet, fall back to /api/works/mine (which the works
    // center uses successfully). Build the queue from there ordered
    // newest → oldest, filtered to anything with at least one
    // playable URL. This guarantees the swipe-nav has SOMETHING to
    // walk through even when the cursor endpoint comes up dry.
    if (!__cssosWatchQueue.items.length) {
      try {
        // CSSOS_PHASE2_FULL_QUEUE 20260504 — Jing
        // "播放10作品之后，应该进入下一个10作品，而不是马上绕回来
        //  重复，而是直到最后作品". Pull the full library so the
        // playback queue walks every work before wrapping back to
        // the head. 500 covers any current owner; bump again later.
        const mineRes = await fetch("/api/works/mine?limit=500", { credentials: "include" });
        const minePayload = await mineRes.json().catch(() => null);
        const works = minePayload?.data?.works || minePayload?.works || [];
        const flat = [];
        const visit = (w) => {
          if (!w) return;
          flat.push(w);
          if (Array.isArray(w.children)) w.children.forEach(visit);
        };
        works.forEach(visit);
        flat.sort((a, b) => {
          const ta = Date.parse(String(a?.created_at || "")) || 0;
          const tb = Date.parse(String(b?.created_at || "")) || 0;
          return tb - ta;
        });
        const seen = new Set(__cssosWatchQueue.items.map((it) => it.id));
        for (const w of flat) {
          const id = String(w?.id || w?.work_id || "").trim();
          if (!id || seen.has(id)) continue;
          const finalMv = String(w.final_mv_url || w.preview_video_url || "").trim();
          const a1 = String(w.audio_track_1_url || "").trim();
          const a2 = String(w.audio_track_2_url || "").trim();
          if (!finalMv && !a1 && !a2) continue; // skip drafts with no media
          // Skip Take 2 siblings — Take 1 row already carries both audio URLs.
          if (Number(w.take_index || 0) === 2) continue;
          __cssosWatchQueue.items.push({
            id,
            title: w.title || "",
            cover_url: w.cover_image || w.preview_image_url || null,
            preview_video_url: w.preview_video_url || null,
            final_mv_url: finalMv || null,
            audio_track_1_url: a1 || null,
            audio_track_2_url: a2 || null,
            subtitle_srt_url: w.subtitle_srt_url || null,
            duration_secs: Number(w.duration_secs || 0) || null,
            lyrics_preview: w.lyrics_preview || "",
            sibling_work_id: w.sibling_work_id || null,
            take_index: w.take_index || null,
            root_work_id: w.root_work_id || null,
            sequence_index: w.sequence_index || 0,
            is_own: true,
          });
          seen.add(id);
        }
        __cssosWatchQueue.exhausted = true; // mine is one-shot, no cursor
        console.warn("[watch-queue] fallback /api/works/mine populated %d items", __cssosWatchQueue.items.length);
      } catch (e) {
        console.warn("[watch-queue] fallback fetch failed:", e);
      }
    }
  } catch (_e) { /* network best-effort */ }
  finally {
    __cssosWatchQueue.loadingMore = false;
  }
}

// CSSOS_PHASE2_PREVIEW_CAP 20260430 #222 — Jing
// "如果遇到会员级别/权限不够，只能播放 30 秒预览，也要继续播完 30 秒，
//  继续下一首歌." When the queue auto-advances onto a work the viewer
// can't fully consume (someone else's, no listen permission, no buyout),
// we play a 30s sample then skip. Detection is best-effort by the
// item.is_own flag (own works = no cap) and the absence of the canonical
// "watch unlocked" marker the existing market path sets — full enforcement
// remains server-side, this is just a UX loop limiter so auto-play doesn't
// stall on a paywalled track.
const __CSSOS_PREVIEW_CAP_SECS = 30;
let __cssosPreviewTimerId = null;
function __cssosClearPreviewTimer() {
  if (__cssosPreviewTimerId != null) {
    clearTimeout(__cssosPreviewTimerId);
    __cssosPreviewTimerId = null;
  }
}

// CSSOS_WAVE_251 20260520 — Jing (强调三遍): 切歌时上一首的标题/字幕/画面/
// 视频残留会带到下一首. 在加载下一首之前, 先把当前 surface 彻底清空到
// 空屏 —— 视频帧 + 帧序列 + 封面缩略图 + artwork pool (resetWatchVideo
// PreviewModule), 音频源, 字幕时间轴缓存 + 卡拉OK DOM 行. 之后
// openMarketWorkPreview 会用新歌内容全量重渲染; 这一步只保证切换间隙是
// 干净空屏而不是旧歌的残帧/旧字幕.
function __cssosBlankWatchSurfaceForSwapModule() {
  try { resetWatchVideoPreviewModule(); } catch (_e) {}
  try {
    if (typeof watchAudioPreview !== "undefined" && watchAudioPreview) {
      watchAudioPreview.pause?.();
      watchAudioPreview.removeAttribute("src");
      watchAudioPreview.load?.();
    }
  } catch (_e) {}
  try {
    if (globalThis.watchKaraokeTimelineCache) globalThis.watchKaraokeTimelineCache.data = null;
  } catch (_e) {}
  try {
    if (typeof watchKaraokeLine !== "undefined" && watchKaraokeLine) watchKaraokeLine.innerHTML = "";
  } catch (_e) {}
  // CSSOS_WAVE_261 20260521 — Jing(#2): 切歌瞬间也即时清空标题/字幕 overlay 文本.
  // 之前只清了视频/音频/卡拉OK; 标题(#watch-title-text + 帧内 .cssmv-mv-title)
  // 和字幕(#watch-subtitle)要等 openMarketWorkPreview 异步重渲才更新, 中间会
  // 闪一下上一首的旧标题/字幕. 这里先硬清到空, 新歌再全量重渲, 杜绝残影.
  try {
    document.querySelectorAll(".watch-title-text, #watch-title-text, .cssmv-mv-title")
      .forEach((el) => { try { el.textContent = ""; } catch (_e2) {} });
  } catch (_e) {}
  try {
    const __sub = document.getElementById("watch-subtitle");
    if (__sub) __sub.textContent = "";
  } catch (_e) {}
  // CSSOS_WAVE_281 20260521 — Jing: 还要清【头部标题栏】"WATCH · 上一首" 和
  // 缓存里的 pipelineState.title —— 否则切歌瞬间头部仍显示上一首标题(media
  // 已换), 且 mv-title-sync 观察器会把这个旧标题栏文本又推回大 overlay,
  // 造成"音视频是新歌、标题还是旧歌"的串台. 先清到只剩品牌前缀, 新歌再填.
  try {
    const __pt = document.querySelector("#watch-panel .panel-title");
    if (__pt) {
      const cur = String(__pt.textContent || "").trim();
      let brand = "Watch";
      if (cur && cur.includes("·")) brand = cur.slice(0, cur.indexOf("·")).trim() || brand;
      __pt.textContent = brand;
    }
  } catch (_e) {}
  try { if (globalThis.cssosMvPipelinePanelState) { const ps = globalThis.cssosMvPipelinePanelState(); if (ps) ps.title = ""; } } catch (_e) {}
  try { document.querySelectorAll(".watch-frame-title, #watch-frame-title").forEach((el) => { el.textContent = ""; }); } catch (_e) {}
}

function applyWatchQueueItemModule(item) {
  if (!item) return;
  __cssosClearPreviewTimer();
  // CSSOS_WAVE_362 20260523 — Jing「串台根治: 只按 ID 重放, 清除旧的」.
  // 队列连播(滚轮/滑动/ended 自动连播)此前直接改 video/audio/title, 却【从不
  // 调 cssosBindToWorkId】→ 工作区 ID 还停在上一首 → 幻灯池不重取、字幕 cue 不重绑、
  // 没有视频 URL 时 video 还留着上一首 → 「只有歌声是对的, 标题/字幕/幻灯/视频全是
  // 另一首的」. 现在在切歌最前面按【新作品 ID】硬绑定: flushAllAssetCaches() 会清空
  // pipelineState 25+ 输出字段 + 帧缓存 + video/cover/subtitle/audio 元素, 并按新 ID
  // 重新拉取幻灯池. 之后下方代码再用本 item 的字段重新水合 —— 全部来源于同一 ID.
  try {
    if (typeof globalThis.cssosBindToWorkId === "function") {
      globalThis.cssosBindToWorkId(item);
    }
  } catch (_e) {}
  // CSSOS_WAVE_251 — 切歌前硬清空, 杜绝上一首残留串到下一首.
  __cssosBlankWatchSurfaceForSwapModule();
  // CSSOS_PHASE2_FULL_SWAP_ON_NAV 20260430 #236 — Jing
  // "切换歌的时候，只是切换视频而已，音频还是旧的，连标题也是旧的，
  //  歌词也是旧的。应该全部切换."
  //
  // Delegate to the canonical card-click renderer so EVERYTHING re-renders
  // from the new item: cover, title overlay, lyrics editor, seed summary,
  // take toggle, both <audio> + <video> sources, take auto-advance state,
  // sibling cross-link, watch panel commerce actions. The partial-swap
  // path below stays as a fallback only when the renderer hasn't loaded
  // (e.g. very early in page boot before app.market-commerce.js finishes
  // initialising).
  if (typeof globalThis.openMarketWorkPreview === "function") {
    try {
      void globalThis.openMarketWorkPreview({
        id: item.id,
        work_id: item.id,
        title: item.title,
        cover_image: item.cover_url,
        cover_image_url: item.cover_url,
        preview_image_url: item.cover_url,
        preview_video_url: item.preview_video_url,
        final_mv_url: item.final_mv_url,
        audio_track_1_url: item.audio_track_1_url,
        audio_track_2_url: item.audio_track_2_url,
        subtitle_srt_url: item.subtitle_srt_url,
        duration_secs: item.duration_secs,
        lyrics_preview: item.lyrics_preview,
        lyrics_full: item.lyrics_preview,
        sibling_work_id: item.sibling_work_id,
        take_index: item.take_index,
        root_work_id: item.root_work_id,
        sequence_index: item.sequence_index,
        // CSSOS_WAVE_262 — 把"作者"身份带进去, 头像/DM/打赏才认作者而非当前用户.
        owner_id: item.owner_id,
        owner_user_id: item.owner_id,
        owner_name: item.owner_name,
        owner_avatar_url: item.owner_avatar_url,
        is_own: item.is_own,
      });
      return;
    } catch (e) {
      console.warn("[watch-queue] openMarketWorkPreview re-render failed, falling back to partial swap:", e);
    }
  }
  try {
    const audioEl = document.getElementById("watch-audio-preview");
    const videoEl = document.getElementById("watch-video");
    const url = String(item.final_mv_url || item.preview_video_url || "").trim();
    // CSSOS_PHASE2_AUTOPLAY_AFTER_SWIPE 20260430 #232b — Jing
    // "切换了就要自动播放呀。" Decide ONCE per item whether the audio
    // element is the source of truth (modern works with audio_track_1)
    // or the video's baked-in track (legacy works missing audio assets).
    // - hasAudioElSrc: mute video, drive sound from <audio>
    // - else:          unmute video, let the MP4's baked-in track play
    // This kills the "no sound after swipe" failure mode where the
    // queue silently advanced to a legacy work, video was muted, audio
    // element had no src, and the user heard nothing.
    const hasAudioElSrc = !!(audioEl && item.audio_track_1_url);
    if (videoEl && url) {
      // CSSOS_PHASE2_PRESERVE_ASPECT 20260430 #235 — clear the previous
      // item's source-aspect tag so the new item's loadedmetadata can
      // re-derive from its own dimensions. Don't clear userOverrodeAspect
      // — that's the user's explicit choice, persists across queue moves.
      try {
        const frame = document.querySelector("#watch-panel .watch-frame");
        if (frame) delete frame.dataset.sourceAspect;
      } catch (_e) {}
      videoEl.src = url;
      videoEl.load && videoEl.load();
      // CSSOS_PHASE2_PRIME_NO_MUTE 20260501 #256 — never preemptively
      // mute the video. Take 1 audio is baked in; the user hears it.
      // switchToTake(2) is the ONE path that mutes video + unmutes
      // <audio> with a fresh gesture context.
      videoEl.muted = false;
      if (videoEl.play) {
        videoEl.play().catch((err) => {
          // CSSOS_PHASE2_VIDEO_FALLBACK 20260501 #249 — Jing
          // "在一些自动播放视频受限的环境，如Tesla的浏览器，应该
          //  fallback到自动播放音频，至于画面，可以做一个参数，默认
          //  播放视频的增强版幻灯或者切换到Music标签页. 绝对不要再让
          //  用户每一首歌都要再去点击一下才播放声音."
          //
          // Don't install a per-song click recovery — that's the
          // exact UX the user is asking us to kill. Instead: continue
          // audio playback (audio autoplay rules are far more permissive)
          // and apply the configured visual fallback.
          console.warn("[watch-queue] video.play() rejected → audio-only fallback:", err?.name || err);
          activateVideoBlockedFallbackModule(item, videoEl);
        });
      }
      // Read source dimensions once available + re-shape watch frame.
      try { applyVideoSourceAspectModule(); } catch (_e) {}
    }
    if (hasAudioElSrc) {
      // Prime + play in the same user-initiated gesture chain (swipe /
      // wheel / arrow → watchQueueAdvanceModule → applyWatchQueueItem).
      // Each of those gestures is a valid user activation, so audio.play()
      // is allowed by the autoplay policy. Subsequent programmatic plays
      // from ended-handlers also work because this play() registers the
      // element as "user-activated" for the rest of the session.
      audioEl.src = item.audio_track_1_url;
      audioEl.muted = false;
      audioEl.load && audioEl.load();
      if (audioEl.play) {
        audioEl.play().catch((err) => {
          console.warn("[watch-queue] audio.play() rejected:", err);
          const recover = () => {
            audioEl.play && audioEl.play().catch(() => {});
            document.removeEventListener("click", recover, true);
          };
          document.addEventListener("click", recover, true);
        });
      }
    } else if (audioEl) {
      // No audio asset for this item — pause/clear the audio element so
      // a stale src from the previous item doesn't keep playing on top.
      try {
        audioEl.pause();
        audioEl.removeAttribute("src");
        audioEl.load && audioEl.load();
      } catch (_e) {}
    }
    // Update title overlay if present
    try {
      const titleEl = document.querySelector(".watch-title-text, #watch-title-text");
      if (titleEl) titleEl.textContent = item.title || "";
    } catch (_e) {}
    // CSSOS_PHASE2_MV_ART_TITLE_REFRESH 20260503 — Jing
    // Loop list / wheel / arrow / queue-advance all flow through here.
    // The big in-frame title overlay (.cssmv-mv-title) is owned by
    // app.watch-media-overlays.js and only repaints when explicitly told,
    // so without this call it kept showing the FIRST song's title every
    // time the user advanced the queue. PR #6 patched the card-click
    // path; this patches the wheel / Loop-list / next-track path.
    try {
      const newTitle = String(item?.title || "").trim();
      if (newTitle && typeof globalThis.cssmvRenderMvArtTitle === "function") {
        globalThis.cssmvRenderMvArtTitle(newTitle);
      }
    } catch (_e) {}
    // Push into pipeline state so Take 1/Take 2 toggle works.
    try {
      const pipelineState = globalThis.cssosMvPipelinePanelState
        ? globalThis.cssosMvPipelinePanelState()
        : null;
      if (pipelineState) {
        pipelineState.mvUrl = url;
        pipelineState.audioUrl = item.audio_track_1_url || null;
        pipelineState.altAudioUrl = item.audio_track_2_url || null;
        pipelineState.duration = Number(item.duration_secs || 0) || 0;
        pipelineState.title = item.title || "";
        pipelineState.lyrics = (typeof globalThis.cssosNormalizeLyricsText === "function")
          ? globalThis.cssosNormalizeLyricsText(item.lyrics_preview || "")
          : (item.lyrics_preview || "");
        // Reset Take state when switching MVs.
        pipelineState.currentTake = 1;
        // CSSOS_PHASE2_DUAL_TRACK 20260430 #221b — pairKey/sibling
        // bridged from queue payload so the played-takes map can gate
        // queue advance until BOTH takes of this work have played.
        pipelineState.siblingWorkId = item.sibling_work_id || null;
        const ownId = String(item.id || "").trim();
        const sibId = String(item.sibling_work_id || "").trim();
        pipelineState.workId =
          ownId && sibId ? [ownId, sibId].sort().join("|") : ownId || (item.title || "");
        // Track structural lineage so the queue never tears a triptych
        // or opera in half. CSSOS_PHASE2_SELF_FIRST_STRUCTURAL #227.
        pipelineState.rootWorkId = item.root_work_id || null;
        pipelineState.sequenceIndex = item.sequence_index ?? null;
      }
    } catch (_e) {}
    // CSSOS_PHASE2_DUAL_TRACK 20260430 #229 — re-inject the ♪1/♪2 toggle
    // every time the queue advances to a new work. The hoisted injector
    // is idempotent: it'll create the pill on first call and just refresh
    // the active highlight on subsequent calls. If the new work has no
    // alt audio, it strips the toggle so single-track engines (older
    // ElevenLabs runs) don't show a misleading pill.
    try {
      if (typeof globalThis.__cssosInjectTakeToggle === "function") {
        globalThis.__cssosInjectTakeToggle({
          altAudioUrl: item.audio_track_2_url || null,
          currentTake: 1,
        });
      }
    } catch (_e) { /* toggle inject best-effort */ }
    // CSSOS_PHASE2_PREVIEW_CAP 20260430 #222 — REMOVED 20260506 — Jing
    // The old 30s setTimeout + toast + queue-advance was a UX-side
    // duplicate of the real preview-cap which now lives in
    // app.preview-cap.js (server-driven via X-Preview-Limit-Seconds,
    // tier-aware paywall overlay with 10s auto-advance countdown).
    // Clear any leftover legacy timer so a stale schedule can't fire.
    try { clearTimeout(__cssosPreviewTimerId); } catch (_e) {}
    __cssosPreviewTimerId = null;
  } catch (_e) { /* apply best-effort */ }
}

async function watchQueueAdvanceModule(direction = +1, _wrapDepth = 0) {
  // CSSOS_WAVE_272 20260521 — Jing(P1 双击切歌锁): 快速双滑/双击会并发触发多次
  // advance, applyWatchQueueItemModule 是 fire-and-forget(不 await), 两个异步
  // 渲染交错 → 上一首的标题/字幕/画面残余串到下一首(用户强调三遍的痛点).
  // 防抖锁: 一次切歌 settle 前(450ms)忽略后续 advance, 一处覆盖所有入口
  // (滚轮 / 触摸滑动 / autoplay-feed / ended-自动连播). _wrapDepth>0 是内部
  // "跳过不可播放项"的换行递归, 属同一次切歌, 不受锁限制.
  if (_wrapDepth === 0) {
    const __now = Date.now();
    if (__now < (globalThis.__cssosWatchAdvanceLockUntil || 0)) return;
    globalThis.__cssosWatchAdvanceLockUntil = __now + 450;
  }
  // CSSOS_PHASE2_PLAYLISTS 20260430 #239 — Jing
  // "请制作一个播放列表... 多种方式播放."
  // Prefer the cssosPlaylists module (sequential / reverse / shuffle /
  // loop_all / loop_single + named lists for-you / mine / custom).
  // Falls back to the legacy __cssosWatchQueue if the module isn't
  // loaded.
  if (globalThis.cssosPlaylists) {
    try {
      const item = direction > 0
        ? await globalThis.cssosPlaylists.next()
        : await globalThis.cssosPlaylists.prev();
      if (!item) {
        if (typeof globalThis.showToast === "function") {
          const mode = globalThis.cssosPlaylists.getMode();
          // CSSOS_WAVE_273 20260521 — Jing(P2 i18n): 这些播放期 toast 之前写死,
          // 中文用户看到英文/混排. 统一走 loginCopy(en, zh) 双语.
          if (mode === "sequential") globalThis.showToast(loginCopy("End of playlist — switch to loop to keep playing.", "已到列表末尾(顺序播放)。切换到列表循环可继续。"));
          else if (mode === "reverse") globalThis.showToast(loginCopy("Start of playlist (reverse).", "已到列表开头(倒序播放)。"));
          else globalThis.showToast(loginCopy("No playable items in the playlist.", "列表里暂无可播放的作品。"));
        }
        return;
      }
      applyWatchQueueItemModule(item);
      return;
    } catch (e) {
      console.warn("[watch-queue] playlist advance failed, falling back:", e);
    }
  }
  if (!__cssosWatchQueue.items.length) {
    await fetchWatchQueueMoreModule();
  }
  if (!__cssosWatchQueue.items.length) {
    if (typeof globalThis.showToast === "function") {
      globalThis.showToast(loginCopy("Queue is empty.", "播放队列是空的。"));
    }
    return;
  }
  // Prefetch ahead when we're 2 from the end.
  if (
    __cssosWatchQueue.items.length - __cssosWatchQueue.index <= 3 &&
    !__cssosWatchQueue.exhausted
  ) {
    void fetchWatchQueueMoreModule();
  }
  // CSSOS_PHASE2_QUEUE_WRAP 20260430 #233 — Jing
  // "没有音频，没有视频的作品，就判定到头了，再从头继续播放."
  // Wrap around at both ends. Past the last item → restart at items[0].
  // Before items[0] → wrap to items[length-1]. Skip items that have no
  // playable media at all (final_mv_url + preview_video_url + audio
  // tracks all empty) — they're treated like "end-of-queue" so the
  // chain keeps moving without dead-end stalling on legacy drafts.
  // _wrapDepth guards against infinite recursion if every item is
  // unplayable.
  let next = __cssosWatchQueue.index + direction;
  const len = __cssosWatchQueue.items.length;
  if (next < 0) next = len - 1;          // wrap to tail
  else if (next >= len) next = 0;         // wrap to head — "再从头继续播放"
  __cssosWatchQueue.index = next;
  const item = __cssosWatchQueue.items[next];
  const hasMedia = !!(item && (
    String(item.final_mv_url || "").trim() ||
    String(item.preview_video_url || "").trim() ||
    String(item.audio_track_1_url || "").trim() ||
    String(item.audio_track_2_url || "").trim()
  ));
  if (!hasMedia) {
    if (_wrapDepth >= len) {
      // Whole queue is unplayable — bail out gracefully.
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(loginCopy("No playable items in the queue right now.", "当前队列暂无可播放的作品。"));
      }
      return;
    }
    console.warn(
      "[watch-queue] item %s has no media — wrapping to next",
      item?.id || next
    );
    return watchQueueAdvanceModule(direction, _wrapDepth + 1);
  }
  applyWatchQueueItemModule(item);
}

let __cssosWatchEndedWired = false;
function wireWatchQueueAutoAdvanceOnceModule() {
  if (__cssosWatchEndedWired) return;
  const videoEl = document.getElementById("watch-video");
  const audioEl = document.getElementById("watch-audio-preview");
  if (!videoEl) return;
  __cssosWatchEndedWired = true;

  // CSSOS_PHASE2_TAKE_AUTO_ADVANCE 20260430 #208c → #221b — Jing
  // "用户欣赏第一首,右上角的胶囊要出现,也就是说,欣赏一首,另一首必须是
  //  下一首。如果是打开第二首,右上角胶囊也要显示第一首,也是要欣赏完
  //  两首,才会继续别的用户的作品."
  //
  // Played-takes set keyed by (work_id|sibling_id) — symmetric across
  // both takes of a generation pair. When a take finishes:
  //   1. Find the OTHER take (use altAudioUrl if present, OR the
  //      sibling work_id from pipelineState.siblingWorkId).
  //   2. If the other take hasn't played yet in this session → switch
  //      to it (regardless of whether we started from Take 1 or 2).
  //   3. Both takes consumed → only NOW advance queue to next MV.
  // Loop modes (single / both takes) still take precedence and are
  // owned by the right-click loop cycler in mv-pipeline-panel.js.
  if (!globalThis.__cssosPlayedTakes) globalThis.__cssosPlayedTakes = new Map();
  const playedTakes = globalThis.__cssosPlayedTakes;
  // CSSOS_PHASE2_AUTO_ADVANCE 20260430 #231 — Jing
  // "随便点击播放一首歌，播放完毕，没有自动播放下一首。请修复."
  // Backstop: if audio.ended never fires (autoplay-policy block on Take 2,
  // missing audio_track_2_url, etc.), force the queue to advance after a
  // generous duration so the chain never stalls. Cancel the backstop on
  // user interactions / explicit advances.
  const scheduleAutoAdvanceBackstop = (durationSecs) => {
    try { clearTimeout(globalThis.__cssosAdvanceBackstopId); } catch (_e) {}
    const dur = Math.max(60, Number(durationSecs || 0) + 30);
    globalThis.__cssosAdvanceBackstopId = setTimeout(() => {
      console.warn(
        "[watch-queue][backstop] forced advance after %ss — audio.ended never fired",
        dur
      );
      void watchQueueAdvanceModule(+1);
    }, dur * 1000);
  };
  globalThis.__cssosScheduleAutoAdvanceBackstop = scheduleAutoAdvanceBackstop;
  const onMediaEnded = () => {
    console.warn("[watch-queue] media ended, evaluating advance");
    try {
      const ps = globalThis.cssosMvPipelinePanelState
        ? globalThis.cssosMvPipelinePanelState()
        : null;
      if (ps && (ps.loopMode === 1 || ps.loopMode === 2)) {
        console.warn("[watch-queue] loop mode active → not advancing");
        return;
      }
      const currentTake = Number(ps?.currentTake || 1);
      const altUrl = String(ps?.altAudioUrl || "").trim();
      const siblingWorkId = String(ps?.siblingWorkId || "").trim();
      const pairKey = String(ps?.workId || ps?.runId || ps?.title || "").trim();
      if (pairKey) {
        const set = playedTakes.get(pairKey) || new Set();
        set.add(currentTake);
        playedTakes.set(pairKey, set);
        const other = currentTake === 1 ? 2 : 1;
        const otherExists = !!(altUrl || siblingWorkId);
        if (otherExists && !set.has(other)) {
          console.warn("[watch-queue] switching to ♪ %d", other);
          const sw = globalThis.__cssosWatchTakeSwitcher;
          if (typeof sw === "function") {
            sw(other);
            // Schedule backstop in case the take-2 audio doesn't fire
            // its own ended event (autoplay policy etc.).
            const altDur = Number(ps?.altDuration || ps?.duration || 0);
            scheduleAutoAdvanceBackstop(altDur);
            return;
          }
        }
        if (set.has(1) && set.has(2)) playedTakes.delete(pairKey);
      } else if (currentTake === 1 && altUrl) {
        console.warn("[watch-queue] fallback: switch to ♪ 2");
        const sw = globalThis.__cssosWatchTakeSwitcher;
        if (typeof sw === "function") {
          sw(2);
          // CSSOS_PHASE2_TAKE2_BACKSTOP 20260501 #254 — fall back to
          // duration (Take 1's length), then to a 6-minute headroom so
          // the backstop never fires mid-Take 2.
          const altDur = Number(ps?.altDuration || ps?.duration || 360);
          scheduleAutoAdvanceBackstop(altDur);
          return;
        }
      }
    } catch (e) {
      console.warn("[watch-queue] onMediaEnded threw:", e);
    }
    // Clear backstop — we're advancing for real now.
    try { clearTimeout(globalThis.__cssosAdvanceBackstopId); } catch (_e) {}
    console.warn("[watch-queue] advancing to next item");
    void watchQueueAdvanceModule(+1);
  };
  videoEl.addEventListener("ended", onMediaEnded);
  if (audioEl) audioEl.addEventListener("ended", onMediaEnded);
  // CSSOS_PHASE2_KARAOKE_LIVE 20260430 #199 — Jing
  // "字幕跟随 audio.currentTime — fix watch overlay subtitle renderer."
  // Live karaoke: on every timeupdate (~250ms), look up the active
  // line by currentTime against either (a) pipelineState.alignedLyrics
  // when the engine emitted per-line timing, or (b) an even-divide
  // fallback over pipelineState.lyrics. Single source of timing truth
  // is whichever element is currently driving sound — pipelineState
  // tracks that via the muted flags we set in switchToTake.
  wireWatchKaraokeLiveOnceModule(videoEl, audioEl);
}

// CSSOS_PHASE2_SECTION_FILTER 20260504 — Jing
// "[Verse 1] 或者 Verse 1，虽然没有在 [] 里，像这类很明显不是歌词的
//  文字，就不要再显示在字幕里，这回是必须是纯纯的歌词".
//
// Used by every karaoke timeline source (SRT parser, aligned_lyrics
// engine output, even-divide fallback). Returns true when the line
// is a structural marker that shouldn't appear as a karaoke caption.
// The lyrics BODY in the lyrics card / mvp-lyrics textarea is left
// untouched — section markers there help the user see structure.
function isLyricSectionMarkerModule(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  // Bracketed: [Verse 1], 【主歌】, （Outro）, **Bridge**, (Intro)
  if (/^\s*[\[【(（*]+[^\]】)）*]*[\]】)）*]+\s*$/.test(t)) return true;
  // Bare English keywords with optional number / separator: "Verse",
  // "Verse 1", "Chorus:", "Pre-Chorus 2-", "Hook.", "Refrain"
  if (/^(verse|chorus|bridge|intro|outro|pre[-\s]?chorus|post[-\s]?chorus|hook|refrain|interlude|breakdown|drop|build|coda|reprise|tag)\s*\d*\s*[:.\-—]?\s*$/i.test(t)) return true;
  // Bare Chinese keywords
  if (/^(主歌|副歌|桥段|前奏|引子|间奏|过门|和声|尾声|结尾|尾奏|桥)\s*\d*\s*[:：.。\-—]?\s*$/.test(t)) return true;
  // Pure punctuation / emoji-only / number-only
  if (/^[\s\d:;,.\-—!?'"·•]+$/.test(t)) return true;
  return false;
}
globalThis.isLyricSectionMarkerModule = isLyricSectionMarkerModule;

// CSSOS_PHASE2_SRT_FALLBACK 20260504 — Jing
// Parse a raw SRT blob into the alignedLyrics shape so the karaoke
// renderer can sync to vocals when the work was persisted with only
// subtitle_srt_url (older works pre-aligned_lyrics column).
function parseSrtToAlignedLyricsModule(srtText) {
  if (!srtText || typeof srtText !== "string") return [];
  const out = [];
  // SRT cues are separated by blank lines. The cue header is either
  // numeric index OR straight to the timestamp on some emitters; be
  // forgiving.
  const blocks = srtText.replace(/﻿/g, "").split(/\r?\n\r?\n+/);
  const tsRx = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split(/\r?\n/);
    let tsLineIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 3); i += 1) {
      if (tsRx.test(lines[i])) { tsLineIdx = i; break; }
    }
    if (tsLineIdx < 0) continue;
    const m = lines[tsLineIdx].match(tsRx);
    if (!m) continue;
    const toSec = (h, mm, s, ms) =>
      Number(h) * 3600 + Number(mm) * 60 + Number(s) + Number(ms.padEnd(3, "0").slice(0, 3)) / 1000;
    const start_s = toSec(m[1], m[2], m[3], m[4]);
    const end_s = toSec(m[5], m[6], m[7], m[8]);
    const textLines = lines.slice(tsLineIdx + 1)
      .map((l) => l.trim())
      .filter((l) => l && !/^\d+$/.test(l));
    const text = textLines.join(" ").trim();
    // CSSOS_PHASE2_SECTION_FILTER 20260504 — drop "[Verse 1]" / "Chorus" /
    // 主歌 / 副歌 etc. so the karaoke caption stays pure lyric.
    if (text && !isLyricSectionMarkerModule(text)) {
      out.push({ start_s, end_s, text });
    }
  }
  return out;
}
globalThis.parseSrtToAlignedLyricsModule = parseSrtToAlignedLyricsModule;

// CSSOS_PHASE2_SRT_HYDRATE_CACHE 20260504 — guard against re-fetching
// the same SRT URL while a request is in flight or already resolved.
const __cssosSrtHydrateCache = new Map(); // url → "pending"|aligned[]

async function hydrateAlignedFromSrtUrlModule(srtUrl, pipelineStateRef) {
  if (!srtUrl) return null;
  if (__cssosSrtHydrateCache.has(srtUrl)) {
    const cached = __cssosSrtHydrateCache.get(srtUrl);
    return cached === "pending" ? null : cached;
  }
  __cssosSrtHydrateCache.set(srtUrl, "pending");
  try {
    const res = await fetch(srtUrl, { credentials: "include" });
    if (!res.ok) {
      __cssosSrtHydrateCache.set(srtUrl, []);
      return null;
    }
    const txt = await res.text();
    const aligned = parseSrtToAlignedLyricsModule(txt);
    __cssosSrtHydrateCache.set(srtUrl, aligned);
    if (pipelineStateRef && Array.isArray(aligned) && aligned.length > 0) {
      pipelineStateRef.alignedLyrics = aligned;
      console.info(
        "%c[karaoke] hydrated %d aligned cues from SRT (%s)",
        "color:#0a0;font-weight:bold", aligned.length, srtUrl.slice(0, 80)
      );
    }
    return aligned;
  } catch (err) {
    __cssosSrtHydrateCache.set(srtUrl, []);
    console.warn("[karaoke] SRT hydrate failed:", err);
    return null;
  }
}

// CSSOS_PHASE2_SINGLE_WRITER 20260504 — Jing
// "我觉得必须要动的，只留下一个正确的就好，不然互相打架，耗费服务器
//  算力."
//
// All non-karaoke writers route through this single helper. When the
// karaoke renderer owns the subtitle (timeline non-empty AND a line
// is currently active) this no-ops — no DOM mutation, no compute
// wasted, no fight. When karaoke is idle (pre-pipeline / paused /
// between lines) the status text comes through.
//
// Karaoke renderer continues to write directly to .textContent +
// tag dataset.cssmvOrigin = "karaoke-live" so the MutationObserver
// belt-and-suspenders also kicks in for any future writer that
// forgets to call this helper.
function safeSetWatchSubtitleModule(text) {
  if (!watchSubtitle) return;
  if (typeof globalThis.cssosKaraokeOwnsSubtitle === "function" &&
      globalThis.cssosKaraokeOwnsSubtitle()) {
    return;
  }
  const next = String(text == null ? "" : text);
  if (watchSubtitle.textContent === next) return; // no-op idempotent
  // CSSOS_PHASE2_FANCY_VISIBLE 20260504 — Jing
  // "光光代码通过了还不行，必须让用户看得到". The fancy 90/10 picker
  // only ran inside the karaoke per-char renderer, so any subtitle the
  // user sees BEFORE karaoke takes ownership (status messages, "Music:
  // Rising shofar motif…", hot-swap text, the four-tier waterfall's
  // empty windows) was painted as plain textContent — uniform sans-
  // serif. Wrap every word in a span with a weighted-fancy font so the
  // user IMMEDIATELY sees the龙飞凤舞 effect on every subtitle line.
  const pickFont = (typeof globalThis.cssmvAssignFontForPiece === "function")
    ? globalThis.cssmvAssignFontForPiece : null;
  if (pickFont && next.trim()) {
    // Tokenise: keep CJK chars as individual tokens, group Latin letters
    // into words, preserve spaces. This way a CN subtitle gets per-char
    // font variation and an EN subtitle gets per-word variation — both
    // produce visible "every token a different fancy face" output.
    const escapeAttr = (s) => String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;");
    const escapeText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tokenRx = /([一-鿿㐀-䶿぀-ヿ가-힯])|([A-Za-z][A-Za-z'’\-]*[A-Za-z]|[A-Za-z])|(\s+)|([^\s])/gu;
    let html = "";
    let m;
    while ((m = tokenRx.exec(next)) !== null) {
      const cjk = m[1], word = m[2], ws = m[3], other = m[4];
      if (ws) { html += escapeText(ws); continue; }
      const tok = cjk || word || other;
      if (!tok) continue;
      const fam = pickFont(tok) || "";
      const safe = escapeText(tok);
      if (fam) {
        const escFam = escapeAttr(fam).replace(/&amp;quot;/g, '"');
        html += `<span class="cssmv-fancy-tok" style="font-family:'${escFam}', var(--watch-subtitle-font-family, inherit)">${safe}</span>`;
      } else {
        html += safe;
      }
    }
    watchSubtitle.innerHTML = html;
  } else {
    watchSubtitle.textContent = next;
  }
  watchSubtitle.dataset.cssmvOrigin = "status";
}
globalThis.safeSetWatchSubtitleModule = safeSetWatchSubtitleModule;

let __cssosKaraokeWired = false;
let __cssmvKaraStripSet = null;
function wireWatchKaraokeLiveOnceModule(videoEl, audioEl) {
  if (__cssosKaraokeWired) return;
  __cssosKaraokeWired = true;

  // Cache: lazily-built timeline per work signature. Recomputed when
  // pipelineState.title or lyrics changes.
  let cachedSig = "";
  let cachedTimeline = []; // [{start_s, end_s, text, words?}]
  let lastIdx = -1;
  let lastSrtFetchSig = "";
  // CSSOS_WAVE_159 20260514 — 情绪字幕引擎. When the music engine
  // emitted a WORD-level timeline (Suno + Whisper forced-alignment,
  // unit:"word"), we keep the raw word list here and build line cues
  // that carry a `.words` sub-array. The per-character renderer reads
  // those REAL word windows instead of even-dividing the line duration
  // — a held note gets a long window, a clipped syllable a short one.
  let cachedWordTimeline = null; // [{text,start_s,end_s}] or null

  // CSSOS_PHASE2_KARAOKE_GUARD 20260504 — Jing
  // "歌词还是只闪了几下，就是不显示出来，我觉得是被什么吃掉了."
  //
  // Root cause: 20+ other writers in app.watch-ui.js do
  // `watchSubtitle.textContent = "<status>"` ("KaraOKe MV · Composing
  // music now", "preview", "Mobile browser blocked autoplay…", etc).
  // Each one stomps the lyric the karaoke tick just wrote. On every
  // ~250ms tick the karaoke writes again, the next status writer
  // stomps again — producing the flash-then-blank pattern.
  //
  // Defend with a MutationObserver: when karaoke has a non-empty
  // timeline AND a current line, any external mutation that empties
  // the subtitle or replaces it with non-karaoke text gets reverted
  // on the next microtask. We tag our own writes with
  // dataset.cssmvOrigin = "karaoke-live" so the observer can tell
  // its own writes apart from foreign ones.
  let karaokeReapplying = false;
  let lastAppliedLine = null;

  // CSSOS_PHASE2_SINGLE_WRITER 20260504 — Jing
  // Exposed for safeSetWatchSubtitleModule. Karaoke "owns" the
  // subtitle whenever it has a timeline AND has applied a line.
  // External status writers route through safeSetWatchSubtitle which
  // checks this and silently no-ops while karaoke is the rightful
  // owner. Defined AFTER lastAppliedLine so the closure captures it.
  globalThis.cssosKaraokeOwnsSubtitle = () => {
    return cachedTimeline.length > 0 && lastAppliedLine !== null;
  };
  const reapplyKaraokeLine = () => {
    if (!lastAppliedLine) return;
    const sub = document.getElementById("watch-subtitle");
    if (!sub) return;
    karaokeReapplying = true;
    try {
      sub.textContent = lastAppliedLine.text;
      sub.dataset.cssmvOrigin = "karaoke-live";
    } finally {
      // Clear the flag on next microtask so the observer doesn't
      // skip our SUBSEQUENT genuine writes.
      Promise.resolve().then(() => { karaokeReapplying = false; });
    }
  };
  try {
    const subForObs = document.getElementById("watch-subtitle");
    if (subForObs && typeof MutationObserver === "function") {
      const obs = new MutationObserver(() => {
        if (karaokeReapplying) return;
        if (!cachedTimeline.length || !lastAppliedLine) return;
        const cur = (subForObs.textContent || "").trim();
        // If a foreign writer cleared us OR replaced our lyric with
        // a status string, restore the active karaoke line.
        if (cur !== lastAppliedLine.text) {
          reapplyKaraokeLine();
        }
      });
      obs.observe(subForObs, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  } catch (_e) { /* MutationObserver unsupported — degrade gracefully */ }

  const buildTimeline = (ps) => {
    // Tier 1: engine-emitted aligned_lyrics (Suno per-line timing).
    const aligned = Array.isArray(ps?.alignedLyrics) ? ps.alignedLyrics : null;
    // CSSOS_WAVE_159 — WORD-level path. When the entries are unit:"word"
    // (Suno run that got Whisper forced-alignment), do NOT treat each
    // word as its own karaoke line — that would flash one word at a
    // time. Instead: keep the raw word list, then re-group words back
    // into the lyric LINES (from ps.lyrics) so the karaoke display
    // still shows whole lines, while every line cue carries a `.words`
    // sub-array of REAL per-word [start_s,end_s] windows for the
    // per-character emotional renderer to bite-sync against.
    cachedWordTimeline = null;
    if (aligned && aligned.length > 0 &&
        aligned.some((e) => String(e && e.unit) === "word")) {
      const words = aligned
        .map((w) => ({
          text: String(w.text || "").trim(),
          start_s: Number(w.start_s != null ? w.start_s : (Number(w.start_ms || 0) / 1000)) || 0,
          end_s: Number(w.end_s != null ? w.end_s : (Number(w.end_ms || 0) / 1000)) || 0,
        }))
        .filter((w) => w.text && w.end_s > w.start_s)
        .sort((a, b) => a.start_s - b.start_s);
      if (words.length) {
        cachedWordTimeline = words;
        // Group the words back into display lines. Prefer the real
        // lyric line breaks from ps.lyrics; fall back to one line per
        // word if no lyrics text is available.
        const lyricLines = String(ps?.lyrics || "")
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !isLyricSectionMarkerModule(l));
        const cues = [];
        if (lyricLines.length) {
          const nonSpaceLen = (s) => Array.from(String(s).replace(/\s+/g, "")).length;
          let wi = 0;
          for (let li = 0; li < lyricLines.length && wi < words.length; li += 1) {
            const need = Math.max(1, nonSpaceLen(lyricLines[li]));
            const group = [];
            let got = 0;
            // Consume words until this line's character budget is met.
            while (wi < words.length && got < need) {
              const w = words[wi];
              group.push(w);
              got += Math.max(1, nonSpaceLen(w.text));
              wi += 1;
            }
            if (!group.length) break;
            cues.push({
              start_s: group[0].start_s,
              end_s: Math.max(group[0].start_s + 0.25, group[group.length - 1].end_s),
              text: lyricLines[li],
              words: group,
            });
          }
          // Any leftover words (lyrics shorter than transcription) →
          // append as their own cues so nothing is dropped.
          while (wi < words.length) {
            const w = words[wi];
            cues.push({ start_s: w.start_s, end_s: Math.max(w.start_s + 0.25, w.end_s), text: w.text, words: [w] });
            wi += 1;
          }
        } else {
          for (const w of words) {
            cues.push({ start_s: w.start_s, end_s: Math.max(w.start_s + 0.25, w.end_s), text: w.text, words: [w] });
          }
        }
        if (cues.length) return cues;
      }
    }
    // Tier 2 (CSSOS_PHASE2_INLINE_SRT 20260504): parsed SRT TEXT
    // sitting on pipelineState.subtitlesSrt (set by runAll's subtitles
    // stage). Parse on the fly when aligned is missing — this is the
    // common case for For-You / fresh-pipeline runs where Suno didn't
    // emit aligned_lyrics but cssmv-local/srt-v1 generated proper
    // timing from the music duration + lyric line count.
    if ((!aligned || !aligned.length) && typeof ps?.subtitlesSrt === "string" && ps.subtitlesSrt.trim()) {
      const parsed = parseSrtToAlignedLyricsModule(ps.subtitlesSrt);
      if (parsed && parsed.length > 0) {
        return parsed.map((c) => ({
          start_s: c.start_s,
          end_s: Math.max(c.start_s + 0.25, c.end_s),
          text: c.text,
        }));
      }
    }
    if (aligned && aligned.length > 0) {
      return aligned
        .map((line) => {
          const start_s = Number(
            line.start_s !== undefined ? line.start_s : (Number(line.start_ms || 0) / 1000)
          ) || 0;
          const end_s = Number(
            line.end_s !== undefined ? line.end_s : (Number(line.end_ms || 0) / 1000)
          ) || (start_s + 3);
          return {
            start_s,
            end_s: Math.max(start_s + 0.25, end_s),
            text: String(line.text || "").trim(),
            // CSSOS_PHASE2_EMOTIONAL_SUB 20260501 #251 — preserve
            // engine-emitted emotion + emphasis if present. Older runs
            // (no annotation) leave these undefined; the karaoke tick
            // falls back to keyword inference.
            emotion: String(line.emotion || "").trim() || undefined,
            emphasis: line.emphasis != null ? Number(line.emphasis) : undefined,
          };
        })
        // CSSOS_PHASE2_SECTION_FILTER 20260504 — strip [Verse 1] /
        // Chorus / 主歌 / 副歌 markers Suno occasionally echoes back
        // as aligned lines. Keeping them here would surface them as
        // karaoke captions, which is not what they are.
        .filter((c) => c.text && !isLyricSectionMarkerModule(c.text));
    }
    // Fallback: even-divide over duration. Skip lines that look like
    // section markers ([Verse], [Chorus], etc.) — they shouldn't appear
    // as karaoke text.
    const lyrics = String(ps?.lyrics || "").trim();
    // CSSOS_PHASE2_DURATION_FROM_MEDIA 20260504 — Jing
    // "MV 已经播放到这里了，音乐歌声也已经唱了几句？字幕还是迟迟不出来,
    //  只是在开头那里闪了一下".
    // Saved works often arrive without pipelineState.duration set
    // (the work_assets row had duration_secs but it didn't bubble up
    // through the works API into pipelineState). Without a duration
    // the even-divide branch returned [] and the user got NO captions
    // at all — explaining the "flashed once" symptom (one cue from a
    // transient earlier render still visible, then nothing).
    // Fall back to whatever <video> or <audio> reports for duration
    // once the metadata loads. videoEl/audioEl are captured in the
    // outer closure of wireWatchKaraokeLiveOnceModule so they're
    // always reachable here.
    let dur = Number(ps?.duration || 0);
    if (!dur || dur < 5) {
      const vd = Number(videoEl?.duration || 0);
      const ad = Number(audioEl?.duration || 0);
      const mediaDur = Math.max(
        Number.isFinite(vd) ? vd : 0,
        Number.isFinite(ad) ? ad : 0
      );
      if (mediaDur > 5) {
        dur = mediaDur;
        // Cache it back so subsequent ticks don't hit this fallback.
        if (ps && typeof ps === "object") ps.duration = mediaDur;
      }
    }
    if (!lyrics || dur < 5) return [];
    const lines = lyrics.split(/\r?\n/)
      .map((l) => l.trim())
      // CSSOS_PHASE2_SECTION_FILTER 20260504 — drop bracketed AND bare
      // section keywords ("Verse 1", "Chorus" without []), Chinese
      // 主歌/副歌/桥段, etc. Centralised in isLyricSectionMarkerModule.
      .filter((l) => l && !isLyricSectionMarkerModule(l));
    if (!lines.length) return [];
    // CSSOS_PHASE2_WEIGHTED_DIVIDE 20260504 — Jing
    // "字幕对其歌声问题，这是硬伤". Pure even-divide ignored two real
    // facts about songs: (a) intros and outros are instrumental — no
    // lyric lives in the first ~10% or last ~5% of total duration, and
    // (b) line "weight" varies — a 2-char "啊" should not consume the
    // same slot as a 14-char line. Weighting by char-count + carving
    // out intro/outro padding moves the fallback timing dramatically
    // closer to the actual vocal performance, even before the user
    // applies the manual nudge below.
    const introPad = Math.min(8, dur * 0.08);
    const outroPad = Math.min(4, dur * 0.04);
    const usable = Math.max(dur - introPad - outroPad, dur * 0.5);
    // Weight: stripped char count, with a floor so empty/very short
    // lines still get visible airtime. CJK char ≈ 1, latin word ≈ ~5
    // chars on average so this naturally weights both scripts okay.
    const stripped = lines.map((t) => String(t).replace(/\s+/g, ""));
    const weights = stripped.map((s) => Math.max(2, s.length));
    const totalW = weights.reduce((a, b) => a + b, 0) || lines.length;
    const out = [];
    let cursor = introPad;
    for (let i = 0; i < lines.length; i += 1) {
      const slot = (weights[i] / totalW) * usable;
      const start_s = cursor;
      const end_s = cursor + slot;
      out.push({ start_s, end_s, text: lines[i] });
      cursor = end_s;
    }
    return out;
  };

  const getRawSourceTime = () => {
    // Prefer the un-muted, currently-playing element.
    const audioPlaying = audioEl && !audioEl.paused && !audioEl.muted;
    const videoPlaying = videoEl && !videoEl.paused && !videoEl.muted;
    if (audioPlaying) return Number(audioEl.currentTime || 0);
    if (videoPlaying) return Number(videoEl.currentTime || 0);
    const at = Number(audioEl?.currentTime || 0);
    const vt = Number(videoEl?.currentTime || 0);
    return Math.max(at, vt);
  };

  // CSSOS_PHASE2_KARAOKE_NUDGE 20260504 — Jing
  // "字幕对其歌声问题，这是硬伤". Even after weighted-divide the
  // automatic timing won't be perfect — instrumental breaks, ad-libs,
  // and engine-specific quirks all shift the "true" onset. Give the
  // user a per-work offset they can dial in real time:
  //   ←/→  shift -/+ 0.25s
  //   ↑/↓  shift +/- 1.0s   (yes, ↑ pushes lyrics EARLIER — feels
  //                          natural: "lyrics need to come up sooner")
  //   0    reset to 0
  // Persisted in localStorage keyed by workId|titleHash so a song
  // dialled in once stays dialled in across sessions.
  const __cssosNudgeKey = (ps) => {
    const id = String(ps?.workId || "").trim();
    const ttl = String(ps?.title || "").trim();
    if (id) return `cssos:karaNudge:${id}`;
    if (ttl) return `cssos:karaNudge:t:${ttl}`;
    return "";
  };
  let __cssosNudgeSec = 0;
  let __cssosNudgeFlashUntil = 0;
  const loadNudge = (ps) => {
    try {
      const k = __cssosNudgeKey(ps);
      if (!k) { __cssosNudgeSec = 0; return; }
      const raw = localStorage.getItem(k);
      const v = raw == null ? 0 : Number(raw);
      __cssosNudgeSec = Number.isFinite(v) ? v : 0;
    } catch (_e) { __cssosNudgeSec = 0; }
  };
  const saveNudge = () => {
    try {
      const ps = globalThis.pipelineState;
      const k = __cssosNudgeKey(ps);
      if (!k) return;
      if (Math.abs(__cssosNudgeSec) < 0.01) localStorage.removeItem(k);
      else localStorage.setItem(k, __cssosNudgeSec.toFixed(2));
    } catch (_e) {}
  };
  const flashNudgeBadge = () => {
    __cssosNudgeFlashUntil = Date.now() + 1500;
    const sub = document.getElementById("watch-subtitle");
    if (sub) {
      sub.dataset.cssosNudge = (__cssosNudgeSec >= 0 ? "+" : "") +
        __cssosNudgeSec.toFixed(2) + "s";
    }
  };
  const adjustNudge = (delta) => {
    __cssosNudgeSec = Math.max(-30, Math.min(30,
      Math.round((__cssosNudgeSec + delta) * 100) / 100));
    saveNudge();
    flashNudgeBadge();
    // Force re-pick on next tick.
    lastIdx = -1;
  };
  globalThis.cssosKaraokeNudge = adjustNudge;
  globalThis.cssosKaraokeNudgeReset = () => { __cssosNudgeSec = 0; saveNudge(); flashNudgeBadge(); lastIdx = -1; };
  document.addEventListener("keydown", (ev) => {
    // Ignore when typing in inputs / textareas / contentEditable.
    const t = ev.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    // Only active while watch is visible AND a karaoke timeline exists.
    const watchPanel = document.getElementById("watch-panel");
    if (!watchPanel || watchPanel.hidden) return;
    if (!cachedTimeline.length) return;
    if (ev.key === "ArrowLeft")  { adjustNudge(-0.25); ev.preventDefault(); }
    else if (ev.key === "ArrowRight") { adjustNudge(+0.25); ev.preventDefault(); }
    else if (ev.key === "ArrowUp")    { adjustNudge(-1.0);  ev.preventDefault(); }
    else if (ev.key === "ArrowDown")  { adjustNudge(+1.0);  ev.preventDefault(); }
    else if (ev.key === "0")          { __cssosNudgeSec = 0; saveNudge(); flashNudgeBadge(); lastIdx = -1; ev.preventDefault(); }
  }, true);

  const getActiveSourceTime = () => {
    // CSSOS_PHASE2_KARAOKE_NUDGE — apply the user's manual offset so
    // the picker treats "song time + nudge" as the lookup key. Positive
    // nudge ⇒ lyrics appear later (the picker sees a smaller t, so it
    // selects an earlier line later in real-time). Negative ⇒ earlier.
    const t = getRawSourceTime();
    return Math.max(0, t - __cssosNudgeSec);
  };

  // CSSOS_PHASE2_AUDIO_ANALYSER 20260504 — Jing
  // "响应音乐的节奏，音量，歌词的含义作出'情绪反应'…字幕的大小，颜色，
  //  阴影，字体…会因为情绪而波动".
  //
  // Web Audio AnalyserNode wired once to whichever audio source is
  // playing. Every animation frame we read the time-domain RMS,
  // smooth it, and push it into a CSS variable on #watch-subtitle.
  // style.css's .karaoke-active rule then uses --kara-amp to scale +
  // glow the text so it BREATHES with the song, not just ticks
  // across lines on a 250ms cadence.
  let __cssosAudioCtx = null;
  let __cssosAnalyser = null;
  let __cssosAmpBuf = null;
  let __cssosFreqBuf = null;
  let __cssosWiredAudioEl = null;
  let __cssosSmoothAmp = 0;
  // CSSOS_PHASE2_TRUE_EMOTIONAL_SUBS 20260504 — three frequency band
  // smoothed amplitudes + simple beat detection on the bass band.
  let __cssosBandBass = 0, __cssosBandMid = 0, __cssosBandTreble = 0;
  let __cssosBassPrev = 0, __cssosBeatPulse = 0;
  function ensureKaraokeAnalyser(targetEl) {
    if (!targetEl) return;
    if (__cssosWiredAudioEl === targetEl && __cssosAnalyser) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!__cssosAudioCtx) __cssosAudioCtx = new Ctx();
      let src = targetEl.__cssosMediaSrc;
      if (!src) {
        src = __cssosAudioCtx.createMediaElementSource(targetEl);
        targetEl.__cssosMediaSrc = src;
        src.connect(__cssosAudioCtx.destination);
      }
      const analyser = __cssosAudioCtx.createAnalyser();
      // 2048 → ~22 Hz bins at 44.1 kHz, plenty of resolution for
      // bass / mid / treble band splits.
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.55;
      src.connect(analyser);
      __cssosAnalyser = analyser;
      __cssosAmpBuf = new Uint8Array(analyser.fftSize);
      __cssosFreqBuf = new Uint8Array(analyser.frequencyBinCount);
      __cssosWiredAudioEl = targetEl;
      if (__cssosAudioCtx.state === "suspended") {
        __cssosAudioCtx.resume().catch(() => {});
      }
    } catch (e) {
      console.info("[karaoke] analyser unavailable:", e && e.message);
    }
  }
  function readKaraokeAmpAndBands() {
    if (!__cssosAnalyser || !__cssosAmpBuf) return null;
    // Time-domain RMS for the overall amp.
    __cssosAnalyser.getByteTimeDomainData(__cssosAmpBuf);
    let sum = 0;
    for (let i = 0; i < __cssosAmpBuf.length; i += 1) {
      const v = (__cssosAmpBuf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / __cssosAmpBuf.length);
    __cssosSmoothAmp = __cssosSmoothAmp * 0.7 + rms * 0.3;
    const amp = Math.max(0, Math.min(1, __cssosSmoothAmp * 2.0));

    // Frequency domain → split into bass / mid / treble bands.
    __cssosAnalyser.getByteFrequencyData(__cssosFreqBuf);
    const sampleRate = __cssosAudioCtx?.sampleRate || 44100;
    const binHz = sampleRate / 2 / __cssosFreqBuf.length;
    const bandFor = (lowHz, highHz) => {
      const lo = Math.floor(lowHz / binHz);
      const hi = Math.min(__cssosFreqBuf.length, Math.ceil(highHz / binHz));
      let s = 0;
      for (let i = lo; i < hi; i += 1) s += __cssosFreqBuf[i];
      const denom = Math.max(1, hi - lo);
      return (s / denom) / 255; // 0..1
    };
    const bassRaw = bandFor(40, 200);
    const midRaw = bandFor(200, 2000);
    const trebleRaw = bandFor(2000, 8000);
    // Smooth each band independently. Bass smooths LESS so kick
    // hits remain punchy; mid/treble smooth a touch more so vocals
    // and cymbals feel sustained rather than nervous.
    __cssosBandBass   = __cssosBandBass   * 0.55 + bassRaw   * 0.45;
    __cssosBandMid    = __cssosBandMid    * 0.70 + midRaw    * 0.30;
    __cssosBandTreble = __cssosBandTreble * 0.70 + trebleRaw * 0.30;

    // Beat detection: a sudden bass spike against the recent floor.
    const bassDelta = __cssosBandBass - __cssosBassPrev;
    if (bassDelta > 0.18 && __cssosBandBass > 0.45) {
      __cssosBeatPulse = 1.0; // trigger
    } else {
      __cssosBeatPulse = Math.max(0, __cssosBeatPulse - 0.08); // decay
    }
    __cssosBassPrev = __cssosBandBass;

    return {
      amp,
      bass: Math.min(1, __cssosBandBass * 1.6),
      mid: Math.min(1, __cssosBandMid * 1.6),
      treble: Math.min(1, __cssosBandTreble * 1.6),
      beat: __cssosBeatPulse,
    };
  }
  // CSSOS_PHASE2_RAF_GATE 20260505 — Jing
  // "请继续检查/优化，看看是哪些代码耗费资源". The original loop ran
  // at 60 fps forever, even when the watch panel was hidden / no
  // audio was playing — pure CPU + battery drain on mobile. Now:
  //   • pause when watch panel is hidden / minimized,
  //   • pause when no playing media element exists,
  //   • use a 4-frame budget when not karaoke-active (one read every
  //     ~67 ms instead of every frame).
  let __cssosKaraRafFrame = 0;
  function pulseKaraokeAmpFrame() {
    __cssosKaraRafFrame = (__cssosKaraRafFrame + 1) & 0x7;
    const panel = watchPanel;
    if (!panel || panel.classList.contains("hidden") ||
        panel.dataset.minimized === "true" ||
        document.hidden) {
      // Re-arm at a lazy cadence so we wake up fast when panel opens.
      setTimeout(() => requestAnimationFrame(pulseKaraokeAmpFrame), 500);
      return;
    }
    const sub = document.getElementById("watch-subtitle");
    const isKara = !!(sub && sub.classList.contains("karaoke-active"));
    if (isKara) {
      const playingEl =
        (audioEl && !audioEl.paused && !audioEl.muted ? audioEl : null) ||
        (videoEl && !videoEl.paused && !videoEl.muted ? videoEl : null);
      if (playingEl) ensureKaraokeAnalyser(playingEl);
      const reading = readKaraokeAmpAndBands();
      if (reading) {
        sub.style.setProperty("--kara-amp", reading.amp.toFixed(3));
        sub.style.setProperty("--amp-bass", reading.bass.toFixed(3));
        sub.style.setProperty("--amp-mid", reading.mid.toFixed(3));
        sub.style.setProperty("--amp-treble", reading.treble.toFixed(3));
        sub.style.setProperty("--beat-pulse", reading.beat.toFixed(3));
      }
      requestAnimationFrame(pulseKaraokeAmpFrame);
    } else {
      // Not karaoke — drop to ~15 fps polling so we still notice when
      // it activates, but stop hammering the CPU.
      setTimeout(() => requestAnimationFrame(pulseKaraokeAmpFrame), 60);
    }
  }
  // Start the RAF loop on first wire.
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(pulseKaraokeAmpFrame);
  }

  const findActiveIdx = (timeline, t) => {
    if (!timeline.length) return -1;
    // Linear scan from lastIdx — songs play forward most of the time so
    // we usually hit on the 0th iteration.
    let start = Math.max(0, lastIdx);
    for (let i = start; i < timeline.length; i += 1) {
      if (t >= timeline[i].start_s && t < timeline[i].end_s) return i;
      if (t < timeline[i].start_s) break; // we're between lines
    }
    // Wrap if user seeked back.
    for (let i = 0; i < timeline.length; i += 1) {
      if (t >= timeline[i].start_s && t < timeline[i].end_s) return i;
    }
    return -1;
  };

  const tick = () => {
    try {
      const ps = globalThis.cssosMvPipelinePanelState
        ? globalThis.cssosMvPipelinePanelState()
        : null;
      if (!ps) return;
      // CSSOS_PHASE2_SRT_LAZY_FETCH 20260504 — when the work landed
      // with only a subtitle SRT URL (no aligned_lyrics), hydrate it
      // asynchronously the first time we see this work. The next
      // tick (~250ms later) will pick up the parsed cues from
      // pipelineState.alignedLyrics that hydrate populates.
      const subtitleUrl = String(ps.subtitleUrl || "").trim();
      if (
        subtitleUrl &&
        (!Array.isArray(ps.alignedLyrics) || ps.alignedLyrics.length === 0) &&
        lastSrtFetchSig !== subtitleUrl
      ) {
        lastSrtFetchSig = subtitleUrl;
        void hydrateAlignedFromSrtUrlModule(subtitleUrl, ps);
      }
      // CSSOS_PHASE2_SIG_INCLUDES_DURATION 20260504 — include duration
      // in the signature so the timeline rebuilds the moment the media
      // element reports a real duration (was 0 → 256.76 transition was
      // silent before because sig didn't change).
      const sig = `${ps.workId || ""}|${ps.title || ""}|${(ps.alignedLyrics || []).length}|${(ps.lyrics || "").length}|${Math.round(Number(ps.duration || 0))}|${Number(videoEl?.duration || 0).toFixed(0)}|${Number(audioEl?.duration || 0).toFixed(0)}`;
      if (sig !== cachedSig) {
        cachedSig = sig;
        cachedTimeline = buildTimeline(ps);
        lastIdx = -1;
        // CSSOS_PHASE2_KARAOKE_NUDGE — reload per-work offset.
        loadNudge(ps);
        console.warn(
          "[karaoke] timeline built: %d lines (engine-aligned=%s, srt-hydrated=%s)",
          cachedTimeline.length,
          !!(ps?.alignedLyrics?.length),
          !!subtitleUrl
        );
      }
      if (!cachedTimeline.length) return;
      const t = getActiveSourceTime();
      const idx = findActiveIdx(cachedTimeline, t);
      if (idx === lastIdx) return;
      lastIdx = idx;
      // CSSOS_PHASE2_KARAOKE_LIVE 20260501 #247 — Jing
      // "字幕跟唱还是没有修复完毕." Update BOTH targets so the live
      // line lands wherever the user is looking:
      //   #watch-subtitle      — small bottom-of-frame line
      //   #watch-karaoke-line  — the big karaoke text inside the frame
      // Other writers can clobber #watch-subtitle, but the karaoke line
      // is dedicated. Writing both is cheap (one DOM mutation each).
      const sub = document.getElementById("watch-subtitle");
      const kar = document.getElementById("watch-karaoke-line");
      if (idx < 0) return; // between lines — keep last visible
      const line = cachedTimeline[idx];
      console.warn("[karaoke] line %d/%d t=%ss → %s",
        idx + 1, cachedTimeline.length, getActiveSourceTime().toFixed(1), line.text.slice(0, 40)
      );
      // CSSOS_PHASE2_EMOTIONAL_SUB 20260501 #251 — Jing
      // "情绪字幕，跟随音乐的节奏，歌词的意境，音量的大小作出情绪变化."
      //
      // Each cue may carry an `emotion` string + `emphasis` 0..1 (engine
      // pipeline adds these on aligned_lyrics; older runs fall back to
      // keyword inference from text). Map to CSS class so the existing
      // style.css emotion rules (cinema/dream/neon/ignite/resolve/intimate)
      // tint the subtitle color, glow, and scale.
      const inferEmotion = (txt) => {
        const t = String(txt || "").toLowerCase();
        // CSSOS_PHASE2_EMOTION_KEYWORDS 20260504 — broaden vocabulary
        // so more lines pick up an emotion automatically. Order matters:
        // strongest signals first (ignite/grief), softer last (calm).
        if (/fire|ignite|burn|rise|shout|roar|chorus|fight|战|爆|燃|怒|呐喊|轰|血|火/.test(t)) return "ignite";
        if (/grief|lost|alone|tear|shadow|cry|gone|farewell|悲|失|孤|泪|影|去|离别|忘/.test(t)) return "grief";
        if (/love|heart|kiss|hug|warm|home|爱|心|拥抱|温|家|怀/.test(t)) return "intimate";
        if (/joy|laugh|smile|dance|sun|bright|happy|喜|笑|跳|阳光|乐/.test(t)) return "joy";
        if (/dream|moon|night|echo|whisper|glow|star|sky|梦|月|夜|低语|微光|星|天/.test(t)) return "resolve";
        if (/peace|still|quiet|calm|breath|river|sea|静|安|宁|缓|河|海|呼吸/.test(t)) return "calm";
        return "";
      };
      const emotion = String(line.emotion || "").trim() || inferEmotion(line.text);
      const emphasis = Number(line.emphasis || 0.5);
      if (sub) {
        // CSSOS_PHASE2_PERFORMANCE_GRADE_KARAOKE 20260504 — Jing
        // "字幕和音乐歌声同步…每个字符，每个字都要和音乐歌声咬字同步".
        //
        // Per-character render: each char becomes a span with a CSS
        // animation-delay tied to its position in the line. The CSS
        // keyframe (style.css `.kara-char`) sweeps opacity + scale +
        // glow from "not-yet-sung" to "sung-and-pop" over the
        // character's allotted time slice. With the line's start/end
        // timestamps that's a free word-by-word karaoke fill.
        //
        // For very long lines (>32 chars or English-heavy) we keep
        // word-level grouping so we don't choke the renderer on tiny
        // span counts in fast tempo passes.
        lastAppliedLine = line;
        karaokeReapplying = true;
        const lineDur = Math.max(0.3, (line.end_s || 0) - (line.start_s || 0));
        // CSSOS_PHASE2_PUNCT_FILTER 20260504 — Jing
        // "请把字幕里的标点符号如，。等都过滤一下，？可以保留."
        // Karaoke captions are sung-text — printed pauses don't add
        // meaning, only visual noise (each comma takes a span and
        // briefly glows like a real word). Strip the obvious sung
        // pauses; keep ？ ！ ～ which carry emotion + the karaoke
        // renderer's emphasis classes ride them.
        // The lyrics BODY (lyrics card preview, mvp-lyrics textarea,
        // SRT/ASS export) keeps every punctuation character intact —
        // this filter is render-time-only.
        const stripKaraokePunct = (s) => {
          // CSSOS_PHASE2_PUNCT_FILTER 20260504v2 — Jing
          // 1. Replace stripped chars with a SPACE (not empty) so the
          //    line still has natural breath/phrase breaks. e.g.
          //    "梅雨季节的旧巷子，屋檐下两把伞" →
          //    "梅雨季节的旧巷子 屋檐下两把伞"
          // 2. KEEP brackets / quotes — 「再见」 carries meaning
          //    (quoting a concept). Same for 《诗经》 (book title)
          //    《》 〈〉 【】 〔〕 ()（） " ' " " ' '.
          if (!__cssmvKaraStripSet) {
            __cssmvKaraStripSet = new Set();
            const chars =
              "，。、；：·．…" +   // Chinese pause-style only
              "—–‒‐‑―" +           // em/en/figure dashes
              ",.;:" +              // Latin pause-style (NO parens — keep ()
              "·•●◆◇○";           // dots / bullets
            for (const ch of chars) __cssmvKaraStripSet.add(ch);
          }
          let out = "";
          for (const ch of String(s || "")) {
            out += __cssmvKaraStripSet.has(ch) ? " " : ch;
          }
          return out.replace(/\s+/g, " ").trim();
        };
        const text = stripKaraokePunct(String(line.text || ""));
        const chars = Array.from(text); // preserves CJK + emoji clusters
        const perChar = lineDur / Math.max(chars.length, 1);
        // CSSOS_WAVE_159 20260514 — 情绪字幕引擎: REAL per-character
        // timing. Jing: "英文歌声不一定每一个字都唱相同的时长…有些词
        // 唱腔拉很长好几秒，有些词半秒都不到，如果均时长，就无法做到词
        // 级字幕。" When this cue carries `.words` (Suno + Whisper
        // forced-alignment, unit:"word"), each character's reveal
        // window is derived from the REAL sung word it belongs to — a
        // held word spreads a long window across its chars, a clipped
        // word a short one. Within a multi-char word we sub-divide its
        // true window (chars of one sung word ARE roughly co-temporal,
        // so this is honest, not interpolation across the whole line).
        // No `.words` → graceful fallback to the even `perChar` divide.
        //
        // charTimings[i] = { delay, dur } in SECONDS, relative to the
        // line's start, for the i-th entry of `chars`.
        const charTimings = (function () {
          const words = Array.isArray(line.words) ? line.words : null;
          if (!words || !words.length) return null;
          const lineStart = Number(line.start_s || 0);
          const isSpace = (c) => /\s/.test(c);
          // Non-space character count carried by each word.
          const wordCharLists = words.map((w) =>
            Array.from(String(w.text || "")).filter((c) => !isSpace(c))
          );
          const out = new Array(chars.length);
          let wi = 0;       // current word index
          let wci = 0;      // char index within current word
          let lastDelay = 0, lastDur = perChar;
          for (let i = 0; i < chars.length; i += 1) {
            if (isSpace(chars[i])) {
              // Spaces ride the previous char's window (zero visible
              // glow cost — kara-space is &nbsp;).
              out[i] = { delay: lastDelay, dur: lastDur };
              continue;
            }
            // Advance past any exhausted words.
            while (wi < words.length && wci >= wordCharLists[wi].length) {
              wi += 1; wci = 0;
            }
            if (wi >= words.length) {
              // Ran out of aligned words — extend from the last window.
              out[i] = { delay: lastDelay + lastDur, dur: lastDur };
              lastDelay = out[i].delay;
              continue;
            }
            const w = words[wi];
            const n = Math.max(1, wordCharLists[wi].length);
            const wStart = Number(w.start_s || 0) - lineStart;
            const wDur = Math.max(0.08, Number(w.end_s || 0) - Number(w.start_s || 0));
            const subDur = wDur / n;
            const delay = wStart + wci * subDur;
            out[i] = { delay, dur: subDur };
            lastDelay = delay; lastDur = subDur;
            wci += 1;
          }
          return out;
        })();
        // CSSOS_PHASE2_PER_CHAR_FONT 20260504 — Jing
        // "普通字幕的每一歌词/每一个字的字幕字体也是可以随机切换的".
        // Each kara-char span pulls its own font from the 92+ font
        // manifest via cssmvAssignFontForPiece. The function caches
        // (text → font) so a given character keeps its font across
        // re-renders, but shuffleTokenFonts clears the cache so the
        // next interval re-rolls every span.
        //
        // CSSOS_PHASE2_PER_CHAR_EMOTION 20260504 — Jing
        // "ACC 字幕最适合做情绪字幕，每个字幕情绪都不一样".
        // Each character ALSO gets its own emotion class on top of
        // the line baseline. Emotion-keyword chars (火/燃/泪/笑/梦/月…)
        // override with their own colour burst so a single line can
        // have heterogeneous emotion accents.
        const pickFont = (typeof globalThis.cssmvAssignFontForPiece === "function")
          ? globalThis.cssmvAssignFontForPiece
          : null;
        const escapeFontFamily = (fam) =>
          String(fam || "").replace(/"/g, '\\"').replace(/[<>]/g, "");
        const charEmotion = (ch) => {
          if (/[火燃爆怒]/.test(ch)) return "ignite";
          if (/[泪悲失孤]/.test(ch)) return "grief";
          if (/[爱心怀]/.test(ch))   return "intimate";
          if (/[喜笑乐]/.test(ch))   return "joy";
          if (/[梦月夜星]/.test(ch)) return "resolve";
          if (/[静安宁海]/.test(ch)) return "calm";
          return "";
        };
        // CSSOS_PHASE2_TRUE_EMOTIONAL_SUBS 20260504 — Jing
        // "真正的情绪字幕…每一个单词/每一个字的字体/风格各异，都受到
        //  音乐节奏，音量，歌词含义等多重影响'情绪'的因素而呈现出不同
        //  的字幕样式".
        //
        // Each kara-char gets a unique style PROFILE assembled from:
        //   • emotion (semantic — keyword match)        → colour + glow
        //   • size jitter (±25 %)                       → visual variety
        //   • weight jitter (300–900 random)            → light vs bold mix
        //   • rotation jitter (-4° to +4°, ±8° ignite)  → hand-drawn feel
        //   • frequency band (bass/mid/treble round-robin) → reacts to
        //                                                   different
        //                                                   parts of the
        //                                                   song
        //   • base scale tagged with --kc-base-scale     → composed in
        //                                                   CSS with
        //                                                   per-band amp
        //                                                   for live pulse
        //
        // The CSS reads --amp-bass / --amp-mid / --amp-treble (set per
        // frame from the analyser RAF below) and combines with the
        // per-char base values via calc() so EACH char breathes with
        // its assigned frequency band — bass-tagged chars pump on
        // kick drum hits, treble-tagged chars shimmer on cymbals,
        // mid-tagged chars ride the vocal envelope.
        const BANDS = ["bass", "mid", "treble"];
        const cryptoFloat = () => {
          if (typeof crypto !== "undefined" && crypto.getRandomValues) {
            const buf = new Uint32Array(1);
            crypto.getRandomValues(buf);
            return buf[0] / 0xFFFFFFFF;
          }
          return Math.random();
        };
        const spans = chars.map((ch, i) => {
          // CSSOS_WAVE_159 — real per-word window when available,
          // else the legacy even divide.
          const ct = charTimings && charTimings[i];
          const delay = (ct ? Math.max(0, ct.delay) : i * perChar).toFixed(2);
          const dur = (ct ? Math.max(0.08, ct.dur) : perChar).toFixed(2);
          const isWhitespace = /\s/.test(ch);
          const safe = isWhitespace
            ? "&nbsp;"
            : ch.replace(/&/g, "&amp;").replace(/</g, "&lt;");
          if (isWhitespace) {
            return `<span class="kara-char kara-space" style="--kc-delay:${delay}s;--kc-dur:${dur}s">${safe}</span>`;
          }
          let fontStyle = "";
          if (pickFont) {
            const fam = pickFont(ch);
            if (fam) {
              fontStyle = `font-family:"${escapeFontFamily(fam)}",inherit;`;
            }
          }
          const emo = charEmotion(ch);
          // Size jitter: 0.85x – 1.25x; emotion-keyword chars skew
          // larger (1.05 – 1.35) so they pop visually.
          const sizeJitter = (emo ? 1.05 : 0.85) + cryptoFloat() * (emo ? 0.30 : 0.40);
          // Weight jitter: 300–900. Calm/grief skew lighter, ignite
          // skews heavier.
          let weight;
          if (emo === "calm" || emo === "grief") weight = 300 + Math.floor(cryptoFloat() * 300); // 300-600
          else if (emo === "ignite")           weight = 700 + Math.floor(cryptoFloat() * 200); // 700-900
          else                                  weight = 400 + Math.floor(cryptoFloat() * 500); // 400-900
          weight = Math.round(weight / 100) * 100; // snap to font-weight legal values
          // Rotation jitter: ±4° baseline, ignite ±8°
          const rotMax = emo === "ignite" ? 8 : (emo === "joy" ? 5 : 3.5);
          const rot = ((cryptoFloat() - 0.5) * 2 * rotMax).toFixed(2);
          // Italic: 1-in-6 chance, or 1-in-2 for grief/intimate.
          const italicChance = (emo === "grief" || emo === "intimate") ? 0.5 : 0.16;
          const italic = cryptoFloat() < italicChance ? "italic" : "normal";
          // Frequency band assignment — round-robin with a random
          // shift so consecutive chars usually land on different
          // bands (don't clump 5 bass chars in a row).
          const band = BANDS[(i + Math.floor(cryptoFloat() * 3)) % 3];
          const cls = `kara-char kara-band-${band}` + (emo ? " kara-c-" + emo : "");
          const inlineStyle =
            `--kc-delay:${delay}s;--kc-dur:${dur}s;` +
            `--kc-base-scale:${sizeJitter.toFixed(3)};` +
            `--kc-rot:${rot}deg;` +
            `font-weight:${weight};font-style:${italic};` +
            fontStyle;
          return `<span class="${cls}" style="${inlineStyle}">${safe}</span>`;
        }).join("");
        sub.innerHTML = spans;
        sub.dataset.cssmvOrigin = "karaoke-live";
        sub.dataset.emotion = emotion || "";
        sub.style.setProperty("--karaoke-emphasis", emphasis.toFixed(2));
        Promise.resolve().then(() => { karaokeReapplying = false; });
        // Drop any inline color/transform from earlier per-line writes —
        // emotion class + CSS variable now drive everything.
        sub.style.color = "";
        sub.style.transform = "";
        // Emotion class swap (mutually exclusive). style.css defines
        // .kara-emotion-ignite / -resolve / -intimate / -joy etc with
        // colour, shadow, font, scale, animation duration variations.
        ["ignite","resolve","intimate","joy","calm","grief"].forEach((k) => {
          sub.classList.remove("kara-emotion-" + k);
        });
        if (emotion) sub.classList.add("kara-emotion-" + emotion);
        sub.classList.add("karaoke-active");
      }
      if (kar) {
        // Plain-text fallback: if kar.innerHTML has structured content
        // (per-word spans), don't overwrite — let the existing fancy
        // renderer handle that case. Only set textContent when kar is
        // empty or holds a previous karaoke-live line.
        const had = String(kar.dataset?.cssmvLiveOrigin || "");
        if (!kar.children.length || had === "karaoke-live") {
          kar.textContent = line.text;
          kar.dataset.cssmvLiveOrigin = "karaoke-live";
        }
      }
    } catch (e) {
      console.warn("[karaoke] tick threw:", e);
    }
  };

  // Bind to BOTH elements — whichever fires timeupdate first/most.
  if (videoEl) videoEl.addEventListener("timeupdate", tick);
  if (audioEl) audioEl.addEventListener("timeupdate", tick);
  // CSSOS_PHASE2_KARA_TICK_GATE 20260505 — Jing
  // "请仔细检查全站代码，查处哪些代码在严重消耗资源". The 250ms
  // fallback ran forever — even when watch panel was hidden / no
  // media playing, ~14k pointless calls per hour. Gate on:
  //   • watch panel visible
  //   • document not hidden (tab in background)
  //   • at least one media element actively playing
  setInterval(() => {
    if (!watchPanel || watchPanel.classList.contains("hidden")) return;
    if (watchPanel.dataset.minimized === "true") return;
    if (document.hidden) return;
    const vPlaying = videoEl && !videoEl.paused && !videoEl.ended;
    const aPlaying = audioEl && !audioEl.paused && !audioEl.ended;
    if (!vPlaying && !aPlaying) return;
    tick();
  }, 250);
}

// Expose for swipe handler.
globalThis.cssosWatchQueueAdvance = watchQueueAdvanceModule;
globalThis.cssosWatchQueuePrefetch = fetchWatchQueueMoreModule;
globalThis.applyWatchQueueItemModule = applyWatchQueueItemModule;

// CSSOS_PHASE2_SWIPE_NAVIGATION 20260430 #201/#232 — Jing
// "上下滑切歌" — TikTok/抖音-style continuous navigation: any up/down
// gesture jumps to next/prev song. The ♪1↔♪2 take toggle stays
// reachable via the visible pill in the upper-right (a click or right-
// click), but the gesture is dedicated to song navigation so users
// don't have to think about "short vs long" — single mental model.
//
// Bindings:
//   • Touch swipe up   → next song (queue +1)
//   • Touch swipe down → previous song (queue -1)
//   • Mouse wheel up   → previous song (one debounced tick per swipe)
//   • Mouse wheel down → next song
//   • Trackpad two-finger up/down → same as wheel
//   • Keyboard ArrowUp/Down + PageUp/PageDown → next/prev song
//   • Keyboard Shift+ArrowLeft/Right → ♪1/♪2 toggle (alt path)
let __cssosSwipeWired = false;
function wireWatchSwipeOnceModule() {
  if (__cssosSwipeWired) return;
  const frame = document.querySelector("#watch-panel .watch-frame");
  if (!frame) return;
  __cssosSwipeWired = true;
  const flashDirection = (direction) => {
    // Brief on-frame indicator so the user gets feedback for the
    // gesture even before the next song's media loads.
    try {
      let chip = document.getElementById("watch-swipe-chip");
      if (!chip) {
        chip = document.createElement("div");
        chip.id = "watch-swipe-chip";
        chip.style.cssText =
          "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);" +
          "background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);" +
          "color:#fff;font-size:42px;line-height:1;padding:14px 18px;" +
          "border-radius:50%;z-index:32;pointer-events:none;" +
          "transition:opacity 0.25s ease, transform 0.25s ease;opacity:0;";
        frame.style.position = frame.style.position || "relative";
        frame.appendChild(chip);
      }
      chip.textContent = direction > 0 ? "↓" : "↑";
      chip.style.opacity = "1";
      chip.style.transform = "translate(-50%,-50%) scale(1)";
      clearTimeout(chip.__hideTid);
      chip.__hideTid = setTimeout(() => {
        chip.style.opacity = "0";
        chip.style.transform = "translate(-50%,-50%) scale(0.8)";
      }, 350);
    } catch (_e) {}
  };
  const advanceSong = (direction) => {
    flashDirection(direction);
    void globalThis.cssosWatchQueueAdvance?.(direction);
  };
  // Keyboard.
  document.addEventListener("keydown", (ev) => {
    if (!watchPanel || watchPanel.classList.contains("hidden")) return;
    if (ev.target && /input|textarea|select/i.test(ev.target.tagName)) return;
    if (ev.key === "ArrowDown" || ev.key === "PageDown") {
      advanceSong(+1);
      ev.preventDefault();
    } else if (ev.key === "ArrowUp" || ev.key === "PageUp") {
      advanceSong(-1);
      ev.preventDefault();
    } else if (ev.shiftKey && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
      try {
        const sw = globalThis.__cssosWatchTakeSwitcher;
        if (typeof sw === "function") sw(ev.key === "ArrowRight" ? 2 : 1);
      } catch (_e) {}
      ev.preventDefault();
    }
  });
  // Touch swipe.
  let tStartY = null;
  let tStartT = 0;
  frame.addEventListener("touchstart", (ev) => {
    tStartY = ev.touches?.[0]?.clientY ?? null;
    tStartT = Date.now();
  }, { passive: true });
  // CSSOS_PHASE2_NO_PULL_REFRESH 20260505 — Jing
  // "往下拖动触发了刷新屏幕，修改为，往下拖动媒体框，是切换作品".
  // touchmove must be NON-passive so we can preventDefault to stop
  // mobile Safari/Chrome from triggering pull-to-refresh on a
  // downward drag from the top of the page. We block the browser
  // default for any vertical drag past 8 px on the media frame —
  // whatever direction it is, it's a song-switch gesture, not a
  // page-scroll gesture.
  frame.addEventListener("touchmove", (ev) => {
    if (tStartY == null) return;
    const curY = ev.touches?.[0]?.clientY ?? tStartY;
    const dy = curY - tStartY;
    if (Math.abs(dy) > 8) {
      try { ev.preventDefault(); } catch (_e) {}
    }
  }, { passive: false });
  frame.addEventListener("touchend", (ev) => {
    if (tStartY == null) return;
    const endY = ev.changedTouches?.[0]?.clientY ?? tStartY;
    const dy = endY - tStartY;
    const dt = Date.now() - tStartT;
    tStartY = null;
    // Reject obvious taps (dt < 80ms or |dy| < 30px). Otherwise any
    // intentional vertical gesture switches songs — direction = sign(dy)
    // inverted so swipe-UP advances (TikTok feel: pull next song up).
    if (dt < 80 || Math.abs(dy) < 30) return;
    advanceSong(dy < 0 ? +1 : -1);
  });
  // Wheel / trackpad — debounced: only one advance per gesture run.
  let wheelLockUntil = 0;
  let wheelAccum = 0;
  frame.addEventListener("wheel", (ev) => {
    if (!watchPanel || watchPanel.classList.contains("hidden")) return;
    // Horizontal wheels don't navigate — let them through.
    if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
    ev.preventDefault();
    const now = Date.now();
    if (now < wheelLockUntil) return;
    wheelAccum += ev.deltaY;
    if (Math.abs(wheelAccum) < 80) return;
    advanceSong(wheelAccum > 0 ? +1 : -1);
    wheelAccum = 0;
    wheelLockUntil = now + 600;
  }, { passive: false });
  wireWatchQueueAutoAdvanceOnceModule();
  void fetchWatchQueueMoreModule();
  // CSSOS_PHASE2_PLAYLISTS 20260430 #239 — Jing
  // Inject the playlist mode pill (left side, mirrors the aspect pill
  // on the right). Click cycles modes; right-click opens the list-
  // switcher menu.
  ensurePlaylistModePillModule();
  ensureImmersivePillModule();
  ensureMediaActionsPillModule();
  ensureAuthorAvatarModule();
  /* CSSOS_WAVE_214 — persistent share-info chip (bottom-left, never fades). */
  try { ensureWatchShareInfoChipModule(); } catch (_e) {}
  ensureCinemaAutoHideModule();
  // CSSOS_PHASE2_SINGLE_LOOP_RIGHTCLICK 20260430 #200 — Jing
  // "循环单曲（右键菜单）." Right-click the video frame to toggle
  // 单曲循环 on/off — fastest path to "play this one over and over."
  // Tab back to the playlist's prior mode on second right-click.
  // CSSOS_PHASE2_DBLCLICK_FULLSCREEN 20260501 #267 — Jing
  // "请让媒体框双击切换全屏（影院模式）."
  // Standard YouTube-style: double-click anywhere on the frame (except
  // on a real button / input / pill) toggles fullscreen on the same
  // target the immersive pill already uses (video element first, frame
  // fallback). Single-click is left untouched so it doesn't interfere
  // with the play/pause + media-actions menu logic.
  if (frame && !frame.dataset.dblclickFullscreenWired) {
    frame.dataset.dblclickFullscreenWired = "1";
    frame.addEventListener("dblclick", async (ev) => {
      try {
        if (
          ev.target &&
          ev.target.closest &&
          ev.target.closest(
            "button, input, textarea, select, [role=button], #watch-pill-row-bl, #watch-take-toggle, #watch-aspect-pill, .watch-media-action, .watch-author-avatar"
          )
        ) {
          return;
        }
        ev.preventDefault();
        const videoEl = document.getElementById("watch-video");
        const target = videoEl || frame;
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (isFs) {
          const exit =
            document.exitFullscreen ||
            document.webkitExitFullscreen ||
            document.mozCancelFullScreen ||
            document.msExitFullscreen;
          if (exit) {
            try { await exit.call(document); } catch (_e) {}
          }
          document.body.classList.remove("cssos-watch-theater");
          return;
        }
        const enter =
          target.requestFullscreen ||
          target.webkitRequestFullscreen ||
          target.webkitEnterFullscreen ||
          target.mozRequestFullScreen ||
          target.msRequestFullscreen;
        if (enter) {
          try {
            const result = enter.call(target);
            if (result && typeof result.then === "function") await result;
          } catch (_e) {}
          document.body.classList.add("cssos-watch-theater");
        }
      } catch (_e) {}
    });
  }
  if (frame && !frame.dataset.singleLoopWired) {
    frame.dataset.singleLoopWired = "1";
    let priorMode = null;
    frame.addEventListener("contextmenu", (ev) => {
      // Don't intercept right-click on pills / buttons / inputs.
      if (ev.target && ev.target.closest && ev.target.closest("button, input, [role=button], #watch-pill-row-bl, #watch-take-toggle, #watch-aspect-pill")) return;
      if (!globalThis.cssosPlaylists) return;
      ev.preventDefault();
      const cur = globalThis.cssosPlaylists.getMode();
      if (cur === "loop_single") {
        // Restore previous mode (or default to loop_all)
        globalThis.cssosPlaylists.setMode(priorMode || "loop_all");
        priorMode = null;
      } else {
        priorMode = cur;
        globalThis.cssosPlaylists.setMode("loop_single");
        // Also turn on the actual <audio> / <video> loop attribute so
        // the current track repeats without depending on ended events.
        const a = document.getElementById("watch-audio-preview");
        const v = document.getElementById("watch-video");
        if (a) a.loop = true;
        if (v) v.loop = true;
      }
      // Sync media element loop attribute when toggling off too.
      if (globalThis.cssosPlaylists.getMode() !== "loop_single") {
        const a = document.getElementById("watch-audio-preview");
        const v = document.getElementById("watch-video");
        if (a) a.loop = false;
        if (v) v.loop = false;
      }
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(globalThis.cssosPlaylists.modeLabel());
      }
    });
  }
}

// CSSOS_PHASE2_MEDIA_ACTIONS 20260430 #242 — Jing
// "AirPlay / 画中画 / 还有啥都加，不要占用太多媒体框空间."
// Single ⋯ pill in the bottom-left row that expands a vertical menu
// of secondary actions. Each entry self-skips when the underlying API
// is unavailable (e.g. AirPlay only on Safari, Cast only on Chrome
// with cast extension, PiP only on Chromium / Safari).
let __cssosMediaActionsPillWired = false;
function ensureMediaActionsPillModule() {
  if (__cssosMediaActionsPillWired) return;
  const row = ensureBottomLeftPillRowModule();
  if (!row) return;
  if (document.getElementById("watch-actions-pill")) return;
  __cssosMediaActionsPillWired = true;

  const pill = document.createElement("button");
  pill.id = "watch-actions-pill";
  pill.type = "button";
  pill.title = "More actions";
  // CSSOS_WAVE_274 20260521 — Jing(P2 无障碍): 纯图标按钮补 aria-label,
  // 否则屏幕阅读器只会念 "⋯" / 无名. 双语.
  pill.setAttribute("aria-label", loginCopy("More actions", "更多操作"));
  pill.textContent = "⋯";
  pill.style.cssText =
    "background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);" +
    "border:1px solid rgba(255,255,255,0.18);border-radius:999px;" +
    "padding:6px 14px;font-size:14px;font-weight:700;letter-spacing:.04em;" +
    "color:rgba(255,255,255,0.85);cursor:pointer;line-height:1;";
  pill.addEventListener("click", () => showMediaActionsMenuModule(pill));
  row.appendChild(pill);
}

function buildMediaActionsModule() {
  const videoEl = document.getElementById("watch-video");
  const audioEl = document.getElementById("watch-audio-preview");
  const ps = globalThis.cssosMvPipelinePanelState
    ? globalThis.cssosMvPipelinePanelState()
    : null;
  const finalUrl = String(ps?.mvUrl || videoEl?.src || "").trim();
  const speedCycle = [0.75, 1, 1.25, 1.5, 2];
  const currentSpeed = Number(videoEl?.playbackRate || 1);
  const speedIdx = (() => {
    const i = speedCycle.findIndex((v) => Math.abs(v - currentSpeed) < 0.01);
    return i >= 0 ? i : 1; // default 1x
  })();

  const actions = [];

  // AirPlay (Safari only)
  if (videoEl && typeof videoEl.webkitShowPlaybackTargetPicker === "function") {
    actions.push({
      icon: "📺", label: "AirPlay",
      onClick: () => {
        try { videoEl.webkitShowPlaybackTargetPicker(); }
        catch (e) { console.warn("[airplay]", e); }
      },
    });
  }
  // Picture-in-Picture
  if (videoEl && document.pictureInPictureEnabled) {
    actions.push({
      icon: "🪟",
      label: document.pictureInPictureElement === videoEl
        ? loginCopy("Exit Picture-in-Picture", "退出画中画")
        : loginCopy("Picture-in-Picture", "画中画"),
      onClick: async () => {
        try {
          if (document.pictureInPictureElement === videoEl) {
            await document.exitPictureInPicture();
          } else {
            await videoEl.requestPictureInPicture();
          }
        } catch (e) { console.warn("[pip]", e); }
      },
    });
  }
  // Cast — Presentation API (Chrome with cast extension / Edge)
  if (videoEl && "remote" in videoEl && typeof videoEl.remote?.prompt === "function") {
    actions.push({
      icon: "📡", label: loginCopy("Cast to device", "投屏 (Cast)"),
      onClick: async () => {
        try { await videoEl.remote.prompt(); }
        catch (e) { console.warn("[cast]", e); }
      },
    });
  }
  // Playback speed cycler
  if (videoEl) {
    const _spdNext = speedCycle[(speedIdx + 1) % speedCycle.length];
    actions.push({
      icon: "⏩",
      label: loginCopy(
        `Speed ${currentSpeed}× → ${_spdNext}×`,
        `倍速 ${currentSpeed}× → ${_spdNext}×`
      ),
      onClick: () => {
        const next = speedCycle[(speedIdx + 1) % speedCycle.length];
        if (videoEl) videoEl.playbackRate = next;
        if (audioEl) audioEl.playbackRate = next;
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(loginCopy(`Speed ${next}×`, `倍速 ${next}×`));
        }
      },
    });
  }
  // Mute toggle (audio + video)
  const isMuted = (audioEl?.muted ?? true) && (videoEl?.muted ?? true);
  actions.push({
    icon: isMuted ? "🔇" : "🔊",
    label: isMuted ? loginCopy("Unmute", "取消静音") : loginCopy("Mute", "静音"),
    onClick: () => {
      const muteAll = !isMuted;
      if (audioEl) audioEl.muted = muteAll;
      if (videoEl) videoEl.muted = muteAll;
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(
          muteAll
            ? loginCopy("🔇 Muted", "🔇 已静音")
            : loginCopy("🔊 Unmuted", "🔊 取消静音")
        );
      }
    },
  });
  // CSSOS_PHASE_A_SHARE_LINK 20260506 — Jing
  // Replaced navigator.share() (which Jing called "太苹果") with a
  // custom dialog that builds /?cssMV=<id> share links and offers
  // X / Weibo / Xiaohongshu / WeChat (QR) destinations. Native
  // navigator.share is kept as a fallback if the dialog fn isn't loaded.
  /* CSSOS_PHASE_B_DOWNLOAD 20260506 — Jing
   * Tier-gated download menu sits next to share. MP3 for full-access
   * users, WAV/MP4 for Pro+ (24h temp). app.download-menu.js renders it. */
  actions.push({
    icon: "⬇", label: loginCopy("Download", "下载"),
    onClick: () => {
      var workId = ps && (ps.workId ? String(ps.workId).split("|")[0] : null);
      if (!workId) return;
      if (typeof globalThis.openCssosDownloadMenu === "function") {
        try {
          globalThis.openCssosDownloadMenu({
            workId: workId,
            title: ps?.title || "",
            mvUrl: ps?.mvUrl || null,
            audioUrl: ps?.audioUrl || null,
          });
        } catch (e) { console.warn("[download-menu]", e); }
      }
    },
  });
  actions.push({
    icon: "📤", label: loginCopy("Share", "分享"),
    onClick: async () => {
      var workId = ps && (ps.workId ? String(ps.workId).split("|")[0] : null);
      if (typeof globalThis.openCssosShareDialog === "function") {
        try {
          globalThis.openCssosShareDialog({
            workId: workId,
            title: ps?.title || "",
            ownerName: ps?.ownerName || "",
          });
          return;
        } catch (e) { console.warn("[share-dialog]", e); }
      }
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: ps?.title || "cssOS MV",
            text: `Watch "${ps?.title || ""}" on cssOS`,
            url: workId ? window.location.origin + "/?cssMV=" + encodeURIComponent(workId) : window.location.href,
          });
        } catch (e) { console.warn("[share]", e); }
      }
    },
  });
  // Favorite — add to custom playlist
  if (globalThis.cssosPlaylists && ps?.workId) {
    actions.push({
      icon: "❤️", label: loginCopy("Favorite", "收藏"),
      onClick: () => {
        const list = globalThis.cssosPlaylists.getActive();
        const item = globalThis.cssosPlaylists.current() || {
          id: String(ps.workId).split("|")[0],
          title: ps.title,
          final_mv_url: ps.mvUrl,
          audio_track_1_url: ps.audioUrl,
          audio_track_2_url: ps.altAudioUrl,
          duration_secs: ps.duration,
        };
        const ok = globalThis.cssosPlaylists.addToCustom(item);
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(
            ok
              ? loginCopy("❤️ Added to favorites", "❤️ 已加入收藏列表")
              : loginCopy("Already in your favorites", "已经在列表里了")
          );
        }
      },
    });
  }
  // CSSOS_PHASE2_SLIDESHOW_SLIDER 20260430 #200 — slideshow intensity
  if (typeof globalThis.cssmvSetSlideshowIntensity === "function") {
    actions.push({
      icon: "🎞️",
      label: loginCopy("Slideshow intensity", "幻灯片强度"),
      isSlider: true,
      sliderValue: typeof globalThis.cssmvGetSlideshowIntensity === "function"
        ? globalThis.cssmvGetSlideshowIntensity()
        : 0.5,
      onSliderInput: (v) => {
        const r = globalThis.cssmvSetSlideshowIntensity(v);
        return loginCopy(`${r.frameMs / 1000 | 0}s per slide`, `每张 ${r.frameMs / 1000 | 0} 秒`);
      },
    });
  }
  // CSSOS_PHASE2_ASPECT_IN_MENU 20260501 #263 — Jing
  // "媒体框左上角，请让用户头像独占，之前的媒体规格的那个按钮，
  //  移动到左下角的三点里."
  // Aspect cycler moves into the ⋯ menu so the avatar gets the
  // top-left corner alone. Cycles through the same preset list as the
  // old in-frame pill (16:9 → 9:16 → 1:1 → 21:9).
  if (typeof globalThis.__cssosCycleAspect === "function") {
    actions.push({
      icon: "📐",
      label: loginCopy("Aspect ratio", "媒体规格"),
      onClick: () => {
        try { globalThis.__cssosCycleAspect(); } catch (e) { console.warn("[aspect]", e); }
      },
    });
  }
  // Download — own works only
  if (finalUrl && (ps?.is_own !== false)) {
    actions.push({
      icon: "⬇️", label: loginCopy("Download MP4", "下载 MP4"),
      onClick: () => {
        try {
          const a = document.createElement("a");
          a.href = finalUrl;
          a.download = `${(ps?.title || "cssos-mv").replace(/[^\w一-鿿-]+/g, "_")}.mp4`;
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (e) { console.warn("[download]", e); }
      },
    });
  }
  return actions;
}

function showMediaActionsMenuModule(anchor) {
  const old = document.getElementById("watch-actions-menu");
  if (old) { old.remove(); return; }
  const screen = document.querySelector("#watch-panel .watch-screen");
  if (!screen) return;
  const menu = document.createElement("div");
  menu.id = "watch-actions-menu";
  menu.dataset.noFrameToggle = "1"; // sliders / row gaps never pause media
  menu.style.cssText =
    "position:absolute;left:12px;bottom:48px;min-width:180px;" +
    "background:rgba(20,20,20,0.95);backdrop-filter:blur(12px);" +
    "border:1px solid rgba(255,255,255,0.18);border-radius:8px;" +
    "padding:6px 0;z-index:40;font-size:13px;color:#fff;" +
    "box-shadow:0 8px 24px rgba(0,0,0,0.4);";
  const actions = buildMediaActionsModule();
  if (!actions.length) {
    const empty = document.createElement("div");
    empty.style.cssText = "padding:8px 14px;color:rgba(255,255,255,0.5);";
    empty.textContent = "No actions available on this browser.";
    menu.appendChild(empty);
  }
  for (const a of actions) {
    if (a.isSlider) {
      // CSSOS_PHASE2_SLIDESHOW_SLIDER 20260430 #200 — inline range row.
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;align-items:center;gap:10px;padding:8px 14px;color:inherit;font:inherit;";
      const icon = document.createElement("span");
      icon.style.cssText = "font-size:16px;width:22px;text-align:center;";
      icon.textContent = a.icon;
      const lbl = document.createElement("span");
      lbl.style.cssText = "min-width:80px;";
      lbl.textContent = a.label;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "1";
      slider.step = "0.05";
      slider.value = String(a.sliderValue ?? 0.5);
      slider.style.cssText = "flex:1;accent-color:#00f5a0;";
      const out = document.createElement("span");
      out.style.cssText = "min-width:64px;font-size:11px;color:rgba(255,255,255,0.7);text-align:right;";
      out.textContent = "";
      slider.addEventListener("input", () => {
        try {
          const txt = a.onSliderInput(parseFloat(slider.value));
          if (txt) out.textContent = String(txt);
        } catch (e) { console.warn("[media-action-slider]", e); }
      });
      // Initial label
      try {
        const txt = a.onSliderInput(parseFloat(slider.value));
        if (txt) out.textContent = String(txt);
      } catch (_e) {}
      row.appendChild(icon);
      row.appendChild(lbl);
      row.appendChild(slider);
      row.appendChild(out);
      menu.appendChild(row);
      continue;
    }
    const row = document.createElement("button");
    row.type = "button";
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;width:100%;text-align:left;" +
      "padding:8px 14px;background:transparent;border:none;color:inherit;" +
      "font:inherit;cursor:pointer;";
    row.innerHTML = `<span style="font-size:16px;width:22px;text-align:center;">${a.icon}</span><span>${a.label}</span>`;
    row.addEventListener("mouseenter", () => { row.style.background = "rgba(255,255,255,0.08)"; });
    row.addEventListener("mouseleave", () => { row.style.background = "transparent"; });
    row.addEventListener("click", () => {
      try { a.onClick(); } catch (e) { console.warn("[media-action]", e); }
      menu.remove();
    });
    menu.appendChild(row);
  }
  screen.appendChild(menu);
  setTimeout(() => {
    const onDoc = (e) => {
      if (!menu.contains(e.target) && e.target !== anchor) {
        menu.remove();
        document.removeEventListener("click", onDoc, true);
      }
    };
    document.addEventListener("click", onDoc, true);
  }, 50);
}

// CSSOS_PHASE2_IMMERSIVE 20260430 #241 — Jing
// "可以在媒体框左下角加一个'Immersive Environments'按钮，让用户在虚拟环境
//  中如Apple Vision Pro使用吗？"
//
// Three-tier cascade:
//   1. WebXR `immersive-vr` session if navigator.xr supports it (Quest
//      browser, Vision Pro WebXR mode, Wolvic, Pico).
//   2. Apple Vision Pro Safari: requestFullscreen() on the <video>
//      element wakes up its built-in cinema environment automatically.
//   3. Desktop / mobile: fullscreen + darken the rest of the page so
//      the user gets a theater-style experience.
// CSSOS_PHASE2_VIDEO_FALLBACK 20260501 #249 — Jing
// "在一些自动播放视频受限的环境，如Tesla的浏览器，应该fallback到自动
//  播放音频，至于画面，可以做一个参数，默认播放视频的增强版幻灯或者
//  切换到Music标签页，由用户选择设置。绝对不要再让用户每一首歌都要
//  再去点击一下才播放声音."
//
// Mode: "slideshow" (default) — hide blocked <video>, show Ken-Burns
// pulsing cover slideshow + audio plays normally. Or "music_tab" —
// flip the watch-panel tab to Music so the disc + audio waveform UI
// drives playback. Persisted to localStorage.
const CSSOS_VIDEO_FALLBACK_KEY = "cssos.video.fallback.mode.v1";
function getVideoFallbackMode() {
  try {
    const v = String(localStorage.getItem(CSSOS_VIDEO_FALLBACK_KEY) || "").trim();
    if (v === "slideshow" || v === "music_tab") return v;
  } catch (_e) {}
  return "slideshow";
}
function setVideoFallbackMode(mode) {
  if (mode !== "slideshow" && mode !== "music_tab") return false;
  try { localStorage.setItem(CSSOS_VIDEO_FALLBACK_KEY, mode); } catch (_e) {}
  return true;
}
globalThis.cssosGetVideoFallbackMode = getVideoFallbackMode;
globalThis.cssosSetVideoFallbackMode = setVideoFallbackMode;

function activateVideoBlockedFallbackModule(item, videoEl) {
  const mode = getVideoFallbackMode();
  console.warn("[video-fallback] mode=%s — keeping audio, swapping visual", mode);
  // Make sure audio is still attempting playback (it has more permissive
  // autoplay rules — should succeed even when video is blocked).
  const audioEl = document.getElementById("watch-audio-preview");
  if (audioEl) {
    audioEl.muted = false;
    if (audioEl.play) {
      audioEl.play().catch((err) => {
        // Audio also blocked — install ONE persistent recovery listener
        // (not per-song) so a single user click anywhere unblocks the
        // rest of the queue forever. This is the LAST resort, not the
        // default UX path.
        console.warn("[video-fallback] audio.play() also rejected:", err?.name);
        if (!globalThis.__cssosAudioGlobalRecover) {
          globalThis.__cssosAudioGlobalRecover = true;
          const recover = () => {
            const a = document.getElementById("watch-audio-preview");
            if (a && a.play) a.play().catch(() => {});
            document.removeEventListener("click", recover, true);
            globalThis.__cssosAudioGlobalRecover = false;
          };
          document.addEventListener("click", recover, true);
          if (typeof globalThis.showToast === "function") {
            globalThis.showToast(loginCopy("Tap once to start audio (browser limit). It will keep playing for the rest of the queue.", "轻触一下开始播放(浏览器限制)。之后整个队列会自动连播。"));
          }
        }
      });
    }
  }
  if (mode === "music_tab") {
    try {
      if (typeof globalThis.activateWatchTab === "function") {
        globalThis.activateWatchTab("music");
      }
    } catch (_e) {}
    return;
  }
  // mode === "slideshow"
  try {
    if (videoEl) {
      videoEl.style.opacity = "0";
      videoEl.style.pointerEvents = "none";
    }
    // CSSOS_WAVE_220A_COVER_POOL 20260519 — Jing: feed the real 5-image
    // cover pool, shuffled per panel-open so every viewing differs. Falls
    // back to [cover ×4] Ken-Burns when no pool exists (legacy works).
    const cover = String(item?.cover_url || item?.cover_image || item?.preview_image_url || "").trim();
    const poolRaw = Array.isArray(item?.cover_slides) ? item.cover_slides : [];
    const pool = poolRaw
      .map((u) => (typeof u === "string" ? u.trim() : ""))
      .filter(Boolean);
    // CSSOS_WAVE_278 20260521 — Jing: 进场 / 视频被浏览器拦住等待首次点击时,
    // 封面只显示【一张稳定的主封面】, 不再洗牌循环整个封面池. 之前循环多张
    // 封面 + 0.7 高强度 → "闪过很多画面", 用户点了还在闪、眼花. 现在: 稳定
    // 一帧 + 视频已预加载, 用户一点击即顺利播放. (封面池的 ken-burns 切换
    // 留给真正的 lite 播放路径, 与本"等待播放"态无关.)
    if (typeof globalThis.cssmvSetCoverSlides === "function") {
      const stable = cover || pool[0] || "";
      if (stable) globalThis.cssmvSetCoverSlides([stable]);
    }
  } catch (_e) {}
}
globalThis.activateVideoBlockedFallbackModule = activateVideoBlockedFallbackModule;

// CSSOS_PHASE2_CINEMA_AUTOHIDE 20260501 #262 — Jing
// "让欣赏界面彻底真真正正干干净净。Hover 才显示媒体框上的一切信息，
//  包括顶部的标题栏。10秒无操作隐藏。Hover 时顶部贴着标题栏，方角，
//  底部贴着屏幕下边缘。"
//
// CSS-driven cinema mode: when watch-panel.classList includes
// "cssmv-cinema", everything fades out (header, pills, take toggle,
// avatar, immersive button, ⋯ menu). Hovering the panel re-adds
// interactivity for 10s.
//
// Title overlay flashes in sync with the user's font-shuffle interval
// (state.fontRefreshIntervalMs, default 60s) — visible for 10s then
// fades, restoring the truly clean field of view.
let __cssosCinemaWired = false;
function ensureCinemaAutoHideModule() {
  if (__cssosCinemaWired) return;
  if (!watchPanel) return;
  __cssosCinemaWired = true;
  const STYLE_ID = "cssos-cinema-style";
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
/* When cinema mode is on, hide all chrome and let the media bleed to
   the screen edges. The 'is-hovering' class re-reveals chrome and
   slides the frame down to sit flush below the title bar.
   CSSOS_WAVE_220B 20260520 — Jing: the title bar is EXCLUDED from
   auto-hide. It now stays resident in cinema mode so the media frame
   sits at a FIXED position below it and never jitters up/down as the
   chrome fades. Only the toolbars / pills / take-toggle auto-hide. */
#watch-panel.cssmv-cinema .panel-toolbar,
#watch-panel.cssmv-cinema .watch-toolbar,
#watch-panel.cssmv-cinema #watch-pill-row-bl,
#watch-panel.cssmv-cinema #watch-aspect-pill,
#watch-panel.cssmv-cinema #watch-author-avatar,
#watch-panel.cssmv-cinema #watch-take-toggle,
/* W335 20260522 — ✕ and search box join the same opacity fade as avatar */
#watch-panel.cssmv-cinema #watch-exit-cinema,
#watch-panel.cssmv-cinema #watch-search-box {
  opacity: 0;
  pointer-events: none;
  /* CSSOS_WAVE_111D_CHROME_FADE 20260512 — Jing: "像流水般自然显示/隐藏，
     不要一闪一跳的". Show fades in over 220ms (snappy enough to feel
     responsive), hide fades out over 900ms (long enough to feel like
     a graceful exit, never abrupt). Combined with the 10s idle timer
     in JS this gives: hover → fade in 0.22s → stay 10s → fade out 0.9s. */
  transition: opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: opacity;
}
#watch-panel.cssmv-cinema.is-hovering .panel-toolbar,
#watch-panel.cssmv-cinema.is-hovering .watch-toolbar,
#watch-panel.cssmv-cinema.is-hovering #watch-pill-row-bl,
#watch-panel.cssmv-cinema.is-hovering #watch-aspect-pill,
#watch-panel.cssmv-cinema.is-hovering #watch-author-avatar,
#watch-panel.cssmv-cinema.is-hovering #watch-take-toggle,
#watch-panel.cssmv-cinema.is-hovering #watch-exit-cinema,
#watch-panel.cssmv-cinema.is-hovering #watch-search-box {
  opacity: 1;
  pointer-events: auto;
  /* Faster fade-in than fade-out — feels like responsive "appear" */
  transition: opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
/* CSSOS_WAVE_220B 20260520 — Jing: title bar is always resident in
   cinema mode (never fades). Fixed frame anchor → no jitter. */
#watch-panel.cssmv-cinema .panel-title-bar {
  opacity: 1 !important;
  pointer-events: auto !important;
}
/* CSSOS_WAVE_111D_CHROME_FADE 20260512 — keep the frame geometry
   IDENTICAL between hovering / not-hovering so the picture doesn't
   "shake" when chrome fades. Previously we animated margin-top +
   border-radius alongside opacity, which caused a visible 4px jolt
   every time the chrome appeared. Now chrome layers on top via
   absolute positioning; the picture stays put. */
#watch-panel.cssmv-cinema .watch-frame {
  border-radius: 0 !important;
  margin: 0 !important;
  /* no animated geometry — only opacity transitions above */
}
/* Title overlay flash — controlled by JS toggling .karaoke-flash. */
#watch-panel.cssmv-cinema #watch-karaoke-line.karaoke-flash {
  opacity: 1;
  transition: opacity 0.4s ease;
}
#watch-panel.cssmv-cinema #watch-karaoke-line {
  opacity: 0;
  transition: opacity 0.4s ease;
}
/* CSSOS_WAVE10 20260508 — mobile safe-area for cinema mode */
@media (max-width: 480px) {
  #watch-panel.cssmv-cinema {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
  #watch-panel.cssmv-cinema #watch-karaoke-line {
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }
  #watch-panel.cssmv-cinema .watch-toolbar button,
  #watch-panel.cssmv-cinema .panel-toolbar button {
    min-height: 44px;
    min-width: 44px;
  }
}
/* W338 20260522 — fullscreen cinema: zero out ALL padding injected above.
 * This rule is in the SAME injected stylesheet so it loads at the same
 * time as the media-query rule above; higher specificity (2 classes vs 1)
 * wins without needing !important, and beats style.css cascade-order too. */
#watch-panel.cssmv-cinema.is-cssmv-fullscreen {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
`;
    document.head.appendChild(st);
  }

  // Default: cinema mode ON whenever watch panel shows. Toggle off via
  // globalThis.cssosCinemaMode = false for users who prefer chrome.
  const ENABLED_KEY = "cssos.cinema.enabled.v1";
  const isEnabled = () => {
    try {
      const v = localStorage.getItem(ENABLED_KEY);
      if (v === "0") return false;
    } catch (_e) {}
    return true;
  };
  if (isEnabled()) watchPanel.classList.add("cssmv-cinema");
  globalThis.cssosCinemaMode = (on) => {
    try { localStorage.setItem(ENABLED_KEY, on ? "1" : "0"); } catch (_e) {}
    watchPanel.classList.toggle("cssmv-cinema", !!on);
  };

  // 10-second idle auto-hide: any interaction extends the hover window.
  let hoverTimer = null;
  const showHover = () => {
    watchPanel.classList.add("is-hovering");
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      watchPanel.classList.remove("is-hovering");
    }, 10_000);
  };
  ["mousemove", "touchstart", "pointerdown", "wheel", "keydown"].forEach((ev) => {
    watchPanel.addEventListener(ev, showHover, { passive: true });
  });
  // Initial reveal so the user sees the chrome on first open.
  showHover();

  // CSSOS_WAVE_332 20260522 — Jing: 字幕标题显示 10 秒、每次随机换字体, 然后隐藏;
  // 频率 = 用户在「字体自动切换 Auto-shuffle every」里设的间隔. 做法: 标题闪现直接
  // 绑定字体切换事件(cssmv:font-shuffle, 由 restartAutoRotate 按用户分钟数触发)——
  // 字体一换就闪标题 10 秒, 两者天然同步、同一个间隔. (之前用独立 setInterval 读另一个
  // key, 与用户设置不联动, 且闪标题时字体不变。)
  let _karFlashTimer = null;
  const flashKaraokeTitle = () => {
    const kar = document.getElementById("watch-karaoke-line");
    if (!kar) return;
    kar.classList.add("karaoke-flash");
    if (_karFlashTimer) clearTimeout(_karFlashTimer);
    _karFlashTimer = setTimeout(() => kar.classList.remove("karaoke-flash"), 10_000);
  };
  // 每次字体随机切换 → 标题闪现 10 秒(频率随用户的 Auto-shuffle 设置).
  try { window.addEventListener("cssmv:font-shuffle", flashKaraokeTitle, { passive: true }); } catch (_e) {}
  flashKaraokeTitle(); // 进入时先亮一次.
}

// CSSOS_PHASE2_AUTHOR_AVATAR 20260501 #246 — Jing
// "请在媒体框内设计该首歌的作者头像，用户点击该头像进入到该用户的作品中心.
//  可以关注该用户加为好友. 同样逻辑，如果点击该用户的作品，则默认从新到旧
//  循环播放该用户的音乐列表（只播放该用户的作品）."
//
// Renders a small circular avatar in the media frame top-left. Reads
// owner_name + owner_id from pipelineState (pushed from openMarketWork-
// Preview's hydration). Click → creates a synthetic per-author playlist
// (filters cssosPlaylists items to that author), sets it active. Long
// press / right-click → follow/friend menu (scaffold; backend endpoint
// arrives in a follow-up task).
/* CSSOS_WAVE_203 20260516 — Jing: "充值（包括帮充值）". P2P credit gift
 * modal — picks an amount (4 quick chips + custom), confirms balance,
 * fires POST /api/gifts/credits. On success shows a 🎉 toast with the
 * remaining balance; on insufficient funds prompts to top up own
 * balance first. */
function openCreditGiftModal(recipientId, recipientName) {
  // Tear down any previous modal so we don't stack.
  document.querySelectorAll(".cssos-gift-modal").forEach((el) => el.remove());

  const PRESETS = [
    { credits: 100, label: "100", note: "≈ $1" },
    { credits: 500, label: "500", note: "≈ $5" },
    { credits: 1500, label: "1,500", note: "≈ $15" },
    { credits: 5000, label: "5,000", note: "≈ $50" },
  ];
  let selectedCredits = 500;
  let customCredits = "";

  const overlay = document.createElement("div");
  overlay.className = "cssos-gift-modal";
  overlay.style.cssText = [
    "position:fixed","inset:0","z-index:10054", /* CSSOS_WAVE_351 收敛: 99998 → 10054 (gift modal over watch) */
    "background:rgba(0,0,0,0.55)","backdrop-filter:blur(6px)",
    "display:flex","align-items:center","justify-content:center",
    "padding:20px","font:500 14px/1.4 -apple-system,system-ui,sans-serif",
    "color:rgba(255,255,255,0.95)",
  ].join(";");

  const card = document.createElement("div");
  card.style.cssText = [
    "max-width:420px","width:100%","background:rgba(15,18,24,0.98)",
    "border:1px solid rgba(255,200,120,0.4)","border-radius:16px",
    "padding:24px","box-shadow:0 20px 60px rgba(0,0,0,0.7)",
  ].join(";");
  overlay.appendChild(card);

  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <span style="font-size:28px;">🎁</span>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:16px;">${loginCopy(`Send credits to ${escapeHtmlGift(recipientName)}`, `为 ${escapeHtmlGift(recipientName)} 充值`)}</div>
        <div style="font-size:11px;opacity:0.7;margin-top:2px;">${loginCopy("Charged from your balance, instantly delivered.", "从你的余额扣除，立即到账。")}</div>
      </div>
    </div>
    <div data-balance style="font-size:12px;opacity:0.7;margin-bottom:12px;">${loginCopy("Loading your balance…", "正在加载余额…")}</div>
    <div data-presets style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;"></div>
    <label style="display:block;font-size:11px;opacity:0.7;margin-bottom:6px;">${loginCopy("Or custom amount (credits)", "或自定义数量（积分）")}</label>
    <input data-custom type="number" min="50" max="50000" step="50" placeholder="50–50000"
      style="width:100%;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:9px 11px;color:inherit;font:inherit;box-sizing:border-box;margin-bottom:16px;" />
    <div data-error style="color:#ff8c8c;font-size:11px;min-height:14px;margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;">
      <button type="button" data-cancel style="flex:1;background:transparent;color:inherit;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px;cursor:pointer;font:inherit;">${loginCopy("Cancel","取消")}</button>
      <button type="button" data-send style="flex:2;background:rgba(255,200,120,0.22);color:#fff;border:1px solid rgba(255,200,120,0.6);border-radius:8px;padding:10px;cursor:pointer;font-weight:700;font:inherit;">${loginCopy("Send 🎁","赠送 🎁")}</button>
    </div>
  `;

  // Populate preset chips.
  const presetsEl = card.querySelector("[data-presets]");
  PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.credits = String(p.credits);
    btn.style.cssText = [
      "background:rgba(255,255,255,0.06)","border:1.5px solid rgba(255,255,255,0.14)",
      "color:inherit","border-radius:10px","padding:10px 6px","cursor:pointer",
      "font:inherit","display:flex","flex-direction:column","gap:2px",
    ].join(";");
    btn.innerHTML = `<span style="font-weight:700;">${p.label}</span><span style="font-size:10px;opacity:0.7;">${p.note}</span>`;
    btn.addEventListener("click", () => {
      selectedCredits = p.credits;
      customCredits = "";
      const customEl = card.querySelector("[data-custom]");
      if (customEl) customEl.value = "";
      Array.from(presetsEl.children).forEach((c) => {
        c.style.background = "rgba(255,255,255,0.06)";
        c.style.borderColor = "rgba(255,255,255,0.14)";
      });
      btn.style.background = "rgba(255,200,120,0.22)";
      btn.style.borderColor = "rgba(255,200,120,0.6)";
    });
    presetsEl.appendChild(btn);
  });
  // Pre-select 500.
  presetsEl.children[1]?.click();

  const customInput = card.querySelector("[data-custom]");
  customInput.addEventListener("input", () => {
    customCredits = customInput.value;
    if (customCredits) {
      Array.from(presetsEl.children).forEach((c) => {
        c.style.background = "rgba(255,255,255,0.06)";
        c.style.borderColor = "rgba(255,255,255,0.14)";
      });
    }
  });

  // Load balance.
  const balanceEl = card.querySelector("[data-balance]");
  (async () => {
    try {
      const r = await fetch("/api/me", { credentials: "include" });
      const j = await r.json().catch(() => null);
      const bal = Number(j?.user?.credit_balance ?? j?.credits_balance ?? 0);
      balanceEl.textContent = loginCopy(
        `Your balance: ${bal.toLocaleString()} credits`,
        `你的余额：${bal.toLocaleString()} 积分`
      );
    } catch (_e) {
      balanceEl.textContent = loginCopy("Balance unavailable.", "余额暂不可用。");
    }
  })();

  const close = () => overlay.remove();
  card.querySelector("[data-cancel]").addEventListener("click", close);
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });

  const errorEl = card.querySelector("[data-error]");
  const sendBtn = card.querySelector("[data-send]");
  sendBtn.addEventListener("click", async () => {
    errorEl.textContent = "";
    let amount = customCredits ? Math.floor(Number(customCredits)) : selectedCredits;
    if (!Number.isFinite(amount) || amount < 50 || amount > 50000) {
      errorEl.textContent = loginCopy("Amount must be 50–50,000 credits.", "数量必须在 50–50000 积分之间。");
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = loginCopy("Sending…", "发送中…");
    try {
      const r = await fetch("/api/gifts/credits", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: recipientId, amount }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok) {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(loginCopy(
            `🎉 Sent ${amount} credits to ${recipientName}`,
            `🎉 已向 ${recipientName} 赠送 ${amount} 积分`
          ));
        }
        close();
      } else {
        const code = j?.code || `HTTP ${r.status}`;
        const msg = code === "INSUFFICIENT_BALANCE"
          ? loginCopy("Not enough credits — top up first.", "余额不足，请先充值。")
          : code === "BLOCKED"
            ? loginCopy("This user has blocked you (or vice versa).", "TA 屏蔽了你，或你屏蔽了 TA。")
            : code === "AUTH_REQUIRED"
              ? loginCopy("Sign in to send credits.", "请先登录。")
              : loginCopy(`Failed: ${code}`, `发送失败：${code}`);
        errorEl.textContent = msg;
        sendBtn.disabled = false;
        sendBtn.textContent = loginCopy("Send 🎁", "赠送 🎁");
      }
    } catch (e) {
      errorEl.textContent = loginCopy("Network error.", "网络错误。");
      sendBtn.disabled = false;
      sendBtn.textContent = loginCopy("Send 🎁", "赠送 🎁");
    }
  });

  // CSSOS_WAVE_205 — mount the credit-gift modal inside the fullscreen
  // element when active so it doesn't get covered.
  (document.fullscreenElement || document.body).appendChild(overlay);
  setTimeout(() => customInput.focus(), 100);
}
function escapeHtmlGift(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#039;");
}

let __cssosAuthorAvatarWired = false;
function ensureAuthorAvatarModule() {
  if (__cssosAuthorAvatarWired) return;
  const screen = document.querySelector("#watch-panel .watch-screen");
  if (!screen) return;
  if (document.getElementById("watch-author-avatar")) return;
  __cssosAuthorAvatarWired = true;
  const avatar = document.createElement("button");
  avatar.id = "watch-author-avatar";
  avatar.type = "button";
  avatar.title = "By unknown author";
  avatar.setAttribute("aria-label", loginCopy("Author — tap for options", "作者 — 点击查看选项")); // CSSOS_WAVE_274 无障碍
  // CSSOS_PHASE2_AVATAR_SOLO 20260501 #263 — Jing
  // "媒体框左上角，请让用户头像独占." Aspect pill moved into the ⋯
  // menu, so the avatar takes the top-left corner alone at top:12px.
  avatar.style.cssText =
    "position:absolute;left:12px;top:12px;width:40px;height:40px;" +
    "border-radius:50%;border:2px solid rgba(255,255,255,0.6);" +
    "background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);" +
    "color:#fff;font-size:14px;font-weight:700;cursor:pointer;" +
    "display:flex;align-items:center;justify-content:center;" +
    "z-index:30;overflow:hidden;transition:transform .15s ease, box-shadow .15s ease;";
  avatar.dataset.ownerId = "";
  // Refresh the avatar whenever the playlist switches songs (which our
  // code emits via pl.onChange) and on initial mount.
  const refresh = () => {
    try {
      const ps = globalThis.cssosMvPipelinePanelState
        ? globalThis.cssosMvPipelinePanelState()
        : null;
      let ownerId = String(ps?.ownerId || ps?.owner_id || "").trim();
      let ownerName = String(ps?.ownerName || ps?.owner_name || "").trim();
      let ownerAvatar = String(ps?.ownerAvatarUrl || "").trim();
      /* CSSOS_WAVE_213 20260517 — Jing: "哪怕是在输出的时候，左上角也要显示
       * 自己的头像". When the pipeline is mid-output, ownerId is still
       * empty (work not committed). Fall back to the SIGNED-IN user so
       * the avatar always renders. Menu code below uses ownerId === my-id
       * to gray out Follow/Block (can't follow/block self). */
      if (!ownerId) {
        const auth = (typeof globalThis.cssosAuthState === "function")
          ? globalThis.cssosAuthState()
          : globalThis.authState;
        const meId = String(auth?.user?.id || "").trim();
        if (meId) {
          ownerId = meId;
          ownerName = String(auth?.user?.display_name || auth?.user?.email || "You").trim();
          ownerAvatar = String(auth?.user?.avatar_url || auth?.user?.avatar || auth?.user?.picture || "").trim();
        }
      }
      avatar.dataset.ownerId = ownerId;
      avatar.title = ownerName ? `By ${ownerName} — click for options` : "Unknown author";
      // CSSOS_WAVE_274 无障碍: aria-label 随作者名更新(屏幕阅读器念出作者).
      avatar.setAttribute("aria-label", ownerName
        ? loginCopy(`Author ${ownerName} — tap for options`, `作者 ${ownerName} — 点击查看选项`)
        : loginCopy("Author — tap for options", "作者 — 点击查看选项"));
      avatar.innerHTML = "";
      if (ownerAvatar) {
        const img = document.createElement("img");
        img.src = ownerAvatar;
        img.alt = ownerName || "author";
        img.style.cssText = "width:100%;height:100%;object-fit:cover;";
        avatar.appendChild(img);
        // 有头像图 → 还原默认深色底(图会盖住, 但保持干净).
        try { avatar.style.removeProperty("background"); } catch (_e) {}
      } else {
        // Fallback: initials.
        const initial = (ownerName || "?").trim().charAt(0).toUpperCase();
        avatar.textContent = initial;
        // CSSOS_WAVE_318 20260521 — Jing: 未登录/无作者的空「?」圈太黑, 给个随机色底,
        // 比死黑好看. 仅在"无头像图"时染色; 有真头像时还原(见上).
        try {
          var h = Math.floor(Math.random() * 360);
          avatar.style.setProperty("background", "hsl(" + h + ",65%,48%)", "important");
        } catch (_e) {}
      }
    } catch (_e) {}
  };
  refresh();
  /* CSSOS_WAVE_200 20260516 — Jing: "短剧用户头像，显示小菜单，进入该用户
   * 的作品中心面板，只播放该用户的作品。关注/屏蔽/赠送礼物等用户之间的
   * 互助行为". Replace the single-click insta-filter with a click → menu
   * that exposes all four user-to-user interaction surfaces. The old
   * filter behavior is preserved as the FIRST menu item (one extra click
   * but you get the other three options for free). */
  const playOnlyTheirWorks = (ownerId, ownerName) => {
    try {
      const pl = globalThis.cssosPlaylists;
      if (!pl) return;
      const listId = `author-${ownerId}`;
      const existing = pl.lists().find((l) => l.id === listId);
      if (!existing) {
        const seen = new Set();
        const collected = [];
        ["for-you", "mine"].forEach((srcId) => {
          const items = (pl._state?.lists?.[srcId]?.items || []);
          for (const it of items) {
            const id = String(it?.id || "").trim();
            if (!id || seen.has(id)) continue;
            const matches =
              (it.owner_id && String(it.owner_id) === ownerId) ||
              (it.owner_name && it.owner_name === ownerName);
            if (matches) { collected.push(it); seen.add(id); }
          }
        });
        collected.sort((a, b) =>
          (Date.parse(String(b?.created_at || "")) || 0) -
          (Date.parse(String(a?.created_at || "")) || 0)
        );
        const newId = pl.createCustom(`✨ ${ownerName}`);
        const list = pl._state?.lists?.[newId];
        if (list) list.items = collected;
        pl.setActive(newId);
      } else {
        pl.setActive(listId);
      }
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(loginCopy(
          `Now playing only ${ownerName}'s works`,
          `当前只播放 ${ownerName} 的作品`
        ));
      }
    } catch (e) { console.warn("[author-avatar][play-only]", e); }
  };

  const openMenu = async (ownerId, ownerName, anchorEl) => {
    if (!ownerId) {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(loginCopy("Author info unavailable on this work.", "本作品作者信息不可用。"));
      }
      return;
    }
    // Close any existing menu so we don't stack.
    document.querySelectorAll(".cssos-author-menu").forEach((el) => el.remove());

    // Fetch relationship state in parallel with menu render.
    let rel = { is_following: false, is_blocked: false, is_self: false, signed_in: false };
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(ownerId)}/relationship`, { credentials: "include" });
      if (r.ok) rel = await r.json();
    } catch (_e) {}

    const menu = document.createElement("div");
    menu.className = "cssos-author-menu";
    menu.style.cssText = [
      "position:fixed", "z-index:10055", /* CSSOS_WAVE_351 收敛: 99999 → 10055 (author menu) */ "min-width:240px",
      "background:rgba(10,12,16,0.96)", "backdrop-filter:blur(20px) saturate(160%)",
      "border:1px solid rgba(255,255,255,0.16)", "border-radius:12px",
      "padding:6px", "box-shadow:0 12px 40px rgba(0,0,0,0.6)",
      "font:500 13px/1.4 -apple-system,system-ui,sans-serif",
      "color:rgba(255,255,255,0.95)", "user-select:none",
    ].join(";");
    const rect = anchorEl.getBoundingClientRect();
    menu.style.left = `${Math.round(rect.left)}px`;
    menu.style.top = `${Math.round(rect.bottom + 6)}px`;

    const header = document.createElement("div");
    header.style.cssText = "padding:8px 12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px;font-weight:700;letter-spacing:0.02em;";
    header.textContent = ownerName;
    menu.appendChild(header);

    const addItem = (icon, label, onClick, opts) => {
      const o = opts || {};
      const item = document.createElement("button");
      item.type = "button";
      /* CSSOS_WAVE_213 — `disabled` prop renders the item visible but
       * grayed out and non-interactive (used for Follow/Block on own
       * works: user sees the affordance but it's clearly inactive). */
      const dis = !!o.disabled;
      item.disabled = dis;
      item.style.cssText = [
        "display:flex", "align-items:center", "gap:10px", "width:100%",
        "background:transparent", "border:none", "color:inherit",
        "padding:9px 12px", "border-radius:7px",
        dis ? "cursor:not-allowed" : "cursor:pointer",
        "font:inherit", "text-align:left",
        dis ? "opacity:0.42;color:rgba(255,255,255,0.5);" :
          (o.danger ? "color:#ff8c8c" : ""),
      ].join(";");
      item.innerHTML = `<span style="font-size:16px;width:20px;text-align:center;">${icon}</span><span style="flex:1;">${label}${dis ? ' <span style="font-size:10px;opacity:0.7;">(self)</span>' : ''}</span>`;
      if (!dis) {
        item.addEventListener("mouseenter", () => { item.style.background = "rgba(255,255,255,0.08)"; });
        item.addEventListener("mouseleave", () => { item.style.background = "transparent"; });
      }
      item.addEventListener("click", async () => {
        if (dis) return;
        menu.remove();
        try { await onClick(); } catch (e) { console.warn("[author-menu]", e); }
      });
      menu.appendChild(item);
    };

    addItem("🎬", loginCopy("Play only their works", "只播放 TA 的作品"), () => {
      playOnlyTheirWorks(ownerId, ownerName);
    });

    addItem("👤", loginCopy("Open their Works Center", "打开 TA 的作品中心"), () => {
      // Best-effort: prefer a global opener, fallback to /u/:id URL
      if (typeof globalThis.cssosOpenUserHomepageModule === "function") {
        globalThis.cssosOpenUserHomepageModule({ userId: ownerId, displayName: ownerName });
      } else if (typeof globalThis.openUserHomepage === "function") {
        globalThis.openUserHomepage({ userId: ownerId, displayName: ownerName });
      } else {
        // Last-resort navigation
        location.hash = `#user/${encodeURIComponent(ownerId)}`;
      }
    });

    /* CSSOS_WAVE_213 20260517 — Jing: "不能关注自己，也不能拉黑自己，
     * 但是要 显示 灰色不可用". Show Follow/Block always when signed in,
     * but disable + gray when `is_self`. The user immediately understands
     * the affordance without thinking "why is it missing on my own
     * works?". */
    if (rel.signed_in) {
      addItem(
        rel.is_following ? "✓" : "➕",
        rel.is_following
          ? loginCopy("Following — tap to unfollow", "已关注 — 点击取消")
          : loginCopy("Follow", "关注 TA"),
        async () => {
          if (rel.is_self) return; // disabled on self
          try {
            const r = await fetch(`/api/users/${encodeURIComponent(ownerId)}/follow`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            const j = await r.json().catch(() => ({}));
            if (j && j.ok) {
              if (typeof globalThis.showToast === "function") {
                globalThis.showToast(j.following
                  ? loginCopy(`Following ${ownerName}`, `已关注 ${ownerName}`)
                  : loginCopy(`Unfollowed ${ownerName}`, `已取消关注 ${ownerName}`)
                );
              }
            }
          } catch (_e) {}
        },
        { disabled: rel.is_self }
      );

      addItem(
        rel.is_blocked ? "✓" : "🚫",
        rel.is_blocked
          ? loginCopy("Blocked — tap to unblock", "已屏蔽 — 点击取消")
          : loginCopy("Block", "屏蔽 TA"),
        async () => {
          if (rel.is_self) return; // disabled on self
          try {
            const r = await fetch(`/api/users/${encodeURIComponent(ownerId)}/block`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            const j = await r.json().catch(() => ({}));
            if (j && j.ok && typeof globalThis.showToast === "function") {
              globalThis.showToast(j.blocked
                ? loginCopy(`Blocked ${ownerName}`, `已屏蔽 ${ownerName}`)
                : loginCopy(`Unblocked ${ownerName}`, `已取消屏蔽 ${ownerName}`)
              );
            }
          } catch (_e) {}
        },
        { danger: !rel.is_blocked && !rel.is_self, disabled: rel.is_self }
      );
    }
    /* CSSOS_WAVE_228 20260518 — Jing: "DM 如果是本人, 显示灰色不可用".
     * 跟 Follow/Block 一致, 自己永远显示 DM 项, is_self → 灰色禁用. */
    if (rel.signed_in) {
      addItem("💬", loginCopy("DM in AI Assistant", "AI 助理私聊"), () => {
        if (rel.is_self) return;
        if (typeof globalThis.cssosOpenDmWith === "function") {
          globalThis.cssosOpenDmWith(ownerId);
        } else if (typeof globalThis.showToast === "function") {
          globalThis.showToast(loginCopy("DM not available right now.", "私聊功能暂时不可用。"));
        }
      }, { disabled: rel.is_self });
    }
    if (rel.signed_in && !rel.is_self) {

      addItem("🎁", loginCopy("Send a gift…", "赠送礼物…"), () => {
        // CSSOS_WAVE_202c — gift now opens a small sub-menu so the user
        // can pick: tip this work (existing), buy credits for the
        // recipient ("帮充值"), or gift one of the recipient's works
        // back to them ("赠送作品"). We open a follow-up menu anchored
        // to the same spot. Sub-options that have no backend yet show
        // "coming soon" — better than silently doing nothing.
        document.querySelectorAll(".cssos-author-menu").forEach((el) => el.remove());
        const sub = document.createElement("div");
        sub.className = "cssos-author-menu";
        sub.style.cssText = [
          "position:fixed", "z-index:10056", /* CSSOS_WAVE_351 收敛: 99999 → 10056 (author submenu, above parent menu 10055) */ "min-width:260px",
          "background:rgba(10,12,16,0.96)", "backdrop-filter:blur(20px) saturate(160%)",
          "border:1px solid rgba(255,200,120,0.35)", "border-radius:12px",
          "padding:6px", "box-shadow:0 12px 40px rgba(0,0,0,0.6)",
          "font:500 13px/1.4 -apple-system,system-ui,sans-serif",
          "color:rgba(255,255,255,0.95)", "user-select:none",
        ].join(";");
        const ar = avatar.getBoundingClientRect();
        sub.style.left = `${Math.round(ar.left)}px`;
        sub.style.top = `${Math.round(ar.bottom + 6)}px`;
        const hdr = document.createElement("div");
        hdr.style.cssText = "padding:8px 12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px;font-weight:700;color:#ffd28d;";
        hdr.textContent = loginCopy(`🎁 Gift to ${ownerName}`, `🎁 赠礼给 ${ownerName}`);
        sub.appendChild(hdr);
        const addSub = (icon, label, onClick, opts) => {
          const o = opts || {};
          const item = document.createElement("button");
          item.type = "button";
          item.style.cssText = [
            "display:flex","align-items:center","gap:10px","width:100%",
            "background:transparent","border:none","color:inherit",
            "padding:9px 12px","border-radius:7px","cursor:pointer",
            "font:inherit","text-align:left",
            o.muted ? "opacity:0.55;" : "",
          ].join(";");
          item.innerHTML = `<span style="font-size:16px;width:20px;text-align:center;">${icon}</span><span style="flex:1;">${label}</span>${o.muted ? '<span style="font-size:10px;opacity:0.7;">soon</span>' : ''}`;
          item.addEventListener("mouseenter", () => { item.style.background = "rgba(255,200,120,0.08)"; });
          item.addEventListener("mouseleave", () => { item.style.background = "transparent"; });
          item.addEventListener("click", async () => {
            sub.remove();
            try { await onClick(); } catch (e) { console.warn("[gift-menu]", e); }
          });
          sub.appendChild(item);
        };

        addSub("☕", loginCopy("Tip this work (instant)", "打赏本作品 (立即生效)"), () => {
          // CSSOS_WAVE_262 — 接通打赏: dispatchMarketWorkPayment(workId,"tip",btn)
          // 是正确签名 (统一支付选择器). 之前传 {kind:"tip"} 对象 → workId 为空
          // → 静默失败. 用当前播放作品 id; 不能打赏自己 (上层 !rel.is_self 已挡).
          const tipWorkId = String(
            (typeof globalThis.cssosCurrentWorkId === "function" && globalThis.cssosCurrentWorkId()) || ""
          ).trim();
          if (tipWorkId && typeof globalThis.dispatchMarketWorkPayment === "function") {
            try { globalThis.dispatchMarketWorkPayment(tipWorkId, "tip", avatar); } catch (_e) {}
          } else if (typeof globalThis.showToast === "function") {
            globalThis.showToast(loginCopy("Tip flow not available right now.", "打赏功能暂时不可用。"));
          }
        });

        addSub("💰", loginCopy("Top up credits for them", "为 TA 充值算力"), () => {
          // CSSOS_WAVE_203 — wired directly to POST /api/gifts/credits.
          openCreditGiftModal(ownerId, ownerName);
        });

        addSub("🎬", loginCopy("Gift one of TA's works to TA", "赠送 TA 自己的作品给 TA"), () => {
          if (typeof globalThis.cssosOpenWorkGiftModalModule === "function") {
            globalThis.cssosOpenWorkGiftModalModule({ recipientId: ownerId, recipientName: ownerName });
          } else if (typeof globalThis.showToast === "function") {
            globalThis.showToast(loginCopy("Work-gift flow coming soon.", "赠送作品 — 即将上线。"));
          }
        }, { muted: typeof globalThis.cssosOpenWorkGiftModalModule !== "function" });

        // CSSOS_WAVE_205 — fullscreen-aware mounting (same fix as parent menu).
        (document.fullscreenElement || document.body).appendChild(sub);
        const onAway = (ev) => {
          if (!sub.contains(ev.target)) {
            sub.remove();
            document.removeEventListener("mousedown", onAway, true);
            document.removeEventListener("touchstart", onAway, true);
          }
        };
        setTimeout(() => {
          document.addEventListener("mousedown", onAway, true);
          document.addEventListener("touchstart", onAway, true);
        }, 50);
      });
    } else if (!rel.signed_in) {
      const note = document.createElement("div");
      note.style.cssText = "padding:8px 12px;font-size:11px;opacity:0.6;border-top:1px solid rgba(255,255,255,0.08);margin-top:4px;";
      note.textContent = loginCopy("Sign in to follow, block, or send gifts.", "登录后可关注 / 屏蔽 / 赠送礼物。");
      menu.appendChild(note);
    }

    /* CSSOS_WAVE_205 20260516 — Jing: "头像菜单无法弹出，可能是被全屏
     * 遮住了，请让菜单高于全屏." When the watch panel is in fullscreen
     * mode, the fullscreen element creates a new stacking context that
     * sits ABOVE document.body — z-index:99999 on a body child still
     * loses. Solution: append to document.fullscreenElement when
     * fullscreen is active, fall back to body otherwise. Same fix
     * applied to the gift sub-menu below. */
    (document.fullscreenElement || document.body).appendChild(menu);
    // Click-outside-closes
    const onClickAway = (ev) => {
      if (!menu.contains(ev.target) && ev.target !== anchorEl) {
        menu.remove();
        document.removeEventListener("mousedown", onClickAway, true);
        document.removeEventListener("touchstart", onClickAway, true);
      }
    };
    setTimeout(() => {
      document.addEventListener("mousedown", onClickAway, true);
      document.addEventListener("touchstart", onClickAway, true);
    }, 50);
  };

  avatar.addEventListener("click", () => {
    openMenu(avatar.dataset.ownerId, avatar.title.replace(/^By |\s—.*$/g, "").trim() || "Author", avatar);
  });
  // Hover effect.
  avatar.addEventListener("mouseenter", () => { avatar.style.transform = "scale(1.08)"; });
  avatar.addEventListener("mouseleave", () => { avatar.style.transform = ""; });
  // Subscribe to playlist + state updates.
  if (globalThis.cssosPlaylists?.onChange) {
    globalThis.cssosPlaylists.onChange(refresh);
  }
  globalThis.__cssosRefreshAuthorAvatar = refresh;
  screen.style.position = screen.style.position || "relative";
  screen.appendChild(avatar);
}

// CSSOS_WAVE_113B1 20260511 — Jing
// "左下角去掉 immersive，而是媒体框最大化的时候，一定要调用窗口最大化，
//  这样在 Apple Vision Pro 虚拟环境中才会自动调取系统的 Immersive 功能。"
// The standalone Immersive pill is retired. Fullscreen / VisionPro
// Immersive is now triggered automatically when the user maximizes
// the watch panel (see togglePanelMaximizeModule in app.panel-layout.js
// → globalThis.cssosEnterWatchFullscreen()).
let __cssosImmersivePillWired = false;
function ensureImmersivePillModule() {
  if (__cssosImmersivePillWired) return;
  __cssosImmersivePillWired = true;
  // Defensive: if a stale pill from a previous load is sitting in the
  // DOM, yank it.
  const stale = document.getElementById("watch-immersive-pill");
  if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
  return;
  // eslint-disable-next-line no-unreachable
  const row = ensureBottomLeftPillRowModule();
  if (!row) return;
  if (document.getElementById("watch-immersive-pill")) return;

  const pill = document.createElement("button");
  pill.id = "watch-immersive-pill";
  pill.type = "button";
  pill.title = "Immersive Environments — Vision Pro / WebXR / cinema fullscreen";
  pill.setAttribute("aria-label", loginCopy("Immersive view", "沉浸式全屏")); // CSSOS_WAVE_274 无障碍
  // CSSOS_PHASE2_PILL_ROW 20260430 #241b — sits in the shared
  // bottom-left flex row alongside the playlist pill, no longer
  // absolutely positioned itself.
  pill.style.cssText =
    "display:flex;align-items:center;gap:6px;" +
    "background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);" +
    "border:1px solid rgba(255,255,255,0.18);border-radius:999px;" +
    "padding:6px 12px;font-size:11px;font-weight:600;letter-spacing:.04em;" +
    "color:rgba(255,255,255,0.85);cursor:pointer;transition:all .15s ease;";
  pill.textContent = "👓 Immersive";

  // CSSOS_PHASE2_IMMERSIVE 20260430 #241c — Jing
  // "Issue During WebXR Experience: The WebXR experience failed to
  //  respond." Removed the WebXR session.requestSession() path because
  // immersive-vr requires a WebGL render layer (Three.js / babylon /
  // raw GL) — without one the XR runtime sees no frames and surfaces
  // the "failed to respond" error. Vision Pro Safari's native cinema
  // environment, Quest browser's fullscreen video mode, and desktop
  // fullscreen ALL light up correctly via plain `requestFullscreen()`
  // on the <video> element — no XR session needed. We'll re-enable
  // WebXR with a proper Three.js render layer in a follow-up.

  pill.addEventListener("click", async () => {
    const videoEl = document.getElementById("watch-video");
    const frame = document.querySelector("#watch-panel .watch-frame");
    // Fullscreen the video. Vision Pro Safari triggers its native
    // cinema environment automatically; Quest browser shows the
    // video on a curved virtual screen; desktop / mobile go to
    // standard fullscreen with our theater backdrop.
    try {
      const target = videoEl || frame;
      if (target?.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target?.webkitEnterFullscreen) {
        // iOS / Vision Pro / older Safari path.
        target.webkitEnterFullscreen();
      } else if (target?.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }
      document.body.classList.add("cssos-watch-theater");
      const onExit = () => {
        if (!document.fullscreenElement) {
          document.body.classList.remove("cssos-watch-theater");
          document.removeEventListener("fullscreenchange", onExit);
        }
      };
      document.addEventListener("fullscreenchange", onExit);
    } catch (err) {
      console.warn("[immersive] fullscreen failed:", err);
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(loginCopy("Immersive view unavailable on this browser.", "此浏览器不支持沉浸式全屏。"));
      }
    }
  });
  row.appendChild(pill);

  // Theater backdrop — kicks in when document.body has the
  // cssos-watch-theater class (added on fullscreen entry above).
  if (!document.getElementById("cssos-theater-style")) {
    const style = document.createElement("style");
    style.id = "cssos-theater-style";
    style.textContent =
      "body.cssos-watch-theater { background:#000 !important; }" +
      "body.cssos-watch-theater #watch-panel { box-shadow:0 0 60px rgba(0,0,0,0.85); }";
    document.head.appendChild(style);
  }
}

// CSSOS_WAVE_113B1 20260511 — Jing
// Exposed helpers so app.panel-layout.js can drive system fullscreen
// when the watch panel is maximized/restored. Vision Pro Safari maps
// requestFullscreen → its native Immersive Environment automatically;
// desktop / mobile fall back to standard fullscreen with our theater
// backdrop. webkitEnterFullscreen is the iOS / older Safari path on
// the <video> element directly.
globalThis.cssosEnterWatchFullscreen = async function () {
  try {
    const videoEl = document.getElementById("watch-video");
    const frame = document.querySelector("#watch-panel .watch-frame");
    const target = videoEl || frame;
    if (!target) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    if (typeof target.requestFullscreen === "function") {
      await target.requestFullscreen();
    } else if (typeof target.webkitEnterFullscreen === "function") {
      target.webkitEnterFullscreen();
    } else if (typeof target.webkitRequestFullscreen === "function") {
      target.webkitRequestFullscreen();
    }
    document.body.classList.add("cssos-watch-theater");
    const onExit = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        document.body.classList.remove("cssos-watch-theater");
        document.removeEventListener("fullscreenchange", onExit);
        document.removeEventListener("webkitfullscreenchange", onExit);
      }
    };
    document.addEventListener("fullscreenchange", onExit);
    document.addEventListener("webkitfullscreenchange", onExit);
  } catch (err) {
    console.warn("[cssosEnterWatchFullscreen] failed:", err);
  }
};

globalThis.cssosExitWatchFullscreen = async function () {
  try {
    if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
      await document.exitFullscreen();
    } else if (document.webkitFullscreenElement && typeof document.webkitExitFullscreen === "function") {
      document.webkitExitFullscreen();
    }
  } catch (err) {
    console.warn("[cssosExitWatchFullscreen] failed:", err);
  }
  document.body.classList.remove("cssos-watch-theater");
};

/* CSSOS_WAVE_214 20260517 — Jing: "播放的时候，应该可以存在左下角的信息的，
 * 可以一边播放一遍分享嘛". A NEVER-fading bottom-left chip that shows
 * 🎵 title · cssOS so any screen capture / OBS recording always includes
 * attribution. Lives alongside `#watch-pill-row-bl` (above it) and is
 * exempt from W159b's cinema-hero auto-hide. */
function ensureWatchShareInfoChipModule() {
  let chip = document.getElementById("watch-share-info-chip");
  if (chip) return chip;
  const screen = document.querySelector("#watch-panel .watch-screen");
  if (!screen) return null;
  chip = document.createElement("div");
  chip.id = "watch-share-info-chip";
  chip.dataset.noFrameToggle = "1";
  chip.style.cssText = [
    "position:absolute", "left:12px", "bottom:60px",
    "display:flex", "align-items:center", "gap:6px",
    "max-width:60%", "min-width:0",
    "padding:4px 10px",
    "background:rgba(0,0,0,0.62)",
    "backdrop-filter:blur(10px) saturate(140%)",
    "-webkit-backdrop-filter:blur(10px) saturate(140%)",
    "border:1px solid rgba(255,255,255,0.16)",
    "border-radius:14px",
    "font:600 11.5px/1.3 -apple-system,system-ui,sans-serif",
    "color:rgba(255,255,255,0.92)",
    "letter-spacing:0.02em",
    "z-index:31",
    "pointer-events:none",   /* purely informational; click goes through */
    "user-select:none",
    "white-space:nowrap",
    "overflow:hidden",
    "text-overflow:ellipsis",
  ].join(";");
  chip.innerHTML = '<span style="font-size:13px;">🎵</span><span data-share-title style="overflow:hidden;text-overflow:ellipsis;"></span><span style="opacity:0.5;">·</span><span style="opacity:0.78;font-weight:700;letter-spacing:0.06em;">cssOS</span>';
  screen.style.position = screen.style.position || "relative";
  screen.appendChild(chip);
  const refresh = () => {
    try {
      const ps = globalThis.cssosMvPipelinePanelState
        ? globalThis.cssosMvPipelinePanelState() : null;
      const title = String(ps?.title || "").trim()
        || String(document.getElementById("watch-title-text")?.textContent || "").trim()
        || "";
      const titleEl = chip.querySelector("[data-share-title]");
      if (titleEl) titleEl.textContent = title || "(untitled)";
      chip.style.display = title ? "flex" : "none";
    } catch (_e) {}
  };
  refresh();
  // Re-render on common events that change current work.
  try {
    window.addEventListener("cssos:work-id-changed", refresh);
    window.addEventListener("cssmv:music-durations", refresh);
    document.addEventListener("cssmv:lyrics-updated", refresh);
    if (globalThis.cssosPlaylists?.onChange) globalThis.cssosPlaylists.onChange(refresh);
  } catch (_e) {}
  // Periodic refresh as fallback (cheap — runs every 3s).
  setInterval(refresh, 3000);
  return chip;
}

// CSSOS_PHASE2_PILL_ROW 20260430 #241b — Jing
// "能否和播放列表胶囊并排在右边?" Both pills share a bottom-left flex
// container so they sit on the same row regardless of label length.
function ensureBottomLeftPillRowModule() {
  let row = document.getElementById("watch-pill-row-bl");
  if (row) return row;
  const screen = document.querySelector("#watch-panel .watch-screen");
  if (!screen) return null;
  row = document.createElement("div");
  row.id = "watch-pill-row-bl";
  // CSSOS_PHASE2_NO_PAUSE_ON_CONTROL 20260501 #260 — Jing
  // "用户操作媒体框里的那些按钮，媒体可以不必暂停."
  // The frame-click toggle (in app.watch-media-layout-p2100.js) skips
  // any element with [data-no-frame-toggle]. Tag the whole pill row
  // so clicks on gaps / dividers / non-button children also skip the
  // pause-on-click handler.
  row.dataset.noFrameToggle = "1";
  row.style.cssText =
    "position:absolute;left:12px;bottom:12px;display:flex;align-items:center;" +
    "gap:8px;z-index:30;flex-wrap:wrap;";
  screen.style.position = screen.style.position || "relative";
  screen.appendChild(row);
  return row;
}

let __cssosPlaylistPillWired = false;
function ensurePlaylistModePillModule() {
  if (__cssosPlaylistPillWired) return;
  const row = ensureBottomLeftPillRowModule();
  if (!row || !globalThis.cssosPlaylists) return;
  if (document.getElementById("watch-playlist-pill")) return;
  __cssosPlaylistPillWired = true;
  // CSSOS_PHASE2_PLAYLISTS 20260430 #239b — Jing
  // "右击不应触发右键菜单." Replace the right-click binding with two
  // distinct clickable regions: the left half (mode label) cycles
  // playback modes; the right half (list name) opens the list switcher.
  // Right-click stays inert (browser context menu allowed if user wants
  // page-level context).
  const pill = document.createElement("div");
  pill.id = "watch-playlist-pill";
  pill.dataset.noFrameToggle = "1"; // gaps / separator never pause media
  pill.style.cssText =
    "display:flex;align-items:stretch;" +
    "background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);" +
    "border:1px solid rgba(255,255,255,0.18);border-radius:999px;" +
    "font-size:11px;font-weight:600;letter-spacing:.04em;" +
    "color:rgba(255,255,255,0.85);overflow:hidden;";
  const modeBtn = document.createElement("button");
  modeBtn.type = "button";
  modeBtn.style.cssText =
    "background:transparent;border:none;color:inherit;font:inherit;" +
    "padding:6px 10px;cursor:pointer;transition:background .15s ease;";
  const sep = document.createElement("div");
  sep.style.cssText = "width:1px;background:rgba(255,255,255,0.2);margin:4px 0;";
  const listBtn = document.createElement("button");
  listBtn.type = "button";
  listBtn.style.cssText =
    "background:transparent;border:none;color:inherit;font:inherit;" +
    "padding:6px 10px;cursor:pointer;transition:background .15s ease;";
  const refresh = () => {
    const mode = globalThis.cssosPlaylists.getMode();
    const list = globalThis.cssosPlaylists.getActive();
    modeBtn.textContent = globalThis.cssosPlaylists.modeLabel(mode);
    listBtn.textContent = `${list?.name || "?"} ▾`;
  };
  refresh();
  modeBtn.addEventListener("click", () => {
    globalThis.cssosPlaylists.cycleMode();
    refresh();
    if (typeof globalThis.showToast === "function") {
      globalThis.showToast(globalThis.cssosPlaylists.modeLabel());
    }
  });
  listBtn.addEventListener("click", () => {
    showPlaylistSwitcherMenuModule(pill);
  });
  globalThis.cssosPlaylists.onChange(refresh);
  pill.appendChild(modeBtn);
  pill.appendChild(sep);
  pill.appendChild(listBtn);
  row.appendChild(pill);
}

function showPlaylistSwitcherMenuModule(anchor) {
  if (!globalThis.cssosPlaylists) return;
  const old = document.getElementById("watch-playlist-menu");
  if (old) { old.remove(); return; }
  const menu = document.createElement("div");
  menu.id = "watch-playlist-menu";
  menu.dataset.noFrameToggle = "1";
  menu.style.cssText =
    "position:absolute;left:12px;bottom:48px;min-width:160px;" +
    "background:rgba(20,20,20,0.95);backdrop-filter:blur(12px);" +
    "border:1px solid rgba(255,255,255,0.18);border-radius:8px;" +
    "padding:6px 0;z-index:40;font-size:12px;color:#fff;" +
    "box-shadow:0 8px 24px rgba(0,0,0,0.4);";
  const lists = globalThis.cssosPlaylists.lists();
  const active = globalThis.cssosPlaylists.getActive()?.id;
  for (const l of lists) {
    const row = document.createElement("button");
    row.type = "button";
    row.style.cssText =
      "display:block;width:100%;text-align:left;padding:8px 14px;" +
      "background:transparent;border:none;color:inherit;font:inherit;cursor:pointer;";
    row.textContent = `${l.id === active ? "●" : "○"} ${l.name} (${l.count})`;
    row.addEventListener("click", () => {
      globalThis.cssosPlaylists.setActive(l.id);
      menu.remove();
    });
    menu.appendChild(row);
  }
  // Add custom list
  const sep = document.createElement("div");
  sep.style.cssText = "height:1px;background:rgba(255,255,255,0.18);margin:6px 0;";
  menu.appendChild(sep);
  const create = document.createElement("button");
  create.type = "button";
  create.textContent = loginCopy("＋ New custom list", "＋ 新建自定义列表");
  create.style.cssText =
    "display:block;width:100%;text-align:left;padding:8px 14px;" +
    "background:transparent;border:none;color:#00f5a0;font:inherit;cursor:pointer;";
  create.addEventListener("click", () => {
    const name = prompt(loginCopy("Custom list name:", "自定义列表名称："));
    if (name && name.trim()) {
      const id = globalThis.cssosPlaylists.createCustom(name.trim());
      globalThis.cssosPlaylists.setActive(id);
    }
    menu.remove();
  });
  menu.appendChild(create);
  const screen = document.querySelector("#watch-panel .watch-screen");
  if (screen) screen.appendChild(menu);
  // Click outside dismisses
  setTimeout(() => {
    const onDoc = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", onDoc, true);
      }
    };
    document.addEventListener("click", onDoc, true);
  }, 50);
}

// CSSOS_PHASE2_ORIENTATION_FIT 20260430 #223 — Jing
// "检测设备的横竖屏状态：横屏自动 16:9，竖屏自动 9:16."
// CSS-only orientation switch: zero render cost, works for any tier
// (the existing mp4 uses object-fit:cover to fill the new container —
// small amount of edge crop when aspect mismatches, but immediate value
// without re-rendering). For Lite tier we'll add a "Re-render in 9:16
// · free" button later (#223b) that triggers compose-only recompose.
let __cssosOrientationListenerWired = false;
// CSSOS_PHASE2_RECOMPOSE_BUTTON 20260430 #225 — Jing
// "我建议做一个变形按钮在媒体框里某个地方，方便用户即时调用."
// In-frame transform pill: top-right corner, cycles through aspects
// 16:9 → 9:16 → 1:1 → 21:9 → 16:9. CSS-only preview happens
// instantly (object-fit:cover swap); on confirm, POST /api/mv/compose
// with new W×H to render NATIVE. Lite is free; Hybrid/Cinematic show
// the upstream cost so user knows what they're paying.
const __cssosAspectCycle = [
  { id: "16x9", label: "16:9", w: 1920, h: 1080, css: "16 / 9" },
  { id: "9x16", label: "9:16", w: 1080, h: 1920, css: "9 / 16" },
  { id: "1x1",  label: "1:1",  w: 1080, h: 1080, css: "1 / 1" },
  { id: "21x9", label: "21:9", w: 2560, h: 1080, css: "21 / 9" },
];
let __cssosAspectIdx = 0;
function __cssosCurrentTier() {
  try {
    if (globalThis.cssmvTiers && typeof globalThis.cssmvTiers.currentTierId === "function") {
      return String(globalThis.cssmvTiers.currentTierId() || "lite").toLowerCase();
    }
  } catch (_e) {}
  return "lite";
}
function __cssosRecomposePriceLabel(tier) {
  if (tier === "lite") return "free";
  if (tier === "hybrid") return "$0.08";
  if (tier === "cinematic") return "$0.16";
  return "free";
}

function applyWatchFrameOrientationModule() {
  try {
    const frame = document.querySelector("#watch-panel .watch-frame");
    if (!frame) return;
    const isPortraitDevice = (() => {
      try {
        if (window.matchMedia) return window.matchMedia("(orientation: portrait)").matches;
      } catch (_e) {}
      return window.innerHeight > window.innerWidth;
    })();
    // CSSOS_PHASE2_PRESERVE_ASPECT 20260430 #235 — Jing
    // "第一次播放也是这种格式，可是第二次再去播放的时候，全部变成了16:9.
    //  请修复，不要fallback回到16:9，输出时是什么就保持什么."
    //
    // If the source video has reported its real dimensions (set by the
    // loadedmetadata handler in applyVideoSourceAspectModule), use them
    // verbatim. Otherwise fall back to the device-orientation default.
    // user-pill override beats both.
    if (!frame.dataset.userOverrodeAspect && !frame.dataset.sourceAspect) {
      __cssosAspectIdx = isPortraitDevice ? 1 : 0;
      const a = __cssosAspectCycle[__cssosAspectIdx];
      frame.style.aspectRatio = a.css;
      frame.style.maxHeight = isPortraitDevice ? "85vh" : "65vh";
      frame.dataset.orientation = isPortraitDevice ? "portrait" : "landscape";
      frame.dataset.aspect = a.id;
    }
    const videoEl = document.getElementById("watch-video");
    if (videoEl) {
      videoEl.style.objectFit = "cover";
      videoEl.style.width = "100%";
      videoEl.style.height = "100%";
    }
    refreshTransformPillModule();
  } catch (_e) { /* CSS fit best-effort */ }
}

// CSSOS_PHASE2_PRESERVE_ASPECT 20260430 #235 — Jing
// Read videoEl.videoWidth / videoHeight on loadedmetadata and apply
// the ratio to the watch frame so 32:9 / 21:9 / arbitrary aspect MVs
// keep their original shape on re-play. Cleared when user explicitly
// taps the transform pill (which sets dataset.userOverrodeAspect).
function applyVideoSourceAspectModule() {
  try {
    const frame = document.querySelector("#watch-panel .watch-frame");
    const videoEl = document.getElementById("watch-video");
    if (!frame || !videoEl) return;
    const apply = () => {
      const w = Number(videoEl.videoWidth || 0);
      const h = Number(videoEl.videoHeight || 0);
      if (w < 8 || h < 8) return;
      if (frame.dataset.userOverrodeAspect) return;
      // Tag with the source's dimensions so the orientation-change
      // listener (matchMedia) doesn't overwrite back to 16:9 on the
      // next phone-rotate / window-resize.
      frame.style.aspectRatio = `${w} / ${h}`;
      frame.dataset.sourceAspect = `${w}x${h}`;
      // Cap height differently for ultra-wide vs standard so the user
      // can actually see super-wide MVs without horizontal scrolling.
      const ratio = w / h;
      if (ratio >= 2.6) {
        // 32:9 / 21:9 — go wider, shorter.
        frame.style.maxHeight = "55vh";
        frame.dataset.orientation = "ultra-wide";
        frame.dataset.aspect = ratio >= 3.4 ? "32x9" : "21x9";
      } else if (ratio >= 1.5) {
        frame.style.maxHeight = "65vh";
        frame.dataset.orientation = "landscape";
        frame.dataset.aspect = "16x9";
      } else if (ratio >= 0.95 && ratio <= 1.05) {
        frame.style.maxHeight = "75vh";
        frame.dataset.orientation = "square";
        frame.dataset.aspect = "1x1";
      } else {
        frame.style.maxHeight = "85vh";
        frame.dataset.orientation = "portrait";
        frame.dataset.aspect = "9x16";
      }
      console.warn(
        "[watch-aspect] source dims %dx%d (ratio %s) — frame aspect-ratio set",
        w, h, ratio.toFixed(2)
      );
    };
    if (videoEl.readyState >= 1) apply();
    else videoEl.addEventListener("loadedmetadata", apply, { once: true });
  } catch (_e) {}
}
globalThis.applyVideoSourceAspectModule = applyVideoSourceAspectModule;

function refreshTransformPillModule() {
  try {
    const a = __cssosAspectCycle[__cssosAspectIdx];
    const pill = document.getElementById("watch-aspect-pill");
    if (pill) {
      const tier = __cssosCurrentTier();
      const label = pill.querySelector(".aspect-label");
      const price = pill.querySelector(".aspect-price");
      if (label) label.textContent = a.label;
      if (price) price.textContent = __cssosRecomposePriceLabel(tier);
    }
  } catch (_e) {}
}

function ensureTransformPillModule() {
  // CSSOS_PHASE2_ASPECT_IN_MENU 20260501 #263 — Jing
  // "媒体框左上角，请让用户头像独占." Aspect pill no longer renders
  // standalone — its function moved into the ⋯ overflow menu via
  // globalThis.__cssosCycleAspect (defined below). The function still
  // exposes the cycle helper for that menu entry to call.
  if (!globalThis.__cssosCycleAspect) {
    globalThis.__cssosCycleAspect = function () {
      __cssosAspectIdx = (__cssosAspectIdx + 1) % __cssosAspectCycle.length;
      const a = __cssosAspectCycle[__cssosAspectIdx];
      const frame = document.querySelector("#watch-panel .watch-frame");
      if (frame) {
        frame.style.aspectRatio = a.css;
        frame.dataset.aspect = a.id;
        frame.dataset.userOverrodeAspect = "1";
      }
      if (typeof globalThis.showToast === "function") {
        const tier = __cssosCurrentTier();
        const price = __cssosRecomposePriceLabel(tier);
        globalThis.showToast(`${a.label} · ${price}`);
      }
    };
  }
  return; // skip standalone pill creation entirely
  /* eslint-disable no-unreachable */
  const screen = document.querySelector("#watch-panel .watch-screen");
  if (!screen) return;
  if (document.getElementById("watch-aspect-pill")) return;
  const pill = document.createElement("button");
  pill.id = "watch-aspect-pill";
  pill.type = "button";
  pill.title = "Transform aspect — click to cycle, double-click to render natively";
  pill.style.cssText =
    "position:absolute;top:12px;left:12px;display:flex;align-items:center;gap:6px;" +
    "background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);" +
    "border:1px solid rgba(255,255,255,0.18);border-radius:999px;" +
    "padding:6px 12px;z-index:30;font-size:12px;font-weight:600;letter-spacing:.04em;" +
    "color:#fff;cursor:pointer;transition:all .15s ease;";
  pill.innerHTML =
    '<span style="font-size:14px;line-height:1;">🔄</span>' +
    '<span class="aspect-label" style="color:#fff">16:9</span>' +
    '<span class="aspect-price" style="color:#9be7c7;font-size:10px;letter-spacing:.06em">free</span>';
  pill.addEventListener("click", (ev) => {
    ev.stopPropagation();
    __cssosAspectIdx = (__cssosAspectIdx + 1) % __cssosAspectCycle.length;
    const a = __cssosAspectCycle[__cssosAspectIdx];
    const frame = document.querySelector("#watch-panel .watch-frame");
    if (frame) {
      frame.style.aspectRatio = a.css;
      frame.dataset.aspect = a.id;
      frame.dataset.userOverrodeAspect = "1"; // sticky until reset
    }
    refreshTransformPillModule();
    if (typeof globalThis.showToast === "function") {
      const tier = __cssosCurrentTier();
      const price = __cssosRecomposePriceLabel(tier);
      globalThis.showToast(
        `Preview at ${a.label} (CSS crop). Double-click pill to render natively · ${price}.`
      );
    }
  });
  pill.addEventListener("dblclick", async (ev) => {
    ev.stopPropagation();
    await triggerNativeRecomposeModule();
  });
  screen.style.position = screen.style.position || "relative";
  screen.appendChild(pill);
  refreshTransformPillModule();
}

async function triggerNativeRecomposeModule() {
  const a = __cssosAspectCycle[__cssosAspectIdx];
  const tier = __cssosCurrentTier();
  const price = __cssosRecomposePriceLabel(tier);
  if (!confirm(`Re-render this MV natively at ${a.label} (${a.w}×${a.h}) · ${price}?\n\n` +
               (tier === "lite"
                 ? "Lite is free — only ffmpeg slideshow re-runs."
                 : "Hybrid/Cinematic re-renders the AI video segment, billed at the displayed cost."))) {
    return;
  }
  try {
    const ps = globalThis.cssosMvPipelinePanelState
      ? globalThis.cssosMvPipelinePanelState()
      : null;
    if (!ps || !ps.coverUrl || !ps.audioUrl) {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast("Need cover + audio in state to re-render. Open the work first.");
      }
      return;
    }
    const totalSecs = Number(ps.duration || 200);
    const planFn = globalThis.cssmvPlanComposeSegments;
    const plan = typeof planFn === "function"
      ? planFn({
          tierId: tier,
          coverUrl: ps.coverUrl,
          durationSecs: totalSecs,
          aiVideoUrl: ps.videoUrl || null,
          aiVideoDurSecs: ps.videoDurSecs || 0,
        })
      : null;
    if (!plan || !plan.segments) {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast("Could not plan slideshow — no compose helper available.");
      }
      return;
    }
    if (typeof globalThis.showToast === "function") {
      globalThis.showToast(`Re-rendering at ${a.label} · this takes ~30-60s for Lite.`);
    }
    const newMvId = "mv_" + Date.now() + "_recompose";
    const composeBody = {
      mv_id: newMvId,
      audio_url: ps.audioUrl,
      segments: plan.segments,
      width: a.w,
      height: a.h,
      fps: 25,
    };
    const res = await fetch("/api/mv/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(composeBody),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) {
      throw new Error(payload?.error || `compose_failed:${res.status}`);
    }
    const newUrl = payload?.public_url || payload?.final_path || "";
    if (newUrl) {
      const videoEl = document.getElementById("watch-video");
      if (videoEl) {
        videoEl.src = newUrl;
        videoEl.load && videoEl.load();
        videoEl.play && videoEl.play().catch(() => {});
      }
      ps.mvUrl = newUrl;
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(`Native ${a.label} render ready — playing the freshly recomposed MV.`);
      }
    }
  } catch (err) {
    if (typeof globalThis.showToast === "function") {
      globalThis.showToast(`Recompose failed: ${err.message || err}`);
    }
  }
}
function wireWatchOrientationOnceModule() {
  if (__cssosOrientationListenerWired) return;
  __cssosOrientationListenerWired = true;
  applyWatchFrameOrientationModule();
  try {
    const mq = window.matchMedia("(orientation: portrait)");
    if (mq.addEventListener) {
      mq.addEventListener("change", applyWatchFrameOrientationModule);
    } else if (mq.addListener) {
      // Safari < 14 fallback.
      mq.addListener(applyWatchFrameOrientationModule);
    }
  } catch (_e) {}
  // Belt-and-suspenders: also re-apply on resize (covers desktops where
  // the user drags the panel from wide to narrow).
  window.addEventListener("resize", applyWatchFrameOrientationModule, { passive: true });
}

function openWatchPanelShellModule(restoredLayout = false) {
  if (!watchPanel) return;
  watchPanel.classList.remove("hidden");
  watchPanel.dataset.minimized = "false";
  prepareWatchPanelForOpen(restoredLayout);
  wireWatchSwipeOnceModule();
  wireWatchOrientationOnceModule();
  ensureTransformPillModule();
  // CSSOS_PHASE2_AUTO_CINEMA 20260504 — Jing
  // "无论从哪个入口进入MV面板，都默认是全屏…影院模式".
  // CSSOS_PHASE2_CINEMA_NO_MUTE 20260504 — Jing follow-up:
  // "打开所有作品都默认被静音了". The fullscreen transition was
  // racing with autoplay — on Safari + some Chromium builds the
  // requestFullscreen mid-play caused the browser to drop the audio
  // track silently. Fix: don't fire cinema on open. Instead, listen
  // for the FIRST `playing` event on the video and trigger cinema
  // mode AFTER playback is visibly established. By then the audio
  // track is locked in and fullscreen can no longer mute it. If
  // playback never establishes (saved-session restore, no media yet),
  // cinema simply doesn't auto-fire and the user can hit ⛶ manually.
  // CSSOS_PHASE2_CINEMA_LAYOUT_FIRST 20260505 — Jing
  // "MV面板/媒体框在载入/启动时，就应该以最大化状态启动".
  // Two-phase cinema:
  //   PHASE 1 (sync, NOW)  — apply the .is-cssmv-fullscreen layout
  //     class + body cinema class. This is pure CSS — fills the
  //     viewport immediately, no audio-track involvement, no risk
  //     of muting.
  //   PHASE 2 (deferred)   — call requestFullscreen() to escape
  //     browser chrome. This MUST wait for the first `playing`
  //     event because the fullscreen reflow on Safari/some Chromium
  //     racing with autoplay can drop the audio track. By then the
  //     audio decoder is locked in and the API call is safe.
  try {
    if (typeof globalThis.cssosEnterCinemaLayout === "function") {
      globalThis.cssosEnterCinemaLayout();
    }
    /* CSSOS_PHASE2_AUTO_CINEMA_SYNC 20260505 — Jing
     * "需要改进：进入MV面板默认真全屏影院模式，即用户不必再一次点击
     *  媒体框右下角的全屏按钮."
     * Two-track approach:
     *   1. Try requestFullscreen() SYNCHRONOUSLY in this same tick. If
     *      this function was reached from a user click handler (logo /
     *      mic / play / right-click / Apply&Render), the user-activation
     *      flag is still hot and the request lands. Browser chrome
     *      escapes immediately — no second click needed.
     *   2. If sync attempt fails (no activation, or rejected), fall
     *      back to the legacy on-`playing` deferred path so a panel
     *      restored from saved-session also lands in cinema once media
     *      starts.
     * Audio-mute risk on the sync path is handled inside
     * cssosRequestBrowserFullscreen itself: it snapshots video/audio
     * mute+volume before requestFullscreen and restores at 50ms+400ms. */
    if (typeof globalThis.cssosRequestBrowserFullscreen === "function") {
      // Fire-and-forget — the helper returns a Promise but we don't await
      // because awaiting would suspend this tick and lose the user gesture
      // window for any code that runs after us.
      try { globalThis.cssosRequestBrowserFullscreen(); } catch (_e) {}
    }
    const v = document.getElementById("watch-video");
    if (v && !v.__cssosCinemaWaiter) {
      v.__cssosCinemaWaiter = true;
      const onPlaying = () => {
        v.removeEventListener("playing", onPlaying);
        // Only fire deferred fallback if we're STILL not in browser
        // fullscreen (i.e. the sync attempt above didn't take).
        if (document.fullscreenElement) return;
        setTimeout(() => {
          try {
            if (!document.fullscreenElement && typeof globalThis.cssosRequestBrowserFullscreen === "function") {
              globalThis.cssosRequestBrowserFullscreen();
            }
          } catch (_e) {}
        }, 250);
      };
      v.addEventListener("playing", onPlaying);
    }
  } catch (_e) {}
  // CSSOS_PHASE2_UNIFIED_WATCH_ENTRY 20260430 #211 — Jing
  // "所有进入Watch MV面板的万能入口都没有走MV PIPELINE流程，
  //  不然MV PIPELINE面板里会显示进度。"
  // Every Watch entry point must also surface the MV PIPELINE panel so
  // (a) progress for in-flight runs is visible alongside playback and
  // (b) historical MVs show which engines/cost they used in the matrix
  //     view. We open the panel non-modally — Watch keeps focus.
  try {
    const pipelinePanel = document.getElementById("mv-pipeline-panel");
    if (pipelinePanel && pipelinePanel.classList.contains("hidden")) {
      pipelinePanel.classList.remove("hidden");
      pipelinePanel.dataset.minimized = "false";
      // Don't focus it (Watch is foreground), but ensure it's positioned
      // and visible so the user can glance at progress.
      if (typeof globalThis.bringPanelOnscreen === "function") {
        try { globalThis.bringPanelOnscreen(pipelinePanel); } catch (_e) {}
      }
    }
  } catch (_e) {
    // Panel may not be mounted (page in early boot); the Watch open
    // path is the priority — don't let pipeline-panel surfacing fail it.
  }
}

function openWatchPreviewShellModule({ fallbackTab = "mv", restoreAudio = false, center = false } = {}) {
  openPanel(watchPanel);
  /* W333 — every openWatchPreviewShellModule entry path (search result,
   * For You card, Works Center, share-link, queue advance…) must also
   * fire the cinema layout + pre-paint so the panel arrives fullscreen
   * with title+cover already showing, no black "cemetery" at top. */
  try {
    if (typeof globalThis.cssosEnterCinemaLayout === "function") {
      globalThis.cssosEnterCinemaLayout();
    }
  } catch (_e) {}
  prePaintLatestWorkOnPanelOpenModule();
  initWatchImmersiveScrollModule();
  ensureWatchProgressRotatorModule();
  activateWatchTab(resolvePreferredWatchOpenTab(fallbackTab));
  setWatchDetailsRevealModule(false);
  requestAnimationFrame(() => {
    scrollWatchBodyToActiveMediaFrameModule();
    requestAnimationFrame(() => scrollWatchBodyToActiveMediaFrameModule());
  });
  if (restoreAudio) {
    restoreRememberedWatchFinalAudio({ preservePlayback: true });
  }
  if (center) {
    ensureWatchCentered();
  }
  ensureWatchAutoChainOnOpenModule();
}

function pauseWatchPanelPlayback() {
  const videoWasPlaying = !!(
    watchVideo &&
    !watchVideo.paused &&
    !watchVideo.ended &&
    String(watchVideo.currentSrc || watchVideo.src || "").trim()
  );
  const audioWasPlaying = !!(
    watchAudioPreview &&
    !watchAudioPreview.paused &&
    !watchAudioPreview.ended &&
    String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim()
  );
  if (watchPanel) {
    watchPanel.dataset.resumeVideoPlayback = videoWasPlaying ? "true" : "false";
    watchPanel.dataset.resumeAudioPlayback = audioWasPlaying ? "true" : "false";
  }
  watchVideo?.pause?.();
  watchAudioPreview?.pause?.();
}

function resumeWatchPanelPlayback() {
  const resumeVideo = watchPanel?.dataset?.resumeVideoPlayback === "true";
  const resumeAudio = watchPanel?.dataset?.resumeAudioPlayback === "true";
  if (resumeAudio && watchAudioPreview && String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim()) {
    watchAudioPreview.play?.().catch(() => {});
  }
  if (resumeVideo && watchVideo && String(watchVideo.currentSrc || watchVideo.src || "").trim()) {
    watchVideo.play?.().catch(() => {});
  }
}

function stopWatchPanelPlaybackModule() {
  if (watchPanel) {
    watchPanel.dataset.resumeVideoPlayback = "false";
    watchPanel.dataset.resumeAudioPlayback = "false";
  }
  globalThis.currentStructuredWatchQueue = null;
  watchVideo?.pause?.();
  try {
    if (watchVideo) watchVideo.currentTime = 0;
  } catch (_err) {}
  if (watchVideo) {
    watchVideo.removeAttribute("src");
    watchVideo.load?.();
  }
  watchAudioPreview?.pause?.();
  try {
    if (watchAudioPreview) watchAudioPreview.currentTime = 0;
  } catch (_err) {}
  if (watchAudioPreview) {
    watchAudioPreview.removeAttribute("src");
    watchAudioPreview.load?.();
    watchAudioPreview.style.display = "none";
  }
  clearWatchFrameLoopModule();
  structuredWatchQueueAdvancePending = false;
  dismissBlockingWatchOverlay();
  stopWatchBackgroundWorkModule();
}

function stopWatchBackgroundWorkModule() {
  stopPipelineProgressPollingModule?.();
  stopPendingFinalAudioPollingModule?.();
  stopRecentRunRecovery?.();
  watchVideoPreviewRequestPending = false;
  lastWatchVideoPreviewRequestKey = "";
  if (videoJobPoll) {
    clearInterval(videoJobPoll);
    videoJobPoll = null;
  }
  videoJobId = null;
  clearWatchPlaybackRetryModule();
}

function minimizeWatchPanelShellModule() {
  setWatchCenterStage(false);
  pauseWatchPanelPlayback();
  stopWatchBackgroundWorkModule();
}

function syncWatchPanelCollapseShellModule(isExpanded) {
  if (isExpanded) {
    resumeWatchPanelPlayback();
    return;
  }
  pauseWatchPanelPlayback();
  stopWatchBackgroundWorkModule();
}

function syncVisibleWatchPanelAfterPreviewReady() {
  if (watchPanel && !watchPanel.classList.contains("hidden")) {
    ensureWatchCentered();
  }
}

function handleWatchUserPlaybackGesture() {
  armWatchExplicitPreviewIntent();
  if (
    watchAudioPreview &&
    (!String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim() ||
      String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim().startsWith("data:audio/")) &&
    getRememberedWatchFinalAudio()
  ) {
    restoreRememberedWatchFinalAudio({ preservePlayback: true });
  }
  const hasAudio = !!(watchAudioPreview?.src && String(watchAudioPreview.src).trim());
  if (hasAudio) {
    playWatchAudioPreviewFromStartModule({ preserveCurrentTime: true });
  }
  if (!watchVideo?.src) return hasAudio;
  revealWatchVideoLayerModule();
  if (globalThis.currentPreviewVideoSourceKind === "frame-motion") {
    watchVideo.muted = true;
    playWatchAudioPreviewFromStartModule();
  } else {
    watchVideo.muted = false;
  }
  const playPromise = watchVideo.play?.();
  if (!playPromise || typeof playPromise.then !== "function") return true;
  playPromise
    .then(() => {
      globalThis.watchManualPlayHinted = false;
      if (
        watchSubtitle?.textContent?.includes("Tap to play") ||
        watchSubtitle?.textContent?.includes("轻触即可播放")
      ) {
        safeSetWatchSubtitleModule(watchSubtitleLabelModule("preview"));
      }
    })
    .catch(() => {
      promptManualWatchPlaybackModule(watchToastCopyModule("autoplayBlocked"));
    });
  return true;
}

// CSSOS_WAVE_280 20260521 — Jing: 静音自动播时, 显示一个不挡画面的小提示
// "🔇 轻触开声音", 几秒后自动淡出; 用户解锁声音 / 暂停时立即消失.
// pointer-events:none 确保它永不拦截点击(点它下面的媒体区照样解锁声音).
let __watchSoundHintTimer = null;
function showWatchSoundHintModule() {
  try {
    if (!globalThis.__cssosWatchPendingUnmute) return; // 已解锁就不提示
    var host = document.querySelector("#watch-panel .watch-screen");
    if (!host) return;
    var hint = document.getElementById("watch-sound-hint");
    if (!hint) {
      hint = document.createElement("div");
      hint.id = "watch-sound-hint";
      hint.style.cssText =
        "position:absolute;left:50%;bottom:64px;transform:translateX(-50%);" +
        "padding:6px 14px;border-radius:999px;background:rgba(0,0,0,0.5);" +
        "backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;" +
        "font:600 12px/1 -apple-system,system-ui,sans-serif;letter-spacing:.02em;" +
        "white-space:nowrap;pointer-events:none;z-index:40;opacity:0;" +
        "transition:opacity .4s ease;box-shadow:0 4px 16px rgba(0,0,0,0.4);";
      host.appendChild(hint);
    }
    hint.textContent = loginCopy("🔇 Tap for sound", "🔇 轻触开声音");
    hint.style.display = "block";
    requestAnimationFrame(function () { hint.style.opacity = "1"; });
    clearTimeout(__watchSoundHintTimer);
    __watchSoundHintTimer = setTimeout(function () {
      hint.style.opacity = "0";
      setTimeout(function () { if (hint) hint.style.display = "none"; }, 450);
    }, 4000); // 4s 后淡出 (解锁仍可随时轻触)
  } catch (_e) {}
}
function hideWatchSoundHintModule() {
  try {
    clearTimeout(__watchSoundHintTimer);
    var hint = document.getElementById("watch-sound-hint");
    if (hint) { hint.style.opacity = "0"; setTimeout(function () { if (hint) hint.style.display = "none"; }, 450); }
  } catch (_e) {}
}

async function handleWatchPlaybackSurfaceClick(ev) {
  // CSSOS_WAVE_275 20260521 — Jing: MV 面板里"除了用户主动暂停, 所有操作都不该
  // 暂停播放, 一边操作一边播". 此处理器绑在整个 .watch-screen 上, 之前不看
  // event.target → 点媒体区内的任何控件(头像/⋯/✦/take/aspect/沉浸胶囊/菜单/
  // tab/字体选择器…)都冒泡进来 toggle 暂停 = "一操作就停". 修正: 只有点
  // 【媒体空白区】或【▶/⏸ 播放按钮本身】才切换暂停; 点其它控件直接放行不暂停.
  try {
    const t = ev && ev.target;
    if (t && typeof t.closest === "function" && !t.closest(".watch-overlay-play")) {
      if (t.closest(
        "button, a, input, textarea, select, [role=button], [data-watch-tab], " +
        ".watch-author-avatar, #watch-author-avatar, #watch-actions-pill, " +
        "#watch-immersive-pill, #watch-style-shift, #watch-pill-row-bl, " +
        "#watch-take-toggle, #watch-aspect-pill, .watch-media-action, " +
        ".cssos-author-menu, .cssos-gift-modal, .watch-font-picker, " +
        ".watch-commerce-actions, .watch-share-info"
      )) {
        return; // 点的是控件 → 照常操作, 不打断播放
      }
    }
  } catch (_e) { /* fail-open: 任何异常都按原逻辑走 */ }
  // CSSOS_WAVE_302 20260521 — Jing: "除了用户暂停, 所有操作不打断播放". .watch-screen
  // 上绑了两个点击处理器(本函数 + media-layout 的 frame-toggle), 裸面板的一次轻触
  // 会被双触发 → 暂停后立刻又恢复, "暂停"形同失效. 用一个 ~350ms 的共享单次切换锁:
  // 同一次轻触只允许其中一个处理器执行播放/暂停切换. 仅对真实点击事件生效(程序化
  // 调用 ev 为空时不加锁, 不影响切歌/自动播).
  try {
    if (ev && ev.target) {
      const __now = Date.now();
      if (__now < (globalThis.__cssosWatchToggleLockUntil || 0)) return;
      globalThis.__cssosWatchToggleLockUntil = __now + 350;
    }
  } catch (_e) { /* no-op */ }
  if (!authState?.user && typeof openLoginForCreation === "function") {
    openLoginForCreation(
      loginCopy(
        "Sign in first to start the one-tap MV flow."
      )
    );
    return;
  }
  armWatchExplicitPreviewIntent();
  // CSSOS_WAVE_279 20260521 — Jing: 进场视频已【静音自动播】(视觉先放). 用户
  // 这第一次轻触是来【解锁声音】的, 不该被当成"暂停". 取消视频静音 + 起播
  // 歌曲音频(若有独立音轨), 清掉 pending 标志后直接返回; 之后的轻触才是
  // 正常的播放/暂停切换.
  if (globalThis.__cssosWatchPendingUnmute && watchVideo && !watchVideo.paused) {
    globalThis.__cssosWatchPendingUnmute = false;
    globalThis.__cssosWatchAudioUnlocked = true; // 本会话已授权声音, 后续切歌带声自动播
    hideWatchSoundHintModule(); // CSSOS_WAVE_280 解锁了, 收起提示
    try { watchVideo.muted = false; } catch (_e) {}
    try {
      if (watchAudioPreview && String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim()) {
        watchAudioPreview.muted = false;
        // 与视频对齐进度后起播, 避免声画不同步.
        try { watchAudioPreview.currentTime = watchVideo.currentTime || 0; } catch (_e2) {}
        watchAudioPreview.play?.().catch(() => {});
      }
    } catch (_e) {}
    pulseWatchOverlayFeedbackModule("play");
    syncWatchMusicStateModule();
    return;
  }
  const videoPlaying = !!(
    watchVideo &&
    !watchVideo.paused &&
    !watchVideo.ended &&
    String(watchVideo.currentSrc || watchVideo.src || "").trim()
  );
  const audioPlaying = !!(
    watchAudioPreview &&
    !watchAudioPreview.paused &&
    !watchAudioPreview.ended &&
    String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim()
  );
  if (videoPlaying || audioPlaying) {
    pulseWatchOverlayFeedbackModule("pause");
    void playWatchOverlayFeedbackToneModule("pause");
    watchVideo?.pause?.();
    watchAudioPreview?.pause?.();
    syncWatchMusicStateModule();
    return;
  }
  const activeStage = getActiveWatchProgressCardModule()?.key || "";
  const stalled = watchScreen?.classList.contains("is-stalled");
  const nextNeededStage = getNextWatchGenerationGapModule();
  if (activeStage || stalled) {
    const stageToContinue =
      resolveWatchRecoveryStageModule(activeStage || nextNeededStage || "lyrics") ||
      watchProgressStageKey ||
      nextNeededStage ||
      "lyrics";
    pulseWatchOverlayFeedbackModule("generate");
    void playWatchOverlayFeedbackToneModule("generate");
    await continueWatchGenerationStageModule(stageToContinue);
    return;
  }
  const effectiveStage =
    activeStage === "lyrics" && nextNeededStage !== "lyrics"
      ? nextNeededStage
      : activeStage || nextNeededStage || "lyrics";
  const requiresGeneration = effectiveStage !== "play" || stalled;
  pulseWatchOverlayFeedbackModule(requiresGeneration ? "generate" : "resume");
  void playWatchOverlayFeedbackToneModule(requiresGeneration ? "generate" : "resume");
  if (effectiveStage && effectiveStage !== "play") {
    await continueWatchGenerationStageModule(effectiveStage);
    return;
  }
  if (hasCurrentRunInFlightModule()) {
    await attemptImmediateFinalAudioAttach();
  }
  const opened = await openCurrentGeneratedWatchPlaybackModule({
    autoplay: true,
    preferVideo: true,
  });
  if (!opened) {
    await continueWatchGenerationStageModule(getNextWatchGenerationGapModule() || "lyrics");
    return;
  }
  handleWatchUserPlaybackGesture();
  if (globalThis.watchManualPlayHinted) {
    showToast(watchToastCopyModule("playbackResumed"));
  }
}

async function invokeUniversalCreationEntryModule(options = {}) {
  // CSSOS_PHASE2_DIAGNOSTIC 20260504 — Jing
  // Explicit entry log so the user can verify (in DevTools Console) that
  // their tap actually reached this universal-entry function. Mirrors the
  // [entry:dock-mic] / [entry:dock-watch] format that cssmvUnifiedEntry
  // emits, but for the legacy `invokeUniversalCreationEntry` path that
  // boot.js still uses for logo / listen / watch buttons.
  console.info(
    "%c[entry:universal] click origin=%s preferredTab=%s submitVoiceFallback=%s",
    "color:#08f;font-weight:bold",
    String(options?.origin || ""),
    String(options?.preferredTab || ""),
    String(options?.submitVoiceFallback === true)
  );
  if (!authState?.user && typeof openLoginForCreation === "function") {
    openLoginForCreation(
      loginCopy(
        "Sign in first to start the one-tap MV flow."
      )
    );
    return false;
  }
  const origin = String(options?.origin || "logo").trim() || "logo";
  const preferredTab = String(options?.preferredTab || "mv").trim() || "mv";
  const submitVoiceFallback = options?.submitVoiceFallback === true;
  // CSSOS_PHASE2_UNIVERSAL_ENTRY 20260418 / 20260504 — Jing
  // Jing's principle: every universal entry must exercise the full 6-stage
  // pipeline (cover/lyrics/music/video/subtitles/MV). Callers can opt-out via
  // `options.skipMvPipeline === true` for cases where they only want the
  // watch UI flow (e.g. legacy song-seed rehearsal). By default we trigger
  // the 6-stage panel in parallel with the watch playback flow so the user
  // always sees a complete MV rendered end-to-end.
  //
  // 2026-05-04 fix: previously we additionally gated on `preferredTab === "mv"`
  // which silently dropped the pipeline for the listen-button (preferredTab
  // "music") and any other entry that opens the music tab first. The user's
  // expectation is that the pipeline always runs — the chosen tab is just
  // which surface to focus on; both tabs share the same MV result.
  const triggerMvPipeline = options?.skipMvPipeline !== true;
  // `options.seed` lets callers pre-fill the pipeline (e.g. advanced settings
  // "apply render" button with a user-authored config). Missing fields get
  // randomised by `openMvPipelinePanel`/`runAll` from the local seed bank.
  const callerSeed = options?.seed && typeof options.seed === "object" ? options.seed : null;
  showCreationSurfaceModule(origin);
  globalThis.activateWatchTab?.(preferredTab);
  armWatchExplicitPreviewIntent();
  if (submitVoiceFallback) {
    // CSSOS_PHASE2_UNIVERSAL_ENTRY_VOICE 20260504 — Jing
    // Two functions named `submitVoiceOrFallbackTitle*` coexist:
    //   • app.voice-seed.js : LEGACY song-seed path (cover-only, fallback
    //     to the brown-stick-figure scary scene). Registers as
    //     `submitVoiceOrFallbackTitle` and wins because it loads first.
    //   • app.voice-submit.js : NEW MV-Pipeline-aware
    //     `submitVoiceOrFallbackTitleModule`. Same job, but routes through
    //     openMvPipelinePanel({autoStart:true}) so the 6-stage pipeline
    //     actually runs.
    // Previously this block called the LEGACY one. The legacy path set the
    // `creationBusy` lock, so when invokeUniversalCreationEntry then
    // reached `openMvPipelinePanel` the runAll() was blocked by the busy
    // guard and the user saw the old brown-stick-figure result instead of
    // the MV pipeline. Prefer the *Module* version when it exists.
    const hasModule = typeof globalThis.submitVoiceOrFallbackTitleModule === "function";
    const hasLegacy = typeof globalThis.submitVoiceOrFallbackTitle === "function";
    console.info(
      "%c[entry:universal] voice-fallback branch — module=%s legacy=%s",
      "color:#08f", hasModule, hasLegacy
    );
    const submit =
      (hasModule && globalThis.submitVoiceOrFallbackTitleModule(null)) ||
      (hasLegacy && globalThis.submitVoiceOrFallbackTitle(null)) ||
      globalThis.runBootUiMethod?.("SubmitVoiceOrFallbackTitle", "submitVoiceOrFallbackTitle", null);
    if (submit && typeof submit.then === "function") {
      await submit.catch(() => null);
    }
  }
  // Fire-and-forget the 6-stage panel. This runs in parallel with the watch
  // playback flow so one universal entry tap lights up the full pipeline.
  // `autoStart: true` means runAll() kicks off immediately after the panel
  // mounts; if the user's inputs are empty, runAll() synthesises a seed from
  // the local zero-input bank (缺啥补啥 + 零输入必须随机).
  if (triggerMvPipeline && typeof globalThis.openMvPipelinePanel === "function") {
    try {
      // Prefer any title/lyrics we already have from the song-seed state or
      // the caller's explicit seed. An empty seed is fine — runAll handles it.
      const mergedSeed = Object.assign(
        {},
        callerSeed || {},
        {
          prompt:
            (callerSeed && callerSeed.prompt) ||
            String(state?.title || "").trim() ||
            String(state?.songSeed?.title || "").trim() ||
            undefined,
          style:
            (callerSeed && callerSeed.style) ||
            String(state?.songSeed?.musicStyle || "").trim() ||
            undefined,
          lyrics:
            (callerSeed && callerSeed.lyrics) ||
            undefined
        }
      );
      globalThis.openMvPipelinePanel({
        autoStart: options?.autoStartMvPipeline !== false,
        seed: mergedSeed,
        // Don't steal focus from the watch panel — it's the primary surface.
        focus: options?.focusMvPipeline === true,
        // Run the 6-stage pipeline in the background; the panel itself only
        // pops open when the user explicitly clicks the dock item.
        hidden: options?.showMvPipeline !== true
      });
    } catch (mvErr) {
      // Non-fatal: if the 6-stage panel fails to mount, the watch flow still
      // runs so the user is never left with nothing.
      console.warn("[universal-entry] openMvPipelinePanel failed", mvErr);
    }
  }
  if (typeof handleWatchPlaybackSurfaceClick === "function") {
    return handleWatchPlaybackSurfaceClick();
  }
  return false;
}

async function continueWatchGenerationStageModule(stageKey = "lyrics") {
  const requestedStageKey = String(stageKey || "").trim() || getNextWatchGenerationGapModule() || "lyrics";
  const normalizedStageKey = resolveWatchRecoveryStageModule(requestedStageKey);
  const inFlightRunId = getCurrentInFlightWatchRunIdModule();
  if (normalizedStageKey !== "lyrics" && inFlightRunId) {
    globalThis.startPipelineProgressPollingModule?.(inFlightRunId);
    globalThis.startPendingFinalAudioPollingModule?.(inFlightRunId);
    return true;
  }
  const gate = canAdvanceWatchGenerationStageModule(normalizedStageKey);
  if (!gate.ok) {
    const fallbackStage = resolveWatchRecoveryStageModule("lyrics");
    if (fallbackStage && fallbackStage !== requestedStageKey) {
      return continueWatchGenerationStageModule(fallbackStage);
    }
  }
  const hasCurrentLyrics =
    isWatchLyricsReadyModule() ||
    compactLyricLines(Array.isArray(state.lines) ? state.lines : []).filter(Boolean).length > 1 ||
    (globalThis.hasCanonicalLyricsBodyLinesModule?.(
      String(state.songSeed?.title || state.title || "").trim(),
      watchLyricsEditor?.value || "",
      2
    ) ?? false) ||
    (globalThis.hasCanonicalLyricsBodyLinesModule?.(
      String(state.songSeed?.title || state.title || "").trim(),
      state.songSeed?.lyrics || "",
      2
    ) ?? false);
  if (normalizedStageKey === "lyrics") {
    return regenerateLyricsForWatchModule();
  }
  if (!hasCurrentLyrics) {
    return regenerateLyricsForWatchModule();
  }
  return restartWatchGenerationFromCurrentLyricsModule(normalizedStageKey);
}

async function regenerateLyricsForWatchModule() {
  if (globalThis.lyricsSeedRequestState?.pending) return false;
  stopPipelineProgressPolling();
  stopPendingFinalAudioPolling?.();
  currentWatchAudioRunId = "";
  currentWatchAudioRunError = "";
  resetTypingState();
  resetEngineStates();
  try {
    let seed = null;
    let resolvedTitle = "";
    let lines = [];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      seed =
        (await globalThis.requestLyricsSeedWithRetryModule?.("music_video", { apply: true, attempts: 1 })) ||
        (await runLyricsGenerate("music_video", { apply: true }));
      if (!seed?.ok || seed?.empty || !seed?.data?.lyrics) {
        continue;
      }
      const title = String(
        seed?.data?.title ||
        globalThis.extractTitleFromVideoOutlineModule?.(seed?.data?.video_outline || seed?.data?.script || state.songSeed?.video_outline || "") ||
        state.title ||
        loginCopy("CSS MV")
      ).trim();
      resolvedTitle = title || loginCopy("CSS MV");
      const canonicalLyrics =
        globalThis.buildCanonicalLyricsWithTitleModule?.(resolvedTitle, String(seed.data.lyrics || "")) ||
        String(seed.data.lyrics || "");
      lines = extractDisplayLyricLines(String(canonicalLyrics || "")).filter(Boolean);
      if (lines.length >= 2) {
        break;
      }
      seed = null;
      resolvedTitle = "";
      lines = [];
      showToast(t("watch.toast.lyricsInvalid"));
    }
    if (!seed || !resolvedTitle || lines.length < 2) {
      showToast(t("watch.toast.lyricsNotReady"));
      return false;
    }
    state.title = resolvedTitle;
    state.baseLines = lines.slice();
    state.lines = lines.slice();
    try { globalThis.cssmvRenderMvArtTitle?.(resolvedTitle); } catch (_err) {}
    const lyricText = buildLyricsText(resolvedTitle, lines);
    lyricsTargetLength = lyricText.length;
    typingState.completed = lyricText.length > 0;
    typingState.paused = false;
    typingState.canceled = false;
    if (lyricsEl) {
      lyricsEl.textContent = lyricText;
      lyricsEl.classList.remove("paused", "canceled");
    }
  if (watchLyricsEditor) {
    watchLyricsEditor.value = buildSpacedLyricsTextModule(resolvedTitle, lines);
  }
    setEngineState("lyrics", "done");
    setEngineDetail("lyrics", "stage: done");
    globalThis.pinLyricsProgressVisibilityModule?.(3600);
    if (lyricsProgress) setProgress(lyricsProgress, 100);
    setEngineProgressVisible("lyrics", false, { delayMs: 3600 });
    updateEnginePanels(resolvedTitle, lines);
    void globalThis.requestForyouThumbnail?.(
      resolvedTitle,
      String(state.songSeed?.musicStyle || state.songSeed?.creativeSummary?.compact || "").trim(),
      lines
    );
    try {
      await runPipeline(getMicJobId(), resolvedTitle, lyricText);
    } catch (_pipelineErr) {
      showToast(t("watch.toast.lyricsReadyMusicRecovering"));
    }
    return true;
  } catch (_err) {
    showToast(t("watch.toast.regenerateLyricsFailed"));
    return false;
  }
}

async function restartWatchGenerationFromCurrentLyricsModule(stageKey = "music") {
  const title = String(
    state.title ||
    globalThis.extractTitleFromVideoOutlineModule?.(state.songSeed?.video_outline || state.songSeed?.script || "") ||
    loginCopy("CSS MV")
  ).trim();
  const lines = compactLyricLines(
    Array.isArray(state.lines) && state.lines.length ? state.lines : String(lyricsEl?.textContent || "").split("\n")
  ).filter(Boolean);
  if (!title || !lines.length || typeof runPipeline !== "function") {
    showToast(t("watch.toast.lyricsNotPrepared"));
    return false;
  }
  if (!(globalThis.hasCompleteSongSeedSnapshotModule?.(state.songSeed) ?? false)) {
    return regenerateLyricsForWatchModule();
  }
  const inFlightRunId = getCurrentInFlightWatchRunIdModule();
  if (inFlightRunId) {
    globalThis.startPipelineProgressPollingModule?.(inFlightRunId);
    globalThis.startPendingFinalAudioPollingModule?.(inFlightRunId);
    return true;
  }
  const lyricText = buildLyricsText(title, lines);
  stopPipelineProgressPolling();
  stopPendingFinalAudioPolling?.();
  currentWatchAudioRunId = "";
  currentWatchAudioRunError = "";
  setEngineState("lyrics", "done");
  setEngineDetail("lyrics", "stage: done");
  setEngineProgressVisible("lyrics", false, { delayMs: 3600 });
  setEngineState("music", "running");
  setEngineProgressVisible("music", true, { immediate: true });
  updateEnginePanels(title, lines);
  try {
    await runPipeline(getMicJobId(), title, lyricText);
    return true;
  } catch (_err) {
    showToast(t("watch.toast.regenerateFailed"));
    return false;
  }
}

function structuredWatchQueueIsActiveModule() {
  const queue = globalThis.currentStructuredWatchQueue;
  return !!(queue && Array.isArray(queue.items) && queue.items.length > 1);
}

let structuredWatchQueueAdvancePending = false;

function queueStructuredWatchAdvanceModule() {
  if (structuredWatchQueueAdvancePending || !structuredWatchQueueIsActiveModule()) return;
  structuredWatchQueueAdvancePending = true;
  window.setTimeout(async () => {
    structuredWatchQueueAdvancePending = false;
    const advanced = await globalThis.advanceStructuredWorkPlaybackModule?.();
    if (!advanced) return;
    armWatchExplicitPreviewIntent();
    await openWatchPreviewFlowModule({
      preferredTab: "mv",
      clearLimit: true,
      allowDemoFallback: false
    });
  }, 220);
}

async function openLatestRegistryPreviewInWatch() {
  if (shouldKeepWatchInMusicModeModule()) {
    openWatchPreviewShellModule({ fallbackTab: "music", restoreAudio: true });
    return true;
  }
  try {
    const res = await fetch(
      "/api/registry/v1/jobs/latest?capability_id=video.gan.v1&status=succeeded"
    );
    if (!res.ok) return false;
    const payload = await res.json();
    const job = payload?.job || payload;
    if (!job) return false;
    const artifacts = job.artifacts || [];
    const videoArtifact = artifacts.find((item) => item.name === "video_preview.mp4");
    const svgArtifact = artifacts.find((item) => item.name === "video_preview.svg");
    if (videoArtifact && setWatchVideoFromArtifact(videoArtifact.uri, { sourceKind: "registry" })) {
      safeSetWatchSubtitleModule(watchSubtitleLabelModule("preview"));
      attemptWatchVideoPlaybackModule({ allowFallback: false });
      return true;
    }
    if (svgArtifact) {
      setWatchSvgPreviewModule(svgArtifact.uri);
      safeSetWatchSubtitleModule(watchSubtitleLabelModule("preview"));
      return true;
    }
    return false;
  } catch (_err) {
    return false;
  }
}

async function ensureWatchPanelPreviewPlayback() {
  ensureWatchCentered();
  if (shouldKeepWatchInMusicModeModule()) {
    openWatchPreviewShellModule({ fallbackTab: "music", restoreAudio: true });
    playWatchAudioPreviewFromStartModule();
    return true;
  }
  if (hasCurrentWatchPreviewMedia()) {
    handleWatchUserPlaybackGesture();
    return true;
  }
  if (videoJobId) {
    handleWatchUserPlaybackGesture();
    return true;
  }
  return false;
}

// CSSOS_PHASE2_HYDRATE_WATCH 20260420 — when a user clicks "Open in Watch"
// from the notifications panel for a completed run, we must pull all of the
// run's artifacts (video / cover / lyrics / subtitles) into the Watch panel,
// not just the audio. Otherwise the panel shows black because Watch state
// still reflects a different (or no) run. This helper fetches the run's
// pipeline status payload and hydrates video + cover from the artifact list.
async function hydrateWatchFromRunPayloadModule(runId = "") {
  const safeRunId = String(runId || "").trim();
  if (!safeRunId) return false;
  const statePath = typeof pipelineRunStatePath === "function"
    ? pipelineRunStatePath(safeRunId)
    : `runs/${safeRunId}/state.json`;
  if (!statePath) return false;
  let payload = null;
  try {
    const res = await fetch(
      `/api/pipeline/status?path=${encodeURIComponent(statePath)}`
    );
    if (!res.ok) return false;
    payload = await res.json().catch(() => null);
  } catch (_err) {
    return false;
  }
  if (!payload) return false;
  const artifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
  let hydrated = false;
  // Video hydration — prefer mp4 artifacts under the compose/final stage.
  const videoEntry = artifacts.find((entry) => {
    const path = String(entry?.path || "").trim().toLowerCase();
    const mime = String(entry?.mime || "").trim().toLowerCase();
    if (!path) return false;
    if (mime && !mime.startsWith("video")) return false;
    return path.endsWith(".mp4");
  });
  if (
    videoEntry &&
    typeof finalAudioArtifactUrl === "function" &&
    typeof setWatchVideoFromArtifact === "function" &&
    (!watchVideo?.src || !String(watchVideo.src).trim())
  ) {
    const videoUrl = finalAudioArtifactUrl(safeRunId, videoEntry.path);
    if (videoUrl) {
      setWatchVideoFromArtifact(videoUrl, { sourceKind: "run-artifact" });
      hydrated = true;
    }
  }
  // Cover hydration — first image/* artifact wins; fall back to cover.png.
  const coverEntry =
    artifacts.find((entry) => {
      const path = String(entry?.path || "").trim().toLowerCase();
      const mime = String(entry?.mime || "").trim().toLowerCase();
      if (!path) return false;
      if (mime && !mime.startsWith("image")) return false;
      return /(cover|poster|thumb)\.(png|jpe?g|webp)$/i.test(path);
    }) ||
    artifacts.find((entry) => {
      const mime = String(entry?.mime || "").trim().toLowerCase();
      return mime.startsWith("image");
    });
  if (
    coverEntry &&
    typeof finalAudioArtifactUrl === "function" &&
    typeof setWatchSvgPreviewModule === "function"
  ) {
    const coverUrl = finalAudioArtifactUrl(safeRunId, coverEntry.path);
    if (coverUrl) {
      setWatchSvgPreviewModule(coverUrl);
      hydrated = true;
    }
  }
  // Title hydration — prefer the run's recorded title so the Watch header
  // rotator shows the right label even when the user opens an older run.
  try {
    const runTitle = String(payload?.title || payload?.meta?.title || "").trim();
    if (runTitle) {
      state.title = runTitle;
      if (state.songSeed) state.songSeed.title = runTitle;
      const watchPanelTitle = document.querySelector("#watch-panel .panel-title");
      if (watchPanelTitle) {
        const prefix = loginCopy("Watch");
        const suffix = loginCopy("Ready");
        watchPanelTitle.textContent = `${prefix} · ${runTitle} · ${suffix}`;
      }
    }
  } catch (_err) {}
  return hydrated;
}

async function openCurrentGeneratedWatchPlaybackModule({ autoplay = true, preferVideo = true } = {}) {
  if (watchActiveTab === "music") {
    preferVideo = false;
  }
  const candidateRunId = String(
    currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || currentWatchPreviewWork?.source_run_id || ""
  ).trim();
  if (candidateRunId) {
    // Hydrate the full Watch surface (video/cover/title) from the run's
    // pipeline status payload BEFORE we attempt audio attach, so the panel
    // isn't black when the user opens an older completed run.
    await hydrateWatchFromRunPayloadModule(candidateRunId).catch(() => false);
    await attemptImmediateFinalAudioAttach(candidateRunId);
  }
  const generationInFlight =
    !!candidateRunId &&
    (
      !typingState.completed ||
      Number(engineProgressState.music || 0) < 100 ||
      Number(engineProgressState.video || 0) < 100 ||
      Number(engineProgressState.kara || 0) < 100
    );
  const hasVideo = !!(watchVideo?.src && String(watchVideo.src).trim()) && !generationInFlight;
  const hasFinalAudio = currentWatchAudioSourceKind === "final-artifact" || !!getRememberedWatchFinalAudio();
  if (candidateRunId && !hasFinalAudio && !hasVideo) {
    openWatchPreviewShellModule({ fallbackTab: preferVideo ? "mv" : "music" });
    syncWatchSubtitleForWaitingMediaModule();
    return false;
  }
  if (preferVideo && hasVideo) {
    openWatchPreviewShellModule({ fallbackTab: "mv" });
    activateWatchTab("mv");
    handleWatchUserPlaybackGesture();
    attemptWatchVideoPlaybackModule({ allowFallback: false, maxRetries: 3 });
    return true;
  }
  if (hasFinalAudio) {
    openWatchPreviewShellModule({ fallbackTab: "music", restoreAudio: true });
    activateWatchTab("music");
    if (autoplay) {
      openWatchMusicPlaybackSurfaceModule({ autoplay: true });
    } else {
      restoreRememberedWatchFinalAudio();
    }
    return true;
  }
  if (hasVideo) {
    openWatchPreviewShellModule({ fallbackTab: "mv" });
    activateWatchTab("mv");
    handleWatchUserPlaybackGesture();
    attemptWatchVideoPlaybackModule({ allowFallback: false, maxRetries: 3 });
    return true;
  }
  return false;
}

window.openCurrentGeneratedWatchPlaybackModule = openCurrentGeneratedWatchPlaybackModule;

async function playWatchPanelDemoFallback() {
  return false;
}

async function playWatchPanelFailureFallback({ preferDemoMedia = true, allowSilence = true } = {}) {
  let usedDemo = false;
  if (preferDemoMedia && canUseWatchDemoFallback()) {
    usedDemo = false;
  }
  if (!usedDemo && allowSilence) {
    if (watchSvg) {
      watchSvg.style.display = "none";
      watchSvg.removeAttribute("src");
      watchSvg.setAttribute("alt", "");
    }
    if (watchScreenBackdrop) {
      watchScreenBackdrop.style.backgroundImage = "";
    }
    if (watchAudioPreview) {
      watchAudioPreview.pause?.();
      watchAudioPreview.removeAttribute("src");
      watchAudioPreview.load?.();
      watchAudioPreview.style.display = "none";
      currentWatchAudioSourceKind = "none";
      currentWatchAudioRunError = "";
      updateWatchAudioDebug();
      syncWatchAudioPresentation();
    }
  }
  return usedDemo;
}

function handleWatchVideoLoadedData() {
  if (!watchVideo) return;
  if (globalThis.currentPreviewVideoSourceKind === "frame-motion") {
    globalThis.currentPreviewVideoHasUsableFrame = true;
    clearWatchFrameLoopModule();
    return;
  }
  const capturedFrame = captureWatchVideoFirstFrameModule(watchVideo);
  globalThis.currentPreviewVideoHasUsableFrame = !!capturedFrame;
  if (capturedFrame) {
    cacheWatchFrameModule(capturedFrame);
  }
  if (shouldUseEffectiveWatchPreviewVideo()) {
    clearWatchFrameLoopModule();
    watchVideo.style.display = "";
    if (watchSvg) watchSvg.style.display = "none";
  } else {
    syncWatchPlaceholderFromCurrentState();
  }
  schedulePersistCurrentWorkAssets();
}

function handleWatchVideoCanPlay() {
  if (!watchVideo) return;
  watchVideoRestrictionHits = 0;
  watchScreen?.classList.remove("is-waiting");
  attemptWatchVideoPlaybackModule({ maxRetries: 2 });
  globalThis.currentPreviewVideoDurationSec = Number.isFinite(watchVideo.duration) ? watchVideo.duration : 0;
  if (
    getForyouPreviewMode() !== FORYOU_PREVIEW_MODES.IMAGE &&
    shouldUseEffectiveWatchPreviewVideo()
  ) {
    clearWatchFrameLoopModule();
    watchVideo.style.display = "";
    if (watchSvg) watchSvg.style.display = "none";
    setForyouThumbVideo(watchVideo.currentSrc || watchVideo.src);
  } else {
    syncWatchPlaceholderFromCurrentState();
  }
  syncVisibleWatchPanelAfterPreviewReady();
  schedulePersistCurrentWorkAssets();
}

function handleWatchVideoLoadedMetadata() {
  if (!watchVideo) return;
  globalThis.currentPreviewVideoDurationSec = Number.isFinite(watchVideo.duration) ? watchVideo.duration : 0;
  if (
    globalThis.currentPreviewVideoSourceKind !== "demo" &&
    globalThis.currentPreviewVideoDurationSec > 0 &&
    globalThis.currentPreviewVideoDurationSec <= MIN_EFFECTIVE_PREVIEW_DURATION_SEC
  ) {
    showToast(watchToastCopyModule("previewShort"));
    return;
  }
  syncWatchPlaceholderFromCurrentState();
  schedulePersistCurrentWorkAssets();
}

function handleWatchVideoError() {
  if (watchSvg) {
    watchSvg.style.display = "none";
    watchSvg.removeAttribute("src");
    watchSvg.setAttribute("alt", "");
  }
  if (watchScreenBackdrop) {
    watchScreenBackdrop.style.backgroundImage = "";
  }
  watchVideoRestrictionHits += 1;
  if (isAutoplayRestrictedWatchEnvironmentModule() || watchVideoRestrictionHits >= 2) {
    fallbackWatchPlaybackToMusicModule(loginCopy("Video blocked, switching to music."));
    return;
  }
  attemptWatchVideoPlaybackModule({ maxRetries: 2 });
}

function syncWatchPlaybackIndicator(indicator, clickTarget) {
  if (!indicator || !watchVideo) return;
  if (watchVideo.paused) {
    const audioPlaying = !!(
      watchAudioPreview &&
      !watchAudioPreview.paused &&
      !watchAudioPreview.ended &&
      String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim()
    );
    setWatchPlaybackUiSuppressedModule(audioPlaying);
    watchOverlayPlay?.classList.remove("is-paused");
    indicator.textContent = "";
    indicator.style.opacity = "0.85";
    clickTarget?.classList.add("is-paused");
    return;
  }
  setWatchPlaybackUiSuppressedModule(true);
  watchOverlayPlay?.classList.add("is-paused");
  indicator.textContent = "";
  indicator.style.opacity = "0.35";
  clickTarget?.classList.remove("is-paused");
}

function handleWatchVideoPlayStateChange(indicator, clickTarget) {
  syncWatchPlaybackIndicator(indicator, clickTarget);
}

function handleWatchVideoTimeUpdate() {
  enforceWatchPreviewLimit();
  // CSSOS_PHASE2_KARAOKE_TICK_FROM_VIDEO 20260428 #165 — Jing
  // After #164 the audio plays out of <video> (mp4 with muxed audio),
  // so the karaoke overlay must tick on the VIDEO element's timeupdate
  // events too — not only on <audio>'s. Otherwise the subtitle ticker
  // freezes at the first cue forever.
  renderWatchKaraokeOverlayModule();
}

function handleWatchAudioPreviewStateSync() {
  syncWatchMusicStateModule();
  if (watchAudioPreview && !watchAudioPreview.paused && !watchAudioPreview.ended) {
    setWatchPlaybackUiSuppressedModule(true);
  } else if (!watchVideo || watchVideo.paused || watchVideo.ended) {
    setWatchPlaybackUiSuppressedModule(false);
  }
}

function handleWatchAudioPreviewTimeUpdate() {
  enforceWatchPreviewLimit();
  enforceWatchReplyWindowLoop();
  maybeRefreshReplyHarmonyHighlight();
  renderWatchKaraokeOverlayModule();
}

function handleWatchAudioPreviewTimelineUpdate() {
  maybeRefreshReplyHarmonyHighlight();
  renderWatchKaraokeOverlayModule();
}

function handleWatchMusicPlayClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const videoPlaying = !!(
    watchVideo &&
    !watchVideo.paused &&
    !watchVideo.ended &&
    String(watchVideo.currentSrc || watchVideo.src || "").trim()
  );
  const audioPlaying = !!(
    watchAudioPreview &&
    !watchAudioPreview.paused &&
    !watchAudioPreview.ended &&
    String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim()
  );
  if (videoPlaying || audioPlaying) {
    pulseWatchOverlayFeedbackModule("pause");
    void playWatchOverlayFeedbackToneModule("pause");
    watchVideo?.pause?.();
    watchAudioPreview?.pause?.();
    syncWatchMusicStateModule();
    return;
  }
  const activeStage = resolveWatchRecoveryStageModule(
    getNextWatchGenerationGapModule() || getActiveWatchProgressCardModule()?.key || "play"
  );
  if (activeStage) {
    pulseWatchOverlayFeedbackModule("generate");
    void playWatchOverlayFeedbackToneModule("generate");
    if (activeStage !== "play") {
      void continueWatchGenerationStageModule(activeStage);
      return;
    }
  }
  const existingSrc = String(watchAudioPreview?.currentSrc || watchAudioPreview?.src || "").trim();
  if (!existingSrc) {
    void handleWatchPlaybackSurfaceClick();
    return;
  }
  if (
    (existingSrc.startsWith("data:audio/")) &&
    getRememberedWatchFinalAudio()
  ) {
    restoreRememberedWatchFinalAudio({ preservePlayback: true });
  }
  if (!watchAudioPreview?.src) return;
  if (watchAudioPreview.paused || watchAudioPreview.ended) {
    pulseWatchOverlayFeedbackModule("resume");
    void playWatchOverlayFeedbackToneModule("resume");
    void ensureWatchMusicVisualizerModule();
    const playPromise = watchAudioPreview.play?.();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch(() => {});
    }
  } else {
    pulseWatchOverlayFeedbackModule("pause");
    void playWatchOverlayFeedbackToneModule("pause");
    watchAudioPreview.pause?.();
  }
  syncWatchMusicStateModule();
}

function initWatchVideoPlaybackControlsModule() {
  if (!watchVideo) return;
  const clickTarget = document.querySelector(".watch-screen");
  const indicator = watchOverlayPlay?.querySelector(".watch-overlay-play-icon") || null;
  const syncIndicator = () => handleWatchVideoPlayStateChange(indicator, clickTarget);
  watchVideo.addEventListener("play", syncIndicator);
  watchVideo.addEventListener("pause", syncIndicator);
  // CSSOS_WAVE_280 — 视频静音自动播起来时, 弹"🔇 轻触开声音"提示; 暂停即收起.
  watchVideo.addEventListener("playing", function () {
    if (globalThis.__cssosWatchPendingUnmute && watchVideo.muted) showWatchSoundHintModule();
  });
  watchVideo.addEventListener("pause", hideWatchSoundHintModule);
  watchVideo.addEventListener("timeupdate", handleWatchVideoTimeUpdate);
  syncWatchPlaybackIndicator(indicator, clickTarget);

  watchVideo.addEventListener("loadeddata", handleWatchVideoLoadedData);
  watchVideo.addEventListener("canplay", handleWatchVideoCanPlay);
  watchVideo.addEventListener("loadedmetadata", handleWatchVideoLoadedMetadata);
  watchVideo.addEventListener("ended", queueStructuredWatchAdvanceModule);
  watchVideo.addEventListener("error", handleWatchVideoError);
  if (clickTarget) {
    clickTarget.addEventListener("click", handleWatchPlaybackSurfaceClick);
  }
}

function initWatchMusicControlsModule() {
  if (!watchAudioPreview) return;
  watchAudioPreview.controls = false;
  ["play", "pause", "ended", "loadedmetadata", "timeupdate", "canplay"].forEach((eventName) => {
    watchAudioPreview.addEventListener(eventName, handleWatchAudioPreviewStateSync);
  });
  watchAudioPreview.addEventListener("ended", queueStructuredWatchAdvanceModule);
  watchAudioPreview.addEventListener("timeupdate", handleWatchAudioPreviewTimeUpdate);
  ["play", "pause", "ended", "loadedmetadata", "canplay", "seeked"].forEach((eventName) => {
    watchAudioPreview.addEventListener(eventName, handleWatchAudioPreviewTimelineUpdate);
  });
  watchMusicPlay?.addEventListener("click", handleWatchMusicPlayClick);
  watchStyleShift?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    cycleWatchTypographyPresetModule();
  });
  watchStyleShift?.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openWatchStyleMenuModule(event.clientX, event.clientY, "all");
  });
  watchStyleShift?.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    clearTimeout(watchStyleMenuLongpressTimer);
    watchStyleMenuLongpressTimer = window.setTimeout(() => {
      openWatchStyleMenuModule(event.clientX, event.clientY, "all");
    }, 520);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    watchStyleShift?.addEventListener(eventName, () => {
      clearTimeout(watchStyleMenuLongpressTimer);
      watchStyleMenuLongpressTimer = null;
    });
  });
  watchAudioPreview.addEventListener("emptied", stopWatchMusicVisualizerModule);
  syncWatchMusicArtworkModule();
  syncWatchMusicStateModule();
  if (!watchProgressRotatorTimer) {
    watchProgressRotatorTimer = window.setInterval(() => {
      syncWatchProgressRotatorModule();
    }, WATCH_PROGRESS_ROTATE_MS);
  }
}

window.renderWatchKaraokeOverlayModule = renderWatchKaraokeOverlayModule;

function resetWatchVideoPreviewModule(options = {}) {
  if (!watchVideo) return;
  const preserveArtwork = options?.preserveArtwork === true;
  if (!preserveArtwork) {
    resetForyouThumb();
    clearWatchFrameLoopModule();
  }
  globalThis.currentPreviewVideoDurationSec = 0;
  currentPreviewVideoIsLocalFallback = false;
  globalThis.currentPreviewVideoSourceKind = "none";
  globalThis.currentPreviewVideoHasUsableFrame = false;
  if (!preserveArtwork) {
    globalThis.currentPreviewFrameDataUrl = "";
    globalThis.currentPreviewFrameSequence = [];
    globalThis.currentWatchArtworkVariantPool = [];
  }
  if (globalThis.currentPreviewMotionClipUrl) {
    URL.revokeObjectURL(globalThis.currentPreviewMotionClipUrl);
    globalThis.currentPreviewMotionClipUrl = "";
  }
  watchVideo.pause?.();
  watchVideo.removeAttribute("src");
  watchVideo.load?.();
  if (watchVideoUrl) {
    URL.revokeObjectURL(watchVideoUrl);
    watchVideoUrl = null;
  }
  if (watchSvg && !preserveArtwork) {
    watchSvg.removeAttribute("src");
    watchSvg.style.display = "none";
  }
  watchVideo.style.display = "";
  if (preserveArtwork) {
    syncWatchPlaceholderFromCurrentState();
  }
}

function shouldUseEffectiveWatchPreviewVideo() {
  return (
    !currentPreviewVideoIsLocalFallback &&
    globalThis.currentPreviewVideoHasUsableFrame &&
    hasEffectivePreviewVideo()
  );
}

function setWatchVideoFromArtifact(uri, options = {}) {
  if (!watchVideo || !uri) return false;
  const isLocalFallback = uri === LOCAL_FALLBACK_MP4;
  const sourceKind = options.sourceKind || (isLocalFallback ? "local-fallback" : "artifact");
  currentPreviewVideoIsLocalFallback = isLocalFallback;
  globalThis.currentPreviewVideoDurationSec = 0;
  globalThis.currentPreviewVideoSourceKind = sourceKind;
  globalThis.currentPreviewVideoHasUsableFrame = false;
  syncWatchPlaceholderFromCurrentState();
  if (!uri.startsWith("data:")) {
    watchVideo.src = uri;
    watchVideo.muted = false;
    watchVideo.playsInline = true;
    watchVideo.load?.();
    return true;
  }
  const [meta, data] = uri.split(",");
  if (!meta || !data) return false;
  const mimeMatch = meta.match(/^data:([^;]+);base64$/i);
  const mime = mimeMatch ? mimeMatch[1] : "video/mp4";
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (watchVideoUrl) {
      URL.revokeObjectURL(watchVideoUrl);
      watchVideoUrl = null;
    }
    watchVideoUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    watchVideo.src = watchVideoUrl;
    watchVideo.muted = false;
    watchVideo.playsInline = true;
    watchVideo.load?.();
    return true;
  } catch (_err) {
    return false;
  }
}

function hasCurrentWatchPreviewMedia() {
  return !!(
    (watchVideo?.src && String(watchVideo.src).trim()) ||
    (watchSvg?.src && String(watchSvg.src).trim()) ||
    (globalThis.currentPreviewMotionClipUrl && String(globalThis.currentPreviewMotionClipUrl).trim())
  );
}

function hasEffectiveWatchFrameSourceModule() {
  const src = String(globalThis.currentPreviewFrameDataUrl || watchSvg?.src || "").trim();
  if (!src) return false;
  if (/^data:image\/svg\+xml/i.test(src)) return false;
  return true;
}

function showWatchFramePlaceholderModule(uri) {
  if (!watchSvg || !uri) return false;
  // CSSOS_WAVE_329 20260522 — Jing: 进入 MV 时封面"闪一下"是同一/多张图被重复写入.
  // 幂等守卫: 已经显示的就是这张 → 直接跳过, 不重绘(消除冗余闪烁).
  try {
    if (!/^data:image\/svg\+xml/i.test(String(uri || "").trim())) {
      var _abs = new URL(String(uri), location.href).href;
      if (watchSvg.src === _abs && watchSvg.style.display === "block") return true;
    }
  } catch (_e) { /* noop */ }
  if (/^data:image\/svg\+xml/i.test(String(uri || "").trim())) {
    if (watchSvg) {
      watchSvg.style.display = "none";
      watchSvg.removeAttribute("src");
      watchSvg.setAttribute("alt", "");
    }
    if (watchScreenBackdrop) {
      watchScreenBackdrop.style.backgroundImage = "";
    }
    return false;
  }
  clearWatchFrameLoopModule();
  // CSSOS_WAVE_331 20260522 — Jing: 封面加载失败时不要露出破图"?", 改为隐藏 svg、清掉
  // 背景图(回退到纯黑/标题), 并尝试用作品的稳定封面(cover_image)兜底一次. 过期的
  // cover_slides 临时图常 404 → 之前就显示一个刺眼的"?".
  try {
    watchSvg.onerror = function () {
      try {
        var stable = String(
          (currentWatchPreviewWork && (currentWatchPreviewWork.cover_image || currentWatchPreviewWork.cover_url)) || ""
        ).trim();
        var curAbs = "";
        try { curAbs = new URL(String(uri), location.href).href; } catch (_e) {}
        if (stable && !/^data:image\/svg\+xml/i.test(stable) && stable !== uri && stable !== curAbs && !watchSvg.dataset.cssosCoverFellBack) {
          watchSvg.dataset.cssosCoverFellBack = "1";
          watchSvg.src = stable;
          if (watchScreenBackdrop) watchScreenBackdrop.style.backgroundImage = `url("${stable.replace(/"/g, '\\"')}")`;
          return;
        }
      } catch (_e2) {}
      // CSSOS_WAVE_336 20260522 — Jing: 稳定封面也加载失败(replicate 临时图 404 过期)
      // → 生成一张【标题卡占位】顶上, 绝不留黑屏. 实在生成不了才隐藏.
      try {
        var ttl = String((currentWatchPreviewWork && currentWatchPreviewWork.title) || state.title || "").trim();
        if (typeof globalThis.requestThumbnailDataUrl === "function" && !watchSvg.dataset.cssosPlaceholderFell) {
          watchSvg.dataset.cssosPlaceholderFell = "1";
          globalThis.requestThumbnailDataUrl(ttl || loginCopy("CSS MV"), "", []).then(function (durl) {
            if (durl) {
              watchSvg.src = durl;
              watchSvg.style.display = "block";
              if (watchScreenBackdrop) watchScreenBackdrop.style.backgroundImage = `url("${String(durl).replace(/"/g, '\\"')}")`;
            } else {
              watchSvg.style.display = "none";
              if (watchScreenBackdrop) watchScreenBackdrop.style.backgroundImage = "";
            }
          }).catch(function () { watchSvg.style.display = "none"; });
          return;
        }
      } catch (_e3) {}
      watchSvg.style.display = "none";
      if (watchScreenBackdrop) watchScreenBackdrop.style.backgroundImage = "";
    };
    watchSvg.onload = function () { watchSvg.dataset.cssosCoverFellBack = ""; watchSvg.style.display = "block"; };
  } catch (_e) {}
  watchSvg.src = uri;
  watchSvg.style.display = "block";
  watchSvg.classList.add("glow");
  // W342 20260523 — Jing: 不再注入 display:none 到 watchVideo.
  // 封面图和视频通过 z-index 叠放(video z-index:2, img z-index:1).
  // 视频有内容时自然盖住封面图; 无内容时视频透明, 封面自然透出.
  // 原来注入 display:none 会和 handleWatchVideoCanPlay/LoadedData 里的
  // display:"" 产生竞态, 导致视频在 loadeddata 后又被封面图再次盖住.
  if (watchScreenBackdrop) {
    watchScreenBackdrop.style.backgroundImage = `url("${String(uri).replace(/"/g, '\\"')}")`;
  }
  return true;
}

function setWatchSvgPreviewModule(uri) {
  if (!watchSvg || !uri) return false;
  const safeUri = String(uri || "").trim();
  const incomingIsSvg = /^data:image\/svg\+xml/i.test(safeUri);
  if (incomingIsSvg) {
    return false;
  }
  const currentArtwork = String(
    globalThis.currentPreviewFrameDataUrl ||
      foryouThumbImage?.src ||
      ""
  ).trim();
  const currentHasRealArtwork = !!currentArtwork && !/^data:image\/svg\+xml/i.test(currentArtwork);
  if (incomingIsSvg && currentHasRealArtwork) {
    showWatchFramePlaceholderModule(currentArtwork);
    syncWatchMusicArtworkModule();
    return true;
  }
  globalThis.currentPreviewFrameDataUrl = safeUri;
  globalThis.currentResolvedWatchArtworkDataUrl = safeUri;
  showWatchFramePlaceholderModule(safeUri);
  setForyouThumbImage(safeUri);
  syncWatchMusicArtworkModule();
  return true;
}

function pulseWatchOverlayFeedbackModule(mode = "generate") {
  if (!watchOverlayPlay) return;
  watchOverlayPlay.classList.remove("is-confirmed", "is-generating");
  void watchOverlayPlay.offsetWidth;
  if (mode === "generate") {
    watchOverlayPlay.classList.add("is-generating");
  }
  watchOverlayPlay.classList.add("is-confirmed");
  window.setTimeout(() => {
    watchOverlayPlay?.classList.remove("is-confirmed");
  }, 460);
}

async function playWatchOverlayFeedbackToneModule(mode = "generate") {
  // CSSOS_PHASE2_DISABLE_CLICK_SFX 20260430 #237 — Jing
  // "点击媒体框的音效，如果没有更好听的，还是取消吧，但先别删."
  // Gated on globalThis.cssosWatchClickSfxEnabled (default false) so the
  // synthesized triangle/sine beep stays muted until we have a nicer
  // sample to swap in. Body preserved verbatim below for re-enabling
  // later: just set globalThis.cssosWatchClickSfxEnabled = true (or
  // ship a settings toggle) and the tone re-plays without code changes.
  if (globalThis.cssosWatchClickSfxEnabled !== true) return false;
  if (typeof window === "undefined") return false;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return false;
  try {
    if (!watchMusicAudioContext) {
      watchMusicAudioContext = new AudioCtx();
    }
    if (watchMusicAudioContext.state === "suspended") {
      await watchMusicAudioContext.resume().catch(() => {});
    }
    const ctx = watchMusicAudioContext;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = mode === "generate" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(mode === "generate" ? 612 : 540, now);
    oscillator.frequency.exponentialRampToValueAtTime(mode === "generate" ? 960 : 720, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.026, now + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    return true;
  } catch (_err) {
    return false;
  }
}

/* CSSOS_WAVE_212 20260516 — Jing: "久不久就返回这个恐怖音效和砖头人画面
 * 能不能输出失败就返回我们的 demo 媒体呀". When pipeline fails, the
 * old fallback hid the video element + showed an abstract creative-
 * stage SVG (orange palette + rectangle silhouettes = "brick people")
 * with no music — feeling lonely + foreboding. Instead, pick a random
 * curated demo MP4 from /examples/ so the user gets real motion +
 * sound while we recover. The demo plays silently if no audio source
 * (still better than the dead-silent placeholder).
 *
 * NOTE: the demo MV plays muted by default (autoplay rules + we don't
 * want it to overlap with the real audio when it finally arrives).
 * The actual audio path is unaffected — `watchAudioPreview` keeps its
 * own src; the video is just visual filler. */
const W212_DEMO_FALLBACK_VIDEOS = [
  "/examples/AI_Media_FCGM-lZPD_8_002_720p.mp4",
  "/examples/Back-to-the-Westworld-12_Media_QltXwpK6l4k_002_720p.mp4",
  "/examples/Cybertruck_Media_C9pLehCkDk8_002_720p%20%281%29.mp4",
];
function pickW212DemoVideo() {
  return W212_DEMO_FALLBACK_VIDEOS[
    Math.floor(Math.random() * W212_DEMO_FALLBACK_VIDEOS.length)
  ];
}
function useLocalWatchVideoFallbackModule(title, subtitle) {
  if (watchSvg) {
    watchSvg.style.display = "none";
    watchSvg.removeAttribute("src");
    watchSvg.setAttribute("alt", "");
  }
  if (watchScreenBackdrop) {
    watchScreenBackdrop.style.backgroundImage = "";
  }
  /* W212 — swap brick-people SVG for a demo MP4. Only attempt once
   * per fallback to avoid re-swap thrash. */
  try {
    if (watchVideo && !watchVideo.dataset.w212DemoSet) {
      const demoUrl = pickW212DemoVideo();
      watchVideo.dataset.w212DemoSet = "1";
      watchVideo.src = demoUrl;
      watchVideo.muted = true;          // never overlap real audio
      watchVideo.playsInline = true;
      watchVideo.loop = true;
      watchVideo.style.display = "";
      watchVideo.load?.();
      const playPromise = watchVideo.play?.();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch(() => {});
      }
      console.info(
        "%c[watch][W212] swapped brick-people SVG for demo MP4: %s",
        "color:#0a8;font-weight:bold",
        demoUrl
      );
    }
  } catch (_e) { /* fallback best-effort */ }
  currentPreviewVideoIsLocalFallback = true;
  globalThis.currentPreviewVideoDurationSec = 0;
  globalThis.currentPreviewVideoSourceKind = "local-fallback";
  syncWatchSubtitleForWaitingMediaModule();
}

/* CSSOS_WAVE_221 20260517 — Jing 选项 B: 浏览器拦截 autoplay 时,
 * 渲染全屏 ▶ "Tap to play" 蒙层. 用户点一下就解锁后续 autoplay
 * (浏览器把该手势授权给本 tab 的所有媒体), 体验对齐 TikTok / IG. */
function promptManualWatchPlaybackModule(message) {
  globalThis.watchManualPlayHinted = true;
  safeSetWatchSubtitleModule(message);
  try {
    if (document.getElementById("cssos-tap-to-play-overlay")) return;
    const host =
      document.getElementById("watch-screen") ||
      document.getElementById("watch-stage") ||
      document.body;
    if (!host) { showToast(message); return; }
    const ov = document.createElement("div");
    ov.id = "cssos-tap-to-play-overlay";
    ov.setAttribute("role", "button");
    ov.setAttribute("aria-label", "Tap to play");
    ov.style.cssText =
      "position:absolute;inset:0;z-index:9999;display:flex;flex-direction:column;" +
      "align-items:center;justify-content:center;gap:16px;cursor:pointer;" +
      "background:radial-gradient(ellipse at center,rgba(0,0,0,.55),rgba(0,0,0,.82));" +
      "backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);" +
      "animation:cssosTapPulse 1.8s ease-in-out infinite;";
    ov.innerHTML =
      '<div style="width:104px;height:104px;border-radius:50%;background:rgba(0,245,160,.18);' +
      'border:2px solid rgba(0,245,160,.85);display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 0 32px 6px rgba(0,245,160,.45);">' +
      '<div style="width:0;height:0;border-left:32px solid #daffee;border-top:20px solid transparent;' +
      'border-bottom:20px solid transparent;margin-left:8px;"></div></div>' +
      '<div style="font:700 16px/1.4 ui-sans-serif,system-ui;color:#daffee;letter-spacing:.04em;' +
      'text-shadow:0 2px 8px rgba(0,0,0,.6);">Tap to play</div>' +
      '<div style="font:500 12px/1.4 ui-monospace,monospace;color:rgba(218,255,238,.7);' +
      'max-width:280px;text-align:center;">' +
      'Browsers block autoplay on first visit. One tap unlocks the whole session.' +
      '</div>';
    if (!document.getElementById("cssos-tap-pulse-style")) {
      const st = document.createElement("style");
      st.id = "cssos-tap-pulse-style";
      st.textContent =
        "@keyframes cssosTapPulse{0%,100%{background-color:rgba(0,0,0,.55)}50%{background-color:rgba(0,0,0,.72)}}";
      document.head.appendChild(st);
    }
    const dismiss = () => {
      try { ov.remove(); } catch (_e) {}
      try { watchVideo?.play?.().catch(() => {}); } catch (_e) {}
      try { watchAudioPreview?.play?.().catch(() => {}); } catch (_e) {}
      /* CSSOS_WAVE_226 — 用户首次手势也顺便触发真全屏三连:
       * 影院布局 + 面板浏览器全屏 + (失败时) 媒体框 / documentElement. */
      try {
        if (typeof globalThis.cssosEnterCinemaLayout === "function") {
          globalThis.cssosEnterCinemaLayout();
        }
      } catch (_e) {}
      try {
        if (typeof globalThis.cssosRequestBrowserFullscreen === "function") {
          globalThis.cssosRequestBrowserFullscreen();
        }
      } catch (_e) {}
      // 兜底: 如果 panel 全屏没成功, 试 video 元素 / documentElement.
      setTimeout(() => {
        if (document.fullscreenElement) return;
        try {
          const v = document.getElementById("watch-video");
          const fn = v?.requestFullscreen || v?.webkitRequestFullscreen;
          if (fn) { fn.call(v); return; }
        } catch (_e) {}
        try {
          const de = document.documentElement;
          const fn = de.requestFullscreen || de.webkitRequestFullscreen;
          if (fn) fn.call(de);
        } catch (_e) {}
      }, 80);
      globalThis.watchManualPlayHinted = false;
    };
    ov.addEventListener("click", dismiss, { once: true });
    ov.addEventListener("touchend", dismiss, { once: true });
    // host must be positioned for absolute overlay to fit.
    try {
      const cs = getComputedStyle(host);
      if (cs.position === "static") host.style.position = "relative";
    } catch (_e) {}
    host.appendChild(ov);
  } catch (_e) {
    showToast(message);
  }
}

function clearWatchPlaybackRetryModule() {
  if (globalThis.watchPlaybackTimer) {
    clearTimeout(globalThis.watchPlaybackTimer);
    globalThis.watchPlaybackTimer = null;
  }
  globalThis.watchPlaybackRetry = 0;
}

function revealWatchVideoLayerModule() {
  if (!watchVideo?.src) return false;
  if (watchSvg) watchSvg.style.display = "none";
  clearWatchFrameLoopModule();
  watchVideo.style.display = "";
  return true;
}

function attemptWatchVideoPlaybackModule(options = {}) {
  if (!watchVideo || !watchVideo.src) return;
  const maxRetries = options.maxRetries ?? 5;
  const interval = options.interval ?? 900;
  const allowFallback = options.allowFallback ?? false;
  clearWatchPlaybackRetryModule();

  const tryPlay = () => {
    if (!watchVideo || !watchVideo.src) return;
    // CSSOS_WAVE_279 20260521 — Jing: 进场免点击. 视频【强制静音】再 play —
    // 静音自动播浏览器基本都放行 → 视觉立即播放, 不再被拦/不再闪封面池.
    // 声音留到用户首次轻触时解锁(见 handleWatchPlaybackSurfaceClick 的
    // pendingUnmute 分支). 之前不静音 → 被拦 → fallback 封面闪.
    try {
      watchVideo.playsInline = true;
      // 仅在本会话尚未被用户解锁声音前强制静音; 一旦解锁(首次轻触), 后续
      // 切歌就带声音自动播, 不再每首都要求重新点一下.
      if (!globalThis.__cssosWatchAudioUnlocked) {
        watchVideo.muted = true;
        globalThis.__cssosWatchPendingUnmute = true;
      }
    } catch (_e) {}
    const playPromise = watchVideo.play?.();
    if (!playPromise || typeof playPromise.then !== "function") return;
    playPromise
      .then(() => {
        clearWatchPlaybackRetryModule();
        globalThis.watchManualPlayHinted = false;
      })
      .catch(() => {
        globalThis.watchPlaybackRetry += 1;
        if (isAutoplayRestrictedWatchEnvironmentModule()) {
          const msg = isTeslaWatchEnvironmentModule()
            ? loginCopy("Driving browser blocked video, music continues.")
            : loginCopy("Mobile browser blocked autoplay, switching to music.");
          fallbackWatchPlaybackToMusicModule(msg);
          return;
        }
        if (globalThis.watchPlaybackRetry <= maxRetries) {
          showToast(`Auto retry ${globalThis.watchPlaybackRetry}/${maxRetries}`);
          globalThis.watchPlaybackTimer = setTimeout(tryPlay, interval);
          return;
        }
        if (allowFallback && watchScreenBackdrop) {
          watchScreenBackdrop.style.backgroundImage = "";
        }
        if (String(watchAudioPreview?.currentSrc || watchAudioPreview?.src || "").trim()) {
          fallbackWatchPlaybackToMusicModule(watchToastCopyModule("autoplayBlocked"));
          return;
        }
        promptManualWatchPlaybackModule(watchToastCopyModule("autoplayBlocked"));
      });
  };

  tryPlay();
}

function clearWatchPreviewLimit() {
  watchPreviewLimitSec = 0;
  watchPreviewLimitReason = "";
  watchPreviewLimitNoticeShown = false;
}

function setWatchPreviewLimit(seconds, reason = "") {
  watchPreviewLimitSec = Math.max(0, Number(seconds || 0));
  watchPreviewLimitReason = String(reason || "").trim();
  watchPreviewLimitNoticeShown = false;
}

function getWatchFrameCacheKeyModule() {
  return [
    String(state.title || "").trim().toLowerCase(),
    String(state.style || "").trim().toLowerCase(),
    String(state.voice || "").trim().toLowerCase(),
    String(globalThis.currentPreviewVideoSourceKind || "unknown").trim().toLowerCase()
  ].join("::");
}

function getCachedWatchFrameModule() {
  const key = getWatchFrameCacheKeyModule();
  if (!key) return "";
  const memory = globalThis.watchFrameCache.get(key);
  if (memory) {
    setBoundedWatchCacheEntryModule(
      globalThis.watchFrameCache,
      key,
      memory,
      WATCH_FRAME_CACHE_LIMIT
    );
    return memory;
  }
  try {
    const stored = localStorage.getItem(`cssos.watch.frame.${key}`);
    if (stored) {
      setBoundedWatchCacheEntryModule(
        globalThis.watchFrameCache,
        key,
        stored,
        WATCH_FRAME_CACHE_LIMIT
      );
      return stored;
    }
  } catch (_err) {
    // ignore storage
  }
  return "";
}

function cacheWatchFrameModule(dataUrl) {
  const key = getWatchFrameCacheKeyModule();
  if (!key || !dataUrl) return;
  globalThis.currentPreviewFrameDataUrl = dataUrl;
  setBoundedWatchCacheEntryModule(
    globalThis.watchFrameCache,
    key,
    dataUrl,
    WATCH_FRAME_CACHE_LIMIT
  );
  syncMediaDerivedWorkCoverImage();
  try {
    if (String(dataUrl).length <= 220000) {
      localStorage.setItem(`cssos.watch.frame.${key}`, dataUrl);
    }
  } catch (_err) {
    // ignore storage quota
  }
}

function getCachedWatchFrameSequenceModule() {
  const key = getWatchFrameCacheKeyModule();
  if (!key) return [];
  return globalThis.watchFrameSequenceCache.get(key) || [];
}

function cacheWatchFrameSequenceModule(frames) {
  const key = getWatchFrameCacheKeyModule();
  if (!key || !Array.isArray(frames) || !frames.length) return;
  globalThis.currentPreviewFrameSequence = frames.slice(0, 4);
  setBoundedWatchCacheEntryModule(
    globalThis.watchFrameSequenceCache,
    key,
    globalThis.currentPreviewFrameSequence,
    WATCH_FRAME_SEQUENCE_CACHE_LIMIT
  );
}

function clearWatchFrameLoopModule() {
  if (globalThis.watchFrameLoopTimer) {
    clearInterval(globalThis.watchFrameLoopTimer);
    globalThis.watchFrameLoopTimer = null;
  }
}

function startWatchFrameLoopModule(frames) {
  if (!watchSvg || !Array.isArray(frames) || !frames.length) return false;
  clearWatchFrameLoopModule();
  let index = 0;
  watchSvg.src = frames[0];
  globalThis.watchFrameLoopTimer = setInterval(() => {
    if (!watchSvg || !watchSvg.style || watchSvg.style.display === "none") return;
    index = (index + 1) % frames.length;
    watchSvg.src = frames[index];
  }, 420);
  return true;
}

function captureWatchVideoFirstFrameModule(video) {
  if (!video?.videoWidth || !video?.videoHeight) return "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(640, video.videoWidth);
    canvas.height = Math.max(1, Math.round(canvas.width * (video.videoHeight / video.videoWidth)));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const sample = ctx.getImageData(0, 0, Math.min(canvas.width, 64), Math.min(canvas.height, 36)).data;
    let lumaSum = 0;
    let brightPixels = 0;
    const pixelCount = Math.max(1, sample.length / 4);
    for (let i = 0; i < sample.length; i += 4) {
      const r = sample[i] || 0;
      const g = sample[i + 1] || 0;
      const b = sample[i + 2] || 0;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumaSum += luma;
      if (luma > 36) brightPixels += 1;
    }
    const meanLuma = lumaSum / pixelCount;
    const brightRatio = brightPixels / pixelCount;
    if (meanLuma < MIN_EFFECTIVE_PREVIEW_FRAME_LUMA || brightRatio < 0.01) {
      return "";
    }
    return canvas.toDataURL("image/webp", 0.82);
  } catch (_err) {
    return "";
  }
}

async function extractWatchPreviewFramesFromSourceModule(src, frameCount = 4) {
  if (!src) return [];
  return new Promise((resolve) => {
    const tempVideo = document.createElement("video");
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    tempVideo.preload = "auto";
    tempVideo.crossOrigin = "anonymous";
    tempVideo.src = src;
    const cleanup = () => {
      tempVideo.pause?.();
      tempVideo.removeAttribute("src");
      tempVideo.load?.();
    };
    tempVideo.addEventListener(
      "loadedmetadata",
      async () => {
        const duration = Number.isFinite(tempVideo.duration) ? tempVideo.duration : 0;
        if (!(duration > MIN_EFFECTIVE_PREVIEW_DURATION_SEC)) {
          cleanup();
          resolve([]);
          return;
        }
        const targets = Array.from({ length: frameCount }, (_, index) => {
          const ratio = (index + 1) / (frameCount + 1);
          return Math.max(0.15, Math.min(duration - 0.15, duration * ratio));
        });
        const frames = [];
        for (const target of targets) {
          try {
            await new Promise((done) => {
              const onSeeked = () => {
                tempVideo.removeEventListener("seeked", onSeeked);
                done();
              };
              tempVideo.addEventListener("seeked", onSeeked, { once: true });
              tempVideo.currentTime = target;
            });
            const frame = captureWatchVideoFirstFrameModule(tempVideo);
            if (frame) frames.push(frame);
          } catch (_err) {
            // ignore single-frame failure
          }
        }
        cleanup();
        resolve(frames);
      },
      { once: true }
    );
    tempVideo.addEventListener(
      "error",
      () => {
        cleanup();
        resolve([]);
      },
      { once: true }
    );
  });
}

async function buildWatchMotionClipFromFramesModule(frames, options = {}) {
  if (!Array.isArray(frames) || frames.length < 2) return "";
  if (typeof MediaRecorder === "undefined") return "";
  const width = options.width || 640;
  const height = options.height || 360;
  const durationSec = Math.max(3.2, Number(options.durationSec || 4.2));
  const fps = Math.max(4, Number(options.fps || 6));
  const frameIntervalMs = Math.max(120, Math.round(1000 / fps));
  const totalFrames = Math.max(frames.length, Math.round(durationSec * fps));
  const beatSections = Array.isArray(options.beatSections) ? options.beatSections : [];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const images = await Promise.all(
    frames.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        })
    )
  );
  const usable = images.filter(Boolean);
  if (usable.length < 2) return "";

  const shotDurations = (() => {
    if (!beatSections.length) {
      return usable.map(() => durationSec / usable.length);
    }
    const sections = beatSections
      .slice(0, usable.length)
      .map((item) => Math.max(0.6, Math.min(2.2, (Number(item?.bars || 4) || 4) * 0.16)));
    const rawTotal = sections.reduce((sum, value) => sum + value, 0) || durationSec;
    return sections.map((value) => (value / rawTotal) * durationSec);
  })();

  return new Promise((resolve) => {
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    const chunks = [];
    let frameIndex = 0;
    let stopped = false;
    const shotPlan = usable.map((img, index) => ({
      img,
      durationSec: shotDurations[index % shotDurations.length] || durationSec / usable.length,
      zoomFrom: 1 + (index % 2 === 0 ? 0.02 : 0.06),
      zoomTo: 1 + (index % 2 === 0 ? 0.08 : 0.03),
      panX: (index % 3 === 0 ? -1 : index % 3 === 1 ? 1 : 0) * 18,
      panY: (index % 2 === 0 ? 1 : -1) * 10
    }));
    const totalPlanSec = shotPlan.reduce((sum, shot) => sum + shot.durationSec, 0) || durationSec;
    const draw = () => {
      const timeSec = Math.min(durationSec, frameIndex / fps);
      let cursor = 0;
      let activeShot = shotPlan[shotPlan.length - 1];
      for (const shot of shotPlan) {
        cursor += shot.durationSec;
        if (timeSec <= cursor) {
          activeShot = shot;
          break;
        }
      }
      const shotStart = Math.max(0, cursor - activeShot.durationSec);
      const shotProgress = activeShot.durationSec > 0 ? Math.min(1, Math.max(0, (timeSec - shotStart) / activeShot.durationSec)) : 0;
      const zoom = activeShot.zoomFrom + (activeShot.zoomTo - activeShot.zoomFrom) * shotProgress;
      const drawWidth = width * zoom;
      const drawHeight = height * zoom;
      const offsetX = (width - drawWidth) / 2 + activeShot.panX * shotProgress;
      const offsetY = (height - drawHeight) / 2 + activeShot.panY * shotProgress;
      ctx.clearRect(0, 0, width, height);
      ctx.filter = `brightness(${1.02 + 0.04 * Math.sin((timeSec / totalPlanSec) * Math.PI * 2)}) saturate(1.08)`;
      ctx.drawImage(activeShot.img, offsetX, offsetY, drawWidth, drawHeight);
      ctx.filter = "none";
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, width, height);
      frameIndex += 1;
      if (frameIndex >= totalFrames && !stopped) {
        stopped = true;
        clearInterval(timer);
        recorder.stop();
      }
    };
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      clearInterval(timer);
      resolve("");
    };
    recorder.onstop = () => {
      try {
        const blob = new Blob(chunks, { type: "video/webm" });
        resolve(URL.createObjectURL(blob));
      } catch (_err) {
        resolve("");
      }
    };
    draw();
    recorder.start();
    const timer = setInterval(draw, frameIntervalMs);
  });
}

function getCurrentWatchArtworkModule() {
  return (
    globalThis.resolveWorkCardThumbnailImageModule?.(currentWatchPreviewWork || {}) ||
    resolveWorkCoverImage(currentWatchPreviewWork || {}) ||
    (foryouThumbImage?.src && String(foryouThumbImage.src).trim()) ||
    getCachedWatchFrameModule() ||
    globalThis.currentPreviewFrameDataUrl ||
    (watchSvg?.src && String(watchSvg.src).trim()) ||
    ""
  );
}

async function requestWatchVideoPreviewModule(title, lines, options = {}) {
  if (shouldKeepWatchInMusicModeModule()) {
    openWatchPreviewShellModule({ fallbackTab: "music", restoreAudio: true });
    return;
  }
  if (!watchVideo) return;
  const allowDuringGeneration = options?.allowDuringGeneration === true;
  const generationBusy = !!(
    globalThis.lyricsSeedRequestState?.pending ||
    globalThis.watchPipelineLaunchPending ||
    String(activePipelineRunId || "").trim() ||
    String(pendingFinalAudioRunId || "").trim() ||
    String(currentWatchAudioRunId || "").trim() ||
    globalThis.isCreationBusyModule?.()
  );
  const musicReadyForPreview =
    Number(engineProgressState.music || 0) >= 100 &&
    hasPlayableCurrentWatchAudioModule();
  if (allowDuringGeneration && !musicReadyForPreview) {
    if (watchSubtitle) {
      safeSetWatchSubtitleModule(t("watch.status.requestingMusicEngine"));
    }
    void requestWatchFrameArtworkModule(title, t("watch.status.requestingMusicEngine"), lines);
    return false;
  }
  if (generationBusy && !allowDuringGeneration) {
    if (videoJobPoll) {
      clearInterval(videoJobPoll);
      videoJobPoll = null;
    }
    videoJobId = null;
    watchVideoPreviewRequestPending = false;
    if (watchSubtitle) {
      syncWatchSubtitleForWaitingMediaModule();
    }
    void requestWatchFrameArtworkModule(title, t("watch.status.waitingImage"), lines);
    return false;
  }
  const requestKey = JSON.stringify([
    String(title || state.title || "").trim(),
    Array.isArray(lines) ? lines.filter(Boolean).slice(0, 8) : []
  ]);
  if (
    watchVideoPreviewRequestPending ||
    (requestKey && requestKey === lastWatchVideoPreviewRequestKey && (videoJobPoll || videoJobId))
  ) {
    return;
  }
  if (videoJobPoll) {
    clearInterval(videoJobPoll);
    videoJobPoll = null;
  }
  videoJobId = null;
  watchVideoPreviewRequestPending = true;
  lastWatchVideoPreviewRequestKey = requestKey;
  resetWatchVideoPreviewModule({ preserveArtwork: true });
  const artworkSubtitle = t("watch.status.waitingImage");
  if (watchSubtitle) {
    syncWatchSubtitleForWaitingMediaModule();
  }
  void requestWatchFrameArtworkModule(title, artworkSubtitle, lines);
  const prompt = `${state.style} ${state.voice} cinematic mv`;
  const taskId = `mv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = {
    taskId,
    capability_id: "video.gan.v1",
    inputs: [],
    params: {
      v: 1,
      title,
      prompt,
      duration_sec: 6,
      lyrics: { lines }
    }
  };
  lastRequestedVideoDurationSec = Number(payload?.params?.duration_sec || 0);
  try {
    const res = await fetch("/api/registry/v1/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      return;
    }
    const body = await res.json();
    if (body?.error) {
      return;
    }
    const jobId = body?.job?.id || body?.job?.taskId || body?.id || body?.taskId;
    if (!jobId) {
      return;
    }
    videoJobId = jobId;
    pollWatchVideoJobModule(videoJobId);
  } catch (_err) {
    return;
  } finally {
    watchVideoPreviewRequestPending = false;
  }
}

async function requestWatchFrameArtworkModule(title, subtitle, lines = []) {
  // CSSOS_WAVE_336 20260522 — Jing: (撤销 W334 的"有真封面就跳过"——因为这些作品的
  // cover 是 replicate 临时链接, 已 404 过期, 看着像真 http 其实加载失败 → 跳过占位就
  // 黑屏.) 现在恢复生成"标题卡"占位作为优雅兜底: 封面能加载就盖上真封面, 不能就停在
  // 标题卡, 绝不黑屏. churn 由 W329(首帧确定、幂等)压制.
  const safeTitle = String(title || state.title || loginCopy("CSS MV")).trim();
  const safeSubtitle = String(subtitle || t("watch.status.waitingImage")).trim();
  const safeLines = Array.isArray(lines) ? lines.filter(Boolean).slice(0, 8) : [];
  try {
    const pool =
      (await globalThis.requestThumbnailVariantPool?.(safeTitle, safeSubtitle, safeLines, {
        count: 5,
      })) || [];
    const uniquePool = [...new Set((Array.isArray(pool) ? pool : []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 5);
    if (uniquePool.length) {
      globalThis.currentWatchArtworkVariantPool = uniquePool;
    }
    const image =
      String(uniquePool[0] || "").trim() ||
      (await globalThis.requestThumbnailDataUrl?.(safeTitle, safeSubtitle, safeLines)) ||
      "";
    if (!image) return false;
    setWatchSvgPreviewModule(image);
    syncWatchPlaceholderAfterForyouThumbModule();
    void primeWatchArtworkSlideshowModule(safeTitle, safeSubtitle, safeLines);
    return true;
  } catch (_err) {
    return false;
  }
}

function pollWatchVideoJobModule(jobId) {
  if (!jobId) return;
  let busy = false;
  videoJobPoll = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch(`/api/registry/v1/jobs/${jobId}`);
      if (!res.ok) {
        busy = false;
        return;
      }
      const payload = await res.json();
      if (payload?.error) {
        clearInterval(videoJobPoll);
        videoJobPoll = null;
        busy = false;
        return;
      }
      const job = payload?.job || payload;
      if (job.status === "succeeded") {
        const artifacts = job.artifacts || [];
        const videoArtifact = artifacts.find((item) => item.name === "video_preview.mp4");
        const svgArtifact = artifacts.find((item) => item.name === "video_preview.svg");
        if (videoArtifact && watchVideo) {
          if (setWatchVideoFromArtifact(videoArtifact.uri, { sourceKind: "job-artifact" })) {
            attemptWatchVideoPlaybackModule({ allowFallback: false });
          }
          safeSetWatchSubtitleModule(watchSubtitleLabelModule("preview"));
        } else {
          safeSetWatchSubtitleModule(watchSubtitleLabelModule("ready"));
        }
        clearInterval(videoJobPoll);
        videoJobPoll = null;
      } else if (job.status === "failed") {
        safeSetWatchSubtitleModule(watchSubtitleLabelModule("failed"));
        clearInterval(videoJobPoll);
        videoJobPoll = null;
      }
    } catch (_err) {
      // keep polling
    } finally {
      busy = false;
    }
  }, 1200);
}

async function openWatchPreviewFlowModule({
  preferredTab = "",
  clearLimit = true,
  tryRegistry = false,
  showEmptyToast = false,
  allowDemoFallback = false,
  preferLatestOwned = false
} = {}) {
  // CSSOS_WAVE_269 20260521 — Jing 根因修复(打开 watch 即冻死主线程): 这个流程
  // 存在互相递归 —— openWatchPreviewFlowModule → openLatestOwnedWorkPreviewModule
  // → renderMarketWorkPreviewIntoWatchModule → (尾部又) openWatchPreviewFlowModule
  // (watch-ui:10367). async/await 互递归 = 微任务洪流, rAF 完全饿死、CPU 烧满 →
  // 打开 watch / autoplay 一进来就冻、什么都点不了 (断路器实测此函数被调 390 次).
  // 重入护栏: 同一突发内若已在跑则直接返回, 打断递归; setTimeout(0) 在本轮
  // 微任务全部排空后清标志, 之后用户正常开/切歌不受影响 (只挡同步重入).
  if (globalThis.__cssosWatchFlowInFlight) return false;
  globalThis.__cssosWatchFlowInFlight = true;
  setTimeout(() => { globalThis.__cssosWatchFlowInFlight = false; }, 0);
  // CSSOS_PHASE2_PIPELINE_RESULT_LOCK 20260426 #137 — Jing
  // If MV Pipeline panel just finished a run, ALWAYS prefer playing that
  // result over kicking off any new legacy creative-engine pipeline. The
  // result is published as `globalThis.cssmvPipelineLastResult` with a
  // timestamp + freshness window. This single guard collapses every
  // "万能入口" (logo / mic / play / right-click / Apply Render / etc.)
  // into the same "play the freshly-composed MV" behaviour.
  try {
    const lastRes = globalThis.cssmvPipelineLastResult;
    if (lastRes && lastRes.mvUrl) {
      const tsAt = Number(lastRes.tsAt || 0);
      const freshMs = Number(lastRes.freshMs || 600000);
      if (tsAt && (Date.now() - tsAt) < freshMs) {
        // Adopt the result. Push the URL into <video>, switch tab, attempt
        // playback. NO creative-engine kickoff.
        if (clearLimit) clearWatchPreviewLimit();
        if (preferredTab) activateWatchTab(resolvePreferredWatchOpenTab(preferredTab));
        if (typeof setWatchVideoFromArtifact === "function") {
          setWatchVideoFromArtifact(lastRes.mvUrl, { sourceKind: "mv-pipeline-final" });
        }
        if (typeof activateWatchTab === "function" && (!preferredTab || preferredTab === "mv")) {
          activateWatchTab("mv");
        }
        if (typeof attemptWatchVideoPlaybackModule === "function") {
          attemptWatchVideoPlaybackModule({ allowFallback: true });
        }
        console.info(
          "[watch-ui] adopted fresh MV Pipeline result (age %dms): %s",
          Date.now() - tsAt,
          String(lastRes.mvUrl).slice(0, 96) + "…"
        );
        return true;
      }
    }
  } catch (_e) { /* fall through to legacy path */ }

  const creationBusy = !!globalThis.isCreationBusyModule?.();
  const lyricsPending = !!globalThis.lyricsSeedRequestState?.pending;
  const seedPreparing = hasBlockingWatchSeedModule();
  const sourceRunId = String(currentWatchPreviewWork?.source_run_id || "").trim();
  const currentRunLocked = !!String(
    currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || sourceRunId || ""
  ).trim();
  if (sourceRunId && !String(currentWatchAudioRunId || "").trim()) {
    currentWatchAudioRunId = sourceRunId;
  }
  if (clearLimit) {
    clearWatchPreviewLimit();
  }
  if (preferredTab) {
    activateWatchTab(resolvePreferredWatchOpenTab(preferredTab));
  }
  if (creationBusy || lyricsPending || seedPreparing || currentRunLocked) {
    openWatchPreviewShellModule({ fallbackTab: preferredTab || "mv" });
    syncWatchPlaceholderFromCurrentState();
    return false;
  }
  if (preferLatestOwned) {
    const openedLatest = await openLatestOwnedWorkPreviewModule();
    if (openedLatest) {
      if (preferredTab === "music") {
        openWatchMusicPlaybackSurfaceModule({ autoplay: true });
      } else {
        attemptWatchVideoPlaybackModule({ allowFallback: false });
      }
      return true;
    }
  }
  const usedCurrent = await ensureWatchPanelPreviewPlayback();
  if (usedCurrent) return true;
  if (!preferLatestOwned) {
    const openedLatest = await openLatestOwnedWorkPreviewModule();
    if (openedLatest) {
      if (preferredTab === "music") {
        openWatchMusicPlaybackSurfaceModule({ autoplay: true });
      } else {
        attemptWatchVideoPlaybackModule({ allowFallback: false });
      }
      return true;
    }
  }
  if (tryRegistry) {
    const registryOk = await openLatestRegistryPreviewInWatch();
    if (registryOk) return true;
  }
  const demoOk = allowDemoFallback ? await playWatchPanelDemoFallback() : false;
  if (!demoOk && showEmptyToast) {
    showToast(watchToastCopyModule("videoPending"));
  }
  return demoOk;
}

function refreshWatchPresentationFromSettingsModule(seed = state.songSeed) {
  if (watchTabButtons.length) {
    activateWatchTab(watchActiveTab);
  }
  renderSongSeedPreviewModule(seed);
}

function syncWatchPlaceholderAfterForyouThumbModule() {
  if (!shouldUseEffectiveWatchPreviewVideo()) {
    syncWatchPlaceholderFromCurrentState();
  }
}

function syncWatchMusicArtworkModule() {
  if (!watchMusicStage) return;
  const variantPool = Array.isArray(globalThis.currentWatchArtworkVariantPool)
    ? globalThis.currentWatchArtworkVariantPool
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];
  const dedupedPool = [...new Set(variantPool)];
  const frameArtwork = String(
    globalThis.currentResolvedWatchArtworkDataUrl ||
      globalThis.currentPreviewFrameDataUrl ||
      dedupedPool[0] ||
      foryouThumbImage?.src ||
      watchSvg?.src ||
      ""
  ).trim();
  const stageCandidates = dedupedPool.filter((item) => item && item !== frameArtwork);
  const stageArtwork = String(
    stageCandidates[0] ||
    dedupedPool[1] ||
    frameArtwork ||
    getCurrentWatchArtworkModule() ||
    ""
  ).trim();
  const discCandidates = dedupedPool.filter((item) => item && item !== frameArtwork && item !== stageArtwork);
  const discArtwork = String(
    discCandidates[0] ||
    (stageArtwork !== frameArtwork ? frameArtwork : "") ||
    stageArtwork ||
    ""
  ).trim();
  // CSSOS_WAVE_320 20260521 — Jing: 背景/封面层走缩放代理(全屏背景 w=800, 多为模糊)
  // → 首帧不必等 1.3MB 全图. data: URL 由 cssosThumb 原样放行.
  const _thumb = (typeof globalThis.cssosThumb === "function") ? globalThis.cssosThumb : (u) => u;
  const stageT = _thumb(stageArtwork, 800);
  const discT = _thumb(discArtwork, 800);
  const frameT = _thumb(frameArtwork, 800);
  const stageSafe = stageT ? `url("${String(stageT).replace(/"/g, '\\"')}")` : "none";
  const discSafe = discT ? `url("${String(discT).replace(/"/g, '\\"')}")` : stageSafe;
  const frameSafe = frameT ? `url("${String(frameT).replace(/"/g, '\\"')}")` : stageSafe;
  watchMusicStage.style.setProperty("--watch-music-backdrop-image", stageSafe);
  watchMusicStage.style.setProperty("--watch-music-art-image", discSafe);
  watchScreen?.style.setProperty("--watch-frame-art-image", frameSafe);
  watchScreenBackdrop?.style.setProperty("background-image", frameSafe);
  document.getElementById("watch-music-art")?.style.setProperty("background-image", discSafe);
  // CSSOS_WAVE_320 — 给视频元素一个 poster(用缩略图), 解码前先有画面, 不再黑屏.
  try {
    if (frameArtwork && !String(frameArtwork).startsWith("data:") && watchVideo && !watchVideo.getAttribute("poster")) {
      watchVideo.setAttribute("poster", _thumb(frameArtwork, 600));
    }
  } catch (_e) { /* noop */ }
  if (watchMusicArtBlur) {
    watchMusicArtBlur.checked = localStorage.getItem(WATCH_MUSIC_ART_BLUR_KEY) === "true";
    syncWatchMusicArtworkBlurModule();
  }
  if (
    stageArtwork &&
    stageArtwork !== lastWatchArtworkPreloadSrc &&
    !String(stageArtwork).startsWith("data:image/")
  ) {
    lastWatchArtworkPreloadSrc = stageArtwork;
    const preload = new Image();
    preload.decoding = "async";
    preload.src = stageArtwork;
  }
}

function playWatchAudioPreviewFromStartModule(options = {}) {
  if (
    watchAudioPreview &&
    String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim().startsWith("data:audio/") &&
    getRememberedWatchFinalAudio()
  ) {
    restoreRememberedWatchFinalAudio({ preservePlayback: true });
  }
  if (
    watchAudioPreview &&
    (!String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim() ||
      String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim().startsWith("data:audio/")) &&
    !getRememberedWatchFinalAudio() &&
    !globalThis.isCreationBusyModule?.()
  ) {
    currentWatchAudioSourceKind = "none";
  }
  if (!watchAudioPreview || watchAudioPreview.style.display === "none" || !watchAudioPreview.src) {
    updateWatchAudioDebug();
    return false;
  }
  watchAudioPreview.autoplay = true;
  watchAudioPreview.playsInline = true;
  if (options?.preserveCurrentTime !== true) {
    try {
      watchAudioPreview.currentTime = 0;
    } catch (_err) {
      // ignore seek errors
    }
  }
  const playPromise = watchAudioPreview.play?.();
  if (!playPromise || typeof playPromise.then !== "function") return true;
  playPromise
    .then(() => {
      watchAudioAutoplayArmed = true;
      if (currentWatchAudioSourceKind === "final-artifact" && watchAudioPreview.muted) {
        window.setTimeout(() => {
          watchAudioPreview.muted = false;
          watchAudioPreview.volume = 1;
          updateWatchAudioDebug();
        }, 180);
      }
    })
    .catch(() => {});
  syncWatchMusicStateModule();
  enforceWatchPreviewLimit();
  updateWatchAudioDebug();
  return true;
}

function openWatchMusicPlaybackSurfaceModule({ clearLimit = false, autoplay = false } = {}) {
  if (clearLimit) {
    clearWatchPreviewLimit();
  }
  openWatchPreviewShellModule({ fallbackTab: "music" });
  if (!autoplay) return true;
  const preserveCurrentTime =
    !!String(watchAudioPreview?.currentSrc || watchAudioPreview?.src || "").trim() &&
    Number.isFinite(Number(watchAudioPreview?.currentTime || 0)) &&
    Number(watchAudioPreview?.currentTime || 0) > 0 &&
    !!watchAudioPreview?.paused &&
    !watchAudioPreview?.ended;
  if (playWatchAudioPreviewFromStartModule({ preserveCurrentTime })) return true;
  const retryPlay = () => {
    watchAudioPreview?.removeEventListener("canplay", retryPlay);
    playWatchAudioPreviewFromStartModule({ preserveCurrentTime });
  };
  watchAudioPreview?.addEventListener("canplay", retryPlay, { once: true });
  return false;
}

function openCreationShowcasePanelsModule(options = {}) {
  [foryouPanel, lyricsPanel, musicPanel, videoPanel, watchPanel]
    .filter(Boolean)
    .forEach((panel) => openPanel(panel, { focus: false, layout: false }));
  if (options.focusTop !== false && watchPanel) {
    focusPanel(watchPanel);
  }
  /* W333 — page-load auto-open: enter cinema layout + pre-paint title/cover
   * + trigger auto-play of latest owned work (deferred so panels render first). */
  try {
    if (typeof globalThis.cssosEnterCinemaLayout === "function") {
      globalThis.cssosEnterCinemaLayout();
    }
  } catch (_e) {}
  prePaintLatestWorkOnPanelOpenModule();
  requestAnimationFrame(() => {
    void openWatchPreviewFlowModule({
      preferLatestOwned: true,
      preferredTab: "mv",
      clearLimit: true,
    });
  });
  layoutShowcasePanels();
}

function openMinimalCreationResultSurfaceModule(options = {}) {
  const hiddenPanels = [
    foryouPanel,
    lyricsPanel,
    musicPanel,
    videoPanel,
    cssmvPanel,
  ].filter(Boolean);
  hiddenPanels.forEach((panel) => {
    panel.classList.add("hidden");
  });
  updateDockVisibility?.();
  if (watchPanel) {
    openPanel(watchPanel, { focus: options.focus !== false, layout: false });
    activateWatchTab(resolvePreferredWatchOpenTab(options.preferredTab || "mv"));
    ensureWatchCentered();
  }
  layoutShowcasePanels();
}

function ensureCreationAdvancedSettingsAccessModule() {
  try {
    if (typeof authState !== "undefined" && authState?.user) return true;
  } catch (_err) {
    // ignore lookup errors
  }
  if (globalThis.authState?.user) return true;
  if (typeof openLoginForCreation === "function") {
    openLoginForCreation(
      loginCopy(
        "Sign in first to open advanced settings."
      )
    );
  } else {
    showToast?.(
      loginCopy(
        "Sign in first to open advanced settings."
      )
    );
    openPanel?.(loginPanel);
  }
  return false;
}

function openCreationAdvancedSettingsPanelModule() {
  if (!ensureCreationAdvancedSettingsAccessModule()) return false;
  if (!settingsPanel) return;
  openPanel(settingsPanel, { focus: true, layout: false });
  if (advancedPanelSettings?.hidden) {
    advancedPanelSettings.hidden = false;
    advancedPanelSettingsToggle?.classList.add("is-active");
    void renderAdvancedPanelSettings({ force: true, deferHeavy: true });
  } else if (advancedPanelSettings?.dataset?.needsRender === "true") {
    void renderAdvancedPanelSettings({ force: true, deferHeavy: true });
  }
  focusPanel(settingsPanel);
  globalThis.bringPanelToFrontBridge?.(settingsPanel, { repeatPasses: 3 });
  advancedPanelSettings?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  layoutShowcasePanels();
  return true;
}

function resolveCreationSurfaceModeModule(origin = "logo") {
  const behavior = readPanelBehaviorSettingsLocal();
  const micBehavior = behavior?.mic || {};
  if (origin === "dock") return micBehavior.dock_surface_mode || "mv_only";
  if (origin === "settings") return micBehavior.settings_surface_mode || micBehavior.logo_surface_mode || "mv_only";
  return micBehavior.logo_surface_mode || "mv_only";
}

function showCreationSurfaceModule(origin = "logo") {
  const mode = resolveCreationSurfaceModeModule(origin);
  globalThis.currentCreationSurfaceOrigin = origin;
  globalThis.currentCreationSurfaceMode = mode;
  if (mode === "mv_only") {
    openMinimalCreationResultSurfaceModule({
      preferredTab: "mv"
    });
    syncWatchGenerationVisibilityModule();
    return;
  }
  openCreationShowcasePanelsModule();
  syncWatchGenerationVisibilityModule();
}

function syncWatchGenerationVisibilityModule() {
  const showGenerationFlow = readPanelBehaviorSettingsLocal()?.watch?.show_generation_flow === true;
  if (watchPanel) {
    watchPanel.dataset.showGenerationFlow = showGenerationFlow ? "true" : "false";
  }
  ["lyrics", "music", "video", "kara"].forEach((engine) => {
    const shell = getEngineProgressShellModule(engine);
    if (!shell) return;
    shell.hidden = !showGenerationFlow;
    shell.classList.remove("is-fading");
  });
  syncWatchEngineGridModule();
}

Object.assign(globalThis, {
  isWatchLyricsReadyModule,
  getNextWatchGenerationGapModule,
  resolveWatchRecoveryStageModule,
  autoRecoverWatchStageModule,
  syncWatchSubtitleForWaitingMediaModule,
  handleWatchPlaybackSurfaceClickModule: handleWatchPlaybackSurfaceClick,
  invokeUniversalCreationEntryModule,
  regenerateLyricsForWatchModule,
  restartWatchGenerationFromCurrentLyricsModule,
  activateWatchTab,
  openMinimalCreationResultSurfaceModule,
  openCreationShowcasePanelsModule,
  openCreationAdvancedSettingsPanelModule,
  openOptimizationPanelModule: openCreationAdvancedSettingsPanelModule,
  stopWatchPanelPlaybackModule,
  resolveCreationSurfaceModeModule,
  showCreationSurfaceModule,
  syncWatchGenerationVisibilityModule,
  getCurrentInFlightWatchRunIdModule,
  findActiveBackgroundRunIdForCurrentWorkModule,
  initWatchImmersiveScrollModule,
  syncWatchMusicArtworkBlurModule,
  syncWatchMusicArtworkModule,
  requestWatchFrameArtworkModule,
  showWatchFramePlaceholderModule,
  cacheWatchFrameModule,
  submitWatchCommentModule,
  ensureWatchCentered,
  openWatchPreviewFlowModule,
  showCreationSurface: showCreationSurfaceModule
});

function primeZeroThresholdAudioPreviewModule(seedLike = {}) {
  if (!watchAudioPreview) return false;
  if (restoreRememberedWatchFinalAudio({ preservePlayback: true })) {
    return openWatchMusicPlaybackSurfaceModule({ autoplay: true });
  }
  watchAudioAutoplayArmed = true;
  return false;
}

async function tryAttachDemoAudioFallbackModule({ autoplay = false, allowDemoFallback = false } = {}) {
  return false;
}

function renderSongSeedPreviewModule(seed = state.songSeed) {
  if (!currentWatchPreviewWork) {
    renderWatchCommerceActionsModule(null);
  }
  const summary =
    globalThis.buildSeedPreviewSummaryModule?.(seed) || { compact: "", watch: "" };
  renderCreationUniverseCard(seed);
  const compactSummary =
    summary.compact ||
    String(seed?.creativeSummary?.compact || "").trim() ||
    String(foryouStyle?.textContent || "").trim();
  applyWatchTypographyPresetModule(
    pickWatchTypographyPresetModule(
      `${seed?.title || state.title || ""}|${seed?.musicStyle || ""}|${seed?.lyrics || ""}`
    )
  );
  if (foryouSeedCopy) {
    foryouSeedCopy.textContent = compactSummary;
    foryouSeedCopy.style.display = compactSummary ? "block" : "none";
  }
  if (watchSeedCopy) {
    const musicSummary = [
      String(seed?.musicStyle || "").trim(),
      String(seed?.musicStructure || "").trim(),
      compactSummary
    ]
      .filter(Boolean)
      .join(" · ");
    watchSeedCopy.textContent = musicSummary;
    watchSeedCopy.style.display = musicSummary ? "block" : "none";
  }
  syncWatchPlaceholderFromCurrentState();
  const creationBusy = !!globalThis.isCreationBusyModule?.();
  const lyricsRequestPending = !!globalThis.lyricsSeedRequestState?.pending;
  if (watchAudioPreview) {
    if (restoreRememberedWatchFinalAudio()) {
      watchAudioPreview.style.display = "block";
    } else if (creationBusy || lyricsRequestPending) {
      watchAudioPreview.pause?.();
      watchAudioPreview.removeAttribute("src");
      watchAudioPreview.load?.();
      watchAudioPreview.style.display = "none";
      if (currentWatchAudioSourceKind !== "final-artifact") {
        currentWatchAudioSourceKind = "none";
      }
      currentWatchAudioRunError = "";
      updateWatchAudioDebug();
      syncWatchAudioPresentation();
    } else if (currentWatchAudioSourceKind !== "final-artifact") {
      watchAudioPreview.pause?.();
      watchAudioPreview.removeAttribute("src");
      watchAudioPreview.load?.();
      watchAudioPreview.style.display = "none";
      currentWatchAudioSourceKind = "none";
      currentWatchAudioRunError = "";
      updateWatchAudioDebug();
      syncWatchAudioPresentation();
    }
  }
  syncWatchMusicArtworkModule();
  syncWatchMusicStateModule();
  if (seed && zeroThresholdAutoplayRequested && !creationBusy) {
    openWatchPreviewShellModule({ fallbackTab: "music" });
    playWatchAudioPreviewFromStartModule();
    zeroThresholdAutoplayRequested = false;
  }
  syncWatchEditorsFromSettingsModule();
  renderWatchMetaPanelsModule();
  renderForyouStructure(seed);
  const seedTitle = String(titleInput?.value || state.title || seed?.title || "").trim();
  const seedLines = compactLyricLines(
    String(
      lyricsInput?.value ||
      watchLyricsEditor?.value ||
      (Array.isArray(state.lines) ? state.lines.join("\n") : "") ||
      seed?.lyrics ||
      ""
    ).split("\n")
  ).filter(Boolean);
  if (seedTitle) {
    state.title = seedTitle;
    try { globalThis.cssmvRenderMvArtTitle?.(seedTitle); } catch (_err) {}
  }
  if (seedLines.length) {
    const shouldHydrateLyricsSurface =
      !isWatchLyricsReadyModule() ||
      !String(lyricsEl?.textContent || "").trim() ||
      String(lyricsEl?.textContent || "").trim().length < 12;
    if (shouldHydrateLyricsSurface) {
      refreshLyricsPresentation(seedTitle || state.title, seedLines);
    }
  }
  if (creationBusy || lyricsRequestPending) {
    void primeWatchArtworkSlideshowModule(
      seedTitle || state.title || watchBrandTitleModule(),
      String(seed?.musicStyle || compactSummary || t("watch.subtitle.waitingLyricsSeed")).trim(),
      seedLines
    );
  } else {
    clearWatchArtworkSlideshowModule();
  }
  if (seedTitle && seedLines.length) {
    void requestWatchFrameArtworkModule(
      seedTitle,
      seed?.musicStyle || t("watch.status.waitingImage"),
      seedLines
    );
  }
  if (seedTitle && seedLines.length) {
    void globalThis.requestForyouThumbnail?.(
      seedTitle,
      String(seed?.musicStyle || seed?.creativeSummary?.compact || "").trim(),
      seedLines
    );
  }
  syncWatchMusicArtworkModule();
  if (
    seed?.title &&
    !hasEffectivePreviewVideo() &&
    !String(foryouThumbImage?.src || "").trim() &&
    !String(globalThis.currentResolvedWatchArtworkDataUrl || "").trim()
  ) {
    void requestWatchFrameArtworkModule(
      seed.title,
      seed?.musicStyle || t("watch.status.waitingImage"),
      compactLyricLines(String(seed.lyrics || "").split("\n"))
    );
  }
}

async function renderMarketWorkPreviewIntoWatchModule({
  work = null,
  seed = {},
  previewUnlimited = false
} = {}) {
  // CSSOS_WAVE_121 20260513 — work-id-binding hard contract.
  // EVERY entry into the watch render path MUST bind the work_id first
  // so cached frames / fallback thumbs from the previous work get
  // flushed before this work's assets are drawn. Prevents 张冠李戴.
  try {
    if (work && typeof globalThis.cssosBindToWorkId === "function") {
      globalThis.cssosBindToWorkId(work);
    }
  } catch (_e) {}
  openWatchPreviewShellModule({ fallbackTab: "mv" });
  clearWatchPreviewLimit();
  renderSongSeedPreviewModule(seed);
  renderWatchCommerceActionsModule(work);
  if (watchLyricsEditor) {
    watchLyricsEditor.value =
      globalThis.buildCanonicalLyricsWithTitleModule?.(
        seed.title || work?.title || state.title || "",
        seed.lyrics || "",
      ) || String(seed.lyrics || "").trim();
  }
  if (watchOutlineEditor) watchOutlineEditor.value = seed.videoOutline || "";
  if (watchScriptEditor) {
    watchScriptEditor.value = Array.isArray(seed.sectionPrompts)
      ? seed.sectionPrompts.map((item) => `${item.section}\n${item.prompt}`).join("\n\n")
      : "";
  }
  if (watchCommentsCopy) {
    watchCommentsCopy.textContent = loginCopy(
      previewUnlimited
        ? "Privileged preview. Full playback is available for admin, VIP, or the work owner."
        : "Buyer preview only. Playback stops at 30 seconds until the full release is unlocked."
    );
  }
  renderWatchCommentsModule();
  const creator = String(work?.owner_name || work?.owner_email || "Creator").trim() || "Creator";
  if (watchOwnershipCopy) {
    watchOwnershipCopy.textContent = loginCopy(
      `Previewing ${seed.title} by ${creator}. Purchase listen or buyout to unlock the commerce flow.`
    );
  }
  const subtitle = previewUnlimited
    ? loginCopy("Privileged preview · Full access")
    : loginCopy("Buyer preview · 30s max");
  const artworkImage = String(
    work?.cover_image ||
      work?.preview_image_url ||
      globalThis.resolveWorkCardThumbnailImageModule?.(work) ||
      ""
  ).trim();
  if (artworkImage) {
    setWatchSvgPreviewModule(artworkImage);
  }
  safeSetWatchSubtitleModule(subtitle);
  if (!previewUnlimited) {
    setWatchPreviewLimit(
      MARKET_WATCH_PREVIEW_LIMIT_SEC,
      loginCopy("Preview ended at 30 seconds.")
    );
  }
  // W343 20260523 — Jing: openWatchPreviewFlowModule 在此处的递归调用会被
  // __cssosWatchFlowInFlight 护栏拦截(返回 false), 导致视频 URL 永远不被加载.
  // 修复: 直接把 work.preview_video_url 推入 <video>, 不经由递归流程.
  // openWatchPreviewFlowModule 仅作保底(非递归场景, 比如直接从 UI 点击).
  const _pvUrl = String(work?.preview_video_url || work?.final_mv_url || "").trim();
  if (_pvUrl && typeof setWatchVideoFromArtifact === "function") {
    setWatchVideoFromArtifact(_pvUrl, { sourceKind: "market-preview" });
    if (typeof activateWatchTab === "function") activateWatchTab("mv");
    if (typeof attemptWatchVideoPlaybackModule === "function") {
      attemptWatchVideoPlaybackModule({ allowFallback: true });
    }
  } else {
    await openWatchPreviewFlowModule({ preferredTab: "mv", clearLimit: false });
  }
  if (watchSubtitle && watchSubtitle.textContent && !watchSubtitle.textContent.includes("30")) {
    safeSetWatchSubtitleModule(subtitle);
  }
}

function syncWatchPlaceholderFromCurrentState() {
  const persistedCoverImage = String(resolveWorkCoverImage(currentWatchPreviewWork || {}) || "").trim();
  if (persistedCoverImage && !isSyntheticWorkCoverImage(persistedCoverImage)) {
    clearWatchFrameLoopModule();
    setForyouBackgroundImage(persistedCoverImage);
    return showWatchFramePlaceholderModule(persistedCoverImage);
  }
  const cachedSequence = globalThis.currentPreviewFrameSequence.length
    ? globalThis.currentPreviewFrameSequence
    : getCachedWatchFrameSequenceModule();
  if (cachedSequence.length) {
    showWatchFramePlaceholderModule(cachedSequence[0]);
    startWatchFrameLoopModule(cachedSequence);
    return true;
  }
  const cachedFrame = globalThis.currentPreviewFrameDataUrl || getCachedWatchFrameModule();
  if (cachedFrame) {
    clearWatchFrameLoopModule();
    return showWatchFramePlaceholderModule(cachedFrame);
  }
  const resolvedArtwork = String(globalThis.currentResolvedWatchArtworkDataUrl || "").trim();
  if (resolvedArtwork) {
    clearWatchFrameLoopModule();
    setForyouBackgroundImage(resolvedArtwork);
    return showWatchFramePlaceholderModule(resolvedArtwork);
  }
  const imageSrc = foryouThumbImage?.src || "";
  if (imageSrc) {
    clearWatchFrameLoopModule();
    setForyouBackgroundImage(imageSrc);
    return showWatchFramePlaceholderModule(imageSrc);
  }
  clearWatchFrameLoopModule();
  if (watchSvg) {
    watchSvg.style.display = "none";
    watchSvg.removeAttribute("src");
    watchSvg.setAttribute("alt", "");
  }
  if (watchScreenBackdrop) {
    watchScreenBackdrop.style.backgroundImage = "";
  }
  return false;
}
const buildExampleAssetProxyUrl = (name) => {
  const safeName = String(name || "").trim();
  if (!safeName) return "";
  return `/api/example-assets/blob?name=${encodeURIComponent(safeName)}`;
};

globalThis.getForyouPreviewModeModule = getForyouPreviewModeModule;
globalThis.buildForyouThumbSvgModule = buildForyouThumbSvgModule;
globalThis.buildForyouThumbSvg = globalThis.buildForyouThumbSvg || buildForyouThumbSvgModule;
globalThis.syncForyouThumbFromLyricsModule = syncForyouThumbFromLyricsModule;
globalThis.stopWatchBackgroundWorkModule = stopWatchBackgroundWorkModule;

// CSSOS_PHASE2_FONT_CATALOG_EXPOSURE 20260420 #83
// Non-module scripts hoist function declarations globally, but `globalThis.X`
// access isn't guaranteed on all engines — expose explicitly so
// app.watch-media-overlays.js per-token font picker can reach them.
globalThis.buildWatchFontCatalogModule = buildWatchFontCatalogModule;
globalThis.buildWatchSelectableFontOptionsModule = buildWatchSelectableFontOptionsModule;
globalThis.classifyWatchFontGroupModule = classifyWatchFontGroupModule;
globalThis.pickWatchRandomFontModule = pickWatchRandomFontModule;
