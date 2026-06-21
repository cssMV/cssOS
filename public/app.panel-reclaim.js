/* CSSOS_WAVE_520 20260530 — Jing「内核: 关谁销毁谁」面板内存回收(load-on-demand 的另一半).
 *
 * 设计初衷(Jing): 内核启动谁谁才显示, 关闭谁就把它从内存里清理掉。懒加载只省了首屏 JS 体积;
 * 真正撑爆 iPhone 的是【面板开了又开, DOM/解码位图/video-audio 解码缓冲只增不减】。本模块挂在
 * 已有的统一关闭信号上 —— panel-shell-actions.js 的 minimizeToDockBridge() 关/收面板时派发的
 * `cssos:panelclose` 事件 —— 面板一关就回收它最吃内存的资源, 且全部【可逆】(面板再开时各自的
 * render/源决策逻辑会重建), 对所有面板通用、不依赖"孤岛"、不碰加载耦合 → 低风险。
 *
 * 回收内容(从重到轻):
 *   1. <video>/<audio>: pause + 记下 src 到 data-reclaimed-src + 清空 src + load() → 释放
 *      解码缓冲(iOS 上单个视频解码缓冲可达数十 MB, 这是最大头)。再开时面板源决策逻辑重设 src。
 *   2. blob: 对象 URL(src/href/background): URL.revokeObjectURL → 释放 blob 内存。
 *   3. 已知常驻循环: 封面幻灯(cssmvStopCoverSlideshow)等 —— 停掉定时器, 不再 setInterval 重绘。
 *   4. 派发 `cssos:panelreclaim`(bubbles:false)给面板, 让各面板按需做自定义 teardown
 *      (断开 observer、置空大缓存等), 无则无害。
 *
 * 安全护栏: 带 [data-keep-media] 的元素不动(正在后台续播的场景可显式保留)。整段全 try/catch,
 * 任何单点失败都不影响关闭本身。 */
(function () {
  "use strict";
  if (globalThis.__cssosPanelReclaimInstalled) return;
  globalThis.__cssosPanelReclaimInstalled = true;

  function revokeIfBlob(url) {
    try {
      if (typeof url === "string" && url.indexOf("blob:") === 0) {
        URL.revokeObjectURL(url);
        return true;
      }
    } catch (_e) {}
    return false;
  }

  function reclaimMedia(root) {
    var freed = 0;
    try {
      var media = root.querySelectorAll("video, audio");
      for (var i = 0; i < media.length; i++) {
        var el = media[i];
        if (el.hasAttribute("data-keep-media")) continue;
        try { el.pause(); } catch (_p) {}
        var cur = el.currentSrc || el.getAttribute("src") || "";
        // 释放 <source> 子节点的 blob 也一并撤销
        try {
          var srcs = el.querySelectorAll("source");
          for (var s = 0; s < srcs.length; s++) {
            revokeIfBlob(srcs[s].getAttribute("src") || "");
          }
        } catch (_s) {}
        revokeIfBlob(cur);
        if (cur) {
          // 记下原 src, 供需要时恢复; 再开面板时各自源决策逻辑通常会重设。
          try { el.setAttribute("data-reclaimed-src", cur); } catch (_d) {}
        }
        try {
          el.removeAttribute("src");
          // 清掉 <source> 子节点
          var kids = el.querySelectorAll("source");
          for (var k = kids.length - 1; k >= 0; k--) kids[k].remove();
          el.load(); // 真正释放解码缓冲
          freed++;
        } catch (_l) {}
      }
    } catch (_e) {}
    return freed;
  }

  function reclaimBlobUrls(root) {
    try {
      // src / href 属性里的 blob:
      var withSrc = root.querySelectorAll("[src], [href]");
      for (var i = 0; i < withSrc.length; i++) {
        var el = withSrc[i];
        if (el.tagName === "VIDEO" || el.tagName === "AUDIO" || el.tagName === "SOURCE") continue; // 上面已处理
        revokeIfBlob(el.getAttribute("src") || "");
        revokeIfBlob(el.getAttribute("href") || "");
      }
    } catch (_e) {}
  }

  function stopResidentLoops(panel) {
    // 封面幻灯(watch 面板)关掉就别再每 TICK 重绘了。
    try {
      var id = (panel && panel.id) || "";
      if (id === "watch-panel" || (panel && panel.querySelector && panel.querySelector("#watch-svg, #watch-music-art"))) {
        if (typeof globalThis.cssmvStopCoverSlideshow === "function") globalThis.cssmvStopCoverSlideshow();
      }
    } catch (_e) {}
  }

  function reclaim(panel) {
    if (!panel || panel.nodeType !== 1) return;
    try {
      var v = reclaimMedia(panel);
      reclaimBlobUrls(panel);
      stopResidentLoops(panel);
      // CSSOS_WAVE_819 20260616 — Jing「覆盖≠关闭, 关面板必须彻底释放」: 关 watch 面板时
      // 调用统一释放例程(此前 reclaim 只清 DOM 媒体, 漏了帧位图/dataURL池/运镜blob/帧循环
      // 定时器/backstop —— 全驻留 = OOM 累积)。flushAllAssetCaches 已含这些(W819 补全)。
      try {
        var pid = (panel && panel.id) || "";
        if (pid === "watch-panel" && typeof globalThis.cssosFlushAllAssetCaches === "function") {
          globalThis.cssosFlushAllAssetCaches();
        }
      } catch (_f) {}
      // 给面板一个自定义 teardown 的机会(断 observer / 置空大状态)。
      try { panel.dispatchEvent(new CustomEvent("cssos:panelreclaim", { bubbles: false })); } catch (_c) {}
      try { console.debug("[panel-reclaim] " + (panel.id || "?") + " media-freed=" + v); } catch (_d) {}
    } catch (_e) {}
  }

  // 监听统一关闭信号(minimizeToDockBridge 派发)。用捕获, 面板自身的 close 处理后我们再回收。
  document.addEventListener("cssos:panelclose", function (ev) {
    try {
      var panel = ev && ev.target;
      if (panel && panel.nodeType === 1) {
        // 放到下一帧, 让面板自身的 close 动画/状态先跑完, 再回收资源。
        (globalThis.requestAnimationFrame || function (f) { setTimeout(f, 16); })(function () {
          reclaim(panel);
        });
      }
    } catch (_e) {}
  }, false);

  // 公开: 允许任意代码主动回收某面板(按 id 或元素)。
  globalThis.cssosReclaimPanel = function (panelOrId) {
    var el = (typeof panelOrId === "string") ? document.getElementById(panelOrId) : panelOrId;
    reclaim(el);
  };
})();
