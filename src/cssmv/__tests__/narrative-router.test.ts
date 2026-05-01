import test from "node:test";
import assert from "node:assert/strict";

import { NarrativePlannerRouter } from "../narrative/narrative-planner-router";
import type { ProjectSpec } from "../core/project-spec";
import type { StoryGraph } from "../schemas/story-graph";

const graph: StoryGraph = {
  meta: {
    storyId: "sg_router_001",
    title: "Router Story",
    sourceType: "prompt",
    defaultMode: "music_video",
    tone: "lyrical"
  },
  characters: [{ characterId: "c1", name: "Lead", role: "protagonist" }],
  conflicts: [],
  arcs: []
};

test("NarrativePlannerRouter derives mv duration from section beats instead of defaulting to 180s", () => {
  const router = new NarrativePlannerRouter();
  const project: ProjectSpec = {
    projectId: "mv_router_001",
    mode: "music_video",
    sourceType: "prompt",
    title: "Durational Truth",
    songSeed: {
      sectionBeats: [
        {
          section: "Verse 1",
          title: "Opening",
          bars: 8,
          energy: "low",
          focus: "quiet beginning",
          visualRole: "introduce the lead"
        },
        {
          section: "Chorus 1",
          title: "Lift",
          bars: 16,
          energy: "high",
          focus: "big emotional rise",
          visualRole: "open the skyline"
        }
      ]
    }
  };

  const result = router.plan(project, graph);
  assert.equal(result.mode, "music_video");
  assert.equal(result.plan.type, "mv");
  assert.equal(result.plan.durationSec, 48);
  assert.equal(result.plan.sceneBlocks[0]?.durationSec, 16);
  assert.equal(result.plan.sceneBlocks[1]?.durationSec, 32);
});
