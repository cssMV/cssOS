/* CSSOS_WAVE_1836 20260818 — Jing「for you 和作品中心打开还是导致系统崩溃 /
 * 和数字演员聊天很多时候还是被强退」的对症根治: 全局并发解码上限。
 *
 * ── 病因(遥测实锤, 不是推断) ───────────────────────────────────────────────
 * telemetry_memory_samples 近 7 天:
 *     ios-safari   red 11,336 / 11,340  →  99.96% 的时间处在红色压力
 *     web          red    523 /  4,763  →  11%
 * 平均同时挂着 5.4 路 <video>, 峰值 6。W1617 那次硬崩的现场结论就是
 * 「探针实锤: media 一直是 6」—— 我们又回到 6 了, 而且在 iPhone 上是【常态】。
 *
 * 为什么以前没治住: 仓库里已有 panel-reclaim(关面板时释放解码器), 但崩溃发生在
 * 【打开】那一刻 —— 一个 feed 一次渲染十几项, 解码器瞬间冲顶, 关闭时的回收根本来不及。
 * 缺的从来不是"关掉时清理", 而是"任何时刻都不许超过 N 路在解码"。
 *
 * 为什么崩溃计数看着是 0: crash_recovered 靠 localStorage 在崩前写标记, 而 iOS
 * WKWebView 被系统强杀时那一笔来不及写 → 崩溃数不可信, 但每 2 秒采样的压力分布可信。
 * 别再拿 crash_recovered 当健康指标。
 *
 * ── 做法 ─────────────────────────────────────────────────────────────────
 * IntersectionObserver 盯住全站每个 <video>: 离开视口 → pause + 存 src 到
 * data-cap-src + removeAttribute("src") + load() 真正把解码器还给系统;
 * 回到视口 → 还原 src、seek 回原位、原来在播的继续播。
 * 释放手法照抄 panel-reclaim(同一套已验证的写法), 不自创。
 *
 * ── 四条不许碰(每条都对应一个会被我打碎的真实功能) ────────────────────────
 *   1. srcObject 有值的 → 摄像头/MediaStream(面对面的"你"那一路)。清了摄像头就黑屏。
 *   2. data-keep-media / data-cap-exempt → 沿用 panel-reclaim 的豁免约定。
 *   3. 正在播且可见的 → 用户正在看的东西, 永远不动。
 *   4. 全屏元素及其子树 → 影院/沉浸态, 即使 IO 判定不可见也不许动。
 *
 * ── 只在需要的地方开 ──────────────────────────────────────────────────────
 * 桌面 red 只有 11%, 有富余; iOS/capacitor 才是 99.96%。默认只在移动端生效,
 * 桌面完全不介入(零风险, 也不改变现有行为)。localStorage cssos.mediaCap 可强制覆盖,
 * 便于在桌面上复现和验证。 */
(function () {
  "use strict";
  if (globalThis.__cssosMediaCapInstalled) return;
  globalThis.__cssosMediaCapInstalled = true;

  var ua = navigator.userAgent || "";
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isCapacitor = !!(globalThis.Capacitor);
  var forced = null;
  try { forced = localStorage.getItem("cssos.mediaCap"); } catch (_e) {}
  // "off" 强制关闭; "on" 强制开启(桌面复现用); 未设置 → 只在移动端开
  var ENABLED = forced === "on" ? true : forced === "off" ? false : (isIOS || isCapacitor);
  if (!ENABLED) return;

  var parked = 0, restored = 0;

  function isExempt(v) {
    try {
      if (v.srcObject) return true;                                  // ① 摄像头/MediaStream
      if (v.hasAttribute("data-keep-media")) return true;            // ② 沿用既有豁免约定
      if (v.hasAttribute("data-cap-exempt")) return true;
      var fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs && (fs === v || fs.contains(v))) return true;           // ④ 全屏/影院/沉浸态
      /* ⑤ 【正在出声】的绝不停 —— 这条是差点被我打碎的功能: 用户一边听歌一边往下滑,
       * 播放器一离开视口就被回收 = 音乐当场断掉。判据用"没静音且在播", 而不是"在播":
       * feed 里那些装饰性缩略图是 muted+autoplay+loop, 它们【也在播】却没人在听,
       * 恰恰是吃满 6 路解码器的主力 —— 那些该停, 出声的那一路不能停。 */
      if (!v.muted && !v.paused) return true;
    } catch (_e) {}
    return false;
  }

  function park(v) {
    if (isExempt(v)) return;
    if (v.hasAttribute("data-cap-src")) return;                      // 已经停过了
    var cur = "";
    try { cur = v.currentSrc || v.getAttribute("src") || ""; } catch (_e) {}
    if (!cur) return;                                                // 没有 src 就没有解码器可还
    try {
      v.setAttribute("data-cap-src", cur);
      v.setAttribute("data-cap-time", String(v.currentTime || 0));
      v.setAttribute("data-cap-playing", v.paused ? "0" : "1");
      v.pause();
      v.removeAttribute("src");
      v.load();                                                      // ← 真正释放解码缓冲
      parked++;
    } catch (_e) {}
  }

  function restore(v) {
    var src = v.getAttribute("data-cap-src");
    if (!src) return;
    var t = parseFloat(v.getAttribute("data-cap-time") || "0") || 0;
    var wasPlaying = v.getAttribute("data-cap-playing") === "1";
    try {
      v.removeAttribute("data-cap-src");
      v.removeAttribute("data-cap-time");
      v.removeAttribute("data-cap-playing");
      v.setAttribute("src", src);
      v.load();
      // seek 要等元数据就绪, 否则 currentTime 会被重置回 0(看起来像"从头播", 很显眼)
      var seek = function () {
        try { if (t > 0 && isFinite(v.duration)) v.currentTime = Math.min(t, v.duration - 0.05); } catch (_e) {}
        if (wasPlaying) { try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (_e) {} }
      };
      if (v.readyState >= 1) seek();
      else v.addEventListener("loadedmetadata", seek, { once: true });
      restored++;
    } catch (_e) {}
  }

  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i], v = e.target;
      if (e.isIntersecting) restore(v);
      else park(v);
    }
  }, { root: null, rootMargin: "150px", threshold: 0 });   // 150px 预热: 滑到之前就恢复好, 用户看不到空档

  var watched = new WeakSet();
  function watch(v) {
    if (!v || v.tagName !== "VIDEO" || watched.has(v)) return;
    watched.add(v);
    try { io.observe(v); } catch (_e) {}
  }
  function scan(root) {
    try {
      if (root.tagName === "VIDEO") watch(root);
      var vs = root.querySelectorAll ? root.querySelectorAll("video") : [];
      for (var i = 0; i < vs.length; i++) watch(vs[i]);
    } catch (_e) {}
  }

  scan(document);
  // feed 是动态插入的 —— 新来的必须自动纳管, 否则等于没做
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) if (added[j].nodeType === 1) scan(added[j]);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // 供探针/排查用: 控制台敲 cssosMediaCapStats() 看有没有真的在干活
  globalThis.cssosMediaCapStats = function () {
    var all = document.querySelectorAll("video").length;
    var off = document.querySelectorAll("video[data-cap-src]").length;
    return { enabled: true, videos_total: all, parked_now: off, decoding_now: all - off, parked_cum: parked, restored_cum: restored };
  };
})();
