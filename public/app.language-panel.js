function renderLanguageButtonsModule(container) {
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

function updateLanguageSelectionModule() {
  document.querySelectorAll(".lang-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.lang === currentLocale);
  });
}

function updateLanguageStatusModule(textKey) {
  if (!languageStatus) return;
  languageStatus.textContent = t(textKey);
}

function updateLanguageCurrentModule() {
  if (!languageCurrent) return;
  const current = LANGS.find((lang) => lang.code === currentLocale);
  if (current) {
    languageCurrent.textContent = `${current.flag} ${t(current.nameKey)} · ${current.code}`;
  }
}

function updateLanguagePendingBannerModule() {
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

function toggleLanguagePanelModeModule(mode) {
  if (!languagePanel) return;
  languagePanelMode = mode || (languagePanelMode === "content" ? "settings" : "content");
  languagePanel.dataset.mode = languagePanelMode;
  updateLanguageSettingsLabelsModule();
}

function updateLanguageSettingsLabelsModule() {
  if (!languagePanel) return;
  const settings = languagePanel.querySelector(".language-settings");
  if (!settings) return;
  const currentEl = settings.querySelector('[data-setting="current"]');
  const detectedEl = settings.querySelector('[data-setting="detected"]');
  if (currentEl) currentEl.textContent = `${t("lang.current")}: ${currentLocale}`;
  if (detectedEl) detectedEl.textContent = `${t("lang.detected")}: ${detectedCountry || "-"}`;
}

function buildLanguageSettingsModule() {
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
      updateLanguagePendingBannerModule();
    });
  }
  updateLanguageSettingsLabelsModule();
}

function mapCountryToLangModule(code) {
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

globalThis.mapCountryToLangModule = mapCountryToLangModule;
globalThis.updateLanguageSelectionModule = updateLanguageSelectionModule;
globalThis.updateLanguageStatusModule = updateLanguageStatusModule;
globalThis.updateLanguageCurrentModule = updateLanguageCurrentModule;
globalThis.updateLanguagePendingBannerModule = updateLanguagePendingBannerModule;
globalThis.updateLanguageSettingsLabelsModule = updateLanguageSettingsLabelsModule;

function initLanguageAutoDetectModule() {
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
      const lang = mapCountryToLangModule(country);
      if (lang) setLocale(lang);
    })
    .catch(() => {});
}

function initLanguagePanelModule() {
  renderLanguageButtonsModule(languageList);
  if (languageListMore) languageListMore.classList.add("is-hidden");
  updateLanguageSelectionModule();
  updateLanguageCurrentModule();
  if (languageMoreButton && languageListMore) {
    languageMoreButton.style.display = "none";
  }
  if (currentLocale && I18N[currentLocale]) {
    document.documentElement.lang = currentLocale;
    Promise.resolve(window.CSSOS_I18N?.ensureGeneratedLocale?.(currentLocale))
      .catch(() => null)
      .finally(() => {
        applyI18n();
        updateComposingText();
        renderLoginPlatforms();
        renderProfilePanel();
        if (typeof refreshProfileVersionSurface === "function") {
          refreshProfileVersionSurface({
            versionToggle,
            versionMenu,
            versionList,
            versionCurrentLabel,
            versionHero,
            versionHighlights,
            versionTechSummary
          });
        }
        updateLanguageStatusModule("language.ready");
        updateLanguageSelectionModule();
        updateLanguageCurrentModule();
        updateLanguagePendingBannerModule();
        updateLanguageSettingsLabelsModule();
      });
  }
  buildLanguageSettingsModule();
  updateLanguagePendingBannerModule();
}

globalThis.initLanguagePanelModule = initLanguagePanelModule;
globalThis.toggleLanguagePanelMode = toggleLanguagePanelModeModule;
