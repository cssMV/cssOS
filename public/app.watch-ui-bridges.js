function resetTypingStateBridge() {
  callWatchUiModule("resetTypingStateModule");
}

function cycleLyricsStateBridge() {
  callWatchUiModule("cycleLyricsStateModule");
}

function initLyricsControlsBridge() {
  callWatchUiModule("initLyricsControlsModule");
}

function setEngineDetailBridge(engine, detail) {
  callWatchUiModule("setEngineDetailModule", engine, detail);
}

function setEngineStateBridge(engine, state) {
  callWatchUiModule("setEngineStateModule", engine, state);
}

function cycleEngineStateBridge(engine) {
  callWatchUiModule("cycleEngineStateModule", engine);
}

function initEngineControlsBridge() {
  callWatchUiModule("initEngineControlsModule");
}

function resetEngineStatesBridge() {
  callWatchUiModule("resetEngineStatesModule");
}

function animateProgressBridge() {
  callWatchUiModule("animateProgressModule");
}

window.resetTypingStateBridge = resetTypingStateBridge;
window.cycleLyricsStateBridge = cycleLyricsStateBridge;
window.initLyricsControlsBridge = initLyricsControlsBridge;
window.setEngineDetailBridge = setEngineDetailBridge;
window.setEngineStateBridge = setEngineStateBridge;
window.cycleEngineStateBridge = cycleEngineStateBridge;
window.initEngineControlsBridge = initEngineControlsBridge;
window.resetEngineStatesBridge = resetEngineStatesBridge;
window.animateProgressBridge = animateProgressBridge;
