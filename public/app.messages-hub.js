/* CSSOS_WAVE_1795 20260729 — Jing:「/api/rooms/* 房间藏在 AI 助理右上角的三点里,藏得太深」。
 *
 * 扫描结果:AI 助理的 ⋯ 菜单是个杂物抽屉,塞了 8 项 —— 讨论室、充值、私信、收件箱、
 * 提交bug、崩溃日志、内存监控、供应商健康。要用私信/讨论室得先想到去点 AI 助理,
 * 三层操作,且第一层跟功能本身毫无语义关系。
 *
 * 本模块把【社交消息】这一类提到 Dock 一级入口:一个 💬 消息 胶囊 → 弹出小面板,
 * 里面两个选项(私信 / 讨论室)。不为每个功能加一个 Dock 胶囊 —— Dock 已有 19 项,
 * 每项还有 120px 最小宽度的硬底线(W490),再塞会挤成一条。
 *
 * 【为什么这条优先做】不只是体验:我们刚给苹果声明了四个 App 的
 * Messaging and Chat = YES。审核员拿到这个声明会进 App 找私信在哪 —— 而 DM 的浮标
 * (#cssos-dm-stub-btn)被 agent-overflow-menu 用 display:none!important 强制隐藏了,
 * 只剩三点菜单一条路。审核员大概率找不到 → 会变成一条 rejection。
 *
 * 实现原则:【不碰】现有的 DM / 讨论室面板,只做转发。它们各自的按需加载、鉴权、
 * <13 社交门(W1790)逻辑全部原样复用。 */
(function () {
  "use strict";
  if (globalThis.__cssosMessagesHubWired) return;
  globalThis.__cssosMessagesHubWired = true;

  function tr(en) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en); } catch (_e) {}
    return en;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c];
    });
  }
  function toast(m) {
    try { if (typeof globalThis.showToast === "function") globalThis.showToast(m); } catch (_e) {}
  }

  /* ── 转发到既有实现 ────────────────────────────────────────────── */

  function openDm() {
    // 复用隐藏浮标的按需加载逻辑(和 agent-overflow-menu 的做法一致);拿不到再退深链。
    var stub = document.getElementById("cssos-dm-stub-btn");
    if (stub && typeof stub.click === "function") { stub.click(); return true; }
    try { location.hash = "#dm"; return true; } catch (_e) {}
    return false;
  }

  function openRooms() {
    if (typeof globalThis.cssosOpenRooms === "function") { globalThis.cssosOpenRooms(); return true; }
    // 兜底:chat-rooms 还没加载完时,点三点菜单里它自己挂的那一项。
    var item = document.querySelector('.cssos-agent-overflow-menu [data-act="rooms"]');
    if (item && typeof item.click === "function") { item.click(); return true; }
    toast(tr("Discussion rooms are still loading — try again in a moment."));
    return false;
  }

  /* ── 弹出小面板 ────────────────────────────────────────────────── */

  function injectCss() {
    if (document.getElementById("cssos-messages-hub-css")) return;
    var s = document.createElement("style");
    s.id = "cssos-messages-hub-css";
    s.textContent =
      "#cssos-messages-hub{position:fixed;inset:0;z-index:10064;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,0.42);backdrop-filter:blur(4px);font:500 14px/1.5 -apple-system,system-ui,sans-serif;}" +
      "#cssos-messages-hub .cmh-card{width:min(92vw,360px);background:#0d1512;color:#e8fff5;" +
      "border:1px solid rgba(0,245,160,0.30);border-radius:18px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,0.55);}" +
      "#cssos-messages-hub h3{margin:0 0 4px;font-size:18px;font-weight:700;}" +
      "#cssos-messages-hub .cmh-sub{opacity:0.72;font-size:12.5px;margin-bottom:16px;}" +
      // 两个并列按钮 = 平行按钮组 → 按 v28 宪法必须走 data-pill-bar,不写 bespoke pill CSS。
      "#cssos-messages-hub [data-pill-bar]{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(120px,1fr) !important;" +
      "align-items:stretch;min-height:40px;}" +
      "#cssos-messages-hub [data-pill-bar] > button{height:40px;display:flex;align-items:center;justify-content:center;" +
      "gap:7px;cursor:pointer;color:inherit;font:600 13px/1 -apple-system,system-ui,sans-serif;}" +
      "#cssos-messages-hub .cmh-close{margin-top:16px;width:100%;padding:9px;border-radius:999px;" +
      "border:1px solid rgba(0,245,160,0.28);background:rgba(0,245,160,0.08);color:#e8fff5;cursor:pointer;font-size:13px;}";
    (document.head || document.documentElement).appendChild(s);
  }

  /* 影院全屏层跟随。
   * W1147 的 cssosMountInCinema 只在【挂载那一刻】判断全屏元素,这对"先全屏、后弹窗"
   * 够用;但实测发现另一半场景:弹窗先开(此时还没全屏),App 随后才进影院全屏 ——
   * 全屏元素自成顶层,挂在 body 上的弹窗当场被甩出层外,看不见也点不到。
   * 所以这里除了初次挂载,还监听 fullscreenchange 把弹窗搬进/搬出当前全屏元素。
   * 关闭时务必解绑,否则每开一次就漏一个常驻监听。 */
  function mountFollowingFullscreen(ov) {
    function place() {
      var host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
      if (ov.parentElement !== host) {
        try { host.appendChild(ov); } catch (_e) { try { document.body.appendChild(ov); } catch (_e2) {} }
      }
    }
    place();
    document.addEventListener("fullscreenchange", place);
    document.addEventListener("webkitfullscreenchange", place);
    ov.__cmhUnwatch = function () {
      document.removeEventListener("fullscreenchange", place);
      document.removeEventListener("webkitfullscreenchange", place);
    };
  }

  function close() {
    var el = document.getElementById("cssos-messages-hub");
    if (!el) return;
    try { if (typeof el.__cmhUnwatch === "function") el.__cmhUnwatch(); } catch (_e) {}
    el.remove();
  }

  function open() {
    injectCss();
    close();
    var ov = document.createElement("div");
    ov.id = "cssos-messages-hub";
    ov.innerHTML =
      '<div class="cmh-card">' +
      '<h3>' + esc(tr("Messages")) + '</h3>' +
      '<div class="cmh-sub">' + esc(tr("Direct messages and discussion rooms.")) + '</div>' +
      // data-pill-bar:由 app.pill-bar.js 的 MutationObserver 自动上色/上凸嵌凹。
      // 每个胶囊都带图标(W497 要求),文字包在 <span> 里(Dock 那条同源要求)。
      '<div data-pill-bar>' +
      '  <button type="button" data-act="dm"><span>💌</span><span>' + esc(tr("Direct messages")) + '</span></button>' +
      '  <button type="button" data-act="rooms"><span>🏛</span><span>' + esc(tr("Discussion rooms")) + '</span></button>' +
      '</div>' +
      '<button type="button" class="cmh-close">' + esc(tr("Close")) + '</button>' +
      '</div>';

    ov.addEventListener("click", function (e) {
      if (e.target === ov) { close(); return; }
      var b = e.target.closest ? e.target.closest("[data-act],.cmh-close") : null;
      if (!b) return;
      if (b.classList.contains("cmh-close")) { close(); return; }
      var act = b.getAttribute("data-act");
      close();
      if (act === "dm") openDm();
      else if (act === "rooms") openRooms();
    });
    mountFollowingFullscreen(ov);
  }

  globalThis.cssosOpenMessagesHub = open;

  /* ── Dock 胶囊 ─────────────────────────────────────────────────── */

  function registerDockAction() {
    try {
      var map = globalThis.__cssosDockActionMap = globalThis.__cssosDockActionMap || {};
      map["messages"] = function () { open(); };
      globalThis.dockActionMap = globalThis.__cssosDockActionMap;
    } catch (_e) {}
  }

  function mountDockItem(force) {
    var dock = document.querySelector(".dock") || document.querySelector("#dock");
    if (!dock) return false;
    if (dock.querySelector('[data-action="messages"]')) return true;
    // 锚在【通知】之后 —— 消息和通知是同一类"找我的东西",放一起最好找。
    // 通知还没挂载就先等(返回 false 触发重试),重试耗尽再兜底追加。
    var anchor = dock.querySelector('[data-action="notifications"]');
    if (!anchor && !force) return false;

    var item = document.createElement("button");
    item.className = "dock-item";
    item.type = "button";
    item.setAttribute("data-action", "messages");
    item.setAttribute("data-actions", "click");
    item.setAttribute("data-tooltip", tr("Messages"));
    item.setAttribute("aria-label", tr("Messages"));
    // W490:Dock 胶囊必须带图标做视觉锚点,标签包 <span>(否则字号不受控)。
    item.innerHTML = '<span class="dock-ico" aria-hidden="true">💬</span>' +
      '<span class="dock-label">' + esc(tr("Messages")) + '</span>';
    if (anchor) dock.insertBefore(item, anchor.nextSibling);
    else dock.appendChild(item);
    item.addEventListener("click", function () { open(); });
    return true;
  }

  function ensureDockItem(retries) {
    if (mountDockItem(retries <= 0)) return;
    if (retries <= 0) return;
    setTimeout(function () { ensureDockItem(retries - 1); }, 400);
  }

  registerDockAction();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { ensureDockItem(20); });
  } else {
    ensureDockItem(20);
  }
})();
