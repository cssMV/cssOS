async function maybeHydrateWatchMusicPlanRuntime(runId) {
  return (await globalThis.maybeHydrateWatchMusicPlanBridge?.(runId)) ?? null;
}

function statusPayloadHasAudioCandidateRuntime(statusPayload, artifactPath) {
  return globalThis.statusPayloadHasAudioCandidateBridge?.(statusPayload, artifactPath) ?? false;
}

function collectAudioArtifactCandidatesRuntime(statusPayload) {
  return globalThis.collectAudioArtifactCandidatesBridge?.(statusPayload) || [];
}

async function probeFinalAudioArtifactRuntime(runId, artifactPath) {
  return (await globalThis.probeFinalAudioArtifactBridge?.(runId, artifactPath)) || "";
}

async function maybeAttachFinalAudioArtifactRuntime(runId, statusPayload, derivedMusic = {}) {
  return (await globalThis.maybeAttachFinalAudioArtifactBridge?.(runId, statusPayload, derivedMusic)) ?? false;
}

async function attemptImmediateFinalAudioAttachRuntime(runId = "") {
  return (await globalThis.attemptImmediateFinalAudioAttachBridge?.(runId)) ?? false;
}

window.maybeHydrateWatchMusicPlanRuntime = maybeHydrateWatchMusicPlanRuntime;
window.statusPayloadHasAudioCandidateRuntime = statusPayloadHasAudioCandidateRuntime;
window.collectAudioArtifactCandidatesRuntime = collectAudioArtifactCandidatesRuntime;
window.probeFinalAudioArtifactRuntime = probeFinalAudioArtifactRuntime;
window.maybeAttachFinalAudioArtifactRuntime = maybeAttachFinalAudioArtifactRuntime;
window.attemptImmediateFinalAudioAttachRuntime = attemptImmediateFinalAudioAttachRuntime;
