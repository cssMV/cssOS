/* CSSOS_WAVE_1787 20260727 — 重音探测器 (Echo Probe)
 *
 * Jing:「有时候会有『重音』—— 一首歌在短时间内被同时播放, 类似音响的 Echo 效果。
 *        应该只播放一个唯一真源。请先查出问题所在, 再只修复这个问题。」
 *
 * 这个模块【不改任何播放行为】, 只做一件事: 找出"同一时刻有几个源在出声"。
 * 为什么先探测再动手 —— 和 W1785 串台探测器同一个道理:
 *   ① 重音是间歇性的, 无头浏览器里自动播放策略恰好挡住要抓的那个状态, 复现不了。
 *   ② 现有裁判 cssosEnforceSingleAudio(index.html, W392/W407)有两个已知盲区,
 *      但哪一个才是 Jing 听到的那次, 只能靠现场证据定案:
 *        盲区 A — 它按 id 排除: `el.id === "watch-audio-preview"` 一旦 DOM 里出现
 *                 【同 id 的第二个元素】, 第二个也被排除; 而 getElementById 只返回
 *                 第一个 → 第二个成了没人管的孤儿, 放的是同一首歌 = 回声。
 *        盲区 B — 它只扫 document.querySelectorAll("audio, video"), 而
 *                 `new Audio()` 建的【游离元素】不在 DOM 里(app.actor-gallery.js
 *                 / app.hymn-player.js 都有), 裁判根本看不见。这一点
 *                 app.actor-gallery.js:2621 的注释已经自己写明了。
 *   ③ 修完之后它变成常驻哨兵 —— 下次复发在用户开口之前就被抓到。
 *
 * 判定口径(宁可漏报, 不误报):
 *   只统计【未暂停 + 未静音 + volume>0 + 有 src】的源。两个及以上才算一次事件。
 *   再按 URL 是否相同分两级:
 *     echo-same   同一个 url 同时出声  = Jing 说的"重音/回声"(最硬的证据)
 *     overlap-diff 不同 url 同时出声   = 旧的"交响乐"型重叠(W392 治过, 防复发)
 */
(function () {
  "use strict";
  if (globalThis.__cssosEchoProbeWired) return;
  globalThis.__cssosEchoProbeWired = true;

  var HISTORY_MAX = 40;
  var REPORT_MAX = 8;          // 限流: 别把遥测刷爆
  var _events = [];
  var _lastSig = "";
  var _reported = 0;

  /* 游离元素登记表 —— 这是本探测器相对裁判的关键增量。
   * 裁判只扫 DOM; 我们改成 hook HTMLMediaElement.prototype.play, 任何元素
   * (无论在不在 DOM 里)只要播过一次就进表, 从此逃不掉。用 WeakRef 存, 元素被
   * GC 掉时自动消失, 不给内存留尾巴(平台有"顺畅完毕立即销毁内存"的铁律)。 */
  var _seen = [];
  var HasWeakRef = typeof WeakRef === "function";
  function remember(el) {
    for (var i = 0; i < _seen.length; i++) {
      var e = HasWeakRef ? _seen[i].deref() : _seen[i];
      if (e === el) return;
    }
    _seen.push(HasWeakRef ? new WeakRef(el) : el);
    if (_seen.length > 64) _seen.shift();
  }
  try {
    var origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      try { remember(this); } catch (_e) {}
      return origPlay.apply(this, arguments);
    };
  } catch (_e) {}

  function allMedia() {
    var out = [];
    try {
      document.querySelectorAll("audio, video").forEach(function (el) { out.push(el); });
    } catch (_e) {}
    for (var i = 0; i < _seen.length; i++) {
      var el = HasWeakRef ? _seen[i].deref() : _seen[i];
      if (el && out.indexOf(el) < 0) out.push(el);          // 游离的补进来
    }
    return out;
  }

  function label(el) {
    if (el.id) return "#" + el.id;
    if (!el.isConnected) return "(detached " + el.tagName.toLowerCase() + ")";
    return el.tagName.toLowerCase() + (el.className ? "." + String(el.className).trim().split(/\s+/)[0] : "");
  }
  function tail(u) { return String(u || "").split("/").pop().slice(0, 44); }

  function scan() {
    var audible = [];
    allMedia().forEach(function (el) {
      try {
        var src = String(el.currentSrc || el.src || "").trim();
        if (!src) return;
        if (el.paused || el.muted) return;
        if (!(el.volume > 0)) return;
        audible.push(el);
      } catch (_e) {}
    });
    if (audible.length < 2) return null;

    var urls = audible.map(function (el) { return String(el.currentSrc || el.src); });
    var sameUrl = urls.some(function (u, i) { return urls.indexOf(u) !== i; });

    /* 同 id 重复元素 —— 盲区 A 的直接证据。裁判按 id 放行, 所以重复 id 是致命的。 */
    var dupIds = [];
    ["watch-audio-preview", "watch-video"].forEach(function (id) {
      try {
        var n = document.querySelectorAll("#" + id).length;
        if (n > 1) dupIds.push(id + "×" + n);
      } catch (_e) {}
    });
    /* 游离元素在出声 —— 盲区 B 的直接证据。 */
    var detached = audible.filter(function (el) { return !el.isConnected; }).length;

    return {
      at: Date.now(),
      kind: sameUrl ? "echo-same" : "overlap-diff",
      n: audible.length,
      dupIds: dupIds,
      detachedAudible: detached,
      sources: audible.map(function (el) {
        return { el: label(el), url: tail(el.currentSrc || el.src), ct: +(el.currentTime || 0).toFixed(2) };
      }),
      workId: (function () {
        try { return typeof globalThis.cssosCurrentWorkId === "function" ? String(globalThis.cssosCurrentWorkId() || "").slice(0, 8) : ""; }
        catch (_e) { return ""; }
      })(),
    };
  }

  function tick() {
    var ev;
    try { ev = scan(); } catch (_e) { return; }
    if (!ev) { _lastSig = ""; return; }

    var sig = ev.kind + "|" + ev.sources.map(function (s) { return s.el + "=" + s.url; }).sort().join(",");
    if (sig === _lastSig) return;          // 同一组重叠只报一次
    _lastSig = sig;

    _events.push(ev);
    if (_events.length > HISTORY_MAX) _events.shift();
    try {
      console.warn("[echo] " + (ev.kind === "echo-same" ? "重音(同一首歌两个源)" : "重叠(不同内容同时出声)"),
                   "源数=" + ev.n,
                   ev.dupIds.length ? "重复id=" + ev.dupIds.join("/") : "",
                   ev.detachedAudible ? "游离源=" + ev.detachedAudible : "",
                   ev.sources);
    } catch (_e) {}

    if (_reported < REPORT_MAX) {
      _reported += 1;
      try {
        fetch("/api/telemetry/error", {
          method: "POST", credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: "echo",
            panel: "watch",
            message: ("echo[" + ev.kind + "] n=" + ev.n +
                      " work=" + (ev.workId || "?") +
                      (ev.dupIds.length ? " dupId=" + ev.dupIds.join("/") : "") +
                      (ev.detachedAudible ? " detached=" + ev.detachedAudible : "") +
                      " " + ev.sources.map(function (s) { return s.el + ":" + s.url + "@" + s.ct; }).join(" ")
                     ).slice(0, 380),
          }),
        }).catch(function () {});
      } catch (_e) {}
    }
  }

  // 500ms 一次 —— 重音往往只持续一两秒, 1s 会漏掉短的那种。
  setInterval(tick, 500);

  // 手动查看: cssosEchoProbe() → 立刻扫一次并返回历史
  globalThis.cssosEchoProbe = function () {
    return { now: scan(), history: _events.slice() };
  };
})();
