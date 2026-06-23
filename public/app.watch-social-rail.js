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
          _stats[id] = { listens: Number(d.listens || 0), watches: Number(d.watches || 0), tips: Number(d.tips || 0), tips_total_cents: Number(d.tips_total_cents || 0), comments: Number(d.comments || 0) };
          schedule();   // 拿到数 → 重渲染带上计数
        }).catch(function () {});
    } catch (_e) {}
  }
  function statsFor(id) { return _stats[id] || { listens: 0, watches: 0, tips: 0, tips_total_cents: 0, comments: 0 }; }
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
  function listenCents(w) { return Number((w && (w.current_listen_price_cents || w.listen_price_cents || w.suggested_listen_price_cents)) || 69); }
  function viewCents(w) { return Number((w && (w.current_view_price_cents || w.view_price_cents)) || 99); }

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
      "#cssos-agent-fab{display:none !important;}" +
      // 右轨现含 AI(7 项), bottom 下移到 20px, 让 🤖 落在右下角(旧 FAB 位置), 全轨用统一 9px 间距。
      "#cssos-watch-social-rail{position:absolute;right:14px;bottom:20px;" +
      "z-index:30;display:flex;flex-direction:column;align-items:center;gap:9px;pointer-events:none;}" +
      "#cssos-watch-social-rail>*{pointer-events:auto;}" +
      ".csr-item{display:flex;flex-direction:column;align-items:center;gap:1px;background:transparent;border:0;padding:0;cursor:pointer;}" +
      ".csr-ic{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.12);display:flex;align-items:center;" +
      "justify-content:center;font-size:21px;line-height:1;color:#fff;transition:transform .15s ease;}" +
      ".csr-item:active .csr-ic{transform:scale(0.92);}" +
      ".csr-item[disabled]{cursor:default;opacity:0.55;}" +
      ".csr-lbl{font-size:11px;color:#e6ddd2;text-shadow:0 1px 3px rgba(0,0,0,0.6);white-space:nowrap;}" +
      ".csr-ic.is-comment{background:rgba(0,245,160,0.18);box-shadow:inset 0 0 0 1.5px #00f5a0;color:#00f5a0;}" +
      ".csr-ic.is-ai{background:#1c2b3a;box-shadow:inset 0 0 0 1px #2e4a63;color:#7fd4ff;}" +
      ".csr-av{position:relative;width:46px;height:46px;border-radius:50%;background:#2a6cf0;display:flex;align-items:center;" +
      "justify-content:center;font-weight:500;font-size:15px;color:#fff;overflow:visible;}" +
      ".csr-av img{width:100%;height:100%;border-radius:50%;object-fit:cover;}" +
      ".csr-av .csr-follow{position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:17px;height:17px;" +
      "border-radius:50%;background:#00f5a0;color:#04241a;font-size:12px;display:flex;align-items:center;justify-content:center;}" +
      // CSSOS_WAVE_1119 — 左上返回键(成熟模式): 退出影院。点它=触发现成 watch-panel 关闭按钮。
      "#cssos-watch-backbtn{position:absolute;left:12px;top:12px;z-index:31;width:40px;height:40px;border-radius:50%;" +
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
    var id = workId();
    if (!id) { try { if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Loading work…", "作品加载中…")); } catch (_e) {} return; }
    try {
      if (typeof globalThis.dispatchMarketWorkPayment === "function") globalThis.dispatchMarketWorkPayment(id, kind, btn);
    } catch (e) { console.warn("[social-rail] dispatch " + kind, e); }
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
    if (!watchOpen()) { var r0 = document.getElementById("cssos-watch-social-rail"); if (r0) r0.style.display = "none"; return; }
    var rail = buildRail();
    if (!rail) return;
    rail.style.display = "flex";
    var w = currentWork() || {};
    var id0 = workId();
    fetchStats(id0);
    var st = statsFor(id0);
    rail.textContent = "";

    // 1. 作者头像 + 关注
    var av = document.createElement("button");
    av.type = "button"; av.className = "csr-av";
    av.setAttribute("aria-label", copy("Creator", "作者"));
    // CSSOS_WAVE_1132 — Jing 指令: 用 watch-ui【已正确解析】的作者信息(作品作者头像→回退登录账户头像),
    //   不再自己从 currentWork 瞎猜(owner_avatar_url 常空 → 之前总显首字母)。
    var ai = globalThis.__cssosWatchAuthorInfo || {};
    var avatarUrl = String(ai.ownerAvatar || w.owner_avatar_url || w.avatar_url || "").trim();
    var nameForInitial = String(ai.ownerName || w.owner_display_name || w.title || "C").trim();
    if (avatarUrl) { var im = document.createElement("img"); im.src = avatarUrl; im.alt = ""; av.appendChild(im); }
    else { av.textContent = nameForInitial.charAt(0).toUpperCase() || "C"; }
    var fol = document.createElement("span"); fol.className = "csr-follow"; fol.textContent = "+"; av.appendChild(fol);
    // CSSOS_WAVE_1130 — Jing 指令: 点头像弹【原来左上角那套作者菜单】(关注/只播TA/作品中心/屏蔽/赠礼,
    //   含带图标的用户名)。右轨头像只是 TikTok 风格的新位置 + ➕关注视觉, 菜单复用 watch-ui 的 openMenu。
    av.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        if (typeof globalThis.cssosOpenWatchAuthorMenu === "function") { globalThis.cssosOpenWatchAuthorMenu(av); return; }
        var uid = String(w.owner_user_id || "").trim();
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
        var id = workId(); if (!id) return;
        try {
          if (typeof globalThis.openPersonMvComments === "function") globalThis.openPersonMvComments(id);
          else if (typeof globalThis.showToast === "function") globalThis.showToast(copy("Comments unavailable", "评论暂不可用"));
        } catch (_e) {}
      }
    }));

    // 3. 🎧 聆听 · 计数·¢69
    rail.appendChild(mkItem("🎧", countPrice(st.listens, listenCents(w)), {
      aria: copy("Listen", "聆听"), title: copy("Listen (audio / slideshow)", "聆听(音频/幻灯)"),
      onClick: function (b) { dispatch("listen", b); }
    }));

    // 4. 🎞️ 观赏 · 计数/¢99(真视频, 上线前置灰) — CSSOS_WAVE_1129b 图标改胶片
    rail.appendChild(mkItem("🎞️", countPrice(st.watches, viewCents(w)), {
      disabled: true, aria: copy("Watch", "观赏"),
      title: copy("Real-video viewing — opens once full video ships", "观赏(真视频)— 真视频上线后开放")
    }));

    // 5. 💝 打赏 — CSSOS_WAVE_1129c — Jing 指令: 无打赏显 "0/Tip"; 有打赏显 "总额/次数"(如 $58/9)。
    rail.appendChild(mkItem("💝", st.tips > 0 ? (fmtMoney(st.tips_total_cents) + "/" + fmtCount(st.tips)) : ("0/" + copy("Tip", "打赏")), {
      aria: copy("Tip the creator", "打赏作者"), title: copy("Tip the creator — any amount", "打赏作者(金额随意)"),
      onClick: function (b) { dispatch("tip", b); }
    }));

    // 6. 💎 买断 — 直接写"买断" — CSSOS_WAVE_1128
    rail.appendChild(mkItem("💎", copy("Buyout", "买断"), {
      aria: copy("Buyout", "买断"), title: copy("Buyout — system-suggested price", "买断 — 系统建议价"),
      onClick: function (b) { dispatch("buyout", b); }
    }));

    // 7. 🤖 AI 助理 — CSSOS_WAVE_1128 — Jing 指令: 换小机器人收回右轨底部(用右轨统一间距),
    //   隐藏旧 #cssos-agent-fab(避免"太靠近"+重复)。点击 = 打开常驻 AI 助理。
    rail.appendChild(mkItem("🤖", "", {
      aria: copy("AI assistant", "AI 助理"), title: copy("AI assistant", "AI 助理"),
      onClick: function () {
        try {
          if (typeof globalThis.cssosOpenAssistantWithPrompt === "function") globalThis.cssosOpenAssistantWithPrompt("");
          else { var fab = document.getElementById("cssos-agent-fab"); if (fab) { fab.style.display = ""; fab.click(); } }
        } catch (_e) {}
      }
    }));
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
