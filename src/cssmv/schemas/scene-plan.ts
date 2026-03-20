export interface SceneNode {
  sceneId: string;
  label: string;
  summary?: string;
  sourceBlockId?: string;
  sourceSection?: string;
  visualPrompt?: string;
  visualRole?: string;
  order?: number;
  durationSec?: number;
  focusCharacterIds?: string[];
  dialogueDensity?: "low" | "mid" | "high";
}

export interface TransitionNode {
  transitionId: string;
  kind: "cut" | "match" | "fade" | "smash" | "montage";
  fromSceneId?: string;
  toSceneId?: string;
}

export interface ScenePlan {
  scenes: SceneNode[];
  transitions?: TransitionNode[];
}
