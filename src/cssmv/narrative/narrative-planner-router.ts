import type { ProjectSpec } from "../core/project-spec";
import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { StoryGraph } from "../schemas/story-graph";
import { MVPlanner } from "../modes/mv-planner";

function notImplementedEnvelope(mode: ProjectSpec["mode"]): NarrativePlanEnvelope {
  switch (mode) {
    case "microdrama":
      return {
        mode,
        plan: {
          type: "microdrama",
          season: {
            totalEpisodes: 0,
            episodeDurationSec: 0,
            arcBlocks: []
          },
          episodes: []
        }
      };
    case "series":
      return {
        mode,
        plan: {
          type: "series",
          episodes: [],
          threadDistribution: []
        }
      };
    case "cinema":
      return {
        mode,
        plan: {
          type: "cinema",
          durationSec: 0,
          actStructure: [],
          endingStrategy: "single"
        }
      };
    case "music_video":
      return {
        mode,
        plan: {
          type: "mv",
          durationSec: 0,
          emotionalCurve: [],
          sceneBlocks: [],
          musicStrategy: "hybrid"
        }
      };
  }
}

export class NarrativePlannerRouter {
  private readonly mvPlanner = new MVPlanner();

  plan(project: ProjectSpec, graph: StoryGraph): NarrativePlanEnvelope {
    if (project.mode === "music_video") {
      return this.mvPlanner.plan(project, graph, project.durationSec ?? 180);
    }

    return notImplementedEnvelope(project.mode);
  }
}
