/* CSSOS_WAVE_1785 20260726 — 串台探测器 (Cross-Talk Probe)
 *
 * Jing:「播放一首歌, 字幕/音乐/画面内容完全各一套 —— 标题是唐伯虎, 歌声是李白,
 *        画面是日本, 三个完全不搭噶的内容同时显示。」
 *
 * 这个模块【不修任何东西】, 只做一件事: 每秒比对四条道当前实际挂着的是谁的资源,
 * 一旦发现不一致就记录 + 上报。为什么先做探测器再动写入点:
 *   ① 证明诊断。串台是间歇性的("不是每次, 但很多时候"), 靠人肉复现不可靠。
 *   ② 定位到【具体哪条道】掉队, 而不是笼统地"串台了"。
 *   ③ 修完之后它变成常驻哨兵 —— 下次复发在用户看见之前就被抓到,
 *      而不是等 Jing 截图告诉我们。这是过去七次补丁都缺的那一环。
 *
 * 四条道(将来多视频是第五条, 在 CHANNELS 里加一行即可):
 *   title    标题     —— 从 watch 面板标题元素读
 *   audio    歌声     —— 从 <audio> 的 src 里抽 work id
 *   slides   画面     —— 从当前幻灯帧 URL 里抽 work id
 *   subtitle 字幕     —— 从字幕引擎的 ownerWorkId 读
 *
 * 判定口径: 只在【能明确解析出 work id】的道之间比对。解析不出来的道跳过 ——
 * 宁可漏报, 也不要因为解析失败就误报一堆假串台(那样哨兵会被当成噪音关掉)。
 */
(function () {
  "use strict";
  if (globalThis.__cssosCrossTalkProbeWired) return;
  globalThis.__cssosCrossTalkProbeWired = true;

  var HISTORY_MAX = 40;
  var _events = [];        // 已记录的串台事件
  var _lastSig = "";       // 去重: 同一组不一致只报一次
  var _reported = 0;       // 本次会话已上报次数(限流, 别把遥测刷爆)
  var REPORT_MAX = 8;

  /* 从任意资源 URL 里抽 work id。平台的资源 URL 形如:
   *   /artifacts/mv/aud-<uuid>.mp3 · /artifacts/mv-fallback/cover-<uuid>-….webp
   *   /api/works/<uuid>/… · ?cssMV=<uuid>
   * 抽不出来返回空串 —— 调用方会跳过这条道, 不做误判。 */
  var UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  function idFromUrl(u) {
    if (!u) return "";
    var m = String(u).match(UUID);
    return m ? m[0].toLowerCase() : "";
  }
  function rootId(id) {
    try {
      if (typeof globalThis.cssosRootWorkId === "function") return globalThis.cssosRootWorkId(id) || id;
    } catch (_e) {}
    return id;
  }

  /* W1785 第二层 — 先查登记表, 查不到才退回"从 URL 猜"。
   *
   * 为什么必须有登记表: 音频 URL 是 artifacts/audio/aud-<hash>.mp3, 里面【没有任何
   * 能追溯归属的信息】(视频有: canon-<workId前缀>-…)。光靠解析 URL, 音频这条道
   * 永远查不出它属于谁 —— 既无法运行时自检, 出问题也无法定位。
   * 登记表记住"这个 url 是在哪个完整坐标下被挂上去的", 补上这块缺失的身份。 */
  function coordOf(channel, url) {
    if (!url) return null;
    try {
      if (typeof globalThis.cssosAssetCoord === "function") {
        var c = globalThis.cssosAssetCoord(channel, url);
        if (c) return c;
      }
    } catch (_e) {}
    var guessed = idFromUrl(url);
    return guessed ? { workId: rootId(guessed), _guessed: true } : null;
  }
  // 坐标可读化, 用于日志/去重签名。lang 等维度缺失时不参与比对(宁可漏报不误报)。
  function coordSig(c) {
    if (!c) return "";
    return (c.workId || "").slice(0, 8) +
      (c.lang ? "/" + c.lang : "") +
      (c.voice && c.voice !== "auto" ? "/" + c.voice : "") +
      (c.take && String(c.take) !== "1" ? "/take" + c.take : "") +
      (c.videoTrack ? "/v" + c.videoTrack : "");
  }

  var CHANNELS = {
    audio: function () {
      var a = document.getElementById("watch-audio-preview");
      return a ? idFromUrl(a.currentSrc || a.src) : "";
    },
    slides: function () {
      // 幻灯当前帧: 优先问 cover-slideshow 自己, 否则从可见的帧元素读背景图
      try {
        if (typeof globalThis.cssosSlideshowCurrentUrl === "function") {
          return idFromUrl(globalThis.cssosSlideshowCurrentUrl());
        }
      } catch (_e) {}
      var el = document.querySelector("#watch-svg img, #watch-svg [style*='background-image']");
      if (!el) return "";
      if (el.tagName === "IMG") return idFromUrl(el.currentSrc || el.src);
      var bg = (el.style && el.style.backgroundImage) || "";
      return idFromUrl(bg);
    },
    subtitle: function () {
      try {
        // 字幕引擎把"当前这套 cue 属于哪部作品"存在 _offsetWorkId, 对外的读法是 getWorkId()。
        var E = globalThis.cssosEmotionSubtitle;
        if (E && typeof E.getWorkId === "function") return rootId(String(E.getWorkId() || ""));
      } catch (_e) {}
      return "";
    },
    video: function () {
      var v = document.getElementById("watch-video");
      return v ? idFromUrl(v.currentSrc || v.src) : "";
    },
  };

  function authority() {
    try {
      if (typeof globalThis.cssosCurrentWorkId === "function") {
        return rootId(String(globalThis.cssosCurrentWorkId() || ""));
      }
    } catch (_e) {}
    return "";
  }

  function scan() {
    // 只在 watch/影院真的开着时扫 —— 面板没开时各道本来就该是空的。
    var open = false;
    try {
      open = document.documentElement.classList.contains("cssos-watch-open") ||
             document.body.classList.contains("cssos-watch-on");
    } catch (_e) {}
    if (!open) return null;

    var auth = authority();
    // 各道当前挂着的【完整坐标】(不只是 workId)
    var seen = {};
    var urls = {
      audio: (function () { var a = document.getElementById("watch-audio-preview"); return a && (a.currentSrc || a.src); })(),
      video: (function () { var v = document.getElementById("watch-video"); return v && (v.currentSrc || v.src); })(),
    };
    Object.keys(CHANNELS).forEach(function (k) {
      var c = null;
      if (urls[k]) c = coordOf(k, urls[k]);          // 音频/视频: 查登记表拿完整坐标
      else {
        var v = "";
        try { v = rootId(String(CHANNELS[k]() || "")); } catch (_e) {}
        if (v) c = { workId: v };                    // 字幕/幻灯: 目前只能拿到 workId
      }
      if (c && c.workId) seen[k] = c;                // 拿不到坐标的道不参与比对
    });

    var keys = Object.keys(seen);
    if (keys.length < 2) return null;                // 少于两条道有值 → 无从比对

    /* 比对分两级 —— 这是本波的关键改动:
     *   ① workId 不一致 = 硬串台(标题唐伯虎/歌声李白/画面日本), 一定是错的。
     *   ② workId 一致但 lang/voice/take 不一致 = 【切语言时的串台】。
     *      这一级正是历次补丁全部漏掉的: 换语言时 workId 不变, 只比 workId 的守卫
     *      统统放行, 于是"字幕已经是英文、歌声还是中文"。
     *   只在两边【都登记了】该维度时才比 —— 一边缺失就跳过, 避免误报。 */
    var idMismatch = false, coordMismatch = false;
    for (var i = 0; i < keys.length; i++) {
      for (var j = i + 1; j < keys.length; j++) {
        var A = seen[keys[i]], B = seen[keys[j]];
        if (A.workId !== B.workId) { idMismatch = true; continue; }
        ["lang", "voice", "take", "videoTrack"].forEach(function (d) {
          if (A[d] && B[d] && String(A[d]) !== String(B[d])) coordMismatch = true;
        });
      }
    }
    if (auth && keys.some(function (k) { return seen[k].workId !== auth; })) idMismatch = true;
    if (!idMismatch && !coordMismatch) return null;

    var flat = {};
    keys.forEach(function (k) { flat[k] = coordSig(seen[k]); });

    return {
      at: Date.now(),
      kind: idMismatch ? "work-mismatch" : "coord-mismatch",   // 硬串台 / 切语言串台
      authority: auth,
      gen: (typeof globalThis.cssosCurrentGen === "function") ? globalThis.cssosCurrentGen() : null,
      channels: flat,
      coords: seen,
      // 哪几条道跟权威不一致 —— 直接指出是谁掉队, 不用再猜
      offenders: keys.filter(function (k) { return auth && seen[k].workId !== auth; }),
      droppedWrites: (typeof globalThis.cssosDroppedWrites === "function")
        ? globalThis.cssosDroppedWrites().slice(-5) : [],
    };
  }

  function tick() {
    var ev;
    try { ev = scan(); } catch (_e) { return; }
    if (!ev) { _lastSig = ""; return; }

    var sig = ev.kind + "|" + ev.authority + "|" + Object.keys(ev.channels).sort().map(function (k) {
      return k + "=" + ev.channels[k];
    }).join(",");
    if (sig === _lastSig) return;      // 同一组不一致只报一次, 不刷屏
    _lastSig = sig;

    _events.push(ev);
    if (_events.length > HISTORY_MAX) _events.shift();
    try {
      console.warn("[crosstalk] " + (ev.kind === "work-mismatch" ? "硬串台(不同作品)" : "切语言串台(同作品不同轨)"),
                   "权威=" + (ev.authority || "?").slice(0, 8),
                   "掉队=" + (ev.offenders.join("/") || "-"), ev.channels);
    } catch (_e) {}

    // 上报遥测(限流)。带上 offenders —— 服务端聚合后能直接看出"哪条道最爱掉队"。
    if (_reported < REPORT_MAX) {
      _reported += 1;
      try {
        fetch("/api/telemetry/error", {
          method: "POST", credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: "crosstalk",
            panel: "watch",
            message: ("crosstalk[" + ev.kind + "] auth=" + (ev.authority || "?").slice(0, 8) +
                      " gen=" + ev.gen +
                      " offenders=" + (ev.offenders.join("/") || "-") +
                      " " + Object.keys(ev.channels).map(function (k) {
                        return k + ":" + ev.channels[k];
                      }).join(" ")).slice(0, 380),
          }),
        }).catch(function () {});
      } catch (_e) {}
    }
  }

  // 1s 一次。只在面板开着时才真正扫描, 关着时是一次 classList 判断, 开销可忽略。
  setInterval(tick, 1000);

  // 手动查看: cssosCrossTalkProbe() → 立刻扫一次并返回历史
  globalThis.cssosCrossTalkProbe = function () {
    return { now: scan(), history: _events.slice(), droppedWrites:
      (typeof globalThis.cssosDroppedWrites === "function") ? globalThis.cssosDroppedWrites() : [] };
  };
})();
