/* CSSOS_WAVE_588 20260602 — Jing「用数据定位崩溃, 别猜」: 轻量崩溃探针。
 * 每 3s 打点(DOM/img/幻灯数 + 最后用户动作 + JS堆[若支持]); 存 localStorage(跨崩溃重载仍在)。
 * 崩溃重载后, 控制台 + toast 回显"上次崩前趋势" → 看是哪类在累积(img/slides=封面轮播; dom=DOM泄漏)。
 * 极轻量, 全平台安全。查看完整轨迹: 控制台运行 cssosCrashProbeDump()。 */
(function () {
  "use strict";
  if (globalThis.__cssosCrashProbe) return;
  globalThis.__cssosCrashProbe = true;
  var KEY = "cssos:crashprobe";
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
    sample("tick");
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
        globalThis.cssosReportError(
          "Memory growth: DOM +" + Math.round(domPerMin) + "/min" +
          (heapPerMin > 0 ? (" · heap +" + Math.round(heapPerMin) + "MB/min") : "") +
          " · panels=" + openPanelStack(),
          "mem_growth"
        );
      }
    } catch (_e) {}
  }, SAMPLE_MS);
})();
