async function loadMusicDeliveryDashboardModule(
  runId = deliveryDashboardState.runId,
  force = false
) {
  const normalizedRunId = String(runId || "").trim();
  if (!normalizedRunId) {
    revokeMusicDeliveryPreviewUrl();
    await closeMusicDeliveryMixerContext();
    resetMusicDeliveryMixerState();
    deliveryDashboardState.runId = "";
    deliveryDashboardState.response = null;
    deliveryDashboardState.error = "";
    deliveryDashboardState.previewKey = "";
    deliveryDashboardState.previewData = null;
    deliveryDashboardState.previewError = "";
    renderMusicDeliveryDashboard();
    return null;
  }

  if (!force && deliveryDashboardRequest && deliveryDashboardState.runId === normalizedRunId) {
    return deliveryDashboardRequest;
  }

  if (deliveryDashboardState.runId && deliveryDashboardState.runId !== normalizedRunId) {
    revokeMusicDeliveryPreviewUrl();
    await closeMusicDeliveryMixerContext();
    resetMusicDeliveryMixerState();
    deliveryDashboardState.previewKey = "";
    deliveryDashboardState.previewData = null;
    deliveryDashboardState.previewError = "";
  }
  deliveryDashboardState.runId = normalizedRunId;
  deliveryDashboardState.loading = true;
  deliveryDashboardState.error = "";
  persistMusicDeliveryDashboardRunId(normalizedRunId);
  renderMusicDeliveryDashboard();

  // CSSOS_PHASE2_404_SILENCE 20260504 — Jing
  // "每次输出作品都出现，肯定影响系统". The dashboard endpoint IS
  // registered server-side, but it requires a persisted run-state file
  // produced by the rust pipeline. Frontend-generated run IDs (e.g.
  // mv-1777942167434, "preview-...", anything from the JS pipeline)
  // never persist a run-state file and so always 404 — and a 404
  // response body, even when caught at the JS layer, still gets
  // painted as a red entry in DevTools network tab. The .catch() only
  // suppresses the JS rejection, not the browser's network log.
  //
  // Skip the fetch entirely unless the runId looks like a real
  // server-side run (currently produced as UUID v4 by the rust pipeline).
  // Frontend-generated IDs are prefixed mv-, preview-, run-, watch-.
  const isServerRunId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedRunId);
  const dashboardFetch = isServerRunId
    ? fetch(
        `${apiBase()}/cssapi/v1/runs/${encodeURIComponent(normalizedRunId)}/music-delivery-dashboard`,
        { method: "GET", headers: { accept: "application/json" }, cache: "no-store" }
      ).catch(() => null)
    : Promise.resolve(null);
  const probeFetch = fetch("/ops/zh-probe-latest.json", {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store"
  }).catch(() => null);
  const probeHistoryFetch = fetch("/ops/zh-probe-history.json", {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store"
  }).catch(() => null);

  deliveryDashboardRequest = Promise.all([dashboardFetch, probeFetch, probeHistoryFetch])
    .then(async ([res, probeRes, probeHistoryRes]) => {
      if (!res || !res.ok) {
        // 404 means endpoint not registered server-side; treat as
        // gracefully empty rather than throw red errors.
        return;
      }
      const payload = await res.json();
      deliveryDashboardState.response = payload || null;
      if (probeRes && probeRes.ok) {
        deliveryDashboardState.probeSummary = await probeRes.json().catch(() => null);
        deliveryDashboardState.probeError = "";
      } else {
        deliveryDashboardState.probeSummary = null;
        deliveryDashboardState.probeError = "";
      }
      if (probeHistoryRes && probeHistoryRes.ok) {
        const probeHistoryPayload = await probeHistoryRes.json().catch(() => null);
        deliveryDashboardState.probeHistory = Array.isArray(probeHistoryPayload?.samples)
          ? probeHistoryPayload.samples
          : [];
      } else {
        deliveryDashboardState.probeHistory = [];
      }
      deliveryDashboardState.loadedAt = Date.now();
      const arrangementItems = Array.isArray(payload?.package_browser)
        ? payload.package_browser.filter((item) => String(item?.category || "") === "arrangement")
        : [];
      const arrangementItem =
        findMusicDeliveryArrangementItem(arrangementItems, "audio_provider_cue_sheet.json") ||
        arrangementItems[0] ||
        null;
      const phraseItem = findMusicDeliveryArrangementItem(arrangementItems, "audio_provider_phrase_map.json");
      if (!arrangementItem) {
        deliveryDashboardState.arrangementData = null;
        deliveryDashboardState.arrangementKey = "";
        deliveryDashboardState.arrangementPhraseKey = "";
        deliveryDashboardState.arrangementError = "";
        deliveryDashboardState.selectedSection = "";
        deliveryDashboardState.compareA = "";
        deliveryDashboardState.compareB = "";
        deliveryDashboardState.phraseCompareA = "";
        deliveryDashboardState.phraseCompareB = "";
        deliveryDashboardState.rewriteAssistMode = "";
      }
      if (
        arrangementItem &&
        (
          deliveryDashboardState.arrangementKey !== musicDeliveryArrangementKey(arrangementItem) ||
          deliveryDashboardState.arrangementPhraseKey !== musicDeliveryArrangementKey(phraseItem)
        ) &&
        !deliveryDashboardState.arrangementLoading
      ) {
        void loadMusicDeliveryArrangement(arrangementItem, phraseItem);
      }
      return payload;
    })
    .catch((error) => {
      deliveryDashboardState.error = String(error);
      return null;
    })
    .finally(() => {
      deliveryDashboardState.loading = false;
      deliveryDashboardRequest = null;
      renderMusicDeliveryDashboard();
      ensureMusicDeliveryDashboardPolling();
    });

  return deliveryDashboardRequest;
}

globalThis.loadMusicDeliveryDashboardModule = loadMusicDeliveryDashboardModule;
