import type { StructuredNode, StructuredNodeRole, StructuredWorkType } from "./structure-tree";

export interface RenderedSegment {
  sceneId: string;
  label: string;
  videoPath: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  transitionToNext?: "cut" | "match" | "fade" | "smash" | "montage";
  subtitleText?: string;
  thumbnailPath?: string;
  workType?: StructuredWorkType;
  structureNodeId?: string;
  parentStructureNodeId?: string;
  structureRole?: StructuredNodeRole;
  structurePath?: string[];
}

export interface VideoContinuityScore {
  sceneId: string;
  characterScore: number;
  styleScore: number;
  shotScore: number;
  overallScore: number;
  notes: string[];
}

export interface VideoCharacterProfile {
  name: string;
  sceneIds: number[];
  primaryLocations: string[];
  props: string[];
  visualAnchor: string;
}

export interface VideoNormalizedStyle {
  genre: string;
  colorPalette?: string;
  visualTone: string;
  cameraLanguage: string;
  consistencySeed: number;
}

export interface VideoShotPlan {
  sceneId: number;
  shotSize: string;
  shotDistancePreference?: string;
  ensembleMode?: "solo" | "duo" | "group" | "environment";
  movement: string;
  pacing: string;
  lensProfile: string;
  directorIntent?: string;
  motionIntensity?: number;
}

export interface VideoSourceDiagnostic {
  sceneId: number;
  sourceMode: string;
  referenceMediaCount: number;
}

export interface VideoEngineDetail {
  engineId: string;
  mode: "stub" | "rust_cli" | "rust_cli_fallback";
  sourceMode?: string;
  sceneSourceDiagnostics?: VideoSourceDiagnostic[];
  thumbnailVideo?: string;
  matchedDuration?: boolean;
  durationDeltaSec?: number;
  continuityScores?: VideoContinuityScore[];
  characterProfiles?: VideoCharacterProfile[];
  normalizedStyle?: VideoNormalizedStyle;
  shotPlans?: VideoShotPlan[];
  errorMessage?: string;
}

export interface RenderedMedia {
  videoSegments: string[];
  mainCompositeVideo?: string;
  audioMix?: string;
  audioPreview?: string;
  subtitleTrack?: string;
  thumbnails?: string[];
  segmentTimeline?: RenderedSegment[];
  subtitleCues?: string[];
  totalDurationSec?: number;
  previewStoryboard?: string[];
  previewScript?: string[];
  renderProfile?: "mv_stub" | "mv_rust" | "microdrama_stub" | "series_stub" | "cinema_stub";
  videoEngineDetail?: VideoEngineDetail;
  workType?: StructuredWorkType;
  structureTree?: StructuredNode[];
}
