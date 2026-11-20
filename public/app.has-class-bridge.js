/* CSSOS_WAVE_490k 20260529 — Jing「登录后 2-3s deterministic 内容进程崩溃」根因(诊断推断):
 * style.css 有 60+ 个 :has() 选择器, 其中多条是【文档级】(body:has(.panel.panel-front…)、
 * html:has(#watch-panel…)、body:has(.panel.maximized)), 个别还带 ` *` 后代通配
 * (body:has(...) #logo-panel *)。iOS WebKit 上, 文档级 :has 会在【每一次 DOM 变动】时全文档
 * 重新匹配 —— 主屏加载的 2-3 秒里 for-you feed 在疯狂增删卡片节点, 触发 60+ 个 :has 反复
 * 全文档样式重算风暴 → A12 GPU/渲染进程被拖垮崩溃(低内存却确定性 ~2-3s 崩, 与诊断 t<3.4s
 * 后即崩、无 beforeunload、无 location.reload beacon 完全吻合)。
 *
 * 修复: 把这几条【文档级】:has 条件改由本桥用 class 维护(html/body 上打 class), CSS 改用
 * class 选择器 → 浏览器不再为这些规则做"每次变动全文档重算"。本桥用 rAF 合并的轻量
 * MutationObserver(每帧最多 3 次 querySelector), 远比浏览器原生 :has 全树重算便宜。
 * 局部 :has(~ .active)(在 pill/tab 组内, 作用域小)保留不动。 */
(function () {
  "use strict";
  if (window.__cssosHasBridgeInstalled) return;
  window.__cssosHasBridgeInstalled = true;

  var html = document.documentElement;
  var raf = 0;

  function recompute() {
    raf = 0;
    try {
      var body = document.body;
      if (!body) return;
      // 1) 非 logo 面板处于前置/激活态 → 主屏魔镜变暗
      var nonLogoFront = !!document.querySelector(
        ".panel.panel-front:not(#logo-panel):not(.logo-panel), .panel.panel-active:not(#logo-panel):not(.logo-panel)"
      );
      body.classList.toggle("cssos-nonlogo-front", nonLogoFront);
      // 2) watch 面板可见
      var wp = document.getElementById("watch-panel");
      var watchOpen = !!(wp && !wp.classList.contains("hidden"));
      html.classList.toggle("cssos-watch-open", watchOpen);
      // 3) 有【别的】面板最大化 / cinema 全屏 → 隐藏主界面 chrome(主题按钮/版本切换)。
      // CSSOS_WAVE_1210 — Jing「切主题主题按钮就消失」根因: logo-panel(主界面自己)在 fullscreen 布局下
      //   本身带 .maximized; 切主题 reapply 布局会(重新)给它打 .maximized → 误判"面板最大化" → 主题按钮被
      //   CSS display:none。主界面就是 logo-panel, 它最大化【不该】隐藏主题按钮。排除 logo-panel(及 watch 面板,
      //   watch 由 cssmv-cinema 另行判定), 只有【真·别的面板】最大化才隐藏。
      var panelMax = !!document.querySelector(".panel.maximized:not(#logo-panel):not(.logo-panel):not(#watch-panel)")
        || !!(wp && wp.classList.contains("cssmv-cinema"));
      body.classList.toggle("cssos-panel-max", panelMax);
      /* CSSOS_WAVE_2344 20261120 — Jing「播放中 MV 面板突然退出, 提示内存过载」。
       *
       * 实测(1680×1050 @dpr2, 影院态): 带滤镜的合成面合计 ~321MB, 而其中最大的
       * 三块【根本看不见】—— 三个 .bg-blob(blur 55px, 各 35MB)和 #logo-panel
       * (saturate+blur, 8MB)整个被不透明的黑色 MV 面板盖住。合计 113MB,
       * 还会随屏幕面积等比例涨(Jing 的屏幕比这大, 付得更多)。
       * 浏览器【不会】因为一个层被挡住就跳过合成, 所以这笔钱一直在付。
       *
       * 为什么用【量】而不是【猜状态】: 本来想判 cssos-panel-max / cssmv-cinema,
       * 但实测发现把 .maximized 摘掉之后面板仍然铺满视口(cssmv-cinema 还在)——
       * 状态类和"到底盖没盖住"不是一回事。平台记过的教训正是这一条:
       * 先量出真正生效的东西, 再下结论。所以这里直接量: 有没有一个面板
       * 【不透明 + 恰好盖住整个视口】。resize / 还原 / 退出影院都会自动翻回来。
       *
       * 成本: 只量 .panel, 数量个位数, 而且本桥本来就是 rAF 合并的。 */
      var occluded = false;
      try {
        var vw = window.innerWidth, vh = window.innerHeight;
        var panels = document.querySelectorAll(".panel");
        for (var i = 0; i < panels.length; i++) {
          var el = panels[i];
          if (el.classList.contains("hidden") || el.hasAttribute("hidden")) continue;
          var r = el.getBoundingClientRect();
          if (!(r.left <= 0 && r.top <= 0 && r.right >= vw && r.bottom >= vh)) continue;
          var cs = window.getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none") continue;
          if (Number(cs.opacity) < 1) continue;
          // 背景必须是【完全不透明】的。rgb(...) 没有 alpha = 不透明;
          // rgba(..., a) 只有 a === 1 才算。半透明面板后面是真看得见的, 不能关。
          var bg = String(cs.backgroundColor || "");
          var m = bg.match(/^rgba?\(([^)]+)\)$/);
          if (!m) continue;
          var parts = m[1].split(",");
          if (parts.length > 3 && Number(parts[3]) < 1) continue;
          occluded = true;
          break;
        }
      } catch (_e2) { occluded = false; }   // 量不出来就当【没挡住】, 宁可多付钱也不能让画面少东西
      body.classList.toggle("cssos-bg-occluded", occluded);
    } catch (_e) {}
  }
  function schedule() {
    if (raf) return;
    try { raf = requestAnimationFrame(recompute); }
    catch (_e) { setTimeout(recompute, 16); }
  }

  function start() {
    recompute();
    try {
      var mo = new MutationObserver(schedule);
      mo.observe(document.documentElement, {
        subtree: true, childList: true,
        attributes: true, attributeFilter: ["class", "hidden"],
      });
    } catch (_e) {}
    // 兜底: 偶发节流(可见性/focus 变化时也刷新一次)
    try {
      document.addEventListener("visibilitychange", schedule);
      window.addEventListener("focus", schedule);
    } catch (_e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
  // 早期也立刻算一次(class 尽快就位, 避免首帧闪)
  recompute();
})();
