function renderMusicDeliveryDashboardModule() {
  try {
  const prelude = globalThis.renderMusicDeliveryDashboardPreludeBridge?.() || { aborted: true };
  if (prelude.aborted) return;
  const {
    response,
    dashboard,
    receipt,
    executor,
    downstream,
    complianceLane,
    complianceFlags,
    complianceClock,
    complianceAlertRouting,
    complianceEscalationPolicy,
    complianceOperatorActions,
    complianceWebhookDispatch,
    complianceTicketMapping,
    complianceAckReconciliation,
    complianceRotationControl,
    complianceVendorRegistry,
    complianceReopenControl,
    compliancePresetControl,
    complianceAuditLog,
    complianceScopedPermissions,
    complianceActorIdentity,
    compliancePermissionCheck,
    complianceAuditSignature,
    complianceActorDirectory,
    complianceRolePolicyPresets,
    complianceApprovalChain,
    complianceApproverRouting,
    complianceRequiredSigners,
    complianceReleaseQuorum,
    complianceLockedPublishGate,
    complianceReleaseUnblockToken,
    complianceImmutablePublishAuthorization,
    blockedPublishExplainer,
    approvalToPublishTrace,
    artifactPaths,
    runId,
    complianceActiveKidValue,
    complianceKeysetValue,
    complianceVendorValue,
    complianceRequiredFieldsValue,
    complianceOptionalFieldsValue,
    complianceFieldDefaultsValue,
    complianceReopenReasonValue,
    compliancePresetNameValue,
    compliancePermissionRotateValue,
    compliancePermissionRegistryValue,
    compliancePermissionReopenValue,
    complianceActorIdValue,
    complianceActorNameValue,
    complianceActorRoleValue,
    complianceActorDirectoryValue,
    complianceRolePolicyNameValue,
    complianceApprovalDecisionValue,
    complianceApprovalNoteValue,
    complianceApproverRoutingValue,
    complianceRequiredSignersValue,
    complianceQuorumNameValue,
    runStatus,
    publishState,
    backend,
    jobId,
    publishUrl,
    latestAction,
    notes,
    packageBrowser,
    preview,
    stemItems,
    arrangementItems,
    latestAppliedPromotion,
    revisionFiles,
    revisionItems,
    arrangementItem,
    phraseItem,
    rows,
    noteItems,
    browserGroups,
    browserHtml
  } = prelude;

  const mixerPanel = globalThis.renderMusicDeliveryDashboardMixerBridge?.() || {};
  const {
    sections = [],
    selectedSection = null,
    compareA = null,
    compareB = null,
    roleList = [],
    sectionPhrases = [],
    comparePhraseA = null,
    comparePhraseB = null,
    mixerTracksHtml = "",
    mixerSummary = "",
    mixerControlsHtml = "",
    timelineHtml = "",
    sectionPanelHtml = "",
    sectionRoleMatrixHtml = "",
    roleFocusSummary = "",
    phraseFocusSummary = "",
    phraseHeatmapHtml = "",
    chordLaneHtml = "",
    articulationLensHtml = "",
    compareDeckHtml = "",
    motifTrackerHtml = "",
    activeRewriteMode = "mutation",
    providerReadyRewritePayload = {},
    cueSheetPatchPlan = {},
    cuePatchPlan = {},
    rewritePayloadMode = "provider",
    rewriteAssistHtml = ""
  } = mixerPanel;
  const rewritePanel = globalThis.renderMusicDeliveryDashboardRewriteBridge?.({
    sections,
    compareA,
    compareB,
    arrangementItem,
    selectedSection,
    sectionPhrases,
    activeRewriteMode,
    providerReadyRewritePayload,
    cueSheetPatchPlan,
    cuePatchPlan,
    rewritePayloadMode,
    comparePhraseA,
    comparePhraseB
  }) || {};
  const {
    comparePanelHtml = "",
    arrangementSummary = "",
    rewritePatchBundle = {},
    rewritePayloadHtml = "",
    rewriteSandboxHtml = ""
  } = rewritePanel;

  const rewriteBundleHistory = Array.isArray(response?.rewrite_bundles) ? response.rewrite_bundles : [];
  const rewriteBundleDiffs = Array.isArray(response?.rewrite_bundle_diffs) ? response.rewrite_bundle_diffs : [];
  const rewritePromotions = Array.isArray(response?.rewrite_promotions) ? response.rewrite_promotions : [];
  const arrangementRevisions = Array.isArray(response?.arrangement_revisions) ? response.arrangement_revisions : [];
  const arrangementRevisionDiffs = Array.isArray(response?.arrangement_revision_diffs)
    ? response.arrangement_revision_diffs
    : [];
  const arrangementRevisionHead = response?.arrangement_revision_head || null;
  const arrangementReleaseCandidates = Array.isArray(response?.arrangement_release_candidates)
    ? response.arrangement_release_candidates
    : [];
  const arrangementLockedRevision = response?.arrangement_locked_revision || null;
  const arrangementPublishedRevision = response?.arrangement_published_revision || null;
  const {
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
  } = globalThis.buildMusicDeliveryDashboardWatchPreludeModule?.({
    response,
    arrangementPublishedRevision,
    arrangementRevisions,
    complianceFlags,
    complianceClock,
    runId
  }) || {};
  const watchArchiveSlaAtRiskCases = buildWatchArchiveSlaAtRiskCases(
    deliveryDashboardState.watchArchiveCases
  );
  const watchArchiveOwnerRebalanceSuggestions = buildWatchArchiveOwnerRebalanceSuggestions(
    watchArchiveOwnerWorkload
  );
  const watchArchiveBestKnownResolutionCards = buildWatchArchiveBestKnownResolutionCards(
    watchArchiveResolutionPatternLibrary
  );
  const watchArchiveAutoPriorityQueue = buildWatchArchiveAutoPriorityQueue(
    deliveryDashboardState.watchArchiveCases,
    watchArchiveSlaAtRiskCases
  );
  const watchArchiveOwnerHandoffSuggestions = buildWatchArchiveOwnerHandoffSuggestions(
    deliveryDashboardState.watchArchiveCases,
    watchArchiveOwnerWorkload,
    watchArchiveOwnerRebalanceSuggestions
  );
  const watchArchiveClosureReadinessChecklist = buildWatchArchiveClosureReadinessChecklist(
    deliveryDashboardState.watchArchiveCases,
    watchArchiveBestKnownResolutionCards
  );
  const watchArchiveReopenedDiagnostics = buildWatchArchiveReopenedDiagnostics(
    deliveryDashboardState.watchArchiveCases
  );
  const watchArchiveInboxLane = buildWatchArchiveInboxLane(
    deliveryDashboardState.watchArchiveCases
  );
  const watchArchiveReopenPreventionHints = buildWatchArchiveReopenPreventionHints(
    watchArchiveReopenedDiagnostics,
    watchArchiveBestKnownResolutionCards
  );
  const watchArchiveCaseExportBundle = buildWatchArchiveCaseExportBundle(
    deliveryDashboardState.watchArchiveCases,
    watchArchiveCaseStatusBoard,
    watchArchiveAutoPriorityQueue,
    watchArchiveOwnerHandoffSuggestions
  );
  const watchArchiveOwnerInboxDigest = buildWatchArchiveOwnerInboxDigest(
    watchArchiveInboxLane
  );
  const watchArchiveReopenRootCauseNotes = buildWatchArchiveReopenRootCauseNotes(
    deliveryDashboardState.watchArchiveCases
  );
  const watchArchiveReopenTrendCards = buildWatchArchiveReopenTrendCards(
    deliveryDashboardState.watchArchiveCaseArtifacts,
    watchArchiveReopenRootCauseNotes
  );
  const watchArchiveTimelineMerge = buildWatchArchiveTimelineMerge(
    deliveryDashboardState.watchArchiveCaseArtifacts,
    deliveryDashboardState.watchArchiveInboxHistory,
    watchArchiveReopenRootCauseNotes
  );
  const watchArchiveTrendCompareCards = buildWatchArchiveTrendCompareCards(
    deliveryDashboardState.watchArchiveCaseArtifacts,
    deliveryDashboardState.watchArchiveInboxHistory,
    watchArchiveReopenRootCauseNotes
  );
  const watchArchiveWeeklyOpsDigestDraft = buildWatchArchiveWeeklyOpsDigestDraft(
    watchArchiveCaseStatusBoard,
    deliveryDashboardState.watchArchiveCaseArtifacts,
    deliveryDashboardState.watchArchiveInboxHistory,
    watchArchiveReopenRootCauseNotes
  );
  const watchArchiveExecutiveSnapshotCards = buildWatchArchiveExecutiveSnapshotCards(
    watchArchiveCaseStatusBoard,
    watchArchiveReopenRootCauseNotes,
    watchArchiveTrendCompareCards
  );
  const watchArchiveAnomalyWatchThresholds = buildWatchArchiveAnomalyWatchThresholds(
    watchArchiveCaseStatusBoard,
    watchArchiveReopenRootCauseNotes
  );
  const watchArchiveNextWeekActionPlanDraft = buildWatchArchiveNextWeekActionPlanDraft(
    watchArchiveCaseStatusBoard,
    watchArchiveAnomalyWatchThresholds,
    watchArchiveOwnerHandoffSuggestions
  );
  const watchArchiveBoardReadyBriefing = buildWatchArchiveBoardReadyBriefing(
    watchArchiveExecutiveSnapshotCards,
    watchArchiveAnomalyWatchThresholds,
    watchArchiveWeeklyOpsDigestDraft
  );
  const watchArchiveRedFlagEscalations = buildWatchArchiveRedFlagEscalations(
    watchArchiveAnomalyWatchThresholds,
    watchArchiveExecutiveSnapshotCards
  );
  const watchArchiveDecisionMeetingNotesDraft = buildWatchArchiveDecisionMeetingNotesDraft(
    watchArchiveBoardReadyBriefing,
    watchArchiveNextWeekActionPlanDraft,
    watchArchiveRedFlagEscalations
  );
  const watchArchiveDecisionFollowupTracker = buildWatchArchiveDecisionFollowupTracker(
    watchArchiveNextWeekActionPlanDraft,
    watchArchiveRedFlagEscalations
  );
  const watchArchiveActionOwnerCommitments = buildWatchArchiveActionOwnerCommitments(
    watchArchiveInboxLane,
    watchArchiveNextWeekActionPlanDraft
  );
  const watchArchiveOverdueFollowups = buildWatchArchiveOverdueFollowups(
    watchArchiveDecisionFollowupTracker,
    deliveryDashboardState.watchArchiveMeetingOutcomeLedger
  );
  const watchArchiveCommitmentSlipAlerts = buildWatchArchiveCommitmentSlipAlerts(
    watchArchiveActionOwnerCommitments,
    deliveryDashboardState.watchArchiveMeetingOutcomeLedger
  );
  const watchArchiveMonthlyReviewPackDraft = buildWatchArchiveMonthlyReviewPackDraft(
    watchArchiveExecutiveSnapshotCards,
    watchArchiveTrendCompareCards,
    watchArchiveWeeklyOpsDigestDraft,
    deliveryDashboardState.watchArchiveMeetingOutcomeLedger
  );
  const watchArchiveQuarterToDateScorecards = buildWatchArchiveQuarterToDateScorecards(
    watchArchiveCaseStatusBoard,
    deliveryDashboardState.watchArchiveMeetingOutcomeLedger,
    watchArchiveMonthlyReviewPackDraft,
    watchArchiveReopenRootCauseNotes
  );
  const watchArchiveLeadershipRiskDigest = buildWatchArchiveLeadershipRiskDigest(
    watchArchiveExecutiveSnapshotCards,
    watchArchiveAnomalyWatchThresholds,
    watchArchiveRedFlagEscalations,
    watchArchiveOverdueFollowups
  );
  const watchArchiveOperatingCadenceTemplate = buildWatchArchiveOperatingCadenceTemplate(
    watchArchiveWeeklyOpsDigestDraft,
    watchArchiveMonthlyReviewPackDraft,
    watchArchiveQuarterToDateScorecards,
    watchArchiveNextWeekActionPlanDraft
  );
  const watchArchiveQuarterTrendDeltaCards = buildWatchArchiveQuarterTrendDeltaCards(
    watchArchiveTrendCompareCards,
    watchArchiveQuarterToDateScorecards,
    watchArchiveOverdueFollowups
  );
  const watchArchiveRevenueRiskBridge = buildWatchArchiveRevenueRiskBridge(
    watchArchiveLeadershipRiskDigest,
    watchArchiveCaseStatusBoard,
    watchArchiveOverdueFollowups,
    watchArchiveCommitmentSlipAlerts
  );
  const watchArchiveCadenceAdherenceTracker = buildWatchArchiveCadenceAdherenceTracker(
    watchArchiveOperatingCadenceTemplate,
    deliveryDashboardState.watchArchiveMeetingOutcomeLedger,
    watchArchiveOverdueFollowups
  );
  const watchArchiveMarginPressureCards = buildWatchArchiveMarginPressureCards(
    watchArchiveRevenueRiskBridge,
    watchArchiveCadenceAdherenceTracker,
    watchArchiveLeadershipRiskDigest
  );
  const watchArchiveCapacityBottleneckDigest = buildWatchArchiveCapacityBottleneckDigest(
    watchArchiveCaseStatusBoard,
    watchArchiveOwnerWorkload,
    watchArchiveOverdueFollowups,
    watchArchiveOwnerRebalanceSuggestions
  );
  const watchArchiveMonetizationInterventionDraft = buildWatchArchiveMonetizationInterventionDraft(
    watchArchiveRevenueRiskBridge,
    watchArchiveCommitmentSlipAlerts,
    watchArchiveCapacityBottleneckDigest
  );
  const watchArchiveProfitRecoveryScenarios = buildWatchArchiveProfitRecoveryScenarios(
    watchArchiveMarginPressureCards,
    watchArchiveMonetizationInterventionDraft,
    watchArchiveCapacityBottleneckDigest
  );
  const watchArchiveStaffingTradeoffCards = buildWatchArchiveStaffingTradeoffCards(
    watchArchiveCapacityBottleneckDigest,
    watchArchiveOwnerWorkload,
    watchArchiveOwnerRebalanceSuggestions
  );
  const watchArchivePricingThroughputActionSheet = buildWatchArchivePricingThroughputActionSheet(
    watchArchiveRevenueRiskBridge,
    watchArchiveOperatingCadenceTemplate,
    watchArchiveMonetizationInterventionDraft
  );
  const watchArchiveRoiInterventionLadder = buildWatchArchiveRoiInterventionLadder(
    watchArchiveMonetizationInterventionDraft,
    watchArchiveRevenueRiskBridge,
    watchArchiveProfitRecoveryScenarios
  );
  const watchArchiveHiringTriggerThresholds = buildWatchArchiveHiringTriggerThresholds(
    watchArchiveStaffingTradeoffCards,
    watchArchiveCapacityBottleneckDigest,
    watchArchiveOwnerWorkload
  );
  const watchArchiveMonetizationExperimentBoard = buildWatchArchiveMonetizationExperimentBoard(
    watchArchivePricingThroughputActionSheet,
    watchArchiveMonetizationInterventionDraft,
    watchArchiveRevenueRiskBridge
  );
  const watchArchiveExecutiveAllocationMemo = buildWatchArchiveExecutiveAllocationMemo(
    watchArchiveRoiInterventionLadder,
    watchArchiveHiringTriggerThresholds,
    watchArchiveMonetizationExperimentBoard
  );
  const watchArchiveBudgetGuardrails = buildWatchArchiveBudgetGuardrails(
    watchArchiveRevenueRiskBridge,
    watchArchiveRoiInterventionLadder,
    watchArchivePricingThroughputActionSheet
  );
  const watchArchiveExperimentOutcomeLedger = buildWatchArchiveExperimentOutcomeLedger(
    watchArchiveMonetizationExperimentBoard,
    watchArchiveRevenueRiskBridge,
    watchArchiveProfitRecoveryScenarios
  );
  const watchArchiveBoardDecisionPacket = buildWatchArchiveBoardDecisionPacket(
    watchArchiveExecutiveAllocationMemo,
    watchArchiveBudgetGuardrails,
    watchArchiveExperimentOutcomeLedger
  );
  const watchArchiveSpendApprovalLanes = buildWatchArchiveSpendApprovalLanes(
    watchArchiveBudgetGuardrails,
    watchArchiveExecutiveAllocationMemo,
    watchArchiveHiringTriggerThresholds
  );
  const watchArchiveExperimentKillScaleRules = buildWatchArchiveExperimentKillScaleRules(
    watchArchiveMonetizationExperimentBoard,
    watchArchiveRevenueRiskBridge,
    watchArchiveBudgetGuardrails
  );
  const watchArchiveCapitalAllocationScoreboard = buildWatchArchiveCapitalAllocationScoreboard(
    watchArchiveBoardDecisionPacket,
    watchArchiveSpendApprovalLanes,
    watchArchiveExperimentOutcomeLedger
  );
  const watchArchiveGovernanceExceptionRegister = buildWatchArchiveGovernanceExceptionRegister(
    watchArchiveBudgetGuardrails,
    watchArchiveExperimentKillScaleRules,
    watchArchiveRevenueRiskBridge
  );
  const watchArchivePortfolioRebalanceDraft = buildWatchArchivePortfolioRebalanceDraft(
    watchArchiveCapitalAllocationScoreboard,
    watchArchiveGovernanceExceptionRegister,
    watchArchiveSpendApprovalLanes
  );
  const watchArchiveCapitalCommitteeAgenda = buildWatchArchiveCapitalCommitteeAgenda(
    watchArchiveCapitalAllocationScoreboard,
    watchArchiveGovernanceExceptionRegister,
    watchArchivePortfolioRebalanceDraft
  );
  const watchArchiveExceptionClosureTracker = buildWatchArchiveExceptionClosureTracker(
    watchArchiveGovernanceExceptionRegister,
    watchArchiveSpendApprovalLanes,
    watchArchiveBoardDecisionPacket
  );
  const watchArchiveReallocationOutcomeMap = buildWatchArchiveReallocationOutcomeMap(
    watchArchivePortfolioRebalanceDraft,
    watchArchiveCapitalAllocationScoreboard,
    watchArchiveExperimentOutcomeLedger
  );
  const watchArchiveInvestmentMemoShelf = buildWatchArchiveInvestmentMemoShelf(
    watchArchiveCapitalCommitteeAgenda,
    watchArchiveBoardDecisionPacket,
    watchArchivePortfolioRebalanceDraft
  );
  const watchArchiveExceptionSlaClock = buildWatchArchiveExceptionSlaClock(
    watchArchiveExceptionClosureTracker
  );
  const watchArchiveAllocationPerformanceTimeline = buildWatchArchiveAllocationPerformanceTimeline(
    watchArchiveCapitalAllocationScoreboard,
    watchArchiveReallocationOutcomeMap,
    watchArchiveExperimentOutcomeLedger
  );
  const watchArchiveCommitteeBriefingHistory = buildWatchArchiveCommitteeBriefingHistory(
    watchArchiveInvestmentMemoShelf,
    watchArchiveCapitalCommitteeAgenda,
    watchArchiveBoardDecisionPacket
  );
  const watchArchiveSlaBreachEscalations = buildWatchArchiveSlaBreachEscalations(
    watchArchiveExceptionSlaClock,
    watchArchiveGovernanceExceptionRegister
  );
  const watchArchiveAllocationWinLossLog = buildWatchArchiveAllocationWinLossLog(
    watchArchiveAllocationPerformanceTimeline,
    watchArchiveReallocationOutcomeMap,
    watchArchiveExperimentOutcomeLedger
  );
  const watchArchiveGovernanceNarrativeDraft = buildWatchArchiveGovernanceNarrativeDraft(
    watchArchiveCommitteeBriefingHistory,
    watchArchiveSlaBreachEscalations,
    watchArchiveAllocationWinLossLog
  );
  const watchArchiveEscalationOwnershipMap = buildWatchArchiveEscalationOwnershipMap(
    watchArchiveSlaBreachEscalations,
    watchArchiveSpendApprovalLanes,
    watchArchiveCommitteeBriefingHistory
  );
  const watchArchivePortfolioLessonRegister = buildWatchArchivePortfolioLessonRegister(
    watchArchiveAllocationWinLossLog,
    watchArchiveExperimentOutcomeLedger,
    watchArchiveReallocationOutcomeMap
  );
  const watchArchiveOperatingDoctrineDraft = buildWatchArchiveOperatingDoctrineDraft(
    watchArchiveGovernanceNarrativeDraft,
    watchArchiveEscalationOwnershipMap,
    watchArchivePortfolioLessonRegister
  );
  const watchArchiveRecurringFailureTaxonomy = buildWatchArchiveRecurringFailureTaxonomy(
    watchArchiveSlaBreachEscalations,
    watchArchiveAllocationWinLossLog,
    watchArchivePortfolioLessonRegister
  );
  const watchArchiveAllocationPlaybookIndex = buildWatchArchiveAllocationPlaybookIndex(
    watchArchiveOperatingDoctrineDraft,
    watchArchivePortfolioLessonRegister,
    watchArchiveEscalationOwnershipMap
  );
  const watchArchiveGovernanceMaturityLadder = buildWatchArchiveGovernanceMaturityLadder(
    watchArchiveOperatingDoctrineDraft,
    watchArchiveRecurringFailureTaxonomy,
    watchArchiveAllocationPlaybookIndex
  );
  const watchArchiveFailurePreventionChecklist = buildWatchArchiveFailurePreventionChecklist(
    watchArchiveRecurringFailureTaxonomy,
    watchArchiveEscalationOwnershipMap,
    watchArchiveOperatingDoctrineDraft
  );
  const watchArchiveInstitutionalMemoryShelf = buildWatchArchiveInstitutionalMemoryShelf(
    watchArchivePortfolioLessonRegister,
    watchArchiveAllocationPlaybookIndex,
    watchArchiveGovernanceNarrativeDraft
  );
  const watchArchiveGovernanceHealthScore = buildWatchArchiveGovernanceHealthScore(
    watchArchiveGovernanceMaturityLadder,
    watchArchiveFailurePreventionChecklist,
    watchArchiveInstitutionalMemoryShelf
  );
  const watchArchivePreventionCoverageMap = buildWatchArchivePreventionCoverageMap(
    watchArchiveFailurePreventionChecklist,
    watchArchiveRecurringFailureTaxonomy
  );
  const watchArchiveMemoryGapRegister = buildWatchArchiveMemoryGapRegister(
    watchArchiveInstitutionalMemoryShelf,
    watchArchiveAllocationPlaybookIndex,
    watchArchiveGovernanceNarrativeDraft
  );
  const watchArchiveGovernanceRoadmapDraft = buildWatchArchiveGovernanceRoadmapDraft(
    watchArchiveGovernanceHealthScore,
    watchArchivePreventionCoverageMap,
    watchArchiveMemoryGapRegister
  );
  const watchArchiveCoverageUpliftQueue = buildWatchArchiveCoverageUpliftQueue(
    watchArchivePreventionCoverageMap,
    watchArchiveRecurringFailureTaxonomy
  );
  const watchArchiveMemoryCaptureBacklog = buildWatchArchiveMemoryCaptureBacklog(
    watchArchiveMemoryGapRegister,
    watchArchiveInstitutionalMemoryShelf,
    watchArchiveAllocationPlaybookIndex
  );
  const watchArchiveGovernanceSprintPlanner = buildWatchArchiveGovernanceSprintPlanner(
    watchArchiveGovernanceRoadmapDraft,
    watchArchiveCoverageUpliftQueue,
    watchArchiveMemoryCaptureBacklog
  );
  const watchArchiveUpliftRoiTracker = buildWatchArchiveUpliftRoiTracker(
    watchArchiveCoverageUpliftQueue,
    watchArchiveGovernanceHealthScore,
    watchArchiveRecurringFailureTaxonomy
  );
  const watchArchiveMemoryCompletionBurndown = buildWatchArchiveMemoryCompletionBurndown(
    watchArchiveMemoryCaptureBacklog,
    watchArchiveInstitutionalMemoryShelf
  );
  const watchArchiveGovernanceReleaseGate = buildWatchArchiveGovernanceReleaseGate(
    watchArchiveGovernanceSprintPlanner,
    watchArchiveUpliftRoiTracker,
    watchArchiveMemoryCompletionBurndown
  );
  const watchArchiveUpliftAcceptanceCriteria = buildWatchArchiveUpliftAcceptanceCriteria(
    watchArchiveUpliftRoiTracker,
    watchArchivePreventionCoverageMap
  );
  const watchArchiveMemoryDoneDefinition = buildWatchArchiveMemoryDoneDefinition(
    watchArchiveMemoryCompletionBurndown,
    watchArchiveInstitutionalMemoryShelf,
    watchArchiveMemoryCaptureBacklog
  );
  const watchArchiveGovernanceLaunchChecklist = buildWatchArchiveGovernanceLaunchChecklist(
    watchArchiveGovernanceReleaseGate,
    watchArchiveUpliftAcceptanceCriteria,
    watchArchiveMemoryDoneDefinition
  );
  const watchArchiveAcceptanceEvidencePack = buildWatchArchiveAcceptanceEvidencePack(
    watchArchiveUpliftAcceptanceCriteria,
    watchArchiveGovernanceHealthScore,
    watchArchivePreventionCoverageMap
  );
  const watchArchiveCompletionCertificateDraft = buildWatchArchiveCompletionCertificateDraft(
    watchArchiveGovernanceReleaseGate,
    watchArchiveMemoryDoneDefinition,
    watchArchiveGovernanceHealthScore
  );
  const watchArchiveGovernanceSignoffLane = buildWatchArchiveGovernanceSignoffLane(
    watchArchiveGovernanceLaunchChecklist,
    watchArchiveAcceptanceEvidencePack,
    watchArchiveCompletionCertificateDraft
  );
  const watchArchiveEvidenceTraceMatrix = buildWatchArchiveEvidenceTraceMatrix(
    watchArchiveAcceptanceEvidencePack,
    watchArchiveGovernanceLaunchChecklist,
    watchArchiveUpliftAcceptanceCriteria
  );
  const watchArchiveCompletionAuditStamp = buildWatchArchiveCompletionAuditStamp(
    watchArchiveCompletionCertificateDraft,
    watchArchiveGovernanceHealthScore,
    watchArchiveGovernanceReleaseGate
  );
  const watchArchiveReleaseDossier = buildWatchArchiveReleaseDossier(
    watchArchiveGovernanceSignoffLane,
    watchArchiveEvidenceTraceMatrix,
    watchArchiveCompletionAuditStamp
  );
  const watchArchiveApproverChecklistMatrix = buildWatchArchiveApproverChecklistMatrix(
    watchArchiveGovernanceSignoffLane,
    watchArchiveGovernanceLaunchChecklist,
    watchArchiveUpliftAcceptanceCriteria
  );
  const watchArchiveAuditArchiveIndex = buildWatchArchiveAuditArchiveIndex(
    watchArchiveCompletionAuditStamp,
    watchArchiveAcceptanceEvidencePack,
    watchArchiveCompletionCertificateDraft
  );
  const watchArchiveGovernanceDossierNavigator = buildWatchArchiveGovernanceDossierNavigator(
    watchArchiveReleaseDossier,
    watchArchiveApproverChecklistMatrix,
    watchArchiveAuditArchiveIndex
  );
  const watchArchiveApprovalDependencyGraph = buildWatchArchiveApprovalDependencyGraph(
    watchArchiveApproverChecklistMatrix,
    watchArchiveGovernanceSignoffLane,
    watchArchiveEvidenceTraceMatrix
  );
  const watchArchiveAuditRetrievalShelf = buildWatchArchiveAuditRetrievalShelf(
    watchArchiveAuditArchiveIndex,
    watchArchiveReleaseDossier,
    watchArchiveCompletionAuditStamp
  );
  const watchArchiveGovernanceSearchIndex = buildWatchArchiveGovernanceSearchIndex(
    watchArchiveGovernanceDossierNavigator,
    watchArchiveAuditRetrievalShelf,
    watchArchiveGovernanceNarrativeDraft
  );
  const watchArchiveDependencyRiskScanner = buildWatchArchiveDependencyRiskScanner(
    watchArchiveApprovalDependencyGraph,
    watchArchiveGovernanceSignoffLane,
    watchArchiveEvidenceTraceMatrix
  );
  const watchArchiveAuditQueryPresets = buildWatchArchiveAuditQueryPresets(
    watchArchiveAuditRetrievalShelf,
    watchArchiveAuditArchiveIndex,
    watchArchiveEvidenceTraceMatrix
  );
  const watchArchiveGovernanceCommandPalette = buildWatchArchiveGovernanceCommandPalette(
    watchArchiveGovernanceSearchIndex,
    watchArchiveAuditQueryPresets,
    watchArchiveGovernanceDossierNavigator
  );
  const watchArchiveRiskTriageQueue = buildWatchArchiveRiskTriageQueue(
    watchArchiveDependencyRiskScanner,
    watchArchiveApprovalDependencyGraph,
    watchArchiveGovernanceSignoffLane
  );
  const watchArchiveAuditQuickOpenSet = buildWatchArchiveAuditQuickOpenSet(
    watchArchiveAuditQueryPresets,
    watchArchiveAuditRetrievalShelf,
    watchArchiveAuditArchiveIndex
  );
  const watchArchiveSavedOperatorMacros = buildWatchArchiveSavedOperatorMacros(
    watchArchiveGovernanceCommandPalette,
    watchArchiveAuditQuickOpenSet,
    watchArchiveRiskTriageQueue
  );
  const watchArchiveTriageEscalationShortcuts = buildWatchArchiveTriageEscalationShortcuts(
    watchArchiveRiskTriageQueue,
    watchArchiveDependencyRiskScanner,
    watchArchiveApprovalDependencyGraph
  );
  const watchArchiveAuditWorkspaceLauncher = buildWatchArchiveAuditWorkspaceLauncher(
    watchArchiveAuditQuickOpenSet,
    watchArchiveGovernanceSearchIndex,
    watchArchiveAuditQueryPresets
  );
  const {
    watchArchiveMacroRunHistory,
    watchArchiveEscalationOutcomeBoard,
    watchArchiveWorkspaceContextSnapshots,
    watchArchiveOperatorEffectivenessScore,
    watchArchiveEscalationLatencyCards,
    watchArchiveWorkspaceReplayLane,
    watchArchiveOperatorCoachingPrompts,
    watchArchiveLatencyBreachAlarms,
    watchArchiveReplayToTrainingPack,
    watchArchiveOperatorReadinessScore,
    watchArchiveOnCallDrillQueue,
    watchArchiveTrainingCompletionLane,
    watchArchiveCertificationLadder,
    watchArchiveDrillFailureReview,
    watchArchiveReadinessTrendline,
    watchArchiveOperatorPromotionCriteria,
    watchArchiveRemediationPlanCards,
    watchArchiveReadinessForecastWindow,
    watchArchiveStaffingBenchMap,
    watchArchiveReadinessRiskHedge,
    watchArchivePromotionDecisionMemo,
    watchArchiveCoverageGapHeatmap,
    watchArchiveSuccessionReadinessSlate,
    watchArchivePromotionReviewDocket,
    watchArchiveLeadershipStaffingBrief,
    watchArchiveSuccessionRiskRegister,
    watchArchiveReviewOutcomeTracker,
    watchArchiveLeadershipActionQueue,
    watchArchiveSuccessionMitigationPlan,
    watchArchiveReviewClosureLog,
    watchArchiveLeadershipFollowThroughBoard,
    watchArchiveMitigationSlaClock,
    watchArchiveClosureEvidencePack,
    watchArchiveExecutiveAccountabilityLane,
    watchArchiveOverdueMitigationEscalations,
    watchArchiveClosureAuditSummary,
    watchArchiveExecReviewAgenda,
    watchArchiveEscalationBurndown,
    watchArchiveAuditConfidenceBanner,
    watchArchiveExecutiveSignoffReadiness,
    watchArchiveEscalationRecoveryForecast,
    watchArchiveAuditExceptionCallouts,
    watchArchiveBoardSignoffPacket,
    watchArchiveRecoveryWarRoomQueue,
    watchArchiveExceptionDispositionLog,
    watchArchiveBoardDecisionLedger,
    watchArchiveWarRoomResolutionTimeline
  } = globalThis.buildMusicDeliveryDashboardWatchOpsModule?.({
    watchArchiveSavedOperatorMacros,
    watchArchiveRiskTriageQueue,
    watchArchiveAuditWorkspaceLauncher,
    watchArchiveTriageEscalationShortcuts,
    watchArchiveDependencyRiskScanner,
    watchArchiveGovernanceSearchIndex,
    watchArchiveAuditQuickOpenSet,
    watchArchiveGovernanceCommandPalette
  }) || {};
  const watchArchiveExceptionClosureCertificate = buildWatchArchiveExceptionClosureCertificate(
    watchArchiveExceptionDispositionLog,
    watchArchiveClosureAuditSummary,
    watchArchiveAuditConfidenceBanner
  );
  const watchArchiveBoardActionFollowThrough = buildWatchArchiveBoardActionFollowThrough(
    watchArchiveBoardDecisionLedger,
    watchArchiveLeadershipFollowThroughBoard,
    watchArchiveExecutiveSignoffReadiness
  );
  const watchArchiveWarRoomExitCriteria = buildWatchArchiveWarRoomExitCriteria(
    watchArchiveWarRoomResolutionTimeline,
    watchArchiveEscalationRecoveryForecast,
    watchArchiveExceptionClosureCertificate
  );
  const watchArchiveCertifiedExceptionArchive = buildWatchArchiveCertifiedExceptionArchive(
    watchArchiveExceptionClosureCertificate,
    watchArchiveExceptionDispositionLog,
    watchArchiveAuditArchiveIndex
  );
  const watchArchiveBoardClosureMemo = buildWatchArchiveBoardClosureMemo(
    watchArchiveBoardActionFollowThrough,
    watchArchiveBoardDecisionLedger,
    watchArchiveExecutiveSignoffReadiness
  );
  const watchArchiveWarRoomStandDownChecklist = buildWatchArchiveWarRoomStandDownChecklist(
    watchArchiveWarRoomExitCriteria,
    watchArchiveWarRoomResolutionTimeline,
    watchArchiveEscalationBurndown
  );
  const watchArchiveCertifiedArchiveLedger = buildWatchArchiveCertifiedArchiveLedger(
    watchArchiveCertifiedExceptionArchive,
    watchArchiveExceptionClosureCertificate,
    watchArchiveAuditArchiveIndex
  );
  const watchArchiveGovernanceClosureDashboard = buildWatchArchiveGovernanceClosureDashboard(
    watchArchiveBoardClosureMemo,
    watchArchiveWarRoomExitCriteria,
    watchArchiveCertifiedExceptionArchive
  );
  const watchArchiveStandDownApprovalLane = buildWatchArchiveStandDownApprovalLane(
    watchArchiveWarRoomStandDownChecklist,
    watchArchiveExecutiveSignoffReadiness,
    watchArchiveBoardClosureMemo
  );
  const watchArchiveRetentionPolicyCards = buildWatchArchiveRetentionPolicyCards(
    watchArchiveCertifiedArchiveLedger,
    watchArchiveCertifiedExceptionArchive,
    watchArchiveAuditArchiveIndex
  );
  const watchArchiveClosureReadinessScore = buildWatchArchiveClosureReadinessScore(
    watchArchiveGovernanceClosureDashboard,
    watchArchiveStandDownApprovalLane,
    watchArchiveRetentionPolicyCards
  );
  const watchArchiveApprovalBottleneckMap = buildWatchArchiveApprovalBottleneckMap(
    watchArchiveStandDownApprovalLane,
    watchArchiveWarRoomStandDownChecklist,
    watchArchiveBoardActionFollowThrough
  );
  const watchArchiveRetentionComplianceChecklist = buildWatchArchiveRetentionComplianceChecklist(
    watchArchiveRetentionPolicyCards,
    watchArchiveCertifiedArchiveLedger,
    watchArchiveCertifiedExceptionArchive
  );
  const watchArchiveClosureEscalationLadder = buildWatchArchiveClosureEscalationLadder(
    watchArchiveClosureReadinessScore,
    watchArchiveApprovalBottleneckMap,
    watchArchiveGovernanceClosureDashboard
  );
  const watchArchiveBottleneckRecoveryPlaybook = buildWatchArchiveBottleneckRecoveryPlaybook(
    watchArchiveApprovalBottleneckMap,
    watchArchiveWarRoomStandDownChecklist,
    watchArchiveClosureReadinessScore
  );
  const watchArchiveComplianceSignoffCard = buildWatchArchiveComplianceSignoffCard(
    watchArchiveRetentionComplianceChecklist,
    watchArchiveClosureReadinessScore,
    watchArchiveExecutiveSignoffReadiness
  );
  const watchArchiveClosureControlTower = buildWatchArchiveClosureControlTower(
    watchArchiveClosureEscalationLadder,
    watchArchiveClosureReadinessScore,
    watchArchiveGovernanceClosureDashboard
  );
  const watchArchiveRecoveryAssignmentBoard = buildWatchArchiveRecoveryAssignmentBoard(
    watchArchiveBottleneckRecoveryPlaybook,
    watchArchiveApprovalBottleneckMap,
    watchArchiveStandDownApprovalLane
  );
  const watchArchiveSignoffEvidenceWallet = buildWatchArchiveSignoffEvidenceWallet(
    watchArchiveComplianceSignoffCard,
    watchArchiveRetentionComplianceChecklist,
    watchArchiveCertifiedArchiveLedger
  );
  const watchArchiveClosureOperationsCockpit = buildWatchArchiveClosureOperationsCockpit(
    watchArchiveClosureControlTower,
    watchArchiveClosureEscalationLadder,
    watchArchiveComplianceSignoffCard
  );
  const watchArchiveAssignmentSlaRails = buildWatchArchiveAssignmentSlaRails(
    watchArchiveRecoveryAssignmentBoard,
    watchArchiveStandDownApprovalLane,
    watchArchiveMitigationSlaClock
  );
  const watchArchiveEvidenceSufficiencyMeter = buildWatchArchiveEvidenceSufficiencyMeter(
    watchArchiveSignoffEvidenceWallet,
    watchArchiveComplianceSignoffCard,
    watchArchiveRetentionComplianceChecklist
  );
  const watchArchiveClosureKpiStrip = buildWatchArchiveClosureKpiStrip(
    watchArchiveClosureOperationsCockpit,
    watchArchiveClosureReadinessScore,
    watchArchiveEvidenceSufficiencyMeter
  );
  const watchArchiveAssignmentBreachAlerts = buildWatchArchiveAssignmentBreachAlerts(
    watchArchiveAssignmentSlaRails,
    watchArchiveApprovalBottleneckMap,
    watchArchiveClosureEscalationLadder
  );
  const watchArchiveEvidenceGapActions = buildWatchArchiveEvidenceGapActions(
    watchArchiveEvidenceSufficiencyMeter,
    watchArchiveRetentionComplianceChecklist,
    watchArchiveComplianceSignoffCard
  );
  const watchArchiveClosureDailyBrief = buildWatchArchiveClosureDailyBrief(
    watchArchiveClosureKpiStrip,
    watchArchiveClosureOperationsCockpit,
    watchArchiveEvidenceSufficiencyMeter
  );
  const watchArchiveBreachTriageLadder = buildWatchArchiveBreachTriageLadder(
    watchArchiveAssignmentBreachAlerts,
    watchArchiveClosureEscalationLadder,
    watchArchiveAssignmentSlaRails
  );
  const watchArchiveEvidenceCollectionQueue = buildWatchArchiveEvidenceCollectionQueue(
    watchArchiveEvidenceGapActions,
    watchArchiveSignoffEvidenceWallet,
    watchArchiveRetentionComplianceChecklist
  );
  const watchArchiveClosureShiftHandoff = buildWatchArchiveClosureShiftHandoff(
    watchArchiveClosureDailyBrief,
    watchArchiveClosureOperationsCockpit,
    watchArchiveRecoveryAssignmentBoard
  );
  const watchArchiveTriagePriorityBoard = buildWatchArchiveTriagePriorityBoard(
    watchArchiveBreachTriageLadder,
    watchArchiveAssignmentBreachAlerts,
    watchArchiveClosureKpiStrip
  );
  const watchArchiveEvidencePickupLog = buildWatchArchiveEvidencePickupLog(
    watchArchiveEvidenceCollectionQueue,
    watchArchiveSignoffEvidenceWallet,
    watchArchiveEvidenceSufficiencyMeter
  );
  const watchArchiveShiftContinuityCard = buildWatchArchiveShiftContinuityCard(
    watchArchiveClosureShiftHandoff,
    watchArchiveClosureDailyBrief,
    watchArchiveClosureOperationsCockpit
  );
  const watchArchiveTriageLoadBalancer = buildWatchArchiveTriageLoadBalancer(
    watchArchiveTriagePriorityBoard,
    watchArchiveRecoveryAssignmentBoard,
    watchArchiveAssignmentSlaRails
  );
  const watchArchiveEvidenceAgingView = buildWatchArchiveEvidenceAgingView(
    watchArchiveEvidencePickupLog,
    watchArchiveEvidenceCollectionQueue,
    watchArchiveEvidenceSufficiencyMeter
  );
  const watchArchiveShiftRiskPulse = buildWatchArchiveShiftRiskPulse(
    watchArchiveShiftContinuityCard,
    watchArchiveClosureShiftHandoff,
    watchArchiveTriagePriorityBoard
  );
  const watchArchiveRebalanceRecommendationQueue = buildWatchArchiveRebalanceRecommendationQueue(
    watchArchiveTriageLoadBalancer,
    watchArchiveTriagePriorityBoard,
    watchArchiveRecoveryAssignmentBoard
  );
  const watchArchiveStaleEvidenceRescuePlan = buildWatchArchiveStaleEvidenceRescuePlan(
    watchArchiveEvidenceAgingView,
    watchArchiveEvidenceCollectionQueue,
    watchArchiveEvidenceGapActions
  );
  const watchArchiveShiftStabilizationBoard = buildWatchArchiveShiftStabilizationBoard(
    watchArchiveShiftRiskPulse,
    watchArchiveShiftContinuityCard,
    watchArchiveClosureShiftHandoff
  );
  const watchArchiveRebalanceExecutionTracker = buildWatchArchiveRebalanceExecutionTracker(
    watchArchiveRebalanceRecommendationQueue,
    watchArchiveTriageLoadBalancer,
    watchArchiveRecoveryAssignmentBoard
  );
  const watchArchiveRescuedEvidenceOutcomes = buildWatchArchiveRescuedEvidenceOutcomes(
    watchArchiveStaleEvidenceRescuePlan,
    watchArchiveEvidencePickupLog,
    watchArchiveEvidenceAgingView
  );
  const watchArchiveStabilizationConfidenceBand = buildWatchArchiveStabilizationConfidenceBand(
    watchArchiveShiftStabilizationBoard,
    watchArchiveShiftRiskPulse,
    watchArchiveClosureReadinessScore
  );
  const watchArchiveExecutionDriftAlerts = buildWatchArchiveExecutionDriftAlerts(
    watchArchiveRebalanceExecutionTracker,
    watchArchiveRebalanceRecommendationQueue,
    watchArchiveAssignmentSlaRails
  );
  const watchArchiveEvidenceRecoveryScoreboard = buildWatchArchiveEvidenceRecoveryScoreboard(
    watchArchiveRescuedEvidenceOutcomes,
    watchArchiveEvidenceSufficiencyMeter,
    watchArchiveSignoffEvidenceWallet
  );
  const watchArchiveStabilizationWatchlist = buildWatchArchiveStabilizationWatchlist(
    watchArchiveStabilizationConfidenceBand,
    watchArchiveShiftRiskPulse,
    watchArchiveShiftStabilizationBoard
  );
  const watchArchiveDriftCorrectionQueue = buildWatchArchiveDriftCorrectionQueue(
    watchArchiveExecutionDriftAlerts,
    watchArchiveRebalanceExecutionTracker,
    watchArchiveRebalanceRecommendationQueue
  );
  const watchArchiveRecoveryProofPack = buildWatchArchiveRecoveryProofPack(
    watchArchiveEvidenceRecoveryScoreboard,
    watchArchiveRescuedEvidenceOutcomes,
    watchArchiveSignoffEvidenceWallet
  );
  const watchArchiveStabilizationHandoffMemo = buildWatchArchiveStabilizationHandoffMemo(
    watchArchiveStabilizationWatchlist,
    watchArchiveShiftStabilizationBoard,
    watchArchiveClosureShiftHandoff
  );
  const watchArchiveCorrectionCompletionTracker = buildWatchArchiveCorrectionCompletionTracker(
    watchArchiveDriftCorrectionQueue,
    watchArchiveRebalanceExecutionTracker,
    watchArchiveExecutionDriftAlerts
  );
  const watchArchiveProofAcceptanceCard = buildWatchArchiveProofAcceptanceCard(
    watchArchiveRecoveryProofPack,
    watchArchiveEvidenceRecoveryScoreboard,
    watchArchiveSignoffEvidenceWallet
  );
  const watchArchiveHandoffReadinessBadge = buildWatchArchiveHandoffReadinessBadge(
    watchArchiveStabilizationHandoffMemo,
    watchArchiveStabilizationConfidenceBand,
    watchArchiveClosureShiftHandoff
  );
  const watchArchiveCorrectionClosureQueue = buildWatchArchiveCorrectionClosureQueue(
    watchArchiveCorrectionCompletionTracker,
    watchArchiveDriftCorrectionQueue,
    watchArchiveRebalanceExecutionTracker
  );
  const watchArchiveProofSignoffChecklist = buildWatchArchiveProofSignoffChecklist(
    watchArchiveProofAcceptanceCard,
    watchArchiveSignoffEvidenceWallet,
    watchArchiveEvidenceRecoveryScoreboard
  );
  const watchArchiveClosureSignoffGate = buildWatchArchiveClosureSignoffGate(
    watchArchiveHandoffReadinessBadge,
    watchArchiveProofSignoffChecklist,
    watchArchiveProofAcceptanceCard
  );
  const watchArchiveHandoffCompletionReceipt = buildWatchArchiveHandoffCompletionReceipt(
    watchArchiveHandoffReadinessBadge,
    watchArchiveStabilizationHandoffMemo,
    watchArchiveClosureShiftHandoff
  );
  const watchArchiveCorrectionAuditTrail = buildWatchArchiveCorrectionAuditTrail(
    watchArchiveCorrectionClosureQueue,
    watchArchiveCorrectionCompletionTracker,
    watchArchiveExecutionDriftAlerts
  );
  const {
    patchBundleJson = "{}",
    focusedDiff = null,
    focusedRevision = null,
    releaseCandidateInputValue = "",
    focusedRevisionDiff = null,
    publishCandidateId = ""
  } =
    globalThis.buildMusicDeliveryPatchBundleStateBridge?.({
      rewritePatchBundle,
      rewriteBundleDiffs,
      arrangementRevisions,
      arrangementRevisionHead,
      arrangementLockedRevision,
      arrangementPublishedRevision,
      arrangementRevisionDiffs
    }) || {};
  const missingSignerRoles = missingRequiredSignerRoles(approvalToPublishTrace);
  const currentActor =
    complianceActorIdentity?.actor_identity ||
    {
      actor_id: complianceActorIdValue,
      actor_name: complianceActorNameValue,
      actor_role: complianceActorRoleValue
    };
  const suggestedRole = missingSignerRoles[0] || (approvalToPublishTrace?.quorum_met ? "" : "operator");
  const suggestedActor = findSuggestedActorForRole(complianceActorDirectory, suggestedRole, currentActor);
  const routingShortcuts = Array.isArray(complianceApproverRouting)
    ? complianceApproverRouting.map((route, index) => {
        const requiredRole = String(route?.required_role || "").trim().toLowerCase();
        const actor = findSuggestedActorForRole(complianceActorDirectory, requiredRole, currentActor);
        return {
          id: String(route?.step || `route-${index}`),
          label: String(route?.step || `step-${index + 1}`),
          requiredRole,
          team: String(route?.team || ""),
          actor
        };
      })
    : [];
  const readinessChecklist = [
    {
      id: "locked_revision",
      label: dashboardCopy("Locked revision selected", "已锁定发布 revision"),
      ready: !!arrangementLockedRevision
    },
    {
      id: "required_signers",
      label: dashboardCopy("Required signers collected", "所需签发人已到位"),
      ready: !missingSignerRoles.length
    },
    {
      id: "quorum",
      label: dashboardCopy("Release quorum met", "发布 quorum 已达成"),
      ready: !!approvalToPublishTrace?.quorum_met
    },
    {
      id: "gate",
      label: dashboardCopy("Publish gate unlocked", "发布门已解锁"),
      ready: String(complianceLockedPublishGate?.gate_state || "") === "unlocked"
    },
    {
      id: "token",
      label: dashboardCopy("Unblock token issued", "放行 token 已签发"),
      ready: String(complianceReleaseUnblockToken?.status || "") === "issued"
    },
    {
      id: "authorization",
      label: dashboardCopy("Immutable publish authorization granted", "不可变发布授权已签发"),
      ready:
        String(complianceImmutablePublishAuthorization?.authorization_state || "") === "authorized"
    }
  ];
  const guidedPlaybook = [
    {
      id: "pick_actor",
      label: dashboardCopy("Switch to the next suggested signer", "切换到下一个建议签发人"),
      done: !suggestedRole,
      detail: suggestedRole
        ? dashboardCopy(
            `Suggested role: ${suggestedRole}${suggestedActor ? ` via ${suggestedActor.actor_name || suggestedActor.actor_id}` : ""}`,
            `建议角色：${suggestedRole}${suggestedActor ? `，建议人：${suggestedActor.actor_name || suggestedActor.actor_id}` : ""}`
          )
        : dashboardCopy("No signer switch is needed now.", "当前不需要切换签发人。")
    },
    {
      id: "collect_signoff",
      label: dashboardCopy("Collect remaining sign-offs", "收集剩余签发"),
      done: !missingSignerRoles.length,
      detail: missingSignerRoles.length
        ? dashboardCopy(
            `Still missing: ${missingSignerRoles.join(", ")}`,
            `仍缺少：${missingSignerRoles.join("、")}`
          )
        : dashboardCopy("All required signer roles are already covered.", "所有必需签发角色都已覆盖。")
    },
    {
      id: "finalize_gate",
      label: dashboardCopy("Finalize the publish gate", "完成发布门禁检查"),
      done: !!approvalToPublishTrace?.quorum_met,
      detail: approvalToPublishTrace?.quorum_met
        ? dashboardCopy("Quorum is already met.", "当前 quorum 已达成。")
        : dashboardCopy("Run the final gate check after sign-offs are complete.", "签发完成后执行最终门禁检查。")
    },
    {
      id: "publish_ready",
      label: dashboardCopy("Publish the locked revision", "发布锁定版本"),
      done: readinessChecklist.every((item) => item.ready),
      detail: readinessChecklist.every((item) => item.ready)
        ? dashboardCopy("All publish conditions are green.", "所有发布条件已变绿。")
        : dashboardCopy("Wait until every checklist row is READY.", "等所有清单项都变成 READY。")
    }
  ];
  const publishSimulation = buildPublishSimulation(
    readinessChecklist,
    missingSignerRoles,
    suggestedRole,
    suggestedActor
  );
  const blockerSpecificCopy = blockerSpecificPublishCopy(blockedPublishExplainer?.missing_steps);
  const publishOutcomeEstimator = estimatePublishOutcome(
    readinessChecklist,
    blockedPublishExplainer,
    missingSignerRoles
  );
  const approvalSlaForecast = forecastApprovalSla(
    complianceClock,
    missingSignerRoles,
    approvalToPublishTrace
  );
  releaseRiskBanner = buildReleaseRiskBanner(
    readinessChecklist,
    complianceFlags,
    complianceClock,
    blockedPublishExplainer
  );
  const requiresPublishAcknowledgment =
    releaseRiskBanner.level !== "low" || !!blockedPublishExplainer?.blocked;
  const publishButtonEnabled =
    !!focusedRevision &&
    !deliveryDashboardState.arrangementRevisionActionSaving &&
    (!requiresPublishAcknowledgment || deliveryDashboardState.publishConfirmationArmed);
  postPublishWatchlist = buildPostPublishWatchlist(
    complianceFlags,
    complianceClock,
    releaseRiskBanner
  );
  const rewriteBundleHistoryHtml = rewriteBundleHistory.length
    ? rewriteBundleHistory
        .map(
          (entry) => `
            <div class="report-list-item">
              <div class="report-preview-title">${escapeHtml(entry.version_name || entry.bundle_id || "rewrite bundle")}</div>
              <div class="report-card-copy">${escapeHtml(
                `${entry.saved_at || "saved"} · ${formatFileBytes(entry.bytes || 0)} · ${entry.bundle_id || ""}`
              )}</div>
              <div class="report-card-copy">${escapeHtml(
                entry.bundle?.section?.label || entry.bundle?.section?.id || "Saved rewrite patch bundle"
              )}</div>
              <div class="report-export-actions" style="flex-wrap:wrap;">
                <button class="report-export-action ${deliveryDashboardState.restoredRewriteBundleId === String(entry.bundle_id || "") ? "" : "is-muted"}" type="button" data-delivery-rewrite-bundle-restore='${escapeHtml(JSON.stringify(entry.bundle || {}))}'>Restore Bundle</button>
                <button class="report-export-action ${deliveryDashboardState.rewritePromotionSaving ? "is-muted" : ""}" type="button" data-delivery-rewrite-bundle-promote="${escapeHtml(entry.bundle_id || "")}" ${
                  deliveryDashboardState.rewritePromotionSaving ? "disabled" : ""
                }>Promote To Provider Job</button>
                ${buildDeliveryArtifactOpenControl(
                  deliveryDashboardState.runId || "",
                  buildRewriteBundleHistoryArtifactItem(entry),
                  "Open JSON"
                )}
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy("Saved rewrite bundle history will appear here after the first run-level save.", "第一次保存到 run 级资产后，这里会出现 bundle 历史。")
      )}</div>`;
  const patchBundleHtml = sectionPhrases.length
    ? `
        <div class="report-list-item">
          <div class="report-preview-title">Commit Rewrite Patch Bundle</div>
          <div class="report-card-copy">${escapeHtml(
            dashboardCopy(
              "Export the currently selected sandbox rewrite as a reusable patch bundle for later save/apply flows.",
              "把当前选中的沙盒改写导出成可复用的 patch bundle，供后续保存和应用。"
            )
          )}</div>
          <div class="report-export-actions" style="flex-wrap:wrap;">
            <button class="report-export-action" type="button" data-delivery-rewrite-bundle-commit='${escapeHtml(JSON.stringify(rewritePatchBundle))}'>Commit Current Bundle</button>
            <input class="billing-input" type="text" placeholder="Version Name" value="${escapeHtml(
              deliveryDashboardState.rewritePatchBundleVersionName || ""
            )}" data-delivery-rewrite-bundle-version />
            <button class="report-export-action ${deliveryDashboardState.rewritePatchBundleSaving ? "is-muted" : ""}" type="button" data-delivery-rewrite-bundle-save='${escapeHtml(
              JSON.stringify(deliveryDashboardState.rewritePatchBundle || rewritePatchBundle)
            )}' ${deliveryDashboardState.runId && !deliveryDashboardState.rewritePatchBundleSaving ? "" : "disabled"}>${
              deliveryDashboardState.rewritePatchBundleSaving ? "Saving..." : "Save To Run"
            }</button>
          </div>
          <div class="report-list" style="margin-top:8px;">
            <div class="report-list-item">
              <div class="report-preview-title">${escapeHtml(
                deliveryDashboardState.rewritePatchBundle
                  ? "Committed Patch Bundle"
                  : "Pending Patch Bundle"
              )}</div>
              <div class="report-card-copy">${escapeHtml(
                deliveryDashboardState.rewritePatchBundle
                  ? dashboardCopy("This bundle has been frozen from the current sandbox selection.", "这个 bundle 已经从当前沙盒选择冻结下来。")
                  : dashboardCopy("Commit the current rewrite to freeze it as a reusable patch bundle.", "提交当前改写后，就会冻结成一个可复用的 patch bundle。")
              )}</div>
            </div>
            <div class="report-list-item">
              <pre class="report-preview-code">${escapeHtml(patchBundleJson)}</pre>
            </div>
            ${
              deliveryDashboardState.rewritePatchBundleError
                ? `<div class="report-list-item"><div class="report-card-copy">${escapeHtml(deliveryDashboardState.rewritePatchBundleError)}</div></div>`
                : ""
            }
            ${
              deliveryDashboardState.rewritePromotionError
                ? `<div class="report-list-item"><div class="report-card-copy">${escapeHtml(deliveryDashboardState.rewritePromotionError)}</div></div>`
                : ""
            }
            <div class="report-list-item">
              <div class="report-preview-title">Patch Bundle History</div>
              <div class="report-card-copy">${escapeHtml(
                dashboardCopy(
                  "Saved bundles are persisted as run-level rewrite artifacts and can be restored back into the current sandbox.",
                  "保存后的 bundle 会成为 run 级 rewrite 资产，并可以恢复回当前沙盒。"
                )
              )}</div>
            </div>
            ${rewriteBundleHistoryHtml}
            <div class="report-list-item">
              <div class="report-preview-title">Patch History Diff</div>
              <div class="report-card-copy">${escapeHtml(
                dashboardCopy(
                  "Compare adjacent saved bundle versions before promoting one into the provider execution lane.",
                  "在将某个版本正式下发到 provider 执行链之前，先对比相邻 bundle 版本差异。"
                )
              )}</div>
              <div class="report-export-actions" style="flex-wrap:wrap;">
                ${rewriteBundleDiffs
                  .map(
                    (diff) => `<button class="report-export-action ${
                      deliveryDashboardState.rewriteBundleDiffFocus === `${diff.from_bundle_id}->${diff.to_bundle_id}` ? "" : "is-muted"
                    }" type="button" data-delivery-rewrite-diff-focus="${escapeHtml(
                      `${diff.from_bundle_id}->${diff.to_bundle_id}`
                    )}">${escapeHtml(`${diff.from_version_name} -> ${diff.to_version_name}`)}</button>`
                  )
                  .join("") || `<span class="report-card-copy">${escapeHtml(
                    dashboardCopy("Need at least two saved bundles to compare diff.", "至少需要两个已保存 bundle 才能比较 diff。")
                  )}</span>`}
              </div>
            </div>
            ${
              focusedDiff
                ? `<div class="report-list-item">
                    <pre class="report-preview-code">${escapeHtml(JSON.stringify(focusedDiff, null, 2))}</pre>
                  </div>`
                : ""
            }
            <div class="report-list-item">
              <div class="report-preview-title">Provider Promotion History</div>
              <div class="report-card-copy">${escapeHtml(
                dashboardCopy(
                  "Promoted rewrite bundles are tracked as provider-job handoff artifacts.",
                  "已提升的 rewrite bundle 会作为 provider job 交接资产持续记录。"
                )
              )}</div>
            </div>
            ${
              rewritePromotions.length
                ? rewritePromotions
                    .map(
                      (entry) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(entry.version_name || entry.bundle_id || "promotion")}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${entry.promoted_at || "promoted"} · ${entry.bundle_id || ""}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `Status: ${entry.job_status?.status || entry.payload?.status || "queued"} · Job: ${entry.job_status?.job_id || "pending"}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `Apply-back: ${entry.apply_back_result?.status || "pending_apply_back"}`
                          )}</div>
                          <div class="report-export-actions" style="flex-wrap:wrap;">
                            ${
                              entry.execution_queue_path
                                ? buildRunArtifactOpenControl(
                                    deliveryDashboardState.runId || "",
                                    entry.execution_queue_path,
                                    "Open Queue",
                                    { assetKey: entry.execution_queue_asset_key || "" }
                                  )
                                : ""
                            }
                            ${
                              entry.job_status_path
                                ? buildRunArtifactOpenControl(
                                    deliveryDashboardState.runId || "",
                                    entry.job_status_path,
                                    "Open Job Status",
                                    { assetKey: entry.job_status_asset_key || "" }
                                  )
                                : ""
                            }
                            ${
                              entry.apply_back_result_path
                                ? buildRunArtifactOpenControl(
                                    deliveryDashboardState.runId || "",
                                    entry.apply_back_result_path,
                                    "Open Apply-Back",
                                    { assetKey: entry.apply_back_result_asset_key || "" }
                                  )
                                : ""
                            }
                            ${buildDeliveryArtifactOpenControl(
                              deliveryDashboardState.runId || "",
                              buildRewritePromotionArtifactItem(entry),
                              "Open Promotion JSON"
                            )}
                          </div>
                        </div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("No provider promotion has been recorded yet.", "当前还没有记录任何 provider promotion。")
                  )}</div>`
            }
            <div class="report-list-item">
              <div class="report-preview-title">Arrangement Revision Chain</div>
              <div class="report-card-copy">${escapeHtml(
                dashboardCopy(
                  "Applied-back revisions can now be compared, rolled back, and merged forward as a formal arrangement version chain.",
                  "apply-back 修订现在已经进入正式编排版本链，可直接 compare、rollback、merge-forward。"
                )
              )}</div>
            </div>
            ${
              deliveryDashboardState.arrangementRevisionActionError
                ? `<div class="report-list-item"><div class="report-card-copy">${escapeHtml(deliveryDashboardState.arrangementRevisionActionError)}</div></div>`
                : ""
            }
            ${
              arrangementRevisions.length
                ? arrangementRevisions
                    .map(
                      (entry) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(entry.version_name || entry.revision_id)}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${entry.created_at || "created"} · ${entry.state || "draft"} · ${entry.revision_id}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `source ${entry.source_promotion_id || "n/a"}${entry.rolled_back_from ? ` · rollback ${entry.rolled_back_from}` : ""}`
                          )}</div>
                          <div class="report-export-actions" style="flex-wrap:wrap;">
                            <button class="report-export-action ${deliveryDashboardState.arrangementRevisionFocus === entry.revision_id ? "" : "is-muted"}" type="button" data-delivery-arrangement-revision-focus="${escapeHtml(entry.revision_id)}">Compare Revision</button>
                            <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-arrangement-revision-rollback="${escapeHtml(entry.revision_id)}" ${
                              deliveryDashboardState.arrangementRevisionActionSaving ? "disabled" : ""
                            }>Rollback</button>
                            <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-arrangement-revision-merge-forward="${escapeHtml(entry.revision_id)}" ${
                              deliveryDashboardState.arrangementRevisionActionSaving ? "disabled" : ""
                            }>Merge Forward</button>
                          </div>
                        </div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("Arrangement revisions will appear after the first apply-back revision is generated.", "第一次 apply-back 修订生成后，这里会出现编排版本链。")
                  )}</div>`
            }
            <div class="report-list-item">
              <div class="report-preview-title">Release Candidate Lane</div>
              <div class="report-card-copy">${escapeHtml(
                dashboardCopy(
                  "Name a release candidate, lock the chosen revision, then publish that locked arrangement as the formal handoff version.",
                  "先给候选版本命名，再锁定选中的 revision，最后把这个已锁定编排作为正式交付版本发布。"
                )
              )}</div>
              <div class="report-export-actions" style="flex-wrap:wrap;">
                <input class="billing-input" type="text" placeholder="Release Candidate Name" value="${escapeHtml(
                  releaseCandidateInputValue
                )}" data-delivery-arrangement-candidate-name />
                <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-arrangement-release-candidate="${escapeHtml(
                  focusedRevision?.revision_id || ""
                )}" ${focusedRevision && !deliveryDashboardState.arrangementRevisionActionSaving ? "" : "disabled"}>Nominate RC</button>
                <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-arrangement-lock="${escapeHtml(
                  focusedRevision?.revision_id || ""
                )}" ${focusedRevision && !deliveryDashboardState.arrangementRevisionActionSaving ? "" : "disabled"}>Lock Revision</button>
                <button class="report-export-action ${publishButtonEnabled ? "" : "is-muted"}" type="button" data-delivery-arrangement-publish="${escapeHtml(
                  focusedRevision?.revision_id || ""
                )}" ${publishButtonEnabled ? "" : "disabled"}>Publish Chosen Revision</button>
              </div>
              <div class="report-list" style="margin-top:8px;">
                <div class="report-list-item">
                  <div class="report-preview-title">Publish-Time Enforcement</div>
                  <div class="report-card-copy">${escapeHtml(
                    blockedPublishExplainer?.blocked
                      ? formatBlockedPublishMessage(blockedPublishExplainer, approvalToPublishTrace)
                      : dashboardCopy(
                          "Publish is clear to proceed once you choose the locked revision.",
                          "当前发布门禁已放行，选择锁定 revision 后即可发布。"
                        )
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(
                    `gate=${String(complianceLockedPublishGate?.gate_state || "missing")} · token=${String(
                      complianceReleaseUnblockToken?.status || "missing"
                    )} · authorization=${String(
                      complianceImmutablePublishAuthorization?.authorization_state || "missing"
                    )}`
                  )}</div>
                  ${
                    Array.isArray(blockedPublishExplainer?.missing_steps) &&
                    blockedPublishExplainer.missing_steps.length
                      ? `<div class="report-card-copy">${escapeHtml(
                          `${dashboardCopy("Missing steps", "缺失环节")}: ${blockedPublishExplainer.missing_steps.join(", ")}`
                        )}</div>`
                      : ""
                  }
                  <div class="report-card-copy">${escapeHtml(blockerSpecificCopy)}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Approval To Publish Trace</div>
                  <div class="report-card-copy">${escapeHtml(
                    approvalToPublishTrace?.last_approver
                      ? dashboardCopy(
                          `Last approver: ${String(
                            approvalToPublishTrace.last_approver.actor_name ||
                              approvalToPublishTrace.last_approver.actor_id ||
                              "unknown"
                          )} (${String(approvalToPublishTrace.last_approver.actor_role || "unknown")})`,
                          `最后放行人：${String(
                            approvalToPublishTrace.last_approver.actor_name ||
                              approvalToPublishTrace.last_approver.actor_id ||
                              "unknown"
                          )}（${String(approvalToPublishTrace.last_approver.actor_role || "unknown")}）`
                        )
                      : dashboardCopy(
                          "No approver has signed this publish path yet.",
                          "这条发布路径目前还没有审批人签发。"
                        )
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(
                    approvalToPublishTrace
                      ? `quorum=${approvalToPublishTrace.quorum_met ? "met" : "pending"} · required=${Array.isArray(
                          approvalToPublishTrace.required_signers
                        ) ? approvalToPublishTrace.required_signers.join(", ") : "n/a"}`
                      : "quorum=pending"
                  )}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">One-Click Missing-Step Actions</div>
                  <div class="report-card-copy">${escapeHtml(
                    blockedPublishExplainer?.blocked
                      ? dashboardCopy(
                          "Use these shortcuts to close the missing publish steps without leaving this lane.",
                          "这些快捷动作可以直接在当前面板里补齐缺失的发布步骤。"
                        )
                      : dashboardCopy(
                          "No missing publish step is open right now.",
                          "当前没有待补齐的发布步骤。"
                        )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-publish-step-approve ${
                      deliveryDashboardState.arrangementRevisionActionSaving ? "disabled" : ""
                    }>${escapeHtml(dashboardCopy("Approve As Current Actor", "以当前身份签发"))}</button>
                    <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-publish-step-finalize ${
                      deliveryDashboardState.arrangementRevisionActionSaving ? "disabled" : ""
                    }>${escapeHtml(dashboardCopy("Finalize Publish Gate", "完成发布门禁检查"))}</button>
                    <button class="report-export-action ${missingSignerRoles.length ? "" : "is-muted"}" type="button" data-delivery-publish-step-remind="${escapeHtml(
                      missingSignerRoles.join(",")
                    )}" ${missingSignerRoles.length ? "" : "disabled"}>${escapeHtml(
                      dashboardCopy("Send Signer Reminder", "发送签发提醒")
                    )}</button>
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Signer Reminder</div>
                  <div class="report-card-copy">${escapeHtml(
                    missingSignerRoles.length
                      ? dashboardCopy(
                          `Waiting on signer roles: ${missingSignerRoles.join(", ")}.`,
                          `仍在等待这些签发角色：${missingSignerRoles.join("、")}。`
                        )
                      : dashboardCopy(
                          "All required signer roles have already approved.",
                          "所有必需签发角色都已完成审批。"
                        )
                  )}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Release Readiness Checklist</div>
                  <div class="report-list" style="margin-top:8px;">
                    ${readinessChecklist
                      .map(
                        (item) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${item.ready ? "READY" : "PENDING"} · ${item.label}`
                            )}</div>
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Auto-Suggest Actor</div>
                  <div class="report-card-copy">${escapeHtml(
                    suggestedRole
                      ? dashboardCopy(
                          `Next best signer is ${suggestedRole}${suggestedActor ? ` via ${suggestedActor.actor_name || suggestedActor.actor_id}` : ""}.`,
                          `下一位最合适的签发角色是 ${suggestedRole}${suggestedActor ? `，建议人：${suggestedActor.actor_name || suggestedActor.actor_id}` : ""}。`
                        )
                      : dashboardCopy(
                          "No actor switch is needed. The current actor can continue.",
                          "当前不需要切换签发人，现有身份可以继续。"
                        )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    ${
                      suggestedActor
                        ? `<button class="report-export-action" type="button" data-delivery-publish-actor-suggest='${escapeHtml(
                            JSON.stringify(suggestedActor)
                          )}'>${escapeHtml(
                            dashboardCopy("Use Suggested Actor", "使用建议签发人")
                          )}</button>`
                        : ""
                    }
                    ${
                      currentActor?.actor_role
                        ? `<span class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              `Current actor: ${currentActor.actor_name || currentActor.actor_id} (${currentActor.actor_role})`,
                              `当前身份：${currentActor.actor_name || currentActor.actor_id}（${currentActor.actor_role}）`
                            )
                          )}</span>`
                        : ""
                    }
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Signer Routing Shortcuts</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    ${
                      routingShortcuts.length
                        ? routingShortcuts
                            .map(
                              (route) => `<button class="report-export-action" type="button" data-delivery-publish-route-shortcut='${escapeHtml(
                                JSON.stringify(route)
                              )}'>${escapeHtml(
                                `${route.label} -> ${route.requiredRole || "role"}${route.actor ? ` (${route.actor.actor_name || route.actor.actor_id})` : ""}`
                              )}</button>`
                            )
                            .join("")
                        : `<span class="report-card-copy">${escapeHtml(
                            dashboardCopy("No routing shortcut is configured yet.", "当前还没有配置签发路由快捷键。")
                          )}</span>`
                    }
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Guided Publish Playbook</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.publishRunbookStatus ||
                      dashboardCopy(
                        "Run the guided runbook to take the shortest recovery path, then review the checklist again.",
                        "运行引导式 runbook 后，系统会走最短补救路径，再回来复核清单。"
                      )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action ${deliveryDashboardState.arrangementRevisionActionSaving ? "is-muted" : ""}" type="button" data-delivery-publish-runbook-automation ${
                      deliveryDashboardState.arrangementRevisionActionSaving ? "disabled" : ""
                    }>${escapeHtml(dashboardCopy("Run Shortest-Path Runbook", "执行最短路径 runbook"))}</button>
                  </div>
                  <div class="report-list" style="margin-top:8px;">
                    ${guidedPlaybook
                      .map(
                        (step, index) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${step.done ? "DONE" : "NEXT"} · ${index + 1}. ${step.label}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(step.detail)}</div>
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Publish Simulation Dry-Run</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.publishSimulationSummary ||
                      ""
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(
                    publishSimulation.ready
                      ? dashboardCopy(
                          "Dry-run result: publish would pass the current gate checks.",
                          "模拟结果：当前发布可以通过门禁检查。"
                        )
                      : dashboardCopy(
                          "Dry-run result: publish would still be blocked right now.",
                          "模拟结果：当前发布仍会被门禁拦住。"
                        )
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(
                    publishSimulation.next_actions.length
                      ? publishSimulation.next_actions.join(" ")
                      : dashboardCopy(
                          "No additional recovery step is suggested right now.",
                          "当前没有额外建议的补救步骤。"
                        )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-publish-simulate="${escapeHtml(
                      JSON.stringify(publishSimulation)
                    )}">${escapeHtml(dashboardCopy("Re-run Dry-Run", "重新模拟发布"))}</button>
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Publish Outcome Estimator</div>
                  <div class="report-card-copy">${escapeHtml(
                    `${dashboardCopy("Outcome", "结果")}: ${publishOutcomeEstimator.state}`
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(publishOutcomeEstimator.summary)}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">${escapeHtml(approvalSlaForecast.label)}</div>
                  <div class="report-card-copy">${escapeHtml(approvalSlaForecast.summary)}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Release Risk Banner</div>
                  <div class="report-card-copy">${escapeHtml(
                    `${dashboardCopy("Risk level", "风险级别")}: ${String(releaseRiskBanner.level).toUpperCase()}`
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(releaseRiskBanner.summary)}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Gated Publish Confirmation</div>
                  <div class="report-card-copy">${escapeHtml(
                    requiresPublishAcknowledgment
                      ? dashboardCopy(
                          "This publish path needs an explicit confirmation before the final publish button becomes available.",
                          "当前发布路径需要先完成一次显式确认，最终发布按钮才会解锁。"
                        )
                      : dashboardCopy(
                          "Current risk is low enough that no extra publish confirmation gate is required.",
                          "当前风险较低，不需要额外的发布确认门。"
                        )
                  )}</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.publishConfirmationArmed
                      ? dashboardCopy(
                          "Publish confirmation is armed. You can now choose whether to publish.",
                          "发布确认已开启。你现在可以决定是否执行正式发布。"
                        )
                      : dashboardCopy(
                          "Publish confirmation is not armed yet.",
                          "当前还没有开启发布确认。"
                        )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action ${requiresPublishAcknowledgment && !deliveryDashboardState.publishConfirmationArmed ? "" : "is-muted"}" type="button" data-delivery-publish-confirm-arm ${
                      requiresPublishAcknowledgment && !deliveryDashboardState.publishConfirmationArmed ? "" : "disabled"
                    }>${escapeHtml(dashboardCopy("Acknowledge And Arm Publish", "确认风险并解锁发布"))}</button>
                    <button class="report-export-action ${deliveryDashboardState.publishConfirmationArmed ? "" : "is-muted"}" type="button" data-delivery-publish-confirm-disarm ${
                      deliveryDashboardState.publishConfirmationArmed ? "" : "disabled"
                    }>${escapeHtml(dashboardCopy("Disarm Publish", "取消发布解锁"))}</button>
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Operator Acknowledgment</div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      "Use this note to record who reviewed the current risk before publish.",
                      "用这条备注记录当前是谁在发布前确认了这次风险。"
                    )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <input class="billing-input" type="text" placeholder="${escapeHtml(
                      dashboardCopy("Operator acknowledgment note", "运营确认备注")
                    )}" value="${escapeHtml(deliveryDashboardState.publishAcknowledgmentNote || "")}" data-delivery-publish-ack-note />
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Post-Publish Watchlist</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.postPublishWatchStatus ||
                      dashboardCopy(
                        "Use this watchlist to keep a live eye on the first post-publish signals.",
                        "用这份观察清单持续盯住发布后的第一批信号。"
                      )
                  )}</div>
                  <div class="report-list" style="margin-top:8px;">
                    ${postPublishWatchlist
                      .map(
                        (item, index) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${dashboardCopy("Watch", "观察")} ${index + 1}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(item)}</div>
                          </div>`
                      )
                      .join("")}
                  </div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-watch-start>${escapeHtml(
                      dashboardCopy("Start Live Watch", "开启实时观察")
                    )}</button>
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Live Watch Session</div>
                  <div class="report-card-copy">${escapeHtml(liveWatchSession.summary)}</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.postPublishFollowupPrompt || timedFollowupPrompt
                  )}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Anomaly Checkpoints</div>
                  <div class="report-list" style="margin-top:8px;">
                    ${anomalyCheckpoints
                      .map(
                        (item, index) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${item.label} ${index + 1}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(item.detail)}</div>
                          </div>`
                      )
                      .join("")}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Timed Follow-Up Prompts</div>
                  <div class="report-card-copy">${escapeHtml(
                    deliveryDashboardState.postPublishFollowupPrompt || timedFollowupPrompt
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-followup>${escapeHtml(
                      dashboardCopy("Log Follow-Up Prompt", "记录 follow-up 提示")
                    )}</button>
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Watch Outcome Journal</div>
                  <div class="report-list" style="margin-top:8px;">
                    ${(Array.isArray(deliveryDashboardState.postPublishWatchJournal)
                      ? deliveryDashboardState.postPublishWatchJournal
                      : []
                    )
                      .map(
                        (entry, index) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${entry.kind || "watch"} ${index + 1}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(
                              `${entry.at || ""} · ${entry.note || ""}`
                            )}</div>
                          </div>`
                      )
                      .join("") || `<div class="report-empty">${escapeHtml(
                        dashboardCopy(
                          "Watch outcome journal is empty. Start live watch or log a follow-up prompt to begin tracking.",
                          "观察结果日志还是空的。开启实时观察或记录一次 follow-up 提示后，这里就会开始累计。"
                        )
                      )}</div>`}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Rollback Recommendation Lane</div>
                  <div class="report-card-copy">${escapeHtml(rollbackRecommendationLane.summary)}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-rollback-keep>${escapeHtml(
                      dashboardCopy("Keep Current Publish", "维持当前发布")
                    )}</button>
                    ${
                      rollbackRecommendationLane.fallbackRevision
                        ? `<button class="report-export-action ${rollbackRecommendationLane.recommendRollback ? "" : "is-muted"}" type="button" data-delivery-post-publish-rollback="${escapeHtml(
                            rollbackRecommendationLane.fallbackRevision.revision_id
                          )}" ${rollbackRecommendationLane.recommendRollback ? "" : "disabled"}>${escapeHtml(
                            dashboardCopy("Rollback To Suggested Revision", "回滚到建议 revision")
                          )}</button>`
                        : ""
                    }
                  </div>
                  <div class="report-list" style="margin-top:8px;">
                    ${(Array.isArray(deliveryDashboardState.rollbackDecisionAuditTrail)
                      ? deliveryDashboardState.rollbackDecisionAuditTrail
                      : []
                    )
                      .map(
                        (entry, index) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${entry.decision || "decision"} ${index + 1}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(
                              `${entry.at || ""} · ${entry.revision_id || "current"} · ${entry.reason || ""}`
                            )}</div>
                          </div>`
                      )
                      .join("") || `<div class="report-empty">${escapeHtml(
                        dashboardCopy(
                          "Rollback decision audit trail is empty. Record either rollback or keep-current to start the trail.",
                          "回滚决策审计轨迹还是空的。记录一次“回滚”或“维持当前发布”后，这里就会开始累计。"
                        )
                      )}</div>`}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Exportable Watch Report</div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      "Bundle the current watch session, checkpoints, journal, and rollback trail into one exportable report.",
                      "把当前观察会话、检查点、日志和回滚轨迹整理成一份可导出的正式报告。"
                    )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-export-watch-report>${escapeHtml(
                      dashboardCopy("Download Watch Report", "下载观察报告")
                    )}</button>
                  </div>
                  <pre class="report-preview-code">${escapeHtml(JSON.stringify(watchReport, null, 2))}</pre>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Handoff Summary</div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      "Summarize the current watch state for the next operator or downstream handoff.",
                      "把当前观察状态压缩成一份适合交给下一位运营或下游团队的交接摘要。"
                    )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-export-handoff>${escapeHtml(
                      dashboardCopy("Download Handoff Summary", "下载交接摘要")
                    )}</button>
                  </div>
                  <pre class="report-preview-code">${escapeHtml(JSON.stringify(watchHandoffSummary, null, 2))}</pre>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Incident Replay Bundle</div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      "Capture the watch trail, anomaly checkpoints, compliance snapshots, and rollback decisions for replay and review.",
                      "把观察轨迹、异常检查点、合规快照和回滚决策打包成一份可复盘的事件回放包。"
                    )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <button class="report-export-action" type="button" data-delivery-post-publish-export-replay>${escapeHtml(
                      dashboardCopy("Download Replay Bundle", "下载复盘包")
                    )}</button>
                  </div>
                  <pre class="report-preview-code">${escapeHtml(JSON.stringify(incidentReplayBundle, null, 2))}</pre>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Report History Shelf</div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      "Search, tag, and compare saved watch reports and replay bundles here as a reusable incident archive.",
                      "在这里检索、分类和对比已保存的观察报告与复盘包，形成可复用的事件档案馆。"
                    )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <input class="billing-input" type="text" placeholder="${escapeHtml(
                      dashboardCopy("Snapshot name", "快照名称")
                    )}" value="${escapeHtml(deliveryDashboardState.watchSnapshotName || "")}" data-delivery-watch-snapshot-name />
                    <input class="billing-input" type="text" placeholder="${escapeHtml(
                      dashboardCopy("Search archive", "检索档案")
                    )}" value="${escapeHtml(deliveryDashboardState.watchSnapshotSearch || "")}" data-delivery-watch-search />
                    <input class="billing-input" type="text" placeholder="${escapeHtml(
                      dashboardCopy("Incident class filter", "事件分类过滤")
                    )}" value="${escapeHtml(deliveryDashboardState.watchSnapshotIncidentClassFilter || "")}" data-delivery-watch-class-filter />
                    <input class="billing-input" type="text" placeholder="${escapeHtml(
                      dashboardCopy("Tags to apply (comma separated)", "应用标签（逗号分隔）")
                    )}" value="${escapeHtml(deliveryDashboardState.watchSnapshotTagInput || "")}" data-delivery-watch-tag-input />
                    <button class="report-export-action" type="button" data-delivery-watch-save-report>${escapeHtml(
                      dashboardCopy("Save Watch Report To Run", "保存观察报告到 run")
                    )}</button>
                    <button class="report-export-action" type="button" data-delivery-watch-save-replay>${escapeHtml(
                      dashboardCopy("Save Replay Bundle To Run", "保存复盘包到 run")
                    )}</button>
                    <input class="billing-input" type="text" placeholder="${escapeHtml(
                      dashboardCopy("Cross-run ID", "跨 run ID")
                    )}" value="${escapeHtml(deliveryDashboardState.crossRunIncidentRunId || "")}" data-delivery-watch-cross-run-id />
                    <button class="report-export-action" type="button" data-delivery-watch-load-cross-run>${escapeHtml(
                      dashboardCopy("Load Cross-Run Snapshots", "加载跨 run 快照")
                    )}</button>
                    <input class="billing-input" type="file" accept="application/json" data-delivery-watch-import />
                  </div>
                  <div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      `Archive matches: ${filteredWatchSnapshotHistory.length} / ${watchSnapshotHistory.length}`,
                      `匹配档案：${filteredWatchSnapshotHistory.length} / ${watchSnapshotHistory.length}`
                    )
                  )}</div>
                  <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <input class="billing-input" type="text" placeholder="${escapeHtml(
                      dashboardCopy("Saved view name", "保存视图名称")
                    )}" value="${escapeHtml(deliveryDashboardState.watchSnapshotSavedViewName || "")}" data-delivery-watch-saved-view-name />
                    <button class="report-export-action" type="button" data-delivery-watch-saved-view-save>${escapeHtml(
                      dashboardCopy("Save Archive View", "保存档案视图")
                    )}</button>
                  </div>
                  <div class="report-list" style="margin-top:8px;">
                    <div class="report-list-item">
                      <div class="report-preview-title">Saved Archive Views</div>
                      ${
                        Array.isArray(deliveryDashboardState.watchSnapshotSavedViews) &&
                        deliveryDashboardState.watchSnapshotSavedViews.length
                          ? deliveryDashboardState.watchSnapshotSavedViews
                              .map(
                                (view) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(view.name || view.id)}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      dashboardCopy(
                                        `search=${view.search || "none"} · class=${view.incident_class_filter || "all"} · matches=${view.match_count || 0}`,
                                        `检索=${view.search || "无"} · 分类=${view.incident_class_filter || "全部"} · 命中=${view.match_count || 0}`
                                      )
                                    )}</div>
                                    <div class="report-export-actions" style="flex-wrap:wrap;">
                                      <button class="report-export-action is-muted" type="button" data-delivery-watch-saved-view-apply='${escapeHtml(
                                        JSON.stringify(view)
                                      )}'>${escapeHtml(dashboardCopy("Apply View", "应用视图"))}</button>
                                    </div>
                                  </div>`
                              )
                              .join("")
                          : `<div class="report-empty">${escapeHtml(
                              dashboardCopy(
                                "Save the current filters to build a reusable archive view shelf.",
                                "把当前过滤条件保存下来，这里就会形成可复用的档案视图库。"
                              )
                            )}</div>`
                      }
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Class Heatmap</div>
                      ${
                        watchArchiveClassHeatmap.length
                          ? watchArchiveClassHeatmap
                              .map(
                                (item) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${item.incident_class} · ${String(item.count)}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      dashboardCopy(
                                        `Intensity: ${item.intensity}`,
                                        `热度：${item.intensity}`
                                      )
                                    )}</div>
                                  </div>`
                              )
                              .join("")
                          : `<div class="report-empty">${escapeHtml(
                              dashboardCopy(
                                "Heatmap will appear after archive search returns classified snapshots.",
                                "当档案检索命中带分类的快照后，这里会显示分类热度图。"
                              )
                            )}</div>`
                      }
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Recurring Incident Motifs</div>
                      ${
                        watchArchiveRecurringMotifs.length
                          ? watchArchiveRecurringMotifs
                              .map(
                                (motif, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${dashboardCopy("Motif", "模式")} ${index + 1} · ${motif.incident_classes.join(" + ") || "uncategorized"}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(motif.summary)}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      dashboardCopy(
                                        `Risk=${motif.risk_level} · sample=${motif.sample_snapshots.join(", ")}`,
                                        `风险=${motif.risk_level} · 示例=${motif.sample_snapshots.join("、")}`
                                      )
                                    )}</div>
                                  </div>`
                              )
                              .join("")
                          : `<div class="report-empty">${escapeHtml(
                              dashboardCopy(
                                "Recurring motifs appear when at least two archive snapshots share the same class pattern and risk level.",
                                "当至少两个档案快照共享同一组分类模式和风险等级时，这里会出现重复事故模式。"
                              )
                            )}</div>`
                      }
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Archive Recommendations</div>
                      ${
                        watchArchiveRecommendations.length
                          ? watchArchiveRecommendations
                              .map(
                                (item) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(item.label)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.reason)}</div>
                                    <div class="report-export-actions" style="flex-wrap:wrap;">
                                      <button class="report-export-action is-muted" type="button" data-delivery-watch-archive-action='${escapeHtml(
                                        JSON.stringify(item.action)
                                      )}'>${escapeHtml(dashboardCopy("Apply Recommendation", "应用推荐"))}</button>
                                    </div>
                                  </div>`
                              )
                              .join("")
                          : `<div class="report-empty">${escapeHtml(
                              dashboardCopy(
                                "Recommendations appear after the archive has enough classified signals.",
                                "当档案里积累到足够的分类信号后，这里会出现系统推荐。"
                              )
                            )}</div>`
                      }
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Anomaly Drilldowns</div>
                      ${
                        watchArchiveAnomalyDrilldowns.length
                          ? watchArchiveAnomalyDrilldowns
                              .map(
                                (item) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(item.label)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.detail)}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      item.sample_snapshots.length
                                        ? dashboardCopy(
                                            `Sample snapshots: ${item.sample_snapshots.join(", ")}`,
                                            `示例快照：${item.sample_snapshots.join("、")}`
                                          )
                                        : dashboardCopy("No sample snapshots yet.", "当前还没有示例快照。")
                                    )}</div>
                                    <div class="report-export-actions" style="flex-wrap:wrap;">
                                      <button class="report-export-action is-muted" type="button" data-delivery-watch-archive-action='${escapeHtml(
                                        JSON.stringify(item.action)
                                      )}'>${escapeHtml(dashboardCopy("Open Drilldown", "打开钻取"))}</button>
                                    </div>
                                  </div>`
                              )
                              .join("")
                          : `<div class="report-empty">${escapeHtml(
                              dashboardCopy(
                                "Drilldowns appear when the archive can point to a concrete class or recurring motif.",
                                "当档案能指向明确分类或重复模式时，这里会出现异常钻取。"
                              )
                            )}</div>`
                      }
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Operator Playbook Links</div>
                      ${
                        watchArchivePlaybookLinks.length
                          ? watchArchivePlaybookLinks
                              .map(
                                (item) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(item.label)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.detail)}</div>
                                    <div class="report-export-actions" style="flex-wrap:wrap;">
                                      <button class="report-export-action is-muted" type="button" data-delivery-watch-archive-action='${escapeHtml(
                                        JSON.stringify(item.action)
                                      )}'>${escapeHtml(dashboardCopy("Run Playbook Step", "执行 playbook 步骤"))}</button>
                                    </div>
                                  </div>`
                              )
                              .join("")
                          : ""
                      }
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Guided Archive Triage</div>
                      ${
                        watchArchiveGuidedTriage.length
                          ? watchArchiveGuidedTriage
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.step}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.detail)}</div>
                                  </div>`
                              )
                              .join("")
                          : ""
                      }
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Incident Confidence Scoring</div>
                      ${
                        watchIncidentConfidenceScoring.length
                          ? watchIncidentConfidenceScoring
                              .map(
                                (item) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(item.label)}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      `${dashboardCopy("Confidence", "置信度")}: ${Math.round(
                                        Number(item.confidence || 0) * 100
                                      )}%`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.reason)}</div>
                                  </div>`
                              )
                              .join("")
                          : `<div class="report-empty">${escapeHtml(
                              dashboardCopy(
                                "Confidence scores appear after the archive has enough structured signals.",
                                "当档案积累到足够的结构化信号后，这里会出现置信度评分。"
                              )
                            )}</div>`
                      }
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Fix-Forward Suggestions</div>
                      ${
                        watchFixForwardSuggestions.length
                          ? watchFixForwardSuggestions
                              .map(
                                (item) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${item.label} · ${item.stance}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          : ""
                      }
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Incident Decision Memo</div>
                      <div class="report-card-copy">${escapeHtml(watchIncidentDecisionMemo.headline)}</div>
                      <div class="report-card-copy">${escapeHtml(
                        dashboardCopy(
                          `Next step: ${watchIncidentDecisionMemo.triage_step}`,
                          `下一步：${watchIncidentDecisionMemo.triage_step}`
                        )
                      )}</div>
                      <div class="report-card-copy">${escapeHtml(
                        dashboardCopy(
                          `Confidence: ${watchIncidentDecisionMemo.confidence}% · stance=${watchIncidentDecisionMemo.stance}`,
                          `置信度：${watchIncidentDecisionMemo.confidence}% · 立场=${watchIncidentDecisionMemo.stance}`
                        )
                      )}</div>
                      <div class="report-card-copy">${escapeHtml(watchIncidentDecisionMemo.recommendation)}</div>
                      <div class="report-export-actions" style="flex-wrap:wrap;">
                        <input class="billing-input" type="text" placeholder="${escapeHtml(
                          dashboardCopy("Assignee", "处理人")
                        )}" value="${escapeHtml(deliveryDashboardState.watchArchiveAssignee || "")}" data-delivery-watch-archive-assignee />
                        <button class="report-export-action is-muted" type="button" data-delivery-watch-decision-memo-save>${escapeHtml(
                          dashboardCopy("Save Decision Memo", "保存决策备忘")
                        )}</button>
                      </div>
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Assignee Handoff</div>
                      <div class="report-card-copy">${escapeHtml(
                        dashboardCopy(
                          `Assignee: ${watchAssigneeHandoff.assignee}`,
                          `处理人：${watchAssigneeHandoff.assignee}`
                        )
                      )}</div>
                      <div class="report-card-copy">${escapeHtml(
                        dashboardCopy(
                          `Recommended stance: ${watchAssigneeHandoff.recommended_stance}`,
                          `建议立场：${watchAssigneeHandoff.recommended_stance}`
                        )
                      )}</div>
                      <div class="report-card-copy">${escapeHtml(watchAssigneeHandoff.next_step)}</div>
                      <div class="report-list" style="margin-top:8px;">
                        ${(Array.isArray(watchAssigneeHandoff.playbook_links)
                          ? watchAssigneeHandoff.playbook_links
                          : []
                        )
                          .map(
                            (item, index) => `<div class="report-list-item">
                                <div class="report-preview-title">${escapeHtml(
                                  `${dashboardCopy("Playbook", "步骤")} ${index + 1} · ${item.label}`
                                )}</div>
                                <div class="report-card-copy">${escapeHtml(item.detail)}</div>
                              </div>`
                          )
                          .join("")}
                      </div>
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Archive Outcome Tracking</div>
                      <div class="report-card-copy">${escapeHtml(
                        dashboardCopy(
                          `Total=${watchArchiveOutcomeSummary.total} · fix-forward=${watchArchiveOutcomeSummary.fix_forward} · rollback=${watchArchiveOutcomeSummary.rollback} · watch=${watchArchiveOutcomeSummary.watch}`,
                          `总数=${watchArchiveOutcomeSummary.total} · fix-forward=${watchArchiveOutcomeSummary.fix_forward} · rollback=${watchArchiveOutcomeSummary.rollback} · watch=${watchArchiveOutcomeSummary.watch}`
                        )
                      )}</div>
                      <div class="report-export-actions" style="flex-wrap:wrap;">
                        <button class="report-export-action is-muted" type="button" data-delivery-watch-outcome-log="fix-forward">${escapeHtml(
                          dashboardCopy("Log Fix-Forward", "记录 Fix-Forward")
                        )}</button>
                        <button class="report-export-action is-muted" type="button" data-delivery-watch-outcome-log="rollback">${escapeHtml(
                          dashboardCopy("Log Rollback", "记录回滚")
                        )}</button>
                        <button class="report-export-action is-muted" type="button" data-delivery-watch-outcome-log="watch">${escapeHtml(
                          dashboardCopy("Log Watch", "记录持续观察")
                        )}</button>
                      </div>
                      <div class="report-list" style="margin-top:8px;">
                        ${(Array.isArray(deliveryDashboardState.watchArchiveOutcomeTracking)
                          ? deliveryDashboardState.watchArchiveOutcomeTracking
                          : []
                        )
                          .map(
                            (item, index) => `<div class="report-list-item">
                                <div class="report-preview-title">${escapeHtml(
                                  `${item.decision || "outcome"} ${index + 1}`
                                )}</div>
                                <div class="report-card-copy">${escapeHtml(
                                  `${item.at || ""} · ${item.assignee || dashboardCopy("unassigned", "未指派")} · ${item.note || ""}`
                                )}</div>
                              </div>`
                          )
                          .join("") || `<div class="report-empty">${escapeHtml(
                            dashboardCopy(
                              "Outcome tracking starts after you log a fix-forward, rollback, or watch decision.",
                              "记录一次 fix-forward、回滚或持续观察之后，这里就会开始累计结果。"
                            )
                          )}</div>`}
                      </div>
                    </div>
                    <div class="report-list-item">
                      <div class="report-preview-title">Persisted Archive Cases</div>
                      <div class="report-card-copy">${escapeHtml(
                        dashboardCopy(
                          `Total=${watchArchiveCaseStatusBoard.total} · open=${watchArchiveCaseStatusBoard.open} · in_progress=${watchArchiveCaseStatusBoard.in_progress} · closed=${watchArchiveCaseStatusBoard.closed} · reopened=${watchArchiveCaseStatusBoard.reopened}`,
                          `总数=${watchArchiveCaseStatusBoard.total} · open=${watchArchiveCaseStatusBoard.open} · in_progress=${watchArchiveCaseStatusBoard.in_progress} · closed=${watchArchiveCaseStatusBoard.closed} · reopened=${watchArchiveCaseStatusBoard.reopened}`
                        )
                      )}</div>
                      <div class="report-export-actions" style="flex-wrap:wrap;">
                        <button class="report-export-action is-muted" type="button" data-delivery-watch-case-open>${escapeHtml(
                          dashboardCopy("Open Archive Case", "创建档案案件")
                        )}</button>
                      </div>
                      <div class="report-list" style="margin-top:8px;">
                        <div class="report-list-item">
                          <div class="report-preview-title">Case Timeline</div>
                          ${
                            watchArchiveCaseTimeline.length
                              ? watchArchiveCaseTimeline
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.action || "history"} · ${item.case_title || item.case_id}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(
                                          `${item.at || ""} · ${item.assignee || dashboardCopy("unassigned", "未指派")} · ${item.note || ""}`
                                        )}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Timeline entries appear after archive cases start accumulating status history.",
                                    "档案案件开始积累状态历史后，这里会出现案件时间线。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Owner Workload Lane</div>
                          ${
                            watchArchiveOwnerWorkload.length
                              ? watchArchiveOwnerWorkload
                                  .map(
                                    (item) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(item.owner)}</div>
                                        <div class="report-card-copy">${escapeHtml(
                                          dashboardCopy(
                                            `total=${item.total} · open=${item.open} · in_progress=${item.in_progress} · reopened=${item.reopened} · closed=${item.closed}`,
                                            `总数=${item.total} · open=${item.open} · in_progress=${item.in_progress} · reopened=${item.reopened} · closed=${item.closed}`
                                          )
                                        )}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Workload will appear after archive cases have owners.",
                                    "档案案件开始分配负责人后，这里会出现负载视图。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Resolution Pattern Library</div>
                          ${
                            watchArchiveResolutionPatternLibrary.length
                              ? watchArchiveResolutionPatternLibrary
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.stance} · ${item.status}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                        <div class="report-card-copy">${escapeHtml(
                                          dashboardCopy(
                                            `Examples: ${item.sample_titles.join(", ")}`,
                                            `示例：${item.sample_titles.join("、")}`
                                          )
                                        )}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Resolution patterns appear after cases and outcomes begin to repeat.",
                                    "当案件和处理结果开始重复出现后，这里会形成解决模式库。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">SLA-At-Risk Cases</div>
                          ${
                            watchArchiveSlaAtRiskCases.length
                              ? watchArchiveSlaAtRiskCases
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.title} · ${item.risk_level}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                        <div class="report-card-copy">${escapeHtml(
                                          dashboardCopy(
                                            `Assignee=${item.assignee} · status=${item.status}`,
                                            `处理人=${item.assignee} · 状态=${item.status}`
                                          )
                                        )}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No archive case is currently near the simple SLA risk threshold.",
                                    "当前还没有档案案件接近这套简化 SLA 风险阈值。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Owner Rebalance Suggestions</div>
                          ${
                            watchArchiveOwnerRebalanceSuggestions.length
                              ? watchArchiveOwnerRebalanceSuggestions
                                  .map(
                                    (item) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${item.from_owner} -> ${item.to_owner}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Current owner workload looks balanced enough that no rebalance is suggested.",
                                    "当前负责人负载还算均衡，暂时不建议重新分配。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Best-Known-Resolution Cards</div>
                          ${
                            watchArchiveBestKnownResolutionCards.length
                              ? watchArchiveBestKnownResolutionCards
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.label}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                        <div class="report-card-copy">${escapeHtml(
                                          dashboardCopy(
                                            `Examples: ${item.examples.join(", ")}`,
                                            `示例：${item.examples.join("、")}`
                                          )
                                        )}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Best-known resolutions will appear after some cases start closing or repeating outcomes.",
                                    "当部分案件开始关闭或重复出现结果后，这里会形成最优解决路径卡片。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Auto-Priority Queue</div>
                          ${
                            watchArchiveAutoPriorityQueue.length
                              ? watchArchiveAutoPriorityQueue
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.title}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                        <div class="report-card-copy">${escapeHtml(
                                          dashboardCopy(
                                            `Assignee=${item.assignee}`,
                                            `处理人=${item.assignee}`
                                          )
                                        )}</div>
                                        <div class="report-export-actions" style="flex-wrap:wrap;">
                                          <button class="report-export-action is-muted" type="button" data-delivery-watch-case-route-priority="${escapeHtml(
                                            item.id
                                          )}">${escapeHtml(
                                            dashboardCopy("Route From Queue", "从队列直接路由")
                                          )}</button>
                                        </div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "The auto-priority queue appears after at least one active archive case exists.",
                                    "至少存在一条活跃档案案件后，这里会出现自动优先级队列。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Owner Handoff Suggestions</div>
                          ${
                            watchArchiveOwnerHandoffSuggestions.length
                              ? watchArchiveOwnerHandoffSuggestions
                                  .map(
                                    (item) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${item.from_owner} -> ${item.to_owner}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                        ${
                                          item.case_id
                                            ? `<div class="report-export-actions" style="flex-wrap:wrap;">
                                                <button class="report-export-action is-muted" type="button" data-delivery-watch-case-route="${escapeHtml(
                                                  item.case_id
                                                )}" data-delivery-watch-case-route-owner="${escapeHtml(
                                                  item.to_owner
                                                )}">${escapeHtml(
                                                  dashboardCopy("Route Case", "路由案件")
                                                )}</button>
                                              </div>`
                                            : ""
                                        }
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No owner handoff is suggested right now.",
                                    "当前不建议做负责人交接。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure Readiness Checklist</div>
                          ${
                            watchArchiveClosureReadinessChecklist.length
                              ? watchArchiveClosureReadinessChecklist
                                  .map(
                                    (item) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${item.title} · ${item.ready_count}/${item.total_count} READY`
                                        )}</div>
                                        <div class="report-list" style="margin-top:8px;">
                                          ${item.checklist
                                            .map(
                                              (row) => `<div class="report-list-item">
                                                  <div class="report-preview-title">${escapeHtml(
                                                    `${row.ready ? "READY" : "PENDING"} · ${row.label}`
                                                  )}</div>
                                                </div>`
                                            )
                                            .join("")}
                                        </div>
                                        ${
                                          item.ready_count === item.total_count
                                            ? `<div class="report-export-actions" style="flex-wrap:wrap;">
                                                <button class="report-export-action is-muted" type="button" data-delivery-watch-case-close-summary="${escapeHtml(
                                                  item.id
                                                )}">${escapeHtml(
                                                  dashboardCopy("Close With Summary", "带摘要结案")
                                                )}</button>
                                              </div>`
                                            : ""
                                        }
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Closure readiness appears for active cases after basic case data is available.",
                                  "活跃案件具备基础信息后，这里会显示结案准备清单。"
                                )
                              )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Reopened-Case Diagnostics</div>
                          ${
                            watchArchiveReopenedDiagnostics.length
                              ? watchArchiveReopenedDiagnostics
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.title}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                        <div class="report-card-copy">${escapeHtml(item.note || "")}</div>
                                        <div class="report-card-copy">${escapeHtml(
                                          (watchArchiveReopenRootCauseNotes.find((row) => row.id === item.id) || {})
                                            .root_cause_note || ""
                                        )}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Diagnostics will appear when a closed case is reopened.",
                                    "当已关闭案件被重新打开后，这里会出现 reopened 诊断。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Assignee Inbox Lane</div>
                          <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                            <button class="report-export-action is-muted" type="button" data-delivery-watch-owner-inbox-digest>${escapeHtml(
                              dashboardCopy("Download Inbox Digest", "下载收件箱摘要")
                            )}</button>
                          </div>
                          ${
                            watchArchiveInboxLane.length
                              ? watchArchiveInboxLane
                                  .map(
                                    (owner) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(owner.owner)}</div>
                                        <div class="report-list" style="margin-top:8px;">
                                          ${owner.items
                                            .map(
                                              (item, index) => `<div class="report-list-item">
                                                  <div class="report-preview-title">${escapeHtml(
                                                    `${index + 1}. ${item.title}`
                                                  )}</div>
                                                  <div class="report-card-copy">${escapeHtml(
                                                    dashboardCopy(
                                                      `status=${item.status} · confidence=${item.confidence}%`,
                                                      `状态=${item.status} · 置信度=${item.confidence}%`
                                                    )
                                                  )}</div>
                                                </div>`
                                            )
                                            .join("")}
                                        </div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "The assignee inbox will appear once active cases are routed to owners.",
                                    "当活跃案件开始路由到负责人后，这里会出现负责人收件箱。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Reopen Prevention Hints</div>
                          ${
                            watchArchiveReopenPreventionHints.length
                              ? watchArchiveReopenPreventionHints
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.label}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.detail)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : ""
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Case Export Bundle</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              "Export the current case board, priority queue, and handoff suggestions as a reusable handoff package.",
                              "把当前案件板、优先级队列和交接建议导出成可复用的交接包。"
                            )
                          )}</div>
                          <div class="report-export-actions" style="flex-wrap:wrap;">
                            <button class="report-export-action is-muted" type="button" data-delivery-watch-case-export-bundle>${escapeHtml(
                              dashboardCopy("Download Case Bundle", "下载案件交接包")
                            )}</button>
                          </div>
                          <pre class="report-preview-code">${escapeHtml(JSON.stringify(watchArchiveCaseExportBundle, null, 2))}</pre>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Persisted Case Artifacts</div>
                          ${
                            Array.isArray(deliveryDashboardState.watchArchiveCaseArtifacts) &&
                            deliveryDashboardState.watchArchiveCaseArtifacts.length
                              ? deliveryDashboardState.watchArchiveCaseArtifacts
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.kind || "artifact"}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.saved_at || "")}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Case artifacts will appear here after the first bundle export.",
                                    "第一次导出案件交接包后，这里会出现案件资产历史。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Inbox History Shelf</div>
                          ${
                            Array.isArray(deliveryDashboardState.watchArchiveInboxHistory) &&
                            deliveryDashboardState.watchArchiveInboxHistory.length
                              ? deliveryDashboardState.watchArchiveInboxHistory
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${dashboardCopy("Inbox digest", "收件箱摘要")}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.saved_at || "")}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Inbox history will appear after the first owner inbox digest export.",
                                    "第一次导出负责人收件箱摘要后，这里会出现收件箱历史架。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Reopen Trend Cards</div>
                          ${
                            watchArchiveReopenTrendCards.length
                              ? watchArchiveReopenTrendCards
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.label}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : ""
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Archive Timeline Merge</div>
                          ${
                            watchArchiveTimelineMerge.length
                              ? watchArchiveTimelineMerge
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.kind}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.at || "")}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Timeline merge will appear after artifact or inbox history starts accumulating.",
                                    "当案件资产历史或收件箱历史开始积累后，这里会出现合并时间线。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Trend Compare Cards</div>
                          ${
                            watchArchiveTrendCompareCards.length
                              ? watchArchiveTrendCompareCards
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.label}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : ""
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Weekly Ops Digest Draft</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              "A compact weekly draft for ops and delivery leads.",
                              "给运营和交付负责人的精简周摘要草稿。"
                            )
                          )}</div>
                          <pre class="report-preview-code">${escapeHtml(JSON.stringify(watchArchiveWeeklyOpsDigestDraft, null, 2))}</pre>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Executive Snapshot Cards</div>
                          ${
                            watchArchiveExecutiveSnapshotCards
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Anomaly Watch Thresholds</div>
                          ${
                            watchArchiveAnomalyWatchThresholds
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label} · ${item.state.toUpperCase()}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Next-Week Action Plan Draft</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              "A short next-week draft for the team lead or operations owner.",
                              "给团队负责人或运营负责人的简短下周行动草稿。"
                            )
                          )}</div>
                          <pre class="report-preview-code">${escapeHtml(JSON.stringify(watchArchiveNextWeekActionPlanDraft, null, 2))}</pre>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Board-Ready Briefing</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              "A meeting-ready pack that combines the executive snapshot, anomaly thresholds, and weekly digest.",
                              "把执行摘要、异常阈值和周摘要合成一份可直接带去开会的简报。"
                            )
                          )}</div>
                          <pre class="report-preview-code">${escapeHtml(JSON.stringify(watchArchiveBoardReadyBriefing, null, 2))}</pre>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Red-Flag Escalations</div>
                          ${
                            watchArchiveRedFlagEscalations
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.context || "")}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Decision Meeting Notes Draft</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              "A draft note set for the next decision meeting.",
                              "下一次决策会可直接使用的纪要草稿。"
                            )
                          )}</div>
                          <pre class="report-preview-code">${escapeHtml(JSON.stringify(watchArchiveDecisionMeetingNotesDraft, null, 2))}</pre>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Decision Follow-Up Tracker</div>
                          ${
                            watchArchiveDecisionFollowupTracker
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.severity.toUpperCase()} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Action Owner Commitments</div>
                          ${
                            watchArchiveActionOwnerCommitments
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.commitment)}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      dashboardCopy(
                                        `Due: ${item.due_window}`,
                                        `时间窗：${item.due_window}`
                                      )
                                    )}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Meeting Outcome Ledger</div>
                          <div class="report-export-actions" style="flex-wrap:wrap;">
                            <button class="report-export-action is-muted" type="button" data-delivery-watch-meeting-outcome-log>${escapeHtml(
                              dashboardCopy("Log Meeting Outcome", "记录会议结果")
                            )}</button>
                          </div>
                          ${
                            Array.isArray(deliveryDashboardState.watchArchiveMeetingOutcomeLedger) &&
                            deliveryDashboardState.watchArchiveMeetingOutcomeLedger.length
                              ? deliveryDashboardState.watchArchiveMeetingOutcomeLedger
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.headline || "meeting outcome"}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.at || "")}</div>
                                        <div class="report-card-copy">${escapeHtml(
                                          dashboardCopy(
                                            `commitments=${item.commitment_count || 0}`,
                                            `承诺项=${item.commitment_count || 0}`
                                          )
                                        )}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "Meeting outcomes will appear here after you log the first post-meeting result.",
                                    "记录第一次会后结果后，这里会出现会议结果台账。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Overdue Follow-Ups</div>
                          ${
                            watchArchiveOverdueFollowups.length
                              ? watchArchiveOverdueFollowups
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.severity.toUpperCase()}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                        <div class="report-card-copy">${escapeHtml(item.overdue_reason)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No overdue follow-up is flagged right now.",
                                    "当前没有被标记为超期的跟进行动。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Commitment Slip Alerts</div>
                          ${
                            watchArchiveCommitmentSlipAlerts.length
                              ? watchArchiveCommitmentSlipAlerts
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.label}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No commitment slip is visible right now.",
                                    "当前没有看到承诺滑坡提醒。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Monthly Review Pack Draft</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              "A compact monthly review draft for leadership and operations review.",
                              "给管理层和运营复盘使用的精简月度复盘包草稿。"
                            )
                          )}</div>
                          <pre class="report-preview-code">${escapeHtml(JSON.stringify(watchArchiveMonthlyReviewPackDraft, null, 2))}</pre>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Quarter-to-Date Scorecards</div>
                          ${
                            watchArchiveQuarterToDateScorecards
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Leadership Risk Digest</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveLeadershipRiskDigest.headline} · ${String(
                              watchArchiveLeadershipRiskDigest.severity || "low"
                            ).toUpperCase()}`
                          )}</div>
                          <div class="report-list" style="margin-top:8px;">
                            ${(Array.isArray(watchArchiveLeadershipRiskDigest.risk_factors)
                              ? watchArchiveLeadershipRiskDigest.risk_factors
                              : []
                            )
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${dashboardCopy("Risk factor", "风险因子")}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item)}</div>
                                  </div>`
                              )
                              .join("")}
                            <div class="report-list-item">
                              <div class="report-preview-title">${escapeHtml(
                                dashboardCopy("Recommended focus", "建议关注点")
                              )}</div>
                              <div class="report-card-copy">${escapeHtml(
                                watchArchiveLeadershipRiskDigest.recommended_focus || ""
                              )}</div>
                            </div>
                          </div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Operating Cadence Template</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              "A fixed operating rhythm for weekly, monthly, and quarter-to-date review.",
                              "用于每周、每月和季度视角复盘的固定经营节奏模板。"
                            )
                          )}</div>
                          <pre class="report-preview-code">${escapeHtml(JSON.stringify(watchArchiveOperatingCadenceTemplate, null, 2))}</pre>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Quarter Trend Delta Cards</div>
                          ${
                            watchArchiveQuarterTrendDeltaCards
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Revenue Risk Bridge</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${dashboardCopy("Severity", "风险级别")}: ${String(
                              watchArchiveRevenueRiskBridge.severity || "low"
                            ).toUpperCase()} · ${dashboardCopy("Exposure points", "暴露分值")}: ${watchArchiveRevenueRiskBridge.exposure_points || 0}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveRevenueRiskBridge.summary || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveRevenueRiskBridge.operator_note || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Cadence Adherence Tracker</div>
                          ${
                            watchArchiveCadenceAdherenceTracker
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.lane} · ${String(item.state || "watch").toUpperCase()}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Margin Pressure Cards</div>
                          ${
                            watchArchiveMarginPressureCards
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Capacity Bottleneck Digest</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCapacityBottleneckDigest.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCapacityBottleneckDigest.bottleneck_summary || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCapacityBottleneckDigest.busiest_owner || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCapacityBottleneckDigest.operator_focus || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Monetization Intervention Draft</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveMonetizationInterventionDraft.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveMonetizationInterventionDraft.bottleneck_reference || ""
                          )}</div>
                          <div class="report-list" style="margin-top:8px;">
                            ${(Array.isArray(watchArchiveMonetizationInterventionDraft.actions)
                              ? watchArchiveMonetizationInterventionDraft.actions
                              : []
                            )
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${dashboardCopy("Intervention", "干预动作")}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item)}</div>
                                  </div>`
                              )
                              .join("")}
                          </div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Profit Recovery Scenarios</div>
                          ${
                            watchArchiveProfitRecoveryScenarios
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Staffing Tradeoff Cards</div>
                          ${
                            watchArchiveStaffingTradeoffCards
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Pricing-and-Throughput Action Sheet</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchivePricingThroughputActionSheet.headline || ""
                          )}</div>
                          <div class="report-list" style="margin-top:8px;">
                            ${(Array.isArray(watchArchivePricingThroughputActionSheet.actions)
                              ? watchArchivePricingThroughputActionSheet.actions
                              : []
                            )
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${dashboardCopy("Action", "动作")}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item)}</div>
                                  </div>`
                              )
                              .join("")}
                          </div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">ROI Intervention Ladder</div>
                          ${
                            watchArchiveRoiInterventionLadder
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.tier} · ${item.linked_recovery}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.roi_hint)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Hiring Trigger Thresholds</div>
                          ${
                            watchArchiveHiringTriggerThresholds
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Monetization Experiment Board</div>
                          ${
                            watchArchiveMonetizationExperimentBoard
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.name} · ${String(item.priority || "ready").toUpperCase()}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Executive Allocation Memo</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveExecutiveAllocationMemo.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveExecutiveAllocationMemo.budget_priority || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveExecutiveAllocationMemo.hiring_posture || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveExecutiveAllocationMemo.experiment_focus || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Budget Guardrails</div>
                          ${
                            watchArchiveBudgetGuardrails
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Experiment Outcome Ledger</div>
                          ${
                            watchArchiveExperimentOutcomeLedger
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.experiment} · ${String(item.state || "proposed").toUpperCase()}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      `${item.linked_recovery} · ${item.accounting_note}`
                                    )}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Board Decision Packet</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveBoardDecisionPacket.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveBoardDecisionPacket.allocation_summary || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveBoardDecisionPacket.guardrail_summary || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveBoardDecisionPacket.experiment_summary || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Spend Approval Lanes</div>
                          ${
                            watchArchiveSpendApprovalLanes
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.lane}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Experiment Kill-Scale Rules</div>
                          ${
                            watchArchiveExperimentKillScaleRules
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.experiment} · ${item.guardrail_reference}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.rule)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Capital Allocation Scoreboard</div>
                          ${
                            watchArchiveCapitalAllocationScoreboard
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Exception Register</div>
                          ${
                            watchArchiveGovernanceExceptionRegister.length
                              ? watchArchiveGovernanceExceptionRegister
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.label}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No governance exception is being registered right now.",
                                    "当前没有登记中的治理例外。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Portfolio Rebalance Draft</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchivePortfolioRebalanceDraft.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchivePortfolioRebalanceDraft.rebalance_case || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchivePortfolioRebalanceDraft.governance_pressure || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchivePortfolioRebalanceDraft.approval_shift || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Capital Committee Agenda</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCapitalCommitteeAgenda.headline || ""
                          )}</div>
                          <div class="report-list" style="margin-top:8px;">
                            ${(Array.isArray(watchArchiveCapitalCommitteeAgenda.topics)
                              ? watchArchiveCapitalCommitteeAgenda.topics
                              : []
                            )
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${dashboardCopy("Agenda topic", "议题")}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item)}</div>
                                  </div>`
                              )
                              .join("")}
                          </div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Exception Closure Tracker</div>
                          ${
                            watchArchiveExceptionClosureTracker.length
                              ? watchArchiveExceptionClosureTracker
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.exception} · ${item.state}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.closure_path)}</div>
                                        <div class="report-card-copy">${escapeHtml(item.board_note)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No exception needs closure tracking right now.",
                                    "当前没有需要闭环追踪的例外。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Reallocation Outcome Map</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReallocationOutcomeMap.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReallocationOutcomeMap.capital_signal || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReallocationOutcomeMap.rebalance_signal || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReallocationOutcomeMap.experiment_signal || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Investment Memo Shelf</div>
                          ${
                            watchArchiveInvestmentMemoShelf
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.title}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Exception SLA Clock</div>
                          ${
                            watchArchiveExceptionSlaClock.length
                              ? watchArchiveExceptionSlaClock
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.exception} · ${item.state}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.sla_window)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No exception SLA clock is active right now.",
                                    "当前没有活跃的例外 SLA 时钟。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Allocation Performance Timeline</div>
                          ${
                            watchArchiveAllocationPerformanceTimeline
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.step}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Committee Briefing History</div>
                          ${
                            watchArchiveCommitteeBriefingHistory
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.title}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">SLA Breach Escalations</div>
                          ${
                            watchArchiveSlaBreachEscalations.length
                              ? watchArchiveSlaBreachEscalations
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.exception} · ${String(item.severity || "info").toUpperCase()}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No SLA breach escalation is active right now.",
                                    "当前没有活跃的 SLA 失守升级项。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Allocation Win-Loss Log</div>
                          ${
                            watchArchiveAllocationWinLossLog
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Narrative Draft</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceNarrativeDraft.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceNarrativeDraft.committee_story || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceNarrativeDraft.escalation_story || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceNarrativeDraft.portfolio_story || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Escalation Ownership Map</div>
                          ${
                            watchArchiveEscalationOwnershipMap.length
                              ? watchArchiveEscalationOwnershipMap
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.escalation}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.owner_lane)}</div>
                                        <div class="report-card-copy">${escapeHtml(item.committee_hook)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No escalation ownership mapping is active right now.",
                                    "当前没有活跃的升级归属映射。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Portfolio Lesson Register</div>
                          ${
                            watchArchivePortfolioLessonRegister
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.lesson}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Operating Doctrine Draft</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveOperatingDoctrineDraft.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveOperatingDoctrineDraft.doctrine_core || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveOperatingDoctrineDraft.ownership_rule || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveOperatingDoctrineDraft.lesson_rule || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Recurring Failure Taxonomy</div>
                          ${
                            watchArchiveRecurringFailureTaxonomy
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.failure_type}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Allocation Playbook Index</div>
                          ${
                            watchArchiveAllocationPlaybookIndex
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.title}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Maturity Ladder</div>
                          ${
                            watchArchiveGovernanceMaturityLadder
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.rung}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Failure Prevention Checklist</div>
                          ${
                            watchArchiveFailurePreventionChecklist
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.item}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Institutional Memory Shelf</div>
                          ${
                            watchArchiveInstitutionalMemoryShelf
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.memory}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Health Score</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveGovernanceHealthScore.score || 0}/100`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceHealthScore.summary || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Prevention Coverage Map</div>
                          ${
                            watchArchivePreventionCoverageMap
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.area} · ${item.coverage}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Memory Gap Register</div>
                          ${
                            watchArchiveMemoryGapRegister.length
                              ? watchArchiveMemoryGapRegister
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.gap}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No material institutional memory gap is visible right now.",
                                    "当前没有明显的机构记忆空缺。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Roadmap Draft</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceRoadmapDraft.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceRoadmapDraft.current_state || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceRoadmapDraft.next_focus || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceRoadmapDraft.memory_priority || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Coverage Uplift Queue</div>
                          ${
                            watchArchiveCoverageUpliftQueue
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.area} · ${String(item.priority || "uplift").toUpperCase()}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Memory Capture Backlog</div>
                          ${
                            watchArchiveMemoryCaptureBacklog.length
                              ? watchArchiveMemoryCaptureBacklog
                                  .map(
                                    (item, index) => `<div class="report-list-item">
                                        <div class="report-preview-title">${escapeHtml(
                                          `${index + 1}. ${item.item}`
                                        )}</div>
                                        <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                      </div>`
                                  )
                                  .join("")
                              : `<div class="report-empty">${escapeHtml(
                                  dashboardCopy(
                                    "No memory capture backlog is visible right now.",
                                    "当前没有明显的记忆补齐待办。"
                                  )
                                )}</div>`
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Sprint Planner</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceSprintPlanner.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceSprintPlanner.sprint_goal || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceSprintPlanner.uplift_task || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceSprintPlanner.memory_task || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Uplift ROI Tracker</div>
                          ${
                            watchArchiveUpliftRoiTracker
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.area}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.roi_signal)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.score_hint)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Memory Completion Burndown</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              `Completed=${watchArchiveMemoryCompletionBurndown.completed || 0} · Remaining=${watchArchiveMemoryCompletionBurndown.remaining || 0}`,
                              `已完成=${watchArchiveMemoryCompletionBurndown.completed || 0} · 剩余=${watchArchiveMemoryCompletionBurndown.remaining || 0}`
                            )
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveMemoryCompletionBurndown.summary || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Release Gate</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${String(watchArchiveGovernanceReleaseGate.state || "hold").toUpperCase()}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceReleaseGate.summary || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceReleaseGate.sprint_reference || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Uplift Acceptance Criteria</div>
                          ${
                            watchArchiveUpliftAcceptanceCriteria
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.area}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.criteria)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Memory Done-Definition</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveMemoryDoneDefinition.definition || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveMemoryDoneDefinition.status || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Launch Checklist</div>
                          ${
                            watchArchiveGovernanceLaunchChecklist
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.item}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Acceptance Evidence Pack</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveAcceptanceEvidencePack.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveAcceptanceEvidencePack.health_anchor || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveAcceptanceEvidencePack.acceptance_anchor || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveAcceptanceEvidencePack.coverage_anchor || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Completion Certificate Draft</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCompletionCertificateDraft.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${dashboardCopy("Gate", "门状态")}: ${watchArchiveCompletionCertificateDraft.gate_state || ""}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCompletionCertificateDraft.completion_basis || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCompletionCertificateDraft.health_basis || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Sign-Off Lane</div>
                          ${
                            watchArchiveGovernanceSignoffLane
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.role}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Evidence Trace Matrix</div>
                          ${
                            watchArchiveEvidenceTraceMatrix
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.source}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.target)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Completion Audit Stamp</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCompletionAuditStamp.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${dashboardCopy("Stamp", "盖章")}: ${watchArchiveCompletionAuditStamp.stamp_state || ""}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCompletionAuditStamp.certificate_basis || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCompletionAuditStamp.audit_basis || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Release Dossier</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReleaseDossier.headline || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReleaseDossier.signoff_anchor || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReleaseDossier.trace_anchor || ""
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReleaseDossier.audit_anchor || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Approver Checklist Matrix</div>
                          ${
                            watchArchiveApproverChecklistMatrix
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.approver}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.checklist_item)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.evidence_rule)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Audit Archive Index</div>
                          ${
                            watchArchiveAuditArchiveIndex
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.title}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Dossier Navigator</div>
                          ${
                            watchArchiveGovernanceDossierNavigator
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.node}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Approval Dependency Graph</div>
                          ${
                            watchArchiveApprovalDependencyGraph
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.approver}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.depends_on)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.evidence_edge)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Audit Retrieval Shelf</div>
                          ${
                            watchArchiveAuditRetrievalShelf
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.slot}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Search Index</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceSearchIndex.indexed_terms || ""
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Dependency Risk Scanner</div>
                          ${
                            watchArchiveDependencyRiskScanner
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.approver} · ${item.risk}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Audit Query Presets</div>
                          ${
                            watchArchiveAuditQueryPresets
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.query)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Command Palette</div>
                          ${
                            watchArchiveGovernanceCommandPalette
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.action}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.target)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.reason)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Risk Triage Queue</div>
                          ${
                            watchArchiveRiskTriageQueue
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.priority} · ${item.approver}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      `${dashboardCopy("Blocker", "阻塞点")}: ${item.blocker}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.next_action)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Audit Quick-Open Set</div>
                          ${
                            watchArchiveAuditQuickOpenSet
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.target)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Saved Operator Macros</div>
                          ${
                            watchArchiveSavedOperatorMacros
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.macro}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      (Array.isArray(item.steps) ? item.steps : []).join(" → ")
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.result)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Triage Escalation Shortcuts</div>
                          ${
                            watchArchiveTriageEscalationShortcuts
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label} · ${item.severity}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.route)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Audit Workspace Launcher</div>
                          ${
                            watchArchiveAuditWorkspaceLauncher
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.workspace}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.launch_target)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.context)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Macro Run History</div>
                          ${
                            watchArchiveMacroRunHistory
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.macro} · ${item.last_run}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.result)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.workspace)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Escalation Outcome Board</div>
                          ${
                            watchArchiveEscalationOutcomeBoard
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.lane} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.outcome)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Workspace Context Snapshots</div>
                          ${
                            watchArchiveWorkspaceContextSnapshots
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.workspace}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.focus)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.snapshot)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Operator Effectiveness Score</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveOperatorEffectivenessScore.score} · ${watchArchiveOperatorEffectivenessScore.status}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveOperatorEffectivenessScore.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Escalation Latency Cards</div>
                          ${
                            watchArchiveEscalationLatencyCards
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.lane}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      `${dashboardCopy("Latency", "延迟")}: ${item.latency}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      `${dashboardCopy("Pressure", "压力")}: ${item.pressure}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Workspace Replay Lane</div>
                          ${
                            watchArchiveWorkspaceReplayLane
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.workspace}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.replay_focus)}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      (Array.isArray(item.replay_steps) ? item.replay_steps : []).join(" → ")
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.replay_note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Operator Coaching Prompts</div>
                          ${
                            watchArchiveOperatorCoachingPrompts
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.prompt}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.recommendation)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.focus)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Latency Breach Alarms</div>
                          ${
                            watchArchiveLatencyBreachAlarms
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.lane} · ${item.alarm}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Replay-To-Training Pack</div>
                          ${
                            watchArchiveReplayToTrainingPack
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.module}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.workspace)}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      (Array.isArray(item.drills) ? item.drills : []).join(" → ")
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.takeaway)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Operator Readiness Score</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveOperatorReadinessScore.score} · ${watchArchiveOperatorReadinessScore.status}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveOperatorReadinessScore.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">On-Call Drill Queue</div>
                          ${
                            watchArchiveOnCallDrillQueue
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.priority} · ${item.drill}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.focus)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.completion_hint)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Training Completion Lane</div>
                          ${
                            watchArchiveTrainingCompletionLane
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.module} · ${item.completion}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.readiness)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Certification Ladder</div>
                          ${
                            watchArchiveCertificationLadder
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.stage}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.status)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Drill Failure Review</div>
                          ${
                            watchArchiveDrillFailureReview
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.drill}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.failure_mode)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.review)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.coaching_anchor)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Readiness Trendline</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${dashboardCopy("Current", "当前")}: ${watchArchiveReadinessTrendline.current} · ${dashboardCopy("Previous", "前值")}: ${watchArchiveReadinessTrendline.previous}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReadinessTrendline.direction
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReadinessTrendline.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Operator Promotion Criteria</div>
                          ${
                            watchArchiveOperatorPromotionCriteria
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.role} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.criteria)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Remediation Plan Cards</div>
                          ${
                            watchArchiveRemediationPlanCards
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.priority} · ${item.title}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.guardrail)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Readiness Forecast Window</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${dashboardCopy("Current", "当前")}: ${watchArchiveReadinessForecastWindow.current} · ${dashboardCopy("Next", "下一窗口")}: ${watchArchiveReadinessForecastWindow.next_window}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReadinessForecastWindow.direction
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveReadinessForecastWindow.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Staffing Bench Map</div>
                          ${
                            watchArchiveStaffingBenchMap
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.lane}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Readiness Risk Hedge</div>
                          ${
                            watchArchiveReadinessRiskHedge
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.hedge}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Promotion Decision Memo</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchivePromotionDecisionMemo.headline
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchivePromotionDecisionMemo.bench_anchor
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchivePromotionDecisionMemo.hedge_anchor
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Coverage Gap Heatmap</div>
                          ${
                            watchArchiveCoverageGapHeatmap
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.zone} · ${item.heat}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Succession Readiness Slate</div>
                          ${
                            watchArchiveSuccessionReadinessSlate
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.lane} · ${item.candidate}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.readiness)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.succession_note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Promotion Review Docket</div>
                          ${
                            watchArchivePromotionReviewDocket
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.review_item} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.memo_anchor)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.prerequisite)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Leadership Staffing Brief</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveLeadershipStaffingBrief.headline
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveLeadershipStaffingBrief.gap_anchor
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveLeadershipStaffingBrief.succession_anchor
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Succession Risk Register</div>
                          ${
                            watchArchiveSuccessionRiskRegister
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.risk_item} · ${item.severity}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.hedge)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Review Outcome Tracker</div>
                          ${
                            watchArchiveReviewOutcomeTracker
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.review_item}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.outcome)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.memo)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Leadership Action Queue</div>
                          ${
                            watchArchiveLeadershipActionQueue
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.action}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.reason)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Succession Mitigation Plan</div>
                          ${
                            watchArchiveSuccessionMitigationPlan
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.risk_item}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.mitigation)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.closure_signal)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Review Closure Log</div>
                          ${
                            watchArchiveReviewClosureLog
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.review_item} · ${item.closure}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.next_step)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.memo)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Leadership Follow-Through Board</div>
                          ${
                            watchArchiveLeadershipFollowThroughBoard
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.action} · ${item.follow_through}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Mitigation SLA Clock</div>
                          ${
                            watchArchiveMitigationSlaClock
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.risk_item} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.sla)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure Evidence Pack</div>
                          ${
                            watchArchiveClosureEvidencePack
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.review_item}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.evidence)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.closure_note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Executive Accountability Lane</div>
                          ${
                            watchArchiveExecutiveAccountabilityLane
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.accountability}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Overdue Mitigation Escalations</div>
                          ${
                            watchArchiveOverdueMitigationEscalations
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.risk_item} · ${item.escalation}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.reason)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure Audit Summary</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureAuditSummary.headline
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${dashboardCopy("Evidence", "证据")}: ${watchArchiveClosureAuditSummary.evidence_count} · ${dashboardCopy("Open", "未闭合")}: ${watchArchiveClosureAuditSummary.open_items}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureAuditSummary.accountability_state
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Exec Review Agenda</div>
                          ${
                            watchArchiveExecReviewAgenda
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.topic}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Escalation Burn-Down</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${dashboardCopy("Total", "总数")}: ${watchArchiveEscalationBurndown.total} · ${dashboardCopy("Cleared", "已清零")}: ${watchArchiveEscalationBurndown.cleared} · ${dashboardCopy("Urgent", "紧急")}: ${watchArchiveEscalationBurndown.urgent}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveEscalationBurndown.summary
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveEscalationBurndown.pace
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Audit Confidence Banner</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveAuditConfidenceBanner.confidence
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveAuditConfidenceBanner.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Executive Sign-Off Readiness</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveExecutiveSignoffReadiness.status
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveExecutiveSignoffReadiness.reason
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Escalation Recovery Forecast</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${dashboardCopy("Recovery", "恢复率")}: ${watchArchiveEscalationRecoveryForecast.recovery_pct}% · ${watchArchiveEscalationRecoveryForecast.outlook}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveEscalationRecoveryForecast.note
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Audit Exception Callouts</div>
                          ${
                            watchArchiveAuditExceptionCallouts
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.detail)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Board Sign-Off Packet</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveBoardSignoffPacket.headline
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveBoardSignoffPacket.agenda_anchor
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveBoardSignoffPacket.confidence_anchor
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Recovery War-Room Queue</div>
                          ${
                            watchArchiveRecoveryWarRoomQueue
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.priority} · ${item.lane}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.war_room_action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.outlook)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Exception Disposition Log</div>
                          ${
                            watchArchiveExceptionDispositionLog
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.exception} · ${item.disposition}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Board Decision Ledger</div>
                          ${
                            watchArchiveBoardDecisionLedger
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.decision_id} · ${item.readiness}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.decision)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.packet_anchor)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">War-Room Resolution Timeline</div>
                          ${
                            watchArchiveWarRoomResolutionTimeline
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.phase} · ${item.priority} · ${item.lane}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.outlook)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Exception Closure Certificate</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveExceptionClosureCertificate.status} · ${watchArchiveExceptionClosureCertificate.confidence}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveExceptionClosureCertificate.note
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Board Action Follow-Through</div>
                          ${
                            watchArchiveBoardActionFollowThrough
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      `${dashboardCopy("Owner", "负责人")}: ${item.owner}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">War-Room Exit Criteria</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveWarRoomExitCriteria.status
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveWarRoomExitCriteria.threshold
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveWarRoomExitCriteria.note
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Certified Exception Archive</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveCertifiedExceptionArchive.archive_status} · ${dashboardCopy("Exceptions", "例外数")}: ${watchArchiveCertifiedExceptionArchive.exception_count}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCertifiedExceptionArchive.certificate_anchor
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveCertifiedExceptionArchive.archive_anchor
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Board Closure Memo</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveBoardClosureMemo.headline
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveBoardClosureMemo.summary
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveBoardClosureMemo.next_anchor
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">War-Room Stand-Down Checklist</div>
                          ${
                            watchArchiveWarRoomStandDownChecklist
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.item} · ${item.state}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Certified Archive Ledger</div>
                          ${
                            watchArchiveCertifiedArchiveLedger
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.archive_id} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.record)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.certificate)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Governance Closure Dashboard</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveGovernanceClosureDashboard.headline} · ${watchArchiveGovernanceClosureDashboard.closure_state}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceClosureDashboard.stand_down_state
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveGovernanceClosureDashboard.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Stand-Down Approval Lane</div>
                          ${
                            watchArchiveStandDownApprovalLane
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.approver} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.gate)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Archive Retention Policy Cards</div>
                          ${
                            watchArchiveRetentionPolicyCards
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.family}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.policy)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.anchor)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure Readiness Score</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveClosureReadinessScore.score}% · ${watchArchiveClosureReadinessScore.status}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureReadinessScore.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Approval Bottleneck Map</div>
                          ${
                            watchArchiveApprovalBottleneckMap
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.approver} · ${item.bottleneck}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.gate)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Retention Compliance Checklist</div>
                          ${
                            watchArchiveRetentionComplianceChecklist
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.item} · ${item.state}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure Escalation Ladder</div>
                          ${
                            watchArchiveClosureEscalationLadder
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.level} · ${item.trigger} · ${item.state}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Bottleneck Recovery Playbook</div>
                          ${
                            watchArchiveBottleneckRecoveryPlaybook
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.lane} · ${item.bottleneck}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.recovery_action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Compliance Sign-Off Card</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveComplianceSignoffCard.status
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveComplianceSignoffCard.summary
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveComplianceSignoffCard.note
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure Control Tower</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveClosureControlTower.headline} · ${watchArchiveClosureControlTower.active_level}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureControlTower.readiness
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureControlTower.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Recovery Assignment Board</div>
                          ${
                            watchArchiveRecoveryAssignmentBoard
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.lane)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Sign-Off Evidence Wallet</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveSignoffEvidenceWallet.signoff_state} · ${dashboardCopy("Evidence", "证据数")}: ${watchArchiveSignoffEvidenceWallet.evidence_count}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveSignoffEvidenceWallet.anchor
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveSignoffEvidenceWallet.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure Operations Cockpit</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveClosureOperationsCockpit.headline} · ${watchArchiveClosureOperationsCockpit.lane_state}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureOperationsCockpit.signoff_state
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureOperationsCockpit.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Assignment SLA Rails</div>
                          ${
                            watchArchiveAssignmentSlaRails
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.rail}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Evidence Sufficiency Meter</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveEvidenceSufficiencyMeter.meter}% · ${watchArchiveEvidenceSufficiencyMeter.state}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveEvidenceSufficiencyMeter.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure KPI Strip</div>
                          ${
                            watchArchiveClosureKpiStrip
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.label} · ${item.value}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Assignment Breach Alerts</div>
                          ${
                            watchArchiveAssignmentBreachAlerts
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.severity}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.reason)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.next_step)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Evidence Gap Actions</div>
                          ${
                            watchArchiveEvidenceGapActions
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.action}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.target)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure Daily Brief</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureDailyBrief.headline
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureDailyBrief.summary
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureDailyBrief.next_focus
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Breach Triage Ladder</div>
                          ${
                            watchArchiveBreachTriageLadder
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.level} · ${item.owner} · ${item.state}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Evidence Collection Queue</div>
                          ${
                            watchArchiveEvidenceCollectionQueue
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.priority} · ${item.item}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure Shift Handoff</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveClosureShiftHandoff.headline} · ${watchArchiveClosureShiftHandoff.outgoing_state}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${dashboardCopy("Next owner", "下一位负责人")}: ${watchArchiveClosureShiftHandoff.next_owner}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureShiftHandoff.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Triage Priority Board</div>
                          ${
                            watchArchiveTriagePriorityBoard
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.priority} · ${item.owner} · ${item.state}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Evidence Pickup Log</div>
                          ${
                            watchArchiveEvidencePickupLog
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.pickup_id} · ${item.target}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Shift Continuity Card</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveShiftContinuityCard.continuity} · ${watchArchiveShiftContinuityCard.lane_state}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveShiftContinuityCard.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Triage Load Balancer</div>
                          ${
                            watchArchiveTriageLoadBalancer
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.load}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Evidence Aging View</div>
                          ${
                            watchArchiveEvidenceAgingView
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.item} · ${item.age_band}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Shift Risk Pulse</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveShiftRiskPulse.risk} · ${watchArchiveShiftRiskPulse.lane_state}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveShiftRiskPulse.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Rebalance Recommendation Queue</div>
                          ${
                            watchArchiveRebalanceRecommendationQueue
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.priority} · ${item.owner}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.recommendation)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Stale Evidence Rescue Plan</div>
                          ${
                            watchArchiveStaleEvidenceRescuePlan
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.item} · ${item.urgency}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Shift Stabilization Board</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveShiftStabilizationBoard.state} · ${watchArchiveShiftStabilizationBoard.lane_state}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveShiftStabilizationBoard.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Rebalance Execution Tracker</div>
                          ${
                            watchArchiveRebalanceExecutionTracker
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Rescued Evidence Outcomes</div>
                          ${
                            watchArchiveRescuedEvidenceOutcomes
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.item} · ${item.outcome}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Stabilization Confidence Band</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveStabilizationConfidenceBand.band} · ${watchArchiveStabilizationConfidenceBand.score}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveStabilizationConfidenceBand.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Execution Drift Alerts</div>
                          ${
                            watchArchiveExecutionDriftAlerts
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.drift}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Evidence Recovery Scoreboard</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveEvidenceRecoveryScoreboard.recovered}/${watchArchiveEvidenceRecoveryScoreboard.total} · ${dashboardCopy("Meter", "计分")}: ${watchArchiveEvidenceRecoveryScoreboard.meter}%`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveEvidenceRecoveryScoreboard.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Stabilization Watchlist</div>
                          ${
                            watchArchiveStabilizationWatchlist
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.lane} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.focus)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Drift Correction Queue</div>
                          ${
                            watchArchiveDriftCorrectionQueue
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.urgency}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Recovery Proof Pack</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveRecoveryProofPack.proof_state} · ${dashboardCopy("Anchors", "锚点")}: ${watchArchiveRecoveryProofPack.anchors} · ${watchArchiveRecoveryProofPack.recovered}/${watchArchiveRecoveryProofPack.total}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveRecoveryProofPack.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Stabilization Handoff Memo</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveStabilizationHandoffMemo.state} · ${dashboardCopy("Next owner", "下一负责人")}: ${watchArchiveStabilizationHandoffMemo.next_owner}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveStabilizationHandoffMemo.focus
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveStabilizationHandoffMemo.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Correction Completion Tracker</div>
                          ${
                            watchArchiveCorrectionCompletionTracker
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.completion}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Proof Acceptance Card</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveProofAcceptanceCard.acceptance} · ${dashboardCopy("Anchors", "锚点")}: ${watchArchiveProofAcceptanceCard.anchors} · ${dashboardCopy("Meter", "计分")}: ${watchArchiveProofAcceptanceCard.meter}%`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveProofAcceptanceCard.summary
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveProofAcceptanceCard.note
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Handoff Readiness Badge</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveHandoffReadinessBadge.badge} · ${dashboardCopy("Owner", "负责人")}: ${watchArchiveHandoffReadinessBadge.owner}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveHandoffReadinessBadge.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Correction Closure Queue</div>
                          ${
                            watchArchiveCorrectionClosureQueue
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.closure}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Proof Sign-Off Checklist</div>
                          ${
                            watchArchiveProofSignoffChecklist
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.item} · ${item.status}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Closure Sign-Off Gate</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveClosureSignoffGate.gate} · ${dashboardCopy("Readiness", "就绪度")}: ${watchArchiveClosureSignoffGate.readiness}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveClosureSignoffGate.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Handoff Completion Receipt</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${watchArchiveHandoffCompletionReceipt.receipt} · ${dashboardCopy("Owner", "负责人")}: ${watchArchiveHandoffCompletionReceipt.owner}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(
                            watchArchiveHandoffCompletionReceipt.summary
                          )}</div>
                        </div>
                        <div class="report-list-item">
                          <div class="report-preview-title">Correction Audit Trail</div>
                          ${
                            watchArchiveCorrectionAuditTrail
                              .map(
                                (item, index) => `<div class="report-list-item">
                                    <div class="report-preview-title">${escapeHtml(
                                      `${index + 1}. ${item.owner} · ${item.audit_state}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(item.action)}</div>
                                    <div class="report-card-copy">${escapeHtml(item.note)}</div>
                                  </div>`
                              )
                              .join("")
                          }
                        </div>
                      </div>
                      <div class="report-list" style="margin-top:8px;">
                        ${(Array.isArray(deliveryDashboardState.watchArchiveCases)
                          ? deliveryDashboardState.watchArchiveCases
                          : []
                        )
                          .map(
                            (item) => `<div class="report-list-item">
                                <div class="report-preview-title">${escapeHtml(
                                  `${item.title || item.id} · ${item.status || "open"}`
                                )}</div>
                                <div class="report-card-copy">${escapeHtml(
                                  dashboardCopy(
                                    `Assignee=${item.assignee || "unassigned"} · stance=${item.stance || "fix-forward"} · confidence=${item.confidence || 0}%`,
                                    `处理人=${item.assignee || "未指派"} · 立场=${item.stance || "fix-forward"} · 置信度=${item.confidence || 0}%`
                                  )
                                )}</div>
                                <div class="report-card-copy">${escapeHtml(item.next_step || "")}</div>
                                <div class="report-export-actions" style="flex-wrap:wrap;">
                                  <button class="report-export-action is-muted" type="button" data-delivery-watch-case-status="${escapeHtml(
                                    item.id
                                  )}" data-delivery-watch-case-next-status="in_progress">${escapeHtml(
                                    dashboardCopy("Mark In Progress", "标记处理中")
                                  )}</button>
                                  <button class="report-export-action is-muted" type="button" data-delivery-watch-case-status="${escapeHtml(
                                    item.id
                                  )}" data-delivery-watch-case-next-status="closed">${escapeHtml(
                                    dashboardCopy("Close Case", "关闭案件")
                                  )}</button>
                                  <button class="report-export-action is-muted" type="button" data-delivery-watch-case-status="${escapeHtml(
                                    item.id
                                  )}" data-delivery-watch-case-next-status="reopened">${escapeHtml(
                                    dashboardCopy("Reopen Case", "重新打开案件")
                                  )}</button>
                                </div>
                                <div class="report-list" style="margin-top:8px;">
                                  ${(Array.isArray(item.history) ? item.history : [])
                                    .slice(0, 3)
                                    .map(
                                      (historyItem, index) => `<div class="report-list-item">
                                          <div class="report-preview-title">${escapeHtml(
                                            `${historyItem.action || "history"} ${index + 1}`
                                          )}</div>
                                          <div class="report-card-copy">${escapeHtml(
                                            `${historyItem.at || ""} · ${historyItem.note || ""}`
                                          )}</div>
                                        </div>`
                                    )
                                    .join("")}
                                </div>
                              </div>`
                          )
                          .join("") || `<div class="report-empty">${escapeHtml(
                            dashboardCopy(
                              "Open the first archive case from the current memo to start the case board.",
                              "从当前决策备忘创建第一条档案案件后，这里就会出现状态板。"
                            )
                          )}</div>`}
                      </div>
                    </div>
                  </div>
                  <div class="report-list" style="margin-top:8px;">
                    ${filteredWatchSnapshotHistory
                      .map(
                        (entry) => `<div class="report-list-item">
                            <div class="report-preview-title">${escapeHtml(
                              `${entry.version_name || entry.id} · ${entry.kind || "snapshot"}${entry.source_run_id ? ` · run ${entry.source_run_id}` : ""}`
                            )}</div>
                            <div class="report-card-copy">${escapeHtml(entry.saved_at || "")}</div>
                            <div class="report-card-copy">${escapeHtml(
                              (Array.isArray(entry.incident_classes) ? entry.incident_classes : []).join(", ") ||
                                dashboardCopy("No incident classes yet.", "当前还没有事件分类。")
                            )}</div>
                            <div class="report-export-actions" style="flex-wrap:wrap;">
                              <button class="report-export-action ${deliveryDashboardState.watchSnapshotCompareA === entry.id ? "" : "is-muted"}" type="button" data-delivery-watch-compare-a="${escapeHtml(
                                entry.id
                              )}">${escapeHtml(dashboardCopy("Compare A", "设为对比 A"))}</button>
                              <button class="report-export-action ${deliveryDashboardState.watchSnapshotCompareB === entry.id ? "" : "is-muted"}" type="button" data-delivery-watch-compare-b="${escapeHtml(
                                entry.id
                              )}">${escapeHtml(dashboardCopy("Compare B", "设为对比 B"))}</button>
                              <button class="report-export-action is-muted" type="button" data-delivery-watch-tag-apply="${escapeHtml(
                                entry.id
                              )}">${escapeHtml(dashboardCopy("Apply Tags", "应用标签"))}</button>
                              ${(Array.isArray(entry.incident_classes) ? entry.incident_classes : [])
                                .map(
                                  (tag) => `<button class="report-export-action is-muted" type="button" data-delivery-watch-class-filter-set="${escapeHtml(
                                    tag
                                  )}">${escapeHtml(`#${tag}`)}</button>`
                                )
                                .join("")}
                              <pre class="report-preview-code">${escapeHtml(JSON.stringify(entry.payload, null, 2))}</pre>
                            </div>
                          </div>`
                      )
                      .join("") || `<div class="report-empty">${escapeHtml(
                        dashboardCopy(
                          watchSnapshotHistory.length
                            ? "No snapshot matches the current archive search."
                            : "No watch snapshot has been saved yet.",
                          watchSnapshotHistory.length
                            ? "当前没有快照匹配这组档案检索条件。"
                            : "当前还没有保存任何观察快照。"
                        )
                      )}</div>`}
                  </div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Compare Two Watch Sessions</div>
                  ${
                    watchSnapshotCompareSummary
                      ? `<div class="report-list" style="margin-top:8px;">
                          ${watchSnapshotCompareSummary.cards
                            .map(
                              (card) => `<div class="report-list-item">
                                  <div class="report-preview-title">${escapeHtml(card.label)}</div>
                                  <div class="report-card-copy">${escapeHtml(card.summary)}</div>
                                  <div class="report-card-copy">${escapeHtml(
                                    `${dashboardCopy("Delta", "变化")}: ${card.delta >= 0 ? "+" : ""}${card.delta}`
                                  )}</div>
                                </div>`
                            )
                            .join("")}
                        </div>`
                      : ""
                  }
                  ${
                    watchSnapshotDiff
                      ? `<pre class="report-preview-code">${escapeHtml(JSON.stringify(watchSnapshotDiff, null, 2))}</pre>`
                      : `<div class="report-card-copy">${escapeHtml(
                          dashboardCopy(
                            "Pick two saved watch snapshots to compare their journals, rollback decisions, and compliance deltas.",
                            "请选择两个已保存的观察快照，用来比较日志、回滚决策和合规差异。"
                          )
                        )}</div>`
                  }
                </div>
              </div>
              <div class="report-list" style="margin-top:8px;">
                <div class="report-list-item">
                  <div class="report-preview-title">Locked Revision</div>
                  <div class="report-card-copy">${escapeHtml(
                    arrangementLockedRevision
                      ? `${arrangementLockedRevision.candidate_name} · ${arrangementLockedRevision.version_name} · ${arrangementLockedRevision.revision_id}`
                      : dashboardCopy("No revision is locked yet.", "当前还没有锁定的 revision。")
                  )}</div>
                </div>
                <div class="report-list-item">
                  <div class="report-preview-title">Published Revision</div>
                  <div class="report-card-copy">${escapeHtml(
                    arrangementPublishedRevision
                      ? `${arrangementPublishedRevision.candidate_name} · ${arrangementPublishedRevision.version_name} · ${arrangementPublishedRevision.revision_id}`
                      : dashboardCopy("No revision has been published yet.", "当前还没有正式发布的 revision。")
                  )}</div>
                  ${
                    globalThis.buildPublishedRevisionArtifactActions?.(
                      deliveryDashboardState.runId || "",
                      arrangementPublishedRevision
                    ) || ""
                  }
                  ${
                    complianceLane || complianceFlags.length || complianceClock
                      ? `<div class="report-list" style="margin-top:10px;">
                          <div class="report-list-item">
                            <div class="report-preview-title">Compliance Dashboard</div>
                            <div class="report-card-copy">${escapeHtml(
                              dashboardCopy(
                                "Track downstream acknowledgment, regulator receipt, and audit closure from the published revision.",
                                "从已发布 revision 持续跟踪下游确认、监管回单和审计闭环。"
                              )
                            )}</div>
                            ${
                              complianceLane?.stages?.length
                                ? `<div class="report-card-copy" style="margin-top:8px;">${complianceLane.stages
                                    .map(
                                      (stage) =>
                                        `${stage.label || stage.id}: ${stage.status || "pending"}${
                                          stage.at ? ` @ ${stage.at}` : ""
                                        }`
                                    )
                                    .join(" | ")}</div>`
                                : ""
                            }
                            ${
                              complianceFlags.length
                                ? `<div class="report-list" style="margin-top:8px;">${complianceFlags
                                    .map(
                                      (flag) => `<div class="report-list-item">
                                          <div class="report-preview-title">${escapeHtml(
                                            `${String(flag.level || "info").toUpperCase()} · ${String(flag.title || flag.code || "Compliance flag")}`
                                          )}</div>
                                          <div class="report-card-copy">${escapeHtml(String(flag.detail || ""))}</div>
                                        </div>`
                                    )
                                    .join("")}</div>`
                                : `<div class="report-card-copy" style="margin-top:8px;">${escapeHtml(
                                    dashboardCopy(
                                      "No compliance exceptions are open right now.",
                                      "当前没有打开的合规异常。"
                                    )
                                  )}</div>`
                            }
                            ${
                              complianceClock?.windows?.length
                                ? `<div class="report-list" style="margin-top:8px;">${complianceClock.windows
                                    .map(
                                      (window) => `<div class="report-list-item">
                                          <div class="report-preview-title">${escapeHtml(String(window.label || window.id || "SLA"))}</div>
                                          <div class="report-card-copy">${escapeHtml(
                                            `status=${String(window.status || "tracking")} · elapsed=${Number(window.elapsed_s || 0)}s · remaining=${Number(window.remaining_s || 0)}s · target=${Number(window.target_s || 0)}s`
                                          )}</div>
                                        </div>`
                                    )
                                    .join("")}</div>`
                                : ""
                            }
                            ${
                              complianceAlertRouting
                                ? `<div class="report-list-item" style="margin-top:8px;">
                                    <div class="report-preview-title">Alert Routing</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      `severity=${String(complianceAlertRouting.severity || "low")}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      Array.isArray(complianceAlertRouting.routes)
                                        ? complianceAlertRouting.routes
                                            .map(
                                              (route) =>
                                                `${route.channel || "route"} -> ${route.target || "n/a"} [${route.state || "idle"}]`
                                            )
                                            .join(" | ")
                                        : ""
                                    )}</div>
                                  </div>`
                                : ""
                            }
                            ${
                              complianceEscalationPolicy
                                ? `<div class="report-list-item" style="margin-top:8px;">
                                    <div class="report-preview-title">Escalation Policy</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      `state=${String(complianceEscalationPolicy.policy_state || "green")}`
                                    )}</div>
                                    <div class="report-card-copy">${escapeHtml(
                                      Array.isArray(complianceEscalationPolicy.steps)
                                        ? complianceEscalationPolicy.steps
                                            .map(
                                              (step) =>
                                                `${step.order || "?"}. ${step.name || "step"} [${step.status || "standby"}]`
                                            )
                                            .join(" | ")
                                        : ""
                                    )}</div>
                                  </div>`
                                : ""
                            }
                            ${
                              complianceOperatorActions.length
                                ? `<div class="report-list-item" style="margin-top:8px;">
                                    <div class="report-preview-title">Operator Actions</div>
                                    <div class="report-export-actions" style="flex-wrap:wrap;">
                                      ${complianceOperatorActions
                                        .map((action) => {
                                          const kind = String(action.kind || "");
                                          if (kind === "refresh") {
                                            return `<button class="report-export-action" type="button" data-delivery-compliance-refresh>${escapeHtml(
                                              action.label || "Refresh"
                                            )}</button>`;
                                          }
                                          if (kind === "open_artifact" && action.target_path) {
                                            return `<button class="report-export-action is-muted" type="button" data-delivery-compliance-open="${escapeHtml(
                                              String(action.target_path || "")
                                            )}">${escapeHtml(action.label || "Open Artifact")}</button>`;
                                          }
                                          if (kind === "escalate") {
                                            return `<button class="report-export-action" type="button" data-delivery-compliance-escalate="${escapeHtml(
                                              String(action.target_team || "release-ops/oncall")
                                            )}">${escapeHtml(action.label || "Escalate")}</button>`;
                                          }
                                          return "";
                                        })
                                        .join("")}
                                      <button class="report-export-action is-muted" type="button" data-delivery-compliance-ticket>Open Incident Ticket</button>
                                      <button class="report-export-action is-muted" type="button" data-delivery-compliance-backfill="${escapeHtml(
                                        resolveComplianceAckArtifactPath(arrangementPublishedRevision)
                                      )}" ${
                                        resolveComplianceAckArtifactPath(arrangementPublishedRevision)
                                          ? ""
                                          : "disabled"
                                      }>Ack Backfill</button>
                                    </div>
                                  </div>`
                                : ""
                            }
                            ${
                              complianceWebhookDispatch || complianceTicketMapping || complianceAckReconciliation
                                ? `<div class="report-list" style="margin-top:8px;">
                                    ${
                                      complianceWebhookDispatch
                                        ? `<div class="report-list-item">
                                            <div class="report-preview-title">Notification Backend</div>
                                            <div class="report-card-copy">${escapeHtml(
                                              `backend=${String(complianceWebhookDispatch.backend || "local")} · status=${String(
                                                complianceWebhookDispatch.status || "idle"
                                              )}${complianceWebhookDispatch.target_team ? ` · team=${String(complianceWebhookDispatch.target_team)}` : ""}${complianceWebhookDispatch.auth_mode ? ` · auth=${String(complianceWebhookDispatch.auth_mode)}` : ""}${complianceWebhookDispatch.rotation?.active_kid ? ` · kid=${String(complianceWebhookDispatch.rotation.active_kid)}` : ""}`
                                            )}</div>
                                            <div class="report-card-copy">${escapeHtml(
                                              complianceWebhookDispatch.signed_headers?.["x-cssmv-signature"]
                                                ? "signed webhook headers are ready"
                                                : "no webhook signature configured yet"
                                            )}</div>
                                          </div>`
                                        : ""
                                    }
                                    ${
                                      complianceTicketMapping
                                        ? `<div class="report-list-item">
                                            <div class="report-preview-title">Ticket Vendor Mapping</div>
                                            <div class="report-card-copy">${escapeHtml(
                                              `vendor=${String(complianceTicketMapping.vendor || "local")} · status=${String(
                                                complianceTicketMapping.status || "mapped"
                                              )} · ticket=${String(complianceTicketMapping.ticket_id || "pending")}`
                                            )}</div>
                                            <div class="report-card-copy">${escapeHtml(
                                              Array.isArray(Object.entries(complianceTicketMapping.template_fields || {}))
                                                ? Object.entries(complianceTicketMapping.template_fields || {})
                                                    .map(([key, value]) => `${key}=${String(value ?? "")}`)
                                                    .join(" | ")
                                                : ""
                                            )}</div>
                                            <div class="report-card-copy">${escapeHtml(
                                              Array.isArray(complianceTicketMapping.field_registry?.required_fields)
                                                ? `required=${complianceTicketMapping.field_registry.required_fields.join(", ")}`
                                                : ""
                                            )}</div>
                                          </div>`
                                        : ""
                                    }
                                    ${
                                      complianceAckReconciliation
                                        ? `<div class="report-list-item">
                                            <div class="report-preview-title">Ack Reconciliation</div>
                                            <div class="report-card-copy">${escapeHtml(
                                              `status=${String(complianceAckReconciliation.status || "pending")} · source=${String(
                                                complianceAckReconciliation.source_path || "n/a"
                                              )} · close=${String(complianceAckReconciliation.closing_state || "left_open")} · reopen=${String(
                                                complianceAckReconciliation.reopen_state || "not_reopened"
                                              )}`
                                            )}</div>
                                            <div class="report-card-copy">${escapeHtml(
                                              complianceAckReconciliation.reopen_reason
                                                ? `reason=${String(complianceAckReconciliation.reopen_reason)}`
                                                : "no reopen reason"
                                            )}</div>
                                            <div class="report-card-copy">${escapeHtml(
                                              Array.isArray(complianceAckReconciliation.checks)
                                                ? complianceAckReconciliation.checks
                                                    .map(
                                                      (check) =>
                                                        `${check.id || "check"}:${check.status || (check.present ? "present" : "missing")}`
                                                    )
                                                    .join(" | ")
                                                : ""
                                            )}</div>
                                          </div>`
                                        : ""
                                    }
                                  </div>`
                                : ""
                            }
                            <div class="report-list-item" style="margin-top:8px;">
                              <div class="report-preview-title">Compliance Controls</div>
                              <div class="report-card-copy">${escapeHtml(
                                dashboardCopy(
                                  "Rotate webhook signing keys, edit vendor field registry, and reopen compliance handling from the dashboard.",
                                  "直接在面板里轮换 webhook 签名密钥、编辑 vendor 字段注册表，并重新打开合规处理链。"
                                )
                              )}</div>
                              <div class="report-list" style="margin-top:8px;">
                                <div class="report-list-item">
                                  <div class="report-preview-title">Secret Rotation</div>
                                  <input class="billing-input" type="text" placeholder="active kid" value="${escapeHtml(
                                    complianceActiveKidValue
                                  )}" data-delivery-compliance-active-kid />
                                  <textarea class="report-preview-code" data-delivery-compliance-keyset placeholder="kid1:secret1, kid2:secret2">${escapeHtml(
                                    complianceKeysetValue
                                  )}</textarea>
                                  <div class="report-export-actions">
                                    <button class="report-export-action" type="button" data-delivery-compliance-rotate-secret>Apply Rotation</button>
                                  </div>
                                </div>
                                <div class="report-list-item">
                                  <div class="report-preview-title">Vendor Registry Editor</div>
                                  <input class="billing-input" type="text" placeholder="vendor" value="${escapeHtml(
                                    complianceVendorValue
                                  )}" data-delivery-compliance-vendor />
                                  <input class="billing-input" type="text" placeholder="required fields" value="${escapeHtml(
                                    complianceRequiredFieldsValue
                                  )}" data-delivery-compliance-required-fields />
                                  <input class="billing-input" type="text" placeholder="optional fields" value="${escapeHtml(
                                    complianceOptionalFieldsValue
                                  )}" data-delivery-compliance-optional-fields />
                                  <textarea class="report-preview-code" data-delivery-compliance-field-defaults placeholder='{"owner_team":"release-ops/compliance"}'>${escapeHtml(
                                    complianceFieldDefaultsValue
                                  )}</textarea>
                                  <div class="report-export-actions">
                                    <button class="report-export-action" type="button" data-delivery-compliance-update-registry>Save Registry</button>
                                  </div>
                                </div>
                                <div class="report-list-item">
<div class="report-preview-title">Reopen Hooks</div>
                                  <input class="billing-input" type="text" placeholder="reopen reason" value="${escapeHtml(
                                    complianceReopenReasonValue
                                  )}" data-delivery-compliance-reopen-reason />
                                  <div class="report-export-actions">
                                    <button class="report-export-action" type="button" data-delivery-compliance-reopen="${escapeHtml(
                                      resolveComplianceAckArtifactPath(arrangementPublishedRevision)
                                    )}">Reopen Compliance</button>
                                  </div>
                                </div>
                                <div class="report-list-item">
                                  <div class="report-preview-title">Actor Identity</div>
                                  <input class="billing-input" type="text" placeholder="actor id" value="${escapeHtml(
                                    complianceActorIdValue
                                  )}" data-delivery-compliance-actor-id />
                                  <input class="billing-input" type="text" placeholder="actor name" value="${escapeHtml(
                                    complianceActorNameValue
                                  )}" data-delivery-compliance-actor-name />
                                  <input class="billing-input" type="text" placeholder="actor role" value="${escapeHtml(
                                    complianceActorRoleValue
                                  )}" data-delivery-compliance-actor-role />
                                  <div class="report-card-copy">${escapeHtml(
                                    compliancePermissionCheck?.required_scope
                                      ? `required=${String(compliancePermissionCheck.required_scope)} · allowed=${String(
                                          compliancePermissionCheck.allowed
                                        )}`
                                      : "no permission check recorded yet"
                                  )}</div>
                                  <div class="report-card-copy">${escapeHtml(
                                    complianceAuditSignature?.kid
                                      ? `audit_signature=${String(complianceAuditSignature.status || "signed")} · kid=${String(
                                          complianceAuditSignature.kid
                                        )}`
                                      : "no audit signature recorded yet"
                                  )}</div>
                                </div>
                                <div class="report-list-item">
                                  <div class="report-preview-title">Actor Directory</div>
                                  <textarea class="report-preview-code" data-delivery-compliance-actor-directory placeholder='[{"actor_id":"local-operator","actor_name":"Local Operator","actor_role":"admin"}]'>${escapeHtml(
                                    complianceActorDirectoryValue
                                  )}</textarea>
                                  <div class="report-export-actions">
                                    <button class="report-export-action" type="button" data-delivery-compliance-save-directory>Save Actor Directory</button>
                                  </div>
                                  <div class="report-card-copy">${escapeHtml(
                                    Array.isArray(complianceActorDirectory?.directory)
                                      ? `actors=${String(complianceActorDirectory.directory.length)}`
                                      : "no actor directory saved yet"
                                  )}</div>
                                </div>
                                <div class="report-list-item">
                                  <div class="report-preview-title">Preset And Permissions</div>
                                  <input class="billing-input" type="text" placeholder="preset name" value="${escapeHtml(
                                    compliancePresetNameValue
                                  )}" data-delivery-compliance-preset-name />
                                  <input class="billing-input" type="text" placeholder="rotate_secret scope" value="${escapeHtml(
                                    compliancePermissionRotateValue
                                  )}" data-delivery-compliance-permission-rotate />
                                  <input class="billing-input" type="text" placeholder="update_ticket_registry scope" value="${escapeHtml(
                                    compliancePermissionRegistryValue
                                  )}" data-delivery-compliance-permission-registry />
                                  <input class="billing-input" type="text" placeholder="reopen_compliance scope" value="${escapeHtml(
                                    compliancePermissionReopenValue
                                  )}" data-delivery-compliance-permission-reopen />
                                  <div class="report-export-actions">
                                    <button class="report-export-action" type="button" data-delivery-compliance-save-preset>Save Preset</button>
                                    <button class="report-export-action is-muted" type="button" data-delivery-compliance-audit-log>Write Audit Log</button>
                                  </div>
                                  <div class="report-card-copy">${escapeHtml(
                                    compliancePresetControl?.preset_name
                                      ? `preset=${String(compliancePresetControl.preset_name)}`
                                      : "no saved compliance preset yet"
                                  )}</div>
                                  <div class="report-card-copy">${escapeHtml(
                                    complianceAuditLog?.status
                                      ? `audit=${String(complianceAuditLog.status)} · ${String(complianceAuditLog.logged_at || "")}`
                                      : "no compliance audit log entry yet"
                                  )}</div>
                                </div>
                                <div class="report-list-item">
                                  <div class="report-preview-title">Role Policy Presets</div>
                                  <input class="billing-input" type="text" placeholder="role policy name" value="${escapeHtml(
                                    complianceRolePolicyNameValue
                                  )}" data-delivery-compliance-role-policy-name />
                                  <div class="report-export-actions">
                                    <button class="report-export-action" type="button" data-delivery-compliance-save-role-policy>Save Role Policy</button>
                                  </div>
                                  <div class="report-card-copy">${escapeHtml(
                                    Array.isArray(complianceRolePolicyPresets)
                                      ? complianceRolePolicyPresets
                                          .map((preset) => String(preset?.preset_name || "preset"))
                                          .join(" | ")
                                      : "no role policy presets yet"
                                  )}</div>
                                </div>
                                <div class="report-list-item">
                                  <div class="report-preview-title">Signed Approval Chain</div>
                                  <input class="billing-input" type="text" placeholder="approval decision" value="${escapeHtml(
                                    complianceApprovalDecisionValue
                                  )}" data-delivery-compliance-approval-decision />
                                  <input class="billing-input" type="text" placeholder="approval note" value="${escapeHtml(
                                    complianceApprovalNoteValue
                                  )}" data-delivery-compliance-approval-note />
                                  <div class="report-export-actions">
                                    <button class="report-export-action" type="button" data-delivery-compliance-approve>Sign Approval Chain</button>
                                  </div>
                                  <div class="report-card-copy">${escapeHtml(
                                    complianceApprovalChain?.approval_decision
                                      ? `decision=${String(complianceApprovalChain.approval_decision)} · status=${String(
                                          complianceApprovalChain.status || "approval_recorded"
                                        )}`
                                      : "no signed approval chain yet"
                                  )}</div>
                                  <div class="report-card-copy">${escapeHtml(
                                    Array.isArray(complianceApprovalChain?.signed_approvers)
                                      ? `signed=${complianceApprovalChain.signed_approvers
                                          .map((entry) => String(entry?.actor?.actor_role || "role"))
                                          .join(", ")}`
                                      : "no signed approvers yet"
                                  )}</div>
                                </div>
                                <div class="report-list-item">
                                  <div class="report-preview-title">Approver Routing</div>
                                  <textarea class="report-preview-code" data-delivery-compliance-approver-routing placeholder='[{"step":"operator_review","required_role":"operator","team":"release-ops/compliance"}]'>${escapeHtml(
                                    complianceApproverRoutingValue
                                  )}</textarea>
                                  <div class="report-export-actions">
                                    <button class="report-export-action" type="button" data-delivery-compliance-save-routing>Save Routing</button>
                                  </div>
                                </div>
                                <div class="report-list-item">
                                  <div class="report-preview-title">Required Signers</div>
                                  <input class="billing-input" type="text" placeholder="operator, editor" value="${escapeHtml(
                                    complianceRequiredSignersValue
                                  )}" data-delivery-compliance-required-signers />
                                  <div class="report-export-actions">
                                    <button class="report-export-action" type="button" data-delivery-compliance-save-signers>Save Required Signers</button>
                                  </div>
                                </div>
                                <div class="report-list-item">
                                  <div class="report-preview-title">Final Release Quorum</div>
                                  <input class="billing-input" type="text" placeholder="quorum name" value="${escapeHtml(
                                    complianceQuorumNameValue
                                  )}" data-delivery-compliance-quorum-name />
                                  <div class="report-export-actions">
                                    <button class="report-export-action" type="button" data-delivery-compliance-finalize-quorum>Finalize Release Quorum</button>
                                  </div>
                                  <div class="report-card-copy">${escapeHtml(
                                    complianceReleaseQuorum?.status
                                      ? `status=${String(complianceReleaseQuorum.status)} · met=${String(
                                          complianceReleaseQuorum.quorum_met
                                        )}`
                                      : "no quorum check yet"
                                  )}</div>
                                  <div class="report-card-copy">${escapeHtml(
                                    Array.isArray(complianceReleaseQuorum?.missing_signers)
                                      ? `missing=${complianceReleaseQuorum.missing_signers.join(", ")}`
                                      : ""
                                  )}</div>
                                  <div class="report-card-copy">${escapeHtml(
                                    complianceLockedPublishGate?.gate_state
                                      ? `gate=${String(complianceLockedPublishGate.gate_state)}`
                                      : "publish gate not issued yet"
                                  )}</div>
                                  <div class="report-card-copy">${escapeHtml(
                                    complianceReleaseUnblockToken?.status
                                      ? `token=${String(complianceReleaseUnblockToken.status)}`
                                      : "no release unblock token yet"
                                  )}</div>
                                  <div class="report-card-copy">${escapeHtml(
                                    complianceImmutablePublishAuthorization?.authorization_state
                                      ? `authorization=${String(
                                          complianceImmutablePublishAuthorization.authorization_state
                                        )}`
                                      : "no immutable publish authorization yet"
                                  )}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>`
                      : ""
                  }
                </div>
                ${
                  arrangementReleaseCandidates.length
                    ? arrangementReleaseCandidates
                        .map(
                          (entry) => `<div class="report-list-item">
                              <div class="report-preview-title">${escapeHtml(entry.candidate_name || entry.version_name || entry.revision_id)}</div>
                              <div class="report-card-copy">${escapeHtml(
                                `${entry.state || "candidate"} · ${entry.version_name || ""} · ${entry.revision_id || ""}`
                              )}</div>
                              <div class="report-card-copy">${escapeHtml(
                                `${entry.nominated_at || "nominated"}${entry.locked_at ? ` · locked ${entry.locked_at}` : ""}${entry.published_at ? ` · published ${entry.published_at}` : ""}`
                              )}</div>
                            </div>`
                        )
                        .join("")
                    : `<div class="report-empty">${escapeHtml(
                        dashboardCopy("Release candidates will appear here after nomination.", "提名 release candidate 之后，这里会出现候选历史。")
                      )}</div>`
                }
              </div>
            </div>
            ${
              focusedRevision
                ? `<div class="report-list-item">
                    <div class="report-preview-title">Focused Revision</div>
                    <pre class="report-preview-code">${escapeHtml(JSON.stringify(focusedRevision, null, 2))}</pre>
                  </div>`
                : ""
            }
            ${
              focusedRevisionDiff
                ? `<div class="report-list-item">
                    <div class="report-preview-title">Revision Compare</div>
                    <pre class="report-preview-code">${escapeHtml(JSON.stringify(focusedRevisionDiff, null, 2))}</pre>
                  </div>`
                : ""
            }
          </div>
        </div>
      `
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy("Patch bundle export appears after phrase comparison data is ready.", "phrase 对比数据就绪后，这里会出现 patch bundle 导出。")
      )}</div>`;

  const regionLinkConclusionHtml =
    globalThis.buildMusicDeliveryDashboardRegionLinkConclusionHtmlModule?.(deliveryDashboardState) ||
    `<div class="report-empty">${escapeHtml(
      deliveryDashboardState.probeError ||
        dashboardCopy("Region link probe summary is not available yet.", "地区链路探针摘要暂时不可用。")
    )}</div>`;

  let previewHtml =
 `<div class="report-empty">${escapeHtml(
    dashboardCopy("Choose a file in Package Browser to preview it here.", "在交付资产浏览器里选择一个文件，即可在这里预览。")
  )}</div>`;
  if (deliveryDashboardState.previewLoading) {
    previewHtml = `<div class="report-empty">${escapeHtml(
      dashboardCopy("Loading inline preview...", "正在加载内联预览...")
    )}</div>`;
  } else if (deliveryDashboardState.previewError) {
    previewHtml = `<div class="report-empty">${escapeHtml(deliveryDashboardState.previewError)}</div>`;
  } else if (preview?.kind === "wav") {
    previewHtml =
      globalThis.buildDeliveryPreviewWavMarkup?.(preview, deliveryDashboardState.previewUrl || "") ||
      `<div class="report-card-copy">${escapeHtml(deliveryArtifactDisplayPath(preview.item))}</div>`;
  } else if (preview?.kind === "json" || preview?.kind === "text") {
    previewHtml =
      globalThis.buildDeliveryPreviewTextMarkup?.(preview) ||
      `<pre class="report-preview-code">${escapeHtml(preview.pretty || preview.text || "")}</pre>`;
  } else if (preview?.kind === "zip") {
    previewHtml =
      globalThis.buildDeliveryPreviewZipMarkup?.(preview) ||
      `<div class="report-card-copy">${escapeHtml(deliveryArtifactDisplayPath(preview.item))}</div>`;
  }

  const lyricsFallbackDiversityAudit = buildLyricsFallbackDiversityAudit(
    deliveryDashboardState.lyricsSeedHistory
  );
  const lyricsSeedSpreadCard = buildLyricsSeedSpreadCard(
    deliveryDashboardState.lyricsSeedHistory
  );
  const lyricsRepeatedPhraseAlarm = buildLyricsRepeatedPhraseAlarm(
    deliveryDashboardState.lyricsSeedHistory
  );
  const lyricsUniverseRotationLane = buildLyricsUniverseRotationLane(
    deliveryDashboardState.lyricsSeedHistory
  );
  const lyricsTitleRepetitionMeter = buildLyricsTitleRepetitionMeter(
    deliveryDashboardState.lyricsSeedHistory
  );
  const lyricsFallbackPhraseBlacklistCard = buildLyricsFallbackPhraseBlacklistCard(
    deliveryDashboardState.lyricsSeedHistory
  );
  const lyricsDiversityTimelineStrip = buildLyricsDiversityTimelineStrip(
    deliveryDashboardState.lyricsSeedHistory
  );
  const lyricsTitleCollisionWatchlist = buildLyricsTitleCollisionWatchlist(
    deliveryDashboardState.lyricsSeedHistory
  );
  const lyricsBlacklistHitHistory = buildLyricsBlacklistHitHistory(
    deliveryDashboardState.lyricsSeedHistory
  );

  deliveryDashboardBody.innerHTML = `
    <div class="report-result-stats">
      ${rows
        .map(
          ([label, value]) => `
            <div class="report-stat-chip">
              <div class="report-preview-title">${escapeHtml(label)}</div>
              <div class="report-card-copy">${value}</div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="report-section-title">Notes</div>
    <div class="report-list">${noteItems}</div>
    <div class="report-section-title">Lyrics Diversity</div>
    <div class="report-list">
      <div class="report-list-item">
        <div class="report-preview-title">Fallback Diversity Audit</div>
        <div class="report-card-copy">${escapeHtml(
          dashboardCopy(
            `${lyricsFallbackDiversityAudit.level} · score ${lyricsFallbackDiversityAudit.score}/100`,
            `${lyricsFallbackDiversityAudit.level} · 分数 ${lyricsFallbackDiversityAudit.score}/100`
          )
        )}</div>
        <div class="report-card-copy">${escapeHtml(lyricsFallbackDiversityAudit.note)}</div>
      </div>
      <div class="report-list-item">
        <div class="report-preview-title">Seed Spread Card</div>
        <div class="report-card-copy">${escapeHtml(lyricsSeedSpreadCard.headline)}</div>
        ${lyricsSeedSpreadCard.rows
          .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
          .join("")}
      </div>
      <div class="report-list-item">
        <div class="report-preview-title">Repeated-Phrase Alarm</div>
        <div class="report-card-copy">${escapeHtml(lyricsRepeatedPhraseAlarm.alert)}</div>
        <div class="report-card-copy">${escapeHtml(lyricsRepeatedPhraseAlarm.note)}</div>
      </div>
      <div class="report-list-item">
        <div class="report-preview-title">Universe Rotation Lane</div>
        <div class="report-card-copy">${escapeHtml(lyricsUniverseRotationLane.headline)}</div>
        <div class="report-card-copy">${escapeHtml(lyricsUniverseRotationLane.note)}</div>
        ${lyricsUniverseRotationLane.rows
          .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
          .join("")}
      </div>
      <div class="report-list-item">
        <div class="report-preview-title">Title Repetition Meter</div>
        <div class="report-card-copy">${escapeHtml(lyricsTitleRepetitionMeter.meter)}</div>
        <div class="report-card-copy">${escapeHtml(lyricsTitleRepetitionMeter.note)}</div>
      </div>
      <div class="report-list-item">
        <div class="report-preview-title">Fallback Phrase Blacklist Card</div>
        <div class="report-card-copy">${escapeHtml(lyricsFallbackPhraseBlacklistCard.headline)}</div>
        <div class="report-card-copy">${escapeHtml(lyricsFallbackPhraseBlacklistCard.note)}</div>
      </div>
      <div class="report-list-item">
        <div class="report-preview-title">Diversity Timeline Strip</div>
        <div class="report-card-copy">${escapeHtml(lyricsDiversityTimelineStrip.headline)}</div>
        ${lyricsDiversityTimelineStrip.chips
          .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
          .join("")}
      </div>
      <div class="report-list-item">
        <div class="report-preview-title">Title Collision Watchlist</div>
        <div class="report-card-copy">${escapeHtml(lyricsTitleCollisionWatchlist.headline)}</div>
        ${lyricsTitleCollisionWatchlist.rows
          .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
          .join("")}
      </div>
      <div class="report-list-item">
        <div class="report-preview-title">Blacklist Hit History</div>
        <div class="report-card-copy">${escapeHtml(lyricsBlacklistHitHistory.headline)}</div>
        ${lyricsBlacklistHitHistory.rows
          .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
          .join("")}
      </div>
    </div>
    <div class="report-section-title">Region Link Conclusion</div>
    ${regionLinkConclusionHtml}
    <div class="report-section-title">Package Browser</div>
    ${browserHtml}
    <div class="report-section-title">Stem Audition Mixer</div>
    <div class="report-list">
      <div class="report-list-item">
        <div class="report-card-copy">${escapeHtml(mixerSummary)}</div>
        ${mixerControlsHtml}
      </div>
      ${mixerTracksHtml}
    </div>
    <div class="report-section-title">Stem Timeline</div>
    <div class="report-list">
      <div class="report-list-item">
        <div class="report-card-copy">${escapeHtml(arrangementSummary)}</div>
      </div>
      <div class="report-list-item">${timelineHtml}</div>
      ${sectionPanelHtml}
      ${comparePanelHtml}
    </div>
    <div class="report-section-title">Section Stem Matrix</div>
    <div class="report-list">
      <div class="report-list-item">
        <div class="report-card-copy">${escapeHtml(roleFocusSummary)}</div>
        <div class="report-export-actions">
          <button class="report-export-action is-muted" type="button" data-delivery-role-clear ${
            deliveryDashboardState.focusRole ? "" : "disabled"
          }>Clear Focus</button>
        </div>
      </div>
      ${sectionRoleMatrixHtml}
    </div>
    <div class="report-section-title">Phrase Heatmap</div>
    <div class="report-list">
      <div class="report-list-item">
        <div class="report-card-copy">${escapeHtml(phraseFocusSummary)}</div>
      </div>
      ${phraseHeatmapHtml}
      ${chordLaneHtml}
      ${articulationLensHtml}
    </div>
    <div class="report-section-title">Phrase Compare Deck</div>
    <div class="report-list">${compareDeckHtml}</div>
    <div class="report-section-title">Motif Tracker</div>
    <div class="report-list">${motifTrackerHtml}</div>
    <div class="report-section-title">Rewrite Assist</div>
    <div class="report-list">${rewriteAssistHtml}</div>
    <div class="report-section-title">Rewrite Payload</div>
    <div class="report-list">${rewritePayloadHtml}</div>
    <div class="report-section-title">Rewrite Sandbox</div>
    <div class="report-list">${rewriteSandboxHtml}</div>
    <div class="report-section-title">Rewrite Patch Bundle</div>
    <div class="report-list">${patchBundleHtml}</div>
    <div class="report-section-title">Inline Preview</div>
    <div class="report-list">${previewHtml}</div>
  `;
  globalThis.bindMusicDeliveryPreviewButtonsModule?.();
  globalThis.bindMusicDeliveryMixerButtonsModule?.(stemItems, arrangementItem, phraseItem);
  if (deliveryDashboardBody) {
    const compareASelect = deliveryDashboardBody.querySelector('[data-delivery-compare-select="A"]');
    if (compareASelect && compareA) compareASelect.value = compareA.id;
    const compareBSelect = deliveryDashboardBody.querySelector('[data-delivery-compare-select="B"]');
    if (compareBSelect && compareB) compareBSelect.value = compareB.id;
  }
  syncDeliveryDashboardActionPermissions();
  } catch (error) {
    console.error("[delivery-dashboard] render failed", error);
    if (deliveryDashboardSummary instanceof HTMLElement) {
      deliveryDashboardSummary.textContent = dashboardCopy(
        "Music delivery dashboard hit a recoverable render issue.",
        "音乐交付面板遇到了一个可恢复的渲染问题。"
      );
    }
    if (deliveryDashboardBody instanceof HTMLElement) {
      deliveryDashboardBody.innerHTML = `<div class="report-empty">${escapeHtml(
        dashboardCopy(
          "The dashboard UI is recovering. Refresh once if sections look incomplete.",
          "面板正在恢复，如果内容不完整可以再刷新一次。"
        )
      )}</div>`;
    }
  }
}

window.renderMusicDeliveryDashboardModule = renderMusicDeliveryDashboardModule;
