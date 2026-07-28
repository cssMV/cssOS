/**
 * CSSMV_CONTEXT_MENU_FALLBACKS 20260425 #111 — Jing
 * ------------------------------------------------------------------
 *
 *   "右键菜单，有些链接无效，请修复."
 *
 * The context menu's `run` callbacks rely on a chain of helpers that
 * may not exist at click time depending on script load order or
 * partial-module failures. This module installs a click-capture
 * handler on every rendered context-menu item that:
 *
 *   1. Reads the item's label, normalizes it.
 *   2. Looks up a guaranteed fallback action that goes straight to
 *      `document.getElementById(panel-id)` + the lowest-level
 *      `openPanel` available, bypassing any indirection that might
 *      have failed.
 *   3. Falls through to the original click handler so existing
 *      working actions still run as before — we only ACT if the
 *      original action did nothing visible (panel still hidden).
 *
 * This is a belt-and-suspenders fix; it doesn't replace the real
 * menu logic, just guarantees a working dead-link-recovery path for
 * the items the user reported as broken.
 */
(function attachContextMenuFallbacks(global) {
  "use strict";

  const T = (en) => (typeof globalThis.loginCopy === "function" ? globalThis.loginCopy(en) : en);

  // Panel id by canonical action keyword. Keys are matched against
  // the lowercased English part of the menu label.
  const PANEL_BY_ACTION = Object.freeze({
    "language": "language-panel",
    "subscription": "subscription-panel",
    "for you": "foryou-panel",
    "foryou": "foryou-panel",
    "works": "works-panel",
    "works tree": "works-panel",
    "credit": "credit-panel",
    "workspaces": "workspaces-panel",
    "settings": "settings-panel",
    "login": "login-panel",
    "watch": "watch-panel",
    "notifications": "notifications-panel",
    "user panel": "user-admin-panel",
    "users": "user-admin-panel",
    "delivery": "delivery-ops-panel",
    "reports": "delivery-reports-panel",
    "system mvs": "system-mvs-panel",
    "system-mvs": "system-mvs-panel"
  });

  // Optional module openers — preferred over plain openPanel() because
  // they do extra hydration (pull subscription state, refresh works,
  // etc.). Each value is the global function name to try first.
  const MODULE_OPENERS = Object.freeze({
    "subscription-panel": "openSubscriptionPanelModule",
    "credit-panel": "openCreditPanelModule",
    "workspaces-panel": "openWorkspacesPanelModule",
    "works-panel": "openWorksPanelModule",
    "user-admin-panel": "openUserAdminPanelModule",
    "notifications-panel": "openNotificationsPanelModule",
    "system-mvs-panel": "openSystemMvsPanelModule"
  });

  function panelIsVisible(panel) {
    if (!panel) return false;
    if (panel.hidden) return false;
    if (panel.classList.contains("hidden")) return false;
    if (panel.classList.contains("is-hidden")) return false;
    const cs = window.getComputedStyle(panel);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    return true;
  }

  function tryOpen(panelId) {
    if (!panelId) return false;
    const panel = document.getElementById(panelId);
    if (!panel) return false;
    // Prefer a module opener if available — they do extra hydration.
    const moduleName = MODULE_OPENERS[panelId];
    if (moduleName && typeof global[moduleName] === "function") {
      try { global[moduleName](); } catch (_e) { /* fall through */ }
    }
    // Always also call the lowest-level openPanel as a guarantee. The
    // panel may already be open from the module opener; openPanel is
    // idempotent.
    if (typeof global.openPanel === "function") {
      try { global.openPanel(panel); } catch (_e) { /* fall through */ }
    } else if (typeof global.openPanelBridge === "function") {
      try { global.openPanelBridge(panel); } catch (_e) { /* fall through */ }
    } else {
      // Manual fallback — just unhide.
      try {
        panel.hidden = false;
        panel.classList.remove("hidden", "is-hidden");
        panel.style.display = "";
      } catch (_e) { /* no-op */ }
    }
    return panelIsVisible(panel);
  }

  function actionForLabel(label) {
    const norm = String(label || "").toLowerCase().trim();
    // Strip the "Open " prefix; both English ("Open Language") and the
    // Chinese ("打开语言面板") forms are common.
    const stripped = norm.replace(/^(open|打开)\s*/i, "").trim();
    if (PANEL_BY_ACTION[stripped]) return PANEL_BY_ACTION[stripped];
    // Try any keyword that appears in the label.
    for (const key of Object.keys(PANEL_BY_ACTION)) {
      if (stripped.includes(key) || norm.includes(key)) {
        return PANEL_BY_ACTION[key];
      }
    }
    // Localized label fallbacks — match the active-locale term for
    // each panel (the i18n pipeline renders these labels per locale).
    const localizedMap = [
      [T("Language"), "language-panel"],
      [T("Subscription"), "subscription-panel"],
      [T("For You"), "foryou-panel"],
      [T("Works"), "works-panel"],
      [T("Credit"), "credit-panel"],
      [T("Workspaces"), "workspaces-panel"],
      [T("Settings"), "settings-panel"],
      [T("Login"), "login-panel"],
      [T("Watch"), "watch-panel"],
      [T("Notifications"), "notifications-panel"],
      [T("Users"), "user-admin-panel"],
      [T("Delivery"), "delivery-ops-panel"],
      [T("Reports"), "delivery-reports-panel"]
    ];
    for (const [term, panelId] of localizedMap) {
      if (term && norm.includes(String(term).toLowerCase())) return panelId;
    }
    return null;
  }

  // Special-cased actions that aren't simple "open panel" runs.
  function runSpecialAction(label) {
    const norm = String(label || "").toLowerCase().trim();
    if (/refresh|刷新/.test(norm)) {
      try { window.location.reload(); } catch (_e) { /* no-op */ }
      return true;
    }
    if (/^one[\s-]?tap\s*mv|一键\s*mv/.test(norm)) {
      const fns = [
        global.invokeUniversalCreationEntryModule,
        global.invokeUniversalCreationEntry
      ].filter((f) => typeof f === "function");
      if (fns.length) {
        try {
          fns[0]({
            origin: "logo",
            preferredTab: "mv",
            submitVoiceFallback: true
          });
        } catch (_e) { /* no-op */ }
        return true;
      }
    }
    return false;
  }

  // Click-capture handler: runs ANY time a context-menu item is
  // clicked. We let the original handler fire first (we don't
  // preventDefault); after a tick we check if anything actually
  // opened, and if not, we run our fallback.
  document.addEventListener(
    "click",
    function (ev) {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      // The context menu uses .context-menu-item or .menu-item-row;
      // tolerate either, plus a generic selector.
      const item = t.closest(
        ".context-menu-item, .ctx-menu-item, .menu-item-row, .context-menu li, .context-menu button, [role='menuitem']"
      );
      if (!item) return;
      // Read the label from the item — try several common selectors.
      const labelNode =
        item.querySelector(".context-menu-label, .ctx-menu-label, .menu-item-label, .label") ||
        item;
      const label = String(labelNode.textContent || item.textContent || "").trim();
      if (!label) return;

      // Run our fallback right away in PARALLEL with the original
      // handler. If the original handler succeeded, our fallback's
      // tryOpen is idempotent (just keeps the panel open). If it
      // didn't, we ARE the recovery path.
      setTimeout(() => {
        if (runSpecialAction(label)) return;
        const panelId = actionForLabel(label);
        if (!panelId) return;
        const panel = document.getElementById(panelId);
        if (panelIsVisible(panel)) return; // original opener worked
        tryOpen(panelId);
      }, 60);
    },
    true // capture phase so we run early
  );

  // Expose for debugging.
  global.CSSMV_tryOpenContextPanel = tryOpen;
  global.CSSMV_resolveContextPanelId = actionForLabel;
})(typeof globalThis !== "undefined" ? globalThis : window);
