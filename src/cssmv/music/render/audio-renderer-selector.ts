import type { ProjectSpec } from "../../core/project-spec";
import type { AudioRenderArtifacts, AudioRenderer, StemPlanEntry } from "./types";
import { DefaultStubAudioRenderer } from "./default-audio-renderer";
import {
  resolveResourceSelection,
  toLegalBinding
} from "./resource-registry";

function buildStemPlan(
  paths: { mixWavPath: string },
  rendererHint: string,
  roles = ["lead_vocal", "music_bed", "drums", "bass"],
  template = ""
): StemPlanEntry[] {
  const base = paths.mixWavPath.replace(/\.wav$/i, "");
  return roles.map((role) => {
    const entry: StemPlanEntry = {
      role,
      targetPath: `${base}.${role}.wav`,
      rendererHint
    };
    if (template) entry.sourceHint = template;
    return entry;
  });
}

class LicensedLibraryAudioRenderer implements AudioRenderer {
  readonly id = "cssmv.render.audio.licensed_library";
  readonly version = "v1";
  readonly mode = "licensed_library" as const;

  constructor(private readonly stylePack: string) {}

  render(input: Parameters<DefaultStubAudioRenderer["render"]>[0]): AudioRenderArtifacts {
    const artifacts = new DefaultStubAudioRenderer().render(input);
    const selection = resolveResourceSelection(input.project, "licensedLibraryPlayback", this.stylePack);
    if (selection.primary?.defaultInstrumentRoute === "stub") {
      return artifacts;
    }
    const stemRoles = selection.primary?.stemRoles?.length ? selection.primary.stemRoles : undefined;
    const stemTemplate = selection.primary?.stemPackageTemplate || "";
    return {
      ...artifacts,
      capability: {
        symbolicComposition: true,
        licensedLibraryPlayback: true,
        externalAdapterBridge: false,
        vocalSynthesis: false,
        stemRendering: true,
        mixBusProcessing: true
      },
      stemPlan: buildStemPlan(input.paths, this.id, stemRoles, stemTemplate),
      resources: toLegalBinding(selection.primary),
      provenance: {
        ...artifacts.provenance,
        rendererId: this.id,
        rendererVersion: this.version,
        mode: this.mode,
        instrumentRenderer: this.stylePack,
        notes: [
          ...selection.rationale,
          `Licensed library placeholder selected for style pack: ${this.stylePack}.`,
          selection.primary?.adapterEndpointClass
            ? `Adapter endpoint class: ${selection.primary.adapterEndpointClass}.`
            : "",
          selection.primary?.renderHostFamily
            ? `Render host family: ${selection.primary.renderHostFamily}.`
            : "",
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
          selection.primary?.dispatchWindow
            ? `Dispatch window: ${selection.primary.dispatchWindow}.`
            : "",
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
          "Attach lawful ROMpler / VSTi / sample-library rendering here."
        ].filter(Boolean)
      }
    };
  }
}

class ExternalAdapterAudioRenderer implements AudioRenderer {
  readonly id = "cssmv.render.audio.external_adapter";
  readonly version = "v1";
  readonly mode = "external_adapter" as const;

  constructor(private readonly adapterName: string) {}

  render(input: Parameters<DefaultStubAudioRenderer["render"]>[0]): AudioRenderArtifacts {
    const artifacts = new DefaultStubAudioRenderer().render(input);
    const selection = resolveResourceSelection(input.project, "externalAdapterBridge", this.adapterName);
    if (selection.primary?.defaultInstrumentRoute === "stub") {
      return artifacts;
    }
    const stemRoles = selection.primary?.stemRoles?.length ? selection.primary.stemRoles : undefined;
    const stemTemplate = selection.primary?.stemPackageTemplate || "";
    return {
      ...artifacts,
      capability: {
        symbolicComposition: true,
        licensedLibraryPlayback: false,
        externalAdapterBridge: true,
        vocalSynthesis: false,
        stemRendering: true,
        mixBusProcessing: true
      },
      stemPlan: buildStemPlan(input.paths, this.id, stemRoles, stemTemplate),
      resources: toLegalBinding(selection.primary),
      provenance: {
        ...artifacts.provenance,
        rendererId: this.id,
        rendererVersion: this.version,
        mode: this.mode,
        instrumentRenderer: this.adapterName,
        notes: [
          ...selection.rationale,
          `External audio adapter placeholder selected: ${this.adapterName}.`,
          selection.primary?.adapterEndpointClass
            ? `Adapter endpoint class: ${selection.primary.adapterEndpointClass}.`
            : "",
          selection.primary?.renderHostFamily
            ? `Render host family: ${selection.primary.renderHostFamily}.`
            : "",
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
          selection.primary?.dispatchWindow
            ? `Dispatch window: ${selection.primary.dispatchWindow}.`
            : "",
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
          "Attach lawful DAW / synth / rendering adapter here."
        ].filter(Boolean)
      }
    };
  }
}

export function createAudioRenderer(project: ProjectSpec): AudioRenderer {
  const adapter = String(project.creative?.external_audio_adapter || "").trim();
  if (adapter) {
    const selection = resolveResourceSelection(project, "externalAdapterBridge", adapter);
    if (selection.primary?.defaultInstrumentRoute === "stub") {
      return new DefaultStubAudioRenderer();
    }
    return new ExternalAdapterAudioRenderer(adapter);
  }
  const stylePack = String(project.creative?.licensed_style_pack || "").trim();
  if (stylePack) {
    const selection = resolveResourceSelection(project, "licensedLibraryPlayback", stylePack);
    if (selection.primary?.defaultInstrumentRoute === "stub") {
      return new DefaultStubAudioRenderer();
    }
    return new LicensedLibraryAudioRenderer(stylePack);
  }
  return new LicensedLibraryAudioRenderer("free-community-stack");
}
