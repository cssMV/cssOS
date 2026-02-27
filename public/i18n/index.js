(function () {
  const { LOCALE_KEY, DEFAULT_LOCALE } = window.CSSOS_I18N_CONSTANTS || { LOCALE_KEY: "cssos.locale", DEFAULT_LOCALE: "en" };
  const { I18N } = window.CSSOS_I18N_DICT || { I18N: {} };

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
    t,
    getCurrentLocale,
    setCurrentLocale
  };
})();
