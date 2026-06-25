/* CSSOS_WAVE_499 20260529 — Jing「内核 + 纯枝叶面板, 用谁加载谁」通用面板路由.
 *
 * 设计初衷(Jing): cssOS 是内核, 面板是纯 HTML 枝叶, 功能由内核按需注入 —— 点谁才加载谁、
 * 启动谁, 关谁清理谁。现状却是 217 个模块全 eager 加载, 6MB JS 一次性塞进 WKWebView,
 * 老设备(iPhone XS Max)启动 ~10s 内存撑爆崩溃。本路由把已验证的 mv-pipeline-shim 模式
 * 通用化: 给"懒加载面板"声明它对外的全局入口函数, 路由自动装"桩"——
 *   调用桩 → cssosLoadPanel(name) 加载重模块 → 重模块 IIFE 覆盖回真函数 → 用原参数调真函数。
 * 现有所有 openXxx() 调用点(40+ 处)无需改动, 自动走按需加载。Dock 静态按钮点击经
 * handleGlobalAction → dockActionMap[action] → 这里注册的桩 → 加载+打开。
 *
 * 迁移一个面板只需两步(零侵入):
 *   1. 在下面 REGISTRY 加一行: name → { fns:[全局入口函数名…], action?:dock动作 }
 *   2. index.html 把该模块 <script src> 改成 <script type="cssos-lazy" data-panel="name" src=…>
 * 完成后该模块从首屏移除, 点击对应入口/按钮时才加载。关闭即卸载由各面板自身 lifecycle 负责。 */
(function () {
  "use strict";
  if (globalThis.__cssosPanelRouterInstalled) return;
  globalThis.__cssosPanelRouterInstalled = true;

  // 懒加载面板注册表。每项: name(= cssos-lazy data-panel) → { fns, action }
  // fns: 该模块对外暴露、会被外部调用的全局入口函数(装桩对象)。
  // action: 可选, 对应 index.html 静态 dock 按钮的 data-action(让 dock 点击触发加载)。
  var REGISTRY = {
    // 已有专用 shim 的(mv-pipeline / person-mv 用各自 open-shim, 这里不重复接管)。
    // 通用 router 接管的懒加载面板写在这里:
    // CSSOS_WAVE_522 20260530 — Jing「用谁加载谁」: user-admin-panel (49KB) 改通用 router 懒加载.
    //   孤岛性已实测: 入口 openUserAdminPanelModule/renderUserAdminPanelModule 全部经 ?.()/字符串映射
    //   调用, 无渲染期裸调、无返回值依赖; 内部 setInterval 在 render 函数内, 懒加载后仅打开时启动;
    //   管理员专属, 绝不在用户/审核启动路径上 → 最安全的迁移目标。首屏移除 49KB。
    "user-admin": { fns: ["openUserAdminPanelModule", "renderUserAdminPanelModule"], action: "user-admin" },
    // CSSOS_WAVE_523 20260530 — Jing: system-mvs-panel (15KB) 通用 router 懒加载. 孤岛已实测:
    //   render 入口全经 ?.() 调用无裸调; 有静态 dock 按钮 data-action="system-mvs" 可路由; 无返回值依赖。
    "system-mvs": { fns: ["openSystemMvsPanelModule", "renderSystemMvsPanelModule"], action: "system-mvs" },
    // CSSOS_WAVE_528 — credits-topup-modal: 纯程序化入口(无 dock 动作), agent-chat 积分耗尽时调用。
    //   完整三件套自包含模块(自建 HTML + 自注入 CSS)。桩 cssosOpenCreditsTopup → 首次调用即按需加载。
    "credits-topup": { fns: ["cssosOpenCreditsTopup"] },
    // CSSOS_WAVE_529 — premium-modal: 完整三件套自包含模块(自建HTML+自注入CSS)。唯一触发 = #premium
    //   hash(无任何外部调用/链接/渲染期耦合)。router 的 hash 能力: 命中该 hash 即按需加载, 模块自开。
    "premium": { fns: ["cssosOpenPremium", "cssosRenderAffiliate"], hash: "#premium" },
    // CSSOS_WAVE_530 — dm-panel: #dm hash 触发 + cssosOpenDmWith 入口桩(watch-ui "私信创作者"调用)。
    //   💌 顶栏 stub 按钮由 app.dm-open-shim.js(eager)提供。注意: hash 用 startsWith 匹配 #dm/#dm/<tid>。
    "dm": { fns: ["cssosOpenDmWith"], hash: "#dm" },
    // CSSOS_WAVE_531 — engine-accounts: 桩 renderEngineAccountsCard(market 渲染计费面板时调→按需加载渲染卡片)
    //   + openEngineAccountsModal(卡内"管理"按钮)。无 dock/hash, 纯由 render 调用触发加载。
    "engine-accounts": { fns: ["renderEngineAccountsCard", "openEngineAccountsModal"] },
    // CSSOS_WAVE_1107 20260622 — subscription-panel 改回 eager 常驻(App Store 2.1 拒因: 付费墙懒加载
    //   首点失败被拒)。不再桩 open/render 入口 —— 真实函数已 eager 就位, 直接删除条目最干净杜绝竞态。
    //   (原 W534: "subscription": { fns:["openSubscriptionPanelModule","renderSubscriptionPanelModule"], action:"subscription" })
    // CSSOS_WAVE_535 — credit + workspaces: user-admin 同款(handleGlobalAction 已有对应 case)。
    "credit": { fns: ["openCreditPanelModule", "renderCreditPanelModule"], action: "credit" },
    "workspaces": { fns: ["openWorkspacesPanelModule", "renderWorkspacesPanelModule"], action: "workspaces" },
    // CSSOS_WAVE_661 第一批纯岛(单一全局入口, 无渲染期裸调, 自建 DOM, 桩按需加载)。
    "templates": { fns: ["cssosOpenSaveTemplateDialog"] },
    "user-stats": { fns: ["openUserStatsPage"] },
    "creation-timeline": { fns: ["cssosOpenCreationTimeline"] },
    "add-language": { fns: ["cssosOpenAddLanguageModal"] },
    "work-edit": { fns: ["openWorkEditPanel"] },
    "share-dialog": { fns: ["openCssosShareDialog"] },
    // CSSOS_WAVE_661 第二小批: voice 簇(两独立岛)+ shortcuts(cheatsheet, 经 ? shim 触发, 也注册桩)。
    "voice-clone": { fns: ["cssosOpenVoiceCloneModal", "cssosOpenMyVoicesModal"] },
    "add-voice": { fns: ["cssosOpenAddVoiceModal"] },
    "shortcuts": { fns: ["cssosOpenShortcutsCheatsheet"] },
    // CSSOS_WAVE_661 第三批: hash 触发型(干净 IIFE, 无同步返回值依赖, 调用方均守卫)。
    "feed": { fns: ["cssosOpenFeed", "cssosCloseFeed", "cssosToggleSubscribe"], hash: "#feed", hashExact: true },
    "webhooks": { fns: ["openCssosWebhooksPanel"], hash: "#settings/webhooks", hashExact: true },
    "user-homepage": { fns: ["openUserHomepage"], hash: "#u/" },
    // CSSOS_WAVE_662 第2阶段·线A: mv-tier-picker 纯事件驱动(无外部调用/无返回值依赖, 干净孤岛)。
    //   两个 open-event 监听在 globalThis; 目前无派发方=零回归(懒加载预埋, 接上派发方即生效)。
    "mv-tier-picker": { fns: [], events: ["cssmv:request-tier-picker", "cssmv:request-low-balance-prompt"] },
    // CSSOS_WAVE_662 第2步: face-safe 人脸避让分析器(顶层自启, 唯一消费者 watch-media-overlays 已守卫,
    //   缺失期 round-robin 优雅降级)。挂 cssos:work-id-changed(进 watch 放歌即触发, router 补发带原 detail)。
    "face-safe": { fns: [], events: ["cssos:work-id-changed"] },
    // CSSOS_WAVE_1225 — cssTV 大屏浏览层: #cssTV 精确 hash 触发懒加载, 模块自开 + 暴露 cssosOpenCssTV 桩。
    "csstv": { fns: ["cssosOpenCssTV", "cssosCloseCssTV"], hash: "#cssTV", hashExact: true },
  };

  function loadPanel(name, silent) {
    if (typeof globalThis.cssosLoadPanel === "function") return globalThis.cssosLoadPanel(name, silent ? { silent: true } : undefined);
    // 兜底: 直接注入对应 cssos-lazy 标签的 src。
    return new Promise(function (res, rej) {
      var tag = document.querySelector('script[type="cssos-lazy"][data-panel="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]');
      if (!tag) return rej(new Error("no lazy tag for " + name));
      var s = document.createElement("script");
      s.src = tag.getAttribute("src"); s.async = false;
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error("load fail " + name)); };
      document.head.appendChild(s);
    });
  }

  function makeStub(name, fnName) {
    var inflight = null;
    // CSSOS_WAVE_1107 — App Store 2.1 拒因(懒面板首点"Panel failed to load"=死胡同)。失败不再直接报错:
    //   先自动重试一次(网络抖动/SW 缓存窜版常见), 重试仍败才提示, 且【清空 inflight】让用户再点真能重试。
    function attempt(retriesLeft) {
      return loadPanel(name).catch(function (err) {
        if (retriesLeft > 0) {
          console.warn("[panel-router] lazy load " + name + " failed, retrying…", err);
          return new Promise(function (r) { setTimeout(r, 350); }).then(function () { return attempt(retriesLeft - 1); });
        }
        throw err;
      });
    }
    function stub() {
      var args = arguments, self = this;
      try { if (typeof globalThis.showToast === "function") {/* 可选 loading 提示由 cssosLoadPanel 内部处理 */} } catch (_e) {}
      if (!inflight) inflight = attempt(1);   // 首次 + 1 次自动重试
      return inflight.then(function () {
        var real = globalThis[fnName];
        if (typeof real === "function" && real.__cssosStub !== true) {
          try { return real.apply(self, args); }
          catch (e) { console.warn("[panel-router] " + fnName + " threw:", e); }
        } else {
          console.warn("[panel-router] " + name + " loaded but " + fnName + " not exposed");
        }
      }, function (err) {
        console.warn("[panel-router] lazy load " + name + " failed (after retry):", err);
        inflight = null;   // 清空 → 用户再点可真重试(不再卡在已 reject 的 promise)
        try {
          if (typeof globalThis.showToast === "function") {
            globalThis.showToast(typeof globalThis.loginCopy === "function"
              ? globalThis.loginCopy("Panel failed to load. Please retry.", "面板加载失败，请重试。")
              : "Panel failed to load.");
          }
        } catch (_e) {}
      });
    }
    stub.__cssosStub = true;
    return stub;
  }

  // 安装所有注册面板的入口桩 + dock 动作。仅当真实函数还不存在时才装桩(向后兼容: 若该模块
  // 仍是 eager 加载, 真函数已在, 不覆盖)。
  function install() {
    Object.keys(REGISTRY).forEach(function (name) {
      var entry = REGISTRY[name] || {};
      (entry.fns || []).forEach(function (fnName) {
        var cur = globalThis[fnName];
        if (typeof cur === "function" && cur.__cssosStub !== true) return; // 真函数已在(eager)
        globalThis[fnName] = makeStub(name, fnName);
      });
      // CSSOS_WAVE_529 — hash 触发: 命中 location.hash 即按需加载该面板(模块自身的 hash 处理会自开)。
      if (entry.hash && !entry.__hashWired) {
        entry.__hashWired = true;
        var checkHash = (function (h, nm, ex) {
          // CSSOS_WAVE_661/批3 — hashExact: 精确匹配 #h 或其 #h/<子路径>(不再前缀误伤,
          //   如 #feed 不会命中 #feedback)。默认(无 hashExact)仍前缀匹配(供 #u/<handle> 这类)。
          return function () {
            try {
              var cur = location.hash || "";
              var hit = ex ? (cur === h || cur.indexOf(h + "/") === 0) : (cur === h || cur.indexOf(h) === 0);
              if (!hit) return;
              var p = loadPanel(nm);
              // 懒加载模块的 hash 监听器是 load 后才绑定的, 当前 hash 事件已过 → 补发一次 hashchange,
              // 让模块对【当前】location.hash 自开(各模块 open 多为幂等, 不会重复弹)。
              if (p && typeof p.then === "function") {
                p.then(function () {
                  try { window.dispatchEvent(new HashChangeEvent("hashchange", { newURL: location.href, oldURL: location.href })); }
                  catch (_e1) { try { window.dispatchEvent(new Event("hashchange")); } catch (_e2) {} }
                });
              }
            } catch (_e) {}
          };
        })(entry.hash, name, !!entry.hashExact);
        try {
          window.addEventListener("hashchange", checkHash);
          if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", checkHash);
          else checkHash();
        } catch (_e) {}
      }
      // CSSOS_WAVE_662 — 事件触发: REGISTRY {events:["名"…]} → 监听 CustomEvent, 首次触发即按需加载,
      //   然后【向 window 补发带原 detail 的同名 CustomEvent】, 让模块(load 后才绑定的)监听器自处理
      //   那个被错过的首次触发; 补发前先摘掉本 router 临时监听(防二次补发), 之后归模块自己监听。
      //   注意: 监听/补发都在 window(≡globalThis), 因目标模块监听在 globalThis。
      if (entry.events && !entry.__eventsWired) {
        entry.__eventsWired = true;
        (Array.isArray(entry.events) ? entry.events : [entry.events]).forEach(function (evName) {
          var handler = (function (en, nm) {
            return function (e) {
              var detail = e && e.detail;
              try { window.removeEventListener(en, handler); } catch (_e0) {}
              var p = loadPanel(nm, true); // 后台事件触发, 静默加载(不弹 Loading toast)
              if (p && typeof p.then === "function") {
                p.then(function () {
                  try { window.dispatchEvent(new CustomEvent(en, { detail: detail })); } catch (_e1) {}
                });
              }
            };
          })(evName, name);
          try { window.addEventListener(evName, handler); } catch (_e) {}
        });
      }
      // dock 动作: 注册到 __cssosDockActionMap, 让 handleGlobalAction 能路由到桩。
      if (entry.action) {
        try {
          var map = globalThis.__cssosDockActionMap || {};
          if (typeof map[entry.action] !== "function") {
            map[entry.action] = function () {
              var openFn = (entry.fns || [])[0];
              if (openFn && typeof globalThis[openFn] === "function") return globalThis[openFn]();
              return loadPanel(name);
            };
          }
          globalThis.__cssosDockActionMap = map;
        } catch (_e) {}
      }
    });
  }

  // 公开: 让任意代码主动按需打开一个面板。
  globalThis.cssosOpenPanel = function (name, opts) {
    var entry = REGISTRY[name];
    var openFn = entry && (entry.fns || [])[0];
    if (openFn && typeof globalThis[openFn] === "function") return globalThis[openFn](opts);
    return loadPanel(name);
  };
  globalThis.cssosRegisterLazyPanel = function (name, entry) { REGISTRY[name] = entry; install(); };

  install();
  // dock 按钮可能在稍后才注入 — DOMContentLoaded 再装一次, 保证 action map 就位。
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
})();
