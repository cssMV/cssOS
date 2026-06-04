/* CSSOS_WAVE_634 / 635 20260604 — 惰性面板内核(轻装上阵 · 内存核心优化).
 *
 * 病根(免疫系统内存监控 + 源码实锤):
 *   ① index.html 静态挂载 23 个 panel, 全从开机常驻 DOM(~2,700 活节点)。
 *   ② `.panel.hidden` = opacity:0 + blur(8px) + pointer-events:none —— 【不是 display:none】!
 *      → 23 个面板哪怕"隐藏"仍被浏览器【全程渲染/合成】(还带 GPU 很贵的 blur)。面板从没真正关过。
 *
 * 内核闭环(Jing 设计: 点开哪个开哪个, 关哪个销毁哪个):
 *   · 开机后(idle/3.5s)把【9 个稀用管理面板】内容序列化成字符串 + 清空容器(节点 GC, 真释放堆)
 *     + 加 .panel-dormant(display:none, 停止合成)。容器 div 保留 → getElementById/dom-globals 不破。
 *   · openPanel(panel) 前: 若该面板是 dormant/stashed → innerHTML 重建 + 去 dormant → 再显示。
 *   · cssos:panelclose 后: 把【已挂载且此刻 .hidden】的管理面板【重新 stash + dormant】= 关闭即销毁。
 *
 * 安全: 只动 9 个稀用管理面板(核心 watch/foryou/cssmv… 不碰, 它们持有播放态/媒体, 销毁重建代价高,
 * 留待内核第 2/3 阶段单独处理); 这些面板内部元素的 JS 引用都在【打开时】(dom-globals 只引容器);
 * 延后 stash 让 load 期 init 跑完; 当前正显示的面板跳过。
 */
(function () {
  "use strict";

  var TARGET_IDS = [
    "user-admin-panel", "seller-panel", "system-mvs-panel",
    "delivery-ops-panel", "delivery-reports-panel", "workspaces-panel",
    "subscription-panel", "credit-panel", "api-panel",
  ];
  var TARGET = Object.create(null);
  TARGET_IDS.forEach(function (id) { TARGET[id] = true; });

  var stash = Object.create(null);    // id -> innerHTML string (dormant, 已释放活节点)
  var mounted = Object.create(null);  // id -> true (内容当前在 DOM 里)

  // 注入 dormant 规则(display:none, 停止合成)。
  try {
    var st = document.createElement("style");
    st.textContent = ".panel.panel-dormant{display:none !important;}";
    (document.head || document.documentElement).appendChild(st);
  } catch (_e) {}

  function isVisibleNow(el) {
    try {
      return !el.classList.contains("hidden") &&
        el.offsetParent !== null &&
        getComputedStyle(el).display !== "none";
    } catch (_e) { return false; }
  }

  function stashOne(el) {
    var id = el.id;
    try {
      var html = el.innerHTML;
      if (html && html.length > 40) {
        stash[id] = html;
        el.innerHTML = "";                 // 释放活节点 → GC
        el.classList.add("panel-dormant"); // display:none → 停止合成
        el.dataset.lazyStashed = "1";
        mounted[id] = false;
        return true;
      }
    } catch (_e) {}
    mounted[id] = true; // 本就空/出错 → 不管理
    return false;
  }

  function inflate(id) {
    if (mounted[id]) return;
    var el = document.getElementById(id);
    if (!el) { mounted[id] = true; return; }
    if (typeof stash[id] === "string") {
      try { el.innerHTML = stash[id]; } catch (_e) {}
      delete stash[id];
    }
    el.classList.remove("panel-dormant"); // 允许显示
    mounted[id] = true;
  }
  function inflateEl(el) {
    try { if (el && el.id && TARGET[el.id] && !mounted[el.id]) inflate(el.id); } catch (_e) {}
  }

  // 关闭即销毁: 把已挂载且此刻隐藏的管理面板重新 stash + dormant。
  function reclaimClosed() {
    TARGET_IDS.forEach(function (id) {
      if (!mounted[id]) return;
      var el = document.getElementById(id);
      if (el && el.classList.contains("hidden")) stashOne(el);
    });
  }

  var stashed = false;
  function stashAll() {
    if (stashed) return; stashed = true;
    var saved = 0;
    TARGET_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.lazyStashed === "1") return;
      if (isVisibleNow(el)) { mounted[id] = true; return; } // 正在看 → 不动
      if (stashOne(el)) saved++;
    });
    try { console.info("[lazy-panels] W635 stashed %d/%d rarely-used panels (freed nodes + stopped compositing)", saved, TARGET_IDS.length); } catch (_e) {}
  }

  function wrapOpenPanel() {
    var orig = globalThis.openPanel;
    if (typeof orig !== "function") return false;
    if (orig.__lazyWrapped) return true;
    var wrapped = function (panel) {
      try { inflateEl(panel); } catch (_e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__lazyWrapped = true;
    globalThis.openPanel = wrapped;
    return true;
  }

  globalThis.cssosInflateLazyPanel = function (idOrEl) {
    if (typeof idOrEl === "string") { if (TARGET[idOrEl]) inflate(idOrEl); }
    else inflateEl(idOrEl);
  };

  function start() {
    if (!wrapOpenPanel()) {
      var tries = 0;
      var iv = setInterval(function () { if (wrapOpenPanel() || ++tries > 50) clearInterval(iv); }, 100);
    }
    // 关闭即销毁: 任意面板关闭后, 回收已打开过的管理面板。
    try {
      document.addEventListener("cssos:panelclose", function () { setTimeout(reclaimClosed, 350); });
    } catch (_e) {}
    var run = function () { try { stashAll(); } catch (_e) {} };
    if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 3500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
