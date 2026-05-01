import test from "node:test";
import assert from "node:assert/strict";
import { SceneComposer } from "../media/scene-composer";
import { SceneDirector } from "../media/scene-director";
import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { StoryGraph } from "../schemas/story-graph";
import type { ProjectSpec } from "../core/project-spec";

const graph: StoryGraph = {
  meta: {
    storyId: "sg_scene_test",
    title: "Scene Test",
    sourceType: "prompt",
    defaultMode: "music_video",
    tone: "lyrical"
  },
  characters: [
    {
      characterId: "lead_001",
      name: "Lead",
      role: "protagonist"
    }
  ],
  conflicts: [
    {
      conflictId: "cf_001",
      type: "romantic",
      summary: "The city keeps them apart.",
      participants: ["lead_001"]
    }
  ],
  arcs: [
    {
      arcId: "arc_001",
      arcType: "character_growth",
      ownerIds: ["lead_001"]
    }
  ]
};

test("SceneComposer expands mv sceneBlocks into multiple scenes", () => {
  const composer = new SceneComposer();
  const narrative: NarrativePlanEnvelope = {
    mode: "music_video",
    plan: {
      type: "mv",
      durationSec: 180,
      emotionalCurve: ["setup", "lift", "peak", "resolve"],
      musicStrategy: "hybrid",
      sceneBlocks: [
        { blockId: "sb_001", label: "Intro", summary: "Open on the city lights." },
        { blockId: "sb_002", label: "Lift", summary: "Motion starts building." },
        { blockId: "sb_003", label: "Peak", summary: "The chorus lands." }
      ]
    }
  };

  const scenePlan = composer.compose(narrative, graph);

  assert.equal(scenePlan.scenes.length, 3);
  assert.equal(scenePlan.scenes[0]?.sourceBlockId, "sb_001");
  assert.equal(scenePlan.scenes[1]?.sourceBlockId, "sb_002");
  assert.equal(scenePlan.transitions?.length, 2);
});

test("SceneDirector enriches mv scenes with camera language and visual scripts", () => {
  const composer = new SceneComposer();
  const director = new SceneDirector();
  const narrative: NarrativePlanEnvelope = {
    mode: "music_video",
    plan: {
      type: "mv",
      durationSec: 180,
      emotionalCurve: ["setup", "lift", "peak", "resolve"],
      musicStrategy: "hybrid",
      sceneBlocks: [
        { blockId: "sb_001", label: "Intro", summary: "Open on the city lights." },
        { blockId: "sb_002", label: "Chorus 1", summary: "The skyline bursts with motion." }
      ]
    }
  };
  const project: ProjectSpec = {
    projectId: "scene_director_test",
    mode: "music_video",
    sourceType: "prompt",
    title: "Skyline Pulse",
    sourceText: "A city anthem that rises into a luminous chorus."
  };

  const scenePlan = composer.compose(narrative, graph);
  const directed = director.direct(scenePlan, narrative, graph, project);

  assert.equal(directed.scenes[0]?.emotionalBeat, "setup");
  assert.equal(directed.scenes[1]?.sectionType, "chorus");
  assert.equal(directed.scenes[1]?.energyProfile, "peak");
  assert.equal(typeof directed.scenes[0]?.visualScript, "string");
  assert.match(directed.scenes[1]?.visualScript ?? "", /avoid static dead frames/i);
  assert.equal(directed.scenes[0]?.cameraMove, "glide");
});
