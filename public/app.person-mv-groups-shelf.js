/* CSSOS_PERSON_MV_WAVE16 20260508 — Jing
 * Schools/Groups (流派/学派) discovery shelf. Mirrors the Wave 9
 * hot-MVs shelf: lazy-fetches /api/person-mv/groups on view, renders
 * cards, click → openPersonMvGroup(group_id). */
(function () {
  "use strict";
  /* CSSOS_WAVE_490f 20260529 — Jing「App 审核中, 登录后秒崩」决定性基线瘦身: 诊断探针实锤
   * 认证态主屏在 iPhone XS Max(4GB)累积过重(~9 发现 shelf + feed + 海量 JS)→ WebKit 内容
   * 进程崩溃→静默重载(无 beforeunload)循环。装饰性"发现 shelf"在手机/App 上是最可削的负担:
   * 关掉它们 → 主屏只剩 logo+dock+用户作品+核心 feed, 大幅降内存。桌面端保留全部。 */
  try { if (document.documentElement.classList.contains("cssos-app") || (window.matchMedia && window.matchMedia("(max-width: 820px)").matches)) return; } catch (_e) {}
  function tr(en, zh) {
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }
  function escTxt(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }
  function escAttr(s) { return escTxt(s); }

  var __fetched = false;
  function renderCards(rows) {
    var row = document.getElementById("person-mv-groups-row");
    var shelf = document.getElementById("person-mv-groups-shelf");
    if (!row || !shelf) return;
    if (!rows || !rows.length) { shelf.hidden = true; return; }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    var isZh = /^zh/i.test(String(locale));
    row.innerHTML = rows.map(function (g) {
      var icon = (g.visual_theme && g.visual_theme.icon) ? String(g.visual_theme.icon) : "🏛";
      var color = (g.visual_theme && g.visual_theme.color) ? String(g.visual_theme.color) : "#00f5a0";
      var name = isZh ? (g.name_zh || g.name_en) : (g.name_en || g.name_zh);
      var meta = (globalThis.civMetaText ? globalThis.civMetaText([g.era, g.civilization], null, " · ") : [g.era, g.civilization].filter(Boolean).join(" · "));
      var stats = "👥 " + (g.member_count || 0) + " · 🎼 " + (g.mv_count || 0);
      return (
        '<article class="cssos-discover-card" data-group-id="' + escAttr(g.group_id) + '" tabindex="0" role="button" aria-label="' + escAttr(name) + '">' +
          '<div class="cover" style="background:linear-gradient(135deg,#012019,' + escAttr(color) + '44);display:flex;align-items:center;justify-content:center;font-size:64px;">' + escTxt(icon) + '</div>' +
          '<div class="info">' +
            '<div class="name">' + escTxt(name) + '</div>' +
            '<div class="meta">' + escTxt(meta) + '</div>' +
            '<div class="stats">' + escTxt(stats) + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join("");
    shelf.hidden = false;
  }

  async function fetchAndRender() {
    if (__fetched) return;
    __fetched = true;
    try {
      var r = await fetch("/api/person-mv/groups", { credentials: "same-origin" });
      if (!r.ok) { __fetched = false; return; }
      var json = await r.json();
      if (!json || !json.ok) return;
      renderCards((json.data && json.data.groups) || []);
    } catch (_e) { __fetched = false; }
  }

  function openGroup(groupId) {
    if (!groupId) return;
    if (typeof globalThis.openPersonMvPanel === "function") {
      try { globalThis.openPersonMvPanel(); } catch (_e) {}
    }
    if (typeof globalThis.openPersonMvGroup === "function") {
      try { globalThis.openPersonMvGroup(groupId); } catch (_e) {}
    }
  }

  function bindClicks() {
    var row = document.getElementById("person-mv-groups-row");
    if (!row || row.__bound) return;
    row.__bound = true;
    row.addEventListener("click", function (ev) {
      var card = ev.target && ev.target.closest && ev.target.closest(".cssos-discover-card");
      if (!card) return;
      ev.preventDefault();
      openGroup(card.getAttribute("data-group-id"));
    });
    row.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      var card = ev.target && ev.target.closest && ev.target.closest(".cssos-discover-card");
      if (!card) return;
      ev.preventDefault();
      openGroup(card.getAttribute("data-group-id"));
    });
  }

  function applyI18n() {
    var titleEl = document.querySelector('#person-mv-groups-shelf [data-i18n="discover.personMvGroups.title"]');
    if (titleEl) titleEl.textContent = tr("🏛 Civilization schools", "🏛 文明流派");
  }

  function init() {
    var shelf = document.getElementById("person-mv-groups-shelf");
    if (!shelf) return;
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
