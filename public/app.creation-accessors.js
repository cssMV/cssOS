function markCreationFieldTouched(field) {
  return globalThis.markCreationFieldTouchedModule?.(field);
}

function clearCreationFieldTouched(field) {
  return globalThis.clearCreationFieldTouchedModule?.(field);
}

function hasCreationFieldTouched(field) {
  return !!globalThis.hasCreationFieldTouchedModule?.(field);
}

function resetCreationTouchedFields() {
  return globalThis.resetCreationTouchedFieldsModule?.();
}

function readExplicitCreationLanguage() {
  return globalThis.readExplicitCreationLanguageModule?.() || "";
}

function normalizeCreationLanguageCode(value) {
  return globalThis.normalizeCreationLanguageCodeModule?.(value) || "";
}

function normalizeCreationVoiceTrackCode(value) {
  return globalThis.normalizeCreationVoiceTrackCodeModule?.(value) || "";
}

function getPrimaryCreationLanguage() {
  // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — Jing: fallback is UI locale, not "zh".
  return globalThis.getPrimaryCreationLanguageModule?.() || globalThis.resolveUiPrimaryLanguageModule?.() || "en";
}

function getSelectedCreationLanguages() {
  return globalThis.getSelectedCreationLanguagesModule?.() || [];
}

function getSelectedCreationVoiceTracks() {
  return globalThis.getSelectedCreationVoiceTracksModule?.() || [];
}

function getCreationLyricLanguageCatalog() {
  return globalThis.getCreationLyricLanguageCatalogModule?.() || [];
}

function getCreationVoiceTrackCatalog() {
  return globalThis.getCreationVoiceTrackCatalogModule?.() || [];
}

function getPrimaryLyricsDraft(fallback = "") {
  return globalThis.getPrimaryLyricsDraftModule?.(fallback) || String(fallback || "").trim();
}

function resolveCreationLanguageValue(options = {}) {
  // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — Jing: fallback is UI locale, not "zh".
  return globalThis.resolveCreationLanguageValueModule?.(options) || globalThis.resolveUiPrimaryLanguageModule?.() || "en";
}

function resolveCreationTempoValue(options = {}) {
  return globalThis.resolveCreationTempoValueModule?.(options) || 96;
}

function resolveCreationKeyValue(options = {}) {
  return globalThis.resolveCreationKeyValueModule?.(options) || "C";
}

function resolveCreationDurationValue(...args) {
  return globalThis.resolveCreationDurationValueModule?.(...args) ?? null;
}

function resolveCreationWorkTypeValue(...args) {
  return globalThis.resolveCreationWorkTypeValueModule?.(...args) || "single";
}

Object.assign(globalThis, {
  markCreationFieldTouched,
  clearCreationFieldTouched,
  hasCreationFieldTouched,
  resetCreationTouchedFields,
  readExplicitCreationLanguage,
  normalizeCreationLanguageCode,
  normalizeCreationVoiceTrackCode,
  getPrimaryCreationLanguage,
  getSelectedCreationLanguages,
  getSelectedCreationVoiceTracks,
  getCreationLyricLanguageCatalog,
  getCreationVoiceTrackCatalog,
  getPrimaryLyricsDraft,
  resolveCreationLanguageValue,
  resolveCreationTempoValue,
  resolveCreationKeyValue,
  resolveCreationDurationValue,
  resolveCreationWorkTypeValue
});
