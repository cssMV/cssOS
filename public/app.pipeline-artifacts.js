function buildMusicArtifactDetail(statusPayload) {
  const music = statusPayload?.music || {};
  const parts = [];
  const structureHeadline = buildStructureHeadline(music);
  if (structureHeadline) parts.push(structureHeadline);
  if (Number.isFinite(Number(music.tracks_count)) && Number(music.tracks_count) > 0) {
    parts.push(`tracks ${Number(music.tracks_count)}`);
  }
  if (Number.isFinite(Number(music.cues_count)) && Number(music.cues_count) > 0) {
    parts.push(`cues ${Number(music.cues_count)}`);
  }
  const plannedTotalActs = Number(music.planned_total_acts) || 0;
  const plannedScenesPerAct = Number(music.planned_scenes_per_act) || 0;
  const currentActNumber = Number(music.current_act_number) || 0;
  const currentSceneStart = Number(music.current_scene_start) || 0;
  const currentSceneEnd = Number(music.current_scene_end) || 0;
  const plannedTotalParts = Number(music.planned_total_parts) || 0;
  const currentPartNumber = Number(music.current_part_number) || 0;
  if (plannedTotalActs > 0 && currentActNumber > 0) {
    parts.push(`act ${currentActNumber}/${plannedTotalActs}`);
  } else if (plannedTotalParts > 0 && currentPartNumber > 0) {
    parts.push(`part ${currentPartNumber}/${plannedTotalParts}`);
  }
  if (plannedScenesPerAct > 0 && currentSceneStart > 0) {
    parts.push(
      currentSceneEnd > currentSceneStart
        ? `scene window ${currentSceneStart}-${currentSceneEnd}/${plannedScenesPerAct}`
        : `scene ${currentSceneStart}/${plannedScenesPerAct}`
    );
  }
  return joinDetailParts(parts);
}

function buildVideoArtifactDetail(statusPayload, shotStages) {
  const video = statusPayload?.video || {};
  const parts = [];
  const structureHeadline = buildStructureHeadline(video);
  if (structureHeadline) parts.push(structureHeadline);
  if (Number.isFinite(Number(video.scenes_count)) && Number(video.scenes_count) > 0) {
    parts.push(`scenes ${Number(video.scenes_count)}`);
  }
  if (Number.isFinite(Number(video.segments_count)) && Number(video.segments_count) > 0) {
    parts.push(`segments ${Number(video.segments_count)}`);
  }
  const totalShots = Number(video.shots_count) || (Array.isArray(shotStages) ? shotStages.length : 0);
  const completedShots = Number(video.completed_shots) || countStagesByState(shotStages, "done");
  if (totalShots > 0) {
    parts.push(`shots ${completedShots}/${totalShots}`);
  }
  const plannedTotalActs = Number(video.planned_total_acts) || 0;
  const plannedScenesPerAct = Number(video.planned_scenes_per_act) || 0;
  const currentActNumber = Number(video.current_act_number) || 0;
  const currentSceneStart = Number(video.current_scene_start) || 0;
  const currentSceneEnd = Number(video.current_scene_end) || 0;
  const plannedTotalParts = Number(video.planned_total_parts) || 0;
  const currentPartNumber = Number(video.current_part_number) || 0;
  if (plannedTotalActs > 0 && currentActNumber > 0) {
    parts.push(`act ${currentActNumber}/${plannedTotalActs}`);
  } else if (plannedTotalParts > 0 && currentPartNumber > 0) {
    parts.push(`part ${currentPartNumber}/${plannedTotalParts}`);
  }
  if (plannedScenesPerAct > 0 && currentSceneStart > 0) {
    parts.push(
      currentSceneEnd > currentSceneStart
        ? `scene window ${currentSceneStart}-${currentSceneEnd}/${plannedScenesPerAct}`
        : `scene ${currentSceneStart}/${plannedScenesPerAct}`
    );
  }
  return joinDetailParts(parts);
}

function buildKaraArtifactDetail(statusPayload) {
  const kara = statusPayload?.kara || {};
  const parts = [];
  const structureHeadline = buildStructureHeadline(kara);
  if (structureHeadline) parts.push(structureHeadline);
  if (Number.isFinite(Number(kara.subtitle_cues_count)) && Number(kara.subtitle_cues_count) > 0) {
    parts.push(`subtitle cues ${Number(kara.subtitle_cues_count)}`);
  }
  const plannedTotalActs = Number(kara.planned_total_acts) || 0;
  const plannedScenesPerAct = Number(kara.planned_scenes_per_act) || 0;
  const currentActNumber = Number(kara.current_act_number) || 0;
  const currentSceneStart = Number(kara.current_scene_start) || 0;
  const currentSceneEnd = Number(kara.current_scene_end) || 0;
  const plannedTotalParts = Number(kara.planned_total_parts) || 0;
  const currentPartNumber = Number(kara.current_part_number) || 0;
  if (plannedTotalActs > 0 && currentActNumber > 0) {
    parts.push(`act ${currentActNumber}/${plannedTotalActs}`);
  } else if (plannedTotalParts > 0 && currentPartNumber > 0) {
    parts.push(`part ${currentPartNumber}/${plannedTotalParts}`);
  }
  if (plannedScenesPerAct > 0 && currentSceneStart > 0) {
    parts.push(
      currentSceneEnd > currentSceneStart
        ? `scene window ${currentSceneStart}-${currentSceneEnd}/${plannedScenesPerAct}`
        : `scene ${currentSceneStart}/${plannedScenesPerAct}`
    );
  }
  return joinDetailParts(parts);
}

function collectPipelineStages(statusMap, patterns) {
  const entries = [];
  const seen = new Set();
  const tests = Array.isArray(patterns) ? patterns : [];
  for (const [name, status] of statusMap.entries()) {
    if (seen.has(name)) continue;
    if (tests.some((pattern) => (pattern instanceof RegExp ? pattern.test(name) : String(name) === String(pattern)))) {
      seen.add(name);
      entries.push({
        name,
        status: String(status?.status || status || "").trim(),
        progress: Number(status?.progress)
      });
    }
  }
  return entries.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function normalizePipelineStageEntries(statusPayload) {
  if (Array.isArray(statusPayload?.stages)) {
    return statusPayload.stages
      .map((entry) => ({
        name: String(entry?.name || "").trim(),
        status: String(entry?.status || "").trim(),
        progress: Number(
          entry?.progress ??
          entry?.percent ??
          entry?.pct ??
          entry?.completion ??
          entry?.percent_complete ??
          entry?.percentComplete
        )
      }))
      .filter((entry) => entry.name);
  }
  if (statusPayload?.stages && typeof statusPayload.stages === "object") {
    return Object.entries(statusPayload.stages)
      .map(([name, entry]) => ({
        name: String(name || "").trim(),
        status: String(entry?.status || "").trim(),
        progress: Number(
          entry?.progress ??
          entry?.percent ??
          entry?.pct ??
          entry?.completion ??
          entry?.percent_complete ??
          entry?.percentComplete
        )
      }))
      .filter((entry) => entry.name);
  }
  return [];
}

function derivePipelineProgress(statusPayload) {
  const statusMap = new Map(
    normalizePipelineStageEntries(statusPayload).map((entry) => [entry.name, entry])
  );
  const stage = (name) => {
    const entry = statusMap.get(name);
    return {
      name,
      status: entry?.status || "PENDING",
      progress: entry?.progress
    };
  };
  const shotStages = collectPipelineStages(statusMap, [/^video_shot_\d+$/i, /^shot\./i, /^video_shot\./i]);
  const musicStages = collectPipelineStages(statusMap, [
    "music",
    "music_plan",
    "music_compose",
    "vocals",
    "vocals_align",
    "mix",
    "master"
  ]);
  const music = computeWeightedStageProgress(
    musicStages.length ? musicStages : [stage("music"), stage("vocals"), stage("mix")],
    musicStages.length ? [15, 25, 20, 15, 10, 10, 5].slice(0, musicStages.length) : [34, 33, 33]
  );
  const videoStages = [
    ...collectPipelineStages(statusMap, ["video_plan"]),
    ...shotStages,
    ...collectPipelineStages(statusMap, ["video_assemble"]),
    ...collectPipelineStages(statusMap, ["render_mv", "render", "render_master", /^render_mv\./i])
  ];
  const activeVideoStages = videoStages.filter((item) => String(item?.status || "").trim());
  const shotWeight = shotStages.length ? 40 / shotStages.length : 0;
  const videoWeights = activeVideoStages.map((item) => {
    if (item.name === "video_plan") return 20;
    if (item.name === "video_assemble") return 20;
    if (item.name === "render" || item.name === "render_master" || item.name === "render_mv" || /^render_mv\./i.test(item.name)) return 20;
    return shotWeight || 40;
  });
  const video = computeWeightedStageProgress(activeVideoStages, videoWeights);
  const karaCandidates = collectPipelineStages(statusMap, [
    "subtitles",
    /^subtitles\./i,
    "lyrics_timing",
    /^karaoke_ass\./i,
    /^lyrics_lrc\./i,
    "localize",
    "render_lang_pack",
    "publish",
    /^render_karaoke_mv\./i
  ]).filter((item) => String(item?.status || "").trim() && item.status !== "PENDING");
  const kara = computeWeightedStageProgress(
    karaCandidates.length ? karaCandidates : [stage("subtitles")],
    karaCandidates.length ? [20, 15, 15, 15, 10, 10, 5, 10].slice(0, karaCandidates.length) : [100]
  );
  return {
    music: {
      ...music,
      stageKey: resolveCurrentPipelineStage(musicStages),
      currentStage: describePipelineStage("music", resolveCurrentPipelineStage(musicStages)),
      artifactDetail: buildMusicArtifactDetail(statusPayload)
    },
    video: {
      ...video,
      stageKey: resolveCurrentPipelineStage(activeVideoStages),
      currentStage: describePipelineStage("video", resolveCurrentPipelineStage(activeVideoStages)),
      artifactDetail: buildVideoArtifactDetail(statusPayload, shotStages)
    },
    kara: {
      ...kara,
      stageKey: resolveCurrentPipelineStage(karaCandidates.length ? karaCandidates : [stage("subtitles")]),
      currentStage: describePipelineStage(
        "kara",
        resolveCurrentPipelineStage(karaCandidates.length ? karaCandidates : [stage("subtitles")])
      ),
      artifactDetail: buildKaraArtifactDetail(statusPayload)
    }
  };
}

Object.assign(globalThis, {
  buildMusicArtifactDetail,
  buildVideoArtifactDetail,
  buildKaraArtifactDetail,
  collectPipelineStages,
  normalizePipelineStageEntries,
  derivePipelineProgress
});
