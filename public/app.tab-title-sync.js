/* CSSOS_TAB_TITLE_SYNC 20260506 — Jing
 *
 * Polish: keep document.title in sync with what the MV panel is doing.
 *
 *   playing  → "▶ <work title> · CSS Studio"
 *   paused   → "❚❚ <work title> · CSS Studio"
 *   idle     → "CSS Studio"
 *
 * The user can be on any tab and tell at a glance whether their MV is
 * still playing — same affordance every "real" streaming player has
 * (YouTube, Spotify, Netflix). No tracking, no notification permission
 * needed; just the titlebar.
 *
 * Watches the canonical <video id="watch-video"> for play / pause /
 * ended / loadedmetadata, and the watch-panel's `.hidden` class for
 * panel-close → reset. Falls back to the original title (read once at
 * boot) so refresh / first-load always start clean.
 *
 * Public API (rarely needed; this is mostly autonomous):
 *   globalThis.cssosTabTitle.setBaseTitle(s)
 *   globalThis.cssosTabTitle.refresh()
 */
(function () {
  "use strict";

  var BASE_TITLE = (document.title || "CSS Studio").trim() || "CSS Studio";
  var BRAND = "CSS Studio";

  function readWorkTitle() {
    // Prefer the watch-panel's title bar if present and not the placeholder.
    var bar = document.getElementById("watch-panel");
    if (bar) {
      var inline = bar.querySelector(".panel-title");
      if (inline && inline.textContent) {
        var t = String(inline.textContent).trim();
        // Skip the boot placeholder "MV Panel" / "WATCH" — not a work title.
        if (t && t.toUpperCase() !== "MV PANEL" && t.toUpperCase() !== "WATCH") {
          return t;
        }
      }
    }
    // Fallback: globals the watch-ui module keeps in sync.
    var fromGlobal = (globalThis.currentWatchPreviewWork && globalThis.currentWatchPreviewWork.title)
      || (globalThis.cssmvPipelineLastResult && globalThis.cssmvPipelineLastResult.title)
      || "";
    return String(fromGlobal || "").trim();
  }

  function isWatchPanelVisible() {
    var p = document.getElementById("watch-panel");
    return !!(p && !p.classList.contains("hidden") && p.dataset.minimized !== "true");
  }

  function isPlaying() {
    var v = document.getElementById("watch-video");
    if (v && !v.paused && !v.ended && v.readyState >= 2) return true;
    var a = document.getElementById("watch-audio-preview");
    if (a && !a.paused && !a.ended && a.readyState >= 2) return true;
    return false;
  }

  function compose(state, workTitle) {
    if (state === "idle" || !workTitle) return BASE_TITLE;
    var prefix = state === "playing" ? "▶ " : "❚❚ ";
    return prefix + workTitle + " · " + BRAND;
  }

  var lastApplied = "";
  function refresh() {
    var visible = isWatchPanelVisible();
    var workTitle = readWorkTitle();
    var state;
    if (!visible || !workTitle) state = "idle";
    else if (isPlaying()) state = "playing";
    else state = "paused";
    var next = compose(state, workTitle);
    if (next !== lastApplied) {
      document.title = next;
      lastApplied = next;
    }
  }

  function bindMedia(el) {
    if (!el || el.dataset.cssosTabTitleBound === "1") return;
    el.dataset.cssosTabTitleBound = "1";
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
    if (wp && wp.dataset.cssosTabTitleWPBound !== "1") {
      wp.dataset.cssosTabTitleWPBound = "1";
      new MutationObserver(refresh).observe(wp, {
        attributes: true,
        attributeFilter: ["class", "data-minimized"],
        subtree: false,
      });
      // Also watch the title node so re-renders update the tab.
      var titleNode = wp.querySelector(".panel-title");
      if (titleNode) {
        new MutationObserver(refresh).observe(titleNode, {
          characterData: true,
          subtree: true,
          childList: true,
        });
      }
    }
    refresh();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // re-bind when new media elements show up (watch-ui sometimes rebuilds them)
  if (document.body) {
    new MutationObserver(function () {
      var v = document.getElementById("watch-video");
      var a = document.getElementById("watch-audio-preview");
      if (v) bindMedia(v);
      if (a) bindMedia(a);
    }).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosTabTitle = {
    setBaseTitle: function (s) {
      BASE_TITLE = String(s || "CSS Studio").trim() || "CSS Studio";
      refresh();
    },
    refresh: refresh,
  };
})();
