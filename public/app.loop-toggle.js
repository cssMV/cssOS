/* CSSOS_LOOP_TOGGLE 20260506 — Jing
 *
 * One-tap "play on repeat" for the MV — the music-video equivalent of
 * pinning a track. ⟳ button in the cluster, persisted across sessions.
 *
 * Storage: localStorage.cssos_mv_loop = "1" | "0".
 *
 * Implementation: sets el.loop = true on watch-video and
 * watch-audio-preview. Browsers handle the actual seek-to-zero on end
 * natively — no manual ended handler needed.
 */
(function () {
  "use strict";

  var KEY = "cssos_mv_loop";

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("zh") === 0 && zh) return zh;
    return en;
  }

  function readLoop() { return localStorage.getItem(KEY) === "1"; }
  function writeLoop(on) {
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (_e) {}
  }

  function applyLoop(on) {
    ["watch-video", "watch-audio-preview"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        try { el.loop = !!on; } catch (_e) {}
      }
    });
  }

  function ensureStyles() {
    if (document.getElementById("cssos-loop-style")) return;
    var s = document.createElement("style");
    s.id = "cssos-loop-style";
    s.textContent =
      ".cssmv-loop-btn.is-on{color:#001b14 !important;background:rgba(0,245,160,0.85) !important;}" +
      // Narrow viewports (phones in portrait) only have room for the
      // existing 4-button row. Hide the pip/speed/loop trio rather
      // than letting them clip off-screen.
      "@media (max-width:720px){" +
      ".cssmv-pip-btn,.cssmv-speed-btn,.cssmv-loop-btn{display:none !important;}" +
      "}";
    document.head.appendChild(s);
  }

  function ensureButton() {
    var screen = document.querySelector("#watch-panel .watch-screen");
    if (!screen) return null;
    var existing = screen.querySelector(".cssmv-loop-btn");
    if (existing) return existing;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cssmv-fr-btn cssmv-loop-btn";
    btn.setAttribute("aria-label", tt("Loop", "循环"));
    btn.title = tt("Loop", "循环");
    btn.textContent = "⟳";
    // Cluster lineup (right-edge, bottom). Existing 14/68/120/172 are
    // owned by ⛶/i/♪×/stem respectively. Our buttons stride 54px past
    // 172 so we share the row cleanly:
    //   14  — ⛶ fullscreen     (existing)
    //   68  — i info           (existing)
    //   120 — ♪× style shift   (existing)
    //   172 — stem toggle      (existing)
    //   226 — ⊞ pip
    //   280 — ×× speed
    //   334 — ⟳ loop
    btn.style.cssText = "right:334px;font-size:16px;";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var next = !readLoop();
      writeLoop(next);
      applyLoop(next);
      btn.classList.toggle("is-on", next);
    });
    screen.appendChild(btn);
    if (readLoop()) btn.classList.add("is-on");
    return btn;
  }

  function bindMedia(el) {
    if (!el || el.dataset.cssosLoopBound === "1") return;
    el.dataset.cssosLoopBound = "1";
    var apply = function () { applyLoop(readLoop()); };
    apply();
    el.addEventListener("loadedmetadata", apply, { passive: true });
  }

  function init() {
    ensureStyles();
    ensureButton();
    bindMedia(document.getElementById("watch-video"));
    bindMedia(document.getElementById("watch-audio-preview"));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(function () {
      ensureButton();
      bindMedia(document.getElementById("watch-video"));
      bindMedia(document.getElementById("watch-audio-preview"));
    }).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosLoop = {
    get: readLoop,
    set: function (on) { writeLoop(!!on); applyLoop(!!on); var b = document.querySelector(".cssmv-loop-btn"); if (b) b.classList.toggle("is-on", !!on); },
  };
})();
