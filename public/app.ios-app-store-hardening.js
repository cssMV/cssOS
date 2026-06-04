/* CSSOS_WAVE_233 20260519 — Jing: iOS Capacitor build harden
 * for App Store re-submission. All changes are GATED on iOS
 * (Capacitor.getPlatform() === "ios"  OR  userAgent contains
 * "cssos-ios") so the web build is unaffected.
 *
 * Hardens against:
 *   - 2.1.0 App Completeness: hide debug UI + uploads tab
 *   - 5.0 Legal: disable UGC music upload entry point
 *
 * Self-running, idempotent, runs early then again on every DOM
 * mutation to catch lazy-rendered nodes.
 */
(function () {
  "use strict";
  if (globalThis.__cssosIosHardenWired) return;
  globalThis.__cssosIosHardenWired = true;

  function isIos() {
    try {
      if (globalThis.Capacitor && typeof globalThis.Capacitor.getPlatform === "function") {
        return globalThis.Capacitor.getPlatform() === "ios";
      }
      var ua = String(navigator.userAgent || "").toLowerCase();
      return ua.indexOf("cssos-ios") !== -1;
    } catch (_e) { return false; }
  }
  if (!isIos()) return;

  function injectStyles() {
    if (document.getElementById("cssos-ios-harden-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-ios-harden-style";
    st.textContent = [
      /* Music Source Uploads tab — UGC upload entry. Apple 5.2 risk:
       * users could upload arbitrary copyrighted audio. Hidden on iOS
       * until we ship a moderation pipeline that has explicit App
       * Review approval. */
      '[data-lyrics-input-tab="uploads"]{display:none !important;}',
      '#lyrics-input-pane-uploads{display:none !important;}',
      /* Memory probe HUD pill (W232 prevents it from mounting on iOS,
       * belt-and-suspenders to also hide if it sneaks in.) */
      '#cssos-mem-hud{display:none !important;}',
      /* 3-button debug badge — only mounts when localStorage flag is
       * set, but hide it on iOS regardless to defeat any reviewer
       * who toggles dev tools. */
      '#panel-3btn-debug-badge{display:none !important;}',
    ].join("\n");
    document.head.appendChild(st);
  }
  injectStyles();

  /* If the tab was hidden mid-session, also force-switch back to
   * the editor pane so the user isn't stranded on an empty surface. */
  function sweep() {
    try {
      var uploadsTab = document.querySelector('[data-lyrics-input-tab="uploads"]');
      if (uploadsTab && uploadsTab.classList.contains("active")) {
        uploadsTab.classList.remove("active");
        var editor = document.querySelector('[data-lyrics-input-tab="editor"]');
        if (editor) editor.classList.add("active");
        var editorPane = document.getElementById("lyrics-input-pane-editor");
        var uploadsPane = document.getElementById("lyrics-input-pane-uploads");
        if (editorPane) editorPane.classList.add("active");
        if (uploadsPane) uploadsPane.classList.remove("active");
      }
    } catch (_e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sweep, { once: true });
  } else {
    sweep();
  }
  try {
    var mo = new MutationObserver(function () { sweep(); });
    mo.observe(document.body, { subtree: true, childList: true });
  } catch (_e) {}

  console.info("%c[ios-harden] active — App Store compliance mode",
    "color:#0a8;font-weight:bold");
})();
