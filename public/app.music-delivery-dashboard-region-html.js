function buildMusicDeliveryDashboardRegionLinkConclusionHtmlModule(deliveryDashboardState) {
  const regionLinkConclusionCard = buildWatchArchiveRegionLinkConclusionCard(
    deliveryDashboardState.probeSummary
  );
  const regionLinkTrendStrip = buildWatchArchiveRegionLinkTrendStrip(
    deliveryDashboardState.probeSummary
  );
  const linkStabilitySparkline = buildWatchArchiveLinkStabilitySparkline(
    deliveryDashboardState.probeHistory
  );
  const alertThresholdCards = buildWatchArchiveAlertThresholdCards(
    deliveryDashboardState.probeSummary,
    deliveryDashboardState.probeHistory
  );
  const routeComparisonMemo = buildWatchArchiveRouteComparisonMemo(
    deliveryDashboardState.probeSummary
  );
  const uptimeStrip = buildWatchArchiveUptimeStrip(deliveryDashboardState.probeHistory);
  const serverHealthCard = buildWatchArchiveServerHealthCard(deliveryDashboardState.probeSummary);
  const endpointLatencyMemo = buildWatchArchiveEndpointLatencyMemo(deliveryDashboardState.probeSummary);
  const serviceStatusStrip = buildWatchArchiveServiceStatusStrip(deliveryDashboardState.probeSummary);
  const certExpiryCard = buildWatchArchiveCertExpiryCard(deliveryDashboardState.probeSummary);
  const upstreamDependencyMemo = buildWatchArchiveUpstreamDependencyMemo(deliveryDashboardState.probeSummary);
  const httpStatusBreakdown = buildWatchArchiveHttpStatusBreakdown(deliveryDashboardState.probeSummary);
  const certRenewalCountdown = buildWatchArchiveCertRenewalCountdown(deliveryDashboardState.probeSummary);
  const serverIncidentLogStrip = buildWatchArchiveServerIncidentLogStrip(
    deliveryDashboardState.probeHistory
  );
  const onCallSummaryBanner = buildWatchArchiveOnCallSummaryBanner(
    deliveryDashboardState.probeSummary
  );
  const certRenewalActionCard = buildWatchArchiveCertRenewalActionCard(
    deliveryDashboardState.probeSummary
  );
  const onCallActionChecklist = buildWatchArchiveOnCallActionChecklist(
    deliveryDashboardState.probeSummary
  );
  const certValidationDrill = buildWatchArchiveCertValidationDrill(
    deliveryDashboardState.probeSummary
  );
  const incidentHandoffHistoryShelf = buildWatchArchiveIncidentHandoffHistoryShelf(
    deliveryDashboardState.probeHistory
  );
  const incidentTimelineCompare = buildWatchArchiveIncidentTimelineCompare(
    deliveryDashboardState.probeHistory,
    deliveryDashboardState.probeTimelineCompareA,
    deliveryDashboardState.probeTimelineCompareB
  );
  const operatorShiftSummary = buildWatchArchiveOperatorShiftSummary(
    deliveryDashboardState.probeSummary,
    deliveryDashboardState.probeOperatorNotes,
    deliveryDashboardState.probeHandoffAcknowledgments
  );
  const verdictDelta = buildWatchArchiveVerdictDelta(
    deliveryDashboardState.probeSummary,
    incidentTimelineCompare
  );
  const shiftCloseChecklist = buildWatchArchiveShiftCloseChecklist(
    deliveryDashboardState.probeSummary,
    deliveryDashboardState.probeOperatorNotes,
    deliveryDashboardState.probeHandoffAcknowledgments
  );
  const ackedHandoffLedger = buildWatchArchiveAckedHandoffLedger(
    deliveryDashboardState.probeHandoffAcknowledgments
  );
  const verdictDriftSparkline = buildWatchArchiveVerdictDriftSparkline(
    deliveryDashboardState.probeHistory
  );
  const shiftRiskBadge = buildWatchArchiveShiftRiskBadge(
    deliveryDashboardState.probeSummary,
    shiftCloseChecklist,
    verdictDriftSparkline
  );
  const handoffCompletenessScore = buildWatchArchiveHandoffCompletenessScore(
    deliveryDashboardState.probeOperatorNotes,
    deliveryDashboardState.probeHandoffAcknowledgments,
    deliveryDashboardState.probeExportReceipts
  );
  const verdictStabilitySummary = buildWatchArchiveVerdictStabilitySummary(
    deliveryDashboardState.probeHistory
  );
  const shiftExitRecommendation = buildWatchArchiveShiftExitRecommendation(
    shiftRiskBadge,
    shiftCloseChecklist
  );
  const handoffQualityBadge = buildWatchArchiveHandoffQualityBadge(
    handoffCompletenessScore,
    deliveryDashboardState.probeHandoffAcknowledgments
  );
  const verdictConfidenceCard = buildWatchArchiveVerdictConfidenceCard(
    deliveryDashboardState.probeSummary,
    verdictStabilitySummary,
    verdictDriftSparkline
  );
  const shiftBoardSnapshot = buildWatchArchiveShiftBoardSnapshot(
    deliveryDashboardState.probeSummary,
    shiftRiskBadge,
    shiftExitRecommendation,
    handoffQualityBadge,
    verdictConfidenceCard
  );
  const handoffReadinessBanner = buildWatchArchiveHandoffReadinessBanner(
    handoffCompletenessScore,
    handoffQualityBadge,
    shiftExitRecommendation
  );
  const confidenceTrendStrip = buildWatchArchiveConfidenceTrendStrip(
    deliveryDashboardState.probeHistory
  );
  const crossBorderAnomalyAlert = buildWatchArchiveCrossBorderAnomalyAlert(
    deliveryDashboardState.probeSummary
  );
  const shiftActionRail = buildWatchArchiveShiftActionRail(
    shiftRiskBadge,
    shiftExitRecommendation,
    crossBorderAnomalyAlert
  );
  const handoffSendGate = buildWatchArchiveHandoffSendGate(
    handoffReadinessBanner,
    shiftCloseChecklist
  );
  const confidenceFallbackHints = buildWatchArchiveConfidenceFallbackHints(
    verdictConfidenceCard,
    crossBorderAnomalyAlert,
    routeComparisonMemo
  );
  const shiftSendChecklist = buildWatchArchiveShiftSendChecklist(
    shiftCloseChecklist,
    handoffSendGate,
    deliveryDashboardState.probeOperatorNotes,
    deliveryDashboardState.probeExportReceipts
  );
  const handoffPacketPreview = buildWatchArchiveHandoffPacketPreview(
    deliveryDashboardState.probeSummary,
    deliveryDashboardState.probeHistory,
    deliveryDashboardState.probeOperatorNotes,
    deliveryDashboardState.probeHandoffAcknowledgments
  );
  const confidenceEscalationLadder = buildWatchArchiveConfidenceEscalationLadder(
    verdictConfidenceCard,
    shiftRiskBadge,
    crossBorderAnomalyAlert
  );
  const shiftSendButtonState = buildWatchArchiveShiftSendButtonState(
    handoffSendGate,
    shiftSendChecklist
  );
  const packetExportPreviewDiff = buildWatchArchivePacketExportPreviewDiff(
    handoffPacketPreview,
    deliveryDashboardState.probeExportReceipts
  );
  const escalationOwnerLane = buildWatchArchiveEscalationOwnerLane(
    confidenceEscalationLadder,
    crossBorderAnomalyAlert,
    shiftRiskBadge
  );
  const sendReadinessScore = buildWatchArchiveSendReadinessScore(
    shiftSendChecklist,
    handoffSendGate,
    handoffReadinessBanner
  );
  const packetDeltaSummaryChip = buildWatchArchivePacketDeltaSummaryChip(
    packetExportPreviewDiff
  );
  const escalationAckTracker = buildWatchArchiveEscalationAckTracker(
    escalationOwnerLane,
    deliveryDashboardState.probeHandoffAcknowledgments
  );
  const sendDecisionBanner = buildWatchArchiveSendDecisionBanner(
    sendReadinessScore,
    shiftSendButtonState,
    shiftExitRecommendation
  );
  const packetFreshnessStrip = buildWatchArchivePacketFreshnessStrip(
    deliveryDashboardState.probeExportReceipts
  );
  const escalationTimerCard = buildWatchArchiveEscalationTimerCard(
    deliveryDashboardState.probeHandoffAcknowledgments,
    escalationAckTracker
  );
  const shiftDispatchPanel = buildWatchArchiveShiftDispatchPanel(
    sendDecisionBanner,
    shiftSendButtonState,
    escalationAckTracker
  );
  const packetHandoffReceiptCard = buildWatchArchivePacketHandoffReceiptCard(
    deliveryDashboardState.probeExportReceipts,
    handoffPacketPreview
  );
  const escalationFollowUpPrompt = buildWatchArchiveEscalationFollowUpPrompt(
    escalationAckTracker,
    escalationOwnerLane
  );
  const dispatchOutcomeBadge = buildWatchArchiveDispatchOutcomeBadge(
    sendDecisionBanner,
    shiftSendButtonState
  );
  const receiptTimelineStrip = buildWatchArchiveReceiptTimelineStrip(
    deliveryDashboardState.probeExportReceipts
  );
  const followUpNoteTemplate = buildWatchArchiveFollowUpNoteTemplate(
    escalationFollowUpPrompt,
    escalationOwnerLane
  );
  const dispatchHistoryMiniLedger = buildWatchArchiveDispatchHistoryMiniLedger(
    deliveryDashboardState.probeDispatchHistory
  );
  const receiptCopyHistoryChip = buildWatchArchiveReceiptCopyHistoryChip(
    deliveryDashboardState.probeReceiptCopyHistory
  );
  const followUpSendReadyBadge = buildWatchArchiveFollowUpSendReadyBadge(
    deliveryDashboardState.probeFollowUpCopiedAt,
    escalationAckTracker
  );
  const receiptRecencyBadge = buildWatchArchiveReceiptRecencyBadge(
    deliveryDashboardState.probeReceiptCopiedAt
  );
  const followUpDeliveryNote = buildWatchArchiveFollowUpDeliveryNote(
    followUpNoteTemplate,
    escalationOwnerLane,
    followUpSendReadyBadge
  );
  const dispatchHandoffBundleCard = buildWatchArchiveDispatchHandoffBundleCard(
    dispatchHistoryMiniLedger,
    handoffPacketPreview,
    deliveryDashboardState.probeDispatchHistoryExportAt
  );
  const receiptStalenessAlert = buildWatchArchiveReceiptStalenessAlert(
    receiptRecencyBadge
  );
  const followUpDeliveryReceipt = buildWatchArchiveFollowUpDeliveryReceipt(
    deliveryDashboardState.probeFollowUpCopiedAt,
    followUpDeliveryNote,
    escalationAckTracker
  );
  return deliveryDashboardState.probeSummary
    ? `
        <div class="report-list">
          <div class="report-list-item">
            <div class="report-preview-title">Region Link Conclusion</div>
            <div class="report-card-copy">${escapeHtml(
              `${regionLinkConclusionCard.headline} · ${regionLinkConclusionCard.verdict}`
            )}</div>
            <div class="report-card-copy">${escapeHtml(regionLinkConclusionCard.summary)}</div>
            <div class="report-card-copy">${escapeHtml(regionLinkConclusionCard.note)}</div>
            <div class="report-card-copy">${escapeHtml(
              regionLinkConclusionCard.capturedAt
                ? dashboardCopy(
                    `Captured at ${regionLinkConclusionCard.capturedAt}`,
                    `探测时间 ${regionLinkConclusionCard.capturedAt}`
                  )
                : dashboardCopy("No probe timestamp yet.", "当前还没有探测时间。")
            )}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Region Link Trend Strip</div>
            ${
              regionLinkTrendStrip
                .map(
                  (item) => `<div class="report-list-item">
                      <div class="report-preview-title">${escapeHtml(item.target)}</div>
                      <div class="report-card-copy">${escapeHtml(
                        `${dashboardCopy("HTTP", "HTTP")} ${item.httpRate}% · ${dashboardCopy("TLS", "TLS")} ${item.tlsRate}% · ${dashboardCopy("Resets", "重置")} ${item.resetRate}%`
                      )}</div>
                    </div>`
                )
                .join("")
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Link Stability Sparkline</div>
            ${
              linkStabilitySparkline.length
                ? linkStabilitySparkline
                    .map(
                      (item) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(item.target)}</div>
                          <div class="report-card-copy">${escapeHtml(item.sparkline || "n/a")}</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              `Latest ${item.latest}% · Floor ${item.floor}% · Ceiling ${item.ceiling}%`,
                              `当前 ${item.latest}% · 最低 ${item.floor}% · 最高 ${item.ceiling}%`
                            )
                          )}</div>
                        </div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("Probe history is not available yet.", "探针历史暂时还不可用。")
                  )}</div>`
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Alert Threshold Cards</div>
            ${
              alertThresholdCards.length
                ? alertThresholdCards
                    .map(
                      (item) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(item.target)}</div>
                          <div class="report-card-copy">${escapeHtml(
                            `${item.level} · ${item.status}`
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(item.note)}</div>
                        </div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("Alert thresholds are waiting for probe data.", "告警阈值卡正在等待探针数据。")
                  )}</div>`
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">On-Call Summary Banner</div>
            <div class="report-card-copy">${escapeHtml(
              `${onCallSummaryBanner.level} · ${onCallSummaryBanner.headline}`
            )}</div>
            <div class="report-card-copy">${escapeHtml(onCallSummaryBanner.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Operator Shift Summary</div>
            <div class="report-card-copy">${escapeHtml(operatorShiftSummary.headline)}</div>
            <div class="report-card-copy">${escapeHtml(operatorShiftSummary.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Shift Board Snapshot</div>
            <div class="report-card-copy">${escapeHtml(shiftBoardSnapshot.headline)}</div>
            ${shiftBoardSnapshot.rows
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Shift Close Checklist</div>
            <div class="report-card-copy">${escapeHtml(shiftCloseChecklist.headline)}</div>
            ${shiftCloseChecklist.checklist
              .map(
                (item) => `<div class="report-card-copy">${escapeHtml(`${item.label} · ${item.state}`)}</div>`
              )
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Shift Risk Badge</div>
            <div class="report-card-copy">${escapeHtml(shiftRiskBadge.badge)}</div>
            <div class="report-card-copy">${escapeHtml(shiftRiskBadge.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Shift Exit Recommendation</div>
            <div class="report-card-copy">${escapeHtml(shiftExitRecommendation.headline)}</div>
            <div class="report-card-copy">${escapeHtml(shiftExitRecommendation.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Handoff Readiness Banner</div>
            <div class="report-card-copy">${escapeHtml(
              `${handoffReadinessBanner.level} · ${handoffReadinessBanner.headline}`
            )}</div>
            <div class="report-card-copy">${escapeHtml(handoffReadinessBanner.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Shift Action Rail</div>
            <div class="report-card-copy">${escapeHtml(shiftActionRail.headline)}</div>
            ${shiftActionRail.actions
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Handoff Send Gate</div>
            <div class="report-card-copy">${escapeHtml(
              `${handoffSendGate.status} · ${handoffSendGate.note}`
            )}</div>
            <div class="report-card-copy">${escapeHtml(handoffSendGate.detail)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Shift Send Checklist</div>
            <div class="report-card-copy">${escapeHtml(shiftSendChecklist.headline)}</div>
            ${shiftSendChecklist.checklist
              .map((item) => `<div class="report-card-copy">${escapeHtml(`${item.label} · ${item.state}`)}</div>`)
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Shift Send Button State</div>
            <div class="report-card-copy">${escapeHtml(
              `${shiftSendButtonState.state} · ${shiftSendButtonState.note}`
            )}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Send Decision Banner</div>
            <div class="report-card-copy">${escapeHtml(
              `${sendDecisionBanner.level} · ${sendDecisionBanner.headline}`
            )}</div>
            <div class="report-card-copy">${escapeHtml(sendDecisionBanner.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Send Readiness Score</div>
            <div class="report-card-copy">${escapeHtml(
              dashboardCopy(
                `Send readiness · ${sendReadinessScore.score}/100`,
                `发送准备度 · ${sendReadinessScore.score}/100`
              )
            )}</div>
            <div class="report-card-copy">${escapeHtml(sendReadinessScore.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Handoff Packet Preview</div>
            <div class="report-card-copy">${escapeHtml(handoffPacketPreview.headline)}</div>
            ${handoffPacketPreview.rows
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Packet Export Preview Diff</div>
            <div class="report-card-copy">${escapeHtml(packetExportPreviewDiff.headline)}</div>
            ${packetExportPreviewDiff.rows
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Packet Delta Summary Chip</div>
            <div class="report-card-copy">${escapeHtml(packetDeltaSummaryChip.chip)}</div>
            <div class="report-card-copy">${escapeHtml(packetDeltaSummaryChip.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Packet Freshness Strip</div>
            <div class="report-card-copy">${escapeHtml(packetFreshnessStrip.label)}</div>
            <div class="report-card-copy">${escapeHtml(packetFreshnessStrip.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Shift Dispatch Panel</div>
            <div class="report-card-copy">${escapeHtml(shiftDispatchPanel.headline)}</div>
            ${shiftDispatchPanel.rows
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Dispatch Outcome Badge</div>
            <div class="report-card-copy">${escapeHtml(dispatchOutcomeBadge.badge)}</div>
            <div class="report-card-copy">${escapeHtml(dispatchOutcomeBadge.note)}</div>
            <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
              <button class="report-export-action is-muted" type="button" data-delivery-probe-dispatch-done>${escapeHtml(
                dashboardCopy("Mark dispatch done", "标记发出完成")
              )}</button>
              <button class="report-export-action is-muted" type="button" data-delivery-probe-dispatch-history-export>${escapeHtml(
                dashboardCopy("Export dispatch history", "导出发出历史")
              )}</button>
            </div>
            ${
              deliveryDashboardState.probeDispatchDoneAt
                ? `<div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      `Last marked done at ${deliveryDashboardState.probeDispatchDoneAt}`,
                      `最近一次标记完成时间：${deliveryDashboardState.probeDispatchDoneAt}`
                    )
                  )}</div>`
                : ""
            }
            ${dispatchHistoryMiniLedger
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
            ${
              deliveryDashboardState.probeDispatchHistoryExportAt
                ? `<div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      `History exported at ${deliveryDashboardState.probeDispatchHistoryExportAt}`,
                      `历史导出时间：${deliveryDashboardState.probeDispatchHistoryExportAt}`
                    )
                  )}</div>`
                : ""
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Dispatch Handoff Bundle Card</div>
            <div class="report-card-copy">${escapeHtml(dispatchHandoffBundleCard.headline)}</div>
            ${dispatchHandoffBundleCard.rows
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Packet Handoff Receipt Card</div>
            <div class="report-card-copy">${escapeHtml(packetHandoffReceiptCard.headline)}</div>
            ${packetHandoffReceiptCard.rows
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Receipt Timeline Strip</div>
            ${receiptTimelineStrip
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
            <div class="report-card-copy">${escapeHtml(receiptCopyHistoryChip.chip)}</div>
            <div class="report-card-copy">${escapeHtml(receiptCopyHistoryChip.note)}</div>
            <div class="report-card-copy">${escapeHtml(receiptRecencyBadge.badge)}</div>
            <div class="report-card-copy">${escapeHtml(receiptRecencyBadge.note)}</div>
            <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
              <button class="report-export-action is-muted" type="button" data-delivery-probe-receipt-copy>${escapeHtml(
                dashboardCopy("Copy latest receipt", "复制最新回执")
              )}</button>
            </div>
            ${
              deliveryDashboardState.probeReceiptCopiedAt
                ? `<div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      `Receipt copied at ${deliveryDashboardState.probeReceiptCopiedAt}`,
                      `回执复制时间：${deliveryDashboardState.probeReceiptCopiedAt}`
                    )
                  )}</div>`
                : ""
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Receipt Staleness Alert</div>
            <div class="report-card-copy">${escapeHtml(
              `${receiptStalenessAlert.level} · ${receiptStalenessAlert.headline}`
            )}</div>
            <div class="report-card-copy">${escapeHtml(receiptStalenessAlert.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">On-Call Action Checklist</div>
            ${onCallActionChecklist
              .map(
                (item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`
              )
              .join("")}
            <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
              <textarea class="report-preview-code" data-delivery-probe-operator-notes placeholder="${escapeHtml(
                dashboardCopy("Write handoff notes for the next operator...", "给下一位值班人写交接备注...")
              )}">${escapeHtml(deliveryDashboardState.probeOperatorNotes || "")}</textarea>
            </div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Cross-Border Anomaly Alert</div>
            <div class="report-card-copy">${escapeHtml(
              `${crossBorderAnomalyAlert.level} · ${crossBorderAnomalyAlert.title}`
            )}</div>
            <div class="report-card-copy">${escapeHtml(crossBorderAnomalyAlert.summary)}</div>
            <div class="report-card-copy">${escapeHtml(crossBorderAnomalyAlert.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Route Comparison Memo</div>
            <div class="report-card-copy">${escapeHtml(routeComparisonMemo.headline)}</div>
            <div class="report-card-copy">${escapeHtml(routeComparisonMemo.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Uptime Strip</div>
            ${
              uptimeStrip.length
                ? uptimeStrip
                    .map(
                      (item) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(item.target)}</div>
                          <div class="report-card-copy">${escapeHtml(item.strip)}</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              `Historical uptime ${item.uptimePercent}%`,
                              `历史可用率 ${item.uptimePercent}%`
                            )
                          )}</div>
                        </div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("Uptime strip is waiting for probe history.", "可用率条正在等待探针历史。")
                  )}</div>`
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Server Health Card</div>
            <div class="report-card-copy">${escapeHtml(
              `${serverHealthCard.level} · ${serverHealthCard.title}`
            )}</div>
            <div class="report-card-copy">${escapeHtml(serverHealthCard.summary)}</div>
            <div class="report-card-copy">${escapeHtml(serverHealthCard.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Endpoint Latency Memo</div>
            <div class="report-card-copy">${escapeHtml(endpointLatencyMemo.headline)}</div>
            ${
              endpointLatencyMemo.rows.length
                ? endpointLatencyMemo.rows
                    .map(
                      (item) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(item.target)}</div>
                          <div class="report-card-copy">${escapeHtml(
                            dashboardCopy(
                              `total ${item.totalLatency}ms · connect ${item.connectLatency}ms`,
                              `总时延 ${item.totalLatency}ms · 建连 ${item.connectLatency}ms`
                            )
                          )}</div>
                        </div>`
                    )
                    .join("")
                : ""
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Service Status Strip</div>
            ${
              serviceStatusStrip.length
                ? serviceStatusStrip
                    .map(
                      (item) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(item.server)}</div>
                          <div class="report-card-copy">${escapeHtml(item.line)}</div>
                        </div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("Service status is not available yet.", "服务状态暂时不可用。")
                  )}</div>`
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Cert-Expiry Card</div>
            <div class="report-card-copy">${escapeHtml(
              `${certExpiryCard.level} · ${certExpiryCard.title}`
            )}</div>
            <div class="report-card-copy">${escapeHtml(certExpiryCard.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Upstream Dependency Memo</div>
            <div class="report-card-copy">${escapeHtml(upstreamDependencyMemo.headline)}</div>
            <div class="report-card-copy">${escapeHtml(upstreamDependencyMemo.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">HTTP Status Breakdown</div>
            ${
              httpStatusBreakdown.length
                ? httpStatusBreakdown
                    .map(
                      (item) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(item.target)}</div>
                          <div class="report-card-copy">${escapeHtml(item.line)}</div>
                        </div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("HTTP status breakdown is not available yet.", "HTTP 状态码分布暂时不可用。")
                  )}</div>`
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Cert Renewal Countdown</div>
            <div class="report-card-copy">${escapeHtml(certRenewalCountdown.band)}</div>
            <div class="report-card-copy">${escapeHtml(certRenewalCountdown.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Cert Renewal Action Card</div>
            <div class="report-card-copy">${escapeHtml(certRenewalActionCard.title)}</div>
            <div class="report-card-copy">${escapeHtml(certRenewalActionCard.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Cert Validation Drill</div>
            ${certValidationDrill
              .map(
                (item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`
              )
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Server Incident Log Strip</div>
            ${
              serverIncidentLogStrip.length
                ? serverIncidentLogStrip
                    .map(
                      (item) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(
                            item.capturedAt || dashboardCopy("unknown time", "未知时间")
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(item.label)}</div>
                          <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                        </div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("No incident history is available yet.", "当前还没有异常历史。")
                  )}</div>`
            }
            <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
              <button class="report-export-action is-muted" type="button" data-delivery-probe-incident-export>${escapeHtml(
                dashboardCopy("Export incident bundle", "导出异常交接包")
              )}</button>
              <button class="report-export-action is-muted" type="button" data-delivery-probe-handoff-ack>${escapeHtml(
                dashboardCopy("Acknowledge handoff", "确认已接班")
              )}</button>
            </div>
            ${
              deliveryDashboardState.probeExportReceipts.length
                ? `<div class="report-list-item">
                    <div class="report-preview-title">${escapeHtml(
                      dashboardCopy("Handoff export receipts", "交接导出回执")
                    )}</div>
                    ${deliveryDashboardState.probeExportReceipts
                      .slice(-6)
                      .reverse()
                      .map(
                        (item) => `<div class="report-card-copy">${escapeHtml(
                          `${item.at} · ${item.fileName}`
                        )}</div>`
                      )
                      .join("")}
                  </div>`
                : ""
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Incident Handoff History Shelf</div>
            ${
              incidentHandoffHistoryShelf.length
                ? incidentHandoffHistoryShelf
                    .map(
                      (item) => `<div class="report-list-item">
                          <div class="report-preview-title">${escapeHtml(
                            item.capturedAt || dashboardCopy("unknown time", "未知时间")
                          )}</div>
                          <div class="report-card-copy">${escapeHtml(item.verdict)}</div>
                          <div class="report-card-copy">${escapeHtml(item.summary)}</div>
                        </div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("No handoff history is available yet.", "当前还没有交接历史。")
                  )}</div>`
            }
            ${
              deliveryDashboardState.probeHandoffAcknowledgments.length
                ? `<div class="report-list-item">
                    <div class="report-preview-title">${escapeHtml(
                      dashboardCopy("Handoff acknowledgments", "接班确认记录")
                    )}</div>
                    ${deliveryDashboardState.probeHandoffAcknowledgments
                      .slice(-6)
                      .reverse()
                      .map(
                        (item) => `<div class="report-card-copy">${escapeHtml(
                          `${item.at} · ${item.note || dashboardCopy("acknowledged", "已确认接班")}`
                        )}</div>`
                      )
                      .join("")}
                  </div>`
                : ""
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Acked Handoff Ledger</div>
            <div class="report-card-copy">${escapeHtml(
              dashboardCopy(
                `${ackedHandoffLedger.count} total handoff acknowledgments recorded.`,
                `累计记录了 ${ackedHandoffLedger.count} 次接班确认。`
              )
            )}</div>
            <div class="report-card-copy">${escapeHtml(
              dashboardCopy(
                `Handoff completeness score: ${handoffCompletenessScore.score}/100`,
                `交接完整度：${handoffCompletenessScore.score}/100`
              )
            )}</div>
            <div class="report-card-copy">${escapeHtml(handoffCompletenessScore.note)}</div>
            <div class="report-card-copy">${escapeHtml(
              dashboardCopy(
                `Handoff quality: ${handoffQualityBadge.badge}`,
                `交接质量：${handoffQualityBadge.badge}`
              )
            )}</div>
            <div class="report-card-copy">${escapeHtml(handoffQualityBadge.note)}</div>
            ${
              ackedHandoffLedger.rows.length
                ? ackedHandoffLedger.rows
                    .map(
                      (item) => `<div class="report-card-copy">${escapeHtml(
                        `${item.at} · ${item.note || dashboardCopy("acknowledged", "已确认接班")}`
                      )}</div>`
                    )
                    .join("")
                : `<div class="report-empty">${escapeHtml(
                    dashboardCopy("No handoff acknowledgments yet.", "当前还没有接班确认记录。")
                  )}</div>`
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Incident Timeline Compare</div>
            <div class="report-card-copy">${escapeHtml(incidentTimelineCompare.summary)}</div>
            <div class="report-card-copy">${escapeHtml(verdictDelta.headline)}</div>
            ${
              incidentTimelineCompare.entries.length
                ? `<div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
                    <select class="billing-input" data-delivery-probe-compare-select="A">
                      ${incidentTimelineCompare.entries
                        .map(
                          (item) => `<option value="${escapeHtml(item.id)}"${
                            incidentTimelineCompare.a?.id === item.id ? " selected" : ""
                          }>${escapeHtml(item.capturedAt || item.id)}</option>`
                        )
                        .join("")}
                    </select>
                    <select class="billing-input" data-delivery-probe-compare-select="B">
                      ${incidentTimelineCompare.entries
                        .map(
                          (item) => `<option value="${escapeHtml(item.id)}"${
                            incidentTimelineCompare.b?.id === item.id ? " selected" : ""
                          }>${escapeHtml(item.capturedAt || item.id)}</option>`
                        )
                        .join("")}
                    </select>
                  </div>`
                : ""
            }
            ${
              incidentTimelineCompare.a && incidentTimelineCompare.b
                ? `<div class="report-list-item">
                    <div class="report-preview-title">${escapeHtml(
                      dashboardCopy("Sample A", "样本 A")
                    )}</div>
                    <div class="report-card-copy">${escapeHtml(
                      `${incidentTimelineCompare.a.capturedAt} · ${incidentTimelineCompare.a.verdict}`
                    )}</div>
                    <div class="report-card-copy">${escapeHtml(
                      incidentTimelineCompare.a.summary
                    )}</div>
                    <div class="report-preview-title" style="margin-top:8px;">${escapeHtml(
                      dashboardCopy("Sample B", "样本 B")
                    )}</div>
                    <div class="report-card-copy">${escapeHtml(
                      `${incidentTimelineCompare.b.capturedAt} · ${incidentTimelineCompare.b.verdict}`
                    )}</div>
                    <div class="report-card-copy">${escapeHtml(
                      incidentTimelineCompare.b.summary
                    )}</div>
                  </div>`
                : ""
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Verdict Drift Sparkline</div>
            <div class="report-card-copy">${escapeHtml(verdictDriftSparkline.sparkline || "·")}</div>
            <div class="report-card-copy">${escapeHtml(verdictDriftSparkline.note)}</div>
            <div class="report-card-copy">${escapeHtml(verdictStabilitySummary.headline)}</div>
            <div class="report-card-copy">${escapeHtml(verdictStabilitySummary.note)}</div>
            <div class="report-card-copy">${escapeHtml(
              dashboardCopy(
                `Confidence trend: ${confidenceTrendStrip.trend}`,
                `把握度趋势：${confidenceTrendStrip.trend}`
              )
            )}</div>
            <div class="report-card-copy">${escapeHtml(confidenceTrendStrip.strip || "·")}</div>
            <div class="report-card-copy">${escapeHtml(confidenceTrendStrip.note)}</div>
            <div class="report-card-copy">${escapeHtml(
              dashboardCopy(
                `Verdict confidence: ${verdictConfidenceCard.confidence}`,
                `结论把握度：${verdictConfidenceCard.confidence}`
              )
            )}</div>
            <div class="report-card-copy">${escapeHtml(verdictConfidenceCard.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Confidence Fallback Hints</div>
            <div class="report-card-copy">${escapeHtml(confidenceFallbackHints.headline)}</div>
            ${confidenceFallbackHints.hints
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Confidence Escalation Ladder</div>
            <div class="report-card-copy">${escapeHtml(
              dashboardCopy(
                `Escalation lane · ${confidenceEscalationLadder.lane}`,
                `升级路径 · ${confidenceEscalationLadder.lane}`
              )
            )}</div>
            ${confidenceEscalationLadder.steps
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Escalation Owner Lane</div>
            <div class="report-card-copy">${escapeHtml(
              dashboardCopy(
                `Suggested owner · ${escalationOwnerLane.owner}`,
                `建议接手人 · ${escalationOwnerLane.owner}`
              )
            )}</div>
            <div class="report-card-copy">${escapeHtml(escalationOwnerLane.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Escalation Ack Tracker</div>
            <div class="report-card-copy">${escapeHtml(
              `${escalationAckTracker.state} · ${escalationAckTracker.note}`
            )}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Escalation Timer Card</div>
            <div class="report-card-copy">${escapeHtml(
              `${escalationTimerCard.state} · ${escalationTimerCard.note}`
            )}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Escalation Follow-Up Prompt</div>
            <div class="report-card-copy">${escapeHtml(escalationFollowUpPrompt.headline)}</div>
            <div class="report-card-copy">${escapeHtml(escalationFollowUpPrompt.note)}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Follow-Up Note Template</div>
            <div class="report-card-copy">${escapeHtml(followUpNoteTemplate.note)}</div>
            <div class="report-card-copy">${escapeHtml(followUpSendReadyBadge.badge)}</div>
            <div class="report-card-copy">${escapeHtml(followUpSendReadyBadge.note)}</div>
            <div class="report-preview-title" style="margin-top:8px;">${escapeHtml(
              dashboardCopy("Follow-Up Delivery Note", "跟进交接备注")
            )}</div>
            <div class="report-card-copy">${escapeHtml(followUpDeliveryNote.headline)}</div>
            <div class="report-card-copy">${escapeHtml(followUpDeliveryNote.body)}</div>
            <div class="report-export-actions" style="flex-wrap:wrap; margin-top:8px;">
              <button class="report-export-action is-muted" type="button" data-delivery-probe-followup-copy="${escapeHtml(
                followUpDeliveryNote.body
              )}">${escapeHtml(
                dashboardCopy("Copy follow-up note", "复制跟进备注")
              )}</button>
            </div>
            ${
              deliveryDashboardState.probeFollowUpCopiedAt
                ? `<div class="report-card-copy">${escapeHtml(
                    dashboardCopy(
                      `Follow-up copied at ${deliveryDashboardState.probeFollowUpCopiedAt}`,
                      `跟进备注复制时间：${deliveryDashboardState.probeFollowUpCopiedAt}`
                    )
                  )}</div>`
                : ""
            }
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">Follow-Up Delivery Receipt</div>
            <div class="report-card-copy">${escapeHtml(followUpDeliveryReceipt.headline)}</div>
            ${followUpDeliveryReceipt.rows
              .map((item) => `<div class="report-card-copy">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
        </div>
      `
    : `<div class="report-empty">${escapeHtml(
        deliveryDashboardState.probeError ||
          dashboardCopy("Region link probe summary is not available yet.", "地区链路探针摘要暂时不可用。")
      )}</div>`;
}

window.buildMusicDeliveryDashboardRegionLinkConclusionHtmlModule = buildMusicDeliveryDashboardRegionLinkConclusionHtmlModule;
