async function maybeHydrateWatchMusicPlanBridge(runId) {
  return (await globalThis.maybeHydrateWatchMusicPlanModule?.(runId)) ?? null;
}

function statusPayloadHasAudioCandidateBridge(statusPayload, artifactPath) {
  return globalThis.statusPayloadHasAudioCandidateModule?.(statusPayload, artifactPath) ?? false;
}

function collectAudioArtifactCandidatesBridge(statusPayload) {
  return globalThis.collectAudioArtifactCandidatesModule?.(statusPayload) || [];
}

async function probeFinalAudioArtifactBridge(runId, artifactPath) {
  return (await globalThis.probeFinalAudioArtifactModule?.(runId, artifactPath)) || "";
}

async function maybeAttachFinalAudioArtifactBridge(runId, statusPayload, derivedMusic = {}) {
  return (await globalThis.maybeAttachFinalAudioArtifactModule?.(runId, statusPayload, derivedMusic)) ?? false;
}

async function attemptImmediateFinalAudioAttachBridge(runId = "") {
  return (await globalThis.attemptImmediateFinalAudioAttachModule?.(runId)) ?? false;
}

window.maybeHydrateWatchMusicPlanBridge = maybeHydrateWatchMusicPlanBridge;
window.statusPayloadHasAudioCandidateBridge = statusPayloadHasAudioCandidateBridge;
window.collectAudioArtifactCandidatesBridge = collectAudioArtifactCandidatesBridge;
window.probeFinalAudioArtifactBridge = probeFinalAudioArtifactBridge;
window.maybeAttachFinalAudioArtifactBridge = maybeAttachFinalAudioArtifactBridge;
window.attemptImmediateFinalAudioAttachBridge = attemptImmediateFinalAudioAttachBridge;
