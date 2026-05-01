function buildWatchArchiveQuarterTrendDeltaCardsBridge(trendCards, quarterScorecards, overdueFollowups) {
  const trendRows = Array.isArray(trendCards) ? trendCards : [];
  const quarterRows = Array.isArray(quarterScorecards) ? quarterScorecards : [];
  const overdueCount = Array.isArray(overdueFollowups) ? overdueFollowups.length : 0;
  return [
    {
      label: dashboardCopy("Quarter signal breadth", "季度信号覆盖"),
      summary: dashboardCopy(
        `${quarterRows.length} quarter-to-date lane(s) are now visible to leadership review.`,
        `当前已有 ${quarterRows.length} 条季度轨道可供管理层审阅。`
      )
    },
    {
      label: dashboardCopy("Trend carry-forward", "趋势延续性"),
      summary: trendRows.length
        ? dashboardCopy(`Top carry-forward signal: ${trendRows[0].summary}`, `首要延续趋势：${trendRows[0].summary}`)
        : dashboardCopy(
            "Trend carry-forward will appear after archive history accumulates.",
            "当档案历史积累后，这里会出现趋势延续结论。"
          )
    },
    {
      label: dashboardCopy("Quarter execution drag", "季度执行拖拽"),
      summary: dashboardCopy(
        `${overdueCount} overdue follow-up item(s) are currently slowing quarter execution.`,
        `当前有 ${overdueCount} 条超期跟进在拖慢季度执行。`
      )
    }
  ];
}

function buildWatchArchiveRevenueRiskBridgeBridge(
  leadershipRiskDigest,
  statusBoard,
  overdueFollowups,
  commitmentSlipAlerts
) {
  const board = statusBoard || {};
  const overdueCount = Array.isArray(overdueFollowups) ? overdueFollowups.length : 0;
  const slipCount = Array.isArray(commitmentSlipAlerts) ? commitmentSlipAlerts.length : 0;
  const openExposure = (board.open || 0) + (board.reopened || 0);
  const riskPoints = openExposure * 3 + overdueCount * 5 + slipCount * 4;
  return {
    schema: "cssmv.watch_archive_revenue_risk_bridge.v1",
    generated_at: new Date().toISOString(),
    exposure_points: riskPoints,
    severity: leadershipRiskDigest?.severity || "low",
    summary: dashboardCopy(
      `Revenue pressure proxy = ${riskPoints} points from open exposure=${openExposure}, overdue=${overdueCount}, slips=${slipCount}.`,
      `收益压力代理值 = ${riskPoints} 分，来源于开放暴露=${openExposure}、超期=${overdueCount}、滑坡=${slipCount}。`
    ),
    operator_note: dashboardCopy(
      "This is not booked revenue. It is a management proxy for where delayed execution is most likely to hurt platform throughput and monetization.",
      "这不是已入账收入，而是一个管理代理指标，用来判断哪些延迟执行最可能伤害平台吞吐和变现。"
    )
  };
}

function buildWatchArchiveCadenceAdherenceTrackerBridge(
  operatingCadenceTemplate,
  meetingLedger,
  overdueFollowups
) {
  const ledgerCount = Array.isArray(meetingLedger) ? meetingLedger.length : 0;
  const overdueCount = Array.isArray(overdueFollowups) ? overdueFollowups.length : 0;
  return [
    {
      lane: dashboardCopy("Weekly cadence", "每周节奏"),
      state: ledgerCount > 0 ? "on_track" : "watch",
      summary:
        operatingCadenceTemplate?.weekly?.checkpoint ||
        dashboardCopy("Weekly checkpoint is waiting.", "每周检查点仍在等待。")
    },
    {
      lane: dashboardCopy("Monthly cadence", "每月节奏"),
      state: overdueCount > 1 ? "at_risk" : "on_track",
      summary:
        operatingCadenceTemplate?.monthly?.checkpoint ||
        dashboardCopy("Monthly checkpoint is waiting.", "每月检查点仍在等待。")
    },
    {
      lane: dashboardCopy("Quarter cadence", "季度节奏"),
      state: overdueCount > 0 ? "watch" : "on_track",
      summary:
        operatingCadenceTemplate?.quarterly?.checkpoint ||
        dashboardCopy("Quarter checkpoint is waiting.", "季度检查点仍在等待。")
    }
  ];
}

function buildWatchArchiveMarginPressureCardsBridge(
  revenueRiskBridge,
  cadenceAdherence,
  leadershipRiskDigest
) {
  const cadenceRows = Array.isArray(cadenceAdherence) ? cadenceAdherence : [];
  const atRiskCadence = cadenceRows.filter((item) => ["watch", "at_risk"].includes(String(item?.state || ""))).length;
  const exposure = Number(revenueRiskBridge?.exposure_points || 0);
  const severity = String(leadershipRiskDigest?.severity || "low");
  return [
    {
      label: dashboardCopy("Execution margin pressure", "执行利润压力"),
      summary: dashboardCopy(
        `Exposure=${exposure} with ${atRiskCadence} cadence lane(s) under watch.`,
        `暴露值=${exposure}，且有 ${atRiskCadence} 条经营节奏轨道处于观察态。`
      )
    },
    {
      label: dashboardCopy("Leadership risk carry cost", "管理层风险携带成本"),
      summary: dashboardCopy(
        `Leadership digest severity is ${severity.toUpperCase()}, which implies higher management overhead before monetization can recover.`,
        `管理层风险摘要当前为 ${severity.toUpperCase()}，这意味着在恢复变现前会承担更高的管理开销。`
      )
    },
    {
      label: dashboardCopy("Cadence drag on margin", "经营节奏对利润的拖累"),
      summary: dashboardCopy(
        `${atRiskCadence} cadence lane(s) are likely stretching turnaround time and reducing delivery efficiency.`,
        `${atRiskCadence} 条经营节奏轨道可能正在拉长周转时间并降低交付效率。`
      )
    }
  ];
}

window.buildWatchArchiveQuarterTrendDeltaCardsBridge = buildWatchArchiveQuarterTrendDeltaCardsBridge;
window.buildWatchArchiveRevenueRiskBridgeBridge = buildWatchArchiveRevenueRiskBridgeBridge;
window.buildWatchArchiveCadenceAdherenceTrackerBridge = buildWatchArchiveCadenceAdherenceTrackerBridge;
window.buildWatchArchiveMarginPressureCardsBridge = buildWatchArchiveMarginPressureCardsBridge;
