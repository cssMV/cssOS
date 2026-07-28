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

  // CSSOS_WAVE_1734 20260711 — Jing「语言胶囊套平台胶囊皮 · 翻宪法」: 平台视觉签名 · 随机色凸嵌凹胶囊。
  // 本行是【多选】(checkbox), 故不套单选 tab 的"唯一 .active" 语义, 但【必须】走 data-pill-bar 工具:
  //   · grid 容器加 data-pill-bar / data-pill-compact → app.pill-bar.js 宪法样式接管几何+色相+凹凸镶嵌。
  //   · 每 cell 加 data-pill-key(语言码); 选中(is-selected/is-default)= 加 .active(多个凸岛), 取消= 去 .active。
  //   · 每颗一枚国旗图标(胶囊宪法 W497 视觉锚点)。语言名仍是文字 i18n(不硬编码任何非英文字面量)。
  var FLAGS = {
    en: "🇬🇧", zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", fr: "🇫🇷", de: "🇩🇪", es: "🇪🇸", pt: "🇵🇹",
    it: "🇮🇹", ru: "🇷🇺", ar: "🇸🇦", hi: "🇮🇳", el: "🇬🇷", la: "🏛", ur: "🇵🇰", fa: "🇮🇷",
    he: "🇮🇱", is: "🇮🇸", sv: "🇸🇪", sw: "🇰🇪", tr: "🇹🇷", vi: "🇻🇳", sa: "🕉", bo: "☸",
  };
  function flagFor(code) { return FLAGS[String(code || "").toLowerCase()] || "🌐"; }

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
    // CSSOS_WAVE_1734 20260711 — Jing「翻宪法」: 走平台 data-pill-bar 工具(app.pill-bar.js)。
    //   data-pill-bar    → 宪法样式接管几何/色相/凹凸镶嵌(连成一条无缝轨, 不是飘着的椭圆)。
    //   data-pill-compact→ 去掉工具默认外边距(picker 自带间距)。
    //   data-pill-multi  → 多选轨道(多个 .active 凸岛并存); 供工具 stampOne 跳过"强制激活第一个"。
    // 色相/凹咬/主题文字由 paintPillBar() 在每次 render 末尾复刻工具逻辑打上(见上方说明)。
    grid.className = "cssos-lang-picker-grid";
    grid.setAttribute("data-pill-bar", "");
    grid.setAttribute("data-pill-compact", "");
    grid.setAttribute("data-pill-multi", "");
    // W1767 — 自适应宽度 = 交给 CSS 规则 .cssos-lang-picker-grid[data-pill-bar]{grid-auto-columns:max-content}
    //   (style.css), 那里是本栏 grid-auto-columns 的既有权威落点, 不在此内联重复。
    container.appendChild(grid);

    var priceLine = document.createElement("div");
    priceLine.className = "cssos-lang-picker-price";
    container.appendChild(priceLine);

    // CSSOS_WAVE_1734 — 驱动 app.pill-bar.js 宪法轨道的视觉。为什么要自己复刻工具的 stamp:
    //   本 picker 每次 render 都【原地重建 cell】(grid.innerHTML=""), 而 app.pill-bar.js 的全局
    //   MutationObserver 只在【新出现一条 data-pill-bar 容器】时 stamp, 看不到"既有轨道内的子节点替换"
    //   → 重建后的 cell 会丢 --ph/凹咬。故这里在每次 render 末尾调 paintPillBar(), 复刻工具的
    //   stampOne + markPre(全部用工具导出的 CSSOS_PILL_HUES 与工具的 .active/.cssos-pill-pre/--ph/--th,
    //   不写任何 bespoke 像素): 逐 cell 按位置挂谱色 --ph; 首个 .active 左侧全打 .cssos-pill-pre(左凹咬);
    //   轨道 --th = 首个 .active 的谱色。深色主题走工具默认浅字, 白天(浅底)加 data-pill-text=dark。
    var PAL = (globalThis.CSSOS_PILL_HUES && globalThis.CSSOS_PILL_HUES.length)
      ? globalThis.CSSOS_PILL_HUES
      : [155, 192, 235, 268, 310, 342, 22, 48, 82, 118, 168, 210];
    function paintPillBar(g) {
      if (!g) return;
      var kids = Array.prototype.slice.call(g.children);
      // 先清掉上一次留下的【合成默认激活】, 避免重排/补插 My Voice 后旧的合成 active 残留。
      kids.forEach(function (c) {
        if (c.dataset && c.dataset.pillDefaultActive === "1") {
          c.classList.remove("active");
          delete c.dataset.pillDefaultActive;
        }
      });
      var firstOn = -1;
      kids.forEach(function (c, i) {
        if (!c.getAttribute("data-pill-key")) c.setAttribute("data-pill-key", "k" + i);
        c.style.setProperty("--ph", PAL[i % PAL.length]);
        if (firstOn < 0 && c.classList.contains("active")) firstOn = i;
      });
      // CSSOS_WAVE_1734d — 胶囊宪法「第一个胶囊默认激活」: 若无任何真实选中(无 active 岛),
      //   首颗(My Voice)默认激活当锚点岛 → 现成凸嵌凹自动成立(其余凹向它), 无缝、零新 CSS。
      //   仅是视觉默认岛(标 data-pill-default-active 以便下次重绘清除), 不改 My Voice 的点击语义,
      //   也不勾选任何语言 checkbox。用户真正选中某语言后, firstOn>=0, 合成岛让位给真实岛。
      if (firstOn < 0 && kids.length) {
        kids[0].classList.add("active");
        kids[0].dataset.pillDefaultActive = "1";
        firstOn = 0;
      }
      kids.forEach(function (c, i) { c.classList.toggle("cssos-pill-pre", firstOn >= 0 && i < firstOn); });
      g.style.setProperty("--th", PAL[(firstOn < 0 ? 0 : firstOn) % PAL.length]);
      var lightTheme = false;
      try { lightTheme = document.documentElement.getAttribute("data-theme") === "light"; } catch (_e) {}
      if (lightTheme) g.setAttribute("data-pill-text", "dark");
      else g.removeAttribute("data-pill-text");
    }
    // 让 app.my-voice-entry.js 注入「🎙️ My Voice」首颗后, 能立刻让它也吃到胶囊皮(补 data-pill-key + 重绘)。
    grid.__cssosPillPaint = function () { paintPillBar(grid); };

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
        // CSSOS_WAVE_1734 — 多选凸嵌凹: 选中(is-selected/is-default)= 加 .active(凸岛), 未选=凹谷。
        //   .active 是 app.pill-bar.js 宪法的凸岛类; is-selected/is-default 仅供本模块/测试语义, 不再上色。
        cell.className = "cssos-lang-cell" + (isSel ? " is-selected active" : "")
          + (isDefault ? " is-default" : "");
        cell.setAttribute("data-pill-key", code); // 胶囊宪法: 每颗一枚唯一 key
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
        var fl = document.createElement("span");
        fl.className = "cssos-lang-flag";
        fl.textContent = flagFor(code);
        var nm = document.createElement("span");
        nm.className = "cssos-lang-name";
        nm.textContent = l.native;
        cell.appendChild(box);
        cell.appendChild(fl);
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
      // CSSOS_WAVE_1734 — 重建 cell 后, 复刻工具 stamp: 打 --ph/凹咬/主题文字, 让整条连成无缝凸嵌凹轨。
      paintPillBar(grid);
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
