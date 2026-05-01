function renderCreationUniverseCard(seed = state.songSeed) {
  globalThis.renderCreationUniverseCardModule?.(seed);
}

function renderCreationReferenceLibrary() {
  globalThis.renderCreationReferenceLibraryModule?.();
}

function creationTabLabel(tabKey) {
  return globalThis.creationTabLabelModule?.(tabKey) ?? tabKey;
}

function creationChipLabel(tabKey, value) {
  return globalThis.creationChipLabelModule?.(tabKey, value) ?? value;
}

function scheduleCreationConsoleExtras(seed = state.songSeed) {
  globalThis.scheduleCreationConsoleExtrasModule?.(seed);
}

function syncCreationTabsDom(tabDefs) {
  globalThis.syncCreationTabsDomModule?.(tabDefs);
}

function syncCreationChipsDom(items, selected) {
  globalThis.syncCreationChipsDomModule?.(items, selected);
}

function flushRenderCreationConsole() {
  globalThis.flushRenderCreationConsoleModule?.();
}

function renderCreationConsole() {
  globalThis.renderCreationConsoleModule?.();
}

function initCreationConsole() {
  globalThis.initCreationConsoleModule?.();
}

Object.assign(globalThis, {
  renderCreationUniverseCard,
  renderCreationReferenceLibrary,
  creationTabLabel,
  creationChipLabel,
  scheduleCreationConsoleExtras,
  syncCreationTabsDom,
  syncCreationChipsDom,
  flushRenderCreationConsole,
  renderCreationConsole,
  initCreationConsole
});
