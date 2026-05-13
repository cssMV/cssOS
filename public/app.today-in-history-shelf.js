/* CSSOS_WAVE_119B 20260513 — Jing
 *
 * Today-in-History horizontal shelf for the 为你创作 marketplace.
 *
 * Fetches /api/anniversary/today and renders a row of cards above
 * the regular marketplace grid. Each card represents a system-
 * generated MV for someone whose birthday/death anniversary falls
 * on today (UTC). Click → open the work in Watch panel.
 *
 * System-generated works are visually distinguished:
 *   - Gold/amber border accent (vs. green for user MVs)
 *   - 🎂 / 🕯️ glyph in top-right (birth / death)
 *   - "FREE · Tribute by cssOS" label
 *   - No price/buyout buttons rendered — only Listen + Tip
 */
(function () {
  if (globalThis.__cssosTodayInHistoryWired) return;
  globalThis.__cssosTodayInHistoryWired = true;

  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en) : en;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function locale() {
    try {
      return (localStorage.getItem("CSSOS_LANG") || localStorage.getItem("cssos.locale") || "en").toLowerCase();
    } catch (_) { return "en"; }
  }

  function injectStyles() {
    if (document.getElementById("cssos-today-shelf-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-today-shelf-style";
    st.textContent = [
      "#cssos-today-shelf{margin:14px 0 18px;padding:14px;border-radius:14px;background:linear-gradient(135deg,rgba(255,180,80,0.08),rgba(255,140,40,0.04));border:1px solid rgba(255,180,80,0.22);position:relative;}",
      "#cssos-today-shelf[hidden]{display:none;}",
      "#cssos-today-shelf .shelf-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:10px;flex-wrap:wrap;}",
      "#cssos-today-shelf .shelf-title{font:700 14px/1.2 -apple-system,system-ui,sans-serif;color:#ffd99a;letter-spacing:.02em;}",
      "#cssos-today-shelf .shelf-date{font:500 11px/1 ui-monospace,monospace;color:#9aa;}",
      "#cssos-today-shelf .shelf-sub{font:500 11.5px/1.4 -apple-system,system-ui,sans-serif;color:rgba(255,217,154,0.7);margin-top:2px;}",
      "#cssos-today-shelf .shelf-track{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;padding:4px 2px;scrollbar-width:thin;}",
      "#cssos-today-shelf .shelf-track::-webkit-scrollbar{height:6px;}",
      "#cssos-today-shelf .shelf-track::-webkit-scrollbar-thumb{background:rgba(255,180,80,0.32);border-radius:3px;}",
      ".today-card{flex:0 0 160px;scroll-snap-align:start;background:rgba(8,18,14,0.55);border:1px solid rgba(255,180,80,0.32);border-radius:12px;overflow:hidden;cursor:pointer;transition:transform 160ms ease, border-color 160ms ease;display:flex;flex-direction:column;}",
      ".today-card:hover{transform:translateY(-2px);border-color:rgba(255,200,120,0.65);}",
      ".today-card .cover{position:relative;width:100%;aspect-ratio:1/1;background:linear-gradient(135deg,#012019,rgba(255,180,80,0.18));background-size:cover;background-position:center;}",
      ".today-card .cover .event-glyph{position:absolute;top:6px;right:6px;font-size:18px;text-shadow:0 1px 4px rgba(0,0,0,0.6);}",
      ".today-card .cover .free-tag{position:absolute;left:6px;bottom:6px;padding:2px 7px;border-radius:999px;background:rgba(0,245,160,0.78);color:#0a0d12;font:700 9px/1 ui-monospace,monospace;letter-spacing:.04em;}",
      ".today-card .info{padding:8px 10px;display:flex;flex-direction:column;gap:3px;}",
      ".today-card .name{font:600 12.5px/1.25 -apple-system,system-ui,sans-serif;color:#daffee;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".today-card .meta{font:500 10px/1.3 ui-monospace,monospace;color:rgba(218,255,238,0.55);}",
      "@media (max-width: 480px){.today-card{flex-basis:130px;}}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function ensureShelfHost() {
    var foryouSection = document.getElementById("foryou-market-section");
    if (!foryouSection) return null;
    var existing = document.getElementById("cssos-today-shelf");
    if (existing) return existing;
    injectStyles();
    var shelf = document.createElement("section");
    shelf.id = "cssos-today-shelf";
    shelf.hidden = true;
    shelf.innerHTML = ''
      + '<div class="shelf-head">'
      + '  <div>'
      + '    <div class="shelf-title">📜 ' + esc(tr("Today in History", "今日历史")) + '</div>'
      + '    <div class="shelf-sub">' + esc(tr(
            "Free MVs honoring people whose anniversary is today. Tribute by cssOS — no purchase required.",
            "纪念今日生辰/忌日的免费 MV，cssOS 平台敬上 —— 无需购买。"
          )) + '</div>'
      + '  </div>'
      + '  <div class="shelf-date" id="cssos-today-shelf-date"></div>'
      + '</div>'
      + '<div class="shelf-track" id="cssos-today-shelf-track"></div>';
    // Insert as the FIRST child of the foryou section, above the market grid.
    foryouSection.insertBefore(shelf, foryouSection.firstChild);
    return shelf;
  }

  function render(data) {
    var shelf = ensureShelfHost();
    if (!shelf) return;
    // CSSOS_WAVE_119B 20260513 — align with the pre-existing
    // /api/anniversary/today response shape: { date, anniversaries:[
    //   { person_id, name_zh, name_en, civilization, era, portrait_url,
    //     event_type, work_id, status, work_title, cover_image, ... }
    // ]}. We only render items that have a work_id (skip pending).
    var items = (data && data.anniversaries) || [];
    items = items.filter(function (it) { return it && it.work_id; });
    if (!items.length) {
      shelf.hidden = true;
      return;
    }
    shelf.hidden = false;
    var dateEl = document.getElementById("cssos-today-shelf-date");
    if (dateEl) dateEl.textContent = data.date || "";
    var isZh = locale().indexOf("zh") === 0;
    var track = document.getElementById("cssos-today-shelf-track");
    if (!track) return;
    track.innerHTML = items.map(function (it) {
      var name = isZh
        ? (it.name_zh || it.name_en || it.person_id)
        : (it.name_en || it.name_zh || it.person_id);
      var meta = [it.civilization, it.era].filter(Boolean).join(" · ");
      var coverUrl = String(it.cover_image || it.portrait_url || "").trim();
      var coverStyle = coverUrl
        ? 'background-image:url(' + esc(coverUrl) + ');'
        : '';
      var glyph = it.event_type === "death" ? "🕯️" : "🎂";
      return ''
        + '<article class="today-card" data-work-id="' + esc(it.work_id) + '" data-person-id="' + esc(it.person_id) + '">'
        + '  <div class="cover" style="' + coverStyle + '">'
        + '    <span class="event-glyph">' + glyph + '</span>'
        + '    <span class="free-tag">' + esc(tr("FREE", "免费")) + '</span>'
        + '  </div>'
        + '  <div class="info">'
        + '    <div class="name">' + esc(name) + '</div>'
        + (meta ? '    <div class="meta">' + esc(meta) + '</div>' : '')
        + '  </div>'
        + '</article>';
    }).join("");
    track.querySelectorAll(".today-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var workId = card.getAttribute("data-work-id");
        if (!workId) return;
        if (typeof globalThis.openMarketWorkPreview === "function") {
          globalThis.openMarketWorkPreview({ id: workId, work_id: workId });
          return;
        }
        // Fallback: navigate to ?cssMV=<id> deeplink
        try {
          var url = new URL(window.location.href);
          url.searchParams.set("cssMV", workId);
          window.history.pushState({}, "", url.toString());
          window.dispatchEvent(new PopStateEvent("popstate"));
        } catch (_) {
          window.location.href = "/?cssMV=" + encodeURIComponent(workId);
        }
      });
    });
  }

  var fetchInflight = false;
  async function fetchAndRender() {
    if (fetchInflight) return;
    fetchInflight = true;
    try {
      var r = await fetch("/api/anniversary/today", { credentials: "include" });
      var j = await r.json();
      if (j && j.ok && j.data) render(j.data);
    } catch (_) { /* silent */ }
    finally { fetchInflight = false; }
  }

  function startWatching() {
    // Try every 3 seconds for first 30 seconds (foryou section
    // renders late after auth + market data loads), then back off.
    var attempts = 0;
    var tick = setInterval(function () {
      attempts++;
      if (document.getElementById("foryou-market-section")) {
        fetchAndRender();
      }
      if (attempts >= 10) {
        clearInterval(tick);
        // After initial 30s, only re-fetch when foryou panel opens
        // (intersection or focus event).
      }
    }, 3000);
    // Re-fetch on hash/cssMV change (after a purchase navigation)
    window.addEventListener("focus", function () {
      if (document.getElementById("foryou-market-section")) fetchAndRender();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatching);
  } else {
    startWatching();
  }
})();
