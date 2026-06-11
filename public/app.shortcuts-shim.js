/* CSSOS_WAVE_661 20260606 — Jing「内核瘦身」: 快捷键速查表 ? 键 eager 触发桩(极小常驻).
 *
 * 背景: app.shortcuts-cheatsheet.js(后继者, i18n)+ app.shortcuts-overlay.js(旧版)都靠 load 时
 * 绑定的 `?` keydown 触发——而触发器=监听器本身, 无法用 panel-router 的"全局函数桩"惰性化(惰性后
 * 监听器没绑, ? 失效)。本 shim 极小、常驻(进 bundle), 只绑一个 `?` keydown: 首次按下 → 动态加载
 * "shortcuts"(=cheatsheet)→ 调 cssosOpenShortcutsCheatsheet 打开, 然后摘掉自己(后续 ? 由 cheatsheet
 * 自己的监听器接管)。旧 overlay 退役(不再 eager/不入清单), 顺带消除"按 ? 弹两个浮层"的重复。 */
(function () {
  "use strict";
  if (globalThis.__cssosShortcutsShim) return;
  globalThis.__cssosShortcutsShim = true;
  function onKey(e) {
    if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    var tag = (t && t.tagName ? String(t.tagName) : "").toLowerCase();
    if (tag === "input" || tag === "textarea" || (t && t.isContentEditable)) return;
    window.removeEventListener("keydown", onKey, true); // 一次性: 加载后由 cheatsheet 自己的监听器接管
    e.preventDefault();
    var load = (typeof globalThis.cssosLoadPanel === "function")
      ? globalThis.cssosLoadPanel("shortcuts")
      : Promise.resolve();
    load.then(function () {
      if (typeof globalThis.cssosOpenShortcutsCheatsheet === "function") {
        try { globalThis.cssosOpenShortcutsCheatsheet(); } catch (_e) {}
      }
    }).catch(function () {});
  }
  window.addEventListener("keydown", onKey, true);
})();
