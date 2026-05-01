function buildWatchArchiveAnomalyDrilldownsBridge(heatmap, motifs, snapshots) {
  const drilldowns = [];
  (Array.isArray(heatmap) ? heatmap.slice(0, 3) : []).forEach((item) => {
    const matching = (Array.isArray(snapshots) ? snapshots : []).filter((snapshot) =>
      (Array.isArray(snapshot.incident_classes) ? snapshot.incident_classes : []).includes(item.incident_class)
    );
    drilldowns.push({
      id: `class_${item.incident_class}`,
      label: dashboardCopy(`Drill into ${item.incident_class}`, `钻取 ${item.incident_class}`),
      detail: dashboardCopy(
        `${matching.length} matching snapshots. Inspect the latest ones for anomaly clustering.`,
        `共有 ${matching.length} 个匹配快照。优先查看最新几份，确认异常是否正在聚集。`
      ),
      sample_snapshots: matching.slice(0, 3).map((entry) => entry.version_name || entry.id),
      action: {
        type: "set_class_filter",
        incident_class: item.incident_class
      }
    });
  });
  if (Array.isArray(motifs) && motifs.length) {
    const motif = motifs[0];
    drilldowns.push({
      id: `motif_${motif.motif_id}`,
      label: dashboardCopy("Drill into recurring motif", "钻取重复事故模式"),
      detail: dashboardCopy(
        `${motif.summary}. Use this lane to inspect repeated risk/class combinations.`,
        `${motif.summary}。沿这条线继续检查重复出现的风险与分类组合。`
      ),
      sample_snapshots: motif.sample_snapshots,
      action: {
        type: "set_class_filter",
        incident_class: motif.incident_classes[0] || ""
      }
    });
  }
  return drilldowns;
}

function buildWatchArchivePlaybookLinksBridge(recommendations, drilldowns) {
  const links = [];
  (Array.isArray(recommendations) ? recommendations.slice(0, 2) : []).forEach((item) => {
    links.push({
      id: `playbook_${item.id}`,
      label: dashboardCopy("Focus archive filter", "聚焦档案过滤"),
      detail: item.reason,
      action: item.action
    });
  });
  (Array.isArray(drilldowns) ? drilldowns.slice(0, 2) : []).forEach((item) => {
    links.push({
      id: `playbook_${item.id}`,
      label: dashboardCopy("Open anomaly drilldown", "打开异常钻取"),
      detail: item.detail,
      action: item.action
    });
  });
  if (!links.length) {
    links.push({
      id: "playbook_default",
      label: dashboardCopy("Review the latest archive items", "检查最新档案"),
      detail: dashboardCopy(
        "Start with the newest snapshots, then narrow by the first visible incident class.",
        "先看最新快照，再按最先出现的事件分类逐步缩小范围。"
      ),
      action: {
        type: "compare_latest_two"
      }
    });
  }
  return links;
}

function buildWatchArchiveGuidedTriageBridge(recommendations, motifs, heatmap) {
  const triage = [];
  const topRecommendation = Array.isArray(recommendations) ? recommendations[0] : null;
  const topMotif = Array.isArray(motifs) ? motifs[0] : null;
  const topClass = Array.isArray(heatmap) ? heatmap[0] : null;
  if (topRecommendation) {
    triage.push({
      step: dashboardCopy("Start with the highest-signal archive lane", "先处理信号最强的档案线索"),
      detail: topRecommendation.reason
    });
  }
  if (topClass) {
    triage.push({
      step: dashboardCopy("Validate whether the hottest class is still active", "确认最热分类是否仍在持续"),
      detail: dashboardCopy(
        `Focus ${topClass.incident_class} first because it dominates the current archive filter.`,
        `先聚焦 ${topClass.incident_class}，因为它当前在档案过滤结果里最占主导。`
      )
    });
  }
  if (topMotif) {
    triage.push({
      step: dashboardCopy("Check whether the recurring motif is spreading", "检查重复模式是否正在扩散"),
      detail: dashboardCopy(
        `${topMotif.summary}. Compare the latest snapshots inside this motif next.`,
        `${topMotif.summary}。下一步建议比较这个模式里最新的几份快照。`
      )
    });
  }
  if (!triage.length) {
    triage.push({
      step: dashboardCopy("Review the latest archive snapshot first", "先看最新档案快照"),
      detail: dashboardCopy(
        "There is not enough archive structure yet, so start from the latest snapshot and narrow down manually.",
        "当前档案结构还不够强，先从最新快照开始，再手动逐步缩小范围。"
      )
    });
  }
  return triage;
}

function buildWatchIncidentConfidenceScoringBridge(recommendations, drilldowns, motifs, heatmap) {
  const scores = [];
  (Array.isArray(recommendations) ? recommendations : []).slice(0, 3).forEach((item, index) => {
    const base = 0.55 + Math.max(0, 0.1 * (2 - index));
    scores.push({
      id: item.id,
      label: item.label,
      confidence: Math.min(0.95, Number(base.toFixed(2))),
      reason: item.reason
    });
  });
  const motif = Array.isArray(motifs) ? motifs[0] : null;
  if (motif) {
    scores.push({
      id: `confidence_${motif.motif_id}`,
      label: dashboardCopy("Recurring motif confidence", "重复模式置信度"),
      confidence: Math.min(0.98, Number((0.6 + motif.occurrences * 0.08).toFixed(2))),
      reason: dashboardCopy(
        `${motif.summary}. Repetition across runs raises confidence.`,
        `${motif.summary}。跨 run 的重复会提升这条判断的置信度。`
      )
    });
  }
  const hottest = Array.isArray(heatmap) ? heatmap[0] : null;
  if (hottest) {
    scores.push({
      id: `confidence_${hottest.incident_class}`,
      label: dashboardCopy("Hottest class confidence", "最热分类置信度"),
      confidence: Math.min(0.92, Number((0.52 + hottest.count * 0.07).toFixed(2))),
      reason: dashboardCopy(
        `${hottest.incident_class} appears ${hottest.count} times in the filtered archive.`,
        `${hottest.incident_class} 在过滤后的档案中出现了 ${hottest.count} 次。`
      )
    });
  }
  return scores.sort((a, b) => b.confidence - a.confidence);
}

window.buildWatchArchiveAnomalyDrilldownsBridge = buildWatchArchiveAnomalyDrilldownsBridge;
window.buildWatchArchivePlaybookLinksBridge = buildWatchArchivePlaybookLinksBridge;
window.buildWatchArchiveGuidedTriageBridge = buildWatchArchiveGuidedTriageBridge;
window.buildWatchIncidentConfidenceScoringBridge = buildWatchIncidentConfidenceScoringBridge;
