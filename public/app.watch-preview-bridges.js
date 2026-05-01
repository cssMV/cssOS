function getPanelSizeConstraints(panelOrId) {
  const id = typeof panelOrId === "string" ? panelOrId : panelOrId?.id;
  const normalized = String(id || "").trim().toLowerCase();
  if (normalized === "logo-panel") {
    return {
      minWidth: 480,
      minHeight: 360,
      maxWidth: 1200,
      maxHeight: 820
    };
  }
  if (normalized === "watch-panel") {
    return {
      minWidth: 420,
      minHeight: 280,
      maxWidth: 1600,
      maxHeight: 1000
    };
  }
  return {
    minWidth: MIN_PANEL_WIDTH,
    minHeight: MIN_PANEL_HEIGHT,
    maxWidth: MAX_PANEL_WIDTH,
    maxHeight: MAX_PANEL_HEIGHT
  };
}

function clampPanelSizeValue(panelOrId, width, height) {
  const limits = getPanelSizeConstraints(panelOrId);
  return {
    width: Math.max(limits.minWidth, Math.min(limits.maxWidth, Number(width) || limits.minWidth)),
    height: Math.max(limits.minHeight, Math.min(limits.maxHeight, Number(height) || limits.minHeight)),
    limits
  };
}

function showDock() {
  dock.classList.remove("hidden");
}

function hideDock() {
  dock.classList.add("hidden");
}

function resetInactivityTimer() {
  showDock();
  if (autoEnjoyArmed) cancelAutoEnjoy();
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(hideDock, 10000);
}

function cancelAutoEnjoy() {
  callWatchUiModule("cancelAutoEnjoyModule");
}

function setForyouBackgroundImage(uri) {
  callWatchUiModule("setForyouBackgroundImageModule", uri);
}

function setEngineProgressVisible(engine, visible, options = {}) {
  callWatchUiModule("setEngineProgressVisibleModule", engine, visible, options);
}

function revealEnginePanel(engine) {
  callWatchUiModule("revealEnginePanelModule", engine);
}

function pinLyricsViewportToLiveEdge() {
  callWatchUiModule("pinLyricsViewportToLiveEdgeModule");
}

function clearForyouStructure() {
  callWatchUiModule("clearForyouStructureModule");
}

function syncForyouActionButtons() {
  callWatchUiModule("syncForyouActionButtonsModule");
}

function armAutoEnjoy(delayMs = 10000) {
  callWatchUiModule("armAutoEnjoyModule", delayMs);
}

function syncForyouThumbFallback(mode) {
  callWatchUiModule("syncForyouThumbFallbackModule", mode);
}

function normalizeSongSeed(seed) {
  return readSongSeedUiModule("normalizeSongSeedModule", {}, seed);
}

function buildSongSeedHierarchy(seed = state.songSeed) {
  return readSongSeedUiModule("buildSongSeedHierarchyModule", [], seed);
}

function renderForyouStructure(seed = state.songSeed) {
  callSongSeedUiModule("renderForyouStructureModule", seed);
}

function recordLyricsSeedSnapshot(seed = state.songSeed, title = state.title, lines = state.lines) {
  callSongSeedUiModule("recordLyricsSeedSnapshotModule", seed, title, lines);
}

function resolveSectionProfile(section) {
  return readSongSeedUiModule("resolveSectionProfileModule", {}, section);
}

function buildLeadDegrees(sectionProfile, noteCount, scale) {
  return readSongSeedUiModule("buildLeadDegreesModule", [], sectionProfile, noteCount, scale);
}

function formatUsdFromCents(cents, fallback = "—") {
  if (cents === null || cents === undefined || !Number.isFinite(Number(cents))) return fallback;
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function getWorkCommerceDetails(workId) {
  return readWatchUiModule(
    "getWorkCommerceDetailsModule",
    {
      listenCents: 0,
      buyoutCents: 0,
      buyoutEnabled: false
    },
    workId
  );
}

function canReceiveTips(work = {}) {
  return readWatchUiModule("canReceiveTipsModule", false, work);
}

function resolveViewerOrderState(viewerOrders = []) {
  return readWatchUiModule(
    "resolveViewerOrderStateModule",
    {
      paidListen: false,
      paidBuyout: false,
      paidTip: false,
      pendingListen: false,
      pendingBuyout: false,
      pendingTip: false
    },
    viewerOrders
  );
}

function setForyouThumbImage(uri) {
  return readWatchUiModule("setForyouThumbImageModule", false, uri);
}

function restoreForyouThumbFallback() {
  return readWatchUiModule("restoreForyouThumbFallbackModule", false);
}

function resetForyouThumb() {
  callWatchUiModule("resetForyouThumbModule");
}
