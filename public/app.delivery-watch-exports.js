function buildExportableWatchReportBridge({
  runId,
  arrangementPublishedRevision,
  liveWatchSession,
  timedFollowupPrompt,
  postPublishWatchlist,
  anomalyCheckpoints,
  journal,
  rollbackAuditTrail
}) {
  return {
    schema: "cssmv.watch_report.v1",
    run_id: runId,
    published_revision: arrangementPublishedRevision || null,
    live_watch_session: liveWatchSession || null,
    timed_followup_prompt: timedFollowupPrompt || "",
    watchlist: Array.isArray(postPublishWatchlist) ? postPublishWatchlist : [],
    anomaly_checkpoints: Array.isArray(anomalyCheckpoints) ? anomalyCheckpoints : [],
    watch_outcome_journal: Array.isArray(journal) ? journal : [],
    rollback_decision_audit_trail: Array.isArray(rollbackAuditTrail) ? rollbackAuditTrail : [],
    exported_at: new Date().toISOString()
  };
}

function buildWatchHandoffSummaryBridge({
  arrangementPublishedRevision,
  releaseRiskBanner,
  timedFollowupPrompt,
  postPublishWatchlist,
  rollbackRecommendationLane
}) {
  return {
    schema: "cssmv.watch_handoff_summary.v1",
    revision:
      arrangementPublishedRevision?.version_name ||
      arrangementPublishedRevision?.candidate_name ||
      arrangementPublishedRevision?.revision_id ||
      "unpublished",
    risk_level: releaseRiskBanner?.level || "unknown",
    summary: releaseRiskBanner?.summary || "",
    next_followup: timedFollowupPrompt || "",
    top_watch_items: Array.isArray(postPublishWatchlist) ? postPublishWatchlist.slice(0, 3) : [],
    rollback_recommendation: rollbackRecommendationLane?.summary || "",
    exported_at: new Date().toISOString()
  };
}

function buildIncidentReplayBundleBridge({
  runId,
  arrangementPublishedRevision,
  complianceFlags,
  complianceClock,
  journal,
  rollbackAuditTrail,
  anomalyCheckpoints
}) {
  return {
    schema: "cssmv.incident_replay_bundle.v1",
    run_id: runId,
    published_revision: arrangementPublishedRevision || null,
    compliance_flags: Array.isArray(complianceFlags) ? complianceFlags : [],
    compliance_windows: Array.isArray(complianceClock?.windows) ? complianceClock.windows : [],
    anomaly_checkpoints: Array.isArray(anomalyCheckpoints) ? anomalyCheckpoints : [],
    watch_outcome_journal: Array.isArray(journal) ? journal : [],
    rollback_decision_audit_trail: Array.isArray(rollbackAuditTrail) ? rollbackAuditTrail : [],
    replay_generated_at: new Date().toISOString()
  };
}

function downloadJsonArtifactBridge(payload, fileName) {
  const body = JSON.stringify(payload, null, 2);
  const blob = new Blob([body], { type: "application/json" });
  triggerDownloadBlob(blob, fileName);
}

function saveWatchSnapshotBridge(kind, payload, versionName) {
  const snapshot = {
    id: `watch_snapshot_${Date.now()}`,
    kind: String(kind || "watch_report"),
    version_name: String(versionName || "").trim() || `${kind || "watch"}-${new Date().toISOString()}`,
    payload,
    saved_at: new Date().toISOString()
  };
  deliveryDashboardState.watchReportHistory = [
    snapshot,
    ...(Array.isArray(deliveryDashboardState.watchReportHistory)
      ? deliveryDashboardState.watchReportHistory
      : [])
  ].slice(0, 20);
  return snapshot;
}

window.buildExportableWatchReportBridge = buildExportableWatchReportBridge;
window.buildWatchHandoffSummaryBridge = buildWatchHandoffSummaryBridge;
window.buildIncidentReplayBundleBridge = buildIncidentReplayBundleBridge;
window.downloadJsonArtifactBridge = downloadJsonArtifactBridge;
window.saveWatchSnapshotBridge = saveWatchSnapshotBridge;
