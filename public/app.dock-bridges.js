function buildBuiltinDockActionMap() {
  return globalThis.buildBuiltinDockActionMapBridge?.() || {};
}

function getDockActionMap() {
  return globalThis.getDockActionMapBridge?.() || {};
}

var dockActionMap = getDockActionMap();

function handleDockAction(action, type) {
  return globalThis.handleDockActionBridge?.(action, type);
}

function handleGlobalAction(action) {
  return globalThis.handleGlobalActionBridge?.(action);
}

function getDockItems() {
  return globalThis.getDockItemsBridge?.() || [];
}

function saveDockOrder() {
  return globalThis.saveDockOrderBridge?.();
}

function restoreDockOrder() {
  return globalThis.restoreDockOrderBridge?.();
}

function attachDockReorder() {
  return globalThis.attachDockReorderBridge?.();
}

let dockDockPreviewEl = null;
var dockSettingsPopover = globalThis.__cssosDockSettingsPopover || null;

function watchArchiveChecklistState(passed) {
  return globalThis.watchArchiveChecklistStateBridge?.(passed);
}

function ensureDockPreviewEl() {
  return globalThis.ensureDockPreviewElBridge?.() || dockDockPreviewEl;
}

function hideDockPreview() {
  return globalThis.hideDockPreviewBridge?.();
}

function dockPreviewRect(position) {
  return globalThis.dockPreviewRectBridge?.(position);
}

function resolveDockPositionFromPointer(clientX, clientY) {
  return globalThis.resolveDockPositionFromPointerBridge?.(clientX, clientY) || "";
}

function updateDockDragFollow(clientX, clientY) {
  return globalThis.updateDockDragFollowBridge?.(clientX, clientY);
}

function resetDockDragFollow() {
  return globalThis.resetDockDragFollowBridge?.();
}

function showDockPreview(position) {
  return globalThis.showDockPreviewBridge?.(position);
}

function attachDockDocking() {
  return globalThis.attachDockDockingBridge?.();
}

function attachDockEvents() {
  return globalThis.attachDockEventsBridge?.();
}

function attachGlobalActionDispatcher() {
  return globalThis.attachGlobalActionDispatcherBridge?.();
}
