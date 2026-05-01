function exportWatchReplyRegenerationDraftFileModule(payload) {
  if (!payload) return false;
  try {
    const tokenSlug = String(payload?.target?.token || "window")
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 32) || "window";
    const startSlug = String(Number(payload?.target?.startSec || 0).toFixed(2)).replace(".", "_");
    const runSlug = String(payload?.runId || "draft").trim().slice(0, 24) || "draft";
    const filename = `reply_regen_${runSlug}_${tokenSlug}_${startSlug}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast(loginCopy("Draft JSON exported."));
    return true;
  } catch (_err) {
    showToast(loginCopy("Export failed on this device."));
    return false;
  }
}

function saveWatchReplyRegenerationDraftAsNewFileModule(draft) {
  const normalized = globalThis.normalizeWatchReplyRegenerationDraftModule?.(draft);
  if (!normalized) {
    showToast(loginCopy("There is no valid draft to save yet."));
    return false;
  }
  try {
    const tokenSlug = String(normalized.token || "window")
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 32) || "window";
    const startSlug = String(Number(normalized.startSec || 0).toFixed(2)).replace(".", "_");
    const runSlug = String(normalized.runId || "draft").trim().slice(0, 24) || "draft";
    const variantDraft = {
      ...normalized,
      status: "draft_variant",
      savedAsNew: true,
      exportedAt: new Date().toISOString()
    };
    const filename = `reply_regen_variant_${runSlug}_${tokenSlug}_${startSlug}.json`;
    const blob = new Blob([JSON.stringify(variantDraft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    globalThis.pushWatchReplyRegenerationHistoryEntryModule?.("saved", variantDraft);
    showToast(loginCopy("Saved as a new draft file."));
    return true;
  } catch (_err) {
    showToast(loginCopy("Unable to save a new draft file right now."));
    return false;
  }
}

function createWatchReplyRegenerationDraftModule(windowEntry = null) {
  const draft = persistWatchReplyRegenerationDraft(windowEntry);
  if (!draft) {
    showToast(loginCopy("Unable to prepare a regeneration draft right now."));
    return null;
  }
  showToast(
    loginCopy(
      `Regeneration draft prepared for ${draft.token || "this window"}.`
    )
  );
  updateWatchAudioDebug();
  return draft;
}

function isReplyHarmonyWindowActiveModule(windowEntry, currentTimeSec) {
  const startSec = Number(windowEntry?.startSec || 0);
  const durationSec = Math.max(0, Number(windowEntry?.durationSec || 0));
  const endSec = startSec + durationSec;
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) return false;
  return currentTimeSec >= startSec && currentTimeSec <= endSec;
}

function buildReplyHarmonyStructureSegmentsModule(windows, durationSec) {
  if (!Array.isArray(windows) || !windows.length || !(durationSec > 0)) return [];
  const grouped = new Map();
  windows.forEach((windowEntry) => {
    const section = String(windowEntry?.section || "").trim() || loginCopy("Section");
    const phraseOrder = Math.max(0, Number(windowEntry?.phraseOrder || 0));
    const role = String(windowEntry?.role || "").trim().toLowerCase();
    const cadence = String(windowEntry?.cadence || "").trim().toLowerCase();
    const isTail = role === "resolve" || role === "release" || cadence === "resolved" || cadence === "authentic" || cadence === "plagal";
    const key = `${section}|${phraseOrder}|${isTail ? "tail" : "phrase"}`;
    const startSec = Math.max(0, Number(windowEntry?.startSec || 0));
    const endSec = startSec + Math.max(0.12, Number(windowEntry?.durationSec || 0));
    const existing = grouped.get(key);
    if (existing) {
      existing.startSec = Math.min(existing.startSec, startSec);
      existing.endSec = Math.max(existing.endSec, endSec);
      existing.strength = Math.max(existing.strength, Number(windowEntry?.strength) || 0);
      return;
    }
    grouped.set(key, {
      key,
      label: isTail
        ? `${section} · ${loginCopy("Tail")}`
        : `${section}${phraseOrder > 0 ? ` · P${phraseOrder}` : ""}`,
      startSec,
      endSec,
      strength: Number(windowEntry?.strength) || 0,
      isTail
    });
  });
  return [...grouped.values()]
    .sort((left, right) => left.startSec - right.startSec)
    .slice(0, 6)
    .map((segment) => ({
      ...segment,
      leftPct: Math.min(100, (segment.startSec / durationSec) * 100),
      widthPct: Math.max(6, Math.min(100, ((segment.endSec - segment.startSec) / durationSec) * 100))
    }));
}

function isReplyHarmonyStructureSegmentActiveModule(segmentEntry, currentTimeSec) {
  const startSec = Number(segmentEntry?.startSec || 0);
  const endSec = Number(segmentEntry?.endSec || 0);
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) return false;
  return currentTimeSec >= startSec && currentTimeSec <= endSec;
}

function activeReplyHarmonyWindowAtCurrentTimeModule() {
  const currentRunId = String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim();
  if (!currentRunId) return null;
  const cachedMusicPlan =
    watchMusicPlanCache.runId === currentRunId && watchMusicPlanCache.data && typeof watchMusicPlanCache.data === "object"
      ? watchMusicPlanCache.data
      : null;
  const windows = extractReplyHarmonyWindowsFromMusicPlan(cachedMusicPlan);
  if (!windows.length) return null;
  const currentTimeSec = currentWatchAudioTimeSec();
  return windows.find((windowEntry) => isReplyHarmonyWindowActiveModule(windowEntry, currentTimeSec)) || null;
}

function syncWatchReplyHarmonyTokenOverlayModule() {
  const lockedToken = String(watchReplyLockedWindow?.token || "").trim();
  const overrideToken = lockedToken || String(watchReplyTokenOverride?.token || "").trim();
  const activeWindow = overrideToken ? null : activeReplyHarmonyWindowAtCurrentTimeModule();
  const token = overrideToken || String(activeWindow?.token || "").trim();
  latestWatchReplyActiveToken = token;
  if (watchSubtitle) {
    const suffixPattern = /\s·\s(?:Focus|触发词):\s.*$/;
    const baseSubtitle = String(watchSubtitle.textContent || "").replace(suffixPattern, "").trim();
    watchSubtitle.textContent = token
      ? `${baseSubtitle || "KaraOKe MV · Preview"} · ${loginCopy("Focus")}: ${token}`
      : (baseSubtitle || watchSubtitle.textContent || "");
  }
  if (watchKaraokeLine) {
    watchKaraokeLine.textContent = token ? `${loginCopy("Focus Token")} · ${token}` : "";
  }
  updateWatchAudioDebug();
}

function setWatchReplyTokenOverrideModule(windowEntry = null) {
  if (watchReplyLockedWindow && !windowEntry) {
    syncWatchReplyHarmonyTokenOverlayModule();
    return;
  }
  const token = String(windowEntry?.token || "").trim();
  watchReplyTokenOverride = token ? { token } : null;
  syncWatchReplyHarmonyTokenOverlayModule();
}

function setWatchReplyLockedWindowModule(windowEntry = null) {
  const token = String(windowEntry?.token || "").trim();
  watchReplyLockedWindow = token ? { token, key: buildReplyHarmonyWindowKey(windowEntry) } : null;
  if (watchReplyLockedWindow) {
    watchReplyTokenOverride = null;
  } else {
    watchReplyLoopWindow = null;
  }
  persistWatchReplyLockState();
  syncWatchReplyHarmonyTokenOverlayModule();
  renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
}

function maybeRestoreWatchReplyLockedWindowModule() {
  const persisted = readWatchReplyLockHashState() || readPersistedWatchReplyLockState();
  if (!persisted?.key) return false;
  const currentRunId = String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim();
  if (persisted.runId && currentRunId && persisted.runId !== currentRunId) return false;
  const cachedMusicPlan =
    watchMusicPlanCache.runId === currentRunId && watchMusicPlanCache.data && typeof watchMusicPlanCache.data === "object"
      ? watchMusicPlanCache.data
      : null;
  const windows = extractReplyHarmonyWindowsFromMusicPlan(cachedMusicPlan);
  const matched = windows.find((windowEntry) => buildReplyHarmonyWindowKey(windowEntry) === persisted.key);
  if (!matched) return false;
  watchReplyLockedWindow = { key: persisted.key, token: String(matched?.token || persisted.token || "").trim() };
  watchReplyLoopWindow = persisted.loop
    ? {
        key: persisted.key,
        startSec: Math.max(0, Number(matched?.startSec || 0)),
        endSec: Math.max(0.2, Number(matched?.startSec || 0) + Math.max(0.2, Number(matched?.durationSec || 0)))
      }
    : null;
  syncWatchReplyHarmonyTokenOverlayModule();
  return true;
}

function jumpWatchAudioToReplyHarmonyWindowModule(windowEntry) {
  if (!watchAudioPreview || !windowEntry) return;
  const targetSec = Math.max(0, Number(windowEntry?.startSec || 0));
  if (!Number.isFinite(targetSec)) return;
  try {
    watchAudioPreview.currentTime = targetSec;
  } catch (_err) {
    return;
  }
  maybeRefreshReplyHarmonyHighlightModule();
}

function toggleWatchReplyWindowLoopModule(windowEntry = null) {
  const key = String(windowEntry ? buildReplyHarmonyWindowKey(windowEntry) : "").trim();
  if (!key) {
    watchReplyLoopWindow = null;
    persistWatchReplyLockState();
    renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
    return;
  }
  if (watchReplyLoopWindow?.key === key) {
    watchReplyLoopWindow = null;
    persistWatchReplyLockState();
    renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
    return;
  }
  const startSec = Math.max(0, Number(windowEntry?.startSec || 0));
  const endSec = startSec + Math.max(0.2, Number(windowEntry?.durationSec || 0));
  watchReplyLoopWindow = { key, startSec, endSec };
  persistWatchReplyLockState();
  jumpWatchAudioToReplyHarmonyWindowModule(windowEntry);
  renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
}

function enforceWatchReplyWindowLoopModule() {
  if (!watchAudioPreview || !watchReplyLoopWindow) return;
  const current = currentWatchAudioTimeSec();
  if (current < watchReplyLoopWindow.endSec) return;
  try {
    watchAudioPreview.currentTime = watchReplyLoopWindow.startSec;
  } catch (_err) {
    watchReplyLoopWindow = null;
  }
}

function bindReplyHarmonyInteractiveFocusModule(target, windowEntry) {
  if (!(target instanceof HTMLElement) || !windowEntry) return;
  target.addEventListener("mouseenter", () => setWatchReplyTokenOverrideModule(windowEntry));
  target.addEventListener("mouseleave", () => setWatchReplyTokenOverrideModule(null));
  target.addEventListener("focus", () => setWatchReplyTokenOverrideModule(windowEntry));
  target.addEventListener("blur", () => setWatchReplyTokenOverrideModule(null));
  target.addEventListener("click", () => {
    setWatchReplyLockedWindowModule(windowEntry);
    jumpWatchAudioToReplyHarmonyWindowModule(windowEntry);
  });
  target.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setWatchReplyLockedWindowModule(windowEntry);
    jumpWatchAudioToReplyHarmonyWindowModule(windowEntry);
  });
}

function maybeRefreshReplyHarmonyHighlightModule() {
  const currentRunId = String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim();
  if (!currentRunId) return;
  const cachedMusicPlan =
    watchMusicPlanCache.runId === currentRunId && watchMusicPlanCache.data && typeof watchMusicPlanCache.data === "object"
      ? watchMusicPlanCache.data
      : null;
  const windows = extractReplyHarmonyWindowsFromMusicPlan(cachedMusicPlan);
  if (!windows.length) return;
  const currentTimeSec = currentWatchAudioTimeSec();
  const activeWindow = windows.find((windowEntry) => isReplyHarmonyWindowActiveModule(windowEntry, currentTimeSec));
  const nextKey = activeWindow ? buildReplyHarmonyWindowKey(activeWindow) : "";
  syncWatchReplyHarmonyTokenOverlayModule();
  if (nextKey === latestWatchReplyHighlightKey) return;
  latestWatchReplyHighlightKey = nextKey;
  renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
}

window.exportWatchReplyRegenerationDraftFileModule = exportWatchReplyRegenerationDraftFileModule;
window.saveWatchReplyRegenerationDraftAsNewFileModule = saveWatchReplyRegenerationDraftAsNewFileModule;
window.createWatchReplyRegenerationDraftModule = createWatchReplyRegenerationDraftModule;
window.isReplyHarmonyWindowActiveModule = isReplyHarmonyWindowActiveModule;
window.buildReplyHarmonyStructureSegmentsModule = buildReplyHarmonyStructureSegmentsModule;
window.isReplyHarmonyStructureSegmentActiveModule = isReplyHarmonyStructureSegmentActiveModule;
window.activeReplyHarmonyWindowAtCurrentTimeModule = activeReplyHarmonyWindowAtCurrentTimeModule;
window.syncWatchReplyHarmonyTokenOverlayModule = syncWatchReplyHarmonyTokenOverlayModule;
window.setWatchReplyTokenOverrideModule = setWatchReplyTokenOverrideModule;
window.setWatchReplyLockedWindowModule = setWatchReplyLockedWindowModule;
window.maybeRestoreWatchReplyLockedWindowModule = maybeRestoreWatchReplyLockedWindowModule;
window.jumpWatchAudioToReplyHarmonyWindowModule = jumpWatchAudioToReplyHarmonyWindowModule;
window.toggleWatchReplyWindowLoopModule = toggleWatchReplyWindowLoopModule;
window.enforceWatchReplyWindowLoopModule = enforceWatchReplyWindowLoopModule;
window.bindReplyHarmonyInteractiveFocusModule = bindReplyHarmonyInteractiveFocusModule;
window.maybeRefreshReplyHarmonyHighlightModule = maybeRefreshReplyHarmonyHighlightModule;
