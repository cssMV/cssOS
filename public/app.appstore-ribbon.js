// W1594 — App Store 全平台上架庆祝 ribbon(首页顶部, 可关闭, i18n)。
//   独立模块, 固定在页顶居中一条, 不碰现有布局。默认英文, 走 loginCopy/tr。
//   W1596 — 关闭改用 sessionStorage(而非 localStorage): 关闭只在【本次
//   浏览器会话】内不再显示(同会话刷新仍隐藏); 关掉浏览器/标签后 session
//   清空, 下次再进平台横幅重新出现。故意不做永久 dismiss。
(function () {
  "use strict";
  var KEY = "cssos_appstore_ribbon_dismissed_session";
  function lc(en, zh) {
    try { return (typeof globalThis.loginCopy === "function") ? globalThis.loginCopy(en, zh) : en; }
    catch (_e) { return en; }
  }
  function dismissed() { try { return sessionStorage.getItem(KEY) === "1"; } catch (_e) { return false; } }
  // W1603 — 顶部横幅回到「纯公告 + 关闭」: 移动端安装入口交给底部 sheet
  //   (app.mobile-app-cta)+ Dock「App」面板, 顶部不再重复放 Install 按钮
  //   (Jing: 和下面的重复了)。× 复位到右侧垂直居中。
  function mount() {
    if (dismissed()) return;
    if (document.getElementById("cssos-appstore-ribbon")) return;
    var host = document.body;
    if (!host) return;
    var bar = document.createElement("div");
    bar.id = "cssos-appstore-ribbon";
    // W1595 — 顶头固定居中的胶囊条(不再插进 .stage 被居中的 logo 挡住)。
    //   .stage 是 100vh flex-center + .logo-panel 是 position:absolute 居中,
    //   任何塞进 stage 的子节点都会叠到 logo 正中。改用 fixed:top 居中,
    //   左右各留 ~70px 避开左上⋯(version)/右上◐(theme)两个 z-index:10 角标。
    bar.style.cssText =
      "position:fixed;top:calc(12px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);" +
      "z-index:10;display:flex;align-items:center;justify-content:center;gap:10px;" +
      "width:max-content;max-width:min(1040px,calc(100vw - 40px));box-sizing:border-box;" +
      "padding:8px 40px 8px 18px;border-radius:999px;" +
      "background:linear-gradient(135deg,#0c9d70,#0a7f5c);" +
      "border:1px solid rgba(0,245,160,0.55);color:#ffffff;" +
      "font:700 13px/1.35 -apple-system,system-ui,sans-serif;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,0.28);" +
      "box-shadow:0 6px 22px rgba(0,0,0,0.30);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);";
    bar.innerHTML =
      '<span>🎉 ' + lc(
        "CSS Studio is now on the App Store — across all of Apple: iPhone, iPad, Apple Watch, Apple TV & Vision Pro.",
        "CSS Studio 已登陆苹果商店 —— 覆盖苹果全生态:iPhone、iPad、Apple Watch、Apple TV 与 Vision Pro。"
      ) + '</span>' +
      '<button type="button" aria-label="dismiss" id="cssos-appstore-ribbon-x" ' +
        'style="position:absolute;right:10px;top:50%;transform:translateY(-50%);border:0;background:transparent;' +
        'color:#bff5e0;font-size:20px;line-height:1;cursor:pointer;padding:4px 8px;opacity:.75;">×</button>';
    host.appendChild(bar);
    var x = document.getElementById("cssos-appstore-ribbon-x");
    if (x) x.addEventListener("click", function () {
      try { sessionStorage.setItem(KEY, "1"); } catch (_e) {}
      try { bar.remove(); } catch (_e2) {}
    });
  }
  // W1765 — 真全屏也要显示这条公告(Jing)。真全屏用 element.requestFullscreen()
  //   只渲染那个全屏元素的子树, body 层的 position:fixed 横幅落在子树外 → 不显示
  //   (与 WAVE_705 爆字/字幕同一根因)。进全屏时把横幅移进 fullscreenElement,
  //   退出时移回 body。全屏元素是容器 div(审计#1/#2 已改容器优先, 非裸 <video>),
  //   可安全 appendChild。已 dismiss(横幅被移除)则本函数自然 no-op。
  function reparentForFullscreen() {
    try {
      var bar = document.getElementById("cssos-appstore-ribbon");
      if (!bar) return;
      var fsEl = document.fullscreenElement || document.webkitFullscreenElement || null;
      if (fsEl && fsEl.nodeType === 1 && fsEl.appendChild && bar.parentNode !== fsEl) {
        fsEl.appendChild(bar);            // 进全屏: 移进全屏子树
      } else if (!fsEl && bar.parentNode !== document.body) {
        document.body.appendChild(bar);   // 退出全屏: 移回 body
      }
    } catch (_e) {}
  }
  try {
    document.addEventListener("fullscreenchange", reparentForFullscreen, false);
    document.addEventListener("webkitfullscreenchange", reparentForFullscreen, false);
  } catch (_e) {}
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
