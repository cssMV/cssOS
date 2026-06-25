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
    // CSSOS_WAVE_1107 20260622 — Jing/App Store 2.1 拒因: 订阅面板首点懒加载失败导致拒审,
    //   已改回 eager 常驻(prebundle 直接 src)。此处不再登记为懒加载, 避免重复加载/竞态。
    //   (原 W534: "subscription": "app.subscription-panel.js?v=20260531-w537-sublegal")
    // CSSOS_WAVE_535 — credit-panel(8KB)+ workspaces-panel(10KB): user-admin 同款, 静态壳暂留。
    "credit":        "app.credit-panel.js?v=20260526-w462-skeleton-universal",
    "workspaces":    "app.workspaces-panel.js?v=20260526-w462-skeleton-universal",
    // CSSOS_WAVE_661 第一批纯岛迁移(代理审计: 单一全局入口、无渲染期裸调、自建 DOM、零定时器)。
    "templates":          "app.templates-panel.js?v=20260526-w462-skeleton-universal",
    "user-stats":         "app.user-stats-page.js?v=20260508-wave71",
    "creation-timeline":  "app.creation-timeline-panel.js?v=20260526-w462-skeleton-universal",
    "add-language":       "app.add-language-modal.js?v=20260602-w588t-tokens",
    "work-edit":          "app.work-edit-panel.js?v=20260531-w544-work-edit",
    "share-dialog":       "app.share-dialog.js?v=20260506-share-link",
    // CSSOS_WAVE_661 第二小批: voice-clone(定义 cssosOpenVoiceCloneModal+cssosOpenMyVoicesModal)
    //   + add-voice(仅 cssosOpenAddVoiceModal) 两个独立岛, 所有跨文件调用均 typeof 守卫。
    "voice-clone":        "app.voice-clone-modal.js?v=20260602-w588t-tokens",
    "add-voice":          "app.add-voice-modal.js?v=20260602-w588t-tokens",
    // shortcuts: cheatsheet(i18n 后继者)经 eager app.shortcuts-shim.js 的 ? 键触发懒加载;
    //   旧 app.shortcuts-overlay.js 退役(两者都绑 ?, 重复; 不再 eager/不入清单)。
    "shortcuts":          "app.shortcuts-cheatsheet.js?v=20260508-wave65",
    // CSSOS_WAVE_661 第三批: hash 触发型(干净 IIFE)。feed/webhooks 精确匹配(router hashExact),
    //   user-homepage 用 #u/<handle> 前缀。
    "feed":               "app.feed-panel.js?v=20260508-wave26",
    "webhooks":           "app.webhooks-panel.js?v=20260508-wave57",
    "user-homepage":      "app.user-homepage.js?v=20260603-w593-civmeta",
    // CSSOS_WAVE_662 第2阶段·线A: mv-tier-picker(事件触发, router events 能力)。
    "mv-tier-picker":     "app.mv-tier-picker-modal.js?v=20260528-w465-tier-pill",
    // CSSOS_WAVE_662 第2阶段·线A第2步: 自挂载型常驻模块。face-safe 经 events(cssos:work-id-changed)
    //   触发、顶层自启; gift-inbox 经 openPanel 的 profile 分支静默加载、自有 readyState 兜底+observer。
    "face-safe":          "app.face-safe-overlay.js?v=20260524-w355-no-cors-taint",
    "gift-inbox":         "app.gift-inbox-panel.js?v=20260515-wave164-fresh-palette",
    // CSSOS_WAVE_662 线B第1步: mv-language-picker(同步返回 handle 的 mount, 经 eager shim 懒加载)。
    "mv-language-picker": "app.mv-language-picker.js?v=20260531-w587b-cap",
    // CSSOS_WAVE_1225 — cssTV 大屏浏览层。hash #cssTV 触发懒加载, 模块自注入样式 + 自开。
    "csstv":              "app.csstv-panel.js?v=20260624-w1225-csstv",
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
