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
    return !!(String(w.final_mv_url || w.preview_video_url || w.audio_track_1_url || w.audio_track_2_url || "").trim());
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
      "position:absolute", "top:calc(max(env(safe-area-inset-top,0px),50px) + 4px)",
      "left:10px", "right:10px", "z-index:60", "display:flex",
      "flex-direction:column", "gap:8px", "pointer-events:none",
      "transform:translateY(-140%)", "opacity:0",
      "transition:transform .28s cubic-bezier(.4,0,.2,1), opacity .28s ease",
    ].join(";");

    input = document.createElement("input");
    input.id = "watch-search-input";
    input.type = "search";
    input.autocomplete = "off";
    input.placeholder = tr("Search MVs, creators, styles…", "搜索 MV / 作者 / 风格…");
    input.setAttribute("aria-label", tr("Search MVs", "搜索 MV"));
    input.style.cssText = [
      // CSSOS_WAVE_293 — 输入框两侧各留 ~52px: 左给作者头像、右给退出影院按钮,
      // 两边对称, 头像不再被搜索框盖住.
      "pointer-events:auto", "width:auto", "box-sizing:border-box", "margin:0 52px",
      "background:rgba(0,0,0,0.55)", "backdrop-filter:blur(12px)",
      "-webkit-backdrop-filter:blur(12px)", "border:1px solid rgba(0,245,160,0.45)",
      "border-radius:999px", "color:#fff", "font:500 15px/1.2 -apple-system,system-ui,sans-serif",
      "padding:11px 18px", "outline:none",
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

    box.appendChild(input);
    box.appendChild(results);
    panel.appendChild(box);

    // CSSOS_WAVE_293 — 退出影院按钮(右上角, 与左上角作者头像对称). 仅 App 全屏
    // 显示(桌面有标题栏的 × 关闭). 点击: 派发 cssos:watch-close + 退出全屏 +
    // 去 cinema class → 回到主界面/feed.
    if (isApp() && !document.getElementById("watch-exit-cinema")) {
      var exitBtn = document.createElement("button");
      exitBtn.id = "watch-exit-cinema";
      exitBtn.type = "button";
      exitBtn.setAttribute("aria-label", tr("Exit cinema", "退出影院"));
      exitBtn.title = tr("Exit cinema", "退出影院");
      exitBtn.textContent = "✕";
      exitBtn.style.cssText = [
        // CSSOS_WAVE_304 — 让位刘海(max(safe-area,50px)保底), 与头像/搜索框一行.
        "position:absolute", "top:calc(max(env(safe-area-inset-top,0px),50px) + 5px)", "right:10px",
        "z-index:61", "width:40px", "height:40px", "border-radius:50%",
        "border:1px solid rgba(255,255,255,0.55)", "background:rgba(0,0,0,0.55)",
        "backdrop-filter:blur(8px)", "-webkit-backdrop-filter:blur(8px)",
        "color:#fff", "font:600 18px/1 -apple-system,system-ui,sans-serif",
        "cursor:pointer", "display:flex", "align-items:center", "justify-content:center",
        "box-shadow:0 4px 14px rgba(0,0,0,0.4)",
      ].join(";");
      exitBtn.addEventListener("click", function () {
        try { document.dispatchEvent(new CustomEvent("cssos:watch-close")); } catch (_e) {}
        try { window.dispatchEvent(new CustomEvent("cssos:watch-close")); } catch (_e) {}
        try {
          if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
        } catch (_e) {}
        try { document.body.classList.remove("cssos-cinema-mode", "cssos-watch-theater", "cssos-watch-idle"); } catch (_e) {}
      });
      panel.appendChild(exitBtn);

      // CSSOS_WAVE_298 20260521 — Jing: 退出影院 ✕ 只在【真全屏影院模式】显示;
      // 一旦退出(cssos-cinema-mode / is-cssmv-fullscreen / 原生全屏 都没了)就
      // 立刻隐藏, 别再杵在那儿. 监听 body class + 原生 fullscreenchange.
      var syncExitVis = function () {
        var on = false;
        try {
          var pnl = document.getElementById("watch-panel");
          on = document.body.classList.contains("cssos-cinema-mode") ||
            (pnl && pnl.classList.contains("is-cssmv-fullscreen")) ||
            !!document.fullscreenElement || !!document.webkitFullscreenElement;
        } catch (_e) {}
        exitBtn.style.setProperty("display", on ? "flex" : "none", "important");
      };
      syncExitVis();
      try {
        new MutationObserver(syncExitVis).observe(document.body, { attributes: true, attributeFilter: ["class"] });
        document.addEventListener("fullscreenchange", syncExitVis, { passive: true });
        document.addEventListener("webkitfullscreenchange", syncExitVis, { passive: true });
      } catch (_e) {}
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
      var killStrayClose = function () {
        if (!inCinemaNow()) return;
        document.querySelectorAll("button, [role=button], a, .icon-btn").forEach(function (el) {
          if (!el || el.id === "watch-exit-cinema" || el.id === "watch-author-avatar") return;
          if (el.closest && el.closest("#watch-search-box")) return; // 搜索框内的元素不动
          if (el.closest && el.closest("#dock")) return;             // Dock 不动
          var r;
          try { r = el.getBoundingClientRect(); } catch (_e) { return; }
          if (!r || r.width <= 0 || r.height <= 0) return;
          if (r.width > 140 || r.height > 140) return; // 只针对小按钮(那个 ×)
          // 左上角区域: 这里在影院全屏下唯一该出现的是作者头像(已排除).
          if (r.left < 260 && r.top < 360) {
            try { el.style.setProperty("display", "none", "important"); } catch (_e) {}
          }
        });
      };
      killStrayClose();
      [200, 600, 1200, 2500].forEach(function (ms) { setTimeout(killStrayClose, ms); });
      try {
        new MutationObserver(killStrayClose).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
      } catch (_e) {}
      document.addEventListener("fullscreenchange", killStrayClose, { passive: true });
      document.addEventListener("webkitfullscreenchange", killStrayClose, { passive: true });
    }

    input.addEventListener("input", function () {
      clearTimeout(debTimer);
      var v = String(input.value || "").trim();
      debTimer = setTimeout(function () { runSearch(v); }, 300);
    });
    // Esc / 清空 → 收起
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { input.value = ""; runSearch(""); input.blur(); }
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
    if (!q) { results.style.display = "none"; return; }
    results.style.display = "flex";
    results.innerHTML = '<div style="padding:18px;text-align:center;color:rgba(218,255,238,0.6);font:500 13px ui-monospace,monospace;">' + esc(tr("Searching…", "搜索中…")) + "</div>";
    fetchPage(true);
  }
  function loadMore() {
    if (state.loading || state.exhausted || !state.q) return;
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
    var playable = works.filter(function (w) { return isPlayable(w) && Number(w.take_index || 0) !== 2; });
    if (first && !playable.length) {
      results.innerHTML = '<div style="padding:18px;text-align:center;color:rgba(218,255,238,0.6);font:500 13px ui-monospace,monospace;">' + esc(tr("No matching MVs.", "没有匹配的 MV。")) + "</div>";
      return;
    }
    playable.forEach(function (w) {
      var id = String(w.id || w.work_id || "").trim();
      if (!id || seen[id]) return;
      seen[id] = 1;
      // CSSOS_WAVE_288 — Jing: 封面【随机优先】. 有多张 cover_slides 就随机取一张
      // (每次搜索/启动都不同, 像幻灯); 没有池才退回主封面 cover_image. 池里的
      // 临时图(replicate/fal)若过期 404, onerror 再回退到稳定 cover_image 保底.
      var stable = String(w.cover_image || w.cover_url || w.preview_image_url || "").trim();
      var pool = (Array.isArray(w.cover_slides) ? w.cover_slides : [])
        .map(function (u) { return String(u || "").trim(); })
        .filter(Boolean);
      var primary = pool.length ? pool[Math.floor(Math.random() * pool.length)] : stable;
      var cover = esc(primary || stable);
      var fallback = esc(stable);
      var title = esc(w.title || tr("Untitled", "未命名"));
      var owner = esc(w.owner_name || "");
      var card = document.createElement("button");
      card.type = "button";
      card.style.cssText = "display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:transparent;border:none;border-radius:10px;padding:8px;cursor:pointer;color:#fff;font:inherit;";
      card.addEventListener("mouseenter", function () { card.style.background = "rgba(0,245,160,0.1)"; });
      card.addEventListener("mouseleave", function () { card.style.background = "transparent"; });
      card.innerHTML =
        '<div style="width:56px;height:56px;flex:0 0 auto;border-radius:8px;overflow:hidden;background:rgba(255,255,255,0.08);">' +
        (cover ? '<img src="' + cover + '" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;"' +
          (fallback && fallback !== cover ? ' onerror="this.onerror=null;this.src=\'' + fallback + '\';"' : "") + ">" : "") +
        "</div>" +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font:600 14px/1.3 -apple-system,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + title + "</div>" +
        (owner ? '<div style="font:500 11px/1.3 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,0.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + owner + "</div>" : "") +
        "</div>";
      card.addEventListener("click", function () { playWork(w); });
      results.appendChild(card);
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
      if (typeof globalThis.openMarketWorkPreview === "function") {
        globalThis.openMarketWorkPreview(payload);
      }
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
