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
    /* CSSOS_PERSON_MV_BAR_BIND 20260507 — Jing
     * The shared panel-shell-actions binds .panel-actions buttons in
     * a single forEach on init. Items appended later (us) miss it
     * → close/min/max do nothing. Re-run the bridge so my panel gets
     * the canonical wiring on top of my own fallback listeners. */
    if (typeof globalThis.attachPanelBarActionsBridge === "function") {
      try { globalThis.attachPanelBarActionsBridge(); } catch (_e) {}
    }
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
      if (typeof globalThis.minimizeToDockBridge === "function") {
        globalThis.minimizeToDockBridge(panelEl);
      } else {
        panelEl.classList.add("hidden");
      }
    });
    wireChromeBtn(minBtn, function () {
      if (typeof globalThis.togglePanelCollapse === "function") {
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
      var p = cardCore(e); if (!p) return;
      var now = Date.now();
      if (now - cardLastFire < 400) return;
      cardLastFire = now;
      jumpIntoPipeline(p);
    }, true);
    panelEl.addEventListener("click", function (e) {
      var p = cardCore(e); if (!p) return;
      var now = Date.now();
      if (now - cardLastFire < 400) return;
      cardLastFire = now;
      jumpIntoPipeline(p);
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

  /* CSSOS_PERSON_MV_WAVE2 20260507 — Jing
   * "文明智能联动" — turn a person profile into a fully-prepared
   * MV pipeline seed:
   *   prompt   = `name · core_theme · symbols`
   *   style    = music_style_hint
   *   lyrics   = empty (LLM writes from the rest)
   * Plus civ-aware engine preferences via cssmvEngines.setSelection
   * before opening the panel so the right LLM/music engine fires
   * for that culture. No duration forced — pipeline LLM picks. */
  function buildSeed(p) {
    var name = localizedName(p);
    var symbols = (p.visual_symbols || []).filter(Boolean).slice(0, 4).join("、");
    var promptParts = [
      name,
      p.core_theme || "",
      p.era ? "(" + p.era + ")" : "",
      symbols ? tt("Visual symbols: ", "视觉意象：") + symbols : "",
      p.tone ? tt("Tone: ", "情感基调：") + p.tone : "",
    ].filter(Boolean);
    return {
      prompt: promptParts.join(" · "),
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

  function jumpIntoPipeline(person) {
    var seed = buildSeed(person);
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
