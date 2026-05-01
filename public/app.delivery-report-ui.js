let deliveryMaintenanceSummaryRequest = null;
let deliveryMaintenanceSummaryCache = null;

async function loadMaintenanceSummaryModule(force = false) {
  if (!force && deliveryMaintenanceSummaryRequest) return deliveryMaintenanceSummaryRequest;
  if (!force && deliveryMaintenanceSummaryCache) return deliveryMaintenanceSummaryCache;
  deliveryMaintenanceSummaryRequest = fetch("/api/system/maintenance-report", {
    credentials: "include",
    cache: "no-store"
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`maintenance_report_failed:${res.status}`);
      const payload = await res.json().catch(() => null);
      deliveryMaintenanceSummaryCache = payload?.data || null;
      return deliveryMaintenanceSummaryCache;
    })
    .catch(() => null)
    .finally(() => {
      deliveryMaintenanceSummaryRequest = null;
    });
  return deliveryMaintenanceSummaryRequest;
}

function renderMaintenanceSummaryCardModule(summary) {
  const runPrune = summary?.reports?.run_prune || null;
  const workArchive = summary?.reports?.work_archive || null;
  if (!runPrune && !workArchive) {
    return `
      <article class="report-card">
        <div class="report-section-title">${escapeHtml(t("reports.maintenance.title"))}</div>
        <div class="report-empty">${escapeHtml(t("reports.maintenance.waiting"))}</div>
      </article>
    `;
  }
  const generatedAt =
    String(runPrune?.generated_at || workArchive?.generated_at || summary?.generated_at || "").trim();
  return `
    <article class="report-card">
      <div class="report-section-title">${escapeHtml(t("reports.maintenance.title"))}</div>
      ${generatedAt ? `<div class="report-card-copy">${escapeHtml(`${t("reports.maintenance.generatedAt")}: ${generatedAt}`)}</div>` : ""}
      <div class="report-grid">
        ${
          runPrune
            ? `
              <article class="report-card">
                <div class="report-card-title">${escapeHtml(t("reports.maintenance.runPrune"))}</div>
                <div class="report-card-copy">${escapeHtml(`${t("reports.maintenance.removed")}: ${Number(runPrune.removed_count || 0)}`)}</div>
                <div class="report-card-copy">${escapeHtml(`GB: ${Number(runPrune.removed_gb || 0).toFixed(2)}`)}</div>
              </article>
            `
            : ""
        }
        ${
          workArchive
            ? `
              <article class="report-card">
                <div class="report-card-title">${escapeHtml(t("reports.maintenance.workArchive"))}</div>
                <div class="report-card-copy">${escapeHtml(`${t("reports.maintenance.archived")}: ${Number(workArchive.archived_count || 0)}`)}</div>
                <div class="report-card-copy">${escapeHtml(`${t("reports.maintenance.candidates")}: ${Number(workArchive.candidate_count || 0)}`)}</div>
              </article>
            `
            : ""
        }
      </div>
    </article>
  `;
}

function renderDeliveryReportTabsModule() {
  if (!deliveryReportTabs) return;
  deliveryReportTabs.innerHTML = DELIVERY_REPORT_KINDS.map((kind) => {
    const active = kind === deliveryReportState.kind;
    return `
      <button class="report-tab ${active ? "is-active" : ""}" type="button" data-report-kind="${escapeHtml(kind)}">
        ${escapeHtml(formatReportKindLabelModule(kind))}
      </button>
    `;
  }).join("");

  deliveryReportTabs.querySelectorAll("[data-report-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.getAttribute("data-report-kind") || "briefing_pack";
      if (kind === deliveryReportState.kind && deliveryReportState.response) return;
      void loadDeliveryReport(kind, kind === deliveryReportState.kind);
    });
  });
}

function renderReportHeaderModule(response) {
  const meta = response?.meta || null;
  if (deliveryReportTitle) {
    deliveryReportTitle.textContent = meta?.title || t("reports.loading");
  }
  if (deliveryReportSummary) {
    if (deliveryReportState.loading && !response) {
      deliveryReportSummary.textContent = t("reports.loading");
    } else {
      const payload = response?.data?.payload || null;
      deliveryReportSummary.textContent =
        payload?.summary || payload?.title || response?.meta?.title || t("reports.waiting");
    }
  }
  if (deliveryReportMeta) {
    const bits = [];
    if (meta?.kind) bits.push(`${t("reports.kind")}: ${formatReportKindLabelModule(meta.kind)}`);
    if (meta?.generated_at) bits.push(`${t("reports.generatedAt")}: ${meta.generated_at}`);
    if (deliveryReportState.deliveryMeta?.mode) {
      bits.push(
        `${t("reports.deliveryMode")}: ${escapeHtml(
          deliveryReportState.deliveryMeta.mode === "export"
            ? t("reports.deliveryModeExport")
            : t("reports.deliveryModeReport")
        )}`
      );
    }
    deliveryReportMeta.textContent = bits.join(" · ") || `kind=${deliveryReportState.kind}`;
  }
}

function formatReportKindLabelModule(kind) {
  return String(kind || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function reportSeverityClassModule(severity) {
  const value = String(severity || "").toLowerCase();
  return value === "critical" ? "critical" : "warning";
}

function deliveryReportKindLabelModule(kind) {
  const key = String(kind || "unknown");
  switch (key) {
    case "dashboard":
      return "Dashboard";
    case "ops_health":
      return "Ops Health";
    case "kpi":
      return "KPI";
    case "analytics":
      return "Analytics";
    case "trends":
      return "Trends";
    case "alerts":
      return "Alerts";
    case "digest":
      return "Digest";
    case "briefing_pack":
      return "Briefing Pack";
    default:
      return key;
  }
}

function attachReportQueueJumpHandlersModule() {
  if (!deliveryReportBody) return;
  deliveryReportBody.querySelectorAll("[data-report-queue-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const queueKey = button.getAttribute("data-report-queue-key") || "";
      if (!queueKey) return;
      void focusDeliveryQueue(queueKey);
    });
  });
}

async function renderDeliveryReportBodyModule(response) {
  if (!deliveryReportBody) return;
  if (deliveryReportState.loading && !response) {
    deliveryReportBody.innerHTML = `<div class="report-empty">${escapeHtml(t("reports.loading"))}</div>`;
    return;
  }
  const data = response?.data || null;
  const payloadKind = String(data?.payload_kind || "");
  const payload = data?.payload || null;

  if (!payloadKind || !payload) {
    deliveryReportBody.innerHTML = `<div class="report-empty">${escapeHtml(t("reports.empty"))}</div>`;
    return;
  }

  switch (payloadKind) {
    case "dashboard":
      deliveryReportBody.innerHTML = renderDashboardReport(payload);
      break;
    case "ops_health":
      deliveryReportBody.innerHTML = renderOpsHealthStandaloneReport(payload);
      break;
    case "kpi":
      deliveryReportBody.innerHTML = renderKpiReport(payload);
      break;
    case "analytics":
      deliveryReportBody.innerHTML = renderAnalyticsReport(payload);
      break;
    case "trends":
      deliveryReportBody.innerHTML = renderTrendsReport(payload);
      break;
    case "alerts":
      deliveryReportBody.innerHTML = renderAlertsReport(payload);
      break;
    case "digest":
      deliveryReportBody.innerHTML = renderDigestReport(payload);
      break;
    case "briefing_pack":
      deliveryReportBody.innerHTML = renderBriefingReport(payload);
      break;
    default:
      deliveryReportBody.innerHTML = `<div class="report-empty">${escapeHtml(t("reports.empty"))}</div>`;
  }
  const maintenanceSummary = await loadMaintenanceSummaryModule();
  deliveryReportBody.insertAdjacentHTML("beforeend", renderMaintenanceSummaryCardModule(maintenanceSummary));
  attachReportQueueJumpHandlersModule();
}

function syncDeliveryDashboardActionPermissionsModule() {
  if (!deliveryDashboardBody) return;
  deliveryDashboardBody.querySelectorAll("button").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const deliveryAttr = button.getAttributeNames().find((name) => name.startsWith("data-delivery-"));
    if (!deliveryAttr) return;
    const scope = deliveryPermissionScopeFromAttr(deliveryAttr);
    if (!scope) return;
    const allowed = hasPanelPermission(scope);
    button.hidden = !allowed;
    button.disabled = button.disabled || !allowed;
    if (!allowed) button.title = permissionPrompt(scope);
  });
}

window.renderDeliveryReportTabsModule = renderDeliveryReportTabsModule;
window.renderReportHeaderModule = renderReportHeaderModule;
window.renderDeliveryReportBodyModule = renderDeliveryReportBodyModule;
window.syncDeliveryDashboardActionPermissionsModule = syncDeliveryDashboardActionPermissionsModule;
window.formatReportKindLabelModule = formatReportKindLabelModule;
window.reportSeverityClassModule = reportSeverityClassModule;
window.deliveryReportKindLabelModule = deliveryReportKindLabelModule;
window.attachReportQueueJumpHandlersModule = attachReportQueueJumpHandlersModule;
window.loadMaintenanceSummaryModule = loadMaintenanceSummaryModule;
window.renderMaintenanceSummaryCardModule = renderMaintenanceSummaryCardModule;

function renderMetricGridModule(metrics) {
  const entries = Object.entries(metrics || {});
  if (!entries.length) {
    return `<div class="report-empty">${escapeHtml(t("reports.empty"))}</div>`;
  }

  return `
    <div class="report-grid">
      ${entries
        .map(([key, value]) => `
          <article class="report-card">
            <div class="report-card-title">${escapeHtml(formatReportKindLabelModule(key))}</div>
            <div class="report-card-value">${escapeHtml(String(value ?? "--"))}</div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function renderStringListModule(items, emptyLabel = t("reports.empty")) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) {
    return `<div class="report-empty">${escapeHtml(emptyLabel)}</div>`;
  }

  return `
    <ul class="report-list">
      ${list
        .map((item) => `<li class="report-list-item">${escapeHtml(String(item))}</li>`)
        .join("")}
    </ul>
  `;
}

function renderDashboardReportModule(dashboard) {
  const metrics = Array.isArray(dashboard?.metrics) ? dashboard.metrics : [];
  const previews = Array.isArray(dashboard?.inbox_previews) ? dashboard.inbox_previews : [];
  return `
    <div class="report-grid">
      ${metrics
        .map((metric) => `
          <article class="report-card">
            <div class="report-card-title">${escapeHtml(metric.title || metric.key || "Metric")}</div>
            <div class="report-card-value">${escapeHtml(String(metric.count ?? 0))}</div>
            <div class="report-card-copy">${escapeHtml(dashboard?.summary || "")}</div>
          </article>
        `)
        .join("")}
    </div>
    <div class="report-section-title">${escapeHtml(t("reports.dashboard.preview"))}</div>
    <div class="report-grid">
      ${previews
        .map((preview) => `
          <article class="report-card">
            <div class="report-card-title">${escapeHtml(preview.title || preview.key || "Queue")}</div>
            <div class="report-card-copy">${escapeHtml(String((preview.items || []).length))} items</div>
            <button class="report-link-button" type="button" data-report-queue-key="${escapeHtml(preview.key || "")}">
              ${escapeHtml(t("reports.queue.open"))}
            </button>
          </article>
        `)
        .join("") || `<div class="report-empty">${escapeHtml(t("reports.empty"))}</div>`}
    </div>
  `;
}

function renderKpiReportModule(kpi) {
  const metrics = Array.isArray(kpi?.metrics) ? kpi.metrics : [];
  if (!metrics.length) return `<div class="report-empty">${escapeHtml(t("reports.empty"))}</div>`;
  return `
    <div class="report-grid">
      ${metrics
        .map((metric) => `
          <article class="report-card">
            <div class="report-card-title">${escapeHtml(metric.label || metric.key || "KPI")}</div>
            <div class="report-card-value">${escapeHtml(`${Math.round(Number(metric.ratio || 0) * 100)}%`)}</div>
            <div class="report-card-copy">${escapeHtml(`${metric.numerator || 0} / ${metric.denominator || 0}`)}</div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function renderAnalyticsReportModule(analytics) {
  const insights = Array.isArray(analytics?.insights) ? analytics.insights : [];
  if (!insights.length) return `<div class="report-empty">${escapeHtml(t("reports.empty"))}</div>`;
  return `
    <ul class="report-list">
      ${insights
        .map((insight) => `
          <li class="report-list-item">
            <div class="report-preview-title">${escapeHtml(insight.title || insight.key || "Insight")}</div>
            <div class="report-card-copy">${escapeHtml(insight.summary || "")}</div>
          </li>
        `)
        .join("")}
    </ul>
  `;
}

function renderTrendsReportModule(trends) {
  const series = Array.isArray(trends?.series) ? trends.series : [];
  if (!series.length) return `<div class="report-empty">${escapeHtml(t("reports.empty"))}</div>`;

  return `
    <div class="report-chart-list">
      ${series
        .map((item) => {
          const points = Array.isArray(item.points) ? item.points : [];
          const max = Math.max(1, ...points.map((point) => Number(point?.value || 0)));
          const latest = points[points.length - 1] || null;
          const width = latest ? Math.max(6, Math.round((Number(latest.value || 0) / max) * 100)) : 0;
          return `
            <article class="report-chart-row">
              <div class="report-preview-title">${escapeHtml(item.title || item.key || "Trend")}</div>
              <div class="report-chart-row-meta">${escapeHtml(latest?.day || "--")} · ${escapeHtml(String(latest?.value ?? 0))}</div>
              <div class="report-chart-bar">
                <div class="report-chart-fill" style="width:${width}%"></div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAlertsReportModule(alerts) {
  const items = Array.isArray(alerts?.alerts) ? alerts.alerts : [];
  if (!items.length) {
    return `<div class="report-empty">${escapeHtml(alerts?.summary || t("reports.alerts.none"))}</div>`;
  }

  return `
    <ul class="report-list">
      ${items
        .map((alert) => `
          <li class="report-list-item report-alert-row">
            <span class="report-badge ${reportSeverityClassModule(alert.severity)}">${escapeHtml(String(alert.severity || "warning"))}</span>
            <div>
              <div class="report-preview-title">${escapeHtml(alert.title || alert.key || "Alert")}</div>
              <div class="report-card-copy">${escapeHtml(alert.summary || "")}</div>
            </div>
          </li>
        `)
        .join("")}
    </ul>
  `;
}

window.renderMetricGridModule = renderMetricGridModule;
window.renderStringListModule = renderStringListModule;
window.renderDashboardReportModule = renderDashboardReportModule;
window.renderKpiReportModule = renderKpiReportModule;
window.renderAnalyticsReportModule = renderAnalyticsReportModule;
window.renderTrendsReportModule = renderTrendsReportModule;
window.renderAlertsReportModule = renderAlertsReportModule;

function renderOpsHealthStandaloneReportModule(report) {
  if (!report) {
    return `
      <article class="report-card">
        <div class="report-section-title">${escapeHtml(t("reports.opsHealth.title"))}</div>
        <div class="report-empty">${escapeHtml(t("reports.empty"))}</div>
      </article>
    `;
  }

  return `
    <article class="report-card">
      <div class="report-section-title">${escapeHtml(t("reports.opsHealth.title"))}</div>
      <div class="report-list-item report-alert-row">
        <span class="report-badge ${escapeHtml(opsHealthBadgeClass(report?.status))}">${escapeHtml(
          formatOpsHealthStatus(report?.status)
        )}</span>
        <div>
          <div class="report-preview-title">${escapeHtml(report?.title || t("reports.opsHealth.title"))}</div>
          <div class="report-card-copy">${escapeHtml(report?.summary || "")}</div>
        </div>
      </div>
      <div class="report-grid">
        <article class="report-card">
          <div class="report-section-title">${escapeHtml(t("reports.opsHealth.overview"))}</div>
          ${renderOpsHealthOverviewList(report)}
        </article>
        <article class="report-card">
          <div class="report-section-title">${escapeHtml(t("reports.opsHealth.reasons"))}</div>
          ${renderStringListModule(
            Array.isArray(report?.reasons)
              ? report.reasons.map((item) => `${item?.label || t("reports.opsHealth.reason")}: ${item?.summary || ""}`)
              : [],
            t("reports.empty")
          )}
        </article>
        <article class="report-card">
          <div class="report-section-title">${escapeHtml(t("reports.opsHealth.probeChecks"))}</div>
          ${renderOpsProbeList(report)}
        </article>
      </div>
      <article class="report-card">
        <div class="report-section-title">${escapeHtml(t("reports.opsHealth.actions"))}</div>
        ${renderStringListModule(report?.suggested_actions, t("reports.empty"))}
      </article>
    </article>
  `;
}

function renderDigestReportModule(digest) {
  return `
    ${renderDigestProbeSummaryCard(digest)}
    ${renderMetricGridModule(digest?.daily_metrics)}
    <div class="report-grid">
      ${renderOpsHealthCard(digest?.ops_health)}
      <article class="report-card">
        <div class="report-section-title">${escapeHtml(t("reports.digest.queues"))}</div>
        ${
          Array.isArray(digest?.inbox_counts) && digest.inbox_counts.length
            ? `
              <ul class="report-list">
                ${digest.inbox_counts
                  .map((item) => `
                    <li class="report-list-item">
                      <div class="report-preview-title">${escapeHtml(item.title || item.key || "Queue")}</div>
                      <div class="report-card-copy">${escapeHtml(String(item.count ?? 0))}</div>
                      <button class="report-link-button" type="button" data-report-queue-key="${escapeHtml(item.key || "")}">
                        ${escapeHtml(t("reports.queue.open"))}
                      </button>
                    </li>
                  `)
                  .join("")}
              </ul>
            `
            : `<div class="report-empty">${escapeHtml(t("reports.empty"))}</div>`
        }
      </article>
      <article class="report-card">
        <div class="report-section-title">${escapeHtml(t("reports.digest.alerts"))}</div>
        ${renderStringListModule(digest?.alert_titles, t("reports.alerts.none"))}
      </article>
    </div>
    <article class="report-card">
      <div class="report-section-title">${escapeHtml(t("reports.digest.highlights"))}</div>
      ${renderStringListModule(digest?.highlights, t("reports.empty"))}
    </article>
  `;
}

function renderBriefingReportModule(briefing) {
  return `
    <article class="report-card">
      <div class="report-section-title">${escapeHtml(t("reports.briefing.highlights"))}</div>
      ${renderStringListModule(briefing?.highlights, t("reports.empty"))}
    </article>
    ${renderOpsHealthStandaloneReportModule(briefing?.ops_health?.report || null)}
    <div class="report-grid">
      <article class="report-card">
        <div class="report-section-title">${escapeHtml(t("reports.briefing.kpi"))}</div>
        ${renderStringListModule(
          Array.isArray(briefing?.kpi?.metrics)
            ? briefing.kpi.metrics.map((metric) => `${metric.label}: ${Math.round(Number(metric.ratio || 0) * 100)}%`)
            : [],
          t("reports.empty")
        )}
      </article>
      <article class="report-card">
        <div class="report-section-title">${escapeHtml(t("reports.briefing.analytics"))}</div>
        ${renderStringListModule(
          Array.isArray(briefing?.analytics?.insights)
            ? briefing.analytics.insights.map((insight) => insight.title || insight.summary || insight.key)
            : [],
          t("reports.empty")
        )}
      </article>
    </div>
  `;
}

window.renderOpsHealthStandaloneReportModule = renderOpsHealthStandaloneReportModule;
window.renderDigestReportModule = renderDigestReportModule;
window.renderBriefingReportModule = renderBriefingReportModule;

function renderDigestProbeSummaryCardModule(digest) {
  const report = digest?.ops_health || null;
  const counts = countOpsProbeStatuses(report);
  const summaryLines = [
    `${t("reports.opsHealth.probePass")}: ${counts.pass}`,
    `${t("reports.opsHealth.probeWarn")}: ${counts.warn}`,
    `${t("reports.opsHealth.probeFail")}: ${counts.fail}`
  ];
  return `
    <article class="report-card">
      <div class="report-section-title">${escapeHtml(t("reports.digest.probeSummary"))}</div>
      <div class="report-list-item report-alert-row">
        <span class="report-badge ${escapeHtml(opsHealthBadgeClass(report?.status))}">${escapeHtml(
          formatOpsHealthStatus(report?.status)
        )}</span>
        <div>
          <div class="report-preview-title">${escapeHtml(report?.title || t("reports.opsHealth.title"))}</div>
          <div class="report-card-copy">${escapeHtml(report?.summary || "")}</div>
        </div>
      </div>
      ${renderStringListModule(summaryLines, t("reports.empty"))}
    </article>
  `;
}

function renderOpsHealthCardModule(report) {
  if (!report) {
    return `
      <article class="report-card">
        <div class="report-section-title">${escapeHtml(t("reports.opsHealth.title"))}</div>
        <div class="report-empty">${escapeHtml(t("reports.empty"))}</div>
      </article>
    `;
  }

  return `
    <article class="report-card">
      <div class="report-section-title">${escapeHtml(t("reports.opsHealth.title"))}</div>
      <div class="report-list-item report-alert-row">
        <span class="report-badge ${escapeHtml(opsHealthBadgeClass(report?.status))}">${escapeHtml(
          formatOpsHealthStatus(report?.status)
        )}</span>
        <div>
          <div class="report-preview-title">${escapeHtml(report?.title || t("reports.opsHealth.title"))}</div>
          <div class="report-card-copy">${escapeHtml(report?.summary || "")}</div>
        </div>
      </div>
      ${renderOpsHealthOverviewList(report)}
    </article>
  `;
}

window.renderDigestProbeSummaryCardModule = renderDigestProbeSummaryCardModule;
window.renderOpsHealthCardModule = renderOpsHealthCardModule;

function formatOpsHealthStatusModule(status) {
  const key = String(status || "").toLowerCase();
  if (key === "healthy") return t("reports.opsHealth.statusHealthy");
  if (key === "degraded") return t("reports.opsHealth.statusDegraded");
  if (key === "blocked") return t("reports.opsHealth.statusBlocked");
  return t("reports.opsHealth.statusUnknown");
}

function opsHealthBadgeClassModule(status) {
  const key = String(status || "").toLowerCase();
  if (key === "healthy") return "success";
  if (key === "degraded") return "warning";
  if (key === "blocked") return "critical";
  return "warning";
}

function renderOpsHealthOverviewListModule(report) {
  const items = [
    `${t("reports.opsHealth.api")}: ${report?.api_status || "--"}`,
    `${t("reports.opsHealth.checkedAt")}: ${report?.checked_at || "--"}`,
    `${t("reports.opsHealth.subscriptions")}: ${String(report?.subscription_count ?? 0)}`,
    `${t("reports.opsHealth.activeSubscriptions")}: ${String(report?.active_subscription_count ?? 0)}`,
    `${t("reports.opsHealth.queues")}: ${String(report?.queue_count ?? 0)}`,
    `${t("reports.opsHealth.alerts")}: ${String(report?.alert_count ?? 0)}`,
    `${t("reports.opsHealth.pendingRecovery")}: ${String(report?.pending_recovery_count ?? 0)}`,
    `${t("reports.opsHealth.stillFailing")}: ${String(report?.still_failing_count ?? 0)}`
  ];
  return renderStringListModule(items, t("reports.empty"));
}

function formatOpsProbeStatusModule(status) {
  const key = String(status || "").toLowerCase();
  if (key === "pass") return t("reports.opsHealth.probePass");
  if (key === "warn") return t("reports.opsHealth.probeWarn");
  if (key === "fail") return t("reports.opsHealth.probeFail");
  return key || t("reports.empty");
}

function renderOpsProbeListModule(report) {
  const probes = Array.isArray(report?.probe_checks) ? report.probe_checks : [];
  return renderStringListModule(
    probes.map((probe) => `${probe?.label || probe?.key || "Probe"} [${formatOpsProbeStatusModule(probe?.status)}]: ${probe?.summary || ""}`),
    t("reports.empty")
  );
}

function countOpsProbeStatusesModule(report) {
  const probes = Array.isArray(report?.probe_checks) ? report.probe_checks : [];
  return probes.reduce(
    (acc, probe) => {
      const key = String(probe?.status || "").toLowerCase();
      if (key === "pass") acc.pass += 1;
      else if (key === "warn") acc.warn += 1;
      else if (key === "fail") acc.fail += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 }
  );
}

window.formatOpsHealthStatusModule = formatOpsHealthStatusModule;
window.opsHealthBadgeClassModule = opsHealthBadgeClassModule;
window.renderOpsHealthOverviewListModule = renderOpsHealthOverviewListModule;
window.formatOpsProbeStatusModule = formatOpsProbeStatusModule;
window.renderOpsProbeListModule = renderOpsProbeListModule;
window.countOpsProbeStatusesModule = countOpsProbeStatusesModule;
