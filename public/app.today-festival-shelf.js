/* CSSOS_WAVE_122 20260513 — Jing
 *
 * Today's Festival horizontal shelf for the 为你创作 marketplace.
 *
 * Fetches /api/festivals/today and renders a row of cards above the
 * Today-in-History (anniversary) shelf. Festivals are bigger events
 * than birthdays — when both fire on the same day, festival shelf
 * sits on top.
 *
 * Visual theme: crimson/red (vs anniversary's amber/gold) — matches
 * 春节红 / Christmas red / Valentine etc. cultural cue.
 *
 * Same system-work invariants apply: FREE, no buyout button, tip-only.
 */
(function () {
  if (globalThis.__cssosTodayFestivalShelfWired) return;
  globalThis.__cssosTodayFestivalShelfWired = true;

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

  // Map festival_id → emoji glyph for visual recognition.
  var FESTIVAL_GLYPH = {
    "spring-festival": "🧧",
    "lantern":         "🏮",
    "qingming":        "🌧️",
    "dragon-boat":     "🐉",
    "mid-autumn":      "🌕",
    "chongyang":       "⛰️",
    "new-year-day":    "🎆",
    "valentine":       "❤️",
    "easter":          "🐣",
    "halloween":       "🎃",
    "thanksgiving":    "🦃",
    "christmas":       "🎄",
    "diwali":          "🪔",
    "eid-fitr":        "🌙",
    "us-independence": "🎇",
    "international-women": "🌷",
  };

  function injectStyles() {
    if (document.getElementById("cssos-festival-shelf-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-festival-shelf-style";
    st.textContent = [
      "#cssos-festival-shelf{margin:14px 0 8px;padding:14px;border-radius:14px;background:linear-gradient(135deg,rgba(230,60,80,0.10),rgba(180,20,40,0.05));border:1px solid rgba(230,90,100,0.30);position:relative;}",
      "#cssos-festival-shelf[hidden]{display:none;}",
      "#cssos-festival-shelf .shelf-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:10px;flex-wrap:wrap;}",
      "#cssos-festival-shelf .shelf-title{font:700 14px/1.2 -apple-system,system-ui,sans-serif;color:#ffc7c7;letter-spacing:.02em;}",
      "#cssos-festival-shelf .shelf-date{font:500 11px/1 ui-monospace,monospace;color:#9aa;}",
      "#cssos-festival-shelf .shelf-sub{font:500 11.5px/1.4 -apple-system,system-ui,sans-serif;color:rgba(255,199,199,0.75);margin-top:2px;}",
      "#cssos-festival-shelf .shelf-track{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;padding:4px 2px;scrollbar-width:thin;}",
      "#cssos-festival-shelf .shelf-track::-webkit-scrollbar{height:6px;}",
      "#cssos-festival-shelf .shelf-track::-webkit-scrollbar-thumb{background:rgba(230,90,100,0.42);border-radius:3px;}",
      ".festival-card{flex:0 0 170px;scroll-snap-align:start;background:rgba(22,8,10,0.6);border:1px solid rgba(230,90,100,0.40);border-radius:12px;overflow:hidden;cursor:pointer;transition:transform 160ms ease, border-color 160ms ease;display:flex;flex-direction:column;}",
      ".festival-card:hover{transform:translateY(-2px);border-color:rgba(255,140,150,0.75);}",
      ".festival-card .cover{position:relative;width:100%;aspect-ratio:1/1;background:linear-gradient(135deg,#220a10,rgba(230,90,100,0.20));background-size:cover;background-position:center;}",
      ".festival-card .cover .festival-glyph{position:absolute;top:6px;right:6px;font-size:22px;text-shadow:0 1px 4px rgba(0,0,0,0.7);}",
      ".festival-card .cover .free-tag{position:absolute;left:6px;bottom:6px;padding:2px 7px;border-radius:999px;background:rgba(255,200,80,0.85);color:#2a1505;font:700 9px/1 ui-monospace,monospace;letter-spacing:.04em;}",
      ".festival-card .cover .pending{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:600 11px/1.2 -apple-system,system-ui,sans-serif;color:rgba(255,255,255,0.55);text-align:center;padding:8px;}",
      ".festival-card .info{padding:8px 10px;display:flex;flex-direction:column;gap:3px;}",
      ".festival-card .name{font:600 12.5px/1.25 -apple-system,system-ui,sans-serif;color:#ffe5e5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".festival-card .meta{font:500 10px/1.3 ui-monospace,monospace;color:rgba(255,229,229,0.55);}",
      "@media (max-width: 480px){.festival-card{flex-basis:140px;}}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function ensureShelfHost() {
    var foryouSection = document.getElementById("foryou-market-section");
    if (!foryouSection) return null;
    var existing = document.getElementById("cssos-festival-shelf");
    if (existing) return existing;
    injectStyles();
    var shelf = document.createElement("section");
    shelf.id = "cssos-festival-shelf";
    shelf.hidden = true;
    shelf.innerHTML = ''
      + '<div class="shelf-head">'
      + '  <div>'
      + '    <div class="shelf-title">🎊 ' + esc(tr("Today's Festival", "今日节日")) + '</div>'
      + '    <div class="shelf-sub">' + esc(tr(
            "Free festival MVs across civilizations. Tribute by cssOS — no purchase required.",
            "跨文明的节日免费 MV，cssOS 平台敬上 —— 无需购买。"
          )) + '</div>'
      + '  </div>'
      + '  <div class="shelf-date" id="cssos-festival-shelf-date"></div>'
      + '</div>'
      + '<div class="shelf-track" id="cssos-festival-shelf-track"></div>';
    // Insert as the FIRST child — sits ABOVE the anniversary shelf
    // (which is also inserted as firstChild; this one runs after).
    foryouSection.insertBefore(shelf, foryouSection.firstChild);
    return shelf;
  }

  function render(data) {
    var shelf = ensureShelfHost();
    if (!shelf) return;
    var items = (data && data.festivals) || [];
    if (!items.length) {
      shelf.hidden = true;
      return;
    }
    shelf.hidden = false;
    var dateEl = document.getElementById("cssos-festival-shelf-date");
    if (dateEl) dateEl.textContent = data.date || "";
    var isZh = locale().indexOf("zh") === 0;
    var track = document.getElementById("cssos-festival-shelf-track");
    if (!track) return;
    track.innerHTML = items.map(function (it) {
      var name = isZh
        ? (it.name_zh || it.name_en || it.festival_id)
        : (it.name_en || it.name_zh || it.festival_id);
      var meta = [it.civilization, it.core_theme].filter(Boolean).join(" · ");
      var coverUrl = String(it.cover_image || "").trim();
      var coverStyle = coverUrl
        ? 'background-image:url(' + esc(coverUrl) + ');'
        : '';
      var glyph = FESTIVAL_GLYPH[it.festival_id] || "🎊";
      var pending = !it.work_id;
      return ''
        + '<article class="festival-card" data-work-id="' + esc(it.work_id || "") + '" data-festival-id="' + esc(it.festival_id) + '">'
        + '  <div class="cover" style="' + coverStyle + '">'
        + '    <span class="festival-glyph">' + glyph + '</span>'
        + (pending
            ? '    <div class="pending">' + esc(tr("Generating today's MV…", "正在生成今日 MV…")) + '</div>'
            : '    <span class="free-tag">' + esc(tr("FREE", "免费")) + '</span>')
        + '  </div>'
        + '  <div class="info">'
        + '    <div class="name">' + esc(name) + '</div>'
        + (meta ? '    <div class="meta">' + esc(meta) + '</div>' : '')
        + '  </div>'
        + '</article>';
    }).join("");
    track.querySelectorAll(".festival-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var workId = card.getAttribute("data-work-id");
        if (!workId) return;
        // CSSOS_WAVE_153C 20260514 — Jing: 节日 shelf 点击对齐 W128/W149
        // 统一入口 — open the MV pipeline panel in cinema mode with the
        // work queued, same as the person/landmark codex gallery cards.
        if (typeof globalThis.openMvPipelinePanel === "function") {
          globalThis.openMvPipelinePanel({ cinema: true, queue: [workId] });
          return;
        }
        if (typeof globalThis.openMarketWorkPreview === "function") {
          globalThis.openMarketWorkPreview({ id: workId, work_id: workId });
          return;
        }
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
      var r = await fetch("/api/festivals/today", { credentials: "include" });
      var j = await r.json();
      if (j && j.ok && j.data) render(j.data);
    } catch (_) { /* silent */ }
    finally { fetchInflight = false; }
  }

  function startWatching() {
    var attempts = 0;
    var tick = setInterval(function () {
      attempts++;
      if (document.getElementById("foryou-market-section")) {
        fetchAndRender();
      }
      if (attempts >= 10) clearInterval(tick);
    }, 3000);
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
