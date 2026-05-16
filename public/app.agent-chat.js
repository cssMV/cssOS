/* CSSOS_WAVE_117 20260513 — Jing
 *
 * Agent chat — floating 💬 bottom-right button that opens a side
 * panel for conversational MV creation. Talks to /api/agent/chat
 * (claude-sonnet-4-5 + tool use). When the agent emits a seed, we
 * render a "Create this MV" button that routes straight into the
 * existing MV Pipeline panel.
 *
 *   - Auth-gated: signed-out users see a sign-in prompt
 *   - Locale-aware: ui_locale sent so agent replies in user's language
 *   - Session-scoped: a stable session_id stored in sessionStorage
 *   - Streamable-feel: shows "typing" indicator + tool-call breadcrumbs
 *   - Rate-limit aware: surfaces 429 + remaining-turns counter
 */
(function () {
  if (globalThis.__cssosAgentChatWired) return;
  globalThis.__cssosAgentChatWired = true;

  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en)
      : en;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function uiLocale() {
    try {
      return (localStorage.getItem("CSSOS_LANG") || localStorage.getItem("cssos.locale") || "en").toLowerCase();
    } catch (_) { return "en"; }
  }
  function ensureSessionId() {
    // CSSOS_WAVE_152 20260514 — Jing: 请保存聊天记录，除非用户手动清除.
    // session_id moved from sessionStorage → localStorage so it
    // survives closing the app / tab. The server now persists the
    // conversation in agent_chat_sessions, so the same id rehydrates
    // the full thread on next launch. Migrate any legacy sessionStorage
    // id forward so an in-progress conversation isn't orphaned.
    try {
      var sid = localStorage.getItem("cssos.agent.session_id");
      if (sid) return sid;
      var legacy = null;
      try { legacy = sessionStorage.getItem("cssos.agent.session_id"); } catch (_) {}
      sid = legacy || ("s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8));
      localStorage.setItem("cssos.agent.session_id", sid);
      return sid;
    } catch (_) {
      try {
        var s2 = sessionStorage.getItem("cssos.agent.session_id");
        if (s2) return s2;
        s2 = "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem("cssos.agent.session_id", s2);
        return s2;
      } catch (_e) { return "fallback"; }
    }
  }

  function injectStyles() {
    if (document.getElementById("cssos-agent-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-agent-style";
    st.textContent = [
      "#cssos-agent-fab{position:fixed;right:18px;bottom:18px;width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#00f5a0,#00b87a);color:#0a0d12;border:0;font-size:24px;cursor:pointer;z-index:9800;box-shadow:0 6px 22px rgba(0,245,160,0.32);transition:transform 160ms ease;}",
      "#cssos-agent-fab:hover{transform:scale(1.06);}",
      "#cssos-agent-fab[data-active='1']{background:linear-gradient(135deg,#ff9a3c,#ff6b6b);}",
      "#cssos-agent-panel{position:fixed;right:18px;bottom:84px;width:min(420px,calc(100vw - 36px));height:min(620px,calc(100vh - 120px));background:#0d1117;color:#e6e8ee;border:1px solid rgba(255,255,255,0.12);border-radius:16px;display:none;flex-direction:column;z-index:9801;box-shadow:0 12px 40px rgba(0,0,0,0.55);overflow:hidden;}",
      "#cssos-agent-panel[data-open='1']{display:flex;}",
      "#cssos-agent-panel header{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;font:600 14px/1 -apple-system,system-ui,sans-serif;}",
      "#cssos-agent-panel header .title{display:flex;gap:8px;align-items:center;}",
      "#cssos-agent-panel header .meta{font:500 11px/1 ui-monospace,monospace;color:#8a8f99;}",
      "#cssos-agent-panel header button{background:transparent;border:0;color:#9aa;cursor:pointer;font-size:18px;padding:4px 8px;border-radius:6px;}",
      "#cssos-agent-panel header button:hover{background:rgba(255,255,255,0.06);color:#fff;}",
      "#cssos-agent-messages{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;}",
      ".cssos-agent-msg{max-width:88%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}",
      ".cssos-agent-msg.user{background:rgba(0,245,160,0.12);border:1px solid rgba(0,245,160,0.28);align-self:flex-end;}",
      ".cssos-agent-msg.assistant{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);align-self:flex-start;}",
      ".cssos-agent-msg.system{background:rgba(255,180,80,0.08);border:1px solid rgba(255,180,80,0.28);align-self:center;font-size:11.5px;color:#ffc878;}",
      ".cssos-agent-tools{font:500 11px/1.4 ui-monospace,monospace;color:#79b8ff;margin-top:6px;opacity:0.78;}",
      /* W162 — clickable links inside assistant messages. cssMV links
         open the MV panel in-app; underline + accent so they read as
         tappable, with word-break so long UUIDs wrap inside the bubble. */
      ".cssos-agent-link{color:#5effc9;text-decoration:underline;text-underline-offset:2px;cursor:pointer;word-break:break-all;}",
      ".cssos-agent-link:hover{color:#9affda;}",
      "a[data-cssmv].cssos-agent-link{font-weight:600;}",
      /* W140 — per-message copy button (📋) below the body. */
      ".cssos-agent-msg-actions{display:flex;justify-content:flex-end;margin-top:6px;opacity:0.55;}",
      ".cssos-agent-msg-actions .copy-btn{background:transparent;border:0;color:inherit;padding:2px 6px;border-radius:5px;font-size:12px;cursor:pointer;line-height:1;}",
      ".cssos-agent-msg-actions .copy-btn:hover{background:rgba(255,255,255,0.08);opacity:1;}",
      ".cssos-agent-msg:hover .cssos-agent-msg-actions{opacity:1;}",
      ".cssos-agent-typing{align-self:flex-start;color:#9aa;font-size:13px;font-style:italic;}",
      ".cssos-agent-seed-card{align-self:flex-start;background:rgba(0,245,160,0.08);border:1px solid rgba(0,245,160,0.36);border-radius:12px;padding:10px 12px;margin-top:6px;display:flex;flex-direction:column;gap:8px;max-width:92%;}",
      ".cssos-agent-seed-card .label{font:600 11px/1 ui-monospace,monospace;color:#00f5a0;letter-spacing:.06em;}",
      ".cssos-agent-seed-card .prompt{font-size:13.5px;color:#daffee;white-space:pre-wrap;}",
      ".cssos-agent-seed-card .meta{font-size:11px;color:#9aa;font-family:ui-monospace,monospace;}",
      ".cssos-agent-seed-card button{align-self:flex-start;padding:6px 14px;border-radius:999px;border:0;background:linear-gradient(135deg,#00f5a0,#00b87a);color:#0a0d12;font-weight:700;cursor:pointer;font-size:13px;}",
      "#cssos-agent-input-row{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,0.08);}",
      "#cssos-agent-input{flex:1;min-height:36px;max-height:120px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#daffee;padding:8px 10px;font:inherit;resize:none;font-size:13.5px;}",
      "#cssos-agent-input:focus{outline:none;border-color:rgba(0,245,160,0.55);}",
      "#cssos-agent-send{background:linear-gradient(135deg,#00f5a0,#00b87a);color:#0a0d12;border:0;padding:0 16px;border-radius:10px;cursor:pointer;font-weight:700;font-size:13px;}",
      "#cssos-agent-send[disabled]{opacity:0.5;cursor:default;}",
      "#cssos-agent-suggestions{padding:8px 12px 0;display:flex;flex-wrap:wrap;gap:6px;}",
      ".cssos-agent-suggestion{padding:5px 10px;border-radius:999px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#daffee;font-size:11.5px;cursor:pointer;}",
      ".cssos-agent-suggestion:hover{background:rgba(0,245,160,0.12);border-color:rgba(0,245,160,0.32);}",
      "@media (max-width: 540px){#cssos-agent-panel{right:9px;bottom:78px;width:calc(100vw - 18px);height:calc(100vh - 100px);}#cssos-agent-fab{right:12px;bottom:12px;}}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function build() {
    if (document.getElementById("cssos-agent-fab")) return;
    injectStyles();

    var fab = document.createElement("button");
    fab.id = "cssos-agent-fab";
    fab.type = "button";
    fab.title = tr("Chat with the cssOS Creative Assistant", "和 cssOS 创作助手聊一聊");
    fab.textContent = "💬";
    fab.addEventListener("click", togglePanel);
    document.body.appendChild(fab);

    var panel = document.createElement("section");
    panel.id = "cssos-agent-panel";
    panel.setAttribute("data-open", "0");
    panel.innerHTML = [
      '<header>',
      '  <div class="title">🤖 ' + esc(tr("cssOS Assistant", "cssOS 创作助手")) + '</div>',
      '  <div style="display:flex;gap:4px;align-items:center;">',
      '    <span class="meta" id="cssos-agent-meta"></span>',
      // CSSOS_WAVE_133 — the Wave 130 header 🐛 button was REMOVED: it
      // duplicated the "Report a bug / diagnose" item already living in
      // the ⋯ overflow menu (app.agent-overflow-menu.js). One entry
      // point only — inside the ⋯ dropdown.
      '    <button type="button" data-act="clear" title="' + esc(tr("Clear conversation", "清空对话")) + '">🗑️</button>',
      '    <button type="button" data-act="close" title="' + esc(tr("Close", "关闭")) + '">✕</button>',
      '  </div>',
      '</header>',
      '<div id="cssos-agent-suggestions"></div>',
      '<div id="cssos-agent-messages" role="log" aria-live="polite"></div>',
      '<div id="cssos-agent-input-row">',
      '  <textarea id="cssos-agent-input" rows="1" placeholder="' + esc(tr("Tell me what you want to create…", "告诉我你想创作什么…")) + '"></textarea>',
      '  <button type="button" id="cssos-agent-send">' + esc(tr("Send", "发送")) + '</button>',
      '</div>',
    ].join("");
    document.body.appendChild(panel);

    panel.querySelector('[data-act="close"]').addEventListener("click", togglePanel);
    panel.querySelector('[data-act="clear"]').addEventListener("click", clearConversation);
    // CSSOS_WAVE_133 — the 🐛 report button wiring was removed with the
    // button itself; "Report a bug / diagnose" lives in the ⋯ overflow
    // menu (app.agent-overflow-menu.js), which calls cssosOpenBugReport.

    var input = panel.querySelector("#cssos-agent-input");
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendCurrent();
      }
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(120, input.scrollHeight) + "px";
    });
    // CSSOS_WAVE_167 20260515 — Jing: 允许粘贴图片进 AI 助理 (like this
    // very chat). Paste handler captures any image/* clipboard item,
    // reads it as base64, appends to pendingImages, and previews a
    // thumbnail strip above the input. On send (sendCurrent) the
    // images go in the request body alongside the text.
    input.addEventListener("paste", function (e) {
      try {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        var captured = 0;
        for (var i = 0; i < items.length; i += 1) {
          var it = items[i];
          if (!it || it.kind !== "file") continue;
          var t = String(it.type || "").toLowerCase();
          if (t.indexOf("image/") !== 0) continue;
          var f = it.getAsFile();
          if (f) { captured += 1; readImageFile(f); }
        }
        if (captured) e.preventDefault();
      } catch (_) {}
    });
    panel.querySelector("#cssos-agent-send").addEventListener("click", sendCurrent);

    // CSSOS_WAVE_131 20260514 — Jing: "AI 助理小窗应该可以拖拽，不然会
    // 挡住别的面板". Drag by the header. Switches the panel from
    // right/bottom anchoring to left/top on first drag, clamps to the
    // viewport, and persists the position to localStorage so it stays
    // where the user left it across sessions.
    makeAgentPanelDraggable(panel, panel.querySelector("header"));

    renderSuggestions();
  }

  var DRAG_POS_KEY = "cssos.agent.panel.pos.v1";
  function makeAgentPanelDraggable(panel, handle) {
    if (!panel || !handle) return;
    // Restore a saved position if present.
    try {
      var saved = JSON.parse(localStorage.getItem(DRAG_POS_KEY) || "null");
      if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
        applyPanelPos(panel, saved.left, saved.top);
      }
    } catch (_e) {}

    handle.style.cursor = "move";
    handle.style.touchAction = "none";
    var dragging = false, startX = 0, startY = 0, baseLeft = 0, baseTop = 0;

    function onDown(e) {
      // Ignore drags that start on the header buttons (🐛 / 🗑️ / ✕).
      if (e.target && e.target.closest && e.target.closest("button")) return;
      var pt = e.touches ? e.touches[0] : e;
      var rect = panel.getBoundingClientRect();
      dragging = true;
      startX = pt.clientX;
      startY = pt.clientY;
      baseLeft = rect.left;
      baseTop = rect.top;
      // Pin to left/top so dragging is absolute, not anchored to right/bottom.
      applyPanelPos(panel, baseLeft, baseTop);
      document.addEventListener("pointermove", onMove, { passive: false });
      document.addEventListener("pointerup", onUp, { passive: true });
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp, { passive: true });
      e.preventDefault && e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var pt = e.touches ? e.touches[0] : e;
      var nx = baseLeft + (pt.clientX - startX);
      var ny = baseTop + (pt.clientY - startY);
      applyPanelPos(panel, nx, ny);
      e.preventDefault && e.preventDefault();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      var rect = panel.getBoundingClientRect();
      try {
        localStorage.setItem(DRAG_POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
      } catch (_e) {}
    }
    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("touchstart", onDown, { passive: false });
    // Re-clamp into view on viewport resize so it never strands offscreen.
    window.addEventListener("resize", function () {
      var rect = panel.getBoundingClientRect();
      applyPanelPos(panel, rect.left, rect.top);
    });
  }
  function applyPanelPos(panel, left, top) {
    var w = panel.offsetWidth || 420;
    var h = panel.offsetHeight || 600;
    var maxL = Math.max(0, window.innerWidth - w);
    var maxT = Math.max(0, window.innerHeight - h);
    var L = Math.max(0, Math.min(maxL, left));
    var T = Math.max(0, Math.min(maxT, top));
    panel.style.left = L + "px";
    panel.style.top = T + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function renderSuggestions() {
    var host = document.getElementById("cssos-agent-suggestions");
    if (!host) return;
    var loc = uiLocale();
    var seeds = loc.indexOf("zh") === 0 ? [
      "为我做一首孔子 × 杏坛的歌剧",
      "拿破仑 × 凯旋门，单曲就行",
      "Beethoven × Musikverein，三部曲",
      "孙悟空 × 凌霄宝殿，唐风",
    ] : loc.indexOf("ja") === 0 ? [
      "紫式部 × 源氏物語の単曲",
      "葛飾北斎 × 富士山",
      "Beethoven × Musikverein, opera",
    ] : [
      "Confucius × Apricot Altar, opera",
      "Napoleon × Arc de Triomphe, single",
      "Beethoven × Musikverein, triptych",
      "Sun Wukong × Lingxiao Palace",
    ];
    host.innerHTML = seeds.map(function (s) {
      return '<button type="button" class="cssos-agent-suggestion">' + esc(s) + '</button>';
    }).join("");
    host.querySelectorAll(".cssos-agent-suggestion").forEach(function (b) {
      b.addEventListener("click", function () {
        var input = document.getElementById("cssos-agent-input");
        if (input) {
          input.value = b.textContent;
          input.focus();
          sendCurrent();
        }
      });
    });
  }

  // CSSOS_WAVE_184 20260516 — Jing: AI 助理只许登录用户用；游客挡掉.
  // The endpoint already returns 401 for guests, but we'd rather show
  // a clean prompt at panel-open than let the user type a message
  // and bounce off "sign-in required". Auth check reads the same
  // authState the rest of the app uses.
  function viewerIsSignedIn() {
    try {
      var uid = String(globalThis.authState && globalThis.authState.user && globalThis.authState.user.id || "").trim();
      return !!uid;
    } catch (_) { return false; }
  }
  function promptGuestSignIn() {
    try {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tr(
          "Sign in to use the AI Assistant — free users get 3 creations (up to one triptych).",
          "AI 助理需要登录使用 — 免费用户可创作 3 次（足够输出一首三部曲）。"
        ));
      }
    } catch (_) {}
    try {
      var loginPanel = document.getElementById("login-panel");
      if (loginPanel && typeof globalThis.openPanelModule === "function") {
        globalThis.openPanelModule("login-panel");
      } else if (typeof globalThis.openLoginPanel === "function") {
        globalThis.openLoginPanel();
      }
    } catch (_) {}
  }

  function togglePanel() {
    var panel = document.getElementById("cssos-agent-panel");
    var fab = document.getElementById("cssos-agent-fab");
    if (!panel) return;
    var open = panel.getAttribute("data-open") === "1";
    if (open) {
      panel.setAttribute("data-open", "0");
      fab.setAttribute("data-active", "0");
    } else {
      // CSSOS_WAVE_184 — guests can't open the assistant.
      if (!viewerIsSignedIn()) {
        promptGuestSignIn();
        return;
      }
      panel.setAttribute("data-open", "1");
      fab.setAttribute("data-active", "1");
      hydrateSessionFromServer();
      var input = document.getElementById("cssos-agent-input");
      if (input) setTimeout(function () { input.focus(); }, 50);
    }
  }

  async function hydrateSessionFromServer() {
    var messages = document.getElementById("cssos-agent-messages");
    if (!messages) return;
    if (messages.childElementCount > 0) return; // already populated this open
    try {
      var r = await fetch("/api/agent/session?session_id=" + encodeURIComponent(ensureSessionId()), {
        credentials: "include",
      });
      var j = await r.json();
      if (!j.ok) {
        if (r.status === 401) {
          renderSystem(tr("Sign in to use the assistant.", "请登录后使用创作助手。"));
        }
        updateMeta(null);
        return;
      }
      updateMeta(j);
      if (Array.isArray(j.messages) && j.messages.length) {
        j.messages.forEach(function (m) {
          // CSSOS_WAVE_161 20260515 — Jing: re-render the rich work-cards
          // on session re-hydration. Previously only m.text was rendered,
          // so a created MV's clickable card vanished on every reopen.
          // CSSOS_WAVE_163 — Jing: "聊天信息一刷新就消失." Each entry is
          // now isolated in its own try/catch: if ONE message (or its
          // cards) fails to render, the rest of the conversation still
          // shows instead of the whole panel going blank.
          try {
            if (m && Array.isArray(m.work_cards) && m.work_cards.length) {
              renderWorkCards(m.work_cards);
              return;
            }
            // CSSOS_WAVE_167 — render text + image-attachment thumbnails
            // on rehydrate. Image-only turns (no text) still render so
            // the user sees what they pasted.
            if (m && (m.text || (Array.isArray(m.images) && m.images.length))) {
              renderMsg(m.role, m.text || "", m.tool_calls, m.images);
            }
          } catch (err) {
            try { console.warn("[agent-chat] hydrate entry render failed", err); } catch (_) {}
          }
        });
      } else {
        renderSystem(tr(
          "Hi — tell me a person, a place, or both, and I'll help you compose an MV.",
          "你好 —— 告诉我一个人物、一个地点、或两者的组合，我帮你做一支 MV。"
        ));
      }
    } catch (_) {
      renderSystem(tr("Assistant offline. Try again later.", "助手暂时不可用，请稍后再试。"));
    }
  }

  function updateMeta(j) {
    var meta = document.getElementById("cssos-agent-meta");
    if (!meta) return;
    if (!j) { meta.textContent = ""; return; }
    var used = Number(j.turns_this_hour || 0);
    var cap = Number(j.turns_per_hour_limit || 60);
    meta.textContent = used + "/" + cap;
  }

  /* CSSOS_WAVE_162 20260515 — Jing: "AI助理无法显示正常的链接吗？哪怕
   * 我复制了链接也无法打开，正确应该是启动 MV 面板欣赏的。"
   *
   * Open a work by id straight into the MV panel — same path the rich
   * work-card's ▶ button uses. Hoisted to module scope so both the
   * card renderer and the in-message linkifier share one entry point. */
  function openWorkById(wid) {
    wid = String(wid || "").trim();
    if (!wid) return;
    // CSSOS_WAVE_168 20260515 — Jing: 点击链接导致整个系统冻结。
    // Root cause: openMarketWorkPreview synchronously opens the MV
    // panel + cinema overlay + (when the freshly-created work has no
    // audio/video yet) sits in an infinite "waiting for media" state
    // that captures every click. The user couldn't dismiss it.
    //
    // Safer path: ALWAYS navigate to /?cssMV=<id>. app.share-link-
    // router.js boots, fetches the work, drops a single-entry loop_
    // single playlist, and opens the panel cleanly. If the work has
    // no media yet, the panel shows a normal placeholder with a usable
    // close button — never a frozen overlay. Same-tab nav also lets
    // the user use the browser back button to return to the chat.
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("cssMV", wid);
      window.location.href = url.toString();
    } catch (_) {
      window.location.href = "/?cssMV=" + encodeURIComponent(wid);
    }
  }

  /* Extract a cssMV work-id from any href shape we might emit or the
   * agent might type: "/?cssMV=<id>", "?cssMV=<id>",
   * "https://host/?cssMV=<id>", "/?mv=<id>". Returns "" when none. */
  function cssMvIdFromHref(href) {
    var s = String(href || "");
    var m = s.match(/[?&](?:cssMV|mv)=([0-9a-fA-F-]{8,64})/);
    return m ? m[1] : "";
  }

  /* Turn a plain-text message body into HTML with clickable links.
   * Handles markdown links [label](url) and bare URLs. cssMV links are
   * rewritten to absolute URLs (so a copied link actually works) and
   * tagged data-cssmv so the click handler opens the MV panel in-app
   * instead of navigating away. */
  function linkifyInto(el, rawText) {
    var text = String(rawText == null ? "" : rawText);
    var html = esc(text);
    var origin = "";
    try { origin = window.location.origin; } catch (_) { origin = ""; }
    function anchor(label, href) {
      var mv = cssMvIdFromHref(href);
      var absHref = href;
      if (mv) {
        // Always emit an absolute URL so copy-paste works off-app.
        absHref = origin + "/?cssMV=" + mv;
        return '<a class="cssos-agent-link" data-cssmv="' + esc(mv) +
          '" href="' + esc(absHref) + '">' + label + '</a>';
      }
      // Non-cssMV link — open in a new tab, leave as-is.
      if (/^(https?:)?\/\//i.test(href) || href.charAt(0) === "/") {
        return '<a class="cssos-agent-link" target="_blank" rel="noopener" href="' +
          esc(href) + '">' + label + '</a>';
      }
      return label; // not a recognizable URL — leave plain
    }
    // 1. Markdown links [label](url) — label/url are already escaped.
    html = html.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (_m, label, url) {
      return anchor(label, url);
    });
    // 2. Bare URLs not already inside an <a> we just made. Match
    //    http(s):// … and absolute "/?cssMV=" / "?cssMV=" forms.
    html = html.replace(
      /(^|[\s(])((?:https?:\/\/[^\s<)]+)|(?:\/?\?(?:cssMV|mv)=[0-9a-fA-F-]{8,64}))/g,
      function (_m, pre, url) {
        // Skip if this looks like it's already inside an href="" we built.
        return pre + anchor(url, url);
      }
    );
    el.innerHTML = html;
    // Wire cssMV links to the in-app MV panel opener.
    try {
      el.querySelectorAll("a[data-cssmv]").forEach(function (a) {
        a.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          openWorkById(a.getAttribute("data-cssmv"));
        });
      });
    } catch (_) {}
  }

  function renderMsg(role, text, toolCalls, images) {
    var messages = document.getElementById("cssos-agent-messages");
    if (!messages) return;
    var div = document.createElement("div");
    div.className = "cssos-agent-msg " + (role === "assistant" ? "assistant" : role === "system" ? "system" : "user");
    // CSSOS_WAVE_140 20260514 — Jing: 信息下方加复制图标. Single copy
    // button below every message body. Pointer-cursor + subtle hover.
    var bodyEl = document.createElement("div");
    bodyEl.className = "cssos-agent-msg-body";
    // CSSOS_WAVE_162 — assistant / system bodies get clickable links
    // (markdown + bare URLs); user input stays literal plain text.
    // CSSOS_WAVE_163 — linkify is best-effort: if it ever throws on a
    // weird message, fall back to plain text rather than letting the
    // exception bubble up and blank the whole chat on re-hydration.
    if (role === "assistant" || role === "system") {
      try { linkifyInto(bodyEl, text); }
      catch (_e) { bodyEl.textContent = String(text == null ? "" : text); }
    } else {
      bodyEl.textContent = text;
    }
    div.appendChild(bodyEl);
    // CSSOS_WAVE_167 — render attached image thumbnails inside the
    // message bubble. Same DOM whether it's a live send (data: URL
    // preview) or a re-hydrate (persisted /artifacts/... URL).
    if (Array.isArray(images) && images.length) {
      ensureAttachStripStyles();
      var imgWrap = document.createElement("div");
      imgWrap.className = "cssos-agent-msg-images";
      images.forEach(function (src) {
        if (!src) return;
        var a = document.createElement("a");
        a.href = src;
        a.target = "_blank";
        a.rel = "noopener";
        a.style.backgroundImage = "url(\"" + String(src).replace(/"/g, "%22") + "\")";
        imgWrap.appendChild(a);
      });
      div.appendChild(imgWrap);
    }
    if (Array.isArray(toolCalls) && toolCalls.length) {
      var tools = document.createElement("div");
      tools.className = "cssos-agent-tools";
      tools.textContent = "🛠 " + toolCalls.map(function (t) {
        return typeof t === "string" ? t : (t.name || "?");
      }).join(" · ");
      div.appendChild(tools);
    }
    var actions = document.createElement("div");
    actions.className = "cssos-agent-msg-actions";
    // CSSOS_WAVE_140 fix — use the same ⧉ (U+29C9 Two-Joined-Squares)
    // glyph that app.context-menu.js uses for "Copy", instead of 📋.
    // Matches the existing comment/notification widget style across the
    // app.
    actions.innerHTML = '<button type="button" class="copy-btn" title="' + esc(tr("Copy","复制")) + '" aria-label="' + esc(tr("Copy","复制")) + '">⧉</button>';
    actions.querySelector(".copy-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(text);
        } else {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed"; ta.style.left = "-9999px";
          document.body.appendChild(ta); ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        var btn = actions.querySelector(".copy-btn");
        var prev = btn.textContent;
        btn.textContent = "✓";
        setTimeout(function () { btn.textContent = prev; }, 1200);
      } catch (err) { /* ignore */ }
    });
    div.appendChild(actions);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
  function renderSystem(text) { renderMsg("system", text, null); }
  function renderTyping() {
    var messages = document.getElementById("cssos-agent-messages");
    if (!messages) return null;
    var div = document.createElement("div");
    div.className = "cssos-agent-typing";
    div.id = "cssos-agent-typing";
    div.textContent = tr("Thinking…", "思考中…");
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }
  function clearTyping() {
    var el = document.getElementById("cssos-agent-typing");
    if (el) el.remove();
  }

  /* CSSOS_WAVE_174 20260515 — Jing: 接近零门槛创作.
   *   "用户输入 prompt，AI 回应 Creating this MV，自动启动 MV 面板
   *    （MV PIPELINE 在后台走流程），像人物 MV 进入 MV 面板那样，
   *    用户只需要看着进度条…拿到作品时长就马上显示。"
   * The seed card no longer asks for a confirm click. The moment the
   * agent emits a seed, we (a) drop in a lightweight "Creating ▸ <title>"
   * status row so the chat shows what's happening, (b) auto-open the
   * MV pipeline panel in CINEMA mode with that seed and forceNew, and
   * (c) collapse the chat so the cinema-hero loading screen owns the
   * frame. openMvPipelinePanel({cinema:true, seed}) already auto-fires
   * cssmvRunPipeline (see app.mv-pipeline-panel.js), so every stage's
   * progress (title, music duration, cover, subtitles…) streams into
   * the existing cinema-hero progress block as it arrives — the user
   * just watches. */
  function renderSeedCard(seed) {
    var messages = document.getElementById("cssos-agent-messages");
    if (!messages || !seed) return;
    var title = String(seed.title || "").trim()
      || String(seed.prompt || "").split("\n")[0].slice(0, 60).trim()
      || tr("Untitled MV", "未命名 MV");
    var metaLine = [
      seed.work_type,
      seed.style,
      seed.language,
    ].filter(Boolean).join(" · ");
    var card = document.createElement("div");
    card.className = "cssos-agent-seed-card is-auto-launch";
    card.innerHTML = [
      '<div class="label">🎬 ' + esc(tr("Creating this MV…", "正在创作这支 MV…")) + '</div>',
      '<div class="prompt"><strong>' + esc(title) + '</strong></div>',
      metaLine ? '<div class="meta">' + esc(metaLine) + '</div>' : '',
      '<div class="meta" style="opacity:.7;margin-top:6px">' + esc(tr(
        "Opening the MV panel — the progress bar shows every stage live.",
        "MV 面板已自动打开 — 各阶段进度会实时显示在影院模式里。"
      )) + '</div>',
    ].join("");
    messages.appendChild(card);
    messages.scrollTop = messages.scrollHeight;

    // Fire-and-forget: open the cinema panel + auto-run pipeline.
    // The seed object already carries everything the pipeline needs.
    try {
      if (typeof globalThis.openMvPipelinePanel === "function") {
        globalThis.openMvPipelinePanel({
          cinema: true,
          queue: [],
          seed: seed,
          forceNew: true,
          personName: title,
          personMusicStyleHint: seed.style || "",
        });
        // Collapse the chat so the cinema-hero owns the frame.
        try { togglePanel(); } catch (_) {}
      } else if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tr(
          "MV pipeline not ready yet — please retry in a moment.",
          "MV 管线还没就绪 —— 请稍后重试。"
        ));
      }
    } catch (_) {}
  }

  /* CSSOS_WAVE_136 20260513 — Jing: rich work-card renderer.
   * Renders 1-N work cards returned by the create_work tool. Each card
   * shows the cover image (or gradient placeholder) above, title +
   * meta below, and two action buttons: ▶ Play (deep-links to the MV
   * panel) + 📝 View lyrics (expands the full 京典 10-section text in
   * place). Triptych and opera responses produce a horizontal scroll
   * track of cards. */
  function renderWorkCards(cards) {
    var messages = document.getElementById("cssos-agent-messages");
    if (!messages || !Array.isArray(cards) || !cards.length) return;
    injectWorkCardStyles();
    var wrap = document.createElement("div");
    wrap.className = "cssos-agent-work-cards" + (cards.length > 1 ? " is-multi" : "");
    cards.forEach(function (c) {
      var bg = c.cover_url
        ? 'background-image:url(' + esc(String(c.cover_url)) + ');'
        : 'background:linear-gradient(135deg,#012019,rgba(0,245,160,0.18));';
      var meta = [c.work_type, c.style, c.civilization, c.language]
        .filter(Boolean).join(" · ");
      var card = document.createElement("article");
      card.className = "cssos-agent-work-card";
      card.innerHTML = [
        '<div class="cover" style="' + bg + '">',
        '  <span class="badge">' + esc(c.work_type || "single") + '</span>',
        '</div>',
        '<div class="info">',
        '  <div class="title">' + esc(c.title || "—") + '</div>',
        '  ' + (meta ? '<div class="meta">' + esc(meta) + '</div>' : ''),
        '  <div class="actions">',
        '    <button type="button" data-act="play">▶ ' + esc(tr("Play in MV panel", "在 MV 面板播放")) + '</button>',
        '    <button type="button" data-act="lyrics">📝 ' + esc(tr("View lyrics", "看歌词")) + '</button>',
        (c.audio_url
          ? '    <audio class="inline-audio" controls preload="none" src="' + esc(c.audio_url) + '"></audio>'
          : '    <button type="button" data-act="gen-audio">🎵 ' + esc(tr("Generate music", "生成音乐")) + '</button>'),
        (c.video_url
          ? '    <a class="inline-video-link" href="' + esc(c.video_url) + '" target="_blank" rel="noopener">🎬 ' + esc(tr("Open video", "查看视频")) + '</a>'
          : '    <button type="button" data-act="gen-video">🎬 ' + esc(tr("Generate video", "生成视频")) + '</button>'),
        '  </div>',
        '  <pre class="lyrics" hidden></pre>',
        '</div>',
      ].join("");
      // CSSOS_WAVE_161 20260515 — Jing: "让卡片/链接可点击打开." The
      // whole card (cover + title) opens the work, not just the small
      // ▶ button — and the cover shows a pointer cursor so it reads as
      // clickable. CSSOS_WAVE_162 — routes through the shared
      // openWorkById() so card + in-message links behave identically.
      function openThisWork() { openWorkById(c.work_id); }
      card.querySelector('[data-act="play"]').addEventListener("click", openThisWork);
      var coverEl = card.querySelector(".cover");
      if (coverEl) {
        coverEl.style.cursor = "pointer";
        coverEl.title = tr("Open in MV panel", "在 MV 面板打开");
        coverEl.addEventListener("click", openThisWork);
      }
      var titleEl = card.querySelector(".title");
      if (titleEl) {
        titleEl.style.cursor = "pointer";
        titleEl.addEventListener("click", openThisWork);
      }
      card.querySelector('[data-act="lyrics"]').addEventListener("click", function () {
        var pre = card.querySelector(".lyrics");
        if (!pre) return;
        if (pre.hidden) {
          // CSSOS_WAVE_148 20260514 — Jing: 不要返回人类无法读的歌词
          // (literal "\n" / JSON-escaped). Run through the shared
          // normalizer which unwraps JSON envelopes, converts literal
          // \n / \t / \" to real characters, and tidies [Section]
          // markers onto their own lines.
          var raw = String(c.lyrics_preview || "");
          var clean = (typeof globalThis.cssosNormalizeLyricsText === "function")
            ? globalThis.cssosNormalizeLyricsText(raw)
            : raw.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"');
          pre.textContent = clean;
          pre.hidden = false;
        } else {
          pre.hidden = true;
        }
      });
      // CSSOS_WAVE_137 — per-card audio + video generation.
      var genAudioBtn = card.querySelector('[data-act="gen-audio"]');
      if (genAudioBtn) {
        genAudioBtn.addEventListener("click", async function () {
          genAudioBtn.disabled = true;
          var orig = genAudioBtn.textContent;
          genAudioBtn.textContent = tr("Generating music…", "正在生成音乐…");
          try {
            var r = await fetch("/api/agent/work/" + encodeURIComponent(c.work_id) + "/generate-audio", {
              method: "POST", credentials: "include",
            });
            var j = await r.json();
            if (r.ok && j.ok && j.audio_url) {
              var audio = document.createElement("audio");
              audio.className = "inline-audio";
              audio.controls = true;
              audio.src = j.audio_url;
              genAudioBtn.replaceWith(audio);
              c.audio_url = j.audio_url;
            } else {
              genAudioBtn.disabled = false;
              genAudioBtn.textContent = orig;
              if (typeof globalThis.showToast === "function") {
                globalThis.showToast(tr("Music generation failed: ", "音乐生成失败：") + (j.error || r.status));
              }
            }
          } catch (err) {
            genAudioBtn.disabled = false;
            genAudioBtn.textContent = orig;
            if (typeof globalThis.showToast === "function") {
              globalThis.showToast(tr("Music error: ", "音乐错误：") + (err && err.message || err));
            }
          }
        });
      }
      var genVideoBtn = card.querySelector('[data-act="gen-video"]');
      if (genVideoBtn) {
        genVideoBtn.addEventListener("click", async function () {
          genVideoBtn.disabled = true;
          var orig = genVideoBtn.textContent;
          genVideoBtn.textContent = tr("Generating video…", "正在生成视频…");
          try {
            var r = await fetch("/api/agent/work/" + encodeURIComponent(c.work_id) + "/generate-video", {
              method: "POST", credentials: "include",
            });
            var j = await r.json();
            if (r.ok && j.ok && j.video_url) {
              var link = document.createElement("a");
              link.className = "inline-video-link";
              link.href = j.video_url;
              link.target = "_blank";
              link.rel = "noopener";
              link.textContent = "🎬 " + tr("Open video", "查看视频");
              genVideoBtn.replaceWith(link);
              c.video_url = j.video_url;
            } else {
              genVideoBtn.disabled = false;
              genVideoBtn.textContent = orig;
              if (typeof globalThis.showToast === "function") {
                globalThis.showToast(tr("Video generation failed: ", "视频生成失败：") + (j.error || r.status));
              }
            }
          } catch (err) {
            genVideoBtn.disabled = false;
            genVideoBtn.textContent = orig;
            if (typeof globalThis.showToast === "function") {
              globalThis.showToast(tr("Video error: ", "视频错误：") + (err && err.message || err));
            }
          }
        });
      }
      wrap.appendChild(card);
    });
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;

    // CSSOS_WAVE_182 20260515 — Jing: 不是直接创作画面吗？即视频（目前
    // 用幻灯）呢？  W179 stopped at "scripts persisted", but for shortplay
    // the user expects to WATCH the drama, not just read 5 cards of
    // script text. Auto-launch cinema for Episode 1 using its script
    // as the seed.lyrics so the music + slideshow + subtitle stages
    // fire immediately. The remaining 4 episodes stay as cards the
    // user can tap (next wave wires resume-from-script so each
    // episode auto-watches without creating a twin work). For each
    // shortplay episode we pin instrumental=true and prefer the
    // background-music engines (Mubert / Stable Audio) so the
    // dialogue isn't sung as a song — it's drama with BGM.
    try {
      var first = cards[0] || {};
      var workType = String(first.work_type || "").toLowerCase();
      if (workType === "shortplay" && first.lyrics_preview && first.title
          && typeof globalThis.openMvPipelinePanel === "function") {
        var ep1Title = String(first.title || "").trim() || "Episode 1";
        var sharedStyle = String(first.style || "").trim();
        var seed = {
          prompt: ep1Title + (sharedStyle ? "\n[" + sharedStyle + "]" : ""),
          style: sharedStyle,
          language: String(first.language || "").trim() || "en",
          work_type: "single",         // episode plays as a single drama clip
          title: ep1Title,
          lyrics: String(first.lyrics_preview || "").trim(),
          // Drama, not song: instrumental BGM under the script.
          instrumental: true,
          make_instrumental: true,
          // Prefer Mubert / Stable Audio for the mood BGM bed; Suno
          // would try to sing the script otherwise.
          prefer_music: ["mubert", "stability"],
          // Slideshow tier — no real-video clips.
          tier: "lite",
          __shortplayEpisode: true,
          __shortplayRootTitle: ep1Title.split(" · ")[0] || ep1Title,
          __shortplayEpisodeIndex: 1,
        };
        try {
          globalThis.openMvPipelinePanel({
            cinema: true,
            queue: [],
            seed: seed,
            forceNew: true,
            personName: ep1Title,
            personMusicStyleHint: sharedStyle,
          });
          try { togglePanel(); } catch (_) {}
        } catch (_) { /* non-fatal — user can still click the cards */ }
      }
    } catch (_) {}
  }

  function injectWorkCardStyles() {
    if (document.getElementById("cssos-agent-work-card-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-agent-work-card-style";
    st.textContent = [
      /* CSSOS_WAVE_147 20260514 — Jing: 卡片塌成两条线. The parent
         #cssos-agent-messages is display:flex;flex-direction:column,
         so a child flex row gets align-items:stretch but the cards'
         own height collapsed because aspect-ratio:1/1 on .cover didn't
         resolve inside the nested flex context. Fix: give the cards an
         explicit min-height + flex-shrink:0, and the cover an explicit
         pixel height instead of relying on aspect-ratio. */
      /* CSSOS_WAVE_149 20260514 — Jing: 卡片太扁，应该竖式. Both single
         and multi cards are now a fixed 200px-wide portrait card with a
         200px square cover on top and the info stacked below — never a
         wide/flat card. Single cards center themselves; multi cards
         scroll-snap horizontally. */
      /* CSSOS_WAVE_164 20260515 — Jing: "卡片再次塌成一条线." The W147 fix
         didn't fully stick: #cssos-agent-messages is a vertically-
         constrained flex-column (flex:1 inside a fixed-height panel),
         and every child flex-item inherits `flex-shrink:1` by default,
         so under pressure the cards wrap squashed to ~10px tall and the
         user just saw a thin colored band where the 3 cards should be.
         Lock the wrap AND each card against shrinking, and pin the cover
         to a non-shrinkable 200×200 block so it can never collapse. */
      ".cssos-agent-work-cards{display:flex;flex-direction:row;flex-wrap:wrap;gap:10px;margin:8px 0;align-self:stretch;flex-shrink:0;min-height:290px;}",
      ".cssos-agent-work-cards.is-multi{flex-wrap:nowrap;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px;align-items:flex-start;}",
      ".cssos-agent-work-card{background:rgba(8,18,14,0.7);border:1px solid rgba(0,245,160,0.32);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;flex:0 0 200px;width:200px;min-height:290px;flex-shrink:0;scroll-snap-align:start;}",
      ".cssos-agent-work-card .cover{position:relative;width:100%;height:200px;min-height:200px;flex:0 0 200px;background-size:cover;background-position:center;background-color:#0a1812;}",
      ".cssos-agent-work-card .cover .badge{position:absolute;top:6px;left:6px;padding:3px 9px;border-radius:999px;background:rgba(0,245,160,0.85);color:#0a0d12;font:700 10px/1 ui-monospace,monospace;letter-spacing:.05em;text-transform:uppercase;}",
      ".cssos-agent-work-card .info{padding:10px 12px;display:flex;flex-direction:column;gap:6px;}",
      ".cssos-agent-work-card .title{font:600 14px/1.25 -apple-system,system-ui,sans-serif;color:#fff;}",
      ".cssos-agent-work-card .meta{font:500 11px/1.3 ui-monospace,monospace;color:rgba(255,255,255,0.55);}",
      ".cssos-agent-work-card .actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;}",
      ".cssos-agent-work-card .actions button{flex:1;background:rgba(0,245,160,0.18);color:#5effc9;border:1px solid rgba(0,245,160,0.35);padding:7px 8px;border-radius:8px;font:600 12px/1.2 -apple-system,system-ui,sans-serif;cursor:pointer;}",
      ".cssos-agent-work-card .actions button:hover{background:rgba(0,245,160,0.28);}",
      ".cssos-agent-work-card .lyrics{margin:6px 0 0;padding:8px 10px;background:rgba(0,0,0,0.32);border-radius:8px;color:#dde6ff;font:500 11.5px/1.5 ui-monospace,monospace;white-space:pre-wrap;max-height:260px;overflow:auto;}",
      ".cssos-agent-work-card .inline-audio{width:100%;height:32px;flex:1 1 100%;margin-top:4px;}",
      ".cssos-agent-work-card .inline-video-link{flex:1;text-align:center;padding:7px 8px;border-radius:8px;background:rgba(255,180,80,0.18);color:#ffd07a;border:1px solid rgba(255,180,80,0.4);font:600 12px/1.2 -apple-system,system-ui,sans-serif;text-decoration:none;}",
      ".cssos-agent-work-card .inline-video-link:hover{background:rgba(255,180,80,0.28);}",
    ].join("\n");
    document.head.appendChild(st);
  }

  async function clearConversation() {
    try {
      await fetch("/api/agent/session?session_id=" + encodeURIComponent(ensureSessionId()), {
        method: "DELETE", credentials: "include",
      });
    } catch (_) {}
    // CSSOS_WAVE_152 — manual clear removes the id from BOTH stores so
    // the next message starts a genuinely fresh session.
    try { localStorage.removeItem("cssos.agent.session_id"); } catch (_) {}
    try { sessionStorage.removeItem("cssos.agent.session_id"); } catch (_) {}
    var messages = document.getElementById("cssos-agent-messages");
    if (messages) messages.innerHTML = "";
    renderSystem(tr("Conversation cleared. Fresh start.", "对话已清空，重新开始。"));
  }

  /* CSSOS_WAVE_167 — pasted-image state + UI. */
  var pendingImages = []; // [{ b64, media_type, data_url }]
  var MAX_IMG_BYTES = 8 * 1024 * 1024; // 8 MB raw — body limit is 12 MB after base64 inflation
  var MAX_IMG_COUNT = 6;

  function ensureAttachStripStyles() {
    if (document.getElementById("cssos-agent-attach-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-agent-attach-style";
    st.textContent = [
      "#cssos-agent-attach-strip{display:none;gap:6px;padding:6px 12px 0;flex-wrap:wrap;}",
      "#cssos-agent-attach-strip[data-has='1']{display:flex;}",
      "#cssos-agent-attach-strip .thumb{position:relative;width:54px;height:54px;border-radius:8px;background:#0a0e16 center/cover no-repeat;border:1px solid rgba(0,245,160,0.35);}",
      "#cssos-agent-attach-strip .thumb .x{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#0d1117;border:1px solid rgba(255,255,255,0.32);color:#fff;font:700 11px/16px ui-monospace,monospace;cursor:pointer;text-align:center;padding:0;}",
      ".cssos-agent-msg-images{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}",
      ".cssos-agent-msg-images a{display:block;width:120px;height:120px;border-radius:8px;background:#0a0e16 center/cover no-repeat;border:1px solid rgba(0,245,160,0.3);}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function ensureAttachStrip() {
    var panel = document.getElementById("cssos-agent-panel");
    if (!panel) return null;
    var strip = document.getElementById("cssos-agent-attach-strip");
    if (strip) return strip;
    ensureAttachStripStyles();
    strip = document.createElement("div");
    strip.id = "cssos-agent-attach-strip";
    var inputRow = document.getElementById("cssos-agent-input-row");
    if (inputRow && inputRow.parentNode) {
      inputRow.parentNode.insertBefore(strip, inputRow);
    } else {
      panel.appendChild(strip);
    }
    return strip;
  }

  function repaintAttachStrip() {
    var strip = ensureAttachStrip();
    if (!strip) return;
    strip.innerHTML = "";
    pendingImages.forEach(function (im, i) {
      var t = document.createElement("div");
      t.className = "thumb";
      t.style.backgroundImage = "url(\"" + im.data_url + "\")";
      var x = document.createElement("button");
      x.type = "button"; x.className = "x"; x.textContent = "×";
      x.title = tr("Remove", "移除");
      x.addEventListener("click", function () {
        pendingImages.splice(i, 1);
        repaintAttachStrip();
      });
      t.appendChild(x);
      strip.appendChild(t);
    });
    strip.dataset.has = pendingImages.length ? "1" : "0";
  }

  function readImageFile(file) {
    if (!file) return;
    if (pendingImages.length >= MAX_IMG_COUNT) {
      renderSystem(tr(
        "Max 6 images per message — drop one of the existing thumbnails first.",
        "每条消息最多 6 张图，先移除一张再粘。"
      ));
      return;
    }
    if (file.size && file.size > MAX_IMG_BYTES) {
      renderSystem(tr(
        "Image too large (8 MB max).",
        "图片太大（上限 8 MB）。"
      ));
      return;
    }
    var media = String(file.type || "").toLowerCase();
    if (["image/png","image/jpeg","image/jpg","image/webp","image/gif"].indexOf(media) < 0) {
      renderSystem(tr("Unsupported image type.", "不支持的图片格式。"));
      return;
    }
    if (media === "image/jpg") media = "image/jpeg";
    var fr = new FileReader();
    fr.onload = function () {
      var dataUrl = String(fr.result || "");
      var m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (!m) return;
      pendingImages.push({ b64: m[2], media_type: media, data_url: dataUrl });
      repaintAttachStrip();
    };
    fr.readAsDataURL(file);
  }

  async function sendCurrent() {
    var input = document.getElementById("cssos-agent-input");
    var btn = document.getElementById("cssos-agent-send");
    if (!input) return;
    var msg = String(input.value || "").trim();
    if (!msg && !pendingImages.length) return;
    // Snapshot the attachments for this send + clear UI immediately so
    // a slow round-trip doesn't double-send if the user clicks again.
    var sendImages = pendingImages.slice();
    pendingImages = [];
    repaintAttachStrip();
    var localPreviewUrls = sendImages.map(function (im) { return im.data_url; });
    renderMsg("user", msg, null, localPreviewUrls);
    input.value = "";
    input.style.height = "auto";
    btn.disabled = true;
    var typingEl = renderTyping();
    try {
      var r = await fetch("/api/agent/chat", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: msg,
          session_id: ensureSessionId(),
          ui_locale: uiLocale(),
          // CSSOS_WAVE_167 — pasted-image payloads. Backend dedupes media
          // type, persists each to disk, and threads them into the user
          // turn as Claude image content blocks.
          images: sendImages.map(function (im) {
            return { b64: im.b64, media_type: im.media_type };
          }),
        }),
      });
      // CSSOS_WAVE_142 20260514 — Jing fix: when the server / nginx
      // times out a long create_work call, response body is HTML or
      // empty, and `r.json()` throws iOS WebKit's "The string did not
      // match the expected pattern.". Catch that explicitly and show
      // a user-meaningful message instead of the raw regex error.
      var j = null;
      try {
        j = await r.json();
      } catch (parseErr) {
        clearTyping();
        var hint = r.status === 504 || r.status === 502
          ? tr(
              "Creation took too long and the server cut it off. Try a shorter prompt, or wait a minute and retry — most third-party LLM providers reset on the hour.",
              "创作耗时过长被服务器截断。请缩短提示词后重试，或等一两分钟（多数第三方 LLM 在整点恢复配额）。"
            )
          : tr(
              "Server returned a non-JSON response (status ", "服务器返回非 JSON（状态 "
            ) + r.status + "). " + tr(
              "Try again in a moment.", "稍后再试。"
            );
        renderSystem(hint);
        return;
      }
      clearTyping();
      if (!j.ok) {
        if (r.status === 401) {
          renderSystem(tr("Sign in to chat with the assistant.", "请先登录后再使用助手。"));
        } else if (r.status === 429) {
          renderSystem(tr("Rate limit reached. ", "已达本时段使用上限。") + (j.hint || ""));
        } else {
          renderSystem((j.error || "unknown_error") + (j.detail ? ": " + j.detail.slice(0, 200) : ""));
        }
        return;
      }
      var toolNames = (j.tool_calls || []).map(function (t) { return t.name; });
      if (j.reply) renderMsg("assistant", j.reply, toolNames);
      if (j.seed) renderSeedCard(j.seed);
      // CSSOS_WAVE_136 20260513 — rich work-cards from chat-to-creation.
      // The backend create_work tool returns one or more user_works rows
      // with cover + lyrics; render each as a clickable card that deep-
      // links into the MV panel.
      // CSSOS_WAVE_163 20260515 — Jing: "输出的作品没有图片卡片." Belt
      // and suspenders: prefer the top-level j.work_cards, but if that's
      // empty fall back to collecting cards off j.tool_calls[].work_cards
      // (the create_work tool result), so a card always shows the moment
      // a work is created — even if the top-level shaper missed it.
      var liveCards = (Array.isArray(j.work_cards) && j.work_cards.length)
        ? j.work_cards
        : (j.tool_calls || []).reduce(function (acc, t) {
            if (t && Array.isArray(t.work_cards) && t.work_cards.length) {
              return acc.concat(t.work_cards);
            }
            return acc;
          }, []);
      if (liveCards && liveCards.length) {
        try { renderWorkCards(liveCards); } catch (err) { console.warn("[agent-chat] work-card render failed", err); }
      }
      // CSSOS_WAVE_138 — surface insufficient-credit hints inline.
      var insufficient = (j.tool_calls || []).find(function (t) {
        return t && t.result_summary && t.result_summary.indexOf("insufficient_credit") >= 0;
      });
      if (insufficient) {
        renderSystem(tr(
          "Out of credits for that action. Tap 💎 in ⋯ menu to top up, or earn more via plays/forks/boost.",
          "积分不足。点 ⋯ 菜单里的 💎 充值，或通过播放/被转发/Boost 赚取。"
        ));
        // CSSOS_WAVE_139B — auto-pop the top-up modal when insufficient.
        if (typeof globalThis.cssosOpenCreditsTopup === "function") {
          setTimeout(function () { try { globalThis.cssosOpenCreditsTopup(); } catch (_) {} }, 400);
        }
      }
      updateMeta({ turns_this_hour: j.turns_this_hour, turns_per_hour_limit: j.turns_this_hour + j.turns_remaining });
    } catch (err) {
      clearTyping();
      renderSystem((err && err.message) || String(err));
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
