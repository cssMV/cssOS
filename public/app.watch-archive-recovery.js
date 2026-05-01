function buildWatchArchiveCapacityBottleneckDigestBridge(
  statusBoard,
  ownerWorkload,
  overdueFollowups,
  ownerRebalanceSuggestions
) {
  const board = statusBoard || {};
  const workloadRows = Array.isArray(ownerWorkload) ? ownerWorkload : [];
  const busiestOwner = workloadRows[0] || null;
  const overdueCount = Array.isArray(overdueFollowups) ? overdueFollowups.length : 0;
  const rebalanceCount = Array.isArray(ownerRebalanceSuggestions) ? ownerRebalanceSuggestions.length : 0;
  return {
    schema: "cssmv.watch_archive_capacity_bottleneck_digest.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy(
      "Capacity bottleneck digest for active delivery lanes.",
      "活跃交付处理线的产能瓶颈摘要。"
    ),
    bottleneck_summary: dashboardCopy(
      `open+reopened=${(board.open || 0) + (board.reopened || 0)}, overdue=${overdueCount}, rebalance options=${rebalanceCount}.`,
      `open+reopened=${(board.open || 0) + (board.reopened || 0)}，overdue=${overdueCount}，可重分配建议=${rebalanceCount}。`
    ),
    busiest_owner: busiestOwner
      ? dashboardCopy(
          `${busiestOwner.owner} holds ${busiestOwner.total} active case(s).`,
          `${busiestOwner.owner} 当前持有 ${busiestOwner.total} 条活跃案件。`
        )
      : dashboardCopy("No owner workload bottleneck is visible yet.", "当前还没有明显的负责人负载瓶颈。"),
    operator_focus: dashboardCopy(
      "Reduce the busiest lane first, then clear overdue follow-ups, then rebalance ownership.",
      "先压低最繁忙处理线，再清理超期跟进，最后做负责人重分配。"
    )
  };
}

function buildWatchArchiveMonetizationInterventionDraftBridge(
  revenueRiskBridge,
  commitmentSlipAlerts,
  capacityBottleneckDigest
) {
  const slipCount = Array.isArray(commitmentSlipAlerts) ? commitmentSlipAlerts.length : 0;
  const exposure = Number(revenueRiskBridge?.exposure_points || 0);
  const actions = [];
  if (exposure >= 20) {
    actions.push(
      dashboardCopy(
        "Shorten the slowest delivery lane before pushing new monetization campaigns.",
        "在推动新的变现活动前，先缩短最慢的交付处理线。"
      )
    );
  }
  if (slipCount > 0) {
    actions.push(
      dashboardCopy(
        "Escalate slipped owner commitments because unresolved commitments weaken monetization follow-through.",
        "升级处理已滑坡的负责人承诺，因为未兑现承诺会削弱变现落地。"
      )
    );
  }
  actions.push(
    dashboardCopy(
      "Pair monetization pushes with the current bottleneck focus so revenue plans do not outrun delivery capacity.",
      "让变现推进与当前瓶颈治理同步，避免收入计划跑在交付产能前面。"
    )
  );
  return {
    schema: "cssmv.watch_archive_monetization_intervention_draft.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Monetization intervention draft", "变现干预草稿"),
    bottleneck_reference: capacityBottleneckDigest?.headline || "",
    actions
  };
}

function buildWatchArchiveProfitRecoveryScenariosBridge(
  marginPressureCards,
  monetizationInterventionDraft,
  capacityBottleneckDigest
) {
  const marginRows = Array.isArray(marginPressureCards) ? marginPressureCards : [];
  const interventionCount = Array.isArray(monetizationInterventionDraft?.actions)
    ? monetizationInterventionDraft.actions.length
    : 0;
  const bottleneckHeadline = String(capacityBottleneckDigest?.headline || "").trim();
  return [
    {
      label: dashboardCopy("Stabilize-first scenario", "先稳住场景"),
      summary: dashboardCopy(
        `Focus on relieving bottlenecks first, then recover margin after ${interventionCount} monetization intervention step(s).`,
        `先缓解瓶颈，再在 ${interventionCount} 条变现干预动作之后恢复利润。`
      )
    },
    {
      label: dashboardCopy("Balanced recovery scenario", "平衡恢复场景"),
      summary: marginRows.length
        ? dashboardCopy(
            "Use the current margin pressure cards as the pacing layer while monetization resumes in parallel.",
            "把当前利润压力卡作为节奏层，同时并行恢复变现。"
          )
        : dashboardCopy(
            "Balanced recovery guidance will strengthen after more margin signals appear.",
            "当利润信号更完整后，平衡恢复建议会更有力。"
          )
    },
    {
      label: dashboardCopy("Throughput-first recovery", "先恢复吞吐场景"),
      summary: bottleneckHeadline
        ? dashboardCopy(
            `Treat "${bottleneckHeadline}" as the first unblock before expecting profit recovery.`,
            `先解决“${bottleneckHeadline}”，再期待利润恢复。`
          )
        : dashboardCopy(
            "Throughput-first recovery will clarify after a bottleneck headline appears.",
            "当瓶颈主结论出现后，先恢复吞吐的路径会更清晰。"
          )
    }
  ];
}

function buildWatchArchiveStaffingTradeoffCardsBridge(
  capacityBottleneckDigest,
  ownerWorkload,
  ownerRebalanceSuggestions
) {
  const workloadRows = Array.isArray(ownerWorkload) ? ownerWorkload : [];
  const busiest = workloadRows[0] || null;
  const lightest = workloadRows[workloadRows.length - 1] || null;
  const rebalanceCount = Array.isArray(ownerRebalanceSuggestions) ? ownerRebalanceSuggestions.length : 0;
  return [
    {
      label: dashboardCopy("Rebalance before hiring", "先重分配再加人"),
      summary: dashboardCopy(
        `There are ${rebalanceCount} rebalance suggestion(s), so internal redistribution should be tested before staffing up.`,
        `当前有 ${rebalanceCount} 条重分配建议，因此应先测试内部重分配，再考虑加人。`
      )
    },
    {
      label: dashboardCopy("Busiest-owner pressure", "最繁忙负责人压力"),
      summary: busiest
        ? dashboardCopy(
            `${busiest.owner} is carrying ${busiest.total} active case(s), which is the clearest staffing pressure signal.`,
            `${busiest.owner} 当前承担 ${busiest.total} 条活跃案件，这是最明确的人力压力信号。`
          )
        : dashboardCopy("No busiest-owner pressure is visible yet.", "当前还没有看到明显的最繁忙负责人压力。")
    },
    {
      label: dashboardCopy("Spare-capacity contrast", "空余产能对比"),
      summary:
        busiest && lightest
          ? dashboardCopy(
              `Compare ${busiest.owner} against ${lightest.owner} before adding headcount; uneven load may still be the main problem.`,
              `在加人前先比较 ${busiest.owner} 与 ${lightest.owner} 的负载差，问题可能仍主要是不均衡。`
            )
          : dashboardCopy(
              "Spare-capacity contrast will appear after more owner workload data accumulates.",
              "当负责人负载数据更完整后，这里会出现空余产能对比。"
            )
    }
  ];
}

window.buildWatchArchiveCapacityBottleneckDigestBridge = buildWatchArchiveCapacityBottleneckDigestBridge;
window.buildWatchArchiveMonetizationInterventionDraftBridge = buildWatchArchiveMonetizationInterventionDraftBridge;
window.buildWatchArchiveProfitRecoveryScenariosBridge = buildWatchArchiveProfitRecoveryScenariosBridge;
window.buildWatchArchiveStaffingTradeoffCardsBridge = buildWatchArchiveStaffingTradeoffCardsBridge;
