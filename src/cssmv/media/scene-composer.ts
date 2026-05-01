import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { ScenePlan } from "../schemas/scene-plan";
import type { StructuredNode } from "../schemas/structure-tree";
import type { StoryGraph } from "../schemas/story-graph";

function estimateBlockDuration(totalDurationSec: number, sceneCount: number, index: number): number {
  if (sceneCount <= 0) return totalDurationSec;
  const even = Math.max(12, Math.floor(totalDurationSec / sceneCount));
  const tailBias = index === sceneCount - 1 ? totalDurationSec - even * (sceneCount - 1) : even;
  return Math.max(12, tailBias);
}

export class SceneComposer {
  compose(narrative: NarrativePlanEnvelope, graph: StoryGraph): ScenePlan {
    const protagonistId = graph.characters[0]?.characterId;
    const focusCharacterIds = protagonistId ? [protagonistId] : [];

    if (narrative.plan.type === "mv") {
      const mvPlan = narrative.plan;
      const blocks = mvPlan.sceneBlocks.length
        ? mvPlan.sceneBlocks
        : [
            {
              blockId: "sb_fallback_001",
              label: "Opening",
              summary: `Composed from ${narrative.mode} narrative plan.`
            }
          ];
      const totalDurationSec =
        blocks.reduce((sum, item) => sum + (item.durationSec ?? 0), 0) || mvPlan.durationSec;
      const structurePathById = new Map<string, string[]>();
      const walkStructure = (nodes: StructuredNode[], parents: string[] = []) => {
        nodes.forEach((node) => {
          const nextPath = [...parents, node.title];
          structurePathById.set(node.nodeId, nextPath);
          walkStructure(Array.isArray(node.children) ? node.children : [], nextPath);
        });
      };
      walkStructure(Array.isArray(mvPlan.structureTree) ? mvPlan.structureTree : []);

      const scenes = blocks.map((block, index) => {
        const blockWorkType = block.workType || mvPlan.workType;
        const structureRole = block.structureRole ?? ("scene" as const);
        const structurePath =
          block.structureNodeId && structurePathById.has(block.structureNodeId)
            ? structurePathById.get(block.structureNodeId)
            : block.structurePath;
        const sectionType = block.label.split(":")[0]?.trim().toLowerCase().replace(/\s+/g, "_");
        return {
          sceneId: `scene_${String(index + 1).padStart(3, "0")}`,
          sourceBlockId: block.blockId,
          sourceSection: block.label.split(":")[0]?.trim() || block.label,
          order: index + 1,
          label: block.label,
          summary: block.summary ?? `Scene adapted from ${block.label}.`,
          visualPrompt: block.prompt ?? block.summary ?? `Cinematic treatment for ${block.label}.`,
          visualRole: block.visualRole ?? block.energy ?? "mv progression beat",
          durationSec:
            block.durationSec ??
            estimateBlockDuration(totalDurationSec, blocks.length, index),
          focusCharacterIds,
          ...(blockWorkType ? { workType: blockWorkType } : {}),
          ...(block.structureNodeId ? { structureNodeId: block.structureNodeId } : {}),
          ...(block.parentStructureNodeId ? { parentStructureNodeId: block.parentStructureNodeId } : {}),
          ...(sectionType ? { sectionType } : {}),
          structureRole,
          ...(structurePath?.length ? { structurePath } : {}),
          dialogueDensity:
            index === 0
              ? ("low" as const)
              : index === blocks.length - 1
                ? ("mid" as const)
                : ("low" as const)
        };
      });

      const transitions: ScenePlan["transitions"] = scenes.slice(0, -1).map((scene, index) => {
        const nextScene = scenes[index + 1];
        if (!nextScene) {
          return {
            transitionId: `transition_${String(index + 1).padStart(3, "0")}`,
            kind: "fade" as const,
            fromSceneId: scene.sceneId
          };
        }

        return {
          transitionId: `transition_${String(index + 1).padStart(3, "0")}`,
          kind: index === scenes.length - 2 ? ("fade" as const) : ("match" as const),
          fromSceneId: scene.sceneId,
          toSceneId: nextScene.sceneId
        };
      });

      return {
        scenes,
        transitions,
        ...(mvPlan.workType ? { workType: mvPlan.workType } : {}),
        ...(mvPlan.structureTree?.length ? { structureTree: mvPlan.structureTree } : {})
      };
    }

    return {
      scenes: [
        {
          sceneId: "scene_001",
          order: 1,
          label: "Opening scene",
          summary: `Composed from ${narrative.mode} narrative plan.`,
          focusCharacterIds,
          dialogueDensity: "mid"
        }
      ],
      transitions: [
        {
          transitionId: "transition_001",
          kind: "fade",
          fromSceneId: "scene_001"
        }
      ],
      workType: "single",
      structureTree: []
    };
  }
}
