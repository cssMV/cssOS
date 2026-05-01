/**
 * CSSMV_CIV_UI_HINTS 20260424 #94 — Jing
 * ------------------------------------------------------------------
 * Populate UI hint slots (title placeholder, style/voice labels, MV
 * demo title) from the civilization bank per current UI locale.
 *
 * Replaces these hardcoded strings that previously sat in index.html:
 *   - #title-input placeholder "嫦娥奔月 / Moon of Chang'e"
 *   - #music-style default text "Chinese GuFeng"
 *   - #voice-style default text "Feminine"
 *   - #mv-title demo text "嫦娥奔月"
 *
 * Rules (per Jing):
 *   1. UI locale is the primary default. If UI is English → English
 *      title hint, if Japanese → Japanese hint, etc.
 *   2. Style/Voice labels must start EMPTY — they get populated only
 *      after the user runs a random roll or loads an actual work.
 *   3. Re-apply on `cssos:locale-changed` so locale flips propagate.
 *   4. Never override a value the user has already typed / edited.
 */
(function attachCivilizationUiHints(global) {
  "use strict";

  function getBank() {
    return global.CSSOS_CIVILIZATION_BANK || null;
  }

  function resolvePrimaryLocale() {
    if (typeof global.resolveUiPrimaryLanguageModule === "function") {
      try {
        const v = global.resolveUiPrimaryLanguageModule();
        if (v) return String(v).toLowerCase();
      } catch (_err) { /* fall through */ }
    }
    let raw = "";
    try {
      raw = String(
        global.currentLocale ||
        (typeof document !== "undefined" && document.documentElement && document.documentElement.lang) ||
        (typeof localStorage !== "undefined" && (localStorage.getItem("cssos.locale") || localStorage.getItem("CSSOS_LANG"))) ||
        ""
      );
    } catch (_err) { /* no-op */ }
    const primary = raw.trim().toLowerCase().split(/[-_]/)[0].replace(/[^a-z]/g, "");
    return primary || "en";
  }

  function pickHintFromCivilization(civ, locale) {
    if (!civ) return "";
    const hints = Array.isArray(civ.titleHints) ? civ.titleHints : [];
    if (!hints.length) return "";
    // Deterministic pick by (locale + date) so the placeholder changes
    // between days but is stable within the same session.
    const dayStamp = new Date().toISOString().slice(0, 10);
    let hash = 0;
    const key = `${locale}::${dayStamp}::${civ.code || ""}`;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return String(hints[hash % hints.length] || hints[0] || "");
  }

  function englishGlossFor(locale, hint) {
    // Very light transliteration layer. If the civilization itself has an
    // English pairing (rare in bank), prefer that. Otherwise fall back to
    // category labels.
    const table = {
      zh: "Moonlit Verse",
      ja: "Night Train Song",
      ko: "Seoul Winter",
      th: "Rainy Lanes",
      vi: "River Dusk",
      id: "Island Harbor",
      ms: "Island Harbor",
      hi: "Monsoon Hymn",
      ar: "Desert Dawn",
      fa: "Garden of Light",
      tr: "Bosphorus Ballad",
      ru: "Birch Winter",
      de: "Alpine Echo",
      fr: "Paris at Dusk",
      es: "Sunlit Courtyard",
      pt: "Harbor Light",
      it: "Amalfi Air",
      en: "Midnight Skyline",
      sw: "Savanna Breeze",
      zu: "River Stones",
      yo: "Harmattan Dusk",
      am: "Highland Dawn",
      he: "Olive Hour"
    };
    if (locale && table[locale]) return table[locale];
    return hint ? "Title idea" : "Enter a title";
  }

  function buildPlaceholder(locale) {
    const bank = getBank();
    if (!bank || typeof bank.getCivilization !== "function") {
      return englishGlossFor(locale, "");
    }
    const civ = bank.getCivilization(locale);
    const hint = pickHintFromCivilization(civ, locale);
    const gloss = englishGlossFor(locale, hint);
    if (!hint) return gloss;
    // Keep the paired format (native / english) so users with mixed muscle
    // memory see both. Matches the old "嫦娥奔月 / Moon of Chang'e" shape.
    return `${hint} / ${gloss}`;
  }

  function applyTitlePlaceholder() {
    const input = document.getElementById("title-input");
    if (!input) return;
    const locale = resolvePrimaryLocale();
    const placeholder = buildPlaceholder(locale);
    if (!placeholder) return;
    // Never override a value the user is already editing.
    if (input.value && input.value.trim()) return;
    input.setAttribute("placeholder", placeholder);
    // Remove the i18n override so the dict lookup doesn't clobber this.
    if (input.dataset && input.dataset.i18nPlaceholder) {
      delete input.dataset.i18nPlaceholder;
    }
  }

  function clearStaticLabels() {
    // #music-style / #voice-style used to read "Chinese GuFeng" / "Feminine".
    // Start empty so the waveform panel shows nothing pre-roll.
    const musicStyle = document.getElementById("music-style");
    if (musicStyle && !musicStyle.dataset.cssmvCivHintsTouched) {
      if (musicStyle.textContent && /GuFeng|Feminine|古风/i.test(musicStyle.textContent)) {
        musicStyle.textContent = "—";
      }
      musicStyle.dataset.cssmvCivHintsTouched = "1";
    }
    const voiceStyle = document.getElementById("voice-style");
    if (voiceStyle && !voiceStyle.dataset.cssmvCivHintsTouched) {
      if (voiceStyle.textContent && /Feminine|女声|female/i.test(voiceStyle.textContent)) {
        voiceStyle.textContent = "—";
      }
      voiceStyle.dataset.cssmvCivHintsTouched = "1";
    }
  }

  function applyMvDemoTitle() {
    const mv = document.getElementById("mv-title");
    if (!mv || mv.dataset.cssmvCivHintsTouched) return;
    // Only override the seed "嫦娥奔月" — if real work data has already
    // overwritten it, leave it alone.
    const current = String(mv.textContent || "").trim();
    if (current && current !== "嫦娥奔月" && current !== "Moon of Chang'e") {
      mv.dataset.cssmvCivHintsTouched = "1";
      return;
    }
    const locale = resolvePrimaryLocale();
    const bank = getBank();
    if (bank && typeof bank.getCivilization === "function") {
      const civ = bank.getCivilization(locale);
      const hint = pickHintFromCivilization(civ, locale);
      if (hint) mv.textContent = hint;
    }
    mv.dataset.cssmvCivHintsTouched = "1";
  }

  function applyAll() {
    try { applyTitlePlaceholder(); } catch (_err) { /* no-op */ }
    try { clearStaticLabels(); } catch (_err) { /* no-op */ }
    try { applyMvDemoTitle(); } catch (_err) { /* no-op */ }
  }

  function reapplyForLocaleFlip() {
    // On a locale flip we want the title placeholder to track the new UI
    // language, but we don't re-seed the MV demo title once real data has
    // taken over. Just re-run applyTitlePlaceholder() for the dropdown.
    try { applyTitlePlaceholder(); } catch (_err) { /* no-op */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyAll, { once: true });
  } else {
    applyAll();
  }

  try {
    document.addEventListener("cssos:locale-changed", reapplyForLocaleFlip);
    global.addEventListener("cssos:locale-changed", reapplyForLocaleFlip);
  } catch (_err) { /* no-op */ }

  // Expose for debugging / forced reapply from other modules.
  global.CSSMV_applyCivilizationUiHints = applyAll;
})(typeof globalThis !== "undefined" ? globalThis : window);
