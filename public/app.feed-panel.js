/* CSSOS_PERSON_MV_WAVE26 20260508 — Jing
 * Following feed panel. Hash route #feed mounts a chronological list
 * of MVs from creators / persons / groups the user follows. Provides
 * a Subscribe button helper (window.cssosToggleSubscribe) for codex
 * pages and group pages to call inline. Vanilla JS, no deps. */
(function () {
  "use strict";
  var STYLE_ID = "cssos-feed-panel-style";
  var ROOT_ID  = "cssos-feed-panel-root";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#cssos-feed-panel-root{position:fixed;inset:0;background:rgba(0,12,8,0.94);z-index:9000;overflow-y:auto;display:none;}",
      "#cssos-feed-panel-root.open{display:block;}",
      "#cssos-feed-panel-root .feed-shell{max-width:920px;margin:32px auto;padding:0 16px;}",
      "#cssos-feed-panel-root header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px;}",
      "#cssos-feed-panel-root h1{margin:0;font:700 22px -apple-system,system-ui,sans-serif;color:#daffee;}",
      "#cssos-feed-panel-root .close-btn{background:transparent;border:1px solid rgba(0,245,160,0.45);color:#daffee;padding:6px 12px;border-radius:8px;cursor:pointer;font:500 12px ui-monospace,monospace;}",
      "#cssos-feed-panel-root .feed-rss{font:500 11px ui-monospace,monospace;color:rgba(0,245,160,0.85);text-decoration:none;}",
      "#cssos-feed-panel-root .feed-rss:hover{text-decoration:underline;}",
      "#cssos-feed-panel-root .feed-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}",
      "#cssos-feed-panel-root .feed-card{background:rgba(8,18,14,0.7);border:1px solid rgba(0,245,160,0.18);border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .15s ease,border-color .15s ease;}",
      "#cssos-feed-panel-root .feed-card:hover{transform:translateY(-2px);border-color:rgba(0,245,160,0.55);}",
      "#cssos-feed-panel-root .feed-cover{aspect-ratio:16/9;background-size:cover;background-position:center;background-color:rgba(0,30,20,0.7);}",
      "#cssos-feed-panel-root .feed-meta{padding:10px;}",
      "#cssos-feed-panel-root .feed-title{font:600 14px -apple-system,system-ui,sans-serif;color:#daffee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "#cssos-feed-panel-root .feed-source{font:500 11px ui-monospace,monospace;color:rgba(0,245,160,0.78);margin-top:4px;}",
      "#cssos-feed-panel-root .feed-empty{padding:48px 12px;text-align:center;color:rgba(218,255,238,0.6);}",
    ].join("");
    document.head.appendChild(s);
  }

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function ensureRoot() {
    var root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = [
      '<div class="feed-shell">',
      "  <header>",
      '    <h1>📡 Following</h1>',
      '    <div style="display:flex;gap:10px;align-items:center;">',
      '      <a class="feed-rss" href="javascript:void(0)" id="cssos-feed-rss-link">RSS</a>',
      '      <button class="close-btn" type="button" id="cssos-feed-close">close</button>',
      "    </div>",
      "  </header>",
      '  <div class="feed-grid" id="cssos-feed-grid"></div>',
      "</div>",
    ].join("");
    document.body.appendChild(root);
    root.querySelector("#cssos-feed-close").addEventListener("click", close);
    root.querySelector("#cssos-feed-rss-link").addEventListener("click", showRssLink);
    return root;
  }

  function close() {
    var root = document.getElementById(ROOT_ID);
    if (root) root.classList.remove("open");
    if (location.hash === "#feed") {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (_e) {}
    }
  }

  function render(items) {
    var grid = document.getElementById("cssos-feed-grid");
    if (!grid) return;
    if (!items || !items.length) {
      grid.innerHTML = '<div class="feed-empty">No new MVs from your follows yet. Subscribe to creators, persons, or schools to populate this feed.</div>';
      return;
    }
    grid.innerHTML = items.map(function (it) {
      var cover = it.cover_image || "";
      var srcLabel = (it.source_kind === "creator" ? "👤" : it.source_kind === "person" ? "🏛" : "🎭")
                   + " " + (it.source_id || "").slice(0, 24);
      return [
        '<article class="feed-card" data-mv="' + escHtml(it.mv_id) + '" data-person="' + escHtml(it.person_id || "") + '">',
        '  <div class="feed-cover" style="background-image:url(' + JSON.stringify(cover) + ')"></div>',
        '  <div class="feed-meta">',
        '    <div class="feed-title">' + escHtml(it.title) + "</div>",
        '    <div class="feed-source">' + escHtml(srcLabel) + "</div>",
        "  </div>",
        "</article>",
      ].join("");
    }).join("");
    Array.prototype.forEach.call(grid.querySelectorAll(".feed-card"), function (card) {
      card.addEventListener("click", function () {
        var pid = card.getAttribute("data-person");
        if (pid && typeof globalThis.openPersonMvCodex === "function") {
          try { globalThis.openPersonMvCodex(pid); close(); return; } catch (_e) {}
        }
        var mv = card.getAttribute("data-mv");
        if (mv) location.assign("/m/" + encodeURIComponent(mv));
      });
    });
  }

  function open() {
    injectStyle();
    var root = ensureRoot();
    root.classList.add("open");
    fetch("/api/person-mv/feed?limit=50", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) render(j.items || []); })
      .catch(function () {
        var grid = document.getElementById("cssos-feed-grid");
        if (grid) grid.innerHTML = '<div class="feed-empty">Failed to load feed.</div>';
      });
  }

  function showRssLink() {
    fetch("/api/person-mv/feed.rss", { credentials: "same-origin" })
      .then(function (r) { return r.headers.get("content-type") && r.headers.get("content-type").indexOf("json") >= 0 ? r.json() : null; })
      .then(function (j) {
        if (j && j.rss_url) {
          var url = location.origin + j.rss_url;
          try { navigator.clipboard.writeText(url); } catch (_e) {}
          alert("RSS URL copied to clipboard:\n\n" + url);
        } else {
          alert("Sign in to generate your RSS feed URL.");
        }
      })
      .catch(function () { alert("Failed to fetch RSS URL."); });
  }

  function maybeOpenFromHash() {
    if (location.hash === "#feed") open();
  }

  document.addEventListener("DOMContentLoaded", maybeOpenFromHash);
  window.addEventListener("hashchange", maybeOpenFromHash);

  globalThis.cssosOpenFeed = open;
  globalThis.cssosCloseFeed = close;

  /* Subscribe-button helper. Codex/group pages can call this with
   * (kind, id) to toggle subscription state. Returns a Promise<boolean>
   * resolving to the new subscribed state. */
  globalThis.cssosToggleSubscribe = function (kind, targetId) {
    return fetch("/api/person-mv/subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_kind: kind, target_id: targetId }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) return !!j.subscribed;
      throw new Error((j && j.code) || "subscribe_failed");
    });
  };
})();
