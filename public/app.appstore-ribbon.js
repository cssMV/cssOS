// W1594 — App Store 全平台上架庆祝 ribbon(首页顶部, 可关闭, i18n)。
//   独立模块, 固定在页顶居中一条, 不碰现有布局。默认英文, 走 loginCopy/tr。
//   W1596 — 关闭改用 sessionStorage(而非 localStorage): 关闭只在【本次
//   浏览器会话】内不再显示(同会话刷新仍隐藏); 关掉浏览器/标签后 session
//   清空, 下次再进平台横幅重新出现。故意不做永久 dismiss。
(function () {
  "use strict";
  /* CSSOS_WAVE_2264 20261101 — Jing:「请暂停这条横幅, 取消显示即可, 以后还会用到的。
   *   也许是不同的内容, 关闭不显示即可, 不要删除掉代码。」
   *
   * 所以这里【只加一个开关】, 整个模块一行不删: 要再用时把 ENABLED 改回 true 即可
   * (换内容就改下面那句 lc(...) 的英文原文, 中文第二参按平台铁律是死参, 走 tr())。
   *
   * 为什么关在最前面而不是在 mount() 里 early-return: 停用就不该留任何副作用 ——
   * 下面还挂着 fullscreenchange 监听(W1765 为了真全屏搬运横幅), 横幅不存在时它虽是
   * no-op, 但没必要在每次进出全屏时都跑一遍。
   *
   * 停用的是【显示】, 不是关闭逻辑: W1596 的 sessionStorage 语义、W2214 的
   * 「点哪都能关」原样留着, 开回来就还是那个行为。 */
  var ENABLED = false;
  if (!ENABLED) return;
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
    /* CSSOS_WAVE_2214 20260926 — Jing:「只要点中横幅即可关闭, 不一定非得点击关闭按钮。」
     * 影院态里这条横幅横在顶栏上, 要用户去瞄准右边那个 28px 的 × 才关得掉, 太苛刻。
     * 改成整条都是关闭热区。× 保留(它是可见的关闭线索), 但不再是唯一入口 ——
     * 它落在 bar 内部, 点它照样冒泡到这里, 所以不用单独再绑一份逻辑。
     * 关闭语义不变: 仍是 W1596 的 sessionStorage(只在本次会话内不再出现)。 */
    function dismiss() {
      try { sessionStorage.setItem(KEY, "1"); } catch (_e) {}
      try { bar.remove(); } catch (_e2) {}
    }
    bar.style.cursor = "pointer";
    bar.addEventListener("click", dismiss);
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
