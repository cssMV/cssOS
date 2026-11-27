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
      // CSSOS_WAVE_1446r — 组合拳找真业务调用方(前几次都卡在埋点层):
      //  ① 本探针自己(captureSite + setInterval/raf 包装)= 栈顶恒定 2 帧 → 按【序号】无条件跳过
      //     (打包后文件名变 bundle.appN, 按 URL "memory-probe" 过滤失效, 但函数名 captureSite 也兜一道);
      //  ② Sentry SDK(bundle.min.js / sentry-cdn)包装了 rAF/setInterval/AudioContext → 按【URL】滤掉;
      //  剩下第一帧 = 真正发起 rAF/setInterval 的业务代码。
      const _wrap = /captureSite|sentry-cdn|bundle\.min\.js|origSet|origRaf|memory-probe/i;
      const _rest = loc.slice(2).filter(function (ln) { return !_wrap.test(ln); });
      const target = _rest[0] || loc.filter(function (ln) { return !_wrap.test(ln); })[0] || loc[2] || loc[loc.length - 1] || "";
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
  /* CSSOS_WAVE_1838 — 原版只报【后代最多】的那一个容器, 粒度太粗。
   * 2026-08-19 实测: 它每次都指向 main.stage(descendants 2244→5931, span 369→2056),
   * 而 main.stage 是整个舞台的根 —— 等于只说了"泄漏在页面里", 没说在哪个组件里。
   * 改成: 按 span 数排序取前三, 并【剔除祖先】(父子都上榜时只留最深的那个),
   * 于是报出来的一定是真正在长的那个组件, 而不是包着它的容器。
   * 仍保留 top1 的旧字段名(sel/descendants/span/…), 老看板不受影响。 */
  function domHotspot() {
    try {
      const cands = document.querySelectorAll(".panel,[id],main,section,[data-work-id],div");
      const rows = [];
      for (let i = 0; i < cands.length; i++) {
        const el = cands[i];
        const sp = el.getElementsByTagName("span").length;
        if (sp >= 40) rows.push({ el, span: sp });      // 40 以下不是泄漏, 别刷屏
      }
      if (!rows.length) return null;
      rows.sort((x, y) => y.span - x.span);
      // 剔祖先: 若某行包含了另一行(更深的), 留深的 —— 深的才是真正的产出点
      const kept = [];
      for (let i = 0; i < rows.length && kept.length < 3; i++) {
        const r = rows[i];
        let isAncestor = false;
        for (let j = 0; j < rows.length; j++) {
          if (rows[j] !== r && r.el.contains(rows[j].el) && rows[j].span >= r.span * 0.8) { isAncestor = true; break; }
        }
        if (!isAncestor) kept.push(r);
      }
      const list = (kept.length ? kept : rows.slice(0, 3)).map((r) => ({
        sel: selectorOf(r.el),
        span: r.span,
        descendants: r.el.getElementsByTagName("*").length,
      }));
      const top = list[0];
      return {
        sel: top.sel,
        descendants: top.descendants,
        span: top.span,
        strong: kept.length ? kept[0].el.getElementsByTagName("strong").length : 0,
        a: kept.length ? kept[0].el.getElementsByTagName("a").length : 0,
        top3: list,
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

  // ─── CSSOS_WAVE_2392 · 合成面积(WebKit OOM 的真正自变量)───────────
  // 为什么要加这一项: 库里 683 条 crash_recovered 现场, 每一条的 dom_nodes≈3000 /
  // images≈19 / videos=3 / audios=2 —— 和一个【健康页面】量出来的一模一样
  // (2026-11-26 实测: 堆 22.9↔26.3MB 波动无泄漏, 节点 3055 平稳)。
  // 也就是说现场记录【是存在的, 但里面没有致命的那个数】。
  // Safari 的 "reloaded because it was using significant memory" 吃掉的不是 JS 堆,
  // 是【合成面】: 每一层 filter / backdrop-filter / 被提升的层都按
  //   宽 × 高 × devicePixelRatio² × 4 字节
  // 常驻占用, 而且【被挡住、opacity:0 的层照样全额收费】。这一项就是把那个数记下来。
  //
  // 开销自限(别让看门狗自己变成病灶):
  //   · 只在后台不可见时完全跳过;
  //   · 25ms 时间预算, 每 200 个元素查一次表, 超预算立即收手并把 truncated 记进结果
  //     (宁可报"我只量了一部分", 也不许静默少算 —— 见 audit-must-report-its-own-gaps);
  //   · 60s 一次 + 每次 beacon 前一次, 不跟 2s 的 tick 走。
  const _SURF_BUDGET_MS = 25;
  const _SURF_MAX_EL = 4000;
  function compositingSurface() {
    const t0 = (performance && performance.now) ? performance.now() : 0;
    const dpr = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
    const out = {
      dpr: Math.round(dpr * 100) / 100,
      layers: 0,              // 带 filter/backdrop/will-change/transform 的层数
      surface_mb: 0,          // 全部这些层的字节估算 (w*h*dpr²*4)
      hidden_mb: 0,           // 其中【看不见却照样付钱】的部分
      backdrop_layers: 0,     // backdrop-filter: 每帧重采样, 最贵
      backdrop_mb: 0,
      blur_px_max: 0,         // 最大模糊半径 (drop-shadow/blur 按包围盒放大算面)
      panels_total: 0,
      panels_laid_out: 0,     // "关着"却仍 display!==none —— 仍在付合成费
      panels_zero_opacity: 0, // 只靠 opacity:0 藏起来的(最典型的白付钱)
      scanned: 0,
      truncated: false,
    };
    try {
      if (document.visibilityState === "hidden") return null;
      const vw = Math.max(1, globalThis.innerWidth || 1);
      const vh = Math.max(1, globalThis.innerHeight || 1);
      const all = document.getElementsByTagName("*");
      const n = Math.min(all.length, _SURF_MAX_EL);
      for (let i = 0; i < n; i++) {
        if ((i % 200) === 0 && performance && performance.now &&
            (performance.now() - t0) > _SURF_BUDGET_MS) { out.truncated = true; break; }
        const el = all[i];
        out.scanned++;
        let cs;
        try { cs = getComputedStyle(el); } catch (_) { continue; }
        if (!cs) continue;
        const disp = cs.display;
        const isPanel = el.classList && el.classList.contains("panel");
        if (isPanel) {
          out.panels_total++;
          if (disp !== "none") {
            out.panels_laid_out++;
            if (Number(cs.opacity) === 0) out.panels_zero_opacity++;
          }
        }
        if (disp === "none") continue;   // display:none 真的不画, 不收费
        const filt = cs.filter && cs.filter !== "none" ? cs.filter : "";
        const back = cs.backdropFilter || cs.webkitBackdropFilter || "";
        const hasBack = !!back && back !== "none";
        const wc = cs.willChange && cs.willChange !== "auto" ? cs.willChange : "";
        const tf = cs.transform && cs.transform !== "none" ? cs.transform : "";
        if (!filt && !hasBack && !wc && !tf) continue;
        let w = el.offsetWidth || 0, h = el.offsetHeight || 0;
        if (!w || !h) { try { const r = el.getBoundingClientRect(); w = r.width; h = r.height; } catch (_) {} }
        if (!w || !h) continue;
        // 模糊/投影按【包围盒放大】算面: 8px 光晕要为整圈多付一圈像素。
        let grow = 0;
        const bm = (filt + " " + back).match(/(?:blur|drop-shadow)\([^)]*?([\d.]+)px/g);
        if (bm) {
          for (const seg of bm) {
            const v = parseFloat((seg.match(/([\d.]+)px/) || [])[1] || "0");
            if (v > grow) grow = v;
          }
          if (grow > out.blur_px_max) out.blur_px_max = grow;
        }
        const aw = w + grow * 4, ah = h + grow * 4;   // 四周各放大 2× 半径
        const mb = (aw * ah * dpr * dpr * 4) / 1048576;
        out.layers++;
        out.surface_mb += mb;
        if (hasBack) { out.backdrop_layers++; out.backdrop_mb += mb; }
        // "看不见却付钱": opacity 0 / 完全移出视口 / 被祖先透明化
        let paidButUnseen = Number(cs.opacity) === 0 || cs.visibility === "hidden";
        if (!paidButUnseen) {
          try {
            const r = el.getBoundingClientRect();
            if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) paidButUnseen = true;
          } catch (_) {}
        }
        if (paidButUnseen) out.hidden_mb += mb;
      }
      out.surface_mb   = Math.round(out.surface_mb);
      out.hidden_mb    = Math.round(out.hidden_mb);
      out.backdrop_mb  = Math.round(out.backdrop_mb);
      out.blur_px_max  = Math.round(out.blur_px_max);
      out.cost_ms      = (performance && performance.now) ? Math.round(performance.now() - t0) : null;
      return out;
    } catch (_) { return null; }
  }
  let _surfCache = null, _surfAt = 0;
  function surfaceCached(force) {
    const now = Date.now();
    if (force || !_surfCache || (now - _surfAt) > 60000) {
      const s = compositingSurface();
      if (s) { _surfCache = s; _surfAt = now; }
    }
    return _surfCache;
  }

  // ─── Crash-recovery flag ──────────────────────────────────────────
  // The native side (Swift webViewWebContentProcessDidTerminate hook)
  // sets a localStorage key just before forcing reload. We read it on
  // boot, beacon it, then clear it.
  let crashRecovered = false;
  let crashSource = "";
  try {
    if (localStorage.getItem("cssos.crashRecovered") === "1") {
      crashRecovered = true;
      crashSource = "native_hook";
      localStorage.removeItem("cssos.crashRecovered");
    }
  } catch (_) {}

  // ─── CSSOS_WAVE_2392 · 黑匣子(飞行记录器)─────────────────────────
  // 上面那个 flag 只有【App 壳(Capacitor)】会被置位 —— 它来自 Swift 的
  // webViewWebContentProcessDidTerminate 钩子。库里实测印证了这一点:
  // 683 条 crash_recovered 全是 platform=capacitor, 最后一条是 2026-08-29。
  // 而 Jing 截图里那句 "This webpage was reloaded because it was using
  // significant memory" 是【Safari 网页版自己】干的 —— 没有原生钩子, 于是
  // 三个月来一条都没记上。
  //
  // 纯 JS 怎么认出"上一页是被杀掉的":
  //   · sessionStorage 跟标签页同生死, 【能活过这种重载】;
  //   · 每个 tick 覆写一份压缩快照(一个键, 不增长);
  //   · pagehide 时盖一个 clean 章(用户自己刷新/离开 → 有章);
  //   · 被杀时 pagehide 不触发 → 【没有章】。
  // 开机读回: 有快照 + 没盖章 + 本次导航是 reload ⇒ 上一页死于非命,
  // 把【死前最后那一份】当现场补报上去。
  //
  // clean 章带时间戳, 而不是"有章就丢掉":后台被系统回收时 pagehide 是
  // 会触发的(iOS 切后台), 但那一章和重载之间会隔很久 —— 留着时间差才分得清
  // 【用户自己刷新】和【进后台后被回收】。扔掉信息比记错更难查。
  const FDR_KEY = "cssos.mem.fdr";
  function fdrWrite(snap, extra) {
    try {
      if (!snap) return;
      sessionStorage.setItem(FDR_KEY, JSON.stringify({
        v: 2,
        at: Date.now(),
        uptime_s: snap.uptime_s,
        pressure: snap.pressure,
        heap: snap.heap || null,
        dom_nodes: snap.dom_nodes,
        images: snap.images,
        videos: snap.videos,
        audios: snap.audios,
        blob_urls: snap.blob_urls,
        active_intervals: snap.active_intervals,
        interval_sites: snap.interval_sites || [],
        open_panels: snap.open_panels || [],
        surface: snap.surface || null,
        visibility: snap.visibility,
        url: String(location.pathname + location.search).slice(0, 160),
        plays: _playCount,
        ...(extra || {}),
      }));
    } catch (_) { /* 隐身模式 / 配额满 — 看门狗绝不能因此抛错 */ }
  }
  let postMortem = null;
  try {
    const raw = sessionStorage.getItem(FDR_KEY);
    if (raw) {
      const prev = JSON.parse(raw);
      sessionStorage.removeItem(FDR_KEY);          // 只报一次
      let navType = "";
      try {
        const nav = (performance.getEntriesByType &&
                     performance.getEntriesByType("navigation") || [])[0];
        navType = nav ? String(nav.type || "") : "";
      } catch (_) {}
      const gapS = Math.round((Date.now() - Number(prev.at || 0)) / 1000);
      if (navType === "reload" && prev && typeof prev === "object") {
        // 没盖章 = pagehide 从未触发 = 页面被外力终止。
        // 盖了章但隔得久 = 进后台之后才被回收。
        const verdict = !prev.clean
          ? "unclean_kill"
          : (Number(prev.clean_gap_s || 0) > 60 ? "background_kill" : null);
        if (verdict) {
          postMortem = { verdict, nav_type: navType, gap_s: gapS, prev };
          crashRecovered = true;
          if (!crashSource) crashSource = verdict;
        }
      }
    }
  } catch (_) {}

  // play 次数 —— 一个被动监听, 几乎零成本。Jing 的毛病总在"听了很久"之后出现,
  // 没有这个数, 现场记录就答不上"切过多少首"。
  let _playCount = 0;
  try {
    document.addEventListener("play", function () { _playCount++; }, true);
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
    const snapSurface = surfaceCached(false);   // W2392 — 合成面(60s 缓存, 预算自限)

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
      /* CSSOS_WAVE_2392 — 旧的 Safari 兜底判据【永远为真】, 等于没有判据:
       *   score = nodes/1000 + blobs*5 + videos*20 + imgs/100
       * 本平台常驻就有 3 个 <video> → 光这一项已是 60 > 50 阈值 → 恒 red。
       * 实测印证: 库里 ios-safari 49058 条【全部 red】, capacitor 33953 条
       * 【全部 red】, 而 yellow 一条都没有 —— 分数直接跳过了黄区。
       * 一个 100% 命中的检测器既抓不到异常, 也让 red 这个字段失去意义。
       *
       * 换成【合成面】: Safari 的 "using significant memory" 杀的是合成面,
       * 不是 JS 堆(见 safari-oom-is-compositing-not-heap)。surface_mb 是
       * 唯一跟那件事同量纲的数, 所以判据必须建在它上面。
       * 阈值按实测定: 一个 1024×768 的窗口静态常驻约 69MB(其中 35MB 是
       * 看不见却照付的), 所以 150 / 300 留了足够余量, 不会天天喊狼来了。 */
      const surf = snapSurface ? snapSurface.surface_mb : 0;
      if (surf > 300) pressure = "red";
      else if (surf > 150) pressure = "yellow";
      else if (nodes > 20000 || blobRegistry.size > 60) pressure = "yellow";
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
      surface: snapSurface,                  // W2392 — 致命的那个数, 以前整个缺席
      plays: _playCount,                     // W2392 — "切过多少首"
      crash_recovered: crashRecovered,
      crash_source: crashSource || null,
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
      fdrWrite(lastSnap);                 // W2392 — 黑匣子: 每 tick 覆写一份(一个键, 不增长)
      subscribers.forEach((fn) => { try { fn(lastSnap); } catch (_) {} });
    } catch (_) {}
  }
  origSetInterval(tick, SAMPLE_MS);
  setTimeout(tick, 100); // first sample fast

  /* W2392 — pagehide 盖「clean」章。有章 = 用户自己刷新/离开; 无章 = 被外力终止。
   * 章里带时间戳, 下一次启动算得出"盖章到重载隔了多久" → 分得清
   * 【用户刷新(秒级)】和【进后台后被系统回收(分钟级)】。 */
  globalThis.addEventListener("pagehide", function () {
    try {
      fdrWrite(lastSnap || snapshot(), { clean: true, clean_gap_s: 0, clean_at: Date.now() });
    } catch (_) {}
  });

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
      // W2392 — beacon 时强制重量一次合成面(tick 用的是 60s 缓存)。
      let surface = snap.surface;
      try { const f = surfaceCached(true); if (f) surface = f; } catch (_) {}
      const body = JSON.stringify({
        ...snap, surface, dom_hotspot, raf_sites, reason,
        post_mortem: (reason === "post_mortem" ? postMortem : null),
      });
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
  if (postMortem) setTimeout(() => beacon("post_mortem"), 1200);
  else if (crashRecovered) setTimeout(() => beacon("crash_recovered"), 1500);
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
    surface: () => surfaceCached(true), // W2392 — 合成面(WebKit OOM 的真自变量)
    postMortem: () => postMortem,       // W2392 — 上一页死前的最后一份快照
    isIOS, isCapacitor,
  };

  // CSSOS_WAVE_536 — 静音启动 install 日志(保持控制台干净)。
})();
