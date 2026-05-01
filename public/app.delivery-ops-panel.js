function deliverySubscriptionStatusLabelModule(status) {
  return status === "paused" ? t("deliveryOps.statusPaused") : t("deliveryOps.statusActive");
}

function deliverySubscriptionFrequencyLabelModule(frequency) {
  return t(`deliveryOps.frequency.${frequency || "daily"}`);
}

function deliveryExecutionStateLabelModule(status) {
  switch (status) {
    case "succeeded":
    case "success":
      return t("deliveryOps.statusSuccess");
    case "failed":
      return t("deliveryOps.statusFailed");
    default:
      return t("deliveryOps.statusUnknown");
  }
}

function deliveryExecutionBadgeClassModule(status) {
  switch (status) {
    case "succeeded":
    case "success":
      return "success";
    case "failed":
      return "critical";
    default:
      return "warning";
  }
}

function deliveryRecoveryPriorityLabelModule(priority) {
  switch (String(priority || "").toLowerCase()) {
    case "high":
      return t("deliveryOps.priorityHigh");
    case "medium":
      return t("deliveryOps.priorityMedium");
    default:
      return t("deliveryOps.priorityLow");
  }
}

function deliveryRecoveryBadgeClassModule(priority) {
  switch (String(priority || "").toLowerCase()) {
    case "high":
      return "critical";
    case "medium":
      return "warning";
    default:
      return "success";
  }
}

function recoveryRetryActionModule(item) {
  if (item?.latest_failed_delivery_log_id) {
    return {
      request: {
        lookup: {
          lookup_kind: "by_delivery_log",
          delivery_log_id: item.latest_failed_delivery_log_id
        }
      },
      subscriptionId: item?.subscription_id || null
    };
  }
  if (item?.subscription_id) {
    return {
      request: {
        lookup: {
          lookup_kind: "by_subscription",
          subscription_id: item.subscription_id
        }
      },
      subscriptionId: item.subscription_id
    };
  }
  return null;
}

function renderDeliveryRecoveryItemModule(item) {
  const retryAction = recoveryRetryActionModule(item);
  const canRetryRecovery = isAdminUser();
  const reportValue = item?.report_type || item?.report_kind || "unknown";
  return `
    <div class="delivery-ops-item">
      <div class="delivery-ops-item-head">
        <div class="delivery-ops-item-title">${escapeHtml(reportValue)}</div>
        <div class="delivery-ops-item-meta">
          <span class="report-badge ${deliveryRecoveryBadgeClassModule(item?.priority)}">${escapeHtml(deliveryRecoveryPriorityLabelModule(item?.priority))}</span>
        </div>
      </div>
      <div class="delivery-ops-item-body">${escapeHtml(item?.subscription_id || "ad-hoc")}</div>
      <div class="delivery-ops-item-body">${escapeHtml(item?.summary || "")}</div>
      <div class="delivery-ops-item-body">${escapeHtml(item?.latest_failed_delivery_log_id || item?.latest_success_delivery_log_id || "")}</div>
      ${
        retryAction && canRetryRecovery
          ? `<div class="delivery-ops-item-actions"><button class="cta ghost tiny" type="button" data-recovery-retry='${escapeHtml(JSON.stringify(retryAction))}'>${escapeHtml(t("deliveryOps.retryNow"))}</button></div>`
          : ""
      }
    </div>
  `;
}

function bindDeliveryRecoveryRetryButtonsModule(container) {
  if (!container) return;
  container.querySelectorAll("[data-recovery-retry]").forEach((button) => {
    button.onclick = () => {
      const raw = button.getAttribute("data-recovery-retry");
      if (!raw) return;
      try {
        const payload = JSON.parse(raw);
        if (payload?.request) {
          void runDeliveryRetry(payload.request, payload.subscriptionId || null);
        }
      } catch (error) {
        console.warn("Invalid recovery retry payload", error);
      }
    };
  });
}

function renderDeliveryExecutionStatusPanelModule() {
  if (!deliveryOpsExecutionStatus) return;

  if (deliveryOpsState.executionStatusLoading) {
    deliveryOpsExecutionStatus.innerHTML = `<div class="report-empty">${escapeHtml(t("deliveryOps.running"))}</div>`;
    return;
  }

  const status = deliveryOpsState.executionStatus;
  if (!status) {
    deliveryOpsExecutionStatus.innerHTML = `<div class="report-empty">${escapeHtml(t("deliveryOps.emptyExecutionStatus"))}</div>`;
    return;
  }

  const statusValue = status.execution_state || status.status || "unknown";
  const subscriptionValue =
    status.subscription_id ||
    deliveryOpsState.selectedSubscriptionId ||
    "n/a";
  const resultSummary = status.result_summary || status.last_result_message || "n/a";
  const updatedAt = status.updated_at || "n/a";
  const formatValue = status.export_format || "n/a";
  const reportValue = status.report_type || "n/a";
  const modeValue = status.mode || "n/a";

  deliveryOpsExecutionStatus.innerHTML = `
    <div class="delivery-ops-status-card">
      <div class="delivery-ops-status-row">
        <div class="delivery-ops-status-title">${escapeHtml(deliveryExecutionStateLabelModule(statusValue))}</div>
        <span class="report-badge ${escapeHtml(deliveryExecutionBadgeClassModule(statusValue))}">${escapeHtml(deliveryExecutionStateLabelModule(statusValue))}</span>
      </div>
      <div class="delivery-ops-status-summary">${escapeHtml(status.summary || resultSummary)}</div>
      <div class="delivery-ops-status-grid">
        <div class="delivery-ops-status-cell">
          <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.statusSubscription"))}</div>
          <div class="delivery-ops-status-value">${escapeHtml(subscriptionValue)}</div>
        </div>
        <div class="delivery-ops-status-cell">
          <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.statusMode"))}</div>
          <div class="delivery-ops-status-value">${escapeHtml(modeValue)}</div>
        </div>
        <div class="delivery-ops-status-cell">
          <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.statusReport"))}</div>
          <div class="delivery-ops-status-value">${escapeHtml(reportValue)}</div>
        </div>
        <div class="delivery-ops-status-cell">
          <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.statusFormat"))}</div>
          <div class="delivery-ops-status-value">${escapeHtml(formatValue)}</div>
        </div>
        <div class="delivery-ops-status-cell">
          <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.statusUpdated"))}</div>
          <div class="delivery-ops-status-value">${escapeHtml(updatedAt)}</div>
        </div>
        <div class="delivery-ops-status-cell">
          <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.statusResult"))}</div>
          <div class="delivery-ops-status-value">${escapeHtml(resultSummary)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderDeliveryRetryResultPanelModule() {
  if (!deliveryOpsRetryResult) return;
  const retry = deliveryOpsState.retryResult;
  if (!retry) {
    deliveryOpsRetryResult.innerHTML = `<div class="report-empty">${escapeHtml(t("deliveryOps.emptyRetryResult"))}</div>`;
    return;
  }

  deliveryOpsRetryResult.innerHTML = `
    <div class="delivery-ops-status-card">
      <div class="delivery-ops-status-row">
        <span class="report-badge ${escapeHtml(retry?.succeeded ? "success" : retry?.retried ? "warning" : "critical")}">${escapeHtml(retry?.succeeded ? t("deliveryOps.statusSuccess") : retry?.retried ? t("deliveryOps.statusFailed") : t("deliveryOps.statusUnknown"))}</span>
      </div>
      <div class="delivery-ops-status-summary">${escapeHtml(retry?.result_summary || retry?.message || "n/a")}</div>
      <div class="delivery-ops-status-grid">
        <div class="delivery-ops-status-cell">
          <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.retryOriginal"))}</div>
          <div class="delivery-ops-status-value">${escapeHtml(retry?.original_delivery_log_id || "n/a")}</div>
        </div>
        <div class="delivery-ops-status-cell">
          <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.retryNew"))}</div>
          <div class="delivery-ops-status-value">${escapeHtml(retry?.new_delivery_log_id || "n/a")}</div>
        </div>
        <div class="delivery-ops-status-cell">
          <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.retryMessage"))}</div>
          <div class="delivery-ops-status-value">${escapeHtml(retry?.message || "n/a")}</div>
        </div>
      </div>
    </div>
  `;
}

function renderDeliveryRecoveryPanelModule() {
  const recovery = deliveryOpsState.recovery;
  if (deliveryOpsRecoverySummary) {
    if (!recovery?.summary) {
      deliveryOpsRecoverySummary.innerHTML = `<div class="report-empty">${escapeHtml(t("deliveryOps.emptyRecovery"))}</div>`;
    } else {
      const summary = recovery.summary;
      deliveryOpsRecoverySummary.innerHTML = `
        <div class="report-result-stats">
          <div class="report-stat-chip">
            <div class="report-preview-title">${escapeHtml(t("deliveryOps.summaryPending"))}</div>
            <div class="report-card-copy">${escapeHtml(String(summary.pending_recovery_count ?? 0))}</div>
          </div>
          <div class="report-stat-chip">
            <div class="report-preview-title">${escapeHtml(t("deliveryOps.summaryRecovered"))}</div>
            <div class="report-card-copy">${escapeHtml(String(summary.recovered_count ?? 0))}</div>
          </div>
          <div class="report-stat-chip">
            <div class="report-preview-title">${escapeHtml(t("deliveryOps.summaryStillFailing"))}</div>
            <div class="report-card-copy">${escapeHtml(String(summary.still_failing_count ?? 0))}</div>
          </div>
          <div class="report-stat-chip">
            <div class="report-preview-title">${escapeHtml(t("deliveryOps.summaryHighPriority"))}</div>
            <div class="report-card-copy">${escapeHtml(String(summary.high_priority_count ?? 0))}</div>
          </div>
        </div>
      `;
    }
  }

  const priorityItems = Array.isArray(recovery?.priority_queue) ? recovery.priority_queue : [];
  if (deliveryOpsRecoveryPriority) {
    deliveryOpsRecoveryPriority.innerHTML = priorityItems.length
      ? priorityItems.map(renderDeliveryRecoveryItemModule).join("")
      : `<div class="report-empty">${escapeHtml(t("deliveryOps.emptyRecovery"))}</div>`;
    bindDeliveryRecoveryRetryButtonsModule(deliveryOpsRecoveryPriority);
  }

  const pendingItems = Array.isArray(recovery?.pending_recovery) ? recovery.pending_recovery : [];
  if (deliveryOpsRecoveryPending) {
    deliveryOpsRecoveryPending.innerHTML = pendingItems.length
      ? pendingItems.map(renderDeliveryRecoveryItemModule).join("")
      : `<div class="report-empty">${escapeHtml(t("deliveryOps.emptyRecovery"))}</div>`;
    bindDeliveryRecoveryRetryButtonsModule(deliveryOpsRecoveryPending);
  }

  const recoveredItems = Array.isArray(recovery?.recovered) ? recovery.recovered : [];
  if (deliveryOpsRecoveryRecovered) {
    deliveryOpsRecoveryRecovered.innerHTML = recoveredItems.length
      ? recoveredItems.map(renderDeliveryRecoveryItemModule).join("")
      : `<div class="report-empty">${escapeHtml(t("deliveryOps.emptyRecovery"))}</div>`;
    bindDeliveryRecoveryRetryButtonsModule(deliveryOpsRecoveryRecovered);
  }

  const stillFailingItems = Array.isArray(recovery?.still_failing) ? recovery.still_failing : [];
  if (deliveryOpsRecoveryFailing) {
    deliveryOpsRecoveryFailing.innerHTML = stillFailingItems.length
      ? stillFailingItems.map(renderDeliveryRecoveryItemModule).join("")
      : `<div class="report-empty">${escapeHtml(t("deliveryOps.emptyRecovery"))}</div>`;
    bindDeliveryRecoveryRetryButtonsModule(deliveryOpsRecoveryFailing);
  }
}

window.renderDeliveryExecutionStatusPanelModule = renderDeliveryExecutionStatusPanelModule;
window.renderDeliveryRetryResultPanelModule = renderDeliveryRetryResultPanelModule;
window.renderDeliveryRecoveryPanelModule = renderDeliveryRecoveryPanelModule;

function formatDeliveryOpsHealthTimestampModule(value) {
  if (!value) return t("deliveryOps.healthUnknown");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("deliveryOps.healthUnknown");
  try {
    return new Intl.DateTimeFormat(getLocale(), {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  } catch (_error) {
    return date.toLocaleString();
  }
}

function buildDeliveryOpsHealthSnapshotModule(consolePayload, alertsPayload, recoveryPayload) {
  const health = deliveryOpsState.health || normalizeDeliveryOpsHealth(null);
  const alertCount = Array.isArray(alertsPayload?.alerts) ? alertsPayload.alerts.length : 0;
  const queueCount = Array.isArray(consolePayload?.dashboard?.metrics)
    ? consolePayload.dashboard.metrics.length
    : 0;
  const pendingCount = recoveryPayload?.summary?.pending_recovery_count ?? 0;
  const stillFailingCount = recoveryPayload?.summary?.still_failing_count ?? 0;
  const failedCount = deliveryOpsState.logs.filter((log) => log?.succeeded === false).length;

  let level = "healthy";
  if (!health.ok || stillFailingCount > 0 || failedCount >= 3) {
    level = "blocked";
  } else if (alertCount > 0 || pendingCount > 0 || failedCount > 0) {
    level = "degraded";
  }

  const badgeMap = {
    healthy: {
      badgeClass: "success",
      badgeLabel: t("deliveryOps.healthHealthy"),
      title: t("deliveryOps.healthHealthyTitle")
    },
    degraded: {
      badgeClass: "warning",
      badgeLabel: t("deliveryOps.healthDegraded"),
      title: t("deliveryOps.healthDegradedTitle")
    },
    blocked: {
      badgeClass: "critical",
      badgeLabel: t("deliveryOps.healthBlocked"),
      title: t("deliveryOps.healthBlockedTitle")
    }
  };
  const summaryKeyMap = {
    healthy: "deliveryOps.healthSummaryHealthy",
    degraded: "deliveryOps.healthSummaryDegraded",
    blocked: "deliveryOps.healthSummaryBlocked"
  };
  const badge = badgeMap[level];

  return {
    ...badge,
    level,
    apiStatus: health.ok ? health.statusText : `${t("deliveryOps.healthApiDown")} · ${health.statusText}`,
    alertCount,
    queueCount,
    pendingCount,
    stillFailingCount,
    failedCount,
    lastChecked: formatDeliveryOpsHealthTimestampModule(health.checkedAt),
    summary: t(summaryKeyMap[level], {
      alerts: alertCount,
      pending: pendingCount,
      failing: stillFailingCount,
      failedLogs: failedCount,
      queues: queueCount
    })
  };
}

function renderDeliveryOpsConsolePanelModule() {
  const consolePayload = deliveryOpsState.console;
  const dashboard = consolePayload?.dashboard || null;
  const alerts = consolePayload?.alerts || null;
  const recovery = deliveryOpsState.recovery || consolePayload?.recovery || null;
  const healthSnapshot = buildDeliveryOpsHealthSnapshotModule(consolePayload, alerts, recovery);

  if (deliveryOpsConsoleOverview) {
    if (!consolePayload || !dashboard || !recovery) {
      deliveryOpsConsoleOverview.innerHTML = `
        <article class="report-card">
          <div class="report-section-title">${escapeHtml(t("deliveryOps.overview"))}</div>
          <div class="report-empty">${escapeHtml(t("deliveryOps.emptyConsole"))}</div>
        </article>
      `;
    } else {
      deliveryOpsConsoleOverview.innerHTML = `
        <article class="report-card">
          <div class="report-section-title">${escapeHtml(t("deliveryOps.healthTitle"))}</div>
          <div class="delivery-ops-status-card">
            <div class="delivery-ops-status-row">
              <div class="delivery-ops-status-title">${escapeHtml(healthSnapshot.title)}</div>
              <span class="report-badge ${escapeHtml(healthSnapshot.badgeClass)}">${escapeHtml(healthSnapshot.badgeLabel)}</span>
            </div>
            <div class="delivery-ops-status-summary">${escapeHtml(healthSnapshot.summary)}</div>
            <div class="delivery-ops-status-grid">
              <div class="delivery-ops-status-cell">
                <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.healthApi"))}</div>
                <div class="delivery-ops-status-value">${escapeHtml(healthSnapshot.apiStatus)}</div>
              </div>
              <div class="delivery-ops-status-cell">
                <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.overviewAlerts"))}</div>
                <div class="delivery-ops-status-value">${escapeHtml(String(healthSnapshot.alertCount))}</div>
              </div>
              <div class="delivery-ops-status-cell">
                <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.overviewPending"))}</div>
                <div class="delivery-ops-status-value">${escapeHtml(String(healthSnapshot.pendingCount))}</div>
              </div>
              <div class="delivery-ops-status-cell">
                <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.healthRecentFailures"))}</div>
                <div class="delivery-ops-status-value">${escapeHtml(String(healthSnapshot.failedCount))}</div>
              </div>
              <div class="delivery-ops-status-cell">
                <div class="delivery-ops-status-label">${escapeHtml(t("deliveryOps.healthLastCheck"))}</div>
                <div class="delivery-ops-status-value">${escapeHtml(healthSnapshot.lastChecked)}</div>
              </div>
            </div>
          </div>
        </article>
        <article class="report-card">
          <div class="report-section-title">${escapeHtml(t("deliveryOps.overview"))}</div>
          <div class="report-result-stats">
            <div class="report-stat-chip">
              <div class="report-preview-title">${escapeHtml(t("deliveryOps.overviewQueues"))}</div>
              <div class="report-card-copy">${escapeHtml(String((dashboard.metrics || []).length))}</div>
            </div>
            <div class="report-stat-chip">
              <div class="report-preview-title">${escapeHtml(t("deliveryOps.overviewAlerts"))}</div>
              <div class="report-card-copy">${escapeHtml(String((alerts?.alerts || []).length))}</div>
            </div>
            <div class="report-stat-chip">
              <div class="report-preview-title">${escapeHtml(t("deliveryOps.overviewPending"))}</div>
              <div class="report-card-copy">${escapeHtml(String(recovery?.summary?.pending_recovery_count ?? 0))}</div>
            </div>
            <div class="report-stat-chip">
              <div class="report-preview-title">${escapeHtml(t("deliveryOps.overviewStillFailing"))}</div>
              <div class="report-card-copy">${escapeHtml(String(recovery?.summary?.still_failing_count ?? 0))}</div>
            </div>
          </div>
        </article>
      `;
    }
  }

  if (deliveryOpsAlerts) {
    const items = Array.isArray(alerts?.alerts) ? alerts.alerts : [];
    deliveryOpsAlerts.innerHTML = items.length
      ? items
          .map(
            (alert) => `
              <div class="delivery-ops-item">
                <div class="delivery-ops-item-head">
                  <div class="delivery-ops-item-title">${escapeHtml(alert?.title || alert?.key || "alert")}</div>
                  <div class="delivery-ops-item-meta">
                    <span class="report-badge ${reportSeverityClass(alert?.severity)}">${escapeHtml(String(alert?.severity || "warning"))}</span>
                  </div>
                </div>
                <div class="delivery-ops-item-body">${escapeHtml(alert?.summary || "")}</div>
              </div>
            `
          )
          .join("")
      : `<div class="report-empty">${escapeHtml(t("deliveryOps.emptyAlerts"))}</div>`;
  }

  if (deliveryOpsConsoleActions) {
    const items = Array.isArray(consolePayload?.actions) ? consolePayload.actions : [];
    deliveryOpsConsoleActions.innerHTML = items.length
      ? items
          .map(
            (item) => `
              <div class="delivery-ops-item">
                <div class="delivery-ops-item-head">
                  <div class="delivery-ops-item-title">${escapeHtml(item?.title || item?.action_key || "action")}</div>
                </div>
                <div class="delivery-ops-item-body">${escapeHtml(item?.description || "")}</div>
              </div>
            `
          )
          .join("")
      : `<div class="report-empty">${escapeHtml(t("deliveryOps.emptyActions"))}</div>`;
  }

  if (deliveryOpsConsoleStatuses) {
    const items = Array.isArray(consolePayload?.recent_status_items)
      ? consolePayload.recent_status_items
      : [];
    deliveryOpsConsoleStatuses.innerHTML = items.length
      ? items
          .map(
            (item) => `
              <div class="delivery-ops-item">
                <div class="delivery-ops-item-head">
                  <div class="delivery-ops-item-title">${escapeHtml(item?.subscription_id || "status")}</div>
                  <div class="delivery-ops-item-meta">${escapeHtml(item?.updated_at || "")}</div>
                </div>
                <div class="delivery-ops-item-body">${escapeHtml(item?.summary || "")}</div>
              </div>
            `
          )
          .join("")
      : `<div class="report-empty">${escapeHtml(t("deliveryOps.emptyStatuses"))}</div>`;
  }
}

window.renderDeliveryOpsConsolePanelModule = renderDeliveryOpsConsolePanelModule;
