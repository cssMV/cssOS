function buildMusicDeliveryDashboardWatchPreludeModule({
  response,
  arrangementPublishedRevision,
  arrangementRevisions,
  complianceFlags,
  complianceClock,
  runId
}) {
  let releaseRiskBanner = { level: "unknown", summary: "" };
  let postPublishWatchlist = [];
  const liveWatchSession = buildLiveWatchSession(
    arrangementPublishedRevision,
    releaseRiskBanner,
    complianceFlags,
    complianceClock
  );
  const anomalyCheckpoints = buildAnomalyCheckpoints(
    complianceFlags,
    complianceClock,
    postPublishWatchlist
  );
  const rollbackRecommendationLane = buildRollbackRecommendationLane(
    arrangementPublishedRevision,
    arrangementRevisions,
    releaseRiskBanner,
    complianceFlags,
    complianceClock
  );
  const timedFollowupPrompt = buildTimedFollowupPrompt(
    liveWatchSession,
    anomalyCheckpoints,
    releaseRiskBanner
  );
  const watchReport = buildExportableWatchReport({
    runId,
    arrangementPublishedRevision,
    liveWatchSession,
    timedFollowupPrompt,
    postPublishWatchlist,
    anomalyCheckpoints,
    journal: deliveryDashboardState.postPublishWatchJournal,
    rollbackAuditTrail: deliveryDashboardState.rollbackDecisionAuditTrail
  });
  const watchHandoffSummary = buildWatchHandoffSummary({
    arrangementPublishedRevision,
    releaseRiskBanner,
    timedFollowupPrompt,
    postPublishWatchlist,
    rollbackRecommendationLane
  });
  const incidentReplayBundle = buildIncidentReplayBundle({
    runId,
    arrangementPublishedRevision,
    complianceFlags,
    complianceClock,
    journal: deliveryDashboardState.postPublishWatchJournal,
    rollbackAuditTrail: deliveryDashboardState.rollbackDecisionAuditTrail,
    anomalyCheckpoints
  });
  const persistedWatchSnapshots = Array.isArray(response?.watch_snapshots) ? response.watch_snapshots : [];
  const importedWatchSnapshots = Array.isArray(deliveryDashboardState.importedWatchSnapshots)
    ? deliveryDashboardState.importedWatchSnapshots
    : [];
  const crossRunWatchSnapshots = Array.isArray(deliveryDashboardState.crossRunIncidentSnapshots)
    ? deliveryDashboardState.crossRunIncidentSnapshots
    : [];
  const watchSnapshotHistory = [
    ...persistedWatchSnapshots.map((entry) => ({
      id: entry.snapshot_id,
      kind: entry.payload?.kind || "watch_snapshot",
      version_name: entry.version_name,
      payload: entry.payload,
      saved_at: entry.saved_at,
      source_run_id: entry.payload?.run_id || response?.run_id || ""
    })),
    ...(Array.isArray(deliveryDashboardState.watchReportHistory)
      ? deliveryDashboardState.watchReportHistory
      : []),
    ...importedWatchSnapshots,
    ...crossRunWatchSnapshots.map((entry) => ({
      id: `cross_${deliveryDashboardState.crossRunIncidentRunId}_${entry.snapshot_id}`,
      kind: entry.payload?.kind || "watch_snapshot",
      version_name: entry.version_name,
      payload: entry.payload,
      saved_at: entry.saved_at,
      source_run_id:
        entry.payload?.run_id || deliveryDashboardState.crossRunIncidentRunId || ""
    }))
  ].map((entry) => ({
    ...entry,
    incident_classes: buildWatchSnapshotTagList(entry),
    search_index: buildWatchSnapshotSearchIndex({
      ...entry,
      incident_classes: buildWatchSnapshotTagList(entry)
    })
  }));
  const watchSnapshotSearch = String(deliveryDashboardState.watchSnapshotSearch || "")
    .trim()
    .toLowerCase();
  const watchSnapshotIncidentClassFilter = normalizeIncidentClassLabel(
    deliveryDashboardState.watchSnapshotIncidentClassFilter
  );
  const filteredWatchSnapshotHistory = watchSnapshotHistory.filter((entry) => {
    const matchesSearch = !watchSnapshotSearch || String(entry.search_index || "").includes(watchSnapshotSearch);
    const classes = Array.isArray(entry.incident_classes) ? entry.incident_classes : [];
    const matchesClass =
      !watchSnapshotIncidentClassFilter || classes.includes(watchSnapshotIncidentClassFilter);
    return matchesSearch && matchesClass;
  });
  const snapshotCompareA =
    watchSnapshotHistory.find((item) => item.id === deliveryDashboardState.watchSnapshotCompareA) ||
    watchSnapshotHistory[0] ||
    null;
  const snapshotCompareB =
    watchSnapshotHistory.find((item) => item.id === deliveryDashboardState.watchSnapshotCompareB) ||
    watchSnapshotHistory[1] ||
    null;
  const watchSnapshotDiff = buildWatchSnapshotDiff(snapshotCompareA, snapshotCompareB);
  const watchSnapshotCompareSummary = buildWatchSnapshotCompareSummary(
    snapshotCompareA,
    snapshotCompareB
  );
  const watchArchiveClassHeatmap = buildWatchArchiveClassHeatmap(filteredWatchSnapshotHistory);
  const watchArchiveRecurringMotifs = buildWatchArchiveRecurringMotifs(filteredWatchSnapshotHistory);
  const watchArchiveRecommendations = buildWatchArchiveRecommendations(
    watchArchiveClassHeatmap,
    watchArchiveRecurringMotifs,
    filteredWatchSnapshotHistory
  );
  const watchArchiveAnomalyDrilldowns = buildWatchArchiveAnomalyDrilldowns(
    watchArchiveClassHeatmap,
    watchArchiveRecurringMotifs,
    filteredWatchSnapshotHistory
  );
  const watchArchivePlaybookLinks = buildWatchArchivePlaybookLinks(
    watchArchiveRecommendations,
    watchArchiveAnomalyDrilldowns
  );
  const watchArchiveGuidedTriage = buildWatchArchiveGuidedTriage(
    watchArchiveRecommendations,
    watchArchiveRecurringMotifs,
    watchArchiveClassHeatmap
  );
  const watchIncidentConfidenceScoring = buildWatchIncidentConfidenceScoring(
    watchArchiveRecommendations,
    watchArchiveAnomalyDrilldowns,
    watchArchiveRecurringMotifs,
    watchArchiveClassHeatmap
  );
  const watchFixForwardSuggestions = buildWatchFixForwardSuggestions(
    watchArchiveRecurringMotifs,
    watchArchiveClassHeatmap,
    watchArchiveRecommendations
  );
  const watchIncidentDecisionMemo = buildWatchIncidentDecisionMemo(
    watchArchiveGuidedTriage,
    watchIncidentConfidenceScoring,
    watchFixForwardSuggestions
  );
  const watchAssigneeHandoff = buildWatchAssigneeHandoff(
    deliveryDashboardState.watchArchiveAssignee,
    watchIncidentDecisionMemo,
    watchArchivePlaybookLinks
  );
  const watchArchiveOutcomeSummary = buildWatchArchiveOutcomeSummary(
    deliveryDashboardState.watchArchiveOutcomeTracking
  );
  const watchArchiveCaseStatusBoard = buildWatchArchiveCaseStatusBoard(
    deliveryDashboardState.watchArchiveCases
  );
  const watchArchiveCaseTimeline = buildWatchArchiveCaseTimeline(
    deliveryDashboardState.watchArchiveCases
  );
  const watchArchiveOwnerWorkload = buildWatchArchiveOwnerWorkload(
    deliveryDashboardState.watchArchiveCases
  );
  const watchArchiveResolutionPatternLibrary = buildWatchArchiveResolutionPatternLibrary(
    deliveryDashboardState.watchArchiveCases,
    deliveryDashboardState.watchArchiveOutcomeTracking
  );
  return {
    releaseRiskBanner,
    postPublishWatchlist,
    liveWatchSession,
    anomalyCheckpoints,
    rollbackRecommendationLane,
    timedFollowupPrompt,
    watchReport,
    watchHandoffSummary,
    incidentReplayBundle,
    watchSnapshotHistory,
    filteredWatchSnapshotHistory,
    snapshotCompareA,
    snapshotCompareB,
    watchSnapshotDiff,
    watchSnapshotCompareSummary,
    watchArchiveClassHeatmap,
    watchArchiveRecurringMotifs,
    watchArchiveRecommendations,
    watchArchiveAnomalyDrilldowns,
    watchArchivePlaybookLinks,
    watchArchiveGuidedTriage,
    watchIncidentConfidenceScoring,
    watchFixForwardSuggestions,
    watchIncidentDecisionMemo,
    watchAssigneeHandoff,
    watchArchiveOutcomeSummary,
    watchArchiveCaseStatusBoard,
    watchArchiveCaseTimeline,
    watchArchiveOwnerWorkload,
    watchArchiveResolutionPatternLibrary
  };
}

Object.assign(globalThis, {
  buildMusicDeliveryDashboardWatchPreludeModule
});
