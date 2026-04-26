(function attachContextMenuModule(global) {
  const LONGPRESS_MS = 520;
  let menuEl = null;
  let longpressTimer = null;
  let touchAnchor = null;
  let translatePopoverEl = null;
  let lastContextAnchor = null;
  const TRANSLATE_LANGUAGE_OPTIONS = [
    { value: "auto", label: "Auto" },
    { value: "en", label: "English" },
    { value: "zh-CN", label: "简体中文" },
    { value: "zh-TW", label: "繁體中文" },
    { value: "ja", label: "日本語" },
    { value: "ko", label: "한국어" },
    { value: "fr", label: "Français" },
    { value: "de", label: "Deutsch" },
    { value: "es", label: "Español" },
  ];

  // CSSMV_TRANSLATE_TARGET_STICKY 20260420 — Jing: the Target-language
  // dropdown in the right-click translate popover must remember the last
  // selection across sessions. When the user has never set it, fall back to
  // the UI primary language. Persist via localStorage.
  const TRANSLATE_TARGET_LS_KEY = "cssos.translate.target.lang";
  const TRANSLATE_TARGET_VALUES = new Set(
    TRANSLATE_LANGUAGE_OPTIONS.map((option) => option.value).filter((value) => value !== "auto")
  );

  function loadSavedTranslateTargetModule() {
    try {
      if (typeof localStorage === "undefined") return "";
      const raw = String(localStorage.getItem(TRANSLATE_TARGET_LS_KEY) || "").trim();
      return TRANSLATE_TARGET_VALUES.has(raw) ? raw : "";
    } catch (_err) {
      return "";
    }
  }

  function saveTranslateTargetModule(value) {
    try {
      if (typeof localStorage === "undefined") return;
      const normalized = String(value || "").trim();
      if (!TRANSLATE_TARGET_VALUES.has(normalized)) return;
      localStorage.setItem(TRANSLATE_TARGET_LS_KEY, normalized);
    } catch (_err) { /* no-op */ }
  }

  function resolveUiTranslateTargetModule() {
    const raw = String(
      global.currentLocale ||
      document.documentElement?.lang ||
      (typeof localStorage !== "undefined" && (localStorage.getItem("CSSOS_LANG") || localStorage.getItem("cssos.locale"))) ||
      "en"
    ).trim().toLowerCase();
    // Map common UI locales to a supported target value. We prefer zh-CN
    // for bare "zh", but honor zh-TW / zh-HK variants explicitly.
    if (raw === "zh-tw" || raw === "zh-hk" || raw === "zh_tw" || raw === "zh_hk") return "zh-TW";
    if (raw.startsWith("zh")) return "zh-CN";
    const primary = raw.split(/[-_]/)[0];
    const supported = ["en", "ja", "ko", "fr", "de", "es"];
    if (supported.includes(primary)) return primary;
    return "en";
  }

  function resolveInitialTranslateTargetModule() {
    return loadSavedTranslateTargetModule() || resolveUiTranslateTargetModule();
  }

  function isLightTheme() {
    return String(document.body?.dataset?.theme || document.documentElement?.dataset?.theme || "").trim().toLowerCase() === "light";
  }

  function menuThemePalette() {
    if (isLightTheme()) {
      return {
        border: "1px solid rgba(13, 143, 98, 0.16)",
        background:
          "linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(244, 249, 245, 0.95))",
        shadow: "0 18px 40px rgba(20, 38, 28, 0.12)",
        text: "rgba(19, 36, 28, 0.94)",
        hover: "rgba(13, 143, 98, 0.09)",
      };
    }
    return {
      border: "1px solid rgba(78, 201, 140, 0.3)",
      background: "rgba(7, 12, 10, 0.96)",
      shadow: "0 18px 48px rgba(0,0,0,0.45)",
      text: "#effaf1",
      hover: "rgba(78, 201, 140, 0.14)",
    };
  }

  function menuCopy(en, zh) {
    if (typeof global.loginCopy === "function") return global.loginCopy(en, zh);
    const locale = String(global.currentLocale || "en").toLowerCase();
    return locale.startsWith("zh") ? zh : en;
  }

  function ensureMenuRoot() {
    if (menuEl instanceof HTMLElement) return menuEl;
    const palette = menuThemePalette();
    menuEl = document.createElement("div");
    menuEl.id = "cssos-context-menu";
    menuEl.hidden = true;
    Object.assign(menuEl.style, {
      position: "fixed",
      zIndex: "99999",
      minWidth: "220px",
      maxWidth: "320px",
      padding: "8px",
      borderRadius: "18px",
      border: palette.border,
      background: palette.background,
      boxShadow: palette.shadow,
      backdropFilter: "blur(14px)"
    });
    document.body.appendChild(menuEl);
    return menuEl;
  }

  function ensureTranslatePopoverRoot() {
    if (translatePopoverEl instanceof HTMLElement) return translatePopoverEl;
    const palette = menuThemePalette();
    translatePopoverEl = document.createElement("div");
    translatePopoverEl.id = "cssos-translate-popover";
    translatePopoverEl.hidden = true;
    Object.assign(translatePopoverEl.style, {
      position: "fixed",
      zIndex: "100000",
      width: "min(420px, calc(100vw - 24px))",
      maxWidth: "calc(100vw - 24px)",
      padding: "14px",
      borderRadius: "22px",
      border: palette.border,
      background: palette.background,
      boxShadow: palette.shadow,
      color: palette.text,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)"
    });
    translatePopoverEl.addEventListener("pointerdown", (event) => event.stopPropagation());
    translatePopoverEl.addEventListener("mousedown", (event) => event.stopPropagation());
    translatePopoverEl.addEventListener("click", (event) => event.stopPropagation());
    document.body.appendChild(translatePopoverEl);
    return translatePopoverEl;
  }

  function hideContextMenuModule() {
    if (!(menuEl instanceof HTMLElement)) return false;
    menuEl.hidden = true;
    menuEl.innerHTML = "";
    return true;
  }

  function hideTranslatePopoverModule() {
    if (!(translatePopoverEl instanceof HTMLElement)) return false;
    translatePopoverEl.hidden = true;
    translatePopoverEl.innerHTML = "";
    return true;
  }

  function openPanelSettingsFor(panel) {
    if (typeof global.openPanelSettings === "function") return global.openPanelSettings(panel);
    if (typeof global.togglePanelSettings === "function") return global.togglePanelSettings(panel, true);
    return false;
  }

  function isSignedIn() {
    try {
      if (typeof isLoggedInUser === "function") return !!isLoggedInUser();
    } catch (_) {}
    try {
      if (typeof authState !== "undefined") return !!authState?.user;
    } catch (_) {}
    return !!global.authState?.user;
  }

  function hasPermission(scope) {
    try {
      if (typeof hasPanelPermission === "function") return !!hasPanelPermission(scope);
    } catch (_) {}
    if (typeof global.hasPanelPermission === "function") {
      return !!global.hasPanelPermission(scope);
    }
    return false;
  }

  function isPublicAction(action) {
    return ["login", "language", "subscription", "about"].includes(String(action || "").trim().toLowerCase());
  }

  function canAccessAction(action) {
    const normalized = String(action || "").trim().toLowerCase();
    if (!normalized) return false;
    if (isPublicAction(normalized)) return true;
    if (!isSignedIn()) return false;
    if (normalized === "user-admin") {
      return hasPermission("admin.panel");
    }
    const panel = resolvePanelForAction(normalized);
    if (!(panel instanceof HTMLElement)) return true;
    if (typeof global.canAccessPanelElement === "function") {
      return !!global.canAccessPanelElement(panel);
    }
    return true;
  }

  function buildSignInItem() {
    return {
      icon: "🔐",
      label: menuCopy("Open Login", "打开登录面板"),
      run: () => {
        if (typeof global.openLoginForCreation === "function") {
          global.openLoginForCreation(
            menuCopy("Sign in to unlock studio creation panels.", "请先登录后再使用创作面板。")
          );
          return;
        }
        global.openPanel?.(global.loginPanel);
      }
    };
  }

  function isPanelOpen(panel) {
    return panel instanceof HTMLElement && !panel.classList.contains("hidden");
  }

  function closestDockItem(target) {
    return target?.closest?.(".dock-item") || null;
  }

  function closestPanel(target) {
    return target?.closest?.(".panel") || null;
  }

  function isButtonLikeTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest(
      [
        "button",
        "a",
        "input",
        "select",
        "textarea",
        "[role=\"button\"]",
        "[data-action]",
        "[data-hold]",
        "[data-watch-tab]",
        "[data-tab]",
        "[data-profile-nav]",
        ".dock-item",
        ".icon-btn",
        ".watch-tab",
        ".about-tab",
        ".watch-overlay-play",
        ".watch-music-play",
        "#foryou-title",
        "#foryou-thumb-image",
        "#foryou-thumb-video",
        "#foryou-thumb-fallback",
        ".version-toggle",
        "#logo-panel .mirror-stage"
      ].join(", ")
    );
  }

  function panelDisplayName(panel, fallbackAction = "") {
    const title = String(panel?.querySelector?.(".panel-title")?.textContent || "").trim();
    if (title) return title;
    const action = String(fallbackAction || "").trim().toLowerCase();
    const fallbackMap = {
      foryou: menuCopy("For You", "为你创作"),
      cssmv: "CSSMV",
      lyrics: menuCopy("Lyrics", "歌词"),
      music: menuCopy("Music", "音乐"),
      video: menuCopy("Video", "视频"),
      watch: menuCopy("Watch", "欣赏"),
      about: menuCopy("About", "关于"),
      api: "API",
      reports: menuCopy("Reports", "报表"),
      "delivery-ops": menuCopy("Delivery Ops", "交付操作"),
      login: menuCopy("Login", "登录"),
      subscription: menuCopy("Subscription", "订阅"),
      works: menuCopy("Works", "作品中心"),
      notifications: menuCopy("Notifications", "通知"),
      seller: menuCopy("Seller", "卖家"),
      language: menuCopy("Language", "语言"),
      settings: menuCopy("Settings", "设置"),
      profile: menuCopy("Profile", "资料")
    };
    return fallbackMap[action] || menuCopy("Panel", "面板");
  }

  function togglePanelFromContext(action, panel) {
    if (!canAccessAction(action)) {
      return buildSignInItem().run();
    }
    if (!(panel instanceof HTMLElement)) {
      return global.handleDockAction?.(action, "click");
    }
    if (isPanelOpen(panel)) {
      return global.minimizeToDock?.(panel);
    }
    return global.handleDockAction?.(action, "click");
  }

  function resolvePanelForAction(action) {
    const normalized = String(action || "").trim().toLowerCase();
    const mapping = {
      foryou: global.foryouPanel,
      cssmv: global.cssmvPanel,
      lyrics: global.lyricsPanel,
      music: global.musicPanel,
      video: global.videoPanel,
      watch: global.watchPanel,
      about: global.aboutPanel,
      api: global.apiPanel,
      reports: global.deliveryReportsPanel,
      "delivery-ops": global.deliveryOpsPanel,
      login: global.loginPanel,
      subscription: global.subscriptionPanel,
      credit: global.creditPanel,
      notifications: global.notificationsPanel,
      workspaces: global.workspacesPanel,
      works: global.worksPanel,
      seller: global.sellerPanel,
      language: global.languagePanel,
      settings: global.settingsPanel,
      profile: global.profilePanel
    };
    return mapping[normalized] || null;
  }

  function resolveActionForPanel(panel) {
    const id = String(panel?.id || "").trim().toLowerCase();
    const mapping = {
      "foryou-panel": "foryou",
      "cssmv-panel": "cssmv",
      "lyrics-panel": "lyrics",
      "music-panel": "music",
      "video-panel": "video",
      "watch-panel": "watch",
      "about-panel": "about",
      "api-panel": "api",
      "delivery-reports-panel": "reports",
      "delivery-ops-panel": "delivery-ops",
      "login-panel": "login",
      "subscription-panel": "subscription",
      "credit-panel": "credit",
      "notifications-panel": "notifications",
      "workspaces-panel": "workspaces",
      "works-panel": "works",
      "seller-panel": "seller",
      "language-panel": "language",
      "settings-panel": "settings",
      "profile-panel": "profile",
      "user-admin-panel": "user-admin"
    };
    return mapping[id] || "";
  }

  function buildCommonItems(target) {
    const currentPanel = closestPanel(target);
    const currentAction = resolveActionForPanel(currentPanel);
    const publicItems = [
      {
        icon: "🔐",
        label: menuCopy("Open Login", "打开登录面板"),
        run: () => global.openPanel?.(global.loginPanel)
      },
      {
        icon: "🌐",
        label: menuCopy("Open Language", "打开语言面板"),
        run: () => global.openPanel?.(global.languagePanel)
      },
      {
        icon: "💎",
        label: menuCopy("Open Subscription", "打开订阅面板"),
        run: () => global.openSubscriptionPanelModule?.() || global.openPanel?.(global.subscriptionPanel)
      }
    ];
    if (!isSignedIn()) {
      return publicItems;
    }
    const items = [
      ...publicItems.slice(1),
      {
        icon: "◎",
        label: global.t?.("context.oneTapMv") || menuCopy("One-Tap MV", "一键MV"),
        run: () => {
          // CSSOS_PHASE2_UNIFIED_ENTRY 20260426 #138 — Jing
          // Route through cssmvUnifiedEntry for the [entry:context-menu-mv]
          // diagnostic + fresh-result short-circuit. Falls back to the
          // legacy invokeUniversalCreationEntry if the helper is missing.
          if (typeof global.cssmvUnifiedEntry === "function") {
            void global.cssmvUnifiedEntry({
              source: "context-menu-mv",
              preferredTab: "mv"
            });
            return;
          }
          void global.invokeUniversalCreationEntry?.({
            origin: "logo",
            preferredTab: "mv",
            submitVoiceFallback: true
          });
        }
      },
      {
        icon: "⌁",
        label: menuCopy("Open For You", "打开为你创作"),
        run: () => global.openPanel?.(global.foryouPanel)
      },
      {
        icon: "🗂",
        label: menuCopy("Open Works", "打开作品中心"),
        run: () => global.openWorksPanelModule?.() || global.openPanel?.(global.worksPanel)
      },
      {
        icon: "🏦",
        label: menuCopy("Open Credit", "打开信用面板"),
        run: () => global.openCreditPanelModule?.() || global.openPanel?.(global.creditPanel)
      },
      {
        icon: "🧱",
        label: menuCopy("Open Workspaces", "打开工作区面板"),
        run: () => global.openWorkspacesPanelModule?.() || global.openPanel?.(global.workspacesPanel)
      },
      {
        icon: "⚙",
        label: menuCopy("Open Settings", "打开设置"),
        run: () => global.openPanel?.(global.settingsPanel)
      }
    ];
    if (hasPermission("admin.panel")) {
      items.push({
        icon: "👤",
        label: menuCopy("Open User Panel", "打开用户面板"),
        run: () => global.openUserAdminPanelModule?.()
      });
    }
    return items.filter((item) => {
      const label = String(item?.label || "").toLowerCase();
      if (!currentAction) return true;
      if (currentAction === "subscription" && label.includes("subscription")) return false;
      if (currentAction === "login" && label.includes("login")) return false;
      if (currentAction === "language" && label.includes("language")) return false;
      if (currentAction === "credit" && label.includes("credit")) return false;
      if (currentAction === "workspaces" && (label.includes("workspace") || label.includes("工作区"))) {
        return false;
      }
      if (currentAction === "works" && (label.includes("works") || label.includes("作品中心"))) {
        return false;
      }
      if (currentAction === "settings" && (label.includes("settings") || label.includes("打开设置"))) {
        return false;
      }
      if (currentAction === "foryou" && (label.includes("for you") || label.includes("为你创作"))) {
        return false;
      }
      return true;
    });
  }

  function extractContextText(target) {
    try {
      const selection = String(global.getSelection?.()?.toString?.() || "").replace(/\s+/g, " ").trim();
      if (selection) return selection;
    } catch (_err) {}
    if (!(target instanceof Element)) return "";
    const input = target.closest?.("input, textarea");
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      const value = String(input.value || "").trim();
      const start = Number.isFinite(input.selectionStart) ? Number(input.selectionStart) : -1;
      const end = Number.isFinite(input.selectionEnd) ? Number(input.selectionEnd) : -1;
      if (start >= 0 && end > start) {
        const selected = String(value.slice(start, end)).trim();
        if (selected) return selected;
      }
      if (value) return value;
    }
    const textTarget = target.closest?.(
      [
        ".watch-subtitle",
        ".watch-karaoke-line",
        ".work-title",
        ".work-style",
        ".work-extra",
        ".panel-title",
        ".panel-label",
        ".foryou-selection-lyrics",
        ".watch-editor",
        ".report-empty",
        "p",
        "h1",
        "h2",
        "h3",
        "span",
        "div"
      ].join(", ")
    );
    const text = String(textTarget?.textContent || target.textContent || "").replace(/\s+/g, " ").trim();
    return text.slice(0, 2000);
  }

  function extractContextBlockTitle(target) {
    if (!(target instanceof Element)) return "";
    const scoped = target.closest?.(
      [
        ".watch-screen",
        ".watch-info-card",
        ".work-card",
        ".notification-card",
        ".panel",
        ".report-card",
        ".foryou-selection",
      ].join(", ")
    );
    const title = String(
      scoped?.querySelector?.(
        ".watch-info-kicker, .panel-title, .work-title, .notification-title, .report-section-title, .foryou-selection-title"
      )?.textContent || ""
    ).trim();
    return title;
  }

  async function copyContextText(target) {
    const text = extractContextText(target);
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "true");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand?.("copy");
        area.remove();
      }
      global.showToast?.(menuCopy("Copied", "已复制"));
      return true;
    } catch (_err) {
      global.showToast?.(menuCopy("Copy failed", "复制失败"));
      return false;
    }
  }

  // Find the nearest editable surface to paste into. Returns:
  //   { kind: "input", el }  for <input> / <textarea>
  //   { kind: "ce", el }     for a contenteditable host (or a descendant
  //                          of one; el is the contenteditable root)
  //   null                   if nothing nearby is editable
  function findEditableTarget(target) {
    if (!(target instanceof Element)) return null;
    const direct = target.closest?.(
      [
        "input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]):not([type=button]):not([type=submit]):not([type=reset]):not([disabled]):not([readonly])",
        "textarea:not([disabled]):not([readonly])",
        '[contenteditable=""]',
        '[contenteditable="true"]',
        '[contenteditable="plaintext-only"]',
      ].join(", "),
    );
    if (direct instanceof HTMLInputElement || direct instanceof HTMLTextAreaElement) {
      return { kind: "input", el: direct };
    }
    if (direct instanceof HTMLElement) {
      return { kind: "ce", el: direct };
    }
    // Fallback: if the page currently has an active editable element (e.g.
    // user right-clicked a menu button but the focused field is an editor
    // right above it), paste into that.
    const active = document.activeElement;
    if (
      (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
      !active.disabled &&
      !active.readOnly
    ) {
      return { kind: "input", el: active };
    }
    if (active instanceof HTMLElement && active.isContentEditable) {
      return { kind: "ce", el: active };
    }
    return null;
  }

  function insertIntoInputOrTextarea(el, text) {
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
    const start = typeof el.selectionStart === "number" ? el.selectionStart : el.value.length;
    const end = typeof el.selectionEnd === "number" ? el.selectionEnd : el.value.length;
    // setRangeText handles both insertion and replacement of the current
    // selection, and it also moves the caret to after the inserted text.
    if (typeof el.setRangeText === "function") {
      try {
        el.focus();
        el.setRangeText(text, start, end, "end");
      } catch (_err) {
        el.value = el.value.slice(0, start) + text + el.value.slice(end);
        try {
          el.setSelectionRange(start + text.length, start + text.length);
        } catch (_e) {}
      }
    } else {
      el.value = el.value.slice(0, start) + text + el.value.slice(end);
    }
    // Fire an input event so any framework / listener downstream reacts as
    // if the user typed.
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function insertIntoContentEditable(el, text) {
    if (!(el instanceof HTMLElement)) return false;
    try {
      el.focus();
    } catch (_e) {}
    // Prefer execCommand('insertText') — it honours the current selection
    // and generates the right input event. Deprecated but still the most
    // reliable cross-browser approach for plain-text pasting.
    const ok = document.execCommand?.("insertText", false, text);
    if (ok) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    // Fallback: replace selection via Range API, then append text.
    const sel = window.getSelection?.();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    // Last resort: append to end.
    el.appendChild(document.createTextNode(text));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  async function readClipboardText() {
    if (navigator.clipboard?.readText) {
      try {
        return String(await navigator.clipboard.readText());
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  async function pasteContextText(target) {
    const text = await readClipboardText();
    if (text == null) {
      global.showToast?.(
        menuCopy(
          "Clipboard access blocked. Please grant clipboard permission.",
          "剪贴板访问被拒绝，请授予剪贴板权限。",
        ),
      );
      return false;
    }
    if (!text) {
      global.showToast?.(menuCopy("Clipboard is empty", "剪贴板为空"));
      return false;
    }
    const editable = findEditableTarget(target);
    if (!editable) {
      global.showToast?.(
        menuCopy("No editable field to paste into", "当前位置无法粘贴"),
      );
      return false;
    }
    const ok =
      editable.kind === "input"
        ? insertIntoInputOrTextarea(editable.el, text)
        : insertIntoContentEditable(editable.el, text);
    if (ok) {
      global.showToast?.(menuCopy("Pasted", "已粘贴"));
      return true;
    }
    global.showToast?.(menuCopy("Paste failed", "粘贴失败"));
    return false;
  }

  // Detect whether the right-click target is an image (cover art, album
  // thumbnail, For-You slideshow frame, etc.) and return its src URL. We
  // support both <img> elements and elements with a CSS background-image.
  function resolveImageSrc(target) {
    if (!(target instanceof Element)) return "";
    // <img> — direct or nested
    const img = target.closest?.("img") || target.querySelector?.("img");
    if (img instanceof HTMLImageElement && img.currentSrc) {
      return img.currentSrc;
    }
    if (img instanceof HTMLImageElement && img.src) {
      return img.src;
    }
    // Elements that semantically represent a cover/art frame.
    const frame = target.closest?.(
      [
        ".work-cover",
        ".watch-music-art",
        ".watch-music-disc",
        ".watch-music-ring",
        ".foryou-thumb",
        ".foryou-thumb-image",
        ".cssmv-cover-slide",
        ".watch-frame-image",
        ".cover-image",
      ].join(", "),
    );
    const candidates = [];
    if (frame instanceof Element) candidates.push(frame);
    candidates.push(target);
    for (const el of candidates) {
      const style = window.getComputedStyle?.(el);
      const bg = String(style?.backgroundImage || "").trim();
      if (bg && bg !== "none") {
        const m = bg.match(/url\((?:"([^"]+)"|'([^']+)'|([^)]+))\)/);
        const url = m ? m[1] || m[2] || m[3] : "";
        if (url && !url.startsWith("data:") && !url.startsWith("blob:")) {
          return url;
        }
        if (url) return url; // data/blob urls still open in a new tab
      }
    }
    return "";
  }

  function buildImageItems(target) {
    const src = resolveImageSrc(target);
    if (!src) return [];
    return [
      {
        icon: "↗",
        label: menuCopy("Open image in new tab", "在新标签页中打开图片"),
        run: () => {
          try {
            const win = global.open?.(src, "_blank", "noopener,noreferrer");
            if (!win) {
              // Pop-up blocked — fall back to clipboard.
              navigator.clipboard?.writeText?.(src);
              global.showToast?.(
                menuCopy(
                  "Pop-up blocked. Image URL copied to clipboard.",
                  "弹窗被拦截，图片链接已复制到剪贴板。",
                ),
              );
            }
          } catch (_err) {
            global.showToast?.(menuCopy("Open failed", "打开失败"));
          }
        },
      },
    ];
  }

  async function requestLightweightTranslationModule(text, targetLang, sourceLang = "auto") {
    const safeText = String(text || "").trim();
    if (!safeText) return null;
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang || "auto")}&dt=t&tl=${encodeURIComponent(targetLang)}&q=${encodeURIComponent(safeText)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`translate_http_${res.status}`);
    }
    const payload = await res.json();
    const translated = Array.isArray(payload?.[0])
      ? payload[0].map((row) => String(row?.[0] || "")).join("")
      : "";
    const detected = String(payload?.[2] || "").trim();
    return {
      translated: translated.trim(),
      detected,
    };
  }

  function renderTranslatePopoverModule({ x, y, sourceText, translatedText, detected, targetLang, sourceLang = "auto", title }) {
    const root = ensureTranslatePopoverRoot();
    const palette = menuThemePalette();
    root.style.border = palette.border;
    root.style.background = palette.background;
    root.style.boxShadow = palette.shadow;
    const sourceLabel = String(detected || "auto").trim() || "auto";
    const targetLabel = String(targetLang || "").trim() || "en";
    const languageOptionsMarkup = TRANSLATE_LANGUAGE_OPTIONS.map((option) =>
      `<option value="${escapeHtml(option.value)}"${option.value === sourceLang ? " selected" : ""}>${escapeHtml(option.label)}</option>`
    ).join("");
    const targetOptionsMarkup = TRANSLATE_LANGUAGE_OPTIONS
      .filter((option) => option.value !== "auto")
      .map((option) =>
        `<option value="${escapeHtml(option.value)}"${option.value === targetLang ? " selected" : ""}>${escapeHtml(option.label)}</option>`
      ).join("");
    root.innerHTML = `
      <div style="display:grid;gap:12px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div style="display:grid;gap:4px;">
            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.72;">${escapeHtml(menuCopy("Quick Translation", "即刻翻译"))}</div>
            ${title ? `<div style="font-size:15px;font-weight:700;line-height:1.35;">${escapeHtml(title)}</div>` : ""}
          </div>
          <button type="button" data-translate-close style="border:0;background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer;opacity:.72;">×</button>
        </div>
        <div style="display:grid;gap:8px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <label style="display:grid;gap:4px;font-size:11px;opacity:.78;">
              <span>${escapeHtml(menuCopy("Source", "源语言"))}</span>
              <select data-translate-source style="border:0;border-radius:12px;padding:8px 10px;background:rgba(255,255,255,0.08);color:inherit;">${languageOptionsMarkup}</select>
            </label>
            <label style="display:grid;gap:4px;font-size:11px;opacity:.78;">
              <span>${escapeHtml(menuCopy("Target", "目标语言"))}</span>
              <select data-translate-target style="border:0;border-radius:12px;padding:8px 10px;background:rgba(255,255,255,0.08);color:inherit;">${targetOptionsMarkup}</select>
            </label>
          </div>
          <div style="font-size:12px;letter-spacing:.08em;opacity:.7;">${escapeHtml(sourceLabel)} → ${escapeHtml(targetLabel)}</div>
          <div style="padding:12px 14px;border-radius:16px;background:rgba(255,255,255,0.05);font-size:13px;line-height:1.55;max-height:180px;overflow:auto;opacity:.8;">${escapeHtml(sourceText)}</div>
          <div style="padding:14px 16px;border-radius:18px;border:1px solid rgba(0,245,160,.16);background:rgba(255,255,255,0.08);font-size:18px;font-weight:600;line-height:1.5;max-height:220px;overflow:auto;">${escapeHtml(translatedText || menuCopy("No translation returned yet.", "暂时还没有返回翻译。"))}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" data-translate-copy style="border:0;border-radius:14px;padding:10px 14px;cursor:pointer;background:rgba(255,255,255,0.1);color:inherit;">${escapeHtml(menuCopy("Copy Translation", "复制翻译"))}</button>
          <button type="button" data-translate-open-full style="border:0;border-radius:14px;padding:10px 14px;cursor:pointer;background:rgba(255,255,255,0.06);color:inherit;">${escapeHtml(menuCopy("Open Full Translator", "打开完整翻译页"))}</button>
        </div>
      </div>
    `;
    root.hidden = false;
    requestAnimationFrame(() => {
      const rect = root.getBoundingClientRect();
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      const left = Math.max(12, Math.min(x + 12, vw - rect.width - 12));
      const top = Math.max(12, Math.min(y + 12, vh - rect.height - 12));
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
    });
    root.querySelector("[data-translate-close]")?.addEventListener("click", () => hideTranslatePopoverModule());
    root.querySelector("[data-translate-copy]")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard?.writeText?.(translatedText || "");
        global.showToast?.(menuCopy("Translation copied", "翻译已复制"));
      } catch (_err) {
        global.showToast?.(menuCopy("Copy failed", "复制失败"));
      }
    });
    root.querySelector("[data-translate-open-full]")?.addEventListener("click", () => {
      const url = `https://translate.google.com/?sl=${encodeURIComponent(sourceLang || "auto")}&tl=${encodeURIComponent(targetLang)}&text=${encodeURIComponent(sourceText)}&op=translate`;
      global.open?.(url, "_blank", "noopener");
    });
    const sourceSelect = root.querySelector("[data-translate-source]");
    const targetSelect = root.querySelector("[data-translate-target]");
    const retrigger = async () => {
      const nextSource = String(sourceSelect?.value || "auto").trim() || "auto";
      const nextTarget = String(targetSelect?.value || "en").trim() || "en";
      // CSSMV_TRANSLATE_TARGET_STICKY 20260420 — persist the user's Target
      // choice so the next popover opens to the same language.
      saveTranslateTargetModule(nextTarget);
      renderTranslatePopoverModule({
        x, y, sourceText,
        translatedText: menuCopy("Translating...", "正在翻译..."),
        detected: menuCopy("Auto", "自动"),
        targetLang: nextTarget,
        sourceLang: nextSource,
        title,
      });
      try {
        const result = await requestLightweightTranslationModule(sourceText, nextTarget, nextSource);
        renderTranslatePopoverModule({
          x, y, sourceText,
          translatedText: result?.translated || "",
          detected: result?.detected || menuCopy("Auto", "自动"),
          targetLang: nextTarget,
          sourceLang: nextSource,
          title,
        });
      } catch (_err) {
        renderTranslatePopoverModule({
          x, y, sourceText,
          translatedText: menuCopy("Lightweight translation is unavailable right now. You can still open the full translator.", "轻量翻译暂时不可用，你仍可以打开完整翻译页。"),
          detected: menuCopy("Auto", "自动"),
          targetLang: nextTarget,
          sourceLang: nextSource,
          title,
        });
      }
    };
    sourceSelect?.addEventListener("change", retrigger);
    targetSelect?.addEventListener("change", retrigger);
  }

  async function openContextTranslation(target) {
    const text = extractContextText(target);
    if (!text) return false;
    // CSSMV_TRANSLATE_TARGET_STICKY 20260420 — Jing: Target language
    // persists across sessions; fall back to the UI primary language when
    // the user has never set one.
    const targetLang = resolveInitialTranslateTargetModule();
    const sourceLang = "auto";
    const anchor = lastContextAnchor || { x: window.innerWidth * 0.5, y: window.innerHeight * 0.25 };
    renderTranslatePopoverModule({
      x: anchor.x,
      y: anchor.y,
      sourceText: text,
      translatedText: menuCopy("Translating...", "正在翻译..."),
      detected: menuCopy("Auto", "自动"),
      targetLang,
      sourceLang,
      title: extractContextBlockTitle(target),
    });
    try {
      const result = await requestLightweightTranslationModule(text, targetLang, sourceLang);
      renderTranslatePopoverModule({
        x: anchor.x,
        y: anchor.y,
        sourceText: text,
        translatedText: result?.translated || "",
        detected: result?.detected || menuCopy("Auto", "自动"),
        targetLang,
        sourceLang,
        title: extractContextBlockTitle(target),
      });
      return true;
    } catch (_err) {
      const url = `https://translate.google.com/?sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&text=${encodeURIComponent(text)}&op=translate`;
      renderTranslatePopoverModule({
        x: anchor.x,
        y: anchor.y,
        sourceText: text,
        translatedText: menuCopy("Lightweight translation is unavailable right now. You can still open the full translator.", "轻量翻译暂时不可用，你仍可以打开完整翻译页。"),
        detected: menuCopy("Auto", "自动"),
        targetLang,
        sourceLang,
        title: extractContextBlockTitle(target),
      });
      translatePopoverEl?.querySelector?.("[data-translate-open-full]")?.addEventListener("click", () => {
        global.open?.(url, "_blank", "noopener");
      });
      return true;
    }
  }

  function refreshPanel(target) {
    const panel = closestPanel(target);
    if (!panel) {
      window.location.reload();
      return;
    }
    const handlers = {
      "notifications-panel": () => global.renderNotificationsPanelModule?.(),
      "subscription-panel": () => global.renderSubscriptionPanelModule?.(),
      "credit-panel": () => global.renderCreditPanelModule?.(),
      "workspaces-panel": () => global.renderWorkspacesPanelModule?.(),
      "user-admin-panel": () => global.renderUserAdminPanelModule?.(),
      "watch-panel": () => global.syncWatchPanelModule?.()
    };
    const handler = handlers[panel.id];
    if (handler) {
      handler();
      return;
    }
    if (typeof global.refreshPanelModule === "function") {
      global.refreshPanelModule(panel);
      return;
    }
    global.openPanel?.(panel);
  }

  function buildTextActionItems(target) {
    const text = extractContextText(target);
    const editable = findEditableTarget(target);
    const items = [];
    if (text) {
      items.push({
        icon: "⧉",
        label: menuCopy("Copy", "复制"),
        run: () => {
          void copyContextText(target);
        },
      });
    }
    // Paste sits directly under Copy whenever the user can meaningfully
    // paste somewhere — either because the right-click target is editable
    // or the currently-focused element is. This matches the user's ask:
    // 复制菜单下添加粘贴菜单.
    if (editable) {
      items.push({
        icon: "⎘",
        label: menuCopy("Paste", "粘贴"),
        run: () => {
          void pasteContextText(target);
        },
      });
    }
    if (text) {
      items.push({
        icon: "🌐",
        label: menuCopy("Translate", "翻译"),
        run: () => openContextTranslation(target),
      });
    }
    items.push({
      icon: "↻",
      label: menuCopy("Refresh", "刷新"),
      run: () => refreshPanel(target),
    });
    return items;
  }

  function buildDockItems(target) {
    const dockItem = closestDockItem(target);
    const action = String(dockItem?.getAttribute?.("data-action") || "").trim().toLowerCase();
    if (!action) return [];
    if (!canAccessAction(action)) {
      return isSignedIn() ? [] : [buildSignInItem()];
    }
    const panel = resolvePanelForAction(action);
    const open = isPanelOpen(panel);
    const name = panelDisplayName(panel, action);
    return [
      {
        icon: open ? "—" : "◌",
        label: open
          ? menuCopy(`Close ${name}`, `关闭${name}`)
          : menuCopy(`Open ${name}`, `打开${name}`),
        run: () => togglePanelFromContext(action, panel)
      },
      {
        icon: "⚙",
        label: menuCopy("Open Panel Settings", "打开面板设置"),
        run: () => panel && openPanelSettingsFor(panel)
      },
      {
        icon: "⌘",
        label: menuCopy("Set Shortcut / Voice Command", "设置快捷键/语音命令"),
        run: () => panel && openPanelSettingsFor(panel)
      }
    ];
  }

  function buildPanelItems(target) {
    const panel = closestPanel(target);
    if (!(panel instanceof HTMLElement)) return [];
    const action = resolveActionForPanel(panel);
    if (!canAccessAction(action)) return isSignedIn() ? [] : [buildSignInItem()];
    const name = panelDisplayName(panel, action);
    return [
      {
        icon: "—",
        label: menuCopy(`Close ${name}`, `关闭${name}`),
        run: () => global.minimizeToDock?.(panel)
      },
      {
        icon: "⚙",
        label: menuCopy("Open Panel Settings", "打开面板设置"),
        run: () => openPanelSettingsFor(panel)
      }
    ];
  }

  function buildWorkCardItems(target) {
    const card = target?.closest?.(".work-card");
    if (!(card instanceof HTMLElement)) return [];
    if (!isSignedIn()) return [buildSignInItem()];
    return [
      {
        icon: "▶",
        label: menuCopy("Enjoy", "欣赏"),
        run: () => card.querySelector("button, .mini-btn, .cta")?.click?.()
      },
      {
        icon: "🗂",
        label: menuCopy("Open Works Tree", "打开作品树"),
        run: () => global.openWorksPanelModule?.() || global.openPanel?.(global.worksPanel)
      },
      {
        icon: "🎬",
        label: menuCopy("Open Watch", "打开欣赏面板"),
        run: () => global.openWatchPreviewFlowModule?.({
          preferredTab: "mv",
          tryRegistry: true,
          showEmptyToast: true,
          allowDemoFallback: true
        })
      }
    ];
  }

  function renderMenuItems(items, x, y) {
    const root = ensureMenuRoot();
    const palette = menuThemePalette();
    root.style.border = palette.border;
    root.style.background = palette.background;
    root.style.boxShadow = palette.shadow;
    const safeItems = items
      .filter((item) => item && typeof item.run === "function")
      .filter((item) => {
        if (!isSignedIn()) return true;
        const label = String(item?.label || "").toLowerCase();
        return !(label.includes("login") || label.includes("登录"));
      });
    if (!safeItems.length) return false;
    root.innerHTML = safeItems
      .map(
        (item) => `
          <button type="button" class="cssos-context-menu-item">
            <span class="cssos-context-menu-item-icon" aria-hidden="true">${item.icon || "◌"}</span>
            <span class="cssos-context-menu-item-label">${item.label}</span>
          </button>
        `
      )
      .join("");
    root.querySelectorAll(".cssos-context-menu-item").forEach((button, index) => {
      Object.assign(button.style, {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        border: "0",
        borderRadius: "12px",
        padding: "10px 12px",
        margin: "2px 0",
        background: "transparent",
        color: palette.text,
        textAlign: "left",
        fontSize: "14px",
        cursor: "pointer"
      });
      const icon = button.querySelector(".cssos-context-menu-item-icon");
      if (icon instanceof HTMLElement) {
        Object.assign(icon.style, {
          width: "18px",
          minWidth: "18px",
          textAlign: "center",
          opacity: "0.92",
          fontSize: "14px"
        });
      }
      const label = button.querySelector(".cssos-context-menu-item-label");
      if (label instanceof HTMLElement) {
        Object.assign(label.style, {
          flex: "1 1 auto",
          minWidth: "0"
        });
      }
      button.addEventListener("mouseenter", () => {
        button.style.background = palette.hover;
      });
      button.addEventListener("mouseleave", () => {
        button.style.background = "transparent";
      });
      button.addEventListener("click", () => {
        hideContextMenuModule();
        safeItems[index]?.run?.();
      });
    });
    root.hidden = false;
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    root.style.left = "0px";
    root.style.top = "0px";
    requestAnimationFrame(() => {
      const rect = root.getBoundingClientRect();
      const left = Math.max(12, Math.min(x, vw - rect.width - 12));
      const top = Math.max(12, Math.min(y, vh - rect.height - 12));
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
    });
    return true;
  }

  function openContextMenuModule(anchor, x, y) {
    lastContextAnchor = { x, y, target: anchor };
    const items = [
      ...buildPanelItems(anchor),
      ...buildTextActionItems(anchor),
      ...buildImageItems(anchor),
      ...buildDockItems(anchor),
      ...buildWorkCardItems(anchor),
      ...buildCommonItems(anchor)
    ];
    return renderMenuItems(items, x, y);
  }

  function clearLongpressTimer() {
    if (!longpressTimer) return;
    window.clearTimeout(longpressTimer);
    longpressTimer = null;
  }

  function bindContextMenuRuntime() {
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const clickedInsideMenu = !!(target && menuEl instanceof HTMLElement && menuEl.contains(target));
      const clickedInsideTranslate = !!(
        target &&
        translatePopoverEl instanceof HTMLElement &&
        translatePopoverEl.contains(target)
      );
      if (!clickedInsideMenu) hideContextMenuModule();
      if (!clickedInsideTranslate) hideTranslatePopoverModule();
    }, true);
    document.addEventListener("scroll", () => {
      hideContextMenuModule();
      hideTranslatePopoverModule();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideContextMenuModule();
        hideTranslatePopoverModule();
      }
    });
    document.addEventListener("contextmenu", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      event.preventDefault();
      openContextMenuModule(target, event.clientX, event.clientY);
    });
    document.addEventListener(
      "touchstart",
      (event) => {
        const touch = event.touches?.[0];
        const target = event.target instanceof Element ? event.target : null;
        if (!touch || !target) return;
        touchAnchor = { target, x: touch.clientX, y: touch.clientY };
        clearLongpressTimer();
        longpressTimer = window.setTimeout(() => {
          if (!touchAnchor) return;
          openContextMenuModule(touchAnchor.target, touchAnchor.x, touchAnchor.y);
          touchAnchor = null;
        }, LONGPRESS_MS);
      },
      { passive: true }
    );
    document.addEventListener(
      "touchmove",
      () => {
        clearLongpressTimer();
        touchAnchor = null;
      },
      { passive: true }
    );
    document.addEventListener(
      "touchend",
      () => {
        clearLongpressTimer();
        touchAnchor = null;
      },
      { passive: true }
    );
    document.addEventListener(
      "touchcancel",
      () => {
        clearLongpressTimer();
        touchAnchor = null;
      },
      { passive: true }
    );
  }

  bindContextMenuRuntime();

  Object.assign(global, {
    hideContextMenuModule,
    openContextMenuModule
  });
})(globalThis);
