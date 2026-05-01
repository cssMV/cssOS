function extractDecisionReasonsBridge(payload) {
  const explain = payload?.explain_detail || payload?.explainDetail;
  if (Array.isArray(explain?.reasons) && explain.reasons.length) {
    return explain.reasons;
  }

  const trace = payload?.decision_trace || payload?.decisionTrace;
  if (Array.isArray(trace?.rule_hits)) {
    return trace.rule_hits.filter((hit) => hit && hit.matched).map((hit) => hit.explanation);
  }

  return [];
}

function extractPolicyAuditLinesBridge(payload) {
  const audits = payload?.recent_policy_audits || payload?.recentPolicyAudits;
  if (!Array.isArray(audits) || !audits.length) {
    return [];
  }

  return audits.map((audit) => {
    const action = String(audit?.action || "unknown").replace(/_/g, " ");
    const actor = audit?.actor_user_id || "system";
    const time = audit?.created_at || "unknown time";
    return `${action} · ${actor} · ${time}`;
  });
}

function extractTrustBridge(payload) {
  return (
    payload?.workspace?.trust ||
    payload?.trust_detail ||
    payload?.trust ||
    payload?.trust_view ||
    payload?.trustView ||
    null
  );
}

function extractRiskBridge(payload) {
  return (
    payload?.workspace?.risk ||
    payload?.risk_detail ||
    payload?.risk ||
    payload?.risk_view ||
    payload?.riskView ||
    null
  );
}

function extractRiskFactorsBridge(payload) {
  const risk = extractRiskBridge(payload);
  const factors = Array.isArray(risk?.factors) ? risk.factors : [];
  const activeFactors = factors.filter((factor) => factor?.active);
  if (!activeFactors.length) {
    return [];
  }

  return activeFactors.map((factor) => {
    const title = factor?.title || factor?.key || "unknown factor";
    const explanation = factor?.explanation || factor?.message || "";
    return explanation ? `${title} · ${explanation}` : String(title);
  });
}

function extractAssuranceBridge(payload) {
  return (
    payload?.workspace?.assurance ||
    payload?.assurance_detail ||
    payload?.assurance ||
    payload?.assurance_view ||
    payload?.assuranceView ||
    null
  );
}

function extractResolutionBridge(payload) {
  return (
    payload?.workspace?.resolution ||
    payload?.resolution ||
    payload?.resolution_view ||
    payload?.resolutionView ||
    null
  );
}

function extractAssuranceMeasuresBridge(payload) {
  const assurance = extractAssuranceBridge(payload);
  const measures = Array.isArray(assurance?.measures) ? assurance.measures : [];
  return measures.filter(Boolean);
}

function extractResolutionReasonsBridge(payload) {
  const resolution = extractResolutionBridge(payload);
  const reasons = Array.isArray(resolution?.reasons) ? resolution.reasons : [];
  return reasons.filter(Boolean);
}

function resolutionBadgeLabelBridge(state) {
  const keyMap = {
    resolved: "cssmv.governance.resolution.resolved",
    stabilized: "cssmv.governance.resolution.stabilized",
    escalated: "cssmv.governance.resolution.escalated",
    under_manual_intervention: "cssmv.governance.resolution.underManualIntervention",
    monitoring_only: "cssmv.governance.resolution.monitoringOnly"
  };

  return t(keyMap[state] || "cssmv.governance.waitingResolutionBadge");
}

function extractAssuranceStateBridge(assurance) {
  if (!assurance) return "waiting";
  if (assurance?.requires_manual_intervention) return "manual";
  if (assurance?.is_in_mandatory_recovery_queue) return "recovery";
  if (assurance?.is_must_deliver_protected) return "protected";
  if (assurance?.is_under_watch) return "watch";
  return "normal";
}

function extractTimelineBridge(payload) {
  return globalThis.extractTimelineModule?.(payload) || null;
}

function extractMergedTimelineBridge(payload) {
  return globalThis.extractMergedTimelineModule?.(payload) || null;
}

function extractTimelineExplainBridge(payload) {
  return globalThis.extractTimelineExplainModule?.(payload) || null;
}

function timelineNodeTitleBridge(node) {
  return globalThis.timelineNodeTitleModule?.(node) || node?.title || t("cssmv.timeline.defaultTitle");
}

function timelineNodeBodyBridge(node) {
  return globalThis.timelineNodeBodyModule?.(node) || node?.body || node?.summary || "";
}

function timelineNodeTimestampBridge(node) {
  return globalThis.timelineNodeTimestampModule?.(node) || node?.created_at || node?.timestamp || "";
}

function renderTimelineNodesBridge(payload) {
  return globalThis.renderTimelineNodesModule?.(payload);
}

function renderMergedTimelineBridge(payload) {
  return globalThis.renderMergedTimelineModule?.(payload);
}

function renderTimelineExplainBridge(payload) {
  return globalThis.renderTimelineExplainModule?.(payload);
}

function extractWorkspaceBridge(payload) {
  return globalThis.extractWorkspaceModule?.(payload) || payload?.workspace || null;
}

function escapeHtmlBridge(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function extractAvailableActionsBridge(payload) {
  const delegated = globalThis.extractAvailableActionsModule?.(payload);
  if (Array.isArray(delegated)) return delegated;
  return Array.isArray(payload?.available_actions) ? payload.available_actions : [];
}

function extractRecentActionLogsBridge(payload) {
  const delegated = globalThis.extractRecentActionLogsModule?.(payload);
  if (Array.isArray(delegated)) return delegated;
  return Array.isArray(payload?.recent_action_logs) ? payload.recent_action_logs : [];
}

function actionKindLabelBridge(kind) {
  return globalThis.actionKindLabelModule?.(kind) || t("cssmv.actions.waiting");
}

function cssmvActionScopeBridge(kind) {
  return globalThis.cssmvActionScopeModule?.(kind) || "";
}

function renderAvailableActionsBridge(payload) {
  return globalThis.renderAvailableActionsModule?.(payload);
}

function renderRecentActionLogsBridge(payload) {
  return globalThis.renderRecentActionLogsModule?.(payload);
}

function renderDeliveryGovernancePulseBridge(payload = window.CSSMV_DELIVERY_INSPECTOR_PAYLOAD) {
  return globalThis.renderDeliveryGovernancePulseModule?.(payload);
}

function setDeliveryInspectorPayloadBridge(payload) {
  window.CSSMV_DELIVERY_INSPECTOR_PAYLOAD = payload;
  globalThis.renderDeliveryGovernancePulseModule?.(payload);
  globalThis.renderDeliveryDigestSummaryModule?.(
    payload?.report || window.CSSMV_DELIVERY_REPORT_BUNDLE || null
  );
}

Object.assign(globalThis, {
  extractDecisionReasonsBridge,
  extractDecisionReasons: extractDecisionReasonsBridge,
  extractPolicyAuditLinesBridge,
  extractPolicyAuditLines: extractPolicyAuditLinesBridge,
  extractTrustBridge,
  extractTrust: extractTrustBridge,
  extractRiskBridge,
  extractRisk: extractRiskBridge,
  extractRiskFactorsBridge,
  extractRiskFactors: extractRiskFactorsBridge,
  extractAssuranceBridge,
  extractAssurance: extractAssuranceBridge,
  extractResolutionBridge,
  extractResolution: extractResolutionBridge,
  extractAssuranceMeasuresBridge,
  extractAssuranceMeasures: extractAssuranceMeasuresBridge,
  extractResolutionReasonsBridge,
  extractResolutionReasons: extractResolutionReasonsBridge,
  resolutionBadgeLabelBridge,
  resolutionBadgeLabel: resolutionBadgeLabelBridge,
  extractAssuranceStateBridge,
  extractAssuranceState: extractAssuranceStateBridge,
  extractTimelineBridge,
  extractTimeline: extractTimelineBridge,
  extractMergedTimelineBridge,
  extractMergedTimeline: extractMergedTimelineBridge,
  extractTimelineExplainBridge,
  extractTimelineExplain: extractTimelineExplainBridge,
  timelineNodeTitleBridge,
  timelineNodeTitle: timelineNodeTitleBridge,
  timelineNodeBodyBridge,
  timelineNodeBody: timelineNodeBodyBridge,
  timelineNodeTimestampBridge,
  timelineNodeTimestamp: timelineNodeTimestampBridge,
  renderTimelineNodesBridge,
  renderTimelineNodes: renderTimelineNodesBridge,
  renderMergedTimelineBridge,
  renderMergedTimeline: renderMergedTimelineBridge,
  renderTimelineExplainBridge,
  renderTimelineExplain: renderTimelineExplainBridge,
  extractWorkspaceBridge,
  extractWorkspace: extractWorkspaceBridge,
  escapeHtmlBridge,
  escapeHtml: escapeHtmlBridge,
  extractAvailableActionsBridge,
  extractAvailableActions: extractAvailableActionsBridge,
  extractRecentActionLogsBridge,
  extractRecentActionLogs: extractRecentActionLogsBridge,
  actionKindLabelBridge,
  actionKindLabel: actionKindLabelBridge,
  cssmvActionScopeBridge,
  cssmvActionScope: cssmvActionScopeBridge,
  renderAvailableActionsBridge,
  renderAvailableActions: renderAvailableActionsBridge,
  renderRecentActionLogsBridge,
  renderRecentActionLogs: renderRecentActionLogsBridge,
  renderDeliveryGovernancePulseBridge,
  renderDeliveryGovernancePulse: renderDeliveryGovernancePulseBridge,
  setDeliveryInspectorPayloadBridge
});

window.CSSOS_setDeliveryInspectorPayload = function setDeliveryInspectorPayload(payload) {
  return setDeliveryInspectorPayloadBridge(payload);
};
