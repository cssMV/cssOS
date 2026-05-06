/* CSSOS_DOCK_NOW_PLAYING 20260506 — Jing
 *
 * When the MV panel is minimized to the dock, mark its dock icon
 * (`.dock-item[data-action="watch"]`) as "now playing":
 *   - emerald dot pulses on the icon
 *   - hover tooltip shows the current work title
 *   - on click, the panel un-minimizes (existing dock click handler)
 *
 * Lets the user collapse the MV out of view but still see at-a-glance
 * that audio is still rolling — same affordance the dock has on macOS
 * for any media app, surfaced with a per-MV title hint.
 *
 * Public API: cssosDockNowPlaying.refresh().
 */
(function () {
  "use strict";

  function readWorkTitle() {
    var bar = document.getElementById("watch-panel");
    if (bar) {
      var inline = bar.querySelector(".panel-title");
      if (inline && inline.textContent) {
        var t = String(inline.textContent).trim();
        if (t && t.toUpperCase() !== "MV PANEL" && t.toUpperCase() !== "WATCH") return t;
      }
    }
    var fromGlobal =
      (globalThis.currentWatchPreviewWork && globalThis.currentWatchPreviewWork.title) ||
      (globalThis.cssmvPipelineLastResult && globalThis.cssmvPipelineLastResult.title) ||
      "";
    return String(fromGlobal || "").trim();
  }

  function isPlaying() {
    var v = document.getElementById("watch-video");
    if (v && !v.paused && !v.ended && v.readyState >= 2) return true;
    var a = document.getElementById("watch-audio-preview");
    if (a && !a.paused && !a.ended && a.readyState >= 2) return true;
    return false;
  }

  function isWatchPanelHidden() {
    var p = document.getElementById("watch-panel");
    return !!(p && (p.classList.contains("hidden") || p.dataset.minimized === "true"));
  }

  function ensureStyles() {
    if (document.getElementById("cssos-dock-now-playing-style")) return;
    var s = document.createElement("style");
    s.id = "cssos-dock-now-playing-style";
    s.textContent =
      ".dock-item[data-cssos-now-playing='1']{position:relative;}" +
      ".dock-item[data-cssos-now-playing='1']::after{" +
      "content:'';position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:50%;" +
      "background:#00f5a0;box-shadow:0 0 0 0 rgba(0,245,160,0.65);" +
      "animation:cssos-dock-pulse 1.6s ease-out infinite;pointer-events:none;z-index:5;}" +
      ".dock-item[data-cssos-now-playing='1'].is-paused::after{" +
      "background:rgba(218,255,238,0.6);animation:none;}" +
      "@keyframes cssos-dock-pulse{" +
      "0%{box-shadow:0 0 0 0 rgba(0,245,160,0.65);}" +
      "70%{box-shadow:0 0 0 12px rgba(0,245,160,0);}" +
      "100%{box-shadow:0 0 0 0 rgba(0,245,160,0);}}";
    document.head.appendChild(s);
  }

  function refresh() {
    var item = document.querySelector('.dock-item[data-action="watch"]');
    if (!item) return;
    ensureStyles();

    var minimized = isWatchPanelHidden();
    var title = readWorkTitle();
    var hasMedia = !!title;
    var playing = isPlaying();

    if (minimized && hasMedia) {
      item.dataset.cssosNowPlaying = "1";
      item.classList.toggle("is-paused", !playing);
      // Tooltip via title attribute — works on every browser without
      // needing a custom popover.
      var tip = (playing ? "▶ " : "❚❚ ") + title;
      if (item.getAttribute("title") !== tip) item.setAttribute("title", tip);
    } else {
      item.dataset.cssosNowPlaying = "";
      item.classList.remove("is-paused");
      if (item.getAttribute("title")) item.removeAttribute("title");
    }
  }

  function bindMedia(el) {
    if (!el || el.dataset.cssosDockNpBound === "1") return;
    el.dataset.cssosDockNpBound = "1";
    ["play", "playing", "pause", "ended", "emptied", "loadedmetadata"].forEach(function (ev) {
      el.addEventListener(ev, refresh, { passive: true });
    });
  }

  function init() {
    var v = document.getElementById("watch-video");
    var a = document.getElementById("watch-audio-preview");
    if (v) bindMedia(v);
    if (a) bindMedia(a);
    var wp = document.getElementById("watch-panel");
    if (wp && wp.dataset.cssosDockNpWPBound !== "1") {
      wp.dataset.cssosDockNpWPBound = "1";
      new MutationObserver(refresh).observe(wp, {
        attributes: true,
        attributeFilter: ["class", "data-minimized"],
      });
    }
    refresh();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(function () {
      bindMedia(document.getElementById("watch-video"));
      bindMedia(document.getElementById("watch-audio-preview"));
      refresh();
    }).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosDockNowPlaying = { refresh: refresh };
})();
