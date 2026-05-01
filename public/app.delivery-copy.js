function currentUiLangBridge() {
  return String(window.CSS_UI_LANG || document.documentElement.lang || "en").toLowerCase();
}

function dashboardCopyBridge(en, _zh) {
  // P2-60 English-SSOT: route dashboard-copy bridge through tr() when available.
  // Falls back to the legacy en/zh branch only if the i18n runtime is missing.
  try {
    if (typeof globalThis.tr === "function") {
      return String(globalThis.tr(en));
    }
  } catch (_err) { /* fall through */ }
  return currentUiLangBridge().startsWith("zh") ? (_zh ?? en) : en;
}

function formatBlockedPublishMessageBridge(detail, trace) {
  const gateState = String(detail?.gate_state || trace?.gate_state || "missing");
  const tokenStatus = String(detail?.token_status || trace?.token_status || "missing");
  const authorizationState = String(
    detail?.authorization_state || trace?.authorization_state || "missing"
  );
  const missingSteps = Array.isArray(detail?.missing_steps) ? detail.missing_steps : [];
  const lastApprover = trace?.last_approver || null;
  const lastApproverSummary = lastApprover
    ? `${String(lastApprover.actor_name || lastApprover.actor_id || "unknown")} (${String(
        lastApprover.actor_role || "unknown"
      )})`
    : dashboardCopyBridge("none yet", "尚无");
  const reasonLine = missingSteps.length
    ? `${dashboardCopyBridge("Missing steps", "缺失环节")}: ${missingSteps.join(", ")}`
    : `${dashboardCopyBridge("Gate summary", "门禁状态")}: gate=${gateState}, token=${tokenStatus}, authorization=${authorizationState}`;
  return dashboardCopyBridge(
    `Publish is blocked. ${reasonLine}. Last approver: ${lastApproverSummary}.`,
    `发布已被拦截。${reasonLine}。最后放行人：${lastApproverSummary}。`
  );
}

async function parseArrangementReleaseErrorBridge(action, res) {
  let payload = null;
  try {
    payload = await res.json();
  } catch {}
  if (action === "publish" && res.status === 403) {
    const detail = payload?.details || payload?.detail || payload || null;
    const trace = deliveryDashboardState.response?.approval_to_publish_trace || null;
    return formatBlockedPublishMessageBridge(detail, trace);
  }
  const code = payload?.code ? ` (${String(payload.code)})` : "";
  const message = payload?.message || payload?.error || "";
  return message
    ? `arrangement revision ${action} failed: ${res.status}${code} ${String(message)}`
    : `arrangement revision ${action} failed: ${res.status}${code}`;
}

window.currentUiLangBridge = currentUiLangBridge;
window.dashboardCopyBridge = dashboardCopyBridge;
window.formatBlockedPublishMessageBridge = formatBlockedPublishMessageBridge;
window.parseArrangementReleaseErrorBridge = parseArrangementReleaseErrorBridge;
