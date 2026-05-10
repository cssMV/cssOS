/* CSSOS_PERSON_MV_PANEL 20260507 — Jing
 *
 * Wave 1 of the "人物文明 MV 宇宙" — independent panel that lists
 * curated personality profiles with tier-based ordering, civ filter,
 * and full-text search. Wave 2 wires "create MV for X" → MV PIPELINE.
 *
 *   Tier 1 (default) — by influence_score DESC
 *   Tier 2          — grouped by civilization, then influence
 *   Search         — fuzzy across name_zh / name_en / civ / theme
 *
 * Self-mounts a dock item 🏛️ next to MV / Notifications.
 */
(function () {
  "use strict";

  function tt(en, zh) {
    /* Prefer the runtime i18n translator when available so non-EN/
     * non-ZH locales also flow through the LLM dict. Fall back to
     * naive locale check for EN/ZH only. */
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    return lang.indexOf("zh") === 0 && zh ? zh : en;
  }
  function currentLocale() {
    var c = String(globalThis.currentLocale || navigator.language || "en").toLowerCase();
    return c;
  }
  /* Pick the user-locale-appropriate name. ZH locales → name_zh;
   * everything else → name_en (or name_zh as last resort). Future
   * Wave 4 will let users contribute name translations per locale. */
  function localizedName(p) {
    var loc = currentLocale();
    if (loc.indexOf("zh") === 0) return p.name_zh || p.name_en || p.person_id;
    return p.name_en || p.name_zh || p.person_id;
  }
  /* Secondary line — opposite of the primary line so the user sees
   * both names but the localised one is emphasised. Empty if both
   * primary and secondary collapse to the same string. */
  function secondaryName(p) {
    var loc = currentLocale();
    var primary = localizedName(p);
    var alt = loc.indexOf("zh") === 0 ? (p.name_en || "") : (p.name_zh || "");
    return alt && alt !== primary ? alt : "";
  }

  var panelEl = null;
  var state = {
    tier: 1,             // 1 = influence; 2 = civilization
    /* CSSOS_WAVE_110B 20260510 — Jing
     * Default to "all" so the panel lands on the full layered view
     * (Hall + Notable + Contemporary + Compendium + User Creations).
     * Previously S-only meant users only ever saw 22-37 cards on
     * first open and assumed the rest were missing. */
    curationTier: "all", // S | A | B | all
    civ: "",
    search: "",
    persons: [],
    loading: false,
  };

  function ensureStyles() {
    if (document.getElementById("cssos-person-mv-style")) return;
    var s = document.createElement("style");
    s.id = "cssos-person-mv-style";
    s.textContent =
      "#person-mv-panel .person-mv-toolbar{" +
        "display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;align-items:center;" +
        "border-bottom:1px solid rgba(0,245,160,0.18);" +
      "}" +
      "#person-mv-panel .person-mv-search{" +
        "flex:1 1 200px;background:rgba(8,18,16,0.55);" +
        "border:1px solid rgba(0,245,160,0.18);border-radius:8px;" +
        "padding:6px 10px;color:#daffee;font:500 12px/1.2 ui-monospace,monospace;" +
      "}" +
      "#person-mv-panel .person-mv-tier-btn{" +
        "all:unset;cursor:pointer;padding:6px 12px;border-radius:8px;" +
        "background:rgba(0,245,160,0.08);" +
        "border:1px solid rgba(0,245,160,0.22);" +
        "color:#daffee;font:600 11px/1 ui-monospace,monospace;letter-spacing:.04em;" +
      "}" +
      "#person-mv-panel .person-mv-tier-btn.is-active{" +
        "background:rgba(0,245,160,0.85);color:#001b14;" +
      "}" +
      "#person-mv-panel .person-mv-civ-select{" +
        "background:rgba(8,18,16,0.55);border:1px solid rgba(0,245,160,0.18);" +
        "border-radius:8px;padding:6px 10px;color:#daffee;" +
        "font:500 12px/1.2 ui-monospace,monospace;" +
      "}" +
      "#person-mv-panel .person-mv-grid{" +
        "display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));" +
        "gap:10px;padding:12px;" +
      "}" +
      "#person-mv-panel .person-mv-card{" +
        "background:rgba(8,18,16,0.55);" +
        "border:1px solid rgba(0,245,160,0.18);" +
        "border-radius:12px;padding:12px;cursor:pointer;" +
        "transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;" +
        "display:flex;flex-direction:column;gap:6px;color:#daffee;" +
      "}" +
      "#person-mv-panel .person-mv-card:hover{" +
        "transform:translateY(-2px);border-color:rgba(0,245,160,0.55);" +
        "box-shadow:0 8px 22px rgba(0,0,0,0.35);" +
      "}" +
      "#person-mv-panel .person-mv-name{font:700 16px/1.2 -apple-system,system-ui,sans-serif;}" +
      "#person-mv-panel .person-mv-name-en{font:500 11px/1 ui-monospace,monospace;color:rgba(218,255,238,0.65);}" +
      "#person-mv-panel .person-mv-meta{font:500 10px/1.3 ui-monospace,monospace;color:rgba(0,245,160,0.7);letter-spacing:.04em;}" +
      "#person-mv-panel .person-mv-theme{font:400 11px/1.4 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,0.78);}" +
      "#person-mv-panel .person-mv-counts{display:flex;justify-content:space-between;align-items:center;font:500 10px/1 ui-monospace,monospace;color:rgba(218,255,238,0.55);margin-top:4px;}" +
      "#person-mv-panel .person-mv-empty{padding:60px 12px;text-align:center;color:rgba(218,255,238,0.55);}" +
      "#person-mv-panel .person-mv-card *{pointer-events:none;}" +

      /* CSSOS_WAVE_109_THREE_TIER 20260509 — Jing
       * Three-tier display: Hall of Fame (S) → Notable (A) → Compendium (B/C). */
      "#person-mv-panel .pmv-tier-section{padding:0 12px 14px;}" +
      "#person-mv-panel .pmv-tier-head{" +
        "display:flex;align-items:baseline;justify-content:space-between;" +
        "padding:14px 4px 8px;" +
        "border-bottom:1px solid rgba(0,245,160,0.12);margin-bottom:10px;" +
      "}" +
      "#person-mv-panel .pmv-tier-title{font:700 14px/1.2 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,0.95);letter-spacing:.04em;}" +
      "#person-mv-panel .pmv-tier-count{font:500 11px/1 ui-monospace,monospace;color:rgba(0,245,160,0.7);}" +

      /* CSSOS_WAVE_109B 20260509 — Jing
       * Vertical portrait cards for both Hall (180×240) AND Notable
       * (160×220) when a portrait_url is available. Only Notable
       * persons WITHOUT a portrait fall back to the text-only
       * .person-mv-card style. */
      "#person-mv-panel .pmv-hall-grid{" +
        "display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));" +
        "gap:12px;" +
      "}" +
      "#person-mv-panel .pmv-notable-grid{" +
        "display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));" +
        "gap:10px;" +
      "}" +
      /* Shared card chrome — both .pmv-hall-card and .pmv-portrait-card use it. */
      "#person-mv-panel .pmv-hall-card,#person-mv-panel .pmv-portrait-card{" +
        "position:relative;border-radius:14px;overflow:hidden;" +
        "background:rgba(8,18,14,0.6);border:1px solid rgba(0,245,160,0.22);" +
        "cursor:pointer;transition:transform .15s ease, border-color .15s ease;" +
      "}" +
      "#person-mv-panel .pmv-hall-card{height:240px;}" +
      "#person-mv-panel .pmv-portrait-card{height:220px;}" +
      "#person-mv-panel .pmv-hall-card:hover,#person-mv-panel .pmv-portrait-card:hover{transform:translateY(-3px);border-color:rgba(0,245,160,0.6);}" +
      /* CSSOS_WAVE_109B_NO_DISTORT 20260509 — Jing
       * NEVER distort portraits. `background-size: cover` only crops,
       * never stretches. `background-position: center 28%` biases the
       * crop toward the upper portion where faces typically sit (and
       * if source is wider than 3:4, the sides crop equally — face
       * stays centered). Do not switch to `fill` or to `<img>` with
       * `object-fit: fill` — both would squash the figure. */
      "#person-mv-panel .pmv-hall-card .cover,#person-mv-panel .pmv-portrait-card .cover{" +
        "position:absolute;inset:0;background-size:cover;background-position:center 28%;background-repeat:no-repeat;" +
      "}" +
      "#person-mv-panel .pmv-hall-card .cover.fallback,#person-mv-panel .pmv-portrait-card .cover.fallback{" +
        "display:flex;align-items:center;justify-content:center;font-size:54px;" +
      "}" +
      "#person-mv-panel .pmv-hall-card .cover::after,#person-mv-panel .pmv-portrait-card .cover::after{" +
        "content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,0.85) 100%);" +
      "}" +
      "#person-mv-panel .pmv-hall-card .info,#person-mv-panel .pmv-portrait-card .info{" +
        "position:absolute;left:12px;right:12px;bottom:10px;color:#daffee;text-shadow:0 1px 4px rgba(0,0,0,0.85);" +
      "}" +
      "#person-mv-panel .pmv-hall-card .name{font:700 16px/1.2 -apple-system,system-ui,sans-serif;}" +
      "#person-mv-panel .pmv-portrait-card .name{font:700 14px/1.2 -apple-system,system-ui,sans-serif;}" +
      "#person-mv-panel .pmv-hall-card .name-en,#person-mv-panel .pmv-portrait-card .name-en{font:500 11px/1.2 ui-monospace,monospace;color:rgba(218,255,238,0.7);margin-top:1px;}" +
      "#person-mv-panel .pmv-hall-card .meta,#person-mv-panel .pmv-portrait-card .meta{font:500 10px/1.3 ui-monospace,monospace;color:rgba(0,245,160,0.85);letter-spacing:.04em;margin-top:4px;}" +
      "#person-mv-panel .pmv-hall-card *,#person-mv-panel .pmv-portrait-card *{pointer-events:none;}" +

      /* Tier 3 — Compendium: compact rows in a 4-column responsive grid. */
      "#person-mv-panel .pmv-compendium-grid{" +
        "display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px 14px;" +
      "}" +
      "#person-mv-panel .pmv-compendium-row{" +
        "padding:8px 10px;border-radius:8px;cursor:pointer;" +
        "background:rgba(8,18,14,0.4);border:1px solid rgba(0,245,160,0.10);" +
        "color:#daffee;display:flex;flex-direction:column;gap:2px;" +
        "transition:border-color .12s ease, background .12s ease;" +
      "}" +
      "#person-mv-panel .pmv-compendium-row:hover{background:rgba(8,28,20,0.6);border-color:rgba(0,245,160,0.4);}" +
      "#person-mv-panel .pmv-compendium-row .row-name{font:600 13px/1.2 -apple-system,system-ui,sans-serif;}" +
      "#person-mv-panel .pmv-compendium-row .row-meta{font:500 10px/1.2 ui-monospace,monospace;color:rgba(0,245,160,0.7);}" +
      "#person-mv-panel .pmv-compendium-row *{pointer-events:none;}" +
      "#person-mv-panel .pmv-compendium-skel{padding:24px;text-align:center;color:rgba(218,255,238,0.5);font:500 12px/1.4 -apple-system,system-ui,sans-serif;}" +

      /* CSSOS_WAVE_109G 20260509 — Jing
       * Edit/delete actions for user-created cards. Sits at the
       * top-right of the card, above the cover. Stops click
       * propagation so it doesn't trigger card.onclick (codex open). */
      "#person-mv-panel .pmv-user-actions{" +
        "position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:5;" +
      "}" +
      "#person-mv-panel .pmv-user-action-btn{" +
        "width:28px;height:28px;border-radius:50%;" +
        "background:rgba(8,18,14,0.78);" +
        "backdrop-filter:blur(8px) saturate(140%);" +
        "-webkit-backdrop-filter:blur(8px) saturate(140%);" +
        "border:1px solid rgba(255,255,255,0.18);" +
        "color:rgba(255,255,255,0.85);" +
        "font:500 13px/1 -apple-system,system-ui,sans-serif;" +
        "cursor:pointer;display:flex;align-items:center;justify-content:center;" +
        "transition: border-color .15s ease, background .15s ease, transform .15s ease;" +
        "pointer-events:auto;" +
      "}" +
      "#person-mv-panel .pmv-user-action-btn:hover{" +
        "border-color:rgba(255,255,255,0.55);background:rgba(8,30,20,0.92);transform:scale(1.06);" +
      "}" +
      "#person-mv-panel .pmv-user-action-btn.danger:hover{" +
        "border-color:rgba(255,80,80,0.7);background:rgba(60,10,10,0.85);" +
      "}" +
      /* On text cards, give space at top-right so the buttons don't
       * sit on top of the name. */
      "#person-mv-panel .person-mv-card.has-user-actions{padding-top:36px;}" +
      "#person-mv-panel .panel-actions .icon-btn{pointer-events:auto !important;cursor:pointer;}" +
      /* Bulletproof hide — when .hidden is on, no clicks. */
      "#person-mv-panel.hidden{display:none !important;pointer-events:none !important;}" +
      /* CSSOS_WAVE_109C 20260509 — Jing
       * Default the panel wider so the multi-column tier grids
       * actually have room to flow. Resize handles can shrink it
       * back if the user wants. min-width prevents collapse below
       * a 3-column comfortable width. */
      "#person-mv-panel{width:min(92vw, 1280px) !important; min-width:min(92vw, 720px);}" +
      "#person-mv-panel .person-mv-create-anybody{" +
        "margin:12px;padding:14px;border-radius:10px;" +
        "background:rgba(0,245,160,0.10);border:1px dashed rgba(0,245,160,0.45);" +
        "text-align:center;cursor:pointer;color:#daffee;" +
        "font:600 13px/1.3 -apple-system,system-ui,sans-serif;" +
      "}" +
      "#person-mv-panel .person-mv-create-anybody:hover{" +
        "background:rgba(0,245,160,0.18);" +
      "}" +
      "#person-mv-panel .person-mv-random-btn{" +
        "all:unset;cursor:pointer;padding:6px 10px;border-radius:8px;" +
        "background:rgba(0,245,160,0.12);border:1px solid rgba(0,245,160,0.3);" +
        "color:#daffee;font:600 14px/1 ui-monospace,monospace;" +
      "}" +
      "#person-mv-panel .person-mv-random-btn:hover{background:rgba(0,245,160,0.25);}" +
      "#person-mv-panel .person-mv-adhoc-cta{" +
        "margin:18px auto;max-width:460px;padding:18px;border-radius:12px;" +
        "background:rgba(0,245,160,0.10);border:1px dashed rgba(0,245,160,0.55);" +
        "text-align:center;cursor:pointer;color:#daffee;" +
        "font:700 14px/1.4 -apple-system,system-ui,sans-serif;" +
      "}" +
      "#person-mv-panel .person-mv-adhoc-cta:hover{background:rgba(0,245,160,0.18);}" +
      /* CSSOS_PERSON_MV_LIGHT_THEME 20260508 — Jing
       * Light-theme contrast pass. Pale teal #daffee on cream bg = invisible.
       * Override to forest-green (#0f3a2a / #1a5040) so text stays legible
       * on light surfaces. Backgrounds bumped from 0.08-0.55 to opaque
       * teal-tint so cards/buttons read clearly in both themes. */
      "html[data-theme=\"light\"] #person-mv-panel .person-mv-search,html[data-theme=\"light\"] #person-mv-panel .person-mv-civ-select{background:rgba(0,40,30,0.06);color:#0f3a2a;border-color:rgba(0,160,100,0.45);}" +
      "html[data-theme=\"light\"] #person-mv-panel .person-mv-search::placeholder{color:rgba(15,58,42,0.55);}" +
      "html[data-theme=\"light\"] #person-mv-panel .person-mv-tier-btn{background:rgba(0,160,100,0.10);color:#0f3a2a;border-color:rgba(0,160,100,0.45);}" +
      "html[data-theme=\"light\"] #person-mv-panel .person-mv-tier-btn.is-active{background:#00a060;color:#fff;}" +
      "html[data-theme=\"light\"] #person-mv-panel .person-mv-card{background:rgba(0,40,30,0.04);color:#0f3a2a;border-color:rgba(0,160,100,0.35);}" +
      "html[data-theme=\"light\"] #person-mv-panel .person-mv-name-en,html[data-theme=\"light\"] #person-mv-panel .person-mv-theme,html[data-theme=\"light\"] #person-mv-panel .person-mv-counts,html[data-theme=\"light\"] #person-mv-panel .person-mv-empty{color:rgba(15,58,42,0.75);}" +
      "html[data-theme=\"light\"] #person-mv-panel .person-mv-meta{color:#00a060;}" +
      "html[data-theme=\"light\"] #person-mv-panel .person-mv-create-anybody,html[data-theme=\"light\"] #person-mv-panel .person-mv-adhoc-cta{background:rgba(0,160,100,0.08);color:#0f3a2a;border-color:rgba(0,160,100,0.55);}" +
      "html[data-theme=\"light\"] #person-mv-panel .person-mv-random-btn{background:rgba(0,160,100,0.15);color:#0f3a2a;border-color:rgba(0,160,100,0.5);}" +
      "#person-mv-panel .person-mv-adhoc-cta.is-busy{opacity:.6;pointer-events:none;}" +
      ".pmv-leaderboard{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:8px 10px;margin-bottom:10px;border-radius:10px;background:rgba(0,245,160,.08);border:1px solid rgba(0,245,160,.22);font:600 12px/1.3 ui-monospace,monospace;color:#bff5dc;}" +
      ".pmv-leaderboard .pmv-lb-creator{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.25);}" +
      ".pmv-leaderboard .pmv-lb-avatar{width:20px;height:20px;border-radius:50%;background:#013b2c;background-size:cover;background-position:center;display:inline-block;}" +
      ".pmv-codex .pmv-mv-creator{position:absolute;top:6px;left:6px;display:flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;background:rgba(0,0,0,.55);font:600 10px/1.2 ui-monospace,monospace;color:#daffee;}" +
      ".pmv-codex .pmv-mv-creator-avatar{width:16px;height:16px;border-radius:50%;background:#013b2c;background-size:cover;background-position:center;display:inline-block;}" +
      ".pmv-compare-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:24px;}" +
      ".pmv-compare-modal .pmv-compare-card{width:min(1100px,98vw);max-height:92vh;overflow:auto;background:#02100c;border:1px solid rgba(0,245,160,.4);border-radius:14px;color:#daffee;}" +
      ".pmv-compare-modal .pmv-compare-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(0,245,160,.18);}" +
      ".pmv-compare-modal .pmv-compare-body{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px;}" +
      ".pmv-compare-modal .pmv-compare-pane{background:rgba(8,18,16,.55);border:1px solid rgba(0,245,160,.18);border-radius:10px;padding:12px;}" +
      ".pmv-compare-modal .pmv-compare-pane h4{margin:0 0 6px;font:700 16px/1.2 ui-serif,serif;}" +
      ".pmv-compare-modal .pmv-compare-pane h5{margin:10px 0 4px;font:700 11px/1 ui-monospace,monospace;color:#00f5a0;letter-spacing:.06em;}" +
      ".pmv-compare-modal .pmv-compare-pane ul{margin:0;padding-left:16px;font:500 12px/1.5 ui-serif,serif;}" +
      ".pmv-compare-modal .pmv-compare-search{display:flex;gap:8px;margin-bottom:10px;}" +
      ".pmv-compare-modal .pmv-compare-search input{flex:1;background:rgba(8,18,16,.55);border:1px solid rgba(0,245,160,.18);border-radius:8px;padding:6px 10px;color:#daffee;font:500 12px/1.2 ui-monospace,monospace;}" +
      ".pmv-compare-modal .pmv-compare-presets{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}" +
      ".pmv-compare-modal .pmv-compare-preset{cursor:pointer;padding:4px 10px;border-radius:999px;background:rgba(0,245,160,.1);border:1px solid rgba(0,245,160,.3);font:600 11px/1.2 ui-monospace,monospace;color:#daffee;}" +
      ".pmv-compare-modal .pmv-compare-results{display:flex;flex-direction:column;gap:4px;max-height:240px;overflow:auto;}" +
      ".pmv-compare-modal .pmv-compare-result{cursor:pointer;padding:6px 8px;border-radius:6px;background:rgba(0,245,160,.06);border:1px solid rgba(0,245,160,.15);}" +
      ".pmv-compare-modal .pmv-compare-result:hover{background:rgba(0,245,160,.18);}" +
      ".pmv-compare-modal .pmv-compare-close{cursor:pointer;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:4px 10px;color:#daffee;font:600 12px/1 ui-monospace,monospace;}";
    document.head.appendChild(s);
  }

  /* Register our action with the external dock-action map BEFORE
   * the dispatcher runs. handleDockAction(action, type) checks
   * globalThis.__cssosDockActionMap first; built-in switch is
   * fallback. Registering "person-mv" here lets the standard
   * dispatch path open our panel without needing to win an event
   * race. */
  function registerDockAction() {
    try {
      globalThis.__cssosDockActionMap = globalThis.__cssosDockActionMap || {};
      globalThis.__cssosDockActionMap["person-mv"] = {
        click: function () { open(); },
        dblclick: function () {
          open();
          var p = ensurePanel();
          if (typeof globalThis.togglePanelMaximize === "function") {
            try { globalThis.togglePanelMaximize(p); } catch (_e) {}
          }
        },
        longpress: function () { open(); },
      };
    } catch (_e) {}
  }

  function ensureDockItem() {
    var dock = document.querySelector(".dock");
    if (!dock) return false;
    if (dock.querySelector('.dock-item[data-action="person-mv"]')) return true;
    var item = document.createElement("div");
    item.className = "dock-item";
    item.setAttribute("data-action", "person-mv");
    item.setAttribute("data-actions", "click,dblclick,longpress");
    item.tabIndex = 0;
    /* CSSOS_PERSON_MV_NODRAG 20260507 — Jing
     * The dock-order module adds draggable="true" + sets the
     * webkit-user-drag inline style on every dock-item it sees,
     * which makes pointerdown initiate a drag instead of firing
     * click. We don't want our icon to be drag-reorderable for
     * v1 — it's a fixed entry. Force draggable off and watch via
     * MutationObserver so any later attempt to flip it back gets
     * clobbered. */
    item.draggable = false;
    item.setAttribute("draggable", "false");
    item.style.webkitUserDrag = "none";
    item.style.userSelect = "none";
    item.innerHTML =
      '<div class="dock-icon">🏛</div>' +
      '<div class="dock-label">' + (tt("People MV", "人物MV")) + '</div>';
    /* Cancel native dragstart so even if some module sets
     * draggable=true later, the OS won't initiate a drag. This is
     * cheaper than a MutationObserver loop and can't recurse. */
    item.addEventListener("dragstart", function (e) {
      e.preventDefault();
      e.stopPropagation();
    }, true);
    /* Periodically re-assert draggable=false (3s ticks for 60s)
     * so dock-order can't permanently flip it. After 60s anything
     * that wanted to re-enable has long since fired. */
    var nodragTries = 0;
    var nodragTimer = setInterval(function () {
      if (item.getAttribute("draggable") !== "false") {
        item.setAttribute("draggable", "false");
      }
      if (item.style && item.style.webkitUserDrag !== "none") {
        item.style.webkitUserDrag = "none";
      }
      nodragTries += 1;
      if (nodragTries > 20) clearInterval(nodragTimer);
    }, 3000);
    /* CSSOS_PERSON_MV_DIRECT_V2 20260507 — Jing
     * Bug from previous attempt: pointerup.preventDefault() told
     * the browser "don't generate click after this", which then
     * silenced our own click listener too — locking the dock
     * permanently. This version:
     *   - pointerup: NO preventDefault (we just open + dedupe)
     *   - click:    full open + stop everything else from racing
     *   - keydown:  Enter/Space accessibility
     * 250ms dedupe so the pointerup → click chain doesn't fire
     * twice for the same tap.
     */
    var lastFire = 0;
    function fireOpen(label, e) {
      var now = Date.now();
      if (now - lastFire < 250) return;
      lastFire = now;
      console.info("[person-mv] dock fire via", label);
      try { open(); } catch (err) { console.warn("[person-mv] open threw", err); }
    }
    item.addEventListener("pointerup", function (e) {
      if (e.button && e.button !== 0) return;
      fireOpen("pointerup");
    }, false);
    item.addEventListener("click", function (e) {
      fireOpen("click", e);
      try { e.preventDefault(); e.stopPropagation(); } catch (_e) {}
    }, false);
    item.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        fireOpen("keydown");
        try { e.preventDefault(); } catch (_e) {}
      }
    });
    // Insert just after MV PIPELINE (or at beginning).
    var anchor = dock.querySelector('.dock-item[data-action="mv-pipeline"]')
              || dock.querySelector('.dock-item[data-action="watch"]');
    if (anchor && anchor.nextSibling) dock.insertBefore(item, anchor.nextSibling);
    else dock.appendChild(item);
    return true;
  }

  /* Aggressively poll for first 12s so we catch the dock no matter
   * when it lands. After that the MutationObserver fallback covers
   * later mutations. */
  function pollDockInsertion() {
    var attempts = 0;
    var tick = function () {
      if (ensureDockItem()) return;
      attempts += 1;
      if (attempts < 60) setTimeout(tick, 200);
    };
    tick();
  }

  function ensurePanel() {
    if (panelEl) return panelEl;
    /* Stale panel from a previous load? Hide it before creating ours. */
    var prev = document.getElementById("person-mv-panel");
    if (prev) {
      prev.classList.add("hidden");
      prev.style.display = "none";
      prev.style.pointerEvents = "none";
      try { prev.remove(); } catch (_e) {}
    }
    ensureStyles();
    panelEl = document.createElement("section");
    panelEl.className = "panel flow hidden";
    panelEl.id = "person-mv-panel";
    /* CSSOS_WAVE_109D 20260509 — Jing
     * Panel constitution compliance:
     *  - 3 buttons each carry data-action so app.panel-shell-actions.js
     *    binds them correctly (without the explicit data-action, the
     *    fallback-by-index treats button[0] as "panel.settings" — wrong).
     *  - 8-way resize handles get injected by ensureEightWayResizeHandles
     *    after panel creation (see end of ensurePanel()), so the old
     *    .resize-handle / .resize-handle-left chevrons are no longer
     *    needed and have been removed.
     */
    panelEl.innerHTML =
      '<div class="panel-bar">' +
        '<div class="panel-icon">🏛</div>' +
        '<div class="panel-title">' + (tt("People MV · Civilization Universe", "人物 MV · 文明宇宙")) + '</div>' +
        '<div class="panel-actions">' +
          '<button class="icon-btn" type="button" data-action="panel.minimize" aria-label="minimize" title="' + escapeAttr(tt("Collapse / Restore", "收起 / 还原")) + '">—</button>' +
          '<button class="icon-btn" type="button" data-action="panel.maximize" aria-label="maximize" title="' + escapeAttr(tt("Maximize / Restore", "最大化 / 还原")) + '">⤢</button>' +
          '<button class="icon-btn" type="button" data-action="panel.close" aria-label="close" title="' + escapeAttr(tt("Send to Dock", "收到 Dock")) + '">×</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel-body">' +
        '<div class="person-mv-toolbar">' +
          '<input class="person-mv-search" type="search" placeholder="' +
            tt("Search by name, civilization, theme…", "按姓名 / 文明 / 主题搜索") + '" />' +
          '<button class="person-mv-tier-btn is-active" data-tier="1">' +
            tt("Influence", "影响力") + '</button>' +
          '<button class="person-mv-tier-btn" data-tier="2">' +
            tt("Civilization", "文明") + '</button>' +
          /* CSSOS_PERSON_MV_WAVE58 — S/A/B curation-tier filter chips. */
          '<span class="person-mv-curation-tier" style="display:inline-flex;gap:4px;margin-left:6px;">' +
            '<button class="person-mv-ctier-btn is-active" data-ctier="S" title="' +
              tt("Global consensus", "全球公认") + '">S</button>' +
            '<button class="person-mv-ctier-btn" data-ctier="A" title="' +
              tt("Civilization rep", "文明代表") + '">A</button>' +
            '<button class="person-mv-ctier-btn" data-ctier="B" title="' +
              tt("Domain rep", "领域代表") + '">B</button>' +
            '<button class="person-mv-ctier-btn" data-ctier="all" title="' +
              tt("All tiers", "全部") + '">' + tt("All", "全") + '</button>' +
          '</span>' +
          '<select class="person-mv-civ-select"><option value="">' +
            tt("All civilizations", "全部文明") + '</option></select>' +
          '<button class="person-mv-random-btn" title="' +
            tt("Surprise me", "随机给我一个") + '">🎲</button>' +
        '</div>' +
        '<div class="person-mv-create-anybody">' +
          tt("+ Create an MV for any person — even Aunt Mary or yourself.",
             "+ 为任何人创建 MV —— 哪怕隔壁张大爷或你自己") +
        '</div>' +
        '<div class="person-mv-grid"></div>' +
      '</div>';
    /* CSSOS_PERSON_MV_MAIN_MOUNT 20260507 — Jing
     * All other panels (foryou-panel, watch-panel, mv-pipeline-panel,
     * etc.) live inside <main class="stage">. Mounting outside main
     * means dock-dispatcher / panel-stack / focus-manager loops that
     * walk main's descendants never see us — events get routed to
     * the wrong place. Hoist to main when present. */
    var mainStage = document.querySelector("main.stage") || document.querySelector("main");
    (mainStage || document.body).appendChild(panelEl);
    bindPanelEvents();
    /* CSSOS_PERSON_MV_BRIDGES 20260507 — Jing
     * Every shared bridge is a forEach over .panel that ran ONCE on
     * init. Items appended later miss them. Fire all four so my
     * panel matches the canonical contract:
     *   - bar actions: close/min/max click handling
     *   - drag:        drag the title bar to reposition
     *   - resize:      8-way edge/corner resize handles
     *   - focus:       click anywhere → bring panel to front
     */
    [
      "attachPanelBarActionsBridge",
      "attachPanelDragBridge",
      "attachResizeBridge",
      "attachPanelFocusBridge",
    ].forEach(function (fn) {
      try {
        if (typeof globalThis[fn] === "function") globalThis[fn]();
      } catch (err) { console.warn("[person-mv]", fn, "threw", err); }
    });
    /* CSSOS_WAVE_109D 20260509 — Jing
     * Belt-and-suspenders: explicitly ensure the 8 resize handles
     * exist on this panel even if attachResizeBridge ran before
     * we mounted. ensureEightWayResizeHandles is idempotent. */
    try {
      if (typeof globalThis.ensureEightWayResizeHandles === "function") {
        globalThis.ensureEightWayResizeHandles(panelEl);
        /* Re-run attachResizeBridge so the freshly-injected handles
         * pick up their bindEightWay listeners. */
        if (typeof globalThis.attachResizeBridge === "function") {
          globalThis.attachResizeBridge();
        }
      }
    } catch (err) { console.warn("[person-mv] 8-way handle inject failed", err); }
    return panelEl;
  }

  function bindPanelEvents() {
    var searchEl = panelEl.querySelector(".person-mv-search");
    var civSel = panelEl.querySelector(".person-mv-civ-select");
    var tierBtns = panelEl.querySelectorAll(".person-mv-tier-btn");
    var grid = panelEl.querySelector(".person-mv-grid");
    var createBtn = panelEl.querySelector(".person-mv-create-anybody");
    var closeBtn = panelEl.querySelector('.icon-btn[aria-label="close"]');
    var minBtn = panelEl.querySelector('.icon-btn[aria-label="minimize"]');
    var maxBtn = panelEl.querySelector('.icon-btn[aria-label="maximize"]');
    /* CSSOS_PERSON_MV_CHROME_DIRECT 20260507 — Jing
     * Direct capture-phase listeners on each button. The shared
     * panel-shell-actions handler is on the panel root with
     * stopImmediatePropagation, so to win we must (a) listen on
     * the button itself, (b) capture phase, (c) call the same
     * three globals (togglePanelCollapse / togglePanelMaximize /
     * minimizeToDockBridge) so behavior matches every other panel.
     */
    /* Chrome buttons — only preventDefault on the click event, not
     * pointerup (preventDefault on pointerup cancels the click). */
    function wireChromeBtn(btn, fn) {
      if (!btn) return;
      var lastBtnFire = 0;
      function fire() {
        var now = Date.now();
        if (now - lastBtnFire < 250) return;
        lastBtnFire = now;
        try { fn(); } catch (err) { console.warn("[person-mv] chrome", err); }
      }
      btn.addEventListener("pointerup", function () { fire(); }, true);
      btn.addEventListener("click", function (e) {
        fire();
        try { e.preventDefault(); e.stopPropagation(); } catch (_e) {}
        if (e.stopImmediatePropagation) try { e.stopImmediatePropagation(); } catch (_e) {}
      }, true);
    }
    wireChromeBtn(closeBtn, function () {
      /* CSSOS_PERSON_MV_TRUE_HIDE 20260507 — Jing
       * minimizeToDockBridge keeps the panel in DOM with reduced
       * opacity/scale, but in our case the .panel-front z-index:272
       * stays in the click-intercept layer. Force a real hide so
       * the dock under us reclaims pointer events. */
      panelEl.classList.add("hidden");
      panelEl.style.display = "none";
      panelEl.style.pointerEvents = "none";
      // Also call the bridge so the dock-badge state still flips.
      try { globalThis.minimizeToDockBridge?.(panelEl); } catch (_e) {}
      /* Clear hash so next reload doesn't restore a codex view. */
      try { history.replaceState(null, "", "#"); } catch (_e) {}
    });
    wireChromeBtn(minBtn, function () {
      if (typeof globalThis.togglePanelCollapseBridge === "function") {
        globalThis.togglePanelCollapseBridge(panelEl);
      } else if (typeof globalThis.togglePanelCollapse === "function") {
        globalThis.togglePanelCollapse(panelEl);
      } else {
        panelEl.classList.toggle("panel-collapsed");
      }
    });
    wireChromeBtn(maxBtn, function () {
      if (typeof globalThis.togglePanelMaximize === "function") {
        globalThis.togglePanelMaximize(panelEl);
      }
    });
    var debounceT = 0;
    if (searchEl) {
      searchEl.addEventListener("input", function () {
        clearTimeout(debounceT);
        debounceT = setTimeout(function () {
          state.search = String(searchEl.value || "").trim();
          load();
        }, 250);
      });
    }
    if (civSel) {
      civSel.addEventListener("change", function () {
        state.civ = String(civSel.value || "").trim();
        load();
      });
    }
    tierBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        tierBtns.forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        state.tier = Number(b.getAttribute("data-tier") || 1);
        load();
      });
    });
    /* Wave 58 — S/A/B curation tier filter. */
    var ctierBtns = panelEl.querySelectorAll(".person-mv-ctier-btn");
    ctierBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        ctierBtns.forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        state.curationTier = String(b.getAttribute("data-ctier") || "S");
        load();
      });
    });
    if (createBtn) {
      createBtn.addEventListener("click", async function () {
        if (!(await requireSignedInForAction("create"))) return;
        var name = window.prompt(
          tt(
            "Enter a person's name (anyone — historical or someone you know):",
            "输入一个人物的名字（任何人 —— 历史人物或你认识的人都可以）："
          ),
          ""
        );
        if (!name || !name.trim()) return;
        createAdhocPerson(name.trim());
      });
    }
    var randomBtn = panelEl.querySelector(".person-mv-random-btn");
    if (randomBtn) {
      randomBtn.addEventListener("click", async function () {
        randomBtn.disabled = true;
        try {
          var r = await fetch("/api/person-mv/persons/random", {
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          var j = await r.json().catch(function(){ return null; });
          var pid = j && j.ok && j.data && j.data.person_id;
          if (pid) {
            await openCodex(pid);
            // Auto-fire cinema once codex finishes mounting.
            setTimeout(function () {
              try {
                var btn = panelEl.querySelector(".pmv-cinema");
                if (btn) btn.click();
              } catch (_e) {}
            }, 600);
          } else {
            if (typeof globalThis.showToast === "function") {
              globalThis.showToast(tt("No person found.", "没找到人物。"));
            }
          }
        } catch (err) {
          console.warn("[person-mv] random failed", err);
        } finally {
          randomBtn.disabled = false;
        }
      });
    }
    /* Card open — pointerup capture on the whole panel so no
     * descendant element can swallow it. Dedup with timestamp so
     * pointerup + click + dblclick don't all fire jumpIntoPipeline. */
    var cardLastFire = 0;
    function cardCore(e) {
      var card = e.target && typeof e.target.closest === "function"
        ? e.target.closest(".person-mv-card") : null;
      if (!card || !panelEl.contains(card)) return null;
      if (e.target.closest && e.target.closest(".panel-actions")) return null;
      var pid = card.getAttribute("data-person-id");
      if (!pid) return null;
      var person = state.persons.find(function (p) { return p.person_id === pid; });
      return person || null;
    }
    panelEl.addEventListener("pointerup", function (e) {
      var p = cardCore(e);
      console.warn("[person-mv] card pointerup target=", e.target, "matched=", !!p);
      if (!p) return;
      var now = Date.now();
      if (now - cardLastFire < 400) return;
      cardLastFire = now;
      openCodex(p.person_id);
    }, true);
    panelEl.addEventListener("click", function (e) {
      var p = cardCore(e);
      console.warn("[person-mv] card click target=", e.target, "matched=", !!p);
      if (!p) return;
      var now = Date.now();
      if (now - cardLastFire < 400) return;
      cardLastFire = now;
      openCodex(p.person_id);
      try { e.preventDefault(); e.stopPropagation(); } catch (_e) {}
    }, true);
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    try {
      var qs = new URLSearchParams();
      qs.set("tier", String(state.tier));
      if (state.curationTier && state.curationTier !== "all") {
        qs.set("curation_tier", state.curationTier);
      } else if (state.curationTier === "all") {
        qs.set("curation_tier", "all");
      }
      if (state.civ) qs.set("civ", state.civ);
      if (state.search) qs.set("search", state.search);
      /* CSSOS_WAVE_109 20260509 — bumped from 200 → 1200 to fit the
       * full compendium (DB has up to ~1000 curated personalities).
       * Compendium section is lazy-rendered so initial DOM cost is
       * still small. */
      qs.set("limit", "1200");
      var res = await fetch("/api/person-mv/persons?" + qs.toString(), {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      var json = await res.json().catch(function () { return null; });
      var data = (json && json.data) || {};
      state.persons = Array.isArray(data.persons) ? data.persons : [];
      render();
      populateCivOptions();
    } catch (err) {
      console.warn("[person-mv] load failed", err);
    } finally {
      state.loading = false;
    }
  }

  function populateCivOptions() {
    if (!panelEl) return;
    var sel = panelEl.querySelector(".person-mv-civ-select");
    if (!sel) return;
    var current = sel.value;
    var civs = Array.from(new Set(state.persons.map(function (p) { return p.civilization; }).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">' + tt("All civilizations", "全部文明") + '</option>' +
      civs.map(function (c) { return '<option value="' + escapeAttr(c) + '">' + escapeText(c) + '</option>'; }).join("");
    if (current) sel.value = current;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  function escapeText(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  async function createAdhocPerson(name) {
    if (!name) return;
    var ctaEl = panelEl && panelEl.querySelector(".person-mv-adhoc-cta");
    if (ctaEl) {
      ctaEl.classList.add("is-busy");
      ctaEl.innerHTML = '⏳ ' + escapeText(tt("Creating profile for ", "正在为「") + name + tt("…", "」创建专页…"));
    }
    try {
      var res = await fetch("/api/person-mv/persons", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: name }),
      });
      var json = await res.json().catch(function(){ return null; });
      if (!json || !json.ok || !json.person_id) {
        var code = (json && json.code) || ("HTTP_" + res.status);
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(tt("Failed to create person: ", "创建失败：") + code);
        }
        if (ctaEl) {
          ctaEl.classList.remove("is-busy");
          ctaEl.innerHTML = '✨ ' + escapeText(tt("Create profile for ", "为「") + name + tt("", "」创建专页"));
        }
        return;
      }
      /* CSSOS_WAVE_109H 20260509 — Jing
       * If the backend dedupe matched an existing entry, surface a
       * brief toast so the user knows we routed them to the
       * canonical record instead of spawning a parallel one. */
      if (json.existing && typeof globalThis.showToast === "function") {
        var displayName = json.name_zh || json.name_en || name;
        globalThis.showToast(tt(
          'Found existing entry: ' + displayName + ' — opening it. ' +
            'To create a same-name person on purpose, retry with "(同名)" suffix.',
          '已存在「' + displayName + '」，已为你打开。如需另开一位同名人物，请加后缀「（同名）」重试。'
        ));
      }
      // Reload grid in background, then open codex for the new person.
      load();
      openCodex(json.person_id);
    } catch (err) {
      console.warn("[person-mv] adhoc create failed", err);
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tt("Failed to create person.", "创建人物失败。"));
      }
      if (ctaEl) {
        ctaEl.classList.remove("is-busy");
      }
    }
  }

  /* CSSOS_WAVE_109_THREE_TIER 20260509 — Jing
   * Three-tier display: Hall of Fame (S) → Notable (A) → Compendium (B/C).
   * Search/filter applies across all three tiers; the API returns
   * everyone matching the filters in one shot, we bucket client-side
   * by curation_tier. The Compendium section uses IntersectionObserver
   * to defer rendering its rows until scrolled near. */
  function render() {
    if (!panelEl) return;
    var grid = panelEl.querySelector(".person-mv-grid");
    if (!grid) return;
    if (!state.persons.length) {
      var typed = String(state.search || "").trim();
      var emptyHtml = '<div class="person-mv-empty">' +
        tt("No matching personalities yet — adjust filters or create one above.",
           "暂无匹配人物 —— 调整筛选条件，或在上方创建新人物。") +
        '</div>';
      if (typed) {
        emptyHtml += '<div class="person-mv-adhoc-cta" data-adhoc-name="' + escapeAttr(typed) + '">' +
          '✨ ' + escapeText(tt("Create profile for ", "为「") + typed + tt("", "」创建专页")) +
        '</div>';
      }
      grid.innerHTML = emptyHtml;
      var ctaEl0 = grid.querySelector(".person-mv-adhoc-cta");
      if (ctaEl0) {
        ctaEl0.addEventListener("click", function () {
          var n = ctaEl0.getAttribute("data-adhoc-name") || typed;
          if (n) createAdhocPerson(n);
        });
      }
      return;
    }

    /* CSSOS_WAVE_109F 20260509 — Jing
     * Refined bucketing — Trump/Musk are real public figures even
     * though they're ad-hoc, so they land in Contemporary by their
     * roles, NOT in Personal/Test. Personal/Test is reserved for
     * truly private/test entries (Grandma, Jing Du) and moves to
     * the END of the page.
     *
     *   ⭐ hall       — S, historical, public
     *   🎴 notable    — A, historical, public
     *   🌐 modern     — curated OR ad-hoc-with-real-roles, modern era
     *   📜 comp       — B/C historical text long-tail
     *   👤 testpersonal — ad-hoc with private/test roles only (LAST)
     */
    var TEST_ROLE_RE = /家庭成员|长辈|普通人|测试|test\b|placeholder|adhoc/i;
    function isTestPerson(p) {
      if (!p.created_by_user_id) return false;
      var roles = Array.isArray(p.roles) ? p.roles.join(" ") : String(p.roles || "");
      // No roles at all + ad-hoc → likely test
      if (!roles.trim()) return true;
      // Roles match test/family-only signal → test
      if (TEST_ROLE_RE.test(roles)) {
        // Unless ALSO has a "real" public-figure role; check for political/business/creative role keywords
        var realRoleRe = /政治家|总统|国王|首相|主席|领袖|企业家|工程师|发明家|科学家|物理学家|化学家|哲学家|艺术家|音乐家|作家|演员|导演/i;
        if (realRoleRe.test(roles)) return false;
        return true;
      }
      return false;
    }

    var hall = [], notable = [], modern = [], testPersonal = [], comp = [];
    state.persons.forEach(function (p) {
      var t = String(p.curation_tier || "B").toUpperCase();
      var era = String(p.era || "").trim();
      var isContemporary =
        /当代|现代|20\s*世纪|21\s*世纪|contemporary|modern/i.test(era);

      if (isTestPerson(p)) { testPersonal.push(p); return; }
      if (isContemporary) { modern.push(p); return; }
      if (t === "S") { hall.push(p); return; }
      if (t === "A") { notable.push(p); return; }
      comp.push(p);
    });

    /* If user has filtered to a single tier (S/A/B), render only that
     * tier expanded. Otherwise show the full layered layout. */
    var single = String(state.curationTier || "all").toLowerCase();
    grid.innerHTML = "";

    if (single === "s" || single === "a" || single === "b") {
      /* CSSOS_WAVE_110B 20260510 — Jing
       * When the user explicitly clicks a tier chip, show EVERY
       * person of that tier (don't subtract contemporary/test).
       * Otherwise picking "S" would hide Trump/Musk/Einstein etc.
       * who are S-tier but classified as contemporary. */
      var bucketByTier = state.persons.filter(function (p) {
        return String(p.curation_tier || "").toUpperCase() === single.toUpperCase();
      });
      if (single === "s") {
        grid.appendChild(renderHallSection(bucketByTier));
      } else if (single === "a") {
        grid.appendChild(renderNotableSection(bucketByTier));
      } else {
        grid.appendChild(renderCompendiumSection(bucketByTier));
      }
    } else {
      /* Order per Jing 109F: Personal/Test goes LAST. */
      if (hall.length)         grid.appendChild(renderHallSection(hall));
      if (notable.length)      grid.appendChild(renderNotableSection(notable));
      if (modern.length)       grid.appendChild(renderModernSection(modern));
      if (comp.length)         grid.appendChild(renderCompendiumSection(comp));
      if (testPersonal.length) grid.appendChild(renderPersonalSection(testPersonal));
    }
  }

  /* CSSOS_WAVE_109F 20260509 — Jing
   * Contemporary section is now split into role-based sub-sections:
   *   🏛 Political Leaders  — politicians, activists, civil-rights leaders
   *   🚀 Innovators & Tech  — entrepreneurs, engineers, inventors
   *   🔬 Scientists         — physicists, chemists, biologists
   *   🎨 Arts & Culture     — artists, musicians, writers, directors
   *   🌐 Other Contemporary — modern figures whose roles don't match
   *
   * Each sub-section gets its own header so Trump and Musk don't
   * sit shoulder-to-shoulder, and so famous artists don't sit
   * shoulder-to-shoulder with politicians. */
  var MODERN_GROUPS = [
    {
      key: "political",
      icon: "🏛",
      en: "Political Leaders",
      zh: "政治领袖",
      re: /政治家|总统|国王|首相|主席|总理|民族解放领袖|民族领袖|民权领袖|社会活动家|抗议者|公众演说家/i,
    },
    {
      key: "tech",
      icon: "🚀",
      en: "Innovators & Tech",
      zh: "科技创新",
      re: /企业家|工程师|发明家|商人|投资者|实业家|科技领袖|程序员/i,
    },
    {
      key: "science",
      icon: "🔬",
      en: "Scientists",
      zh: "科学家",
      re: /科学家|物理学家|化学家|生物学家|数学家|天文学家|医生|医学家/i,
    },
    {
      key: "arts",
      icon: "🎨",
      en: "Arts & Culture",
      zh: "文艺",
      re: /艺术家|音乐家|画家|作家|诗人|演员|导演|歌手|舞者|设计师/i,
    },
  ];

  function classifyModern(p) {
    var roles = Array.isArray(p.roles) ? p.roles.join(" ") : String(p.roles || "");
    if (!roles.trim()) return "other";
    /* First match wins — order in MODERN_GROUPS sets priority. */
    for (var i = 0; i < MODERN_GROUPS.length; i += 1) {
      if (MODERN_GROUPS[i].re.test(roles)) return MODERN_GROUPS[i].key;
    }
    return "other";
  }

  function renderModernSection(persons) {
    var buckets = { other: [] };
    MODERN_GROUPS.forEach(function (g) { buckets[g.key] = []; });
    persons.forEach(function (p) { buckets[classifyModern(p)].push(p); });

    var wrap = document.createDocumentFragment();
    function renderBucket(label, icon, list) {
      if (!list.length) return;
      var sec = document.createElement("section");
      sec.className = "pmv-tier-section pmv-tier-modern";
      var head = document.createElement("div");
      head.className = "pmv-tier-head";
      head.innerHTML =
        '<div class="pmv-tier-title">' + escapeText(icon + " " + label) + '</div>' +
        '<div class="pmv-tier-count">' + list.length + '</div>';
      sec.appendChild(head);
      var withPortrait = [], withoutPortrait = [];
      list.forEach(function (p) {
        if (p.portrait_url || p.cover_image_url) withPortrait.push(p);
        else withoutPortrait.push(p);
      });
      if (withPortrait.length) {
        var g = document.createElement("div");
        g.className = "pmv-notable-grid";
        withPortrait.forEach(function (p) { g.appendChild(buildPortraitCard(p)); });
        sec.appendChild(g);
      }
      if (withoutPortrait.length) {
        var g2 = document.createElement("div");
        g2.className = "person-mv-grid";
        g2.style.padding = withPortrait.length ? "12px 0 0 0" : "0";
        withoutPortrait.forEach(function (p) { g2.appendChild(buildNotableTextCard(p)); });
        sec.appendChild(g2);
      }
      wrap.appendChild(sec);
    }

    MODERN_GROUPS.forEach(function (g) {
      var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
      var label = /^zh/i.test(String(locale)) ? g.zh : g.en;
      renderBucket(label, g.icon, buckets[g.key]);
    });
    /* Other modern figures last in this cluster. */
    renderBucket(tt("Other Contemporary", "其他当代"), "🌐", buckets.other);

    var holder = document.createElement("section");
    holder.className = "pmv-tier-cluster";
    holder.appendChild(wrap);
    return holder;
  }

  /* CSSOS_WAVE_109C 20260509 — Jing
   * Personal creations: ad-hoc people the user (or any user) added
   * via "+ Create an MV for any person". These sit in their own
   * section with a friendlier label so seeing "Grandma" next to
   * "Aristotle" doesn't feel jarring. */
  function renderPersonalSection(persons) {
    var section = document.createElement("section");
    section.className = "pmv-tier-section pmv-tier-personal";
    var head = document.createElement("div");
    head.className = "pmv-tier-head";
    head.innerHTML =
      '<div class="pmv-tier-title">👤 ' + escapeText(tt("User Creations", "用户自定义人物")) + '</div>' +
      '<div class="pmv-tier-count">' + persons.length + '</div>';
    section.appendChild(head);

    var withPortrait = [], withoutPortrait = [];
    persons.forEach(function (p) {
      if (p.portrait_url || p.cover_image_url) withPortrait.push(p);
      else withoutPortrait.push(p);
    });

    if (withPortrait.length) {
      var g = document.createElement("div");
      g.className = "pmv-notable-grid";
      withPortrait.forEach(function (p) {
        var card = buildPortraitCard(p);
        attachUserActions(card, p);
        g.appendChild(card);
      });
      section.appendChild(g);
    }
    if (withoutPortrait.length) {
      var g2 = document.createElement("div");
      g2.className = "person-mv-grid";
      g2.style.padding = withPortrait.length ? "12px 0 0 0" : "0";
      withoutPortrait.forEach(function (p) {
        var card = buildNotableTextCard(p);
        card.classList.add("has-user-actions");
        attachUserActions(card, p);
        g2.appendChild(card);
      });
      section.appendChild(g2);
    }
    return section;
  }

  /* CSSOS_WAVE_109G 20260509 — Jing
   * Attach edit/delete action buttons to a user-created person card.
   * Buttons stop propagation so clicking them never opens the codex. */
  function attachUserActions(card, person) {
    if (!card || !person) return;
    var actions = document.createElement("div");
    actions.className = "pmv-user-actions";
    actions.innerHTML =
      '<button type="button" class="pmv-user-action-btn" data-act="edit" ' +
        'aria-label="' + escapeAttr(tt("Edit", "编辑")) + '" ' +
        'title="' + escapeAttr(tt("Edit", "编辑")) + '">✎</button>' +
      '<button type="button" class="pmv-user-action-btn danger" data-act="delete" ' +
        'aria-label="' + escapeAttr(tt("Delete", "删除")) + '" ' +
        'title="' + escapeAttr(tt("Delete", "删除")) + '">🗑</button>';
    /* Block bubbling so the card's onclick doesn't fire. */
    actions.addEventListener("click", function (e) { e.stopPropagation(); });
    actions.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    actions.addEventListener("pointerup", function (e) { e.stopPropagation(); });
    actions.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var act = btn.getAttribute("data-act");
        if (act === "edit") openEditDialog(person);
        else if (act === "delete") confirmDelete(person);
      });
    });
    card.appendChild(actions);
  }

  function confirmDelete(person) {
    var name = localizedName(person);
    var msg = tt(
      "Delete \"" + name + "\"? This removes the profile and any related MVs.",
      "确认删除「" + name + "」？将同时移除其档案和相关 MV。",
    );
    if (!window.confirm(msg)) return;
    fetch("/api/person-mv/persons/" + encodeURIComponent(person.person_id), {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        if (j && j.ok) {
          if (typeof globalThis.showToast === "function") {
            globalThis.showToast(tt("Deleted: " + name, "已删除：" + name));
          }
          load(); /* refresh grid */
          return;
        }
        var code = (j && j.code) || "INTERNAL";
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(tt("Delete failed: ", "删除失败：") + code);
        }
      })
      .catch(function (err) {
        console.warn("[person-mv] delete failed", err);
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(tt("Delete failed (network).", "删除失败（网络）。"));
        }
      });
  }

  function openEditDialog(person) {
    /* Lightweight edit using window.prompt for now — a richer modal
     * can replace this in a follow-up. Each field gets its own
     * prompt so users can edit selectively (cancel any prompt to
     * skip that field). */
    function ask(label, current) {
      var v = window.prompt(label, current || "");
      if (v === null) return undefined; /* user cancelled */
      return String(v).slice(0, 200);
    }
    var patch = {};
    var nameZh = ask(tt("中文名 (cancel to skip)", "中文名（取消跳过）"), person.name_zh);
    if (nameZh !== undefined) patch.name_zh = nameZh;
    var nameEn = ask(tt("English name (cancel to skip)", "英文名（取消跳过）"), person.name_en);
    if (nameEn !== undefined) patch.name_en = nameEn;
    var civ = ask(tt("Civilization (cancel to skip)", "文明（取消跳过）"), person.civilization);
    if (civ !== undefined) patch.civilization = civ;
    var era = ask(tt("Era (cancel to skip)", "时代（取消跳过）"), person.era);
    if (era !== undefined) patch.era = era;
    var theme = ask(tt("Core theme (cancel to skip)", "核心主题（取消跳过）"), person.core_theme);
    if (theme !== undefined) patch.core_theme = theme;

    if (!Object.keys(patch).length) return; /* nothing to save */
    fetch("/api/person-mv/persons/" + encodeURIComponent(person.person_id), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(patch),
    })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        if (j && j.ok) {
          if (typeof globalThis.showToast === "function") {
            globalThis.showToast(tt("Saved.", "已保存。"));
          }
          load();
          return;
        }
        var code = (j && j.code) || "INTERNAL";
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(tt("Save failed: ", "保存失败：") + code);
        }
      })
      .catch(function (err) {
        console.warn("[person-mv] patch failed", err);
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(tt("Save failed (network).", "保存失败（网络）。"));
        }
      });
  }

  function renderHallSection(persons) {
    var withPortrait = [], withoutPortrait = [];
    persons.forEach(function (p) {
      if (p.portrait_url || p.cover_image_url) withPortrait.push(p);
      else withoutPortrait.push(p);
    });
    /* Wrapper holds two distinct sections — "Hall of Fame" for the
     * fully-illustrated greats, and "Hall — pending portraits" for
     * S-tier persons whose hero image hasn't been generated yet.
     * Per Jing: image cards and text cards under different headers. */
    var wrap = document.createDocumentFragment();
    if (withPortrait.length) {
      var imgSec = document.createElement("section");
      imgSec.className = "pmv-tier-section pmv-tier-hall";
      var h = document.createElement("div");
      h.className = "pmv-tier-head";
      h.innerHTML =
        '<div class="pmv-tier-title">⭐ ' + escapeText(tt("Hall of Fame", "传奇殿堂")) + '</div>' +
        '<div class="pmv-tier-count">' + withPortrait.length + '</div>';
      imgSec.appendChild(h);
      var grid = document.createElement("div");
      grid.className = "pmv-hall-grid";
      withPortrait.forEach(function (p) { grid.appendChild(buildHallCard(p)); });
      imgSec.appendChild(grid);
      wrap.appendChild(imgSec);
    }
    if (withoutPortrait.length) {
      var txtSec = document.createElement("section");
      txtSec.className = "pmv-tier-section pmv-tier-hall-pending";
      var h2 = document.createElement("div");
      h2.className = "pmv-tier-head";
      h2.innerHTML =
        '<div class="pmv-tier-title">📝 ' + escapeText(tt("Hall — Pending Portraits", "传奇 · 待补图")) + '</div>' +
        '<div class="pmv-tier-count">' + withoutPortrait.length + '</div>';
      txtSec.appendChild(h2);
      var g = document.createElement("div");
      g.className = "person-mv-grid";
      g.style.padding = "0";
      withoutPortrait.forEach(function (p) { g.appendChild(buildNotableTextCard(p)); });
      txtSec.appendChild(g);
      wrap.appendChild(txtSec);
    }
    /* Wrap the fragment in a section so render() can appendChild a
     * single node. */
    var holder = document.createElement("section");
    holder.className = "pmv-tier-cluster";
    holder.appendChild(wrap);
    return holder;
  }

  function buildHallCard(p) {
    var primary = localizedName(p);
    var secondary = secondaryName(p);
    var meta = [p.civilization, p.era].filter(Boolean).join(" · ");
    var portrait = p.portrait_url || p.cover_image_url || "";
    var card = document.createElement("article");
    card.className = "pmv-hall-card";
    card.setAttribute("data-person-id", p.person_id || "");
    if (p.content_rating) card.setAttribute("data-content-rating", String(p.content_rating));
    var coverHtml;
    if (portrait) {
      coverHtml = '<div class="cover" style="background-image:url(' + escapeAttr(portrait) + ');"></div>';
    } else {
      /* Fallback: emoji or first character on gradient. */
      var glyph = (primary || "?").trim().charAt(0).toUpperCase();
      coverHtml = '<div class="cover fallback" style="background:linear-gradient(135deg,#012019,rgba(0,245,160,0.25));">' +
        escapeText(glyph) + '</div>';
    }
    card.innerHTML = coverHtml +
      '<div class="info">' +
        '<div class="name">' + escapeText(primary) + '</div>' +
        (secondary ? '<div class="name-en">' + escapeText(secondary) + '</div>' : '') +
        (meta ? '<div class="meta">' + escapeText(meta) + '</div>' : '') +
      '</div>';
    card.onclick = function (e) {
      if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_e) {} }
      openCodex(p.person_id);
    };
    return card;
  }

  /* CSSOS_WAVE_109B 20260509 — Jing
   * Notable section now splits into two sub-grids:
   *   - With portrait: vertical 160×220 image cards (.pmv-portrait-card)
   *   - Without portrait: existing text-only .person-mv-card
   * Image cards come first, then text cards, all under one section
   * heading. */
  function renderNotableSection(persons) {
    var withPortrait = [], withoutPortrait = [];
    persons.forEach(function (p) {
      if (p.portrait_url || p.cover_image_url) withPortrait.push(p);
      else withoutPortrait.push(p);
    });
    var wrap = document.createDocumentFragment();
    if (withPortrait.length) {
      var imgSec = document.createElement("section");
      imgSec.className = "pmv-tier-section pmv-tier-notable";
      var h = document.createElement("div");
      h.className = "pmv-tier-head";
      h.innerHTML =
        '<div class="pmv-tier-title">🎴 ' + escapeText(tt("Notable", "知名人物")) + '</div>' +
        '<div class="pmv-tier-count">' + withPortrait.length + '</div>';
      imgSec.appendChild(h);
      var g = document.createElement("div");
      g.className = "pmv-notable-grid";
      withPortrait.forEach(function (p) { g.appendChild(buildPortraitCard(p)); });
      imgSec.appendChild(g);
      wrap.appendChild(imgSec);
    }
    if (withoutPortrait.length) {
      var txtSec = document.createElement("section");
      txtSec.className = "pmv-tier-section pmv-tier-notable-pending";
      var h2 = document.createElement("div");
      h2.className = "pmv-tier-head";
      h2.innerHTML =
        '<div class="pmv-tier-title">📝 ' + escapeText(tt("Notable — Pending Portraits", "知名 · 待补图")) + '</div>' +
        '<div class="pmv-tier-count">' + withoutPortrait.length + '</div>';
      txtSec.appendChild(h2);
      var g2 = document.createElement("div");
      g2.className = "person-mv-grid";
      g2.style.padding = "0";
      withoutPortrait.forEach(function (p) { g2.appendChild(buildNotableTextCard(p)); });
      txtSec.appendChild(g2);
      wrap.appendChild(txtSec);
    }
    var holder = document.createElement("section");
    holder.className = "pmv-tier-cluster";
    holder.appendChild(wrap);
    return holder;
  }

  function buildPortraitCard(p) {
    /* Compact 160×220 portrait card — same chrome as Hall but smaller.
     * Used for Notable persons that have a portrait_url. */
    var primary = localizedName(p);
    var secondary = secondaryName(p);
    var meta = [p.civilization, p.era].filter(Boolean).join(" · ");
    var portrait = p.portrait_url || p.cover_image_url || "";
    var card = document.createElement("article");
    card.className = "pmv-portrait-card";
    card.setAttribute("data-person-id", p.person_id || "");
    if (p.content_rating) card.setAttribute("data-content-rating", String(p.content_rating));
    card.innerHTML =
      '<div class="cover" style="background-image:url(' + escapeAttr(portrait) + ');"></div>' +
      '<div class="info">' +
        '<div class="name">' + escapeText(primary) + '</div>' +
        (secondary ? '<div class="name-en">' + escapeText(secondary) + '</div>' : '') +
        (meta ? '<div class="meta">' + escapeText(meta) + '</div>' : '') +
      '</div>';
    card.onclick = function (e) {
      if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_e) {} }
      openCodex(p.person_id);
    };
    return card;
  }

  function buildNotableTextCard(p) {
    /* Original text-only card for A-tier persons that haven't yet
     * had a portrait generated. */
    var meta = [p.civilization, p.era].filter(Boolean).join(" · ");
    var primary = localizedName(p);
    var secondary = secondaryName(p);
    var card = document.createElement("div");
    card.className = "person-mv-card";
    card.setAttribute("data-person-id", p.person_id || "");
    if (p.content_rating) card.setAttribute("data-content-rating", String(p.content_rating));
    card.innerHTML =
      '<div class="person-mv-name">' + escapeText(primary) + '</div>' +
      (secondary ? '<div class="person-mv-name-en">' + escapeText(secondary) + '</div>' : '') +
      '<div class="person-mv-meta">' + escapeText(meta) + '</div>' +
      (p.core_theme ? '<div class="person-mv-theme">' + escapeText(p.core_theme) + '</div>' : '') +
      '<div class="person-mv-counts">' +
        '<span>' + tt("influence", "影响力") + ' · ' + (p.influence_score || 0) + '</span>' +
        '<span>' + tt("MVs", "MV") + ' · ' + (p.mv_count || 0) + '</span>' +
      '</div>';
    card.onclick = function (e) {
      if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_e) {} }
      openCodex(p.person_id);
    };
    return card;
  }

  /* CSSOS_WAVE_109 20260509 — Jing
   * Compendium uses IntersectionObserver to defer the heavy DOM
   * tree until the user actually scrolls near. With ~800+ rows
   * this saves a lot of layout work on initial render. */
  function renderCompendiumSection(persons) {
    var section = document.createElement("section");
    section.className = "pmv-tier-section pmv-tier-compendium";
    var head = document.createElement("div");
    head.className = "pmv-tier-head";
    head.innerHTML =
      '<div class="pmv-tier-title">📜 ' + escapeText(tt("Compendium", "百科全录")) + '</div>' +
      '<div class="pmv-tier-count">' + persons.length + '</div>';
    section.appendChild(head);

    var holder = document.createElement("div");
    holder.className = "pmv-compendium-grid";
    /* Skeleton placeholder until visible. */
    var skel = document.createElement("div");
    skel.className = "pmv-compendium-skel";
    skel.textContent = tt(
      "Scroll down to load the full compendium…",
      "滚动到这里加载完整名录…",
    );
    holder.appendChild(skel);
    section.appendChild(holder);

    var hydrated = false;
    function hydrate() {
      if (hydrated) return;
      hydrated = true;
      holder.innerHTML = "";
      persons.forEach(function (p) { holder.appendChild(buildCompendiumRow(p)); });
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { hydrate(); io.disconnect(); }
        });
      }, { rootMargin: "300px" });
      io.observe(section);
      /* Failsafe: hydrate after 4s regardless. */
      setTimeout(hydrate, 4000);
    } else {
      hydrate();
    }
    return section;
  }

  function buildCompendiumRow(p) {
    var primary = localizedName(p);
    var secondary = secondaryName(p);
    var meta = [p.civilization, p.era].filter(Boolean).join(" · ");
    var row = document.createElement("div");
    row.className = "pmv-compendium-row";
    row.setAttribute("data-person-id", p.person_id || "");
    if (p.content_rating) row.setAttribute("data-content-rating", String(p.content_rating));
    var label = primary + (secondary ? "  " + secondary : "");
    row.innerHTML =
      '<div class="row-name">' + escapeText(label) + '</div>' +
      (meta ? '<div class="row-meta">' + escapeText(meta) + '</div>' : '');
    row.onclick = function (e) {
      if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_e) {} }
      openCodex(p.person_id);
    };
    return row;
  }

  /* CSSOS_PERSON_MV_WAVE2 20260507 — Jing
   * "文明智能联动" — turn a person profile into a fully-prepared
   * MV pipeline seed:
   *   prompt   = `name · core_theme · symbols`
   *   style    = music_style_hint
   *   lyrics   = empty (LLM writes from the rest)
   * Plus civ-aware engine preferences via cssmvEngines.setSelection
   * before opening the panel so the right LLM/music engine fires
   * for that culture. No duration forced — pipeline LLM picks. */
  /* CSSOS_WAVE_110B 20260510 — Jing
   * Each generation should produce a UNIQUE theme so 10 covers don't
   * all read "Confucius / Confucius / Confucius / ...". Theme priority:
   *   1. random pick from lore.events (life-event titles like
   *      "周游列国" / "论语智慧" / "杏坛讲学")
   *   2. random pick from p.roles (e.g. "教育家·哲学家·政治家")
   *   3. random pick from p.visual_symbols
   *   4. fallback to first-sentence bio (old behaviour)
   *   5. ultimate fallback to core_theme
   *
   * The downstream lyrics/cover/music LLMs read this theme as the
   * angle for the work, so each take gets a different title.
   */
  function pickRandomEntry(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function buildSeed(p, lore) {
    var nameZh = localizedName(p);
    var theme = "";

    // 1. Random event
    if (lore && Array.isArray(lore.events) && lore.events.length) {
      var ev = pickRandomEntry(lore.events);
      if (ev) {
        var label = ev.title || ev.name || ev.summary || ev.detail || "";
        if (label) theme = String(label).trim().slice(0, 60);
      }
    }
    // 2. Random role
    if (!theme && Array.isArray(p.roles) && p.roles.length) {
      var r = pickRandomEntry(p.roles);
      if (r) theme = String(r).trim().slice(0, 40);
    }
    // 3. Random symbol
    if (!theme && Array.isArray(p.visual_symbols) && p.visual_symbols.length) {
      var s = pickRandomEntry(p.visual_symbols);
      if (s) theme = String(s).trim().slice(0, 30);
    }
    // 4. Bio first sentence
    if (!theme && lore && typeof lore.bio === "string") {
      var firstSent = lore.bio.split(/[。.!?！？\n]/)[0];
      if (firstSent) theme = firstSent.trim().slice(0, 80);
    }
    // 5. Fallback core_theme
    if (!theme && p.core_theme) theme = String(p.core_theme).trim().slice(0, 60);

    var prompt = nameZh + (theme ? "\n[" + theme + "]" : "");
    return {
      prompt: prompt,
      style: p.music_style_hint || "",
      lyrics: "",
      __personId: p.person_id,
      __civilization: p.civilization,
      __theme: theme,  // surfaced for downstream debug + title fallback
    };
  }

  /* Civilization → preferred LLM/music engine map. The mapping is
   * intentionally soft: caller-set selections persist via
   * cssmvEngines.setSelection so the user's manual gear-pick wins
   * if they've touched it. We only set when the user hasn't. */
  var CIV_ENGINE_HINTS = {
    "中华文明":      { llm: "deepseek",  llm_alt: "cerebras",  music: "suno"     },
    "古希腊文明":    { llm: "groq",      llm_alt: "anthropic", music: "elevenlabs" },
    "古罗马文明":    { llm: "groq",      llm_alt: "anthropic", music: "elevenlabs" },
    "印度文明":      { llm: "gemini",    llm_alt: "together",  music: "suno"     },
    "现代印度":      { llm: "gemini",    llm_alt: "together",  music: "suno"     },
    "文艺复兴欧洲":  { llm: "anthropic", llm_alt: "groq",      music: "elevenlabs" },
    "欧洲文明":      { llm: "anthropic", llm_alt: "groq",      music: "elevenlabs" },
    "近代欧洲":      { llm: "anthropic", llm_alt: "groq",      music: "elevenlabs" },
    "近现代科学":    { llm: "anthropic", llm_alt: "openai",    music: "suno"     },
  };
  function applyCivHints(civ) {
    var hints = CIV_ENGINE_HINTS[civ];
    if (!hints) return;
    try {
      if (!globalThis.cssmvEngines || typeof globalThis.cssmvEngines.setSelection !== "function") return;
      var sel = typeof globalThis.cssmvEngines.getSelections === "function"
        ? globalThis.cssmvEngines.getSelections() : {};
      // Only set when the user hasn't already picked something for that stage.
      if (!sel.lyrics?.engine && hints.llm) {
        globalThis.cssmvEngines.setSelection("lyrics", hints.llm, "default");
      }
      if (!sel.music?.engine && hints.music) {
        globalThis.cssmvEngines.setSelection("music", hints.music, "default");
      }
    } catch (_e) {}
  }

  function jumpIntoPipeline(person, lore) {
    var seed = buildSeed(person, lore);
    applyCivHints(person.civilization);
    if (typeof globalThis.openMvPipelinePanel === "function") {
      globalThis.openMvPipelinePanel({ seed: seed, autoStart: false });
      /* CSSOS_PERSON_MV_FORCE_INPUTS 20260507 — Jing
       * openMvPipelinePanel's seed-fill only writes when input is
       * EMPTY. Defaults like "Pop" in style mean civ-aware hints
       * never land. Force-overwrite the three inputs after the
       * panel mounts so the user sees the per-civ values without
       * having to clear "Pop" manually. */
      setTimeout(function () {
        var pipePanel = document.getElementById("mv-pipeline-panel");
        if (!pipePanel) return;
        var promptEl = pipePanel.querySelector("#mvp-prompt");
        var styleEl = pipePanel.querySelector("#mvp-style");
        var lyricsEl = pipePanel.querySelector("#mvp-lyrics");
        if (promptEl && seed.prompt) {
          promptEl.value = String(seed.prompt);
          try { promptEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_e) {}
        }
        if (styleEl && seed.style) {
          styleEl.value = String(seed.style);
          try { styleEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_e) {}
        }
        if (lyricsEl) {
          // Always start blank for person MVs so the LLM writes
          // fresh lyrics targeted at this person + civilization.
          lyricsEl.value = "";
          try { lyricsEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_e) {}
        }
      }, 60);
      try {
        globalThis.__cssosPendingPersonId = person.person_id;
        globalThis.__cssosPendingPersonName = localizedName(person);
      } catch (_e) {}
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(
          tt("Pipeline pre-filled for ", "已为以下人物预填管线：") + localizedName(person)
        );
      }
    } else {
      console.warn("[person-mv] openMvPipelinePanel not available", seed);
    }
  }

  /* CSSOS_PERSON_MV_CODEX 20260507 — Wave 2.5
   * Click a card → load /codex → swap panel body to codex view.
   * Hero portrait + bio + timeline + contributions/controversies +
   * assessments + MV gallery + contemporaries + lineage. Back button
   * restores grid view. URL hash sync for deep-link. */
  var codexState = { activeId: null };

  function ensureCodexStyles() {
    if (document.getElementById("cssos-person-codex-style")) return;
    var s = document.createElement("style");
    s.id = "cssos-person-codex-style";
    s.textContent =
      ".pmv-codex{padding:0;color:#daffee;overflow-y:auto;max-height:100%;}" +
      ".pmv-codex .pmv-hero{position:relative;height:280px;border-radius:12px;overflow:hidden;margin:12px;background:linear-gradient(135deg,#012019,#003a2c);}" +
      ".pmv-codex .pmv-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55;}" +
      ".pmv-codex .pmv-hero-overlay{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:18px;background:linear-gradient(transparent,rgba(0,0,0,.65));}" +
      /* CSSOS_WAVE_110_CINEMA_CONTRAST 20260510 — Jing
       * Bump native + latin name contrast — previous teal tints
       * (#bff5dc / #8edcc1) read as washed-out grey on the gradient
       * cinema background. New values still feel green-tinted but
       * pass WCAG AA on dark backdrops. Includes a text-shadow so
       * the names stay legible even on bright portrait sections. */
      ".pmv-codex .pmv-hero-name-zh{font:800 32px/1.1 ui-serif,serif;color:#ffffff;letter-spacing:.04em;text-shadow:0 2px 8px rgba(0,0,0,0.7);}" +
      ".pmv-codex .pmv-hero-name-native{font:600 18px/1.2 ui-serif,serif;color:#e6fff2;margin-top:4px;text-shadow:0 1px 6px rgba(0,0,0,0.65);}" +
      ".pmv-codex .pmv-hero-name-latin{font:italic 500 13px/1.2 ui-serif,serif;color:#c8f0de;margin-top:2px;text-shadow:0 1px 4px rgba(0,0,0,0.55);}" +
      /* Light theme: dark text on the (still-darkened) hero overlay. */
      "html[data-theme=\"light\"] .pmv-codex .pmv-hero-name-zh{color:#ffffff;text-shadow:0 2px 10px rgba(0,0,0,0.85);}" +
      "html[data-theme=\"light\"] .pmv-codex .pmv-hero-name-native{color:#f0fff7;text-shadow:0 1px 8px rgba(0,0,0,0.8);}" +
      "html[data-theme=\"light\"] .pmv-codex .pmv-hero-name-latin{color:#daffe9;text-shadow:0 1px 6px rgba(0,0,0,0.75);}" +
      ".pmv-codex .pmv-chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}" +
      ".pmv-codex .pmv-chip{background:rgba(0,245,160,0.15);border:1px solid rgba(0,245,160,0.35);border-radius:999px;padding:3px 10px;font:600 11px/1.4 ui-monospace,monospace;color:#daffee;}" +
      ".pmv-codex .pmv-chip-fallback{font-size:42px;letter-spacing:8px;opacity:.5;}" +
      ".pmv-codex .pmv-action-bar{display:flex;gap:10px;margin:0 12px 12px;flex-wrap:wrap;}" +
      ".pmv-codex .pmv-action-bar button{all:unset;cursor:pointer;padding:10px 18px;border-radius:10px;font:700 13px/1 ui-monospace,monospace;}" +
      /* CSSOS_WAVE_110C 20260510 — Jing
       * Cinema CTA needs HIGH contrast — was #001b14 on #00f5a0
       * (legibility ~3.8:1, fails AA on small text). New mix:
       *   dark theme: deep-black text on bright green = ~10:1
       *   light theme: keep dark text but bump contrast via shadow
       * Bold weight + crisp shadow keeps the icon-and-label readable
       * on every background. */
      ".pmv-codex .pmv-cinema{background:linear-gradient(135deg,#00f5a0,#00c280);color:#001008;font-weight:800!important;font-size:15px!important;padding:12px 22px!important;text-shadow:0 1px 0 rgba(255,255,255,0.35);box-shadow:0 4px 12px rgba(0,245,160,0.35);}" +
      ".pmv-codex .pmv-cinema:hover{filter:brightness(1.08);box-shadow:0 6px 18px rgba(0,245,160,0.5);}" +
      "html[data-theme=\"light\"] .pmv-codex .pmv-cinema{color:#001008;text-shadow:0 1px 1px rgba(255,255,255,0.55);}" +
      /* CSSOS_PERSON_MV_BUG3 20260507 — Jing
       * Theme-aware action-bar buttons. Previous rules used fixed light
       * text on transparent backgrounds, which disappeared in light theme.
       * Now use cssOS theme tokens (--text, --border) so contrast holds
       * in both light and dark themes, with solid surface tints. */
      ".pmv-codex .pmv-secondary{background:var(--green-soft,rgba(0,245,160,.18));border:1px solid var(--border,rgba(0,245,160,.4));color:var(--text);}" +
      ".pmv-codex .pmv-back{background:var(--panel-strong,rgba(0,0,0,.45));border:1px solid var(--border,rgba(255,255,255,.2));color:var(--text);}" +
      ".pmv-codex .pmv-secondary:hover,.pmv-codex .pmv-back:hover{filter:brightness(1.08);}" +
      /* CSSOS_PERSON_MV_CODEX_LIGHT 20260508 — Jing
       * Light-theme overrides for action bar — var(--text) defaults to a
       * pale teal in dark theme that disappears on cream bg in light. */
      "html[data-theme=\"light\"] .pmv-codex .pmv-secondary{background:rgba(0,160,100,0.14);border:1px solid rgba(0,160,100,0.55);color:#0f3a2a;}" +
      "html[data-theme=\"light\"] .pmv-codex .pmv-back{background:rgba(0,40,30,0.05);border:1px solid rgba(0,160,100,0.45);color:#0f3a2a;}" +
      "html[data-theme=\"light\"] .pmv-codex .pmv-action-bar button{font-weight:800;}" +
      ".pmv-codex .pmv-section{margin:14px 12px;padding:12px;background:rgba(8,18,16,.55);border:1px solid rgba(0,245,160,.18);border-radius:12px;}" +
      ".pmv-codex .pmv-section h3{margin:0 0 8px;font:700 13px/1.2 ui-monospace,monospace;letter-spacing:.06em;color:#00f5a0;}" +
      ".pmv-codex .pmv-bio{font:500 14px/1.6 ui-serif,serif;color:#e6fff5;}" +
      ".pmv-codex .pmv-timeline{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;}" +
      ".pmv-codex .pmv-event{flex:0 0 220px;background:rgba(0,245,160,.06);border:1px solid rgba(0,245,160,.2);border-radius:10px;padding:10px;}" +
      ".pmv-codex .pmv-event-year{font:700 12px/1 ui-monospace,monospace;color:#00f5a0;}" +
      ".pmv-codex .pmv-event-title{font:600 13px/1.3 ui-serif,serif;margin:4px 0;}" +
      ".pmv-codex .pmv-event-impact{font:500 11px/1.4 ui-monospace,monospace;color:#bff5dc;}" +
      ".pmv-codex .pmv-two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 12px;}" +
      ".pmv-codex .pmv-two-col .pmv-section{margin:0;}" +
      ".pmv-codex .pmv-list{margin:0;padding-left:16px;font:500 13px/1.6 ui-serif,serif;color:#e6fff5;}" +
      ".pmv-codex .pmv-assess{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;}" +
      ".pmv-codex .pmv-assess-card{background:rgba(0,245,160,.06);border:1px solid rgba(0,245,160,.2);border-radius:10px;padding:10px;}" +
      ".pmv-codex .pmv-assess-perspective{font:700 11px/1 ui-monospace,monospace;color:#00f5a0;letter-spacing:.08em;}" +
      ".pmv-codex .pmv-assess-text{font:500 13px/1.5 ui-serif,serif;margin-top:6px;color:#e6fff5;}" +
      ".pmv-codex .pmv-mv-tabs{display:flex;gap:8px;margin-bottom:8px;}" +
      ".pmv-codex .pmv-mv-tab{padding:4px 10px;border-radius:999px;background:rgba(0,245,160,.08);border:1px solid rgba(0,245,160,.25);font:600 11px/1.3 ui-monospace,monospace;color:#daffee;cursor:pointer;}" +
      ".pmv-codex .pmv-mv-tab.is-active{background:rgba(0,245,160,.7);color:#001b14;}" +
      ".pmv-codex .pmv-mv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;}" +
      ".pmv-codex .pmv-mv-card{aspect-ratio:16/9;background:rgba(0,0,0,.4);border:1px solid rgba(0,245,160,.2);border-radius:8px;cursor:pointer;position:relative;overflow:hidden;}" +
      ".pmv-codex .pmv-mv-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}" +
      ".pmv-codex .pmv-mv-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:36px;background:linear-gradient(135deg,#012019,#003a2c);color:#bff5dc;}" +
      ".pmv-codex .pmv-mv-meta{position:absolute;left:0;right:0;bottom:0;padding:4px 6px;background:linear-gradient(transparent,rgba(0,0,0,.7));font:600 11px/1.2 ui-monospace,monospace;color:#bff5dc;text-align:right;}" +
      ".pmv-codex .pmv-source-chip{display:inline-block;margin-top:8px;padding:3px 9px;border-radius:999px;background:rgba(0,245,160,.10);border:1px solid rgba(0,245,160,.28);font:600 10px/1.4 ui-monospace,monospace;color:#9ad6c0;letter-spacing:.04em;}" +
      ".pmv-codex .pmv-empty-mv{text-align:center;padding:30px 12px;color:#9ad6c0;}" +
      ".pmv-codex .pmv-mini-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;}" +
      ".pmv-codex .pmv-mini{flex:0 0 130px;background:rgba(8,18,16,.55);border:1px solid rgba(0,245,160,.2);border-radius:10px;padding:8px;cursor:pointer;}" +
      ".pmv-codex .pmv-mini-name{font:700 12px/1.2 ui-serif,serif;color:#daffee;}" +
      ".pmv-codex .pmv-mini-meta{font:500 10px/1.3 ui-monospace,monospace;color:#9ad6c0;margin-top:4px;}" +
      ".pmv-codex .pmv-skel{padding:30px;text-align:center;color:#9ad6c0;}" +
      ".pmv-codex .pmv-influence-bar{height:6px;border-radius:3px;background:rgba(255,255,255,.08);margin-top:6px;overflow:hidden;}" +
      ".pmv-codex .pmv-influence-fill{height:100%;background:linear-gradient(90deg,#00f5a0,#7dffce);}" +
      /* CSSOS_PERSON_MV_WAVE5 20260507 — view+like badge + wave 8 hero attribution */
      ".pmv-codex .pmv-mv-stats{position:absolute;right:6px;bottom:18px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.55);font:600 10px/1.2 ui-monospace,monospace;color:#daffee;letter-spacing:.02em;}" +
      /* CSSOS_PERSON_MV_WAVE12B 20260508 — comments + share overlay icons on each card. */
      ".pmv-codex .pmv-mv-card .pmv-mv-actions{position:absolute;right:6px;bottom:6px;display:flex;gap:4px;z-index:2;}" +
      ".pmv-codex .pmv-mv-card .pmv-mv-icon{all:unset;cursor:pointer;padding:4px 8px;border-radius:999px;background:rgba(0,0,0,.5);color:#daffee;font:600 11px/1 ui-monospace,monospace;}" +
      ".pmv-codex .pmv-mv-card .pmv-mv-icon:hover{background:rgba(0,245,160,.3);}" +
      /* CSSOS_PERSON_MV_WAVE13 20260508 — official sample ribbon + create-my-version CTA. */
      ".pmv-codex .pmv-mv-card .pmv-mv-ribbon{position:absolute;left:6px;top:6px;z-index:2;padding:3px 8px;border-radius:999px;background:linear-gradient(135deg,#ffd700,#ff9f1c);color:#1a0f00;font:700 10px/1.2 ui-monospace,monospace;letter-spacing:.04em;}" +
      ".pmv-codex .pmv-mv-card.is-official-sample{border-color:rgba(255,215,0,.55);box-shadow:0 0 0 1px rgba(255,215,0,.25),0 4px 12px rgba(255,159,28,.15);}" +
      ".pmv-codex .pmv-sample-cta{margin:8px 0 0;display:flex;justify-content:center;}" +
      ".pmv-codex .pmv-sample-cta button{background:linear-gradient(135deg,#00f5a0,#00c280);color:#001b14;border:0;border-radius:999px;padding:8px 18px;font:700 13px/1 ui-monospace,monospace;cursor:pointer;}" +
      ".pmv-codex .pmv-sample-cta button:hover{filter:brightness(1.08);}" +
      ".pmv-codex .pmv-hero-attribution{position:absolute;right:8px;bottom:8px;font:500 9px/1 ui-monospace,monospace;color:rgba(218,255,238,.55);background:rgba(0,0,0,.45);padding:3px 6px;border-radius:4px;}" +
      /* CSSOS_PERSON_MV_WAVE10 20260508 — mobile polish: safe-area, responsive hero, tap targets */
      "@media (max-width:480px){" +
        ".pmv-codex{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);}" +
        ".pmv-codex .pmv-hero{height:240px;margin:8px;}" +
        ".pmv-codex .pmv-hero-overlay{padding:14px;}" +
        ".pmv-codex .pmv-hero-name-zh{font-size:clamp(28px,9vw,48px);max-width:90vw;word-wrap:break-word;overflow-wrap:break-word;line-height:1.05;}" +
        ".pmv-codex .pmv-hero-name-native{font-size:16px;max-width:90vw;word-wrap:break-word;overflow-wrap:break-word;}" +
        ".pmv-codex .pmv-hero-name-latin{max-width:90vw;word-wrap:break-word;overflow-wrap:break-word;}" +
        ".pmv-codex .pmv-action-bar{flex-wrap:wrap;gap:8px;justify-content:center;margin:0 8px 12px;}" +
        ".pmv-codex .pmv-action-bar button{min-height:44px;padding:10px 16px!important;font-size:14px!important;flex:1 1 auto;text-align:center;}" +
        ".pmv-codex .pmv-cinema{flex:1 1 100%!important;}" +
        ".pmv-codex .pmv-mv-grid{grid-template-columns:repeat(auto-fill,minmax(min(140px,45vw),1fr));gap:8px;}" +
        ".pmv-codex .pmv-two-col{grid-template-columns:1fr;}" +
        ".pmv-codex .pmv-assess{grid-template-columns:1fr;}" +
        ".pmv-codex .pmv-mini{flex:0 0 45vw;}" +
        ".pmv-codex .pmv-section{margin:10px 8px;padding:10px;}" +
      "}" +
      "@media (max-width:480px) and (orientation:landscape){" +
        ".pmv-codex .pmv-hero{height:160px;}" +
        ".pmv-codex .pmv-hero-name-zh{font-size:clamp(24px,8vh,40px);}" +
      "}" +
      "@media (max-width:768px){" +
        ".pmv-compare-modal .pmv-compare-body{grid-template-columns:1fr;padding:10px;gap:10px;}" +
      "}";
    document.head.appendChild(s);
  }

  function escAttr(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
  function escTxt(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  /* CSSOS_PERSON_MV_WAVE5 20260507 — compact count formatter (1.2k / 1.2M) */
  function fmtCount(n){ var x = Number(n||0); if (x >= 1e6) return (x/1e6).toFixed(1).replace(/\.0$/,'')+"M"; if (x >= 1e3) return (x/1e3).toFixed(1).replace(/\.0$/,'')+"k"; return String(x); }

  async function openCodex(personId) {
    if (!personId) return;
    var pnl = ensurePanel();
    pnl.classList.remove("hidden");
    pnl.style.display = "";
    pnl.style.pointerEvents = "";
    ensureCodexStyles();
    codexState.activeId = personId;
    try { history.replaceState(null, "", "#person-mv/codex/" + encodeURIComponent(personId)); } catch (_e) {}

    var body = pnl.querySelector(".panel-body");
    if (!body) return;
    // hide grid + toolbar; show codex
    var toolbar = body.querySelector(".person-mv-toolbar");
    var grid = body.querySelector(".person-mv-grid");
    var createTip = body.querySelector(".person-mv-create-anybody");
    if (toolbar) toolbar.style.display = "none";
    if (grid) grid.style.display = "none";
    if (createTip) createTip.style.display = "none";

    var host = body.querySelector(".pmv-codex");
    if (!host) {
      host = document.createElement("div");
      host.className = "pmv-codex";
      body.appendChild(host);
    }
    host.style.display = "";
    host.innerHTML = '<div class="pmv-skel">' + escTxt(tt("Loading codex…", "正在加载文明档案…")) + '</div>';

    var refresh = false;
    await renderCodex(host, personId, refresh);
  }

  function closeCodex() {
    if (!panelEl) return;
    var body = panelEl.querySelector(".panel-body");
    if (!body) return;
    var toolbar = body.querySelector(".person-mv-toolbar");
    var grid = body.querySelector(".person-mv-grid");
    var createTip = body.querySelector(".person-mv-create-anybody");
    var host = body.querySelector(".pmv-codex");
    if (toolbar) toolbar.style.display = "";
    if (grid) grid.style.display = "";
    if (createTip) createTip.style.display = "";
    if (host) host.style.display = "none";
    codexState.activeId = null;
    try { history.replaceState(null, "", "#"); } catch (_e) {}
  }

  async function renderCodex(host, personId, refresh) {
    try {
      var url = "/api/person-mv/persons/" + encodeURIComponent(personId) + "/codex" + (refresh ? "?refresh=1" : "");
      var res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
      var json = await res.json().catch(function(){ return null; });
      if (!json || !json.ok) {
        host.innerHTML = '<div class="pmv-skel">' + escTxt(tt("Failed to load codex.", "档案加载失败。")) +
          ' <button class="pmv-back">' + escTxt(tt("Back", "返回")) + '</button></div>';
        wireBack(host);
        return;
      }
      var data = json.data || {};
      var p = data.person || {};
      var lore = data.lore || {};
      var portrait = data.portrait_url || "";
      var symbols = (p.visual_symbols || []).join(" ");
      var meta = [p.lifespan, p.civilization, p.era].filter(Boolean).join(" · ");
      var influence = Math.max(0, Math.min(100, Number(p.influence_score || 0)));

      var heroBg = portrait
        ? '<img src="' + escAttr(portrait) + '" alt="" loading="lazy" decoding="async" />'
        : '<div class="pmv-chip-fallback" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">' + escTxt(symbols.slice(0, 16)) + '</div>';

      /* CSSOS_WAVE_110_HERO_LOCALE 20260510 — Jing
       * Big hero name = the user's CURRENT UI locale (English UI →
       * "Confucius", Chinese UI → "孔子", etc.). The subtitle shows
       * the person's MOTHER-TONGUE name (always native, regardless
       * of UI), so a Japanese visitor still sees "孔子" beneath
       * "Confucius". The third line (Latin/pinyin) is the romanised
       * transliteration when distinct from both. */
      var primaryHeroName = localizedName(p);
      var nativeName = p.name_zh || p.name_en || personId;
      var nameNative = (nativeName && nativeName !== primaryHeroName) ? nativeName : "";
      // Treat name_native as a deeper-native string (e.g. Sanskrit) when
      // it's different from both displayed names.
      if (p.name_native && p.name_native !== primaryHeroName && p.name_native !== nameNative) {
        nameNative = nameNative ? (nameNative + " · " + p.name_native) : p.name_native;
      }
      var nameLatin = p.name_latin
        || (p.name_en && p.name_en !== primaryHeroName && p.name_en !== nameNative ? p.name_en : "");
      // Backwards-compatible alias used by the original markup string.
      var nameZh = primaryHeroName;

      var loreEmpty = !lore || (!lore.bio && !(Array.isArray(lore.events) && lore.events.length));

      var h = "";
      // CSSOS_PERSON_MV_WAVE8 20260507 — Wikipedia image attribution when
      // lore was grounded in wiki (portrait often is too — wiki originalimage).
      var heroAttr = (lore && String(lore.source||"") === "wiki+llm")
        ? '<div class="pmv-hero-attribution">' + escTxt(tt("Image: Wikipedia / CC-BY-SA", "图源：Wikipedia / CC-BY-SA")) + '</div>'
        : '';
      h += '<div class="pmv-hero">' + heroBg +
        '<div class="pmv-hero-overlay">' +
          '<div class="pmv-hero-name-zh">' + escTxt(nameZh) + '</div>' +
          (nameNative ? '<div class="pmv-hero-name-native">' + escTxt(nameNative) + '</div>' : '') +
          (nameLatin ? '<div class="pmv-hero-name-latin">' + escTxt(nameLatin) + '</div>' : '') +
          '<div class="pmv-chip-row">' +
            (meta ? '<span class="pmv-chip">' + escTxt(meta) + '</span>' : '') +
            '<span class="pmv-chip">' + escTxt(tt("Influence", "影响力")) + ' · ' + influence + '</span>' +
          '</div>' +
          '<div class="pmv-influence-bar"><div class="pmv-influence-fill" style="width:' + influence + '%"></div></div>' +
        '</div>' +
        heroAttr +
      '</div>';

      h += '<div class="pmv-action-bar">' +
        '<button class="pmv-cinema">🎬 ' + escTxt(tt("Enter Cinema", "进入影院")) + '</button>' +
        '<button class="pmv-secondary pmv-create-mv">✨ ' + escTxt(tt("Create New Version", "创作新版本")) + '</button>' +
        '<button class="pmv-secondary pmv-compare">🔀 ' + escTxt(tt("Compare with another", "与他人对比")) + '</button>' +
        '<button class="pmv-back">← ' + escTxt(tt("Back", "返回")) + '</button>' +
      '</div>';

      // CSSOS_PERSON_MV_WAVE16 20260508 — Jing — schools/groups chips.
      var groups = Array.isArray(data.groups) ? data.groups : [];
      if (groups.length) {
        h += '<div class="pmv-section"><h3>🏛 ' + escTxt(tt("Schools / Groups", "所属流派")) + '</h3>' +
          '<div class="pmv-chip-row">' +
            groups.map(function(g){
              var icon = (g.visual_theme && g.visual_theme.icon) ? String(g.visual_theme.icon) + ' ' : '';
              var label = icon + (g.name_zh || g.name_en || g.group_id) + (g.role ? ' · ' + g.role : '');
              return '<span class="pmv-chip" data-group-id="' + escAttr(g.group_id) + '" style="cursor:pointer;">' + escTxt(label) + '</span>';
            }).join("") +
          '</div></div>';
      }

      if (loreEmpty) {
        h += '<div class="pmv-section"><div class="pmv-skel">' +
          escTxt(tt("Codex is being generated.", "档案正在生成中。")) +
          ' <button class="pmv-secondary pmv-retry">' + escTxt(tt("Retry", "重试")) + '</button></div></div>';
      } else {
        if (lore.bio) {
          // CSSOS_PHASE2_WIKI_FEEDER 20260507 — Wave 2.6 — Jing
          // Source chip surfaces whether lore is grounded in Wikipedia or
          // is pure-LLM (Wave 3 ad-hoc persons). Defaults to llm-only when
          // the field is absent (older cached lore).
          var loreSrc = String(lore.source || "llm-only");
          var sourceChip = loreSrc === "wiki+llm"
            ? '<div class="pmv-source-chip">📖 ' + escTxt(tt("Sources: Wikipedia + AI", "资料来源：维基百科 + AI")) + '</div>'
            : '<div class="pmv-source-chip">✨ ' + escTxt(tt("Sources: AI-generated", "资料来源：AI 生成")) + '</div>';
          h += '<div class="pmv-section"><h3>' + escTxt(tt("Biography", "生平")) + '</h3>' +
            '<div class="pmv-bio">' + escTxt(lore.bio) + '</div>' +
            sourceChip + '</div>';
        }
        if (Array.isArray(lore.events) && lore.events.length) {
          h += '<div class="pmv-section"><h3>' + escTxt(tt("Timeline", "重要事件")) + '</h3>' +
            '<div class="pmv-timeline">' +
              lore.events.map(function(ev){
                return '<div class="pmv-event">' +
                  '<div class="pmv-event-year">' + escTxt(ev.year || "") + '</div>' +
                  '<div class="pmv-event-title">' + escTxt(ev.title || "") + '</div>' +
                  '<div class="pmv-event-impact">' + escTxt(ev.impact || "") + '</div>' +
                '</div>';
              }).join("") +
            '</div></div>';
        }
        var contribs = Array.isArray(lore.contributions) ? lore.contributions : [];
        var controv = Array.isArray(lore.controversies) ? lore.controversies : [];
        if (contribs.length || controv.length) {
          h += '<div class="pmv-two-col">' +
            '<div class="pmv-section"><h3>🌟 ' + escTxt(tt("Contributions", "贡献")) + '</h3>' +
              '<ul class="pmv-list">' + contribs.map(function(c){ return '<li>' + escTxt(c) + '</li>'; }).join("") + '</ul></div>' +
            '<div class="pmv-section"><h3>⚠️ ' + escTxt(tt("Controversies", "争议")) + '</h3>' +
              '<ul class="pmv-list">' + controv.map(function(c){ return '<li>' + escTxt(c) + '</li>'; }).join("") + '</ul></div>' +
          '</div>';
        }
        if (Array.isArray(lore.assessments) && lore.assessments.length) {
          h += '<div class="pmv-section"><h3>' + escTxt(tt("Assessments", "多视角评说")) + '</h3>' +
            '<div class="pmv-assess">' +
              lore.assessments.map(function(a){
                return '<div class="pmv-assess-card">' +
                  '<div class="pmv-assess-perspective">' + escTxt(a.perspective || "") + '</div>' +
                  '<div class="pmv-assess-text">' + escTxt(a.text || "") + '</div>' +
                '</div>';
              }).join("") +
            '</div></div>';
        }
      }

      // MV gallery
      var mvs = Array.isArray(data.mvs) ? data.mvs : [];
      var totalCount = data.total_mv_count || mvs.length || 0;
      var myCount = data.my_mv_count || 0;
      h += '<div class="pmv-section"><h3>🎞 ' + escTxt(tt("MV Gallery", "MV 作品")) + '</h3>' +
        '<div class="pmv-leaderboard" data-leaderboard-host="1">' +
          '<span>🏆 ' + escTxt(tt("Top creators loading…", "榜单加载中…")) + '</span>' +
        '</div>' +
        '<div class="pmv-mv-tabs">' +
          '<span class="pmv-mv-tab is-active" data-mv-tab="all">' + escTxt(tt("All", "全站")) + ' · ' + totalCount + '</span>' +
          '<span class="pmv-mv-tab" data-mv-tab="mine">' + escTxt(tt("Mine", "我的")) + ' · ' + myCount + '</span>' +
        '</div>';
      if (!mvs.length) {
        h += '<div class="pmv-empty-mv">' + escTxt(tt("No MV yet — be the first to create one?", "还没有人为TA创作 MV，做第一个？")) +
          ' <button class="pmv-secondary pmv-create-mv">✨ ' + escTxt(tt("Create now", "立即创作")) + '</button></div>';
      } else {
        // CSSOS_PHASE2_MV_CARD_POSTER 20260507 — Wave 2.6 polish — Jing
        // Use cover_image (canonical field across app.js) with
        // preview_image_url fallback. On <img> error, swap to a gradient
        // + emoji placeholder so a broken/missing asset never produces a
        // blank card.
        var personEmoji = (p && p.visual_symbols && p.visual_symbols[0]) || "🎞";
        // CSSOS_PERSON_MV_WAVE13 20260508 — official samples float to the front
        // so brand-new visitors see a curated reference MV before user-made ones.
        mvs = mvs.slice().sort(function(a, b){
          var ao = a && a.is_official_sample ? 1 : 0;
          var bo = b && b.is_official_sample ? 1 : 0;
          if (ao !== bo) return bo - ao;
          return 0;
        });
        var firstSample = null;
        h += '<div class="pmv-mv-grid">' +
          mvs.map(function(m){
            var poster = m.cover_image || m.preview_image_url || "";
            var creatorName = m.creator_display_name || tt("Anon", "匿名");
            var creatorAvatar = m.creator_avatar_url || "";
            var creatorChip = '<div class="pmv-mv-creator">' +
              '<span class="pmv-mv-creator-avatar"' + (creatorAvatar ? ' style="background-image:url(' + escAttr(creatorAvatar) + ')"' : '') + '></span>' +
              '<span>' + escTxt(creatorName) + '</span>' +
            '</div>';
            // CSSOS_PERSON_MV_WAVE5 20260507 — view+like badge bottom-right
            var statsBadge = '<div class="pmv-mv-stats">👁 ' + escTxt(fmtCount(m.view_count)) +
              ' · ❤️ ' + escTxt(fmtCount(m.like_count)) + '</div>';
            // CSSOS_PERSON_MV_WAVE12B 20260508 — comments + share buttons; the
            // app.person-mv-comments-share.js decorator listens via data-cssos-mv-* attrs.
            var mvId = String(m.mv_id || "");
            var actions = '<div class="pmv-mv-actions">' +
              '<button class="pmv-mv-icon" data-cssos-mv-comments="' + escAttr(mvId) + '" aria-label="Comments">💬 ' + escTxt(fmtCount(m.comment_count || 0)) + '</button>' +
              '<button class="pmv-mv-icon" data-cssos-mv-share="' + escAttr(mvId) + '" aria-label="Share">🔗</button>' +
            '</div>';
            var ribbon = m.is_official_sample
              ? '<div class="pmv-mv-ribbon">🌟 ' + escTxt(tt("Official sample · beat it", "官方示例 · 一键超越")) + '</div>'
              : "";
            if (m.is_official_sample && !firstSample) firstSample = m;
            var inner;
            if (poster) {
              inner = '<img class="pmv-mv-poster" src="' + escAttr(poster) + '" alt="" loading="lazy" decoding="async" ' +
                'onerror="this.parentNode.innerHTML=\'<div class=&quot;pmv-mv-fallback&quot;>' +
                escAttr(String(personEmoji)) + '</div>\';">' +
                creatorChip + statsBadge + ribbon + actions +
                '<div class="pmv-mv-meta">' + escTxt((m.duration_secs || 0) + "s") + '</div>';
            } else {
              inner = '<div class="pmv-mv-fallback">' + escTxt(String(personEmoji)) + '</div>' +
                creatorChip + statsBadge + ribbon + actions +
                '<div class="pmv-mv-meta">' + escTxt((m.duration_secs || 0) + "s") + '</div>';
            }
            var cardCls = "pmv-mv-card" + (m.is_official_sample ? " is-official-sample" : "");
            return '<div class="' + cardCls + '" data-work-id="' + escAttr(m.work_id) + '">' +
              inner + '</div>';
          }).join("") +
        '</div>';
        if (firstSample) {
          h += '<div class="pmv-sample-cta">' +
            '<button class="pmv-create-mv">✨ ' + escTxt(tt("Create my version", "创作我的版本")) + '</button>' +
          '</div>';
        }
      }
      h += '</div>';

      /* CSSOS_PERSON_MV_WAVE14 20260508 — Jing
       * Dialogue MV gallery — surfaced from EITHER person's codex.
       * Each card shows the split portrait and links to the other person. */
      var dialogueMvs = Array.isArray(data.dialogue_mvs) ? data.dialogue_mvs : [];
      if (dialogueMvs.length) {
        h += '<div class="pmv-section"><h3>⚔️ ' + escTxt(tt("Dialogue MVs", "对话 MV")) + '</h3>' +
          '<div class="pmv-mv-grid">' +
          dialogueMvs.map(function(d){
            var poster = d.cover_image || "";
            var aName = d.a_name_zh || d.a_name_en || "";
            var bName = d.b_name_zh || d.b_name_en || "";
            // Click jumps to the OTHER person's codex (whichever is not current).
            var otherId = (d.person_a_id === p.person_id) ? d.person_b_id : d.person_a_id;
            var statsBadge = '<div class="pmv-mv-stats">👁 ' + escTxt(fmtCount(d.view_count || 0)) +
              ' · ❤️ ' + escTxt(fmtCount(d.like_count || 0)) + '</div>';
            var ribbon = '<div class="pmv-mv-ribbon" style="background:linear-gradient(135deg,#00f5a0,#ff6699);color:#001b14;">⚔️ ' +
              escTxt(tt("Dialogue", "对话")) + '</div>';
            var meta = '<div class="pmv-mv-meta">' + escTxt(aName + " ↔ " + bName) + '</div>';
            var inner;
            if (poster) {
              inner = '<img class="pmv-mv-poster" src="' + escAttr(poster) + '" alt="" loading="lazy" decoding="async" ' +
                'onerror="this.parentNode.innerHTML=\'<div class=&quot;pmv-mv-fallback&quot;>⚔️</div>\';">' +
                statsBadge + ribbon + meta;
            } else {
              inner = '<div class="pmv-mv-fallback">⚔️</div>' + statsBadge + ribbon + meta;
            }
            return '<div class="pmv-mv-card" data-work-id="' + escAttr(d.work_id) +
              '" data-codex-jump="' + escAttr(otherId) + '">' + inner + '</div>';
          }).join("") +
          '</div></div>';
      }

      // Contemporaries
      var contemp = Array.isArray(data.contemporaries) ? data.contemporaries : [];
      if (contemp.length) {
        h += '<div class="pmv-section"><h3>🌐 ' + escTxt(tt("Contemporaries (other civilizations)", "同时代 · 异文明")) + '</h3>' +
          '<div class="pmv-mini-row">' +
            contemp.map(function(c){
              return '<div class="pmv-mini" data-codex-jump="' + escAttr(c.person_id) + '">' +
                '<div class="pmv-mini-name">' + escTxt(c.name_zh || c.name_en) + '</div>' +
                '<div class="pmv-mini-meta">' + escTxt([c.civilization, c.era].filter(Boolean).join(" · ")) + '</div>' +
              '</div>';
            }).join("") +
          '</div></div>';
      }
      // Lineage
      var lineage = Array.isArray(data.lineage) ? data.lineage : [];
      if (lineage.length) {
        h += '<div class="pmv-section"><h3>🧬 ' + escTxt(tt("Same-civilization lineage", "同文明谱系")) + '</h3>' +
          '<div class="pmv-mini-row">' +
            lineage.map(function(c){
              return '<div class="pmv-mini" data-codex-jump="' + escAttr(c.person_id) + '">' +
                '<div class="pmv-mini-name">' + escTxt(c.name_zh || c.name_en) + '</div>' +
                '<div class="pmv-mini-meta">' + escTxt([c.civilization, c.era].filter(Boolean).join(" · ")) + '</div>' +
              '</div>';
            }).join("") +
          '</div></div>';
      }

      host.innerHTML = h;
      wireBack(host);

      /* CSSOS_PERSON_MV_CINEMA_FIRST 20260507 — Jing
       * Unified cinema entry. Both 🎬 and ✨ "Create New Version" /
       * empty-state "Create now" funnel here. Pipeline UI is NEVER
       * shown to the user; if forceNew or queue is empty, the run
       * fires silently in the background and the cinema black screen
       * shows the person hero + spinner until the first MV finishes.
       */
      function enterCinemaForPerson(opts) {
        opts = opts || {};
        var seed = buildSeed(p, lore);
        applyCivHints(p.civilization);
        var queue = opts.forceNew
          ? []
          : mvs.map(function(m){ return m.work_id; }).filter(Boolean);
        // CSSOS_PERSON_MV_CINEMA_INTRO 20260507 — Jing
        // Build a short person intro for cinema's loading hero. Source
        // priority: lore.bio first sentence > core_theme > roles join.
        // Truncated to ~80 chars with ellipsis.
        var personIntro = "";
        try {
          var bio = lore && typeof lore.bio === "string" ? lore.bio : "";
          if (bio) {
            var firstSent = bio.split(/[。.!?！？\n]/)[0];
            if (firstSent) personIntro = firstSent.trim();
          }
          if (!personIntro && p.core_theme) personIntro = String(p.core_theme).trim();
          if (!personIntro && Array.isArray(p.roles) && p.roles.length) {
            personIntro = p.roles.filter(Boolean).join("·");
          }
          if (personIntro && personIntro.length > 80) {
            personIntro = personIntro.slice(0, 79).replace(/\s+\S*$/, "") + "…";
          }
        } catch (_e) {}
        if (typeof globalThis.openMvPipelinePanel === "function") {
          globalThis.openMvPipelinePanel({
            cinema: true,
            queue: queue,
            personId: p.person_id,
            seed: seed,
            forceNew: !!opts.forceNew,
            personName: nameZh,
            personNameEn: nameLatin || p.name_en || "",
            personNameNative: nameNative,
            personEra: p.era || "",
            personCiv: p.civilization || "",
            personPortrait: portrait || "",
            personIntro: personIntro,
          });
        }
      }
      var cinemaBtn = host.querySelector(".pmv-cinema");
      if (cinemaBtn) {
        cinemaBtn.addEventListener("click", async function(){
          if (!(await requireSignedInForAction("cinema"))) return;
          enterCinemaForPerson({ forceNew: false });
        });
      }
      // Create-new-version button(s) — also enter cinema, force fresh gen.
      host.querySelectorAll(".pmv-create-mv").forEach(function(btn){
        btn.addEventListener("click", async function(){
          if (!(await requireSignedInForAction("create"))) return;
          enterCinemaForPerson({ forceNew: true });
        });
      });
      // Retry
      var retryBtn = host.querySelector(".pmv-retry");
      if (retryBtn) {
        retryBtn.addEventListener("click", function(){
          host.innerHTML = '<div class="pmv-skel">' + escTxt(tt("Generating codex…", "正在生成档案…")) + '</div>';
          renderCodex(host, personId, true);
        });
      }
      // Mini cards → jump to that person's codex
      host.querySelectorAll("[data-codex-jump]").forEach(function(el){
        el.addEventListener("click", function(){
          var pid = el.getAttribute("data-codex-jump");
          if (pid) openCodex(pid);
        });
      });
      // CSSOS_PERSON_MV_WAVE16 20260508 — Jing — group chips → group page.
      host.querySelectorAll("[data-group-id]").forEach(function(el){
        el.addEventListener("click", function(){
          var gid = el.getAttribute("data-group-id");
          if (gid && typeof globalThis.openPersonMvGroup === "function") {
            try { globalThis.openPersonMvGroup(gid); } catch (_e) {}
          }
        });
      });
      // Compare button → modal
      var compareBtn = host.querySelector(".pmv-compare");
      if (compareBtn) {
        compareBtn.addEventListener("click", async function () {
          if (!(await requireSignedInForAction("compare"))) return;
          openCompareModal(p.person_id, data);
        });
      }
      // Leaderboard ribbon — fetch top creators async, render into placeholder.
      try {
        var lbHost = host.querySelector('[data-leaderboard-host="1"]');
        if (lbHost) {
          fetch("/api/person-mv/persons/" + encodeURIComponent(personId) + "/leaderboard?limit=3", {
            credentials: "include",
            headers: { Accept: "application/json" },
          }).then(function(r){ return r.json(); }).then(function(j){
            if (!j || !j.ok || !j.data || !Array.isArray(j.data.creators) || !j.data.creators.length) {
              lbHost.innerHTML = '<span>🏆 ' + escTxt(tt("Be the first creator!", "成为首位创作者！")) + '</span>';
              return;
            }
            var creators = j.data.creators;
            // CSSOS_PERSON_MV_WAVE5 20260507 — show total_view_count under name
            var html = '<span>🏆 ' + escTxt(tt("Top creators", "榜单")) + '</span>';
            html += creators.map(function(c, i){
              var name = c.display_name || tt("Anon", "匿名");
              var av = c.avatar_url || "";
              var medal = i === 0 ? "🥇" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : ""));
              var views = fmtCount(c.total_view_count || 0);
              return '<span class="pmv-lb-creator">' +
                '<span class="pmv-lb-avatar"' + (av ? ' style="background-image:url(' + escAttr(av) + ')"' : '') + '></span>' +
                '<span>' + (medal ? medal + ' ' : '') + escTxt(name) + ' · 👁 ' + views + ' · ' + (c.mv_count || 0) + ' MV</span>' +
              '</span>';
            }).join("");
            lbHost.innerHTML = html;
          }).catch(function(){
            lbHost.innerHTML = '';
          });
        }
      } catch (_e) {}
    } catch (err) {
      console.warn("[person-mv] codex render failed", err);
      host.innerHTML = '<div class="pmv-skel">' + escTxt(tt("Codex unavailable.", "档案暂不可用。")) +
        ' <button class="pmv-back">' + escTxt(tt("Back", "返回")) + '</button></div>';
      wireBack(host);
    }
  }

  function wireBack(host) {
    host.querySelectorAll(".pmv-back").forEach(function(btn){
      btn.addEventListener("click", closeCodex);
    });
  }

  /* CSSOS_PERSON_MV_COMPARE 20260507 — Wave 4 — Jing
   * Cross-person compare. Re-uses /codex twice, no new backend.
   * User picks the "other" person via autocomplete or preset chip.
   * Renders 贡献 / 争议 / 三视角 stacked side-by-side. */
  var COMPARE_PRESETS = [
    { left: "kongzi",       right: "socrates",  label: "孔子 ↔ 苏格拉底" },
    { left: "qinshihuang",  right: "caesar",    label: "秦始皇 ↔ 凯撒" },
    { left: "einstein",     right: "newton",    label: "爱因斯坦 ↔ 牛顿" },
  ];
  function openCompareModal(leftPersonId, leftData) {
    var existing = document.querySelector(".pmv-compare-modal");
    if (existing) try { existing.remove(); } catch (_e) {}
    var modal = document.createElement("div");
    modal.className = "pmv-compare-modal";
    modal.innerHTML =
      '<div class="pmv-compare-card">' +
        '<div class="pmv-compare-head">' +
          '<div>🔀 ' + escTxt(tt("Compare two people", "双人对比")) + '</div>' +
          '<button class="pmv-compare-close">' + escTxt(tt("Close", "关闭")) + '</button>' +
        '</div>' +
        '<div style="padding:14px 14px 0">' +
          '<div class="pmv-compare-presets">' +
            COMPARE_PRESETS.map(function(p){
              return '<span class="pmv-compare-preset" data-left="' + escAttr(p.left) + '" data-right="' + escAttr(p.right) + '">' + escTxt(p.label) + '</span>';
            }).join("") +
          '</div>' +
          '<div class="pmv-compare-search">' +
            '<input type="search" placeholder="' + escAttr(tt("Search the other person…", "搜索另一位人物…")) + '" />' +
          '</div>' +
          '<div class="pmv-compare-results"></div>' +
        '</div>' +
        '<div class="pmv-compare-body" data-compare-body="1">' +
          '<div class="pmv-compare-pane" data-pane="left">' + escTxt(tt("Loading…", "加载中…")) + '</div>' +
          '<div class="pmv-compare-pane" data-pane="right">' + escTxt(tt("Pick someone above to compare.", "在上方选择要对比的人物。")) + '</div>' +
        '</div>' +
        /* CSSOS_PERSON_MV_WAVE14 20260508 — dialogue MV CTA */
        '<div class="pmv-compare-dialogue" style="padding:10px 14px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;border-top:1px solid rgba(0,245,160,.18);">' +
          '<button class="pmv-compare-dialogue-btn" disabled style="cursor:not-allowed;opacity:.55;background:linear-gradient(135deg,#00f5a0,#ff6699);color:#001b14;border:0;border-radius:10px;padding:10px 22px;font:700 14px/1.2 ui-monospace,monospace;">' +
            '🎬 ' + escTxt(tt("Generate dialogue MV", "生成对话 MV")) +
          '</button>' +
          '<div class="pmv-compare-dialogue-status" style="font:500 11px/1.3 ui-monospace,monospace;color:#9ad6c0;text-align:center;">' +
            escTxt(tt("Pick the second person to enable.", "选择另一位人物以启用。")) +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function(e){
      if (e.target === modal) try { modal.remove(); } catch (_e) {}
    });
    modal.querySelector(".pmv-compare-close").addEventListener("click", function(){
      try { modal.remove(); } catch (_e) {}
    });

    function paneHtml(d) {
      if (!d || !d.person) return escTxt(tt("Not found.", "未找到。"));
      var pp = d.person;
      var lore = d.lore || {};
      var portrait = d.portrait_url || "";
      var contribs = Array.isArray(lore.contributions) ? lore.contributions : [];
      var controv = Array.isArray(lore.controversies) ? lore.controversies : [];
      var assess = Array.isArray(lore.assessments) ? lore.assessments : [];
      var nameMain = pp.name_zh || pp.name_en;
      var nameAlt = pp.name_en && pp.name_en !== nameMain ? pp.name_en : "";
      var head = (portrait
        ? '<div style="width:100%;aspect-ratio:16/9;background:#012019 url(' + escAttr(portrait) + ') center/cover no-repeat;border-radius:8px;margin-bottom:8px;"></div>'
        : '');
      return head +
        '<h4>' + escTxt(nameMain) + (nameAlt ? ' <span style="font:500 12px ui-monospace,monospace;color:#9ad6c0">(' + escTxt(nameAlt) + ')</span>' : '') + '</h4>' +
        '<div style="font:500 11px ui-monospace,monospace;color:#9ad6c0">' + escTxt([pp.civilization, pp.era, pp.lifespan].filter(Boolean).join(" · ")) + '</div>' +
        '<h5>🌟 ' + escTxt(tt("Contributions", "贡献")) + '</h5>' +
        '<ul>' + contribs.map(function(c){ return '<li>' + escTxt(c) + '</li>'; }).join("") + '</ul>' +
        '<h5>⚠️ ' + escTxt(tt("Controversies", "争议")) + '</h5>' +
        '<ul>' + controv.map(function(c){ return '<li>' + escTxt(c) + '</li>'; }).join("") + '</ul>' +
        '<h5>' + escTxt(tt("Assessments (3 perspectives)", "三视角评说")) + '</h5>' +
        '<ul>' + assess.map(function(a){ return '<li><b>' + escTxt(a.perspective || "") + '</b> · ' + escTxt(a.text || "") + '</li>'; }).join("") + '</ul>';
    }
    var leftPane = modal.querySelector('[data-pane="left"]');
    var rightPane = modal.querySelector('[data-pane="right"]');
    leftPane.innerHTML = paneHtml(leftData);

    /* CSSOS_PERSON_MV_WAVE14 20260508 — track current pair so the
     * dialogue MV button knows which two ids to POST. */
    var dialogueBtn = modal.querySelector(".pmv-compare-dialogue-btn");
    var dialogueStatus = modal.querySelector(".pmv-compare-dialogue-status");
    var currentLeftId = leftPersonId;
    var currentRightId = "";
    function refreshDialogueBtn() {
      if (!dialogueBtn) return;
      var ready = !!(currentLeftId && currentRightId && currentLeftId !== currentRightId);
      dialogueBtn.disabled = !ready;
      dialogueBtn.style.cursor = ready ? "pointer" : "not-allowed";
      dialogueBtn.style.opacity = ready ? "1" : ".55";
      if (dialogueStatus) {
        dialogueStatus.textContent = ready
          ? tt("Ready — generates 6 alternating verses, takes ~60s.", "已就绪——生成 6 段交替诗节，约需 60 秒。")
          : tt("Pick the second person to enable.", "选择另一位人物以启用。");
      }
    }

    async function loadAndRender(targetId, paneEl) {
      paneEl.innerHTML = escTxt(tt("Loading…", "加载中…"));
      try {
        var r = await fetch("/api/person-mv/persons/" + encodeURIComponent(targetId) + "/codex", {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        var j = await r.json().catch(function(){ return null; });
        if (!j || !j.ok) {
          paneEl.innerHTML = escTxt(tt("Failed.", "加载失败。"));
          return;
        }
        paneEl.innerHTML = paneHtml(j.data || {});
        if (paneEl === leftPane) currentLeftId = targetId;
        if (paneEl === rightPane) currentRightId = targetId;
        refreshDialogueBtn();
      } catch (err) {
        paneEl.innerHTML = escTxt(tt("Failed.", "加载失败。"));
      }
    }

    function pickRight(otherId, swapLeft) {
      if (swapLeft) {
        // Preset specifies both — load both panes.
        loadAndRender(swapLeft, leftPane);
      }
      loadAndRender(otherId, rightPane);
    }

    if (dialogueBtn) {
      dialogueBtn.addEventListener("click", async function(){
        if (dialogueBtn.disabled) return;
        if (!currentLeftId || !currentRightId) return;
        var origText = dialogueBtn.textContent;
        dialogueBtn.disabled = true;
        dialogueBtn.style.cursor = "wait";
        dialogueBtn.textContent = "⏳ " + tt("Generating…", "生成中…");
        if (dialogueStatus) dialogueStatus.textContent = tt("Pipeline running — cover, lyrics, music, compose.", "流水线运行中——封面 / 歌词 / 配乐 / 合成。");
        try {
          var r = await fetch("/api/person-mv/dialogue", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ person_a_id: currentLeftId, person_b_id: currentRightId }),
          });
          var raw = await r.text();
          // Trim any heartbeat whitespace prefix the server flushed for keep-alive.
          var firstBrace = raw.indexOf("{");
          var j = null;
          try { j = JSON.parse(firstBrace >= 0 ? raw.slice(firstBrace) : raw); } catch (_e) {}
          if (!j || !j.ok) {
            var msg = (j && j.message) || (j && j.code) || tt("Generation failed.", "生成失败。");
            if (dialogueStatus) dialogueStatus.textContent = "❌ " + msg;
            dialogueBtn.disabled = false;
            dialogueBtn.style.cursor = "pointer";
            dialogueBtn.textContent = origText;
            return;
          }
          if (dialogueStatus) dialogueStatus.textContent = "✅ " + tt("Done — opening cinema…", "完成——进入影院…");
          // Open cinema with the new work_id when available.
          try {
            if (j.work_id && typeof globalThis.openCinemaQueue === "function") {
              globalThis.openCinemaQueue([j.work_id]);
            } else if (j.mv_url) {
              window.open(j.mv_url, "_blank");
            }
          } catch (_e) {}
          setTimeout(function(){ try { modal.remove(); } catch (_e) {} }, 600);
        } catch (err) {
          if (dialogueStatus) dialogueStatus.textContent = "❌ " + tt("Network error.", "网络错误。");
          dialogueBtn.disabled = false;
          dialogueBtn.style.cursor = "pointer";
          dialogueBtn.textContent = origText;
        }
      });
    }

    modal.querySelectorAll(".pmv-compare-preset").forEach(function(el){
      el.addEventListener("click", function(){
        var l = el.getAttribute("data-left");
        var r = el.getAttribute("data-right");
        if (!r) return;
        // If user's current person matches preset.left, just load right.
        if (l && l !== leftPersonId) pickRight(r, l);
        else loadAndRender(r, rightPane);
      });
    });

    var searchInput = modal.querySelector(".pmv-compare-search input");
    var resultsEl = modal.querySelector(".pmv-compare-results");
    var debT = 0;
    searchInput.addEventListener("input", function(){
      clearTimeout(debT);
      var q = String(searchInput.value || "").trim();
      if (!q) { resultsEl.innerHTML = ""; return; }
      debT = setTimeout(async function(){
        try {
          var r = await fetch("/api/person-mv/persons?search=" + encodeURIComponent(q) + "&limit=12", {
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          var j = await r.json().catch(function(){ return null; });
          var rows = (j && j.data && j.data.persons) || [];
          rows = rows.filter(function(x){ return x.person_id !== leftPersonId; });
          resultsEl.innerHTML = rows.map(function(x){
            return '<div class="pmv-compare-result" data-pid="' + escAttr(x.person_id) + '">' +
              escTxt(x.name_zh || x.name_en) +
              ' <span style="color:#9ad6c0;font:500 11px ui-monospace,monospace">· ' + escTxt(x.civilization || "") + '</span>' +
            '</div>';
          }).join("");
          resultsEl.querySelectorAll(".pmv-compare-result").forEach(function(el){
            el.addEventListener("click", function(){
              var pid = el.getAttribute("data-pid");
              if (pid) loadAndRender(pid, rightPane);
            });
          });
        } catch (err) {
          resultsEl.innerHTML = "";
        }
      }, 220);
    });
  }

  /* CSSOS_PERSON_MV_NO_AUTO_RESTORE 20260507 — Jing
   * Removed the hash-on-init deep-link reader. It auto-popped the
   * codex of the last-clicked person on every page load, which the
   * user does NOT want. Hash WRITING in openCodex still keeps URLs
   * shareable; closeCodex/closeBtn now wipe the hash so a manual
   * reload starts clean. */

  globalThis.openPersonMvCodex = openCodex;

  // CSSOS_PERSON_MV_WAVE16 20260508 — Jing — group page render.
  // Renders a flat group view inside the codex host (members grid +
  // collective MV player). Reuses the same panel scaffolding as the
  // codex, so closing returns the user to the persons grid.
  async function openPersonMvGroup(groupId) {
    if (!groupId) return;
    open();
    var host = document.getElementById("cssos-person-codex-host");
    var grid = document.getElementById("cssos-person-mv-grid");
    var createTip = document.getElementById("cssos-person-mv-create-tip");
    if (!host) {
      host = document.createElement("div");
      host.id = "cssos-person-codex-host";
      host.className = "pmv-codex";
      var panelBody = document.querySelector("#cssos-person-mv-panel .panel-body") || document.querySelector("#cssos-person-mv-panel");
      if (panelBody) panelBody.appendChild(host);
    }
    if (grid) grid.style.display = "none";
    if (createTip) createTip.style.display = "none";
    host.style.display = "";
    host.innerHTML = '<div class="pmv-skel">' + escTxt(tt("Loading group…", "正在加载流派…")) + '</div>';
    try {
      var r = await fetch("/api/person-mv/groups/" + encodeURIComponent(groupId), {
        credentials: "include", headers: { Accept: "application/json" },
      });
      var json = await r.json().catch(function(){ return null; });
      if (!json || !json.ok) {
        host.innerHTML = '<div class="pmv-skel">' + escTxt(tt("Failed to load group.", "流派加载失败。")) +
          ' <button class="pmv-back">' + escTxt(tt("Back", "返回")) + '</button></div>';
        wireBack(host); return;
      }
      var d = json.data || {};
      var g = d.group || {};
      var members = Array.isArray(d.members) ? d.members : [];
      var mvs = Array.isArray(d.collective_mvs) ? d.collective_mvs : [];
      var icon = (g.visual_theme && g.visual_theme.icon) ? String(g.visual_theme.icon) : "🏛";
      var meta = [g.era, g.civilization].filter(Boolean).join(" · ");
      var description = g.description_zh || g.description_en || "";
      var color = (g.visual_theme && g.visual_theme.color) ? String(g.visual_theme.color) : "#00f5a0";

      var h = '<div class="pmv-hero" style="background:linear-gradient(135deg,#012019,' + escAttr(color) + '22);">' +
        '<div class="pmv-hero-overlay">' +
          '<div class="pmv-hero-name-zh">' + escTxt(icon + " " + (g.name_zh || g.name_en || groupId)) + '</div>' +
          (g.name_en && g.name_en !== g.name_zh ? '<div class="pmv-hero-name-latin">' + escTxt(g.name_en) + '</div>' : '') +
          '<div class="pmv-chip-row">' +
            (meta ? '<span class="pmv-chip">' + escTxt(meta) + '</span>' : '') +
            '<span class="pmv-chip">' + escTxt(tt("Members", "成员")) + ' · ' + members.length + '</span>' +
            '<span class="pmv-chip">' + escTxt(tt("Member MVs", "成员 MV")) + ' · ' + (d.member_mv_count || 0) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';

      h += '<div class="pmv-action-bar">' +
        '<button class="pmv-back">← ' + escTxt(tt("Back", "返回")) + '</button>' +
      '</div>';

      if (description) {
        h += '<div class="pmv-section"><h3>' + escTxt(tt("About", "简介")) + '</h3>' +
          '<div class="pmv-bio">' + escTxt(description) + '</div></div>';
      }

      // Collective MV player(s)
      if (mvs.length) {
        h += '<div class="pmv-section"><h3>🎼 ' + escTxt(tt("Collective MV", "流派合奏 MV")) + '</h3>';
        mvs.forEach(function(m){
          if (m.final_mv_url) {
            h += '<video controls preload="metadata" style="width:100%;border-radius:10px;background:#000;" poster="' + escAttr(m.cover_image || "") + '" src="' + escAttr(m.final_mv_url) + '"></video>';
          } else if (m.cover_image) {
            h += '<img src="' + escAttr(m.cover_image) + '" alt="" loading="lazy" decoding="async" style="width:100%;border-radius:10px;" />';
          }
        });
        h += '</div>';
      } else {
        h += '<div class="pmv-section"><div class="pmv-empty-mv">' +
          escTxt(tt("No collective MV yet — admins can trigger generation.", "暂无流派合奏 MV — 管理员可触发生成。")) +
          '</div></div>';
      }

      // Members grid
      h += '<div class="pmv-section"><h3>👥 ' + escTxt(tt("Members", "成员")) + '</h3>' +
        '<div class="pmv-mv-grid">' +
          members.map(function(m){
            var name = m.name_zh || m.name_en || m.person_id;
            var portrait = m.portrait_url || "";
            var roleChip = m.role ? ' · ' + m.role : '';
            return '<div class="pmv-mv-card" data-codex-jump="' + escAttr(m.person_id) + '">' +
              (portrait ? '<img class="pmv-mv-poster" src="' + escAttr(portrait) + '" loading="lazy" decoding="async" />' : '<div class="pmv-mv-fallback">🏛</div>') +
              '<div class="pmv-mv-meta">' + escTxt(name + roleChip) + '</div>' +
            '</div>';
          }).join("") +
        '</div></div>';

      host.innerHTML = h;
      wireBack(host);
      host.querySelectorAll("[data-codex-jump]").forEach(function(el){
        el.addEventListener("click", function(){
          var pid = el.getAttribute("data-codex-jump");
          if (pid) openCodex(pid);
        });
      });
    } catch (err) {
      console.warn("[person-mv] group render failed", err);
      host.innerHTML = '<div class="pmv-skel">' + escTxt(tt("Group unavailable.", "流派暂不可用。")) +
        ' <button class="pmv-back">' + escTxt(tt("Back", "返回")) + '</button></div>';
      wireBack(host);
    }
  }
  globalThis.openPersonMvGroup = openPersonMvGroup;

  /* CSSOS_PERSON_MV_AUTH_GATE 20260508 — Jing
   * Person MV panel requires sign-in. Prompt anonymous users to log in
   * before mounting the codex/grid. Detection: existing session check
   * via /api/auth/me (cssOS pattern); if 401 / no user, route to login. */
  /* CSSOS_WAVE_109I 20260509 — Jing
   * /api/me wraps in okData/okEmpty — payload lives at j.data, not
   * the top level. The previous check looked for j.user / j.id and
   * thus ALWAYS returned false (even for admins), which is why the
   * action gates kept firing despite Jing being signed in.
   *
   * Correct shape:
   *   authenticated:   { ok: true, data: { authenticated: true,  user: {...} } }
   *   unauthenticated: { ok: true, data: { authenticated: false, user: null  } }
   *
   * Cache the result for 30s so a flurry of action clicks doesn't
   * spam the endpoint. */
  var ensureSignedInCache = { at: 0, value: false };
  async function ensureSignedIn() {
    var now = Date.now();
    if (now - ensureSignedInCache.at < 30000) return ensureSignedInCache.value;
    var ok = false;
    try {
      var r = await fetch("/api/me", { credentials: "include" });
      if (r.ok) {
        var j = await r.json().catch(function () { return null; });
        var d = j && j.data ? j.data : j;
        if (d && (d.authenticated === true || d.user)) ok = true;
      }
    } catch (_e) {}
    ensureSignedInCache = { at: now, value: ok };
    return ok;
  }
  function promptSignIn(customMsg) {
    var msg = customMsg || tt(
      "Sign in to use People MV — your creations, likes & comments live in your account.",
      "请先登录使用「人物 MV 宇宙」—— 创作、点赞、评论需要绑定账号。"
    );
    try {
      if (typeof globalThis.openLoginPanel === "function") {
        globalThis.openLoginPanel({ reason: "person-mv", note: msg });
        return;
      }
    } catch (_e) {}
    /* Fallback: hash route to login + alert */
    try { location.hash = "#login?return=person-mv"; } catch (_e) {}
    try { alert(msg); } catch (_e) {}
  }

  /* CSSOS_WAVE_108_AUTH_GATE 20260509 — Jing
   * Per-action sign-in gate. Browsing is free; creating / opening
   * cinema / comparing requires a signed-in account. Returns true
   * if the user is signed in and the caller should proceed; returns
   * false (and shows the login panel) otherwise. */
  async function requireSignedInForAction(actionLabel) {
    var signedIn = await ensureSignedIn();
    if (signedIn) return true;
    var msg;
    if (actionLabel === "cinema") {
      msg = tt(
        "Sign in to enter the cinema — playback, watch parties and history are tied to your account.",
        "请先登录后进入影院——播放记录、放映厅和历史记录都需要账号。",
      );
    } else if (actionLabel === "create") {
      msg = tt(
        "Sign in to create — free accounts get 3 generations to start.",
        "请先登录开始创作——免费账号有 3 次生成额度。",
      );
    } else if (actionLabel === "compare") {
      msg = tt(
        "Sign in to compare — saved comparisons live in your account.",
        "请先登录后对比——对比记录会保存到你的账号。",
      );
    } else {
      msg = tt(
        "Sign in to continue — guests can browse, but actions need an account.",
        "请先登录继续——游客可浏览，互动需要账号。",
      );
    }
    promptSignIn(msg);
    return false;
  }
  async function open() {
    /* CSSOS_WAVE_108_GUEST_BROWSE 20260509 — Jing
     * Person MV panel is now open to everyone, including guests.
     * Login is gated at the action layer instead (appreciate / enter
     * cinema / create). The auth check below is a no-op for the
     * landing view; guard rails live in the click handlers per
     * action. */
    var p = ensurePanel();
    /* Reverse the close-time hide so re-opening fully reveals. */
    p.classList.remove("hidden");
    p.style.display = "";
    p.style.pointerEvents = "";
    if (typeof globalThis.bringPanelToFrontBridge === "function") {
      try { globalThis.bringPanelToFrontBridge(p, { repeatPasses: 3 }); } catch (_e) {}
    }
    if (!state.persons.length) load();
  }

  /* CSSOS_PERSON_MV_DOC_CAPTURE 20260507 — Jing
   * Last-resort: listen on the document at capture phase. The
   * dock dispatcher and any other handler lives on dock OR item,
   * but document.capture is THE FIRST listener every event hits
   * after the window. Whatever's intercepting on a deeper element
   * can't beat us here. */
  var docLastFire = 0;
  function installDocumentCapture() {
    if (globalThis.__cssosPersonMvDocBound) return;
    globalThis.__cssosPersonMvDocBound = true;
    function isMyDockItem(target) {
      return target && typeof target.closest === "function" &&
        target.closest('.dock-item[data-action="person-mv"]');
    }
    function dockFire(label, e) {
      var now = Date.now();
      if (now - docLastFire < 250) return;
      docLastFire = now;
      console.warn("[person-mv] document capture fire via", label);
      try { open(); } catch (err) { console.error("[person-mv] open threw", err); }
      try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch (_e) {}
    }
    document.addEventListener("pointerup", function (e) {
      if (e.button && e.button !== 0) return;
      if (isMyDockItem(e.target)) dockFire("doc.pointerup", e);
    }, true);
    document.addEventListener("click", function (e) {
      if (isMyDockItem(e.target)) dockFire("doc.click", e);
    }, true);
  }

  function init() {
    /* Use console.warn so the message survives "Errors only" filter
     * settings that hide console.info / console.log. */
    console.warn("[person-mv] init starting");
    try {
      ensureStyles();
      registerDockAction();
      installDocumentCapture();
      pollDockInsertion();
      console.warn("[person-mv] init complete — try cssosPersonMvForce() to bypass dock");
    } catch (err) {
      console.error("[person-mv] init threw:", err);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // Re-attempt dock injection if the dock renders later.
  if (document.body) {
    var mo = new MutationObserver(function () { ensureDockItem(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  globalThis.openPersonMvPanel = open;

  /* CSSOS_PERSON_MV_FORCE 20260507 — Jing
   * Diagnostic: call from DevTools console to bypass every event
   * path and force-open the panel. If THIS works but the dock click
   * doesn't, the dock event chain is the problem. If THIS fails,
   * ensurePanel/render is broken. */
  globalThis.cssosPersonMvForce = function () {
    console.info("[person-mv] force open() called");
    try {
      open();
      var p = document.getElementById("person-mv-panel");
      console.info("[person-mv] panel after force:", p, "hidden=", p && p.classList.contains("hidden"));
      return p;
    } catch (err) {
      console.error("[person-mv] force open threw:", err);
      return null;
    }
  };

  /* Diagnose dock item presence + listener wiring. */
  globalThis.cssosPersonMvDiag = function () {
    var dock = document.querySelector(".dock");
    var item = dock && dock.querySelector('.dock-item[data-action="person-mv"]');
    console.info("[person-mv] diag", {
      dock_exists: !!dock,
      item_exists: !!item,
      item_visible: item && getComputedStyle(item).display !== "none",
      doc_bound: !!globalThis.__cssosPersonMvDocBound,
      action_map_has: !!(globalThis.__cssosDockActionMap && globalThis.__cssosDockActionMap["person-mv"]),
    });
    return item;
  };
})();
