function normalizeIncidentClassLabelBridge(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function inferWatchSnapshotIncidentClassesBridge(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const payload = snapshot.payload && typeof snapshot.payload === "object" ? snapshot.payload : {};
  const tags = new Set();
  const riskLevel = String(
    payload?.watch_session?.risk_level ||
      payload?.summary?.risk_level ||
      payload?.risk_level ||
      ""
  )
    .trim()
    .toLowerCase();
  const rollbackCount = Array.isArray(payload?.rollback_decision_audit_trail)
    ? payload.rollback_decision_audit_trail.length
    : 0;
  const flagCount = Array.isArray(payload?.compliance_flags) ? payload.compliance_flags.length : 0;
  const checkpointCount = Array.isArray(payload?.anomaly_checkpoints) ? payload.anomaly_checkpoints.length : 0;
  const journalCount = Array.isArray(payload?.watch_outcome_journal) ? payload.watch_outcome_journal.length : 0;
  const summaryText = JSON.stringify(payload).toLowerCase();
  if (riskLevel === "high" || flagCount >= 3) tags.add("high-risk");
  if (summaryText.includes("sla") || summaryText.includes("breach")) tags.add("sla-watch");
  if (rollbackCount > 0) tags.add("rollback-review");
  if (flagCount > 0 || checkpointCount > 0) tags.add("incident-response");
  if (journalCount > 0 && rollbackCount === 0 && flagCount === 0) tags.add("watch-observation");
  if (!tags.size) tags.add("general-watch");
  return Array.from(tags);
}

function readWatchSnapshotTagOverridesBridge(snapshotId) {
  const overrides =
    deliveryDashboardState.watchSnapshotTagOverrides &&
    typeof deliveryDashboardState.watchSnapshotTagOverrides === "object"
      ? deliveryDashboardState.watchSnapshotTagOverrides
      : {};
  const raw = overrides[snapshotId];
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((item) => normalizeIncidentClassLabelBridge(item))
    .filter(Boolean);
}

function buildWatchSnapshotTagListBridge(snapshot) {
  const inferred = inferWatchSnapshotIncidentClassesBridge(snapshot);
  const overrides = readWatchSnapshotTagOverridesBridge(snapshot?.id);
  return Array.from(new Set([...inferred, ...overrides]));
}

function buildWatchSnapshotSearchIndexBridge(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return "";
  return [
    snapshot.id,
    snapshot.kind,
    snapshot.version_name,
    snapshot.source_run_id,
    ...(Array.isArray(snapshot.incident_classes) ? snapshot.incident_classes : []),
    JSON.stringify(snapshot.payload || {})
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildWatchSnapshotCompareSummaryBridge(a, b) {
  if (!a || !b) return null;
  const payloadA = a.payload && typeof a.payload === "object" ? a.payload : {};
  const payloadB = b.payload && typeof b.payload === "object" ? b.payload : {};
  const journalA = Array.isArray(payloadA.watch_outcome_journal) ? payloadA.watch_outcome_journal.length : 0;
  const journalB = Array.isArray(payloadB.watch_outcome_journal) ? payloadB.watch_outcome_journal.length : 0;
  const rollbackA = Array.isArray(payloadA.rollback_decision_audit_trail)
    ? payloadA.rollback_decision_audit_trail.length
    : 0;
  const rollbackB = Array.isArray(payloadB.rollback_decision_audit_trail)
    ? payloadB.rollback_decision_audit_trail.length
    : 0;
  const flagsA = Array.isArray(payloadA.compliance_flags) ? payloadA.compliance_flags.length : 0;
  const flagsB = Array.isArray(payloadB.compliance_flags) ? payloadB.compliance_flags.length : 0;
  const checkpointsA = Array.isArray(payloadA.anomaly_checkpoints) ? payloadA.anomaly_checkpoints.length : 0;
  const checkpointsB = Array.isArray(payloadB.anomaly_checkpoints) ? payloadB.anomaly_checkpoints.length : 0;
  const classesA = Array.isArray(a.incident_classes) ? a.incident_classes : [];
  const classesB = Array.isArray(b.incident_classes) ? b.incident_classes : [];
  const addedClasses = classesB.filter((item) => !classesA.includes(item));
  const removedClasses = classesA.filter((item) => !classesB.includes(item));
  return {
    schema: "cssmv.watch_snapshot_compare_summary.v1",
    compare_a: {
      id: a.id,
      name: a.version_name || a.id,
      run_id: a.source_run_id || "",
      incident_classes: classesA
    },
    compare_b: {
      id: b.id,
      name: b.version_name || b.id,
      run_id: b.source_run_id || "",
      incident_classes: classesB
    },
    cards: [
      {
        key: "journal",
        label: dashboardCopy("Journal activity", "日志活动"),
        summary: dashboardCopy(`${journalA} -> ${journalB} entries`, `${journalA} -> ${journalB} 条日志`),
        delta: journalB - journalA
      },
      {
        key: "rollback",
        label: dashboardCopy("Rollback pressure", "回滚压力"),
        summary: dashboardCopy(`${rollbackA} -> ${rollbackB} rollback decisions`, `${rollbackA} -> ${rollbackB} 次回滚决策`),
        delta: rollbackB - rollbackA
      },
      {
        key: "flags",
        label: dashboardCopy("Compliance flags", "合规标记"),
        summary: dashboardCopy(`${flagsA} -> ${flagsB} active flags`, `${flagsA} -> ${flagsB} 个活动标记`),
        delta: flagsB - flagsA
      },
      {
        key: "checkpoints",
        label: dashboardCopy("Checkpoint density", "检查点密度"),
        summary: dashboardCopy(`${checkpointsA} -> ${checkpointsB} checkpoints`, `${checkpointsA} -> ${checkpointsB} 个检查点`),
        delta: checkpointsB - checkpointsA
      },
      {
        key: "classes",
        label: dashboardCopy("Incident classes", "事件分类"),
        summary: dashboardCopy(
          `+${addedClasses.join(", ") || "none"} / -${removedClasses.join(", ") || "none"}`,
          `新增：${addedClasses.join("、") || "无"} / 移除：${removedClasses.join("、") || "无"}`
        ),
        delta: addedClasses.length - removedClasses.length
      }
    ]
  };
}

window.normalizeIncidentClassLabelBridge = normalizeIncidentClassLabelBridge;
window.inferWatchSnapshotIncidentClassesBridge = inferWatchSnapshotIncidentClassesBridge;
window.readWatchSnapshotTagOverridesBridge = readWatchSnapshotTagOverridesBridge;
window.buildWatchSnapshotTagListBridge = buildWatchSnapshotTagListBridge;
window.buildWatchSnapshotSearchIndexBridge = buildWatchSnapshotSearchIndexBridge;
window.buildWatchSnapshotCompareSummaryBridge = buildWatchSnapshotCompareSummaryBridge;
