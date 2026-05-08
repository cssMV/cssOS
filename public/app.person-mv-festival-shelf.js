/* CSSOS_PERSON_MV_WAVE23 20260508 — Jing
 * Homepage "🎊 节日特辑" shelf. Lazy fetch /api/person-mv/festivals/today,
 * render any active festival with theme color + featured-person cards.
 * Hides on empty result. Module-memory cache. Vanilla JS, no deps. */
(function () {
  "use strict";
  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  var STYLE_ID = "cssos-person-mv-festival-shelf-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      ".cssos-festival-shelf{margin:24px auto 8px;max-width:min(100%,920px);padding:0 12px;width:100%;box-sizing:border-box;}",
      ".cssos-festival-hero{position:relative;border-radius:14px;overflow:hidden;padding:18px 20px;color:#fff;margin:0 4px 12px;}",
      ".cssos-festival-hero::before{content:'';position:absolute;inset:0;background:var(--festival-bg,#7a1313);opacity:.92;}",
      ".cssos-festival-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.08),transparent 60%);}",
      ".cssos-festival-hero > *{position:relative;z-index:1;}",
      ".cssos-festival-hero .emoji{font-size:32px;line-height:1;}",
      ".cssos-festival-hero h2{margin:6px 0 4px;font:800 20px/1.2 -apple-system,system-ui,sans-serif;}",
      ".cssos-festival-hero p{margin:0;font:500 13px/1.5 -apple-system,system-ui,sans-serif;color:rgba(255,255,255,.92);max-width:640px;}",
      ".cssos-festival-row{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:4px 4px 12px;scrollbar-width:none;}",
      ".cssos-festival-row::-webkit-scrollbar{display:none;}",
      ".cssos-festival-card{flex:0 0 168px;height:220px;border-radius:12px;overflow:hidden;position:relative;cursor:pointer;scroll-snap-align:start;background:rgba(20,12,4,0.65);border:1px solid rgba(255,180,80,0.22);transition:transform .15s ease, border-color .15s ease;}",
      ".cssos-festival-card:hover{transform:translateY(-2px);border-color:rgba(255,180,80,0.6);}",
      ".cssos-festival-card .cover{position:absolute;inset:0;background-size:cover;background-position:center;background-color:rgba(40,20,8,0.7);}",
      ".cssos-festival-card .cover::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,0.78) 100%);}",
      ".cssos-festival-card .info{position:absolute;left:10px;right:10px;bottom:10px;color:#ffeccc;text-shadow:0 1px 4px rgba(0,0,0,0.7);}",
      ".cssos-festival-card .name{font:700 15px/1.2 -apple-system,system-ui,sans-serif;}",
      ".cssos-festival-card .meta{font:500 10px/1.3 ui-monospace,monospace;color:rgba(255,236,200,0.7);margin-top:3px;}",
      ".cssos-festival-card *{pointer-events:none;}",
    ].join("");
    document.head.appendChild(s);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }

  function render(festivals) {
    var shelf = document.getElementById("person-mv-festival-shelf");
    if (!shelf) return;
    if (!festivals || !festivals.length) { shelf.hidden = true; return; }
    var f = festivals[0];
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    var isZh = /^zh/i.test(String(locale));
    var name = isZh ? (f.name_zh || f.name_en) : (f.name_en || f.name_zh);
    var desc = isZh ? (f.description_zh || f.description_en || "") : (f.description_en || f.description_zh || "");
    var color = f.theme_color || "#7a1313";

    var heroHtml =
      '<div class="cssos-festival-hero" style="--festival-bg:' + escapeHtml(color) + '">' +
        '<div class="emoji">' + escapeHtml(f.emoji || "🎊") + '</div>' +
        '<h2>' + escapeHtml(name) + '</h2>' +
        '<p>' + escapeHtml(desc) + '</p>' +
      '</div>';

    // Lazily load the persons via festival detail.
    fetch("/api/person-mv/festivals/" + encodeURIComponent(f.festival_id), {
      credentials: "include",
      headers: { Accept: "application/json" },
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var persons = (j && j.ok && j.data && j.data.persons) || [];
      var cardsHtml = persons.map(function (p) {
        var cover = p.portrait_url || "";
        var civ = [p.civilization || "", p.era || ""].filter(Boolean).join(" · ");
        var pname = isZh ? (p.name_zh || p.name_en) : (p.name_en || p.name_zh);
        return (
          '<article class="cssos-festival-card" data-person-id="' + escapeHtml(p.person_id) + '"' +
            (p.sample_work_id ? ' data-work-id="' + escapeHtml(p.sample_work_id) + '"' : "") +
            ' tabindex="0" role="button" aria-label="' + escapeHtml(pname) + '">' +
            '<div class="cover"' + (cover ? ' style="background-image:url(\'' + String(cover).replace(/'/g, "%27") + '\')"' : "") + '></div>' +
            '<div class="info">' +
              '<div class="name">' + escapeHtml(pname) + '</div>' +
              '<div class="meta">' + escapeHtml(civ) + '</div>' +
            '</div>' +
          '</article>'
        );
      }).join("");
      shelf.innerHTML = heroHtml + '<div class="cssos-festival-row">' + cardsHtml + '</div>';
      shelf.hidden = false;
      shelf.addEventListener("click", function (ev) {
        var card = ev.target && ev.target.closest && ev.target.closest("[data-person-id]");
        if (!card) return;
        var pid = card.getAttribute("data-person-id");
        if (pid) {
          location.hash = "#person-mv/" + encodeURIComponent(pid);
        }
      });
    }).catch(function () { shelf.hidden = true; });
  }

  function load() {
    injectStyle();
    fetch("/api/person-mv/festivals/today", {
      credentials: "include",
      headers: { Accept: "application/json" },
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var festivals = (j && j.ok && j.data && j.data.festivals) || [];
        render(festivals);
      })
      .catch(function () {
        var shelf = document.getElementById("person-mv-festival-shelf");
        if (shelf) shelf.hidden = true;
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();
