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
    try {
      var sid = sessionStorage.getItem("cssos.agent.session_id");
      if (sid) return sid;
      sid = "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem("cssos.agent.session_id", sid);
      return sid;
    } catch (_) { return "fallback"; }
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
    panel.querySelector("#cssos-agent-send").addEventListener("click", sendCurrent);

    renderSuggestions();
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

  function togglePanel() {
    var panel = document.getElementById("cssos-agent-panel");
    var fab = document.getElementById("cssos-agent-fab");
    if (!panel) return;
    var open = panel.getAttribute("data-open") === "1";
    if (open) {
      panel.setAttribute("data-open", "0");
      fab.setAttribute("data-active", "0");
    } else {
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
          if (m.text) renderMsg(m.role, m.text, m.tool_calls);
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

  function renderMsg(role, text, toolCalls) {
    var messages = document.getElementById("cssos-agent-messages");
    if (!messages) return;
    var div = document.createElement("div");
    div.className = "cssos-agent-msg " + (role === "assistant" ? "assistant" : role === "system" ? "system" : "user");
    div.textContent = text;
    if (Array.isArray(toolCalls) && toolCalls.length) {
      var tools = document.createElement("div");
      tools.className = "cssos-agent-tools";
      tools.textContent = "🛠 " + toolCalls.map(function (t) {
        return typeof t === "string" ? t : (t.name || "?");
      }).join(" · ");
      div.appendChild(tools);
    }
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

  function renderSeedCard(seed) {
    var messages = document.getElementById("cssos-agent-messages");
    if (!messages || !seed) return;
    var card = document.createElement("div");
    card.className = "cssos-agent-seed-card";
    card.innerHTML = [
      '<div class="label">🎬 ' + esc(tr("PROPOSED MV", "MV 建议")) + '</div>',
      '<div class="prompt">' + esc(String(seed.prompt || "")) + '</div>',
      '<div class="meta">' + esc([
        seed.work_type ? "Type: " + seed.work_type : "",
        seed.style ? "Style: " + seed.style : "",
        seed.language ? "Lang: " + seed.language : "",
      ].filter(Boolean).join(" · ")) + '</div>',
      '<button type="button">✨ ' + esc(tr("Create this MV", "创作这支 MV")) + '</button>',
    ].join("");
    card.querySelector("button").addEventListener("click", function () {
      if (typeof globalThis.openMvPipelinePanel === "function") {
        globalThis.openMvPipelinePanel({
          seed: seed,
          forceNew: true,
        });
        togglePanel(); // collapse the chat so the pipeline panel takes focus
      } else if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tr("MV pipeline not ready yet — please open it manually.", "MV 管线未就绪 —— 请手动打开。"));
      }
    });
    messages.appendChild(card);
    messages.scrollTop = messages.scrollHeight;
  }

  async function clearConversation() {
    try {
      await fetch("/api/agent/session?session_id=" + encodeURIComponent(ensureSessionId()), {
        method: "DELETE", credentials: "include",
      });
    } catch (_) {}
    try { sessionStorage.removeItem("cssos.agent.session_id"); } catch (_) {}
    var messages = document.getElementById("cssos-agent-messages");
    if (messages) messages.innerHTML = "";
    renderSystem(tr("Conversation cleared. Fresh start.", "对话已清空，重新开始。"));
  }

  async function sendCurrent() {
    var input = document.getElementById("cssos-agent-input");
    var btn = document.getElementById("cssos-agent-send");
    if (!input) return;
    var msg = String(input.value || "").trim();
    if (!msg) return;
    renderMsg("user", msg, null);
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
        }),
      });
      var j = await r.json();
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
