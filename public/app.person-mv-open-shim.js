/* CSSOS_WAVE_500 20260530 — Jing「用谁加载谁」: person-mv-panel.js (220KB) 改懒加载.
 * 轻量 eager shim(照搬 mv-pipeline-open-shim 模式): ① 自挂载 🏛️ People MV Dock 按钮 +
 * 注册 dock 动作; ② 给 person-mv 的 4 个全局入口装桩 —— 点击/调用时才 cssosLoadPanel
 * ("person-mv") 加载重模块, 重模块 IIFE 覆盖回真函数后用原参数调真函数。person-mv 的
 * 共享工具(civDisplayName/civToLanguageModule/cssosMountLanguagePicker)主定义在 eager 的
 * app.civ-language-map.js; resize/collapse 基础设施在 eager 的 app.panel-resize/collapse;
 * handleGlobalAction 在 eager 的 app.js —— 故 person-mv 懒加载不影响启动。 */
(function () {
  "use strict";
  if (globalThis.__cssosPersonMvShimInstalled) return;
  globalThis.__cssosPersonMvShimInstalled = true;

  var ENTRY_FNS = ["openPersonMvCodex", "openPersonMvPanel", "openLandmarkMvCodex", "openPersonMvGroup"];
  var loadInflight = null;
  function loadHeavy() {
    if (loadInflight) return loadInflight;
    if (typeof globalThis.cssosLoadPanel === "function") loadInflight = globalThis.cssosLoadPanel("person-mv");
    else loadInflight = new Promise(function (res, rej) {
      var tag = document.querySelector('script[type="cssos-lazy"][data-panel="person-mv"]');
      if (!tag) return rej(new Error("no person-mv lazy tag"));
      var s = document.createElement("script"); s.src = tag.getAttribute("src"); s.async = false;
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error("person-mv load fail")); };
      document.head.appendChild(s);
    });
    return loadInflight;
  }
  function makeStub(fnName) {
    function stub() {
      var args = arguments, self = this;
      return loadHeavy().then(function () {
        var real = globalThis[fnName];
        if (typeof real === "function" && real.__cssosShim !== true) {
          try { return real.apply(self, args); } catch (e) { console.warn("[person-mv-shim] " + fnName + " threw:", e); }
        } else { console.warn("[person-mv-shim] loaded but " + fnName + " missing"); }
      }, function (err) {
        console.warn("[person-mv-shim] load failed:", err);
        try { if (typeof globalThis.showToast === "function") globalThis.showToast(
          typeof globalThis.loginCopy === "function"
            ? globalThis.loginCopy("People MV failed to load. Please retry.", "人物 MV 加载失败，请重试。")
            : "People MV failed to load."); } catch (_e) {}
      });
    }
    stub.__cssosShim = true;
    return stub;
  }
  ENTRY_FNS.forEach(function (fn) {
    var cur = globalThis[fn];
    if (typeof cur === "function" && cur.__cssosShim !== true) return; // real already present
    globalThis[fn] = makeStub(fn);
  });

  // dock action + self-mounted button (copied from person-mv-panel so it exists pre-load).
  function registerDockAction() {
    try {
      var map = globalThis.__cssosDockActionMap = globalThis.__cssosDockActionMap || {};
      if (typeof map["person-mv"] !== "function") map["person-mv"] = function () { globalThis.openPersonMvPanel(); };
      globalThis.dockActionMap = globalThis.__cssosDockActionMap;
    } catch (_e) {}
  }
  function mountDockItem() {
    var dock = document.querySelector(".dock");
    if (!dock) return false;
    if (dock.querySelector('[data-action="person-mv"]')) return true;
    var item = document.createElement("button");
    item.className = "dock-item"; item.type = "button";
    item.setAttribute("data-action", "person-mv");
    item.setAttribute("data-actions", "click,dblclick,longpress");
    item.setAttribute("data-tooltip", "People MV");
    item.setAttribute("aria-label", "People MV");
    item.innerHTML = '<span class="dock-ico" aria-hidden="true">🏛️</span><span class="dock-label">People MV</span>';
    var ref = dock.querySelector('[data-action="cssmv"], [data-action="mv-pipeline"], [data-action="watch"]');
    if (ref && ref.nextSibling) dock.insertBefore(item, ref.nextSibling); else dock.appendChild(item);
    return true;
  }
  function ensureDockItem(retries) {
    if (mountDockItem()) return;
    if (retries <= 0) return;
    setTimeout(function () { ensureDockItem(retries - 1); }, 400);
  }
  registerDockAction();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { ensureDockItem(20); });
  else ensureDockItem(20);
})();
