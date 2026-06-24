/* CSSOS_PERSON_MV_WAVE19 20260508 — Jing
 * Leaderboards panel — three columns (creators / persons / groups), each
 * with [本周|本月|总榜] tabs. Lazy-fetches /api/person-mv/leaderboards/:scope
 * the first time the panel becomes visible (or a tab is switched). The
 * 10-min server-side cache means tab spam is cheap.
 *
 * Activation: hashchange to #leaderboard, or globalThis.openPersonMvLeaderboard().
 * The 🏆 button on the homepage discover area dispatches the same hash.
 *
 * Per the project memory: feature-specific UI lives near the feature, so
 * tabs and the empty-state CTA are inline on this panel — not in a global
 * settings drawer. */
(function () {
  "use strict";

  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }
  function fmtCount(n) {
    n = Number(n) || 0;
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
    return String(n);
  }
  function rankEmoji(i) {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return "🏅";
  }

  var STYLE_ID = "cssos-person-mv-leaderboard-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      /* CSSOS_WAVE_501 20260530 — Jing「排行榜做成小窗口, 不要全屏」。容器改成居中半透明
       * 遮罩, 内层 .cssos-lb-wrap 变成有最大宽高、圆角、可滚动的窗口卡片。 */
      "#person-mv-leaderboard-panel{position:fixed;inset:0;z-index:9300;background:rgba(2,8,6,0.62);display:none;color:#daffee;}",
      "#person-mv-leaderboard-panel.open{display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;}",
      ".cssos-lb-wrap{width:min(1100px,94vw);max-height:min(82vh,760px);overflow:auto;margin:0;padding:20px 18px;box-sizing:border-box;background:var(--panel-strong);color:var(--text);border:1px solid rgba(0,245,160,0.25);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,0.5);}",
      ".cssos-lb-head{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 16px;}",
      ".cssos-lb-head h1{margin:0;font:700 22px/1.2 -apple-system,system-ui,sans-serif;}",
      ".cssos-lb-close{background:transparent;border:1px solid rgba(0,245,160,0.4);color:var(--text);padding:6px 12px;border-radius:8px;cursor:pointer;font:500 13px/1 -apple-system,system-ui,sans-serif;}",
      ".cssos-lb-close:hover{border-color:rgba(0,245,160,0.85);}",
      /* CSSOS_WAVE_502 20260530 — Jing「小窗口更紧凑: 三板块只用一根线隔开, 不要三个独立卡片」 */
      ".cssos-lb-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;}",
      "@media(max-width:840px){.cssos-lb-cols{grid-template-columns:1fr;}.cssos-lb-col + .cssos-lb-col{border-left:0;border-top:1px solid rgba(0,245,160,0.16);}}",
      ".cssos-lb-col{padding:2px 16px;}",
      ".cssos-lb-col + .cssos-lb-col{border-left:1px solid rgba(0,245,160,0.16);}",
      ".cssos-lb-col h2{margin:0 0 10px;font:700 15px/1.2 -apple-system,system-ui,sans-serif;color:var(--text);}",
      ".cssos-lb-tabs{display:flex;gap:6px;margin:0 0 12px;}",
      ".cssos-lb-tab{flex:1;background:rgba(0,40,28,0.5);border:1px solid rgba(0,245,160,0.18);color:rgba(218,255,238,0.78);padding:6px 0;border-radius:8px;cursor:pointer;font:500 12px/1 -apple-system,system-ui,sans-serif;}",
      ".cssos-lb-tab.active{background:rgba(0,245,160,0.22);border-color:rgba(0,245,160,0.7);color:#fff;}",
      ".cssos-lb-list{display:flex;flex-direction:column;gap:6px;}",
      ".cssos-lb-row{display:flex;align-items:center;gap:10px;padding:8px 8px;border-radius:8px;cursor:pointer;transition:background .12s ease;}",
      ".cssos-lb-row:hover{background:rgba(0,245,160,0.08);}",
      ".cssos-lb-rank{flex:0 0 28px;text-align:center;font:600 14px/1 ui-monospace,monospace;color:var(--muted);}",
      ".cssos-lb-rank .em{font-size:16px;}",
      ".cssos-lb-img{flex:0 0 36px;width:36px;height:36px;border-radius:50%;background:rgba(0,40,28,0.6) center/cover no-repeat;border:1px solid rgba(0,245,160,0.3);}",
      ".cssos-lb-meta{flex:1 1 auto;min-width:0;}",
      ".cssos-lb-name{font:600 13px/1.25 -apple-system,system-ui,sans-serif;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".cssos-lb-sub{font:500 11px/1.2 ui-monospace,monospace;color:rgba(0,245,160,0.78);margin-top:2px;}",
      ".cssos-lb-empty{padding:18px 6px;color:var(--muted);text-align:center;font:500 13px/1.4 -apple-system,system-ui,sans-serif;}",
      ".cssos-lb-empty .cta{display:block;margin-top:10px;color:rgba(0,245,160,0.95);font-weight:600;}",
      ".cssos-lb-loading{padding:18px 6px;color:var(--muted);text-align:center;font:500 12px/1 ui-monospace,monospace;}",
    ].join("");
    document.head.appendChild(s);
  }

  // --- panel skeleton ---------------------------------------------------
  function ensurePanel() {
    var existing = document.getElementById("person-mv-leaderboard-panel");
    if (existing) return existing;
    injectStyle();
    var p = document.createElement("section");
    p.id = "person-mv-leaderboard-panel";
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-modal", "true");
    p.innerHTML =
      '<div class="cssos-lb-wrap">' +
        '<header class="cssos-lb-head">' +
          '<h1 data-i18n="leaderboard.title">🏆 排行榜</h1>' +
          '<button type="button" class="cssos-lb-close" data-act="close">✕</button>' +
        '</header>' +
        '<div class="cssos-lb-cols">' +
          colHtml("creators",  "🎬 顶尖创作者",      "Top creators") +
          colHtml("persons",   "🏛 热门人物",        "Top persons") +
          colHtml("groups",    "📜 风云流派",        "Top groups") +
        '</div>' +
      '</div>';
    document.body.appendChild(p);
    bindPanel(p);
    return p;
  }
  function colHtml(scope, zhTitle, enTitle) {
    return (
      '<div class="cssos-lb-col" data-scope="' + scope + '">' +
        '<h2 data-i18n="leaderboard.col.' + scope + '">' + escapeHtml(tr(enTitle, zhTitle)) + '</h2>' +
        '<div class="cssos-lb-tabs" role="tablist" data-segmented="3" data-pill-bar>' +
          '<button class="cssos-lb-tab active" data-period="week"  type="button">' + escapeHtml(tr("Week","本周")) + '</button>' +
          '<button class="cssos-lb-tab"        data-period="month" type="button">' + escapeHtml(tr("Month","本月")) + '</button>' +
          '<button class="cssos-lb-tab"        data-period="all"   type="button">' + escapeHtml(tr("All time","总榜")) + '</button>' +
        '</div>' +
        '<div class="cssos-lb-list" data-list>' +
          '<div class="cssos-lb-loading">' + escapeHtml(tr("Loading…","加载中…")) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // --- nav + open hooks -------------------------------------------------
  function navTo(scope, item) {
    if (scope === "creators") {
      var uname = item.username;
      if (uname) { try { location.hash = "#u/" + encodeURIComponent(uname); return; } catch (_e) {} }
      // fallback: do nothing if no public username
      return;
    }
    if (scope === "persons" && item.person_id) {
      close();
      if (typeof globalThis.openPersonMvPanel === "function") {
        try { globalThis.openPersonMvPanel(); } catch (_e) {}
      }
      if (typeof globalThis.openPersonMvCodex === "function") {
        try { globalThis.openPersonMvCodex(item.person_id); return; } catch (_e) {}
      }
      try { document.dispatchEvent(new CustomEvent("cssos:open-person-codex", { detail: { person_id: item.person_id } })); } catch (_e) {}
      return;
    }
    if (scope === "groups" && item.group_id) {
      close();
      if (typeof globalThis.openPersonMvGroup === "function") {
        try { globalThis.openPersonMvGroup(item.group_id); return; } catch (_e) {}
      }
      try { document.dispatchEvent(new CustomEvent("cssos:open-person-group", { detail: { group_id: item.group_id } })); } catch (_e) {}
    }
  }

  // --- rendering --------------------------------------------------------
  function renderRows(scope, rows) {
    if (!rows || !rows.length) {
      var _ems = globalThis.cssosEmptyStateMarkup;
      if (_ems) {
        return _ems({
          icon: "🏆",
          title: tr("No entries yet for this period.", "本周还无作品"),
          sub: tr("Be the first to claim the top spot.", "你来抢下榜首第一位。")
        });
      }
      return (
        '<div class="cssos-lb-empty">' +
          escapeHtml(tr("No entries yet for this period.", "本周还无作品")) +
          '<span class="cta">' + escapeHtml(tr("Be the first.", "· 你来抢首位")) + '</span>' +
        '</div>'
      );
    }
    return rows.map(function (r, i) {
      var name, sub, img, key, val;
      if (scope === "creators") {
        name = r.display_name || r.username || (r.user_id ? r.user_id.slice(0, 8) : tr("Unknown","未知"));
        img = r.avatar_url ? ' style="background-image:url(\'' + String(r.avatar_url).replace(/'/g, "%27") + '\')"' : "";
        sub = "👁 " + fmtCount(r.total_views) + " · 🎬 " + fmtCount(r.mv_count);
        key = r.username ? "u:" + r.username : "uid:" + (r.user_id || "");
      } else if (scope === "persons") {
        name = r.name_zh || r.name_en || r.person_id;
        img = r.portrait_url ? ' style="background-image:url(\'' + String(r.portrait_url).replace(/'/g, "%27") + '\')"' : "";
        var _civL = r.civilization ? ((globalThis.civDisplayName ? globalThis.civDisplayName(r.civilization) : r.civilization) + " · ") : "";
        sub = _civL + "👁 " + fmtCount(r.total_views) + " · 🎬 " + fmtCount(r.mv_count);
        key = "p:" + r.person_id;
      } else {
        name = r.name_zh || r.name_en || r.group_id;
        img = "";
        sub = "👁 " + fmtCount(r.total_views) + " · 🎬 " + fmtCount(r.mv_count);
        key = "g:" + r.group_id;
      }
      val = JSON.stringify(r).replace(/"/g, "&quot;");
      var em = rankEmoji(i);
      var rankCell = i < 3
        ? '<span class="em">' + em + '</span>'
        : (em + " " + (i + 1));
      return (
        '<div class="cssos-lb-row" data-key="' + escapeHtml(key) + '" data-row="' + val + '" tabindex="0" role="button">' +
          '<div class="cssos-lb-rank">' + rankCell + '</div>' +
          '<div class="cssos-lb-img"' + img + '></div>' +
          '<div class="cssos-lb-meta">' +
            '<div class="cssos-lb-name">' + escapeHtml(name) + '</div>' +
            '<div class="cssos-lb-sub">' + escapeHtml(sub) + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  // --- fetcher (per-scope, per-period cache) ----------------------------
  var __clientCache = Object.create(null);
  async function fetchScope(scope, period) {
    var key = scope + ":" + period;
    if (__clientCache[key]) return __clientCache[key];
    var url = "/api/person-mv/leaderboards/" + encodeURIComponent(scope) + "?period=" + encodeURIComponent(period);
    var r = await fetch(url, { credentials: "same-origin" });
    if (!r.ok) throw new Error("http " + r.status);
    var json = await r.json();
    if (!json || !json.ok) throw new Error("not ok");
    var rows = (json.data && json.data.rows) || [];
    __clientCache[key] = rows;
    return rows;
  }

  async function refreshCol(panel, scope, period) {
    var col = panel.querySelector('.cssos-lb-col[data-scope="' + scope + '"]');
    if (!col) return;
    var list = col.querySelector("[data-list]");
    if (!list) return;
    list.innerHTML = (globalThis.cssosSkeletonRowsMarkup
      ? globalThis.cssosSkeletonRowsMarkup(5, tr("Loading…","加载中…"))
      : '<div class="cssos-lb-loading">' + escapeHtml(tr("Loading…","加载中…")) + '</div>');
    try {
      var rows = await fetchScope(scope, period);
      list.innerHTML = renderRows(scope, rows);
    } catch (_e) {
      list.innerHTML = '<div class="cssos-lb-empty">' + escapeHtml(tr("Failed to load.","加载失败")) + '</div>';
    }
  }

  function bindPanel(panel) {
    panel.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t) return;
      /* CSSOS_WAVE_501 — 小窗口: 点击遮罩空白处(窗口卡片之外)关闭。 */
      if (t === panel || (t.closest && !t.closest(".cssos-lb-wrap"))) {
        ev.preventDefault();
        close();
        return;
      }
      if (t.closest && t.closest('[data-act="close"]')) {
        ev.preventDefault();
        close();
        return;
      }
      var tab = t.closest && t.closest(".cssos-lb-tab");
      if (tab) {
        var col = tab.closest(".cssos-lb-col");
        if (!col) return;
        col.querySelectorAll(".cssos-lb-tab").forEach(function (b) { b.classList.remove("active"); });
        tab.classList.add("active");
        refreshCol(panel, col.getAttribute("data-scope"), tab.getAttribute("data-period"));
        return;
      }
      var row = t.closest && t.closest(".cssos-lb-row");
      if (row) {
        var col2 = row.closest(".cssos-lb-col");
        if (!col2) return;
        try {
          var data = JSON.parse(row.getAttribute("data-row").replace(/&quot;/g, '"'));
          navTo(col2.getAttribute("data-scope"), data);
        } catch (_e) {}
      }
    });
    panel.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.preventDefault(); close(); }
    });
  }

  // --- open / close ------------------------------------------------------
  var __opened = false;
  function open() {
    var p = ensurePanel();
    p.classList.add("open");
    if (!__opened) {
      __opened = true;
      ["creators", "persons", "groups"].forEach(function (s) { refreshCol(p, s, "week"); });
    }
  }
  function close() {
    var p = document.getElementById("person-mv-leaderboard-panel");
    if (p) p.classList.remove("open");
    if (location.hash === "#leaderboard") {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (_e) {}
    }
  }

  function onHash() {
    if (location.hash === "#leaderboard") open();
  }

  // homepage 🏆 button — injected near discover-shelf if not already present.
  function ensureHomepageButton() {
    if (document.getElementById("person-mv-leaderboard-cta")) return;
    var anchor = document.getElementById("person-mv-discover-shelf");
    if (!anchor || !anchor.parentNode) return;
    var btn = document.createElement("button");
    btn.id = "person-mv-leaderboard-cta";
    btn.type = "button";
    btn.textContent = tr("🏆 Leaderboards", "🏆 排行榜");
    btn.style.cssText =
      "display:inline-flex;align-items:center;gap:6px;margin:6px 12px 0;padding:8px 14px;" +
      "background:rgba(0,245,160,0.14);border:1px solid rgba(0,245,160,0.4);color:#daffee;" +
      "border-radius:999px;cursor:pointer;font:600 13px/1 -apple-system,system-ui,sans-serif;";
    btn.addEventListener("click", function (ev) { ev.preventDefault(); location.hash = "#leaderboard"; });
    anchor.parentNode.insertBefore(btn, anchor);
  }

  function init() {
    injectStyle();
    ensureHomepageButton();
    window.addEventListener("hashchange", onHash);
    onHash();
  }

  globalThis.openPersonMvLeaderboard = open;
  globalThis.closePersonMvLeaderboard = close;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
