function openCreationShowcasePanels(options = {}) {
  globalThis.openCreationShowcasePanelsModule?.(options);
}

function openCreationAdvancedSettingsPanel() {
  globalThis.openCreationAdvancedSettingsPanelModule?.();
}

function resolveCreationSurfaceMode(origin = "logo") {
  return globalThis.resolveCreationSurfaceModeModule?.(origin) ?? "mv_only";
}

function showCreationSurface(origin = "logo") {
  globalThis.showCreationSurfaceModule?.(origin);
}

function invokeUniversalCreationEntry(options = {}) {
  return globalThis.invokeUniversalCreationEntryModule?.(options);
}

Object.assign(globalThis, {
  openCreationShowcasePanels,
  openCreationAdvancedSettingsPanel,
  resolveCreationSurfaceMode,
  showCreationSurface,
  invokeUniversalCreationEntry
});
