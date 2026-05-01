function readPanelDefaultStore() {
  return globalThis.readPanelDefaultStoreModule ? globalThis.readPanelDefaultStoreModule() : {};
}

function writePanelDefaultStore(store) {
  return globalThis.writePanelDefaultStoreModule?.(store);
}

function getStoredPanelDefaultSnapshot(panelId) {
  return globalThis.getStoredPanelDefaultSnapshotModule ? globalThis.getStoredPanelDefaultSnapshotModule(panelId) : null;
}

function savePanelDefaultSnapshot(panelId, snapshot) {
  return globalThis.savePanelDefaultSnapshotModule?.(panelId, snapshot);
}

async function uploadLogoMediaFile(...args) {
  return globalThis.uploadLogoMediaFileModule?.(...args);
}
