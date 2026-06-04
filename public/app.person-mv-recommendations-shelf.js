/* CSSOS_PERSON_MV_WAVE52 20260508 — Jing
 * Smart-recommendations shelf. Lazy-fetches /api/user/recommendations
 * once visible. Hides itself for anonymous users (401) or empty
 * results. Each card shows portrait + name + reason chip; click opens
 * the codex via globalThis.openPersonMvCodex (auto-cinema is the
 * codex's default behaviour). */
(function () {
  "use strict";
  /* CSSOS_WAVE_490f 20260529 — Jing「App 审核中, 登录后秒崩」决定性基线瘦身: 诊断探针实锤
   * 认证态主屏在 iPhone XS Max(4GB)累积过重(~9 发现 shelf + feed + 海量 JS)→ WebKit 内容
   * 进程崩溃→静默重载(无 beforeunload)循环。装饰性"发现 shelf"在手机/App 上是最可削的负担:
   * 关掉它们 → 主屏只剩 logo+dock+用户作品+核心 feed, 大幅降内存。桌面端保留全部。 */
  try { if (document.documentElement.classList.contains("cssos-app") || (window.matchMedia && window.matchMedia("(max-width: 820px)").matches)) return; } catch (_e) {}
  var STYLE_ID = "cssos-person-mv-recs-shelf-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      ".cssos-recs-shelf{margin:24px auto 8px;max-width:min(100%,920px);padding:0 12px;width:100%;box-sizing:border-box;}",
      ".cssos-recs-header{display:flex;align-items:baseline;justify-content:space-between;margin:0 4px 10px;gap:12px;}",
      ".cssos-recs-header h2{margin:0;font:700 15px/1.2 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,0.92);letter-spacing:.02em;}",
      ".cssos-recs-row{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:4px 4px 12px;scrollbar-width:none;}",
      ".cssos-recs-row::-webkit-scrollbar{display:none;}",
      ".cssos-recs-card{flex:0 0 180px;height:240px;border-radius:12px;overflow:hidden;position:relative;cursor:pointer;scroll-snap-align:start;background:rgba(8,18,14,0.6);border:1px solid rgba(0,245,160,0.18);transition:transform .15s ease, border-color .15s ease;}",
      ".cssos-recs-card:hover{transform:translateY(-2px);border-color:rgba(0,245,160,0.55);}",
      ".cssos-recs-card .cover{position:absolute;inset:0;background-size:cover;background-position:center;background-color:rgba(0,30,20,0.7);}",
      ".cssos-recs-card .cover::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,0.85) 100%);}",
      ".cssos-recs-card .info{position:absolute;left:10px;right:10px;bottom:10px;color:#daffee;text-shadow:0 1px 4px rgba(0,0,0,0.7);}",
      ".cssos-recs-card .name{font:700 15px/1.2 -apple-system,system-ui,sans-serif;}",
      ".cssos-recs-card .reason{display:inline-block;margin-top:6px;padding:2px 6px;border-radius:6px;background:rgba(0,245,160,0.16);color:rgba(0,245,160,0.92);font:500 10px/1.3 -apple-system,system-ui,sans-serif;}",
      ".cssos-recs-card *{pointer-events:none;}",
    ].join("");
    document.head.appendChild(s);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }

  function renderCards(rows) {
    var row = document.getElementById("person-mv-recs-row");
    var shelf = document.getElementById("person-mv-recs-shelf");
    if (!row || !shelf) return;
    if (!rows || !rows.length) { shelf.hidden = true; return; }
    row.innerHTML = rows.map(function (p) {
      var cover = p.portrait_url || "";
      // en-first: platform default is English; zh name only when locale is zh.
      var _zhLocale = /^zh/i.test(String((globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en"));
      var name = _zhLocale ? (p.name_zh || p.name_en || p.person_id) : (p.name_en || p.name_zh || p.person_id);
      return (
        '<article class="cssos-recs-card" data-person-id="' + escapeHtml(p.person_id) + '" tabindex="0" role="button" aria-label="' + escapeHtml(name) + '">' +
          '<div class="cover"' + (cover ? ' style="background-image:url(\'' + String((globalThis.cssosThumb || function (u) { return u; })(cover, 400)).replace(/'/g, "%27") + '\')"' : "") + '></div>' +
          '<div class="info">' +
            '<div class="name">' + escapeHtml(name) + '</div>' +
            '<div class="reason">' + escapeHtml(p.reason || "") + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join("");
    shelf.hidden = false;
  }

  var __fetched = false;
  async function fetchAndRender() {
    if (__fetched) return;
    __fetched = true;
    try {
      var r = await fetch("/api/user/recommendations?limit=8", { credentials: "same-origin" });
      if (r.status === 401) { return; /* anonymous */ }
      if (!r.ok) { __fetched = false; return; }
      var json = await r.json();
      if (!json || !json.ok) return;
      renderCards(json.recommendations || []);
    } catch (_e) { __fetched = false; }
  }

  function openPerson(personId) {
    if (!personId) return;
    if (typeof globalThis.openPersonMvPanel === "function") {
      try { globalThis.openPersonMvPanel(); } catch (_e) {}
    }
    if (typeof globalThis.openPersonMvCodex === "function") {
      try { globalThis.openPersonMvCodex(personId); return; } catch (_e) {}
    }
    try { document.dispatchEvent(new CustomEvent("cssos:open-person-codex", { detail: { person_id: personId } })); } catch (_e) {}
  }

  function bindClicks() {
    var row = document.getElementById("person-mv-recs-row");
    if (!row || row.__bound) return;
    row.__bound = true;
    row.addEventListener("click", function (ev) {
      var card = ev.target && ev.target.closest && ev.target.closest(".cssos-recs-card");
      if (!card) return;
      ev.preventDefault();
      openPerson(card.getAttribute("data-person-id"));
    });
  }

  function init() {
    var shelf = document.getElementById("person-mv-recs-shelf");
    if (!shelf) return;
    injectStyle();
    bindClicks();
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { fetchAndRender(); io.disconnect(); } });
      }, { rootMargin: "200px" });
      io.observe(shelf);
      setTimeout(fetchAndRender, 800);
    } else { fetchAndRender(); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else { init(); }
})();
