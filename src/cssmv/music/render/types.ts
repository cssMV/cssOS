import type { ProjectSpec } from "../../core/project-spec";
import type { MusicPlan } from "../../schemas/music-plan";

export interface AudioRenderCue {
  durationSec: number;
  energy?: string;
  section?: string;
}

export interface RendererCapability {
  symbolicComposition: boolean;
  licensedLibraryPlayback: boolean;
  externalAdapterBridge: boolean;
  vocalSynthesis: boolean;
  stemRendering: boolean;
  mixBusProcessing: boolean;
}

export interface LegalResourceBinding {
  kind: "style_pack" | "sample_library" | "voicebank" | "external_adapter" | "mix_chain_preset";
  id: string;
  displayName: string;
  vendor?: string;
  source: "internal" | "licensed_vendor" | "customer_bring_your_own";
  licenseScope: "dev_only" | "evaluation" | "commercial";
  licenseLabel?: string;
  requiredAssets?: string[];
  stemRoles?: string[];
  preferredMixChain?: string;
  defaultVocalRoute?: "stub" | "licensed_voicebank" | "external_adapter";
  defaultMixRoute?: "stub" | "licensed_library" | "external_adapter";
  defaultInstrumentRoute?: "stub" | "licensed_library" | "external_adapter";
  assetPackageId?: string;
  stemPackageTemplate?: string;
  adapterEndpointClass?: string;
  renderHostFamily?: "internal_stub" | "licensed_plugin_host" | "external_daw" | "voicebank_host";
  cachePolicy?: "ephemeral" | "project_scoped" | "asset_package_scoped";
  provenancePolicy?: "minimal" | "standard" | "full_lineage";
  retentionPolicy?: "transient" | "project_retained" | "audit_retained";
  auditScope?: "none" | "resource_only" | "resource_and_render_chain";
  reproducibilityTier?: "best_effort" | "seeded" | "fully_pinned";
  executionSla?: "best_effort" | "interactive" | "batch_priority";
  fallbackPolicy?: "fail_closed" | "fallback_to_stub" | "fallback_to_lower_fidelity";
  packagingPolicy?: "single_mix_only" | "mix_plus_stems" | "full_delivery_bundle";
  queueClass?: "local_dev" | "interactive" | "priority_batch" | "offline_render";
  retryBudget?: "none" | "single_retry" | "bounded_retries" | "operator_managed";
  artifactRetentionClass?: "ephemeral_preview" | "project_bundle" | "audit_archive";
  dispatchWindow?: "inline" | "session_batch" | "overnight_batch" | "operator_scheduled";
  deliveryBundleClass?: "preview_only" | "review_bundle" | "release_bundle" | "archive_bundle";
  publicationPolicy?: "manual_release" | "gated_release" | "operator_release";
  executionMode?: "single_pass" | "iterative_refine" | "human_in_the_loop";
  handoffPolicy?: "local_only" | "adapter_review" | "ops_signoff";
  verificationPolicy?: "none" | "artifact_checks" | "full_delivery_verification";
  governanceClass?: "dev_only" | "operator_supervised" | "audited_release";
  approvalRequirement?: "none" | "single_operator" | "dual_control";
  complianceEnvelope?: "basic" | "licensed_assets" | "licensed_and_audited";
  auditTrailClass?: "none" | "project_event_log" | "signed_audit_trail";
  incidentRouting?: "none" | "operator_queue" | "compliance_queue";
  exceptionEscalation?: "silent" | "operator_alert" | "dual_control_review";
  evidencePolicy?: "none" | "artifact_hashes" | "signed_release_evidence";
  releaseTicketClass?: "none" | "operator_ticket" | "change_control_ticket";
  attestationPolicy?: "none" | "operator_attestation" | "dual_control_attestation";
  operatorOverridePolicy?: "none" | "ticketed_override" | "dual_control_override";
  provenanceSealClass?: "none" | "hash_chain" | "signed_manifest";
  deliveryAssuranceClass?: "preview_only" | "review_ready" | "release_certified";
  deliveryTargetClass?: "internal_review" | "creator_review" | "buyer_preview" | "release_distribution";
  approvalChainClass?: "self_serve" | "operator_review" | "operator_and_compliance";
  dispatchDeadlineClass?: "none" | "session_close" | "overnight_cutoff" | "release_window";
  notes?: string[];
}

export interface StemPlanEntry {
  role: string;
  targetPath: string;
  sourceHint?: string;
  rendererHint?: string;
}

export interface AudioRenderPaths {
  previewWavPath: string;
  mixWavPath: string;
}

export interface AudioRenderArtifacts {
  previewWavPath: string;
  mixWavPath: string;
  stems?: Array<{ role: string; path: string }>;
  stemPlan?: StemPlanEntry[];
  capability: RendererCapability;
  resources?: LegalResourceBinding[];
  provenance: {
    rendererId: string;
    rendererVersion: string;
    mode: "stub" | "symbolic" | "licensed_library" | "external_adapter";
    voiceRenderer?: string;
    instrumentRenderer?: string;
    mixChain?: string;
    notes?: string[];
  };
}

export interface VocalRenderArtifacts {
  stemPath?: string;
  rendererId: string;
  rendererVersion: string;
  mode: "stub" | "licensed_library" | "external_adapter";
  capability: RendererCapability;
  resources?: LegalResourceBinding[];
  notes?: string[];
}

export interface VocalRenderer {
  readonly id: string;
  readonly version: string;
  readonly mode: VocalRenderArtifacts["mode"];
  render(input: {
    project: ProjectSpec;
    musicPlan: MusicPlan;
    lyrics?: string | undefined;
  }): VocalRenderArtifacts;
}

export interface MixChainArtifacts {
  rendererId: string;
  rendererVersion: string;
  mode: "stub" | "licensed_library" | "external_adapter";
  capability: RendererCapability;
  resources?: LegalResourceBinding[];
  notes?: string[];
}

export interface MixChainRenderer {
  readonly id: string;
  readonly version: string;
  readonly mode: MixChainArtifacts["mode"];
  render(input: {
    project: ProjectSpec;
    musicPlan: MusicPlan;
    stems?: Array<{ role: string; path: string }> | undefined;
    mixWavPath: string;
  }): MixChainArtifacts;
}

export interface AudioRenderer {
  readonly id: string;
  readonly version: string;
  readonly mode: AudioRenderArtifacts["provenance"]["mode"];
  render(input: {
    project: ProjectSpec;
    musicPlan: MusicPlan;
    paths: AudioRenderPaths;
    previewCues: AudioRenderCue[];
    mixCues: AudioRenderCue[];
  }): AudioRenderArtifacts;
}
