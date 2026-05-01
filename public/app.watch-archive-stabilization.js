(function attachWatchArchiveStabilization(global) {
  const dashboardCopy = (...args) => global.dashboardCopy(...args);

  function buildWatchArchiveEvidenceAgingViewBridge(
    evidencePickupLog,
    evidenceCollectionQueue,
    evidenceSufficiencyMeter
  ) {
    const pickupRows = Array.isArray(evidencePickupLog) ? evidencePickupLog : [];
    const queueRows = Array.isArray(evidenceCollectionQueue) ? evidenceCollectionQueue : [];
    return pickupRows.slice(0, 3).map((item, index) => ({
      item: item.target,
      age_band: index === 0 ? "0-1d" : index === 1 ? "1-3d" : "3d+",
      action:
        queueRows[index]?.action ||
        item.action,
      note:
        item.note ||
        evidenceSufficiencyMeter?.summary ||
        dashboardCopy("No evidence aging note yet.", "当前还没有证据老化备注。")
    }));
  }

  function buildWatchArchiveShiftRiskPulseBridge(
    shiftContinuityCard,
    closureShiftHandoff,
    triagePriorityBoard
  ) {
    const triageRows = Array.isArray(triagePriorityBoard) ? triagePriorityBoard : [];
    const risk =
      shiftContinuityCard?.continuity === dashboardCopy("continuous", "连续") &&
      triageRows.filter((item) => item.state === dashboardCopy("triage now", "立即分诊")).length <= 1
        ? dashboardCopy("stable", "稳定")
        : dashboardCopy("elevated", "升高");
    return {
      risk,
      lane_state: shiftContinuityCard?.lane_state || closureShiftHandoff?.outgoing_state || "L0",
      summary:
        shiftContinuityCard?.summary ||
        closureShiftHandoff?.summary ||
        dashboardCopy("No shift risk pulse summary yet.", "当前还没有交班风险脉冲摘要。")
    };
  }

  function buildWatchArchiveRebalanceRecommendationQueueBridge(
    triageLoadBalancer,
    triagePriorityBoard,
    recoveryAssignmentBoard
  ) {
    const loadRows = Array.isArray(triageLoadBalancer) ? triageLoadBalancer : [];
    const triageRows = Array.isArray(triagePriorityBoard) ? triagePriorityBoard : [];
    const assignmentRows = Array.isArray(recoveryAssignmentBoard) ? recoveryAssignmentBoard : [];
    return loadRows.slice(0, 3).map((item, index) => ({
      priority: triageRows[index]?.priority || `P${index + 1}`,
      owner: item.owner,
      recommendation:
        item.load === dashboardCopy("heavy", "偏重")
          ? dashboardCopy("rebalance now", "立即重平衡")
          : dashboardCopy("keep current routing", "维持当前分配"),
      note:
        assignmentRows[index]?.action ||
        item.note ||
        dashboardCopy("No rebalance recommendation note yet.", "当前还没有重平衡建议备注。")
    }));
  }

  function buildWatchArchiveStaleEvidenceRescuePlanBridge(
    evidenceAgingView,
    evidenceCollectionQueue,
    evidenceGapActions
  ) {
    const agingRows = Array.isArray(evidenceAgingView) ? evidenceAgingView : [];
    const queueRows = Array.isArray(evidenceCollectionQueue) ? evidenceCollectionQueue : [];
    const gapRows = Array.isArray(evidenceGapActions) ? evidenceGapActions : [];
    return agingRows.slice(0, 3).map((item, index) => ({
      item: item.item,
      urgency:
        item.age_band === "3d+"
          ? dashboardCopy("rescue now", "立即抢救")
          : item.age_band === "1-3d"
            ? dashboardCopy("accelerate", "加速处理")
            : dashboardCopy("on track", "正常推进"),
      action:
        queueRows[index]?.action ||
        gapRows[index]?.action ||
        dashboardCopy("refresh evidence request", "刷新证据请求"),
      note:
        item.note ||
        dashboardCopy("No stale evidence rescue note yet.", "当前还没有陈旧证据抢救备注。")
    }));
  }

  function buildWatchArchiveShiftStabilizationBoardBridge(
    shiftRiskPulse,
    shiftContinuityCard,
    closureShiftHandoff
  ) {
    return {
      state:
        shiftRiskPulse?.risk === dashboardCopy("stable", "稳定")
          ? dashboardCopy("stabilized", "已稳定")
          : dashboardCopy("stabilizing", "稳定中"),
      lane_state:
        shiftRiskPulse?.lane_state || shiftContinuityCard?.lane_state || "L0",
      summary:
        shiftRiskPulse?.summary ||
        shiftContinuityCard?.summary ||
        closureShiftHandoff?.summary ||
        dashboardCopy("No shift stabilization summary yet.", "当前还没有交班稳定摘要。")
    };
  }

  function buildWatchArchiveRebalanceExecutionTrackerBridge(
    rebalanceRecommendationQueue,
    triageLoadBalancer,
    recoveryAssignmentBoard
  ) {
    const recommendationRows = Array.isArray(rebalanceRecommendationQueue) ? rebalanceRecommendationQueue : [];
    const loadRows = Array.isArray(triageLoadBalancer) ? triageLoadBalancer : [];
    const assignmentRows = Array.isArray(recoveryAssignmentBoard) ? recoveryAssignmentBoard : [];
    return recommendationRows.slice(0, 3).map((item, index) => ({
      owner: item.owner,
      status:
        item.recommendation === dashboardCopy("rebalance now", "立即重平衡")
          ? dashboardCopy("execution needed", "待执行")
          : dashboardCopy("tracking only", "跟踪观察"),
      action:
        assignmentRows[index]?.action ||
        item.recommendation,
      note:
        loadRows[index]?.note ||
        item.note ||
        dashboardCopy("No rebalance execution note yet.", "当前还没有重平衡执行备注。")
    }));
  }

  function buildWatchArchiveRescuedEvidenceOutcomesBridge(
    staleEvidenceRescuePlan,
    evidencePickupLog,
    evidenceAgingView
  ) {
    const rescueRows = Array.isArray(staleEvidenceRescuePlan) ? staleEvidenceRescuePlan : [];
    const pickupRows = Array.isArray(evidencePickupLog) ? evidencePickupLog : [];
    const agingRows = Array.isArray(evidenceAgingView) ? evidenceAgingView : [];
    return rescueRows.slice(0, 3).map((item, index) => ({
      item: item.item,
      outcome:
        item.urgency === dashboardCopy("on track", "正常推进")
          ? dashboardCopy("recovered", "已恢复")
          : dashboardCopy("under rescue", "抢救中"),
      action:
        pickupRows[index]?.action ||
        item.action,
      note:
        agingRows[index]?.note ||
        item.note ||
        dashboardCopy("No rescued evidence outcome note yet.", "当前还没有抢救后证据结果备注。")
    }));
  }

  function buildWatchArchiveStabilizationConfidenceBandBridge(
    shiftStabilizationBoard,
    shiftRiskPulse,
    closureReadinessScore
  ) {
    const score = Number(closureReadinessScore?.score || 0);
    return {
      band:
        shiftStabilizationBoard?.state === dashboardCopy("stabilized", "已稳定") && score >= 75
          ? dashboardCopy("high confidence", "高把握")
          : shiftRiskPulse?.risk === dashboardCopy("elevated", "升高")
            ? dashboardCopy("guarded confidence", "谨慎把握")
            : dashboardCopy("moderate confidence", "中等把握"),
      score: `${score}%`,
      summary:
        shiftStabilizationBoard?.summary ||
        shiftRiskPulse?.summary ||
        dashboardCopy("No stabilization confidence summary yet.", "当前还没有稳定把握带摘要。")
    };
  }

  function buildWatchArchiveExecutionDriftAlertsBridge(
    rebalanceExecutionTracker,
    rebalanceRecommendationQueue,
    assignmentSlaRails
  ) {
    const executionRows = Array.isArray(rebalanceExecutionTracker) ? rebalanceExecutionTracker : [];
    const recommendationRows = Array.isArray(rebalanceRecommendationQueue) ? rebalanceRecommendationQueue : [];
    const railRows = Array.isArray(assignmentSlaRails) ? assignmentSlaRails : [];
    return executionRows.slice(0, 3).map((item, index) => ({
      owner: item.owner,
      drift:
        item.status === dashboardCopy("execution needed", "待执行")
          ? dashboardCopy("drift alert", "漂移提醒")
          : dashboardCopy("on plan", "按计划推进"),
      action:
        recommendationRows[index]?.recommendation ||
        item.action,
      note:
        railRows[index]?.note ||
        item.note ||
        dashboardCopy("No execution drift note yet.", "当前还没有执行漂移备注。")
    }));
  }

  function buildWatchArchiveEvidenceRecoveryScoreboardBridge(
    rescuedEvidenceOutcomes,
    evidenceSufficiencyMeter,
    signoffEvidenceWallet
  ) {
    const outcomeRows = Array.isArray(rescuedEvidenceOutcomes) ? rescuedEvidenceOutcomes : [];
    const recovered = outcomeRows.filter(
      (item) => item.outcome === dashboardCopy("recovered", "已恢复")
    ).length;
    return {
      recovered,
      total: outcomeRows.length,
      meter: evidenceSufficiencyMeter?.meter || 0,
      summary: dashboardCopy(
        `${recovered}/${outcomeRows.length || 0} rescued evidence lanes are recovered, with ${signoffEvidenceWallet?.evidence_count || 0} evidence anchors on hand.`,
        `当前已有 ${recovered}/${outcomeRows.length || 0} 条抢救证据通道恢复，可用证据锚点共 ${signoffEvidenceWallet?.evidence_count || 0} 条。`
      )
    };
  }

  function buildWatchArchiveStabilizationWatchlistBridge(
    stabilizationConfidenceBand,
    shiftRiskPulse,
    shiftStabilizationBoard
  ) {
    return [
      {
        lane: dashboardCopy("stabilization confidence", "稳定把握"),
        status: stabilizationConfidenceBand?.band || dashboardCopy("unknown", "未知"),
        focus:
          stabilizationConfidenceBand?.score ||
          dashboardCopy("No stabilization score yet.", "当前还没有稳定得分。"),
        note:
          stabilizationConfidenceBand?.summary ||
          dashboardCopy("No stabilization confidence note yet.", "当前还没有稳定观察备注。")
      },
      {
        lane: dashboardCopy("shift risk pulse", "交班风险脉冲"),
        status: shiftRiskPulse?.risk || dashboardCopy("unknown", "未知"),
        focus:
          shiftRiskPulse?.coverage ||
          dashboardCopy("No shift continuity focus yet.", "当前还没有交班连续性关注点。"),
        note:
          shiftRiskPulse?.summary ||
          dashboardCopy("No shift risk pulse note yet.", "当前还没有交班风险备注。")
      },
      {
        lane: dashboardCopy("stabilization board", "稳定板"),
        status: shiftStabilizationBoard?.state || dashboardCopy("unknown", "未知"),
        focus:
          shiftStabilizationBoard?.handoff ||
          dashboardCopy("No stabilization handoff focus yet.", "当前还没有稳定交班关注点。"),
        note:
          shiftStabilizationBoard?.summary ||
          dashboardCopy("No stabilization board note yet.", "当前还没有稳定板备注。")
      }
    ];
  }

  global.buildWatchArchiveEvidenceAgingViewBridge = buildWatchArchiveEvidenceAgingViewBridge;
  global.buildWatchArchiveShiftRiskPulseBridge = buildWatchArchiveShiftRiskPulseBridge;
  global.buildWatchArchiveRebalanceRecommendationQueueBridge = buildWatchArchiveRebalanceRecommendationQueueBridge;
  global.buildWatchArchiveStaleEvidenceRescuePlanBridge = buildWatchArchiveStaleEvidenceRescuePlanBridge;
  global.buildWatchArchiveShiftStabilizationBoardBridge = buildWatchArchiveShiftStabilizationBoardBridge;
  global.buildWatchArchiveRebalanceExecutionTrackerBridge = buildWatchArchiveRebalanceExecutionTrackerBridge;
  global.buildWatchArchiveRescuedEvidenceOutcomesBridge = buildWatchArchiveRescuedEvidenceOutcomesBridge;
  global.buildWatchArchiveStabilizationConfidenceBandBridge = buildWatchArchiveStabilizationConfidenceBandBridge;
  global.buildWatchArchiveExecutionDriftAlertsBridge = buildWatchArchiveExecutionDriftAlertsBridge;
  global.buildWatchArchiveEvidenceRecoveryScoreboardBridge = buildWatchArchiveEvidenceRecoveryScoreboardBridge;
  global.buildWatchArchiveStabilizationWatchlistBridge = buildWatchArchiveStabilizationWatchlistBridge;
})(globalThis);
