/* CSSOS_WAVE_1225 — cssTV: 10 英尺大屏浏览层。
 *
 * 设计铁律(复用不重写): cssTV 只做"大屏 For-You rails + 遥控器/方向键导航 + 登录 + 聆听/观赏徽章"。
 * 选中作品后【交给已验证的 cinema 管线】(openMarketWorkPreview → 进 watch 影院), cinema 本身已经在
 * 大屏上跑「音频主时钟精确同步 + 逐字情绪字幕」, 绝不在这里复制招牌引擎打架。
 *
 * 复用的全局接口(均 globalThis 导出, 探子已核实):
 *   - openMarketWorkPreview(work, opts)        播放入口 → 进 cinema(自带音频主时钟+情绪字幕)
 *   - authState.user / openPanel(loginPanel)   登录态 + 登录面板
 *   - GET /api/works/market?limit=N            For-You 数据(直连 API, 不依赖内部全局)
 *   - cssos:panelclose 事件                     watch 影院关闭 → 恢复 cssTV 浮层
 *
 * 触发: location.hash = "#cssTV"(router REGISTRY 懒加载)或 globalThis.cssosOpenCssTV()。
 */
(function () {
  "use strict";
  if (globalThis.__cssosCssTvInstalled) return;
  globalThis.__cssosCssTvInstalled = true;

  var ROOT_ID = "csstv-root";
  var STYLE_ID = "csstv-style";
  var state = {
    open: false,
    rails: [],          // [{ key, title, works: [] }]
    focus: { row: 0, col: 0 },
    keyHandler: null,
    loading: false,
  };

  /* ---------- 样式(自注入, 主题变量驱动, clamp 大屏字号) ---------- */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      "#" + ROOT_ID + "{position:fixed;inset:0;z-index:2147483300;background:var(--bg,#020302);",
        "color:var(--text,#e8fdf4);display:flex;flex-direction:column;overflow:hidden;",
        "font-family:inherit;opacity:0;transition:opacity .28s ease;}",
      "#" + ROOT_ID + ".is-on{opacity:1;}",
      // 顶栏
      "#" + ROOT_ID + " .csstv-top{display:flex;align-items:center;gap:clamp(12px,1.4vw,22px);",
        "padding:clamp(18px,2.4vw,40px) clamp(24px,3.4vw,64px) clamp(8px,1vw,18px);flex:0 0 auto;}",
      "#" + ROOT_ID + " .csstv-brand{font-size:clamp(22px,2.4vw,40px);font-weight:800;letter-spacing:.04em;",
        "display:flex;align-items:center;gap:.4em;}",
      "#" + ROOT_ID + " .csstv-brand .dot{color:hsl(155,72%,52%);}",
      "#" + ROOT_ID + " .csstv-spacer{flex:1 1 auto;}",
      "#" + ROOT_ID + " .csstv-login{font-size:clamp(13px,1.1vw,18px);font-weight:600;cursor:pointer;",
        "padding:.5em 1.1em;border-radius:999px;border:1px solid rgba(0,245,160,.32);",
        "background:rgba(0,245,160,.10);color:var(--text);white-space:nowrap;}",
      "#" + ROOT_ID + " .csstv-login.is-focus{outline:3px solid hsl(155,72%,52%);outline-offset:2px;}",
      "#" + ROOT_ID + " .csstv-exit{font-size:clamp(13px,1.1vw,18px);cursor:pointer;opacity:.7;",
        "padding:.5em .9em;border-radius:999px;}",
      "#" + ROOT_ID + " .csstv-exit.is-focus{outline:3px solid hsl(155,72%,52%);outline-offset:2px;opacity:1;}",
      // rails 容器
      "#" + ROOT_ID + " .csstv-rails{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;",
        "padding:clamp(8px,1vw,18px) 0 clamp(40px,5vw,90px);scroll-behavior:smooth;}",
      "#" + ROOT_ID + " .csstv-rail{margin:clamp(10px,1.4vw,26px) 0;}",
      "#" + ROOT_ID + " .csstv-rail-title{font-size:clamp(15px,1.4vw,24px);font-weight:700;letter-spacing:.02em;",
        "padding:0 clamp(24px,3.4vw,64px) clamp(8px,.8vw,14px);opacity:.92;}",
      "#" + ROOT_ID + " .csstv-track{display:flex;gap:clamp(12px,1.4vw,26px);overflow-x:auto;overflow-y:hidden;",
        "padding:6px clamp(24px,3.4vw,64px);scroll-behavior:smooth;scrollbar-width:none;}",
      "#" + ROOT_ID + " .csstv-track::-webkit-scrollbar{display:none;}",
      // 卡片
      "#" + ROOT_ID + " .csstv-card{flex:0 0 auto;width:clamp(180px,15vw,300px);cursor:pointer;",
        "border-radius:clamp(12px,1vw,20px);overflow:hidden;background:rgba(255,255,255,.04);",
        "border:1px solid rgba(255,255,255,.06);transition:transform .16s ease,box-shadow .16s ease,outline-color .16s ease;",
        "outline:3px solid transparent;outline-offset:3px;position:relative;}",
      "#" + ROOT_ID + " .csstv-card.is-focus{transform:scale(1.06);outline-color:hsl(155,72%,52%);",
        "box-shadow:0 18px 50px rgba(0,0,0,.5);z-index:2;}",
      "#" + ROOT_ID + " .csstv-card-cover{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#0a0f0c;}",
      "#" + ROOT_ID + " .csstv-card-meta{padding:clamp(8px,.7vw,14px) clamp(10px,.8vw,16px);}",
      "#" + ROOT_ID + " .csstv-card-title{font-size:clamp(13px,1vw,18px);font-weight:600;",
        "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "#" + ROOT_ID + " .csstv-card-badge{font-size:clamp(11px,.8vw,14px);margin-top:.3em;opacity:.82;",
        "display:flex;align-items:center;gap:.4em;}",
      "#" + ROOT_ID + " .csstv-badge-free{color:hsl(155,72%,58%);font-weight:700;}",
      "#" + ROOT_ID + " .csstv-badge-pay{color:hsl(44,90%,64%);font-weight:700;}",
      // 空/加载态
      "#" + ROOT_ID + " .csstv-empty{padding:clamp(40px,6vw,120px) clamp(24px,3.4vw,64px);",
        "font-size:clamp(15px,1.4vw,22px);opacity:.7;}",
      "#" + ROOT_ID + " .csstv-hint{position:absolute;bottom:clamp(10px,1.4vw,26px);right:clamp(20px,3vw,56px);",
        "font-size:clamp(11px,.9vw,15px);opacity:.5;}",
    ].join("");
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- 数据 ---------- */
  function fmtCents(c) {
    var n = Number(c) || 0;
    if (n <= 0) return "";
    return "¥" + (n / 100).toFixed(2).replace(/\.00$/, "");
  }
  function workCover(w) {
    if (w && typeof w.cover_image === "string" && w.cover_image) return w.cover_image;
    if (w && typeof w.preview_image_url === "string" && w.preview_image_url) return w.preview_image_url;
    return "assets/mirror-1.webp";
  }
  function workId(w) { return (w && (w.work_id || w.id)) || ""; }

  async function fetchMarket() {
    try {
      var res = await fetch("/api/works/market?limit=60", { credentials: "include" });
      if (!res.ok) return [];
      var data = await res.json();
      var works = (data && (data.works || data.items)) || [];
      return Array.isArray(works) ? works.filter(function (w) { return workId(w); }) : [];
    } catch (_e) { return []; }
  }

  // work_type → rail 标题(中英)。多部类型优先呈现, 普通单曲归 Songs。
  var TYPE_RAILS = [
    { match: ["opera"], key: "opera", title: "Operas · 歌剧" },
    { match: ["film", "movie"], key: "film", title: "Films · 电影" },
    { match: ["series", "shortplay", "short-play", "drama"], key: "series", title: "Series · 剧集短剧" },
    { match: ["triptych", "trilogy"], key: "triptych", title: "Trilogies · 三部曲" },
  ];

  function buildRails(works) {
    if (!works.length) return [];
    var rails = [];
    // 1) For You —— 全部
    rails.push({ key: "foryou", title: "For You · 为你精选", works: works });
    // 2) Fresh —— 最新(API 通常已 recent-first, 取前 18)
    if (works.length > 6) rails.push({ key: "fresh", title: "Fresh · 最新上架", works: works.slice(0, 18) });
    // 3) 按 work_type 分类 rail(每类 ≥3 才出, 防稀疏)
    var seenType = {};
    TYPE_RAILS.forEach(function (def) {
      var group = works.filter(function (w) {
        var t = String(w.work_type || "").toLowerCase();
        return def.match.indexOf(t) >= 0;
      });
      if (group.length >= 3) { rails.push({ key: def.key, title: def.title, works: group }); group.forEach(function (w) { seenType[workId(w)] = 1; }); }
    });
    // 4) Free to play —— 免费试听
    var free = works.filter(function (w) {
      return !(Number(w.current_listen_price_cents || w.listen_price_cents) > 0);
    });
    if (free.length >= 3) rails.push({ key: "free", title: "Free to play · 免费试听", works: free });
    return rails;
  }

  /* ---------- 渲染 ---------- */
  function loginLabel() {
    var u = globalThis.authState && globalThis.authState.user;
    if (u) {
      var name = u.handle || u.email || u.name || "Account";
      return String(name).split("@")[0];
    }
    return "Sign in · 登录";
  }

  function render() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    var railsHtml = state.rails.map(function (rail, ri) {
      var cards = rail.works.map(function (w, ci) {
        var listen = Number(w.current_listen_price_cents || w.listen_price_cents) || 0;
        var badge = listen > 0
          ? '<span class="csstv-badge-pay">聆听 ' + fmtCents(listen) + "</span>"
          : '<span class="csstv-badge-free">▶ Free</span>';
        return (
          '<div class="csstv-card" data-row="' + ri + '" data-col="' + ci + '" data-wid="' + workId(w) + '">' +
            '<img class="csstv-card-cover" loading="lazy" src="' + workCover(w).replace(/"/g, "&quot;") + '" alt="" ' +
              'onerror="this.src=\'assets/mirror-1.webp\'"/>' +
            '<div class="csstv-card-meta">' +
              '<div class="csstv-card-title">' + escapeHtml(w.title || "Untitled") + "</div>" +
              '<div class="csstv-card-badge">' + badge + "</div>" +
            "</div>" +
          "</div>"
        );
      }).join("");
      return (
        '<div class="csstv-rail" data-rail="' + ri + '">' +
          '<div class="csstv-rail-title">' + escapeHtml(rail.title) + "</div>" +
          '<div class="csstv-track">' + cards + "</div>" +
        "</div>"
      );
    }).join("");

    root.innerHTML =
      '<div class="csstv-top">' +
        '<div class="csstv-brand">css<span class="dot">TV</span></div>' +
        '<div class="csstv-spacer"></div>' +
        '<div class="csstv-login" data-act="login">' + escapeHtml(loginLabel()) + "</div>" +
        '<div class="csstv-exit" data-act="exit">✕ Exit</div>' +
      "</div>" +
      '<div class="csstv-rails">' +
        (railsHtml || '<div class="csstv-empty">No works yet. 暂无作品。</div>') +
      "</div>" +
      '<div class="csstv-hint">↑↓←→ navigate · Enter play · Esc exit</div>';

    bindClicks(root);
    applyFocus();
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function bindClicks(root) {
    root.querySelectorAll(".csstv-card").forEach(function (card) {
      card.addEventListener("click", function () {
        state.focus = { row: Number(card.dataset.row), col: Number(card.dataset.col) };
        applyFocus();
        playFocused();
      });
    });
    var login = root.querySelector('[data-act="login"]');
    if (login) login.addEventListener("click", openLogin);
    var exit = root.querySelector('[data-act="exit"]');
    if (exit) exit.addEventListener("click", closeCssTv);
  }

  /* ---------- 焦点导航(方向键 / 遥控器 d-pad) ---------- */
  function railAt(ri) { return state.rails[ri]; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function applyFocus() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.querySelectorAll(".is-focus").forEach(function (el) { el.classList.remove("is-focus"); });
    if (state.focus.row < 0) {
      // 顶栏(登录/退出)
      var sel = state.focus.col <= 0 ? '[data-act="login"]' : '[data-act="exit"]';
      var top = root.querySelector(sel);
      if (top) top.classList.add("is-focus");
      return;
    }
    var card = root.querySelector('.csstv-card[data-row="' + state.focus.row + '"][data-col="' + state.focus.col + '"]');
    if (card) {
      card.classList.add("is-focus");
      card.scrollIntoView({ block: "nearest", inline: "center" });
      var rail = card.closest(".csstv-rail");
      if (rail) rail.scrollIntoView({ block: "nearest" });
    }
  }

  function move(dr, dc) {
    var f = state.focus;
    if (f.row < 0) {
      // 在顶栏: 左右切登录/退出; 下进入第一条 rail
      if (dr > 0) { state.focus = { row: 0, col: 0 }; applyFocus(); return; }
      if (dc !== 0) { state.focus.col = clamp(f.col + dc, 0, 1); applyFocus(); }
      return;
    }
    if (dr !== 0) {
      var nr = f.row + dr;
      if (nr < 0) { state.focus = { row: -1, col: 0 }; applyFocus(); return; }
      if (nr >= state.rails.length) nr = state.rails.length - 1;
      var rail = railAt(nr);
      state.focus = { row: nr, col: clamp(f.col, 0, rail.works.length - 1) };
      applyFocus();
      return;
    }
    if (dc !== 0) {
      var cur = railAt(f.row);
      state.focus.col = clamp(f.col + dc, 0, cur.works.length - 1);
      applyFocus();
    }
  }

  function playFocused() {
    if (state.focus.row < 0) {
      if (state.focus.col <= 0) openLogin(); else closeCssTv();
      return;
    }
    var rail = railAt(state.focus.row);
    var w = rail && rail.works[state.focus.col];
    if (!w) return;
    playWork(w);
  }

  /* ---------- 播放: 交给 cinema 管线(自带音频主时钟+情绪字幕) ---------- */
  function playWork(w) {
    var root = document.getElementById(ROOT_ID);
    // 隐藏 cssTV 浮层, watch 影院盖上来; 影院关闭(cssos:panelclose)时恢复。
    if (root) root.style.display = "none";
    var restore = function () {
      var r = document.getElementById(ROOT_ID);
      if (r && state.open) { r.style.display = "flex"; applyFocus(); }
      document.removeEventListener("cssos:panelclose", restore);
    };
    document.addEventListener("cssos:panelclose", restore);
    try {
      if (typeof globalThis.openMarketWorkPreview === "function") {
        globalThis.openMarketWorkPreview(Object.assign({}, w, { __cssosOpenedFrom: "csstv" }), {});
      } else {
        // 兜底: 走 hash 分享路由
        location.hash = "#cssMV=" + encodeURIComponent(workId(w));
      }
    } catch (_e) {
      if (root) { root.style.display = "flex"; }
      document.removeEventListener("cssos:panelclose", restore);
    }
  }

  function openLogin() {
    try {
      if (globalThis.authState && globalThis.authState.user) return; // 已登录
      if (typeof globalThis.openLoginForCreation === "function") { globalThis.openLoginForCreation(); return; }
      if (typeof globalThis.openPanel === "function" && globalThis.loginPanel) {
        globalThis.openPanel(globalThis.loginPanel, { userInitiated: true });
      }
    } catch (_e) {}
  }

  /* ---------- 键盘 / 遥控器 ---------- */
  function onKey(e) {
    if (!state.open) return;
    var k = e.key;
    if (k === "ArrowUp") { move(-1, 0); e.preventDefault(); }
    else if (k === "ArrowDown") { move(1, 0); e.preventDefault(); }
    else if (k === "ArrowLeft") { move(0, -1); e.preventDefault(); }
    else if (k === "ArrowRight") { move(0, 1); e.preventDefault(); }
    else if (k === "Enter" || k === " " || k === "MediaPlayPause") { playFocused(); e.preventDefault(); }
    else if (k === "Escape" || k === "Backspace" || k === "GoBack") { closeCssTv(); e.preventDefault(); }
  }

  /* ---------- 开 / 关 ---------- */
  async function openCssTv() {
    ensureStyle();
    var root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    root.style.display = "flex";
    state.open = true;
    if (location.hash !== "#cssTV") { try { location.hash = "#cssTV"; } catch (_e) {} }
    if (!state.keyHandler) { state.keyHandler = onKey; document.addEventListener("keydown", state.keyHandler, true); }
    // 首帧: 骨架
    root.innerHTML = '<div class="csstv-top"><div class="csstv-brand">css<span class="dot">TV</span></div></div>' +
      '<div class="csstv-empty">Loading… 加载中</div>';
    requestAnimationFrame(function () { root.classList.add("is-on"); });
    if (!state.loading) {
      state.loading = true;
      var works = await fetchMarket();
      state.rails = buildRails(works);
      state.loading = false;
    }
    state.focus = { row: 0, col: 0 };
    render();
  }

  function closeCssTv() {
    var root = document.getElementById(ROOT_ID);
    state.open = false;
    if (root) { root.classList.remove("is-on"); setTimeout(function () { if (!state.open && root) root.style.display = "none"; }, 280); }
    if (state.keyHandler) { document.removeEventListener("keydown", state.keyHandler, true); state.keyHandler = null; }
    if (location.hash === "#cssTV") { try { history.replaceState(null, "", location.pathname + location.search); } catch (_e) { location.hash = ""; } }
  }

  /* ---------- 导出 + hash 触发 ---------- */
  globalThis.cssosOpenCssTV = openCssTv;
  globalThis.cssosCloseCssTV = closeCssTv;

  function checkHash() { if (location.hash === "#cssTV" && !state.open) openCssTv(); }
  window.addEventListener("hashchange", checkHash);
  // 被 router 懒加载时, hash 已是 #cssTV → 自开。
  checkHash();
})();
