/* CSSOS_DOUBLE_TAP_SEEK 20260506 — Jing
 *
 * Mobile-friendly seek gesture for the MV: double-tap the left half of
 * the video to jump -10s, the right half to jump +10s. Same affordance
 * YouTube/Bilibili have on touch. Single tap is left alone — that's
 * still play/pause via the existing toggle layer.
 *
 * Detection:
 *   - 2 pointerdown events on the same half within 350ms
 *   - second tap within 36px of the first (so a swipe doesn't fire it)
 *   - target is not a button/control (we ignore the cluster)
 *
 * Visual: a brief "« 10s" / "10s »" badge anchored on the tapped side.
 */
(function () {
  "use strict";

  var WINDOW_MS = 350;
  var MAX_DRIFT_PX = 36;

  function isControl(el) {
    if (!el) return false;
    if (el.closest && el.closest("button,a,input,select,textarea,[role='button']")) return true;
    if (el.classList && (
      el.classList.contains("cssmv-fr-btn") ||
      el.classList.contains("cssmv-pip-btn") ||
      el.classList.contains("cssmv-fs-btn") ||
      el.classList.contains("cssmv-loop-btn") ||
      el.classList.contains("cssmv-speed-btn")
    )) return true;
    return false;
  }

  function flashBadge(side, sec) {
    var b = document.createElement("div");
    b.style.cssText =
      "position:fixed;top:50%;transform:translateY(-50%);" +
      (side === "left" ? "left:8%;" : "right:8%;") +
      "z-index:2147483645;padding:14px 22px;border-radius:999px;" +
      "background:rgba(8,18,16,0.78);color:#daffee;" +
      "font:700 14px/1 ui-monospace,monospace;letter-spacing:.04em;" +
      "border:1px solid rgba(0,245,160,0.35);" +
      "box-shadow:0 14px 32px rgba(0,0,0,0.55);" +
      "opacity:0;transition:opacity .18s ease,transform .18s ease;pointer-events:none;";
    b.textContent = side === "left" ? "« " + sec + "s" : sec + "s »";
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.style.opacity = "1"; });
    setTimeout(function () {
      b.style.opacity = "0";
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 200);
    }, 600);
  }

  function attach(vid) {
    if (!vid || vid.dataset.cssosDtsBound === "1") return;
    vid.dataset.cssosDtsBound = "1";
    var lastT = 0;
    var lastX = 0, lastY = 0;
    vid.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      if (isControl(e.target)) return;
      var now = Date.now();
      var dt = now - lastT;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      var dist2 = dx * dx + dy * dy;
      if (dt < WINDOW_MS && dist2 < MAX_DRIFT_PX * MAX_DRIFT_PX) {
        // Double-tap detected.
        var rect = vid.getBoundingClientRect();
        var rel = (e.clientX - rect.left) / Math.max(1, rect.width);
        var side = rel < 0.5 ? "left" : "right";
        var d = side === "left" ? -10 : 10;
        try {
          vid.currentTime = Math.max(
            0,
            Math.min((vid.duration || 0) - 0.1, (vid.currentTime || 0) + d),
          );
        } catch (_e) {}
        flashBadge(side, 10);
        lastT = 0; // consume — third tap shouldn't chain
        e.preventDefault();
        return;
      }
      lastT = now;
      lastX = e.clientX;
      lastY = e.clientY;
    }, { passive: false });
  }

  function init() {
    attach(document.getElementById("watch-video"));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(function () {
      attach(document.getElementById("watch-video"));
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
