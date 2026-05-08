/* CSSOS_PERSON_MV_WAVE25 20260508 — Jing
 * Global full-text search overlay. Triggered by the "/" hotkey or by
 * an injected magnifier button next to the bell. Debounces input by
 * 300ms, calls /api/person-mv/search, renders a type-grouped dropdown.
 * Vanilla JS, no deps. Self-mounting on DOMContentLoaded. */
(function () {
  "use strict";
  var STYLE_ID = "cssos-global-search-style";
  var ROOT_ID = "cssos-global-search-root";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#cssos-global-search-root{position:fixed;inset:0;z-index:9999;display:none;background:rgba(0,12,8,0.78);backdrop-filter:blur(6px);}",
      "#cssos-global-search-root.open{display:block;}",
      "#cssos-global-search-root .gs-shell{position:absolute;left:50%;top:14vh;transform:translateX(-50%);width:min(640px,92vw);background:rgba(8,18,14,0.96);border:1px solid rgba(0,245,160,0.35);border-radius:14px;padding:14px;box-shadow:0 12px 48px rgba(0,0,0,0.55);}",
      "#cssos-global-search-root input.gs-input{width:100%;background:transparent;border:0;outline:0;color:#daffee;font:600 18px -apple-system,system-ui,sans-serif;padding:8px 4px;border-bottom:1px solid rgba(0,245,160,0.28);}",
      "#cssos-global-search-root .gs-results{max-height:60vh;overflow-y:auto;margin-top:10px;}",
      "#cssos-global-search-root .gs-group{margin:8px 0 4px;font:600 11px ui-monospace,monospace;color:rgba(0,245,160,0.78);letter-spacing:.08em;text-transform:uppercase;}",
      "#cssos-global-search-root .gs-row{display:flex;gap:10px;padding:8px;border-radius:8px;cursor:pointer;align-items:flex-start;}",
      "#cssos-global-search-root .gs-row:hover{background:rgba(0,245,160,0.08);}",
      "#cssos-global-search-root .gs-row .icon{flex:0 0 22px;font-size:18px;line-height:1.2;}",
      "#cssos-global-search-root .gs-row .body{flex:1;min-width:0;}",
      "#cssos-global-search-root .gs-row .title{color:#daffee;font:600 14px -apple-system,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "#cssos-global-search-root .gs-row .snippet{color:rgba(218,255,238,0.65);font:500 12px -apple-system,system-ui,sans-serif;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "#cssos-global-search-root .gs-empty{padding:18px 8px;color:rgba(218,255,238,0.55);font:500 13px -apple-system,system-ui,sans-serif;text-align:center;}",
      "#cssos-global-search-root .gs-hint{color:rgba(218,255,238,0.45);font:500 11px ui-monospace,monospace;margin-top:6px;text-align:right;}",
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
      '<div class="gs-shell" role="dialog" aria-label="Search">',
      '  <input class="gs-input" type="search" placeholder="Search persons, MVs, comments…" autocomplete="off" />',
      '  <div class="gs-results" id="cssos-global-search-results"></div>',
      '  <div class="gs-hint">↵ open · esc close · /  toggle</div>',
      "</div>",
    ].join("");
    document.body.appendChild(root);
    root.addEventListener("click", function (e) {
      if (e.target === root) close();
    });
    return root;
  }

  var debounceTimer = null;
  function open() {
    injectStyle();
    var root = ensureRoot();
    root.classList.add("open");
    var input = root.querySelector(".gs-input");
    if (input) { input.value = ""; setTimeout(function () { input.focus(); }, 30); }
    var res = root.querySelector("#cssos-global-search-results");
    if (res) res.innerHTML = '<div class="gs-empty">Start typing to search…</div>';
  }
  function close() {
    var root = document.getElementById(ROOT_ID);
    if (root) root.classList.remove("open");
  }

  function render(results) {
    var res = document.getElementById("cssos-global-search-results");
    if (!res) return;
    if (!results || !results.length) {
      res.innerHTML = '<div class="gs-empty">No matches.</div>';
      return;
    }
    var groups = { person: [], mv: [], comment: [] };
    results.forEach(function (r) { (groups[r.type] || groups.person).push(r); });
    var html = "";
    function section(label, icon, rows) {
      if (!rows.length) return;
      html += '<div class="gs-group">' + escHtml(label) + "</div>";
      rows.forEach(function (r) {
        html += [
          '<div class="gs-row" data-type="' + escHtml(r.type) + '" data-id="' + escHtml(r.id) + '" data-person="' + escHtml(r.person_id || "") + '" data-mv-url="' + escHtml(r.mv_url || "") + '">',
          '  <div class="icon">' + icon + "</div>",
          '  <div class="body">',
          '    <div class="title">' + escHtml(r.title) + "</div>",
          '    <div class="snippet">' + escHtml(r.snippet) + "</div>",
          "  </div>",
          "</div>",
        ].join("");
      });
    }
    section("Persons",  "👤", groups.person);
    section("MVs",      "🎬", groups.mv);
    section("Comments", "💬", groups.comment);
    res.innerHTML = html;
    Array.prototype.forEach.call(res.querySelectorAll(".gs-row"), function (row) {
      row.addEventListener("click", function () {
        var type = row.getAttribute("data-type");
        var pid = row.getAttribute("data-person");
        if ((type === "person" || type === "mv" || type === "comment") && pid && typeof globalThis.openPersonMvCodex === "function") {
          try { globalThis.openPersonMvCodex(pid); } catch (_e) {}
        } else {
          location.hash = "#person-mv";
        }
        close();
      });
    });
  }

  function runSearch(q) {
    if (!q || !q.trim()) { render([]); return; }
    fetch("/api/person-mv/search?q=" + encodeURIComponent(q.trim()) + "&limit=20", {
      credentials: "same-origin",
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) render(j.results || []);
    }).catch(function () { /* swallow — overlay stays empty */ });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Hotkey: "/" anywhere outside a text input opens the overlay.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "/") return;
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      open();
    });
    // Lazy bind input handler once root exists.
    var bound = false;
    document.addEventListener("input", function (e) {
      if (bound) return;
      var root = document.getElementById(ROOT_ID);
      if (!root) return;
      var input = root.querySelector(".gs-input");
      if (!input) return;
      bound = true;
      input.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        var v = input.value;
        debounceTimer = setTimeout(function () { runSearch(v); }, 300);
      });
    }, true);
  });

  globalThis.cssosOpenGlobalSearch = open;
  globalThis.cssosCloseGlobalSearch = close;
})();
