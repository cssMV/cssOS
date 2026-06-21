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

  /* Safari ships TWO PiP APIs:
   *   - the standard one (requestPictureInPicture / pictureInPictureElement)
   *   - the older proprietary one (webkitSetPresentationMode)
   * The standard API on Safari has a long-standing bug where the PiP
   * window opens with controls but paints black for videos whose <src>
   * was set via JS after page load (which is exactly our flow). The
   * proprietary API is the one Safari's own engineers test and ships
   * frames reliably. So on Safari, prefer the webkit path. Other
   * browsers (Chrome / Firefox / Edge) only have the standard API. */
  var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  async function togglePip() {
    var v = pickActiveVideo();
    if (!v) return;
    try { v.disablePictureInPicture = false; } catch (_e) {}
    try { v.removeAttribute("disablePictureInPicture"); } catch (_e) {}
    try {
      // Already PiP'd → exit on either API path.
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      if (typeof v.webkitSetPresentationMode === "function" &&
          v.webkitPresentationMode === "picture-in-picture") {
        v.webkitSetPresentationMode("inline");
        return;
      }
      // Make sure there's a frame for Safari's compositor to send.
      if (v.readyState < 2) {
        try { v.load(); } catch (_e) {}
      }
      if (v.paused) {
        try { await v.play(); } catch (_e) {}
      }
      // Nudge the decoder so the next frame is ready — Safari sometimes
      // PiP's a stale CALayer that never repaints if we request right
      // after src change. A tiny seek forces a fresh frame decode.
      try {
        var t = v.currentTime;
        v.currentTime = Math.max(0, t - 0.001);
        v.currentTime = t;
      } catch (_e) {}
      // Diagnostic for PiP regressions — log which API + element we're
      // using so the user can paste back what they see in the console
      // if PiP shows black again. Cheap, info-level only.
      console.info("[cssos-pip] enter →", {
        api: isSafari ? "webkitSetPresentationMode" : "requestPictureInPicture",
        videoId: v.id,
        readyState: v.readyState,
        videoSize: v.videoWidth + "x" + v.videoHeight,
        currentTime: v.currentTime,
        paused: v.paused,
        muted: v.muted,
        srcLen: String(v.currentSrc || v.src || "").length,
      });
      if (isSafari && typeof v.webkitSetPresentationMode === "function") {
        v.webkitSetPresentationMode("picture-in-picture");
        return;
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
    // CSSOS_WAVE_920 20260617 — Jing「特斯拉右下角 AI 助理旁边那个暗方块」: 那是画中画
    // (PiP)按钮 cssmv-pip-btn(图标 ⊞), 沉浸 MV + 独立音轨场景下无用, 还在 AI 胶囊旁
    // 像残留垃圾。彻底停止创建(所有端: init + MutationObserver 两条路都从这里返回)。
    // 旧端缓存到新 bundle 后即消失。保留 globalThis.cssosPip 桩防跨文件引用报错。
    return null;
    // eslint-disable-next-line no-unreachable
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

  function removeExistingButtons() {
    // CSSOS_WAVE_920 — 清掉任何已挂的 PiP 按钮(旧 DOM/缓存遗留)。
    try {
      document.querySelectorAll(".cssmv-pip-btn").forEach(function (b) { b.remove(); });
    } catch (_e) {}
  }
  function init() {
    removeExistingButtons();
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
