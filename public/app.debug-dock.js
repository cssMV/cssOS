function bindCriticalStageInteractionsImmediately() {
  if (document.body?.dataset?.criticalStageInteractionsBound === "true") return;
  document.body.dataset.criticalStageInteractionsBound = "true";
  ensureDockDebugBoard();
  installInteractionDebugProbe();
}

function ensureDockDebugBoard() {
  let board = document.getElementById("dock-debug-board");
  if (board) return board;
  board = document.createElement("aside");
  board.id = "dock-debug-board";
  board.className = "dock-debug-board";
  board.hidden = true;
  board.innerHTML = `
    <div class="dock-debug-board__title">Icon Status</div>
    <div class="dock-debug-board__name" id="dock-debug-name">Boot</div>
    <div class="dock-debug-board__summary" id="dock-debug-summary">Waiting for icon events.</div>
    <div class="dock-debug-board__detail" id="dock-debug-detail">The next dock or panel action will appear here.</div>
  `;
  document.body.appendChild(board);
  return board;
}

function describeInteractionDebugTarget(target) {
  if (!(target instanceof Element)) return "<non-element>";
  const dockItem = target.closest?.(".dock-item");
  if (dockItem instanceof HTMLElement) {
    return `dock:${String(dockItem.dataset.action || "").trim() || "<unknown>"}`;
  }
  const panelButton = target.closest?.(".panel-actions .icon-btn");
  if (panelButton instanceof HTMLElement) {
    const panel = panelButton.closest(".panel");
    const action =
      String(panelButton.dataset.action || panelButton.getAttribute("aria-label") || panelButton.textContent || "").trim() ||
      "<unknown>";
    return `panel-btn:${panel?.id || "<panel>"}:${action}`;
  }
  const panelBar = target.closest?.(".panel-bar");
  if (panelBar instanceof HTMLElement) {
    const panel = panelBar.closest(".panel");
    return `panel-bar:${panel?.id || "<panel>"}`;
  }
  const panel = target.closest?.(".panel");
  if (panel instanceof HTMLElement) {
    return `panel:${panel.id || "<panel>"}`;
  }
  const id = String(target.id || "").trim();
  if (id) return `#${id}`;
  const classes = Array.from(target.classList || []).slice(0, 3).join(".");
  if (classes) return `${target.tagName.toLowerCase()}.${classes}`;
  return target.tagName.toLowerCase();
}

function installInteractionDebugProbe() {
  if (document.body?.dataset?.interactionDebugProbeBound === "true") return;
  document.body.dataset.interactionDebugProbeBound = "true";
  const updateProbe = (phase, event) => {
    const targetLabel = describeInteractionDebugTarget(event.target);
    const currentLabel = describeInteractionDebugTarget(event.currentTarget);
    setDockDebugStatus(
      "Click Trace",
      `${phase} ${event.type} -> ${targetLabel}`,
      `target=${targetLabel} | current=${currentLabel} | trusted=${event.isTrusted ? "yes" : "no"}`
    );
  };
  ["pointerdown", "click", "dblclick"].forEach((eventName) => {
    document.addEventListener(
      eventName,
      (event) => {
        updateProbe("capture", event);
      },
      true
    );
    document.addEventListener(eventName, (event) => {
      updateProbe("bubble", event);
    });
  });
}

function setDockDebugStatus(name = "", summary = "", detail = "") {
  const board = ensureDockDebugBoard();
  const nameEl = board.querySelector("#dock-debug-name");
  const summaryEl = board.querySelector("#dock-debug-summary");
  const detailEl = board.querySelector("#dock-debug-detail");
  const now = new Date();
  const stamp = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (nameEl) nameEl.textContent = String(name || "Icon Status");
  if (summaryEl) summaryEl.textContent = String(summary || "No recent action.");
  if (detailEl) detailEl.textContent = `[${stamp}] ${String(detail || "Waiting for the next event.")}`;
}
