/* CSSOS_WAVE_522/524 20260606 — Jing「引擎面板: 我们胶囊风格分类标签 + Kie 全目录列表」.
 *
 * 独立脚本(defer, 不进 bundle / 不动打包器 → 零崩站风险)。在引擎面板
 * ([data-mv-engines-panel]) 渲染好后注入:
 *   1) 一条我们 data-pill-bar 凸嵌凹胶囊标签行: [全部] 歌词/封面图/音乐/视频/字幕/合成;
 *   2) 一个 Kie 模型列表区(拉 /api/engines/kie-catalog): 点歌词/封面图/音乐/视频标签 →
 *      列出该类几十上百个 Kie 模型(🔥人气 + 名称 + 厂商 + 我们的价 + 搜索), 点卡片即选中
 *      (写 cssmvEngines.setSelection → 广播全平台同步)。
 *   3) [全部] 显示原有 6 段下拉网格; 字幕/合成为本地, 仅显示该段本地下拉。
 * 命名/顺序按我们平台风格, 歌词为根基排第一(三强已由后端置顶)。 */
(function () {
  "use strict";
  if (globalThis.__cssosEnginePickerTabs) return;
  globalThis.__cssosEnginePickerTabs = true;

  var STAGE_META = {
    lyrics:    { icon: "📝", label: "歌词", kie: true },
    cover:     { icon: "🖼", label: "封面图", kie: true },
    music:     { icon: "🎵", label: "音乐", kie: true },
    video:     { icon: "🎬", label: "视频", kie: true },
    subtitles: { icon: "💬", label: "字幕", kie: false },
    compose:   { icon: "🎚", label: "合成", kie: false },
  };
  var ORDER = ["lyrics", "cover", "music", "video", "subtitles", "compose"];

  var kieCache = null, kiePending = null;
  function loadKie() {
    if (kieCache) return Promise.resolve(kieCache);
    if (kiePending) return kiePending;
    kiePending = fetch("/api/engines/kie-catalog", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) { kieCache = (j && j.stages) ? j : { stages: {} }; return kieCache; })
      .catch(function () { kieCache = { stages: {} }; return kieCache; });
    return kiePending;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var PAGE = 10;   // CSSOS_WAVE_772 — Jing: 默认显示 10, 上滑加载 10。
  function renderKieList(listEl, stageKey, query) {
    var cat = (kieCache && kieCache.stages && kieCache.stages[stageKey]) || [];
    var q = String(query || "").trim().toLowerCase();
    var rows = cat.filter(function (e) {
      return !q || (e.label + " " + e.provider).toLowerCase().indexOf(q) !== -1;
    });
    listEl.__rows = rows; listEl.__stage = stageKey; listEl.__shown = PAGE;
    if (!rows.length) {
      listEl.innerHTML = '<div class="cssmv-kie-empty">' +
        (cat.length ? "无匹配模型" : "正在加载 Kie 目录…") + "</div>";
      return;
    }
    paintKiePage(listEl);
  }
  function paintKiePage(listEl) {
    var stageKey = listEl.__stage;
    var rows = listEl.__rows || [];
    var shown = Math.min(listEl.__shown || PAGE, rows.length);
    var api = globalThis.cssmvEngines;
    var sel = api && typeof api.getSelection === "function" ? api.getSelection(stageKey) : null;
    var html = rows.slice(0, shown).map(function (e) {
      var isSel = sel && sel.engine === e.id;
      var fire = e.usageCount > 0 ? ('<span class="cssmv-kie-fire">🔥 ' + e.usageCount + "</span>") : "";
      var price = e.usdOurs ? ("$" + e.usdOurs) : "";
      return '<button type="button" class="cssmv-kie-card' + (isSel ? " is-sel" : "") +
        '" data-kie-id="' + esc(e.id) + '" data-kie-stage="' + esc(stageKey) + '" title="' + esc(e.label) + '">' +
        '<span class="cssmv-kie-name">' + esc(e.label) + "</span>" +
        '<span class="cssmv-kie-meta">' + esc(e.provider) + " " + fire +
        '<span class="cssmv-kie-price">' + esc(price) + "</span></span>" +
        "</button>";
    }).join("");
    if (shown < rows.length) {
      // CSSOS_WAVE_775 — Jing「外层还有内容, 上滑动作用不上」: 改成【点击加载更多】按钮, 不依赖滚动容器。
      html += '<button type="button" class="cssmv-kie-more" data-kie-more="1">已显示 ' + shown + " / " + rows.length + " · 点击加载更多 10</button>";
    }
    listEl.innerHTML = html;
    var moreBtn = listEl.querySelector("[data-kie-more]");
    if (moreBtn) moreBtn.addEventListener("click", function () {
      listEl.__shown = (listEl.__shown || PAGE) + PAGE; paintKiePage(listEl);
    });
    listEl.querySelectorAll(".cssmv-kie-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var id = card.getAttribute("data-kie-id");
        if (api && typeof api.setSelection === "function") {
          api.setSelection(stageKey, id, "kie"); // 广播 → 全平台同步
        }
        /* CSSOS_WAVE_528 20260606 — Jing「seedance 视频整条接通」: 选 seedance 视频模型时,
         * 把后端读得到的 cookie 也写上 → /api/mv/video 的 userPreferredOrder/ModelMap 读到 →
         * callVideoGen prefer:["seedance"] + 该变体 → callKieJob → 计费/🔥。已验证的家族先接,
         * 其余家族接了适配器后同法扩展(目前仅 seedance 会真正驱动生成)。 */
        try {
          if (stageKey === "video" && /^bytedance\/seedance/.test(String(id || ""))) {
            var maxAge = "; path=/; max-age=" + (180 * 24 * 3600);
            document.cookie = "cssos_video_prefer=seedance" + maxAge;
            document.cookie = "cssos_video_seedance_model=" + encodeURIComponent(id) + maxAge;
          }
        } catch (_e) {}
        listEl.querySelectorAll(".cssmv-kie-card.is-sel").forEach(function (c) { c.classList.remove("is-sel"); });
        card.classList.add("is-sel");
      });
    });
  }

  function injectStyleOnce() {
    if (document.getElementById("cssmv-kie-list-style")) return;
    var st = document.createElement("style");
    st.id = "cssmv-kie-list-style";
    st.textContent = [
      "#person-mv-panel .cssmv-engine-tabs,[data-mv-engines-panel] .cssmv-engine-tabs{margin:0 0 10px 0;}",
      "[data-mv-engines-panel] .cssmv-kie-wrap{margin-top:8px;}",
      "[data-mv-engines-panel] .cssmv-kie-search{width:100%;box-sizing:border-box;margin-bottom:8px;padding:7px 12px;border-radius:999px;border:1px solid rgba(0,245,160,0.30);background:rgba(0,245,160,0.06);color:inherit;font:500 13px/1.2 ui-monospace,monospace;}",
      "[data-mv-engines-panel] .cssmv-kie-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;max-height:340px;overflow-y:auto;}",
      "[data-mv-engines-panel] .cssmv-kie-card{all:unset;cursor:pointer;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;padding:9px 12px;border-radius:12px;border:1px solid rgba(0,245,160,0.22);background:rgba(0,245,160,0.05);transition:background .15s,border-color .15s;}",
      "[data-mv-engines-panel] .cssmv-kie-card:hover{background:rgba(0,245,160,0.12);}",
      "[data-mv-engines-panel] .cssmv-kie-card.is-sel{background:rgba(0,200,120,0.85);border-color:rgba(0,245,160,0.7);color:#fff;}",
      "[data-mv-engines-panel] .cssmv-kie-name{font:600 12px/1.25 -apple-system,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "[data-mv-engines-panel] .cssmv-kie-meta{display:flex;align-items:center;gap:6px;font:500 11px/1.2 -apple-system,system-ui,sans-serif;opacity:0.85;}",
      "[data-mv-engines-panel] .cssmv-kie-price{margin-left:auto;font-weight:700;}",
      "[data-mv-engines-panel] .cssmv-kie-fire{color:#ff8a3d;font-weight:700;}",
      "[data-mv-engines-panel] .cssmv-kie-empty{padding:18px;text-align:center;opacity:0.7;font-size:13px;}",
      "[data-mv-engines-panel] .cssmv-kie-more{all:unset;grid-column:1/-1;display:block;width:100%;box-sizing:border-box;cursor:pointer;padding:9px;text-align:center;font-size:12px;border-radius:10px;border:1px dashed rgba(0,245,160,0.35);background:rgba(0,245,160,0.05);color:inherit;opacity:0.85;}",
      "[data-mv-engines-panel] .cssmv-kie-more:hover{background:rgba(0,245,160,0.14);opacity:1;}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function buildTabs(anchor) {
    if (!(anchor instanceof HTMLElement)) return;
    var grid = anchor.querySelector(".mv-engines-grid");
    if (!grid) return;
    var rows = anchor.querySelectorAll(".mv-engine-row[data-mv-engine-stage]");
    if (!rows.length) return;
    if (anchor.querySelector(".cssmv-engine-tabs")) return; // 幂等
    injectStyleOnce();

    var present = [];
    rows.forEach(function (r) {
      var k = String(r.getAttribute("data-mv-engine-stage") || "").toLowerCase();
      if (k && present.indexOf(k) === -1) present.push(k);
    });
    var ordered = ORDER.filter(function (k) { return present.indexOf(k) !== -1; });
    present.forEach(function (k) { if (ordered.indexOf(k) === -1) ordered.push(k); });
    if (!ordered.length) return;

    // 标签行(我们的胶囊)
    var bar = document.createElement("div");
    bar.className = "cssmv-engine-tabs cssmv-pill-bar";
    bar.setAttribute("data-pill-bar", ""); bar.setAttribute("data-pill-text", "dark"); bar.setAttribute("role", "tablist");
    var th = '<button type="button" class="active" data-pill-key="all" data-stage-filter="all">🎛 <span>全部</span></button>';
    ordered.forEach(function (k) {
      var m = STAGE_META[k] || { icon: "•", label: k };
      th += '<button type="button" data-pill-key="' + k + '" data-stage-filter="' + k + '">' + m.icon + ' <span>' + m.label + "</span></button>";
    });
    bar.innerHTML = th;
    anchor.insertBefore(bar, grid);

    // Kie 列表区(隐藏, 按需显示)
    var wrap = document.createElement("div");
    wrap.className = "cssmv-kie-wrap";
    wrap.style.display = "none";
    wrap.innerHTML = '<input class="cssmv-kie-search" type="search" placeholder="按名称 / 厂商搜索 Kie 模型…" /><div class="cssmv-kie-list"></div>';
    grid.parentNode.insertBefore(wrap, grid.nextSibling);
    var searchEl = wrap.querySelector(".cssmv-kie-search");
    var listEl = wrap.querySelector(".cssmv-kie-list");
    var curStage = null;
    searchEl.addEventListener("input", function () { if (curStage) renderKieList(listEl, curStage, searchEl.value); });
    // CSSOS_WAVE_772 — 上滑(接近底部)加载多 10 条。
    listEl.addEventListener("scroll", function () {
      if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 40) {
        var rows = listEl.__rows || [];
        if ((listEl.__shown || PAGE) < rows.length) { listEl.__shown = (listEl.__shown || PAGE) + PAGE; paintKiePage(listEl); }
      }
    }, { passive: true });
    // CSSOS_WAVE_772 — 标签显示实时家数(歌词 45 / 封面图 72 / 音乐 24 / 视频 179),从 live kie 目录拉。
    loadKie().then(function () {
      ordered.forEach(function (k) {
        var n = (((kieCache || {}).stages || {})[k] || []).length;
        if (!n) return;
        var span = bar.querySelector('[data-stage-filter="' + k + '"] span');
        var m = STAGE_META[k] || { label: k };
        if (span) span.textContent = m.label + " " + n;
      });
    });

    function applyFilter(filter) {
      bar.querySelectorAll("[data-stage-filter]").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-stage-filter") === filter);
      });
      var meta = STAGE_META[filter];
      if (filter !== "all" && meta && meta.kie) {
        // Kie 类: 隐藏网格, 显示该类 Kie 列表
        grid.style.display = "none";
        wrap.style.display = "";
        curStage = filter;
        listEl.innerHTML = '<div class="cssmv-kie-empty">正在加载 Kie 目录…</div>';
        loadKie().then(function () { renderKieList(listEl, filter, searchEl.value); });
      } else {
        // 全部 / 本地(字幕·合成): 显示网格(按段过滤行), 隐藏 Kie 列表
        wrap.style.display = "none";
        grid.style.display = "";
        curStage = null;
        rows.forEach(function (r) {
          var k = String(r.getAttribute("data-mv-engine-stage") || "").toLowerCase();
          r.style.display = (filter === "all" || k === filter) ? "" : "none";
        });
      }
    }
    bar.querySelectorAll("[data-stage-filter]").forEach(function (b) {
      b.addEventListener("click", function () { applyFilter(b.getAttribute("data-stage-filter")); });
    });
    applyFilter("all");
  }

  // CSSOS_WAVE_777 — Jing「接 MV管线 + 人物MV; 参照高级设置, 小窗稍大」: 可复用【裸锚点】kie 选择器
  // (不依赖原生 select 网格 = 不需要 advanced 那套水化)。给 kie 四阶段建标签(实时家数)+ 搜索 + 列表
  // (默认10 + 点击/上滑加载更多 + 点选广播全平台)。供注入到任意面板。
  function buildBareTabs(anchor) {
    if (!(anchor instanceof HTMLElement)) return;
    if (anchor.querySelector(".cssmv-engine-tabs")) return; // 幂等
    injectStyleOnce();
    var stages = ORDER.filter(function (k) { return STAGE_META[k] && STAGE_META[k].kie; });
    if (!stages.length) return;
    var bar = document.createElement("div");
    bar.className = "cssmv-engine-tabs cssmv-pill-bar";
    bar.setAttribute("data-pill-bar", ""); bar.setAttribute("data-pill-text", "dark"); bar.setAttribute("role", "tablist");
    bar.innerHTML = stages.map(function (k, i) {
      var m = STAGE_META[k] || { icon: "•", label: k };
      return '<button type="button" class="' + (i === 0 ? "active" : "") + '" data-pill-key="' + k + '" data-stage-filter="' + k + '">' + m.icon + ' <span>' + m.label + "</span></button>";
    }).join("");
    anchor.appendChild(bar);
    var wrap = document.createElement("div");
    wrap.className = "cssmv-kie-wrap";
    wrap.innerHTML = '<input class="cssmv-kie-search" type="search" placeholder="按名称 / 厂商搜索 Kie 模型…" /><div class="cssmv-kie-list"></div>';
    anchor.appendChild(wrap);
    var searchEl = wrap.querySelector(".cssmv-kie-search");
    var listEl = wrap.querySelector(".cssmv-kie-list");
    var curStage = stages[0];
    function show(k) {
      curStage = k;
      bar.querySelectorAll("[data-stage-filter]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-stage-filter") === k); });
      loadKie().then(function () { renderKieList(listEl, k, searchEl.value); });
    }
    bar.querySelectorAll("[data-stage-filter]").forEach(function (b) {
      b.addEventListener("click", function () { show(b.getAttribute("data-stage-filter")); });
    });
    searchEl.addEventListener("input", function () { if (curStage) renderKieList(listEl, curStage, searchEl.value); });
    listEl.addEventListener("scroll", function () {
      if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 40) {
        var rows = listEl.__rows || []; if ((listEl.__shown || PAGE) < rows.length) { listEl.__shown = (listEl.__shown || PAGE) + PAGE; paintKiePage(listEl); }
      }
    }, { passive: true });
    loadKie().then(function () {
      stages.forEach(function (k) {
        var n = (((kieCache || {}).stages || {})[k] || []).length; if (!n) return;
        var span = bar.querySelector('[data-stage-filter="' + k + '"] span'); var m = STAGE_META[k] || { label: k };
        if (span) span.textContent = m.label + " " + n;
      });
      show(stages[0]);
    });
  }
  globalThis.cssosMountKiePicker = function (container) {
    if (!(container instanceof HTMLElement)) return null;
    var sec = document.createElement("section");
    sec.className = "mv-engines-panel cssos-kie-injected";
    sec.setAttribute("data-mv-engines-panel", ""); sec.setAttribute("data-cssos-kie-injected", "1");
    sec.style.cssText = "margin:14px 8px;padding:12px 14px;border-radius:14px;background:rgba(0,0,0,0.18);";
    var title = document.createElement("div");
    title.style.cssText = "font:700 12px/1.3 -apple-system,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;opacity:.78;margin-bottom:8px;";
    title.textContent = "第三方引擎 · 经 Kie";
    sec.appendChild(title);
    container.appendChild(sec);
    buildBareTabs(sec);
    return sec;
  };
  function injectInto(panelSel) {
    var panel = document.querySelector(panelSel);
    if (!panel || panel.querySelector("[data-cssos-kie-injected]")) return;
    globalThis.cssosMountKiePicker(panel);
  }

  // CSSOS_WAVE_779 — Jing「MV管线已按阶段分类, 一个阶段单接该阶段 kie 列表, 窗口大一点」。
  // MV管线行 = div.mvp-stage[data-stage] > .mvp-stage-head > .mvp-stage-engine(引擎值) + ⚙(动态拼,
  // 源码 grep 不到 → 运行时接管): 点引擎值/⚙ → 弹【该阶段 kie 下拉】(更大: 380×440, 引擎数 + 搜索 +
  // 默认10 + 加载更多 + 点选写 cssmvEngines.setSelection 广播 + 回填行显示)。只接 kie 四阶段。
  function injectStagePopStyleOnce() {
    if (document.getElementById("cssos-kie-stagepop-style")) return;
    var s = document.createElement("style"); s.id = "cssos-kie-stagepop-style";
    s.textContent = [
      "#cssos-kie-stagepop{position:fixed;z-index:2147483600;width:min(420px,92vw);max-height:460px;display:flex;flex-direction:column;",
      "  background:rgba(6,12,10,0.97);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);",
      "  border:1px solid rgba(0,245,160,0.28);border-radius:14px;padding:10px;box-shadow:0 18px 50px rgba(0,0,0,0.6);color:#eafff6;}",
      "#cssos-kie-stagepop .sp-hd{font:700 12px/1.3 -apple-system,system-ui,sans-serif;letter-spacing:.05em;opacity:.85;margin-bottom:8px;}",
      "#cssos-kie-stagepop .cssmv-kie-search{width:100%;box-sizing:border-box;margin-bottom:8px;padding:8px 12px;border-radius:999px;border:1px solid rgba(0,245,160,0.30);background:rgba(0,245,160,0.06);color:inherit;font:500 13px/1.2 ui-monospace,monospace;}",
      "#cssos-kie-stagepop .cssmv-kie-list{display:grid;grid-template-columns:1fr;gap:6px;overflow-y:auto;flex:1;}",
      "#cssos-kie-stagepop .cssmv-kie-card{all:unset;cursor:pointer;box-sizing:border-box;display:flex;flex-direction:column;gap:3px;padding:9px 12px;border-radius:10px;border:1px solid rgba(0,245,160,0.22);background:rgba(0,245,160,0.05);}",
      "#cssos-kie-stagepop .cssmv-kie-card:hover{background:rgba(0,245,160,0.12);}",
      "#cssos-kie-stagepop .cssmv-kie-card.is-sel{background:rgba(0,200,120,0.85);color:#fff;}",
      "#cssos-kie-stagepop .cssmv-kie-name{font:600 12px/1.25 -apple-system,system-ui,sans-serif;}",
      "#cssos-kie-stagepop .cssmv-kie-meta{display:flex;align-items:center;gap:6px;font:500 11px/1.2 sans-serif;opacity:.85;}",
      "#cssos-kie-stagepop .cssmv-kie-price{margin-left:auto;font-weight:700;}",
      "#cssos-kie-stagepop .cssmv-kie-fire{color:#ff8a3d;font-weight:700;}",
      "#cssos-kie-stagepop .cssmv-kie-more{all:unset;display:block;width:100%;box-sizing:border-box;cursor:pointer;text-align:center;padding:9px;margin-top:4px;border-radius:10px;border:1px dashed rgba(0,245,160,0.35);background:rgba(0,245,160,0.05);font-size:12px;}",
      "#cssos-kie-stagepop .cssmv-kie-empty{padding:18px;text-align:center;opacity:.7;font-size:13px;}",
    ].join("\n");
    document.head.appendChild(s);
  }
  function closeStagePop() { var p = document.getElementById("cssos-kie-stagepop"); if (p && p.parentNode) p.parentNode.removeChild(p); document.removeEventListener("pointerdown", onStagePopOutside, true); }
  function onStagePopOutside(e) { var p = document.getElementById("cssos-kie-stagepop"); if (p && !p.contains(e.target)) closeStagePop(); }
  function openKieStagePop(anchorEl, stageKey, engineCell) {
    closeStagePop(); injectStyleOnce(); injectStagePopStyleOnce();
    var m = STAGE_META[stageKey] || { icon: "•", label: stageKey };
    var pop = document.createElement("div"); pop.id = "cssos-kie-stagepop";
    pop.dataset.noFrameToggle = "1";
    pop.innerHTML = '<div class="sp-hd">' + m.icon + " " + m.label + '</div><input class="cssmv-kie-search" type="search" placeholder="按名称 / 厂商搜索…" /><div class="cssmv-kie-list"></div>';
    document.body.appendChild(pop);
    // 定位: 锚点下方, 右对齐, 不出屏。
    var r = anchorEl.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w));
    var top = Math.min(window.innerHeight - h - 8, r.bottom + 6);
    if (r.bottom + 6 + h > window.innerHeight) top = Math.max(8, r.top - h - 6);
    pop.style.left = left + "px"; pop.style.top = top + "px";
    var searchEl = pop.querySelector(".cssmv-kie-search");
    var listEl = pop.querySelector(".cssmv-kie-list");
    searchEl.addEventListener("input", function () { renderKieList(listEl, stageKey, searchEl.value); });
    listEl.addEventListener("scroll", function () {
      if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 40) {
        var rows = listEl.__rows || []; if ((listEl.__shown || PAGE) < rows.length) { listEl.__shown = (listEl.__shown || PAGE) + PAGE; paintKiePage(listEl); }
      }
    }, { passive: true });
    // 点选某模型 → 回填行显示 + 关闭(setSelection 由 renderKieList 内部已广播)。
    listEl.addEventListener("click", function (e) {
      var card = e.target && e.target.closest ? e.target.closest(".cssmv-kie-card") : null;
      if (!card) return;
      var id = card.getAttribute("data-kie-id");
      if (id && engineCell) engineCell.textContent = id;
      setTimeout(closeStagePop, 60);
    });
    loadKie().then(function () {
      var n = (((kieCache || {}).stages || {})[stageKey] || []).length;
      var hd = pop.querySelector(".sp-hd"); if (hd && n) hd.textContent = m.icon + " " + m.label + " " + n;
      renderKieList(listEl, stageKey, "");
      searchEl.focus();
    });
    setTimeout(function () { document.addEventListener("pointerdown", onStagePopOutside, true); }, 0);
  }
  function wireMvpStages() {
    var panel = document.getElementById("mv-pipeline-panel");
    if (!panel) return;
    panel.querySelectorAll(".mvp-stage[data-stage]").forEach(function (row) {
      if (row.dataset.cssosKieWired) return;
      var stageKey = String(row.getAttribute("data-stage") || "").toLowerCase();
      if (!STAGE_META[stageKey] || !STAGE_META[stageKey].kie) return; // subtitles/compose 本地, 不接 kie
      row.dataset.cssosKieWired = "1";
      var head = row.querySelector(".mvp-stage-head") || row;
      head.addEventListener("click", function (e) {
        var t = e.target;
        var cell = t && t.closest ? t.closest(".mvp-stage-engine") : null;
        // W779b — 只接管【引擎值文本】点击 → 弹 kie 选择器。⚙ 不拦截, 仍开原 popover(保留"默认
        // 输出多少封面图"等原设置, 找回来)。折叠箭头(—)等也不拦截。
        if (!cell) return;
        e.preventDefault(); e.stopImmediatePropagation();
        openKieStagePop(cell, stageKey, cell);
      }, true);
    });
  }

  function scan() {
    // 原生网格锚点(高级设置)→ buildTabs(在网格上加 kie 标签)。排除注入的裸锚点。
    document.querySelectorAll("[data-mv-engines-panel]:not([data-cssos-kie-injected])").forEach(buildTabs);
    // CSSOS_WAVE_778 — 人物MV: 整块注入(它本无引擎区, 参照高级设置)。
    injectInto("#person-mv-panel");
    // CSSOS_WAVE_779 — MV管线: 已按阶段分类 → 每个阶段行【点引擎值/⚙ → 该阶段 kie 下拉】(不整块注入)。
    wireMvpStages();
    document.querySelectorAll("[data-cssos-kie-injected]").forEach(function (a) {
      if (!a.querySelector(".cssmv-engine-tabs")) buildBareTabs(a);
    });
  }
  try { new MutationObserver(function () { scan(); }).observe(document.body, { childList: true, subtree: true }); } catch (_e) {}
  if (document.readyState === "complete" || document.readyState === "interactive") scan();
  else document.addEventListener("DOMContentLoaded", scan);
})();
