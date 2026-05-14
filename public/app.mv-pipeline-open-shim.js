/* CSSOS_WAVE_144 20260514 — Jing
 *
 * Define globalThis.openMvPipelinePanel — the missing entry point.
 *
 * It's referenced from 40+ call sites (person codex "Make an MV"
 * button, agent chat seed cards, mic + logo handoff, advanced apply,
 * mv-import, music-input-panel, etc.) but no implementation existed.
 * All those buttons looked like no-ops.
 *
 * This shim:
 *   1. Stores the optional seed { prompt, style, language, work_type,
 *      __personId, __landmarkId, __storyAngle, autoStart } so the
 *      heavy app.mv-pipeline-panel.js module can pre-fill its form on
 *      open. Until that module reads the seed, downstream callers
 *      already work because the panel itself is functional — they
 *      just need it to be visible.
 *   2. Opens the existing #cssmv-panel via the global openPanel(el)
 *      (existing function in app.js).
 *   3. Routes guests to login first via openPanel(loginPanel).
 */
(function () {
  if (typeof globalThis.openMvPipelinePanel === "function") return;

  function getPanel() { return document.getElementById("cssmv-panel"); }
  function loginPanel() { return document.getElementById("login-panel"); }

  globalThis.openMvPipelinePanel = function openMvPipelinePanel(opts) {
    var panel = getPanel();
    if (!panel) {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(
          (typeof globalThis.loginCopy === "function"
            ? globalThis.loginCopy("MV pipeline panel not loaded yet — try again in a moment.","MV 管线面板尚未加载，请稍候再试。")
            : "MV pipeline panel not loaded yet.")
        );
      }
      return false;
    }
    // Guests → login first.
    try {
      if (!globalThis.authState || !globalThis.authState.user) {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(
            (typeof globalThis.loginCopy === "function"
              ? globalThis.loginCopy("Please sign in first to enter the MV pipeline.","请先登录后进入 MV 管线。")
              : "Sign in first.")
          );
        }
        var lp = loginPanel();
        if (lp && typeof globalThis.openPanel === "function") globalThis.openPanel(lp);
        return false;
      }
    } catch (_) {}

    // Stash seed for the heavy module to consume on its next render.
    // The seed convention is the same one buildAgentSystemPrompt uses
    // (cssos-seed JSON block): { prompt, style, language, work_type,
    // __personId, __landmarkId, __storyAngle, autoStart, forceNew }.
    if (opts && typeof opts === "object") {
      var carrier = opts.seed || opts;
      try {
        globalThis.__cssosMvPipelineSeed = {
          ts: Date.now(),
          seed: carrier,
          autoStart: !!opts.autoStart,
          forceNew: !!opts.forceNew,
        };
        // Also broadcast via CustomEvent so any future listener picks
        // it up without having to poll the global.
        try {
          document.dispatchEvent(new CustomEvent("cssos:mv-pipeline-seed", {
            detail: { seed: carrier, autoStart: !!opts.autoStart, forceNew: !!opts.forceNew },
          }));
        } catch (_) {}
      } catch (_) {}
    }

    // Open the panel via the existing pattern.
    try {
      if (typeof globalThis.openPanel === "function") {
        globalThis.openPanel(panel);
      } else {
        panel.hidden = false;
        panel.classList.remove("hidden", "is-hidden");
      }
    } catch (_) {
      panel.hidden = false;
      panel.classList.remove("hidden", "is-hidden");
    }
    return true;
  };
})();
