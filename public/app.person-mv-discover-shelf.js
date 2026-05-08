/* CSSOS_PERSON_MV_WAVE9 20260507 — Jing
 * Homepage discovery shelf. Lazily fetches /api/person-mv/discover/hot
 * the first time the shelf scrolls into view, then renders horizontal
 * Netflix-style cards. Click a card → opens the Person MV panel and
 * jumps to that codex via globalThis.openPersonMvCodex. Module is
 * vanilla JS, no deps, hides itself if backend returns 0 hot persons. */
(function () {
  "use strict";
  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  var STYLE_ID = "cssos-person-mv-discover-shelf-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      ".cssos-discover-shelf{margin:24px auto 8px;max-width:min(100%,920px);padding:0 12px;width:100%;box-sizing:border-box;}",
      ".cssos-discover-header{display:flex;align-items:baseline;justify-content:space-between;margin:0 4px 10px;gap:12px;}",
      ".cssos-discover-header h2{margin:0;font:700 15px/1.2 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,0.92);letter-spacing:.02em;}",
      ".cssos-discover-all{font:500 12px/1 -apple-system,system-ui,sans-serif;color:rgba(0,245,160,0.78);text-decoration:none;white-space:nowrap;}",
      ".cssos-discover-all:hover{color:rgba(0,245,160,1);}",
      ".cssos-discover-row{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:4px 4px 12px;scrollbar-width:none;}",
      ".cssos-discover-row::-webkit-scrollbar{display:none;}",
      ".cssos-discover-card{flex:0 0 180px;height:240px;border-radius:12px;overflow:hidden;position:relative;cursor:pointer;scroll-snap-align:start;background:rgba(8,18,14,0.6);border:1px solid rgba(0,245,160,0.18);transition:transform .15s ease, border-color .15s ease;}",
      ".cssos-discover-card:hover{transform:translateY(-2px);border-color:rgba(0,245,160,0.55);}",
      ".cssos-discover-card .cover{position:absolute;inset:0;background-size:cover;background-position:center;background-color:rgba(0,30,20,0.7);}",
      ".cssos-discover-card .cover::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,0.78) 100%);}",
      ".cssos-discover-card .info{position:absolute;left:10px;right:10px;bottom:10px;color:#daffee;text-shadow:0 1px 4px rgba(0,0,0,0.7);}",
      ".cssos-discover-card .name{font:700 15px/1.2 -apple-system,system-ui,sans-serif;}",
      ".cssos-discover-card .meta{font:500 10px/1.3 ui-monospace,monospace;color:rgba(0,245,160,0.85);letter-spacing:.04em;margin-top:3px;}",
      ".cssos-discover-card .stats{font:500 10px/1 ui-monospace,monospace;color:rgba(218,255,238,0.7);margin-top:5px;}",
      ".cssos-discover-card *{pointer-events:none;}",
    ].join("");
    document.head.appendChild(s);
  }

  function fmtCount(n) {
    n = Number(n) || 0;
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  function renderCards(rows) {
    var row = document.getElementById("person-mv-discover-row");
    var shelf = document.getElementById("person-mv-discover-shelf");
    if (!row || !shelf) return;
    if (!rows || !rows.length) { shelf.hidden = true; return; }
    var html = rows.map(function (p) {
      var cover = p.top_cover || p.portrait_url || "";
      var civ = [p.civilization || "", p.era || ""].filter(Boolean).join(" · ");
      var name = p.name_zh || p.name_en || p.person_id;
      var stats = "👁 " + fmtCount(p.total_views) + " · 🎬 " + fmtCount(p.mv_count);
      return (
        '<article class="cssos-discover-card" data-person-id="' + String(p.person_id).replace(/"/g, "&quot;") + '" tabindex="0" role="button" aria-label="' + String(name).replace(/"/g, "&quot;") + '">' +
          '<div class="cover"' + (cover ? ' style="background-image:url(\'' + String(cover).replace(/'/g, "%27") + '\')"' : "") + '></div>' +
          '<div class="info">' +
            '<div class="name">' + escapeHtml(name) + '</div>' +
            '<div class="meta">' + escapeHtml(civ) + '</div>' +
            '<div class="stats">' + escapeHtml(stats) + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join("");
    row.innerHTML = html;
    shelf.hidden = false;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }

  var __fetched = false;
  async function fetchAndRender() {
    if (__fetched) return;
    __fetched = true;
    try {
      var r = await fetch("/api/person-mv/discover/hot?limit=8", { credentials: "same-origin" });
      if (!r.ok) { __fetched = false; return; }
      var json = await r.json();
      if (!json || !json.ok) return;
      var rows = (json.data && json.data.persons) || [];
      renderCards(rows);
    } catch (_e) {
      __fetched = false;
    }
  }

  function openPerson(personId) {
    if (!personId) return;
    /* CSSOS_DISCOVER_CARD_DIAG 20260508 — Jing: console trace so we can see
     * whether clicks are firing in production. Remove once verified. */
    try { console.info("[discover-shelf] openPerson", personId); } catch (_e) {}
    if (typeof globalThis.openPersonMvPanel === "function") {
      try { globalThis.openPersonMvPanel(); } catch (_e) {}
    }
    if (typeof globalThis.openPersonMvCodex === "function") {
      try { globalThis.openPersonMvCodex(personId, { autoCinema: false }); return; } catch (_e) {}
    }
    try {
      document.dispatchEvent(new CustomEvent("cssos:open-person-codex", { detail: { person_id: personId } }));
    } catch (_e) {}
  }

  function bindClicks() {
    var row = document.getElementById("person-mv-discover-row");
    if (!row || row.__bound) return;
    row.__bound = true;
    row.addEventListener("click", function (ev) {
      var card = ev.target && ev.target.closest && ev.target.closest(".cssos-discover-card");
      if (!card) return;
      ev.preventDefault();
      openPerson(card.getAttribute("data-person-id"));
    });
    row.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      var card = ev.target && ev.target.closest && ev.target.closest(".cssos-discover-card");
      if (!card) return;
      ev.preventDefault();
      openPerson(card.getAttribute("data-person-id"));
    });
    var allLink = document.getElementById("person-mv-discover-all");
    if (allLink && !allLink.__bound) {
      allLink.__bound = true;
      allLink.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (typeof globalThis.openPersonMvPanel === "function") {
          try { globalThis.openPersonMvPanel(); } catch (_e) {}
        }
      });
    }
  }

  function applyI18n() {
    var titleEl = document.querySelector('#person-mv-discover-shelf [data-i18n="discover.personMv.title"]');
    if (titleEl) titleEl.textContent = tr("🏛 Hot civilization MVs", "🏛 文明热门 MV");
    var allEl = document.getElementById("person-mv-discover-all");
    if (allEl) allEl.textContent = tr("View all →", "查看全部 →");
  }

  function init() {
    var shelf = document.getElementById("person-mv-discover-shelf");
    if (!shelf) return;
    injectStyle();
    applyI18n();
    bindClicks();
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { fetchAndRender(); io.disconnect(); }
        });
      }, { rootMargin: "200px" });
      io.observe(shelf);
      // Force-fetch quickly anyway: shelf is on first screen for most users.
      setTimeout(fetchAndRender, 600);
    } else {
      fetchAndRender();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
