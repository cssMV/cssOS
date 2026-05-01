import type { NarrativeCapability, CssMVMode, SourceType } from "../schemas/common";

import type { StructuredNode, StructuredWorkType } from "../schemas/structure-tree";

export interface ProjectCreativeProfile {
  genre?: string;
  mood?: string;
  instrument?: string;
  instrumentation?: string;
  ambience?: string;
  vocal_gender?: string;
  vocal_style?: string;
  ensemble_style?: string;
  arrangement_density?: number;
  dynamics_curve?: string;
  section_form?: string;
  articulation_bias?: string;
  voicing_register?: string;
  percussion_activity?: number;
  expression_cc_bias?: string;
  humanization?: number;
  inspiration_notes?: string;
  licensed_style_pack?: string;
  external_audio_adapter?: string;
  resource_budget_tier?: "free_first" | "licensed_only";
  tempo_bpm?: number;
  musical_key?: string;
  duration_s?: number;
  language?: string;
  prompt?: string;
  work_type?: StructuredWorkType;
}

export interface SongSeedSectionPrompt {
  section: string;
  title: string;
  prompt: string;
}

export interface SongSeedSectionBeat {
  section: string;
  title: string;
  bars: number;
  energy: string;
  focus: string;
  visualRole: string;
}

export interface SongSeed {
  title?: string;
  workType?: StructuredWorkType;
  lyrics?: string;
  musicStyle?: string;
  musicStructure?: string;
  references?: string[];
  videoOutline?: string;
  sectionPrompts?: SongSeedSectionPrompt[];
  sectionBeats?: SongSeedSectionBeat[];
  styleTags?: string[];
  structureTree?: StructuredNode[];
}

export interface ProjectSpec {
  projectId: string;
  mode: CssMVMode;
  sourceType: SourceType;
  title?: string;
  sourceText?: string;
  durationSec?: number;
  episodeCount?: number;
  episodeDurationSec?: number;
  capabilities?: NarrativeCapability[];
  songSeed?: SongSeed;
  creative?: ProjectCreativeProfile;
}

export interface NormalizedInput {
  originalText: string;
  trimmedText: string;
  tokensEstimate: number;
}

export interface ProjectContext {
  project: ProjectSpec;
  normalizedInput: NormalizedInput;
}
