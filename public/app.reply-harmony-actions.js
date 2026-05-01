function exportWatchReplyRegenerationDraftFileModule(payload) {
  return globalThis.exportWatchReplyRegenerationDraftFileModule?.(payload) ?? false;
}

function saveWatchReplyRegenerationDraftAsNewFileModule(draft) {
  return globalThis.saveWatchReplyRegenerationDraftAsNewFileModule?.(draft) ?? false;
}

function createWatchReplyRegenerationDraftBridge(windowEntry = null) {
  return globalThis.createWatchReplyRegenerationDraftModule?.(windowEntry) ?? null;
}

window.exportWatchReplyRegenerationDraftFileBridge = exportWatchReplyRegenerationDraftFileModule;
window.saveWatchReplyRegenerationDraftAsNewFileBridge = saveWatchReplyRegenerationDraftAsNewFileModule;
window.createWatchReplyRegenerationDraftBridge = createWatchReplyRegenerationDraftBridge;
