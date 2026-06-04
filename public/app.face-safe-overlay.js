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
    // W355 — video streams through the Rust proxy are cross-origin; skip
    // getImageData to avoid SecurityError console noise.
    if (!isSafeForPixelRead(video)) return null;
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

  /* CSSOS_WAVE_125 20260514 — Jing: "桌面端/横屏端也好，手机端/移动端也好,
   * 就算不变形，也要检测人物脸部，要显示完整的人物脸部，不要遮遮掩掩".
   *
   * The cover / slideshow still image (.watch-svg) is object-fit:cover —
   * so when the figure's face sits near an edge, `cover` cropping eats
   * half the face. Detect the face on the IMG and drive `object-position`
   * so the face is always pulled into frame, AND set the face-zone so the
   * title anchors away from it. Runs on every img src change.
   */
  // W355 — before reading pixels, verify the image won't taint the canvas.
  // Cross-origin imgs without crossOrigin="anonymous" (or same-origin CORS)
  // taint the canvas on getImageData, flooding the console with SecurityErrors
  // even though we catch them. Check origin upfront and bail if unsafe.
  function isSafeForPixelRead(img) {
    try {
      var src = img.currentSrc || img.src || "";
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return true;
      var u = new URL(src, window.location.href);
      if (u.origin === window.location.origin) return true;
      // Cross-origin: only safe if crossOrigin="anonymous" is set AND the element
      // has already loaded successfully in that mode (naturalWidth > 0).
      if (img.crossOrigin === "anonymous" && img.naturalWidth > 0) return true;
      return false;
    } catch (_e) { return false; }
  }

  async function detectFaceOnImage(img) {
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    // W355 — skip pixel reads on cross-origin images; avoids SecurityError flood.
    if (!isSafeForPixelRead(img)) return null;
    var w = 320;
    var h = Math.round(w * (img.naturalHeight / Math.max(1, img.naturalWidth)));
    if (h < 16) return null;
    var c = getCanvas(w, h);
    var ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    try { ctx.drawImage(img, 0, 0, w, h); } catch (_e) { return null; }
    // 1. FaceDetector API (Chromium)
    if (faceDetector) {
      try {
        var faces = await faceDetector.detect(c);
        if (faces && faces.length) {
          var f = faces[0].boundingBox || {};
          var cx = (f.x || 0) + (f.width || 0) / 2;
          var cy = (f.y || 0) + (f.height || 0) / 2;
          return { cx: cx / w, cy: cy / h, zone: zoneFromBox(cx, cy, w, h) };
        }
      } catch (_e) {}
    }
    // 2. Luma-blob fallback on the same downsample
    var gx = GRID_W, gy = GRID_H;
    var gc = getCanvas(gx, gy);
    var gctx = gc.getContext("2d", { willReadFrequently: true });
    if (!gctx) return null;
    try { gctx.drawImage(img, 0, 0, gx, gy); } catch (_e) { return null; }
    var data;
    try { data = gctx.getImageData(0, 0, gx, gy).data; } catch (_e) { return null; }
    var bestL = -1, bx = 0, by = 0;
    for (var y = 0; y < gy; y++) {
      for (var x = 0; x < gx; x++) {
        var i = (y * gx + x) * 4;
        var L = 0.2126 * (data[i] || 0) + 0.7152 * (data[i + 1] || 0) + 0.0722 * (data[i + 2] || 0);
        if (L > bestL) { bestL = L; bx = x; by = y; }
      }
    }
    return {
      cx: (bx + 0.5) / gx,
      cy: (by + 0.5) / gy,
      zone: zoneFromBox(bx + 0.5, by + 0.5, gx, gy),
    };
  }

  /* Translate a normalised face center (0..1) into an object-position
   * that keeps the face inside the cropped frame. With object-fit:cover,
   * object-position picks WHICH part survives the crop. We bias toward
   * the face but clamp so we never over-pan past the image edge. */
  function objectPositionForFace(cx, cy) {
    // Pull the crop window's focal point toward the face. Clamp 15..85%
    // so a face dead in a corner still leaves headroom and we don't pin
    // the image to a hard edge (which looks worse than a slight offset).
    var px = Math.max(15, Math.min(85, Math.round(cx * 100)));
    var py = Math.max(15, Math.min(85, Math.round(cy * 100)));
    return px + "% " + py + "%";
  }

  var __imgFaceBound = new WeakSet();
  async function analyzeCoverImage(img) {
    if (!img) return;
    var res = await detectFaceOnImage(img);
    if (!res) return;
    try {
      img.style.objectPosition = objectPositionForFace(res.cx, res.cy);
    } catch (_e) {}
    if (res.zone) applyZone(res.zone);
  }
  function bindCoverImage() {
    var img = document.querySelector("#watch-panel .watch-svg, #watch-svg");
    if (!(img instanceof HTMLImageElement)) return;
    if (__imgFaceBound.has(img)) {
      // Already bound — if it has a fresh src and is loaded, re-analyze.
      if (img.complete && img.naturalWidth) void analyzeCoverImage(img);
      return;
    }
    __imgFaceBound.add(img);
    img.addEventListener("load", function () { void analyzeCoverImage(img); }, { passive: true });
    if (img.complete && img.naturalWidth) void analyzeCoverImage(img);
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
    if (v && v.dataset.cssosFaceSafeBound !== "1") {
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
    // CSSOS_WAVE_125 — also bind the cover/slideshow still image so its
    // face drives object-position (no half-face crop) + title anchor.
    bindCoverImage();
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
    /** CSSOS_WAVE_125 — re-run face detection on the cover image now
     *  (call after swapping #watch-svg src). */
    refreshCover: function () { bindCoverImage(); },
  };

  // CSSOS_WAVE_125 — the slideshow frame loop swaps #watch-svg.src
  // without a fresh `load` listener registration; re-analyze whenever
  // Wave 121's work-id binding fires (new work) or slideshow loads.
  try {
    window.addEventListener("cssos:slideshow-loaded", function () {
      setTimeout(bindCoverImage, 120);
    });
    window.addEventListener("cssos:work-id-changed", function () {
      setTimeout(bindCoverImage, 200);
    });
  } catch (_e) {}
})();
