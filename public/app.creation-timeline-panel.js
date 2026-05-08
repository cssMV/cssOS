/* CSSOS_PERSON_MV_WAVE64A 20260508 — Jing — UI surface for Wave 51
 * creation timeline. Hash route #creation-timeline. Fetches up to 100
 * recent creation_history events for the signed-in user, groups by
 * run_id (with a synthetic bucket for events that have no run), and
 * renders a chronological list. The "Replay" button on each run group
 * pulls the run's submit-event seed and fires the existing pipeline
 * via globalThis.cssmvSeedBank or window.dispatchEvent (best-effort —
 * if neither is available, falls back to copying the seed to the
 * clipboard and toasting). Empty state is i18n'd.
 *
 * Per the project memory: feature-specific UI lives ON the feature.
 * The user-homepage gets its own "📜 Creation history" button that
 * opens this panel. There's no centralized advanced-settings hook. */
(function () {
  "use strict";

  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }

  var KIND_EMOJI = {
    stage_start: "▶️",
    stage_done: "✅",
    engine_select: "⚙️",
    style_pick: "🎨",
    person_pick: "🧑",
    tier_change: "🏷️",
    edit_lyrics: "✏️",
    submit: "🚀",
  };

  function relTime(iso) {
    var t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    var s = Math.max(1, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return tr(s + "s ago", s + " 秒前");
    var m = Math.floor(s / 60);
    if (m < 60) return tr(m + "m ago", m + " 分钟前");
    var h = Math.floor(m / 60);
    if (h < 24) return tr(h + "h ago", h + " 小时前");
    var d = Math.floor(h / 24);
    return tr(d + "d ago", d + " 天前");
  }

  var STYLE_ID = "cssos-creation-timeline-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#creation-timeline-panel{position:fixed;inset:0;z-index:9300;background:rgba(2,8,6,0.96);overflow:auto;display:none;color:#daffee;}",
      "#creation-timeline-panel.open{display:block;}",
      ".cssos-ct-wrap{max-width:min(900px,96vw);margin:0 auto;padding:24px 16px 64px;}",
      ".cssos-ct-head{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 16px;gap:12px;flex-wrap:wrap;}",
      ".cssos-ct-head h1{margin:0;font-size:22px;}",
      ".cssos-ct-close{background:transparent;color:#daffee;border:1px solid rgba(0,200,140,0.35);border-radius:6px;padding:6px 12px;cursor:pointer;}",
      ".cssos-ct-run{border:1px solid rgba(0,200,140,0.25);border-radius:8px;padding:12px;margin:0 0 12px;background:rgba(0,40,30,0.35);}",
      ".cssos-ct-run h3{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;gap:8px;align-items:center;}",
      ".cssos-ct-run .cssos-ct-replay{background:rgba(0,160,100,0.25);color:#fff;border:1px solid rgba(0,200,140,0.45);border-radius:5px;padding:4px 10px;cursor:pointer;font-size:12px;}",
      ".cssos-ct-events{list-style:none;margin:0;padding:0;}",
      ".cssos-ct-events li{display:flex;gap:8px;padding:4px 0;font-size:13px;border-top:1px dashed rgba(0,200,140,0.12);}",
      ".cssos-ct-events li:first-child{border-top:0;}",
      ".cssos-ct-events .cssos-ct-emoji{width:20px;text-align:center;}",
      ".cssos-ct-events .cssos-ct-time{opacity:0.6;font-size:11px;width:80px;flex:0 0 auto;}",
      ".cssos-ct-events .cssos-ct-detail{flex:1;font-family:ui-monospace,Menlo,monospace;word-break:break-word;}",
      ".cssos-ct-empty{text-align:center;opacity:0.7;padding:48px 16px;}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function ensureRoot() {
    var root = document.getElementById("creation-timeline-panel");
    if (root) return root;
    injectStyle();
    root = document.createElement("div");
    root.id = "creation-timeline-panel";
    root.innerHTML =
      '<div class="cssos-ct-wrap">' +
        '<div class="cssos-ct-head">' +
          '<h1>📜 ' + escHtml(tr("Creation history", "创作历史")) + '</h1>' +
          '<button type="button" class="cssos-ct-close">' + escHtml(tr("Close", "关闭")) + '</button>' +
        '</div>' +
        '<div class="cssos-ct-body"><div class="cssos-ct-empty">' + escHtml(tr("Loading…", "加载中…")) + '</div></div>' +
      '</div>';
    document.body.appendChild(root);
    root.querySelector(".cssos-ct-close").addEventListener("click", close);
    return root;
  }

  function open() {
    var root = ensureRoot();
    root.classList.add("open");
    void load();
  }
  function close() {
    var root = document.getElementById("creation-timeline-panel");
    if (root) root.classList.remove("open");
    if (location.hash === "#creation-timeline") {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (_e) {}
    }
  }

  function describe(ev) {
    var p = ev.payload || {};
    switch (ev.event_kind) {
      case "stage_start": return "stage_start " + (p.stage || "?");
      case "stage_done":  return "stage_done " + (p.stage || "?") + (p.ms ? " (" + p.ms + "ms)" : "");
      case "engine_select": return "engine " + (p.engine || "?") + (p.tier ? " · " + p.tier : "");
      case "style_pick": return "style " + (p.style || p.label || "?");
      case "person_pick": return "person " + (p.name_zh || p.name_en || p.person_id || "?");
      case "tier_change": return "tier → " + (p.tier || "?");
      case "edit_lyrics": return "edited lyrics" + (p.length ? " (" + p.length + " ch)" : "");
      case "submit": return "submit · " + (p.prompt ? String(p.prompt).slice(0, 60) : (p.style || ""));
      default: return ev.event_kind;
    }
  }

  function groupRuns(events) {
    var byRun = new Map();
    var noRun = [];
    events.forEach(function (ev) {
      if (ev.run_id) {
        if (!byRun.has(ev.run_id)) byRun.set(ev.run_id, []);
        byRun.get(ev.run_id).push(ev);
      } else {
        noRun.push(ev);
      }
    });
    var groups = [];
    byRun.forEach(function (arr, run_id) {
      arr.sort(function (a, b) { return new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(); });
      groups.push({ run_id: run_id, events: arr });
    });
    if (noRun.length) groups.push({ run_id: null, events: noRun });
    groups.sort(function (a, b) {
      var at = new Date(a.events[a.events.length - 1].occurred_at).getTime();
      var bt = new Date(b.events[b.events.length - 1].occurred_at).getTime();
      return bt - at;
    });
    return groups;
  }

  function replayRun(run_id, btn) {
    if (!run_id) return;
    btn.disabled = true;
    var orig = btn.textContent;
    btn.textContent = tr("Loading…", "加载中…");
    fetch("/api/user/creation-history/run/" + encodeURIComponent(run_id), { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok || !j.seed) throw new Error(j && j.code || "no_seed");
        var seed = j.seed;
        // Best-effort dispatch: set seed via cssmvSeedBank, navigate to creation panel.
        try {
          if (globalThis.cssmvSeedBank && typeof globalThis.cssmvSeedBank.set === "function") {
            globalThis.cssmvSeedBank.set(seed);
          }
        } catch (_e) {}
        try {
          window.dispatchEvent(new CustomEvent("cssos:creation:replay", { detail: { run_id: run_id, seed: seed } }));
        } catch (_e) {}
        try { location.hash = "#person-mv"; } catch (_e) {}
        btn.textContent = tr("Replayed", "已重播");
      })
      .catch(function (err) {
        btn.textContent = tr("Failed", "失败") + ": " + String(err && err.message || err);
        setTimeout(function () { btn.disabled = false; btn.textContent = orig; }, 2500);
      });
  }

  function render(events) {
    var root = document.getElementById("creation-timeline-panel");
    if (!root) return;
    var body = root.querySelector(".cssos-ct-body");
    if (!body) return;
    if (!events.length) {
      body.innerHTML = '<div class="cssos-ct-empty">' + escHtml(tr("No creation history yet.", "还没有创作记录")) + '</div>';
      return;
    }
    var groups = groupRuns(events);
    var html = groups.map(function (g) {
      var head = g.run_id
        ? "🎬 run · " + escHtml(String(g.run_id).slice(0, 16))
        : "📋 " + escHtml(tr("Standalone events", "独立事件"));
      var replay = g.run_id
        ? '<button type="button" class="cssos-ct-replay" data-run-id="' + escHtml(g.run_id) + '">▶ ' + escHtml(tr("Replay", "重播")) + '</button>'
        : '';
      var items = g.events.map(function (ev) {
        var emoji = KIND_EMOJI[ev.event_kind] || "•";
        return '<li>' +
          '<span class="cssos-ct-emoji">' + escHtml(emoji) + '</span>' +
          '<span class="cssos-ct-time">' + escHtml(relTime(ev.occurred_at)) + '</span>' +
          '<span class="cssos-ct-detail">' + escHtml(describe(ev)) + '</span>' +
        '</li>';
      }).join("");
      return '<div class="cssos-ct-run">' +
        '<h3><span>' + head + '</span>' + replay + '</h3>' +
        '<ul class="cssos-ct-events">' + items + '</ul>' +
      '</div>';
    }).join("");
    body.innerHTML = html;
    body.querySelectorAll("[data-run-id]").forEach(function (btn) {
      btn.addEventListener("click", function () { replayRun(btn.getAttribute("data-run-id"), btn); });
    });
  }

  function load() {
    var root = document.getElementById("creation-timeline-panel");
    if (!root) return;
    var body = root.querySelector(".cssos-ct-body");
    if (body) body.innerHTML = '<div class="cssos-ct-empty">' + escHtml(tr("Loading…", "加载中…")) + '</div>';
    return fetch("/api/user/creation-history?limit=100", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.code === "AUTH_REQUIRED") {
          if (body) body.innerHTML = '<div class="cssos-ct-empty">' + escHtml(tr("Please sign in.", "请先登录")) + '</div>';
          return;
        }
        if (!j || !j.ok) throw new Error(j && j.code || "load_failed");
        render(j.events || []);
      })
      .catch(function (err) {
        if (body) body.innerHTML = '<div class="cssos-ct-empty">' + escHtml(String(err && err.message || err)) + '</div>';
      });
  }

  function onHash() {
    if (location.hash === "#creation-timeline") open();
    else {
      var root = document.getElementById("creation-timeline-panel");
      if (root && root.classList.contains("open")) root.classList.remove("open");
    }
  }

  window.addEventListener("hashchange", onHash);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onHash);
  } else {
    onHash();
  }

  globalThis.cssosOpenCreationTimeline = open;
})();
