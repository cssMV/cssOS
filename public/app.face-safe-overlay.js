/* CSSOS_FACE_SAFE_OVERLAY 20260506 — Jing
 *
 * "字幕标题尽量不要遮住人物的脸部". The existing pickFaceSafeAnchor
 * in app.watch-media-overlays.js just rotates through 8 fixed
 * positions — it never actually looked at the video. This module
 * gives it real signal:
 *
 *   1. Try the standards-track FaceDetector API (Chromium-only) every
 *      ~2s on a downsampled snapshot of the current frame.
 *   2. Fall back to a luma-grid heuristic — sample a 16×9 brightness
 *      map and treat the brightest contiguous blob as the face zone
 *      (faces light up under studio lighting).
 *
 * Output: writes data-face-zone on #watch-panel as one of:
 *   tl tr tc bl br bc ml mr c
 * The zone identifies WHERE the face is. The existing title picker
 * inverts that to decide WHERE to anchor the title. The lyric line
 * (karaoke at bottom-center) gets nudged left/right when the face
 * sits at bottom-center.
 *
 * Public API:
 *   globalThis.cssosFaceSafe.zone() → current zone string (e.g. "c")
 *   globalThis.cssosFaceSafe.titleAnchor() → recommended anchor
 *     ("anchor-tl" etc.) — the watch-media-overlays picker uses this
 *     when present.
 */
(function () {
  "use strict";

  var SAMPLE_INTERVAL_MS = 2500;
  var GRID_W = 16, GRID_H = 9;
  var lastZone = "c";
  var faceDetectorAvailable = typeof globalThis.FaceDetector === "function";
  var faceDetector = null;
  if (faceDetectorAvailable) {
    try { faceDetector = new globalThis.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); }
    catch (_e) { faceDetectorAvailable = false; }
  }

  var sharedCanvas = null;
  function getCanvas(w, h) {
    if (!sharedCanvas) sharedCanvas = document.createElement("canvas");
    if (sharedCanvas.width !== w) sharedCanvas.width = w;
    if (sharedCanvas.height !== h) sharedCanvas.height = h;
    return sharedCanvas;
  }

  /* Reduce a face bounding box (or grid cell) to a 9-zone label
   * relative to the frame: 3 columns × 3 rows, addressed as t/m/b
   * + l/c/r. Center is "c". Edge-only zones use single letters. */
  function zoneFromBox(cx, cy, fw, fh) {
    var col = cx < fw / 3 ? "l" : cx > fw * 2 / 3 ? "r" : "c";
    var row = cy < fh / 3 ? "t" : cy > fh * 2 / 3 ? "b" : "m";
    if (row === "m" && col === "c") return "c";
    if (row === "m") return "m" + col;
    if (col === "c") return row + "c";
    return row + col;
  }

  async function detectViaFaceDetector(video) {
    if (!faceDetector) return null;
    var w = 320;
    var h = Math.round(w * (video.videoHeight / Math.max(1, video.videoWidth)));
    if (h < 16) return null;
    var c = getCanvas(w, h);
    var ctx = c.getContext("2d");
    if (!ctx) return null;
    try { ctx.drawImage(video, 0, 0, w, h); } catch (_e) { return null; }
    try {
      var faces = await faceDetector.detect(c);
      if (!faces || !faces.length) return null;
      var f = faces[0].boundingBox || {};
      var cx = (f.x || 0) + (f.width || 0) / 2;
      var cy = (f.y || 0) + (f.height || 0) / 2;
      return zoneFromBox(cx, cy, w, h);
    } catch (_e) { return null; }
  }

  function detectViaLuma(video) {
    var c = getCanvas(GRID_W, GRID_H);
    var ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    try { ctx.drawImage(video, 0, 0, GRID_W, GRID_H); } catch (_e) { return null; }
    var data;
    try { data = ctx.getImageData(0, 0, GRID_W, GRID_H).data; } catch (_e) { return null; }
    var bestL = -1, bestX = 0, bestY = 0;
    for (var y = 0; y < GRID_H; y++) {
      for (var x = 0; x < GRID_W; x++) {
        var i = (y * GRID_W + x) * 4;
        var r = data[i] || 0, g = data[i + 1] || 0, b = data[i + 2] || 0;
        var L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (L > bestL) { bestL = L; bestX = x; bestY = y; }
      }
    }
    return zoneFromBox(bestX + 0.5, bestY + 0.5, GRID_W, GRID_H);
  }

  /* For a face zone, recommend the title anchor diagonally opposite
   * (or in the same row/col but offset). Center face → top-left
   * default since users read top-down + most templates have title
   * top-aligned. */
  var ANCHOR_FOR_ZONE = {
    tl: "anchor-br", tr: "anchor-bl", tc: "anchor-bl",
    bl: "anchor-tr", br: "anchor-tl", bc: "anchor-tr",
    ml: "anchor-tr", mr: "anchor-tl",
    c:  "anchor-tl",
  };

  function applyZone(zone) {
    if (!zone) return;
    lastZone = zone;
    var p = document.getElementById("watch-panel");
    if (p && p.dataset.faceZone !== zone) p.dataset.faceZone = zone;
    // Also stash the recommended anchor on a CSS variable so the
    // existing title picker can read it without a refactor.
    var anchor = ANCHOR_FOR_ZONE[zone] || "anchor-tl";
    if (p && p.dataset.faceTitleAnchor !== anchor) p.dataset.faceTitleAnchor = anchor;
  }

  async function tick() {
    var v = document.getElementById("watch-video");
    if (!v || v.paused || v.ended || v.readyState < 2) return;
    if (!v.videoWidth || !v.videoHeight) return;
    var zone = null;
    if (faceDetectorAvailable) {
      try { zone = await detectViaFaceDetector(v); } catch (_e) {}
    }
    if (!zone) zone = detectViaLuma(v);
    if (zone) applyZone(zone);
  }

  var loopTimer = 0;
  function startLoop() {
    if (loopTimer) return;
    loopTimer = setInterval(function () { void tick(); }, SAMPLE_INTERVAL_MS);
    // Kick once immediately so first frame after open already gets a zone.
    setTimeout(function () { void tick(); }, 250);
  }
  function stopLoop() {
    if (loopTimer) { clearInterval(loopTimer); loopTimer = 0; }
  }

  function bindLifecycle() {
    var v = document.getElementById("watch-video");
    if (!v || v.dataset.cssosFaceSafeBound === "1") return;
    v.dataset.cssosFaceSafeBound = "1";
    v.addEventListener("playing", startLoop, { passive: true });
    v.addEventListener("pause", stopLoop, { passive: true });
    v.addEventListener("ended", stopLoop, { passive: true });
    v.addEventListener("emptied", function () {
      stopLoop();
      var p = document.getElementById("watch-panel");
      if (p) { delete p.dataset.faceZone; delete p.dataset.faceTitleAnchor; }
    }, { passive: true });
  }

  function init() { bindLifecycle(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(bindLifecycle).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosFaceSafe = {
    zone: function () { return lastZone; },
    titleAnchor: function () {
      var p = document.getElementById("watch-panel");
      return (p && p.dataset.faceTitleAnchor) || ANCHOR_FOR_ZONE[lastZone] || "anchor-tl";
    },
    /** Forced zone for testing / overrides. */
    setZone: applyZone,
  };
})();
