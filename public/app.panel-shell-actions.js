function normalizePanelActionName(rawAction = "", fallbackIndex = -1) {
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
  const fallbackByIndex = ["panel.settings", "panel.minimize", "panel.maximize", "panel.close"];
  return fallbackByIndex[fallbackIndex] || "";
}

function normalizePanelActionButtons(panel) {
  const buttons = Array.from(panel?.querySelectorAll?.(".panel-actions .icon-btn") || []);
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
    /* CSSOS_PHASE1_3BUTTON_PANEL_BAR 20260417:
       The panel "constitution" now allows only 3 action buttons in the bar:
       minimize / maximize / close. The settings cog was already hidden via
       CSS, but left a semantic slot (tab-stop, aria) and a focus target in the
       keyboard order. Strip it from the DOM so all panels are 3-button. Per-
       panel settings flyouts are still reachable via double-click on the panel
       bar (see attachPanelBarActionsBridge). */
    if (normalized === "panel.settings") {
      button.remove();
    }
  });
}

function attachPanelBarActionsBridge() {
  document.querySelectorAll(".panel").forEach((panel) => {
    if (panel.dataset.panelBarActionsBound === "true") return;
    normalizePanelActionButtons(panel);
    panel.dataset.panelBarActionsBound = "true";
    panel.addEventListener("dblclick", (event) => {
      if (event.target.closest(".panel-actions")) return;
      if (event.target.closest(".panel-settings")) return;
      if (
        event.target.closest("button") ||
        event.target.closest("input") ||
        event.target.closest("select") ||
        event.target.closest("textarea")
      ) {
        return;
      }
      globalThis.setDockDebugStatus?.(
        "Panel Action",
        `${panel.id || "panel"} -> panel.settings`,
        "Panel bar double click toggled settings."
      );
      togglePanelSettings(panel);
    });

    panel.addEventListener(
      "click",
      (event) => {
        normalizePanelActionButtons(panel);
        const button = event.target?.closest?.(".panel-actions .icon-btn");
        if (!(button instanceof HTMLElement)) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        focusPanel(panel);
        const rawAction = String(button.dataset.action || "").trim().toLowerCase();
        if (!rawAction) return;
        if (rawAction === "panel.settings") {
          globalThis.setDockDebugStatus?.(
            "Panel Action",
            `${panel.id || "panel"} -> panel.settings`,
            "Top-right settings button fired."
          );
          togglePanelSettings(panel);
          return;
        }
        if (rawAction === "panel.minimize") {
          globalThis.setDockDebugStatus?.(
            "Panel Action",
            `${panel.id || "panel"} -> panel.minimize`,
            "Top-right minimize button fired."
          );
          if (panel === watchPanel) {
            globalThis.stopWatchPanelPlaybackModule?.();
          }
          togglePanelCollapse(panel);
          return;
        }
        if (rawAction === "panel.maximize") {
          globalThis.setDockDebugStatus?.(
            "Panel Action",
            `${panel.id || "panel"} -> panel.maximize`,
            "Top-right maximize button fired."
          );
          globalThis.togglePanelMaximize?.(panel);
          return;
        }
        if (rawAction === "panel.close") {
          globalThis.setDockDebugStatus?.(
            "Panel Action",
            `${panel.id || "panel"} -> panel.close`,
            "Top-right close button fired."
          );
          if (panel === watchPanel) {
            globalThis.stopWatchPanelPlaybackModule?.();
          }
          minimizeToDock(panel);
        }
      },
      true
    );
  });
}

/* CSSOS_PHASE2_PANEL_CONSTITUTION_V2 20260419 — 8-way resize.
 * Previously the panel had only two visible chevrons at the bottom-right
 * (.resize-handle) and bottom-left (.resize-handle-left). The new panel
 * constitution (v2) asks for Apple/Windows-window behavior: every edge AND
 * every corner is a grab zone. We inject 8 invisible overlay divs per panel
 * (.panel-resize-edge.{n,s,e,w} + .panel-resize-corner.{ne,nw,se,sw}) and
 * bind them all to the same generic resize logic below. The old two chevrons
 * are CSS-hidden (style.css) and their handlers remain for safety. */
const PANEL_RESIZE_EDGE_DIRECTIONS = ["n", "s", "e", "w"];
const PANEL_RESIZE_CORNER_DIRECTIONS = ["ne", "nw", "se", "sw"];

function ensureEightWayResizeHandles(panel) {
  if (!(panel instanceof HTMLElement)) return [];
  const handles = [];
  PANEL_RESIZE_EDGE_DIRECTIONS.forEach((dir) => {
    let handle = panel.querySelector(`:scope > .panel-resize-edge.${dir}`);
    if (!handle) {
      handle = document.createElement("div");
      handle.className = `panel-resize-edge ${dir}`;
      handle.dataset.panelResizeEdge = dir;
      panel.appendChild(handle);
    }
    handles.push({ handle, dir });
  });
  PANEL_RESIZE_CORNER_DIRECTIONS.forEach((dir) => {
    let handle = panel.querySelector(`:scope > .panel-resize-corner.${dir}`);
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

function dirEdges(dir) {
  // returns object { top, right, bottom, left } booleans
  return {
    top: dir.includes("n"),
    bottom: dir.includes("s"),
    left: dir.includes("w"),
    right: dir.includes("e")
  };
}

function attachResizeBridge() {
  const bindEightWay = (panel, handle, dir) => {
    if (!handle) return;
    if (handle.dataset.panelResizeBound === "true") return;
    handle.dataset.panelResizeBound = "true";

    const edges = dirEdges(dir);
    let resizing = false;
    let startRect = null;
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
      } catch { /* ignore — no pointer capture support */ }
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

      if (edges.right) {
        nextWidth = startRect.width + dx;
      }
      if (edges.left) {
        nextWidth = startRect.width - dx;
        nextLeft = startRect.left + dx;
      }
      if (edges.bottom) {
        nextHeight = startRect.height + dy;
      }
      if (edges.top) {
        nextHeight = startRect.height - dy;
        nextTop = startRect.top + dy;
      }

      // Clamp width
      const clampedWidth = Math.max(
        sizeLimits.minWidth,
        Math.min(sizeLimits.maxWidth, nextWidth)
      );
      if (edges.left) {
        // If width was clamped while dragging the left edge, keep the right
        // edge anchored so the panel doesn't walk right as it hits min width.
        nextLeft = startRect.right - clampedWidth;
      }
      nextWidth = clampedWidth;

      // Clamp height
      const clampedHeight = Math.max(
        sizeLimits.minHeight,
        Math.min(sizeLimits.maxHeight, nextHeight)
      );
      if (edges.top) {
        nextTop = startRect.bottom - clampedHeight;
      }
      nextHeight = clampedHeight;

      /* CSSOS_WAVE_109E 20260509 — Jing
       * Panel constitution: panel must NEVER extend beyond the
       * viewport (the previous 40px-visible guard let users push
       * the right/bottom edges entirely off-screen, which made the
       * resize handles unreachable). Two clamps:
       *   1. left/top  ≥ 0
       *   2. right/bottom edge stays inside viewport — done by
       *      shrinking the proposed width/height when needed.
       * Width/height respect the size minimums even after this
       * clamp; if a panel can't fit at minimum size in the current
       * viewport, position is preferred over size. */
      nextLeft = Math.max(0, nextLeft);
      nextTop = Math.max(0, nextTop);
      var maxRightEdge = window.innerWidth;
      var maxBottomEdge = window.innerHeight;
      if (nextLeft + nextWidth > maxRightEdge) {
        nextWidth = Math.max(sizeLimits.minWidth, maxRightEdge - nextLeft);
      }
      if (nextTop + nextHeight > maxBottomEdge) {
        nextHeight = Math.max(sizeLimits.minHeight, maxBottomEdge - nextTop);
      }
      /* If the size minimum still pushes the right/bottom off the
       * viewport (panel too big for current window), nudge nextLeft/
       * nextTop back so the panel stays visible. */
      if (nextLeft + nextWidth > maxRightEdge) {
        nextLeft = Math.max(0, maxRightEdge - nextWidth);
      }
      if (nextTop + nextHeight > maxBottomEdge) {
        nextTop = Math.max(0, maxBottomEdge - nextHeight);
      }

      if (edges.left || edges.right) {
        panel.style.width = `${Math.round(nextWidth)}px`;
        panel.dataset.panelWidth = String(Math.round(nextWidth));
      }
      if (edges.top || edges.bottom) {
        panel.style.height = `${Math.round(nextHeight)}px`;
        panel.dataset.panelHeight = String(Math.round(nextHeight));
      }
      if (edges.left) {
        panel.style.left = `${Math.round(nextLeft)}px`;
      }
      if (edges.top) {
        panel.style.top = `${Math.round(nextTop)}px`;
      }
    });

    const stopResize = (event) => {
      if (!resizing) return;
      resizing = false;
      startRect = null;
      panel.classList.remove("dragging");
      try {
        if (handle.hasPointerCapture?.(event.pointerId)) {
          handle.releasePointerCapture(event.pointerId);
        }
      } catch { /* ignore */ }
      persistPanelLayout(panel);
    };

    handle.addEventListener("pointerup", stopResize);
    handle.addEventListener("pointercancel", stopResize);
    handle.addEventListener("lostpointercapture", stopResize);
  };

  document.querySelectorAll(".panel").forEach((panel) => {
    normalizePanelActionButtons(panel);
    // logo-panel is the ambient stage: no resize at all.
    if (panel.id === "logo-panel") return;
    const handles = ensureEightWayResizeHandles(panel);
    handles.forEach(({ handle, dir }) => bindEightWay(panel, handle, dir));
  });
}

function attachPanelFocusBridge() {
  panels.forEach((panel) => {
    if (!panel) return;
    panel.addEventListener("pointerdown", () => focusPanel(panel), true);
    panel.addEventListener("click", () => focusPanel(panel), true);
  });
}

function minimizeToDockBridge(panel) {
  panel.classList.add("hidden");
  panel.dataset.minimized = "true";
  if (panel === watchPanel) {
    minimizeWatchPanelShellModule();
  }
  updateDockVisibility();
  const action = dockByPanel[panel.id];
  if (!action) return;
  const dockItem = document.querySelector(`[data-action="${action}"]`);
  if (!dockItem) return;
  dockItem.classList.remove("active");
  panel.dispatchEvent(new CustomEvent("cssos:panelclose", { bubbles: false }));
}

function togglePanelLockBridge(panel) {
  panel.classList.toggle("panel-locked");
  if (panel.classList.contains("panel-locked")) {
    focusPanel(panel);
  }
}

function togglePanelCollapseBridge(panel) {
  if (!panel) return;
  const bar = panel.querySelector(".panel-bar");
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
    if (panel === watchPanel) syncWatchPanelCollapseShellModule(true);
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
  if (panel === watchPanel) syncWatchPanelCollapseShellModule(false);
}

window.attachPanelBarActionsBridge = attachPanelBarActionsBridge;
window.attachResizeBridge = attachResizeBridge;
window.attachPanelFocusBridge = attachPanelFocusBridge;
window.minimizeToDockBridge = minimizeToDockBridge;
window.togglePanelLockBridge = togglePanelLockBridge;
window.togglePanelCollapseBridge = togglePanelCollapseBridge;
window.normalizePanelActionButtons = normalizePanelActionButtons;
window.ensureEightWayResizeHandles = ensureEightWayResizeHandles;

/* CSSOS_WAVE_109E 20260509 — Jing
 * Panel constitution: panels must NEVER live outside the viewport.
 * When the user resizes the browser window smaller, any panel
 * positioned outside the new bounds gets nudged back in. Drag
 * already clamps via setPanelPosition; resize clamps via the
 * pointermove handler; this is the third leg — ambient viewport
 * resize. */
function clampAllPanelsToViewport() {
  if (typeof globalThis.setPanelPosition !== "function") return;
  document.querySelectorAll(".panel").forEach(function (panel) {
    if (!(panel instanceof HTMLElement)) return;
    if (panel.id === "logo-panel") return;
    if (panel.dataset.maximized === "true") return;
    if (panel.classList.contains("hidden")) return;
    var rect = panel.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    /* If panel is wider than viewport, shrink width first so it can
     * fit at all. Same for height. */
    var newWidth = Math.min(rect.width, vw);
    var newHeight = Math.min(rect.height, vh);
    if (newWidth !== rect.width) {
      panel.style.width = Math.round(newWidth) + "px";
      panel.dataset.panelWidth = String(Math.round(newWidth));
    }
    if (newHeight !== rect.height) {
      panel.style.height = Math.round(newHeight) + "px";
      panel.dataset.panelHeight = String(Math.round(newHeight));
    }
    /* Now clamp position so panel stays fully on-screen. */
    var nextLeft = Math.max(0, Math.min(rect.left, vw - newWidth));
    var nextTop  = Math.max(0, Math.min(rect.top,  vh - newHeight));
    if (nextLeft !== rect.left || nextTop !== rect.top) {
      try { globalThis.setPanelPosition(panel, nextLeft, nextTop); }
      catch (_) {
        panel.style.left = nextLeft + "px";
        panel.style.top = nextTop + "px";
      }
    }
  });
}
window.clampAllPanelsToViewport = clampAllPanelsToViewport;
/* Re-clamp on every viewport resize, throttled via rAF. */
(function bindViewportClamp() {
  var queued = false;
  function reclamp() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      try { clampAllPanelsToViewport(); } catch (err) {
        try { console.warn("[panel-clamp] failed", err); } catch (_) {}
      }
    });
  }
  window.addEventListener("resize", reclamp);
  // CSSOS_WAVE_486 20260529 — Jing「很多面板没遵守面板宪法, 标题栏飞出屏幕外」。
  // 根因: clampAllPanelsToViewport 此前只在 window resize 时触发。面板【打开】、
  // 内容渲染后【变高】、或被脚本重定位时, 标题栏冲出视口顶部就没人拉回来。
  // 补上 Article-2 的第四条腿: 观察 .panel 的 class(显示/隐藏/最大化)与 style
  // (left/top/width/height)变化, 以及新面板插入 DOM, 都触发一次节流 reclamp。
  // 这样无论哪条路径让面板越界, 标题栏(拖拽手柄)都会被拉回视口内。
  try {
    var clampMo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "attributes") {
          var t = m.target;
          if (t && t.classList && t.classList.contains("panel")) { reclamp(); return; }
        } else if (m.type === "childList" && m.addedNodes && m.addedNodes.length) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n && n.nodeType === 1 &&
                ((n.classList && n.classList.contains("panel")) ||
                 (n.querySelector && n.querySelector(".panel")))) {
              reclamp(); return;
            }
          }
        }
      }
    });
    clampMo.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"],
      childList: true,
      subtree: true
    });
  } catch (_e) {}
  // Also clamp once on first paint, in case a panel restored open above the fold.
  try { requestAnimationFrame(reclamp); } catch (_e2) {}
})();
