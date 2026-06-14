/* CSSOS_WAVE_760 20260613 — Jing「每个信息在一个 div 就不会打架; 大家都用绝对定位肯定打架」。
 * 彻底改架构: 不再各自绝对定位 + JS 算 bottom(本质还是绝对, 永远抢位)。改成【唯一一个绝对定位的
 * 流式列容器 #cssos-watch-bottomflow】, 把底部所有信息(价格条 / CTA / 左下控制胶囊 / 多语言行)
 * 收编为它的【子元素】, 清掉它们各自的绝对定位 → 浏览器原生 flex 列排队:
 *   • 每行紧贴上一行(gap 固定);
 *   • 隐藏成员 display:none → 0 高度、不占位、无 gap;
 *   • 整列随 --cssos-dock-clear 一起上移(Dock 显示让位);
 *   • 永不重叠、永不打架。
 * 字幕(#watch-subtitle)居中、独立轨, 不进本列(保持自身居中定位), 仅确保它在列上方。
 *
 * 取代 W561 的绝对坐标计算器 + W744 的 calc(bottom) 栈器(均已弃用)。 */
(function () {
  "use strict";
  if (globalThis.__cssosBottomFlowWired) return;
  globalThis.__cssosBottomFlowWired = true;

  // 从下往上的成员(列容器是 column-reverse → 第一个 DOM 子 = 最底)。
  // CSSOS_WAVE_762 — Jing 拍板从下往上(每个一 div, 隐藏=0 高度):
  //   价格条 → 左下信息包 → 多语言/多声线 → CTA(播放结束前的作品卡片队列) → Want(创作引导卡)。
  // 注: CTA = #cssos-up-next-strip(队列卡片,「Tap to queue…」); Want = #cssos-create-cta(「Want an MV like this」)。
  var ORDER = [
    "#cssos-watch-price-strip",                       // 价格条(最底, 贴 Dock; 最右是 AI 助理)
    "#watch-panel .watch-screen .cssmv-capsule",      // 左下信息包(Loop list…)
    "#cssos-lang-fold",                               // 多语言/多声线
    "#cssos-up-next-strip",                           // CTA — 结束前作品卡片队列(全宽)
    "#cssos-create-cta"                               // Want — 创作引导卡(最上)
  ];
  var FULLWIDTH = { "cssos-up-next-strip": 1 };       // 这些成员铺满容器宽(卡片条)

  function screenEl() { return document.querySelector("#watch-panel .watch-screen"); }

  function ensureFlow() {
    var screen = screenEl();
    if (!screen) return null;
    var f = document.getElementById("cssos-watch-bottomflow");
    if (!f) {
      f = document.createElement("div");
      f.id = "cssos-watch-bottomflow";
      f.dataset.noFrameToggle = "1";
      // 唯一的绝对定位锚点: 贴左下、坐在 Dock 上方(--cssos-dock-clear 让位), 随之上移。
      f.style.cssText = [
        "position:absolute", "left:8px", "right:8px",   // W762 全宽: CTA 卡片条铺开, 窄成员靠左
        // W761 — 容器底边贴 Dock 顶(dock-clear), 不加额外边距 → 价格条↔Dock 距离 0(话筒凸起补足)。
        "bottom:calc(var(--cssos-dock-clear,0px) + env(safe-area-inset-bottom,0px))",
        "display:flex", "flex-direction:column-reverse",
        "align-items:flex-start", "gap:8px",
        "z-index:20",
        "pointer-events:none"   // 容器穿透, 子元素各自 auto
      ].join(";");
      if (getComputedStyle(screen).position === "static") screen.style.position = "relative";
      screen.appendChild(f);
    } else if (f.parentNode !== screen) {
      screen.appendChild(f);
    }
    return f;
  }

  // 清掉成员各自的绝对定位 → 进入静态流。用 important 压过内联/CSS。
  // 幂等守卫: 仅当还没静态化(computed position !== static)才写, 否则 MutationObserver 会
  // 因每帧写 style 而自激成死循环。
  function makeFlowChild(el, force) {
    if (!el) return;
    try { if (!force && getComputedStyle(el).position === "static") return; } catch (_e) {}
    el.style.setProperty("position", "static", "important");
    ["left", "right", "top", "bottom"].forEach(function (p) { el.style.setProperty(p, "auto", "important"); });
    el.style.setProperty("transform", "none", "important");
    el.style.setProperty("margin", "0", "important");
    el.style.setProperty("pointer-events", "auto", "important");
    el.style.setProperty("z-index", "auto", "important");
    // 宽成员(CTA 作品卡片队列)铺满容器宽; 其余保持内容自然宽(靠左)。
    if (el.id && FULLWIDTH[el.id]) {
      el.style.setProperty("align-self", "stretch", "important");
      el.style.setProperty("width", "100%", "important");
      el.style.setProperty("max-width", "100%", "important");
    } else {
      el.style.setProperty("align-self", "flex-start", "important");
    }
  }

  var lastSig = "";
  function adopt() {
    var f = ensureFlow();
    if (!f) return;
    // 收集当前存在的成员(按 ORDER)。
    var els = [];
    for (var i = 0; i < ORDER.length; i++) {
      var el = document.querySelector(ORDER[i]);
      if (el) els.push(el);
    }
    // 仅当【成员集合或顺序变化】时才重排, 避免每帧 appendChild churn。
    var sig = els.map(function (e) { return e.id || e.className; }).join("|");
    var childrenNow = Array.prototype.filter.call(f.children, function (c) { return true; });
    var orderRight = childrenNow.length === els.length &&
      els.every(function (e, idx) { return childrenNow[idx] === e; });
    if (sig !== lastSig || !orderRight) {
      els.forEach(function (e) { f.appendChild(e); makeFlowChild(e, true); });
      lastSig = sig;
    } else {
      // 集合未变: 仅在某成员被别的模块重置回绝对定位时才纠正(幂等守卫内部判断)。
      els.forEach(function (e) { makeFlowChild(e, false); });
    }
    // 字幕保持自身居中定位, 仅确保不被列遮挡: 它自己的 bottom 由情绪字幕引擎管, 这里不动。
  }

  var rafPending = false;
  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; adopt(); });
  }

  function start() {
    setInterval(schedule, 300);
    window.addEventListener("resize", schedule, { passive: true });
    ["cssos:work-changed", "cssos:work-id-changed", "cssos:playlist-advance",
     "cssos:dock-toggle", "cssos:cinema-toggle", "cssos:purchase-complete",
     "cssos:open-watch-for-run", "fullscreenchange"].forEach(function (ev) {
      document.addEventListener(ev, schedule);
      window.addEventListener(ev, schedule);
    });
    var host = document.getElementById("watch-panel") || document.body;
    try {
      new MutationObserver(schedule).observe(host, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ["class", "style", "hidden"]
      });
    } catch (_e) {}
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
  globalThis.cssosRelayoutBottomStack = schedule;   // 兼容旧调用名
})();
