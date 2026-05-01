function buildWatchArchiveShiftDispatchPanelBridge(sendDecisionBanner, shiftSendButtonState, escalationAckTracker) {
  return {
    headline: dashboardCopy("Post-send dispatch view for this shift.", "这一班发出交接后的动作面板。"),
    rows: [
      dashboardCopy(
        `Decision · ${sendDecisionBanner?.headline || dashboardCopy("hold", "暂缓")}`,
        `决策 · ${sendDecisionBanner?.headline || dashboardCopy("暂缓", "暂缓")}`
      ),
      dashboardCopy(
        `Send state · ${shiftSendButtonState?.state || dashboardCopy("disabled", "不可发")}`,
        `发送状态 · ${shiftSendButtonState?.state || dashboardCopy("不可发", "不可发")}`
      ),
      dashboardCopy(
        `Escalation ack · ${escalationAckTracker?.state || dashboardCopy("pending", "待确认")}`,
        `升级确认 · ${escalationAckTracker?.state || dashboardCopy("待确认", "待确认")}`
      )
    ]
  };
}

function buildWatchArchivePacketHandoffReceiptCardBridge(exportReceipts, handoffPacketPreview) {
  const lastReceipt = Array.isArray(exportReceipts) && exportReceipts.length
    ? exportReceipts[exportReceipts.length - 1]
    : null;
  return {
    headline: dashboardCopy("Most recent handoff export receipt.", "最近一次交接发出回执。"),
    rows: [
      dashboardCopy(
        `Receipt time · ${lastReceipt?.at || dashboardCopy("none", "无")}`,
        `回执时间 · ${lastReceipt?.at || dashboardCopy("无", "无")}`
      ),
      dashboardCopy(
        `Receipt file · ${lastReceipt?.fileName || dashboardCopy("none", "无")}`,
        `回执文件 · ${lastReceipt?.fileName || dashboardCopy("无", "无")}`
      ),
      dashboardCopy(
        `Current packet rows · ${Array.isArray(handoffPacketPreview?.rows) ? handoffPacketPreview.rows.length : 0}`,
        `当前交接包行数 · ${Array.isArray(handoffPacketPreview?.rows) ? handoffPacketPreview.rows.length : 0}`
      )
    ]
  };
}

function buildWatchArchiveEscalationFollowUpPromptBridge(escalationAckTracker, escalationOwnerLane) {
  const acked = String(escalationAckTracker?.state || "") === dashboardCopy("acked", "已确认");
  const owner = String(escalationOwnerLane?.owner || dashboardCopy("owner", "接手人"));
  return {
    headline: acked
      ? dashboardCopy("Next prompt: ask the owner for a short follow-up status.", "下一句提醒：请接手人给出简短跟进状态。")
      : dashboardCopy("Next prompt: ask the owner to acknowledge the escalation now.", "下一句提醒：请接手人现在确认升级接手。"),
    note: acked
      ? dashboardCopy(
          `Follow up with ${owner} for the next status update.`,
          `请继续向 ${owner} 追问下一条状态更新。`
        )
      : dashboardCopy(
          `Prompt ${owner} to acknowledge the escalation handoff.`,
          `提醒 ${owner} 确认这次升级交接。`
        )
  };
}

function buildWatchArchiveDispatchOutcomeBadgeBridge(sendDecisionBanner, shiftSendButtonState) {
  const level = String(sendDecisionBanner?.level || "");
  const state = String(shiftSendButtonState?.state || "");
  let badge = dashboardCopy("pending dispatch", "待发出");
  if (level === dashboardCopy("send", "发送") && state === dashboardCopy("armed", "可发送")) {
    badge = dashboardCopy("ready to dispatch", "可发出");
  } else if (level === dashboardCopy("review", "复核")) {
    badge = dashboardCopy("dispatch after review", "复核后发出");
  }
  return {
    badge,
    note: dashboardCopy(
      `Decision=${level || "unknown"} · Send state=${state || "unknown"}`,
      `决策=${level || "未知"} · 发送状态=${state || "未知"}`
    )
  };
}

function buildWatchArchiveReceiptTimelineStripBridge(exportReceipts) {
  const receipts = Array.isArray(exportReceipts) ? exportReceipts.slice(-5) : [];
  return receipts.length
    ? receipts.map((item) => `${item.at}`)
    : [dashboardCopy("No receipt timeline yet.", "当前还没有回执时间线。")];
}

function buildWatchArchiveFollowUpNoteTemplateBridge(escalationFollowUpPrompt, escalationOwnerLane) {
  const owner = String(escalationOwnerLane?.owner || dashboardCopy("接手人", "接手人"));
  return {
    note: dashboardCopy(
      `Follow-up to ${owner}: ${escalationFollowUpPrompt?.headline || dashboardCopy("Please confirm the latest status.", "请确认最新状态。")}`,
      `给 ${owner} 的跟进备注：${escalationFollowUpPrompt?.headline || dashboardCopy("请确认最新状态。", "请确认最新状态。")}`
    )
  };
}

function buildWatchArchiveDispatchHistoryMiniLedgerBridge(dispatchHistory) {
  const rows = Array.isArray(dispatchHistory) ? dispatchHistory.slice(-5).reverse() : [];
  return rows.length
    ? rows.map((item) =>
        dashboardCopy(
          `${item.at} · dispatch done`,
          `${item.at} · 发出完成`
        )
      )
    : [dashboardCopy("No dispatch history yet.", "当前还没有发出历史。")];
}

function buildWatchArchiveReceiptCopyHistoryChipBridge(receiptCopyHistory) {
  const latest = Array.isArray(receiptCopyHistory) ? receiptCopyHistory.slice(-1)[0] : null;
  return latest
    ? {
        chip: dashboardCopy("receipt copied recently", "最近已复制回执"),
        note: latest.fileName ? `${latest.at} · ${latest.fileName}` : `${latest.at}`
      }
    : {
        chip: dashboardCopy("receipt not copied yet", "回执尚未复制"),
        note: dashboardCopy(
          "Copy the latest receipt when you need to hand it off.",
          "需要交接时再复制最新回执。"
        )
      };
}

function buildWatchArchiveFollowUpSendReadyBadgeBridge(followUpCopiedAt, escalationAckTracker) {
  const ackState = String(escalationAckTracker?.state || "").toLowerCase();
  const ready = Boolean(followUpCopiedAt) || ackState.includes("ack");
  return {
    badge: ready
      ? dashboardCopy("follow-up send-ready", "跟进可发送")
      : dashboardCopy("follow-up not ready", "跟进未就绪"),
    note: ready
      ? dashboardCopy(
          "Template copy or acknowledgment is already in place.",
          "跟进模板复制或接手确认已经具备。"
        )
      : dashboardCopy(
          "Copy the follow-up note or wait for acknowledgment first.",
          "先复制跟进备注，或等待接手确认。"
        )
  };
}

function buildWatchArchiveReceiptRecencyBadgeBridge(receiptCopiedAt) {
  if (!receiptCopiedAt) {
    return {
      badge: dashboardCopy("receipt not copied", "回执未复制"),
      note: dashboardCopy(
        "No recent receipt copy action is recorded.",
        "当前还没有最近一次回执复制记录。"
      )
    };
  }
  const deltaMs = Math.max(0, Date.now() - new Date(receiptCopiedAt).getTime());
  const deltaMin = Math.round(deltaMs / 60000);
  const fresh = deltaMin <= 15;
  return {
    badge: fresh
      ? dashboardCopy("receipt fresh", "回执较新")
      : dashboardCopy("receipt aging", "回执变旧"),
    note: dashboardCopy(
      `Last copied about ${deltaMin} minute(s) ago.`,
      `最近一次复制大约在 ${deltaMin} 分钟前。`
    )
  };
}

function buildWatchArchiveFollowUpDeliveryNoteBridge(
  followUpNoteTemplate,
  escalationOwnerLane,
  followUpSendReadyBadge
) {
  const owner = String(escalationOwnerLane?.owner || dashboardCopy("接手人", "接手人"));
  return {
    headline: dashboardCopy(`Delivery note for ${owner}`, `给 ${owner} 的交接备注`),
    body: dashboardCopy(
      `${followUpSendReadyBadge.badge}. ${followUpNoteTemplate.note}`,
      `${followUpSendReadyBadge.badge}。${followUpNoteTemplate.note}`
    )
  };
}

function buildWatchArchiveDispatchHandoffBundleCardBridge(
  dispatchHistoryMiniLedger,
  handoffPacketPreview,
  dispatchHistoryExportAt
) {
  return {
    headline: dashboardCopy("Dispatch handoff bundle is ready", "发出交接包已就绪"),
    rows: [
      ...(Array.isArray(dispatchHistoryMiniLedger) ? dispatchHistoryMiniLedger.slice(0, 3) : []),
      ...((handoffPacketPreview?.rows || []).slice(0, 2)),
      dispatchHistoryExportAt
        ? dashboardCopy(
            `Last bundle export ${dispatchHistoryExportAt}`,
            `最近一次交接包导出：${dispatchHistoryExportAt}`
          )
        : dashboardCopy("Bundle has not been exported yet.", "交接包还没有导出。")
    ]
  };
}

function buildWatchArchiveReceiptStalenessAlertBridge(receiptRecencyBadge) {
  const badge = String(receiptRecencyBadge?.badge || "");
  const stale = badge.includes("aging") || badge.includes("变旧");
  return {
    level: stale ? dashboardCopy("watch", "关注") : dashboardCopy("normal", "正常"),
    headline: stale
      ? dashboardCopy("Receipt follow-up is starting to age", "回执跟进开始变旧")
      : dashboardCopy("Receipt follow-up is still fresh", "回执跟进仍然较新"),
    note: String(receiptRecencyBadge?.note || "")
  };
}

function buildWatchArchiveFollowUpDeliveryReceiptBridge(
  followUpCopiedAt,
  followUpDeliveryNote,
  escalationAckTracker
) {
  return {
    headline: followUpCopiedAt
      ? dashboardCopy("Follow-up delivery receipt recorded", "已记录跟进交接回执")
      : dashboardCopy("Follow-up delivery receipt pending", "跟进交接回执待记录"),
    rows: [
      followUpCopiedAt
        ? dashboardCopy(
            `Last delivery copy ${followUpCopiedAt}`,
            `最近一次交接备注复制：${followUpCopiedAt}`
          )
        : dashboardCopy(
            "No follow-up delivery copy has been recorded yet.",
            "当前还没有记录跟进交接备注复制。"
          ),
      String(followUpDeliveryNote?.body || ""),
      dashboardCopy(
        `Escalation state · ${escalationAckTracker?.state || "unknown"}`,
        `升级状态 · ${escalationAckTracker?.state || "未知"}`
      )
    ]
  };
}

Object.assign(globalThis, {
  buildWatchArchiveShiftDispatchPanelBridge,
  buildWatchArchivePacketHandoffReceiptCardBridge,
  buildWatchArchiveEscalationFollowUpPromptBridge,
  buildWatchArchiveDispatchOutcomeBadgeBridge,
  buildWatchArchiveReceiptTimelineStripBridge,
  buildWatchArchiveFollowUpNoteTemplateBridge,
  buildWatchArchiveDispatchHistoryMiniLedgerBridge,
  buildWatchArchiveReceiptCopyHistoryChipBridge,
  buildWatchArchiveFollowUpSendReadyBadgeBridge,
  buildWatchArchiveReceiptRecencyBadgeBridge,
  buildWatchArchiveFollowUpDeliveryNoteBridge,
  buildWatchArchiveDispatchHandoffBundleCardBridge,
  buildWatchArchiveReceiptStalenessAlertBridge,
  buildWatchArchiveFollowUpDeliveryReceiptBridge
});
