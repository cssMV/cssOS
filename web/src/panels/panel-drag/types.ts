/* CSSOS_PHASE_A2_4_PANEL_DRAG 20260506 — Jing
 *
 * Ambient declarations for the legacy globals the drag bridge needs.
 * Most overlap with panel-shell-actions (focusPanel, restorePanel,
 * persistPanelLayout, logoPanel) — re-declared here so this folder
 * remains importable without depending on shell-actions' types.
 */
declare global {
  // eslint-disable-next-line no-var
  var logoPanel: HTMLElement | null | undefined;

  function focusPanel(panel: HTMLElement): void;
  function restorePanel(panel: HTMLElement): void;
  function persistPanelLayout(panel: HTMLElement): void;
  function setPanelPosition(panel: HTMLElement, left: number, top: number): void;
  function spawnDragTrail(event: PointerEvent): void;
  function forceResetHoldRing(): void;
  function setLongpressGuard(on: boolean): void;

  interface Window {
    attachPanelDragBridge?: () => void;
  }
}

export {};
