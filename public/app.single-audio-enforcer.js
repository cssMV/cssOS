/* CSSOS_WAVE_1920 20260824 — 单一音源【强制执行】(Jing:「我们很早以前就做到了唯一音源,
 * 现在为什么还出现几首音乐同时播放?」)
 *
 * ── 为什么老的「单一音频权威」拦不住 ──────────────────────────────────────
 * app.watch-audio-authority.js 只管得到【DOM 里的】<audio>/<video>。
 * 但平台有好几处用 new Audio(url) 造【游离元素】—— 它们不在 DOM 里:
 *   app.actor-gallery.js:2619 / 3112 / 3571  (演员语音、问道试听)
 *   app.hymn-player.js:163                   (圣诗播放器)
 * app.echo-probe.js 的注释早就写明了:「new Audio() 建的游离元素不在 DOM 里,
 * querySelectorAll 选不到」。选不到 = 权威看不见 = 压不住。
 * 于是它们和主音轨【同时出声】, 就是 Jing 听到的"几首歌一起放"。
 * 我自己也栽在同一个盲点上: 用 querySelectorAll 数音源, 测出 1 个, 而用户听到 3 个 ——
 * 两边都没错, 是我的尺子量不到那部分。
 *
 * ── 修法: 在 play() 这个唯一入口上强制, 而不是去找是谁放的 ────────────────
 * 任何媒体元素调 play() 都必须经过 HTMLMediaElement.prototype.play。
 * 在这里登记 + 强制: 一个音源要出声, 就把其余【所有】还在出声的暂停 —— 游离的也一样,
 * 因为登记表是按 play() 收的, 不是按 DOM 查的。
 *
 * ── 三条不能碰的例外(碰了就弄坏别的东西) ────────────────────────────────
 *   ① 静音的不算音源(muted / volume=0)—— 背景装饰视频一直在放, 不该被当成打架;
 *   ② 主轨 #watch-audio-preview 与 #watch-video 是【同一首歌的两条轨】, 互不驱逐;
 *   ③ 麦克风采集 #mic-capture-audio 不参与 —— 它是输入不是播放。
 */
(function () {
  "use strict";
  if (globalThis.__cssosSingleAudioEnforced) return;
  globalThis.__cssosSingleAudioEnforced = true;

  var registry = new Set();          // 所有 play() 过的元素(含游离)
  var PAIR = { "watch-audio-preview": 1, "watch-video": 1 };   // 同一首歌的两条轨
  var EXEMPT = { "mic-capture-audio": 1 };

  function audible(el) {
    try {
      if (!el || el.paused || el.ended) return false;
      if (el.muted) return false;
      if (typeof el.volume === "number" && el.volume <= 0.001) return false;
      if (EXEMPT[el.id]) return false;
      return true;
    } catch (_e) { return false; }
  }

  function enforce(winner) {
    var kept = 0, paused = 0;
    registry.forEach(function (el) {
      try {
        if (el === winner) return;
        if (!audible(el)) return;
        // 主轨那两个互为搭档, 不互相驱逐
        if (PAIR[el.id] && PAIR[winner && winner.id]) { kept++; return; }
        el.pause();
        paused++;
        try {
          console.info("[W1920] 压掉并发音源:", el.id || "(游离)",
            String(el.currentSrc || el.src || "").slice(-30));
        } catch (_e) {}
      } catch (_e) {}
    });
    if (paused) {
      try {
        globalThis.cssosReportError &&
          globalThis.cssosReportError("并发音源被压制 x" + paused, "multi_audio_suppressed");
      } catch (_e) {}
    }
    return paused;
  }

  var origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    try {
      registry.add(this);
      if (registry.size > 60) {        // 防登记表无限膨胀: 清掉已经播完/被回收的
        registry.forEach(function (e) { try { if (e.ended || (!e.src && !e.currentSrc)) registry.delete(e); } catch (_x) {} });
      }
      if (audible(this) || !this.muted) enforce(this);
    } catch (_e) {}
    return origPlay.apply(this, arguments);
  };

  /* 兜底扫描: 有些音源是 autoplay 属性起播的, 不经过 play()。
   * 2 秒一次, 只在【真的有两个以上出声】时才动手, 平时零打扰。 */
  setInterval(function () {
    try {
      [].slice.call(document.querySelectorAll("audio,video")).forEach(function (e) { registry.add(e); });
      var live = [];
      registry.forEach(function (e) { if (audible(e)) live.push(e); });
      if (live.length <= 1) return;
      // 只留主轨; 没有主轨就留最先开始的那个
      var winner = live.filter(function (e) { return e.id === "watch-audio-preview"; })[0] || live[0];
      enforce(winner);
    } catch (_e) {}
  }, 2000);

  globalThis.__cssosAudioRegistrySize = function () { return registry.size; };
  globalThis.__cssosAudibleNow = function () {
    var out = []; registry.forEach(function (e) { if (audible(e)) out.push((e.id || "(游离)") + " " + String(e.currentSrc || e.src || "").slice(-26)); });
    return out;
  };
})();
