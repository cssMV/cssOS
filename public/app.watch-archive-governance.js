function buildWatchArchiveGovernanceExceptionRegisterBridge(
  budgetGuardrails,
  experimentKillScaleRules,
  revenueRiskBridge
) {
  const guardrails = Array.isArray(budgetGuardrails) ? budgetGuardrails : [];
  const rules = Array.isArray(experimentKillScaleRules) ? experimentKillScaleRules : [];
  const exposure = Number(revenueRiskBridge?.exposure_points || 0);
  const register = [];
  if (exposure >= 20) {
    register.push({
      label: dashboardCopy("High exposure override risk", "高暴露值例外风险"),
      summary: dashboardCopy(
        "Any request to widen budget or scale experiments should be treated as a governance exception while exposure remains elevated.",
        "在暴露分值仍偏高时，任何放宽预算或放大实验的请求都应被视为治理例外。"
      )
    });
  }
  if (guardrails.length) {
    register.push({
      label: dashboardCopy("Guardrail bypass watch", "护栏绕过观察"),
      summary: dashboardCopy(
        `Track any action that attempts to bypass ${guardrails[0].label.toLowerCase()}.`,
        `跟踪任何试图绕过“${guardrails[0].label}”的动作。`
      )
    });
  }
  if (rules.length) {
    register.push({
      label: dashboardCopy("Kill-scale policy exception", "砍掉/放大规则例外"),
      summary: dashboardCopy(
        "If an experiment is scaled despite a kill recommendation, log it as a governance exception for leadership review.",
        "如果某实验在应被砍掉时仍被放大，应登记为治理例外供管理层复核。"
      )
    });
  }
  return register;
}

function buildWatchArchivePortfolioRebalanceDraftBridge(
  capitalAllocationScoreboard,
  governanceExceptionRegister,
  spendApprovalLanes
) {
  const scoreRows = Array.isArray(capitalAllocationScoreboard) ? capitalAllocationScoreboard : [];
  const exceptionRows = Array.isArray(governanceExceptionRegister) ? governanceExceptionRegister : [];
  const spendRows = Array.isArray(spendApprovalLanes) ? spendApprovalLanes : [];
  return {
    schema: "cssmv.watch_archive_portfolio_rebalance_draft.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Portfolio rebalance draft", "组合再平衡草稿"),
    rebalance_case: scoreRows[0]?.summary || "",
    governance_pressure: exceptionRows.length
      ? exceptionRows[0].summary
      : dashboardCopy("No governance exception pressure is visible right now.", "当前没有明显的治理例外压力。"),
    approval_shift:
      spendRows[0]?.summary || dashboardCopy("No approval lane shift is visible right now.", "当前没有明显的审批线迁移信号。")
  };
}

function buildWatchArchiveCapitalCommitteeAgendaBridge(
  capitalAllocationScoreboard,
  governanceExceptionRegister,
  portfolioRebalanceDraft
) {
  const scoreRows = Array.isArray(capitalAllocationScoreboard) ? capitalAllocationScoreboard : [];
  const exceptionRows = Array.isArray(governanceExceptionRegister) ? governanceExceptionRegister : [];
  return {
    schema: "cssmv.watch_archive_capital_committee_agenda.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Capital committee agenda", "资本委员会会议议程"),
    topics: [
      scoreRows[0]?.summary || dashboardCopy("Review capital focus.", "复核资本配置焦点。"),
      exceptionRows[0]?.summary || dashboardCopy("Review governance exceptions.", "复核治理例外。"),
      portfolioRebalanceDraft?.rebalance_case || dashboardCopy("Review rebalance case.", "复核再平衡理由。")
    ]
  };
}

function buildWatchArchiveExceptionClosureTrackerBridge(
  governanceExceptionRegister,
  spendApprovalLanes,
  boardDecisionPacket
) {
  const exceptions = Array.isArray(governanceExceptionRegister) ? governanceExceptionRegister : [];
  const spendRows = Array.isArray(spendApprovalLanes) ? spendApprovalLanes : [];
  return exceptions.map((item, index) => ({
    exception: item.label,
    state: dashboardCopy("open", "未关闭"),
    closure_path:
      spendRows[index % Math.max(1, spendRows.length)]?.lane || dashboardCopy("Approval lane", "审批线"),
    board_note:
      boardDecisionPacket?.headline || dashboardCopy("Board packet review required.", "需要董事会决策包复核。")
  }));
}

function buildWatchArchiveReallocationOutcomeMapBridge(
  portfolioRebalanceDraft,
  capitalAllocationScoreboard,
  experimentOutcomeLedger
) {
  const scoreRows = Array.isArray(capitalAllocationScoreboard) ? capitalAllocationScoreboard : [];
  const experimentRows = Array.isArray(experimentOutcomeLedger) ? experimentOutcomeLedger : [];
  return {
    schema: "cssmv.watch_archive_reallocation_outcome_map.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Reallocation outcome map", "重配结果图"),
    capital_signal: scoreRows[0]?.summary || "",
    rebalance_signal: portfolioRebalanceDraft?.rebalance_case || "",
    experiment_signal:
      experimentRows[0]?.summary || dashboardCopy("No experiment signal yet.", "当前还没有实验结果信号。")
  };
}

function buildWatchArchiveInvestmentMemoShelfBridge(
  capitalCommitteeAgenda,
  boardDecisionPacket,
  portfolioRebalanceDraft
) {
  return [
    {
      title: dashboardCopy("Committee memo", "委员会备忘"),
      summary: capitalCommitteeAgenda?.headline || dashboardCopy("No committee memo yet.", "当前还没有委员会备忘。")
    },
    {
      title: dashboardCopy("Board packet memo", "董事会决策备忘"),
      summary:
        boardDecisionPacket?.allocation_summary || dashboardCopy("No board packet memo yet.", "当前还没有董事会决策备忘。")
    },
    {
      title: dashboardCopy("Rebalance memo", "再平衡备忘"),
      summary: portfolioRebalanceDraft?.rebalance_case || dashboardCopy("No rebalance memo yet.", "当前还没有再平衡备忘。")
    }
  ];
}

function buildWatchArchiveExceptionSlaClockBridge(exceptionClosureTracker) {
  const exceptions = Array.isArray(exceptionClosureTracker) ? exceptionClosureTracker : [];
  return exceptions.map((item, index) => ({
    exception: item.exception,
    state: item.state,
    sla_window: dashboardCopy(
      `SLA window ${index + 1}: review this exception in the next committee cycle.`,
      `SLA 窗口 ${index + 1}：在下一次委员会周期内复核该例外。`
    )
  }));
}

function buildWatchArchiveAllocationPerformanceTimelineBridge(
  capitalAllocationScoreboard,
  reallocationOutcomeMap,
  experimentOutcomeLedger
) {
  const scoreRows = Array.isArray(capitalAllocationScoreboard) ? capitalAllocationScoreboard : [];
  const experimentRows = Array.isArray(experimentOutcomeLedger) ? experimentOutcomeLedger : [];
  return [
    {
      step: dashboardCopy("Allocation baseline", "配置基线"),
      summary: scoreRows[0]?.summary || dashboardCopy("No allocation baseline yet.", "当前还没有配置基线。")
    },
    {
      step: dashboardCopy("Reallocation signal", "重配信号"),
      summary: reallocationOutcomeMap?.rebalance_signal || dashboardCopy("No reallocation signal yet.", "当前还没有重配信号。")
    },
    {
      step: dashboardCopy("Experiment performance", "实验表现"),
      summary: experimentRows[0]?.summary || dashboardCopy("No experiment performance signal yet.", "当前还没有实验表现信号。")
    }
  ];
}

function buildWatchArchiveCommitteeBriefingHistoryBridge(
  investmentMemoShelf,
  capitalCommitteeAgenda,
  boardDecisionPacket
) {
  const shelfRows = Array.isArray(investmentMemoShelf) ? investmentMemoShelf : [];
  return [
    {
      title: dashboardCopy("Current committee agenda", "当前委员会议程"),
      summary: capitalCommitteeAgenda?.headline || dashboardCopy("No current committee agenda yet.", "当前还没有委员会议程。")
    },
    {
      title: dashboardCopy("Latest board packet", "最新董事会决策包"),
      summary: boardDecisionPacket?.headline || dashboardCopy("No board packet history yet.", "当前还没有董事会决策包历史。")
    },
    ...shelfRows.map((item) => ({
      title: item.title,
      summary: item.summary
    }))
  ];
}

function buildWatchArchiveSlaBreachEscalationsBridge(exceptionSlaClock, governanceExceptionRegister) {
  const clocks = Array.isArray(exceptionSlaClock) ? exceptionSlaClock : [];
  const exceptions = Array.isArray(governanceExceptionRegister) ? governanceExceptionRegister : [];
  return clocks.map((item, index) => ({
    exception: item.exception,
    severity: exceptions.length > 1 || index === 0 ? "warning" : "info",
    summary: dashboardCopy(
      `Escalate if ${item.exception} misses its next committee-cycle review window.`,
      `如果 ${item.exception} 错过下一次委员会周期复核窗口，就应升级处理。`
    )
  }));
}

function buildWatchArchiveAllocationWinLossLogBridge(
  allocationPerformanceTimeline,
  reallocationOutcomeMap,
  experimentOutcomeLedger
) {
  const timelineRows = Array.isArray(allocationPerformanceTimeline) ? allocationPerformanceTimeline : [];
  const experimentRows = Array.isArray(experimentOutcomeLedger) ? experimentOutcomeLedger : [];
  return [
    {
      label: dashboardCopy("Win signal", "成功信号"),
      summary: timelineRows[0]?.summary || dashboardCopy("No win signal is visible yet.", "当前还没有明显的成功信号。")
    },
    {
      label: dashboardCopy("Loss signal", "失利信号"),
      summary: reallocationOutcomeMap?.experiment_signal || dashboardCopy("No loss signal is visible yet.", "当前还没有明显的失利信号。")
    },
    {
      label: dashboardCopy("Experiment carryover", "实验延续信号"),
      summary:
        experimentRows[0]?.accounting_note || dashboardCopy("No experiment carryover note is visible yet.", "当前还没有实验延续信号。")
    }
  ];
}

function buildWatchArchiveGovernanceNarrativeDraftBridge(
  committeeBriefingHistory,
  slaBreachEscalations,
  allocationWinLossLog
) {
  const briefingRows = Array.isArray(committeeBriefingHistory) ? committeeBriefingHistory : [];
  const escalationRows = Array.isArray(slaBreachEscalations) ? slaBreachEscalations : [];
  const winLossRows = Array.isArray(allocationWinLossLog) ? allocationWinLossLog : [];
  return {
    schema: "cssmv.watch_archive_governance_narrative_draft.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Governance narrative draft", "治理叙事草稿"),
    committee_story: briefingRows[0]?.summary || dashboardCopy("No committee story yet.", "当前还没有委员会叙事。"),
    escalation_story: escalationRows[0]?.summary || dashboardCopy("No escalation story yet.", "当前还没有升级叙事。"),
    portfolio_story: winLossRows[0]?.summary || dashboardCopy("No portfolio win-loss story yet.", "当前还没有组合成败叙事。")
  };
}

function buildWatchArchiveEscalationOwnershipMapBridge(
  slaBreachEscalations,
  spendApprovalLanes,
  committeeBriefingHistory
) {
  const escalations = Array.isArray(slaBreachEscalations) ? slaBreachEscalations : [];
  const approvalRows = Array.isArray(spendApprovalLanes) ? spendApprovalLanes : [];
  const briefingRows = Array.isArray(committeeBriefingHistory) ? committeeBriefingHistory : [];
  return escalations.map((item, index) => ({
    escalation: item.exception,
    owner_lane:
      approvalRows[index % Math.max(1, approvalRows.length)]?.lane || dashboardCopy("Approval lane", "审批线"),
    committee_hook:
      briefingRows[index % Math.max(1, briefingRows.length)]?.title || dashboardCopy("Committee briefing", "委员会简报")
  }));
}

function buildWatchArchivePortfolioLessonRegisterBridge(
  allocationWinLossLog,
  experimentOutcomeLedger,
  reallocationOutcomeMap
) {
  const winLossRows = Array.isArray(allocationWinLossLog) ? allocationWinLossLog : [];
  const experimentRows = Array.isArray(experimentOutcomeLedger) ? experimentOutcomeLedger : [];
  return [
    {
      lesson: dashboardCopy("Capital lesson", "资本配置经验"),
      summary: winLossRows[0]?.summary || dashboardCopy("No capital lesson is visible yet.", "当前还没有资本配置经验。")
    },
    {
      lesson: dashboardCopy("Experiment lesson", "实验经验"),
      summary: experimentRows[0]?.accounting_note || dashboardCopy("No experiment lesson is visible yet.", "当前还没有实验经验。")
    },
    {
      lesson: dashboardCopy("Reallocation lesson", "重配经验"),
      summary: reallocationOutcomeMap?.rebalance_signal || dashboardCopy("No reallocation lesson is visible yet.", "当前还没有重配经验。")
    }
  ];
}

window.buildWatchArchiveGovernanceExceptionRegisterBridge = buildWatchArchiveGovernanceExceptionRegisterBridge;
window.buildWatchArchivePortfolioRebalanceDraftBridge = buildWatchArchivePortfolioRebalanceDraftBridge;
window.buildWatchArchiveCapitalCommitteeAgendaBridge = buildWatchArchiveCapitalCommitteeAgendaBridge;
window.buildWatchArchiveExceptionClosureTrackerBridge = buildWatchArchiveExceptionClosureTrackerBridge;
window.buildWatchArchiveReallocationOutcomeMapBridge = buildWatchArchiveReallocationOutcomeMapBridge;
window.buildWatchArchiveInvestmentMemoShelfBridge = buildWatchArchiveInvestmentMemoShelfBridge;
window.buildWatchArchiveExceptionSlaClockBridge = buildWatchArchiveExceptionSlaClockBridge;
window.buildWatchArchiveAllocationPerformanceTimelineBridge = buildWatchArchiveAllocationPerformanceTimelineBridge;
window.buildWatchArchiveCommitteeBriefingHistoryBridge = buildWatchArchiveCommitteeBriefingHistoryBridge;
window.buildWatchArchiveSlaBreachEscalationsBridge = buildWatchArchiveSlaBreachEscalationsBridge;
window.buildWatchArchiveAllocationWinLossLogBridge = buildWatchArchiveAllocationWinLossLogBridge;
window.buildWatchArchiveGovernanceNarrativeDraftBridge = buildWatchArchiveGovernanceNarrativeDraftBridge;
window.buildWatchArchiveEscalationOwnershipMapBridge = buildWatchArchiveEscalationOwnershipMapBridge;
window.buildWatchArchivePortfolioLessonRegisterBridge = buildWatchArchivePortfolioLessonRegisterBridge;
