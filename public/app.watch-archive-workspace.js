function buildWatchArchiveAuditWorkspaceLauncherBridge(
  auditQuickOpenSet,
  governanceSearchIndex,
  auditQueryPresets
) {
  const quickOpenRows = Array.isArray(auditQuickOpenSet) ? auditQuickOpenSet : [];
  const presetRows = Array.isArray(auditQueryPresets) ? auditQueryPresets : [];
  const indexedTerms = String(governanceSearchIndex?.indexed_terms || "");
  return [
    {
      workspace: dashboardCopy("Audit evidence desk", "审计证据工作台"),
      launch_target:
        quickOpenRows[0]?.target ||
        presetRows[0]?.query ||
        dashboardCopy("Audit archive latest", "审计档案最新项"),
      context: dashboardCopy(
        `Indexed scope ready: ${indexedTerms.slice(0, 120) || "governance evidence"}`,
        `索引范围已就绪：${indexedTerms.slice(0, 120) || "治理证据"}`
      )
    },
    {
      workspace: dashboardCopy("Approval dependency desk", "审批依赖工作台"),
      launch_target:
        quickOpenRows[2]?.target ||
        presetRows[1]?.query ||
        dashboardCopy("Evidence trace", "证据追踪"),
      context: dashboardCopy(
        "Use this when the operator needs the approval chain and trace focus together.",
        "当操作人需要同时查看审批链与证据追踪时，优先打开这个工作台。"
      )
    }
  ];
}

function buildWatchArchiveMacroRunHistoryBridge(
  savedOperatorMacros,
  riskTriageQueue,
  auditWorkspaceLauncher
) {
  const macroRows = Array.isArray(savedOperatorMacros) ? savedOperatorMacros : [];
  const triageRows = Array.isArray(riskTriageQueue) ? riskTriageQueue : [];
  const workspaceRows = Array.isArray(auditWorkspaceLauncher) ? auditWorkspaceLauncher : [];
  return macroRows.map((item, index) => ({
    macro: item.macro,
    last_run: dashboardCopy(
      index === 0 ? "just now" : `${index + 1} cycles ago`,
      index === 0 ? "刚刚" : `${index + 1} 个周期前`
    ),
    result: dashboardCopy(
      triageRows[index]?.priority === "P1"
        ? "Helped surface a fast-track dependency blocker."
        : "Kept the operator in a lighter watch-and-open workflow.",
      triageRows[index]?.priority === "P1"
        ? "帮助快速暴露了需要快速通道处理的依赖阻塞。"
        : "帮助操作人维持在更轻量的观察与打开流程里。"
    ),
    workspace:
      workspaceRows[index]?.workspace ||
      dashboardCopy("Audit evidence desk", "审计证据工作台")
  }));
}

function buildWatchArchiveEscalationOutcomeBoardBridge(
  triageEscalationShortcuts,
  riskTriageQueue,
  dependencyRiskScanner
) {
  const shortcutRows = Array.isArray(triageEscalationShortcuts) ? triageEscalationShortcuts : [];
  const triageRows = Array.isArray(riskTriageQueue) ? riskTriageQueue : [];
  const riskRows = Array.isArray(dependencyRiskScanner) ? dependencyRiskScanner : [];
  return shortcutRows.map((item, index) => ({
    lane: item.label,
    status:
      triageRows[index]?.priority === "P1"
        ? dashboardCopy("escalated", "已升级")
        : dashboardCopy("watching", "观察中"),
    outcome: dashboardCopy(
      riskRows[index]?.risk === dashboardCopy("watch", "观察")
        ? "Still needs evidence confirmation after escalation."
        : "Escalation pressure is currently low and stable.",
      riskRows[index]?.risk === dashboardCopy("watch", "观察")
        ? "升级后仍需要继续确认关键证据。"
        : "当前升级压力较低，整体保持稳定。"
    )
  }));
}

function buildWatchArchiveWorkspaceContextSnapshotsBridge(
  auditWorkspaceLauncher,
  governanceSearchIndex,
  auditQuickOpenSet
) {
  const workspaceRows = Array.isArray(auditWorkspaceLauncher) ? auditWorkspaceLauncher : [];
  const quickOpenRows = Array.isArray(auditQuickOpenSet) ? auditQuickOpenSet : [];
  const indexedTerms = String(governanceSearchIndex?.indexed_terms || "");
  return workspaceRows.map((item, index) => ({
    workspace: item.workspace,
    focus: quickOpenRows[index]?.target || item.launch_target,
    snapshot: dashboardCopy(
      `Context snapshot: ${indexedTerms.slice(index * 60, index * 60 + 120) || "governance context ready"}`,
      `上下文快照：${indexedTerms.slice(index * 60, index * 60 + 120) || "治理上下文已就绪"}`
    )
  }));
}

function buildWatchArchiveOperatorEffectivenessScoreBridge(
  macroRunHistory,
  escalationOutcomeBoard,
  riskTriageQueue
) {
  const macroRows = Array.isArray(macroRunHistory) ? macroRunHistory : [];
  const escalationRows = Array.isArray(escalationOutcomeBoard) ? escalationOutcomeBoard : [];
  const triageRows = Array.isArray(riskTriageQueue) ? riskTriageQueue : [];
  const fastTrackCount = triageRows.filter((item) => item.priority === "P1").length;
  const stableCount = escalationRows.filter(
    (item) => item.status === dashboardCopy("watching", "观察中")
  ).length;
  const score = Math.max(
    55,
    Math.min(96, 68 + macroRows.length * 6 + stableCount * 4 - fastTrackCount * 3)
  );
  return {
    score,
    status: dashboardCopy(
      score >= 82 ? "effective" : score >= 70 ? "mixed" : "fragile",
      score >= 82 ? "有效" : score >= 70 ? "混合" : "脆弱"
    ),
    summary: dashboardCopy(
      `Macro coverage=${macroRows.length}, stable escalation lanes=${stableCount}, fast-track blockers=${fastTrackCount}.`,
      `宏覆盖=${macroRows.length}，稳定升级通道=${stableCount}，快速通道阻塞=${fastTrackCount}。`
    )
  };
}

function buildWatchArchiveEscalationLatencyCardsBridge(
  escalationOutcomeBoard,
  triageEscalationShortcuts,
  riskTriageQueue
) {
  const outcomeRows = Array.isArray(escalationOutcomeBoard) ? escalationOutcomeBoard : [];
  const shortcutRows = Array.isArray(triageEscalationShortcuts) ? triageEscalationShortcuts : [];
  const triageRows = Array.isArray(riskTriageQueue) ? riskTriageQueue : [];
  return shortcutRows.map((item, index) => {
    const priority = triageRows[index]?.priority || "P3";
    const latency =
      priority === "P1"
        ? dashboardCopy("under 15m", "15 分钟内")
        : dashboardCopy("within next watch cycle", "下一个观察周期内");
    return {
      lane: item.label,
      latency,
      pressure:
        outcomeRows[index]?.status ||
        dashboardCopy("watching", "观察中"),
      summary: dashboardCopy(
        priority === "P1"
          ? "This lane should move quickly because it sits on the shortest escalation path."
          : "This lane can stay in a slower watch cadence unless pressure rises.",
        priority === "P1"
          ? "这条通道位于最短升级路径上，因此应该快速推进。"
          : "除非压力升高，否则这条通道可以保持较慢的观察节奏。"
      )
    };
  });
}

function buildWatchArchiveWorkspaceReplayLaneBridge(
  workspaceContextSnapshots,
  macroRunHistory,
  governanceCommandPalette
) {
  const snapshotRows = Array.isArray(workspaceContextSnapshots) ? workspaceContextSnapshots : [];
  const macroRows = Array.isArray(macroRunHistory) ? macroRunHistory : [];
  const paletteRows = Array.isArray(governanceCommandPalette) ? governanceCommandPalette : [];
  return snapshotRows.map((item, index) => ({
    workspace: item.workspace,
    replay_focus: item.focus,
    replay_steps: [
      paletteRows[index]?.action,
      macroRows[index]?.macro
    ].filter(Boolean),
    replay_note: dashboardCopy(
      "Replay this lane when the operator wants to reconstruct the last high-signal workspace path.",
      "当操作人想重建上一次高信号工作区路径时，可以回放这一条。"
    )
  }));
}

function buildWatchArchiveOperatorCoachingPromptsBridge(
  operatorEffectivenessScore,
  escalationLatencyCards,
  workspaceReplayLane
) {
  const latencyRows = Array.isArray(escalationLatencyCards) ? escalationLatencyCards : [];
  const replayRows = Array.isArray(workspaceReplayLane) ? workspaceReplayLane : [];
  return [
    {
      prompt: dashboardCopy("Coach the next watch cycle", "指导下一轮值班"),
      recommendation: dashboardCopy(
        operatorEffectivenessScore?.score >= 82
          ? "Keep the current macro flow, but rehearse one replay lane so the team can copy the strongest path."
          : "Tighten the first-response macro and rehearse the shortest escalation lane before the next watch cycle.",
        operatorEffectivenessScore?.score >= 82
          ? "保持当前宏流程，同时演练一条回放路径，让团队复制最强路径。"
          : "在下一轮值班前，先收紧首轮响应宏，再演练最短升级通道。"
      ),
      focus:
        latencyRows[0]?.lane ||
        replayRows[0]?.workspace ||
        dashboardCopy("Audit evidence desk", "审计证据工作台")
    },
    {
      prompt: dashboardCopy("Coach for replay clarity", "指导回放清晰度"),
      recommendation: dashboardCopy(
        "Use the replay lane to show which workspace path and macro combination produced the clearest audit context.",
        "利用回放通道展示哪条工作区路径与宏组合产出了最清晰的审计上下文。"
      ),
      focus:
        replayRows[0]?.workspace ||
        dashboardCopy("Approval dependency desk", "审批依赖工作台")
    }
  ];
}

function buildWatchArchiveLatencyBreachAlarmsBridge(
  escalationLatencyCards,
  escalationOutcomeBoard,
  riskTriageQueue
) {
  const latencyRows = Array.isArray(escalationLatencyCards) ? escalationLatencyCards : [];
  const outcomeRows = Array.isArray(escalationOutcomeBoard) ? escalationOutcomeBoard : [];
  const triageRows = Array.isArray(riskTriageQueue) ? riskTriageQueue : [];
  return latencyRows.map((item, index) => {
    const isBreach =
      triageRows[index]?.priority === "P1" &&
      outcomeRows[index]?.status !== dashboardCopy("watching", "观察中");
    return {
      lane: item.lane,
      alarm: isBreach
        ? dashboardCopy("breach risk", "超线风险")
        : dashboardCopy("within guardrail", "仍在护栏内"),
      action: dashboardCopy(
        isBreach
          ? "Escalate the fast-track lane immediately and re-open the shortest approval path."
          : "Keep monitoring this lane in the current watch cadence.",
        isBreach
          ? "立即升级快速通道，并重新打开最短审批路径。"
          : "继续按当前观察节奏监控这条通道。"
      )
    };
  });
}

function buildWatchArchiveReplayToTrainingPackBridge(
  workspaceReplayLane,
  savedOperatorMacros,
  operatorEffectivenessScore
) {
  const replayRows = Array.isArray(workspaceReplayLane) ? workspaceReplayLane : [];
  const macroRows = Array.isArray(savedOperatorMacros) ? savedOperatorMacros : [];
  return replayRows.map((item, index) => ({
    module: dashboardCopy(
      `Training replay ${index + 1}`,
      `训练回放 ${index + 1}`
    ),
    workspace: item.workspace,
    drills: [
      item.replay_focus,
      ...(Array.isArray(item.replay_steps) ? item.replay_steps : []),
      macroRows[index]?.macro
    ].filter(Boolean),
    takeaway: dashboardCopy(
      operatorEffectivenessScore?.score >= 82
        ? "Use this pack to preserve the current best-known operator path."
        : "Use this pack to tighten the weak points before the next live watch cycle.",
      operatorEffectivenessScore?.score >= 82
        ? "用这份训练包保留当前已知最优的操作路径。"
        : "用这份训练包在下一轮真实值班前收紧薄弱点。"
    )
  }));
}

function buildWatchArchiveOperatorReadinessScoreBridge(
  operatorCoachingPrompts,
  latencyBreachAlarms,
  replayToTrainingPack
) {
  const coachingRows = Array.isArray(operatorCoachingPrompts) ? operatorCoachingPrompts : [];
  const alarmRows = Array.isArray(latencyBreachAlarms) ? latencyBreachAlarms : [];
  const trainingRows = Array.isArray(replayToTrainingPack) ? replayToTrainingPack : [];
  const breachCount = alarmRows.filter(
    (item) => item.alarm === dashboardCopy("breach risk", "超线风险")
  ).length;
  const score = Math.max(
    52,
    Math.min(95, 72 + coachingRows.length * 4 + trainingRows.length * 3 - breachCount * 8)
  );
  return {
    score,
    status: dashboardCopy(
      score >= 84 ? "ready" : score >= 70 ? "warming up" : "needs drills",
      score >= 84 ? "已准备" : score >= 70 ? "热身中" : "需要演练"
    ),
    summary: dashboardCopy(
      `Coaching prompts=${coachingRows.length}, breach alarms=${breachCount}, training packs=${trainingRows.length}.`,
      `教练提示=${coachingRows.length}，超线告警=${breachCount}，训练包=${trainingRows.length}。`
    )
  };
}

window.buildWatchArchiveAuditWorkspaceLauncherBridge = buildWatchArchiveAuditWorkspaceLauncherBridge;
window.buildWatchArchiveMacroRunHistoryBridge = buildWatchArchiveMacroRunHistoryBridge;
window.buildWatchArchiveEscalationOutcomeBoardBridge = buildWatchArchiveEscalationOutcomeBoardBridge;
window.buildWatchArchiveWorkspaceContextSnapshotsBridge = buildWatchArchiveWorkspaceContextSnapshotsBridge;
window.buildWatchArchiveOperatorEffectivenessScoreBridge = buildWatchArchiveOperatorEffectivenessScoreBridge;
window.buildWatchArchiveEscalationLatencyCardsBridge = buildWatchArchiveEscalationLatencyCardsBridge;
window.buildWatchArchiveWorkspaceReplayLaneBridge = buildWatchArchiveWorkspaceReplayLaneBridge;
window.buildWatchArchiveOperatorCoachingPromptsBridge = buildWatchArchiveOperatorCoachingPromptsBridge;
window.buildWatchArchiveLatencyBreachAlarmsBridge = buildWatchArchiveLatencyBreachAlarmsBridge;
window.buildWatchArchiveReplayToTrainingPackBridge = buildWatchArchiveReplayToTrainingPackBridge;
window.buildWatchArchiveOperatorReadinessScoreBridge = buildWatchArchiveOperatorReadinessScoreBridge;
