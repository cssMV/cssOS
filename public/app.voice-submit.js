async function submitVoiceOrFallbackTitleModule(blobOrNull) {
  if (typeof globalThis.__cssosSubmitVoiceOrFallbackTitle === "function") {
    return globalThis.__cssosSubmitVoiceOrFallbackTitle(blobOrNull);
  }
  // CSSOS_PHASE2_UNIVERSAL_ENTRY_VOICE 20260427 #161 — Jing
  // "所有进入Watch MV面板的'万能入口'们，走的都还是旧的流程，必须统一接入新的流程。"
  // Voice submit is one of the universal entrances. Route it through MV
  // Pipeline runAll() with the captured transcript as seed input. The MV
  // Pipeline panel handles every stage (lyrics → music → video → SRT →
  // compose → autoplay) under one roof. Falls through to the legacy
  // createRun path only when the MV Pipeline runAll is unavailable
  // (e.g. panel script not yet loaded).
  try {
    if (typeof globalThis.cssmvMvPipelineRunAll === "function" &&
        typeof globalThis.openMvPipelinePanel === "function") {
      // CSSOS_PHASE2_UNIVERSAL_ENTRY_VOICE 20260430 #230 — Jing
      // "万能入口们还是没有走新的流程，新的链路…MV PIPELINE的进度条们
      //  都没有走动."
      //
      // Map the captured voice transcript into the seed.prompt slot —
      // openMvPipelinePanel only pre-fills #mvp-prompt from `seed.prompt`,
      // and runAll's title-validation reads that DOM input. Previously
      // we passed `transcript` (not `prompt`) which never reached the
      // panel, so runAll early-returned with "Please give your song a
      // title". Now: derive prompt from whatever the user said. If the
      // mic captured nothing, the local seed bank fills it in via runAll's
      // zero-input fallback.
      const transcriptText = String(globalThis.micState?.transcript || "").trim();
      const seedFromVoice = {
        prompt: transcriptText,
        transcript: transcriptText,
        rawVoiceId: blobOrNull && Number(blobOrNull.size) > 0
          ? `voice_${Date.now()}`
          : null,
        source: "voice"
      };
      try {
        globalThis.openMvPipelinePanel({ seed: seedFromVoice, autoStart: true });
      } catch (_openErr) {
        // Panel-mount may refuse for guests — fall through to legacy.
      }
      return true;
    }
  } catch (_e) { /* fall through to legacy */ }
  // Guard against duplicate triggers: if a creation is already in flight
  // (lyrics seed pending, pipeline running, or final audio still resolving),
  // reject this call rather than spawning a second run with a different
  // random title. Mirrors the guard at the top of runMicFlow.
  if (typeof globalThis.isCreationBusyModule === "function" && globalThis.isCreationBusyModule()) {
    try {
      const msg =
        (typeof t === "function" && t("watch.toast.creationBusy")) ||
        (typeof loginCopy === "function" && loginCopy("Creation is already in progress.")) ||
        "Creation is already in progress.";
      (globalThis.showToast || showToast)?.(msg);
    } catch (_err) {}
    return false;
  }
  if (authState.user && !creatorBoostState.loaded) {
    await loadCreatorBoostState().catch(() => null);
  }
  const derivedDurationSec =
    typeof resolveCreationDurationValue === "function" ? resolveCreationDurationValue() : null;
  const capability =
    typeof enforceCreationCapability === "function"
      ? enforceCreationCapability({
          mode: "music_video",
          durationSec:
            Number.isFinite(Number(derivedDurationSec)) && Number(derivedDurationSec) > 0
              ? Number(derivedDurationSec)
              : null,
          workType: creationState?.workType,
          allowCinemaBookingPrompt: false
        })
      : { ok: true };
  if (!capability?.ok) return;

  let title = "";
  let rawVoiceId = null;
  let wakeDetected = false;
  let voice = {
    bytes: 0,
    mime: "audio/webm",
    mode:
      typeof normalizeWorkTypeClient === "function"
        ? normalizeWorkTypeClient(creationState?.workType || "single")
        : String(creationState?.workType || "single").trim() || "single"
  };

  if (blobOrNull && Number(blobOrNull.size) > 0) {
    rawVoiceId = `${getMicJobId()}:raw:${Date.now()}`;
    micState.rawVoiceId = rawVoiceId;
    micState.rawVoiceDeleted = false;
    micState.creationSource = "voice";

    const intent = await deriveTitleFromVoice(blobOrNull).catch(() => ({
      transcript: "",
      title: "",
      wakeDetected: false
    }));
    if (intent?.transcript) {
      micState.transcript = intent.transcript;
      if (typeof executePanelVoiceCommandModule === "function" && executePanelVoiceCommandModule(intent.transcript)) {
        setMicCaptureStatus?.(
          "submitted",
          loginCopy("Panel command accepted"),
          loginCopy("The requested panel has been opened.")
        );
        return true;
      }
      applyVoiceIntentToCreationState?.(intent);
    }
    wakeDetected = !!intent?.wakeDetected;
    if (wakeDetected) {
      showToast(loginCopy("Wake spell recognized."));
    }
    if (intent?.title && String(intent.title).trim()) {
      title = String(intent.title).trim();
      setSongSeedTitleValue?.(title, { userEdited: true });
    }

    const ab = await blobOrNull.arrayBuffer().catch(() => null);
    if (ab && ab.byteLength > 0) {
      voice = {
        bytes: Number(blobOrNull.size) || 0,
        mime: blobOrNull.type || "audio/webm",
        b64: globalThis.b64FromArrayBuffer?.(ab) || "",
        mode:
          typeof normalizeWorkTypeClient === "function"
            ? normalizeWorkTypeClient(creationState?.workType || intent?.workType || "single")
            : String(creationState?.workType || intent?.workType || "single").trim() || "single"
      };
    }
  }

  if (!title) {
    setMicCaptureStatus?.(
      "fallback",
      loginCopy("Refining title from captured voice"),
      blobOrNull && Number(blobOrNull.size) > 0
        ? loginCopy(
            "Voice was captured, but the title is still unstable. The system will now continue by generating a concise title and lyrics."
          )
        : loginCopy(
            "This action did not capture voice, so the system is directly generating a title and lyrics."
          )
    );
    const seed = await runLyricsGenerate?.("music_video").catch(() => null);
    if ((globalThis.isSongSeedQuotaExceededModule?.(seed) ?? false) === true) {
      safeShowToast?.(globalThis.getSongSeedQuotaExceededMessageModule?.(seed) || "");
    }
    if (seed?.ok && !seed?.empty && seed?.data?.title) {
      title = String(seed.data.title || "").trim();
      if (title) setSongSeedTitleValue?.(title, { userEdited: true });
    } else if (!title && micState?.transcript) {
      title = deriveVoiceKeywordTitle?.(micState.transcript, {
        wakeSpell: String(state?.spell || DEFAULT_SPELL)
      });
      if (title) setSongSeedTitleValue?.(title, { userEdited: true });
    }
  }

  updateMicDebugState?.(
    {
      transcript: micState?.transcript || "",
      title,
      wakeDetected
    },
    {
      wakeSpell: String(state?.spell || DEFAULT_SPELL),
      fallbackTitle: title
    }
  );

  const finalTitle = title || buildDirectCreationFallbackTitle?.() || "Untitled";
  const creationPayload = normalizeSongCreationPayload({
    source: voice.bytes > 0 ? "voice" : "manual",
    title: finalTitle,
    rawVoiceId,
    rawTranscript: micState?.transcript || "",
    isSongSeedTitleUserEdited: false,
    workType:
      typeof normalizeWorkTypeClient === "function"
        ? normalizeWorkTypeClient(creationState?.workType || voice.mode || "single")
        : String(creationState?.workType || voice.mode || "single").trim() || "single"
  });

  state.songSeed = {
    ...(state.songSeed || {}),
    draft: creationPayload
  };
  if (finalTitle) {
    setSongSeedTitleValue?.(finalTitle, {
      userEdited: creationPayload.isSongSeedTitleUserEdited
    });
  }
  setMicCaptureStatus?.(
    "submitting",
    loginCopy("Creating from captured voice"),
    loginCopy(`Final title: ${finalTitle}`)
  );

  const uiLang = String(window?.CSS_UI_LANG || "zh");
  const tier = typeof getAccessTier === "function" ? getAccessTier() : "";
  const immediateFallbackLyrics = String(
    (typeof lyricsInput !== "undefined" && lyricsInput?.value) || ""
  ).trim();
  const creationLyrics =
    immediateFallbackLyrics ||
    (typeof buildLocalFallbackLyrics === "function"
      ? String((buildLocalFallbackLyrics(finalTitle) || []).join("\n")).trim()
      : "");
  const optimisticWork = upsertLocalWorkRecord?.({
    local_id: `voice_${Date.now()}`,
    title: finalTitle,
    style: String(styleInput?.value || state?.style || "").trim(),
    work_type: creationPayload.workType,
    structure_role: creationPayload.workType,
    status: "queued",
    created_at: new Date().toISOString(),
    lyrics_preview: "",
    source: creationPayload.source,
    raw_voice_id: creationPayload.rawVoiceId || "",
    raw_transcript: creationPayload.rawTranscript,
    show_voice_source_badge: creationPayload.source === "voice",
    is_song_seed_title_user_edited: creationPayload.isSongSeedTitleUserEdited,
    cover_image: currentWorkCoverImage?.(
      finalTitle,
      compactLyricLines?.(immediateFallbackLyrics.split("\n")) || []
    )
  }) || { local_id: `voice_${Date.now()}` };
  const optimisticWorkId = String(
    optimisticWork?.local_id || optimisticWork?.work_id || ""
  ).trim();
  currentWatchPreviewWork = optimisticWork;
  void refreshWorkSurfaces?.();
  openPanel?.(foryouPanel);
  openPanel?.(watchPanel);
  activateWatchTab?.(
    typeof resolvePreferredWatchOpenTab === "function"
      ? resolvePreferredWatchOpenTab("mv")
      : "mv"
  );
  if (watchSubtitle) {
    watchSubtitle.textContent = loginCopy("KaraOKe MV · Pending");
  }

  try {
    const run = await createRun({ title: finalTitle, uiLang, tier, voice });
    if (optimisticWorkId) {
      updateLocalWorkRecord?.(optimisticWorkId, {
        status: "generating_lyrics",
        source_run_id: String(run?.run_id || "").trim()
      });
      void refreshWorkSurfaces?.();
    }
    window?.dispatchEvent?.(new CustomEvent("cssos:run_created", { detail: run }));
    window?.dispatchEvent?.(
      new CustomEvent("cssos:title_ready", {
        detail: {
          title: finalTitle,
          source: voice.bytes > 0 ? "voice" : "random",
          work_type:
            typeof normalizeWorkTypeClient === "function"
              ? normalizeWorkTypeClient(creationState?.workType || voice.mode || "single")
              : String(creationState?.workType || voice.mode || "single").trim() || "single"
        }
      })
    );
    window?.dispatchEvent?.(
      new CustomEvent("cssos:lyrics_start", {
        detail: {
          run_id: run?.run_id,
          title: finalTitle,
          mode:
            typeof normalizeWorkTypeClient === "function"
              ? normalizeWorkTypeClient(creationState?.workType || voice.mode || "single")
              : String(creationState?.workType || voice.mode || "single").trim() || "single"
        }
      })
    );
    setMicCaptureStatus?.(
      "submitted",
      loginCopy("Voice accepted"),
      loginCopy(`Creation started with title “${finalTitle}”.`)
    );
    return startCreation?.(finalTitle, creationLyrics, {
      ...creationPayload,
      existingRunId: String(run?.run_id || "").trim(),
      localWorkId: optimisticWorkId
    });
  } catch (_error) {
    if (optimisticWorkId) {
      updateLocalWorkRecord?.(optimisticWorkId, { status: "failed" });
      void refreshWorkSurfaces?.();
    }
    await startCreation?.(finalTitle, creationLyrics, {
      ...creationPayload,
      localWorkId: optimisticWorkId
    });
    setMicCaptureStatus?.(
      "submitting",
      loginCopy("Voice accepted"),
      loginCopy("Creation continues")
    );
    if (typeof playWatchPanelFailureFallback === "function") {
      void playWatchPanelFailureFallback({ preferDemoMedia: true, allowSilence: true });
    } else if (typeof playFailureFallbackMedia === "function") {
      void playFailureFallbackMedia({ preferDemoMedia: true, allowSilence: true });
    }
    showToast?.(loginCopy("Creation is continuing in the background."));
    return true;
  }
}

globalThis.submitVoiceOrFallbackTitleModule = submitVoiceOrFallbackTitleModule;
