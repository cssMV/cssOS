function bindPanelAppearanceControls({
  accentInput,
  opacityInput,
  blurInput,
  widthInput,
  heightInput,
  applyAccent,
  applyOpacity,
  applyBlur,
  applySize
}) {
  const applyAll = () => {
    applyAccent?.();
    applyOpacity?.();
    applyBlur?.();
    applySize?.();
  };
  [accentInput, opacityInput, blurInput, widthInput, heightInput].forEach((input) => {
    if (!(input instanceof HTMLElement)) return;
    input.addEventListener("input", applyAll);
    input.addEventListener("change", applyAll);
  });
  applyAll();
}

function bindPanelSettingsBehaviorInputsBridge({
  panel,
  panelShortcutKeyInput,
  panelVoiceCommandInput,
  accentInput,
  opacityInput,
  blurInput,
  widthInput,
  heightInput,
  applyAccent,
  applyOpacity,
  applyBlur,
  applySize,
  cssmvDefaultSectionInput,
  cssmvAutoRefreshInput,
  languageDefaultModeInput,
  languageShowMoreInput,
  loginPanelDensityInput,
  loginPreferredProviderInput,
  loginShowLogoutInput,
  loginSessionDaysInput,
  profilePanelDensityInput,
  profileNoteInput,
  profileDefaultNavInput,
  worksFocusSectionInput,
  worksAutoLoadInput,
  worksSearchEnabledInput,
  worksSearchLimitInput,
  worksDefaultFilterInput,
  worksDefaultSortInput,
  sellerFocusLaneInput,
  sellerAutoRefreshInput,
  sellerOrderFilterInput,
  sellerLedgerLimitInput,
  aboutDefaultTabInput,
  aboutDensityInput,
  apiBillingModeInput,
  apiPaymentMethodDefaultInput,
  apiAutoRechargeDefaultInput,
  commercePayoutHoldDaysInput,
  commercePayoutSweepMinutesInput,
  commerceMinTipUsdInput,
  foryouHoldInput,
  foryouCompactInput,
  foryouAutoWatchInput,
  foryouSearchEnabledInput,
  foryouMarketLimitInput,
  foryouDefaultFilterInput,
  foryouDefaultSortInput,
  watchDefaultTabInput,
  watchPreviewLimitInput,
  watchSubtitleScaleInput,
  watchEngineDetailInput,
  watchShowGenerationFlowInput,
  watchFlashRingScaleInput,
  lyricsTypeSpeedInput,
  lyricsFontScaleInput,
  lyricsAutoCollapseInput,
  musicWaveformBarsInput,
  musicLayerCardsInput,
  videoStoryboardFramesInput,
  videoCameraSlotsInput,
  reportsDefaultKindInput,
  reportsFocusSectionInput,
  reportsDensityInput,
  reportsPreviewExpandedInput,
  opsRecoveryLimitInput,
  opsFocusLaneInput,
  opsAlertDensityInput,
  opsAutoRefreshInput
}) {
  const bindAppearanceControls = globalThis.bindPanelAppearanceControls || bindPanelAppearanceControls;
  bindAppearanceControls?.({
    accentInput,
    opacityInput,
    blurInput,
    widthInput,
    heightInput,
    applyAccent,
    applyOpacity,
    applyBlur,
    applySize
  });
  panelShortcutKeyInput?.addEventListener("input", () => {
    const entry = globalThis.resolvePanelCommandEntry?.(panel);
    if (!entry?.behaviorKey) return;
    panelShortcutKeyInput.value = String(panelShortcutKeyInput.value || "")
      .trim()
      .slice(0, 1)
      .toLowerCase();
    updatePanelBehaviorSettings((current) => ({
      ...current,
      panel_commands: {
        ...(current.panel_commands || {}),
        [entry.behaviorKey]: {
          ...(current.panel_commands?.[entry.behaviorKey] || {}),
          shortcut_key: panelShortcutKeyInput.value
        }
      }
    }));
  });
  panelVoiceCommandInput?.addEventListener("input", () => {
    const entry = globalThis.resolvePanelCommandEntry?.(panel);
    if (!entry?.behaviorKey) return;
    updatePanelBehaviorSettings((current) => ({
      ...current,
      panel_commands: {
        ...(current.panel_commands || {}),
        [entry.behaviorKey]: {
          ...(current.panel_commands?.[entry.behaviorKey] || {}),
          voice_command: String(panelVoiceCommandInput.value || "").trim().slice(0, 80)
        }
      }
    }));
  });
  cssmvDefaultSectionInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      cssmv: { ...current.cssmv, default_section: cssmvDefaultSectionInput.value || current.cssmv.default_section }
    }));
  });
  cssmvAutoRefreshInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      cssmv: { ...current.cssmv, auto_refresh: !!cssmvAutoRefreshInput.checked }
    }));
  });
  languageDefaultModeInput?.addEventListener("change", () => {
    const nextMode = languageDefaultModeInput.value || "content";
    updatePanelBehaviorSettings((current) => ({
      ...current,
      language: { ...current.language, default_mode: nextMode }
    }));
    globalThis.toggleLanguagePanelMode?.(nextMode);
  });
  languageShowMoreInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      language: { ...current.language, show_more: !!languageShowMoreInput.checked }
    }));
    languageListMore?.classList.toggle("is-hidden", !languageShowMoreInput.checked);
  });
  loginPanelDensityInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      login: { ...current.login, panel_density: loginPanelDensityInput.value || current.login.panel_density }
    }));
  });
  loginPreferredProviderInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      login: { ...current.login, preferred_provider: loginPreferredProviderInput.value || current.login.preferred_provider }
    }));
  });
  loginShowLogoutInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      login: { ...current.login, show_logout: !!loginShowLogoutInput.checked }
    }));
  });
  loginSessionDaysInput?.addEventListener("change", () => {
    const nextDays = Number(loginSessionDaysInput.value || 90);
    updatePanelBehaviorSettings((current) => ({
      ...current,
      login: { ...current.login, session_days: nextDays || current.login.session_days }
    }));
    if (authState.user) void updateSessionPolicy(nextDays);
  });
  profilePanelDensityInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      profile: { ...current.profile, panel_density: profilePanelDensityInput.value || current.profile.panel_density }
    }));
  });
  profileNoteInput?.addEventListener("input", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      profile: { ...current.profile, note: String(profileNoteInput.value || "").slice(0, 120) }
    }));
  });
  profileDefaultNavInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      profile: { ...current.profile, default_nav: profileDefaultNavInput.value || current.profile.default_nav }
    }));
  });
  worksFocusSectionInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      works: { ...current.works, focus_section: worksFocusSectionInput.value || current.works.focus_section }
    }));
    worksPanel.dataset.focusSection = worksFocusSectionInput.value || "works";
  });
  worksAutoLoadInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      works: { ...current.works, auto_load: !!worksAutoLoadInput.checked }
    }));
  });
  worksSearchEnabledInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      works: { ...current.works, search_enabled: !!worksSearchEnabledInput.checked }
    }));
    globalThis.renderWorksPanelModule?.();
  });
  worksSearchLimitInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      works: { ...current.works, search_limit: Number(worksSearchLimitInput.value || current.works.search_limit) }
    }));
    void globalThis.loadMyWorksModule?.();
  });
  worksDefaultFilterInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      works: { ...current.works, default_filter: worksDefaultFilterInput.value || current.works.default_filter }
    }));
    void globalThis.loadMyWorksModule?.();
  });
  worksDefaultSortInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      works: { ...current.works, default_sort: worksDefaultSortInput.value || current.works.default_sort }
    }));
    void globalThis.loadMyWorksModule?.();
  });
  sellerFocusLaneInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      seller: { ...current.seller, focus_lane: sellerFocusLaneInput.value || current.seller.focus_lane }
    }));
    sellerPanel.dataset.focusLane = sellerFocusLaneInput.value || "orders";
  });
  sellerAutoRefreshInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      seller: { ...current.seller, auto_refresh: !!sellerAutoRefreshInput.checked }
    }));
  });
  sellerOrderFilterInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      seller: { ...current.seller, order_filter: sellerOrderFilterInput.value || current.seller.order_filter }
    }));
    renderSellerPanel();
  });
  sellerLedgerLimitInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      seller: { ...current.seller, ledger_limit: Number(sellerLedgerLimitInput.value || current.seller.ledger_limit) }
    }));
    renderSellerPanel();
  });
  aboutDefaultTabInput?.addEventListener("change", () => {
    const nextTab = aboutDefaultTabInput.value || "whitepaper";
    updatePanelBehaviorSettings((current) => ({
      ...current,
      about: { ...current.about, default_tab: nextTab }
    }));
    globalThis.activateAboutTabModule?.(nextTab);
  });
  aboutDensityInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      about: { ...current.about, density: aboutDensityInput.value || current.about.density }
    }));
  });
  apiBillingModeInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      api: { ...current.api, billing_mode: apiBillingModeInput.value || current.api.billing_mode }
    }));
  });
  apiPaymentMethodDefaultInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      api: { ...current.api, payment_method: apiPaymentMethodDefaultInput.value || current.api.payment_method }
    }));
  });
  apiAutoRechargeDefaultInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      api: { ...current.api, auto_recharge: !!apiAutoRechargeDefaultInput.checked }
    }));
  });
  commercePayoutHoldDaysInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      commerce: {
        ...current.commerce,
        payout_hold_days: Number(commercePayoutHoldDaysInput.value || current.commerce.payout_hold_days)
      }
    }));
  });
  commercePayoutSweepMinutesInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      commerce: {
        ...current.commerce,
        payout_sweep_ms: Number(commercePayoutSweepMinutesInput.value || Math.round(current.commerce.payout_sweep_ms / 60000)) * 60000
      }
    }));
  });
  commerceMinTipUsdInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      commerce: {
        ...current.commerce,
        min_tip_cents: Number(commerceMinTipUsdInput.value || Math.round(current.commerce.min_tip_cents / 100)) * 100
      }
    }));
  });
  foryouHoldInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      foryou: { ...current.foryou, hold_ms: Number(foryouHoldInput.value || current.foryou.hold_ms) }
    }));
  });
  foryouCompactInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      foryou: { ...current.foryou, compact_after_lyrics: !!foryouCompactInput.checked }
    }));
  });
  foryouAutoWatchInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      foryou: { ...current.foryou, auto_watch_ms: Number(foryouAutoWatchInput.value || current.foryou.auto_watch_ms) }
    }));
  });
  foryouSearchEnabledInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      foryou: { ...current.foryou, search_enabled: !!foryouSearchEnabledInput.checked }
    }));
    renderForyouMarketplace();
  });
  foryouMarketLimitInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      foryou: { ...current.foryou, market_limit: Number(foryouMarketLimitInput.value || current.foryou.market_limit) }
    }));
    renderForyouMarketplace();
  });
  foryouDefaultFilterInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      foryou: { ...current.foryou, default_filter: foryouDefaultFilterInput.value || current.foryou.default_filter }
    }));
    renderForyouMarketplace();
  });
  foryouDefaultSortInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      foryou: { ...current.foryou, default_sort: foryouDefaultSortInput.value || current.foryou.default_sort }
    }));
    renderForyouMarketplace();
  });
  watchDefaultTabInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      watch: { ...current.watch, default_tab: watchDefaultTabInput.value || current.watch.default_tab }
    }));
  });
  watchPreviewLimitInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      watch: { ...current.watch, preview_limit_sec: Number(watchPreviewLimitInput.value || current.watch.preview_limit_sec) }
    }));
  });
  watchSubtitleScaleInput?.addEventListener("input", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      watch: { ...current.watch, subtitle_scale: Number(watchSubtitleScaleInput.value || current.watch.subtitle_scale) }
    }));
  });
  watchEngineDetailInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      watch: { ...current.watch, engine_detail: watchEngineDetailInput.value || current.watch.engine_detail }
    }));
  });
  watchShowGenerationFlowInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      watch: { ...current.watch, show_generation_flow: !!watchShowGenerationFlowInput.checked }
    }));
  });
  watchFlashRingScaleInput?.addEventListener("input", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      watch: { ...current.watch, flash_ring_scale: Number(watchFlashRingScaleInput.value || current.watch.flash_ring_scale) }
    }));
  });
  lyricsTypeSpeedInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      lyrics: { ...current.lyrics, typewriter_speed: Number(lyricsTypeSpeedInput.value || current.lyrics.typewriter_speed) }
    }));
  });
  lyricsFontScaleInput?.addEventListener("input", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      lyrics: { ...current.lyrics, font_scale: Number(lyricsFontScaleInput.value || current.lyrics.font_scale) }
    }));
  });
  lyricsAutoCollapseInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      lyrics: { ...current.lyrics, auto_collapse: !!lyricsAutoCollapseInput.checked }
    }));
  });
  musicWaveformBarsInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      music: { ...current.music, waveform_bars: Number(musicWaveformBarsInput.value || current.music.waveform_bars) }
    }));
  });
  musicLayerCardsInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      music: { ...current.music, layer_cards: Number(musicLayerCardsInput.value || current.music.layer_cards) }
    }));
  });
  videoStoryboardFramesInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      video: { ...current.video, storyboard_frames: Number(videoStoryboardFramesInput.value || current.video.storyboard_frames) }
    }));
  });
  videoCameraSlotsInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      video: { ...current.video, camera_slots: Number(videoCameraSlotsInput.value || current.video.camera_slots) }
    }));
  });
  reportsDefaultKindInput?.addEventListener("change", () => {
    const nextKind = reportsDefaultKindInput.value || deliveryReportState.kind;
    updatePanelBehaviorSettings((current) => ({
      ...current,
      delivery_reports: { ...current.delivery_reports, default_kind: nextKind }
    }));
    deliveryReportState.kind = nextKind;
    renderDeliveryReportTabs();
    void loadDeliveryReport(nextKind, true);
  });
  reportsFocusSectionInput?.addEventListener("change", () => {
    const nextSection = reportsFocusSectionInput.value || "overview";
    updatePanelBehaviorSettings((current) => ({
      ...current,
      delivery_reports: { ...current.delivery_reports, focus_section: nextSection }
    }));
    deliveryReportsPanel.dataset.focusSection = nextSection;
  });
  reportsDensityInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      delivery_reports: { ...current.delivery_reports, density: reportsDensityInput.value || current.delivery_reports.density }
    }));
  });
  reportsPreviewExpandedInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      delivery_reports: { ...current.delivery_reports, preview_expanded: !!reportsPreviewExpandedInput.checked }
    }));
    deliveryExportState.previewExpanded = !!reportsPreviewExpandedInput.checked;
    if (deliveryReportState.response) renderDeliveryReportBody(deliveryReportState.response);
  });
  opsRecoveryLimitInput?.addEventListener("change", () => {
    const nextLimit = Number(opsRecoveryLimitInput.value || deliveryOpsState.recoveryLimit || 8);
    updatePanelBehaviorSettings((current) => ({
      ...current,
      delivery_ops: { ...current.delivery_ops, recovery_limit: nextLimit }
    }));
    deliveryOpsState.recoveryLimit = nextLimit;
  });
  opsFocusLaneInput?.addEventListener("change", () => {
    const nextLane = opsFocusLaneInput.value || "overview";
    updatePanelBehaviorSettings((current) => ({
      ...current,
      delivery_ops: { ...current.delivery_ops, focus_lane: nextLane }
    }));
    deliveryOpsPanel.dataset.focusLane = nextLane;
  });
  opsAlertDensityInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      delivery_ops: { ...current.delivery_ops, alert_density: opsAlertDensityInput.value || current.delivery_ops.alert_density }
    }));
  });
  opsAutoRefreshInput?.addEventListener("change", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      delivery_ops: { ...current.delivery_ops, auto_refresh: !!opsAutoRefreshInput.checked }
    }));
  });
}

globalThis.bindPanelAppearanceControls = globalThis.bindPanelAppearanceControls || bindPanelAppearanceControls;
globalThis.bindPanelSettingsBehaviorInputsBridge = bindPanelSettingsBehaviorInputsBridge;
