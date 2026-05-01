function buildWatchArchiveCaseTimelineBridge(cases) {
  return (Array.isArray(cases) ? cases : [])
    .flatMap((entry) =>
      (Array.isArray(entry?.history) ? entry.history : []).map((item) => ({
        case_id: entry.id,
        case_title: entry.title,
        assignee: entry.assignee,
        status: entry.status,
        at: item.at,
        action: item.action,
        note: item.note
      }))
    )
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 12);
}

function buildWatchArchiveOwnerWorkloadBridge(cases) {
  const owners = new Map();
  (Array.isArray(cases) ? cases : []).forEach((entry) => {
    const owner = String(entry?.assignee || dashboardCopy("unassigned", "未指派"));
    const current = owners.get(owner) || {
      owner,
      total: 0,
      open: 0,
      in_progress: 0,
      reopened: 0,
      closed: 0
    };
    current.total += 1;
    if (entry?.status === "open") current.open += 1;
    else if (entry?.status === "in_progress") current.in_progress += 1;
    else if (entry?.status === "reopened") current.reopened += 1;
    else if (entry?.status === "closed") current.closed += 1;
    owners.set(owner, current);
  });
  return Array.from(owners.values()).sort(
    (a, b) => b.total - a.total || b.open + b.in_progress + b.reopened - (a.open + a.in_progress + a.reopened)
  );
}

function buildWatchArchiveResolutionPatternLibraryBridge(cases, outcomes) {
  const rows = new Map();
  (Array.isArray(cases) ? cases : []).forEach((entry) => {
    const key = `${entry?.stance || "fix-forward"}|${entry?.status || "open"}`;
    const current = rows.get(key) || {
      key,
      stance: entry?.stance || "fix-forward",
      status: entry?.status || "open",
      case_count: 0,
      sample_titles: []
    };
    current.case_count += 1;
    current.sample_titles.push(String(entry?.title || entry?.id || "case"));
    rows.set(key, current);
  });
  const outcomeRows = Array.isArray(outcomes) ? outcomes : [];
  return Array.from(rows.values())
    .map((item) => ({
      ...item,
      outcome_hits: outcomeRows.filter((row) => row?.decision === item.stance).length,
      closed_hits: (Array.isArray(cases) ? cases : []).filter(
        (entry) => entry?.stance === item.stance && entry?.status === "closed"
      ).length,
      summary: dashboardCopy(
        `${item.case_count} case(s), ${item.outcome_hits} matching outcome log(s)`,
        `${item.case_count} 个案件，${item.outcome_hits} 条匹配结果记录`
      ),
      sample_titles: item.sample_titles.slice(0, 3)
    }))
    .sort((a, b) => b.case_count - a.case_count || b.outcome_hits - a.outcome_hits);
}

function buildWatchArchiveSlaAtRiskCasesBridge(cases) {
  const now = Date.now();
  return (Array.isArray(cases) ? cases : [])
    .filter((entry) => entry?.status !== "closed")
    .map((entry) => {
      const startedAt = Date.parse(String(entry?.created_at || "")) || now;
      const ageHours = Math.max(0, Math.round((now - startedAt) / 36e5));
      const riskLevel =
        entry?.status === "reopened" || ageHours >= 48
          ? "high"
          : ageHours >= 24 || entry?.status === "open"
            ? "medium"
            : "low";
      return {
        id: entry?.id,
        title: entry?.title || entry?.id || "case",
        assignee: entry?.assignee || dashboardCopy("unassigned", "未指派"),
        status: entry?.status || "open",
        age_hours: ageHours,
        risk_level: riskLevel,
        summary: dashboardCopy(
          `${ageHours}h open with status ${entry?.status || "open"}`,
          `已持续 ${ageHours} 小时，状态为 ${entry?.status || "open"}`
        )
      };
    })
    .filter((entry) => entry.risk_level !== "low")
    .sort((a, b) => {
      const riskWeight = { high: 2, medium: 1, low: 0 };
      return riskWeight[b.risk_level] - riskWeight[a.risk_level] || b.age_hours - a.age_hours;
    });
}

function buildWatchArchiveOwnerRebalanceSuggestionsBridge(workload) {
  const rows = Array.isArray(workload) ? workload : [];
  if (rows.length < 2) return [];
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const busiest = sorted[0];
  const lightest = sorted[sorted.length - 1];
  const activeBusiest = busiest.open + busiest.in_progress + busiest.reopened;
  const activeLightest = lightest.open + lightest.in_progress + lightest.reopened;
  if (activeBusiest - activeLightest < 2) return [];
  return [
    {
      from_owner: busiest.owner,
      to_owner: lightest.owner,
      summary: dashboardCopy(
        `Rebalance from ${busiest.owner} to ${lightest.owner}; active load delta is ${activeBusiest - activeLightest}.`,
        `建议从 ${busiest.owner} 重新分配到 ${lightest.owner}；活跃负载差值为 ${activeBusiest - activeLightest}。`
      )
    }
  ];
}

function buildWatchArchiveBestKnownResolutionCardsBridge(patterns) {
  return (Array.isArray(patterns) ? patterns : [])
    .filter((item) => item.closed_hits > 0 || item.outcome_hits > 0)
    .sort((a, b) => b.closed_hits + b.outcome_hits - (a.closed_hits + a.outcome_hits))
    .slice(0, 3)
    .map((item) => ({
      label: dashboardCopy(`${item.stance} -> ${item.status}`, `${item.stance} -> ${item.status}`),
      summary: dashboardCopy(
        `Closed hits=${item.closed_hits}, outcome matches=${item.outcome_hits}.`,
        `关闭命中=${item.closed_hits}，结果匹配=${item.outcome_hits}。`
      ),
      examples: item.sample_titles
    }));
}

function buildWatchArchiveAutoPriorityQueueBridge(cases, atRiskCases) {
  const riskMap = new Map((Array.isArray(atRiskCases) ? atRiskCases : []).map((item) => [item.id, item]));
  return (Array.isArray(cases) ? cases : [])
    .filter((item) => item?.status !== "closed")
    .map((item) => {
      const risk = riskMap.get(item.id);
      const score =
        (item?.status === "reopened" ? 40 : 0) +
        (item?.status === "in_progress" ? 15 : 10) +
        Number(item?.confidence || 0) +
        (risk?.risk_level === "high" ? 30 : risk?.risk_level === "medium" ? 15 : 0);
      return {
        id: item.id,
        title: item.title || item.id,
        assignee: item.assignee || dashboardCopy("unassigned", "未指派"),
        priority_score: score,
        summary: dashboardCopy(
          `score=${score} · status=${item?.status || "open"} · confidence=${item?.confidence || 0}%`,
          `分数=${score} · 状态=${item?.status || "open"} · 置信度=${item?.confidence || 0}%`
        )
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 5);
}

window.buildWatchArchiveCaseTimelineBridge = buildWatchArchiveCaseTimelineBridge;
window.buildWatchArchiveOwnerWorkloadBridge = buildWatchArchiveOwnerWorkloadBridge;
window.buildWatchArchiveResolutionPatternLibraryBridge = buildWatchArchiveResolutionPatternLibraryBridge;
window.buildWatchArchiveSlaAtRiskCasesBridge = buildWatchArchiveSlaAtRiskCasesBridge;
window.buildWatchArchiveOwnerRebalanceSuggestionsBridge = buildWatchArchiveOwnerRebalanceSuggestionsBridge;
window.buildWatchArchiveBestKnownResolutionCardsBridge = buildWatchArchiveBestKnownResolutionCardsBridge;
window.buildWatchArchiveAutoPriorityQueueBridge = buildWatchArchiveAutoPriorityQueueBridge;
