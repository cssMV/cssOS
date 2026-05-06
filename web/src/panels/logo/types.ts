/* CSSOS_PHASE_A2_PANEL_LOGO 20260506 — Jing
 *
 * Types for legacy globals the logo-panel needs at runtime.
 *
 * The TS port stays decoupled from the rest of the (still-vanilla)
 * frontend by declaring the legacy globals as ambient types here. Once
 * a panel reaches into a global, it imports the type from this file
 * instead of typing it inline — that way the day we replace the legacy
 * global with a real ES module, every consumer's import path swaps in
 * one place.
 */
export interface AuthState {
  user: { id: string; [k: string]: unknown } | null | undefined;
  [k: string]: unknown;
}

export type LoginCopyFn = (
  en: string,
  zh?: string,
  fallback?: string,
) => string;

/** Optional fns the legacy frontend exposes on globalThis. */
export interface LegacyGlobals {
  authState?: AuthState;
  loginCopy?: LoginCopyFn;
  openLoginForCreation?: (msg?: string) => void;
  showToast?: (msg: string) => void;
  loginPanel?: HTMLElement | null;
  openPanel?: (panel: HTMLElement | null) => void;
  forceResetHoldRing?: () => void;
  setLongpressGuard?: (on: boolean) => void;
  openCreationAdvancedSettingsPanel?: () => void;
  invokeUniversalCreationEntry?: (opts: {
    origin: string;
    preferredTab?: string;
    submitVoiceFallback?: boolean;
  }) => Promise<unknown> | unknown;
  __cssosMicHoldStart?: (origin: string) => void;
  __cssosMicHold?: { suppressClickUntil?: number };
  /** Drives the long-press threshold. Tunable from panel-behavior settings. */
  LONGPRESS_MS?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var authState: AuthState | undefined;
  // eslint-disable-next-line no-var
  var LONGPRESS_MS: number | undefined;
  // eslint-disable-next-line no-var
  var loginPanel: HTMLElement | null | undefined;
  function loginCopy(en: string, zh?: string, fallback?: string): string;
  function openLoginForCreation(msg?: string): void;
  function showToast(msg: string): void;
  function openPanel(panel: HTMLElement | null): void;
  function forceResetHoldRing(): void;
  function setLongpressGuard(on: boolean): void;
  function openCreationAdvancedSettingsPanel(): void;
  interface Window {
    attachLogoPanelActionsBridge?: () => void;
    __cssosMicHoldStart?: (origin: string) => void;
    __cssosMicHold?: { suppressClickUntil?: number };
    invokeUniversalCreationEntry?: (opts: {
      origin: string;
      preferredTab?: string;
      submitVoiceFallback?: boolean;
    }) => Promise<unknown> | unknown;
  }
}

export {};
