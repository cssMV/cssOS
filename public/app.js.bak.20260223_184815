const dock = document.getElementById("dock");
const toast = document.getElementById("toast");
const logoPanel = document.getElementById("logo-panel");
const foryouPanel = document.getElementById("foryou-panel");
const watchPanel = document.getElementById("watch-panel");
const cssmvPanel = document.getElementById("cssmv-panel");
const lyricsPanel = document.getElementById("lyrics-panel");
const musicPanel = document.getElementById("music-panel");
const videoPanel = document.getElementById("video-panel");
const settingsPanel = document.getElementById("settings-panel");
const languagePanel = document.getElementById("language-panel");
const loginPanel = document.getElementById("login-panel");
const worksPanel = document.getElementById("works-panel");
const lyricsEl = document.getElementById("lyrics");
const watchSubtitle = document.getElementById("watch-subtitle");
const watchVideo = document.getElementById("watch-video");
const watchSvg = document.getElementById("watch-svg");
const musicProgress = document.getElementById("music-progress");
const videoProgress = document.getElementById("video-progress");
const karaProgress = document.getElementById("kara-progress");
const lyricsProgress = document.getElementById("lyrics-progress");
const mirrorTitle = document.querySelector(".mirror-title");
const mirrorSlogan = document.querySelector(".mirror-slogan");
const foryouTitle = document.getElementById("foryou-title");
const foryouStyle = document.getElementById("foryou-style");
const foryouTags = document.getElementById("foryou-tags");
const listenButton = document.getElementById("listen-btn");
const watchButton = document.getElementById("watch-btn");
const mvTitle = document.getElementById("mv-title");
const mvSub = document.getElementById("mv-sub");
const sceneList = document.getElementById("scene-list");
const lyricsGrid = document.getElementById("lyrics-grid");
const musicStyle = document.getElementById("music-style");
const voiceStyle = document.getElementById("voice-style");
const videoScript = document.getElementById("video-script");
const mvTags = document.getElementById("mv-tags");
const mvStats = document.getElementById("mv-stats");
const cameraBoard = document.getElementById("camera-board");
const lyricFlow = document.getElementById("lyric-flow");
const musicTags = document.getElementById("music-tags");
const mixGrid = document.getElementById("mix-grid");
const videoTags = document.getElementById("video-tags");
const cameraList = document.getElementById("camera-list");
const storyboard = document.getElementById("storyboard");
const enterWatchButton = document.getElementById("enter-watch");
const applySettings = document.getElementById("apply-settings");
const randomPaletteButton = document.getElementById("random-palette");
const titleInput = document.getElementById("title-input");
const lyricsInput = document.getElementById("lyrics-input");
const styleInput = document.getElementById("style-input");
const voiceInput = document.getElementById("voice-input");
const bgColorInputs = [
  document.getElementById("bg-color-1"),
  document.getElementById("bg-color-2"),
  document.getElementById("bg-color-3"),
  document.getElementById("bg-color-4")
];

const languageList = document.getElementById("language-list");
const languageListMore = document.getElementById("language-list-more");
const languageMoreButton = document.getElementById("language-more");
const languageStatus = document.getElementById("language-status");
const languageCurrent = document.getElementById("language-current");
const loginList = document.getElementById("login-list");
const loginStatus = document.getElementById("login-status");
const loginUser = document.getElementById("login-user");
const loginLogout = document.getElementById("login-logout");
const versionToggle = document.getElementById("version-toggle");
const versionMenu = document.getElementById("version-menu");
const versionList = document.getElementById("version-list");
const versionCurrentLabel = document.getElementById("version-current");

const { LOCALE_KEY, DEFAULT_LOCALE } = window.CSSOS_I18N_CONSTANTS;
const USER_ROLE_KEY = "cssos.userRole";
const DEFAULT_ROLE = "guest";

const { languageCatalog } = window.CSSOS_I18N_CATALOG;

const { I18N } = window.CSSOS_I18N_DICT;

const SOCIAL_KEYS = (() => {
  const meta = document.querySelector('meta[name="social-keys"]');
  if (meta && meta.content) {
    const list = meta.content
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return list.reduce((acc, key) => {
      acc[key.toLowerCase()] = true;
      return acc;
    }, {});
  }
  if (window.CSSOS_SOCIAL_KEYS && typeof window.CSSOS_SOCIAL_KEYS === "object") {
    return window.CSSOS_SOCIAL_KEYS;
  }
  return {};
})();

const { socialPlatforms, PLATFORM_LABELS, getPlatformLabel: getPlatformLabelFromMap } = window.CSSOS_I18N_PLATFORMS;

const currentLocaleStore = localStorage.getItem(LOCALE_KEY);
let currentLocale = currentLocaleStore || DEFAULT_LOCALE;
let languageTimer = null;

const getLocale = () => currentLocale;

const { interpolate, t } = window.CSSOS_I18N;

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    const text = t(key, { spell: state.spell });
    if (text) {
      el.textContent = text;
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (!key) return;
    const text = t(key);
    if (text) {
      el.setAttribute("placeholder", text);
    }
  });
}

function getPlatformLabel(platformId) {
  const locale = PLATFORM_LABELS[currentLocale] ? currentLocale : DEFAULT_LOCALE;
  return getPlatformLabelFromMap(locale, platformId);
}

function isSocialEnabled(platformId) {
  if (!SOCIAL_KEYS) return false;
  const direct = SOCIAL_KEYS[platformId];
  if (direct) return true;
  const upper = platformId.toUpperCase();
  if (SOCIAL_KEYS[upper]) return true;
  const snake = platformId.replace(/-/g, "_").toUpperCase();
  return Boolean(SOCIAL_KEYS[snake]);
}

function renderLoginPlatforms() {
  if (!loginList) return;
  loginList.innerHTML = "";
  const enabledMap = new Map(
    authProviders.map((provider) => [
      provider.id,
      {
        enabled: provider.enabled,
        url: provider.url,
        icon: provider.icon
      }
    ])
  );
  const list = socialPlatforms.map((platform) => {
    const record = enabledMap.get(platform.id);
    return {
      id: platform.id,
      icon: record?.icon || platform.icon,
      enabled: record?.enabled ?? isSocialEnabled(platform.id),
      url: record?.url || (record?.enabled ? `/api/auth/${platform.id}` : "")
    };
  });

  list.forEach((platform) => {
    const enabled = Boolean(platform.enabled);
    const card = document.createElement(enabled ? "a" : "div");
    card.className = `login-card ${enabled ? "enabled" : "disabled"}`;
    if (enabled && platform.url) {
      card.href = platform.url;
    }
    card.innerHTML = `
      <div class="login-icon">${platform.icon}</div>
      <div class="login-title">${getPlatformLabel(platform.id)}</div>
    `;
    loginList.appendChild(card);
  });
}

function normalizeVersionList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((item) => (typeof item === "string" ? { id: item } : item));
  }
  if (Array.isArray(payload.versions)) {
    return payload.versions.map((item) => (typeof item === "string" ? { id: item } : item));
  }
  return [];
}

async function loadVersions() {
  if (!versionToggle || !versionMenu || !versionList) return;
  try {
    const [currentRes, listRes] = await Promise.all([
      fetch("/version.json", { cache: "no-store" }).catch(() => null),
      fetch("/versions.json", { cache: "no-store" }).catch(() => null)
    ]);
    const currentData = currentRes && currentRes.ok ? await currentRes.json() : null;
    const listData = listRes && listRes.ok ? await listRes.json() : null;
    const current =
      currentData?.version || currentData?.id || listData?.current || "current";
    const versions = normalizeVersionList(listData);
    if (!versions.length) {
      versionToggle.classList.add("is-hidden");
      return;
    }
    if (versionCurrentLabel) {
      versionCurrentLabel.textContent = `${t("versions.current")} · ${current}`;
    }
    versionList.innerHTML = "";
    versions.forEach((entry) => {
      const id = entry.id || entry.version || entry.name;
      if (!id) return;
      const path = `/v/${id}/`;
      const label = entry.label || id;
      const item = document.createElement("a");
      item.href = path;
      item.addEventListener("click", (e) => { e.preventDefault(); window.location.href = path; });
      item.className = `version-item ${id === current ? "active" : ""}`;
      item.innerHTML = `
        <span>${label}</span>
        <span>${entry.createdAt || entry.date || ""}</span>
      `;
      versionList.appendChild(item);
    });
  } catch (err) {
    versionToggle.classList.add("is-hidden");
  }
}

function initVersionSwitcher() {
  if (!versionToggle || !versionMenu) return;
  versionToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    versionMenu.classList.toggle("is-hidden");
  });
  document.addEventListener("click", () => {
    versionMenu.classList.add("is-hidden");
  });
  loadVersions();
}

function updateComposingText() {
  if (!watchSubtitle) return;
  watchSubtitle.textContent = t("status.composing", { spell: state.spell });
}

function renderLanguageButtons(container, languages) {
  if (!container) return;
  container.innerHTML = "";
  languages.forEach((lang) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lang-card";
    button.dataset.lang = lang.code;
    const hasDict = Boolean(I18N[lang.code]);
    const wipSuffix = hasDict ? "" : " (WIP)";
    button.innerHTML = `
      <span class="lang-flag">${lang.flag}</span>
      <span class="lang-name">${lang.label}${wipSuffix}</span>
      <span class="lang-native">${lang.native}</span>
    `;
    if (!hasDict) {
      button.classList.add("lang-wip");
      button.disabled = true;
    }
    button.addEventListener("click", () => setLocale(lang.code));
    container.appendChild(button);
  });
}

function updateLanguageSelection() {
  document.querySelectorAll(".lang-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.lang === currentLocale);
  });
}

function updateLanguageStatus(textKey) {
  if (!languageStatus) return;
  languageStatus.textContent = t(textKey);
}

function updateLanguageCurrent() {
  if (!languageCurrent) return;
  const list = [...languageCatalog.popular, ...languageCatalog.more];
  const current = list.find((lang) => lang.code === currentLocale);
  if (current) {
    languageCurrent.textContent = `${current.flag} ${current.label} · ${current.native}`;
  }
}

function setLocale(locale) {
  if (!locale) return;
  if (!I18N[locale]) {
    locale = DEFAULT_LOCALE;
  }
  currentLocale = locale;
  localStorage.setItem(LOCALE_KEY, locale);
  document.documentElement.lang = locale;
  clearTimeout(languageTimer);
  updateLanguageStatus("language.generating");
  const delay = locale === DEFAULT_LOCALE ? 0 : 420;
  languageTimer = setTimeout(() => {
    applyI18n();
    updateComposingText();
    renderLoginPlatforms();
    updateLoginUI();
    loadVersions();
    updateLanguageStatus("language.ready");
    updateLanguageSelection();
    updateLanguageCurrent();
  }, delay);
}

function initLanguagePanel() {
  renderLanguageButtons(languageList, languageCatalog.popular);
  renderLanguageButtons(languageListMore, languageCatalog.more);
  updateLanguageSelection();
  updateLanguageCurrent();
  if (languageMoreButton && languageListMore) {
    languageMoreButton.addEventListener("click", () => {
      languageListMore.classList.toggle("is-hidden");
    });
  }
  if (currentLocale && I18N[currentLocale]) {
    document.documentElement.lang = currentLocale;
    applyI18n();
    updateComposingText();
    renderLoginPlatforms();
  } else {
    setLocale(DEFAULT_LOCALE);
  }
  updateLanguageStatus("language.ready");
}
const DEFAULT_SPELL = "CSS";

const LOCAL_FALLBACK_MP4 =
  "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAABQVtZGF0AAACrwYF//+r3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMiBiMzU2MDVhIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTExIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yNCBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAFpliIQAO//+906/AptO4yoDklcK9sqkJlm5UmsB8qYAAAMAAAMAAAMAkIRx7muVyT1mgAAAL2AI2DJhyBRBFxCBHBniWEKHSMoAAAMAAAMAAAMAAAMAAAMA/YEAAAASQZokbEO//qmWAAADAAADAOWAAAAADkGeQniF/wAAAwAAAwEPAAAADgGeYXRCvwAAAwAAAwF3AAAADgGeY2pCvwAAAwAAAwF3AAAAGEGaaEmoQWiZTAh3//6plgAAAwAAAwDlgQAAABBBnoZFESwv/wAAAwAAAwEPAAAADgGepXRCvwAAAwAAAwF3AAAADgGep2pCvwAAAwAAAwF3AAAAGEGarEmoQWyZTAh3//6plgAAAwAAAwDlgAAAABBBnspFFSwv/wAAAwAAAwEPAAAADgGe6XRCvwAAAwAAAwF3AAAADgGe62pCvwAAAwAAAwF3AAAAF0Ga8EmoQWyZTAhv//6nhAAAAwAAAwHHAAAAEEGfDkUVLC//AAADAAADAQ8AAAAOAZ8tdEK/AAADAAADAXcAAAAOAZ8vakK/AAADAAADAXcAAAAXQZs0SahBbJlMCG///qeEAAADAAADAccAAAAQQZ9SRRUsL/8AAAMAAAMBDwAAAA4Bn3F0Qr8AAAMAAAMBdwAAAA4Bn3NqQr8AAAMAAAMBdwAAABZBm3hJqEFsmUwIV//+OEAAAAMAABsxAAAAEEGflkUVLC//AAADAAADAQ8AAAAOAZ+1dEK/AAADAAADAXcAAAAOAZ+3akK/AAADAAADAXcAAARnbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAABBIAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAA5J0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAABBIAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAoAAAAFoAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAQSAAAEAAABAAAAAAMKbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAwAAAAMgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACtW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAnVzdGJsAAAAwXN0c2QAAAAAAAAAAQAAALFhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAoABaABIAAAASAAAAAAAAAABFUxhdmM2Mi4xMS4xMDAgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAN2F2Y0MBZAAe/+EAGmdkAB6s2UCgL/lwEQAAAwABAAADADAPFi2WAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAACZPAAAAAAAAABhzdHRzAAAAAAAAAAEAAAAZAAACAAAAABRzdHNzAAAAAAAAAAEAAAABAAAA2GN0dHMAAAAAAAAAGQAAAAEAAAQAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAABAAAKAAAAAAEAAAQAAAAAAQAAAAAAAAABAAACAAAAAAEAAAoAAAAAAQAABAAAAAABAAAAAAAAAAEAAAIAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAABAAAKAAAAAAEAAAQAAAAAAQAAAAAAAAABAAACAAAAAAEAAAoAAAAAAQAABAAAAAABAAAAAAAAAAEAAAIAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAZAAAAAQAAAHhzdHN6AAAAAAAAAAAAAAAZAAADEQAAABYAAAASAAAAEgAAABIAAAAcAAAAFAAAABIAAAASAAAAHAAAABQAAAASAAAAEgAAABsAAAAUAAAAEgAAABIAAAAbAAAAFAAAABIAAAASAAAAGgAAABQAAAASAAAAEgAAABRzdGNvAAAAAAAAAAEAAAAwAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2Mi4zLjEwMA==";

const panelSettingsDefaults = new WeakMap();

let inactivityTimer;
let typingTimer;
let progressTimer;
let topZ = 10;
let lastTrailTime = 0;
let lastTrailPoint = null;
let watchTriggered = false;
let cssmvTriggered = false;
let typingState = { paused: false, canceled: false };
let sceneRows = [];
let videoJobId = null;
let videoJobPoll = null;
let watchVideoUrl = null;
let ambientTrailTime = 0;
let ambientTrailPoint = null;
let lyricsTargetLength = 0;
let playbackRetry = 0;
let playbackTimer = null;
let manualPlayHinted = false;

const engineStates = {
  lyrics: "running",
  music: "running",
  video: "running",
  kara: "running"
};
const dockClickTimers = new Map();
const LONGPRESS_MS = 600;
const CLICK_DELAY = 220;
const TRAIL_INTERVAL = 70;

const lyricBank = [
  {
    title: "嫦娥奔月",
    lines: [
      "Verse 1 · 月影引航",
      "云海轻翻，玉阶点亮夜的青芒",
      "你把人间的灯火藏进袖里",
      "",
      "Verse 2 · 人间回响",
      "风把旧梦吹向天河的彼岸",
      "我在流光里喊你一声——回望",
      "",
      "Chorus 1 · 潮汐合唱",
      "唱吧，穿越苍穹的誓言",
      "一句CSS点亮归途",
      "",
      "Verse 3 · 广寒孤旅",
      "桂树微响，时间在月宫起舞",
      "你的影子长成琴弦",
      "",
      "Verse 4 · 星河写信",
      "我把心事写成光，投向故乡",
      "梦在指尖发芽",
      "",
      "Chorus 2 · 天门回响",
      "唱吧，银河替你推开天窗",
      "一声CSS穿透长夜",
      "",
      "Bridge · 归途之门",
      "潮汐翻页，尘世与月宫同频",
      "我们在静光里相认",
      "",
      "Chorus 3 · 梦之回声",
      "唱吧，未来在我们肩上发亮",
      "流流流的光一路起航",
      "",
      "Chorus 4 · 月光誓言",
      "唱吧，直到天边被唤醒",
      "一声CSS把爱带回",
      "",
      "Outro · 归来",
      "人间与月宫，只隔一声CSS",
      "我们同唱流流流，梦就起航"
    ]
  },
  {
    title: "流光之城",
    lines: [
      "Verse 1 · 城市苏醒",
      "霓虹是河流，街道在呼吸",
      "你点亮CSS，我听见电光歌唱",
      "",
      "Verse 2 · 玻璃之海",
      "楼群像浪，心跳化作光",
      "我们在未来街口相望",
      "",
      "Chorus 1 · 演出开启",
      "唱吧，屏幕化作舞台",
      "一句CSS点亮全城",
      "",
      "Verse 3 · 引擎风暴",
      "音乐引擎拉起风，视频引擎铺开海",
      "脚步变成鼓点",
      "",
      "Verse 4 · 人声波纹",
      "每一句歌词都有光的轮廓",
      "我们把现在写成明天的传说",
      "",
      "Chorus 2 · 未来合唱",
      "唱吧，霓虹替我们作证",
      "一声CSS让心发亮",
      "",
      "Bridge · 夜色转场",
      "穿过高楼与云层，我们向上",
      "让城市听见我们的名字",
      "",
      "Chorus 3 · 电子之心",
      "唱吧，电流成为和声",
      "流流流的光一路回响",
      "",
      "Chorus 4 · 光之誓言",
      "唱吧，直到晨曦降临",
      "一句CSS写下奇迹",
      "",
      "Outro · 落幕",
      "城市仍在呼吸，你我仍在歌唱"
    ]
  }
];

const styleTagMap = {
  "Chinese GuFeng": ["GuFeng", "Pipa", "Moonlit", "Jade", "Silk", "Temple"],
  "Neo-Opera": ["Opera", "Stage", "Vibrato", "Crimson", "Spotlight"],
  "Future Ballad": ["Ballad", "Neon", "Synth", "Halo", "Dreamline"],
  "Cyber Folk": ["Folk", "Circuit", "Pulse", "Hologram", "Glow"]
};

const mvTagBank = ["KaraOK", "Flow", "Celestial", "Live", "Mythic", "Glass"];
const videoTagBank = ["Storyboard", "Cinematic", "Long Take", "4K", "Stage FX", "Haze"];
const cameraMoveBank = ["Dolly In", "Orbit", "Crane Rise", "Silk Pan", "Slow Zoom", "Parallax"];
const lensBank = ["35mm", "50mm", "85mm", "Wide", "Tele", "Macro"];
const mixBank = ["Lead Vocal", "Harmony", "Strings", "Pipa", "Synth Pad", "Bass", "Percussion"];
const flowBank = ["Verse", "Chorus", "Bridge", "Hook", "Outro"];
const starPalette = [
  {
    c1: "#f8fff0",
    c2: "#aafee0",
    glow: "rgba(248, 255, 240, 0.6)",
    haze: "rgba(180, 255, 230, 0.4)",
    haze2: "rgba(120, 240, 255, 0.3)"
  },
  {
    c1: "#00f5a0",
    c2: "#0bf7ff",
    glow: "rgba(0, 245, 160, 0.7)",
    haze: "rgba(0, 245, 160, 0.45)",
    haze2: "rgba(11, 247, 255, 0.35)"
  },
  {
    c1: "#0bf7ff",
    c2: "#00f5a0",
    glow: "rgba(11, 247, 255, 0.7)",
    haze: "rgba(11, 247, 255, 0.45)",
    haze2: "rgba(0, 245, 160, 0.3)"
  },
  {
    c1: "#c9ffe9",
    c2: "#0bf7ff",
    glow: "rgba(201, 255, 233, 0.7)",
    haze: "rgba(190, 255, 234, 0.45)",
    haze2: "rgba(11, 247, 255, 0.28)"
  }
];

const state = {
  title: lyricBank[0].title,
  baseLines: lyricBank[0].lines,
  lines: lyricBank[0].lines,
  spell: DEFAULT_SPELL,
  style: styleInput ? styleInput.value : "Chinese GuFeng",
  voice: voiceInput ? voiceInput.value : "Feminine"
};

const authState = {
  user: null,
  role: DEFAULT_ROLE,
  tier: DEFAULT_ROLE
};

let authProviders = [];

const getUserRole = () =>
  (authState.role ||
    window.CSSOS_USER_ROLE ||
    localStorage.getItem(USER_ROLE_KEY) ||
    DEFAULT_ROLE ||
    "guest").toString();

const billingState = {
  tier: DEFAULT_ROLE,
  remaining: null,
  limit: null
};

const DAILY_LIMITS = {
  guest: 1,
  user: 10,
  starter: 30,
  pro: Infinity
};

function getDailyLimit(role) {
  return DAILY_LIMITS[role] ?? DAILY_LIMITS.guest;
}

function getUsageKey() {
  const id = authState.user?.id || "guest";
  return `cssos.usage.${id}`;
}

async function fetchMe() {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (!res.ok) return;
    const payload = await res.json();
    const data = payload.data || payload;
    if (payload.empty) {
      authState.user = null;
      authState.role = DEFAULT_ROLE;
      authState.tier = DEFAULT_ROLE;
      if (loginStatus) loginStatus.textContent = t("common.noDataYet");
      return;
    }
    authState.user = data.user || null;
    authState.role = data.role || DEFAULT_ROLE;
    authState.tier = data.tier || authState.role || DEFAULT_ROLE;
    updateLoginUI();
    fetchBillingStatus();
  } catch (err) {
    // ignore
  }
}

function updateLoginUI() {
  if (loginStatus) {
    loginStatus.textContent = authState.user ? t("login.statusSigned") : t("login.statusGuest");
  }
  if (loginUser) {
    if (authState.user) {
      const label = authState.user.name || authState.user.email || authState.user.id;
      loginUser.textContent = label || "";
    } else {
      loginUser.textContent = "";
    }
  }
  if (loginLogout) {
    loginLogout.style.display = authState.user ? "inline-flex" : "none";
  }
}

async function fetchAuthProviders() {
  try {
    const res = await fetch("/api/auth/providers", { credentials: "include" });
    if (!res.ok) return;
    const payload = await res.json();
    const data = payload.data || payload;
    authProviders = Array.isArray(data.providers) ? data.providers : [];
    if (payload.empty) {
      if (loginList) loginList.textContent = t("common.noDataYet");
      if (loginStatus) loginStatus.textContent = t("common.noDataYet");
      return;
    }
    renderLoginPlatforms();
  } catch (err) {
    // ignore
  }
}

function consumeLocalUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem(getUsageKey());
  const data = raw ? JSON.parse(raw) : { date: today, count: 0 };
  if (data.date !== today) {
    data.date = today;
    data.count = 0;
  }
  const limit = getDailyLimit(getUserRole());
  if (limit !== Infinity && data.count >= limit) {
    showToast(t("billing.limitReached") || "Daily limit reached");
    return false;
  }
  data.count += 1;
  localStorage.setItem(getUsageKey(), JSON.stringify(data));
  return true;
}

async function consumeGeneration() {
  try {
    const res = await fetch("/api/billing/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({})
    });
    if (res.ok) {
      const payload = await res.json();
      const data = payload.data || payload;
      billingState.tier = data.tier || billingState.tier;
      billingState.remaining = data.remaining;
      billingState.limit = data.limit;
      if (payload.empty) {
        showToast(t("common.noDataYet"));
        return false;
      }
      if (!data.allowed) {
        showToast(t("billing.limitReached") || "Daily limit reached");
        return false;
      }
      return true;
    }
  } catch (err) {
    // fallback to local counters
  }
  return consumeLocalUsage();
}

async function fetchBillingStatus() {
  try {
    const res = await fetch("/api/billing/status", { credentials: "include" });
    if (res.ok) {
      const payload = await res.json();
      const data = payload.data || payload;
      if (payload.empty) {
        showToast(t("common.noDataYet"));
        return;
      }
      billingState.tier = data.tier || billingState.tier;
      billingState.remaining = data.remaining;
      billingState.limit = data.limit;
    }
  } catch (err) {
    // ignore
  }
}

const panels = [
  logoPanel,
  foryouPanel,
  watchPanel,
  cssmvPanel,
  lyricsPanel,
  musicPanel,
  videoPanel,
  settingsPanel,
  languagePanel,
  loginPanel,
  worksPanel
];

const dockByPanel = {
  "foryou-panel": "foryou",
  "watch-panel": "watch",
  "cssmv-panel": "cssmv",
  "lyrics-panel": "lyrics",
  "music-panel": "music",
  "video-panel": "video",
  "settings-panel": "settings",
  "language-panel": "language",
  "login-panel": "login",
  "works-panel": "works"
};
const MIN_PANEL_WIDTH = 320;
const MIN_PANEL_HEIGHT = 240;

function showDock() {
  dock.classList.remove("hidden");
}

function hideDock() {
  dock.classList.add("hidden");
}

function resetInactivityTimer() {
  showDock();
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(hideDock, 10000);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function typewriter(el, text, speed = 24, callback) {
  clearTimeout(typingTimer);
  el.textContent = "";
  let i = 0;
  if (lyricsProgress) setProgress(lyricsProgress, 0);

  const step = () => {
    if (typingState.canceled) {
      if (lyricsProgress) setProgress(lyricsProgress, 0);
      return;
    }
    if (typingState.paused) {
      typingTimer = setTimeout(step, 120);
      return;
    }
    el.textContent += text.charAt(i);
    i += 1;
    if (lyricsProgress) {
      const pct = text.length ? Math.min(100, (i / text.length) * 100) : 0;
      setProgress(lyricsProgress, pct);
    }
    if (i < text.length) {
      typingTimer = setTimeout(step, speed);
    } else if (callback) {
      if (lyricsProgress) setProgress(lyricsProgress, 100);
      callback();
    }
  };

  step();
}

function setProgress(el, value) {
  el.style.width = `${value}%`;
}

function resetVideoPreview() {
  if (!watchVideo) return;
  watchVideo.pause?.();
  watchVideo.removeAttribute("src");
  watchVideo.load?.();
  if (watchVideoUrl) {
    URL.revokeObjectURL(watchVideoUrl);
    watchVideoUrl = null;
  }
  if (watchSvg) {
    watchSvg.removeAttribute("src");
    watchSvg.style.display = "none";
  }
  watchVideo.style.display = "";
}

function setVideoFromArtifact(uri) {
  if (!watchVideo || !uri) return false;
  if (!uri.startsWith("data:")) {
    watchVideo.src = uri;
    watchVideo.muted = true;
    watchVideo.playsInline = true;
    watchVideo.load?.();
    return true;
  }
  const [meta, data] = uri.split(",");
  if (!data) return false;
  const mimeMatch = meta.match(/data:([^;]+);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "video/mp4";
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    watchVideoUrl = URL.createObjectURL(blob);
    watchVideo.src = watchVideoUrl;
    watchVideo.muted = true;
    watchVideo.playsInline = true;
    watchVideo.load?.();
    watchVideo.style.display = "";
    if (watchSvg) watchSvg.style.display = "none";
    return true;
  } catch (err) {
    return false;
  }
}

function setSvgPreview(uri) {
  if (!watchSvg || !uri) return false;
  watchSvg.src = uri;
  watchSvg.style.display = "block";
  watchSvg.classList.add("glow");
  if (watchVideo) watchVideo.style.display = "none";
  return true;
}

function clearPlaybackRetry() {
  if (playbackTimer) {
    clearTimeout(playbackTimer);
    playbackTimer = null;
  }
  playbackRetry = 0;
}

function promptManualPlay(message) {
  manualPlayHinted = true;
  if (watchSubtitle) watchSubtitle.textContent = message;
  showToast(message);
}

function attemptVideoPlayback(options = {}) {
  if (!watchVideo || !watchVideo.src) return;
  const maxRetries = options.maxRetries ?? 5;
  const interval = options.interval ?? 900;
  const allowFallback = options.allowFallback ?? false;
  clearPlaybackRetry();

  const tryPlay = () => {
    if (!watchVideo || !watchVideo.src) return;
    const playPromise = watchVideo.play?.();
    if (!playPromise || typeof playPromise.then !== "function") return;
    playPromise
      .then(() => {
        clearPlaybackRetry();
        manualPlayHinted = false;
        if (watchSubtitle) watchSubtitle.textContent = "KaraOK MV · Playing";
      })
      .catch(() => {
        playbackRetry += 1;
        if (playbackRetry <= maxRetries) {
          showToast(`Auto retry ${playbackRetry}/${maxRetries}`);
          playbackTimer = setTimeout(tryPlay, interval);
          return;
        }
        if (allowFallback) {
          useLocalVideoFallback(state.title, `${state.style} ${state.voice} cinematic mv`);
        }
        promptManualPlay("Autoplay blocked · Tap to play");
      });
  };

  tryPlay();
}

function initVideoPlaybackControls() {
  if (!watchVideo) return;
  watchVideo.addEventListener("canplay", () => {
    attemptVideoPlayback({ maxRetries: 2 });
  });
  watchVideo.addEventListener("error", () => {
    useLocalVideoFallback(state.title, `${state.style} ${state.voice} cinematic mv`);
    attemptVideoPlayback({ maxRetries: 2 });
  });
  const clickTarget = document.querySelector(".watch-screen");
  if (clickTarget) {
    clickTarget.addEventListener("click", () => {
      if (!watchVideo?.src) return;
      attemptVideoPlayback({ maxRetries: 0 });
      if (manualPlayHinted) {
        showToast("Playback resumed");
      }
    });
  }
}

async function playLatestVideoFromRegistry() {
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
    if (videoArtifact && setVideoFromArtifact(videoArtifact.uri)) {
      watchSubtitle.textContent = "KaraOK MV · Preview";
      attemptVideoPlayback({ allowFallback: true });
      return true;
    }
    if (svgArtifact) {
      setSvgPreview(svgArtifact.uri);
      watchSubtitle.textContent = "KaraOK MV · Preview";
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

function useLocalVideoFallback(title, subtitle) {
  const ok = setVideoFromArtifact(LOCAL_FALLBACK_MP4);
  if (ok) {
    watchSubtitle.textContent = "KaraOK MV · Preview (Local)";
    attemptVideoPlayback({ maxRetries: 2 });
    return;
  }
  setSvgPreview(buildLocalVideoPreviewSvg(title, subtitle));
  watchSubtitle.textContent = "KaraOK MV · Preview (Local)";
}

async function requestVideoPreview(title, lines) {
  if (!watchVideo) return;
  if (videoJobPoll) {
    clearInterval(videoJobPoll);
    videoJobPoll = null;
  }
  videoJobId = null;
  resetVideoPreview();
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
  try {
    const res = await fetch("/api/registry/v1/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      useLocalVideoFallback(title, prompt);
      showToast(`Video offline · Local preview (${res.status})`);
      return;
    }
    const payload = await res.json();
    const jobId = payload?.job?.id || payload?.id;
    if (!jobId) {
      useLocalVideoFallback(title, prompt);
      return;
    }
    videoJobId = jobId;
    pollVideoJob(videoJobId);
  } catch (err) {
    useLocalVideoFallback(title, prompt);
    showToast("Video offline · Local preview");
  }
}

function buildLocalVideoPreviewSvg(title, subtitle) {
  const safeTitle = String(title || "CSS MV").replace(/</g, "&lt;");
  const safeSubtitle = String(subtitle || "Local preview").replace(/</g, "&lt;");
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#00f5a0" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#0b6f55" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#020302" stop-opacity="0.95"/>
    </radialGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="#020302"/>
  <circle cx="620" cy="360" r="280" fill="url(#g)"/>
  <circle cx="680" cy="320" r="220" fill="url(#g)" opacity="0.6" filter="url(#blur)"/>
  <text x="50%" y="48%" text-anchor="middle" font-family="Syne, sans-serif" font-size="72" fill="#eafff6" letter-spacing="8">${safeTitle}</text>
  <text x="50%" y="56%" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="28" fill="#9fead1" letter-spacing="6">${safeSubtitle}</text>
</svg>`
    )
  );
}

function pollVideoJob(jobId) {
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
          if (setVideoFromArtifact(videoArtifact.uri)) {
            attemptVideoPlayback({ allowFallback: true });
          } else {
            useLocalVideoFallback(state.title, `${state.style} ${state.voice} cinematic mv`);
          }
          watchSubtitle.textContent = "KaraOK MV · Preview";
        } else if (svgArtifact) {
          setSvgPreview(svgArtifact.uri);
          watchSubtitle.textContent = "KaraOK MV · Preview";
        } else {
          watchSubtitle.textContent = "KaraOK MV · Ready";
        }
        clearInterval(videoJobPoll);
        videoJobPoll = null;
      } else if (job.status === "failed") {
        watchSubtitle.textContent = "KaraOK MV · Failed";
        clearInterval(videoJobPoll);
        videoJobPoll = null;
      }
    } catch (err) {
      // keep polling
    } finally {
      busy = false;
    }
  }, 1200);
}

function resetTypingState() {
  typingState = { paused: false, canceled: false };
  if (lyricsEl) {
    lyricsEl.classList.remove("paused", "canceled");
  }
  setEngineState("lyrics", "running");
  if (lyricsProgress) setProgress(lyricsProgress, 0);
}

function cycleLyricsState() {
  if (!lyricsEl || typingState.canceled) return;
  if (!typingState.paused) {
    typingState.paused = true;
    lyricsEl.classList.add("paused");
    setEngineState("lyrics", "paused");
    showToast("Lyrics paused");
    return;
  }
  typingState.canceled = true;
  lyricsEl.classList.remove("paused");
  lyricsEl.classList.add("canceled");
  clearTimeout(typingTimer);
  setEngineState("lyrics", "canceled");
  showToast("Lyrics canceled");
}

function initLyricsControls() {
  if (!lyricsEl) return;
  lyricsEl.addEventListener("click", cycleLyricsState);
}

function setEngineState(engine, state) {
  engineStates[engine] = state;
  const cards = document.querySelectorAll(".status-card");
  const indexMap = { lyrics: 0, music: 1, video: 2, kara: 3 };
  const card = cards[indexMap[engine]];
  if (!card) return;
  const titleEl = card.querySelector(".status-title");
  if (!card.dataset.baseTitle && titleEl) {
    card.dataset.baseTitle = titleEl.textContent;
  }
  card.classList.remove("paused", "canceled", "running");
  if (state === "paused") {
    card.classList.add("paused");
  }
  if (state === "running") {
    card.classList.add("running");
  }
  if (state === "canceled") {
    card.classList.add("canceled");
    const progressEl =
      engine === "lyrics"
        ? lyricsProgress
        : engine === "music"
          ? musicProgress
          : engine === "video"
            ? videoProgress
            : karaProgress;
    if (progressEl) setProgress(progressEl, 0);
  }
  if (titleEl) {
    const base = card.dataset.baseTitle || titleEl.textContent;
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
}

function cycleEngineState(engine) {
  if (engine === "lyrics") {
    cycleLyricsState();
    return;
  }
  const state = engineStates[engine];
  if (state === "running") {
    setEngineState(engine, "paused");
    showToast(`${engine} paused`);
    return;
  }
  if (state === "paused") {
    setEngineState(engine, "canceled");
    showToast(`${engine} canceled`);
  }
}

function initEngineControls() {
  const cards = document.querySelectorAll(".status-card");
  const engines = ["lyrics", "music", "video", "kara"];
  cards.forEach((card, index) => {
    const engine = engines[index];
    if (!engine) return;
    card.dataset.engine = engine;
    card.addEventListener("click", () => cycleEngineState(engine));
  });
}

function resetEngineStates() {
  setEngineState("lyrics", "running");
  setEngineState("music", "running");
  setEngineState("video", "running");
  setEngineState("kara", "running");
}

function animateProgress() {
  let music = 0;
  let video = 0;
  let kara = 0;
  watchTriggered = false;
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (engineStates.lyrics === "running" && lyricsProgress) {
      const current = lyricsEl?.textContent?.length || 0;
      const pct = lyricsTargetLength ? Math.min(100, (current / lyricsTargetLength) * 100) : 0;
      setProgress(lyricsProgress, pct);
    }
    if (engineStates.music === "running") {
      music = Math.min(100, music + 6 + Math.random() * 6);
    }
    if (engineStates.video === "running") {
      video = Math.min(100, video + 4 + Math.random() * 5);
    }
    if (engineStates.kara === "running") {
      kara = Math.min(100, kara + 5 + Math.random() * 6);
    }
    setProgress(musicProgress, music);
    setProgress(videoProgress, video);
    setProgress(karaProgress, kara);
    syncSceneProgress(video);
    if (!watchTriggered && video >= 70) {
      watchTriggered = true;
      openPanel(watchPanel);
      layoutShowcasePanels();
    }
    if (music >= 100 && video >= 100 && kara >= 100) {
      clearInterval(progressTimer);
      watchSubtitle.textContent = "KaraOK MV · Ready";
    }
  }, 420);
}

function focusPanel(panel) {
  if (!panel) return;
  topZ += 1;
  panel.style.zIndex = `${topZ}`;
  panels.forEach((item) => {
    if (!item) return;
    item.classList.remove("panel-front");
  });
  panel.classList.add("panel-front");
  panel.classList.add("panel-active");
  setTimeout(() => panel.classList.remove("panel-active"), 600);
}

function openPanel(panel) {
  if (!panel) return;
  panel.classList.remove("hidden");
  panel.dataset.minimized = "false";
  focusPanel(panel);
  updateDockVisibility();
  layoutShowcasePanels();
}

function updateDockVisibility() {
  Object.entries(dockByPanel).forEach(([panelId, action]) => {
    const panel = document.getElementById(panelId);
    const dockItem = document.querySelector(`.dock-item[data-action=\"${action}\"]`);
    if (!panel || !dockItem) return;
    if (panel.classList.contains("hidden")) {
      dockItem.classList.remove("is-hidden");
    } else {
      dockItem.classList.add("is-hidden");
    }
  });
}

function initPanelStack() {
  panels.forEach((panel, index) => {
    if (!panel) return;
    panel.style.zIndex = `${topZ + index}`;
  });
  topZ += panels.length;
  focusPanel(logoPanel);
}

function pickRandom(list, count) {
  const pool = [...list];
  const picked = [];
  while (pool.length && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function storePanelState(panel) {
  panel.dataset.restore = JSON.stringify({
    left: panel.style.left || "",
    top: panel.style.top || "",
    width: panel.style.width || "",
    height: panel.style.height || "",
    transform: panel.style.transform || ""
  });
}

function restorePanel(panel) {
  const restore = panel.dataset.restore ? JSON.parse(panel.dataset.restore) : {};
  panel.style.left = restore.left || "";
  panel.style.top = restore.top || "";
  panel.style.width = restore.width || "";
  panel.style.height = restore.height || "";
  panel.style.transform = restore.transform || "";
  panel.classList.remove("maximized");
  panel.dataset.maximized = "false";
}

function togglePanelMaximize(panel) {
  if (!panel) return;
  const isMaximized = panel.dataset.maximized === "true";
  if (isMaximized) {
    restorePanel(panel);
  } else {
    storePanelState(panel);
    panel.style.left = "50%";
    panel.style.top = "50%";
    panel.style.transform = "translate(-50%, -50%)";
    panel.style.width = "min(92vw, 1200px)";
    panel.style.height = "min(82vh, 760px)";
    panel.classList.add("maximized");
    panel.dataset.maximized = "true";
  }
  focusPanel(panel);
}

function openAndMaximize(panel) {
  openPanel(panel);
  togglePanelMaximize(panel);
}

function spawnDragTrail(event) {
  const now = performance.now();
  if (now - lastTrailTime < TRAIL_INTERVAL) return;
  lastTrailTime = now;
  const prev = lastTrailPoint;
  const dt = prev ? now - prev.time : 16;
  const dx = prev ? event.clientX - prev.x : 0;
  const dy = prev ? event.clientY - prev.y : 0;
  const dist = Math.hypot(dx, dy);
  const speed = dt > 0 ? dist / dt : 0;
  const count = Math.min(7, Math.max(1, Math.round(speed * 3)));
  const spacing = Math.min(32, Math.max(6, speed * 20));
  const dirX = dist > 0 ? dx / dist : 0;
  const dirY = dist > 0 ? dy / dist : 0;
  const hazeCount = Math.min(4, Math.max(1, Math.round(speed * 1.8)));
  const hazeSize = 40 + Math.min(speed * 120, 120);

  for (let i = 0; i < count; i += 1) {
    const trail = document.createElement("div");
    trail.className = "drag-trail star";
    const size = 8 + Math.random() * 10 + Math.min(speed * 6, 8);
    const rotation = Math.floor(Math.random() * 360);
    const color = starPalette[Math.floor(Math.random() * starPalette.length)];
    const offset = i * spacing;
    const jitter = (Math.random() - 0.5) * 4;

    trail.style.left = `${event.clientX - dirX * offset + jitter}px`;
    trail.style.top = `${event.clientY - dirY * offset + jitter}px`;
    trail.style.setProperty("--trail-size", `${size}px`);
    trail.style.setProperty("--trail-rot", `${rotation}deg`);
    trail.style.setProperty("--trail-color", color.c1);
    trail.style.setProperty("--trail-color-2", color.c2);
    trail.style.setProperty("--trail-glow", color.glow);
    trail.style.setProperty("--trail-haze", color.haze);
    trail.style.setProperty("--trail-haze-2", color.haze2);
    trail.style.setProperty("--trail-life", `${0.6 + Math.min(speed * 0.4, 0.6)}s`);

    document.body.appendChild(trail);
    setTimeout(() => trail.remove(), 900);
  }

  for (let i = 0; i < hazeCount; i += 1) {
    const nebula = document.createElement("div");
    nebula.className = "drag-trail nebula";
    const size = hazeSize + Math.random() * 40;
    const rotation = Math.floor(Math.random() * 360);
    const color = starPalette[Math.floor(Math.random() * starPalette.length)];
    const offset = i * (spacing * 0.8);
    const jitter = (Math.random() - 0.5) * 14;

    nebula.style.left = `${event.clientX - dirX * offset + jitter}px`;
    nebula.style.top = `${event.clientY - dirY * offset + jitter}px`;
    nebula.style.setProperty("--trail-nebula-size", `${size}px`);
    nebula.style.setProperty("--trail-rot", `${rotation}deg`);
    nebula.style.setProperty("--trail-haze", color.haze);
    nebula.style.setProperty("--trail-haze-2", color.haze2);
    nebula.style.setProperty("--trail-life", `${1.1 + Math.min(speed * 0.8, 1.2)}s`);

    document.body.appendChild(nebula);
    setTimeout(() => nebula.remove(), 1400);
  }

  lastTrailPoint = { x: event.clientX, y: event.clientY, time: now };
}

function spawnAmbientTrail(event) {
  const now = performance.now();
  if (now - ambientTrailTime < 140) return;
  ambientTrailTime = now;
  const prev = ambientTrailPoint;
  const dt = prev ? now - prev.time : 16;
  const dx = prev ? event.clientX - prev.x : 0;
  const dy = prev ? event.clientY - prev.y : 0;
  const dist = Math.hypot(dx, dy);
  const speed = dt > 0 ? dist / dt : 0;
  const count = speed > 0.6 ? 2 : 1;
  const sizeBase = 6 + Math.min(speed * 6, 6);

  for (let i = 0; i < count; i += 1) {
    const trail = document.createElement("div");
    trail.className = "drag-trail star ambient";
    const size = sizeBase + Math.random() * 6;
    const rotation = Math.floor(Math.random() * 360);
    const color = starPalette[Math.floor(Math.random() * starPalette.length)];
    const jitter = (Math.random() - 0.5) * 8;
    trail.style.left = `${event.clientX + jitter}px`;
    trail.style.top = `${event.clientY + jitter}px`;
    trail.style.setProperty("--trail-size", `${size}px`);
    trail.style.setProperty("--trail-rot", `${rotation}deg`);
    trail.style.setProperty("--trail-color", color.c1);
    trail.style.setProperty("--trail-color-2", color.c2);
    trail.style.setProperty("--trail-glow", color.glow);
    trail.style.setProperty("--trail-haze", color.haze);
    trail.style.setProperty("--trail-haze-2", color.haze2);
    trail.style.setProperty("--trail-life", `${1.1 + Math.min(speed * 0.6, 0.6)}s`);
    document.body.appendChild(trail);
    setTimeout(() => trail.remove(), 1200);
  }

  ambientTrailPoint = { x: event.clientX, y: event.clientY, time: now };
}

function attachAmbientTrail() {
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      const target = event.target;
      if (!target) return;
      if (
        target.closest(".panel") ||
        target.closest(".dock") ||
        target.closest(".panel-settings") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("textarea")
      ) {
        return;
      }
      spawnAmbientTrail(event);
    },
    { passive: true }
  );
}

function setPanelPosition(panel, left, top) {
  const rect = panel.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(0, window.innerHeight - rect.height);
  const clampedLeft = Math.min(Math.max(0, left), maxLeft);
  const clampedTop = Math.min(Math.max(0, top), maxTop);
  panel.style.left = `${clampedLeft}px`;
  panel.style.top = `${clampedTop}px`;
  panel.style.transform = "none";
}

function layoutShowcasePanels() {
  const order = [
    foryouPanel,
    cssmvPanel,
    watchPanel,
    lyricsPanel,
    musicPanel,
    videoPanel,
    settingsPanel
  ].filter(Boolean);
  const visible = order.filter(
    (panel) =>
      !panel.classList.contains("hidden") &&
      panel.dataset.userMoved !== "true" &&
      panel.id !== "logo-panel"
  );
  if (!visible.length) return;

  const spacing = 26;
  const paddingX = 32;
  const paddingY = 88;
  const minWidth = 340;
  const maxWidth = 520;
  const availableWidth = Math.max(0, window.innerWidth - paddingX * 2);
  const columns = Math.max(
    1,
    Math.min(3, Math.floor((availableWidth + spacing) / (minWidth + spacing)))
  );
  const panelWidth = Math.max(
    minWidth,
    Math.min(maxWidth, Math.floor((availableWidth - spacing * (columns - 1)) / columns))
  );

  visible.forEach((panel) => {
    panel.classList.add("showcase-panel");
    panel.style.width = `${panelWidth}px`;
    if (!panel.classList.contains("panel-collapsed") && panel.dataset.maximized !== "true") {
      panel.style.height = "";
    }
  });

  const rowHeights = [];
  visible.forEach((panel, index) => {
    const row = Math.floor(index / columns);
    const rect = panel.getBoundingClientRect();
    rowHeights[row] = Math.max(rowHeights[row] || 0, rect.height);
  });

  const rowOffsets = [];
  let offset = paddingY;
  rowHeights.forEach((height, row) => {
    rowOffsets[row] = offset;
    offset += height + spacing;
  });

  const maxHeight = window.innerHeight - paddingY;
  let overflowIndex = visible.length;
  for (let row = 0; row < rowHeights.length; row += 1) {
    if (rowOffsets[row] + rowHeights[row] > maxHeight) {
      overflowIndex = row * columns;
      break;
    }
  }

  visible.forEach((panel, index) => {
    if (index >= overflowIndex) return;
    const row = Math.floor(index / columns);
    const col = index % columns;
    const left = paddingX + col * (panelWidth + spacing);
    const top = rowOffsets[row] ?? paddingY;
    setPanelPosition(panel, left, top);
  });

  if (overflowIndex < visible.length) {
    const lastVisibleIndex = Math.max(0, overflowIndex - 1);
    const anchor = visible[lastVisibleIndex];
    const anchorRect = anchor ? anchor.getBoundingClientRect() : null;
    const baseLeft = anchorRect ? anchorRect.left : paddingX;
    const baseTop = anchorRect ? Math.min(anchorRect.top + 24, window.innerHeight - 260) : paddingY;
    const barHeight = anchor?.querySelector(".panel-bar")?.offsetHeight || 56;
    const offsetStep = barHeight + 8;
    visible.slice(overflowIndex).forEach((panel, idx) => {
      const offset = offsetStep * (idx + 1);
      const left = Math.min(baseLeft + offset, window.innerWidth - panelWidth - paddingX);
      const top = Math.min(baseTop + offset, window.innerHeight - 200);
      setPanelPosition(panel, left, top);
    });
  }
}

function clampPanelInViewport(panel) {
  if (!panel) return;
  if (!panel.style.left && !panel.style.top) return;
  const rect = panel.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(0, window.innerHeight - rect.height);
  const clampedLeft = Math.min(Math.max(0, rect.left), maxLeft);
  const clampedTop = Math.min(Math.max(0, rect.top), maxTop);
  panel.style.left = `${clampedLeft}px`;
  panel.style.top = `${clampedTop}px`;
  panel.style.transform = "none";
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return null;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = ((hue % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const m = l - c / 2;
  const toHex = (value) => {
    const v = Math.round((value + m) * 255);
    return v.toString(16).padStart(2, "0");
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function applyBackgroundPalette() {
  const alphas = [0.6, 0.55, 0.5, 0.7];
  bgColorInputs.forEach((input, index) => {
    if (!input) return;
    const rgb = hexToRgb(input.value);
    if (!rgb) return;
    const color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alphas[index] || 0.28})`;
    document.documentElement.style.setProperty(`--wc${index + 1}`, color);
  });
}

function formatSlogan(spell) {
  return `Just say <span class="spell">${spell}</span>, witness the miracle!`;
}

function formatApplyLabel(spell) {
  return `Say ${spell} · Render`;
}

function formatToast(spell) {
  return `${spell} awakened · 流流流`;
}

function formatComposing(spell) {
  return `${spell} is composing...`;
}

function replaceSpell(text, from, to) {
  if (!text) return text;
  return text.split(from).join(to);
}

function replaceSpellInLines(lines, from, to) {
  if (!lines) return [];
  return lines.map((line) => replaceSpell(line, from, to));
}

function buildLyricsText(title, lines) {
  return `Title · ${title}\n\n${lines.join("\n")}`;
}

function applySpell(spell, options = {}) {
  const { force = false, refreshPanels = true } = options;
  const next = spell.trim() || DEFAULT_SPELL;
  const prev = state.spell;
  if (!force && next === prev) return;
  state.spell = next;

  if (mirrorTitle) mirrorTitle.textContent = next;
  if (mirrorSlogan) mirrorSlogan.innerHTML = formatSlogan(next);
  if (applySettings) applySettings.textContent = formatApplyLabel(next);
  if (toast) toast.textContent = formatToast(next);

  if (watchSubtitle && watchSubtitle.textContent.includes(prev)) {
    watchSubtitle.textContent = replaceSpell(watchSubtitle.textContent, prev, next);
  }

  if (refreshPanels && state.baseLines) {
    clearTimeout(typingTimer);
    const baseText = state.baseLines.join("\n");
    if (baseText.includes(DEFAULT_SPELL)) {
      state.lines = replaceSpellInLines(state.baseLines, DEFAULT_SPELL, next);
    } else {
      state.lines = replaceSpellInLines(state.lines || state.baseLines, prev, next);
    }
    updateEnginePanels(state.title, state.lines);
    if (lyricsEl) {
      lyricsEl.textContent = buildLyricsText(state.title, state.lines);
    }
  }
}

function randomizePalette() {
  const baseHue = 140 + Math.random() * 70;
  const spread = 12 + Math.random() * 18;
  const palette = [
    hslToHex(baseHue - spread, 52 + Math.random() * 18, 18 + Math.random() * 14),
    hslToHex(baseHue + spread, 48 + Math.random() * 22, 22 + Math.random() * 16),
    hslToHex(baseHue + spread * 2, 58 + Math.random() * 20, 30 + Math.random() * 18),
    hslToHex(baseHue - spread * 2, 45 + Math.random() * 20, 20 + Math.random() * 14)
  ];

  bgColorInputs.forEach((input, index) => {
    if (!input) return;
    input.value = palette[index] || input.value;
  });
  applyBackgroundPalette();
  showToast("Watercolor palette randomized");
}

function groupScenes(lines) {
  const scenes = [];
  let current = null;
  lines.forEach((line) => {
    if (/^(Scene|Verse|Chorus|Bridge|Outro)/i.test(line)) {
      if (current) scenes.push(current);
      current = { title: line, lines: [] };
      return;
    }
    if (current && line.trim()) {
      current.lines.push(line);
    }
  });
  if (current) scenes.push(current);
  return scenes;
}

function clearChildren(el) {
  if (!el) return;
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

const SCENE_STATE_CLASSES = ["queued", "rendering", "paused", "canceled", "done", "delete"];

function setSceneState(row, statusEl, state) {
  if (!row || !statusEl) return;
  const next = state || "queued";
  row.dataset.state = next;
  statusEl.dataset.state = next;
  row.classList.remove(...SCENE_STATE_CLASSES, "delete-armed");
  statusEl.classList.remove(...SCENE_STATE_CLASSES);
  row.classList.add(next);
  statusEl.classList.add(next);
  if (next === "delete") {
    row.classList.add("delete-armed");
  }
  statusEl.textContent = next === "delete" ? "DELETE" : next.toUpperCase();
}

function pruneSceneRows() {
  sceneRows = sceneRows.filter((entry) => entry && entry.row && entry.row.isConnected);
}

function syncSceneProgress(videoValue) {
  pruneSceneRows();
  if (!sceneRows.length) return;
  if (engineStates.video !== "running") return;
  const total = sceneRows.length;
  const doneTarget = Math.min(total, Math.floor((videoValue / 100) * total));
  sceneRows.forEach((entry, index) => {
    if (!entry || !entry.statusEl || !entry.row) return;
    const current = entry.statusEl.dataset.state || "queued";
    if (["paused", "canceled", "delete"].includes(current)) return;
    if (index < doneTarget) {
      if (current !== "done") setSceneState(entry.row, entry.statusEl, "done");
      return;
    }
    if (index === doneTarget && doneTarget < total && videoValue < 100) {
      if (current !== "rendering") setSceneState(entry.row, entry.statusEl, "rendering");
      return;
    }
    if (current !== "queued") setSceneState(entry.row, entry.statusEl, "queued");
  });
}

function renderSceneList(scenes) {
  if (!sceneList) return;
  clearChildren(sceneList);
  sceneRows = [];
  scenes.forEach((scene, index) => {
    const item = document.createElement("div");
    item.className = "scene-item";

    const sceneIndex = document.createElement("span");
    const sceneTitle = document.createElement("span");
    const sceneStatus = document.createElement("span");

    const parts = scene.title.split("·");
    sceneIndex.textContent = parts[0]?.trim() || `Scene ${index + 1}`;
    sceneTitle.textContent = parts[1]?.trim() || "Flow";
    const initialState = index === 0 ? "rendering" : "queued";
    sceneStatus.className = "scene-status";
    setSceneState(item, sceneStatus, initialState);
    item.addEventListener("click", () => {
      cycleSceneStatus(sceneStatus);
    });

    item.appendChild(sceneIndex);
    item.appendChild(sceneTitle);
    item.appendChild(sceneStatus);
    sceneList.appendChild(item);
    sceneRows.push({ row: item, statusEl: sceneStatus });
  });
}

function renderLyricsGrid(scenes) {
  if (!lyricsGrid) return;
  clearChildren(lyricsGrid);
  scenes.forEach((scene) => {
    const card = document.createElement("div");
    card.className = "engine-card";

    const title = document.createElement("div");
    title.className = "engine-title";
    title.textContent = scene.title;

    const excerpt = document.createElement("p");
    excerpt.textContent = scene.lines.slice(0, 2).join(" / ");

    card.appendChild(title);
    card.appendChild(excerpt);
    lyricsGrid.appendChild(card);
  });
}

function renderTags(container, tags) {
  if (!container) return;
  clearChildren(container);
  tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    container.appendChild(chip);
  });
}

function setForyouCompact(enabled) {
  if (!foryouPanel) return;
  if (enabled) {
    foryouPanel.classList.add("foryou-compact");
  } else {
    foryouPanel.classList.remove("foryou-compact");
  }
}

function cycleSceneStatus(statusEl) {
  if (!statusEl) return;
  const current = statusEl.dataset.state || "";
  const row = statusEl.closest(".scene-item");
  if (!row) return;
  if (current === "done") {
    setSceneState(row, statusEl, "delete");
    showToast("Click again to delete");
    return;
  }
  if (current === "delete") {
    row.remove();
    pruneSceneRows();
    showToast("Scene removed");
    return;
  }
  let next = "paused";
  let toastMessage = "Scene paused";
  if (current === "paused") {
    next = "rendering";
    toastMessage = "Scene resumed";
  } else if (current === "rendering") {
    next = "canceled";
    toastMessage = "Scene canceled";
  } else if (current === "canceled") {
    next = "queued";
    toastMessage = "Scene continued";
  } else if (current === "queued") {
    next = "paused";
    toastMessage = "Scene paused";
  }
  setSceneState(row, statusEl, next);
  showToast(toastMessage);
}

function renderStats(container, stats) {
  if (!container) return;
  clearChildren(container);
  stats.forEach((stat) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    const value = document.createElement("span");
    value.textContent = stat.value;
    card.textContent = `${stat.label}`;
    card.appendChild(value);
    container.appendChild(card);
  });
}

function renderCameraBoard(scenes) {
  if (!cameraBoard) return;
  clearChildren(cameraBoard);
  scenes.forEach((scene, index) => {
    const row = document.createElement("div");
    row.className = "camera-row";

    const label = document.createElement("strong");
    label.textContent = `Scene ${index + 1}`;

    const move = document.createElement("span");
    move.textContent = pickRandom(cameraMoveBank, 1)[0];

    const lens = document.createElement("span");
    lens.className = "camera-mode";
    lens.textContent = pickRandom(lensBank, 1)[0];

    row.appendChild(label);
    row.appendChild(move);
    row.appendChild(lens);
    cameraBoard.appendChild(row);
  });
}

function renderLyricFlow(scenes) {
  if (!lyricFlow) return;
  clearChildren(lyricFlow);
  scenes.forEach((scene, index) => {
    const row = document.createElement("div");
    row.className = "flow-row";

    const time = document.createElement("span");
    const minutes = String(index).padStart(2, "0");
    const seconds = String((index * 12) % 60).padStart(2, "0");
    time.textContent = `${minutes}:${seconds}`;

    const bar = document.createElement("div");
    bar.className = "flow-bar";
    const fill = document.createElement("span");
    fill.style.width = `${60 + Math.random() * 30}%`;
    bar.appendChild(fill);

    const label = document.createElement("span");
    const parts = scene.title.split("·");
    label.textContent = parts[1]?.trim() || flowBank[index % flowBank.length];

    row.appendChild(time);
    row.appendChild(bar);
    row.appendChild(label);
    lyricFlow.appendChild(row);
  });
}

function renderMixGrid() {
  if (!mixGrid) return;
  clearChildren(mixGrid);
  pickRandom(mixBank, 5).forEach((layer) => {
    const card = document.createElement("div");
    card.className = "mix-card";

    const title = document.createElement("div");
    title.className = "mix-title";
    title.textContent = layer;

    const level = document.createElement("div");
    level.className = "mix-level";
    const fill = document.createElement("span");
    fill.style.width = `${55 + Math.random() * 40}%`;
    level.appendChild(fill);

    card.appendChild(title);
    card.appendChild(level);
    mixGrid.appendChild(card);
  });
}

function buildShots(count) {
  const total = Math.max(6, count * 4);
  return Array.from({ length: total }, (_, index) => ({
    id: index + 1,
    move: pickRandom(cameraMoveBank, 1)[0],
    lens: pickRandom(lensBank, 1)[0]
  }));
}

function renderStoryboard(shots) {
  if (!storyboard) return;
  clearChildren(storyboard);
  shots.slice(0, 8).forEach((shot) => {
    const frame = document.createElement("div");
    frame.className = "story-frame";
    frame.textContent = `Shot ${String(shot.id).padStart(2, "0")} · ${shot.move}`;
    storyboard.appendChild(frame);
  });
}

function renderCameraList(shots) {
  if (!cameraList) return;
  clearChildren(cameraList);
  shots.slice(0, 4).forEach((shot) => {
    const item = document.createElement("div");
    item.className = "camera-item";
    item.textContent = `Shot ${String(shot.id).padStart(2, "0")}`;
    const detail = document.createElement("span");
    detail.textContent = `${shot.move} · ${shot.lens}`;
    item.appendChild(detail);
    cameraList.appendChild(item);
  });
}

function buildStyleTags(style, voice) {
  const base = styleTagMap[style] ? pickRandom(styleTagMap[style], 4) : pickRandom(mvTagBank, 4);
  return [...new Set([...base, voice])];
}

function updateEnginePanels(title, lines) {
  const style = styleInput ? styleInput.value : state.style;
  const voice = voiceInput ? voiceInput.value : state.voice;
  const scenes = groupScenes(lines);
  const resolvedScenes = scenes.length
    ? scenes
    : [{ title: "Scene 1 · Flow", lines: lines.filter(Boolean).slice(0, 3) }];
  const shots = buildShots(resolvedScenes.length);
  const stats = [
    { label: "Tempo", value: `${72 + Math.floor(Math.random() * 26)} BPM` },
    { label: "Energy", value: `${70 + Math.floor(Math.random() * 25)}%` },
    { label: "Render", value: `${84 + Math.floor(Math.random() * 12)}%` },
    { label: "Sync", value: `${88 + Math.floor(Math.random() * 10)}%` }
  ];
  const styleTags = buildStyleTags(style, voice);
  const mvTagSet = [...new Set([...styleTags, ...pickRandom(mvTagBank, 2)])];
  const videoTagSet = [...new Set([...pickRandom(videoTagBank, 3), ...pickRandom(mvTagBank, 1)])];

  if (mvTitle) mvTitle.textContent = title;
  if (foryouTitle) foryouTitle.textContent = title;
  if (foryouStyle) foryouStyle.textContent = `${style} · ${voice}`;
  if (mvSub)
    mvSub.textContent = `${resolvedScenes.length} Scene · ${shots.length} Shots · Live Karaoke`;
  if (videoScript)
    videoScript.textContent = `Auto script loaded · ${resolvedScenes.length} scenes ready`;
  if (musicStyle) musicStyle.textContent = style;
  if (voiceStyle) voiceStyle.textContent = voice;

  renderSceneList(resolvedScenes);
  renderLyricsGrid(resolvedScenes);
  renderTags(mvTags, mvTagSet);
  renderStats(mvStats, stats);
  renderCameraBoard(resolvedScenes);
  renderLyricFlow(resolvedScenes);
  renderTags(musicTags, styleTags);
  renderMixGrid();
  renderTags(videoTags, videoTagSet);
  renderStoryboard(shots);
  renderCameraList(shots);
  renderTags(foryouTags, styleTags);

  state.title = title;
  state.lines = lines;
  state.style = style;
  state.voice = voice;
}

async function startCreation(customTitle, customLyrics) {
  const allowed = await consumeGeneration();
  if (!allowed) return;
  const selection = lyricBank[Math.floor(Math.random() * lyricBank.length)];
  const title = customTitle || selection.title;
  const baseLines = customLyrics?.trim()
    ? customLyrics.trim().split("\n")
    : selection.lines;
  const lines = replaceSpellInLines(baseLines, DEFAULT_SPELL, state.spell);
  const lyricText = buildLyricsText(title, lines);
  lyricsTargetLength = lyricText.length;

  watchSubtitle.textContent = "KaraOK MV · Rendering";
  cssmvTriggered = false;
  watchTriggered = false;
  resetTypingState();
  resetEngineStates();
  setForyouCompact(false);
  cssmvPanel.classList.add("hidden");
  watchPanel.classList.add("hidden");
  updateDockVisibility();
  typewriter(lyricsEl, lyricText, 18, () => {
    setForyouCompact(true);
    if (!cssmvTriggered) {
      cssmvTriggered = true;
      openPanel(cssmvPanel);
      layoutShowcasePanels();
    }
  });
  animateProgress();
  updateEnginePanels(title, lines);
  requestVideoPreview(title, lines);
  state.baseLines = baseLines;
  state.lines = lines;
  openPanel(foryouPanel);
  layoutShowcasePanels();
}

function handleMicClick() {
  showToast(formatToast(state.spell));
  startCreation();
}

function handleMicLongPress() {
  const custom = window.prompt("Say the title", "嫦娥奔月");
  if (custom) {
    startCreation(custom);
  }
}

function cycleSelect(selectEl) {
  if (!selectEl || !selectEl.options.length) return "";
  const next = (selectEl.selectedIndex + 1) % selectEl.options.length;
  selectEl.selectedIndex = next;
  return selectEl.value;
}

function refreshEngines() {
  const selection = lyricBank[Math.floor(Math.random() * lyricBank.length)];
  updateEnginePanels(selection.title, selection.lines);
  showToast("Engines refreshed · 流流流");
}

function cycleMusicStyle() {
  const style = cycleSelect(styleInput);
  updateEnginePanels(state.title, state.lines);
  if (style) showToast(`Style · ${style}`);
}

function cycleVoice() {
  const voice = cycleSelect(voiceInput);
  updateEnginePanels(state.title, state.lines);
  if (voice) showToast(`Voice · ${voice}`);
}

function shuffleStoryboard() {
  updateEnginePanels(state.title, state.lines);
  showToast("Storyboard shuffled");
}

function resetSettings() {
  if (titleInput) titleInput.value = "";
  if (lyricsInput) lyricsInput.value = "";
  if (styleInput) styleInput.selectedIndex = 0;
  if (voiceInput) voiceInput.selectedIndex = 0;
  updateEnginePanels(state.title, state.lines);
  showToast("Settings reset");
}

const dockActionMap = {
  mic: {
    click: handleMicClick,
    dblclick: () => openPanel(settingsPanel),
    longpress: handleMicLongPress
  },
  foryou: {
    click: () => openPanel(foryouPanel),
    dblclick: () => startCreation(),
    longpress: () => openPanel(lyricsPanel)
  },
  cssmv: {
    click: () => openPanel(cssmvPanel),
    dblclick: () => openPanel(watchPanel),
    longpress: () => openPanel(videoPanel)
  },
  lyrics: {
    click: () => openPanel(lyricsPanel),
    dblclick: refreshEngines,
    longpress: () => openPanel(settingsPanel)
  },
  music: {
    click: () => openPanel(musicPanel),
    dblclick: cycleMusicStyle,
    longpress: cycleVoice
  },
  video: {
    click: () => openPanel(videoPanel),
    dblclick: shuffleStoryboard,
    longpress: () => openPanel(watchPanel)
  },
  watch: {
    click: () => openPanel(watchPanel),
    dblclick: () => openAndMaximize(watchPanel),
    longpress: () => openPanel(cssmvPanel)
  },
  login: {
    click: () => openPanel(loginPanel),
    dblclick: () => openAndMaximize(loginPanel),
    longpress: () => openPanel(worksPanel)
  },
  works: {
    click: () => openPanel(worksPanel),
    dblclick: () => openAndMaximize(worksPanel),
    longpress: () => openPanel(loginPanel)
  },
  settings: {
    click: () => openPanel(settingsPanel),
    dblclick: () => startCreation(titleInput.value.trim(), lyricsInput.value.trim()),
    longpress: resetSettings
  }
};

function handleDockAction(action, type) {
  const mapping = dockActionMap[action];
  if (!mapping) return;
  const handler = mapping[type];
  if (handler) handler();
}

function attachDockEvents() {
  document.querySelectorAll(".dock-item").forEach((item) => {
    const action = item.dataset.action;
    let suppressClick = false;
    let longPressId;

    const triggerAction = (type) => {
      handleDockAction(action, type);
      item.classList.add("active");
      setTimeout(() => item.classList.remove("active"), 600);
    };

    item.addEventListener("click", () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      clearTimeout(dockClickTimers.get(action));
      const timer = setTimeout(() => triggerAction("click"), CLICK_DELAY);
      dockClickTimers.set(action, timer);
    });

    item.addEventListener("dblclick", () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      clearTimeout(dockClickTimers.get(action));
      triggerAction("dblclick");
    });

    item.addEventListener("pointerdown", () => {
      suppressClick = false;
      clearTimeout(longPressId);
      longPressId = setTimeout(() => {
        suppressClick = true;
        triggerAction("longpress");
      }, LONGPRESS_MS);
    });

    item.addEventListener("pointerup", () => {
      clearTimeout(longPressId);
    });

    item.addEventListener("pointerleave", () => {
      clearTimeout(longPressId);
    });
  });
}

function attachPanelDrag() {
  document.querySelectorAll(".panel").forEach((panel) => {
    const handle =
      panel.querySelector(".panel-bar") || panel.querySelector("[data-drag-handle]");
    if (!handle) return;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;

    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".panel-actions")) return;
      if (event.target.closest("button")) return;
      if (panel.classList.contains("panel-locked")) return;
      panel.dataset.userMoved = "true";
      panel.classList.remove("showcase-panel");
      if (panel.dataset.maximized === "true") {
        restorePanel(panel);
      }
      dragging = true;
      panel.classList.add("dragging");
      focusPanel(panel);
      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      spawnDragTrail(event);
      const proposedLeft = event.clientX - offsetX;
      const proposedTop = event.clientY - offsetY;
      setPanelPosition(panel, proposedLeft, proposedTop);
    });

    const stopDrag = (event) => {
      dragging = false;
      panel.classList.remove("dragging");
      handle.releasePointerCapture(event.pointerId);
    };

    handle.addEventListener("pointerup", stopDrag);
    handle.addEventListener("pointercancel", stopDrag);
  });
}

function attachPanelBarActions() {
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.addEventListener("dblclick", (event) => {
      if (event.target.closest(".panel-actions")) return;
      if (event.target.closest(".panel-settings")) return;
      if (
        event.target.closest("button") ||
        event.target.closest("input") ||
        event.target.closest("select") ||
        event.target.closest("textarea")
      ) {
        return;
      }
      togglePanelSettings(panel);
    });
  });
}

function attachResize() {
  document.querySelectorAll(".panel").forEach((panel) => {
    const handle = panel.querySelector(".resize-handle");
    if (!handle) return;
    let resizing = false;

    handle.addEventListener("pointerdown", (event) => {
      if (panel.classList.contains("panel-locked")) return;
      panel.dataset.userMoved = "true";
      panel.classList.remove("showcase-panel");
      resizing = true;
      if (panel.dataset.maximized === "true") {
        restorePanel(panel);
      }
      panel.classList.add("dragging");
      focusPanel(panel);
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!resizing) return;
      const rect = panel.getBoundingClientRect();
      const maxWidth = Math.max(MIN_PANEL_WIDTH, window.innerWidth - rect.left);
      const maxHeight = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - rect.top);
      const width = Math.min(
        Math.max(MIN_PANEL_WIDTH, event.clientX - rect.left),
        maxWidth
      );
      const height = Math.min(
        Math.max(MIN_PANEL_HEIGHT, event.clientY - rect.top),
        maxHeight
      );
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
    });

    const stopResize = (event) => {
      resizing = false;
      panel.classList.remove("dragging");
      handle.releasePointerCapture(event.pointerId);
    };

    handle.addEventListener("pointerup", stopResize);
    handle.addEventListener("pointercancel", stopResize);
  });
}

function attachPanelFocus() {
  panels.forEach((panel) => {
    if (!panel) return;
    panel.addEventListener("pointerdown", () => focusPanel(panel), true);
    panel.addEventListener("click", () => focusPanel(panel), true);
  });
}

function attachLogoPanelActions() {
  if (!logoPanel) return;
  const mirror = logoPanel.querySelector(".mirror");
  const handleDblClick = (event) => {
    if (event.target.closest(".panel-settings")) return;
    if (
      event.target.closest("button") ||
      event.target.closest("input") ||
      event.target.closest("select") ||
      event.target.closest("textarea")
    ) {
      return;
    }
    event.preventDefault();
    togglePanelSettings(logoPanel);
  };

  logoPanel.addEventListener("dblclick", handleDblClick);
  if (mirror) {
    mirror.addEventListener("dblclick", handleDblClick);
  }
}

function minimizeToDock(panel) {
  panel.classList.add("hidden");
  panel.dataset.minimized = "true";
  updateDockVisibility();
  const action = dockByPanel[panel.id];
  if (!action) return;
  const dockItem = document.querySelector(`.dock-item[data-action=\"${action}\"]`);
  if (!dockItem) return;
  dockItem.classList.add("active");
  setTimeout(() => dockItem.classList.remove("active"), 600);
}

function togglePanelLock(panel) {
  panel.classList.toggle("panel-locked");
  if (panel.classList.contains("panel-locked")) {
    focusPanel(panel);
  }
}

function togglePanelCollapse(panel) {
  if (!panel) return;
  const bar = panel.querySelector(".panel-bar");
  if (!bar) return;
  const isCollapsed = panel.classList.contains("panel-collapsed");
  if (isCollapsed) {
    panel.classList.remove("panel-collapsed");
    const restoreHeight = panel.dataset.collapseHeight ?? "";
    panel.style.height = restoreHeight;
    if (panel.dataset.collapseMaximized === "true") {
      panel.dataset.collapseMaximized = "false";
      panel.dataset.maximized = "true";
      panel.classList.add("maximized");
    }
    panel.dataset.collapseHeight = "";
    return;
  }
  panel.dataset.collapseHeight = panel.style.height || "";
  if (panel.dataset.maximized === "true") {
    panel.dataset.collapseMaximized = "true";
    panel.dataset.maximized = "false";
    panel.classList.remove("maximized");
  } else {
    panel.dataset.collapseMaximized = "false";
  }
  panel.classList.add("panel-collapsed");
  panel.style.height = `${bar.offsetHeight}px`;
}

function togglePanelSettings(panel) {
  panel.classList.toggle("show-settings");
  focusPanel(panel);
}

function attachPanelActions() {
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.querySelectorAll(".panel-actions .icon-btn").forEach((button) => {
      const action =
        button.dataset.action || button.getAttribute("aria-label") || "";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (action === "settings") togglePanelSettings(panel);
        if (action === "minimize") togglePanelCollapse(panel);
        if (action === "lock") togglePanelLock(panel);
        if (action === "close") minimizeToDock(panel);
      });
    });
  });
}

function buildPanelSettings(panel) {
  if (panel.querySelector(".panel-settings")) return;

  const titleEl = panel.querySelector(".panel-title");
  const isLogoPanel = panel.id === "logo-panel";
  const rect = panel.getBoundingClientRect();
  const computed = window.getComputedStyle(panel);
  const blurMatch =
    (typeof computed.backdropFilter === "string"
      ? computed.backdropFilter.match(/blur\\((\\d+(?:\\.\\d+)?)px\\)/)
      : null) ||
    (typeof computed.webkitBackdropFilter === "string"
      ? computed.webkitBackdropFilter.match(/blur\\((\\d+(?:\\.\\d+)?)px\\)/)
      : null);
  const blur = blurMatch ? parseFloat(blurMatch[1]) : 18;
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const opacity = parseFloat(panel.dataset.panelOpacity || "0");
  const accent = panel.style.getPropertyValue("--panel-accent") || "";

  panel.dataset.panelBlur = panel.dataset.panelBlur || `${blur}`;
  panel.dataset.panelWidth = panel.dataset.panelWidth || `${width}`;
  panel.dataset.panelHeight = panel.dataset.panelHeight || `${height}`;
  panel.dataset.panelOpacity = panel.dataset.panelOpacity || `${opacity}`;
  panel.dataset.panelAccent = panel.dataset.panelAccent || accent;

  const settings = document.createElement("div");
  settings.className = "panel-settings";
  settings.innerHTML = `
    <div class="panel-settings-title">Panel Settings</div>
    <label data-setting-block="title">
      Title
      <input type="text" data-setting="title" />
    </label>
    ${
      isLogoPanel
        ? `
      <label>
        Incantation
        <input type="text" data-setting="spell" />
      </label>
    `
        : ""
    }
    <label>
      Accent Color
      <input type="color" data-setting="accent" />
    </label>
    <label>
      Glass Opacity
      <input type="range" min="0" max="0.9" step="0.05" data-setting="opacity" />
    </label>
    <label>
      Blur (px)
      <input type="range" min="0" max="28" step="1" data-setting="blur" />
    </label>
    <div class="row">
      <label>
        Width (px)
        <input type="number" min="320" max="1400" step="10" data-setting="width" />
      </label>
      <label>
        Height (px)
        <input type="number" min="240" max="1000" step="10" data-setting="height" />
      </label>
    </div>
    ${
      isLogoPanel
        ? `
      <div class="panel-settings-title">Mirror Media</div>
      <label>
        Mirror Image 1
        <input type="file" accept="image/*" data-setting="mirror-image-1" />
      </label>
      <label>
        Mirror Image 2
        <input type="file" accept="image/*" data-setting="mirror-image-2" />
      </label>
      <label>
        Mirror Video
        <input type="file" accept="video/*" data-setting="mirror-video" />
      </label>
    `
        : ""
    }
    <div class="actions">
      <button type="button" class="cta ghost" data-setting="reset">Reset</button>
    </div>
  `;

  panel.appendChild(settings);

  const titleInput = settings.querySelector('[data-setting="title"]');
  const titleBlock = settings.querySelector('[data-setting-block="title"]');
  if (!titleEl) {
    titleBlock.style.display = "none";
  } else {
    titleInput.value = titleEl.textContent.trim();
    titleInput.addEventListener("input", () => {
      titleEl.textContent = titleInput.value || titleEl.textContent;
    });
  }

  const accentInput = settings.querySelector('[data-setting="accent"]');
  const opacityInput = settings.querySelector('[data-setting="opacity"]');
  const blurInput = settings.querySelector('[data-setting="blur"]');
  const widthInput = settings.querySelector('[data-setting="width"]');
  const heightInput = settings.querySelector('[data-setting="height"]');
  const resetButton = settings.querySelector('[data-setting="reset"]');
  const mirrorImgInput1 = settings.querySelector('[data-setting="mirror-image-1"]');
  const mirrorImgInput2 = settings.querySelector('[data-setting="mirror-image-2"]');
  const mirrorVideoInput = settings.querySelector('[data-setting="mirror-video"]');
  const spellInput = settings.querySelector('[data-setting="spell"]');
  let mirrorA = null;
  let mirrorB = null;
  let mirrorVideo = null;

  const storedAccent = panel.dataset.panelAccent;
  accentInput.value = storedAccent && storedAccent.startsWith("#") ? storedAccent : "#00f5a0";
  opacityInput.value = panel.dataset.panelOpacity;
  blurInput.value = panel.dataset.panelBlur;
  widthInput.value = panel.dataset.panelWidth;
  heightInput.value = panel.dataset.panelHeight;

  const applyOpacity = () => {
    panel.dataset.panelOpacity = opacityInput.value;
    panel.style.backgroundColor = `rgba(0, 0, 0, ${opacityInput.value})`;
  };

  const applyBlur = () => {
    panel.dataset.panelBlur = blurInput.value;
    panel.style.backdropFilter = `blur(${blurInput.value}px)`;
    panel.style.webkitBackdropFilter = `blur(${blurInput.value}px)`;
  };

  const applySize = () => {
    panel.dataset.panelWidth = widthInput.value;
    panel.dataset.panelHeight = heightInput.value;
    panel.style.width = `${widthInput.value}px`;
    panel.style.height = `${heightInput.value}px`;
    clampPanelInViewport(panel);
  };

  const applyAccent = () => {
    panel.dataset.panelAccent = accentInput.value;
    panel.style.setProperty("--panel-accent", accentInput.value);
  };

  accentInput.addEventListener("input", applyAccent);
  opacityInput.addEventListener("input", applyOpacity);
  blurInput.addEventListener("input", applyBlur);
  widthInput.addEventListener("change", applySize);
  heightInput.addEventListener("change", applySize);

  if (isLogoPanel) {
    mirrorA = panel.querySelector(".mirror-img.mirror-a");
    mirrorB = panel.querySelector(".mirror-img.mirror-b");
    mirrorVideo = panel.querySelector(".mirror-video");
    const useImages = () => {
      panel.classList.remove("mirror-video-active");
      if (mirrorVideo) {
        mirrorVideo.pause();
        mirrorVideo.removeAttribute("src");
        mirrorVideo.load();
      }
    };

    if (mirrorImgInput1 && mirrorA) {
      mirrorImgInput1.addEventListener("change", () => {
        const file = mirrorImgInput1.files?.[0];
        if (!file) return;
        mirrorA.src = URL.createObjectURL(file);
        useImages();
      });
    }

    if (mirrorImgInput2 && mirrorB) {
      mirrorImgInput2.addEventListener("change", () => {
        const file = mirrorImgInput2.files?.[0];
        if (!file) return;
        mirrorB.src = URL.createObjectURL(file);
        useImages();
      });
    }

    if (mirrorVideoInput && mirrorVideo) {
      mirrorVideoInput.addEventListener("change", () => {
        const file = mirrorVideoInput.files?.[0];
        if (!file) return;
        mirrorVideo.src = URL.createObjectURL(file);
        mirrorVideo.play().catch(() => {});
        panel.classList.add("mirror-video-active");
      });
    }

    if (spellInput) {
      spellInput.value = state.spell;
      spellInput.addEventListener("input", () => {
        applySpell(spellInput.value, { force: true, refreshPanels: true });
      });
    }
  }

  resetButton.addEventListener("click", () => {
    const defaults = panelSettingsDefaults.get(panel);
    if (!defaults) return;
    if (titleEl && defaults.title) titleEl.textContent = defaults.title;
    accentInput.value = defaults.accent || "#00f5a0";
    opacityInput.value = defaults.opacity;
    blurInput.value = defaults.blur;
    widthInput.value = defaults.width;
    heightInput.value = defaults.height;
    applyAccent();
    applyOpacity();
    applyBlur();
    applySize();

    if (isLogoPanel) {
      if (mirrorA) mirrorA.src = "assets/mirror-1.webp";
      if (mirrorB) mirrorB.src = "assets/mirror-2.webp";
      panel.classList.remove("mirror-video-active");
      if (mirrorVideo) {
        mirrorVideo.pause();
        mirrorVideo.removeAttribute("src");
        mirrorVideo.load();
      }
      if (mirrorImgInput1) mirrorImgInput1.value = "";
      if (mirrorImgInput2) mirrorImgInput2.value = "";
      if (mirrorVideoInput) mirrorVideoInput.value = "";
      if (spellInput) spellInput.value = DEFAULT_SPELL;
      applySpell(DEFAULT_SPELL, { force: true, refreshPanels: true });
    }
  });

  panelSettingsDefaults.set(panel, {
    title: titleEl ? titleEl.textContent.trim() : "",
    accent: panel.dataset.panelAccent,
    opacity: opacityInput.value,
    blur: blurInput.value,
    width: widthInput.value,
    height: heightInput.value
  });
}

function initPanelSettings() {
  document.querySelectorAll(".panel").forEach((panel) => {
    buildPanelSettings(panel);
  });
}

applySettings.addEventListener("click", () => {
  const customLyrics = lyricsInput.value.trim();
  const customTitle = titleInput.value.trim();
  startCreation(customTitle, customLyrics);
  openPanel(foryouPanel);
});

if (randomPaletteButton) {
  randomPaletteButton.addEventListener("click", randomizePalette);
}

if (enterWatchButton) {
  enterWatchButton.addEventListener("click", async () => {
    openPanel(watchPanel);
    if (!videoJobId) {
      const ok = await playLatestVideoFromRegistry();
      if (!ok) {
        showToast("No video ready yet");
      }
    }
  });
}

if (listenButton) {
  listenButton.addEventListener("click", () => openPanel(musicPanel));
}

if (watchButton) {
  watchButton.addEventListener("click", async () => {
    openPanel(watchPanel);
    if (!videoJobId) {
      await playLatestVideoFromRegistry();
    }
  });
}

initVideoPlaybackControls();

if (styleInput) {
  styleInput.addEventListener("change", () => updateEnginePanels(state.title, state.lines));
}

if (voiceInput) {
  voiceInput.addEventListener("change", () => updateEnginePanels(state.title, state.lines));
}

bgColorInputs.forEach((input) => {
  if (!input) return;
  input.addEventListener("input", applyBackgroundPalette);
});

["mousemove", "keydown", "touchstart"].forEach((eventName) => {
  window.addEventListener(eventName, resetInactivityTimer, { passive: true });
});

resetInactivityTimer();
initPanelStack();
updateDockVisibility();
applySpell(state.spell, { force: true, refreshPanels: false });
updateEnginePanels(state.title, state.lines);
applyBackgroundPalette();
attachDockEvents();
attachPanelDrag();
attachPanelBarActions();
attachResize();
attachPanelFocus();
attachPanelActions();
attachLogoPanelActions();
initPanelSettings();
initEngineControls();
initLyricsControls();
initLanguagePanel();
fetchMe();
fetchAuthProviders();
fetchBillingStatus();
initVersionSwitcher();
if (loginLogout) {
  loginLogout.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (err) {
      // ignore
    }
    authState.user = null;
    authState.role = DEFAULT_ROLE;
    authState.tier = DEFAULT_ROLE;
    updateLoginUI();
    fetchBillingStatus();
  });
}
attachAmbientTrail();

window.addEventListener("resize", () => {
  panels.forEach((panel) => clampPanelInViewport(panel));
  layoutShowcasePanels();
});
