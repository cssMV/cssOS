(function attachMusicDeliveryActions(global) {
  const dashboardCopy = (...args) => global.dashboardCopy(...args);

  async function persistMusicWatchSnapshotBridge(kind, payload, versionName = "") {
    const runId = String(global.deliveryDashboardState.runId || "").trim();
    if (!runId || !payload) return null;
    try {
      const res = await fetch(
        `${global.apiBase()}/cssapi/v1/runs/${encodeURIComponent(runId)}/music-watch-snapshots`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json"
          },
          body: JSON.stringify({
            version_name: String(versionName || "").trim() || undefined,
            payload: {
              ...payload,
              kind
            }
          })
        }
      );
      if (!res.ok) {
        throw new Error(`watch snapshot save failed: ${res.status}`);
      }
      await global.loadMusicDeliveryDashboard(runId, true);
      return await res.json();
    } catch (error) {
      global.deliveryDashboardState.arrangementRevisionActionError = String(error);
      global.renderMusicDeliveryDashboard();
      return null;
    }
  }

  async function loadCrossRunWatchSnapshotsBridge(runId) {
    const targetRunId = String(runId || "").trim();
    if (!targetRunId) return null;
    try {
      // CSSOS_PHASE2_404_SILENCE 20260504 — skip non-UUID runIds.
      const isServerRunId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetRunId);
      if (!isServerRunId) return null;
      const res = await fetch(
        `${global.apiBase()}/cssapi/v1/runs/${encodeURIComponent(targetRunId)}/music-delivery-dashboard`,
        { headers: { accept: "application/json" } }
      );
      if (!res.ok) {
        throw new Error(`cross-run watch snapshot load failed: ${res.status}`);
      }
      const payload = await res.json();
      global.deliveryDashboardState.crossRunIncidentRunId = targetRunId;
      global.deliveryDashboardState.crossRunIncidentSnapshots = Array.isArray(payload?.watch_snapshots)
        ? payload.watch_snapshots
        : [];
      global.renderMusicDeliveryDashboard();
      return payload;
    } catch (error) {
      global.deliveryDashboardState.arrangementRevisionActionError = String(error);
      global.renderMusicDeliveryDashboard();
      return null;
    }
  }

  async function runMusicArrangementRevisionActionBridge(action, revisionId) {
    const runId = String(global.deliveryDashboardState.runId || "").trim();
    if (!runId || !revisionId || !action) return null;
    global.deliveryDashboardState.arrangementRevisionActionSaving = true;
    global.deliveryDashboardState.arrangementRevisionActionError = "";
    global.renderMusicDeliveryDashboard();
    try {
      const res = await fetch(
        `${global.apiBase()}/cssapi/v1/runs/${encodeURIComponent(runId)}/music-arrangement-revisions/${encodeURIComponent(action)}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json"
          },
          body: JSON.stringify({ revision_id: revisionId })
        }
      );
      if (!res.ok) {
        throw new Error(await global.parseArrangementReleaseError(action, res));
      }
      const payload = await res.json();
      global.deliveryDashboardState.arrangementRevisionFocus = String(payload?.revision?.revision_id || "");
      await global.loadMusicDeliveryDashboard(runId, true);
      return payload;
    } catch (error) {
      global.deliveryDashboardState.arrangementRevisionActionError = String(error);
      global.renderMusicDeliveryDashboard();
      return null;
    } finally {
      global.deliveryDashboardState.arrangementRevisionActionSaving = false;
      global.renderMusicDeliveryDashboard();
    }
  }

  async function runMusicArrangementReleaseActionBridge(action, revisionId, candidateName = "") {
    const runId = String(global.deliveryDashboardState.runId || "").trim();
    if (!runId || !revisionId || !action) return null;
    global.deliveryDashboardState.arrangementRevisionActionSaving = true;
    global.deliveryDashboardState.arrangementRevisionActionError = "";
    global.renderMusicDeliveryDashboard();
    try {
      const res = await fetch(
        `${global.apiBase()}/cssapi/v1/runs/${encodeURIComponent(runId)}/music-arrangement-revisions/${encodeURIComponent(action)}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json"
          },
          body: JSON.stringify({
            revision_id: revisionId,
            candidate_name: String(candidateName || "").trim() || undefined
          })
        }
      );
      if (!res.ok) {
        throw new Error(await global.parseArrangementReleaseError(action, res));
      }
      const payload = await res.json();
      global.deliveryDashboardState.arrangementRevisionFocus = String(payload?.entry?.revision_id || revisionId);
      if (payload?.entry?.candidate_name) {
        global.deliveryDashboardState.arrangementReleaseCandidateName = String(payload.entry.candidate_name || "");
      }
      if (action === "publish") {
        global.deliveryDashboardState.publishConfirmationArmed = false;
        global.deliveryDashboardState.publishRunbookStatus = "";
        global.deliveryDashboardState.publishSimulationSummary = "";
      }
      await global.loadMusicDeliveryDashboard(runId, true);
      return payload;
    } catch (error) {
      global.deliveryDashboardState.arrangementRevisionActionError = String(error);
      global.renderMusicDeliveryDashboard();
      return null;
    } finally {
      global.deliveryDashboardState.arrangementRevisionActionSaving = false;
      global.renderMusicDeliveryDashboard();
    }
  }

  async function runMusicComplianceActionBridge(action, options = {}) {
    const runId = String(global.deliveryDashboardState.runId || "").trim();
    if (!runId || !action) return null;
    global.deliveryDashboardState.error = "";
    global.renderMusicDeliveryDashboard();
    try {
      const res = await fetch(
        `${global.apiBase()}/cssapi/v1/runs/${encodeURIComponent(runId)}/music-compliance-actions`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json"
          },
          body: JSON.stringify({
            action,
            candidate_id: options.candidateId || undefined,
            target_path: options.targetPath || undefined,
            target_team: options.targetTeam || undefined,
            note: options.note || undefined,
            active_kid: options.activeKid || undefined,
            secret_keyset: options.secretKeyset || undefined,
            vendor: options.vendor || undefined,
            required_fields: options.requiredFields || undefined,
            optional_fields: options.optionalFields || undefined,
            field_defaults: options.fieldDefaults || undefined,
            reopen_reason: options.reopenReason || undefined,
            preset_name: options.presetName || undefined,
            scoped_permissions: options.scopedPermissions || undefined,
            actor_id:
              options.actorId || String(global.deliveryDashboardState.complianceActorId || "").trim() || undefined,
            actor_name:
              options.actorName || String(global.deliveryDashboardState.complianceActorName || "").trim() || undefined,
            actor_role:
              options.actorRole || String(global.deliveryDashboardState.complianceActorRole || "").trim() || undefined,
            actor_directory: options.actorDirectory || undefined,
            role_policy_name: options.rolePolicyName || undefined,
            approval_decision: options.approvalDecision || undefined,
            approver_routing: options.approverRouting || undefined,
            required_signers: options.requiredSigners || undefined,
            quorum_name: options.quorumName || undefined
          })
        }
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`compliance action ${action} failed: ${res.status}${detail ? ` ${detail}` : ""}`);
      }
      const payload = await res.json();
      await global.loadMusicDeliveryDashboard(runId, true);
      return payload;
    } catch (error) {
      global.deliveryDashboardState.error = String(error);
      global.renderMusicDeliveryDashboard();
      return null;
    }
  }

  async function runPublishRunbookAutomationBridge(context = {}) {
    const {
      publishCandidateId,
      currentActor,
      suggestedActor,
      missingSignerRoles,
      readinessChecklist,
      approvalToPublishTrace
    } = context;
    global.deliveryDashboardState.publishRunbookStatus = dashboardCopy(
      "Running guided publish runbook...",
      "正在执行引导式发布 runbook..."
    );
    global.renderMusicDeliveryDashboard();
    try {
      const actorForApproval =
        suggestedActor && missingSignerRoles.includes(String(suggestedActor?.actor_role || "").toLowerCase())
          ? suggestedActor
          : currentActor;
      const actorRole = String(actorForApproval?.actor_role || "").trim().toLowerCase();
      if (missingSignerRoles.includes(actorRole)) {
        const approved = await global.runMusicComplianceAction("approve_compliance_action", {
          candidateId: publishCandidateId || undefined,
          actorId: actorForApproval?.actor_id || undefined,
          actorName: actorForApproval?.actor_name || undefined,
          actorRole: actorForApproval?.actor_role || undefined,
          approvalDecision: "approved",
          note: "Approval recorded from guided publish runbook"
        });
        if (!approved) {
          global.deliveryDashboardState.publishRunbookStatus = dashboardCopy(
            "Runbook paused because the approval step did not complete.",
            "runbook 已暂停，因为签发步骤没有完成。"
          );
          global.renderMusicDeliveryDashboard();
          return null;
        }
      }
      const requiredSigners = Array.isArray(approvalToPublishTrace?.required_signers)
        ? approvalToPublishTrace.required_signers
        : [];
      const quorumReady = readinessChecklist.find((item) => item.id === "quorum")?.ready;
      if (!quorumReady) {
        const finalized = await global.runMusicComplianceAction("finalize_release_quorum", {
          candidateId: publishCandidateId || undefined,
          actorId: actorForApproval?.actor_id || undefined,
          actorName: actorForApproval?.actor_name || undefined,
          actorRole: actorForApproval?.actor_role || undefined,
          quorumName: String(global.deliveryDashboardState.complianceQuorumName || "").trim() || "final-release-gate",
          requiredSigners: requiredSigners.length ? requiredSigners : undefined,
          note: "Release quorum checked from guided publish runbook"
        });
        if (!finalized) {
          global.deliveryDashboardState.publishRunbookStatus = dashboardCopy(
            "Runbook paused because the final gate step did not complete.",
            "runbook 已暂停，因为最终门禁步骤没有完成。"
          );
          global.renderMusicDeliveryDashboard();
          return null;
        }
      }
      global.deliveryDashboardState.publishRunbookStatus = dashboardCopy(
        "Guided publish runbook finished. Review the refreshed checklist before you publish.",
        "引导式发布 runbook 已完成。发布前请再确认刷新后的清单。"
      );
      global.renderMusicDeliveryDashboard();
      return true;
    } catch (_error) {
      global.deliveryDashboardState.publishRunbookStatus = dashboardCopy(
        "Guided publish runbook stopped because one of the recovery steps failed.",
        "引导式发布 runbook 已停止，因为其中一个补救步骤失败了。"
      );
      global.renderMusicDeliveryDashboard();
      return null;
    }
  }

  async function playMusicDeliveryRoleFocusBridge(role, sectionId = global.deliveryDashboardState.selectedSection) {
    global.applyMusicDeliveryRoleFocus(role);
    if (sectionId) {
      await global.playMusicDeliverySection(sectionId, false);
      return;
    }
    await global.startMusicDeliveryMixerPlayback();
  }

  async function playMusicDeliveryPhraseBridge(phraseId, sectionId = global.deliveryDashboardState.selectedSection) {
    const phrase = global.applyMusicDeliveryPhraseFocus(phraseId, sectionId);
    if (!phrase) return;
    await global.startMusicDeliveryMixerPlayback({
      startSec: phrase.startSec,
      durationSec: Math.max(0.15, phrase.endSec - phrase.startSec),
      label: phrase.id,
      loop: false
    });
  }

  async function playMusicDeliveryChordSlotBridge(chordSlot, sectionId = global.deliveryDashboardState.selectedSection) {
    const phrases = global.applyMusicDeliveryChordSlotFocus(chordSlot, sectionId);
    if (!phrases.length) return;
    const startSec = Math.min(...phrases.map((phrase) => phrase.startSec));
    const endSec = Math.max(...phrases.map((phrase) => phrase.endSec));
    await global.startMusicDeliveryMixerPlayback({
      startSec,
      durationSec: Math.max(0.15, endSec - startSec),
      label: chordSlot,
      loop: false
    });
  }

  async function playMusicDeliveryArticulationBridge(articulation, sectionId = global.deliveryDashboardState.selectedSection) {
    const phrases = global.applyMusicDeliveryArticulationFocus(articulation, sectionId);
    if (!phrases.length) return;
    const startSec = Math.min(...phrases.map((phrase) => phrase.startSec));
    const endSec = Math.max(...phrases.map((phrase) => phrase.endSec));
    await global.startMusicDeliveryMixerPlayback({
      startSec,
      durationSec: Math.max(0.15, endSec - startSec),
      label: articulation,
      loop: false
    });
  }

  async function playMusicDeliverySectionBridge(sectionId, loop = false) {
    const section = global.findMusicDeliverySection(sectionId);
    if (!section) return;
    global.deliveryDashboardState.selectedSection = section.id;
    global.deliveryDashboardState.loopSection = !!loop;
    await global.startMusicDeliveryMixerPlayback({
      startSec: section.startSec,
      durationSec: section.durationSec,
      label: section.label,
      loop
    });
  }

  global.persistMusicWatchSnapshotBridge = persistMusicWatchSnapshotBridge;
  global.loadCrossRunWatchSnapshotsBridge = loadCrossRunWatchSnapshotsBridge;
  global.runMusicArrangementRevisionActionBridge = runMusicArrangementRevisionActionBridge;
  global.runMusicArrangementReleaseActionBridge = runMusicArrangementReleaseActionBridge;
  global.runMusicComplianceActionBridge = runMusicComplianceActionBridge;
  global.runPublishRunbookAutomationBridge = runPublishRunbookAutomationBridge;
  global.playMusicDeliveryRoleFocusBridge = playMusicDeliveryRoleFocusBridge;
  global.playMusicDeliveryPhraseBridge = playMusicDeliveryPhraseBridge;
  global.playMusicDeliveryChordSlotBridge = playMusicDeliveryChordSlotBridge;
  global.playMusicDeliveryArticulationBridge = playMusicDeliveryArticulationBridge;
  global.playMusicDeliverySectionBridge = playMusicDeliverySectionBridge;
})(globalThis);
