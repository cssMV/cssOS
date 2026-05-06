/* CSSOS_PHASE_A2_2_DOCK_SETTINGS 20260506 — Jing
 *
 * Dock settings popover, ported from public/app.dock-settings.js.
 *
 * Renders the small ⚙ popover that appears next to the dock with:
 *   - scale slider
 *   - show-labels toggle
 *   - allow-edge-docking toggle
 *   - dock position (bottom / left / right / top)
 *   - "Bottom center" reset
 *   - admin-only "save as default"
 *
 * Idempotent — `dockSettingsPopover` global tracks the singleton DOM
 * node, and the legacy boot code (window.toggleDockSettingsPopover
 * Module) routes through this module so re-binding is a no-op.
 */
import "./types";

function buildPopoverHtml(): string {
  const current = readPanelBehaviorSettingsLocal();
  const dockPos = current.dock.dock_position;
  return `
    <div class="dock-settings-title">${escapeHtml(loginCopy("Dock Settings"))}</div>
    <label><span>${escapeHtml(loginCopy("Scale"))}</span><input type="range" min="0.8" max="1.35" step="0.05" data-dock-setting="scale" value="${escapeHtml(String(current.dock.scale))}" /></label>
    <label class="advanced-panel-check"><input type="checkbox" data-dock-setting="labels" ${current.dock.show_labels ? "checked" : ""} /><span>${escapeHtml(loginCopy("Show labels"))}</span></label>
    <label class="advanced-panel-check"><input type="checkbox" data-dock-setting="docking" ${current.dock.docking_enabled ? "checked" : ""} /><span>${escapeHtml(loginCopy("Allow edge docking"))}</span></label>
    <label><span>${escapeHtml(loginCopy("Dock position"))}</span>
      <select data-dock-setting="position">
        <option value="bottom" ${dockPos === "bottom" ? "selected" : ""}>${escapeHtml(loginCopy("Bottom"))}</option>
        <option value="left" ${dockPos === "left" ? "selected" : ""}>${escapeHtml(loginCopy("Left"))}</option>
        <option value="right" ${dockPos === "right" ? "selected" : ""}>${escapeHtml(loginCopy("Right"))}</option>
        <option value="top" ${dockPos === "top" ? "selected" : ""}>${escapeHtml(loginCopy("Top"))}</option>
      </select>
    </label>
    <div class="dock-settings-actions">
      <button class="cta ghost tiny" type="button" data-dock-setting="reset">${escapeHtml(loginCopy("Bottom center"))}</button>
      ${getUserRole() === "admin" ? `<button class="cta ghost tiny" type="button" data-dock-setting="save-default">${escapeHtml(t("settings.panel.setDefault"))}</button>` : ""}
    </div>
  `;
}

function ensurePopover(): HTMLElement {
  const existing = (globalThis as { dockSettingsPopover?: HTMLElement | null })
    .dockSettingsPopover;
  if (existing && document.body.contains(existing)) return existing;
  const el = document.createElement("div");
  el.className = "dock-settings-popover";
  el.hidden = true;
  document.body.appendChild(el);
  (globalThis as { dockSettingsPopover?: HTMLElement | null }).dockSettingsPopover = el;
  return el;
}

function bindInputHandlers(popover: HTMLElement): void {
  const scale = popover.querySelector<HTMLInputElement>('[data-dock-setting="scale"]');
  scale?.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, scale: Number(target.value) || current.dock.scale },
    }));
  });

  const labels = popover.querySelector<HTMLInputElement>('[data-dock-setting="labels"]');
  labels?.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, show_labels: !!target.checked },
    }));
  });

  const docking = popover.querySelector<HTMLInputElement>('[data-dock-setting="docking"]');
  docking?.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, docking_enabled: !!target.checked },
    }));
  });

  const position = popover.querySelector<HTMLSelectElement>('[data-dock-setting="position"]');
  position?.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: {
        ...current.dock,
        dock_position: (target.value || current.dock.dock_position) as
          | "bottom"
          | "left"
          | "right"
          | "top",
      },
    }));
  });

  const reset = popover.querySelector<HTMLButtonElement>('[data-dock-setting="reset"]');
  reset?.addEventListener("click", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, dock_position: "bottom" },
    }));
    const dock = (globalThis as { dock?: HTMLElement | null }).dock;
    dock?.classList.add("is-snapping");
    setTimeout(() => dock?.classList.remove("is-snapping"), 520);
    renderPopover();
  });

  const saveDefault = popover.querySelector<HTMLButtonElement>(
    '[data-dock-setting="save-default"]',
  );
  saveDefault?.addEventListener("click", async (event) => {
    const trigger = event.currentTarget as HTMLElement;
    const saved = await savePanelDefaults(
      "behavior",
      readPanelBehaviorSettingsLocal(),
      trigger,
    );
    if (saved) {
      applyPanelBehaviorSettings(saved);
      showToast(loginCopy("Dock defaults saved."));
    }
  });
}

function renderPopover(): HTMLElement {
  const popover = ensurePopover();
  popover.innerHTML = buildPopoverHtml();
  bindInputHandlers(popover);
  return popover;
}

export function positionDockSettingsPopoverModule(): void {
  const popover = (globalThis as { dockSettingsPopover?: HTMLElement | null })
    .dockSettingsPopover;
  if (!popover || popover.hidden) return;
  const dock = (globalThis as { dock?: HTMLElement | null }).dock;
  if (!(dock instanceof HTMLElement)) return;
  const rect = dock.getBoundingClientRect();
  const dockPositionGlobal = (globalThis as { DOCK_POSITION?: string }).DOCK_POSITION;
  const position = dockPositionGlobal || dock.dataset.dockPosition || "bottom";
  const width = Math.min(320, Math.max(260, window.innerWidth - 32));
  popover.style.width = `${width}px`;
  if (position === "left") {
    popover.style.left = `${Math.min(window.innerWidth - width - 12, rect.right + 14)}px`;
    popover.style.top = `${Math.max(12, rect.top)}px`;
    return;
  }
  if (position === "right") {
    popover.style.left = `${Math.max(12, rect.left - width - 14)}px`;
    popover.style.top = `${Math.max(12, rect.top)}px`;
    return;
  }
  if (position === "top") {
    popover.style.left = `${Math.max(12, rect.left + rect.width / 2 - width / 2)}px`;
    popover.style.top = `${Math.min(window.innerHeight - popover.offsetHeight - 12, rect.bottom + 14)}px`;
    return;
  }
  // bottom (default)
  popover.style.left = `${Math.max(12, rect.left + rect.width / 2 - width / 2)}px`;
  popover.style.top = `${Math.max(12, rect.top - (popover.offsetHeight || 220) - 14)}px`;
}

export function hideDockSettingsPopoverModule(): void {
  const popover = (globalThis as { dockSettingsPopover?: HTMLElement | null })
    .dockSettingsPopover;
  if (!popover) return;
  popover.hidden = true;
  popover.classList.remove("is-visible");
}

export function toggleDockSettingsPopoverModule(force?: boolean): void {
  const popover = renderPopover();
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

/* Keep the legacy global hooks so the existing callers (boot.js,
 * panel-shell-actions, etc.) still resolve. Once the bundle replaces
 * public/app.dock-settings.js, these stay because they're THE module's
 * public API. */
if (typeof window !== "undefined") {
  window.positionDockSettingsPopoverModule = positionDockSettingsPopoverModule;
  window.hideDockSettingsPopoverModule = hideDockSettingsPopoverModule;
  window.toggleDockSettingsPopoverModule = toggleDockSettingsPopoverModule;
}
