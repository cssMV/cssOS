// W1600 — Dock「📱 App」下载中心。苹果生态 5 大平台, 每个平台一张卡:
//   平台名 + App 名 + 二维码 + 直达下载链接。扫码在对应设备上装原生 App。
//   iPhone/iPad 共用 cssOS(通用 App); Watch/TV 各自独立商品页; Vision 暂未
//   上架 → 占位「Coming this week」, 一旦上架填入 id 即直达。
//   独立模块: 加一个 Dock 项 + 一个居中弹层(仿 share-dialog 模式, 非可拖面板)。
//   文案走 loginCopy/tr, 英文为准。App id 反查自 iTunes lookup(bundle → id)。
(function () {
  "use strict";

  // 苹果生态 App Store 商品页(通用链接自动跳到访客所在国家商店)。
  var STORE = {
    iphone:  "https://apps.apple.com/app/id6768848996", // cssOS  (app.cssstudio.studio)
    ipad:    "https://apps.apple.com/app/id6768848996", // cssOS  (同一通用 App)
    watch:   "https://apps.apple.com/app/id6784837589", // cssWatch (app.cssstudio.watch)
    tv:      "https://apps.apple.com/app/id6784525214", // cssTV  (CSSStudio.cssTV)
    vision:  "https://apps.apple.com/app/id6788245715", // cssVision (app.cssstudio.vision) — 已过审, 店面页传播中
    mac:     "https://apps.apple.com/app/id6768848996"  // cssOS on Mac (Designed for iPad, Apple Silicon)
  };
  try { globalThis.CSSOS_APP_STORE = STORE; } catch (_e) {}

  // 内联 SVG 平台图标(currentColor 继承色)。第一张卡 = Apple logo(iPhone/iPad
  //   合并的通用 App); 其余用各平台的现代线条图标 —— 不用过时 emoji(旧电视机等)。
  // W1621 — Jing: 取消手绘 SVG, 改用【苹果官方 Apple logo 字形】(U+F8FF, Safari/macOS/iOS 系统字体原生渲染成 )。
  //   苹果官方【逐设备】图标是 SF Symbols(系统字体、非网页素材), 网页无法可靠内联; 故统一用官方 Apple 标,
  //   各卡靠平台名(iPhone & iPad / Apple Watch / Apple TV / Vision Pro)区分。
  var APPLE = '';
  // W1622 — 六卡 3 对对称: iPhone · iPad │ Watch · TV │ Vision · Mac。全真二维码。
  //   iPhone/iPad/Mac 同一通用 App(cssOS, id6768848996) —— 三设备各一张卡, 扫码在
  //   各自设备直达(iPhone→iPhone App, iPad→iPad, Mac→Mac App Store 的「为 iPad 设计」)。
  var PLATFORMS = [
    { key: "iphone", icon: APPLE, plat: "iPhone",      app: "cssOS",     url: STORE.iphone },
    { key: "ipad",   icon: APPLE, plat: "iPad",        app: "cssOS",     url: STORE.ipad },
    { key: "watch",  icon: APPLE, plat: "Apple Watch", app: "cssWatch",  url: STORE.watch },
    { key: "tv",     icon: APPLE, plat: "Apple TV",    app: "cssTV",     url: STORE.tv },
    { key: "vision", icon: APPLE, plat: "Vision Pro",  app: "cssVision", url: STORE.vision },
    { key: "mac",    icon: APPLE, plat: "Mac",         app: "cssOS",     url: STORE.mac }
  ];

  function lc(en, zh) {
    try { return (typeof globalThis.loginCopy === "function") ? globalThis.loginCopy(en, zh) : en; }
    catch (_e) { return en; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function qrUrl(text, size) {
    var s = size || 180;
    return "https://api.qrserver.com/v1/create-qr-code/?size=" + s + "x" + s +
           "&margin=8&data=" + encodeURIComponent(text);
  }

  function injectStyles() {
    if (document.getElementById("cssos-appstore-panel-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-appstore-panel-style";
    st.textContent = [
      "#cssos-appstore-overlay{position:fixed;inset:0;z-index:2147482000;display:flex;",
      "  align-items:center;justify-content:center;padding:20px;",
      "  background:rgba(4,14,10,0.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);",
      "  animation:cssosAsFade .2s ease;}",
      "@keyframes cssosAsFade{from{opacity:0}to{opacity:1}}",
      "#cssos-appstore-overlay .as-card{position:relative;width:100%;max-width:1020px;max-height:92vh;overflow:auto;",
      "  box-sizing:border-box;border-radius:22px;padding:22px 22px 20px;",
      "  background:linear-gradient(160deg,#0e2a20,#0a1a14);color:#eafff6;",
      "  border:1px solid rgba(0,245,160,0.34);box-shadow:0 24px 70px rgba(0,0,0,0.55);",
      "  animation:cssosAsPop .26s cubic-bezier(.2,.8,.2,1);}",
      "@keyframes cssosAsPop{from{transform:translateY(14px) scale(.98);opacity:.4}to{transform:none;opacity:1}}",
      "#cssos-appstore-overlay .as-x{position:absolute;top:12px;right:14px;border:0;background:transparent;",
      "  color:#bff5e0;font-size:24px;line-height:1;cursor:pointer;opacity:.75;padding:2px 6px;}",
      "#cssos-appstore-overlay .as-x:hover{opacity:1;}",
      "#cssos-appstore-overlay .as-title{font:800 20px/1.25 -apple-system,system-ui,sans-serif;",
      "  display:flex;align-items:center;gap:9px;margin:0 30px 4px 2px;}",
      "#cssos-appstore-overlay .as-sub{font:600 13px/1.4 -apple-system,system-ui,sans-serif;",
      "  opacity:.82;margin:0 0 18px 2px;}",
      "#cssos-appstore-overlay .as-grid{display:grid;gap:14px;grid-template-columns:repeat(3,1fr);}",   // W1631 — 3 列 × 2 行, 6 卡一屏完整显示
      "@media(max-width:780px){#cssos-appstore-overlay .as-grid{grid-template-columns:repeat(2,1fr);}}",
      "@media(max-width:480px){#cssos-appstore-overlay .as-grid{grid-template-columns:1fr;}}",
      "#cssos-appstore-overlay .as-item{display:flex;flex-direction:column;align-items:center;text-align:center;",
      "  gap:8px;padding:18px 12px 16px;border-radius:16px;",
      "  background:rgba(0,245,160,0.06);border:1px solid rgba(0,245,160,0.20);}",
      "#cssos-appstore-overlay .as-item .as-plat{font:800 15px/1.2 -apple-system,system-ui,sans-serif;",
      "  display:flex;align-items:center;gap:7px;}",
      "#cssos-appstore-overlay .as-ico{display:inline-flex;align-items:center;justify-content:center;color:#8fead0;font-family:-apple-system,'SF Pro Display','SF Pro Text',system-ui,sans-serif;font-size:22px;line-height:1;}",
      "#cssos-appstore-overlay .as-item .as-ico{width:30px;height:30px;}",
      "#cssos-appstore-overlay .as-dev{width:30px;height:30px;object-fit:contain;display:block;}",
      "#cssos-appstore-overlay .as-title .as-ico{font-size:20px;color:#a9f5d6;}",
      "#cssos-appstore-overlay .as-item .as-app{font:600 12px/1.2 -apple-system,system-ui,sans-serif;opacity:.72;}",
      "#cssos-appstore-overlay .as-qr{width:150px;height:150px;border-radius:12px;background:#fff;",
      "  padding:8px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;}",
      "#cssos-appstore-overlay .as-qr img{width:100%;height:100%;display:block;}",
      "#cssos-appstore-overlay .as-qr.as-soon{background:rgba(255,255,255,0.06);color:#bff5e0;",
      "  border:1px dashed rgba(0,245,160,0.4);font:700 12px/1.35 -apple-system,system-ui,sans-serif;",
      "  text-align:center;padding:14px;}",
      "#cssos-appstore-overlay a.as-get{margin-top:2px;text-decoration:none;border-radius:999px;",
      "  padding:8px 20px;background:#fff;color:#0a7f5c;font:800 13px/1 -apple-system,system-ui,sans-serif;",
      "  box-shadow:0 2px 10px rgba(0,0,0,0.25);}",
      "#cssos-appstore-overlay a.as-get:active{transform:scale(.97);}",
      "#cssos-appstore-overlay .as-soon-tag{margin-top:2px;border-radius:999px;padding:8px 18px;",
      "  background:transparent;border:1px solid rgba(0,245,160,0.4);color:#bff5e0;",
      "  font:700 12px/1 -apple-system,system-ui,sans-serif;}",
      "#cssos-appstore-overlay .as-share-btn{margin:18px auto 0;display:flex;align-items:center;justify-content:center;gap:8px;",
      "  width:100%;max-width:360px;height:46px;border:0;border-radius:999px;cursor:pointer;",
      "  background:linear-gradient(135deg,#00f5a0,#00c884);color:#052018;font:800 14px/1 -apple-system,system-ui,sans-serif;",
      "  box-shadow:0 6px 20px rgba(0,245,160,0.28);transition:transform .12s ease,box-shadow .12s ease;}",
      "#cssos-appstore-overlay .as-share-btn:hover{box-shadow:0 8px 26px rgba(0,245,160,0.4);}",
      "#cssos-appstore-overlay .as-share-btn:active{transform:scale(.97);}",
      "#cssos-appstore-overlay .as-foot{margin:14px 2px 0;font:600 12px/1.45 -apple-system,system-ui,sans-serif;",
      "  opacity:.7;text-align:center;}"
    ].join("");
    document.head.appendChild(st);
  }

  function itemHtml(p) {
    // W1623 — per-device official SF Symbol icons (iphone/ipad/macbook/applewatch/
    //   appletv/visionpro), rendered to brand-green PNGs in public/icons/dev-*.png.
    var head = '<div class="as-plat"><span class="as-ico"><img class="as-dev" src="icons/dev-' + esc(p.key) + '.png?v=1" alt="" aria-hidden="true" loading="lazy"></span><span>' + esc(p.plat) + '</span></div>' +
               '<div class="as-app">' + esc(p.app) + '</div>';
    if (p.url) {
      return '<div class="as-item">' + head +
        '<div class="as-qr"><img loading="lazy" alt="' + esc(p.app) + ' QR" src="' + esc(qrUrl(p.url, 150)) + '"></div>' +
        '<a class="as-get" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(lc("Download", "下载")) + '</a>' +
      '</div>';
    }
    // 未上架 → 占位
    return '<div class="as-item">' + head +
      '<div class="as-qr as-soon">' + esc(lc("Coming this week", "本周上线")) + '</div>' +
      '<span class="as-soon-tag">' + esc(lc("Coming soon", "即将上线")) + '</span>' +
    '</div>';
  }

  function close() {
    var o = document.getElementById("cssos-appstore-overlay");
    if (o) { try { o.remove(); } catch (_e) {} }
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function open() {
    if (document.getElementById("cssos-appstore-overlay")) return;
    injectStyles();
    var overlay = document.createElement("div");
    overlay.id = "cssos-appstore-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", lc("Download CSS Studio apps", "下载 CSS Studio App"));

    var rows = PLATFORMS.map(itemHtml).join("");
    overlay.innerHTML =
      '<div class="as-card">' +
        '<button type="button" class="as-x" aria-label="' + esc(lc("Close", "关闭")) + '">×</button>' +
        '<div class="as-title"><span>' + esc(lc("Get CSS Studio across Apple", "在苹果全平台获取 CSS Studio")) + '</span></div>' +
        '<div class="as-sub">' + esc(lc(
          "Scan on the device you want — every Apple platform, each a direct download.",
          "用对应设备扫码 —— 苹果每个平台都覆盖, 各自直达下载。")) + '</div>' +
        '<div class="as-grid">' + rows + '</div>' +
        '<button type="button" class="as-share-btn">🔗 ' + esc(lc("Share all download links", "分享全平台下载链接")) + '</button>' +
        '<div class="as-foot">' + esc(lc(
          "iPhone, iPad & Mac share one universal app (cssOS).",
          "iPhone、iPad 与 Mac 共用同一个通用 App(cssOS)。")) + '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    var x = overlay.querySelector(".as-x");
    if (x) x.addEventListener("click", close);
    var sh = overlay.querySelector(".as-share-btn");
    if (sh) sh.addEventListener("click", shareApps);
    document.addEventListener("keydown", onKey);
  }

  // W1630 — 分享全平台下载: 复用平台社交分享弹窗(openCssosShareDialog), 文案带 6 平台
  //   下载地址(iPhone/iPad/Mac 同一通用 App → 合一行; Watch/TV/Vision 各自)。降级: 原生
  //   分享 → 复制到剪贴板。
  function shareApps() {
    var text =
      lc("📱 CSS Studio is now on every Apple device — watch + create AI music videos, with sound.",
         "📱 CSS Studio 已登陆全部苹果设备 —— 看 + 创作 AI 音乐视频, 有声音。") + "\n\n" +
      "iPhone · iPad · Mac → " + STORE.iphone + "\n" +
      "Apple Watch → " + STORE.watch + "\n" +
      "Apple TV → " + STORE.tv + "\n" +
      "Vision Pro → " + STORE.vision + "\n\n" +
      "All 6, one page → https://cssstudio.app/apps";
    var url = "https://cssstudio.app/apps";   // W1633 — 分享指向专门落地页, 截断也永远打得开完整下载
    try {
      if (typeof globalThis.openCssosShareDialog === "function") {
        globalThis.openCssosShareDialog({ url: url, text: text, title: lc("Get CSS Studio across Apple", "在苹果全平台获取 CSS Studio") });
        return;
      }
    } catch (_e) {}
    try {
      if (navigator.share) { navigator.share({ title: "CSS Studio", text: text, url: url }).catch(function () {}); return; }
    } catch (_e2) {}
    try { navigator.clipboard.writeText(text + "\n" + url); } catch (_e3) {}
  }
  try { globalThis.cssosOpenAppStorePanel = open; } catch (_e) {}

  /* ── Dock 入口: 📱 App ─────────────────────────────────────────────── */
  function registerDockAction() {
    try {
      var map = window.__cssosDockActionMap = window.__cssosDockActionMap || {};
      map["appstore"] = function () { open(); };
      window.dockActionMap = window.__cssosDockActionMap;
    } catch (_e) {}
  }
  function mountDockItem(force) {
    var dock = document.querySelector(".dock") || document.querySelector("#dock");
    if (!dock) return false;
    if (dock.querySelector('[data-action="appstore"]')) return true;
    // W1624 — App 必须紧跟【数字演员市场】(data-action="actors") 之后。
    //   之前兜底到 director 会造成竞态: actors 尚未挂载时 App 插到 director 之后,
    //   结果 App 夹在 开拍 与 数字演员 之间。现在: actors 在 → 插其后; 不在 → 返回
    //   false 让 ensureDockItem 重试等它; 仅所有重试耗尽(force)才追加兜底。
    var actors = dock.querySelector('[data-action="actors"]');
    if (!actors && !force) return false;
    // W1733 — 顺序 数字演员 → 导演入口 → App: 优先锚定在 director 之后, 无 director 再退回 actors 之后。
    var director = dock.querySelector('[data-action="director"]');
    var anchor = director || actors;
    var item = document.createElement("button");
    item.className = "dock-item"; item.type = "button";
    item.setAttribute("data-action", "appstore");
    item.setAttribute("data-actions", "click");
    item.setAttribute("data-tooltip", lc("Get the App", "获取 App"));
    item.setAttribute("aria-label", lc("Get the App", "获取 App"));
    item.innerHTML = '<span class="dock-ico" aria-hidden="true">📱</span><span class="dock-label">' +
      esc(lc("App", "App")) + '</span>';
    if (anchor) {
      dock.insertBefore(item, anchor.nextSibling);   // 紧跟 导演入口(无则数字演员)之后
    } else {
      dock.appendChild(item);                          // force 兜底: 锚点始终未出现
    }
    item.addEventListener("click", function () { open(); });
    return true;
  }
  function ensureDockItem(retries) {
    if (mountDockItem(retries <= 0)) return;   // 最后一次(retries<=0)强制挂载, 免得永不出现
    if (retries <= 0) return;
    setTimeout(function () { ensureDockItem(retries - 1); }, 400);
  }

  registerDockAction();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { ensureDockItem(20); });
  } else {
    ensureDockItem(20);
  }
})();
