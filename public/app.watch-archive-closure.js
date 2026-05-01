function buildWatchArchiveBoardDecisionLedgerBridge(
  boardSignoffPacket,
  executiveSignoffReadiness,
  execReviewAgenda
) {
  const agendaRows = Array.isArray(execReviewAgenda) ? execReviewAgenda : [];
  return agendaRows.slice(0, 3).map((item, index) => ({
    decision_id: `BD-${index + 1}`,
    decision:
      item.summary ||
      dashboardCopy("Board decision entry is still forming.", "董事会决策条目仍在形成中。"),
    packet_anchor:
      index === 0
        ? boardSignoffPacket?.headline ||
          dashboardCopy("No sign-off packet headline yet.", "当前还没有签字包主结论。")
        : boardSignoffPacket?.agenda_anchor ||
          dashboardCopy("No agenda anchor yet.", "当前还没有议程锚点。"),
    readiness:
      executiveSignoffReadiness?.status ||
      dashboardCopy("not ready yet", "尚不可签")
  }));
}

function buildWatchArchiveWarRoomResolutionTimelineBridge(
  recoveryWarRoomQueue,
  escalationRecoveryForecast,
  escalationBurndown
) {
  const queueRows = Array.isArray(recoveryWarRoomQueue) ? recoveryWarRoomQueue : [];
  return queueRows.slice(0, 4).map((item, index) => ({
    phase: dashboardCopy(`Phase ${index + 1}`, `阶段 ${index + 1}`),
    lane: item.lane,
    priority: item.priority,
    action: item.war_room_action,
    outlook:
      index === 0
        ? dashboardCopy(
            `${escalationRecoveryForecast?.outlook || dashboardCopy("recoverable", "可恢复")} · ${dashboardCopy("urgent lanes", "紧急通道")}: ${Number(escalationBurndown?.urgent || 0)}`,
            `${escalationRecoveryForecast?.outlook || dashboardCopy("可恢复", "可恢复")} · ${dashboardCopy("紧急通道", "紧急通道")}: ${Number(escalationBurndown?.urgent || 0)}`
          )
        : item.outlook
  }));
}

function buildWatchArchiveExceptionClosureCertificateBridge(
  exceptionDispositionLog,
  closureAuditSummary,
  auditConfidenceBanner
) {
  const dispositionRows = Array.isArray(exceptionDispositionLog) ? exceptionDispositionLog : [];
  const openItems = Number(closureAuditSummary?.open_items || 0);
  const readyToClose = dispositionRows.length > 0 && openItems <= 1;
  return {
    status: readyToClose
      ? dashboardCopy("closure certifiable", "可出具关闭证明")
      : dashboardCopy("closure still pending", "关闭证明待完成"),
    confidence:
      auditConfidenceBanner?.confidence ||
      dashboardCopy("low confidence", "低把握"),
    note: readyToClose
      ? dashboardCopy(
          `${dispositionRows.length} exception lanes have dispositions attached and only ${openItems} closure item remains open.`,
          `当前已有 ${dispositionRows.length} 条例外通道挂上处置结论，且仅剩 ${openItems} 条闭环项未关闭。`
        )
      : closureAuditSummary?.headline ||
        dashboardCopy("Exception closure certificate still needs more closure evidence.", "例外关闭证明仍需要更多闭环证据。")
  };
}

function buildWatchArchiveBoardActionFollowThroughBridge(
  boardDecisionLedger,
  leadershipFollowThroughBoard,
  executiveSignoffReadiness
) {
  const ledgerRows = Array.isArray(boardDecisionLedger) ? boardDecisionLedger : [];
  const followThroughRows = Array.isArray(leadershipFollowThroughBoard) ? leadershipFollowThroughBoard : [];
  return ledgerRows.slice(0, 3).map((item, index) => ({
    action: item.decision,
    owner:
      followThroughRows[index]?.owner ||
      dashboardCopy("executive owner pending", "负责人待补"),
    status:
      executiveSignoffReadiness?.status === dashboardCopy("ready to sign", "可签字")
        ? dashboardCopy("tracked for follow-through", "已进入落地跟踪")
        : dashboardCopy("waiting on sign-off", "待签字后跟进"),
    note:
      followThroughRows[index]?.next_step ||
      item.packet_anchor ||
      dashboardCopy("Board follow-through note is still forming.", "董事会动作落地备注仍在形成中。")
  }));
}

function buildWatchArchiveWarRoomExitCriteriaBridge(
  warRoomResolutionTimeline,
  escalationRecoveryForecast,
  exceptionClosureCertificate
) {
  const timelineRows = Array.isArray(warRoomResolutionTimeline) ? warRoomResolutionTimeline : [];
  const recoveryPct = Number(escalationRecoveryForecast?.recovery_pct || 0);
  const certifiable =
    exceptionClosureCertificate?.status === dashboardCopy("closure certifiable", "可出具关闭证明");
  return {
    status:
      recoveryPct >= 75 && certifiable
        ? dashboardCopy("eligible to exit war-room", "可退出战情室")
        : dashboardCopy("stay in war-room", "继续保留战情室"),
    threshold: dashboardCopy(
      `Recovery >= 75%, closure certifiable, active resolution lanes=${timelineRows.length}.`,
      `恢复率 >= 75%，关闭证明可出具，当前活跃解决通道=${timelineRows.length}。`
    ),
    note:
      timelineRows[0]?.outlook ||
      escalationRecoveryForecast?.note ||
      dashboardCopy("War-room exit criteria are still forming.", "战情退场标准仍在形成中。")
  };
}

function buildWatchArchiveCertifiedExceptionArchiveBridge(
  exceptionClosureCertificate,
  exceptionDispositionLog,
  auditArchiveIndex
) {
  const dispositionRows = Array.isArray(exceptionDispositionLog) ? exceptionDispositionLog : [];
  const archiveRows = Array.isArray(auditArchiveIndex) ? auditArchiveIndex : [];
  return {
    archive_status:
      exceptionClosureCertificate?.status === dashboardCopy("closure certifiable", "可出具关闭证明")
        ? dashboardCopy("ready for certified archive", "可进入正式归档")
        : dashboardCopy("archive pending closure", "归档待闭环"),
    certificate_anchor:
      exceptionClosureCertificate?.note ||
      dashboardCopy("No closure certificate note yet.", "当前还没有关闭证明备注。"),
    archive_anchor:
      archiveRows[0]?.title ||
      archiveRows[0]?.label ||
      dashboardCopy("No audit archive slot yet.", "当前还没有审计归档位。"),
    exception_count: dispositionRows.length
  };
}

function buildWatchArchiveBoardClosureMemoBridge(
  boardActionFollowThrough,
  boardDecisionLedger,
  executiveSignoffReadiness
) {
  const followRows = Array.isArray(boardActionFollowThrough) ? boardActionFollowThrough : [];
  const ledgerRows = Array.isArray(boardDecisionLedger) ? boardDecisionLedger : [];
  const tracked = followRows.filter(
    (item) => item.status === dashboardCopy("tracked for follow-through", "已进入落地跟踪")
  ).length;
  return {
    headline:
      executiveSignoffReadiness?.status ||
      dashboardCopy("Board closure memo is still forming.", "董事会收口备忘仍在形成中。"),
    summary: dashboardCopy(
      `${tracked}/${ledgerRows.length || followRows.length || 0} board decision lanes are already tracked for follow-through.`,
      `当前已有 ${tracked}/${ledgerRows.length || followRows.length || 0} 条董事会决策通道进入落地跟踪。`
    ),
    next_anchor:
      followRows[0]?.note ||
      ledgerRows[0]?.decision ||
      dashboardCopy("No board closure anchor yet.", "当前还没有董事会收口锚点。")
  };
}

function buildWatchArchiveWarRoomStandDownChecklistBridge(
  warRoomExitCriteria,
  warRoomResolutionTimeline,
  escalationBurndown
) {
  const timelineRows = Array.isArray(warRoomResolutionTimeline) ? warRoomResolutionTimeline : [];
  const urgent = Number(escalationBurndown?.urgent || 0);
  return [
    {
      item: dashboardCopy("Exit status confirmed", "退场状态确认"),
      state: watchArchiveChecklistState(
        warRoomExitCriteria?.status === dashboardCopy("eligible to exit war-room", "可退出战情室")
      ),
      note: warRoomExitCriteria?.note || ""
    },
    {
      item: dashboardCopy("Urgent lanes cleared", "紧急通道清理"),
      state: watchArchiveChecklistState(urgent === 0),
      note: dashboardCopy(
        `Urgent escalation lanes remaining: ${urgent}.`,
        `当前剩余紧急升级通道：${urgent}。`
      )
    },
    {
      item: dashboardCopy("Resolution lanes documented", "解决通道留档"),
      state: watchArchiveChecklistState(timelineRows.length > 0),
      note: dashboardCopy(
        `Resolution timeline entries captured: ${timelineRows.length}.`,
        `当前已记录解决时间线条目：${timelineRows.length}。`
      )
    }
  ];
}

function buildWatchArchiveCertifiedArchiveLedgerBridge(
  certifiedExceptionArchive,
  exceptionClosureCertificate,
  auditArchiveIndex
) {
  const archiveRows = Array.isArray(auditArchiveIndex) ? auditArchiveIndex : [];
  return archiveRows.slice(0, 3).map((item, index) => ({
    archive_id: `CA-${index + 1}`,
    status:
      certifiedExceptionArchive?.archive_status ||
      dashboardCopy("archive pending closure", "归档待闭环"),
    record:
      item.title ||
      item.label ||
      dashboardCopy("Certified archive record is still forming.", "正式归档记录仍在形成中。"),
    certificate:
      index === 0
        ? exceptionClosureCertificate?.status ||
          dashboardCopy("closure still pending", "关闭证明待完成")
        : certifiedExceptionArchive?.certificate_anchor ||
          dashboardCopy("No closure certificate anchor yet.", "当前还没有关闭证明锚点。")
  }));
}

function buildWatchArchiveGovernanceClosureDashboardBridge(
  boardClosureMemo,
  warRoomExitCriteria,
  certifiedExceptionArchive
) {
  return {
    headline:
      boardClosureMemo?.headline ||
      dashboardCopy("Governance closure dashboard is still forming.", "治理收口总览仍在形成中。"),
    closure_state:
      certifiedExceptionArchive?.archive_status ||
      dashboardCopy("archive pending closure", "归档待闭环"),
    stand_down_state:
      warRoomExitCriteria?.status ||
      dashboardCopy("stay in war-room", "继续保留战情室"),
    summary: dashboardCopy(
      `${boardClosureMemo?.summary || ""} ${warRoomExitCriteria?.threshold || ""}`.trim(),
      `${boardClosureMemo?.summary || ""} ${warRoomExitCriteria?.threshold || ""}`.trim()
    )
  };
}

window.buildWatchArchiveBoardDecisionLedgerBridge = buildWatchArchiveBoardDecisionLedgerBridge;
window.buildWatchArchiveWarRoomResolutionTimelineBridge = buildWatchArchiveWarRoomResolutionTimelineBridge;
window.buildWatchArchiveExceptionClosureCertificateBridge = buildWatchArchiveExceptionClosureCertificateBridge;
window.buildWatchArchiveBoardActionFollowThroughBridge = buildWatchArchiveBoardActionFollowThroughBridge;
window.buildWatchArchiveWarRoomExitCriteriaBridge = buildWatchArchiveWarRoomExitCriteriaBridge;
window.buildWatchArchiveCertifiedExceptionArchiveBridge = buildWatchArchiveCertifiedExceptionArchiveBridge;
window.buildWatchArchiveBoardClosureMemoBridge = buildWatchArchiveBoardClosureMemoBridge;
window.buildWatchArchiveWarRoomStandDownChecklistBridge = buildWatchArchiveWarRoomStandDownChecklistBridge;
window.buildWatchArchiveCertifiedArchiveLedgerBridge = buildWatchArchiveCertifiedArchiveLedgerBridge;
window.buildWatchArchiveGovernanceClosureDashboardBridge = buildWatchArchiveGovernanceClosureDashboardBridge;
