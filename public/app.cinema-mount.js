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
})();
