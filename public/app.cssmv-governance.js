const cssmvGovernanceT =
  typeof globalThis.t === "function"
    ? globalThis.t.bind(globalThis)
    : (key) => String(key || "");
const cssmvGovernanceLoginCopy =
  typeof globalThis.loginCopy === "function"
    ? globalThis.loginCopy.bind(globalThis)
    : (en, zh) => {
        const locale = String(globalThis.currentLocale || navigator.language || "en").toLowerCase();
        return locale.startsWith("zh") ? (zh || en || "") : (en || zh || "");
      };
const cssmvGovernanceHasPanelPermission =
  typeof globalThis.hasPanelPermission === "function"
    ? globalThis.hasPanelPermission.bind(globalThis)
    : () => true;
const cssmvGovernancePermissionPrompt =
  typeof globalThis.permissionPrompt === "function"
    ? globalThis.permissionPrompt.bind(globalThis)
    : () => "";
const cssmvGovernanceScopedT = cssmvGovernanceT;
const cssmvGovernanceScopedLoginCopy = cssmvGovernanceLoginCopy;
const cssmvGovernanceScopedHasPanelPermission = cssmvGovernanceHasPanelPermission;
const cssmvGovernanceScopedPermissionPrompt = cssmvGovernancePermissionPrompt;
function extractTimelineModule(payload) {
  return (
    payload?.workspace?.timeline ||
    payload?.timeline_detail ||
    payload?.timeline ||
    payload?.timeline_ui_model ||
    payload?.timelineUiModel ||
    null
  );
}

function extractMergedTimelineModule(payload) {
  return payload?.merged_timeline || payload?.mergedTimeline || null;
}

function extractTimelineExplainModule(payload) {
  return payload?.timeline_explain || payload?.timelineExplain || null;
}

function timelineNodeTitleModule(node) {
  return node?.title || cssmvGovernanceScopedT("cssmv.timeline.defaultTitle");
}

function timelineNodeBodyModule(node) {
  return node?.body || node?.summary || "";
}

function timelineNodeTimestampModule(node) {
  return node?.created_at || node?.timestamp || "";
}

function renderTimelineNodesModule(payload) {
  if (!mvTimelineSummary || !mvTimelineList) return;
  const timeline = extractTimelineModule(payload);
  const nodes = Array.isArray(timeline?.nodes) ? timeline.nodes : [];
  mvTimelineSummary.textContent =
    timeline?.summary || timeline?.headline || cssmvGovernanceScopedT("cssmv.timeline.waitingSummary");

  if (!nodes.length) {
    mvTimelineList.innerHTML = `
      <div class="mv-timeline-item is-waiting">
        <div class="mv-timeline-dot"></div>
        <div class="mv-timeline-copy">${cssmvGovernanceScopedT("cssmv.timeline.waitingNode")}</div>
      </div>
    `;
    return;
  }

  mvTimelineList.innerHTML = nodes
    .map((node) => {
      const status = String(node?.status || "neutral").toLowerCase();
      const flags = [];
      if (node?.is_turning_point) flags.push(cssmvGovernanceScopedT("cssmv.timeline.turningPoint"));
      if (node?.is_current) flags.push(cssmvGovernanceScopedT("cssmv.timeline.current"));

      return `
        <div class="mv-timeline-item status-${status} ${node?.is_current ? "is-current" : ""}">
          <div class="mv-timeline-dot"></div>
          <div class="mv-timeline-copy">
            <div class="mv-timeline-head">
              <div class="mv-timeline-title">${timelineNodeTitleModule(node)}</div>
              <div class="mv-timeline-meta">${timelineNodeTimestampModule(node)}</div>
            </div>
            <div class="mv-timeline-body">${timelineNodeBodyModule(node)}</div>
            ${
              flags.length
                ? `<div class="mv-timeline-flags">${flags
                    .map((flag) => `<span class="mv-timeline-flag">${flag}</span>`)
                    .join("")}</div>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMergedTimelineModule(payload) {
  if (!mvMergedTimelineSummary || !mvMergedTimelineList) return;

  const timeline = extractMergedTimelineModule(payload);
  const nodes = Array.isArray(timeline?.nodes) ? timeline.nodes : [];

  mvMergedTimelineSummary.textContent = timeline
    ? `${nodes.length} merged event${nodes.length === 1 ? "" : "s"}`
    : cssmvGovernanceScopedT("cssmv.timelineMerged.waitingSummary");

  if (!nodes.length) {
    mvMergedTimelineList.innerHTML = `
      <div class="mv-timeline-item is-waiting">
        <div class="mv-timeline-dot"></div>
        <div class="mv-timeline-copy">${cssmvGovernanceScopedT("cssmv.timelineMerged.waitingNode")}</div>
      </div>
    `;
    return;
  }

  mvMergedTimelineList.innerHTML = nodes
    .map((node) => {
      const tone = String(node?.tone || "neutral").toLowerCase();
      const kind = String(node?.kind || "").toLowerCase();
      const flags = [];
      if (node?.is_turning_point) flags.push(cssmvGovernanceScopedT("cssmv.timeline.turningPoint"));
      if (kind === "signal_state") flags.push(cssmvGovernanceScopedT("cssmv.timelineMerged.signal"));
      if (kind === "action") flags.push(cssmvGovernanceScopedT("cssmv.timelineMerged.action"));
      if (Array.isArray(node?.badges)) {
        flags.push(...node.badges.filter(Boolean));
      }

      return `
        <div class="mv-timeline-item status-${tone}">
          <div class="mv-timeline-dot"></div>
          <div class="mv-timeline-copy">
            <div class="mv-timeline-head">
              <div class="mv-timeline-title">${escapeHtml(timelineNodeTitleModule(node))}</div>
              <div class="mv-timeline-meta">${escapeHtml(timelineNodeTimestampModule(node))}</div>
            </div>
            <div class="mv-timeline-body">${escapeHtml(timelineNodeBodyModule(node))}</div>
            ${
              flags.length
                ? `<div class="mv-timeline-flags">${flags
                    .map((flag) => `<span class="mv-timeline-flag">${escapeHtml(flag)}</span>`)
                    .join("")}</div>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTimelineExplainModule(payload) {
  if (!mvTimelineExplainSummary || !mvTimelineExplainList) return;

  const explain = extractTimelineExplainModule(payload);
  const nodes = Array.isArray(explain?.explained_nodes) ? explain.explained_nodes : [];

  mvTimelineExplainSummary.textContent =
    explain?.summary || cssmvGovernanceScopedT("cssmv.timelineExplain.waitingSummary");

  if (!nodes.length) {
    mvTimelineExplainList.innerHTML = `
      <div class="mv-timeline-item is-waiting">
        <div class="mv-timeline-dot"></div>
        <div class="mv-timeline-copy">${cssmvGovernanceScopedT("cssmv.timelineExplain.waitingNode")}</div>
      </div>
    `;
    return;
  }

  mvTimelineExplainList.innerHTML = nodes
    .map((node) => {
      const role = String(node?.role || "informational").toLowerCase();
      let roleLabel = cssmvGovernanceScopedT("cssmv.timelineExplain.recordOnly");
      if (role === "key_turning_point") roleLabel = cssmvGovernanceScopedT("cssmv.timelineExplain.turningPoint");
      if (role === "decisive") roleLabel = cssmvGovernanceScopedT("cssmv.timelineExplain.decisive");

      return `
        <div class="mv-timeline-item">
          <div class="mv-timeline-dot"></div>
          <div class="mv-timeline-copy">
            <div class="mv-timeline-head">
              <div class="mv-timeline-title">${escapeHtml(node?.title || cssmvGovernanceScopedT("cssmv.timeline.defaultTitle"))}</div>
              <div class="mv-timeline-meta">${escapeHtml(node?.timestamp || "")}</div>
            </div>
            <div class="mv-timeline-body">${escapeHtml(node?.explanation || "")}</div>
            <div class="mv-timeline-flags">
              <span class="mv-timeline-flag">${escapeHtml(roleLabel)}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function extractWorkspaceModule(payload) {
  return payload?.workspace || null;
}

function extractAvailableActionsModule(payload) {
  return Array.isArray(payload?.available_actions) ? payload.available_actions : [];
}

function extractRecentActionLogsModule(payload) {
  return Array.isArray(payload?.recent_action_logs) ? payload.recent_action_logs : [];
}

function actionKindLabelModule(kind) {
  const map = {
    retry: "cssmv.actions.retry",
    force_refresh_signals: "cssmv.actions.forceRefreshSignals",
    capture_snapshot: "cssmv.actions.captureSnapshot",
    escalate_ops: "cssmv.actions.escalateOps",
    require_manual_intervention: "cssmv.actions.requireManualIntervention"
  };

  return cssmvGovernanceScopedT(map[String(kind || "").toLowerCase()] || "cssmv.actions.waiting");
}

function cssmvActionScopeModule(kind) {
  const normalized = String(kind || "").trim().toLowerCase();
  if (!normalized) return "";
  return `cssmv.action.${normalized}`;
}

function renderAvailableActionsModule(payload) {
  if (!mvActionsList) return;
  const actions = extractAvailableActionsModule(payload);
  if (!actions.length) {
    mvActionsList.innerHTML = `<span class="mv-action-chip is-waiting">${cssmvGovernanceScopedT("cssmv.actions.waiting")}</span>`;
    return;
  }

  mvActionsList.innerHTML = actions
    .map((action) => {
      const scope = cssmvActionScopeModule(action?.kind);
      const enabled = action?.enabled !== false;
      const permitted = cssmvGovernanceScopedHasPanelPermission(scope);
      const reason = !permitted ? cssmvGovernanceScopedPermissionPrompt(scope) : enabled ? "" : cssmvGovernanceScopedT("cssmv.actions.waiting");
      return `
        <button
          class="mv-action-chip ${enabled && permitted ? "" : "is-disabled"}"
          type="button"
          data-cssmv-action="${escapeHtml(String(action?.kind || ""))}"
          title="${escapeHtml(reason)}"
          ${(enabled && permitted) ? "" : "disabled"}
        >
          ${actionKindLabelModule(action?.kind)}
        </button>
      `;
    })
    .join("");
  mvActionsList.querySelectorAll("[data-cssmv-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.getAttribute("data-cssmv-action") || "";
      const scope = cssmvActionScopeModule(kind);
      if (!cssmvGovernanceScopedHasPanelPermission(scope)) {
        showToast(cssmvGovernanceScopedPermissionPrompt(scope));
        return;
      }
      showToast(cssmvGovernanceScopedLoginCopy(`CSSMV action "${actionKindLabelModule(kind)}" will route through the live backend when this control is connected.`, `CSSMV 动作“${actionKindLabelModule(kind)}”在该控制接入后会直连到实时后端执行。`));
    });
  });
}

function renderRecentActionLogsModule(payload) {
  if (!mvActionLogList) return;

  const logs = extractRecentActionLogsModule(payload);
  if (!logs.length) {
    mvActionLogList.innerHTML = `<div class="mv-action-log-item is-waiting">${cssmvGovernanceScopedT("cssmv.actionLog.empty")}</div>`;
    return;
  }

  mvActionLogList.innerHTML = logs
    .map((log) => {
      const actionLabel = actionKindLabelModule(log?.action);
      const resultLabel = log?.success ? cssmvGovernanceScopedT("cssmv.actionLog.success") : cssmvGovernanceScopedT("cssmv.actionLog.failed");
      const timeLabel = log?.created_at || "";
      const body = log?.result_message || "";
      const reason = log?.reason ? `<div class="mv-action-log-body">${escapeHtml(log.reason)}</div>` : "";

      return `
        <div class="mv-action-log-item">
          <div class="mv-action-log-head">
            <div class="mv-action-log-kind">${actionLabel} · ${resultLabel}</div>
            <div class="mv-action-log-time">${escapeHtml(timeLabel)}</div>
          </div>
          <div class="mv-action-log-body">${escapeHtml(body)}</div>
          ${reason}
        </div>
      `;
    })
    .join("");
}

function renderDeliveryGovernancePulseModule(payload = window.CSSMV_DELIVERY_INSPECTOR_PAYLOAD) {
  const activePolicy = payload?.active_policy || payload?.activePolicy;
  const policyVersion =
    activePolicy?.version || activePolicy?.policy_version_id || cssmvGovernanceScopedT("cssmv.governance.waitingPolicyVersion");
  if (mvPolicyVersion) mvPolicyVersion.textContent = policyVersion;

  const workspace = extractWorkspaceModule(payload);
  if (mvWorkspaceTitle) {
    mvWorkspaceTitle.textContent =
      workspace?.header?.title || cssmvGovernanceScopedT("cssmv.workspace.waitingTitle");
  }
  if (mvWorkspaceSummary) {
    mvWorkspaceSummary.textContent =
      workspace?.header?.summary || cssmvGovernanceScopedT("cssmv.workspace.waitingSummary");
  }

  const trust = extractTrust(payload);
  if (mvTrustBadge) {
    const trustLevel = String(trust?.trust_level || trust?.trustLevel || "waiting").toLowerCase();
    mvTrustBadge.textContent =
      trustLevel === "waiting" ? cssmvGovernanceScopedT("cssmv.governance.waitingTrustBadge") : `Trust ${trustLevel}`;
    mvTrustBadge.classList.remove("healthy", "guarded", "risky", "untrusted");
    if (["healthy", "guarded", "risky", "untrusted"].includes(trustLevel)) {
      mvTrustBadge.classList.add(trustLevel);
    }
  }
  if (mvTrustSummary) {
    mvTrustSummary.textContent = trust?.summary || cssmvGovernanceScopedT("cssmv.governance.waitingTrustState");
  }

  const risk = extractRisk(payload);
  if (mvRiskBadge) {
    const riskLevel = String(risk?.risk_level || risk?.riskLevel || "waiting").toLowerCase();
    mvRiskBadge.textContent =
      riskLevel === "waiting" ? cssmvGovernanceScopedT("cssmv.governance.waitingRiskBadge") : `Risk ${riskLevel}`;
    mvRiskBadge.classList.remove("low", "medium", "high", "critical");
    if (["low", "medium", "high", "critical"].includes(riskLevel)) {
      mvRiskBadge.classList.add(riskLevel);
    }
  }
  if (mvRiskSummary) {
    mvRiskSummary.textContent = risk?.summary || cssmvGovernanceScopedT("cssmv.governance.waitingRiskState");
  }

  const assurance = extractAssurance(payload);
  if (mvAssuranceBadge) {
    const assuranceState = extractAssuranceState(assurance);
    mvAssuranceBadge.textContent =
      assuranceState === "waiting"
        ? cssmvGovernanceScopedT("cssmv.governance.waitingAssuranceBadge")
        : `Assurance ${assuranceState}`;
    mvAssuranceBadge.classList.remove("normal", "watch", "protected", "manual", "recovery");
    if (["normal", "watch", "protected", "manual", "recovery"].includes(assuranceState)) {
      mvAssuranceBadge.classList.add(assuranceState);
    }
  }
  if (mvAssuranceSummary) {
    mvAssuranceSummary.textContent =
      assurance?.summary || cssmvGovernanceScopedT("cssmv.governance.waitingAssuranceState");
  }

  const resolution = extractResolution(payload);
  if (mvResolutionBadge) {
    const resolutionState = String(resolution?.state || "waiting").toLowerCase();
    mvResolutionBadge.textContent =
      resolutionState === "waiting"
        ? cssmvGovernanceScopedT("cssmv.governance.waitingResolutionBadge")
        : resolutionBadgeLabel(resolutionState);
    mvResolutionBadge.classList.remove(
      "resolved",
      "stabilized",
      "escalated",
      "under_manual_intervention",
      "monitoring_only"
    );
    if (
      [
        "resolved",
        "stabilized",
        "escalated",
        "under_manual_intervention",
        "monitoring_only"
      ].includes(resolutionState)
    ) {
      mvResolutionBadge.classList.add(resolutionState);
    }
  }
  if (mvResolutionSummary) {
    mvResolutionSummary.textContent =
      resolution?.summary || cssmvGovernanceScopedT("cssmv.governance.waitingResolutionState");
  }

  renderPulseList(
    mvDecisionReasons,
    extractDecisionReasons(payload),
    cssmvGovernanceScopedT("cssmv.governance.waitingDecisionReasons")
  );
  renderPulseList(
    mvRiskFactors,
    extractRiskFactors(payload),
    cssmvGovernanceScopedT("cssmv.governance.waitingRiskFactors")
  );
  renderPulseList(
    mvAssuranceMeasures,
    extractAssuranceMeasures(payload),
    cssmvGovernanceScopedT("cssmv.governance.waitingAssuranceMeasures")
  );
  renderPulseList(
    mvResolutionReasons,
    extractResolutionReasons(payload),
    cssmvGovernanceScopedT("cssmv.governance.waitingResolutionReasons")
  );
  renderPulseList(
    mvPolicyAudits,
    extractPolicyAuditLines(payload),
    cssmvGovernanceScopedT("cssmv.governance.waitingPolicyAudits")
  );

  renderAvailableActionsModule(payload);
  renderRecentActionLogsModule(payload);
  renderTimelineNodesModule(payload);
  renderMergedTimelineModule(payload);
  renderTimelineExplainModule(payload);
}

window.extractTimelineModule = extractTimelineModule;
window.extractMergedTimelineModule = extractMergedTimelineModule;
window.extractTimelineExplainModule = extractTimelineExplainModule;
window.timelineNodeTitleModule = timelineNodeTitleModule;
window.timelineNodeBodyModule = timelineNodeBodyModule;
window.timelineNodeTimestampModule = timelineNodeTimestampModule;
window.extractWorkspaceModule = extractWorkspaceModule;
window.extractAvailableActionsModule = extractAvailableActionsModule;
window.extractRecentActionLogsModule = extractRecentActionLogsModule;
window.renderTimelineNodesModule = renderTimelineNodesModule;
window.renderMergedTimelineModule = renderMergedTimelineModule;
window.renderTimelineExplainModule = renderTimelineExplainModule;
window.actionKindLabelModule = actionKindLabelModule;
window.cssmvActionScopeModule = cssmvActionScopeModule;
window.renderAvailableActionsModule = renderAvailableActionsModule;
window.renderRecentActionLogsModule = renderRecentActionLogsModule;
window.renderDeliveryGovernancePulseModule = renderDeliveryGovernancePulseModule;
window.CSSOS_setDeliveryInspectorPayload = function setDeliveryInspectorPayload(payload) {
  window.CSSMV_DELIVERY_INSPECTOR_PAYLOAD = payload;
  renderDeliveryGovernancePulseModule(payload);
  renderDeliveryDigestSummaryModule(payload?.report || window.CSSMV_DELIVERY_REPORT_BUNDLE || null);
};

renderDeliveryGovernancePulseModule();
renderDeliveryDigestSummaryModule(window.CSSMV_DELIVERY_REPORT_BUNDLE || null);
