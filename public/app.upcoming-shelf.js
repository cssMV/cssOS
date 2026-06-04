/* CSSOS_WAVE_125 20260513 — Jing  |  W360b 20260525 — badge/panel fixes
 *
 * "Coming Up" shelf — next 7 days of festivals + anniversaries.
 * Sits below the Today's Festival shelf (W122) and Today in History
 * shelf (W119B) in the foryou marketplace.
 *
 * Festivals get culture-emoji glyphs; anniversaries get 🎂 / 🕯️.
 * Each card shows "in N days" relative date label. Click does nothing
 * yet (no MV exists until the day arrives) — purely an anticipation
 * teaser. Future: add "Notify me" CTA → Web Push.
 */
(function () {
  /* CSSOS_WAVE_490f 20260529 — Jing「App 审核中, 登录后秒崩」决定性基线瘦身: 诊断探针实锤
   * 认证态主屏在 iPhone XS Max(4GB)累积过重(~9 发现 shelf + feed + 海量 JS)→ WebKit 内容
   * 进程崩溃→静默重载(无 beforeunload)循环。装饰性"发现 shelf"在手机/App 上是最可削的负担:
   * 关掉它们 → 主屏只剩 logo+dock+用户作品+核心 feed, 大幅降内存。桌面端保留全部。 */
  try { if (document.documentElement.classList.contains("cssos-app") || (window.matchMedia && window.matchMedia("(max-width: 820px)").matches)) return; } catch (_e) {}
  if (globalThis.__cssosUpcomingShelfWired) return;
  globalThis.__cssosUpcomingShelfWired = true;

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
  function isZh() { return locale().indexOf("zh") === 0; }
  function daysFromTodayLabel(dateOrMd) {
    // Accepts either YYYY-MM-DD (festival) or MM-DD (anniversary).
    var today = new Date();
    var target;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOrMd)) {
      target = new Date(dateOrMd + "T00:00:00Z");
    } else if (/^\d{2}-\d{2}$/.test(dateOrMd)) {
      var y = today.getUTCFullYear();
      target = new Date(y + "-" + dateOrMd + "T00:00:00Z");
      if (target.getTime() < today.getTime() - 12 * 3600 * 1000) {
        target = new Date((y + 1) + "-" + dateOrMd + "T00:00:00Z");
      }
    } else {
      return "";
    }
    var todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    var diff = Math.round((target.getTime() - todayUtc) / 86400000);
    if (diff === 1) return isZh() ? "明天" : "Tomorrow";
    if (diff === 2) return isZh() ? "后天" : "In 2 days";
    if (diff > 0 && diff < 7) return isZh() ? ("还有 " + diff + " 天") : ("In " + diff + " days");
    if (diff >= 7) {
      // Show weekday + date (e.g. "Mon · Sep 24")
      var wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][target.getUTCDay()];
      var mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][target.getUTCMonth()];
      var dy = target.getUTCDate();
      return wd + " · " + mo + " " + dy;
    }
    return "";
  }

  function injectStyles() {
    if (document.getElementById("cssos-upcoming-shelf-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-upcoming-shelf-style";
    st.textContent = [
      "#cssos-upcoming-shelf{margin:6px 0 18px;padding:14px;border-radius:14px;background:linear-gradient(135deg,rgba(120,140,200,0.06),rgba(80,100,160,0.03));border:1px solid rgba(140,160,220,0.18);}",
      "#cssos-upcoming-shelf[hidden]{display:none;}",
      "#cssos-upcoming-shelf .shelf-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:10px;flex-wrap:wrap;}",
      "#cssos-upcoming-shelf .shelf-title{font:700 14px/1.2 -apple-system,system-ui,sans-serif;color:#cfd8f5;letter-spacing:.02em;}",
      "#cssos-upcoming-shelf .shelf-sub{font:500 11.5px/1.4 -apple-system,system-ui,sans-serif;color:rgba(207,216,245,0.6);margin-top:2px;}",
      "#cssos-upcoming-shelf .shelf-track{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;padding:4px 2px;scrollbar-width:thin;}",
      "#cssos-upcoming-shelf .shelf-track::-webkit-scrollbar{height:6px;}",
      "#cssos-upcoming-shelf .shelf-track::-webkit-scrollbar-thumb{background:rgba(140,160,220,0.32);border-radius:3px;}",
      ".upcoming-card{flex:0 0 150px;scroll-snap-align:start;background:rgba(8,12,22,0.55);border:1px solid rgba(140,160,220,0.28);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;cursor:default;}",
      ".upcoming-card .cover{position:relative;width:100%;aspect-ratio:1/1;background:linear-gradient(135deg,#0a1428,rgba(140,160,220,0.18));display:flex;align-items:center;justify-content:center;}",
      ".upcoming-card .cover .glyph{font-size:48px;text-shadow:0 1px 6px rgba(0,0,0,0.4);}",
      /* W360b — .when bottom-left, .mv-cta top-right — no shared row, no clash */
      ".upcoming-card .cover .when{position:absolute;bottom:6px;left:6px;padding:3px 6px;border-radius:999px;background:rgba(8,12,22,0.7);backdrop-filter:blur(8px);color:#cfd8f5;font:700 10px/1 ui-monospace,monospace;letter-spacing:.04em;z-index:1;}",
      ".upcoming-card .cover .mv-cta{position:absolute;top:6px;right:6px;padding:3px 7px;border-radius:999px;background:rgba(0,245,160,0.82);color:#001a10;font:700 10px/1 ui-monospace,monospace;letter-spacing:.04em;z-index:1;}",
      ".upcoming-card .info{padding:8px 10px;display:flex;flex-direction:column;gap:3px;}",
      ".upcoming-card .name{font:600 12.5px/1.25 -apple-system,system-ui,sans-serif;color:#dde6ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".upcoming-card .meta{font:500 10px/1.3 ui-monospace,monospace;color:rgba(221,230,255,0.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      /* W360 — person birthday cards are clickable */
      ".upcoming-card-person{cursor:pointer;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;}",
      ".upcoming-card-person:hover{transform:translateY(-3px);border-color:rgba(0,245,160,0.6);box-shadow:0 8px 22px rgba(0,0,0,0.4);}",
      ".upcoming-card-person:focus-visible{outline:2px solid rgba(0,245,160,0.8);outline-offset:2px;}",
      /* cover with portrait gets a gradient overlay so text stays readable */
      ".upcoming-card-person .cover::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,0.7) 100%);}",
      "@media (max-width: 480px){.upcoming-card{flex-basis:124px;}.upcoming-card .cover .glyph{font-size:40px;}}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function ensureShelfHost() {
    var foryouSection = document.getElementById("foryou-market-section");
    if (!foryouSection) return null;
    var existing = document.getElementById("cssos-upcoming-shelf");
    if (existing) return existing;
    injectStyles();
    var shelf = document.createElement("section");
    shelf.id = "cssos-upcoming-shelf";
    shelf.hidden = true;
    shelf.innerHTML = ''
      + '<div class="shelf-head">'
      + '  <div>'
      + '    <div class="shelf-title">🔮 ' + esc(tr("Coming up next 7 days", "未来 7 天")) + '</div>'
      + '    <div class="shelf-sub">' + esc(tr(
            "Festivals and anniversaries on the horizon. Their auto-MVs will land at 04:00 UTC on the day.",
            "即将到来的节日与纪念。每天 UTC 04:00 自动生成对应 MV。"
          )) + '</div>'
      + '  </div>'
      + '</div>'
      + '<div class="shelf-track" id="cssos-upcoming-shelf-track"></div>';
    // Sits AFTER Today shelves — insert as last child of foryou's pre-grid area.
    // Use a different approach: append after the existing festival shelf if it
    // exists, else after the anniversary shelf, else at start.
    var fest = document.getElementById("cssos-festival-shelf");
    var ann = document.getElementById("cssos-today-shelf");
    if (fest && fest.nextSibling) {
      foryouSection.insertBefore(shelf, ann ? ann.nextSibling : fest.nextSibling);
    } else if (ann && ann.nextSibling) {
      foryouSection.insertBefore(shelf, ann.nextSibling);
    } else {
      foryouSection.insertBefore(shelf, foryouSection.firstChild);
    }
    return shelf;
  }

  function render(festivals, anniversaries) {
    var shelf = ensureShelfHost();
    if (!shelf) return;
    var items = [];
    festivals.forEach(function (f) {
      items.push({
        kind: "festival",
        date: f.greg_date, // YYYY-MM-DD
        sort: f.greg_date,
        glyph: FESTIVAL_GLYPH[f.festival_id] || "🎊",
        name: isZh() ? (f.name_zh || f.name_en) : (f.name_en || f.name_zh),
        meta: (globalThis.civMetaText ? globalThis.civMetaText([f.civilization, f.core_theme], null, " · ") : [f.civilization, f.core_theme].filter(Boolean).join(" · ")),
      });
    });
    anniversaries.forEach(function (a) {
      var md = a.upcoming_md; // MM-DD
      if (!md) return;
      // Build a YYYY-MM-DD for sort key (this year, or next year if past).
      var now = new Date();
      var y = now.getUTCFullYear();
      var ymd = y + "-" + md;
      if (new Date(ymd + "T00:00:00Z").getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
        ymd = (y + 1) + "-" + md;
      }
      items.push({
        kind: "anniversary",
        date: md,
        sort: ymd,
        glyph: a.event_type === "death" ? "🕯️" : "🎂",
        name: isZh() ? (a.name_zh || a.name_en) : (a.name_en || a.name_zh),
        meta: (globalThis.civMetaText ? globalThis.civMetaText([a.civilization, a.era], null, " · ") : [a.civilization, a.era].filter(Boolean).join(" · ")),
        // W360 — carry person_id + portrait so card is clickable → codex.
        personId: String(a.person_id || "").trim(),
        portrait: String(a.portrait_url || "").trim(),
      });
    });
    items.sort(function (x, y) { return x.sort < y.sort ? -1 : x.sort > y.sort ? 1 : 0; });
    if (!items.length) {
      shelf.hidden = true;
      return;
    }
    shelf.hidden = false;
    var track = document.getElementById("cssos-upcoming-shelf-track");
    if (!track) return;
    track.innerHTML = items.map(function (it) {
      var when = daysFromTodayLabel(it.date);
      // W360 — anniversary cards with a person_id are clickable → person codex.
      var isClickable = it.kind === "anniversary" && !!it.personId;
      var hasPortrait = !!(it.portrait && isClickable);
      var coverBg = hasPortrait
        ? ' style="background-image:url(' + esc(it.portrait) + ');background-size:cover;background-position:center 20%;"'
        : '';
      // W360b — hidden probe img: if the portrait 404s/errors, reveal the glyph fallback.
      var portraitProbe = hasPortrait
        ? '<img src="' + esc(it.portrait) + '" alt="" aria-hidden="true"'
          + ' style="display:none;position:absolute;"'
          + ' onerror="var c=this.closest(\'.cover\');if(c){c.style.backgroundImage=\'\';var g=c.querySelector(\'.glyph\');if(g)g.style.display=\'\';}this.remove();"'
          + '>'
        : '';
      return ''
        + '<article class="upcoming-card' + (isClickable ? ' upcoming-card-person' : '') + '"'
        + (isClickable ? ' data-person-id="' + esc(it.personId) + '" role="button" tabindex="0" title="' + esc(tr("Open person page · Create MV", "打开人物专页 · 为TA创作MV")) + '"' : '')
        + '>'
        + '  <div class="cover"' + coverBg + '>'
        + portraitProbe
        + '    <span class="glyph"' + (hasPortrait ? ' style="display:none;"' : '') + '>' + it.glyph + '</span>'
        + (when ? '    <div class="when">' + esc(when) + '</div>' : '')
        + (isClickable ? '    <div class="mv-cta">✨ MV</div>' : '')
        + '  </div>'
        + '  <div class="info">'
        + '    <div class="name">' + esc(it.name || "—") + '</div>'
        + (it.meta ? '    <div class="meta">' + esc(it.meta) + '</div>' : '')
        + '  </div>'
        + '</article>';
    }).join("");
    // W360 — wire click handlers after DOM is set.
    track.querySelectorAll(".upcoming-card-person[data-person-id]").forEach(function (card) {
      function handleOpen() {
        var pid = card.getAttribute("data-person-id");
        if (!pid) return;
        // W360b — always activate the panel first so it's visible and in front,
        // then navigate to the person's codex.  The dock action wires up visibility,
        // z-index, and focus; openPersonMvCodex alone won't unhide a closed panel.
        var dockAction = globalThis.__cssosDockActionMap?.["person-mv"];
        var panelEl = document.getElementById("person-mv-panel");
        var panelVisible = panelEl && panelEl.offsetParent !== null
          && getComputedStyle(panelEl).display !== "none"
          && !panelEl.hidden;
        if (!panelVisible) {
          // Open the panel via dock action (handles show + z-index + active state).
          if (typeof dockAction?.click === "function") {
            try { dockAction.click(); } catch (_e) {}
          } else if (panelEl) {
            panelEl.hidden = false;
            panelEl.style.display = "";
          }
          // Let the panel animate open before navigating into codex.
          setTimeout(function () {
            if (typeof globalThis.openPersonMvCodex === "function") {
              try { globalThis.openPersonMvCodex(pid); } catch (_e) {}
            }
          }, 350);
        } else {
          // Panel already open — bring it to front then navigate immediately.
          if (typeof dockAction?.click === "function") {
            try { dockAction.click(); } catch (_e) {}
          }
          if (typeof globalThis.openPersonMvCodex === "function") {
            try { globalThis.openPersonMvCodex(pid); } catch (_e) {}
          }
        }
      }
      card.addEventListener("click", handleOpen);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpen(); }
      });
    });
  }

  var fetchInflight = false;
  async function fetchAndRender() {
    if (fetchInflight) return;
    fetchInflight = true;
    try {
      var [fr, ar] = await Promise.all([
        fetch("/api/festivals/upcoming?days=7", { credentials: "include" }),
        fetch("/api/anniversary/upcoming?days=7", { credentials: "include" }),
      ]);
      var fj = await fr.json();
      var aj = await ar.json();
      var festivals = (fj && fj.ok && fj.data && fj.data.festivals) || [];
      var anniversaries = (aj && aj.ok && aj.data && aj.data.anniversaries) || [];
      render(festivals, anniversaries);
    } catch (_) { /* silent */ }
    finally { fetchInflight = false; }
  }

  function startWatching() {
    var attempts = 0;
    var tick = setInterval(function () {
      attempts++;
      if (document.getElementById("foryou-market-section")) {
        // CSSOS_WAVE_490d — render ONCE when section appears, then stop the 3s rebuild loop
        // (was rebuilding innerHTML every 3s for 30s → DOM thrash → XS Max flicker/crash).
        fetchAndRender();
        clearInterval(tick);
        return;
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
