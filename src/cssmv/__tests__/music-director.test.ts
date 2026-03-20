import test from "node:test";
import assert from "node:assert/strict";
import { MusicDirector } from "../music/music-director";
import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { ScenePlan } from "../schemas/scene-plan";
import type { StoryGraph } from "../schemas/story-graph";

test("MusicDirector turns scene sections into preview segments and beat-aware cues", () => {
  const director = new MusicDirector();
  const graph: StoryGraph = {
    meta: {
      storyId: "sg_music_001",
      title: "Seeded Song",
      sourceType: "prompt",
      defaultMode: "music_video",
      tone: "lyrical"
    },
    characters: [{ characterId: "lead", name: "Lead", role: "protagonist" }],
    conflicts: [],
    arcs: []
  };
  const narrative: NarrativePlanEnvelope = {
    mode: "music_video",
    plan: {
      type: "mv",
      durationSec: 198,
      emotionalCurve: ["setup", "lift", "peak", "resolve"],
      sceneBlocks: [],
      musicStrategy: "hybrid"
    }
  };
  const scenePlan: ScenePlan = {
    scenes: [
      {
        sceneId: "scene_001",
        label: "Verse 1: Theme Arrival",
        sourceSection: "Verse 1",
        durationSec: 24,
        visualRole: "character reveal"
      },
      {
        sceneId: "scene_002",
        label: "Chorus 1: First Invocation",
        sourceSection: "Chorus 1",
        durationSec: 32,
        visualRole: "particle ignition"
      }
    ]
  };

  const plan = director.plan(graph, narrative, scenePlan);

  assert.equal(plan.strategy, "full_song");
  assert.equal(plan.previewSegments?.length, 2);
  assert.equal(plan.previewSegments?.[0]?.section, "Verse 1");
  assert.equal(plan.previewSegments?.[1]?.startSec, 24);
  assert.equal(plan.cues[1]?.energy, "high");
  assert.equal(plan.previewSegments?.[1]?.hookRole, "return");
  assert.equal(plan.previewSegments?.[0]?.hookRole, "setup");
  assert.ok(plan.previewScript?.[1]?.includes("Chorus 1"));
  assert.ok(plan.previewScript?.[1]?.includes("return hook role"));
});
