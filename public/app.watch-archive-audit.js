function buildWatchArchiveCompletionAuditStampBridge(
  completionCertificateDraft,
  governanceHealthScore,
  governanceReleaseGate
) {
  return {
    schema: "cssmv.watch_archive_completion_audit_stamp.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Completion audit stamp", "完成审计盖章"),
    stamp_state: dashboardCopy(
      String(governanceReleaseGate?.state || "hold").toUpperCase(),
      String(governanceReleaseGate?.state || "hold").toUpperCase()
    ),
    certificate_basis:
      completionCertificateDraft?.completion_basis ||
      dashboardCopy("No completion basis yet.", "当前还没有完成依据。"),
    audit_basis:
      governanceHealthScore?.summary || dashboardCopy("No audit basis yet.", "当前还没有审计依据。")
  };
}

function buildWatchArchiveReleaseDossierBridge(
  governanceSignoffLane,
  evidenceTraceMatrix,
  completionAuditStamp
) {
  const signoffRows = Array.isArray(governanceSignoffLane) ? governanceSignoffLane : [];
  const traceRows = Array.isArray(evidenceTraceMatrix) ? evidenceTraceMatrix : [];
  return {
    schema: "cssmv.watch_archive_release_dossier.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Release dossier", "放行卷宗"),
    signoff_anchor:
      signoffRows[0]?.summary || dashboardCopy("No sign-off anchor yet.", "当前还没有签字锚点。"),
    trace_anchor:
      traceRows[0]?.target || dashboardCopy("No trace anchor yet.", "当前还没有证据锚点。"),
    audit_anchor:
      completionAuditStamp?.audit_basis || dashboardCopy("No audit anchor yet.", "当前还没有审计锚点。")
  };
}

function buildWatchArchiveApproverChecklistMatrixBridge(
  governanceSignoffLane,
  governanceLaunchChecklist,
  upliftAcceptanceCriteria
) {
  const signoffRows = Array.isArray(governanceSignoffLane) ? governanceSignoffLane : [];
  const checklistRows = Array.isArray(governanceLaunchChecklist) ? governanceLaunchChecklist : [];
  const acceptanceRows = Array.isArray(upliftAcceptanceCriteria) ? upliftAcceptanceCriteria : [];
  return signoffRows.map((item, index) => ({
    approver: item.role,
    checklist_item:
      checklistRows[index % Math.max(1, checklistRows.length)]?.item ||
      dashboardCopy("Checklist item", "清单项"),
    evidence_rule:
      acceptanceRows[index % Math.max(1, acceptanceRows.length)]?.criteria ||
      dashboardCopy("No evidence rule yet.", "当前还没有证据规则。")
  }));
}

function buildWatchArchiveAuditArchiveIndexBridge(
  completionAuditStamp,
  acceptanceEvidencePack,
  completionCertificateDraft
) {
  return [
    {
      title: dashboardCopy("Audit stamp", "审计盖章"),
      summary:
        completionAuditStamp?.audit_basis || dashboardCopy("No audit stamp archive yet.", "当前还没有审计盖章档案。")
    },
    {
      title: dashboardCopy("Evidence pack", "证据包"),
      summary:
        acceptanceEvidencePack?.headline || dashboardCopy("No evidence pack archive yet.", "当前还没有证据包档案。")
    },
    {
      title: dashboardCopy("Completion certificate", "完成证明"),
      summary:
        completionCertificateDraft?.headline ||
        dashboardCopy("No completion certificate archive yet.", "当前还没有完成证明档案。")
    }
  ];
}

function buildWatchArchiveGovernanceDossierNavigatorBridge(
  releaseDossier,
  approverChecklistMatrix,
  auditArchiveIndex
) {
  const approverRows = Array.isArray(approverChecklistMatrix) ? approverChecklistMatrix : [];
  const archiveRows = Array.isArray(auditArchiveIndex) ? auditArchiveIndex : [];
  return [
    {
      node: dashboardCopy("Release dossier root", "放行卷宗根节点"),
      summary:
        releaseDossier?.headline || dashboardCopy("No release dossier root yet.", "当前还没有放行卷宗根节点。")
    },
    {
      node: dashboardCopy("Approver review path", "审批人复核路径"),
      summary:
        approverRows[0]?.checklist_item || dashboardCopy("No approver review path yet.", "当前还没有审批人复核路径。")
    },
    {
      node: dashboardCopy("Audit archive path", "审计档案路径"),
      summary:
        archiveRows[0]?.summary || dashboardCopy("No audit archive path yet.", "当前还没有审计档案路径。")
    }
  ];
}

function buildWatchArchiveApprovalDependencyGraphBridge(
  approverChecklistMatrix,
  governanceSignoffLane,
  evidenceTraceMatrix
) {
  const approverRows = Array.isArray(approverChecklistMatrix) ? approverChecklistMatrix : [];
  const signoffRows = Array.isArray(governanceSignoffLane) ? governanceSignoffLane : [];
  const traceRows = Array.isArray(evidenceTraceMatrix) ? evidenceTraceMatrix : [];
  return approverRows.map((item, index) => ({
    approver: item.approver,
    depends_on:
      signoffRows[index % Math.max(1, signoffRows.length)]?.role ||
      dashboardCopy("Sign-off lane", "签字线"),
    evidence_edge:
      traceRows[index % Math.max(1, traceRows.length)]?.source ||
      dashboardCopy("Evidence trace", "证据追踪")
  }));
}

function buildWatchArchiveAuditRetrievalShelfBridge(
  auditArchiveIndex,
  releaseDossier,
  completionAuditStamp
) {
  const archiveRows = Array.isArray(auditArchiveIndex) ? auditArchiveIndex : [];
  return [
    {
      slot: dashboardCopy("Dossier retrieval", "卷宗检索"),
      summary:
        releaseDossier?.trace_anchor || dashboardCopy("No dossier retrieval anchor yet.", "当前还没有卷宗检索锚点。")
    },
    ...archiveRows.map((item) => ({
      slot: item.title,
      summary: item.summary
    })),
    {
      slot: dashboardCopy("Audit stamp retrieval", "审计盖章检索"),
      summary:
        completionAuditStamp?.audit_basis || dashboardCopy("No audit stamp retrieval anchor yet.", "当前还没有审计盖章检索锚点。")
    }
  ];
}

window.buildWatchArchiveCompletionAuditStampBridge = buildWatchArchiveCompletionAuditStampBridge;
window.buildWatchArchiveReleaseDossierBridge = buildWatchArchiveReleaseDossierBridge;
window.buildWatchArchiveApproverChecklistMatrixBridge = buildWatchArchiveApproverChecklistMatrixBridge;
window.buildWatchArchiveAuditArchiveIndexBridge = buildWatchArchiveAuditArchiveIndexBridge;
window.buildWatchArchiveGovernanceDossierNavigatorBridge = buildWatchArchiveGovernanceDossierNavigatorBridge;
window.buildWatchArchiveApprovalDependencyGraphBridge = buildWatchArchiveApprovalDependencyGraphBridge;
window.buildWatchArchiveAuditRetrievalShelfBridge = buildWatchArchiveAuditRetrievalShelfBridge;
