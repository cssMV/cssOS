function buildWatchArchivePromotionReviewDocketBridge(
  promotionDecisionMemo,
  operatorPromotionCriteria,
  remediationPlanCards
) {
  const promotionRows = Array.isArray(operatorPromotionCriteria) ? operatorPromotionCriteria : [];
  const remediationRows = Array.isArray(remediationPlanCards) ? remediationPlanCards : [];
  return promotionRows.map((item, index) => ({
    review_item: item.role,
    status: item.status,
    memo_anchor:
      promotionDecisionMemo?.headline ||
      dashboardCopy("Promotion review is still forming.", "升级评审仍在形成中。"),
    prerequisite:
      remediationRows[index]?.title ||
      dashboardCopy("No explicit remediation prerequisite yet.", "当前还没有明确的补救前置项。")
  }));
}

function buildWatchArchiveLeadershipStaffingBriefBridge(
  coverageGapHeatmap,
  successionReadinessSlate,
  promotionDecisionMemo
) {
  const coverageRows = Array.isArray(coverageGapHeatmap) ? coverageGapHeatmap : [];
  const successionRows = Array.isArray(successionReadinessSlate) ? successionReadinessSlate : [];
  return {
    headline:
      promotionDecisionMemo?.headline ||
      dashboardCopy("Staffing brief is still forming.", "梯队简报仍在形成中。"),
    gap_anchor:
      coverageRows[0]?.note ||
      dashboardCopy("Coverage gaps are still being assessed.", "覆盖缺口仍在评估中。"),
    succession_anchor:
      successionRows[0]?.succession_note ||
      dashboardCopy("Succession readiness is still being assessed.", "接班准备度仍在评估中。")
  };
}

function buildWatchArchiveSuccessionRiskRegisterBridge(
  successionReadinessSlate,
  coverageGapHeatmap,
  readinessRiskHedge
) {
  const successionRows = Array.isArray(successionReadinessSlate) ? successionReadinessSlate : [];
  const coverageRows = Array.isArray(coverageGapHeatmap) ? coverageGapHeatmap : [];
  const hedgeRows = Array.isArray(readinessRiskHedge) ? readinessRiskHedge : [];
  return successionRows.map((item, index) => ({
    risk_item: item.lane,
    severity:
      coverageRows[index]?.heat === dashboardCopy("hot gap", "高热缺口")
        ? dashboardCopy("high", "高")
        : dashboardCopy("moderate", "中"),
    note: item.succession_note,
    hedge:
      hedgeRows[index]?.action ||
      dashboardCopy("Keep the succession hedge active.", "继续保持接班对冲。")
  }));
}

function buildWatchArchiveReviewOutcomeTrackerBridge(
  promotionReviewDocket,
  operatorPromotionCriteria,
  promotionDecisionMemo
) {
  const docketRows = Array.isArray(promotionReviewDocket) ? promotionReviewDocket : [];
  const promotionRows = Array.isArray(operatorPromotionCriteria) ? operatorPromotionCriteria : [];
  return docketRows.map((item, index) => ({
    review_item: item.review_item,
    outcome:
      promotionRows[index]?.status === dashboardCopy("eligible", "可升级")
        ? dashboardCopy("ready for committee review", "可进入评审")
        : dashboardCopy("needs more evidence", "仍需更多证据"),
    memo:
      promotionDecisionMemo?.headline ||
      dashboardCopy("Promotion memo still in watch mode.", "升级备忘仍处于观察模式。")
  }));
}

function buildWatchArchiveLeadershipActionQueueBridge(
  leadershipStaffingBrief,
  successionRiskRegister,
  reviewOutcomeTracker
) {
  const riskRows = Array.isArray(successionRiskRegister) ? successionRiskRegister : [];
  const reviewRows = Array.isArray(reviewOutcomeTracker) ? reviewOutcomeTracker : [];
  return [
    {
      action: dashboardCopy("Review hottest succession gap", "先看最高热度接班缺口"),
      reason:
        leadershipStaffingBrief?.gap_anchor ||
        dashboardCopy("Coverage gaps still need leadership attention.", "覆盖缺口仍需要负责人关注。")
    },
    {
      action: dashboardCopy("Close top succession risk", "先收口首要接班风险"),
      reason:
        riskRows[0]?.note ||
        dashboardCopy("A top succession risk still needs mitigation.", "当前仍有首要接班风险待缓解。")
    },
    {
      action: dashboardCopy("Advance next review item", "推进下一条评审项"),
      reason:
        reviewRows[0]?.outcome ||
        dashboardCopy("Promotion review still needs a next decision.", "升级评审仍需要下一步决策。")
    }
  ];
}

function buildWatchArchiveSuccessionMitigationPlanBridge(
  successionRiskRegister,
  readinessRiskHedge,
  remediationPlanCards
) {
  const riskRows = Array.isArray(successionRiskRegister) ? successionRiskRegister : [];
  const hedgeRows = Array.isArray(readinessRiskHedge) ? readinessRiskHedge : [];
  const remediationRows = Array.isArray(remediationPlanCards) ? remediationPlanCards : [];
  return riskRows.map((item, index) => ({
    risk_item: item.risk_item,
    mitigation:
      hedgeRows[index]?.action ||
      remediationRows[index]?.action ||
      dashboardCopy("Keep mitigation active until the succession lane cools down.", "在接班通道降温前继续保持缓解动作。"),
    closure_signal: dashboardCopy(
      item.severity === dashboardCopy("high", "高")
        ? "Close only after the heat shifts out of the hot-gap zone."
        : "Close after the lane holds steady through the next watch window.",
      item.severity === dashboardCopy("high", "高")
        ? "只有当热度脱离高热缺口区后才应收口。"
        : "当这条通道在下一窗口保持稳定后即可收口。"
    )
  }));
}

function buildWatchArchiveReviewClosureLogBridge(
  reviewOutcomeTracker,
  promotionReviewDocket,
  promotionDecisionMemo
) {
  const outcomeRows = Array.isArray(reviewOutcomeTracker) ? reviewOutcomeTracker : [];
  const docketRows = Array.isArray(promotionReviewDocket) ? promotionReviewDocket : [];
  return outcomeRows.map((item, index) => ({
    review_item: item.review_item,
    closure:
      item.outcome === dashboardCopy("ready for committee review", "可进入评审")
        ? dashboardCopy("open for committee close", "待委员会关闭")
        : dashboardCopy("hold open", "继续保持打开"),
    next_step:
      docketRows[index]?.prerequisite ||
      dashboardCopy("Await the next review prerequisite.", "等待下一条评审前置项。"),
    memo:
      promotionDecisionMemo?.headline ||
      dashboardCopy("Review closure memo still forming.", "评审闭环备忘仍在形成中。")
  }));
}

function buildWatchArchiveLeadershipFollowThroughBoardBridge(
  leadershipActionQueue,
  leadershipStaffingBrief,
  reviewClosureLog
) {
  const actionRows = Array.isArray(leadershipActionQueue) ? leadershipActionQueue : [];
  const closureRows = Array.isArray(reviewClosureLog) ? reviewClosureLog : [];
  return actionRows.map((item, index) => ({
    action: item.action,
    follow_through:
      closureRows[index]?.closure === dashboardCopy("open for committee close", "待委员会关闭")
        ? dashboardCopy("advancing", "推进中")
        : dashboardCopy("needs follow-through", "仍需跟进"),
    note:
      item.reason ||
      leadershipStaffingBrief?.headline ||
      dashboardCopy("Leadership follow-through still needs an explicit next step.", "负责人跟进行动仍需要明确下一步。")
  }));
}

function buildWatchArchiveMitigationSlaClockBridge(
  successionMitigationPlan,
  successionRiskRegister,
  readinessForecastWindow
) {
  const mitigationRows = Array.isArray(successionMitigationPlan) ? successionMitigationPlan : [];
  const riskRows = Array.isArray(successionRiskRegister) ? successionRiskRegister : [];
  const nextWindow = Number(readinessForecastWindow?.next_window || 0);
  return mitigationRows.map((item, index) => ({
    risk_item: item.risk_item,
    sla:
      riskRows[index]?.severity === dashboardCopy("high", "高")
        ? dashboardCopy("24h window", "24 小时窗口")
        : dashboardCopy("next watch cycle", "下一观察周期"),
    status:
      nextWindow >= 80
        ? dashboardCopy("within SLA", "未超时")
        : dashboardCopy("watch breach risk", "存在超时风险"),
    note: item.closure_signal
  }));
}

function buildWatchArchiveClosureEvidencePackBridge(
  reviewClosureLog,
  promotionReviewDocket,
  leadershipStaffingBrief
) {
  const closureRows = Array.isArray(reviewClosureLog) ? reviewClosureLog : [];
  const docketRows = Array.isArray(promotionReviewDocket) ? promotionReviewDocket : [];
  return closureRows.map((item, index) => ({
    review_item: item.review_item,
    evidence:
      docketRows[index]?.prerequisite ||
      dashboardCopy("No docket prerequisite captured yet.", "当前还没有捕获到排单前置证据。"),
    closure_note:
      item.memo ||
      leadershipStaffingBrief?.headline ||
      dashboardCopy("Closure evidence note still forming.", "闭环证据备注仍在形成中。")
  }));
}

function buildWatchArchiveExecutiveAccountabilityLaneBridge(
  leadershipFollowThroughBoard,
  leadershipActionQueue,
  leadershipStaffingBrief
) {
  const followRows = Array.isArray(leadershipFollowThroughBoard) ? leadershipFollowThroughBoard : [];
  const actionRows = Array.isArray(leadershipActionQueue) ? leadershipActionQueue : [];
  return actionRows.map((item, index) => ({
    owner: dashboardCopy(`Executive owner ${index + 1}`, `负责人 ${index + 1}`),
    action: item.action,
    accountability:
      followRows[index]?.follow_through ||
      dashboardCopy("needs follow-through", "仍需跟进"),
    note:
      leadershipStaffingBrief?.headline ||
      item.reason ||
      dashboardCopy("Executive accountability note still forming.", "负责人责任备注仍在形成中。")
  }));
}

function buildWatchArchiveOverdueMitigationEscalationsBridge(
  mitigationSlaClock,
  successionMitigationPlan,
  successionRiskRegister
) {
  const slaRows = Array.isArray(mitigationSlaClock) ? mitigationSlaClock : [];
  const mitigationRows = Array.isArray(successionMitigationPlan) ? successionMitigationPlan : [];
  const riskRows = Array.isArray(successionRiskRegister) ? successionRiskRegister : [];
  return slaRows.map((item, index) => ({
    risk_item: item.risk_item,
    escalation:
      item.status === dashboardCopy("watch breach risk", "存在超时风险")
        ? dashboardCopy("escalate now", "立即升级")
        : dashboardCopy("keep under watch", "继续观察"),
    reason:
      mitigationRows[index]?.closure_signal ||
      riskRows[index]?.note ||
      dashboardCopy("Mitigation escalation note still forming.", "缓解升级说明仍在形成中。")
  }));
}

function buildWatchArchiveClosureAuditSummaryBridge(
  closureEvidencePack,
  reviewClosureLog,
  leadershipFollowThroughBoard
) {
  const evidenceRows = Array.isArray(closureEvidencePack) ? closureEvidencePack : [];
  const closureRows = Array.isArray(reviewClosureLog) ? reviewClosureLog : [];
  const followRows = Array.isArray(leadershipFollowThroughBoard) ? leadershipFollowThroughBoard : [];
  return {
    headline: dashboardCopy(
      "Closure audit can now be scanned in one pass.",
      "闭环审计现在可以一眼扫完。"
    ),
    evidence_count: evidenceRows.length,
    open_items: closureRows.filter(
      (item) => item.closure === dashboardCopy("hold open", "继续保持打开")
    ).length,
    accountability_state: followRows
      .map((item) => `${item.action}: ${item.follow_through}`)
      .slice(0, 3)
      .join(" | ")
  };
}

function buildWatchArchiveExecReviewAgendaBridge(
  executiveAccountabilityLane,
  overdueMitigationEscalations,
  closureAuditSummary
) {
  const accountabilityRows = Array.isArray(executiveAccountabilityLane) ? executiveAccountabilityLane : [];
  const escalationRows = Array.isArray(overdueMitigationEscalations) ? overdueMitigationEscalations : [];
  return [
    {
      topic: dashboardCopy("Accountability review", "责任评审"),
      summary:
        accountabilityRows[0]?.note ||
        dashboardCopy("Executive accountability still needs attention.", "负责人责任仍需要关注。")
    },
    {
      topic: dashboardCopy("Overdue mitigation review", "拖期缓解评审"),
      summary:
        escalationRows[0]?.reason ||
        dashboardCopy("No overdue mitigation summary yet.", "当前还没有拖期缓解摘要。")
    },
    {
      topic: dashboardCopy("Closure audit scan", "闭环审计总览"),
      summary:
        closureAuditSummary?.headline ||
        dashboardCopy("Closure audit summary is still forming.", "闭环审计摘要仍在形成中。")
    }
  ];
}

function buildWatchArchiveEscalationBurndownBridge(
  overdueMitigationEscalations,
  mitigationSlaClock,
  closureAuditSummary
) {
  const escalationRows = Array.isArray(overdueMitigationEscalations) ? overdueMitigationEscalations : [];
  const slaRows = Array.isArray(mitigationSlaClock) ? mitigationSlaClock : [];
  const total = escalationRows.length;
  const urgent = escalationRows.filter(
    (item) => item.escalation === dashboardCopy("escalate now", "立即升级")
  ).length;
  return {
    total,
    cleared: Math.max(0, total - urgent),
    urgent,
    summary: dashboardCopy(
      `Mitigation burn-down shows ${Math.max(0, total - urgent)}/${total} lanes not currently in immediate escalation, with ${closureAuditSummary?.open_items || 0} audit items still open.`,
      `缓解 burn-down 显示 ${Math.max(0, total - urgent)}/${total} 条通道当前不处于立即升级状态，同时仍有 ${closureAuditSummary?.open_items || 0} 条审计项未关闭。`
    ),
    pace: slaRows
      .map((item) => `${item.risk_item}: ${item.status}`)
      .slice(0, 3)
      .join(" | ")
  };
}

function buildWatchArchiveAuditConfidenceBannerBridge(
  closureAuditSummary,
  closureEvidencePack,
  executiveAccountabilityLane
) {
  const evidenceCount = Number(closureAuditSummary?.evidence_count || 0);
  const openItems = Number(closureAuditSummary?.open_items || 0);
  const confidence =
    evidenceCount >= 3 && openItems <= 1
      ? dashboardCopy("high confidence", "高把握")
      : evidenceCount >= 2
        ? dashboardCopy("moderate confidence", "中等把握")
        : dashboardCopy("low confidence", "低把握");
  return {
    confidence,
    summary: dashboardCopy(
      `${evidenceCount} evidence items are attached, ${openItems} closure items remain open, and ${Array.isArray(executiveAccountabilityLane) ? executiveAccountabilityLane.length : 0} accountability lanes are visible.`,
      `当前已挂接 ${evidenceCount} 条证据，仍有 ${openItems} 条闭环项未关闭，可见 ${Array.isArray(executiveAccountabilityLane) ? executiveAccountabilityLane.length : 0} 条责任归属线。`
    )
  };
}

function buildWatchArchiveExecutiveSignoffReadinessBridge(
  execReviewAgenda,
  auditConfidenceBanner,
  closureAuditSummary
) {
  const agendaRows = Array.isArray(execReviewAgenda) ? execReviewAgenda : [];
  const confidence = String(auditConfidenceBanner?.confidence || "");
  const openItems = Number(closureAuditSummary?.open_items || 0);
  const ready = confidence === dashboardCopy("high confidence", "高把握") && openItems <= 1;
  return {
    status: ready
      ? dashboardCopy("ready to sign", "可签字")
      : dashboardCopy("not ready yet", "尚不可签"),
    reason: ready
      ? dashboardCopy(
          "Agenda is tight, audit confidence is high, and only a small number of closure items remain.",
          "议程已收紧，审计把握度高，而且只剩很少的闭环项。"
        )
      : agendaRows[0]?.summary ||
        dashboardCopy("Executive sign-off still needs one more review pass.", "高层签字仍需要再过一轮评审。")
  };
}

window.buildWatchArchivePromotionReviewDocketBridge = buildWatchArchivePromotionReviewDocketBridge;
window.buildWatchArchiveLeadershipStaffingBriefBridge = buildWatchArchiveLeadershipStaffingBriefBridge;
window.buildWatchArchiveSuccessionRiskRegisterBridge = buildWatchArchiveSuccessionRiskRegisterBridge;
window.buildWatchArchiveReviewOutcomeTrackerBridge = buildWatchArchiveReviewOutcomeTrackerBridge;
window.buildWatchArchiveLeadershipActionQueueBridge = buildWatchArchiveLeadershipActionQueueBridge;
window.buildWatchArchiveSuccessionMitigationPlanBridge = buildWatchArchiveSuccessionMitigationPlanBridge;
window.buildWatchArchiveReviewClosureLogBridge = buildWatchArchiveReviewClosureLogBridge;
window.buildWatchArchiveLeadershipFollowThroughBoardBridge = buildWatchArchiveLeadershipFollowThroughBoardBridge;
window.buildWatchArchiveMitigationSlaClockBridge = buildWatchArchiveMitigationSlaClockBridge;
window.buildWatchArchiveClosureEvidencePackBridge = buildWatchArchiveClosureEvidencePackBridge;
window.buildWatchArchiveExecutiveAccountabilityLaneBridge = buildWatchArchiveExecutiveAccountabilityLaneBridge;
window.buildWatchArchiveOverdueMitigationEscalationsBridge = buildWatchArchiveOverdueMitigationEscalationsBridge;
window.buildWatchArchiveClosureAuditSummaryBridge = buildWatchArchiveClosureAuditSummaryBridge;
window.buildWatchArchiveExecReviewAgendaBridge = buildWatchArchiveExecReviewAgendaBridge;
window.buildWatchArchiveEscalationBurndownBridge = buildWatchArchiveEscalationBurndownBridge;
window.buildWatchArchiveAuditConfidenceBannerBridge = buildWatchArchiveAuditConfidenceBannerBridge;
window.buildWatchArchiveExecutiveSignoffReadinessBridge = buildWatchArchiveExecutiveSignoffReadinessBridge;
