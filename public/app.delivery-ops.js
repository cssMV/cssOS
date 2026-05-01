function renderDeliveryOpsPanel() {
  if (!deliveryOpsPanel) return;
  const canRefreshOps = isLoggedInUser();
  const canRetryOps = isAdminUser();

  if (deliveryOpsMeta) {
    deliveryOpsMeta.textContent = deliveryOpsState.loading
      ? t("deliveryOps.running")
      : t("deliveryOps.metaCounts", {
        subscriptions: deliveryOpsState.subscriptions.length,
        logs: deliveryOpsState.logs.length,
        pending: deliveryOpsState.recovery?.summary?.pending_recovery_count ?? 0
      });
  }

  if (deliveryOpsSummary) {
    deliveryOpsSummary.textContent = deliveryOpsState.loading
      ? t("deliveryOps.running")
      : deliveryOpsState.subscriptions.length
        ? t("deliveryOps.summaryLoaded", {
          subscriptions: deliveryOpsState.subscriptions.length,
          logs: deliveryOpsState.logs.length,
          pending: deliveryOpsState.recovery?.summary?.pending_recovery_count ?? 0
        })
        : t("deliveryOps.waiting");
  }

  renderDeliveryExecutionStatusPanel();
  renderDeliveryRetryResultPanel();
  renderDeliveryRecoveryPanel();
  renderDeliveryOpsConsolePanel();

  if (deliveryOpsActions) {
    deliveryOpsActions.innerHTML = `
      <button class="cta ghost tiny" type="button" data-delivery-ops-retry-latest ${canRetryOps ? "" : "hidden"}>${t("deliveryOps.retryLatest")}</button>
      <button class="cta tiny" type="button" data-delivery-ops-refresh ${canRefreshOps ? "" : "hidden"}>${t("deliveryOps.load")}</button>
    `;
    const retryLatestButton = deliveryOpsActions.querySelector("[data-delivery-ops-retry-latest]");
    const refreshButton = deliveryOpsActions.querySelector("[data-delivery-ops-refresh]");
    if (retryLatestButton) {
      retryLatestButton.onclick = () => {
        if (!canRetryOps) return;
        void runDeliveryRetry({ lookup: { lookup_kind: "latest_failed" } });
      };
    }
    if (refreshButton) {
      refreshButton.onclick = () => {
        if (!canRefreshOps) return;
        void loadDeliveryOps(true);
      };
    }
  }

  if (deliveryOpsSubscriptions) {
    if (!deliveryOpsState.subscriptions.length) {
      deliveryOpsSubscriptions.innerHTML = `<div class="report-empty">${t("deliveryOps.emptySubscriptions")}</div>`;
    } else {
      deliveryOpsSubscriptions.innerHTML = deliveryOpsState.subscriptions
        .map((subscription) => {
          const latestLog = deliveryOpsState.logs.find(
            (log) => log?.subscription_id === subscription?.subscription_id
          );
          const selected = subscription?.subscription_id === deliveryOpsState.selectedSubscriptionId;
          return `
            <div class="delivery-ops-item ${selected ? "selected" : ""}">
              <div class="delivery-ops-item-head">
                <div class="delivery-ops-item-title">${escapeHtml(subscription?.report_type || subscription?.subscription_id || "subscription")}</div>
                <div class="delivery-ops-item-meta">${escapeHtml(deliverySubscriptionStatusLabel(subscription?.status))}</div>
              </div>
              <div class="delivery-ops-item-body">
                ${escapeHtml(deliverySubscriptionFrequencyLabel(subscription?.frequency))} · ${escapeHtml(subscription?.delivery_mode || "report")} · ${escapeHtml(subscription?.subscription_id || "")}
              </div>
              <div class="delivery-ops-item-body">
                ${escapeHtml(t("deliveryOps.latest"))}: ${escapeHtml(latestLog?.result_message || latestLog?.message || "none")}
              </div>
              <div class="delivery-ops-item-actions">
                <button class="cta ghost tiny" type="button" data-inspect-subscription="${escapeHtml(subscription?.subscription_id || "")}">${t("deliveryOps.inspect")}</button>
                ${latestLog && latestLog?.succeeded === false ? `<button class="cta ghost tiny" type="button" data-retry-subscription="${escapeHtml(subscription?.subscription_id || "")}">${t("deliveryOps.retrySubscription")}</button>` : ""}
                <button class="cta tiny" type="button" data-run-subscription="${escapeHtml(subscription?.subscription_id || "")}">${t("deliveryOps.run")}</button>
              </div>
            </div>
          `;
        })
        .join("");

      deliveryOpsSubscriptions.querySelectorAll("[data-inspect-subscription]").forEach((button) => {
        button.onclick = () => {
          const subscriptionId = button.getAttribute("data-inspect-subscription");
          if (subscriptionId) void loadDeliveryExecutionStatus(subscriptionId, true);
        };
      });
      deliveryOpsSubscriptions.querySelectorAll("[data-run-subscription]").forEach((button) => {
        button.onclick = () => {
          const subscriptionId = button.getAttribute("data-run-subscription");
          if (subscriptionId) void runDeliverySubscriptionNow(subscriptionId);
        };
      });
      deliveryOpsSubscriptions.querySelectorAll("[data-retry-subscription]").forEach((button) => {
        button.onclick = () => {
          const subscriptionId = button.getAttribute("data-retry-subscription");
          if (subscriptionId) {
            void runDeliveryRetry({
              lookup: {
                lookup_kind: "by_subscription",
                subscription_id: subscriptionId
              }
            }, subscriptionId);
          }
        };
      });
    }
  }

  if (deliveryOpsLogs) {
    if (!deliveryOpsState.logs.length) {
      deliveryOpsLogs.innerHTML = `<div class="report-empty">${t("deliveryOps.emptyLogs")}</div>`;
    } else {
      deliveryOpsLogs.innerHTML = deliveryOpsState.logs
        .map((log) => `
          <div class="delivery-ops-item">
            <div class="delivery-ops-item-head">
              <div class="delivery-ops-item-title">${escapeHtml(log?.report_type || log?.target || "delivery_log")}</div>
              <div class="delivery-ops-item-meta">${escapeHtml(log?.succeeded ? t("deliveryOps.logSuccess") : t("deliveryOps.logFailed"))}</div>
            </div>
            <div class="delivery-ops-item-body">${escapeHtml(log?.created_at || "")}</div>
            <div class="delivery-ops-item-body">${escapeHtml(log?.result_message || log?.message || "")}</div>
            ${log?.succeeded || !canRetryOps ? "" : `<div class="delivery-ops-item-actions"><button class="cta ghost tiny" type="button" data-retry-log="${escapeHtml(log?.delivery_log_id || "")}" data-retry-log-subscription="${escapeHtml(log?.subscription_id || "")}">${t("deliveryOps.retryLog")}</button></div>`}
          </div>
        `)
        .join("");
      deliveryOpsLogs.querySelectorAll("[data-retry-log]").forEach((button) => {
        button.onclick = () => {
          const deliveryLogId = button.getAttribute("data-retry-log");
          const subscriptionId = button.getAttribute("data-retry-log-subscription");
          if (deliveryLogId) {
            void runDeliveryRetry({
              lookup: {
                lookup_kind: "by_delivery_log",
                delivery_log_id: deliveryLogId
              }
            }, subscriptionId || null);
          }
        };
      });
    }
  }
}

function normalizeDeliveryOpsHealth(payload) {
  const statusText =
    typeof payload?.status === "string" && payload.status.trim()
      ? payload.status.trim()
      : payload?.ok === false
        ? "Unavailable"
        : "OK";
  const explicitOk = typeof payload?.ok === "boolean" ? payload.ok : null;
  const derivedOk = !/(fail|down|error|unavailable)/i.test(statusText);
  return {
    ok: explicitOk ?? derivedOk,
    statusText,
    checkedAt:
      typeof payload?.checked_at === "string" && payload.checked_at.trim()
        ? payload.checked_at
        : new Date().toISOString()
  };
}

async function loadDeliveryOps(force = false) {
  if (!force && deliveryOpsRequest) return deliveryOpsRequest;

  deliveryOpsState.loading = true;
  renderDeliveryOpsPanel();

  deliveryOpsRequest = Promise.all([
    fetch(`${apiBase()}/cssapi/v1/case/delivery/ops-console`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preview_limit: 6,
        recovery_limit: deliveryOpsState.recoveryLimit || 8,
        days: 14
      })
    }).then(async (res) => {
      if (!res.ok) throw new Error(`delivery ops console request failed: ${res.status}`);
      return res.json();
    }),
    fetch(`${apiBase()}/cssapi/v1/case/delivery/subscriptions`).then(async (res) => {
      if (!res.ok) throw new Error(`subscriptions request failed: ${res.status}`);
      return res.json();
    }),
    fetch(`${apiBase()}/cssapi/v1/case/delivery/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 12 })
    }).then(async (res) => {
      if (!res.ok) throw new Error(`delivery logs request failed: ${res.status}`);
      return res.json();
    }),
    fetch(`${apiBase()}/cssapi/v1/case/delivery/recovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: deliveryOpsState.recoveryLimit || 8 })
    }).then(async (res) => {
      if (!res.ok) throw new Error(`delivery recovery request failed: ${res.status}`);
      return res.json();
    }),
    fetch(`${apiBase()}/health`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          return {
            ok: false,
            status: `HTTP ${res.status}`,
            checked_at: new Date().toISOString()
          };
        }
        const payload = await res.json();
        return {
          ...payload,
          checked_at: new Date().toISOString()
        };
      })
      .catch((error) => ({
        ok: false,
        status: String(error),
        checked_at: new Date().toISOString()
      }))
  ])
    .then(([opsConsolePayload, subscriptionsPayload, logsPayload, recoveryPayload, healthPayload]) => {
      deliveryOpsState.console = opsConsolePayload?.console || null;
      deliveryOpsState.health = normalizeDeliveryOpsHealth(healthPayload);
      deliveryOpsState.subscriptions = Array.isArray(subscriptionsPayload?.subscriptions)
        ? subscriptionsPayload.subscriptions
        : [];
      deliveryOpsState.logs = Array.isArray(logsPayload?.logs) ? logsPayload.logs : [];
      deliveryOpsState.recovery = recoveryPayload?.recovery || null;
      if (!deliveryOpsState.selectedSubscriptionId && deliveryOpsState.subscriptions.length) {
        deliveryOpsState.selectedSubscriptionId =
          deliveryOpsState.subscriptions[0]?.subscription_id || null;
      }
      if (!deliveryOpsState.subscriptions.length) {
        deliveryOpsState.selectedSubscriptionId = null;
        deliveryOpsState.executionStatus = null;
      }
      showToast(t("deliveryOps.loaded"));
    })
    .catch((error) => {
      deliveryOpsState.subscriptions = [];
      deliveryOpsState.console = null;
      deliveryOpsState.health = {
        ok: false,
        statusText: String(error),
        checkedAt: new Date().toISOString()
      };
      deliveryOpsState.selectedSubscriptionId = null;
      deliveryOpsState.executionStatus = null;
      deliveryOpsState.recovery = null;
      deliveryOpsState.logs = [
        {
          report_type: "error",
          succeeded: false,
          result_message: String(error),
          created_at: new Date().toISOString()
        }
      ];
    })
    .finally(() => {
      deliveryOpsState.loading = false;
      deliveryOpsRequest = null;
      renderDeliveryOpsPanel();
      if (deliveryOpsState.selectedSubscriptionId) {
        void loadDeliveryExecutionStatus(deliveryOpsState.selectedSubscriptionId, force);
      }
    });

  return deliveryOpsRequest;
}

async function loadDeliveryExecutionStatus(subscriptionId, force = false) {
  if (!subscriptionId) return null;
  if (
    !force &&
    deliveryOpsState.selectedSubscriptionId === subscriptionId &&
    deliveryOpsState.executionStatus
  ) {
    renderDeliveryOpsPanel();
    return deliveryOpsState.executionStatus;
  }

  deliveryOpsState.selectedSubscriptionId = subscriptionId;
  deliveryOpsState.executionStatusLoading = true;
  renderDeliveryOpsPanel();

  try {
    const response = await fetch(`${apiBase()}/cssapi/v1/case/delivery/execution-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription_id: subscriptionId })
    });
    if (!response.ok) {
      throw new Error(`execution status request failed: ${response.status}`);
    }
    const payload = await response.json();
    deliveryOpsState.executionStatus = payload?.status || null;
  } catch (error) {
    deliveryOpsState.executionStatus = {
      execution_state: "unknown",
      status: "unknown",
      subscription_id: subscriptionId,
      result_summary: String(error),
      summary: String(error),
      updated_at: new Date().toISOString()
    };
  } finally {
    deliveryOpsState.executionStatusLoading = false;
    renderDeliveryOpsPanel();
  }

  return deliveryOpsState.executionStatus;
}

async function runDeliverySubscriptionNow(subscriptionId) {
  showToast(t("deliveryOps.running"));
  await fetch(`${apiBase()}/cssapi/v1/case/delivery/subscriptions/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription_id: subscriptionId })
  });
  await loadDeliveryOps(true);
  await loadDeliveryExecutionStatus(subscriptionId, true);
}

async function runDeliveryRetry(request, subscriptionId = null) {
  showToast(t("deliveryOps.retryRunning"));
  try {
    const response = await fetch(`${apiBase()}/cssapi/v1/case/delivery/execution-retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      throw new Error(`delivery retry request failed: ${response.status}`);
    }
    const payload = await response.json();
    deliveryOpsState.retryResult = payload?.retry || null;
    showToast(t("deliveryOps.retryDone"));
    await loadDeliveryOps(true);
    if (subscriptionId) {
      await loadDeliveryExecutionStatus(subscriptionId, true);
    } else if (deliveryOpsState.selectedSubscriptionId) {
      await loadDeliveryExecutionStatus(deliveryOpsState.selectedSubscriptionId, true);
    } else {
      renderDeliveryOpsPanel();
    }
  } catch (error) {
    deliveryOpsState.retryResult = {
      retried: false,
      message: String(error),
      result_summary: String(error),
      succeeded: false
    };
    renderDeliveryOpsPanel();
    showToast(String(error));
  }
}

async function loadDeliveryReport(kind = deliveryReportState.kind, force = false) {
  deliveryReportState.kind = kind;
  deliveryExportState.result = null;
  deliveryExportState.deliveryMeta = null;
  renderDeliveryReportTabs();

  if (!force && deliveryReportRequest && deliveryReportPendingKind === kind) return deliveryReportRequest;
  if (
    !force &&
    deliveryReportState.response &&
    deliveryReportState.response?.meta?.kind === kind &&
    deliveryReportLoadedAt &&
    Date.now() - deliveryReportLoadedAt < 60000
  ) {
    globalThis.renderDeliveryReportsPanelModule?.();
    return deliveryReportState.response;
  }

  deliveryReportState.loading = true;
  deliveryReportState.deliveryMeta = null;
  if (!deliveryReportState.response || deliveryReportState.response?.meta?.kind !== kind) {
    deliveryReportState.response = null;
  }
  globalThis.renderDeliveryReportsPanelModule?.();

  deliveryReportPendingKind = kind;
  deliveryReportRequest = fetch(`${apiBase()}/cssapi/v1/case/delivery-v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      report_kind: kind,
      mode: "report",
      days: 14,
      preview_limit: 5
    })
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`delivery report request failed: ${res.status}`);
      }
      const payload = await res.json();
      const delivery = payload?.delivery || null;
      const response =
        delivery?.data?.payload_kind === "report" ? delivery?.data?.payload || null : null;
      deliveryReportState.deliveryMeta = delivery?.meta || null;
      deliveryReportState.response = response;
      deliveryReportLoadedAt = Date.now();
      return response;
    })
    .catch((error) => {
      deliveryReportState.response = {
        meta: {
          kind,
          title: t("reports.error"),
          generated_at: new Date().toISOString()
        },
        data: {
          payload_kind: kind,
          payload: {
            summary: String(error)
          }
        }
      };
      deliveryReportState.deliveryMeta = {
        report_kind: kind,
        mode: "report",
        generated_at: new Date().toISOString()
      };
      return deliveryReportState.response;
    })
    .finally(() => {
      deliveryReportState.loading = false;
      deliveryReportRequest = null;
      deliveryReportPendingKind = "";
      globalThis.renderDeliveryReportsPanelModule?.();
    });

  return deliveryReportRequest;
}

async function runDeliveryExport(force = false) {
  if (!isAdminUser()) {
    showToast(loginCopy("Only admins can generate new exports."));
    return null;
  }
  if (!force && deliveryExportRequest) return deliveryExportRequest;

  deliveryExportState.running = true;
  deliveryExportState.result = null;
  deliveryExportState.deliveryMeta = null;
  renderDeliveryExportPanel();

  if (deliveryExportState.source === "report_bundle") {
    deliveryExportRequest = fetch(`${apiBase()}/cssapi/v1/case/delivery/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "bundle",
        format: "json_package",
        today_yyyy_mm_dd: new Date().toISOString().slice(0, 10),
        days: 14,
        preview_limit: 5
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`delivery export request failed: ${res.status}`);
        }
        const payload = await res.json();
        deliveryExportState.result = payload?.export || null;
        deliveryExportState.deliveryMeta = {
          report_kind: "briefing_pack",
          mode: "export",
          generated_at: new Date().toISOString()
        };
        deliveryExportState.previewExpanded = false;
        pushDeliveryExportHistoryItem(deliveryExportState.result);
        return deliveryExportState.result;
      })
      .catch((error) => {
        deliveryExportState.result = { error: String(error) };
        deliveryExportState.deliveryMeta = {
          report_kind: "briefing_pack",
          mode: "export",
          generated_at: new Date().toISOString()
        };
        return deliveryExportState.result;
      })
      .finally(() => {
        deliveryExportState.running = false;
        deliveryExportRequest = null;
        renderDeliveryExportPanel();
      });

    return deliveryExportRequest;
  }

  deliveryExportRequest = fetch(`${apiBase()}/cssapi/v1/case/delivery-v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      deliveryExportState.source === "report_bundle"
        ? {
            report_kind: "briefing_pack",
            mode: "export",
            export_format: "json_package",
            days: 14,
            preview_limit: 5
          }
        : {
            report_kind: deliveryReportState.kind,
            mode: "export",
            export_format: deliveryExportState.format,
            days: 14,
            preview_limit: 5
          }
    )
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`delivery export request failed: ${res.status}`);
      }
      const payload = await res.json();
      const delivery = payload?.delivery || null;
      deliveryExportState.result =
        delivery?.data?.payload_kind === "export" ? delivery?.data?.payload || null : null;
      deliveryExportState.deliveryMeta = delivery?.meta || null;
      deliveryExportState.previewExpanded = false;
      pushDeliveryExportHistoryItem(deliveryExportState.result);
      return deliveryExportState.result;
    })
    .catch((error) => {
      deliveryExportState.result = { error: String(error) };
      deliveryExportState.deliveryMeta = {
        report_kind: deliveryReportState.kind,
        mode: "export",
        generated_at: new Date().toISOString()
      };
      return deliveryExportState.result;
    })
    .finally(() => {
      deliveryExportState.running = false;
      deliveryExportRequest = null;
      renderDeliveryExportPanel();
    });

  return deliveryExportRequest;
}
