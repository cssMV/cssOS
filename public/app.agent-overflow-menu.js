/* CSSOS_WAVE_135 20260513 — Jing
 *
 * Hide the floating 🐛 (bug-capture) and 🪲 (crash-log-dashboard) FABs
 * on iOS native — they clutter the screen and the user wants them
 * folded into the AI assistant bubble.
 *
 * Add a "⋯" overflow button to the AI assistant panel header that
 * exposes:
 *   - 🐛 Report what you see   (calls window.cssosOpenBugReportModal — invoked
 *                                via the existing bug-capture module's modal)
 *   - 🪲 Crash logs            (admin only)
 *   - 📩 Direct messages (W136) (placeholder for now)
 *
 * Hidden surfaces (FABs) still work programmatically — only the icons
 * are hidden. Power users / web admins keep the keyboard-shortcut paths
 * the existing modules already register.
 */
(function () {
  if (globalThis.__cssosAgentOverflowWired) return;
  globalThis.__cssosAgentOverflowWired = true;

  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en) : en;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function injectStyles() {
    if (document.getElementById("cssos-agent-overflow-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-agent-overflow-style";
    st.textContent = [
      /* Hide both bug FABs everywhere. Functionality still reachable
         via the agent panel overflow menu (admin) or programmatic API.
         CSSOS_WAVE_141 fix: the crash-log-dashboard FAB id is actually
         `cssos-crash-dash-btn` (not `cssos-crash-fab`); the wrong
         selector let the 🪲 ladybug keep floating on the bottom-left
         despite W135's intent. */
      "#cssos-bug-fab,#cssos-crash-fab,#cssos-crash-dash-btn{display:none!important;}",
      ".cssos-agent-overflow-menu{position:absolute;top:48px;right:12px;background:#0f1219;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:6px 0;z-index:10001;min-width:200px;box-shadow:0 8px 24px rgba(0,0,0,0.4);}",
      ".cssos-agent-overflow-menu[hidden]{display:none;}",
      ".cssos-agent-overflow-menu .item{display:flex;align-items:center;gap:8px;padding:9px 14px;font:500 13px/1.2 -apple-system,system-ui,sans-serif;color:#e6e8ee;cursor:pointer;border:0;background:transparent;width:100%;text-align:left;}",
      ".cssos-agent-overflow-menu .item:hover{background:rgba(255,255,255,0.06);}",
      ".cssos-agent-overflow-menu .item .glyph{font-size:15px;line-height:1;}",
      ".cssos-agent-overflow-menu .item.disabled{opacity:.5;cursor:not-allowed;}",
      ".cssos-agent-overflow-menu hr{border:0;border-top:1px solid rgba(255,255,255,0.07);margin:4px 0;}",
      "#cssos-agent-overflow-btn{background:transparent;border:0;color:rgba(255,255,255,0.7);cursor:pointer;font-size:18px;line-height:1;padding:4px 8px;border-radius:6px;}",
      "#cssos-agent-overflow-btn:hover{background:rgba(255,255,255,0.08);color:#fff;}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function viewerIsAdmin() {
    try {
      var email = String((globalThis.authState?.user?.email) || "").trim().toLowerCase();
      var ADMIN = ["admin@cssstudio.app", "jingdudc@gmail.com", "jing@cssstudio.app", "vip@cssstudio.app"];
      if (ADMIN.indexOf(email) >= 0) return true;
      if (typeof globalThis.isAdminEmailModule === "function") return !!globalThis.isAdminEmailModule(email);
    } catch (_) {}
    return false;
  }

  function buildMenu(panel) {
    if (panel.querySelector(".cssos-agent-overflow-menu")) return;
    var menu = document.createElement("div");
    menu.className = "cssos-agent-overflow-menu";
    menu.hidden = true;
    var admin = viewerIsAdmin();
    menu.innerHTML = [
      '<button class="item" data-act="bug-report">'
        + '<span class="glyph">🐛</span><span>' + esc(tr("Report what you see", "提交看到的问题")) + '</span>'
        + '</button>',
      admin
        ? '<button class="item" data-act="crash-logs">'
          + '<span class="glyph">🪲</span><span>' + esc(tr("Crash logs", "崩溃日志")) + '</span>'
          + '</button>'
        : '',
      '<hr/>',
      '<button class="item disabled" data-act="dm" title="W136">'
        + '<span class="glyph">📩</span><span>' + esc(tr("Direct messages (coming soon)", "私信（即将上线）")) + '</span>'
        + '</button>',
    ].filter(Boolean).join("");
    panel.appendChild(menu);

    menu.addEventListener("click", function (e) {
      var btn = e.target.closest(".item");
      if (!btn || btn.classList.contains("disabled")) return;
      var act = btn.getAttribute("data-act");
      menu.hidden = true;
      if (act === "bug-report") {
        // The existing bug-capture module installs a global hook.
        // Click its hidden FAB programmatically so its modal opens.
        var bugFab = document.getElementById("cssos-bug-fab");
        if (bugFab && typeof bugFab.click === "function") bugFab.click();
        else if (typeof globalThis.cssosOpenBugReportModal === "function") globalThis.cssosOpenBugReportModal();
      } else if (act === "crash-logs") {
        var crashFab = document.getElementById("cssos-crash-dash-btn")
          || document.getElementById("cssos-crash-fab");
        if (crashFab && typeof crashFab.click === "function") crashFab.click();
      }
    });
  }

  function ensureOverflowBtn() {
    var panel = document.getElementById("cssos-agent-panel");
    if (!panel) return;
    var header = panel.querySelector("header");
    if (!header) return;
    if (header.querySelector("#cssos-agent-overflow-btn")) return;
    injectStyles();
    var btn = document.createElement("button");
    btn.id = "cssos-agent-overflow-btn";
    btn.type = "button";
    btn.title = tr("More", "更多");
    btn.textContent = "⋯";
    var headerActions = header.querySelector("div:last-child") || header;
    headerActions.insertBefore(btn, headerActions.firstChild);
    buildMenu(panel);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var menu = panel.querySelector(".cssos-agent-overflow-menu");
      if (menu) menu.hidden = !menu.hidden;
    });
    document.addEventListener("click", function (e) {
      var menu = panel.querySelector(".cssos-agent-overflow-menu");
      if (!menu || menu.hidden) return;
      if (!menu.contains(e.target) && e.target !== btn) menu.hidden = true;
    });
  }

  function startWatching() {
    injectStyles();
    ensureOverflowBtn();
    var passes = 0;
    var tick = setInterval(function () {
      passes++;
      ensureOverflowBtn();
      if (passes >= 30) clearInterval(tick);
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatching);
  } else {
    startWatching();
  }
})();
