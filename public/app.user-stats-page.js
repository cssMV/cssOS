/* CSSOS_PERSON_MV_WAVE71 20260508 — Jing
 * Personal stats deep page mounted on URL hash `#u/{handle}/stats`.
 * Pure CSS / inline SVG — no chart libraries.
 * Dual-theme aware: dark = pale teal forest; light = forest-green palette.
 */
(function () {
  "use strict";

  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  var STYLE_ID = "cssos-user-stats-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    // Dark theme uses pale teal (#00f5a0); light theme overrides to forest green (#0a6b3a).
    s.textContent = [
      "#cssos-user-stats{position:fixed;inset:0;z-index:9320;background:rgba(4,10,8,0.97);overflow-y:auto;color:#daffee;font:14px/1.45 -apple-system,system-ui,sans-serif;}",
      "#cssos-user-stats .usp-inner{max-width:1040px;margin:0 auto;padding:32px 20px 80px;}",
      "#cssos-user-stats .usp-close{position:fixed;top:16px;right:18px;background:rgba(0,245,160,0.12);color:#00f5a0;border:1px solid rgba(0,245,160,0.4);border-radius:999px;padding:6px 14px;cursor:pointer;font-weight:600;}",
      "#cssos-user-stats .usp-back{background:transparent;color:rgba(0,245,160,0.85);border:1px solid rgba(0,245,160,0.32);border-radius:999px;padding:4px 12px;cursor:pointer;font-size:12px;margin-bottom:14px;}",
      "#cssos-user-stats h1.usp-title{font-size:22px;margin:0 0 4px;color:#fff;}",
      "#cssos-user-stats .usp-handle{font-size:13px;color:rgba(0,245,160,0.7);margin-bottom:20px;}",
      "#cssos-user-stats .usp-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px;}",
      "#cssos-user-stats .usp-kpi{padding:14px;background:rgba(0,245,160,0.06);border:1px solid rgba(0,245,160,0.18);border-radius:12px;}",
      "#cssos-user-stats .usp-kpi-num{font-size:22px;font-weight:700;color:#fff;}",
      "#cssos-user-stats .usp-kpi-label{font-size:11px;color:rgba(218,255,238,0.65);text-transform:uppercase;letter-spacing:0.04em;margin-top:4px;}",
      "#cssos-user-stats h2.usp-section{font-size:15px;font-weight:700;margin:24px 0 10px;color:rgba(218,255,238,0.92);}",
      "#cssos-user-stats .usp-bar-row{display:flex;align-items:center;gap:10px;margin:6px 0;font-size:13px;}",
      "#cssos-user-stats .usp-bar-label{flex:0 0 120px;color:rgba(218,255,238,0.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      "#cssos-user-stats .usp-bar-track{flex:1;height:14px;background:rgba(0,245,160,0.08);border-radius:7px;overflow:hidden;}",
      "#cssos-user-stats .usp-bar-fill{height:100%;background:linear-gradient(90deg,#00f5a0,#3affb8);border-radius:7px;}",
      "#cssos-user-stats .usp-bar-count{flex:0 0 60px;text-align:right;color:rgba(0,245,160,0.85);font-variant-numeric:tabular-nums;}",
      "#cssos-user-stats .usp-heatmap{display:grid;grid-template-columns:30px repeat(24,1fr);gap:2px;margin:6px 0;font-size:10px;}",
      "#cssos-user-stats .usp-heat-cell{aspect-ratio:1/1;border-radius:2px;background:rgba(0,245,160,0.08);}",
      "#cssos-user-stats .usp-heat-row-label{display:flex;align-items:center;color:rgba(218,255,238,0.55);font-size:10px;}",
      "#cssos-user-stats .usp-heat-col-label{color:rgba(218,255,238,0.4);font-size:9px;text-align:center;}",
      "#cssos-user-stats .usp-streak-card{display:flex;gap:18px;align-items:center;padding:16px;background:rgba(0,245,160,0.06);border:1px solid rgba(0,245,160,0.18);border-radius:12px;}",
      "#cssos-user-stats .usp-streak-flame{font-size:46px;}",
      "#cssos-user-stats .usp-streak-num{font-size:28px;font-weight:700;color:#fff;}",
      "#cssos-user-stats .usp-streak-label{font-size:12px;color:rgba(218,255,238,0.65);}",
      "#cssos-user-stats .usp-growth-svg{width:100%;height:140px;display:block;}",
      "#cssos-user-stats .usp-loading,#cssos-user-stats .usp-error{padding:60px 20px;text-align:center;color:rgba(218,255,238,0.6);}",
      "#cssos-user-stats .usp-empty{font-size:12px;color:rgba(218,255,238,0.5);padding:6px 0;}",
      // Light theme — forest-green palette.
      "html[data-theme=\"light\"] #cssos-user-stats{background:rgba(244,250,244,0.98);color:#0c1d16;}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-close{background:rgba(10,107,58,0.1);color:#0a6b3a;border-color:rgba(10,107,58,0.4);}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-back{color:#0a6b3a;border-color:rgba(10,107,58,0.32);}",
      "html[data-theme=\"light\"] #cssos-user-stats h1.usp-title{color:#0c1d16;}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-handle{color:#0a6b3a;}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-kpi{background:rgba(10,107,58,0.06);border-color:rgba(10,107,58,0.2);}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-kpi-num{color:#0c1d16;}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-kpi-label{color:rgba(12,29,22,0.6);}",
      "html[data-theme=\"light\"] #cssos-user-stats h2.usp-section{color:#0c1d16;}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-bar-label{color:#0c1d16;}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-bar-track{background:rgba(10,107,58,0.1);}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-bar-fill{background:linear-gradient(90deg,#0a6b3a,#1f9d5b);}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-bar-count{color:#0a6b3a;}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-heat-cell{background:rgba(10,107,58,0.08);}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-heat-row-label,html[data-theme=\"light\"] #cssos-user-stats .usp-heat-col-label{color:rgba(12,29,22,0.5);}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-streak-card{background:rgba(10,107,58,0.06);border-color:rgba(10,107,58,0.2);}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-streak-num{color:#0c1d16;}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-streak-label{color:rgba(12,29,22,0.6);}",
      "html[data-theme=\"light\"] #cssos-user-stats .usp-loading,html[data-theme=\"light\"] #cssos-user-stats .usp-error,html[data-theme=\"light\"] #cssos-user-stats .usp-empty{color:rgba(12,29,22,0.55);}",
    ].join("");
    document.head.appendChild(s);
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "style" && typeof attrs[k] === "object") Object.assign(n.style, attrs[k]);
      else if (k === "onclick") n.addEventListener("click", attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function svgEl(tag, attrs, children) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function isLight() {
    try { return document.documentElement.getAttribute("data-theme") === "light"; } catch (_e) { return false; }
  }
  function accentColor() { return isLight() ? "#0a6b3a" : "#00f5a0"; }
  function accentRgb()   { return isLight() ? "10,107,58"  : "0,245,160"; }

  async function fetchStats(handle) {
    var r = await fetch("/api/users/" + encodeURIComponent(handle) + "/stats", { credentials: "include" });
    var j = null;
    try { j = await r.json(); } catch (_e) {}
    if (!r.ok || !j || !j.ok) {
      var code = (j && j.code) || ("HTTP " + r.status);
      var err = new Error(code); err.code = code; err.status = r.status; throw err;
    }
    return j;
  }

  function close() {
    var node = document.getElementById("cssos-user-stats");
    if (node) node.remove();
    if (/^#u\/[^/?&]+\/stats/.test(location.hash || "")) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function renderError(handle, code) {
    var root = document.getElementById("cssos-user-stats");
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(el("button", { class: "usp-close", onclick: close }, [tr("Close", "关闭")]));
    var msg = tr("Could not load stats.", "无法加载数据。");
    if (code === "STATS_HIDDEN") msg = tr("This user has hidden their stats.", "该用户已隐藏数据。");
    else if (code === "NOT_FOUND") msg = tr("User not found.", "用户不存在。");
    root.appendChild(el("div", { class: "usp-inner" }, [
      el("button", { class: "usp-back", onclick: function () { location.hash = "#u/" + handle; } },
        ["← " + tr("Back to profile", "返回主页")]),
      el("div", { class: "usp-error" }, [msg]),
    ]));
  }

  function kpi(num, label) {
    return el("div", { class: "usp-kpi" }, [
      el("div", { class: "usp-kpi-num" }, [String(num != null ? num : 0)]),
      el("div", { class: "usp-kpi-label" }, [label]),
    ]);
  }

  function barChart(rows, labelFn, countFn, max) {
    if (!rows || !rows.length) return el("div", { class: "usp-empty" }, [tr("No data yet.", "暂无数据。")]);
    var m = max || rows.reduce(function (a, r) { return Math.max(a, countFn(r)); }, 1) || 1;
    var host = el("div", {}, []);
    rows.forEach(function (r) {
      var n = countFn(r);
      var pct = Math.max(2, Math.round((n / m) * 100));
      host.appendChild(el("div", { class: "usp-bar-row" }, [
        el("div", { class: "usp-bar-label", title: labelFn(r) }, [labelFn(r)]),
        el("div", { class: "usp-bar-track" }, [
          el("div", { class: "usp-bar-fill", style: "width:" + pct + "%;" }, []),
        ]),
        el("div", { class: "usp-bar-count" }, [String(n)]),
      ]));
    });
    return host;
  }

  function heatmap(grid) {
    // Heatmap saturation = activity. Both themes use accent color with alpha.
    // Min alpha 0.06 (empty), max alpha 0.92 (peak). Single hue keeps it
    // legible in both light and dark modes.
    var max = 0;
    for (var d = 0; d < 7; d++) for (var h = 0; h < 24; h++) {
      if (grid[d][h] > max) max = grid[d][h];
    }
    var rgb = accentRgb();
    var dayLabels = [tr("Sun", "日"), tr("Mon", "一"), tr("Tue", "二"), tr("Wed", "三"), tr("Thu", "四"), tr("Fri", "五"), tr("Sat", "六")];
    var host = el("div", { class: "usp-heatmap" }, []);
    // Top row: hour labels (every 3 hours).
    host.appendChild(el("div", {}, [""]));
    for (var hh = 0; hh < 24; hh++) {
      host.appendChild(el("div", { class: "usp-heat-col-label" }, [hh % 3 === 0 ? String(hh) : ""]));
    }
    for (var dd = 0; dd < 7; dd++) {
      host.appendChild(el("div", { class: "usp-heat-row-label" }, [dayLabels[dd]]));
      for (var hr = 0; hr < 24; hr++) {
        var v = grid[dd][hr] || 0;
        var alpha = max > 0 ? 0.06 + (v / max) * 0.86 : 0.06;
        var cell = el("div", {
          class: "usp-heat-cell",
          title: dayLabels[dd] + " " + hr + ":00 — " + v + " " + tr("creations", "次创作"),
          style: "background:rgba(" + rgb + "," + alpha.toFixed(3) + ");",
        }, []);
        host.appendChild(cell);
      }
    }
    return host;
  }

  function streakCard(streak) {
    var s = streak || { current: 0, longest: 0, last_creation_date: null };
    return el("div", { class: "usp-streak-card" }, [
      el("div", { class: "usp-streak-flame" }, ["🔥"]),
      el("div", {}, [
        el("div", { class: "usp-streak-num" }, [String(s.current || 0) + " " + tr("days", "天")]),
        el("div", { class: "usp-streak-label" }, [
          tr("Current streak", "当前连续") + " · " +
          tr("Longest", "最长") + ": " + (s.longest || 0) + " " +
          (s.last_creation_date ? "· " + tr("Last", "上次") + " " + s.last_creation_date : ""),
        ]),
      ]),
    ]);
  }

  function growthChart(growth) {
    if (!growth || !growth.length) return el("div", { class: "usp-empty" }, [tr("No data yet.", "暂无数据。")]);
    var W = 720, H = 140, pad = 24;
    var maxV = growth.reduce(function (a, r) { return Math.max(a, r.views_added || 0); }, 1) || 1;
    var maxM = growth.reduce(function (a, r) { return Math.max(a, r.mvs_added || 0); }, 1) || 1;
    var n = growth.length;
    function px(i) { return pad + ((W - pad * 2) * i) / Math.max(1, n - 1); }
    function py(v, m) { return H - pad - ((H - pad * 2) * v) / m; }
    var ptsViews = growth.map(function (r, i) { return px(i) + "," + py(r.views_added || 0, maxV); }).join(" ");
    var color = accentColor();
    var svg = svgEl("svg", { class: "usp-growth-svg", viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" }, [
      svgEl("polyline", { fill: "none", stroke: color, "stroke-width": "2", points: ptsViews }, []),
    ]);
    // MV-added dots.
    growth.forEach(function (r, i) {
      if ((r.mvs_added || 0) > 0) {
        svg.appendChild(svgEl("circle", {
          cx: String(px(i)), cy: String(py(r.mvs_added || 0, maxM)),
          r: "3", fill: color, opacity: "0.85",
        }, []));
      }
    });
    return svg;
  }

  async function render(handle) {
    injectStyle();
    var existing = document.getElementById("cssos-user-stats");
    if (existing) existing.remove();
    var root = el("div", { id: "cssos-user-stats" }, [
      el("button", { class: "usp-close", onclick: close }, [tr("Close", "关闭")]),
      el("div", { class: "usp-inner" }, [
        el("div", { class: "usp-loading" }, [tr("Loading…", "加载中…")]),
      ]),
    ]);
    document.body.appendChild(root);

    var data;
    try { data = await fetchStats(handle); }
    catch (e) { renderError(handle, (e && e.code) || "FAILED"); return; }

    var u = data.user || {};
    var t = data.totals || {};
    var inner = el("div", { class: "usp-inner" }, []);
    inner.appendChild(el("button", {
      class: "usp-back",
      onclick: function () { location.hash = "#u/" + (u.username || handle); },
    }, ["← " + tr("Back to profile", "返回主页")]));
    inner.appendChild(el("h1", { class: "usp-title" }, [
      "📊 " + (u.display_name || u.username || tr("Anonymous", "匿名")) + " — " + tr("Stats", "数据"),
    ]));
    if (u.username) inner.appendChild(el("div", { class: "usp-handle" }, ["@" + u.username]));

    // KPI grid.
    inner.appendChild(el("div", { class: "usp-kpi-grid" }, [
      kpi(t.mvs_created, tr("MVs created", "创作 MV")),
      kpi(t.total_views, tr("Total views", "总观看")),
      kpi(t.total_likes, tr("Total likes", "总点赞")),
      kpi(t.total_comments_received, tr("Comments received", "收到评论")),
      kpi(t.persons_explored, tr("Persons explored", "探索人物")),
      kpi(t.credits_earned, tr("Credits earned", "累计积分")),
    ]));

    // Favorite styles.
    inner.appendChild(el("h2", { class: "usp-section" }, [tr("Favorite styles", "偏爱风格")]));
    inner.appendChild(barChart(
      data.favorite_styles || [],
      function (r) { return r.style + " (" + (r.percentage || 0) + "%)"; },
      function (r) { return r.count || 0; },
    ));

    // Favorite persons.
    inner.appendChild(el("h2", { class: "usp-section" }, [tr("Favorite persons", "偏爱人物")]));
    inner.appendChild(barChart(
      data.favorite_persons || [],
      function (r) { return r.name_zh || r.name_en || r.person_id; },
      function (r) { return r.mv_count || 0; },
    ));

    // Favorite civilizations.
    inner.appendChild(el("h2", { class: "usp-section" }, [tr("Favorite civilizations", "偏爱文明")]));
    inner.appendChild(barChart(
      data.favorite_civilizations || [],
      function (r) { return r.civ; },
      function (r) { return r.count || 0; },
    ));

    // Heatmap.
    inner.appendChild(el("h2", { class: "usp-section" }, [tr("Active hours (7×24)", "活跃时段（7×24）")]));
    inner.appendChild(heatmap(data.active_hours_heatmap || Array.from({ length: 7 }, function () { return Array(24).fill(0); })));

    // Streak.
    inner.appendChild(el("h2", { class: "usp-section" }, [tr("Creation streak", "连续创作")]));
    inner.appendChild(streakCard(data.streak));

    // Growth chart.
    inner.appendChild(el("h2", { class: "usp-section" }, [tr("Last 30 days", "最近 30 天")]));
    inner.appendChild(growthChart(data.growth || []));

    root.querySelector(".usp-inner").replaceWith(inner);
  }

  function maybeMount() {
    var m = /^#u\/([^/?&]+)\/stats(?:[/?&].*)?$/.exec(location.hash || "");
    if (m && m[1]) {
      render(decodeURIComponent(m[1]));
    } else {
      var node = document.getElementById("cssos-user-stats");
      if (node) node.remove();
    }
  }

  window.addEventListener("hashchange", maybeMount);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybeMount);
  } else {
    maybeMount();
  }

  globalThis.openUserStatsPage = function (handle) { location.hash = "#u/" + handle + "/stats"; };
})();
