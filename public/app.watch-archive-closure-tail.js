function buildWatchArchiveExceptionClosureCertificateModule(
  exceptionDispositionLog,
  closureAuditSummary,
  auditConfidenceBanner
) {
  return globalThis.buildWatchArchiveExceptionClosureCertificateBridge?.(
    exceptionDispositionLog,
    closureAuditSummary,
    auditConfidenceBanner
  ) || null;
}

function buildWatchArchiveBoardActionFollowThroughModule(
  boardDecisionLedger,
  leadershipFollowThroughBoard,
  executiveSignoffReadiness
) {
  return globalThis.buildWatchArchiveBoardActionFollowThroughBridge?.(
    boardDecisionLedger,
    leadershipFollowThroughBoard,
    executiveSignoffReadiness
  ) || [];
}

function buildWatchArchiveWarRoomExitCriteriaModule(
  warRoomResolutionTimeline,
  escalationRecoveryForecast,
  exceptionClosureCertificate
) {
  return globalThis.buildWatchArchiveWarRoomExitCriteriaBridge?.(
    warRoomResolutionTimeline,
    escalationRecoveryForecast,
    exceptionClosureCertificate
  ) || null;
}

function buildWatchArchiveCertifiedExceptionArchiveModule(
  exceptionClosureCertificate,
  exceptionDispositionLog,
  auditArchiveIndex
) {
  return globalThis.buildWatchArchiveCertifiedExceptionArchiveBridge?.(
    exceptionClosureCertificate,
    exceptionDispositionLog,
    auditArchiveIndex
  ) || null;
}

function buildWatchArchiveBoardClosureMemoModule(
  boardActionFollowThrough,
  boardDecisionLedger,
  executiveSignoffReadiness
) {
  return globalThis.buildWatchArchiveBoardClosureMemoBridge?.(
    boardActionFollowThrough,
    boardDecisionLedger,
    executiveSignoffReadiness
  ) || null;
}

function buildWatchArchiveWarRoomStandDownChecklistModule(
  warRoomExitCriteria,
  warRoomResolutionTimeline,
  escalationBurndown
) {
  return globalThis.buildWatchArchiveWarRoomStandDownChecklistBridge?.(
    warRoomExitCriteria,
    warRoomResolutionTimeline,
    escalationBurndown
  ) || [];
}

function buildWatchArchiveCertifiedArchiveLedgerModule(
  certifiedExceptionArchive,
  exceptionClosureCertificate,
  auditArchiveIndex
) {
  return globalThis.buildWatchArchiveCertifiedArchiveLedgerBridge?.(
    certifiedExceptionArchive,
    exceptionClosureCertificate,
    auditArchiveIndex
  ) || [];
}

function buildWatchArchiveGovernanceClosureDashboardModule(
  boardClosureMemo,
  warRoomExitCriteria,
  certifiedExceptionArchive
) {
  return globalThis.buildWatchArchiveGovernanceClosureDashboardBridge?.(
    boardClosureMemo,
    warRoomExitCriteria,
    certifiedExceptionArchive
  ) || null;
}

function buildWatchArchiveStandDownApprovalLaneModule(
  warRoomStandDownChecklist,
  executiveSignoffReadiness,
  boardClosureMemo
) {
  const checklistRows = Array.isArray(warRoomStandDownChecklist) ? warRoomStandDownChecklist : [];
  const allReady = checklistRows.every((item) => item.state === watchArchiveChecklistState(true));
  return checklistRows.slice(0, 3).map((item, index) => ({
    approver:
      index === 0
        ? dashboardCopy("war-room lead", "战情负责人")
        : index === 1
          ? dashboardCopy("executive sponsor", "高层发起人")
          : dashboardCopy("closure reviewer", "收口复核人"),
    gate: item.item,
    status:
      allReady && executiveSignoffReadiness?.status === dashboardCopy("ready to sign", "可签字")
        ? dashboardCopy("approval-ready", "可审批")
        : dashboardCopy("pending approval", "待审批"),
    note:
      index === 0
        ? boardClosureMemo?.next_anchor || item.note
        : item.note
  }));
}

function buildWatchArchiveRetentionPolicyCardsModule(
  certifiedArchiveLedger,
  certifiedExceptionArchive,
  auditArchiveIndex
) {
  const ledgerRows = Array.isArray(certifiedArchiveLedger) ? certifiedArchiveLedger : [];
  const archiveRows = Array.isArray(auditArchiveIndex) ? auditArchiveIndex : [];
  const retentionFamilies = [
    dashboardCopy("board closure records", "董事会收口记录"),
    dashboardCopy("war-room resolution traces", "战情解决轨迹"),
    dashboardCopy("certified exception certificates", "正式例外关闭证明")
  ];
  return retentionFamilies.map((family, index) => ({
    family,
    policy:
      certifiedExceptionArchive?.archive_status === dashboardCopy("ready for certified archive", "可进入正式归档")
        ? dashboardCopy("retain in certified archive", "纳入正式归档保留")
        : dashboardCopy("retain in pending archive shelf", "暂存于待归档架"),
    anchor:
      ledgerRows[index]?.record ||
      archiveRows[index]?.title ||
      dashboardCopy("Retention anchor is still forming.", "保留策略锚点仍在形成中。")
  }));
}

function buildWatchArchiveClosureReadinessScoreModule(
  governanceClosureDashboard,
  standDownApprovalLane,
  retentionPolicyCards
) {
  const approvalRows = Array.isArray(standDownApprovalLane) ? standDownApprovalLane : [];
  const retentionRows = Array.isArray(retentionPolicyCards) ? retentionPolicyCards : [];
  const readyApprovals = approvalRows.filter(
    (item) => item.status === dashboardCopy("approval-ready", "可审批")
  ).length;
  const retained = retentionRows.filter(
    (item) => item.policy === dashboardCopy("retain in certified archive", "纳入正式归档保留")
  ).length;
  const totalSignals = Math.max(1, approvalRows.length + retentionRows.length + 1);
  const score = Math.round(
    ((readyApprovals +
      retained +
      (governanceClosureDashboard?.closure_state === dashboardCopy("ready for certified archive", "可进入正式归档") ? 1 : 0)) /
      totalSignals) *
      100
  );
  return {
    score,
    status:
      score >= 75
        ? dashboardCopy("high readiness", "高 readiness")
        : score >= 45
          ? dashboardCopy("medium readiness", "中等 readiness")
          : dashboardCopy("low readiness", "低 readiness"),
    summary: dashboardCopy(
      `Closure readiness combines approval readiness, retention posture, and certified archive state into a ${score}% score.`,
      `收口 readiness 综合审批就绪度、保留策略姿态和正式归档状态，当前得分为 ${score}%。`
    )
  };
}

function buildWatchArchiveApprovalBottleneckMapModule(
  standDownApprovalLane,
  warRoomStandDownChecklist,
  boardActionFollowThrough
) {
  const approvalRows = Array.isArray(standDownApprovalLane) ? standDownApprovalLane : [];
  const checklistRows = Array.isArray(warRoomStandDownChecklist) ? warRoomStandDownChecklist : [];
  const followRows = Array.isArray(boardActionFollowThrough) ? boardActionFollowThrough : [];
  return approvalRows.slice(0, 3).map((item, index) => ({
    approver: item.approver,
    bottleneck:
      item.status === dashboardCopy("approval-ready", "可审批")
        ? dashboardCopy("clear lane", "通道通畅")
        : dashboardCopy("pending gate", "卡在 gate"),
    gate: item.gate,
    note:
      checklistRows[index]?.note ||
      followRows[index]?.note ||
      dashboardCopy("Approval bottleneck note is still forming.", "审批瓶颈备注仍在形成中。")
  }));
}

Object.assign(globalThis, {
  buildWatchArchiveExceptionClosureCertificateModule,
  buildWatchArchiveBoardActionFollowThroughModule,
  buildWatchArchiveWarRoomExitCriteriaModule,
  buildWatchArchiveCertifiedExceptionArchiveModule,
  buildWatchArchiveBoardClosureMemoModule,
  buildWatchArchiveWarRoomStandDownChecklistModule,
  buildWatchArchiveCertifiedArchiveLedgerModule,
  buildWatchArchiveGovernanceClosureDashboardModule,
  buildWatchArchiveStandDownApprovalLaneModule,
  buildWatchArchiveRetentionPolicyCardsModule,
  buildWatchArchiveClosureReadinessScoreModule,
  buildWatchArchiveApprovalBottleneckMapModule
});
