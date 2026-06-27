/* CSSOS_WAVE_220A 20260517 — Jing: memory & leak probe.
 *
 * Purpose: surface the metrics that predict iOS WKWebView WebContent
 * process termination so we know WHAT to cut in W220.B (real unload)
 * and W220.C (asset lifecycle). NOT a fix — pure instrumentation.
 *
 * Diagnosis (cold facts):
 *   - public/index.html ships ~203 eager <script src="app.*.js"> tags
 *   - iOS WKWebView WebContent process is killed by iOS at ~1.5 GB
 *   - Symptom: "page just refreshes, no console error" — because the
 *     process carrying the console died. WKWebView reloads silently.
 *
 * What we measure (every 2s, lightweight):
 *   - JS heap (Chrome/Edge expose performance.memory; Safari hides it,
 *     we fall back to a synthetic estimator that doubles when DOM grows)
 *   - DOM node count + <img> + <video> + <audio>
 *   - Active blob URLs (we patch URL.createObjectURL to register them)
 *   - In-flight fetch / XHR
 *   - Detached panel scripts still loaded (heuristic: count
 *     window.<modulePrefix>* globals)
 *   - Active timers (best-effort via setInterval patching)
 *   - Document visibility + freshness (uptime since last reload)
 *
 * Beacon: every 30s POST snapshot to /api/telemetry/memory plus on
 * pagehide / visibility hidden / before unload. The server side is in
 * src/index.ts; lightweight JSON insert into telemetry_memory_samples.
 *
 * Exposes:
 *   globalThis.cssmemProbe.snapshot()          → current metrics object
 *   globalThis.cssmemProbe.subscribe(fn)       → fn(metrics) every tick
 *   globalThis.cssmemProbe.markPanelOpen(id)
 *   globalThis.cssmemProbe.markPanelClose(id)
 *   globalThis.cssmemProbe.recoveredFromCrash() → true if iOS killed us
 *
 * Touch nothing if Capacitor isn't present AND user isn't admin — we
 * still measure on web for dev visibility, but skip the network beacon
 * to avoid noise.
 */
(function () {
  if (globalThis.cssmemProbe) return; // idempotent

  const BOOT_TS = Date.now();
  const SAMPLE_MS = 2000;
  const BEACON_MS = 30000;

  // ─── Blob URL registry (createObjectURL patch) ────────────────────
  const blobRegistry = new Set();
  const origCreate = URL.createObjectURL.bind(URL);
  const origRevoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    const url = origCreate(obj);
    blobRegistry.add(url);
    return url;
  };
  URL.revokeObjectURL = function (url) {
    blobRegistry.delete(url);
    return origRevoke(url);
  };

  // ─── In-flight fetch counter ──────────────────────────────────────
  let inflightFetch = 0;
  const origFetch = globalThis.fetch?.bind(globalThis);
  if (origFetch) {
    globalThis.fetch = function (...args) {
      inflightFetch++;
      const p = origFetch(...args);
      p.finally(() => { inflightFetch = Math.max(0, inflightFetch - 1); });
      return p;
    };
  }

  // ─── CSSOS_WAVE_1078 — 泄漏定位: 给每个定时器/rAF 打【创建处标签】+ DOM 热点容器 ──
  // 旧版只数"有多少个定时器/多少 DOM 节点"(症状), 不知道【是谁建的、堆在哪】(位置)。
  // 反复"抓到根因"又复发, 就是因为只有症状靠猜。这里加位置: 下一次真实 OOM 报告
  // 直接带"哪个函数泄漏了 N 个定时器 + 哪个 DOM 容器在膨胀"。
  // CSSOS_WAVE_1446m 20260627 — Jing 长会话 OOM 真凶定位修复: 旧 captureSite 靠【函数名正则】
  // 跳过探针自己的帧(memory-probe/captureSite/setInterval…), 但前端【打包压缩后所有帧都是匿名
  // bundle.appN.js:2:X、无函数名】→ 正则永远不匹配 → 返回了【setInterval 包装帧自身】(就是
  // digest 里那条没用的 ivsrc=bundle.app3:2:659)。修: 只看【带 :line:col 位置的帧】, 按序号
  // 无条件跳过前两帧(captureSite 本身 + setInterval/raf 包装), 返回第三帧 = 真正的调用方。
  // 不依赖函数名 → 抗压缩。V8(Error 前缀行) / Safari(无前缀) 两种栈格式都兼容。
  function captureSite() {
    try {
      const stack = (new Error()).stack || "";
      const frames = stack.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      // 只保留带 :行:列 的真实栈帧(丢掉 V8 的 "Error" 前缀行)。
      let loc = frames.filter(function (ln) { return /:\d+:\d+/.test(ln); });
      // CSSOS_WAVE_1446q — 跳过【所有埋点包装层】, 找真正的业务调用方:
      //  ① 本探针自己(memory-probe / origSet…);
      //  ② Sentry SDK(bundle.min.js / sentry-cdn) —— Sentry 包装了 rAF/setInterval/AudioContext,
      //     真实 rAF 穿过它, 栈停在 Sentry 就报错位置(bundle.min.js:70952)而非真源。
      // 按 URL 子串过滤(压缩后无函数名, 但 URL 文件名仍在)→ 留下第一帧业务代码 = 真调用方。
      const _wrap = /memory-probe|sentry-cdn|bundle\.min\.js|origSet|origRaf/i;
      const _appLoc = loc.filter(function (ln) { return !_wrap.test(ln); });
      const target = _appLoc[0] || loc[2] || loc[loc.length - 1] || "";
      if (!target) return "?";
      // 解析 "fn@file:line:col" (Safari) 或 "at fn (file:line:col)" (V8)。
      // CSSOS_WAVE_1446o — 连【列号】一起留(file:line:col): 压缩后整包是一两行, 没列号根本
      // 定位不到泄漏那一句(digest 只报 bundle.min.js:2 无从下手)。带上列号即可精确点名。
      const m = target.match(/(?:at\s+)?([^\s(@]+)?\s*[@(]?\s*([^)\s@]*?:\d+:\d+)\)?/);
      if (m) {
        const fn = (m[1] && m[1] !== "<anonymous>" && !/^https?$/.test(m[1])) ? m[1] : "";
        const file = String(m[2] || "").split("/").pop();
        return ((fn ? fn + "@" : "") + file).slice(0, 70);
      }
      return target.replace(/^at\s+/, "").slice(0, 60);
    } catch (_) {}
    return "?";
  }

  // ─── Active interval tracking (id → creation site) ────────────────
  const intervalRegistry = new Map();
  const origSetInterval = globalThis.setInterval.bind(globalThis);
  const origClearInterval = globalThis.clearInterval.bind(globalThis);
  globalThis.setInterval = function (...args) {
    const id = origSetInterval(...args);
    try { intervalRegistry.set(id, captureSite()); } catch (_) { intervalRegistry.set(id, "?"); }
    return id;
  };
  globalThis.clearInterval = function (id) {
    intervalRegistry.delete(id);
    return origClearInterval(id);
  };
  // Top creation-sites among LIVE intervals → 谁建的最多(=泄漏源)。
  function intervalTopSites(n) {
    const c = Object.create(null);
    for (const site of intervalRegistry.values()) c[site] = (c[site] || 0) + 1;
    return Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, n || 3).map((s) => s + "×" + c[s]);
  }

  // ─── requestAnimationFrame leak sampling ──────────────────────────
  // rAF 每帧 ~60 次, 抓栈太贵 → 每 30 次采样一次创建处。自调度的泄漏循环(如孤儿
  // dualLoop)会持续累积同一处样本 → 浮出水面。窗口值每次 beacon 后清零看"速率"。
  let rafWindow = Object.create(null);
  let _rafN = 0;
  const origRAF = globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame.bind(globalThis) : null;
  if (origRAF) {
    globalThis.requestAnimationFrame = function (cb) {
      if ((++_rafN % 30) === 0) { try { const s = captureSite(); rafWindow[s] = (rafWindow[s] || 0) + 1; } catch (_) {} }
      return origRAF(cb);
    };
  }
  function rafTopSites(n) {
    return Object.keys(rafWindow).sort((a, b) => rafWindow[b] - rafWindow[a]).slice(0, n || 3).map((s) => s + "×" + rafWindow[s]);
  }

  // ─── DOM hotspot: 哪个容器装着最多节点(膨胀的真身)──────────────
  function selectorOf(el) {
    try {
      if (el.id) return "#" + el.id;
      let seg = el.tagName.toLowerCase();
      if (el.className && typeof el.className === "string") {
        const c = el.className.trim().split(/\s+/).slice(0, 2).join(".");
        if (c) seg += "." + c;
      }
      const p = el.parentElement;
      if (p && p.id) return "#" + p.id + ">" + seg;
      return seg;
    } catch (_) { return "?"; }
  }
  function domHotspot() {
    try {
      let best = null, bestN = 0;
      const cands = document.querySelectorAll(".panel,[id],main,section,[data-work-id]");
      for (let i = 0; i < cands.length; i++) {
        const n = cands[i].getElementsByTagName("*").length;
        if (n > bestN) { bestN = n; best = cands[i]; }
      }
      if (!best) return null;
      return {
        sel: selectorOf(best),
        descendants: bestN,
        span: best.getElementsByTagName("span").length,
        strong: best.getElementsByTagName("strong").length,
        a: best.getElementsByTagName("a").length,
      };
    } catch (_) { return null; }
  }

  // ─── Panel open/close tracking ────────────────────────────────────
  const openPanels = new Set();
  function markPanelOpen(id) { if (id) openPanels.add(String(id)); }
  function markPanelClose(id) { if (id) openPanels.delete(String(id)); }

  // ─── Capacitor / iOS detection ────────────────────────────────────
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isCapacitor = !!(globalThis.Capacitor && globalThis.Capacitor.isNativePlatform && globalThis.Capacitor.isNativePlatform());

  // ─── Crash-recovery flag ──────────────────────────────────────────
  // The native side (Swift webViewWebContentProcessDidTerminate hook)
  // sets a localStorage key just before forcing reload. We read it on
  // boot, beacon it, then clear it.
  let crashRecovered = false;
  try {
    if (localStorage.getItem("cssos.crashRecovered") === "1") {
      crashRecovered = true;
      localStorage.removeItem("cssos.crashRecovered");
    }
  } catch (_) {}

  // ─── Snapshot ─────────────────────────────────────────────────────
  function snapshot() {
    const now = Date.now();
    const perf = performance;
    const mem = perf && perf.memory ? {
      used_mb: Math.round((perf.memory.usedJSHeapSize || 0) / 1048576),
      total_mb: Math.round((perf.memory.totalJSHeapSize || 0) / 1048576),
      limit_mb: Math.round((perf.memory.jsHeapSizeLimit || 0) / 1048576),
    } : null;

    const imgs = document.images ? document.images.length : 0;
    const videos = document.querySelectorAll("video").length;
    const audios = document.querySelectorAll("audio").length;
    const nodes = document.getElementsByTagName("*").length;

    // Heuristic: count globals matching app.*.js module hooks. Many
    // modules add globalThis.cssmv* / cssos* / __cssos* keys.
    let moduleGlobals = 0;
    try {
      for (const k of Object.keys(globalThis)) {
        if (/^cssmv|^cssos|^__cssos/i.test(k)) moduleGlobals++;
      }
    } catch (_) {}

    // Pressure level — green/yellow/red. Tuned for iOS 1.5GB ceiling.
    // Without performance.memory (Safari), fall back to DOM size.
    let pressure = "green";
    if (mem) {
      const r = mem.used_mb / Math.max(1, mem.limit_mb);
      if (r > 0.75) pressure = "red";
      else if (r > 0.5) pressure = "yellow";
    } else {
      // Safari fallback: DOM + blob URLs + videos as proxy.
      const score = nodes / 1000 + blobRegistry.size * 5 + videos * 20 + imgs / 100;
      if (score > 50) pressure = "red";
      else if (score > 25) pressure = "yellow";
    }

    return {
      ts: now,
      uptime_s: Math.round((now - BOOT_TS) / 1000),
      pressure,
      heap: mem,
      dom_nodes: nodes,
      images: imgs,
      videos,
      audios,
      blob_urls: blobRegistry.size,
      inflight_fetch: inflightFetch,
      open_panels: Array.from(openPanels),
      open_panel_count: openPanels.size,
      active_intervals: intervalRegistry.size,
      interval_sites: intervalTopSites(3),   // W1078 — 谁建的最多(泄漏源)
      module_globals: moduleGlobals,
      script_tags_eager: document.querySelectorAll('script[src*="app."]:not([type="cssos-lazy"])').length,
      script_tags_lazy: document.querySelectorAll('script[type="cssos-lazy"]').length,
      crash_recovered: crashRecovered,
      platform: isCapacitor ? "capacitor" : (isIOS ? "ios-safari" : "web"),
      visibility: document.visibilityState || "unknown",
      ua: navigator.userAgent.slice(0, 200),
    };
  }

  // ─── Subscribers (HUD reads from here) ────────────────────────────
  const subscribers = new Set();
  function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }

  let lastSnap = null;
  function tick() {
    try {
      lastSnap = snapshot();
      subscribers.forEach((fn) => { try { fn(lastSnap); } catch (_) {} });
    } catch (_) {}
  }
  origSetInterval(tick, SAMPLE_MS);
  setTimeout(tick, 100); // first sample fast

  // ─── Beacon ───────────────────────────────────────────────────────
  let lastBeaconTs = 0;
  async function beacon(reason) {
    try {
      const snap = lastSnap || snapshot();
      // W1078 — beacon 时附带"位置"(每 tick 算太贵, 只在 30s beacon 算): DOM 热点容器 + rAF 泄漏源。
      let dom_hotspot = null, raf_sites = [];
      try { dom_hotspot = domHotspot(); } catch (_) {}
      try { raf_sites = rafTopSites(3); } catch (_) {}
      rafWindow = Object.create(null);   // 清窗口 → 下次 beacon 反映新速率
      const body = JSON.stringify({ ...snap, dom_hotspot, raf_sites, reason });
      // Use sendBeacon when available — fire-and-forget, survives unload.
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/telemetry/memory", blob);
      } else {
        fetch("/api/telemetry/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
          credentials: "include",
        }).catch(() => {});
      }
      lastBeaconTs = Date.now();
    } catch (_) {}
  }
  origSetInterval(() => beacon("interval"), BEACON_MS);
  if (crashRecovered) setTimeout(() => beacon("crash_recovered"), 1500);
  globalThis.addEventListener("pagehide",       () => beacon("pagehide"));
  globalThis.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") beacon("hidden");
  });

  // ─── Public API ───────────────────────────────────────────────────
  globalThis.cssmemProbe = {
    snapshot,
    subscribe,
    markPanelOpen,
    markPanelClose,
    recoveredFromCrash: () => crashRecovered,
    beacon: (r) => beacon(r || "manual"),
    intervalSites: intervalTopSites,   // W1078 — 泄漏定时器创建源
    rafSites: rafTopSites,             // W1078 — 泄漏 rAF 源
    domHotspot,                        // W1078 — 膨胀的 DOM 容器
    isIOS, isCapacitor,
  };

  // CSSOS_WAVE_536 — 静音启动 install 日志(保持控制台干净)。
})();
