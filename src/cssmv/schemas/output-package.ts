export interface OutputMetadata {
  mode: string;
  planType: string;
  musicStrategy: string;
  sceneCount: number;
  cueCount: number;
  durationSec: number;
  segmentCount: number;
  trackCount: number;
  renderProfile: string;
  previewSegmentCount?: number;
  previewScriptLineCount?: number;
  previewStoryboardFrameCount?: number;
  seedTitle?: string;
}

export interface ArtifactManifestEntry {
  key: string;
  fileName: string;
  path: string;
  kind:
    | "project_context"
    | "story_graph"
    | "narrative_plan"
    | "scene_plan"
    | "music_plan"
    | "rendered_media"
    | "output_package"
    | "audio_preview"
    | "preview_storyboard"
    | "preview_script";
}

export interface ArtifactManifest {
  manifestVersion: string;
  projectId: string;
  mode: string;
  artifactDir: string;
  generatedAt: string;
  entries: ArtifactManifestEntry[];
}

export interface OutputPackage {
  mainVideo?: string;
  audioPreview?: string;
  episodeVideos?: string[];
  trailerVideos?: string[];
  clips?: string[];
  subtitles?: string[];
  previewStoryboard?: string[];
  previewScript?: string[];
  metadata?: OutputMetadata;
  artifactManifest?: ArtifactManifest;
}
