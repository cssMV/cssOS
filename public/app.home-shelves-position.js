/* CSSOS_HOME_SHELVES_DOCK_AWARE 20260508 — Jing
 * Reposition discovery shelves based on dock position.
 *
 *   dock at bottom (or left/right, default) → shelves at TOP of viewport
 *     order: [🏆 leaderboard pill] → [festival] → [hot] → [groups] → [style] → [today]
 *
 *   dock at top → shelves at BOTTOM of viewport
 *     order: [festival] → [hot] → [groups] → [style] → [today] → [🏆 leaderboard pill]
 *
 * Implementation: watches `dock.dataset.dockPosition` via MutationObserver
 * + initial DOM-ready snapshot. Moves the #cssos-home-shelves wrapper and
 * #person-mv-leaderboard-cta pill in/out of opposite ends of <body>. */
(function () {
  "use strict";
  var POS_ATTR = "data-dock-position";

  function getDock() {
    return document.querySelector(".dock") || document.getElementById("dock");
  }

  function getDockPosition() {
    var d = getDock();
    if (!d) return "bottom";
    return d.getAttribute(POS_ATTR) || d.dataset.dockPosition || "bottom";
  }

  function applyPosition() {
    var shelves = document.getElementById("cssos-home-shelves");
    if (!shelves) return;
    var pill = document.getElementById("person-mv-leaderboard-cta");
    var pos = getDockPosition();
    var isDockTop = pos === "top";

    /* Move shelves wrapper to body end (when dock-top) or start (else).
     * We anchor on a stable marker so multiple toggles don't churn. */
    var marker = document.getElementById("cssos-home-shelves-end-marker");
    if (!marker) {
      marker = document.createElement("div");
      marker.id = "cssos-home-shelves-end-marker";
      marker.style.cssText = "height:0;width:0;";
      document.body.appendChild(marker);
    }

    /* Wrapper styling: when dock at top, push shelves to bottom of
     * viewport with auto top margin. When dock not at top, top
     * placement uses default flow. */
    if (isDockTop) {
      shelves.style.marginTop = "auto";
      shelves.style.marginBottom = "16px";
      /* Move wrapper just before the end marker so it lives at body
       * end. parentNode.insertBefore is idempotent — no-op if already
       * in correct slot. */
      if (shelves.nextElementSibling !== marker) {
        marker.parentNode.insertBefore(shelves, marker);
      }
    } else {
      shelves.style.marginTop = "16px";
      shelves.style.marginBottom = "auto";
      /* Move to body start (before first child). */
      if (document.body.firstElementChild !== shelves) {
        document.body.insertBefore(shelves, document.body.firstElementChild);
      }
    }

    /* Position the 🏆 leaderboard pill: when dock at bottom, pill goes
     * BEFORE the first shelf (top of stack). When dock at top, pill goes
     * AFTER the last shelf (bottom of stack). */
    if (pill) {
      if (isDockTop) {
        if (shelves.lastElementChild !== pill) {
          shelves.appendChild(pill);
        }
      } else {
        if (shelves.firstElementChild !== pill) {
          shelves.insertBefore(pill, shelves.firstElementChild);
        }
      }
    }
  }

  function watch() {
    var d = getDock();
    if (!d) {
      /* Dock not yet rendered — retry in 500ms up to 10s. */
      var tries = 0;
      var iv = setInterval(function () {
        if (getDock() || tries++ > 20) {
          clearInterval(iv);
          watch();
          applyPosition();
        }
      }, 500);
      return;
    }
    applyPosition();
    try {
      var mo = new MutationObserver(function () { applyPosition(); });
      mo.observe(d, { attributes: true, attributeFilter: [POS_ATTR, "data-dock-position"] });
    } catch (_e) { /* fall back to periodic re-check */ }
    /* Also re-apply when leaderboard pill mounts asynchronously. */
    setTimeout(applyPosition, 1500);
    setTimeout(applyPosition, 4000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watch, { once: true });
  } else {
    watch();
  }
})();
