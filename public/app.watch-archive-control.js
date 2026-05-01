function buildWatchArchiveRetentionComplianceChecklistBridge(
  retentionPolicyCards,
  certifiedArchiveLedger,
  certifiedExceptionArchive
) {
  const retentionRows = Array.isArray(retentionPolicyCards) ? retentionPolicyCards : [];
  const ledgerRows = Array.isArray(certifiedArchiveLedger) ? certifiedArchiveLedger : [];
  return retentionRows.slice(0, 3).map((item, index) => ({
    item: item.family,
    state: watchArchiveChecklistState(
      item.policy === dashboardCopy("retain in certified archive", "纳入正式归档保留")
    ),
    note:
      ledgerRows[index]?.record ||
      (index === 0
        ? certifiedExceptionArchive?.certificate_anchor
        : item.anchor) ||
      dashboardCopy("Retention compliance note is still forming.", "归档合规备注仍在形成中。")
  }));
}

function buildWatchArchiveClosureEscalationLadderBridge(
  closureReadinessScore,
  approvalBottleneckMap,
  governanceClosureDashboard
) {
  const bottleneckRows = Array.isArray(approvalBottleneckMap) ? approvalBottleneckMap : [];
  const score = Number(closureReadinessScore?.score || 0);
  const blocked = bottleneckRows.filter(
    (item) => item.bottleneck === dashboardCopy("pending gate", "卡在 gate")
  ).length;
  return [
    {
      level: "L1",
      trigger: dashboardCopy("Normal follow-through", "常规跟进"),
      state: watchArchiveChecklistState(score >= 75 && blocked === 0),
      note: governanceClosureDashboard?.summary || ""
    },
    {
      level: "L2",
      trigger: dashboardCopy("Approval bottleneck review", "审批瓶颈复核"),
      state: watchArchiveChecklistState(score >= 45 && blocked > 0),
      note:
        bottleneckRows[0]?.note ||
        dashboardCopy("No approval bottleneck note yet.", "当前还没有审批瓶颈备注。")
    },
    {
      level: "L3",
      trigger: dashboardCopy("Executive escalation", "高层升级"),
      state: watchArchiveChecklistState(score < 45),
      note: dashboardCopy(
        `Closure readiness is ${score}% and may need executive intervention.`,
        `当前收口 readiness 为 ${score}%，可能需要高层干预。`
      )
    }
  ];
}

function buildWatchArchiveBottleneckRecoveryPlaybookBridge(
  approvalBottleneckMap,
  warRoomStandDownChecklist,
  closureReadinessScore
) {
  const bottleneckRows = Array.isArray(approvalBottleneckMap) ? approvalBottleneckMap : [];
  const checklistRows = Array.isArray(warRoomStandDownChecklist) ? warRoomStandDownChecklist : [];
  return bottleneckRows.slice(0, 3).map((item, index) => ({
    lane: item.approver,
    bottleneck: item.bottleneck,
    recovery_action:
      item.bottleneck === dashboardCopy("pending gate", "卡在 gate")
        ? dashboardCopy("clear gate evidence and re-route approver", "补齐 gate 证据并重新路由审批人")
        : dashboardCopy("keep lane warm and continue follow-through", "保持通道活跃并继续跟进"),
    note:
      checklistRows[index]?.note ||
      closureReadinessScore?.summary ||
      dashboardCopy("Recovery playbook note is still forming.", "恢复打法备注仍在形成中。")
  }));
}

function buildWatchArchiveComplianceSignoffCardBridge(
  retentionComplianceChecklist,
  closureReadinessScore,
  executiveSignoffReadiness
) {
  const checklistRows = Array.isArray(retentionComplianceChecklist) ? retentionComplianceChecklist : [];
  const compliant = checklistRows.filter((item) => item.state === watchArchiveChecklistState(true)).length;
  const total = checklistRows.length;
  const signable =
    compliant === total &&
    total > 0 &&
    executiveSignoffReadiness?.status === dashboardCopy("ready to sign", "可签字");
  return {
    status: signable
      ? dashboardCopy("compliance sign-off ready", "归档合规可签字")
      : dashboardCopy("compliance sign-off pending", "归档合规待签字"),
    summary: dashboardCopy(
      `${compliant}/${total} retention compliance checks are ready, with closure readiness at ${closureReadinessScore?.score || 0}%.`,
      `当前已有 ${compliant}/${total} 条归档合规检查就绪，收口 readiness 为 ${closureReadinessScore?.score || 0}%。`
    ),
    note:
      checklistRows[0]?.note ||
      executiveSignoffReadiness?.reason ||
      dashboardCopy("Compliance sign-off note is still forming.", "归档合规签字备注仍在形成中。")
  };
}

function buildWatchArchiveClosureControlTowerBridge(
  closureEscalationLadder,
  closureReadinessScore,
  governanceClosureDashboard
) {
  const ladderRows = Array.isArray(closureEscalationLadder) ? closureEscalationLadder : [];
  const activeLevel =
    ladderRows.find((item) => item.state === watchArchiveChecklistState(true))?.level || "L0";
  return {
    headline:
      governanceClosureDashboard?.headline ||
      dashboardCopy("Closure control tower is still forming.", "收口总控台仍在形成中。"),
    active_level: activeLevel,
    readiness:
      closureReadinessScore?.status ||
      dashboardCopy("low readiness", "低 readiness"),
    summary:
      closureReadinessScore?.summary ||
      dashboardCopy("No closure readiness summary yet.", "当前还没有收口 readiness 摘要。")
  };
}

function buildWatchArchiveRecoveryAssignmentBoardBridge(
  bottleneckRecoveryPlaybook,
  approvalBottleneckMap,
  standDownApprovalLane
) {
  const playbookRows = Array.isArray(bottleneckRecoveryPlaybook) ? bottleneckRecoveryPlaybook : [];
  const bottleneckRows = Array.isArray(approvalBottleneckMap) ? approvalBottleneckMap : [];
  const approvalRows = Array.isArray(standDownApprovalLane) ? standDownApprovalLane : [];
  return playbookRows.slice(0, 3).map((item, index) => ({
    owner:
      bottleneckRows[index]?.approver ||
      approvalRows[index]?.approver ||
      dashboardCopy("unassigned", "待分派"),
    lane: item.lane,
    action: item.recovery_action,
    status:
      approvalRows[index]?.status ||
      dashboardCopy("pending approval", "待审批")
  }));
}

function buildWatchArchiveSignoffEvidenceWalletBridge(
  complianceSignoffCard,
  retentionComplianceChecklist,
  certifiedArchiveLedger
) {
  const checklistRows = Array.isArray(retentionComplianceChecklist) ? retentionComplianceChecklist : [];
  const ledgerRows = Array.isArray(certifiedArchiveLedger) ? certifiedArchiveLedger : [];
  return {
    signoff_state:
      complianceSignoffCard?.status ||
      dashboardCopy("compliance sign-off pending", "归档合规待签字"),
    evidence_count: checklistRows.length + ledgerRows.length,
    anchor:
      checklistRows[0]?.note ||
      ledgerRows[0]?.record ||
      dashboardCopy("No sign-off evidence anchor yet.", "当前还没有签字证据锚点。"),
    summary: dashboardCopy(
      `${checklistRows.length} compliance checks and ${ledgerRows.length} certified archive records are available for sign-off review.`,
      `当前可用于签字复核的材料包括 ${checklistRows.length} 条合规检查和 ${ledgerRows.length} 条正式归档记录。`
    )
  };
}

function buildWatchArchiveClosureOperationsCockpitBridge(
  closureControlTower,
  closureEscalationLadder,
  complianceSignoffCard
) {
  const ladderRows = Array.isArray(closureEscalationLadder) ? closureEscalationLadder : [];
  const armedCount = ladderRows.filter((item) => item.state === watchArchiveChecklistState(true)).length;
  return {
    headline:
      closureControlTower?.headline ||
      dashboardCopy("Closure operations cockpit is still forming.", "收口操作驾驶舱仍在形成中。"),
    lane_state:
      closureControlTower?.active_level ||
      "L0",
    signoff_state:
      complianceSignoffCard?.status ||
      dashboardCopy("compliance sign-off pending", "归档合规待签字"),
    summary: dashboardCopy(
      `${armedCount} closure ladder lanes are currently active, with ${closureControlTower?.readiness || dashboardCopy("low readiness", "低 readiness")} across the control tower.`,
      `当前已有 ${armedCount} 条收口阶梯通道处于活跃状态，总控台整体为 ${closureControlTower?.readiness || dashboardCopy("低 readiness", "低 readiness")}。`
    )
  };
}

window.buildWatchArchiveRetentionComplianceChecklistBridge = buildWatchArchiveRetentionComplianceChecklistBridge;
window.buildWatchArchiveClosureEscalationLadderBridge = buildWatchArchiveClosureEscalationLadderBridge;
window.buildWatchArchiveBottleneckRecoveryPlaybookBridge = buildWatchArchiveBottleneckRecoveryPlaybookBridge;
window.buildWatchArchiveComplianceSignoffCardBridge = buildWatchArchiveComplianceSignoffCardBridge;
window.buildWatchArchiveClosureControlTowerBridge = buildWatchArchiveClosureControlTowerBridge;
window.buildWatchArchiveRecoveryAssignmentBoardBridge = buildWatchArchiveRecoveryAssignmentBoardBridge;
window.buildWatchArchiveSignoffEvidenceWalletBridge = buildWatchArchiveSignoffEvidenceWalletBridge;
window.buildWatchArchiveClosureOperationsCockpitBridge = buildWatchArchiveClosureOperationsCockpitBridge;
