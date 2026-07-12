function bindMusicDeliveryPreviewButtonsModule() {
  if (!deliveryDashboardBody) return;
  deliveryDashboardBody.querySelectorAll("[data-delivery-preview]").forEach((button) => {
    button.addEventListener("click", () => {
      const raw = button.getAttribute("data-delivery-preview");
      if (!raw) return;
      try {
        const item = JSON.parse(raw);
        void previewMusicDeliveryArtifact(item);
      } catch (error) {
        console.warn("Invalid delivery preview payload", error);
      }
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-probe-incident-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const payload = buildWatchArchiveIncidentExportBundle(
        deliveryDashboardState.probeSummary,
        deliveryDashboardState.probeHistory
      );
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `zh_probe_incident_bundle_${stamp}.json`;
      downloadJsonArtifact(payload, fileName);
      deliveryDashboardState.probeExportReceipts = [
        ...(Array.isArray(deliveryDashboardState.probeExportReceipts)
          ? deliveryDashboardState.probeExportReceipts
          : []),
        {
          at: new Date().toISOString(),
          fileName
        }
      ];
      renderMusicDeliveryDashboard();
    });
  });
  const probeNotesInput = deliveryDashboardBody.querySelector("[data-delivery-probe-operator-notes]");
  if (probeNotesInput) {
    probeNotesInput.addEventListener("input", () => {
      deliveryDashboardState.probeOperatorNotes = String(probeNotesInput.value || "");
    });
  }
  deliveryDashboardBody.querySelectorAll("[data-delivery-probe-handoff-ack]").forEach((button) => {
    button.addEventListener("click", () => {
      deliveryDashboardState.probeHandoffAcknowledgments = [
        ...(Array.isArray(deliveryDashboardState.probeHandoffAcknowledgments)
          ? deliveryDashboardState.probeHandoffAcknowledgments
          : []),
        {
          at: new Date().toISOString(),
          note: String(deliveryDashboardState.probeOperatorNotes || "").trim()
        }
      ];
      renderMusicDeliveryDashboard();
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-probe-dispatch-done]").forEach((button) => {
    button.addEventListener("click", () => {
      const at = new Date().toISOString();
      deliveryDashboardState.probeDispatchDoneAt = at;
      deliveryDashboardState.probeDispatchHistory = [
        ...(Array.isArray(deliveryDashboardState.probeDispatchHistory)
          ? deliveryDashboardState.probeDispatchHistory
          : []),
        { at }
      ];
      showToast(dashboardCopy("Dispatch marked done"));
      renderMusicDeliveryDashboard();
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-probe-dispatch-history-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const payload = {
        exported_at: new Date().toISOString(),
        dispatch_history: Array.isArray(deliveryDashboardState.probeDispatchHistory)
          ? deliveryDashboardState.probeDispatchHistory
          : []
      };
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `zh_probe_dispatch_history_${stamp}.json`;
      downloadJsonArtifact(payload, fileName);
      deliveryDashboardState.probeDispatchHistoryExportAt = payload.exported_at;
      showToast(dashboardCopy("Dispatch history exported"));
      renderMusicDeliveryDashboard();
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-probe-receipt-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const latestReceipt = Array.isArray(deliveryDashboardState.probeExportReceipts)
        ? deliveryDashboardState.probeExportReceipts.slice(-1)[0]
        : null;
      const body = latestReceipt
        ? `${latestReceipt.at} · ${latestReceipt.fileName}`
        : dashboardCopy("No export receipt is available yet.");
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(body);
        } else {
          const fallback = document.createElement("textarea");
          fallback.value = body;
          document.body.appendChild(fallback);
          fallback.select();
          document.execCommand("copy");
          fallback.remove();
        }
        const at = new Date().toISOString();
        deliveryDashboardState.probeReceiptCopiedAt = at;
        deliveryDashboardState.probeReceiptCopyHistory = [
          ...(Array.isArray(deliveryDashboardState.probeReceiptCopyHistory)
            ? deliveryDashboardState.probeReceiptCopyHistory
            : []),
          {
            at,
            fileName: String(latestReceipt?.fileName || "")
          }
        ];
        showToast(dashboardCopy("Receipt copied"));
        renderMusicDeliveryDashboard();
      } catch {
        showToast(dashboardCopy("Receipt copy failed"));
      }
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-probe-followup-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const body = String(button.getAttribute("data-delivery-probe-followup-copy") || "");
      if (!body) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(body);
        } else {
          const fallback = document.createElement("textarea");
          fallback.value = body;
          document.body.appendChild(fallback);
          fallback.select();
          document.execCommand("copy");
          fallback.remove();
        }
        const at = new Date().toISOString();
        deliveryDashboardState.probeFollowUpCopiedAt = at;
        deliveryDashboardState.probeFollowUpCopyHistory = [
          ...(Array.isArray(deliveryDashboardState.probeFollowUpCopyHistory)
            ? deliveryDashboardState.probeFollowUpCopyHistory
            : []),
          {
            at,
            note: body
          }
        ];
        showToast(dashboardCopy("Follow-up copied"));
        renderMusicDeliveryDashboard();
      } catch {
        showToast(dashboardCopy("Follow-up copy failed"));
      }
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-probe-compare-select]").forEach((select) => {
    select.addEventListener("change", () => {
      const slot = String(select.getAttribute("data-delivery-probe-compare-select") || "");
      if (slot === "A") {
        deliveryDashboardState.probeTimelineCompareA = String(select.value || "");
      } else if (slot === "B") {
        deliveryDashboardState.probeTimelineCompareB = String(select.value || "");
      }
      renderMusicDeliveryDashboard();
    });
  });
}

function bindMusicDeliveryMixerButtonsModule(stemItems, arrangementItem, phraseItem) {
  if (!deliveryDashboardBody) return;
  const stems = Array.isArray(stemItems) ? stemItems : [];
  const arrangement = arrangementItem || null;
  const phrase = phraseItem || null;
  const loadButton = deliveryDashboardBody.querySelector("[data-delivery-mixer-load]");
  if (loadButton) {
    loadButton.addEventListener("click", () => {
      void loadMusicDeliveryMixer(stems);
    });
  }
  const timelineButton = deliveryDashboardBody.querySelector("[data-delivery-arrangement-load]");
  if (timelineButton) {
    timelineButton.addEventListener("click", () => {
      if (arrangement) {
        void loadMusicDeliveryArrangement(arrangement, phrase);
      }
    });
  }
  const playButton = deliveryDashboardBody.querySelector("[data-delivery-mixer-play]");
  if (playButton) {
    playButton.addEventListener("click", () => {
      void startMusicDeliveryMixerPlayback();
    });
  }
  const stopButton = deliveryDashboardBody.querySelector("[data-delivery-mixer-stop]");
  if (stopButton) {
    stopButton.addEventListener("click", () => {
      stopMusicDeliveryMixerPlayback();
      renderMusicDeliveryDashboard();
    });
  }
  deliveryDashboardBody.querySelectorAll("[data-delivery-mixer-mute]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-delivery-mixer-mute");
      if (!key) return;
      setMusicDeliveryMixerTrackToggle(key, "muted");
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-mixer-solo]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-delivery-mixer-solo");
      if (!key) return;
      setMusicDeliveryMixerTrackToggle(key, "solo");
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-mixer-gain]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.getAttribute("data-delivery-mixer-gain");
      if (!key) return;
      setMusicDeliveryMixerTrackGain(key, input.value);
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-section-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.getAttribute("data-delivery-section-pick");
      if (!sectionId) return;
      setMusicDeliverySelectedSection(sectionId);
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-section-play]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.getAttribute("data-delivery-section-play");
      if (!sectionId) return;
      void playMusicDeliverySection(sectionId, false);
    });
  });
  const loopToggle = deliveryDashboardBody.querySelector("[data-delivery-loop-toggle]");
  if (loopToggle) {
    loopToggle.addEventListener("change", () => {
      setMusicDeliveryLoopSection(loopToggle.checked);
    });
  }
  const loopPlay = deliveryDashboardBody.querySelector("[data-delivery-loop-play]");
  if (loopPlay) {
    loopPlay.addEventListener("click", () => {
      const sectionId = deliveryDashboardState.selectedSection || currentMusicDeliverySections()[0]?.id || "";
      if (!sectionId) return;
      void playMusicDeliverySection(sectionId, true);
    });
  }
  deliveryDashboardBody.querySelectorAll("[data-delivery-compare-select]").forEach((select) => {
    select.addEventListener("change", () => {
      const slot = select.getAttribute("data-delivery-compare-select");
      if (!slot) return;
      setMusicDeliveryCompareSlot(slot, select.value);
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-compare-play]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = button.getAttribute("data-delivery-compare-play");
      if (!slot) return;
      const sectionId =
        slot === "A" ? deliveryDashboardState.compareA : deliveryDashboardState.compareB;
      if (!sectionId) return;
      void playMusicDeliverySection(sectionId, false);
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-role-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.getAttribute("data-delivery-role-focus");
      if (!role) return;
      applyMusicDeliveryRoleFocus(role);
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-role-audition]").forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.getAttribute("data-delivery-role-audition");
      if (!role) return;
      void playMusicDeliveryRoleFocus(role);
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-phrase-audition]").forEach((button) => {
    button.addEventListener("click", () => {
      const phraseId = button.getAttribute("data-delivery-phrase-audition");
      if (!phraseId) return;
      void playMusicDeliveryPhrase(phraseId);
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-phrase-compare-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const phraseId = button.getAttribute("data-delivery-phrase-compare-select");
      const slot = button.getAttribute("data-delivery-phrase-compare-slot");
      if (!phraseId || !slot) return;
      setMusicDeliveryPhraseCompareSlot(slot, phraseId);
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-phrase-compare-play]").forEach((button) => {
    button.addEventListener("click", () => {
      const phraseId = button.getAttribute("data-delivery-phrase-compare-play");
      if (!phraseId) return;
      void playMusicDeliveryPhrase(phraseId);
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-chord-audition]").forEach((button) => {
    button.addEventListener("click", () => {
      const chordSlot = button.getAttribute("data-delivery-chord-audition");
      if (!chordSlot) return;
      void playMusicDeliveryChordSlot(chordSlot);
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-articulation-audition]").forEach((button) => {
    button.addEventListener("click", () => {
      const articulation = button.getAttribute("data-delivery-articulation-audition");
      if (!articulation) return;
      void playMusicDeliveryArticulation(articulation);
    });
  });
  const clearRoleFocusButton = deliveryDashboardBody.querySelector("[data-delivery-role-clear]");
  if (clearRoleFocusButton) {
    clearRoleFocusButton.addEventListener("click", () => {
      clearMusicDeliveryRoleFocus();
    });
  }
  deliveryDashboardBody.querySelectorAll("[data-delivery-rewrite-assist]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = String(button.getAttribute("data-delivery-rewrite-assist") || "");
      deliveryDashboardState.rewriteAssistMode =
        deliveryDashboardState.rewriteAssistMode === mode ? "" : mode;
      renderMusicDeliveryDashboard();
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-rewrite-payload-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = String(button.getAttribute("data-delivery-rewrite-payload-mode") || "provider");
      deliveryDashboardState.rewritePayloadMode = mode || "provider";
      renderMusicDeliveryDashboard();
    });
  });
  deliveryDashboardBody.querySelectorAll("[data-delivery-rewrite-phrase-play]").forEach((button) => {
    button.addEventListener("click", () => {
      const phraseId = String(button.getAttribute("data-delivery-rewrite-phrase-play") || "");
      if (!phraseId) return;
      void playMusicDeliveryPhrase(phraseId);
    });
  });
  const sandboxApply = deliveryDashboardBody.querySelector("[data-delivery-rewrite-sandbox-apply]");
  if (sandboxApply) {
    sandboxApply.addEventListener("click", () => {
      const mode = String(sandboxApply.getAttribute("data-delivery-rewrite-sandbox-apply") || "mutation");
      const selectedSection =
        findMusicDeliverySection(deliveryDashboardState.selectedSection) || currentMusicDeliverySections()[0] || null;
      const sectionPhrases = currentMusicDeliverySectionPhrases(selectedSection?.id);
      const comparePhraseA =
        findMusicDeliveryPhrase(deliveryDashboardState.phraseCompareA, selectedSection?.id) ||
        sectionPhrases[0] ||
        null;
      const comparePhraseB =
        findMusicDeliveryPhrase(deliveryDashboardState.phraseCompareB, selectedSection?.id) ||
        sectionPhrases[1] ||
        sectionPhrases[0] ||
        null;
      const drafts =
        mode === "reharmonize"
          ? reharmonizationDraftForPair(comparePhraseA, comparePhraseB, selectedSection)
          : mode === "counter"
            ? counterMelodyDraftForPair(comparePhraseA, comparePhraseB)
            : phraseMutationPresetsForPair(comparePhraseA, comparePhraseB);
      applyMusicDeliveryRewriteSandbox({
        arrangementData: deliveryDashboardState.arrangementData,
        mode,
        providerPayload: buildProviderReadyRewritePayload({
          mode,
          drafts,
          comparePhraseA,
          comparePhraseB,
          selectedSection
        }),
        cuePatchPlan: buildCueSheetPatchPlan({
          mode,
          drafts,
          comparePhraseA,
          comparePhraseB,
          selectedSection
        }),
        selectedSection
      });
    });
  }
  const sandboxClear = deliveryDashboardBody.querySelector("[data-delivery-rewrite-sandbox-clear]");
  if (sandboxClear) {
    sandboxClear.addEventListener("click", () => {
      clearMusicDeliveryRewriteSandbox();
    });
  }
}

Object.assign(globalThis, {
  bindMusicDeliveryPreviewButtons: bindMusicDeliveryPreviewButtonsModule,
  bindMusicDeliveryMixerButtons: bindMusicDeliveryMixerButtonsModule
});
