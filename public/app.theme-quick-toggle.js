(() => {
  const toggle = document.getElementById("theme-quick-toggle");
  const menu = document.getElementById("theme-quick-menu");
  if (!(toggle instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
    return;
  }

  const previousRefresh =
    typeof globalThis.refreshThemeQuickToggleModule === "function"
      ? globalThis.refreshThemeQuickToggleModule
      : null;

  function i18nText(key, fallback) {
    const translated = globalThis.CSSOS_I18N?.t?.(key);
    return typeof translated === "string" && translated.trim() ? translated : fallback;
  }

  function themeModeLabel(mode) {
    const normalized = String(mode || "system").trim().toLowerCase();
    if (normalized === "light") {
      return i18nText("theme.quick.light", "Light");
    }
    if (normalized === "dark") {
      return i18nText("theme.quick.dark", "Dark");
    }
    return i18nText("theme.quick.system", "System");
  }

  function themeModeIcon(mode, effectiveTheme) {
    const normalized = String(mode || "system").trim().toLowerCase();
    if (normalized === "light") return "☀";
    if (normalized === "dark") return "☾";
    return effectiveTheme === "dark" ? "◑" : "◐";
  }

  function refreshThemeQuickMenuLabels() {
    menu.querySelectorAll("[data-theme-mode]").forEach((button) => {
      const mode = String(button.getAttribute("data-theme-mode") || "system")
        .trim()
        .toLowerCase();
      button.textContent = themeModeLabel(mode);
    });
  }

  function refreshThemeQuickToggleModule(settings = null, effectiveThemeOverride = "") {
    const behavior =
      typeof globalThis.sanitizePanelBehaviorSettings === "function"
        ? globalThis.sanitizePanelBehaviorSettings(
            settings || globalThis.readPanelBehaviorSettingsLocal?.() || {},
          )
        : settings || globalThis.readPanelBehaviorSettingsLocal?.() || {};
    const themeMode = String(behavior?.appearance?.theme_mode || "system")
      .trim()
      .toLowerCase();
    const effectiveTheme =
      effectiveThemeOverride ||
      globalThis.getEffectiveThemeModeFromSettings?.(behavior) ||
      "dark";
    const icon = themeModeIcon(themeMode, effectiveTheme);
    const label = i18nText("theme.quick.title", "Theme");
    toggle.textContent = icon;
    toggle.dataset.theme = effectiveTheme;
    toggle.dataset.themeMode = themeMode;
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
    menu.querySelectorAll("[data-theme-mode]").forEach((button) => {
      const isActive = String(button.getAttribute("data-theme-mode") || "").trim() === themeMode;
      button.classList.toggle("is-active", isActive); // legacy
      button.classList.toggle("active", isActive);    // pill constitution
    });
    previousRefresh?.(settings, effectiveThemeOverride);
  }

  function closeMenu() {
    menu.classList.add("is-hidden");
  }

  if (toggle.dataset.bound !== "true") {
    toggle.dataset.bound = "true";
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menu.classList.toggle("is-hidden");
    });
    menu.querySelectorAll("[data-theme-mode]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextMode = String(
          button.getAttribute("data-theme-mode") || "system",
        )
          .trim()
          .toLowerCase();
        globalThis.updatePanelBehaviorSettings?.((current) => ({
          ...current,
          appearance: {
            ...(current?.appearance || {}),
            theme_mode: ["system", "dark", "light"].includes(nextMode)
              ? nextMode
              : "system",
          },
        }));
        closeMenu();
      });
    });
    document.addEventListener("click", (event) => {
      if (menu.classList.contains("is-hidden")) return;
      if (toggle.contains(event.target) || menu.contains(event.target)) return;
      closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }

  globalThis.refreshThemeQuickToggleModule = Object.assign(
    refreshThemeQuickToggleModule,
    { __moduleImpl: refreshThemeQuickToggleModule },
  );
  refreshThemeQuickMenuLabels();
  refreshThemeQuickToggleModule();
})();
