function buildWatchArchiveActionOwnerCommitmentsBridge(inboxLane, actionPlan) {
  const owners = Array.isArray(inboxLane) ? inboxLane : [];
  const actions = Array.isArray(actionPlan?.actions) ? actionPlan.actions : [];
  return actions.slice(0, 3).map((item, index) => ({
    owner: owners[index % Math.max(owners.length, 1)]?.owner || dashboardCopy("unassigned", "未指派"),
    commitment: item,
    due_window: dashboardCopy("next week", "下周")
  }));
}

function buildWatchArchiveMeetingOutcomeLedgerBridge(briefing, notesDraft, commitments, existingLedger) {
  const ledger = Array.isArray(existingLedger) ? existingLedger : [];
  return [
    {
      id: `meeting_outcome_${Date.now()}`,
      at: new Date().toISOString(),
      headline: briefing?.headline || dashboardCopy("meeting outcome", "会议结果"),
      agenda: notesDraft?.agenda || "",
      commitment_count: Array.isArray(commitments) ? commitments.length : 0
    },
    ...ledger
  ].slice(0, 20);
}

function buildWatchArchiveOverdueFollowupsBridge(followups, ledger) {
  const outcomeCount = Array.isArray(ledger) ? ledger.length : 0;
  return (Array.isArray(followups) ? followups : [])
    .filter((item, index) => item?.status === "pending" && (item?.severity === "high" || index >= outcomeCount))
    .map((item) => ({
      ...item,
      overdue_reason: dashboardCopy(
        "Still pending after the latest meeting outcome cycle.",
        "在最近一次会议结果记录后仍然处于待处理状态。"
      )
    }));
}

function buildWatchArchiveCommitmentSlipAlertsBridge(commitments, ledger) {
  const outcomeCount = Array.isArray(ledger) ? ledger.length : 0;
  return (Array.isArray(commitments) ? commitments : [])
    .filter((_, index) => index >= outcomeCount)
    .map((item, index) => ({
      label: dashboardCopy(`Commitment slip ${index + 1}`, `承诺滑坡 ${index + 1}`),
      summary: dashboardCopy(
        `${item.owner} still owns an unconfirmed commitment for ${item.due_window}.`,
        `${item.owner} 仍有一条未确认完成的 ${item.due_window} 承诺。`
      )
    }));
}

function buildWatchArchiveMonthlyReviewPackDraftBridge(executiveCards, trendCards, weeklyDigest, meetingLedger) {
  return {
    schema: "cssmv.watch_archive_monthly_review_pack.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Monthly review pack draft", "月度复盘包草稿"),
    executive_snapshot: Array.isArray(executiveCards) ? executiveCards : [],
    trend_compare: Array.isArray(trendCards) ? trendCards : [],
    weekly_digest_reference: weeklyDigest || null,
    meeting_outcome_count: Array.isArray(meetingLedger) ? meetingLedger.length : 0
  };
}

function buildWatchArchiveQuarterToDateScorecardsBridge(statusBoard, meetingLedger, monthlyReview, reopenNotes) {
  const board = statusBoard || {};
  const ledgerRows = Array.isArray(meetingLedger) ? meetingLedger : [];
  const reopenCount = Array.isArray(reopenNotes) ? reopenNotes.length : 0;
  return [
    {
      label: dashboardCopy("Quarter delivery throughput", "季度交付吞吐"),
      summary: dashboardCopy(
        `closed=${board.closed || 0}, in_progress=${board.in_progress || 0}, total=${board.total || 0}`,
        `closed=${board.closed || 0}，in_progress=${board.in_progress || 0}，total=${board.total || 0}`
      )
    },
    {
      label: dashboardCopy("Quarter decision follow-through", "季度决策兑现"),
      summary: dashboardCopy(
        `${ledgerRows.length} meeting outcome log(s) are captured in this quarter-to-date view.`,
        `当前季度视角下已记录 ${ledgerRows.length} 条会议结果台账。`
      )
    },
    {
      label: dashboardCopy("Quarter reopen pressure", "季度 Reopen 压力"),
      summary: dashboardCopy(
        `${reopenCount} reopen note(s) remain active in the current quarter-to-date signal.`,
        `当前季度信号里仍有 ${reopenCount} 条活跃 reopen 备注。`
      )
    },
    {
      label: dashboardCopy("Quarter review status", "季度复盘状态"),
      summary:
        String(monthlyReview?.headline || "").trim() ||
        dashboardCopy(
          "Monthly review context is waiting for more operating data.",
          "月度复盘上下文仍在等待更多经营数据。"
        )
    }
  ];
}

function buildWatchArchiveLeadershipRiskDigestBridge(executiveCards, thresholds, redFlags, overdueFollowups) {
  const alertCount = (Array.isArray(thresholds) ? thresholds : []).filter((item) => item?.state === "alert").length;
  const redFlagCount = Array.isArray(redFlags) ? redFlags.length : 0;
  const overdueCount = Array.isArray(overdueFollowups) ? overdueFollowups.length : 0;
  return {
    schema: "cssmv.watch_archive_leadership_risk_digest.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy(
      "Leadership risk digest for delivery, compliance, and execution pressure.",
      "面向管理层的交付、合规与执行压力风险摘要。"
    ),
    severity:
      redFlagCount > 0 || alertCount > 1 || overdueCount > 1
        ? "high"
        : alertCount > 0 || overdueCount > 0
          ? "medium"
          : "low",
    executive_headlines: Array.isArray(executiveCards) ? executiveCards.slice(0, 3) : [],
    risk_factors: [
      dashboardCopy(`alert thresholds=${alertCount}`, `告警阈值=${alertCount}`),
      dashboardCopy(`red flags=${redFlagCount}`, `红旗事项=${redFlagCount}`),
      dashboardCopy(`overdue follow-ups=${overdueCount}`, `超期跟进=${overdueCount}`)
    ],
    recommended_focus: dashboardCopy(
      "Review red flags first, then owner commitments, then reopen pressure.",
      "先看红旗事项，再看负责人承诺，最后看 reopen 压力。"
    )
  };
}

function buildWatchArchiveOperatingCadenceTemplateBridge(weeklyDigest, monthlyReview, quarterScorecards, nextWeekPlan) {
  return {
    schema: "cssmv.watch_archive_operating_cadence_template.v1",
    generated_at: new Date().toISOString(),
    weekly: {
      title: dashboardCopy("Weekly operating cadence", "每周经营节奏"),
      checkpoint:
        weeklyDigest?.summary ||
        dashboardCopy("Review weekly ops digest and owner commitments.", "检查周运营摘要和负责人承诺。")
    },
    monthly: {
      title: dashboardCopy("Monthly review cadence", "每月复盘节奏"),
      checkpoint:
        monthlyReview?.headline ||
        dashboardCopy("Review monthly pack, anomalies, and meeting outcomes.", "检查月度复盘包、异常与会议结果。")
    },
    quarterly: {
      title: dashboardCopy("Quarter-to-date cadence", "季度经营节奏"),
      checkpoint: dashboardCopy(
        `${Array.isArray(quarterScorecards) ? quarterScorecards.length : 0} scorecard lane(s) ready for leadership review.`,
        `已有 ${Array.isArray(quarterScorecards) ? quarterScorecards.length : 0} 条 scorecard 轨道可供管理层审阅。`
      )
    },
    next_cycle_start:
      Array.isArray(nextWeekPlan?.actions) && nextWeekPlan.actions.length
        ? nextWeekPlan.actions[0]
        : dashboardCopy("Keep the current cadence and refresh next-week actions.", "维持当前节奏，并刷新下周行动。")
  };
}

window.buildWatchArchiveActionOwnerCommitmentsBridge = buildWatchArchiveActionOwnerCommitmentsBridge;
window.buildWatchArchiveMeetingOutcomeLedgerBridge = buildWatchArchiveMeetingOutcomeLedgerBridge;
window.buildWatchArchiveOverdueFollowupsBridge = buildWatchArchiveOverdueFollowupsBridge;
window.buildWatchArchiveCommitmentSlipAlertsBridge = buildWatchArchiveCommitmentSlipAlertsBridge;
window.buildWatchArchiveMonthlyReviewPackDraftBridge = buildWatchArchiveMonthlyReviewPackDraftBridge;
window.buildWatchArchiveQuarterToDateScorecardsBridge = buildWatchArchiveQuarterToDateScorecardsBridge;
window.buildWatchArchiveLeadershipRiskDigestBridge = buildWatchArchiveLeadershipRiskDigestBridge;
window.buildWatchArchiveOperatingCadenceTemplateBridge = buildWatchArchiveOperatingCadenceTemplateBridge;
