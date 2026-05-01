export interface TrackNode {
  trackId: string;
  label: string;
  purpose?: string;
  stems?: string[];
  texture?: string;
}

export interface GrooveProfile {
  pocket: "laid_back" | "centered" | "pushed";
  syncopation: "low" | "medium" | "high";
  swing: "straight" | "light" | "triplet";
  accentPattern: string[];
  microTimingMs?: number;
  barAccentPattern?: string[][];
  activityProfile?: string[];
  pushPullProfile?: Array<"laid_back" | "centered" | "pushed">;
}

export interface DynamicsProfile {
  intensity: "low" | "medium" | "high" | "peak";
  density: "sparse" | "steady" | "busy" | "wall";
  registerFocus: "low" | "mid" | "wide" | "high";
  articulation: "legato" | "mixed" | "staccato" | "accented";
}

export interface TensionPoint {
  anchor: "entry" | "build" | "turn" | "release" | "resolve";
  tension: number;
  release: number;
}

export interface GenerationConstraints {
  preserveMotifIds?: string[];
  rewriteScope?: "global" | "section" | "phrase" | "bar";
  cadenceBias?: "deceptive" | "open" | "resolved";
  maxLeapSemitones?: number;
  avoidRepetitionWindowBars?: number;
}

export interface MelodyProfile {
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
  avoidTextureCues?: string[];
  cleanupTargets?: Array<"siren_band" | "electrical_hum" | "harsh_whine">;
  antecedentPhraseId?: string;
}

export interface CueNode {
  cueId: string;
  label: string;
  targetSceneId?: string;
  targetBeatId?: string;
  section?: string;
  bars?: number;
  startSec?: number;
  durationSec?: number;
  energy?: string;
  arrangementHint?: string;
  groove?: GrooveProfile;
  dynamics?: DynamicsProfile;
  tension?: TensionPoint;
  motifId?: string;
  phraseId?: string;
  followsPhraseId?: string;
  constraints?: GenerationConstraints;
  melody?: MelodyProfile;
}

export interface PreviewSegment {
  section: string;
  title: string;
  startSec: number;
  durationSec: number;
  bars: number;
  energy: string;
  audioCue: string;
  hookRole?: "setup" | "return" | "lift" | "release";
}

export interface PhraseNode {
  phraseId: string;
  section: string;
  sceneId?: string;
  startSec: number;
  durationSec: number;
  bars: number;
  role: "setup" | "statement" | "response" | "lift" | "release" | "resolve";
  motifId: string;
  followsPhraseId?: string;
  groove: GrooveProfile;
  dynamics: DynamicsProfile;
  tension: TensionPoint;
  constraints?: GenerationConstraints;
  melody?: MelodyProfile;
}

export interface SectionNode {
  sectionId: string;
  label: string;
  startSec: number;
  durationSec: number;
  bars: number;
  energy: "low" | "medium" | "high" | "peak";
  role: "intro" | "verse" | "pre_chorus" | "chorus" | "bridge" | "outro" | "break";
  motifIds: string[];
  phrases: string[];
}

export interface GenerationControlPlan {
  seed: string;
  variation: number;
  humanizeMs: number;
  allowSectionRegeneration: boolean;
  sampling: {
    temperature: number;
    topP: number;
    retryBudget: number;
  };
  repairPolicy: {
    onRhythmCollapse: "tighten_grid" | "reuse_last_good_phrase";
    onStructureDrift: "snap_to_section_plan" | "force_hook_return";
  };
}

export interface MusicPlan {
  tracks: TrackNode[];
  cues: CueNode[];
  strategy: "full_song" | "fragment" | "motif" | "hybrid";
  structureSummary?: string;
  previewSegments?: PreviewSegment[];
  previewScript?: string[];
  sections?: SectionNode[];
  phrases?: PhraseNode[];
  generationControl?: GenerationControlPlan;
}

export interface MusicContinuationCard {
  text: string;
  targetUrl?: string;
  placement: "description" | "post_credit" | "both";
}
