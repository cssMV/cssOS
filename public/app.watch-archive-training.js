function buildWatchArchiveOnCallDrillQueueBridge(
  replayToTrainingPack,
  latencyBreachAlarms,
  operatorCoachingPrompts
) {
  const trainingRows = Array.isArray(replayToTrainingPack) ? replayToTrainingPack : [];
  const alarmRows = Array.isArray(latencyBreachAlarms) ? latencyBreachAlarms : [];
  const coachingRows = Array.isArray(operatorCoachingPrompts) ? operatorCoachingPrompts : [];
  return trainingRows.map((item, index) => ({
    drill: item.module,
    priority:
      alarmRows[index]?.alarm === dashboardCopy("breach risk", "超线风险")
        ? "P1"
        : "P2",
    focus:
      coachingRows[index]?.focus ||
      item.workspace,
    completion_hint: dashboardCopy(
      alarmRows[index]?.alarm === dashboardCopy("breach risk", "超线风险")
        ? "Run this drill before the next live escalation window."
        : "Queue this drill into the next training cycle.",
      alarmRows[index]?.alarm === dashboardCopy("breach risk", "超线风险")
        ? "在下一次真实升级窗口前先完成这条演练。"
        : "把这条演练排进下一轮训练周期。"
    )
  }));
}

function buildWatchArchiveTrainingCompletionLaneBridge(
  onCallDrillQueue,
  replayToTrainingPack,
  operatorReadinessScore
) {
  const drillRows = Array.isArray(onCallDrillQueue) ? onCallDrillQueue : [];
  const trainingRows = Array.isArray(replayToTrainingPack) ? replayToTrainingPack : [];
  return trainingRows.map((item, index) => ({
    module: item.module,
    completion:
      drillRows[index]?.priority === "P1"
        ? dashboardCopy("pending completion", "待完成")
        : dashboardCopy("ready to complete", "可完成"),
    readiness: dashboardCopy(
      `${operatorReadinessScore?.score || 0} · ${operatorReadinessScore?.status || dashboardCopy("unknown", "未知")}`,
      `${operatorReadinessScore?.score || 0} · ${operatorReadinessScore?.status || dashboardCopy("未知", "未知")}`
    ),
    note: dashboardCopy(
      drillRows[index]?.priority === "P1"
        ? "Keep this lane open until the high-priority drill is rehearsed."
        : "This lane is close to completion once the scheduled drill is acknowledged.",
      drillRows[index]?.priority === "P1"
        ? "在高优先级演练完成前，这条通道应保持打开。"
        : "一旦计划中的演练被确认，这条通道就接近完成。"
    )
  }));
}

function buildWatchArchiveCertificationLadderBridge(
  operatorReadinessScore,
  onCallDrillQueue,
  trainingCompletionLane
) {
  const drillRows = Array.isArray(onCallDrillQueue) ? onCallDrillQueue : [];
  const completionRows = Array.isArray(trainingCompletionLane) ? trainingCompletionLane : [];
  const score = Number(operatorReadinessScore?.score || 0);
  return [
    {
      stage: dashboardCopy("Observer", "观察员"),
      status: dashboardCopy(score >= 60 ? "cleared" : "pending", score >= 60 ? "已通过" : "待通过")
    },
    {
      stage: dashboardCopy("Responder", "响应者"),
      status: dashboardCopy(score >= 75 ? "cleared" : "pending", score >= 75 ? "已通过" : "待通过")
    },
    {
      stage: dashboardCopy("Lead On-Call", "值班主责"),
      status: dashboardCopy(
        score >= 86 &&
          drillRows.every((item) => item.priority !== "P1") &&
          completionRows.every((item) => item.completion !== dashboardCopy("pending completion", "待完成"))
          ? "certified"
          : "not yet",
        score >= 86 &&
          drillRows.every((item) => item.priority !== "P1") &&
          completionRows.every((item) => item.completion !== dashboardCopy("pending completion", "待完成"))
          ? "已认证"
          : "尚未达成"
      )
    }
  ];
}

function buildWatchArchiveDrillFailureReviewBridge(
  onCallDrillQueue,
  latencyBreachAlarms,
  operatorCoachingPrompts
) {
  const drillRows = Array.isArray(onCallDrillQueue) ? onCallDrillQueue : [];
  const alarmRows = Array.isArray(latencyBreachAlarms) ? latencyBreachAlarms : [];
  const coachingRows = Array.isArray(operatorCoachingPrompts) ? operatorCoachingPrompts : [];
  return drillRows.map((item, index) => ({
    drill: item.drill,
    failure_mode:
      item.priority === "P1"
        ? dashboardCopy("priority lane not rehearsed enough", "高优先级通道演练不足")
        : dashboardCopy("replay clarity still uneven", "回放清晰度仍不均衡"),
    review: dashboardCopy(
      alarmRows[index]?.alarm === dashboardCopy("breach risk", "超线风险")
        ? "Review the breach path first, then tighten the coaching focus before the next live shift."
        : "Review the replay path and make the coaching focus easier to repeat.",
      alarmRows[index]?.alarm === dashboardCopy("breach risk", "超线风险")
        ? "先复盘超线路径，再在下一轮真实值班前收紧教练重点。"
        : "先复盘回放路径，再把教练重点做得更容易重复。"
    ),
    coaching_anchor:
      coachingRows[index]?.focus ||
      item.focus
  }));
}

function buildWatchArchiveReadinessTrendlineBridge(
  operatorReadinessScore,
  operatorEffectivenessScore,
  macroRunHistory
) {
  const macroCount = Array.isArray(macroRunHistory) ? macroRunHistory.length : 0;
  const readiness = Number(operatorReadinessScore?.score || 0);
  const effectiveness = Number(operatorEffectivenessScore?.score || 0);
  return {
    current: readiness,
    previous: Math.max(40, readiness - 4 - macroCount),
    direction: dashboardCopy(
      readiness >= effectiveness - 2 ? "improving" : "flat-to-soft",
      readiness >= effectiveness - 2 ? "上升中" : "持平偏弱"
    ),
    summary: dashboardCopy(
      `Readiness is tracking against effectiveness at ${readiness}/${effectiveness} with ${macroCount} macro runs in view.`,
      `准备度与操作有效性当前为 ${readiness}/${effectiveness}，观察窗口内共有 ${macroCount} 次宏运行。`
    )
  };
}

function buildWatchArchiveOperatorPromotionCriteriaBridge(
  certificationLadder,
  readinessTrendline,
  operatorReadinessScore
) {
  const ladderRows = Array.isArray(certificationLadder) ? certificationLadder : [];
  const leadStage = ladderRows.find(
    (item) => item.stage === dashboardCopy("Lead On-Call", "值班主责")
  );
  return [
    {
      role: dashboardCopy("Responder promotion", "响应者升级"),
      criteria: dashboardCopy(
        `Readiness >= 75 and trend is ${readinessTrendline?.direction || dashboardCopy("stable", "稳定")}.`,
        `准备度 >= 75，且趋势为${readinessTrendline?.direction || dashboardCopy("稳定", "稳定")}。`
      ),
      status:
        Number(operatorReadinessScore?.score || 0) >= 75
          ? dashboardCopy("eligible", "可升级")
          : dashboardCopy("not yet", "尚未达成")
    },
    {
      role: dashboardCopy("Lead On-Call promotion", "值班主责升级"),
      criteria: dashboardCopy(
        "Lead certification must be cleared and the readiness line should keep improving.",
        "必须先通过值班主责认证，而且准备度趋势应继续上升。"
      ),
      status:
        leadStage?.status === dashboardCopy("certified", "已认证")
          ? dashboardCopy("eligible", "可升级")
          : dashboardCopy("hold", "暂缓")
    }
  ];
}

function buildWatchArchiveRemediationPlanCardsBridge(
  drillFailureReview,
  onCallDrillQueue,
  latencyBreachAlarms
) {
  const reviewRows = Array.isArray(drillFailureReview) ? drillFailureReview : [];
  const drillRows = Array.isArray(onCallDrillQueue) ? onCallDrillQueue : [];
  const alarmRows = Array.isArray(latencyBreachAlarms) ? latencyBreachAlarms : [];
  return reviewRows.map((item, index) => ({
    title: dashboardCopy(
      `Remediate ${item.drill}`,
      `补救 ${item.drill}`
    ),
    priority:
      drillRows[index]?.priority ||
      "P2",
    action: item.review,
    guardrail:
      alarmRows[index]?.action ||
      dashboardCopy("Keep the lane under watch until the drill is repeated.", "在演练重做前保持通道处于观察下。")
  }));
}

function buildWatchArchiveReadinessForecastWindowBridge(
  operatorReadinessScore,
  readinessTrendline,
  onCallDrillQueue
) {
  const drillRows = Array.isArray(onCallDrillQueue) ? onCallDrillQueue : [];
  const p1Count = drillRows.filter((item) => item.priority === "P1").length;
  const current = Number(operatorReadinessScore?.score || 0);
  const forecast = Math.max(45, Math.min(97, current + (p1Count === 0 ? 5 : -3)));
  return {
    current,
    next_window: forecast,
    direction: readinessTrendline?.direction || dashboardCopy("flat-to-soft", "持平偏弱"),
    summary: dashboardCopy(
      `Forecast for the next watch window is ${forecast}, with ${p1Count} high-priority drills still in queue.`,
      `下一个值班窗口的预测准备度为 ${forecast}，当前仍有 ${p1Count} 条高优先级演练待处理。`
    )
  };
}

function buildWatchArchiveStaffingBenchMapBridge(
  operatorPromotionCriteria,
  certificationLadder,
  readinessForecastWindow
) {
  const promotionRows = Array.isArray(operatorPromotionCriteria) ? operatorPromotionCriteria : [];
  const ladderRows = Array.isArray(certificationLadder) ? certificationLadder : [];
  return [
    {
      lane: dashboardCopy("Bench depth", "梯队深度"),
      summary: dashboardCopy(
        `${promotionRows.filter((item) => item.status === dashboardCopy("eligible", "可升级")).length} operators look promotable against ${ladderRows.length} certification stages.`,
        `${promotionRows.filter((item) => item.status === dashboardCopy("eligible", "可升级")).length} 位人员看起来可升级，对应 ${ladderRows.length} 个认证层级。`
      )
    },
    {
      lane: dashboardCopy("Next-window cover", "下一窗口覆盖"),
      summary: dashboardCopy(
        `Forecast cover sits around ${readinessForecastWindow?.next_window || 0}, which indicates how much bench confidence is likely in the next watch window.`,
        `下一窗口覆盖预测约为 ${readinessForecastWindow?.next_window || 0}，可用来判断下一轮值班的梯队把握度。`
      )
    }
  ];
}

function buildWatchArchiveReadinessRiskHedgeBridge(
  remediationPlanCards,
  readinessForecastWindow,
  drillFailureReview
) {
  const remediationRows = Array.isArray(remediationPlanCards) ? remediationPlanCards : [];
  const reviewRows = Array.isArray(drillFailureReview) ? drillFailureReview : [];
  const nextWindow = Number(readinessForecastWindow?.next_window || 0);
  return [
    {
      hedge: dashboardCopy("Front-load remediation", "前置补救"),
      action:
        remediationRows[0]?.action ||
        dashboardCopy("Tighten the highest-priority remediation path first.", "先收紧最高优先级的补救路径。")
    },
    {
      hedge: dashboardCopy("Review weak drill path", "复盘薄弱演练路径"),
      action:
        reviewRows[0]?.review ||
        dashboardCopy("Review the weakest drill path before the next shift.", "在下一轮值班前复盘最薄弱的演练路径。")
    },
    {
      hedge: dashboardCopy("Forecast guardrail", "预测护栏"),
      action: dashboardCopy(
        nextWindow >= 80
          ? "Risk hedge is light; maintain the current rehearsal cadence."
          : "Risk hedge should stay active until the next-window readiness forecast stabilizes.",
        nextWindow >= 80
          ? "风险对冲压力较轻，维持当前演练节奏即可。"
          : "在下一窗口准备度预测稳定之前，风险对冲应持续保持打开。"
      )
    }
  ];
}

function buildWatchArchivePromotionDecisionMemoBridge(
  operatorPromotionCriteria,
  staffingBenchMap,
  readinessRiskHedge
) {
  const promotionRows = Array.isArray(operatorPromotionCriteria) ? operatorPromotionCriteria : [];
  const benchRows = Array.isArray(staffingBenchMap) ? staffingBenchMap : [];
  const hedgeRows = Array.isArray(readinessRiskHedge) ? readinessRiskHedge : [];
  const eligibleCount = promotionRows.filter(
    (item) => item.status === dashboardCopy("eligible", "可升级")
  ).length;
  return {
    headline: dashboardCopy(
      eligibleCount > 0
        ? "Promotion decision can move into formal review."
        : "Promotion decision should remain in watch mode for now.",
      eligibleCount > 0
        ? "升级决策可以进入正式审查。"
        : "升级决策目前仍应保持观察模式。"
    ),
    bench_anchor:
      benchRows[0]?.summary ||
      dashboardCopy("Bench depth is still being established.", "梯队深度仍在建立中。"),
    hedge_anchor:
      hedgeRows[0]?.action ||
      dashboardCopy("Readiness hedge should remain active.", "准备度对冲应继续保持。")
  };
}

function buildWatchArchiveCoverageGapHeatmapBridge(
  staffingBenchMap,
  readinessRiskHedge,
  operatorPromotionCriteria
) {
  const benchRows = Array.isArray(staffingBenchMap) ? staffingBenchMap : [];
  const hedgeRows = Array.isArray(readinessRiskHedge) ? readinessRiskHedge : [];
  const promotionRows = Array.isArray(operatorPromotionCriteria) ? operatorPromotionCriteria : [];
  const eligibleCount = promotionRows.filter(
    (item) => item.status === dashboardCopy("eligible", "可升级")
  ).length;
  return [
    {
      zone: dashboardCopy("Lead coverage", "主责覆盖"),
      heat:
        eligibleCount > 0
          ? dashboardCopy("warm", "偏热")
          : dashboardCopy("hot gap", "高热缺口"),
      note:
        benchRows[0]?.summary ||
        dashboardCopy("Lead coverage depth is still forming.", "主责覆盖深度仍在形成。")
    },
    {
      zone: dashboardCopy("Risk hedge coverage", "风险对冲覆盖"),
      heat:
        hedgeRows.length >= 3
          ? dashboardCopy("covered", "已覆盖")
          : dashboardCopy("partial", "部分覆盖"),
      note:
        hedgeRows[0]?.action ||
        dashboardCopy("Risk hedge coverage still needs more explicit actions.", "风险对冲覆盖仍需要更明确的动作。")
    }
  ];
}

function buildWatchArchiveSuccessionReadinessSlateBridge(
  operatorPromotionCriteria,
  certificationLadder,
  readinessForecastWindow
) {
  const promotionRows = Array.isArray(operatorPromotionCriteria) ? operatorPromotionCriteria : [];
  const ladderRows = Array.isArray(certificationLadder) ? certificationLadder : [];
  const nextWindow = Number(readinessForecastWindow?.next_window || 0);
  return promotionRows.map((item, index) => ({
    lane: item.role,
    candidate: dashboardCopy(`Candidate ${index + 1}`, `候选人 ${index + 1}`),
    readiness: dashboardCopy(`${item.status} · ${nextWindow}`, `${item.status} · ${nextWindow}`),
    succession_note: dashboardCopy(
      ladderRows[index]?.status === dashboardCopy("cleared", "已通过") || item.status === dashboardCopy("eligible", "可升级")
        ? "Succession coverage looks plausible for the next watch window."
        : "Succession coverage still needs one more review cycle.",
      ladderRows[index]?.status === dashboardCopy("cleared", "已通过") || item.status === dashboardCopy("eligible", "可升级")
        ? "接班覆盖看起来有望支撑下一轮值班窗口。"
        : "接班覆盖仍需要再经历一轮复核。"
    )
  }));
}

window.buildWatchArchiveOnCallDrillQueueBridge = buildWatchArchiveOnCallDrillQueueBridge;
window.buildWatchArchiveTrainingCompletionLaneBridge = buildWatchArchiveTrainingCompletionLaneBridge;
window.buildWatchArchiveCertificationLadderBridge = buildWatchArchiveCertificationLadderBridge;
window.buildWatchArchiveDrillFailureReviewBridge = buildWatchArchiveDrillFailureReviewBridge;
window.buildWatchArchiveReadinessTrendlineBridge = buildWatchArchiveReadinessTrendlineBridge;
window.buildWatchArchiveOperatorPromotionCriteriaBridge = buildWatchArchiveOperatorPromotionCriteriaBridge;
window.buildWatchArchiveRemediationPlanCardsBridge = buildWatchArchiveRemediationPlanCardsBridge;
window.buildWatchArchiveReadinessForecastWindowBridge = buildWatchArchiveReadinessForecastWindowBridge;
window.buildWatchArchiveStaffingBenchMapBridge = buildWatchArchiveStaffingBenchMapBridge;
window.buildWatchArchiveReadinessRiskHedgeBridge = buildWatchArchiveReadinessRiskHedgeBridge;
window.buildWatchArchivePromotionDecisionMemoBridge = buildWatchArchivePromotionDecisionMemoBridge;
window.buildWatchArchiveCoverageGapHeatmapBridge = buildWatchArchiveCoverageGapHeatmapBridge;
window.buildWatchArchiveSuccessionReadinessSlateBridge = buildWatchArchiveSuccessionReadinessSlateBridge;
