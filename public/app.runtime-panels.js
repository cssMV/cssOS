function renderSceneList(scenes) {
  if (!sceneList) return;
  clearChildren(sceneList);
  sceneRows = [];
  scenes.forEach((scene, index) => {
    const item = document.createElement("div");
    item.className = "scene-item";

    const sceneIndex = document.createElement("span");
    const sceneCopy = document.createElement("div");
    sceneCopy.className = "scene-copy";
    const sceneTitle = document.createElement("span");
    const sceneDetail = document.createElement("span");
    sceneDetail.className = "scene-detail";
    const sceneStatus = document.createElement("span");

    const titleText = String(scene?.title || `Scene ${index + 1} · Flow`);
    const parts = titleText.split("·");
    sceneIndex.textContent = parts[0]?.trim() || `Scene ${index + 1}`;
    sceneTitle.textContent = parts[1]?.trim() || "Flow";
    sceneDetail.textContent = String(
      scene?.detail || loginCopy("waiting for its turn to enter the cut")
    );
    const initialState = index === 0 ? "rendering" : "queued";
    sceneStatus.className = "scene-status";
    setSceneState(item, sceneStatus, initialState);
    item.addEventListener("click", () => {
      cycleSceneStatus(sceneStatus);
    });

    sceneCopy.appendChild(sceneTitle);
    sceneCopy.appendChild(sceneDetail);
    item.appendChild(sceneIndex);
    item.appendChild(sceneCopy);
    item.appendChild(sceneStatus);
    sceneList.appendChild(item);
    sceneRows.push({
      row: item,
      statusEl: sceneStatus,
      detailEl: sceneDetail,
      title: sceneTitle.textContent,
      sceneId: String(scene?.sceneId || scene?.scene_id || "").trim()
    });
  });
}

function renderLyricsGrid(scenes) {
  if (!lyricsGrid) return;
  clearChildren(lyricsGrid);
  scenes.forEach((scene) => {
    const card = document.createElement("div");
    card.className = "engine-card";

    const title = document.createElement("div");
    title.className = "engine-title";
    title.textContent = scene.title;

    const excerpt = document.createElement("p");
    excerpt.textContent = scene.lines.slice(0, 2).join(" / ");

    card.appendChild(title);
    card.appendChild(excerpt);
    lyricsGrid.appendChild(card);
  });
}

function renderTags(container, tags) {
  if (!container) return;
  clearChildren(container);
  tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    container.appendChild(chip);
  });
}

function cycleSceneStatus(statusEl) {
  if (!statusEl) return;
  const current = statusEl.dataset.state || "";
  const row = statusEl.closest(".scene-item");
  if (!row) return;
  if (current === "done") {
    setSceneState(row, statusEl, "delete");
    showToast("Click again to delete");
    return;
  }
  if (current === "delete") {
    row.remove();
    pruneSceneRows();
    showToast("Scene removed");
    return;
  }
  let next = "paused";
  let toastMessage = "Scene paused";
  if (current === "paused") {
    next = "rendering";
    toastMessage = "Scene resumed";
  } else if (current === "rendering") {
    next = "canceled";
    toastMessage = "Scene canceled";
  } else if (current === "canceled") {
    next = "queued";
    toastMessage = "Scene continued";
  } else if (current === "queued") {
    next = "paused";
    toastMessage = "Scene paused";
  }
  setSceneState(row, statusEl, next);
  showToast(toastMessage);
}

function renderStats(container, stats) {
  if (!container) return;
  clearChildren(container);
  stats.forEach((stat) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    const value = document.createElement("span");
    value.textContent = stat.value;
    card.textContent = `${stat.label}`;
    card.appendChild(value);
    container.appendChild(card);
  });
}

function renderCameraBoard(scenes) {
  if (!cameraBoard) return;
  clearChildren(cameraBoard);
  scenes.forEach((scene, index) => {
    const row = document.createElement("div");
    row.className = "camera-row";

    const label = document.createElement("strong");
    label.textContent = `Scene ${index + 1}`;

    const move = document.createElement("span");
    move.textContent = pickRandom(cameraMoveBank, 1)[0];

    const lens = document.createElement("span");
    lens.className = "camera-mode";
    lens.textContent = pickRandom(lensBank, 1)[0];

    row.appendChild(label);
    row.appendChild(move);
    row.appendChild(lens);
    cameraBoard.appendChild(row);
  });
}

function renderLyricFlow(scenes) {
  if (!lyricFlow) return;
  clearChildren(lyricFlow);
  scenes.forEach((scene, index) => {
    const row = document.createElement("div");
    row.className = "flow-row";

    const time = document.createElement("span");
    const minutes = String(index).padStart(2, "0");
    const seconds = String((index * 12) % 60).padStart(2, "0");
    time.textContent = `${minutes}:${seconds}`;

    const bar = document.createElement("div");
    bar.className = "flow-bar";
    const fill = document.createElement("span");
    fill.style.width = `${60 + Math.random() * 30}%`;
    bar.appendChild(fill);

    const label = document.createElement("span");
    const parts = scene.title.split("·");
    label.textContent = parts[1]?.trim() || flowBank[index % flowBank.length];

    row.appendChild(time);
    row.appendChild(bar);
    row.appendChild(label);
    lyricFlow.appendChild(row);
  });
}

function buildMusicEngineLayers(statusPayload, progress = 0) {
  const music = statusPayload?.music || {};
  const normalizedProgress = clampPercent(progress);
  const primaryInstrument =
    creationState.selections.instrument ||
    creationState.instrumentation ||
    state.songSeed?.instrumentation ||
    loginCopy("Strings");
  const stageLabel = String(music.current_label || "").trim() || String(music.current_container_title || "").trim();
  const trackCount = Number(music.tracks_count) || 0;
  const cuesCount = Number(music.cues_count) || 0;
  return [
    {
      label: loginCopy("Lead Presence"),
      level: Math.min(100, 20 + normalizedProgress * 0.82),
      detail: voiceStyle?.textContent || state.voice || loginCopy("Presence shaping")
    },
    {
      label: loginCopy("Lift Weave"),
      level: Math.min(100, 12 + normalizedProgress * 0.68),
      detail: trackCount > 1 ? `${trackCount} ${loginCopy("layers")}` : loginCopy("voices are starting to weave")
    },
    {
      label: primaryInstrument,
      level: Math.min(100, 16 + normalizedProgress * 0.74),
      detail: stageLabel || loginCopy("Theme motif")
    },
    {
      label: loginCopy("Pulse Floor"),
      level: Math.min(100, 8 + normalizedProgress * 0.58),
      detail: `${Math.max(1, Math.round(Number(creationState.percussionActivity || 0.45) * 10))} ${loginCopy("pulse")}`
    },
    {
      label: loginCopy("Atmosphere Bed"),
      level: Math.min(100, 14 + normalizedProgress * 0.66),
      detail: cuesCount > 0 ? `${cuesCount} ${poeticCountWord("cues")}` : loginCopy("room bloom is opening")
    }
  ];
}

function renderMusicRuntimeBoard(statusPayload, musicSnapshot = {}) {
  if (!musicRuntimeBoard) return;
  clearChildren(musicRuntimeBoard);
  const pendingStructureSummary = [
    workTypeLabel(creationState.workType),
    String(creationState.selections?.genre || "").trim(),
    String(voiceInput?.value || creationState.selections?.vocalGender || "").trim()
  ]
    .filter(Boolean)
    .join(" · ");
  const cards = [
    {
      label: poeticRuntimeCardLabel("current_moment"),
      value: musicSnapshot.currentStage || loginCopy("listening for the first heartbeat")
    },
    {
      label: poeticRuntimeCardLabel("song_shape"),
      value: musicSnapshot.artifactDetail || pendingStructureSummary || loginCopy("the song shape is still appearing")
    },
    {
      label: poeticRuntimeCardLabel("energy_rise"),
      value: `${Math.round(clampPercent(musicSnapshot.progress || 0))}% · ${
        Number(statusPayload?.music?.tracks_count) || 0
      } ${poeticCountWord("tracks")}`
    }
  ];
  cards.forEach((cardInfo) => {
    const card = document.createElement("div");
    card.className = "music-runtime-card";
    const label = document.createElement("div");
    label.className = "music-runtime-label";
    label.textContent = cardInfo.label;
    const value = document.createElement("div");
    value.className = "music-runtime-value";
    value.textContent = cardInfo.value;
    card.appendChild(label);
    card.appendChild(value);
    musicRuntimeBoard.appendChild(card);
  });
}

function renderMusicWaveform(progress = 0, stageLabel = "") {
  if (!waveformEl) return;
  clearChildren(waveformEl);
  const normalizedProgress = clampPercent(progress);
  const bucketCount = Math.max(12, Number(MUSIC_WAVEFORM_BAR_COUNT || 24));
  const activeBucket = Math.max(0, Math.min(bucketCount - 1, Math.floor((normalizedProgress / 100) * bucketCount)));
  const stageSeed = Array.from(String(stageLabel || "")).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  for (let index = 0; index < bucketCount; index += 1) {
    const bar = document.createElement("span");
    const oscillation = Math.sin((index + 1 + stageSeed * 0.01) * 0.72);
    const progressLift = normalizedProgress * 0.34;
    const height = Math.max(22, Math.min(92, 38 + oscillation * 24 + progressLift));
    bar.style.setProperty("--i", String(index + 1));
    bar.style.setProperty("--h", `${height}%`);
    if (index <= activeBucket) bar.classList.add("is-active");
    waveformEl.appendChild(bar);
  }
}

function renderMusicTrackList(statusPayload, musicSnapshot = {}) {
  if (!musicTrackList) return;
  clearChildren(musicTrackList);
  const behavior = readPanelBehaviorSettingsLocal();
  const layers = buildMusicEngineLayers(statusPayload, musicSnapshot.progress || 0).slice(0, behavior.music.layer_cards);
  layers.forEach((layer) => {
    const row = document.createElement("div");
    row.className = "track-row";

    const label = document.createElement("div");
    label.className = "track-label";
    label.textContent = layer.label;

    const bar = document.createElement("div");
    bar.className = "track-bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.round(clampPercent(layer.level))}%`;
    bar.appendChild(fill);

    const value = document.createElement("div");
    value.className = "track-value";
    value.textContent = `${Math.round(clampPercent(layer.level))}%`;

    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(value);
    musicTrackList.appendChild(row);
  });
}

function renderMixGrid(statusPayload = null, musicSnapshot = {}) {
  if (!mixGrid) return;
  clearChildren(mixGrid);
  const behavior = readPanelBehaviorSettingsLocal();
  buildMusicEngineLayers(statusPayload, musicSnapshot.progress || 0)
    .slice(0, behavior.music.layer_cards)
    .forEach((layer) => {
      const card = document.createElement("div");
      card.className = "mix-card";

      const title = document.createElement("div");
      title.className = "mix-title";
      title.textContent = layer.label;

      const detail = document.createElement("div");
      detail.className = "mix-detail";
      detail.textContent = layer.detail;

      const level = document.createElement("div");
      level.className = "mix-level";
      const fill = document.createElement("span");
      fill.style.width = `${Math.round(clampPercent(layer.level))}%`;
      level.appendChild(fill);

      card.appendChild(title);
      card.appendChild(detail);
      card.appendChild(level);
      mixGrid.appendChild(card);
    });
}

function renderMusicEngineSnapshot(statusPayload = null, musicSnapshot = {}) {
  latestWatchMusicStatusPayload = statusPayload;
  latestWatchMusicSnapshot = { ...musicSnapshot };
  const currentRunId = String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim();
  const cachedMusicPlan =
    watchMusicPlanCache.runId === currentRunId && watchMusicPlanCache.data && typeof watchMusicPlanCache.data === "object"
      ? watchMusicPlanCache.data
      : null;
  const enrichedSnapshot = {
    ...musicSnapshot,
    replyHarmonyWindows: extractReplyHarmonyWindowsFromMusicPlan(cachedMusicPlan),
    replyHarmonyPending: !!currentRunId && watchMusicPlanCache.runId === currentRunId && watchMusicPlanCache.pending,
    replyHarmonyState: cachedMusicPlan ? "ready" : (watchMusicPlanCache.error ? "empty" : "pending"),
    replyHarmonyCurrentTimeSec: currentWatchAudioTimeSec(),
    replyHarmonyDurationSec: currentWatchAudioDurationSec()
  };
  renderMusicRuntimeBoard(statusPayload, enrichedSnapshot);
  renderMusicWaveform(enrichedSnapshot.progress || 0, enrichedSnapshot.currentStage || "");
  renderMusicTrackList(statusPayload, enrichedSnapshot);
  renderMixGrid(statusPayload, enrichedSnapshot);
  if (currentRunId) {
    void maybeHydrateWatchMusicPlan(currentRunId);
  }
}

function poeticRuntimeCardLabel(key) {
  const normalized = String(key || "").trim();
  if (normalized === "current_moment") return loginCopy("Current Moment");
  if (normalized === "song_shape") return loginCopy("Song Shape");
  if (normalized === "energy_rise") return loginCopy("Energy Rise");
  if (normalized === "frame_motion") return loginCopy("Frame Motion");
  if (normalized === "scene_arc") return loginCopy("Scene Arc");
  if (normalized === "cut_density") return loginCopy("Cut Density");
  if (normalized === "lyric_glow") return loginCopy("Lyric Glow");
  if (normalized === "timing_arc") return loginCopy("Timing Arc");
  if (normalized === "subtitle_breath") return loginCopy("Subtitle Breath");
  return normalized;
}

function poeticCountWord(key) {
  const normalized = String(key || "").trim();
  if (normalized === "tracks") return loginCopy("voices");
  if (normalized === "scenes") return loginCopy("moments");
  if (normalized === "segments") return loginCopy("beat arcs");
  if (normalized === "acts") return loginCopy("passes");
  if (normalized === "cues") return loginCopy("glows");
  return normalized;
}

function buildVideoRuntimeCards(statusPayload, videoSnapshot = {}) {
  const video = statusPayload?.video || {};
  const shotsCount = Number(video.shots_count) || 0;
  const completedShots = Number(video.completed_shots) || 0;
  const segmentsCount = Number(video.segments_count) || 0;
  const pendingStructureSummary = [
    workTypeLabel(creationState.workType),
    String(creationState.language || "").trim(),
    String(creationState.sectionForm || "").trim()
  ]
    .filter(Boolean)
    .join(" · ");
  return [
    {
      label: poeticRuntimeCardLabel("frame_motion"),
      value: videoSnapshot.currentStage || loginCopy("holding the first frame")
    },
    {
      label: poeticRuntimeCardLabel("scene_arc"),
      value: videoSnapshot.artifactDetail || pendingStructureSummary || loginCopy("the scene arc is still forming")
    },
    {
      label: poeticRuntimeCardLabel("cut_density"),
      value: `${completedShots}/${Math.max(shotsCount, completedShots)} ${loginCopy("glances")} · ${segmentsCount} ${poeticCountWord("segments")}`
    }
  ];
}

function renderVideoRuntimeBoard(statusPayload, videoSnapshot = {}) {
  if (!videoRuntimeBoard) return;
  clearChildren(videoRuntimeBoard);
  buildVideoRuntimeCards(statusPayload, videoSnapshot).forEach((cardInfo) => {
    const card = document.createElement("div");
    card.className = "video-runtime-card";
    const label = document.createElement("div");
    label.className = "video-runtime-label";
    label.textContent = cardInfo.label;
    const value = document.createElement("div");
    value.className = "video-runtime-value";
    value.textContent = cardInfo.value;
    card.appendChild(label);
    card.appendChild(value);
    videoRuntimeBoard.appendChild(card);
  });
}

function extractShotIndexFromStage(stageKey) {
  const raw = String(stageKey || "").trim();
  const match = raw.match(/(?:video_shot_|shot\.|video_shot\.)(\d+)/i);
  if (!match) return 0;
  return Math.max(0, Number(match[1]) || 0);
}

function renderVideoStoryboardSnapshot(statusPayload = null, videoSnapshot = {}) {
  if (!storyboard) return;
  const video = statusPayload?.video || {};
  const frames = Array.from(storyboard.querySelectorAll(".story-frame"));
  const progress = clampPercent(videoSnapshot.progress || 0);
  const completedCount = Math.floor((progress / 100) * frames.length);
  const activeIndex = extractShotIndexFromStage(videoSnapshot.stageKey) || completedCount + 1;
  frames.forEach((frame, index) => {
    frame.classList.remove("is-complete", "is-active");
    if (index < completedCount) {
      frame.classList.add("is-complete");
    } else if (index + 1 === activeIndex && progress > 0 && progress < 100) {
      frame.classList.add("is-active");
      const title = frame.querySelector(".story-frame-title");
      const detail = frame.querySelector(".story-frame-detail");
      const copy = buildStoryboardSemanticFrame(
        video.current_relationship_arc,
        video.current_motif_callback,
        loginCopy("current motion"),
        buildSceneSemanticCopy(statusPayload, true)
      );
      const tone = storyboardSemanticTone(video.current_relationship_arc, video.current_motif_callback);
      frame.dataset.tone = tone;
      frame.classList.remove("tone-opening", "tone-lead", "tone-group", "tone-callback");
      frame.classList.add(`tone-${tone}`);
      if (title) title.textContent = copy.title;
      if (detail) detail.textContent = copy.detail;
    }
  });
}

function renderVideoCameraSnapshot(statusPayload = null, videoSnapshot = {}) {
  if (!cameraList) return;
  const video = statusPayload?.video || {};
  const behavior = readPanelBehaviorSettingsLocal();
  const plannedScenes = Number(video.planned_scenes_per_act) || Number(video.scenes_count) || 0;
  const currentSceneStart = Number(video.current_scene_start) || 0;
  const currentSceneEnd = Number(video.current_scene_end) || currentSceneStart || 0;
  if (!plannedScenes && !videoSnapshot.currentStage) return;
  clearChildren(cameraList);
  const sceneCount = Math.max(1, Math.min(behavior.video.camera_slots, plannedScenes || behavior.video.camera_slots));
  for (let index = 0; index < sceneCount; index += 1) {
    const sceneNumber = index + 1;
    const item = document.createElement("div");
    item.className = "camera-item";
    item.textContent = `${loginCopy("Scene")} ${String(sceneNumber).padStart(2, "0")}`;
    const detail = document.createElement("span");
    const isActive =
      currentSceneStart && sceneNumber >= currentSceneStart && sceneNumber <= Math.max(currentSceneStart, currentSceneEnd);
    const tone = storyboardSemanticTone(video.current_relationship_arc, video.current_motif_callback);
    applySemanticToneClass(item, tone, !!isActive);
    const semanticDetail = buildSceneSemanticCopy(statusPayload, isActive);
    if (isActive) {
      detail.textContent = joinDetailParts([
        loginCopy("Active window"),
        semanticDetail || videoSnapshot.currentStage || loginCopy("Rendering shot")
      ]);
    } else if (sceneNumber < currentSceneStart) {
      detail.textContent = loginCopy("Storyboard locked");
    } else {
      detail.textContent = semanticDetail || loginCopy("Queued for render");
    }
    item.appendChild(detail);
    cameraList.appendChild(item);
  }
}

function renderVideoScriptSnapshot(statusPayload = null, videoSnapshot = {}) {
  if (!videoScript) return;
  const video = statusPayload?.video || {};
  const totalScenes = Number(video.scenes_count) || Number(video.planned_scenes_per_act) || 0;
  const currentScene = Number(video.current_scene_start) || 0;
  videoScript.textContent = joinDetailParts([
    videoSnapshot.currentStage || loginCopy("scene drift is ready"),
    totalScenes > 0 ? `${poeticCountWord("scenes")} ${currentScene || 1}/${totalScenes}` : "",
    humanizeRelationshipArc(video.current_relationship_arc),
    humanizeMotifCallback(video.current_motif_callback),
    videoSnapshot.artifactDetail || ""
  ]) || loginCopy("scene drift is ready");
}

function renderVideoEngineSnapshot(statusPayload = null, videoSnapshot = {}) {
  renderVideoRuntimeBoard(statusPayload, videoSnapshot);
  renderVideoStoryboardSnapshot(statusPayload, videoSnapshot);
  renderVideoCameraSnapshot(statusPayload, videoSnapshot);
  renderVideoScriptSnapshot(statusPayload, videoSnapshot);
  applySceneSemanticSnapshot(statusPayload);
}

function buildKaraRuntimeCards(statusPayload, karaSnapshot = {}) {
  const kara = statusPayload?.kara || {};
  const subtitleCount = Number(kara.subtitle_cues_count) || 0;
  const plannedActs = Number(kara.planned_total_acts) || 0;
  return [
    {
      label: poeticRuntimeCardLabel("lyric_glow"),
      value: karaSnapshot.currentStage || loginCopy("waiting for the line to light up")
    },
    {
      label: poeticRuntimeCardLabel("timing_arc"),
      value: karaSnapshot.artifactDetail || loginCopy("timing is still finding its landing")
    },
    {
      label: poeticRuntimeCardLabel("subtitle_breath"),
      value: `${subtitleCount} ${poeticCountWord("cues")} · ${Math.max(1, plannedActs || 1)} ${poeticCountWord("acts")}`
    }
  ];
}

function renderKaraRuntimeBoard(statusPayload, karaSnapshot = {}) {
  if (!karaRuntimeBoard) return;
  clearChildren(karaRuntimeBoard);
  buildKaraRuntimeCards(statusPayload, karaSnapshot).forEach((cardInfo) => {
    const card = document.createElement("div");
    card.className = "kara-runtime-card";
    const label = document.createElement("div");
    label.className = "kara-runtime-label";
    label.textContent = cardInfo.label;
    const value = document.createElement("div");
    value.className = "kara-runtime-value";
    value.textContent = cardInfo.value;
    card.appendChild(label);
    card.appendChild(value);
    karaRuntimeBoard.appendChild(card);
  });
}

function renderKaraEngineSnapshot(statusPayload = null, karaSnapshot = {}) {
  renderKaraRuntimeBoard(statusPayload, karaSnapshot);
  renderWatchKaraokeOverlay(karaSnapshot.progress || engineProgressState.kara || 0);
  if (watchSubtitle) {
    watchSubtitle.textContent =
      joinDetailParts([
        karaSnapshot.currentStage || loginCopy("KaraOKe MV · Syncing"),
        karaSnapshot.artifactDetail || ""
      ]) || loginCopy("KaraOKe MV · Syncing");
  }
}

function buildShots(count) {
  const total = Math.max(6, count * 4);
  const semanticPlan = [
    { relationshipArc: "solo_hold", motifCallback: "forward_motion" },
    { relationshipArc: "equals_to_lead", motifCallback: "forward_motion" },
    { relationshipArc: "scatter_to_center", motifCallback: "forward_motion" },
    { relationshipArc: "center_release", motifCallback: "pre_closing_recall" },
    { relationshipArc: "solo_release", motifCallback: "direct_opening_response" },
    { relationshipArc: "solo_hold", motifCallback: "motif_recall" }
  ];
  return Array.from({ length: total }, (_, index) => ({
    id: index + 1,
    move: pickRandom(cameraMoveBank, 1)[0],
    lens: pickRandom(lensBank, 1)[0],
    relationshipArc: semanticPlan[index % semanticPlan.length].relationshipArc,
    motifCallback: semanticPlan[index % semanticPlan.length].motifCallback
  }));
}

function renderStoryboard(shots) {
  if (!storyboard) return;
  clearChildren(storyboard);
  shots.slice(0, VIDEO_STORYBOARD_FRAME_COUNT).forEach((shot) => {
    const frame = document.createElement("div");
    const tone = storyboardSemanticTone(shot.relationshipArc, shot.motifCallback);
    frame.className = `story-frame tone-${tone}`;
    frame.dataset.tone = tone;
    const copy = buildStoryboardSemanticFrame(
      shot.relationshipArc,
      shot.motifCallback,
      shot.move,
      `${shot.move} · ${shot.lens}`
    );
    const title = document.createElement("div");
    title.className = "story-frame-title";
    title.textContent = copy.title;
    const detail = document.createElement("div");
    detail.className = "story-frame-detail";
    detail.textContent = copy.detail;
    frame.appendChild(title);
    frame.appendChild(detail);
    storyboard.appendChild(frame);
  });
}

function renderCameraList(shots) {
  if (!cameraList) return;
  clearChildren(cameraList);
  shots.slice(0, 4).forEach((shot) => {
    const item = document.createElement("div");
    item.className = "camera-item";
    item.textContent = `Shot ${String(shot.id).padStart(2, "0")}`;
    const detail = document.createElement("span");
    detail.textContent = `${shot.move} · ${shot.lens}`;
    item.appendChild(detail);
    cameraList.appendChild(item);
  });
}

function renderPulseList(container, lines, fallback) {
  if (!container) return;
  container.innerHTML = "";
  const items = Array.isArray(lines) && lines.length ? lines : [fallback];
  items.forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    container.appendChild(item);
  });
}
