(function attachWatchArchiveCorrections(global) {
  const dashboardCopy = (...args) => global.dashboardCopy(...args);

  function buildWatchArchiveHandoffReadinessBadgeBridge(
    stabilizationHandoffMemo,
    stabilizationConfidenceBand,
    closureShiftHandoff
  ) {
    const ready =
      stabilizationConfidenceBand?.band === dashboardCopy("high confidence", "高把握") &&
      !!stabilizationHandoffMemo?.next_owner &&
      stabilizationHandoffMemo.next_owner !== dashboardCopy("unassigned", "未指派");
    return {
      badge: ready ? dashboardCopy("handoff ready", "交接就绪") : dashboardCopy("handoff not ready", "交接未就绪"),
      owner:
        stabilizationHandoffMemo?.next_owner ||
        closureShiftHandoff?.next_owner ||
        dashboardCopy("unassigned", "未指派"),
      summary:
        stabilizationHandoffMemo?.summary ||
        dashboardCopy("No handoff readiness summary yet.", "当前还没有交接就绪摘要。")
    };
  }

  function buildWatchArchiveCorrectionClosureQueueBridge(
    correctionCompletionTracker,
    driftCorrectionQueue,
    rebalanceExecutionTracker
  ) {
    const completionRows = Array.isArray(correctionCompletionTracker) ? correctionCompletionTracker : [];
    const driftRows = Array.isArray(driftCorrectionQueue) ? driftCorrectionQueue : [];
    const executionRows = Array.isArray(rebalanceExecutionTracker) ? rebalanceExecutionTracker : [];
    return completionRows.slice(0, 3).map((item, index) => ({
      owner: item.owner,
      closure:
        item.completion === dashboardCopy("in progress", "推进中")
          ? dashboardCopy("close after execution", "执行后收口")
          : item.completion === dashboardCopy("watching", "观察中")
            ? dashboardCopy("close after watch", "观察后收口")
            : dashboardCopy("needs closure", "待收口"),
      action:
        driftRows[index]?.action ||
        item.action,
      note:
        executionRows[index]?.note ||
        item.note ||
        dashboardCopy("No correction closure note yet.", "当前还没有纠偏收口备注。")
    }));
  }

  function buildWatchArchiveProofSignoffChecklistBridge(
    proofAcceptanceCard,
    signoffEvidenceWallet,
    evidenceRecoveryScoreboard
  ) {
    const anchors = signoffEvidenceWallet?.evidence_count || 0;
    const meter = evidenceRecoveryScoreboard?.meter || 0;
    return [
      {
        item: dashboardCopy("Proof acceptance state", "证明验收状态"),
        status: proofAcceptanceCard?.acceptance || dashboardCopy("unknown", "未知"),
        note: proofAcceptanceCard?.summary || dashboardCopy("No proof acceptance note yet.", "当前还没有证明验收备注。")
      },
      {
        item: dashboardCopy("Evidence anchors", "证据锚点"),
        status: anchors >= 1 ? dashboardCopy("ready", "已具备") : dashboardCopy("missing", "缺失"),
        note: dashboardCopy(
          `${anchors} sign-off evidence anchors are available.`,
          `当前可用签字证据锚点共 ${anchors} 条。`
        )
      },
      {
        item: dashboardCopy("Recovery meter", "恢复计分"),
        status: meter >= 60 ? dashboardCopy("reviewable", "可复核") : dashboardCopy("needs uplift", "仍需提升"),
        note: dashboardCopy(
          `Current recovery meter is ${meter}%.`,
          `当前恢复计分为 ${meter}%。`
        )
      }
    ];
  }

  function buildWatchArchiveClosureSignoffGateBridge(
    handoffReadinessBadge,
    proofSignoffChecklist,
    proofAcceptanceCard
  ) {
    const checklist = Array.isArray(proofSignoffChecklist) ? proofSignoffChecklist : [];
    const readyCount = checklist.filter(
      (item) =>
        item.status === dashboardCopy("ready", "已具备") ||
        item.status === dashboardCopy("reviewable", "可复核") ||
        item.status === dashboardCopy("near acceptance", "接近验收")
    ).length;
    const gateOpen =
      handoffReadinessBadge?.badge === dashboardCopy("handoff ready", "交接就绪") &&
      proofAcceptanceCard?.acceptance === dashboardCopy("near acceptance", "接近验收") &&
      readyCount >= 2;
    return {
      gate: gateOpen ? dashboardCopy("sign-off ready", "可签字过门") : dashboardCopy("hold sign-off", "暂缓签字"),
      readiness: `${readyCount}/${checklist.length || 0}`,
      summary: dashboardCopy(
        `Handoff is ${handoffReadinessBadge?.badge || "unknown"} and the proof checklist is ${readyCount}/${checklist.length || 0} ready.`,
        `当前交接状态为 ${handoffReadinessBadge?.badge || "未知"}，证明清单就绪度为 ${readyCount}/${checklist.length || 0}。`
      )
    };
  }

  function buildWatchArchiveHandoffCompletionReceiptBridge(
    handoffReadinessBadge,
    stabilizationHandoffMemo,
    closureShiftHandoff
  ) {
    return {
      receipt:
        handoffReadinessBadge?.badge === dashboardCopy("handoff ready", "交接就绪")
          ? dashboardCopy("receipt available", "可生成回执")
          : dashboardCopy("receipt pending", "回执待生成"),
      owner:
        handoffReadinessBadge?.owner ||
        stabilizationHandoffMemo?.next_owner ||
        dashboardCopy("unassigned", "未指派"),
      summary:
        stabilizationHandoffMemo?.summary ||
        closureShiftHandoff?.summary ||
        dashboardCopy("No handoff completion receipt summary yet.", "当前还没有交接完成回执摘要。")
    };
  }

  function buildWatchArchiveCorrectionAuditTrailBridge(
    correctionClosureQueue,
    correctionCompletionTracker,
    executionDriftAlerts
  ) {
    const closureRows = Array.isArray(correctionClosureQueue) ? correctionClosureQueue : [];
    const completionRows = Array.isArray(correctionCompletionTracker) ? correctionCompletionTracker : [];
    const alertRows = Array.isArray(executionDriftAlerts) ? executionDriftAlerts : [];
    return closureRows.slice(0, 3).map((item, index) => ({
      owner: item.owner,
      audit_state:
        item.closure === dashboardCopy("close after execution", "执行后收口")
          ? dashboardCopy("awaiting proof", "待补证据")
          : item.closure === dashboardCopy("close after watch", "观察后收口")
            ? dashboardCopy("watch audit", "观察审计")
            : dashboardCopy("closure pending", "收口待定"),
      action:
        completionRows[index]?.action ||
        item.action,
      note:
        alertRows[index]?.note ||
        completionRows[index]?.note ||
        item.note ||
        dashboardCopy("No correction audit trail note yet.", "当前还没有纠偏审计轨迹备注。")
    }));
  }

  global.buildWatchArchiveHandoffReadinessBadgeBridge = buildWatchArchiveHandoffReadinessBadgeBridge;
  global.buildWatchArchiveCorrectionClosureQueueBridge = buildWatchArchiveCorrectionClosureQueueBridge;
  global.buildWatchArchiveProofSignoffChecklistBridge = buildWatchArchiveProofSignoffChecklistBridge;
  global.buildWatchArchiveClosureSignoffGateBridge = buildWatchArchiveClosureSignoffGateBridge;
  global.buildWatchArchiveHandoffCompletionReceiptBridge = buildWatchArchiveHandoffCompletionReceiptBridge;
  global.buildWatchArchiveCorrectionAuditTrailBridge = buildWatchArchiveCorrectionAuditTrailBridge;
})(globalThis);
