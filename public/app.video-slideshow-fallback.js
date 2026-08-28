/* CSSOS_WAVE_789 20260615 — Jing「浏览器(特斯拉等)阻止播放视频 → fallback 到幻灯(封面图)」.
 * 独立 defer 脚本。MV 影院的 #watch-video 若【报错 / 长时间放不出(被策略拦/解码失败)】, 给
 * .watch-screen 加 watch-screen-audio-fallback(CSS 已把视频压到 opacity:0.1)→ 透出封面/幻灯层,
 * 并用 globalThis.cssmvSetCoverSlides 把当前作品封面喂给幻灯。音频(独立音轨)不受影响照常播。
 * 注: 带独立音轨的作品本就走 audio-fallback(幻灯)路径; 本脚本兜的是【纯视频被拦】的额外保险。 */
(function () {
  "use strict";
  if (globalThis.__cssosVideoSlideshowFallback) return;
  globalThis.__cssosVideoSlideshowFallback = true;

  function curCover() {
    try {
      /* CSSOS_WAVE_2026 20260828 — cssosCurrentWork 是【函数】不是对象(app.work-id-binding.js:343 `globalThis.cssosCurrentWork = function(){...}`)。 当对象读: 函数是 truthy, 于是 `w && w.cover_image` 静静地给出 undefined —— 不报错、不为空、就是永远拿不到封面。特斯拉黑框的【真正根因】: 库里补多少张封面都没用, 降级层根本读不到。查法是在真页面上 typeof 一下, 而不是读代码猜。 */
      var w = (typeof globalThis.cssosCurrentWork === "function" ? globalThis.cssosCurrentWork() : (globalThis.cssosCurrentWork || null));
      var c = w && (w.cover_image || w.cover_url || w.preview_image_url || (w.cover_slides && w.cover_slides[0]));
      return String(c || "").trim();
    } catch (_e) { return ""; }
  }
  /* CSSOS_WAVE_1989 20260826 — Jing:「降级到【用封面图制作成的幻灯】, 不要留一个黑乎乎的媒体框。」
   * 原来只喂 curCover() 一张 —— 那是【静图】, 不是幻灯。有几张就全喂进去:
   * cover_slides / slideshow_frames(库里的 slideshow_frame 资产) / 封面 / 预览图,
   * 顺序去重由 cssmvSetCoverSlides 自己做。 */
  function curCoverList() {
    var out = [];
    try {
      var w = (typeof globalThis.cssosCurrentWork === "function" ? globalThis.cssosCurrentWork() : (globalThis.cssosCurrentWork || null));   // 同上, 函数要调用
      if (w) {
        var pools = [w.cover_slides, w.slideshow_frames, w.visual_frames];
        for (var i = 0; i < pools.length; i++) {
          if (Array.isArray(pools[i])) for (var j = 0; j < pools[i].length; j++) {
            var u = pools[i][j];
            u = String((u && (u.url || u.src)) || u || "").trim();
            if (u) out.push(u);
          }
        }
        [w.cover_image, w.cover_url, w.preview_image_url].forEach(function (u) {
          u = String(u || "").trim(); if (u) out.push(u);
        });
      }
    } catch (_e) {}
    if (!out.length) { var c = curCover(); if (c) out.push(c); }
    return out;
  }
  /* CSSOS_WAVE_1989b 20260826 — 光加那个 class 【压不住画面】(实测):
   * 切换 watch-screen-audio-fallback, 视频 computed opacity 纹丝不动(off=0.95 / on=0.95),
   * 尽管元素确实 matches 那条 !important 的 0.1 规则。页面有 46 张样式表(含多张 JS 注入的
   * inline sheet), 而旋转路径还会往元素上写 inline `opacity:1 !important` —— 谁最终赢
   * 不可预测。而对用户来说后果很确定: 视频还盖在幻灯上面 = 还是那个黑框。
   * 所以不跟层叠缠斗 —— 降级模块【自己在元素上写 inline !important】。
   *
   * 实测结果比预想更怪, 记在这里省得下次再查一遍:
   *   inline `visibility: hidden !important`  → 生效, 且 400ms 后仍在
   *   inline `opacity: 0 !important`          → 【不生效】, computed 始终 0.95
   * inline !important 是层叠最高优先级, 按理不可能输 —— 唯一解释是有一个【每帧重写
   * video 内联样式】的循环(旋转/贴画面那条路)在不停地把 opacity 写回去; 它写 opacity,
   * 不写 visibility, 所以 visibility 活了下来。
   * 结论: 【藏画面靠 visibility, 不靠 opacity】。两个都写(opacity 属于锦上添花,
   * 哪天那个循环停了它也能生效), 但真正干活的是 visibility。
   * poll 每 2.5s 在降级态下补写一次, 万一被谁抹掉也能自愈。 */
  function hideVideoHard(v) {
    if (!v) return;
    try {
      v.style.setProperty("opacity", "0", "important");
      v.style.setProperty("visibility", "hidden", "important");
    } catch (_e) {}
  }
  function showVideoAgain(v) {
    if (!v) return;
    try { v.style.removeProperty("opacity"); v.style.removeProperty("visibility"); } catch (_e) {}
  }
  globalThis.__cssosFallbackShowVideo = showVideoAgain;

  /* CSSOS_WAVE_2002 20260827 — Jing:「还是显示黑框, 应该至少显示一个封面图。」
   *
   * W1989 把视频藏掉了, 但【没有保证后面有东西】—— 藏掉之后露出来的是黑。
   * 实测(线上): .watch-svg 其实是好的(已加载 1915x821, opacity 1, z-index 1),
   * 视频 z-index 2 压在它上面; 可一旦那一刻 .watch-svg 没有 src(封面 404 /
   * 切歌途中 / 作品本就无封面), 藏掉视频就真的什么都不剩。
   * 而原来的补图那一路走 cssmvSetCoverSlides(covers) —— 它收到空数组直接 return,
   * 等于没喂, 且不报错。依赖别的模块先准备好, 就一定有准备不好的时候。
   *
   * 兜底必须【自给自足】: 视频元素自带 poster(就是本作品封面), 直接把它画成
   * .watch-screen 的 background-image —— 这一层没有任何前置条件, 不可能是空的。
   * 顺序: 幻灯层已有图 -> 用它; 否则 poster; 否则 curCoverList 第一张。 */
  function coverFloor() {
    var v = document.getElementById("watch-video");
    var ws = v && v.closest ? v.closest(".watch-screen") : document.querySelector(".watch-screen");
    var svg = document.querySelector(".watch-svg");
    var url = "";
    try { if (svg && svg.naturalWidth > 0 && (svg.currentSrc || svg.src)) url = String(svg.currentSrc || svg.src); } catch (_e) {}
    if (!url && v) url = String(v.getAttribute("poster") || "").trim();
    if (!url) { try { url = (curCoverList() || [])[0] || ""; } catch (_e) {} }
    if (!url) return false;
    if (ws) {
      try {
        ws.style.setProperty("background-image", 'url("' + url + '")', "important");
        ws.style.setProperty("background-size", "cover", "important");
        ws.style.setProperty("background-position", "center center", "important");
        ws.style.setProperty("background-repeat", "no-repeat", "important");
        ws.setAttribute("data-cssos-cover-floor", "1");
      } catch (_e) {}
    }
    // 幻灯层如果是空的, 也把这张补进去(它在视频下面, 露出来就是它)
    try { if (svg && !(svg.naturalWidth > 0)) svg.src = url; } catch (_e) {}
    return true;
  }
  function clearCoverFloor() {
    try {
      var ws = document.querySelector('.watch-screen[data-cssos-cover-floor="1"]');
      if (!ws) return;
      ["background-image", "background-size", "background-position", "background-repeat"]
        .forEach(function (k) { ws.style.removeProperty(k); });
      ws.removeAttribute("data-cssos-cover-floor");
    } catch (_e) {}
  }

  function reveal(reason) {
    try {
      var ws = document.querySelector(".watch-screen");
      if (ws && !ws.classList.contains("watch-screen-audio-fallback")) ws.classList.add("watch-screen-audio-fallback");
    } catch (_e) {}
    /* 先铺地板, 再藏视频 —— 顺序不能反: 反过来会有一帧真的是黑的。 */
    try { coverFloor(); } catch (_e) {}
    try { hideVideoHard(document.getElementById("watch-video")); } catch (_e) {}
    try {
      var covers = curCoverList();
      if (covers.length && typeof globalThis.cssmvSetCoverSlides === "function") globalThis.cssmvSetCoverSlides(covers);
      /* 音频必须继续 —— Jing:「即阻止播放视频, 降级幻灯 + 音频。」
       * reveal() 只加一个 CSS 类(把视频压到 opacity:0.1), 不碰音轨; 这里再补一脚,
       * 确保独立音轨没有被"视频播不了"连带停住。 */
      try {
        var auds = document.querySelectorAll("audio");
        for (var ai = 0; ai < auds.length; ai++) {
          var a = auds[ai];
          if (a && a.currentSrc && a.paused) { try { a.play().catch(function () {}); } catch (_e2) {} }
        }
      } catch (_e3) {}
    } catch (_e) {}
  }

  /* CSSOS_WAVE_1975 20260826 — Jing:「播放还是封面图的幻灯, 不是真视频。」
   *
   * 实测现场: video.src 已经是《寻寻觅觅》的真视频, 但 .watch-screen 上挂着
   * watch-screen-audio-fallback —— 那个类把视频压到 opacity:0.1, 封面层透出来,
   * 于是真视频被"盖住"了, 用户看到的是幻灯。
   *
   * 这个类是上一首留下的: 前一首是几秒的短视频垫在整首歌下面, 短视频守卫
   * (cssosShortVideoLoopGuard)给屏幕挂上了它 —— 而【切歌时没有任何人摘掉】。
   * 于是一旦播过一首短视频作品, 后面所有作品都被压成幻灯, 哪怕它有整片真视频。
   *
   * 闸门装在切歌收口(cssos:work-id-changed)上, 而不是去各个挂类的地方补摘 ——
   * 挂它的地方有四处(本模块 / 短视频守卫 / 音频模式 / 多画面胶囊), 逐处补必然漏。
   * 换歌 = 新的一张白纸: 先摘干净, 该挂的那几处会在这一首自己重新判定后再挂。 */
  try {
    globalThis.addEventListener("cssos:work-id-changed", function () {
      try {
        var ws = document.querySelector(".watch-screen");
        if (ws) ws.classList.remove("watch-screen-audio-fallback");
      } catch (_e) {}
      /* W1989b — 摘类的同时也要把我们写死的 inline 撤掉, 否则新一首的视频会
       * 被上一首留下的 opacity:0!important 永久按住 —— 那就是 W1975 那个坑的镜像。 */
      try { showVideoAgain(document.getElementById("watch-video")); } catch (_e) {}
      try { clearCoverFloor(); } catch (_e) {}
    }, { passive: true });
  } catch (_e) {}

  function hasRealVideoSrc(v) {
    var s = String((v && (v.currentSrc || v.getAttribute("src"))) || "");
    return !!s && !/^data:image\/svg/i.test(s) && !/^data:/i.test(s);
  }

  function wire() {
    var v = document.getElementById("watch-video");
    if (!v || v.__cssosFbWired) return;
    v.__cssosFbWired = true;
    v.addEventListener("error", function () { reveal("video-error"); });
    v.addEventListener("stalled", function () { if (v.readyState < 2 && hasRealVideoSrc(v)) reveal("video-stalled"); });
    /* CSSOS_WAVE_1989 — 原来的三个触发条件(error / stalled / readyState 0)漏掉了
     * 【最典型的那一种】: 特斯拉这类车机浏览器把视频【加载成功但不许播】——
     * readyState 是 2+、没有 error、也不 stalled, 于是一条都不命中, 用户面前
     * 就是一个黑乎乎的媒体框, 永远不降级。补三条: */
    // ① play() 被策略拒绝(NotAllowedError / NotSupportedError)
    if (!v.__cssosPlayWrapped) {
      v.__cssosPlayWrapped = true;
      var _origPlay = v.play;
      try {
        v.play = function () {
          var p;
          try { p = _origPlay.apply(this, arguments); } catch (e) { reveal("play-throw"); throw e; }
          if (p && typeof p.catch === "function") {
            p.catch(function (err) {
              var n = String((err && err.name) || "");
              if (n === "NotAllowedError" || n === "NotSupportedError" || n === "AbortError") reveal("play-rejected:" + n);
            });
          }
          return p;
        };
      } catch (_e) {}
    }
    // ② 编解码根本不支持 —— 不用等, 挂上源就知道
    v.addEventListener("loadstart", function () {
      try {
        if (!hasRealVideoSrc(v) || typeof v.canPlayType !== "function") return;
        var src = String(v.currentSrc || v.src || "");
        var m = /\.mp4(\?|$)/i.test(src) ? "video/mp4"
              : /\.webm(\?|$)/i.test(src) ? "video/webm"
              : /\.mov(\?|$)/i.test(src) ? "video/quicktime" : "";
        if (m && v.canPlayType(m) === "") reveal("codec-unsupported:" + m);
      } catch (_e) {}
    });
  }

  // 轮询: 影院开着 + 视频有真源, 但 readyState 长时间为 0(被拦/解码不出)→ 透出幻灯。
  var stuckSince = 0;
  function poll() {
    wire();
    var panel = document.getElementById("watch-panel");
    var v = document.getElementById("watch-video");
    if (!panel || panel.classList.contains("hidden") || !v) { stuckSince = 0; return; }
    if (v.error) { reveal("video-error-state"); return; }
    if (hasRealVideoSrc(v) && v.readyState === 0) {
      // readyState 0 = 没拿到任何数据。给 4.5s 宽限(冷加载), 超过则判定被拦/放不出。
      var now = (globalThis.performance && performance.now) ? performance.now() : 0;
      if (!stuckSince) stuckSince = now;
      else if (now - stuckSince > 4500) { reveal("video-blocked"); stuckSince = 0; }
    } else { stuckSince = 0; }
    /* ③ CSSOS_WAVE_1989 —「加载好了但画面不走」看门狗。
     * readyState>=2 且有真源, 但 currentTime 连续 ~5s 一动不动 —— 无论是被策略暂停、
     * 解码卡死还是静默拒播, 对用户都是同一件事: 黑框。判据只看【画面有没有在走】,
     * 不去猜是哪一种原因(猜原因就会漏, 特斯拉那种正是被漏掉的一类)。
     * 用户自己按暂停不算: v.paused 且从未播过(currentTime 0)才判死; 播过又暂停的放过。 */
    try {
      if (hasRealVideoSrc(v) && v.readyState >= 2 && !v.ended) {
        var t = Number(v.currentTime) || 0;
        var userPaused = v.paused && t > 0.05;   // 播过再暂停 = 用户意图, 不降级
        if (!userPaused) {
          if (v.__cssosLastT === t) {
            v.__cssosFrozen = (v.__cssosFrozen || 0) + 1;   // poll 每 2.5s 一次
            if (v.__cssosFrozen >= 2) { reveal("video-frozen"); v.__cssosFrozen = 0; }
          } else { v.__cssosFrozen = 0; }
          v.__cssosLastT = t;
        } else { v.__cssosFrozen = 0; v.__cssosLastT = t; }
      }
    } catch (_e) {}
    /* W1989b — 降级态期间持续把画面按住(旋转路径每次同步都会重写 inline style);
     * 一旦不在降级态了, 立刻把我们写的 inline 撤掉, 绝不留下一个永远看不见的视频。 */
    try {
      var ws2 = v.closest ? v.closest(".watch-screen") : document.querySelector(".watch-screen");
      if (ws2 && ws2.classList.contains("watch-screen-audio-fallback")) {
        hideVideoHard(v);
        /* CSSOS_WAVE_2002b — 地板也要在这里补。
         * coverFloor() 原来只在 reveal() 里跑, 可【挂上降级类的地方有四处】
         * (本模块 / 短视频守卫 / 音频模式 / 多画面胶囊) —— 另外三处挂了类却
         * 没铺地板, 视频一藏就是黑。这正是 Jing 看到黑框的场景。
         * 装在 poll 的自愈分支上, 无论谁挂的类都能兜住(与 W1975 同一个打法:
         * 闸门装在必经之路, 不去各个挂类的地方补)。 */
        try { if (!ws2.getAttribute("data-cssos-cover-floor")) coverFloor(); } catch (_e) {}
      } else { showVideoAgain(v); clearCoverFloor(); }
    } catch (_e) {}
  }

  // CSSOS_WAVE_924 — Jing「轻装上阵」: 1500ms→2500ms(省 ~40%)。poll 本就在面板 hidden 时秒退(几乎零成本),
  // 它只为"视频被拦/解码不出"兜底, 不需高频; 冷加载宽限仍是 4500ms, 体验不变。
  function start() { wire(); setInterval(poll, 2500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
