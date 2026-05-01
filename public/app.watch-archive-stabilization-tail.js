function buildWatchArchiveRebalanceRecommendationQueueModule(
  triageLoadBalancer,
  triagePriorityBoard,
  recoveryAssignmentBoard
) {
  return globalThis.buildWatchArchiveRebalanceRecommendationQueueBridge?.(
    triageLoadBalancer,
    triagePriorityBoard,
    recoveryAssignmentBoard
  ) || [];
}

function buildWatchArchiveStaleEvidenceRescuePlanModule(
  evidenceAgingView,
  evidenceCollectionQueue,
  evidenceGapActions
) {
  return globalThis.buildWatchArchiveStaleEvidenceRescuePlanBridge?.(
    evidenceAgingView,
    evidenceCollectionQueue,
    evidenceGapActions
  ) || [];
}

function buildWatchArchiveShiftStabilizationBoardModule(
  shiftRiskPulse,
  shiftContinuityCard,
  closureShiftHandoff
) {
  return globalThis.buildWatchArchiveShiftStabilizationBoardBridge?.(
    shiftRiskPulse,
    shiftContinuityCard,
    closureShiftHandoff
  ) || null;
}

function buildWatchArchiveRebalanceExecutionTrackerModule(
  rebalanceRecommendationQueue,
  triageLoadBalancer,
  recoveryAssignmentBoard
) {
  return globalThis.buildWatchArchiveRebalanceExecutionTrackerBridge?.(
    rebalanceRecommendationQueue,
    triageLoadBalancer,
    recoveryAssignmentBoard
  ) || [];
}

function buildWatchArchiveRescuedEvidenceOutcomesModule(
  staleEvidenceRescuePlan,
  evidencePickupLog,
  evidenceAgingView
) {
  return globalThis.buildWatchArchiveRescuedEvidenceOutcomesBridge?.(
    staleEvidenceRescuePlan,
    evidencePickupLog,
    evidenceAgingView
  ) || [];
}

function buildWatchArchiveStabilizationConfidenceBandModule(
  shiftStabilizationBoard,
  shiftRiskPulse,
  closureReadinessScore
) {
  return globalThis.buildWatchArchiveStabilizationConfidenceBandBridge?.(
    shiftStabilizationBoard,
    shiftRiskPulse,
    closureReadinessScore
  ) || null;
}

function buildWatchArchiveExecutionDriftAlertsModule(
  rebalanceExecutionTracker,
  rebalanceRecommendationQueue,
  assignmentSlaRails
) {
  return globalThis.buildWatchArchiveExecutionDriftAlertsBridge?.(
    rebalanceExecutionTracker,
    rebalanceRecommendationQueue,
    assignmentSlaRails
  ) || [];
}

function buildWatchArchiveEvidenceRecoveryScoreboardModule(
  rescuedEvidenceOutcomes,
  evidenceSufficiencyMeter,
  signoffEvidenceWallet
) {
  return globalThis.buildWatchArchiveEvidenceRecoveryScoreboardBridge?.(
    rescuedEvidenceOutcomes,
    evidenceSufficiencyMeter,
    signoffEvidenceWallet
  ) || null;
}

function buildWatchArchiveStabilizationWatchlistModule(
  stabilizationConfidenceBand,
  shiftRiskPulse,
  shiftStabilizationBoard
) {
  return globalThis.buildWatchArchiveStabilizationWatchlistBridge?.(
    stabilizationConfidenceBand,
    shiftRiskPulse,
    shiftStabilizationBoard
  ) || [];
}

function buildWatchArchiveDriftCorrectionQueueModule(
  executionDriftAlerts,
  rebalanceExecutionTracker,
  rebalanceRecommendationQueue
) {
  const alertRows = Array.isArray(executionDriftAlerts) ? executionDriftAlerts : [];
  const executionRows = Array.isArray(rebalanceExecutionTracker) ? rebalanceExecutionTracker : [];
  const recommendationRows = Array.isArray(rebalanceRecommendationQueue) ? rebalanceRecommendationQueue : [];
  return alertRows.slice(0, 3).map((item, index) => ({
    owner: item.owner,
    urgency:
      item.drift === dashboardCopy("drift alert", "漂移提醒")
        ? dashboardCopy("correct now", "优先纠偏")
        : dashboardCopy("watch", "继续观察"),
    action:
      recommendationRows[index]?.recommendation ||
      executionRows[index]?.action ||
      item.action,
    note:
      executionRows[index]?.note ||
      item.note ||
      dashboardCopy("No drift correction note yet.", "当前还没有漂移纠偏备注。")
  }));
}

function buildWatchArchiveRecoveryProofPackModule(
  evidenceRecoveryScoreboard,
  rescuedEvidenceOutcomes,
  signoffEvidenceWallet
) {
  const outcomeRows = Array.isArray(rescuedEvidenceOutcomes) ? rescuedEvidenceOutcomes : [];
  const recoveredRows = outcomeRows.filter(
    (item) => item.outcome === dashboardCopy("recovered", "已恢复")
  );
  return {
    proof_state:
      recoveredRows.length >= Math.max(1, Math.min(2, outcomeRows.length))
        ? dashboardCopy("proof pack building", "恢复证明包构建中")
        : dashboardCopy("proof pack incomplete", "恢复证明包待补齐"),
    anchors: signoffEvidenceWallet?.evidence_count || 0,
    recovered: evidenceRecoveryScoreboard?.recovered || 0,
    total: evidenceRecoveryScoreboard?.total || 0,
    summary: dashboardCopy(
      `${recoveredRows.length}/${outcomeRows.length || 0} rescued evidence lanes can be attached to a recovery proof pack, with ${signoffEvidenceWallet?.evidence_count || 0} sign-off evidence anchors available.`,
      `当前可纳入恢复证明包的抢救证据通道为 ${recoveredRows.length}/${outcomeRows.length || 0} 条，可用签字证据锚点共 ${signoffEvidenceWallet?.evidence_count || 0} 条。`
    )
  };
}

function buildWatchArchiveStabilizationHandoffMemoModule(
  stabilizationWatchlist,
  shiftStabilizationBoard,
  closureShiftHandoff
) {
  const watchRows = Array.isArray(stabilizationWatchlist) ? stabilizationWatchlist : [];
  return {
    state:
      shiftStabilizationBoard?.state ||
      dashboardCopy("unknown", "未知"),
    next_owner:
      closureShiftHandoff?.next_owner ||
      dashboardCopy("unassigned", "未指派"),
    summary:
      closureShiftHandoff?.summary ||
      shiftStabilizationBoard?.summary ||
      dashboardCopy("No stabilization handoff summary yet.", "当前还没有稳定交接备忘摘要。"),
    focus: watchRows
      .slice(0, 2)
      .map((item) => `${item.lane}: ${item.status}`)
      .join(" · ")
  };
}

function buildWatchArchiveCorrectionCompletionTrackerModule(
  driftCorrectionQueue,
  rebalanceExecutionTracker,
  executionDriftAlerts
) {
  const correctionRows = Array.isArray(driftCorrectionQueue) ? driftCorrectionQueue : [];
  const executionRows = Array.isArray(rebalanceExecutionTracker) ? rebalanceExecutionTracker : [];
  return correctionRows.slice(0, 3).map((item, index) => ({
    owner: item.owner,
    completion:
      executionRows[index]?.status === dashboardCopy("executing", "执行中")
        ? dashboardCopy("in progress", "推进中")
        : item.urgency === dashboardCopy("watch", "继续观察")
          ? dashboardCopy("watching", "观察中")
          : dashboardCopy("pending completion", "待完成"),
    action: item.action,
    note:
      executionRows[index]?.note ||
      executionDriftAlerts?.[index]?.note ||
      item.note ||
      dashboardCopy("No correction completion note yet.", "当前还没有纠偏完成跟踪备注。")
  }));
}

function buildWatchArchiveProofAcceptanceCardModule(
  recoveryProofPack,
  evidenceRecoveryScoreboard,
  signoffEvidenceWallet
) {
  const anchors = signoffEvidenceWallet?.evidence_count || 0;
  const recovered = evidenceRecoveryScoreboard?.recovered || 0;
  const total = evidenceRecoveryScoreboard?.total || 0;
  return {
    acceptance:
      recoveryProofPack?.proof_state === dashboardCopy("proof pack building", "恢复证明包构建中") &&
      anchors >= 1
        ? dashboardCopy("near acceptance", "接近验收")
        : dashboardCopy("needs more proof", "仍需补证"),
    anchors,
    meter: evidenceRecoveryScoreboard?.meter || 0,
    summary:
      recoveryProofPack?.summary ||
      dashboardCopy("No recovery proof acceptance summary yet.", "当前还没有恢复证明验收摘要。"),
    note: dashboardCopy(
      `${recovered}/${total} recovery lanes and ${anchors} evidence anchors are available for acceptance review.`,
      `当前已有 ${recovered}/${total} 条恢复通道与 ${anchors} 条证据锚点可进入验收复核。`
    )
  };
}

function buildWatchArchiveHandoffReadinessBadgeModule(
  stabilizationHandoffMemo,
  stabilizationConfidenceBand,
  closureShiftHandoff
) {
  return globalThis.buildWatchArchiveHandoffReadinessBadgeBridge?.(
    stabilizationHandoffMemo,
    stabilizationConfidenceBand,
    closureShiftHandoff
  ) || null;
}

function buildWatchArchiveCorrectionClosureQueueModule(
  correctionCompletionTracker,
  driftCorrectionQueue,
  rebalanceExecutionTracker
) {
  return globalThis.buildWatchArchiveCorrectionClosureQueueBridge?.(
    correctionCompletionTracker,
    driftCorrectionQueue,
    rebalanceExecutionTracker
  ) || [];
}

function buildWatchArchiveProofSignoffChecklistModule(
  proofAcceptanceCard,
  signoffEvidenceWallet,
  evidenceRecoveryScoreboard
) {
  return globalThis.buildWatchArchiveProofSignoffChecklistBridge?.(
    proofAcceptanceCard,
    signoffEvidenceWallet,
    evidenceRecoveryScoreboard
  ) || [];
}

function buildWatchArchiveClosureSignoffGateModule(
  handoffReadinessBadge,
  proofSignoffChecklist,
  proofAcceptanceCard
) {
  return globalThis.buildWatchArchiveClosureSignoffGateBridge?.(
    handoffReadinessBadge,
    proofSignoffChecklist,
    proofAcceptanceCard
  ) || null;
}

function buildWatchArchiveHandoffCompletionReceiptModule(
  handoffReadinessBadge,
  stabilizationHandoffMemo,
  closureShiftHandoff
) {
  return globalThis.buildWatchArchiveHandoffCompletionReceiptBridge?.(
    handoffReadinessBadge,
    stabilizationHandoffMemo,
    closureShiftHandoff
  ) || null;
}

function buildWatchArchiveCorrectionAuditTrailModule(
  correctionClosureQueue,
  correctionCompletionTracker,
  executionDriftAlerts
) {
  return globalThis.buildWatchArchiveCorrectionAuditTrailBridge?.(
    correctionClosureQueue,
    correctionCompletionTracker,
    executionDriftAlerts
  ) || [];
}

Object.assign(globalThis, {
  buildWatchArchiveRebalanceRecommendationQueueModule,
  buildWatchArchiveStaleEvidenceRescuePlanModule,
  buildWatchArchiveShiftStabilizationBoardModule,
  buildWatchArchiveRebalanceExecutionTrackerModule,
  buildWatchArchiveRescuedEvidenceOutcomesModule,
  buildWatchArchiveStabilizationConfidenceBandModule,
  buildWatchArchiveExecutionDriftAlertsModule,
  buildWatchArchiveEvidenceRecoveryScoreboardModule,
  buildWatchArchiveStabilizationWatchlistModule,
  buildWatchArchiveDriftCorrectionQueueModule,
  buildWatchArchiveRecoveryProofPackModule,
  buildWatchArchiveStabilizationHandoffMemoModule,
  buildWatchArchiveCorrectionCompletionTrackerModule,
  buildWatchArchiveProofAcceptanceCardModule,
  buildWatchArchiveHandoffReadinessBadgeModule,
  buildWatchArchiveCorrectionClosureQueueModule,
  buildWatchArchiveProofSignoffChecklistModule,
  buildWatchArchiveClosureSignoffGateModule,
  buildWatchArchiveHandoffCompletionReceiptModule,
  buildWatchArchiveCorrectionAuditTrailModule
});
