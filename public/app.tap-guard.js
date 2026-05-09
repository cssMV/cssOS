/* CSSOS_WAVE_108_TAP_GUARD 20260509 — Jing
 *
 * Global tap-vs-swipe discrimination, the same logic that fixed the
 * dock in Wave 107B but exposed as a one-liner any panel/component
 * can opt in to:
 *
 *   cssosTapGuard.bind(element, () => doThing());
 *
 * What it solves:
 *   Touch screens (iOS/Android) and trackpads emit a `click` at the
 *   end of a swipe gesture if the lift point is close enough to the
 *   touch-down point. Tabs, cards, pills inside horizontally
 *   scrollable rows ALWAYS hit this — user swipes to scroll, finger
 *   pads up, browser fires click on whatever was under the lift,
 *   user gets navigated somewhere they didn't ask for.
 *
 * Defenses (all combined):
 *   1. SWIPE_THRESHOLD_PX (26) — pointermove that travels > 26px from
 *      pointerdown is a swipe; click is suppressed.
 *   2. MIN_TAP_MS (60) — pointer cycles faster than 60ms are
 *      finger-brushes during a sweep; click is suppressed.
 *   3. SCROLL_GUARD — if any ancestor scrollLeft/scrollTop changed
 *      during the press, suppress.
 *   4. WHEEL_GUARD — wheel events anywhere over the bound element or
 *      its scroll-parent arm a 220ms suppress window (kills the
 *      synthetic click at the end of trackpad inertia).
 *   5. POINTER_CANCEL — browser-issued cancel (scroll stole the
 *      pointer) → suppress.
 *
 * Usage:
 *   cssosTapGuard.bind(myButton, (event) => { ... });
 *   // To unbind:
 *   const off = cssosTapGuard.bind(...); off();
 *
 *   // Or on a whole container delegating to children:
 *   cssosTapGuard.bindDelegated(container, '[data-tab]', (target, event) => {
 *     const tab = target.getAttribute('data-tab');
 *     ...
 *   });
 *
 * Why a global utility instead of per-component fixes:
 *   - One place to tune thresholds.
 *   - Every new component picks it up for free.
 *   - Removes ~60 LOC of pointer-event boilerplate from each panel.
 *
 * This file declares window.cssosTapGuard. Load order: anywhere
 * before the panels that consume it. Stateless module-level config —
 * loading twice is a no-op.
 */
(function () {
  "use strict";
  if (globalThis.cssosTapGuard && globalThis.cssosTapGuard.__v >= 1) return;

  // Tuning constants — surfaced via cssosTapGuard.config so a panel
  // with unusual UX requirements can override locally.
  const config = {
    SWIPE_THRESHOLD_PX: 26,
    MIN_TAP_MS: 60,
    LONGPRESS_MS: 500,           // not enforced here, just exposed
    WHEEL_SUPPRESS_MS: 220,
    SCROLL_DELTA_PX: 4,          // ancestor scroll change > 4px counts
  };

  // Global wheel watcher: any wheel over the document, on a scrollable
  // surface, arms a brief suppress on the closest tap-guarded element.
  let lastWheelAt = 0;
  document.addEventListener(
    "wheel",
    (event) => {
      try {
        if (
          Math.abs(event.deltaX) < config.SCROLL_DELTA_PX &&
          Math.abs(event.deltaY) < config.SCROLL_DELTA_PX
        ) return;
        lastWheelAt = Date.now();
      } catch (_) {}
    },
    { passive: true, capture: true },
  );

  function suppressedByRecentWheel() {
    return Date.now() - lastWheelAt < config.WHEEL_SUPPRESS_MS;
  }

  function getScrollSnapshot(el) {
    // Walk up to <html> capturing scroll positions. We compare these
    // at pointerup; if any ancestor scrolled during the press, it's
    // a swipe-scroll, not a tap.
    const snap = [];
    let node = el;
    while (node && node.nodeType === 1 && snap.length < 8) {
      try {
        snap.push({ node, l: node.scrollLeft, t: node.scrollTop });
      } catch (_) {}
      node = node.parentElement;
    }
    return snap;
  }

  function scrollChanged(snap) {
    for (const s of snap) {
      try {
        if (Math.abs(s.node.scrollLeft - s.l) > config.SCROLL_DELTA_PX) return true;
        if (Math.abs(s.node.scrollTop - s.t) > config.SCROLL_DELTA_PX) return true;
      } catch (_) {}
    }
    return false;
  }

  /** Bind tap-guarded "click" behavior to an element.
   *  Returns an unbind function. */
  function bind(el, onTap, opts) {
    if (!el || typeof onTap !== "function") return () => {};
    opts = opts || {};

    let activePointerId = null;
    let downAt = 0;
    let startX = 0;
    let startY = 0;
    let maxDist = 0;
    let suppressed = false;
    let scrollSnap = null;

    function onDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      activePointerId = event.pointerId;
      downAt = Date.now();
      startX = event.clientX;
      startY = event.clientY;
      maxDist = 0;
      suppressed = suppressedByRecentWheel();
      scrollSnap = getScrollSnapshot(el);
    }

    function onMove(event) {
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      const d = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (d > maxDist) maxDist = d;
      if (d >= config.SWIPE_THRESHOLD_PX) suppressed = true;
    }

    function onUp(event) {
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      const dur = Date.now() - downAt;
      activePointerId = null;
      if (suppressed) return;
      if (suppressedByRecentWheel()) return;
      if (maxDist >= config.SWIPE_THRESHOLD_PX) return;
      if (dur < config.MIN_TAP_MS) return;
      if (scrollSnap && scrollChanged(scrollSnap)) return;
      try { onTap(event); } catch (err) {
        try { console.error("[tap-guard] handler threw", err); } catch (_) {}
      }
    }

    function onCancel() {
      activePointerId = null;
      suppressed = true;
    }

    function onLeave() {
      // Pointer leaving the bound element while pressed = swipe-out.
      if (activePointerId !== null) suppressed = true;
    }

    // Swallow the synthetic click — we drive everything through pointerup.
    function onClick(event) {
      // If the user used keyboard (Enter/Space → click), let it through.
      if (event.detail === 0) return; // keyboard-synthesized click
      event.preventDefault();
      event.stopPropagation();
    }

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("click", onClick);

    // Keyboard accessibility — Enter / Space act as tap.
    function onKey(event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      try { onTap(event); } catch (err) {
        try { console.error("[tap-guard] handler threw", err); } catch (_) {}
      }
    }
    if (opts.keyboard !== false) {
      if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
      if (!el.hasAttribute("role")) el.setAttribute("role", "button");
      el.addEventListener("keydown", onKey);
    }

    return function unbind() {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("click", onClick);
      if (opts.keyboard !== false) el.removeEventListener("keydown", onKey);
    };
  }

  /** Delegated variant — bind once on the container, dispatch by selector. */
  function bindDelegated(container, selector, onTap, opts) {
    if (!container) return () => {};
    opts = opts || {};
    let activePointerId = null;
    let downAt = 0;
    let startX = 0;
    let startY = 0;
    let maxDist = 0;
    let suppressed = false;
    let downTarget = null;
    let scrollSnap = null;

    function findMatch(target) {
      if (!(target instanceof Element)) return null;
      return target.closest(selector);
    }

    function onDown(event) {
      const m = findMatch(event.target);
      if (!m) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      activePointerId = event.pointerId;
      downAt = Date.now();
      startX = event.clientX;
      startY = event.clientY;
      maxDist = 0;
      suppressed = suppressedByRecentWheel();
      downTarget = m;
      scrollSnap = getScrollSnapshot(m);
    }

    function onMove(event) {
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      const d = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (d > maxDist) maxDist = d;
      if (d >= config.SWIPE_THRESHOLD_PX) suppressed = true;
    }

    function onUp(event) {
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      const dur = Date.now() - downAt;
      activePointerId = null;
      const target = downTarget;
      downTarget = null;
      if (!target) return;
      if (suppressed) return;
      if (suppressedByRecentWheel()) return;
      if (maxDist >= config.SWIPE_THRESHOLD_PX) return;
      if (dur < config.MIN_TAP_MS) return;
      if (scrollSnap && scrollChanged(scrollSnap)) return;
      // Final check: lift point still inside the same target?
      const liftEl = document.elementFromPoint(event.clientX, event.clientY);
      if (!liftEl || !target.contains(liftEl)) return;
      try { onTap(target, event); } catch (err) {
        try { console.error("[tap-guard] delegated handler threw", err); } catch (_) {}
      }
    }

    function onCancel() {
      activePointerId = null;
      suppressed = true;
      downTarget = null;
    }

    function onClick(event) {
      const m = findMatch(event.target);
      if (!m) return;
      if (event.detail === 0) return;
      event.preventDefault();
      event.stopPropagation();
    }

    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onCancel);
    container.addEventListener("click", onClick);

    return function unbind() {
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onCancel);
      container.removeEventListener("click", onClick);
    };
  }

  globalThis.cssosTapGuard = {
    __v: 1,
    bind: bind,
    bindDelegated: bindDelegated,
    config: config,
    // Manual one-shot suppression for callers that just need to wait
    // out the wheel inertia (e.g. a programmatic focus call right
    // after a known scroll).
    armWheelSuppress: function () {
      lastWheelAt = Date.now();
    },
  };
})();
