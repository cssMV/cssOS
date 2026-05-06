/* CSSOS_PIP_BUTTON 20260506 — Jing
 *
 * Picture-in-Picture toggle. After several rounds of "PiP opens but
 * paints black" reports on Safari, this is the shadow-video approach:
 *
 *   We don't PiP the visible #watch-video at all. Instead we maintain
 *   a hidden "shadow" <video> element, mirror src + currentTime + rate
 *   into it, request PiP on the shadow, and pause the original while
 *   PiP is active. When PiP closes, we resume the original from the
 *   shadow's currentTime. The shadow has no CSS, no controlslist, no
 *   chrome-module interference, and no disablePictureInPicture history
 *   in Safari's AVPlayer — so PiP frames flow reliably.
 *
 *   Click the cluster button OR the in-PiP "return to tab" button to
 *   swap. Safari also lets the user click the placeholder rendered in
 *   the original element to exit, which we honor via the standard
 *   leavepictureinpicture event.
 */
(function () {
  "use strict";

  var SHADOW_ID = "cssos-pip-shadow-video";

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("zh") === 0 && zh) return zh;
    return en;
  }

  function isPipSupported() {
    var probe = document.createElement("video");
    if (typeof probe.requestPictureInPicture === "function" && document.pictureInPictureEnabled !== false) return true;
    if (typeof probe.webkitSupportsPresentationMode === "function" && probe.webkitSupportsPresentationMode("picture-in-picture")) return true;
    return false;
  }

  /* Find the <video> currently painting frames. */
  function pickActiveVideo() {
    var primary = document.getElementById("watch-video");
    var candidates = primary ? [primary] : [];
    var all = document.querySelectorAll("video");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.id === SHADOW_ID) continue;
      if (el.classList.contains("mirror-video")) continue;
      if (el.id === "foryou-thumb-video") continue;
      if (candidates.indexOf(el) < 0) candidates.push(el);
    }
    function score(el) {
      var s = 0;
      if (!el.paused && !el.ended) s += 8;
      if (el.readyState >= 2) s += 4;
      if (el.videoWidth > 0 && el.videoHeight > 0) s += 2;
      if (el.currentTime > 0) s += 1;
      return s;
    }
    candidates.sort(function (a, b) { return score(b) - score(a); });
    return candidates[0] || primary;
  }

  function ensureShadow() {
    var sh = document.getElementById(SHADOW_ID);
    if (sh) return sh;
    sh = document.createElement("video");
    sh.id = SHADOW_ID;
    sh.playsInline = true;
    // Hidden but rendered — Safari needs a non-zero rendering layer to
    // emit frames into PiP. position:fixed off-screen with 1×1 size and
    // opacity:0 keeps it invisible but alive.
    sh.style.cssText =
      "position:fixed;left:-2px;top:-2px;width:1px;height:1px;" +
      "opacity:0.001;pointer-events:none;z-index:-1;";
    sh.setAttribute("aria-hidden", "true");
    document.body.appendChild(sh);
    return sh;
  }

  /* Mirror src + audio + position from src video into shadow. */
  function mirrorFromTo(src, dst) {
    if (!src || !dst) return;
    var srcUrl = src.currentSrc || src.src || "";
    if (srcUrl && dst.src !== srcUrl) {
      try { dst.src = srcUrl; } catch (_e) {}
    }
    try { dst.muted = src.muted; dst.volume = src.volume; } catch (_e) {}
    try { dst.playbackRate = src.playbackRate || 1; } catch (_e) {}
    try { dst.currentTime = src.currentTime || 0; } catch (_e) {}
  }

  var lastOriginal = null;

  async function enterPip() {
    var orig = pickActiveVideo();
    if (!orig) return;
    lastOriginal = orig;
    var sh = ensureShadow();
    mirrorFromTo(orig, sh);
    // Wait for the shadow to have a frame.
    await new Promise(function (resolve) {
      var done = false;
      var go = function () { if (done) return; done = true; resolve(); };
      if (sh.readyState >= 2) return go();
      var ev = function () {
        sh.removeEventListener("loadeddata", ev);
        sh.removeEventListener("canplay", ev);
        go();
      };
      sh.addEventListener("loadeddata", ev, { once: true });
      sh.addEventListener("canplay", ev, { once: true });
      try { sh.load(); } catch (_e) {}
      // Time-out fallback — request anyway after 1.2s.
      setTimeout(go, 1200);
    });
    try {
      // Pause the original, play the shadow.
      try { orig.pause(); } catch (_e) {}
      try { await sh.play(); } catch (_e) {}
      if (typeof sh.requestPictureInPicture === "function") {
        await sh.requestPictureInPicture();
      } else if (typeof sh.webkitSetPresentationMode === "function") {
        sh.webkitSetPresentationMode("picture-in-picture");
      }
    } catch (err) {
      console.info("[cssos-pip] enter failed:", err && err.name ? err.name : err);
      // Roll back — resume the original so user isn't left with a paused video.
      try { orig.play(); } catch (_e) {}
    }
  }

  async function exitPip() {
    var sh = document.getElementById(SHADOW_ID);
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (sh && sh.webkitPresentationMode === "picture-in-picture") {
        sh.webkitSetPresentationMode("inline");
      }
    } catch (_e) {}
    // Hand control back to the original.
    if (sh && lastOriginal) {
      try { lastOriginal.currentTime = sh.currentTime || lastOriginal.currentTime; } catch (_e) {}
      try { lastOriginal.play(); } catch (_e) {}
      try { sh.pause(); } catch (_e) {}
    }
  }

  async function togglePip() {
    var sh = document.getElementById(SHADOW_ID);
    var inPip =
      !!document.pictureInPictureElement ||
      (sh && sh.webkitPresentationMode === "picture-in-picture");
    if (inPip) await exitPip();
    else await enterPip();
  }

  function ensureButton() {
    if (!isPipSupported()) return null;
    var screen = document.querySelector("#watch-panel .watch-screen");
    if (!screen) return null;
    var existing = screen.querySelector(".cssmv-pip-btn");
    if (existing) return existing;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cssmv-fr-btn cssmv-pip-btn";
    btn.setAttribute("aria-label", tt("Picture in Picture", "画中画"));
    btn.title = tt("Picture in Picture", "画中画");
    btn.textContent = "⊞";
    btn.style.cssText = "right:226px;font-size:18px;";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      void togglePip();
    });
    screen.appendChild(btn);

    // Reflect PiP state on the button.
    var sh = ensureShadow();
    var sync = function () {
      var on =
        document.pictureInPictureElement === sh ||
        sh.webkitPresentationMode === "picture-in-picture";
      btn.classList.toggle("is-on", !!on);
      // When the user closes PiP from the OS chrome, also resume the
      // original from where the shadow stopped.
      if (!on && lastOriginal) {
        try { lastOriginal.currentTime = sh.currentTime || lastOriginal.currentTime; } catch (_e) {}
        try { lastOriginal.play(); } catch (_e) {}
        try { sh.pause(); } catch (_e) {}
      }
    };
    sh.addEventListener("enterpictureinpicture", sync);
    sh.addEventListener("leavepictureinpicture", sync);
    sh.addEventListener("webkitpresentationmodechanged", sync);
    sync();
    return btn;
  }

  function ensureStyles() {
    if (document.getElementById("cssos-pip-style")) return;
    var s = document.createElement("style");
    s.id = "cssos-pip-style";
    s.textContent =
      ".cssmv-pip-btn.is-on{color:#001b14 !important;background:rgba(0,245,160,0.85) !important;}";
    document.head.appendChild(s);
  }

  function init() {
    ensureStyles();
    ensureShadow();
    ensureButton();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(function () {
      ensureButton();
    }).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosPip = { toggle: togglePip, supported: isPipSupported, enter: enterPip, exit: exitPip };
})();
