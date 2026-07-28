function guardPanelAccessModule(panelId) {
  if (!panelId) return true;
  if (!canOpenPanelById(panelId)) {
    if (!isLoggedInUser()) {
      showToast(loginCopy("Sign in to open this panel."));
      openPanel(loginPanel);
      return false;
    }
    if (panelId === "seller-panel") {
      showToast(permissionPrompt("seller.view"));
      return false;
    }
    if (
      panelId === "profile-panel" ||
      panelId === "works-panel" ||
      panelId === "delivery-reports-panel" ||
      panelId === "delivery-ops-panel" ||
      panelId === "cssmv-panel"
    ) {
      showToast(permissionPrompt("login"));
      return false;
    }
    if (panelId === "user-admin-panel") {
      showToast(permissionPrompt("login"));
      return false;
    }
    if (panelId === "credit-panel" || panelId === "workspaces-panel") {
      showToast(permissionPrompt("login"));
      return false;
    }
    return false;
  }
  if (panelId === "works-panel") {
    try {
      globalThis.renderWorksPanelModule?.();
    } catch (error) {
      console.error("[works-panel] guard render failed", error);
    }
    return true;
  }
  if (panelId === "notifications-panel") {
    try {
      globalThis.renderNotificationsPanelModule?.();
    } catch (error) {
      console.error("[notifications-panel] guard render failed", error);
    }
    return true;
  }
  if (panelId === "subscription-panel") {
    try {
      globalThis.renderSubscriptionPanelModule?.();
    } catch (error) {
      console.error("[subscription-panel] guard render failed", error);
    }
    return true;
  }
  if (panelId === "user-admin-panel") {
    try {
      globalThis.renderUserAdminPanelModule?.();
    } catch (error) {
      console.error("[user-admin-panel] guard render failed", error);
    }
    return true;
  }
  if (panelId === "system-mvs-panel") {
    try {
      globalThis.renderSystemMvsPanelModule?.();
    } catch (error) {
      console.error("[system-mvs-panel] guard render failed", error);
    }
    return true;
  }
  if (panelId === "credit-panel") {
    try {
      globalThis.renderCreditPanelModule?.();
    } catch (error) {
      console.error("[credit-panel] guard render failed", error);
    }
    return true;
  }
  if (panelId === "workspaces-panel") {
    try {
      globalThis.renderWorkspacesPanelModule?.();
    } catch (error) {
      console.error("[workspaces-panel] guard render failed", error);
    }
    return true;
  }
  if (panelId === "api-panel") {
    globalThis.renderApiBillingPanelModule?.();
    return true;
  }
  return true;
}

function updateDockVisibilityModule() {
  Object.entries(dockByPanel).forEach(([panelId, action]) => {
    const panel = document.getElementById(panelId);
    const dockItem = document.querySelector(`[data-action="${action}"]`);
    if (!panel || !dockItem) return;
    const canOpen = canOpenPanelById(panelId);
    if (!authState.user && !GUEST_VISIBLE_DOCK_ACTIONS.has(action)) {
      dockItem.classList.add("is-hidden");
      return;
    }
    if (authState.user && !canOpen) {
      dockItem.classList.add("is-hidden");
      return;
    }
    if (panel.classList.contains("hidden")) {
      dockItem.classList.remove("is-hidden");
    } else {
      dockItem.classList.add("is-hidden");
    }
  });
  // CSSOS_PHASE2_MV_GUEST_GATE — the MV Pipeline panel is dynamically created
  // (not in dockByPanel), so it has its own guest-gate refresher. Call it here
  // so login/logout events re-evaluate dock visibility + close-on-logout at
  // the same choke point as every other panel.
  try { globalThis.refreshMvPipelineGuestGate?.(); } catch (_) {}
}

function storePanelStateModule(panel) {
  panel.dataset.restore = JSON.stringify({
    left: panel.style.left || "",
    top: panel.style.top || "",
    width: panel.style.width || "",
    height: panel.style.height || "",
    transform: panel.style.transform || ""
  });
}

function restorePanelModule(panel) {
  const restore = panel.dataset.restore ? JSON.parse(panel.dataset.restore) : {};
  panel.style.left = restore.left || "";
  panel.style.top = restore.top || "";
  panel.style.width = restore.width || "";
  panel.style.height = restore.height || "";
  panel.style.transform = restore.transform || "";
  panel.classList.remove("maximized");
  panel.dataset.maximized = "false";
  // CSSOS_PHASE2_OPEN_MAXIMIZED 20260505 — Jing
  // Mark that the user explicitly un-maximized this panel so a
  // subsequent openPanel() call doesn't auto-maximize again. We
  // don't persist this across reloads (the default is still
  // maximized on a fresh page load); it only respects the choice
  // within the current session.
  panel.dataset.userUnmaximized = "1";
  // CSSOS_WAVE_464 20260528 — clamp after restore so a panel whose
  // stored position was recorded at a larger window size or off-screen
  // stays reachable. rAF ensures the layout is settled before measuring.
  requestAnimationFrame(function () {
    try { (globalThis.clampPanelInViewport || globalThis.clampAllPanelsInViewport)?.(panel); } catch (_) {}
  });
}

/* CSSOS_PHASE1_MAXIMIZE_PARAMETERIZED 20260417:
   Maximize behavior is now driven by panel_chrome.maximize_mode (default
   "fullscreen"). The Watch panel is always fullscreen regardless of the
   setting (media panel = immersive). We set panel.dataset.maximizeMode so
   style.css can pick the right rule:
   `.panel.maximized[data-maximize-mode="fullscreen"]` (100vw x 100vh, inset 0)
   vs. the legacy classic-centered modal. */
function resolvePanelMaximizeMode(panel) {
  if (panel?.id === "watch-panel") return "fullscreen";
  const setting = String(globalThis.panelChromeSettings?.maximize_mode || "").toLowerCase();
  if (setting === "classic") return "classic";
  return "fullscreen";
}

// CSSOS — generic OS-level fullscreen for ANY maximized panel (Panel Constitution
// Article 1: ⤢ Maximize = true OS fullscreen for EVERY panel). The watch panel uses
// its own cssosEnterWatchFullscreen (theater backdrop + container-first emotion-FX);
// all other panels use these generic vendor-prefixed helpers. Must run inside the
// click gesture so the browser honors requestFullscreen's user-activation gate. On
// devices without element-level fullscreen the request no-ops → panel stays CSS-max.
function cssosEnterPanelFullscreenGeneric(panel) {
  try {
    if (!panel) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    var fn = panel.requestFullscreen || panel.webkitRequestFullscreen
      || panel.mozRequestFullScreen || panel.msRequestFullscreen;
    if (fn) { var r = fn.call(panel); if (r && typeof r.catch === "function") r.catch(function () {}); }
  } catch (_e) {}
}
function cssosExitPanelFullscreenGeneric() {
  try {
    if (!(document.fullscreenElement || document.webkitFullscreenElement)) return;
    var fn = document.exitFullscreen || document.webkitExitFullscreen
      || document.mozCancelFullScreen || document.msExitFullscreen;
    if (fn) { var r = fn.call(document); if (r && typeof r.catch === "function") r.catch(function () {}); }
  } catch (_e) {}
}

function togglePanelMaximizeModule(panel) {
  if (!panel) return;
  const isMaximized = panel.dataset.maximized === "true";
  if (isMaximized) {
    restorePanelModule(panel);
    delete panel.dataset.maximizeMode;
    // CSSOS_WAVE_113B1 20260511 — Jing
    // Restoring the watch panel must also exit OS fullscreen so the
    // user lands back in the windowed cssOS desktop (Vision Pro will
    // leave its Immersive Environment when fullscreen exits).
    if (panel.id === "watch-panel" && typeof globalThis.cssosExitWatchFullscreen === "function") {
      globalThis.cssosExitWatchFullscreen();
    } else if (panel.id !== "watch-panel") {
      // Article 1 — every panel's restore also exits OS fullscreen.
      cssosExitPanelFullscreenGeneric();
    }
  } else {
    storePanelStateModule(panel);
    const mode = resolvePanelMaximizeMode(panel);
    panel.dataset.maximizeMode = mode;
    if (mode === "fullscreen") {
      /* Let CSS drive the box via
         `.panel.maximized[data-maximize-mode="fullscreen"]`. Clear the inline
         transform/size so the cascade wins. */
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "";
      panel.style.bottom = "";
      panel.style.transform = "";
      panel.style.width = "";
      panel.style.height = "";
    } else {
      panel.style.left = "50%";
      panel.style.top = "50%";
      panel.style.transform = "translate(-50%, -50%)";
      panel.style.width = "min(92vw, 1200px)";
      panel.style.height = "min(82vh, 760px)";
    }
    panel.classList.add("maximized");
    panel.dataset.maximized = "true";
    // CSSOS_WAVE_113B1 20260511 — Jing
    // Maximizing the watch panel must trigger the OS-level fullscreen
    // request so Apple Vision Pro Safari can auto-enter its system
    // Immersive Environment. This replaces the standalone 👓 Immersive
    // pill that used to sit in the bottom-left of the media frame.
    // Must be called from inside this click handler so the browser
    // honors the user-activation gate on requestFullscreen.
    if (panel.id === "watch-panel" && typeof globalThis.cssosEnterWatchFullscreen === "function") {
      globalThis.cssosEnterWatchFullscreen();
    } else if (panel.id !== "watch-panel") {
      // Article 1 — every panel's ⤢ Maximize is true OS-level fullscreen.
      cssosEnterPanelFullscreenGeneric(panel);
    }
  }
  focusPanel(panel);
}

function openAndMaximizeModule(panel, options = {}) {
  openPanel(panel, options);
  togglePanelMaximizeModule(panel);
}

/* CSSOS_PHASE1_STACK00_LAYOUT 20260417:
   Default showcase layout is now "stack_00": every auto-opened panel stacks at
   the origin (0, 0) with a small diagonal offset equal to the panel-bar icon
   (~40px). The legacy multi-column showcase grid is preserved behind
   panel_chrome.layout_mode === "showcase_grid". Per the panel "constitution",
   user-moved panels (dataset.userMoved === "true") are never repositioned. */
function layoutStackAtOriginModule(visible) {
  const iconStep = 40; // panel-bar icon width ≈ 40px
  visible.forEach((panel, index) => {
    panel.classList.remove("showcase-panel");
    panel.style.width = "";
    if (!panel.classList.contains("panel-collapsed") && panel.dataset.maximized !== "true") {
      panel.style.height = "";
    }
    const offset = iconStep * index;
    setPanelPosition(panel, offset, offset);
  });
}

function layoutShowcaseGridModule(visible) {
  const spacing = 26;
  const paddingX = 32;
  const paddingY = 88;
  const minWidth = 340;
  const maxWidth = 520;
  const availableWidth = Math.max(0, window.innerWidth - paddingX * 2);
  const columns = Math.max(
    1,
    Math.min(3, Math.floor((availableWidth + spacing) / (minWidth + spacing)))
  );
  const panelWidth = Math.max(
    minWidth,
    Math.min(maxWidth, Math.floor((availableWidth - spacing * (columns - 1)) / columns))
  );

  visible.forEach((panel) => {
    panel.classList.add("showcase-panel");
    panel.style.width = `${panelWidth}px`;
    if (!panel.classList.contains("panel-collapsed") && panel.dataset.maximized !== "true") {
      panel.style.height = "";
    }
  });

  const rowHeights = [];
  visible.forEach((panel, index) => {
    const row = Math.floor(index / columns);
    const rect = panel.getBoundingClientRect();
    rowHeights[row] = Math.max(rowHeights[row] || 0, rect.height);
  });

  const rowOffsets = [];
  let offset = paddingY;
  rowHeights.forEach((height, row) => {
    rowOffsets[row] = offset;
    offset += height + spacing;
  });

  const maxHeight = window.innerHeight - paddingY;
  let overflowIndex = visible.length;
  for (let row = 0; row < rowHeights.length; row += 1) {
    if (rowOffsets[row] + rowHeights[row] > maxHeight) {
      overflowIndex = row * columns;
      break;
    }
  }

  visible.forEach((panel, index) => {
    if (index >= overflowIndex) return;
    const row = Math.floor(index / columns);
    const col = index % columns;
    const left = paddingX + col * (panelWidth + spacing);
    const top = rowOffsets[row] ?? paddingY;
    setPanelPosition(panel, left, top);
  });

  if (overflowIndex < visible.length) {
    const lastVisibleIndex = Math.max(0, overflowIndex - 1);
    const anchor = visible[lastVisibleIndex];
    const anchorRect = anchor ? anchor.getBoundingClientRect() : null;
    const baseLeft = anchorRect ? anchorRect.left : paddingX;
    const baseTop = anchorRect ? Math.min(anchorRect.top + 24, window.innerHeight - 260) : paddingY;
    const barHeight = anchor?.querySelector(".panel-bar")?.offsetHeight || 56;
    const offsetStep = barHeight + 8;
    visible.slice(overflowIndex).forEach((panel, idx) => {
      const cascadeOffset = offsetStep * (idx + 1);
      const left = Math.min(baseLeft + cascadeOffset, window.innerWidth - panelWidth - paddingX);
      const top = Math.min(baseTop + cascadeOffset, window.innerHeight - 200);
      setPanelPosition(panel, left, top);
    });
  }
}

function layoutShowcasePanelsModule() {
  const order = [
    foryouPanel,
    lyricsPanel,
    musicPanel,
    videoPanel,
    watchPanel,
    cssmvPanel,
    settingsPanel
  ].filter(Boolean);
  const visible = order.filter(
    (panel) =>
      !panel.classList.contains("hidden") &&
      panel.dataset.userMoved !== "true" &&
      panel.id !== "logo-panel"
  );
  if (!visible.length) return;

  const layoutMode = String(globalThis.panelChromeSettings?.layout_mode || "stack_00").toLowerCase();
  if (layoutMode === "showcase_grid") {
    layoutShowcaseGridModule(visible);
  } else {
    layoutStackAtOriginModule(visible);
  }
}

globalThis.guardPanelAccessModule = guardPanelAccessModule;
globalThis.updateDockVisibilityModule = updateDockVisibilityModule;
globalThis.storePanelStateModule = storePanelStateModule;
globalThis.restorePanelModule = restorePanelModule;
globalThis.togglePanelMaximizeModule = togglePanelMaximizeModule;
globalThis.openAndMaximizeModule = openAndMaximizeModule;
globalThis.layoutShowcasePanelsModule = layoutShowcasePanelsModule;
globalThis.layoutStackAtOriginModule = layoutStackAtOriginModule;
globalThis.layoutShowcaseGridModule = layoutShowcaseGridModule;
globalThis.resolvePanelMaximizeMode = resolvePanelMaximizeMode;

globalThis.guardPanelAccess = guardPanelAccessModule;
globalThis.updateDockVisibility = updateDockVisibilityModule;
globalThis.storePanelState = storePanelStateModule;
globalThis.restorePanel = restorePanelModule;
globalThis.togglePanelMaximize = togglePanelMaximizeModule;
globalThis.openAndMaximize = openAndMaximizeModule;
globalThis.layoutShowcasePanels = layoutShowcasePanelsModule;
