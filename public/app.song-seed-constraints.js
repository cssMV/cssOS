function isDemoTemplateTitleModule(title) {
  const value = String(title || "").trim();
  if (!value) return false;
  return [
    "Moon of Chang'e",
    "嫦娥奔月",
    "潮声共振",
    "暗场余温",
    "流光之城",
    "CSS MV",
    "Untitled",
    "New Song",
    "Opera Night",
    "Midnight",
    "Starlight",
    "Echo"
  ].includes(value);
}

async function buildSongSeedGenerationConstraintsModule() {
  const workType = normalizeWorkTypeClient(resolveCreationWorkTypeValue());
  const titleLanguage = inferLanguageFromTitleText(titleInput?.value || state.title || "");
  const preferredLanguage =
    resolveCreationLanguageValue({ title: titleInput?.value || state.title || "" }) ||
    titleLanguage ||
    document.documentElement.lang ||
    "zh";
  let structurePlan = null;
  if (workType === "opera") {
    const requestedTitle = String(getSongSeedRequestTitle() || titleInput?.value || state.title || "").trim();
    if (requestedTitle && authState.user) {
      const works = await fetchMyWorkHierarchy();
      const root = findWorkByTitleAndType(works, requestedTitle, "opera");
      structurePlan = buildOperaStructurePlan(root, state.songSeed, requestedTitle);
    } else if (requestedTitle) {
      structurePlan = buildOperaStructurePlan(null, state.songSeed, requestedTitle);
    }
  } else if (workType === "triptych") {
    const requestedTitle = String(getSongSeedRequestTitle() || titleInput?.value || state.title || "").trim();
    if (requestedTitle && authState.user) {
      const works = await fetchMyWorkHierarchy();
      const root = findWorkByTitleAndType(works, requestedTitle, "triptych");
      structurePlan = buildTriptychStructurePlan(root, state.songSeed, requestedTitle);
    } else if (requestedTitle) {
      structurePlan = buildTriptychStructurePlan(null, state.songSeed, requestedTitle);
    }
  }
  return {
    language: preferredLanguage,
    work_type: workType,
    work_type_mandate:
      workType === "triptych"
        ? loginCopy("Generate a triptych with one parent title and three titled singles.")
        : workType === "opera"
          ? loginCopy("Generate an opera with one opera title, titled acts, and titled scenes.")
          : loginCopy("Generate a single song release."),
    title_language_mandate:
      preferredLanguage === "zh"
        ? loginCopy("Keep the lyric body naturally Chinese unless multilingual mixing was explicitly requested. If the user already provided a title, preserve that title exactly.")
        : preferredLanguage === "ja"
          ? loginCopy("Keep the lyric body naturally Japanese unless multilingual mixing was explicitly requested. If the user already provided a title, preserve that title exactly.")
          : loginCopy("Keep the lyric body naturally English unless multilingual mixing was explicitly requested. If the user already provided a title, preserve that title exactly."),
    genre: creationState.selections?.genre || "",
    mood: creationState.selections?.mood || "",
    lead_instrument: creationState.selections?.instrument || "",
    ambience: creationState.selections?.ambience || "",
    vocal_gender: creationState.selections?.vocalGender || creationState.voice || "",
    style_text: styleInput?.value?.trim() || state.style || "",
    instrumentation: creationState.instrumentation || "",
    vocal_style: creationState.vocalStyle || "",
    ensemble_style: creationState.ensembleStyle || "",
    licensed_style_pack: creationState.licensedStylePack || "",
    external_audio_adapter: creationState.externalAudioAdapter || "",
    arrangement_density: creationState.arrangementDensity,
    dynamics_curve: creationState.dynamicsCurve || "",
    section_form: creationState.sectionForm || "",
    articulation_bias: creationState.articulationBias || "",
    voicing_register: creationState.voicingRegister || "",
    percussion_activity: creationState.percussionActivity,
    humanization: creationState.humanization,
    tempo_bpm: creationState.tempo,
    key: creationState.key,
    duration_sec: creationState.duration,
    user_prompt: creationState.prompt || "",
    inspiration_notes: creationState.inspirationNotes || "",
    ...(structurePlan ? { structure_plan: structurePlan } : {})
  };
}

window.isDemoTemplateTitleModule = isDemoTemplateTitleModule;
window.buildSongSeedGenerationConstraintsModule = buildSongSeedGenerationConstraintsModule;
