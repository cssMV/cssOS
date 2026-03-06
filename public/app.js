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
const profilePanel = document.getElementById("profile-panel");
const worksPanel = document.getElementById("works-panel");
const aboutPanel = document.getElementById("about-panel");
const apiPanel = document.getElementById("api-panel");
const aboutTabs = document.querySelectorAll(".about-tab");
const aboutTabContents = document.querySelectorAll(".about-tab-content");
const apiCreditBalance = document.getElementById("api-credit-balance");
const apiAddFundsBtn = document.getElementById("api-add-funds-btn");
const apiPaymentMethod = document.getElementById("api-payment-method");
const apiAutoRecharge = document.getElementById("api-auto-recharge");
const apiMonthlyLimit = document.getElementById("api-monthly-limit");
const lyricsEl = document.getElementById("lyrics");
const runline = document.getElementById("runline");
const runid = document.getElementById("runid");
const watchSubtitle = document.getElementById("watch-subtitle");
const watchVideo = document.getElementById("watch-video");
const watchSvg = document.getElementById("watch-svg");
const foryouPreviewVideo = document.getElementById("foryou-preview-video");
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
const loginPasskeyIdentifier = document.getElementById("login-passkey-identifier");
const profilePasskeyIdentifier = document.getElementById("profile-passkey-identifier");
const profileAuthStatus = document.getElementById("profile-auth-status");
const worksAvatar = document.getElementById("works-avatar");
const worksName = document.getElementById("works-name");
const worksRole = document.getElementById("works-role");
const versionToggle = document.getElementById("version-toggle");
const versionMenu = document.getElementById("version-menu");
const versionList = document.getElementById("version-list");
const versionCurrentLabel = document.getElementById("version-current");

if (watchVideo) {
  watchVideo.controls = true;
}

const { LOCALE_KEY, DEFAULT_LOCALE } = window.CSSOS_I18N_CONSTANTS;
const USER_ROLE_KEY = "cssos.userRole";
const DEFAULT_ROLE = "guest";
const PASSKEY_IDENTIFIER_KEY = "CSSOS_PASSKEY_IDENTIFIER";
const LANG_STORAGE_KEY = "CSSOS_LANG";
const LANG_AUTODETECT_KEY = "CSSOS_LANG_AUTO";
const LANG_DETECTED_KEY = "CSSOS_LANG_DETECTED";

const { languageCatalog } = window.CSSOS_I18N_CATALOG;

const { I18N } = window.CSSOS_I18N_DICT;

if (!I18N.en) I18N.en = {};
Object.assign(I18N.en, {
  "mic.recording": "Recording…",
  "mic.no_data_notice": "No data yet",
  "mic.generation_failed_playing_demo": "Generation failed · Playing demo",
  "mic.no_data_demo": "Generation failed — playing demo.",
  "mic.no_demo_found": "No demo media found.",
  "mic.demo_label": "demo",
  "mic.settings_open": "Mic settings",
  "passkey.identifier_required": "Enter your email before using passkey.",
  "overlay.close": "Close",
  "panel.about": "About",
  "about.tab.whitepaper": "Whitepaper",
  "about.tab.about": "About",
  "about.tab.contact": "Contact",
  "about.i18n.note": "Other languages are generated via i18n resources.",
  "about.ui.defaultSectionKey": "v2_investor",
  "about.ui.tabs.v1_original": "Original",
  "about.ui.tabs.v2_investor": "Investor",
  "about.ui.tabs.v3_technical": "Technical",
  "about.ui.tabs.v4_manifesto": "Manifesto",
  "about.ui.cta.primary": "Say “CSS” to begin",
  "about.ui.cta.secondary": "Tap the mirror or microphone",
  "about.sections.v1_original.title": "cssOS · cssMV — Original Vision (v1)",
  "about.sections.v1_original.body":
    "CSS Studio is developing cssMV, the media engine for the cssOS system. The goal is to build this engine in Rust and deeply extend it on top of audio models inspired by OpenAI Jukebox and video models such as VQ-VAE-2 or GAN-based approaches. With a full-stack OpenAI-aligned AI pipeline, we connect the latest frontier technologies end-to-end—turning individual capabilities into a complete creative chain. We aim to unify the full workflow from lyrics, music, and video to the final karaoke-style MV experience, redefining a revolutionary, zero-barrier user experience for artistic creation. Users only need to speak the wake phrase “CSS”, or simply tap the magic mirror/microphone, to go from lyrics to a full karaoke MV enjoyment experience.",
  "about.sections.v2_investor.title": "cssOS · cssMV — Investor Pitch",
  "about.sections.v2_investor.body":
    "cssMV is an AI-native media engine built on cssOS to deliver end-to-end creation: lyrics → music → video → karaoke MV playback. Implemented in Rust for performance and reliability, cssMV orchestrates state-of-the-art generative audio and video architectures into a single product pipeline. Our focus is productizing multimodal generation into a consumer-grade experience: one trigger (“CSS” or a single tap) turns intent into a complete MV. The result is a new category of creation platform that lowers the barrier to near-zero, expands the creator base, and enables scalable content production with consistent quality and controllable style.",
  "about.sections.v3_technical.title": "cssOS · cssMV — Technical Overview",
  "about.sections.v3_technical.body":
    "cssMV is a Rust-based media engine for cssOS, designed as a modular, extensible orchestration layer over multimodal generation. It integrates an audio generation stack (Jukebox-inspired hierarchical token/audio modeling or equivalent) and a video generation stack (VQ-VAE-2-style discrete latents and/or GAN-based synthesis), connected by a unified pipeline for semantic intent, lyric alignment, musical structure, visual storyboard, and timed karaoke rendering. The architecture prioritizes deterministic workflows, streaming generation, asset caching, and plug-in model adapters—enabling end-to-end creation while keeping components swappable as models evolve.",
  "about.sections.v4_manifesto.title": "cssOS · cssMV — Manifesto",
  "about.sections.v4_manifesto.body":
    "We believe creativity should be effortless. cssMV turns a single spark—one word, one sentence, one “CSS”—into a finished song and a complete MV you can sing along to. No tools to learn, no barriers to entry. Just intention → art. We’re not stitching features together; we’re forging a new medium where lyrics, music, and moving images become one continuous experience. This is creation for everyone—an operating system for imagination.",
  "lang.title": "Language",
  "lang.pending_banner": "Translation pending — falling back to English.",
  "lang.autodetect": "Auto-detect by IP",
  "lang.reset": "Reset to English",
  "lang.current": "Current",
  "lang.detected": "Detected",
  "lang.en": "English",
  "lang.zh": "Chinese",
  "lang.ja": "Japanese",
  "lang.ko": "Korean",
  "lang.es": "Spanish",
  "lang.fr": "French",
  "lang.de": "German",
  "lang.pt": "Portuguese",
  "lang.ru": "Russian",
  "lang.ar": "Arabic"
});

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

const currentLocaleStore = localStorage.getItem(LANG_STORAGE_KEY) || localStorage.getItem(LOCALE_KEY);
let currentLocale = currentLocaleStore || DEFAULT_LOCALE;
let languageTimer = null;
let languagePanelMode = "content";
let detectedCountry = localStorage.getItem(LANG_DETECTED_KEY) || "";

const LANGS = [
  { code: "en", nameKey: "lang.en", flag: "🇺🇸", enabled: true },
  { code: "zh", nameKey: "lang.zh", flag: "🇨🇳", enabled: false },
  { code: "ja", nameKey: "lang.ja", flag: "🇯🇵", enabled: false },
  { code: "ko", nameKey: "lang.ko", flag: "🇰🇷", enabled: false },
  { code: "es", nameKey: "lang.es", flag: "🇪🇸", enabled: false },
  { code: "fr", nameKey: "lang.fr", flag: "🇫🇷", enabled: false },
  { code: "de", nameKey: "lang.de", flag: "🇩🇪", enabled: false },
  { code: "pt", nameKey: "lang.pt", flag: "🇵🇹", enabled: false },
  { code: "ru", nameKey: "lang.ru", flag: "🇷🇺", enabled: false },
  { code: "ar", nameKey: "lang.ar", flag: "🇸🇦", enabled: false }
];

const getLocale = () => currentLocale;

const { interpolate, t } = window.CSSOS_I18N;

const ABOUT_VARIANTS = ["v1_original", "v2_investor", "v3_technical", "v4_manifesto"];
let aboutVariant = "v2_investor";

function safeT(key, localeOverride) {
  const locale = localeOverride || currentLocale || DEFAULT_LOCALE;
  const table = (I18N && I18N[locale]) || {};
  const fallback = (I18N && I18N[DEFAULT_LOCALE]) || {};
  const template = table[key] || fallback[key];
  if (!template) return `TODO_i18n(${key})`;
  return interpolate(template, {});
}

function renderAboutSubSection() {
  const aboutContent = document.querySelector('.about-tab-content[data-tab="about"]');
  if (!aboutContent) return;

  const defaultKey = safeT("about.ui.defaultSectionKey", "en");
  if (ABOUT_VARIANTS.includes(defaultKey)) {
    aboutVariant = defaultKey;
  }

  const buildTabs = () =>
    ABOUT_VARIANTS.map((v) => {
      const active = v === aboutVariant;
      const label = safeT(`about.ui.tabs.${v}`);
      return `
        <button
          type="button"
          data-variant="${v}"
          style="
            padding: 8px 12px;
            border-radius: 999px;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.14);
            background: ${active ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.25)"};
            color: white;
            opacity: ${active ? "1" : "0.85"};
          "
        >${label}</button>
      `;
    }).join("");

  const titleKey = `about.sections.${aboutVariant}.title`;
  const bodyKey = `about.sections.${aboutVariant}.body`;

  const leftTitle = safeT(titleKey, "en");
  const leftBody = safeT(bodyKey, "en");
  const rightTitle = safeT(titleKey, currentLocale);
  const rightBody = safeT(bodyKey, currentLocale);

  aboutContent.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">${buildTabs()}</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div style="padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.12);">
        <div style="opacity:0.7; font-size:12px; margin-bottom:8px;">English (en)</div>
        <h3 style="margin:0 0 8px 0;">${leftTitle}</h3>
        <p style="margin:0; line-height:1.6; opacity:0.92;">${leftBody}</p>
      </div>
      <div style="padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.12);">
        <div style="opacity:0.7; font-size:12px; margin-bottom:8px;">${currentLocale} (i18n)</div>
        <h3 style="margin:0 0 8px 0;">${rightTitle}</h3>
        <p style="margin:0; line-height:1.6; opacity:0.92;">${rightBody}</p>
      </div>
    </div>
    <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
      <button class="cta tiny">${safeT("about.ui.cta.primary")}</button>
      <button class="cta ghost tiny">${safeT("about.ui.cta.secondary")}</button>
    </div>
  `;

  aboutContent.querySelectorAll("button[data-variant]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.variant;
      if (!v) return;
      aboutVariant = v;
      renderAboutSubSection();
    });
  });
}

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

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.dataset.i18nAria;
    if (!key) return;
    const text = t(key);
    if (text) {
      el.setAttribute("aria-label", text);
    }
  });

  document.querySelectorAll(".dock-item").forEach((item) => {
    const labelEl = item.querySelector(".dock-label, .label, .dock-text");
    const label = labelEl ? labelEl.textContent.trim() : "";
    if (label) item.setAttribute("data-label", label);
    if (!item.hasAttribute("tabindex")) item.tabIndex = 0;
  });

  renderAboutSubSection();
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
        icon: provider.icon,
        logo: provider.logo_url
      }
    ])
  );
  const list = socialPlatforms.map((platform) => {
    const record = enabledMap.get(platform.id);
    const logo = record?.logo;
    const iconHtml = logo
      ? `<img src="${logo}" alt="${platform.id}" class="login-logo" />`
      : record?.icon || platform.icon;
    return {
      id: platform.id,
      icon: iconHtml,
      enabled: record?.enabled ?? isSocialEnabled(platform.id),
      url: record?.url || (record?.enabled ? `/auth/${platform.id}` : "")
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

  // Bluesky login (handle + app password) if enabled
  const bsky = enabledMap.get("bsky");
  if (bsky && bsky.enabled) {
    const form = document.createElement("div");
    form.className = "login-bluesky";
    form.innerHTML = `
      <div class="login-title">Bluesky</div>
      <div class="login-row">
        <input type="text" id="bsky-handle" placeholder="handle (e.g. name.bsky.social)" />
      </div>
      <div class="login-row">
        <input type="password" id="bsky-app-password" placeholder="app password" />
      </div>
      <button class="cta tiny" id="bsky-login-btn" type="button">Login</button>
    `;
    loginList.appendChild(form);

    const btn = form.querySelector("#bsky-login-btn");
    btn?.addEventListener("click", async () => {
      const handle = form.querySelector("#bsky-handle")?.value?.trim();
      const appPassword = form.querySelector("#bsky-app-password")?.value?.trim();
      if (!handle || !appPassword) {
        showToast(t("login.statusGuest"));
        return;
      }
      try {
        const res = await fetch("/auth/bluesky", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ handle, app_password: appPassword })
        });
        if (res.ok) {
          await fetchMe();
        }
      } catch (err) {
        // ignore
      }
    });
  }
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
      const safePath = `/v/${encodeURIComponent(id)}/`;
      const label = entry.label || id;
      const item = document.createElement("a");
      item.href = safePath;
      item.className = `version-item ${id === current ? "active" : ""}`;
      item.innerHTML = `
        <span>${label}</span>
        <span>${entry.createdAt || entry.date || ""}</span>
      `;
      item.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.assign(safePath);
      });
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

function initAboutTabs() {
  if (!aboutTabs.length || !aboutTabContents.length) return;
  aboutTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.tab;
      if (!key) return;
      aboutTabs.forEach((btn) => btn.classList.remove("active"));
      aboutTabContents.forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      const content = document.querySelector(`.about-tab-content[data-tab="${key}"]`);
      if (content) content.classList.add("active");
      if (key === "about") {
        renderAboutSubSection();
      }
    });
  });
  renderAboutSubSection();
}

function initApiBillingUI() {
  if (!apiCreditBalance) return;
  let balance = 1200;
  const formatBalance = () => {
    apiCreditBalance.textContent = `$${balance.toFixed(2)}`;
  };
  formatBalance();

  if (apiAddFundsBtn) {
    apiAddFundsBtn.addEventListener("click", () => {
      const amount = window.prompt(
        t("api.billing.addFundsPrompt"),
        t("api.billing.addFundsDefault")
      );
      if (!amount) return;
      const value = Number.parseFloat(amount);
      if (Number.isNaN(value) || value <= 0) return;
      balance += value;
      formatBalance();
    });
  }

  if (apiAutoRecharge) {
    apiAutoRecharge.addEventListener("change", () => {
      // UI-only toggle
    });
  }

  if (apiMonthlyLimit) {
    apiMonthlyLimit.addEventListener("change", () => {
      // UI-only input
    });
  }

  if (apiPaymentMethod) {
    apiPaymentMethod.addEventListener("change", () => {
      // UI-only selector
    });
  }
}

function updateComposingText() {
  if (!watchSubtitle) return;
  watchSubtitle.textContent = t("status.composing", { spell: state.spell });
}

function renderLanguageButtons(container) {
  if (!container) return;
  container.innerHTML = "";
  LANGS.forEach((lang) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lang-card";
    button.dataset.lang = lang.code;
    const label = t(lang.nameKey);
    button.innerHTML = `
      <span class="lang-flag">${lang.flag}</span>
      <span class="lang-name">${label}</span>
    `;
    if (!lang.enabled) button.classList.add("lang-pending");
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
  const current = LANGS.find((lang) => lang.code === currentLocale);
  if (current) {
    languageCurrent.textContent = `${current.flag} ${t(current.nameKey)} · ${current.code}`;
  }
}

function setLocale(locale) {
  if (!locale) return;
  if (!I18N[locale]) I18N[locale] = {};
  currentLocale = locale;
  localStorage.setItem(LANG_STORAGE_KEY, locale);
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
    updateLanguagePendingBanner();
    updateLanguageSettingsLabels();
  }, delay);
}

function updateLanguagePendingBanner() {
  if (!languagePanel) return;
  const banner = languagePanel.querySelector(".language-banner");
  if (!banner) return;
  const lang = LANGS.find((item) => item.code === currentLocale);
  if (!lang || lang.enabled) {
    banner.textContent = "";
    banner.classList.add("is-hidden");
    return;
  }
  banner.textContent = t("lang.pending_banner");
  banner.classList.remove("is-hidden");
}

function toggleLanguagePanelMode(mode) {
  if (!languagePanel) return;
  languagePanelMode = mode || (languagePanelMode === "content" ? "settings" : "content");
  languagePanel.dataset.mode = languagePanelMode;
  updateLanguageSettingsLabels();
}

function updateLanguageSettingsLabels() {
  if (!languagePanel) return;
  const settings = languagePanel.querySelector(".language-settings");
  if (!settings) return;
  const currentEl = settings.querySelector('[data-setting="current"]');
  const detectedEl = settings.querySelector('[data-setting="detected"]');
  if (currentEl) currentEl.textContent = `${t("lang.current")}: ${currentLocale}`;
  if (detectedEl) detectedEl.textContent = `${t("lang.detected")}: ${detectedCountry || "-"}`;
}

function buildLanguageSettings() {
  if (!languagePanel) return;
  const body = languagePanel.querySelector(".language-body");
  if (!body || body.querySelector(".language-settings")) return;

  const banner = document.createElement("div");
  banner.className = "language-banner is-hidden";
  body.insertBefore(banner, body.firstChild);

  const settings = document.createElement("div");
  settings.className = "language-settings";
  settings.innerHTML = `
    <div class="language-settings-row">
      <label>
        <span>${t("lang.autodetect")}</span>
        <input type="checkbox" data-setting="autodetect" />
      </label>
    </div>
    <div class="language-settings-row" data-setting="current"></div>
    <div class="language-settings-row" data-setting="detected"></div>
    <div class="language-settings-row">
      <button type="button" class="cta ghost" data-setting="reset-lang">${t("lang.reset")}</button>
    </div>
  `;
  body.appendChild(settings);

  const autoToggle = settings.querySelector('[data-setting="autodetect"]');
  const resetBtn = settings.querySelector('[data-setting="reset-lang"]');
  if (autoToggle) {
    autoToggle.checked = localStorage.getItem(LANG_AUTODETECT_KEY) !== "off";
    autoToggle.addEventListener("change", () => {
      localStorage.setItem(LANG_AUTODETECT_KEY, autoToggle.checked ? "on" : "off");
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      setLocale(DEFAULT_LOCALE);
      updateLanguagePendingBanner();
    });
  }
  updateLanguageSettingsLabels();
}

function mapCountryToLang(code) {
  const cc = String(code || "").toUpperCase();
  if (cc === "CN" || cc === "HK" || cc === "TW") return "zh";
  if (cc === "JP") return "ja";
  if (cc === "KR") return "ko";
  if (cc === "ES") return "es";
  if (cc === "FR") return "fr";
  if (cc === "DE") return "de";
  if (cc === "PT" || cc === "BR") return "pt";
  if (cc === "RU") return "ru";
  if (cc === "SA" || cc === "AE" || cc === "EG") return "ar";
  return "en";
}

function initLanguageAutoDetect() {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  const autoDetect = localStorage.getItem(LANG_AUTODETECT_KEY) !== "off";
  if (stored || !autoDetect) return;
  fetch("https://ipapi.co/json/")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || localStorage.getItem(LANG_STORAGE_KEY)) return;
      const country = data.country || data.country_code;
      if (country) {
        detectedCountry = country;
        localStorage.setItem(LANG_DETECTED_KEY, country);
      }
      const lang = mapCountryToLang(country);
      if (lang) setLocale(lang);
    })
    .catch(() => {});
}

function initLanguagePanel() {
  renderLanguageButtons(languageList);
  if (languageListMore) languageListMore.classList.add("is-hidden");
  updateLanguageSelection();
  updateLanguageCurrent();
  if (languageMoreButton && languageListMore) {
    languageMoreButton.style.display = "none";
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
  buildLanguageSettings();
  updateLanguagePendingBanner();
  if (languagePanel) languagePanel.dataset.mode = "content";
  initLanguageAutoDetect();
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
let readyWatchToken = 0;
let compactWatchTimer = 0;
let compactPreviewLoopTimer = 0;
let watchSinceSeq = null;
let watchedRunId = "";
let typedLyricsTarget = "";
let typedLyricsCurrent = "";
let typedLyricsTimer = 0;
let artifactsPollTick = 0;
let runLyricsText = "";

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
    const data = unwrapApiData(payload);
    authState.user = data.user || null;
    authState.role = data.role || DEFAULT_ROLE;
    authState.tier = data.tier || authState.role || DEFAULT_ROLE;
    updateLoginUI();
    fetchBillingStatus();
  } catch (err) {
    // ignore
  }
}

async function consumeAuthTicketFromUrl() {
  try {
    const url = new URL(window.location.href);
    const ticket = (url.searchParams.get("auth_ticket") || "").trim();
    if (!ticket) return false;
    const res = await fetch("/api/auth/finalize", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket })
    });
    url.searchParams.delete("auth_ticket");
    const newPath = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", newPath);
    return res.ok;
  } catch (_err) {
    return false;
  }
}

async function bootstrapAuthState() {
  await consumeAuthTicketFromUrl();
  await fetchMe();
}

function updateLoginUI() {
  const userLabel = authState.user
    ? authState.user.name || authState.user.email || authState.user.id
    : "";
  if (loginStatus) {
    loginStatus.textContent = authState.user ? t("login.statusSigned") : t("login.statusGuest");
  }
  if (loginUser) {
    loginUser.textContent = userLabel || "";
  }
  if (loginLogout) {
    loginLogout.style.display = authState.user ? "inline-flex" : "none";
  }
  if (profileAuthStatus) {
    profileAuthStatus.textContent = authState.user
      ? `${t("login.statusSigned")} · ${userLabel}`
      : t("login.statusGuest");
  }
  if (worksAvatar) {
    worksAvatar.textContent = authState.user ? (userLabel || "U").slice(0, 2).toUpperCase() : "CS";
  }
  if (worksName) {
    worksName.textContent = authState.user ? userLabel : "Guest";
  }
  if (worksRole) {
    worksRole.textContent = authState.user
      ? (authState.role || "user").toString().toUpperCase()
      : "GUEST";
  }
}

async function fetchAuthProviders() {
  try {
    const res = await fetch("/api/auth/providers", { credentials: "include" });
    if (!res.ok) return;
    const payload = await res.json();
    const data = unwrapApiData(payload);
    authProviders = Array.isArray(data.providers) ? data.providers : [];
    renderLoginPlatforms();
  } catch (err) {
    // ignore
  }
}

function unwrapApiData(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (Object.prototype.hasOwnProperty.call(payload, "data")) {
    const value = payload.data;
    return value && typeof value === "object" ? value : {};
  }
  return payload;
}

function isProviderEnabled(providerId) {
  return authProviders.some((provider) => provider.id === providerId && provider.enabled);
}

async function refreshAuthProvidersNow() {
  try {
    const res = await fetch("/api/auth/providers", { credentials: "include" });
    if (!res.ok) return false;
    const payload = await res.json();
    const data = unwrapApiData(payload);
    authProviders = Array.isArray(data.providers) ? data.providers : authProviders;
    renderLoginPlatforms();
    return true;
  } catch (_err) {
    return false;
  }
}

async function startAppleLogin() {
  const providersFresh = await refreshAuthProvidersNow();
  if (providersFresh && authProviders.length > 0 && !isProviderEnabled("apple")) {
    showToast("登录暂不可用，请稍后再试");
    setHintKey("登录暂不可用，请稍后再试");
    return;
  }
  window.location.assign("/auth/apple");
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
      const data = await res.json();
      billingState.tier = data.tier || billingState.tier;
      billingState.remaining = data.remaining;
      billingState.limit = data.limit;
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
      const data = await res.json();
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
  profilePanel,
  worksPanel,
  aboutPanel,
  apiPanel
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
  "profile-panel": "profile",
  "works-panel": "works",
  "about-panel": "about",
  "api-panel": "api"
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
    watchVideo.muted = false;
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
    watchVideo.muted = false;
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

function pauseWatchVideo() {
  if (!watchVideo) return;
  watchVideo.pause?.();
}

function resumeWatchVideo() {
  if (!watchVideo || !watchVideo.src) return;
  watchVideo.play?.().catch(() => {});
}

function initVideoPlaybackControls() {
  if (!watchVideo) return;
  const clickTarget = document.querySelector(".watch-screen");
  if (clickTarget && !clickTarget.querySelector(".watch-play-indicator")) {
    const indicator = document.createElement("div");
    indicator.className = "watch-play-indicator";
    indicator.textContent = "▶";
    indicator.style.cssText =
      "position:absolute;left:16px;top:16px;font-size:28px;line-height:1;color:rgba(255,255,255,0.8);text-shadow:0 6px 18px rgba(0,0,0,0.6);pointer-events:none;";
    clickTarget.appendChild(indicator);
  }
  const indicator = clickTarget ? clickTarget.querySelector(".watch-play-indicator") : null;
  const syncIndicator = () => {
    if (!indicator) return;
    if (watchVideo.paused) {
      indicator.textContent = "▶";
      indicator.style.opacity = "0.85";
    } else {
      indicator.textContent = "❚❚";
      indicator.style.opacity = "0.35";
    }
  };
  watchVideo.addEventListener("play", syncIndicator);
  watchVideo.addEventListener("pause", syncIndicator);
  syncIndicator();

  watchVideo.addEventListener("canplay", () => {
    attemptVideoPlayback({ maxRetries: 2 });
    if (watchPanel && !watchPanel.classList.contains("hidden")) {
      ensureWatchCentered();
    }
  });
  watchVideo.addEventListener("error", () => {
    useLocalVideoFallback(state.title, `${state.style} ${state.voice} cinematic mv`);
    attemptVideoPlayback({ maxRetries: 2 });
  });
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

async function playDemoInWatchPanel() {
  const url = await pickFirstWorkingUrl(DEMO_MV_FILES);
  if (url && setVideoFromArtifact(url)) {
    watchSubtitle.textContent = "KaraOK MV · Demo";
    attemptVideoPlayback({ allowFallback: true });
    return true;
  }
  return false;
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
      ensureWatchCentered();
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

function ensureWatchCentered() {
  if (!watchPanel) return;
  openPanel(watchPanel);
  if (!watchPanel.dataset.positioned) {
    watchPanel.style.left = "50%";
    watchPanel.style.top = "50%";
    watchPanel.style.transform = "translate(-50%, -50%)";
    watchPanel.dataset.positioned = "true";
  }
  if (logoPanel) logoPanel.classList.add("dimmed");
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
  const safeTop = Math.max(8, Number(window.visualViewport?.offsetTop || 0) + 8);
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(safeTop, window.innerHeight - rect.height);
  const clampedLeft = Math.min(Math.max(0, left), maxLeft);
  const clampedTop = Math.min(Math.max(safeTop, top), maxTop);
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
  const safeTop = Math.max(8, Number(window.visualViewport?.offsetTop || 0) + 8);
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(safeTop, window.innerHeight - rect.height);
  const clampedLeft = Math.min(Math.max(0, rect.left), maxLeft);
  const clampedTop = Math.min(Math.max(safeTop, rect.top), maxTop);
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
  if (micIgnoreActionClick) {
    micIgnoreActionClick = false;
    return;
  }
  if (hold.active) return;
  micHoldStart("click");
  window.setTimeout(() => {
    if (hold.active) micHoldCommit({ reason: "click" });
  }, 40);
}

function handleMicLongPress() {
  if (hold.active) return;
  micHoldStart("longpress");
}

const micState = {
  jobId: null,
  transcript: "",
  lang: "en"
};

let micRecorder = null;
let micChunks = [];
let micStream = null;
let micRecording = false;
let micDiscardOnStop = false;
let micIgnoreActionClick = false;

const getMicJobId = () => {
  if (!micState.jobId) {
    micState.jobId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `job_${Date.now()}`;
  }
  return micState.jobId;
};

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

const DEMO_BASES = ["/examples/", "/assets/examples/"];
const DEMO_MANIFESTS = ["/examples/manifest.json", "/assets/examples/manifest.json"];
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
  "Nvwa.and.the.Sundering.of.Chaos.wav",
  "The.Mount.Hermon.Oath.wav",
  "The.Cleaving.of.Chaos.混沌之破.wav"
];

let demoMvCache = null;
const getDemoMvFiles = async () => {
  if (demoMvCache && Array.isArray(demoMvCache) && demoMvCache.length) return demoMvCache;
  for (const url of DEMO_MANIFESTS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.files)
        ? data.files
        : [];
      const mp4s = list
        .map((f) => String(f || "").trim())
        .filter((f) => f.toLowerCase().endsWith(".mp4"));
      if (mp4s.length) {
        demoMvCache = mp4s;
        return demoMvCache;
      }
    } catch (_err) {
      // ignore manifest errors
    }
  }
  demoMvCache = DEMO_MV_FILES.slice();
  return demoMvCache;
};

const pickFirstWorkingUrl = async (files) => {
  const shuffled = files.slice().sort(() => Math.random() - 0.5);
  for (const base of DEMO_BASES) {
    for (const file of shuffled) {
      const url = `${base}${file}`;
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
  useLocalVideoFallback(state.title, `${state.style} ${state.voice} cinematic mv`);
  showToast(t("mic.generation_failed_playing_demo"));
};

async function startMicRecording() {
  if (micRecording) return;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micChunks = [];
    micDiscardOnStop = false;
    micRecorder = new MediaRecorder(micStream);
    micRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) micChunks.push(event.data);
    };
    micRecorder.onstop = async () => {
      const blob = new Blob(micChunks, { type: micRecorder.mimeType || "audio/webm" });
      micChunks = [];
      if (!micDiscardOnStop) {
        await submitMicTranscription(blob);
      }
      micDiscardOnStop = false;
    };
    micRecorder.start();
    micRecording = true;
    showToast(t("mic.recording"));
  } catch (err) {
    micRecording = false;
    showToast(t("mic.no_data_notice"));
  }
}

function stopMicRecording(discard = false) {
  if (!micRecorder || !micRecording) return;
  micDiscardOnStop = !!discard;
  micRecording = false;
  micRecorder.stop();
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
}

async function submitMicTranscription(blob) {
  const jobId = getMicJobId();
  try {
    const res = await fetch("/api/mic/transcribe", {
      method: "POST",
      headers: { "content-type": blob.type || "application/octet-stream" },
      body: blob
    });
    const payload = await res.json().catch(() => null);
    if (payload?.ok) {
      micState.transcript = payload.transcript || "";
      micState.lang = payload.lang || "en";
      micState.jobId = payload.job_id || jobId;
      return;
    }
    micState.transcript = "";
    micState.jobId = payload?.job_id || jobId;
    showToast(t("mic.no_data_notice"));
  } catch (err) {
    micState.transcript = "";
    showToast(t("mic.no_data_notice"));
  }
}

async function runLyricsGenerate(mode) {
  const jobId = getMicJobId();
  const payload = {
    job_id: jobId,
    mode,
    transcript: micState.transcript || ""
  };
  const res = await fetch("/api/lyrics/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => null);
  return json;
}

async function runPipeline(jobId, title, lyrics) {
  const res = await fetch("/api/pipeline/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job_id: jobId, title, lyrics })
  });
  const json = await res.json().catch(() => null);
  return json;
}

async function startCreationWithLyrics(title, lyricsText) {
  const allowed = await consumeGeneration();
  if (!allowed) return false;
  const lines = lyricsText.trim().split("\n");
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
  state.baseLines = lines;
  state.lines = lines;
  state.title = title;
  openPanel(foryouPanel);
  layoutShowcasePanels();
  return true;
}

async function runMicFlow() {
  const mode = micState.transcript ? "mic" : "random";
  const lyricPayload = await runLyricsGenerate(mode);
  if (!lyricPayload || !lyricPayload.ok || lyricPayload.no_data) {
    await playDemoMV();
    return;
  }
  const title = lyricPayload.title || state.title;
  const lyricsText = lyricPayload.lyrics || "";
  if (!lyricsText) {
    await playDemoMV();
    return;
  }
  await startCreationWithLyrics(title, lyricsText);
  const pipeline = await runPipeline(lyricPayload.job_id || getMicJobId(), title, lyricsText);
  if (pipeline && pipeline.ok && pipeline.mv_url) {
    const ok = await showEnjoyOverlaySafe(pipeline.mv_url, "");
    if (!ok) await playDemoMV();
  } else {
    await playDemoMV();
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

function getLocalGuessLang() {
  if (detectedCountry) return mapCountryToLang(detectedCountry);
  const raw = navigator.language || "en";
  return raw.toLowerCase().startsWith("zh") ? "zh" : raw.toLowerCase().slice(0, 2) || "en";
}

function cycleLanguageQuick() {
  const guess = getLocalGuessLang();
  const next = currentLocale === "en" ? guess : "en";
  setLocale(next);
}

const PASSKEY_BASE = "";
const HOLD_MAX_MS = Math.max(30000, Number(window.CSS_HOLD_MAX_MS || 30000));

let hold = {
  active: false,
  startedAt: 0,
  raf: 0,
  timeout: 0,
  pointerId: null
};

function setHintKey(key) {
  const el = document.getElementById("profile-hint");
  if (!el) return;
  if (!key) {
    el.textContent = "";
    return;
  }
  try {
    el.textContent = t(key);
  } catch {
    el.textContent = key;
  }
}

function passkeySupported() {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

function normalizePasskeyIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function getPasskeyIdentifier() {
  const loginInputValue = normalizePasskeyIdentifier(loginPasskeyIdentifier?.value);
  const profileInputValue = normalizePasskeyIdentifier(profilePasskeyIdentifier?.value);
  const stored = normalizePasskeyIdentifier(localStorage.getItem(PASSKEY_IDENTIFIER_KEY));
  return loginInputValue || profileInputValue || stored || "";
}

function setPasskeyIdentifier(identifier) {
  const normalized = normalizePasskeyIdentifier(identifier);
  if (loginPasskeyIdentifier && loginPasskeyIdentifier.value !== normalized) {
    loginPasskeyIdentifier.value = normalized;
  }
  if (profilePasskeyIdentifier && profilePasskeyIdentifier.value !== normalized) {
    profilePasskeyIdentifier.value = normalized;
  }
  if (normalized) {
    localStorage.setItem(PASSKEY_IDENTIFIER_KEY, normalized);
  } else {
    localStorage.removeItem(PASSKEY_IDENTIFIER_KEY);
  }
}

function bindPasskeyIdentifierInputs() {
  const sync = (event) => {
    const value = event?.target?.value;
    setPasskeyIdentifier(value);
  };
  loginPasskeyIdentifier?.addEventListener("change", sync);
  loginPasskeyIdentifier?.addEventListener("blur", sync);
  profilePasskeyIdentifier?.addEventListener("change", sync);
  profilePasskeyIdentifier?.addEventListener("blur", sync);
  setPasskeyIdentifier(localStorage.getItem(PASSKEY_IDENTIFIER_KEY) || "");
}

function resolvePasskeyIdentifierForAction() {
  const identifier = getPasskeyIdentifier();
  if (identifier) {
    setPasskeyIdentifier(identifier);
    return identifier;
  }
  if (!authState.user) {
    setHintKey("passkey.identifier_required");
    showToast("Enter your email, then use passkey.");
    return null;
  }
  return "";
}

function b64urlToBuf(s) {
  const n = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = n.length % 4 ? "=".repeat(4 - (n.length % 4)) : "";
  const str = atob(n + pad);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) buf[i] = str.charCodeAt(i);
  return buf.buffer;
}

function bufToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizePublicKeyOptions(pk) {
  const out = JSON.parse(JSON.stringify(pk || {}));
  if (out.challenge) out.challenge = b64urlToBuf(out.challenge);
  if (out.user && out.user.id) out.user.id = b64urlToBuf(out.user.id);
  if (Array.isArray(out.excludeCredentials)) {
    out.excludeCredentials = out.excludeCredentials.map((c) => ({ ...c, id: b64urlToBuf(c.id) }));
  }
  if (Array.isArray(out.allowCredentials)) {
    out.allowCredentials = out.allowCredentials.map((c) => ({ ...c, id: b64urlToBuf(c.id) }));
  }
  return out;
}

function credentialToJSON(cred) {
  const res = {
    id: cred.id,
    rawId: bufToB64url(cred.rawId),
    type: cred.type,
    response: {}
  };
  const r = cred.response;
  if (r) {
    if (r.attestationObject) res.response.attestationObject = bufToB64url(r.attestationObject);
    if (r.clientDataJSON) res.response.clientDataJSON = bufToB64url(r.clientDataJSON);
    if (r.authenticatorData) res.response.authenticatorData = bufToB64url(r.authenticatorData);
    if (r.signature) res.response.signature = bufToB64url(r.signature);
    if (r.userHandle) res.response.userHandle = bufToB64url(r.userHandle);
  }
  return res;
}

async function passkeyEnable() {
  if (!passkeySupported()) {
    setHintKey("passkey.unsupported");
    return;
  }
  const identifier = resolvePasskeyIdentifierForAction();
  if (identifier === null) return;
  setHintKey("");
  const optData = await fetchPasskeyOptions("register", identifier);
  if (!optData) {
    setHintKey("passkey.register_options_failed");
    return;
  }
  const publicKey = normalizePublicKeyOptions(optData.publicKey || optData);
  const cred = await navigator.credentials.create({ publicKey });
  const body = { credential: credentialToJSON(cred) };
  const verRes = await fetch(`${PASSKEY_BASE}/api/auth/passkey/register/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(identifier ? { ...body, identifier } : body)
  });
  if (!verRes.ok) {
    setHintKey("passkey.register_verify_failed");
    return;
  }
  await fetchMe();
  setHintKey("passkey.enabled");
}

async function fetchPasskeyOptions(kind, identifier) {
  const endpoint = `${PASSKEY_BASE}/api/auth/passkey/${kind}/options`;
  const query = identifier ? `?identifier=${encodeURIComponent(identifier)}` : "";

  try {
    const getRes = await fetch(`${endpoint}${query}`, {
      method: "GET",
      credentials: "include",
      headers: { accept: "application/json" }
    });
    if (getRes.ok) {
      const getJson = await getRes.json();
      return unwrapApiData(getJson);
    }
  } catch (_err) {
    // fallback to POST below
  }

  const body = identifier ? { identifier } : {};
  const postRes = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  if (!postRes.ok) return null;
  const postJson = await postRes.json();
  return unwrapApiData(postJson);
}

async function passkeyLogin() {
  if (!passkeySupported()) {
    setHintKey("passkey.unsupported");
    return;
  }
  const identifier = resolvePasskeyIdentifierForAction();
  if (identifier === null) return;
  setHintKey("");
  const optData = await fetchPasskeyOptions("login", identifier);
  if (!optData) {
    setHintKey("passkey.login_options_failed");
    return;
  }
  if (optData.empty) {
    setHintKey("passkey.not_enabled");
    return;
  }
  const publicKey = normalizePublicKeyOptions(optData.publicKey || optData);
  const cred = await navigator.credentials.get({ publicKey });
  const body = { credential: credentialToJSON(cred) };
  const verRes = await fetch(`${PASSKEY_BASE}/api/auth/passkey/login/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(identifier ? { ...body, identifier } : body)
  });
  if (!verRes.ok) {
    setHintKey("passkey.login_verify_failed");
    return;
  }
  await fetchMe();
  setHintKey("passkey.enabled");
}

async function passkeyAuth() {
  const identifier = resolvePasskeyIdentifierForAction();
  if (identifier === null) return;

  if (!passkeySupported()) {
    setHintKey("passkey.unsupported");
    return;
  }

  await passkeyLogin();
  if (authState.user) return;

  const hintText = document.getElementById("profile-hint")?.textContent || "";
  const expected = t("passkey.not_enabled");
  const optionsFailed = t("passkey.login_options_failed");
  if (hintText === expected || hintText === optionsFailed) {
    await passkeyEnable();
    await passkeyLogin();
  }
}

async function smartSignIn() {
  const providersFresh = await refreshAuthProvidersNow();
  if (!providersFresh || authProviders.length === 0 || isProviderEnabled("apple")) {
    await startAppleLogin();
    return;
  }
  try {
    await passkeyAuth();
  } catch (_err) {
    // Ignore passkey cancellation/runtime errors and continue with Apple fallback.
  }
  if (authState.user) return;
  await startAppleLogin();
}

function removeLegacyMicFab() {
  const selectors = ["#trigger-mic", ".logo-actions", ".mic-fab", ".logo-mic-fab"];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => el.remove());
  });
}

function triggerMic() {
  window.dispatchEvent(new CustomEvent("cssos:mic"));
}

function ringEl() {
  return document.getElementById("hold-ring");
}

function ringFg() {
  const r = ringEl();
  if (!r) return null;
  return r.querySelector(".hold-ring-fg");
}

function setRingProgress01(p) {
  const fg = ringFg();
  if (!fg) return;
  const C = 289;
  const clamped = Math.max(0, Math.min(1, p));
  fg.style.strokeDashoffset = String(C * (1 - clamped));
}

const logoPanelHoldInlineBackup = {
  border: null,
  borderPriority: "",
  transform: null,
  transformPriority: ""
};

function applyLogoPanelHoldInline(on) {
  if (!logoPanel || !logoPanel.style) return;
  if (on) {
    logoPanelHoldInlineBackup.border = logoPanel.style.getPropertyValue("border");
    logoPanelHoldInlineBackup.borderPriority = logoPanel.style.getPropertyPriority("border");
    logoPanelHoldInlineBackup.transform = logoPanel.style.getPropertyValue("transform");
    logoPanelHoldInlineBackup.transformPriority = logoPanel.style.getPropertyPriority("transform");
    logoPanel.style.setProperty("border", "0", "important");
    logoPanel.style.setProperty("transform", "none", "important");
    return;
  }
  const prevBorder = logoPanelHoldInlineBackup.border;
  if (prevBorder && prevBorder.length > 0) {
    logoPanel.style.setProperty("border", prevBorder, logoPanelHoldInlineBackup.borderPriority || "");
  } else {
    logoPanel.style.removeProperty("border");
  }
  const prevTransform = logoPanelHoldInlineBackup.transform;
  if (prevTransform && prevTransform.length > 0) {
    logoPanel.style.setProperty(
      "transform",
      prevTransform,
      logoPanelHoldInlineBackup.transformPriority || ""
    );
  } else {
    logoPanel.style.removeProperty("transform");
  }
}

function showRing(on) {
  const r = ringEl();
  if (!r) return;
  if (on) {
    r.classList.add("is-on");
    logoPanel?.classList.add("holding-mic");
  } else {
    r.classList.remove("is-on");
    logoPanel?.classList.remove("holding-mic");
  }
}

function micHoldStart(origin) {
  if (hold.active) return;
  hold.active = true;
  hold.startedAt = performance.now();
  setRingProgress01(0);
  showRing(true);
  showToast(t("mic.listening"));
  void startRecording().catch((err) => {
    const errName = String(err?.name || err || "");
    const denied = errName.includes("NotAllowedError") || errName.includes("SecurityError");
    showToast(denied ? t("mic.permission_denied") : t("mic.no_data_notice"));
    hold.active = false;
    if (hold.raf) cancelAnimationFrame(hold.raf);
    if (hold.timeout) clearTimeout(hold.timeout);
    hold.raf = 0;
    hold.timeout = 0;
    hold.pointerId = null;
    showRing(false);
    setRingProgress01(0);
  });
  window.dispatchEvent(new CustomEvent("cssos:mic_hold_start", { detail: { origin, startedLocally: true } }));

  const tick = () => {
    if (!hold.active) return;
    const now = performance.now();
    const p = (now - hold.startedAt) / HOLD_MAX_MS;
    setRingProgress01(p);
    hold.raf = requestAnimationFrame(tick);
  };
  hold.raf = requestAnimationFrame(tick);

  hold.timeout = window.setTimeout(() => {
    if (!hold.active) return;
    micHoldCommit({ reason: "timeout" });
  }, HOLD_MAX_MS);
}

function micHoldCommit(meta) {
  if (!hold.active) return;
  const elapsed = performance.now() - hold.startedAt;
  hold.active = false;
  if (hold.raf) cancelAnimationFrame(hold.raf);
  if (hold.timeout) clearTimeout(hold.timeout);
  hold.raf = 0;
  hold.timeout = 0;
  hold.pointerId = null;
  showRing(false);
  setRingProgress01(0);
  window.dispatchEvent(
    new CustomEvent("cssos:mic_hold_commit", {
      detail: { elapsed_ms: Math.round(elapsed), ...meta }
    })
  );
}

function bindHoldTargets() {
  const targets = Array.from(document.querySelectorAll("[data-hold='mic']:not(#dock-mic)"));
  for (const el of targets) {
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      micIgnoreActionClick = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      hold.pointerId = e.pointerId;
      micHoldStart(el.id || el.getAttribute("data-action") || "mic");
    });

    const commit = (e, reason) => {
      if (!hold.active) return;
      if (hold.pointerId !== null && e.pointerId !== hold.pointerId) return;
      micHoldCommit({ reason });
    };

    el.addEventListener("pointerup", (e) => commit(e, "release"));
    el.addEventListener("pointercancel", (e) => commit(e, "release"));
    el.addEventListener("lostpointercapture", (e) => commit(e, "release"));
    el.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") commit(e, "release");
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}

let rec = {
  stream: null,
  mr: null,
  chunks: [],
  started: false
};

async function startRecording() {
  if (rec.started) return;
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    throw new Error("MediaDevicesUnavailable");
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorderUnavailable");
  }
  rec.chunks = [];
  rec.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let mr = null;
  try {
    if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported("audio/webm")) {
      mr = new MediaRecorder(rec.stream, { mimeType: "audio/webm" });
    } else {
      mr = new MediaRecorder(rec.stream);
    }
  } catch (_err) {
    mr = new MediaRecorder(rec.stream);
  }
  rec.mr = mr;
  rec.started = true;

  mr.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) rec.chunks.push(ev.data);
  };

  mr.start(250);
}

async function stopRecordingGetBlob() {
  if (!rec.started || !rec.mr) return null;

  const mr = rec.mr;
  const stream = rec.stream;

  const blob = await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        mr.ondataavailable = null;
      } catch {}
      resolve(new Blob(rec.chunks, { type: mr.mimeType || "audio/webm" }));
    };
    mr.onstop = finish;
    try {
      mr.stop();
    } catch {
      finish();
    }
    setTimeout(finish, 1200);
  });

  rec.started = false;
  rec.mr = null;
  rec.stream = null;
  rec.chunks = [];

  if (stream) {
    for (const tr of stream.getTracks()) {
      try {
        tr.stop();
      } catch {}
    }
  }

  if (!blob || blob.size === 0) return null;
  return blob;
}

function randomTitle() {
  const xs = ["Untitled", "New Song", "Opera Night", "Midnight", "Starlight", "Echo"];
  return xs[Math.floor(Math.random() * xs.length)];
}

function apiBase() {
  const v =
    window.CSS_API_BASE ||
    window.CSS_BASE_URL ||
    (location.origin.includes("localhost") ? "http://127.0.0.1:8081" : location.origin);
  return String(v).replace(/\/+$/, "");
}

function b64FromArrayBuffer(ab) {
  const bytes = new Uint8Array(ab);
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

async function createRun({ title, uiLang, tier, voice }) {
  const baseUrl = apiBase();
  const safeLang = (uiLang || "zh").toString();
  const nowIso = new Date().toISOString();
  const voiceMeta = {
    captured: Boolean(voice && voice.bytes > 0),
    duration_ms: Math.max(0, Number(voice?.duration_ms || 0)),
    bytes: Math.max(0, Number(voice?.bytes || 0)),
    mime: (voice?.mime || "audio/webm").toString(),
    trigger: (voice?.trigger || "release").toString(),
    ts: nowIso
  };
  const body = {
    cssl: title,
    ui_lang: safeLang,
    tier: tier || "dev",
    commands: {
      input: {
        voice: voiceMeta
      },
      title_hint: title,
      detected_lang: safeLang,
      primary_lang: safeLang,
      voice: voice || { bytes: 0, mime: "audio/webm", mode: "single" }
    }
  };
  const res = await fetch(`${baseUrl}/cssapi/v1/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`http=${res.status} ${text}`);
  }
  return await res.json();
}

async function deriveTitleFromVoice(blob) {
  const buf = await blob.arrayBuffer();
  if (buf.byteLength < 1600) return "";
  return "";
}

async function submitVoiceOrFallbackTitle(blobOrNull, submitMeta = {}) {
  let title = "";
  let voice = {
    bytes: 0,
    mime: "audio/webm",
    mode: "single",
    duration_ms: Math.max(0, Number(submitMeta.elapsed_ms || 0)),
    trigger: submitMeta.reason || "release"
  };

  if (blobOrNull && blobOrNull.size > 0) {
    const t = await deriveTitleFromVoice(blobOrNull).catch(() => "");
    if (t && t.trim()) {
      title = t.trim();
    }
    const ab = await blobOrNull.arrayBuffer().catch(() => null);
    if (ab && ab.byteLength > 0) {
      voice = {
        bytes: blobOrNull.size,
        mime: blobOrNull.type || "audio/webm",
        b64: b64FromArrayBuffer(ab),
        mode: "single",
        duration_ms: Math.max(0, Number(submitMeta.elapsed_ms || 0)),
        trigger: submitMeta.reason || "release"
      };
    }
  }

  const finalTitle = title || randomTitle();

  const uiLang = (window.CSS_UI_LANG || document.documentElement.lang || "zh").toString();
  const tier = (window.CSS_TIER || "dev").toString();
  const r = await createRun({ title: finalTitle, uiLang, tier, voice });
  window.dispatchEvent(new CustomEvent("cssos:run_created", { detail: r }));
  window.dispatchEvent(new CustomEvent("cssos:title_ready", { detail: { title: finalTitle, source: voice.bytes > 0 ? "voice" : "random" } }));
  window.dispatchEvent(new CustomEvent("cssos:lyrics_start", { detail: { run_id: r.run_id, title: finalTitle, mode: "single" } }));
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setRunLine(runIdValue) {
  if (runid) runid.textContent = runIdValue || "";
  if (runline) runline.hidden = !runIdValue;
}

function resetTypedLyrics() {
  typedLyricsTarget = "";
  typedLyricsCurrent = "";
  runLyricsText = "";
  if (typedLyricsTimer) clearTimeout(typedLyricsTimer);
  typedLyricsTimer = 0;
  if (lyricsEl) lyricsEl.textContent = "";
}

function queueTypedLyrics(nextText) {
  const text = String(nextText || "");
  if (!lyricsEl) return;
  if (text === typedLyricsTarget && typedLyricsTimer) return;
  typedLyricsTarget = text;
  if (typedLyricsCurrent.length > typedLyricsTarget.length) {
    typedLyricsCurrent = "";
    lyricsEl.textContent = "";
  }
  if (typedLyricsTimer) return;
  const step = () => {
    if (typedLyricsCurrent === typedLyricsTarget) {
      typedLyricsTimer = 0;
      return;
    }
    const advance = Math.max(1, Math.ceil((typedLyricsTarget.length - typedLyricsCurrent.length) / 32));
    typedLyricsCurrent = typedLyricsTarget.slice(0, typedLyricsCurrent.length + advance);
    lyricsEl.textContent = typedLyricsCurrent;
    typedLyricsTimer = setTimeout(step, 22);
  };
  step();
}

function statusLabelByKey(statusRaw) {
  const status = String(statusRaw || "").toUpperCase();
  const map = {
    PENDING: "status.pending",
    RUNNING: "status.running",
    SUCCEEDED: "status.succeeded",
    FAILED: "status.failed",
    SKIPPED: "status.skipped",
    CANCELLED: "status.cancelled",
    TIMEOUT: "status.timeout"
  };
  const key = map[status];
  return key ? t(key) : status;
}

function statusPercent(statusRaw) {
  const status = String(statusRaw || "").toUpperCase();
  if (status === "SUCCEEDED") return 100;
  if (status === "FAILED" || status === "SKIPPED" || status === "CANCELLED" || status === "TIMEOUT") return 100;
  if (status === "RUNNING") return 58;
  return 0;
}

function groupProgress(readyView, stageNames) {
  const names = Array.isArray(stageNames) ? stageNames : [];
  let total = 0;
  let counted = 0;
  for (const stage of names) {
    const status = readyView?.[stage]?.status;
    if (!status) continue;
    total += statusPercent(status);
    counted += 1;
  }
  if (!counted) return 0;
  return Math.max(0, Math.min(100, total / counted));
}

function computeVideoProgress(readyView) {
  const stagePart = groupProgress(readyView, ["video_plan", "video_assemble", "render"]);
  const shots = readyView?.video_shots || {};
  const shotsTotal = Number(shots.total || 0);
  const shotsDone = Number(shots.succeeded || 0) + Number(shots.failed || 0);
  const shotPart = shotsTotal > 0 ? Math.max(0, Math.min(100, (shotsDone / shotsTotal) * 100)) : 0;
  if (!shotsTotal) return stagePart;
  return Math.max(0, Math.min(100, stagePart * 0.55 + shotPart * 0.45));
}

function updateReadyBars(readyView) {
  const lyricsPct = groupProgress(readyView, ["lyrics"]);
  const musicPct = groupProgress(readyView, ["music", "vocals", "mix"]);
  const videoPct = computeVideoProgress(readyView);
  const karaPct = groupProgress(readyView, ["subtitles", "render"]);
  if (lyricsProgress) setProgress(lyricsProgress, lyricsPct);
  if (musicProgress) setProgress(musicProgress, musicPct);
  if (videoProgress) setProgress(videoProgress, videoPct);
  if (karaProgress) setProgress(karaProgress, karaPct);
}

function buildProcessLyrics(runIdValue, readyView, titleHint) {
  if (runLyricsText) return runLyricsText;
  const summary = readyView?.summary || {};
  const ev = readyView?.last_event || {};
  const stage = ev.stage || "lyrics";
  const stageStatus = statusLabelByKey(ev.status || readyView?.status || "RUNNING");
  const pending = Number(summary.pending || 0);
  const running = Number(summary.running || 0);
  const succeeded = Number(summary.succeeded || 0);
  const failed = Number(summary.failed || 0);
  const baseTitle = titleHint || state.title || "Untitled";
  return [
    `${baseTitle}`,
    "",
    `${t("ui.progress.event", { ev: `${stage} · ${stageStatus}` })}`,
    `${t("ui.progress.running", { n: running, ok: succeeded, fail: failed })}`,
    `${t("ui.progress.pending", { n: pending })}`,
    "",
    `${t("ui.run_id")} ${runIdValue}`
  ].join("\n");
}

function normalizeArtifacts(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items_ordered) && payload.items_ordered.length) return payload.items_ordered;
  if (payload.items && typeof payload.items === "object" && !Array.isArray(payload.items)) {
    return Object.entries(payload.items).map(([key, record]) => ({ key, record }));
  }
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.artifacts)) return payload.artifacts;
  return [];
}

function artifactDownloadUrl(runIdValue, key) {
  if (!runIdValue || !key) return "";
  return `/cssapi/v1/runs/${encodeURIComponent(runIdValue)}/artifacts/${encodeURIComponent(key)}`;
}

function findArtifactUri(payload, keys) {
  const list = normalizeArtifacts(payload);
  const wanted = (keys || []).map((k) => String(k).toLowerCase());
  for (const item of list) {
    const keyRaw = String(
      item?.stable_key || item?.key || item?.record?.key || item?.name || item?.path || ""
    );
    const key = keyRaw.toLowerCase();
    if (!key) continue;
    if (wanted.some((want) => key === want || key.endsWith(want))) {
      const uri = item?.uri || item?.url || item?.href || "";
      if (uri) return String(uri);
      if (payload?.run_id && keyRaw) return artifactDownloadUrl(payload.run_id, keyRaw);
    }
  }
  return "";
}

function setupArtifactButtons(runIdValue) {
  if (!runIdValue) return;
  if (watchButton) {
    watchButton.onclick = () => {
      const url = artifactDownloadUrl(runIdValue, "final.mv");
      if (!url) return;
      window.open(url, "_blank", "noopener");
    };
  }
  if (listenButton) {
    listenButton.onclick = () => {
      const url = artifactDownloadUrl(runIdValue, "mix.wav");
      if (!url) return;
      window.open(url, "_blank", "noopener");
    };
  }
}

function stopCompactPreviewLoop() {
  if (compactPreviewLoopTimer) {
    clearInterval(compactPreviewLoopTimer);
    compactPreviewLoopTimer = 0;
  }
}

function setCompactPreviewVideo(uri) {
  if (!foryouPreviewVideo) return;
  if (!uri) {
    stopCompactPreviewLoop();
    foryouPreviewVideo.pause?.();
    foryouPreviewVideo.removeAttribute("src");
    foryouPreviewVideo.classList.remove("show");
    return;
  }
  const currentSrc = foryouPreviewVideo.getAttribute("src") || "";
  if (currentSrc !== uri) {
    foryouPreviewVideo.src = uri;
    foryouPreviewVideo.currentTime = 0;
    foryouPreviewVideo.load?.();
  }
  foryouPreviewVideo.classList.add("show");
  foryouPreviewVideo.play?.().catch(() => {});
  stopCompactPreviewLoop();
  compactPreviewLoopTimer = window.setInterval(() => {
    if (!foryouPreviewVideo || !foryouPreviewVideo.classList.contains("show")) return;
    if (foryouPreviewVideo.currentTime >= 5) {
      foryouPreviewVideo.currentTime = 0;
      foryouPreviewVideo.play?.().catch(() => {});
    }
  }, 280);
}

async function fetchReadyView(runIdValue, sinceSeqValue) {
  const baseUrl = apiBase();
  const q = sinceSeqValue === null ? "" : `?since_seq=${encodeURIComponent(sinceSeqValue)}`;
  const res = await fetch(`${baseUrl}/cssapi/v1/runs/${encodeURIComponent(runIdValue)}/ready${q}`, {
    method: "GET",
    headers: { accept: "application/json" }
  });
  return res;
}

async function hydrateRunArtifacts(runIdValue) {
  const baseUrl = apiBase();
  const res = await fetch(`${baseUrl}/cssapi/v1/runs/${encodeURIComponent(runIdValue)}/artifacts`, {
    method: "GET",
    headers: { accept: "application/json" }
  }).catch(() => null);
  if (!res || !res.ok) return;
  const payload = await res.json().catch(() => null);
  if (!payload) return;

  const videoUri =
    findArtifactUri(payload, ["final.mv", "video.mp4", "video_preview.mp4", "mv.mp4"]) ||
    "";
  if (videoUri) {
    setCompactPreviewVideo(videoUri);
    if (watchVideo && !watchVideo.getAttribute("src")) {
      setVideoFromArtifact(videoUri);
      attemptVideoPlayback({ allowFallback: true });
    }
  }

  const lyricsUri = findArtifactUri(payload, ["lyrics.json"]);
  if (lyricsUri && !runLyricsText) {
    const lyrRes = await fetch(lyricsUri, { method: "GET", headers: { accept: "application/json" } }).catch(() => null);
    const lyrJson = lyrRes && lyrRes.ok ? await lyrRes.json().catch(() => null) : null;
    if (lyrJson && Array.isArray(lyrJson.lines) && lyrJson.lines.length) {
      runLyricsText = lyrJson.lines.join("\n");
      queueTypedLyrics(runLyricsText);
    }
  }
}

function isRunFinished(readyView) {
  const summary = readyView?.summary || {};
  const pending = Number(summary.pending || 0);
  const running = Number(summary.running || 0);
  if (pending === 0 && running === 0) return true;
  const status = String(readyView?.status || "").toUpperCase();
  return ["SUCCEEDED", "FAILED", "CANCELLED", "TIMEOUT"].includes(status);
}

function maybeCompactForLyrics(readyView) {
  const lyricsStatus = String(readyView?.lyrics?.status || "").toUpperCase();
  if (lyricsStatus !== "SUCCEEDED") return false;
  setForyouCompact(true);
  scheduleWatchAfterDelay();
  return true;
}

function stopReadyWatchLoop() {
  readyWatchToken += 1;
  if (compactWatchTimer) clearTimeout(compactWatchTimer);
  compactWatchTimer = 0;
  watchSinceSeq = null;
  watchedRunId = "";
  artifactsPollTick = 0;
}

function scheduleWatchAfterDelay() {
  if (compactWatchTimer) return;
  compactWatchTimer = window.setTimeout(() => {
    compactWatchTimer = 0;
    ensureWatchCentered();
  }, 10000);
}

async function startReadyWatchLoop(runIdValue, titleHint) {
  stopReadyWatchLoop();
  const token = readyWatchToken;
  watchedRunId = runIdValue;
  watchSinceSeq = null;
  artifactsPollTick = 0;

  for (;;) {
    if (token !== readyWatchToken) return;
    let res = null;
    try {
      res = await fetchReadyView(runIdValue, watchSinceSeq);
    } catch (_err) {
      await delay(450);
      continue;
    }

    if (token !== readyWatchToken) return;
    if (!res || res.status === 204 || res.status === 404) {
      await delay(450);
      continue;
    }
    if (!res.ok) {
      await delay(600);
      continue;
    }

    const view = await res.json().catch(() => null);
    if (!view) {
      await delay(450);
      continue;
    }

    if (typeof view.stage_seq === "number") watchSinceSeq = view.stage_seq;
    updateReadyBars(view);
    queueTypedLyrics(buildProcessLyrics(runIdValue, view, titleHint));
    const lyricsReady = maybeCompactForLyrics(view);

    artifactsPollTick += 1;
    if (artifactsPollTick % 4 === 0 || lyricsReady || isRunFinished(view)) {
      await hydrateRunArtifacts(runIdValue);
    }

    if (isRunFinished(view)) {
      setForyouCompact(true);
      return;
    }
    await delay(500);
  }
}

const dockActionMap = {
  mic: {
    click: handleMicClick,
    dblclick: () => {
      showToast(t("mic.settings_open"));
      openPanel(settingsPanel);
    },
    longpress: handleMicLongPress
  },
  foryou: {
    click: () => openPanel(foryouPanel),
    dblclick: () => startCreation(),
    longpress: () => openPanel(lyricsPanel)
  },
  cssmv: {
    click: () => openPanel(cssmvPanel),
    dblclick: () => ensureWatchCentered(),
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
    longpress: () => ensureWatchCentered()
  },
  watch: {
    click: () => ensureWatchCentered(),
    dblclick: () => ensureWatchCentered(),
    longpress: () => openPanel(cssmvPanel)
  },
  about: {
    click: () => openPanel(aboutPanel),
    dblclick: () => openAndMaximize(aboutPanel),
    longpress: () => openPanel(settingsPanel)
  },
  api: {
    click: () => openPanel(apiPanel),
    dblclick: () => openAndMaximize(apiPanel),
    longpress: () => openPanel(settingsPanel)
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
  },
  profile: {
    click: () => openPanel(profilePanel),
    dblclick: () => openAndMaximize(profilePanel),
    longpress: () => openPanel(loginPanel)
  },
  language: {
    click: () => {
      openPanel(languagePanel);
      toggleLanguagePanelMode("content");
    },
    dblclick: () => {
      openPanel(languagePanel);
      toggleLanguagePanelMode();
    },
    longpress: cycleLanguageQuick
  }
};

function handleDockAction(action, type) {
  const mapping = dockActionMap[action];
  if (!mapping) return;
  const handler = mapping[type];
  if (handler) handler();
}

function handleGlobalAction(action) {
  if (!action) return;
  if (action === "profile.open") {
    openPanel(profilePanel);
    if (window.location.pathname !== "/profile") {
      window.history.replaceState({}, "", "/profile");
    }
    return;
  }
  if (action === "profile.close") {
    minimizeToDock(profilePanel);
    if (window.location.pathname === "/profile") {
      window.history.replaceState({}, "", "/");
    }
    return;
  }
  if (action === "apple.login") {
    void startAppleLogin();
    return;
  }
  if (action === "passkey.enable") {
    openPanel(profilePanel);
    void passkeyEnable();
    return;
  }
  if (action === "passkey.login") {
    openPanel(profilePanel);
    void passkeyLogin();
    return;
  }
  if (action === "passkey.auth") {
    openPanel(profilePanel);
    void passkeyAuth();
    return;
  }
  if (action === "auth.smart") {
    openPanel(profilePanel);
    void smartSignIn();
    return;
  }
  if (action === "mic") {
    triggerMic();
  }
}

function attachDockEvents() {
  document.querySelectorAll(".dock-item").forEach((item) => {
    const action = item.dataset.action;
    item.tabIndex = 0;
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

    item.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      suppressClick = false;
      clearTimeout(longPressId);
      longPressId = setTimeout(() => {
        suppressClick = true;
        triggerAction("longpress");
      }, LONGPRESS_MS);
    });

    item.addEventListener("pointerup", () => {
      clearTimeout(longPressId);
      if (action === "mic" && hold.active) {
        micHoldCommit({ reason: "release" });
      }
    });

    item.addEventListener("pointerleave", () => {
      clearTimeout(longPressId);
      if (action === "mic" && hold.active) {
        micHoldCommit({ reason: "release" });
      }
    });
  });
}

function attachGlobalActionDispatcher() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".dock-item")) return;
    const actionEl = target.closest("[data-action]");
    if (!actionEl) return;
    if (actionEl.getAttribute("data-hold") === "mic") return;
    const action = actionEl.getAttribute("data-action");
    handleGlobalAction(action);
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
  if (panel === watchPanel) {
    setWatchCenterStage(false);
    pauseWatchVideo();
    if (watchVideo) {
      watchVideo.removeAttribute("src");
      watchVideo.load?.();
    }
  }
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
    if (panel === watchPanel) resumeWatchVideo();
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
  if (panel === watchPanel) pauseWatchVideo();
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
        if (action === "maximize") togglePanelMaximize(panel);
        if (action === "lock") togglePanelLock(panel);
        if (action === "close") minimizeToDock(panel);
        if (action === "profile.open") openPanel(profilePanel);
        if (action === "profile.close") minimizeToDock(profilePanel);
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

if (applySettings) {
  applySettings.addEventListener("click", () => {
    const customLyrics = lyricsInput.value.trim();
    const customTitle = titleInput.value.trim();
    startCreation(customTitle, customLyrics);
    openPanel(foryouPanel);
  });
}

if (randomPaletteButton) {
  randomPaletteButton.addEventListener("click", randomizePalette);
}

if (enterWatchButton) {
  enterWatchButton.addEventListener("click", async () => {
    ensureWatchCentered();
    if (!videoJobId) {
      const ok = await playLatestVideoFromRegistry();
      if (!ok) {
        const demoOk = await playDemoInWatchPanel();
        if (!demoOk) {
          showToast("No video ready yet");
        }
      }
    }
  });
}

if (listenButton) {
  listenButton.addEventListener("click", () => {
    if (watchedRunId) {
      const url = artifactDownloadUrl(watchedRunId, "mix.wav");
      if (url) {
        window.open(url, "_blank", "noopener");
        return;
      }
    }
    openPanel(musicPanel);
  });
}

if (watchButton) {
  watchButton.addEventListener("click", async () => {
    if (watchedRunId) {
      const url = artifactDownloadUrl(watchedRunId, "final.mv");
      if (url) {
        window.open(url, "_blank", "noopener");
        return;
      }
    }
    ensureWatchCentered();
    if (!videoJobId) {
      const ok = await playLatestVideoFromRegistry();
      if (!ok) {
        await playDemoInWatchPanel();
      }
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

const safeInit = (name, fn) => {
  try {
    fn();
  } catch (err) {
    console.error(`[init] ${name} failed`, err);
  }
};

safeInit("resetInactivityTimer", () => resetInactivityTimer());
safeInit("initPanelStack", () => initPanelStack());
safeInit("updateDockVisibility", () => updateDockVisibility());
safeInit("applySpell", () => applySpell(state.spell, { force: true, refreshPanels: false }));
safeInit("updateEnginePanels", () => updateEnginePanels(state.title, state.lines));
safeInit("applyBackgroundPalette", () => applyBackgroundPalette());
safeInit("attachDockEvents", () => attachDockEvents());
safeInit("attachGlobalActionDispatcher", () => attachGlobalActionDispatcher());
safeInit("bindHoldTargets", () => bindHoldTargets());
safeInit("attachPanelDrag", () => attachPanelDrag());
safeInit("attachPanelBarActions", () => attachPanelBarActions());
safeInit("attachResize", () => attachResize());
safeInit("attachPanelFocus", () => attachPanelFocus());
safeInit("attachPanelActions", () => attachPanelActions());
safeInit("attachLogoPanelActions", () => attachLogoPanelActions());
safeInit("initPanelSettings", () => initPanelSettings());
safeInit("initEngineControls", () => initEngineControls());
safeInit("initLyricsControls", () => initLyricsControls());
safeInit("initLanguagePanel", () => initLanguagePanel());
safeInit("initAboutTabs", () => initAboutTabs());
safeInit("initApiBillingUI", () => initApiBillingUI());
safeInit("removeLegacyMicFab", () => removeLegacyMicFab());
safeInit("bindPasskeyIdentifierInputs", () => bindPasskeyIdentifierInputs());
safeInit("bootstrapAuthState", () => {
  void bootstrapAuthState();
});
safeInit("fetchAuthProviders", () => fetchAuthProviders());
safeInit("fetchBillingStatus", () => fetchBillingStatus());
safeInit("initVersionSwitcher", () => initVersionSwitcher());
if (window.location.pathname === "/profile") {
  openPanel(profilePanel);
}
if (window.location.pathname === "/settings") {
  openPanel(settingsPanel);
}
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
window.addEventListener("cssos:mic", () => {
  handleMicClick();
});
window.addEventListener("cssos:mic_hold_start", async (event) => {
  const detail = (event && event.detail) || {};
  if (detail.startedLocally) return;
  try {
    await startRecording();
  } catch {
    showToast(t("mic.permission_denied"));
  }
});
window.addEventListener("cssos:mic_hold_commit", async (event) => {
  const detail = (event && event.detail) || {};
  try {
    showToast(t("mic.submitting"));
    const blob = await stopRecordingGetBlob().catch(() => null);
    await submitVoiceOrFallbackTitle(blob, detail);
    showToast(t("mic.submitted"));
  } catch (e) {
    const errText = String(e || "");
    const key = errText.includes("http=") ? "mic.http_error" : "mic.network_error";
    const msg = `${window.t ? window.t(key) : "Submit failed"}${errText ? `: ${errText}` : ""}`;
    window.dispatchEvent(new CustomEvent("cssos:toast", { detail: { kind: "error", message: msg } }));
  }
});
window.addEventListener("cssos:title_ready", (event) => {
  const detail = (event && event.detail) || {};
  const title = (detail.title || "").toString().trim();
  if (!title) return;
  if (foryouTitle) foryouTitle.textContent = title;
  state.title = title;
});
window.addEventListener("cssos:run_created", (event) => {
  const detail = (event && event.detail) || {};
  const runIdValue = detail.run_id || detail.id || "";
  if (!runIdValue) return;
  const title = state.title || randomTitle();
  openPanel(foryouPanel);
  setForyouCompact(false);
  setRunLine(runIdValue);
  setupArtifactButtons(runIdValue);
  resetTypedLyrics();
  if (watchVideo) {
    watchVideo.pause?.();
    watchVideo.removeAttribute("src");
    watchVideo.load?.();
  }
  setCompactPreviewVideo("");
  const bootText = `${title}\n\n${t("status.running")}...`;
  queueTypedLyrics(bootText);
  startReadyWatchLoop(runIdValue, title);
});

window.addEventListener("resize", () => {
  panels.forEach((panel) => clampPanelInViewport(panel));
  layoutShowcasePanels();
});
