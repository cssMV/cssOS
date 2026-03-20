import type { CssMVMode } from "./common";

export interface SceneBlock {
  blockId: string;
  label: string;
  summary?: string;
  durationSec?: number;
  beatBars?: number;
  energy?: string;
  visualRole?: string;
  prompt?: string;
}

export interface BeatNode {
  beatId: string;
  label: string;
  summary?: string;
  order: number;
}

export interface ArcBlock {
  arcId: string;
  emphasis: "low" | "mid" | "high";
}

export interface ActNode {
  actId: string;
  label: string;
  order: number;
  summary?: string;
}

export interface SeasonNode {
  seasonId: string;
  label?: string;
  episodeIds: string[];
}

export interface ThreadDistribution {
  threadId: string;
  episodeIds: string[];
}

export interface MVPlan {
  type: "mv";
  durationSec: number;
  emotionalCurve: string[];
  sceneBlocks: SceneBlock[];
  musicStrategy: "full_song" | "hybrid";
}

export interface SeasonPlan {
  totalEpisodes: number;
  episodeDurationSec: number;
  arcBlocks: ArcBlock[];
  paywallBreakpoints?: number[];
}

export interface EpisodePlan {
  episodeId: string;
  beats: BeatNode[];
  cliffhangerType?: string;
}

export interface MicroDramaPlan {
  type: "microdrama";
  season: SeasonPlan;
  episodes: EpisodePlan[];
}

export interface SeriesPlan {
  type: "series";
  seasons?: SeasonNode[];
  episodes: EpisodePlan[];
  threadDistribution: ThreadDistribution[];
}

export interface CinemaPlan {
  type: "cinema";
  durationSec: number;
  actStructure: ActNode[];
  branchSlots?: string[];
  endingStrategy?: "single" | "multi";
}

export type NarrativePlan = MVPlan | MicroDramaPlan | SeriesPlan | CinemaPlan;

export interface NarrativePlanEnvelope {
  mode: CssMVMode;
  plan: NarrativePlan;
}
