/* CSSOS_WAVE_1114 20260622 — Jing 影院右轨(TikTok 经典位)。
 * 把"评论 / 聆听 / 观赏 / 打赏 / 买断 / AI"全部收进画面【右边缘竖排】, 拆掉底部价格条 + 撤 AI FAB。
 * 顶=作者头像(➕关注), 底=AI 最底紧挨买断。每项下挂【计数·价】(计数 Wave 后补, 先显价)。
 *   · 评论  → globalThis.openPersonMvComments(workId)   (现成抽屉)
 *   · 聆听  → dispatchMarketWorkPayment(workId,"listen") · ¢69
 *   · 观赏  → 真视频上线后开放(置灰) · ¢99
 *   · 打赏  → dispatchMarketWorkPayment(workId,"tip")   金额随意
 *   · 买断  → dispatchMarketWorkPayment(workId,"buyout") 仅图标(买断即归属转移, 无计数)
 *   · AI    → cssosOpenAssistantWithPrompt("") / 点 #cssos-agent-fab
 * 只在 watch-panel 打开时显示; 跟 cssos:work-id-changed 刷新 workId/价。
 * 设计稿: 左上=返回, 顶部中=搜索, 右上 ✕ 已撤; 多语言胶囊居中; 左下标题摘要(Wave 2)。 */
(function () {
  "use strict";
  if (globalThis.__cssosSocialRailWired) return;
  globalThis.__cssosSocialRailWired = true;

  function copy(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    var zhLoc = false;
    try { zhLoc = String(document.documentElement.lang || "").slice(0, 2) === "zh"; } catch (_e) {}
    return zhLoc ? zh : en;
  }
  function fmtCents(c) {
    c = Number(c) || 0;
    return c >= 100 ? "$" + (c / 100).toFixed(2) : "¢" + c;
  }
  function fmtCount(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "m";
    if (n >= 1000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + "k";
    return String(n);
  }
  // CSSOS_WAVE_1129c — 打赏总额: 整美元去掉 .00($58), 否则两位小数($58.50)。
  function fmtMoney(cents) {
    cents = Number(cents) || 0;
    var d = cents / 100;
    return "$" + (cents % 100 === 0 ? String(d) : d.toFixed(2));
  }

  // 社会证明计数缓存(workId → {listens,watches,tips,comments})。
  var _stats = {};
  function fetchStats(id) {
    if (!id || _stats[id]) return;
    _stats[id] = { listens: 0, watches: 0, tips: 0, tips_total_cents: 0, comments: 0 };   // 占位防重复拉
    try {
      fetch("/api/works/" + encodeURIComponent(id) + "/social-stats", { credentials: "include" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || d.ok === false) return;
          _stats[id] = { listens: Number(d.listens || 0), watches: Number(d.watches || 0), tips: Number(d.tips || 0), tips_total_cents: Number(d.tips_total_cents || 0), comments: Number(d.comments || 0), owner_is_staff: !!d.owner_is_staff };
          // CSSOS_WAVE_1168 — 同时拿到【作品作者】(有效所有者), 灌进作者缓存供头像/菜单用(作品数据常不带 owner)。
          var oid = String(d.owner_user_id || "").trim();
          if (oid) { _authorCache[oid] = { name: String(d.owner_display_name || ""), avatar: String(d.owner_avatar_url || "") }; _statsOwner[id] = oid; }
          schedule();   // 拿到数 → 重渲染带上计数
        }).catch(function () {});
    } catch (_e) {}
  }
  function statsFor(id) { return _stats[id] || { listens: 0, watches: 0, tips: 0, tips_total_cents: 0, comments: 0, owner_is_staff: false }; }
  // CSSOS_WAVE_1169 — Jing 指令: @cssstudio.app 全员 + jingdudc@gmail.com(管理员/工作人员)不参与买卖。
  //   故 staff 观众: 聆听/观赏/买断 置灰; 打赏可用, 但作者也是 staff 时置灰(staff↔staff 禁打赏)。
  function viewerEmail() {
    try { var a = (typeof globalThis.cssosAuthState === "function") ? globalThis.cssosAuthState() : globalThis.authState; return String((a && a.user && a.user.email) || "").toLowerCase().trim(); } catch (_e) { return ""; }
  }
  function viewerIsStaff() {
    var e = viewerEmail(); if (!e) return false;
    try { if (typeof globalThis.isAdminEmailModule === "function") return !!globalThis.isAdminEmailModule(e); } catch (_e) {}
    return e.indexOf("@cssstudio.app") >= 0 || e === "jingdudc@gmail.com";
  }
  // CSSOS_WAVE_1205 — Jing: 自己作品自己不能买卖/打赏。取 viewer 的 user id, 与作品 owner 比对。
  function viewerUserId() {
    try { var a = (typeof globalThis.cssosAuthState === "function") ? globalThis.cssosAuthState() : globalThis.authState; return String((a && a.user && (a.user.id || a.user.user_id)) || "").trim(); } catch (_e) { return ""; }
  }
  // CSSOS_WAVE_1144 — Jing 指令: 评论增删后立即同步右轨计数。清缓存→下次 render 重新拉→重渲染。
  function invalidateStats(id) { try { if (id) delete _stats[id]; } catch (_e) {} }
  document.addEventListener("cssos:comments-changed", function (e) {
    var id = (e && e.detail && e.detail.workId) || workId();
    invalidateStats(id);
    if (typeof globalThis.cssosRenderSocialRail === "function") globalThis.cssosRenderSocialRail();
  });
  // CSSOS_WAVE_1129b — Jing 指令: 始终显"计数/价"(无交易也显 0), 如 "0/¢69"。
  //   用斜杠 "/" 而非圆点 —— "/" 表示【每次/per】这个价(每聆听/每观赏的单价)。
  function countPrice(n, cents) { return fmtCount(Number(n) || 0) + "/" + fmtCents(cents); }

  // 当前播放作品(沿用 watch 既有回退链)。
  function currentWork() {
    try {
      return (globalThis.currentStructuredWatchQueue && globalThis.currentStructuredWatchQueue.items && globalThis.currentStructuredWatchQueue.items[0])
        || (globalThis.__cssosWatchQueue && globalThis.__cssosWatchQueue.items && globalThis.__cssosWatchQueue.items[0])
        || globalThis.currentWatchPreviewWork
        || null;
    } catch (_e) { return null; }
  }
  function workId() { var w = currentWork(); return w ? String(w.id || w.work_id || "").trim() : ""; }
  // CSSOS_WAVE_1141 — Jing: 评论点不动多半是点击时 currentWork() 已空 → workId 为"" → 静默返回。
  //   多源稳健解析 work id, 任一拿到即用。
  function robustWorkId() {
    var id = workId(); if (id) return id;
    try { if (typeof globalThis.cssosCurrentWorkId === "function") { id = String(globalThis.cssosCurrentWorkId() || "").trim(); if (id) return id; } } catch (_e) {}
    try { var ps = globalThis.cssosMvPipelinePanelState && globalThis.cssosMvPipelinePanelState(); if (ps) { id = String(ps.workId || ps.work_id || ps.id || "").trim(); if (id) return id; } } catch (_e) {}
    try { var p = globalThis.currentWatchPreviewWork; if (p) { id = String(p.id || p.work_id || "").trim(); if (id) return id; } } catch (_e) {}
    return "";
  }
  function listenCents(w) { return Number((w && (w.current_listen_price_cents || w.listen_price_cents || w.suggested_listen_price_cents)) || 69); }
  function viewCents(w) { return Number((w && (w.current_view_price_cents || w.view_price_cents)) || 99); }
  // CSSOS_WAVE_1167 — Jing 指令: 买断显示【系统建议价】, 不是 "买断" 字。current 优先, 否则 suggested, 兜底 599。
  function buyoutCents(w) { return Number((w && (w.current_buyout_price_cents || w.suggested_buyout_price_cents || w.buyout_price_cents)) || 599); }

  // CSSOS_WAVE_1163 — Jing 指令: 头像必须是【正在播放作品的作者】, 绝不回退登录用户。
  //   从当前作品取作者 id/名/头像; 作品没带头像就按 id 拉(缓存), 拉到再重渲染。
  var _authorCache = {};   // userId → {name, avatar}
  var _statsOwner = {};    // workId → ownerUserId(来自 social-stats, 作品数据没带 owner 时的权威来源)
  function currentAuthor() {
    var w = currentWork() || {};
    var ow = w.owner || {};
    var id = String(w.owner_user_id || w.owner_id || ow.id || ow.user_id || "").trim();
    // 作品数据没带 owner → 用 social-stats 拉到的作者(W1168)。
    if (!id) { try { var wid = robustWorkId(); if (wid && _statsOwner[wid]) id = _statsOwner[wid]; } catch (_e) {} }
    var name = String(w.owner_display_name || w.owner_name || ow.name || ow.display_name || "").trim();
    var avatar = String(w.owner_avatar_url || w.avatar_url || ow.avatar_url || "").trim();
    // CSSOS_WAVE_1268 — Jing 铁律: 解析不出作者时兜底到【系统管理员 CSS Studio(admin@cssstudio.app)】,
    //   绝不兜底登录用户(=合法偷别人作品)或作品标题(=诬作品无作者)。后台/系统输出本就该挂系统管理员。
    //   只有【我正创作输出】(html.cssmv-pipeline-running)才用登录用户(那确实是我的)。
    if (!id) {
      var _running = false;
      try { _running = !!(document.documentElement && document.documentElement.classList.contains("cssmv-pipeline-running")); } catch (_e) {}
      if (_running) {
        try {
          var _a = (typeof globalThis.cssosAuthState === "function") ? globalThis.cssosAuthState() : globalThis.authState;
          var _u = _a && _a.user;
          if (_u) { id = String(_u.id || _u.user_id || "").trim(); name = name || String(_u.display_name || _u.name || "").trim(); avatar = avatar || String(_u.avatar_url || "").trim(); }
        } catch (_e) {}
      }
      if (!id) { id = "ff6d32ab-fc93-4971-9c28-9b9f8c195cbb"; name = name || "CSS Studio"; }   // 系统管理员
    }
    if (id && _authorCache[id]) { name = name || _authorCache[id].name; avatar = avatar || _authorCache[id].avatar; }
    return { id: id, name: name, avatar: avatar };
  }
  function fetchAuthor(id) {
    if (!id || _authorCache[id]) return;
    _authorCache[id] = { name: "", avatar: "" };   // 占位防重复拉
    try {
      fetch("/api/users/" + encodeURIComponent(id) + "/public-avatar", { credentials: "include" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (j && j.ok) { _authorCache[id] = { name: String(j.display_name || ""), avatar: String(j.avatar_url || "") }; schedule(); }
        }).catch(function () {});
    } catch (_e) {}
  }

  function railHost() { return document.getElementById("watch-panel"); }
  function watchOpen() {
    var p = railHost();
    if (!p) return false;
    if (p.hidden || p.classList.contains("hidden")) return false;
    try { var cs = getComputedStyle(p); return cs.display !== "none" && cs.visibility !== "hidden"; } catch (_e) { return true; }
  }

  // 隐藏旧的底部价格条 + AI FAB(功能已迁入右轨)。情绪字幕那行保留。
  function injectHideCss() {
    if (document.getElementById("cssos-social-rail-css")) return;
    var s = document.createElement("style");
    s.id = "cssos-social-rail-css";
    s.textContent =
      // CSSOS_WAVE_1121 — Jing 指令: 右轨已接管聆听/观赏/打赏/买断 → 拆掉旧价格条(只藏价格条, 不动头像/AI FAB)。
      "#cssos-watch-price-strip{display:none !important;}" +
      // CSSOS_WAVE_1123 — Jing 指令②: 删左上旧头像(右轨顶部已有头像); 藏右上旧 ✕(左上 ‹ 返回已替代,
      //   ‹ 仍以编程方式点击这个隐藏的关闭按钮来退出, 故藏其外观不影响退出)。
      "#watch-author-avatar{display:none !important;}" +
      "#watch-panel .panel-actions .icon-btn[aria-label=\"Close\"]{display:none !important;}" +
      // CSSOS_WAVE_1128 — Jing 指令: AI 助理换小机器人收回右轨底部(=右轨第7个图标, 用右轨统一间距),
      //   隐藏旧悬浮 AI FAB(避免"太靠近"+重复)。
      // CSSOS_WAVE_1427 — Jing「外面也要保留 AI 助理」: 只在【影院/watch 面板打开】时藏 FAB(让右轨 🤖 接管);
      //   离开影院(主界面/市场)body 去掉 .cssos-watch-on → 全局 FAB 恢复显示。原全局无条件隐藏=外面也没了。
      "body.cssos-watch-on #cssos-agent-fab{display:none !important;}" +
      // 右轨现含 AI(7 项), bottom 下移到 20px, 让 🤖 落在右下角(旧 FAB 位置), 全轨用统一 9px 间距。
      "#cssos-watch-social-rail{position:absolute;right:14px;bottom:20px;" +
      "z-index:30;display:flex;flex-direction:column;align-items:center;gap:9px;pointer-events:none;}" +
      "#cssos-watch-social-rail>*{pointer-events:auto;}" +
      ".csr-item{display:flex;flex-direction:column;align-items:center;gap:1px;background:transparent;border:0;padding:0;cursor:pointer;}" +
      ".csr-ic{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.12);display:flex;align-items:center;" +
      "justify-content:center;font-size:21px;line-height:1;color:#fff;transition:transform .15s ease;}" +
      ".csr-item:active .csr-ic{transform:scale(0.92);}" +
      /* CSSOS_WAVE_1776 20260726 — Jing「影院里的 AI 助理改统一的黑绿渐变粗体 ＋, 可拖拽」。
         与全局 FAB(app.agent-chat.js #cssos-agent-fab)用同一套不规则黑绿渐变 —— 两个入口
         必须长得一样, 否则用户会以为是两个不同功能。渐变 = 两层 radial 叠 linear, 亮点偏
         左上 → 不规则的"液态"感, 不是死板对角线。 */
      "#cssos-rail-ai .csr-ic{" +
        "background:radial-gradient(circle at 30% 26%,rgba(0,245,160,0.92) 0%,rgba(0,184,122,0.62) 34%,rgba(6,20,15,0) 62%)," +
        "radial-gradient(circle at 74% 80%,rgba(0,140,95,0.5) 0%,rgba(2,10,7,0) 58%)," +
        "linear-gradient(148deg,#07130e 0%,#0d1a14 46%,#020806 100%);" +
        "border:1px solid rgba(0,245,160,0.36);color:#eafff6;font-size:26px;font-weight:700;" +
        "box-shadow:0 6px 22px rgba(2,10,7,0.62),0 0 0 1px rgba(255,255,255,0.05) inset;}" +
      "#cssos-rail-ai{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;}" +
      "#cssos-rail-ai[data-dragging='1']{cursor:grabbing;}" +
      "#cssos-rail-ai[data-dragging='1'] .csr-ic{transform:scale(1.1);}" +
      ".csr-item[disabled]{cursor:default;opacity:0.55;}" +
      ".csr-lbl{font-size:11px;color:#e6ddd2;text-shadow:0 1px 3px rgba(0,0,0,0.6);white-space:nowrap;}" +
      ".csr-ic.is-comment{background:rgba(0,245,160,0.18);box-shadow:inset 0 0 0 1.5px #00f5a0;color:#00f5a0;}" +
      ".csr-ic.is-ai{background:#1c2b3a;box-shadow:inset 0 0 0 1px #2e4a63;color:#7fd4ff;}" +
      // CSSOS_WAVE_1159 — Jing 指令: 头像彻底去黑圈——去掉 button 默认边框/阴影/内边距+任何底色,
      //   只剩透明 + 完整 logo(object-fit:contain, 尖角不截)。仅【文字兜底】(.is-text, 无 logo 图)时给半透明圆。
      // CSSOS_WAVE_1161 — Jing 指令: 头像和其它图标一样 = 【无边框的半透明圆】(不是全透明, 也不要白/黑环)。
      //   背景同 .csr-ic 的 rgba(255,255,255,0.12); 去掉一切 border/outline/box-shadow/焦点环。
      // CSSOS_WAVE_1167 — Jing 指令: ➕ 关注角标不要被圈裁掉, 要【压在头像圈边框上】。故容器 overflow:visible,
      //   圆形裁剪交给 img 自身 border-radius; ➕(.csr-follow)绝对定位、骑在底边、z-index 压住边框。
      ".csr-av{position:relative;width:46px;height:46px;border:0!important;outline:0!important;box-shadow:none!important;padding:0;margin:0;" +
      "background:rgba(255,255,255,0.12);-webkit-appearance:none;appearance:none;border-radius:50%;overflow:visible;display:flex;align-items:center;" +
      "justify-content:center;font-weight:600;font-size:16px;color:#fff;}" +
      ".csr-av:focus,.csr-av:focus-visible{outline:0!important;box-shadow:none!important;}" +
      ".csr-av img{width:100%;height:100%;border:0;border-radius:50%;object-fit:cover;display:block;}" +
      // CSSOS_WAVE_1167 — ➕ 骑在头像底边上(压住圈边、不被裁): bottom:-2px 让它半压边框; z-index:2 在最上。
      ".csr-av .csr-follow{position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:17px;height:17px;z-index:2;" +
      "border-radius:50%;background:#00f5a0;color:#04241a;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;}" +
      // CSSOS_WAVE_1119 — 左上返回键(成熟模式): 退出影院。点它=触发现成 watch-panel 关闭按钮。
      // CSSOS_WAVE_1254 — 返回键跟刘海(和搜索框/右上⋯同行): top 改 notch-aware, 不再写死 12px 跑到上面。
      // CSSOS_WAVE_1265 — Jing「返回按钮太贴边, 要和右上 ⋯/关闭 一样留间距」。原 top:safe+2(桌面 safe=0 → 2px 贴顶)
      //   改 top:safe+14、left:14, 与右上按钮(top≈12/14)对称, 不再死贴左上角。
      "#cssos-watch-backbtn{position:absolute;left:14px;top:calc(env(safe-area-inset-top, 0px) + 14px);z-index:31;width:40px;height:40px;border-radius:50%;" +
      "background:rgba(20,16,12,0.55);border:0.5px solid rgba(255,255,255,0.18);color:#fff;font-size:22px;line-height:1;" +
      "display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;}" +
      "#cssos-watch-backbtn:active{transform:scale(0.92);}";
    document.head.appendChild(s);
  }

  function mkItem(emoji, label, opts) {
    opts = opts || {};
    var b = document.createElement("button");
    b.type = "button";
    b.className = "csr-item";
    // CSSOS_WAVE_1790 — <13 关社交: 标记【发/再分发】类按钮, 由 app.social-age-gate.js 统一隐藏。
    //   注意只标"发"的(分享), 💬评论按钮不标 —— 读评论属于"看", 不在禁用范围内
    //   (评论的输入框由 .cwc-composer 单独隐藏)。
    if (opts.social) b.setAttribute("data-social-gated", "1");
    if (opts.disabled) b.setAttribute("disabled", "");
    if (opts.title) b.title = opts.title;
    if (opts.aria) b.setAttribute("aria-label", opts.aria);
    var ic = document.createElement("span");
    ic.className = "csr-ic" + (opts.icClass ? " " + opts.icClass : "");
    ic.textContent = emoji;
    b.appendChild(ic);
    if (label) {
      var l = document.createElement("span");
      l.className = "csr-lbl";
      l.textContent = label;
      b.appendChild(l);
    }
    if (!opts.disabled && typeof opts.onClick === "function") {
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); opts.onClick(b); });
    }
    return b;
  }

  function dispatch(kind, btn) {
    // CSSOS_WAVE_1154 — Jing: 聆听/观赏/打赏/买断点不动 = workId() 常空→静默返回。改稳健多源 id;
    //   支付分发器缺失也给可见提示(不再死按钮)。
    var id = robustWorkId();
    if (!id) { try { if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Loading work…", "作品加载中…")); } catch (_e) {} return; }
    try {
      if (typeof globalThis.dispatchMarketWorkPayment === "function") { globalThis.dispatchMarketWorkPayment(id, kind, btn); return; }
      if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Payment is loading…", "支付组件加载中…"));
    } catch (e) {
      try { if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Could not open payment", "支付打开失败")); } catch (_e) {}
      console.warn("[social-rail] dispatch " + kind, e);
    }
  }

  function buildRail() {
    var host = railHost();
    if (!host) return null;
    var rail = document.getElementById("cssos-watch-social-rail");
    if (!rail) {
      rail = document.createElement("div");
      rail.id = "cssos-watch-social-rail";
      rail.dataset.noFrameToggle = "1";
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.appendChild(rail);
    } else if (rail.parentNode !== host) {
      host.appendChild(rail);
    }
    return rail;
  }

  // CSSOS_WAVE_1119 — 左上返回键: 退出影院 = 点现成的 watch-panel 关闭按钮(不另造退出逻辑)。
  function ensureBackBtn() {
    var host = railHost(); if (!host) return;
    var b = document.getElementById("cssos-watch-backbtn");
    if (!watchOpen()) { if (b) b.style.display = "none"; return; }
    if (!b) {
      b = document.createElement("button");
      b.id = "cssos-watch-backbtn"; b.type = "button"; b.dataset.noFrameToggle = "1";
      b.setAttribute("aria-label", copy("Back", "返回"));
      b.textContent = "‹";
      b.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        try {
          var x = host.querySelector('.panel-actions .icon-btn[aria-label="Close"]')
               || host.querySelector('.icon-btn[aria-label="Close"]')
               || host.querySelector('.icon-btn[aria-label="close"]');
          if (x) x.click();
        } catch (_e) {}
      });
      host.appendChild(b);
    }
    b.style.display = "flex";
  }

  function render() {
    injectHideCss();
    ensureBackBtn();
    // CSSOS_WAVE_1427 — 影院开=藏 FAB(右轨🤖接管); 离开影院=去 class → 主界面全局 FAB 恢复。
    document.body.classList.toggle("cssos-watch-on", watchOpen());
    if (!watchOpen()) { var r0 = document.getElementById("cssos-watch-social-rail"); if (r0) r0.style.display = "none"; return; }
    var rail = buildRail();
    if (!rail) return;
    rail.style.display = "flex";
    var w = currentWork() || {};
    var id0 = robustWorkId();   // CSSOS_WAVE_1146 — workId() 常空→计数永远0(评论3却显0)。改用稳健多源 id。
    fetchStats(id0);
    var st = statsFor(id0);
    rail.textContent = "";
    // CSSOS_WAVE_1196 — Jing 规则: 管理员/工作人员【只能接受打赏】。
    //   · 买卖(聆听/买断): 任一方是 staff 即不可 —— staff 不买, staff 作品也不卖给非 staff。
    //   · 打赏: viewer 是 staff 不可【给】(staff 仅接受); viewer 非 staff 时给 staff/非 staff 都行(staff↔staff 自然被挡)。
    var _staff = viewerIsStaff();
    var _ownerStaff = !!st.owner_is_staff;
    // CSSOS_WAVE_1205 — Jing: 自己作品自己不能买卖/打赏 → 本人作品全灰。owner id 优先 stats(_statsOwner)/作品字段, 再退邮箱。
    var _ownerId = String((currentAuthor() || {}).id || w.owner_user_id || w.owner_id || "").trim();
    var _viewerId = viewerUserId();
    var _ownerEmail = String(w.owner_email || "").toLowerCase().trim();
    var _ownWork = (!!_ownerId && !!_viewerId && _ownerId === _viewerId) ||
                   (!!_ownerEmail && _ownerEmail === viewerEmail());
    var _noSale = _staff || _ownerStaff || _ownWork;   // 买卖不可(任一方 staff, 或本人作品)
    var _noTip = _staff || _ownWork;                    // 打赏不可(staff 主动给, 或本人作品)

    // 1. 作者头像 + 关注
    var av = document.createElement("button");
    av.type = "button"; av.className = "csr-av";
    av.setAttribute("aria-label", copy("Creator", "作者"));
    // CSSOS_WAVE_1163 — Jing 指令: 头像=【正在播放作品的作者】, 不是登录用户(之前 watch-ui 自我兜底=人人显示自己头像, 错)。
    var au = currentAuthor();
    if (au.id && !au.avatar) fetchAuthor(au.id);   // 作品没带头像 → 按作者 id 拉
    var avatarUrl = au.avatar;
    var nameForInitial = String(au.name || "CSS Studio").trim();   // W1268 — 绝不用作品标题当作者名(诬无作者)
    if (avatarUrl) { var im = document.createElement("img"); im.src = avatarUrl; im.alt = ""; av.appendChild(im); }
    else { av.classList.add("is-text"); av.textContent = nameForInitial.charAt(0).toUpperCase() || "C"; }   // W1159 仅文字兜底给半透明圆
    var fol = document.createElement("span"); fol.className = "csr-follow"; fol.textContent = "+"; av.appendChild(fol);
    // CSSOS_WAVE_1130 — Jing 指令: 点头像弹【原来左上角那套作者菜单】(关注/只播TA/作品中心/屏蔽/赠礼,
    //   含带图标的用户名)。右轨头像只是 TikTok 风格的新位置 + ➕关注视觉, 菜单复用 watch-ui 的 openMenu。
    av.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        // CSSOS_WAVE_1137 — Jing 指令: 点头像【切换】菜单显隐(已开→关, 已关→开)。
        var openMenuEl = document.querySelector(".cssos-author-menu");
        if (openMenuEl) { document.querySelectorAll(".cssos-author-menu").forEach(function (m) { m.remove(); }); return; }
        // CSSOS_WAVE_1163 — 把【作品作者】的 id/名字显式传给菜单(不再让 watch-ui 自我兜底)。
        if (typeof globalThis.cssosOpenWatchAuthorMenu === "function") { globalThis.cssosOpenWatchAuthorMenu(av, au.id, au.name); return; }
        var uid = String(au.id || w.owner_user_id || "").trim();
        if (uid && typeof globalThis.openUserHomepage === "function") globalThis.openUserHomepage(uid);
        else if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Creator profile coming soon", "作者主页即将开放"));
      } catch (_e) {}
    });
    rail.appendChild(av);

    // 2. 💬 评论 · 计数(TikTok 式: 直接显计数, 无评论显 0, 不显"评论"二字) — CSSOS_WAVE_1128
    //    CSSOS_WAVE_1134 — Jing 指令: 去掉 is-comment 特殊绿圈, 与其它图标风格统一(普通半透明圆)。
    rail.appendChild(mkItem("💬", fmtCount(st.comments), {
      aria: copy("Comments", "评论"),
      onClick: function () {
        // CSSOS_WAVE_1141 — 稳健取 id; 取不到也给可见提示, 不再静默"点不动"。
        var id = robustWorkId();
        if (!id) { try { if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Loading work…", "作品加载中…")); } catch (_e) {} return; }
        try {
          // CSSOS_WAVE_1138 — 通用作品评论(影院 user_works); 旧的 openPersonMvComments 只认 person_mv → 点不动。
          if (typeof globalThis.cssosOpenWorkComments === "function") { globalThis.cssosOpenWorkComments(id); return; }
          if (typeof globalThis.openPersonMvComments === "function") { globalThis.openPersonMvComments(id); return; }
          if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Comments unavailable", "评论暂不可用"));
        } catch (err) {
          try { if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Comments failed to open", "评论打开失败")); } catch (_e) {}
          try { console.warn("[social-rail] comments open failed", err); } catch (_e) {}
        }
      }
    }));

    // 2.5 📤 分享 — CSSOS_WAVE_1190 — Jing 指令: 右轨补分享按钮。复用已做好的分享小窗口
    //   openCssosShareDialog({workId,...}) (app.share-dialog.js)。谁的作品好, 谁都可分享(不限自己)。
    rail.appendChild(mkItem("📤", copy("Share", "分享"), {
      aria: copy("Share", "分享"), title: copy("Share this work", "分享这首作品"), social: true,
      onClick: function () {
        var id = robustWorkId();
        if (!id) { try { if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Loading work…", "作品加载中…")); } catch (_e) {} return; }
        try {
          if (typeof globalThis.openCssosShareDialog === "function") {
            globalThis.openCssosShareDialog({ workId: id, title: String(w.title || ""), style: String(w.style || ""), ownerName: String((currentAuthor() || {}).name || w.owner_name || "") });
            return;
          }
          if (typeof globalThis.sharePersonMv === "function") { globalThis.sharePersonMv(id); return; }
          if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Share unavailable.", "分享暂不可用。"));
        } catch (err) {
          try { if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Share failed to open", "分享打开失败")); } catch (_e) {}
          try { console.warn("[social-rail] share open failed", err); } catch (_e) {}
        }
      }
    }));

    // 3. 🎧 聆听 · 计数·¢69 — W1196: 任一方 staff → 不可买卖, 置灰
    rail.appendChild(mkItem("🎧", countPrice(st.listens, listenCents(w)), {
      disabled: _noSale, aria: copy("Listen", "聆听"),
      title: _noSale ? (_ownWork ? copy("You can't buy your own work", "自己的作品不能买卖") : copy("Staff works aren't for sale", "管理员/工作人员作品不参与买卖")) : copy("Listen (audio / slideshow)", "聆听(音频/幻灯)"),
      onClick: function (b) { dispatch("listen", b); }
    }));

    // 4. 🎞️ 观赏 · 计数/¢99(真视频, 上线前置灰) — CSSOS_WAVE_1129b 图标改胶片
    rail.appendChild(mkItem("🎞️", countPrice(st.watches, viewCents(w)), {
      disabled: true, aria: copy("Watch", "观赏"),
      title: copy("Real-video viewing — opens once full video ships", "观赏(真视频)— 真视频上线后开放")
    }));

    // 5. 💝 打赏 — W1196: staff 只能【接受】打赏(viewer 非 staff 即可给; staff 自己不可给)。
    rail.appendChild(mkItem("💝", st.tips > 0 ? (fmtMoney(st.tips_total_cents) + "/" + fmtCount(st.tips)) : ("0/" + copy("Tip", "打赏")), {
      disabled: _noTip, aria: copy("Tip the creator", "打赏作者"),
      title: _noTip ? (_ownWork ? copy("You can't tip your own work", "自己的作品不能打赏") : copy("Staff can only receive tips, not give", "管理员/工作人员只能接受打赏,不能打赏他人")) : copy("Tip the creator — any amount", "打赏作者(金额随意)"),
      onClick: function (b) { dispatch("tip", b); }
    }));

    // 6. 💎 买断 — 显示系统建议价(不是"买断"字) — CSSOS_WAVE_1167; W1196: 任一方 staff → 不可买卖, 置灰
    // CSSOS_WAVE_1258 — Jing 铁律: 买断【0/未设/管理员·staff 作品】= 【无价之宝 priceless】, 绝不是免费/0!
    //   priceless 与 0 天差地别。priceless 判定对齐 market-commerce: is_priceless || owner_is_admin || 作者是 staff。
    var _priceless = !!(w.is_priceless || w.owner_is_admin || _ownerStaff);
    var _bc = buyoutCents(w);
    var _buyoutText = _priceless
      ? copy("Priceless", "无价之宝")
      : (_bc > 0 ? fmtCents(_bc) : copy("Priceless", "无价之宝"));   // 没设价(0)也按无价之宝, 绝不显 0/免费
    rail.appendChild(mkItem("💎", _buyoutText, {
      disabled: _noSale, aria: copy("Buyout", "买断"),
      title: _noSale ? (_ownWork ? copy("You can't buy your own work", "自己的作品不能买卖") : copy("Staff works aren't for sale", "管理员/工作人员作品不参与买卖")) : copy("Buyout — system-suggested price", "买断 — 系统建议价"),
      onClick: function (b) { dispatch("buyout", b); }
    }));

    // 7. AI 助理 — CSSOS_WAVE_1128 — Jing 指令: 收回右轨底部(用右轨统一间距),
    //   隐藏旧 #cssos-agent-fab(避免"太靠近"+重复)。点击 = 打开常驻 AI 助理。
    // CSSOS_WAVE_1776 20260726 — Jing「影院里那个 🤖 也改成黑绿渐变粗体 ➕, 而且要可拖拽」:
    //   图标 🤖 → ＋(U+FF0B 全宽加号, 不用 emoji ➕ —— emoji 会被系统渲染成彩色方块,
    //   把黑绿渐变盖掉)。样式由 #cssos-rail-ai 承接(见 injectStyles), 与全局 FAB 同一套渐变。
    var aiBtn = mkItem("＋", "", {
      aria: copy("AI assistant", "AI 助理"), title: copy("AI assistant", "AI 助理"),
      onClick: function () {
        try {
          if (typeof globalThis.cssosOpenAssistantWithPrompt === "function") globalThis.cssosOpenAssistantWithPrompt("");
          else { var fab = document.getElementById("cssos-agent-fab"); if (fab) { fab.style.display = ""; fab.click(); } }
        } catch (_e) {}
      }
    });
    aiBtn.id = "cssos-rail-ai";
    rail.appendChild(aiBtn);
    makeRailAiDraggable(aiBtn);
    /* CSSOS_WAVE_1788 20260728 — Jing:「AI 助理在 MV 影院模式下无法使用右击/长按」。
     * 三种手势(单击=开面板 / 双击=惊喜 / 长按·右击=菜单)原本只绑在主界面 FAB 上,
     * 影院右轨这个按钮从来没绑过 —— 所以影院里长按右击都没反应。
     * 复用 agent-chat 暴露的同一套绑定(它自带幂等闸, 右轨反复重建也不会叠加监听),
     * 而不是在这里另写一份 —— 两份手势迟早会走样。 */
    /* 加载顺序: 本文件在 index.html 里排在 app.agent-chat.js 【前面】, 所以右轨若在
     * agent-chat 之前建好按钮, 这个全局还不存在。裸 if 会静默跳过 —— 正是本波要修的那类
     * 无声失败。改成短重试, 最多 ~2s; 绑定端自带幂等闸, 重试命中也不会叠加。 */
    (function wireWhenReady(tries) {
      try {
        if (typeof globalThis.cssosWireAiGestures === "function") {
          globalThis.cssosWireAiGestures(aiBtn);
          return;
        }
      } catch (_e) {}
      if (tries > 0) setTimeout(function () { wireWhenReady(tries - 1); }, 200);
    })(10);
  }

  /* CSSOS_WAVE_1776 20260726 — Jing「影院里的 AI 助理也要可拖拽」。
   * 与全局 FAB(app.agent-chat.js)同构, 但这里有两点不同, 不能照抄:
   *   ① 它原本是右轨(#cssos-watch-social-rail)的 flow 子元素, 不是 fixed。拖动时必须
   *      提成 position:fixed 才能离开右轨; 否则会被父容器的 flex 布局拽回去。
   *   ② 右轨会被重建(换歌/影院开关都会重渲染), 所以同样需要一道自愈安全网 ——
   *      重建出来的新按钮没有内联位置, 靠 localStorage 贴回去。 */
  /* CSSOS_WAVE_1776d 20260726 — Jing「新旧位置在抢 AI 助理, 来回跳」根治:
   * 位置改与主界面 FAB【共用同一份】(app.agent-chat.js 暴露的 cssosRead/WriteAiAssistantPos)。
   * 原因: AI 助理有两个入口元素(主界面 #cssos-agent-fab / 影院右轨 #cssos-rail-ai), 影院一开
   * 一关就换人显示。各存一份位置 → 两处各自出现在各自记住的地方 = 用户看到的"来回跳"。
   * 共用一份后, 拖任一处 = 给"AI 助理"定位, 另一处跟着走。
   * globalThis 取不到时(加载顺序异常)退回本地 key, 保证功能不因依赖缺失而崩。 */
  var RAIL_DRAG_SLOP = 4;
  var RAIL_FALLBACK_KEY = "cssos.aiAssistant.pos";

  function readAiPos() {
    if (typeof globalThis.cssosReadAiAssistantPos === "function") {
      return globalThis.cssosReadAiAssistantPos();
    }
    try {
      var p = JSON.parse(localStorage.getItem(RAIL_FALLBACK_KEY) || "null");
      return (p && typeof p.left === "number") ? p : null;
    } catch (_e) { return null; }
  }
  function writeAiPos(left, top) {
    if (typeof globalThis.cssosWriteAiAssistantPos === "function") {
      globalThis.cssosWriteAiAssistantPos(left, top);
      return;
    }
    try { localStorage.setItem(RAIL_FALLBACK_KEY, JSON.stringify({ left: left, top: top })); } catch (_e) {}
  }

  function applyRailAiPos(el, left, top) {
    var w = el.offsetWidth || 40, h = el.offsetHeight || 40;
    var L = Math.min(Math.max(0, left), Math.max(0, window.innerWidth - w));
    var T = Math.min(Math.max(0, top), Math.max(0, window.innerHeight - h));
    el.style.setProperty("position", "fixed", "important");   // ① 提出右轨的 flow
    el.style.setProperty("left", L + "px", "important");
    el.style.setProperty("top", T + "px", "important");
    el.style.setProperty("right", "auto", "important");
    el.style.setProperty("bottom", "auto", "important");
    el.style.setProperty("z-index", "10092", "important");    // 高于影院层, 拖到哪都点得到
    el.setAttribute("data-user-placed", "1");
  }

  function makeRailAiDraggable(el) {
    var saved = readAiPos();
    if (saved) applyRailAiPos(el, saved.left, saved.top);

    var sx = 0, sy = 0, bl = 0, bt = 0, moved = false, dragging = false;
    el.style.touchAction = "none";

    /* CSSOS_WAVE_1778 20260726 — Jing「AI 助理的动作不要触发别的动作」根因:
     * 影院手势(上下切歌/左右切换)监听在 body 上、右键菜单监听在 document 上, 都是【全局】的。
     * FAB 上的 pointer/touch 事件默认会【冒泡】到它们那里 —— 于是拖一下 AI 助理, 影院以为
     * 用户在滑动切歌, 右击 AI 助理弹出的是作品右键菜单。
     * 修法: 在 FAB 自己这一层把这些事件【就地拦下】(stopPropagation), 不让它们往上走。
     * 用 capture 阶段不行 —— 那只会更早触发全局监听; 必须在冒泡路径的起点吞掉。 */
    ["touchstart", "touchmove", "touchend", "mousedown", "wheel", "contextmenu"].forEach(function (ev) {
      el.addEventListener(ev, function (e) {
        e.stopPropagation();
        // contextmenu 额外阻止默认 —— 否则浏览器/影院的右键菜单照样弹。
        // (长按/右击的自有行为在下面的 pointer 逻辑里实现, 见 W1778 设计。)
        if (ev === "contextmenu") e.preventDefault();
      }, false);
    });

    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.stopPropagation();          // 不让影院手势层看到这次按下
      var r = el.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; bl = r.left; bt = r.top;
      moved = false; dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch (_e) {}
    });
    el.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < RAIL_DRAG_SLOP) return;
      if (!moved) { moved = true; el.setAttribute("data-dragging", "1"); }
      e.preventDefault();
      applyRailAiPos(el, bl + dx, bt + dy);
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      el.removeAttribute("data-dragging");
      try { el.releasePointerCapture(e.pointerId); } catch (_e) {}
      if (moved) {
        var r = el.getBoundingClientRect();
        /* CSSOS_WAVE_1781 20260726 — Jing「MV 面板里, AI 助手拖到右下角附近没有自动吸附」。
         * 上一波(W1778)只给主界面 FAB 加了吸附, 漏了影院右轨这个入口 —— 两处必须一致。
         * 吸附 = 清掉记住的坐标并抹掉内联定位, 让它回落右轨自己的 flow 位置(而不是硬存坐标),
         * 这样窗口尺寸变化时仍跟着右轨走。阈值 90px 与主界面 FAB 保持同一个数。 */
        var toRight = window.innerWidth - r.right;
        var toBottom = window.innerHeight - r.bottom;
        if (toRight < 90 && toBottom < 90) {
          if (typeof globalThis.cssosClearAiAssistantPos === "function") {
            globalThis.cssosClearAiAssistantPos();
          } else {
            try { localStorage.removeItem(RAIL_FALLBACK_KEY); } catch (_e2) {}
          }
          ["position", "left", "top", "right", "bottom", "z-index"].forEach(function (p) {
            el.style.removeProperty(p);
          });
          el.removeAttribute("data-user-placed");
        } else {
          writeAiPos(r.left, r.top);   // 共享 → 主界面那个 FAB 也会跟着走
        }
      }
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    // 真拖过就吞掉这次 click, 不要顺带打开助理面板。
    el.addEventListener("click", function (e) {
      if (moved) { e.preventDefault(); e.stopImmediatePropagation(); moved = false; }
    }, true);
  }

  // ② 右轨重建后自愈: 新按钮没有内联位置 → 从 localStorage 贴回去。2s 慢网, 开销可忽略。
  function startRailAiSelfHeal() {
    setInterval(function () {
      try {
        var el = document.getElementById("cssos-rail-ai");
        if (!el || el.style.left) return;
        var p = readAiPos();
        if (p) applyRailAiPos(el, p.left, p.top);
      } catch (_e) {}
    }, 2000);
  }

  // CSSOS_WAVE_1124 — Jing 指令④: 10 秒无操作淡出【返回 / 搜索框 / 多语言】; 右轨图标/传统字幕/AI 常驻。
  //   用 opacity 淡出(不 display:none, 避免布局跳)。任何交互即恢复 + 重置计时。
  var _idleTimer = null;
  var IDLE_HIDE_IDS = ["cssos-watch-backbtn", "watch-search-box", "cssos-lang-fold"];
  function setChromeHidden(hidden) {
    IDLE_HIDE_IDS.forEach(function (id) {
      var e = document.getElementById(id); if (!e) return;
      e.style.transition = "opacity .45s ease";
      e.style.opacity = hidden ? "0" : "1";
      e.style.pointerEvents = hidden ? "none" : "auto";
    });
  }
  function bumpIdle() {
    setChromeHidden(false);
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(function () { if (watchOpen()) setChromeHidden(true); }, 10000);
  }
  globalThis.cssosWatchChromeBump = bumpIdle;

  var raf = false;
  function schedule() { if (raf) return; raf = true; requestAnimationFrame(function () { raf = false; try { render(); if (watchOpen() && !_idleTimer) bumpIdle(); } catch (e) { console.warn("[social-rail]", e); } }); }
  globalThis.cssosRenderSocialRail = schedule;

  function start() {
    schedule();
    startRailAiSelfHeal();   // W1776 — 右轨重建后把用户拖过的 AI 位置贴回去
    // CSSOS_WAVE_1134 — Jing 指令: 停止每 2.5s 全量重渲染(耗内存 DOM churn + 头像被反复 detach)。
    //   改【纯事件驱动】: 只在真有变化时渲染(换歌/换 workId/作者解析好/面板开关/全屏切换)。
    ["mousemove", "pointerdown", "touchstart", "keydown", "wheel"].forEach(function (ev) {
      document.addEventListener(ev, function () { if (watchOpen()) bumpIdle(); }, { passive: true });
    });
    ["cssos:work-changed", "cssos:work-id-changed", "cssos:playlist-advance",
     "cssos:open-watch-for-run", "cssos:cinema-toggle", "fullscreenchange",
     "cssos:author-info-changed",                          // W1132 — 作者头像解析好后重渲染
     "cssos:panelopen", "cssos:panelclose"].forEach(function (ev) {   // W1134 — 面板开关时更新显隐
      document.addEventListener(ev, schedule);
      window.addEventListener(ev, schedule);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
