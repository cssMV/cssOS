function buildDockSettingsPopoverModule() {
  const current = readPanelBehaviorSettingsLocal();
  return `
    <div class="dock-settings-title">${escapeHtml(loginCopy("Dock Settings"))}</div>
    <label><span>${escapeHtml(loginCopy("Scale"))}</span><input type="range" min="0.8" max="1.35" step="0.05" data-dock-setting="scale" value="${escapeHtml(String(current.dock.scale))}" /></label>
    <label class="advanced-panel-check"><input type="checkbox" data-dock-setting="labels" ${current.dock.show_labels ? "checked" : ""} /><span>${escapeHtml(loginCopy("Show labels"))}</span></label>
    <label class="advanced-panel-check"><input type="checkbox" data-dock-setting="docking" ${current.dock.docking_enabled ? "checked" : ""} /><span>${escapeHtml(loginCopy("Allow edge docking"))}</span></label>
    <label><span>${escapeHtml(loginCopy("Dock position"))}</span>
      <select data-dock-setting="position">
        <option value="bottom" ${current.dock.dock_position === "bottom" ? "selected" : ""}>${escapeHtml(loginCopy("Bottom"))}</option>
        <option value="left" ${current.dock.dock_position === "left" ? "selected" : ""}>${escapeHtml(loginCopy("Left"))}</option>
        <option value="right" ${current.dock.dock_position === "right" ? "selected" : ""}>${escapeHtml(loginCopy("Right"))}</option>
        <option value="top" ${current.dock.dock_position === "top" ? "selected" : ""}>${escapeHtml(loginCopy("Top"))}</option>
      </select>
    </label>
    <div class="dock-settings-actions">
      <button class="cta ghost tiny" type="button" data-dock-setting="reset">${escapeHtml(loginCopy("Bottom center"))}</button>
      ${getUserRole() === "admin" ? `<button class="cta ghost tiny" type="button" data-dock-setting="save-default">${escapeHtml(t("settings.panel.setDefault"))}</button>` : ""}
    </div>
  `;
}

function ensureDockSettingsPopoverModule() {
  if (dockSettingsPopover) return dockSettingsPopover;
  dockSettingsPopover = document.createElement("div");
  dockSettingsPopover.className = "dock-settings-popover";
  dockSettingsPopover.hidden = true;
  document.body.appendChild(dockSettingsPopover);
  return dockSettingsPopover;
}

function renderDockSettingsPopoverModule() {
  const popover = ensureDockSettingsPopoverModule();
  popover.innerHTML = buildDockSettingsPopoverModule();
  popover.querySelector('[data-dock-setting="scale"]')?.addEventListener("input", (event) => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, scale: Number(event.target.value || current.dock.scale) }
    }));
  });
  popover.querySelector('[data-dock-setting="labels"]')?.addEventListener("change", (event) => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, show_labels: !!event.target.checked }
    }));
  });
  popover.querySelector('[data-dock-setting="docking"]')?.addEventListener("change", (event) => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, docking_enabled: !!event.target.checked }
    }));
  });
  popover.querySelector('[data-dock-setting="position"]')?.addEventListener("change", (event) => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, dock_position: String(event.target.value || current.dock.dock_position) }
    }));
  });
  popover.querySelector('[data-dock-setting="reset"]')?.addEventListener("click", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, dock_position: "bottom" }
    }));
    dock?.classList.add("is-snapping");
    setTimeout(() => dock?.classList.remove("is-snapping"), 520);
    renderDockSettingsPopoverModule();
  });
  popover.querySelector('[data-dock-setting="save-default"]')?.addEventListener("click", async (event) => {
    const saved = await savePanelDefaults("behavior", readPanelBehaviorSettingsLocal(), event.currentTarget);
    if (saved) {
      applyPanelBehaviorSettings(saved);
      showToast(loginCopy("Dock defaults saved."));
    }
  });
  return popover;
}

function positionDockSettingsPopoverModule() {
  if (!dockSettingsPopover || dockSettingsPopover.hidden || !(dock instanceof HTMLElement)) return;
  const rect = dock.getBoundingClientRect();
  const position = DOCK_POSITION || dock.dataset.dockPosition || "bottom";
  const width = Math.min(320, Math.max(260, window.innerWidth - 32));
  dockSettingsPopover.style.width = `${width}px`;
  if (position === "left") {
    dockSettingsPopover.style.left = `${Math.min(window.innerWidth - width - 12, rect.right + 14)}px`;
    dockSettingsPopover.style.top = `${Math.max(12, rect.top)}px`;
    return;
  }
  if (position === "right") {
    dockSettingsPopover.style.left = `${Math.max(12, rect.left - width - 14)}px`;
    dockSettingsPopover.style.top = `${Math.max(12, rect.top)}px`;
    return;
  }
  if (position === "top") {
    dockSettingsPopover.style.left = `${Math.max(12, rect.left + rect.width / 2 - width / 2)}px`;
    dockSettingsPopover.style.top = `${Math.min(window.innerHeight - dockSettingsPopover.offsetHeight - 12, rect.bottom + 14)}px`;
    return;
  }
  dockSettingsPopover.style.left = `${Math.max(12, rect.left + rect.width / 2 - width / 2)}px`;
  dockSettingsPopover.style.top = `${Math.max(12, rect.top - (dockSettingsPopover.offsetHeight || 220) - 14)}px`;
}

function hideDockSettingsPopoverModule() {
  if (!dockSettingsPopover) return;
  dockSettingsPopover.hidden = true;
  dockSettingsPopover.classList.remove("is-visible");
}

function toggleDockSettingsPopoverModule(force) {
  const popover = renderDockSettingsPopoverModule();
  const shouldOpen = typeof force === "boolean" ? force : popover.hidden;
  if (!shouldOpen) {
    hideDockSettingsPopoverModule();
    return;
  }
  popover.hidden = false;
  positionDockSettingsPopoverModule();
  requestAnimationFrame(() => {
    positionDockSettingsPopoverModule();
    popover.classList.add("is-visible");
  });
}

globalThis.positionDockSettingsPopoverModule = positionDockSettingsPopoverModule;
globalThis.hideDockSettingsPopoverModule = hideDockSettingsPopoverModule;
globalThis.toggleDockSettingsPopoverModule = toggleDockSettingsPopoverModule;
