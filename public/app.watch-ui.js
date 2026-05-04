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
// Proactive mobile/Tesla autoplay fallback: these browsers block auto-video-with-sound.
// If the user hasn't explicitly picked a tab (or only picked MV) and we're on such an environment,
// open on Music tab so audio-first UX works without requiring a second tap.
try {
  const __ua = String(navigator?.userAgent || "").toLowerCase();
  const __hint = navigator?.userAgentData?.mobile;
  const __isMobile = (typeof __hint === "boolean" ? __hint : false)
    || /iphone|ipod/.test(__ua)
    || /ipad/.test(__ua)
    || (/android/.test(__ua) && /mobile|tablet/.test(__ua))
    || /blackberry|bb10|meego|mobile|silk|webos|opera mini|opera mobi|windows phone/.test(__ua)
    || (/macintosh/.test(__ua) && typeof navigator?.maxTouchPoints === "number" && navigator.maxTouchPoints > 1);
  const __isTesla = __ua.includes("tesla") || __ua.includes("qtcarbrowser");
  if ((__isMobile || __isTesla) && (watchActiveTab === "mv" || !watchActiveTab)) {
    watchActiveTab = "music";
  }
} catch (_err) {
  // userAgent access errored — keep whatever the storage said.
}
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
  "AQUARIUM", "Alien", "Andromeda", "AvocadoDiet",
  "Bagsman", "BackToSchool", "Backrush", "Battur", "Beauty",
  "BoldnessRace", "Brogetta",
  "CSSTitleBoldA", "CSSTitleBoldB", "CSSTitleBoldC",
  "CharlieKayden", "ChristmasQueen", "Coventysh", "Cuningham",
  "CyberGothic", "Cyberion",
  "DELMANOMORELLI", "DarkFalcon", "DiamondFlower",
  "Display-Magazine-2", "Display-Magazine-3", "Draco",
  "Energetic Script", "Firebreak", "Frasell", "Fuel Injection",
  "GoldenBrick", "GoodHood", "GreenHome",
  "HFWhale", "HiJack", "Honeybears", "Hypeblox",
  "IronHorse",
  "Jacob and son",
  "LightenUp", "LocalBreweryTwo",
  "Maleficent", "Marchell", "Meghatone", "Moon Charming", "Munich",
  "MySunshine",
  "Nature Green", "Northline",
  "Orbitron",
  "Pandemi", "Photogenics", "Polonium", "Polonium Bold",
  "Qualitative", "Qualy Bold", "Quickstep",
  "Rainbow", "Realistic", "Rough Owl",
  "Sinethar", "Starshy", "Suffer", "Swansong",
  "TheropodsBold", "TheropodsItalic", "Theropods",
  "Undertones", "Undertow", "Undertow Slab",
  "VILLADICANCE", "Ventus",
  "Wilson", "Winstonia", "Winter",
  // ─── Latin script / signature ────────────────────────────────────
  "AidianSignatureTi", "Alison", "Allianty", "Aurum Script",
  "BarbieScript", "Belianty", "Belinda", "Bellamy", "Berthessa",
  "CastilloSignature", "Cathena",
  "DilanWhemsy",
  "FamousIdol",
  "Hadnich", "HamsleyScript", "Hamsterly",
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
  "AaJianHaoTi-2",
  "AZhuPaoPaoTi-2",
  "ChaoZiSheBeiJianFan-Shan(REEJI-CHAO-BeiMingGBT-Flash)-2",
  "ChaoZiSheFengYunJianFan-Shan(REEJI-CHAO-FengyunGBT-Flash)-2",
  "ChaoZiSheGuoFengHongShuJian-2",
  "ChaoZiSheGuoFengKaiJianFan-Shan(REEJI-CHAO-RuikaiGBT-Flash)-2",
  "ChaoZiSheKanTingLiuJianFan-Shan(REEJI-CHAO-KanTingLiuGBT-Flash)-2",
  "ChaoZiSheLingDuBengTaJianFan-Shan(CHAO-BengtaGBT-Flash)-2",
  "ChaoZiSheLingTuYueYeJianFan-Shan(REEJI-CHAO-HareGBT-Flash)-2",
  "GEETYPEQingKongHeiGB-YanShiBan-ChangGui(GEETYPE-SkyGB-Demo-Reguar)-2",
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

function maybeRenderWatchArtworkSlideshowFrameModule() {
  if (!watchArtworkSlideshowFrames.length) return false;
  let candidates = watchArtworkSlideshowFrames;
  if (watchArtworkSlideshowFrames.length > 1 && lastWatchArtworkSlideshowFrame) {
    candidates = watchArtworkSlideshowFrames.filter((item) => item !== lastWatchArtworkSlideshowFrame);
  }
  const next = candidates[Math.floor(Math.random() * candidates.length)] || watchArtworkSlideshowFrames[0] || "";
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
      maybeRenderWatchArtworkSlideshowFrameModule();
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
  maybeRenderWatchArtworkSlideshowFrameModule();
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
  const directLines = compactLyricLines(Array.isArray(state.lines) ? state.lines : []).filter(Boolean);
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
    watchSubtitle.textContent = "";
    return;
  }
  const activeStage = getActiveWatchProgressCardModule()?.key || "";
  if (globalThis.lyricsSeedRequestState?.pending) {
    watchSubtitle.textContent = getWatchLyricsSeedSubtitleModule();
    return;
  }
  const currentLyricsStatus = String(
    globalThis.summarizeWatchLyricsSeedStatusModule?.() || ""
  ).trim();
  if (currentLyricsStatus && !isWatchLyricsReadyModule()) {
    watchSubtitle.textContent = currentLyricsStatus;
    return;
  }
  if (activeStage === "music") {
    watchSubtitle.textContent = loginCopy("KaraOKe MV · Composing music now");
    return;
  }
  if (activeStage === "video") {
    watchSubtitle.textContent = loginCopy("KaraOKe MV · Rendering video now");
    return;
  }
  if (activeStage === "kara") {
    watchSubtitle.textContent = loginCopy("KaraOKe MV · Rendering subtitle MV now");
    return;
  }
  watchSubtitle.textContent = hasWatchArtworkReadyModule()
    ? loginCopy("KaraOKe MV · Writing the first line now")
    : loginCopy("KaraOKe MV · Painting the cover now");
}

function setWatchPlaybackUiSuppressedModule(suppressed) {
  watchPlaybackUiSuppressed = suppressed === true;
  watchScreen?.classList.toggle("is-playback-clean", watchPlaybackUiSuppressed);
  if (watchPlaybackUiSuppressed) {
    clearWatchArtworkSlideshowModule();
  }
  if (watchSubtitle) {
    if (watchPlaybackUiSuppressed) {
      watchSubtitle.textContent = "";
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

function renderWorkCostBillMarkupModule(work = {}, entries = []) {
  const computeUnits = Math.max(0, Number(work?.compute_units_estimate || 0));
  const computeCost = Math.max(0, Number(work?.compute_cost_cents_estimate || 0));
  const suggestedListen = Math.max(99, Number(work?.suggested_listen_price_cents || 0));
  const suggestedBuyout = Math.max(299, Number(work?.suggested_buyout_price_cents || 0));
  const historyMarkup = renderUsageHistoryMarkupModule(
    getWorkMatchedUsageEventsModule(work, entries),
    loginCopy("This work does not yet have linked billable action rows."),
    4
  );
  return `
    <div class="work-billing-card">
      <div class="work-billing-title">${loginCopy("Work cost bill")}</div>
      <div class="work-billing-grid">
        <div class="work-billing-stat"><span>${loginCopy("Compute")}</span><strong>${escapeHtml(`${computeUnits}u`)}</strong></div>
        <div class="work-billing-stat"><span>${loginCopy("Estimated cost")}</span><strong>${escapeHtml(formatUsdFromCents(computeCost, "$0.00"))}</strong></div>
        <div class="work-billing-stat"><span>${loginCopy("Suggested listen")}</span><strong>${escapeHtml(formatUsdFromCents(suggestedListen, "$0.00"))}</strong></div>
        <div class="work-billing-stat"><span>${loginCopy("Suggested buyout")}</span><strong>${escapeHtml(formatUsdFromCents(suggestedBuyout, "$0.00"))}</strong></div>
      </div>
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

function currentLyricsProgressPercentModule() {
  const requestState = globalThis.lyricsSeedRequestState || {};
  const hasSeedLyrics =
    (globalThis.hasCanonicalLyricsBodyLinesModule?.(
      String(state.songSeed?.title || state.title || "").trim(),
      state.songSeed?.lyrics || watchLyricsEditor?.value || lyricsInput?.value || "",
      2
    ) ?? false);
  if (typingState.completed || isWatchLyricsReadyModule() || hasSeedLyrics) {
    return 100;
  }
  const current = lyricsEl?.textContent?.length || 0;
  if (requestState.pending && !lyricsTargetLength && current <= 0) {
    return 0;
  }
  return lyricsTargetLength ? Math.min(100, (current / lyricsTargetLength) * 100) : 0;
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
        watchSubtitle.textContent = oneLine;
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
      watchSubtitle.textContent = oneLine;
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
  const queue = getLatestOwnedPlaybackQueueModule();
  if (!queue?.items?.length) return false;
  globalThis.currentStructuredWatchQueue = queue;
  const latestWork = queue.items[0];
  currentWatchPreviewWork = latestWork;
  const sourceRunId = String(latestWork?.source_run_id || "").trim();
  if (sourceRunId) currentWatchAudioRunId = sourceRunId;
  await renderMarketWorkPreviewIntoWatchModule({
    work: latestWork,
    seed: buildMarketPreviewSeed(latestWork),
    previewUnlimited: canBypassPreviewLimit(authState.user, latestWork)
  });
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
          watchSubtitle.textContent = reason ||
            (typeof t === "function" ? t("watch.subtitle.composingMv") : "Composing MV…");
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
    watchSubtitle.textContent = reason;
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
  if (watchMusicRing && watchAudioPreview) {
    const duration = Number.isFinite(watchAudioPreview.duration) ? watchAudioPreview.duration : 0;
    const current = Number.isFinite(watchAudioPreview.currentTime) ? watchAudioPreview.currentTime : 0;
    const progress = duration > 0 ? Math.max(0, Math.min(1, current / duration)) : 0;
    watchMusicRing.style.setProperty("--watch-progress", `${Math.round(progress * 360)}deg`);
    watchScreen?.style.setProperty("--watch-frame-border-progress", `${Math.round(progress * 100)}%`);
    watchScreen?.style.setProperty("--watch-frame-border-angle", `${Math.round(progress * 360)}deg`);
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

function ensureWatchCentered() {
  if (!watchPanel) return;
  if (!guardPanelAccess(watchPanel.id)) return;
  const restoredLayout = applyStoredPanelLayout(watchPanel);
  openWatchPanelShellModule(restoredLayout);
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
        // CSSOS_PHASE2_LOOP_LIST_LIMIT 20260504 — Jing
        // "我选择的是循环列表，应该是所有作品循环往复不断播放才对，
        //  可是看看，好像只有 5 首在循环呢?"
        // The express handler defaults to limit=20 (max 100). Without
        // an explicit query string the queue capped at ~10 uniques
        // (after Take 1/Take 2 dedup); users with more works felt the
        // loop "ran out". Ask for the 100 max.
        const mineRes = await fetch("/api/works/mine?limit=100", { credentials: "include" });
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

function applyWatchQueueItemModule(item) {
  if (!item) return;
  __cssosClearPreviewTimer();
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
    // CSSOS_PHASE2_PREVIEW_CAP 20260430 #222 — auto-skip after 30s for
    // not-own works. Server-side permissions still gate the actual play
    // URL; this is a UX timer so the queue keeps moving even if the
    // user has no entitlement on the next item.
    const isOwn = item.is_own === true;
    if (!isOwn) {
      __cssosPreviewTimerId = setTimeout(() => {
        __cssosPreviewTimerId = null;
        try {
          if (typeof globalThis.showToast === "function") {
            globalThis.showToast(
              "30s preview ended — continuing to next MV (upgrade or buy to unlock full playback)."
            );
          }
        } catch (_e) {}
        void watchQueueAdvanceModule(+1);
      }, __CSSOS_PREVIEW_CAP_SECS * 1000);
    }
  } catch (_e) { /* apply best-effort */ }
}

async function watchQueueAdvanceModule(direction = +1, _wrapDepth = 0) {
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
          if (mode === "sequential") globalThis.showToast("End of playlist (顺序播放). 切换到列表循环可继续.");
          else if (mode === "reverse") globalThis.showToast("Start of playlist (倒序播放).");
          else globalThis.showToast("No playable items in the playlist.");
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
      globalThis.showToast("Queue is empty.");
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
        globalThis.showToast("No playable items in the queue right now.");
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
    if (text) out.push({ start_s, end_s, text });
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

let __cssosKaraokeWired = false;
function wireWatchKaraokeLiveOnceModule(videoEl, audioEl) {
  if (__cssosKaraokeWired) return;
  __cssosKaraokeWired = true;

  // Cache: lazily-built timeline per work signature. Recomputed when
  // pipelineState.title or lyrics changes.
  let cachedSig = "";
  let cachedTimeline = []; // [{start_s, end_s, text}]
  let lastIdx = -1;
  let lastSrtFetchSig = "";

  const buildTimeline = (ps) => {
    // Tier 1: engine-emitted aligned_lyrics (Suno per-line timing).
    const aligned = Array.isArray(ps?.alignedLyrics) ? ps.alignedLyrics : null;
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
        .filter((c) => c.text);
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
      .filter((l) => l && !/^\[[^\]]+\]$/.test(l));
    if (!lines.length) return [];
    const each = dur / lines.length;
    return lines.map((text, i) => ({
      start_s: i * each,
      end_s: (i + 1) * each,
      text,
    }));
  };

  const getActiveSourceTime = () => {
    // Prefer the un-muted, currently-playing element.
    const audioPlaying = audioEl && !audioEl.paused && !audioEl.muted;
    const videoPlaying = videoEl && !videoEl.paused && !videoEl.muted;
    if (audioPlaying) return Number(audioEl.currentTime || 0);
    if (videoPlaying) return Number(videoEl.currentTime || 0);
    // Fall back to whichever has the higher currentTime (paused but seeked).
    const at = Number(audioEl?.currentTime || 0);
    const vt = Number(videoEl?.currentTime || 0);
    return Math.max(at, vt);
  };

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
        if (/fire|ignite|burn|rise|shout|chorus|爆|燃|怒|呐喊|轰/.test(t)) return "ignite";
        if (/dream|moon|night|echo|whisper|glow|梦|月|夜|低语|微光/.test(t)) return "resolve";
        if (/grief|lost|alone|tear|shadow|悲|失|孤|泪|影/.test(t)) return "intimate";
        return "";
      };
      const emotion = String(line.emotion || "").trim() || inferEmotion(line.text);
      const emphasis = Number(line.emphasis || 0.5);
      if (sub) {
        sub.textContent = line.text;
        sub.dataset.cssmvOrigin = "karaoke-live";
        sub.dataset.emotion = emotion || "";
        sub.style.setProperty("--karaoke-emphasis", emphasis.toFixed(2));
        // Color hue per emotion — fallback to neutral white.
        const hueMap = {
          ignite: "color-mix(in srgb, #ff7242 70%, white)",
          resolve: "color-mix(in srgb, #79e6ff 70%, white)",
          intimate: "color-mix(in srgb, #c2a4ff 60%, white)",
        };
        sub.style.color = hueMap[emotion] || "rgba(255,255,255,0.96)";
        sub.classList.add("karaoke-active");
        sub.style.transition = "opacity 0.18s ease, transform 0.18s ease, color 0.18s ease";
        sub.style.opacity = "1";
        // Emphasis modulates scale — louder/more emotional lines pop
        // a touch larger, then settle.
        const peakScale = (1.0 + emphasis * 0.06).toFixed(3);
        sub.style.transform = `scale(${peakScale})`;
        setTimeout(() => {
          if (sub.dataset.cssmvOrigin === "karaoke-live") {
            sub.style.transform = "scale(0.98)";
          }
        }, 120);
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
  // Also a low-rate fallback in case timeupdate stalls (some buggy
  // sources emit it sparsely). 250ms is fine — humans don't notice
  // sub-second lag in line transitions.
  setInterval(tick, 250);
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
  // Share — Web Share API (mobile + recent desktop)
  if (typeof navigator.share === "function") {
    actions.push({
      icon: "📤", label: loginCopy("Share", "分享"),
      onClick: async () => {
        try {
          await navigator.share({
            title: ps?.title || "cssOS MV",
            text: `Watch "${ps?.title || ""}" on cssOS`,
            url: window.location.href,
          });
        } catch (e) { console.warn("[share]", e); }
      },
    });
  }
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
            globalThis.showToast("Tap once to start audio (browser limit). It will keep playing for the rest of the queue.");
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
    // Promote the cover image into the slideshow host. cssmvSetCoverSlides
    // accepts an array; feeding it [cover, cover] makes the existing
    // crossfade engine pulse the same image with Ken-Burns gracefully.
    const cover = String(item?.cover_url || item?.cover_image || item?.preview_image_url || "").trim();
    if (cover && typeof globalThis.cssmvSetCoverSlides === "function") {
      // 4 staggered copies → smooth Ken-Burns drift. Real production
      // path would supply 5 distinct AI-gen variations; one image is
      // an acceptable fallback when only one is available.
      globalThis.cssmvSetCoverSlides([cover, cover, cover, cover]);
    }
    // Bump slideshow intensity higher in fallback mode for energy.
    if (typeof globalThis.cssmvSetSlideshowIntensity === "function") {
      globalThis.cssmvSetSlideshowIntensity(0.7);
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
   slides the frame down to sit flush below the title bar. */
#watch-panel.cssmv-cinema .panel-title-bar,
#watch-panel.cssmv-cinema .panel-toolbar,
#watch-panel.cssmv-cinema .watch-toolbar,
#watch-panel.cssmv-cinema #watch-pill-row-bl,
#watch-panel.cssmv-cinema #watch-aspect-pill,
#watch-panel.cssmv-cinema #watch-author-avatar,
#watch-panel.cssmv-cinema #watch-take-toggle {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
#watch-panel.cssmv-cinema.is-hovering .panel-title-bar,
#watch-panel.cssmv-cinema.is-hovering .panel-toolbar,
#watch-panel.cssmv-cinema.is-hovering .watch-toolbar,
#watch-panel.cssmv-cinema.is-hovering #watch-pill-row-bl,
#watch-panel.cssmv-cinema.is-hovering #watch-aspect-pill,
#watch-panel.cssmv-cinema.is-hovering #watch-author-avatar,
#watch-panel.cssmv-cinema.is-hovering #watch-take-toggle {
  opacity: 1;
  pointer-events: auto;
}
/* Full-bleed frame when cinema is active and not hovering: square top
   corners, attached to viewport edges. */
#watch-panel.cssmv-cinema .watch-frame {
  border-radius: 0 !important;
  margin: 0 !important;
  transition: margin 0.25s ease, border-radius 0.25s ease;
}
#watch-panel.cssmv-cinema.is-hovering .watch-frame {
  margin-top: 4px !important; /* slide down a hair to clear title bar */
  border-radius: 8px 8px 0 0 !important;
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

  // Title-overlay flash on the user's font-shuffle interval. Default 60s.
  const flashKaraokeTitle = () => {
    const kar = document.getElementById("watch-karaoke-line");
    if (!kar) return;
    kar.classList.add("karaoke-flash");
    setTimeout(() => kar.classList.remove("karaoke-flash"), 10_000);
  };
  const refreshIntervalMs = (() => {
    try {
      const v = parseInt(localStorage.getItem("cssos.font.shuffle.ms") || "60000", 10);
      return Number.isFinite(v) && v > 5000 ? v : 60000;
    } catch (_e) { return 60000; }
  })();
  setInterval(flashKaraokeTitle, refreshIntervalMs);
  flashKaraokeTitle(); // First flash on open.
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
      const ownerId = String(ps?.ownerId || ps?.owner_id || "").trim();
      const ownerName = String(ps?.ownerName || ps?.owner_name || "").trim();
      const ownerAvatar = String(ps?.ownerAvatarUrl || "").trim();
      avatar.dataset.ownerId = ownerId;
      avatar.title = ownerName ? `By ${ownerName} — click to play their works` : "Unknown author";
      avatar.innerHTML = "";
      if (ownerAvatar) {
        const img = document.createElement("img");
        img.src = ownerAvatar;
        img.alt = ownerName || "author";
        img.style.cssText = "width:100%;height:100%;object-fit:cover;";
        avatar.appendChild(img);
      } else {
        // Fallback: initials.
        const initial = (ownerName || "?").trim().charAt(0).toUpperCase();
        avatar.textContent = initial;
      }
    } catch (_e) {}
  };
  refresh();
  avatar.addEventListener("click", () => {
    try {
      const pl = globalThis.cssosPlaylists;
      if (!pl) return;
      const ownerId = avatar.dataset.ownerId;
      const ownerName = avatar.title.replace(/^By |\s—.*$/g, "").trim() || "Author";
      if (!ownerId) {
        if (typeof globalThis.showToast === "function") globalThis.showToast("Author info unavailable on this work.");
        return;
      }
      // Find or create a synthetic per-author playlist.
      const listId = `author-${ownerId}`;
      const existing = pl.lists().find((l) => l.id === listId);
      if (!existing) {
        // Pull all known items from for-you / mine and filter by owner.
        const seen = new Set();
        const collected = [];
        ["for-you", "mine"].forEach((srcId) => {
          const items = (pl._state?.lists?.[srcId]?.items || []);
          for (const it of items) {
            const id = String(it?.id || "").trim();
            if (!id || seen.has(id)) continue;
            // Only include items by this author. We don't store owner_id
            // on every item right now, so use owner_name match as fallback.
            const matches =
              (it.owner_id && String(it.owner_id) === ownerId) ||
              (it.owner_name && it.owner_name === ownerName);
            if (matches) {
              collected.push(it);
              seen.add(id);
            }
          }
        });
        // Sort newest → oldest.
        collected.sort((a, b) =>
          (Date.parse(String(b?.created_at || "")) || 0) -
          (Date.parse(String(a?.created_at || "")) || 0)
        );
        // Inject into playlists module via the public API.
        const newId = pl.createCustom(`✨ ${ownerName}`);
        // createCustom returns id; mutate items directly through _state.
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
    } catch (e) { console.warn("[author-avatar]", e); }
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

let __cssosImmersivePillWired = false;
function ensureImmersivePillModule() {
  if (__cssosImmersivePillWired) return;
  const row = ensureBottomLeftPillRowModule();
  if (!row) return;
  if (document.getElementById("watch-immersive-pill")) return;
  __cssosImmersivePillWired = true;

  const pill = document.createElement("button");
  pill.id = "watch-immersive-pill";
  pill.type = "button";
  pill.title = "Immersive Environments — Vision Pro / WebXR / cinema fullscreen";
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
        globalThis.showToast("Immersive view unavailable on this browser.");
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
        watchSubtitle.textContent = watchSubtitleLabelModule("preview");
      }
    })
    .catch(() => {
      promptManualWatchPlaybackModule(watchToastCopyModule("autoplayBlocked"));
    });
  return true;
}

async function handleWatchPlaybackSurfaceClick() {
  if (!authState?.user && typeof openLoginForCreation === "function") {
    openLoginForCreation(
      loginCopy(
        "Sign in first to start the one-tap MV flow."
      )
    );
    return;
  }
  armWatchExplicitPreviewIntent();
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
      watchSubtitle.textContent = watchSubtitleLabelModule("preview");
      attemptWatchVideoPlaybackModule({ allowFallback: false });
      return true;
    }
    if (svgArtifact) {
      setWatchSvgPreviewModule(svgArtifact.uri);
      watchSubtitle.textContent = watchSubtitleLabelModule("preview");
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
  watchSvg.src = uri;
  watchSvg.style.display = "block";
  watchSvg.classList.add("glow");
  if (watchVideo) watchVideo.style.display = "none";
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

function useLocalWatchVideoFallbackModule(title, subtitle) {
  if (watchSvg) {
    watchSvg.style.display = "none";
    watchSvg.removeAttribute("src");
    watchSvg.setAttribute("alt", "");
  }
  if (watchScreenBackdrop) {
    watchScreenBackdrop.style.backgroundImage = "";
  }
  currentPreviewVideoIsLocalFallback = true;
  globalThis.currentPreviewVideoDurationSec = 0;
  globalThis.currentPreviewVideoSourceKind = "local-fallback";
  syncWatchSubtitleForWaitingMediaModule();
}

function promptManualWatchPlaybackModule(message) {
  globalThis.watchManualPlayHinted = true;
  if (watchSubtitle) watchSubtitle.textContent = message;
  showToast(message);
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
      watchSubtitle.textContent = t("watch.status.requestingMusicEngine");
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
  const payload = {
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
    const jobId = body?.job?.id || body?.id;
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
      const job = payload?.job || payload;
      if (job.status === "succeeded") {
        const artifacts = job.artifacts || [];
        const videoArtifact = artifacts.find((item) => item.name === "video_preview.mp4");
        const svgArtifact = artifacts.find((item) => item.name === "video_preview.svg");
        if (videoArtifact && watchVideo) {
          if (setWatchVideoFromArtifact(videoArtifact.uri, { sourceKind: "job-artifact" })) {
            attemptWatchVideoPlaybackModule({ allowFallback: false });
          }
          watchSubtitle.textContent = watchSubtitleLabelModule("preview");
        } else {
          watchSubtitle.textContent = watchSubtitleLabelModule("ready");
        }
        clearInterval(videoJobPoll);
        videoJobPoll = null;
      } else if (job.status === "failed") {
        watchSubtitle.textContent = watchSubtitleLabelModule("failed");
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
  const stageSafe = stageArtwork ? `url("${String(stageArtwork).replace(/"/g, '\\"')}")` : "none";
  const discSafe = discArtwork ? `url("${String(discArtwork).replace(/"/g, '\\"')}")` : stageSafe;
  const frameSafe = frameArtwork ? `url("${String(frameArtwork).replace(/"/g, '\\"')}")` : stageSafe;
  watchMusicStage.style.setProperty("--watch-music-backdrop-image", stageSafe);
  watchMusicStage.style.setProperty("--watch-music-art-image", discSafe);
  watchScreen?.style.setProperty("--watch-frame-art-image", frameSafe);
  watchScreenBackdrop?.style.setProperty("background-image", frameSafe);
  document.getElementById("watch-music-art")?.style.setProperty("background-image", discSafe);
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
  if (watchSubtitle) watchSubtitle.textContent = subtitle;
  if (!previewUnlimited) {
    setWatchPreviewLimit(
      MARKET_WATCH_PREVIEW_LIMIT_SEC,
      loginCopy("Preview ended at 30 seconds.")
    );
  }
  await openWatchPreviewFlowModule({ preferredTab: "mv", clearLimit: false });
  if (watchSubtitle && watchSubtitle.textContent && !watchSubtitle.textContent.includes("30")) {
    watchSubtitle.textContent = subtitle;
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
