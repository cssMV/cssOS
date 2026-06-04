/* ═══════════════════════════════════════════════════════════════════════════
 * app.panel-manager.js — Panel Constitution Execution Layer
 * CSSOS_WAVE_463_PANEL_MANAGER 20260528 — Jing
 *
 * Implements Articles 5, 6, 8 of the Panel Constitution:
 *
 *   Article 5 — Quick swipe UP on panel body → Close (≥ 400px/s, ≤ 200ms)
 *   Article 6 — Quick swipe DOWN on titlebar → Minimize (same thresholds)
 *   Article 8 — 5-panel LRU limit: opening a 6th auto-minimizes the LRU
 *               (least-recently-used open panel, silently, no dialog)
 *
 * Articles 1–4 and 7 are already handled elsewhere:
 *   Article 1 (3 buttons, drag, resize) → app.panel-shell-actions.js, app.panel-drag.js
 *   Article 2 (viewport clamp)          → app.panel-shell-actions.js (clampAllPanelsToViewport)
 *   Article 3 (z-index focus order)     → app.panel-focus.js (focusPanelBridge)
 *   Article 4 (swipe to switch)         → app.panel-swipe-nav.js
 *   Article 7 (double-tap settings)     → app.panel-shell-actions.js (dblclick handler)
 *
 * Dependencies (must be loaded before this file):
 *   globalThis.minimizeToDock   — close panel to dock (app.js / app.panel-shell-actions.js)
 *   globalThis.togglePanelCollapse — minimize/collapse (app.js)
 * ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  if (globalThis.__cssosPanelManagerInstalled) return;
  globalThis.__cssosPanelManagerInstalled = true;

  /* ── Constants ──────────────────────────────────────────────────────────── */

  /**
   * Article 8: maximum simultaneously open panels.
   * Power users (Studio/Enterprise) may raise this via panel settings overlay.
   * If Jing changes this number, update CLAUDE.md Article 8 too.
   */
  const PANEL_MAX_OPEN = 5;

  /**
   * Articles 5 & 6: velocity threshold for fling gestures.
   * ≥ 400 px/s over ≤ 200 ms is considered a "quick swipe".
   */
  const FLING_MIN_VELOCITY_PX_PER_S = 400;
  const FLING_MAX_DURATION_MS        = 200;

  /* ── LRU open-panel tracker ──────────────────────────────────────────────
   *
   * Stores panel elements in "most-recently activated" order.
   * Index 0 = most recently activated (MRU); last index = LRU candidate.
   * Only panels that are currently OPEN (not hidden, not minimized) appear.
   *
   * Updated by:
   *   1. Hook into focusPanel (every activation bumps the panel to front)
   *   2. openPanel post-hook (opening adds a panel to the list)
   *   3. minimizeToDock post-hook (closing removes a panel from the list)
   */
  const _lruList = []; // panel elements, most-recently-used first

  function _lruTouch(panel) {
    if (!panel) return;
    const idx = _lruList.indexOf(panel);
    if (idx !== -1) _lruList.splice(idx, 1);
    _lruList.unshift(panel);
  }

  function _lruRemove(panel) {
    if (!panel) return;
    const idx = _lruList.indexOf(panel);
    if (idx !== -1) _lruList.splice(idx, 1);
  }

  function _lruAdd(panel) {
    if (!panel) return;
    if (!_lruList.includes(panel)) _lruList.unshift(panel);
  }

  /** Returns the least-recently-used open panel, or null. */
  function _lruLeast() {
    return _lruList[_lruList.length - 1] || null;
  }

  /** Count of currently open (visible, non-minimized) panels in LRU list. */
  function _lruCount() {
    return _lruList.length;
  }

  /* ── Article 8: LRU limit enforcement ───────────────────────────────────
   *
   * Called by the openPanel hook BEFORE the panel becomes visible.
   * If opening this panel would exceed PANEL_MAX_OPEN, silently minimize
   * the LRU panel first.
   */
  function _enforceOpenLimit(incomingPanel) {
    // Resolve effective limit (power-user override stored per session).
    const effectiveMax = _getEffectiveMax();

    // If the incoming panel is already in the LRU list (re-focus), no eviction.
    if (_lruList.includes(incomingPanel)) return;

    if (_lruCount() >= effectiveMax) {
      const victim = _lruLeast();
      if (victim && victim !== incomingPanel) {
        try {
          (globalThis.minimizeToDock || globalThis.minimizeToDockBridge)?.(victim);
        } catch (e) {
          console.warn("[panel-manager] LRU eviction failed", e);
        }
        // Remove from LRU immediately (minimizeToDock hook will also fire,
        // but belt-and-suspenders is fine here).
        _lruRemove(victim);
      }
    }
  }

  function _getEffectiveMax() {
    try {
      const stored = parseInt(
        globalThis.panelManagerOverrideMax ??
        localStorage.getItem("cssos.panel.maxOpen") ?? "",
        10
      );
      if (!isNaN(stored) && stored >= 1 && stored <= 20) return stored;
    } catch (_) {}
    return PANEL_MAX_OPEN;
  }

  /* Expose so Advanced Settings / panel settings overlay can raise the cap. */
  globalThis.setPanelMaxOpen = function (n) {
    const safe = Math.max(1, Math.min(20, Number(n) || PANEL_MAX_OPEN));
    globalThis.panelManagerOverrideMax = safe;
    try { localStorage.setItem("cssos.panel.maxOpen", String(safe)); } catch (_) {}
  };
  globalThis.getPanelMaxOpen = _getEffectiveMax;
  globalThis.PANEL_MAX_OPEN = PANEL_MAX_OPEN; // constitution constant (read-only)

  /* ── Hook: intercept openPanel & focusPanel & minimizeToDock ────────────
   *
   * Strategy: wrap the globals that app.js and app.panel-focus.js export.
   * We wait until DOMContentLoaded so those globals are defined, then wrap.
   */

  let _hooksInstalled = false;

  function _installHooks() {
    if (_hooksInstalled) return;
    _hooksInstalled = true;

    /* ── openPanel hook ── */
    const _origOpen = globalThis.openPanel || globalThis.openPanelBridge;
    if (typeof _origOpen === "function") {
      const _hooked = function (panel, options) {
        _enforceOpenLimit(panel);
        _origOpen.call(this, panel, options);
        // After open: add to LRU (openPanelBridge also calls focusPanel
        // which will touch; this is a safety net for edge cases).
        _lruAdd(panel);
      };
      globalThis.openPanel = _hooked;
      globalThis.openPanelBridge = _hooked;
      window.openPanel = _hooked;
      window.openPanelBridge = _hooked;
    }

    /* ── focusPanel hook ── */
    const _origFocus = globalThis.focusPanel || globalThis.focusPanelBridge;
    if (typeof _origFocus === "function") {
      const _hooked = function (panel, options) {
        _origFocus.call(this, panel, options);
        _lruTouch(panel);
      };
      globalThis.focusPanel = _hooked;
      globalThis.focusPanelBridge = _hooked;
      window.focusPanel = _hooked;
      window.focusPanelBridge = _hooked;
    }

    /* ── minimizeToDock / close hook ── */
    const _origClose = globalThis.minimizeToDock || globalThis.minimizeToDockBridge;
    if (typeof _origClose === "function") {
      const _hooked = function (panel) {
        _origClose.call(this, panel);
        _lruRemove(panel);
      };
      globalThis.minimizeToDock = _hooked;
      globalThis.minimizeToDockBridge = _hooked;
      window.minimizeToDock = _hooked;
      window.minimizeToDockBridge = _hooked;
    }

    /* ── Seed LRU from currently visible panels ── */
    document.querySelectorAll(".panel:not(.hidden)").forEach((panel) => {
      if (panel.id === "logo-panel") return;
      _lruAdd(panel);
    });

    /* ── CSSOS_WAVE_496 20260529 — Jing「一次打开的面板不要超过上限, 不然拖累平台」。
     * Article 8 此前只靠 openPanel 的 hook 强制上限, 但有些动作走自定义开启器
     * (mv-pipeline→openMvPipelinePanel, watch→ensureWatchCentered)【不经过 openPanel】,
     * 左右滑动会循环到这些面板 → 绕过上限、面板堆积。补一条覆盖所有路径的 MutationObserver:
     * 任何 .panel 变可见(去掉 .hidden)时, 跑与 openPanel hook 相同的逻辑 —— 超额则先
     * 最小化最久未用(LRU)的那个。与现有 hook 幂等(已在表中的项早退, 不重复驱逐)。 */
    try {
      const _panelLimitMo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type !== "attributes" || m.attributeName !== "class") continue;
          const panel = m.target;
          if (!(panel instanceof HTMLElement)) continue;
          if (!panel.classList.contains("panel")) continue;
          if (panel.id === "logo-panel") continue;
          if (panel.classList.contains("hidden")) continue;      // minimized/closed → ignore
          if (panel.dataset.minimized === "true") continue;
          if (_lruList.includes(panel)) { _lruTouch(panel); continue; } // already open → bump
          _enforceOpenLimit(panel);  // becoming visible & over capacity → evict LRU first
          _lruAdd(panel);
        }
      });
      _panelLimitMo.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
        subtree: true,
      });
    } catch (e) {
      try { console.warn("[panel-manager] limit observer failed", e); } catch (_) {}
    }
  }

  /* ── Articles 5 & 6: fling gesture detection ────────────────────────────
   *
   * One shared touchstart/touchend pair on document (capture phase).
   * We track per-touch start info keyed by touch identifier.
   *
   *   Article 5: fast UP swipe on panel body → Close
   *   Article 6: fast DOWN swipe on titlebar → Minimize
   *
   * Discrimination logic:
   *   - Touch must START inside a .panel (either on body or titlebar).
   *   - Article 5: start inside .panel (but NOT on titlebar or panel-actions).
   *   - Article 6: start inside .panel-bar (the titlebar).
   *   - Both: |dy| ≥ 40px, duration ≤ FLING_MAX_DURATION_MS,
   *           velocity ≥ FLING_MIN_VELOCITY_PX_PER_S,
   *           |dy| ≥ 1.5×|dx| (clearly vertical).
   *   - Article 5: dy < 0 (upward).
   *   - Article 6: dy > 0 (downward).
   */

  const _activeTouches = new Map(); // touchId → { panel, onTitlebar, x0, y0, t0 }

  function _findAncestorPanel(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.classList?.contains("panel")) return node;
      node = node.parentElement;
    }
    return null;
  }

  function _isOnTitlebar(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.classList?.contains("panel-bar")) return true;
      if (node.classList?.contains("panel")) return false;
      node = node.parentElement;
    }
    return false;
  }

  function _isInteractiveTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (["input", "textarea", "select", "button", "a"].includes(tag)) return true;
    if (el.isContentEditable) return true;
    if (el.closest?.("input, textarea, select, button, a, [role='button'], [role='slider']")) return true;
    return false;
  }

  function _onTouchStart(ev) {
    if (ev.touches.length > 2) return; // ignore 3+-finger gestures
    Array.from(ev.changedTouches).forEach((touch) => {
      const target = touch.target;
      if (_isInteractiveTarget(target)) return;
      const panel = _findAncestorPanel(target);
      if (!panel) return;
      const onTitlebar = _isOnTitlebar(target);
      _activeTouches.set(touch.identifier, {
        panel,
        onTitlebar,
        x0: touch.clientX,
        y0: touch.clientY,
        t0: ev.timeStamp,
      });
    });
  }

  function _onTouchEnd(ev) {
    Array.from(ev.changedTouches).forEach((touch) => {
      const info = _activeTouches.get(touch.identifier);
      _activeTouches.delete(touch.identifier);
      if (!info) return;

      const dx = touch.clientX - info.x0;
      const dy = touch.clientY - info.y0;
      const dt = ev.timeStamp - info.t0;

      // Must be clearly vertical
      if (Math.abs(dy) < 40) return;
      if (Math.abs(dy) < Math.abs(dx) * 1.5) return;
      // Must be within duration window
      if (dt > FLING_MAX_DURATION_MS || dt <= 0) return;
      // Must meet velocity threshold
      const velocity = (Math.abs(dy) / dt) * 1000; // px/s
      if (velocity < FLING_MIN_VELOCITY_PX_PER_S) return;

      const { panel, onTitlebar } = info;

      if (dy < 0 && !onTitlebar) {
        /* ── Article 5: fast upward swipe on panel body → Close ── */
        try {
          (globalThis.minimizeToDock || globalThis.minimizeToDockBridge)?.(panel);
        } catch (e) {
          console.warn("[panel-manager] Article 5 close failed", e);
        }
      } else if (dy > 0 && onTitlebar) {
        /* ── Article 6: fast downward swipe on titlebar → Minimize ── */
        try {
          (globalThis.togglePanelCollapse || globalThis.togglePanelCollapseBridge)?.(panel);
        } catch (e) {
          console.warn("[panel-manager] Article 6 minimize failed", e);
        }
      }
    });
  }

  function _installFlingGestures() {
    if (globalThis.__cssosPanelManagerFlingInstalled) return;
    globalThis.__cssosPanelManagerFlingInstalled = true;
    document.addEventListener("touchstart", _onTouchStart, { passive: true, capture: false });
    document.addEventListener("touchend", _onTouchEnd, { passive: true, capture: false });
  }

  /* ── Init ────────────────────────────────────────────────────────────────
   *
   * Wait for DOMContentLoaded so all panel globals (openPanel, focusPanel,
   * minimizeToDock, etc.) are definitely defined by app.js and the
   * bridge files.
   */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _init);
  } else {
    // Already parsed (deferred or late-loaded script)
    _init();
  }

  function _init() {
    _installHooks();
    _installFlingGestures();
    console.info(
      "%c[panel-manager] Wave 463 armed — Articles 5·6·8 active | max=%d",
      "color:#0a0;font-weight:bold",
      _getEffectiveMax()
    );
  }

  /* ── Public API ─────────────────────────────────────────────────────────── */

  /** Read-only snapshot of the current LRU order (MRU first). */
  globalThis.getPanelLruList = () => [..._lruList];

  /** Manually evict a panel from LRU (for testing / settings overlay). */
  globalThis.removePanelFromLru = _lruRemove;

})();
