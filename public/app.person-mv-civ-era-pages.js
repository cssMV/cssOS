/* CSSOS_PERSON_MV_WAVE72 20260508 — Jing
 *
 * Civilization + era discovery pages. Hash routes:
 *   #civ/{name}   — civilization detail (members + collective MVs)
 *   #era/{name}   — era detail (same shape)
 * Names are url-encoded — Chinese values like "中华文明" survive
 * round-tripping. The backend looks up by exact match (no slug
 * normalisation needed). Page renders into #cssos-civ-era-page,
 * a container that auto-mounts at the top of the document body.
 *
 * Strict project rules:
 *   - i18n: every visible string flows through tt(en, zh).
 *   - dual-theme: forest-green palette under html[data-theme="light"];
 *     pale-teal palette in dark theme.
 *   - no innerHTML with user content — civ/era names land via
 *     textContent, never interpolated into HTML.
 */
(function () {
  "use strict";

  function tt(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    return lang.indexOf("zh") === 0 && zh ? zh : en;
  }
  function isZh() {
    return (navigator.language || "en").toLowerCase().indexOf("zh") === 0;
  }
  function localizedName(p) {
    if (!p) return "";
    if (isZh()) return p.name_zh || p.name_en || p.person_id || "";
    return p.name_en || p.name_zh || p.person_id || "";
  }

  var STYLE_ID = "cssos-civ-era-page-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#cssos-civ-era-page{position:fixed;inset:0;z-index:9000;",
      "  background:rgba(8,16,12,0.96);color:#daffee;overflow:auto;",
      "  font-family:inherit;padding:48px 24px 64px;}",
      "#cssos-civ-era-page .cssos-cep-inner{max-width:1100px;margin:0 auto;}",
      "#cssos-civ-era-page .cssos-cep-close{position:fixed;top:16px;right:20px;",
      "  background:rgba(0,160,100,0.12);color:#daffee;border:1px solid #0a8;",
      "  border-radius:999px;padding:6px 14px;cursor:pointer;font-size:14px;}",
      "#cssos-civ-era-page h1{font-size:38px;margin:0 0 8px;color:#daffee;}",
      "#cssos-civ-era-page .cssos-cep-meta{opacity:0.75;margin-bottom:24px;}",
      "#cssos-civ-era-page h2{font-size:20px;margin:24px 0 12px;color:#daffee;}",
      "#cssos-civ-era-page .cssos-cep-grid{display:grid;",
      "  grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}",
      "#cssos-civ-era-page .cssos-cep-card{background:rgba(0,160,100,0.08);",
      "  border:1px solid rgba(0,160,100,0.25);border-radius:14px;padding:14px;",
      "  cursor:pointer;transition:transform 120ms ease, background 120ms ease;}",
      "#cssos-civ-era-page .cssos-cep-card:hover{transform:translateY(-2px);",
      "  background:rgba(0,160,100,0.16);}",
      "#cssos-civ-era-page .cssos-cep-card .cep-name{font-size:16px;font-weight:600;}",
      "#cssos-civ-era-page .cssos-cep-card .cep-sub{opacity:0.7;font-size:12px;margin-top:4px;}",
      "#cssos-civ-era-page .cssos-cep-empty{opacity:0.6;font-size:14px;}",
      /* Forest-green light-theme palette */
      "html[data-theme=\"light\"] #cssos-civ-era-page{",
      "  background:rgba(245,250,247,0.98);color:#0f3a2a;}",
      "html[data-theme=\"light\"] #cssos-civ-era-page h1,",
      "html[data-theme=\"light\"] #cssos-civ-era-page h2,",
      "html[data-theme=\"light\"] #cssos-civ-era-page .cssos-cep-close{color:#0f3a2a;}",
      "html[data-theme=\"light\"] #cssos-civ-era-page .cssos-cep-close{",
      "  background:rgba(0,160,100,0.10);border-color:#00a060;}",
      "html[data-theme=\"light\"] #cssos-civ-era-page .cssos-cep-card{",
      "  background:rgba(0,160,100,0.06);border-color:rgba(0,160,100,0.30);}",
      "html[data-theme=\"light\"] #cssos-civ-era-page .cssos-cep-card:hover{",
      "  background:rgba(0,160,100,0.14);}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // 统一空态(线4视觉内核): 有 helper 用统一卡片, 否则回退到原 .cssos-cep-empty 文字。
  function cepEmpty(icon, title, sub) {
    var ems = globalThis.cssosEmptyStateMarkup;
    if (ems) {
      var box = el("div", "cssos-cep-empty");
      box.innerHTML = ems({ icon: icon, title: title, sub: sub });
      return box;
    }
    return el("div", "cssos-cep-empty", title);
  }

  function getOrMakeRoot() {
    var root = document.getElementById("cssos-civ-era-page");
    if (root) return root;
    root = document.createElement("div");
    root.id = "cssos-civ-era-page";
    root.style.display = "none";
    document.body.appendChild(root);
    return root;
  }

  function show() {
    ensureStyle();
    var root = getOrMakeRoot();
    root.style.display = "block";
  }
  function hide() {
    var root = document.getElementById("cssos-civ-era-page");
    if (root) root.style.display = "none";
  }

  async function fetchJSON(url) {
    var r = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  function renderDetail(kind, payload) {
    var root = getOrMakeRoot();
    root.replaceChildren();
    var inner = el("div", "cssos-cep-inner");
    var close = el("button", "cssos-cep-close", tt("Close", "关闭"));
    close.addEventListener("click", function () {
      // Drop the hash route — fall back to the home route.
      try { history.replaceState(null, "", "#"); } catch (_e) {}
      hide();
    });
    root.appendChild(close);

    var emoji = kind === "civ" ? "🏛️" : "📜";
    var name = kind === "civ" ? payload.civ : payload.era;
    var h1 = el("h1");
    h1.textContent = emoji + "  " + name;
    inner.appendChild(h1);

    var meta = el("div", "cssos-cep-meta");
    meta.textContent =
      tt("Members", "成员") + ": " + (payload.person_count || 0) +
      "  ·  " + tt("MVs", "音乐影像") + ": " + (payload.mv_count || 0);
    inner.appendChild(meta);

    inner.appendChild(el("h2", null, tt("Top members", "重要人物")));
    var pgrid = el("div", "cssos-cep-grid");
    var persons = Array.isArray(payload.persons) ? payload.persons : [];
    if (!persons.length) {
      pgrid.appendChild(cepEmpty("👤", tt("No members yet.", "暂无成员。"), tt("Figures from this era will appear here.", "这个时代的人物会出现在这里。")));
    } else {
      persons.forEach(function (p) {
        var card = el("div", "cssos-cep-card");
        card.appendChild(el("div", "cep-name", localizedName(p)));
        var sub = [];
        if (p.era) sub.push(p.era);
        if (p.lifespan) sub.push(p.lifespan);
        if (typeof p.mv_count === "number") sub.push(tt("MVs", "MV") + ": " + p.mv_count);
        card.appendChild(el("div", "cep-sub", sub.join(" · ")));
        card.addEventListener("click", function () {
          location.hash = "#person-mv/" + encodeURIComponent(p.person_id);
          hide();
        });
        pgrid.appendChild(card);
      });
    }
    inner.appendChild(pgrid);

    inner.appendChild(el("h2", null, tt("Recent MVs", "最近作品")));
    var mgrid = el("div", "cssos-cep-grid");
    var mvs = Array.isArray(payload.mvs) ? payload.mvs : [];
    if (!mvs.length) {
      mgrid.appendChild(cepEmpty("🎬", tt("No MVs yet.", "暂无作品。"), tt("Be the first to create one for this era.", "来为这个时代创作第一支吧。")));
    } else {
      mvs.forEach(function (m) {
        var card = el("div", "cssos-cep-card");
        card.appendChild(el("div", "cep-name", isZh() ? (m.name_zh || m.name_en || "") : (m.name_en || m.name_zh || "")));
        var sub = [];
        if (typeof m.view_count === "number") sub.push("👁 " + m.view_count);
        if (typeof m.like_count === "number") sub.push("❤ " + m.like_count);
        if (m.scenario_seed) sub.push(String(m.scenario_seed).slice(0, 40));
        card.appendChild(el("div", "cep-sub", sub.join(" · ")));
        card.addEventListener("click", function () {
          location.hash = "#person-mv/" + encodeURIComponent(m.person_id) + "/mv/" + encodeURIComponent(m.mv_id);
          hide();
        });
        mgrid.appendChild(card);
      });
    }
    inner.appendChild(mgrid);

    root.appendChild(inner);
    show();
  }

  async function loadAndRender(kind, name) {
    show();
    try {
      var url = kind === "civ"
        ? "/api/person-mv/civs/" + encodeURIComponent(name)
        : "/api/person-mv/eras/" + encodeURIComponent(name);
      var j = await fetchJSON(url);
      if (!j.ok) throw new Error(j.code || "fetch_failed");
      renderDetail(kind, j.data || {});
    } catch (err) {
      var root = getOrMakeRoot();
      root.replaceChildren();
      var inner = el("div", "cssos-cep-inner");
      inner.appendChild(el("h1", null, tt("Failed to load", "加载失败")));
      inner.appendChild(el("div", "cssos-cep-meta", String(err && err.message || err)));
      var back = el("button", "cssos-cep-close", tt("Close", "关闭"));
      back.addEventListener("click", hide);
      root.appendChild(back);
      root.appendChild(inner);
    }
  }

  function parseHash() {
    var h = String(location.hash || "").replace(/^#/, "");
    var civ = h.match(/^civ\/(.+)$/);
    if (civ) return { kind: "civ", name: decodeURIComponent(civ[1]) };
    var era = h.match(/^era\/(.+)$/);
    if (era) return { kind: "era", name: decodeURIComponent(era[1]) };
    return null;
  }

  function onHash() {
    var p = parseHash();
    if (!p) { hide(); return; }
    loadAndRender(p.kind, p.name);
  }

  window.addEventListener("hashchange", onHash);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onHash, { once: true });
  } else {
    onHash();
  }

  /* Public hook: any caller (codex breadcrumb, person card chip)
   * can fire `cssos-civ-era-open` with detail={kind,name} to open
   * this page without mutating the URL bar. */
  window.addEventListener("cssos-civ-era-open", function (ev) {
    var d = ev && ev.detail || {};
    if (!d.kind || !d.name) return;
    location.hash = "#" + d.kind + "/" + encodeURIComponent(d.name);
  });
})();
