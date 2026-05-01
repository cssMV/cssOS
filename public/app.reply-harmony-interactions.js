function jumpWatchAudioToReplyHarmonyWindowBridge(windowEntry) {
  globalThis.jumpWatchAudioToReplyHarmonyWindowModule?.(windowEntry);
}

function toggleWatchReplyWindowLoopBridge(windowEntry = null) {
  globalThis.toggleWatchReplyWindowLoopModule?.(windowEntry);
}

function enforceWatchReplyWindowLoopBridge() {
  globalThis.enforceWatchReplyWindowLoopModule?.();
}

function bindReplyHarmonyInteractiveFocusBridge(target, windowEntry) {
  globalThis.bindReplyHarmonyInteractiveFocusModule?.(target, windowEntry);
}

function maybeRefreshReplyHarmonyHighlightBridge() {
  globalThis.maybeRefreshReplyHarmonyHighlightModule?.();
}

window.jumpWatchAudioToReplyHarmonyWindowBridge = jumpWatchAudioToReplyHarmonyWindowBridge;
window.toggleWatchReplyWindowLoopBridge = toggleWatchReplyWindowLoopBridge;
window.enforceWatchReplyWindowLoopBridge = enforceWatchReplyWindowLoopBridge;
window.bindReplyHarmonyInteractiveFocusBridge = bindReplyHarmonyInteractiveFocusBridge;
window.maybeRefreshReplyHarmonyHighlightBridge = maybeRefreshReplyHarmonyHighlightBridge;
