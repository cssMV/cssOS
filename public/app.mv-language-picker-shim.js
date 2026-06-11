/* CSSOS_WAVE_662 20260606 — Jing 内核第2阶段·线B第1步: mv-language-picker 懒加载 eager shim.
 *
 * 难点: app.mv-language-picker.js 的 cssosMountLanguagePicker 是【同步返回 handle 对象】的 mount API,
 * 渲染期被调(creation-flow/person-mv/add-language-modal), 而 panel-router 的 fns 桩返回 Promise→会废
 * handle。好在该模块本就是"同步返回稳定 handle({_ready,getSelected,destroy}) + 异步(catalog fetch)填充"
 * 形态。本 shim 只是把"异步"从 catalog-fetch 再外延到 script-load: 同步返回稳定代理 handle → 懒加载真
 * 模块 → load 后用【原 container/opts】真挂载、把真 getSelected/destroy 接到所有已发出的代理上。三处
 * 调用方零改动(它们都只在用户交互后才用 handle, 空窗期 getSelected 返回缓存/[] 不崩)。
 *
 * 防双挂: creation-flow 用 `容器.children.length>0` 判已挂; 异步空窗期容器是空的, 可能被再次触发→双挂。
 * shim 同步往容器塞一个隐藏占位子节点, 让 children.length 立即>0, 真挂载时被清掉。 */
(function () {
  "use strict";
  // 若真模块已 eager 在场(未迁 / 回滚场景), 不覆盖。
  if (typeof globalThis.cssosMountLanguagePicker === "function") return;

  var pending = [];      // [{proxy, container, opts}] 待真模块接管
  var loadStarted = false;

  function ensureLoad() {
    if (loadStarted) return;
    loadStarted = true;
    var p = (typeof globalThis.cssosLoadPanel === "function")
      ? globalThis.cssosLoadPanel("mv-language-picker", { silent: true })
      : Promise.resolve();
    p.then(function () {
      var real = globalThis.cssosMountLanguagePicker;
      if (typeof real !== "function" || real === shimFn) return; // 加载失败/未被真模块覆盖
      var list = pending; pending = [];
      list.forEach(function (rec) {
        try {
          // 清掉占位, 让真模块从干净容器挂(它内部 catalog 到手后建 DOM)。
          try {
            var ph = rec.container.querySelector("[data-cssos-lang-loading]");
            if (ph && ph.parentNode === rec.container) rec.container.removeChild(ph);
          } catch (_e0) {}
          var realHandle = real(rec.container, rec.opts);
          if (!realHandle) return;
          var wire = function () {
            rec.proxy.getSelected = realHandle.getSelected;
            if (rec.proxy._pendingDestroy) { try { realHandle.destroy(); } catch (_e1) {} }
            else rec.proxy.destroy = realHandle.destroy;
          };
          if (realHandle._ready && typeof realHandle._ready.then === "function") realHandle._ready.then(wire);
          else wire();
        } catch (_e) {}
      });
    }, function () { /* 加载失败: 代理保持返回缓存/[], 优雅降级 */ });
  }

  function shimFn(container, opts) {
    if (!container) return null;
    opts = opts || {};
    var init = (opts.initialSelected && opts.initialSelected.slice) ? opts.initialSelected.slice() : [];
    var proxy = {
      _lastSelected: init,
      _pendingDestroy: false,
      getSelected: function () { return (this._lastSelected || []).slice(); },
      destroy: function () { this._pendingDestroy = true; },
    };
    // 包裹 onChange: 缓存最新选择(就绪前 getSelected 兜底)+ 转发原回调。
    var origOnChange = opts.onChange;
    var wrappedOpts = Object.assign({}, opts, {
      onChange: function (state) {
        try { if (state && state.languages) proxy._lastSelected = state.languages.slice(); } catch (_e) {}
        if (typeof origOnChange === "function") { try { origOnChange(state); } catch (_e2) {} }
      },
    });
    // 同步放隐藏占位, 防异步空窗期被 children.length 检查二次触发(双挂)。
    try {
      if (!container.querySelector("[data-cssos-lang-loading]")) {
        var ph = document.createElement("span");
        ph.setAttribute("data-cssos-lang-loading", "");
        ph.style.display = "none";
        container.appendChild(ph);
      }
    } catch (_e) {}
    pending.push({ proxy: proxy, container: container, opts: wrappedOpts });
    ensureLoad();
    return proxy;
  }

  globalThis.cssosMountLanguagePicker = shimFn;
})();
