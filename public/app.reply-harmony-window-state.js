function isReplyHarmonyWindowActiveBridge(windowEntry, currentTimeSec) {
  return globalThis.isReplyHarmonyWindowActiveModule?.(windowEntry, currentTimeSec) ?? false;
}

function buildReplyHarmonyStructureSegmentsBridge(windows, durationSec) {
  return globalThis.buildReplyHarmonyStructureSegmentsModule?.(windows, durationSec) || [];
}

function isReplyHarmonyStructureSegmentActiveBridge(segmentEntry, currentTimeSec) {
  return globalThis.isReplyHarmonyStructureSegmentActiveModule?.(segmentEntry, currentTimeSec) ?? false;
}

function activeReplyHarmonyWindowAtCurrentTimeBridge() {
  return globalThis.activeReplyHarmonyWindowAtCurrentTimeModule?.() ?? null;
}

window.isReplyHarmonyWindowActiveBridge = isReplyHarmonyWindowActiveBridge;
window.buildReplyHarmonyStructureSegmentsBridge = buildReplyHarmonyStructureSegmentsBridge;
window.isReplyHarmonyStructureSegmentActiveBridge = isReplyHarmonyStructureSegmentActiveBridge;
window.activeReplyHarmonyWindowAtCurrentTimeBridge = activeReplyHarmonyWindowAtCurrentTimeBridge;
