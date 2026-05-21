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

  function hasBlockingDeepLink() {
    try {
      var h = String(location.hash || "").replace(/^#/, "").trim();
      if (h) return true; // 任何 hash 路由都视为深链, 不抢
      var s = String(location.search || "");
      // 分享/直达单作品的参数 → 让它自己开
      if (/[?&](cssMV|work|work_id|w|share|mv)=/i.test(s)) return true;
    } catch (_e) {}
    return false;
  }

  function watchPanelIsOpen() {
    try {
      var p = document.getElementById("watch-panel");
      return !!(p && p.classList && p.classList.contains("open"));
    } catch (_e) { return false; }
  }

  // 进主界面自动打开 MV 面板并连播 for-you 混合队列.
  globalThis.cssosAutoOpenWatchFeed = function cssosAutoOpenWatchFeed(opts) {
    opts = opts || {};
    if (opened && !opts.force) return;
    if (hasBlockingDeepLink()) return;       // 深链优先
    if (watchPanelIsOpen()) { opened = true; return; }
    if (typeof globalThis.openWatchPreviewFlowModule !== "function") return;
    opened = true;
    try {
      // 切到混合 for-you 队列 (setActive 内部 ensureLoaded 异步拉取).
      globalThis.cssosPlaylists && globalThis.cssosPlaylists.setActive
        && globalThis.cssosPlaylists.setActive("for-you");
    } catch (_e) {}
    // 让 setActive 的异步拉取先起步, 再开面板 (preferLatestOwned: 登录
    // 用户先播自己最新一首; 之后 ended→advance 沿 for-you 队列连播).
    setTimeout(function () {
      try {
        globalThis.openWatchPreviewFlowModule({
          preferredTab: "mv",
          clearLimit: true,
          preferLatestOwned: true,
        });
      } catch (_e) {}
    }, 120);
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
