function buildPanelSettingsContext(panel) {
  const titleEl =
    panel?.querySelector?.(".panel-title") ||
    panel?.querySelector?.("[data-panel-title]") ||
    null;
  const sizeLimits =
    typeof getPanelSizeConstraints === "function"
      ? getPanelSizeConstraints(panel)
      : { minWidth: 320, maxWidth: 1600, minHeight: 200, maxHeight: 1200 };
  return {
    titleEl,
    isLogoPanel: panel === logoPanel,
    isForyouPanel: panel === foryouPanel,
    isWatchPanel: panel === watchPanel,
    isLyricsPanel: panel === lyricsPanel,
    isMusicPanel: panel === musicPanel,
    isVideoPanel: panel === videoPanel,
    isAboutPanel: panel === aboutPanel,
    isApiPanel: panel === apiPanel,
    isDeliveryReportsPanel: panel === deliveryReportsPanel,
    isDeliveryOpsPanel: panel === deliveryOpsPanel,
    isCssmvPanel: panel === cssmvPanel,
    isLanguagePanel: panel === languagePanel,
    isLoginPanel: panel === loginPanel,
    isProfilePanel: panel === profilePanel,
    isWorksPanel: panel === worksPanel,
    isSellerPanel: panel === sellerPanel,
    sizeLimits
  };
}

function resolvePanelSettingsFn(directFn, globalName) {
  if (typeof directFn === "function") return directFn;
  if (typeof globalThis !== "undefined" && typeof globalThis[globalName] === "function") {
    return globalThis[globalName];
  }
  return null;
}

function primePanelSettingsDataset(panel, context) {
  if (!(panel instanceof HTMLElement)) return;
  const rect = panel.getBoundingClientRect();
  const limits = context?.sizeLimits || {};
  if (!panel.dataset.panelAccent) panel.dataset.panelAccent = "#00f5a0";
  if (!panel.dataset.panelOpacity) panel.dataset.panelOpacity = "0.78";
  if (!panel.dataset.panelBlur) panel.dataset.panelBlur = "18";
  if (!panel.dataset.panelWidth) {
    panel.dataset.panelWidth = String(
      Math.round(rect.width || limits.minWidth || panel.offsetWidth || 640)
    );
  }
  if (!panel.dataset.panelHeight) {
    panel.dataset.panelHeight = String(
      Math.round(rect.height || limits.minHeight || panel.offsetHeight || 520)
    );
  }
}

function buildPanelSettingsBridge(panel) {
  // CSSOS_PHASE2_SETTINGS_REBUILD 20260505 — Jing
  // "原来的那些设置参数现在又不见了". The early-return based on
  // existing .panel-settings meant once a panel re-rendered its body
  // (Works Center / For You / MV Pipeline all rewrite innerHTML on
  // certain paths), the settings overlay vanished and never came
  // back because this guard silently no-op'd. Now: only skip if the
  // existing settings element still has rendered controls; if it's
  // empty (somehow lost its children), rebuild from scratch.
  const existing = panel.querySelector(".panel-settings");
  if (existing && existing.children && existing.children.length > 0) return;
  if (existing) {
    try { existing.remove(); } catch (_e) {}
  }
  const context = buildPanelSettingsContext(panel);
  const {
    titleEl,
    isLogoPanel,
    isForyouPanel,
    isWatchPanel,
    isLyricsPanel,
    isMusicPanel,
    isVideoPanel,
    isAboutPanel,
    isApiPanel,
    isDeliveryReportsPanel,
    isDeliveryOpsPanel,
    isCssmvPanel,
    isLanguagePanel,
    isLoginPanel,
    isProfilePanel,
    isWorksPanel,
    isSellerPanel,
    sizeLimits
  } = context;
  primePanelSettingsDataset(panel, context);

  const settings = document.createElement("div");
  settings.className = "panel-settings";
  const buildMarkup = resolvePanelSettingsFn(
    typeof buildPanelSettingsMarkupBridge === "function" ? buildPanelSettingsMarkupBridge : null,
    "buildPanelSettingsMarkupBridge"
  );
  settings.innerHTML =
    buildMarkup?.({
      isLogoPanel,
      isCssmvPanel,
      isLanguagePanel,
      isLoginPanel,
      isProfilePanel,
      isWorksPanel,
      isSellerPanel,
      isAboutPanel,
      isApiPanel,
      isForyouPanel,
      isWatchPanel,
      isLyricsPanel,
      isMusicPanel,
      isVideoPanel,
      isDeliveryReportsPanel,
      isDeliveryOpsPanel,
      sizeLimits
    }) || "";

  panel.appendChild(settings);
  syncPanelSettingVisibility(panel, settings);

  const collectRuntime = resolvePanelSettingsFn(
    typeof collectPanelSettingsRuntimeBridge === "function" ? collectPanelSettingsRuntimeBridge : null,
    "collectPanelSettingsRuntimeBridge"
  );
  const runtime =
    collectRuntime?.({
      panel,
      settings,
      titleEl,
      isLogoPanel,
      state
    }) || {};

  const hasBehaviorInputs = !!(
    runtime.panelShortcutKeyInput ||
    runtime.panelVoiceCommandInput ||
    runtime.cssmvDefaultSectionInput ||
    runtime.cssmvAutoRefreshInput ||
    runtime.languageDefaultModeInput ||
    runtime.languageShowMoreInput ||
    runtime.loginPanelDensityInput ||
    runtime.loginPreferredProviderInput ||
    runtime.loginShowLogoutInput ||
    runtime.loginSessionDaysInput ||
    runtime.profilePanelDensityInput ||
    runtime.profileNoteInput ||
    runtime.profileDefaultNavInput ||
    runtime.worksFocusSectionInput ||
    runtime.worksAutoLoadInput ||
    runtime.worksSearchEnabledInput ||
    runtime.worksSearchLimitInput ||
    runtime.worksDefaultFilterInput ||
    runtime.worksDefaultSortInput ||
    runtime.sellerFocusLaneInput ||
    runtime.sellerAutoRefreshInput ||
    runtime.sellerOrderFilterInput ||
    runtime.sellerLedgerLimitInput ||
    runtime.aboutDefaultTabInput ||
    runtime.aboutDensityInput ||
    runtime.apiBillingModeInput ||
    runtime.apiPaymentMethodDefaultInput ||
    runtime.apiAutoRechargeDefaultInput ||
    runtime.commercePayoutHoldDaysInput ||
    runtime.commercePayoutSweepMinutesInput ||
    runtime.commerceMinTipUsdInput ||
    runtime.foryouHoldInput ||
    runtime.foryouCompactInput ||
    runtime.foryouAutoWatchInput ||
    runtime.foryouSearchEnabledInput ||
    runtime.foryouMarketLimitInput ||
    runtime.foryouDefaultFilterInput ||
    runtime.foryouDefaultSortInput ||
    runtime.watchDefaultTabInput ||
    runtime.watchPreviewLimitInput ||
    runtime.watchSubtitleScaleInput ||
    runtime.watchEngineDetailInput ||
    runtime.lyricsTypeSpeedInput ||
    runtime.lyricsFontScaleInput ||
    runtime.lyricsAutoCollapseInput ||
    runtime.musicWaveformBarsInput ||
    runtime.musicLayerCardsInput ||
    runtime.videoStoryboardFramesInput ||
    runtime.videoCameraSlotsInput ||
    runtime.reportsDefaultKindInput ||
    runtime.reportsFocusSectionInput ||
    runtime.reportsDensityInput ||
    runtime.reportsPreviewExpandedInput ||
    runtime.opsRecoveryLimitInput ||
    runtime.opsFocusLaneInput ||
    runtime.opsAlertDensityInput ||
    runtime.opsAutoRefreshInput
  );

  const bindBehaviorInputs = resolvePanelSettingsFn(
    typeof bindPanelSettingsBehaviorInputsBridge === "function" ? bindPanelSettingsBehaviorInputsBridge : null,
    "bindPanelSettingsBehaviorInputsBridge"
  );
  bindBehaviorInputs?.({
    panel,
    panelShortcutKeyInput: runtime.panelShortcutKeyInput,
    panelVoiceCommandInput: runtime.panelVoiceCommandInput,
    accentInput: runtime.accentInput,
    opacityInput: runtime.opacityInput,
    blurInput: runtime.blurInput,
    widthInput: runtime.widthInput,
    heightInput: runtime.heightInput,
    applyAccent: runtime.applyAccent,
    applyOpacity: runtime.applyOpacity,
    applyBlur: runtime.applyBlur,
    applySize: runtime.applySize,
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
    opsAutoRefreshInput: runtime.opsAutoRefreshInput
  });

  const finishBuild = resolvePanelSettingsFn(
    typeof finishBuildPanelSettingsBridge === "function" ? finishBuildPanelSettingsBridge : null,
    "finishBuildPanelSettingsBridge"
  );
  finishBuild?.({
    panel,
    state,
    settings,
    titleEl,
    titleInput: runtime.titleInput,
    previewModeInput: runtime.previewModeInput,
    accentInput: runtime.accentInput,
    opacityInput: runtime.opacityInput,
    blurInput: runtime.blurInput,
    widthInput: runtime.widthInput,
    heightInput: runtime.heightInput,
    resetButton: runtime.resetButton,
    setDefaultButton: runtime.setDefaultButton,
    buildPanelDefaultSnapshot: runtime.buildPanelDefaultSnapshot,
    applyStoredPanelDefaultSnapshot: runtime.applyStoredPanelDefaultSnapshot,
    refreshBehaviorInputs: runtime.refreshBehaviorInputs,
    syncPanelSettingVisibility,
    applyAccent: runtime.applyAccent,
    applyOpacity: runtime.applyOpacity,
    applyBlur: runtime.applyBlur,
    applySize: runtime.applySize,
    hasBehaviorInputs,
    isLogoPanel,
    isForyouPanel,
    mirrorStrategyInput: runtime.mirrorStrategyInput,
    mirrorAnimationInput: runtime.mirrorAnimationInput,
    mirrorSingleInput: runtime.mirrorSingleInput,
    mirrorTriptychInput: runtime.mirrorTriptychInput,
    mirrorOperaInput: runtime.mirrorOperaInput,
    mirrorImgInput1: runtime.mirrorImgInput1,
    mirrorImgInput2: runtime.mirrorImgInput2,
    mirrorVideoInput: runtime.mirrorVideoInput,
    spellInput: runtime.spellInput,
    mirrorFixedBlock: runtime.mirrorFixedBlock,
    mirrorSingleBlock: runtime.mirrorSingleBlock,
    mirrorTriptychBlock: runtime.mirrorTriptychBlock,
    mirrorOperaBlock: runtime.mirrorOperaBlock,
    logoSubtitleInput: runtime.logoSubtitleInput,
    logoSloganInput: runtime.logoSloganInput,
    logoSizeInput: runtime.logoSizeInput,
    logoMaskInsetInput: runtime.logoMaskInsetInput,
    logoSpellcastRingScaleInput: runtime.logoSpellcastRingScaleInput,
    logoSpellcastGlowScaleInput: runtime.logoSpellcastGlowScaleInput,
    logoSpellcastLayerInput: runtime.logoSpellcastLayerInput,
    logoHoldRingScaleInput: runtime.logoHoldRingScaleInput,
    logoHoldRingLayerInput: runtime.logoHoldRingLayerInput,
    logoAlignGrayRingButton: runtime.logoAlignGrayRingButton,
    logoAlignGrayRingMinimalButton: runtime.logoAlignGrayRingMinimalButton,
    logoSaveRingPresetButton: runtime.logoSaveRingPresetButton,
    logoLoadRingPresetButton: runtime.logoLoadRingPresetButton,
    logoDeleteRingPresetButton: runtime.logoDeleteRingPresetButton,
    logoRingPresetSelect: runtime.logoRingPresetSelect,
    micLongpressInput: runtime.micLongpressInput,
    micMaxHoldInput: runtime.micMaxHoldInput,
    micLogoSurfaceModeInput: runtime.micLogoSurfaceModeInput,
    micDockSurfaceModeInput: runtime.micDockSurfaceModeInput,
    micSettingsSurfaceModeInput: runtime.micSettingsSurfaceModeInput,
    refreshLogoRingReadouts: runtime.refreshLogoRingReadouts,
    buildLogoRingPresetPayload: runtime.buildLogoRingPresetPayload,
    refreshLogoRingPresetActionState: runtime.refreshLogoRingPresetActionState,
    renderLogoRingPresetOptions: runtime.renderLogoRingPresetOptions,
    applyLogoRingPreset: runtime.applyLogoRingPreset,
    initialResetSnapshot: runtime.initialResetSnapshot
  });
}

globalThis.buildPanelSettingsBridge = buildPanelSettingsBridge;
globalThis.buildPanelSettingsContext = globalThis.buildPanelSettingsContext || buildPanelSettingsContext;
globalThis.primePanelSettingsDataset = globalThis.primePanelSettingsDataset || primePanelSettingsDataset;
