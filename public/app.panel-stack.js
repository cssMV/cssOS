function initPanelStackBridge() {
  panels.forEach((panel, index) => {
    if (!panel) return;
    panel.style.zIndex = `${topZ + index}`;
  });
  topZ += panels.length;
  focusPanel(logoPanel);
}

function normalizeStaticMediaAssetsBridge() {
  document.querySelectorAll('img.mirror-img[src], img.dock-mic-img[src]').forEach((img) => {
    const rawSrc = String(img.getAttribute("src") || "").trim();
    if (!rawSrc || /^(?:[a-z]+:|\/\/|data:)/i.test(rawSrc)) return;
    img.src = resolvePublicAssetUrl(rawSrc);
  });
}

window.initPanelStackBridge = initPanelStackBridge;
window.normalizeStaticMediaAssetsBridge = normalizeStaticMediaAssetsBridge;
