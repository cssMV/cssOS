/* CSSOS_WAVE_516 20260530 — Jing「页面无限重新加载真凶」根治版.
 *
 * 历史(W393/W485j): 本守卫曾轮询 /build.txt, 一旦与页面内嵌 window.__CSSOS_BUILD 不一致就
 * location.reload() 自动追新版。在【频繁部署】期, 设备载入的 build 永远落后线上一个版本 →
 * 每隔几秒 reload 一次 = 用户看到的"无限刷新/闪"。bootprobe 实锤: head-start→DOMContentLoaded
 * →window.load→alive-3s→(>3s 后)又 head-start 的循环, 永远到不了 alive-8s。reload 瞬间页面销毁,
 * crash-guard 的 location.reload 上报来不及发 → 日志里看不到, 一度误导排查。
 *
 * 根治: 彻底移除自动版本检查与自动 reload。SW 对导航本就 network-first(W395), 用户下次
 * 自然导航 / 手动刷新即获最新版, 永不主动打断。仅启动后静默 serviceWorker.update() 一次
 * (只让 SW 在后台取新脚本, 不重载页面)。 */
(function () {
  "use strict";
  if (window.__cssosBuildGuardInstalled) return;
  window.__cssosBuildGuardInstalled = true;

  // CSSOS_WAVE_712 — Jing: 「每次更新自动清缓存, 不用每次怀疑是缓存」。
  // 安全的自动更新(绝不重蹈 W516 无限刷新): 用【事件驱动】而非轮询比对版本。
  //   ① 监听 controllerchange —— 新 SW【接管】时只触发一次的事件(每次部署 bump 缓存版本 → 新
  //      sw.js → install+skipWaiting → activate+clients.claim → controllerchange)。
  //   ② 双重防护防循环: a) reloaded 一次性闸; b) 仅当【本来就有 controller】(=真·更新, 非首次
  //      安装的首次 claim)才 reload。首装不刷; 更新刷恰好一次; 之后无更新→无事件→无循环。
  try {
    if (navigator.serviceWorker) {
      var hadController = !!navigator.serviceWorker.controller;
      var reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (reloaded) return;
        reloaded = true;
        if (hadController) { try { window.location.reload(); } catch (_e) {} }
      });
    }
  } catch (_e) {}

  // 启动 4s 后静默检查 SW 更新。若发现新版 → 上面的 controllerchange 会自动刷新一次拿到最新资源。
  setTimeout(function () {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then(function (reg) {
          if (reg && reg.update) { try { reg.update(); } catch (_e) {} }
        }).catch(function () {});
      }
    } catch (_e) {}
  }, 4000);
})();
