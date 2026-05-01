import type { ProjectSpec } from "../core/project-spec";
import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { StoryGraph } from "../schemas/story-graph";
import { MVPlanner } from "../modes/mv-planner";

function inferMvDurationSec(project: ProjectSpec): number {
  const explicitDuration =
    Number(project.durationSec) ||
    Number(project.creative?.duration_s) ||
    0;
  if (explicitDuration > 0) return explicitDuration;

  const sectionBeats = Array.isArray(project.songSeed?.sectionBeats) ? project.songSeed.sectionBeats : [];
  const totalBars = sectionBeats.reduce((sum, row) => sum + Math.max(0, Number(row?.bars) || 0), 0);
  if (totalBars > 0) {
    return Math.max(24, Math.round(totalBars * 2));
  }

  const sectionPrompts = Array.isArray(project.songSeed?.sectionPrompts) ? project.songSeed.sectionPrompts : [];
  if (sectionPrompts.length > 0) {
    return Math.max(24, sectionPrompts.length * 16);
  }

  const lyricLines = String(project.songSeed?.lyrics || project.sourceText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lyricLines.length > 0) {
    return Math.max(24, Math.min(420, lyricLines.length * 6));
  }

  return 24;
}

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
      return this.mvPlanner.plan(project, graph, inferMvDurationSec(project));
    }

    return notImplementedEnvelope(project.mode);
  }
}
