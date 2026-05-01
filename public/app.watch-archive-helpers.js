function buildWatchArchiveClassHeatmapBridge(snapshots) {
  const counts = new Map();
  (Array.isArray(snapshots) ? snapshots : []).forEach((snapshot) => {
    const classes = Array.isArray(snapshot?.incident_classes) ? snapshot.incident_classes : [];
    classes.forEach((item) => {
      const key = normalizeIncidentClassLabel(item);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .map(([incidentClass, count]) => ({
      incident_class: incidentClass,
      count,
      intensity: count >= 5 ? "high" : count >= 3 ? "medium" : "low"
    }))
    .sort((a, b) => b.count - a.count || a.incident_class.localeCompare(b.incident_class));
}

function buildWatchArchiveRecurringMotifsBridge(snapshots) {
  const motifs = new Map();
  (Array.isArray(snapshots) ? snapshots : []).forEach((snapshot) => {
    const payload = snapshot?.payload && typeof snapshot.payload === "object" ? snapshot.payload : {};
    const risk = String(
      payload?.watch_session?.risk_level ||
        payload?.summary?.risk_level ||
        payload?.risk_level ||
        "unknown"
    ).toLowerCase();
    const classes = Array.isArray(snapshot?.incident_classes) ? snapshot.incident_classes.slice().sort() : [];
    const key = `${classes.join("+") || "uncategorized"}|${risk}`;
    const current = motifs.get(key) || {
      motif_id: key,
      incident_classes: classes,
      risk_level: risk,
      occurrences: 0,
      runs: new Set(),
      snapshot_names: []
    };
    current.occurrences += 1;
    if (snapshot?.source_run_id) current.runs.add(String(snapshot.source_run_id));
    current.snapshot_names.push(String(snapshot?.version_name || snapshot?.id || "snapshot"));
    motifs.set(key, current);
  });
  return Array.from(motifs.values())
    .map((item) => ({
      motif_id: item.motif_id,
      incident_classes: item.incident_classes,
      risk_level: item.risk_level,
      occurrences: item.occurrences,
      run_count: item.runs.size,
      sample_snapshots: item.snapshot_names.slice(0, 3),
      summary: dashboardCopy(
        `${item.occurrences} snapshots across ${item.runs.size || 1} run(s)`,
        `${item.occurrences} 个快照，跨 ${item.runs.size || 1} 个 run`
      )
    }))
    .filter((item) => item.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences || b.run_count - a.run_count);
}

function buildWatchArchiveRecommendationsBridge(heatmap, motifs, snapshots) {
  const recommendations = [];
  const topClass = Array.isArray(heatmap) ? heatmap[0] : null;
  if (topClass) {
    recommendations.push({
      id: `class_${topClass.incident_class}`,
      label: dashboardCopy("Review hottest incident class first", "先看最热事件分类"),
      reason: dashboardCopy(
        `${topClass.incident_class} appears ${topClass.count} times in the current archive filter.`,
        `${topClass.incident_class} 在当前档案过滤结果里出现了 ${topClass.count} 次。`
      ),
      action: {
        type: "set_class_filter",
        incident_class: topClass.incident_class
      }
    });
  }
  const topMotif = Array.isArray(motifs) ? motifs[0] : null;
  if (topMotif) {
    recommendations.push({
      id: `motif_${topMotif.motif_id}`,
      label: dashboardCopy("Inspect the dominant recurring motif", "检查主导重复模式"),
      reason: dashboardCopy(
        `${topMotif.summary}. Start with ${topMotif.incident_classes.join(", ") || "uncategorized"}.`,
        `${topMotif.summary}。建议先看 ${topMotif.incident_classes.join("、") || "未分类"}。`
      ),
      action: {
        type: "set_class_filter",
        incident_class: topMotif.incident_classes[0] || ""
      }
    });
  }
  if (Array.isArray(snapshots) && snapshots.length >= 2) {
    recommendations.push({
      id: "compare_latest_two",
      label: dashboardCopy("Compare the latest two archive snapshots", "比较最近两份档案快照"),
      reason: dashboardCopy(
        "Use the latest two snapshots to check whether journal pressure and compliance flags are rising.",
        "对比最近两份快照，检查日志压力和合规标记是否正在上升。"
      ),
      action: {
        type: "compare_latest_two"
      }
    });
  }
  return recommendations;
}

window.buildWatchArchiveClassHeatmapBridge = buildWatchArchiveClassHeatmapBridge;
window.buildWatchArchiveRecurringMotifsBridge = buildWatchArchiveRecurringMotifsBridge;
window.buildWatchArchiveRecommendationsBridge = buildWatchArchiveRecommendationsBridge;
