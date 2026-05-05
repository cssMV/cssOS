function statusPayloadHasAudioCandidateModule(statusPayload, artifactPath) {
  const safePath = String(artifactPath || "").trim();
  if (!safePath) return false;
  const artifacts = Array.isArray(statusPayload?.artifacts) ? statusPayload.artifacts : [];
  return artifacts.some((entry) => {
    const entryPath = String(entry?.path || "").trim();
    const mime = String(entry?.mime || "").trim().toLowerCase();
    return entryPath === safePath && (!mime || mime.includes("audio"));
  });
}

function collectAudioArtifactCandidatesModule(statusPayload) {
  const ranked = [];
  const isLossyAudioPath = (path) => /\.(mp3|m4a|aac|ogg)$/i.test(String(path || "").trim());
  const pushCandidate = (path, rank) => {
    const safePath = String(path || "").trim();
    if (!safePath || ranked.some((entry) => entry.path === safePath)) return;
    ranked.push({ path: safePath, rank });
  };
  const artifacts = Array.isArray(statusPayload?.artifacts) ? statusPayload.artifacts : [];
  artifacts.forEach((entry) => {
    const path = String(entry?.path || "").trim();
    const mime = String(entry?.mime || "").trim().toLowerCase();
    if (!path || (mime && !mime.includes("audio"))) return;
    if (!isLossyAudioPath(path)) return;
    const lower = path.toLowerCase();
    if (lower.endsWith("master.mp3")) pushCandidate(path, 120);
    else if (lower.endsWith("mix.mp3")) pushCandidate(path, 110);
    else if (lower.endsWith("vocals.mp3")) pushCandidate(path, 100);
    else if (lower.endsWith("music.mp3")) pushCandidate(path, 90);
    else pushCandidate(path, 10);
  });
  [
    ["./build/master.mp3", 120],
    ["./build/mix.mp3", 110],
    ["./build/vocals.mp3", 100],
    ["./build/music.mp3", 90],
    ["./build/vocals/vocal_master.mp3", 40]
  ].forEach(([path, rank]) => pushCandidate(path, rank));
  return ranked.sort((a, b) => b.rank - a.rank);
}

async function probeFinalAudioArtifactModule(runId, artifactPath) {
  // CSSOS_PHASE2_NO_ARTIFACT_PROBE 20260504 — Jing
  // "控制台报错". The 1-byte Range probe fired a real GET that the
  // browser logged as 404 in the network panel whenever the artifact
  // wasn't ready yet. Even with .catch the red line still painted.
  // Skip the probe entirely; only adopt artifact URLs that the
  // statusPayload explicitly advertises (handled in the caller —
  // statusPayloadHasAudioCandidateModule branch wins). This means we
  // wait one extra polling tick to discover a finished artifact, but
  // the trade is a clean console for the user.
  return "";
}

async function maybeAttachFinalAudioArtifactModule(runId, statusPayload, derivedMusic = {}) {
  const safeRunId = String(runId || "").trim();
  if (!safeRunId || !watchAudioPreview) return false;
  // CSSOS_PHASE2_MV_PIPELINE_OWNS_AUDIO 20260426 #141 — Jing
  // "Failed to load resource: ... music-delivery-artifact ... 404 (Not Found)"
  // After MV Pipeline owns the final mp3, the legacy creative-engine still
  // probes /cssapi/v1/runs/<runId>/music-delivery-artifact?path=./build/...
  // which 404s 5–10× per stage and floods console. If
  // cssmvPipelineLastResult is fresh AND its audio is already playing in
  // <audio>, bail before firing a single probe.
  try {
    const lastRes = globalThis.cssmvPipelineLastResult;
    if (lastRes && lastRes.audioUrl) {
      const tsAt = Number(lastRes.tsAt || 0);
      const freshMs = Number(lastRes.freshMs || 600000);
      if (tsAt && (Date.now() - tsAt) < freshMs) {
        const curSrc = String(watchAudioPreview.src || "").trim();
        if (curSrc === lastRes.audioUrl || curSrc.endsWith(lastRes.audioUrl)) {
          // MV Pipeline audio is already on the element; legacy probes are
          // pure noise from this point on.
          return true;
        }
      }
    }
    // CSSOS_PHASE2_MV_PIPELINE_RUNNING_GUARD 20260504 — Jing
    // "Failed to load resource ... build/master.mp3 / mix.mp3 / vocals.mp3
    //  / music.mp3" — same 404 storm as #141, but during a run that hasn't
    // committed yet. cssmvPipelineLastResult is still null, so the guard
    // above doesn't fire. If MV Pipeline has any active stage running,
    // it owns this run's audio outcome — skip the legacy /build/* probes
    // entirely until the pipeline either commits or cleanly errors.
    if (typeof globalThis.cssmvPipelineActiveStage === "function") {
      const live = globalThis.cssmvPipelineActiveStage();
      if (live && !live.finished && !live.hasError) {
        return true; // pipeline is in flight; leave audio alone
      }
    }
  } catch (_e) { /* fall through */ }
  const candidates = collectAudioArtifactCandidatesModule(statusPayload);
  const progressPct = Number(derivedMusic?.progress || 0);
  const mixDone = pipelineStageState(statusPayload?.stages?.mix?.status) === "done";
  const vocalsDone = pipelineStageState(statusPayload?.stages?.vocals?.status) === "done";
  const musicDone = pipelineStageState(statusPayload?.stages?.music?.status) === "done";
  const masterDone = pipelineStageState(statusPayload?.stages?.master?.status) === "done";
  const readyEnough =
    progressPct >= 100 ||
    masterDone ||
    (mixDone && vocalsDone) ||
    (mixDone && musicDone);
  if (!readyEnough) return false;
  if (!candidates.length) return false;
  for (const candidate of candidates) {
    const cacheKey = `${safeRunId}:${candidate.path}`;
    if (attemptedFinalAudioArtifacts.get(cacheKey) === "missing") continue;
    const directUrl = finalAudioArtifactUrl(safeRunId, candidate.path);
    const url = statusPayloadHasAudioCandidateModule(statusPayload, candidate.path)
      ? directUrl
      : await probeFinalAudioArtifactModule(safeRunId, candidate.path);
    if (!url) {
      attemptedFinalAudioArtifacts.set(cacheKey, "missing");
      continue;
    }
    if (
      currentWatchAudioSourceKind === "final-artifact" &&
      currentWatchAudioRunId === safeRunId &&
      currentWatchAudioArtifactPath === candidate.path &&
      watchAudioPreview.src === url
    ) {
      return true;
    }
    const preservePlayback = !!(!watchAudioPreview.paused && !watchAudioPreview.ended);
    // CSSOS_PHASE2_NO_SWAP_MUTE 20260505 — Jing
    // "播放了几秒就自动静音". The hot-swap path used to set
    // muted=true to avoid a pop on src change, but never unmuted —
    // so when the polling loop swapped in the final artifact a few
    // seconds into playback, the song went silent. Modern browsers
    // handle src swap cleanly without mute; preserve the prior mute
    // state instead of forcing true.
    const __wasMuted = !!watchAudioPreview.muted;
    watchAudioPreview.autoplay = true;
    watchAudioPreview.playsInline = true;
    watchAudioPreview.loop = false;
    watchAudioPreview.muted = __wasMuted;
    watchAudioPreview.volume = 1;
    watchAudioPreview.src = url;
    watchAudioPreview.style.display = "block";
    watchAudioPreview.load?.();
    currentWatchAudioSourceKind = "final-artifact";
    currentWatchAudioRunId = safeRunId;
    currentWatchAudioArtifactPath = candidate.path;
    rememberWatchFinalAudio(safeRunId, candidate.path, url);
    updateWatchAudioDebug();
    syncWatchAudioPresentation();
    if (preservePlayback || watchAudioAutoplayArmed) {
      readWatchUiModule("openWatchMusicPlaybackSurfaceModule", false, { autoplay: true });
    } else {
      readWatchUiModule("openWatchMusicPlaybackSurfaceModule", false);
    }
    return true;
  }
  return false;
}

async function attemptImmediateFinalAudioAttachModule(runId = "") {
  const safeRunId = String(
    runId ||
      currentWatchAudioRunId ||
      pendingFinalAudioRunId ||
      activePipelineRunId ||
      currentWatchPreviewWork?.source_run_id ||
      ""
  ).trim();
  if (!safeRunId) {
    updateWatchAudioDebug();
    return false;
  }
  const statePath = pipelineRunStatePath(safeRunId);
  if (!statePath) {
    updateWatchAudioDebug();
    return false;
  }
  try {
    const res = await fetch(`/api/pipeline/status?path=${encodeURIComponent(statePath)}`);
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload) {
      updateWatchAudioDebug();
      return false;
    }
    const derived = derivePipelineProgress(payload);
    const readyEnough =
      Number(derived?.music?.progress || 0) >= 100 ||
      pipelineStageState(payload?.stages?.master?.status) === "done" ||
      (pipelineStageState(payload?.stages?.mix?.status) === "done" &&
        pipelineStageState(payload?.stages?.vocals?.status) === "done") ||
      (pipelineStageState(payload?.stages?.mix?.status) === "done" &&
        pipelineStageState(payload?.stages?.music?.status) === "done");
    if (!readyEnough) {
      updateWatchAudioDebug();
      return false;
    }
    return await maybeAttachFinalAudioArtifactModule(safeRunId, payload, derived.music);
  } catch (_err) {
    updateWatchAudioDebug();
    return false;
  }
}

window.statusPayloadHasAudioCandidateModule = statusPayloadHasAudioCandidateModule;
window.collectAudioArtifactCandidatesModule = collectAudioArtifactCandidatesModule;
window.probeFinalAudioArtifactModule = probeFinalAudioArtifactModule;
window.maybeAttachFinalAudioArtifactModule = maybeAttachFinalAudioArtifactModule;
window.attemptImmediateFinalAudioAttachModule = attemptImmediateFinalAudioAttachModule;
