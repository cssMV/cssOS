(function attachWatchArchiveSendFlow(global) {
  const dashboardCopy = (...args) => global.dashboardCopy(...args);

  function buildWatchArchiveShiftSendChecklistBridge(
    shiftCloseChecklist,
    handoffSendGate,
    operatorNotes,
    exportReceipts
  ) {
    const checklist = [];
    checklist.push({
      label: dashboardCopy("Close checklist cleared", "收口清单已清空"),
      state:
        Array.isArray(shiftCloseChecklist?.checklist) &&
        shiftCloseChecklist.checklist.every((item) => item.state === dashboardCopy("ready", "就绪"))
          ? dashboardCopy("ready", "就绪")
          : dashboardCopy("pending", "待处理")
    });
    checklist.push({
      label: dashboardCopy("Handoff gate open", "交接发送门已打开"),
      state:
        String(handoffSendGate?.status || "") === dashboardCopy("open", "已开闸")
          ? dashboardCopy("ready", "就绪")
          : dashboardCopy("pending", "待处理")
    });
    checklist.push({
      label: dashboardCopy("Operator notes written", "值班备注已填写"),
      state: String(operatorNotes || "").trim()
        ? dashboardCopy("ready", "就绪")
        : dashboardCopy("pending", "待处理")
    });
    checklist.push({
      label: dashboardCopy("Export receipt recorded", "导出回执已记录"),
      state: Array.isArray(exportReceipts) && exportReceipts.length
        ? dashboardCopy("ready", "就绪")
        : dashboardCopy("pending", "待处理")
    });
    return {
      headline: dashboardCopy("Final checks before sending this handoff.", "发出这次交接前的最后核对。"),
      checklist
    };
  }

  function buildWatchArchiveHandoffPacketPreviewBridge(probeSummary, probeHistory, operatorNotes, handoffAcknowledgments) {
    const bundle = global.buildWatchArchiveIncidentExportBundle(probeSummary, probeHistory);
    const ack = Array.isArray(handoffAcknowledgments) && handoffAcknowledgments.length
      ? handoffAcknowledgments[handoffAcknowledgments.length - 1]
      : null;
    return {
      headline: dashboardCopy("What the handoff packet would contain right now.", "当前交接包里将会包含这些内容。"),
      rows: [
        dashboardCopy(`Schema · ${bundle?.schema || "unknown"}`, `结构 · ${bundle?.schema || "未知"}`),
        dashboardCopy(
          `Latest verdict · ${bundle?.latest_probe?.conclusion?.verdict || "unknown"}`,
          `最新结论 · ${bundle?.latest_probe?.conclusion?.verdict || "未知"}`
        ),
        dashboardCopy(
          `History samples · ${Array.isArray(bundle?.probe_history) ? bundle.probe_history.length : 0}`,
          `历史样本 · ${Array.isArray(bundle?.probe_history) ? bundle.probe_history.length : 0}`
        ),
        dashboardCopy(
          `Operator notes · ${String(operatorNotes || "").trim() ? dashboardCopy("included", "已包含") : dashboardCopy("missing", "缺失")}`,
          `值班备注 · ${String(operatorNotes || "").trim() ? dashboardCopy("已包含", "已包含") : dashboardCopy("缺失", "缺失")}`
        ),
        dashboardCopy(
          `Latest acknowledgment · ${ack?.at || dashboardCopy("none", "无")}`,
          `最近接班确认 · ${ack?.at || dashboardCopy("无", "无")}`
        )
      ]
    };
  }

  function buildWatchArchiveConfidenceEscalationLadderBridge(
    verdictConfidenceCard,
    shiftRiskBadge,
    crossBorderAnomalyAlert
  ) {
    const confidence = String(verdictConfidenceCard?.confidence || "");
    const risk = String(shiftRiskBadge?.badge || "");
    const severeCrossBorder = String(crossBorderAnomalyAlert?.level || "") === dashboardCopy("alert", "告警");
    let lane = dashboardCopy("normal follow-through", "常规跟进");
    if (confidence === dashboardCopy("low", "低") || risk === dashboardCopy("high", "高")) {
      lane = dashboardCopy("escalate to active review", "升级到主动复核");
    } else if (confidence === dashboardCopy("medium", "中") || severeCrossBorder) {
      lane = dashboardCopy("route to cautious review", "进入谨慎复核");
    }
    const steps = [
      dashboardCopy("1. Confirm the latest probe sample and route comparison.", "1. 确认最新探针样本和链路对比。"),
      dashboardCopy("2. Choose conservative wording if confidence is not high.", "2. 如果把握度不高，采用更保守的表述。"),
      dashboardCopy("3. Escalate to active review before sending when risk stays high.", "3. 如果风险仍高，在发出前升级到主动复核。")
    ];
    return { lane, steps };
  }

  function buildWatchArchiveShiftSendButtonStateBridge(handoffSendGate, shiftSendChecklist) {
    const status = String(handoffSendGate?.status || "");
    const pendingCount = Array.isArray(shiftSendChecklist?.checklist)
      ? shiftSendChecklist.checklist.filter((item) => item.state !== dashboardCopy("ready", "就绪")).length
      : 0;
    let state = dashboardCopy("disabled", "不可发");
    let note = dashboardCopy("Keep the send button disabled until the handoff gate opens.", "在交接发送门打开前，发送按钮应保持不可发。");
    if (status === dashboardCopy("open", "已开闸") && pendingCount === 0) {
      state = dashboardCopy("armed", "可发送");
      note = dashboardCopy("The send button can be armed now.", "发送按钮现在可以放开。");
    } else if (status === dashboardCopy("review", "待复核")) {
      state = dashboardCopy("review", "待复核");
      note = dashboardCopy("Keep the send button behind one more human review.", "发送按钮应继续放在一次人工复核之后。");
    }
    return { state, note };
  }

  function buildWatchArchivePacketExportPreviewDiffBridge(handoffPacketPreview, exportReceipts) {
    const receiptCount = Array.isArray(exportReceipts) ? exportReceipts.length : 0;
    const lastReceipt = receiptCount ? exportReceipts[receiptCount - 1] : null;
    return {
      headline: dashboardCopy("How this packet preview differs from the last exported handoff.", "这次交接包预览与上一次导出相比的差异。"),
      rows: [
        dashboardCopy(
          `Current packet rows · ${Array.isArray(handoffPacketPreview?.rows) ? handoffPacketPreview.rows.length : 0}`,
          `当前包行数 · ${Array.isArray(handoffPacketPreview?.rows) ? handoffPacketPreview.rows.length : 0}`
        ),
        dashboardCopy(
          `Previous export receipt · ${lastReceipt?.at || dashboardCopy("none", "无")}`,
          `上次导出回执 · ${lastReceipt?.at || dashboardCopy("无", "无")}`
        ),
        dashboardCopy(
          `Previous export file · ${lastReceipt?.fileName || dashboardCopy("none", "无")}`,
          `上次导出文件 · ${lastReceipt?.fileName || dashboardCopy("无", "无")}`
        ),
        receiptCount
          ? dashboardCopy("Packet preview should be checked against the most recent receipt before sending again.", "再次发送前，应把当前包预览和最近回执对照确认。")
          : dashboardCopy("No previous export receipt exists yet, so this packet will be the first handoff bundle.", "当前还没有历史导出回执，所以这次会是第一份交接包。")
      ]
    };
  }

  function buildWatchArchiveEscalationOwnerLaneBridge(
    confidenceEscalationLadder,
    crossBorderAnomalyAlert,
    shiftRiskBadge
  ) {
    const lane = String(confidenceEscalationLadder?.lane || "");
    const risk = String(shiftRiskBadge?.badge || "");
    const severeCrossBorder = String(crossBorderAnomalyAlert?.level || "") === dashboardCopy("alert", "告警");
    let owner = dashboardCopy("current operator", "当前值班人");
    if (lane.includes("active review") || lane.includes("主动复核")) {
      owner = dashboardCopy("senior on-call reviewer", "高级值班复核人");
    } else if (severeCrossBorder || risk === dashboardCopy("medium", "中")) {
      owner = dashboardCopy("network-path reviewer", "网络链路复核人");
    }
    return {
      owner,
      note: dashboardCopy(
        `Escalation lane=${lane || "unknown"} · Suggested owner=${owner}`,
        `升级路径=${lane || "未知"} · 建议接手人=${owner}`
      )
    };
  }

  function buildWatchArchiveSendReadinessScoreBridge(shiftSendChecklist, handoffSendGate, handoffReadinessBanner) {
    let score = 0;
    const checklist = Array.isArray(shiftSendChecklist?.checklist) ? shiftSendChecklist.checklist : [];
    checklist.forEach((item) => {
      if (item.state === dashboardCopy("ready", "就绪")) score += 20;
    });
    if (String(handoffSendGate?.status || "") === dashboardCopy("open", "已开闸")) score += 10;
    if (String(handoffReadinessBanner?.level || "") === dashboardCopy("ready", "可发")) score += 10;
    return {
      score: Math.min(100, score),
      note: dashboardCopy(
        `Checklist + gate + readiness combine into this send score.`,
        `发送准备度由清单、发送门和交接就绪度共同组成。`
      )
    };
  }

  function buildWatchArchivePacketDeltaSummaryChipBridge(packetExportPreviewDiff) {
    const rows = Array.isArray(packetExportPreviewDiff?.rows) ? packetExportPreviewDiff.rows : [];
    const hasPrevious = rows.some((row) => String(row).includes("Previous export receipt")) &&
      !rows.some((row) => String(row).includes(dashboardCopy("none", "无")));
    return {
      chip: hasPrevious
        ? dashboardCopy("Packet changed since last export", "交接包相较上次已有变化")
        : dashboardCopy("First packet export draft", "第一版交接包草稿"),
      note: rows[rows.length - 1] || ""
    };
  }

  function buildWatchArchiveEscalationAckTrackerBridge(escalationOwnerLane, handoffAcknowledgments) {
    const owner = String(escalationOwnerLane?.owner || "");
    const acknowledgments = Array.isArray(handoffAcknowledgments) ? handoffAcknowledgments : [];
    const lastAck = acknowledgments.length ? acknowledgments[acknowledgments.length - 1] : null;
    const acknowledged = !!lastAck;
    return {
      state: acknowledged ? dashboardCopy("acked", "已确认") : dashboardCopy("pending", "待确认"),
      note: acknowledged
        ? dashboardCopy(
            `${owner || dashboardCopy("owner", "接手人")} already has a handoff acknowledgment at ${lastAck.at}.`,
            `${owner || dashboardCopy("接手人", "接手人")} 已在 ${lastAck.at} 完成接班确认。`
          )
        : dashboardCopy(
            `${owner || dashboardCopy("owner", "接手人")} still needs to acknowledge this escalation handoff.`,
            `${owner || dashboardCopy("接手人", "接手人")} 还需要确认这次升级接手。`
          )
    };
  }

  function buildWatchArchiveSendDecisionBannerBridge(sendReadinessScore, shiftSendButtonState, shiftExitRecommendation) {
    const score = Number(sendReadinessScore?.score || 0);
    const sendState = String(shiftSendButtonState?.state || "");
    const exitHeadline = String(shiftExitRecommendation?.headline || "");
    let level = dashboardCopy("hold", "暂缓");
    let headline = dashboardCopy("Do not send yet.", "现在先不要发。");
    if (sendState === dashboardCopy("armed", "可发送") && score >= 90) {
      level = dashboardCopy("send", "发送");
      headline = dashboardCopy("Send now.", "现在可以发。");
    } else if (sendState === dashboardCopy("review", "待复核") || exitHeadline.includes("继续")) {
      level = dashboardCopy("review", "复核");
      headline = dashboardCopy("Review once more before sending.", "发之前再复核一次。");
    }
    return {
      level,
      headline,
      note: dashboardCopy(
        `Send score=${score}/100 · Button=${sendState || "unknown"}`,
        `发送分数=${score}/100 · 按钮状态=${sendState || "未知"}`
      )
    };
  }

  function buildWatchArchivePacketFreshnessStripBridge(exportReceipts) {
    const lastReceipt = Array.isArray(exportReceipts) && exportReceipts.length
      ? exportReceipts[exportReceipts.length - 1]
      : null;
    return {
      label: lastReceipt
        ? dashboardCopy("recent export on record", "已有最近导出记录")
        : dashboardCopy("no export yet", "尚无导出记录"),
      note: lastReceipt
        ? dashboardCopy(`Last export at ${lastReceipt.at} · ${lastReceipt.fileName}`, `最近导出于 ${lastReceipt.at} · ${lastReceipt.fileName}`)
        : dashboardCopy("This packet is still fresh because no previous export exists.", "当前还没有历史导出，所以这份包仍是最新草稿。")
    };
  }

  function buildWatchArchiveEscalationTimerCardBridge(handoffAcknowledgments, escalationAckTracker) {
    const lastAck = Array.isArray(handoffAcknowledgments) && handoffAcknowledgments.length
      ? handoffAcknowledgments[handoffAcknowledgments.length - 1]
      : null;
    return {
      state: escalationAckTracker?.state || dashboardCopy("pending", "待确认"),
      note: lastAck
        ? dashboardCopy(`Escalation waited until ${lastAck.at} for the latest acknowledgment.`, `这次升级至少等待到 ${lastAck.at} 才拿到最近一次确认。`)
        : dashboardCopy("Escalation is still waiting for its first acknowledgment.", "这次升级仍在等待第一条确认。")
    };
  }

  global.buildWatchArchiveShiftSendChecklistBridge = buildWatchArchiveShiftSendChecklistBridge;
  global.buildWatchArchiveHandoffPacketPreviewBridge = buildWatchArchiveHandoffPacketPreviewBridge;
  global.buildWatchArchiveConfidenceEscalationLadderBridge = buildWatchArchiveConfidenceEscalationLadderBridge;
  global.buildWatchArchiveShiftSendButtonStateBridge = buildWatchArchiveShiftSendButtonStateBridge;
  global.buildWatchArchivePacketExportPreviewDiffBridge = buildWatchArchivePacketExportPreviewDiffBridge;
  global.buildWatchArchiveEscalationOwnerLaneBridge = buildWatchArchiveEscalationOwnerLaneBridge;
  global.buildWatchArchiveSendReadinessScoreBridge = buildWatchArchiveSendReadinessScoreBridge;
  global.buildWatchArchivePacketDeltaSummaryChipBridge = buildWatchArchivePacketDeltaSummaryChipBridge;
  global.buildWatchArchiveEscalationAckTrackerBridge = buildWatchArchiveEscalationAckTrackerBridge;
  global.buildWatchArchiveSendDecisionBannerBridge = buildWatchArchiveSendDecisionBannerBridge;
  global.buildWatchArchivePacketFreshnessStripBridge = buildWatchArchivePacketFreshnessStripBridge;
  global.buildWatchArchiveEscalationTimerCardBridge = buildWatchArchiveEscalationTimerCardBridge;
})(globalThis);
