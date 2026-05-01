import test from "node:test";
import assert from "node:assert/strict";
import { MediaCore } from "../media/media-core";
import {
  buildRenderedMediaFromRustResult,
  buildRustVideoProjectInput
} from "../media/rust-video-engine";
import type { MusicPlan } from "../schemas/music-plan";
import type { ScenePlan } from "../schemas/scene-plan";
import type { ProjectSpec } from "../core/project-spec";

test("MediaCore emits a composite main video path for multi-scene mv output", () => {
  const mediaCore = new MediaCore();
  const scenePlan: ScenePlan = {
    scenes: [
      { sceneId: "scene_001", label: "Intro", order: 1, durationSec: 60 },
      { sceneId: "scene_002", label: "Verse", order: 2, durationSec: 50 },
      { sceneId: "scene_003", label: "Peak", order: 3, durationSec: 70 }
    ]
  };
  const musicPlan: MusicPlan = {
    tracks: [{ trackId: "track_main_001", label: "Main theme" }],
    cues: [],
    strategy: "hybrid",
    previewSegments: [
      {
        section: "Intro",
        title: "Opening Atmosphere",
        startSec: 0,
        durationSec: 24,
        bars: 8,
        energy: "low",
        audioCue: "soft intro"
      }
    ],
    previewScript: ["Intro · Opening Atmosphere · 0s-24s · low energy · soft intro"]
  };

  const rendered = mediaCore.render(scenePlan, musicPlan);

  assert.equal(rendered.videoSegments.length, 3);
  assert.equal(rendered.mainCompositeVideo, "renders/main_video__03_scenes.mp4");
  assert.equal(rendered.audioPreview, "renders/audio_preview__01_segments.mp3");
  assert.equal(rendered.audioMix, "renders/mix.mp3");
  assert.equal(rendered.totalDurationSec, 180);
  assert.equal(rendered.segmentTimeline?.length, 3);
  assert.equal(rendered.segmentTimeline?.[0]?.startSec, 0);
  assert.equal(rendered.segmentTimeline?.[1]?.startSec, 60);
  assert.match(rendered.segmentTimeline?.[0]?.subtitleText ?? "", /Opening Atmosphere/);
  assert.equal(rendered.subtitleCues?.length, 3);
  assert.equal(rendered.previewStoryboard?.length, 3);
  assert.equal(rendered.previewScript?.length, 1);
  assert.equal(rendered.thumbnails?.[2], "renders/thumb_scene_003.jpg");
  assert.equal(rendered.renderProfile, "mv_stub");
});

test("rust video adapter maps cssMV contracts into engine input and rendered media", () => {
  const project: ProjectSpec = {
    projectId: "mv_rust_001",
    mode: "music_video",
    sourceType: "prompt",
    title: "Emerald Hymn",
    sourceText: "A luminous chorus rises over the skyline.",
    creative: {
      genre: "epic",
      mood: "luminous fantasy"
    },
    songSeed: {
      styleTags: ["emerald-gold"],
      videoOutline: "A mythic ascent through emerald light."
    }
  };
  const scenePlan: ScenePlan = {
    scenes: [
      {
        sceneId: "scene_001",
        label: "Intro",
        sourceSection: "Verse 1",
        sectionType: "verse",
        summary: "Lead wakes under a green aurora.",
        visualScript: "Open with a gliding reveal over moonlit grass.",
        durationSec: 6,
        focusCharacterIds: ["Aria"],
        cameraLanguage: "gliding cinematic motion"
      },
      {
        sceneId: "scene_002",
        label: "Chorus 1",
        sourceSection: "Chorus 1",
        sectionType: "chorus",
        summary: "The skyline opens into radiant towers.",
        visualScript: "Push into the skyline as the chorus lands.",
        durationSec: 6,
        focusCharacterIds: ["Aria", "Choir"],
        cameraLanguage: "gliding cinematic motion"
      }
    ]
  };
  const musicPlan: MusicPlan = {
    tracks: [{ trackId: "track_main_001", label: "Main theme" }],
    cues: [],
    strategy: "full_song",
    previewScript: ["Verse 1 cue", "Chorus 1 cue"]
  };

  const rustInput = buildRustVideoProjectInput(project, scenePlan, musicPlan, "/tmp/demo_mix.wav");
  assert.equal(rustInput.music.duration_secs, 12);
  assert.equal(rustInput.scenes[0]?.section_type, "verse");
  assert.match(rustInput.scenes[1]?.visual_script ?? "", /chorus lands/i);
  assert.ok((rustInput.scenes[1]?.quality?.chorus_impact ?? 0) > (rustInput.scenes[0]?.quality?.chorus_impact ?? 0));
  assert.ok((rustInput.scenes[1]?.quality?.cut_density ?? 0) > (rustInput.scenes[0]?.quality?.cut_density ?? 0));

  const rendered = buildRenderedMediaFromRustResult(scenePlan, musicPlan, "/tmp/demo_mix.wav", {
    thumbnail: {
      enabled: true,
      generated: true,
      video_path: "target/demo/thumb.mp4",
      duration_secs: 4,
      source_scene_ids: [1, 2]
    },
    scene_video_paths: ["target/demo/scene_001.mp4", "target/demo/scene_002.mp4"],
    compose_result: {
      final_video_path: "target/demo/mv_final.mp4",
      matched: true,
      duration_delta_secs: 0,
      output_duration_secs: 12,
      music_duration_secs: 12
    },
    video_source_mode: "reference_media",
    scene_source_diagnostics: [
      {
        scene_id: 1,
        source_mode: "reference_media",
        reference_media_count: 1
      },
      {
        scene_id: 2,
        source_mode: "reference_media",
        reference_media_count: 1
      }
    ],
    continuity_scores: [
      {
        scene_id: 1,
        character_score: 0.8,
        style_score: 0.9,
        shot_score: 0.85,
        overall_score: 0.85,
        notes: ["steady lead continuity"]
      }
    ],
    character_profiles: [
      {
        name: "Aria",
        scene_ids: [1, 2],
        primary_locations: ["moonlit field"],
        props: ["lantern"],
        visual_anchor: "Lead under an emerald aurora"
      }
    ],
    normalized_style: {
      genre: "epic",
      color_palette: "emerald-gold",
      visual_tone: "luminous fantasy",
      camera_language: "gliding cinematic motion",
      consistency_seed: 42
    },
    shot_plans: [
      {
        scene_id: 1,
        shot_size: "close-medium",
        shot_distance_preference: "hero_close",
        ensemble_mode: "solo",
        movement: "glide",
        pacing: "urgent",
        lens_profile: "50mm",
        director_intent: "lift beat with glide movement",
        motion_intensity: 0.68
      }
    ]
  });

  assert.equal(rendered.renderProfile, "mv_rust");
  assert.equal(rendered.mainCompositeVideo, "target/demo/mv_final.mp4");
  assert.equal(rendered.videoSegments.length, 2);
  assert.equal(rendered.videoEngineDetail?.matchedDuration, true);
  assert.equal(rendered.videoEngineDetail?.sourceMode, "reference_media");
  assert.equal(rendered.videoEngineDetail?.sceneSourceDiagnostics?.[0]?.referenceMediaCount, 1);
  assert.equal(rendered.videoEngineDetail?.continuityScores?.[0]?.sceneId, "scene_001");
  assert.equal(rendered.videoEngineDetail?.normalizedStyle?.consistencySeed, 42);
});

test("rust video adapter synthesizes imagined scenes when no scene input is available", () => {
  const project: ProjectSpec = {
    projectId: "mv_rust_imagined_001",
    mode: "music_video",
    sourceType: "prompt",
    title: "Imagined Horizon",
    sourceText: "When nothing arrives, the engine should still imagine visible worlds."
  };
  const scenePlan: ScenePlan = { scenes: [] };
  const musicPlan: MusicPlan = {
    tracks: [{ trackId: "track_main_001", label: "Main theme" }],
    cues: [],
    strategy: "full_song",
    previewSegments: [
      {
        section: "Intro",
        title: "First Light",
        startSec: 0,
        durationSec: 8,
        bars: 4,
        energy: "low",
        audioCue: "mist opens"
      },
      {
        section: "Chorus",
        title: "Skyline Bloom",
        startSec: 8,
        durationSec: 10,
        bars: 8,
        energy: "peak",
        audioCue: "the world opens"
      }
    ]
  };

  const rustInput = buildRustVideoProjectInput(project, scenePlan, musicPlan, "/tmp/demo_mix.wav");
  assert.equal(rustInput.scenes.length, 2);
  assert.match(rustInput.scenes[0]?.visual_script ?? "", /imagined/i);
  assert.match(rustInput.scenes[1]?.visual_script ?? "", /Avoid abstract test-pattern imagery/i);
  assert.equal(rustInput.music.duration_secs, 18);
});
