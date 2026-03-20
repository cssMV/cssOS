import test from "node:test";
import assert from "node:assert/strict";
import { MediaCore } from "../media/media-core";
import type { MusicPlan } from "../schemas/music-plan";
import type { ScenePlan } from "../schemas/scene-plan";

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
  assert.equal(rendered.audioPreview, "renders/audio_preview__01_segments.wav");
  assert.equal(rendered.totalDurationSec, 180);
  assert.equal(rendered.previewStoryboard?.length, 3);
  assert.equal(rendered.previewScript?.length, 1);
  assert.equal(rendered.renderProfile, "mv_stub");
});
