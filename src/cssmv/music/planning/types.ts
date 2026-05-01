export interface GenerationConstraints {
  mood: string;
  tempoBpm: number;
  complexity: number;
  instrumentationProfile: "acoustic" | "hybrid" | "orchestral" | "guofeng" | "electronic";
  ambienceProfile: "dry" | "glow" | "mist" | "cathedral";
  expressionBias: "natural" | "dramatic" | "intimate" | "theatrical";
  stylePack: string;
  adapterPreference: string;
  musicalKey: string;
  language: string;
  workType: string;
  sectionLengthBias: "compact" | "balanced" | "expanded";
  repetitionStrength: number;
  harmonicStability: number;
  rhythmicActivity: number;
  dynamicRange: number;
  sectionContrast: number;
  melodicContour: "grounded" | "arched" | "ascending" | "wave";
  articulationBias: "legato" | "mixed" | "accented";
  voicingRegister: "low" | "mid" | "high" | "wide";
  deterministicSeed: string;
  regenerationScope: "full" | "section" | "phrase" | "bar";
}

export interface SectionPlan {
  sectionId: string;
  sourceSceneId?: string;
  label: string;
  sectionType: "intro" | "verse" | "pre_chorus" | "chorus" | "bridge" | "outro" | "break";
  startSec: number;
  durationSec: number;
  bars: number;
  energy: "low" | "medium" | "high" | "peak";
}

export interface PhrasePlan {
  phraseId: string;
  sectionId: string;
  order: number;
  startSec: number;
  durationSec: number;
  bars: number;
  role: "setup" | "statement" | "response" | "lift" | "release" | "resolve";
  variationRole: "primary" | "repeat" | "answer" | "development";
  cadenceIntent: "open" | "half" | "authentic" | "plagal" | "deceptive";
  motifId: string;
  followsPhraseId?: string;
}

export interface HarmonyPlan {
  phraseId: string;
  progression: string[];
  harmonicRhythm: "slow" | "medium" | "fast";
  tensionHint: "stable" | "rising" | "bright" | "suspended" | "resolved";
  bassMotion: "pedal" | "stepwise" | "arched" | "jumping";
  cadence: PhrasePlan["cadenceIntent"];
}

export interface RhythmPlan {
  phraseId: string;
  grooveTemplate: "anthem" | "flowing" | "pulse" | "march" | "floating";
  syncopation: "low" | "medium" | "high";
  accents: string[];
  density: "sparse" | "steady" | "busy";
  swing: "straight" | "light" | "triplet";
  microTimingMs: number;
  activityProfile: string[];
  barAccents: string[][];
  pushPullProfile: Array<"laid_back" | "centered" | "pushed">;
}

export interface ExpressionPlan {
  phraseId: string;
  intensity: "low" | "medium" | "high" | "peak";
  articulation: "legato" | "mixed" | "staccato" | "accented";
  velocityContour: "flat" | "ramp_up" | "wave" | "surge";
  registerContour: "grounded" | "rising" | "wide" | "lifted";
  densityCurve: "thin" | "balanced" | "thick" | "bloom";
}

export interface MelodyPlan {
  phraseId: string;
  contour:
    | "arched"
    | "stepwise_rise"
    | "wave"
    | "pedal_glow"
    | "lift_then_fall"
    | "soaring_arc"
    | "answering_fall";
  phraseFunction: "statement" | "answer" | "lift" | "hook" | "cadence";
  hookStrength: number;
  targetDegrees: number[];
  registerAnchor: "low" | "mid" | "mid_high" | "high";
  motionBias: "stepwise" | "balanced_lift" | "contrast_leap";
  leapBudget: number;
  landingTone: "tonic" | "third" | "fifth" | "dominant" | "submediant" | "suspended";
  ornamentation: "none" | "lean" | "neighbor" | "grace_fall" | "glide_turn" | "belt_accent";
  repetitionWindowBars: number;
  counterlineRole: "none" | "echo_answer" | "call_response" | "octave_doubles";
  lyricStressMap: Array<"lift" | "settle" | "hold" | "answer">;
  climaxBar: number;
  avoidTextureCues: string[];
  cleanupTargets: Array<"siren_band" | "electrical_hum" | "harsh_whine">;
  antecedentPhraseId?: string;
  phraseIndex: number;
}

export interface MusicPlanningTrace {
  seed: string;
  deterministic: boolean;
  warnings: string[];
}

export interface MusicPlanDocument {
  constraints: GenerationConstraints;
  sections: SectionPlan[];
  phrases: PhrasePlan[];
  harmony: HarmonyPlan[];
  rhythm: RhythmPlan[];
  expression: ExpressionPlan[];
  melody: MelodyPlan[];
  trace: MusicPlanningTrace;
}
