/* CSSOS_WAVE_286 20260521 — Jing(Part B ②): App 端 watch 顶部纯搜索框.
 *
 * 仅在 html.cssos-app(App / standalone)下注入 —— 桌面端保留原标题栏, 不注入.
 * 标题栏被 W284 在 App 端隐藏, 这里在其原位放一个搜索框:
 *   • 输入防抖 300ms → GET /api/works/market?q=&limit=10&offset=0
 *   • 结果列表上滑到底 → offset+=10 再拉 10 (无限滚动)
 *   • 点击结果 → 走 openMarketWorkPreview 进播放(与切歌同一渲染路径)
 *   • 清空 → 收起结果, 回到默认 for-you 连播
 * 纯前端, 零依赖. 配合 W285 后端 q/offset. */
(function () {
  "use strict";
  if (globalThis.__cssosWatchSearchWired) return;
  globalThis.__cssosWatchSearchWired = true;

  var PAGE = 10;
  var box = null, input = null, results = null, debTimer = null;
  var state = { q: "", offset: 0, loading: false, exhausted: false };

  function isApp() {
    try { return document.documentElement.classList.contains("cssos-app"); } catch (_e) { return false; }
  }
  function tr(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    return en;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }
  // 与 normaliseItem 一致: 没有任何媒体的草稿不可播, 过滤掉.
  function isPlayable(w) {
    return !!(w && String(w.final_mv_url || w.preview_video_url || w.audio_track_1_url || w.audio_track_2_url || w.preview_audio_url || "").trim());
  }
  // CSSOS_WAVE_1084 — Jing「唐伯虎能播却搜不到」: 结构作品(三部曲/歌剧/剧集)的 root
  //   自身无媒体, 可播媒体在 children/parts 上。搜索此前只用 isPlayable(root) 判定 →
  //   root 全被滤掉 → "No matching MVs."。改为"root 或任一后代可播即算可搜到", 点击时
  //   下钻到首个可播 part 播放(与主网格点 root 进去播子作品一致)。
  function firstPlayable(w) {
    if (!w) return null;
    if (isPlayable(w) && Number(w.take_index || 0) !== 2) return w;
    var kids = Array.isArray(w.children) ? w.children : (Array.isArray(w.parts) ? w.parts : []);
    for (var i = 0; i < kids.length; i++) {
      var hit = firstPlayable(kids[i]);
      if (hit) return hit;
    }
    return null;
  }

  function ensureUI() {
    if (box) return box;
    var panel = document.getElementById("watch-panel");
    if (!panel) return null;
    box = document.createElement("div");
    box.id = "watch-search-box";
    // CSSOS_WAVE_287 — 浮动搜索框(桌面+App): 默认隐藏在顶部之上, 下滑/滚轮向下
    // 显示、上滑/向上隐藏(Apple 风). transform 动画.
    box.style.cssText = [
      // CSSOS_WAVE_304 — Jing: 让位刘海(max(safe-area,50px)保底). 权威定位在
      // style.css(html.cssos-app), 这里写同值兜底.
      "position:absolute", "top:calc(env(safe-area-inset-top,0px) + 4px)",
      "left:10px", "right:10px", "z-index:60", "display:flex",
      "flex-direction:column", "gap:8px", "pointer-events:none",
      "transform:translateY(-140%)", "opacity:0",
      "transition:transform .28s cubic-bezier(.4,0,.2,1), opacity .28s ease",
    ].join(";");

    // CSSOS_WAVE_326 — 搜索框结构: 外层 inputWrap(相对定位, 内嵌 🔍 图标 + input).
    // App 全屏: 头像/✕ 在屏幕两角夹着 → inputWrap 两侧让位 52px(内联默认).
    // 桌面: 头像/✕ 已移进媒体框, 搜索框无需让位 → CSS 收窄居中(见 style.css).
    var inputWrap = document.createElement("div");
    inputWrap.id = "watch-search-inputwrap";
    inputWrap.style.cssText = [
      "position:relative", "pointer-events:auto", "box-sizing:border-box",
      "align-self:stretch", "margin:0 52px",
    ].join(";");

    var searchIcon = document.createElement("span");
    searchIcon.textContent = "🔍";
    searchIcon.setAttribute("aria-hidden", "true");
    searchIcon.style.cssText = [
      "position:absolute", "left:16px", "top:50%", "transform:translateY(-50%)",
      "font-size:14px", "line-height:1", "opacity:0.85", "pointer-events:none",
      "z-index:2",  /* W335 — sit above <input> stacking context */
    ].join(";");

    input = document.createElement("input");
    input.id = "watch-search-input";
    input.type = "search";
    input.autocomplete = "off";
    input.placeholder = tr("Search MVs, creators, styles, ID…", "搜索 MV / 作者 / 风格 / ID…");
    input.setAttribute("aria-label", tr("Search MVs", "搜索 MV"));
    input.style.cssText = [
      "pointer-events:auto", "width:100%", "box-sizing:border-box", "margin:0",
      "background:rgba(0,0,0,0.55)", "backdrop-filter:blur(12px)",
      "-webkit-backdrop-filter:blur(12px)", "border:1px solid rgba(0,245,160,0.45)",
      "border-radius:999px", "color:#fff", "font:500 15px/1.2 -apple-system,system-ui,sans-serif",
      // 左侧 42px 留给内嵌 🔍 图标.
      "padding:11px 18px 11px 42px", "outline:none",
      "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
    ].join(";");

    results = document.createElement("div");
    results.id = "watch-search-results";
    results.style.cssText = [
      "pointer-events:auto", "display:none", "flex-direction:column", "gap:6px",
      "max-height:62vh", "overflow-y:auto", "-webkit-overflow-scrolling:touch",
      "background:rgba(6,12,10,0.93)", "backdrop-filter:blur(18px)",
      "-webkit-backdrop-filter:blur(18px)", "border:1px solid rgba(0,245,160,0.2)",
      "border-radius:14px", "padding:8px", "box-shadow:0 16px 40px rgba(0,0,0,0.55)",
    ].join(";");

    inputWrap.appendChild(searchIcon);
    inputWrap.appendChild(input);
    box.appendChild(inputWrap);
    box.appendChild(results);
    panel.appendChild(box);

    // CSSOS_WAVE_326 — 退出 ✕(右上角, 与左上角头像对称). 桌面端也创建(W326 取消了桌面
    // 标题栏, 需要这个 ✕ 当关闭键; 显隐: App 影院由 idle 系统, 桌面由 CSS 常显).
    if (!document.getElementById("watch-exit-cinema")) {
      var exitBtn = document.createElement("button");
      exitBtn.id = "watch-exit-cinema";
      exitBtn.type = "button";
      exitBtn.setAttribute("aria-label", tr("Exit cinema", "退出影院"));
      exitBtn.title = tr("Exit cinema", "退出影院");
      exitBtn.textContent = "✕";
      exitBtn.style.cssText = [
        // CSSOS_WAVE_326 — ✕ 放进媒体框右上角, 与左上角头像(left:12 top:12)对称.
        // (改为 append 到 .watch-screen; App 全屏帧=满屏, 由 style.css 让位刘海.)
        "position:absolute", "top:12px", "right:12px",
        "z-index:61", "width:40px", "height:40px", "border-radius:50%",
        "border:1px solid rgba(255,255,255,0.55)", "background:rgba(0,0,0,0.55)",
        "backdrop-filter:blur(8px)", "-webkit-backdrop-filter:blur(8px)",
        "color:#fff", "font:600 18px/1 -apple-system,system-ui,sans-serif",
        // CSSOS_WAVE_307 — display 交给 CSS 控制(默认 none, 仅影院显示, idle 系统
        // 用 inline display:none 隐藏). 这里不写 display, 只留 flex 居中所需的对齐.
        "cursor:pointer", "align-items:center", "justify-content:center",
        "box-shadow:0 4px 14px rgba(0,0,0,0.4)",
      ].join(";");
      exitBtn.addEventListener("click", function (ev) {
        try { ev.preventDefault(); ev.stopPropagation(); } catch (_e) {}
        // CSSOS_WAVE_316 20260521 — Jing: 退出影院键必须【真的退出】. W314 取消网页
        // 原生全屏后, 仅靠 exitFullscreen + 去 class 已无法关闭面板(App 端 MV 面板是
        // CSS 全屏, 不吃那几个 class). 现在走全平台统一的关闭路径: 停播 → 去全屏
        // class → minimizeToDockBridge(把面板收回 dock / 回到首页) —— 与其它面板的
        // 关闭按钮、右键菜单"最小化"完全一致.
        var pnl = document.getElementById("watch-panel");
        try { document.dispatchEvent(new CustomEvent("cssos:watch-close")); } catch (_e) {}
        try { window.dispatchEvent(new CustomEvent("cssos:watch-close")); } catch (_e) {}
        // CSSOS_WAVE_445b 20260527 — Skip webkitExitFullscreen on iOS entirely.
        // On iOS (Capacitor + Safari), calling webkitExitFullscreen can trigger
        // a page reload (WebKit bug). The Watch panel uses CSS fullscreen on iOS
        // (position:fixed; 100dvh) — class removal below handles the visual exit.
        // Only call exitFullscreen on non-iOS desktop browsers.
        try {
          var _isIos = /iphone|ipod|ipad/i.test(navigator.userAgent) ||
            (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
          if (!_isIos) {
            if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
          }
        } catch (_e) {}
        try { if (pnl) pnl.classList.remove("is-cssmv-fullscreen", "cssmv-cinema"); } catch (_e) {}
        try { document.body.classList.remove("cssos-cinema-mode", "cssos-watch-theater", "cssos-watch-idle"); } catch (_e) {}
        try { globalThis.stopWatchPanelPlaybackModule && globalThis.stopWatchPanelPlaybackModule(); } catch (_e) {}
        // 真正关闭面板(回到首页/feed): 优先用全站统一的 minimizeToDockBridge.
        try {
          if (pnl && typeof globalThis.minimizeToDockBridge === "function") globalThis.minimizeToDockBridge(pnl);
          else if (pnl && typeof globalThis.minimizeToDock === "function") globalThis.minimizeToDock(pnl);
          else if (pnl) pnl.classList.add("hidden");
        } catch (_e) { try { if (pnl) pnl.classList.add("hidden"); } catch (_e2) {} }
      });
      (panel.querySelector(".watch-screen") || panel).appendChild(exitBtn);
      // CSSOS_WAVE_311 20260521 — Jing: "步调一致" — ✕ 必须和头像/搜索框/Dock 完全
      // 同显同隐. 因此【不】给它独立控制器(W309 那样会一个显一个不显, 不协调), 而是
      // 放回 index.html 的统一 idle 系统(CHROME_SELECTORS 已含 #watch-exit-cinema),
      // 显隐由 CSS(影院 → display:flex) + idle 系统(空闲 → inline display:none, wake
      // 撤掉)统一驱动. 这里不写任何 display JS.
    }

    // CSSOS_WAVE_300c 20260521 — Jing: "删掉左上边的关闭按钮" — 它一直没被清掉,
    // 因为那个 × 很可能是 SVG 图标(不是文字字符), 之前按字形匹配漏了; 而且它独立
    // 于 idle 系统(头像/Dock 都隐了它还在). 改为【不靠字形】: 影院全屏时, 左上角
    // 区域(left<260 且 top<360)的小型可点击元素, 只要不是作者头像、不是搜索框、
    // 不是退出影院 ✕, 就一律隐藏. 唯一合法的左上元素是头像(保留). 仅 App 端.
    function inCinemaNow() {
      try {
        var pnl = document.getElementById("watch-panel");
        return document.body.classList.contains("cssos-cinema-mode") ||
          (pnl && pnl.classList.contains("is-cssmv-fullscreen")) ||
          !!document.fullscreenElement || !!document.webkitFullscreenElement;
      } catch (_e) { return false; }
    }
    if (isApp()) {
      // 安全白名单: 这些(及其子孙)绝不隐藏.
      var isProtected = function (el) {
        if (!el || !el.closest) return false;
        return el.id === "watch-author-avatar" || el.id === "watch-search-box" ||
          el.id === "watch-exit-cinema" ||
          !!el.closest("#watch-author-avatar") || !!el.closest("#watch-search-box") ||
          !!el.closest("#watch-exit-cinema") || !!el.closest("#dock");
      };
      var hideEl = function (el) { try { el.style.setProperty("display", "none", "important"); } catch (_e) {} };
      // CSSOS_WAVE_312 20260521 — Jing: "头像偷偷溜走了, 步调一致". 之前(W308)几何探测
      // 把【盖在头像上的任何小元素】都隐藏, 太狠 → 误伤了头像/其图层, 害头像消失.
      // 现在收紧: 只隐藏【真正长得像关闭键】的东西(× 字形 / 关闭语义的 svg / close
      // aria), 头像(首字母或图片, 无 × 无 close 语义)永远不会被命中.
      var looksLikeClose = function (el) {
        try {
          var t = String(el.textContent || "").trim();
          if (t === "×" || t === "✕" || t === "✖" || t === "⨉") return true;
          var lbl = String((el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title"))) || "");
          if (/close|hide|exit|dismiss|关闭|退出|隐藏/i.test(lbl)) return true;
        } catch (_e) {}
        return false;
      };
      // 媒体/容器层: 绝不隐藏(否则黑屏).
      var isStructural = function (el) {
        if (!el || el === document.body || el === document.documentElement) return true;
        if (el.id === "watch-panel") return true;
        if (el.classList && (el.classList.contains("watch-screen") || el.classList.contains("watch-frame") ||
          el.classList.contains("watch-video") || el.classList.contains("watch-svg") ||
          el.classList.contains("panel-body") || el.classList.contains("watch-body") ||
          el.classList.contains("watch-pane"))) return true;
        if (el.tagName === "VIDEO" || el.tagName === "IMG" || el.tagName === "CANVAS" || el.tagName === "svg") {
          // 媒体本体不动, 但小尺寸的图标 svg 可以删 —— 交给下方尺寸判断.
        }
        return false;
      };
      // CSSOS_WAVE_313 20260521 — Jing: 第5次了, 必须删掉左上角那个 ×. 之前按"像关闭键"
      // 收得太窄(它可能是无字形无 aria 的 svg/div, 漏网). 现在【按位置兜底】: 影院里
      // 左上角小元素, 只要不是白名单(头像/搜索框/✕/Dock)也不是媒体容器, 一律隐藏 ——
      // 与标签/字形无关. 同时把命中的元素身份写进一个底部小横幅(诊断), 这样万一误伤
      // 或漏网, 你截一张图我就能看到它到底是谁、精准处理. 头像 id 在白名单里, 不会被删.
      var dbg = null;
      var ensureDbg = function () {
        if (dbg && document.body.contains(dbg)) return dbg;
        dbg = document.createElement("div");
        dbg.id = "cssos-killclose-dbg";
        dbg.style.cssText = "position:fixed;left:6px;bottom:6px;z-index:2147483647;max-width:92vw;padding:4px 8px;background:rgba(255,40,40,0.92);color:#fff;font:600 10px/1.3 ui-monospace,monospace;border-radius:8px;pointer-events:none;white-space:pre-wrap;word-break:break-all;";
        document.body.appendChild(dbg);
        return dbg;
      };
      var idOf = function (el) {
        var c = (el.className && el.className.toString && el.className.toString()) || "";
        return el.tagName + (el.id ? "#" + el.id : "") + (c ? "." + c.trim().split(/\s+/).slice(0, 3).join(".") : "") +
          " " + Math.round(el.getBoundingClientRect().width) + "x" + Math.round(el.getBoundingClientRect().height);
      };
      // CSSOS_WAVE_314 20260521 — Jing: 真相 — 左上角那个 × 是【iOS WebKit 原生
      // 全屏退出键】(Fullscreen API 自带, 还配 "swipe down to exit" 提示), 根本不在
      // 我们 DOM 里, JS/CSS 删不掉. 之前 W308–W313 各种探测/隐藏全是徒劳, 甚至误伤
      // 头像. 真正的修复在别处: App 端不再调原生 Fullscreen API(改用 CSS 全屏, 见
      // app-fullscreen-immersive / market-commerce / watch-media-layout 的 W314 闸门),
      // 那个原生 × 就不会出现. 这里的探测/诊断逻辑因此全部废弃(no-op), 避免误伤.
      void isProtected; void hideEl; void looksLikeClose; void isStructural; void ensureDbg; void idOf;
    }

    // CSSOS_WAVE_317 20260521 — Jing: 搜索框【只在点击时聚焦】(不在显示时自动聚焦,
    // 否则每次活动显示都弹键盘). 点击整条搜索 pill 任意处都聚焦输入框; 同时阻止冒泡
    // 到媒体层(以免误触发暂停). 不做任何 autofocus.
    var focusInput = function (e) {
      try { if (e) e.stopPropagation(); } catch (_e) {}
      try { input.focus(); } catch (_e) {}
    };
    input.addEventListener("click", focusInput);
    input.addEventListener("pointerup", focusInput);
    input.addEventListener("input", function () {
      clearTimeout(debTimer);
      var v = String(input.value || "").trim();
      // CSSOS_WAVE_423 20260525 — Jing「每输入一个字母就异步显示, 永不等整词」:
      // 150ms 防抖(够快又不抖); 空 = 浏览最新.
      debTimer = setTimeout(function () { runSearch(v); }, 150);
    });
    // CSSOS_WAVE_423 — 激活(聚焦)即零输入 → 立刻展示 10 条最新作品(从新到旧),
    // 上滑无限加载. 不必等用户输入.
    input.addEventListener("focus", function () {
      if (!String(input.value || "").trim()) runSearch("");
    });
    // Esc / 清空 → 收起
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { input.value = ""; runSearch(""); input.blur(); }
    });
    // CSSOS_WAVE_701 — Jing「搜索结果失焦应隐藏」: 之前结果一旦展开就赖着不走, 碍手碍脚。
    // 失焦(点别处/Tab 走)→ 收起结果。延迟 180ms: 让"点结果卡"的 click 先生效再隐藏
    // (blur 先于 click 触发, 直接收会吃掉点击)。点回输入框 → focus 处理器自会重显。
    input.addEventListener("blur", function () {
      setTimeout(function () {
        try {
          // 焦点若回到结果区内(滚动条/卡片)则不收。
          if (document.activeElement === input) return;
          if (results.contains(document.activeElement)) return;
          results.style.display = "none";
        } catch (_e) { try { results.style.display = "none"; } catch (_e2) {} }
      }, 180);
    });
    results.addEventListener("scroll", function () {
      if (results.scrollTop + results.clientHeight >= results.scrollHeight - 90) loadMore();
    });

    // ── CSSOS_WAVE_296 20260521 — Jing: "顶部头像/搜索框/退出键 和底部 Dock,
    // 显示同时显示, 隐藏同时隐藏, 不要一前一后". 影院模式下统一交给 index.html
    // 的 CHROME hide 系统(10s 空闲、display 同步切换 #watch-search-box +
    // #watch-exit-cinema + #dock + 头像), 这里不再各自计时, 避免错位.
    // 非影院(桌面)才用本地 activity 兜底(同样 10s). ──
    function inCinema() {
      try { return document.body.classList.contains("cssos-cinema-mode"); } catch (_e) { return false; }
    }
    var IDLE_HIDE_MS = 10000;
    var hideTimer = null;
    function showBar() {
      box.style.transform = "translateY(0)";
      box.style.opacity = "1";
      // 影院模式: 显隐由统一系统(display:none)接管, 这里不自行计时淡隐.
      if (!inCinema()) armIdleHide();
    }
    function hideBar() {
      if (inCinema()) return; // 影院由统一系统隐藏
      if (document.activeElement === input || String(input.value || "").trim()) return; // 输入/看结果时不隐
      box.style.transform = "translateY(-140%)";
      box.style.opacity = "0";
    }
    function armIdleHide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideBar, IDLE_HIDE_MS);
    }
    globalThis.cssosWatchSearchShow = showBar;
    var panel = document.getElementById("watch-panel");
    if (panel) {
      ["pointerdown", "pointermove", "touchstart", "touchmove", "wheel", "keydown"].forEach(function (ev) {
        panel.addEventListener(ev, function () { showBar(); }, { passive: true });
      });
      showBar();
    }
    // CSSOS_WAVE_303 — 头像的对齐改由 style.css(html.cssos-app #watch-author-avatar)
    // 权威定位, 不再用 JS 轮询覆写 top(JS 内联 !important 会盖过样式表, 且头像被
    // 重建后丢失). CSS 规则对重建天然免疫.
    return box;
  }

  function runSearch(q) {
    state.q = q; state.offset = 0; state.exhausted = false;
    if (!results) return;
    results.innerHTML = "";
    // CSSOS_WAVE_423 20260525 — Jing: 空查询不再收起, 而是【浏览最新 10 条】(从新到旧),
    // 上滑续拉. q="" 时后端按 created_at desc 返回最新作品(默认 feed 顺序).
    results.style.display = "flex";
    var loadingCopy = q ? tr("Searching…", "搜索中…") : tr("Latest works…", "最新作品…");
    results.innerHTML = (globalThis.cssosSkeletonListMarkup
      ? globalThis.cssosSkeletonListMarkup(5, loadingCopy, "card")
      : '<div style="padding:18px;text-align:center;color:rgba(218,255,238,0.6);font:500 13px ui-monospace,monospace;">' + esc(loadingCopy) + "</div>");
    fetchPage(true);
  }
  function loadMore() {
    // W423 — infinite scroll works for BOTH browse(empty) and search(non-empty).
    if (state.loading || state.exhausted) return;
    fetchPage(false);
  }

  function fetchPage(first) {
    if (state.loading) return;
    state.loading = true;
    var url = "/api/works/market?q=" + encodeURIComponent(state.q) + "&limit=" + PAGE + "&offset=" + state.offset;
    fetch(url, { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var works = (j && ((j.data && j.data.works) || j.works)) || [];
        if (works.length < PAGE) state.exhausted = true;
        state.offset += works.length;
        renderResults(works, first);
      })
      .catch(function () { if (first && results) results.innerHTML = '<div style="padding:18px;text-align:center;color:#ff8c8c;font:500 13px ui-monospace,monospace;">' + esc(tr("Search failed.", "搜索失败。")) + "</div>"; })
      .then(function () { state.loading = false; });
  }

  var seen = {};
  function renderResults(works, first) {
    if (!results) return;
    if (first) { results.innerHTML = ""; seen = {}; }
    var playable = works.filter(function (w) { return !!firstPlayable(w); });   // W1084 — root 或后代可播即收录
    if (first && !playable.length) {
      results.innerHTML = '<div style="padding:18px;text-align:center;color:rgba(218,255,238,0.6);font:500 13px ui-monospace,monospace;">' + esc(tr("No matching MVs.", "没有匹配的 MV。")) + "</div>";
      return;
    }
    // CSSOS_WAVE_1086 — Jing「搜索结果也显示树, 对多部作品最友好」: 多部作品(三部曲/
    //   歌剧/剧集/电影)渲染为 root 头卡 + 缩进 part 子卡; 单曲照旧一张卡。点 root 播首部,
    //   点子卡播该 part。
    function appendCard(w, depth, playNode) {
      var id = String(w.id || w.work_id || "").trim();
      if (!id || seen[id]) return;
      seen[id] = 1;
      // CSSOS_WAVE_288 — Jing: 封面【随机优先】. 有多张 cover_slides 就随机取一张
      // (每次搜索/启动都不同, 像幻灯); 没有池才退回主封面 cover_image. 池里的
      // 临时图(replicate/fal)若过期 404, onerror 再回退到稳定 cover_image 保底.
      var stable = String(w.cover_image || w.cover_url || w.preview_image_url || "").trim();
      var rawPool = (Array.isArray(w.cover_slides) ? w.cover_slides : [])
        .map(function (u) { return String(u || "").trim(); })
        .filter(Boolean);
      // W354 — only persisted (cssstudio.app) frames to avoid 404 flashes
      var persistedPool = rawPool.filter(function(u) {
        return /(^|\/\/|\.)cssstudio\.app\//.test(u) || u.startsWith("data:");
      });
      var pool = persistedPool.length ? persistedPool : [];
      var startIdx = pool.length ? Math.floor(Math.random() * pool.length) : 0;
      var primary = pool.length ? pool[startIdx] : stable;
      // CSSOS_WAVE_320 — 56px 缩略图: 走缩放代理(w=160, 含视网膜), 别再下 1.3MB 全图.
      var thumb = (typeof globalThis.cssosThumb === "function") ? globalThis.cssosThumb : function (u) { return u; };
      var cover = esc(thumb(primary || stable, 160));
      var fallback = esc(thumb(stable, 160));
      // W354 — embed data-slides so the shared slideshow ticker advances the frame
      var slidesAttr = pool.length >= 2
        ? ' data-slides="' + esc(JSON.stringify(pool)) + '" data-slide-idx="' + startIdx + '"'
        : "";
      var title = esc(w.title || tr("Untitled", "未命名"));
      var owner = esc(w.owner_name || "");
      // CSSOS_WAVE_359 20260522 — Jing: 凡有作品卡片处都显示时长. 搜索列表此前缺.
      var _pw = firstPlayable(w) || w;   // W1084 — 结构 root 自身时长为 0, 借首个可播 part 的时长
      var _ds = Number(w.duration_secs || w.audio_duration_secs || w.final_duration_secs || w.duration
        || _pw.duration_secs || _pw.audio_duration_secs || _pw.final_duration_secs || 0) || 0;
      var durTxt = _ds > 0 ? (Math.floor(_ds / 60) + ":" + String(Math.floor(_ds % 60)).padStart(2, "0")) : "";
      // CSSOS_WAVE_769 — Jing「请显示完整 ID」: meta 行显示完整 work id(可按完整或前 8 位等任意前缀搜索)。
      var idFull = esc(id);
      var card = document.createElement("button");
      card.type = "button";
      card.title = "ID " + id;   // W764 — Jing: 不用 🆔 emoji, 纯文本
      card.style.cssText = "display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:transparent;border:none;border-radius:10px;padding:8px;cursor:pointer;color:#fff;font:inherit;";
      // W1086 — 树形缩进: 子作品(part)左移 + 细青竖线, 一眼看出从属于上面的 root。
      if (depth > 0) {
        card.style.marginLeft = "18px";
        card.style.borderLeft = "2px solid rgba(0,245,160,0.28)";
        card.style.borderRadius = "0 10px 10px 0";
      }
      card.addEventListener("mouseenter", function () { card.style.background = "rgba(0,245,160,0.1)"; });
      card.addEventListener("mouseleave", function () { card.style.background = "transparent"; });
      // W1086 — root 头卡标注部数(N 部), 让多部作品一目了然。
      var _kids = Array.isArray(w.children) ? w.children : (Array.isArray(w.parts) ? w.parts : []);
      var _playKids = _kids.filter(function (k) { return !!firstPlayable(k); });
      var metaBits = [];
      if (depth === 0 && _playKids.length > 1) metaBits.push("🎬 " + _playKids.length + tr(" parts", " 部"));
      if (owner) metaBits.push(owner);
      if (durTxt) metaBits.push("♪ " + durTxt);
      metaBits.push('<span style="font-family:ui-monospace,monospace;opacity:.55;font-size:0.78em;word-break:break-all;">ID ' + idFull + "</span>");
      card.innerHTML =
        '<div style="position:relative;width:56px;height:56px;flex:0 0 auto;border-radius:8px;overflow:hidden;background:rgba(255,255,255,0.08);">' +
        (cover ? '<img src="' + cover + '" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;"' +
          slidesAttr +
          (fallback ? ' data-stable="' + fallback + '" onerror="if(this.dataset.stable&&this.src!==this.dataset.stable){this.src=this.dataset.stable;}"' : "") + ">" : "") +
        (durTxt ? '<span style="position:absolute;right:2px;bottom:2px;background:rgba(0,0,0,0.66);color:#fff;font:600 9px/1 ui-monospace,monospace;padding:2px 4px;border-radius:4px;">' + durTxt + "</span>" : "") +
        "</div>" +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font:600 14px/1.3 -apple-system,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + title + "</div>" +
        '<div style="font:500 11px/1.3 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,0.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + metaBits.join(" · ") + "</div>" +
        "</div>";
      card.addEventListener("click", function () { playWork(playNode || firstPlayable(w) || w); });   // W1084/W1086 — 下钻到可播 part
      results.appendChild(card);
    }

    playable.forEach(function (root) {
      var kids = Array.isArray(root.children) ? root.children : (Array.isArray(root.parts) ? root.parts : []);
      var playableKids = kids.filter(function (k) { return !!firstPlayable(k); });
      // W1086 — 多部作品: root 头卡(播首部)+ 各 part 缩进子卡; 单部/单曲只渲一张卡。
      appendCard(root, 0, firstPlayable(root) || root);
      if (playableKids.length > 1) {
        playableKids.forEach(function (kid) { appendCard(kid, 1, firstPlayable(kid) || kid); });
      }
    });
  }

  function playWork(w) {
    try {
      if (input) input.value = "";
      if (results) { results.style.display = "none"; results.innerHTML = ""; }
      state.q = "";
      var payload = Object.assign({}, w, {
        id: w.id || w.work_id,
        work_id: w.id || w.work_id,
        cover_image: w.cover_image || w.cover_url,
        owner_user_id: w.owner_user_id || w.owner_id,
      });
      /* W340 20260522 — Jing: 两个必须解决的问题：自动播放 + 满屏.
       *
       * 满屏: openMarketWorkPreview 只渲染内容，不保证 is-cssmv-fullscreen /
       * cssos-cinema-mode 类已存在. search 路径是在已开面板内切歌, 面板开启
       * 时的 MutationObserver(hidden→visible)不再触发. 必须在这里显式调用
       * cssosEnterCinemaLayout().
       *
       * 自动播放: iOS Safari 要求 play() 在用户手势调用栈内同步调用. 之前只
       * 靠 forceUnmuteAndPlay 的 loadedmetadata 监听器, 但那里有一个
       * `if (!cssos-cinema-mode) return` 守卫; 如果影院类还没加上, 就永远不
       * 重试. 修复: 在本次点击的调用栈里(用户手势上下文)立即 unmute+play,
       * 并为新媒体绑定一次性 canplay/loadedmetadata 重试, 不依赖 cinema 守卫.
       */
      // 1. 确保影院/全屏 class 在位.
      try {
        if (typeof globalThis.cssosEnterCinemaLayout === "function") {
          globalThis.cssosEnterCinemaLayout();
        }
      } catch (_e) {}
      // 2. 渲染新内容(异步, 但 click 手势上下文仍在).
      if (typeof globalThis.openMarketWorkPreview === "function") {
        globalThis.openMarketWorkPreview(payload);
      }
      // 3. 在同一用户手势调用栈内立即 unmute + play (iOS Safari 手势窗口).
      //    同时为新 src 绑定一次性 canplay 重试, 以防媒体还没 load 完.
      try {
        var videoEl = document.getElementById("watch-video");
        var audioEl = document.getElementById("watch-audio-preview");
        [videoEl, audioEl].forEach(function (el) {
          if (!el) return;
          el.muted = false;
          el.removeAttribute("muted");
          try { el.volume = 1; } catch (_ve) {}
          if (el.play) el.play().catch(function () {});
          // One-shot retry when new media is loadable.
          ["canplay", "loadedmetadata", "loadeddata"].forEach(function (ev) {
            el.addEventListener(ev, function onReady() {
              el.removeEventListener(ev, onReady);
              el.muted = false;
              el.removeAttribute("muted");
              try { el.volume = 1; } catch (_ve) {}
              if (el.play) el.play().catch(function () {});
            }, { once: true, passive: true });
          });
        });
      } catch (_pe) {}
    } catch (_e) {}
  }

  // CSSOS_WAVE_287 — 桌面 + App 双端都挂载(浮动, 默认隐藏, 下滑显示).
  function tryMount() { ensureUI(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryMount);
  } else {
    tryMount();
  }
  // 面板可能晚于此脚本出现; 观察 body 直到 watch-panel 就位.
  try {
    if (!document.getElementById("watch-search-box")) {
      var mo = new MutationObserver(function () {
        if (document.getElementById("watch-panel") && !document.getElementById("watch-search-box")) {
          ensureUI();
          if (document.getElementById("watch-search-box")) { mo.disconnect(); }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
  } catch (_e) {}
})();
