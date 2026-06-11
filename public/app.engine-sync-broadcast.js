/* CSSOS_WAVE_520 20260606 — Jing「任一面板改引擎, 全平台实时同步」(阶段4 广播订阅).
 *
 * 独立脚本(不进 bundle / 不动打包器): 安装【一个全局订阅】, 让 document 里所有引擎
 * 选择器(高级设置 / MV 管线 / 人物 MV 等, 凡用标准 data-mv-engine-stage /
 * data-mv-engine-select 标记的)在任意一处选择变化时, 实时把 value + 价格/人气徽章
 * 刷新到 cssmvEngines 的最新选择 —— 单一真源, 全平台一致。
 *
 * 触发两路(覆盖所有面板, 不依赖各自是否 dispatch):
 *   A) 监听 cssmv:engine-selection-changed (setSelection / 各 change handler 广播);
 *   B) 捕获阶段监听任意引擎 <select> 的 change, 下一 tick 兜底同步(防个别面板不广播)。
 * 用全局 flag 防重复绑定(与 bundle 内同名守卫共享, 幂等)。 */
(function () {
  "use strict";
  if (globalThis.__cssosMvEngineBroadcastSync) return;
  globalThis.__cssosMvEngineBroadcastSync = true;

  function syncAll() {
    var api = globalThis.cssmvEngines;
    if (!api || typeof api.getSelection !== "function") return;
    document.querySelectorAll("[data-mv-engine-stage]").forEach(function (row) {
      if (!(row instanceof HTMLElement)) return;
      var stageKey = String(row.getAttribute("data-mv-engine-stage") || "").toLowerCase();
      if (!stageKey) return;
      var select = row.querySelector("[data-mv-engine-select]");
      var sel = api.getSelection(stageKey);
      if (select && select.tagName === "SELECT" && sel && sel.engine && sel.version) {
        var v = sel.engine + "::" + sel.version;
        if (select.value !== v) select.value = v;
      }
      var badge = row.querySelector("[data-mv-engine-badge]");
      if (badge && typeof api.formatEngineBadgeForStage === "function") {
        badge.textContent = api.formatEngineBadgeForStage(stageKey) || "";
      }
    });
  }

  // A) explicit broadcast
  document.addEventListener("cssmv:engine-selection-changed", function () {
    try { syncAll(); } catch (_e) {}
  });
  // B) safety net: any engine <select> change → re-sync the rest next tick
  document.addEventListener("change", function (e) {
    var t = e && e.target;
    if (!t || typeof t.closest !== "function") return;
    if (!t.closest("[data-mv-engine-select]") && !(t.matches && t.matches("[data-mv-engine-select]"))) return;
    setTimeout(function () { try { syncAll(); } catch (_e) {} }, 0);
  }, true);
})();
