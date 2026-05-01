function workTypePricingDefaultsModule(workType) {
  const stored = panelDefaultsState.creation?.pricing_by_type?.[normalizeWorkTypeClient(workType)] || null;
  if (stored) {
    return {
      listenCents: Number(stored.listen_cents || 99),
      buyoutCents: Number(stored.buyout_cents || 299)
    };
  }
  const normalized = normalizeWorkTypeClient(workType);
  if (normalized === "triptych") return { listenCents: 99, buyoutCents: 499 };
  if (normalized === "opera") return { listenCents: 99, buyoutCents: 999 };
  return { listenCents: 99, buyoutCents: 299 };
}

function buildCurrentCreationDefaultsPayloadModule() {
  const workType = normalizeWorkTypeClient(creationState.workType);
  const pricingByType = panelDefaultsState.creation?.pricing_by_type
    ? JSON.parse(JSON.stringify(panelDefaultsState.creation.pricing_by_type))
    : {
        single: { listen_cents: 99, buyout_cents: 299 },
        triptych: { listen_cents: 99, buyout_cents: 499 },
        opera: { listen_cents: 99, buyout_cents: 999 }
      };
  const listenCents = centsFromPriceInput(creationDefaultListen?.value || "");
  const buyoutCents = centsFromPriceInput(creationDefaultBuyout?.value || "");
  pricingByType[workType] = {
    listen_cents: listenCents > 0 ? listenCents : workTypePricingDefaultsModule(workType).listenCents,
    buyout_cents: buyoutCents >= 0 ? buyoutCents : workTypePricingDefaultsModule(workType).buyoutCents
  };
  return {
    creative: {
      genre: creationState.selections.genre || "",
      mood: creationState.selections.mood || "",
      instrument: creationState.selections.instrument || "",
      instrumentation: creationState.instrumentation || "",
      ambience: creationState.selections.ambience || "",
      vocal_gender: creationState.selections.vocalGender || "",
      vocal_style: creationState.vocalStyle || "",
      ensemble_style: creationState.ensembleStyle || "",
      arrangement_density: Number(creationState.arrangementDensity || 0.6),
      dynamics_curve: creationState.dynamicsCurve || "",
      section_form: creationState.sectionForm || "",
      articulation_bias: creationState.articulationBias || "",
      voicing_register: creationState.voicingRegister || "",
      percussion_activity: Number(creationState.percussionActivity || 0.45),
      expression_cc_bias: creationState.expressionCcBias || "",
      humanization: Number(creationState.humanization || 0.35),
      inspiration_notes: String(creationState.inspirationNotes || "").slice(0, 1000),
      licensed_style_pack: creationState.licensedStylePack || "",
      external_audio_adapter: creationState.externalAudioAdapter || "",
      tempo_bpm: Number(creationState.tempo || 88),
      musical_key: creationState.key || "C",
      duration_s: "",
      // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — Jing: defaults must track UI
      // primary locale, not hardcoded "zh".
      language: creationState.language || (globalThis.resolveUiPrimaryLanguageModule ? globalThis.resolveUiPrimaryLanguageModule() : "en"),
      extra_lyric_languages: Array.isArray(creationState.extraLyricLanguages) ? creationState.extraLyricLanguages : [],
      extra_voice_tracks: Array.isArray(creationState.extraVoiceTracks) ? creationState.extraVoiceTracks : [],
      prompt: String(creationState.prompt || "").slice(0, 500),
      work_type: workType
    },
    pricing_by_type: pricingByType
  };
}

function applyCreationDefaultsModule(template) {
  if (!template || typeof template !== "object") return;
  panelDefaultsState.creation = template;
  resetCreationTouchedFields();
  const creative = template.creative || {};
  creationState.selections = {
    genre: String(creative.genre || ""),
    mood: String(creative.mood || ""),
    instrument: String(creative.instrument || ""),
    ambience: String(creative.ambience || ""),
    vocalGender: String(creative.vocal_gender || "")
  };
  creationState.instrumentation = String(creative.instrumentation || "");
  creationState.vocalStyle = String(creative.vocal_style || "");
  creationState.ensembleStyle = String(creative.ensemble_style || "");
  creationState.arrangementDensity = Math.max(0.2, Math.min(1, Number(creative.arrangement_density || 0.6)));
  creationState.dynamicsCurve = String(creative.dynamics_curve || "");
  creationState.sectionForm = String(creative.section_form || "");
  creationState.articulationBias = String(creative.articulation_bias || "");
  creationState.voicingRegister = String(creative.voicing_register || "");
  creationState.percussionActivity = Math.max(0, Math.min(1, Number(creative.percussion_activity || 0.45)));
  creationState.expressionCcBias = String(creative.expression_cc_bias || "");
  creationState.humanization = Math.max(0, Math.min(1, Number(creative.humanization || 0.35)));
  creationState.inspirationNotes = String(creative.inspiration_notes || "").slice(0, 1000);
  creationState.licensedStylePack = String(creative.licensed_style_pack || "");
  creationState.externalAudioAdapter = String(creative.external_audio_adapter || "");
  creationState.tempo = Number(creative.tempo_bpm || 0) > 0 ? Number(creative.tempo_bpm) : null;
  creationState.key = String(creative.musical_key || "").trim().toUpperCase();
  creationState.duration = null;
  creationState.language = String(creative.language || "").trim().toLowerCase();
  creationState.extraLyricLanguages = Array.isArray(creative.extra_lyric_languages)
    ? creative.extra_lyric_languages.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
    : [];
  creationState.extraVoiceTracks = Array.isArray(creative.extra_voice_tracks)
    ? creative.extra_voice_tracks.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
    : [];
  creationState.workType = String(creative.work_type || "").trim() ? normalizeWorkTypeClient(creative.work_type) : "";
  creationState.prompt = String(creative.prompt || "").slice(0, 500);
  syncCreationStateToLegacyInputs();
  const pricing = workTypePricingDefaultsModule(creationState.workType);
  if (creationDefaultListen) creationDefaultListen.value = (pricing.listenCents / 100).toFixed(2);
  if (creationDefaultBuyout) creationDefaultBuyout.value = (pricing.buyoutCents / 100).toFixed(2);
  renderCreationConsole();
}

async function loadCreationPanelDefaultsModule(force = false) {
  if (panelDefaultsState.loading) return panelDefaultsState.creation;
  if (!force && panelDefaultsState.loaded && panelDefaultsState.creation) return panelDefaultsState.creation;
  panelDefaultsState.loading = true;
  try {
    const res = await fetch("/api/panel-defaults/creation", { credentials: "include" });
    const payload = await res.json().catch(() => null);
    const data = getApiData(payload);
    const defaults = data?.defaults || null;
    if (res.ok && defaults) {
      panelDefaultsState.loaded = true;
      applyCreationDefaultsModule(defaults);
      return defaults;
    }
  } catch (_err) {
    // ignore
  } finally {
    panelDefaultsState.loading = false;
  }
  return panelDefaultsState.creation;
}

async function saveCreationPanelDefaultsModule(trigger) {
  if (getUserRole() !== "admin") return;
  try {
    setButtonBusy(trigger, true);
    const res = await fetch("/api/panel-defaults/creation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ defaults: buildCurrentCreationDefaultsPayloadModule() })
    });
    const payload = await res.json().catch(() => null);
    const data = getApiData(payload);
    if (!res.ok || payload?.ok === false || !data?.defaults) {
      throw new Error(payload?.code || `defaults_save_failed:${res.status}`);
    }
    applyCreationDefaultsModule(data.defaults);
    showToast(loginCopy("Default template saved."));
  } catch (_err) {
    showToast(loginCopy("Failed to save defaults."));
  } finally {
    setButtonBusy(trigger, false);
  }
}

window.workTypePricingDefaultsModule = workTypePricingDefaultsModule;
window.buildCurrentCreationDefaultsPayloadModule = buildCurrentCreationDefaultsPayloadModule;
window.applyCreationDefaultsModule = applyCreationDefaultsModule;
window.loadCreationPanelDefaultsModule = loadCreationPanelDefaultsModule;
window.saveCreationPanelDefaultsModule = saveCreationPanelDefaultsModule;
