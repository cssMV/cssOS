/* CSSOS_WAVE_1860 20260822 — Jing「我期望, 24 小时播放不间断。」
 *
 * ── 为什么需要这道保险 ──────────────────────────────────────────────────────
 * W1857 修好了一条具体的死锁(音频权威把放完的歌"救活"→ 守卫误判 → 永不切歌),
 * 但 24 小时连播面对的不是某一个已知 bug, 而是【任何一次没被接住的意外】:
 *   · 某首歌的 ended 因为竞态没触发切歌
 *   · 网络抖动让 currentTime 卡住不前进
 *   · 上游资源 404 / 解码失败, 元素停在 readyState 0
 * 只要发生一次, 播放就永远停在那 —— 用户回来看到的是一个死掉的播放器。
 * 逐个修永远修不完; 需要一条【不问原因、只问结果】的兜底: 该动而没动, 就推它一把。
 *
 * ── 判据(刻意保守, 宁可不救也不误伤) ───────────────────────────────────────
 * 只在【本该播放却没有进展】时介入:
 *   ① 有 src 且未暂停, 但 currentTime 连续 STALL_S 秒没变 → 卡死
 *   ② ended 已经 true 且持续 ENDED_S 秒仍没换歌 → 切歌没被接住
 * 以下一律不管(它们是用户的意图或正常状态):
 *   · 用户主动暂停(paused 但没 ended, 且 cssosAudioIntentPaused 为真)
 *   · 页面不可见(浏览器本来就会挂起后台媒体, 这时"不前进"是正常的)
 *   · 面板关着 / 没有 src
 *
 * ── 为什么先 play() 再 advance ─────────────────────────────────────────────
 * 卡住不一定要换歌 —— 先尝试续播(便宜、无损)。同一首上最多试 RESUME_MAX 次,
 * 还不动才换下一首。这样"网络抖一下"不会导致跳歌, 而"真的死了"最终一定会前进。 */
(function () {
  "use strict";
  if (globalThis.__cssosPlaybackWatchdogInstalled) return;
  globalThis.__cssosPlaybackWatchdogInstalled = true;

  var TICK_MS    = 5000;
  var STALL_S    = 30;   // 播放中卡住多久算死
  var ENDED_S    = 6;    // 放完后多久没换歌算漏接
  var RESUME_MAX = 2;    // 同一首最多续播几次, 之后强制前进
  var COOLDOWN_S = 20;   // 两次介入的最小间隔, 防抖防连跳

  var lastSrc = "", lastT = -1, sameFor = 0, endedFor = 0, resumes = 0, lastActAt = 0;
  var acted = { resume: 0, advance: 0 };

  function el() {
    var a = document.getElementById("watch-audio-preview");
    var v = document.getElementById("watch-video");
    var as = a && (a.currentSrc || a.src);
    var vs = v && (v.currentSrc || v.src);
    if (as && (!a.paused || !vs)) return a;
    if (vs) return v;
    return as ? a : null;
  }
  function srcOf(m) { try { return String((m && (m.currentSrc || m.src)) || "").split("?")[0]; } catch (e) { return ""; } }
  function panelOpen() {
    var wp = document.getElementById("watch-panel");
    if (!wp) return false;
    try { return !wp.classList.contains("hidden") && getComputedStyle(wp).display !== "none"; } catch (e) { return false; }
  }
  function intentPaused() { try { return !!globalThis.cssosAudioIntentPaused; } catch (e) { return false; } }
  function cool() { return (Date.now() - lastActAt) / 1000 < COOLDOWN_S; }

  function advance(why) {
    if (cool()) return;
    lastActAt = Date.now();
    acted.advance++;
    try { console.warn("[watchdog] 强制前进 —— " + why); } catch (e) {}
    try { globalThis.watchQueueAdvanceModule && globalThis.watchQueueAdvanceModule(+1); } catch (e) {}
    resumes = 0; sameFor = 0; endedFor = 0; lastT = -1;
  }

  setInterval(function () {
    try {
      if (document.visibilityState !== "visible") { sameFor = 0; endedFor = 0; return; }  // 后台挂起是正常的
      if (!panelOpen()) { sameFor = 0; endedFor = 0; return; }
      var m = el();
      if (!m || !srcOf(m)) return;

      var s = srcOf(m);
      if (s !== lastSrc) { lastSrc = s; lastT = -1; sameFor = 0; endedFor = 0; resumes = 0; return; }

      if (m.ended) {                                   // ② 放完了却没人换歌
        endedFor += TICK_MS / 1000;
        if (endedFor >= ENDED_S) advance("放完 " + Math.round(endedFor) + "s 仍未换歌");
        return;
      }
      endedFor = 0;

      if (m.paused) {                                  // 用户主动暂停 → 不管
        if (intentPaused()) { sameFor = 0; return; }
        sameFor += TICK_MS / 1000;
      } else {
        var t = Math.round(m.currentTime || 0);
        if (t === lastT) sameFor += TICK_MS / 1000;
        else { lastT = t; sameFor = 0; resumes = 0; }
      }

      if (sameFor >= STALL_S) {                        // ① 卡死
        if (resumes < RESUME_MAX) {
          if (cool()) return;
          lastActAt = Date.now(); resumes++; acted.resume++;
          try { console.warn("[watchdog] 卡住 " + Math.round(sameFor) + "s, 尝试续播(第 " + resumes + " 次)"); } catch (e) {}
          try { var p = m.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
          sameFor = 0;
        } else {
          advance("卡住且续播 " + RESUME_MAX + " 次无效");
        }
      }
    } catch (e) { /* 看门狗自己绝不能抛错影响播放 */ }
  }, TICK_MS);

  globalThis.cssosPlaybackWatchdogState = function () {
    var m = el();
    return { 源: srcOf(m).split("/").pop(), 卡住秒: sameFor, 放完秒: endedFor,
             已续播: acted.resume, 已强制前进: acted.advance, 可见: document.visibilityState };
  };
})();
