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
      // CSSOS_WAVE_295 20260521 — Jing: 之前窄屏(<480)直接 display:none 把
      // ⊞/1×/⟳ 藏了, 且桌面 54px 间距在手机放不下会折成两行. 现在改为: 移动端
      // 不隐藏, 而是【缩小按钮 + 收紧间距】让 ✦/⊞/1×/⟳ 挤进一行(和桌面一致一排),
      // 全部钉在 bottom:14px 同一行. 覆写各自的内联 right 偏移(!important).
      "@media (max-width:480px){" +
      "#watch-panel .cssmv-fr-btn,#watch-panel #watch-style-shift{" +
      "width:34px !important;height:34px !important;font-size:14px !important;bottom:14px !important;display:flex !important;align-items:center;justify-content:center;}" +
      "#watch-panel #watch-style-shift{right:56px !important;}" +
      "#watch-panel .cssmv-pip-btn{right:98px !important;}" +
      "#watch-panel .cssmv-speed-btn{right:140px !important;}" +
      "#watch-panel .cssmv-loop-btn{right:182px !important;}" +
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
