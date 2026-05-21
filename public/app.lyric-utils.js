/* CSSOS_WAVE_249 20260520 — Jing: 根治"动不动刷新返回主界面".
 *
 * 根因(40h journalctl 数据): `compactLyricLines is not defined` 占全部
 * window.error 的 98% (9756/9910 次). 调用栈是播放时每帧轮询的热循环
 * (watch-media-layout readProgress → watch-ui isWatchLyricsReadyModule),
 * 一个播放会话刷几千条 ReferenceError → 压垮 iOS WKWebView 看门狗 →
 * webview 被强杀重启 → 回到主界面 + 已输入数据丢失.
 *
 * 为什么未定义: compactLyricLines 原本只在 app.work-sync.js (脚本顺序
 * 第 2198 行) 定义, 但 watch-audio-polling.js(2130) / voice-seed /
 * voice-submit / creation-flow / song-seed-ui 等 5 个调用方都在它之前
 * 加载. 经典脚本靠"运行时才取全局"兜底, 但客户端缓存版本错位时
 * (旧 watch-ui.js + 新 index.html) 全局尚未绑定即被每帧调用 → 抛错.
 *
 * 修复: 把这个纯函数提到极早加载 (紧跟 crash-guard, 早于所有调用方),
 * 直接挂 globalThis, 不再依赖 14 个文件的精确加载顺序. work-sync.js
 * 里的同名顶层声明保留 (后加载, 同实现覆盖, 无副作用), 这样新旧缓存
 * 客户端都能解析到全局, 彻底消除这条 ReferenceError 洪流. */
(function () {
  "use strict";
  if (typeof globalThis.compactLyricLines === "function") return;
  globalThis.compactLyricLines = function compactLyricLines(lines = []) {
    return (Array.isArray(lines) ? lines : [])
      .map((line) => String(line || "").trim())
      .filter(
        (line) =>
          line && !/^title\s*·/i.test(line) && !/^\[[^\]]+\]$/.test(line),
      );
  };
})();
