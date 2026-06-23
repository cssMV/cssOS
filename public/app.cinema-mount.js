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
})();
