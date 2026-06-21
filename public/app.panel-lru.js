/* CSSOS_WAVE_526 20260530 — Jing「内核: 同时最多 5 个面板, LRU 淘汰, 切歌/关闭清内存」.
 *
 * 设计初衷(Jing): 同时最多 5 个面板(5 JS + 5 CSS)。开第 6 个 → 自动淘汰最久未用的那个,
 * 把它从内存清理掉(DOM/媒体/blob, 复用 W520 panel-reclaim)。唯一例外: 正在【播放媒体】的
 * MV/watch 面板豁免, 一直开着直到用户手动关闭。一次到位、对所有面板生效。
 *
 * 实现(零侵入, 不改各面板代码):
 *   - 监测所有 .panel 元素的 .hidden class 变化(覆盖一切打开/关闭路径)。
 *   - MRU 只收录【被观察到 hidden→visible 转换过】的面板 = 用户主动打开的。常开核心(logo-panel
 *     魔镜从不切换)永不进入 MRU → 永不被淘汰。再加 data-lru-keep 属性双保险。
 *   - 打开第 6 个时, 从队尾(最久未用)淘汰, 跳过豁免者(data-lru-keep / 正在播放媒体)。
 *   - 淘汰 = 调既有 minimizeToDockBridge(派发 cssos:panelclose → W520 回收媒体/blob)。
 *
 * 调参/观测: cssosPanelLru.max(n) 改上限; cssosPanelLru.state() 看当前 MRU。 */
(function () {
  "use strict";
  if (globalThis.__cssosPanelLruInstalled) return;
  globalThis.__cssosPanelLruInstalled = true;

  // CSSOS_WAVE_1011 20260619 — Jing: 1→2。严格 1 + "MV 在播则豁免不关"(W1010)会导致点别的面板时
  // 驱逐不了豁免的 MV → 新面板被盖住"点了不显示"。改 2: 正在播的 MV + 用户点开的那个面板共存(新的在上
  // 层显示), 开第 3 个再淘汰最旧的非豁免者。仍远小于原 5, 配合 W1000 吸血鬼治理, 内存安全。
  var MAX_OPEN = 2;   // W999→W1011: 单线程基本只 1 激活, 但留 1 个缓冲位给"MV 在播 + 看另一面板"

  var mru = [];            // 面板元素数组, 队首=最近使用
  var evicting = false;    // 防重入
  var rafPending = false;

  function isPanel(el) {
    return !!(el && el.nodeType === 1 && el.classList && el.classList.contains("panel"));
  }
  function isOpen(el) {
    return isPanel(el) && !el.classList.contains("hidden");
  }
  function isPlayingMedia(el) {
    try {
      var m = el.querySelectorAll("video, audio");
      for (var i = 0; i < m.length; i++) {
        if (!m[i].paused && !m[i].ended && (m[i].currentTime || 0) > 0) return true;
      }
    } catch (_e) {}
    return false;
  }
  function isExempt(el) {
    try {
      if (el.hasAttribute("data-lru-keep")) return true;   // 显式豁免(logo 等核心)
    } catch (_e) {}
    if (isPlayingMedia(el)) return true;                   // 面板【内】有媒体在播 → 豁免
    // CSSOS_WAVE_1010 20260619 — Jing「MV 黑屏只有声音, watch 面板被关」根因: 播放用的
    // #watch-audio-preview / #watch-video 挂在【body 级】不在面板内 → isPlayingMedia(panel) 查不到
    // → 单面板 LRU 误判正在播放的 watch/MV 面板空闲 → 一有别的面板动作就驱逐它 → 黑屏+只剩声音
    // (也是"面板出不来 / 3 首就停"的真因)。修: watch/MV 类面板, 只要 body 级 watch 媒体在播就豁免。
    try {
      var id = el.id || "";
      if (id === "watch-panel" || id === "mv-pipeline-panel" || id === "cssmv-panel" || id === "person-mv-panel") {
        var a = document.getElementById("watch-audio-preview");
        var v = document.getElementById("watch-video");
        if (a && !a.paused && !a.ended && (a.currentTime || 0) > 0) return true;
        if (v && !v.paused && !v.ended && (v.currentTime || 0) > 0) return true;
        // 影院模式标记也算"正在用 MV"(刚进影院 audio 可能还没起播)。
        try { if (document.body && document.body.classList.contains("cssos-cinema-mode")) return true; } catch (_e2) {}
      }
    } catch (_e) {}
    return false;
  }

  function touch(el) {
    var i = mru.indexOf(el);
    if (i !== -1) mru.splice(i, 1);
    mru.unshift(el);
  }
  function forget(el) {
    var i = mru.indexOf(el);
    if (i !== -1) mru.splice(i, 1);
  }

  function enforce() {
    if (evicting) return;
    evicting = true;
    try {
      // 当前仍打开、且在 MRU 里的面板(队首→队尾 = 近→久)
      var open = mru.filter(isOpen);
      var overflow = open.length - MAX_OPEN;
      if (overflow > 0) {
        // 从队尾(最久未用)往前淘汰, 跳过豁免者
        for (var i = open.length - 1; i >= 0 && overflow > 0; i--) {
          var el = open[i];
          if (isExempt(el)) continue;
          try {
            if (typeof globalThis.minimizeToDockBridge === "function") {
              globalThis.minimizeToDockBridge(el); // → .hidden + cssos:panelclose → W520 回收
            } else {
              el.classList.add("hidden");
              try { el.dispatchEvent(new CustomEvent("cssos:panelclose", { bubbles: false })); } catch (_d) {}
            }
          } catch (_e) {}
          forget(el);
          overflow--;
        }
      }
    } finally {
      evicting = false;
    }
  }

  function scheduleEnforce() {
    if (rafPending) return;
    rafPending = true;
    (globalThis.requestAnimationFrame || function (f) { setTimeout(f, 16); })(function () {
      rafPending = false;
      enforce();
    });
  }

  var mo = new MutationObserver(function (muts) {
    var changed = false;
    for (var k = 0; k < muts.length; k++) {
      var t = muts[k].target;
      if (!isPanel(t)) continue;
      if (isOpen(t)) { touch(t); changed = true; }   // 只在观察到打开时收录 → 常开核心永不进 MRU
      else { forget(t); }
    }
    if (changed) scheduleEnforce();
  });

  function start() {
    try {
      mo.observe(document.body || document.documentElement, {
        attributes: true, attributeFilter: ["class"], subtree: true,
      });
    } catch (_e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  globalThis.cssosPanelLru = {
    max: function (n) { if (typeof n === "number" && n > 0) MAX_OPEN = n; return MAX_OPEN; },
    state: function () { return mru.filter(isOpen).map(function (p) { return p.id || p.className; }); },
    evict: enforce,
  };
})();
