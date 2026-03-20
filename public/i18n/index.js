(function () {
  const { LOCALE_KEY, DEFAULT_LOCALE } = window.CSSOS_I18N_CONSTANTS || { LOCALE_KEY: "cssos.locale", DEFAULT_LOCALE: "en" };
  const { I18N } = window.CSSOS_I18N_DICT || { I18N: {} };
  const registry = window.CSSOS_I18N_REGISTRY || null;
  const generatedLocalePromises = new Map();
  const loadedGeneratedLocales = new Set();

  const missing = new Set();
  window.__i18nMissingKeys = window.__i18nMissingKeys || missing;

  function interpolate(template, vars = {}) {
    return String(template || "").replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? `{${key}}`));
  }

  function getCurrentLocale() {
    return localStorage.getItem(LOCALE_KEY) || DEFAULT_LOCALE;
  }

  function setCurrentLocale(locale) {
    if (!locale) return;
    localStorage.setItem(LOCALE_KEY, locale);
  }

  function registerLocaleDictionary(locale, entries = {}) {
    if (!locale || !entries || typeof entries !== "object") return;
    if (!I18N[locale]) I18N[locale] = {};
    Object.assign(I18N[locale], entries);
  }

  async function ensureGeneratedLocale(locale) {
    const lang = locale || getCurrentLocale() || DEFAULT_LOCALE;
    if (!lang || lang === DEFAULT_LOCALE || loadedGeneratedLocales.has(lang)) {
      return getLocaleDictionary(lang);
    }
    if (generatedLocalePromises.has(lang)) {
      return generatedLocalePromises.get(lang);
    }

    const task = fetch(`/i18n/generated/${lang}.json`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`generated locale load failed: ${lang}:${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        if (payload && typeof payload.entries === "object") {
          registerLocaleDictionary(lang, payload.entries);
        }
        loadedGeneratedLocales.add(lang);
        return getLocaleDictionary(lang);
      })
      .catch((error) => {
        console.warn(`Generated locale unavailable: ${lang}`, error);
        loadedGeneratedLocales.add(lang);
        return getLocaleDictionary(lang);
      })
      .finally(() => {
        generatedLocalePromises.delete(lang);
      });

    generatedLocalePromises.set(lang, task);
    return task;
  }

  function getLocaleDictionary(locale) {
    const lang = locale || getCurrentLocale() || DEFAULT_LOCALE;
    return I18N[lang] || {};
  }

  function listMissingKeys(locale) {
    const lang = locale || getCurrentLocale() || DEFAULT_LOCALE;
    const base = I18N[DEFAULT_LOCALE] || {};
    const table = I18N[lang] || {};
    return Object.keys(base)
      .filter((key) => !(key in table))
      .sort();
  }

  function t(key, vars = {}, localeOverride) {
    const locale = localeOverride || getCurrentLocale() || DEFAULT_LOCALE;
    const table = I18N[locale] || {};
    const fallback = I18N[DEFAULT_LOCALE] || {};
    const template = table[key] || fallback[key];
    if (!template) {
      const missKey = `${locale}:${key}`;
      if (!missing.has(missKey)) {
        missing.add(missKey);
        console.warn(`Missing i18n key: ${key} (${locale})`);
      }
      return key;
    }
    return interpolate(template, vars);
  }

  window.CSSOS_I18N = {
    interpolate,
    registerLocaleDictionary,
    getLocaleDictionary,
    listMissingKeys,
    ensureGeneratedLocale,
    t,
    getCurrentLocale,
    setCurrentLocale,
    registry
  };
})();
