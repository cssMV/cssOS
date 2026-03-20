export interface TrackNode {
  trackId: string;
  label: string;
  purpose?: string;
  stems?: string[];
  texture?: string;
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

export interface MusicPlan {
  tracks: TrackNode[];
  cues: CueNode[];
  strategy: "full_song" | "fragment" | "motif" | "hybrid";
  structureSummary?: string;
  previewSegments?: PreviewSegment[];
  previewScript?: string[];
}

export interface MusicContinuationCard {
  text: string;
  targetUrl?: string;
  placement: "description" | "post_credit" | "both";
}
