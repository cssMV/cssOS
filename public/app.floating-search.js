/* CSSOS_WAVE_294 20260521 — Jing: 可复用"苹果风浮层搜索"行为.
 *
 * 自动接管任意带 [data-search-float="swipe"] 的搜索壳(目前: Works Center 的
 * #works-search-shell; 之后 For You / 其它面板加同一属性即自动生效).
 *
 * 行为(swipe 模式 = iOS 自动隐藏头):
 *   • 默认隐藏(浮在面板顶部之上, 不占布局).
 *   • 在所属面板的滚动容器里【往下滑(内容滚向顶部 / scrollTop 减小)】→ 显示;
 *     【往上滑(scrollTop 增大)】→ 隐藏. 滚到最顶端也保持显示.
 *   • 正在输入 / 聚焦时不自动隐藏.
 * 浮层 absolute 覆在列表顶部, 隐藏时完全移出、列表不被遮挡也不留空位.
 * 纯前端, 零依赖. MV 面板用的是 activity 模式(app.watch-search.js), 不在此列. */
(function () {
  "use strict";
  if (globalThis.__cssosFloatingSearchWired) return;
  globalThis.__cssosFloatingSearchWired = true;

  function findScroll(el) {
    // 最近的可滚动祖先(panel-body 优先).
    var p = el.parentElement;
    while (p && p !== document.body) {
      if (p.classList && /panel-body/.test(p.className)) return p;
      var oy = getComputedStyle(p).overflowY;
      if (oy === "auto" || oy === "scroll") return p;
      p = p.parentElement;
    }
    return el.parentElement || document.body;
  }

  function attach(shell) {
    if (!shell || shell.dataset.cssosFloatWired === "1") return;
    shell.dataset.cssosFloatWired = "1";
    var scroll = findScroll(shell);
    try { if (getComputedStyle(scroll).position === "static") scroll.style.position = "relative"; } catch (_e) {}

    // 浮层化: absolute 覆在顶部, 默认隐藏.
    shell.style.position = "absolute";
    shell.style.top = "0";
    shell.style.left = "0";
    shell.style.right = "0";
    shell.style.zIndex = "20";
    shell.style.transform = "translateY(-140%)";
    shell.style.opacity = "0";
    shell.style.transition = "transform .28s cubic-bezier(.4,0,.2,1), opacity .28s ease";
    shell.style.pointerEvents = "none";

    var shown = false;
    var input = shell.querySelector("input");
    function show() {
      if (shown) return;
      shown = true;
      shell.style.transform = "translateY(0)";
      shell.style.opacity = "1";
      shell.style.pointerEvents = "auto";
    }
    function hide() {
      if (!shown) return;
      // 输入中 / 聚焦 / 有内容时不收起.
      if (input && (document.activeElement === input || String(input.value || "").trim())) return;
      shown = false;
      shell.style.transform = "translateY(-140%)";
      shell.style.opacity = "0";
      shell.style.pointerEvents = "none";
    }

    var lastTop = scroll.scrollTop || 0;
    scroll.addEventListener("scroll", function () {
      var t = scroll.scrollTop;
      if (t <= 2) { show(); }                 // 顶端 → 显示
      else if (t < lastTop - 2) { show(); }   // 往下滑(滚向顶部)→ 显示
      else if (t > lastTop + 2) { hide(); }   // 往上滑 → 隐藏
      lastTop = t;
    }, { passive: true });

    // 触摸: 顶部下拉也唤出(列表已在最顶时 scroll 不触发, 用 touch 兜底).
    var sy = 0;
    scroll.addEventListener("touchstart", function (e) {
      var tt = e.touches && e.touches[0]; sy = tt ? tt.clientY : 0;
    }, { passive: true });
    scroll.addEventListener("touchmove", function (e) {
      var tt = e.touches && e.touches[0]; if (!tt) return;
      var dy = tt.clientY - sy;
      if (dy > 36 && (scroll.scrollTop || 0) <= 4) show(); // 顶端下拉
      else if (dy < -36) hide();
    }, { passive: true });

    // 暴露手动控制(可选).
    shell.__cssosFloatShow = show;
    shell.__cssosFloatHide = hide;
  }

  function scan() {
    document.querySelectorAll('[data-search-float="swipe"]').forEach(attach);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
  // 面板/搜索壳是动态渲染的, 观察 DOM 直到出现.
  try {
    var mo = new MutationObserver(function () { scan(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_e) {}
})();
