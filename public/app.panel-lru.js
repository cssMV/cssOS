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

  var MAX_OPEN = 5;
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
    return isPlayingMedia(el);                              // 正在播放媒体 → 豁免
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
