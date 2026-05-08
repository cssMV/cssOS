/* CSSOS_PERSON_MV_WAVE15 20260508 — Jing
 * Homepage "today in history" shelf. Lazy fetch /api/person-mv/today-in-history,
 * render persons whose birth/death MM-DD matches today (UTC). Click a card →
 * open codex; if the row carries sample_work_id, jump straight into cinema.
 * Hides itself on empty result. Module-memory cache, refreshed when the
 * UTC date rolls over. Vanilla JS, no deps. */
(function () {
  "use strict";
  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  var STYLE_ID = "cssos-person-mv-today-shelf-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      ".cssos-today-shelf{margin:24px auto 8px;max-width:min(100%,920px);padding:0 12px;width:100%;box-sizing:border-box;}",
      ".cssos-today-header{display:flex;align-items:baseline;justify-content:space-between;margin:0 4px 10px;gap:12px;}",
      ".cssos-today-header h2{margin:0;font:700 15px/1.2 -apple-system,system-ui,sans-serif;color:rgba(255,236,200,0.94);letter-spacing:.02em;}",
      ".cssos-today-sub{font:500 11px/1 ui-monospace,monospace;color:rgba(255,200,120,0.82);white-space:nowrap;}",
      ".cssos-today-row{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:4px 4px 12px;scrollbar-width:none;}",
      ".cssos-today-row::-webkit-scrollbar{display:none;}",
      ".cssos-today-card{flex:0 0 180px;height:240px;border-radius:12px;overflow:hidden;position:relative;cursor:pointer;scroll-snap-align:start;background:rgba(20,12,4,0.65);border:1px solid rgba(255,180,80,0.22);transition:transform .15s ease, border-color .15s ease;}",
      ".cssos-today-card:hover{transform:translateY(-2px);border-color:rgba(255,180,80,0.6);}",
      ".cssos-today-card .cover{position:absolute;inset:0;background-size:cover;background-position:center;background-color:rgba(40,20,8,0.7);}",
      ".cssos-today-card .cover::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,0.78) 100%);}",
      ".cssos-today-card .info{position:absolute;left:10px;right:10px;bottom:10px;color:#ffeccc;text-shadow:0 1px 4px rgba(0,0,0,0.7);}",
      ".cssos-today-card .name{font:700 15px/1.2 -apple-system,system-ui,sans-serif;}",
      ".cssos-today-card .anniv{font:600 11px/1.3 ui-monospace,monospace;color:rgba(255,200,120,0.95);letter-spacing:.04em;margin-top:3px;}",
      ".cssos-today-card .meta{font:500 10px/1.3 ui-monospace,monospace;color:rgba(255,236,200,0.7);margin-top:3px;}",
      ".cssos-today-card *{pointer-events:none;}",
    ].join("");
    document.head.appendChild(s);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }

  function extractYear(lifespan, which) {
    if (!lifespan) return null;
    var s = String(lifespan);
    var halves = s.split(/[–—\-\/~]|至|到/);
    if (halves.length < 2) return null;
    var chunk = which === "birth" ? halves[0] : halves[halves.length - 1];
    var m = chunk.match(/(\d{3,4})/);
    if (!m) return null;
    var year = parseInt(m[1], 10);
    if (/前|BCE|B\.C\.|公元前/.test(chunk)) year = -year;
    return year;
  }

  function annivLabel(p) {
    var nowYear = new Date().getUTCFullYear();
    var year = extractYear(p.lifespan, p.event_type === "birth" ? "birth" : "death");
    if (p.event_type === "birth") {
      if (year != null) {
        var n = nowYear - year;
        return tr("🎂 " + n + "th birth anniversary", "🎂 诞辰 " + n + " 周年");
      }
      return tr("🎂 Birthday today", "🎂 诞辰纪念");
    }
    if (year != null) {
      var n2 = nowYear - year;
      return tr("🕯️ " + n2 + "th death anniversary", "🕯️ 逝世 " + n2 + " 周年");
    }
    return tr("🕯️ Death anniversary today", "🕯️ 逝世纪念");
  }

  function renderCards(rows, date) {
    var row = document.getElementById("person-mv-today-row");
    var shelf = document.getElementById("person-mv-today-shelf");
    var sub = document.getElementById("person-mv-today-sub");
    if (!row || !shelf) return;
    if (!rows || !rows.length) { shelf.hidden = true; return; }
    if (sub && date) sub.textContent = date.replace("-", "/");
    var html = rows.map(function (p) {
      var cover = p.portrait_url || "";
      var civ = [p.civilization || "", p.era || ""].filter(Boolean).join(" · ");
      var name = p.name_zh || p.name_en || p.person_id;
      return (
        '<article class="cssos-today-card" data-person-id="' + escapeHtml(p.person_id) + '"' +
          (p.sample_work_id ? ' data-work-id="' + escapeHtml(p.sample_work_id) + '"' : "") +
          ' tabindex="0" role="button" aria-label="' + escapeHtml(name) + '">' +
          '<div class="cover"' + (cover ? ' style="background-image:url(\'' + String(cover).replace(/'/g, "%27") + '\')"' : "") + '></div>' +
          '<div class="info">' +
            '<div class="name">' + escapeHtml(name) + '</div>' +
            '<div class="anniv">' + escapeHtml(annivLabel(p)) + '</div>' +
            '<div class="meta">' + escapeHtml(civ) + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join("");
    row.innerHTML = html;
    shelf.hidden = false;
  }

  var __cache = null; // { date: "MM-DD", rows: [...] }
  function todayUtcKey() {
    var d = new Date();
    return String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
  }

  var __fetching = false;
  async function fetchAndRender() {
    var key = todayUtcKey();
    if (__cache && __cache.date === key) {
      renderCards(__cache.rows, __cache.date);
      return;
    }
    if (__fetching) return;
    __fetching = true;
    try {
      var r = await fetch("/api/person-mv/today-in-history", { credentials: "same-origin" });
      if (!r.ok) return;
      var json = await r.json();
      if (!json || !json.ok) return;
      var rows = (json.data && json.data.persons) || [];
      var date = (json.data && json.data.date) || key;
      __cache = { date: date, rows: rows };
      renderCards(rows, date);
    } catch (_e) {
      // silent
    } finally {
      __fetching = false;
    }
  }

  function openPerson(personId, workId) {
    if (!personId) return;
    if (typeof globalThis.openPersonMvPanel === "function") {
      try { globalThis.openPersonMvPanel(); } catch (_e) {}
    }
    if (typeof globalThis.openPersonMvCodex === "function") {
      try { globalThis.openPersonMvCodex(personId, workId ? { work_id: workId, autoCinema: true } : undefined); }
      catch (_e) {}
    } else {
      try {
        document.dispatchEvent(new CustomEvent("cssos:open-person-codex", {
          detail: { person_id: personId, work_id: workId || null, autoCinema: !!workId },
        }));
      } catch (_e) {}
    }
  }

  function bindClicks() {
    var row = document.getElementById("person-mv-today-row");
    if (!row || row.__bound) return;
    row.__bound = true;
    row.addEventListener("click", function (ev) {
      var card = ev.target && ev.target.closest && ev.target.closest(".cssos-today-card");
      if (!card) return;
      ev.preventDefault();
      openPerson(card.getAttribute("data-person-id"), card.getAttribute("data-work-id"));
    });
    row.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      var card = ev.target && ev.target.closest && ev.target.closest(".cssos-today-card");
      if (!card) return;
      ev.preventDefault();
      openPerson(card.getAttribute("data-person-id"), card.getAttribute("data-work-id"));
    });
  }

  function applyI18n() {
    var titleEl = document.querySelector('#person-mv-today-shelf [data-i18n="today.personMv.title"]');
    if (titleEl) titleEl.textContent = tr("📅 Today in history", "📅 今日历史");
  }

  function init() {
    var shelf = document.getElementById("person-mv-today-shelf");
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
      setTimeout(fetchAndRender, 800);
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
