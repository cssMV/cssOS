/* CSSOS_WAVE_138 20260514 — Jing
 *
 * Direct-message inbox indicator on the AI assistant FAB.
 *
 * Polls /api/dm/unread-count every 60 seconds (or on focus). If > 0,
 * paints a red dot with the count on the 💬 FAB. When the user opens
 * the chat panel and clicks the new "Inbox" menu item, fetches
 * /api/dm/inbox and renders unread messages as system bubbles, then
 * marks all read.
 *
 * No-op for signed-out users.
 */
(function () {
  if (globalThis.__cssosDmIndicatorWired) return;
  globalThis.__cssosDmIndicatorWired = true;

  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en) : en;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function injectStyles() {
    if (document.getElementById("cssos-dm-indicator-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-dm-indicator-style";
    st.textContent = [
      /* CSSOS_WAVE_143 20260514 — DO NOT set position:relative on
         #cssos-agent-fab here. It already has position:fixed from
         app.agent-chat.js, which IS a positioning context for the
         absolutely-positioned dot below. Forcing relative undid the
         fixed positioning and dropped the FAB to bottom-left. */
      "#cssos-dm-dot{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ff5060;color:#fff;font:700 11px/18px ui-monospace,monospace;text-align:center;border:2px solid #0a0d12;pointer-events:none;}",
      "#cssos-dm-dot[hidden]{display:none;}",
      ".cssos-dm-bubble{margin:8px 0;padding:10px 12px;border-radius:10px;background:rgba(80,140,255,0.10);border:1px solid rgba(80,140,255,0.32);color:#dde6ff;font:500 12.5px/1.45 -apple-system,system-ui,sans-serif;}",
      ".cssos-dm-bubble .from{font-weight:700;color:#a8c5ff;font-size:11px;letter-spacing:.02em;text-transform:uppercase;margin-bottom:4px;}",
      ".cssos-dm-bubble .body{white-space:pre-wrap;}",
      ".cssos-dm-bubble .when{font-size:10px;color:rgba(221,230,255,0.5);margin-top:4px;font-family:ui-monospace,monospace;}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function ensureDot() {
    var fab = document.getElementById("cssos-agent-fab");
    if (!fab) return null;
    var dot = document.getElementById("cssos-dm-dot");
    if (!dot) {
      injectStyles();
      dot = document.createElement("span");
      dot.id = "cssos-dm-dot";
      dot.hidden = true;
      fab.appendChild(dot);
    }
    return dot;
  }

  async function poll() {
    try {
      var r = await fetch("/api/dm/unread-count", { credentials: "include" });
      if (!r.ok) return;
      var j = await r.json();
      if (!j || !j.ok) return;
      var n = Number(j.unread || 0);
      var dot = ensureDot();
      if (!dot) return;
      if (n > 0) {
        dot.textContent = String(n > 99 ? "99+" : n);
        dot.hidden = false;
      } else {
        dot.hidden = true;
      }
    } catch (_) {}
  }

  async function openInbox() {
    var messages = document.getElementById("cssos-agent-messages");
    if (!messages) return;
    try {
      var r = await fetch("/api/dm/inbox", { credentials: "include" });
      var j = await r.json();
      if (!r.ok || !j.ok) return;
      var rows = j.messages || [];
      if (!rows.length) {
        var sys = document.createElement("div");
        sys.className = "cssos-dm-bubble";
        sys.textContent = tr("Inbox is empty.", "收件箱是空的。");
        messages.appendChild(sys);
        messages.scrollTop = messages.scrollHeight;
        return;
      }
      injectStyles();
      rows.forEach(function (m) {
        var who = m.sender_name || (m.sender_username ? "@" + m.sender_username : tr("Anonymous","匿名"));
        var when = "";
        try { when = new Date(m.created_at).toLocaleString(); } catch (_) {}
        var el = document.createElement("div");
        el.className = "cssos-dm-bubble";
        el.innerHTML = ''
          + '<div class="from">📩 ' + esc(who) + '</div>'
          + '<div class="body">' + esc(m.body) + '</div>'
          + (when ? '<div class="when">' + esc(when) + '</div>' : '');
        messages.appendChild(el);
      });
      messages.scrollTop = messages.scrollHeight;
      // Mark all read.
      try {
        await fetch("/api/dm/mark-read", {
          method: "POST", credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ all: true }),
        });
        var dot = ensureDot();
        if (dot) dot.hidden = true;
      } catch (_) {}
    } catch (_) {}
  }

  function wireInboxMenuItem() {
    // Inject a new "📩 Inbox" item into the agent overflow menu (W135).
    var menu = document.querySelector(".cssos-agent-overflow-menu");
    if (!menu) return;
    if (menu.querySelector('[data-act="dm-inbox"]')) return;
    // Replace the disabled placeholder with a working item.
    var placeholder = menu.querySelector('[data-act="dm"]');
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item";
    btn.setAttribute("data-act", "dm-inbox");
    btn.innerHTML = '<span class="glyph">📩</span><span>' + esc(tr("Inbox", "收件箱")) + '</span>';
    btn.addEventListener("click", function () {
      // Make sure the chat panel is open.
      var panel = document.getElementById("cssos-agent-panel");
      if (panel && panel.getAttribute("data-open") !== "1") {
        var fab = document.getElementById("cssos-agent-fab");
        if (fab && typeof fab.click === "function") fab.click();
      }
      menu.hidden = true;
      openInbox();
    });
    if (placeholder) placeholder.replaceWith(btn);
    else menu.appendChild(btn);
  }

  function start() {
    ensureDot();
    poll();
    setInterval(poll, 60000);
    window.addEventListener("focus", poll);
    // Wire the menu item once the W135 overflow menu has rendered.
    var passes = 0;
    var tick = setInterval(function () {
      passes++;
      wireInboxMenuItem();
      if (passes >= 20) clearInterval(tick);
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
