function randomizeCreationForLyricsRefreshModule(title) {
  const seed = hashSeedString(`${title}::${Date.now()}::${songSeedVariationCounter}`);
  const explicitLanguage = readExplicitCreationLanguage();
  const uiPrimaryLanguage = globalThis.resolveUiPrimaryLanguageModule?.()
    || globalThis.resolveUiDefaultCreationLanguageModule?.()
    || "en";
  const currentLanguage = String(explicitLanguage || creationState.language || uiPrimaryLanguage).trim().toLowerCase();
  const normalizedTitle = String(title || "").trim().toLowerCase();
  const styleContext = String(styleInput?.value || creationState.prompt || "").trim().toLowerCase();
  const allowChildlike =
    normalizedTitle.includes("童") ||
    normalizedTitle.includes("子供") ||
    normalizedTitle.includes("children") ||
    styleContext.includes("child") ||
    styleContext.includes("children") ||
    styleContext.includes("choir");
  const compatibleGenres = currentLanguage.startsWith("ja")
    ? ["Pop", "Rock", "Jazz", "R&B", "EDM", "Folk", "Classical"]
    : currentLanguage.startsWith("zh")
      ? ["Chinese GuFeng", "Pop", "Folk", "Classical", "R&B", "Jazz"]
      : ["Pop", "Rock", "R&B", "Jazz", "Folk", "Country", "EDM", "Classical"];
  const compatibleInstruments = currentLanguage.startsWith("ja")
    ? ["Piano", "Guitar", "Violin", "Flute", "String Ensemble", "Cello", "Drums"]
    : currentLanguage.startsWith("zh")
      ? ["Guzheng", "Dizi", "Pipa", "Piano", "Violin", "Cello", "String Ensemble"]
      : ["Guitar", "Piano", "Bass", "Drums", "Violin", "Saxophone", "Trumpet"];
  const compatibleVocalGenders = allowChildlike
    ? ["Feminine", "Masculine", "Duet", "Androgynous", "Polyphonic Choir", "Childlike"]
    : ["Feminine", "Masculine", "Duet", "Androgynous", "Polyphonic Choir"];
  const compatibleVocalStyles = currentLanguage.startsWith("ja")
    ? ["airy close-mic", "lyric belt", "soft opera shimmer", "choral unison"]
    : ["airy close-mic", "lyric belt", "soft opera shimmer", "soul rasp", "choral unison"];
  const compatibleEnsembles = currentLanguage.startsWith("ja")
    ? ["chamber ensemble", "synth-pop band", "cinematic orchestra"]
    : ["chamber ensemble", "festival percussion circle", "synth-pop band", "cinematic orchestra"];
  const preservedStyleText = hasCreationFieldTouched("styleText") ? String(styleInput?.value || "").trim() : "";
  const preservedVoiceValue = hasCreationFieldTouched("vocalGender") ? String(voiceInput?.value || "").trim() : "";
  creationState.selections = {
    genre: hasCreationFieldTouched("genre")
      ? creationState.selections.genre
      : seededPick(compatibleGenres, seed, 1) || compatibleGenres[0] || "Pop",
    mood: hasCreationFieldTouched("mood")
      ? creationState.selections.mood
      : seededPick(creationOptionCatalog.mood, seed, 2) || "",
    instrument: hasCreationFieldTouched("instrument")
      ? creationState.selections.instrument
      : seededPick(compatibleInstruments, seed, 3) || "",
    ambience: hasCreationFieldTouched("ambience")
      ? creationState.selections.ambience
      : seededPick(creationOptionCatalog.ambience, seed, 4) || "",
    vocalGender: hasCreationFieldTouched("vocalGender")
      ? creationState.selections.vocalGender
      : seededPick(compatibleVocalGenders, seed, 5) || "Feminine"
  };
  creationState.tempo = hasCreationFieldTouched("tempo")
    ? creationState.tempo
    : seededNumber(68, 168, 4, seed, 6);
  creationState.key = hasCreationFieldTouched("key")
    ? creationState.key
    : seededPick(["C", "D", "E", "F", "G", "A", "B"], seed, 7) || "C";
  creationState.duration = resolveCreationDurationValue({ title }) || null;
  creationState.language = explicitLanguage || uiPrimaryLanguage;
  creationState.languageLockedBySeed = !explicitLanguage;
  creationState.workType = hasCreationFieldTouched("workType")
    ? creationState.workType
    : "single";
  creationState.prompt = hasCreationFieldTouched("prompt")
    ? creationState.prompt
    : loginCopy(
        `Randomized from title: ${title}`
      );
  creationState.instrumentation = hasCreationFieldTouched("instrumentation")
    ? creationState.instrumentation
    : seededPick(
        [
          "guzheng, dizi, low strings",
          "grand piano, cello, brushed drums",
          "analog bass, polysynth pad, punchy kit",
          "chamber strings, horn layer, taiko pulse"
        ],
        seed,
        11
      ) || "";
  creationState.vocalStyle = hasCreationFieldTouched("vocalStyle")
    ? creationState.vocalStyle
    : seededPick(
        compatibleVocalStyles,
        seed,
        12
      ) || "";
  creationState.ensembleStyle = hasCreationFieldTouched("ensembleStyle")
    ? creationState.ensembleStyle
    : seededPick(
        compatibleEnsembles,
        seed,
        13
      ) || "";
  creationState.licensedStylePack = hasCreationFieldTouched("licensedStylePack")
    ? creationState.licensedStylePack
    : "";
  creationState.externalAudioAdapter = hasCreationFieldTouched("externalAudioAdapter")
    ? creationState.externalAudioAdapter
    : "";
  creationState.inspirationNotes = hasCreationFieldTouched("inspirationNotes")
    ? creationState.inspirationNotes
    : loginCopy(
        "Use broad lawful references: era, region, instrumentation, emotional pacing, and any licensed pack names."
      );
  syncCreationStateToLegacyInputs();
  if (preservedStyleText && styleInput) styleInput.value = preservedStyleText;
  if (preservedVoiceValue && voiceInput) setSelectValueSafe(voiceInput, preservedVoiceValue);
  randomizePalette();
  renderCreationConsole();
}

function applySongSeedToSettingsModule(seed) {
  const data = normalizeSongSeed(seed);
  const canonicalLyrics = globalThis.buildCanonicalLyricsWithTitleModule?.(
    data.title,
    data.lyrics,
  ) || data.lyrics;
  const lyricParts = globalThis.splitLyricsTitleAndBodyModule?.(
    data.title,
    canonicalLyrics,
  ) || {
    title: String(data.title || "").trim(),
    titleLine: String(data.title || "").trim(),
    bodyLines: String(canonicalLyrics || "").split("\n"),
  };
  const title = String(lyricParts.title || data.title || "").trim();
  const lyrics = String(canonicalLyrics || "").trim();
  const musicStyleText = data.musicStyle;
  const musicStructureText = data.musicStructure;
  const videoOutlineText = data.videoOutline;
  const references = data.references;
  const sectionPrompts = data.sectionPrompts;
  const sectionBeats = data.sectionBeats;
  const normalizedWorkType = normalizeWorkTypeClient(data.workType || creationState.workType || "single");
  const preserveTitle =
    !!(
      readSongSeedUiModule(
        "shouldPreserveSongSeedTitleForRefreshModule",
        titleInput?.dataset?.userEdited === "1",
      ) && String(titleInput?.value || "").trim()
    );
  const explicitLanguageSelection = readExplicitCreationLanguage();
  const preserveLanguage = Boolean(explicitLanguageSelection || (hasCreationFieldTouched("language") && String(creationState.language || "").trim()));
  const preserveWorkType = hasCreationFieldTouched("workType") && String(creationState.workType || "").trim();
  const preserveStyle = hasCreationFieldTouched("styleText") && String(styleInput?.value || "").trim();
  const uiDefaultLanguageForSeed = globalThis.resolveUiPrimaryLanguageModule?.()
    || globalThis.resolveUiDefaultCreationLanguageModule?.()
    || "en";
  // CSSMV_CIVILIZATION_CASCADE 20260424 #98 — UI locale wins over title
  // inference. Backend-returned seed content is a result, not a signal:
  // respect the UI locale so a Chinese-looking title doesn't override a
  // Japanese UI and flip the lock-in language.
  const inferredLanguage = explicitLanguageSelection || uiDefaultLanguageForSeed || inferLanguageFromTitleText(title) || "en";

  if (title && !preserveTitle) setSongSeedTitleValue(title, { userEdited: false });
  if (lyricsInput && lyrics) lyricsInput.value = lyrics;
  if (styleInput && musicStyleText && !preserveStyle) styleInput.value = musicStyleText;
  if (lyricsSourceInput) lyricsSourceInput.value = references.join("\n");
  if (musicStructureInput) {
    const rendered = [
      musicStructureText,
      globalThis.renderSectionBeatsTextModule?.(sectionBeats) ?? ""
    ]
      .filter(Boolean)
      .join("\n\n");
    musicStructureInput.value = rendered;
  }
  if (videoOutlineInput) videoOutlineInput.value = videoOutlineText;
  if (sectionPromptsInput) {
    sectionPromptsInput.value = globalThis.renderSectionPromptsTextModule?.(sectionPrompts) ?? "";
  }
  if (!preserveWorkType) creationState.workType = normalizedWorkType;
  if (preserveLanguage) {
    creationState.language = explicitLanguageSelection || String(creationState.language || inferredLanguage || uiDefaultLanguageForSeed).trim().toLowerCase();
    creationState.languageLockedBySeed = false;
  } else {
    creationState.language = inferredLanguage;
    creationState.languageLockedBySeed = true;
  }
  if (creationWorkType && !preserveWorkType) creationWorkType.value = normalizeWorkTypeClient(creationState.workType);
  if (creationLanguage) creationLanguage.value = String(creationState.language || inferredLanguage || uiDefaultLanguageForSeed);
  state.songSeed = { ...data, title, lyrics };
  if (lyrics) {
    const lines = Array.isArray(lyricParts.bodyLines) ? lyricParts.bodyLines : [];
    state.lines = lines;
    state.baseLines = lines;
    const resolvedTitle = title || state.title;
    updateEnginePanels(resolvedTitle, lines);
    refreshLyricsPresentation(resolvedTitle, lines);
    globalThis.syncForyouThumbFromLyricsModule?.(resolvedTitle, lines);
    void globalThis.requestWatchFrameArtworkModule?.(
      resolvedTitle,
      musicStyleText || data?.creativeSummary?.compact || t("watch.status.waitingImage"),
      lines
    );
    void globalThis.requestForyouThumbnail?.(
      resolvedTitle,
      musicStyleText || data?.creativeSummary?.compact || "",
      lines
    );
    recordLyricsSeedSnapshot(data, resolvedTitle, lines);
    globalThis.ensureWatchPipelineContinuationModule?.({
      title: resolvedTitle,
      lines,
      source: "applySongSeedToSettings",
    });
  }
  callWatchUiModule("renderSongSeedPreviewModule", data);
}

Object.assign(globalThis, {
  randomizeCreationForLyricsRefreshModule,
  applySongSeedToSettingsModule
});
