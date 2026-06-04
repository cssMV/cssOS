/* CSSOS_WAVE_194 20260516 — Jing
 *
 * "是否可以锁定竖屏，禁止横屏。"
 *
 * Three layers of portrait-lock, layered for the broadest device
 * coverage Apple's iron grip allows:
 *
 *   1. manifest.webmanifest `"orientation": "portrait"` — locks PWAs
 *      installed to the home screen on iOS + Android. (Set in the
 *      manifest separately from this script.)
 *
 *   2. screen.orientation.lock("portrait") — Chrome on Android,
 *      Edge, Samsung Internet. Requires the page to be in
 *      Fullscreen API mode (W192/W193 gets us there on the first
 *      creation gesture). Call automatically after fullscreen enters.
 *
 *   3. iOS Safari (non-PWA) doesn't expose screen.orientation.lock
 *      and won't honor any web API to force orientation. Best we can
 *      do: detect landscape, paint a full-screen "请转回竖屏 / Please
 *      rotate to portrait" overlay that absorbs input until the user
 *      flips back. The app underneath stays in portrait layout.
 *
 * Idempotent via __cssosOrientationLockWired sentinel.
 */
(function () {
  "use strict";
  if (globalThis.__cssosOrientationLockWired) return;
  globalThis.__cssosOrientationLockWired = true;

  // ───────────────────────────────────────────────────────────────
  // Layer 2: real lock when the browser supports it
  // ───────────────────────────────────────────────────────────────
  async function tryLockPortrait() {
    try {
      const so = (typeof screen !== "undefined") ? screen.orientation : null;
      if (!so || typeof so.lock !== "function") return false;
      await so.lock("portrait");
      return true;
    } catch (_) {
      return false;
    }
  }

  // Re-attempt every time the document enters fullscreen — that's
  // typically the only state where lock() is allowed.
  function bindFullscreenLock() {
    const onFsChange = () => {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        tryLockPortrait();
      }
    };
    try { document.addEventListener("fullscreenchange", onFsChange); } catch (_) {}
    try { document.addEventListener("webkitfullscreenchange", onFsChange); } catch (_) {}
    // First-shot attempt in case we're already fullscreen at module load
    // (rare, but harmless if not).
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      tryLockPortrait();
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Layer 3: iOS-Safari fallback — full-screen "rotate" overlay.
  //
  // iOS doesn't let us lock orientation from the web, so when the
  // user turns the phone landscape we show a passive notice that
  // covers the whole viewport until they rotate back. This is the
  // same pattern most camera / video apps use on the iOS web.
  // ───────────────────────────────────────────────────────────────
  function ensureRotateOverlay() {
    let el = document.getElementById("cssos-rotate-overlay");
    if (el) return el;
    el = document.createElement("div");
    el.id = "cssos-rotate-overlay";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:10090", /* CSSOS_WAVE_351 z-index 收敛: 99999 → 10090 (topmost: rotate gate over all) */
      "display:none",
      "align-items:center",
      "justify-content:center",
      "background:rgba(2,14,10,0.94)",
      "color:#daffee",
      "font:600 17px/1.5 -apple-system,system-ui,sans-serif",
      "letter-spacing:0.03em",
      "text-align:center",
      "padding:24px",
      "backdrop-filter:blur(12px)",
      "-webkit-backdrop-filter:blur(12px)",
      "touch-action:none",
      "user-select:none",
      "-webkit-user-select:none",
    ].join(";");
    // WAVE_445e 20260526 — i18n fix: English-only per project iron rule.
    el.innerHTML = [
      '<div style="max-width:320px;display:flex;flex-direction:column;align-items:center;gap:18px;">',
      '  <div style="font-size:56px;line-height:1;animation:cssosRotateNudge 2.4s ease-in-out infinite;">📱</div>',
      '  <div style="font-size:18px;font-weight:700;letter-spacing:0.04em;color:#5effc9;">CSS Studio</div>',
      '  <div style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.88);">',
      '    Please rotate your device back to <b>portrait</b>.',
      '  </div>',
      '</div>',
    ].join("");
    // Inline the nudge keyframes (no need for a separate <style>).
    const kf = document.createElement("style");
    kf.id = "cssos-rotate-overlay-style";
    kf.textContent =
      "@keyframes cssosRotateNudge {"
      + "  0%,100% { transform: rotate(0deg); }"
      + "  40%    { transform: rotate(-90deg); }"
      + "  60%    { transform: rotate(-90deg); }"
      + "}";
    document.head.appendChild(kf);
    document.body.appendChild(el);
    return el;
  }

  function isLandscapeNow() {
    try {
      if (typeof window === "undefined") return false;
      // Prefer matchMedia — most reliable on iOS.
      if (typeof window.matchMedia === "function") {
        return window.matchMedia("(orientation: landscape)").matches;
      }
      const w = Number(window.innerWidth) || 0;
      const h = Number(window.innerHeight) || 0;
      return w > h && w > 0 && h > 0;
    } catch (_) { return false; }
  }

  // Only show the rotate overlay on phones — not desktops, not tablets
  // wider than ~900px even in portrait. The exact heuristic: touch
  // device AND short edge ≤ 540px (covers iPhones + most Android
  // phones, excludes iPads / Surface).
  function isPhoneFormFactor() {
    try {
      if (typeof window === "undefined") return false;
      if (typeof window.matchMedia !== "function") return false;
      if (!window.matchMedia("(pointer: coarse)").matches) return false;
      const shortEdge = Math.min(
        Number(window.innerWidth) || 0,
        Number(window.innerHeight) || 0,
      );
      return shortEdge > 0 && shortEdge <= 540;
    } catch (_) { return false; }
  }

  function syncOverlay() {
    if (!isPhoneFormFactor()) return;
    const overlay = ensureRotateOverlay();
    overlay.style.display = isLandscapeNow() ? "flex" : "none";
  }

  function bindOverlay() {
    syncOverlay();
    const wrap = () => syncOverlay();
    try { window.addEventListener("resize", wrap, { passive: true }); } catch (_) {}
    try { window.addEventListener("orientationchange", wrap, { passive: true }); } catch (_) {}
    try {
      if (typeof window.matchMedia === "function") {
        const mq = window.matchMedia("(orientation: landscape)");
        // WAVE_445e: addListener deprecated since Safari 14+; iOS 15+ target uses addEventListener only.
        if (mq && typeof mq.addEventListener === "function") {
          mq.addEventListener("change", wrap);
        }
      }
    } catch (_) {}
  }

  function init() {
    // WAVE_445b 20260526 — attempt lock immediately on load, not just on
    // fullscreen entry. Works on Android Chrome standalone / PWA. iOS Safari
    // silently ignores it (no API available); the overlay below is the iOS fallback.
    tryLockPortrait();
    bindFullscreenLock();
    bindOverlay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
