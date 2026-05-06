/* CSSOS_PHASE_A2_3_PANEL_SHELL_ACTIONS 20260506 — Jing
 *
 * Ambient declarations for the legacy globals the shell-actions
 * bridge reaches into. The bridge wires:
 *   - the 3-button bar (minimize / maximize / close, settings cog removed)
 *   - 8-way resize handles (4 edges + 4 corners)
 *   - panel focus on pointer/click
 *   - dock dictionary for minimize→dock mapping
 */
export interface PanelSizeConstraints {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

declare global {
  // eslint-disable-next-line no-var
  var watchPanel: HTMLElement | null | undefined;
  // eslint-disable-next-line no-var
  var panels: Array<HTMLElement | null> | NodeListOf<HTMLElement> | undefined;
  // eslint-disable-next-line no-var
  var dockByPanel: Record<string, string | undefined>;

  function focusPanel(panel: HTMLElement): void;
  function togglePanelSettings(panel: HTMLElement): void;
  function togglePanelCollapse(panel: HTMLElement): void;
  function minimizeToDock(panel: HTMLElement): void;
  function restorePanel(panel: HTMLElement): void;
  function getPanelSizeConstraints(panel: HTMLElement): PanelSizeConstraints;
  function persistPanelLayout(panel: HTMLElement): void;
  function minimizeWatchPanelShellModule(): void;
  function syncWatchPanelCollapseShellModule(restoring: boolean): void;
  function updateDockVisibility(): void;

  interface Window {
    attachPanelBarActionsBridge?: () => void;
    attachResizeBridge?: () => void;
    attachPanelFocusBridge?: () => void;
    minimizeToDockBridge?: (panel: HTMLElement) => void;
    togglePanelLockBridge?: (panel: HTMLElement) => void;
    togglePanelCollapseBridge?: (panel: HTMLElement) => void;
    normalizePanelActionButtons?: (panel: HTMLElement) => void;
    ensureEightWayResizeHandles?: (
      panel: HTMLElement,
    ) => Array<{ handle: HTMLElement; dir: string }>;
    setDockDebugStatus?: (label: string, status: string, detail: string) => void;
    togglePanelMaximize?: (panel: HTMLElement) => void;
    stopWatchPanelPlaybackModule?: () => void;
  }
}

export {};
