function renderDigestMetricsModule(metrics) {
  if (!mvDigestMetrics) return;

  const entries = [
    ["cssmv.digest.metrics.escalated", metrics?.escalated_count],
    ["cssmv.digest.metrics.manualIntervention", metrics?.manual_intervention_count],
    ["cssmv.digest.metrics.retry", metrics?.retry_count],
    ["cssmv.digest.metrics.resolutionChange", metrics?.resolution_change_count]
  ];

  mvDigestMetrics.innerHTML = entries
    .map(([labelKey, value]) => {
      const waiting = value === undefined || value === null;
      return `
        <div class="mv-digest-metric ${waiting ? "is-waiting" : ""}">
          <span>${escapeHtml(t(labelKey))}</span>
          <strong>${escapeHtml(waiting ? "--" : String(value))}</strong>
        </div>
      `;
    })
    .join("");
}

function severityLabelModule(value) {
  const raw = String(value || "").toLowerCase();
  if (raw === "critical") return "critical";
  if (raw === "warning") return "warning";
  return "info";
}

function renderDigestPreviewModule(items) {
  if (!mvDigestPreview) return;
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    mvDigestPreview.innerHTML = `<div class="mv-digest-preview-empty">${escapeHtml(t("cssmv.digest.emptyPreview"))}</div>`;
    return;
  }

  mvDigestPreview.innerHTML = list
    .slice(0, 4)
    .map((item) => {
      const title =
        item?.summary?.title ||
        item?.status?.summary ||
        `${String(item?.target || "delivery")} · ${String(item?.mode || "unknown")}`;
      const meta = [
        item?.updated_at ? `${t("cssmv.digest.previewUpdated")} ${item.updated_at}` : "",
        item?.trust_level ? `trust=${item.trust_level}` : "",
        item?.risk_level ? `risk=${item.risk_level}` : ""
      ]
        .filter(Boolean)
        .join(" · ");
      const body = item?.summary?.summary || item?.status?.headline || "";

      return `
        <div class="mv-digest-preview-item">
          <div class="mv-digest-preview-title">${escapeHtml(title)}</div>
          <div class="mv-digest-preview-meta">${escapeHtml(meta)}</div>
          <div class="mv-digest-preview-body">${escapeHtml(body)}</div>
        </div>
      `;
    })
    .join("");
}

function renderDigestInboxCountsModule(dashboard, digest) {
  if (!mvDigestInboxCounts) return;

  const counts = Array.isArray(digest?.inbox_counts) ? digest.inbox_counts : [];
  const previews = Array.isArray(dashboard?.inbox_previews) ? dashboard.inbox_previews : [];
  const previewMap = new Map(previews.map((item) => [String(item.key || ""), item]));

  if (!counts.length) {
    mvDigestInboxCounts.innerHTML = `
      <button class="mv-digest-queue is-waiting" type="button" disabled>
        <span>${escapeHtml(t("cssmv.digest.waitingQueue"))}</span>
      </button>
    `;
    renderDigestPreviewModule([]);
    return;
  }

  if (!activeDigestQueueKey || !previewMap.has(activeDigestQueueKey)) {
    activeDigestQueueKey = String(counts[0]?.key || "");
  }

  mvDigestInboxCounts.innerHTML = counts
    .map((item) => {
      const key = String(item.key || "");
      const active = key === activeDigestQueueKey;
      return `
        <button class="mv-digest-queue ${active ? "is-active" : ""}" type="button" data-queue-key="${escapeHtml(key)}">
          <span class="mv-digest-queue-title">${escapeHtml(item.title)}</span>
          <span class="mv-digest-queue-count">${escapeHtml(String(item.count))}</span>
        </button>
      `;
    })
    .join("");

  mvDigestInboxCounts.querySelectorAll("[data-queue-key]").forEach((button) => {
    button.addEventListener("click", () => {
      activeDigestQueueKey = button.getAttribute("data-queue-key") || "";
      renderDigestInboxCountsModule(dashboard, digest);
    });
  });

  renderDigestPreviewModule(previewMap.get(activeDigestQueueKey)?.items || []);
}

function renderDigestAlertsModule(alerts, digest) {
  if (!mvDigestAlerts) return;

  const items = Array.isArray(alerts?.alerts) ? alerts.alerts : [];
  if (!items.length) {
    mvDigestAlerts.innerHTML = `
      <div class="mv-digest-alert is-waiting">
        <span class="mv-digest-alert-copy">${escapeHtml(t("cssmv.digest.waitingAlerts"))}</span>
      </div>
    `;
    return;
  }

  const digestTitles = new Set(Array.isArray(digest?.alert_titles) ? digest.alert_titles : []);
  mvDigestAlerts.innerHTML = items
    .map((item) => {
      const severity = severityLabelModule(item?.severity);
      const copy = digestTitles.has(item?.title)
        ? `${item.title} · ${item.summary}`
        : item.title || item.summary || "";
      return `
        <div class="mv-digest-alert">
          <span class="mv-digest-alert-badge ${severity}">${escapeHtml(severity)}</span>
          <span class="mv-digest-alert-copy">${escapeHtml(copy)}</span>
        </div>
      `;
    })
    .join("");
}

function renderDeliveryDigestSummaryModule(bundle) {
  const digest = bundle?.digest || bundle?.report?.digest || null;
  const dashboard = bundle?.dashboard || bundle?.report?.dashboard || null;
  const alerts = bundle?.alerts || bundle?.report?.alerts || null;

  if (mvDigestStatus) {
    mvDigestStatus.classList.remove("mv-digest-status-error");
    mvDigestStatus.textContent = digest?.title ? t("cssmv.digest.readyStatus") : t("cssmv.digest.waitingStatus");
  }
  if (mvDigestTitle) {
    mvDigestTitle.textContent = digest?.title || t("cssmv.digest.waitingTitle");
  }
  if (mvDigestSummary) {
    mvDigestSummary.textContent = digest?.summary || t("cssmv.digest.waitingSummary");
  }

  renderDigestMetricsModule(digest?.daily_metrics);
  renderDigestInboxCountsModule(dashboard, digest);
  renderDigestAlertsModule(alerts, digest);

  renderPulseList(
    mvDigestHighlights,
    Array.isArray(digest?.highlights) ? digest.highlights : [],
    t("cssmv.digest.waitingHighlights")
  );
}

function renderDeliveryDigestErrorModule(message) {
  if (mvDigestStatus) {
    mvDigestStatus.textContent = t("cssmv.digest.errorStatus");
    mvDigestStatus.classList.add("mv-digest-status-error");
  }
  if (mvDigestSummary) {
    mvDigestSummary.textContent = message || t("cssmv.digest.waitingSummary");
  }
  renderDigestPreviewModule([]);
}

window.renderDigestMetricsModule = renderDigestMetricsModule;
window.severityLabelModule = severityLabelModule;
window.renderDigestPreviewModule = renderDigestPreviewModule;
window.renderDigestInboxCountsModule = renderDigestInboxCountsModule;
window.renderDigestAlertsModule = renderDigestAlertsModule;
window.renderDeliveryDigestSummaryModule = renderDeliveryDigestSummaryModule;
window.renderDeliveryDigestErrorModule = renderDeliveryDigestErrorModule;

function renderDigestBundleStateModule(bundle) {
  if (bundle?.error) {
    renderDeliveryDigestErrorModule(bundle.error);
    return;
  }
  renderDeliveryDigestSummaryModule(bundle);
}

window.renderDigestBundleStateModule = renderDigestBundleStateModule;

async function loadDeliveryDigestBundleModule(force = false) {
  if (!force && deliveryDigestBundleRequest) return deliveryDigestBundleRequest;
  if (!force && deliveryDigestBundleLoadedAt && Date.now() - deliveryDigestBundleLoadedAt < 60000) {
    return window.CSSMV_DELIVERY_REPORT_BUNDLE || null;
  }

  deliveryDigestBundleRequest = fetch("/cssapi/v1/case/delivery/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      days: 14,
      preview_limit: 5,
      include_dashboard: true,
      include_ops_health: true,
      include_alerts: true,
      include_digest: true,
      include_kpi: false,
      include_analytics: false,
      include_trends: false,
      include_briefing: false
    })
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`delivery digest request failed: ${res.status}`);
      }
      const payload = await res.json();
      const report = payload?.report || null;
      window.CSSMV_DELIVERY_REPORT_BUNDLE = report;
      deliveryDigestBundleLoadedAt = Date.now();
      renderDeliveryDigestSummaryModule(report);
      return report;
    })
    .catch((error) => {
      renderDeliveryDigestErrorModule(String(error));
      return null;
    })
    .finally(() => {
      deliveryDigestBundleRequest = null;
    });

  return deliveryDigestBundleRequest;
}

function focusDeliveryQueueModule(queueKey) {
  activeDigestQueueKey = String(queueKey || "");
  openPanel(cssmvPanel);
  return loadDeliveryDigestBundleModule().then((bundle) => {
    renderDeliveryDigestSummaryModule(bundle);
    return bundle;
  });
}

window.loadDeliveryDigestBundleModule = loadDeliveryDigestBundleModule;
window.focusDeliveryQueueModule = focusDeliveryQueueModule;
