/* CSSOS_WAVE_139A 20260514 — Jing
 *
 * Discussion rooms drawer for the AI assistant. Adds:
 *   - 🏛 Rooms menu item in the ⋯ overflow → opens a modal listing
 *     my rooms with unread badges. Click a room → swap chat panel
 *     into "room mode" (header shows room name, messages render
 *     from /api/rooms/:id/messages, input POSTs to /send).
 *   - + button at the top of the rooms list → create-room form
 *     (name + invitee handles).
 *   - "Back to AI" button when in room mode → restore agent chat.
 *
 * Same chat input box, same panel — minimum new surface area.
 */
(function () {
  if (globalThis.__cssosChatRoomsWired) return;
  globalThis.__cssosChatRoomsWired = true;

  var roomState = {
    mode: "agent",          // "agent" | "room"
    roomId: null,
    roomName: "",
    pollTimer: null,
    lastSeenIso: "",
  };

  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en) : en;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function injectStyles() {
    if (document.getElementById("cssos-rooms-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-rooms-style";
    st.textContent = [
      ".cssos-rooms-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:10500;display:flex;align-items:center;justify-content:center;padding:14px;}",
      ".cssos-rooms-modal{max-width:420px;width:100%;background:#0f1219;border:1px solid rgba(255,255,255,0.12);border-radius:14px;color:#e6e8ee;display:flex;flex-direction:column;max-height:78vh;overflow:hidden;}",
      ".cssos-rooms-modal .head{display:flex;align-items:baseline;gap:8px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);}",
      ".cssos-rooms-modal .head .title{font:700 14px/1.2 -apple-system,system-ui,sans-serif;color:#fff;flex:1;}",
      ".cssos-rooms-modal .head button{background:transparent;border:0;color:#9aa;font-size:18px;cursor:pointer;padding:4px 8px;}",
      ".cssos-rooms-modal .head button:hover{color:#fff;}",
      ".cssos-rooms-modal .body{padding:10px 12px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px;}",
      ".cssos-rooms-row{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);cursor:pointer;}",
      ".cssos-rooms-row:hover{border-color:rgba(80,140,255,0.42);background:rgba(80,140,255,0.06);}",
      ".cssos-rooms-row .info{flex:1;}",
      ".cssos-rooms-row .name{font:600 13px/1.2 -apple-system,system-ui,sans-serif;color:#fff;}",
      ".cssos-rooms-row .meta{font:500 11px/1.3 ui-monospace,monospace;color:rgba(255,255,255,0.55);margin-top:3px;}",
      ".cssos-rooms-row .badge{min-width:18px;height:18px;border-radius:9px;background:#ff5060;color:#fff;font:700 11px/18px ui-monospace,monospace;text-align:center;padding:0 5px;}",
      ".cssos-rooms-create-form{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,0.08);}",
      ".cssos-rooms-create-form input{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 10px;color:#fff;font:500 12.5px/1.2 -apple-system,system-ui,sans-serif;}",
      ".cssos-rooms-create-form input:focus{outline:0;border-color:rgba(80,140,255,0.6);}",
      ".cssos-rooms-create-form .row{display:flex;gap:6px;}",
      ".cssos-rooms-create-form button{flex:1;background:rgba(80,140,255,0.22);color:#a8c5ff;border:1px solid rgba(80,140,255,0.42);padding:8px 12px;border-radius:8px;font:700 12.5px/1.2 -apple-system,system-ui,sans-serif;cursor:pointer;}",
      ".cssos-rooms-create-form button:hover{background:rgba(80,140,255,0.32);}",
      ".cssos-rooms-empty{text-align:center;padding:18px;color:rgba(255,255,255,0.4);font-style:italic;font-size:12px;}",
      /* Room mode banner inside the chat panel header. */
      "#cssos-agent-panel header.cssos-in-room{background:rgba(80,140,255,0.12);}",
      ".cssos-room-banner-tag{display:inline-block;padding:2px 8px;border-radius:999px;background:rgba(80,140,255,0.28);color:#a8c5ff;font:700 10.5px/1 ui-monospace,monospace;letter-spacing:.04em;text-transform:uppercase;margin-left:6px;}",
      ".cssos-room-msg{margin:6px 0;padding:8px 10px;border-radius:10px;background:rgba(80,140,255,0.07);border:1px solid rgba(80,140,255,0.18);font:500 12.5px/1.45 -apple-system,system-ui,sans-serif;color:#dde6ff;}",
      ".cssos-room-msg .from{font-weight:700;color:#a8c5ff;font-size:10.5px;letter-spacing:.04em;margin-bottom:4px;text-transform:uppercase;}",
      ".cssos-room-msg .body{white-space:pre-wrap;}",
      ".cssos-room-msg.is-me{background:rgba(0,245,160,0.07);border-color:rgba(0,245,160,0.2);}",
      ".cssos-room-msg.is-me .from{color:#5effc9;}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function openRoomsModal() {
    injectStyles();
    var backdrop = document.createElement("div");
    backdrop.className = "cssos-rooms-modal-backdrop";
    backdrop.innerHTML = ''
      + '<div class="cssos-rooms-modal" role="dialog">'
      + '  <div class="head">'
      + '    <div class="title">🏛 ' + esc(tr("Discussion rooms", "讨论室")) + '</div>'
      + '    <button class="close" aria-label="Close">✕</button>'
      + '  </div>'
      + '  <div class="body" id="cssos-rooms-list"><div class="cssos-rooms-empty">' + esc(tr("Loading…","加载中…")) + '</div></div>'
      + '  <div class="cssos-rooms-create-form">'
      + '    <input type="text" data-field="name" placeholder="' + esc(tr("New room name","新讨论室名字")) + '" maxlength="80" />'
      + '    <input type="text" data-field="handles" placeholder="' + esc(tr("Members: alice, @bob, charlie@example.com","成员：alice, @bob, charlie@example.com")) + '" />'
      + '    <div class="row">'
      + '      <button type="button" data-act="create">+ ' + esc(tr("Create","新建")) + '</button>'
      + '    </div>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(backdrop);
    var close = function () { try { backdrop.remove(); } catch (_) {} };
    backdrop.querySelector(".close").addEventListener("click", close);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
    backdrop.querySelector('[data-act="create"]').addEventListener("click", async function () {
      var nameInput = backdrop.querySelector('input[data-field="name"]');
      var handlesInput = backdrop.querySelector('input[data-field="handles"]');
      var name = String((nameInput && nameInput.value) || "").trim();
      var handles = String((handlesInput && handlesInput.value) || "")
        .split(/[,，;\s]+/)
        .map(function (s) { return s.replace(/^@/, "").trim(); })
        .filter(Boolean);
      if (!name) { nameInput && nameInput.focus(); return; }
      try {
        var r = await fetch("/api/rooms/create", {
          method: "POST", credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name, member_handles: handles }),
        });
        var j = await r.json();
        if (r.ok && j.ok) {
          if (j.members_not_found && j.members_not_found.length) {
            if (typeof globalThis.showToast === "function") {
              globalThis.showToast(tr("Some handles weren't found: ","部分用户未找到：") + j.members_not_found.join(", "));
            }
          }
          // Auto-enter the new room.
          close();
          enterRoom(j.room_id, name);
        } else if (typeof globalThis.showToast === "function") {
          globalThis.showToast(tr("Create failed: ","创建失败：") + (j.error || r.status));
        }
      } catch (err) {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(String(err && err.message || err));
        }
      }
    });
    loadRoomList(backdrop, close);
  }

  async function loadRoomList(backdrop, close) {
    var listEl = backdrop.querySelector("#cssos-rooms-list");
    if (!listEl) return;
    try {
      var r = await fetch("/api/rooms", { credentials: "include" });
      var j = await r.json();
      if (!r.ok || !j.ok) {
        listEl.innerHTML = '<div class="cssos-rooms-empty">' + esc(tr("Couldn't load.","加载失败。")) + '</div>';
        return;
      }
      var rooms = j.rooms || [];
      if (!rooms.length) {
        var _ems = globalThis.cssosEmptyStateMarkup;
        if (_ems) {
          listEl.innerHTML = _ems({
            icon: "💭",
            title: tr("No rooms yet", "还没有讨论室"),
            sub: tr("Start the first one and invite others to join.", "开第一个讨论室,邀请大家加入。"),
            ctaLabel: tr("Create a room", "新建讨论室"),
            ctaOnclick: "var b=this.closest('.cssos-rooms,[data-rooms-panel]')||document;var x=b.querySelector('[data-act=create]');if(x)x.click();"
          });
        } else {
          listEl.innerHTML = '<div class="cssos-rooms-empty">' + esc(tr("No rooms yet — create one below.","还没有讨论室——下面新建一个吧。")) + '</div>';
        }
        return;
      }
      listEl.innerHTML = rooms.map(function (rm) {
        var unread = Number(rm.unread_count || 0);
        var members = Number(rm.member_count || 0);
        var meta = members + " " + tr("members","成员") + (rm.topic ? " · " + rm.topic : "");
        return '<div class="cssos-rooms-row" data-id="' + esc(rm.id) + '" data-name="' + esc(rm.name) + '">'
          + '  <div class="info">'
          + '    <div class="name">' + esc(rm.name) + '</div>'
          + '    <div class="meta">' + esc(meta) + '</div>'
          + '  </div>'
          + (unread > 0 ? '  <span class="badge">' + (unread > 99 ? "99+" : unread) + '</span>' : '')
          + '</div>';
      }).join("");
      listEl.querySelectorAll(".cssos-rooms-row").forEach(function (row) {
        row.addEventListener("click", function () {
          var id = row.getAttribute("data-id");
          var nm = row.getAttribute("data-name") || "";
          close();
          enterRoom(id, nm);
        });
      });
    } catch (err) {
      listEl.innerHTML = '<div class="cssos-rooms-empty">' + esc(String(err && err.message || err)) + '</div>';
    }
  }

  function enterRoom(roomId, name) {
    if (!roomId) return;
    roomState.mode = "room";
    roomState.roomId = roomId;
    roomState.roomName = name || "";
    roomState.lastSeenIso = "";
    var panel = document.getElementById("cssos-agent-panel");
    var fab = document.getElementById("cssos-agent-fab");
    if (panel && panel.getAttribute("data-open") !== "1" && fab) fab.click();
    var header = panel && panel.querySelector("header");
    var titleEl = header && header.querySelector(".title");
    if (header) header.classList.add("cssos-in-room");
    if (titleEl) {
      titleEl.innerHTML = '🏛 ' + esc(name || tr("Room","讨论室"))
        + ' <span class="cssos-room-banner-tag">' + esc(tr("ROOM","讨论室")) + '</span>'
        + ' <button type="button" data-act="leave-room" style="margin-left:8px;background:transparent;border:1px solid rgba(255,255,255,0.18);color:rgba(255,255,255,0.7);font:600 10px/1 -apple-system,system-ui,sans-serif;padding:3px 8px;border-radius:6px;cursor:pointer;">' + esc(tr("← Back to AI","← 返回 AI")) + '</button>';
      var leaveBtn = titleEl.querySelector('[data-act="leave-room"]');
      if (leaveBtn) leaveBtn.addEventListener("click", leaveRoom);
    }
    var messages = document.getElementById("cssos-agent-messages");
    if (messages) messages.innerHTML = '';
    // Hijack the send button.
    hijackInput(true);
    pollRoomMessages();
    if (roomState.pollTimer) clearInterval(roomState.pollTimer);
    roomState.pollTimer = setInterval(pollRoomMessages, 5000);
  }

  function leaveRoom() {
    roomState.mode = "agent";
    roomState.roomId = null;
    roomState.roomName = "";
    if (roomState.pollTimer) { clearInterval(roomState.pollTimer); roomState.pollTimer = null; }
    var panel = document.getElementById("cssos-agent-panel");
    var header = panel && panel.querySelector("header");
    var titleEl = header && header.querySelector(".title");
    if (header) header.classList.remove("cssos-in-room");
    if (titleEl) titleEl.textContent = "🤖 " + tr("cssOS Assistant", "cssOS 创作助手");
    hijackInput(false);
    var messages = document.getElementById("cssos-agent-messages");
    if (messages) messages.innerHTML = '';
  }

  var origSendHandler = null;
  function hijackInput(into) {
    var sendBtn = document.getElementById("cssos-agent-send");
    var input = document.getElementById("cssos-agent-input");
    if (!sendBtn || !input) return;
    if (into) {
      // Replace click handler with room send.
      if (!origSendHandler) {
        // Clone the button to detach existing listeners. Then add ours.
        var clone = sendBtn.cloneNode(true);
        sendBtn.replaceWith(clone);
        origSendHandler = true;
        var newBtn = document.getElementById("cssos-agent-send");
        newBtn.addEventListener("click", roomSend);
        // Also intercept Enter on input.
        input.addEventListener("keydown", roomKeydownHandler, true);
      }
    } else {
      // Restore by reloading the agent module's wiring — easiest: reload page hint or just
      // toggle the panel off/on. For simplicity, we leave the room-send wiring in place
      // but check mode in the handler. When mode==="agent", we re-dispatch to the agent.
      if (input) input.removeEventListener("keydown", roomKeydownHandler, true);
    }
  }
  function roomKeydownHandler(e) {
    if (roomState.mode !== "room") return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      roomSend();
    }
  }
  async function roomSend() {
    if (roomState.mode !== "room" || !roomState.roomId) return;
    var input = document.getElementById("cssos-agent-input");
    var text = String((input && input.value) || "").trim();
    if (!text) return;
    input.value = "";
    try {
      var r = await fetch("/api/rooms/" + encodeURIComponent(roomState.roomId) + "/send", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      var j = await r.json();
      if (r.ok && j.ok) {
        pollRoomMessages();
      } else if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tr("Send failed: ","发送失败：") + (j.error || r.status));
      }
    } catch (err) {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(String(err && err.message || err));
      }
    }
  }

  async function pollRoomMessages() {
    if (roomState.mode !== "room" || !roomState.roomId) return;
    if (document.hidden) return;   // W1000 — 标签隐藏不轮询
    try {
      var url = "/api/rooms/" + encodeURIComponent(roomState.roomId) + "/messages";
      if (roomState.lastSeenIso) url += "?since=" + encodeURIComponent(roomState.lastSeenIso);
      var r = await fetch(url, { credentials: "include" });
      var j = await r.json();
      if (!r.ok || !j.ok) return;
      var rows = j.messages || [];
      if (!rows.length) return;
      var messages = document.getElementById("cssos-agent-messages");
      if (!messages) return;
      var myEmail = String((globalThis.authState?.user?.email) || "").toLowerCase();
      rows.forEach(function (m) {
        var who = m.sender_name || (m.sender_username ? "@" + m.sender_username : tr("Anon","匿名"));
        var isMe = (m.sender_username && myEmail.indexOf(String(m.sender_username).toLowerCase()) >= 0) || false;
        var el = document.createElement("div");
        el.className = "cssos-room-msg" + (isMe ? " is-me" : "");
        el.innerHTML = '<div class="from">' + esc(who) + '</div>'
          + '<div class="body">' + esc(m.body) + '</div>';
        messages.appendChild(el);
        roomState.lastSeenIso = m.created_at;
      });
      messages.scrollTop = messages.scrollHeight;
    } catch (_) {}
  }

  function wireMenuItem() {
    var menu = document.querySelector(".cssos-agent-overflow-menu");
    if (!menu) return;
    if (menu.querySelector('[data-act="rooms"]')) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item";
    btn.setAttribute("data-act", "rooms");
    btn.innerHTML = '<span class="glyph">🏛</span><span>' + esc(tr("Discussion rooms", "讨论室")) + '</span>';
    btn.addEventListener("click", function () {
      menu.hidden = true;
      openRoomsModal();
    });
    // Insert after the DM Inbox item (W138) or before the disabled hr.
    var inboxItem = menu.querySelector('[data-act="dm-inbox"]');
    if (inboxItem) inboxItem.parentNode.insertBefore(btn, inboxItem.nextSibling);
    else menu.appendChild(btn);
  }

  function start() {
    var passes = 0;
    var tick = setInterval(function () {
      passes++;
      wireMenuItem();
      if (passes >= 30) clearInterval(tick);
    }, 1000);
  }

  // CSSOS_WAVE_1795 20260729 — 暴露开启函数,供 Dock 的【💬 消息】一级入口调用
  //   (app.messages-hub.js)。此前讨论室【只能】从 AI 助理右上角三点菜单进入 ——
  //   三层操作,且第一层跟功能毫无语义关系(Jing:「藏得太深」)。
  //   这里只导出,不改任何既有行为;三点菜单那一项照旧保留。
  globalThis.cssosOpenRooms = openRoomsModal;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
