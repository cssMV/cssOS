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
/* CSSOS_WAVE_145 20260514 — Jing: the REAL fix.
 *
 * The heavy app.mv-pipeline-panel.js DOES define globalThis.openMvPipelinePanel
 * at line ~8037, but it's lazy-loaded (<script type="cssos-lazy" data-panel=
 * "mv-pipeline">). Until something triggers `cssosLoadPanel("mv-pipeline")`,
 * the function doesn't exist — so person-codex / agent-chat / mic / play /
 * advanced-apply call sites silently no-op.
 *
 * This shim installs a *placeholder* openMvPipelinePanel that:
 *   1. Triggers cssosLoadPanel("mv-pipeline") which loads the heavy module.
 *   2. The heavy module's IIFE re-assigns globalThis.openMvPipelinePanel
 *      with the real implementation.
 *   3. Once that's done, we call the real one with the same args.
 *
 * After the first invocation, the shim is gone (overwritten by the heavy
 * module) and every subsequent call hits the real function directly. */
(function () {
  // If the heavy module already loaded (unlikely on first paint but possible
  // after a SPA route change), keep its version.
  if (typeof globalThis.openMvPipelinePanel === "function" &&
      globalThis.openMvPipelinePanel.__cssosShim !== true) {
    return;
  }

  var loadInflight = null;

  function placeholder(opts) {
    var args = arguments;
    // Trigger lazy load + recurse once the heavy version is in place.
    if (typeof globalThis.cssosLoadPanel === "function") {
      if (!loadInflight) loadInflight = globalThis.cssosLoadPanel("mv-pipeline");
      loadInflight.then(function () {
        if (typeof globalThis.openMvPipelinePanel === "function" &&
            globalThis.openMvPipelinePanel.__cssosShim !== true) {
          try { globalThis.openMvPipelinePanel.apply(null, args); }
          catch (err) { console.warn("[mv-pipeline-shim] heavy opener threw:", err); }
        } else {
          console.warn("[mv-pipeline-shim] panel module loaded but didn't expose openMvPipelinePanel");
        }
      }, function (err) {
        console.warn("[mv-pipeline-shim] lazy load failed:", err);
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(
            (typeof globalThis.loginCopy === "function"
              ? globalThis.loginCopy("MV pipeline failed to load. Refresh the app and try again.",
                                     "MV 管线加载失败，请重启 app 重试。")
              : "MV pipeline failed to load.")
          );
        }
      });
    } else {
      // No lazy loader available — try to load the script tag directly.
      var tag = document.querySelector('script[type="cssos-lazy"][data-panel="mv-pipeline"]');
      if (tag) {
        var s = document.createElement("script");
        s.src = tag.getAttribute("src");
        s.async = false;
        s.onload = function () {
          if (typeof globalThis.openMvPipelinePanel === "function" &&
              globalThis.openMvPipelinePanel.__cssosShim !== true) {
            try { globalThis.openMvPipelinePanel.apply(null, args); } catch (_) {}
          }
        };
        document.head.appendChild(s);
      }
    }
    // Best-effort fallback: stash seed for any future consumer.
    if (opts && typeof opts === "object") {
      try {
        globalThis.__cssosMvPipelineSeed = {
          ts: Date.now(),
          seed: opts.seed || opts,
          autoStart: !!opts.autoStart,
          forceNew: !!opts.forceNew,
        };
        try {
          document.dispatchEvent(new CustomEvent("cssos:mv-pipeline-seed", {
            detail: { seed: opts.seed || opts, autoStart: !!opts.autoStart, forceNew: !!opts.forceNew },
          }));
        } catch (_) {}
      } catch (_) {}
    }
    return null;
  }
  placeholder.__cssosShim = true;
  globalThis.openMvPipelinePanel = placeholder;
})();
