import test from "node:test";
import assert from "node:assert/strict";
import { CssMVEngine } from "../core/cssmv-engine";
import type { ProjectSpec } from "../core/project-spec";

test("CssMVEngine closes the music_video chain with mainVideo output", () => {
  const engine = new CssMVEngine();
  const project: ProjectSpec = {
    projectId: "mv_test_001",
    mode: "music_video",
    sourceType: "prompt",
    title: "Neon Hearts",
    sourceText: "Two people drift through a city at night and find each other in the chorus.",
    durationSec: 165,
    capabilities: ["single_line"],
    songSeed: {
      musicStructure: "Intro breathes, verses build, choruses lift, bridge turns cosmic, final chorus explodes.",
      videoOutline: "A neon city turns into an emotional anthem with particle bursts on the choruses.",
      sectionPrompts: [
        { section: "Intro", title: "Night Arrival", prompt: "Rain, rail lights, and a distant silhouette." },
        { section: "Verse 1", title: "Street Echo", prompt: "Lead drifts through wet streets." },
        { section: "Chorus 1", title: "Motion Hook", prompt: "The city lights pulse to the refrain." }
      ],
      sectionBeats: [
        {
          section: "Intro",
          title: "Night Arrival",
          bars: 8,
          energy: "low",
          focus: "atmosphere and neon rain",
          visualRole: "title reveal"
        },
        {
          section: "Verse 1",
          title: "Street Echo",
          bars: 16,
          energy: "medium",
          focus: "lead enters the city",
          visualRole: "character reveal"
        },
        {
          section: "Chorus 1",
          title: "Motion Hook",
          bars: 16,
          energy: "high",
          focus: "hook lands and lifts",
          visualRole: "particle ignition"
        }
      ]
    }
  };

  const result = engine.run(project);

  assert.equal(result.projectContext.project.mode, "music_video");
  assert.equal(result.narrativePlan.mode, "music_video");
  assert.equal(result.narrativePlan.plan.type, "mv");
  assert.ok(result.storyGraph.characters.length > 0);
  assert.ok(result.scenePlan.scenes.length > 0);
  assert.ok(result.musicPlan.tracks.length > 0);
  assert.ok((result.musicPlan.previewSegments?.length ?? 0) > 0);
  assert.ok((result.renderedMedia.previewStoryboard?.length ?? 0) > 0);
  assert.equal(typeof result.outputPackage.mainVideo, "string");
  assert.ok(result.outputPackage.mainVideo?.endsWith(".mp4"));
  assert.ok((result.outputPackage.metadata?.previewSegmentCount ?? 0) > 0);
});
