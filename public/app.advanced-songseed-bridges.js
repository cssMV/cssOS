function buildAdvancedPanelSettingsMarkup(settings) {
  return globalThis.buildAdvancedPanelSettingsMarkupBridge?.(settings) || "";
}

function buildDeferredAdvancedMembershipMarkup() {
  return globalThis.buildDeferredAdvancedMembershipMarkupBridge?.() || "";
}

function buildDeferredAdvancedPermissionMarkup() {
  return globalThis.buildDeferredAdvancedPermissionMarkupBridge?.() || "";
}

function stripAdvancedHeavyMarkup(markup, admin) {
  return globalThis.stripAdvancedHeavyMarkupBridge?.(markup, admin) || "";
}

function collectAdvancedPanelSettingsFromDom() {
  return globalThis.collectAdvancedPanelSettingsFromDomBridge?.() || readPanelBehaviorSettingsLocal();
}

let advancedPanelSettingsHeavyFrame = 0;

async function renderAdvancedPanelSettings(options = {}) {
  return globalThis.renderAdvancedPanelSettingsBridge?.(options);
}

function randomizeCreationForLyricsRefresh(title) {
  return globalThis.randomizeCreationForLyricsRefreshModule?.(title);
}

function readSongSeedUiModule(name, fallback, ...args) {
  return globalThis.readSongSeedUiModuleBridge?.(name, fallback, ...args);
}

function callSongSeedUiModule(name, ...args) {
  globalThis.callSongSeedUiModuleBridge?.(name, ...args);
}
