function focusPanelBridge(panel) {
  if (!panel) return;
  topZ += 1;
  panel.style.zIndex = `${topZ}`;
  panels.forEach((item) => {
    if (!item) return;
    item.classList.remove("panel-front");
  });
  panel.classList.add("panel-front");
  panel.classList.add("panel-active");
  setTimeout(() => panel.classList.remove("panel-active"), 600);
}

function openPanelBridge(panel, options = {}) {
  const shouldFocus = options.focus !== false;
  let shouldLayout = options.layout !== false;
  if (!panel) return;
  if (!guardPanelAccess(panel.id)) return;
  panel.classList.remove("hidden");
  panel.dataset.minimized = "false";
  const restoredLayout = applyStoredPanelLayout(panel);
  const shouldAutoMaximize = panel.id !== "logo-panel";
  if (panel === watchPanel) {
    callWatchUiModule("openWatchPanelShellModule", restoredLayout);
  } else if (!restoredLayout && !panel.dataset.positioned) {
    placePanelFromTopLeft(panel);
  }
  if (shouldAutoMaximize && typeof globalThis.togglePanelMaximizeModule === "function") {
    if (panel.dataset.maximized !== "true") {
      globalThis.togglePanelMaximizeModule(panel);
    }
    shouldLayout = false;
  }
  if (typeof clampPanelInViewport === "function") {
    clampPanelInViewport(panel);
  }
  const rect = panel.getBoundingClientRect?.();
  const mostlyOutsideViewport =
    rect &&
    (rect.right < 120 ||
      rect.bottom < 120 ||
      rect.left > window.innerWidth - 120 ||
      rect.top > window.innerHeight - 120);
  if (mostlyOutsideViewport) {
    panel.dataset.userMoved = "false";
    placePanelFromTopLeft(panel);
    if (typeof clampPanelInViewport === "function") {
      clampPanelInViewport(panel);
    }
  }
  if (shouldFocus) {
    focusPanelBridge(panel);
  }
  if (panel === foryouPanel) {
    const body = panel.querySelector(".panel-body");
    if (body instanceof HTMLElement) body.scrollTop = 0;
    panel.classList.remove("search-revealed");
    setForyouCompact(true, { armAuto: false });
    renderForyouMarketplace();
    void loadPublicMarketWorks(true).then(() => renderForyouMarketplace());
  }
  if (panel === cssmvPanel) {
    const behavior = readPanelBehaviorSettingsLocal();
    if (behavior.cssmv.auto_refresh !== false) {
      void globalThis.loadDeliveryDigestBundleModule?.();
    }
    window.setTimeout(() => {
      const map = {
        digest: "#mv-digest-pulse",
        governance: "#mv-governance-pulse",
        timeline: "#mv-timeline-list"
      };
      globalThis.scrollPanelSectionIntoViewModule?.(panel, map[behavior.cssmv.default_section] || "#mv-digest-pulse");
    }, 40);
  }
  if (panel === languagePanel) {
    const behavior = readPanelBehaviorSettingsLocal();
    globalThis.toggleLanguagePanelMode?.(behavior.language.default_mode);
    languageListMore?.classList.toggle("is-hidden", !behavior.language.show_more);
  }
  if (panel === loginPanel) {
    loginPanel.dataset.panelDensity = readPanelBehaviorSettingsLocal().login.panel_density;
  }
  if (panel === profilePanel) {
    profilePanel.dataset.panelDensity = readPanelBehaviorSettingsLocal().profile.panel_density;
    refreshProfilePanelsAndVersionSurface();
  }
  if (panel === worksPanel) {
    const body = panel.querySelector(".panel-body");
    if (body instanceof HTMLElement) body.scrollTop = 0;
    panel.classList.remove("search-revealed");
    const behavior = readPanelBehaviorSettingsLocal();
    worksPanel.dataset.focusSection = behavior.works.focus_section;
    if (behavior.works.auto_load !== false) globalThis.renderWorksPanelModule?.();
    window.setTimeout(() => {
      const map = {
        works: ".works-section",
        comments: ".works-grid .works-section:first-child",
        monetization: ".works-grid .works-section:last-child"
      };
      globalThis.scrollPanelSectionIntoViewModule?.(panel, map[behavior.works.focus_section] || ".works-section");
    }, 40);
  }
  if (panel === sellerPanel) {
    const behavior = readPanelBehaviorSettingsLocal();
    sellerPanel.dataset.focusLane = behavior.seller.focus_lane;
    if (behavior.seller.auto_refresh !== false) {
      void loadWatchCommerce(true).then(() => renderSellerPanel());
    }
    window.setTimeout(() => {
      const map = {
        orders: "#seller-orders-list",
        income: "#seller-ledger-list"
      };
      globalThis.scrollPanelSectionIntoViewModule?.(panel, map[behavior.seller.focus_lane] || "#seller-orders-list");
    }, 40);
  }
  if (panel === aboutPanel) {
    globalThis.activateAboutTabModule?.(readPanelBehaviorSettingsLocal().about.default_tab);
  }
  if (panel.id === "delivery-reports-panel") {
    const behavior = readPanelBehaviorSettingsLocal();
    deliveryReportState.kind = behavior.delivery_reports.default_kind;
    deliveryExportState.previewExpanded = !!behavior.delivery_reports.preview_expanded;
    void loadDeliveryReport(deliveryReportState.kind);
    if (deliveryDashboardState.runId) {
      void loadMusicDeliveryDashboard(deliveryDashboardState.runId);
    }
    ensureMusicDeliveryDashboardPolling();
    window.setTimeout(() => {
      const sectionMap = {
        overview: ".report-body",
        dashboard: ".report-export-shell",
        export: ".report-export-shell:nth-of-type(2)",
        history: "#delivery-export-history"
      };
      globalThis.scrollPanelSectionIntoViewModule?.(panel, sectionMap[behavior.delivery_reports.focus_section] || ".report-body");
    }, 40);
  }
  if (panel.id === "delivery-ops-panel") {
    const behavior = readPanelBehaviorSettingsLocal();
    deliveryOpsState.recoveryLimit = behavior.delivery_ops.recovery_limit;
    if (behavior.delivery_ops.auto_refresh !== false) {
      void loadDeliveryOps(true);
    }
    window.setTimeout(() => {
      const laneMap = {
        overview: "#delivery-ops-console-overview",
        subscriptions: "#delivery-ops-subscriptions",
        logs: "#delivery-ops-logs",
        recovery: "#delivery-ops-recovery-summary",
        actions: "#delivery-ops-console-actions"
      };
      globalThis.scrollPanelSectionIntoViewModule?.(panel, laneMap[behavior.delivery_ops.focus_lane] || "#delivery-ops-console-overview");
    }, 40);
  }
  updateDockVisibility();
  if (shouldLayout) {
    layoutShowcasePanels();
  }
}

function bringPanelToFrontBridge(panel, options = {}) {
  if (!panel) return;
  const repeatPasses = Math.max(0, Number(options.repeatPasses ?? 2));
  focusPanelBridge(panel);
  if (!repeatPasses) return;
  let passesLeft = repeatPasses;
  const rerun = () => {
    if (!panel || panel.classList.contains("hidden")) return;
    focusPanelBridge(panel);
    passesLeft -= 1;
    if (passesLeft > 0) {
      requestAnimationFrame(rerun);
    }
  };
  requestAnimationFrame(rerun);
}

window.focusPanelBridge = focusPanelBridge;
window.openPanelBridge = openPanelBridge;
window.bringPanelToFrontBridge = bringPanelToFrontBridge;
window.focusPanel = focusPanelBridge;
window.openPanel = openPanelBridge;
