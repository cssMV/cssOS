// CSSOS_PHASE2_CONSOLE_SILENCER 20260501 #252 — Jing
// "等稳定后，我不希望控制台里再看见除了宣传的广告logo之外，任何其他信息..."
//
// Production-default: silence ALL console output except the brand banner
// below. Toggle via DevTools:
//   cssDebug()    — enable verbose console
//   cssSilent()   — re-enable silencer
// Persisted to localStorage; default = silent.
(function cssosConsoleSilencer() {
  if (globalThis.__cssosConsoleWrapped) return;
  globalThis.__cssosConsoleWrapped = true;
  try {
    const STORAGE_KEY = "cssos.console.verbose";
    const isVerbose = () => {
      try { return localStorage.getItem(STORAGE_KEY) === "1"; }
      catch (_e) { return false; }
    };
    const noop = () => {};
    const orig = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
      table: console.table ? console.table.bind(console) : console.log.bind(console),
      group: console.group ? console.group.bind(console) : console.log.bind(console),
      groupEnd: console.groupEnd ? console.groupEnd.bind(console) : noop,
      trace: console.trace ? console.trace.bind(console) : console.log.bind(console),
    };
    globalThis.__cssosConsoleOrig = orig;
    const wrap = (key) => function () {
      // If the FIRST argument is the banner marker, let it through
      // even when silenced. Other production noise gets dropped.
      if (arguments[0] === "__CSSOS_BANNER__") {
        const args = Array.prototype.slice.call(arguments, 1);
        return orig[key].apply(console, args);
      }
      if (isVerbose()) return orig[key].apply(console, arguments);
      // Silent default — drop the call.
    };
    console.log = wrap("log");
    console.info = wrap("info");
    console.warn = wrap("warn");
    console.error = wrap("error");
    console.debug = wrap("debug");
    console.table = wrap("table");
    console.trace = wrap("trace");
    // Public toggles.
    globalThis.cssDebug = function () {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (_e) {}
      orig.log("%c[cssOS] verbose console enabled — reload to see early init logs.",
        "color:#00f5a0; font-weight:bold;");
    };
    globalThis.cssSilent = function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_e) {}
      orig.log("%c[cssOS] silent console enabled. Type cssDebug() to re-enable.",
        "color:#79e6ff; font-weight:bold;");
    };
  } catch (_e) { /* console wrapping best-effort — leave intact */ }
})();

// CSSOS_PHASE2_CONSOLE_BANNER 20260430 #205 — Jing
// Brand banner shown once in DevTools console when cssstudio.app loads.
// Bypasses the silencer above via the __CSSOS_BANNER__ marker.
(function cssosConsoleBanner() {
  if (globalThis.__cssosBannerShown) return;
  globalThis.__cssosBannerShown = true;
  try {
    const banner = [
      "",
      "  ██████╗███████╗███████╗    ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗ ",
      " ██╔════╝██╔════╝██╔════╝    ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗",
      " ██║     ███████╗███████╗    ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║",
      " ██║     ╚════██║╚════██║    ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║",
      " ╚██████╗███████║███████║    ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝",
      "  ╚═════╝╚══════╝╚══════╝    ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ ",
      "",
      "    ✦ Just say CSS, witness the miracle ✦",
      "",
    ].join("\n");
    // Magic marker as first arg lets the silencer pass this through.
    console.log(
      "__CSSOS_BANNER__",
      "%c" + banner,
      "color:#00f5a0; font-family: ui-monospace, 'SF Mono', Menlo, monospace; " +
        "font-size: 12px; line-height: 1.15; text-shadow: 0 0 6px rgba(0,245,160,0.35);"
    );
  } catch (_e) { /* console may be locked down — non-fatal */ }
})();

const bootT =
  typeof globalThis.t === "function"
    ? globalThis.t.bind(globalThis)
    : (key) => String(key || "");
const bootLoginCopy =
  typeof globalThis.loginCopy === "function"
    ? globalThis.loginCopy.bind(globalThis)
    : (en, zh) => {
        const locale = String(globalThis.currentLocale || navigator.language || "en").toLowerCase();
        return locale.startsWith("zh") ? (zh || en || "") : (en || zh || "");
      };
const bootTranslate = bootT;
const bootLoginCopyAlias = bootLoginCopy;
const applySettingsButton = globalThis.applySettings || document.getElementById("apply-settings");
const bootSeedTabButtons = globalThis.seedTabButtons || document.querySelectorAll("[data-seed-tab]");
const bootLyricsInputTabButtons =
  globalThis.lyricsInputTabButtons || document.querySelectorAll("[data-lyrics-input-tab]");
const bootWatchTabButtons = globalThis.watchTabButtons || document.querySelectorAll("[data-watch-tab]");
const bootLyricsMusicUploadTabRoot =
  document.getElementById("lyrics-music-upload-tab-root");
const bootForyouTitle = document.getElementById("foryou-title");
const bootForyouThumbImage = document.getElementById("foryou-thumb-image");
const bootForyouThumbVideo =
  document.getElementById("foryou-thumb-video");
const bootForyouThumbFallback = document.getElementById("foryou-thumb-fallback");
const bootWatchOverlayPlay = document.getElementById("watch-overlay-play");

globalThis.watchLyricsMusicStyle ??= document.getElementById("watch-lyrics-music-style");
globalThis.watchLyricsWikiSource ??= document.getElementById("watch-lyrics-wiki-source");
if (!globalThis.attachPanelActions && globalThis.attachPanelActionsModule) {
  globalThis.attachPanelActions = globalThis.attachPanelActionsModule;
}
if (!globalThis.initPanelSettings && globalThis.initPanelSettingsModule) {
  globalThis.initPanelSettings = globalThis.initPanelSettingsModule;
}
if (!globalThis.resolveCreationDurationValue && globalThis.resolveCreationDurationValueModule) {
  globalThis.resolveCreationDurationValue = globalThis.resolveCreationDurationValueModule;
}

globalThis.micLogoSurfaceModeInput ??= null;
globalThis.micDockSurfaceModeInput ??= null;
globalThis.micSettingsSurfaceModeInput ??= null;
globalThis.buildForyouThumbSvg ??= (...args) =>
  globalThis.buildForyouThumbSvgModule?.(...args) || "";

const bootActivateSeedTab = (tab) => globalThis.activateSeedTab?.(tab);
const bootActivateLyricsInputTab = (tab) => globalThis.activateLyricsInputTab?.(tab);
const bootActivateWatchTab = (tab) => globalThis.activateWatchTab?.(tab);

if (globalThis.applySettings) {
  globalThis.applySettings.addEventListener("click", async () => {
    await globalThis.invokeUniversalCreationEntry?.({
      origin: "settings",
      preferredTab: "mv"
    });
  });
}

bootSeedTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => bootActivateSeedTab(btn.dataset.seedTab));
});
bootActivateSeedTab("outline");
bootLyricsInputTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => bootActivateLyricsInputTab(btn.dataset.lyricsInputTab));
});
bootActivateLyricsInputTab("editor");
if (bootLyricsMusicUploadTabRoot) {
  globalThis.mountMusicSourceUploadTabInSettings?.(bootLyricsMusicUploadTabRoot);
}
document.querySelectorAll("[data-scroll-peek]").forEach((scroller) => {
  scroller.addEventListener("scroll", () => callCreationFlowModule("syncScrollPeekModule", scroller), { passive: true });
  callCreationFlowModule("syncScrollPeekModule", scroller);
});
bootWatchTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => bootActivateWatchTab(btn.dataset.watchTab));
});
bootActivateWatchTab(globalThis.watchActiveTab || "mv");
globalThis.initWatchImmersiveScrollModule?.();

bootForyouTitle?.addEventListener("click", () => {
  toggleForyouLyricsExpanded();
});
bootForyouThumbImage?.addEventListener("click", () => {
  toggleForyouLyricsExpanded();
});
bootForyouThumbVideo?.addEventListener("click", () => {
  toggleForyouLyricsExpanded();
});
bootForyouThumbFallback?.addEventListener("click", () => {
  toggleForyouLyricsExpanded();
});

watchLyricsEditor?.addEventListener("input", () => {
  const nextValue = String(watchLyricsEditor.value || "");
  if (lyricsInput && nextValue.trim()) lyricsInput.value = nextValue;
});

watchOutlineEditor?.addEventListener("input", () => {
  const nextValue = String(watchOutlineEditor.value || "");
  if (videoOutlineInput && nextValue.trim()) videoOutlineInput.value = nextValue;
});

watchScriptEditor?.addEventListener("input", () => {
  const nextValue = String(watchScriptEditor.value || "");
  if (sectionPromptsInput && nextValue.trim()) sectionPromptsInput.value = nextValue;
});

if (randomPaletteButton) {
  randomPaletteButton.addEventListener("click", randomizePalette);
}
if (advancedPanelSettingsToggle && advancedPanelSettings) {
  advancedPanelSettings.hidden = true;
  advancedPanelSettingsToggle.addEventListener("click", () => {
    advancedPanelSettings.hidden = !advancedPanelSettings.hidden;
    advancedPanelSettingsToggle.classList.toggle("is-active", !advancedPanelSettings.hidden);
    if (!advancedPanelSettings.hidden) {
      void renderAdvancedPanelSettings({ force: true, deferHeavy: true });
    }
  });
  advancedPanelSettingsToggle.classList.toggle("is-active", !advancedPanelSettings.hidden);
}
palettePresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const preset = button.getAttribute("data-palette-preset");
    if (!preset) return;
    applyPalettePreset(preset);
  });
});
if (enterWatchButton) {
  enterWatchButton.addEventListener("click", async () => {
    await globalThis.invokeUniversalCreationEntry?.({
      origin: "logo",
      preferredTab: "mv"
    });
  });
}

if (listenButton) {
  listenButton.addEventListener("click", async () => {
    await globalThis.invokeUniversalCreationEntry?.({
      origin: "logo",
      preferredTab: "music"
    });
  });
}

if (watchButton) {
  watchButton.addEventListener("click", async () => {
    await globalThis.invokeUniversalCreationEntry?.({
      origin: "logo",
      preferredTab: "mv"
    });
  });
}

if (bootWatchOverlayPlay) {
  bootWatchOverlayPlay.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    armWatchExplicitPreviewIntent?.();
    if (typeof globalThis.handleWatchPlaybackSurfaceClickModule === "function") {
      await globalThis.handleWatchPlaybackSurfaceClickModule();
      return;
    }
    await openWatchPreviewFlow({ preferredTab: "mv", tryRegistry: true, allowDemoFallback: false });
  });
}

globalThis.initWatchVideoPlaybackControlsModule?.();
globalThis.initWatchMusicControlsModule?.();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    globalThis.syncNotificationBadgeModule?.();
  }
});
globalThis.watchMusicArtBlur?.addEventListener("change", () => globalThis.syncWatchMusicArtworkBlurModule?.());
globalThis.watchCommentForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  globalThis.submitWatchCommentModule?.();
});

if (styleInput) {
  styleInput.addEventListener("change", () => updateEnginePanels(state.title, state.lines));
}

if (voiceInput) {
  voiceInput.addEventListener("change", () => {
    markCreationFieldTouched("vocalGender");
    updateEnginePanels(state.title, state.lines);
  });
}

lyricsInput?.addEventListener("input", () => globalThis.syncWatchEditorsFromSettingsModule?.());
videoOutlineInput?.addEventListener("input", () => globalThis.syncWatchEditorsFromSettingsModule?.());
sectionPromptsInput?.addEventListener("input", () => globalThis.syncWatchEditorsFromSettingsModule?.());
watchLyricsEditor?.addEventListener("input", () =>
  updateEnginePanels(
    titleInput?.value?.trim() || state.title,
    String(watchLyricsEditor.value || "").trim()
      ? watchLyricsEditor.value.split("\n")
      : state.lines
  )
);
watchOutlineEditor?.addEventListener("input", () =>
  updateEnginePanels(titleInput?.value?.trim() || state.title, state.lines)
);
watchScriptEditor?.addEventListener("input", () =>
  updateEnginePanels(titleInput?.value?.trim() || state.title, state.lines)
);

bgColorInputs.forEach((input) => {
  if (!input) return;
  input.addEventListener("input", applyBackgroundPalette);
});

["mousemove", "keydown", "touchstart"].forEach((eventName) => {
  window.addEventListener(eventName, resetInactivityTimer, { passive: true });
});

const currentBootRecState = () => (window.__cssosRec || { started: false, stream: null, mr: null, chunks: [] });

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  emergencyUnfreezeUi({ preserveHoldState: !!currentBootRecState()?.started });
});

window.addEventListener("blur", () => {
  if (!currentBootRecState()?.started) {
    document.body.classList.remove("longpress-guard");
  }
});

emergencyUnfreezeUi();

const resolveBootUiFn = (preferred, legacy) => {
  const preferredFn = typeof window !== "undefined" ? window[`__cssos${preferred}`] : null;
  if (typeof preferredFn === "function") return preferredFn;
  const legacyFn = typeof window !== "undefined" ? window[legacy] : null;
  if (typeof legacyFn === "function") return legacyFn;
  return null;
};

const runBootUiFn = (preferred, legacy, ...args) => {
  const fn = resolveBootUiFn(preferred, legacy);
  if (typeof fn !== "function") return undefined;
  return fn(...args);
};

const runBootUiMethod = (preferred, legacy, ...args) => {
  const fn = resolveBootUiFn(preferred, legacy);
  if (typeof fn !== "function") return Promise.resolve(undefined);
  try {
    return Promise.resolve(fn(...args));
  } catch (error) {
    return Promise.reject(error);
  }
};

const safeInit = (name, fn) => {
  try {
    fn();
  } catch (err) {
    console.error(`[init] ${name} failed`, err);
  }
};

let bootUserInteracted = false;
const markBootUserInteraction = () => {
  bootUserInteracted = true;
};
window.addEventListener("pointerdown", markBootUserInteraction, { passive: true, once: true });
window.addEventListener("keydown", markBootUserInteraction, { passive: true, once: true });

const hideWatchPanelByDefault = () => {
  if (
    !watchPanel ||
    currentWatchPreviewWork ||
    bootUserInteracted ||
    globalThis.isCreationBusyModule?.() ||
    String(globalThis.currentCreationSurfaceOrigin || "").trim()
  ) {
    return;
  }
  watchPanel.classList.add("hidden");
  watchPanel.dataset.minimized = "true";
  if (typeof setWatchCenterStage === "function") {
    setWatchCenterStage(false);
  }
};

hideWatchPanelByDefault();

const runBootInitQueue = (entries) => {
  let index = 0;
  if (typeof window !== "undefined") {
    window.__cssosBootQueueDone = false;
    window.__cssosBootQueueIndex = 0;
  }
  const runChunk = () => {
    const start = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    while (index < entries.length) {
      const entry = entries[index];
      index += 1;
      if (typeof window !== "undefined") {
        window.__cssosBootQueueIndex = index;
      }
      safeInit(entry.name, entry.fn);
      const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
      if (now - start > 8) break;
    }
    if (index < entries.length) {
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(runChunk);
      } else {
        setTimeout(runChunk, 16);
      }
    } else if (typeof window !== "undefined") {
      hideWatchPanelByDefault();
      [120, 480, 1200].forEach((delay) => {
        window.setTimeout(hideWatchPanelByDefault, delay);
      });
      window.__cssosBootQueueDone = true;
    }
  };
  runChunk();
};

const scheduleNonCriticalBoot = (fn, timeout = 180) => {
  if (typeof fn !== "function") return;
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => fn(), { timeout });
    return;
  }
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => window.setTimeout(fn, 0));
    return;
  }
  setTimeout(fn, 0);
};

[
  { name: "resetInactivityTimer", fn: () => resetInactivityTimer() },
  { name: "initPanelStack", fn: () => initPanelStack() },
  { name: "restoreDockOrder", fn: () => restoreDockOrder() },
  { name: "updateDockVisibility", fn: () => updateDockVisibility() },
  { name: "applySpell", fn: () => applySpell(state.spell, { force: true, refreshPanels: false }) },
  { name: "updateEnginePanels", fn: () => updateEnginePanels(state.title, state.lines) },
  { name: "applyBackgroundPalette", fn: () => applyBackgroundPalette() }
].forEach((entry) => safeInit(entry.name, entry.fn));

scheduleNonCriticalBoot(() => {
  [
    { name: "normalizeStaticMediaAssets", fn: () => normalizeStaticMediaAssets() },
    { name: "attachDockEvents", fn: () => attachDockEvents() },
    { name: "attachGlobalActionDispatcher", fn: () => attachGlobalActionDispatcher() },
    { name: "bindHoldTargets", fn: () => runBootUiFn("BindHoldTargets", "bindHoldTargets") },
    { name: "attachPanelBarActions", fn: () => attachPanelBarActions() },
    { name: "attachPanelFocus", fn: () => attachPanelFocus() }
  ].forEach((entry) => safeInit(entry.name, entry.fn));

  runBootInitQueue([
    { name: "attachDockReorder", fn: () => attachDockReorder() },
    { name: "attachDockDocking", fn: () => attachDockDocking() },
    { name: "attachPanelDrag", fn: () => attachPanelDrag() },
    { name: "attachResize", fn: () => attachResize() },
    { name: "attachPanelActions", fn: () => globalThis.attachPanelActions?.() },
    { name: "attachLogoPanelActions", fn: () => attachLogoPanelActions() },
    { name: "renderMicCaptureStatus", fn: () => runBootUiFn("RenderMicCaptureStatus", "renderMicCaptureStatus") },
    { name: "initPanelSettings", fn: () => globalThis.initPanelSettings?.() },
    {
      name: "initMirrorAnimationMode",
      fn: () => {
        const strategy = setStoredMirrorAnimationStrategy(getStoredMirrorAnimationStrategy());
        const mode = setStoredMirrorAnimationMode(getStoredMirrorAnimationMode());
        setStoredMirrorAnimationPerType(getStoredMirrorAnimationPerType());
        if (logoPanel) logoPanel.dataset.mirrorAnimationStrategy = strategy;
        applyMirrorAnimationMode(mode);
      }
    },
    { name: "initEngineControls", fn: () => initEngineControls() },
    { name: "initLyricsControls", fn: () => initLyricsControls() },
    { name: "initLanguagePanel", fn: () => globalThis.initLanguagePanelModule?.() },
    { name: "initAboutTabs", fn: () => globalThis.initAboutTabsModule?.() },
    { name: "renderApiBillingPanel", fn: () => renderApiBillingPanel() },
    { name: "fetchMe", fn: () => fetchMe() },
    { name: "handleStripeCheckoutReturn", fn: () => handleStripeCheckoutReturn() },
    { name: "loadCreationPanelDefaults", fn: () => loadCreationPanelDefaults() },
    { name: "fetchAuthProviders", fn: () => fetchAuthProviders() },
    { name: "fetchBillingStatus", fn: () => fetchBillingStatus() },
    { name: "initVersionSwitcher", fn: () => initVersionSwitcher() },
    { name: "restoreMusicDeliveryDashboardRunId", fn: () => restoreMusicDeliveryDashboardRunId() },
    { name: "renderMusicDeliveryDashboard", fn: () => renderMusicDeliveryDashboard() },
    { name: "initCreationConsole", fn: () => initCreationConsole() },
    { name: "renderAdvancedPanelSettings", fn: () => renderAdvancedPanelSettings() },
    // CSSOS_WAVE_250 20260520 — Jing: 进主界面自动打开 MV 面板连播
    // for-you 混合队列. 延迟 1.5s 等 fetchMe 解析完(知道登录/Guest),
    // 函数内部再判深链接, 有深链则不抢.
    {
      name: "autoOpenWatchFeed",
      fn: () => setTimeout(() => { try { globalThis.cssosAutoOpenWatchFeed?.(); } catch (_e) {} }, 1500),
    }
  ]);
});
if (loginLogout) {
  loginLogout.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (_err) {
      // ignore
    }
    authState.user = null;
    authState.role = DEFAULT_ROLE;
    authState.tier = DEFAULT_ROLE;
    authState.linkedProviders = [];
    watchCommerceState.loaded = false;
    watchCommerceState.loading = false;
    watchCommerceState.payload = null;
    watchCommerceState.error = null;
    authState.loginProvider = null;
    updateLoginUI();
    renderLoginPlatforms();
    renderWorksPanel();
    renderApiBillingPanel();
    await renderAdvancedPanelSettings();
    fetchBillingStatus();
  });
}
if (loginList) {
  loginList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest(".login-unlink-btn");
    if (!(btn instanceof HTMLButtonElement)) return;
    if (!isLoggedInUser()) return;
    event.preventDefault();
    event.stopPropagation();
    const provider = btn.dataset.provider || "";
    btn.disabled = true;
    await unlinkProvider(provider);
    btn.disabled = false;
  });
}
attachAmbientTrail();
if (deliveryDashboardRefresh) {
  deliveryDashboardRefresh.addEventListener("click", () => {
    const runId = deliveryDashboardRunId?.value || deliveryDashboardState.runId;
    void loadMusicDeliveryDashboard(runId, true);
  });
}
if (deliveryDashboardRunId) {
  deliveryDashboardRunId.addEventListener("change", () => {
    const runId = deliveryDashboardRunId.value || "";
    deliveryDashboardState.runId = String(runId).trim();
    persistMusicDeliveryDashboardRunId(deliveryDashboardState.runId);
    void loadMusicDeliveryDashboard(deliveryDashboardState.runId, true);
  });
}
window.addEventListener("cssos:run_created", (event) => {
  const runId = extractRunId(event?.detail);
  if (!runId) return;
  deliveryDashboardState.runId = runId;
  persistMusicDeliveryDashboardRunId(runId);
  renderMusicDeliveryDashboard();
  void loadMusicDeliveryDashboard(runId, true);
});
window.addEventListener("cssos:mic", async (event) => {
  // CSSOS_PHASE2_KILL_LEGACY_MIC 20260504 — Jing
  // Previously this listener consulted runBootUiFn("HandleMicClick", ...)
  // first and short-circuited if a handler was registered. The legacy
  // app.voice-seed.js still registers `window.handleMicClick` which
  // calls `startCreation()` directly — that's the brown-stick-figure /
  // scary-fallback path that the user has been complaining about for
  // weeks. Because runBootUiFn returned the legacy handler's Promise as
  // a truthy "handled" flag, the universal-entry fallback below NEVER
  // ran. Skip the legacy probe entirely; let the universal entry own
  // every voice-channel tap. Switched preferredTab to "mv" so the MV
  // Pipeline actually triggers (was "music" which would have skipped
  // the pipeline before today's #207d fix).
  if (globalThis.isCreationBusyModule?.()) {
    showCreationSurface(String(event?.detail?.origin || "logo"));
    globalThis.activateWatchTab?.("mv");
    globalThis.openWatchPreviewFlowModule?.({ preferredTab: "mv", clearLimit: false, allowDemoFallback: false });
    showToast(t("watch.toast.creationBusy"));
    return;
  }
  await globalThis.invokeUniversalCreationEntry?.({
    origin: String(event?.detail?.origin || "logo"),
    preferredTab: "mv",
    submitVoiceFallback: true
  });
});
window.addEventListener("cssos:mic_hold_start", async () => {
  try {
    await runBootUiMethod("StartRecording", "startRecording");
  } catch (e) {
    stopLogoMicPulse();
    const raw = String(e || "");
    const msg =
      /NotAllowedError|Permission denied/i.test(raw)
        ? t("mic.permissionDenied")
        : /Requested device not found|NotFoundError/i.test(raw)
          ? t("mic.noDevice")
          : `${window.t ? window.t("mic.submit_failed") : "Submit failed"}: ${raw}`;
    setMicCaptureStatus(
      /NotAllowedError|Permission denied/i.test(raw) ? "permission_denied" : "error",
      /NotAllowedError|Permission denied/i.test(raw)
        ? loginCopy("Microphone permission denied")
        : /Requested device not found|NotFoundError/i.test(raw)
          ? loginCopy("No microphone detected")
          : loginCopy("Microphone start failed"),
      msg
    );
    showToast(msg);
  }
});
window.addEventListener("cssos:mic_hold_commit", async (event) => {
  try {
    if (globalThis.isCreationBusyModule?.()) {
      showCreationSurface(String(event?.detail?.origin || "logo"));
      globalThis.activateWatchTab?.("music");
      globalThis.openWatchPreviewFlowModule?.({ preferredTab: "music", clearLimit: false, allowDemoFallback: false });
      showToast(t("watch.toast.creationBusy"));
      return;
    }
    const elapsedMs = Number(event?.detail?.elapsed_ms || 0);
    micState.lastCaptureMs = Math.max(0, elapsedMs);
    if (elapsedMs > 0 && elapsedMs < LONGPRESS_MS) {
      return;
    }
    showCreationSurface(String(event?.detail?.origin || "logo"));
    const blob = await runBootUiMethod("StopRecordingGetBlob", "stopRecordingGetBlob").catch(() => null);
    // CSSOS_PHASE2_LONGPRESS_KILL_LEGACY 20260504 — Jing
    // "长按还在走旧流程，请修复". The boot bridge `runBootUiMethod` resolves
    // SubmitVoiceOrFallbackTitle to the legacy app.voice-seed.js function
    // first, which goes straight to startCreation() (the brown-stick-figure
    // path). Prefer the MV-Pipeline-aware `submitVoiceOrFallbackTitleModule`
    // (registered by app.voice-submit.js) which routes through
    // openMvPipelinePanel({autoStart:true}).
    if (typeof globalThis.submitVoiceOrFallbackTitleModule === "function") {
      console.info("%c[entry:logo-longpress] → submitVoiceOrFallbackTitleModule", "color:#08f;font-weight:bold");
      await globalThis.submitVoiceOrFallbackTitleModule(blob);
    } else {
      await runBootUiMethod("SubmitVoiceOrFallbackTitle", "submitVoiceOrFallbackTitle", blob);
    }
  } catch (e) {
    stopLogoMicPulse();
    const raw = String(e || "");
    const msg =
      /NotAllowedError|Permission denied/i.test(raw)
        ? t("mic.permissionDenied")
        : /Requested device not found|NotFoundError/i.test(raw)
          ? t("mic.noDevice")
          : `${window.t ? window.t("mic.submit_failed") : "Submit failed"}: ${raw}`;
    showToast(msg);
  } finally {
    runBootUiFn("ForceResetHoldRing", "forceResetHoldRing");
  }
});

window.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    runBootUiFn("ForceResetHoldRing", "forceResetHoldRing");
    const setLongpressGuardFn = resolveBootUiFn("SetLongpressGuard", "setLongpressGuard");
    if (typeof setLongpressGuardFn === "function") {
      setLongpressGuardFn(false);
    } else {
      document.body.classList.remove("longpress-guard");
    }
    if (deliveryDashboardPollTimer) {
      clearInterval(deliveryDashboardPollTimer);
      deliveryDashboardPollTimer = 0;
    }
  } else {
    ensureMusicDeliveryDashboardPolling();
  }
});
window.addEventListener("blur", () => {
  const setLongpressGuardFn = resolveBootUiFn("SetLongpressGuard", "setLongpressGuard");
  if (typeof setLongpressGuardFn === "function") {
    setLongpressGuardFn(false);
  } else {
    document.body.classList.remove("longpress-guard");
  }
});

window.addEventListener("resize", () => {
  // CSSOS_WAVE_151 — clamp EVERY .panel (the static `panels` array
  // misses dynamically-created panels like mv-pipeline-panel and the
  // W125+ additions). clampAllPanelsInViewport falls back to the
  // per-panel loop if the global isn't ready yet.
  if (typeof clampAllPanelsInViewport === "function") {
    clampAllPanelsInViewport();
  } else {
    panels.forEach((panel) => clampPanelInViewport(panel));
  }
  layoutShowcasePanels();
});
// Also clamp on orientation change (mobile) + once shortly after load
// so panels opened at a stale size get pulled back in.
window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    if (typeof clampAllPanelsInViewport === "function") clampAllPanelsInViewport();
  }, 250);
});
