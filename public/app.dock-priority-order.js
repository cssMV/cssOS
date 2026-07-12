/* CSSOS_WAVE_108B_DOCK_PRIORITY 20260509 — Jing
 *
 * Pin the two most-used panels to the front of the dock:
 *   position 1: MV Pipeline (data-action="cssmv")
 *   position 2: Person MV   (data-action="person-mv")
 *
 * Why: drag-reorder didn't survive page reloads for dynamically
 * injected items (per Jing), and these two are the primary entry
 * points to creation + curation. Late positions get clipped on
 * narrow viewports, so prominence matters.
 *
 * Implementation: a MutationObserver watches the dock for new
 * children and re-asserts the priority order. Cheap (O(items) on
 * each mutation) and safe — repeated reorders are no-ops once the
 * desired sequence is in place.
 *
 * Loaded after the dock HTML and after app.person-mv-panel.js so
 * both items exist by the time we run.
 */
(function () {
  "use strict";

  // CSSOS_WAVE_1170 — Jing 指令: Dock 默认排序。
  //   话筒 / 为你创作 / 作品中心 / 人物MV / MV管线 / 高级设置 / 登录 / 语言 / 订阅 / MV面板, 其余跟在后面。
  // CSSOS_WAVE_113 — Jing: Actors(数字演员)排在 works 之前 = 第 3 位。
  // W1733 — Jing: 数字演员 → 导演入口 → App 相邻同序(director/appstore 之前不在此表 → 被甩到末尾)。
  var PRIORITY = ["mic", "foryou", "actors", "director", "appstore", "works", "person-mv", "mv-pipeline", "settings", "login", "language", "subscription", "watch"];
  var dock = null;
  var settling = false;

  function ensureOrder() {
    if (settling) return;
    if (!dock) {
      dock = document.querySelector(".dock");
      if (!dock) return;
    }
    var items = Array.prototype.slice.call(dock.querySelectorAll('[data-pill-key]'));
    if (!items.length) return;

    /* Build a quick lookup of action → element. */
    var byAction = {};
    items.forEach(function (el) {
      var act = el.getAttribute("data-action");
      if (act && !byAction[act]) byAction[act] = el;
    });

    // CSSOS_WAVE_1171b — 紧急修复无限循环(主线程卡死、连控制台都打不开)。必须【幂等】:
    //   先算期望队头顺序(存在的优先项); DOM 已就位就【直接返回, 零改动】, 否则每次 insertBefore
    //   都会再触发 MutationObserver → 又调 ensureOrder → DOM 永远抖 → 整页冻死。
    var desired = [];
    for (var p = 0; p < PRIORITY.length; p += 1) {
      var de = byAction[PRIORITY[p]];
      if (de) desired.push(de);
    }
    var alreadyOk = true;
    for (var q = 0; q < desired.length; q += 1) {
      if (dock.children[q] !== desired[q]) { alreadyOk = false; break; }
    }
    if (alreadyOk) return;   // 已就位 → 零 DOM 改动 → 不再触发 observer → 无循环

    settling = true;
    try {
      // 仅在确实乱序时重排: reverse-insert, 处理完队头依次为 desired[0..n], 其余跟在后面。
      for (var i = desired.length - 1; i >= 0; i -= 1) {
        if (dock.firstChild !== desired[i]) dock.insertBefore(desired[i], dock.firstChild);
      }
    } finally {
      settling = false;
    }
  }

  /* W1733 首屏防抖 — 排定后揭示 dock。静态 HTML 上 <footer class="dock" data-presort="1">
   * 由 style.css 先隐藏(opacity:0), 三连(actors/director/App)注入 + 排好后去掉 data-presort → 淡入终态,
   * 用户看不到重排过程。CSS 侧还有 .9s animation 上限兜底: 即使这段 JS 不跑, dock 也会自动显示。 */
  function reveal() {
    if (!dock || !dock.hasAttribute("data-presort")) return;
    if (dock.querySelector('[data-action="actors"]') &&
        dock.querySelector('[data-action="director"]') &&
        dock.querySelector('[data-action="appstore"]')) {
      dock.removeAttribute("data-presort");   // → CSS .14s 淡入
    }
  }

  function start() {
    dock = document.querySelector(".dock");
    if (!dock) return;
    ensureOrder(); reveal();
    /* CSSOS_WAVE_1171c — 紧急: 彻底移除 MutationObserver(它是唯一可能造成"排序↔观察"无限循环、
     * 卡死主线程的东西)。改为【纯定时几次】兜住动态注入(人物MV ~2-5s 后才插入), 排完即停,
     * 绝无循环可能。ensureOrder 本身幂等, 重复调用零副作用。 */
    var settles = [120, 250, 450, 800, 1500, 3000, 5000, 9000];
    settles.forEach(function (ms) { setTimeout(function () { ensureOrder(); reveal(); }, ms); });
    /* W1733 — Jing「代码绿了但实际没生效」根因: app.js 的 restoreDockOrder 由 auth 事件触发,
     * 可能【晚于】上面最后一个定时器(9s), 把 director/appstore 等动态项重新甩到末尾, 之后再无人排。
     * 修复: 挂 childList observer 兜住任意时机的重排。ensureOrder 现在【幂等】(就位即 return, 零 DOM
     * 改动 → 不自触发), 再加 60ms 防抖 + settling 互斥, 排完即静止 —— 无 W1171c 当年的"排序↔观察"死循环。 */
    try {
      if (window.MutationObserver) {
        var _deb = null;
        var mo = new MutationObserver(function () {
          if (settling || _deb) return;
          _deb = setTimeout(function () { _deb = null; ensureOrder(); reveal(); }, 60);
        });
        mo.observe(dock, { childList: true });
      }
    } catch (_e) { /* observer 失败不影响定时器兜底 */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
