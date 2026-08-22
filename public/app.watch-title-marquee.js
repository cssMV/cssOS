/* CSSOS_WAVE_1856 20260822 — Jing「MV 面板作品的标题不再允许多行显示, 必须一行显示,
 * 如果标题超过屏幕宽度(如 App/手机端竖屏), 则使用 marquee, 让标题左右滚动。」
 *
 * 现状(线上实测): .watch-activity-title 是 white-space:normal / overflow:visible ——
 * 长标题直接折行, 在手机竖屏尤其明显(《李白 饮者三部曲 天地留名》占两行)。
 * 而同一块里的 .cwc-title 早就是 nowrap+hidden, 两套行为不一致。
 *
 * 做法: 统一强制单行; 只在【真的放不下】时才滚动 —— 放得下就静止, 不做无谓的动画
 * (常驻动画在这条链上是有代价的: 每一帧都在合成器上跑, 而 iOS 正是被这些累积压垮的)。
 * 滚动用 transform 而非 left/margin: 只走合成层, 不触发布局回流。
 * 往返式(A→B→A)而不是循环跑马灯: 中文标题循环滚动会让人读不到开头,
 * 往返能保证首尾都停留一下。 */
(function () {
  "use strict";
  if (globalThis.__cssosTitleMarqueeInstalled) return;
  globalThis.__cssosTitleMarqueeInstalled = true;

  var SEL = [
    "#watch-panel .watch-activity-title",
    "#watch-panel .cwc-title",
    "#watch-panel .watch-title-text",
    "#watch-panel #watch-title-text",
    "#watch-panel .cssmv-mv-title"
  ].join(",");

  var STYLE_ID = "cssos-title-marquee-css";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = [
      /* 单行 + 裁切: 这是无条件的, 不管滚不滚 */
      SEL.split(",").map(function (s) { return s + "{white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;}"; }).join("\n"),
      /* 内层承载文字并做位移; 只有溢出时才加 .is-marquee */
      ".cssos-mq-inner{display:inline-block;will-change:transform;}",
      ".cssos-mq-inner.is-marquee{animation:cssosTitleMq var(--mq-dur,12s) ease-in-out infinite;}",
      "@keyframes cssosTitleMq{",
      "  0%,12%   {transform:translateX(0);}",              /* 开头停一下, 让人读到标题起始 */
      "  50%,62%  {transform:translateX(var(--mq-shift,0px));}",  /* 走到底再停一下 */
      "  100%     {transform:translateX(0);}",
      "}",
      /* 尊重系统的"减少动态效果" —— 无障碍, 也省电 */
      "@media (prefers-reduced-motion: reduce){.cssos-mq-inner.is-marquee{animation:none;}}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  }

  function wrap(el) {
    var inner = el.querySelector(":scope > .cssos-mq-inner");
    if (!inner) {
      inner = document.createElement("span");
      inner.className = "cssos-mq-inner";
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
    }
    return inner;
  }

  function measure(el) {
    var inner = wrap(el);
    var over = inner.scrollWidth - el.clientWidth;
    if (el.clientWidth <= 0) return;                  // 不可见时不判断
    if (over > 8) {
      inner.style.setProperty("--mq-shift", (-over - 8) + "px");
      // 速度恒定(约 55px/s), 长标题走得久 —— 而不是长短标题都用同一时长
      inner.style.setProperty("--mq-dur", Math.max(8, Math.round((over + 8) / 55 * 2 + 4)) + "s");
      inner.classList.add("is-marquee");
    } else {
      inner.classList.remove("is-marquee");
      inner.style.removeProperty("--mq-shift");
    }
  }

  var pending = false;
  function scan() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { document.querySelectorAll(SEL).forEach(measure); } catch (_e) {}
    });
  }

  injectStyle();
  scan();
  // 换歌 / 转屏 / 窗口变化都要重新量; 标题文字变化由 MutationObserver 兜住
  try { window.addEventListener("cssos:work-id-changed", scan, { passive: true }); } catch (_e) {}
  window.addEventListener("resize", scan, { passive: true });
  window.addEventListener("orientationchange", scan, { passive: true });
  try {
    var wp = document.getElementById("watch-panel");
    if (wp) new MutationObserver(scan).observe(wp, { childList: true, subtree: true, characterData: true });
  } catch (_e) {}

  globalThis.cssosTitleMarqueeState = function () {
    return [].map.call(document.querySelectorAll(SEL), function (el) {
      var i = el.querySelector(".cssos-mq-inner");
      return { sel: el.className, 容器宽: el.clientWidth, 文字宽: i ? i.scrollWidth : 0, 滚动: !!(i && i.classList.contains("is-marquee")) };
    });
  };
})();
