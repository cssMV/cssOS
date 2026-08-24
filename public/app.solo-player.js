/* CSSOS_WAVE_1923 20260824 — 独播器(Jing:「请按照 id, 从数据库读取唯一真源,
 * 把所有播放器全部删除, 新建一个播放器只读取从数据库得到的唯一真源,
 * 只播放一个, 其他全部杀掉。」)
 *
 * ── 为什么要有它 ────────────────────────────────────────────────────────────
 * 实测面: 54 个模块碰同一对 <video>/<audio>, 15 处直接写 src, 76 处直接 play()。
 * 谁先跑到谁说了算 —— 这就是"标题李白/画面唐伯虎/几首歌一起放"的真相。
 * 数据库里每个 id 的内容都是唯一且正确的, 乱的是前端有太多张嘴。
 *
 * ── 三条铁规矩 ──────────────────────────────────────────────────────────────
 *  ① 真源只有一个: 永远按 workId 去 /api/works/public/{id} 取, 【不信任】任何
 *     队列 item、缓存对象、别的模块传进来的 URL。它们正是污染源。
 *  ② 只播一个: 一次只有 #watch-video + #watch-audio-preview 这一对在响,
 *     其余【所有】媒体元素(含 new Audio() 的游离元素)一律 pause + 清空。
 *  ③ 世代号: 每次换歌 seq+1, 异步结果回来对不上就丢弃 —— 治赛跑的通用解。
 *
 * ── 为什么不是"删掉别的模块" ────────────────────────────────────────────────
 * 那 54 个模块里绝大多数是情绪字幕/卡拉OK/人脸裁切/交易条这些【功能】,
 * 删了平台就没了。要杀的是它们【碰媒体元素】这件事, 不是模块本身。
 * 所以做法是: 独播器持续巡逻, 谁碰了就改回来、谁出声就掐掉 ——
 * 效果等同"只剩一个播放器", 而功能一个不丢。
 */
(function () {
  "use strict";
  if (globalThis.cssosSoloPlayer) return;

  var V = "watch-video", A = "watch-audio-preview";
  var EXEMPT = { "mic-capture-audio": 1 };          // 麦克风是输入, 不是播放
  var st = { id: "", data: null, seq: 0, v: "", a: "", on: false };
  var registry = new Set();                          // 所有 play() 过的元素(含游离)

  function el(id) { return document.getElementById(id); }
  function fileOf(u) { try { return String(u || "").split("?")[0].split("/").pop() || ""; } catch (_e) { return ""; } }
  function ok(u) { u = String(u || "").trim(); return (u && u.indexOf("?") < 0 && /^https?:\/\//i.test(u)) ? u : ""; }

  /* ① 真源: 只从数据库接口取, 不接受任何人递过来的 URL。 */
  async function fetchTruth(id) {
    var r = await fetch("/api/works/public/" + encodeURIComponent(id), { credentials: "omit" });
    if (!r.ok) throw new Error("truth " + r.status);
    var j = await r.json();
    var d = (j && (j.data || j)) || {};
    return d.work || d;
  }

  /* ② 杀掉除主对之外的一切声音 —— 游离元素也在登记表里, 跑不掉。 */
  function killOthers() {
    var killed = 0;
    function consider(e) {
      try {
        if (!e || e.id === V || e.id === A || EXEMPT[e.id]) return;
        if (e.paused && !e.currentSrc && !e.src) return;
        if (!e.paused) { e.pause(); killed++; }
        if (e.currentSrc || e.src) { try { e.removeAttribute("src"); e.src = ""; e.load && e.load(); } catch (_x) {} }
      } catch (_x) {}
    }
    [].slice.call(document.querySelectorAll("audio,video")).forEach(function (e) { registry.add(e); consider(e); });
    registry.forEach(consider);
    if (killed) { try { console.warn("[W1923] 掐掉并发音源 x" + killed); } catch (_e) {} }
    return killed;
  }

  /* ③ 把主对拉回真源。别人改过就改回来 —— 不抢先, 只纠正。 */
  function assert_(mySeq) {
    if (mySeq !== st.seq || !st.on) return;
    var v = el(V), a = el(A);
    if (v && st.v && fileOf(v.currentSrc || v.getAttribute("src")) !== fileOf(st.v)) {
      v.src = st.v; try { v.load && v.load(); } catch (_e) {}
      try { var p = v.play && v.play(); if (p && p.catch) p.catch(function () {}); } catch (_e) {}
      try { console.warn("[W1923] 画面被别人改过, 拉回真源"); } catch (_e) {}
    }
    if (a && st.a && fileOf(a.currentSrc || a.getAttribute("src")) !== fileOf(st.a)) {
      a.src = st.a; try { a.load && a.load(); } catch (_e) {}
      try { console.warn("[W1923] 音乐被别人改过, 拉回真源"); } catch (_e) {}
    }
    killOthers();
  }

  /* 唯一换歌入口。任何路径最终都经过它 —— 它按 id 重新取真源, 不信旧数据。 */
  async function switchTo(workId) {
    var id = String(workId || "").trim();
    if (!id) return;
    st.seq += 1; var mySeq = st.seq;
    st.id = id; st.on = true;
    try {
      var w = await fetchTruth(id);
      if (mySeq !== st.seq) return;                  // 世代过期 → 丢弃, 不覆盖新的
      st.data = w;
      st.v = ok(w.final_mv_url || w.preview_video_url);
      st.a = ok(w.audio_track_1_url || w.preview_audio_url);
      killOthers();
      /* 三次纠正: 立刻 / 1.5s(常规装载完成)/ 4s(慢网、懒加载)。
       * 都带世代号, 期间换歌自动作废 —— 绝不会拿旧目标覆盖新的。 */
      assert_(mySeq);
      setTimeout(function () { assert_(mySeq); }, 1500);
      setTimeout(function () { assert_(mySeq); }, 4000);
    } catch (e) {
      try { console.warn("[W1923] 取真源失败:", (e && e.message) || e); } catch (_e) {}
    }
  }

  /* 接管 play(): 登记 + 立刻掐掉别的。游离 new Audio() 也必须经过这里。 */
  var P = HTMLMediaElement.prototype.play;
  if (!HTMLMediaElement.prototype.__cssosSoloHooked) {
    HTMLMediaElement.prototype.__cssosSoloHooked = true;
    HTMLMediaElement.prototype.play = function () {
      try {
        registry.add(this);
        if (st.on && this.id !== V && this.id !== A && !EXEMPT[this.id] && !this.muted) {
          try { console.warn("[W1923] 拦下非主音源起播:", this.id || "(游离)", String(this.src || "").slice(-28)); } catch (_e) {}
          try { this.pause(); } catch (_e) {}
          return Promise.resolve();                  // 不让它响
        }
      } catch (_e) {}
      return P.apply(this, arguments);
    };
  }

  /* 广播是所有切歌路径的唯一收口(W1886)。独播器挂在这里, 谁换歌都逃不掉。 */
  window.addEventListener("cssos:work-id-changed", function (ev) {
    try {
      var d = (ev && ev.detail) || {};
      var id = String(d.workId || "").trim();        // 按【作品 id】取真源, 不用 partId
      if (id) switchTo(id);
    } catch (_e) {}
  }, { passive: true });

  /* 常驻巡逻: 2 秒一次。只在真的偏离时动手, 平时零打扰。 */
  /* ─────────────────────────────────────────────────────────────────────────
   * CSSOS_WAVE_1932 20260824 — Jing:「用户进来就是这么一个黑屏, 什么都没有」。
   *
   * 实测: 落地后 #watch-video 已经 readyState=4(全解码就绪)、muted=true, 却
   * paused=true —— 我手动调一次 play() 就放了。也就是【根本没人去调 play()】。
   * 浏览器对【静音】自动播放是放行的(带声才需要手势), 所以这一帧不该白等。
   *
   * 只做画面, 不碰声音: 静音视频自动起播 → 用户一进来就看到画面在动;
   * 声音仍然等用户点"Tap for sound"(W1890 的胶囊), 不违反浏览器策略、也不吓人。
   *
   * 三条约束:
   *  · 每个作品只尝试一次(按 seq 记), 用户自己按暂停后不再违背他的意愿反复起播;
   *  · 只碰主视频 #watch-video, 音频一个字都不动(它归 Tap-for-sound 管);
   *  · iOS-like 跳过 —— W490h 当初为崩溃把移动端落地自动播关掉了, 这里不推翻那个决定。 */
  var __autoTried = -1;
  function nudgeMutedVideo() {
    try {
      if (__autoTried === st.seq) return;                       // 本作品已试过
      if (typeof globalThis.__cssosIsIOSLike === "function" && globalThis.__cssosIsIOSLike()) return;
      var v = document.getElementById(V);
      if (!v || !(v.currentSrc || v.src)) return;
      if (!v.paused) { __autoTried = st.seq; return; }           // 已经在放
      if (v.readyState < 2) return;                              // 还没解码到能播, 下一轮再说
      __autoTried = st.seq;
      v.muted = true;                                            // 只有静音才被允许
      var pr = v.play();
      if (pr && pr.catch) pr.catch(function () { /* 被拒就算了, 不打扰用户 */ });
    } catch (_e) {}
  }

  setInterval(function () { try { assert_(st.seq); } catch (_e) {} try { nudgeMutedVideo(); } catch (_e) {} }, 2000);

  globalThis.cssosSoloPlayer = {
    switchTo: switchTo,
    current: function () { return { id: st.id, video: st.v, audio: st.a, seq: st.seq }; },
    /** 诊断: 此刻在响的所有音源(含游离) */
    audible: function () {
      var out = [];
      registry.forEach(function (e) {
        try { if (!e.paused && !e.muted && (e.currentSrc || e.src)) out.push((e.id || "(游离)") + " " + String(e.currentSrc || e.src).slice(-26)); } catch (_x) {}
      });
      return out;
    },
    /** 诊断: 主对是否与真源一致 */
    coherent: function () {
      var v = el(V), a = el(A);
      return { id: st.id.slice(0, 8),
        画面: !st.v || fileOf(v && v.currentSrc) === fileOf(st.v),
        音乐: !st.a || fileOf(a && a.currentSrc) === fileOf(st.a),
        并发音源: globalThis.cssosSoloPlayer.audible().length };
    },
  };
})();
