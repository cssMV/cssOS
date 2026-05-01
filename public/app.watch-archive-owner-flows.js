function buildWatchArchiveOwnerHandoffSuggestionsBridge(cases, workload, rebalanceSuggestions) {
  const rows = [];
  const rebalance = Array.isArray(rebalanceSuggestions) ? rebalanceSuggestions[0] : null;
  if (rebalance) {
    const targetCases = (Array.isArray(cases) ? cases : [])
      .filter((item) => item?.assignee === rebalance.from_owner && item?.status !== "closed")
      .slice(0, 2);
    targetCases.forEach((item) => {
      rows.push({
        case_id: item.id,
        title: item.title || item.id,
        from_owner: rebalance.from_owner,
        to_owner: rebalance.to_owner,
        summary: dashboardCopy(
          `Hand off ${item.title || item.id} from ${rebalance.from_owner} to ${rebalance.to_owner}.`,
          `建议把 ${item.title || item.id} 从 ${rebalance.from_owner} 交给 ${rebalance.to_owner}。`
        )
      });
    });
  }
  if (!rows.length && Array.isArray(workload) && workload.length > 1) {
    const sorted = [...workload].sort((a, b) => b.total - a.total);
    rows.push({
      case_id: "",
      title: dashboardCopy("Manual workload review", "手动负载复核"),
      from_owner: sorted[0].owner,
      to_owner: sorted[sorted.length - 1].owner,
      summary: dashboardCopy(
        `No direct handoff is required yet, but review ${sorted[0].owner} vs ${sorted[sorted.length - 1].owner}.`,
        `当前还不需要直接交接，但建议复核 ${sorted[0].owner} 和 ${sorted[sorted.length - 1].owner} 的负载差异。`
      )
    });
  }
  return rows;
}

function buildWatchArchiveClosureReadinessChecklistBridge(cases, bestKnownResolutions) {
  return (Array.isArray(cases) ? cases : [])
    .filter((item) => item?.status !== "closed")
    .slice(0, 5)
    .map((item) => {
      const matchingPattern = (Array.isArray(bestKnownResolutions) ? bestKnownResolutions : []).find((row) =>
        String(row?.label || "").startsWith(String(item?.stance || ""))
      );
      const checklist = [
        {
          label: dashboardCopy("Owner assigned", "已分配负责人"),
          ready: !!String(item?.assignee || "").trim() && String(item.assignee) !== dashboardCopy("unassigned", "未指派")
        },
        {
          label: dashboardCopy("Confidence captured", "已记录置信度"),
          ready: Number(item?.confidence || 0) >= 50
        },
        {
          label: dashboardCopy("Known resolution path exists", "已有已知解决路径"),
          ready: !!matchingPattern
        }
      ];
      return {
        id: item.id,
        title: item.title || item.id,
        ready_count: checklist.filter((row) => row.ready).length,
        total_count: checklist.length,
        checklist
      };
    });
}

function buildWatchArchiveCloseSummaryBridge(entry, bestKnownResolutions) {
  const pattern = (Array.isArray(bestKnownResolutions) ? bestKnownResolutions : []).find((row) =>
    String(row?.label || "").startsWith(String(entry?.stance || ""))
  );
  return dashboardCopy(
    `Closed with stance=${entry?.stance || "fix-forward"}, confidence=${entry?.confidence || 0}%, pattern=${pattern?.label || "none"}.`,
    `以 ${entry?.stance || "fix-forward"} 方案结案，置信度 ${entry?.confidence || 0}% ，参考模式 ${pattern?.label || "无" }。`
  );
}

function buildWatchArchiveReopenedDiagnosticsBridge(cases) {
  return (Array.isArray(cases) ? cases : [])
    .filter((item) => item?.status === "reopened")
    .map((item) => {
      const lastHistory = Array.isArray(item?.history) ? item.history[0] : null;
      return {
        id: item.id,
        title: item.title || item.id,
        summary: dashboardCopy(
          `Reopened after ${lastHistory?.action || "status change"}; review owner, confidence, and the original stance again.`,
          `在 ${lastHistory?.action || "状态变更"} 后被重新打开；请重新检查负责人、置信度和原始处置立场。`
        ),
        note: String(lastHistory?.note || "")
      };
    });
}

function buildWatchArchiveInboxLaneBridge(cases) {
  const rows = new Map();
  (Array.isArray(cases) ? cases : [])
    .filter((item) => item?.status !== "closed")
    .forEach((item) => {
      const owner = String(item?.assignee || dashboardCopy("unassigned", "未指派"));
      const current = rows.get(owner) || {
        owner,
        items: []
      };
      current.items.push({
        id: item.id,
        title: item.title || item.id,
        status: item.status || "open",
        confidence: item.confidence || 0
      });
      rows.set(owner, current);
    });
  return Array.from(rows.values())
    .map((item) => ({
      ...item,
      items: item.items.slice(0, 4)
    }))
    .sort((a, b) => b.items.length - a.items.length);
}

window.buildWatchArchiveOwnerHandoffSuggestionsBridge = buildWatchArchiveOwnerHandoffSuggestionsBridge;
window.buildWatchArchiveClosureReadinessChecklistBridge = buildWatchArchiveClosureReadinessChecklistBridge;
window.buildWatchArchiveCloseSummaryBridge = buildWatchArchiveCloseSummaryBridge;
window.buildWatchArchiveReopenedDiagnosticsBridge = buildWatchArchiveReopenedDiagnosticsBridge;
window.buildWatchArchiveInboxLaneBridge = buildWatchArchiveInboxLaneBridge;
