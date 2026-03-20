export interface RenderedMedia {
  videoSegments: string[];
  mainCompositeVideo?: string;
  audioMix?: string;
  audioPreview?: string;
  subtitleTrack?: string;
  thumbnails?: string[];
  totalDurationSec?: number;
  previewStoryboard?: string[];
  previewScript?: string[];
  renderProfile?: "mv_stub" | "microdrama_stub" | "series_stub" | "cinema_stub";
}
