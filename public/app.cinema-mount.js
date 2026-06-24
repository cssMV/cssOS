/* CSSOS_WAVE_1147 20260623 — Jing 指令: 统一影院内浮层挂载, 收口"全屏层外看不见"反复踩的坑。
 *   影院进入浏览器全屏时, 全屏元素会创建独立层叠上下文; 挂到 document.body 的浮层在该层【外面】→
 *   不论 z-index 多高都看不见(Next up 右击/评论抽屉/嵌入弹窗/分享菜单都栽过)。
 *   以后所有影院内弹窗一律: cssosMountInCinema(el) —— 有全屏元素挂全屏元素, 否则挂 body。 */
(function () {
  "use strict";
  if (globalThis.cssosMountInCinema) return;
  globalThis.cssosMountInCinema = function (el) {
    if (!el) return el;
    var host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    try { host.appendChild(el); } catch (_e) { try { document.body.appendChild(el); } catch (_e2) {} }
    return el;
  };

  // CSSOS_WAVE_1158 — Jing 指令: 不允许同时多个弹窗, 只能一个。打开任一弹窗前调用此函数关掉其它。
  //   注: 嵌入选作品弹窗(#cssos-embed-pick)是评论的子流程, 不在此列(允许叠在评论上)。
  //   AI 助理(#cssos-agent-panel)是独立面板/可全屏, 不在此列。
  var POPUP_SELS = [
    "#cssos-work-comments", ".css-pay-picker-backdrop", ".cssos-author-menu",
    "#cssos-card-ctx", "#cssos-share-dialog", ".cssos-gift-modal", ".cssos-workgift-modal",
  ];
  globalThis.cssosCloseOtherPopups = function (keepSel) {
    POPUP_SELS.forEach(function (s) {
      if (s === keepSel) return;
      try {
        document.querySelectorAll(s).forEach(function (el) { try { el.remove(); } catch (_e) {} });
      } catch (_e) {}
    });
    // 也关掉嵌入选作品子弹窗(若它残留且不是要保留的)。
    if (keepSel !== "#cssos-embed-pick") { var ep = document.getElementById("cssos-embed-pick"); if (ep) try { ep.remove(); } catch (_e) {} }
  };
  // CSSOS_WAVE_1173 — Jing 指令: 主面板关闭时, 里面的小窗口(评论/支付/菜单等)必须同时关闭。
  //   监听面板关闭/影院退出/全屏退出 → 关掉所有影院弹窗(含嵌入子弹窗)。
  function _closeAllCinemaPopups() { try { globalThis.cssosCloseOtherPopups(""); var ep = document.getElementById("cssos-embed-pick"); if (ep) ep.remove(); } catch (_e) {} }
  // 用【捕获阶段】监听: cssos:panelclose 是在面板元素上派发且 bubbles:false, 捕获阶段(document→target)才能收到。
  ["cssos:panelclose", "cssos:cinema-exit", "cssos:watch-close"].forEach(function (ev) {
    document.addEventListener(ev, _closeAllCinemaPopups, true);
    window.addEventListener(ev, _closeAllCinemaPopups);
  });

  // CSSOS_WAVE_1193/1194 — Jing 指令: 右轨的所有小窗口(分享/评论/嵌入/支付…)统一定位, 不再一高一低、
  //   不再一个个改。所有右轨弹窗的【内容卡】调一次此函数即可:
  //     · 顶对齐右轨顶;
  //     · 底【一直高到左下角标题之上】(W1194 改, 不再"和右轨等高"); 探测不到标题则距底约 124px 兜底;
  //     · 右侧停在右轨左侧 gap → 不遮右轨;
  //     · 内容比框矮 → overflow:auto 顶对齐可滚。
  //   背景层(调用方)用评论框那套透明风格(透明 backdrop + 深色卡)。无右轨(非影院)回退底部安全 sheet。
  //   自动随 resize/旋转重排(卡片移除即解绑)。
  function _railBottomLimit(vh) {
    // CSSOS_WAVE_1195 — Jing: 弹窗底要高到【Next up 之上】(Next up 比左下标题更靠上)。
    //   探测一组底部元素(Next up 优先, 再左下标题), 取最靠上的可见者顶, 让弹窗停在它之上。
    var best = Math.round(vh - 124);   // 兜底: 距底 124px(留出底部栈 + 安全区)
    try {
      var els = document.querySelectorAll("#cssos-up-next-strip, .cssmv-mv-title, #cssos-mv-now-playing-title, .watch-now-playing, .cssmv-nowplaying, .watch-title-bottom");
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (!el || el.offsetParent === null && getComputedStyle(el).position !== "fixed") { /* 可能隐藏, 继续用 rect 判 */ }
        var rc = el.getBoundingClientRect();
        if (rc.height > 0 && rc.top > vh * 0.4 && rc.top < best) best = Math.round(rc.top - 10);
      }
    } catch (_e) {}
    return best;
  }
  globalThis.cssosAnchorPopupToRail = function (el, opts) {
    if (!el) return el;
    opts = opts || {};
    function place() {
      if (!document.body.contains(el)) { window.removeEventListener("resize", place); return; }
      var vw = window.innerWidth || 360, vh = window.innerHeight || 640;
      var rail = document.getElementById("cssos-watch-social-rail");
      el.style.position = "fixed";
      el.style.margin = "0";
      el.style.transform = "none";
      if (rail && rail.style.display !== "none" && rail.getBoundingClientRect().height > 0) {
        var r = rail.getBoundingClientRect();
        var gap = opts.gap != null ? opts.gap : 12;
        var topPx = Math.max(8, Math.round(r.top));
        var botLimit = _railBottomLimit(vh);                 // W1194 — 高到左下标题之上
        var hPx = Math.max(160, botLimit - topPx);
        el.style.top = topPx + "px";
        el.style.bottom = "auto";
        el.style.height = hPx + "px";
        el.style.maxHeight = hPx + "px";
        el.style.right = Math.max(8, Math.round(vw - r.left + gap)) + "px";   // 右边停在右轨左侧 → 不遮右轨
        el.style.left = (opts.left != null ? opts.left : 8) + "px";
        el.style.width = "auto";
        el.style.maxWidth = "none";
      } else {
        // 回退: 底部安全 sheet(无右轨时)。
        el.style.left = "8px"; el.style.right = "8px"; el.style.bottom = "16px"; el.style.top = "auto";
        el.style.height = "auto"; el.style.maxHeight = "70vh"; el.style.width = "auto"; el.style.maxWidth = "none";
      }
    }
    place();
    window.addEventListener("resize", place);
    el.__cssosRailReplace = place;   // 调用方内容变化后可手动重排
    return el;
  };
})();
