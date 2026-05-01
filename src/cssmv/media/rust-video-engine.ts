import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { ProjectSpec } from "../core/project-spec";
import type { MusicPlan } from "../schemas/music-plan";
import type {
  RenderedMedia,
  RenderedSegment,
  VideoCharacterProfile,
  VideoContinuityScore,
  VideoEngineDetail,
  VideoNormalizedStyle,
  VideoShotPlan,
  VideoSourceDiagnostic
} from "../schemas/rendered-media";
import type { SceneNode, ScenePlan } from "../schemas/scene-plan";

export interface RustVideoSceneInput {
  id: number;
  section_type: string;
  text_block: string;
  visual_script: string;
  duration_secs: number;
  reference_media_paths?: string[];
  director?: {
    emotional_beat?: string;
    energy_profile?: string;
    shot_type?: string;
    camera_move?: string;
    camera_language?: string;
    director_notes?: string[];
  };
  quality?: {
    motion_intensity?: number;
    cut_density?: number;
    continuity_priority?: number;
    performance_focus?: number;
    chorus_impact?: number;
    avoid_static_frames?: boolean;
  };
  entities: {
    characters: string[];
    location: string;
    props: string[];
  };
}

export interface RustVideoProjectInput {
  project_id: string;
  project_prompt: string;
  reference_media_paths?: string[];
  music: {
    audio_path: string;
    duration_secs: number;
  };
  thumbnail: {
    enabled: boolean;
    duration_secs: number;
  };
  style_profile: {
    genre: string;
    color_palette?: string;
    visual_tone?: string;
    camera_language?: string;
    quality_profile?: {
      motion_intensity?: number;
      cut_density?: number;
      continuity_priority?: number;
      performance_focus?: number;
      chorus_impact?: number;
      avoid_static_frames?: boolean;
    };
  };
  scenes: RustVideoSceneInput[];
}

export interface RustVideoProjectResult {
  thumbnail: {
    enabled: boolean;
    generated: boolean;
    video_path?: string;
    duration_secs: number;
    source_scene_ids: number[];
  };
  scene_video_paths: string[];
  compose_result: {
    final_video_path: string;
    matched: boolean;
    duration_delta_secs: number;
    output_duration_secs: number;
    music_duration_secs: number;
  };
  video_source_mode: string;
  scene_source_diagnostics: Array<{
    scene_id: number;
    source_mode: string;
    reference_media_count: number;
  }>;
  continuity_scores: Array<{
    scene_id: number;
    character_score: number;
    style_score: number;
    shot_score: number;
    overall_score: number;
    notes: string[];
  }>;
  character_profiles: Array<{
    name: string;
    scene_ids: number[];
    primary_locations: string[];
    props: string[];
    visual_anchor: string;
  }>;
  normalized_style: {
    genre: string;
    color_palette?: string;
    visual_tone: string;
    camera_language: string;
    consistency_seed: number;
  };
  shot_plans: Array<{
    scene_id: number;
    shot_size: string;
    shot_distance_preference: string;
    ensemble_mode: string;
    movement: string;
    pacing: string;
    lens_profile: string;
    director_intent: string;
    motion_intensity: number;
  }>;
}

export interface MediaRenderContext {
  project?: ProjectSpec;
  audioMixPath?: string;
  artifactRootDir?: string;
  preferRustVideoEngine?: boolean;
  fallbackToStub?: boolean;
}

function buildSubtitleText(scene: SceneNode, musicPlan: MusicPlan, index: number): string {
  const previewSegment = musicPlan.previewSegments?.[index];
  if (previewSegment?.title && previewSegment?.audioCue) {
    return `${previewSegment.title} - ${previewSegment.audioCue}`;
  }
  return scene.summary || scene.visualPrompt || scene.label;
}

export function buildSegmentTimeline(scenePlan: ScenePlan, musicPlan: MusicPlan, videoPaths?: string[]): RenderedSegment[] {
  let runningSec = 0;
  return scenePlan.scenes.map((scene, index) => {
    const durationSec = Math.max(1, scene.durationSec ?? 0);
    const startSec = runningSec;
    const endSec = startSec + durationSec;
    const transitionToNext = scenePlan.transitions?.find(
      (transition) => transition.fromSceneId === scene.sceneId
    )?.kind;
    const segment: RenderedSegment = {
      sceneId: scene.sceneId,
      label: scene.label,
      videoPath: videoPaths?.[index] ?? `renders/${scene.sceneId}.mp4`,
      startSec,
      endSec,
      durationSec,
      ...(transitionToNext ? { transitionToNext } : {}),
      subtitleText: buildSubtitleText(scene, musicPlan, index),
      ...(scene.workType ? { workType: scene.workType } : {}),
      ...(scene.structureNodeId ? { structureNodeId: scene.structureNodeId } : {}),
      ...(scene.parentStructureNodeId ? { parentStructureNodeId: scene.parentStructureNodeId } : {}),
      ...(scene.structureRole ? { structureRole: scene.structureRole } : {}),
      ...(scene.structurePath?.length ? { structurePath: scene.structurePath } : {})
    };
    runningSec = endSec;
    return segment;
  });
}

export function buildPreviewStoryboard(scenePlan: ScenePlan): string[] {
  return scenePlan.scenes.map((scene, index) => {
    const prompt = scene.visualScript || scene.visualPrompt || scene.summary || "cinematic mv preview frame";
    const role = scene.visualRole || scene.emotionalBeat || "performance beat";
    return `${String(index + 1).padStart(2, "0")}. ${scene.label} · ${role} · ${prompt}`;
  });
}

function buildSubtitleCues(segments: RenderedSegment[]): string[] {
  return segments.map(
    (segment) =>
      `${segment.startSec.toFixed(0)}-${segment.endSec.toFixed(0)}s · ${segment.label} · ${segment.subtitleText || "instrumental interlude"}`
  );
}

function sumSceneDuration(scenePlan: ScenePlan): number {
  return Number(
    scenePlan.scenes.reduce((sum, scene) => sum + Math.max(0, scene.durationSec ?? 0), 0).toFixed(3)
  );
}

function inferLocation(scene: SceneNode): string {
  const source = `${scene.visualPrompt || ""} ${scene.summary || ""}`.trim();
  if (!source) return scene.label;
  const parts = source.split(/[,.]/).map((part) => part.trim()).filter(Boolean);
  return parts[0] || scene.label;
}

function inferProps(scene: SceneNode): string[] {
  const source = `${scene.visualRole || ""} ${scene.visualPrompt || ""}`.toLowerCase();
  const candidates = ["lantern", "banner", "rain", "light shards", "glass", "flowers", "halo"];
  return candidates.filter((item) => source.includes(item.replace(/\s+/g, " ")));
}

function imaginativePrompt(project: ProjectSpec, sectionLabel: string, index: number): string {
  const source =
    project.songSeed?.videoOutline ||
    project.songSeed?.lyrics ||
    project.sourceText ||
    project.creative?.prompt ||
    project.title ||
    "an imagined lyrical world";
  const motifs = [
    "a luminous protagonist crossing a breathing landscape",
    "wind-carved architecture and drifting ceremonial light",
    "figures emerging from distance with cinematic depth",
    "a living horizon responding to rhythm and emotion",
    "mythic weather, fabric, halos, water, and firelight in motion"
  ];
  return `${sectionLabel} imagined for ${project.title || project.projectId}. ${source}. ${
    motifs[index % motifs.length]
  }. Avoid abstract test-pattern imagery and show readable people, places, and atmosphere.`;
}

function synthesizeFallbackScenes(project: ProjectSpec, musicPlan: MusicPlan): SceneNode[] {
  const previewSegments = Array.isArray(musicPlan.previewSegments) ? musicPlan.previewSegments : [];
  if (previewSegments.length > 0) {
    return previewSegments.map((segment, index) => ({
      sceneId: `scene_${String(index + 1).padStart(3, "0")}`,
      label: segment.title || segment.section || `Scene ${index + 1}`,
      sourceSection: segment.section || `Section ${index + 1}`,
      sectionType: String(segment.section || "passage").toLowerCase().replace(/\s+/g, "_"),
      summary: imaginativePrompt(project, segment.title || segment.section || `Scene ${index + 1}`, index),
      visualPrompt: imaginativePrompt(project, segment.title || segment.section || `Scene ${index + 1}`, index),
      visualScript: imaginativePrompt(project, segment.title || segment.section || `Scene ${index + 1}`, index),
      order: index + 1,
      durationSec: Math.max(4, segment.durationSec || 0),
      emotionalBeat:
        index === 0 ? "setup" : index === previewSegments.length - 1 ? "resolve" : segment.energy === "peak" ? "peak" : "lift",
      energyProfile:
        segment.energy === "peak" || segment.energy === "high"
          ? "peak"
          : segment.energy === "low"
            ? "low"
            : "medium",
      shotType: index === 0 ? "wide" : segment.energy === "peak" ? "wide" : "close_medium",
      cameraMove: segment.energy === "peak" ? "orbit" : index === 0 ? "glide" : "push",
      focusCharacterIds: ["Imagined Lead"]
    }));
  }

  const totalDuration =
    Number(project.durationSec) ||
    Number(project.creative?.duration_s) ||
    24;
  const blockCount = Math.max(2, Math.min(6, Math.round(totalDuration / 24)));
  const sectionLabels = ["Intro", "Verse", "Lift", "Chorus", "Bridge", "Outro"].slice(0, blockCount);
  const baseDuration = Math.max(4, totalDuration / sectionLabels.length);

  return sectionLabels.map((label, index) => ({
    sceneId: `scene_${String(index + 1).padStart(3, "0")}`,
    label,
    sourceSection: label,
    sectionType: label.toLowerCase().replace(/\s+/g, "_"),
    summary: imaginativePrompt(project, label, index),
    visualPrompt: imaginativePrompt(project, label, index),
    visualScript: imaginativePrompt(project, label, index),
    order: index + 1,
    durationSec: Math.round(baseDuration * 10) / 10,
    emotionalBeat: index === 0 ? "setup" : index === sectionLabels.length - 1 ? "resolve" : label === "Chorus" ? "peak" : "lift",
    energyProfile: label === "Chorus" ? "peak" : label === "Outro" ? "medium" : "high",
    shotType: label === "Chorus" ? "wide" : label === "Outro" ? "aerial" : "close_medium",
    cameraMove: label === "Chorus" ? "orbit" : label === "Bridge" ? "push" : "glide",
    focusCharacterIds: ["Imagined Lead"]
  }));
}

export function buildRustVideoProjectInput(
  project: ProjectSpec,
  scenePlan: ScenePlan,
  musicPlan: MusicPlan,
  audioMixPath: string
): RustVideoProjectInput {
  const existingLocalMedia = (items: Array<string | undefined | null>): string[] =>
    items
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && !/^https?:\/\//i.test(item) && fs.existsSync(item));
  const projectReferenceMedia = existingLocalMedia(project.songSeed?.references || []);
  const normalizedScenes =
    scenePlan.scenes.length > 0
      ? scenePlan.scenes.map((scene, index) => ({
          ...scene,
          visualScript:
            scene.visualScript ||
            scene.visualPrompt ||
            scene.summary ||
            imaginativePrompt(project, scene.label || scene.sourceSection || `Scene ${index + 1}`, index),
          visualPrompt:
            scene.visualPrompt ||
            scene.visualScript ||
            scene.summary ||
            imaginativePrompt(project, scene.label || scene.sourceSection || `Scene ${index + 1}`, index)
        }))
      : synthesizeFallbackScenes(project, musicPlan);
  const sceneReferenceMedia = normalizedScenes.map((scene) =>
    existingLocalMedia([
      ...(scene.referenceMediaPaths || []),
      scene.thumbnailPath,
      ...projectReferenceMedia
    ])
  );
  const durationSecs = Number(
    normalizedScenes.reduce((sum, scene) => sum + Math.max(0, scene.durationSec ?? 0), 0).toFixed(3)
  );
  const thumbnailDuration = Math.min(5, Math.max(3, Math.min(4, durationSecs / 3 || 4)));
  const projectPrompt =
    project.songSeed?.videoOutline ||
    project.sourceText ||
    project.creative?.prompt ||
    project.title ||
    project.projectId;
  const styleTags = project.songSeed?.styleTags?.join(", ");
  const cameraLanguage = scenePlan.scenes[0]?.cameraLanguage || project.creative?.licensed_style_pack;

  return {
    project_id: project.projectId,
    project_prompt: projectPrompt,
    ...(projectReferenceMedia.length ? { reference_media_paths: projectReferenceMedia } : {}),
    music: {
      audio_path: audioMixPath,
      duration_secs: durationSecs
    },
    thumbnail: {
      enabled: true,
      duration_secs: thumbnailDuration
    },
    style_profile: {
      genre: project.creative?.genre || project.songSeed?.musicStyle || "cinematic",
      ...(styleTags ? { color_palette: styleTags } : {}),
      ...(project.creative?.mood ? { visual_tone: project.creative.mood } : {}),
      ...(cameraLanguage ? { camera_language: cameraLanguage } : {}),
      quality_profile: {
        motion_intensity: 0.7,
        cut_density: 0.62,
        continuity_priority: 0.82,
        performance_focus: 0.72,
        chorus_impact: 0.88,
        avoid_static_frames: true
      }
    },
    scenes: normalizedScenes.map((scene, index) => {
      const musicPreview = musicPlan.previewSegments?.[index];
      const sceneMedia = sceneReferenceMedia[index] || projectReferenceMedia;
      const energyKey = String(
        musicPreview?.energy || scene.energyProfile || scene.emotionalBeat || "medium"
      ).toLowerCase();
      const sectionKey = String(scene.sectionType || scene.sourceSection || scene.label || "").toLowerCase();
      const motionIntensity = energyKey.includes("peak")
        ? 0.92
        : energyKey.includes("high")
          ? 0.8
          : energyKey.includes("low")
            ? 0.46
            : 0.64;
      const cutDensity = sectionKey.includes("chorus")
        ? 0.84
        : sectionKey.includes("bridge")
          ? 0.62
          : sectionKey.includes("outro")
            ? 0.34
            : 0.52;
      const continuityPriority = scene.focusCharacterIds?.length && scene.focusCharacterIds.length <= 2 ? 0.84 : 0.74;
      const performanceFocus =
        sectionKey.includes("chorus") || energyKey.includes("peak") ? 0.9 : scene.focusCharacterIds?.length ? 0.78 : 0.66;
      const chorusImpact = sectionKey.includes("chorus") ? 0.94 : sectionKey.includes("bridge") ? 0.68 : 0.48;
      const director =
        scene.emotionalBeat ||
        scene.energyProfile ||
        scene.shotType ||
        scene.cameraMove ||
        scene.cameraLanguage ||
        scene.directorNotes?.length
          ? {
              ...(scene.emotionalBeat ? { emotional_beat: scene.emotionalBeat } : {}),
              ...(scene.energyProfile ? { energy_profile: scene.energyProfile } : {}),
              ...(scene.shotType ? { shot_type: scene.shotType } : {}),
              ...(scene.cameraMove ? { camera_move: scene.cameraMove } : {}),
              ...(scene.cameraLanguage ? { camera_language: scene.cameraLanguage } : {}),
              ...(scene.directorNotes?.length ? { director_notes: scene.directorNotes } : {})
            }
          : null;
      return {
        id: index + 1,
        section_type: scene.sectionType || scene.sourceSection || scene.label,
        text_block: scene.summary || scene.label,
        visual_script: scene.visualScript || scene.visualPrompt || scene.summary || scene.label,
        duration_secs: Math.max(0.1, scene.durationSec ?? 0),
        ...(director ? { director } : {}),
        quality: {
          motion_intensity: motionIntensity,
          cut_density: cutDensity,
          continuity_priority: continuityPriority,
          performance_focus: performanceFocus,
          chorus_impact: chorusImpact,
          avoid_static_frames: true
        },
        entities: {
          characters: scene.focusCharacterIds || [],
          location: inferLocation(scene),
          props: inferProps(scene)
        },
        ...(sceneMedia.length ? { reference_media_paths: sceneMedia } : {})
      };
    })
  };
}

function mapContinuityScores(
  scores: RustVideoProjectResult["continuity_scores"]
): VideoContinuityScore[] {
  return scores.map((score) => ({
    sceneId: `scene_${String(score.scene_id).padStart(3, "0")}`,
    characterScore: score.character_score,
    styleScore: score.style_score,
    shotScore: score.shot_score,
    overallScore: score.overall_score,
    notes: score.notes
  }));
}

function mapCharacterProfiles(
  profiles: RustVideoProjectResult["character_profiles"]
): VideoCharacterProfile[] {
  return profiles.map((profile) => ({
    name: profile.name,
    sceneIds: profile.scene_ids,
    primaryLocations: profile.primary_locations,
    props: profile.props,
    visualAnchor: profile.visual_anchor
  }));
}

function mapNormalizedStyle(
  style: RustVideoProjectResult["normalized_style"]
): VideoNormalizedStyle {
  return {
    genre: style.genre,
    ...(style.color_palette ? { colorPalette: style.color_palette } : {}),
    visualTone: style.visual_tone,
    cameraLanguage: style.camera_language,
    consistencySeed: style.consistency_seed
  };
}

function mapShotPlans(
  shotPlans: RustVideoProjectResult["shot_plans"]
): VideoShotPlan[] {
  return shotPlans.map((plan) => ({
    sceneId: plan.scene_id,
    shotSize: plan.shot_size,
    shotDistancePreference: plan.shot_distance_preference,
    ...(plan.ensemble_mode
      ? { ensembleMode: plan.ensemble_mode as NonNullable<VideoShotPlan["ensembleMode"]> }
      : {}),
    movement: plan.movement,
    pacing: plan.pacing,
    lensProfile: plan.lens_profile,
    directorIntent: plan.director_intent,
    motionIntensity: plan.motion_intensity
  }));
}

function mapSceneSourceDiagnostics(
  diagnostics: RustVideoProjectResult["scene_source_diagnostics"]
): VideoSourceDiagnostic[] {
  return diagnostics.map((item) => ({
    sceneId: item.scene_id,
    sourceMode: item.source_mode,
    referenceMediaCount: item.reference_media_count
  }));
}

export function buildRenderedMediaFromRustResult(
  scenePlan: ScenePlan,
  musicPlan: MusicPlan,
  audioMixPath: string,
  rustResult: RustVideoProjectResult
): RenderedMedia {
  const segmentTimeline = buildSegmentTimeline(scenePlan, musicPlan, rustResult.scene_video_paths);
  const previewStoryboard = buildPreviewStoryboard(scenePlan);
  const videoEngineDetail: VideoEngineDetail = {
    engineId: "cssmv-video-engine",
    mode: "rust_cli",
    sourceMode: rustResult.video_source_mode,
    sceneSourceDiagnostics: mapSceneSourceDiagnostics(rustResult.scene_source_diagnostics),
    ...(rustResult.thumbnail.video_path ? { thumbnailVideo: rustResult.thumbnail.video_path } : {}),
    matchedDuration: rustResult.compose_result.matched,
    durationDeltaSec: rustResult.compose_result.duration_delta_secs,
    continuityScores: mapContinuityScores(rustResult.continuity_scores),
    characterProfiles: mapCharacterProfiles(rustResult.character_profiles),
    normalizedStyle: mapNormalizedStyle(rustResult.normalized_style),
    shotPlans: mapShotPlans(rustResult.shot_plans)
  };

  return {
    videoSegments: rustResult.scene_video_paths,
    mainCompositeVideo: rustResult.compose_result.final_video_path,
    audioMix: audioMixPath,
    subtitleTrack: "renders/subtitles.vtt",
    subtitleCues: buildSubtitleCues(segmentTimeline),
    segmentTimeline,
    previewStoryboard,
    previewScript: musicPlan.previewScript ?? [],
    totalDurationSec: rustResult.compose_result.output_duration_secs,
    ...(rustResult.thumbnail.video_path ? { thumbnails: [rustResult.thumbnail.video_path] } : {}),
    renderProfile: "mv_rust",
    videoEngineDetail,
    ...(scenePlan.workType ? { workType: scenePlan.workType } : {}),
    ...(scenePlan.structureTree?.length ? { structureTree: scenePlan.structureTree } : {})
  };
}

function resolveRustEngineCommand(inputPath: string, outputPath: string): { command: string; args: string[] } {
  const explicitBin = String(process.env.CSSMV_RUST_VIDEO_ENGINE_BIN || "").trim();
  if (explicitBin) {
    return {
      command: explicitBin,
      args: [inputPath, "--output-json", outputPath]
    };
  }

  return {
    command: "cargo",
    args: ["run", "--quiet", "--bin", "cssmv-video-engine", "--", inputPath, "--output-json", outputPath]
  };
}

export function tryRenderWithRustVideoEngine(
  scenePlan: ScenePlan,
  musicPlan: MusicPlan,
  context: MediaRenderContext
): { renderedMedia?: RenderedMedia; errorMessage?: string } {
  const project = context.project;
  const audioMixPath = context.audioMixPath;
  if (!project || !audioMixPath) {
    return {
      errorMessage: "rust video engine skipped: missing project context or audio mix path"
    };
  }
  if (!fs.existsSync(audioMixPath)) {
    return {
      errorMessage: `rust video engine skipped: missing audio mix at ${audioMixPath}`
    };
  }

  const rootDir =
    context.artifactRootDir ||
    path.resolve(process.cwd(), "artifacts", "cssmv", project.projectId, "video-engine");
  fs.mkdirSync(rootDir, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cssmv-video-engine-"));
  const inputPath = path.join(tempDir, `${project.projectId}.input.json`);
  const outputPath = path.join(tempDir, `${project.projectId}.output.json`);
  const payload = buildRustVideoProjectInput(project, scenePlan, musicPlan, audioMixPath);
  fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2), "utf8");

  const commandDef = resolveRustEngineCommand(inputPath, outputPath);
  const result = spawnSync(commandDef.command, commandDef.args, {
    cwd: path.resolve(process.cwd()),
    env: process.env,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return {
      errorMessage: [result.stdout, result.stderr].filter(Boolean).join("\n").trim() || "rust video engine failed"
    };
  }

  if (!fs.existsSync(outputPath)) {
    return {
      errorMessage: "rust video engine finished without writing output json"
    };
  }

  const rustResult = JSON.parse(fs.readFileSync(outputPath, "utf8")) as RustVideoProjectResult;
  return {
    renderedMedia: buildRenderedMediaFromRustResult(scenePlan, musicPlan, audioMixPath, rustResult)
  };
}
