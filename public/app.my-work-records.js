async function createMyWorkRecordModule(title, lines, options = {}) {
  const sourceRunId = String(options.runId || micState.jobId || "").trim();
  const overwriteExistingWork = options?.overwriteExistingWork === true;
  const workType = normalizeWorkTypeClient(
    creationState.workType || state.songSeed?.workType || "single"
  );
  const pricingDefaults = workTypePricingDefaults(workType);
  const economics = estimateCreationEconomics();
  const resolvedListenPriceCents = Math.max(
    0,
    Number(economics.suggestedListenPriceCents || pricingDefaults.listenCents || 0)
  );
  const resolvedBuyoutPriceCents = Math.max(
    0,
    Number(economics.suggestedBuyoutPriceCents || pricingDefaults.buyoutCents || 0)
  );
  const style = styleInput ? styleInput.value : "";
  const assetSnapshot = collectCurrentWorkAssetSnapshot();
  const localRecord = upsertLocalWorkRecord({
    local_id: options.localWorkId || undefined,
    title: String(title || "").trim(),
    style,
    work_type: workType,
    structure_role: workType,
    structure_plan:
      workType === "opera"
        ? buildOperaStructurePlan(null, state.songSeed, String(title || "").trim())
        : workType === "triptych"
          ? buildTriptychStructurePlan(null, state.songSeed, String(title || "").trim())
          : null,
    cover_image: currentWorkCoverImage(title, lines),
    preview_image_url: assetSnapshot.preview_image_url || "",
    preview_video_url: assetSnapshot.preview_video_url || "",
    preview_video_asset_key: assetSnapshot.preview_video_asset_key || "",
    status: "generating",
    created_at: new Date().toISOString(),
    lyrics_text: Array.isArray(lines) ? lines.join("\n") : "",
    lyrics_preview: Array.isArray(lines) ? lines.join("\n") : "",
    compute_units_estimate: economics.computeUnits,
    compute_cost_cents_estimate: economics.computeCostCents,
    suggested_listen_price_cents: economics.suggestedListenPriceCents,
    suggested_buyout_price_cents: economics.suggestedBuyoutPriceCents,
    children: buildLocalStructuredChildren(String(title || "").trim(), lines, style, workType),
    source: String(options.source || "").trim(),
    raw_voice_id: options.rawVoiceId ? String(options.rawVoiceId).trim() : "",
    raw_transcript: String(options.rawTranscript || "").trim(),
    show_voice_source_badge: options.source === "voice",
    is_song_seed_title_user_edited: Boolean(options.isSongSeedTitleUserEdited),
    source_run_id: sourceRunId
  });
  void refreshWorkSurfaces();
  if (!authState.user) return localRecord;
  try {
    let created = null;
    let existingRoot = null;
    if (overwriteExistingWork) {
      const allWorks = await fetchMyWorkHierarchy();
      existingRoot = findWorkByTitleAndType(allWorks, String(title || "").trim(), workType) || null;
    }
    if (workType === "triptych") {
      created = await createTriptychWorkRecord(
        String(title || "").trim(),
        lines,
        style,
        pricingDefaults
      );
    } else if (workType === "opera") {
      created = await createOperaWorkRecord(String(title || "").trim(), lines, style, pricingDefaults);
    } else if (existingRoot?.id && typeof updateWorkGenerationModule === "function") {
      created = await updateWorkGenerationModule(existingRoot.id, {
        title: String(title || "").trim(),
        style,
        lyrics_preview: Array.isArray(lines) ? lines.join("\n") : "",
        source_run_id: sourceRunId,
        compute_units_estimate: economics.computeUnits,
        compute_cost_cents_estimate: economics.computeCostCents,
        suggested_listen_price_cents: economics.suggestedListenPriceCents,
        suggested_buyout_price_cents: economics.suggestedBuyoutPriceCents,
        cover_image: assetSnapshot.cover_image || currentWorkCoverImage(title, lines),
        preview_image_url: assetSnapshot.preview_image_url || "",
        preview_video_url: assetSnapshot.preview_video_url || "",
        preview_video_asset_key: assetSnapshot.preview_video_asset_key || ""
      });
    } else {
      created = await createWorkNodeRecord({
        title: String(title || "").trim(),
        style,
        work_type: workType,
        structure_role: workType,
        lyrics_text: Array.isArray(lines) ? lines.join("\n") : "",
        listen_price_cents: resolvedListenPriceCents,
        buyout_price_cents: resolvedBuyoutPriceCents,
        lyrics_preview: Array.isArray(lines) ? lines.join("\n") : "",
        source_run_id: sourceRunId,
        compute_units_estimate: economics.computeUnits,
        compute_cost_cents_estimate: economics.computeCostCents,
        suggested_listen_price_cents: economics.suggestedListenPriceCents,
        suggested_buyout_price_cents: economics.suggestedBuyoutPriceCents,
        cover_image: assetSnapshot.cover_image || currentWorkCoverImage(title, lines),
        preview_image_url: assetSnapshot.preview_image_url || "",
        preview_video_url: assetSnapshot.preview_video_url || "",
        preview_video_asset_key: assetSnapshot.preview_video_asset_key || ""
      });
    }
    if (created?.id) {
      currentPersistedRootWorkId = created.id;
      upsertLocalWorkRecord({
        ...localRecord,
        work_id: created.id,
        work_type: created?.work_type || workType,
        cover_image: created?.cover_image || localRecord.cover_image,
        preview_image_url: created?.preview_image_url || localRecord.preview_image_url,
        preview_video_url: created?.preview_video_url || localRecord.preview_video_url,
        preview_video_asset_key: created?.preview_video_asset_key || localRecord.preview_video_asset_key
      });
      schedulePersistCurrentWorkAssets(created.id);
    }
    void refreshWorkSurfaces();
  } catch {
    // ignore
  }
  return localRecord;
}

globalThis.createMyWorkRecordModule = createMyWorkRecordModule;
