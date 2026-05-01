function timelineNodeTitle(node) {
  return globalThis.timelineNodeTitleBridge?.(node) || node?.title || t("cssmv.timeline.defaultTitle");
}

function timelineNodeBody(node) {
  return globalThis.timelineNodeBodyBridge?.(node) || node?.body || node?.summary || "";
}

function timelineNodeTimestamp(node) {
  return globalThis.timelineNodeTimestampBridge?.(node) || node?.created_at || node?.timestamp || "";
}

function renderTimelineNodes(payload) {
  return globalThis.renderTimelineNodesBridge?.(payload);
}

function renderMergedTimeline(payload) {
  return globalThis.renderMergedTimelineBridge?.(payload);
}

function renderTimelineExplain(payload) {
  return globalThis.renderTimelineExplainBridge?.(payload);
}

function extractWorkspace(payload) {
  return globalThis.extractWorkspaceBridge?.(payload) || payload?.workspace || null;
}

function escapeHtml(value) {
  return globalThis.escapeHtmlBridge?.(value) || "";
}

function extractAvailableActions(payload) {
  return globalThis.extractAvailableActionsBridge?.(payload) || [];
}

function extractRecentActionLogs(payload) {
  return globalThis.extractRecentActionLogsBridge?.(payload) || [];
}

function actionKindLabel(kind) {
  return globalThis.actionKindLabelBridge?.(kind) || t("cssmv.actions.waiting");
}

function cssmvActionScope(kind) {
  return globalThis.cssmvActionScopeBridge?.(kind) || "";
}

function renderAvailableActions(payload) {
  return globalThis.renderAvailableActionsBridge?.(payload);
}

function renderRecentActionLogs(payload) {
  return globalThis.renderRecentActionLogsBridge?.(payload);
}

function renderDeliveryGovernancePulse(payload = window.CSSMV_DELIVERY_INSPECTOR_PAYLOAD) {
  return globalThis.renderDeliveryGovernancePulseBridge?.(payload);
}

window.CSSOS_setDeliveryInspectorPayload = function setDeliveryInspectorPayload(payload) {
  return globalThis.setDeliveryInspectorPayloadBridge?.(payload);
};

globalThis.loadDeliveryExportHistory?.();
globalThis.renderDeliveryReportsPanelModule?.();

function updateEnginePanels(title, lines) {
  return globalThis.updateEnginePanelsBridge?.(title, lines);
}

async function runLyricsGenerate(mode, options = {}) {
  return globalThis.runLyricsGenerateBridge?.(mode, options);
}

const PASSKEY_BASE = globalThis.PASSKEY_BASE || "";
globalThis.PASSKEY_BASE = PASSKEY_BASE;
if (typeof globalThis.HOLD_MAX_MS !== "number") {
  globalThis.HOLD_MAX_MS = Number(window.CSS_HOLD_MAX_MS || 30000);
}
globalThis.__cssosMicHold = globalThis.__cssosMicHold || {
  active: false,
  startedAt: 0,
  raf: 0,
  timeout: 0,
  startTimer: 0,
  pointerId: null,
  lastCommittedAt: 0,
  suppressClickUntil: 0
};

function setHintKey(key) {
  return globalThis.setHintKeyBridge?.(key);
}

function passkeySupported() {
  return !!globalThis.passkeySupportedBridge?.();
}

function b64urlToBuf(s) {
  return globalThis.b64urlToBufBridge?.(s);
}

function bufToB64url(buf) {
  return globalThis.bufToB64urlBridge?.(buf) || "";
}

function normalizePublicKeyOptions(pk) {
  return globalThis.normalizePublicKeyOptionsBridge?.(pk) || {};
}

function credentialToJSON(cred) {
  return globalThis.credentialToJSONBridge?.(cred) || {};
}

async function passkeyEnable() {
  return globalThis.passkeyEnableBridge?.();
}

async function passkeyLogin() {
  return globalThis.passkeyLoginBridge?.();
}

function apiBase() {
  return globalThis.apiBaseBridge?.() || "";
}

function resolvePublicAssetUrl(path) {
  return globalThis.resolvePublicAssetUrlBridge?.(path) || "";
}

async function createRun({ title, uiLang, tier, voice, lyricsText = "", jobId = "" }) {
  return globalThis.createRunBridge?.({ title, uiLang, tier, voice, lyricsText, jobId }) || {};
}

function getVoiceSeedModuleFn(name) {
  return globalThis.getVoiceSeedModuleFnBridge?.(name) || null;
}

function normalizeSongCreationPayload(payload = {}) {
  return globalThis.normalizeSongCreationPayloadModule?.(payload) || {};
}

globalThis.normalizeSongCreationPayload =
  globalThis.normalizeSongCreationPayload || normalizeSongCreationPayload;

async function submitVoiceOrFallbackTitle(blobOrNull) {
  return globalThis.submitVoiceOrFallbackTitleModule?.(blobOrNull);
}

globalThis.submitVoiceOrFallbackTitle = globalThis.submitVoiceOrFallbackTitle || submitVoiceOrFallbackTitle;

function bindHoldTargets() {
  return globalThis.bindHoldTargetsBridge?.();
}

function renderMicCaptureStatus() {
  return globalThis.renderMicCaptureStatusBridge?.();
}

function forceResetHoldRing() {
  return globalThis.forceResetHoldRingBridge?.();
}

function setLongpressGuard(on) {
  return globalThis.setLongpressGuardBridge?.(on);
}

function buildMicDebugBoardMarkup(micSettings) {
  return globalThis.buildMicDebugBoardMarkupBridge?.(micSettings) || "";
}

globalThis.bindHoldTargets = globalThis.bindHoldTargets || bindHoldTargets;
globalThis.renderMicCaptureStatus = globalThis.renderMicCaptureStatus || renderMicCaptureStatus;
globalThis.forceResetHoldRing = globalThis.forceResetHoldRing || forceResetHoldRing;
globalThis.setLongpressGuard = globalThis.setLongpressGuard || setLongpressGuard;
globalThis.buildMicDebugBoardMarkup =
  globalThis.buildMicDebugBoardMarkup || buildMicDebugBoardMarkup;

globalThis.bindCriticalStageInteractionsImmediately?.();

function attachPanelDrag() {
  globalThis.attachPanelDragBridge?.();
}

function attachPanelBarActions() {
  globalThis.attachPanelBarActionsBridge?.();
}

function attachResize() {
  globalThis.attachResizeBridge?.();
}

function attachPanelFocus() {
  globalThis.attachPanelFocusBridge?.();
}

function attachLogoPanelActions() {
  globalThis.attachLogoPanelActionsBridge?.();
}

function normalizeStaticMediaAssets() {
  globalThis.normalizeStaticMediaAssetsBridge?.();
}

function minimizeToDock(panel) {
  globalThis.minimizeToDockBridge?.(panel);
}

function togglePanelLock(panel) {
  globalThis.togglePanelLockBridge?.(panel);
}

function togglePanelCollapse(panel) {
  globalThis.togglePanelCollapseBridge?.(panel);
}

function buildPanelSettings(panel) {
  globalThis.buildPanelSettingsBridge?.(panel);
}

function syncPanelSettingVisibility(panel, settings = panel?.querySelector?.(".panel-settings")) {
  return globalThis.syncPanelSettingVisibilityModule?.(panel, settings);
}

function togglePanelSettings(panel, force) {
  return globalThis.togglePanelSettingsModule?.(panel, force) || false;
}

function openPanelSettings(panel) {
  return globalThis.openPanelSettingsModule?.(panel) || false;
}

function initPanelSettings() {
  return globalThis.initPanelSettingsModule?.();
}

function attachPanelActions() {
  return globalThis.attachPanelActionsModule?.();
}

globalThis.syncPanelSettingVisibility = globalThis.syncPanelSettingVisibility || syncPanelSettingVisibility;
globalThis.togglePanelSettings = globalThis.togglePanelSettings || togglePanelSettings;
globalThis.openPanelSettings = globalThis.openPanelSettings || openPanelSettings;
globalThis.initPanelSettings = globalThis.initPanelSettings || initPanelSettings;
globalThis.attachPanelActions = globalThis.attachPanelActions || attachPanelActions;
