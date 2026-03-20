import test from "node:test";
import assert from "node:assert/strict";
import { MVPlanner } from "../modes/mv-planner";
import type { ProjectSpec } from "../core/project-spec";
import type { StoryGraph } from "../schemas/story-graph";

const graph: StoryGraph = {
  meta: {
    storyId: "sg_test_001",
    title: "Test Story",
    sourceType: "prompt",
    defaultMode: "music_video",
    tone: "lyrical"
  },
  characters: [
    {
      characterId: "c1",
      name: "Lead",
      role: "protagonist"
    }
  ],
  conflicts: [
    {
      conflictId: "cf1",
      type: "romantic",
      summary: "Distance keeps the leads apart.",
      participants: ["c1"]
    }
  ],
  arcs: [
    {
      arcId: "a1",
      arcType: "character_growth",
      ownerIds: ["c1"],
      endState: "reunion"
    }
  ]
};

test("MVPlanner returns scene blocks and music strategy for music_video", () => {
  const planner = new MVPlanner();
  const project: ProjectSpec = {
    projectId: "mv_plan_001",
    mode: "music_video",
    sourceType: "prompt",
    title: "Seeded Plan",
    sourceText: "Seeded plan",
    durationSec: 180,
    songSeed: {
      sectionPrompts: [
        { section: "Intro", title: "Opening Atmosphere", prompt: "Open the jade gate." },
        { section: "Verse 1", title: "Theme Arrival", prompt: "Reveal the heroine." }
      ],
      sectionBeats: [
        {
          section: "Intro",
          title: "Opening Atmosphere",
          bars: 8,
          energy: "low",
          focus: "opening atmosphere",
          visualRole: "title reveal"
        },
        {
          section: "Verse 1",
          title: "Theme Arrival",
          bars: 16,
          energy: "medium",
          focus: "hero enters",
          visualRole: "character reveal"
        }
      ]
    }
  };
  const result = planner.plan(project, graph, 180);

  assert.equal(result.mode, "music_video");
  assert.equal(result.plan.type, "mv");
  assert.equal(result.plan.durationSec, 180);
  assert.ok(result.plan.sceneBlocks.length >= 2);
  assert.equal(result.plan.sceneBlocks[0]?.beatBars, 8);
  assert.equal(result.plan.sceneBlocks[0]?.prompt, "Open the jade gate.");
  assert.ok(["full_song", "hybrid"].includes(result.plan.musicStrategy));
});
