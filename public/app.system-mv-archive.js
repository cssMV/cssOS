/* CSSOS_WAVE_128 20260513 — Jing
 *
 * Archive overlay for system-generated MVs. Adds a small 📜 button to
 * each festival / anniversary card across the Today (W119B/W122) and
 * Upcoming (W125) shelves. Click → modal lists all past works tied to
 * that festival/person across years.
 *
 * Completes the time axis:
 *   archive (this module) ← today shelves → upcoming shelf
 *
 * No deps beyond fetch + the existing openMarketWorkPreview helper.
 */
(function () {
  if (globalThis.__cssosArchiveOverlayWired) return;
  globalThis.__cssosArchiveOverlayWired = true;

  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en) : en;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function isZh() {
    try {
      var l = (localStorage.getItem("CSSOS_LANG") || localStorage.getItem("cssos.locale") || "en").toLowerCase();
      return l.indexOf("zh") === 0;
    } catch (_) { return false; }
  }

  function injectStyles() {
    if (document.getElementById("cssos-archive-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-archive-style";
    st.textContent = [
      /* Tiny scroll-archive icon button overlay on each card. */
      '.cssos-archive-btn{position:absolute;top:6px;left:6px;width:24px;height:24px;border-radius:6px;background:rgba(8,12,22,0.7);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;line-height:1;color:#fff;z-index:2;transition:background 120ms ease,border-color 120ms ease;}',
      '.cssos-archive-btn:hover{background:rgba(8,12,22,0.9);border-color:rgba(255,200,80,0.65);}',
      '.cssos-archive-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px;}',
      '.cssos-archive-modal{max-width:520px;width:100%;max-height:80vh;background:#0f1219;border:1px solid rgba(255,255,255,0.12);border-radius:14px;display:flex;flex-direction:column;overflow:hidden;color:#e6e8ee;}',
      '.cssos-archive-head{display:flex;align-items:baseline;gap:8px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);}',
      '.cssos-archive-head .title{font:700 15px/1.2 -apple-system,system-ui,sans-serif;flex:1;color:#fff;}',
      '.cssos-archive-head .close{background:transparent;border:0;color:#9aa;font-size:22px;cursor:pointer;padding:0;line-height:1;}',
      '.cssos-archive-head .close:hover{color:#fff;}',
      '.cssos-archive-body{padding:10px 14px 14px;overflow-y:auto;flex:1;}',
      '.cssos-archive-empty{text-align:center;padding:24px 12px;color:rgba(255,255,255,0.45);font-size:12.5px;font-style:italic;}',
      '.cssos-archive-row{display:flex;gap:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;cursor:pointer;transition:border-color 120ms ease,background 120ms ease;}',
      '.cssos-archive-row:hover{border-color:rgba(255,200,80,0.42);background:rgba(255,200,80,0.04);}',
      '.cssos-archive-row .thumb{flex:0 0 60px;width:60px;height:60px;border-radius:8px;background:#15181f;background-size:cover;background-position:center;}',
      '.cssos-archive-row .info{flex:1;min-width:0;}',
      '.cssos-archive-row .row-title{font:600 13px/1.25 -apple-system,system-ui,sans-serif;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.cssos-archive-row .row-meta{font:500 11px/1.4 ui-monospace,monospace;color:rgba(255,255,255,0.55);margin-top:3px;}',
      '.cssos-archive-row .row-date{font:700 10.5px/1 ui-monospace,monospace;color:#00f5a0;letter-spacing:.04em;margin-top:6px;}',
      /* Make existing cards relative so absolute-positioned overlay works. */
      '.today-card,.festival-card,.upcoming-card{position:relative;}',
    ].join("\n");
    document.head.appendChild(st);
  }

  function openWork(workId) {
    if (!workId) return;
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
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toISOString().slice(0, 10); } catch (_) { return iso; }
  }

  async function showArchiveModal(kind, id, title) {
    injectStyles();
    var backdrop = document.createElement("div");
    backdrop.className = "cssos-archive-modal-backdrop";
    backdrop.innerHTML = ''
      + '<div class="cssos-archive-modal" role="dialog" aria-modal="true">'
      + '  <div class="cssos-archive-head">'
      + '    <div class="title">📜 ' + esc(title || tr("Past years", "往年")) + '</div>'
      + '    <button class="close" aria-label="Close">×</button>'
      + '  </div>'
      + '  <div class="cssos-archive-body"><div class="cssos-archive-empty">' + esc(tr("Loading…", "加载中…")) + '</div></div>'
      + '</div>';
    document.body.appendChild(backdrop);
    var close = function () { try { backdrop.remove(); } catch (_) {} };
    backdrop.querySelector(".close").addEventListener("click", close);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
    document.addEventListener("keydown", function escapeOnce(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", escapeOnce); }
    });

    var body = backdrop.querySelector(".cssos-archive-body");
    try {
      var qs = "kind=" + encodeURIComponent(kind) + "&id=" + encodeURIComponent(id);
      var r = await fetch("/api/system-mvs/archive?" + qs, { credentials: "include" });
      var j = await r.json();
      if (!r.ok || !j.ok) {
        body.innerHTML = '<div class="cssos-archive-empty">' + esc(tr("Failed to load.", "加载失败。")) + '</div>';
        return;
      }
      var works = (j.data && j.data.works) || [];
      if (!works.length) {
        body.innerHTML = '<div class="cssos-archive-empty">'
          + esc(tr("No past MVs yet. They'll appear here once the daily cron generates them.",
                    "暂无往年 MV。每日自动生成后会出现在这里。"))
          + '</div>';
        return;
      }
      body.innerHTML = works.map(function (w) {
        var displayTitle = w.work_title || w.title || (
          kind === "festival"
            ? (isZh() ? (w.festival_name_zh || w.festival_name_en) : (w.festival_name_en || w.festival_name_zh))
            : (isZh() ? (w.name_zh || w.name_en) : (w.name_en || w.name_zh))
        ) || "—";
        var thumb = w.cover_image || w.portrait_url || "";
        var thumbStyle = thumb ? ('background-image:url(' + esc(thumb) + ');') : '';
        var meta = kind === "festival"
          ? [w.civilization, w.style, w.core_theme].filter(Boolean).join(" · ")
          : [w.civilization, w.era, w.event_type === "death" ? "🕯️" : "🎂"].filter(Boolean).join(" · ");
        return ''
          + '<div class="cssos-archive-row" data-work-id="' + esc(w.work_id || "") + '">'
          + '  <div class="thumb" style="' + thumbStyle + '"></div>'
          + '  <div class="info">'
          + '    <div class="row-title">' + esc(displayTitle) + '</div>'
          + '    <div class="row-meta">' + esc(meta) + '</div>'
          + '    <div class="row-date">' + esc(fmtDate(w.run_date)) + '</div>'
          + '  </div>'
          + '</div>';
      }).join("");
      body.querySelectorAll(".cssos-archive-row").forEach(function (row) {
        row.addEventListener("click", function () {
          var wid = row.getAttribute("data-work-id");
          if (wid) { close(); openWork(wid); }
        });
      });
    } catch (err) {
      body.innerHTML = '<div class="cssos-archive-empty">' + esc(tr("Error: ", "错误：") + (err && err.message || err)) + '</div>';
    }
  }

  function decorateCards() {
    // Festival cards: data-festival-id
    document.querySelectorAll('.festival-card, .upcoming-card').forEach(function (card) {
      if (card.__archiveDecorated) return;
      var festId = card.getAttribute("data-festival-id");
      if (!festId) return;
      card.__archiveDecorated = true;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cssos-archive-btn";
      btn.title = tr("Past years", "往年");
      btn.textContent = "📜";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var name = (card.querySelector(".name") || {}).textContent || "";
        showArchiveModal("festival", festId, name + " · " + tr("past years", "往年"));
      });
      var cover = card.querySelector(".cover") || card;
      cover.appendChild(btn);
    });
    // Anniversary cards: data-person-id
    document.querySelectorAll('.today-card').forEach(function (card) {
      if (card.__archiveDecorated) return;
      var personId = card.getAttribute("data-person-id");
      if (!personId) return;
      card.__archiveDecorated = true;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cssos-archive-btn";
      btn.title = tr("Past years", "往年");
      btn.textContent = "📜";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var name = (card.querySelector(".name") || {}).textContent || "";
        showArchiveModal("anniversary", personId, name + " · " + tr("past years", "往年"));
      });
      var cover = card.querySelector(".cover") || card;
      cover.appendChild(btn);
    });
  }

  function startWatching() {
    injectStyles();
    decorateCards();
    var attempts = 0;
    var tick = setInterval(function () {
      attempts++;
      decorateCards();
      if (attempts >= 15) clearInterval(tick);
    }, 1500);
    window.addEventListener("focus", decorateCards);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatching);
  } else {
    startWatching();
  }
})();
