/* CSSOS_WAVE_1139 20260623 — Jing 指令: 凡是有卡片的地方, 右击卡片 → 菜单显示「分享链接」。
 *   用户可把作品分享到任何地方(包括评论区的安全嵌入)。复用现成 openCssosShareDialog({workId})。
 *   做法: 全局 contextmenu 监听, 从右击点向上找带 work id 的祖先(data-work-id / data-mv-id 等);
 *   找到才拦截弹自定义菜单, 否则放行原生右键(不打扰输入框/链接)。 */
(function () {
  "use strict";
  if (globalThis.__cssosCardCtxWired) return;
  globalThis.__cssosCardCtxWired = true;

  function tr(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    var zhLoc = false; try { zhLoc = String(document.documentElement.lang || "").slice(0, 2) === "zh"; } catch (_e) {}
    return zhLoc ? zh : en;
  }

  function workIdFrom(el) {
    var t = el, depth = 0;
    while (t && t.nodeType === 1 && t !== document.body && depth < 14) {
      var ds = t.dataset || {};
      var id = ds.workId || ds.workid || ds.mvId || ds.cssmv || ds.cssosWorkId ||
        (t.getAttribute && (t.getAttribute("data-work-id") || t.getAttribute("data-mv-id"))) || "";
      id = String(id || "").trim();
      if (id && id !== "#" && id.length > 6) return id;
      t = t.parentNode; depth++;
    }
    return "";
  }

  function closeMenu() {
    var m = document.getElementById("cssos-card-ctx"); if (m) m.remove();
    document.removeEventListener("mousedown", onAway, true);
    document.removeEventListener("scroll", closeMenu, true);
  }
  function onAway(e) { var m = document.getElementById("cssos-card-ctx"); if (m && !m.contains(e.target)) closeMenu(); }

  function showMenu(x, y, workId) {
    closeMenu();
    var menu = document.createElement("div");
    menu.id = "cssos-card-ctx";
    menu.style.cssText =
      "position:fixed;z-index:2147483646;min-width:180px;background:rgba(10,12,16,0.97);" +
      "border:1px solid rgba(255,255,255,0.16);border-radius:11px;padding:6px;" +
      "box-shadow:0 12px 40px rgba(0,0,0,0.6);font:500 13px/1.4 -apple-system,system-ui,sans-serif;color:#fff;user-select:none;";
    var item = document.createElement("button");
    item.type = "button";
    item.style.cssText = "display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:0;color:inherit;padding:9px 12px;border-radius:7px;cursor:pointer;font:inherit;text-align:left;";
    item.innerHTML = '<span style="font-size:15px;width:20px;text-align:center;">🔗</span><span style="flex:1;">' + tr("Share link", "分享链接") + "</span>";
    item.addEventListener("mouseenter", function () { item.style.background = "rgba(255,255,255,0.08)"; });
    item.addEventListener("mouseleave", function () { item.style.background = "transparent"; });
    item.addEventListener("click", function () {
      closeMenu();
      try {
        if (typeof globalThis.openCssosShareDialog === "function") globalThis.openCssosShareDialog({ workId: workId });
        else if (typeof globalThis.sharePersonMv === "function") globalThis.sharePersonMv(workId);
        else if (typeof globalThis.showToast === "function") globalThis.showToast(tr("Share unavailable.", "分享暂不可用。"));
      } catch (_e) {}
    });
    menu.appendChild(item);
    // CSSOS_WAVE_1147 — 统一影院挂载工具(全屏层内可见; 收口反复踩的"挂 body 看不见"坑)。
    (globalThis.cssosMountInCinema || function (el) { (document.fullscreenElement || document.body).appendChild(el); })(menu);
    // 夹紧在视口内。
    var vw = window.innerWidth || 360, vh = window.innerHeight || 640;
    var mw = menu.offsetWidth || 180, mh = menu.offsetHeight || 44;
    menu.style.left = Math.max(8, Math.min(x, vw - mw - 8)) + "px";
    menu.style.top = Math.max(8, Math.min(y, vh - mh - 8)) + "px";
    setTimeout(function () {
      document.addEventListener("mousedown", onAway, true);
      document.addEventListener("scroll", closeMenu, true);
    }, 0);
  }

  document.addEventListener("contextmenu", function (e) {
    var id = workIdFrom(e.target);
    if (!id) return;                 // 不是卡片 → 放行原生右键
    e.preventDefault();
    showMenu(e.clientX, e.clientY, id);
  });

  // CSSOS_WAVE_1140 — Jing 指令: 手机无右键 → 【长按】卡片触发同一个分享菜单。
  //   ~500ms 不动即触发; 手指移动超过阈值(滚动/滑动切歌)则取消, 不误触。
  var lpTimer = null, lpId = "", lpX = 0, lpY = 0;
  function lpCancel() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } lpId = ""; }
  document.addEventListener("touchstart", function (e) {
    if (!e.touches || e.touches.length !== 1) { lpCancel(); return; }
    var id = workIdFrom(e.target);
    if (!id) return;
    var t = e.touches[0];
    lpX = t.clientX; lpY = t.clientY; lpId = id;
    lpTimer = setTimeout(function () {
      if (!lpId) return;
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (_e) {}
      showMenu(lpX, lpY, lpId);
      lpCancel();
    }, 500);
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!lpTimer || !e.touches || !e.touches[0]) return;
    var t = e.touches[0];
    if (Math.abs(t.clientX - lpX) > 10 || Math.abs(t.clientY - lpY) > 10) lpCancel();   // 滑动 → 取消
  }, { passive: true });
  document.addEventListener("touchend", lpCancel, { passive: true });
  document.addEventListener("touchcancel", lpCancel, { passive: true });
})();
