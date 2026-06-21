/* CSSOS_WAVE_250 20260520 — Jing: TikTok 式进主界面自动播放 MV.
 *
 * 两件事:
 *  1. cssosAutoOpenWatchFeed() — 进主界面后自动把播放队列切到混合
 *     "for-you" 源 (登录: 自己作品最新→最旧, 播完接平台精选; Guest:
 *     纯精选), 并自动打开 watch/MV 面板播第一首. 播完自动下一首靠
 *     现有 queueStructuredWatchAdvanceModule (ended→advance) 走 active
 *     playlist, 已自动覆盖.
 *  2. 上/下滑手势 → watchQueueAdvanceModule(+1 / -1) 切上一首/下一首.
 *
 * 防护: 有深链接 hash (#person-mv / #dm / #watch / 分享/work 参数) 时
 * 不强开, 交给深链处理; 每次加载只自动开一次; 缺依赖时静默降级.
 * 依赖 (全局, 由 app.watch-ui.js / app.playlists.js 提供):
 *   cssosPlaylists.setActive, openWatchPreviewFlowModule,
 *   watchQueueAdvanceModule. */
(function () {
  "use strict";
  if (globalThis.__cssosAutoplayFeedInstalled) return;
  globalThis.__cssosAutoplayFeedInstalled = true;

  var opened = false;

  // CSSOS_WAVE_485 20260528 — Jing「App 一直闪烁 + 进 MV 提示框不出现」根因:
  // 在 App(Capacitor/WKWebView)里, 启动 1.5s 时直接 openWatchPreviewFlow 自动开 MV 影院 —
  // WKWebView 内存吃紧, 重型 MV 渲染 → OOM → webview 崩溃重载 → 又自动开 MV → 又崩 …
  // 现象 = 主界面↔黑屏每 ~2s 反复横跳("一直闪烁"), 且永远走不到"先弹提示"那步 = 提示框不出现。
  // 修复: App 端启动【绝不】直接开 MV, 一律先弹"欣赏最新 MV?"提示; 只有用户点[欣赏 MV]
  // 才以用户手势打开影院(更稳, 也满足自动播放手势解锁)。桌面 web 保持原行为(always 直接进)。
  function isCssosApp() {
    try {
      if (document.documentElement.classList.contains("cssos-app")) return true;
      if (typeof navigator !== "undefined" && navigator.standalone === true) return true;
      var cap = globalThis.Capacitor;
      if (cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) return true;
    } catch (_e) {}
    return false;
  }

  function hasBlockingDeepLink() {
    // CSSOS_WAVE_467 20260527 — Jing「App 无法进入 MV 面板自动播放」根因之一: 之前【任何
    // 非空 hash 都视为深链】→ 不自动播放。但 App(Capacitor/WKWebView)冷启动常会恢复上次
    // 的 URL 片段(如 #home / #person-mv / 空 #), 于是自动播放【每次都被误判为深链而跳过】。
    // 桌面 web 落在 "/" 无 hash → 正常播放, 完美吻合"网页行, App 不行"。修复: 只有【真正
    // 指向具体内容的深链】才抑制自动播放; #、#home、#main、未知/不完整 hash 一律不算深链。
    // CSSOS_WAVE_731 20260612 — Jing「分享链接被卡住」真凶: app.share-link-router.js
    // 一启动就 stripShareParam() 把 ?cssMV= 从 URL 删掉(防刷新重复触发), 而本提示
    // 延迟 1500ms 才弹 → 那时 location.search 已被清空 → 下面的 URL 守卫判不出深链 →
    // 照弹「欣赏最新 MV?」盖住分享的那首歌 (Jerusalem)。修复: 优先看分享路由设的全局
    // 旗标, strip 多早都拦得住。__cssosShareLinkActive 整个分享会话内为 true,
    // __cssosShareLinkWorkId 是被分享的 work id。
    try {
      if (globalThis.__cssosShareLinkActive === true) return true;
      if (globalThis.__cssosShareLinkWorkId) return true;
    } catch (_e) {}
    try {
      var h = String(location.hash || "").replace(/^#/, "").trim().toLowerCase();
      if (h) {
        if (/^person-mv\/[^/]+\/.+/.test(h)) return true; // person-mv/<civ>/<具体id>
        if (/^(dm|watch|share)(\/|$)/.test(h)) return true;
        if (/^(work|mv)[\/=].+/.test(h)) return true;
        // 其余 (#home / #main / #person-mv / 不完整 / 未知) → 不算阻塞深链。
      }
      var s = String(location.search || "");
      if (/[?&](cssMV|work|work_id|w|share|mv)=/i.test(s)) return true;
    } catch (_e) {}
    return false;
  }

  function watchPanelIsOpen() {
    // CSSOS_WAVE_467 — 此前检查 class "open", 但 watch 面板根本不用这个类(用 panel-front /
    // panel-active / is-cssmv-fullscreen, 关闭时是 .hidden) → 永远返回 false。后果: W466 的
    // "开后校验" 永远判定没开成功 → 反复重开 openWatchPreviewFlowModule, 互相打架。改为按
    // 真实开启状态检测。
    try {
      var p = document.getElementById("watch-panel");
      if (!p || !p.classList) return false;
      if (p.classList.contains("hidden")) return false;
      if (p.classList.contains("panel-front") || p.classList.contains("panel-active")
          || p.classList.contains("is-cssmv-fullscreen") || p.classList.contains("maximized")) return true;
      // 兜底: 实际可见且有高度。
      var r = p.getBoundingClientRect();
      return r.height > 40 && getComputedStyle(p).visibility !== "hidden" && getComputedStyle(p).display !== "none";
    } catch (_e) { return false; }
  }

  // CSSOS_WAVE_268 20260521 — Jing 紧急止血: 暂时禁用"进主界面自动打开 watch".
  // 现象: autoplay 自动开 watch → watch 渲染循环(ResizeObserver/readProgress
  // 每帧)烧死主线程 → 用户一进来就冻、什么都点不了. 先关掉自动打开, 让用户
  // 落在可用的 home(已实测无循环、可点); 手动进 watch 的冻结问题另行修复后
  // 把此 flag 改回 true 即恢复连播.
  // CSSOS_WAVE_269 20260521 — 重新启用: 冻结根因(openWatchPreviewFlow 互相递归)
  // 已由 W269 重入护栏修复, autoplay 自动连播恢复.
  var CSSOS_AUTOPLAY_FEED_ENABLED = true;

  // CSSOS_WAVE_366 20260523 — Jing「退出又自动进入」根治: 用户明确点右上角 ✕ 退出
  // 影院后, 若页面因 OOM/某种原因重载(同一 tab → sessionStorage 仍在), 启动自动打开
  // 会再次把 MV 面板怼到用户脸上 → "退出来了又自动进入". 现在: 监听 cssos:watch-close,
  // 一旦用户手动退出就【本会话内禁止自动打开】(sessionStorage, 跨重载仍生效); 只有
  // 真正冷启动(新会话, sessionStorage 清空)才恢复自动连播. 用户想再看, 点 dock/logo 即可.
  var USER_CLOSED_KEY = "cssos.userClosedWatch";
  function userClosedThisSession() {
    try { return sessionStorage.getItem(USER_CLOSED_KEY) === "1"; } catch (_e) { return false; }
  }
  function markUserClosed() {
    try { sessionStorage.setItem(USER_CLOSED_KEY, "1"); } catch (_e) {}
  }
  try {
    document.addEventListener("cssos:watch-close", markUserClosed);
    window.addEventListener("cssos:watch-close", markUserClosed);
  } catch (_e) {}

  // CSSOS_WAVE_478 20260527 — Jing「进主界面先让用户选: 是否自动进 MV 面板连播最新作品」:
  // 给用户多一个选择 —— 有人想先逛逛平台, 不想被直接拽进影院。偏好 cssos.autoEnterMv:
  //   "ask"(默认, 每次进主界面先弹提示) / "always"(记住=欣赏, 直接进) / "never"(记住=稍后, 不进)。
  // 提示: 「欣赏最新 MV?」+ [欣赏 MV ✨] / [稍后再说] + 复选框「记住, 下次不再问」。
  // MV 面板设置区可重设(globalThis.cssosSetAutoEnterMvPref / cssosReadAutoEnterMvPref)。
  var AUTO_ENTER_KEY = "cssos.autoEnterMv";
  function readAutoEnterPref() {
    try { var v = localStorage.getItem(AUTO_ENTER_KEY); return (v === "always" || v === "never") ? v : "ask"; }
    catch (_e) { return "ask"; }
  }
  function writeAutoEnterPref(v) {
    try { localStorage.setItem(AUTO_ENTER_KEY, String(v || "ask")); } catch (_e) {}
  }
  globalThis.cssosReadAutoEnterMvPref = readAutoEnterPref;
  globalThis.cssosSetAutoEnterMvPref = writeAutoEnterPref;

  var _autoEnterPromptShown = false;
  // CSSOS_WAVE_1018 20260619 — Jing「进平台弹一次, 选了欣赏进去又弹回来=共 2 次」根治:
  //   内存变量 _autoEnterPromptShown 在【页面重载/影院打开瞬间弹回主界面】后清零 → 又弹。
  //   改用 sessionStorage 持久化"本会话已问过", 跨重载/跨弹回都只问一次。新会话(冷启动)才恢复。
  var AUTOENTER_ASKED_KEY = "cssos:autoEnterAsked";
  function autoEnterAlreadyAsked() {
    if (_autoEnterPromptShown) return true;
    try { return sessionStorage.getItem(AUTOENTER_ASKED_KEY) === "1"; } catch (_e) { return false; }
  }
  function markAutoEnterAsked() {
    _autoEnterPromptShown = true;
    try { sessionStorage.setItem(AUTOENTER_ASKED_KEY, "1"); } catch (_e) {}
  }
  function showAutoEnterPromptOnce() {
    if (autoEnterAlreadyAsked()) return;
    if (document.getElementById("cssos-autoenter-prompt")) return;
    markAutoEnterAsked();
    var lc = function (en, zh) { return (typeof globalThis.loginCopy === "function") ? globalThis.loginCopy(en, zh) : en; };
    var ov = document.createElement("div");
    ov.id = "cssos-autoenter-prompt";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    // CSSOS_WAVE_490g 20260529 — Jing「登录后 ~1.5s deterministic 秒崩」根因(诊断推断+铁律):
    // 本提示框在启动后 1500ms 弹出, 遮罩原用【全屏 backdrop-filter: blur(6px)】盖在已渲染的
    // 整个重型主屏(含 3 个 bg-blob 大模糊 + 全部卡片)之上 → WebKit 必须对整页实时模糊 →
    // iPhone XS Max GPU 瞬间触顶 → 正好在 ~1.5s 处崩 → 静默重载 → 又弹 → 又崩(无 beforeunload,
    // 与诊断每轮只发 400/800/1500ms 三帧后即崩完全吻合)。违反 compositor 铁律(绝不在重型/
    // 移动内容上用 backdrop-filter)。修复: 去掉 backdrop-filter, 改用更深的纯色半透明遮罩
    // (合成器只做廉价 alpha 混合, 不重绘整页), 观感几乎一致。
    ov.style.cssText = "position:fixed;inset:0;z-index:10090;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(2,8,6,0.82);padding:24px;";
    ov.innerHTML =
      '<div style="max-width:360px;width:100%;background:rgba(8,16,13,0.96);border:1px solid rgba(0,245,160,0.28);' +
      'border-radius:20px;padding:22px 22px 18px;box-shadow:0 20px 60px rgba(0,0,0,0.5);font:500 14px/1.5 -apple-system,system-ui,sans-serif;color:#eafff6;">' +
      '<div style="font:700 18px/1.3 -apple-system,system-ui,sans-serif;margin-bottom:6px;">' + lc("Watch the latest MV?", "欣赏最新 MV?") + '</div>' +
      '<div style="color:rgba(200,255,232,0.7);font-size:13px;margin-bottom:18px;">' + lc("Auto-play the latest works in the MV cinema, newest first.", "在 MV 影院自动连播最新作品,从新到旧。") + '</div>' +
      // 中间: 两个按钮
      '<div style="display:flex;gap:10px;margin-bottom:16px;">' +
      '<button type="button" id="cssos-autoenter-later" style="flex:1;appearance:none;border:1px solid rgba(255,255,255,0.18);background:transparent;color:#eafff6;border-radius:999px;padding:11px 14px;font:600 14px/1 inherit;cursor:pointer;">' + lc("Maybe later", "稍后再说") + '</button>' +
      '<button type="button" id="cssos-autoenter-watch" style="flex:1.3;appearance:none;border:none;background:linear-gradient(120deg,#00f5a0,#0bf7ff);color:#012;border-radius:999px;padding:11px 14px;font:700 14px/1 inherit;cursor:pointer;">' + lc("Watch MV ✨", "欣赏 MV ✨") + '</button>' +
      '</div>' +
      // 底部: 记住复选框
      '<label style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:12.5px;color:rgba(200,255,232,0.65);cursor:pointer;">' +
      '<input type="checkbox" id="cssos-autoenter-remember" style="width:16px;height:16px;accent-color:#00f5a0;cursor:pointer;" />' +
      lc("Remember — don’t ask again", "记住,下次不再问") + '</label>' +
      '</div>';
    document.body.appendChild(ov);
    function close() { try { ov.remove(); } catch (_e) {} }
    function remembered() { var c = document.getElementById("cssos-autoenter-remember"); return !!(c && c.checked); }
    ov.addEventListener("click", function (e) { if (e.target === ov) { /* backdrop tap = later, no remember */ close(); } });
    var watchBtn = ov.querySelector("#cssos-autoenter-watch");
    var laterBtn = ov.querySelector("#cssos-autoenter-later");
    if (watchBtn) watchBtn.addEventListener("click", function () {
      if (remembered()) writeAutoEnterPref("always");
      close();
      try { globalThis.cssosAutoOpenWatchFeed({ fromPrompt: true, force: true }); } catch (_e) {}
    });
    if (laterBtn) laterBtn.addEventListener("click", function () {
      if (remembered()) writeAutoEnterPref("never");
      close(); // stay on home
    });
  }
  globalThis.cssosShowAutoEnterPrompt = showAutoEnterPromptOnce;

  // 进主界面自动打开 MV 面板并连播 for-you 混合队列.
  // CSSOS_WAVE_466 20260527 — Jing「App 无法进入 MV 面板自动播放」根因(强韧化): 之前在
  // 启动 1.5s 时只尝试【一次】, 且【在尝试前就把 opened=true】。在 App(WKWebView, 加载更慢
  // /更重)里, 那一刻 openWatchPreviewFlowModule 或 for-you 队列常常还没就绪 → 函数静默
  // return, opened 已被钉成 true → 之后永不再试 = App 永远进不去自动播放。修复: (1) 就绪
  // 轮询——模块没准备好就每 400ms 再试, 最多 ~12s; (2) opened 只在【确认面板真的打开】后
  // 才置 true; (3) 开面板后校验, 没开成功就继续重试。保留所有原有守卫(用户已退出/深链/已开)。
  globalThis.cssosAutoOpenWatchFeed = function cssosAutoOpenWatchFeed(opts) {
    opts = opts || {};
    if (!CSSOS_AUTOPLAY_FEED_ENABLED) return; // W268 止血: 不自动开 watch
    if (opened && !opts.force) return;

    // CSSOS_WAVE_478 — 入场前尊重用户偏好(非 force / 非提示回调时):
    //   never → 不进, 留在主界面; ask(默认) → 弹提示让用户选, 不直接进; always → 直接进。
    if (!opts.force && !opts.fromPrompt) {
      // CSSOS_WAVE_485b 20260528 — Jing「提示框从来没显示过」根因: 崩溃循环里 MV 每次关闭
      // 都派发 cssos:watch-close → sessionStorage.userClosedWatch=1 被钉死, App 从后台恢复
      // 时 sessionStorage 不清空 → cssosAutoOpenWatchFeed 在走到"弹提示"前就被 userClosed
      // 这道闸提前 return = 提示框【永远】不出现。修复: App 端的"温和提示"必须在 userClosed
      // 之前判定 —— userClosed 只该抑制【静默自动开 MV】, 不该抑制【问一句要不要看】。
      if (hasBlockingDeepLink()) return;          // 深链优先(打开了具体分享/作品链接)
      // CSSOS_WAVE_485i 20260528 — Jing「手机端提示框仍不弹(桌面弹)」根因: App 路径原本排在
      // watchPanelIsOpen() 之后, 而 App 冷启动时 #watch-panel 常处于"未 hidden 但在主界面后面"
      // 的陈旧状态 → watchPanelIsOpen() 的高度兜底把它误判为"已打开" → 在弹提示前就 return。
      // 桌面无此陈旧 watch 状态故正常弹。修复: App 的弹提示提到 watchPanelIsOpen 之前(深链仍优先),
      // 冷启动一律弹, 不被陈旧 watch 状态误挡。App 端绝不在启动直接开重型 MV(防 WKWebView 闪烁)。
      if (isCssosApp()) { showAutoEnterPromptOnce(); return; }
      if (watchPanelIsOpen()) { opened = true; return; }
      var _pref = readAutoEnterPref();
      // 桌面 web: 尊重 never + 保留"本会话已退出影院就不再自动打扰"语义。
      if (_pref === "never") return;              // 用户明确选择不自动进
      if (userClosedThisSession()) return;
      if (_pref !== "always") { showAutoEnterPromptOnce(); return; } // ask → 先问
      // 桌面 web + always → 继续往下走, 直接进。
    }

    // CSSOS_WAVE_468 20260527 — Jing「App 进入 MV 面板时闪退」根因(强韧化收口): 上一版
    // W466 在开面板后用 watchPanelIsOpen() 校验, 检测不到就【最多重开 30 次】—— 在内存
    // 吃紧的 App WKWebView 里, 反复开 MV 面板 = 渲染循环烧主线程 = 闪退(W268 同类)。
    // 现在: 只对【模块尚未就绪】做等待重试(不调用任何东西); 一旦就绪, setActive + 开面板
    // 【只执行一次】并立即 opened=true 收手, 永不重复开。保留 App 慢加载的就绪等待价值,
    // 去掉危险的重复打开。
    var tries = 0;
    var MAX_TRIES = 30; // 30 × 400ms ≈ 12s 就绪等待窗口
    function attempt() {
      if (opened && !opts.force) return;
      if (userClosedThisSession() && !opts.force) return; // 用户本会话已退出影院
      if (hasBlockingDeepLink()) return;                  // 深链优先
      if (watchPanelIsOpen()) { opened = true; return; }  // 已经开着 → 收手
      // 模块还没就绪 → 仅【等待】重试, 不调用任何打开逻辑。
      if (typeof globalThis.openWatchPreviewFlowModule !== "function"
          || !(globalThis.cssosPlaylists && globalThis.cssosPlaylists.setActive)) {
        tries++;
        if (tries < MAX_TRIES) setTimeout(attempt, 400);
        return;
      }
      // 就绪 → 收手标记先置位(防止任何并发再次进入), 然后只开一次。
      opened = true;
      try { globalThis.cssosPlaylists.setActive("for-you"); } catch (_e) {}
      setTimeout(function () {
        try {
          globalThis.openWatchPreviewFlowModule({
            preferredTab: "mv",
            clearLimit: true,
            preferLatestOwned: true,
          });
        } catch (_e) {}
      }, 120);
    }
    setTimeout(attempt, 120);
  };

  // ─── 上/下滑手势 → 上一首/下一首 ───────────────────────────────
  var SWIPE_MIN_PX = 60;     // 触发阈值
  var VERT_DOMINANCE = 1.4;  // 垂直分量须明显大于水平, 不误吞横滑
  var startX = 0, startY = 0, tracking = false, startedInScreen = false;

  function targetInWatchScreen(t) {
    try {
      if (!(t instanceof Element)) return false;
      var screen = t.closest("#watch-panel .watch-screen");
      if (!screen) return false;
      // 起点落在可滚动子区域 (歌词/评论/脚本) 时不抢, 让其正常滚动.
      if (t.closest(".watch-lyrics, .watch-comments, .watch-script, [data-watch-scroll]")) return false;
      return true;
    } catch (_e) { return false; }
  }

  document.addEventListener("touchstart", function (ev) {
    if (!watchPanelIsOpen()) { tracking = false; return; }
    var t = ev.touches && ev.touches[0];
    if (!t) return;
    startedInScreen = targetInWatchScreen(ev.target);
    startX = t.clientX; startY = t.clientY; tracking = true;
  }, { passive: true });

  document.addEventListener("touchend", function (ev) {
    if (!tracking || !startedInScreen) { tracking = false; return; }
    tracking = false;
    var t = (ev.changedTouches && ev.changedTouches[0]);
    if (!t) return;
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;
    if (Math.abs(dy) < SWIPE_MIN_PX) return;
    if (Math.abs(dy) < Math.abs(dx) * VERT_DOMINANCE) return; // 偏横滑, 放过
    if (typeof globalThis.watchQueueAdvanceModule !== "function") return;
    // 上滑 (dy<0) = 下一首; 下滑 (dy>0) = 上一首. 与 TikTok 一致.
    try { globalThis.watchQueueAdvanceModule(dy < 0 ? +1 : -1); } catch (_e) {}
  }, { passive: true });
})();

/* CSSOS_WAVE_1021 20260619 — Jing「关闭标签页/App, 媒体还在继续播放」根治: 全局监听【页面关闭/
 * 离开/退后台】, 暂停所有 audio/video。pagehide 覆盖标签页关闭 + 跳转(iOS WKWebView 进后台也触发);
 * 原生 App appStateChange(isActive=false)再补一道。仅暂停(不清 src)→ 回前台可手动续播, 契合
 * "干净退出, 不留客"。单一来源, 幂等。 */
(function cssosStopMediaOnClose() {
  if (globalThis.__cssosStopMediaOnCloseWired) return;
  globalThis.__cssosStopMediaOnCloseWired = true;
  function stopAllMedia() {
    try {
      var m = document.querySelectorAll("audio, video");
      for (var i = 0; i < m.length; i++) {
        try { if (!m[i].paused) m[i].pause(); } catch (_e) {}
      }
    } catch (_e) {}
  }
  try { window.addEventListener("pagehide", stopAllMedia); } catch (_e) {}
  try { window.addEventListener("beforeunload", stopAllMedia); } catch (_e) {}
  try {
    var cap = globalThis.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.App && typeof cap.Plugins.App.addListener === "function") {
      cap.Plugins.App.addListener("appStateChange", function (st) {
        if (st && st.isActive === false) stopAllMedia();
      });
    }
  } catch (_e) {}
})();
