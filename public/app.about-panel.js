function renderAboutSubSectionModule() {
  const aboutContent = document.querySelector('.about-tab-content[data-tab="about"]');
  if (!aboutContent) return;

  const defaultKey = safeT("about.ui.defaultSectionKey", "en");
  if (ABOUT_VARIANTS.includes(defaultKey)) {
    aboutVariant = defaultKey;
  }

  const buildTabs = () =>
    ABOUT_VARIANTS.map((v) => {
      const active = v === aboutVariant;
      const label = safeT(`about.ui.tabs.${v}`);
      return `
        <button
          type="button"
          data-variant="${v}"
          style="
            padding: 8px 12px;
            border-radius: 999px;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.14);
            background: ${active ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.25)"};
            color: white;
            opacity: ${active ? "1" : "0.85"};
          "
        >${label}</button>
      `;
    }).join("");

  const titleKey = `about.sections.${aboutVariant}.title`;
  const bodyKey = `about.sections.${aboutVariant}.body`;

  const sourceLocale = currentLocale === "zh" ? "en" : "zh";
  const leftTitle = safeT(titleKey, sourceLocale);
  const leftBody = safeT(bodyKey, sourceLocale);
  const rightTitle = safeT(titleKey, currentLocale);
  const rightBody = safeT(bodyKey, currentLocale);
  const localeNames = {
    en: loginCopy("English"),
    zh: loginCopy("Chinese"),
    ja: loginCopy("Japanese")
  };
  const sourceLocaleLabel = localeNames[sourceLocale] || sourceLocale.toUpperCase();
  const rightLocaleLabel = localeNames[currentLocale] || currentLocale.toUpperCase();

  aboutContent.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">${buildTabs()}</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div style="padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.12);">
        <div style="opacity:0.7; font-size:12px; margin-bottom:8px;">${escapeHtml(sourceLocaleLabel)} · ${escapeHtml(String(sourceLocale || "").toUpperCase())}</div>
        <h3 style="margin:0 0 8px 0;">${leftTitle}</h3>
        <p style="margin:0; line-height:1.6; opacity:0.92;">${leftBody}</p>
      </div>
      <div style="padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.12);">
        <div style="opacity:0.7; font-size:12px; margin-bottom:8px;">${escapeHtml(rightLocaleLabel)} · ${escapeHtml(String(currentLocale || "").toUpperCase())}</div>
        <h3 style="margin:0 0 8px 0;">${rightTitle}</h3>
        <p style="margin:0; line-height:1.6; opacity:0.92;">${rightBody}</p>
      </div>
    </div>
    <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
      <button class="cta tiny">${safeT("about.ui.cta.primary")}</button>
      <button class="cta ghost tiny">${safeT("about.ui.cta.secondary")}</button>
    </div>
  `;

  aboutContent.querySelectorAll("button[data-variant]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.variant;
      if (!v) return;
      aboutVariant = v;
      renderAboutSubSectionModule();
    });
  });
}

function initAboutTabsModule() {
  if (!aboutTabs.length || !aboutTabContents.length) return;
  aboutTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.tab;
      if (!key) return;
      aboutTabs.forEach((btn) => btn.classList.remove("active"));
      aboutTabContents.forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      const content = document.querySelector(`.about-tab-content[data-tab="${key}"]`);
      if (content) content.classList.add("active");
      if (key === "about") {
        renderAboutSubSectionModule();
      }
    });
  });
  renderAboutSubSectionModule();
}

function activateAboutTabModule(key = "whitepaper") {
  const normalized = String(key || "whitepaper").trim().toLowerCase();
  const tab = Array.from(aboutTabs).find((btn) => String(btn.dataset.tab || "").trim().toLowerCase() === normalized);
  if (tab instanceof HTMLButtonElement) {
    tab.click();
  }
}

function scrollPanelSectionIntoViewModule(panel, selector) {
  if (!(panel instanceof HTMLElement) || !selector) return;
  const target = panel.querySelector(selector);
  if (!(target instanceof HTMLElement)) return;
  target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
}

globalThis.renderAboutSubSectionModule = renderAboutSubSectionModule;
globalThis.initAboutTabsModule = initAboutTabsModule;
globalThis.activateAboutTabModule = activateAboutTabModule;
globalThis.scrollPanelSectionIntoViewModule = scrollPanelSectionIntoViewModule;
