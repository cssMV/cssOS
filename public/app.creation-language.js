function markCreationFieldTouchedModule(field) {
  if (field) creationTouchedFields.add(String(field));
}

function clearCreationFieldTouchedModule(field) {
  if (field) creationTouchedFields.delete(String(field));
}

function hasCreationFieldTouchedModule(field) {
  return creationTouchedFields.has(String(field));
}

function resetCreationTouchedFieldsModule() {
  creationTouchedFields.clear();
}

function readExplicitCreationLanguageModule() {
  const normalize = (value) => {
    const language = String(value || "").trim().toLowerCase();
    return ["zh", "en", "ja"].includes(language) ? language : "";
  };
  if (hasCreationFieldTouchedModule("language")) {
    return normalize(creationLanguage?.value) || normalize(creationState.language);
  }
  return "";
}

function normalizeCreationLanguageCodeModule(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z-]/g, "");
}

function resolveUiPrimaryLanguageModule() {
  const raw = String(
    globalThis.currentLocale ||
    document.documentElement.lang ||
    (typeof localStorage !== "undefined" && (localStorage.getItem("CSSOS_LANG") || localStorage.getItem("cssos.locale"))) ||
    ""
  ).trim().toLowerCase();
  const primary = raw.split(/[-_]/)[0].replace(/[^a-z]/g, "");
  return primary || "en";
}

function resolveUiDefaultCreationLanguageModule() {
  const primary = resolveUiPrimaryLanguageModule();
  if (primary === "zh" || primary === "ja") return primary;
  return "en";
}

function normalizeCreationVoiceTrackCodeModule(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function getPrimaryCreationLanguageModule() {
  // CSSMV_UI_LANG_FOLLOW 20260420 — Jing: fallback used to be hardcoded "zh",
  // which made every unset creation default to Chinese even on English/Japanese
  // UIs. Now: fall back to the UI primary language → EN/JA/ZH.
  return normalizeCreationLanguageCodeModule(resolveCreationLanguageValue()) || resolveUiPrimaryLanguageModule() || "en";
}

function getSelectedCreationLanguagesModule() {
  const primary = getPrimaryCreationLanguageModule();
  const seen = new Set();
  return [
    primary,
    ...(Array.isArray(creationState.extraLyricLanguages) ? creationState.extraLyricLanguages : [])
  ]
    .map((value) => normalizeCreationLanguageCodeModule(value))
    .filter((value) => value && !seen.has(value) && seen.add(value));
}

function getSelectedCreationVoiceTracksModule() {
  const linkedLanguageTracks = getSelectedCreationLanguagesModule().map((lang) => `${lang}_lead`);
  const derivedPrimary = String(
    creationState.vocalStyle || creationState.ensembleStyle || voiceInput?.value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const seen = new Set();
  return [
    ...linkedLanguageTracks,
    ...(derivedPrimary ? [derivedPrimary] : []),
    ...(Array.isArray(creationState.extraVoiceTracks) ? creationState.extraVoiceTracks : [])
  ]
    .map((value) => normalizeCreationVoiceTrackCodeModule(value))
    .filter((value) => value && !seen.has(value) && seen.add(value));
}

function getCreationLyricLanguageCatalogModule() {
  return creationLyricLanguageCatalog.slice();
}

function getCreationVoiceTrackCatalogModule() {
  return creationVoiceTrackCatalog.slice();
}

function getPrimaryLyricsDraftModule(fallback = "") {
  const primary = getPrimaryCreationLanguageModule();
  const drafts =
    creationState.lyricDrafts && typeof creationState.lyricDrafts === "object"
      ? creationState.lyricDrafts
      : {};
  const primaryDraft = String(drafts[primary] || "").trim();
  return primaryDraft || String(fallback || lyricsInput?.value || "").trim();
}

// CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — Jing: the Advanced Settings language
// dropdown must default to EMPTY ("Auto"), NOT to zh/en/ja. When empty, the
// random-lyric path should fall back to the UI primary language. This sync
// now merely CLEARS the dropdown back to "" when the user hasn't touched it,
// so that a UI locale flip doesn't leave a stale pre-selection behind. The
// resolver for random-time lookups lives in getPrimaryCreationLanguageModule
// and already falls back to resolveUiPrimaryLanguageModule() when empty.
function syncCreationLanguageToUiModule() {
  const sel = typeof creationLanguage !== "undefined" ? creationLanguage : document.getElementById("creation-language");
  if (!sel) return;
  if (hasCreationFieldTouchedModule("language")) return;
  // Force-clear back to the empty "Auto" option so the dropdown doesn't silently
  // retain a previous locale. The empty option MUST exist in index.html.
  if (sel.value !== "") sel.value = "";
  try {
    if (typeof creationState !== "undefined" && creationState) {
      creationState.language = "";
      creationState.languageLockedBySeed = false;
    }
  } catch (_e) { /* no-op */ }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", syncCreationLanguageToUiModule, { once: true });
} else {
  syncCreationLanguageToUiModule();
}
// Re-sync when the UI locale flips. cssos dispatches "cssos:locale-changed"
// from app.language-panel.js / i18n flow; listen without ceremony.
try {
  document.addEventListener("cssos:locale-changed", syncCreationLanguageToUiModule);
  window.addEventListener("cssos:locale-changed", syncCreationLanguageToUiModule);
} catch (_e) { /* no-op */ }

Object.assign(globalThis, {
  markCreationFieldTouchedModule,
  clearCreationFieldTouchedModule,
  hasCreationFieldTouchedModule,
  resetCreationTouchedFieldsModule,
  readExplicitCreationLanguageModule,
  normalizeCreationLanguageCodeModule,
  resolveUiDefaultCreationLanguageModule,
  resolveUiPrimaryLanguageModule,
  normalizeCreationVoiceTrackCodeModule,
  getPrimaryCreationLanguageModule,
  getSelectedCreationLanguagesModule,
  getSelectedCreationVoiceTracksModule,
  getCreationLyricLanguageCatalogModule,
  getCreationVoiceTrackCatalogModule,
  getPrimaryLyricsDraftModule,
  syncCreationLanguageToUiModule
});
