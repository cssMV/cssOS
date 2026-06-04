/* CSSOS_TIER_C_MULTILINGUAL C3 20260520 — Jing
 *
 * Reusable language-track picker for the INPUT-based universal entries
 * (Advanced Settings, MV PIPELINE, Person MV panel). NOT for zero-input
 * entries (logo/mic/play) — they have no surface for checkboxes.
 *
 * Rules (locked with Jing):
 *   • Checkboxes for the supported languages (fetched live from
 *     /api/mv/languages so adding a language server-side needs no client
 *     deploy).
 *   • The FIRST language the user checks becomes the original/default
 *     track: it pins to the front and is ALWAYS FREE. Every subsequent
 *     checked language is PAID, priced live via
 *     /api/mv/language-tracks/quote (1→$1.99, 2→$1.69 ea, 3+→$0.99 ea).
 *   • Selected languages render in selection order, pinned ahead of the
 *     unselected ones.
 *   • i18n via globalThis.tr / loginCopy when available.
 *
 * Public API:
 *   globalThis.cssosMountLanguagePicker(containerEl, {
 *     freeFirst   = true,        // new work: 1st free; false = add-on (all paid)
 *     onChange    = fn(state),   // { languages:[codes in order], quote }
 *   }) → { getSelected, destroy }
 */
(function () {
  "use strict";

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    if (typeof globalThis.tr === "function") {
      try { return globalThis.tr(en); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    return (lang.indexOf("zh") === 0 && zh) ? zh : en;
  }

  var _catalog = null; // cached [{code,native,en}]
  async function fetchCatalog() {
    if (_catalog) return _catalog;
    try {
      var r = await fetch("/api/mv/languages", { credentials: "include" });
      var j = await r.json();
      if (j && j.ok && Array.isArray(j.languages)) { _catalog = j.languages; return _catalog; }
    } catch (_e) {}
    // Fallback to the launch set if the endpoint is unreachable.
    _catalog = [
      { code: "en", native: "English", en: "English" },
      { code: "zh", native: "中文", en: "Chinese" },
      { code: "ja", native: "日本語", en: "Japanese" },
      { code: "ko", native: "한국어", en: "Korean" },
      { code: "fr", native: "Français", en: "French" },
      { code: "de", native: "Deutsch", en: "German" },
      { code: "es", native: "Español", en: "Spanish" },
      { code: "pt", native: "Português", en: "Portuguese" },
    ];
    return _catalog;
  }

  function fmtUsd(cents) {
    return "$" + (Math.max(0, cents | 0) / 100).toFixed(2);
  }

  // CSSOS_WAVE_404 20260524 — native names for mother-tongue codes that may not
  // be in the 8-language catalog (e.g. Greek el for Athena → catalog becomes 9).
  function motherTongueName(code) {
    var M = {
      el: "Ελληνικά", la: "Latina", ar: "العربية", ur: "اردو", fa: "فارسی",
      he: "עברית", is: "Íslenska", sv: "Svenska", sw: "Kiswahili", hi: "हिन्दी",
      ru: "Русский", tr: "Türkçe", vi: "Tiếng Việt", sa: "संस्कृतम्", bo: "བོད་སྐད་",
      en: "English", zh: "中文", ja: "日本語", ko: "한국어", fr: "Français",
      de: "Deutsch", es: "Español", pt: "Português", it: "Italiano",
    };
    return M[code] || (code ? code.toUpperCase() : "");
  }

  async function mount(container, opts) {
    opts = opts || {};
    var freeFirst = opts.freeFirst === false ? false : true;
    var onChange = typeof opts.onChange === "function" ? opts.onChange : function () {};
    var selected = []; // codes in selection order; selected[0] = default (free if freeFirst)
    var catalog = await fetchCatalog();
    // CSSOS_WAVE_404 20260524 — Jing「人物母语必选锁定」: the persona's mother
    // tongue is the locked default track. If it isn't one of the 8 supported
    // languages, inject it (8 + mother tongue = 9, e.g. Greek for Athena),
    // pre-select it as selected[0], and lock its checkbox (can't be deselected).
    var lockedFirst = String(opts.lockedFirst || "").toLowerCase().slice(0, 5).trim();
    if (lockedFirst) {
      if (!catalog.find(function (x) { return x.code === lockedFirst; })) {
        catalog = [{ code: lockedFirst, native: motherTongueName(lockedFirst), en: motherTongueName(lockedFirst) }].concat(catalog);
      }
      selected = [lockedFirst];
    }
    // CSSOS_WAVE_415 20260524 — Jing「高级设置=语言真源」: restore a previously saved
    // selection (order preserved; first = default/free). Skip codes not in the
    // catalog. lockedFirst (if any) always stays at the front.
    if (Array.isArray(opts.initialSelected) && opts.initialSelected.length) {
      opts.initialSelected.forEach(function (raw) {
        var code = String(raw || "").toLowerCase().trim();
        if (!code) return;
        if (lockedFirst && code === lockedFirst) return; // already at front
        if (!catalog.find(function (x) { return x.code === code; })) return;
        if (selected.indexOf(code) < 0) selected.push(code);
      });
    }

    container.innerHTML = "";
    container.classList.add("cssos-lang-picker");

    var head = document.createElement("div");
    head.className = "cssos-lang-picker-head";
    head.textContent = tt("Multilingual voice tracks", "多语言声线轨");
    container.appendChild(head);

    var sub = document.createElement("div");
    sub.className = "cssos-lang-picker-sub";
    sub.textContent = freeFirst
      ? tt("First language is the default track — free. Each extra language adds a re-sung voice lane (paid from wallet).",
           "第一个语言 = 默认轨，免费。每多一个语言 = 一条重唱声线（钱包扣费）。")
      : tt("Every added language is a new re-sung voice lane (paid from wallet).",
           "每个新增语言 = 一条重唱声线（钱包扣费）。");
    container.appendChild(sub);

    var grid = document.createElement("div");
    // CSSOS_WAVE_418 20260524 — Jing「胶囊宪法」: ONE horizontal-scroll row of
    // self-contained capsules (multi-select → no tab-pill 凹咬 interlock, which
    // blanked the labels). Styling lives in .cssos-lang-picker-grid / .cssos-lang-cell.
    grid.className = "cssos-lang-picker-grid";
    container.appendChild(grid);

    var priceLine = document.createElement("div");
    priceLine.className = "cssos-lang-picker-price";
    container.appendChild(priceLine);

    function orderedCodes() {
      // selected (in order) first, then the rest in catalog order.
      var rest = catalog.map(function (l) { return l.code; })
        .filter(function (c) { return selected.indexOf(c) < 0; });
      return selected.concat(rest);
    }

    async function refreshQuote() {
      if (selected.length <= (freeFirst ? 1 : 0)) {
        priceLine.textContent = selected.length
          ? tt("Default track — free.", "默认轨 — 免费。")
          : tt("Pick at least one language.", "请至少选择一个语言。");
        priceLine.dataset.totalCents = "0";
        onChange({ languages: selected.slice(), quote: { total_cents: 0, paid_count: 0 } });
        return;
      }
      try {
        var r = await fetch("/api/mv/language-tracks/quote", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ languages: selected, free_first: freeFirst }),
        });
        var j = await r.json();
        if (j && j.ok) {
          priceLine.dataset.totalCents = String(j.total_cents || 0);
          priceLine.textContent = (j.free_count ? tt("1 free", "1 免费") + " + " : "")
            + j.paid_count + " " + tt("paid", "付费")
            + " · " + tt("wallet", "钱包扣") + " " + fmtUsd(j.total_cents)
            + (j.sufficient ? "" : "  ⚠ " + tt("top up needed", "余额不足，请充值"));
          priceLine.classList.toggle("is-insufficient", !j.sufficient);
          onChange({ languages: selected.slice(), quote: j });
        } else if (j && j.code === "TIER_REQUIRED") {
          priceLine.textContent = "🔒 " + tt("Multilingual needs a paid plan.", "多语言需付费套餐。");
        } else if (j && j.code === "AUTH_REQUIRED") {
          priceLine.textContent = "🔒 " + tt("Sign in to add languages.", "请登录后添加语言。");
        }
      } catch (_e) {
        priceLine.textContent = tt("Price unavailable.", "报价暂不可用。");
      }
    }

    // CSSOS_WAVE_587 — Jing「算力闸: 选满 N 个, 其余置灰/禁选; 土豪要全部, 分批来」。
    // maxSelections 计【非锁定】的已选数(锁定的母语不占额度)。
    var maxSel = Math.max(0, Number(opts.maxSelections || 0));
    function nonLockedCount() {
      return selected.filter(function (c) { return !(lockedFirst && c === lockedFirst); }).length;
    }
    function render() {
      grid.innerHTML = "";
      var atMax = maxSel > 0 && nonLockedCount() >= maxSel;
      orderedCodes().forEach(function (code) {
        var l = catalog.find(function (x) { return x.code === code; });
        if (!l) return;
        var idx = selected.indexOf(code);
        var isSel = idx >= 0;
        var isDefault = isSel && idx === 0;
        var cell = document.createElement("label");
        cell.className = "cssos-lang-cell" + (isSel ? " is-selected" : "")
          + (isDefault ? " is-default" : "");
        var box = document.createElement("input");
        box.type = "checkbox";
        box.checked = isSel;
        var isLocked = !!lockedFirst && code === lockedFirst;
        if (isLocked) { box.disabled = true; box.checked = true; cell.classList.add("is-locked"); }
        // 选满闸: 未选中的行置灰禁选(已选中的仍可取消)。
        else if (atMax && !isSel) { box.disabled = true; cell.classList.add("is-capped"); }
        box.addEventListener("change", function () {
          if (isLocked) { box.checked = true; return; } // mother tongue is mandatory
          if (box.checked) {
            if (maxSel > 0 && nonLockedCount() >= maxSel) { box.checked = false; return; } // 选满拒绝
            if (selected.indexOf(code) < 0) selected.push(code);
          }
          else { selected = selected.filter(function (c) { return c !== code; }); }
          render();
          refreshQuote();
        });
        var nm = document.createElement("span");
        nm.className = "cssos-lang-name";
        nm.textContent = l.native;
        cell.appendChild(box);
        cell.appendChild(nm);
        if (isDefault) {
          var badge = document.createElement("span");
          badge.className = "cssos-lang-badge";
          badge.textContent = freeFirst ? tt("default · free", "默认 · 免费") : tt("default", "默认");
          cell.appendChild(badge);
        } else if (isSel) {
          var pbadge = document.createElement("span");
          pbadge.className = "cssos-lang-badge cssos-lang-badge-paid";
          pbadge.textContent = tt("paid", "付费");
          cell.appendChild(pbadge);
        }
        grid.appendChild(cell);
      });
    }

    render();
    refreshQuote();

    return {
      getSelected: function () { return selected.slice(); },
      destroy: function () { container.innerHTML = ""; container.classList.remove("cssos-lang-picker"); },
    };
  }

  globalThis.cssosMountLanguagePicker = function (container, opts) {
    if (!container) return null;
    // mount is async; return a thenable-ish handle that proxies once ready.
    var handle = { _ready: null, getSelected: function () { return []; }, destroy: function () {} };
    handle._ready = mount(container, opts).then(function (api) {
      handle.getSelected = api.getSelected;
      handle.destroy = api.destroy;
      return api;
    });
    return handle;
  };
})();
