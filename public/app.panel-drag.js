function attachPanelDragBridge() {
  document.querySelectorAll(".panel").forEach((panel) => {
    if (panel.dataset.panelDragBound === "true") return;
    panel.dataset.panelDragBound = "true";
    const handle =
      (panel === logoPanel ? panel.querySelector("[data-drag-handle]") : null) ||
      panel.querySelector(".panel-bar") ||
      panel.querySelector("[data-drag-handle]");
    if (!handle) return;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
    let pending = false;
    let pendingPointerId = null;
    let startX = 0;
    let startY = 0;

    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".panel-actions")) return;
      if (event.target.closest("button")) return;
      if (event.target.closest("[data-hold='mic']")) return;
      if (panel.classList.contains("panel-locked")) return;
      if (panel === logoPanel) {
        pending = true;
        pendingPointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        panel.dataset.logoGestureDragging = "false";
        forceResetHoldRing();
        setLongpressGuard(false);
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

    const onPointerMove = (event) => {
      if (panel === logoPanel && pending && !dragging) {
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
      spawnDragTrail(event);
      const proposedLeft = event.clientX - offsetX;
      const proposedTop = event.clientY - offsetY;
      setPanelPosition(panel, proposedLeft, proposedTop);
    };

    handle.addEventListener("pointermove", onPointerMove);

    const stopDrag = (event) => {
      if (panel === logoPanel && !dragging) {
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

    // Per-panel pointermove/up/cancel hooks were previously registered on
    // `document` for every panel, racking up 3N document-level listeners and
    // causing drag flakiness once several panels mounted. Route through a
    // single shared dispatcher (installed once below) keyed off the active
    // panel/handle.
    panel.__panelDragMove = onPointerMove;
    panel.__panelDragStop = stopDrag;
  });

  if (!document.__panelDragBridgeShared) {
    document.__panelDragBridgeShared = true;
    const dispatch = (kind) => (event) => {
      document.querySelectorAll(".panel").forEach((panel) => {
        const fn =
          kind === "move" ? panel.__panelDragMove : panel.__panelDragStop;
        if (typeof fn === "function") fn(event);
      });
    };
    document.addEventListener("pointermove", dispatch("move"));
    document.addEventListener("pointerup", dispatch("stop"));
    document.addEventListener("pointercancel", dispatch("stop"));
  }
}

window.attachPanelDragBridge = attachPanelDragBridge;
