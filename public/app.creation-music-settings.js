function resolveCreationLanguageValueModule(options = {}) {
  const explicit = readExplicitCreationLanguage();
  if (explicit) return explicit;
  // CSSMV_CIVILIZATION_CASCADE 20260424 #98 — Jing: UI locale MUST win over
  // title inference. A randomizer-produced han-heavy title must NOT override
  // a Japanese UI locale and flip everything to Chinese. Return empty when
  // untouched so the accessor (app.creation-accessors.js) falls back to
  // resolveUiPrimaryLanguageModule(), which is the single source of truth
  // for "what civilization should this Advanced Settings panel follow?".
  return "";
}

function resolveCreationTempoValueModule(options = {}) {
  const current = Number(creationState.tempo || 0);
  if (hasCreationFieldTouched("tempo") && Number.isFinite(current) && current > 0) {
    return Math.max(40, Math.min(220, current));
  }
  const title = String(options.title || titleInput?.value || state.title || "").trim();
  const lyricsText = String(options.lyricsText || lyricsInput?.value || "").trim();
  const seed = hashSeedString(`${title}::${lyricsText}::tempo`);
  return seededNumber(68, 168, 4, seed, 1);
}

function resolveCreationKeyValueModule(options = {}) {
  const explicit = String(creationState.key || "").trim().toUpperCase();
  if (hasCreationFieldTouched("key") && explicit) return explicit;
  const title = String(options.title || titleInput?.value || state.title || "").trim();
  const lyricsText = String(options.lyricsText || lyricsInput?.value || "").trim();
  const seed = hashSeedString(`${title}::${lyricsText}::key`);
  return seededPick(["C", "D", "E", "F", "G", "A", "B"], seed, 2) || "C";
}

Object.assign(globalThis, {
  resolveCreationLanguageValueModule,
  resolveCreationTempoValueModule,
  resolveCreationKeyValueModule
});
