(() => {
  const PANEL_COMMAND_CATALOG = {
    "logo-panel": {
      behaviorKey: "logo",
      fallbackShortcut: "h",
      fallbackVoice: { en: "open logo panel", zh: "打开logo面板" }
    },
    "foryou-panel": {
      behaviorKey: "foryou",
      fallbackShortcut: "f",
      fallbackVoice: { en: "open for you panel", zh: "打开为你创作面板" }
    },
    "lyrics-panel": {
      behaviorKey: "lyrics",
      fallbackShortcut: "l",
      fallbackVoice: { en: "open lyrics panel", zh: "打开歌词面板" }
    },
    "music-panel": {
      behaviorKey: "music",
      fallbackShortcut: "m",
      fallbackVoice: { en: "open music panel", zh: "打开音乐面板" }
    },
    "video-panel": {
      behaviorKey: "video",
      fallbackShortcut: "v",
      fallbackVoice: { en: "open video panel", zh: "打开视频面板" }
    },
    "watch-panel": {
      behaviorKey: "watch",
      fallbackShortcut: "w",
      fallbackVoice: { en: "open watch panel", zh: "打开观看面板" }
    },
    "cssmv-panel": {
      behaviorKey: "cssmv",
      fallbackShortcut: "c",
      fallbackVoice: { en: "open css mv panel", zh: "打开CSSMV面板" }
    },
    "delivery-reports-panel": {
      behaviorKey: "delivery_reports",
      fallbackShortcut: "r",
      fallbackVoice: { en: "open delivery reports panel", zh: "打开交付报表面板" }
    },
    "delivery-ops-panel": {
      behaviorKey: "delivery_ops",
      fallbackShortcut: "o",
      fallbackVoice: { en: "open delivery ops panel", zh: "打开交付运维面板" }
    },
    "api-panel": {
      behaviorKey: "api",
      fallbackShortcut: "a",
      fallbackVoice: { en: "open api panel", zh: "打开API面板" }
    },
    "about-panel": {
      behaviorKey: "about",
      fallbackShortcut: "b",
      fallbackVoice: { en: "open about panel", zh: "打开关于面板" }
    },
    "profile-panel": {
      behaviorKey: "profile",
      fallbackShortcut: "p",
      fallbackVoice: { en: "open profile panel", zh: "打开个人资料面板" }
    },
    "settings-panel": {
      behaviorKey: "settings",
      fallbackShortcut: "g",
      fallbackVoice: { en: "open settings panel", zh: "打开设置面板" }
    },
    "language-panel": {
      behaviorKey: "language",
      fallbackShortcut: "n",
      fallbackVoice: { en: "open language panel", zh: "打开语言面板" }
    },
    "login-panel": {
      behaviorKey: "login",
      fallbackShortcut: "i",
      fallbackVoice: { en: "open login panel", zh: "打开登录面板" }
    },
    "subscription-panel": {
      behaviorKey: "subscription",
      fallbackShortcut: "u",
      fallbackVoice: { en: "open subscription panel", zh: "打开订阅面板" }
    },
    "credit-panel": {
      behaviorKey: "credit",
      fallbackShortcut: "y",
      fallbackVoice: { en: "open credit panel", zh: "打开信用面板" }
    },
    "workspaces-panel": {
      behaviorKey: "workspaces",
      fallbackShortcut: "x",
      fallbackVoice: { en: "open workspaces panel", zh: "打开工作区面板" }
    },
    "works-panel": {
      behaviorKey: "works",
      fallbackShortcut: "k",
      fallbackVoice: { en: "open works panel", zh: "打开作品面板" }
    },
    "seller-panel": {
      behaviorKey: "seller",
      fallbackShortcut: "e",
      fallbackVoice: { en: "open seller panel", zh: "打开商家面板" }
    },
    "user-admin-panel": {
      behaviorKey: "user_admin",
      fallbackShortcut: "j",
      fallbackVoice: { en: "open user panel", zh: "打开用户面板" }
    }
  };

  function resolvePanelCommandEntry(panelOrId) {
    const panelId =
      typeof panelOrId === "string"
        ? panelOrId
        : panelOrId instanceof Element
          ? String(panelOrId.id || "")
          : "";
    return PANEL_COMMAND_CATALOG[panelId] || null;
  }

  function fallbackVoiceCommandForPanel(panelOrId, locale = "en") {
    const entry = resolvePanelCommandEntry(panelOrId);
    const normalizedLocale = String(locale || "en").trim().toLowerCase();
    if (!entry) return "";
    if (normalizedLocale.startsWith("zh")) return entry.fallbackVoice.zh || entry.fallbackVoice.en || "";
    return entry.fallbackVoice.en || "";
  }

  function fallbackShortcutChordForPanel(panelOrId) {
    const entry = resolvePanelCommandEntry(panelOrId);
    const shortcut = String(entry?.fallbackShortcut || "")
      .trim()
      .slice(0, 1)
      .toUpperCase();
    return shortcut ? `C + S + ${shortcut}` : "";
  }

  Object.assign(globalThis, {
    PANEL_COMMAND_CATALOG,
    resolvePanelCommandEntry,
    fallbackVoiceCommandForPanel,
    fallbackShortcutChordForPanel
  });
})();
