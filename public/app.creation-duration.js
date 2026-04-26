function readCreationAudioDurationCandidate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function resolveCreationSourceAudioDurationSecModule() {
  const audioEntry = globalThis.musicSourceUploadState?.audio;
  if (!audioEntry || typeof audioEntry !== "object") return null;
  const metadata = audioEntry.metadata_summary && typeof audioEntry.metadata_summary === "object"
    ? audioEntry.metadata_summary
    : {};
  const analysisShell = metadata.analysis_shell && typeof metadata.analysis_shell === "object"
    ? metadata.analysis_shell
    : {};
  const candidates = [
    audioEntry.duration_sec,
    audioEntry.duration,
    audioEntry.audio_duration_sec,
    metadata.duration_sec,
    metadata.duration,
    metadata.audio_duration_sec,
    metadata.media_duration_sec,
    analysisShell.duration_sec
  ];
  for (const candidate of candidates) {
    const resolved = readCreationAudioDurationCandidate(candidate);
    if (resolved) return resolved;
  }
  return null;
}

function resolveCreationDurationValueModule(options = {}) {
  // CSSOS_PHASE2_GET_MEMBERSHIP_PRESET_GUARD 20260426 #136 — Jing
  // app.creation-duration.js loads before app.api-billing.js, so this
  // file's function declarations parse fine, but if anything calls
  // resolveCreationDurationValueModule() before api-billing.js has run
  // (boot races, early dialog open, etc.), getMembershipPreset throws
  // ReferenceError. Use the global if available, else a sane fallback.
  const _getMP = (typeof globalThis.getMembershipPreset === "function")
    ? globalThis.getMembershipPreset
    : (typeof getMembershipPreset === "function" ? getMembershipPreset : null);
  const preset = _getMP ? _getMP() : { maxDurationSec: 600, queuePriority: "standard" };
  const explicit = Number(creationState.duration || 0);
  if (hasCreationFieldTouched("duration") && Number.isFinite(explicit) && explicit > 0) {
    const maxDuration = Math.max(30, Number(preset.maxDurationSec || 600));
    return Math.max(24, Math.min(maxDuration, explicit));
  }
  const sourceAudioDuration = resolveCreationSourceAudioDurationSecModule();
  if (sourceAudioDuration) {
    const maxDuration = Math.max(30, Number(preset.maxDurationSec || 600));
    return Math.max(24, Math.min(maxDuration, Math.round(sourceAudioDuration)));
  }
  const lyricsText = String(options.lyricsText || lyricsInput?.value || "").trim();
  const titleText = String(options.title || titleInput?.value || state.title || "").trim();
  const normalizedLines = lyricsText
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const sectionCount = normalizedLines.filter((line) => /^\[[^\]]+\]$/.test(line)).length;
  const lyricalLineCount = normalizedLines.filter((line) => !/^\[[^\]]+\]$/.test(line)).length;
  if (!normalizedLines.length) return null;
  const lineDriven = lyricalLineCount * 9.5;
  const sectionDriven = sectionCount * 7.5;
  const chantDriven = Math.floor(lyricalLineCount / 5) * 3.5;
  let estimated = Math.round(lineDriven + sectionDriven + chantDriven);
  if (sectionCount >= 10) {
    estimated += Math.round((sectionCount - 9) * 10);
  }
  if (/(opera|歌剧)/i.test(titleText) || /(westworld|西部世界).*(prelude|前奏曲)|(prelude|前奏曲).*(westworld|西部世界)/i.test(titleText)) {
    estimated = Math.max(300, estimated);
  }
  const maxDuration = Math.max(30, Number(preset.maxDurationSec || 600));
  return Math.max(24, Math.min(maxDuration, estimated));
}

function resolveCreationWorkTypeValueModule(options = {}) {
  const explicit = normalizeWorkTypeClient(creationState.workType || "");
  if (hasCreationFieldTouched("workType") && String(creationState.workType || "").trim()) return explicit;
  const title = String(options.title || titleInput?.value || state.title || "").trim().toLowerCase();
  if (/(opera|歌剧)/.test(title)) return "opera";
  if (/(triptych|三部曲)/.test(title)) return "triptych";
  return "single";
}

Object.assign(globalThis, {
  resolveCreationSourceAudioDurationSecModule,
  resolveCreationDurationValueModule,
  resolveCreationWorkTypeValueModule,
  resolveCreationDurationValue: resolveCreationDurationValueModule,
  resolveCreationWorkTypeValue: resolveCreationWorkTypeValueModule
});

// Legacy global bindings for scripts that still reference these symbols directly.
// Use var so repeated loads won't throw.
// eslint-disable-next-line no-var
var resolveCreationDurationValue = resolveCreationDurationValueModule;
// eslint-disable-next-line no-var
var resolveCreationWorkTypeValue = resolveCreationWorkTypeValueModule;
