/**
 * CSSMV_POPUPS_THEME_FIX 20260425 #108 — Jing
 * ------------------------------------------------------------------
 * Two related fixes per Jing 2026-04-25:
 *
 * 1. "Watch 面板都关闭了，开始字体随机切换的提示还在显示。"
 *    The font-shuffle toast (and the info popover) survive the Watch
 *    panel close because their lifetimes are pure timers (4.8 s for
 *    toast, 3 s idle for popover) instead of being scoped to the
 *    panel. Solution: when #watch-panel transitions to hidden / loses
 *    its `is-visible` (or equivalent) class, clear .toast.show and
 *    close the .cssmv-info-popover-fixed immediately.
 *
 * 2. "所有弹出信息，未正确显示白天主题色，还是黑夜主题色，黑黑的，看不清，
 *    版本面板也是，其实还有很多面板也是。"
 *    Several popups hard-code dark backgrounds (rgba(0,0,0,0.7),
 *    rgba(5,10,9,0.92), linear-gradient(rgba(4,16,12,0.96)…) etc.) so
 *    light theme keeps painting black surfaces. Fix: layer a CSS
 *    override that uses theme variables (var(--panel-strong),
 *    var(--text), var(--border), var(--shadow)) for the affected
 *    popups when html[data-theme="light"] is active.
 *
 * Both fixes ship in one tiny module so they can land + deploy
 * together, and so the file count stays sane.
 */
(function attachPopupsThemeFix(global) {
  "use strict";

  // ---------------------------------------------------------------- styles
  function injectStyles() {
    if (document.getElementById("cssmv-popups-theme-fix-styles")) return;
    const st = document.createElement("style");
    st.id = "cssmv-popups-theme-fix-styles";
    // We override by THEME (html[data-theme="light"]) so the existing
    // dark-theme look is preserved exactly. Light theme switches every
    // hard-coded surface to theme-variable values so the popup picks up
    // the day palette (--panel-strong = warm cream, --text = dark plum,
    // --border = quiet sage). Dark theme keeps its existing rules.
    st.textContent = `
/* ---------- Light theme: popups + toasts ------------------------- */
html[data-theme="light"] .toast {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
}

html[data-theme="light"] .cssmv-info-popover-fixed {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
  /* Soft frosted look reads better on cream than the dark blur */
  backdrop-filter: blur(14px) saturate(1.04) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.04) !important;
}

html[data-theme="light"] #cssmv-pipeline-toast {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
}

/* The version menu uses a stacked dark gradient — replace with a
   single theme-aware fill in light mode. */
html[data-theme="light"] .version-menu {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
}
html[data-theme="light"] .version-menu .version-title,
html[data-theme="light"] .version-menu .version-current {
  color: var(--muted) !important;
}

/* Dock settings popover sits over a dark gradient too; same fix. */
html[data-theme="light"] .dock-settings-popover {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
}

/* Generic catch-all: any element styled with a fixed dark rgba bg via
   inline style won't be reachable here, but most legacy popovers use
   class-based styles. The font-shuffle right-click menu in
   app.watch-media-overlays.js sets background via .menuEl CSS — give
   it the same treatment by class. */
html[data-theme="light"] .cssmv-font-settings-menu,
html[data-theme="light"] .cssmv-font-settings-menu * {
  background-color: var(--panel-strong) !important;
  color: var(--text) !important;
  border-color: var(--border) !important;
}
html[data-theme="light"] .cssmv-font-settings-menu select,
html[data-theme="light"] .cssmv-font-settings-menu button,
html[data-theme="light"] .cssmv-font-settings-menu input {
  background: rgba(255, 252, 247, 0.84) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
}

/* Subscription / billing modals + pay-method picker also fall here. */
html[data-theme="light"] .pay-method-picker-overlay,
html[data-theme="light"] .pay-method-picker-modal,
html[data-theme="light"] .generation-boost-prompt-modal,
html[data-theme="light"] .mv-tier-picker-modal,
html[data-theme="light"] .pricing-modal {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
}
`;
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- cleanup hooks
  function clearPopupsAndToasts() {
    // 1. Hide the global #toast (the one fed by globalThis.showToast).
    try {
      const toast = document.getElementById("toast");
      if (toast && toast.classList.contains("show")) {
        toast.classList.remove("show");
        toast.textContent = "";
      }
    } catch (_e) { /* no-op */ }

    // 2. Close the cssmv-info-popover-fixed if it's open.
    try {
      const pop = document.querySelector(".cssmv-info-popover-fixed");
      if (pop) {
        pop.classList.remove("is-open");
      }
      const panel = document.getElementById("watch-panel");
      if (panel) panel.classList.remove("cssmv-info-open");
    } catch (_e) { /* no-op */ }

    // 3. Hide the pipeline toast (cssmv-pipeline-toast) if visible.
    try {
      const ptoast = document.getElementById("cssmv-pipeline-toast");
      if (ptoast) {
        ptoast.style.opacity = "0";
        clearTimeout(ptoast.__hideTimer);
      }
    } catch (_e) { /* no-op */ }

    // 4. Close the font-shuffle right-click menu if it's open.
    try {
      const fsMenu = document.querySelector(".cssmv-font-settings-menu");
      if (fsMenu && fsMenu.parentNode) fsMenu.parentNode.removeChild(fsMenu);
    } catch (_e) { /* no-op */ }
  }

  function isWatchPanelVisible() {
    const panel = document.getElementById("watch-panel");
    if (!panel) return false;
    if (panel.hidden) return false;
    if (panel.classList.contains("is-hidden")) return false;
    if (panel.style.display === "none") return false;
    // Watch panels typically use an `is-visible` or `active` class. If
    // neither is present AND the element isn't being painted, treat as
    // hidden.
    const cs = window.getComputedStyle(panel);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    return true;
  }

  function watchPanelObserver() {
    const panel = document.getElementById("watch-panel");
    if (!panel) return;
    let lastVisible = isWatchPanelVisible();
    const obs = new MutationObserver(() => {
      const nowVisible = isWatchPanelVisible();
      if (lastVisible && !nowVisible) {
        // Panel just closed — clear lingering popups.
        clearPopupsAndToasts();
      }
      lastVisible = nowVisible;
    });
    obs.observe(panel, {
      attributes: true,
      attributeFilter: ["class", "hidden", "style"]
    });
  }

  // Also listen to explicit close events the watch-ui module dispatches.
  function attachExplicitCloseListeners() {
    const handler = () => setTimeout(clearPopupsAndToasts, 0);
    ["cssos:watch-force-close", "cssos:watch-close", "cssos:open-watch-for-run"]
      .forEach((evt) => {
        try {
          document.addEventListener(evt, handler);
          window.addEventListener(evt, handler);
        } catch (_e) { /* no-op */ }
      });
    // Click on the panel-actions close button (×) — fire on capture so
    // we run before any handler that might re-show a toast.
    document.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      const closeBtn = t.closest(
        "#watch-panel .panel-actions .icon-btn[aria-label='Close']," +
        "#watch-panel .panel-actions .icon-btn[data-i18n-aria='action.close']"
      );
      if (!closeBtn) return;
      setTimeout(clearPopupsAndToasts, 0);
      // Also fire after the close animation completes (~300ms).
      setTimeout(clearPopupsAndToasts, 350);
    }, true);
  }

  function boot() {
    injectStyles();
    watchPanelObserver();
    attachExplicitCloseListeners();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // Expose for manual debug.
  global.CSSMV_clearPopupsAndToasts = clearPopupsAndToasts;
})(typeof globalThis !== "undefined" ? globalThis : window);
