function readLogoRingPresets() {
  return globalThis.readLogoRingPresetsModule ? globalThis.readLogoRingPresetsModule() : [];
}

function writeLogoRingPresets(items) {
  return globalThis.writeLogoRingPresetsModule?.(items);
}

function readPanelLayoutStore() {
  return globalThis.readPanelLayoutStoreModule ? globalThis.readPanelLayoutStoreModule() : {};
}

function writePanelLayoutStore(store) {
  return globalThis.writePanelLayoutStoreModule?.(store);
}

function getStoredPanelLayout(panelId) {
  return globalThis.getStoredPanelLayoutModule ? globalThis.getStoredPanelLayoutModule(panelId) : null;
}

function saveStoredPanelLayout(panelId, snapshot) {
  return globalThis.saveStoredPanelLayoutModule?.(panelId, snapshot);
}

function clearStoredPanelLayout(panelId) {
  return globalThis.clearStoredPanelLayoutModule?.(panelId);
}

function persistPanelLayout(panel) {
  return globalThis.persistPanelLayoutModule?.(panel);
}

function applyStoredPanelLayout(panel, layout = null) {
  return globalThis.applyStoredPanelLayoutModule ? globalThis.applyStoredPanelLayoutModule(panel, layout) : false;
}

function panelDefaultsApiKey(panelOrId) {
  return globalThis.panelDefaultsApiKeyModule ? globalThis.panelDefaultsApiKeyModule(panelOrId) : "";
}

function panelElementByDefaultKey(panelKey) {
  return globalThis.panelElementByDefaultKeyModule ? globalThis.panelElementByDefaultKeyModule(panelKey) : null;
}

function defaultPanelBehaviorSettings(...args) {
  return globalThis.defaultPanelBehaviorSettingsBridge?.(...args);
}

function sanitizePanelBehaviorSettings(...args) {
  return globalThis.sanitizePanelBehaviorSettingsBridge?.(...args);
}

function readPanelBehaviorSettingsLocal(...args) {
  return globalThis.readPanelBehaviorSettingsLocalBridge?.(...args);
}

function writePanelBehaviorSettingsLocal(...args) {
  return globalThis.writePanelBehaviorSettingsLocalBridge?.(...args);
}

function updatePanelBehaviorSettings(...args) {
  return globalThis.updatePanelBehaviorSettingsBridge?.(...args);
}

function applyPanelBehaviorSettings(...args) {
  return globalThis.applyPanelBehaviorSettingsBridge?.(...args);
}

async function loadPanelDefaults(...args) {
  return globalThis.loadPanelDefaultsBridge?.(...args);
}

async function savePanelDefaults(...args) {
  return globalThis.savePanelDefaultsBridge?.(...args);
}

async function hydrateBehaviorDefaultsFromServer(...args) {
  return globalThis.hydrateBehaviorDefaultsFromServerBridge?.(...args);
}

async function hydratePanelDefaultsFromServer(...args) {
  return globalThis.hydratePanelDefaultsFromServerBridge?.(...args);
}
