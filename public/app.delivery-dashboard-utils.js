(function attachDeliveryDashboardUtils(global) {
  const dashboardCopy = (...args) => global.dashboardCopy(...args);

  function buildWatchArchiveCrossBorderAnomalyAlertBridge(probeSummary) {
    const payload = probeSummary && typeof probeSummary === "object" ? probeSummary : null;
    const conclusion = payload?.conclusion || {};
    const verdict = String(conclusion?.verdict || "");
    const severe = verdict === "cross_border_path_anomaly";
    return {
      level: severe ? dashboardCopy("alert", "告警") : dashboardCopy("normal", "正常"),
      title: severe
        ? dashboardCopy("Cross-border path anomaly detected", "检测到跨境链路异常")
        : dashboardCopy("No cross-border anomaly detected", "当前未检测到跨境异常"),
      summary:
        conclusion?.summary ||
        dashboardCopy("No cross-border anomaly summary yet.", "当前还没有跨境异常摘要。"),
      note: severe
        ? dashboardCopy(
            "gzvm path is healthy, but non-gzvm public paths are still failing. This looks more like a network-path issue than a server crash.",
            "gzvm 路径健康，但非 gzvm 的公网路径仍在失败，更像链路问题，不像服务器宕机。"
          )
        : dashboardCopy(
            "Current probe set does not show a strong cross-border anomaly signal.",
            "当前探针集没有显示明显的跨境异常信号。"
          )
    };
  }

  function buildWatchSnapshotDiffBridge(a, b) {
    if (!a || !b) return null;
    const aJournal = Array.isArray(a?.payload?.watch_outcome_journal) ? a.payload.watch_outcome_journal.length : 0;
    const bJournal = Array.isArray(b?.payload?.watch_outcome_journal) ? b.payload.watch_outcome_journal.length : 0;
    const aRollback = Array.isArray(a?.payload?.rollback_decision_audit_trail)
      ? a.payload.rollback_decision_audit_trail.length
      : 0;
    const bRollback = Array.isArray(b?.payload?.rollback_decision_audit_trail)
      ? b.payload.rollback_decision_audit_trail.length
      : 0;
    const aFlags = Array.isArray(a?.payload?.compliance_flags) ? a.payload.compliance_flags.length : 0;
    const bFlags = Array.isArray(b?.payload?.compliance_flags) ? b.payload.compliance_flags.length : 0;
    return {
      schema: "cssmv.watch_snapshot_diff.v1",
      from_snapshot: a.version_name,
      to_snapshot: b.version_name,
      journal_delta: bJournal - aJournal,
      rollback_decision_delta: bRollback - aRollback,
      compliance_flag_delta: bFlags - aFlags
    };
  }

  function isPanelVisibleBridge(panel) {
    return !!panel && !panel.classList.contains("hidden");
  }

  function persistMusicDeliveryDashboardRunIdBridge(runId) {
    try {
      if (runId) {
        localStorage.setItem(global.DELIVERY_DASHBOARD_RUN_ID_KEY, runId);
      } else {
        localStorage.removeItem(global.DELIVERY_DASHBOARD_RUN_ID_KEY);
      }
    } catch (_error) {
      // ignore
    }
  }

  function restoreMusicDeliveryDashboardRunIdBridge() {
    try {
      const cached = localStorage.getItem(global.DELIVERY_DASHBOARD_RUN_ID_KEY) || "";
      if (cached) {
        global.deliveryDashboardState.runId = cached;
      }
    } catch (_error) {
      // ignore
    }
    if (global.deliveryDashboardRunId) {
      global.deliveryDashboardRunId.value = global.deliveryDashboardState.runId || "";
    }
  }

  function extractRunIdBridge(value) {
    if (!value || typeof value !== "object") return "";
    return String(
      value.run_id ||
        value.runId ||
        value?.data?.run_id ||
        value?.data?.runId ||
        value?.run?.run_id ||
        value?.run?.runId ||
        ""
    ).trim();
  }

  function latestAppliedRewritePromotionBridge() {
    const promotions = Array.isArray(global.deliveryDashboardState.response?.rewrite_promotions)
      ? global.deliveryDashboardState.response.rewrite_promotions
      : [];
    return promotions.find((entry) => entry?.apply_back_result?.status === "applied_back") || null;
  }

  global.buildWatchArchiveCrossBorderAnomalyAlertBridge = buildWatchArchiveCrossBorderAnomalyAlertBridge;
  global.buildWatchSnapshotDiffBridge = buildWatchSnapshotDiffBridge;
  global.isPanelVisibleBridge = isPanelVisibleBridge;
  global.persistMusicDeliveryDashboardRunIdBridge = persistMusicDeliveryDashboardRunIdBridge;
  global.restoreMusicDeliveryDashboardRunIdBridge = restoreMusicDeliveryDashboardRunIdBridge;
  global.extractRunIdBridge = extractRunIdBridge;
  global.latestAppliedRewritePromotionBridge = latestAppliedRewritePromotionBridge;
})(globalThis);
