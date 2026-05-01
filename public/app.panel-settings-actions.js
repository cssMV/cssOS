function syncPanelSettingVisibilityModule(
  panel,
  settings = panel?.querySelector?.(".panel-settings")
) {
  if (!(panel instanceof HTMLElement) || !(settings instanceof HTMLElement)) return;
  const shouldShow = panel.classList.contains("show-settings");
  settings.hidden = !shouldShow;
  settings.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  panel.dataset.settingsOpen = shouldShow ? "true" : "false";
}

function guardPanelSettingsAccessModule(panel) {
  if (!(panel instanceof HTMLElement)) return false;
  if (authState?.user) return true;
  const title =
    panel.querySelector?.(".panel-title,[data-panel-title]")?.textContent?.trim?.() ||
    loginCopy("this panel");
  if (typeof openLoginForCreation === "function") {
    openLoginForCreation(
      loginCopy(
        `Sign in first to open settings for ${title}.`
      )
    );
  } else {
    showToast?.(
      loginCopy(
        `Sign in first to open settings for ${title}.`
      )
    );
    if (loginPanel) openPanel?.(loginPanel);
  }
  return false;
}

function togglePanelSettingsModule(panel, force) {
  if (!(panel instanceof HTMLElement)) return false;
  const wantsOpen =
    typeof force === "boolean" ? force : !panel.classList.contains("show-settings");
  if (wantsOpen && !guardPanelSettingsAccessModule(panel)) return false;
  globalThis.buildPanelSettingsBridge?.(panel);
  const nextOpen = wantsOpen;
  panel.classList.toggle("show-settings", nextOpen);
  syncPanelSettingVisibilityModule(panel);
  if (nextOpen) focusPanel(panel);
  return nextOpen;
}

function openPanelSettingsModule(panel) {
  if (!(panel instanceof HTMLElement)) return false;
  openPanel(panel);
  return togglePanelSettingsModule(panel, true);
}

function initPanelSettingsModule() {
  panels.forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    globalThis.buildPanelSettingsBridge?.(panel);
    syncPanelSettingVisibilityModule(panel);
  });
}

function attachPanelActionsModule() {
  attachPanelBarActions();
}

Object.assign(globalThis, {
  syncPanelSettingVisibilityModule,
  togglePanelSettingsModule,
  openPanelSettingsModule,
  initPanelSettingsModule,
  attachPanelActionsModule,
  initPanelSettings: initPanelSettingsModule,
  attachPanelActions: attachPanelActionsModule
});
