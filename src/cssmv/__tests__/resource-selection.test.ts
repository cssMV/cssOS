import test from "node:test";
import assert from "node:assert/strict";
import type { ProjectSpec } from "../core/project-spec";
import { resolveResourceSelection } from "../music/render/resource-registry";

const baseProject: ProjectSpec = {
  projectId: "resource_selection_001",
  mode: "music_video",
  sourceType: "prompt",
  title: "Selection",
  sourceText: "Selection smoke",
  creative: {
    licensed_style_pack: "free-community-stack"
  }
};

test("resolveResourceSelection prefers exact fallback id over broader capability matches", () => {
  const selection = resolveResourceSelection(baseProject, "mixBusProcessing", "free-vocal-chain");
  assert.equal(selection.primary?.id, "free-vocal-chain");
});
