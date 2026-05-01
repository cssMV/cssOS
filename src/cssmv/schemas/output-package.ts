import type { RenderedSegment } from "./rendered-media";
import type { StructuredNode, StructuredWorkType } from "./structure-tree";

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
  subtitleCueCount?: number;
  transitionCount?: number;
  seedTitle?: string;
  workType?: StructuredWorkType;
  structureNodeCount?: number;
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
    | "audio_mix"
    | "segment_timeline"
    | "preview_storyboard"
    | "preview_script"
    | "video_storyboard_plan"
    | "video_assemble_plan"
    | "render_execution_manifest"
    | "render_host_plan"
    | "render_host_runbook"
    | "render_host_probe";
}

export interface ArtifactManifest {
  manifestVersion: string;
  projectId: string;
  mode: string;
  artifactDir: string;
  generatedAt: string;
  entries: ArtifactManifestEntry[];
}

export interface RenderExecutionNode {
  rendererId: string;
  rendererVersion: string;
  mode: "stub" | "symbolic" | "licensed_library" | "external_adapter";
  resources?: Array<{
    kind: string;
    id: string;
    displayName: string;
    requiredAssets?: string[];
    vendor?: string;
    source: "internal" | "licensed_vendor" | "customer_bring_your_own";
    licenseScope: "dev_only" | "evaluation" | "commercial";
    licenseLabel?: string;
    assetPackageId?: string;
    adapterEndpointClass?: string;
    renderHostFamily?: string;
    queueClass?: string;
    packagingPolicy?: string;
    deliveryBundleClass?: string;
    publicationPolicy?: string;
    governanceClass?: string;
    complianceEnvelope?: string;
    evidencePolicy?: string;
    provenanceSealClass?: string;
    deliveryAssuranceClass?: string;
    deliveryTargetClass?: string;
    approvalChainClass?: string;
    dispatchDeadlineClass?: string;
    renderExecutorClass?: string;
    hostReservationPolicy?: string;
    deliveryCheckpointClass?: string;
    exampleProducts?: string[];
    recommendedUpgradeIds?: string[];
    upgradeHint?: string;
  }>;
  notes?: string[];
}

export interface RenderExecutionManifest {
  schema: string;
  generatedAt: string;
  projectId: string;
  mode: string;
  audio: RenderExecutionNode;
  vocal: RenderExecutionNode;
  vocalSource?: RenderExecutionNode;
  vocalFx?: RenderExecutionNode;
  mix: RenderExecutionNode;
  stems?: Array<{ role: string; path: string }>;
  stemPlan?: Array<{ role: string; targetPath: string; sourceHint?: string; rendererHint?: string }>;
  deliveryPolicy?: {
    queueClass?: string;
    dispatchWindow?: string;
    packagingPolicy?: string;
    deliveryBundleClass?: string;
    publicationPolicy?: string;
    governanceClass?: string;
    complianceEnvelope?: string;
    evidencePolicy?: string;
    provenanceSealClass?: string;
    deliveryAssuranceClass?: string;
    deliveryTargetClass?: string;
    approvalChainClass?: string;
    dispatchDeadlineClass?: string;
    renderExecutorClass?: string;
    hostReservationPolicy?: string;
    deliveryCheckpointClass?: string;
    exampleProducts?: string[];
    recommendedUpgradeIds?: string[];
    upgradeHint?: string;
  };
}

export interface OutputPackage {
  mainVideo?: string;
  audioPreview?: string;
  audioMix?: string;
  stems?: Array<{ role: string; path: string }>;
  audioRenderProvenance?: {
    rendererId: string;
    rendererVersion: string;
    mode: "stub" | "symbolic" | "licensed_library" | "external_adapter";
    voiceRenderer?: string;
    vocalSourceRenderer?: string;
    vocalFxRenderer?: string;
    instrumentRenderer?: string;
    mixChain?: string;
    executionSources?: string[];
    outputQualityTier?: string;
    hostExecutionModeSummary?: string;
    hostRenderedAudioActive?: boolean;
    generatedArtifacts?: string[];
    hostLaunchCommands?: string[];
    hostStageSummaries?: Array<{
      stage: string;
      executionSource?: string;
      outputQualityTier?: string;
      executionStatus?: string;
      resolvedExecutable?: string;
      resolvedCommand?: string;
      launchCwd?: string;
      generatedArtifacts?: string[];
    }>;
    notes?: string[];
  };
  episodeVideos?: string[];
  trailerVideos?: string[];
  clips?: string[];
  subtitles?: string[];
  subtitleCues?: string[];
  segmentTimeline?: RenderedSegment[];
  previewStoryboard?: string[];
  previewScript?: string[];
  workType?: StructuredWorkType;
  structureTree?: StructuredNode[];
  metadata?: OutputMetadata;
  artifactManifest?: ArtifactManifest;
  renderExecutionManifest?: RenderExecutionManifest;
  renderHostPlan?: unknown;
  renderHostRunbook?: unknown;
  renderHostProbe?: unknown;
}
