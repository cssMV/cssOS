function maybeRestoreWatchReplyLockedWindowBridge() {
  return globalThis.maybeRestoreWatchReplyLockedWindowModule?.() ?? false;
}

window.maybeRestoreWatchReplyLockedWindowBridge = maybeRestoreWatchReplyLockedWindowBridge;
