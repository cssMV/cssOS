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
  // CSSOS_WAVE_818 20260616 — Jing「同一首歌每次幻灯几乎一样」根治(感知层方案 A)。
  // 实情: 帧池本就小(~5 张, 见 localFrames .slice(0,5))。这里给【每一帧】随机化
  // 运镜支点 + 节奏 + 轻微色温, 让同一张底图每次播放的缩放焦点/快慢/色调都不同 →
  // 观感永不重复, 零额外出图成本。仅改 transform-origin / animation-duration /
  // 【静态】filter(不无限动 filter, 合规 compositor-safe 铁律)。背景层不套 filter
  // 以保留其原有模糊。
  try {
    var _ox = (8 + Math.floor(Math.random() * 84)) + "%";
    var _oy = (8 + Math.floor(Math.random() * 84)) + "%";
    var _dur = (6.5 + Math.random() * 6.5).toFixed(1) + "s";          // 6.5–13s 节奏
    if (watchSvg) {
      var _hue = (Math.random() * 16 - 8).toFixed(0);                  // ±8°
      var _sat = (0.93 + Math.random() * 0.18).toFixed(2);            // 0.93–1.11
      var _bri = (0.96 + Math.random() * 0.10).toFixed(2);            // 0.96–1.06
      var _con = (0.97 + Math.random() * 0.09).toFixed(2);
      watchSvg.style.transformOrigin = _ox + " " + _oy;
      watchSvg.style.animationDuration = _dur;
      watchSvg.style.filter = "hue-rotate(" + _hue + "deg) saturate(" + _sat + ") brightness(" + _bri + ") contrast(" + _con + ")";
    }
    if (watchScreenBackdrop) {
      watchScreenBackdrop.style.transformOrigin = (100 - parseFloat(_ox)) + "% " + (100 - parseFloat(_oy)) + "%";
      watchScreenBackdrop.style.animationDuration = _dur;
    }
  } catch (_eKB) {}
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
      // CSSOS_WAVE_646 — 「10 秒后情绪字幕隐藏」根因: 进入沉浸态(自动 enjoy)时这里把字幕
      // 整段清空。但情绪字幕(熟歌词)是演出的一部分, 必须【唱到段落结束】(W640/W644 同一铁律)。
      // 改为: 只清【状态文案】(origin!=='lyric'), 保留正在咬字的情绪字幕, 让它常驻不被沉浸态抹掉。
      if (watchSubtitle.dataset.cssmvOrigin !== "lyric") {
        safeSetWatchSubtitleModule("");
      }
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
  // W346/W347 20260523 — Jing: 三合一修复.
  // BUG A — 乱闪: requestForyouThumbnail 在 arm 之后异步覆盖 pool → 5 张杂图
  //   重新进闪. 修复: 锁池时写时间戳 __cssosWatchArtworkPoolLockedMs;
  //   foryou-seed-preview 覆写路径检测到 < 20s 就跳过.
  // BUG B — 不自动播: resetInactivityTimer(mousemove) 在 10s 期间取消
  //   autoEnjoyArmed → timer 触发但直接 return. 修复: IIFE 拿到作品后立即
  //   调 openLatestOwnedWorkPreviewModule(), 完全绕开 timer.
  // BUG C — 只播一首: openLatestOwnedWorkPreviewModule 拿到 N 首却没有通知
  //   cssosPlaylists → ended 后 next() 返回 null → "End of playlist" toast.
  //   修复: populate("for-you", works) + setActive + seekTo 第一首.
  (async () => {
    try {
      let _latestWork = null;
      let _allWorks = [];
      // 1. 先看 commerce state
      const _q = typeof getLatestOwnedPlaybackQueueModule === "function"
        ? getLatestOwnedPlaybackQueueModule() : null;
      if (_q?.items?.length) {
        _latestWork = _q.items[0];
        _allWorks = _q.items;
      }
      // 2. 没有 → market API (多首)
      if (!_latestWork) {
        const _r = await fetch("/api/works/market?limit=20&offset=0");
        if (_r.ok) {
          const _d = await _r.json();
          const _ws = Array.isArray(_d?.data?.works) ? _d.data.works
            : Array.isArray(_d?.works) ? _d.works : [];
          if (_ws.length) { _latestWork = _ws[0]; _allWorks = _ws; }
        }
      }
      if (!_latestWork) return;
      const _cov = String(
        _latestWork?.cover_image || _latestWork?.cover_url || _latestWork?.preview_image_url || ""
      ).trim();
      // 3. BUG-A: 锁池到单张封面
      if (_cov && !/^data:image\/svg\+xml/i.test(_cov)) {
        globalThis.currentWatchArtworkVariantPool = [_cov];
        globalThis.currentResolvedWatchArtworkDataUrl = _cov;
        globalThis.__cssosWatchArtworkPoolLockedMs = Date.now();
        if (typeof globalThis.showWatchFramePlaceholderModule === "function") {
          globalThis.showWatchFramePlaceholderModule(_cov);
        }
        const _bd = document.getElementById("watch-screen-backdrop");
        if (_bd) {
          const _stable = typeof globalThis.cssosThumb === "function"
            ? globalThis.cssosThumb(_cov, 800) : _cov;
          _bd.style.backgroundImage = `url("${String(_stable).replace(/"/g, '\"')}")`;
          _bd.style.backgroundSize = "cover";
          _bd.style.backgroundPosition = "center";
        }
      }
      // 4. BUG-C: 灌进 cssosPlaylists "for-you" 列表
      try {
        const _pl = globalThis.cssosPlaylists;
        if (_pl && typeof _pl.populate === "function" && _allWorks.length) {
          _pl.populate("for-you", _allWorks);
          _pl.setActive?.("for-you");
          const _fid = String(_latestWork?.id || "").trim();
          if (_fid) _pl.seekTo?.(_fid);
          if (_pl.getMode?.() === "sequential") _pl.setMode?.("loop_all");
        }
      } catch (_pe) { /* non-fatal */ }
      // 5. BUG-B: 立即播放 — 不依赖可被 mousemove 取消的 10s timer
      cancelAutoEnjoyModule();
      const _openedCurrent = await openCurrentGeneratedWatchPlaybackModule({
        autoplay: true, preferVideo: true
      });
      if (_openedCurrent) return;
      await openLatestOwnedWorkPreviewModule();
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
  const suggestedListen = Math.max(69, Number(work?.suggested_listen_price_cents || 0));   // CSSOS_WAVE_1153 — 聆听底价 99→69¢
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
    // CSSOS_WAVE_1001 20260619 — Jing「面板没开/没播放就别工作, 省内存」: watch 面板不可见时,
    // 这个 420ms 的进度/引擎网格/进度环同步全是【没人看的 DOM 写】→ 直接跳过(timer 本身极廉)。
    // 面板可见时(播放或生成中)照常工作。单面板 W999 下被盖的 watch 即 .hidden, 自然歇。
    try {
      var _wp = document.getElementById("watch-panel");
      if ((_wp && _wp.classList.contains("hidden")) || document.hidden) return;
    } catch (_e) {}
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
  //
  // CSSOS_WAVE_428 20260525 — Jing「平台动辄刷新返回主界面, 哪个代码在作妖」根因:
  // 崩溃日志 /api/admin/crash-log 里 112 次(压倒性第一)是
  //   "Uncaught ReferenceError: state is not defined" @ app.watch-ui.js
  //   ← readProgress (app.watch-media-layout-p2100.js) 进度循环每 tick 调用本函数.
  // 这是【热循环里抛未捕获异常】—— 在某些时序(页面切换/卸载/teardown)下 `state`
  // 词法绑定不可达, 整个循环报错刷屏, 拖垮 watch UI、配合 beforeunload 触发"回主界面".
  // 铁律: 热循环函数【永不抛异常】. 这里 (1) 安全取 state(typeof 永不抛), (2) 整体
  // try/catch, 出错返回上次缓存值, 绝不把异常冒泡到 rAF/定时器。
  try {
    var st = (typeof state !== "undefined" && state) ? state : (globalThis.state || {});
    const sig =
      (typingState.completed ? 1 : 0) + "|" +
      String(st.songSeed?.lyrics || "").length + "|" +
      (Array.isArray(st.lines) ? st.lines.length : 0) + "|" +
      (watchLyricsEditor?.value || "").length + "|" +
      (lyricsInput?.value || "").length + "|" +
      (lyricsEl?.textContent?.length || 0) + "|" +
      (lyricsTargetLength || 0) + "|" +
      (globalThis.lyricsSeedRequestState?.pending ? 1 : 0) + "|" +
      String(st.songSeed?.title || st.title || "").length;
    if (__cssosLyricsPctCache.sig === sig) return __cssosLyricsPctCache.val;
    const requestState = globalThis.lyricsSeedRequestState || {};
    const hasSeedLyrics =
      (globalThis.hasCanonicalLyricsBodyLinesModule?.(
        String(st.songSeed?.title || st.title || "").trim(),
        st.songSeed?.lyrics || watchLyricsEditor?.value || lyricsInput?.value || "",
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
  } catch (_e) {
    // Hot loop: never throw. Return the last good value (or 0).
    return (__cssosLyricsPctCache && typeof __cssosLyricsPctCache.val === "number")
      ? __cssosLyricsPctCache.val : 0;
  }
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

// CSSOS_WAVE_649 20260605 — Jing 情绪 Emoji 点睛层. 情绪(经 EMO_MAP 归一为
// joy/calm/ignite/intimate/resolve/grief)→ 对应 emoji。某字情绪爆发且唱腔拉长时, 渲染器在该字旁
// 临时浮出对应符号(见 renderWatchKaraokeOverlayModule 注入处)。可热改: globalThis.cssosEmotionEmojiMap。
// 每情绪一组候选符号(稳定选取: 按词文本哈希挑一个 → 同一个字永远同一个 emoji, 不逐帧跳)。
// 可热改: globalThis.cssosEmotionEmojiMap = { intimate:["💗","💕"], ignite:["🔥"], ... }。
const CSSMV_EMOTION_EMOJI = {
  intimate: ["💗", "💕", "💞"], love: ["💗", "💕"], tender: ["💕", "🌸"],
  joy: ["✨", "🌟", "💫"], ecstatic: ["🌟", "✨"],
  ignite: ["🔥", "⚡"], intense: ["🔥"], rage: ["🔥", "⚡"], triumphant: ["🔥", "👑"],
  grief: ["💧", "🥀"], haunting: ["💧", "🌫️"], melancholy: ["💧"],
  hope: ["🕊️", "🌅"], longing: ["🕊️", "🌌"],
  resolve: ["⛰️", "💪"],
  calm: ["🌙", "🍃"], serene: ["🌙", "🍃"],
};
function cssmvEmotionEmojiModule(emotion, seedText) {
  const map = (globalThis.cssosEmotionEmojiMap && typeof globalThis.cssosEmotionEmojiMap === "object")
    ? globalThis.cssosEmotionEmojiMap
    : CSSMV_EMOTION_EMOJI;
  const entry = map[String(emotion || "").trim().toLowerCase()];
  if (!entry) return "";
  const arr = Array.isArray(entry) ? entry : [entry];
  if (!arr.length) return "";
  // 稳定哈希 seedText → 选一个候选 (同字稳定, 不同字有变化)
  const s = String(seedText || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return arr[h % arr.length] || "";
}
globalThis.cssmvEmotionEmojiModule = cssmvEmotionEmojiModule;

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
  // 取【正在播放的那个元素】的 currentTime + 它自己的 duration(时钟与拉伸基准必须同源)。
  const mediaClock = (() => {
    const v = watchVideo;
    const a = watchAudioPreview;
    const vt = Number(v?.currentTime || 0);
    const at = Number(a?.currentTime || 0);
    const vd = Number(v?.duration || 0);
    const ad = Number(a?.duration || 0);
    const vPlaying = v && !v.paused && !v.ended && vt > 0;
    const aPlaying = a && !a.paused && !a.ended && at > 0;
    // CSSOS_WAVE_1108 — 音频是主时钟(铁律): 有独立音轨在播时, 字幕/卡拉OK必须跟 audio.currentTime,
    // 绝不能跟 video —— 背景画面常与音频不等长(本例 audio 240s / video 438s), 跟视频会漂移 200+s,
    // 字幕跑到框外/全屏空白。仅当音频元素没在播(老作品: 音频从 video muxed 出、audio.src 被清空)
    // 才退回 video 时钟。原代码 video 优先, 正是音画脱钩的根因。
    if (aPlaying) return { t: at, dur: ad };
    if (vPlaying) return { t: vt, dur: vd };
    if (at > 0) return { t: at, dur: ad };
    if (vt > 0) return { t: vt, dur: vd };
    return { t: 0, dur: 0 };
  })();
  // CSSOS_WAVE_648 — 情绪字幕【时间轴线性拉伸】对齐歌声。subtitle-take1.json 的行级时间戳是
  // 【合成匀速】(每行死板 2.4s, 且总长被错估 ~146s, 实测真实音频 247s)→ 字幕按自己的进度匀速
  // 跑, 唱到一半就播完。修法: 把【真实媒体时钟】线性映射到【字幕时间轴】——
  //   subtitleClock = mediaClock × (字幕总长 / 真实媒体时长)
  // 于是字幕铺满整首歌、起止对齐。注: 这是 A 方案(匀速拉伸, 间奏处仍会略飘); B 方案(whisperX
  // 对真实音频做 forced-alignment, 产出真字级时间戳)才是根治, 见管线 TODO。
  const subSpanSec = karaokeTimeline.length
    ? Number(karaokeTimeline[karaokeTimeline.length - 1]?.end_s || 0)
    : 0;
  // CSSOS_WAVE_688 — 时间对齐根治: 字幕已是【熟歌词】(whisperX 对真实歌声 forced-align 出的
  // 真字级时间戳, _hasRealTiming=true), 它的时间就是【播放音频的绝对时间】, 必须 1:1 直用。
  // W648 的线性拉伸(subSpan/dur)是当年字幕还是【合成匀速假时间】时的补丁 —— 在真时间下
  // 反而把已对齐的时间又拉歪(尤其历史轨 duration 元数据失真时, 整段抢跑到第二节)。
  // 规则: 只要时间轴里有任一真时间 cue → 不拉伸(scale=1); 仅当全是占位假时间(极旧作品)
  // 才退回老拉伸法兜底。这就是 Jing 说的"我们已经是熟歌词, 不是生歌词"。
  const timelineIsCooked = karaokeTimeline.some(function (c) {
    return c && (c._cooked === true || c._hasRealTiming === true);
  });
  const clockScale =
    timelineIsCooked
      ? 1
      : ((subSpanSec > 1 && mediaClock.dur > 1 && isFinite(mediaClock.dur))
          ? (subSpanSec / mediaClock.dur)
          : 1);
  const mediaClockSec = mediaClock.t * clockScale;
  if (karaokeTimeline.length) {
    // CSSOS_WAVE_708 — 只在【真有 cue 覆盖当前时间】时显示字幕。根因实锤: 旧码
    // Math.max(0, findIndex(...)) 把"没有活动 cue"(-1)误当成"第一句 cue"(0) → 每次呼吸/空隙
    // 都闪一下第一句字幕(Jing: "晨光落在古城墙上"乱闪)。熟字幕字字对齐, 空隙就该【什么都不显示】。
    // 前奏/间奏/尾声由 [Music...] cue 覆盖(activeIndex≥0 → 显示 [Music...]); 短呼吸不被覆盖 → 清空。
    const activeIndex = karaokeTimeline.findIndex((cue) => mediaClockSec >= Number(cue?.start_s || 0) && mediaClockSec <= Number(cue?.end_s || 0));
    if (activeIndex < 0) {
      // CSSOS_WAVE_720 — 离开歌词句进入空隙 → 让正在驻留的【整句爆】一起淡出。
      if (typeof globalThis.cssosFadeBurstLine === "function") globalThis.cssosFadeBurstLine();
      // CSSOS_WAVE_711 — 空隙(呼吸/未被 [Music...] 覆盖): 【保持上一句不动, 原地不动什么都不改】。
      // 既不回退闪第一句(旧 Math.max bug), 也不清屏导致"清→显"抖动。下一个 cue(歌词或 [Music...])
      // 到点了才更新。长间奏由 [Music...] cue 覆盖, 短呼吸就让上一句安静地停着。
      return;
    }
    const currentIndex = activeIndex;
    const prevCue = karaokeTimeline[Math.max(0, currentIndex - 1)] || null;
    let currentCue = karaokeTimeline[currentIndex] || null;
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
    // CSSOS_WAVE_716 — 器乐段([Music...])正在播 → 让 emoji 跟着音乐闪/飘(前奏/间奏没歌词也别浪费
    // 高音)。判定: 当前 cue 全是 adlib token(即 [Music...])。节流在 cssosMusicGapPulse 内。
    const _isMusicCue = (Array.isArray(cueWords) && cueWords.length && cueWords.every((w) => w && w.adlib)) || resolvedCueText === "[Music...]";
    if (_isMusicCue) {
      // 进入器乐段: 让上一句驻留的【整句爆】先一起淡出, 再让器乐 emoji 飘。
      if (typeof globalThis.cssosFadeBurstLine === "function") globalThis.cssosFadeBurstLine();
      // CSSOS_WAVE_724 — 按整曲音量包络采样当前器乐音量(大→emoji 多)。
      try {
        var _vc = globalThis.cssosSongVolumeCurve;
        if (_vc && _vc.values && _vc.step_ms > 0) {
          var _vi = Math.floor((mediaClockSec * 1000) / _vc.step_ms);
          var _vv = _vc.values[_vi];
          globalThis.cssosCurrentVolume = (_vv != null) ? Number(_vv) : undefined;
        } else { globalThis.cssosCurrentVolume = undefined; }
      } catch (_e) {}
      if (typeof globalThis.cssosMusicGapPulse === "function") globalThis.cssosMusicGapPulse(inferredEmotion);
    }
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
      // CSSOS_WAVE_671 ③ 音高旋律线: 本行内按音高归一化, 让每字静止态上下浮动 = 看得见的旋律。
      // 与蹦/爆动画分层(静止 transform = 音高位移, 关键帧在此基线上叠加, 见 style.watch.css)。
      let _pMin = Infinity, _pMax = 0;
      cueWords.forEach((w) => { const p = Number(w && w.pitch || 0); if (p > 0) { if (p < _pMin) _pMin = p; if (p > _pMax) _pMax = p; } });
      const _pRange = (_pMax > _pMin) ? (_pMax - _pMin) : 0;
      const wordSpans = cueWords.map((word, index) => {
        const sung = mediaClockSec >= Number(word?.end_s || 0);
        const active =
          activeWordIndex >= 0
            ? index === activeWordIndex
            : mediaClockSec >= Number(word?.start_s || 0) && mediaClockSec <= Number(word?.end_s || 0);
        const cls = ["watch-karaoke-word"];
        const emotion = String(word?.emotion || "").trim().toLowerCase();
        const emphasis = Math.max(0, Math.min(1, Number(word?.emphasis || 0) || 0));
        // CSSOS_WAVE_688 — 爆裂增益曲线(疯牛之魂): 真凶不是旋钮太小, 是【逐字情绪强度数据偏平】
        // (SER 多落在 0.3–0.45), 蹦/爆幅度 ∝ emphasis → 平数据×大旋钮还是只动一点点, 且够不到
        // burst 门(0.45)就根本不爆。这里对 emphasis 做 gamma 提升 + 增益(把中段往上推): 0.30→0.59、
        // 0.45→0.74、0.60→0.86 → 大量 active 字越过 burst 门、pop 缩放也明显。让现有数据立刻"炸"起来,
        // 无需重跑后端。可调: globalThis.cssosEmotionPunch = {gamma, gain}。
        var _punch = (globalThis.cssosEmotionPunch && typeof globalThis.cssosEmotionPunch === "object") ? globalThis.cssosEmotionPunch : null;
        var _pg = _punch && _punch.gamma > 0 ? _punch.gamma : 0.55;
        var _pn = _punch && _punch.gain > 0 ? _punch.gain : 1.18;
        const emphasisFx = emphasis <= 0 ? 0 : Math.max(0, Math.min(1, Math.pow(emphasis, _pg) * _pn));
        const beatWeight = Math.max(
          emphasis,
          active ? watchMusicLiveEnergy * 0.72 + watchMusicLivePeak * 0.28 : emphasis * 0.7,
        );
        if (sung) cls.push("is-sung");
        if (active) cls.push("is-active");
        if (emotion) cls.push(`is-${emotion}`);
        if (word?.adlib) cls.push("is-adlib"); // CSSOS_WAVE_679 — 即兴拟声: 斜体+柔光, 与书面词区分
        // CSSOS_WAVE_668 — 峰值字"爆": 强度 ≥ 阈值(参数化, app.emotion-fx.js)→ is-burst(更大缩放+全屏闪)。
        if (active && emphasisFx >= (typeof globalThis.cssosEmotionBurstThreshold === "function" ? globalThis.cssosEmotionBurstThreshold() : 0.8)) {
          cls.push("is-burst");
        }
        const wordText = String(word?.text || "");
        const fam = pickPieceFont ? pickPieceFont(wordText) : "";
        const famCss = fam ? `;font-family:&quot;${String(fam).replace(/"/g, "&quot;")}&quot;, var(--watch-title-font-family, inherit)` : "";
        // Emit inline-flow spans separated by a thin space so the
        // browser keeps them on a single line up to the container's
        // max-width (white-space: nowrap on the parent does the rest).
        // CSSOS_WAVE_649/652 — 情绪 Emoji 点睛层(iMessage 思想气泡式): emoji 不与字幕同行,
        // 而是【浮在该字正上方】、用小尖尖头【指向这个字】(类似 iMessage emoji 气泡)。因此 emoji
        // span 作为【目标字 span 的子元素】注入, CSS 把它绝对定位到字的上方 + 下尖角指向字。
        // 触发: 当前咬字 active 且(情绪强度≥0.78 且 唱腔≥0.35s)—— 阈值放宽, 按情绪需要多蹦些,
        // 不再过度克制。innerHTML 仅在 active 字切换时重写(emoSig 守卫)→ 动画每字只放一次。
        // demo: globalThis.cssosEmojiDemo=true 无视阈值, 每个 active 字都蹦。
        const _wdur = Number(word?.end_s || 0) - Number(word?.start_s || 0);
        // CSSOS_WAVE_702 — Jing: emoji 不再占字幕轨, 升到【中央爆背景层】(见 cssosEmotionCenterBurst
        // 的 emoji 背景)。字幕轨从此只放干净的逐字情绪文本。保留 in-track 气泡仅作可选 demo
        // (globalThis.cssosEmojiInTrack===true 才注入), 默认关。
        const _emojiInTrack = globalThis.cssosEmojiInTrack === true;
        const _emojiOn = _emojiInTrack && active && (globalThis.cssosEmojiDemo === true || (emphasisFx >= 0.62 && _wdur >= 0.28));
        const _emo = _emojiOn ? cssmvEmotionEmojiModule(emotion, wordText) : "";
        const _emoHtml = _emo ? `<span class="cssmv-emo-emoji" aria-hidden="true">${_emo}</span>` : "";
        const _wcls = cls.join(" ") + (_emo ? " has-emo-emoji" : "");
        // 音高 → 静止态纵向位移基线(高音上浮、低音下沉)。NUM∈[-1,1], 高音→负(上)。
        let _pitchCss = "";
        const _pv = Number(word?.pitch || 0);
        if (_pRange > 0 && _pv > 0) {
          const _relP = (_pv - _pMin) / _pRange;            // 0..1
          const _num = ((0.5 - _relP) * 2).toFixed(3);       // 1(低)..-1(高)
          _pitchCss = `;--kara-pitch-y:calc(${_num} * var(--cssfx-pitch-spread, 14px))`;
        }
        return `<span class="${_wcls}" style="--karaoke-word-emphasis:${emphasisFx.toFixed(3)};--karaoke-word-beat:${beatWeight.toFixed(3)}${_pitchCss}${famCss}">${escapeHtml(wordText)}${_emoHtml}</span>`;
      });
      return wordSpans.join(" ");
    })();
    watchSubtitle?.setAttribute("data-emotion", inferredEmotion);
    // CSSOS_WAVE_714 — #watch-karaoke-line 已彻底退役(#watch-subtitle 是唯一字幕载体)。此前它仍被
    // 每帧写入 prev/current/next 整句歌词 + 因 style.watch.css 从未加载而隐藏失效 → 在画面里漏出虚影
    // 英文。根治: 【JS 里直接清空 + 内联隐藏】, 不依赖任何 CSS 加载, 永不再漏。
    if (watchKaraokeLine) {
      if (watchKaraokeLine.innerHTML !== "") watchKaraokeLine.innerHTML = "";
      watchKaraokeLine.style.display = "none";
    }
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
      // CSSOS_WAVE_644 — 绿色 #watch-subtitle 升级为【逐字情绪字幕(熟歌词)】: 把上面已构建的
      // per-word 情绪 HTML(renderedCurrent, 每字带 is-{joy|calm|ignite|intimate|resolve|grief}
      // + is-active 当前咬字 + is-sung 已唱, 字号随 emphasis/音量呼吸)直接写进【可见】的 subtitle,
      // 而不是平文本。#watch-karaoke-line 已退役 → subtitle 是唯一可见载体, 它才该承载情绪渲染。
      watchSubtitle.dataset.cssmvOrigin = "lyric";
      watchSubtitle.classList.add("is-emotion-karaoke");
      watchSubtitle.dataset.emotion = inferredEmotion;
      // CSSOS_WAVE_711 — 双随机色【铁底】: 直接把"未唱/已唱"两随机色写成 #watch-subtitle 的内联 CSS
      // 变量(不依赖 emotion-fx 模块时机/:root 是否被设)。每个【新作品/新时间轴】滚一对, 同作品播放
      // 期间不变。CSS 的 var(--sub-unsung/--sub-sung) 直接从本元素读到 → 永远不会落回默认绿。
      try {
        // CSSOS_WAVE_731r 20260612 — Jing 定义: 【底部卡拉OK字幕 = 每次播放滚一对随机色】(整首
        // 一对, 非每句; 想换点面板🎨"换一对"按钮)。key 锚整条时间轴(timeline[0]+长度)→ 同一
        // 作品播放期间稳定一对, 换作品/重播才换。(中央爆大字的"每字随机色"是另一套, 见 emotion-fx。)
        var _ck = String(karaokeTimeline.length) + ":" +
          Number((karaokeTimeline[0] && karaokeTimeline[0].start_s) || 0).toFixed(1) + ":" +
          String((karaokeTimeline[0] && karaokeTimeline[0].text) || "").slice(0, 10);
        var _rcKey = _ck + "|" + (globalThis.cssosSubRandomColor === false ? "fixed" : "rand");
        if (watchSubtitle.dataset.subColorKey !== _rcKey) {
          watchSubtitle.dataset.subColorKey = _rcKey;
          if (globalThis.cssosSubRandomColor === false) {
            watchSubtitle.style.setProperty("--sub-unsung", "rgba(235,245,255,0.62)");
            watchSubtitle.style.setProperty("--sub-sung", "rgba(255,238,150,0.98)");
            watchSubtitle.style.setProperty("--sub-sung-h", "48");
          } else {
            var _h1 = Math.floor(Math.random() * 360);
            var _h2 = (_h1 + 100 + Math.floor(Math.random() * 160)) % 360;
            watchSubtitle.style.setProperty("--sub-unsung", "hsla(" + _h1 + ",60%,75%,0.62)");
            watchSubtitle.style.setProperty("--sub-sung", "hsla(" + _h2 + ",92%,66%,0.98)");
            watchSubtitle.style.setProperty("--sub-sung-h", String(_h2));
          }
        }
      } catch (_e) {}
      const _emoSig = resolvedCueText + "#" + activeWordIndex;
      if (watchSubtitle.dataset.emoSig !== _emoSig) {
        watchSubtitle.dataset.emoSig = _emoSig;
        watchSubtitle.innerHTML = renderedCurrent;
        // CSSOS_WAVE_668 — 当前咬字是峰值字 → 偶尔触发夸张全屏闪(每字最多一次, 由 emoSig 守卫)。
        try {
          var _aw = (Array.isArray(cueWords) && activeWordIndex >= 0) ? cueWords[activeWordIndex] : null;
          var _emphRaw = _aw ? Number(_aw.emphasis || 0) : 0;
          var _pp = (globalThis.cssosEmotionPunch && typeof globalThis.cssosEmotionPunch === "object") ? globalThis.cssosEmotionPunch : null;
          var _emph = _emphRaw <= 0 ? 0 : Math.max(0, Math.min(1, Math.pow(_emphRaw, _pp && _pp.gamma > 0 ? _pp.gamma : 0.55) * (_pp && _pp.gain > 0 ? _pp.gain : 1.18)));
          var _thr = (typeof globalThis.cssosEmotionBurstThreshold === "function") ? globalThis.cssosEmotionBurstThreshold() : 0.8;
          var _flashThr = Math.max(_thr, 0.8);
          // CSSOS_WAVE_731j 20260612 — Jing「那一闪还在屏幕中央, 应该在字心像烟花」:
          // cssosEmotionFlash 是【全屏中央闪光】, 跟字心烟花(cssosLineBurstWord 的
          // _fireworkAt 已在字位置)是两套。字心烟花已覆盖"爆"的观感 → 默认【关掉全屏闪】,
          // 只留字心烟花。想找回全屏闪可设 globalThis.cssosEmotionFullscreenFlash=true。
          if (_aw && _emph >= _flashThr && globalThis.cssosEmotionFullscreenFlash === true
              && typeof globalThis.cssosEmotionFlash === "function") {
            globalThis.cssosEmotionFlash(String(_aw.emotion || ""), _emph);
          }
        } catch (_e) {}
      }
      // CSSOS_WAVE_721 — 整句累积爆【catch-up】(修"最后一个字不显示"): 每次渲染都把【已唱到
      // (start_s ≤ 当前时间)且未爆】的字补爆一次(cssosLineBurstWord 内 spawned 去重)。
      // 旧逻辑只在 activeWordIndex 切换时爆当前字, 末字唱腔短 → 可能没有渲染帧落在其活动窗口 → 漏。
      try {
        if (Array.isArray(cueWords) && cueWords.length && typeof globalThis.cssosLineBurstWord === "function") {
          // CSSOS_WAVE_725 — 末字根治: 接近本句结尾(cue.end - 0.6s)时, 把【本句剩下没爆的字全部补上】。
          // 末字的合法窗口=自己唱腔, 太短就没渲染帧落进去 → 漏。near-end 一次性兜底。
          var _cueEnd = Number((karaokeTimeline[currentIndex] || {}).end_s || 0);
          var _nearEnd = _cueEnd > 0 && mediaClockSec >= _cueEnd - 0.6;
          // CSSOS_WAVE_731k 20260612 — Jing「非亚洲语言竖排不要拆成字母, 拆到词就行(如
          // Jerusalem 整个单词, 别拆 J/e/r/u/s/a/l/e/m)」: 爆字单元按【词】聚合。CJK 仍逐字;
          // 非 CJK 把【连续非空白 token】合成整词(空白 token 或 token 内空白=词边界)。爆字布局
          // 用词数(units.length)→ 竖排是【一个词一格】而不是一个字母一格。
          var _lineTxt = cueWords.map(function (w) { return (w && w.text) || ""; }).join("");
          var _lineCJK = /[぀-ヿ㐀-鿿가-힯]/.test(_lineTxt);
          var _hasSpaceTok = cueWords.some(function (w) { return /\s/.test(String((w && w.text) || "")); });
          var _units;
          if (_lineCJK) {
            _units = cueWords;
          } else if (_hasSpaceTok) {
            // token 自带空格 → 按空白边界聚合(可靠)。
            _units = [];
            var _cur = null;
            for (var _ti = 0; _ti < cueWords.length; _ti++) {
              var _tok = cueWords[_ti];
              if (!_tok) continue;
              var _raw = String(_tok.text || "");
              var _leadSpace = /^\s/.test(_raw);
              var _trimmed = _raw.replace(/\s+/g, "");
              if (!_trimmed) { _cur = null; continue; }
              if (!_cur || _leadSpace) {
                _cur = { text: _trimmed, start_s: Number(_tok.start_s || 0),
                  emotion: _tok.emotion, emphasis: Number(_tok.emphasis || 0), adlib: _tok.adlib };
                _units.push(_cur);
              } else {
                _cur.text += _trimmed;
                if (Number(_tok.emphasis || 0) > _cur.emphasis) {
                  _cur.emphasis = Number(_tok.emphasis || 0); _cur.emotion = _tok.emotion;
                }
                if (_tok.adlib) _cur.adlib = _tok.adlib;
              }
              if (/\s$/.test(_raw)) _cur = null;
            }
          } else {
            // CSSOS_WAVE_731u 20260613 — Jing「英文单词全连成一长串」根因(W731k 回归): token
            // 之间【没有空格】时, 旧聚合把整行并成一个词。修: 用【整行原文的空格】切词
            // (cue.text 带空格), 再按字符数把 token 的时间/情绪映射到每个词。词正确分开, 不再连成串。
            var _cueText = String((karaokeTimeline[currentIndex] || {}).text || _lineTxt);
            var _wordsTxt = _cueText.split(/\s+/).filter(Boolean);
            _units = [];
            var _ci = 0;
            for (var _w2 = 0; _w2 < _wordsTxt.length; _w2++) {
              var _len = _wordsTxt[_w2].length;
              var _tk0 = cueWords[Math.min(_ci, cueWords.length - 1)] || {};
              var _emo = _tk0.emotion, _emp = Number(_tk0.emphasis || 0), _ad = _tk0.adlib;
              for (var _k = 0; _k < _len && _ci < cueWords.length; _k++) {
                var _tt = cueWords[_ci];
                if (_tt) { if (Number(_tt.emphasis || 0) > _emp) { _emp = Number(_tt.emphasis || 0); _emo = _tt.emotion; } if (_tt.adlib) _ad = _tt.adlib; }
                _ci++;
              }
              _units.push({ text: _wordsTxt[_w2], start_s: Number(_tk0.start_s || 0), emotion: _emo, emphasis: _emp, adlib: _ad });
            }
          }
          for (var _wi = 0; _wi < _units.length; _wi++) {
            var _w = _units[_wi];
            if (_w && !_w.adlib && (_nearEnd || mediaClockSec >= Number(_w.start_s || 0))) {
              globalThis.cssosLineBurstWord(currentIndex, _wi, _units.length,
                String(_w.text || ""), String(_w.emotion || ""), Number(_w.emphasis || 0));
            }
          }
        }
      } catch (_e) {}
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
  // CSSOS_WAVE_471 20260527 — Jing「桌面进主界面自动进 MV, 自动播放【最新作品】」根因:
  // owned 播放队列(commerce state)为空时, 之前直接退到 /api/works/market, 而 market 按
  // 「封面在CDN优先 + updated_at DESC」排序, 取 [0] 往往是某个被策展/最近更新的作品(如
  // Εὐκλείδης), 并非真正最新创建的作品 → 没播到「最新作品」。修复: 在退到 market 之前,
  // 先用 /api/works/mine 取【登录用户按 created_at 倒序的最新一首】(有可播媒体的), 命中
  // 即作为自动播放的"最新作品"。仅当确无自有作品时才退到 market。
  if (!queue?.items?.length && authState.user) {
    try {
      const _mineRes = await fetch("/api/works/mine?limit=50", { credentials: "include" });
      if (_mineRes.ok) {
        const _minePayload = await _mineRes.json().catch(() => null);
        const _mineWorks = _minePayload?.data?.works || _minePayload?.works || [];
        const _flat = [];
        const _visit = (w) => { if (!w) return; _flat.push(w); if (Array.isArray(w.children)) w.children.forEach(_visit); };
        _mineWorks.forEach(_visit);
        const _playable = _flat.filter((w) => {
          if (Number(w?.take_index || 0) === 2) return false; // Take1 carries both audios
          return !!String(w?.final_mv_url || w?.preview_video_url || w?.audio_track_1_url || w?.audio_track_2_url || "").trim();
        });
        _playable.sort((a, b) => (Date.parse(String(b?.created_at || "")) || 0) - (Date.parse(String(a?.created_at || "")) || 0));
        if (_playable.length) {
          queue = { rootWork: { title: loginCopy("Latest works") }, items: _playable, index: 0 };
        }
      }
    } catch (_e) { /* non-fatal → market fallback below */ }
  }
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
  let latestWork = queue.items[0];
  // CSSOS_WAVE_472 20260527 — Jing「只有幻灯画面、声音/视频没跟来」根因: 自动播放选中的
  // 作品对象常来自 commerce 队列/market, 这些来源【缺少 audio_track_1_url / final_mv_url】
  // → 进面板只挂了封面(幻灯), 音频元素 src 为空、视频也没源 → 有画无声/无视频。修复: 渲染前
  // 用 /api/works/mine 按 id(或最新)补全该作品的完整媒体 URL, 保证音频+视频一起就位。
  try {
    var _needAudio = !String(latestWork && latestWork.audio_track_1_url || "").trim();
    var _needVideo = !String(latestWork && (latestWork.final_mv_url || latestWork.preview_video_url) || "").trim();
    if ((_needAudio || _needVideo) && authState.user) {
      var _enRes = await fetch("/api/works/mine?limit=50", { credentials: "include" });
      if (_enRes.ok) {
        var _enP = await _enRes.json().catch(function () { return null; });
        var _enWorks = (_enP && _enP.data && _enP.data.works) || (_enP && _enP.works) || [];
        var _enFlat = [];
        (function _v(arr) { arr.forEach(function (w) { _enFlat.push(w); if (Array.isArray(w.children)) _v(w.children); }); })(_enWorks);
        var _id = String((latestWork && (latestWork.id || latestWork.work_id)) || "").trim();
        var _match = _id ? _enFlat.find(function (w) { return String(w.id || w.work_id || "") === _id; }) : null;
        if (!_match) {
          _enFlat.sort(function (a, b) { return (Date.parse(String(b.created_at || "")) || 0) - (Date.parse(String(a.created_at || "")) || 0); });
          _match = _enFlat[0];
        }
        if (_match) { latestWork = Object.assign({}, latestWork, _match); queue.items[0] = latestWork; }
      }
    }
  } catch (_enErr) { /* non-fatal: enrichment best-effort */ }
  currentWatchPreviewWork = latestWork;
  try { applyStoredWorkAspectModule(latestWork); } catch (_eAsp) {} // W544: 入库画幅优先还原, 不退回 16:9
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
        // CSSOS_WAVE_454 20260527 — Jing: cssosThumb 对 replicate.delivery/fal.media
        // 返回 "" (WAVE_449 跳过临时链接), 若直接用 url("") 设背景 → 黑屏。
        // 修复: _stable 为空时退回原始 URL, 确保封面总能显示(即使临时链接已过期
        // 也好过纯黑; 后续 DB backfill 会把这类 URL 迁到 R2)。
        const _stable = (typeof globalThis.cssosThumb === "function")
          ? (globalThis.cssosThumb(_cov, 800) || _cov) : _cov;
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
  // CSSOS_WAVE_473b 20260527 — Jing「浏览器不支持直接自动播放视频, 降级为自动播放
  // 『幻灯 + 歌曲音轨』」: 自动播放(人物 MV 入场)时优先走【幻灯封面 + 歌曲音轨】, 而不是
  // 5MB+ 的 final_mv 视频 —— 音频更轻、配合"首触解锁声音", 体验顺滑; 幻灯封面立即出画。
  // 逻辑: 只要作品有独立歌曲音轨(audio_track) → 停掉/清空视频(让 W469 透明 video 透出
  // 幻灯), 确保幻灯在跑, 播放音轨(带声试播→被拦则静音重试+标 pending-unmute+提示)。
  // 仅当【没有独立音轨、只有视频】时才退回播视频(其自带音轨)。绝不双声打架。
  try {
    const _aEl = document.getElementById("watch-audio-preview");
    const _vEl = document.getElementById("watch-video");
    const _a1 = String(latestWork?.audio_track_1_url || latestWork?.audio_track_2_url || "").trim();
    const _hasSongAudio = !!_a1 && !/^data:/i.test(_a1);
    if (_hasSongAudio) {
      // 1) 停掉视频 → 幻灯透出(W469 video 透明; 清 src 后彻底不抢)。
      // CSSOS_WAVE_626 — 剥离前先把视频源【存到 data-fallback-src】: 若独立音频死链/放不出,
      // cssosFallbackToVideoAudio 可恢复视频原声, 永不留静音。
      if (_vEl) {
        try {
          const _vsrcNow = String(_vEl.currentSrc || _vEl.getAttribute("src") || "").trim();
          const _vFallback = _vsrcNow || String(latestWork?.preview_video_url || latestWork?.final_mv_url || "").trim();
          if (_vFallback && !/^data:image\/svg/i.test(_vFallback)) _vEl.setAttribute("data-fallback-src", _vFallback);
        } catch (_eStash) {}
        try { _vEl.pause && _vEl.pause(); _vEl.removeAttribute("src"); _vEl.load && _vEl.load(); } catch (_eV) {}
      }
      // CSSOS_WAVE_455 20260527 — Jing: 进入音频模式时, 把 watch-screen-audio-fallback
      // 加到 .watch-screen → CSS 把 .watch-video 设为 opacity:0.1 → 即使 background 未清
      // 也不会遮住封面/backdrop. (style.watch.css 的 W455 修复已把背景改 transparent;
      // 这里加 class 是双保险, 同时触发其他 audio-fallback 布局调整.)
      try {
        const _ws = document.querySelector(".watch-screen");
        if (_ws) _ws.classList.add("watch-screen-audio-fallback");
      } catch (_eC) {}
      // 2) 确保幻灯/封面在显示。
      try { syncWatchPlaceholderFromCurrentState(); } catch (_eS) {}
      // 3) 播放歌曲音轨(带声→拦截则静音重试 + 首触解锁)。
      if (_aEl) {
        if (String(_aEl.getAttribute("src") || "") !== _a1) {
          // CSSOS_WAVE_454 20260527 — Jing: iOS WKWebView 上 _aEl.load() 会重置媒体元素
          // 的「用户激活」状态(即使 W474 首触已激活), 导致后续 play() 因无手势上下文而被拦。
          // 修复: 只改 src, 不调 load() —— play() 会自动触发缓冲/加载; iOS 保留激活状态。
          _aEl.src = _a1; _aEl.preload = "auto";
          /* 不调 _aEl.load() — 见上方注释 */
          // CSSOS_WAVE_626 — 永不静音: 独立音频死链/加载失败 → 回退播视频原声。
          _aEl.addEventListener("error", function onWAErr() {
            _aEl.removeEventListener("error", onWAErr);
            if (typeof globalThis.cssosFallbackToVideoAudio === "function") globalThis.cssosFallbackToVideoAudio("watch-audio-error");
          }, { once: true });
        }
        _aEl.muted = false;
        const _pp = _aEl.play && _aEl.play();
        if (_pp && typeof _pp.then === "function") {
          // CSSOS_WAVE_624 — 独立音频带声播成功 = 本会话已出声: 标记解锁 + 清 pendingUnmute +
          // 收起「轻触出声」提示。否则视频层(纯画面静音)设的 pendingUnmute 会误显提示, 让有声也像没声。
          _pp.then(function () {
            try {
              globalThis.__cssosWatchAudioUnlocked = true;
              globalThis.__cssosWatchPendingUnmute = false;
              if (typeof globalThis.hideWatchSoundHintModule === "function") globalThis.hideWatchSoundHintModule();
            } catch (_eOk) {}
          });
        }
        if (_pp && typeof _pp.catch === "function") {
          _pp.catch(function () {
            // CSSOS_WAVE_624 20260603 — Jing「几乎每首歌都要点一下才有声」根治。
            // 旧逻辑致命缺陷: 带声 canplay 重试【只在已解锁时】才走; 第一首歌(尚未手势解锁)
            // 一旦 play() 被拒就【直接静音】(旧 3261 行)。而 play() 被拒【绝大多数是加载竞态】
            // (源还没 canplay), 不是自动播放策略 —— 尤其原生 App(MainViewController 零手势开关已开,
            // mediaTypesRequiringUserActionForPlayback=[])本就允许带声自动播放。结果: 每首新歌第一次
            // 都被错误静音 → 要求用户点一下。
            // 新逻辑【无论是否解锁】: 总是先【带声在 canplay 重试】(+300ms 兜底)。
            //   - 原生 App / 已授权浏览器 → canplay 带声成功, 新歌第一首也直接出声, 不再要点击。
            //   - 真被策略拦的浏览器 → 带声重试也失败, 此时【仅当从未解锁】才退静音 + 提示一次。
            //   - 已解锁过的会话 → 绝不退静音(_mutedLastResort 内部自带 guard)。
            var _mutedLastResort = function () {
              if (globalThis.__cssosWatchAudioUnlocked || globalThis.__cssosAudioUnlocked) return;
              try {
                _aEl.muted = true;
                globalThis.__cssosWatchPendingUnmute = true;
                var _p2 = _aEl.play && _aEl.play();
                if (_p2 && typeof _p2.catch === "function") _p2.catch(function () {});
                if (typeof globalThis.showWatchSoundHintModule === "function") globalThis.showWatchSoundHintModule();
                try {
                  if (!globalThis.__cssosAutoplayMutedReported && typeof globalThis.cssosReportError === "function") {
                    globalThis.__cssosAutoplayMutedReported = true;
                    globalThis.cssosReportError("Autoplay muted — sound waits for first tap.", "autoplay_muted");
                  }
                } catch (_eRep) {}
              } catch (_e2) {}
            };
            var _retryWithSound = function () {
              _aEl.muted = false;
              var _pr = _aEl.play && _aEl.play();
              if (_pr && typeof _pr.then === "function") {
                _pr.then(function () { globalThis.__cssosWatchAudioUnlocked = true; }).catch(function () { _mutedLastResort(); });
              }
            };
            // 永远先带声在 canplay 重试 —— 不再按「是否解锁」分叉。
            var _onCP = function () { _aEl.removeEventListener("canplay", _onCP); _retryWithSound(); };
            _aEl.addEventListener("canplay", _onCP);
            setTimeout(function () { if (_aEl.paused || _aEl.muted) _retryWithSound(); }, 300);
          });
        }
      }
    }
    // 无独立音轨、只有视频时, 不动: renderMarketWorkPreviewIntoWatchModule 已挂视频(自带音轨)。
  } catch (_e) { /* non-fatal: 媒体挂载尽力而为 */ }
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
  // CSSOS_WAVE_801 20260615 — Jing「我们已经不走 Web Audio 了, 请彻底断掉」: 此函数残留 —— 即便不再
  // createMediaElementSource(捕获分支早已死), 仍每次播放 `new AudioContext()` 且永不 close() →
  // AudioContext 累积 + 与原生输出潜在抢权 = 残余竞态/资源泄漏。现【彻底断掉】: 不建任何 AudioContext、
  // 不建 analyser、不捕获播放元素。频谱/光环可视化改吃后端逐字 volume 时间线(subtitle token.volume),
  // 永不碰音频。音频 100% 原生直出, 无竞态。
  watchMusicAnalyser = null;
  return;
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
  const suggestedListen = Math.max(69, Number(work?.suggested_listen_price_cents || listenCents || 0));   // CSSOS_WAVE_1153 — 聆听底价 99→69¢
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

// CSSOS_WAVE_792 — Jing「短视频先放完那 5 秒, 之后交棒给幻灯, 音频不断」。画音分层下视频是纯视觉:
// 当有真实独立音轨在播、且视频是短片(<45s)时, 视频 ended【不切歌】——【放完一次就交给封面幻灯】
// (加 watch-screen-audio-fallback 让视频淡出、封面层透出 + 喂封面给幻灯), 视频暂停省解码, 音频继续,
// 切歌权交给 audio.ended(真实歌长)。返回 true = 已拦截切歌。长视频(自带歌)照旧 ended 切歌。
function cssosShortVideoLoopGuard() {
  try {
    var v = document.getElementById("watch-video");
    var a = document.getElementById("watch-audio-preview");
    if (!v) return false;
    var dur = Number(v.duration) || 0;
    if (!(dur > 0 && dur < 45)) return false;            // 只管短片; 长视频(自带歌)照旧切歌
    var as = String((a && (a.currentSrc || a.getAttribute("src"))) || "");
    var aReal = !!a && !!as && !/^data:/i.test(as) && !a.ended;   // 有真实独立音轨在
    if (!aReal) return false;                            // 没独立音轨(老作品视频自带声)→ 照旧切歌
    // 视频已放完它那一遍 → 交棒幻灯(封面), 音频继续, 别再循环视频(省解码、避免 5s 一跳一跳)。
    try {
      var ws = document.querySelector(".watch-screen");
      if (ws) ws.classList.add("watch-screen-audio-fallback");   // CSS: 视频压到 opacity:0.1 → 封面层透出
    } catch (_e) {}
    try {
      var w = globalThis.cssosCurrentWork || null;
      var cover = w && String(w.cover_image || w.cover_url || w.preview_image_url || (w.cover_slides && w.cover_slides[0]) || "").trim();
      if (cover && typeof globalThis.cssmvSetCoverSlides === "function") globalThis.cssmvSetCoverSlides([cover]);
    } catch (_e) {}
    try { v.loop = false; if (!v.paused) v.pause && v.pause(); } catch (_e) {}
    return true;                                         // 拦截切歌, 让音频主导, 画面走幻灯
  } catch (_e) { return false; }
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
          // CSSOS_WAVE_790 — Jing「新旗舰播 2 秒就跳歌」根因: admin epic-render 的音频落在
          // preview_audio_url(非 audio_track_1_asset)→ audio_track_1_url 为空 → 播放器当作"无独立
          // 音轨"→ 放 5s Seedance 视频, 视频 ended 就跳下一首。回退到 preview_audio_url 作独立音轨。
          const a1 = String(w.audio_track_1_url || w.preview_audio_url || "").trim();
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
    try { applyStoredWorkAspectModule(item); } catch (_eAsp) {} // W544: 切歌也按入库画幅还原
    // CSSOS_PHASE2_AUTOPLAY_AFTER_SWIPE 20260430 #232b — Jing
    // "切换了就要自动播放呀。" Decide ONCE per item whether the audio
    // element is the source of truth (modern works with audio_track_1)
    // or the video's baked-in track (legacy works missing audio assets).
    // - hasAudioElSrc: mute video, drive sound from <audio>
    // - else:          unmute video, let the MP4's baked-in track play
    // This kills the "no sound after swipe" failure mode where the
    // queue silently advanced to a legacy work, video was muted, audio
    // element had no src, and the user heard nothing.
    // CSSOS_WAVE_790 — 独立音轨识别回退到 preview_audio_url(admin epic-render 音频在此)。
    const __a1src = String(item.audio_track_1_url || item.preview_audio_url || "").trim();
    const hasAudioElSrc = !!(audioEl && __a1src);
    if (videoEl && url) {
      // CSSOS_PHASE2_PRESERVE_ASPECT 20260430 #235 — clear the previous
      // item's source-aspect tag so the new item's loadedmetadata can
      // re-derive from its own dimensions. Don't clear userOverrodeAspect
      // — that's the user's explicit choice, persists across queue moves.
      try {
        const frame = document.querySelector("#watch-panel .watch-frame");
        if (frame) { delete frame.dataset.sourceAspect; delete frame.dataset.storedAspect; } // W544
      } catch (_e) {}
      cssosBeginWatchVideoSwap(); // W543: 切歌时隐藏旧首帧, 新视频 playing 后再淡入
      videoEl.src = url;
      videoEl.load && videoEl.load();
      // CSSOS_WAVE_406 20260524 — Jing「两首歌抢着播放 / 断断续续」根治: 当存在
      // 独立音轨(audio_track_1, hasAudioElSrc)时, final_mv 视频里【已经烘焙了同一
      // 条 Take 1 音频】。若视频也 unmute, 它就和 <audio> 播【同一首歌】(略微错位)
      // → 双声叠加打架 + 断断续续。回到 #232b 的既定设计: 有独立音轨就【静音视频】
      // (画面归画面, 声音归 <audio>, 卡拉OK按 audio.currentTime 同步); 只有没有独立
      // 音轨的旧作品才让视频出声(烘焙音轨)。switchToTake(2) 仍走自己的手势路径。
      // (#256 的"永不静音视频"在引入独立音轨后就成了双声源, 这里纠正。)
      videoEl.muted = hasAudioElSrc;
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
    } else if (videoEl && !url) {
      // CSSOS_WAVE_1005 20260619 — Jing「MV 真全屏黑屏没画面」根因: 无视频作品(create_work
      // 多部曲等, 视频延后生成)走到这里 url 为空 → 上面整个 if 块跳过 → 既不播视频、也不触发
      // 封面幻灯兜底(它只在 video.play() 失败的 catch 里) → 纯黑。这里显式走封面幻灯兜底:
      // 拿这首歌的封面铺满, 保证【有画面】(配合 W1001b 幻灯循环 + W1004b 爆字挂进面板)。
      try { activateVideoBlockedFallbackModule(item, videoEl); } catch (_e) {}
    }
    if (hasAudioElSrc) {
      // Prime + play in the same user-initiated gesture chain (swipe /
      // wheel / arrow → watchQueueAdvanceModule → applyWatchQueueItem).
      // Each of those gestures is a valid user activation, so audio.play()
      // is allowed by the autoplay policy. Subsequent programmatic plays
      // from ended-handlers also work because this play() registers the
      // element as "user-activated" for the rest of the session.
      audioEl.src = __a1src;
      audioEl.muted = false;
      audioEl.load && audioEl.load();
      if (audioEl.play) {
        audioEl.play().catch((err) => {
          console.warn("[watch-queue] audio.play() rejected:", err);
          // CSSOS_WAVE_624 — 切歌被拒【绝大多数是加载竞态】(新 src 还没 canplay), 不是策略。
          // 先带声在 canplay 自动重试(原生 App / 已授权浏览器 → 直接出声, 无需点击);
          // 只有重试也失败【且从未解锁】才退到「提示 + 等手势」。
          var _swipeRetry = function () {
            try { audioEl.muted = false; audioEl.volume = 1; } catch (_e) {}
            var _rp = audioEl.play && audioEl.play();
            if (_rp && _rp.then) _rp.then(function () {
              globalThis.__cssosAudioUnlocked = true; globalThis.__cssosWatchAudioUnlocked = true;
              globalThis.__cssosWatchPendingUnmute = false;
              if (typeof globalThis.hideWatchSoundHintModule === "function") globalThis.hideWatchSoundHintModule();
            }).catch(function () { _swipeFallback(); });
          };
          var _onSwipeCP = function () { audioEl.removeEventListener("canplay", _onSwipeCP); _swipeRetry(); };
          var _swipeFallbackDone = false;
          var _swipeFallback = function () {
            if (_swipeFallbackDone) return; _swipeFallbackDone = true;
            // 已解锁过的会话绝不再提示/静默 — async 上下文过期不该惩罚用户。
            if (globalThis.__cssosWatchAudioUnlocked || globalThis.__cssosAudioUnlocked) return;
            // CSSOS_WAVE_588x/y — 任意手势恢复后带声续播并收起提示。
            globalThis.__cssosWatchPendingUnmute = true;
            if (typeof globalThis.showWatchSoundHintModule === "function") globalThis.showWatchSoundHintModule();
            try {
              if (!globalThis.__cssosAutoplayMutedReported && typeof globalThis.cssosReportError === "function") {
                globalThis.__cssosAutoplayMutedReported = true;
                globalThis.cssosReportError("Autoplay muted on swipe — sound waits for first tap.", "autoplay_muted");
              }
            } catch (_eRep) {}
            document.addEventListener("click", recover, true);
          };
          audioEl.addEventListener("canplay", _onSwipeCP);
          setTimeout(function () { if (audioEl.paused) _swipeRetry(); }, 300);
          const recover = () => {
            try { audioEl.muted = false; audioEl.volume = 1; } catch (_e) {}
            audioEl.play && audioEl.play().catch(() => {});
            globalThis.__cssosAudioUnlocked = true; globalThis.__cssosWatchAudioUnlocked = true;
            globalThis.__cssosWatchPendingUnmute = false;
            if (typeof globalThis.hideWatchSoundHintModule === "function") globalThis.hideWatchSoundHintModule();
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
        const mode = globalThis.cssosPlaylists.getMode();
        // CSSOS_WAVE_820 20260616 — Jing「连播到尽头不循环、停那不动了」根治。
        // 循环模式(loop_all/loop_single)下 next() 返回 null(活动列表到头/为空)
        // 绝不死停 —— 强制回到列表头继续循环(用户的核心预期: loop list 到底回头播)。
        // 只有顺序/倒序才提示到边界。
        if (mode === "loop_all" || mode === "loop_single") {
          try {
            const act = globalThis.cssosPlaylists.getActive && globalThis.cssosPlaylists.getActive();
            const first = act && Array.isArray(act.items) && act.items.length ? act.items[0] : null;
            if (first && globalThis.cssosPlaylists.seekTo) {
              globalThis.cssosPlaylists.seekTo(first.id);
              applyWatchQueueItemModule(first);
              return;
            }
          } catch (_eLoop) {}
        }
        if (typeof globalThis.showToast === "function") {
          // CSSOS_WAVE_273 20260521 — Jing(P2 i18n): 播放期 toast 统一双语。
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
  // CSSOS_WAVE_800 20260615 — Jing「连播十几首吃满内存」根治: 播放队列 __cssosWatchQueue.items 原本
  // 【只增不减】(每次 prefetch 往里压一页, index 只前进), 整场会话线性膨胀 → 数十首后 OOM。
  // 这里做【滑动窗口】: 只保留游标前 ~24 首已播历史, 更早的丢弃(信息流本就可丢, 末端 wrap 也只回到窗口头)。
  try {
    var _BEHIND = 24;
    if (__cssosWatchQueue.index > _BEHIND + 8) {
      var _drop = __cssosWatchQueue.index - _BEHIND;
      __cssosWatchQueue.items.splice(0, _drop);
      __cssosWatchQueue.index -= _drop;
    }
  } catch (_trimErr) {}
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
    // CSSOS_WAVE_1083a — Jing「5秒短视频先播, 放完无痕过渡到封面幻灯, 音频走全长」:
    //   补齐作品的视频是 seedance 5 秒短片, 音频是全长(几分钟)。视频静音、音频驱动声音(W406),
    //   但短视频的 'ended' 会先触发本回调 → 误以为歌放完了就切歌(=用户看到的"5秒跳")。守卫:
    //   若【音频还在放且离结束还有 >2s】, 这次 ended 必来自短视频 → 不切歌; 停掉视频(opacity:0
    //   让下层封面幻灯透出, cover-slideshow 兜底自动接管), 音频继续, 真正放完(audio.ended)才前进。
    try {
      const _a = document.getElementById("watch-audio-preview");
      if (_a && (_a.currentSrc || _a.src) && !_a.paused && !_a.ended
          && isFinite(_a.duration) && _a.duration > 8 && (_a.duration - _a.currentTime) > 2) {
        const _v = document.getElementById("watch-video");
        try {
          if (_v) { _v.loop = false; try { _v.pause && _v.pause(); } catch (_p) {} _v.style.opacity = "0"; }
        } catch (_ve) {}
        try { globalThis.cssmvStartCoverSlideshow && globalThis.cssmvStartCoverSlideshow(); } catch (_se) {}
        return;   // 短视频结束 ≠ 歌结束; 交给幻灯, 不切歌
      }
    } catch (_g) {}
    // CSSOS_WAVE_1057 — 插队优先播: 后台生成的作品在等"当前媒体放完", 此刻优先播它(插队在最前)。
    //   就绪则播, 没就绪(还没出齐)则让位常规连播, 绝不卡死。
    try {
      var _pr = globalThis.cssosPendingPriorityRun;
      if (_pr) {
        globalThis.cssosPendingPriorityRun = "";
        globalThis.cssosBackgroundGenEnqueueOnly = false;
        globalThis.cssosProtectedAudioSrc = "";
        globalThis.__cssosEndedSwitchLock = Date.now();   // 占锁, 防其它 ended 抢
        Promise.resolve(openCurrentGeneratedWatchPlaybackModule({ autoplay: true, preferVideo: true }))
          .then(function (ok) { if (!ok) void watchQueueAdvanceModule(+1); })
          .catch(function () { void watchQueueAdvanceModule(+1); });
        return;
      }
    } catch (_prErr) {}
    // CSSOS_WAVE_895 — 单点切歌锁(根治串台/黑屏): 一次 ended 只允许一路切歌。
    //   ① CTA 预选时, 让位给 up-next(它会切到预选那首), 自动前进绝不插手 → 不会"CTA 切 A + 自动切 B"。
    //   ② 否则用 2.5s 全局锁去重: audio/video/structured 多次 ended、以及手点 openMarketWorkPreview 撞 ended,
    //      只第一个 claim 锁的执行, 其余全部让位 → 永不两个 bind 竞态 → 后到 flush 不再清黑新视频。
    try {
      if (typeof globalThis.__cssosUpNextHasPreselect === "function" && globalThis.__cssosUpNextHasPreselect()) {
        console.warn("[watch-queue] CTA 预选存在 → 自动前进让位(up-next 接管)");
        return;
      }
      // 结构化(歌剧/三部曲多段)队列激活时, 让位给 queueStructuredWatchAdvanceModule(它管段内前进),
      // 本通用前进不抢锁, 否则会压掉多段播放。
      try { if (typeof structuredWatchQueueIsActiveModule === "function" && structuredWatchQueueIsActiveModule()) return; } catch (_se) {}
      var _endNow = Date.now();
      if (globalThis.__cssosEndedSwitchLock && (_endNow - globalThis.__cssosEndedSwitchLock) < 2500) {
        console.warn("[watch-queue] 2.5s 内已有切歌 → 本次 ended 去重让位");
        return;
      }
      globalThis.__cssosEndedSwitchLock = _endNow;
    } catch (_lockErr) {}
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
  videoEl.addEventListener("ended", function (e) { if (cssosShortVideoLoopGuard()) return; return onMediaEnded(e); });
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
    // CSSOS_WAVE_801 — Jing「彻底断掉 Web Audio」: 本函数依赖可视化建的 __cssosMediaSourceNode, 而
    // W801 已彻底停建任何 AudioContext/source → 这里永远拿不到 src, 等于死路。直接断掉, 绝不碰 Web Audio。
    // 情绪字幕的振幅/呼吸全部走后端逐字 volume 时间线(subtitle token.volume), 永不捕获播放元素。
    try { if (__cssosAnalyser && typeof __cssosAnalyser.disconnect === "function") __cssosAnalyser.disconnect(); } catch (_d) {}
    __cssosAnalyser = null; __cssosAmpBuf = null; __cssosFreqBuf = null;
    return;
    // eslint-disable-next-line no-unreachable
    if (!targetEl) return;
    if (__cssosWiredAudioEl === targetEl && __cssosAnalyser) return;
    // CSSOS_WAVE_667c 20260607 — 根治"放得出画面、进度在走, 就是没声音":
    // 原来本函数【自建第二个 AudioContext + createMediaElementSource】给情绪字幕做振幅分析。
    // 但一个 <audio> 元素的输出【只能被一个 AudioContext 捕获】, 且一旦被捕获, 声音只从那个图谱出。
    // 它和可视化的 watchMusicAudioContext 抢同一元素: 谁先抢到就拥有音频; 若抢到的是这个、又恰被
    // 浏览器挂起(suspended)→ 元素照常 paused:false 走时间, 声音却卡在哑掉的图谱里 = 全场静音。
    // 【修法】绝不自建 ctx/不自己 createMediaElementSource —— 只【复用】可视化已建的同 ctx 同 source
    // 多挂一个 analyser(同图谱内多分支不影响 destination 输出); 若可视化还没建 source, 就【放弃分析】,
    // 让音频走原生/可视化单一通道, 声音永不被劫持丢失。情绪字幕仍可用后端逐字 volume 数据。
    try {
      // CSSOS_WAVE_800 — Jing 内核内存审计: 切换音/视频元素时旧 AnalyserNode 未 disconnect → 留在
      // Web Audio 图谱里(有连接的节点不被 GC), 混音/视频混播放久了节点堆积。重连前先断开旧的。
      try { if (__cssosAnalyser && typeof __cssosAnalyser.disconnect === "function") __cssosAnalyser.disconnect(); } catch (_d) {}
      __cssosAnalyser = null; __cssosAmpBuf = null; __cssosFreqBuf = null;
      var ctx = (typeof watchMusicAudioContext !== "undefined") ? watchMusicAudioContext : null;
      var src = targetEl.__cssosMediaSourceNode;   // 可视化(ensureWatchMusicVisualizerModule)建的 source
      if (!ctx || !src) { __cssosAnalyser = null; return; }  // 没有共享 source → 不分析, 绝不劫持音频
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.55;
      src.connect(analyser);
      __cssosAnalyser = analyser;
      __cssosAmpBuf = new Uint8Array(analyser.fftSize);
      __cssosFreqBuf = new Uint8Array(analyser.frequencyBinCount);
      __cssosWiredAudioEl = targetEl;
      if (ctx.state === "suspended") { ctx.resume().catch(function () {}); }
    } catch (e) {
      __cssosAnalyser = null;
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
  // CSSOS_WAVE_838 20260616 — Jing: 别在每次进平台就偷偷预取播放队列。原本模块加载即
  // `fetchWatchQueueMoreModule()` → /api/works/mine?limit=500, 用户哪怕没开 MV 面板也白拉
  // (Jing 早察觉"进平台 MV 面板就在偷偷加载东西")。改为【MV/watch 面板首次真正打开时】才取一次。
  (function deferWatchQueuePrefetch() {
    var fired = false;
    function watchOpen() {
      var wp = document.getElementById("watch-panel");
      return !!(wp && !wp.classList.contains("hidden") && wp.style.display !== "none");
    }
    function fireOnce() {
      if (fired || !watchOpen()) return;
      fired = true;
      document.removeEventListener("cssos:panelopen", fireOnce, true);
      try { void fetchWatchQueueMoreModule(); } catch (_e) {}
    }
    if (watchOpen()) { fireOnce(); }          // 深链直接进 MV → 立即取
    else { document.addEventListener("cssos:panelopen", fireOnce, true); }
  })();
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
            "button, input, textarea, select, [role=button], #watch-pill-row-bl, #watch-take-toggle, #watch-aspect-pill, .watch-media-action, .watch-author-avatar, .cssmv-capsule, .cssmv-capsule-menu"
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
        // CSSOS_WAVE_438 — only attempt fullscreen inside an active user gesture;
        // a non-gesture call would still emit a console warning even though caught.
        var _ua = (typeof navigator !== "undefined" && navigator.userActivation);
        if (enter && !(_ua && _ua.isActive === false)) {
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
      if (ev.target && ev.target.closest && ev.target.closest("button, input, [role=button], #watch-pill-row-bl, #watch-take-toggle, #watch-aspect-pill, .cssmv-capsule, .cssmv-capsule-menu")) return;
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
  // CSSOS_WAVE_387 20260524 — Jing「胶囊宪法」: 信息浮层 + 人声/伴奏分轨从媒体框
  // 上的独立角标按钮收进 ⋯ 菜单(其余留在三点里), 让媒体框只剩一个右下角胶囊。
  // 这两项直接复用被隐藏的原按钮节点(仍保留其全部事件), 点击即触发其原逻辑。
  const _infoBtn = document.querySelector("#watch-panel .cssmv-info-btn");
  if (_infoBtn) {
    actions.push({
      icon: "ℹ️", label: loginCopy("Track info", "作品信息"),
      onClick: () => { try { _infoBtn.click(); } catch (_e) {} },
    });
  }
  const _stemBtn = document.getElementById("cssmv-stem-toggle");
  if (_stemBtn) {
    actions.push({
      icon: "🎤", label: loginCopy("Vocals / Instrumental", "人声 / 伴奏"),
      onClick: () => { try { _stemBtn.click(); } catch (_e) {} },
    });
  }
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
    // CSSOS_WAVE_826 20260616 — Jing「扩池改手动按钮 + 预算上限, 不再后台偷烧」: 一键给当前作品
    // 多生成 6 张幻灯帧(消耗 KIE 积分, 丰俭由人)。后台自动生成已默认关闭。
    actions.push({
      icon: "🖼️",
      label: loginCopy("Expand frame pool…", "扩展幻灯帧池…"),
      onClick: async () => {
        try {
          const wid = (typeof globalThis.cssosCurrentWorkId === "function") ? globalThis.cssosCurrentWorkId() : "";
          if (!wid) { globalThis.showToast?.(loginCopy("No work is playing", "当前没有正在播放的作品")); return; }
          // 丰俭由人: 选本次生成几张(硬上限 30/轮, 消耗 KIE 积分)。
          const ans = (typeof prompt === "function")
            ? prompt(loginCopy("How many frames to generate? (1–30, uses credits)", "本次生成几张?(1–30,消耗积分)"), "6")
            : "6";
          if (ans == null) return; // 用户取消
          const count = Math.max(1, Math.min(parseInt(String(ans), 10) || 6, 30));
          globalThis.showToast?.(loginCopy(`Generating ${count} frames… (uses credits)`, `正在生成 ${count} 张新帧…(消耗积分)`));
          const r = await fetch(`/api/works/${encodeURIComponent(wid)}/slideshow/generate`, {
            method: "POST", credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ count }),
          }).then((x) => x.json()).catch(() => null);
          globalThis.showToast?.(r && r.ok
            ? loginCopy("Frame pool expanding — new frames appear shortly", "帧池扩展中,稍后出现新帧")
            : loginCopy("Could not expand the pool, try again", "扩池失败,请稍后再试"));
        } catch (_e) {}
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
// CSSOS_WAVE_555 20260531 — 导出动作构建器, 供左下控制胶囊【摊平 ⋯】生成胶囊段。
globalThis.buildMediaActionsModule = buildMediaActionsModule;

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
    // W354/W356 — feed the full persisted cover pool (cdn.cssstudio.app frames,
    // 30 frames per work) so the slideshow actually cycles. Filter to persisted
    // URLs only (never-expiring); fall back to a single stable frame for legacy
    // works that only have third-party temporary links.
    const cover = String(item?.cover_url || item?.cover_image || item?.preview_image_url || "").trim();
    const poolRaw = Array.isArray(item?.cover_slides) ? item.cover_slides : [];
    const pool = poolRaw
      .map((u) => (typeof u === "string" ? u.trim() : ""))
      .filter(Boolean);
    // Only use frames from our own CDN — replicate/fal links expire and cause 404.
    const persistedPool = pool.filter((u) => /(^|\/\/|\.)cssstudio\.app\//.test(u) || u.startsWith("data:"));
    if (typeof globalThis.cssmvSetCoverSlides === "function") {
      if (persistedPool.length >= 2) {
        // Shuffle so each open starts on a different frame (视觉新鲜感).
        const shuffled = persistedPool.slice().sort(() => Math.random() - 0.5);
        globalThis.cssmvSetCoverSlides(shuffled);
      } else {
        const stable = cover || pool[0] || "";
        if (stable) globalThis.cssmvSetCoverSlides([stable]);
      }
      // CSSOS_WAVE_1005 — 必须【启动】幻灯, 否则 cssmvSetCoverSlides 仅在 mvActive 时渲染 →
      // 无视频作品仍黑屏。显式 start(幂等: 已启动则内部早退)。
      try { if (typeof globalThis.cssmvStartCoverSlideshow === "function") globalThis.cssmvStartCoverSlideshow({ mv: true, music: false }); } catch (_e2) {}
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
/* CSSOS_WAVE_749 — ID/标题块与头像同组显隐(影院态) */
#watch-panel.cssmv-cinema .watch-work-id,
#watch-panel.cssmv-cinema #watch-take-toggle,
/* W335 20260522 — ✕ and search box join the same opacity fade as avatar */
#watch-panel.cssmv-cinema #watch-exit-cinema,
/* CSSOS_WAVE_587 20260531 — Jing「有操作必显多语言/多声线胶囊」: 语言/声线选择器(#cssos-lang-fold)
   随影院 chrome 一起 idle 淡出 / 操作淡入(桌面 hover、App 轻触都会加 .is-hovering)。 */
#watch-panel.cssmv-cinema #cssos-lang-fold,
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
#watch-panel.cssmv-cinema.is-hovering .watch-work-id,
#watch-panel.cssmv-cinema.is-hovering #watch-take-toggle,
#watch-panel.cssmv-cinema.is-hovering #watch-exit-cinema,
#watch-panel.cssmv-cinema.is-hovering #cssos-lang-fold,
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
/* CSSOS_WAVE_538/540 20260531 — Jing 铁律: 情绪字幕 + 价格条绝不随 10s 无操作隐藏。
   ★情绪字幕 = 底部 #watch-subtitle(带 data-emotion 配色、跟随歌词实时显示, 本平台全球首创)——
   影院 + idle 下【永远可见、实时显示直到播放结束】。它是只显示不挡点击的覆盖层 → pointer-events:none。
   注意: #watch-karaoke-line 是【歌曲标题】, 每次随机换字体时闪现 10 秒(W332 设计, 正确行为),
   绝不在此常驻 —— 否则标题会一直挂着、不再随字体闪现。 */
#watch-panel.cssmv-cinema .watch-subtitle,
#watch-panel.cssmv-cinema:not(.is-hovering) .watch-subtitle {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: none !important;
  transition: none !important;
}
/* 价格条永远可见且可点击(保障交易/收入); 不强制 display, "无价格数据由 JS 设 display:none" 仍生效。 */
#watch-panel.cssmv-cinema #cssos-watch-price-strip,
#watch-panel.cssmv-cinema:not(.is-hovering) #cssos-watch-price-strip {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  transition: none !important;
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

/* CSSOS_WAVE_1135 — Jing 指令: 🎬 赠送作品版权 = 免费买断。我从【自己的作品】里挑一首,
 * 无偿把版权转给 TA(效果等同被买断, 只是不收钱)。挑作品 → 确认 → POST /api/works/:id/gift-ownership。 */
globalThis.cssosOpenWorkGiftModalModule = function (opts) {
  const o = opts || {};
  const recipientId = String(o.recipientId || o.userId || "").trim();
  const recipientName = String(o.recipientName || o.displayName || "").trim() || loginCopy("this user", "TA");
  if (!recipientId) { try { globalThis.showToast(loginCopy("Recipient unavailable.", "接收者不可用。")); } catch (_e) {} return; }
  document.querySelectorAll(".cssos-workgift-modal").forEach((el) => el.remove());

  const overlay = document.createElement("div");
  overlay.className = "cssos-workgift-modal";
  overlay.style.cssText = "position:fixed;inset:0;z-index:10054;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;font:500 14px/1.4 -apple-system,system-ui,sans-serif;color:rgba(255,255,255,0.95);";
  const card = document.createElement("div");
  card.style.cssText = "max-width:460px;width:100%;max-height:80vh;display:flex;flex-direction:column;background:rgba(15,18,24,0.98);border:1px solid rgba(255,200,120,0.4);border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,0.7);";
  overlay.appendChild(card);

  card.innerHTML =
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">' +
      '<span style="font-size:26px;">🎬</span>' +
      '<div style="flex:1;"><div style="font-weight:700;font-size:16px;">' +
        loginCopy(`Gift a work to ${escapeHtmlGift(recipientName)}`, `赠送作品给 ${escapeHtmlGift(recipientName)}`) +
      '</div><div style="font-size:11px;opacity:0.7;margin-top:2px;">' +
        loginCopy("Transfers full copyright — like a buyout, but free.", "转让完整版权 —— 相当于被买断,只是不收钱。") +
      "</div></div></div>" +
    '<div data-list style="flex:1;overflow-y:auto;margin:12px 0;display:flex;flex-direction:column;gap:8px;min-height:120px;">' +
      '<div style="opacity:0.6;font-size:12px;padding:18px 0;text-align:center;">' + loginCopy("Loading your works…", "正在加载你的作品…") + "</div>" +
    "</div>" +
    '<div data-error style="color:#ff8c8c;font-size:11px;min-height:14px;margin-bottom:6px;"></div>' +
    '<div style="display:flex;gap:8px;">' +
      '<button type="button" data-cancel style="flex:1;background:transparent;color:inherit;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px;cursor:pointer;font:inherit;">' + loginCopy("Cancel", "取消") + "</button>" +
      '<button type="button" data-send disabled style="flex:2;background:rgba(255,200,120,0.14);color:#fff;border:1px solid rgba(255,200,120,0.4);border-radius:8px;padding:10px;cursor:not-allowed;font-weight:700;font:inherit;opacity:0.6;">' + loginCopy("Gift this work 🎬", "赠送这首作品 🎬") + "</button>" +
    "</div>";

  const listEl = card.querySelector("[data-list]");
  const errEl = card.querySelector("[data-error]");
  const sendBtn = card.querySelector("[data-send]");
  let selectedId = "";
  let selectedTitle = "";

  const close = () => overlay.remove();
  card.querySelector("[data-cancel]").addEventListener("click", close);
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });

  const enableSend = () => {
    if (selectedId) {
      sendBtn.disabled = false;
      sendBtn.style.cursor = "pointer";
      sendBtn.style.opacity = "1";
      sendBtn.style.background = "rgba(255,200,120,0.22)";
      sendBtn.style.borderColor = "rgba(255,200,120,0.6)";
    }
  };

  // Load my works (only roots — gift a whole work, not a sub-part).
  (async () => {
    try {
      const r = await fetch("/api/works/mine?limit=200", { credentials: "include" });
      const j = await r.json().catch(() => null);
      const items = (j && (j.works || j.items || j.data)) || (Array.isArray(j) ? j : []);
      const roots = items.filter((w) => w && !w.parent_work_id && String(w.id || "").trim());
      if (!roots.length) {
        listEl.innerHTML = '<div style="opacity:0.6;font-size:12px;padding:18px 0;text-align:center;">' + loginCopy("You have no works to gift yet.", "你还没有可赠送的作品。") + "</div>";
        return;
      }
      listEl.innerHTML = "";
      roots.forEach((w) => {
        const id = String(w.id);
        const title = String(w.title || w.name || "Untitled").trim();
        const cover = String(w.cover_image || w.preview_image_url || "").trim();
        const row = document.createElement("button");
        row.type = "button";
        row.style.cssText = "display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px;cursor:pointer;color:inherit;font:inherit;";
        row.innerHTML =
          (cover ? '<img src="' + escapeHtmlGift(cover) + '" alt="" style="width:46px;height:46px;border-radius:7px;object-fit:cover;flex:0 0 auto;">'
                 : '<span style="width:46px;height:46px;border-radius:7px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;flex:0 0 auto;">🎵</span>') +
          '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">' + escapeHtmlGift(title) + "</span>";
        row.addEventListener("click", () => {
          selectedId = id; selectedTitle = title;
          Array.from(listEl.children).forEach((c) => { c.style.background = "rgba(255,255,255,0.05)"; c.style.borderColor = "rgba(255,255,255,0.12)"; });
          row.style.background = "rgba(255,200,120,0.18)";
          row.style.borderColor = "rgba(255,200,120,0.6)";
          enableSend();
        });
        listEl.appendChild(row);
      });
    } catch (_e) {
      listEl.innerHTML = '<div style="opacity:0.6;font-size:12px;padding:18px 0;text-align:center;">' + loginCopy("Failed to load your works.", "加载作品失败。") + "</div>";
    }
  })();

  sendBtn.addEventListener("click", async () => {
    if (!selectedId) return;
    errEl.textContent = "";
    sendBtn.disabled = true;
    sendBtn.textContent = loginCopy("Gifting…", "赠送中…");
    try {
      const r = await fetch("/api/works/" + encodeURIComponent(selectedId) + "/gift-ownership", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: recipientId }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok) {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(loginCopy(`🎬 Gifted "${selectedTitle}" to ${recipientName}`, `🎬 已把《${selectedTitle}》赠送给 ${recipientName}`));
        }
        close();
      } else {
        const code = (j && j.code) || ("HTTP " + r.status);
        const msg = code === "NOT_OWNER" ? loginCopy("You can only gift your own works.", "只能赠送你自己的作品。")
          : code === "CANNOT_GIFT_SELF" ? loginCopy("Can't gift to yourself.", "不能赠送给自己。")
          : code === "AUTH_REQUIRED" ? loginCopy("Sign in first.", "请先登录。")
          : loginCopy(`Failed: ${code}`, `赠送失败：${code}`);
        errEl.textContent = msg;
        sendBtn.disabled = false;
        sendBtn.textContent = loginCopy("Gift this work 🎬", "赠送这首作品 🎬");
      }
    } catch (_e) {
      errEl.textContent = loginCopy("Network error.", "网络错误。");
      sendBtn.disabled = false;
      sendBtn.textContent = loginCopy("Gift this work 🎬", "赠送这首作品 🎬");
    }
  });

  (document.fullscreenElement || document.body).appendChild(overlay);
};

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
  // CSSOS_WAVE_862 — 基础样式即锁正方(min/max 38px), 不写 left/top 绝对角落: 头像从诞生起就是
  // 圆形、为「进 For You 胶囊当圆头」准备。styleCircle() 仍会再钉一遍(进 pill 后)。Safari 椭圆根因
  // 之一 = 旧基础 width/height 40 无 min/max → 进 flex pill 被拉伸; 这里 min/max 锁死防拉伸。
  avatar.style.cssText =
    "position:absolute;left:12px;top:12px;" +   // 预挂载兜底角落; 进 pill 后 styleCircle 改 static
    "width:38px;height:38px;min-width:38px;max-width:38px;min-height:38px;max-height:38px;flex:0 0 38px;" +
    "box-sizing:border-box;" +
    "border-radius:50%;border:1.5px solid rgba(255,255,255,0.6);" +
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
      // CSSOS_WAVE_1133 — Jing 指令: 作者就是我自己、但作品数据没带头像时, 回退到登录账户头像
      //   (含 OAuth provider 的 picture)。否则我自己的作品头像总显首字母。
      if (!ownerAvatar && ownerId) {
        try {
          const _auth = (typeof globalThis.cssosAuthState === "function") ? globalThis.cssosAuthState() : globalThis.authState;
          const _meId = String(_auth?.user?.id || "").trim();
          if (_meId && _meId === ownerId) {
            ownerAvatar = String(_auth?.user?.avatar_url || _auth?.user?.avatar || _auth?.user?.picture || "").trim();
          }
        } catch (_e) {}
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
        // WAVE_445d 20260526 — fix avatar squish on iOS.
        // The button is display:flex; height:100% on an img inside flex
        // doesn't resolve to the button's 40px height, so the image was
        // compressed horizontally. Use absolute fill instead so the img
        // always covers the full 40×40 circle regardless of flex context.
        img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;";
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
      // W854 — 换歌重画头像后, 再上一次圆形(防 background/textContent 改写破坏圆形)。
      try { if (avatar.__styleCircle) avatar.__styleCircle(); } catch (_e) {}
      // CSSOS_WAVE_1132 — Jing 指令: 头像搬右轨后, 把【已正确解析】的作者头像/名/ID 暴露给右轨复用,
      //   right rail 不再自己从 currentWork 瞎猜(那字段常空)。来源 = 作品作者头像, 没有则回退登录账户头像。
      globalThis.__cssosWatchAuthorInfo = { ownerId: ownerId, ownerName: ownerName, ownerAvatar: ownerAvatar };
      try { document.dispatchEvent(new CustomEvent("cssos:author-info-changed")); } catch (_e) {}
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
        // CSSOS_WAVE_822 — Jing「进入别的用户作品中心 → 连播 TА 的全部作品」: 此前只从
        // 内存已加载的 feed 收集(不全)。这里异步拉取该创作者全量公开作品补全 scoped 列表,
        // 先即播(上面内存版), 拉到后 populate 替换为完整目录并保持当前这首的定位。
        try {
          fetch("/api/works/by-creator/" + encodeURIComponent(ownerId), { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
              if (data && data.ok && Array.isArray(data.items) && data.items.length && typeof pl.populate === "function") {
                const curId = (typeof globalThis.cssosCurrentWorkId === "function") ? globalThis.cssosCurrentWorkId() : "";
                pl.populate(newId, data.items);
                if (curId && typeof pl.seekTo === "function") pl.seekTo(curId);
              }
            })
            .catch(() => {});
        } catch (_eFetch) {}
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
    try { if (typeof globalThis.cssosCloseOtherPopups === "function") globalThis.cssosCloseOtherPopups(".cssos-author-menu"); } catch (_e) {}   // W1158 单弹窗

    // CSSOS_WAVE_1133 — Jing 指令: 菜单在【头像正下方】弹出, 不再跑左上角。
    //   真因: 右轨头像每 2.5s 重渲染, 点击后 await relationship 期间旧 av 被 detach →
    //   之后取 getBoundingClientRect() 全 0 → 菜单跑到左上角(0,0)。修: 在 await【之前】
    //   就把 anchor 的位置快照下来; 右轨在右侧 → 菜单右对齐 + 夹紧在视口内(可遮下方图标)。
    var anchorRect = null;
    try { var _ar = (anchorEl && anchorEl.getBoundingClientRect && anchorEl.getBoundingClientRect()); if (_ar && (_ar.width || _ar.height)) anchorRect = _ar; } catch (_e) {}

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
      // CSSOS_WAVE_1201 — Jing: 透明玻璃(同评论框/信息包), 去掉 backdrop blur(合成层 + 不再黑底)。
      "background:rgba(10,14,20,0.42)", "text-shadow:0 1px 4px rgba(0,0,0,0.7)",
      "border:1px solid rgba(255,255,255,0.14)", "border-radius:12px",
      "padding:6px", "box-shadow:0 12px 40px rgba(0,0,0,0.5)",
      "font:500 13px/1.4 -apple-system,system-ui,sans-serif",
      "color:rgba(255,255,255,0.95)", "user-select:none",
    ].join(";");
    // CSSOS_WAVE_1133 — 用 await 前的快照(anchorRect); 头像在右侧 → 菜单右对齐, 整体夹紧在视口内。
    const rect = anchorRect || { left: 12, right: 252, bottom: 54, top: 12 };
    const MW = 244, vw = window.innerWidth || 360, vh = window.innerHeight || 640;
    let mLeft = rect.left;
    if (rect.left > vw / 2) mLeft = rect.right - MW;          // 右侧头像 → 右对齐
    mLeft = Math.max(8, Math.min(mLeft, vw - MW - 8));        // 夹在视口内
    // CSSOS_WAVE_1201 — Jing「还遮挡右轨, 往左移一点」: 把菜单右边缘卡在右轨左侧 → 不盖右轨。
    try {
      var _rail = document.getElementById("cssos-watch-social-rail");
      if (_rail) { var _rr = _rail.getBoundingClientRect(); mLeft = Math.min(mLeft, Math.round(_rr.left - MW - 10)); mLeft = Math.max(8, mLeft); }
    } catch (_eRail) {}
    let mTop = Math.min(rect.bottom + 6, vh - 60);            // 头像正下方; 底部留点边
    menu.style.left = `${Math.round(mLeft)}px`;
    menu.style.top = `${Math.round(mTop)}px`;
    menu.dataset.anchorLeft = String(Math.round(mLeft));
    menu.dataset.anchorTop = String(Math.round(rect.bottom + 6));

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 12px 10px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px;font-weight:700;letter-spacing:0.02em;";
    // CSSOS_WAVE_1130 — Jing 指令: 菜单里的用户名也加图标(与 TikTok 风格右轨头像统一)。
    const hIcon = document.createElement("span");
    hIcon.textContent = "👤"; hIcon.style.cssText = "font-size:16px;width:20px;text-align:center;flex:0 0 auto;";
    const hName = document.createElement("span");
    hName.textContent = ownerName; hName.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    header.appendChild(hIcon); header.appendChild(hName);
    // CSSOS_WAVE_1131 — Jing 指令: 钱包余额颜色灯。绿=充足 / 橙=余额低(不够生成一首)/ 红=余额为0。
    //   隐私: 别人只见颜色灯; 自己额外见精确余额。红/橙时提示"可帮 TA 充值"(帮充值入口在 🎁 赠礼子菜单)。
    var wlvl = String(rel.wallet_level || "").toLowerCase();
    if (wlvl === "green" || wlvl === "orange" || wlvl === "red") {
      var wmap = {
        green:  { c: "#2ecc71", t: loginCopy("Wallet healthy", "钱包余额充足") },
        orange: { c: "#ff9f43", t: loginCopy("Wallet low — you can top up for them", "余额偏低 — 可帮 TA 充值") },
        red:    { c: "#ff5b5b", t: loginCopy("Wallet empty — you can top up for them", "余额为 0 — 可帮 TA 充值") },
      };
      var wi = wmap[wlvl];
      var dot = document.createElement("span");
      dot.title = wi.t;
      dot.style.cssText = "flex:0 0 auto;width:10px;height:10px;border-radius:50%;background:" + wi.c +
        ";box-shadow:0 0 6px " + wi.c + ";" + (wlvl !== "green" ? "animation:cssfxWalletPulse 1.6s ease-in-out infinite;" : "");
      header.appendChild(dot);
      // 自己看自己 — 显示精确余额数字。
      if (rel.is_self && typeof rel.wallet_balance_cents === "number") {
        var bal = document.createElement("span");
        var bc = rel.wallet_balance_cents;
        bal.textContent = bc >= 100 ? "$" + (bc / 100).toFixed(2) : "¢" + bc;
        bal.style.cssText = "flex:0 0 auto;font:600 11px/1 -apple-system,system-ui;color:" + wi.c + ";opacity:0.9;";
        header.appendChild(bal);
      }
      // 注入一次脉动动画(红/橙呼吸提示)。
      if (!document.getElementById("cssfx-wallet-pulse-css")) {
        var ws = document.createElement("style"); ws.id = "cssfx-wallet-pulse-css";
        ws.textContent = "@keyframes cssfxWalletPulse{0%,100%{opacity:1;}50%{opacity:0.35;}}";
        document.head.appendChild(ws);
      }
    }
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
          "background:rgba(10,14,20,0.42)", "text-shadow:0 1px 4px rgba(0,0,0,0.7)",
          "border:1px solid rgba(255,200,120,0.35)", "border-radius:12px",
          "padding:6px", "box-shadow:0 12px 40px rgba(0,0,0,0.5)",
          "font:500 13px/1.4 -apple-system,system-ui,sans-serif",
          "color:rgba(255,255,255,0.95)", "user-select:none",
        ].join(";");
        // CSSOS_WAVE_1133 — 子菜单贴着主菜单位置(别再用隐藏旧头像的 0,0)。夹紧视口。
        var _sw = 264, _vw = window.innerWidth || 360;
        var _sl = Math.max(8, Math.min(Number(menu.dataset.anchorLeft || 12), _vw - _sw - 8));
        sub.style.left = `${_sl}px`;
        sub.style.top = `${Number(menu.dataset.anchorTop || 54)}px`;
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

        // CSSOS_WAVE_1135 — 赠送作品版权: 我从自己的作品挑一首, 无偿转给 TA(=免费买断)。
        addSub("🎬", loginCopy("Gift a work's copyright (free buyout)", "赠送作品版权(免费买断)"), () => {
          if (typeof globalThis.cssosOpenWorkGiftModalModule === "function") {
            globalThis.cssosOpenWorkGiftModalModule({ recipientId: ownerId, recipientName: ownerName });
          } else if (typeof globalThis.showToast === "function") {
            globalThis.showToast(loginCopy("Work-gift flow coming soon.", "赠送作品 — 即将上线。"));
          }
        });

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
    // CSSOS_WAVE_1136 — Jing 指令: 菜单内容比预估 244px 宽得多(admin@… $1000.00) → 右对齐后右缘
    //   溢出屏幕被截。贴 DOM 后用【真实宽度】重新夹紧, 保证整窗完整显示在视口内。
    try {
      const aw = menu.offsetWidth || 244;
      const vw2 = window.innerWidth || 360;
      let lx2 = Math.round(rect.right - aw);            // 右对齐到头像右缘
      lx2 = Math.max(8, Math.min(lx2, vw2 - aw - 8));   // 夹紧: 左≥8, 右缘≤视口-8
      menu.style.left = `${lx2}px`;
      menu.dataset.anchorLeft = String(lx2);
    } catch (_e) {}
    // Click-outside-closes. CSSOS_WAVE_1156 — Jing: 点头像【子元素】(logo图/➕角标)时 ev.target≠anchorEl
    //   但仍在头像内 → 旧逻辑误判"点外面"先关, 然后头像 click 又开 → toggle 失效。把头像内部都算锚点。
    const onClickAway = (ev) => {
      // CSSOS_WAVE_1160 — Jing: 右轨每次重渲染会换掉头像 av, 旧 anchorEl 已 detach → 点新头像时
      //   这里误判"点外面"先关、再开 = toggle 失效。把【任何右轨头像 .csr-av】都算锚点。
      var inAnchor = ev.target === anchorEl || (anchorEl && anchorEl.contains && anchorEl.contains(ev.target))
        || (ev.target && ev.target.closest && ev.target.closest(".csr-av"));
      if (!menu.contains(ev.target) && !inAnchor) {
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
  // CSSOS_WAVE_1130 — Jing 指令: 头像搬到右轨(TikTok 风格)后, 点它要弹【原来这套作者菜单】。
  //   暴露开菜单器: 复用隐藏的 #watch-author-avatar 的 ownerId/title(refresh 持续更新), 锚到右轨头像。
  // CSSOS_WAVE_1163 — Jing 指令: 优先用调用方传入的【作品作者】id/名(右轨已正确解析); 仅在没传时
  //   才退回隐藏头像的 dataset(那个会自我兜底成登录用户, 是 bug 源, 故不作首选)。
  globalThis.cssosOpenWatchAuthorMenu = function (anchorEl, ownerId, ownerName) {
    try { refresh(); } catch (_e) {}
    var oid = String(ownerId || "").trim() || avatar.dataset.ownerId;
    var name = String(ownerName || "").trim()
      || (avatar.title || "").replace(/^By |\s—.*$/g, "").trim()
      || loginCopy("Author", "作者");
    return openMenu(oid, name, anchorEl || avatar);
  };
  screen.style.position = screen.style.position || "relative";
  screen.appendChild(avatar);
  // CSSOS_WAVE_854 — Jing 手绘: 头像在 Loop list 胶囊【里面】(圆形, 文字左边), 不是单独一段/顶头/椭圆。
  // 头像模块做【唯一所有者】: 把头像移进 #watch-playlist-pill 内最左, 圆形定死(aspect-ratio 防椭圆)。
  // 带重试(pill 由胶囊 consolidate 异步建)。styleCircle 暴露给 refresh, 换歌重画头像后再上一次圆形。
  function styleCircle() {
    try {
      // CSSOS_WAVE_907 — Jing「隐藏左上 For You pill; 头像/搜索框/关闭同一行」: 头像不再塞进 playlist pill,
      // 改作【顶部左侧独立工具栏圆头】, 与搜索框(top safe+4)、关闭 ✕(top:12 right:12)同一行。
      avatar.style.setProperty("position", "absolute", "important");
      avatar.style.setProperty("left", "12px", "important");
      avatar.style.setProperty("top", "calc(env(safe-area-inset-top,0px) + 8px)", "important");
      avatar.style.setProperty("right", "auto", "important");
      avatar.style.setProperty("bottom", "auto", "important");
      ["width", "height", "min-width", "max-width", "min-height", "max-height"].forEach(function (p) {
        avatar.style.setProperty(p, "40px", "important");
      });
      avatar.style.setProperty("box-sizing", "border-box", "important");
      avatar.style.setProperty("border-radius", "50%", "important");
      avatar.style.setProperty("margin", "0", "important");
      avatar.style.setProperty("z-index", "61", "important");   // 高于搜索框(60), 保证可点
      avatar.style.setProperty("transform", "none", "important");
      avatar.style.setProperty("overflow", "hidden", "important");
      avatar.style.setProperty("padding", "0", "important");
      avatar.style.setProperty("border-width", "1.5px", "important");
      var im = avatar.querySelector("img");
      if (im) { im.style.setProperty("width", "100%", "important"); im.style.setProperty("height", "100%", "important"); im.style.setProperty("object-fit", "cover", "important"); im.style.setProperty("border-radius", "50%", "important"); }
    } catch (_e) {}
  }
  avatar.__styleCircle = styleCircle;
  // CSSOS_WAVE_859 — Jing「真的进不去吗?」: 头像还在 For You 胶囊外有缝 = mount 之前 10s 重试窗到期、
  // 胶囊/pill 还没建出来就放弃了。改用 MutationObserver(不超时, pill 一出现立刻插入)+ 持续守护
  // (pill 被重建/头像被挪出 → 自动重插)。这是把头像【真正塞进 #watch-playlist-pill】的根治。
  function mountIntoPill() {
    // CSSOS_WAVE_907 — Jing「隐藏 For You pill, 头像移到顶部一行」: 不再把头像塞进 playlist pill(已隐藏)。
    // 头像保持在 .watch-screen 下、作顶部左侧独立工具栏圆头(styleCircle 定绝对定位)。这里只确保它在 screen 内 + 重上样式。
    try {
      if (screen && avatar.parentNode !== screen) screen.appendChild(avatar);
    } catch (_e) {}
    styleCircle();
    return true;
  }
  avatar.__mountIntoPill = mountIntoPill;
  mountIntoPill();
  try {
    var _mo = new MutationObserver(function () { mountIntoPill(); });
    _mo.observe(document.getElementById("watch-panel") || document.body, { childList: true, subtree: true });
  } catch (_e) {
    var _t = 0, _iv = setInterval(function () { _t++; if (mountIntoPill() && _t > 4 || _t > 80) clearInterval(_iv); }, 250);
  }
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
  // CSSOS_WAVE_752 — Jing「像 Sora 那样, 淡淡的若隐若现, 不仔细看看不到, 随机位置, 随换字体的
  // 频率随机换一个位置 + 换字体」。防盗用已由 fingerprint_hash(🔐 原产证明)机器可验证地扛着,
  // 所以画面水印纯为品牌曝光 → 做成极淡的浮水印, 去掉深色框/边框/模糊, 只留若隐若现的文字。
  chip.style.cssText = [
    "position:absolute", "left:8%", "top:14%", "right:auto", "bottom:auto",
    "display:flex", "align-items:baseline", "gap:5px",
    "max-width:52%", "min-width:0",
    "padding:0",
    "background:transparent", "border:0",
    "font:500 11px/1.25 -apple-system,system-ui,sans-serif",
    "color:rgba(255,255,255,0.13)",   /* W765 — Jing「水印更加淡一些, 隐隐约约」: 0.26→0.13 */
    "letter-spacing:0.05em",
    "text-shadow:0 1px 3px rgba(0,0,0,0.45)",
    "z-index:8",                      /* 衬在画面上, 低于所有控件 */
    "pointer-events:none",
    "user-select:none",
    "white-space:nowrap",
    "overflow:hidden",
    "text-overflow:ellipsis",
    "transition:left 1.4s ease, top 1.4s ease, opacity 1.4s ease",
  ].join(";");
  chip.innerHTML = '<span style="font-size:11px;opacity:0.8;">♪</span><span data-share-title style="overflow:hidden;text-overflow:ellipsis;"></span><span style="opacity:0.55;">·</span><span style="font-weight:700;letter-spacing:0.08em;">cssOS</span>';
  // Sora 式: 跟随【换字体频率】随机换位置 + 换字体。位置避开底部字幕区(下 22%)与右侧控件列。
  const reposition = () => {
    try {
      const x = (4 + Math.random() * 64).toFixed(1);   // 4%–68%(避右侧控件)
      const y = (8 + Math.random() * 62).toFixed(1);   // 8%–70%(避底部字幕)
      chip.style.left = x + "%";
      chip.style.top = y + "%";
      chip.style.right = "auto"; chip.style.bottom = "auto";
      // 顺带随机换个字体(尊重情绪字幕跟随开关)
      if (globalThis.cssosEmotionFontFollow !== false && typeof globalThis.cssosPickFontForChar === "function") {
        const te = chip.querySelector("[data-share-title]");
        if (te) { const f = globalThis.cssosPickFontForChar(te.textContent || "a"); if (f) te.style.fontFamily = f; }
      }
    } catch (_e) {}
  };
  screen.style.position = screen.style.position || "relative";
  screen.appendChild(chip);
  const refresh = () => {
    try {
      const ps = globalThis.cssosMvPipelinePanelState
        ? globalThis.cssosMvPipelinePanelState() : null;
      const title = String(ps?.title || "").trim()
        || String(document.getElementById("watch-title-text")?.textContent || "").trim()
        || "";
      // CSSOS_WAVE_750 — Jing「那些假标题改一下」: 过滤占位假标题(Watch / Untitled / css MV / MV Panel),
      // 假标题时整个胶囊隐藏(不显示 "(untitled)" 之类的尴尬占位)。
      const _bad = /^(watch|untitled|untitled mv|css ?mv|mv panel|now)$/i.test(title);
      const _ok = title && !_bad;
      const titleEl = chip.querySelector("[data-share-title]");
      if (titleEl) titleEl.textContent = _ok ? title : "";
      chip.style.display = _ok ? "flex" : "none";
    } catch (_e) {}
  };
  refresh();
  reposition();          // 进场即落在一个随机位置(不再钉在头像后面)
  // Re-render on common events that change current work.
  try {
    window.addEventListener("cssos:work-id-changed", refresh);
    window.addEventListener("cssmv:music-durations", refresh);
    document.addEventListener("cssmv:lyrics-updated", refresh);
    // CSSOS_WAVE_752 — 跟随【换字体频率】(restartAutoRotate 派发的 cssmv:font-shuffle)随机换位置 + 换字体。
    window.addEventListener("cssmv:font-shuffle", reposition, { passive: true });
    // 切歌时也换个新位置, 避免长期固定。
    window.addEventListener("cssos:work-id-changed", reposition);
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
  // WAVE_444c: align with the AI assistant FAB (fixed bottom:18px).
  // Use CSS env(safe-area-inset-bottom) so both land on the same visual row
  // on iPhone (home indicator) and Android nav bar.
  row.style.cssText =
    "position:absolute;left:12px;" +
    "bottom:max(18px,calc(env(safe-area-inset-bottom,0px) + 12px));" +
    "display:flex;align-items:center;gap:8px;z-index:30;flex-wrap:wrap;";
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
    // CSSOS_WAVE_822d — 一行 = 选择按钮 + (自定义列表)✕ 删除按钮。
    const rowWrap = document.createElement("div");
    rowWrap.style.cssText = "display:flex;align-items:center;";
    const row = document.createElement("button");
    row.type = "button";
    row.style.cssText =
      "flex:1 1 auto;text-align:left;padding:8px 14px;" +
      "background:transparent;border:none;color:inherit;font:inherit;cursor:pointer;";
    row.textContent = `${l.id === active ? "●" : "○"} ${l.name} (${l.count})`;
    row.addEventListener("click", () => {
      globalThis.cssosPlaylists.setActive(l.id);
      menu.remove();
    });
    rowWrap.appendChild(row);
    // CSSOS_WAVE_822c — builtin 列表计数为 0(如 Epic 尚未预取)→ 打开菜单即拉取, 拉到后更新文字。
    // 不再依赖启动预取时机, 计数永远准。
    if (l.builtin && (!l.count) && typeof globalThis.cssosPlaylists.refresh === "function") {
      Promise.resolve(globalThis.cssosPlaylists.refresh(l.id)).then(() => {
        try {
          const fresh = (globalThis.cssosPlaylists.lists() || []).find((x) => x.id === l.id);
          if (fresh && row.isConnected) row.textContent = `${l.id === active ? "●" : "○"} ${fresh.name} (${fresh.count})`;
        } catch (_e) {}
      }).catch(() => {});
    }
    // CSSOS_WAVE_822d — Jing「进入某用户作品中心播一首 → 以收藏名义出现在这里, 可删除」:
    // 自定义列表(含 ✨创作者 scoped 列表)挂 ✕ 删除按钮。
    if (!l.builtin) {
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "✕";
      del.title = loginCopy("Remove list", "删除此列表");
      del.style.cssText = "flex:0 0 auto;padding:8px 12px;background:transparent;border:none;color:rgba(255,120,120,0.85);font:inherit;cursor:pointer;";
      del.addEventListener("click", (ev) => {
        ev.stopPropagation();
        try { globalThis.cssosPlaylists.removeCustom(l.id); } catch (_e) {}
        try { rowWrap.remove(); } catch (_e) {}
      });
      rowWrap.appendChild(del);
    }
    menu.appendChild(rowWrap);
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
    // CSSOS_WAVE_544 — Jing: 若作品已入库画幅(aspect_ratio/分辨率)→ storedAspect 优先,
    // 不再退回设备默认 16:9。仅当既无用户覆盖、无视频真实尺寸、也无入库画幅时才用设备默认。
    // CSSOS_WAVE_1015 20260619 — Jing「全变 16:9/9:16, 要桌面 2.39:1 / App device-fit」根治:
    //   视口规则现在是【唯一权威】,只有用户手动改画幅(transform pill)才让位。不再因为
    //   源视频真实尺寸(多半 16:9)或入库画幅就把画框改回 16:9/9:16 —— 那两条覆盖已停用
    //   (applyVideoSourceAspectModule / applyStoredWorkAspectModule 改为重跑本规则)。
    //   源画面一律 object-fit:cover 裁切填充到目标画框。
    if (!frame.dataset.userOverrodeAspect) {
      // 横屏/桌面 = 超宽电影 2.39:1;竖屏/App = 适配屏幕(填满,device-fit)。
      if (isPortraitDevice) {
        frame.style.aspectRatio = "";          // 竖屏: 适配/填满设备屏幕
        frame.style.maxHeight = "";
        frame.dataset.orientation = "portrait";
        frame.dataset.aspect = "fit";
        __cssosAspectIdx = 1;
      } else {
        frame.style.aspectRatio = "2.39 / 1";  // 横屏: 超宽电影格式
        frame.style.maxHeight = "65vh";
        frame.dataset.orientation = "ultra-wide";
        frame.dataset.aspect = "2.39x1";
        __cssosAspectIdx = 0;
      }
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
    // CSSOS_WAVE_1015 20260619 — Jing: 不再用视频真实尺寸改画框(那是"全变 16:9"的真凶)。
    //   画框比例由视口规则决定(桌面 2.39:1 / App device-fit),源画面用 object-fit:cover 裁切填充。
    const apply = () => {
      const w = Number(videoEl.videoWidth || 0);
      const h = Number(videoEl.videoHeight || 0);
      if (w < 8 || h < 8) return;
      if (frame.dataset.userOverrodeAspect) return;
      videoEl.style.objectFit = "cover";
      videoEl.style.width = "100%";
      videoEl.style.height = "100%";
      try { applyWatchFrameOrientationModule(); } catch (_e) {}  // 重跑视口规则, 不跟随源比例
    };
    if (videoEl.readyState >= 1) apply();
    else videoEl.addEventListener("loadedmetadata", apply, { once: true });
  } catch (_e) {}
}

// CSSOS_WAVE_544 20260531 — Jing「桌面默认电影超宽 2.39:1, 但回放全变 16:9 / App 拉伸成 9:16」
// 根因: 画幅信息(aspect_ratio/frame_width/frame_height/orientation)此前从不入库 → 回放无从还原。
// 现已入库, 这里在【加载作品时】用入库画幅设定 watch-frame 比例, 让纯音频幻灯作品也能正确显示
// 真实比例(不再退回设备默认 16:9)。视频作品的真实尺寸 loadedmetadata 仍会进一步精修(更准)。
function applyStoredWorkAspectModule(work) {
  // CSSOS_WAVE_1015 20260619 — Jing「显示画幅按视口固定, 别跟随入库/源比例」: 不再用入库
  //   aspect_ratio/frame_width/height 改画框(那会让横屏退回 16:9、竖屏 9:16)。画框统一由
  //   视口规则决定(桌面 2.39:1 / App device-fit), 源画面 object-fit:cover 裁切填充。
  //   保留函数签名(多处调用), 改为重跑视口规则。用户手动改画幅(transform pill)仍优先。
  try {
    const frame = document.querySelector("#watch-panel .watch-frame");
    if (!frame || frame.dataset.userOverrodeAspect) return;
    applyWatchFrameOrientationModule();
  } catch (_e) {}
}
globalThis.applyStoredWorkAspectModule = applyStoredWorkAspectModule;

// CSSOS_WAVE_558 20260531 — Jing: 媒体规格 📐【点击循环】比例: 适配 → 2.39:1 → 16:9 → 1:1 → 9:16。
// 自包含全局(此前 __cssosCycleAspect 从未定义 → 📐 不出现/不工作)。设 watch-frame 的 aspect-ratio +
// 标 userOverrodeAspect, 让 W544 的入库画幅还原让位用户手选。
(function () {
  var CYCLE = [
    { id: "fit",   label: "Fit",     ar: "" },          // 适配设备(清除强制比例)
    { id: "2.39x1",label: "2.39:1",  ar: "2.39 / 1" },
    { id: "16x9",  label: "16:9",    ar: "16 / 9" },
    { id: "1x1",   label: "1:1",     ar: "1 / 1" },
    { id: "9x16",  label: "9:16",    ar: "9 / 16" }
  ];
  globalThis.__cssosCycleAspect = function () {
    try {
      var frame = document.querySelector("#watch-panel .watch-frame");
      if (!frame) return;
      var cur = String(frame.dataset.aspectCycleId || "fit");
      var i = CYCLE.findIndex(function (c) { return c.id === cur; });
      var next = CYCLE[(i + 1) % CYCLE.length];
      frame.dataset.aspectCycleId = next.id;
      frame.dataset.userOverrodeAspect = "1"; // 用户手选优先于入库画幅/设备默认
      if (next.ar) {
        frame.style.aspectRatio = next.ar;
        frame.dataset.aspect = next.id;
        var r = next.ar.split("/").map(function (n) { return parseFloat(n); });
        var ratio = (r[0] && r[1]) ? r[0] / r[1] : 1;
        frame.dataset.orientation = ratio >= 2.2 ? "ultra-wide" : ratio > 1.1 ? "landscape" : ratio >= 0.95 ? "square" : "portrait";
        frame.style.maxHeight = ratio >= 2.2 ? "55vh" : ratio > 1.1 ? "65vh" : ratio >= 0.95 ? "75vh" : "85vh";
      } else {
        // 适配: 清除强制比例, 让设备/视频真实尺寸接管。
        frame.style.aspectRatio = "";
        delete frame.dataset.userOverrodeAspect;
        try { if (typeof applyVideoSourceAspectModule === "function") applyVideoSourceAspectModule(); } catch (_e) {}
      }
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast((typeof loginCopy === "function" ? loginCopy("Aspect", "媒体规格") : "Aspect") + " " + next.label);
      }
    } catch (_e) {}
  };
})();
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

// CSSOS_WAVE_450 20260527 — Jing: iOS WKWebView jetsam 修复.
// 根因: DOM 里同时存在 mirror-video(login) + foryou-thumb-video(ForYou) +
// watch-video(MV) 三个视频解码器 + 两个 audio, iOS 一旦进入 MV 面板加载大视频时
// 内存超限 → 系统 jetsam 强杀 WKWebView 进程 → 整个 app 黑屏/闪退(无 beforeunload).
// 修复: 进入 MV 面板时把其余背景视频的 src 清空, 释放解码器; 关闭面板时恢复.
// 只在 iOS native (Capacitor) 下触发, 桌面浏览器不受影响.
const __cssosBgVideoIdsForMv = ["foryou-thumb-video", "mirror-video"];
function suspendBgVideosForMvModule() {
  if (!document.documentElement.classList.contains("cssos-app")) return;
  __cssosBgVideoIdsForMv.forEach((id) => {
    const v = document.getElementById(id);
    if (!v) return;
    if (!v.__cssosMvSuspendedSrc) {
      v.__cssosMvSuspendedSrc = v.src || v.currentSrc || "";
      v.__cssosMvSuspendedSrcs = Array.from(v.querySelectorAll("source")).map((s) => ({ el: s, src: s.src }));
    }
    try { v.pause(); } catch (_e) {}
    v.src = "";
    v.load();
  });
}
function restoreBgVideosForMvModule() {
  if (!document.documentElement.classList.contains("cssos-app")) return;
  __cssosBgVideoIdsForMv.forEach((id) => {
    const v = document.getElementById(id);
    if (!v || !v.__cssosMvSuspendedSrc) return;
    const was = v.__cssosMvSuspendedSrc;
    v.__cssosMvSuspendedSrc = null;
    if (was) { v.src = was; v.load(); try { v.play().catch(() => {}); } catch (_e) {} }
  });
}

// ─── CSSOS_WAVE_452 20260527 — Jing: MV 管线断点续跑 + 延迟扣费客户端 ─────────
// 每个阶段完成后 checkpointMvPipelineRun() → 累计到 DB.
// 全部完成后 completeMvPipelineRun() → 一次性扣费.
// 开新管线时 abandonMvPipelineRun() → 旧 run 不扣费.
// 面板打开时 checkPendingMvPipelineRunModule() → 检查未完成 run → 提示续跑.

let __cssosMvPipelineRunId = "";
let __cssosMvResumeCheckDone = false;

globalThis.startMvPipelineRun = function(runId) {
  __cssosMvPipelineRunId = String(runId || "").trim() || ("run_" + Date.now().toString(36));
  try { sessionStorage.setItem("cssos_mv_run_id", __cssosMvPipelineRunId); } catch (_) {}
  return __cssosMvPipelineRunId;
};

globalThis.getCurrentMvPipelineRunId = function() {
  if (!__cssosMvPipelineRunId) {
    try { __cssosMvPipelineRunId = sessionStorage.getItem("cssos_mv_run_id") || ""; } catch (_) {}
  }
  return __cssosMvPipelineRunId;
};

globalThis.checkpointMvPipelineRun = async function(stageDone, stageResult, costCents) {
  const runId = globalThis.getCurrentMvPipelineRunId();
  if (!runId) return;
  try {
    await fetch("/api/mv/pipeline-run/checkpoint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        run_id: runId,
        stage_done: stageDone || null,
        stage_result: stageResult || null,
        cost_cents: costCents || 0,
      }),
    });
  } catch (_) {}
};

globalThis.completeMvPipelineRun = async function() {
  const runId = globalThis.getCurrentMvPipelineRunId();
  if (!runId) return;
  __cssosMvPipelineRunId = "";
  try { sessionStorage.removeItem("cssos_mv_run_id"); } catch (_) {}
  try {
    const r = await fetch(`/api/mv/pipeline-run/${encodeURIComponent(runId)}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const j = await r.json().catch(() => ({}));
    if (j && j.charged_cents > 0) {
      console.log(`[mv-pipeline] billed ${j.charged_cents}¢ for run ${runId}`);
    }
  } catch (_) {}
};

globalThis.abandonMvPipelineRun = async function(runId) {
  const id = String(runId || globalThis.getCurrentMvPipelineRunId() || "").trim();
  if (!id) return;
  if (!runId) {
    __cssosMvPipelineRunId = "";
    try { sessionStorage.removeItem("cssos_mv_run_id"); } catch (_) {}
  }
  try {
    await fetch(`/api/mv/pipeline-run/${encodeURIComponent(id)}/abandon`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  } catch (_) {}
};

// Inject pipeline_run_id into every /api/mv/{lyrics,music,video,cover} POST.
(function __patchMvFetchForPipelineRunId() {
  if (globalThis.__cssosMvPipelineRunIdPatchWired) return;
  globalThis.__cssosMvPipelineRunIdPatchWired = true;
  const _orig = globalThis.fetch;
  if (typeof _orig !== "function") return;
  const MV_ENDPOINTS = ["/api/mv/lyrics", "/api/mv/music", "/api/mv/video", "/api/mv/cover"];
  globalThis.fetch = function(input, init) {
    try {
      const url = typeof input === "string" ? input : ((input && input.url) || "");
      const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (method === "POST" && MV_ENDPOINTS.some((e) => url.indexOf(e) !== -1) && init && typeof init.body === "string") {
        const runId = globalThis.getCurrentMvPipelineRunId();
        if (runId) {
          try {
            const obj = JSON.parse(init.body);
            if (obj && typeof obj === "object" && !obj.pipeline_run_id) {
              obj.pipeline_run_id = runId;
              init = Object.assign({}, init, { body: JSON.stringify(obj) });
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
    return _orig.call(this, input, init);
  };
})();

async function checkPendingMvPipelineRunModule() {
  if (__cssosMvResumeCheckDone) return;
  __cssosMvResumeCheckDone = true;
  try {
    const r = await fetch("/api/mv/pipeline-run/pending");
    if (!r.ok) return;
    const j = await r.json().catch(() => ({}));
    const run = j && j.run;
    if (!run || !run.run_id) return;
    const stages = Array.isArray(run.stages_done) ? run.stages_done : [];
    if (stages.length === 0) return;
    const stageLabels = { lyrics: "Lyrics", cover: "Cover", music: "Music", video: "Video", kara: "Final" };
    const doneList = stages.map((s) => stageLabels[s] || s).join(", ");
    const staleMin = Math.round(Number(run.stale_seconds || 0) / 60);
    const timeAgo = staleMin < 1 ? tr("pipeline.resume.justNow") || "just now"
                  : staleMin < 60 ? `${staleMin} ${tr("pipeline.resume.minutesAgo") || "min ago"}`
                  : `${Math.round(staleMin / 60)} ${tr("pipeline.resume.hoursAgo") || "hr ago"}`;
    const msg = (tr("pipeline.resume.prompt") ||
      "Previous generation interrupted ({stages}, {time}). Resume?")
      .replace("{stages}", doneList)
      .replace("{time}", timeAgo);
    showWatchResumeToastModule(run, msg);
  } catch (_) {}
}

function showWatchResumeToastModule(run, msg) {
  const existing = document.getElementById("mv-pipeline-resume-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "mv-pipeline-resume-toast";
  toast.style.cssText = [
    "position:absolute", "bottom:88px", "left:50%", "transform:translateX(-50%)",
    "background:rgba(0,0,0,0.88)", "color:#fff",
    "border:1px solid rgba(0,245,160,0.35)", "border-radius:14px",
    "padding:12px 16px", "display:flex", "flex-direction:column", "gap:10px",
    "z-index:9999", "max-width:320px", "width:90%",
    "font-size:13px", "line-height:1.4",
    "backdrop-filter:blur(8px)", "-webkit-backdrop-filter:blur(8px)",
  ].join(";");
  const msgEl = document.createElement("div");
  msgEl.textContent = msg;
  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end";
  const discardBtn = document.createElement("button");
  discardBtn.textContent = tr("pipeline.resume.discard") || "Discard";
  discardBtn.style.cssText = "background:transparent;border:1px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.7);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer";
  discardBtn.addEventListener("click", () => {
    toast.remove();
    globalThis.abandonMvPipelineRun(run.run_id);
  });
  const resumeBtn = document.createElement("button");
  resumeBtn.textContent = tr("pipeline.resume.continue") || "Continue";
  resumeBtn.style.cssText = "background:rgba(0,245,160,0.22);border:1px solid rgba(0,245,160,0.45);color:#00f5a0;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600";
  resumeBtn.addEventListener("click", () => {
    toast.remove();
    __cssosMvPipelineRunId = run.run_id;
    try { sessionStorage.setItem("cssos_mv_run_id", run.run_id); } catch (_) {}
    // Broadcast resume event so the pipeline orchestrator can skip done stages.
    document.dispatchEvent(new CustomEvent("cssos:mv-pipeline-resume", {
      detail: { run_id: run.run_id, stages_done: run.stages_done || [], stage_results: run.stage_results || {}, params: run.params || {} },
      bubbles: true,
    }));
  });
  btnRow.append(discardBtn, resumeBtn);
  toast.append(msgEl, btnRow);
  (document.getElementById("watch-panel") || document.body).appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 30000);
}

function openWatchPanelShellModule(restoredLayout = false) {
  if (!watchPanel) return;
  // CSSOS_WAVE_450: free background video decoders before loading MV content.
  suspendBgVideosForMvModule();
  watchPanel.classList.remove("hidden");
  watchPanel.dataset.minimized = "false";
  prepareWatchPanelForOpen(restoredLayout);
  wireWatchSwipeOnceModule();
  wireWatchOrientationOnceModule();
  ensureTransformPillModule();
  // CSSOS_WAVE_452: check for incomplete pipeline run once per session.
  setTimeout(checkPendingMvPipelineRunModule, 800);
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
  // CSSOS_WAVE_454 20260527 — Jing: 手机/平板上 pipeline panel 自动弹出会遮挡
  // Watch 面板整块黑屏 → 用户看不到内容。移动端只在管线「正在运行」时才弹；
  // 桌面端保持原行为(每次进入都弹, 方便查看历史矩阵)。
  try {
    const pipelinePanel = document.getElementById("mv-pipeline-panel");
    const _isMobile = isMobileWatchEnvironmentModule?.() ?? false;
    const _hasActiveRun = !!(
      globalThis.activePipelineRunId ||
      globalThis.__cssosMvPipelineRunId ||
      (pipelinePanel && pipelinePanel.dataset.pipelineActive === "true")
    );
    if (pipelinePanel && pipelinePanel.classList.contains("hidden") && (!_isMobile || _hasActiveRun)) {
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
  // CSSOS_WAVE_556 20260531 — Jing 铁律「MV 面板里任何操作都不暂停正在播放的媒体, 哪怕遮住画面」。
  // 旧逻辑是【黑名单】(列举所有控件)→ 每加一个新覆盖层/弹窗就得补名单, 漏一个就误暂停。
  // 改为【正向白名单】: 只有点到【裸媒体面】(屏幕空白/视频/封面/背景)或【▶/⏸ 播放按钮本身】
  // 才允许往下走切换播放; 其它任何东西(控件/胶囊/菜单/弹窗/任意覆盖层)一律 return 不暂停 →
  // 以后新增浮层自动安全, 无需维护名单。
  try {
    const t = ev && ev.target;
    if (t && typeof t.closest === "function") {
      const isPlayBtn = !!t.closest(".watch-overlay-play");
      const isBareSurface =
        t === ev.currentTarget ||
        (typeof t.matches === "function" && t.matches(
          ".watch-screen, #watch-video, .watch-video, #watch-svg, .watch-svg, " +
          "#watch-screen-backdrop, .watch-screen-backdrop"
        ));
      if (!isPlayBtn && !isBareSurface) {
        return; // 不是裸媒体面、也不是播放按钮 → 是某个控件/浮层 → 不打断播放
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
      // CSSOS_WAVE_746 — Jing「所有创作入口必须统一: 点输出 MV 就一点击进入 MV 面板 6 胶囊进度
      // 正在输出的界面」。根因: 旧默认 hidden:true(后台静默) → 大量入口看不到进度。新规则:
      //   • 已在【真全屏影院】(document.body.dataset.cinema==="true") → 后台静默出片, 不打断当前播放;
      //   • 否则 → cinema:true, 打开 6 胶囊进度界面(新默认)。
      //   • 调用方可显式 showMvPipeline:false / backgroundMvPipeline:true 强制后台(保留 opt-out)。
      var _inTrueCinema = !!(document.body && document.body.dataset && document.body.dataset.cinema === "true");
      var _wantBackground = _inTrueCinema
        || options?.showMvPipeline === false
        || options?.backgroundMvPipeline === true;
      globalThis.openMvPipelinePanel({
        autoStart: options?.autoStartMvPipeline !== false,
        seed: mergedSeed,
        cinema: !_wantBackground,
        focus: _wantBackground ? (options?.focusMvPipeline === true) : true,
        hidden: _wantBackground
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
    // CSSOS_WAVE_588 — 引导式: 歌词生成失败 → [重新生成](重调本函数)。
    if (typeof globalThis.cssosToastRetry === "function") globalThis.cssosToastRetry(t("watch.toast.regenerateLyricsFailed"), function () { regenerateLyricsForWatchModule(); });
    else showToast(t("watch.toast.regenerateLyricsFailed"));
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
  // CSSOS_WAVE_895 — 单点切歌锁: CTA 预选时让位; 2.5s 内已有切歌则去重让位(防与 onMediaEnded/手点撞车)。
  try {
    if (typeof globalThis.__cssosUpNextHasPreselect === "function" && globalThis.__cssosUpNextHasPreselect()) return;
    var _qsNow = Date.now();
    if (globalThis.__cssosEndedSwitchLock && (_qsNow - globalThis.__cssosEndedSwitchLock) < 2500) return;
    globalThis.__cssosEndedSwitchLock = _qsNow;
  } catch (_qsLockErr) {}
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
  // CSSOS_WAVE_1057 — 后台代次防抢播: 用户正在听【别的作品】时, 这次生成的作品不抢播,
  //   而是插队进优先队列(cssosPendingPriorityRun), 等当前媒体放完由 onMediaEnded 顶部钩子优先播。
  //   仅当 enqueue-only 标记在 + 被保护的音频仍在播 时拦截; 否则解除标记走正常逻辑(冷启动不受影响)。
  if (globalThis.cssosBackgroundGenEnqueueOnly) {
    const _au = watchAudioPreview;
    const _cur = _au ? String(_au.currentSrc || _au.src || "") : "";
    const _stillProtected = !!(_au && !_au.paused && _cur && _cur === String(globalThis.cssosProtectedAudioSrc || ""));
    if (_stillProtected) {
      if (candidateRunId) globalThis.cssosPendingPriorityRun = candidateRunId;
      try {
        document.dispatchEvent(new CustomEvent("cssos:cinema-queue", { detail: {
          runId: candidateRunId, priority: true,
          title: String(state.songSeed?.title || state.title || "").trim(),
        }}));
      } catch (_e) {}
      console.warn("[watch-queue] 后台新作品插队 up-next, 当前媒体放完再优先播(不抢播)");
      return false;
    }
    globalThis.cssosBackgroundGenEnqueueOnly = false;
  }
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
  // CSSOS_WAVE_791 — Jing「只播 5s Seedance 视频, ended 就跳歌」安全网: 当有真实独立音轨在播时,
  // 短视频(<45s, 画音分层下纯视觉环)的 ended 绝不切歌 —— 改为循环垫画面, 切歌交给 audio.ended。
  watchVideo.addEventListener("ended", function (e) {
    if (cssosShortVideoLoopGuard()) return;
    return queueStructuredWatchAdvanceModule(e);
  });
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
  // CSSOS_WAVE_556 20260531 — Jing: ✦ 小星星【点击 = 弹出字体/风格设置小窗口】(不再直接循环切字体)。
  // 锚定在按钮自身位置打开菜单。原"循环切字体"行为保留给程序内部/其它入口, 不再绑在点击上。
  watchStyleShift?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const r = watchStyleShift.getBoundingClientRect();
      openWatchStyleMenuModule(Math.round(r.left), Math.round(r.top), "all");
    } catch (_e) {
      try { openWatchStyleMenuModule(event.clientX, event.clientY, "all"); } catch (_e2) {}
    }
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
      // CSSOS_WAVE_1001 — watch 面板不可见时不旋转进度环(没人看的 DOM/CSS 写), 省内存。
      try {
        var _wp = document.getElementById("watch-panel");
        if ((_wp && _wp.classList.contains("hidden")) || document.hidden) return;
      } catch (_e) {}
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

// CSSOS_WAVE_543 20260531 — Jing「切歌时上一首的首帧(封面)总要先闪一下才播新媒体」:
// video 元素换 src 时, 解码前会残留显示【上一首的首帧】。修法: 换 src 前先隐藏 video
// (.cssos-video-swapping → opacity:0, 底下稳定封面 backdrop 透出 → 不黑屏、不闪旧帧),
// 等新视频真正 playing(或 4s 兜底)再淡入。幂等; 含安全兜底防止永久隐藏。
function cssosEnsureWatchVideoSwapStyle() {
  if (globalThis.__cssosVideoSwapStyleInstalled || typeof document === "undefined") return;
  globalThis.__cssosVideoSwapStyleInstalled = true;
  try {
    // 注: style.watch.css 实际未被加载, 故规则在此注入, 确保生效(与 W538 影院规则同款)。
    var st = document.createElement("style");
    st.id = "cssos-video-swap-style";
    st.textContent =
      "#watch-video.watch-video{transition:opacity .26s ease;}" +
      "#watch-video.cssos-video-swapping{opacity:0 !important;}";
    (document.head || document.documentElement).appendChild(st);
  } catch (_e) {}
}
function cssosBeginWatchVideoSwap() {
  cssosEnsureWatchVideoSwapStyle();
  var v = (typeof watchVideo !== "undefined" && watchVideo) || document.getElementById("watch-video");
  if (!v) return;
  try {
    v.classList.add("cssos-video-swapping");
    if (v.__cssosSwapTimer) { clearTimeout(v.__cssosSwapTimer); v.__cssosSwapTimer = null; }
    var reveal = function () {
      try {
        v.classList.remove("cssos-video-swapping");
        v.removeEventListener("playing", reveal);
        v.removeEventListener("loadeddata", reveal);
        if (v.__cssosSwapTimer) { clearTimeout(v.__cssosSwapTimer); v.__cssosSwapTimer = null; }
      } catch (_e) {}
    };
    v.addEventListener("playing", reveal);   // 真正出动画帧才淡入
    v.addEventListener("loadeddata", reveal); // 静音/无 playing 时也兜底淡入(已有真实帧)
    // 安全兜底: 4s 内若都没触发(加载失败/纯音频隐藏 video), 也撤掉隐藏避免永久空白。
    v.__cssosSwapTimer = setTimeout(reveal, 4000);
  } catch (_e) {}
}
globalThis.cssosBeginWatchVideoSwap = cssosBeginWatchVideoSwap;

function setWatchVideoFromArtifact(uri, options = {}) {
  if (!watchVideo || !uri) return false;
  const isLocalFallback = uri === LOCAL_FALLBACK_MP4;
  const sourceKind = options.sourceKind || (isLocalFallback ? "local-fallback" : "artifact");
  currentPreviewVideoIsLocalFallback = isLocalFallback;
  globalThis.currentPreviewVideoDurationSec = 0;
  globalThis.currentPreviewVideoSourceKind = sourceKind;
  globalThis.currentPreviewVideoHasUsableFrame = false;
  syncWatchPlaceholderFromCurrentState();
  cssosBeginWatchVideoSwap(); // W543: 隐藏旧首帧, playing 后再淡入
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
      // CSSOS_WAVE_456 20260527 — Jing: W336 调 requestThumbnailDataUrl API 要 3-5s,
      // 期间 watchSvg.style.display 仍是 none → 只见暗色渐变(好过黑屏, 但仍不理想).
      // 修复: 先用本地 canvas 瞬间生成品牌色占位图(≤1ms), 立即展示; 再异步升级到 API
      // 生成的高质量缩略图. 合计: 黑屏 → 即时品牌占位 → (异步)API 质量封面.
      try {
        var ttl = String((currentWatchPreviewWork && currentWatchPreviewWork.title) || state.title || "").trim();
        if (!watchSvg.dataset.cssosPlaceholderFell) {
          watchSvg.dataset.cssosPlaceholderFell = "1";
          // Step 1: instant local canvas placeholder (brand dark-teal title card)
          try {
            var _cvs = document.createElement("canvas");
            _cvs.width = 720; _cvs.height = 405;
            var _cx = _cvs.getContext("2d");
            if (_cx) {
              var _bg = _cx.createLinearGradient(0, 0, 720, 405);
              _bg.addColorStop(0, "#050f0a"); _bg.addColorStop(1, "#0a1f14");
              _cx.fillStyle = _bg; _cx.fillRect(0, 0, 720, 405);
              var _glow = _cx.createRadialGradient(360, 0, 0, 360, 0, 320);
              _glow.addColorStop(0, "rgba(0,245,160,0.22)"); _glow.addColorStop(1, "transparent");
              _cx.fillStyle = _glow; _cx.fillRect(0, 0, 720, 405);
              // CSS logo ring (simple circle)
              _cx.strokeStyle = "rgba(0,245,160,0.45)"; _cx.lineWidth = 2;
              _cx.beginPath(); _cx.arc(360, 160, 36, 0, Math.PI * 2); _cx.stroke();
              _cx.fillStyle = "rgba(0,245,160,0.7)"; _cx.font = "bold 32px system-ui,sans-serif";
              _cx.textAlign = "center"; _cx.textBaseline = "middle";
              _cx.fillText("CSS", 360, 160);
              if (ttl) {
                _cx.fillStyle = "rgba(255,255,255,0.82)"; _cx.font = "bold 28px system-ui,sans-serif";
                var _w = 680, _lh = 36, _y0 = 230;
                // simple word-wrap
                var _words = ttl.split(" "), _line = "", _lines = [];
                _words.forEach(function(_w2) { var _t = _line ? _line + " " + _w2 : _w2; if (_cx.measureText(_t).width > _w) { _lines.push(_line); _line = _w2; } else { _line = _t; } });
                if (_line) _lines.push(_line);
                _lines.slice(0, 3).forEach(function(_l, _i) { _cx.fillText(_l, 360, _y0 + _i * _lh); });
              }
              var _localDurl = _cvs.toDataURL("image/webp", 0.75);
              if (_localDurl && _localDurl.length > 100) {
                watchSvg.src = _localDurl;
                watchSvg.onload = function () { watchSvg.style.display = "block"; watchSvg.dataset.cssosCoverFellBack = ""; };
                if (watchScreenBackdrop) watchScreenBackdrop.style.backgroundImage = "url(\"" + _localDurl.replace(/"/g, '\\"') + "\")";
              }
            }
          } catch (_ec) {}
          // Step 2: async upgrade to API thumbnail (replaces local placeholder when ready)
          if (typeof globalThis.requestThumbnailDataUrl === "function") {
            globalThis.requestThumbnailDataUrl(ttl || loginCopy("CSS MV"), "", []).then(function (durl) {
              if (durl) {
                watchSvg.src = durl;
                watchSvg.style.display = "block";
                if (watchScreenBackdrop) watchScreenBackdrop.style.backgroundImage = "url(\"" + durl.replace(/"/g, '\\"') + "\")";
              }
            }).catch(function () {});
          }
          return;
        }
      } catch (_e3) {}
      watchSvg.style.display = "none";
      if (watchScreenBackdrop) watchScreenBackdrop.style.backgroundImage = "";
    };
    watchSvg.onload = function () { watchSvg.dataset.cssosCoverFellBack = ""; watchSvg.style.display = "block"; };
  } catch (_e) {}
  watchSvg.src = uri;
  // CSSOS_WAVE_455 20260527 — Jing: 之前在图片加载前就把 display:block 打开 →
  // 若 URI 是过期的 fal.media 链接(大概率), watchSvg.background:#000 立刻盖住
  // watch-screen 渐变背景 → 黑屏持续到 onerror+thumbnail API 完成(3-5s). 修复:
  // 不在此处设 display:block, 让 onload 回调负责; onerror 中 thumbnail 就绪后
  // 也已经设了 display:block. 图片正在加载时, display 保持 none → 渐变背景透出,
  // 视觉上是"有内容的暗色面板"而不是死黑. glow 动画同样推迟到 onload 后开始.
  // 注意: watchSvg.style.display 此时可能是 "none"(CSS 默认) 或上一次留下的 "block".
  // 若上次成功加载过一张图, 旧图仍显示(src 已切换到新 uri, 加载完毕后 onload 自动刷新).
  // 若从 display:none 状态进来, 维持 none 直到 onload/thumbnail 回调.
  if (watchSvg.style.display !== "block") {
    // no-op: keep current (hidden) state until load completes
  }
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
// CSSOS_WAVE_473 20260527 — Jing「找出恐怖音频/木头人画面, 彻底删除, 换上丰富优美的 demo」:
// 旧池里有 "Back-to-the-Westworld"(机械仿生人 = 木头人, 且氛围阴森)。改为一组【精挑的优美
// demo】, 明确剔除阴森标题的(Westworld/The.Curse/Register.of.Souls/Seraph's-Fall/
// Where-the-Fallen-Lie/We-Never-Return/Monitoring-the-Maze)与那个 46 字节坏档, 随机取一支
// 作为兜底, 用户失败时也看到丰富优美的画面。
const W212_DEMO_FALLBACK_VIDEOS = [
  "/examples/AI_Media_FCGM-lZPD_8_002_720p.mp4",
  "/examples/Cybertruck_Media_C9pLehCkDk8_002_720p.mp4",
  "/examples/Venus-Eternal-Flame-4_Media_yN9f9NYUDHA_002_720p.mp4",
  "/examples/Synthetic-Sunsets-14_Media_iV8VOn9IZUk_002_720p.mp4",
  "/examples/Sweetwater-s-Song-30_Media_yWKkKUfty8Q_001_720p.mp4",
  "/examples/Real-Frontier-17_Media_mFGFzCP_fYM_002_720p.mp4",
  "/examples/Media_64rKUNq2e3s_002_720p.mp4",
  "/examples/Media_D43mSSeBhnc_002_720p.mp4",
  "/examples/Media_DwSgwV2f_gA_002_720p.mp4",
  "/examples/Media_N1Q5i-wp70g_002_720p.mp4",
  "/examples/Media_Tv1sHLskx_w_002_720p.mp4",
  "/examples/Media_dKWwe0hbKvc_002_720p.mp4",
  "/examples/Media_fIG7N67AGiw_002_720p.mp4",
  "/examples/Media_kAs1h6VUUBY_002_720p.mp4",
  "/examples/Media_pKnnjgJTwhU_002_720p.mp4",
  "/examples/Media_voxGz0V9mGk_002_720p.mp4",
  "/examples/Media_y1EBKVq5N9Q_002_720p.mp4",
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
      // CSSOS_WAVE_453 20260527 — Jing: 视频缓冲恢复后 canplay 再次触发此函数,
      // 不能重复静音 — 只在首帧前 (currentTime < 0.5) 才做初始静音压制.
      const _isInitialPlay = !watchVideo.currentTime || watchVideo.currentTime < 0.5;
      if (!globalThis.__cssosWatchAudioUnlocked && _isInitialPlay) {
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
        // CSSOS_WAVE_624 — 视频自带音轨(无独立 #watch-audio-preview)时, 强制静音会吞掉唯一的声音。
        // 视觉已用静音播放绕过策略 → 现在【带声重试】: 原生 App / 已授权浏览器直接出声, 不再等点击。
        // 仅当确无独立音轨且视频仍静音时尝试; 失败(纯浏览器策略拦)保持静音+等首触(pendingUnmute 已设)。
        try {
          var _hasAltAudio = String(watchAudioPreview?.currentSrc || watchAudioPreview?.src || "").trim();
          if (!_hasAltAudio && watchVideo && watchVideo.muted) {
            var _unmuteVid = function () {
              try {
                watchVideo.muted = false;
                var _vp = watchVideo.play && watchVideo.play();
                if (_vp && _vp.then) _vp.then(function () {
                  globalThis.__cssosWatchAudioUnlocked = true;
                  globalThis.__cssosWatchPendingUnmute = false;
                  if (typeof globalThis.hideWatchSoundHintModule === "function") globalThis.hideWatchSoundHintModule();
                }).catch(function () { try { watchVideo.muted = true; } catch (_e0) {} });
              } catch (_e1) {}
            };
            if (globalThis.__cssosWatchAudioUnlocked) { _unmuteVid(); }
            else {
              var _onVCP = function () { watchVideo.removeEventListener("canplay", _onVCP); _unmuteVid(); };
              watchVideo.addEventListener("canplay", _onVCP);
              setTimeout(function () { if (watchVideo && watchVideo.muted) _unmuteVid(); }, 250);
            }
          }
        } catch (_eVid) {}
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
  // CSSOS_WAVE_547 20260531 — Jing「切歌不清内存→崩溃」: 释放上一首预载的幻灯位图,
  // 把 src 置空提示 WKWebView 丢弃解码缓存, 断引用助 GC, 避免切歌累积 OOM。
  try {
    const imgs = globalThis.__cssosFramePreloadImgs;
    if (Array.isArray(imgs)) {
      imgs.forEach((im) => { try { im.src = ""; } catch (_e) {} });
    }
    globalThis.__cssosFramePreloadImgs = null;
  } catch (_e) {}
}

function startWatchFrameLoopModule(frames) {
  if (!watchSvg || !Array.isArray(frames)) return false;
  // CSSOS_WAVE_440 20260526 — Jing「DevTools: replicate.delivery out-0.png 404 刷屏」:
  // old works' slideshow frames are expired third-party temp links (replicate/fal).
  // Preloading the FULL sequence fires a 404 storm + churns the fallback. Keep only
  // frames hosted on our own domain (cssstudio.app local / cdn.cssstudio.app R2 /
  // data:) — those never 404. If a work has no persisted frames, the loop no-ops and
  // the single-cover fallback takes over (W429).
  frames = frames.filter((u) => {
    const s = String(u || "");
    return /(^|\/\/|\.)cssstudio\.app\//.test(s) || s.startsWith("data:");
  });
  if (!frames.length) return false;
  clearWatchFrameLoopModule();
  let lastIndex = -1;
  watchSvg.src = frames[0];
  // CSSOS_WAVE_369 20260523 — Jing「图1 闪帧消除」: 预加载帧 → 切换瞬时无空白闪;
  // 只有真正在播放时才切帧(待播/加载/暂停停在当前帧).
  // CSSOS_WAVE_547 20260531 — Jing「切歌崩溃 = 内存满」根治(其一): 此前每次切歌都 new Image()
  // 强制解码【全部 15~30 帧】, 且 clearWatchFrameLoopModule 只清定时器、从不释放这些位图 →
  // WKWebView 解码缓存随切歌累积 → OOM 崩溃(reload 页)。修法: ①只预解码前 6 帧(够消除切换闪,
  // 其余在 loop 设 watchSvg.src 时按需加载); ②把预载 Image 句柄存起来, 切歌/清理时把 src 置空
  // 以提示尽快回收解码位图。
  try {
    const _old = globalThis.__cssosFramePreloadImgs;
    if (Array.isArray(_old)) { _old.forEach((im) => { try { im.src = ""; } catch (_e) {} }); }
  } catch (_e) {}
  const _preloadImgs = [];
  frames.slice(0, 6).forEach((f) => {
    try { const im = new Image(); im.decoding = "async"; im.src = f; _preloadImgs.push(im); } catch (_e) {}
  });
  globalThis.__cssosFramePreloadImgs = _preloadImgs;
  // CSSOS_WAVE_416 20260524 — Jing「每 take 一套自己的幻灯时间轴, 铺满不借用」(approach A):
  // the displayed frame is now a PURE FUNCTION of the active media clock's PROGRESS
  // (currentTime / duration), not a wall-clock interval. So the SAME shared frame
  // pool is dynamically re-cut to whatever track is playing — switch language or
  // Take 1↔2 (each with its own duration) and the picture instantly re-syncs to the
  // new clock: one full pass spread across the WHOLE track. No "长音轨幻灯不够 /
  // 短音轨幻灯太长", no wasted compute/disk (one pool, N timelines). Falls back to a
  // gentle ~2.2s/frame loop only until the media reports its duration.
  const PER_FRAME_S = 2.2;
  const tick = () => {
    if (!watchSvg || !watchSvg.style || watchSvg.style.display === "none") return;
    var v = document.getElementById("watch-video");
    var a = document.getElementById("watch-audio-preview");
    // The clock is whichever element is the active sound/timeline source.
    var clockEl = (a && a.src && !a.paused && !a.ended && a.currentTime > 0) ? a
      : (v && !v.paused && !v.ended && v.currentTime > 0) ? v : null;
    if (!clockEl) return; // 待播/加载/暂停 → 停在当前帧, 不闪
    var t = clockEl.currentTime || 0;
    var dur = clockEl.duration;
    var idx;
    if (isFinite(dur) && dur > 1) {
      // duration-proportional: frame i shown over [i, i+1) * (dur / N).
      idx = Math.floor((t / dur) * frames.length);
      if (idx >= frames.length) idx = frames.length - 1;
      if (idx < 0) idx = 0;
    } else {
      idx = Math.floor(t / PER_FRAME_S) % frames.length; // pre-metadata fallback
    }
    if (idx !== lastIndex) { lastIndex = idx; watchSvg.src = frames[idx]; }
  };
  // CSSOS_WAVE_924 — Jing「轻装上阵」: 帧轮播 400ms→850ms(省 ~53% 空转)。W818 每帧随机运镜/
  // 节奏让单帧足够耐看, 不需 400ms 那么急; 仍只在 index 真变化才换 src, 短曲也够准。
  globalThis.watchFrameLoopTimer = setInterval(tick, 850);
  return true;
}

function captureWatchVideoFirstFrameModule(video) {
  if (!video?.videoWidth || !video?.videoHeight) return "";
  // CSSOS_WAVE_796 — 跨域视频画进 canvas 会污染(getImageData 抛 SecurityError)→ 既报错刷屏又白耗 CPU。
  // 只对【本域/自家 CDN】的视频做首帧亮度采样; 跨域(replicate/aiquickdraw 等)直接跳过(交给封面兜底)。
  try {
    var _vs = String(video.currentSrc || video.getAttribute("src") || "");
    if (_vs && !/^(blob:|data:)/i.test(_vs)) {
      var _h = new URL(_vs, location.href).hostname;
      if (_h && _h !== location.hostname && !/(^|\.)cssstudio\.app$/i.test(_h)) return "";
    }
  } catch (_e) {}
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
    // CSSOS_WAVE_656 20260606 — Jing「分享链接进来播一两秒就停/退影院」真凶: 创作引擎面板刷新
    // (updateEnginePanels→renderSongSeedPreviewModule)走到下面的 reset 分支时, 把【正在播放的
    // 分享/浏览音频】pause + removeAttribute("src") + 隐藏了 → 播放被掐、影院随后塌掉。守卫: 只要
    // audio 元素挂着【真实 http(s) 源】(分享 audio_track_1 / 浏览轨 / 最终成品), 这个【创作种子预览】
    // 面板就【绝不重置它】, 只确保可见。idle 创作态(空 src / data: 预览)才走原 reset 逻辑(自纠)。
    const _curAudSrc = String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim();
    const _realAudioLoaded = !!_curAudSrc && /^https?:/i.test(_curAudSrc);
    if (_realAudioLoaded) {
      watchAudioPreview.style.display = "block";
    } else if (restoreRememberedWatchFinalAudio()) {
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
  // W348 20260523 — Jing: requestForyouThumbnail 生成的 AI 缩略图来自
  // replicate.delivery 临时 URL → 很快过期 → img-thumb 502 → 乱闪.
  // 对已保存作品(有稳定 cover_image), 直接用 cover_image 锁池, 不再走 AI
  // 缩略图生成. 只有 ACTIVE CREATION(没有 cover_image)才需要 AI 预览.
  if (seedTitle && seedLines.length) {
    const _existingCover = String(
      currentWatchPreviewWork?.cover_image ||
      currentWatchPreviewWork?.cover_url ||
      currentWatchPreviewWork?.preview_image_url || ""
    ).trim();
    const _isStableCover = _existingCover &&
      !/^data:image\/svg\+xml/i.test(_existingCover) &&
      !/replicate\.delivery/i.test(_existingCover);
    if (_isStableCover) {
      // 已有稳定封面 → 锁池到这一张, 跳过 AI 缩略图
      if (!globalThis.__cssosWatchArtworkPoolLockedMs ||
          (Date.now() - globalThis.__cssosWatchArtworkPoolLockedMs) > 20000) {
        globalThis.currentWatchArtworkVariantPool = [_existingCover];
        globalThis.currentResolvedWatchArtworkDataUrl = _existingCover;
        globalThis.__cssosWatchArtworkPoolLockedMs = Date.now();
      }
    } else {
      // 创作模式: 还没有稳定封面 → AI 缩略图生成
      void globalThis.requestForyouThumbnail?.(
        seedTitle,
        String(seed?.musicStyle || seed?.creativeSummary?.compact || "").trim(),
        seedLines
      );
    }
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
  // CSSOS_WAVE_429 20260525 — Jing「海量帧池, 幻灯却一张老脸撑到底, 接入不了」根因:
  // 帧池其实已被 work-id-binding 拉取并 startWatchFrameLoopModule 跑起来了, 但本函数
  // (各种 state 同步/切 tab 时被调用)把【单张持久封面】排在最前 → clearWatchFrameLoopModule()
  // 杀掉正在转的帧循环 + 钉死一张静态封面 → 单张封面抢占了海量帧池 = "老脸撑到底".
  // 修法: 【多帧池优先】—— 只要有 ≥2 帧的池, 就跑幻灯循环; 单张持久封面只在【无池】时兜底。
  const cachedSequence = (globalThis.currentPreviewFrameSequence && globalThis.currentPreviewFrameSequence.length)
    ? globalThis.currentPreviewFrameSequence
    : getCachedWatchFrameSequenceModule();
  if (cachedSequence && cachedSequence.length >= 2) {
    showWatchFramePlaceholderModule(cachedSequence[0]);
    startWatchFrameLoopModule(cachedSequence);   // 海量帧池转起来, 不再被单封面preempt
    return true;
  }
  const persistedCoverImage = String(resolveWorkCoverImage(currentWatchPreviewWork || {}) || "").trim();
  if (persistedCoverImage && !isSyntheticWorkCoverImage(persistedCoverImage)) {
    clearWatchFrameLoopModule();
    setForyouBackgroundImage(persistedCoverImage);
    return showWatchFramePlaceholderModule(persistedCoverImage);
  }
  if (cachedSequence && cachedSequence.length) {
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

// CSSOS_WAVE_474 20260527 — Jing「切歌不要每次都 tap for sound; App 启动后任意一次手势之后,
// 不再要求用户任何操作」: 注册一个全局【首次手势解锁】监听。用户在 App/页面里做的任何第一次
// 手势(点/触/键)即把本会话标记为【已授权声音】, 解除当前音频静音并续播、收起提示。之后切歌
// 由 W473b 检测到 __cssosWatchAudioUnlocked 直接带声自动播, 永不再提示。注: 旧的"首触解锁"
// 只在【有视频在播】时触发(行 8734), 幻灯+音轨模式没有视频 → 从不解锁 → 每次切歌都提示。
(function installCssosFirstGestureAudioUnlock() {
  if (typeof document === "undefined" || globalThis.__cssosAudioUnlockInstalled) return;
  globalThis.__cssosAudioUnlockInstalled = true;
  // CSSOS_WAVE_542 20260531 — Jing「切歌总要再点一下才有声, 尤其没幻灯/视频时」根因:
  // W474 的 unlockAudioOnce 只在元素【已有 src】时才 play() 去激活(bless)。但用户的
  // 第一次手势往往发生在歌还没加载时(开面板/滑动)→ audio 元素没 src → 跳过 bless →
  // 该元素【从未被手势激活】。之后切到纯音轨歌(无视频)、程序化 play() 时, iOS 因
  // "元素从未经手势激活"拦截 → 又要 tap。修法: 首次手势【无条件】激活 audio+video 元素
  // (没真 src 就塞一段静音 WAV, 静音 play 一下再清掉), 元素被永久 bless, 此后切歌带声自动播。
  var _SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
  function _blessMediaEl(el) {
    if (!el) return;
    try {
      var hasReal = String(el.currentSrc || el.src || "").trim();
      if (hasReal) {
        // 真歌已就位 → 直接解除静音并续播。
        el.muted = false;
        var pr = el.play && el.play(); if (pr && pr.catch) pr.catch(function () {});
        return;
      }
      // 无 src → 用静音 WAV 在手势内激活该元素, 随即暂停并清掉, 元素保持 blessed。
      el.muted = true;
      el.src = _SILENT_WAV;
      var p = el.play && el.play();
      var cleanup = function () {
        try { el.pause && el.pause(); } catch (_c) {}
        try {
          if (String(el.currentSrc || el.src || "") === _SILENT_WAV) {
            el.removeAttribute("src");
            el.load && el.load();
          }
        } catch (_c2) {}
        try { el.muted = false; } catch (_c3) {}
      };
      if (p && p.then) p.then(cleanup, cleanup); else cleanup();
    } catch (_e) {}
  }
  function unlockAudioOnce() {
    if (globalThis.__cssosWatchAudioUnlocked) return;
    globalThis.__cssosWatchAudioUnlocked = true;   // 本会话已授权 → W473b 之后直接带声
    globalThis.__cssosWatchPendingUnmute = false;
    try { if (typeof hideWatchSoundHintModule === "function") hideWatchSoundHintModule(); } catch (_e) {}
    _blessMediaEl(document.getElementById("watch-audio-preview"));
    _blessMediaEl(document.getElementById("watch-video"));
  }
  globalThis.cssosUnlockWatchAudio = unlockAudioOnce;
  ["pointerdown", "touchstart", "mousedown", "keydown", "click"].forEach(function (ev) {
    try { document.addEventListener(ev, unlockAudioOnce, { capture: true, passive: true }); } catch (_e) {}
  });
})();
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

// CSSOS_WAVE_744 — 底部浮层【真·流式列容器】。Jing「正解 = 改成真正的流式列容器:
// 每行紧贴上一行, 空行 0 高度, Dock 显示时整列一起上移。一次性重写, 做对就再不打架」。
// 这些成员各自 position:fixed 散落在 DOM, 无法用 flex 包裹 → 用 JS 自底向上测高累加,
// 跳过空/隐藏成员(=0 高度), 把 bottom 写成 calc(var(--cssos-stk-base) + Npx) 并带 important
// 压过旧的固定 *gap*N 钉位规则。--cssos-stk-base 已含 safe-area + 14 + dock-clear(Dock 显示
// 时整列同步上移), JS 只管行间堆叠, 不碰横向锚点。旧 CSS 偏移保留为 JS 失效时的兜底。
(function cssosBottomStackFlow() {
  // CSSOS_WAVE_759 — 禁用本栈器: 它与【已存在且正确的】app.watch-bottom-stack.js(W561, dock 感知 +
  // 真元素 #cssos-watch-price-strip/#cssos-create-cta/.cssmv-capsule/#cssos-lang-fold)抢着写同一个
  // CTA/字幕的 bottom !important → 互相覆盖 → CTA 不礼让、遮住价格条/左下胶囊(Jing 报)。W744 当时没
  // 发现 W561 已存在, 造了重复冲突栈器。这里直接 return, 堆叠权全归 W561。
  return;
  var GAP = 10; // 行间距(px)
  // 自底向上的成员(顺序即视觉层序: 价格条 → CTA → 左下信息 → 字幕 → 多语言/声线)
  var ORDER = [
    ".watch-commerce-actions",
    ".cssos-create-cta",
    "#watch-pill-row-bl",
    ".watch-subtitle",
    "#cssmv-language-pill, .cssmv-language-pill, .watch-take-toggle, .cssmv-take-toggle",
  ];
  function isVisible(el) {
    if (!el) return false;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      if ((parseFloat(cs.opacity || "1") || 0) < 0.02) return false;
    } catch (_e) {}
    return el.offsetHeight > 0; // 空内容 → offsetHeight 0 → 视为 0 高度行
  }
  var __raf = 0;
  function recompute() {
    __raf = 0;
    var panel = document.getElementById("watch-panel");
    if (!panel) return;
    var cursor = 0; // 累加到 --cssos-stk-base 之上的高度
    for (var i = 0; i < ORDER.length; i++) {
      var el = panel.querySelector(ORDER[i]) || document.querySelector(ORDER[i]);
      if (!el) continue;
      if (!isVisible(el)) continue; // 空/隐藏 → 不占高度, 上面的行自动下沉紧贴
      el.style.setProperty(
        "bottom",
        "calc(var(--cssos-stk-base) + " + cursor + "px)",
        "important"
      );
      cursor += el.offsetHeight + GAP;
    }
  }
  function schedule() {
    if (__raf) return;
    try { __raf = requestAnimationFrame(recompute); }
    catch (_e) { __raf = 0; recompute(); }
  }
  function wire() {
    var panel = document.getElementById("watch-panel");
    if (!panel) return false;
    // 成员尺寸/可见性变化 → 重算(空↔有内容也会触发 offsetHeight 变化)
    try {
      if (window.ResizeObserver && !panel.__cssosStackRO) {
        var ro = new ResizeObserver(schedule);
        ORDER.forEach(function (sel) {
          (panel.querySelectorAll(sel) || []).forEach(function (el) { ro.observe(el); });
        });
        ro.observe(panel);
        panel.__cssosStackRO = ro;
      }
    } catch (_e) {}
    // 成员增删 / 文本变化(字幕逐字、价格条出现等) → 重算
    try {
      if (window.MutationObserver && !panel.__cssosStackMO) {
        var mo = new MutationObserver(schedule);
        mo.observe(panel, { childList: true, subtree: true, characterData: true });
        panel.__cssosStackMO = mo;
        // 新增的成员也要纳入 ResizeObserver
      }
    } catch (_e) {}
    schedule();
    return true;
  }
  function boot() {
    if (!wire()) {
      var tries = 0;
      var iv = setInterval(function () {
        if (wire() || ++tries > 60) clearInterval(iv);
      }, 250);
    }
    // Dock 显隐 / 全屏 / 旋屏 / 面板开关都改变基准或成员 → 重算
    ["resize", "orientationchange", "cssos:panelopen", "cssos:panelclose",
     "cssos:open-watch-for-run", "fullscreenchange"].forEach(function (ev) {
      window.addEventListener(ev, schedule, { passive: true });
    });
    [200, 600, 1200, 2500].forEach(function (ms) { setTimeout(schedule, ms); });
  }
  if (document.readyState === "complete" || document.readyState === "interactive") boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
  globalThis.cssosRecomputeBottomStack = schedule;
})();
