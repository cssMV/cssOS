function buildWatchArchiveGovernanceReleaseGateModule(
  governanceSprintPlanner,
  upliftRoiTracker,
  memoryCompletionBurndown
) {
  return globalThis.buildWatchArchiveGovernanceReleaseGateBridge?.(
    governanceSprintPlanner,
    upliftRoiTracker,
    memoryCompletionBurndown
  ) || null;
}

function buildWatchArchiveUpliftAcceptanceCriteriaModule(
  upliftRoiTracker,
  preventionCoverageMap
) {
  const upliftRows = Array.isArray(upliftRoiTracker) ? upliftRoiTracker : [];
  const coverageRows = Array.isArray(preventionCoverageMap) ? preventionCoverageMap : [];
  return upliftRows.map((item, index) => ({
    area: item.area,
    criteria: dashboardCopy(
      `Accept when ${coverageRows[index]?.coverage || dashboardCopy("coverage", "覆盖")} is no longer partial and ROI tracking remains positive.`,
      `当${coverageRows[index]?.coverage || dashboardCopy("覆盖", "覆盖")}不再是部分覆盖且 ROI 追踪仍保持正向时即可验收。`
    )
  }));
}

function buildWatchArchiveMemoryDoneDefinitionModule(
  memoryCompletionBurndown,
  institutionalMemoryShelf,
  memoryCaptureBacklog
) {
  const completed = Number(memoryCompletionBurndown?.completed || 0);
  const remaining = Number(memoryCompletionBurndown?.remaining || 0);
  const shelfRows = Array.isArray(institutionalMemoryShelf) ? institutionalMemoryShelf : [];
  const backlogRows = Array.isArray(memoryCaptureBacklog) ? memoryCaptureBacklog : [];
  return {
    schema: "cssmv.watch_archive_memory_done_definition.v1",
    generated_at: new Date().toISOString(),
    definition: dashboardCopy(
      "Memory is done when reusable entries are on the shelf and the backlog is near zero.",
      "当可复用条目已经上架且记忆待办接近清零时，记忆补齐才算完成。"
    ),
    status: dashboardCopy(
      `completed=${completed}, remaining=${remaining}, shelf=${shelfRows.length}, backlog=${backlogRows.length}`,
      `已完成=${completed}，剩余=${remaining}，记忆架=${shelfRows.length}，待办=${backlogRows.length}`
    )
  };
}

function buildWatchArchiveGovernanceLaunchChecklistModule(
  governanceReleaseGate,
  upliftAcceptanceCriteria,
  memoryDoneDefinition
) {
  const acceptanceRows = Array.isArray(upliftAcceptanceCriteria) ? upliftAcceptanceCriteria : [];
  return [
    {
      item: dashboardCopy("Release gate state", "发布门状态"),
      summary:
        governanceReleaseGate?.summary ||
        dashboardCopy("No release gate summary yet.", "当前还没有发布门摘要。")
    },
    {
      item: dashboardCopy("Acceptance criteria review", "验收标准复核"),
      summary:
        acceptanceRows[0]?.criteria ||
        dashboardCopy("No acceptance criteria review item yet.", "当前还没有验收标准复核项。")
    },
    {
      item: dashboardCopy("Memory completion review", "记忆完成复核"),
      summary:
        memoryDoneDefinition?.status ||
        dashboardCopy("No memory completion review item yet.", "当前还没有记忆完成复核项。")
    }
  ];
}

function buildWatchArchiveAcceptanceEvidencePackModule(
  upliftAcceptanceCriteria,
  governanceHealthScore,
  preventionCoverageMap
) {
  const acceptanceRows = Array.isArray(upliftAcceptanceCriteria) ? upliftAcceptanceCriteria : [];
  const coverageRows = Array.isArray(preventionCoverageMap) ? preventionCoverageMap : [];
  return {
    schema: "cssmv.watch_archive_acceptance_evidence_pack.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Acceptance evidence pack", "验收证据包"),
    health_anchor: governanceHealthScore?.summary || "",
    acceptance_anchor: acceptanceRows[0]?.criteria || "",
    coverage_anchor: coverageRows[0]?.summary || ""
  };
}

function buildWatchArchiveCompletionCertificateDraftModule(
  governanceReleaseGate,
  memoryDoneDefinition,
  governanceHealthScore
) {
  return {
    schema: "cssmv.watch_archive_completion_certificate_draft.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Completion certificate draft", "完成证明草稿"),
    gate_state: String(governanceReleaseGate?.state || "hold").toUpperCase(),
    completion_basis:
      memoryDoneDefinition?.definition ||
      dashboardCopy("No completion basis yet.", "当前还没有完成依据。"),
    health_basis:
      governanceHealthScore?.summary ||
      dashboardCopy("No health basis yet.", "当前还没有健康度依据。")
  };
}

function buildWatchArchiveGovernanceSignoffLaneModule(
  governanceLaunchChecklist,
  acceptanceEvidencePack,
  completionCertificateDraft
) {
  const checklistRows = Array.isArray(governanceLaunchChecklist) ? governanceLaunchChecklist : [];
  return [
    {
      role: dashboardCopy("Governance owner", "治理负责人"),
      summary:
        checklistRows[0]?.summary ||
        dashboardCopy("No governance-owner sign-off item yet.", "当前还没有治理负责人签字项。")
    },
    {
      role: dashboardCopy("Acceptance reviewer", "验收复核人"),
      summary:
        acceptanceEvidencePack?.acceptance_anchor ||
        dashboardCopy("No acceptance-review sign-off item yet.", "当前还没有验收复核签字项。")
    },
    {
      role: dashboardCopy("Completion approver", "完成批准人"),
      summary:
        completionCertificateDraft?.completion_basis ||
        dashboardCopy("No completion-approval sign-off item yet.", "当前还没有完成批准签字项。")
    }
  ];
}

function buildWatchArchiveEvidenceTraceMatrixModule(
  acceptanceEvidencePack,
  governanceLaunchChecklist,
  upliftAcceptanceCriteria
) {
  const checklistRows = Array.isArray(governanceLaunchChecklist) ? governanceLaunchChecklist : [];
  const acceptanceRows = Array.isArray(upliftAcceptanceCriteria) ? upliftAcceptanceCriteria : [];
  return [
    {
      source: dashboardCopy("Health anchor", "健康锚点"),
      target:
        acceptanceEvidencePack?.health_anchor ||
        dashboardCopy("No health anchor yet.", "当前还没有健康锚点。")
    },
    {
      source: dashboardCopy("Checklist anchor", "清单锚点"),
      target:
        checklistRows[0]?.summary ||
        dashboardCopy("No checklist anchor yet.", "当前还没有清单锚点。")
    },
    {
      source: dashboardCopy("Acceptance anchor", "验收锚点"),
      target:
        acceptanceRows[0]?.criteria ||
        dashboardCopy("No acceptance anchor yet.", "当前还没有验收锚点。")
    }
  ];
}

function passthrough(name, fallback) {
  return (...args) => globalThis[name]?.(...args) ?? fallback;
}

const buildWatchArchiveCompletionAuditStampModule = passthrough("buildWatchArchiveCompletionAuditStampBridge", null);
const buildWatchArchiveReleaseDossierModule = passthrough("buildWatchArchiveReleaseDossierBridge", null);
const buildWatchArchiveApproverChecklistMatrixModule = passthrough("buildWatchArchiveApproverChecklistMatrixBridge", []);
const buildWatchArchiveAuditArchiveIndexModule = passthrough("buildWatchArchiveAuditArchiveIndexBridge", []);
const buildWatchArchiveGovernanceDossierNavigatorModule = passthrough("buildWatchArchiveGovernanceDossierNavigatorBridge", []);
const buildWatchArchiveApprovalDependencyGraphModule = passthrough("buildWatchArchiveApprovalDependencyGraphBridge", []);
const buildWatchArchiveAuditRetrievalShelfModule = passthrough("buildWatchArchiveAuditRetrievalShelfBridge", []);
const buildWatchArchiveGovernanceSearchIndexModule = passthrough("buildWatchArchiveGovernanceSearchIndexBridge", null);
const buildWatchArchiveDependencyRiskScannerModule = passthrough("buildWatchArchiveDependencyRiskScannerBridge", []);
const buildWatchArchiveAuditQueryPresetsModule = passthrough("buildWatchArchiveAuditQueryPresetsBridge", []);
const buildWatchArchiveGovernanceCommandPaletteModule = passthrough("buildWatchArchiveGovernanceCommandPaletteBridge", []);
const buildWatchArchiveRiskTriageQueueModule = passthrough("buildWatchArchiveRiskTriageQueueBridge", []);
const buildWatchArchiveAuditQuickOpenSetModule = passthrough("buildWatchArchiveAuditQuickOpenSetBridge", []);
const buildWatchArchiveSavedOperatorMacrosModule = passthrough("buildWatchArchiveSavedOperatorMacrosBridge", []);
const buildWatchArchiveTriageEscalationShortcutsModule = passthrough("buildWatchArchiveTriageEscalationShortcutsBridge", []);
const buildWatchArchiveAuditWorkspaceLauncherModule = passthrough("buildWatchArchiveAuditWorkspaceLauncherBridge", []);

Object.assign(globalThis, {
  buildWatchArchiveGovernanceReleaseGateModule,
  buildWatchArchiveUpliftAcceptanceCriteriaModule,
  buildWatchArchiveMemoryDoneDefinitionModule,
  buildWatchArchiveGovernanceLaunchChecklistModule,
  buildWatchArchiveAcceptanceEvidencePackModule,
  buildWatchArchiveCompletionCertificateDraftModule,
  buildWatchArchiveGovernanceSignoffLaneModule,
  buildWatchArchiveEvidenceTraceMatrixModule,
  buildWatchArchiveCompletionAuditStampModule,
  buildWatchArchiveReleaseDossierModule,
  buildWatchArchiveApproverChecklistMatrixModule,
  buildWatchArchiveAuditArchiveIndexModule,
  buildWatchArchiveGovernanceDossierNavigatorModule,
  buildWatchArchiveApprovalDependencyGraphModule,
  buildWatchArchiveAuditRetrievalShelfModule,
  buildWatchArchiveGovernanceSearchIndexModule,
  buildWatchArchiveDependencyRiskScannerModule,
  buildWatchArchiveAuditQueryPresetsModule,
  buildWatchArchiveGovernanceCommandPaletteModule,
  buildWatchArchiveRiskTriageQueueModule,
  buildWatchArchiveAuditQuickOpenSetModule,
  buildWatchArchiveSavedOperatorMacrosModule,
  buildWatchArchiveTriageEscalationShortcutsModule,
  buildWatchArchiveAuditWorkspaceLauncherModule
});
