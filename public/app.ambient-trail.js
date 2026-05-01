function attachAmbientTrailBridge() {
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      const target = event.target;
      if (!target) return;
      if (
        target.closest(".dock") ||
        target.closest(".panel-settings") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("textarea")
      ) {
        return;
      }
      spawnAmbientTrail(event);
    },
    { passive: true }
  );
}

window.attachAmbientTrailBridge = attachAmbientTrailBridge;
