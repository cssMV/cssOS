function readLogoRingPresetsModule() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOGO_RING_PRESETS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function writeLogoRingPresetsModule(items) {
  try {
    localStorage.setItem(LOGO_RING_PRESETS_KEY, JSON.stringify(Array.isArray(items) ? items.slice(0, 8) : []));
  } catch {
    // ignore
  }
}

function defaultPanelBehaviorSettingsBridge(...args) {
  return globalThis.defaultPanelBehaviorSettings?.__moduleImpl
    ? globalThis.defaultPanelBehaviorSettings.__moduleImpl(...args)
    : globalThis.__panelBehaviorCore?.defaultPanelBehaviorSettings?.(...args);
}

function sanitizePanelBehaviorSettingsBridge(...args) {
  return globalThis.sanitizePanelBehaviorSettings?.__moduleImpl
    ? globalThis.sanitizePanelBehaviorSettings.__moduleImpl(...args)
    : globalThis.__panelBehaviorCore?.sanitizePanelBehaviorSettings?.(...args);
}

function readPanelBehaviorSettingsLocalBridge(...args) {
  return globalThis.readPanelBehaviorSettingsLocal?.__moduleImpl
    ? globalThis.readPanelBehaviorSettingsLocal.__moduleImpl(...args)
    : globalThis.__panelBehaviorCore?.readPanelBehaviorSettingsLocal?.(...args);
}

function writePanelBehaviorSettingsLocalBridge(...args) {
  return globalThis.writePanelBehaviorSettingsLocal?.__moduleImpl
    ? globalThis.writePanelBehaviorSettingsLocal.__moduleImpl(...args)
    : globalThis.__panelBehaviorCore?.writePanelBehaviorSettingsLocal?.(...args);
}

function updatePanelBehaviorSettingsBridge(...args) {
  return globalThis.updatePanelBehaviorSettings?.__moduleImpl
    ? globalThis.updatePanelBehaviorSettings.__moduleImpl(...args)
    : globalThis.__panelBehaviorCore?.updatePanelBehaviorSettings?.(...args);
}

function applyPanelBehaviorSettingsBridge(...args) {
  return globalThis.applyPanelBehaviorSettings?.__moduleImpl
    ? globalThis.applyPanelBehaviorSettings.__moduleImpl(...args)
    : globalThis.__panelBehaviorCore?.applyPanelBehaviorSettings?.(...args);
}

async function loadPanelDefaultsBridge(...args) {
  return globalThis.loadPanelDefaults?.__moduleImpl
    ? globalThis.loadPanelDefaults.__moduleImpl(...args)
    : globalThis.__panelBehaviorCore?.loadPanelDefaults?.(...args);
}

async function savePanelDefaultsBridge(...args) {
  return globalThis.savePanelDefaults?.__moduleImpl
    ? globalThis.savePanelDefaults.__moduleImpl(...args)
    : globalThis.__panelBehaviorCore?.savePanelDefaults?.(...args);
}

async function hydrateBehaviorDefaultsFromServerBridge(...args) {
  return globalThis.hydrateBehaviorDefaultsFromServer?.__moduleImpl
    ? globalThis.hydrateBehaviorDefaultsFromServer.__moduleImpl(...args)
    : globalThis.__panelBehaviorCore?.hydrateBehaviorDefaultsFromServer?.(...args);
}

async function hydratePanelDefaultsFromServerBridge(...args) {
  return globalThis.hydratePanelDefaultsFromServer?.__moduleImpl
    ? globalThis.hydratePanelDefaultsFromServer.__moduleImpl(...args)
    : globalThis.__panelBehaviorCore?.hydratePanelDefaultsFromServer?.(...args);
}

Object.assign(globalThis, {
  readLogoRingPresetsModule,
  writeLogoRingPresetsModule,
  defaultPanelBehaviorSettingsBridge,
  sanitizePanelBehaviorSettingsBridge,
  readPanelBehaviorSettingsLocalBridge,
  writePanelBehaviorSettingsLocalBridge,
  updatePanelBehaviorSettingsBridge,
  applyPanelBehaviorSettingsBridge,
  loadPanelDefaultsBridge,
  savePanelDefaultsBridge,
  hydrateBehaviorDefaultsFromServerBridge,
  hydratePanelDefaultsFromServerBridge
});
