/* CSSOS_WAVE_259 20260520 — Jing: 钱漏 #3 接线 —— 给 mv 生成请求注入 reuse_ok.
 *
 * 配合服务端 W258 的输入指纹结果复用缓存 (__mvResultCache, opt-in via
 * reuse_ok, 30min TTL). 安全边界 = "仅重试/断点续跑复用, 用户主动重生成
 * 永远出新".
 *
 * 机制:
 *   • fetch 拦截器: 对 POST /api/mv/music 和 /api/mv/video, 默认注入
 *     reuse_ok:true. —— 这是安全的: 服务端缓存只有"同一用户+同一输入+
 *     30min 内已成功生成过"才有条目, 所以初次创建必然 miss → 照常生成;
 *     只有重试/续跑同一内容才命中复用, 正是要省的那次重复付费.
 *   • "求新窗口": 用户主动重生成(W255 入口 / pipeline forceNew)时调用
 *     cssosMvMarkFresh(), 开 3 分钟窗口; 窗口内拦截器 NOT 注入 reuse_ok
 *     → 服务端走正常生成 → 拿到全新结果. 3 分钟足够覆盖一次重生成的
 *     music+video 两个阶段; 过后自动恢复复用. 最坏情况(窗口内的其它
 *     生成被当作"求新")= 不省钱, 不伤用户.
 *
 * 纯前端, 零依赖. 客户端不接这个标志时, 服务端那套就是完全 no-op. */
(function () {
  "use strict";
  if (globalThis.__cssosMvReuseFlagWired) return;
  globalThis.__cssosMvReuseFlagWired = true;

  var FRESH_WINDOW_MS = 180000; // 3 min
  var freshUntil = 0;

  // 用户主动重生成时调用 → 开"求新窗口", 期间不复用.
  globalThis.cssosMvMarkFresh = function () {
    freshUntil = Date.now() + FRESH_WINDOW_MS;
  };
  function inFreshWindow() { return Date.now() < freshUntil; }

  var TARGETS = ["/api/mv/music", "/api/mv/video"];
  function isTarget(url) {
    for (var i = 0; i < TARGETS.length; i++) if (url.indexOf(TARGETS[i]) !== -1) return true;
    return false;
  }

  var _fetch = globalThis.fetch;
  if (typeof _fetch !== "function") return;
  // 兜底: 任何派发 cssos:mv-pipeline-seed(携带 forceNew)的入口都触发求新,
  // 不依赖具体是 shim 还是重模块的 openMvPipelinePanel.
  try {
    document.addEventListener("cssos:mv-pipeline-seed", function (e) {
      try { if (e && e.detail && e.detail.forceNew) globalThis.cssosMvMarkFresh(); } catch (_) {}
    });
  } catch (_) {}

  globalThis.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (method === "POST" && isTarget(String(url)) && !inFreshWindow() &&
          init && typeof init.body === "string") {
        var obj = JSON.parse(init.body);
        if (obj && typeof obj === "object" && obj.reuse_ok === undefined) {
          obj.reuse_ok = true;
          init = Object.assign({}, init, { body: JSON.stringify(obj) });
        }
      }
    } catch (_) { /* never break the request */ }
    return _fetch.call(this, input, init);
  };
})();
