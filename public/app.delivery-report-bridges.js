function renderDigestMetrics(metrics) {
  return globalThis.renderDigestMetricsModule?.(metrics) ?? "";
}

function severityLabel(value) {
  return globalThis.severityLabelModule?.(value) ?? "";
}

function renderDigestPreview(items) {
  return globalThis.renderDigestPreviewModule?.(items) ?? "";
}

function renderDigestInboxCounts(dashboard, digest) {
  return globalThis.renderDigestInboxCountsModule?.(dashboard, digest) ?? "";
}

function renderDigestAlerts(alerts, digest) {
  return globalThis.renderDigestAlertsModule?.(alerts, digest) ?? "";
}

function renderDeliveryDigestSummary(bundle) {
  return globalThis.renderDeliveryDigestSummaryModule?.(bundle) ?? null;
}

function renderDeliveryDigestError(message) {
  return globalThis.renderDeliveryDigestErrorModule?.(message) ?? null;
}

function renderDigestBundleState(bundle) {
  return globalThis.renderDigestBundleStateModule?.(bundle) ?? null;
}

function formatReportKindLabel(kind) {
  return globalThis.formatReportKindLabelModule?.(kind) ?? "";
}

function reportSeverityClass(severity) {
  return globalThis.reportSeverityClassModule?.(severity) ?? "";
}

function exportTargetFromReportKind(kind) {
  return globalThis.exportTargetFromReportKindModule?.(kind) ?? "dashboard";
}

function exportFileExtension(format) {
  return globalThis.exportFileExtensionModule?.(format) ?? "txt";
}

function currentExportFileName() {
  return globalThis.currentExportFileNameModule?.() ?? "delivery_export.txt";
}

function previewExportBodyLines(result) {
  return globalThis.previewExportBodyLinesModule?.(result) ?? [];
}

function currentExportResultBody() {
  return globalThis.currentExportResultBodyModule?.() ?? "";
}

async function copyDeliveryExportBody() {
  return (await globalThis.copyDeliveryExportBodyModule?.()) ?? false;
}

function downloadDeliveryExportBody() {
  return globalThis.downloadDeliveryExportBodyModule?.() ?? false;
}

function triggerDownloadBlob(blob, fileName) {
  return globalThis.triggerDownloadBlobModule?.(blob, fileName) ?? false;
}

function downloadHistoryExportBody(itemId) {
  return globalThis.downloadHistoryExportBodyModule?.(itemId) ?? false;
}

async function copyHistoryExportBody(itemId) {
  return (await globalThis.copyHistoryExportBodyModule?.(itemId)) ?? false;
}

function restoreHistoryExportResult(itemId) {
  return globalThis.restoreHistoryExportResultModule?.(itemId) ?? false;
}

function summarizeBundle(bundle) {
  return globalThis.summarizeBundleModule?.(bundle) ?? [];
}

function historyItemTimestamp(item) {
  return globalThis.historyItemTimestampModule?.(item) ?? 0;
}

function latestDeliveryExportHistoryItemId() {
  return globalThis.latestDeliveryExportHistoryItemIdModule?.() ?? "";
}

function loadDeliveryExportHistory() {
  return globalThis.loadDeliveryExportHistoryModule?.() ?? [];
}

function persistDeliveryExportHistory() {
  return globalThis.persistDeliveryExportHistoryModule?.() ?? false;
}

function pushDeliveryExportHistoryItem(result) {
  return globalThis.pushDeliveryExportHistoryItemModule?.(result) ?? null;
}

function historyBodyLines(item) {
  return globalThis.historyBodyLinesModule?.(item) ?? "";
}

function exportBodyStats(body) {
  return globalThis.exportBodyStatsModule?.(body) ?? { bytes: 0, lines: 0 };
}

function deliveryReportKindLabel(kind) {
  return globalThis.deliveryReportKindLabelModule?.(kind) ?? "";
}

function latestDeliveryExportHistoryItem() {
  return globalThis.latestDeliveryExportHistoryItemModule?.() ?? null;
}

function filteredDeliveryExportHistoryItems() {
  return globalThis.filteredDeliveryExportHistoryItemsModule?.() ?? [];
}

function toggleHistorySelection(itemId) {
  return globalThis.toggleHistorySelectionModule?.(itemId) ?? false;
}

function selectAllFilteredHistoryItems() {
  return globalThis.selectAllFilteredHistoryItemsModule?.() ?? false;
}

function clearHistorySelection() {
  return globalThis.clearHistorySelectionModule?.() ?? false;
}

function clearDeliveryExportHistory() {
  return globalThis.clearDeliveryExportHistoryModule?.() ?? false;
}

function toggleDeliveryExportHistoryPin(itemId) {
  return globalThis.toggleDeliveryExportHistoryPinModule?.(itemId) ?? false;
}

function deleteDeliveryExportHistoryItem(itemId) {
  return globalThis.deleteDeliveryExportHistoryItemModule?.(itemId) ?? false;
}

function deleteSelectedDeliveryExportHistoryItems() {
  return globalThis.deleteSelectedDeliveryExportHistoryItemsModule?.() ?? false;
}

function downloadSelectedDeliveryExportHistoryItems() {
  return globalThis.downloadSelectedDeliveryExportHistoryItemsModule?.() ?? false;
}

function focusDeliveryQueue(queueKey) {
  activeDigestQueueKey = String(queueKey || "");
  openPanel(cssmvPanel);
  return loadDeliveryDigestBundle().then((bundle) => {
    renderDeliveryDigestSummary(bundle);
    return bundle;
  });
}

function attachReportQueueJumpHandlers() {
  return globalThis.attachReportQueueJumpHandlersModule?.();
}

function renderDeliveryReportTabs() {
  return globalThis.renderDeliveryReportTabsModule?.() ?? "";
}

function renderReportHeader(response) {
  return globalThis.renderReportHeaderModule?.(response) ?? "";
}

function renderMetricGrid(metrics) {
  return globalThis.renderMetricGridModule?.(metrics) ?? "";
}

function renderStringList(items, emptyLabel = t("reports.empty")) {
  return globalThis.renderStringListModule?.(items, emptyLabel) ?? "";
}

function renderDashboardReport(dashboard) {
  return globalThis.renderDashboardReportModule?.(dashboard) ?? "";
}

function renderKpiReport(kpi) {
  return globalThis.renderKpiReportModule?.(kpi) ?? "";
}

function renderAnalyticsReport(analytics) {
  return globalThis.renderAnalyticsReportModule?.(analytics) ?? "";
}

function renderTrendsReport(trends) {
  return globalThis.renderTrendsReportModule?.(trends) ?? "";
}

function renderAlertsReport(alerts) {
  return globalThis.renderAlertsReportModule?.(alerts) ?? "";
}

function formatOpsHealthStatus(status) {
  return globalThis.formatOpsHealthStatusModule?.(status) ?? "";
}

function opsHealthBadgeClass(status) {
  return globalThis.opsHealthBadgeClassModule?.(status) ?? "";
}

function renderOpsHealthOverviewList(report) {
  return globalThis.renderOpsHealthOverviewListModule?.(report) ?? "";
}

function formatOpsProbeStatus(status) {
  return globalThis.formatOpsProbeStatusModule?.(status) ?? "";
}

function renderOpsProbeList(report) {
  return globalThis.renderOpsProbeListModule?.(report) ?? "";
}

function countOpsProbeStatuses(report) {
  return globalThis.countOpsProbeStatusesModule?.(report) ?? {};
}

function renderDigestProbeSummaryCard(digest) {
  return globalThis.renderDigestProbeSummaryCardModule?.(digest) ?? "";
}

function renderOpsHealthCard(report) {
  return globalThis.renderOpsHealthCardModule?.(report) ?? "";
}

function renderOpsHealthStandaloneReport(report) {
  return globalThis.renderOpsHealthStandaloneReportModule?.(report) ?? "";
}

function renderDigestReport(digest) {
  return globalThis.renderDigestReportModule?.(digest) ?? "";
}

function renderBriefingReport(briefing) {
  return globalThis.renderBriefingReportModule?.(briefing) ?? "";
}

Object.assign(globalThis, {
  renderDigestMetrics,
  severityLabel,
  renderDigestPreview,
  renderDigestInboxCounts,
  renderDigestAlerts,
  renderDeliveryDigestSummary,
  renderDeliveryDigestError,
  renderDigestBundleState,
  formatReportKindLabel,
  reportSeverityClass,
  exportTargetFromReportKind,
  exportFileExtension,
  currentExportFileName,
  previewExportBodyLines,
  currentExportResultBody,
  copyDeliveryExportBody,
  downloadDeliveryExportBody,
  triggerDownloadBlob,
  downloadHistoryExportBody,
  copyHistoryExportBody,
  restoreHistoryExportResult,
  summarizeBundle,
  historyItemTimestamp,
  latestDeliveryExportHistoryItemId,
  loadDeliveryExportHistory,
  persistDeliveryExportHistory,
  pushDeliveryExportHistoryItem,
  historyBodyLines,
  exportBodyStats,
  deliveryReportKindLabel,
  latestDeliveryExportHistoryItem,
  filteredDeliveryExportHistoryItems,
  toggleHistorySelection,
  selectAllFilteredHistoryItems,
  clearHistorySelection,
  clearDeliveryExportHistory,
  toggleDeliveryExportHistoryPin,
  deleteDeliveryExportHistoryItem,
  deleteSelectedDeliveryExportHistoryItems,
  downloadSelectedDeliveryExportHistoryItems,
  focusDeliveryQueue,
  attachReportQueueJumpHandlers,
  renderDeliveryReportTabs,
  renderReportHeader,
  renderMetricGrid,
  renderStringList,
  renderDashboardReport,
  renderKpiReport,
  renderAnalyticsReport,
  renderTrendsReport,
  renderAlertsReport,
  formatOpsHealthStatus,
  opsHealthBadgeClass,
  renderOpsHealthOverviewList,
  formatOpsProbeStatus,
  renderOpsProbeList,
  countOpsProbeStatuses,
  renderDigestProbeSummaryCard,
  renderOpsHealthCard,
  renderOpsHealthStandaloneReport,
  renderDigestReport,
  renderBriefingReport
});
