/* CSSOS_PERSON_MV_WAVE24 20260508 — Jing
 * Floating AI creator chat. Bottom-right bubble (50×50) → click expands to
 * a 320×500 chat panel. Talks to /api/person-mv/ai-assistant for intent
 * extraction. When LLM returns action="create_mv", we POST to
 * /api/person-mv/persons (ad-hoc), then deep-link to #person-mv/{id} which
 * the panel auto-launches into cinema. History persists in localStorage.
 *
 * Mobile (≤640px): panel becomes full-width with bottom-sheet feel.
 * Desktop: floating panel anchored bottom-right.
 *
 * Vanilla JS, no deps. Self-mounting. */
(function () {
  "use strict";
  var STORAGE_KEY = "cssos.personMv.aiChat.history.v1";
  var MAX_HISTORY = 40;

  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_e) { return []; }
  }
  function saveHistory(list) {
    try {
      var trimmed = list.slice(-MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (_e) {}
  }

  var STYLE_ID = "cssos-person-mv-ai-chat-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      ".cssos-ai-chat-bubble{position:fixed;right:20px;bottom:20px;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#00f5a0,#00c280);color:#001b14;font-size:24px;line-height:50px;text-align:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:9998;border:none;transition:transform .15s ease;user-select:none;}",
      ".cssos-ai-chat-bubble:hover{transform:scale(1.08);}",
      ".cssos-ai-chat-bubble[data-open='1']{display:none;}",
      ".cssos-ai-chat-panel{position:fixed;right:20px;bottom:20px;width:320px;height:500px;max-height:80vh;background:rgba(15,10,5,0.97);border:1px solid rgba(255,180,80,0.3);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,0.5);display:flex;flex-direction:column;z-index:9999;overflow:hidden;color:#ffeccc;font:14px/1.4 -apple-system,system-ui,sans-serif;}",
      ".cssos-ai-chat-panel[hidden]{display:none;}",
      ".cssos-ai-chat-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,180,80,0.18);background:linear-gradient(135deg,rgba(0,245,160,0.12),transparent);}",
      ".cssos-ai-chat-head .title{font:700 14px/1.2 -apple-system,system-ui,sans-serif;}",
      ".cssos-ai-chat-head .close{background:none;border:none;color:rgba(255,236,200,0.7);font-size:18px;cursor:pointer;padding:4px 8px;}",
      ".cssos-ai-chat-body{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;}",
      ".cssos-ai-chat-msg{max-width:85%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;word-wrap:break-word;}",
      ".cssos-ai-chat-msg.user{align-self:flex-end;background:rgba(0,245,160,0.18);color:#dffff1;border:1px solid rgba(0,245,160,0.3);}",
      ".cssos-ai-chat-msg.ai{align-self:flex-start;background:rgba(255,180,80,0.10);color:rgba(255,236,200,0.94);border:1px solid rgba(255,180,80,0.18);}",
      ".cssos-ai-chat-msg.action{align-self:flex-start;background:rgba(0,245,160,0.10);color:#dffff1;border:1px dashed rgba(0,245,160,0.4);font-size:12px;}",
      ".cssos-ai-chat-msg.action a{color:#00f5a0;text-decoration:underline;cursor:pointer;}",
      ".cssos-ai-chat-suggestions{padding:6px 14px 0;display:flex;flex-wrap:wrap;gap:6px;}",
      ".cssos-ai-chat-suggestions .chip{font-size:11px;padding:5px 10px;border-radius:14px;background:rgba(255,180,80,0.10);border:1px solid rgba(255,180,80,0.25);color:rgba(255,236,200,0.88);cursor:pointer;}",
      ".cssos-ai-chat-suggestions .chip:hover{background:rgba(255,180,80,0.22);}",
      ".cssos-ai-chat-foot{padding:10px 14px 12px;border-top:1px solid rgba(255,180,80,0.18);display:flex;gap:8px;}",
      ".cssos-ai-chat-foot input{flex:1;background:rgba(0,0,0,0.4);border:1px solid rgba(255,180,80,0.25);border-radius:18px;padding:8px 14px;color:#ffeccc;font:14px -apple-system,system-ui,sans-serif;outline:none;}",
      ".cssos-ai-chat-foot input:focus{border-color:rgba(0,245,160,0.6);}",
      ".cssos-ai-chat-foot button{background:linear-gradient(135deg,#00f5a0,#00c280);color:#001b14;border:none;border-radius:18px;padding:8px 16px;font-weight:700;cursor:pointer;}",
      ".cssos-ai-chat-foot button:disabled{opacity:.5;cursor:not-allowed;}",
      "@media (max-width:640px){.cssos-ai-chat-panel{right:0;bottom:0;left:0;width:100%;height:80vh;border-radius:14px 14px 0 0;}}",
    ].join("");
    document.head.appendChild(s);
  }

  var SUGGESTIONS = [
    { en: "Make a 60th birthday MV for my mom", zh: "为我妈做支 60 大寿 MV" },
    { en: "Cyberpunk version for Socrates", zh: "送给苏格拉底的赛博朋克版" },
    { en: "Li Bai on a Mid-Autumn night", zh: "中秋夜的李白" },
  ];

  function mount() {
    if (document.getElementById("cssos-ai-chat-bubble")) return;
    injectStyle();
    var bubble = document.createElement("button");
    bubble.id = "cssos-ai-chat-bubble";
    bubble.className = "cssos-ai-chat-bubble";
    bubble.type = "button";
    bubble.setAttribute("aria-label", tr("Open AI creator chat", "打开 AI 创作助手"));
    bubble.textContent = "💬";
    document.body.appendChild(bubble);

    var panel = document.createElement("div");
    panel.id = "cssos-ai-chat-panel";
    panel.className = "cssos-ai-chat-panel";
    panel.hidden = true;
    panel.innerHTML =
      '<div class="cssos-ai-chat-head">' +
        '<div class="title">✨ ' + escapeHtml(tr("AI Creator", "AI 创作助手")) + '</div>' +
        '<button class="close" type="button" aria-label="' + escapeHtml(tr("Close", "关闭")) + '">×</button>' +
      '</div>' +
      '<div class="cssos-ai-chat-body" id="cssos-ai-chat-body"></div>' +
      '<div class="cssos-ai-chat-suggestions" id="cssos-ai-chat-suggestions"></div>' +
      '<form class="cssos-ai-chat-foot" id="cssos-ai-chat-form">' +
        '<input type="text" id="cssos-ai-chat-input" autocomplete="off" placeholder="' + escapeHtml(tr("Tell me who & how…", "想为谁做一支 MV?")) + '" maxlength="600" />' +
        '<button type="submit">' + escapeHtml(tr("Send", "发送")) + '</button>' +
      '</form>';
    document.body.appendChild(panel);

    var body = panel.querySelector("#cssos-ai-chat-body");
    var input = panel.querySelector("#cssos-ai-chat-input");
    var form = panel.querySelector("#cssos-ai-chat-form");
    var sendBtn = form.querySelector("button");
    var suggestionsEl = panel.querySelector("#cssos-ai-chat-suggestions");
    var closeBtn = panel.querySelector(".close");

    function rerender() {
      var hist = loadHistory();
      body.innerHTML = hist.map(function (m) {
        var cls = m.role === "user" ? "user" : (m.kind === "action" ? "action" : "ai");
        return '<div class="cssos-ai-chat-msg ' + cls + '">' + (m.html || escapeHtml(m.text || "")) + '</div>';
      }).join("");
      body.scrollTop = body.scrollHeight;
      // Hide suggestions after first turn.
      suggestionsEl.style.display = hist.length > 0 ? "none" : "flex";
    }

    function appendMsg(role, text, opts) {
      var hist = loadHistory();
      hist.push(Object.assign({ role: role, text: text, ts: Date.now() }, opts || {}));
      saveHistory(hist);
      rerender();
    }

    function renderSuggestions() {
      var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
      var isZh = /^zh/i.test(String(locale));
      suggestionsEl.innerHTML = SUGGESTIONS.map(function (s) {
        var label = isZh ? s.zh : s.en;
        return '<button type="button" class="chip" data-prompt="' + escapeHtml(label) + '">' + escapeHtml(label) + '</button>';
      }).join("");
    }

    suggestionsEl.addEventListener("click", function (ev) {
      var chip = ev.target && ev.target.closest && ev.target.closest(".chip");
      if (!chip) return;
      var p = chip.getAttribute("data-prompt") || "";
      input.value = p;
      input.focus();
    });

    function open() {
      bubble.setAttribute("data-open", "1");
      panel.hidden = false;
      renderSuggestions();
      rerender();
      setTimeout(function () { input.focus(); }, 50);
    }
    function close() {
      bubble.removeAttribute("data-open");
      panel.hidden = true;
    }
    bubble.addEventListener("click", open);
    closeBtn.addEventListener("click", close);

    async function ask(message) {
      appendMsg("user", message);
      input.value = "";
      sendBtn.disabled = true;
      // Pending placeholder
      var pendingHist = loadHistory();
      pendingHist.push({ role: "ai", text: "…", html: '<span style="opacity:.6">…</span>', ts: Date.now(), pending: true });
      saveHistory(pendingHist);
      rerender();

      try {
        var r = await fetch("/api/person-mv/ai-assistant", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ message: message }),
        });
        var j = null;
        try { j = await r.json(); } catch (_e) {}
        // Pop pending
        var hist = loadHistory();
        if (hist.length && hist[hist.length - 1].pending) hist.pop();
        saveHistory(hist);

        if (!j || !j.ok || !j.data) {
          appendMsg("ai", tr("Sorry, something went wrong. Try again.", "出错了,稍后再试。"));
          return;
        }
        var d = j.data;
        if (d.action === "create_mv" && d.target_name) {
          appendMsg("ai", d.message || tr("Got it — creating now.", "收到 — 这就为你创建。"));
          await triggerCreateMv(d.target_name, d.occasion, d.style_hint);
        } else if (d.action === "search_person" && d.target_name) {
          var label = tr(
            "Open " + d.target_name + " in the codex →",
            "在文明库打开「" + d.target_name + "」→",
          );
          appendMsg("ai", "", {
            kind: "action",
            html:
              escapeHtml(d.message || tr("Let's open the codex.", "为你打开档案。")) +
              ' <a data-search="' + escapeHtml(d.target_name) + '">' + escapeHtml(label) + '</a>',
          });
        } else {
          appendMsg("ai", d.message || tr("How can I help with your MV today?", "今天想做支什么样的 MV?"));
        }
      } catch (err) {
        var hist2 = loadHistory();
        if (hist2.length && hist2[hist2.length - 1].pending) hist2.pop();
        saveHistory(hist2);
        appendMsg("ai", tr("Network error. Try again.", "网络出错,请重试。"));
      } finally {
        sendBtn.disabled = false;
      }
    }

    async function triggerCreateMv(targetName, occasion, styleHint) {
      var hint = [occasion || "", styleHint || ""].filter(Boolean).join(" · ");
      try {
        var r = await fetch("/api/person-mv/persons", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: targetName, hint: hint }),
        });
        if (r.status === 401) {
          appendMsg("ai", "", {
            kind: "action",
            html: escapeHtml(tr("Sign in to create an MV →", "请先登录再创建 →")) +
              ' <a href="/login.html">' + escapeHtml(tr("Sign in", "登录")) + '</a>',
          });
          return;
        }
        var txt = await r.text();
        var j = null;
        try { j = JSON.parse(txt); } catch (_e) {
          // chunked-transfer concatenation may include leading whitespace heartbeats
          var trimmed = txt.replace(/^\s+/, "");
          try { j = JSON.parse(trimmed); } catch (_e2) {}
        }
        if (!j || !j.ok || !j.person_id) {
          appendMsg("ai", tr("Couldn't create the person. Try again.", "创建失败,请稍后再试。"));
          return;
        }
        var pid = j.person_id;
        var safeName = escapeHtml(targetName);
        appendMsg("ai", "", {
          kind: "action",
          html:
            "✨ " + tr(
              'Created page for "<b>' + safeName + '</b>", generating MV…',
              '已为「<b>' + safeName + '</b>」创建专页,正在生成 MV…',
            ) +
            ' <a data-open-pid="' + escapeHtml(pid) + '">' + escapeHtml(tr("Open cinema →", "进入影院 →")) + '</a>',
        });
        // Auto-launch the codex page (which auto-fires cinema).
        location.hash = "#person-mv/" + encodeURIComponent(pid);
      } catch (err) {
        appendMsg("ai", tr("Network error while creating.", "创建时网络出错。"));
      }
    }

    body.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t) return;
      var openPid = t.getAttribute && t.getAttribute("data-open-pid");
      if (openPid) {
        location.hash = "#person-mv/" + encodeURIComponent(openPid);
        return;
      }
      var search = t.getAttribute && t.getAttribute("data-search");
      if (search) {
        location.hash = "#person-mv?q=" + encodeURIComponent(search);
        return;
      }
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var msg = (input.value || "").trim();
      if (!msg) return;
      ask(msg);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
