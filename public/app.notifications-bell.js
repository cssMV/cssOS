/* CSSOS_PERSON_MV_WAVE20 20260508 — Jing
 * Notification bell — self-mounting on the topbar. Polls
 * /api/notifications/unread-count every 30s while the tab is visible.
 * Click → dropdown with most recent 20; opening marks all as read.
 * No external deps; isolated styles via inline tag. */
(function () {
  "use strict";
  if (window.__cssosNotifBellMounted) return;
  window.__cssosNotifBellMounted = true;

  const ZH = /^zh/i.test(String(globalThis.currentLocale || navigator.language || "en"));
  const T = (en, zh) => (ZH ? zh : en);

  function fmtRel(iso) {
    try {
      const t = new Date(iso).getTime();
      if (!t) return "";
      const dt = Math.max(0, Date.now() - t);
      const s = Math.floor(dt / 1000);
      if (s < 60) return T("just now", "刚刚");
      const m = Math.floor(s / 60);
      if (m < 60) return T(`${m}m`, `${m}分钟前`);
      const h = Math.floor(m / 60);
      if (h < 24) return T(`${h}h`, `${h}小时前`);
      const d = Math.floor(h / 24);
      if (d < 7) return T(`${d}d`, `${d}天前`);
      return new Date(iso).toLocaleDateString();
    } catch (_e) { return ""; }
  }

  function injectStyles() {
    if (document.getElementById("cssos-notif-bell-style")) return;
    const s = document.createElement("style");
    s.id = "cssos-notif-bell-style";
    s.textContent = `
      .cssos-notif-bell-host { position: relative; display: inline-flex; align-items: center; }
      .cssos-notif-bell-btn {
        background: transparent; border: 0; cursor: pointer;
        font-size: 18px; line-height: 1; padding: 6px 8px; color: inherit;
        border-radius: 6px; position: relative;
      }
      .cssos-notif-bell-btn:hover { background: rgba(255,255,255,0.08); }
      .cssos-notif-bell-badge {
        position: absolute; top: 0; right: 0; min-width: 16px; height: 16px;
        padding: 0 4px; border-radius: 8px; background: #e54545; color: #fff;
        font-size: 10px; line-height: 16px; text-align: center; font-weight: 600;
        pointer-events: none;
      }
      .cssos-notif-bell-panel {
        position: absolute; top: calc(100% + 6px); right: 0;
        width: 340px; max-height: 460px; overflow: auto;
        background: var(--panel-bg, #1a1d24); color: var(--panel-fg, #e8e8ec);
        border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.45);
        z-index: 9999; padding: 6px;
      }
      .cssos-notif-bell-panel[hidden] { display: none; }
      .cssos-notif-item {
        padding: 8px 10px; border-radius: 6px; cursor: pointer;
        font-size: 13px; line-height: 1.35;
        display: flex; flex-direction: column; gap: 2px;
      }
      .cssos-notif-item:hover { background: rgba(255,255,255,0.06); }
      .cssos-notif-item .meta { font-size: 11px; opacity: 0.6; }
      .cssos-notif-item.unread { background: rgba(120, 160, 255, 0.08); }
      .cssos-notif-empty { padding: 24px 12px; text-align: center; opacity: 0.6; font-size: 12px; }
    `;
    document.head.appendChild(s);
  }

  function createBell() {
    injectStyles();
    const host = document.createElement("div");
    host.className = "cssos-notif-bell-host";
    host.innerHTML = `
      <button class="cssos-notif-bell-btn" type="button" title="${T("Notifications", "通知")}" aria-label="${T("Notifications", "通知")}">
        🔔<span class="cssos-notif-bell-badge" hidden>0</span>
      </button>
      <div class="cssos-notif-bell-panel" hidden role="dialog" aria-label="${T("Notifications", "通知")}"></div>
    `;
    return host;
  }

  function findMountTarget() {
    // Prefer the topbar; fall back to a fixed anchor.
    const candidates = [
      document.querySelector("header.cssos-discover-header"),
      document.querySelector("header.cssos-topbar"),
      document.querySelector(".cssos-topbar"),
      document.querySelector(".topbar"),
      document.querySelector("header"),
    ].filter(Boolean);
    return candidates[0] || null;
  }

  function mount() {
    if (document.querySelector(".cssos-notif-bell-host")) return true;
    const target = findMountTarget();
    const host = createBell();
    if (target) {
      target.appendChild(host);
    } else {
      // Fallback: pinned to the top-right.
      host.style.position = "fixed";
      host.style.top = "10px";
      host.style.right = "12px";
      host.style.zIndex = "9998";
      document.body.appendChild(host);
    }
    wire(host);
    return true;
  }

  function payloadLine(n) {
    const p = (n && n.payload) || {};
    const actor = p.actor_name || p.actor_username || T("Someone", "有人");
    const handle = p.actor_username ? `@${p.actor_username}` : actor;
    if (n.kind === "mv_like") {
      return T(`🤍 ${handle} liked your MV`, `🤍 ${handle} 赞了你的 MV`);
    }
    if (n.kind === "mv_comment") {
      const body = String(p.comment_body || "").slice(0, 50);
      return T(`💬 ${handle}: ${body}`, `💬 ${handle}: ${body}`);
    }
    if (n.kind === "follow") {
      return T(`👋 ${handle} followed you`, `👋 ${handle} 关注了你`);
    }
    return n.kind;
  }

  function targetUrl(n) {
    const p = (n && n.payload) || {};
    if (n.kind === "follow") {
      return p.actor_username ? `/u/${p.actor_username}` : null;
    }
    if (n.kind === "mv_like" || n.kind === "mv_comment") {
      if (p.mv_id) return `/mv/${p.mv_id}`;
    }
    return null;
  }

  async function api(path, opts) {
    try {
      const r = await fetch(path, Object.assign({ credentials: "include" }, opts || {}));
      if (!r.ok) return null;
      return await r.json();
    } catch (_e) { return null; }
  }

  function setBadge(host, n) {
    const badge = host.querySelector(".cssos-notif-bell-badge");
    if (!badge) return;
    if (n > 0) {
      badge.hidden = false;
      badge.textContent = n > 99 ? "99+" : String(n);
    } else {
      badge.hidden = true;
    }
  }

  async function refreshUnread(host) {
    const j = await api("/api/notifications/unread-count");
    if (!j || !j.ok) return;
    setBadge(host, Number(j.unread_count || 0));
  }

  async function openPanel(host) {
    const panel = host.querySelector(".cssos-notif-bell-panel");
    panel.hidden = false;
    panel.innerHTML = `<div class="cssos-notif-empty">${T("Loading…", "加载中…")}</div>`;
    const j = await api("/api/notifications?limit=20");
    if (!j || !j.ok) {
      panel.innerHTML = `<div class="cssos-notif-empty">${T("Sign in to see notifications.", "登录后查看通知。")}</div>`;
      return;
    }
    const items = j.notifications || [];
    if (!items.length) {
      panel.innerHTML = `<div class="cssos-notif-empty">${T("No notifications yet.", "暂无通知。")}</div>`;
    } else {
      panel.innerHTML = items.map((n) => {
        const line = payloadLine(n);
        const ts = fmtRel(n.created_at);
        const cls = n.read ? "cssos-notif-item" : "cssos-notif-item unread";
        const safe = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
        return `<div class="${cls}" data-id="${safe(n.id)}" data-href="${safe(targetUrl(n) || "")}">
          <div>${safe(line)}</div>
          <div class="meta">${safe(ts)}</div>
        </div>`;
      }).join("");
      panel.querySelectorAll(".cssos-notif-item").forEach((el) => {
        el.addEventListener("click", () => {
          const href = el.getAttribute("data-href");
          if (href) window.location.href = href;
        });
      });
    }
    // Mark all as read on open.
    await api("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBadge(host, 0);
  }

  function closePanel(host) {
    const panel = host.querySelector(".cssos-notif-bell-panel");
    if (panel) panel.hidden = true;
  }

  function wire(host) {
    const btn = host.querySelector(".cssos-notif-bell-btn");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const panel = host.querySelector(".cssos-notif-bell-panel");
      if (panel.hidden) openPanel(host);
      else closePanel(host);
    });
    document.addEventListener("click", (e) => {
      if (!host.contains(e.target)) closePanel(host);
    });
    // Initial + poll every 30s while visible.
    refreshUnread(host);
    setInterval(() => {
      if (document.visibilityState === "visible") refreshUnread(host);
    }, 30_000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshUnread(host);
    });
  }

  function tryMount() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(mount, 200));
    } else {
      setTimeout(mount, 200);
    }
    // Re-check after 1s in case the topbar hydrates late.
    setTimeout(() => {
      if (!document.querySelector(".cssos-notif-bell-host")) mount();
    }, 1500);
  }
  tryMount();
})();
