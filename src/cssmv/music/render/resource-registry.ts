import type { ProjectSpec } from "../../core/project-spec";
import type { LegalResourceBinding, RendererCapability } from "./types";

export interface RenderResourceProfile extends LegalResourceBinding {
  supports: Partial<RendererCapability>;
  matchTags: string[];
}

const RESOURCE_REGISTRY: RenderResourceProfile[] = [
  {
    kind: "style_pack",
    id: "core",
    displayName: "CSSMV Core",
    vendor: "CSSStudio",
    source: "internal",
    licenseScope: "dev_only",
    licenseLabel: "Internal development only",
    requiredAssets: ["stub-preview-wav", "stub-mix-wav"],
    stemRoles: ["music_bed"],
    preferredMixChain: "mastering-bus",
    defaultVocalRoute: "stub",
    defaultMixRoute: "stub",
    defaultInstrumentRoute: "stub",
    assetPackageId: "cssmv-core-dev",
    stemPackageTemplate: "core-single-bed",
    adapterEndpointClass: "internal-dev",
    renderHostFamily: "internal_stub",
    cachePolicy: "ephemeral",
    provenancePolicy: "minimal",
    retentionPolicy: "transient",
    auditScope: "none",
    reproducibilityTier: "best_effort",
    executionSla: "best_effort",
    fallbackPolicy: "fallback_to_stub",
    packagingPolicy: "single_mix_only",
    queueClass: "local_dev",
    retryBudget: "single_retry",
    artifactRetentionClass: "ephemeral_preview",
    dispatchWindow: "inline",
    deliveryBundleClass: "preview_only",
    publicationPolicy: "manual_release",
    executionMode: "single_pass",
    handoffPolicy: "local_only",
    verificationPolicy: "artifact_checks",
    governanceClass: "dev_only",
    approvalRequirement: "none",
    complianceEnvelope: "basic",
    auditTrailClass: "project_event_log",
    incidentRouting: "none",
    exceptionEscalation: "silent",
    evidencePolicy: "artifact_hashes",
    releaseTicketClass: "none",
    attestationPolicy: "none",
    operatorOverridePolicy: "none",
    provenanceSealClass: "none",
    deliveryAssuranceClass: "preview_only",
    deliveryTargetClass: "buyer_preview",
    approvalChainClass: "self_serve",
    dispatchDeadlineClass: "none",
    supports: {
      symbolicComposition: true
    },
    matchTags: ["core", "default"],
    notes: ["Internal fallback profile."]
  },
  {
    kind: "style_pack",
    id: "orchestral",
    displayName: "Licensed Orchestral Pack",
    vendor: "Licensed Vendor Pack",
    source: "licensed_vendor",
    licenseScope: "commercial",
    licenseLabel: "Commercial sample-library agreement required",
    requiredAssets: ["strings-ensemble", "brass-ensemble", "woodwinds", "cinematic-percussion"],
    stemRoles: ["lead_vocal", "strings", "brass", "woodwinds", "percussion", "bass"],
    preferredMixChain: "mastering-bus",
    defaultVocalRoute: "licensed_voicebank",
    defaultMixRoute: "licensed_library",
    defaultInstrumentRoute: "licensed_library",
    assetPackageId: "licensed-orchestral-pack-v1",
    stemPackageTemplate: "cinematic-orchestra-v1",
    adapterEndpointClass: "licensed-library-host",
    renderHostFamily: "licensed_plugin_host",
    cachePolicy: "asset_package_scoped",
    provenancePolicy: "full_lineage",
    retentionPolicy: "audit_retained",
    auditScope: "resource_and_render_chain",
    reproducibilityTier: "fully_pinned",
    executionSla: "batch_priority",
    fallbackPolicy: "fallback_to_lower_fidelity",
    packagingPolicy: "full_delivery_bundle",
    queueClass: "priority_batch",
    retryBudget: "bounded_retries",
    artifactRetentionClass: "audit_archive",
    dispatchWindow: "overnight_batch",
    deliveryBundleClass: "archive_bundle",
    publicationPolicy: "gated_release",
    executionMode: "iterative_refine",
    handoffPolicy: "ops_signoff",
    verificationPolicy: "full_delivery_verification",
    governanceClass: "audited_release",
    approvalRequirement: "dual_control",
    complianceEnvelope: "licensed_and_audited",
    auditTrailClass: "signed_audit_trail",
    incidentRouting: "compliance_queue",
    exceptionEscalation: "dual_control_review",
    evidencePolicy: "signed_release_evidence",
    releaseTicketClass: "change_control_ticket",
    attestationPolicy: "dual_control_attestation",
    operatorOverridePolicy: "dual_control_override",
    provenanceSealClass: "signed_manifest",
    deliveryAssuranceClass: "release_certified",
    deliveryTargetClass: "release_distribution",
    approvalChainClass: "operator_and_compliance",
    dispatchDeadlineClass: "release_window",
    supports: {
      licensedLibraryPlayback: true,
      stemRendering: true,
      mixBusProcessing: true
    },
    matchTags: ["orchestra", "orchestral", "symph", "strings"],
    notes: ["Attach lawful orchestral library mappings here."]
  },
  {
    kind: "style_pack",
    id: "guofeng-cinema",
    displayName: "Licensed Guofeng Cinema Pack",
    vendor: "Licensed Vendor Pack",
    source: "licensed_vendor",
    licenseScope: "commercial",
    licenseLabel: "Commercial traditional-instrument pack required",
    requiredAssets: ["guzheng", "pipa", "erhu", "dizi", "cinematic-drums"],
    stemRoles: ["lead_vocal", "plucked_strings", "bowed_strings", "winds", "percussion", "bass"],
    preferredMixChain: "mastering-bus",
    defaultVocalRoute: "licensed_voicebank",
    defaultMixRoute: "licensed_library",
    defaultInstrumentRoute: "licensed_library",
    assetPackageId: "guofeng-cinema-pack-v1",
    stemPackageTemplate: "guofeng-cinema-v1",
    adapterEndpointClass: "licensed-library-host",
    renderHostFamily: "licensed_plugin_host",
    cachePolicy: "asset_package_scoped",
    provenancePolicy: "full_lineage",
    retentionPolicy: "audit_retained",
    auditScope: "resource_and_render_chain",
    reproducibilityTier: "fully_pinned",
    executionSla: "batch_priority",
    fallbackPolicy: "fallback_to_lower_fidelity",
    packagingPolicy: "full_delivery_bundle",
    queueClass: "priority_batch",
    retryBudget: "bounded_retries",
    artifactRetentionClass: "audit_archive",
    dispatchWindow: "overnight_batch",
    deliveryBundleClass: "archive_bundle",
    publicationPolicy: "gated_release",
    executionMode: "iterative_refine",
    handoffPolicy: "ops_signoff",
    verificationPolicy: "full_delivery_verification",
    governanceClass: "audited_release",
    approvalRequirement: "dual_control",
    complianceEnvelope: "licensed_and_audited",
    auditTrailClass: "signed_audit_trail",
    incidentRouting: "compliance_queue",
    exceptionEscalation: "dual_control_review",
    evidencePolicy: "signed_release_evidence",
    releaseTicketClass: "change_control_ticket",
    attestationPolicy: "dual_control_attestation",
    operatorOverridePolicy: "dual_control_override",
    provenanceSealClass: "signed_manifest",
    deliveryAssuranceClass: "release_certified",
    deliveryTargetClass: "release_distribution",
    approvalChainClass: "operator_and_compliance",
    dispatchDeadlineClass: "release_window",
    supports: {
      licensedLibraryPlayback: true,
      stemRendering: true,
      mixBusProcessing: true
    },
    matchTags: ["guofeng", "guzheng", "pipa", "erhu"],
    notes: ["Attach lawful Chinese instrument mappings here."]
  },
  {
    kind: "external_adapter",
    id: "kontakt",
    displayName: "Kontakt Adapter",
    vendor: "Native Instruments ecosystem",
    source: "customer_bring_your_own",
    licenseScope: "commercial",
    licenseLabel: "Customer-provided Kontakt and library licenses",
    requiredAssets: ["kontakt-host", "licensed-nki-libraries"],
    stemRoles: ["lead_vocal", "music_bed", "drums", "bass", "hooks"],
    preferredMixChain: "mastering-bus",
    defaultVocalRoute: "external_adapter",
    defaultMixRoute: "external_adapter",
    defaultInstrumentRoute: "external_adapter",
    assetPackageId: "kontakt-byol-package",
    stemPackageTemplate: "kontakt-stems-v1",
    adapterEndpointClass: "native-instruments-kontakt",
    renderHostFamily: "external_daw",
    cachePolicy: "project_scoped",
    provenancePolicy: "full_lineage",
    retentionPolicy: "project_retained",
    auditScope: "resource_and_render_chain",
    reproducibilityTier: "seeded",
    executionSla: "interactive",
    fallbackPolicy: "fail_closed",
    packagingPolicy: "mix_plus_stems",
    queueClass: "interactive",
    retryBudget: "operator_managed",
    artifactRetentionClass: "project_bundle",
    dispatchWindow: "session_batch",
    deliveryBundleClass: "review_bundle",
    publicationPolicy: "operator_release",
    executionMode: "human_in_the_loop",
    handoffPolicy: "adapter_review",
    verificationPolicy: "artifact_checks",
    governanceClass: "operator_supervised",
    approvalRequirement: "single_operator",
    complianceEnvelope: "licensed_assets",
    auditTrailClass: "project_event_log",
    incidentRouting: "operator_queue",
    exceptionEscalation: "operator_alert",
    evidencePolicy: "artifact_hashes",
    releaseTicketClass: "operator_ticket",
    attestationPolicy: "operator_attestation",
    operatorOverridePolicy: "ticketed_override",
    provenanceSealClass: "hash_chain",
    deliveryAssuranceClass: "review_ready",
    deliveryTargetClass: "creator_review",
    approvalChainClass: "operator_review",
    dispatchDeadlineClass: "session_close",
    supports: {
      externalAdapterBridge: true,
      stemRendering: true,
      mixBusProcessing: true
    },
    matchTags: ["kontakt"],
    notes: ["Customer must hold the required Kontakt and library licenses."]
  },
  {
    kind: "external_adapter",
    id: "external-default",
    displayName: "External Audio Adapter",
    vendor: "Customer-provided renderer",
    source: "customer_bring_your_own",
    licenseScope: "commercial",
    licenseLabel: "Customer-provided commercial adapter rights",
    requiredAssets: ["adapter-endpoint", "render-auth", "project-export-template"],
    stemRoles: ["lead_vocal", "music_bed", "drums", "bass", "fx"],
    preferredMixChain: "mastering-bus",
    defaultVocalRoute: "external_adapter",
    defaultMixRoute: "external_adapter",
    defaultInstrumentRoute: "external_adapter",
    assetPackageId: "external-adapter-package",
    stemPackageTemplate: "external-adapter-stems-v1",
    adapterEndpointClass: "customer-external-renderer",
    renderHostFamily: "external_daw",
    cachePolicy: "project_scoped",
    provenancePolicy: "standard",
    retentionPolicy: "project_retained",
    auditScope: "resource_only",
    reproducibilityTier: "seeded",
    executionSla: "interactive",
    fallbackPolicy: "fallback_to_lower_fidelity",
    packagingPolicy: "mix_plus_stems",
    queueClass: "interactive",
    retryBudget: "bounded_retries",
    artifactRetentionClass: "project_bundle",
    dispatchWindow: "session_batch",
    deliveryBundleClass: "review_bundle",
    publicationPolicy: "operator_release",
    executionMode: "human_in_the_loop",
    handoffPolicy: "adapter_review",
    verificationPolicy: "artifact_checks",
    governanceClass: "operator_supervised",
    approvalRequirement: "single_operator",
    complianceEnvelope: "licensed_assets",
    auditTrailClass: "project_event_log",
    incidentRouting: "operator_queue",
    exceptionEscalation: "operator_alert",
    evidencePolicy: "artifact_hashes",
    releaseTicketClass: "operator_ticket",
    attestationPolicy: "operator_attestation",
    operatorOverridePolicy: "ticketed_override",
    provenanceSealClass: "hash_chain",
    deliveryAssuranceClass: "review_ready",
    deliveryTargetClass: "creator_review",
    approvalChainClass: "operator_review",
    dispatchDeadlineClass: "session_close",
    supports: {
      externalAdapterBridge: true,
      stemRendering: true,
      mixBusProcessing: true,
      vocalSynthesis: true
    },
    matchTags: ["adapter", "external"],
    notes: ["Attach authorized external renderer details here."]
  },
  {
    kind: "voicebank",
    id: "licensed-voicebank",
    displayName: "Licensed Voicebank",
    vendor: "Licensed Voice Vendor",
    source: "licensed_vendor",
    licenseScope: "commercial",
    licenseLabel: "Singer / voicebank commercial rights required",
    requiredAssets: ["voicebank-model", "phoneme-dictionary", "authorized-singer-profile"],
    stemRoles: ["lead_vocal", "double_vocal", "harmonies"],
    preferredMixChain: "mastering-bus",
    defaultVocalRoute: "licensed_voicebank",
    defaultMixRoute: "licensed_library",
    defaultInstrumentRoute: "licensed_library",
    assetPackageId: "licensed-voicebank-package",
    stemPackageTemplate: "voicebank-stack-v1",
    adapterEndpointClass: "licensed-voicebank-host",
    renderHostFamily: "voicebank_host",
    cachePolicy: "asset_package_scoped",
    provenancePolicy: "full_lineage",
    retentionPolicy: "audit_retained",
    auditScope: "resource_and_render_chain",
    reproducibilityTier: "fully_pinned",
    executionSla: "batch_priority",
    fallbackPolicy: "fail_closed",
    packagingPolicy: "full_delivery_bundle",
    queueClass: "priority_batch",
    retryBudget: "operator_managed",
    artifactRetentionClass: "audit_archive",
    dispatchWindow: "overnight_batch",
    deliveryBundleClass: "archive_bundle",
    publicationPolicy: "gated_release",
    executionMode: "iterative_refine",
    handoffPolicy: "ops_signoff",
    verificationPolicy: "full_delivery_verification",
    governanceClass: "audited_release",
    approvalRequirement: "dual_control",
    complianceEnvelope: "licensed_and_audited",
    auditTrailClass: "signed_audit_trail",
    incidentRouting: "compliance_queue",
    exceptionEscalation: "dual_control_review",
    evidencePolicy: "signed_release_evidence",
    releaseTicketClass: "change_control_ticket",
    attestationPolicy: "dual_control_attestation",
    operatorOverridePolicy: "dual_control_override",
    provenanceSealClass: "signed_manifest",
    deliveryAssuranceClass: "release_certified",
    deliveryTargetClass: "release_distribution",
    approvalChainClass: "operator_and_compliance",
    dispatchDeadlineClass: "release_window",
    supports: {
      vocalSynthesis: true,
      stemRendering: true
    },
    matchTags: ["voicebank", "vocal", "sing"],
    notes: ["Use only with explicit singer / voicebank rights."]
  },
  {
    kind: "mix_chain_preset",
    id: "mastering-bus",
    displayName: "Licensed Mastering Bus",
    vendor: "Licensed DSP Chain",
    source: "licensed_vendor",
    licenseScope: "commercial",
    licenseLabel: "Commercial DSP / preset usage rights required",
    requiredAssets: ["bus-eq", "bus-compressor", "limiter", "reverb-ir"],
    stemRoles: ["mix_bus"],
    defaultVocalRoute: "stub",
    defaultMixRoute: "licensed_library",
    defaultInstrumentRoute: "licensed_library",
    assetPackageId: "mastering-bus-package",
    stemPackageTemplate: "mix-bus-only-v1",
    adapterEndpointClass: "licensed-mix-bus",
    renderHostFamily: "licensed_plugin_host",
    cachePolicy: "asset_package_scoped",
    provenancePolicy: "standard",
    retentionPolicy: "audit_retained",
    auditScope: "resource_only",
    reproducibilityTier: "fully_pinned",
    executionSla: "batch_priority",
    fallbackPolicy: "fallback_to_lower_fidelity",
    packagingPolicy: "mix_plus_stems",
    queueClass: "offline_render",
    retryBudget: "bounded_retries",
    artifactRetentionClass: "audit_archive",
    dispatchWindow: "operator_scheduled",
    deliveryBundleClass: "release_bundle",
    publicationPolicy: "gated_release",
    executionMode: "iterative_refine",
    handoffPolicy: "ops_signoff",
    verificationPolicy: "full_delivery_verification",
    governanceClass: "audited_release",
    approvalRequirement: "dual_control",
    complianceEnvelope: "licensed_and_audited",
    auditTrailClass: "signed_audit_trail",
    incidentRouting: "compliance_queue",
    exceptionEscalation: "dual_control_review",
    evidencePolicy: "signed_release_evidence",
    releaseTicketClass: "change_control_ticket",
    attestationPolicy: "dual_control_attestation",
    operatorOverridePolicy: "dual_control_override",
    provenanceSealClass: "signed_manifest",
    deliveryAssuranceClass: "release_certified",
    deliveryTargetClass: "internal_review",
    approvalChainClass: "operator_and_compliance",
    dispatchDeadlineClass: "overnight_cutoff",
    supports: {
      mixBusProcessing: true
    },
    matchTags: ["mix", "master", "bus"],
    notes: ["Attach lawful DSP chain or preset pack here."]
  }
];

function normalizeTags(project: ProjectSpec): string[] {
  return [
    project.creative?.licensed_style_pack,
    project.creative?.external_audio_adapter,
    project.creative?.instrumentation,
    project.creative?.instrument,
    project.creative?.ensemble_style,
    project.creative?.vocal_style
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

export function findResourceProfileById(id: string): RenderResourceProfile | null {
  const normalized = String(id || "").trim().toLowerCase();
  if (!normalized) return null;
  return RESOURCE_REGISTRY.find((entry) => entry.id.toLowerCase() === normalized) || null;
}

export function matchResourcesByCapability(
  project: ProjectSpec,
  capability: keyof RendererCapability
): RenderResourceProfile[] {
  const tags = normalizeTags(project);
  return RESOURCE_REGISTRY.filter((entry) => {
    if (!entry.supports[capability]) return false;
    if (!tags.length) return capability === "symbolicComposition" && entry.id === "core";
    return entry.matchTags.some((tag) => tags.some((value) => value.includes(tag)));
  });
}

export function resolvePrimaryResource(
  project: ProjectSpec,
  capability: keyof RendererCapability,
  fallbackId = "core"
): RenderResourceProfile | null {
  const matched = matchResourcesByCapability(project, capability);
  if (matched.length) return matched[0] || null;
  return findResourceProfileById(fallbackId);
}

export function toLegalBinding(profile: RenderResourceProfile | null): LegalResourceBinding[] {
  return profile ? [profile] : [];
}

export interface ResourceSelectionResult {
  capability: keyof RendererCapability;
  primary: RenderResourceProfile | null;
  candidates: RenderResourceProfile[];
  rationale: string[];
}

export function resolveResourceSelection(
  project: ProjectSpec,
  capability: keyof RendererCapability,
  fallbackId = "core"
): ResourceSelectionResult {
  const candidates = matchResourcesByCapability(project, capability);
  const primary = candidates[0] || findResourceProfileById(fallbackId) || null;
  const rationale = [
    `Capability requested: ${capability}.`,
    candidates.length
      ? `Matched ${candidates.length} candidate resource profile(s).`
      : `No direct match found; fallback applied${primary ? ` (${primary.id})` : ""}.`
  ];
  if (primary) {
    rationale.push(`Primary resource: ${primary.displayName} (${primary.id}).`);
    if (primary.vendor) rationale.push(`Vendor: ${primary.vendor}.`);
    if (primary.licenseLabel) rationale.push(`License: ${primary.licenseLabel}.`);
    if (primary.requiredAssets?.length) {
      rationale.push(`Required assets: ${primary.requiredAssets.join(", ")}.`);
    }
    if (primary.stemRoles?.length) {
      rationale.push(`Stem roles: ${primary.stemRoles.join(", ")}.`);
    }
    if (primary.preferredMixChain) {
      rationale.push(`Preferred mix chain: ${primary.preferredMixChain}.`);
    }
    if (primary.defaultVocalRoute) {
      rationale.push(`Default vocal route: ${primary.defaultVocalRoute}.`);
    }
    if (primary.defaultMixRoute) {
      rationale.push(`Default mix route: ${primary.defaultMixRoute}.`);
    }
    if (primary.defaultInstrumentRoute) {
      rationale.push(`Default instrument route: ${primary.defaultInstrumentRoute}.`);
    }
    if (primary.assetPackageId) {
      rationale.push(`Asset package: ${primary.assetPackageId}.`);
    }
    if (primary.stemPackageTemplate) {
      rationale.push(`Stem package template: ${primary.stemPackageTemplate}.`);
    }
    if (primary.adapterEndpointClass) {
      rationale.push(`Adapter endpoint class: ${primary.adapterEndpointClass}.`);
    }
    if (primary.renderHostFamily) {
      rationale.push(`Render host family: ${primary.renderHostFamily}.`);
    }
    if (primary.cachePolicy) {
      rationale.push(`Cache policy: ${primary.cachePolicy}.`);
    }
    if (primary.provenancePolicy) {
      rationale.push(`Provenance policy: ${primary.provenancePolicy}.`);
    }
    if (primary.retentionPolicy) {
      rationale.push(`Retention policy: ${primary.retentionPolicy}.`);
    }
    if (primary.auditScope) {
      rationale.push(`Audit scope: ${primary.auditScope}.`);
    }
    if (primary.reproducibilityTier) {
      rationale.push(`Reproducibility tier: ${primary.reproducibilityTier}.`);
    }
    if (primary.executionSla) {
      rationale.push(`Execution SLA: ${primary.executionSla}.`);
    }
    if (primary.fallbackPolicy) {
      rationale.push(`Fallback policy: ${primary.fallbackPolicy}.`);
    }
    if (primary.packagingPolicy) {
      rationale.push(`Packaging policy: ${primary.packagingPolicy}.`);
    }
    if (primary.queueClass) {
      rationale.push(`Queue class: ${primary.queueClass}.`);
    }
    if (primary.retryBudget) {
      rationale.push(`Retry budget: ${primary.retryBudget}.`);
    }
    if (primary.artifactRetentionClass) {
      rationale.push(`Artifact retention class: ${primary.artifactRetentionClass}.`);
    }
    if (primary.dispatchWindow) {
      rationale.push(`Dispatch window: ${primary.dispatchWindow}.`);
    }
    if (primary.deliveryBundleClass) {
      rationale.push(`Delivery bundle class: ${primary.deliveryBundleClass}.`);
    }
    if (primary.publicationPolicy) {
      rationale.push(`Publication policy: ${primary.publicationPolicy}.`);
    }
    if (primary.executionMode) {
      rationale.push(`Execution mode: ${primary.executionMode}.`);
    }
    if (primary.handoffPolicy) {
      rationale.push(`Handoff policy: ${primary.handoffPolicy}.`);
    }
    if (primary.verificationPolicy) {
      rationale.push(`Verification policy: ${primary.verificationPolicy}.`);
    }
    if (primary.governanceClass) {
      rationale.push(`Governance class: ${primary.governanceClass}.`);
    }
    if (primary.approvalRequirement) {
      rationale.push(`Approval requirement: ${primary.approvalRequirement}.`);
    }
    if (primary.complianceEnvelope) {
      rationale.push(`Compliance envelope: ${primary.complianceEnvelope}.`);
    }
    if (primary.auditTrailClass) {
      rationale.push(`Audit trail class: ${primary.auditTrailClass}.`);
    }
    if (primary.incidentRouting) {
      rationale.push(`Incident routing: ${primary.incidentRouting}.`);
    }
    if (primary.exceptionEscalation) {
      rationale.push(`Exception escalation: ${primary.exceptionEscalation}.`);
    }
    if (primary.evidencePolicy) {
      rationale.push(`Evidence policy: ${primary.evidencePolicy}.`);
    }
    if (primary.releaseTicketClass) {
      rationale.push(`Release ticket class: ${primary.releaseTicketClass}.`);
    }
    if (primary.attestationPolicy) {
      rationale.push(`Attestation policy: ${primary.attestationPolicy}.`);
    }
    if (primary.operatorOverridePolicy) {
      rationale.push(`Operator override policy: ${primary.operatorOverridePolicy}.`);
    }
    if (primary.provenanceSealClass) {
      rationale.push(`Provenance seal class: ${primary.provenanceSealClass}.`);
    }
    if (primary.deliveryAssuranceClass) {
      rationale.push(`Delivery assurance class: ${primary.deliveryAssuranceClass}.`);
    }
    if (primary.deliveryTargetClass) {
      rationale.push(`Delivery target class: ${primary.deliveryTargetClass}.`);
    }
    if (primary.approvalChainClass) {
      rationale.push(`Approval chain class: ${primary.approvalChainClass}.`);
    }
    if (primary.dispatchDeadlineClass) {
      rationale.push(`Dispatch deadline class: ${primary.dispatchDeadlineClass}.`);
    }
  }
  return {
    capability,
    primary,
    candidates,
    rationale
  };
}
