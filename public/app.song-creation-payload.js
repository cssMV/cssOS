function normalizeSongCreationPayloadModule(payload = {}) {
  if (typeof globalThis.normalizeSongCreationPayloadBridge === "function") {
    return globalThis.normalizeSongCreationPayloadBridge(payload);
  }
  const draft = state?.songSeed?.draft || {};
  const source = String(payload?.source || draft.source || "manual").trim() || "manual";
  const title = String(payload?.title || draft.title || "").trim();
  const rawVoiceId = payload?.rawVoiceId ?? draft.rawVoiceId ?? null;
  const rawTranscript = String(
    payload?.rawTranscript || draft.rawTranscript || micState?.transcript || ""
  ).trim();
  const workType =
    typeof normalizeWorkTypeClient === "function"
      ? normalizeWorkTypeClient(payload?.workType || creationState?.workType || "single")
      : String(payload?.workType || creationState?.workType || "single").trim() || "single";
  const existingRunId = String(payload?.existingRunId || "").trim();
  const localWorkId = String(payload?.localWorkId || "").trim();
  const rerunStrategy = String(
    payload?.rerunStrategy ||
      (payload?.overwriteExistingWork === true
        ? "overwrite"
        : payload?.overwriteExistingWork === false
          ? "preserve"
          : readPanelBehaviorSettingsLocal?.()?.works?.rerun_strategy ||
            draft.rerunStrategy ||
            "preserve")
  )
    .trim()
    .toLowerCase();
  const titleEdited =
    typeof getSongSeedTitleUserEditedFlag === "function"
      ? getSongSeedTitleUserEditedFlag(payload)
      : Boolean(payload?.isSongSeedTitleUserEdited || draft.isSongSeedTitleUserEdited);
  return {
    source,
    title,
    rawVoiceId: rawVoiceId ? String(rawVoiceId).trim() : null,
    rawTranscript,
    isSongSeedTitleUserEdited: titleEdited,
    workType,
    existingRunId,
    localWorkId,
    rerunStrategy: rerunStrategy === "overwrite" ? "overwrite" : "preserve",
    overwriteExistingWork: rerunStrategy === "overwrite"
  };
}

globalThis.normalizeSongCreationPayloadModule = normalizeSongCreationPayloadModule;
