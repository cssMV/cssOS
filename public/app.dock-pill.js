/* ═══════════════════════════════════════════════════════════════════════════
 * app.dock-pill.js — Dock Pill Bar Conversion
 * CSSOS_WAVE_464_DOCK_PILL 20260528 — Jing
 *
 * Converts the Dock from Apple-icon style to the chromatic 凸嵌凹 pill bar
 * system (v28 constitution). This is the DEFAULT; Apple-icon style is the
 * fallback (setting key `dock.style`: "pill" | "icon").
 *
 * What this file does:
 *   1. Stamps `data-pill-bar` + `data-pill-compact` on #dock.
 *      - Bottom/Top positions: standard horizontal pill bar.
 *      - Left/Right positions: adds `data-pill-vertical` for 90° geometry.
 *   2. Maps `data-action` on each .dock-item as the pill key (already present).
 *   3. Mic item: keeps `data-pill-hero` (already in HTML) so it protrudes.
 *   4. Syncs `.active` on the dock item whose panel is currently open/front,
 *      so the pill bar's active state matches reality.
 *   5. Implements `#dock-snap-ghost` — exact-dimension translucent ghost
 *      preview when the Dock is being dragged toward a screen edge.
 *   6. Exposes `cssosSetDockStyle("pill"|"icon")` and reads
 *      `cssos.dock.style` from localStorage on boot.
 *   7. Hooks into `openPanel` / `minimizeToDock` (already wrapped by
 *      app.panel-manager.js) via a `cssos:panelclose` listener and a
 *      post-openPanel observer to keep `.active` in sync.
 *
 * Dependencies:
 *   app.pill-bar.js     — cssosMakePillBar, cssosPillBarStamp, CSSOS_PILL_HUES
 *   app.panel-manager.js — openPanel/minimizeToDock wraps, cssos:panelclose
 *   app.js              — dock element, dockByPanel, handleDockAction, DOCK_POSITION
 * ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  if (globalThis.__cssosDockPillInstalled) return;
  globalThis.__cssosDockPillInstalled = true;

  /* ── Storage key ─────────────────────────────────────────────────────── */
  const STYLE_KEY   = "cssos.dock.style";   // "pill" | "icon"
  const DEFAULT_STYLE = "pill";

  /* ── Read saved style ────────────────────────────────────────────────── */
  function _readStyle() {
    try {
      const v = localStorage.getItem(STYLE_KEY);
      if (v === "icon" || v === "pill") return v;
    } catch (_) {}
    return DEFAULT_STYLE;
  }

  /* ── dockByPanel lookup (panel-id → action) ─────────────────────────── */
  /* app.js exposes this as a global at load time; we read it lazily.      */
  function _getDockByPanel() {
    return globalThis.dockByPanel || {};
  }

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function _getDock() {
    return document.getElementById("dock");
  }

  function _getPosition() {
    const dock = _getDock();
    return (dock && dock.dataset.dockPosition) || "bottom";
  }

  function _isVertical() {
    const pos = _getPosition();
    return pos === "left" || pos === "right";
  }

  /* ── Stamp / un-stamp pill bar on #dock ─────────────────────────────── */

  /**
   * Apply pill-bar data attributes to the dock.
   * Each .dock-item already has data-action which doubles as data-pill-key
   * (the pill-bar utility reads KEY_ATTRS which includes "data-action").
   */
  function _stampPillBar(dock) {
    dock.setAttribute("data-pill-bar", "");
    dock.setAttribute("data-pill-compact", "");
    if (_isVertical()) {
      dock.setAttribute("data-pill-vertical", "");
    } else {
      dock.removeAttribute("data-pill-vertical");
    }
    dock.removeAttribute("data-dock-icon-mode");
    dock.removeAttribute("data-pill-bar-stamped");

    if (typeof globalThis.cssosMakePillBar === "function") {
      globalThis.cssosMakePillBar(dock, {
        compact: true,
        textColor: "light",
        onActivate: function (key, pillEl) {
          // Get the data-action from the pill (may differ from pill key).
          var action = pillEl.getAttribute("data-action") || key;
          if (typeof globalThis.handleGlobalAction === "function") {
            globalThis.handleGlobalAction(action);
          }
        },
      });
    } else if (typeof globalThis.cssosPillBarStamp === "function") {
      globalThis.cssosPillBarStamp(dock);
    }
  }

  function _removePillBar(dock) {
    dock.removeAttribute("data-pill-bar");
    dock.removeAttribute("data-pill-compact");
    dock.removeAttribute("data-pill-vertical");
    dock.removeAttribute("data-pill-bar-stamped");
    dock.dataset.dockIconMode = "true";
    // Remove inline styles injected by the pill utility
    dock.style.removeProperty("--th");
    dock.querySelectorAll("[data-pill-key]").forEach((item) => {
      item.style.removeProperty("--ph");
      item.classList.remove("active");
    });
  }

  /* ── Active pill sync ────────────────────────────────────────────────── */

  /**
   * Scan all open (non-hidden) panels and mark the corresponding dock item
   * as `.active`. The frontmost panel (panel-front) gets priority — its
   * dock item is "most active". All others with open panels also get active.
   *
   * For the pill bar this drives the `--th` hue and convex shape.
   */
  function syncActiveItem() {
    const dock = _getDock();
    if (!dock) return;

    const dockByPanel = _getDockByPanel();

    // Find all open panels.
    const openActions = new Set();
    let frontAction = null;

    // Find the TRUE front panel = panel-front with the HIGHEST z-index.
    // Multiple panels can erroneously carry panel-front simultaneously;
    // z-index is the authoritative stacking signal.
    let topPanel = null;
    let topZ = -Infinity;

    document.querySelectorAll(".panel:not(.hidden)").forEach((panel) => {
      if (panel.id === "logo-panel") return;
      const action = dockByPanel[panel.id];
      if (action) openActions.add(action);
      if (panel.classList.contains("panel-front")) {
        const z = parseInt(panel.style.zIndex || getComputedStyle(panel).zIndex, 10) || 0;
        if (z > topZ) { topZ = z; topPanel = panel; }
      }
    });

    if (topPanel) {
      frontAction = dockByPanel[topPanel.id]
        || topPanel.dataset.panelAction
        || (topPanel.id || "").replace(/-panel$/, "");
    }

    // Fallback: no panel-front class found — use querySelector (first in DOM)
    if (!frontAction) {
      const front = document.querySelector(".panel.panel-front:not(.hidden)");
      if (front && front.id !== "logo-panel") {
        frontAction = dockByPanel[front.id]
          || front.dataset.panelAction
          || (front.id || "").replace(/-panel$/, "");
      }
    }

    // If no panel is open, mic is always the active pill.
    // (It already has class="active" in HTML; just ensure it's set.)
    if (!frontAction && openActions.size === 0) {
      _setDockActive(dock, "mic");
      return;
    }

    // Panels are open: update active to reflect front panel.
    // Clear first, then set.
    dock.querySelectorAll("[data-pill-key].active").forEach((el) => el.classList.remove("active"));
    openActions.forEach((action) => {
      if (action === frontAction) return;
      dock.querySelector(`[data-action="${action}"]`)?.classList.add("active");
    });
    if (frontAction) _setDockActive(dock, frontAction);
  }

  function _setDockActive(dock, action) {
    // Remove active from all, add to target, sync --th.
    dock.querySelectorAll("[data-pill-key].active").forEach((el) => el.classList.remove("active"));
    const item = dock.querySelector(`[data-action="${action}"]`);
    if (!item) return;
    item.classList.add("active");
    const hue = item.style.getPropertyValue("--ph");
    if (hue) dock.style.setProperty("--th", hue);
    // CSSOS_WAVE_487 20260529 — Jing「激活项跳到第一」(反悔了原地固定)。把当前
    // 前台激活的胶囊移到 dock 最前。只移动真正的前台项(_setDockActive 的目标),
    // 且已在首位时不动 → 避免 sync 反复触发时的无谓重排/抖动。不写入
    // localStorage(saveDockOrder), 纯视觉置顶, 用户的拖拽顺序仍是基准。
    const firstPill = dock.querySelector("[data-pill-key]");
    if (firstPill && firstPill !== item) {
      try { dock.insertBefore(item, dock.firstChild); } catch (_e) {}
    }
  }

  /* ── Direction change handler ─────────────────────────────────────────
   *
   * app.js fires `cssos:settingschange` on the document when dock position
   * changes. We listen and re-stamp with the new orientation.
   */
  function _onSettingsChange(ev) {
    const dock = _getDock();
    if (!dock) return;
    if (_readStyle() !== "pill") return;
    // Re-apply vertical flag based on new position.
    if (_isVertical()) {
      dock.setAttribute("data-pill-vertical", "");
    } else {
      dock.removeAttribute("data-pill-vertical");
    }
    // Re-stamp to recompute mask geometry direction.
    delete dock.dataset.pillBarStamped;
    dock.removeAttribute("data-pill-bar-stamped");
    if (typeof globalThis.cssosMakePillBar === "function") {
      globalThis.cssosMakePillBar(dock, { compact: true });
    }
  }

  /* ── Snap ghost (#dock-snap-ghost) ───────────────────────────────────── *
   *
   * The CLAUDE.md constitution requires that as the user drags the Dock
   * toward an edge, a ghost shows at the EXACT dimensions the Dock would
   * occupy after snap — same pill-bar shape, same border-radius, same width/
   * height. The ghost uses a dashed green outline on a very faint bg.
   *
   * We hook into the existing `showDockPreview` / `hideDockPreview` from
   * app.js by wrapping those globals.
   */

  function _ensureSnapGhost() {
    let ghost = document.getElementById("dock-snap-ghost");
    if (!ghost) {
      ghost = document.createElement("div");
      ghost.id = "dock-snap-ghost";
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:10019",
        "border-radius:999px",
        "outline:2px dashed rgba(0,245,160,0.55)",
        "background:rgba(0,245,160,0.07)",
        "transition:opacity 120ms ease,left 80ms ease,top 80ms ease,width 80ms ease,height 80ms ease",
        "opacity:0",
        "visibility:hidden",  /* belt-and-suspenders: never visible on init */
      ].join(";");
      document.body.appendChild(ghost);
    }
    return ghost;
  }

  /**
   * Compute the exact rect the Dock would occupy at the given position.
   * Mirrors `dockPreviewRect` in app.js but uses real dock measurements.
   */
  function _snapGhostRect(position) {
    const dock = _getDock();
    if (!dock) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Measure current dock scrollWidth/Height for accurate pill-bar size.
    const dockW = dock.scrollWidth || dock.offsetWidth || 320;
    const dockH = dock.offsetHeight || 60;

    const pad = 24; // edge gap
    if (position === "bottom") {
      const w = Math.min(dockW, vw - pad * 2);
      return { left: (vw - w) / 2, top: vh - dockH - pad, width: w, height: dockH };
    }
    if (position === "top") {
      const w = Math.min(dockW, vw - pad * 2);
      return { left: (vw - w) / 2, top: pad, width: w, height: dockH };
    }
    if (position === "left") {
      return { left: pad, top: (vh - dockW) / 2, width: dockH, height: Math.min(dockW, vh - pad * 2) };
    }
    if (position === "right") {
      return { left: vw - dockH - pad, top: (vh - dockW) / 2, width: dockH, height: Math.min(dockW, vh - pad * 2) };
    }
    return null;
  }

  function _showSnapGhost(position) {
    if (_readStyle() !== "pill") return; // ghost only in pill mode
    const ghost = _ensureSnapGhost();
    const rect = _snapGhostRect(position);
    if (!rect) return;
    ghost.style.left       = `${Math.round(rect.left)}px`;
    ghost.style.top        = `${Math.round(rect.top)}px`;
    ghost.style.width      = `${Math.round(rect.width)}px`;
    ghost.style.height     = `${Math.round(rect.height)}px`;
    ghost.style.visibility = "visible";
    requestAnimationFrame(() => { ghost.style.opacity = "1"; });
  }

  function _hideSnapGhost() {
    const ghost = document.getElementById("dock-snap-ghost");
    if (!ghost) return;
    ghost.style.opacity = "0";
    setTimeout(() => { if (ghost.style.opacity === "0") ghost.style.visibility = "hidden"; }, 150);
  }

  /** Wrap app.js showDockPreview / hideDockPreview to inject the ghost. */
  function _hookSnapGhost() {
    const _origShow = globalThis.showDockPreview;
    const _origHide = globalThis.hideDockPreview;

    if (typeof _origShow === "function") {
      globalThis.showDockPreview = function (position) {
        _origShow.call(this, position);
        _showSnapGhost(position);
      };
      window.showDockPreview = globalThis.showDockPreview;
    }
    if (typeof _origHide === "function") {
      globalThis.hideDockPreview = function () {
        _origHide.call(this);
        _hideSnapGhost();
      };
      window.hideDockPreview = globalThis.hideDockPreview;
    }
  }

  /* ── Panel open/close → active sync ─────────────────────────────────── */

  function _installPanelSyncHooks() {
    /* cssos:panelclose fires on the panel element (bubbles:false).
     * We need to catch it via document-level capture or direct panel binding.
     * Use document capture since panels are known at boot time.               */
    document.addEventListener("cssos:panelclose", () => {
      requestAnimationFrame(syncActiveItem);
    }, { capture: true });

    /* MutationObserver on document.body — watch for panel-front class changes.
     * This is more reliable than wrapping openPanel/focusPanel because
     * app.js uses its own local function bindings (not globalThis.openPanel),
     * so globalThis-level hooks never fire on internal calls.               */
    const panelMo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "attributes" && m.attributeName === "class") {
          var el = m.target;
          if (el && el.classList && el.classList.contains("panel")) {
            requestAnimationFrame(syncActiveItem);
            return;
          }
        }
      }
    });
    panelMo.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });

    /* Keep globalThis hooks as a belt-and-suspenders fallback. */
    const _origOpen = globalThis.openPanel;
    if (typeof _origOpen === "function") {
      const _hooked = function (panel, options) {
        _origOpen.call(this, panel, options);
        requestAnimationFrame(syncActiveItem);
      };
      globalThis.openPanel = _hooked;
      window.openPanel = _hooked;
    }

    /* Also listen for focusPanel. */
    const _origFocus = globalThis.focusPanel;
    if (typeof _origFocus === "function") {
      const _hooked = function (panel, options) {
        _origFocus.call(this, panel, options);
        requestAnimationFrame(syncActiveItem);
      };
      globalThis.focusPanel = _hooked;
      window.focusPanel = _hooked;
    }

    /* Re-sync on settings change (dock position changes mean items re-render). */
    document.addEventListener("cssos:settingschange", _onSettingsChange);

    /* Re-sync when MV Pipeline or Person MV inject new dock items. */
    const mo = new MutationObserver(() => {
      const dock = _getDock();
      if (!dock) return;
      // Only act if a dock-item was added/removed.
      syncActiveItem();
    });
    const dock = _getDock();
    if (dock) {
      mo.observe(dock, { childList: true });
    }
  }

  /* ── Public API: set / get dock style ───────────────────────────────── */

  /**
   * Switch between "pill" (凸嵌凹 chromatic) and "icon" (legacy Apple style).
   * Persists to localStorage.
   */
  globalThis.cssosSetDockStyle = function (style) {
    const safe = style === "icon" ? "icon" : "pill";
    try { localStorage.setItem(STYLE_KEY, safe); } catch (_) {}
    _applyStyle(safe);
  };

  globalThis.cssosGetDockStyle = _readStyle;

  function _applyStyle(style) {
    const dock = _getDock();
    if (!dock) return;
    if (style === "icon") {
      _removePillBar(dock);
      dock.dataset.dockStyle = "icon";
    } else {
      _stampPillBar(dock);
      dock.dataset.dockStyle = "pill";
      syncActiveItem();
    }
  }

  /* ── Dock icon-mode CSS reset ────────────────────────────────────────── *
   *
   * In icon mode the dock items render as they did before this file existed.
   * We inject a tiny <style> to undo any pill-bar residue when in icon mode.
   * In pill mode no extra CSS is needed — the pill-bar utility owns it all.
   */
  function _ensureIconModeStyle() {
    const id = "cssos-dock-icon-mode-style";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      /* dock-pill: icon-mode reset (only active when data-dock-style="icon") */
      #dock[data-dock-style="icon"] {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }
      #dock[data-dock-style="icon"] [data-pill-key] {
        --ph: none;
        background: transparent !important;
        border-radius: 13px !important;
        margin: 0 !important;
        mask-image: none !important;
        -webkit-mask-image: none !important;
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Pill-mode label visibility ──────────────────────────────────────── *
   *
   * In pill mode labels are always visible (shown inside the pill).
   * In icon mode labels fade on hover (legacy behavior).
   * We add a tiny CSS override — the dock-label stays inside the pill
   * in pill-mode by switching from absolute-above to inline flow.
   */
  // Layout CSS is now in style.css under #dock[data-pill-bar] > [data-pill-key].
  // No JS-injected style needed.

  /* ── Init ────────────────────────────────────────────────────────────── */

  function _init() {
    _ensureIconModeStyle();
    _hookSnapGhost();
    _installPanelSyncHooks();

    // W464m one-time migration: pill is the constitutional default.
    // If the user had "icon" saved from before pill mode was ready,
    // reset it to "pill" once so the dock converts immediately.
    try {
      if (!localStorage.getItem("cssos.dock.style.v464m")) {
        localStorage.setItem("cssos.dock.style", "pill");
        localStorage.setItem("cssos.dock.style.v464m", "1");
      }
    } catch (_) {}

    const style = _readStyle();
    _applyStyle(style);

    // Seed active state: mic is always the default when no panel is open.
    // We use requestAnimationFrame so --ph hues assigned by cssosMakePillBar
    // are already on the elements when we sync --th.
    requestAnimationFrame(() => {
      const d = _getDock();
      if (d) _setDockActive(d, "mic");
    });

    console.info(
      "%c[dock-pill] Wave 464 armed — style=%s, position=%s",
      "color:#0a0;font-weight:bold",
      style,
      _getPosition()
    );
  }

  function _tryInit() {
    _init();
    // After first paint, re-stamp then ensure mic is active.
    requestAnimationFrame(() => {
      const dock = _getDock();
      if (dock && _readStyle() === "pill") {
        _stampPillBar(dock);
        _setDockActive(dock, "mic");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _tryInit);
  } else {
    _tryInit();
  }

  // Also listen for cssos:panel-behavior-changed to re-apply vertical flag.
  document.addEventListener("cssos:panel-behavior-changed", _onSettingsChange);

  /* ── Expose syncActiveItem for external callers ─────────────────────── */
  globalThis.cssosDockSyncActive = syncActiveItem;

})();
