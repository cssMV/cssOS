/* CSSOS_WAVE_108B_DOCK_PRIORITY 20260509 — Jing
 *
 * Pin the two most-used panels to the front of the dock:
 *   position 1: MV Pipeline (data-action="cssmv")
 *   position 2: Person MV   (data-action="person-mv")
 *
 * Why: drag-reorder didn't survive page reloads for dynamically
 * injected items (per Jing), and these two are the primary entry
 * points to creation + curation. Late positions get clipped on
 * narrow viewports, so prominence matters.
 *
 * Implementation: a MutationObserver watches the dock for new
 * children and re-asserts the priority order. Cheap (O(items) on
 * each mutation) and safe — repeated reorders are no-ops once the
 * desired sequence is in place.
 *
 * Loaded after the dock HTML and after app.person-mv-panel.js so
 * both items exist by the time we run.
 */
(function () {
  "use strict";

  var PRIORITY = ["cssmv", "person-mv"];
  var dock = null;
  var settling = false;

  function ensureOrder() {
    if (settling) return;
    if (!dock) {
      dock = document.querySelector(".dock");
      if (!dock) return;
    }
    var items = Array.prototype.slice.call(dock.querySelectorAll('[data-pill-key]'));
    if (!items.length) return;

    /* Build a quick lookup of action → element. */
    var byAction = {};
    items.forEach(function (el) {
      var act = el.getAttribute("data-action");
      if (act && !byAction[act]) byAction[act] = el;
    });

    /* For each priority action, if it exists and isn't already at
     * the head in the right order, move it. */
    settling = true;
    try {
      // Reverse-iterate so we always insert before the current first child.
      // After: [cssmv, person-mv, ...rest]
      for (var i = PRIORITY.length - 1; i >= 0; i -= 1) {
        var act = PRIORITY[i];
        var el = byAction[act];
        if (!el) continue;
        if (dock.firstChild === el) continue;
        // Avoid moving if already in correct slot relative to others.
        var currentIdx = items.indexOf(el);
        if (currentIdx === i) continue;
        dock.insertBefore(el, dock.firstChild);
      }
    } finally {
      settling = false;
    }
  }

  function start() {
    dock = document.querySelector(".dock");
    if (!dock) return;
    ensureOrder();

    /* Observe future additions / re-insertions. The dock-order
     * module may shuffle on user drag — we honor user drags but
     * re-pin on inserts of new dynamic items. To avoid fighting
     * with intentional drags we ONLY reorder when (a) we see a
     * NEW node added or (b) PRIORITY items are missing from the
     * head. */
    var mo = new MutationObserver(function (mutations) {
      var sawAddition = false;
      for (var i = 0; i < mutations.length; i += 1) {
        if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
          sawAddition = true;
          break;
        }
      }
      if (sawAddition) ensureOrder();
    });
    mo.observe(dock, { childList: true });

    /* Also re-check after late dynamic injectors finish — Person MV
     * sets up via setInterval so it may insert ~2-5s after load. */
    var settles = [400, 1500, 4000, 8000];
    settles.forEach(function (ms) { setTimeout(ensureOrder, ms); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
