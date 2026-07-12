(() => {
  const T = (en) => (typeof globalThis.loginCopy === "function" ? globalThis.loginCopy(en) : en);

  const PANEL_COMMAND_CATALOG = {
    "logo-panel": {
      behaviorKey: "logo",
      fallbackShortcut: "h",
      fallbackVoice: "open logo panel"
    },
    "foryou-panel": {
      behaviorKey: "foryou",
      fallbackShortcut: "f",
      fallbackVoice: "open for you panel"
    },
    "lyrics-panel": {
      behaviorKey: "lyrics",
      fallbackShortcut: "l",
      fallbackVoice: "open lyrics panel"
    },
    "music-panel": {
      behaviorKey: "music",
      fallbackShortcut: "m",
      fallbackVoice: "open music panel"
    },
    "video-panel": {
      behaviorKey: "video",
      fallbackShortcut: "v",
      fallbackVoice: "open video panel"
    },
    "watch-panel": {
      behaviorKey: "watch",
      fallbackShortcut: "w",
      fallbackVoice: "open watch panel"
    },
    "cssmv-panel": {
      behaviorKey: "cssmv",
      fallbackShortcut: "c",
      fallbackVoice: "open css mv panel"
    },
    "delivery-reports-panel": {
      behaviorKey: "delivery_reports",
      fallbackShortcut: "r",
      fallbackVoice: "open delivery reports panel"
    },
    "delivery-ops-panel": {
      behaviorKey: "delivery_ops",
      fallbackShortcut: "o",
      fallbackVoice: "open delivery ops panel"
    },
    "api-panel": {
      behaviorKey: "api",
      fallbackShortcut: "a",
      fallbackVoice: "open api panel"
    },
    "about-panel": {
      behaviorKey: "about",
      fallbackShortcut: "b",
      fallbackVoice: "open about panel"
    },
    "profile-panel": {
      behaviorKey: "profile",
      fallbackShortcut: "p",
      fallbackVoice: "open profile panel"
    },
    "settings-panel": {
      behaviorKey: "settings",
      fallbackShortcut: "g",
      fallbackVoice: "open settings panel"
    },
    "language-panel": {
      behaviorKey: "language",
      fallbackShortcut: "n",
      fallbackVoice: "open language panel"
    },
    "login-panel": {
      behaviorKey: "login",
      fallbackShortcut: "i",
      fallbackVoice: "open login panel"
    },
    "subscription-panel": {
      behaviorKey: "subscription",
      fallbackShortcut: "u",
      fallbackVoice: "open subscription panel"
    },
    "credit-panel": {
      behaviorKey: "credit",
      fallbackShortcut: "y",
      fallbackVoice: "open credit panel"
    },
    "workspaces-panel": {
      behaviorKey: "workspaces",
      fallbackShortcut: "x",
      fallbackVoice: "open workspaces panel"
    },
    "works-panel": {
      behaviorKey: "works",
      fallbackShortcut: "k",
      fallbackVoice: "open works panel"
    },
    "seller-panel": {
      behaviorKey: "seller",
      fallbackShortcut: "e",
      fallbackVoice: "open seller panel"
    },
    "user-admin-panel": {
      behaviorKey: "user_admin",
      fallbackShortcut: "j",
      fallbackVoice: "open user panel"
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
    if (!entry) return "";
    return T(entry.fallbackVoice || "");
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
