/* CSSOS_PHASE_A2_2_DOCK_SETTINGS 20260506 — Jing
 *
 * Ambient declarations for the legacy globals the dock-settings
 * popover reads. Each panel port carries its own narrow types file —
 * the day a global gets replaced with a real module, only this file
 * moves.
 */
export interface DockBehavior {
  scale: number;
  show_labels: boolean;
  docking_enabled: boolean;
  dock_position: "bottom" | "left" | "right" | "top";
}
export interface PanelBehaviorSettings {
  dock: DockBehavior;
  [k: string]: unknown;
}

declare global {
  // eslint-disable-next-line no-var
  var dock: HTMLElement | null | undefined;
  // eslint-disable-next-line no-var
  var dockSettingsPopover: HTMLElement | null | undefined;
  // eslint-disable-next-line no-var
  var DOCK_POSITION: string | undefined;

  function readPanelBehaviorSettingsLocal(): PanelBehaviorSettings;
  function updatePanelBehaviorSettings(
    mutator: (current: PanelBehaviorSettings) => PanelBehaviorSettings,
  ): void;
  function applyPanelBehaviorSettings(s: PanelBehaviorSettings): void;
  function savePanelDefaults(
    scope: string,
    payload: unknown,
    trigger?: HTMLElement | EventTarget | null,
  ): Promise<PanelBehaviorSettings | null>;
  function escapeHtml(s: string): string;
  function loginCopy(en: string, zh?: string): string;
  function showToast(msg: string): void;
  function getUserRole(): string;
  function t(key: string): string;

  interface Window {
    positionDockSettingsPopoverModule?: () => void;
    hideDockSettingsPopoverModule?: () => void;
    toggleDockSettingsPopoverModule?: (force?: boolean) => void;
  }
}

export {};
