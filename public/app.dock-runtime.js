(function attachDockRuntime(global) {
  const dashboardCopy = (...args) => global.dashboardCopy(...args);
  const getDockClickTimers = () => {
    if (global.dockClickTimers instanceof Map) return global.dockClickTimers;
    global.dockClickTimers = new Map();
    return global.dockClickTimers;
  };
  const getLongpressMs = () => Number(global.LONGPRESS_MS || global.CSS_LONGPRESS_MS || 600);
  const getClickDelay = () => Number(global.CLICK_DELAY || 220);
  const getAuthUser = () => {
    try {
      if (typeof authState !== "undefined" && authState?.user) return authState.user;
    } catch (_err) {
      // ignore cross-script lookup failure
    }
    return global.authState?.user || null;
  };
  const ensureAuthenticatedDockAccess = (message, options = {}) => {
    if (options.allowGuest) return true;
    if (getAuthUser()) return true;
    const copy = String(
      message ||
        global.loginCopy(
          "Sign in first to use this action.",
          "请先登录后再使用这个动作。"
        )
    ).trim();
    if (typeof global.openLoginForCreation === "function") {
      global.openLoginForCreation(copy);
    } else {
      global.showToast?.(copy);
      global.openPanel?.(global.loginPanel);
    }
    return false;
  };
  const openPanelSettingsSafe = (panel) => {
    if (
      !ensureAuthenticatedDockAccess(
        global.loginCopy(
          "Sign in first to open panel settings.",
          "请先登录后再打开面板设置。"
        )
      )
    ) {
      return false;
    }
    if (typeof global.openPanelSettings === "function") return global.openPanelSettings(panel);
    if (!(panel instanceof HTMLElement)) return false;
    if (typeof global.openPanel === "function") global.openPanel(panel);
    if (typeof global.togglePanelSettings === "function") return global.togglePanelSettings(panel, true);
    return false;
  };

  function buildBuiltinDockActionMapBridge() {
    return {
      mic: {
        click: () => {
          if (!ensureAuthenticatedDockAccess()) return false;
          void global.invokeUniversalCreationEntry?.({
            origin: "dock",
            preferredTab: "music",
            submitVoiceFallback: true
          });
          return undefined;
        },
        dblclick: () => {
          if (
            !ensureAuthenticatedDockAccess(
              global.loginCopy(
                "Sign in first to open creation settings.",
                "请先登录后再打开创作设置。"
              )
            )
          ) {
            return false;
          }
          return global.openCreationAdvancedSettingsPanel();
        },
        longpress: () => {
          if (!ensureAuthenticatedDockAccess()) return false;
          void global.invokeUniversalCreationEntry?.({
            origin: "dock",
            preferredTab: "music",
            submitVoiceFallback: true
          });
        }
      },
      foryou: {
        click: () => global.openPanel(global.foryouPanel),
        dblclick: () => global.startCreation(),
        longpress: () => openPanelSettingsSafe(global.foryouPanel)
      },
      cssmv: {
        click: () => global.openPanel(global.cssmvPanel),
        dblclick: () => global.ensureWatchCentered(),
        longpress: () => openPanelSettingsSafe(global.cssmvPanel)
      },
      lyrics: {
        click: () => global.openPanel(global.lyricsPanel),
        dblclick: () => {
          global.updateEnginePanels(global.state.title, global.state.lines);
          global.showToast(global.loginCopy("Engines refreshed"));
        },
        longpress: () => openPanelSettingsSafe(global.lyricsPanel)
      },
      music: {
        click: () => global.openPanel(global.musicPanel),
        dblclick: () => {
          const listId = global.styleInput?.getAttribute?.("list");
          const listEl = listId ? document.getElementById(listId) : null;
          const values = Array.from(listEl?.querySelectorAll("option") || [])
            .map((option) => String(option.value || "").trim())
            .filter(Boolean);
          const current = String(global.styleInput?.value || "").trim();
          const index = values.findIndex((value) => value === current);
          const style = values.length ? (values[(index + 1 + values.length) % values.length] || values[0]) : current;
          if (global.styleInput && style) global.styleInput.value = style;
          global.updateEnginePanels(global.state.title, global.state.lines);
          if (style) global.showToast(`Style · ${style}`);
        },
        longpress: () => openPanelSettingsSafe(global.musicPanel)
      },
      video: {
        click: () => global.openPanel(global.videoPanel),
        dblclick: () => {
          global.updateEnginePanels(global.state.title, global.state.lines);
          global.showToast("Storyboard shuffled");
        },
        longpress: () => openPanelSettingsSafe(global.videoPanel)
      },
      watch: {
        // CSSOS_PHASE2_UNIVERSAL_ENTRY 20260418 — Jing's universal-entry spec:
        //   click (zero input)      → fire full 6-stage pipeline
        //   longpress (voice title) → extract voice, then fire pipeline
        //   dblclick (submit)       → open advanced settings → apply render
        // CSSOS_PHASE2_UNIFIED_ENTRY 20260426 #138 — added diagnostic logs
        // and routed click + longpress through cssmvUnifiedEntry so the
        // freshness short-circuit applies.
        click: () => {
          console.info("%c[entry:dock-watch] click", "color:#08f");
          if (typeof global.cssmvUnifiedEntry === "function") {
            void global.cssmvUnifiedEntry({
              source: "dock-watch-click",
              preferredTab: "mv"
            });
            global.ensureWatchCentered?.();
            return undefined;
          }
          return (
            global.invokeUniversalCreationEntry?.({
              origin: "dock-watch",
              preferredTab: "mv"
            }) || global.ensureWatchCentered?.()
          );
        },
        dblclick: () => {
          console.info("%c[entry:dock-watch] dblclick → advanced settings", "color:#08f");
          if (
            !ensureAuthenticatedDockAccess(
              global.loginCopy(
                "Sign in first to open creation settings.",
                "请先登录后再打开创作设置。"
              )
            )
          ) {
            return false;
          }
          return (
            global.openCreationAdvancedSettingsPanel?.() ||
            global.ensureWatchCentered?.()
          );
        },
        longpress: () => {
          console.info("%c[entry:logo-longpress] dock-watch hold → voice + MV", "color:#08f");
          if (!ensureAuthenticatedDockAccess()) return false;
          if (typeof global.cssmvUnifiedEntry === "function") {
            void global.cssmvUnifiedEntry({
              source: "logo-longpress",
              preferredTab: "mv"
            });
            return undefined;
          }
          void global.invokeUniversalCreationEntry?.({
            origin: "dock-watch",
            preferredTab: "mv",
            submitVoiceFallback: true
          });
          return undefined;
        }
      },
      notifications: {
        click: () => global.openNotificationsPanelModule?.() || global.openPanel(global.notificationsPanel),
        dblclick: () => {
          global.openNotificationsPanelModule?.() || global.openPanel(global.notificationsPanel);
          global.openAndMaximize(global.notificationsPanel);
        },
        longpress: () => openPanelSettingsSafe(global.notificationsPanel)
      },
      about: {
        click: () => global.openPanel(global.aboutPanel),
        dblclick: () => global.openAndMaximize(global.aboutPanel),
        longpress: () => openPanelSettingsSafe(global.aboutPanel)
      },
      api: {
        click: () => global.openPanel(global.apiPanel),
        dblclick: () => global.openAndMaximize(global.apiPanel),
        longpress: () => openPanelSettingsSafe(global.apiPanel)
      },
      reports: {
        click: () => global.openPanel(global.deliveryReportsPanel),
        dblclick: () => global.openAndMaximize(global.deliveryReportsPanel),
        longpress: () => openPanelSettingsSafe(global.deliveryReportsPanel)
      },
      "delivery-ops": {
        click: () => {
          global.openPanel(global.deliveryOpsPanel);
          void global.loadDeliveryOps();
        },
        dblclick: () => {
          global.openAndMaximize(global.deliveryOpsPanel);
          void global.loadDeliveryOps(true);
        },
        longpress: () => openPanelSettingsSafe(global.deliveryOpsPanel)
      },
      login: {
        click: () => global.openPanel(global.loginPanel),
        dblclick: () => global.openAndMaximize(global.loginPanel),
        longpress: () => openPanelSettingsSafe(global.loginPanel)
      },
      subscription: {
        click: () => global.openSubscriptionPanelModule?.() || global.openPanel(global.subscriptionPanel),
        dblclick: () => {
          global.openSubscriptionPanelModule?.() || global.openPanel(global.subscriptionPanel);
          global.openAndMaximize(global.subscriptionPanel);
        },
        longpress: () => openPanelSettingsSafe(global.subscriptionPanel)
      },
      "user-admin": {
        click: () => global.openUserAdminPanelModule?.() || global.openPanel(global.userAdminPanel),
        dblclick: () => {
          global.openUserAdminPanelModule?.() || global.openPanel(global.userAdminPanel);
          global.openAndMaximize(global.userAdminPanel);
        },
        longpress: () => openPanelSettingsSafe(global.userAdminPanel)
      },
      credit: {
        click: () => global.openCreditPanelModule?.() || global.openPanel(global.creditPanel),
        dblclick: () => {
          global.openCreditPanelModule?.() || global.openPanel(global.creditPanel);
          global.openAndMaximize(global.creditPanel);
        },
        longpress: () => openPanelSettingsSafe(global.creditPanel)
      },
      workspaces: {
        click: () => global.openWorkspacesPanelModule?.() || global.openPanel(global.workspacesPanel),
        dblclick: () => {
          global.openWorkspacesPanelModule?.() || global.openPanel(global.workspacesPanel);
          global.openAndMaximize(global.workspacesPanel);
        },
        longpress: () => openPanelSettingsSafe(global.workspacesPanel)
      },
      works: {
        click: () => global.openWorksPanelModule?.() || global.openPanel(global.worksPanel),
        dblclick: () => {
          global.openWorksPanelModule?.() || global.openPanel(global.worksPanel);
          global.openAndMaximize(global.worksPanel);
        },
        longpress: () => openPanelSettingsSafe(global.worksPanel)
      },
      seller: {
        click: () => {
          global.openPanel(global.sellerPanel);
          void global.loadWatchCommerce(true).then(() => global.renderSellerPanel());
        },
        dblclick: () => {
          global.openAndMaximize(global.sellerPanel);
          void global.loadWatchCommerce(true).then(() => global.renderSellerPanel());
        },
        longpress: () => openPanelSettingsSafe(global.sellerPanel)
      },
      settings: {
        click: () => {
          if (
            !ensureAuthenticatedDockAccess(
              global.loginCopy(
                "Sign in first to open advanced settings.",
                "请先登录后再打开高级设置。"
              )
            )
          ) {
            return false;
          }
          return global.openPanel(global.settingsPanel);
        },
        dblclick: () => {
          if (
            !ensureAuthenticatedDockAccess(
              global.loginCopy(
                "Sign in first to open dock settings.",
                "请先登录后再打开 Dock 设置。"
              )
            )
          ) {
            return false;
          }
          return global.toggleDockSettingsPopoverModule?.();
        },
        longpress: () => {
          if (
            !ensureAuthenticatedDockAccess(
              global.loginCopy(
                "Sign in first to open dock settings.",
                "请先登录后再打开 Dock 设置。"
              )
            )
          ) {
            return false;
          }
          return global.toggleDockSettingsPopoverModule?.();
        }
      },
      passkey: {
        click: () => {
          global.openPanel(global.profilePanel);
          void global.passkeyLogin();
        },
        dblclick: () => {
          global.openPanel(global.profilePanel);
          void global.passkeyEnable();
        },
        longpress: () => openPanelSettingsSafe(global.profilePanel)
      },
      profile: {
        click: () => global.openPanel(global.profilePanel),
        dblclick: () => global.openAndMaximize(global.profilePanel),
        longpress: () => global.openPanel(global.loginPanel)
      },
      language: {
        click: () => {
          global.openPanel(global.languagePanel);
          global.toggleLanguagePanelMode?.("content");
        },
        dblclick: () => {
          global.openPanel(global.languagePanel);
          global.toggleLanguagePanelMode?.();
        },
        longpress: () => openPanelSettingsSafe(global.languagePanel)
      }
    };
  }

  function getDockActionMapBridge() {
    const builtin = buildBuiltinDockActionMapBridge();
    const externalSource =
      global.__cssosDockActionMap && typeof global.__cssosDockActionMap === "object"
        ? global.__cssosDockActionMap
        : {};
    const external = Object.entries(externalSource).reduce((acc, [key, value]) => {
      if (!value || typeof value !== "object") return acc;
      if (
        typeof value.click !== "function" &&
        typeof value.dblclick !== "function" &&
        typeof value.longpress !== "function"
      ) {
        return acc;
      }
      acc[key] = value;
      return acc;
    }, {});
    const merged = { ...builtin, ...external };
    global.__cssosDockActionMap = merged;
    global.dockActionMap = merged;
    return merged;
  }

  function handleDockActionBridge(action, type) {
    const normalizedAction = String(action || "").trim().toLowerCase();
    const actionMap = getDockActionMapBridge();
    const mapping = actionMap[normalizedAction];
    const normalizedType =
      type === "dblclick" || type === "longpress" || type === "click" ? type : "click";
    const runBuiltinDockFallback = () => {
      switch (normalizedAction) {
        case "profile":
          global.openPanel(global.profilePanel);
          return true;
        case "settings":
          global.openPanel(global.settingsPanel);
          return true;
        case "language":
          global.openPanel(global.languagePanel);
          global.toggleLanguagePanelMode?.("content");
          return true;
        case "watch":
          // CSSOS_PHASE2_UNIFIED_ENTRY 20260426 #138 — Jing
          // Dock ▶ "watch" tap: if a fresh MV Pipeline result exists,
          // openWatchPreviewFlow's #137 guard auto-plays it; otherwise
          // route through cssmvUnifiedEntry which kicks off MV Pipeline.
          // No more bare ensureWatchCentered() that just moves the panel
          // and leaves users staring at empty media.
          if (typeof global.cssmvUnifiedEntry === "function") {
            console.info("%c[entry:dock-watch] click", "color:#08f");
            void global.cssmvUnifiedEntry({
              source: "dock-watch",
              preferredTab: "mv"
            });
            global.ensureWatchCentered?.();
            return true;
          }
          global.ensureWatchCentered();
          return true;
        case "works":
          global.openWorksPanelModule?.() || global.openPanel(global.worksPanel);
          return true;
        case "subscription":
          global.openSubscriptionPanelModule?.() || global.openPanel(global.subscriptionPanel);
          return true;
        case "credit":
          global.openCreditPanelModule?.() || global.openPanel(global.creditPanel);
          return true;
        case "workspaces":
          global.openWorkspacesPanelModule?.() || global.openPanel(global.workspacesPanel);
          return true;
        case "mic":
          // CSSOS_PHASE2_UNIFIED_ENTRY 20260426 #138 — Jing
          // Dock 🎤 mic tap: voice capture starts the MV Pipeline. Route
          // through cssmvUnifiedEntry so we get the [entry:dock-mic] log
          // and the fresh-result short-circuit. The legacy showCreationSurface
          // + cssos:mic event dispatch still fire so the voice modal opens.
          console.info("%c[entry:dock-mic] click", "color:#08f");
          global.showCreationSurface("logo");
          window.dispatchEvent(new CustomEvent("cssos:mic", { detail: { origin: "logo" } }));
          if (typeof global.cssmvUnifiedEntry === "function") {
            // Defer a tick so the voice surface can mount first; the
            // fresh-result short-circuit will handle re-taps cleanly.
            setTimeout(() => {
              try {
                void global.cssmvUnifiedEntry({
                  source: "dock-mic",
                  preferredTab: "mv"
                });
              } catch (_e) { /* non-fatal */ }
            }, 100);
          }
          return true;
        default:
          return false;
      }
    };
    if (!mapping) {
      const fallbackRan = runBuiltinDockFallback();
      if (fallbackRan !== false) {
        global.setDockDebugStatus("Dock action", `Builtin fallback: ${normalizedAction || "unknown"}`, "Dock action map was missing, but builtin fallback handled the action.");
        return;
      }
      global.setDockDebugStatus("Dock action", `No mapping: ${normalizedAction || "unknown"}`, "Dock action map did not contain the requested action.");
      return;
    }
    const handler = mapping[normalizedType] || mapping.click;
    if (!handler) {
      const fallbackRan = runBuiltinDockFallback();
      if (fallbackRan !== false) {
        global.setDockDebugStatus("Dock action", `Builtin fallback: ${normalizedAction || "unknown"}`, "Dock action handler was missing, but builtin fallback handled the action.");
        return;
      }
      global.setDockDebugStatus("Dock action", `No handler: ${normalizedAction}/${normalizedType}`, "Dock action exists, but the requested event type has no handler.");
      return;
    }
    global.setDockDebugStatus("Dock action", `Invoking ${normalizedAction}/${normalizedType}`, "Dock action handler is running.");
    try {
      handler();
      global.setDockDebugStatus("Dock action", `Invoked ${normalizedAction}/${normalizedType}`, "Handler ran without throwing.");
    } catch (error) {
      global.setDockDebugStatus("Dock action", `Error in ${normalizedAction}/${normalizedType}`, global.summarizeError(error));
      throw error;
    }
  }

  function handleGlobalActionBridge(action) {
    if (!action) return;
    if (action === "profile.open") {
      global.openPanel(global.profilePanel);
      return;
    }
    if (action === "profile.close") {
      global.minimizeToDock(global.profilePanel);
      return;
    }
    if (action === "passkey.enable") {
      global.openPanel(global.profilePanel);
      void global.passkeyEnable();
      return;
    }
    if (action === "passkey.login") {
      global.openPanel(global.profilePanel);
      void global.passkeyLogin();
      return;
    }
    if (action === "mic") {
      global.showCreationSurface("logo");
      window.dispatchEvent(new CustomEvent("cssos:mic", { detail: { origin: "logo" } }));
    }
  }

  function getDockItemsBridge() {
    if (!(global.dock instanceof Element)) return [];
    return Array.from(global.dock.querySelectorAll(".dock-item"));
  }

  function saveDockOrderBridge() {
    const actions = global.getDockItems()
      .map((item) => item.getAttribute("data-action") || "")
      .filter(Boolean);
    try {
      localStorage.setItem(global.DOCK_ORDER_KEY, JSON.stringify(actions));
    } catch (_error) {
      // ignore
    }
  }

  function restoreDockOrderBridge() {
    if (!(global.dock instanceof Element)) return;
    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(global.DOCK_ORDER_KEY) || "[]");
    } catch (_error) {
      stored = [];
    }
    const current = new Map(global.getDockItems().map((item) => [item.getAttribute("data-action") || "", item]));
    const normalizedStored = Array.isArray(stored)
      ? stored.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const orderedActions = normalizedStored.length
      ? [...new Set([...normalizedStored, ...((Array.isArray(global.DOCK_DEFAULT_ORDER) ? global.DOCK_DEFAULT_ORDER : [])), ...Array.from(current.keys())])]
      : [...new Set([...(Array.isArray(global.DOCK_DEFAULT_ORDER) ? global.DOCK_DEFAULT_ORDER : []), ...Array.from(current.keys())])];
    orderedActions.forEach((action) => {
      const item = current.get(action);
      if (item) global.dock.appendChild(item);
    });
    delete global.dock.dataset.orderPending;
    global.dock.style.visibility = "";
    if (!normalizedStored.length) global.saveDockOrder();
  }

  function attachDockReorderBridge() {
    if (!(global.dock instanceof Element)) return;
    if (global.dock.dataset.reorderBound === "true") return;
    global.dock.dataset.reorderBound = "true";
    let pointerDragState = null;
    const reorderModeActive = () => Number(global.__cssosDockReorderModeUntil || 0) > Date.now();
    const clearDragState = () => {
      if (pointerDragState?.item instanceof HTMLElement) {
        pointerDragState.item.classList.remove("is-dragging");
      }
      pointerDragState = null;
      global.dock.querySelectorAll(".dock-item.is-dragging").forEach((item) => {
        item.classList.remove("is-dragging");
      });
      document.body.classList.remove("dock-reordering");
    };
    const findInsertBefore = (clientX) => {
      const items = global
        .getDockItems()
        .filter((item) => item.classList.contains("is-hidden") === false && item.classList.contains("is-dragging") === false);
      let best = null;
      let bestOffset = Number.POSITIVE_INFINITY;
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const offset = clientX - (rect.left + rect.width / 2);
        if (offset <= 0 && Math.abs(offset) < bestOffset) {
          bestOffset = Math.abs(offset);
          best = item;
        }
      });
      return best;
    };
    const continuePointerDrag = (event) => {
      if (!pointerDragState || pointerDragState.pointerId !== event.pointerId) return;
      const item = pointerDragState.item;
      if (!(item instanceof HTMLElement)) return;
      const delta = Math.hypot(event.clientX - pointerDragState.startX, event.clientY - pointerDragState.startY);
      if (!pointerDragState.dragging && (!reorderModeActive() || delta < 4)) return;
      if (!pointerDragState.dragging) {
        pointerDragState.dragging = true;
        pointerDragState.didReorder = false;
        item.classList.add("is-dragging");
        document.body.classList.add("dock-reordering");
      }
      event.preventDefault();
      const before = findInsertBefore(event.clientX);
      if (before && before !== item) {
        global.dock.insertBefore(item, before);
        pointerDragState.didReorder = true;
      } else if (!before) {
        const last = global.dock.lastElementChild;
        if (last !== item) {
          global.dock.appendChild(item);
          pointerDragState.didReorder = true;
        }
      }
    };
    const finishPointerDrag = (event) => {
      if (!pointerDragState || pointerDragState.pointerId !== event.pointerId) return;
      const didDrag = pointerDragState.dragging === true;
      const didReorder = pointerDragState.didReorder === true;
      clearDragState();
      if (didDrag && didReorder) {
        global.saveDockOrder();
        global.__cssosDockDragSuppressUntil = Date.now() + 380;
        global.__cssosDockReorderModeUntil = Date.now() + 380;
      }
    };
    document.addEventListener("pointermove", continuePointerDrag, { passive: false });
    document.addEventListener("pointerup", finishPointerDrag);
    document.addEventListener("pointercancel", finishPointerDrag);
    global.getDockItems().forEach((item) => {
      item.draggable = false;
      item.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        pointerDragState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          item,
          dragging: false,
          didReorder: false
        };
      });
    });
  }

  function watchArchiveChecklistStateBridge(passed) {
    return passed ? dashboardCopy("ready", "就绪") : dashboardCopy("hold", "暂缓");
  }

  function getVoiceSeedModuleFnBridge(name) {
    const direct = global[`__cssos${name}`];
    if (typeof direct === "function") return direct;
    const legacy = global[name];
    if (typeof legacy === "function" && legacy !== global.bindHoldTargets && legacy !== global.renderMicCaptureStatus && legacy !== global.forceResetHoldRing && legacy !== global.setLongpressGuard && legacy !== global.buildMicDebugBoardMarkup) {
      return legacy;
    }
    return null;
  }

  function bindHoldTargetsBridge() {
    const fn = global.getVoiceSeedModuleFn("BindHoldTargets");
    if (fn) return fn();
  }

  function renderMicCaptureStatusBridge() {
    const fn = global.getVoiceSeedModuleFn("RenderMicCaptureStatus");
    if (fn) return fn();
  }

  function forceResetHoldRingBridge() {
    const fn = global.getVoiceSeedModuleFn("ForceResetHoldRing");
    if (fn) return fn();
  }

  function setLongpressGuardBridge(on) {
    const fn = global.getVoiceSeedModuleFn("SetLongpressGuard");
    if (fn) return fn(on);
    document.body.classList.toggle("longpress-guard", !!on);
  }

  function buildMicDebugBoardMarkupBridge(micSettings) {
    const fn = global.getVoiceSeedModuleFn("BuildMicDebugBoardMarkup");
    if (fn) return fn(micSettings);
    return "";
  }

  function ensureDockPreviewElBridge() {
    if (global.dockDockPreviewEl) return global.dockDockPreviewEl;
    global.dockDockPreviewEl = document.createElement("div");
    global.dockDockPreviewEl.className = "dock-dock-preview";
    document.body.appendChild(global.dockDockPreviewEl);
    return global.dockDockPreviewEl;
  }

  function hideDockPreviewBridge() {
    if (!global.dockDockPreviewEl) return;
    global.dockDockPreviewEl.classList.remove("is-visible");
    delete global.dockDockPreviewEl.dataset.position;
  }

  function dockPreviewRectBridge(position) {
    if (position === "left") return { left: 8, top: 24, width: 96, height: window.innerHeight - 48 };
    if (position === "right") return { left: window.innerWidth - 104, top: 24, width: 96, height: window.innerHeight - 48 };
    if (position === "top") return { left: Math.max(24, window.innerWidth / 2 - 320), top: 8, width: 640, height: 92 };
    return { left: Math.max(24, window.innerWidth / 2 - 320), top: window.innerHeight - 100, width: 640, height: 92 };
  }

  function resolveDockPositionFromPointerBridge(clientX, clientY) {
    const edge = 108;
    const distances = [
      { position: "left", value: clientX },
      { position: "right", value: window.innerWidth - clientX },
      { position: "top", value: clientY },
      { position: "bottom", value: window.innerHeight - clientY }
    ].sort((a, b) => a.value - b.value);
    const nearest = distances[0];
    return nearest && nearest.value <= edge ? nearest.position : "";
  }

  function updateDockDragFollowBridge(clientX, clientY) {
    if (!(global.dock instanceof HTMLElement)) return;
    global.dock.style.translate = "0 0";
  }

  function resetDockDragFollowBridge() {
    if (!(global.dock instanceof HTMLElement)) return;
    global.dock.style.translate = "0 0";
  }

  function showDockPreviewBridge(position) {
    const preview = global.ensureDockPreviewEl();
    const rect = global.dockPreviewRect(position);
    preview.style.left = `${rect.left}px`;
    preview.style.top = `${rect.top}px`;
    preview.style.width = `${rect.width}px`;
    preview.style.height = `${rect.height}px`;
    preview.dataset.position = position;
    preview.classList.add("is-visible");
  }

  function attachDockDockingBridge() {
    if (!(global.dock instanceof HTMLElement)) return;
  }

  function attachDockEventsBridge() {
    if (!(global.dock instanceof HTMLElement)) return;
    if (global.dock.dataset.eventsBound === "true") return;
    global.dock.dataset.eventsBound = "true";
    const dockHoldState = new WeakMap();
    const clearDockHold = (item, { keepLongpressFlag = false } = {}) => {
      if (!(item instanceof HTMLElement)) return;
      const state = dockHoldState.get(item);
      if (state?.timer) window.clearTimeout(state.timer);
      dockHoldState.delete(item);
      if (!keepLongpressFlag) delete item.dataset.longpressTriggered;
    };
    const getDockItemAction = (item) => String(item?.dataset?.action || "").trim().toLowerCase();
    document.addEventListener("pointerdown", (event) => {
      if (!global.dockSettingsPopover || global.dockSettingsPopover.hidden) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".dock-settings-popover")) return;
      if (target.closest('.dock-item[data-action="settings"]')) return;
      global.hideDockSettingsPopoverModule?.();
    });
    window.addEventListener("resize", () => {
      global.positionDockSettingsPopoverModule?.();
    });
    // P2-40: swipe-vs-click threshold (px). Pointer movement above this flags
    // the interaction as a swipe/drag and suppresses the subsequent click so
    // horizontal gestures (Tesla/phone) don't accidentally activate the item.
    const DOCK_SWIPE_THRESHOLD = 14;
    global.dock.addEventListener("pointerdown", (event) => {
      const item = event.target?.closest?.(".dock-item");
      if (!(item instanceof HTMLElement)) return;
      if (event.button !== undefined && event.button !== 0) return;
      clearDockHold(item);
      // Clear any stale swipe flag from a previous gesture.
      delete item.dataset.swipeSuppressed;
      const action = getDockItemAction(item);
      if (!action) return;
      const state = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        maxDx: 0,
        maxDy: 0,
        timer: window.setTimeout(() => {
          item.dataset.longpressTriggered = "true";
          global.__cssosDockReorderModeUntil = Date.now() + 5000;
          global.__cssosDockDragSuppressUntil = Date.now() + 5000;
          global.showToast?.(
            global.loginCopy(
              "Dock reorder mode · drag icons to sort",
              "Dock 排序模式 · 拖动图标即可重排"
            )
          );
        }, getLongpressMs())
      };
      dockHoldState.set(item, state);
    });
    global.dock.addEventListener("pointermove", (event) => {
      const item = event.target?.closest?.(".dock-item");
      if (!(item instanceof HTMLElement)) return;
      const state = dockHoldState.get(item);
      if (!state || state.pointerId !== event.pointerId) return;
      const dx = Math.abs(event.clientX - state.startX);
      const dy = Math.abs(event.clientY - state.startY);
      if (dx > state.maxDx) state.maxDx = dx;
      if (dy > state.maxDy) state.maxDy = dy;
      // If the user has moved beyond the swipe threshold, treat this as a
      // gesture/drag rather than a tap and flag the item so the click handler
      // below will reject the follow-up synthetic click.
      if (Math.hypot(dx, dy) >= DOCK_SWIPE_THRESHOLD) {
        item.dataset.swipeSuppressed = "true";
      }
      if (Math.hypot(dx, dy) < 10) return;
      clearDockHold(item);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
      global.dock.addEventListener(eventName, (event) => {
        const item = event.target?.closest?.(".dock-item");
        if (!(item instanceof HTMLElement)) return;
        const state = dockHoldState.get(item);
        if (!state || (event.pointerId !== undefined && state.pointerId !== event.pointerId)) return;
        // Second safety check: if total travel exceeded the threshold, keep
        // the swipe flag so the synthesized click is blocked. Always flag on
        // pointercancel which usually means the gesture was interpreted as a
        // scroll/drag by the OS.
        if (
          eventName === "pointercancel" ||
          Math.hypot(state.maxDx || 0, state.maxDy || 0) >= DOCK_SWIPE_THRESHOLD
        ) {
          item.dataset.swipeSuppressed = "true";
        }
        clearDockHold(item, { keepLongpressFlag: item.dataset.longpressTriggered === "true" });
      });
    });
    global.dock.addEventListener("click", (event) => {
      const item = event.target?.closest?.(".dock-item");
      if (!(item instanceof HTMLElement)) return;
      if (item.dataset.swipeSuppressed === "true") {
        delete item.dataset.swipeSuppressed;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (Number(global.__cssosDockDragSuppressUntil || 0) > Date.now()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (item.dataset.longpressTriggered === "true") {
        delete item.dataset.longpressTriggered;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (Number(global.__cssosDockReorderModeUntil || 0) > Date.now()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const action = getDockItemAction(item);
      if (!action) return;
      const timers = getDockClickTimers();
      const existing = timers.get(item);
      if (existing) window.clearTimeout(existing);
      const timer = window.setTimeout(() => {
        if (timers.get(item) === timer) timers.delete(item);
        global.handleDockAction(action, "click");
      }, getClickDelay());
      timers.set(item, timer);
    });
    global.dock.addEventListener("dblclick", (event) => {
      const item = event.target?.closest?.(".dock-item");
      if (!(item instanceof HTMLElement)) return;
      if (Number(global.__cssosDockReorderModeUntil || 0) > Date.now()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const action = getDockItemAction(item);
      if (!action) return;
      const timers = getDockClickTimers();
      const existing = timers.get(item);
      if (existing) {
        window.clearTimeout(existing);
        timers.delete(item);
      }
      delete item.dataset.longpressTriggered;
      global.handleDockAction(action, "dblclick");
    });
    global.dock.querySelectorAll(".dock-item").forEach((item) => {
      item.tabIndex = 0;
      item.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const action = String(item.dataset.action || "").trim().toLowerCase();
        if (!action) return;
        global.handleDockAction(action, "click");
      });
    });
  }

  function attachGlobalActionDispatcherBridge() {
    // P2-40: mirror the swipe-suppression from the dock-specific handler at
    // document level so the fallback dispatcher also ignores horizontal
    // gestures that the browser still resolves into a click event.
    const GLOBAL_DOCK_SWIPE_THRESHOLD = 14;
    const globalDockPointerState = new WeakMap();
    document.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const dockItem = target.closest(".dock-item");
        if (!(dockItem instanceof HTMLElement)) return;
        globalDockPointerState.set(dockItem, {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          maxDist: 0
        });
        delete dockItem.dataset.globalSwipeSuppressed;
      },
      true
    );
    document.addEventListener(
      "pointermove",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const dockItem = target.closest(".dock-item");
        if (!(dockItem instanceof HTMLElement)) return;
        const state = globalDockPointerState.get(dockItem);
        if (!state || state.pointerId !== event.pointerId) return;
        const dist = Math.hypot(
          event.clientX - state.startX,
          event.clientY - state.startY
        );
        if (dist > state.maxDist) state.maxDist = dist;
        if (dist >= GLOBAL_DOCK_SWIPE_THRESHOLD) {
          dockItem.dataset.globalSwipeSuppressed = "true";
        }
      },
      true
    );
    ["pointerup", "pointercancel"].forEach((name) => {
      document.addEventListener(
        name,
        (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const dockItem = target.closest(".dock-item");
          if (!(dockItem instanceof HTMLElement)) return;
          const state = globalDockPointerState.get(dockItem);
          if (state && state.maxDist >= GLOBAL_DOCK_SWIPE_THRESHOLD) {
            dockItem.dataset.globalSwipeSuppressed = "true";
          }
          if (name === "pointercancel") {
            dockItem.dataset.globalSwipeSuppressed = "true";
          }
          globalDockPointerState.delete(dockItem);
        },
        true
      );
    });
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const dockItem = target.closest(".dock-item");
      if (dockItem) {
        if (
          dockItem instanceof HTMLElement &&
          dockItem.dataset.globalSwipeSuppressed === "true"
        ) {
          delete dockItem.dataset.globalSwipeSuppressed;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (global.dock?.dataset?.eventsBound !== "true") {
          const action = String(dockItem.getAttribute("data-action") || "").trim().toLowerCase();
          if (action) global.handleDockAction(action, "click");
        }
        return;
      }
      const mirrorStage = target.closest("#logo-panel .mirror-stage");
      if (mirrorStage) {
        if (global.logoPanel?.dataset?.logoActionsBound !== "true") {
          global.showCreationSurface("logo");
          window.dispatchEvent(new CustomEvent("cssos:mic", { detail: { origin: "logo" } }));
        }
        return;
      }
      const actionEl = target.closest("[data-action]");
      if (!actionEl) return;
      if (actionEl.getAttribute("data-hold") === "mic") return;
      const action = actionEl.getAttribute("data-action");
      global.handleGlobalAction(action);
    });
    document.addEventListener("dblclick", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const dockItem = target.closest(".dock-item");
      if (dockItem && global.dock?.dataset?.eventsBound !== "true") {
        const action = String(dockItem.getAttribute("data-action") || "").trim().toLowerCase();
        if (action) global.handleDockAction(action, "dblclick");
        return;
      }
      const mirrorStage = target.closest("#logo-panel .mirror-stage");
      if (mirrorStage && global.logoPanel?.dataset?.logoActionsBound !== "true") {
        global.openCreationAdvancedSettingsPanel?.();
      }
    });
  }

  global.buildBuiltinDockActionMapBridge = buildBuiltinDockActionMapBridge;
  global.getDockActionMapBridge = getDockActionMapBridge;
  global.handleDockActionBridge = handleDockActionBridge;
  global.handleGlobalActionBridge = handleGlobalActionBridge;
  global.getDockItemsBridge = getDockItemsBridge;
  global.saveDockOrderBridge = saveDockOrderBridge;
  global.restoreDockOrderBridge = restoreDockOrderBridge;
  global.attachDockReorderBridge = attachDockReorderBridge;
  global.watchArchiveChecklistStateBridge = watchArchiveChecklistStateBridge;
  global.getVoiceSeedModuleFnBridge = getVoiceSeedModuleFnBridge;
  global.bindHoldTargetsBridge = bindHoldTargetsBridge;
  global.renderMicCaptureStatusBridge = renderMicCaptureStatusBridge;
  global.forceResetHoldRingBridge = forceResetHoldRingBridge;
  global.setLongpressGuardBridge = setLongpressGuardBridge;
  global.buildMicDebugBoardMarkupBridge = buildMicDebugBoardMarkupBridge;
  global.ensureDockPreviewElBridge = ensureDockPreviewElBridge;
  global.hideDockPreviewBridge = hideDockPreviewBridge;
  global.dockPreviewRectBridge = dockPreviewRectBridge;
  global.resolveDockPositionFromPointerBridge = resolveDockPositionFromPointerBridge;
  global.updateDockDragFollowBridge = updateDockDragFollowBridge;
  global.resetDockDragFollowBridge = resetDockDragFollowBridge;
  global.showDockPreviewBridge = showDockPreviewBridge;
  global.attachDockDockingBridge = attachDockDockingBridge;
  global.attachDockEventsBridge = attachDockEventsBridge;
  global.attachGlobalActionDispatcherBridge = attachGlobalActionDispatcherBridge;
})(globalThis);
