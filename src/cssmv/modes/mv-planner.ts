import type { ProjectSpec, SongSeedSectionBeat, SongSeedSectionPrompt } from "../core/project-spec";
import type { NarrativePlanEnvelope, MVPlan, SceneBlock } from "../schemas/narrative-plan";
import type { StoryGraph } from "../schemas/story-graph";

function durationFromBars(bars: number, totalBars: number, durationSec: number) {
  if (bars > 0 && totalBars > 0 && durationSec > 0) {
    return Math.max(6, Math.round((bars / totalBars) * durationSec));
  }
  return 0;
}

function sceneBlocksFromSongSeed(
  project: ProjectSpec,
  durationSec: number
): SceneBlock[] {
  const sectionBeats = Array.isArray(project.songSeed?.sectionBeats)
    ? project.songSeed?.sectionBeats
    : [];
  const sectionPrompts = Array.isArray(project.songSeed?.sectionPrompts)
    ? project.songSeed?.sectionPrompts
    : [];
  if (!sectionBeats?.length) {
    return [];
  }
  const promptMap = new Map<string, SongSeedSectionPrompt>();
  sectionPrompts.forEach((row) => {
    promptMap.set(String(row.section || "").trim(), row);
  });
  const totalBars = sectionBeats.reduce((sum, row) => sum + Math.max(1, row.bars || 0), 0);
  return sectionBeats.map((row: SongSeedSectionBeat, index: number) => {
    const prompt = promptMap.get(String(row.section || "").trim());
    return {
      blockId: `sb_${String(index + 1).padStart(3, "0")}`,
      label: `${row.section}: ${row.title}`,
      summary: `${row.focus}. ${prompt?.prompt || row.visualRole}`,
      durationSec: durationFromBars(Math.max(1, row.bars || 0), totalBars, durationSec),
      beatBars: Math.max(1, row.bars || 0),
      energy: row.energy,
      visualRole: row.visualRole,
      prompt: prompt?.prompt || `${row.section} visual for ${project.title || project.songSeed?.title || "cssMV"}`
    };
  });
}

export class MVPlanner {
  plan(project: ProjectSpec, graph: StoryGraph, durationSec: number): NarrativePlanEnvelope {
    const seededBlocks = sceneBlocksFromSongSeed(project, durationSec);
    const mvPlan: MVPlan = {
      type: "mv",
      durationSec,
      emotionalCurve: ["setup", "lift", "peak", "resolve"],
      sceneBlocks: seededBlocks.length
        ? seededBlocks
        : [
            {
              blockId: "sb_intro_001",
              label: "Intro",
              summary: graph.conflicts[0]?.summary ?? "Establish the emotional premise."
            },
            {
              blockId: "sb_peak_001",
              label: "Peak",
              summary: graph.arcs[0]?.endState ?? "Deliver the emotional climax."
            }
          ],
      musicStrategy: seededBlocks.length > 6 ? "hybrid" : "full_song"
    };

    return {
      mode: "music_video",
      plan: mvPlan
    };
  }
}
