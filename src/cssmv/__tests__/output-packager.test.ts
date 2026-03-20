import test from "node:test";
import assert from "node:assert/strict";
import { OutputPackager } from "../output/output-packager";
import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { MusicPlan } from "../schemas/music-plan";
import type { RenderedMedia } from "../schemas/rendered-media";
import type { ScenePlan } from "../schemas/scene-plan";

test("OutputPackager exposes mainVideo and metadata", () => {
  const packager = new OutputPackager();
  const rendered: RenderedMedia = {
    videoSegments: ["renders/scene_001.mp4", "renders/scene_002.mp4"],
    mainCompositeVideo: "renders/main_video__02_scenes.mp4",
    audioMix: "renders/main.wav",
    audioPreview: "renders/audio_preview__02_segments.wav",
    subtitleTrack: "renders/subtitles.vtt",
    totalDurationSec: 180,
    previewStoryboard: ["01. Intro", "02. Peak"],
    previewScript: ["Intro cue", "Peak cue"],
    renderProfile: "mv_stub"
  };
  const narrative: NarrativePlanEnvelope = {
    mode: "music_video",
    plan: {
      type: "mv",
      durationSec: 180,
      emotionalCurve: ["setup", "peak"],
      sceneBlocks: [],
      musicStrategy: "hybrid"
    }
  };
  const music: MusicPlan = {
    tracks: [{ trackId: "track_001", label: "Main theme" }],
    cues: [{ cueId: "cue_001", label: "Open", targetSceneId: "scene_001" }],
    strategy: "hybrid",
    previewSegments: [
      {
        section: "Intro",
        title: "Open",
        startSec: 0,
        durationSec: 90,
        bars: 16,
        energy: "medium",
        audioCue: "Open cue"
      },
      {
        section: "Peak",
        title: "Peak",
        startSec: 90,
        durationSec: 90,
        bars: 16,
        energy: "peak",
        audioCue: "Peak cue"
      }
    ],
    previewScript: ["Intro cue", "Peak cue"]
  };
  const scenePlan: ScenePlan = {
    scenes: [
      { sceneId: "scene_001", label: "Intro", order: 1, durationSec: 90 },
      { sceneId: "scene_002", label: "Peak", order: 2, durationSec: 90 }
    ]
  };

  const output = packager.package(rendered, narrative, music, scenePlan);

  assert.equal(output.mainVideo, "renders/main_video__02_scenes.mp4");
  assert.deepEqual(output.subtitles, ["renders/subtitles.vtt"]);
  assert.equal(output.metadata?.mode, "music_video");
  assert.equal(output.metadata?.musicStrategy, "hybrid");
  assert.equal(output.metadata?.sceneCount, 2);
  assert.equal(output.metadata?.cueCount, 1);
  assert.equal(output.metadata?.durationSec, 180);
  assert.equal(output.metadata?.previewSegmentCount, 2);
  assert.equal(output.metadata?.previewScriptLineCount, 2);
  assert.equal(output.metadata?.previewStoryboardFrameCount, 2);
  assert.deepEqual(output.clips, ["renders/scene_001.mp4", "renders/scene_002.mp4"]);
});
