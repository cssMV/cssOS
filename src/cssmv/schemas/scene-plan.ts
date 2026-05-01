import type { StructuredNode, StructuredNodeRole, StructuredWorkType } from "./structure-tree";

export interface SceneNode {
  sceneId: string;
  label: string;
  summary?: string;
  sourceBlockId?: string;
  sourceSection?: string;
  sectionType?: string;
  visualPrompt?: string;
  visualRole?: string;
  visualScript?: string;
  thumbnailPath?: string;
  referenceMediaPaths?: string[];
  order?: number;
  durationSec?: number;
  focusCharacterIds?: string[];
  emotionalBeat?: "setup" | "lift" | "peak" | "release" | "resolve";
  energyProfile?: "low" | "medium" | "high" | "peak";
  shotType?: "detail" | "close" | "close_medium" | "medium" | "wide" | "aerial";
  cameraMove?: "static" | "glide" | "push" | "orbit" | "crane" | "handheld";
  cameraLanguage?: string;
  directorNotes?: string[];
  dialogueDensity?: "low" | "mid" | "high";
  workType?: StructuredWorkType;
  structureNodeId?: string;
  parentStructureNodeId?: string;
  structureRole?: StructuredNodeRole;
  structurePath?: string[];
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
  workType?: StructuredWorkType;
  structureTree?: StructuredNode[];
}
