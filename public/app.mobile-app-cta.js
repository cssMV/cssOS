// W1599 — 移动端「下载 App」引导浮层(仿 Suno 的 "better on the app" 底部 sheet)。
//   目标: iPhone/iPad 网页访客 → 引导去 App Store 安装原生 App。
//   规则:
//     • 仅苹果移动设备(iPhone/iPad/iPod, 含 iPadOS 桌面 UA)显示;
//     • 在原生壳(Capacitor)里不显示 —— 已经在 App 里了;
//     • 关闭用 sessionStorage: 本次浏览器会话内不再弹, 关掉浏览器/标签后
//       下次再进平台重新出现(与首页庆祝 ribbon 行为一致, 故意不永久 dismiss);
//     • 文案走 loginCopy/tr, 英文为准。
//   App Store: cssOS · Apple ID 6768848996 · app.cssstudio.studio (Jing Du)。
(function () {
  "use strict";

  // 全平台共用同一个 App Store 商品页(通用链接会自动跳到访客所在国家商店)。
  // 也挂到 globalThis 供未来 Dock「App」面板 / 二维码复用。
  var APP_STORE_URL = "https://apps.apple.com/app/id6768848996";
  try { globalThis.CSSOS_APP_STORE_URL = APP_STORE_URL; } catch (_e) {}

  var KEY = "cssos_mobile_app_cta_dismissed_session";

  function lc(en, zh) {
    try { return (typeof globalThis.loginCopy === "function") ? globalThis.loginCopy(en, zh) : en; }
    catch (_e) { return en; }
  }
  function dismissed() { try { return sessionStorage.getItem(KEY) === "1"; } catch (_e) { return false; } }

  // 在原生 App 壳里 → 不弹。
  function inNativeApp() {
    try {
      var cap = globalThis.Capacitor;
      if (cap && (typeof cap.isNativePlatform === "function" ? cap.isNativePlatform() : cap.isNative)) return true;
    } catch (_e) {}
    return false;
  }

  // 仅苹果移动设备(iPhone/iPad/iPod)。iPadOS 13+ 桌面 UA 用 maxTouchPoints 兜底。
  function isAppleMobile() {
    try {
      var ua = navigator.userAgent || "";
      if (/iPhone|iPad|iPod/.test(ua)) return true;
      if (/Macintosh/.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1) return true; // iPadOS
    } catch (_e) {}
    return false;
  }

  function injectStyles() {
    if (document.getElementById("cssos-mobile-app-cta-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-mobile-app-cta-style";
    st.textContent = [
      "#cssos-mobile-app-cta{position:fixed;left:0;right:0;bottom:0;z-index:40;",
      "  display:flex;justify-content:center;pointer-events:none;",
      "  padding:0 12px calc(12px + env(safe-area-inset-bottom)) 12px;}",
      "#cssos-mobile-app-cta .cta-card{pointer-events:auto;width:100%;max-width:520px;box-sizing:border-box;",
      "  background:linear-gradient(135deg,#0c9d70,#0a7f5c);color:#fff;",
      "  border:1px solid rgba(0,245,160,0.55);border-radius:18px;",
      "  box-shadow:0 10px 34px rgba(0,0,0,0.42);",
      "  padding:14px 16px;font:600 14px/1.35 -apple-system,system-ui,sans-serif;",
      "  transform:translateY(0);animation:cssosCtaUp .34s cubic-bezier(.2,.8,.2,1);}",
      "@keyframes cssosCtaUp{from{transform:translateY(120%);opacity:.2}to{transform:translateY(0);opacity:1}}",
      "#cssos-mobile-app-cta .cta-title{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;",
      "  margin-bottom:10px;text-shadow:0 1px 2px rgba(0,0,0,0.28);}",
      "#cssos-mobile-app-cta .cta-row{display:flex;align-items:center;justify-content:space-between;gap:12px;",
      "  padding:8px 0;}",
      "#cssos-mobile-app-cta .cta-row + .cta-row{border-top:1px solid rgba(255,255,255,0.16);}",
      "#cssos-mobile-app-cta .cta-label{display:flex;flex-direction:column;min-width:0;}",
      "#cssos-mobile-app-cta .cta-label b{font-weight:800;}",
      "#cssos-mobile-app-cta .cta-label span{font-weight:600;opacity:.85;font-size:12px;}",
      "#cssos-mobile-app-cta a.cta-get,#cssos-mobile-app-cta button.cta-continue{",
      "  flex:0 0 auto;border-radius:999px;padding:9px 20px;font:800 14px/1 -apple-system,system-ui,sans-serif;",
      "  cursor:pointer;text-decoration:none;white-space:nowrap;}",
      "#cssos-mobile-app-cta a.cta-get{background:#fff;color:#0a7f5c;border:0;",
      "  box-shadow:0 2px 10px rgba(0,0,0,0.22);}",
      "#cssos-mobile-app-cta a.cta-get:active{transform:scale(.97);}",
      "#cssos-mobile-app-cta button.cta-continue{background:transparent;color:#fff;",
      "  border:1px solid rgba(255,255,255,0.55);font-weight:700;}",
      "#cssos-mobile-app-cta button.cta-continue:active{transform:scale(.97);}"
    ].join("");
    document.head.appendChild(st);
  }

  function mount() {
    if (dismissed()) return;
    if (inNativeApp()) return;
    if (!isAppleMobile()) return;
    if (document.getElementById("cssos-mobile-app-cta")) return;
    var host = document.body;
    if (!host) return;

    injectStyles();

    var wrap = document.createElement("div");
    wrap.id = "cssos-mobile-app-cta";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", lc("Get the CSS Studio app", "获取 CSS Studio App"));

    var card = document.createElement("div");
    card.className = "cta-card";
    card.innerHTML =
      '<div class="cta-title">🎬 <span>' +
        lc("CSS Studio is better on the app", "在 App 里体验更佳") +
      '</span></div>' +
      '<div class="cta-row">' +
        '<div class="cta-label"><b>' + lc("CSS Studio App", "CSS Studio App") + '</b>' +
          '<span>' + lc("iPhone · iPad · Watch · TV · Vision Pro", "iPhone · iPad · Watch · TV · Vision Pro") + '</span></div>' +
        '<a class="cta-get" href="' + APP_STORE_URL + '" target="_blank" rel="noopener">' +
          lc("Get the App", "获取 App") + '</a>' +
      '</div>' +
      '<div class="cta-row">' +
        '<div class="cta-label"><b>' + lc("Web Browser", "网页浏览器") + '</b></div>' +
        '<button type="button" class="cta-continue">' + lc("Continue", "继续") + '</button>' +
      '</div>';

    wrap.appendChild(card);
    host.appendChild(wrap);

    // W1603 — 抬到 Dock 之上, 留出话筒/Dock 高度(参照面板, 别和 Dock 打架)。
    //   动态量 Dock 实际高度; 仅当 Dock 停靠在底部时上移, 侧/顶停靠则贴底。
    function positionAboveDock() {
      var offset = 12;
      var dock = document.querySelector(".dock") || document.querySelector("#dock");
      if (dock) {
        var r = dock.getBoundingClientRect();
        // W1672 — 底部停靠判定放宽到 -60: 刘海机 home-indicator 安全区(~34px)会把 Dock 的
        //   r.bottom 顶到 innerHeight-34, 原 -12 阈值判不到 → 卡片回落 bottom:12 正好压在 Dock 上。
        if (r.height > 0 && r.bottom >= window.innerHeight - 60 && r.height <= window.innerHeight * 0.42) {
          offset = Math.round(window.innerHeight - r.top) + 16; // 清掉整条 Dock(含话筒上探)+ 间距(+一点点)
        }
      }
      wrap.style.bottom = offset + "px";
      wrap.style.paddingBottom = "0";
    }
    positionAboveDock();
    setTimeout(positionAboveDock, 700);   // Dock 可能晚于 sheet 挂载
    window.addEventListener("resize", positionAboveDock);
    window.addEventListener("orientationchange", positionAboveDock);

    function close() {
      try { sessionStorage.setItem(KEY, "1"); } catch (_e) {}
      try { wrap.remove(); } catch (_e2) {}
    }
    var cont = card.querySelector("button.cta-continue");
    if (cont) cont.addEventListener("click", close);
    // 点了「Get the App」也视为本次会话已引导过, 不再弹。
    var get = card.querySelector("a.cta-get");
    if (get) get.addEventListener("click", function () { try { sessionStorage.setItem(KEY, "1"); } catch (_e) {} });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
