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
      "position:absolute", "top:6px",
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
        "position:absolute", "top:calc(env(safe-area-inset-top,0px) + 6px)", "right:10px",
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

    // ── CSSOS_WAVE_289 — MV 面板【特殊模式】: 有操作就显示搜索框, 无操作自动
    // 隐藏(区别于其它面板的"下滑显示/上滑隐藏" swipe 模式). 任意交互(轻触/
    // 移动/按键/滚轮)都唤出搜索框, 静止 ~3.5s 自动淡隐; 正在输入/有结果时不隐. ──
    var IDLE_HIDE_MS = 3500;
    var hideTimer = null;
    function showBar() {
      box.style.transform = "translateY(0)";
      box.style.opacity = "1";
      armIdleHide();
    }
    function hideBar() {
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
      // 任意操作 → 显示 + 重置空闲计时.
      ["pointerdown", "pointermove", "touchstart", "touchmove", "wheel", "keydown"].forEach(function (ev) {
        panel.addEventListener(ev, function () {
          // 别让搜索框自身的输入操作触发"重新计时隐藏"打断打字 —— hideBar 已护住输入态.
          showBar();
        }, { passive: true });
      });
      // 进入 MV 面板先亮一下让用户知道有搜索, 随后空闲自动隐.
      showBar();
    }
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
