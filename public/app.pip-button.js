/* CSSOS_PIP_BUTTON 20260506 — Jing
 *
 * Picture-in-Picture toggle for the MV cluster. Direct mode — we PiP
 * the active <video> element itself. The shadow-video experiment
 * regressed clickability, so we're back to the simple path with all
 * the unblock fixes:
 *   - app.watch-media-chrome.js no longer sets disablePictureInPicture
 *   - we belt-and-suspenders flip it to false on bind + on each click
 *   - we wait for readyState >= 2 and play() before requestPictureInPicture
 *   - we pick the actually-playing <video> in case multiple exist
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
    var probe = document.createElement("video");
    if (typeof probe.requestPictureInPicture === "function" && document.pictureInPictureEnabled !== false) return true;
    if (typeof probe.webkitSupportsPresentationMode === "function" && probe.webkitSupportsPresentationMode("picture-in-picture")) return true;
    return false;
  }

  function pickActiveVideo() {
    var primary = document.getElementById("watch-video");
    var candidates = primary ? [primary] : [];
    var all = document.querySelectorAll("video");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
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

  async function togglePip() {
    var v = pickActiveVideo();
    if (!v) return;
    try { v.disablePictureInPicture = false; } catch (_e) {}
    try { v.removeAttribute("disablePictureInPicture"); } catch (_e) {}
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      if (v.webkitPresentationMode === "picture-in-picture" &&
          typeof v.webkitSetPresentationMode === "function") {
        v.webkitSetPresentationMode("inline");
        return;
      }
      if (v.readyState < 2) {
        try { v.load(); } catch (_e) {}
      }
      if (v.paused) {
        try { await v.play(); } catch (_e) {}
      }
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
    btn.textContent = "⊞";
    btn.style.cssText = "right:226px;font-size:18px;";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      void togglePip();
    });
    screen.appendChild(btn);

    var v = document.getElementById("watch-video");
    if (v) {
      try { v.disablePictureInPicture = false; } catch (_e) {}
      var sync = function () {
        var on =
          document.pictureInPictureElement === v ||
          v.webkitPresentationMode === "picture-in-picture";
        btn.classList.toggle("is-on", !!on);
      };
      v.addEventListener("enterpictureinpicture", sync);
      v.addEventListener("leavepictureinpicture", sync);
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
  if (document.body) {
    new MutationObserver(function () {
      ensureButton();
    }).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosPip = { toggle: togglePip, supported: isPipSupported };
})();
