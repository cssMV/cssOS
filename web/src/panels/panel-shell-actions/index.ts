/* CSSOS_PHASE_A2_3_PANEL_SHELL_ACTIONS 20260506 — Jing
 *
 * Port of public/app.panel-shell-actions.js to TypeScript.
 *
 * Wires the panel "constitution":
 *   1. Top-right action bar normalized to 3 buttons
 *      (minimize / maximize / close) — settings cog removed from DOM,
 *      reachable via dblclick on panel-bar instead.
 *   2. 8-way resize handles (4 edges + 4 corners) injected as overlay
 *      divs and bound to a single shared resize routine.
 *   3. Pointer/click on any panel raises focus.
 *
 * Shape preserved verbatim from the JS original — same dataset flags,
 * same event-capture phases, same edge-clamp math, same legacy
 * globalThis hooks. Migration is byte-compatible with the live runtime
 * so flipping the bundle in for the legacy file is a no-op.
 */
import "./types";

const PANEL_RESIZE_EDGE_DIRECTIONS = ["n", "s", "e", "w"] as const;
const PANEL_RESIZE_CORNER_DIRECTIONS = ["ne", "nw", "se", "sw"] as const;
type ResizeDir =
  | (typeof PANEL_RESIZE_EDGE_DIRECTIONS)[number]
  | (typeof PANEL_RESIZE_CORNER_DIRECTIONS)[number];

type CanonicalAction =
  | "panel.settings"
  | "panel.minimize"
  | "panel.maximize"
  | "panel.close";

function normalizePanelActionName(rawAction: string, fallbackIndex: number): CanonicalAction | "" {
  const normalized = String(rawAction || "").trim().toLowerCase();
  if (
    normalized === "panel.settings" ||
    normalized.includes("setting") ||
    normalized.includes("action.settings")
  ) {
    return "panel.settings";
  }
  if (
    normalized === "panel.minimize" ||
    normalized.includes("minimize") ||
    normalized === "min" ||
    normalized.includes("action.minimize")
  ) {
    return "panel.minimize";
  }
  if (
    normalized === "panel.maximize" ||
    normalized.includes("lock") ||
    normalized.includes("full") ||
    normalized.includes("max") ||
    normalized.includes("expand") ||
    normalized.includes("action.lock") ||
    normalized.includes("⛶")
  ) {
    return "panel.maximize";
  }
  if (
    normalized === "panel.close" ||
    normalized.includes("close") ||
    normalized.includes("action.close")
  ) {
    return "panel.close";
  }
  const fallbackByIndex: CanonicalAction[] = [
    "panel.settings",
    "panel.minimize",
    "panel.maximize",
    "panel.close",
  ];
  return fallbackByIndex[fallbackIndex] ?? "";
}

function normalizePanelActionButtons(panel: HTMLElement): void {
  const buttons = Array.from(
    panel?.querySelectorAll?.<HTMLElement>(".panel-actions .icon-btn") ?? [],
  );
  buttons.forEach((button, index) => {
    if (!(button instanceof HTMLElement)) return;
    const rawAction =
      button.dataset.action ||
      button.getAttribute("aria-label") ||
      button.getAttribute("data-i18n-aria") ||
      button.textContent ||
      "";
    const normalized = normalizePanelActionName(rawAction, index);
    if (!normalized) return;
    button.dataset.action = normalized;
    if (button.tagName === "BUTTON" && !button.getAttribute("type")) {
      button.setAttribute("type", "button");
    }
    /* CSSOS_PHASE1_3BUTTON_PANEL_BAR 20260417: panel "constitution"
       allows only 3 action buttons in the bar. Strip the settings cog
       from the DOM; settings flyouts are reachable via dblclick on
       panel-bar instead. */
    if (normalized === "panel.settings") {
      button.remove();
    }
  });
}

function attachPanelBarActionsBridge(): void {
  document.querySelectorAll<HTMLElement>(".panel").forEach((panel) => {
    if (panel.dataset.panelBarActionsBound === "true") return;
    normalizePanelActionButtons(panel);
    panel.dataset.panelBarActionsBound = "true";

    panel.addEventListener("dblclick", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(".panel-actions")) return;
      if (target?.closest?.(".panel-settings")) return;
      if (
        target?.closest?.("button") ||
        target?.closest?.("input") ||
        target?.closest?.("select") ||
        target?.closest?.("textarea")
      ) {
        return;
      }
      window.setDockDebugStatus?.(
        "Panel Action",
        `${panel.id || "panel"} -> panel.settings`,
        "Panel bar double click toggled settings.",
      );
      togglePanelSettings(panel);
    });

    panel.addEventListener(
      "click",
      (event) => {
        normalizePanelActionButtons(panel);
        const target = event.target as HTMLElement | null;
        const button = target?.closest?.<HTMLElement>(".panel-actions .icon-btn") ?? null;
        if (!(button instanceof HTMLElement)) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        focusPanel(panel);
        const rawAction = String(button.dataset.action || "").trim().toLowerCase();
        if (!rawAction) return;
        if (rawAction === "panel.settings") {
          window.setDockDebugStatus?.(
            "Panel Action",
            `${panel.id || "panel"} -> panel.settings`,
            "Top-right settings button fired.",
          );
          togglePanelSettings(panel);
          return;
        }
        if (rawAction === "panel.minimize") {
          window.setDockDebugStatus?.(
            "Panel Action",
            `${panel.id || "panel"} -> panel.minimize`,
            "Top-right minimize button fired.",
          );
          if (panel === (window as { watchPanel?: HTMLElement }).watchPanel) {
            window.stopWatchPanelPlaybackModule?.();
          }
          togglePanelCollapse(panel);
          return;
        }
        if (rawAction === "panel.maximize") {
          window.setDockDebugStatus?.(
            "Panel Action",
            `${panel.id || "panel"} -> panel.maximize`,
            "Top-right maximize button fired.",
          );
          window.togglePanelMaximize?.(panel);
          return;
        }
        if (rawAction === "panel.close") {
          window.setDockDebugStatus?.(
            "Panel Action",
            `${panel.id || "panel"} -> panel.close`,
            "Top-right close button fired.",
          );
          if (panel === (window as { watchPanel?: HTMLElement }).watchPanel) {
            window.stopWatchPanelPlaybackModule?.();
          }
          minimizeToDock(panel);
        }
      },
      true,
    );
  });
}

function ensureEightWayResizeHandles(
  panel: HTMLElement,
): Array<{ handle: HTMLElement; dir: ResizeDir }> {
  if (!(panel instanceof HTMLElement)) return [];
  const handles: Array<{ handle: HTMLElement; dir: ResizeDir }> = [];
  PANEL_RESIZE_EDGE_DIRECTIONS.forEach((dir) => {
    let handle = panel.querySelector<HTMLElement>(`:scope > .panel-resize-edge.${dir}`);
    if (!handle) {
      handle = document.createElement("div");
      handle.className = `panel-resize-edge ${dir}`;
      handle.dataset.panelResizeEdge = dir;
      panel.appendChild(handle);
    }
    handles.push({ handle, dir });
  });
  PANEL_RESIZE_CORNER_DIRECTIONS.forEach((dir) => {
    let handle = panel.querySelector<HTMLElement>(`:scope > .panel-resize-corner.${dir}`);
    if (!handle) {
      handle = document.createElement("div");
      handle.className = `panel-resize-corner ${dir}`;
      handle.dataset.panelResizeCorner = dir;
      panel.appendChild(handle);
    }
    handles.push({ handle, dir });
  });
  return handles;
}

function dirEdges(dir: ResizeDir): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
  return {
    top: dir.includes("n"),
    bottom: dir.includes("s"),
    left: dir.includes("w"),
    right: dir.includes("e"),
  };
}

function bindEightWay(panel: HTMLElement, handle: HTMLElement, dir: ResizeDir): void {
  if (!handle) return;
  if (handle.dataset.panelResizeBound === "true") return;
  handle.dataset.panelResizeBound = "true";

  const edges = dirEdges(dir);
  let resizing = false;
  let startRect: DOMRect | null = null;
  let startClientX = 0;
  let startClientY = 0;

  handle.addEventListener("pointerdown", (event) => {
    if (panel.classList.contains("panel-locked")) return;
    if (panel.classList.contains("panel-collapsed")) return;
    panel.dataset.userMoved = "true";
    panel.classList.remove("showcase-panel");
    resizing = true;
    if (panel.dataset.maximized === "true") {
      restorePanel(panel);
    }
    panel.classList.add("dragging");
    focusPanel(panel);
    startRect = panel.getBoundingClientRect();
    startClientX = event.clientX;
    startClientY = event.clientY;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* ignore — no pointer capture support */
    }
    event.preventDefault();
    event.stopPropagation();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!resizing || !startRect) return;
    const sizeLimits = getPanelSizeConstraints(panel);
    const dx = event.clientX - startClientX;
    const dy = event.clientY - startClientY;
    let nextLeft = startRect.left;
    let nextTop = startRect.top;
    let nextWidth = startRect.width;
    let nextHeight = startRect.height;

    if (edges.right) nextWidth = startRect.width + dx;
    if (edges.left) {
      nextWidth = startRect.width - dx;
      nextLeft = startRect.left + dx;
    }
    if (edges.bottom) nextHeight = startRect.height + dy;
    if (edges.top) {
      nextHeight = startRect.height - dy;
      nextTop = startRect.top + dy;
    }

    const clampedWidth = Math.max(
      sizeLimits.minWidth,
      Math.min(sizeLimits.maxWidth, nextWidth),
    );
    if (edges.left) {
      // anchor the right edge so the panel doesn't walk right at min-width.
      nextLeft = startRect.right - clampedWidth;
    }
    nextWidth = clampedWidth;

    const clampedHeight = Math.max(
      sizeLimits.minHeight,
      Math.min(sizeLimits.maxHeight, nextHeight),
    );
    if (edges.top) nextTop = startRect.bottom - clampedHeight;
    nextHeight = clampedHeight;

    nextLeft = Math.max(0, Math.min(window.innerWidth - 40, nextLeft));
    nextTop = Math.max(0, Math.min(window.innerHeight - 40, nextTop));

    if (edges.left || edges.right) {
      panel.style.width = `${Math.round(nextWidth)}px`;
      panel.dataset.panelWidth = String(Math.round(nextWidth));
    }
    if (edges.top || edges.bottom) {
      panel.style.height = `${Math.round(nextHeight)}px`;
      panel.dataset.panelHeight = String(Math.round(nextHeight));
    }
    if (edges.left) panel.style.left = `${Math.round(nextLeft)}px`;
    if (edges.top) panel.style.top = `${Math.round(nextTop)}px`;
  });

  const stopResize = (event: PointerEvent): void => {
    if (!resizing) return;
    resizing = false;
    startRect = null;
    panel.classList.remove("dragging");
    try {
      if (handle.hasPointerCapture?.(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }
    persistPanelLayout(panel);
  };

  handle.addEventListener("pointerup", stopResize);
  handle.addEventListener("pointercancel", stopResize);
  handle.addEventListener("lostpointercapture", stopResize);
}

function attachResizeBridge(): void {
  document.querySelectorAll<HTMLElement>(".panel").forEach((panel) => {
    normalizePanelActionButtons(panel);
    // logo-panel is the ambient stage: no resize at all.
    if (panel.id === "logo-panel") return;
    const handles = ensureEightWayResizeHandles(panel);
    handles.forEach(({ handle, dir }) => bindEightWay(panel, handle, dir));
  });
}

function attachPanelFocusBridge(): void {
  const panelsList = (globalThis as { panels?: ArrayLike<HTMLElement | null> }).panels;
  if (!panelsList) return;
  Array.from(panelsList as ArrayLike<HTMLElement | null>).forEach((panel) => {
    if (!panel) return;
    panel.addEventListener("pointerdown", () => focusPanel(panel), true);
    panel.addEventListener("click", () => focusPanel(panel), true);
  });
}

function minimizeToDockBridge(panel: HTMLElement): void {
  panel.classList.add("hidden");
  panel.dataset.minimized = "true";
  if (panel === (globalThis as { watchPanel?: HTMLElement }).watchPanel) {
    minimizeWatchPanelShellModule();
  }
  updateDockVisibility();
  const action = (globalThis as { dockByPanel?: Record<string, string | undefined> }).dockByPanel?.[panel.id];
  if (!action) return;
  // Look up the dock item; not used further but kept for parity with the
  // JS original (future hooks may want to flash the dock entry).
  document.querySelector(`.dock-item[data-action="${action}"]`);
}

function togglePanelLockBridge(panel: HTMLElement): void {
  panel.classList.toggle("panel-locked");
  if (panel.classList.contains("panel-locked")) {
    focusPanel(panel);
  }
}

function togglePanelCollapseBridge(panel: HTMLElement): void {
  if (!panel) return;
  const bar = panel.querySelector<HTMLElement>(".panel-bar");
  if (!bar) return;
  const isCollapsed = panel.classList.contains("panel-collapsed");
  if (isCollapsed) {
    panel.classList.remove("panel-collapsed");
    const restoreHeight = panel.dataset.collapseHeight ?? "";
    panel.style.height = restoreHeight;
    if (panel.dataset.collapseMaximized === "true") {
      panel.dataset.collapseMaximized = "false";
      panel.dataset.maximized = "true";
      panel.classList.add("maximized");
    }
    panel.dataset.collapseHeight = "";
    if (panel === (globalThis as { watchPanel?: HTMLElement }).watchPanel) {
      syncWatchPanelCollapseShellModule(true);
    }
    return;
  }
  panel.dataset.collapseHeight = panel.style.height || "";
  if (panel.dataset.maximized === "true") {
    panel.dataset.collapseMaximized = "true";
    panel.dataset.maximized = "false";
    panel.classList.remove("maximized");
  } else {
    panel.dataset.collapseMaximized = "false";
  }
  panel.classList.add("panel-collapsed");
  panel.style.height = `${bar.offsetHeight}px`;
  if (panel === (globalThis as { watchPanel?: HTMLElement }).watchPanel) {
    syncWatchPanelCollapseShellModule(false);
  }
}

if (typeof window !== "undefined") {
  window.attachPanelBarActionsBridge = attachPanelBarActionsBridge;
  window.attachResizeBridge = attachResizeBridge;
  window.attachPanelFocusBridge = attachPanelFocusBridge;
  window.minimizeToDockBridge = minimizeToDockBridge;
  window.togglePanelLockBridge = togglePanelLockBridge;
  window.togglePanelCollapseBridge = togglePanelCollapseBridge;
  window.normalizePanelActionButtons = normalizePanelActionButtons;
  window.ensureEightWayResizeHandles = ensureEightWayResizeHandles;
}

export {
  attachPanelBarActionsBridge,
  attachResizeBridge,
  attachPanelFocusBridge,
  minimizeToDockBridge,
  togglePanelLockBridge,
  togglePanelCollapseBridge,
  normalizePanelActionButtons,
  ensureEightWayResizeHandles,
};
