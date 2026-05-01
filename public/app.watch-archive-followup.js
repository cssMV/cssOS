function buildWatchArchiveAssignmentSlaRailsBridge(
  recoveryAssignmentBoard,
  standDownApprovalLane,
  mitigationSlaClock
) {
  const assignmentRows = Array.isArray(recoveryAssignmentBoard) ? recoveryAssignmentBoard : [];
  const approvalRows = Array.isArray(standDownApprovalLane) ? standDownApprovalLane : [];
  const slaRows = Array.isArray(mitigationSlaClock) ? mitigationSlaClock : [];
  return assignmentRows.slice(0, 3).map((item, index) => ({
    owner: item.owner,
    rail:
      item.status === dashboardCopy("approval-ready", "可审批")
        ? dashboardCopy("within SLA rail", "位于 SLA 轨道内")
        : dashboardCopy("watch SLA rail", "进入 SLA 观察轨"),
    action: item.action,
    note:
      approvalRows[index]?.note ||
      slaRows[index]?.note ||
      dashboardCopy("Assignment SLA rail note is still forming.", "分派 SLA 轨道备注仍在形成中。")
  }));
}

function buildWatchArchiveAssignmentBreachAlertsBridge(
  assignmentSlaRails,
  approvalBottleneckMap,
  closureEscalationLadder
) {
  const railRows = Array.isArray(assignmentSlaRails) ? assignmentSlaRails : [];
  const bottleneckRows = Array.isArray(approvalBottleneckMap) ? approvalBottleneckMap : [];
  const ladderRows = Array.isArray(closureEscalationLadder) ? closureEscalationLadder : [];
  return railRows.slice(0, 3).map((item, index) => ({
    owner: item.owner,
    severity:
      item.rail === dashboardCopy("watch SLA rail", "进入 SLA 观察轨")
        ? dashboardCopy("alert", "提醒")
        : dashboardCopy("normal", "正常"),
    reason:
      bottleneckRows[index]?.bottleneck ||
      dashboardCopy("clear lane", "通道通畅"),
    next_step:
      ladderRows[index]?.trigger ||
      item.note ||
      dashboardCopy("No breach follow-up yet.", "当前还没有超线后续动作。")
  }));
}

function buildWatchArchiveEvidenceGapActionsBridge(
  evidenceSufficiencyMeter,
  retentionComplianceChecklist,
  complianceSignoffCard
) {
  const checklistRows = Array.isArray(retentionComplianceChecklist) ? retentionComplianceChecklist : [];
  const gapRows = checklistRows.filter((item) => item.state !== watchArchiveChecklistState(true));
  const actions = gapRows.length ? gapRows : checklistRows.slice(0, 2);
  return actions.map((item, index) => ({
    action:
      item.state === watchArchiveChecklistState(true)
        ? dashboardCopy("validate evidence bundle", "校验证据包")
        : dashboardCopy("close evidence gap", "补齐证据缺口"),
    target: item.item,
    note:
      index === 0
        ? evidenceSufficiencyMeter?.summary || item.note
        : complianceSignoffCard?.note || item.note
  }));
}

function buildWatchArchiveClosureDailyBriefBridge(
  closureKpiStrip,
  closureOperationsCockpit,
  evidenceSufficiencyMeter
) {
  const kpiRows = Array.isArray(closureKpiStrip) ? closureKpiStrip : [];
  return {
    headline:
      closureOperationsCockpit?.headline ||
      dashboardCopy("Closure daily brief is still forming.", "收口日报仍在形成中。"),
    summary: dashboardCopy(
      `Today the closure lane is ${closureOperationsCockpit?.lane_state || "L0"}, readiness is ${kpiRows[0]?.value || "0%"}, and evidence sufficiency is ${evidenceSufficiencyMeter?.meter || 0}%.`,
      `今日收口通道为 ${closureOperationsCockpit?.lane_state || "L0"}，readiness 为 ${kpiRows[0]?.value || "0%"}，证据充分度为 ${evidenceSufficiencyMeter?.meter || 0}%。`
    ),
    next_focus:
      kpiRows[1]?.note ||
      evidenceSufficiencyMeter?.summary ||
      dashboardCopy("No daily brief focus yet.", "当前还没有日报焦点。")
  };
}

function buildWatchArchiveBreachTriageLadderBridge(
  assignmentBreachAlerts,
  closureEscalationLadder,
  assignmentSlaRails
) {
  const alertRows = Array.isArray(assignmentBreachAlerts) ? assignmentBreachAlerts : [];
  const ladderRows = Array.isArray(closureEscalationLadder) ? closureEscalationLadder : [];
  const railRows = Array.isArray(assignmentSlaRails) ? assignmentSlaRails : [];
  return alertRows.slice(0, 3).map((item, index) => ({
    level: ladderRows[index]?.level || `T${index + 1}`,
    owner: item.owner,
    state:
      item.severity === dashboardCopy("alert", "提醒")
        ? dashboardCopy("triage now", "立即分诊")
        : dashboardCopy("monitor", "继续观察"),
    note:
      item.next_step ||
      railRows[index]?.note ||
      dashboardCopy("No breach triage note yet.", "当前还没有超线分诊备注。")
  }));
}

function buildWatchArchiveEvidenceCollectionQueueBridge(
  evidenceGapActions,
  signoffEvidenceWallet,
  retentionComplianceChecklist
) {
  const gapRows = Array.isArray(evidenceGapActions) ? evidenceGapActions : [];
  const checklistRows = Array.isArray(retentionComplianceChecklist) ? retentionComplianceChecklist : [];
  return gapRows.slice(0, 3).map((item, index) => ({
    item: item.target,
    action: item.action,
    priority: index === 0 ? "P1" : "P2",
    note:
      item.note ||
      checklistRows[index]?.note ||
      signoffEvidenceWallet?.summary ||
      dashboardCopy("No evidence collection note yet.", "当前还没有证据采集备注。")
  }));
}

function buildWatchArchiveClosureShiftHandoffBridge(
  closureDailyBrief,
  closureOperationsCockpit,
  recoveryAssignmentBoard
) {
  const assignmentRows = Array.isArray(recoveryAssignmentBoard) ? recoveryAssignmentBoard : [];
  return {
    headline:
      closureDailyBrief?.headline ||
      dashboardCopy("Closure shift handoff is still forming.", "收口交班仍在形成中。"),
    outgoing_state:
      closureOperationsCockpit?.lane_state ||
      "L0",
    next_owner:
      assignmentRows[0]?.owner ||
      dashboardCopy("unassigned", "待分派"),
    summary:
      closureDailyBrief?.summary ||
      dashboardCopy("No closure handoff summary yet.", "当前还没有收口交班摘要。")
  };
}

function buildWatchArchiveTriagePriorityBoardBridge(
  breachTriageLadder,
  assignmentBreachAlerts,
  closureKpiStrip
) {
  const triageRows = Array.isArray(breachTriageLadder) ? breachTriageLadder : [];
  const alertRows = Array.isArray(assignmentBreachAlerts) ? assignmentBreachAlerts : [];
  const kpiRows = Array.isArray(closureKpiStrip) ? closureKpiStrip : [];
  return triageRows.slice(0, 3).map((item, index) => ({
    priority: index === 0 ? "P1" : index === 1 ? "P2" : "P3",
    owner: item.owner,
    state: item.state,
    note:
      alertRows[index]?.next_step ||
      kpiRows[index]?.note ||
      item.note ||
      dashboardCopy("No triage priority note yet.", "当前还没有分诊优先备注。")
  }));
}

function buildWatchArchiveEvidencePickupLogBridge(
  evidenceCollectionQueue,
  signoffEvidenceWallet,
  evidenceSufficiencyMeter
) {
  const queueRows = Array.isArray(evidenceCollectionQueue) ? evidenceCollectionQueue : [];
  return queueRows.slice(0, 3).map((item, index) => ({
    pickup_id: `EV-${index + 1}`,
    target: item.item,
    action: item.action,
    note:
      index === 0
        ? signoffEvidenceWallet?.anchor || item.note
        : evidenceSufficiencyMeter?.summary || item.note
  }));
}

function buildWatchArchiveShiftContinuityCardBridge(
  closureShiftHandoff,
  closureDailyBrief,
  closureOperationsCockpit
) {
  return {
    continuity:
      closureShiftHandoff?.next_owner &&
      closureShiftHandoff?.next_owner !== dashboardCopy("unassigned", "待分派")
        ? dashboardCopy("continuous", "连续")
        : dashboardCopy("at risk", "有断档风险"),
    lane_state:
      closureShiftHandoff?.outgoing_state ||
      closureOperationsCockpit?.lane_state ||
      "L0",
    summary:
      closureShiftHandoff?.summary ||
      closureDailyBrief?.summary ||
      dashboardCopy("No shift continuity summary yet.", "当前还没有交班连续性摘要。")
  };
}

function buildWatchArchiveTriageLoadBalancerBridge(
  triagePriorityBoard,
  recoveryAssignmentBoard,
  assignmentSlaRails
) {
  const triageRows = Array.isArray(triagePriorityBoard) ? triagePriorityBoard : [];
  const assignmentRows = Array.isArray(recoveryAssignmentBoard) ? recoveryAssignmentBoard : [];
  const railRows = Array.isArray(assignmentSlaRails) ? assignmentSlaRails : [];
  return triageRows.slice(0, 3).map((item, index) => ({
    owner: item.owner,
    load:
      index === 0
        ? dashboardCopy("heavy", "偏重")
        : index === 1
          ? dashboardCopy("balanced", "平衡")
          : dashboardCopy("light", "偏轻"),
    action:
      assignmentRows[index]?.action ||
      dashboardCopy("rebalance triage ownership", "重新平衡分诊负责人"),
    note:
      railRows[index]?.note ||
      item.note ||
      dashboardCopy("No triage load note yet.", "当前还没有分诊负载备注。")
  }));
}

window.buildWatchArchiveAssignmentSlaRailsBridge = buildWatchArchiveAssignmentSlaRailsBridge;
window.buildWatchArchiveAssignmentBreachAlertsBridge = buildWatchArchiveAssignmentBreachAlertsBridge;
window.buildWatchArchiveEvidenceGapActionsBridge = buildWatchArchiveEvidenceGapActionsBridge;
window.buildWatchArchiveClosureDailyBriefBridge = buildWatchArchiveClosureDailyBriefBridge;
window.buildWatchArchiveBreachTriageLadderBridge = buildWatchArchiveBreachTriageLadderBridge;
window.buildWatchArchiveEvidenceCollectionQueueBridge = buildWatchArchiveEvidenceCollectionQueueBridge;
window.buildWatchArchiveClosureShiftHandoffBridge = buildWatchArchiveClosureShiftHandoffBridge;
window.buildWatchArchiveTriagePriorityBoardBridge = buildWatchArchiveTriagePriorityBoardBridge;
window.buildWatchArchiveEvidencePickupLogBridge = buildWatchArchiveEvidencePickupLogBridge;
window.buildWatchArchiveShiftContinuityCardBridge = buildWatchArchiveShiftContinuityCardBridge;
window.buildWatchArchiveTriageLoadBalancerBridge = buildWatchArchiveTriageLoadBalancerBridge;
