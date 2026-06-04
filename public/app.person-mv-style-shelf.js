/* CSSOS_PERSON_MV_WAVE21 20260508 — Jing
 * Homepage 🎨 风格电台 shelf. Lazy-fetches /api/person-mv/playlists, renders
 * the available style chips, and on click pulls the playlist + opens cinema
 * on the first MV. Subsequent MVs are dispatched via a 'cssos:cinema-queue'
 * event so the cinema panel can binge-watch when end-of-MV fires. Vanilla. */
(function () {
  "use strict";
  /* CSSOS_WAVE_490f 20260529 — Jing「App 审核中, 登录后秒崩」决定性基线瘦身: 诊断探针实锤
   * 认证态主屏在 iPhone XS Max(4GB)累积过重(~9 发现 shelf + feed + 海量 JS)→ WebKit 内容
   * 进程崩溃→静默重载(无 beforeunload)循环。装饰性"发现 shelf"在手机/App 上是最可削的负担:
   * 关掉它们 → 主屏只剩 logo+dock+用户作品+核心 feed, 大幅降内存。桌面端保留全部。 */
  try { if (document.documentElement.classList.contains("cssos-app") || (window.matchMedia && window.matchMedia("(max-width: 820px)").matches)) return; } catch (_e) {}
  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  // Display labels per chip — primary lookup is i18n key 'style.chip.<key>',
  // with zh/en fallbacks if the dictionary is missing the entry.
  var CHIP_LABELS = {
    tang:      ["🐉 Tang",        "🐉 唐风"],
    cyberpunk: ["🌃 Cyberpunk",   "🌃 赛博朋克"],
    lofi:      ["🎧 Lo-fi",       "🎧 Lo-fi"],
    rock:      ["🎸 Rock",        "🎸 摇滚"],
    cinematic: ["🎬 Cinematic",   "🎬 电影感"],
    jpop:      ["🌸 J-Pop",       "🌸 日系"],
    epic:      ["⚔️ Epic",         "⚔️ 史诗"],
    ambient:   ["🌫️ Ambient",      "🌫️ 氛围"],
  };
  function chipLabel(key) {
    var pair = CHIP_LABELS[key] || [key, key];
    return tr(pair[0], pair[1]);
  }

  var STYLE_ID = "cssos-person-mv-style-shelf-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      ".cssos-style-shelf{margin:24px auto 8px;max-width:min(100%,920px);padding:0 12px;width:100%;box-sizing:border-box;}",
      ".cssos-style-header{display:flex;align-items:baseline;justify-content:space-between;margin:0 4px 10px;gap:12px;}",
      ".cssos-style-header h2{margin:0;font:700 15px/1.2 -apple-system,system-ui,sans-serif;color:rgba(220,235,255,0.94);letter-spacing:.02em;}",
      ".cssos-style-row{display:flex;flex-wrap:wrap;gap:8px;padding:4px;}",
      ".cssos-style-chip{appearance:none;border:1px solid rgba(120,180,255,0.32);background:rgba(20,28,48,0.7);color:#dde8ff;border-radius:999px;padding:8px 14px;font:600 13px/1 -apple-system,system-ui,sans-serif;cursor:pointer;transition:transform .12s ease, border-color .12s ease, background .12s ease;}",
      ".cssos-style-chip:hover{transform:translateY(-1px);border-color:rgba(180,210,255,0.7);background:rgba(40,60,100,0.85);}",
      ".cssos-style-chip .ct{margin-left:6px;color:rgba(180,210,255,0.7);font-weight:500;}",
    ].join("");
    document.head.appendChild(s);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }

  var __cache = null;
  async function fetchPlaylists() {
    if (__cache) return __cache;
    try {
      var r = await fetch("/api/person-mv/playlists", { credentials: "same-origin" });
      if (!r.ok) return null;
      var j = await r.json();
      if (!j || !j.ok) return null;
      __cache = (j.data && j.data.playlists) || [];
      return __cache;
    } catch (_e) { return null; }
  }

  function renderChips(rows) {
    var row = document.getElementById("person-mv-style-row");
    var shelf = document.getElementById("person-mv-style-shelf");
    if (!row || !shelf) return;
    if (!rows || !rows.length) { shelf.hidden = true; return; }
    row.innerHTML = rows.map(function (p) {
      return (
        '<button class="cssos-style-chip" type="button" data-style-tag="' + escapeHtml(p.tag) + '">' +
          escapeHtml(chipLabel(p.tag)) +
          '<span class="ct">·' + (p.mv_count|0) + '</span>' +
        '</button>'
      );
    }).join("");
    shelf.hidden = false;
  }

  async function enterPlaylist(tag) {
    if (!tag) return;
    try {
      var r = await fetch("/api/person-mv/playlists/style/" + encodeURIComponent(tag) + "?limit=20", { credentials: "same-origin" });
      if (!r.ok) return;
      var j = await r.json();
      if (!j || !j.ok) return;
      var mvs = (j.data && j.data.mvs) || [];
      if (!mvs.length) return;
      var first = mvs[0];
      // Broadcast the queue so cinema can binge-play when each MV ends.
      try {
        document.dispatchEvent(new CustomEvent("cssos:cinema-queue", {
          detail: { tag: tag, mvs: mvs, label: chipLabel(tag) },
        }));
      } catch (_e) {}
      if (typeof globalThis.openPersonMvCodex === "function") {
        try { globalThis.openPersonMvCodex(first.person_id, { work_id: first.work_id, autoCinema: true, styleTag: tag, styleLabel: chipLabel(tag) }); return; }
        catch (_e) {}
      }
      try {
        document.dispatchEvent(new CustomEvent("cssos:open-person-codex", {
          detail: { person_id: first.person_id, work_id: first.work_id || null, autoCinema: true, styleTag: tag },
        }));
      } catch (_e) {}
    } catch (_e) {}
  }

  function bindClicks() {
    var row = document.getElementById("person-mv-style-row");
    if (!row || row.__bound) return;
    row.__bound = true;
    row.addEventListener("click", function (ev) {
      var chip = ev.target && ev.target.closest && ev.target.closest(".cssos-style-chip");
      if (!chip) return;
      ev.preventDefault();
      enterPlaylist(chip.getAttribute("data-style-tag"));
    });
  }

  function applyI18n() {
    var el = document.querySelector('#person-mv-style-shelf [data-i18n="style.playlist.title"]');
    if (el) el.textContent = tr("🎨 Style Radio", "🎨 风格电台");
    // Re-render chip labels if cache present (locale flip).
    if (__cache) renderChips(__cache);
  }

  async function fetchAndRender() {
    var rows = await fetchPlaylists();
    if (rows) renderChips(rows);
  }

  function init() {
    var shelf = document.getElementById("person-mv-style-shelf");
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
    document.addEventListener("cssos:locale-changed", applyI18n);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
