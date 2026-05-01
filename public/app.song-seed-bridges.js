function readSongSeedUiModuleBridge(name, fallback, ...args) {
  const fn = globalThis[name];
  return typeof fn === "function" ? fn(...args) : fallback;
}

function callSongSeedUiModuleBridge(name, ...args) {
  readSongSeedUiModuleBridge(name, undefined, ...args);
}

function setButtonBusyBridge(button, busy) {
  callSongSeedUiModuleBridge("setButtonBusyModule", button, busy);
}

function setLyricsDebugStatusBridge(message, state = "idle") {
  callSongSeedUiModuleBridge("setLyricsDebugStatusModule", message, state);
}

function runNonCriticalUiStepBridge(task) {
  return readSongSeedUiModuleBridge("runNonCriticalUiStepModule", false, task);
}

function safeShowToastBridge(message) {
  return readSongSeedUiModuleBridge("safeShowToastModule", false, message);
}

function summarizeErrorBridge(err) {
  return readSongSeedUiModuleBridge("summarizeErrorModule", "unknown", err);
}

function getSeedRefreshToastBridge(target) {
  return readSongSeedUiModuleBridge(
    "getSeedRefreshToastModule",
    loginCopy("Magic in progress..."),
    target
  );
}

function bindSeedRefreshButtonBridge(button, target, options = {}) {
  callSongSeedUiModuleBridge("bindSeedRefreshButtonModule", button, target, options);
}

function getSongSeedTitleContextBridge() {
  return readSongSeedUiModuleBridge("getSongSeedTitleContextModule", "");
}

function setSongSeedTitleValueBridge(value, options = {}) {
  return readSongSeedUiModuleBridge("setSongSeedTitleValueModule", "", value, options);
}

function shouldPreserveSongSeedTitleForRefreshBridge() {
  return readSongSeedUiModuleBridge("shouldPreserveSongSeedTitleForRefreshModule", false);
}

function buildFallbackSongSeedTitleBridge() {
  return readSongSeedUiModuleBridge("buildFallbackSongSeedTitleModule", "improvisation theme");
}

function ensureSongSeedTitleContextBridge() {
  return readSongSeedUiModuleBridge("ensureSongSeedTitleContextModule", "");
}

function safeBuildLyricsSeedVisualSignatureBridge(seed) {
  return readSongSeedUiModuleBridge("safeBuildLyricsSeedVisualSignatureModule", "", seed);
}

function regenerateSeedFieldsBridge(target) {
  return readSongSeedUiModuleBridge("regenerateSeedFieldsModule", Promise.resolve(), target);
}

function getApiDataBridge(payload) {
  return readSongSeedUiModuleBridge("getApiDataModule", {}, payload);
}

window.readSongSeedUiModuleBridge = readSongSeedUiModuleBridge;
window.callSongSeedUiModuleBridge = callSongSeedUiModuleBridge;
window.setButtonBusyBridge = setButtonBusyBridge;
window.setLyricsDebugStatusBridge = setLyricsDebugStatusBridge;
window.runNonCriticalUiStepBridge = runNonCriticalUiStepBridge;
window.safeShowToastBridge = safeShowToastBridge;
window.summarizeErrorBridge = summarizeErrorBridge;
window.getSeedRefreshToastBridge = getSeedRefreshToastBridge;
window.bindSeedRefreshButtonBridge = bindSeedRefreshButtonBridge;
window.getSongSeedTitleContextBridge = getSongSeedTitleContextBridge;
window.setSongSeedTitleValueBridge = setSongSeedTitleValueBridge;
window.shouldPreserveSongSeedTitleForRefreshBridge = shouldPreserveSongSeedTitleForRefreshBridge;
window.buildFallbackSongSeedTitleBridge = buildFallbackSongSeedTitleBridge;
window.ensureSongSeedTitleContextBridge = ensureSongSeedTitleContextBridge;
window.safeBuildLyricsSeedVisualSignatureBridge = safeBuildLyricsSeedVisualSignatureBridge;
window.regenerateSeedFieldsBridge = regenerateSeedFieldsBridge;
window.getApiDataBridge = getApiDataBridge;
