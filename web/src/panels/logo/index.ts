/* CSSOS_PHASE_A2_PANEL_LOGO 20260506 — Jing
 *
 * Logo-panel actions, ported from public/app.logo-panel-actions.js.
 * Single-tap → universal creation entry. Long-press → mic hold.
 * Drag-to-move handled separately by the panel-drag bridge.
 *
 * This is the TEMPLATE for future panel migrations. The pattern:
 *   1. Per-panel folder under web/src/panels/<name>/
 *   2. types.ts — ambient declarations for any legacy globals the
 *      panel still needs to read (kept narrow on purpose so the day we
 *      replace each global with a real module, only types.ts moves)
 *   3. index.ts — pure ES module export of attach…() functions
 *   4. Keep the legacy public/app.<name>.js wired-up until Vite builds
 *      are served live. Once they are, the legacy file is deleted in
 *      a single mechanical commit (one panel at a time).
 *
 * No live impact yet: nothing in index.html references the bundled
 * output. `npm run web:check` typechecks; `npm run web:build` produces
 * dist-web/ for parity testing.
 */
import "./types";

const HOLD_PIXEL_THRESHOLD = 10;

interface LogoGesture {
  pointerId: number | null;
  startX: number;
  startY: number;
  startedAt: number;
  moved: boolean;
  holdTriggered: boolean;
  holdTimer: number;
}

function makeGesture(): LogoGesture {
  return {
    pointerId: null,
    startX: 0,
    startY: 0,
    startedAt: 0,
    moved: false,
    holdTriggered: false,
    holdTimer: 0,
  };
}

function readLongpressMs(): number {
  const fromGlobal = Number((globalThis as { LONGPRESS_MS?: number }).LONGPRESS_MS || 0);
  return fromGlobal > 0 ? fromGlobal : 600;
}

function guardLogoCreationAccess(opts: { allowGuest?: boolean } = {}): boolean {
  if (opts.allowGuest) return true;
  const auth = (globalThis as { authState?: { user?: unknown } }).authState;
  if (auth?.user) return true;
  const copy =
    typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(
          "Sign in first to use the logo or microphone creation actions.",
        )
      : "Sign in first to use the logo or microphone creation actions.";
  if (typeof globalThis.openLoginForCreation === "function") {
    globalThis.openLoginForCreation(copy);
  } else {
    if (typeof globalThis.showToast === "function") globalThis.showToast(copy);
    if (globalThis.loginPanel && typeof globalThis.openPanel === "function") {
      globalThis.openPanel(globalThis.loginPanel);
    }
  }
  return false;
}

/**
 * Wire up tap / long-press / drag-disambiguation on the logo panel's
 * mirror surface. Idempotent — safe to call again after dynamic panel
 * rebuilds. Delegates browser-native gestures we DON'T want (text
 * select, native context menu, image drag) so the gem can be a clean
 * tactile target.
 */
export function attachLogoPanelActionsBridge(): void {
  const logoPanel = document.getElementById("logo-panel");
  if (!logoPanel) return;
  if (logoPanel.dataset.logoActionsBound === "true") return;
  const surface = logoPanel.querySelector(".mirror-stage");
  if (!(surface instanceof HTMLElement)) return;
  logoPanel.dataset.logoActionsBound = "true";

  const cancelMirrorDefault = (event: Event): void => {
    event.preventDefault();
  };
  (["selectstart", "contextmenu", "dragstart"] as const).forEach((eventName) => {
    surface.addEventListener(eventName, cancelMirrorDefault);
  });

  const gesture = makeGesture();

  const resetGesture = (): void => {
    if (gesture.holdTimer) clearTimeout(gesture.holdTimer);
    gesture.pointerId = null;
    gesture.startX = 0;
    gesture.startY = 0;
    gesture.startedAt = 0;
    gesture.moved = false;
    gesture.holdTriggered = false;
    gesture.holdTimer = 0;
  };

  surface.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if ((event.target as Element | null)?.closest?.(".panel-settings")) return;
    if (!guardLogoCreationAccess()) return;
    gesture.pointerId = event.pointerId;
    gesture.startX = event.clientX;
    gesture.startY = event.clientY;
    gesture.startedAt = performance.now();
    gesture.moved = false;
    gesture.holdTriggered = false;
    gesture.holdTimer = window.setTimeout(() => {
      if (gesture.moved) return;
      gesture.holdTriggered = true;
      window.__cssosMicHoldStart?.("logo");
    }, readLongpressMs());
  });

  surface.addEventListener("pointermove", (event) => {
    if (gesture.pointerId !== event.pointerId || gesture.moved) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (Math.hypot(dx, dy) < HOLD_PIXEL_THRESHOLD) return;
    gesture.moved = true;
    if (gesture.holdTimer) clearTimeout(gesture.holdTimer);
    if (gesture.holdTriggered) {
      if (typeof globalThis.forceResetHoldRing === "function") globalThis.forceResetHoldRing();
      if (typeof globalThis.setLongpressGuard === "function") globalThis.setLongpressGuard(false);
    }
  });

  const finishGesture = (event: PointerEvent, reason: "release" | "cancel"): void => {
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.holdTimer) clearTimeout(gesture.holdTimer);
    const dragWon =
      gesture.moved ||
      logoPanel.dataset.logoGestureDragging === "true" ||
      logoPanel.classList.contains("dragging");
    if (gesture.holdTriggered && !dragWon) {
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("cssos:mic_hold_commit", {
          detail: {
            elapsed_ms: Math.round(performance.now() - gesture.startedAt),
            origin: "logo",
            reason,
          },
        }),
      );
    }
    resetGesture();
  };

  surface.addEventListener("pointerup", (event) => finishGesture(event, "release"));
  surface.addEventListener("pointercancel", (event) => finishGesture(event, "cancel"));

  surface.addEventListener("click", (event) => {
    if (gesture.moved || logoPanel.dataset.logoGestureDragging === "true") return;
    const suppressUntil = Number(window.__cssosMicHold?.suppressClickUntil || 0);
    if (Date.now() < suppressUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!guardLogoCreationAccess()) return;
    event.preventDefault();
    event.stopPropagation();
    console.info(
      "%c[entry:logo-image] click → invokeUniversalCreationEntry",
      "color:#08f;font-weight:bold",
    );
    void window.invokeUniversalCreationEntry?.({
      origin: "logo",
      preferredTab: "mv",
      submitVoiceFallback: true,
    });
  });

  surface.addEventListener("dblclick", (event) => {
    if (gesture.moved || logoPanel.dataset.logoGestureDragging === "true") return;
    if (!guardLogoCreationAccess()) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof globalThis.openCreationAdvancedSettingsPanel === "function") {
      globalThis.openCreationAdvancedSettingsPanel();
    }
  });
}

/* Keep the legacy global hook so the existing boot path
 * (app.boot.js → attachLogoPanelActions) keeps working until the
 * Vite-bundled output replaces public/app.logo-panel-actions.js. */
if (typeof window !== "undefined") {
  window.attachLogoPanelActionsBridge = attachLogoPanelActionsBridge;
}
