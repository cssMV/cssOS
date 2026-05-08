/* CSSOS_PERSON_MV_WAVE63 20260508 — Jing
 * 1v1 direct messages — self-mounting topbar 💌 button + #dm hash route
 * panel (thread list left, active thread right). WebSocket via
 * /ws/dm/:thread_id when available; 5s polling fallback otherwise.
 * Public helpers: window.cssosOpenDmWith(username) — opens/creates
 * thread + navigates to #dm. */
(function () {
  "use strict";
  if (window.__cssosDmMounted) return;
  window.__cssosDmMounted = true;

  const ZH = /^zh/i.test(String(globalThis.currentLocale || navigator.language || "en"));
  const T = (en, zh) => (ZH ? zh : en);
  const safe = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
  function fmtRel(iso) {
    try {
      const t = new Date(iso).getTime();
      if (!t) return "";
      const dt = Math.max(0, Date.now() - t);
      const s = Math.floor(dt / 1000);
      if (s < 60) return T("now", "刚刚");
      const m = Math.floor(s / 60);
      if (m < 60) return T(`${m}m`, `${m}分钟前`);
      const h = Math.floor(m / 60);
      if (h < 24) return T(`${h}h`, `${h}小时前`);
      const d = Math.floor(h / 24);
      return T(`${d}d`, `${d}天前`);
    } catch (_e) { return ""; }
  }

  async function api(path, opts) {
    try {
      const r = await fetch(path, Object.assign({ credentials: "include" }, opts || {}));
      const j = await r.json().catch(() => null);
      return j;
    } catch (_e) { return null; }
  }

  function injectStyles() {
    if (document.getElementById("cssos-dm-style")) return;
    const s = document.createElement("style");
    s.id = "cssos-dm-style";
    s.textContent = `
      .cssos-dm-host { position: relative; display: inline-flex; align-items: center; }
      .cssos-dm-btn {
        background: transparent; border: 0; cursor: pointer;
        font-size: 18px; line-height: 1; padding: 6px 8px; color: inherit;
        border-radius: 6px; position: relative;
      }
      .cssos-dm-btn:hover { background: rgba(255,255,255,0.08); }
      .cssos-dm-badge {
        position: absolute; top: 0; right: 0; min-width: 16px; height: 16px;
        padding: 0 4px; border-radius: 8px; background: #e54545; color: #fff;
        font-size: 10px; line-height: 16px; text-align: center; font-weight: 600;
        pointer-events: none;
      }
      .cssos-dm-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.55);
        z-index: 99990; display: flex; align-items: stretch; justify-content: center;
      }
      .cssos-dm-overlay[hidden] { display: none; }
      .cssos-dm-shell {
        margin: auto; width: min(960px, 96vw); height: min(680px, 92vh);
        background: var(--panel-bg, #14161c); color: var(--panel-fg, #e8e8ec);
        border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.5);
        display: grid; grid-template-columns: 280px 1fr; overflow: hidden;
      }
      .cssos-dm-rail {
        border-right: 1px solid rgba(255,255,255,0.08);
        display: flex; flex-direction: column; min-height: 0;
      }
      .cssos-dm-rail-head {
        padding: 12px 14px; font-size: 13px; font-weight: 600;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex; justify-content: space-between; align-items: center;
      }
      .cssos-dm-close {
        background: transparent; border: 0; color: inherit;
        cursor: pointer; font-size: 18px; padding: 0 4px; opacity: 0.7;
      }
      .cssos-dm-close:hover { opacity: 1; }
      .cssos-dm-threads { overflow-y: auto; flex: 1; }
      .cssos-dm-thread {
        padding: 10px 14px; cursor: pointer; display: flex; gap: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .cssos-dm-thread:hover { background: rgba(255,255,255,0.04); }
      .cssos-dm-thread.active { background: rgba(120,160,255,0.10); }
      .cssos-dm-avatar {
        width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
        background: #444; background-size: cover; background-position: center;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: 600; color: #fff;
      }
      .cssos-dm-thread-meta { flex: 1; min-width: 0; }
      .cssos-dm-thread-name {
        font-size: 13px; font-weight: 600;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        display: flex; gap: 6px; align-items: center;
      }
      .cssos-dm-thread-preview {
        font-size: 12px; opacity: 0.6; margin-top: 2px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .cssos-dm-unread-pill {
        background: #e54545; color: #fff; font-size: 10px; font-weight: 600;
        padding: 1px 6px; border-radius: 10px; min-width: 18px; text-align: center;
      }
      .cssos-dm-pane {
        display: flex; flex-direction: column; min-width: 0; min-height: 0;
      }
      .cssos-dm-pane-head {
        padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
        font-size: 13px; font-weight: 600; display: flex; gap: 10px; align-items: center;
      }
      .cssos-dm-msgs {
        flex: 1; overflow-y: auto; padding: 12px 16px;
        display: flex; flex-direction: column; gap: 8px;
      }
      .cssos-dm-msg {
        max-width: 70%; padding: 8px 12px; border-radius: 14px;
        font-size: 13px; line-height: 1.45; word-wrap: break-word;
        white-space: pre-wrap;
      }
      .cssos-dm-msg.theirs { align-self: flex-start; background: rgba(255,255,255,0.08); }
      .cssos-dm-msg.mine   { align-self: flex-end;   background: #3a6cff; color: #fff; }
      .cssos-dm-msg-meta { font-size: 10px; opacity: 0.55; margin-top: 2px; }
      .cssos-dm-empty {
        flex: 1; display: flex; align-items: center; justify-content: center;
        opacity: 0.55; font-size: 13px;
      }
      .cssos-dm-input-row {
        border-top: 1px solid rgba(255,255,255,0.08); padding: 10px 12px;
        display: flex; gap: 8px;
      }
      .cssos-dm-input {
        flex: 1; resize: none; background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.10); color: inherit;
        border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px;
        max-height: 120px; min-height: 36px;
      }
      .cssos-dm-input:disabled { opacity: 0.5; cursor: not-allowed; }
      .cssos-dm-send {
        background: #3a6cff; color: #fff; border: 0; border-radius: 8px;
        padding: 0 14px; font-size: 13px; font-weight: 600; cursor: pointer;
      }
      .cssos-dm-send:disabled { opacity: 0.4; cursor: not-allowed; }
      .cssos-dm-newgroup-btn {
        background: rgba(120,160,255,0.18); color: inherit; border: 0; border-radius: 6px;
        font-size: 12px; padding: 4px 8px; cursor: pointer; margin-left: 8px;
      }
      .cssos-dm-newgroup-btn:hover { background: rgba(120,160,255,0.30); }
      .cssos-dm-thread-icon {
        width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
        background: rgba(120,160,255,0.18); display: flex; align-items: center;
        justify-content: center; font-size: 16px;
      }
      .cssos-dm-modal {
        position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 99995;
        display: flex; align-items: center; justify-content: center;
      }
      .cssos-dm-modal[hidden] { display: none; }
      .cssos-dm-modal-card {
        width: min(420px, 92vw); background: var(--panel-bg, #14161c);
        color: var(--panel-fg, #e8e8ec); border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px;
      }
      .cssos-dm-modal-card h3 { margin: 0 0 4px 0; font-size: 15px; }
      .cssos-dm-modal-card label { font-size: 12px; opacity: 0.75; }
      .cssos-dm-modal-card input {
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
        color: inherit; border-radius: 6px; padding: 8px 10px; font: inherit; font-size: 13px;
      }
      .cssos-dm-modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
      .cssos-dm-modal-actions button {
        padding: 6px 12px; border-radius: 6px; border: 0; cursor: pointer;
        font-size: 13px; font-weight: 600;
      }
      .cssos-dm-modal-actions .primary { background: #3a6cff; color: #fff; }
      .cssos-dm-modal-actions .ghost   { background: rgba(255,255,255,0.08); color: inherit; }
      .cssos-dm-pane-actions { margin-left: auto; display: flex; gap: 6px; }
      .cssos-dm-pane-actions button {
        background: rgba(255,255,255,0.08); color: inherit; border: 0; border-radius: 6px;
        padding: 4px 8px; font-size: 12px; cursor: pointer;
      }
      html[data-theme="light"] .cssos-dm-newgroup-btn { background: rgba(0,160,100,0.18); color: #0f3a2a; }
      html[data-theme="light"] .cssos-dm-newgroup-btn:hover { background: rgba(0,160,100,0.30); }
      html[data-theme="light"] .cssos-dm-thread-icon { background: rgba(0,160,100,0.18); color: #0f3a2a; }
      html[data-theme="light"] .cssos-dm-modal-card { background: #fff; color: #0f3a2a; border-color: rgba(0,0,0,0.12); }
      html[data-theme="light"] .cssos-dm-modal-card input { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.12); color: #0f3a2a; }
      html[data-theme="light"] .cssos-dm-modal-actions .primary { background: #00a060; color: #fff; }
      html[data-theme="light"] .cssos-dm-modal-actions .ghost { background: rgba(0,160,100,0.10); color: #0f3a2a; }
      html[data-theme="light"] .cssos-dm-pane-actions button { background: rgba(0,160,100,0.10); color: #0f3a2a; }
      @media (max-width: 720px) {
        .cssos-dm-shell { grid-template-columns: 1fr; }
        .cssos-dm-rail { display: var(--cssos-dm-rail-display, flex); }
        .cssos-dm-pane { display: var(--cssos-dm-pane-display, none); }
        .cssos-dm-shell.has-active { --cssos-dm-rail-display: none; --cssos-dm-pane-display: flex; }
      }
    `;
    document.head.appendChild(s);
  }

  // ---------- topbar 💌 button ----------
  function createBtn() {
    injectStyles();
    const host = document.createElement("div");
    host.className = "cssos-dm-host";
    host.innerHTML = `
      <button class="cssos-dm-btn" type="button" title="${T("Messages", "私信")}" aria-label="${T("Messages", "私信")}">
        💌<span class="cssos-dm-badge" hidden>0</span>
      </button>
    `;
    return host;
  }
  function findMountTarget() {
    return (
      document.querySelector("header.cssos-discover-header") ||
      document.querySelector("header.cssos-topbar") ||
      document.querySelector(".cssos-topbar") ||
      document.querySelector(".topbar") ||
      document.querySelector("header") ||
      null
    );
  }
  function setBtnBadge(host, n) {
    const b = host.querySelector(".cssos-dm-badge");
    if (!b) return;
    if (n > 0) { b.hidden = false; b.textContent = n > 99 ? "99+" : String(n); }
    else { b.hidden = true; }
  }
  async function refreshUnread(host) {
    const j = await api("/api/dm/unread-count");
    if (!j || !j.ok) return;
    setBtnBadge(host, Number(j.unread_count || 0));
  }
  function mountBtn() {
    if (document.querySelector(".cssos-dm-host")) return;
    const target = findMountTarget();
    const host = createBtn();
    if (target) target.appendChild(host);
    else {
      host.style.position = "fixed";
      host.style.top = "10px";
      host.style.right = "44px";
      host.style.zIndex = "9998";
      document.body.appendChild(host);
    }
    host.querySelector(".cssos-dm-btn").addEventListener("click", () => {
      window.location.hash = "#dm";
    });
    // Auth-gated polling — same pattern as notif bell.
    (async () => {
      try {
        const r = await fetch("/api/me", { credentials: "include" });
        if (!r.ok) return;
        const me = await r.json();
        const uid = me && (me.user?.id || me.id);
        if (!uid) return;
        refreshUnread(host);
        setInterval(() => {
          if (document.visibilityState === "visible") refreshUnread(host);
        }, 30_000);
      } catch (_e) { /* guest */ }
    })();
  }

  // ---------- panel ----------
  let activeThreadId = null;
  let activeThreadOther = null;
  let pollIv = 0;
  let ws = null;
  let myUserId = null;

  function avatarHtml(other) {
    const name = (other && (other.display_name || other.username || "?")) || "?";
    const letter = (name.match(/[A-Za-z一-鿿]/) || ["?"])[0].toUpperCase();
    if (other && other.avatar_url) {
      return `<div class="cssos-dm-avatar" style="background-image:url('${safe(other.avatar_url)}')"></div>`;
    }
    return `<div class="cssos-dm-avatar">${safe(letter)}</div>`;
  }

  function buildOverlay() {
    const ov = document.createElement("div");
    ov.className = "cssos-dm-overlay";
    ov.hidden = true;
    ov.innerHTML = `
      <div class="cssos-dm-shell">
        <aside class="cssos-dm-rail">
          <div class="cssos-dm-rail-head">
            <span>${T("Messages", "私信")}</span>
            <span style="display:flex;gap:6px;align-items:center;">
              <button class="cssos-dm-newgroup-btn" type="button" title="${T("New group", "新建群组")}">+ ${T("New group", "新建群组")}</button>
              <button class="cssos-dm-close" type="button" aria-label="Close">✕</button>
            </span>
          </div>
          <div class="cssos-dm-threads"></div>
        </aside>
        <section class="cssos-dm-pane">
          <div class="cssos-dm-pane-head"><span>${T("Select a conversation", "选择一段对话")}</span></div>
          <div class="cssos-dm-msgs"><div class="cssos-dm-empty">${T("No conversation selected.", "尚未选择对话。")}</div></div>
          <div class="cssos-dm-input-row">
            <textarea class="cssos-dm-input" rows="1" placeholder="${T("Type a message…", "输入消息…")}" disabled></textarea>
            <button class="cssos-dm-send" type="button" disabled>${T("Send", "发送")}</button>
          </div>
        </section>
      </div>
    `;
    ov.querySelector(".cssos-dm-close").addEventListener("click", closePanel);
    const ngBtn = ov.querySelector(".cssos-dm-newgroup-btn");
    if (ngBtn) ngBtn.addEventListener("click", openNewGroupModal);
    ov.addEventListener("click", (e) => {
      if (e.target === ov) closePanel();
    });
    document.body.appendChild(ov);
    return ov;
  }
  function getOverlay() {
    return document.querySelector(".cssos-dm-overlay") || buildOverlay();
  }

  async function loadThreads() {
    const ov = getOverlay();
    const list = ov.querySelector(".cssos-dm-threads");
    const j = await api("/api/dm/threads?limit=30");
    if (!j || !j.ok) {
      list.innerHTML = `<div class="cssos-dm-empty" style="padding:20px">${T("Sign in to message.", "登录后使用私信。")}</div>`;
      return;
    }
    if (!j.threads || !j.threads.length) {
      list.innerHTML = `<div class="cssos-dm-empty" style="padding:20px">${T("No conversations yet.", "还没有对话。")}</div>`;
      return;
    }
    list.innerHTML = j.threads.map((t) => {
      const isGroup = t.kind === "group";
      const name = isGroup
        ? (t.title || T("Group", "群组"))
        : ((t.other && (t.other.display_name || t.other.username)) || "user");
      const unread = Number(t.unread_count || 0);
      const cls = "cssos-dm-thread" + (t.thread_id === activeThreadId ? " active" : "");
      const preview = t.last_body ? String(t.last_body).slice(0, 80) : T("No messages yet.", "暂无消息");
      const icon = isGroup
        ? `<div class="cssos-dm-thread-icon">👥</div>`
        : avatarHtml(t.other || {});
      const dataOther = isGroup ? "null" : safe(JSON.stringify(t.other || {}));
      const memberSuffix = isGroup ? ` · ${Number(t.member_count || 0)}` : "";
      return `<div class="${cls}" data-tid="${safe(t.thread_id)}" data-kind="${safe(t.kind || 'pair')}" data-title="${safe(t.title || '')}" data-other='${dataOther}'>
        ${icon}
        <div class="cssos-dm-thread-meta">
          <div class="cssos-dm-thread-name">
            <span>${safe(name)}${safe(memberSuffix)}</span>
            ${unread > 0 ? `<span class="cssos-dm-unread-pill">${unread > 99 ? "99+" : unread}</span>` : ""}
          </div>
          <div class="cssos-dm-thread-preview">${safe(preview)}</div>
        </div>
      </div>`;
    }).join("");
    list.querySelectorAll(".cssos-dm-thread").forEach((el) => {
      el.addEventListener("click", () => {
        const tid = el.getAttribute("data-tid");
        const kind = el.getAttribute("data-kind") || "pair";
        const title = el.getAttribute("data-title") || "";
        let other = null;
        try { other = JSON.parse(el.getAttribute("data-other") || "null"); } catch (_e) {}
        openThread(tid, other, { kind, title });
      });
    });
  }

  function teardownLive() {
    if (pollIv) { clearInterval(pollIv); pollIv = 0; }
    if (ws) { try { ws.close(); } catch (_e) {} ws = null; }
  }

  function setupLive(tid) {
    teardownLive();
    // Try WebSocket; fall through to 5s polling if it fails or closes early.
    let wsOk = false;
    try {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${location.host}/ws/dm/${encodeURIComponent(tid)}`);
      ws.onopen = () => { wsOk = true; };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.kind === "dm_message" && msg.thread_id === tid) {
            appendMessage({
              message_id: msg.message_id,
              sender_id: msg.sender_id,
              body: msg.body,
              created_at: msg.created_at,
            });
            // Mark read since user is viewing.
            api(`/api/dm/threads/${encodeURIComponent(tid)}/read`, { method: "POST" });
          }
        } catch (_e) {}
      };
      ws.onclose = () => {
        if (!wsOk && tid === activeThreadId) {
          // Polling fallback.
          pollIv = setInterval(() => pollMessages(tid), 5000);
        }
      };
      ws.onerror = () => { /* close handler will set polling */ };
    } catch (_e) {
      pollIv = setInterval(() => pollMessages(tid), 5000);
    }
  }

  let lastSeenMessageId = "0";
  async function pollMessages(tid) {
    const j = await api(`/api/dm/threads/${encodeURIComponent(tid)}/messages?limit=30`);
    if (!j || !j.ok) return;
    const ov = getOverlay();
    const cur = ov.querySelector(".cssos-dm-msgs");
    if (!cur) return;
    // Append only new ones beyond lastSeenMessageId.
    let highest = lastSeenMessageId;
    for (const m of j.messages) {
      if (BigInt(m.message_id) > BigInt(lastSeenMessageId || "0")) {
        appendMessage(m);
        if (BigInt(m.message_id) > BigInt(highest || "0")) highest = m.message_id;
      }
    }
    lastSeenMessageId = highest;
  }

  function renderMessages(messages) {
    const ov = getOverlay();
    const list = ov.querySelector(".cssos-dm-msgs");
    if (!messages.length) {
      list.innerHTML = `<div class="cssos-dm-empty">${T("Say hi 👋", "打个招呼 👋")}</div>`;
      lastSeenMessageId = "0";
      return;
    }
    list.innerHTML = messages.map(msgHtml).join("");
    list.scrollTop = list.scrollHeight;
    lastSeenMessageId = messages[messages.length - 1].message_id;
  }
  function msgHtml(m) {
    const mine = String(m.sender_id) === String(myUserId);
    return `<div class="cssos-dm-msg ${mine ? "mine" : "theirs"}">
      <div>${safe(m.body)}</div>
      <div class="cssos-dm-msg-meta">${safe(fmtRel(m.created_at))}</div>
    </div>`;
  }
  function appendMessage(m) {
    const ov = getOverlay();
    const list = ov.querySelector(".cssos-dm-msgs");
    const empty = list.querySelector(".cssos-dm-empty");
    if (empty) empty.remove();
    list.insertAdjacentHTML("beforeend", msgHtml(m));
    list.scrollTop = list.scrollHeight;
    if (BigInt(m.message_id || "0") > BigInt(lastSeenMessageId || "0")) {
      lastSeenMessageId = m.message_id;
    }
  }

  let activeThreadKind = "pair";
  let activeThreadTitle = "";
  async function openThread(tid, other, meta) {
    activeThreadId = tid;
    activeThreadOther = other || null;
    activeThreadKind = (meta && meta.kind) || "pair";
    activeThreadTitle = (meta && meta.title) || "";
    const ov = getOverlay();
    ov.querySelector(".cssos-dm-shell").classList.add("has-active");
    const head = ov.querySelector(".cssos-dm-pane-head");
    if (activeThreadKind === "group") {
      const title = activeThreadTitle || T("Group", "群组");
      head.innerHTML = `<div class="cssos-dm-thread-icon">👥</div><span>${safe(title)}</span>
        <span class="cssos-dm-pane-actions">
          <button class="cssos-dm-manage" type="button">${T("Manage", "管理")}</button>
          <button class="cssos-dm-leave" type="button">${T("Leave", "离开")}</button>
        </span>`;
      const mg = head.querySelector(".cssos-dm-manage");
      if (mg) mg.addEventListener("click", () => manageGroup(tid));
      const lv = head.querySelector(".cssos-dm-leave");
      if (lv) lv.addEventListener("click", () => leaveGroup(tid));
    } else {
      const otherName = (other && (other.display_name || other.username)) || T("Conversation", "对话");
      head.innerHTML = `${avatarHtml(other || {})}<span>${safe(otherName)}</span>`;
    }
    const list = ov.querySelector(".cssos-dm-msgs");
    list.innerHTML = `<div class="cssos-dm-empty">${T("Loading…", "加载中…")}</div>`;
    const input = ov.querySelector(".cssos-dm-input");
    const sendBtn = ov.querySelector(".cssos-dm-send");
    input.disabled = false; sendBtn.disabled = false; input.value = "";
    input.focus();
    // Mark active in rail.
    ov.querySelectorAll(".cssos-dm-thread").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-tid") === tid);
    });
    const j = await api(`/api/dm/threads/${encodeURIComponent(tid)}/messages?limit=50`);
    if (!j || !j.ok) {
      list.innerHTML = `<div class="cssos-dm-empty">${T("Failed to load.", "加载失败。")}</div>`;
      return;
    }
    renderMessages(j.messages || []);
    await api(`/api/dm/threads/${encodeURIComponent(tid)}/read`, { method: "POST" });
    setupLive(tid);
    // refresh unread badge after read.
    const bellHost = document.querySelector(".cssos-dm-host");
    if (bellHost) refreshUnread(bellHost);
  }

  async function sendActive() {
    if (!activeThreadId) return;
    const ov = getOverlay();
    const input = ov.querySelector(".cssos-dm-input");
    const sendBtn = ov.querySelector(".cssos-dm-send");
    const body = String(input.value || "").trim();
    if (!body) return;
    if (body.length > 4000) {
      alert(T("Message too long (max 4000).", "消息过长（最多 4000 字符）。"));
      return;
    }
    sendBtn.disabled = true; input.disabled = true;
    const j = await api(`/api/dm/threads/${encodeURIComponent(activeThreadId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    sendBtn.disabled = false; input.disabled = false;
    if (!j || !j.ok) {
      if (j && j.code === "BLOCKED") {
        input.disabled = true; sendBtn.disabled = true;
        input.placeholder = T("You blocked this user — unblock to message", "你已屏蔽该用户 — 解除屏蔽以发消息");
      } else if (j && j.code === "RATE_LIMITED") {
        alert(T("Too many messages — slow down.", "发送过快 — 请稍后再试。"));
      } else {
        alert(T("Send failed.", "发送失败。"));
      }
      return;
    }
    input.value = "";
    appendMessage(j.message);
    input.focus();
    loadThreads();
  }

  async function ensureMe() {
    if (myUserId) return myUserId;
    try {
      const r = await fetch("/api/me", { credentials: "include" });
      if (!r.ok) return null;
      const me = await r.json();
      myUserId = (me && (me.user?.id || me.id)) || null;
    } catch (_e) {}
    return myUserId;
  }

  async function openPanel() {
    const ov = getOverlay();
    if (!await ensureMe()) {
      alert(T("Sign in to use messages.", "请登录以使用私信。"));
      window.location.hash = "";
      return;
    }
    ov.hidden = false;
    document.documentElement.style.overflow = "hidden";
    const ov2 = getOverlay();
    const sendBtn = ov2.querySelector(".cssos-dm-send");
    const input = ov2.querySelector(".cssos-dm-input");
    if (!sendBtn.__wired) {
      sendBtn.__wired = true;
      sendBtn.addEventListener("click", sendActive);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendActive();
        }
      });
    }
    await loadThreads();
    // If hash had a thread param: #dm/<tid>
    const m = String(location.hash || "").match(/^#dm\/([0-9a-fA-F-]{36})$/);
    if (m) {
      const tid = m[1];
      // Find in rail to grab "other".
      const row = ov.querySelector(`.cssos-dm-thread[data-tid="${tid}"]`);
      let other = null;
      if (row) {
        try { other = JSON.parse(row.getAttribute("data-other") || "null"); } catch (_e) {}
      }
      openThread(tid, other);
    }
  }

  function openNewGroupModal() {
    const m = document.createElement("div");
    m.className = "cssos-dm-modal";
    m.innerHTML = `
      <div class="cssos-dm-modal-card">
        <h3>${T("New group", "新建群组")}</h3>
        <label>${T("Group title", "群组名称")}</label>
        <input class="ng-title" type="text" maxlength="120" placeholder="${T("Team chat", "群聊")}" />
        <label>${T("Members (comma-separated handles)", "成员（用逗号分隔的用户名）")}</label>
        <input class="ng-members" type="text" placeholder="alice, bob" />
        <div class="cssos-dm-modal-actions">
          <button class="ghost" type="button">${T("Cancel", "取消")}</button>
          <button class="primary" type="button">${T("Create", "创建")}</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    const close = () => m.remove();
    m.querySelector(".ghost").addEventListener("click", close);
    m.addEventListener("click", (e) => { if (e.target === m) close(); });
    m.querySelector(".primary").addEventListener("click", async () => {
      const title = m.querySelector(".ng-title").value.trim();
      const members = m.querySelector(".ng-members").value.split(",").map((x) => x.trim()).filter(Boolean);
      if (!title) { alert(T("Title required.", "请填写群名。")); return; }
      if (members.length < 1) { alert(T("Add at least one member.", "至少添加一位成员。")); return; }
      const j = await api("/api/dm/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, member_handles: members }),
      });
      if (!j || !j.ok) { alert(T("Could not create group.", "无法创建群组。")); return; }
      close();
      await loadThreads();
      openThread(j.thread_id, null, { kind: "group", title: j.title });
    });
  }
  async function manageGroup(tid) {
    const j = await api(`/api/dm/groups/${encodeURIComponent(tid)}/members`);
    if (!j || !j.ok) { alert(T("Failed to load members.", "加载成员失败。")); return; }
    const canInvite = j.my_role === "owner" || j.my_role === "admin";
    const handle = canInvite
      ? prompt(T("Invite a user (handle):", "邀请用户（用户名）："), "")
      : null;
    if (handle && handle.trim()) {
      const r = await api(`/api/dm/groups/${encodeURIComponent(tid)}/invite`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim() }),
      });
      if (!r || !r.ok) alert(T("Invite failed.", "邀请失败。"));
      else loadThreads();
    }
  }
  async function leaveGroup(tid) {
    if (!confirm(T("Leave this group?", "确定要离开此群组？"))) return;
    const r = await api(`/api/dm/groups/${encodeURIComponent(tid)}/leave`, { method: "POST" });
    if (!r || !r.ok) {
      if (r && r.code === "OWNER_MUST_TRANSFER") {
        alert(T("Transfer ownership before leaving.", "请先转让群主再离开。"));
      } else {
        alert(T("Leave failed.", "退出失败。"));
      }
      return;
    }
    activeThreadId = null;
    closePanel();
    location.hash = "#dm";
    await loadThreads();
  }

  function closePanel() {
    const ov = document.querySelector(".cssos-dm-overlay");
    if (ov) ov.hidden = true;
    document.documentElement.style.overflow = "";
    teardownLive();
    activeThreadId = null;
    if (location.hash.startsWith("#dm")) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    const bellHost = document.querySelector(".cssos-dm-host");
    if (bellHost) refreshUnread(bellHost);
  }

  function onHashChange() {
    if (String(location.hash || "").startsWith("#dm")) openPanel();
    else closePanel();
  }

  // Public helper for "Message" buttons elsewhere.
  window.cssosOpenDmWith = async function (handle) {
    if (!handle) return;
    if (!await ensureMe()) {
      alert(T("Sign in to send a message.", "请登录后发送消息。"));
      return;
    }
    const j = await api("/api/dm/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: String(handle) }),
    });
    if (!j || !j.ok) {
      if (j && j.code === "BLOCKED") {
        alert(T("Cannot message — blocked.", "无法发送 — 已屏蔽。"));
      } else {
        alert(T("Could not open conversation.", "无法打开对话。"));
      }
      return;
    }
    location.hash = `#dm/${j.thread_id}`;
    setTimeout(() => {
      // openPanel triggered by hashchange; ensure thread loads with "other".
      openThread(j.thread_id, j.other);
    }, 50);
  };

  function tryMount() {
    const go = () => {
      mountBtn();
      onHashChange();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(go, 250));
    } else {
      setTimeout(go, 250);
    }
    setTimeout(() => {
      if (!document.querySelector(".cssos-dm-host")) mountBtn();
    }, 1500);
    window.addEventListener("hashchange", onHashChange);
  }
  tryMount();
})();
