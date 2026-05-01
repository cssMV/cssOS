function setProgress(el, value) {
  callWatchUiModule("setProgressModule", el, value);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function pipelineRunStatePath(runId) {
  const safeRunId = String(runId || "").trim();
  if (!safeRunId) return "";
  return `/srv/cssos/shared/runs/${safeRunId}/run.json`;
}

function pipelineStageState(status) {
  const raw = String(status || "").trim().toUpperCase();
  if (!raw) return "pending";
  if (raw.includes("FAIL") || raw.includes("ERROR") || raw.includes("CANCEL") || raw.includes("TIMEOUT")) {
    return "canceled";
  }
  if (raw.includes("SUCCESS") || raw.includes("SUCCEEDED") || raw.includes("DONE") || raw === "OK") {
    return "done";
  }
  if (raw.includes("RUN") || raw.includes("WORK") || raw.includes("PROGRESS")) {
    return "running";
  }
  return "pending";
}

function blendProgress(current, target) {
  const from = clampPercent(current);
  const to = clampPercent(target);
  if (to >= 100) return 100;
  if (to <= from) return from;
  return Math.max(from, Math.min(to, from + Math.max(4, (to - from) * 0.45)));
}

function computeWeightedStageProgress(stages, weights) {
  const normalizedStages = Array.isArray(stages) ? stages : [];
  const safeWeights = Array.isArray(weights) && weights.length === normalizedStages.length ? weights : normalizedStages.map(() => 1);
  const totalWeight = safeWeights.reduce((sum, weight) => sum + Math.max(1, Number(weight || 0)), 0) || 1;
  let progress = 0;
  let hasRunning = false;
  let hasCanceled = false;
  normalizedStages.forEach((stage, index) => {
    const state = pipelineStageState(stage?.status);
    const weight = Math.max(1, Number(safeWeights[index] || 0));
    let stagePct = 0;
    if (state === "done") stagePct = 100;
    else if (state === "running") {
      stagePct = 62;
      hasRunning = true;
    } else if (state === "canceled") {
      stagePct = 0;
      hasCanceled = true;
    }
    progress += (stagePct * weight) / totalWeight;
  });
  const state = hasCanceled ? "canceled" : hasRunning ? "running" : progress >= 100 ? "done" : "running";
  return { progress: clampPercent(progress), state };
}

function prettifyPipelineStageName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  return raw.replace(/\./g, " / ").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function describePipelineStage(engine, name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase();
  const musicMap = [
    [/^music_plan$/, loginCopy("Arrangement planning")],
    [/^music_compose$/, loginCopy("Composing themes")],
    [/^music$/, loginCopy("Building core arrangement")],
    [/^vocals_align$/, loginCopy("Aligning vocals")],
    [/^vocals$/, loginCopy("Rendering vocals")],
    [/^mix$/, loginCopy("Mixing stems")],
    [/^master$/, loginCopy("Mastering output")]
  ];
  const videoMap = [
    [/^video_plan$/, loginCopy("Planning storyboard")],
    [/^video_assemble$/, loginCopy("Assembling scenes")],
    [/^render_mv$/, loginCopy("Rendering final MV")],
    [/^render_master$/, loginCopy("Rendering master video")],
    [/^render$/, loginCopy("Rendering sequence")],
    [/^video_shot_\\d+$/, loginCopy("Rendering shot")],
    [/^shot\\./, loginCopy("Rendering shot")],
    [/^video_shot\\./, loginCopy("Rendering shot")]
  ];
  const karaMap = [
    [/^subtitles$/, loginCopy("Generating subtitles")],
    [/^lyrics_timing$/, loginCopy("Aligning lyric timing")],
    [/^localize$/, loginCopy("Localizing packs")],
    [/^publish$/, loginCopy("Packaging release")],
    [/^render_karaoke_mv\\./, loginCopy("Rendering karaoke MV")]
  ];
  const map = engine === "music" ? musicMap : engine === "video" ? videoMap : karaMap;
  const hit = map.find(([pattern]) => pattern.test(normalized));
  if (hit) return hit[1];
  return prettifyPipelineStageName(raw);
}

function resolveCurrentPipelineStage(stages) {
  const list = Array.isArray(stages) ? stages : [];
  const running = list.find((item) => pipelineStageState(item?.status) === "running");
  if (running) return String(running.name || "").trim();
  const pending = list.find((item) => pipelineStageState(item?.status) === "pending");
  if (pending) return String(pending.name || "").trim();
  const done = [...list].reverse().find((item) => pipelineStageState(item?.status) === "done");
  return done ? String(done.name || "").trim() : "";
}

function joinDetailParts(parts) {
  return (Array.isArray(parts) ? parts : []).map((part) => String(part || "").trim()).filter(Boolean).join(" · ");
}

function countStagesByState(stages, wantedState) {
  return (Array.isArray(stages) ? stages : []).filter((item) => pipelineStageState(item?.status) === wantedState).length;
}

function compactStructureContainerTitle(rootTitle, containerTitle) {
  const root = String(rootTitle || "").trim();
  const container = String(containerTitle || "").trim();
  if (!container) return "";
  if (root && container.startsWith(`${root} · `)) return container.slice(root.length + 3).trim();
  return container;
}

function buildSceneWindowLabel(sceneStart, sceneEnd) {
  const start = Number(sceneStart) || 0;
  const end = Number(sceneEnd) || 0;
  if (!start) return "";
  return end > start ? `Scene ${start}-${end}` : `Scene ${start}`;
}

function buildStructureHeadline(statusNode) {
  const rootTitle = String(statusNode?.root_title || "").trim();
  const containerTitle = compactStructureContainerTitle(statusNode?.root_title, statusNode?.current_container_title);
  const sceneWindow = buildSceneWindowLabel(statusNode?.current_scene_start, statusNode?.current_scene_end);
  const path = Array.isArray(statusNode?.current_structure_path)
    ? statusNode.current_structure_path.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const leafTitle = String(statusNode?.current_label || "").trim() || path[path.length - 1] || "";
  const parts = [];
  if (rootTitle) parts.push(rootTitle);
  if (containerTitle) parts.push(containerTitle);
  if (sceneWindow) parts.push(sceneWindow);
  else if (leafTitle && leafTitle !== containerTitle && leafTitle !== rootTitle) parts.push(leafTitle);
  return joinDetailParts(parts);
}
