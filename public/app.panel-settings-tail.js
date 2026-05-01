function bindLogoPanelSettingsControls({
  panel,
  state,
  mirrorImgInput1,
  mirrorImgInput2,
  mirrorVideoInput,
  mirrorStrategyInput,
  mirrorAnimationInput,
  mirrorSingleInput,
  mirrorTriptychInput,
  mirrorOperaInput,
  mirrorFixedBlock,
  mirrorSingleBlock,
  mirrorTriptychBlock,
  mirrorOperaBlock,
  spellInput,
  logoSubtitleInput,
  logoSloganInput,
  logoSizeInput,
  logoMaskInsetInput,
  logoSpellcastRingScaleInput,
  logoSpellcastGlowScaleInput,
  logoGrayRingSpeedInput,
  logoGrayRingGrayscaleInput,
  logoGrayRingColorfulnessInput,
  logoSpellcastLayerInput,
  logoHoldRingScaleInput,
  logoHoldRingLayerInput,
  logoAlignGrayRingButton,
  logoAlignGrayRingMinimalButton,
  logoSaveRingPresetButton,
  logoLoadRingPresetButton,
  logoDeleteRingPresetButton,
  logoRingPresetSelect,
  micLongpressInput,
  micMaxHoldInput,
  micLogoSurfaceModeInput,
  micDockSurfaceModeInput,
  micSettingsSurfaceModeInput,
  refreshLogoRingReadouts,
  buildLogoRingPresetPayload,
  refreshLogoRingPresetActionState,
  renderLogoRingPresetOptions,
  applyLogoRingPreset
}) {
  let behaviorAutoSaveTimer = 0;
  const scheduleBehaviorDefaultSync = (trigger = null) => {
    if (typeof getUserRole === "function" && getUserRole() !== "admin") return;
    if (typeof globalThis.savePanelDefaults !== "function") return;
    if (behaviorAutoSaveTimer) {
      window.clearTimeout(behaviorAutoSaveTimer);
    }
    behaviorAutoSaveTimer = window.setTimeout(() => {
      behaviorAutoSaveTimer = 0;
      void globalThis.savePanelDefaults(
        "behavior",
        globalThis.readPanelBehaviorSettingsLocal?.() || {},
        trigger || null
      );
    }, 280);
  };

  const syncMirrorSettingsVisibility = () => {
    const strategy = String(mirrorStrategyInput?.value || "single");
    if (mirrorFixedBlock) mirrorFixedBlock.hidden = strategy !== "fixed";
    if (mirrorSingleBlock) mirrorSingleBlock.hidden = strategy !== "single";
    if (mirrorTriptychBlock) mirrorTriptychBlock.hidden = strategy !== "triptych";
    if (mirrorOperaBlock) mirrorOperaBlock.hidden = strategy !== "opera";
  };

  const bindBehaviorInput = (input, path, transform = (value) => value) => {
    if (!(input instanceof HTMLElement)) return;
    const apply = () => updatePanelBehaviorSettings((current) => {
      const next = { ...current };
      let cursor = next;
      for (let index = 0; index < path.length - 1; index += 1) {
        const key = path[index];
        cursor[key] = { ...(cursor[key] || {}) };
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = transform(
        input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : input.value
      );
      return next;
    });
    input.addEventListener("input", () => {
      apply();
      scheduleBehaviorDefaultSync(input);
    });
    input.addEventListener("change", () => {
      apply();
      scheduleBehaviorDefaultSync(input);
    });
  };

  bindBehaviorInput(spellInput, ["logo", "spell"]);
  bindBehaviorInput(logoSubtitleInput, ["logo", "subtitle"]);
  bindBehaviorInput(logoSloganInput, ["logo", "slogan_template"]);
  bindBehaviorInput(logoSizeInput, ["logo", "mirror_size_px"], (value) => Number(value || 600));
  bindBehaviorInput(logoMaskInsetInput, ["logo", "mask_inset_percent"], (value) => Number(value || 12));
  bindBehaviorInput(logoSpellcastRingScaleInput, ["logo", "spellcast_ring_scale"], (value) => Number(value || 1));
  bindBehaviorInput(logoSpellcastGlowScaleInput, ["logo", "spellcast_glow_scale"], (value) => Number(value || 0.18));
  bindBehaviorInput(logoGrayRingSpeedInput, ["logo", "gray_ring_speed_sec"], (value) => Number(value || 5.8));
  bindBehaviorInput(logoGrayRingGrayscaleInput, ["logo", "gray_ring_grayscale"], (value) => Number(value || 0.6));
  bindBehaviorInput(logoGrayRingColorfulnessInput, ["logo", "gray_ring_colorfulness"], (value) => Number(value || 0.28));
  bindBehaviorInput(logoSpellcastLayerInput, ["logo", "spellcast_layer"]);
  bindBehaviorInput(logoHoldRingScaleInput, ["logo", "hold_ring_scale"], (value) => Number(value || 1));
  bindBehaviorInput(logoHoldRingLayerInput, ["logo", "hold_ring_layer"]);
  bindBehaviorInput(micLongpressInput, ["mic", "longpress_ms"], (value) => Number(value || 600));
  bindBehaviorInput(micMaxHoldInput, ["mic", "max_hold_sec"], (value) => Number(value || 30));
  bindBehaviorInput(micLogoSurfaceModeInput, ["mic", "logo_surface_mode"]);
  bindBehaviorInput(micDockSurfaceModeInput, ["mic", "dock_surface_mode"]);
  bindBehaviorInput(micSettingsSurfaceModeInput, ["mic", "settings_surface_mode"]);
  bindBehaviorInput(mirrorStrategyInput, ["logo", "mirror_strategy"]);
  bindBehaviorInput(mirrorAnimationInput, ["logo", "fixed_mode"]);
  bindBehaviorInput(mirrorSingleInput, ["logo", "per_type", "single"]);
  bindBehaviorInput(mirrorTriptychInput, ["logo", "per_type", "triptych"]);
  bindBehaviorInput(mirrorOperaInput, ["logo", "per_type", "opera"]);

  [logoSpellcastRingScaleInput, logoSpellcastGlowScaleInput, logoGrayRingSpeedInput, logoGrayRingGrayscaleInput, logoGrayRingColorfulnessInput, logoHoldRingScaleInput].forEach((input) => {
    if (!(input instanceof HTMLElement)) return;
    input.addEventListener("input", () => refreshLogoRingReadouts?.());
    input.addEventListener("change", () => refreshLogoRingReadouts?.());
  });

  mirrorStrategyInput?.addEventListener("change", syncMirrorSettingsVisibility);
  syncMirrorSettingsVisibility();
  refreshLogoRingReadouts?.();
  renderLogoRingPresetOptions?.();
  refreshLogoRingPresetActionState?.();

  const applyGrayRingPreset = (minimal = false) => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      logo: {
        ...current.logo,
        spellcast_ring_scale: minimal ? 1 : 1.06,
        spellcast_glow_scale: minimal ? 0.22 : 0.34,
        gray_ring_speed_sec: minimal ? 8.4 : 6.2,
        gray_ring_grayscale: minimal ? 0.78 : 0.62,
        gray_ring_colorfulness: minimal ? 0.12 : 0.24,
        hold_ring_scale: minimal ? 1 : 1.02
      }
    }));
    if (logoSpellcastRingScaleInput) logoSpellcastRingScaleInput.value = String(minimal ? 1 : 1.06);
    if (logoSpellcastGlowScaleInput) logoSpellcastGlowScaleInput.value = String(minimal ? 0.22 : 0.34);
    if (logoGrayRingSpeedInput) logoGrayRingSpeedInput.value = String(minimal ? 8.4 : 6.2);
    if (logoGrayRingGrayscaleInput) logoGrayRingGrayscaleInput.value = String(minimal ? 0.78 : 0.62);
    if (logoGrayRingColorfulnessInput) logoGrayRingColorfulnessInput.value = String(minimal ? 0.12 : 0.24);
    if (logoHoldRingScaleInput) logoHoldRingScaleInput.value = String(minimal ? 1 : 1.02);
    refreshLogoRingReadouts?.();
  };

  logoAlignGrayRingButton?.addEventListener("click", () => applyGrayRingPreset(false));
  logoAlignGrayRingMinimalButton?.addEventListener("click", () => applyGrayRingPreset(true));
  logoSaveRingPresetButton?.addEventListener("click", () => {
    const name = String(logoRingPresetSelect?.value || "").trim();
    if (!name) return;
    globalThis.saveLogoRingPreset?.(name, buildLogoRingPresetPayload?.() || {});
    renderLogoRingPresetOptions?.();
  });
  logoLoadRingPresetButton?.addEventListener("click", () => {
    const name = String(logoRingPresetSelect?.value || "").trim();
    if (!name) return;
    const preset = globalThis.loadLogoRingPreset?.(name);
    if (preset) applyLogoRingPreset?.(preset);
    refreshLogoRingPresetActionState?.();
  });
  logoDeleteRingPresetButton?.addEventListener("click", () => {
    const name = String(logoRingPresetSelect?.value || "").trim();
    if (!name) return;
    globalThis.deleteLogoRingPreset?.(name);
    renderLogoRingPresetOptions?.();
  });
  logoRingPresetSelect?.addEventListener("change", () => refreshLogoRingPresetActionState?.());

  if (panel instanceof HTMLElement) {
    if (mirrorImgInput1 instanceof HTMLInputElement) panel.dataset.logoImage1 = mirrorImgInput1.value || panel.dataset.logoImage1 || "";
    if (mirrorImgInput2 instanceof HTMLInputElement) panel.dataset.logoImage2 = mirrorImgInput2.value || panel.dataset.logoImage2 || "";
    if (mirrorVideoInput instanceof HTMLInputElement) panel.dataset.logoVideo = mirrorVideoInput.value || panel.dataset.logoVideo || "";
  }

  return {
    syncMirrorSettingsVisibility,
    mirrorA: null,
    mirrorB: null,
    mirrorVideo: null
  };
}

function bindPanelDefaultSaveButton({
  panel,
  setDefaultButton,
  buildPanelDefaultSnapshot,
  hasBehaviorInputs
}) {
  if (!(setDefaultButton instanceof HTMLElement)) return;
  setDefaultButton.addEventListener("click", async () => {
    if (!(panel instanceof HTMLElement)) return;
    const snapshot = buildPanelDefaultSnapshot?.();
    if (!snapshot) return;
    globalThis.setStoredPanelDefaultSnapshot?.(panel.id, snapshot);
    globalThis.panelSettingsDefaults?.set?.(panel, snapshot);
    if (hasBehaviorInputs && typeof globalThis.savePanelDefaults === "function") {
      await globalThis.savePanelDefaults("behavior", globalThis.readPanelBehaviorSettingsLocal?.() || {}, setDefaultButton);
    }
  });
}

function bindPanelResetButton({
  panel,
  resetButton,
  applyStoredPanelDefaultSnapshot,
  initialResetSnapshot
}) {
  if (!(resetButton instanceof HTMLElement)) return;
  resetButton.addEventListener("click", () => {
    const stored = panel instanceof HTMLElement ? globalThis.getStoredPanelDefaultSnapshot?.(panel.id) : null;
    applyStoredPanelDefaultSnapshot?.(stored || initialResetSnapshot || {});
  });
}

function finishBuildPanelSettingsBridge({
  panel,
  state,
  settings,
  titleEl,
  titleInput,
  previewModeInput,
  accentInput,
  opacityInput,
  blurInput,
  widthInput,
  heightInput,
  resetButton,
  setDefaultButton,
  buildPanelDefaultSnapshot,
  applyStoredPanelDefaultSnapshot,
  refreshBehaviorInputs,
  syncPanelSettingVisibility,
  applyAccent,
  applyOpacity,
  applyBlur,
  applySize,
  hasBehaviorInputs,
  isLogoPanel,
  isForyouPanel,
  mirrorStrategyInput,
  mirrorAnimationInput,
  mirrorSingleInput,
  mirrorTriptychInput,
  mirrorOperaInput,
  mirrorImgInput1,
  mirrorImgInput2,
  mirrorVideoInput,
  spellInput,
  mirrorFixedBlock,
  mirrorSingleBlock,
  mirrorTriptychBlock,
  mirrorOperaBlock,
  logoSubtitleInput,
  logoSloganInput,
  logoSizeInput,
  logoMaskInsetInput,
  logoSpellcastRingScaleInput,
  logoSpellcastGlowScaleInput,
  logoGrayRingSpeedInput,
  logoGrayRingGrayscaleInput,
  logoGrayRingColorfulnessInput,
  logoSpellcastLayerInput,
  logoHoldRingScaleInput,
  logoHoldRingLayerInput,
  logoAlignGrayRingButton,
  logoAlignGrayRingMinimalButton,
  logoSaveRingPresetButton,
  logoLoadRingPresetButton,
  logoDeleteRingPresetButton,
  logoRingPresetSelect,
  micLongpressInput,
  micMaxHoldInput,
  refreshLogoRingReadouts,
  buildLogoRingPresetPayload,
  refreshLogoRingPresetActionState,
  renderLogoRingPresetOptions,
  applyLogoRingPreset,
  initialResetSnapshot
}) {
  let syncMirrorSettingsVisibility = () => {};
  let mirrorA = null;
  let mirrorB = null;
  let mirrorVideo = null;

  if (isLogoPanel) {
    const bindLogoControls =
      globalThis.bindLogoPanelSettingsControls ||
      bindLogoPanelSettingsControls;
    const logoBindings = bindLogoControls({
      panel,
      state,
      mirrorImgInput1,
      mirrorImgInput2,
      mirrorVideoInput,
      mirrorStrategyInput,
      mirrorAnimationInput,
      mirrorSingleInput,
      mirrorTriptychInput,
      mirrorOperaInput,
      mirrorFixedBlock,
      mirrorSingleBlock,
      mirrorTriptychBlock,
      mirrorOperaBlock,
      spellInput,
      logoSubtitleInput,
      logoSloganInput,
      logoSizeInput,
      logoMaskInsetInput,
      logoSpellcastRingScaleInput,
      logoSpellcastGlowScaleInput,
      logoGrayRingSpeedInput,
      logoGrayRingGrayscaleInput,
      logoGrayRingColorfulnessInput,
      logoSpellcastLayerInput,
      logoHoldRingScaleInput,
      logoHoldRingLayerInput,
      logoAlignGrayRingButton,
      logoAlignGrayRingMinimalButton,
      logoSaveRingPresetButton,
      logoLoadRingPresetButton,
      logoDeleteRingPresetButton,
      logoRingPresetSelect,
      micLongpressInput,
      micMaxHoldInput,
      micLogoSurfaceModeInput,
      micDockSurfaceModeInput,
      micSettingsSurfaceModeInput,
      refreshLogoRingReadouts,
      buildLogoRingPresetPayload,
      refreshLogoRingPresetActionState,
      renderLogoRingPresetOptions,
      applyLogoRingPreset
    });
    syncMirrorSettingsVisibility = logoBindings.syncMirrorSettingsVisibility;
    mirrorA = logoBindings.mirrorA;
    mirrorB = logoBindings.mirrorB;
    mirrorVideo = logoBindings.mirrorVideo;
  }

  const storedPanelDefaults = getStoredPanelDefaultSnapshot(panel.id);
  if (storedPanelDefaults) {
    applyStoredPanelDefaultSnapshot(storedPanelDefaults);
  }
  panelSettingsDefaults.set(panel, initialResetSnapshot);
  applyStoredPanelLayout(panel);
  refreshBehaviorInputs();
  refreshLogoRingPresetActionState();
  panel.__refreshSettings = () => {
    refreshBehaviorInputs();
    syncPanelSettingVisibility(panel, settings);
    if (titleEl) titleInput.value = titleEl.textContent.trim();
    if (previewModeInput) {
      previewModeInput.value =
        panel.dataset.previewMode || globalThis.getForyouPreviewModeModule?.() || FORYOU_PREVIEW_MODES.AUTO;
    }
    opacityInput.value = panel.dataset.panelOpacity || opacityInput.value;
    blurInput.value = panel.dataset.panelBlur || blurInput.value;
    widthInput.value = panel.dataset.panelWidth || widthInput.value;
    heightInput.value = panel.dataset.panelHeight || heightInput.value;
    accentInput.value = panel.dataset.panelAccent && panel.dataset.panelAccent.startsWith("#") ? panel.dataset.panelAccent : accentInput.value;
    if (isLogoPanel) {
      settings.querySelectorAll("[data-mic-debug-board]").forEach((node) => node.remove());
      const debugMarkup = buildMicDebugBoardMarkup(readPanelBehaviorSettingsLocal().mic);
      micMaxHoldInput?.closest("label")?.insertAdjacentHTML("afterend", debugMarkup);
    }
  };
  panel.__applyDefaultSnapshot = (snapshot) => {
    applyStoredPanelDefaultSnapshot(snapshot);
    applyStoredPanelLayout(panel);
    refreshBehaviorInputs();
    syncPanelSettingVisibility(panel, settings);
  };

  bindPanelDefaultSaveButton({
    panel,
    setDefaultButton,
    buildPanelDefaultSnapshot,
    hasBehaviorInputs
  });

  bindPanelResetButton({
    panel,
    resetButton,
    titleEl,
    accentInput,
    opacityInput,
    blurInput,
    widthInput,
    heightInput,
    previewModeInput,
    applyAccent,
    applyOpacity,
    applyBlur,
    applySize,
    hasBehaviorInputs,
    isLogoPanel,
    mirrorStrategyInput,
    mirrorAnimationInput,
    mirrorSingleInput,
    mirrorTriptychInput,
    mirrorOperaInput,
    mirrorImgInput1,
    mirrorImgInput2,
    mirrorVideoInput,
    mirrorA,
    mirrorB,
    mirrorVideo,
    spellInput,
    syncMirrorSettingsVisibility,
    isForyouPanel,
    state
  });
}

globalThis.bindLogoPanelSettingsControls = globalThis.bindLogoPanelSettingsControls || bindLogoPanelSettingsControls;
globalThis.finishBuildPanelSettingsBridge = finishBuildPanelSettingsBridge;
