(() => {
  const panelVoiceKeyMap = {
    h: { action: "logo", i18nKey: "brand.name", fallback: "Logo" },
    f: { action: "foryou", i18nKey: "panel.foryou", fallback: "For You" },
    l: { action: "lyrics", i18nKey: "panel.lyrics", fallback: "Lyrics Engine" },
    m: { action: "music", i18nKey: "panel.music", fallback: "Music Engine" },
    v: { action: "video", i18nKey: "panel.video", fallback: "Video Engine" },
    w: { action: "watch", i18nKey: "panel.watch", fallback: "Watch" },
    c: { action: "cssmv", i18nKey: "panel.cssmv", fallback: "CSS MV" },
    r: { action: "reports", i18nKey: "panel.deliveryReports", fallback: "Delivery Reports" },
    o: { action: "delivery-ops", i18nKey: "panel.deliveryOps", fallback: "Delivery Ops" },
    a: { action: "api", i18nKey: "panel.api", fallback: "API" },
    b: { action: "about", i18nKey: "panel.about", fallback: "About" },
    p: { action: "profile", i18nKey: "panel.profile", fallback: "Profile" },
    g: { action: "settings", i18nKey: "panel.settings", fallback: "Advanced Settings" },
    n: { action: "language", i18nKey: "panel.language", fallback: "Language" },
    i: { action: "login", i18nKey: "panel.login", fallback: "Login" },
    u: { action: "subscription", i18nKey: "panel.subscription", fallback: "Subscription" },
    y: { action: "credit", i18nKey: "panel.api", fallback: "Credit" },
    x: { action: "workspaces", i18nKey: "panel.works", fallback: "Workspaces" },
    k: { action: "works", i18nKey: "panel.works", fallback: "Works" },
    e: { action: "seller", i18nKey: "panel.seller", fallback: "Seller" },
    j: { action: "user-admin", i18nKey: "panel.profile", fallback: "User Panel" }
  };

  const panelShortcutMap = {
    h: { action: "logo", panelId: "logo-panel", panel: () => globalThis.logoPanel, label: () => loginCopy("Logo panel") },
    f: { action: "foryou", panelId: "foryou-panel", panel: () => globalThis.foryouPanel, label: () => loginCopy("For You panel") },
    l: { action: "lyrics", panelId: "lyrics-panel", panel: () => globalThis.lyricsPanel, label: () => loginCopy("Lyrics panel") },
    m: { action: "music", panelId: "music-panel", panel: () => globalThis.musicPanel, label: () => loginCopy("Music panel") },
    v: { action: "video", panelId: "video-panel", panel: () => globalThis.videoPanel, label: () => loginCopy("Video panel") },
    w: { action: "watch", panelId: "watch-panel", panel: () => globalThis.watchPanel, label: () => loginCopy("Watch panel") },
    c: { action: "cssmv", panelId: "cssmv-panel", panel: () => globalThis.cssmvPanel, label: () => loginCopy("CSSMV panel") },
    r: { action: "reports", panelId: "delivery-reports-panel", panel: () => globalThis.deliveryReportsPanel, label: () => loginCopy("Reports panel") },
    o: { action: "delivery-ops", panelId: "delivery-ops-panel", panel: () => globalThis.deliveryOpsPanel, label: () => loginCopy("Delivery Ops panel") },
    a: { action: "api", panelId: "api-panel", panel: () => globalThis.apiPanel, label: () => loginCopy("API panel") },
    b: { action: "about", panelId: "about-panel", panel: () => globalThis.aboutPanel, label: () => loginCopy("About panel") },
    p: { action: "profile", panelId: "profile-panel", panel: () => globalThis.profilePanel, label: () => loginCopy("Profile panel") },
    g: { action: "settings", panelId: "settings-panel", panel: () => globalThis.settingsPanel, label: () => loginCopy("Settings panel") },
    n: { action: "language", panelId: "language-panel", panel: () => globalThis.languagePanel, label: () => loginCopy("Language panel") },
    i: { action: "login", panelId: "login-panel", panel: () => globalThis.loginPanel, label: () => loginCopy("Login panel") },
    u: { action: "subscription", panelId: "subscription-panel", panel: () => globalThis.subscriptionPanel, label: () => loginCopy("Subscription panel") },
    y: { action: "credit", panelId: "credit-panel", panel: () => globalThis.creditPanel, label: () => loginCopy("Credit panel") },
    x: { action: "workspaces", panelId: "workspaces-panel", panel: () => globalThis.workspacesPanel, label: () => loginCopy("Workspaces panel") },
    k: { action: "works", panelId: "works-panel", panel: () => globalThis.worksPanel, label: () => loginCopy("Works panel") },
    e: { action: "seller", panelId: "seller-panel", panel: () => globalThis.sellerPanel, label: () => loginCopy("Seller panel") },
    j: { action: "user-admin", panelId: "user-admin-panel", panel: () => globalThis.userAdminPanel, label: () => loginCopy("User panel") }
  };

  const panelSelectorMap = {
    h: "#logo-panel",
    f: "#foryou-panel",
    l: "#lyrics-panel",
    m: "#music-panel",
    v: "#video-panel",
    w: "#watch-panel",
    c: "#cssmv-panel",
    r: "#delivery-reports-panel",
    o: "#delivery-ops-panel",
    a: "#api-panel",
    b: "#about-panel",
    p: "#profile-panel",
    g: "#settings-panel",
    n: "#language-panel",
    i: "#login-panel",
    u: "#subscription-panel",
    y: "#credit-panel",
    x: "#workspaces-panel",
    k: "#works-panel",
    e: "#seller-panel",
    j: "#user-admin-panel"
  };

  let chordState = { stage: 0, expiresAt: 0 };

  function escapeRegex(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function currentVoiceLocale() {
    const locale =
      globalThis.CSSOS_I18N?.getCurrentLocale?.() ||
      globalThis.currentLocale ||
      globalThis.CSS_UI_LANG ||
      document.documentElement.lang ||
      "en";
    return String(locale || "en").trim().toLowerCase() || "en";
  }

  function localizedPanelCommandLabel(key, locale) {
    const meta = panelVoiceKeyMap[key];
    if (!meta) return "";
    const translated = globalThis.CSSOS_I18N?.t?.(meta.i18nKey, {}, locale);
    return String(translated || meta.fallback || "").trim();
  }

  function buildEnglishVoiceAliases() {
    return [
      { pattern: /\bopen\s+for\s*you\s+panel\b/i, key: "f" },
      { pattern: /\bopen\s+lyrics(?:\s+engine)?\s+panel\b/i, key: "l" },
      { pattern: /\bopen\s+music(?:\s+engine)?\s+panel\b/i, key: "m" },
      { pattern: /\bopen\s+video(?:\s+engine)?\s+panel\b/i, key: "v" },
      { pattern: /\bopen\s+watch\s+panel\b/i, key: "w" },
      { pattern: /\bopen\s+css\s*mv\s+panel\b/i, key: "c" },
      { pattern: /\bopen\s+(?:delivery\s+)?reports?\s+panel\b/i, key: "r" },
      { pattern: /\bopen\s+delivery\s+ops\s+panel\b/i, key: "o" },
      { pattern: /\bopen\s+api\s+panel\b/i, key: "a" },
      { pattern: /\bopen\s+about\s+panel\b/i, key: "b" },
      { pattern: /\bopen\s+profile\s+panel\b/i, key: "p" },
      { pattern: /\bopen\s+(?:advanced\s+)?settings\s+panel\b/i, key: "g" },
      { pattern: /\bopen\s+credit\s+panel\b/i, key: "y" },
      { pattern: /\bopen\s+workspaces?\s+panel\b/i, key: "x" },
      { pattern: /\bopen\s+user\s+panel\b/i, key: "j" }
    ];
  }

  function buildLocaleVoiceAliases(locale) {
    const lang = String(locale || "en").trim().toLowerCase();
    if (lang.startsWith("en")) return buildEnglishVoiceAliases();
    const specs = [];
    Object.keys(panelVoiceKeyMap).forEach((key) => {
      const label = localizedPanelCommandLabel(key, lang);
      if (!label) return;
      const escaped = escapeRegex(label);
      const compact = escapeRegex(
        label
          .replace(/\b(panel|engine|advanced)\b/gi, "")
          .replace(/[·.]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      );
      if (lang.startsWith("zh")) {
        specs.push({ pattern: new RegExp(`打开(?:${escaped}|${compact})(?:面板)?`, "i"), key });
      } else if (lang.startsWith("ja")) {
        specs.push({ pattern: new RegExp(`(?:${escaped}|${compact})(?:パネル)?を?開(?:く|いて)`, "i"), key });
        specs.push({ pattern: new RegExp(`開(?:く|いて)(?:${escaped}|${compact})(?:パネル)?`, "i"), key });
      } else if (lang.startsWith("ko")) {
        specs.push({ pattern: new RegExp(`(?:${escaped}|${compact})(?:패널)?\\s*(?:열어|열기|열어줘)`, "i"), key });
        specs.push({ pattern: new RegExp(`(?:열어|열기|열어줘)\\s*(?:${escaped}|${compact})(?:패널)?`, "i"), key });
      } else if (lang.startsWith("es")) {
        specs.push({ pattern: new RegExp(`\\babre\\s+(?:el\\s+)?(?:panel\\s+de\\s+)?(?:${escaped}|${compact})\\b`, "i"), key });
      } else if (lang.startsWith("fr")) {
        specs.push({ pattern: new RegExp(`\\bouvre\\s+(?:le\\s+)?(?:panneau\\s+)?(?:${escaped}|${compact})\\b`, "i"), key });
      } else if (lang.startsWith("de")) {
        specs.push({ pattern: new RegExp(`\\b(?:öffne|oeffne)\\s+(?:das\\s+panel\\s+)?(?:${escaped}|${compact})\\b`, "i"), key });
      } else if (lang.startsWith("pt")) {
        specs.push({ pattern: new RegExp(`\\babra\\s+(?:o\\s+painel\\s+)?(?:${escaped}|${compact})\\b`, "i"), key });
      } else if (lang.startsWith("ru")) {
        specs.push({ pattern: new RegExp(`(?:открой|открыть)\\s+(?:панель\\s+)?(?:${escaped}|${compact})`, "i"), key });
      } else if (lang.startsWith("ar")) {
        specs.push({ pattern: new RegExp(`(?:افتح|فتح)\\s+(?:لوحة\\s+)?(?:${escaped}|${compact})`, "i"), key });
      } else {
        specs.push({ pattern: new RegExp(`\\bopen\\s+${escaped}\\s+panel\\b`, "i"), key });
      }
    });
    return specs;
  }

  function shouldIgnoreShortcutTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest("input, textarea, select, [contenteditable='true']")) return true;
    return false;
  }

  function resetPanelShortcutChord() {
    chordState = { stage: 0, expiresAt: 0 };
  }

  function resolveShortcutPanel(shortcutKey) {
    const entry = resolveShortcutEntry(shortcutKey);
    const directPanel = entry?.panel?.();
    if (directPanel instanceof Element) return directPanel;
    const selector = entry?.panelId ? `#${entry.panelId}` : panelSelectorMap[String(shortcutKey || "").trim().toLowerCase()];
    if (!selector) return null;
    return document.querySelector(selector);
  }

  function resolveConfiguredPanelShortcutEntries() {
    const behavior = typeof globalThis.readPanelBehaviorSettingsLocal === "function"
      ? globalThis.readPanelBehaviorSettingsLocal()
      : null;
    return Object.entries(panelShortcutMap).map(([defaultKey, entry]) => {
      const panelCommandEntry = globalThis.resolvePanelCommandEntry?.(entry.panelId);
      const configuredKey = String(
        behavior?.panel_commands?.[panelCommandEntry?.behaviorKey || ""]?.shortcut_key ||
          defaultKey
      )
        .trim()
        .slice(0, 1)
        .toLowerCase();
      const configuredVoice = String(
        behavior?.panel_commands?.[panelCommandEntry?.behaviorKey || ""]?.voice_command || ""
      ).trim();
      return { ...entry, defaultKey, configuredKey, configuredVoice };
    });
  }

  function resolveShortcutEntry(shortcutKey) {
    const normalizedKey = String(shortcutKey || "").trim().toLowerCase();
    return resolveConfiguredPanelShortcutEntries().find(
      (entry) => entry.configuredKey === normalizedKey || entry.defaultKey === normalizedKey
    ) || null;
  }

  function resolveOpenPanelFn() {
    if (typeof globalThis.openPanel === "function") return globalThis.openPanel;
    if (typeof globalThis.openPanelBridge === "function") return globalThis.openPanelBridge;
    return null;
  }

  function openPanelFromShortcutKey(shortcutKey, meta = {}) {
    const entry = resolveShortcutEntry(shortcutKey);
    const panel = resolveShortcutPanel(shortcutKey);
    const openPanelFn = resolveOpenPanelFn();
    if (!entry) return false;
    if (entry.action === "works" && typeof globalThis.openWorksPanelModule === "function") {
      const opened = globalThis.openWorksPanelModule();
      if (!opened) return false;
      if (meta.announce !== false) {
        showToast?.(loginCopy(`Opened ${entry.label()}.`));
      }
      return true;
    }
    if (entry.action === "user-admin" && typeof globalThis.openUserAdminPanelModule === "function") {
      const opened = globalThis.openUserAdminPanelModule();
      if (!opened) return false;
      if (meta.announce !== false) {
        showToast?.(loginCopy(`Opened ${entry.label()}.`));
      }
      return true;
    }
    if (!(panel instanceof Element) || typeof openPanelFn !== "function") return false;
    openPanelFn(panel);
    if (meta.announce !== false) {
      showToast?.(
        loginCopy(
          `Opened ${entry.label()}.`
        )
      );
    }
    return true;
  }

  function handlePanelShortcutKeydown(event) {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.repeat || shouldIgnoreShortcutTarget(event.target)) return;
    const now = Date.now();
    const key = String(event.key || "").trim().toLowerCase();
    if (now > chordState.expiresAt) resetPanelShortcutChord();
    if (key === "c" && chordState.stage === 0) {
      chordState = { stage: 1, expiresAt: now + 1200 };
      event.preventDefault();
      return;
    }
    if (key === "s" && chordState.stage === 1) {
      chordState = { stage: 2, expiresAt: now + 1200 };
      event.preventDefault();
      return;
    }
    if (chordState.stage === 2) {
      const handled = openPanelFromShortcutKey(key);
      resetPanelShortcutChord();
      if (handled) {
        event.preventDefault();
      }
      return;
    }
    resetPanelShortcutChord();
  }

  function parsePanelVoiceCommandModule(transcript) {
    const raw = String(transcript || "").trim();
    if (!raw) return null;
    const normalized = raw.toLowerCase();
    const configuredAliases = resolveConfiguredPanelShortcutEntries()
      .filter((entry) => entry.configuredVoice)
      .map((entry) => ({
        pattern: new RegExp(escapeRegex(entry.configuredVoice), "i"),
        key: entry.configuredKey || entry.defaultKey
      }));
    const literalAliases = [
      { pattern: /\bopen\s+for\s*you\b/i, key: "f" },
      { pattern: /\bopen\s+lyrics\b/i, key: "l" },
      { pattern: /\bopen\s+music\b/i, key: "m" },
      { pattern: /\bopen\s+video\b/i, key: "v" },
      { pattern: /\bopen\s+watch\b/i, key: "w" },
      { pattern: /\bopen\s+css\s*mv\b/i, key: "c" },
      { pattern: /\bopen\s+reports?\b/i, key: "r" },
      { pattern: /\bopen\s+delivery\s+ops\b/i, key: "o" },
      { pattern: /\bopen\s+api\b/i, key: "a" },
      { pattern: /\bopen\s+about\b/i, key: "b" },
      { pattern: /\bopen\s+profile\b/i, key: "p" },
      { pattern: /\bopen\s+settings\b/i, key: "g" },
      { pattern: /\bopen\s+subscription(?:\s+panel)?\b/i, key: "u" },
      { pattern: /\bopen\s+works(?:\s+panel)?\b/i, key: "k" },
      { pattern: /\bopen\s+seller(?:\s+panel)?\b/i, key: "e" },
      { pattern: /打开为你创作(?:面板)?/i, key: "f" },
      { pattern: /打开歌词(?:面板)?/i, key: "l" },
      { pattern: /打开音乐(?:面板)?/i, key: "m" },
      { pattern: /打开视频(?:面板)?/i, key: "v" },
      { pattern: /打开观看(?:面板)?/i, key: "w" },
      { pattern: /打开(?:css\s*mv|cssmv)(?:面板)?/i, key: "c" },
      { pattern: /打开报表(?:面板)?/i, key: "r" },
      { pattern: /打开交付运维(?:面板)?/i, key: "o" },
      { pattern: /打开api(?:面板)?/i, key: "a" },
      { pattern: /打开关于(?:面板)?/i, key: "b" },
      { pattern: /打开个人资料(?:面板)?/i, key: "p" },
      { pattern: /打开设置(?:面板)?/i, key: "g" },
      { pattern: /打开订阅(?:面板)?/i, key: "u" },
      { pattern: /打开作品(?:面板)?/i, key: "k" },
      { pattern: /打开商家(?:面板)?/i, key: "e" }
    ];
    const localeAliases = buildLocaleVoiceAliases(currentVoiceLocale());
    const matched = [...configuredAliases, ...literalAliases, ...localeAliases, ...buildEnglishVoiceAliases()].find((entry) =>
      entry.pattern.test(raw) || entry.pattern.test(normalized)
    );
    if (!matched) return null;
    const shortcut = panelShortcutMap[matched.key];
    if (!shortcut) return null;
    return {
      shortcutKey: matched.key,
      action: shortcut.action,
      label: shortcut.label()
    };
  }

  function executePanelVoiceCommandModule(transcript, options = {}) {
    const command = parsePanelVoiceCommandModule(transcript);
    if (!command) return false;
    return openPanelFromShortcutKey(command.shortcutKey, options);
  }

  function initPanelShortcutsModule() {
    if (!document.body) {
      window.addEventListener("DOMContentLoaded", initPanelShortcutsModule, { once: true });
      return;
    }
    if (document.body.dataset.panelShortcutsBound === "true") return;
    document.body.dataset.panelShortcutsBound = "true";
    // W1766 — dispatch via unified hub at the SAME window/capture phase; fallback
    // keeps the raw capturing listener if the hub is absent (zero behavior change).
    if (globalThis.cssosShortcuts && globalThis.cssosShortcuts.register) {
      globalThis.cssosShortcuts.register({
        id: "panel-chord", owned: true, target: "window", phase: "capture",
        handler: handlePanelShortcutKeydown, keys: "C then S then …", source: "app.panel-shortcuts.js",
        desc: function () { return globalThis.cssosShortcuts.lc("Open panel by letter (C-S-f/l/m/…)", "面板快捷 chord (C-S-字母)"); }
      });
    } else {
      window.addEventListener("keydown", handlePanelShortcutKeydown, true);
    }
  }

  Object.assign(globalThis, {
    parsePanelVoiceCommandModule,
    executePanelVoiceCommandModule,
    initPanelShortcutsModule
  });

  initPanelShortcutsModule();
})();
