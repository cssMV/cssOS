function exportTargetFromReportKindModule(kind) {
  switch (kind) {
    case "dashboard":
      return "dashboard";
    case "ops_health":
      return "ops_health";
    case "kpi":
      return "kpi";
    case "analytics":
      return "analytics";
    case "trends":
      return "trends";
    case "alerts":
      return "alerts";
    case "digest":
      return "digest";
    case "briefing_pack":
      return "briefing";
    default:
      return "dashboard";
  }
}

function exportFileExtensionModule(format) {
  switch (format) {
    case "json_package":
      return "json";
    case "csv":
      return "csv";
    case "briefing_text":
      return "txt";
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    default:
      return "txt";
  }
}

function currentExportFileNameModule() {
  const day = new Date().toISOString().slice(0, 10);
  const target =
    deliveryExportState.source === "report_bundle"
      ? "report_bundle"
      : exportTargetFromReportKindModule(deliveryReportState.kind);
  return `delivery_${target}_${day}.${exportFileExtensionModule(deliveryExportState.format)}`;
}

function previewExportBodyLinesModule(result) {
  const body = String(result?.body || "");
  return body.split("\n").slice(0, 6).filter(Boolean);
}

function summarizeBundleModule(bundle) {
  if (!bundle) return [];
  const sections = [
    bundle.dashboard ? `dashboard: ${bundle.dashboard.metrics?.length || 0} metrics` : null,
    bundle.ops_health ? `ops health: ${bundle.ops_health.reasons?.length || 0} reasons` : null,
    bundle.kpi ? `kpi: ${bundle.kpi.metrics?.length || 0} metrics` : null,
    bundle.analytics ? `analytics: ${bundle.analytics.insights?.length || 0} insights` : null,
    bundle.trends ? `trends: ${bundle.trends.series?.length || 0} series` : null,
    bundle.alerts ? `alerts: ${bundle.alerts.alerts?.length || 0} alerts` : null,
    bundle.digest ? `digest: ${bundle.digest.highlights?.length || 0} highlights` : null,
    bundle.briefing ? `briefing: ${bundle.briefing.highlights?.length || 0} highlights` : null
  ].filter(Boolean);
  return sections;
}

function historyItemTimestampModule(item) {
  const value = Date.parse(item?.created_at || "");
  return Number.isFinite(value) ? value : 0;
}

function historyBodyLinesModule(item) {
  return String(item?.body || "")
    .split("\n")
    .slice(0, 3)
    .filter(Boolean)
    .join(" ");
}

function exportBodyStatsModule(body) {
  const text = String(body || "");
  return {
    bytes: new TextEncoder().encode(text).length,
    lines: text ? text.split("\n").length : 0
  };
}

window.exportTargetFromReportKindModule = exportTargetFromReportKindModule;
window.exportFileExtensionModule = exportFileExtensionModule;
window.currentExportFileNameModule = currentExportFileNameModule;
window.previewExportBodyLinesModule = previewExportBodyLinesModule;
window.summarizeBundleModule = summarizeBundleModule;
window.historyItemTimestampModule = historyItemTimestampModule;
window.historyBodyLinesModule = historyBodyLinesModule;
window.exportBodyStatsModule = exportBodyStatsModule;

function latestDeliveryExportHistoryItemIdModule() {
  const items = Array.isArray(deliveryExportHistoryState.items) ? deliveryExportHistoryState.items : [];
  if (!items.length) return "";
  return items.reduce((latest, item) => {
    if (!latest) return item;
    return historyItemTimestampModule(item) > historyItemTimestampModule(latest) ? item : latest;
  }, null)?.id || "";
}

function latestDeliveryExportHistoryItemModule() {
  const itemId = latestDeliveryExportHistoryItemIdModule();
  if (!itemId) return null;
  return deliveryExportHistoryState.items.find((item) => item.id === itemId) || null;
}

function filteredDeliveryExportHistoryItemsModule() {
  const items = Array.isArray(deliveryExportHistoryState.items) ? deliveryExportHistoryState.items : [];
  return items.filter((item) => {
    if (deliveryExportHistoryState.filter === "pinned" && !item?.pinned) return false;
    if (deliveryExportHistoryState.filter === "report_item" && item?.source !== "report_item") return false;
    if (deliveryExportHistoryState.filter === "report_bundle" && item?.source !== "report_bundle") return false;
    if (deliveryExportHistoryState.format !== "all" && item?.format !== deliveryExportHistoryState.format) return false;
    if (deliveryExportHistoryState.reportKind !== "all" && item?.report_kind !== deliveryExportHistoryState.reportKind) return false;
    const query = String(deliveryExportHistoryState.search || "").trim().toLowerCase();
    if (!query) return true;
    const haystack = [
      item?.file_name,
      item?.content_type,
      item?.report_kind,
      item?.format,
      item?.body
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  }).sort((a, b) => {
    const pinnedDelta = Number(Boolean(b?.pinned)) - Number(Boolean(a?.pinned));
    if (pinnedDelta !== 0) return pinnedDelta;
    const timeDelta = historyItemTimestampModule(b) - historyItemTimestampModule(a);
    return deliveryExportHistoryState.sort === "oldest" ? -timeDelta : timeDelta;
  });
}

window.latestDeliveryExportHistoryItemIdModule = latestDeliveryExportHistoryItemIdModule;
window.latestDeliveryExportHistoryItemModule = latestDeliveryExportHistoryItemModule;
window.filteredDeliveryExportHistoryItemsModule = filteredDeliveryExportHistoryItemsModule;

function toggleHistorySelectionModule(itemId) {
  const selected = new Set(deliveryExportHistoryState.selectedIds || []);
  if (selected.has(itemId)) selected.delete(itemId);
  else selected.add(itemId);
  deliveryExportHistoryState.selectedIds = Array.from(selected);
  renderDeliveryExportPanel();
}

function selectAllFilteredHistoryItemsModule() {
  deliveryExportHistoryState.selectedIds = filteredDeliveryExportHistoryItemsModule().map((item) => item.id);
  renderDeliveryExportPanel();
}

function clearHistorySelectionModule() {
  deliveryExportHistoryState.selectedIds = [];
  renderDeliveryExportPanel();
  showToast(t("reports.export.historySelectionCleared"));
}

function clearDeliveryExportHistoryModule() {
  deliveryExportHistoryState.items = deliveryExportHistoryState.items.filter((item) => item?.pinned);
  deliveryExportHistoryState.selectedIds = [];
  persistDeliveryExportHistory();
  renderDeliveryExportPanel();
  showToast(t("reports.export.historyCleared"));
}

function toggleDeliveryExportHistoryPinModule(itemId) {
  deliveryExportHistoryState.items = deliveryExportHistoryState.items.map((item) =>
    item.id === itemId ? { ...item, pinned: !item.pinned } : item
  );
  persistDeliveryExportHistory();
  renderDeliveryExportPanel();
}

function deleteDeliveryExportHistoryItemModule(itemId) {
  deliveryExportHistoryState.items = deliveryExportHistoryState.items.filter((item) => item.id !== itemId);
  deliveryExportHistoryState.selectedIds = deliveryExportHistoryState.selectedIds.filter((id) => id !== itemId);
  persistDeliveryExportHistory();
  renderDeliveryExportPanel();
  showToast(t("reports.export.historyDeleted"));
}

function deleteSelectedDeliveryExportHistoryItemsModule() {
  const selected = new Set(deliveryExportHistoryState.selectedIds || []);
  if (!selected.size) return;
  deliveryExportHistoryState.items = deliveryExportHistoryState.items.filter(
    (item) => item?.pinned || !selected.has(item.id)
  );
  deliveryExportHistoryState.selectedIds = [];
  persistDeliveryExportHistory();
  renderDeliveryExportPanel();
  showToast(t("reports.export.historyDeleted"));
}

function downloadSelectedDeliveryExportHistoryItemsModule() {
  const selected = new Set(deliveryExportHistoryState.selectedIds || []);
  if (!selected.size) return;
  const items = filteredDeliveryExportHistoryItemsModule().filter((item) => selected.has(item.id));
  if (!items.length) return;
  const body = items
    .map((item, index) => {
      const header = [
        `# ${index + 1}. ${item.file_name || "delivery_export.txt"}`,
        `source: ${item.source || "report_item"}`,
        `report_kind: ${item.report_kind || "unknown"}`,
        `format: ${item.format || "unknown"}`,
        `created_at: ${item.created_at || ""}`
      ].join("\n");
      return `${header}\n\n${item.body || ""}`;
    })
    .join("\n\n==============================\n\n");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([body], { type: "text/plain" });
  triggerDownloadBlob(blob, `delivery_export_bundle_${stamp}.txt`);
  showToast(t("reports.export.historyBundleDownloaded"));
}

window.toggleHistorySelectionModule = toggleHistorySelectionModule;
window.selectAllFilteredHistoryItemsModule = selectAllFilteredHistoryItemsModule;
window.clearHistorySelectionModule = clearHistorySelectionModule;
window.clearDeliveryExportHistoryModule = clearDeliveryExportHistoryModule;
window.toggleDeliveryExportHistoryPinModule = toggleDeliveryExportHistoryPinModule;
window.deleteDeliveryExportHistoryItemModule = deleteDeliveryExportHistoryItemModule;
window.deleteSelectedDeliveryExportHistoryItemsModule = deleteSelectedDeliveryExportHistoryItemsModule;
window.downloadSelectedDeliveryExportHistoryItemsModule = downloadSelectedDeliveryExportHistoryItemsModule;

function currentExportResultBodyModule() {
  return String(deliveryExportState.result?.body || "");
}

async function copyDeliveryExportBodyModule() {
  const body = currentExportResultBodyModule();
  if (!body) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(body);
      showToast(t("reports.export.copyDone"));
      return;
    }
  } catch {}
  const fallback = document.createElement("textarea");
  fallback.value = body;
  document.body.appendChild(fallback);
  fallback.select();
  document.execCommand("copy");
  fallback.remove();
  showToast(t("reports.export.copyDone"));
}

function triggerDownloadBlobModule(blob, fileName) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName || "delivery_export.txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function downloadDeliveryExportBodyModule() {
  if (!deliveryExportState.result?.body) return;
  const blob = new Blob([deliveryExportState.result.body], {
    type: deliveryExportState.result.content_type || "text/plain"
  });
  triggerDownloadBlobModule(blob, deliveryExportState.result.file_name || currentExportFileNameModule());
}

function downloadHistoryExportBodyModule(itemId) {
  const item = deliveryExportHistoryState.items.find((entry) => entry.id === itemId);
  if (!item?.body) return;
  const blob = new Blob([item.body], { type: item.content_type || "text/plain" });
  triggerDownloadBlobModule(blob, item.file_name || "delivery_export.txt");
}

async function copyHistoryExportBodyModule(itemId) {
  const item = deliveryExportHistoryState.items.find((entry) => entry.id === itemId);
  if (!item?.body) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(item.body);
      showToast(t("reports.export.copyDone"));
      return;
    }
  } catch {}
  const fallback = document.createElement("textarea");
  fallback.value = item.body;
  document.body.appendChild(fallback);
  fallback.select();
  document.execCommand("copy");
  fallback.remove();
  showToast(t("reports.export.copyDone"));
}

function restoreHistoryExportResultModule(itemId) {
  const item = deliveryExportHistoryState.items.find((entry) => entry.id === itemId);
  if (!item) return;
  deliveryExportState.result = {
    file_name: item.file_name,
    content_type: item.content_type,
    body: item.body,
    format: item.format,
    report_kind: item.report_kind
  };
  deliveryExportState.previewExpanded = false;
  renderDeliveryExportPanel();
}

window.currentExportResultBodyModule = currentExportResultBodyModule;
window.copyDeliveryExportBodyModule = copyDeliveryExportBodyModule;
window.triggerDownloadBlobModule = triggerDownloadBlobModule;
window.downloadDeliveryExportBodyModule = downloadDeliveryExportBodyModule;
window.downloadHistoryExportBodyModule = downloadHistoryExportBodyModule;
window.copyHistoryExportBodyModule = copyHistoryExportBodyModule;
window.restoreHistoryExportResultModule = restoreHistoryExportResultModule;

function loadDeliveryExportHistoryModule() {
  try {
    const raw = localStorage.getItem(DELIVERY_EXPORT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    deliveryExportHistoryState.items = Array.isArray(parsed)
      ? parsed.map((item) => ({ pinned: false, ...item }))
      : [];
  } catch {
    deliveryExportHistoryState.items = [];
  }
}

function persistDeliveryExportHistoryModule() {
  try {
    localStorage.setItem(
      DELIVERY_EXPORT_HISTORY_KEY,
      JSON.stringify(deliveryExportHistoryState.items.slice(0, 12))
    );
  } catch {}
}

function pushDeliveryExportHistoryItemModule(result) {
  if (!result?.body) return;
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file_name: result.file_name || currentExportFileNameModule(),
    content_type: result.content_type || "text/plain",
    body: result.body,
    format: result.format || deliveryExportState.format,
    source: deliveryExportState.source,
    report_kind: result.report_kind || deliveryReportState.kind,
    created_at: new Date().toISOString(),
    pinned: false
  };
  deliveryExportHistoryState.items = [
    item,
    ...deliveryExportHistoryState.items.filter((entry) => entry.file_name !== item.file_name || entry.created_at !== item.created_at)
  ]
    .sort((a, b) => historyItemTimestampModule(b) - historyItemTimestampModule(a))
    .slice(0, 12);
  persistDeliveryExportHistoryModule();
}

window.loadDeliveryExportHistoryModule = loadDeliveryExportHistoryModule;
window.persistDeliveryExportHistoryModule = persistDeliveryExportHistoryModule;
window.pushDeliveryExportHistoryItemModule = pushDeliveryExportHistoryItemModule;

function renderDeliveryExportTargetModule() {
  if (!deliveryExportTarget) return;
  const targetLabel =
    deliveryExportState.source === "report_bundle"
      ? t("reports.export.sourceBundle")
      : formatReportKindLabel(deliveryReportState.kind);
  const modeLabel = t("reports.deliveryModeExport");
  deliveryExportTarget.textContent = `${t("reports.export.target")}: ${targetLabel} · ${t(
    "reports.deliveryMode"
  )}: ${modeLabel}`;
}

function renderDeliveryExportStatusModule() {
  if (!deliveryExportStatus) return;
  deliveryExportStatus.classList.toggle("is-error", Boolean(deliveryExportState.result?.error));
  if (deliveryExportState.running) {
    deliveryExportStatus.textContent = t("reports.export.running");
  } else if (deliveryExportState.result?.error) {
    deliveryExportStatus.textContent = t("reports.export.failed");
  } else if (deliveryExportState.result) {
    deliveryExportStatus.textContent = t("reports.export.complete");
  } else {
    deliveryExportStatus.textContent = t("reports.export.ready");
  }
}

function renderDeliveryExportSourcesModule(canSelectExportSource) {
  if (!deliveryExportSources) return;
  const sources = [
    { key: "report_item", label: t("reports.export.sourceItem") },
    { key: "report_bundle", label: t("reports.export.sourceBundle") }
  ];
  deliveryExportSources.innerHTML = sources
    .map((item) => `
      <button
        class="report-export-source ${deliveryExportState.source === item.key ? "is-active" : ""}"
        type="button"
        data-export-source="${escapeHtml(item.key)}"
      >
        ${escapeHtml(item.label)}
      </button>
    `)
    .join("");
  deliveryExportSources.querySelectorAll("[data-export-source]").forEach((button) => {
    button.disabled = !canSelectExportSource;
    button.hidden = !canSelectExportSource;
  });
  deliveryExportSources.querySelectorAll("[data-export-source]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextSource = button.getAttribute("data-export-source") || "report_item";
      deliveryExportState.source = nextSource;
      if (nextSource === "report_bundle") {
        deliveryExportState.format = "json_package";
        void loadDeliveryBundlePreview();
      }
      deliveryExportState.result = null;
      deliveryExportState.previewExpanded = false;
      renderDeliveryExportPanel();
    });
  });
}

function renderDeliveryExportFormatsModule(canSelectExportFormat) {
  if (!deliveryExportFormats) return;
  deliveryExportFormats.innerHTML = DELIVERY_EXPORT_FORMATS.map((item) => {
    const enabled =
      deliveryExportState.source === "report_bundle"
        ? item.key === "json_package"
        : item.enabled;
    const active = item.key === deliveryExportState.format;
    return `
      <button
        class="report-export-button ${active ? "is-active" : ""}"
        type="button"
        data-export-format="${escapeHtml(item.key)}"
        ${enabled ? "" : "disabled"}
      >
        ${escapeHtml(enabled ? item.label : `${item.label} · ${t("reports.export.comingSoon")}`)}
      </button>
    `;
  }).join("");
  deliveryExportFormats.querySelectorAll("[data-export-format]").forEach((button) => {
    button.disabled = !canSelectExportFormat || button.disabled;
    button.hidden = !canSelectExportFormat;
  });
  deliveryExportFormats.querySelectorAll("[data-export-format]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextFormat = button.getAttribute("data-export-format") || "json_package";
      deliveryExportState.format = nextFormat;
      deliveryExportState.result = null;
      deliveryExportState.previewExpanded = false;
      renderDeliveryExportPanel();
      void runDeliveryExport(true);
    });
  });
}

function buildDeliveryExportPreviewMarkupModule() {
  const bundleSummary =
    deliveryExportState.source === "report_bundle"
      ? summarizeBundleModule(deliveryBundlePreviewState.bundle)
      : [];
  return `
    <div class="report-list-item">
      <div class="report-preview-title">${escapeHtml(t("reports.export.fileName"))}</div>
      <div class="report-card-copy">${escapeHtml(currentExportFileNameModule())}</div>
    </div>
    <div class="report-list-item">
      <div class="report-preview-title">${escapeHtml(t("reports.export.source"))}</div>
      <div class="report-card-copy">${escapeHtml(
        deliveryExportState.source === "report_bundle"
          ? t("reports.export.sourceBundle")
          : t("reports.export.sourceItem")
      )}</div>
    </div>
    <div class="report-list-item">
      <div class="report-preview-title">${escapeHtml(t("reports.export.format"))}</div>
      <div class="report-card-copy">${escapeHtml(formatReportKindLabel(deliveryExportState.format))}</div>
    </div>
    <div class="report-list-item">
      <div class="report-preview-title">${escapeHtml(t("reports.export.target"))}</div>
      <div class="report-card-copy">${escapeHtml(
        deliveryExportState.source === "report_bundle"
          ? "bundle"
          : exportTargetFromReportKindModule(deliveryReportState.kind)
      )}</div>
    </div>
    ${
      deliveryExportState.source === "report_bundle"
        ? `
          <div class="report-list-item">
            <div class="report-preview-title">${escapeHtml(t("reports.export.bundleSummary"))}</div>
            <div class="report-card-copy">${escapeHtml(
              bundleSummary.length ? bundleSummary.join(" · ") : t("reports.loading")
            )}</div>
          </div>
          <div class="report-list-item">
            <div class="report-preview-title">${escapeHtml(t("reports.export.bundleSections"))}</div>
            <div class="report-card-copy">${escapeHtml(
              bundleSummary.length ? String(bundleSummary.length) : "--"
            )}</div>
          </div>
        `
        : ""
    }
  `;
}

function renderDeliveryExportPreviewModule() {
  if (!deliveryExportPreview) return;
  deliveryExportPreview.innerHTML = buildDeliveryExportPreviewMarkupModule();
}

function renderDeliveryExportActionsModule(canCopyExportResult, canDownloadExportResult) {
  if (!deliveryExportActions) return;
  const hasBody = Boolean(deliveryExportState.result?.body);
  deliveryExportActions.innerHTML = `
    <button class="report-export-action" type="button" data-export-action="copy" ${(canCopyExportResult && hasBody) ? "" : "disabled"}>
      ${escapeHtml(t("reports.export.copy"))}
    </button>
    <button class="report-export-action" type="button" data-export-action="download" ${(canDownloadExportResult && hasBody) ? "" : "disabled"}>
      ${escapeHtml(t("reports.export.download"))}
    </button>
  `;
  deliveryExportActions.querySelectorAll("[data-export-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-export-action");
      if (action === "copy") {
        if (!canCopyExportResult) return;
        void copyDeliveryExportBodyModule();
      }
      if (action === "download") {
        if (!canDownloadExportResult) return;
        downloadDeliveryExportBodyModule();
      }
    });
  });
}

function renderDeliveryExportPreviewActionsModule(canToggleExportPreview) {
  if (!deliveryExportPreviewActions) return;
  const expandable = ["json_package", "csv"].includes(String(deliveryExportState.result?.format || ""));
  deliveryExportPreviewActions.innerHTML = expandable
    ? `
      <button class="report-export-action is-muted" type="button" data-preview-action="toggle">
        ${escapeHtml(
          deliveryExportState.previewExpanded
            ? t("reports.export.previewCollapse")
            : t("reports.export.previewExpand")
        )}
      </button>
    `
    : "";
  deliveryExportPreviewActions.querySelectorAll("[data-preview-action]").forEach((button) => {
    button.disabled = !canToggleExportPreview;
    button.hidden = !canToggleExportPreview;
  });
  deliveryExportPreviewActions.querySelectorAll("[data-preview-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canToggleExportPreview) return;
      deliveryExportState.previewExpanded = !deliveryExportState.previewExpanded;
      renderDeliveryExportPanel();
    });
  });
}

function buildDeliveryExportResultMarkupModule() {
  if (deliveryExportState.running) {
    return `<div class="report-empty">${escapeHtml(t("reports.export.running"))}</div>`;
  }
  if (deliveryExportState.result?.error) {
    return `
      <div class="report-list-item">
        <div class="report-preview-title">${escapeHtml(t("reports.export.failed"))}</div>
        <div class="report-card-copy">${escapeHtml(deliveryExportState.result.error)}</div>
      </div>
    `;
  }
  if (!deliveryExportState.result) {
    return `<div class="report-empty">${escapeHtml(t("reports.export.waitingResult"))}</div>`;
  }
  const body = String(deliveryExportState.result.body || "");
  const lines = previewExportBodyLinesModule(deliveryExportState.result);
  const stats = exportBodyStatsModule(deliveryExportState.result.body);
  const previewBody = deliveryExportState.previewExpanded ? body : lines.join("\n");
  return `
    <div class="report-result-stats">
      <div class="report-stat-chip">
        <div class="report-preview-title">${escapeHtml(t("reports.export.resultBytes"))}</div>
        <div class="report-card-copy">${escapeHtml(String(stats.bytes))}</div>
      </div>
      <div class="report-stat-chip">
        <div class="report-preview-title">${escapeHtml(t("reports.export.resultLines"))}</div>
        <div class="report-card-copy">${escapeHtml(String(stats.lines))}</div>
      </div>
    </div>
    <div class="report-list-item">
      <div class="report-preview-title">${escapeHtml(t("reports.export.contentType"))}</div>
      <div class="report-card-copy">${escapeHtml(deliveryExportState.result.content_type || "")}</div>
    </div>
    <div class="report-list-item">
      <div class="report-preview-title">${escapeHtml(t("reports.export.fileName"))}</div>
      <div class="report-card-copy">${escapeHtml(deliveryExportState.result.file_name || currentExportFileNameModule())}</div>
    </div>
    <div class="report-list-item">
      <div class="report-preview-title">${escapeHtml(t("reports.export.preview"))}</div>
      <pre class="report-preview-code">${escapeHtml(previewBody || body.slice(0, 240))}</pre>
    </div>
  `;
}

function renderDeliveryExportResultModule() {
  if (!deliveryExportResult) return;
  deliveryExportResult.innerHTML = buildDeliveryExportResultMarkupModule();
}

window.renderDeliveryExportTargetModule = renderDeliveryExportTargetModule;
window.renderDeliveryExportStatusModule = renderDeliveryExportStatusModule;
window.renderDeliveryExportSourcesModule = renderDeliveryExportSourcesModule;
window.renderDeliveryExportFormatsModule = renderDeliveryExportFormatsModule;
window.buildDeliveryExportPreviewMarkupModule = buildDeliveryExportPreviewMarkupModule;
window.renderDeliveryExportPreviewModule = renderDeliveryExportPreviewModule;
window.renderDeliveryExportActionsModule = renderDeliveryExportActionsModule;
window.renderDeliveryExportPreviewActionsModule = renderDeliveryExportPreviewActionsModule;
window.buildDeliveryExportResultMarkupModule = buildDeliveryExportResultMarkupModule;
window.renderDeliveryExportResultModule = renderDeliveryExportResultModule;

function renderDeliveryExportHistoryToolbarModule(can) {
  if (!deliveryExportHistoryToolbar) return;
  deliveryExportHistoryToolbar.innerHTML = `
    <button class="report-export-action is-muted" type="button" data-history-toolbar="select_all" ${can.select ? "" : "hidden"}>
      ${escapeHtml(t("reports.export.historySelectAll"))}
    </button>
    <button class="report-export-action is-muted" type="button" data-history-toolbar="download_selected" ${can.bulkDownload ? "" : "hidden"}>
      ${escapeHtml(t("reports.export.historyDownloadSelected"))}
    </button>
    <button class="report-export-action is-muted" type="button" data-history-toolbar="delete_selected" ${can.bulkDelete ? "" : "hidden"}>
      ${escapeHtml(t("reports.export.historyDeleteSelected"))}
    </button>
    <button class="report-export-action is-muted" type="button" data-history-toolbar="sort" ${can.sort ? "" : "hidden"}>
      ${escapeHtml(
        t(
          deliveryExportHistoryState.sort === "oldest"
            ? "reports.export.historySortNewest"
            : "reports.export.historySortOldest"
        )
      )}
    </button>
    <button class="report-export-action is-muted" type="button" data-history-toolbar="clear_selection" ${can.clearSelection ? "" : "hidden"}>
      ${escapeHtml(t("reports.export.historySelectionCleared"))}
    </button>
    <button class="report-export-action is-muted" type="button" data-history-toolbar="clear" ${can.clear ? "" : "hidden"}>
      ${escapeHtml(t("reports.export.historyClear"))}
    </button>
  `;
  deliveryExportHistoryToolbar.querySelectorAll("[data-history-toolbar]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-history-toolbar") || "";
      if (!can.select && action === "select_all") return;
      if (!can.bulkDownload && action === "download_selected") return;
      if (!can.bulkDelete && action === "delete_selected") return;
      if (!can.sort && action === "sort") return;
      if (!can.clearSelection && action === "clear_selection") return;
      if (!can.clear && action === "clear") return;
      if (action === "select_all") selectAllFilteredHistoryItemsModule();
      if (action === "download_selected") downloadSelectedDeliveryExportHistoryItemsModule();
      if (action === "delete_selected") deleteSelectedDeliveryExportHistoryItemsModule();
      if (action === "sort") {
        deliveryExportHistoryState.sort =
          deliveryExportHistoryState.sort === "oldest" ? "newest" : "oldest";
        renderDeliveryExportPanel();
      }
      if (action === "clear_selection") clearHistorySelectionModule();
      if (action === "clear") clearDeliveryExportHistoryModule();
    });
  });
}

function renderDeliveryExportHistoryFiltersModule(canFilter) {
  if (!deliveryExportHistoryFilters) return;
  const sourceFilters = [
    { key: "all", label: t("reports.export.historyAll") },
    { key: "report_item", label: t("reports.export.sourceItem") },
    { key: "report_bundle", label: t("reports.export.sourceBundle") },
    { key: "pinned", label: t("reports.export.historyPinned") }
  ];
  const formatFilters = [
    { key: "all", label: t("reports.export.historyFormatAll") },
    ...DELIVERY_EXPORT_FORMATS.filter((item) => item.enabled).map((item) => ({
      key: item.key,
      label: item.label
    }))
  ];
  const reportKindFilters = [
    { key: "all", label: t("reports.export.historyReportAll") },
    ...DELIVERY_REPORT_KINDS.map((item) => ({
      key: item,
      label: deliveryReportKindLabel(item)
    }))
  ];
  deliveryExportHistoryFilters.innerHTML =
    sourceFilters
      .map((item) => `
        <button
          class="report-export-source ${deliveryExportHistoryState.filter === item.key ? "is-active" : ""}"
          type="button"
          data-history-filter="${escapeHtml(item.key)}"
        >
          ${escapeHtml(item.label)}
        </button>
      `)
      .join("") +
    formatFilters
      .map((item) => `
        <button
          class="report-export-source ${deliveryExportHistoryState.format === item.key ? "is-active" : ""}"
          type="button"
          data-history-format="${escapeHtml(item.key)}"
        >
          ${escapeHtml(item.label)}
        </button>
      `)
      .join("") +
    reportKindFilters
      .map((item) => `
        <button
          class="report-export-source ${deliveryExportHistoryState.reportKind === item.key ? "is-active" : ""}"
          type="button"
          data-history-report-kind="${escapeHtml(item.key)}"
        >
          ${escapeHtml(item.label)}
        </button>
      `)
      .join("");
  deliveryExportHistoryFilters.querySelectorAll("[data-history-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canFilter) return;
      deliveryExportHistoryState.filter = button.getAttribute("data-history-filter") || "all";
      renderDeliveryExportPanel();
    });
  });
  deliveryExportHistoryFilters.querySelectorAll("[data-history-format]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canFilter) return;
      deliveryExportHistoryState.format = button.getAttribute("data-history-format") || "all";
      renderDeliveryExportPanel();
    });
  });
  deliveryExportHistoryFilters.querySelectorAll("[data-history-report-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canFilter) return;
      deliveryExportHistoryState.reportKind =
        button.getAttribute("data-history-report-kind") || "all";
      renderDeliveryExportPanel();
    });
  });
  deliveryExportHistoryFilters
    .querySelectorAll("[data-history-filter], [data-history-format], [data-history-report-kind]")
    .forEach((button) => {
      button.disabled = !canFilter;
      button.hidden = !canFilter;
    });
}

function bindDeliveryExportHistorySearchModule(canSearch) {
  if (!deliveryExportHistorySearch) return;
  deliveryExportHistorySearch.placeholder = t("reports.export.historySearch");
  deliveryExportHistorySearch.disabled = !canSearch;
  if (deliveryExportHistorySearch.value !== deliveryExportHistoryState.search) {
    deliveryExportHistorySearch.value = deliveryExportHistoryState.search;
  }
  if (!deliveryExportHistorySearch.dataset.bound) {
    deliveryExportHistorySearch.addEventListener("input", () => {
      if (!canSearch) return;
      deliveryExportHistoryState.search = deliveryExportHistorySearch.value || "";
      renderDeliveryExportPanel();
    });
    deliveryExportHistorySearch.dataset.bound = "true";
  }
}

function buildDeliveryExportHistoryMarkupModule(items, latestItem, latestItemId, can) {
  if (!items.length) {
    return `<div class="report-empty">${escapeHtml(t("reports.export.historyEmpty"))}</div>`;
  }
  const latestStats = exportBodyStatsModule(latestItem?.body || "");
  return items
    .map((item, index) => `
      ${index === 0 && latestItem ? `
        <div class="report-list-item report-history-summary-card">
          <div class="report-preview-title">${escapeHtml(t("reports.export.latestCard"))}</div>
          <div class="report-history-meta">
            ${escapeHtml(t("reports.export.fileName"))}: ${escapeHtml(latestItem.file_name || "delivery_export.txt")} ·
            ${escapeHtml(t("reports.export.latestReportKind"))}: ${escapeHtml(deliveryReportKindLabel(latestItem.report_kind))} ·
            ${escapeHtml(t("reports.export.historySource"))}: ${escapeHtml(
              latestItem.source === "report_bundle" ? t("reports.export.sourceBundle") : t("reports.export.sourceItem")
            )} ·
            ${escapeHtml(t("reports.export.historyTime"))}: ${escapeHtml(latestItem.created_at || "")}
          </div>
          <div class="report-result-stats">
            <div class="report-stat-chip">
              <div class="report-preview-title">${escapeHtml(t("reports.export.resultBytes"))}</div>
              <div class="report-card-copy">${escapeHtml(String(latestStats.bytes))}</div>
            </div>
            <div class="report-stat-chip">
              <div class="report-preview-title">${escapeHtml(t("reports.export.resultLines"))}</div>
              <div class="report-card-copy">${escapeHtml(String(latestStats.lines))}</div>
            </div>
          </div>
        </div>
      ` : ""}
      <div class="report-list-item report-history-item ${item.id === latestItemId ? "is-latest" : ""}">
        <div class="report-history-head">
          <input
            class="report-history-select"
            type="checkbox"
            data-history-select="${escapeHtml(item.id)}"
            ${can.select ? "" : "hidden"}
            ${deliveryExportHistoryState.selectedIds.includes(item.id) ? "checked" : ""}
          />
          <div>
            <div class="report-preview-title">
              ${escapeHtml(item.file_name || "delivery_export.txt")}
              ${item.id === latestItemId ? `<span class="report-history-badge">${escapeHtml(t("reports.export.historyLatest"))}</span>` : ""}
            </div>
            <div class="report-history-meta">
              ${escapeHtml(t("reports.export.historySource"))}: ${escapeHtml(
                item.source === "report_bundle" ? t("reports.export.sourceBundle") : t("reports.export.sourceItem")
              )} ·
              ${escapeHtml(t("reports.export.latestReportKind"))}: ${escapeHtml(deliveryReportKindLabel(item.report_kind))} ·
              ${escapeHtml(t("reports.export.historyTime"))}: ${escapeHtml(item.created_at || "")}
            </div>
          </div>
        </div>
        <div class="report-card-copy">${escapeHtml(historyBodyLinesModule(item))}</div>
        <div class="report-history-actions">
          <button class="report-export-action ${item.pinned ? "is-pinned" : "is-muted"}" type="button" data-history-action="pin" data-history-id="${escapeHtml(item.id)}" ${can.pin ? "" : "hidden"}>
            ${escapeHtml(item.pinned ? t("reports.export.historyUnpin") : t("reports.export.historyPin"))}
          </button>
          <button class="report-export-action" type="button" data-history-action="restore" data-history-id="${escapeHtml(item.id)}" ${can.restore ? "" : "hidden"}>
            ${escapeHtml(t("reports.export.historyRestore"))}
          </button>
          <button class="report-export-action" type="button" data-history-action="copy" data-history-id="${escapeHtml(item.id)}" ${can.copy ? "" : "hidden"}>
            ${escapeHtml(t("reports.export.copy"))}
          </button>
          <button class="report-export-action" type="button" data-history-action="download" data-history-id="${escapeHtml(item.id)}" ${can.download ? "" : "hidden"}>
            ${escapeHtml(t("reports.export.download"))}
          </button>
          <button class="report-export-action is-muted" type="button" data-history-action="delete" data-history-id="${escapeHtml(item.id)}" ${can.delete ? "" : "hidden"}>
            ${escapeHtml(t("reports.export.historyDelete"))}
          </button>
        </div>
      </div>
    `)
    .join("");
}

function bindDeliveryExportHistoryListModule(can) {
  if (!deliveryExportHistory) return;
  deliveryExportHistory.querySelectorAll("[data-history-select]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (!can.select) return;
      const itemId = checkbox.getAttribute("data-history-select") || "";
      if (!itemId) return;
      toggleHistorySelectionModule(itemId);
    });
  });
  deliveryExportHistory.querySelectorAll("[data-history-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-history-action") || "";
      const itemId = button.getAttribute("data-history-id") || "";
      if (!itemId) return;
      if (!can.pin && action === "pin") return;
      if (!can.restore && action === "restore") return;
      if (!can.copy && action === "copy") return;
      if (!can.download && action === "download") return;
      if (!can.delete && action === "delete") return;
      if (action === "pin") toggleDeliveryExportHistoryPinModule(itemId);
      if (action === "restore") restoreHistoryExportResultModule(itemId);
      if (action === "copy") void copyHistoryExportBodyModule(itemId);
      if (action === "download") downloadHistoryExportBodyModule(itemId);
      if (action === "delete") deleteDeliveryExportHistoryItemModule(itemId);
    });
  });
}

window.renderDeliveryExportHistoryToolbarModule = renderDeliveryExportHistoryToolbarModule;
window.renderDeliveryExportHistoryFiltersModule = renderDeliveryExportHistoryFiltersModule;
window.bindDeliveryExportHistorySearchModule = bindDeliveryExportHistorySearchModule;
window.buildDeliveryExportHistoryMarkupModule = buildDeliveryExportHistoryMarkupModule;
window.bindDeliveryExportHistoryListModule = bindDeliveryExportHistoryListModule;

function renderDeliveryExportPanel() {
  const can = (permission) => globalThis.hasPanelPermission?.(permission) ?? true;
  renderDeliveryExportPanelModule({
    canUseExportActions: can("reports.export.use"),
    canSelectExportSource: can("reports.export.source.select"),
    canSelectExportFormat: can("reports.export.format.select"),
    canGenerateExports: can("reports.export.generate"),
    canCopyExportResult: can("reports.export.result.copy"),
    canDownloadExportResult: can("reports.export.result.download"),
    canToggleExportPreview: can("reports.export.preview.toggle"),
    canFilterExportHistory: can("reports.history.filter"),
    canSearchExportHistory: can("reports.history.search"),
    canSelectExportHistory: can("reports.history.select"),
    canPinExportHistory: can("reports.history.pin"),
    canRestoreExportHistory: can("reports.history.restore"),
    canCopyExportHistory: can("reports.history.copy"),
    canDownloadExportHistory: can("reports.history.download"),
    canDeleteExportHistory: can("reports.history.delete"),
    canBulkDownloadExportHistory: can("reports.history.bulk.download"),
    canBulkDeleteExportHistory: can("reports.history.bulk.delete"),
    canSortExportHistory: can("reports.history.sort"),
    canClearHistorySelection: can("reports.history.clear_selection"),
    canClearExportHistory: can("reports.history.clear")
  });
}

function renderDeliveryExportPanelModule(permissions) {
  renderDeliveryExportTargetModule();
  renderDeliveryExportStatusModule();
  renderDeliveryExportSourcesModule(permissions.canSelectExportSource);
  renderDeliveryExportFormatsModule(permissions.canSelectExportFormat);
  renderDeliveryExportPreviewModule();
  renderDeliveryExportActionsModule(
    permissions.canCopyExportResult,
    permissions.canDownloadExportResult
  );
  renderDeliveryExportPreviewActionsModule(permissions.canToggleExportPreview);
  renderDeliveryExportResultModule();

  if (!deliveryExportHistory) return;

  const items = filteredDeliveryExportHistoryItemsModule();
  const historyPermissions = {
    select: permissions.canSelectExportHistory,
    bulkDownload: permissions.canBulkDownloadExportHistory,
    bulkDelete: permissions.canBulkDeleteExportHistory,
    sort: permissions.canSortExportHistory,
    clearSelection: permissions.canClearHistorySelection,
    clear: permissions.canClearExportHistory,
    pin: permissions.canPinExportHistory,
    restore: permissions.canRestoreExportHistory,
    copy: permissions.canCopyExportHistory,
    download: permissions.canDownloadExportHistory,
    delete: permissions.canDeleteExportHistory
  };

  if (deliveryExportHistoryToolbar) {
    renderDeliveryExportHistoryToolbarModule(historyPermissions);
  }

  if (deliveryExportHistoryFilters) {
    renderDeliveryExportHistoryFiltersModule(permissions.canFilterExportHistory);
  }

  if (deliveryExportHistorySearch) {
    bindDeliveryExportHistorySearchModule(permissions.canSearchExportHistory);
  }

  const latestItemId = latestDeliveryExportHistoryItemIdModule();
  const latestItem = latestDeliveryExportHistoryItemModule();
  deliveryExportHistory.innerHTML = buildDeliveryExportHistoryMarkupModule(
    items,
    latestItem,
    latestItemId,
    historyPermissions
  );
  bindDeliveryExportHistoryListModule(historyPermissions);
}

window.renderDeliveryExportPanel = renderDeliveryExportPanel;
window.renderDeliveryExportPanelModule = renderDeliveryExportPanelModule;
