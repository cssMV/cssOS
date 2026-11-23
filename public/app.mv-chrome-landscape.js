/* CSSOS_WAVE_2368 20261123 — 媒体转横屏时, MV 面板的功能键也跟着转。
 *
 * Jing 2026-11-23:「系统竖屏，媒体横屏时，功能键也横屏。」
 *   「媒体横屏播放，按钮却还是竖屏显示，怪怪的。」
 *
 * ## 这不是 W2363, 方向正好相反
 *
 * W2363/W2365 我把需求听反了, 去放开了 iOS 的横屏(拆掉 W194 那四道竖屏锁), 已在 W2367 整体撤销。
 * **系统永远是 Portrait + PortraitUpsideDown, 这条铁律本波一个字都不碰。**
 * 本波只做一件事: 画面已经转了 90°(W2115 画幅铁律), 让压在画面上的功能键跟着转同样的 90°,
 * 于是用户把手机侧过来看时, 画面和按钮一起是正的。
 *
 * ## 判据只有一个, 不另造
 *
 * 转不转, 由 app.watch-face-crop.js 的 `mismatch`(竖显示区 + 横片源)说了算 ——
 * 它本来就是画幅铁律的唯一真源。本波只是让它把结论写成
 * `#watch-panel[data-media-rotated="1"]`, 这里读那个属性。
 * **绝不在这里重新判一次方向** —— 两套判据迟早会分叉, 那时画面转了按钮没转(或反过来),
 * 比现在更难查。
 *
 * 顺带: 这个判据天然只在该转的时候成立, 所以不需要任何平台嗅探。
 * 桌面影院态容器是横的 → mismatch 为假 → 这里什么都不做, 桌面一个像素不动。
 *
 * ## 几何: 复用画面那块画布, 不自己算一套
 *
 * 画面层的写法是(face-crop 第 159 行起):
 *     width:100vh; height:100vw; left:50%; top:50%;
 *     transform: translate(-50%,-50%) rotate(90deg)
 * 也就是把一块【横幅画布】(100vh 宽 × 100vw 高)按中心转 90° 塞进竖屏视口。
 * 功能键用【同一块画布】的坐标系, 于是「画面的右边」就真的是右边, 不用再换算:
 *
 *     transform: translate(-50%,-50%) rotate(90deg) translate(dx, dy)
 *                └── 居中 ──┘        └ 同画面 ┘   └ 在横幅画布里的偏移 ┘
 *
 * 关键是最后那个 translate 排在 rotate 之后 —— CSS 变换从左往右逐级进入下一个坐标系,
 * 所以它是在【已经转过的那个框】里位移, 那个框就是横幅画布。(dx,dy) 因此可以直接按
 * 「离画布中心多远」来写, 不必做任何三角换算。
 *
 * 为什么不用一个包裹层把功能键装进去(那样子元素自动继承画布坐标, 看着更干净):
 *   app.watch-social-rail.js 的 buildRail() 每轮渲染都有
 *   `else if (rail.parentNode !== host) host.appendChild(rail);` —— 只要右轨不在
 *   #watch-panel 底下就会被拽回来。改父节点等于要同时改那个模块, 波及面更大。
 *   逐元素变换不动 DOM 结构, 一行开关就能全退。
 *
 * ## 转哪四个 —— 正好对上 Jing 点的名
 *
 *   #cssos-watch-social-rail  右侧栏。#cssos-rail-ai(轨内那个 AI ＋)是它的子节点,
 *                             自动跟着转, 不用单独处理。
 *                             Jing:「按钮转一个90度，按键的值在按键下方。」——
 *                             整条轨一起转, 每个 .csr-item 内部那列(图标在上/数值在下)
 *                             就自动还是上下关系, 不需要逐个按钮去转。
 *   #cssos-watch-bottomflow   「左下角的传统标题等板块」。实测 #watch-subtitle(传统字幕)、
 *                             价格行 #cssos-watch-priceline、语言/声线胶囊条 #cssos-lang-fold
 *                             **全都是它的后代** —— 转它一个, 这几样一起到位。
 *   #cssmv-mv-title           顶部标题。它在 #watch-screen 里面, 但转的是它自己,
 *                             没有碰 .watch-screen::after(W1983 锁死的那圈光芒)。
 *   #cssos-watch-danmu        弹幕块(左侧)。
 *
 * ## 刻意没转的四个: W2214/W2215 锁着的顶栏一行
 *
 *   #cssos-watch-backbtn(返回 ‹) · #watch-search-box(搜索框) ·
 *   #watch-exit-cinema(右上 ⋯) · #cssos-mv-flagship-badge(⚜ Flagship)
 *
 * CLAUDE.md 的「影院态顶栏与贴边宪法」把这四个连同行锚 `--cssos-mv-toprow-center`
 * 一起锁了, 红线写明【任何改动都必须先拿到 Jing 明确的 yes】。Jing 这次点的是右侧栏 /
 * 左下板块 / 顶部标题, 没点这四个, 所以**不动, 先问**。
 * (实测这四个里有三个此刻 opacity:0 / display:none —— 影院态 10s 空闲淡出已经把它们
 *  收起来了, 所以先不转也不至于太刺眼; 只有 Flagship 徽章是常驻的。)
 *
 * ## 还原
 *
 * index.html 删掉这一行 <script> → 整个功能消失, 回到今天之前。
 * 想只摘掉其中一个元素: 把 ITEMS 里那一条删掉即可。
 */
(function () {
  "use strict";

  /* CSSOS_WAVE_2378 20261123 — Jing:「MV面板, 所有靠边的物件, 距离边框(屏幕边缘)
   * 必须参照苹果底部 Home 指示条靠边的距离, 苹果 Home 指示条距离多远, 我们的物件
   * 就要距离多远。」
   * 这个数不是查来的, 是量出来的 —— 拿 Jing 自己那张 iPhone 截图(924×2000, 对应
   * 390×844pt 机型)扫底部中轴亮度: 指示条占 y=1971..1981, 离底边 18px → 7.6pt;
   * 指示条自身高 11px → 4.6pt, 与苹果公开的 5pt 吻合, 佐证换算没错。取 8。
   * (原 W2215 是 10; 本条是 Jing 明确改的, 不是我顺手。) */
  var INSET = 8;
  var STYLE_ID = "cssos-mv-chrome-landscape-css";

  /* 每个元素在【横幅画布】里怎么贴边。
   *   ax: left | center | right     ay: top | center | bottom
   *   padX / padY: 覆盖默认 INSET(只在该元素确实需要别的间距时才给)
   *   fit: "width"  → 宽度拉到画布宽 - 2*INSET(横幅是 100vh 宽, 元素原本按竖屏 100vw 排)
   *        "height" → 给 max-height = 画布高 - 2*INSET, 配合下面的瘦身 CSS 把轨压进去
   *   maxH: 直接给一个 max-height(px)。竖屏下的高度是按 932 的屏算的, 搬进只有 430 高的
   *         横幅画布会顶穿 —— 弹幕块实测 260 高, 贴底之后顶边都翻到画布中线以上了。 */
  var ITEMS = [
    { id: "cssos-watch-social-rail", ax: "right",  ay: "center", fit: "height" },
    { id: "cssos-watch-bottomflow",  ax: "center", ay: "bottom", fit: "width"  },
    /* padY 47 = 竖屏下标题的 top 值, 原样搬过来 —— 它在竖屏就是落在顶栏那一行
     * (9..51)下沿附近, 搬进画布后关系不变。给 10 的话会和顶栏撞上。 */
    { id: "cssmv-mv-title",          ax: "center", ay: "top",    fit: "width", padY: 47 },

    /* CSSOS_WAVE_2370 — 顶栏那一行。Jing 2026-11-23 明确:「顶栏那四件…转过来，以横屏显示。」
     * 这四个是 W2214/W2215 锁着的, 之前一直没动就是在等这句话。
     *
     * 关键: **不另定一套数字, 把宪法的那组原样搬进横幅画布。**
     * W2214 锁的是一组【关系】——
     *     行锚 --cssos-mv-toprow-center: 30px, 三个控件各减自己的半高对齐中心;
     *     贴边一律 10px(W2215); 搜索框 left/right 60px( = 10 边距 + 40 按钮 + 10 间隙)。
     * 搬进画布后这组关系一个字没变, 只是「顶」从竖屏的顶变成了画面的顶:
     *     返回 ‹ / 右上 ⋯  40px 高, padY 10 → 占 10..50, 中心 30 ✓
     *     搜索框            42px 高, padY  9 → 占  9..51, 中心 30 ✓
     *     Flagship 徽章     20px 高, padY 10 → 占 10..30(行锚正是照它的下沿定的)✓
     * 这正是宪法红线想保住的东西, 所以搬而不是重排。 */
    /* W2378 — 这四个的 padY 是照【行锚】算出来的, 行锚 30 → 28 之后必须一起走:
     *   返回/⋯ 40 高, padY 8 → 占 8..48, 中心 28 ✓
     *   搜索框  42 高, padY 7 → 占 7..49, 中心 28 ✓
     *   Flagship 20 高, padY 8 → 占 8..28(行锚正是照它的下沿定的)✓
     * 只改 INSET 不改这四个 = 别的件贴边 8、这四件还停在 10, 差 2px 没人看得出来但就是不齐。
     * fitInset 60 → 58 同理: 60 = 10边距+40按钮+10间隙, 边距改 8 后是 58。 */
    { id: "cssos-watch-backbtn",     ax: "left",   ay: "top",    padY: 8 },
    { id: "cssos-mv-flagship-badge", ax: "left",   ay: "top",    padY: 8 },
    { id: "watch-exit-cinema",       ax: "right",  ay: "top",    padY: 8 },
    { id: "watch-search-box",        ax: "center", ay: "top",    padY:  7, fit: "width", fitInset: 58 },

    /* CSSOS_WAVE_2370 — 情绪字幕的中央爆 + 飘字层。Jing:「情绪字幕还在以竖屏显示。请改进。」
     * 这两层是铺满画框的特效层, 所以用 fill(整块画布), 不是贴边。
     * 它们内部的字是按【百分比】定位的(_stagePos 返回 x%/y%), 百分比对的是本层的盒子
     * —— 层变成横幅画布, 所有字自动按横幅重排, 一行坐标数学都不用改。
     *
     * #cssfx-flash-overlay(整屏闪白)【刻意不转】: 它是一层均匀色洗, 转成 100vh×100vw
     * 之后反而盖不满竖屏视口, 上下会露边。转它没有收益, 只有破绽。
     * #cssfx-confetti(彩纸)也没转 —— Jing 点的是「中央爆/飘字层」, 彩纸不在其中。 */
    { id: "cssfx-center-burst",      fill: true },
    { id: "cssfx-spark",             fill: true },
    /* padY 62 = 底栏(10 贴边 + 42 高) + 10 间隙 —— 弹幕块要浮在那条 bar 【上方】,
     * 不是压在它身上(竖屏下两者本来也是分开的: danmu bottom:120 / bar bottom:8)。 */
    { id: "cssos-watch-danmu",       ax: "left",   ay: "bottom", maxH: 200, padY: 62 }
  ];

  var ROT_PROPS = ["position", "left", "top", "right", "bottom",
                   "transform", "transform-origin", "width", "height", "max-height"];

  function panel() { return document.getElementById("watch-panel"); }

  /* 唯一判据 —— app.watch-face-crop.js 写的。这里只读, 不自己判方向。
   * W2377 起是三态: "1"=要转 / "0"=不转 / null=还没判定。 */
  function rotFlag() {
    var p = panel();
    return p ? p.getAttribute("data-media-rotated") : null;
  }

  /* ── W2377 幕布: 先转好再露面 ──────────────────────────────────────────────
   *
   * Jing:「胶囊和搜索, 似乎是在检测到横屏媒体之后才匆匆忙忙转为横屏显示, 所以每次都要
   *        先显示为竖屏状态才匆忙转为横屏显示状态, 是否可以参照媒体, 在检测到是横屏媒体
   *        的时候, 先转到横屏显示状态再显示?」
   *
   * 他说的"参照媒体"正中要害: 媒体层早就有这套东西 —— W1930 的
   * armCurtain/dropCurtain(app.watch-face-crop.js),「方向已判定且 transform 已落好
   * → 才揭幕」。**功能键这一层从来没进过幕布**, 所以它们按竖屏先画出来, 等方向判定了
   * 才被我翻过去 —— 屏幕上就是匆忙一转。
   *
   * 照搬那套做法, 不另造: 未判定就不露面, 判定了(无论转不转)、位置摆好了才露面。
   *
   * 用 visibility 而不是 opacity: 顶栏那几件的 opacity 归影院态 10s 空闲淡出管
   * (W2214 第三节写明【刻意保留】), 两者抢同一个属性必然打架。visibility 与它正交。
   * 揭幕时是 removeProperty 而不是设成 visible —— 设死了会把别人对 visibility 的控制也夺走。
   *
   * 硬超时是必须的, 不是保险: 纯音乐 / 纯封面作品的 <video> 可能【永远】拿不到元数据,
   * 旗标就永远停在 null。没有超时 = 那类作品的功能键永远不露面。
   * (face-crop 的幕布同样有 CURTAIN_MS 硬超时, 注释写着「绝不黑屏」—— 同一条纪律。) */
  var CURTAIN_MAX_MS = 900;
  var curtainTimer = null;
  function armCurtain() {
    ITEMS.forEach(function (spec) {
      var el = document.getElementById(spec.id);
      if (!el || el.__cssosChromeCurtained) return;
      el.__cssosChromeCurtained = true;
      try { el.style.setProperty("visibility", "hidden", "important"); } catch (_e) {}
    });
    try { clearTimeout(curtainTimer); } catch (_e) {}
    curtainTimer = setTimeout(dropCurtain, CURTAIN_MAX_MS);
  }
  function dropCurtain() {
    try { clearTimeout(curtainTimer); } catch (_e) {}
    curtainTimer = null;
    ITEMS.forEach(function (spec) {
      var el = document.getElementById(spec.id);
      if (!el || !el.__cssosChromeCurtained) return;
      el.__cssosChromeCurtained = false;
      try { el.style.removeProperty("visibility"); } catch (_e) {}
    });
  }

  /* 右轨瘦身。
   * 为什么非瘦不可(实测数): 竖屏下右轨是 46 × 515(8 项 × ~58 + 7 × 9 间距)。
   * 转进横幅画布后, 它的"长"方向吃的是画布高度 = 竖屏视口的【宽】= 430,
   * 去掉两头 10px 只剩 410 —— 515 塞不进去, 头尾会被切掉。
   * 实测 iPhone 14 Pro 宽度下: 图标 38 + 数值 ~9 + 内间距 1 = 48/项, 8 项 = 384 ≤ 410。
   * 48 ≥ 苹果 44px 最小点击目标, 没有把按钮缩到难点中。
   * 这一组只在 [data-media-rotated="1"] 下生效, 竖屏原样不动。 */
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      '#watch-panel[data-media-rotated="1"] #cssos-watch-social-rail{gap:0 !important;}' +
      '#watch-panel[data-media-rotated="1"] #cssos-watch-social-rail .csr-item{gap:1px !important;}' +
      '#watch-panel[data-media-rotated="1"] #cssos-watch-social-rail .csr-ic{' +
        'width:38px !important;height:38px !important;font-size:18px !important;line-height:1 !important;}' +
      '#watch-panel[data-media-rotated="1"] #cssos-watch-social-rail .csr-lbl{' +
        'font-size:8px !important;line-height:1.1 !important;}' +
      '#watch-panel[data-media-rotated="1"] #cssos-watch-social-rail .csr-av{' +
        'width:38px !important;height:38px !important;}' +
      /* 头像上那个 ➕ 关注角标跟着缩, 否则 17px 的圆骑在 38px 头像上显得过大(W1167 的比例) */
      '#watch-panel[data-media-rotated="1"] #cssos-watch-social-rail .csr-follow{' +
        'width:14px !important;height:14px !important;font-size:10px !important;}';
    (document.head || document.documentElement).appendChild(s);
  }

  function clearOne(el) {
    ROT_PROPS.forEach(function (k) { try { el.style.removeProperty(k); } catch (_e) {} });
    try { el.removeAttribute("data-mv-chrome-rot"); } catch (_e) {}
  }

  function placeOne(el, spec, Lw, Lh) {
    /* 先把尺寸定了再量 —— dx/dy 要用元素【转后画布里】的真实宽高算, 量错一步全错。 */
    if (spec.fill) {
      /* 铺满整块横幅画布 —— 与画面层逐字同几何(face-crop 第 161-162 行), 于是特效层
       * 和画面严丝合缝。偏移为 0, 不贴边。 */
      el.style.setProperty("width", Lw + "px", "important");
      el.style.setProperty("height", Lh + "px", "important");
    }
    if (spec.fit === "width") {
      var _wi = (spec.fitInset == null) ? INSET : spec.fitInset;
      el.style.setProperty("width", (Lw - 2 * _wi) + "px", "important");
    }
    if (spec.fit === "height") el.style.setProperty("max-height", (Lh - 2 * INSET) + "px", "important");
    if (spec.maxH)             el.style.setProperty("max-height", spec.maxH + "px", "important");

    el.style.setProperty("position", "absolute", "important");
    el.style.setProperty("left", "50%", "important");
    el.style.setProperty("top", "50%", "important");
    /* right/bottom 必须显式放开 —— App 端有 `html.cssos-app #watch-panel ... {inset:0}`,
     * inset 是简写会把四边一起钉死, 只设 left/top 会被拉回铺满。W1909 栽过这一次。 */
    el.style.setProperty("right", "auto", "important");
    el.style.setProperty("bottom", "auto", "important");
    el.style.setProperty("transform-origin", "center center", "important");

    /* 量真实盒子。此刻 transform 还是上一轮的值, 但 getBoundingClientRect 会把 transform
     * 算进去 —— 所以用 offsetWidth/offsetHeight(布局盒, 不含 transform)。 */
    var w = el.offsetWidth || 0;
    var h = el.offsetHeight || 0;

    var padX = (spec.padX == null) ? INSET : spec.padX;
    var padY = (spec.padY == null) ? INSET : spec.padY;

    var dx = 0, dy = 0;
    if (spec.ax === "left")  dx = -(Lw / 2 - padX - w / 2);
    if (spec.ax === "right") dx =  (Lw / 2 - padX - w / 2);
    if (spec.ay === "top")    dy = -(Lh / 2 - padY - h / 2);
    if (spec.ay === "bottom") dy =  (Lh / 2 - padY - h / 2);

    el.style.setProperty(
      "transform",
      "translate(-50%,-50%) rotate(90deg) translate(" +
        Math.round(dx) + "px," + Math.round(dy) + "px)",
      "important"
    );
    try { el.setAttribute("data-mv-chrome-rot", "1"); } catch (_e) {}
  }

  function sync() {
    var p = panel();
    if (!p) return;
    injectStyle();
    var flag = rotFlag();
    /* 还没判定 → 不摆位、也不露面。等 face-crop 拿到真实尺寸写下 "1"/"0" 再说。 */
    if (flag === null) { armCurtain(); return; }
    var on = (flag === "1");
    /* 横幅画布 = 100vh 宽 × 100vw 高, 与画面层逐字一致(face-crop 第 161-162 行)。 */
    var Lw = window.innerHeight || 0;
    var Lh = window.innerWidth || 0;
    ITEMS.forEach(function (spec) {
      var el = document.getElementById(spec.id);
      if (!el) return;
      try {
        if (on && Lw > 0 && Lh > 0) placeOne(el, spec, Lw, Lh);
        else clearOne(el);
      } catch (_e) {}
    });
    /* 位置已经摆好 → 这一刻才揭幕。顺序反了就等于没装幕布。 */
    dropCurtain();
  }

  globalThis.cssosSyncMvChromeLandscape = sync;

  /* 重放。这几个元素的位置被别的模块反复重写(bottomflow 每轮渲染写内联;
   * 右轨 buildRail 每轮重建子节点; 标题 anchor-* 会改 top/left), 所以不能只设一次。
   * 内联 !important 压得过样式表 !important, 但压不过【同为内联】的后来者 ——
   * 唯一可靠的办法是跟着那些重写之后再写一遍。
   * 这里照抄 face-crop 的 ringKeepAlive 做法(面板开着才跑, 关了就停), 不另造一套节拍。 */
  var timer = null;
  function start() {
    if (timer) return;
    timer = setInterval(function () {
      var p = panel();
      if (!p || p.classList.contains("hidden")) { stop(); sync(); return; }
      sync();
    }, 500);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  try {
    var mo = new MutationObserver(function () {
      var p = panel();
      if (p && !p.classList.contains("hidden")) start(); else { stop(); sync(); }
    });
    mo.observe(document.documentElement, {
      attributes: true, subtree: true,
      attributeFilter: ["class", "data-media-rotated"]
    });
  } catch (_e) {}

  ["resize", "orientationchange"].forEach(function (ev) {
    try { window.addEventListener(ev, sync, { passive: true }); } catch (_e) {}
  });
  /* 换作品 = 方向重新未知 → 立刻拉幕, 别让上一首的方向先露一眼。
   * face-crop 在同一个事件上清旗标, 两边同一拍。 */
  try { window.addEventListener("cssos:work-id-changed", function () { armCurtain(); sync(); }, { passive: true }); } catch (_e) {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { sync(); start(); }, { once: true });
  } else { sync(); start(); }
})();
