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
