function stopPipelineProgressPolling() {
  globalThis.stopPipelineProgressPollingModule?.();
}

function stopPendingFinalAudioPolling() {
  globalThis.stopPendingFinalAudioPollingModule?.();
}

async function pollPipelineProgressOnce(runId) {
  await globalThis.pollPipelineProgressOnceModule?.(runId);
}

function startPipelineProgressPolling(runId) {
  globalThis.startPipelineProgressPollingModule?.(runId);
}

function startPendingFinalAudioPolling(runId) {
  globalThis.startPendingFinalAudioPollingModule?.(runId);
}

function formatReplyHarmonyClock(value) {
  return globalThis.formatReplyHarmonyClockModule?.(value) || "00:00.0";
}

function extractReplyHarmonyWindowsFromMusicPlan(musicPlan) {
  return globalThis.extractReplyHarmonyWindowsFromMusicPlanModule?.(musicPlan) || [];
}

function replyHarmonyWindowStrength(windowEntry) {
  return globalThis.replyHarmonyWindowStrengthModule?.(windowEntry) ?? 0;
}

function currentWatchAudioTimeSec() {
  return globalThis.currentWatchAudioTimeSecModule?.() ?? 0;
}

function currentWatchAudioDurationSec() {
  return globalThis.currentWatchAudioDurationSecModule?.() ?? 0;
}

function buildReplyHarmonyWindowKey(windowEntry) {
  return globalThis.buildReplyHarmonyWindowKeyModule?.(windowEntry) || "";
}

function persistWatchReplyLockState() {
  globalThis.persistWatchReplyLockStateModule?.();
}

function readPersistedWatchReplyLockState() {
  return globalThis.readPersistedWatchReplyLockStateModule?.() || null;
}

function readWatchReplyLockHashState() {
  return globalThis.readWatchReplyLockHashStateModule?.() || null;
}

function syncWatchReplyLockHash(key = "", runId = "", loop = false) {
  globalThis.syncWatchReplyLockHashModule?.(key, runId, loop);
}

async function copyWatchReplyLockLink() {
  return (await globalThis.copyWatchReplyLockLinkModule?.()) ?? false;
}

function persistWatchReplyRegenerationDraft(windowEntry = null) {
  return globalThis.persistWatchReplyRegenerationDraftModule?.(windowEntry) || null;
}

function readWatchReplyRegenerationDraft() {
  return globalThis.readWatchReplyRegenerationDraftModule?.() || null;
}

function readWatchReplyRegenerationHistory() {
  return globalThis.readWatchReplyRegenerationHistoryModule?.() || [];
}

function writeWatchReplyRegenerationHistory(entries) {
  globalThis.writeWatchReplyRegenerationHistoryModule?.(entries);
}

function pushWatchReplyRegenerationHistoryEntry(action, draft) {
  return globalThis.pushWatchReplyRegenerationHistoryEntryModule?.(action, draft);
}

function updateWatchReplyRegenerationDraftControls(patch = {}) {
  return globalThis.updateWatchReplyRegenerationDraftControlsModule?.(patch) || null;
}

function resetWatchReplyRegenerationDraftControls() {
  return globalThis.resetWatchReplyRegenerationDraftControlsModule?.() || null;
}

function formatReplyDraftDelta(value) {
  return globalThis.formatReplyDraftDeltaModule?.(value) || "0.00";
}

function watchReplyDraftHasUnsavedControlChanges(draft) {
  return !!globalThis.watchReplyDraftHasUnsavedControlChangesModule?.(draft);
}

function clearWatchReplyRegenerationDraft() {
  return !!globalThis.clearWatchReplyRegenerationDraftModule?.();
}

function buildWatchReplyRegenerationPayload(draft) {
  return globalThis.buildWatchReplyRegenerationPayloadModule?.(draft) || null;
}

function normalizeWatchReplyRegenerationDraft(rawDraft) {
  return globalThis.normalizeWatchReplyRegenerationDraftModule?.(rawDraft) || null;
}

function importWatchReplyRegenerationDraft(rawDraft) {
  return globalThis.importWatchReplyRegenerationDraftModule?.(rawDraft) || null;
}

async function copyWatchReplyRegenerationNodeFetchStub(payload) {
  return (await globalThis.copyWatchReplyRegenerationNodeFetchStubModule?.(payload)) ?? false;
}

async function copyWatchReplyRegenerationRustReqwestStub(payload) {
  return (await globalThis.copyWatchReplyRegenerationRustReqwestStubModule?.(payload)) ?? false;
}

function exportWatchReplyRegenerationDraftFile(payload) {
  return globalThis.exportWatchReplyRegenerationDraftFileBridge?.(payload) ?? false;
}

function saveWatchReplyRegenerationDraftAsNewFile(draft) {
  return globalThis.saveWatchReplyRegenerationDraftAsNewFileBridge?.(draft) ?? false;
}

function createWatchReplyRegenerationDraft(windowEntry = null) {
  return globalThis.createWatchReplyRegenerationDraftBridge?.(windowEntry) ?? null;
}

function isReplyHarmonyWindowActive(windowEntry, currentTimeSec) {
  return globalThis.isReplyHarmonyWindowActiveBridge?.(windowEntry, currentTimeSec) ?? false;
}

function buildReplyHarmonyStructureSegments(windows, durationSec) {
  return globalThis.buildReplyHarmonyStructureSegmentsBridge?.(windows, durationSec) || [];
}

function isReplyHarmonyStructureSegmentActive(segmentEntry, currentTimeSec) {
  return globalThis.isReplyHarmonyStructureSegmentActiveBridge?.(segmentEntry, currentTimeSec) ?? false;
}

function activeReplyHarmonyWindowAtCurrentTime() {
  return globalThis.activeReplyHarmonyWindowAtCurrentTimeBridge?.() ?? null;
}

function syncWatchReplyHarmonyTokenOverlay() {
  globalThis.syncWatchReplyHarmonyTokenOverlayModule?.();
}

function setWatchReplyTokenOverride(windowEntry = null) {
  globalThis.setWatchReplyTokenOverrideModule?.(windowEntry);
}

function setWatchReplyLockedWindow(windowEntry = null) {
  globalThis.setWatchReplyLockedWindowModule?.(windowEntry);
}

function maybeRestoreWatchReplyLockedWindow() {
  return globalThis.maybeRestoreWatchReplyLockedWindowBridge?.() ?? false;
}

function jumpWatchAudioToReplyHarmonyWindow(windowEntry) {
  globalThis.jumpWatchAudioToReplyHarmonyWindowBridge?.(windowEntry);
}

function toggleWatchReplyWindowLoop(windowEntry = null) {
  globalThis.toggleWatchReplyWindowLoopBridge?.(windowEntry);
}

function enforceWatchReplyWindowLoop() {
  globalThis.enforceWatchReplyWindowLoopBridge?.();
}

function bindReplyHarmonyInteractiveFocus(target, windowEntry) {
  globalThis.bindReplyHarmonyInteractiveFocusBridge?.(target, windowEntry);
}

function maybeRefreshReplyHarmonyHighlight() {
  globalThis.maybeRefreshReplyHarmonyHighlightBridge?.();
}

async function maybeHydrateWatchMusicPlan(runId) {
  return (await globalThis.maybeHydrateWatchMusicPlanRuntime?.(runId)) ?? null;
}

function statusPayloadHasAudioCandidate(statusPayload, artifactPath) {
  return globalThis.statusPayloadHasAudioCandidateRuntime?.(statusPayload, artifactPath) ?? false;
}

function collectAudioArtifactCandidates(statusPayload) {
  return globalThis.collectAudioArtifactCandidatesRuntime?.(statusPayload) || [];
}

async function probeFinalAudioArtifact(runId, artifactPath) {
  return (await globalThis.probeFinalAudioArtifactRuntime?.(runId, artifactPath)) || "";
}

async function maybeAttachFinalAudioArtifact(runId, statusPayload, derivedMusic = {}) {
  return (await globalThis.maybeAttachFinalAudioArtifactRuntime?.(runId, statusPayload, derivedMusic)) ?? false;
}

async function attemptImmediateFinalAudioAttach(runId = "") {
  return (await globalThis.attemptImmediateFinalAudioAttachRuntime?.(runId)) ?? false;
}

function buildLocalVideoPreviewSvg(title, subtitle, options) {
  return globalThis.buildLocalVideoPreviewSvgModule?.(title, subtitle, options) || "";
}

function resetTypingState() {
  globalThis.resetTypingStateBridge?.();
}

function cycleLyricsState() {
  globalThis.cycleLyricsStateBridge?.();
}

function initLyricsControls() {
  globalThis.initLyricsControlsBridge?.();
}

function setEngineDetail(engine, detail) {
  globalThis.setEngineDetailBridge?.(engine, detail);
}

function setEngineState(engine, state) {
  globalThis.setEngineStateBridge?.(engine, state);
}

function cycleEngineState(engine) {
  globalThis.cycleEngineStateBridge?.(engine);
}

function initEngineControls() {
  globalThis.initEngineControlsBridge?.();
}

function resetEngineStates() {
  globalThis.resetEngineStatesBridge?.();
}

function animateProgress() {
  globalThis.animateProgressBridge?.();
}

function focusPanel(panel) {
  globalThis.focusPanelBridge?.(panel);
}

function openPanel(panel, options = {}) {
  globalThis.openPanelBridge?.(panel, options);
}

function currentUiLang() {
  return globalThis.currentUiLangBridge?.() || "en";
}

function dashboardCopy(en, zh) {
  return globalThis.dashboardCopyBridge?.(en, zh) ?? en;
}

function formatBlockedPublishMessage(detail, trace) {
  return globalThis.formatBlockedPublishMessageBridge?.(detail, trace) || "";
}

async function parseArrangementReleaseError(action, res) {
  return (await globalThis.parseArrangementReleaseErrorBridge?.(action, res)) || "";
}

function signedApproverRoles(trace) {
  return globalThis.signedApproverRolesBridge?.(trace) || [];
}

function missingRequiredSignerRoles(trace) {
  return globalThis.missingRequiredSignerRolesBridge?.(trace) || [];
}
