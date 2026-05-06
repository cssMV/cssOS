/* CSSOS_PHASE_A2_4_PANEL_DRAG 20260506 — Jing
 *
 * Port of public/app.panel-drag.js to TypeScript.
 *
 * Wires pointer-drag to move panels by their title bar (or a
 * data-drag-handle element). The logo panel has special semantics:
 *   - pointerdown alone is "pending" — long-press / hold-mic owns it
 *     until we pass a 10px movement threshold, at which point we
 *     promote to a real drag.
 *   - this lets the gem be both a mic-hold target AND a draggable
 *     surface without the two gestures fighting each other.
 *
 * Idempotent — `panelDragBound` dataset flag bails on re-entry so
 * boot can call us again after dynamic panel insertion.
 */
import "./types";

function attachPanelDragBridge(): void {
  document.querySelectorAll<HTMLElement>(".panel").forEach((panel) => {
    if (panel.dataset.panelDragBound === "true") return;
    panel.dataset.panelDragBound = "true";

    const logo = (globalThis as { logoPanel?: HTMLElement | null }).logoPanel;
    const handle: HTMLElement | null =
      (panel === logo ? panel.querySelector<HTMLElement>("[data-drag-handle]") : null) ||
      panel.querySelector<HTMLElement>(".panel-bar") ||
      panel.querySelector<HTMLElement>("[data-drag-handle]");
    if (!handle) return;

    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
    let pending = false;
    let pendingPointerId: number | null = null;
    let startX = 0;
    let startY = 0;

    handle.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(".panel-actions")) return;
      if (target?.closest?.("button")) return;
      if (target?.closest?.("[data-hold='mic']")) return;
      if (panel.classList.contains("panel-locked")) return;
      if (panel === logo) {
        pending = true;
        pendingPointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        panel.dataset.logoGestureDragging = "false";
        if (typeof globalThis.forceResetHoldRing === "function") globalThis.forceResetHoldRing();
        if (typeof globalThis.setLongpressGuard === "function") globalThis.setLongpressGuard(false);
        return;
      }
      panel.dataset.userMoved = "true";
      panel.classList.remove("showcase-panel");
      if (panel.dataset.maximized === "true") {
        restorePanel(panel);
      }
      dragging = true;
      panel.classList.add("dragging");
      focusPanel(panel);
      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      event.preventDefault();
    });

    const onPointerMove = (event: PointerEvent): void => {
      if (panel === logo && pending && !dragging) {
        if (pendingPointerId !== event.pointerId) return;
        const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
        if (distance < 10) return;
        pending = false;
        panel.dataset.userMoved = "true";
        panel.classList.remove("showcase-panel");
        if (panel.dataset.maximized === "true") {
          restorePanel(panel);
        }
        dragging = true;
        panel.dataset.logoGestureDragging = "true";
        panel.classList.add("dragging");
        focusPanel(panel);
        const rect = panel.getBoundingClientRect();
        offsetX = startX - rect.left;
        offsetY = startY - rect.top;
        event.preventDefault();
      }
      if (!dragging) return;
      if (typeof globalThis.spawnDragTrail === "function") globalThis.spawnDragTrail(event);
      const proposedLeft = event.clientX - offsetX;
      const proposedTop = event.clientY - offsetY;
      setPanelPosition(panel, proposedLeft, proposedTop);
    };

    handle.addEventListener("pointermove", onPointerMove);

    const stopDrag = (_event: PointerEvent): void => {
      if (panel === logo && !dragging) {
        pending = false;
        pendingPointerId = null;
        panel.dataset.logoGestureDragging = "false";
        return;
      }
      dragging = false;
      pending = false;
      pendingPointerId = null;
      panel.dataset.logoGestureDragging = "false";
      panel.classList.remove("dragging");
      persistPanelLayout(panel);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", stopDrag);
    document.addEventListener("pointercancel", stopDrag);
  });
}

if (typeof window !== "undefined") {
  window.attachPanelDragBridge = attachPanelDragBridge;
}

export { attachPanelDragBridge };
