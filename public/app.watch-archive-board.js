function buildWatchArchiveAnomalyWatchThresholdsBridge(statusBoard, reopenNotes) {
  const board = statusBoard || {};
  const reopenCount = Array.isArray(reopenNotes) ? reopenNotes.length : 0;
  return [
    {
      label: dashboardCopy("Reopen threshold", "Reopen 阈值"),
      state: reopenCount >= 2 ? "alert" : "normal",
      summary: dashboardCopy(
        `alert when reopen notes >= 2, current=${reopenCount}`,
        `当 reopen 备注 >= 2 时告警，当前=${reopenCount}`
      )
    },
    {
      label: dashboardCopy("Open-case threshold", "开放案件阈值"),
      state: (board.open || 0) + (board.reopened || 0) >= 5 ? "alert" : "normal",
      summary: dashboardCopy(
        `alert when open + reopened >= 5, current=${(board.open || 0) + (board.reopened || 0)}`,
        `当 open + reopened >= 5 时告警，当前=${(board.open || 0) + (board.reopened || 0)}`
      )
    }
  ];
}

function buildWatchArchiveNextWeekActionPlanDraftBridge(statusBoard, thresholds, handoffSuggestions) {
  const actions = [];
  const alerting = (Array.isArray(thresholds) ? thresholds : []).filter((item) => item.state === "alert");
  if (alerting.length) {
    actions.push(
      dashboardCopy(
        "Review alerting thresholds first and assign an owner to the highest-risk queue.",
        "优先检查告警阈值，并给最高风险队列指定负责人。"
      )
    );
  }
  if (Array.isArray(handoffSuggestions) && handoffSuggestions.length) {
    actions.push(
      dashboardCopy(
        "Execute the suggested owner handoff for the busiest lane.",
        "执行当前最繁忙处理线的负责人交接建议。"
      )
    );
  }
  if ((statusBoard?.closed || 0) === 0) {
    actions.push(
      dashboardCopy(
        "Push at least one case to a clean close with summary next week.",
        "下周至少推动一条案件完成一次带摘要的干净结案。"
      )
    );
  }
  if (!actions.length) {
    actions.push(
      dashboardCopy(
        "Keep the current cadence and continue tracking weekly reopen pressure.",
        "维持当前节奏，并继续每周跟踪 reopen 压力。"
      )
    );
  }
  return {
    schema: "cssmv.watch_archive_next_week_action_plan.v1",
    generated_at: new Date().toISOString(),
    actions
  };
}

function buildWatchArchiveBoardReadyBriefingBridge(executiveCards, thresholds, weeklyDigest) {
  return {
    schema: "cssmv.watch_archive_board_ready_briefing.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Board-ready operations briefing", "可直接上会的运营简报"),
    executive_snapshot: Array.isArray(executiveCards) ? executiveCards : [],
    anomaly_thresholds: Array.isArray(thresholds) ? thresholds : [],
    weekly_digest: weeklyDigest || null
  };
}

function buildWatchArchiveRedFlagEscalationsBridge(thresholds, executiveCards) {
  const alerts = (Array.isArray(thresholds) ? thresholds : []).filter((item) => item.state === "alert");
  if (!alerts.length) {
    return [
      {
        label: dashboardCopy("No red flag yet", "当前没有红旗"),
        summary: dashboardCopy(
          "Current anomaly thresholds remain below the escalation line.",
          "当前异常阈值还没有越过升级线。"
        )
      }
    ];
  }
  return alerts.map((item, index) => ({
    label: dashboardCopy(`Red flag ${index + 1}: ${item.label}`, `红旗 ${index + 1}：${item.label}`),
    summary: item.summary,
    context: Array.isArray(executiveCards) && executiveCards[index] ? executiveCards[index].summary : ""
  }));
}

function buildWatchArchiveDecisionMeetingNotesDraftBridge(briefing, actionPlan, redFlags) {
  return {
    schema: "cssmv.watch_archive_decision_meeting_notes.v1",
    generated_at: new Date().toISOString(),
    agenda: dashboardCopy(
      "Review executive snapshot, confirm red flags, and approve next-week actions.",
      "审阅执行摘要、确认红旗项，并批准下周行动。"
    ),
    briefing_headline: briefing?.headline || "",
    red_flags: Array.isArray(redFlags) ? redFlags : [],
    next_week_actions: Array.isArray(actionPlan?.actions) ? actionPlan.actions : []
  };
}

function buildWatchArchiveDecisionFollowupTrackerBridge(actionPlan, redFlags) {
  const actions = Array.isArray(actionPlan?.actions) ? actionPlan.actions : [];
  return actions.map((item, index) => ({
    id: `followup_${index + 1}`,
    action: item,
    severity: Array.isArray(redFlags) && redFlags.length ? (index === 0 ? "high" : "medium") : "normal",
    status: "pending"
  }));
}

window.buildWatchArchiveAnomalyWatchThresholdsBridge = buildWatchArchiveAnomalyWatchThresholdsBridge;
window.buildWatchArchiveNextWeekActionPlanDraftBridge = buildWatchArchiveNextWeekActionPlanDraftBridge;
window.buildWatchArchiveBoardReadyBriefingBridge = buildWatchArchiveBoardReadyBriefingBridge;
window.buildWatchArchiveRedFlagEscalationsBridge = buildWatchArchiveRedFlagEscalationsBridge;
window.buildWatchArchiveDecisionMeetingNotesDraftBridge = buildWatchArchiveDecisionMeetingNotesDraftBridge;
window.buildWatchArchiveDecisionFollowupTrackerBridge = buildWatchArchiveDecisionFollowupTrackerBridge;
