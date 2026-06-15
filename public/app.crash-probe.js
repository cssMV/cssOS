/* CSSOS_WAVE_588 20260602 — Jing「用数据定位崩溃, 别猜」: 轻量崩溃探针。
 * 每 3s 打点(DOM/img/幻灯数 + 最后用户动作 + JS堆[若支持]); 存 localStorage(跨崩溃重载仍在)。
 * 崩溃重载后, 控制台 + toast 回显"上次崩前趋势" → 看是哪类在累积(img/slides=封面轮播; dom=DOM泄漏)。
 * 极轻量, 全平台安全。查看完整轨迹: 控制台运行 cssosCrashProbeDump()。 */
(function () {
  "use strict";
  if (globalThis.__cssosCrashProbe) return;
  globalThis.__cssosCrashProbe = true;
  var KEY = "cssos:crashprobe";
  // CSSOS_WAVE_801 — Jing「彻底断掉 Web Audio」可验证化: 全局计数 AudioContext 构造次数。
  // W801 后播放路径应【永不】再建 AudioContext → 这个数应停在很小的常数(仅 iOS 解锁那一个)。
  // 若播放中 actx 持续上涨, 就是又有谁偷偷 new AudioContext 了 —— 免疫系统会直接点名。
  (function () {
    try {
      if (globalThis.__cssosACtxPatched) return; globalThis.__cssosACtxPatched = true;
      globalThis.__cssosACtxCount = 0;
      ["AudioContext", "webkitAudioContext"].forEach(function (k) {
        var Orig = globalThis[k];
        if (typeof Orig !== "function") return;
        function Wrapped() { globalThis.__cssosACtxCount++; return Reflect.construct(Orig, arguments, Wrapped); }
        Wrapped.prototype = Orig.prototype;
        try { globalThis[k] = Wrapped; } catch (_e) {}
      });
    } catch (_e) {}
  })();
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_e) { return []; } }
  function save(arr) { try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-50))); } catch (_e) {} }
  var lastAction = "(boot)";
  function sample(tag) {
    var s = {
      t: new Date().toISOString().slice(11, 19), tag: tag || "", act: lastAction,
      dom: document.querySelectorAll("*").length,
      img: document.querySelectorAll("img").length,
      slides: document.querySelectorAll("img[data-slides]").length,
      panel: (function () { try { var p = document.querySelector(".cssos-panel:not([hidden]) .panel-title, .panel.is-open .panel-title"); return p ? p.textContent.trim().slice(0, 20) : ""; } catch (_e) { return ""; } })(),
    };
    try { if (window.performance && performance.memory) s.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576); } catch (_e) {}
    // CSSOS_WAVE_800 — 接上 cssmemProbe 已有的细粒度计数(此前 crash-probe 没用): 活跃定时器/视频/音频/blob。
    // active_intervals 持续上涨 = 泄漏定时器的实锤; videos/audios 上涨 = 媒体元素没回收。
    try {
      var _mp = globalThis.cssmemProbe && typeof globalThis.cssmemProbe.snapshot === "function" ? globalThis.cssmemProbe.snapshot() : null;
      if (_mp) { s.iv = _mp.active_intervals; s.vid = _mp.videos; s.aud = _mp.audios; s.blob = _mp.blob_urls; }
    } catch (_e) {}
    try { s.panels = document.querySelectorAll(".panel:not(.hidden)").length; } catch (_e) {}
    try { s.actx = globalThis.__cssosACtxCount || 0; } catch (_e) {}   // W801 — AudioContext 构造数(应≈0)
    // W801 — 各标签计数(给增长 DELTA 用): 只存 top-12, 控 localStorage 体积。
    try {
      var all = document.getElementsByTagName("*"), m = {}, i;
      for (i = 0; i < all.length; i++) { var t = all[i].tagName; m[t] = (m[t] || 0) + 1; }
      var keys = Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).slice(0, 12);
      var tm = {}; keys.forEach(function (k) { tm[k] = m[k]; }); s.tagmap = tm;
    } catch (_e) {}
    var arr = load(); arr.push(s); save(arr);
    return s;
  }
  globalThis.cssosCrashProbeDump = function () { try { console.table(load()); } catch (_e) {} return load(); };

  // 最后用户动作(崩前在干嘛)。
  document.addEventListener("click", function (e) {
    try {
      var el = e.target && e.target.closest && e.target.closest("button,[role=button],a,[data-pill-key],[data-work-id],.work-card");
      lastAction = (el ? (el.textContent || el.getAttribute("data-pill-key") || el.getAttribute("data-work-id") || el.className || "el") : (e.target && e.target.tagName) || "?");
      lastAction = String(lastAction).replace(/\s+/g, " ").trim().slice(0, 48);
    } catch (_e) {}
  }, true);

  // CSSOS_WAVE_588 — 平台免疫系统: 把报错 beacon 到 /api/telemetry/error(去重+限流, 绝不打扰用户)。
  var _seen = {}, _sentCount = 0;
  globalThis.cssosReportError = function (message, code) {
    try {
      var msg = String(message || "").slice(0, 300).replace(/\s+/g, " ").trim();
      if (!msg) return;
      var key = (code || "") + "|" + msg.slice(0, 80);
      if (_seen[key]) return;            // 本会话同类只报一次
      _seen[key] = 1;
      if (_sentCount++ > 30) return;     // 单会话上限, 防风暴
      var build = "";
      try { build = String(globalThis.__CSSOS_BUILD || ""); } catch (_e) {}
      navigator.sendBeacon
        ? navigator.sendBeacon("/api/telemetry/error", new Blob([JSON.stringify({ message: msg, code: code || "", action: lastAction, panel: (load().slice(-1)[0] || {}).panel || "", build: build })], { type: "application/json" }))
        : fetch("/api/telemetry/error", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ message: msg, code: code || "", action: lastAction, build: build }), keepalive: true }).catch(function () {});
    } catch (_e) {}
  };
  window.addEventListener("error", function (ev) { sample("ERROR: " + String(ev && ev.message || "").slice(0, 70)); globalThis.cssosReportError(ev && (ev.message || (ev.error && ev.error.message)) || "window.error", "js_error"); });
  window.addEventListener("unhandledrejection", function (ev) { sample("REJECT: " + String(ev && ev.reason || "").slice(0, 70)); globalThis.cssosReportError(String(ev && ev.reason || "unhandledrejection"), "js_reject"); });

  // CSSOS_WAVE_588 线2 — 静默失败兜底: 全局 fetch 拦截器, 把【静默失败的 /api 请求】(5xx / 真客户端错 /
  // 网络中断)自动报进免疫系统 digest。不动那 749 个 catch、不打扰用户 —— 一处覆盖所有静默 api 失败。
  // 跳过 401/403/402(鉴权/权限/付费已由引导式 UX 处理) + 遥测端点自身(防回环)。原始 promise 原样返回, 不改行为。
  (function () {
    try {
      var orig = window.fetch;
      if (typeof orig !== "function" || window.__cssosFetchProbed) return;
      window.__cssosFetchProbed = true;
      window.fetch = function (input) {
        var url = ""; try { url = (typeof input === "string") ? input : (input && input.url) || ""; } catch (_e) {}
        var p = orig.apply(this, arguments);
        try {
          if (/\/api\//.test(url) && !/\/api\/telemetry\//.test(url)) {
            var tag = url.replace(/[0-9a-f-]{8,}/gi, "#").replace(/\?.*$/, "").slice(0, 120);
            p.then(function (res) {
              try {
                var s = res && res.status;
                if (s >= 400 && s !== 401 && s !== 403 && s !== 402) globalThis.cssosReportError("API " + s + " " + tag, "api_" + s);
              } catch (_e) {}
            }, function () { try { globalThis.cssosReportError("API neterr " + tag, "api_neterr"); } catch (_e) {} });
          }
        } catch (_e) {}
        return p; // 原始 promise, 调用方行为不变
      };
    } catch (_e) {}
  })();

  // ── 工具: 当前打开的面板栈(给 OOM 前兆定位"哪个面板组合崩的")。
  function openPanelStack() {
    try {
      var ids = [];
      document.querySelectorAll(".panel:not(.hidden)").forEach(function (p) { if (p.id) ids.push(p.id); });
      return ids.join(",");
    } catch (_e) { return ""; }
  }
  // ── 工具: 单位间隔序列的线性回归斜率(每样本的增量)。
  function slope(ys) {
    var n = ys.length; if (n < 2) return 0;
    var sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { sx += i; sy += ys[i]; sxy += i * ys[i]; sxx += i * i; }
    var d = (n * sxx - sx * sx); if (!d) return 0;
    return (n * sxy - sx * sy) / d;
  }

  var SAMPLE_MS = 3000, PER_MIN = 60000 / SAMPLE_MS; // 样本→每分钟换算

  // CSSOS_WAVE_794 20260615 — Jing「肯定是什么代码把内存吃完了」+ Apple 审查优先: 免疫系统【自愈】。
  // 探针本只【检测】DOM 失控却不【恢复】→ 泄漏累积到 OOM 就冻屏/被系统杀(审查员会当崩溃)。
  // 现在: 当 DOM 既【大】又【确认在涨】(真泄漏, 非一次性重 feed)时, 自动重载一次恢复, 且:
  //   ① 绝不在媒体播放中打断(开车听歌不能断); ② 5 分钟内至多自愈一次(防循环); ③ 标 clean 避免误报。
  function _activeMediaPlaying() {
    try { var a = document.getElementById("watch-audio-preview"), v = document.getElementById("watch-video");
      return (a && a.currentSrc && !a.paused && !a.ended) || (v && !v.paused && !v.ended); } catch (_e) { return false; }
  }
  // 当前 DOM 各标签计数 top-N(定位"哪类元素在累积")。
  function _topTags(n) {
    try {
      var all = document.getElementsByTagName("*"), m = {}, i;
      for (i = 0; i < all.length; i++) { var t = all[i].tagName; m[t] = (m[t] || 0) + 1; }
      return Object.keys(m).sort(function (x, y) { return m[y] - m[x]; }).slice(0, n || 4)
        .map(function (k) { return k + "=" + m[k]; }).join(",");
    } catch (_e) { return ""; }
  }
  var _growing = false;   // 本会话是否已确认异常增长(slope 告警置真)
  function _maybeSelfHeal(domCount) {
    var runaway = (_growing && domCount > 4500) || domCount > 8000;   // 既大又涨 = 真泄漏; 或绝对失控
    if (!runaway) return;
    if (_activeMediaPlaying()) return;        // 播放中不打断
    var now = Date.now(), last = 0;
    try { last = Number(sessionStorage.getItem("cssos:oomHealAt") || 0); } catch (_e) {}
    if (now - last < 300000) return;          // 5 分钟内只自愈一次
    try { sessionStorage.setItem("cssos:oomHealAt", String(now)); } catch (_e) {}
    try { localStorage.setItem(CLEAN, "1"); } catch (_e) {}   // 这是受控重载, 不算崩
    globalThis.cssosReportError("OOM self-heal reload: DOM " + domCount + " top=" + _topTags(4), "oom_selfheal");
    try { location.reload(); } catch (_e) {}
  }

  // CSSOS_WAVE_594 #3 — OOM 前兆快照: 用 clean-exit 旗标区分"正常离开"vs"被系统杀(OOM/崩溃)"。
  // 正常 pagehide 会置 clean=1; OOM 杀进程不会 → 重载时发现上次有样本却无 clean 标记 = 崩过 → 上报崩前快照。
  var CLEAN = KEY + ":clean";
  try {
    var prev = load();
    if (prev.length >= 2) {
      var a = prev[0], b = prev[prev.length - 1];
      var msg = "last session: DOM " + a.dom + "→" + b.dom + " · img " + a.img + "→" + b.img +
        " · slides " + a.slides + "→" + b.slides + (b.heapMB ? (" · heap " + a.heapMB + "→" + b.heapMB + "MB") : "") +
        " · last: " + (b.act || "?") + (/ERROR|REJECT/.test(b.tag) ? (" · " + b.tag) : "");
      // CSSOS_WAVE_708 — Jing: 演示时控制台只留 LOGO。这行诊断默认【不打印】(收进开关
      // localStorage['cssos:probeDebug']="1" 才打), 但下面的 OOM 遥测照常上报, 自愈不受影响。
      try { if (localStorage.getItem("cssos:probeDebug") === "1") console.warn("[crash-probe] " + msg, prev); } catch (_e) {}
      var cleanExit = "0";
      try { cleanExit = localStorage.getItem(CLEAN) || "0"; } catch (_e) {}
      // 崩过(无 clean 标记)+ 样本足够 → 上报 OOM 前兆(崩前 DOM/heap/最后动作/面板栈)。
      if (cleanExit !== "1" && prev.length >= 3 && !/ERROR|REJECT/.test(b.tag)) {
        var last = prev.slice(-5);
        var heapTxt = b.heapMB ? (a.heapMB + "→" + b.heapMB + "MB") : "n/a";
        globalThis.cssosReportError(
          "OOM precursor: DOM " + a.dom + "→" + b.dom + " heap " + heapTxt +
          " · panels=" + ((last[last.length - 1] || {}).panel || "?") +
          " · last=" + (b.act || "?"),
          "oom_precursor"
        );
      }
    }
  } catch (_e) {}
  try { localStorage.setItem(CLEAN, "0"); } catch (_e) {} // 本次会话开始: 标记为"未干净退出"
  // 正常离开页面 → 置 clean=1(下次重载就不会误报 OOM)。
  ["pagehide", "beforeunload"].forEach(function (ev) {
    try { window.addEventListener(ev, function () { try { localStorage.setItem(CLEAN, "1"); } catch (_e) {} }); } catch (_e) {}
  });

  save([sample("boot")]); // fresh buffer for THIS session (after reading prev)

  // CSSOS_WAVE_594 #2 — 增长斜率告警: 每 ~60s 用线性回归看 DOM/heap 是否【单调上涨超阈】→ 才上报(稳定不报)。
  var _slopeTicks = 0, _slopeReported = false;
  setInterval(function () {
    var _s = sample("tick");
    try { _maybeSelfHeal(_s.dom || 0); } catch (_e) {}   // W794 自愈检查(每 tick)
    if (_slopeReported) return;
    if (++_slopeTicks % PER_MIN !== 0) return;           // 每分钟评估一次
    try {
      var arr = load(); if (arr.length < 12) return;      // 样本不足不评估
      var doms = arr.map(function (s) { return s.dom || 0; });
      var heaps = arr.map(function (s) { return s.heapMB || 0; });
      var domPerMin = slope(doms) * PER_MIN;
      var heapPerMin = slope(heaps) * PER_MIN;
      // 阈值: DOM 每分钟净增 >250 个, 或 heap 每分钟 >20MB 且持续 → 疑似泄漏。
      if (domPerMin > 250 || heapPerMin > 20) {
        _slopeReported = true; // 本会话只报一次, 防刷屏
        _growing = true;       // W794 — 喂给自愈判定: 已确认异常增长
        // W800 — 一并报 cssmemProbe 计数(定时器/视频/音频 的首末值): 谁在涨一目了然。
        var _a0 = arr[0] || {}, _aN = arr[arr.length - 1] || {};
        var _cnt = "iv " + (_a0.iv ?? "?") + "→" + (_aN.iv ?? "?") +
                   " · vid " + (_a0.vid ?? "?") + "→" + (_aN.vid ?? "?") +
                   " · aud " + (_a0.aud ?? "?") + "→" + (_aN.aud ?? "?") +
                   " · actx " + (_a0.actx ?? "?") + "→" + (_aN.actx ?? "?") +   // W801 — AudioContext 数(应≈0)
                   " · panels " + (_a0.panels ?? "?") + "→" + (_aN.panels ?? "?");
        // W801 — 标签【增长 DELTA】: 哪类元素涨得最快(比"哪类最多"更指向泄漏源)。
        var _grow = "";
        try {
          var t0 = _a0.tagmap || {}, tN = _aN.tagmap || {}, dk = {}, k;
          for (k in tN) dk[k] = (tN[k] || 0) - (t0[k] || 0);
          _grow = Object.keys(dk).filter(function (x) { return dk[x] > 0; })
            .sort(function (a, b) { return dk[b] - dk[a]; }).slice(0, 4)
            .map(function (x) { return x + "+" + dk[x]; }).join(",");
        } catch (_e) {}
        globalThis.cssosReportError(
          "Memory growth: DOM +" + Math.round(domPerMin) + "/min" +
          (heapPerMin > 0 ? (" · heap +" + Math.round(heapPerMin) + "MB/min") : "") +
          " · panels=" + openPanelStack() + " · grow=" + (_grow || "?") + " · " + _cnt,   // W801 增长Δ + 计数趋势
          "mem_growth"
        );
      }
    } catch (_e) {}
  }, SAMPLE_MS);
})();
