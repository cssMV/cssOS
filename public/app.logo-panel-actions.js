function attachLogoPanelActionsBridge() {
  if (!logoPanel || logoPanel.dataset.logoActionsBound === "true") return;
  const surface = logoPanel.querySelector(".mirror-stage");
  if (!(surface instanceof HTMLElement)) return;
  logoPanel.dataset.logoActionsBound = "true";
  const cancelMirrorDefault = (event) => {
    event.preventDefault();
  };
  ["selectstart", "contextmenu", "dragstart"].forEach((eventName) => {
    surface.addEventListener(eventName, cancelMirrorDefault);
  });

  const gesture = {
    pointerId: null,
    startX: 0,
    startY: 0,
    startedAt: 0,
    moved: false,
    holdTriggered: false,
    holdTimer: 0
  };

  const guardLogoCreationAccess = (options = {}) => {
    if (options.allowGuest) return true;
    if (authState?.user) return true;
    if (typeof openLoginForCreation === "function") {
      openLoginForCreation(
        loginCopy(
          "Sign in first to use the logo or microphone creation actions."
        )
      );
    } else {
      showToast?.(
        loginCopy(
          "Sign in first to use the logo or microphone creation actions."
        )
      );
      if (loginPanel) openPanel?.(loginPanel);
    }
    return false;
  };

  const resetGesture = () => {
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
    if (event.target.closest(".panel-settings")) return;
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
      globalThis.__cssosMicHoldStart?.("logo");
    }, LONGPRESS_MS);
  });

  surface.addEventListener("pointermove", (event) => {
    if (gesture.pointerId !== event.pointerId || gesture.moved) return;
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 10) return;
    gesture.moved = true;
    if (gesture.holdTimer) clearTimeout(gesture.holdTimer);
    if (gesture.holdTriggered) {
      forceResetHoldRing();
      setLongpressGuard(false);
    }
  });

  const finishGesture = (event, reason) => {
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.holdTimer) clearTimeout(gesture.holdTimer);
    const dragWon =
      gesture.moved ||
      logoPanel?.dataset?.logoGestureDragging === "true" ||
      logoPanel?.classList?.contains("dragging");
    if (gesture.holdTriggered && !dragWon) {
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("cssos:mic_hold_commit", {
          detail: {
            elapsed_ms: Math.round(performance.now() - gesture.startedAt),
            origin: "logo",
            reason
          }
        })
      );
    }
    resetGesture();
  };

  surface.addEventListener("pointerup", (event) => finishGesture(event, "release"));
  surface.addEventListener("pointercancel", (event) => finishGesture(event, "cancel"));

  surface.addEventListener("click", (event) => {
    if (gesture.moved || logoPanel?.dataset?.logoGestureDragging === "true") return;
    if (Date.now() < Number(globalThis.__cssosMicHold?.suppressClickUntil || 0)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!guardLogoCreationAccess()) return;
    event.preventDefault();
    event.stopPropagation();
    console.info(
      "%c[entry:logo-image] click → invokeUniversalCreationEntry",
      "color:#08f;font-weight:bold"
    );
    void globalThis.invokeUniversalCreationEntry?.({
      origin: "logo",
      preferredTab: "mv",
      submitVoiceFallback: true
    });
  });

  surface.addEventListener("dblclick", (event) => {
    if (gesture.moved || logoPanel?.dataset?.logoGestureDragging === "true") return;
    if (!guardLogoCreationAccess()) return;
    event.preventDefault();
    event.stopPropagation();
    openCreationAdvancedSettingsPanel();
  });
}

window.attachLogoPanelActionsBridge = attachLogoPanelActionsBridge;
