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
      '}',
      /* CSSOS_WAVE_1893 20260823 —— Jing:「我说要检测人物脸部, 好了, 现在特写整个鼻子。
       * 我要求的是完整的人物脸部, 没必要特写到鼻子。」
       *
       * 这次不是裁切【位置】错, 是裁切【倍率】离谱 —— 位移再准也救不回来:
       *   竖屏手机把画框做成满屏 9:19.5, 而片源是 16:9 横屏;
       *   app.watch-ui.js 对 <video> 一律 object-fit:cover → 要放大约 2.2 倍才填得满
       *   这个高瘦画框 → 裁出来正好只剩鼻子。在 2.2 倍放大下, object-position 怎么调
       *   都装不下一张完整的脸。
       *
       * 修法: 竖屏遇到【横屏片源】时改用 contain —— 整帧完整显示, 脸自然完整。
       * 上下留白不是空的: .watch-screen-backdrop 那层模糊底图已经在垫着。
       * 竖屏片源(videoHeight >= videoWidth)不受影响, 继续 cover 填满, 那本来就没问题。
       *
       * !important 是必需的: watch-ui 用【内联样式】写的 cover, 只有样式表里的
       * !important 压得过内联(反过来不行)。 */
      '@media (orientation: portrait) {',
      '  #watch-panel .watch-video[data-cssos-landscape="1"] {',
      '    object-fit: contain !important;',
      '  }',
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

  /* W1893 —— 给 <video> 打"片源是横屏"的标记, 供上面那条竖屏规则使用。
   * 只信解码器给的真实尺寸(videoWidth/videoHeight), 不猜、不查库。 */
  function markSourceOrientation() {
    var v = document.getElementById("watch-video");
    if (!v) return;
    var w = Number(v.videoWidth || 0), h = Number(v.videoHeight || 0);
    if (w < 8 || h < 8) {
      /* W1893d —— 视频还没元数据(纯幻灯作品可能【永远】没有)时, 用当前幻灯帧的真实像素判横竖,
       * 否则幻灯层永远等不到这条规则。同样只信解码/解码后的真实尺寸, 不猜。 */
      var img = document.querySelector("#watch-panel .watch-svg, #watch-panel .cssmv-cover-slide, #watch-panel .watch-music-art");
      var iw = img && Number(img.naturalWidth || 0), ih = img && Number(img.naturalHeight || 0);
      if (!iw || !ih || iw < 8 || ih < 8) return;     // 都拿不到 → 不标, 等下一轮
      w = iw; h = ih;
    }
    var landscape = w > h;
    if (landscape) v.setAttribute("data-cssos-landscape", "1");
    else v.removeAttribute("data-cssos-landscape");
    /* W1893b —— 光有样式表规则不够(实测: 规则注入了、选择器匹配、竖屏成立, computed 仍是 cover)。
     * 原因: app.watch-ui.js 在 loadedmetadata / 转屏 / 每次换歌时都会重新写【内联】
     * objectFit="cover", 而它写得比我们晚 —— 同为内联时后写的赢。
     * 所以这里也走内联, 并显式带 "important": 内联 !important 是层叠里的最高一级,
     * 它再怎么回写普通内联都盖不过来。判据仍只信解码器给的真实尺寸, 不猜。 */
    try {
      /* CSSOS_WAVE_1906 20260824 — Jing:「横屏禁止使用竖图封面图, 竖屏禁止使用横屏封面图,
       * 改为顺时针旋转 90 度。」—— 从"竖屏遇横片源"扩成【任一方向不符都转】。
       * 判据从"是不是竖屏"改成"片源方向 ≠ 屏幕方向", 一个条件覆盖两种情况:
       *   竖屏 + 横片源 → 转;  横屏 + 竖片源 → 也转。 */
      /* CSSOS_WAVE_1927 20260824 — Jing 截图: 桌面横屏 Safari 里, 耶路撒冷金顶【躺倒】。
       *
       * W1906 把规则扩成双向(源方向 ≠ 屏方向就转), 逻辑本身没错 —— 错在【拿错了
       * 比较对象】: 它比的是【浏览器窗口】方向, 而画面真正渲染进去的是【媒体框】。
       * 桌面上窗口是横的, 媒体框却是一根竖长条 —— 一张竖帧本来完美贴合那根竖框,
       * 却因为"窗口是横的"被判不符, 白白转了 90°。
       *
       * 改为量【容器】: 用媒体元素父框的实际尺寸。手机上媒体框铺满屏幕, 容器方向
       * == 窗口方向, 行为与 W1906 完全一致(不回归); 桌面/平板上媒体框自成一格, 才
       * 按它自己的方向判 —— 这才是"适应屏幕"的本意。容器量不到(未布局/尺寸为 0)
       * 时退回窗口, 保持旧行为, 不至于变成空判。 */
      var __box = null;
      try { __box = (v.parentElement && v.parentElement.getBoundingClientRect()) || null; } catch (_b) { __box = null; }
      var __cw = (__box && __box.width  > 8) ? __box.width  : (window.innerWidth  || 0);
      var __ch = (__box && __box.height > 8) ? __box.height : (window.innerHeight || 0);
      var portrait = __ch > __cw;
      /* CSSOS_WAVE_1927b 20260824 — Jing:「横屏横媒体, 你没事找事乱旋转干嘛?
       * 横屏横媒体多么的完美, 你却一定要旋转一下。」—— 他是对的, 这个错是 W1906
       * 我自己扩出来的。
       *
       * 铁律原文(CLAUDE.md 画幅铁律)只有一句: 【竖屏设备遇横片源 → 顺时针转 90°】。
       * W1906 把它读成"源方向 ≠ 屏方向就转", 于是横屏遇竖媒体【也】转 —— 而那种
       * 情况本来只要左右留边就行, 转过来是把好好的画面弄躺倒。
       *
       * 恢复单向, 并写死不给下一个人再"对称化"的余地:
       *   竖显示区 + 横片源 → 转   (贴屏, 不裁切)
       *   其余一切组合      → 不转 (横屏横媒体 = 完美, 一个像素都别动)
       * 判据用【容器】而不是 window: 画面真正渲染进去的是媒体框, 桌面上窗口是横的
       * 而媒体框可能是竖的, 比错对象就会转错(W1927 的教训)。 */
      var mismatch = (portrait && landscape);
      /* CSSOS_WAVE_1902 20260824 — 画幅铁律(CLAUDE.md「32:9 + 转屏不裁切」)的播放端落地。
       * Jing:「之前是要求剪裁 32:9 横图来适应屏幕, 现在起要求, 顺时针旋转 90 度来适应屏幕。」
       *
       * 三次没修对的经过, 写在这里免得再来第四次:
       *   W1854/W1858 调 object-position → 位置对了, 倍率还是 ~3.9 倍, 照样只剩鼻子;
       *   W1893       改 contain → 整脸完整了, 但上下两条大黑边, 画面缩成一小条;
       *   W1902(本条) 顺时针转 90° → 一帧不裁, 画面填满。
       * 一句话教训: **倍率错了, 位置再准也没用。** */
      if (mismatch) {
        v.style.setProperty("object-fit", "cover", "important");
        v.style.setProperty("width", "100vh", "important");        // 转 90° 后宽高互换
        v.style.setProperty("height", "100vw", "important");
        v.style.setProperty("position", "absolute", "important");
        v.style.setProperty("top", "50%", "important");
        v.style.setProperty("left", "50%", "important");
        /* CSSOS_WAVE_1909 20260824 — Capacitor App 专属硬化(Jing 要求验 App 这条路)。
         * App 里有 `html.cssos-app #watch-panel .watch-video { inset:0 !important }` ——
         * inset 是简写, 同时钉死 right/bottom。我只设了 top/left, 于是四边同时被约束,
         * 元素被拉回铺满而不是按 100vh×100vw 旋转。必须显式把另两边放开。
         * (内联 !important 压得过样式表 !important, 所以只要"设到", 就赢。) */
        v.style.setProperty("right", "auto", "important");
        v.style.setProperty("bottom", "auto", "important");
        v.style.setProperty("transform-origin", "center center", "important");
        v.style.setProperty("transform", "translate(-50%,-50%) rotate(90deg)", "important");
      } else {
        ["object-fit","transform","width","height","position","top","left","right","bottom","transform-origin"].forEach(function (k) { try { v.style.removeProperty(k); } catch (_e) {} });
      }
      /* W1893d —— Jing:「不要特写鼻子, 要人物脸部。」(截图里上半条是已修好的 <video>,
       * 下面那个大鼻子是【另一层】——幻灯图层/背景层, 它们还是 cover。)
       * 画面不止 <video> 一层: 幻灯帧(.watch-svg / .cssmv-cover-slide)、封面(.watch-music-art)
       * 都会占满同一个画框。只修视频等于只修了一半, 用户看到的还是被放大到只剩鼻子的那半。
       * 同一条判据(横片源 + 竖屏 → contain)一并套到所有可见画面层。
       * 背景模糊层(.watch-screen-backdrop)【不动】—— 它本来就该铺满做底衬。 */
      var LAYERS = "#watch-panel .watch-svg, #watch-panel .cssmv-cover-slide, #watch-panel .watch-music-art";
      [].slice.call(document.querySelectorAll(LAYERS)).forEach(function (el) {
        try {
          /* W1902 — 幻灯/封面层同样旋转: 画面不止 <video> 一层, 只转视频等于只转一半(W1893 的教训)。 */
          if (mismatch) {
            el.style.setProperty("object-fit", "cover", "important");
            el.style.setProperty("width", "100vh", "important");        // 转 90° 后宽高互换
            el.style.setProperty("height", "100vw", "important");
            el.style.setProperty("position", "absolute", "important");
            el.style.setProperty("top", "50%", "important");
            el.style.setProperty("left", "50%", "important");
            el.style.setProperty("right", "auto", "important");    // W1909 — 同上, App 的 inset:0
            el.style.setProperty("bottom", "auto", "important");
            el.style.setProperty("transform-origin", "center center", "important");
            el.style.setProperty("transform", "translate(-50%,-50%) rotate(90deg)", "important");
          } else {
            ["object-fit","transform","width","height","position","top","left","right","bottom","transform-origin"].forEach(function (k) { try { el.style.removeProperty(k); } catch (_e) {} });
          }
        } catch (_e) {}
      });
    } catch (_e) {}
    if (!v.__cssosOrientWired) {
      v.__cssosOrientWired = true;
      ["loadedmetadata", "resize", "emptied"].forEach(function (ev) {
        try { v.addEventListener(ev, markSourceOrientation, { passive: true }); } catch (_e) {}
      });
    }
      /* W1930 收口 — 方向已判定且 transform 已落好 → 揭幕, 这一步才是"先转好再露面"。
       * 只有拿到【真实尺寸】(w/h 都 > 0)才算判定成功; 尺寸还没出来就不揭, 交给硬超时。 */
      try { if (w > 0 && h > 0) dropCurtain(); } catch (_e) {}
  }

  /* ───────────────────────────────────────────────────────────────────────
   * CSSOS_WAVE_1930 20260824 — Jing:「不要急急忙忙先显示一个横屏, 然后又急急忙忙
   * 旋转, 而是在后台检测、在后台旋转好, 再显示出来, 用户才不会感到很唐突。」
   *
   * 病根是【时序】: markSourceOrientation 挂在 loadedmetadata 上, 而那一刻浏览器
   * 已经能画出第一帧了 —— 于是必然"先露出没转的横画面, 再啪一下转过去"。方向判得
   * 再准也救不了, 因为判断发生在露面【之后】。
   *
   * 幕布: 源一变就先把画面层遮住(opacity:0), 等方向判完、transform 落好再揭开。
   * 用户看到的第一帧就已经是转好的。
   *
   * 两条硬约束:
   *  · 竖屏设备【不可以】显示横屏媒体 → 必须先转好才准露面(本条的目的);
   *    横屏设备【可以】显示竖屏媒体 → 不转, 判定即揭幕, 不多等一帧。
   *    规则本来就不对称 —— 32:9 是生成侧铁律, 横屏遇竖媒体是少数情况, 留边即可。
   *  · 幕布必须有硬超时: 画面绝不能黑着不动(Jing:「画面不能是黑乎乎的视频框」)。
   *    360ms 兜底揭幕 —— 宁可露一下没转好的, 也不能卡成黑屏。 */
  var CURTAIN_MS = 360;
  function visualLayers() {
    var out = [];
    ["#watch-video", ".watch-svg", ".cssmv-cover-slide", ".watch-music-art"].forEach(function (sel) {
      try { [].slice.call(document.querySelectorAll(sel)).forEach(function (e) { if (e) out.push(e); }); } catch (_e) {}
    });
    return out;
  }
  function armCurtain() {
    visualLayers().forEach(function (e) {
      try {
        if (e.__cssosCurtained) return;
        e.__cssosCurtained = true;
        e.style.setProperty("transition", "opacity 140ms ease-out", "important");
        e.style.setProperty("opacity", "0", "important");
      } catch (_e) {}
    });
    try { clearTimeout(globalThis.__cssosCurtainTimer); } catch (_e) {}
    globalThis.__cssosCurtainTimer = setTimeout(dropCurtain, CURTAIN_MS);   // 硬超时, 绝不黑屏
  }
  function dropCurtain() {
    try { clearTimeout(globalThis.__cssosCurtainTimer); } catch (_e) {}
    visualLayers().forEach(function (e) {
      try {
        if (!e.__cssosCurtained) return;
        e.__cssosCurtained = false;
        e.style.setProperty("opacity", "1", "important");
      } catch (_e) {}
    });
  }
  globalThis.cssosVisualCurtain = { arm: armCurtain, drop: dropCurtain };

  /* 换歌 / 换源 → 立刻拉幕(赶在任何一帧被画出来之前) */
  try { window.addEventListener("cssos:work-id-changed", armCurtain, { passive: true }); } catch (_e) {}
  try {
    var __v0 = document.getElementById("watch-video");
    if (__v0) ["emptied", "loadstart"].forEach(function (ev) {
      try { __v0.addEventListener(ev, armCurtain, { passive: true }); } catch (_e) {}
    });
  } catch (_e) {}

  injectStyle();
  apply();
  markSourceOrientation();
  try { setInterval(markSourceOrientation, 2000); } catch (_e) {}
  ["resize", "orientationchange"].forEach(function (ev) {
    try { window.addEventListener(ev, markSourceOrientation, { passive: true }); } catch (_e) {}
  });

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
