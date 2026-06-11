// CSSOS_WAVE_665 #52 — 全球语言目录 + 苹果式手动激活。
// 默认仅英文激活; 用户在"添加语言"里点选 → 激活并实时懒翻译(经 setLocale→tr 运行时)。
// CSSOS_WAVE_665 #52 — 激活态按【用户】隔离: 每个账号在本设备有自己的"我的语言"(Jing=en/zh,
// Amelia=en/ja/ko…)。key 拼当前用户 id; 匿名用 anon。(跨设备同步需后端 user-prefs, 见记忆待办。)
function activatedLocalesKeyModule() {
  let uid = "";
  try { uid = String(globalThis.cssosProfileUserId || "").trim(); } catch (_e) { uid = ""; }
  return "cssos.activated_locales" + (uid ? "." + uid : ".anon");
}

function languageCatalogList() {
  return (Array.isArray(globalThis.CSSOS_LANG_CATALOG) && globalThis.CSSOS_LANG_CATALOG.length)
    ? globalThis.CSSOS_LANG_CATALOG
    // 兜底: 目录文件没加载时退回老的 10 语言 LANGS(防御式, 见 cross_file_symbol_defensive_ref)。
    : (typeof LANGS !== "undefined" ? LANGS.map((l) => ({ code: l.code, native: l.code, en: l.code, flag: l.flag })) : []);
}

// 某 code 的展示条目(native/en/flag)。优先 catalog, 再 LANGS, 最后裸 code。
function langEntryForModule(code) {
  const cat = languageCatalogList().find((l) => l.code === code);
  if (cat) return cat;
  if (typeof LANGS !== "undefined") {
    const l = LANGS.find((x) => x.code === code);
    if (l) return { code, native: (typeof t === "function" ? t(l.nameKey) : code), en: code, flag: l.flag };
  }
  return { code, native: code, en: code, flag: "🌐" };
}

function getActivatedLocalesModule() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(activatedLocalesKeyModule()) || "[]"); } catch (_e) { list = []; }
  if (!Array.isArray(list)) list = [];
  list = list.filter((c) => typeof c === "string" && c);
  // 永远含英文 + 当前语言(防止用户被锁在一门没激活的语言外)。
  if (!list.includes("en")) list.unshift("en");
  try { if (typeof currentLocale === "string" && currentLocale && !list.includes(currentLocale)) list.push(currentLocale); } catch (_e) {}
  return list;
}

function setActivatedLocalesModule(list, skipPush) {
  const uniq = Array.from(new Set(list));
  try { localStorage.setItem(activatedLocalesKeyModule(), JSON.stringify(uniq)); } catch (_e) {}
  if (!skipPush) pushLanguagePrefsModule(uniq);
}

// CSSOS_WAVE_666 #52 — 跨设备随账号同步。push: 防抖 PUT 到 /api/me/language-prefs(未登录后端返 401, 忽略)。
let _cssosLangPushTimer = null;
function pushLanguagePrefsModule(list) {
  // 仅登录用户才同步(匿名 key 无意义)。
  let uid = "";
  try { uid = String(globalThis.cssosProfileUserId || "").trim(); } catch (_e) { uid = ""; }
  if (!uid) return;
  const payload = JSON.stringify({ locales: list || getActivatedLocalesModule() });
  if (_cssosLangPushTimer) clearTimeout(_cssosLangPushTimer);
  _cssosLangPushTimer = setTimeout(() => {
    _cssosLangPushTimer = null;
    try {
      fetch("/api/me/language-prefs", {
        method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: payload,
      }).catch(() => {});
    } catch (_e) {}
  }, 500);
}

// pull: 登录后拉云端激活列表, 与本地【并集】(云端在前→跟随账号), 本地落盘(不回推), 再回推合并结果让两端收敛, 然后重渲染。
let _cssosLangPulled = false;
function pullLanguagePrefsModule() {
  let uid = "";
  try { uid = String(globalThis.cssosProfileUserId || "").trim(); } catch (_e) { uid = ""; }
  if (!uid || _cssosLangPulled) return;
  _cssosLangPulled = true;
  try {
    fetch("/api/me/language-prefs", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (!j || !j.ok) return;
        const local = getActivatedLocalesModule();
        const server = Array.isArray(j.locales) ? j.locales.filter((c) => typeof c === "string" && c) : null;
        let merged;
        if (server && server.length) {
          const set = new Set(server);
          merged = server.concat(local.filter((c) => !set.has(c)));   // 云端在前 + 本地补充
        } else {
          merged = local;                                              // 云端空 → 首设备播种
        }
        setActivatedLocalesModule(merged, true);                       // 本地落盘, 不回推
        pushLanguagePrefsModule(merged);                               // 回推合并结果, 两端收敛
        try { renderLanguageButtonsModule(typeof languageList !== "undefined" ? languageList : null); } catch (_e) {}
      })
      .catch(() => {});
  } catch (_e) {}
}

function activateLocaleModule(code) {
  if (!code) return;
  const list = getActivatedLocalesModule();
  if (!list.includes(code)) { list.push(code); setActivatedLocalesModule(list); }
}

function langCardMarkupModule(entry, active) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lang-card" + (active ? " active" : "");
  btn.dataset.lang = entry.code;
  const sub = (entry.en && entry.en !== entry.native) ? `<span class="lang-sub">${entry.en}</span>` : "";
  // 小国旗 + 文字列(母语名 / 英文名 上下对齐), flag 左、文字右。
  btn.innerHTML = `<span class="lang-flag">${entry.flag || "🌐"}</span>` +
    `<span class="lang-card-text"><span class="lang-name">${entry.native || entry.code}</span>${sub}</span>`;
  return btn;
}

// "我的语言" = 已激活 locale 的【凹凸镶嵌胶囊组】(每用户一套, 仅本设备/账号生效; 点击切换)。
// 段与段相接成一条胶囊(首尾圆角, 中间共享边), 当前语言段高亮凸起。数量随人而异。
// Dock 式: 把某语言移到第一位并持久化(选中即置顶)。
function moveLocaleToFrontModule(code) {
  if (!code) return;
  let list = getActivatedLocalesModule();
  if (!list.includes(code)) return;
  list = [code, ...list.filter((c) => c !== code)];
  setActivatedLocalesModule(list);
}

function renderLanguageButtonsModule(container) {
  if (!container) return;
  container.innerHTML = "";
  const group = document.createElement("div");
  group.className = "lang-capsule-group";
  // 当前语言置顶(Dock 行为)后再渲染。
  if (currentLocale) moveLocaleToFrontModule(currentLocale);
  const activated = getActivatedLocalesModule();
  group.dataset.count = String(activated.length);
  activated.forEach((code, i) => {
    const entry = langEntryForModule(code);
    const seg = document.createElement("button");
    seg.type = "button";
    seg.className = "lang-capsule" + (code === currentLocale ? " active" : "");
    if (i === 0) seg.classList.add("is-first");
    if (i === activated.length - 1) seg.classList.add("is-last");
    seg.dataset.lang = code;
    seg.innerHTML = `<span class="lang-flag">${entry.flag || "🌐"}</span>` +
      `<span class="lang-cap-name">${entry.native || code}</span>` +
      ((entry.en && entry.en !== entry.native) ? `<span class="lang-cap-en">${entry.en}</span>` : "");
    seg.addEventListener("click", () => {
      moveLocaleToFrontModule(code);          // Dock 式置顶
      setLocale(code);
      renderLanguageButtonsModule(container);  // 重渲染让置顶 + active 生效
    });
    group.appendChild(seg);
  });
  container.appendChild(group);
}

// "添加语言" 浏览面板 = 全目录(去掉已激活), 可搜索。点击 → 激活 + 切换(触发懒翻译)。
function renderLanguageBrowseModule(container, filter) {
  if (!container) return;
  container.innerHTML = "";
  const activated = new Set(getActivatedLocalesModule());
  const q = String(filter || "").trim().toLowerCase();
  const items = languageCatalogList().filter((l) => {
    if (activated.has(l.code)) return false;
    if (!q) return true;
    return (l.native || "").toLowerCase().includes(q) ||
           (l.en || "").toLowerCase().includes(q) ||
           (l.code || "").toLowerCase().includes(q);
  });
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "language-browse-empty";
    empty.textContent = (typeof t === "function" ? t("language.none_found") : "No languages found") || "No languages found";
    container.appendChild(empty);
    return;
  }
  items.forEach((entry) => {
    const card = langCardMarkupModule(entry, false);
    card.addEventListener("click", () => {
      activateLocaleModule(entry.code);
      setLocale(entry.code);              // 切换 → ensureGeneratedLocale + applyI18n + 运行时 tr 懒翻译
      renderLanguageButtonsModule(typeof languageList !== "undefined" ? languageList : null);
      renderLanguageBrowseModule(container, (globalThis.__cssosLangSearchEl && globalThis.__cssosLangSearchEl.value) || "");
    });
    container.appendChild(card);
  });
}

function updateLanguageSelectionModule() {
  document.querySelectorAll(".lang-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.lang === currentLocale);
  });
}

function updateLanguageStatusModule(textKey) {
  if (!languageStatus) return;
  languageStatus.textContent = t(textKey);
}

function updateLanguageCurrentModule() {
  if (!languageCurrent) return;
  const e = langEntryForModule(currentLocale);
  if (e) languageCurrent.textContent = `${e.flag || "🌐"} ${e.native || e.code} · ${e.code}`;
}

function updateLanguagePendingBannerModule() {
  if (!languagePanel) return;
  const banner = languagePanel.querySelector(".language-banner");
  if (!banner) return;
  const lang = LANGS.find((item) => item.code === currentLocale);
  if (!lang || lang.enabled) {
    banner.textContent = "";
    banner.classList.add("is-hidden");
    return;
  }
  banner.textContent = t("lang.pending_banner");
  banner.classList.remove("is-hidden");
}

function toggleLanguagePanelModeModule(mode) {
  if (!languagePanel) return;
  languagePanelMode = mode || (languagePanelMode === "content" ? "settings" : "content");
  languagePanel.dataset.mode = languagePanelMode;
  updateLanguageSettingsLabelsModule();
}

function updateLanguageSettingsLabelsModule() {
  if (!languagePanel) return;
  const settings = languagePanel.querySelector(".language-settings");
  if (!settings) return;
  const currentEl = settings.querySelector('[data-setting="current"]');
  const detectedEl = settings.querySelector('[data-setting="detected"]');
  if (currentEl) currentEl.textContent = `${t("lang.current")}: ${currentLocale}`;
  if (detectedEl) detectedEl.textContent = `${t("lang.detected")}: ${detectedCountry || "-"}`;
}

function buildLanguageSettingsModule() {
  if (!languagePanel) return;
  const body = languagePanel.querySelector(".language-body");
  if (!body || body.querySelector(".language-settings")) return;

  const banner = document.createElement("div");
  banner.className = "language-banner is-hidden";
  body.insertBefore(banner, body.firstChild);

  const settings = document.createElement("div");
  settings.className = "language-settings";
  settings.innerHTML = `
    <div class="language-settings-row">
      <label>
        <span>${t("lang.autodetect")}</span>
        <input type="checkbox" data-setting="autodetect" />
      </label>
    </div>
    <div class="language-settings-row" data-setting="current"></div>
    <div class="language-settings-row" data-setting="detected"></div>
    <div class="language-settings-row">
      <button type="button" class="cta ghost" data-setting="reset-lang">${t("lang.reset")}</button>
    </div>
  `;
  body.appendChild(settings);

  const autoToggle = settings.querySelector('[data-setting="autodetect"]');
  const resetBtn = settings.querySelector('[data-setting="reset-lang"]');
  if (autoToggle) {
    autoToggle.checked = localStorage.getItem(LANG_AUTODETECT_KEY) !== "off";
    autoToggle.addEventListener("change", () => {
      localStorage.setItem(LANG_AUTODETECT_KEY, autoToggle.checked ? "on" : "off");
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      setLocale(DEFAULT_LOCALE);
      updateLanguagePendingBannerModule();
    });
  }
  updateLanguageSettingsLabelsModule();
}

function mapCountryToLangModule(code) {
  const cc = String(code || "").toUpperCase();
  if (cc === "CN" || cc === "HK" || cc === "TW") return "zh";
  if (cc === "JP") return "ja";
  if (cc === "KR") return "ko";
  if (cc === "ES") return "es";
  if (cc === "FR") return "fr";
  if (cc === "DE") return "de";
  if (cc === "PT" || cc === "BR") return "pt";
  if (cc === "RU") return "ru";
  if (cc === "SA" || cc === "AE" || cc === "EG") return "ar";
  return "en";
}

globalThis.mapCountryToLangModule = mapCountryToLangModule;
globalThis.updateLanguageSelectionModule = updateLanguageSelectionModule;
globalThis.updateLanguageStatusModule = updateLanguageStatusModule;
globalThis.updateLanguageCurrentModule = updateLanguageCurrentModule;
globalThis.updateLanguagePendingBannerModule = updateLanguagePendingBannerModule;
globalThis.updateLanguageSettingsLabelsModule = updateLanguageSettingsLabelsModule;
globalThis.renderLanguageButtonsModule = renderLanguageButtonsModule;
globalThis.renderLanguageBrowseModule = renderLanguageBrowseModule;
globalThis.getActivatedLocalesModule = getActivatedLocalesModule;
globalThis.activateLocaleModule = activateLocaleModule;
globalThis.langEntryForModule = langEntryForModule;

// CSSOS_WAVE_662 — 删除死代码 initLanguageAutoDetectModule(全仓零调用, 连本文件 init 都未调; ipapi
// 自动检测从未启用)。如将来要恢复 IP 自动选语言, 从 git 历史取回。

// CSSOS_WAVE_665 #52 — "添加语言" 浏览的搜索框(动态注入一次, 放在 #language-list-more 前)。
function ensureLanguageSearchModule() {
  if (globalThis.__cssosLangSearchEl || !languageListMore || !languageListMore.parentNode) return;
  const input = document.createElement("input");
  input.type = "search";
  input.className = "language-search";
  input.setAttribute("data-i18n-placeholder", "language.search_placeholder");  // applyI18n 懒翻译占位符
  input.placeholder = (typeof localizedI18nText === "function" ? localizedI18nText("language.search_placeholder")
    : (typeof t === "function" ? t("language.search_placeholder") : "Search languages…")) || "Search languages…";
  input.setAttribute("autocomplete", "off");
  input.classList.add("is-hidden");
  input.addEventListener("input", () => renderLanguageBrowseModule(languageListMore, input.value));
  languageListMore.parentNode.insertBefore(input, languageListMore);
  globalThis.__cssosLangSearchEl = input;
}

function initLanguagePanelModule() {
  renderLanguageButtonsModule(languageList);
  pullLanguagePrefsModule();   // CSSOS_WAVE_666 — 登录用户: 拉云端激活语言, 跨设备随账号同步
  if (languageListMore) languageListMore.classList.add("is-hidden");
  updateLanguageSelectionModule();
  updateLanguageCurrentModule();
  // CSSOS_WAVE_665 #52 — More 按钮重生为"添加语言"开关: 展开全目录浏览 + 搜索框。
  ensureLanguageSearchModule();
  if (languageMoreButton && languageListMore) {
    languageMoreButton.style.display = "";
    languageMoreButton.classList.add("lang-more-btn");
    // CSSOS_WAVE_665b — 去掉 data-i18n: 否则每次 applyI18n() 会把按钮文案重置回 "More languages",
    // 覆盖掉我们的"＋ Add language / − Show fewer"。改由本模块全权控制文案 + 图标。
    languageMoreButton.removeAttribute("data-i18n");
    const i18nText = (key, fallback) => {
      if (typeof localizedI18nText === "function") return localizedI18nText(key) || fallback;
      if (typeof t === "function") return t(key) || fallback;
      return fallback;
    };
    const setMoreLabel = (expanded) => {
      const ico = expanded ? "▴" : "🌐";
      const key = expanded ? "language.fewer" : "language.add";
      const txt = i18nText(key, expanded ? "Show fewer" : "Add language");
      // data-i18n 放在文字 span 上(不在按钮上, 否则会清掉图标); applyI18n 会经 localizedI18nText
      // 把它【懒翻译】成当前语言(中文等), 不再硬编码英文。
      languageMoreButton.innerHTML =
        `<span class="lang-more-ico">${ico}</span><span class="lang-more-txt" data-i18n="${key}">${txt}</span>`;
    };
    setMoreLabel(false);
    if (!languageMoreButton.dataset.cssosBound) {
      languageMoreButton.dataset.cssosBound = "1";
      languageMoreButton.addEventListener("click", () => {
        const willShow = languageListMore.classList.contains("is-hidden");
        languageListMore.classList.toggle("is-hidden", !willShow);
        if (globalThis.__cssosLangSearchEl) globalThis.__cssosLangSearchEl.classList.toggle("is-hidden", !willShow);
        setMoreLabel(willShow);
        if (willShow) {
          renderLanguageBrowseModule(languageListMore, globalThis.__cssosLangSearchEl ? globalThis.__cssosLangSearchEl.value : "");
          try { globalThis.__cssosLangSearchEl && globalThis.__cssosLangSearchEl.focus(); } catch (_e) {}
        }
      });
    }
  }
  // CSSOS_WAVE_662 线B预备步: 首屏 i18n 编排已抽到独立 eager 模块 app.i18n-boot-apply.js
  // (globalThis.cssosApplyBootI18n), 此处委托调用, 行为零变化。解耦后将来 language-panel 可懒加载
  // 而首屏 i18n 不丢(boot 直接调 cssosApplyBootI18n)。
  if (typeof globalThis.cssosApplyBootI18n === "function") globalThis.cssosApplyBootI18n();
  buildLanguageSettingsModule();
  updateLanguagePendingBannerModule();
}

globalThis.initLanguagePanelModule = initLanguagePanelModule;
globalThis.toggleLanguagePanelMode = toggleLanguagePanelModeModule;
