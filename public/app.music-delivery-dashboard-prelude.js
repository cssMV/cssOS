function renderMusicDeliveryDashboardPreludeBridge() {
  if (deliveryDashboardRunId) {
    deliveryDashboardRunId.value = deliveryDashboardState.runId || "";
  }
  if (!deliveryDashboardMeta || !deliveryDashboardSummary || !deliveryDashboardBody) {
    return { aborted: true };
  }

  const response = deliveryDashboardState.response;
  const dashboard = response?.dashboard || null;
  const receipt = response?.receipt_sync || null;
  const executor = response?.publish_executor || null;
  const downstream = response?.downstream_delivery || null;
  const complianceLane = response?.compliance_dashboard_lane || null;
  const complianceFlags = Array.isArray(response?.compliance_exception_flags)
    ? response.compliance_exception_flags
    : [];
  const complianceClock = response?.compliance_sla_clock || null;
  const complianceAlertRouting = response?.compliance_alert_routing || null;
  const complianceEscalationPolicy = response?.compliance_escalation_policy || null;
  const complianceOperatorActions = Array.isArray(response?.compliance_operator_actions)
    ? response.compliance_operator_actions
    : [];
  const complianceWebhookDispatch = response?.compliance_webhook_dispatch || null;
  const complianceTicketMapping = response?.compliance_ticket_mapping || null;
  const complianceAckReconciliation = response?.compliance_ack_reconciliation || null;
  const complianceRotationControl = response?.compliance_rotation_control || null;
  const complianceVendorRegistry = response?.compliance_vendor_registry || null;
  const complianceReopenControl = response?.compliance_reopen_control || null;
  const compliancePresetControl = response?.compliance_preset_control || null;
  const complianceAuditLog = response?.compliance_audit_log || null;
  const complianceScopedPermissions = response?.compliance_scoped_permissions || {};
  const complianceActorIdentity = response?.compliance_actor_identity || null;
  const compliancePermissionCheck = response?.compliance_permission_check || null;
  const complianceAuditSignature = response?.compliance_audit_signature || null;
  const complianceActorDirectory = response?.compliance_actor_directory || null;
  const complianceRolePolicyPresets = response?.compliance_role_policy_presets || [];
  const complianceApprovalChain = response?.compliance_approval_chain || null;
  const complianceApproverRouting = response?.compliance_approver_routing || [];
  const complianceRequiredSigners = response?.compliance_required_signers || [];
  const complianceReleaseQuorum = response?.compliance_release_quorum || null;
  const complianceLockedPublishGate = response?.compliance_locked_publish_gate || null;
  const complianceReleaseUnblockToken = response?.compliance_release_unblock_token || null;
  const complianceImmutablePublishAuthorization =
    response?.compliance_immutable_publish_authorization || null;
  const blockedPublishExplainer = response?.blocked_publish_explainer || null;
  const approvalToPublishTrace = response?.approval_to_publish_trace || null;
  const artifactPaths = response?.artifact_paths || {};
  const runId = deliveryDashboardState.runId || "";
  const complianceActiveKidValue =
    deliveryDashboardState.complianceActiveKid ||
    complianceRotationControl?.active_kid ||
    complianceWebhookDispatch?.rotation?.active_kid ||
    "";
  const complianceKeysetValue =
    deliveryDashboardState.complianceKeyset || complianceRotationControl?.keyset || "";
  const complianceVendorValue =
    deliveryDashboardState.complianceVendor ||
    complianceVendorRegistry?.vendor ||
    complianceTicketMapping?.vendor ||
    "local";
  const complianceRequiredFieldsValue =
    deliveryDashboardState.complianceRequiredFields ||
    (Array.isArray(complianceVendorRegistry?.required_fields)
      ? complianceVendorRegistry.required_fields.join(", ")
      : "");
  const complianceOptionalFieldsValue =
    deliveryDashboardState.complianceOptionalFields ||
    (Array.isArray(complianceVendorRegistry?.optional_fields)
      ? complianceVendorRegistry.optional_fields.join(", ")
      : "");
  const complianceFieldDefaultsValue =
    deliveryDashboardState.complianceFieldDefaults ||
    JSON.stringify(
      complianceVendorRegistry?.field_defaults || complianceTicketMapping?.template_fields || {},
      null,
      2
    );
  const complianceReopenReasonValue =
    deliveryDashboardState.complianceReopenReason ||
    complianceReopenControl?.reopen_reason ||
    complianceAckReconciliation?.reopen_reason ||
    "";
  const compliancePresetNameValue =
    deliveryDashboardState.compliancePresetName ||
    compliancePresetControl?.preset_name ||
    "default-ops";
  const compliancePermissionRotateValue =
    deliveryDashboardState.compliancePermissionRotate ||
    complianceScopedPermissions?.rotate_secret ||
    "admin";
  const compliancePermissionRegistryValue =
    deliveryDashboardState.compliancePermissionRegistry ||
    complianceScopedPermissions?.update_ticket_registry ||
    "editor";
  const compliancePermissionReopenValue =
    deliveryDashboardState.compliancePermissionReopen ||
    complianceScopedPermissions?.reopen_compliance ||
    "operator";
  const complianceActorIdValue =
    deliveryDashboardState.complianceActorId ||
    complianceActorIdentity?.actor_identity?.actor_id ||
    "";
  const complianceActorNameValue =
    deliveryDashboardState.complianceActorName ||
    complianceActorIdentity?.actor_identity?.actor_name ||
    "";
  const complianceActorRoleValue =
    deliveryDashboardState.complianceActorRole ||
    complianceActorIdentity?.actor_identity?.actor_role ||
    "admin";
  const complianceActorDirectoryValue =
    deliveryDashboardState.complianceActorDirectory ||
    JSON.stringify(
      Array.isArray(complianceActorDirectory?.directory)
        ? complianceActorDirectory.directory
        : Array.isArray(complianceActorDirectory)
          ? complianceActorDirectory
          : [],
      null,
      2
    );
  const complianceRolePolicyNameValue =
    deliveryDashboardState.complianceRolePolicyName ||
    compliancePresetControl?.preset_name ||
    "default-ops";
  const complianceApprovalDecisionValue =
    deliveryDashboardState.complianceApprovalDecision || complianceApprovalChain?.approval_decision || "approved";
  const complianceApprovalNoteValue =
    deliveryDashboardState.complianceApprovalNote ||
    complianceApprovalChain?.approval_note ||
    "";
  const complianceApproverRoutingValue =
    deliveryDashboardState.complianceApproverRouting ||
    JSON.stringify(Array.isArray(complianceApproverRouting) ? complianceApproverRouting : [], null, 2);
  const complianceRequiredSignersValue =
    deliveryDashboardState.complianceRequiredSigners ||
    (Array.isArray(complianceRequiredSigners) ? complianceRequiredSigners.join(", ") : "");
  const complianceQuorumNameValue =
    deliveryDashboardState.complianceQuorumName ||
    complianceReleaseQuorum?.quorum_name ||
    "final-release-gate";

  if (!runId) {
    deliveryDashboardMeta.textContent = t("reports.musicDeliveryDashboard.metaWaiting");
    deliveryDashboardSummary.textContent = t("reports.musicDeliveryDashboard.waiting");
    deliveryDashboardBody.innerHTML = `<div class="report-empty">${escapeHtml(t("reports.musicDeliveryDashboard.empty"))}</div>`;
    return { aborted: true };
  }

  if (deliveryDashboardState.loading && !response) {
    deliveryDashboardMeta.textContent = `run_id=${runId}`;
    deliveryDashboardSummary.textContent = t("reports.musicDeliveryDashboard.loading");
    deliveryDashboardBody.innerHTML = `<div class="report-empty">${escapeHtml(t("reports.musicDeliveryDashboard.loadingBody"))}</div>`;
    return { aborted: true };
  }

  if (deliveryDashboardState.error && !response) {
    deliveryDashboardMeta.textContent = `run_id=${runId}`;
    deliveryDashboardSummary.textContent = t("reports.musicDeliveryDashboard.unavailable");
    deliveryDashboardBody.innerHTML = `<div class="report-empty">${escapeHtml(
      deliveryDashboardState.error
    )}</div>`;
    return { aborted: true };
  }

  const runStatus = String(response?.status || "unknown");
  const publishState = String(dashboard?.state || "awaiting_assets");
  const backend = String(dashboard?.backend || downstream?.backend || "pending");
  const jobId = dashboard?.job_id || receipt?.job_id || "";
  const publishUrl = dashboard?.publish_url || receipt?.publish_url || "";
  const latestAction = String(dashboard?.latest_action || executor?.action || "waiting");
  const notes = Array.isArray(dashboard?.notes) ? dashboard.notes.filter(Boolean) : [];
  const packageBrowser = Array.isArray(response?.package_browser) ? response.package_browser : [];
  const preview = deliveryDashboardState.previewData;
  const stemItems = packageBrowser.filter((item) => String(item?.category || "") === "stems");
  const arrangementItems = packageBrowser.filter((item) => String(item?.category || "") === "arrangement");
  const latestAppliedPromotion = latestAppliedRewritePromotion();
  const revisionFiles = Array.isArray(latestAppliedPromotion?.apply_back_result?.revision_files)
    ? latestAppliedPromotion.apply_back_result.revision_files
    : [];
  const revisionItems = packageBrowser.filter((item) => String(item?.category || "") === "arrangement_revision");
  const arrangementItem =
    (revisionFiles[0]
      ? findMusicDeliveryArrangementItem(
          revisionItems,
          String(revisionFiles[0]).split("/").pop() || ""
        )
      : null) ||
    findMusicDeliveryArrangementItem(arrangementItems, "audio_provider_cue_sheet.json") ||
    arrangementItems[0] ||
    null;
  const phraseItem =
    (revisionFiles[1]
      ? findMusicDeliveryArrangementItem(
          revisionItems,
          String(revisionFiles[1]).split("/").pop() || ""
        )
      : null) ||
    findMusicDeliveryArrangementItem(arrangementItems, "audio_provider_phrase_map.json");

  deliveryDashboardMeta.textContent = `run_id=${runId} · run_status=${runStatus} · backend=${backend}`;
  deliveryDashboardSummary.textContent = dashboard?.publish_complete
    ? t("reports.musicDeliveryDashboard.published")
    : dashboard?.ready_for_delivery
      ? t("reports.musicDeliveryDashboard.ready")
      : latestAppliedPromotion
        ? t("reports.musicDeliveryDashboard.rewriteActive", {
            name: latestAppliedPromotion.version_name || latestAppliedPromotion.bundle_id || t("reports.musicDeliveryDashboard.revision")
          })
      : t("reports.musicDeliveryDashboard.pipelineFilling");

  const rows = [
    ["Publish state", escapeHtml(publishState)],
    ["Latest action", escapeHtml(latestAction)],
    ["Ready for delivery", escapeHtml(dashboard?.ready_for_delivery ? "yes" : "no")],
    ["Publish complete", escapeHtml(dashboard?.publish_complete ? "yes" : "no")],
    ["Receipt synced", escapeHtml(receipt?.synced ? "yes" : "no")],
    ["Job ID", escapeHtml(jobId || "pending")],
    ["Publish link", publishUrl ? `<a href="${escapeHtml(publishUrl)}" target="_blank" rel="noreferrer">Open</a>` : escapeHtml("pending")],
    ["Receipt path", escapeHtml(dashboard?.receipt_path || receipt?.receipt_path || "pending")],
    ["Artifacts", escapeHtml(Object.keys(artifactPaths).length ? Object.keys(artifactPaths).join(", ") : "pending")]
  ];

  const noteItems = notes.length
    ? notes.map((item) => `<div class="report-list-item">${escapeHtml(String(item))}</div>`).join("")
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy("No dashboard notes yet.", "当前还没有面板备注。")
      )}</div>`;

  const browserGroups = ["stems", "arrangement", "arrangement_revision", "release", "vocals", "rehearsal", "post", "receipt", "publish", "package"]
    .map((category) => ({
      category,
      items: packageBrowser.filter((item) => String(item?.category || "") === category)
    }))
    .filter((group) => group.items.length);

  const browserHtml = browserGroups.length
    ? browserGroups
        .map((group) => globalThis.buildDeliveryBrowserGroupMarkup?.(group.category, group.items, runId) || "")
        .filter(Boolean)
        .join("")
    : `<div class="report-empty">${escapeHtml(
        dashboardCopy("No package artifacts are available yet.", "当前还没有可浏览的交付资产。")
      )}</div>`;

  return {
    aborted: false,
    response,
    dashboard,
    receipt,
    executor,
    downstream,
    complianceLane,
    complianceFlags,
    complianceClock,
    complianceAlertRouting,
    complianceEscalationPolicy,
    complianceOperatorActions,
    complianceWebhookDispatch,
    complianceTicketMapping,
    complianceAckReconciliation,
    complianceRotationControl,
    complianceVendorRegistry,
    complianceReopenControl,
    compliancePresetControl,
    complianceAuditLog,
    complianceScopedPermissions,
    complianceActorIdentity,
    compliancePermissionCheck,
    complianceAuditSignature,
    complianceActorDirectory,
    complianceRolePolicyPresets,
    complianceApprovalChain,
    complianceApproverRouting,
    complianceRequiredSigners,
    complianceReleaseQuorum,
    complianceLockedPublishGate,
    complianceReleaseUnblockToken,
    complianceImmutablePublishAuthorization,
    blockedPublishExplainer,
    approvalToPublishTrace,
    artifactPaths,
    runId,
    complianceActiveKidValue,
    complianceKeysetValue,
    complianceVendorValue,
    complianceRequiredFieldsValue,
    complianceOptionalFieldsValue,
    complianceFieldDefaultsValue,
    complianceReopenReasonValue,
    compliancePresetNameValue,
    compliancePermissionRotateValue,
    compliancePermissionRegistryValue,
    compliancePermissionReopenValue,
    complianceActorIdValue,
    complianceActorNameValue,
    complianceActorRoleValue,
    complianceActorDirectoryValue,
    complianceRolePolicyNameValue,
    complianceApprovalDecisionValue,
    complianceApprovalNoteValue,
    complianceApproverRoutingValue,
    complianceRequiredSignersValue,
    complianceQuorumNameValue,
    runStatus,
    publishState,
    backend,
    jobId,
    publishUrl,
    latestAction,
    notes,
    packageBrowser,
    preview,
    stemItems,
    arrangementItems,
    latestAppliedPromotion,
    revisionFiles,
    revisionItems,
    arrangementItem,
    phraseItem,
    rows,
    noteItems,
    browserGroups,
    browserHtml
  };
}

globalThis.renderMusicDeliveryDashboardPreludeBridge = renderMusicDeliveryDashboardPreludeBridge;
