import type { NarrativePlanEnvelope } from "../schemas/narrative-plan";
import type { ScenePlan } from "../schemas/scene-plan";
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
      const blocks = narrative.plan.sceneBlocks.length
        ? narrative.plan.sceneBlocks
        : [
            {
              blockId: "sb_fallback_001",
              label: "Opening",
              summary: `Composed from ${narrative.mode} narrative plan.`
            }
          ];
      const totalDurationSec =
        blocks.reduce((sum, item) => sum + (item.durationSec ?? 0), 0) || narrative.plan.durationSec;

      const scenes = blocks.map((block, index) => {
        const scene = {
          sceneId: `scene_${String(index + 1).padStart(3, "0")}`,
          sourceBlockId: block.blockId,
          sourceSection: block.label.split(":")[0]?.trim() || block.label,
          order: index + 1,
          label: block.label,
          summary: block.summary ?? `Scene adapted from ${block.label}.`,
          durationSec:
            block.durationSec ??
            estimateBlockDuration(totalDurationSec, blocks.length, index),
          focusCharacterIds,
          dialogueDensity:
            index === 0
              ? ("low" as const)
              : index === blocks.length - 1
                ? ("mid" as const)
                : ("low" as const)
        };
        return {
          ...scene,
          ...(block.prompt ? { visualPrompt: block.prompt } : {}),
          ...(block.visualRole ? { visualRole: block.visualRole } : {})
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
        transitions
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
      ]
    };
  }
}
