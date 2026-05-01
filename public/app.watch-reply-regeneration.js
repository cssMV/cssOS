function pushWatchReplyRegenerationHistoryEntryModule(action, draft) {
  const normalized = globalThis.normalizeWatchReplyRegenerationDraftModule?.(draft);
  if (!normalized) return;
  const nextEntry = {
    action: String(action || "updated").trim() || "updated",
    windowKey: String(normalized.windowKey || "").trim(),
    token: String(normalized.token || "").trim(),
    section: String(normalized.section || "").trim(),
    phraseOrder: Math.max(0, Number(normalized.phraseOrder || 0)),
    timestamp: new Date().toISOString(),
    draft: normalized
  };
  const current = readWatchReplyRegenerationHistory().filter(
    (entry) =>
      String(entry?.windowKey || "").trim() !== nextEntry.windowKey ||
      String(entry?.action || "").trim() !== nextEntry.action
  );
  writeWatchReplyRegenerationHistory([nextEntry, ...current]);
}

function updateWatchReplyRegenerationDraftControlsModule(patch = {}) {
  const current = readWatchReplyRegenerationDraft();
  if (!current) return null;
  const next = {
    ...current,
    controls: {
      bassDuckBias: Math.max(-1, Math.min(1, Number(current?.controls?.bassDuckBias || 0))),
      stringsSettle: Math.max(-1, Math.min(1, Number(current?.controls?.stringsSettle || 0))),
      densityBias: Math.max(-1, Math.min(1, Number(current?.controls?.densityBias || 0))),
      ...patch
    }
  };
  localStorage.setItem(WATCH_REPLY_REGEN_DRAFT_KEY, JSON.stringify(next));
  renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
  return next;
}

function resetWatchReplyRegenerationDraftControlsModule() {
  const current = readWatchReplyRegenerationDraft();
  if (!current) return null;
  const baseline = {
    bassDuckBias: Math.max(-1, Math.min(1, Number(current?.importedControls?.bassDuckBias ?? current?.controls?.bassDuckBias ?? 0))),
    stringsSettle: Math.max(-1, Math.min(1, Number(current?.importedControls?.stringsSettle ?? current?.controls?.stringsSettle ?? 0))),
    densityBias: Math.max(-1, Math.min(1, Number(current?.importedControls?.densityBias ?? current?.controls?.densityBias ?? 0)))
  };
  const next = {
    ...current,
    controls: { ...baseline },
    importedControls: { ...baseline }
  };
  localStorage.setItem(WATCH_REPLY_REGEN_DRAFT_KEY, JSON.stringify(next));
  renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
  updateWatchAudioDebug();
  showToast(loginCopy("Draft controls reset to imported values."));
  return next;
}

function formatReplyDraftDeltaModule(value) {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) < 0.005) return "0.00";
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(2)}`;
}

function watchReplyDraftHasUnsavedControlChangesModule(draft) {
  if (!draft || typeof draft !== "object") return false;
  const fields = ["bassDuckBias", "stringsSettle", "densityBias"];
  return fields.some((field) => {
    const currentValue = Number(draft?.controls?.[field] || 0);
    const importedValue = Number(draft?.importedControls?.[field] ?? 0);
    return Math.abs(currentValue - importedValue) >= 0.005;
  });
}

function clearWatchReplyRegenerationDraftModule() {
  try {
    localStorage.removeItem(WATCH_REPLY_REGEN_DRAFT_KEY);
    renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
    updateWatchAudioDebug();
    showToast(loginCopy("Regeneration draft cleared."));
    return true;
  } catch (_err) {
    showToast(loginCopy("Unable to clear the draft right now."));
    return false;
  }
}

function buildWatchReplyRegenerationPayloadModule(draft) {
  if (!draft || typeof draft !== "object") return null;
  return {
    kind: "reply_harmony_window_regeneration",
    runId: String(draft.runId || "").trim(),
    target: {
      windowKey: String(draft.windowKey || "").trim(),
      token: String(draft.token || "").trim(),
      section: String(draft.section || "").trim(),
      phraseOrder: Math.max(0, Number(draft.phraseOrder || 0)),
      role: String(draft.role || "").trim(),
      cadence: String(draft.cadence || "").trim(),
      startSec: Math.max(0, Number(draft.startSec || 0)),
      durationSec: Math.max(0.2, Number(draft.durationSec || 0))
    },
    controls: {
      bassDuckBias: Math.max(-1, Math.min(1, Number(draft?.controls?.bassDuckBias || 0))),
      stringsSettle: Math.max(-1, Math.min(1, Number(draft?.controls?.stringsSettle || 0))),
      densityBias: Math.max(-1, Math.min(1, Number(draft?.controls?.densityBias || 0)))
    },
    loopPreferred: !!draft.loopPreferred,
    sourceArtifacts: Array.isArray(draft.sourceArtifacts) ? draft.sourceArtifacts : [],
    status: String(draft.status || "draft"),
    requestedAt: String(draft.requestedAt || "")
  };
}

function normalizeWatchReplyRegenerationDraftModule(rawDraft) {
  if (!rawDraft || typeof rawDraft !== "object") return null;
  const payloadLike = rawDraft?.target && typeof rawDraft.target === "object" ? rawDraft : null;
  const source = payloadLike
    ? {
        kind: rawDraft.kind,
        runId: rawDraft.runId,
        windowKey: rawDraft?.target?.windowKey,
        token: rawDraft?.target?.token,
        section: rawDraft?.target?.section,
        phraseOrder: rawDraft?.target?.phraseOrder,
        role: rawDraft?.target?.role,
        cadence: rawDraft?.target?.cadence,
        startSec: rawDraft?.target?.startSec,
        durationSec: rawDraft?.target?.durationSec,
        controls: rawDraft.controls,
        loopPreferred: rawDraft.loopPreferred,
        sourceArtifacts: rawDraft.sourceArtifacts,
        status: rawDraft.status,
        requestedAt: rawDraft.requestedAt
      }
    : rawDraft;
  if (String(source.kind || "").trim() !== "reply_harmony_window_regeneration") return null;
  const normalized = {
    kind: "reply_harmony_window_regeneration",
    runId: String(source.runId || currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim(),
    windowKey: String(source.windowKey || "").trim(),
    token: String(source.token || "").trim(),
    section: String(source.section || "").trim(),
    phraseOrder: Math.max(0, Number(source.phraseOrder || 0)),
    role: String(source.role || "").trim(),
    cadence: String(source.cadence || "").trim(),
    startSec: Math.max(0, Number(source.startSec || 0)),
    durationSec: Math.max(0.2, Number(source.durationSec || 0)),
    loopPreferred: !!source.loopPreferred,
    controls: {
      bassDuckBias: Math.max(-1, Math.min(1, Number(source?.controls?.bassDuckBias || 0))),
      stringsSettle: Math.max(-1, Math.min(1, Number(source?.controls?.stringsSettle || 0))),
      densityBias: Math.max(-1, Math.min(1, Number(source?.controls?.densityBias || 0)))
    },
    importedControls: {
      bassDuckBias: Math.max(-1, Math.min(1, Number(source?.importedControls?.bassDuckBias ?? source?.controls?.bassDuckBias ?? 0))),
      stringsSettle: Math.max(-1, Math.min(1, Number(source?.importedControls?.stringsSettle ?? source?.controls?.stringsSettle ?? 0))),
      densityBias: Math.max(-1, Math.min(1, Number(source?.importedControls?.densityBias ?? source?.controls?.densityBias ?? 0)))
    },
    sourceArtifacts: Array.isArray(source.sourceArtifacts) ? source.sourceArtifacts : ["./build/music.plan.json", "./build/vocals.plan.json"],
    requestedAt: String(source.requestedAt || new Date().toISOString()),
    status: String(source.status || "draft")
  };
  if (!normalized.windowKey && normalized.section) {
    const tokenKey = normalized.token || "window";
    normalized.windowKey = `${normalized.section}::${normalized.phraseOrder}::${tokenKey}::${Number(normalized.startSec).toFixed(3)}`;
  }
  if (!normalized.windowKey) return null;
  return normalized;
}

function importWatchReplyRegenerationDraftModule(rawDraft) {
  const normalized = normalizeWatchReplyRegenerationDraftModule(rawDraft);
  if (!normalized) {
    showToast(loginCopy("That draft file is not a valid reply-window sidecar."));
    return null;
  }
  try {
    localStorage.setItem(WATCH_REPLY_REGEN_DRAFT_KEY, JSON.stringify(normalized));
    pushWatchReplyRegenerationHistoryEntryModule("imported", normalized);
    renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
    updateWatchAudioDebug();
    showToast(
      loginCopy(
        `Draft loaded for ${normalized.token || "this window"}.`
      )
    );
    return normalized;
  } catch (_err) {
    showToast(loginCopy("Unable to load that draft right now."));
    return null;
  }
}

window.pushWatchReplyRegenerationHistoryEntryModule = pushWatchReplyRegenerationHistoryEntryModule;
window.updateWatchReplyRegenerationDraftControlsModule = updateWatchReplyRegenerationDraftControlsModule;
window.resetWatchReplyRegenerationDraftControlsModule = resetWatchReplyRegenerationDraftControlsModule;
window.formatReplyDraftDeltaModule = formatReplyDraftDeltaModule;
window.watchReplyDraftHasUnsavedControlChangesModule = watchReplyDraftHasUnsavedControlChangesModule;
window.clearWatchReplyRegenerationDraftModule = clearWatchReplyRegenerationDraftModule;
window.buildWatchReplyRegenerationPayloadModule = buildWatchReplyRegenerationPayloadModule;
window.normalizeWatchReplyRegenerationDraftModule = normalizeWatchReplyRegenerationDraftModule;
window.importWatchReplyRegenerationDraftModule = importWatchReplyRegenerationDraftModule;
