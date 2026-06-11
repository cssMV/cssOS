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

  function renderKieList(listEl, stageKey, query) {
    var cat = (kieCache && kieCache.stages && kieCache.stages[stageKey]) || [];
    var q = String(query || "").trim().toLowerCase();
    var rows = cat.filter(function (e) {
      return !q || (e.label + " " + e.provider).toLowerCase().indexOf(q) !== -1;
    });
    var api = globalThis.cssmvEngines;
    var sel = api && typeof api.getSelection === "function" ? api.getSelection(stageKey) : null;
    if (!rows.length) {
      listEl.innerHTML = '<div class="cssmv-kie-empty">' +
        (cat.length ? "无匹配模型" : "正在加载 Kie 目录…") + "</div>";
      return;
    }
    var html = rows.map(function (e) {
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
    listEl.innerHTML = html;
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

  function scan() { document.querySelectorAll("[data-mv-engines-panel]").forEach(buildTabs); }
  try { new MutationObserver(function () { scan(); }).observe(document.body, { childList: true, subtree: true }); } catch (_e) {}
  if (document.readyState === "complete" || document.readyState === "interactive") scan();
  else document.addEventListener("DOMContentLoaded", scan);
})();
