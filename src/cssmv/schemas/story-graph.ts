import type { CssMVMode, SourceType } from "./common";

export interface StoryMeta {
  storyId: string;
  title?: string;
  genre?: string;
  subGenres?: string[];
  theme?: string[];
  tone?: string;
  sourceType?: SourceType;
  defaultMode?: CssMVMode;
  targetAudience?: string[];
  language?: string;
}

export interface WorldModel {
  worldId: string;
  settingType?: "modern" | "historical" | "fantasy" | "sci_fi" | "myth" | "hybrid";
  era?: string;
  geography?: string[];
  socialRules?: string[];
  powerSystems?: string[];
  aestheticTags?: string[];
}

export interface GoalState {
  goalId: string;
  description: string;
  priority?: number;
  visibleToAudience?: boolean;
  achieved?: boolean;
}

export interface RelationshipEdge {
  targetCharacterId: string;
  relationType:
    | "love"
    | "hate"
    | "trust"
    | "distrust"
    | "family"
    | "mentor"
    | "rivalry"
    | "alliance"
    | "debt"
    | "obsession";
  strength?: number;
  visibility?: "public" | "private" | "hidden";
  mutable?: boolean;
}

export interface KnowledgeState {
  factId: string;
  known: boolean;
  source?: string;
  revealTriggerId?: string;
}

export interface VisualProfile {
  ageBand?: string;
  genderExpression?: string;
  hair?: string;
  silhouette?: string;
  costumeTags?: string[];
  colorIdentity?: string[];
  iconicProps?: string[];
}

export interface VoiceProfile {
  tone?: string;
  pace?: string;
  emotionalRange?: string[];
  signaturePhrases?: string[];
}

export interface MusicProfile {
  themeMotifId?: string;
  instrumentBias?: string[];
  moodTags?: string[];
  vocalAssociation?: string[];
}

export interface CharacterNode {
  characterId: string;
  name?: string;
  role:
    | "protagonist"
    | "deuteragonist"
    | "antagonist"
    | "supporting"
    | "mentor"
    | "rival"
    | "lover"
    | "family"
    | "ensemble";
  archetype?: string;
  summary?: string;
  goals?: GoalState[];
  fears?: string[];
  secrets?: string[];
  traits?: string[];
  contradictions?: string[];
  visualProfile?: VisualProfile;
  voiceProfile?: VoiceProfile;
  musicProfile?: MusicProfile;
  relationships?: RelationshipEdge[];
  knowledgeState?: KnowledgeState[];
  statusTags?: string[];
}

export interface StakeProfile {
  emotional?: number;
  physical?: number;
  social?: number;
  financial?: number;
  political?: number;
  existential?: number;
}

export interface ConflictNode {
  conflictId: string;
  type:
    | "internal"
    | "interpersonal"
    | "family"
    | "social"
    | "political"
    | "romantic"
    | "survival"
    | "mystery"
    | "revenge"
    | "power";
  summary: string;
  participants: string[];
  stakes?: StakeProfile;
  active?: boolean;
  resolutionState?: "unresolved" | "partial" | "resolved" | "reversed";
  linkedArcIds?: string[];
  linkedRevealIds?: string[];
}

export interface ArcMilestone {
  milestoneId: string;
  label: string;
  description?: string;
  order: number;
  linkedRevealId?: string;
  linkedThreadId?: string;
}

export interface ArcNode {
  arcId: string;
  arcType:
    | "character_growth"
    | "romance"
    | "revenge"
    | "power_shift"
    | "redemption"
    | "corruption"
    | "mystery_unfolding"
    | "fall_from_grace";
  ownerIds: string[];
  startState?: string;
  endState?: string;
  milestones?: ArcMilestone[];
  linkedConflictIds?: string[];
}

export interface ThreadNode {
  threadId: string;
  name?: string;
  summary?: string;
  priority?: number;
  ownerIds?: string[];
  status?: "active" | "paused" | "closed";
  entryPoints?: string[];
  exitPoints?: string[];
  linkedArcIds?: string[];
  linkedConflictIds?: string[];
}

export interface RevealNode {
  revealId: string;
  factId: string;
  summary: string;
  revealedTo?: string[];
  hiddenFrom?: string[];
  triggerType?:
    | "dialogue"
    | "event"
    | "document"
    | "flashback"
    | "accident"
    | "confession"
    | "investigation";
  impactLevel?: number;
  linkedConflictIds?: string[];
  linkedArcIds?: string[];
}

export interface BranchNode {
  branchId: string;
  label?: string;
  conditionSummary?: string;
  triggerSource?:
    | "character_choice"
    | "external_event"
    | "audience_interaction"
    | "knowledge_state"
    | "relationship_threshold";
  fromThreadId?: string;
  toThreadId?: string;
  alternativeOutcomeIds?: string[];
  reversible?: boolean;
}

export interface EndingNode {
  endingId: string;
  label?: string;
  type?: "happy" | "tragic" | "bittersweet" | "open" | "twist" | "cyclical";
  summary: string;
  requiredConditions?: string[];
  linkedBranchIds?: string[];
  canon?: boolean;
}

export interface MotifNode {
  motifId: string;
  type?: "musical" | "visual" | "symbolic" | "dialogue";
  label?: string;
  description?: string;
  linkedCharacterIds?: string[];
  linkedArcIds?: string[];
  recurrencePolicy?: "low" | "mid" | "high";
}

export interface TimelineNode {
  eventId: string;
  label?: string;
  order: number;
  relativeTime?: string;
  absoluteTime?: string;
  involvedCharacterIds?: string[];
  linkedConflictIds?: string[];
  linkedRevealIds?: string[];
  timelineType?: "main" | "flashback" | "parallel" | "future_hint";
}

export interface StoryGraph {
  meta: StoryMeta;
  world?: WorldModel;
  characters: CharacterNode[];
  conflicts: ConflictNode[];
  arcs: ArcNode[];
  threads?: ThreadNode[];
  reveals?: RevealNode[];
  branches?: BranchNode[];
  endings?: EndingNode[];
  motifs?: MotifNode[];
  timeline?: TimelineNode[];
}

export interface StoryGraphMVP {
  meta: StoryMeta;
  characters: CharacterNode[];
  conflicts: ConflictNode[];
  arcs: ArcNode[];
}

