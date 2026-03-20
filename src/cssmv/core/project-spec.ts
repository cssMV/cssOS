import type { NarrativeCapability, CssMVMode, SourceType } from "../schemas/common";

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
  lyrics?: string;
  musicStyle?: string;
  musicStructure?: string;
  references?: string[];
  videoOutline?: string;
  sectionPrompts?: SongSeedSectionPrompt[];
  sectionBeats?: SongSeedSectionBeat[];
  styleTags?: string[];
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
