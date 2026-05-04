function narrativeToneFromCreativeStageModule(stage) {
  const normalized = String(stage || "").trim().toLowerCase();
  if (normalized === "callback") return "callback";
  if (normalized === "chorus") return "group";
  return "opening";
}

function syncNarrativeToneModule(tone) {
  const safeTone = ["opening", "lead", "group", "callback"].includes(String(tone || "").trim())
    ? String(tone || "").trim()
    : "opening";
  globalThis.watchNarrativeTone = safeTone;
  if (watchSubtitle) {
    watchSubtitle.classList.remove("tone-opening", "tone-lead", "tone-group", "tone-callback");
    watchSubtitle.classList.add(`tone-${safeTone}`);
  }
  syncWatchEngineGrid();
  syncWatchProgressRotatorModule?.();
}

function humanizeCreativeStageModule(engine, stage, artifactDetail = "") {
  const rawStage = String(stage || "").trim();
  const normalized = rawStage.toLowerCase();
  const detail = String(artifactDetail || "").trim();
  let friendly = rawStage;
  if (engine === "music") {
    if (!normalized || /queue|pending|wait/.test(normalized)) {
      friendly = loginCopy("listening for the song's first heartbeat");
    } else if (/seed|draft|compose|write|melody|hook|chorus/.test(normalized)) {
      friendly = loginCopy("catching the hook and teaching it to return");
    } else if (/arrange|instrument|orchestr|harmon|beat|tempo/.test(normalized)) {
      friendly = loginCopy("building the lift under the chorus");
    } else if (/mix|master|render|audio|bounce|print/.test(normalized)) {
      friendly = loginCopy("letting the mix bloom into a full song");
    } else if (/done|ready|complete|finish/.test(normalized)) {
      friendly = loginCopy("song shape locked");
    }
  } else if (engine === "video") {
    if (!normalized || /queue|pending|wait/.test(normalized)) {
      friendly = loginCopy("holding on the first frame before the world appears");
    } else if (/story|script|scene|plan|board|shotlist/.test(normalized)) {
      friendly = loginCopy("turning lyrics into scenes and entrances");
    } else if (/render|shot|frame|camera|motion|animate/.test(normalized)) {
      friendly = loginCopy("staging light, bodies, and camera motion");
    } else if (/callback|outro|ending|close|final/.test(normalized)) {
      friendly = loginCopy("setting the return shot for the ending");
    } else if (/done|ready|complete|finish/.test(normalized)) {
      friendly = loginCopy("visual arc locked");
    }
  } else if (engine === "kara") {
    if (!normalized || /queue|pending|wait/.test(normalized)) {
      friendly = loginCopy("waiting for the chorus to ask for light");
    } else if (/lyric|sync|align|subtitle|timing|word/.test(normalized)) {
      friendly = loginCopy("teaching each line when to glow on beat");
    } else if (/mux|burn|compose|encode|export|render/.test(normalized)) {
      friendly = loginCopy("pressing the performance into one karaoke cut");
    } else if (/done|ready|complete|finish/.test(normalized)) {
      friendly = loginCopy("karaoke timing locked");
    }
  }
  return [friendly, detail].filter(Boolean).join(" · ");
}

function creativeStageFromSegmentSemanticsModule(statusPayload, derived) {
  const video = statusPayload?.video || {};
  const music = statusPayload?.music || {};
  const kara = statusPayload?.kara || {};
  const relationshipArc = String(
    video.current_relationship_arc ||
      kara.current_relationship_arc ||
      music.current_relationship_arc ||
      ""
  )
    .trim()
    .toLowerCase();
  const motifCallback = String(
    video.current_motif_callback ||
      kara.current_motif_callback ||
      music.current_motif_callback ||
      ""
  )
    .trim()
    .toLowerCase();
  if (/direct|callback|response|recall|return|closing/.test(motifCallback)) {
    return "callback";
  }
  if (/equals_to_lead|scatter_to_center|center_release|gather|lead|duo|group|cluster/.test(relationshipArc)) {
    return "chorus";
  }
  if (/solo|hold|opening|forward/.test(relationshipArc)) {
    return "opening";
  }
  if ((derived?.kara?.progress || 0) > 0) return "callback";
  if ((derived?.video?.progress || 0) > 0) return "chorus";
  return "opening";
}

function syncCreativeStageVisualModule(stage, subtitle, detail = "") {
  const hasPlayableVideo = !!(
    watchVideo?.src &&
    String(watchVideo.src).trim() &&
    !["none", "local-fallback"].includes(String(globalThis.currentPreviewVideoSourceKind || "").trim())
  );
  if (hasPlayableVideo) return;
  if (hasEffectiveWatchFrameSourceModule?.()) {
    syncWatchPlaceholderAfterForyouThumbModule?.();
    return;
  }
  if (watchSvg) {
    watchSvg.style.display = "none";
    watchSvg.removeAttribute("src");
    watchSvg.setAttribute("alt", "");
  }
  if (watchScreenBackdrop && !String(foryouThumbImage?.src || "").trim()) {
    watchScreenBackdrop.style.backgroundImage = "";
  }
}

function updateCreativeWatchSubtitleModule(statusPayload, derived) {
  const visualStage = creativeStageFromSegmentSemanticsModule(statusPayload, derived);
  let tone = narrativeToneFromCreativeStageModule(visualStage);
  if (String(statusPayload?.video?.current_relationship_arc || "").toLowerCase().includes("lead")) {
    tone = "lead";
  }
  syncNarrativeToneModule(tone);
  if (!watchSubtitle) return;
  if ((derived?.kara?.progress || 0) >= 100) {
    watchSubtitle.textContent = loginCopy("KaraOKe MV · Ready");
    syncCreativeStageVisualModule("callback", watchSubtitle.textContent, loginCopy("Final sync is locked."));
    return;
  }
  if ((derived?.kara?.progress || 0) > 0) {
    watchSubtitle.textContent = loginCopy("KaraOKe MV · Letting the chorus glow");
    syncCreativeStageVisualModule(visualStage, watchSubtitle.textContent, loginCopy("Subtitles are learning when to glow."));
    return;
  }
  if ((derived?.video?.progress || 0) > 0) {
    const hasCallback = visualStage === "callback";
    watchSubtitle.textContent = hasCallback
      ? loginCopy("KaraOKe MV · Setting the return shot")
      : loginCopy("KaraOKe MV · Staging the frame");
    syncCreativeStageVisualModule(
      visualStage,
      watchSubtitle.textContent,
      hasCallback
        ? loginCopy("The ending is turning back toward its first image.")
        : loginCopy("Figures, camera, and distance are locking in.")
    );
    return;
  }
  if ((derived?.music?.progress || 0) > 0) {
    watchSubtitle.textContent = visualStage === "chorus"
      ? loginCopy("KaraOKe MV · Expanding the refrain")
      : loginCopy("KaraOKe MV · Lifting the hook");
    syncCreativeStageVisualModule(
      visualStage,
      watchSubtitle.textContent,
      visualStage === "chorus"
        ? loginCopy("The refrain is widening into a shared motion.")
        : loginCopy("The song is discovering its center of gravity.")
    );
    return;
  }
  watchSubtitle.textContent = loginCopy("KaraOKe MV · Catching a first line");
  syncCreativeStageVisualModule(visualStage, watchSubtitle.textContent, loginCopy("The first image is still arriving."));
}

function stopPipelineProgressPollingModule() {
  activePipelineRunId = "";
  if (pipelineStatusTimer) {
    clearInterval(pipelineStatusTimer);
    pipelineStatusTimer = null;
  }
  updateWatchAudioDebug();
}

function stopPendingFinalAudioPollingModule() {
  pendingFinalAudioRunId = "";
  if (pendingFinalAudioTimer) {
    clearInterval(pendingFinalAudioTimer);
    pendingFinalAudioTimer = null;
  }
  if (pendingFinalAudioStopTimer) {
    clearTimeout(pendingFinalAudioStopTimer);
    pendingFinalAudioStopTimer = null;
  }
}

let pipelineZeroProgressFingerprint = "";
let pipelineZeroProgressSince = 0;

async function pollPipelineProgressOnceModule(runId) {
  const statePath = pipelineRunStatePath(runId);
  if (!statePath) return;
  let payload = null;
  let res = null;
  try {
    res = await fetch(`/api/pipeline/status?path=${encodeURIComponent(statePath)}`);
    payload = await res.json().catch(() => null);
  } catch (_err) {
    payload = null;
  }
  // CSSOS_PHASE2_STOP_404_POLL 20260504 — Jing: a 404 here means the
  // run state file was GC'd / never existed. Stop the interval timer
  // for THIS run so we don't keep painting red 404s in DevTools.
  if (res && res.status === 404) {
    if (String(activePipelineRunId || "") === String(runId || "")) {
      stopPipelineProgressPolling?.();
      activePipelineRunId = null;
    }
    return;
  }
  if (!res?.ok || !payload) {
    return;
  }
  const derived = derivePipelineProgress(payload);
  const nextGap = globalThis.getNextWatchGenerationGapModule?.() || "lyrics";
  const actionableGap = globalThis.resolveWatchRecoveryStageModule?.(nextGap) || nextGap;
  const totalDerivedProgress =
    Number(derived.music?.progress || 0) +
    Number(derived.video?.progress || 0) +
    Number(derived.kara?.progress || 0);
  const zeroFingerprint = `${String(runId || "").trim()}::${actionableGap}::${Math.round(globalThis.currentLyricsProgressPercentModule?.() || 0)}`;
  if (totalDerivedProgress <= 0 && actionableGap !== "play") {
    if (pipelineZeroProgressFingerprint !== zeroFingerprint) {
      pipelineZeroProgressFingerprint = zeroFingerprint;
      pipelineZeroProgressSince = Date.now();
    } else if (Date.now() - pipelineZeroProgressSince >= 6000) {
      pipelineZeroProgressSince = Date.now();
      void globalThis.autoRecoverWatchStageModule?.(actionableGap);
    }
  } else {
    pipelineZeroProgressFingerprint = "";
    pipelineZeroProgressSince = 0;
  }
  if (Number(derived.music?.progress || 0) > 0) {
    window.engineProgressState.music = Math.max(
      Number(window.engineProgressState?.music || engineProgressState.music || 0),
      Number(derived.music.progress || 0)
    );
  }
  if (Number(derived.video?.progress || 0) > 0) {
    window.engineProgressState.video = Math.max(
      Number(window.engineProgressState?.video || engineProgressState.video || 0),
      Number(derived.video.progress || 0)
    );
  }
  if (Number(derived.kara?.progress || 0) > 0) {
    window.engineProgressState.kara = Math.max(
      Number(window.engineProgressState?.kara || engineProgressState.kara || 0),
      Number(derived.kara.progress || 0)
    );
  }
  const lyricsReady = (globalThis.isWatchLyricsReadyModule?.() ?? false) || (typeof isWatchLyricsReadyModule === "function" && isWatchLyricsReadyModule());
  void globalThis.maybeHydrateWatchKaraokeTimelineModule?.(runId, payload);
  if (lyricsReady && Number(derived.music?.progress || 0) >= 100) {
    void maybeAttachFinalAudioArtifact(runId, payload, derived.music);
    engineProgressState.music = blendProgress(engineProgressState.music, derived.music.progress);
    engineProgressState.video = blendProgress(engineProgressState.video, derived.video.progress);
    engineProgressState.kara = blendProgress(engineProgressState.kara, derived.kara.progress);
  } else {
    engineProgressState.music = Math.max(Number(engineProgressState.music || 0), Number(derived.music?.progress || 0) || 0);
    engineProgressState.video = Math.max(Number(engineProgressState.video || 0), Number(derived.video?.progress || 0) || 0);
    engineProgressState.kara = Math.max(Number(engineProgressState.kara || 0), Number(derived.kara?.progress || 0) || 0);
  }
  if (
    !karaCompletionAt &&
    derived.kara.progress >= 100 &&
    lyricsReady &&
    Number(engineProgressState.music || 0) >= 100 &&
    Number(engineProgressState.video || 0) >= 100
  ) {
    karaCompletionAt = Date.now();
    globalThis.markCreationFinishedModule?.();
    window.dispatchEvent(
      new CustomEvent("cssos:kara_ready", {
        detail: {
          run_id: runId,
          stage: derived.kara.currentStage,
          detail: derived.kara.artifactDetail
        }
      })
    );
  }
  setProgress(musicProgress, engineProgressState.music);
  setProgress(videoProgress, engineProgressState.video);
  setProgress(karaProgress, engineProgressState.kara);
  if (lyricsReady && engineProgressState.music > 0) {
    setEngineProgressVisible("music", true, { immediate: true });
    revealEnginePanel("music");
  }
  if (lyricsReady && engineProgressState.video > 0) {
    setEngineProgressVisible("video", true, { immediate: true });
    revealEnginePanel("video");
  }
  if (lyricsReady && engineProgressState.kara > 0) {
    setEngineProgressVisible("kara", true, { immediate: true });
    revealEnginePanel("kara");
  }
  syncSceneProgress(engineProgressState.video);
  setEngineState("music", lyricsReady ? (derived.music.state === "done" ? "running" : derived.music.state) : "pending");
  setEngineState("video", lyricsReady ? (derived.video.state === "done" ? "running" : derived.video.state) : "pending");
  setEngineState("kara", lyricsReady ? (derived.kara.state === "done" ? "running" : derived.kara.state) : "pending");
  updateCreativeWatchSubtitleModule(payload, lyricsReady ? derived : { music: { progress: 0 }, video: { progress: 0 }, kara: { progress: 0 } });
  setEngineDetail(
    "music",
    lyricsReady
      ? humanizeCreativeStageModule("music", derived.music.currentStage, derived.music.artifactDetail)
      : loginCopy("waiting for lyrics before composing")
  );
  if (
    lyricsReady &&
    Number(engineProgressState.music || 0) > 0 &&
    Number(engineProgressState.music || 0) < 100 &&
    ["failed", "error", "pending"].includes(String(derived.music.state || "").trim())
  ) {
    setEngineState("music", "running");
    setEngineDetail(
      "music",
      loginCopy("music pipeline is recovering automatically")
    );
  }
  renderMusicEngineSnapshot(payload, {
    ...derived.music,
    progress: lyricsReady ? engineProgressState.music : 0
  });
  setEngineDetail(
    "video",
    lyricsReady
      ? humanizeCreativeStageModule("video", derived.video.currentStage, derived.video.artifactDetail)
      : loginCopy("waiting for lyrics before staging video")
  );
  renderVideoEngineSnapshot(payload, {
    ...derived.video,
    progress: lyricsReady ? engineProgressState.video : 0
  });
  setEngineDetail(
    "kara",
    lyricsReady
      ? humanizeCreativeStageModule("kara", derived.kara.currentStage, derived.kara.artifactDetail)
      : loginCopy("waiting for lyrics before MV render")
  );
  renderKaraEngineSnapshot(payload, {
    ...derived.kara,
    progress: lyricsReady ? engineProgressState.kara : 0
  });
  window.dispatchEvent(
    new CustomEvent("cssos:run_progress", {
      detail: {
        run_id: runId,
        title: String(state.title || "").trim(),
        stage_label: loginCopy(
          `Lyrics ${Math.round(globalThis.currentLyricsProgressPercentModule?.() || 0)}% · Music ${Math.round(engineProgressState.music || 0)}% · Video ${Math.round(engineProgressState.video || 0)}% · MV ${Math.round(engineProgressState.kara || 0)}%`
        ),
        progress: {
          // CSSOS_PHASE2_6STAGE 20260419 — notifications panel now renders
          // 6 bars (cover/lyrics/music/video/subtitles/compose). We emit
          // the new keys alongside the legacy `kara` key so older readers
          // keep working. `compose` mirrors `kara` since both describe the
          // final MV assembly stage.
          cover: Math.round(Number(engineProgressState.cover || engineProgressState.thumbnail || 0)),
          lyrics: Math.round(globalThis.currentLyricsProgressPercentModule?.() || 0),
          music: Math.round(engineProgressState.music || 0),
          video: Math.round(engineProgressState.video || 0),
          subtitles: Math.round(Number(engineProgressState.subtitles || 0)),
          compose: Math.round(Number(engineProgressState.compose || engineProgressState.kara || 0)),
          kara: Math.round(engineProgressState.kara || 0),
        }
      }
    })
  );
  if (lyricsReady && Number(engineProgressState.music || 0) >= 100) {
    void maybeAttachFinalAudioArtifact(runId, payload, { progress: 100 });
    if (watchActiveTab !== "music" && Number(engineProgressState.video || 0) <= 0) {
      activateWatchTab("music");
    }
  }
  if (
    lyricsReady &&
    Number(engineProgressState.music || 0) >= 100 &&
    Number(engineProgressState.video || 0) > 0
  ) {
    if (!String(watchVideo?.src || "").trim()) {
      const previewTitle = String(state.title || loginCopy("CSS MV")).trim();
      const previewLines = compactLyricLines(Array.isArray(state.lines) ? state.lines : []).filter(Boolean);
      if (previewTitle && previewLines.length) {
        void requestWatchVideoPreviewModule(previewTitle, previewLines, { allowDuringGeneration: true });
      }
    }
    if (watchActiveTab !== "music" && watchActiveTab !== "mv") {
      activateWatchTab("mv");
    }
  }
  if (lyricsReady && derived.music.progress >= 100) {
    setProgress(musicProgress, 100);
    setEngineProgressVisible("music", false);
  }
  if (lyricsReady && derived.video.progress >= 100) {
    setProgress(videoProgress, 100);
    setEngineProgressVisible("video", false);
  }
  if (
    lyricsReady &&
    Number(engineProgressState.music || 0) >= 100 &&
    Number(engineProgressState.video || 0) >= 100 &&
    derived.kara.progress >= 100
  ) {
    setProgress(karaProgress, 100);
    setEngineProgressVisible("kara", false);
    if (document.hidden || watchPanel?.classList?.contains("hidden")) {
      showToast(loginCopy("Your MV is ready. Open Watch to enjoy it."));
    }
    void globalThis.openCurrentGeneratedWatchPlaybackModule?.({ autoplay: true, preferVideo: true });
  }
  maybeFinalizeForyouPresentation();
  syncWatchProgressRotatorModule?.();
}

function startPipelineProgressPollingModule(runId) {
  const safeRunId = String(runId || "").trim();
  if (!safeRunId) return;
  window.dispatchEvent(
    new CustomEvent("cssos:run_created", {
      detail: {
        run_id: safeRunId,
        title: String(state.title || currentWatchPreviewWork?.title || "").trim()
      }
    })
  );
  globalThis.setWatchCreateRunDebugMeta?.("response", {
    status: "polling",
    runId: safeRunId,
    statusUrl: `/cssapi/v1/runs/${encodeURIComponent(safeRunId)}/status`,
    note: "polling_started"
  });
  activePipelineRunId = safeRunId;
  stopPipelineProgressPolling();
  activePipelineRunId = safeRunId;
  if (!currentWatchAudioRunId) {
    currentWatchAudioRunId = safeRunId;
  }
  updateWatchAudioDebug();
  void pollPipelineProgressOnce(safeRunId);
  let pipelineStatusBusy = false;
  pipelineStatusTimer = setInterval(() => {
    if (!activePipelineRunId) return;
    if (pipelineStatusBusy) return;
    pipelineStatusBusy = true;
    void pollPipelineProgressOnce(activePipelineRunId).finally(() => {
      pipelineStatusBusy = false;
    });
  }, 1200);
}

function startPendingFinalAudioPollingModule(runId) {
  const safeRunId = String(runId || "").trim();
  if (!safeRunId) return;
  stopPendingFinalAudioPolling();
  pendingFinalAudioRunId = safeRunId;
  updateWatchAudioDebug();
  let pendingFinalAudioBusy = false;
  const tick = () => {
    if (!pendingFinalAudioRunId) return;
    if (pendingFinalAudioBusy) return;
    pendingFinalAudioBusy = true;
    void maybeAttachFinalAudioArtifact(safeRunId, { artifacts: [] }, { progress: 100 })
      .then((attached) => {
        if (attached) {
          stopPendingFinalAudioPolling();
        }
      })
      .finally(() => {
        pendingFinalAudioBusy = false;
      });
  };
  tick();
  pendingFinalAudioTimer = setInterval(tick, 2500);
  pendingFinalAudioStopTimer = setTimeout(() => {
    if (pendingFinalAudioRunId === safeRunId) {
      stopPendingFinalAudioPolling();
    }
  }, 1000 * 60 * 5);
}

window.stopPipelineProgressPollingModule = stopPipelineProgressPollingModule;
window.stopPendingFinalAudioPollingModule = stopPendingFinalAudioPollingModule;
window.pollPipelineProgressOnceModule = pollPipelineProgressOnceModule;
window.startPipelineProgressPollingModule = startPipelineProgressPollingModule;
window.startPendingFinalAudioPollingModule = startPendingFinalAudioPollingModule;
