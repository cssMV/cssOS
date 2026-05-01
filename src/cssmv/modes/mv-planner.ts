import type { ProjectSpec, SongSeedSectionBeat, SongSeedSectionPrompt } from "../core/project-spec";
import type { NarrativePlanEnvelope, MVPlan, SceneBlock } from "../schemas/narrative-plan";
import { flattenStructuredLeaves, inferStructureTreeFromSongSeed } from "../schemas/structure-tree";
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
  const structureTree = inferStructureTreeFromSongSeed({
    ...(project.songSeed?.title || project.title ? { title: project.songSeed?.title || project.title } : {}),
    ...(project.songSeed?.workType ? { workType: project.songSeed.workType } : {}),
    ...(sectionBeats.length ? { sectionRows: sectionBeats } : {})
  });
  const structuredScenes = flattenStructuredLeaves(structureTree);
  return sectionBeats.map((row: SongSeedSectionBeat, index: number) => {
    const prompt = promptMap.get(String(row.section || "").trim());
    const structureNode = structuredScenes[index];
    const workType = structureNode?.workType ?? project.songSeed?.workType;
    const structurePath =
      structureNode && (project.songSeed?.title || project.title)
        ? [project.songSeed?.title || project.title || "cssMV", structureNode.title]
        : undefined;
    return {
      blockId: `sb_${String(index + 1).padStart(3, "0")}`,
      label: structureNode?.title || `${row.section}: ${row.title}`,
      summary: `${row.focus}. ${prompt?.prompt || row.visualRole}`,
      durationSec: durationFromBars(Math.max(1, row.bars || 0), totalBars, durationSec),
      beatBars: Math.max(1, row.bars || 0),
      energy: row.energy,
      visualRole: row.visualRole,
      prompt: prompt?.prompt || `${row.section} visual for ${project.title || project.songSeed?.title || "cssMV"}`,
      ...(workType ? { workType } : {}),
      ...(structureNode?.nodeId ? { structureNodeId: structureNode.nodeId } : {}),
      ...(structureNode?.role ? { structureRole: structureNode.role } : {}),
      ...(structurePath?.length ? { structurePath } : {})
    };
  });
}

export class MVPlanner {
  plan(project: ProjectSpec, graph: StoryGraph, durationSec: number): NarrativePlanEnvelope {
    const seededBlocks = sceneBlocksFromSongSeed(project, durationSec);
    const structureSeedRows = project.songSeed?.sectionBeats || project.songSeed?.sectionPrompts || [];
    const structureTree = inferStructureTreeFromSongSeed({
      ...(project.songSeed?.title || project.title ? { title: project.songSeed?.title || project.title } : {}),
      ...(project.songSeed?.workType ? { workType: project.songSeed.workType } : {}),
      ...(structureSeedRows.length ? { sectionRows: structureSeedRows } : {})
    });
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
      musicStrategy: seededBlocks.length > 6 ? "hybrid" : "full_song",
      ...(project.songSeed?.workType ? { workType: project.songSeed.workType } : {}),
      ...(structureTree.length ? { structureTree } : {})
    };

    return {
      mode: "music_video",
      plan: mvPlan
    };
  }
}
