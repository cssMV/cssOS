/* CSSOS_PERSON_MV_WAVE25 20260508 — Jing
 * Global full-text search overlay. Triggered by the "/" hotkey or by
 * an injected magnifier button next to the bell. Debounces input by
 * 300ms, calls /api/person-mv/search, renders a type-grouped dropdown.
 * Vanilla JS, no deps. Self-mounting on DOMContentLoaded. */
(function () {
  "use strict";
  var STYLE_ID = "cssos-global-search-style";
  var ROOT_ID = "cssos-global-search-root";

  var T = function (en) { return (typeof globalThis.loginCopy === "function" ? globalThis.loginCopy(en) : en); };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#cssos-global-search-root{position:fixed;inset:0;z-index:9999;display:none;background:rgba(0,12,8,0.78);backdrop-filter:blur(6px);}",
      "#cssos-global-search-root.open{display:block;}",
      "#cssos-global-search-root .gs-shell{position:absolute;left:50%;top:14vh;transform:translateX(-50%);width:min(640px,92vw);background:var(--panel-strong);border:1px solid rgba(0,245,160,0.35);border-radius:14px;padding:14px;box-shadow:0 12px 48px rgba(0,0,0,0.55);}",
      "#cssos-global-search-root input.gs-input{width:100%;background:transparent;border:0;outline:0;color:var(--text);font:600 18px -apple-system,system-ui,sans-serif;padding:8px 4px;border-bottom:1px solid rgba(0,245,160,0.28);}",
      "#cssos-global-search-root .gs-results{max-height:60vh;overflow-y:auto;margin-top:10px;}",
      "#cssos-global-search-root .gs-group{margin:8px 0 4px;font:600 11px ui-monospace,monospace;color:rgba(0,245,160,0.78);letter-spacing:.08em;text-transform:uppercase;}",
      "#cssos-global-search-root .gs-row{display:flex;gap:10px;padding:8px;border-radius:8px;cursor:pointer;align-items:flex-start;}",
      "#cssos-global-search-root .gs-row:hover{background:rgba(0,245,160,0.08);}",
      "#cssos-global-search-root .gs-row .icon{flex:0 0 22px;font-size:18px;line-height:1.2;}",
      "#cssos-global-search-root .gs-row .body{flex:1;min-width:0;}",
      "#cssos-global-search-root .gs-row .title{color:var(--text);font:600 14px -apple-system,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "#cssos-global-search-root .gs-row .snippet{color:var(--muted);font:500 12px -apple-system,system-ui,sans-serif;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "#cssos-global-search-root .gs-empty{padding:18px 8px;color:var(--muted);font:500 13px -apple-system,system-ui,sans-serif;text-align:center;}",
      "#cssos-global-search-root .gs-hint{color:var(--muted);font:500 11px ui-monospace,monospace;margin-top:6px;text-align:right;}",
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
      '<div class="gs-shell" role="dialog" aria-label="' + escHtml(T("Search")) + '">',
      '  <input class="gs-input" type="search" placeholder="' + escHtml(T("Search persons, MVs, comments…")) + '" autocomplete="off" />',
      '  <div class="gs-results" id="cssos-global-search-results"></div>',
      '  <div class="gs-hint">' + escHtml(T("↵ open · esc close · /  toggle")) + "</div>",
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
    if (res) res.innerHTML = '<div class="gs-empty">' + escHtml(T("Start typing to search…")) + "</div>";
  }
  function close() {
    var root = document.getElementById(ROOT_ID);
    if (root) root.classList.remove("open");
  }

  function render(results) {
    var res = document.getElementById("cssos-global-search-results");
    if (!res) return;
    if (!results || !results.length) {
      res.innerHTML = '<div class="gs-empty">' + escHtml(T("No matches.")) + "</div>";
      return;
    }
    var groups = { person: [], mv: [], comment: [] };
    results.forEach(function (r) { (groups[r.type] || groups.person).push(r); });
    var html = "";
    function section(label, icon, rows) {
      if (!rows.length) return;
      html += '<div class="gs-group">' + escHtml(label) + "</div>";
      // CSSOS_WAVE_482 — 管理员可在人物搜索结果里【全平台置顶】该人物(如孔子), 之后搜索
      // 该文明/关键词时置顶人物先出。仅管理员、仅 person 行显示 📌。
      var _isAdmin = String((globalThis.authState && globalThis.authState.role) || "").toLowerCase() === "admin";
      rows.forEach(function (r) {
        var pinBtn = (_isAdmin && r.type === "person" && (r.person_id || r.id))
          ? '<button type="button" class="gs-pin" data-pin-person="' + escHtml(r.person_id || r.id) + '" title="' + escHtml(T("Pin this person platform-wide (admin)")) + '" aria-label="' + escHtml(T("Pin person platform-wide")) + '" style="margin-left:auto;flex:none;width:30px;height:30px;border-radius:999px;border:1px solid rgba(0,245,160,0.5);background:rgba(0,0,0,0.4);color:#9fffdf;cursor:pointer;font-size:14px;">📌</button>'
          : "";
        html += [
          '<div class="gs-row" data-type="' + escHtml(r.type) + '" data-id="' + escHtml(r.id) + '" data-person="' + escHtml(r.person_id || "") + '" data-mv-url="' + escHtml(r.mv_url || "") + '" style="display:flex;align-items:center;gap:10px;">',
          '  <div class="icon">' + icon + "</div>",
          '  <div class="body" style="flex:1;min-width:0;">',
          '    <div class="title">' + escHtml(r.title) + "</div>",
          '    <div class="snippet">' + escHtml(r.snippet) + "</div>",
          "  </div>",
          pinBtn,
          "</div>",
        ].join("");
      });
    }
    section(T("Persons"),  "👤", groups.person);
    section(T("MVs"),      "🎬", groups.mv);
    section(T("Comments"), "💬", groups.comment);
    res.innerHTML = html;
    // CSSOS_WAVE_482 — 人物置顶按钮(管理员): 点击调 /api/person-mv/:id/pin, 不触发打开 codex。
    Array.prototype.forEach.call(res.querySelectorAll("[data-pin-person]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var pid = btn.getAttribute("data-pin-person");
        if (!pid) return;
        btn.disabled = true;
        fetch("/api/person-mv/" + encodeURIComponent(pid) + "/pin", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: true }),
        }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
          .then(function (o) {
            if (o.r.status === 409) {
              if (typeof globalThis.showToast === "function") globalThis.showToast(T("You can pin at most " + (o.j.limit || 12) + " persons platform-wide."));
              btn.disabled = false; return;
            }
            if (o.r.ok) { btn.style.background = "rgba(0,245,160,0.28)"; btn.textContent = "✅"; btn.title = T("Pinned platform-wide"); }
            else btn.disabled = false;
          }).catch(function () { btn.disabled = false; });
      });
    });
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
    // CSSOS_WAVE_461 20260526 — Jing「骨架推广到搜索结果」: 结果到达前先铺统一骨架,
    // 让用户知道正在搜索; 失败则显示可读提示, 不再静默空白。
    var res = document.getElementById("cssos-global-search-results");
    if (res && typeof globalThis.cssosSkeletonListMarkup === "function") {
      res.innerHTML = globalThis.cssosSkeletonListMarkup(4, T("Searching…"));
    } else if (res) {
      res.innerHTML = '<div class="gs-empty">' + escHtml(T("Searching…")) + "</div>";
    }
    var reqQ = q.trim();
    fetch("/api/person-mv/search?q=" + encodeURIComponent(reqQ) + "&limit=20", {
      credentials: "same-origin",
    }).then(function (r) { return r.json(); }).then(function (j) {
      // Guard against out-of-order responses overwriting a newer query.
      var cur = document.querySelector("#" + ROOT_ID + " .gs-input");
      if (cur && cur.value && cur.value.trim() !== reqQ) return;
      if (j && j.ok) render(j.results || []);
      else { var e = document.getElementById("cssos-global-search-results"); if (e) e.innerHTML = '<div class="gs-empty">' + escHtml(T("No matches.")) + "</div>"; }
    }).catch(function () {
      var e = document.getElementById("cssos-global-search-results");
      if (e) e.innerHTML = '<div class="gs-empty">' + escHtml(T("Search failed. Try again.")) + "</div>";
    });
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
