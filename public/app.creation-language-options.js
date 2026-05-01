/**
 * CSSMV_CREATION_LANG_OPTIONS 20260425 #100 — Jing
 * ------------------------------------------------------------------
 * The Advanced Settings <select id="creation-language"> dropdown was
 * hardcoded in index.html to only show Auto / Chinese / English /
 * Japanese (4 options). The language panel itself ships TEN languages
 * via the global LANGS array (en/zh/ja/ko/es/fr/de/pt/ru/ar). When a
 * user picked Korean (or any non-zh/ja locale) in the language panel
 * there was no matching option in the dropdown, so it silently fell
 * back to the empty "Auto" value — the user's explicit pick was lost.
 *
 * This module:
 *   1. Repopulates <select id="creation-language"> from globalThis.LANGS
 *      at DOMContentLoaded (Auto first, then all enabled+pending langs).
 *   2. Patches setLocale() to dispatch a `cssos:locale-changed` event
 *      (the existing listener in app.creation-language.js was waiting
 *      on this but no one was emitting it — silent dead code path).
 *   3. Replaces syncCreationLanguageToUiModule's "always clear to Auto"
 *      behaviour with: when the user hasn't touched the dropdown, mirror
 *      the current UI locale into the dropdown so the user can SEE that
 *      their language-panel pick took effect. Manual touches still win.
 *
 * Load order matters: this script must come AFTER app.js (LANGS,
 * setLocale defined) and AFTER app.creation-language.js (so we can
 * override its sync function). See index.html for placement.
 */
(function attachCreationLanguageOptions(global) {
  "use strict";

  function readLangs() {
    if (Array.isArray(global.LANGS) && global.LANGS.length) return global.LANGS;
    // Fallback: minimal hard-coded list matching app.js LANGS order.
    return [
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
  }

  // English fallback labels per ISO code so we render something even
  // when the i18n table for the active locale doesn't have lang.* yet.
  const FALLBACK_LABELS = Object.freeze({
    en: "English",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    ru: "Russian",
    ar: "Arabic"
  });

  function safeT(key) {
    try {
      if (typeof global.t === "function") {
        const out = global.t(key);
        if (out && !/^TODO_i18n/.test(out)) return out;
      }
    } catch (_e) { /* no-op */ }
    return "";
  }

  function labelFor(lang) {
    if (!lang) return "";
    const tx = safeT(lang.nameKey || `lang.${lang.code}`);
    if (tx) return tx;
    return FALLBACK_LABELS[lang.code] || (lang.code || "").toUpperCase();
  }

  function rebuildDropdown(sel) {
    if (!sel) return;
    const langs = readLangs();
    // Preserve the current selection so a rebuild doesn't drop the user's pick.
    const previousValue = sel.value || "";
    sel.innerHTML = "";

    // Auto option always first.
    const autoOpt = document.createElement("option");
    autoOpt.value = "";
    autoOpt.setAttribute("data-i18n", "lang.auto");
    autoOpt.textContent = safeT("lang.auto") || "Auto";
    sel.appendChild(autoOpt);

    langs.forEach((lang) => {
      if (!lang || !lang.code) return;
      const opt = document.createElement("option");
      opt.value = String(lang.code).toLowerCase();
      opt.setAttribute("data-i18n", lang.nameKey || `lang.${lang.code}`);
      const label = labelFor(lang);
      opt.textContent = lang.flag ? `${lang.flag} ${label}` : label;
      if (lang.enabled === false) {
        // Keep pending langs selectable (we want to honour the user's
        // pick even if the i18n bundle isn't ready), but mark them so a
        // future stylesheet can dim them if desired.
        opt.dataset.langPending = "1";
      }
      sel.appendChild(opt);
    });

    // Restore previous value if still valid; otherwise stay on Auto.
    const validValues = Array.from(sel.options).map((o) => o.value);
    if (previousValue && validValues.includes(previousValue)) {
      sel.value = previousValue;
    } else {
      sel.value = "";
    }
  }

  function relabelDropdown(sel) {
    if (!sel) return;
    Array.from(sel.options).forEach((opt) => {
      const key = opt.getAttribute("data-i18n");
      if (!key) return;
      const tx = safeT(key);
      if (!tx) return;
      // Keep the flag prefix if there was one (i.e. for non-Auto rows).
      const lang = readLangs().find((l) => (l.nameKey || `lang.${l.code}`) === key);
      const label = lang && lang.flag ? `${lang.flag} ${tx}` : tx;
      opt.textContent = label;
    });
  }

  function ensureDropdown() {
    const sel = document.getElementById("creation-language");
    if (!sel) return null;
    if (sel.dataset.cssmvLangOptionsBuilt !== "1") {
      rebuildDropdown(sel);
      sel.dataset.cssmvLangOptionsBuilt = "1";
    }
    return sel;
  }

  // ---------------------------------------------------------------- setLocale patch
  // app.creation-language.js listens for `cssos:locale-changed` but
  // nobody dispatches it. Wrap setLocale to fire the event after the
  // currentLocale flip so existing listeners (and ours below) actually
  // get woken up. Also re-fire when document.documentElement.lang flips
  // out-of-band (defensive).
  let setLocalePatched = false;
  function patchSetLocaleOnce() {
    if (setLocalePatched) return;
    if (typeof global.setLocale !== "function") return;
    const original = global.setLocale;
    global.setLocale = function patchedSetLocale(locale) {
      const result = original.apply(this, arguments);
      try {
        const ev = new CustomEvent("cssos:locale-changed", {
          detail: { locale: String(locale || "").toLowerCase() }
        });
        document.dispatchEvent(ev);
        global.dispatchEvent(ev);
      } catch (_e) { /* no-op */ }
      return result;
    };
    setLocalePatched = true;
  }

  // ---------------------------------------------------------------- sync override
  // app.creation-language.js installs a syncCreationLanguageToUiModule
  // that always clears the dropdown to "" on locale change. New rule:
  // when the field hasn't been touched, MIRROR the active locale into
  // the dropdown so the user sees their language-panel pick reflected.
  // When touched, leave the manual pick alone.
  function getCurrentLocale() {
    try {
      if (typeof global.resolveUiPrimaryLanguageModule === "function") {
        const v = global.resolveUiPrimaryLanguageModule();
        if (v) return String(v).toLowerCase();
      }
    } catch (_e) { /* no-op */ }
    let raw = "";
    try {
      raw = String(
        global.currentLocale ||
        (document.documentElement && document.documentElement.lang) ||
        (typeof localStorage !== "undefined" && (localStorage.getItem("CSSOS_LANG") || localStorage.getItem("cssos.locale"))) ||
        ""
      );
    } catch (_e) { /* no-op */ }
    return raw.trim().toLowerCase().split(/[-_]/)[0].replace(/[^a-z]/g, "");
  }

  function isFieldTouched() {
    try {
      if (typeof global.hasCreationFieldTouchedModule === "function") {
        return global.hasCreationFieldTouchedModule("language");
      }
      if (typeof global.hasCreationFieldTouched === "function") {
        return global.hasCreationFieldTouched("language");
      }
    } catch (_e) { /* no-op */ }
    return false;
  }

  function dropdownHasOption(sel, value) {
    if (!sel) return false;
    return Array.from(sel.options).some((o) => o.value === value);
  }

  function syncDropdownToLocale() {
    const sel = ensureDropdown();
    if (!sel) return;
    if (isFieldTouched()) return;
    const locale = getCurrentLocale();
    if (!locale) return;
    if (!dropdownHasOption(sel, locale)) return;
    if (sel.value !== locale) {
      sel.value = locale;
      // Mirror into creationState so getPrimaryCreationLanguageModule
      // returns the right value even before the user touches anything.
      try {
        if (global.creationState) {
          // NOT touching `language` because the user hasn't typed in
          // the dropdown — we want this to remain auto-overridable on
          // the next locale flip. resolveCreationLanguageValue() falls
          // back to UI locale anyway when language is empty.
          if (typeof global.renderCreationConsoleModule === "function") {
            try { global.renderCreationConsoleModule(); } catch (_e) { /* no-op */ }
          }
        }
      } catch (_e) { /* no-op */ }
    }
    // Also relabel any options if the i18n bundle just resolved.
    relabelDropdown(sel);
  }

  // Replace the upstream sync function so renderCreationConsoleModule
  // doesn't fight us by clearing back to "". Keep the old fn around for
  // diagnostics.
  if (typeof global.syncCreationLanguageToUiModule === "function") {
    global._cssmvOriginalSyncCreationLanguage = global.syncCreationLanguageToUiModule;
  }
  global.syncCreationLanguageToUiModule = function cssmvSyncCreationLanguageToUi() {
    const sel = ensureDropdown();
    if (!sel) return;
    if (isFieldTouched()) return;
    const locale = getCurrentLocale();
    if (locale && dropdownHasOption(sel, locale)) {
      if (sel.value !== locale) sel.value = locale;
    } else if (sel.value !== "") {
      sel.value = "";
    }
    relabelDropdown(sel);
  };

  // ---------------------------------------------------------------- boot
  function boot() {
    ensureDropdown();
    patchSetLocaleOnce();
    syncDropdownToLocale();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // Re-sync on locale flips (covers both our patched setLocale path and
  // any future direct dispatch from the i18n bundle).
  try {
    document.addEventListener("cssos:locale-changed", syncDropdownToLocale);
    global.addEventListener("cssos:locale-changed", syncDropdownToLocale);
  } catch (_e) { /* no-op */ }

  // Re-sync when language panel cards are clicked (defensive — covers
  // the case where the i18n bundle is still loading and currentLocale
  // hasn't flipped yet by the time setLocale dispatches).
  document.addEventListener("click", (ev) => {
    const card = ev.target && ev.target.closest && ev.target.closest(".lang-card[data-lang]");
    if (!card) return;
    setTimeout(syncDropdownToLocale, 0);
    setTimeout(syncDropdownToLocale, 600);
  }, true);

  // If app.js or another module replaces #creation-language wholesale
  // (re-render), rebuild on demand. Idempotent.
  global.cssmvRebuildCreationLanguageOptions = function rebuild() {
    const sel = document.getElementById("creation-language");
    if (!sel) return;
    sel.dataset.cssmvLangOptionsBuilt = "";
    ensureDropdown();
    syncDropdownToLocale();
  };

  // Periodic safety net: if some other code flips currentLocale without
  // dispatching the event, catch up within 2 seconds. Cheap and bounded.
  let lastObservedLocale = "";
  setInterval(() => {
    const locale = getCurrentLocale();
    if (locale && locale !== lastObservedLocale) {
      lastObservedLocale = locale;
      syncDropdownToLocale();
    }
  }, 2000);
})(typeof globalThis !== "undefined" ? globalThis : window);
