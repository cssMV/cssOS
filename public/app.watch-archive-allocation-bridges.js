function buildWatchArchiveRoiInterventionLadderModule(
  monetizationInterventionDraft,
  revenueRiskBridge,
  profitRecoveryScenarios
) {
  const actions = Array.isArray(monetizationInterventionDraft?.actions)
    ? monetizationInterventionDraft.actions
    : [];
  const scenarios = Array.isArray(profitRecoveryScenarios) ? profitRecoveryScenarios : [];
  const exposure = Number(revenueRiskBridge?.exposure_points || 0);
  return actions.map((action, index) => ({
    tier: dashboardCopy(`ROI step ${index + 1}`, `ROI 第 ${index + 1} 步`),
    summary: action,
    roi_hint: dashboardCopy(
      exposure >= 20
        ? "Higher ROI if it directly reduces delivery drag before adding more demand."
        : "Moderate ROI if paired with the current recovery path and monitored weekly.",
      exposure >= 20
        ? "如果它能先直接减少交付拖拽，ROI 会更高。"
        : "如果和当前恢复路径一起执行并每周监控，ROI 会更稳。"
    ),
    linked_recovery: scenarios[index % Math.max(1, scenarios.length)]?.label || dashboardCopy("Recovery path", "恢复路径")
  }));
}

function buildWatchArchiveHiringTriggerThresholdsModule(
  staffingTradeoffCards,
  capacityBottleneckDigest,
  ownerWorkload
) {
  const workloadRows = Array.isArray(ownerWorkload) ? ownerWorkload : [];
  const busiest = workloadRows[0] || null;
  const pressureSignal = Array.isArray(staffingTradeoffCards) ? staffingTradeoffCards.length : 0;
  return [
    {
      label: dashboardCopy("Busiest owner trigger", "最繁忙负责人阈值"),
      summary: busiest
        ? dashboardCopy(
            `Consider hiring if ${busiest.owner} remains the clear bottleneck after rebalance attempts.`,
            `如果在重分配之后 ${busiest.owner} 仍明显是瓶颈，就可以开始考虑扩编。`
          )
        : dashboardCopy("Waiting for stronger owner workload evidence.", "仍在等待更明确的负责人负载证据。")
    },
    {
      label: dashboardCopy("Repeated bottleneck trigger", "重复瓶颈阈值"),
      summary: dashboardCopy(
        `${pressureSignal} staffing tradeoff signal(s) are active; repeated appearances should move the team from rebalance to hiring review.`,
        `当前有 ${pressureSignal} 条 staffing 取舍信号；如果持续重复出现，就应从重分配转向扩编评估。`
      )
    },
    {
      label: dashboardCopy("Operator confirmation trigger", "运营确认阈值"),
      summary: dashboardCopy(
        `${capacityBottleneckDigest?.operator_focus || dashboardCopy("Review operator bottleneck focus first.", "先复核运营瓶颈焦点。")}`,
        `${capacityBottleneckDigest?.operator_focus || dashboardCopy("先复核运营瓶颈焦点。", "先复核运营瓶颈焦点。")}`
      )
    }
  ];
}

function buildWatchArchiveMonetizationExperimentBoardModule(
  pricingThroughputActionSheet,
  monetizationInterventionDraft,
  revenueRiskBridge
) {
  return globalThis.buildWatchArchiveMonetizationExperimentBoardBridge?.(
    pricingThroughputActionSheet,
    monetizationInterventionDraft,
    revenueRiskBridge
  ) || [];
}

function buildWatchArchiveExecutiveAllocationMemoModule(
  roiLadder,
  hiringThresholds,
  experimentBoard
) {
  return globalThis.buildWatchArchiveExecutiveAllocationMemoBridge?.(
    roiLadder,
    hiringThresholds,
    experimentBoard
  ) || null;
}

function buildWatchArchiveBudgetGuardrailsModule(
  revenueRiskBridge,
  roiLadder,
  pricingThroughputActionSheet
) {
  return globalThis.buildWatchArchiveBudgetGuardrailsBridge?.(
    revenueRiskBridge,
    roiLadder,
    pricingThroughputActionSheet
  ) || [];
}

function buildWatchArchiveExperimentOutcomeLedgerModule(
  experimentBoard,
  revenueRiskBridge,
  profitRecoveryScenarios
) {
  return globalThis.buildWatchArchiveExperimentOutcomeLedgerBridge?.(
    experimentBoard,
    revenueRiskBridge,
    profitRecoveryScenarios
  ) || [];
}

function buildWatchArchiveBoardDecisionPacketModule(
  executiveAllocationMemo,
  budgetGuardrails,
  experimentOutcomeLedger
) {
  return globalThis.buildWatchArchiveBoardDecisionPacketBridge?.(
    executiveAllocationMemo,
    budgetGuardrails,
    experimentOutcomeLedger
  ) || null;
}

function buildWatchArchiveSpendApprovalLanesModule(
  budgetGuardrails,
  executiveAllocationMemo,
  hiringThresholds
) {
  return globalThis.buildWatchArchiveSpendApprovalLanesBridge?.(
    budgetGuardrails,
    executiveAllocationMemo,
    hiringThresholds
  ) || [];
}

function buildWatchArchiveExperimentKillScaleRulesModule(
  experimentBoard,
  revenueRiskBridge,
  budgetGuardrails
) {
  return globalThis.buildWatchArchiveExperimentKillScaleRulesBridge?.(
    experimentBoard,
    revenueRiskBridge,
    budgetGuardrails
  ) || [];
}

function buildWatchArchiveCapitalAllocationScoreboardModule(
  boardDecisionPacket,
  spendApprovalLanes,
  experimentOutcomeLedger
) {
  return globalThis.buildWatchArchiveCapitalAllocationScoreboardBridge?.(
    boardDecisionPacket,
    spendApprovalLanes,
    experimentOutcomeLedger
  ) || [];
}

function buildWatchArchiveGovernanceExceptionRegisterModule(
  budgetGuardrails,
  experimentKillScaleRules,
  revenueRiskBridge
) {
  return globalThis.buildWatchArchiveGovernanceExceptionRegisterBridge?.(
    budgetGuardrails,
    experimentKillScaleRules,
    revenueRiskBridge
  ) || [];
}

function buildWatchArchivePortfolioRebalanceDraftModule(
  capitalAllocationScoreboard,
  governanceExceptionRegister,
  spendApprovalLanes
) {
  return globalThis.buildWatchArchivePortfolioRebalanceDraftBridge?.(
    capitalAllocationScoreboard,
    governanceExceptionRegister,
    spendApprovalLanes
  ) || null;
}

function buildWatchArchiveCapitalCommitteeAgendaModule(
  capitalAllocationScoreboard,
  governanceExceptionRegister,
  portfolioRebalanceDraft
) {
  return globalThis.buildWatchArchiveCapitalCommitteeAgendaBridge?.(
    capitalAllocationScoreboard,
    governanceExceptionRegister,
    portfolioRebalanceDraft
  ) || null;
}

function buildWatchArchiveExceptionClosureTrackerModule(
  governanceExceptionRegister,
  spendApprovalLanes,
  boardDecisionPacket
) {
  return globalThis.buildWatchArchiveExceptionClosureTrackerBridge?.(
    governanceExceptionRegister,
    spendApprovalLanes,
    boardDecisionPacket
  ) || [];
}

function buildWatchArchiveReallocationOutcomeMapModule(
  portfolioRebalanceDraft,
  capitalAllocationScoreboard,
  experimentOutcomeLedger
) {
  return globalThis.buildWatchArchiveReallocationOutcomeMapBridge?.(
    portfolioRebalanceDraft,
    capitalAllocationScoreboard,
    experimentOutcomeLedger
  ) || null;
}

function buildWatchArchiveInvestmentMemoShelfModule(
  capitalCommitteeAgenda,
  boardDecisionPacket,
  portfolioRebalanceDraft
) {
  return globalThis.buildWatchArchiveInvestmentMemoShelfBridge?.(
    capitalCommitteeAgenda,
    boardDecisionPacket,
    portfolioRebalanceDraft
  ) || [];
}

function buildWatchArchiveExceptionSlaClockModule(exceptionClosureTracker) {
  return globalThis.buildWatchArchiveExceptionSlaClockBridge?.(exceptionClosureTracker) || [];
}

function buildWatchArchiveAllocationPerformanceTimelineModule(
  capitalAllocationScoreboard,
  reallocationOutcomeMap,
  experimentOutcomeLedger
) {
  return globalThis.buildWatchArchiveAllocationPerformanceTimelineBridge?.(
    capitalAllocationScoreboard,
    reallocationOutcomeMap,
    experimentOutcomeLedger
  ) || [];
}

function buildWatchArchiveCommitteeBriefingHistoryModule(
  investmentMemoShelf,
  capitalCommitteeAgenda,
  boardDecisionPacket
) {
  return globalThis.buildWatchArchiveCommitteeBriefingHistoryBridge?.(
    investmentMemoShelf,
    capitalCommitteeAgenda,
    boardDecisionPacket
  ) || [];
}

function buildWatchArchiveSlaBreachEscalationsModule(
  exceptionSlaClock,
  governanceExceptionRegister
) {
  return globalThis.buildWatchArchiveSlaBreachEscalationsBridge?.(
    exceptionSlaClock,
    governanceExceptionRegister
  ) || [];
}

function buildWatchArchiveAllocationWinLossLogModule(
  allocationPerformanceTimeline,
  reallocationOutcomeMap,
  experimentOutcomeLedger
) {
  return globalThis.buildWatchArchiveAllocationWinLossLogBridge?.(
    allocationPerformanceTimeline,
    reallocationOutcomeMap,
    experimentOutcomeLedger
  ) || [];
}

function buildWatchArchiveGovernanceNarrativeDraftModule(
  committeeBriefingHistory,
  slaBreachEscalations,
  allocationWinLossLog
) {
  return globalThis.buildWatchArchiveGovernanceNarrativeDraftBridge?.(
    committeeBriefingHistory,
    slaBreachEscalations,
    allocationWinLossLog
  ) || null;
}

function buildWatchArchiveEscalationOwnershipMapModule(
  slaBreachEscalations,
  spendApprovalLanes,
  committeeBriefingHistory
) {
  return globalThis.buildWatchArchiveEscalationOwnershipMapBridge?.(
    slaBreachEscalations,
    spendApprovalLanes,
    committeeBriefingHistory
  ) || [];
}

function buildWatchArchivePortfolioLessonRegisterModule(
  allocationWinLossLog,
  experimentOutcomeLedger,
  reallocationOutcomeMap
) {
  return globalThis.buildWatchArchivePortfolioLessonRegisterBridge?.(
    allocationWinLossLog,
    experimentOutcomeLedger,
    reallocationOutcomeMap
  ) || [];
}

function buildWatchArchiveOperatingDoctrineDraftModule(
  governanceNarrativeDraft,
  escalationOwnershipMap,
  portfolioLessonRegister
) {
  const ownershipRows = Array.isArray(escalationOwnershipMap) ? escalationOwnershipMap : [];
  const lessonRows = Array.isArray(portfolioLessonRegister) ? portfolioLessonRegister : [];
  return {
    schema: "cssmv.watch_archive_operating_doctrine_draft.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Operating doctrine draft", "经营制度草稿"),
    doctrine_core:
      governanceNarrativeDraft?.committee_story ||
      dashboardCopy("No doctrine core is visible yet.", "当前还没有制度主线。"),
    ownership_rule:
      ownershipRows[0]?.owner_lane ||
      dashboardCopy("No ownership rule is visible yet.", "当前还没有归属规则。"),
    lesson_rule:
      lessonRows[0]?.summary ||
      dashboardCopy("No lesson rule is visible yet.", "当前还没有经验规则。")
  };
}

function buildWatchArchiveRecurringFailureTaxonomyModule(
  slaBreachEscalations,
  allocationWinLossLog,
  portfolioLessonRegister
) {
  const breachRows = Array.isArray(slaBreachEscalations) ? slaBreachEscalations : [];
  const winLossRows = Array.isArray(allocationWinLossLog) ? allocationWinLossLog : [];
  const lessonRows = Array.isArray(portfolioLessonRegister) ? portfolioLessonRegister : [];
  return [
    {
      failure_type: dashboardCopy("Escalation delay", "升级延迟"),
      summary:
        breachRows[0]?.summary ||
        dashboardCopy("No escalation delay pattern is visible yet.", "当前还没有明显的升级延迟模式。")
    },
    {
      failure_type: dashboardCopy("Allocation miss", "配置失误"),
      summary:
        winLossRows[1]?.summary ||
        dashboardCopy("No allocation miss pattern is visible yet.", "当前还没有明显的配置失误模式。")
    },
    {
      failure_type: dashboardCopy("Lesson recurrence", "经验重复失误"),
      summary:
        lessonRows[0]?.summary ||
        dashboardCopy("No recurring lesson failure is visible yet.", "当前还没有明显的经验重复失误。")
    }
  ];
}

function buildWatchArchiveAllocationPlaybookIndexModule(
  operatingDoctrineDraft,
  portfolioLessonRegister,
  escalationOwnershipMap
) {
  const lessonRows = Array.isArray(portfolioLessonRegister) ? portfolioLessonRegister : [];
  const ownershipRows = Array.isArray(escalationOwnershipMap) ? escalationOwnershipMap : [];
  return [
    {
      title: dashboardCopy("Doctrine entry", "制度条目"),
      summary:
        operatingDoctrineDraft?.doctrine_core ||
        dashboardCopy("No doctrine entry yet.", "当前还没有制度条目。")
    },
    {
      title: dashboardCopy("Lesson entry", "经验条目"),
      summary:
        lessonRows[0]?.summary ||
        dashboardCopy("No lesson entry yet.", "当前还没有经验条目。")
    },
    {
      title: dashboardCopy("Ownership entry", "归属条目"),
      summary:
        ownershipRows[0]?.owner_lane ||
        dashboardCopy("No ownership entry yet.", "当前还没有归属条目。")
    }
  ];
}

function buildWatchArchiveGovernanceMaturityLadderModule(
  operatingDoctrineDraft,
  recurringFailureTaxonomy,
  allocationPlaybookIndex
) {
  return globalThis.buildWatchArchiveGovernanceMaturityLadderBridge?.(
    operatingDoctrineDraft,
    recurringFailureTaxonomy,
    allocationPlaybookIndex
  ) || [];
}

function buildWatchArchiveFailurePreventionChecklistModule(
  recurringFailureTaxonomy,
  escalationOwnershipMap,
  operatingDoctrineDraft
) {
  return globalThis.buildWatchArchiveFailurePreventionChecklistBridge?.(
    recurringFailureTaxonomy,
    escalationOwnershipMap,
    operatingDoctrineDraft
  ) || [];
}

function buildWatchArchiveInstitutionalMemoryShelfModule(
  portfolioLessonRegister,
  allocationPlaybookIndex,
  governanceNarrativeDraft
) {
  return globalThis.buildWatchArchiveInstitutionalMemoryShelfBridge?.(
    portfolioLessonRegister,
    allocationPlaybookIndex,
    governanceNarrativeDraft
  ) || [];
}

function buildWatchArchiveGovernanceHealthScoreModule(
  governanceMaturityLadder,
  failurePreventionChecklist,
  institutionalMemoryShelf
) {
  return globalThis.buildWatchArchiveGovernanceHealthScoreBridge?.(
    governanceMaturityLadder,
    failurePreventionChecklist,
    institutionalMemoryShelf
  ) || null;
}

function buildWatchArchivePreventionCoverageMapModule(
  failurePreventionChecklist,
  recurringFailureTaxonomy
) {
  return globalThis.buildWatchArchivePreventionCoverageMapBridge?.(
    failurePreventionChecklist,
    recurringFailureTaxonomy
  ) || [];
}

function buildWatchArchiveMemoryGapRegisterModule(
  institutionalMemoryShelf,
  allocationPlaybookIndex,
  governanceNarrativeDraft
) {
  return globalThis.buildWatchArchiveMemoryGapRegisterBridge?.(
    institutionalMemoryShelf,
    allocationPlaybookIndex,
    governanceNarrativeDraft
  ) || [];
}

function buildWatchArchiveGovernanceRoadmapDraftModule(
  governanceHealthScore,
  preventionCoverageMap,
  memoryGapRegister
) {
  return globalThis.buildWatchArchiveGovernanceRoadmapDraftBridge?.(
    governanceHealthScore,
    preventionCoverageMap,
    memoryGapRegister
  ) || null;
}

function buildWatchArchiveCoverageUpliftQueueModule(
  preventionCoverageMap,
  recurringFailureTaxonomy
) {
  return globalThis.buildWatchArchiveCoverageUpliftQueueBridge?.(
    preventionCoverageMap,
    recurringFailureTaxonomy
  ) || [];
}

function buildWatchArchiveMemoryCaptureBacklogModule(
  memoryGapRegister,
  institutionalMemoryShelf,
  allocationPlaybookIndex
) {
  return globalThis.buildWatchArchiveMemoryCaptureBacklogBridge?.(
    memoryGapRegister,
    institutionalMemoryShelf,
    allocationPlaybookIndex
  ) || [];
}

function buildWatchArchiveGovernanceSprintPlannerModule(
  governanceRoadmapDraft,
  coverageUpliftQueue,
  memoryCaptureBacklog
) {
  return globalThis.buildWatchArchiveGovernanceSprintPlannerBridge?.(
    governanceRoadmapDraft,
    coverageUpliftQueue,
    memoryCaptureBacklog
  ) || null;
}

function buildWatchArchiveUpliftRoiTrackerModule(
  coverageUpliftQueue,
  governanceHealthScore,
  recurringFailureTaxonomy
) {
  return globalThis.buildWatchArchiveUpliftRoiTrackerBridge?.(
    coverageUpliftQueue,
    governanceHealthScore,
    recurringFailureTaxonomy
  ) || [];
}

function buildWatchArchiveMemoryCompletionBurndownModule(
  memoryCaptureBacklog,
  institutionalMemoryShelf
) {
  return globalThis.buildWatchArchiveMemoryCompletionBurndownBridge?.(
    memoryCaptureBacklog,
    institutionalMemoryShelf
  ) || null;
}

Object.assign(globalThis, {
  buildWatchArchiveRoiInterventionLadderModule,
  buildWatchArchiveHiringTriggerThresholdsModule,
  buildWatchArchiveMonetizationExperimentBoardModule,
  buildWatchArchiveExecutiveAllocationMemoModule,
  buildWatchArchiveBudgetGuardrailsModule,
  buildWatchArchiveExperimentOutcomeLedgerModule,
  buildWatchArchiveBoardDecisionPacketModule,
  buildWatchArchiveSpendApprovalLanesModule,
  buildWatchArchiveExperimentKillScaleRulesModule,
  buildWatchArchiveCapitalAllocationScoreboardModule,
  buildWatchArchiveGovernanceExceptionRegisterModule,
  buildWatchArchivePortfolioRebalanceDraftModule,
  buildWatchArchiveCapitalCommitteeAgendaModule,
  buildWatchArchiveExceptionClosureTrackerModule,
  buildWatchArchiveReallocationOutcomeMapModule,
  buildWatchArchiveInvestmentMemoShelfModule,
  buildWatchArchiveExceptionSlaClockModule,
  buildWatchArchiveAllocationPerformanceTimelineModule,
  buildWatchArchiveCommitteeBriefingHistoryModule,
  buildWatchArchiveSlaBreachEscalationsModule,
  buildWatchArchiveAllocationWinLossLogModule,
  buildWatchArchiveGovernanceNarrativeDraftModule,
  buildWatchArchiveEscalationOwnershipMapModule,
  buildWatchArchivePortfolioLessonRegisterModule,
  buildWatchArchiveOperatingDoctrineDraftModule,
  buildWatchArchiveRecurringFailureTaxonomyModule,
  buildWatchArchiveAllocationPlaybookIndexModule,
  buildWatchArchiveGovernanceMaturityLadderModule,
  buildWatchArchiveFailurePreventionChecklistModule,
  buildWatchArchiveInstitutionalMemoryShelfModule,
  buildWatchArchiveGovernanceHealthScoreModule,
  buildWatchArchivePreventionCoverageMapModule,
  buildWatchArchiveMemoryGapRegisterModule,
  buildWatchArchiveGovernanceRoadmapDraftModule,
  buildWatchArchiveCoverageUpliftQueueModule,
  buildWatchArchiveMemoryCaptureBacklogModule,
  buildWatchArchiveGovernanceSprintPlannerModule,
  buildWatchArchiveUpliftRoiTrackerModule,
  buildWatchArchiveMemoryCompletionBurndownModule
});
