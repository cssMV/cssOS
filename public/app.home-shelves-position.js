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
    /* CSSOS_HOME_SHELVES_ANCHOR_FIX 20260508 — Jing
     * Earlier version moved shelves to BODY start which shoved them
     * before the topbar. Anchor inside <main> instead so panels stay
     * properly layered and shelves flow with the rest of the home
     * surface. Also drop position:relative + z-index so cards don't
     * overlay other panels' click areas. */
    var anchor = document.querySelector("main") || document.body;
    shelves.style.position = "static";
    shelves.style.zIndex = "auto";
    shelves.style.marginTop = "16px";
    shelves.style.marginBottom = "16px";
    if (isDockTop) {
      /* Dock at top: shelves go LAST inside main */
      if (anchor.lastElementChild !== shelves) {
        anchor.appendChild(shelves);
      }
    } else {
      /* Dock at bottom (default): shelves go FIRST inside main, after
       * the logo-panel section (i.e. as second child if logo-panel is
       * first). Find the logo-panel and insert just after it. */
      var logoPanel = document.getElementById("logo-panel");
      if (logoPanel && logoPanel.parentNode === anchor && logoPanel.nextElementSibling !== shelves) {
        if (logoPanel.nextSibling) {
          anchor.insertBefore(shelves, logoPanel.nextSibling);
        } else {
          anchor.appendChild(shelves);
        }
      } else if (anchor.firstElementChild !== shelves) {
        anchor.insertBefore(shelves, anchor.firstElementChild);
      }
    }

    /* Position the 🏆 leaderboard pill: when dock at bottom, pill goes
     * BEFORE the first shelf (top of stack). When dock at top, pill goes
     * AFTER the last shelf (bottom of stack). */
    if (pill) {
      /* Pill is a flex child of a flex-column container — by default it
       * stretches to full width. Constrain to inline-block sizing so it
       * sits at its natural pill width (not banner-wide). */
      pill.style.alignSelf = "flex-start";
      pill.style.flex = "0 0 auto";
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
