/* CSSOS_WAVE_1845 20260821 — Jing:「请加上那个逐首版本, 我在 iPhone 上播几首给你。」
 *
 * ── 为什么需要它 ──────────────────────────────────────────────────────────
 * 「播十首左右退出」的泄漏, 我已经猜错三次(先怀疑切歌没调 bind, 再怀疑 root 归一合并
 * 三部曲, 再怀疑弹幕轨)。每次都是【静态读代码】猜的, 而运行时真相只有一次采样能给。
 * 30 秒一次的常规 beacon 是【按时间】采的, 落点和换歌时刻对不齐 —— 拿到的样本说
 * "现在 DOM 是 8054", 却说不出"这 8054 是第几首堆出来的、每首堆多少"。
 *
 * ── 做法 ─────────────────────────────────────────────────────────────────
 * 只做一件事: 每次换歌时敲一下【已有的】探针 beacon, 把 reason 标成 track_N。
 * 于是服务端拿到的是一串对齐到换歌时刻的快照, 相邻两条相减 = 【这一首歌堆了多少节点】,
 * 而每条自带 dom_hotspot.top3(已剔祖先)= 堆在哪个容器。
 * 一次播放就能得到逐首账本: 第 N 首 → DOM +X → 容器 Y。
 *
 * 不新增端点、不新增表、不新增采样循环 —— 全部复用 W220A 探针和 W1837/W1838 的列。
 * 我不需要再猜第四次。
 *
 * ── 两条自我约束 ─────────────────────────────────────────────────────────
 *  ① 去抖 1.5s: W1839 之后一次换歌可能派发两个事件(整首切换 + partOnly), 别把一首记成两首。
 *  ② 上限 40 首: 这是诊断工具不是常驻遥测, 播满 40 首自动闭嘴, 不给服务端刷量。 */
(function () {
  "use strict";
  if (globalThis.__cssosTrackLedgerWired) return;
  globalThis.__cssosTrackLedgerWired = true;

  var MAX_TRACKS = 40, DEBOUNCE_MS = 1500;
  var n = 0, lastAt = 0;

  function fire() {
    var now = Date.now();
    if (now - lastAt < DEBOUNCE_MS) return;      // ① 去抖
    lastAt = now;
    if (n >= MAX_TRACKS) return;                 // ② 上限
    n += 1;
    try {
      if (globalThis.cssmemProbe && typeof globalThis.cssmemProbe.beacon === "function") {
        globalThis.cssmemProbe.beacon("track_" + n);
      }
    } catch (_e) {}
  }

  window.addEventListener("cssos:work-id-changed", fire, { passive: true });
  // 开播那一刻先记一条基线(track_1 之前的起点), 否则第一首的增量无从相减
  setTimeout(function () {
    try {
      if (globalThis.cssmemProbe && typeof globalThis.cssmemProbe.beacon === "function") {
        globalThis.cssmemProbe.beacon("track_0_baseline");
      }
    } catch (_e) {}
  }, 4000);

  globalThis.cssosTrackLedgerCount = function () { return n; };
})();
