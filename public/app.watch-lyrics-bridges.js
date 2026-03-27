function buildMarketPreviewSeed(work = {}) {
  return globalThis.buildMarketPreviewSeedModule?.(work) || {};
}

function workLyricsLines(work = {}) {
  return globalThis.workLyricsLinesModule?.(work) || [];
}

function isInstructionalLyricLine(line) {
  return globalThis.isInstructionalLyricLineModule?.(line) ?? true;
}

function extractDisplayLyricLines(raw) {
  return globalThis.extractDisplayLyricLinesModule?.(raw) || [];
}

function buildDisplayLyricsPreviewText(work = {}) {
  return globalThis.buildDisplayLyricsPreviewTextModule?.(work) || "";
}
