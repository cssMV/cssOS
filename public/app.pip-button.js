/* CSSOS_PIP_BUTTON 20260506 — Jing
 *
 * Add a Picture-in-Picture (PiP) toggle to the watch frame button
 * cluster. Lets the user pop the video into a floating mini-window so
 * they can keep watching while doing something else (writing on
 * another panel, switching apps, etc.). Same affordance YouTube,
 * Vimeo, and the macOS native player all expose.
 *
 * Browser support is widespread (Chromium / Edge / Safari / Firefox);
 * the button hides itself on browsers that don't expose
 * `requestPictureInPicture`. Fails closed.
 *
 * Lives next to the existing .cssmv-fs-btn (⛶) inside the watch
 * frame's .cssmv-fr-btn cluster, so cinema-mode chrome-hide rules
 * already cover it without a CSS change.
 */
(function () {
  "use strict";

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("zh") === 0 && zh) return zh;
    return en;
  }

  function isPipSupported() {
    var v = document.getElementById("watch-video");
    if (!v) return false;
    if (typeof v.requestPictureInPicture === "function" && document.pictureInPictureEnabled !== false) return true;
    // Older Safari: webkitSupportsPresentationMode
    if (typeof v.webkitSupportsPresentationMode === "function" && v.webkitSupportsPresentationMode("picture-in-picture")) {
      return true;
    }
    return false;
  }

  /* Pick the <video> element that's actually painting frames. The
   * watch panel can have multiple video elements (mirror, foryou-thumb,
   * mv-overlay) — PiP-ing the wrong one yields a black window. */
  function pickActiveVideo() {
    var candidates = [];
    var primary = document.getElementById("watch-video");
    if (primary) candidates.push(primary);
    // Any other video that's currently playing visible content.
    var all = document.querySelectorAll("video");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (candidates.indexOf(el) >= 0) continue;
      // Skip the offscreen/hidden helpers.
      if (el.classList.contains("mirror-video")) continue;
      if (el.id === "foryou-thumb-video") continue;
      candidates.push(el);
    }
    // Prefer one that's playing, has a real frame, and >0 size.
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

  async function togglePip() {
    var v = pickActiveVideo();
    if (!v) return;
    // Belt-and-suspenders unblock — even though the chrome module no
    // longer disables PiP at init, third-party code might.
    try { v.disablePictureInPicture = false; } catch (_e) {}
    try { v.removeAttribute("disablePictureInPicture"); } catch (_e) {}
    // controlslist also includes "nofullscreen" / "noplaybackrate" but
    // not a PiP-block, so leave it alone.
    try {
      // Already PiP'd — exit.
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      if (v.webkitPresentationMode === "picture-in-picture" &&
          typeof v.webkitSetPresentationMode === "function") {
        v.webkitSetPresentationMode("inline");
        return;
      }
      // Make sure there's a frame to send. Safari refuses PiP on a
      // paused/no-frame video and silently shows black.
      if (v.readyState < 2) {
        try { v.load(); } catch (_e) {}
      }
      if (v.paused) {
        try { await v.play(); } catch (_e) {}
      }
      // Prefer the modern API on every browser that has it (incl. Safari
      // 13+). Only fall through to webkitSetPresentationMode if standard
      // PiP isn't available.
      if (typeof v.requestPictureInPicture === "function") {
        await v.requestPictureInPicture();
        return;
      }
      if (typeof v.webkitSetPresentationMode === "function") {
        v.webkitSetPresentationMode("picture-in-picture");
        return;
      }
    } catch (err) {
      console.info("[cssos-pip] toggle failed:", err && err.name ? err.name : err);
    }
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
    // ⊞ glyph reads as "split-out window" cross-browser. SVG would be
    // crisper but adds noise; the existing fr-btn cluster uses simple
    // characters (i / ⛶) so we match that vibe.
    btn.textContent = "⊞";
    btn.style.cssText =
      // Existing cluster occupies right:14 (⛶) / 68 (i) / 120 (♪×) / 172 (stem).
      // Pin past 172 with a 54px stride so we don't collide.
      "right:226px;font-size:18px;";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      void togglePip();
    });
    screen.appendChild(btn);

    // Reflect PiP state in the button's tinting so the user sees on/off.
    var v = document.getElementById("watch-video");
    if (v) {
      // Pre-clear the chrome-module's PiP block so the first PiP request
      // already has frames flowing — without this the first click opens
      // a black PiP window and only subsequent toggles work.
      try { v.disablePictureInPicture = false; } catch (_e) {}
      var sync = function () {
        var on =
          document.pictureInPictureElement === v ||
          v.webkitPresentationMode === "picture-in-picture";
        btn.classList.toggle("is-on", !!on);
      };
      v.addEventListener("enterpictureinpicture", sync);
      v.addEventListener("leavepictureinpicture", sync);
      // Safari path
      v.addEventListener("webkitpresentationmodechanged", sync);
      sync();
    }
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
    ensureButton();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // Re-attach if the watch frame gets rebuilt.
  if (document.body) {
    new MutationObserver(function () {
      ensureButton();
    }).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosPip = { toggle: togglePip, supported: isPipSupported };
})();
