/* CSSOS_WAVE_524 20260530 — Jing「内核动态注入的唯一真相源」面板源清单(name → src).
 *
 * 设计初衷(Jing): index.html 不该残留任何面板脚本痕迹 —— 连惰性 <script type="cssos-lazy"> 标签也要
 * 删掉。内核靠这份清单【按名字动态注入】面板的 JS(将来还有 CSS)。前端请求哪个面板, cssosLoadPanel
 * 就从这里查到 src, 注入 <script>, 加载完执行。关闭/淘汰时由 panel-reclaim 回收。
 *
 * 迁移一个面板 = 两步(再无第三处):
 *   1. 这里加一行:  "panel-name": "app.xxx.js?v=...",
 *   2. index.html 里把它那行 <script src="app.xxx.js…"> 整行删除。
 * 入口装桩/ dock 动作由 app.panel-router.js 的 REGISTRY(或专用 open-shim)负责。
 *
 * 这是 200+ 面板逐个搬离 index.html 的落脚点 —— 每搬一个就在这里登记一行。 */
(function () {
  "use strict";
  globalThis.CSSOS_PANEL_SRC = Object.assign(globalThis.CSSOS_PANEL_SRC || {}, {
    // ——— 已从 index.html 移除、改由内核动态注入的面板 JS ———
    "system-mvs":    "app.system-mvs-panel.js?v=20260513-wave125",
    "notifications": "app.notifications-panel.js?v=20260429-no-runall-184",
    "user-admin":    "app.user-admin-panel.js?v=20260526-w463-skeleton-admin",
    "mv-pipeline":   "app.mv-pipeline-panel.js?v=20260527-w461-pipeline-6chips",
    // CSSOS_WAVE_533 — person-mv 已还原为 eager(见 index.html), 从懒加载清单移除。
    // CSSOS_WAVE_527 — mv-import (21KB): mv-pipeline 面板的"导入"子功能。它把触发按钮注入
    //   #mv-pipeline-panel 头部, 故随 mv-pipeline 一同按需加载(见下方 CSSOS_PANEL_DEPS)。
    "mv-import":     "app.mv-import.js?v=20260530-w527-lazy",
    // CSSOS_WAVE_528 — credits-topup-modal (12KB): 完整三件套自包含模块(自建HTML+自注入CSS)。
    //   主触发 = agent-chat 在积分耗尽时 cssosOpenCreditsTopup(), 经通用 router 桩按需加载。
    "credits-topup": "app.credits-topup-modal.js?v=20260530-w528-lazy",
    // CSSOS_WAVE_529 — premium-modal (16KB): 完整三件套自包含模块, 仅 #premium hash 触发(router hash 能力)。
    "premium":       "app.premium-modal.js?v=20260530-w529-lazy",
    // CSSOS_WAVE_530 — dm-panel (31KB): 完整三件套自包含模块, #dm hash 触发 + cssosOpenDmWith 入口。
    //   eager 仅留 app.dm-open-shim.js 的 💌 stub 按钮。
    "dm":            "app.dm-panel.js?v=20260530-w530-lazy",
    // CSSOS_WAVE_531 — engine-accounts (27KB): 自建HTML, CSS在共享表。market 渲染计费面板时调
    //   renderEngineAccountsCard(桩)→ 按需加载并渲染 BYOK 卡片; 卡内"管理"按钮再开 openEngineAccountsModal。
    "engine-accounts": "app.engine-accounts.js?v=20260530-w531-lazy",
    // CSSOS_WAVE_534 — subscription-panel (46KB): user-admin 同款。handleGlobalAction 有 subscription case,
    //   静态 HTML 壳暂留(dom-globals 抓 subscriptionPanel)。桩 open/render 入口按需加载。
    "subscription":  "app.subscription-panel.js?v=20260531-w537-sublegal",
    // CSSOS_WAVE_535 — credit-panel(8KB)+ workspaces-panel(10KB): user-admin 同款, 静态壳暂留。
    "credit":        "app.credit-panel.js?v=20260526-w462-skeleton-universal",
    "workspaces":    "app.workspaces-panel.js?v=20260526-w462-skeleton-universal",
  });

  // CSSOS_WAVE_527 — 面板依赖: 加载某面板后, 内核自动按需加载其卫星模块(也从首屏移除)。
  // mv-import 的触发器注入在 mv-pipeline 面板内, 所以 mv-pipeline 一加载就连带加载 mv-import。
  globalThis.CSSOS_PANEL_DEPS = Object.assign(globalThis.CSSOS_PANEL_DEPS || {}, {
    "mv-pipeline": ["mv-import"],
  });

  // CSSOS_WAVE_525 — 面板专用样式表(name → href)。cssosLoadPanel 注入面板 JS 前先注入其 CSS,
  // 这样 index.html 不再 eager 引入面板样式表 —— 真正"请求谁、谁的 CSS 才加载"。只登记
  // 【面板作用域、移走不影响常驻元素】的样式表。
  globalThis.CSSOS_PANEL_CSS = Object.assign(globalThis.CSSOS_PANEL_CSS || {}, {
    "mv-pipeline":   "style.mv-pipeline.css?v=20260528-w465-tier-pill",
  });
})();
