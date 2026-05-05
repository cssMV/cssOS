/**
 * CSSMV_PANEL_DOCK_ORDER 20260425 #116 — Jing
 * ------------------------------------------------------------------
 *
 * Two related fixes per Jing 2026-04-25:
 *
 * 1. PANEL SETTINGS NOT VISIBLE ON LIGHT THEME
 *    style.css `.panel-settings` hardcodes `background: rgba(0,0,0,0.7)`
 *    + `var(--muted)` text. Under light theme `--muted` resolves to
 *    `rgba(28,25,20,0.58)` (dark grey), and the dark bg stays dark — so
 *    labels are dark-on-dark and the flyout looks empty. We layer a
 *    light-theme override that uses `var(--panel-strong)` + `var(--text)`.
 *
 * 2. NEW PER-PANEL DOCK POSITION OPTION
 *    Each panel's settings flyout gets a number input
 *    "Dock position (0,1,2,…)". Regular users override only their own
 *    dock layout via localStorage (`cssos.dock.userOrder.<panelId>`).
 *    Admins set a system-wide default (`cssos.dock.adminOrder.<panelId>`)
 *    that all users see when they have no personal override.
 *    On boot and on every settings change, we reorder `.dock .dock-item`
 *    elements by their resolved order.
 *
 * Storage keys:
 *   `cssos.dock.userOrder.<panelId>`     — number, my override
 *   `cssos.dock.adminOrder.<panelId>`    — number, admin default
 * Resolution:
 *   user override > admin default > original DOM index
 */
(function attachPanelDockOrder(global) {
  "use strict";

  // ---------------------------------------------------------------- styles
  function injectStyles() {
    if (document.getElementById("cssmv-panel-dock-order-styles")) return;
    const st = document.createElement("style");
    st.id = "cssmv-panel-dock-order-styles";
    st.textContent = `
/* CSSMV_PANEL_SETTINGS_THEME 20260425 #116 — restore light-theme paint
 * so the flyout doesn't read as a black-on-black empty bar. */
html[data-theme="light"] .panel-settings {
  background: var(--panel-strong) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important;
  backdrop-filter: blur(14px) saturate(1.04) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.04) !important;
}
html[data-theme="light"] .panel-settings .panel-settings-title {
  color: rgba(28, 25, 20, 0.55) !important;
}
html[data-theme="light"] .panel-settings label {
  color: rgba(28, 25, 20, 0.74) !important;
}
html[data-theme="light"] .panel-settings input[type="text"],
html[data-theme="light"] .panel-settings input[type="number"],
html[data-theme="light"] .panel-settings input[type="range"],
html[data-theme="light"] .panel-settings select,
html[data-theme="light"] .panel-settings textarea {
  background: rgba(255, 252, 247, 0.84) !important;
  color: var(--text) !important;
  border: 1px solid var(--border) !important;
}
/* Even on dark theme, make sure the inner content is actually visible —
 * some legacy CSS leftovers occasionally hide labels via opacity:0. */
.panel-settings * { visibility: visible; }

/* Dock-order slot styling — discreet number input next to existing
 * shortcut/voice fields. */
.cssmv-dock-order-block {
  display: grid !important;
  gap: 6px !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.2em !important;
  color: var(--muted) !important;
}
.cssmv-dock-order-block .cssmv-dock-order-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}
.cssmv-dock-order-block input[type="number"] {
  width: 72px !important;
  padding: 6px 8px !important;
  border-radius: 8px !important;
  border: 1px solid var(--border, rgba(0,245,160,0.25)) !important;
  background: rgba(255,255,255,0.06) !important;
  color: inherit !important;
  text-align: center !important;
}
html[data-theme="light"] .cssmv-dock-order-block input[type="number"] {
  background: rgba(255, 252, 247, 0.84) !important;
}
.cssmv-dock-order-readout {
  font-size: 10px !important;
  letter-spacing: 0.16em !important;
  color: rgba(180, 200, 195, 0.72) !important;
}
html[data-theme="light"] .cssmv-dock-order-readout {
  color: rgba(28, 25, 20, 0.5) !important;
}
.cssmv-dock-order-admin-default {
  font-size: 10px !important;
  letter-spacing: 0.12em !important;
  color: rgba(0, 245, 160, 0.72) !important;
}
html[data-theme="light"] .cssmv-dock-order-admin-default {
  color: rgba(13, 143, 103, 0.78) !important;
}
`;
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- helpers
  function isAdmin() {
    try {
      const u = global.authState && global.authState.user;
      if (!u) return false;
      const role = String(u.role || u.user_role || "").toLowerCase();
      if (role === "admin" || role === "owner" || role === "superadmin") return true;
      if (typeof global.hasPermission === "function") {
        try {
          if (global.hasPermission("admin.panel")) return true;
          if (global.hasPermission("admin")) return true;
        } catch (_e) { /* no-op */ }
      }
      if (Array.isArray(u.permissions) && u.permissions.includes("admin")) return true;
      if (Array.isArray(u.roles) && u.roles.includes("admin")) return true;
    } catch (_e) { /* no-op */ }
    return false;
  }

  function userKey(panelId) {
    return `cssos.dock.userOrder.${panelId}`;
  }
  function adminKey(panelId) {
    return `cssos.dock.adminOrder.${panelId}`;
  }

  function readOrder(panelId) {
    try {
      const u = localStorage.getItem(userKey(panelId));
      if (u !== null && u.trim() !== "") {
        const n = Number(u);
        if (Number.isFinite(n)) return { kind: "user", value: n };
      }
      const a = localStorage.getItem(adminKey(panelId));
      if (a !== null && a.trim() !== "") {
        const n = Number(a);
        if (Number.isFinite(n)) return { kind: "admin", value: n };
      }
    } catch (_e) { /* no-op */ }
    return null;
  }

  function writeUserOrder(panelId, value) {
    try {
      if (value === null || value === undefined || value === "") {
        localStorage.removeItem(userKey(panelId));
        return;
      }
      const n = Number(value);
      if (!Number.isFinite(n)) return;
      localStorage.setItem(userKey(panelId), String(Math.round(n)));
    } catch (_e) { /* no-op */ }
  }

  function writeAdminOrder(panelId, value) {
    try {
      if (value === null || value === undefined || value === "") {
        localStorage.removeItem(adminKey(panelId));
        return;
      }
      const n = Number(value);
      if (!Number.isFinite(n)) return;
      localStorage.setItem(adminKey(panelId), String(Math.round(n)));
    } catch (_e) { /* no-op */ }
  }

  // Map dock-action keyword → panel-id (matches what context-menu-fallbacks
  // already encodes). We use this to compute which order applies to each
  // dock-item without relying on the panel handle being defined yet.
  const ACTION_TO_PANEL = Object.freeze({
    "mic": "logo-panel",
    "foryou": "foryou-panel",
    "cssmv": "cssmv-panel",
    "lyrics": "lyrics-panel",
    "music": "music-panel",
    "video": "video-panel",
    "watch": "watch-panel",
    "notifications": "notifications-panel",
    "about": "about-panel",
    "api": "api-panel",
    "reports": "delivery-reports-panel",
    "delivery-ops": "delivery-ops-panel",
    "login": "login-panel",
    "subscription": "subscription-panel",
    "credit": "credit-panel",
    "workspaces": "workspaces-panel",
    "users": "user-admin-panel",
    "user-admin": "user-admin-panel",
    "settings": "settings-panel",
    "language": "language-panel",
    "profile": "profile-panel",
    "search": "search-panel"
  });

  function panelIdFromDockItem(item) {
    if (!item) return null;
    const action = String(item.dataset.action || "").trim().toLowerCase();
    if (!action) return null;
    return ACTION_TO_PANEL[action] || null;
  }

  // ---------------------------------------------------------------- reorder
  let _reorderScheduled = false;
  function applyDockOrder() {
    _reorderScheduled = false;
    const dock = document.getElementById("dock") || document.querySelector(".dock");
    if (!dock) return;
    const items = Array.from(dock.querySelectorAll(".dock-item"));
    if (!items.length) return;
    items.forEach((el, i) => {
      el.dataset.cssmvOrigIndex = String(i);
    });
    items.sort((a, b) => {
      const pa = panelIdFromDockItem(a);
      const pb = panelIdFromDockItem(b);
      const oa = pa ? readOrder(pa) : null;
      const ob = pb ? readOrder(pb) : null;
      const va = oa ? oa.value : Number(a.dataset.cssmvOrigIndex) + 1000;
      const vb = ob ? ob.value : Number(b.dataset.cssmvOrigIndex) + 1000;
      if (va !== vb) return va - vb;
      // Same priority — preserve original DOM order.
      return Number(a.dataset.cssmvOrigIndex) - Number(b.dataset.cssmvOrigIndex);
    });
    items.forEach((el) => dock.appendChild(el));
  }
  function scheduleApplyDockOrder() {
    if (_reorderScheduled) return;
    _reorderScheduled = true;
    setTimeout(applyDockOrder, 0);
  }

  // ---------------------------------------------------------------- inject UI
  function injectDockOrderField(panelSettings) {
    if (!panelSettings || panelSettings.dataset.cssmvDockOrderInjected === "1") return;
    const panel = panelSettings.closest(".panel");
    if (!panel || !panel.id) return;
    const panelId = panel.id;
    panelSettings.dataset.cssmvDockOrderInjected = "1";

    const block = document.createElement("label");
    block.className = "cssmv-dock-order-block";
    const isAdminUser = isAdmin();
    const adminLabel = isAdminUser ? " (admin default)" : "";
    block.innerHTML = `
      <span>Dock position (0,1,2,…)${adminLabel}</span>
      <span class="cssmv-dock-order-row">
        <input type="number" min="0" step="1" placeholder="—"
               data-cssmv-dock-order-input="${panelId}" />
        <button type="button" class="cssmv-dock-order-clear"
                data-cssmv-dock-order-clear="${panelId}"
                style="padding:4px 10px;border-radius:6px;border:1px solid var(--border,rgba(0,245,160,0.25));background:transparent;color:inherit;cursor:pointer;font-size:10px;">
          Clear
        </button>
      </span>
      <span class="cssmv-dock-order-readout" data-cssmv-dock-order-readout="${panelId}"></span>
    `;
    panelSettings.appendChild(block);

    const input = block.querySelector("[data-cssmv-dock-order-input]");
    const clearBtn = block.querySelector("[data-cssmv-dock-order-clear]");
    const readout = block.querySelector("[data-cssmv-dock-order-readout]");

    function refresh() {
      const cur = readOrder(panelId);
      if (cur) {
        input.value = String(cur.value);
        if (cur.kind === "admin" && !isAdminUser) {
          readout.textContent = `Default ${cur.value} (system)`;
          readout.classList.add("cssmv-dock-order-admin-default");
        } else {
          readout.textContent = cur.kind === "admin"
            ? `Default ${cur.value} (system)`
            : `Yours · ${cur.value}`;
          readout.classList.toggle("cssmv-dock-order-admin-default", cur.kind === "admin");
        }
      } else {
        input.value = "";
        readout.textContent = "Original dock order";
        readout.classList.remove("cssmv-dock-order-admin-default");
      }
    }
    refresh();

    input.addEventListener("input", () => {
      const v = input.value.trim();
      if (isAdminUser) writeAdminOrder(panelId, v);
      else writeUserOrder(panelId, v);
      refresh();
      scheduleApplyDockOrder();
    });
    clearBtn.addEventListener("click", () => {
      if (isAdminUser) writeAdminOrder(panelId, "");
      else writeUserOrder(panelId, "");
      refresh();
      scheduleApplyDockOrder();
    });
  }

  function injectIntoExistingPanels() {
    document.querySelectorAll(".panel .panel-settings").forEach(injectDockOrderField);
  }

  // ---------------------------------------------------------------- close-on-blur
  // The user reported settings flyout doesn't auto-close. We add a
  // single document-level pointerdown handler that closes any open
  // settings flyout when the click lands outside .panel-settings AND
  // outside the panel-actions toolbar (so opening another panel closes
  // the current one).
  function attachBlurClose() {
    if (document.body.dataset.cssmvSettingsBlurBound === "1") return;
    document.body.dataset.cssmvSettingsBlurBound = "1";
    document.addEventListener("pointerdown", (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      // Click inside a flyout: ignore.
      if (t.closest(".panel-settings")) return;
      // Click on the panel-actions settings/maximize/minimize button:
      // existing handler will toggle — leave it alone.
      if (t.closest(".panel-actions")) return;
      // Find any panel currently showing settings.
      document.querySelectorAll(".panel.show-settings").forEach((panel) => {
        // If the click was inside this same panel's BODY (but not the
        // flyout), close the flyout — user is interacting with content.
        if (panel.contains(t)) {
          panel.classList.remove("show-settings");
          const settings = panel.querySelector(".panel-settings");
          if (settings) {
            settings.hidden = true;
            settings.setAttribute("aria-hidden", "true");
          }
          panel.dataset.settingsOpen = "false";
          return;
        }
        // Click outside the panel entirely: also close.
        panel.classList.remove("show-settings");
        const settings = panel.querySelector(".panel-settings");
        if (settings) {
          settings.hidden = true;
          settings.setAttribute("aria-hidden", "true");
        }
        panel.dataset.settingsOpen = "false";
      });
    }, true);
  }

  // ---------------------------------------------------------------- observer
  function attachMutationWatcher() {
    // CSSOS_PHASE2_OBS_DEBOUNCE 20260505 — debounce body-wide observer.
    let tid = 0;
    const obs = new MutationObserver(() => {
      if (tid) return;
      tid = setTimeout(() => { tid = 0; injectIntoExistingPanels(); }, 250);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    injectStyles();
    injectIntoExistingPanels();
    attachMutationWatcher();
    attachBlurClose();
    applyDockOrder();
    // Re-apply order whenever localStorage flips (cross-tab sync).
    window.addEventListener("storage", (ev) => {
      if (!ev || !ev.key) return;
      if (ev.key.startsWith("cssos.dock.userOrder.") || ev.key.startsWith("cssos.dock.adminOrder.")) {
        scheduleApplyDockOrder();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // Public hooks for debugging / programmatic control.
  global.CSSMV_applyDockOrder = applyDockOrder;
  global.CSSMV_setPanelDockOrder = (panelId, value) => {
    if (isAdmin()) writeAdminOrder(panelId, value);
    else writeUserOrder(panelId, value);
    scheduleApplyDockOrder();
  };
  global.CSSMV_clearPanelDockOrder = (panelId) => {
    if (isAdmin()) writeAdminOrder(panelId, "");
    else writeUserOrder(panelId, "");
    scheduleApplyDockOrder();
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
