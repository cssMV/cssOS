/* CSSOS_WAVE_561 20260531 — Jing「底部信息互相礼让, 和谐共处」。
 * 病根: 价格条/CTA/左下控制胶囊/多语言行/Dock 各用绝对定位 + 各写死 bottom → 互相遮挡打架。
 * 解法: 一个【底部堆叠协调器】, 按固定优先级从下往上自动堆叠 —— 谁可见谁占一层, 上面的自动上移,
 * 永不重叠。字幕始终在最顶层之上、不被遮。只改各元素的 bottom(inline !important), 不动其它样式。
 *
 * 从下往上优先级(Jing 拍板): Dock(最下, 不移) → 价格条 → CTA → 左下控制胶囊 → 多语言/声线行。
 * 节流: rAF + 250ms 轮询 + resize/事件触发; 只在值变化时写 DOM(避免 churn / 合成层抖动)。 */
(function () {
  "use strict";
  if (globalThis.__cssosBottomStackWired) return;
  globalThis.__cssosBottomStackWired = true;

  var GAP = 14; // 层间间距 px
  // 从下往上的顺序。selector 命中第一个可见元素即占一层。
  var ORDER = [
    { key: "price",   sel: "#cssos-watch-price-strip" },
    { key: "cta",     sel: "#cssos-create-cta" },
    { key: "capsule", sel: "#watch-panel .watch-screen .cssmv-capsule" },
    { key: "lang",    sel: "#cssos-lang-fold" }
  ];

  function visible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (parseFloat(cs.opacity || "1") < 0.02) return false;
    var r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }

  function dockOccupiedPx() {
    // Dock 在视口底部(面板外)。它可见时, 其它信息要从 Dock 顶部往上堆。
    var dock = document.querySelector(".dock");
    if (!dock || !visible(dock)) {
      // 无 Dock: 从安全区 + 一点边距起。
      return 12;
    }
    var r = dock.getBoundingClientRect();
    var fromBottom = window.innerHeight - r.top; // Dock 占据的底部高度
    return Math.max(12, Math.round(fromBottom) + GAP);
  }

  var lastApplied = {};
  function relayout() {
    try {
      var y = dockOccupiedPx(); // 当前堆叠基线(距视口底部 px)
      for (var i = 0; i < ORDER.length; i++) {
        var spec = ORDER[i];
        var el = document.querySelector(spec.sel);
        if (!visible(el)) continue;
        var want = Math.round(y);
        if (lastApplied[spec.key] !== want) {
          el.style.setProperty("bottom", want + "px", "important");
          lastApplied[spec.key] = want;
        }
        var h = Math.round(el.getBoundingClientRect().height);
        y = want + h + GAP; // 下一层从这一层顶部 + 间距继续往上
      }
      // CSSOS_WAVE_562 20260531 — Jing「情绪字幕 = 最高层」: 平台首创情绪字幕(#watch-subtitle)
      // 必须实时显示且【绝不被底部信息遮挡】。它坐在堆叠最顶之上 —— 底部信息长高就把字幕往上顶;
      // 但不低于自然位置(14vh), 信息少时不被拉低。pointer-events 保持 none(不挡媒体点击)。
      var sub = document.getElementById("watch-subtitle");
      if (visible(sub)) {
        var natural = Math.round(window.innerHeight * 0.14); // 自然下限 = 14vh
        var subWant = Math.max(natural, Math.round(y));
        if (lastApplied.subtitle !== subWant) {
          sub.style.setProperty("bottom", subWant + "px", "important");
          lastApplied.subtitle = subWant;
        }
      }
    } catch (_e) {}
  }

  var rafPending = false;
  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; relayout(); });
  }

  function start() {
    // 周期性 + 事件驱动: 覆盖切歌/进影院/Dock 显隐/语言行出现等所有时机。
    setInterval(schedule, 250);
    window.addEventListener("resize", schedule, { passive: true });
    ["cssos:work-changed", "cssos:playlist-advance", "cssos:dock-toggle",
     "cssos:cinema-toggle", "cssos:purchase-complete"].forEach(function (ev) {
      document.addEventListener(ev, schedule);
    });
    // 监听底部容器子树变化(语言行/CTA 动态出现)。
    var host = document.getElementById("watch-panel") || document.body;
    try { new MutationObserver(schedule).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] }); } catch (_e) {}
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
  globalThis.cssosRelayoutBottomStack = schedule;
})();
