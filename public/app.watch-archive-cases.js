function buildWatchFixForwardSuggestionsBridge(motifs, heatmap, recommendations) {
  const suggestions = [];
  const motif = Array.isArray(motifs) ? motifs[0] : null;
  const hottest = Array.isArray(heatmap) ? heatmap[0] : null;
  if (motif && motif.risk_level !== "high") {
    suggestions.push({
      label: dashboardCopy("Prefer fix-forward on the repeated motif", "优先对重复模式做 fix-forward"),
      summary: dashboardCopy(
        "The pattern repeats, but the current risk is not the highest tier. Try narrowing the class and shipping a focused fix-forward pass first.",
        "这个模式虽然重复出现，但当前风险还不是最高档。建议先缩小分类范围，走一次聚焦式 fix-forward。"
      ),
      stance: "fix-forward"
    });
  }
  if (hottest && hottest.intensity === "high") {
    suggestions.push({
      label: dashboardCopy("Prepare rollback if the hottest class keeps growing", "如果最热分类继续扩大，就准备回滚"),
      summary: dashboardCopy(
        `${hottest.incident_class} already has high archive intensity. If the next snapshot adds more flags, rollback becomes more attractive.`,
        `${hottest.incident_class} 的档案热度已经很高。如果下一份快照继续增加标记，回滚会更值得考虑。`
      ),
      stance: "watch-then-rollback"
    });
  }
  if (!suggestions.length) {
    const recommendation = Array.isArray(recommendations) ? recommendations[0] : null;
    suggestions.push({
      label: dashboardCopy("Start with guided fix-forward", "先走引导式 fix-forward"),
      summary: recommendation?.reason || dashboardCopy(
        "Use the archive recommendation lane to narrow the target first, then decide whether rollback is still necessary.",
        "先用档案推荐线缩小目标，再判断是否真的需要回滚。"
      ),
      stance: "fix-forward"
    });
  }
  return suggestions;
}

function buildWatchIncidentDecisionMemoBridge(triage, confidenceScores, fixForwardSuggestions) {
  const topTriage = Array.isArray(triage) ? triage[0] : null;
  const topConfidence = Array.isArray(confidenceScores) ? confidenceScores[0] : null;
  const topSuggestion = Array.isArray(fixForwardSuggestions) ? fixForwardSuggestions[0] : null;
  return {
    schema: "cssmv.watch_incident_decision_memo.v1",
    headline: topSuggestion?.label || dashboardCopy("Archive decision memo", "档案决策备忘"),
    triage_step: topTriage?.step || dashboardCopy("Review the latest archive lane first", "先查看最新档案线索"),
    confidence: typeof topConfidence?.confidence === "number" ? Math.round(topConfidence.confidence * 100) : 0,
    recommendation:
      topSuggestion?.summary ||
      dashboardCopy(
        "Use the archive guidance to narrow the issue before choosing rollback.",
        "先用档案引导缩小问题范围，再决定是否回滚。"
      ),
    stance: topSuggestion?.stance || "fix-forward",
    generated_at: new Date().toISOString()
  };
}

function buildWatchAssigneeHandoffBridge(assignee, memo, playbookLinks) {
  return {
    schema: "cssmv.watch_archive_assignee_handoff.v1",
    assignee: String(assignee || "").trim() || dashboardCopy("unassigned", "未指派"),
    memo_headline: memo?.headline || "",
    next_step: memo?.triage_step || "",
    recommended_stance: memo?.stance || "fix-forward",
    playbook_links: Array.isArray(playbookLinks)
      ? playbookLinks.slice(0, 3).map((item) => ({
          label: item.label,
          detail: item.detail
        }))
      : [],
    handed_off_at: new Date().toISOString()
  };
}

function buildWatchArchiveOutcomeSummaryBridge(outcomes) {
  const rows = Array.isArray(outcomes) ? outcomes : [];
  const fixForwardCount = rows.filter((item) => item?.decision === "fix-forward").length;
  const rollbackCount = rows.filter((item) => item?.decision === "rollback").length;
  const watchCount = rows.filter((item) => item?.decision === "watch").length;
  return {
    total: rows.length,
    fix_forward: fixForwardCount,
    rollback: rollbackCount,
    watch: watchCount
  };
}

function buildWatchArchiveCaseStatusBoardBridge(cases) {
  const rows = Array.isArray(cases) ? cases : [];
  return {
    total: rows.length,
    open: rows.filter((item) => item?.status === "open").length,
    in_progress: rows.filter((item) => item?.status === "in_progress").length,
    closed: rows.filter((item) => item?.status === "closed").length,
    reopened: rows.filter((item) => item?.status === "reopened").length
  };
}

function buildWatchArchiveCaseFromMemoBridge(memo, handoff, existingCases) {
  const prior = Array.isArray(existingCases) ? existingCases : [];
  return {
    id: `archive_case_${Date.now()}`,
    title: memo?.headline || dashboardCopy("Archive case", "档案案件"),
    assignee: handoff?.assignee || dashboardCopy("unassigned", "未指派"),
    status: "open",
    stance: memo?.stance || "fix-forward",
    next_step: memo?.triage_step || "",
    confidence: memo?.confidence || 0,
    created_at: new Date().toISOString(),
    history: [
      {
        at: new Date().toISOString(),
        action: "case_opened",
        note: memo?.recommendation || ""
      }
    ],
    related_case_count: prior.length
  };
}

window.buildWatchFixForwardSuggestionsBridge = buildWatchFixForwardSuggestionsBridge;
window.buildWatchIncidentDecisionMemoBridge = buildWatchIncidentDecisionMemoBridge;
window.buildWatchAssigneeHandoffBridge = buildWatchAssigneeHandoffBridge;
window.buildWatchArchiveOutcomeSummaryBridge = buildWatchArchiveOutcomeSummaryBridge;
window.buildWatchArchiveCaseStatusBoardBridge = buildWatchArchiveCaseStatusBoardBridge;
window.buildWatchArchiveCaseFromMemoBridge = buildWatchArchiveCaseFromMemoBridge;
