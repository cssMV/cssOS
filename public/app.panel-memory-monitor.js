/* CSSOS_WAVE_589 20260603 — Jing「按面板内存监控」: 看到底哪个面板最吃内存, 再针对性优化。
 *
 * 为什么按面板归因: JS 引擎只给【全局】堆大小(performance.memory, 还只有 Chromium 暴露),
 * 无法按面板拆分。但"吃内存"在本平台的真实来源是 DOM 节点 + 解码位图(<img>) + 视频/音频
 * 解码缓冲(<video>/<audio>, 单个可达数十 MB)——这些都能按面板 DOM 子树精确数出来。
 * 所以本监控 = 全局堆趋势(若可得) + 每面板的【加权重量】(nodes + img×5 + audio×8 + video×40),
 * 从重到轻排序 → 最重的就是优化目标。基线行 = 不属于任何 .panel 的常驻元素
 * (logo/dock/版本/主题色/AI 助理)。
 *
 * 入口: globalThis.cssosOpenPanelMemoryMonitor() / 右上角 admin 悬浮「🧠」按钮。刷新 2s/次, 仅打开时采样。 */
(function () {
  "use strict";
  if (globalThis.__cssosPanelMemMonInstalled) return;
  globalThis.__cssosPanelMemMonInstalled = true;

  var W_IMG = 5, W_AUDIO = 8, W_VIDEO = 40; // 经验权重: 视频解码缓冲最重。
  var _timer = null;

  // i18n 铁律: 不硬编码任何语言。英文为源, 经运行时翻译器本地化(loginCopy/tr/CSSOS_I18N.t),
  // 都不可用时回退英文(平台英文默认), 绝不回退中文。
  function T(en) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en); } catch (_e) {}
    try { if (globalThis.CSSOS_I18N && typeof globalThis.CSSOS_I18N.t === "function") { var v = globalThis.CSSOS_I18N.t(en); if (v) return v; } } catch (_e) {}
    return en;
  }

  function heapMB() {
    try { if (window.performance && performance.memory) return Math.round(performance.memory.usedJSHeapSize / 1048576); } catch (_e) {}
    return null;
  }
  function heapLimitMB() {
    try { if (window.performance && performance.memory) return Math.round(performance.memory.jsHeapSizeLimit / 1048576); } catch (_e) {}
    return null;
  }

  function measure(root) {
    var nodes = 0, img = 0, video = 0, audio = 0;
    try { nodes = root.getElementsByTagName("*").length; } catch (_e) {}
    try { img = root.querySelectorAll("img").length; } catch (_e) {}
    try {
      var vs = root.querySelectorAll("video");
      video = vs.length;
      // 后台仍在解码(未暂停)的视频单独标注 —— 这是 OOM 主因。
      var playing = 0; for (var i = 0; i < vs.length; i++) { if (!vs[i].paused) playing++; }
      root.__cssosPlayingVideos = playing;
    } catch (_e) {}
    try { audio = root.querySelectorAll("audio").length; } catch (_e) {}
    var weight = nodes + img * W_IMG + audio * W_AUDIO + video * W_VIDEO;
    return { nodes: nodes, img: img, video: video, audio: audio, playing: root.__cssosPlayingVideos || 0, weight: weight };
  }

  function panelLabel(p) {
    var id = p.id || "(panel)";
    var hidden = p.classList.contains("hidden") || p.getAttribute("hidden") !== null;
    return { id: id, hidden: hidden };
  }

  function collect() {
    var rows = [];
    var panels = [].slice.call(document.querySelectorAll(".panel"));
    var inPanel = 0;
    panels.forEach(function (p) {
      var m = measure(p);
      var lab = panelLabel(p);
      rows.push({ id: lab.id, hidden: lab.hidden, m: m });
      inPanel += m.weight;
    });
    // 基线: body 全量 - 各面板 = 常驻元素(logo/dock/版本/主题/AI 等)。
    var whole = measure(document.body);
    var base = {
      nodes: Math.max(0, whole.nodes - rows.reduce(function (a, r) { return a + r.m.nodes; }, 0)),
      img: Math.max(0, whole.img - rows.reduce(function (a, r) { return a + r.m.img; }, 0)),
      video: Math.max(0, whole.video - rows.reduce(function (a, r) { return a + r.m.video; }, 0)),
      audio: Math.max(0, whole.audio - rows.reduce(function (a, r) { return a + r.m.audio; }, 0)),
      playing: 0
    };
    base.weight = base.nodes + base.img * W_IMG + base.audio * W_AUDIO + base.video * W_VIDEO;
    rows.sort(function (a, b) { return b.m.weight - a.m.weight; });
    // CSSOS_WAVE_636 — Jing「baseline 2,300 节点到底谁吃的? Dock/版本/主题凭什么? 肯定有猫腻」:
    // 把 baseline 拆成具名常驻组件 + 一个 OTHER(不明)桶 —— 不明大户立刻现形。
    var BASE_PARTS = [
      { label: "AI assistant", sel: "#cssos-agent-panel,#cssos-agent-fab" },
      { label: "Dock", sel: "#dock" },
      { label: "Version menu", sel: "#version-switch" },
      { label: "Theme menu", sel: "#theme-switch" },
    ];
    var baseParts = BASE_PARTS.map(function (p) {
      var agg = { nodes: 0, img: 0, video: 0, audio: 0, playing: 0, weight: 0 };
      try {
        [].forEach.call(document.querySelectorAll(p.sel), function (el) {
          var mm = measure(el);
          agg.nodes += mm.nodes; agg.img += mm.img; agg.video += mm.video; agg.audio += mm.audio; agg.weight += mm.weight;
        });
      } catch (_e) {}
      return { id: p.label, m: agg };
    });
    var accounted = baseParts.reduce(function (a, p) { return a + p.m.nodes; }, 0);
    var other = { nodes: Math.max(0, base.nodes - accounted), img: 0, video: 0, audio: 0, playing: 0 };
    other.weight = other.nodes;
    baseParts.push({ id: "OTHER (unaccounted)", m: other });
    baseParts.sort(function (a, b) { return b.m.nodes - a.m.nodes; });
    return { rows: rows, base: base, baseParts: baseParts, whole: whole };
  }

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  function render() {
    var host = document.getElementById("cssos-pmm");
    if (!host) return;
    var body = host.querySelector(".pmm-body");
    if (!body) return;
    var data = collect();
    var h = heapMB(), hl = heapLimitMB();
    var maxW = Math.max(1, data.rows.length ? data.rows[0].m.weight : 1, data.base.weight);

    function bar(w) {
      var pct = Math.min(100, Math.round((w / maxW) * 100));
      return '<div class="pmm-bar"><span style="width:' + pct + '%"></span></div>';
    }
    function line(label, m, isBase) {
      var warn = m.playing > 0 ? ' <b class="pmm-warn" title="' + T("Videos still decoding in the background (main OOM cause)") + '">▶' + m.playing + '</b>' : "";
      return '<div class="pmm-row' + (isBase ? ' pmm-base' : '') + '">' +
        '<div class="pmm-name">' + label + warn + '</div>' +
        bar(m.weight) +
        '<div class="pmm-nums">w' + fmt(m.weight) + ' · ' + fmt(m.nodes) + ' nodes · ' + m.img + ' img · ' + m.video + ' vid · ' + m.audio + ' aud</div>' +
        '</div>';
    }

    var heapLine = (h != null)
      ? (T("Heap") + ' ' + h + (hl ? '/' + hl : '') + ' MB')
      : T("Heap size not exposed by this browser (Safari/iOS) — see weights below");
    var rowsHtml = data.rows.map(function (r) {
      var name = (r.hidden ? '· ' : '● ') + r.id;
      return line(name, r.m);
    }).join("");

    body.innerHTML =
      '<div class="pmm-heap">' + heapLine + ' · ' + T("Whole page") + ' ' + fmt(data.whole.nodes) + ' nodes / ' + data.whole.img + ' img / ' + data.whole.video + ' vid</div>' +
      '<div class="pmm-legend">' + T("weight w = nodes + img×5 + audio×8 + video×40") + '　|　' + T("● shown · hidden · ▶N = background-decoding videos") + '</div>' +
      line(T("Baseline (logo / dock / version / theme / AI)"), data.base, true) +
      // CSSOS_WAVE_636 — baseline 拆解: 谁在吃这 2,300 节点, 一目了然(含 OTHER 不明桶)。
      (data.baseParts || []).map(function (p) {
        return line('　↳ ' + p.id, p.m);
      }).join("") +
      (rowsHtml || '<div class="pmm-empty">' + T("No panels currently open.") + '</div>');
  }

  function injectStyle() {
    if (document.getElementById("cssos-pmm-style")) return;
    var st = document.createElement("style"); st.id = "cssos-pmm-style";
    st.textContent = [
      "#cssos-pmm{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:var(--cssos-overlay,rgba(0,0,0,0.58));-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}",
      "#cssos-pmm[hidden]{display:none;}",
      "#cssos-pmm .pmm-card{width:min(560px,94vw);max-height:86vh;overflow:auto;border-radius:18px;padding:18px;background:var(--cssos-surface,rgba(12,22,18,0.97));border:1px solid var(--cssos-border,hsla(155,100%,65%,0.28));color:#eafff6;box-shadow:0 16px 48px rgba(0,0,0,0.5);}",
      "#cssos-pmm h3{margin:0 0 2px;font-size:16px;font-weight:700;}",
      "#cssos-pmm .pmm-heap{font:600 12.5px/1.4 ui-monospace,monospace;opacity:0.92;margin:6px 0 2px;}",
      "#cssos-pmm .pmm-legend{font-size:10.5px;opacity:0.6;margin-bottom:10px;}",
      "#cssos-pmm .pmm-row{margin:7px 0;}",
      "#cssos-pmm .pmm-row.pmm-base{opacity:0.78;}",
      "#cssos-pmm .pmm-name{font:600 12.5px/1.3 -apple-system,system-ui,sans-serif;margin-bottom:3px;}",
      "#cssos-pmm .pmm-bar{height:7px;border-radius:999px;background:rgba(255,255,255,0.10);overflow:hidden;}",
      "#cssos-pmm .pmm-bar span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,hsl(155,66%,46%),hsl(45,90%,55%));}",
      "#cssos-pmm .pmm-nums{font:500 10.5px/1.3 ui-monospace,monospace;opacity:0.7;margin-top:3px;}",
      "#cssos-pmm .pmm-warn{color:#ff9b6b;}",
      "#cssos-pmm .pmm-empty{opacity:0.6;font-size:12px;padding:8px 0;}",
      "#cssos-pmm .pmm-head{display:flex;align-items:center;gap:8px;margin-bottom:4px;}",
      "#cssos-pmm .pmm-head .pmm-x{margin-left:auto;background:rgba(255,255,255,0.16);border:0;color:#fff;border-radius:999px;width:28px;height:28px;font-size:15px;cursor:pointer;}",
      "#cssos-pmm-fab{position:fixed;top:8px;right:96px;z-index:2147483000;width:30px;height:30px;border-radius:999px;border:1px solid var(--cssos-border,hsla(155,100%,65%,0.28));background:rgba(12,22,18,0.7);color:#eafff6;font-size:15px;cursor:pointer;line-height:28px;text-align:center;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}"
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function open() {
    injectStyle();
    var host = document.getElementById("cssos-pmm");
    if (!host) {
      host = document.createElement("div"); host.id = "cssos-pmm";
      host.innerHTML =
        '<div class="pmm-card" role="dialog" aria-modal="true">' +
          '<div class="pmm-head"><h3>🧠 ' + T("Panel memory monitor") + '</h3>' +
            '<button type="button" class="pmm-x" aria-label="' + T("Close") + '">✕</button></div>' +
          '<div class="pmm-body"></div>' +
        '</div>';
      document.body.appendChild(host);
      host.addEventListener("click", function (e) { if (e.target === host) close(); });
      host.querySelector(".pmm-x").addEventListener("click", close);
    }
    host.hidden = false;
    render();
    clearInterval(_timer);
    _timer = setInterval(function () { if (!host.hidden) render(); else { clearInterval(_timer); _timer = null; } }, 2000);
  }
  function close() {
    var host = document.getElementById("cssos-pmm");
    if (host) host.hidden = true;
    clearInterval(_timer); _timer = null;
  }

  globalThis.cssosOpenPanelMemoryMonitor = open;
  globalThis.cssosClosePanelMemoryMonitor = close;

  // CSSOS_WAVE_594 — 不再自挂右上角悬浮 🧠(避免主界面堆图标)。入口改由 AI 助理 ⋯ 菜单触发
  // (admin 项), 调 globalThis.cssosOpenPanelMemoryMonitor()。injectStyle 仍在 open() 内按需注入。
})();
