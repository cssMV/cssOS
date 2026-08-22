/* CSSOS_WAVE_1854 20260822 — Jing「面部识别功能失效, 整个画面最不该截断的就是人物的面部,
 * 而现在偏偏就截断人物面部, 请修复, 让人物面部识别功能真正工作。」
 *
 * ── 查到的真相(和"失效"不同) ────────────────────────────────────────────────
 * 人脸识别没有失效 —— 它【从来没有参与过裁切】。
 * app.face-safe-overlay.js 每 ~2s 用 FaceDetector(+亮度网格兜底)算出人脸在哪,
 * 但它的产物只用来决定【标题往哪放才不压脸】, 写在 #watch-panel 的 data-face-zone 上。
 * 而画面本身的裁切在 app.watch-media-layout-p2100.js 里被写死成
 *   background-position: center !important  (三处)
 * 竖版人像按 center 裁 → 取中段 → 正好是胸口, 头被切掉。Jing 截图里那位老者就是这样。
 *
 * ── 修法 ────────────────────────────────────────────────────────────────────
 * 不新增检测, 只把【已经算出来的信号接到裁切上】: 监听 data-face-zone, 把 9 个区位
 * 翻译成 background-position / object-position。检测器每 2s 更新, 裁切跟着走。
 * 没有信号时保持 center(与旧行为一致, 不制造新的不确定)。
 *
 * 为什么用 CSS 变量而不是直接写 style: p2100 那三条是 !important, 直接写内联样式赢不了。
 * 这里用一条同样 !important 的规则读 --cssos-face-pos, 变量由 JS 更新 —— 谁也不用打架。 */
(function () {
  "use strict";
  if (globalThis.__cssosFaceCropInstalled) return;
  globalThis.__cssosFaceCropInstalled = true;

  /* 区位 → 裁切锚点。原则: 脸在哪, 就把画面往哪一侧对齐, 保证脸留在框内。
   * 竖版人像最常见的是脸在上半部, 所以 tc/tl/tr 都锚到顶部偏上一点(不是 0%,
   * 留一点头顶空间, 贴顶会显得压迫)。 */
  var MAP = {
    tl: "20% 12%", tc: "50% 12%", tr: "80% 12%",
    ml: "20% 50%", c:  "50% 42%", mr: "80% 50%",
    bl: "20% 78%", bc: "50% 78%", br: "80% 78%"
  };

  var STYLE_ID = "cssos-face-crop-css";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    /* 覆盖 p2100 的三处写死 center。选择器加上 [data-face-zone] 限定 ——
     * 没有检测结果时这条规则不生效, 行为完全等同于修改前。 */
    st.textContent = [
      '#watch-panel[data-face-zone] .watch-svg,',
      '#watch-panel[data-face-zone] .watch-video,',
      '#watch-panel[data-face-zone] .cssmv-cover-slide,',
      '#watch-panel[data-face-zone] .watch-screen-backdrop,',
      '#watch-panel[data-face-zone] .watch-music-art {',
      '  background-position: var(--cssos-face-pos, 50% 50%) !important;',
      '  object-position: var(--cssos-face-pos, 50% 50%) !important;',
      '}'
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  }

  function apply() {
    var wp = document.getElementById("watch-panel");
    if (!wp) return;
    var z = String(wp.getAttribute("data-face-zone") || "").trim();
    var pos = MAP[z];
    if (!pos) return;                       // 未知/无信号 → 不干预
    /* W1858 — 【没有真 FaceDetector 时不要相信纵向判断】。
     * Safari/iOS 不提供 FaceDetector(线上实测 typeof window.FaceDetector === "undefined"),
     * face-safe-overlay 于是退回"亮度网格: 最亮的连通块就是脸"。这个假设在真人摄影下大致成立,
     * 但我们的作品多是绘画风: Jing 那张李白, 最亮的是【白胡子和浅色衣袍】而不是面部 ——
     * 启发式把胡子当成了脸, 裁切据此下移, 头反而被切掉(Jing 走查两次都指出这一点)。
     * 处置: 无真检测器时只采信【横向】区位, 纵向一律钳到上三分之一。
     * 依据是构图常识而非猜测: 人物画/人像照的面部几乎总在画面上半部, 宁可多留头顶空间,
     * 也不能把脸切掉 —— 这是 Jing 明说过"整个画面最不该截断的就是人物的面部"。 */
    if (typeof window.FaceDetector === "undefined") {
      var x = String(pos).split(/\s+/)[0] || "50%";
      pos = x + " 18%";
    }
    wp.style.setProperty("--cssos-face-pos", pos);
  }

  injectStyle();
  apply();

  // 检测器每 ~2s 改一次 data-face-zone; 只观察这一个属性, 开销可忽略
  try {
    var wp = document.getElementById("watch-panel");
    if (wp) new MutationObserver(apply).observe(wp, { attributes: true, attributeFilter: ["data-face-zone"] });
  } catch (_e) {}
  // 换歌时人脸位置会变, 重算一次
  try { window.addEventListener("cssos:work-id-changed", apply, { passive: true }); } catch (_e) {}

  // 排查入口: 控制台敲 cssosFaceCropState()
  globalThis.cssosFaceCropState = function () {
    var w = document.getElementById("watch-panel");
    return { zone: w && w.getAttribute("data-face-zone"), pos: w && w.style.getPropertyValue("--cssos-face-pos") };
  };
})();
