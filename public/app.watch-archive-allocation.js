function buildWatchArchivePricingThroughputActionSheetBridge(
  revenueRiskBridge,
  operatingCadenceTemplate,
  monetizationInterventionDraft
) {
  const exposure = Number(revenueRiskBridge?.exposure_points || 0);
  const actions = [];
  actions.push(
    dashboardCopy(
      exposure >= 20
        ? "Avoid aggressive pricing moves until the slowest delivery lane is shortened."
        : "Pricing can be tested cautiously while keeping delivery throughput under review.",
      exposure >= 20
        ? "在最慢交付处理线缩短前，避免激进调价。"
        : "可以谨慎测试价格，同时持续盯住交付吞吐。"
    )
  );
  actions.push(
    dashboardCopy(
      `Use the operating cadence checkpoint "${operatingCadenceTemplate?.weekly?.title || "weekly cadence"}" to review price-and-throughput impact every week.`,
      `用“${operatingCadenceTemplate?.weekly?.title || "每周节奏"}”这个经营节奏检查点，每周复核一次价格与吞吐影响。`
    )
  );
  actions.push(
    dashboardCopy(
      `Sync pricing moves with ${Array.isArray(monetizationInterventionDraft?.actions) ? monetizationInterventionDraft.actions.length : 0} monetization intervention step(s) so demand changes do not outrun capacity.`,
      `让价格动作与 ${Array.isArray(monetizationInterventionDraft?.actions) ? monetizationInterventionDraft.actions.length : 0} 条变现干预动作同步，避免需求变化跑在产能前面。`
    )
  );
  return {
    schema: "cssmv.watch_archive_pricing_throughput_action_sheet.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Pricing and throughput action sheet", "价格与吞吐联动行动单"),
    actions
  };
}

function buildWatchArchiveMonetizationExperimentBoardBridge(
  pricingThroughputActionSheet,
  monetizationInterventionDraft,
  revenueRiskBridge
) {
  const pricingActions = Array.isArray(pricingThroughputActionSheet?.actions)
    ? pricingThroughputActionSheet.actions
    : [];
  const interventions = Array.isArray(monetizationInterventionDraft?.actions)
    ? monetizationInterventionDraft.actions
    : [];
  const exposure = Number(revenueRiskBridge?.exposure_points || 0);
  return [
    {
      name: dashboardCopy("Low-risk throughput-safe test", "低风险吞吐安全实验"),
      summary:
        pricingActions[0] ||
        dashboardCopy("Use cautious price testing while monitoring throughput.", "在监控吞吐的前提下做谨慎价格测试。"),
      priority: exposure >= 20 ? "watch" : "ready"
    },
    {
      name: dashboardCopy("Bottleneck-aligned monetization push", "与瓶颈治理同步的变现实验"),
      summary:
        interventions[0] ||
        dashboardCopy("Sync new monetization pushes with current bottleneck relief work.", "让新的变现推进与当前瓶颈治理同步。"),
      priority: "ready"
    },
    {
      name: dashboardCopy("Recovery-path experiment", "恢复路径实验"),
      summary:
        pricingActions[1] ||
        dashboardCopy("Review price and throughput impact every week during recovery.", "在恢复期间每周复核价格与吞吐影响。"),
      priority: exposure >= 20 ? "watch" : "ready"
    }
  ];
}

function buildWatchArchiveExecutiveAllocationMemoBridge(roiLadder, hiringThresholds, experimentBoard) {
  const roiRows = Array.isArray(roiLadder) ? roiLadder : [];
  const hiringRows = Array.isArray(hiringThresholds) ? hiringThresholds : [];
  const experimentRows = Array.isArray(experimentBoard) ? experimentBoard : [];
  return {
    schema: "cssmv.watch_archive_executive_allocation_memo.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Executive allocation memo", "高层资源配置备忘"),
    budget_priority:
      roiRows[0]?.summary || dashboardCopy("No ROI priority has been inferred yet.", "当前还没有推导出 ROI 优先事项。"),
    hiring_posture:
      hiringRows[0]?.summary || dashboardCopy("No hiring posture has been inferred yet.", "当前还没有推导出扩编姿态。"),
    experiment_focus:
      experimentRows[0]?.summary || dashboardCopy("No experiment focus has been inferred yet.", "当前还没有推导出实验重点。")
  };
}

function buildWatchArchiveBudgetGuardrailsBridge(
  revenueRiskBridge,
  roiLadder,
  pricingThroughputActionSheet
) {
  const exposure = Number(revenueRiskBridge?.exposure_points || 0);
  const roiRows = Array.isArray(roiLadder) ? roiLadder : [];
  const pricingRows = Array.isArray(pricingThroughputActionSheet?.actions)
    ? pricingThroughputActionSheet.actions
    : [];
  return [
    {
      label: dashboardCopy("Budget release guardrail", "预算释放护栏"),
      summary: dashboardCopy(
        exposure >= 20
          ? "Keep budget releases narrow until exposure points fall and the slowest lane improves."
          : "Budget releases can widen gradually as long as exposure stays controlled.",
        exposure >= 20
          ? "在暴露分值下降、最慢处理线改善前，预算释放应保持收窄。"
          : "只要暴露分值可控，就可以逐步放宽预算释放。"
      )
    },
    {
      label: dashboardCopy("ROI-first guardrail", "ROI 优先护栏"),
      summary:
        roiRows[0]?.roi_hint ||
        dashboardCopy("Prioritize the clearest ROI intervention before funding secondary bets.", "在投入次级尝试前，优先资助最明确的 ROI 干预。")
    },
    {
      label: dashboardCopy("Pricing guardrail", "价格护栏"),
      summary:
        pricingRows[0] || dashboardCopy("Tie any pricing move to throughput review checkpoints.", "任何价格动作都应绑定吞吐复核检查点。")
    }
  ];
}

function buildWatchArchiveExperimentOutcomeLedgerBridge(
  experimentBoard,
  revenueRiskBridge,
  profitRecoveryScenarios
) {
  const experiments = Array.isArray(experimentBoard) ? experimentBoard : [];
  const scenarios = Array.isArray(profitRecoveryScenarios) ? profitRecoveryScenarios : [];
  const exposure = Number(revenueRiskBridge?.exposure_points || 0);
  return experiments.map((item, index) => ({
    experiment: item.name,
    state: item.priority === "ready" ? "proposed" : "watch",
    summary: item.summary,
    linked_recovery: scenarios[index % Math.max(1, scenarios.length)]?.label || dashboardCopy("Recovery path", "恢复路径"),
    accounting_note: dashboardCopy(
      exposure >= 20
        ? "Track this experiment conservatively because current exposure is still elevated."
        : "Track this experiment weekly and compare it against throughput-safe recovery paths.",
      exposure >= 20
        ? "由于当前暴露值仍偏高，请保守记账并跟踪这项实验。"
        : "请按周跟踪，并与吞吐安全的恢复路径做对比记账。"
    )
  }));
}

function buildWatchArchiveBoardDecisionPacketBridge(
  executiveAllocationMemo,
  budgetGuardrails,
  experimentOutcomeLedger
) {
  const guardrails = Array.isArray(budgetGuardrails) ? budgetGuardrails : [];
  const experiments = Array.isArray(experimentOutcomeLedger) ? experimentOutcomeLedger : [];
  return {
    schema: "cssmv.watch_archive_board_decision_packet.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Board decision packet", "董事会决策包"),
    allocation_summary: executiveAllocationMemo?.budget_priority || "",
    guardrail_summary: guardrails[0]?.summary || "",
    experiment_summary:
      experiments[0]?.summary ||
      dashboardCopy("No experiment accounting summary yet.", "当前还没有实验记账摘要。")
  };
}

function buildWatchArchiveSpendApprovalLanesBridge(
  budgetGuardrails,
  executiveAllocationMemo,
  hiringThresholds
) {
  const guardrails = Array.isArray(budgetGuardrails) ? budgetGuardrails : [];
  const hiring = Array.isArray(hiringThresholds) ? hiringThresholds : [];
  return [
    {
      lane: dashboardCopy("Operating spend lane", "运营花费审批线"),
      summary:
        guardrails[0]?.summary ||
        dashboardCopy("No operating spend guardrail yet.", "当前还没有运营花费护栏。")
    },
    {
      lane: dashboardCopy("Hiring spend lane", "扩编花费审批线"),
      summary:
        hiring[0]?.summary ||
        dashboardCopy("No hiring spend trigger yet.", "当前还没有扩编花费触发条件。")
    },
    {
      lane: dashboardCopy("Experiment spend lane", "实验花费审批线"),
      summary:
        executiveAllocationMemo?.experiment_focus ||
        dashboardCopy("No experiment spend focus yet.", "当前还没有实验花费重点。")
    }
  ];
}

function buildWatchArchiveExperimentKillScaleRulesBridge(
  experimentBoard,
  revenueRiskBridge,
  budgetGuardrails
) {
  const experiments = Array.isArray(experimentBoard) ? experimentBoard : [];
  const exposure = Number(revenueRiskBridge?.exposure_points || 0);
  const guardrails = Array.isArray(budgetGuardrails) ? budgetGuardrails : [];
  return experiments.map((item, index) => ({
    experiment: item.name,
    rule: dashboardCopy(
      exposure >= 20
        ? "Kill if throughput worsens or exposure stays elevated; scale only after bottleneck relief is visible."
        : "Scale if throughput stays stable and the budget guardrail remains satisfied.",
      exposure >= 20
        ? "如果吞吐恶化或暴露分值持续偏高就砍掉；只有看到瓶颈缓解后才放大。"
        : "如果吞吐保持稳定且预算护栏仍满足，就可以放大。"
    ),
    guardrail_reference:
      guardrails[index % Math.max(1, guardrails.length)]?.label ||
      dashboardCopy("Budget guardrail", "预算护栏")
  }));
}

function buildWatchArchiveCapitalAllocationScoreboardBridge(
  boardDecisionPacket,
  spendApprovalLanes,
  experimentOutcomeLedger
) {
  const spendRows = Array.isArray(spendApprovalLanes) ? spendApprovalLanes : [];
  const experimentRows = Array.isArray(experimentOutcomeLedger) ? experimentOutcomeLedger : [];
  return [
    {
      label: dashboardCopy("Capital focus", "资本配置焦点"),
      summary:
        boardDecisionPacket?.allocation_summary ||
        dashboardCopy("No capital focus has been inferred yet.", "当前还没有推导出资本配置焦点。")
    },
    {
      label: dashboardCopy("Approval load", "审批负载"),
      summary: dashboardCopy(
        `${spendRows.length} spend approval lane(s) are active in the current allocation cycle.`,
        `当前配置周期中有 ${spendRows.length} 条花费审批线处于活跃状态。`
      )
    },
    {
      label: dashboardCopy("Tracked experiments", "已跟踪实验"),
      summary: dashboardCopy(
        `${experimentRows.length} experiment outcome ledger row(s) are part of the current capital picture.`,
        `当前资本配置图景中包含 ${experimentRows.length} 条实验结果台账记录。`
      )
    }
  ];
}

window.buildWatchArchivePricingThroughputActionSheetBridge = buildWatchArchivePricingThroughputActionSheetBridge;
window.buildWatchArchiveMonetizationExperimentBoardBridge = buildWatchArchiveMonetizationExperimentBoardBridge;
window.buildWatchArchiveExecutiveAllocationMemoBridge = buildWatchArchiveExecutiveAllocationMemoBridge;
window.buildWatchArchiveBudgetGuardrailsBridge = buildWatchArchiveBudgetGuardrailsBridge;
window.buildWatchArchiveExperimentOutcomeLedgerBridge = buildWatchArchiveExperimentOutcomeLedgerBridge;
window.buildWatchArchiveBoardDecisionPacketBridge = buildWatchArchiveBoardDecisionPacketBridge;
window.buildWatchArchiveSpendApprovalLanesBridge = buildWatchArchiveSpendApprovalLanesBridge;
window.buildWatchArchiveExperimentKillScaleRulesBridge = buildWatchArchiveExperimentKillScaleRulesBridge;
window.buildWatchArchiveCapitalAllocationScoreboardBridge = buildWatchArchiveCapitalAllocationScoreboardBridge;
