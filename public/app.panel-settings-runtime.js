function buildPanelAppearanceHelpers({
  panel,
  accentInput,
  opacityInput,
  blurInput,
  widthInput,
  heightInput
}) {
  const applyAccent = () => {
    if (!(panel instanceof HTMLElement) || !(accentInput instanceof HTMLInputElement)) return;
    panel.dataset.panelAccent = accentInput.value || "#00f5a0";
  };
  const applyOpacity = () => {
    if (!(panel instanceof HTMLElement) || !(opacityInput instanceof HTMLInputElement)) return;
    panel.dataset.panelOpacity = String(opacityInput.value || "0.78");
  };
  const applyBlur = () => {
    if (!(panel instanceof HTMLElement) || !(blurInput instanceof HTMLInputElement)) return;
    panel.dataset.panelBlur = String(blurInput.value || "18");
  };
  const applySize = () => {
    if (!(panel instanceof HTMLElement)) return;
    const requestedWidth = Number(widthInput?.value || panel.dataset.panelWidth || 0);
    const requestedHeight = Number(heightInput?.value || panel.dataset.panelHeight || 0);
    const clamped =
      typeof clampPanelSizeValue === "function"
        ? clampPanelSizeValue(panel, requestedWidth, requestedHeight)
        : { width: requestedWidth, height: requestedHeight };
    if (clamped.width > 0) {
      panel.dataset.panelWidth = String(clamped.width);
      panel.style.width = `${clamped.width}px`;
      if (widthInput instanceof HTMLInputElement) widthInput.value = String(clamped.width);
    }
    if (clamped.height > 0) {
      panel.dataset.panelHeight = String(clamped.height);
      panel.style.height = `${clamped.height}px`;
      if (heightInput instanceof HTMLInputElement) heightInput.value = String(clamped.height);
    }
    if (clamped.width > 0 || clamped.height > 0) {
      panel.dataset.userMoved = "true";
      panel.classList.remove("showcase-panel");
      persistPanelLayout?.(panel);
    }
  };
  [accentInput, opacityInput, blurInput, widthInput, heightInput].forEach((input) => {
    if (!(input instanceof HTMLElement)) return;
    input.addEventListener("input", () => {
      applyAccent();
      applyOpacity();
      applyBlur();
      applySize();
    });
  });
  return { applyAccent, applyOpacity, applyBlur, applySize };
}

function buildLogoRingPresetHelpers({
  logoSpellcastRingScaleInput,
  logoSpellcastGlowScaleInput,
  logoGrayRingSpeedInput,
  logoGrayRingGrayscaleInput,
  logoGrayRingColorfulnessInput,
  logoSpellcastLayerInput,
  logoHoldRingScaleInput,
  logoHoldRingLayerInput,
  logoSpellcastRingScaleReadout,
  logoSpellcastGlowScaleReadout,
  logoGrayRingSpeedReadout,
  logoGrayRingGrayscaleReadout,
  logoGrayRingColorfulnessReadout,
  logoHoldRingScaleReadout,
  logoRingPresetSelect,
  logoLoadRingPresetButton,
  logoDeleteRingPresetButton
}) {
  const refreshLogoRingReadouts = () => {
    if (logoSpellcastRingScaleReadout) logoSpellcastRingScaleReadout.textContent = String(logoSpellcastRingScaleInput?.value || "1");
    if (logoSpellcastGlowScaleReadout) logoSpellcastGlowScaleReadout.textContent = String(logoSpellcastGlowScaleInput?.value || "0.18");
    if (logoGrayRingSpeedReadout) logoGrayRingSpeedReadout.textContent = `${String(logoGrayRingSpeedInput?.value || "5.8")}s`;
    if (logoGrayRingGrayscaleReadout) logoGrayRingGrayscaleReadout.textContent = String(logoGrayRingGrayscaleInput?.value || "0.6");
    if (logoGrayRingColorfulnessReadout) logoGrayRingColorfulnessReadout.textContent = String(logoGrayRingColorfulnessInput?.value || "0.28");
    if (logoHoldRingScaleReadout) logoHoldRingScaleReadout.textContent = String(logoHoldRingScaleInput?.value || "1");
  };
  const buildLogoRingPresetPayload = () => ({
    spellcast_ring_scale: Number(logoSpellcastRingScaleInput?.value || 1),
    spellcast_glow_scale: Number(logoSpellcastGlowScaleInput?.value || 0.18),
    gray_ring_speed_sec: Number(logoGrayRingSpeedInput?.value || 5.8),
    gray_ring_grayscale: Number(logoGrayRingGrayscaleInput?.value || 0.6),
    gray_ring_colorfulness: Number(logoGrayRingColorfulnessInput?.value || 0.28),
    spellcast_layer: String(logoSpellcastLayerInput?.value || "behind"),
    hold_ring_scale: Number(logoHoldRingScaleInput?.value || 1),
    hold_ring_layer: String(logoHoldRingLayerInput?.value || "behind")
  });
  const refreshLogoRingPresetActionState = () => {
    const hasPreset = !!String(logoRingPresetSelect?.value || "").trim();
    if (logoLoadRingPresetButton) logoLoadRingPresetButton.disabled = !hasPreset;
    if (logoDeleteRingPresetButton) logoDeleteRingPresetButton.disabled = !hasPreset;
  };
  const renderLogoRingPresetOptions = () => {
    refreshLogoRingPresetActionState();
  };
  return {
    refreshLogoRingReadouts,
    buildLogoRingPresetPayload,
    refreshLogoRingPresetActionState,
    renderLogoRingPresetOptions
  };
}

function buildPanelStateSyncHelpers({
  panel,
  titleEl,
  titleInput,
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
  refreshLogoRingReadouts,
  renderLogoRingPresetOptions,
  ...rest
}) {
  const buildPanelDefaultSnapshot = () => ({
    title: String(titleInput?.value || titleEl?.textContent || "").trim(),
    accent: String(accentInput?.value || panel?.dataset?.panelAccent || "#00f5a0"),
    opacity: String(opacityInput?.value || panel?.dataset?.panelOpacity || "0.78"),
    blur: String(blurInput?.value || panel?.dataset?.panelBlur || "18"),
    width: String(widthInput?.value || panel?.dataset?.panelWidth || ""),
    height: String(heightInput?.value || panel?.dataset?.panelHeight || ""),
    preview_mode: String(previewModeInput?.value || panel?.dataset?.previewMode || "")
  });
  const applyStoredPanelDefaultSnapshot = (snapshot = {}) => {
    if (titleInput && snapshot.title != null) titleInput.value = String(snapshot.title);
    if (titleEl && snapshot.title != null) titleEl.textContent = String(snapshot.title);
    if (accentInput && snapshot.accent != null) accentInput.value = String(snapshot.accent);
    if (opacityInput && snapshot.opacity != null) opacityInput.value = String(snapshot.opacity);
    if (blurInput && snapshot.blur != null) blurInput.value = String(snapshot.blur);
    if (widthInput && snapshot.width != null) widthInput.value = String(snapshot.width);
    if (heightInput && snapshot.height != null) heightInput.value = String(snapshot.height);
    if (previewModeInput && snapshot.preview_mode != null) previewModeInput.value = String(snapshot.preview_mode);
    applyAccent?.();
    applyOpacity?.();
    applyBlur?.();
    applySize?.();
    refreshLogoRingReadouts?.();
    renderLogoRingPresetOptions?.();
  };
  const refreshBehaviorInputs = () => {
    const behavior = typeof readPanelBehaviorSettingsLocal === "function" ? readPanelBehaviorSettingsLocal() : null;
    if (!behavior) return;
    const panelCommandEntry = globalThis.resolvePanelCommandEntry?.(panel);
    const panelCommandSettings = panelCommandEntry?.behaviorKey
      ? behavior.panel_commands?.[panelCommandEntry.behaviorKey] || null
      : null;
    const logo = behavior.logo || {};
    if (rest.panelShortcutKeyInput instanceof HTMLInputElement) {
      rest.panelShortcutKeyInput.value = String(panelCommandSettings?.shortcut_key || "");
    }
    if (rest.panelShortcutDefaultReadout instanceof HTMLElement) {
      const fallbackShortcut = globalThis.fallbackShortcutChordForPanel?.(panel) || "C + S + ?";
      rest.panelShortcutDefaultReadout.textContent = loginCopy(
        `System default · ${fallbackShortcut}`
      );
      rest.panelShortcutDefaultReadout.title = rest.panelShortcutDefaultReadout.textContent;
    }
    if (rest.panelVoiceCommandInput instanceof HTMLInputElement) {
      const locale =
        globalThis.CSSOS_I18N?.getCurrentLocale?.() ||
        globalThis.currentLocale ||
        document.documentElement.lang ||
        "en";
      rest.panelVoiceCommandInput.value = String(
        panelCommandSettings?.voice_command ||
          globalThis.fallbackVoiceCommandForPanel?.(panel, locale) ||
          ""
      );
    }
    if (rest.panelVoiceDefaultReadout instanceof HTMLElement) {
      const locale =
        globalThis.CSSOS_I18N?.getCurrentLocale?.() ||
        globalThis.currentLocale ||
        document.documentElement.lang ||
        "en";
      const fallbackVoice = globalThis.fallbackVoiceCommandForPanel?.(panel, locale) || "";
      rest.panelVoiceDefaultReadout.textContent = loginCopy(
        `System default · ${fallbackVoice}`
      );
      rest.panelVoiceDefaultReadout.title = rest.panelVoiceDefaultReadout.textContent;
      if (rest.panelVoiceCommandInput instanceof HTMLInputElement) {
        rest.panelVoiceCommandInput.placeholder = fallbackVoice || loginCopy("Open this panel");
      }
    }
    if (rest.panelShortcutKeyInput instanceof HTMLInputElement) {
      const fallbackShortcut = globalThis.fallbackShortcutChordForPanel?.(panel) || "C + S + ?";
      rest.panelShortcutKeyInput.title = loginCopy(
        `System default · ${fallbackShortcut}`
      );
    }
    if (rest.logoSubtitleInput instanceof HTMLInputElement) rest.logoSubtitleInput.value = String(logo.subtitle || "");
    if (rest.logoSloganInput instanceof HTMLInputElement) rest.logoSloganInput.value = String(logo.slogan_template || "");
    if (rest.logoSizeInput instanceof HTMLInputElement) rest.logoSizeInput.value = String(logo.mirror_size_px ?? 600);
    if (rest.logoMaskInsetInput instanceof HTMLInputElement) rest.logoMaskInsetInput.value = String(logo.mask_inset_percent ?? 12);
    if (rest.logoSpellcastRingScaleInput instanceof HTMLInputElement) rest.logoSpellcastRingScaleInput.value = String(logo.spellcast_ring_scale ?? 1);
    if (rest.logoSpellcastGlowScaleInput instanceof HTMLInputElement) rest.logoSpellcastGlowScaleInput.value = String(logo.spellcast_glow_scale ?? 0.18);
    if (rest.logoGrayRingSpeedInput instanceof HTMLInputElement) rest.logoGrayRingSpeedInput.value = String(logo.gray_ring_speed_sec ?? 5.8);
    if (rest.logoGrayRingGrayscaleInput instanceof HTMLInputElement) rest.logoGrayRingGrayscaleInput.value = String(logo.gray_ring_grayscale ?? 0.6);
    if (rest.logoGrayRingColorfulnessInput instanceof HTMLInputElement) rest.logoGrayRingColorfulnessInput.value = String(logo.gray_ring_colorfulness ?? 0.28);
    if (rest.logoSpellcastLayerInput instanceof HTMLSelectElement) rest.logoSpellcastLayerInput.value = String(logo.spellcast_layer || "behind");
    if (rest.logoHoldRingScaleInput instanceof HTMLInputElement) rest.logoHoldRingScaleInput.value = String(logo.hold_ring_scale ?? 1);
    if (rest.logoHoldRingLayerInput instanceof HTMLSelectElement) rest.logoHoldRingLayerInput.value = String(logo.hold_ring_layer || "behind");
    if (rest.micLogoSurfaceModeInput instanceof HTMLSelectElement) rest.micLogoSurfaceModeInput.value = String(behavior.mic?.logo_surface_mode || "mv_only");
    if (rest.micDockSurfaceModeInput instanceof HTMLSelectElement) rest.micDockSurfaceModeInput.value = String(behavior.mic?.dock_surface_mode || "mv_only");
    if (rest.micSettingsSurfaceModeInput instanceof HTMLSelectElement) rest.micSettingsSurfaceModeInput.value = String(behavior.mic?.settings_surface_mode || "mv_only");
    if (rest.watchDefaultTabInput instanceof HTMLSelectElement) rest.watchDefaultTabInput.value = String(behavior.watch?.default_tab || "mv");
    if (rest.watchPreviewLimitInput instanceof HTMLInputElement) rest.watchPreviewLimitInput.value = String(behavior.watch?.preview_limit_sec ?? 30);
    if (rest.watchSubtitleScaleInput instanceof HTMLInputElement) rest.watchSubtitleScaleInput.value = String(behavior.watch?.subtitle_scale ?? 1);
    if (rest.watchEngineDetailInput instanceof HTMLSelectElement) rest.watchEngineDetailInput.value = String(behavior.watch?.engine_detail || "full");
    if (rest.watchShowGenerationFlowInput instanceof HTMLInputElement) rest.watchShowGenerationFlowInput.checked = !!behavior.watch?.show_generation_flow;
    if (rest.watchFlashRingScaleInput instanceof HTMLInputElement) rest.watchFlashRingScaleInput.value = String(behavior.watch?.flash_ring_scale ?? 0.94);
    Object.entries(rest).forEach(([key, input]) => {
      if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement) && !(input instanceof HTMLTextAreaElement)) return;
      const match = key.match(/^([a-zA-Z0-9]+)(.+)Input$/);
      if (!match) return;
    });
    refreshLogoRingReadouts?.();
    renderLogoRingPresetOptions?.();
  };
  return { buildPanelDefaultSnapshot, applyStoredPanelDefaultSnapshot, refreshBehaviorInputs };
}

function collectPanelSettingsRuntimeBridge({
  panel,
  settings,
  titleEl,
  isLogoPanel,
  state
}) {
  const titleInput = settings.querySelector('[data-setting="title"]');
  const titleBlock = settings.querySelector('[data-setting-block="title"]');
  if (!titleEl) {
    titleBlock.style.display = "none";
  } else {
    titleInput.value = titleEl.textContent.trim();
    titleInput.addEventListener("input", () => {
      titleEl.textContent = titleInput.value || titleEl.textContent;
    });
  }

  const runtime = {
    titleInput,
    panelShortcutKeyInput: settings.querySelector('[data-setting="panel-shortcut-key"]'),
    panelVoiceCommandInput: settings.querySelector('[data-setting="panel-voice-command"]'),
    panelShortcutDefaultReadout: settings.querySelector('[data-setting-readout="panel-shortcut-default"]'),
    panelVoiceDefaultReadout: settings.querySelector('[data-setting-readout="panel-voice-default"]'),
    accentInput: settings.querySelector('[data-setting="accent"]'),
    opacityInput: settings.querySelector('[data-setting="opacity"]'),
    blurInput: settings.querySelector('[data-setting="blur"]'),
    widthInput: settings.querySelector('[data-setting="width"]'),
    heightInput: settings.querySelector('[data-setting="height"]'),
    resetButton: settings.querySelector('[data-setting="reset"]'),
    setDefaultButton: settings.querySelector('[data-setting="set-default"]'),
    mirrorImgInput1: settings.querySelector('[data-setting="mirror-image-1"]'),
    mirrorImgInput2: settings.querySelector('[data-setting="mirror-image-2"]'),
    mirrorVideoInput: settings.querySelector('[data-setting="mirror-video"]'),
    mirrorStrategyInput: settings.querySelector('[data-setting="mirror-animation-strategy"]'),
    mirrorAnimationInput: settings.querySelector('[data-setting="mirror-animation-mode"]'),
    mirrorSingleInput: settings.querySelector('[data-setting="mirror-animation-single"]'),
    mirrorTriptychInput: settings.querySelector('[data-setting="mirror-animation-triptych"]'),
    mirrorOperaInput: settings.querySelector('[data-setting="mirror-animation-opera"]'),
    spellInput: settings.querySelector('[data-setting="spell"]'),
    logoSubtitleInput: settings.querySelector('[data-setting="logo-subtitle"]'),
    logoSloganInput: settings.querySelector('[data-setting="logo-slogan-template"]'),
    logoSizeInput: settings.querySelector('[data-setting="logo-size"]'),
    logoMaskInsetInput: settings.querySelector('[data-setting="logo-mask-inset"]'),
    logoSpellcastRingScaleInput: settings.querySelector('[data-setting="logo-spellcast-ring-scale"]'),
    logoSpellcastGlowScaleInput: settings.querySelector('[data-setting="logo-spellcast-glow-scale"]'),
    logoGrayRingSpeedInput: settings.querySelector('[data-setting="logo-gray-ring-speed"]'),
    logoGrayRingGrayscaleInput: settings.querySelector('[data-setting="logo-gray-ring-grayscale"]'),
    logoGrayRingColorfulnessInput: settings.querySelector('[data-setting="logo-gray-ring-colorfulness"]'),
    logoSpellcastLayerInput: settings.querySelector('[data-setting="logo-spellcast-layer"]'),
    logoHoldRingScaleInput: settings.querySelector('[data-setting="logo-hold-ring-scale"]'),
    logoHoldRingLayerInput: settings.querySelector('[data-setting="logo-hold-ring-layer"]'),
    logoSpellcastRingScaleReadout: settings.querySelector('[data-setting-readout="logo-spellcast-ring-scale"]'),
    logoSpellcastGlowScaleReadout: settings.querySelector('[data-setting-readout="logo-spellcast-glow-scale"]'),
    logoGrayRingSpeedReadout: settings.querySelector('[data-setting-readout="logo-gray-ring-speed"]'),
    logoGrayRingGrayscaleReadout: settings.querySelector('[data-setting-readout="logo-gray-ring-grayscale"]'),
    logoGrayRingColorfulnessReadout: settings.querySelector('[data-setting-readout="logo-gray-ring-colorfulness"]'),
    logoHoldRingScaleReadout: settings.querySelector('[data-setting-readout="logo-hold-ring-scale"]'),
    logoAlignGrayRingButton: settings.querySelector('[data-setting="logo-align-gray-ring"]'),
    logoAlignGrayRingMinimalButton: settings.querySelector('[data-setting="logo-align-gray-ring-minimal"]'),
    logoSaveRingPresetButton: settings.querySelector('[data-setting="logo-save-ring-preset"]'),
    logoLoadRingPresetButton: settings.querySelector('[data-setting="logo-load-ring-preset"]'),
    logoDeleteRingPresetButton: settings.querySelector('[data-setting="logo-delete-ring-preset"]'),
    logoRingPresetSelect: settings.querySelector('[data-setting="logo-ring-preset-select"]'),
    micLongpressInput: settings.querySelector('[data-setting="mic-longpress-ms"]'),
    micMaxHoldInput: settings.querySelector('[data-setting="mic-max-hold-sec"]'),
    micLogoSurfaceModeInput: settings.querySelector('[data-setting="mic-logo-surface-mode"]'),
    micDockSurfaceModeInput: settings.querySelector('[data-setting="mic-dock-surface-mode"]'),
    micSettingsSurfaceModeInput: settings.querySelector('[data-setting="mic-settings-surface-mode"]'),
    cssmvDefaultSectionInput: settings.querySelector('[data-setting="cssmv-default-section"]'),
    cssmvAutoRefreshInput: settings.querySelector('[data-setting="cssmv-auto-refresh"]'),
    languageDefaultModeInput: settings.querySelector('[data-setting="language-default-mode"]'),
    languageShowMoreInput: settings.querySelector('[data-setting="language-show-more"]'),
    loginPanelDensityInput: settings.querySelector('[data-setting="login-panel-density"]'),
    loginPreferredProviderInput: settings.querySelector('[data-setting="login-preferred-provider"]'),
    loginShowLogoutInput: settings.querySelector('[data-setting="login-show-logout"]'),
    loginSessionDaysInput: settings.querySelector('[data-setting="login-session-days"]'),
    profilePanelDensityInput: settings.querySelector('[data-setting="profile-panel-density"]'),
    profileNoteInput: settings.querySelector('[data-setting="profile-note"]'),
    profileDefaultNavInput: settings.querySelector('[data-setting="profile-default-nav"]'),
    worksFocusSectionInput: settings.querySelector('[data-setting="works-focus-section"]'),
    worksAutoLoadInput: settings.querySelector('[data-setting="works-auto-load"]'),
    worksSearchEnabledInput: settings.querySelector('[data-setting="works-search-enabled"]'),
    worksSearchLimitInput: settings.querySelector('[data-setting="works-search-limit"]'),
    worksDefaultFilterInput: settings.querySelector('[data-setting="works-default-filter"]'),
    worksDefaultSortInput: settings.querySelector('[data-setting="works-default-sort"]'),
    sellerFocusLaneInput: settings.querySelector('[data-setting="seller-focus-lane"]'),
    sellerAutoRefreshInput: settings.querySelector('[data-setting="seller-auto-refresh"]'),
    sellerOrderFilterInput: settings.querySelector('[data-setting="seller-order-filter"]'),
    sellerLedgerLimitInput: settings.querySelector('[data-setting="seller-ledger-limit"]'),
    aboutDefaultTabInput: settings.querySelector('[data-setting="about-default-tab"]'),
    aboutDensityInput: settings.querySelector('[data-setting="about-density"]'),
    apiBillingModeInput: settings.querySelector('[data-setting="api-billing-mode"]'),
    apiPaymentMethodDefaultInput: settings.querySelector('[data-setting="api-payment-method-default"]'),
    apiAutoRechargeDefaultInput: settings.querySelector('[data-setting="api-auto-recharge-default"]'),
    commercePayoutHoldDaysInput: settings.querySelector('[data-setting="commerce-payout-hold-days"]'),
    commercePayoutSweepMinutesInput: settings.querySelector('[data-setting="commerce-payout-sweep-minutes"]'),
    commerceMinTipUsdInput: settings.querySelector('[data-setting="commerce-min-tip-usd"]'),
    previewModeInput: settings.querySelector('[data-setting="preview-mode"]'),
    foryouHoldInput: settings.querySelector('[data-setting="foryou-hold-ms"]'),
    foryouCompactInput: settings.querySelector('[data-setting="foryou-compact-after-lyrics"]'),
    foryouAutoWatchInput: settings.querySelector('[data-setting="foryou-auto-watch-ms"]'),
    foryouSearchEnabledInput: settings.querySelector('[data-setting="foryou-search-enabled"]'),
    foryouMarketLimitInput: settings.querySelector('[data-setting="foryou-market-limit"]'),
    foryouDefaultFilterInput: settings.querySelector('[data-setting="foryou-default-filter"]'),
    foryouDefaultSortInput: settings.querySelector('[data-setting="foryou-default-sort"]'),
    watchDefaultTabInput: settings.querySelector('[data-setting="watch-default-tab"]'),
    watchPreviewLimitInput: settings.querySelector('[data-setting="watch-preview-limit-sec"]'),
    watchSubtitleScaleInput: settings.querySelector('[data-setting="watch-subtitle-scale"]'),
    watchEngineDetailInput: settings.querySelector('[data-setting="watch-engine-detail"]'),
    watchShowGenerationFlowInput: settings.querySelector('[data-setting="watch-show-generation-flow"]'),
    watchFlashRingScaleInput: settings.querySelector('[data-setting="watch-flash-ring-scale"]'),
    lyricsTypeSpeedInput: settings.querySelector('[data-setting="lyrics-type-speed"]'),
    lyricsFontScaleInput: settings.querySelector('[data-setting="lyrics-font-scale"]'),
    lyricsAutoCollapseInput: settings.querySelector('[data-setting="lyrics-auto-collapse"]'),
    musicWaveformBarsInput: settings.querySelector('[data-setting="music-waveform-bars"]'),
    musicLayerCardsInput: settings.querySelector('[data-setting="music-layer-cards"]'),
    videoStoryboardFramesInput: settings.querySelector('[data-setting="video-storyboard-frames"]'),
    videoCameraSlotsInput: settings.querySelector('[data-setting="video-camera-slots"]'),
    reportsDefaultKindInput: settings.querySelector('[data-setting="reports-default-kind"]'),
    reportsFocusSectionInput: settings.querySelector('[data-setting="reports-focus-section"]'),
    reportsDensityInput: settings.querySelector('[data-setting="reports-density"]'),
    reportsPreviewExpandedInput: settings.querySelector('[data-setting="reports-preview-expanded"]'),
    opsRecoveryLimitInput: settings.querySelector('[data-setting="ops-recovery-limit"]'),
    opsFocusLaneInput: settings.querySelector('[data-setting="ops-focus-lane"]'),
    opsAlertDensityInput: settings.querySelector('[data-setting="ops-alert-density"]'),
    opsAutoRefreshInput: settings.querySelector('[data-setting="ops-auto-refresh"]'),
    mirrorFixedBlock: settings.querySelector('[data-setting-block="mirror-fixed-mode"]'),
    mirrorSingleBlock: settings.querySelector('[data-setting-block="mirror-single-mode"]'),
    mirrorTriptychBlock: settings.querySelector('[data-setting-block="mirror-triptych-mode"]'),
    mirrorOperaBlock: settings.querySelector('[data-setting-block="mirror-opera-mode"]')
  };

  const storedAccent = panel.dataset.panelAccent;
  runtime.accentInput.value = storedAccent && storedAccent.startsWith("#") ? storedAccent : "#00f5a0";
  runtime.opacityInput.value = panel.dataset.panelOpacity;
  runtime.blurInput.value = panel.dataset.panelBlur;
  runtime.widthInput.value = panel.dataset.panelWidth;
  runtime.heightInput.value = panel.dataset.panelHeight;
  if (runtime.previewModeInput) {
    runtime.previewModeInput.value = globalThis.getForyouPreviewModeModule?.() || FORYOU_PREVIEW_MODES.AUTO;
    runtime.previewModeInput.addEventListener("change", () => {
      panel.dataset.previewMode = runtime.previewModeInput.value || FORYOU_PREVIEW_MODES.AUTO;
      localStorage.setItem(FORYOU_PREVIEW_MODE_KEY, panel.dataset.previewMode);
      if (panel.dataset.previewMode === FORYOU_PREVIEW_MODES.IMAGE) {
        globalThis.syncForyouThumbFromLyricsModule?.(state.title, state.lines);
      }
      if (
        panel.dataset.previewMode === FORYOU_PREVIEW_MODES.VIDEO &&
        watchVideo?.src &&
        watchVideo.style.display !== "none" &&
        hasEffectivePreviewVideo()
      ) {
        setForyouThumbVideo(watchVideo.src);
      }
      if (
        panel.dataset.previewMode === FORYOU_PREVIEW_MODES.AUTO &&
        watchVideo?.src &&
        watchVideo.style.display !== "none" &&
        hasEffectivePreviewVideo()
      ) {
        setForyouThumbVideo(watchVideo.src);
      }
    });
  }

  const { applyAccent, applyOpacity, applyBlur, applySize } = buildPanelAppearanceHelpers({
    panel,
    accentInput: runtime.accentInput,
    opacityInput: runtime.opacityInput,
    blurInput: runtime.blurInput,
    widthInput: runtime.widthInput,
    heightInput: runtime.heightInput
  });
  const {
    refreshLogoRingReadouts,
    buildLogoRingPresetPayload,
    refreshLogoRingPresetActionState,
    renderLogoRingPresetOptions
  } = buildLogoRingPresetHelpers({
    logoSpellcastRingScaleInput: runtime.logoSpellcastRingScaleInput,
    logoSpellcastGlowScaleInput: runtime.logoSpellcastGlowScaleInput,
    logoGrayRingSpeedInput: runtime.logoGrayRingSpeedInput,
    logoGrayRingGrayscaleInput: runtime.logoGrayRingGrayscaleInput,
    logoGrayRingColorfulnessInput: runtime.logoGrayRingColorfulnessInput,
    logoSpellcastLayerInput: runtime.logoSpellcastLayerInput,
    logoHoldRingScaleInput: runtime.logoHoldRingScaleInput,
    logoHoldRingLayerInput: runtime.logoHoldRingLayerInput,
    logoSpellcastRingScaleReadout: runtime.logoSpellcastRingScaleReadout,
    logoSpellcastGlowScaleReadout: runtime.logoSpellcastGlowScaleReadout,
    logoGrayRingSpeedReadout: runtime.logoGrayRingSpeedReadout,
    logoGrayRingGrayscaleReadout: runtime.logoGrayRingGrayscaleReadout,
    logoGrayRingColorfulnessReadout: runtime.logoGrayRingColorfulnessReadout,
    logoHoldRingScaleReadout: runtime.logoHoldRingScaleReadout,
    logoRingPresetSelect: runtime.logoRingPresetSelect,
    logoLoadRingPresetButton: runtime.logoLoadRingPresetButton,
    logoDeleteRingPresetButton: runtime.logoDeleteRingPresetButton
  });
  const applyLogoRingPreset = (preset) => {
    if (!preset || typeof preset !== "object") return;
    if (runtime.logoSpellcastRingScaleInput) runtime.logoSpellcastRingScaleInput.value = String(preset.spellcast_ring_scale ?? 1);
    if (runtime.logoSpellcastGlowScaleInput) runtime.logoSpellcastGlowScaleInput.value = String(preset.spellcast_glow_scale ?? 0.18);
    if (runtime.logoGrayRingSpeedInput) runtime.logoGrayRingSpeedInput.value = String(preset.gray_ring_speed_sec ?? 5.8);
    if (runtime.logoGrayRingGrayscaleInput) runtime.logoGrayRingGrayscaleInput.value = String(preset.gray_ring_grayscale ?? 0.6);
    if (runtime.logoGrayRingColorfulnessInput) runtime.logoGrayRingColorfulnessInput.value = String(preset.gray_ring_colorfulness ?? 0.28);
    if (runtime.logoSpellcastLayerInput) runtime.logoSpellcastLayerInput.value = String(preset.spellcast_layer || "behind");
    if (runtime.logoHoldRingScaleInput) runtime.logoHoldRingScaleInput.value = String(preset.hold_ring_scale ?? 1);
    if (runtime.logoHoldRingLayerInput) runtime.logoHoldRingLayerInput.value = String(preset.hold_ring_layer || "behind");
    refreshLogoRingReadouts();
    updatePanelBehaviorSettings((current) => ({
      ...current,
      logo: {
        ...current.logo,
        spellcast_ring_scale: Number(preset.spellcast_ring_scale ?? current.logo.spellcast_ring_scale),
        spellcast_glow_scale: Number(preset.spellcast_glow_scale ?? current.logo.spellcast_glow_scale),
        gray_ring_speed_sec: Number(preset.gray_ring_speed_sec ?? current.logo.gray_ring_speed_sec),
        gray_ring_grayscale: Number(preset.gray_ring_grayscale ?? current.logo.gray_ring_grayscale),
        gray_ring_colorfulness: Number(preset.gray_ring_colorfulness ?? current.logo.gray_ring_colorfulness),
        spellcast_layer: String(preset.spellcast_layer || current.logo.spellcast_layer),
        hold_ring_scale: Number(preset.hold_ring_scale ?? current.logo.hold_ring_scale),
        hold_ring_layer: String(preset.hold_ring_layer || current.logo.hold_ring_layer)
      }
    }));
  };
  const {
    buildPanelDefaultSnapshot,
    applyStoredPanelDefaultSnapshot,
    refreshBehaviorInputs
  } = buildPanelStateSyncHelpers({
    panel,
    titleEl,
    titleInput: runtime.titleInput,
    isLogoPanel,
    accentInput: runtime.accentInput,
    opacityInput: runtime.opacityInput,
    blurInput: runtime.blurInput,
    widthInput: runtime.widthInput,
    heightInput: runtime.heightInput,
    previewModeInput: runtime.previewModeInput,
    logoSubtitleInput: runtime.logoSubtitleInput,
    logoSloganInput: runtime.logoSloganInput,
    logoSizeInput: runtime.logoSizeInput,
    logoMaskInsetInput: runtime.logoMaskInsetInput,
    logoSpellcastRingScaleInput: runtime.logoSpellcastRingScaleInput,
    logoSpellcastGlowScaleInput: runtime.logoSpellcastGlowScaleInput,
    logoGrayRingSpeedInput: runtime.logoGrayRingSpeedInput,
    logoGrayRingGrayscaleInput: runtime.logoGrayRingGrayscaleInput,
    logoGrayRingColorfulnessInput: runtime.logoGrayRingColorfulnessInput,
    logoSpellcastLayerInput: runtime.logoSpellcastLayerInput,
    logoHoldRingScaleInput: runtime.logoHoldRingScaleInput,
    logoHoldRingLayerInput: runtime.logoHoldRingLayerInput,
    cssmvDefaultSectionInput: runtime.cssmvDefaultSectionInput,
    cssmvAutoRefreshInput: runtime.cssmvAutoRefreshInput,
    languageDefaultModeInput: runtime.languageDefaultModeInput,
    languageShowMoreInput: runtime.languageShowMoreInput,
    loginPanelDensityInput: runtime.loginPanelDensityInput,
    loginPreferredProviderInput: runtime.loginPreferredProviderInput,
    loginShowLogoutInput: runtime.loginShowLogoutInput,
    loginSessionDaysInput: runtime.loginSessionDaysInput,
    profilePanelDensityInput: runtime.profilePanelDensityInput,
    profileNoteInput: runtime.profileNoteInput,
    profileDefaultNavInput: runtime.profileDefaultNavInput,
    worksFocusSectionInput: runtime.worksFocusSectionInput,
    worksAutoLoadInput: runtime.worksAutoLoadInput,
    worksSearchEnabledInput: runtime.worksSearchEnabledInput,
    worksSearchLimitInput: runtime.worksSearchLimitInput,
    worksDefaultFilterInput: runtime.worksDefaultFilterInput,
    worksDefaultSortInput: runtime.worksDefaultSortInput,
    sellerFocusLaneInput: runtime.sellerFocusLaneInput,
    sellerAutoRefreshInput: runtime.sellerAutoRefreshInput,
    sellerOrderFilterInput: runtime.sellerOrderFilterInput,
    sellerLedgerLimitInput: runtime.sellerLedgerLimitInput,
    aboutDefaultTabInput: runtime.aboutDefaultTabInput,
    aboutDensityInput: runtime.aboutDensityInput,
    apiBillingModeInput: runtime.apiBillingModeInput,
    apiPaymentMethodDefaultInput: runtime.apiPaymentMethodDefaultInput,
    apiAutoRechargeDefaultInput: runtime.apiAutoRechargeDefaultInput,
    commercePayoutHoldDaysInput: runtime.commercePayoutHoldDaysInput,
    commercePayoutSweepMinutesInput: runtime.commercePayoutSweepMinutesInput,
    commerceMinTipUsdInput: runtime.commerceMinTipUsdInput,
    foryouHoldInput: runtime.foryouHoldInput,
    foryouCompactInput: runtime.foryouCompactInput,
    foryouAutoWatchInput: runtime.foryouAutoWatchInput,
    foryouSearchEnabledInput: runtime.foryouSearchEnabledInput,
    foryouMarketLimitInput: runtime.foryouMarketLimitInput,
    foryouDefaultFilterInput: runtime.foryouDefaultFilterInput,
    foryouDefaultSortInput: runtime.foryouDefaultSortInput,
    watchDefaultTabInput: runtime.watchDefaultTabInput,
    watchPreviewLimitInput: runtime.watchPreviewLimitInput,
    watchSubtitleScaleInput: runtime.watchSubtitleScaleInput,
    watchEngineDetailInput: runtime.watchEngineDetailInput,
    watchShowGenerationFlowInput: runtime.watchShowGenerationFlowInput,
    watchFlashRingScaleInput: runtime.watchFlashRingScaleInput,
    lyricsTypeSpeedInput: runtime.lyricsTypeSpeedInput,
    lyricsFontScaleInput: runtime.lyricsFontScaleInput,
    lyricsAutoCollapseInput: runtime.lyricsAutoCollapseInput,
    musicWaveformBarsInput: runtime.musicWaveformBarsInput,
    musicLayerCardsInput: runtime.musicLayerCardsInput,
    videoStoryboardFramesInput: runtime.videoStoryboardFramesInput,
    videoCameraSlotsInput: runtime.videoCameraSlotsInput,
    reportsDefaultKindInput: runtime.reportsDefaultKindInput,
    reportsFocusSectionInput: runtime.reportsFocusSectionInput,
    reportsDensityInput: runtime.reportsDensityInput,
    reportsPreviewExpandedInput: runtime.reportsPreviewExpandedInput,
    opsRecoveryLimitInput: runtime.opsRecoveryLimitInput,
    opsFocusLaneInput: runtime.opsFocusLaneInput,
    opsAlertDensityInput: runtime.opsAlertDensityInput,
    opsAutoRefreshInput: runtime.opsAutoRefreshInput,
    spellInput: runtime.spellInput,
    logoSubtitleInput: runtime.logoSubtitleInput,
    logoSloganInput: runtime.logoSloganInput,
    logoSizeInput: runtime.logoSizeInput,
    logoMaskInsetInput: runtime.logoMaskInsetInput,
    micLongpressInput: runtime.micLongpressInput,
    micMaxHoldInput: runtime.micMaxHoldInput,
    micLogoSurfaceModeInput: runtime.micLogoSurfaceModeInput,
    micDockSurfaceModeInput: runtime.micDockSurfaceModeInput,
    micSettingsSurfaceModeInput: runtime.micSettingsSurfaceModeInput,
    applyAccent,
    applyOpacity,
    applyBlur,
    applySize,
    refreshLogoRingReadouts,
    renderLogoRingPresetOptions
  });

  return {
    ...runtime,
    applyAccent,
    applyOpacity,
    applyBlur,
    applySize,
    refreshLogoRingReadouts,
    buildLogoRingPresetPayload,
    refreshLogoRingPresetActionState,
    renderLogoRingPresetOptions,
    applyLogoRingPreset,
    buildPanelDefaultSnapshot,
    applyStoredPanelDefaultSnapshot,
    refreshBehaviorInputs,
    initialResetSnapshot: { ...buildPanelDefaultSnapshot() }
  };
}

globalThis.collectPanelSettingsRuntimeBridge = collectPanelSettingsRuntimeBridge;
globalThis.buildPanelAppearanceHelpers = globalThis.buildPanelAppearanceHelpers || buildPanelAppearanceHelpers;
globalThis.buildLogoRingPresetHelpers = globalThis.buildLogoRingPresetHelpers || buildLogoRingPresetHelpers;
globalThis.buildPanelStateSyncHelpers = globalThis.buildPanelStateSyncHelpers || buildPanelStateSyncHelpers;
