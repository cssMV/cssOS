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
      "#person-mv-panel .panel-actions .icon-btn{pointer-events:auto !important;cursor:pointer;}" +
      /* Bulletproof hide — when .hidden is on, no clicks. */
      "#person-mv-panel.hidden{display:none !important;pointer-events:none !important;}" +
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
    panelEl.innerHTML =
      '<div class="panel-bar">' +
        '<div class="panel-icon">🏛</div>' +
        '<div class="panel-title">' + (tt("People MV · Civilization Universe", "人物 MV · 文明宇宙")) + '</div>' +
        '<div class="panel-actions">' +
          '<button class="icon-btn" aria-label="minimize">—</button>' +
          '<button class="icon-btn" aria-label="maximize">⤢</button>' +
          '<button class="icon-btn" aria-label="close">×</button>' +
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
    if (createBtn) {
      createBtn.addEventListener("click", function () {
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
      if (state.civ) qs.set("civ", state.civ);
      if (state.search) qs.set("search", state.search);
      qs.set("limit", "200");
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
      var cta = grid.querySelector(".person-mv-adhoc-cta");
      if (cta) {
        cta.addEventListener("click", function () {
          var n = cta.getAttribute("data-adhoc-name") || typed;
          if (n) createAdhocPerson(n);
        });
      }
      return;
    }
    /* CSSOS_PERSON_MV_PER_CARD_LISTENER 20260507 — Jing
     * Reverted from panel-level delegation to per-card direct onclick.
     * The shared bridges (attachPanelDragBridge etc.) added document-
     * level pointer listeners that were eating my delegated events.
     * Each card gets its own onclick now — guaranteed to fire. */
    grid.innerHTML = "";
    state.persons.forEach(function (p) {
      var meta = [p.civilization, p.era].filter(Boolean).join(" · ");
      var primary = localizedName(p);
      var secondary = secondaryName(p);
      var card = document.createElement("div");
      card.className = "person-mv-card";
      card.setAttribute("data-person-id", p.person_id || "");
      card.innerHTML =
        '<div class="person-mv-name">' + escapeText(primary) + '</div>' +
        (secondary ? '<div class="person-mv-name-en">' + escapeText(secondary) + '</div>' : '') +
        '<div class="person-mv-meta">' + escapeText(meta) + '</div>' +
        (p.core_theme ? '<div class="person-mv-theme">' + escapeText(p.core_theme) + '</div>' : '') +
        '<div class="person-mv-counts">' +
          '<span>' + tt("influence", "影响力") + ' · ' + (p.influence_score || 0) + '</span>' +
          '<span>' + tt("MVs", "MV") + ' · ' + (p.mv_count || 0) + '</span>' +
        '</div>';
      // Direct listener — no delegation, no capture races.
      card.onclick = function (e) {
        console.warn("[person-mv] card.onclick", p.person_id);
        if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_e) {} }
        openCodex(p.person_id);
      };
      grid.appendChild(card);
    });
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
  function buildSeed(p, lore) {
    /* CSSOS_PERSON_MV_CINEMA_FIRST 20260507 — Jing
     * New prompt format (two lines):
     *   line 1: {name_zh}
     *   line 2: [{intro}]   ← lore.bio first sentence > core_theme > roles
     */
    var nameZh = localizedName(p);
    var intro = "";
    var bio = lore && typeof lore.bio === "string" ? lore.bio : "";
    if (bio) {
      var firstSent = bio.split(/[。.!?！？\n]/)[0];
      if (firstSent) intro = firstSent.trim();
    }
    if (!intro && p.core_theme) intro = String(p.core_theme).trim();
    if (!intro && Array.isArray(p.roles) && p.roles.length) {
      intro = p.roles.filter(Boolean).join("·");
    }
    var prompt = nameZh + (intro ? "\n[" + intro + "]" : "");
    return {
      prompt: prompt,
      style: p.music_style_hint || "",
      lyrics: "",
      __personId: p.person_id,
      __civilization: p.civilization,
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
      ".pmv-codex .pmv-hero-name-zh{font:800 32px/1.1 ui-serif,serif;color:#fff;letter-spacing:.04em;}" +
      ".pmv-codex .pmv-hero-name-native{font:600 18px/1.2 ui-serif,serif;color:#bff5dc;margin-top:4px;}" +
      ".pmv-codex .pmv-hero-name-latin{font:italic 500 13px/1.2 ui-serif,serif;color:#8edcc1;margin-top:2px;}" +
      ".pmv-codex .pmv-chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}" +
      ".pmv-codex .pmv-chip{background:rgba(0,245,160,0.15);border:1px solid rgba(0,245,160,0.35);border-radius:999px;padding:3px 10px;font:600 11px/1.4 ui-monospace,monospace;color:#daffee;}" +
      ".pmv-codex .pmv-chip-fallback{font-size:42px;letter-spacing:8px;opacity:.5;}" +
      ".pmv-codex .pmv-action-bar{display:flex;gap:10px;margin:0 12px 12px;flex-wrap:wrap;}" +
      ".pmv-codex .pmv-action-bar button{all:unset;cursor:pointer;padding:10px 18px;border-radius:10px;font:700 13px/1 ui-monospace,monospace;}" +
      ".pmv-codex .pmv-cinema{background:linear-gradient(135deg,#00f5a0,#00c280);color:#001b14;font-size:15px!important;padding:12px 22px!important;}" +
      /* CSSOS_PERSON_MV_BUG3 20260507 — Jing
       * Theme-aware action-bar buttons. Previous rules used fixed light
       * text on transparent backgrounds, which disappeared in light theme.
       * Now use cssOS theme tokens (--text, --border) so contrast holds
       * in both light and dark themes, with solid surface tints. */
      ".pmv-codex .pmv-secondary{background:var(--green-soft,rgba(0,245,160,.18));border:1px solid var(--border,rgba(0,245,160,.4));color:var(--text);}" +
      ".pmv-codex .pmv-back{background:var(--panel-strong,rgba(0,0,0,.45));border:1px solid var(--border,rgba(255,255,255,.2));color:var(--text);}" +
      ".pmv-codex .pmv-secondary:hover,.pmv-codex .pmv-back:hover{filter:brightness(1.08);}" +
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
        ? '<img src="' + escAttr(portrait) + '" alt="" />'
        : '<div class="pmv-chip-fallback" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">' + escTxt(symbols.slice(0, 16)) + '</div>';

      var nameZh = p.name_zh || p.name_en || personId;
      var nameNative = p.name_native && p.name_native !== nameZh ? p.name_native : "";
      var nameLatin = p.name_latin || (p.name_en && p.name_en !== nameZh ? p.name_en : "");

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
              inner = '<img class="pmv-mv-poster" src="' + escAttr(poster) + '" alt="" ' +
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
        cinemaBtn.addEventListener("click", function(){
          enterCinemaForPerson({ forceNew: false });
        });
      }
      // Create-new-version button(s) — also enter cinema, force fresh gen.
      host.querySelectorAll(".pmv-create-mv").forEach(function(btn){
        btn.addEventListener("click", function(){
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
      // Compare button → modal
      var compareBtn = host.querySelector(".pmv-compare");
      if (compareBtn) {
        compareBtn.addEventListener("click", function () {
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

  function open() {
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
