import type { MusicPlan } from "../../schemas/music-plan";
import type { ProjectSpec } from "../../core/project-spec";
import type { VocalRenderArtifacts, VocalRenderer } from "./types";
import { resolveResourceSelection, toLegalBinding } from "./resource-registry";

class StubVocalRenderer implements VocalRenderer {
  readonly id = "cssmv.render.vocal.stub";
  readonly version = "v1";
  readonly mode = "stub" as const;

  render(input: { project: ProjectSpec; musicPlan: MusicPlan; lyrics?: string }): VocalRenderArtifacts {
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
        "No vocal synthesis backend is configured yet.",
        "Replace with a licensed voicebank or an authorized external vocal adapter."
      ]
    };
  }
}

class ExternalAdapterVocalRenderer implements VocalRenderer {
  readonly id = "cssmv.render.vocal.external_adapter";
  readonly version = "v1";
  readonly mode = "external_adapter" as const;

  constructor(private readonly adapterName: string) {}

  render(input: { project: ProjectSpec; musicPlan: MusicPlan; lyrics?: string }): VocalRenderArtifacts {
    const selection = resolveResourceSelection(input.project, "vocalSynthesis", this.adapterName);
    return {
      rendererId: this.id,
      rendererVersion: this.version,
      mode: this.mode,
      capability: {
        symbolicComposition: false,
        licensedLibraryPlayback: false,
        externalAdapterBridge: true,
        vocalSynthesis: true,
        stemRendering: true,
        mixBusProcessing: false
      },
      resources: toLegalBinding(selection.primary),
      notes: [
        ...selection.rationale,
        `External vocal adapter placeholder: ${this.adapterName}.`,
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
        "Wire this to an authorized singing synth or approved voice rendering service."
      ].filter(Boolean)
    };
  }
}

class LicensedVoicebankVocalRenderer implements VocalRenderer {
  readonly id = "cssmv.render.vocal.licensed_voicebank";
  readonly version = "v1";
  readonly mode = "licensed_library" as const;

  constructor(private readonly voiceHint: string) {}

  render(input: { project: ProjectSpec; musicPlan: MusicPlan; lyrics?: string }): VocalRenderArtifacts {
    const selection = resolveResourceSelection(input.project, "vocalSynthesis", this.voiceHint || "licensed-voicebank");
    return {
      rendererId: this.id,
      rendererVersion: this.version,
      mode: this.mode,
      capability: {
        symbolicComposition: false,
        licensedLibraryPlayback: true,
        externalAdapterBridge: false,
        vocalSynthesis: true,
        stemRendering: true,
        mixBusProcessing: false
      },
      resources: toLegalBinding(selection.primary),
      notes: [
        ...selection.rationale,
        `Licensed voicebank route selected: ${this.voiceHint || "licensed-voicebank"}.`,
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
        "Attach an authorized singer model, phoneme lexicon, and legal voicebank package here."
      ].filter(Boolean)
    };
  }
}

export function createVocalRenderer(project: ProjectSpec): VocalRenderer {
  const adapter = String(project.creative?.external_audio_adapter || "").trim();
  if (adapter) {
    const selection = resolveResourceSelection(project, "externalAdapterBridge", adapter);
    if (selection.primary?.defaultVocalRoute === "licensed_voicebank") {
      return new LicensedVoicebankVocalRenderer("licensed-voicebank");
    }
    if (selection.primary?.defaultVocalRoute === "stub") {
      return new StubVocalRenderer();
    }
    return new ExternalAdapterVocalRenderer(adapter);
  }
  const stylePack = String(project.creative?.licensed_style_pack || "").trim();
  if (stylePack) {
    const selection = resolveResourceSelection(project, "licensedLibraryPlayback", stylePack);
    if (selection.primary?.defaultVocalRoute === "stub") {
      return new StubVocalRenderer();
    }
    return new LicensedVoicebankVocalRenderer("licensed-voicebank");
  }
  return new LicensedVoicebankVocalRenderer("free-ai-singer");
}
