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
      "#person-mv-panel .person-mv-create-anybody{" +
        "margin:12px;padding:14px;border-radius:10px;" +
        "background:rgba(0,245,160,0.10);border:1px dashed rgba(0,245,160,0.45);" +
        "text-align:center;cursor:pointer;color:#daffee;" +
        "font:600 13px/1.3 -apple-system,system-ui,sans-serif;" +
      "}" +
      "#person-mv-panel .person-mv-create-anybody:hover{" +
        "background:rgba(0,245,160,0.18);" +
      "}";
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
    item.innerHTML =
      '<div class="dock-icon">🏛</div>' +
      '<div class="dock-label">' + (tt("People MV", "人物MV")) + '</div>';
    /* Capture-phase fallback in case __cssosDockActionMap registration
     * is overridden later. handleDockAction is the canonical path. */
    item.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      if (typeof globalThis.handleDockAction === "function") {
        try { globalThis.handleDockAction("person-mv", "click"); return; } catch (_err) {}
      }
      open();
    }, true);
    // Also wire pointerdown so phones/tablets that don't fire click
    // reliably (Safari iPad gestures) still open the panel.
    item.addEventListener("pointerdown", function (e) {
      // Only handle primary button + non-modifier; let the default
      // long-press / drag flow continue if it's something else.
      if (e.button && e.button !== 0) return;
      // We don't preventDefault here so the dock CSS hover styles run.
    }, true);
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
        '</div>' +
        '<div class="person-mv-create-anybody">' +
          tt("+ Create an MV for any person — even Aunt Mary or yourself.",
             "+ 为任何人创建 MV —— 哪怕隔壁张大爷或你自己") +
        '</div>' +
        '<div class="person-mv-grid"></div>' +
      '</div>';
    document.body.appendChild(panelEl);
    bindPanelEvents();
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
    if (closeBtn) closeBtn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      panelEl.classList.add("hidden");
    });
    if (minBtn) minBtn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      try { globalThis.minimizeToDockBridge?.(panelEl); }
      catch (_e) { panelEl.classList.add("hidden"); }
    });
    if (maxBtn) maxBtn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      try { globalThis.togglePanelMaximize?.(panelEl); } catch (_e) {}
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
        // Wave 3 lands the actual ad-hoc creation flow. For now we
        // scaffold a toast so the user sees their input was received.
        var msg = tt(
          "Wave 3 lands ad-hoc creation. Saved your name: ",
          "Wave 3 即将上线临时人物创建。已保存你的输入："
        ) + name.trim();
        if (typeof globalThis.showToast === "function") globalThis.showToast(msg);
        else alert(msg);
      });
    }
    grid.addEventListener("click", function (e) {
      var card = e.target?.closest?.(".person-mv-card");
      if (!card) return;
      var pid = card.getAttribute("data-person-id");
      if (!pid) return;
      // Wave 2 will jump into the MV PIPELINE pre-filled. Toast for now.
      var msg = tt(
        "Wave 2 will jump into MV PIPELINE for: ",
        "Wave 2 将打开 MV PIPELINE 面板，主角："
      ) + pid;
      if (typeof globalThis.showToast === "function") globalThis.showToast(msg);
      else console.info("[person-mv]", msg);
    });
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

  function render() {
    if (!panelEl) return;
    var grid = panelEl.querySelector(".person-mv-grid");
    if (!grid) return;
    if (!state.persons.length) {
      grid.innerHTML = '<div class="person-mv-empty">' +
        tt("No matching personalities yet — adjust filters or create one above.",
           "暂无匹配人物 —— 调整筛选条件，或在上方创建新人物。") +
        '</div>';
      return;
    }
    grid.innerHTML = state.persons.map(function (p) {
      var meta = [p.civilization, p.era].filter(Boolean).join(" · ");
      var primary = localizedName(p);
      var secondary = secondaryName(p);
      return (
        '<div class="person-mv-card" data-person-id="' + escapeAttr(p.person_id) + '">' +
          '<div class="person-mv-name">' + escapeText(primary) + '</div>' +
          (secondary ? '<div class="person-mv-name-en">' + escapeText(secondary) + '</div>' : '') +
          '<div class="person-mv-meta">' + escapeText(meta) + '</div>' +
          (p.core_theme ? '<div class="person-mv-theme">' + escapeText(p.core_theme) + '</div>' : '') +
          '<div class="person-mv-counts">' +
            '<span>' + tt("influence", "影响力") + ' · ' + (p.influence_score || 0) + '</span>' +
            '<span>' + tt("MVs", "MV") + ' · ' + (p.mv_count || 0) + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  function open() {
    var p = ensurePanel();
    p.classList.remove("hidden");
    if (typeof globalThis.bringPanelToFrontBridge === "function") {
      try { globalThis.bringPanelToFrontBridge(p, { repeatPasses: 3 }); } catch (_e) {}
    }
    if (!state.persons.length) load();
  }

  function init() {
    ensureStyles();
    registerDockAction();
    pollDockInsertion();
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
})();
