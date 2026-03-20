import test from "node:test";
import assert from "node:assert/strict";
import { StoryEngine } from "../narrative/story-engine";
import type { ProjectContext } from "../core/project-spec";

test("StoryEngine generates characters, conflicts, and arcs for music_video", () => {
  const engine = new StoryEngine();
  const context: ProjectContext = {
    project: {
      projectId: "sg_music_001",
      mode: "music_video",
      sourceType: "prompt",
      title: "Electric Hearts",
      sourceText: "Two lovers cross a sleepless city in search of one last chorus."
    },
    normalizedInput: {
      originalText: "Two lovers cross a sleepless city in search of one last chorus.",
      trimmedText: "Two lovers cross a sleepless city in search of one last chorus.",
      tokensEstimate: 14
    }
  };

  const graph = engine.generate(context);

  assert.equal(graph.meta.defaultMode, "music_video");
  assert.ok(graph.characters.length > 0);
  assert.ok(graph.conflicts.length > 0);
  assert.ok(graph.arcs.length > 0);
  assert.equal(graph.conflicts[0]?.type, "romantic");
});
