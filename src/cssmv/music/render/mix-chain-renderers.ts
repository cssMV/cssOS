import type { MusicPlan } from "../../schemas/music-plan";
import type { ProjectSpec } from "../../core/project-spec";
import type { MixChainArtifacts, MixChainRenderer } from "./types";
import { resolveResourceSelection, toLegalBinding } from "./resource-registry";

class StubMixChainRenderer implements MixChainRenderer {
  readonly id = "cssmv.render.mix.stub";
  readonly version = "v1";
  readonly mode = "stub" as const;

  render(input: {
    project: ProjectSpec;
    musicPlan: MusicPlan;
    stems?: Array<{ role: string; path: string }>;
    mixWavPath: string;
  }): MixChainArtifacts {
    void input;
    return {
      rendererId: this.id,
      rendererVersion: this.version,
      mode: this.mode,
      capability: {
        symbolicComposition: false,
        licensedLibraryPlayback: false,
        externalAdapterBridge: false,
        vocalSynthesis: false,
        stemRendering: false,
        mixBusProcessing: false
      },
      notes: [
        "No dedicated mix chain is configured yet.",
        "Replace with a mastering bus, licensed DSP chain, or external mixing adapter."
      ]
    };
  }
}

class LicensedLibraryMixChainRenderer implements MixChainRenderer {
  readonly id = "cssmv.render.mix.licensed_library";
  readonly version = "v1";
  readonly mode = "licensed_library" as const;

  constructor(
    private readonly mixProfileId: string,
    private readonly sourceHint = ""
  ) {}

  render(input: {
    project: ProjectSpec;
    musicPlan: MusicPlan;
    stems?: Array<{ role: string; path: string }>;
    mixWavPath: string;
  }): MixChainArtifacts {
    const selection = resolveResourceSelection(input.project, "mixBusProcessing", this.mixProfileId);
    return {
      rendererId: this.id,
      rendererVersion: this.version,
      mode: this.mode,
      capability: {
        symbolicComposition: false,
        licensedLibraryPlayback: true,
        externalAdapterBridge: false,
        vocalSynthesis: false,
        stemRendering: true,
        mixBusProcessing: true
      },
      resources: toLegalBinding(selection.primary),
      notes: [
        ...selection.rationale,
        this.sourceHint ? `Preferred by audio resource: ${this.sourceHint}.` : "Preferred mix chain selected.",
        selection.primary?.renderHostFamily ? `Render host family: ${selection.primary.renderHostFamily}.` : "",
        selection.primary?.cachePolicy ? `Cache policy: ${selection.primary.cachePolicy}.` : "",
        selection.primary?.provenancePolicy
          ? `Provenance policy: ${selection.primary.provenancePolicy}.`
          : "",
        selection.primary?.retentionPolicy
          ? `Retention policy: ${selection.primary.retentionPolicy}.`
          : "",
        selection.primary?.auditScope ? `Audit scope: ${selection.primary.auditScope}.` : "",
        selection.primary?.reproducibilityTier
          ? `Reproducibility tier: ${selection.primary.reproducibilityTier}.`
          : "",
        selection.primary?.executionSla ? `Execution SLA: ${selection.primary.executionSla}.` : "",
        selection.primary?.fallbackPolicy
          ? `Fallback policy: ${selection.primary.fallbackPolicy}.`
          : "",
        selection.primary?.packagingPolicy
          ? `Packaging policy: ${selection.primary.packagingPolicy}.`
          : "",
        selection.primary?.queueClass ? `Queue class: ${selection.primary.queueClass}.` : "",
        selection.primary?.retryBudget ? `Retry budget: ${selection.primary.retryBudget}.` : "",
        selection.primary?.artifactRetentionClass
          ? `Artifact retention class: ${selection.primary.artifactRetentionClass}.`
          : "",
        selection.primary?.dispatchWindow ? `Dispatch window: ${selection.primary.dispatchWindow}.` : "",
        selection.primary?.deliveryBundleClass
          ? `Delivery bundle class: ${selection.primary.deliveryBundleClass}.`
          : "",
        selection.primary?.publicationPolicy
          ? `Publication policy: ${selection.primary.publicationPolicy}.`
          : "",
        selection.primary?.executionMode ? `Execution mode: ${selection.primary.executionMode}.` : "",
        selection.primary?.handoffPolicy ? `Handoff policy: ${selection.primary.handoffPolicy}.` : "",
        selection.primary?.verificationPolicy
          ? `Verification policy: ${selection.primary.verificationPolicy}.`
          : "",
        selection.primary?.governanceClass
          ? `Governance class: ${selection.primary.governanceClass}.`
          : "",
        selection.primary?.approvalRequirement
          ? `Approval requirement: ${selection.primary.approvalRequirement}.`
          : "",
        selection.primary?.complianceEnvelope
          ? `Compliance envelope: ${selection.primary.complianceEnvelope}.`
          : "",
        selection.primary?.auditTrailClass
          ? `Audit trail class: ${selection.primary.auditTrailClass}.`
          : "",
        selection.primary?.incidentRouting
          ? `Incident routing: ${selection.primary.incidentRouting}.`
          : "",
        selection.primary?.exceptionEscalation
          ? `Exception escalation: ${selection.primary.exceptionEscalation}.`
          : "",
        selection.primary?.evidencePolicy
          ? `Evidence policy: ${selection.primary.evidencePolicy}.`
          : "",
        selection.primary?.releaseTicketClass
          ? `Release ticket class: ${selection.primary.releaseTicketClass}.`
          : "",
        selection.primary?.attestationPolicy
          ? `Attestation policy: ${selection.primary.attestationPolicy}.`
          : "",
        selection.primary?.operatorOverridePolicy
          ? `Operator override policy: ${selection.primary.operatorOverridePolicy}.`
          : "",
        selection.primary?.provenanceSealClass
          ? `Provenance seal class: ${selection.primary.provenanceSealClass}.`
          : "",
        selection.primary?.deliveryAssuranceClass
          ? `Delivery assurance class: ${selection.primary.deliveryAssuranceClass}.`
          : "",
        selection.primary?.renderExecutorClass
          ? `Render executor class: ${selection.primary.renderExecutorClass}.`
          : "",
        selection.primary?.hostReservationPolicy
          ? `Host reservation policy: ${selection.primary.hostReservationPolicy}.`
          : "",
        selection.primary?.deliveryCheckpointClass
          ? `Delivery checkpoint class: ${selection.primary.deliveryCheckpointClass}.`
          : "",
        "Attach lawful bus presets, IRs, and mastering rules here."
      ].filter(Boolean)
    };
  }
}

class ExternalAdapterMixChainRenderer implements MixChainRenderer {
  readonly id = "cssmv.render.mix.external_adapter";
  readonly version = "v1";
  readonly mode = "external_adapter" as const;

  constructor(
    private readonly adapterName: string,
    private readonly sourceHint = ""
  ) {}

  render(input: {
    project: ProjectSpec;
    musicPlan: MusicPlan;
    stems?: Array<{ role: string; path: string }>;
    mixWavPath: string;
  }): MixChainArtifacts {
    const selection = resolveResourceSelection(input.project, "externalAdapterBridge", this.adapterName);
    return {
      rendererId: this.id,
      rendererVersion: this.version,
      mode: this.mode,
      capability: {
        symbolicComposition: false,
        licensedLibraryPlayback: false,
        externalAdapterBridge: true,
        vocalSynthesis: false,
        stemRendering: true,
        mixBusProcessing: true
      },
      resources: toLegalBinding(selection.primary),
      notes: [
        ...selection.rationale,
        this.sourceHint ? `Preferred by audio resource: ${this.sourceHint}.` : "External mix route selected.",
        selection.primary?.renderHostFamily ? `Render host family: ${selection.primary.renderHostFamily}.` : "",
        selection.primary?.cachePolicy ? `Cache policy: ${selection.primary.cachePolicy}.` : "",
        selection.primary?.provenancePolicy
          ? `Provenance policy: ${selection.primary.provenancePolicy}.`
          : "",
        selection.primary?.retentionPolicy
          ? `Retention policy: ${selection.primary.retentionPolicy}.`
          : "",
        selection.primary?.auditScope ? `Audit scope: ${selection.primary.auditScope}.` : "",
        selection.primary?.reproducibilityTier
          ? `Reproducibility tier: ${selection.primary.reproducibilityTier}.`
          : "",
        selection.primary?.executionSla ? `Execution SLA: ${selection.primary.executionSla}.` : "",
        selection.primary?.fallbackPolicy
          ? `Fallback policy: ${selection.primary.fallbackPolicy}.`
          : "",
        selection.primary?.packagingPolicy
          ? `Packaging policy: ${selection.primary.packagingPolicy}.`
          : "",
        selection.primary?.queueClass ? `Queue class: ${selection.primary.queueClass}.` : "",
        selection.primary?.retryBudget ? `Retry budget: ${selection.primary.retryBudget}.` : "",
        selection.primary?.artifactRetentionClass
          ? `Artifact retention class: ${selection.primary.artifactRetentionClass}.`
          : "",
        selection.primary?.dispatchWindow ? `Dispatch window: ${selection.primary.dispatchWindow}.` : "",
        selection.primary?.deliveryBundleClass
          ? `Delivery bundle class: ${selection.primary.deliveryBundleClass}.`
          : "",
        selection.primary?.publicationPolicy
          ? `Publication policy: ${selection.primary.publicationPolicy}.`
          : "",
        selection.primary?.executionMode ? `Execution mode: ${selection.primary.executionMode}.` : "",
        selection.primary?.handoffPolicy ? `Handoff policy: ${selection.primary.handoffPolicy}.` : "",
        selection.primary?.verificationPolicy
          ? `Verification policy: ${selection.primary.verificationPolicy}.`
          : "",
        selection.primary?.governanceClass
          ? `Governance class: ${selection.primary.governanceClass}.`
          : "",
        selection.primary?.approvalRequirement
          ? `Approval requirement: ${selection.primary.approvalRequirement}.`
          : "",
        selection.primary?.complianceEnvelope
          ? `Compliance envelope: ${selection.primary.complianceEnvelope}.`
          : "",
        selection.primary?.auditTrailClass
          ? `Audit trail class: ${selection.primary.auditTrailClass}.`
          : "",
        selection.primary?.incidentRouting
          ? `Incident routing: ${selection.primary.incidentRouting}.`
          : "",
        selection.primary?.exceptionEscalation
          ? `Exception escalation: ${selection.primary.exceptionEscalation}.`
          : "",
        selection.primary?.evidencePolicy
          ? `Evidence policy: ${selection.primary.evidencePolicy}.`
          : "",
        selection.primary?.releaseTicketClass
          ? `Release ticket class: ${selection.primary.releaseTicketClass}.`
          : "",
        selection.primary?.attestationPolicy
          ? `Attestation policy: ${selection.primary.attestationPolicy}.`
          : "",
        selection.primary?.operatorOverridePolicy
          ? `Operator override policy: ${selection.primary.operatorOverridePolicy}.`
          : "",
        selection.primary?.provenanceSealClass
          ? `Provenance seal class: ${selection.primary.provenanceSealClass}.`
          : "",
        selection.primary?.deliveryAssuranceClass
          ? `Delivery assurance class: ${selection.primary.deliveryAssuranceClass}.`
          : "",
        selection.primary?.renderExecutorClass
          ? `Render executor class: ${selection.primary.renderExecutorClass}.`
          : "",
        selection.primary?.hostReservationPolicy
          ? `Host reservation policy: ${selection.primary.hostReservationPolicy}.`
          : "",
        selection.primary?.deliveryCheckpointClass
          ? `Delivery checkpoint class: ${selection.primary.deliveryCheckpointClass}.`
          : "",
        "Attach an authorized external mix bus adapter or DAW mastering bridge here."
      ].filter(Boolean)
    };
  }
}

export function createMixChainRenderer(project: ProjectSpec): MixChainRenderer {
  const adapter = String(project.creative?.external_audio_adapter || "").trim();
  if (adapter) {
    const selection = resolveResourceSelection(project, "externalAdapterBridge", adapter);
    if (selection.primary?.defaultMixRoute === "external_adapter") {
      return new ExternalAdapterMixChainRenderer(adapter, selection.primary?.displayName || adapter);
    }
    const preferredMixChain = selection.primary?.preferredMixChain || "mastering-bus";
    return new LicensedLibraryMixChainRenderer(preferredMixChain, selection.primary?.displayName || adapter);
  }
  const stylePack = String(project.creative?.licensed_style_pack || "").trim();
  if (stylePack) {
    const selection = resolveResourceSelection(project, "licensedLibraryPlayback", stylePack);
    if (selection.primary?.defaultMixRoute === "stub") {
      return new StubMixChainRenderer();
    }
    const preferredMixChain = selection.primary?.preferredMixChain || stylePack;
    return new LicensedLibraryMixChainRenderer(preferredMixChain, selection.primary?.displayName || stylePack);
  }
  return new LicensedLibraryMixChainRenderer("free-vocal-chain", "free-vocal-chain");
}
