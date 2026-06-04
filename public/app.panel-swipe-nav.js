/* CSSOS_WAVE_445 20260526 — Jing
 * "左右滑动切换面板"
 *
 * Horizontal swipe anywhere on the viewport navigates between the
 * main content panels in dock order — same as tapping adjacent dock
 * items. Vertical swipe is untouched (Watch panel keeps its TikTok
 * song-advance gesture; other panels keep their native scroll).
 *
 * Rules:
 *   • Swipe must be clearly horizontal: |dx| ≥ 60px AND |dx| ≥ 2×|dy|.
 *   • Ignore touches that start inside a horizontally-scrollable
 *     element (scrollWidth > clientWidth + 4), an <input>, <textarea>,
 *     <select>, or a slider/range — those need their own h-scroll.
 *   • Only cycle through "content" dock panels; skip utility/admin
 *     panels (settings, login, profile, language, …).
 *   • Swipe RIGHT  → previous panel in dock order (left neighbor).
 *     Swipe LEFT   → next panel in dock order (right neighbor).
 *   • Wraps around: swiping left from the last panel goes to the first.
 *   • Shows a brief swipe-hint chip so the gesture feels responsive.
 */
(function () {
  "use strict";
  if (globalThis.__cssosSwipeNavInstalled) return;
  globalThis.__cssosSwipeNavInstalled = true;

  /* Panels that are purely utility / admin — never part of the swipe
   * cycle even if they have a dock item.                              */
  const SKIP_ACTIONS = new Set([
    "settings", "login", "passkey", "profile", "language",
    "notifications", "credit", "subscription", "workspaces",
    "user-admin", "delivery-ops", "system-mvs", "reports",
    "api", "about", "engines", "seller", "mic",
  ]);

  /* ── helpers ─────────────────────────────────────────────────── */

  function getDockOrder() {
    /* Return dock actions in current DOM order, skipping utility panels.
     * We intentionally do NOT check visibility — the dock is hidden when
     * the Watch panel is fullscreen, but its item order still defines the
     * canonical panel sequence for swipe navigation.                     */
    const items = document.querySelectorAll("#dock [data-pill-key][data-action]");
    const order = [];
    items.forEach((el) => {
      const action = el.getAttribute("data-action");
      if (!action) return;
      if (SKIP_ACTIONS.has(action)) return;
      // Skip items explicitly hidden via [hidden] attribute
      if (el.hidden) return;
      if (!order.includes(action)) order.push(action);
    });
    return order;
  }

  function getCurrentAction() {
    /* Which dock action owns the current front panel?
     * Strategy: find the panel with class "panel-front" (highest z-index
     * winner set by focusPanelBridge) and match it back to a dock action
     * via data-panel-action or panel id conventions.                    */
    const front = document.querySelector(".panel.panel-front");
    if (!front) return null;
    const id = front.id || "";

    // Direct mapping: panel id → dock action
    const ID_TO_ACTION = {
      "watch-panel":        "watch",
      "foryou-panel":       "foryou",
      "cssmv-panel":        "cssmv",
      "lyrics-panel":       "lyrics",
      "music-panel":        "music",
      "video-panel":        "video",
      "mv-pipeline-panel":  "mv-pipeline",
      "works-panel":        "works",
      "person-mv-panel":    "person-mv",
      "logo-panel":         "foryou",   // home → treat as foryou slot
    };
    return ID_TO_ACTION[id] || id.replace(/-panel$/, "") || null;
  }

  function activateAction(action) {
    // CSSOS_WAVE_496 20260529 — Jing: use the FULL dock handler so ANY panel
    // (content panels included) opens/switches. Already-open → brought to front;
    // not-open → launched. handleDockActionDirect only covered a few utility
    // panels (content actions returned false → nothing happened); el.click()
    // fallback was unreliable against the dock's pointer-event handlers.
    if (typeof globalThis.handleDockAction === "function") {
      globalThis.handleDockAction(action, "click");
      return;
    }
    if (typeof globalThis.handleDockActionDirect === "function") {
      globalThis.handleDockActionDirect(action, "click");
      return;
    }
    const el = document.querySelector(`[data-action="${action}"]`);
    el?.click();
  }

  /* ── swipe-hint chip ─────────────────────────────────────────── */

  let chipTimer = null;

  function showSwipeChip(direction, targetAction) {
    let chip = document.getElementById("cssos-swipe-nav-chip");
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "cssos-swipe-nav-chip";
      Object.assign(chip.style, {
        position:       "fixed",
        top:            "50%",
        transform:      "translateY(-50%)",
        padding:        "8px 18px",
        borderRadius:   "999px",
        background:     "rgba(0,245,160,0.18)",
        border:         "1px solid rgba(0,245,160,0.45)",
        color:          "rgba(0,245,160,0.95)",
        fontSize:       "13px",
        fontWeight:     "600",
        pointerEvents:  "none",
        zIndex:         "99999",
        transition:     "opacity 0.25s",
        backdropFilter: "blur(8px)",
        whiteSpace:     "nowrap",
      });
      document.body.appendChild(chip);
    }
    const arrow = direction === "left" ? "→" : "←";
    chip.textContent = `${arrow} ${targetAction}`;
    chip.style.opacity = "1";
    chip.style.left  = direction === "left" ? "auto" : "24px";
    chip.style.right = direction === "left" ? "24px" : "auto";
    clearTimeout(chipTimer);
    chipTimer = setTimeout(() => {
      chip.style.opacity = "0";
    }, 600);
  }

  /* ── touch tracking ──────────────────────────────────────────── */

  let tx0 = null, ty0 = null;

  function isHScrollable(el) {
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      const overflow = style.overflowX;
      if ((overflow === "auto" || overflow === "scroll") &&
          el.scrollWidth > el.clientWidth + 4) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function isInputElement(el) {
    const tag = el?.tagName?.toLowerCase?.() || "";
    if (["input", "textarea", "select"].includes(tag)) return true;
    if (el?.closest?.("input, textarea, select, [role='slider']")) return true;
    return false;
  }

  document.addEventListener("touchstart", (ev) => {
    const t = ev.touches?.[0];
    if (!t) return;
    // Ignore multi-touch
    if (ev.touches.length > 1) { tx0 = null; return; }
    // Ignore touches on input elements
    if (isInputElement(ev.target)) { tx0 = null; return; }
    // Ignore touches on horizontally scrollable containers
    if (isHScrollable(ev.target)) { tx0 = null; return; }
    tx0 = t.clientX;
    ty0 = t.clientY;
  }, { passive: true });

  document.addEventListener("touchend", (ev) => {
    if (tx0 === null) return;
    const t = ev.changedTouches?.[0];
    if (!t) { tx0 = null; return; }
    const dx = t.clientX - tx0;
    const dy = t.clientY - ty0;
    tx0 = null;
    ty0 = null;

    // Must be clearly horizontal
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dx) < Math.abs(dy) * 2) return;

    const order = getDockOrder();
    if (order.length < 2) return;

    const current = getCurrentAction();
    let idx = current ? order.indexOf(current) : -1;
    if (idx < 0) idx = 0;

    // Swipe LEFT → advance (next panel in dock, wraps)
    // Swipe RIGHT → go back (prev panel, wraps)
    const nextIdx = dx < 0
      ? (idx + 1) % order.length
      : (idx - 1 + order.length) % order.length;

    const nextAction = order[nextIdx];
    if (!nextAction || nextAction === current) return;

    showSwipeChip(dx < 0 ? "left" : "right", nextAction);
    activateAction(nextAction);
  }, { passive: true });

  console.info(
    "%c[panel-swipe-nav] Wave 445 installed — horizontal swipe cycles panels",
    "color:#0a0;font-weight:bold",
  );
})();
