function buildWatchArchiveReopenPreventionHintsBridge(diagnostics, bestKnownResolutions) {
  const hints = [];
  if (Array.isArray(diagnostics) && diagnostics.length) {
    hints.push({
      label: dashboardCopy("Re-check closure evidence before closing", "结案前再次检查关闭依据"),
      detail: dashboardCopy(
        "Recent reopened cases suggest that owner, confidence, or the chosen resolution pattern may not have been strong enough at close time.",
        "最近的 reopened 案件说明，结案时的负责人、置信度或解决模式可能还不够扎实。"
      )
    });
  }
  const best = Array.isArray(bestKnownResolutions) ? bestKnownResolutions[0] : null;
  if (best) {
    hints.push({
      label: dashboardCopy("Reuse the strongest known resolution path", "优先复用最强已知解决路径"),
      detail: dashboardCopy(
        `Start from ${best.label} before inventing a new close path.`,
        `在尝试新的结案路径前，先从 ${best.label} 这条已知最优路径开始。`
      )
    });
  }
  if (!hints.length) {
    hints.push({
      label: dashboardCopy("Capture a stronger close summary", "记录更扎实的结案摘要"),
      detail: dashboardCopy(
        "When in doubt, close with a clearer summary so the next reopen review has more context.",
        "如果不确定，就先写更清晰的结案摘要，这样即使 reopen，后续复核也更有上下文。"
      )
    });
  }
  return hints;
}

function buildWatchArchiveCaseExportBundleBridge(cases, statusBoard, priorityQueue, handoffSuggestions) {
  return {
    schema: "cssmv.watch_archive_case_export_bundle.v1",
    exported_at: new Date().toISOString(),
    status_board: statusBoard,
    priority_queue: Array.isArray(priorityQueue) ? priorityQueue : [],
    handoff_suggestions: Array.isArray(handoffSuggestions) ? handoffSuggestions : [],
    cases: Array.isArray(cases) ? cases : []
  };
}

function buildWatchArchiveOwnerInboxDigestBridge(inboxLane) {
  return {
    schema: "cssmv.watch_archive_owner_inbox_digest.v1",
    generated_at: new Date().toISOString(),
    owners: Array.isArray(inboxLane)
      ? inboxLane.map((owner) => ({
          owner: owner.owner,
          item_count: Array.isArray(owner.items) ? owner.items.length : 0,
          items: Array.isArray(owner.items) ? owner.items : []
        }))
      : []
  };
}

function buildWatchArchiveReopenRootCauseNotesBridge(cases) {
  return (Array.isArray(cases) ? cases : [])
    .filter((item) => item?.status === "reopened")
    .map((item) => {
      const history = Array.isArray(item?.history) ? item.history : [];
      const reopenedEntry = history.find((entry) => String(entry?.action || "").includes("reopened"));
      const routedEntry = history.find((entry) => String(entry?.action || "").includes("routed"));
      const closedEntry = history.find((entry) => String(entry?.action || "").includes("closed"));
      return {
        id: item.id,
        title: item.title || item.id,
        root_cause_note: dashboardCopy(
          `Likely reopen drivers: ${closedEntry ? "close summary may have been incomplete" : "closure evidence missing"}, ${routedEntry ? "ownership changed during handling" : "ownership stayed static"}, confidence=${item?.confidence || 0}%.`,
          `可能的 reopen 原因：${closedEntry ? "结案摘要可能不够完整" : "缺少结案依据"}，${routedEntry ? "处理中发生过负责人变化" : "负责人未变化"}，置信度=${item?.confidence || 0}%。`
        ),
        last_reopen_at: reopenedEntry?.at || "",
        latest_note: String(reopenedEntry?.note || "")
      };
    });
}

function buildWatchArchiveReopenTrendCardsBridge(artifacts, reopenNotes) {
  const artifactRows = Array.isArray(artifacts) ? artifacts : [];
  const noteRows = Array.isArray(reopenNotes) ? reopenNotes : [];
  const recentArtifacts = artifactRows.slice(0, 5);
  return [
    {
      label: dashboardCopy("Recent reopen count", "最近 reopen 数量"),
      summary: dashboardCopy(
        `${noteRows.length} reopened case note(s) are active right now.`,
        `当前有 ${noteRows.length} 条 reopened 案件根因备注。`
      )
    },
    {
      label: dashboardCopy("Export artifact momentum", "导出资产趋势"),
      summary: dashboardCopy(
        `${recentArtifacts.length} archive artifact(s) saved in the recent shelf.`,
        `最近档案架中已保存 ${recentArtifacts.length} 份资产。`
      )
    }
  ];
}

function buildWatchArchiveTimelineMergeBridge(artifacts, inboxHistory, reopenNotes) {
  const rows = [
    ...(Array.isArray(artifacts)
      ? artifacts.map((item) => ({
          kind: item.kind || "case_export_bundle",
          at: item.saved_at || "",
          summary: dashboardCopy(`Saved ${item.kind || "artifact"} export`, `已保存 ${item.kind || "资产"} 导出`)
        }))
      : []),
    ...(Array.isArray(inboxHistory)
      ? inboxHistory.map((item) => ({
          kind: "owner_inbox_digest",
          at: item.saved_at || "",
          summary: dashboardCopy("Saved owner inbox digest", "已保存负责人收件箱摘要")
        }))
      : []),
    ...(Array.isArray(reopenNotes)
      ? reopenNotes.map((item) => ({
          kind: "reopen_root_cause",
          at: item.last_reopen_at || "",
          summary: dashboardCopy(`Reopen note for ${item.title}`, `${item.title} 的 reopen 根因备注`)
        }))
      : [])
  ];
  return rows
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 12);
}

function buildWatchArchiveTrendCompareCardsBridge(artifacts, inboxHistory, reopenNotes) {
  const artifactCount = Array.isArray(artifacts) ? artifacts.length : 0;
  const inboxCount = Array.isArray(inboxHistory) ? inboxHistory.length : 0;
  const reopenCount = Array.isArray(reopenNotes) ? reopenNotes.length : 0;
  return [
    {
      label: dashboardCopy("Export vs inbox trend", "导出与收件箱趋势"),
      summary: dashboardCopy(
        `case exports=${artifactCount}, inbox digests=${inboxCount}`,
        `案件导出=${artifactCount}，收件箱摘要=${inboxCount}`
      )
    },
    {
      label: dashboardCopy("Reopen pressure trend", "Reopen 压力趋势"),
      summary: dashboardCopy(`active reopen notes=${reopenCount}`, `当前活跃 reopen 备注=${reopenCount}`)
    }
  ];
}

function buildWatchArchiveWeeklyOpsDigestDraftBridge(statusBoard, artifacts, inboxHistory, reopenNotes) {
  return {
    schema: "cssmv.watch_archive_weekly_ops_digest.v1",
    generated_at: new Date().toISOString(),
    summary: dashboardCopy(
      "Weekly ops digest draft for delivery and operations leads.",
      "面向交付与运营负责人的周运营摘要草稿。"
    ),
    case_status_board: statusBoard,
    case_exports: Array.isArray(artifacts) ? artifacts.length : 0,
    inbox_digests: Array.isArray(inboxHistory) ? inboxHistory.length : 0,
    reopen_notes: Array.isArray(reopenNotes) ? reopenNotes.length : 0
  };
}

function buildWatchArchiveExecutiveSnapshotCardsBridge(statusBoard, reopenNotes, trendCards) {
  const board = statusBoard || {};
  const reopenCount = Array.isArray(reopenNotes) ? reopenNotes.length : 0;
  return [
    {
      label: dashboardCopy("Open delivery risk", "开放交付风险"),
      summary: dashboardCopy(
        `open=${board.open || 0}, in_progress=${board.in_progress || 0}, reopened=${board.reopened || 0}`,
        `open=${board.open || 0}，in_progress=${board.in_progress || 0}，reopened=${board.reopened || 0}`
      )
    },
    {
      label: dashboardCopy("Reopen pressure", "Reopen 压力"),
      summary: dashboardCopy(`${reopenCount} active reopen note(s)`, `${reopenCount} 条活跃 reopen 备注`)
    },
    {
      label: dashboardCopy("Trend headline", "趋势主结论"),
      summary: Array.isArray(trendCards) && trendCards.length
        ? trendCards[0].summary
        : dashboardCopy("Trend cards will appear after history accumulates.", "历史积累后这里会出现趋势结论。")
    }
  ];
}

window.buildWatchArchiveReopenPreventionHintsBridge = buildWatchArchiveReopenPreventionHintsBridge;
window.buildWatchArchiveCaseExportBundleBridge = buildWatchArchiveCaseExportBundleBridge;
window.buildWatchArchiveOwnerInboxDigestBridge = buildWatchArchiveOwnerInboxDigestBridge;
window.buildWatchArchiveReopenRootCauseNotesBridge = buildWatchArchiveReopenRootCauseNotesBridge;
window.buildWatchArchiveReopenTrendCardsBridge = buildWatchArchiveReopenTrendCardsBridge;
window.buildWatchArchiveTimelineMergeBridge = buildWatchArchiveTimelineMergeBridge;
window.buildWatchArchiveTrendCompareCardsBridge = buildWatchArchiveTrendCompareCardsBridge;
window.buildWatchArchiveWeeklyOpsDigestDraftBridge = buildWatchArchiveWeeklyOpsDigestDraftBridge;
window.buildWatchArchiveExecutiveSnapshotCardsBridge = buildWatchArchiveExecutiveSnapshotCardsBridge;
