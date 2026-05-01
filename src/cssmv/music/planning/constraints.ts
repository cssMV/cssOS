import type { GenerationConstraints } from "./types";

export interface ConstraintInput {
  mood?: string;
  tempoBpm?: number;
  complexity?: number;
  instrumentationProfile?: GenerationConstraints["instrumentationProfile"];
  ambienceProfile?: GenerationConstraints["ambienceProfile"];
  expressionBias?: GenerationConstraints["expressionBias"];
  stylePack?: string;
  adapterPreference?: string;
  musicalKey?: string;
  language?: string;
  workType?: string;
  sectionLengthBias?: GenerationConstraints["sectionLengthBias"];
  repetitionStrength?: number;
  harmonicStability?: number;
  rhythmicActivity?: number;
  dynamicRange?: number;
  sectionContrast?: number;
  melodicContour?: GenerationConstraints["melodicContour"];
  articulationBias?: GenerationConstraints["articulationBias"];
  voicingRegister?: GenerationConstraints["voicingRegister"];
  deterministicSeed?: string;
  regenerationScope?: GenerationConstraints["regenerationScope"];
}

export function normalizeGenerationConstraints(input: ConstraintInput): GenerationConstraints {
  return {
    mood: String(input.mood || "lyrical"),
    tempoBpm: Math.max(40, Math.min(220, Math.round(input.tempoBpm ?? 92))),
    complexity: clamp01(input.complexity ?? 0.5),
    instrumentationProfile: input.instrumentationProfile ?? "hybrid",
    ambienceProfile: input.ambienceProfile ?? "glow",
    expressionBias: input.expressionBias ?? "natural",
    stylePack: String(input.stylePack || "core"),
    adapterPreference: String(input.adapterPreference || "internal"),
    musicalKey: String(input.musicalKey || "auto"),
    language: String(input.language || "auto"),
    workType: String(input.workType || "song"),
    sectionLengthBias: input.sectionLengthBias ?? "balanced",
    repetitionStrength: clamp01(input.repetitionStrength ?? 0.6),
    harmonicStability: clamp01(input.harmonicStability ?? 0.58),
    rhythmicActivity: clamp01(input.rhythmicActivity ?? 0.55),
    dynamicRange: clamp01(input.dynamicRange ?? 0.62),
    sectionContrast: clamp01(input.sectionContrast ?? 0.58),
    melodicContour: input.melodicContour ?? "arched",
    articulationBias: input.articulationBias ?? "mixed",
    voicingRegister: input.voicingRegister ?? "mid",
    deterministicSeed: String(input.deterministicSeed || "cssmv_default"),
    regenerationScope: input.regenerationScope ?? "full"
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
