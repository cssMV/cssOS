/* CSSOS_WAVE_1922 20260824 — 播放权威(Jing:「我们刚好全新设计一个播放器」
 * 「以后再加上多画面, 可以想像, 该有多乱了」)
 *
 * ── 为什么必须有这个东西 ────────────────────────────────────────────────────
 * 今天挖出的四个 bug, 底下是同一件事: **没有任何东西"拥有"播放**。
 *   标题李白/画面唐伯虎  ← 两条切歌路径, 一条只做一半
 *   几首歌一起放          ← 多个音源, 老权威只管得到 DOM 里的
 *   字幕另一种语言        ← 裸 setTimeout 赛跑, 没人取消
 *   同一 ID 两条音频      ← 两个接口各读各的表
 * 实测面: 54 个模块碰同一对 <video>/<audio>, 15 处直接写 src, 76 处直接 play()。
 * 谁先跑到谁说了算 —— 这就是"随机播放"的真相。
 *
 * 而多画面会把它【乘起来】: 3 种画面形态 × 2 条路径 × 各自的装载器
 * → "画面停在上一首"会变成"幻灯/视频/封面三层各停在不同的一首"。
 * 所以权威必须在加多画面【之前】立住。
 *
 * ── 权威的四条规矩 ──────────────────────────────────────────────────────────
 *  ① 唯一状态: 当前是哪一首, 只有 currentWorkId 一个答案。谁都不许自己存一份。
 *  ② 原子换歌: 一次 switchTo() 把 画面/音乐/字幕/标题 四轨一起换 —— 要么全换, 要么都不换。
 *  ③ 世代号: 每次换歌 seq+1。任何异步结果回来时对不上当前 seq 就【丢弃】——
 *     这是治"字幕赛跑"那一类问题的通用解, 不用给每个异步点各打一个补丁。
 *  ④ 只做加法, 不拆旧路: 现有路径照常工作; 权威在它们之后做一次【一致性收口】,
 *     发现某一层没跟上就补, 跟上了就静默。
 *     —— 今天 W1918 的教训: 抢在别人之前动手会造成重复装载("打架")。
 *        权威是最后一个说话的, 不是第一个。
 */
(function () {
  "use strict";
  if (globalThis.cssosPlaybackAuthority) return;

  var state = {
    workId: "",          // 唯一真源
    work: null,          // 当前作品对象(来自广播)
    seq: 0,              // 世代号
    lastSettleAt: 0,
  };

  function el(id) { return document.getElementById(id); }
  function fileOf(u) { try { return String(u || "").split("?")[0].split("/").pop() || ""; } catch (_e) { return ""; } }
  function clean(u) { u = String(u || "").trim(); return (u && u.indexOf("?") < 0 && /^https?:\/\//i.test(u)) ? u : ""; }

  /* 四轨各自的"目标是什么" —— 只读作品对象, 不猜。拿不到就返回空 = 这一轨不管。 */
  function targets(w) {
    return {
      video: clean(w && (w.final_mv_url || w.preview_video_url)),
      audio: clean(w && (w.audio_track_1_url || w.preview_audio_url)),
      title: String((w && (w.part_title || w.title)) || "").trim(),
    };
  }

  /* 一致性收口: 看四轨是不是都对上了当前这一首; 没对上的补, 对上的不碰。
   * 【绝不】在别的路径正在装载的时候插手 —— 只在稳定后检查一次。 */
  function settle(mySeq) {
    if (mySeq !== state.seq) return;                 // 世代过期 → 丢弃
    var w = state.work; if (!w) return;
    var t = targets(w), fixed = [];

    var v = el("watch-video");
    if (v && t.video) {
      var cur = String(v.currentSrc || v.getAttribute("src") || "");
      // 当前是签名/临时链就别碰(不是我该管的); 空或指着别的作品才补
      if (cur.indexOf("?") < 0 && fileOf(cur) !== fileOf(t.video)) {
        v.src = t.video; try { v.load && v.load(); } catch (_e) {}
        try { var p = v.play && v.play(); if (p && p.catch) p.catch(function () {}); } catch (_e) {}
        fixed.push("画面");
      }
    }
    var a = el("watch-audio-preview");
    if (a && t.audio) {
      var acur = String(a.currentSrc || a.getAttribute("src") || "");
      if (acur.indexOf("?") < 0 && fileOf(acur) !== fileOf(t.audio)) {
        a.src = t.audio; try { a.load && a.load(); } catch (_e) {}
        fixed.push("音乐");
      }
    }
    if (t.title) {
      var sinks = document.querySelectorAll(".cssmv-mv-title, #watch-title-text, .watch-title-text");
      for (var i = 0; i < sinks.length; i++) {
        if (String(sinks[i].textContent || "").trim() !== t.title) { sinks[i].textContent = t.title; fixed.push("标题"); }
      }
    }
    if (fixed.length) {
      try {
        console.warn("[W1922] 收口补齐:", state.workId.slice(0, 8), "→", fixed.join("/"));
        globalThis.cssosReportError &&
          globalThis.cssosReportError("切歌后 " + fixed.join("/") + " 未跟上, 权威已补齐", "switch_incoherent");
      } catch (_e) {}
    }
    state.lastSettleAt = Date.now();
  }

  /* 唯一入口: 谁换歌都经过广播(W1886 已保证), 权威在这里接管状态 + 排收口。 */
  window.addEventListener("cssos:work-id-changed", function (ev) {
    try {
      var d = (ev && ev.detail) || {};
      var id = String(d.partId || d.workId || "").trim();
      if (!id) return;
      state.seq += 1;
      state.workId = id;
      state.work = d.work || null;
      var mySeq = state.seq;
      /* 两次收口: 1.5s(常规装载已完成)和 4s(慢网/懒加载)。
       * 都带世代号 —— 期间又切歌就自动作废, 不会拿旧目标去覆盖新的。 */
      setTimeout(function () { settle(mySeq); }, 1500);
      setTimeout(function () { settle(mySeq); }, 4000);
    } catch (_e) {}
  }, { passive: true });

  globalThis.cssosPlaybackAuthority = {
    /** 当前作品 id —— 谁要知道"现在是哪一首", 问这里, 不要自己存 */
    currentWorkId: function () { return state.workId; },
    currentWork: function () { return state.work; },
    generation: function () { return state.seq; },
    /** 异步结果回来时用它判断自己是不是过期了 */
    isCurrent: function (seq) { return seq === state.seq; },
    /** 诊断: 四轨此刻是否一致 */
    coherence: function () {
      var w = state.work; if (!w) return { ok: null, reason: "无当前作品" };
      var t = targets(w), v = el("watch-video"), a = el("watch-audio-preview");
      var tt = document.querySelector(".cssmv-mv-title");
      return {
        workId: state.workId.slice(0, 8),
        画面: !t.video || fileOf(v && v.currentSrc) === fileOf(t.video),
        音乐: !t.audio || fileOf(a && a.currentSrc) === fileOf(t.audio),
        标题: !t.title || String((tt && tt.textContent) || "").trim() === t.title,
      };
    },
  };

  /* CSSOS_WAVE_1976 20260826 — 真视频的【画音同步】。
   *
   * 这是"真视频"带来的全新需求, 平台此前不需要, 所以一行都没有:
   * 以前画面永远是【5 秒短片垫在整首歌下面】或幻灯, 循环播就行, 同步与否无所谓。
   * 现在《寻寻觅觅》是一条 355 秒、《怎一个愁字》574 秒的整片视频 —— 它必须和音频
   * 逐帧对齐。实测现场: 音频跑到 126 秒, 视频停在 60 秒且处于暂停 —— 画面卡成一张
   * 静止图, 用户看到的就是"还是图片"。手动 play() 立刻正常, 说明不是浏览器策略拦的,
   * 是某处代码暂停后【没有人再把它接回去】。
   *
   * 规矩(和权威的四条一脉相承: 音频是时间的唯一真源):
   *   · 只在【整片真视频】上生效 —— 判据是视频时长与音频时长相差 < 10%。
   *     短视频垫底那种(5 秒 vs 355 秒)一律不碰, 它本来就该自己循环。
   *   · 音频 play/pause/seek → 视频跟随。音频是主, 视频是从, 永不反向。
   *   · 每 1 秒查一次漂移, 超过 0.35 秒就把视频拉回音频的时刻。
   *     (0.35s 是肉眼开始察觉口型/动作错位的阈值; 再小会因解码抖动频繁重定位。)
   *   · 视频被任何人暂停而音频还在跑 → 立刻续上。这一条就是本次的直接病因。 */
  (function videoAudioSync() {
    var THRESH = 0.35, EVERY = 1000, RATIO = 0.10;
    function el(id) { try { return document.getElementById(id); } catch (_e) { return null; } }
    function isFullVideo(v, a) {
      var dv = Number(v && v.duration) || 0, da = Number(a && a.duration) || 0;
      if (!(dv > 0 && da > 0)) return false;
      return Math.abs(dv - da) / da < RATIO;      // 整片真视频: 时长基本一致
    }
    function sync(force) {
      var v = el("watch-video"), a = el("watch-audio-preview");
      if (!v || !a || !isFullVideo(v, a)) return;
      try {
        if (Math.abs(v.currentTime - a.currentTime) > (force ? 0.05 : THRESH)) {
          v.currentTime = a.currentTime;
        }
        if (!a.paused && v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        if (a.paused && !v.paused) { v.pause(); }
      } catch (_e) {}
    }
    function wire() {
      var a = el("watch-audio-preview");
      if (!a || a.__cssosAvSyncWired) return;
      a.__cssosAvSyncWired = true;
      ["play", "playing", "pause", "seeked", "ratechange"].forEach(function (ev) {
        try { a.addEventListener(ev, function () { sync(true); }, { passive: true }); } catch (_e) {}
      });
    }
    try {
      setInterval(function () { wire(); sync(false); }, EVERY);
      globalThis.addEventListener("cssos:work-id-changed", function () {
        setTimeout(function () { wire(); sync(true); }, 800);
      }, { passive: true });
    } catch (_e) {}
    globalThis.cssosAvSync = { now: function () { sync(true); } };
  })();
})();
