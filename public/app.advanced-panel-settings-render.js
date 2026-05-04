async function renderAdvancedPanelSettingsBridge(options = {}) {
  if (!advancedPanelSettings) return;
  if (advancedPanelSettings.hidden && !options.force) {
    advancedPanelSettings.dataset.needsRender = "true";
    return;
  }
  const deferHeavy = !!options.deferHeavy;
  if (authState.user && !deferHeavy) {
    await loadCreatorBoostState().catch(() => null);
  }
  const local = readPanelBehaviorSettingsLocal();
  const remote = deferHeavy ? local : await loadPanelDefaults("behavior", local);
  const merged = sanitizePanelBehaviorSettings(
    remote && typeof remote === "object"
      ? (globalThis.mergePanelBehaviorSettings?.(local, remote) || remote)
      : local
  );
  if (!deferHeavy) {
    applyPanelBehaviorSettings(merged);
  }
  const wasHidden = advancedPanelSettings.hidden;
  const markup = buildAdvancedPanelSettingsMarkup(merged);
  advancedPanelSettings.innerHTML = deferHeavy
    ? stripAdvancedHeavyMarkup(markup, getUserRole() === "admin")
    : markup;
  advancedPanelSettings.hidden = wasHidden;
  advancedPanelSettings.dataset.needsRender = "false";
  advancedPanelSettings.querySelectorAll("[data-scroll-peek]").forEach((scroller) => {
    scroller.addEventListener("scroll", () => callCreationFlowModule("syncScrollPeekModule", scroller), {
      passive: true
    });
    callCreationFlowModule("syncScrollPeekModule", scroller);
  });
  advancedPanelSettings.querySelectorAll("[data-advanced-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetKey = String(button.getAttribute("data-advanced-nav") || "").trim();
      if (!targetKey) return;
      const targetCard = advancedPanelSettings.querySelector(
        `[data-advanced-panel="${CSS.escape(targetKey)}"]`
      );
      if (!(targetCard instanceof HTMLElement)) return;
      targetCard.scrollIntoView({ block: "start", behavior: "smooth" });
      advancedPanelSettings
        .querySelectorAll("[data-advanced-nav]")
        .forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });
  advancedPanelSettings.querySelector("[data-advanced-nav]")?.classList.add("is-active");
  advancedPanelSettings.querySelectorAll("[data-advanced-apply-render]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      // CSSOS_PHASE2_UNIFIED_ENTRY 20260426 #138 — Jing
      // Apply & Render is one of the "万能入口". Route through the unified
      // helper so we get the diagnostic log + fresh-result short-circuit.
      // Also DROP the duplicate legacy `startCreation` call — that was
      // running the old creative-engine pipeline IN PARALLEL with MV
      // Pipeline, causing the user's "走一遍旧流程" complaint.
      // CSSOS_PHASE2_APPLY_RENDER_SAFETY_NET 20260504 — mark this click
      // so the document-level delegate doesn't fire a second time.
      try { event.currentTarget.dataset.__applyRenderHandled = "1"; } catch (_e) {}
      console.info(
        "%c[entry:apply-render] click — bound handler",
        "color:#08f;font-weight:bold"
      );
      // CSSOS_PHASE2_APPLY_RENDER_WATCH_DIRECT 20260429 #171 — Jing
      // "应用并渲染按钮，输入各项参数之后，点击应该显示 Watch MV 面板输出
      //  MV 给用户欣赏，可是现在点击没有动静" — pop Watch panel BEFORE the
      // pipeline kicks off, so the user sees the canvas even while engines
      // run. Bypasses showCreationSurfaceModule which used to pull
      // Creation panel to front and bury Watch.
      // CSSOS_PHASE2_APPLY_RENDER_MAXIMIZE 20260429 #175 — Jing
      // "我点了应用并渲染，还是没有启动MV面板"
      // Even with openPanel + bringPanelToFrontBridge, the Watch panel
      // came up unmaximized and got hidden behind whatever the user had
      // open on top. Use openAndMaximize so the Watch panel takes the
      // full viewport center stage, not a tiny corner card.
      // CSSOS_PHASE2_OPEN_THEN_MAXIMIZE_IDEMPOTENT 20260429 #176 — Jing
      // openAndMaximize() unconditionally TOGGLES — if Watch was already
      // maximized from a previous run, calling it again un-maximizes.
      // Use state-aware logic: open the panel, then ONLY maximize if not
      // already maximized (idempotent).
      try {
        const watchPanelEl = globalThis.watchPanel || document.getElementById("watch-panel");
        if (watchPanelEl) {
          if (typeof globalThis.openPanel === "function") {
            globalThis.openPanel(watchPanelEl);
          }
          // Only toggle to maximize if currently NOT maximized.
          if (
            watchPanelEl.dataset.maximized !== "true" &&
            typeof globalThis.togglePanelMaximizeModule === "function"
          ) {
            globalThis.togglePanelMaximizeModule(watchPanelEl);
          }
          if (typeof globalThis.activateWatchTab === "function") {
            const resolveTab = globalThis.resolvePreferredWatchOpenTab || ((t) => t);
            globalThis.activateWatchTab(resolveTab("mv") || "mv");
          }
          if (typeof globalThis.bringPanelToFrontBridge === "function") {
            globalThis.bringPanelToFrontBridge(watchPanelEl, { repeatPasses: 5 });
          }
        }
      } catch (_e) { /* non-fatal */ }
      const title = String(titleInput?.value || "").trim();
      // CSSOS_PHASE2_HARVEST_ALL_LYRIC_TEXTAREAS 20260429 #171 — Jing
      // "我手动输入的中文歌词，不唱，却从哪里随机拉一个英文垃圾歌词来唱"
      // The original code only read `lyricsInput` (= #lyrics-input) which
      // is a Creation-panel field most users never touch. When user typed
      // into Advanced Settings #custom-lyrics or MV Pipeline #mvp-lyrics,
      // seed.lyrics ended up empty → runAll's lyrics LLM kicked → English
      // garbage was sent to ElevenLabs. Read the LONGEST non-empty value
      // from EVERY known lyric textarea so user input always wins.
      let harvestedLyrics = "";
      const _candidates = [
        document.getElementById("custom-lyrics"),
        document.getElementById("mvp-lyrics"),
        document.getElementById("creation-lyrics-input"),
        document.getElementById("watch-lyrics-editor"),
        document.getElementById("song-seed-lyrics"),
        document.getElementById("lyrics-input"),
        document.querySelector("textarea[data-creation-field='lyrics']"),
      ];
      _candidates.forEach((el) => {
        if (!(el instanceof HTMLTextAreaElement)) return;
        const v = String(el.value || "").trim();
        if (v.length > harvestedLyrics.length) harvestedLyrics = v;
      });
      const _csLyrics = String(globalThis.creationState?.lyrics || "").trim();
      if (_csLyrics.length > harvestedLyrics.length) harvestedLyrics = _csLyrics;
      const lyrics = harvestedLyrics;
      const style = String(
        globalThis.state?.songSeed?.musicStyle ||
        globalThis.creationState?.musicStyle ||
        ""
      ).trim();
      const seed = {
        prompt: title || undefined,
        lyrics: lyrics || undefined,
        style: style || undefined
      };
      if (typeof globalThis.cssmvUnifiedEntry === "function") {
        try {
          await globalThis.cssmvUnifiedEntry({
            source: "apply-render",
            seed: seed,
            preferredTab: "mv",
            // Apply&Render is an EXPLICIT user action — NEVER reuse a stale
            // cached MV (force=true bypasses #137 freshness short-circuit).
            // Open MV Pipeline panel visibly so user sees stage progress.
            force: true,
            focus: true,
            hidden: false
          });
          return; // ← critical: DO NOT also fire legacy startCreation
        } catch (uErr) {
          console.warn("[advanced-apply-render] unified entry failed:", uErr);
        }
      }
      // Fallback path: only if cssmvUnifiedEntry is missing entirely.
      if (typeof globalThis.openMvPipelinePanel === "function") {
        try {
          globalThis.openMvPipelinePanel({
            autoStart: true,
            seed: seed,
            focus: false,
            hidden: true
          });
          return;
        } catch (mvErr) {
          console.warn("[advanced-apply-render] openMvPipelinePanel failed", mvErr);
        }
      }
      if (typeof startCreation === "function") {
        await startCreation(title, lyrics, { source: "settings" });
      }
    });
  });
  let autoSaveTimer = 0;
  const persistAdvancedSettings = (next, trigger) => {
    const applied = applyPanelBehaviorSettings(next);
    callWatchUiModule("refreshWatchPresentationFromSettingsModule", state.songSeed);
    if (String(trigger?.getAttribute?.("data-advanced-setting") || "").startsWith("mic-")) {
      void renderAdvancedPanelSettingsBridge();
    }
    if (autoSaveTimer) {
      window.clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = window.setTimeout(async () => {
      autoSaveTimer = 0;
      if (getUserRole() !== "admin") return;
      await savePanelDefaults("behavior", applied, trigger || null);
    }, 280);
  };
  advancedPanelSettings.querySelectorAll("input, select").forEach((control) => {
    if (control instanceof HTMLInputElement && control.type === "file") return;
    control.addEventListener("input", () => {
      const next = collectAdvancedPanelSettingsFromDom();
      persistAdvancedSettings(next, control);
    });
    control.addEventListener("change", () => {
      const next = collectAdvancedPanelSettingsFromDom();
      persistAdvancedSettings(next, control);
    });
  });
  advancedPanelSettings.querySelectorAll("[data-creator-boost-checkout]").forEach((button) => {
    button.addEventListener("click", async () => {
      const boostKind = String(button.getAttribute("data-creator-boost-checkout") || "")
        .trim()
        .toLowerCase();
      const quantity = Math.max(1, Number(button.getAttribute("data-creator-boost-quantity") || 1) || 1);
      try {
        await createCreatorBoostCheckout(boostKind, quantity, button);
      } catch (_err) {
        safeShowToast(
          loginCopy(
            "Creator Boost checkout could not be started right now."
          )
        );
      }
    });
  });
  // CSSOS_PHASE2_PAYMENTS 20260419 — NihaoPay alternative for every Creator
  // Boost product in the Advanced Settings panel. Same payments module used
  // by the Subscription panel — we pass kind="purchase" and the note encodes
  // boost kind + quantity so the backend settles the correct bucket after
  // the IPN verifies the signature.
  advancedPanelSettings.querySelectorAll("[data-creator-boost-nihaopay-vendor]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.cssPaymentsCheckout || typeof window.cssPaymentsCheckout.startCheckout !== "function") {
        safeShowToast(loginCopy("Payment gateway not ready. Please refresh and try again."));
        return;
      }
      const boostKind = String(button.getAttribute("data-creator-boost-nihaopay-kind") || "").trim().toLowerCase();
      const vendor = String(button.getAttribute("data-creator-boost-nihaopay-vendor") || "alipay").trim().toLowerCase();
      const quantity = Math.max(1, Number(button.getAttribute("data-creator-boost-nihaopay-quantity") || 1) || 1);
      const amountCents = Math.max(0, Math.round(Number(button.getAttribute("data-creator-boost-nihaopay-price") || 0)));
      if (!boostKind || !amountCents) return;
      safeShowToast(loginCopy("Redirecting to the payment page..."));
      try {
        await window.cssPaymentsCheckout.startCheckout({
          kind: "purchase",
          vendor,
          amount_cents: amountCents,
          trigger: button,
          note: `boost:${boostKind}:${quantity}`
        });
      } catch (_err) {
        safeShowToast(loginCopy("Creator Boost checkout could not be started right now."));
      }
    });
  });
  advancedPanelSettings.querySelectorAll("[data-track-language]").forEach((button) => {
    button.addEventListener("click", async () => {
      const lang = String(button.getAttribute("data-track-language") || "").trim().toLowerCase();
      if (!lang) return;
      const selected = new Set(globalThis.getSelectedCreationLanguages?.() || []);
      const nextSelected = new Set(selected);
      if (nextSelected.has(lang)) {
        nextSelected.delete(lang);
      } else {
        nextSelected.add(lang);
      }
      const primary = globalThis.getPrimaryCreationLanguage?.() || "zh";
      nextSelected.delete(primary);
      creationState.extraLyricLanguages = Array.from(nextSelected);
      const capability = enforceCreationCapability({
        skipLoginPrompt: true,
        allowCinemaBookingPrompt: false
      });
      if (!capability.ok && capability.reason === "creator_boost_language") {
        creationState.extraLyricLanguages = Array.from(selected).filter((code) => code !== primary);
        const pricing = readPanelBehaviorSettingsLocal()?.creator_boost || {};
        const cents = Math.max(1, Math.round(Number(pricing.language_unit_cents || 300)));
        const picker = window.cssPaymentsCheckout && typeof window.cssPaymentsCheckout.openPicker === "function"
          ? window.cssPaymentsCheckout.openPicker
          : null;
        if (picker) {
          picker({
            title: loginCopy(`Buy 1 extra language (${lang.toUpperCase()})`),
            amountCents: cents,
            stripe: {
              label: loginCopy("Pay with card"),
              onSelect: async () => {
                try {
                  await createCreatorBoostCheckout("language", 1, button);
                } catch (_err) {
                  safeShowToast(loginCopy("Creator Boost checkout could not be started right now."));
                }
              }
            },
            nihaopay: {
              onSelect: (vendor) => {
                window.cssPaymentsCheckout.startCheckout({
                  kind: "purchase",
                  vendor,
                  amount_cents: cents,
                  trigger: button,
                  note: "boost:language:1"
                });
              }
            }
          });
        } else {
          const confirmed = window.confirm(
            loginCopy(
              `Adding ${lang.toUpperCase()} creates a separately billed subtitle lyric track. Price: ${formatUsdFromCents(cents || 0, "$0.00")} for 1 extra language. Continue to checkout now?`
            )
          );
          if (confirmed) {
            try {
              await createCreatorBoostCheckout("language", 1, button);
            } catch (_err) {
              safeShowToast(loginCopy("Creator Boost checkout could not be started right now."));
            }
          }
        }
        void renderAdvancedPanelSettingsBridge({ force: true });
        return;
      }
      renderCreationConsole();
      void renderAdvancedPanelSettingsBridge({ force: true });
    });
  });
  advancedPanelSettings.querySelectorAll("[data-track-voice]").forEach((button) => {
    button.addEventListener("click", async () => {
      const voice = String(button.getAttribute("data-track-voice") || "").trim().toLowerCase();
      if (!voice) return;
      const selected = new Set(Array.isArray(creationState.extraVoiceTracks) ? creationState.extraVoiceTracks : []);
      if (selected.has(voice)) {
        selected.delete(voice);
      } else {
        selected.add(voice);
      }
      creationState.extraVoiceTracks = Array.from(selected);
      const capability = enforceCreationCapability({
        skipLoginPrompt: true,
        allowCinemaBookingPrompt: false
      });
      if (!capability.ok && capability.reason === "creator_boost_voice") {
        if (selected.has(voice)) {
          selected.delete(voice);
        }
        creationState.extraVoiceTracks = Array.from(selected);
        const pricing = readPanelBehaviorSettingsLocal()?.creator_boost || {};
        const cents = Math.max(1, Math.round(Number(pricing.voice_unit_cents || 500)));
        const picker = window.cssPaymentsCheckout && typeof window.cssPaymentsCheckout.openPicker === "function"
          ? window.cssPaymentsCheckout.openPicker
          : null;
        if (picker) {
          picker({
            title: loginCopy("Buy 1 extra voice lane"),
            amountCents: cents,
            stripe: {
              label: loginCopy("Pay with card"),
              onSelect: async () => {
                try {
                  await createCreatorBoostCheckout("voice", 1, button);
                } catch (_err) {
                  safeShowToast(loginCopy("Creator Boost checkout could not be started right now."));
                }
              }
            },
            nihaopay: {
              onSelect: (vendor) => {
                window.cssPaymentsCheckout.startCheckout({
                  kind: "purchase",
                  vendor,
                  amount_cents: cents,
                  trigger: button,
                  note: "boost:voice:1"
                });
              }
            }
          });
        } else {
          const confirmed = window.confirm(
            loginCopy(
              `Adding this voice lane creates a separately billed delivery lane. Price: ${formatUsdFromCents(cents || 0, "$0.00")} for 1 extra voice lane. Continue to checkout now?`
            )
          );
          if (confirmed) {
            try {
              await createCreatorBoostCheckout("voice", 1, button);
            } catch (_err) {
              safeShowToast(loginCopy("Creator Boost checkout could not be started right now."));
            }
          }
        }
        void renderAdvancedPanelSettingsBridge({ force: true });
        return;
      }
      renderCreationConsole();
      void renderAdvancedPanelSettingsBridge({ force: true });
    });
  });
  advancedPanelSettings.querySelector("[data-admin-membership-assign]")?.addEventListener("click", (event) => {
    void applyAdminMembershipAssignment(event.currentTarget);
  });
  advancedPanelSettings.querySelector("[data-admin-entitlement-grant]")?.addEventListener("click", (event) => {
    void grantAdminEntitlement(event.currentTarget);
  });
  advancedPanelSettings.querySelectorAll("[data-permission-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      permissionOverviewFilter =
        String(button.getAttribute("data-permission-filter") || "all").trim().toLowerCase() ||
        "all";
      void renderAdvancedPanelSettingsBridge();
    });
  });
  advancedPanelSettings.querySelectorAll("[data-permission-requirement-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      permissionOverviewRequirementFilter =
        String(button.getAttribute("data-permission-requirement-filter") || "all")
          .trim()
          .toLowerCase() || "all";
      void renderAdvancedPanelSettingsBridge();
    });
  });
  advancedPanelSettings.querySelectorAll("[data-permission-domain-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      permissionOverviewDomainFilter =
        String(button.getAttribute("data-permission-domain-filter") || "all").trim().toLowerCase() ||
        "all";
      void renderAdvancedPanelSettingsBridge();
    });
  });
  advancedPanelSettings.querySelector("[data-permission-filter-reset]")?.addEventListener("click", () => {
    permissionOverviewFilter = "all";
    permissionOverviewRequirementFilter = "all";
    permissionOverviewDomainFilter = "all";
    void renderAdvancedPanelSettingsBridge();
  });
  const advancedLogoImage1 = advancedPanelSettings.querySelector('[data-advanced-setting="logo-image-1"]');
  const advancedLogoImage2 = advancedPanelSettings.querySelector('[data-advanced-setting="logo-image-2"]');
  const advancedLogoVideo = advancedPanelSettings.querySelector('[data-advanced-setting="logo-video"]');
  if (advancedLogoImage1 instanceof HTMLInputElement) {
    advancedLogoImage1.addEventListener("change", async () => {
      const file = advancedLogoImage1.files?.[0];
      if (!file) return;
      const uploadedUrl =
        authState.user && getUserRole() === "admin"
          ? await uploadLogoMediaFile(file, "image_1", advancedLogoImage1)
          : "";
      if (!uploadedUrl) return;
      const next = updatePanelBehaviorSettings((current) => ({
        ...current,
        logo: { ...current.logo, media: { ...current.logo.media, image_1: uploadedUrl } }
      }));
      await savePanelDefaults("behavior", next, advancedLogoImage1);
      void renderAdvancedPanelSettingsBridge();
    });
  }
  if (advancedLogoImage2 instanceof HTMLInputElement) {
    advancedLogoImage2.addEventListener("change", async () => {
      const file = advancedLogoImage2.files?.[0];
      if (!file) return;
      const uploadedUrl =
        authState.user && getUserRole() === "admin"
          ? await uploadLogoMediaFile(file, "image_2", advancedLogoImage2)
          : "";
      if (!uploadedUrl) return;
      const next = updatePanelBehaviorSettings((current) => ({
        ...current,
        logo: { ...current.logo, media: { ...current.logo.media, image_2: uploadedUrl } }
      }));
      await savePanelDefaults("behavior", next, advancedLogoImage2);
      void renderAdvancedPanelSettingsBridge();
    });
  }
  if (advancedLogoVideo instanceof HTMLInputElement) {
    advancedLogoVideo.addEventListener("change", async () => {
      const file = advancedLogoVideo.files?.[0];
      if (!file) return;
      const uploadedUrl =
        authState.user && getUserRole() === "admin"
          ? await uploadLogoMediaFile(file, "video", advancedLogoVideo)
          : "";
      if (!uploadedUrl) return;
      const next = updatePanelBehaviorSettings((current) => ({
        ...current,
        logo: { ...current.logo, media: { ...current.logo.media, video: uploadedUrl } }
      }));
      await savePanelDefaults("behavior", next, advancedLogoVideo);
      void renderAdvancedPanelSettingsBridge();
    });
  }
  advancedPanelSettings.querySelectorAll("[data-advanced-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const next = collectAdvancedPanelSettingsFromDom();
      const saved = await savePanelDefaults("behavior", next, button);
      if (saved) {
        applyPanelBehaviorSettings(saved);
        showToast(loginCopy("Panel defaults saved."));
      }
    });
  });
  advancedPanelSettings.querySelector("[data-advanced-dock-reset]")?.addEventListener("click", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, dock_position: "bottom" }
    }));
    dock?.classList.add("is-snapping");
    setTimeout(() => dock?.classList.remove("is-snapping"), 520);
  });
  advancedPanelSettings.querySelectorAll("[data-advanced-open-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const panelId = String(button.getAttribute("data-advanced-open-panel") || "").trim();
      const panel = panelId ? document.getElementById(panelId) : null;
      if (!panel) return;
      openPanel(panel);
      if (!panel.classList.contains("show-settings")) {
        togglePanelSettings(panel);
      } else {
        focusPanel(panel);
      }
      globalThis.bringPanelToFrontBridge?.(panel, { repeatPasses: 3 });
    });
  });
  // CSSOS_PHASE2_MV_ENGINES_SELECTOR 20260418 —
  // Hydrate the data-mv-engines-panel anchor with per-stage engine + version
  // dropdowns driven by /api/mv/engines. Design rules:
  //   一切参数化:  stages and engines come from the server catalog, never hardcoded
  //   一切i18n:    labels go through cssmvEngines.resolveStageI18nLabel() which
  //                prefers host t(key) and falls back to catalog i18n map
  //   一切可扩展:  selection changes dispatch cssmv:engine-selection-changed
  //                so other UI (mv-pipeline-panel badges, work summary) refreshes
  // CSSOS_PHASE2_P2_41_I18N_CLEANUP 20260418 —
  // Strip inline loginCopy(en, zh) pairs from the third-party engines panel.
  // Every user-facing string now flows through the real i18n runtime (t()),
  // with keys defined in public/i18n/dict.js under "mv.engines.*" and
  // "mv.stage.*". Locales without an explicit translation fall back to EN via
  // the t()/DEFAULT_LOCALE chain — not through a zh/en literal branch here.
  const mvT = (key, fallback) => {
    if (typeof globalThis.t === "function") {
      const translated = globalThis.t(key);
      if (translated && translated !== key) return translated;
    }
    return fallback;
  };
  advancedPanelSettings.querySelectorAll("[data-mv-engines-panel]").forEach((anchor) => {
    if (!(anchor instanceof HTMLElement)) return;
    const enginesApi = globalThis.cssmvEngines;
    if (!enginesApi || typeof enginesApi.fetchCatalog !== "function") {
      anchor.dataset.mvEnginesState = "unavailable";
      const placeholder = anchor.querySelector("[data-mv-engines-placeholder]");
      if (placeholder) {
        placeholder.textContent = mvT(
          "mv.engines.catalog_unavailable",
          "Engine catalog module is not loaded."
        );
      }
      return;
    }
    const renderStageOption = (entry, selected) => {
      const engine = String(entry?.engine || "");
      const version = String(entry?.version || "");
      const value = `${engine}::${version}`;
      const label = enginesApi.formatEngineOptionLabel(entry) || value;
      const isSelected =
        selected &&
        selected.engine === engine &&
        selected.version === version;
      return `<option value="${escapeHtml(value)}" ${isSelected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    };
    const hydrate = (catalog) => {
      if (!catalog || !Array.isArray(catalog.stages) || catalog.stages.length === 0) {
        anchor.dataset.mvEnginesState = "empty";
        const placeholder = anchor.querySelector("[data-mv-engines-placeholder]");
        if (placeholder) {
          placeholder.textContent = mvT(
            "mv.engines.empty_registry",
            "No engines are registered on the server yet."
          );
        }
        return;
      }
      const rows = catalog.stages
        .map((stage) => {
          const stageKey = String(stage?.stage || "").toLowerCase();
          if (!stageKey) return "";
          const stageLabel = enginesApi.resolveStageI18nLabel(stage) || stageKey;
          const selected = enginesApi.getSelection(stageKey);
          const engines = Array.isArray(stage.engines) ? stage.engines : [];
          if (engines.length === 0) {
            return `
              <label class="mv-engine-row" data-mv-engine-stage="${escapeHtml(stageKey)}" data-mv-engine-empty="true">
                <span>${escapeHtml(stageLabel)}</span>
                <select data-mv-engine-select disabled>
                  <option value="">${escapeHtml(mvT("mv.engines.none_available", "No engines available"))}</option>
                </select>
              </label>
            `;
          }
          const options = engines.map((entry) => renderStageOption(entry, selected)).join("");
          return `
            <label class="mv-engine-row" data-mv-engine-stage="${escapeHtml(stageKey)}">
              <span>${escapeHtml(stageLabel)}</span>
              <select data-mv-engine-select>${options}</select>
              <small class="mv-engine-badge" data-mv-engine-badge>${escapeHtml(
                enginesApi.formatEngineBadgeForStage(stageKey) || ""
              )}</small>
            </label>
          `;
        })
        .join("");
      anchor.innerHTML = `
        <div class="mv-engines-grid">${rows}</div>
        <div class="advanced-panel-note" data-mv-engines-footnote>${escapeHtml(
          mvT(
            "mv.engines.footnote",
            "Selections are stored locally per browser (cssmv.engine-selections.v1). Price badges come from the server catalog."
          )
        )}</div>
      `;
      anchor.dataset.mvEnginesState = "ready";
      anchor.querySelectorAll("[data-mv-engine-stage]").forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        const stageKey = String(row.getAttribute("data-mv-engine-stage") || "").toLowerCase();
        if (!stageKey) return;
        const select = row.querySelector("[data-mv-engine-select]");
        if (!(select instanceof HTMLSelectElement)) return;
        select.addEventListener("change", () => {
          const raw = String(select.value || "");
          const [engine, version] = raw.split("::");
          if (engine && version) {
            enginesApi.setSelection(stageKey, engine, version);
          } else {
            enginesApi.setSelection(stageKey, null, null);
          }
          const badge = row.querySelector("[data-mv-engine-badge]");
          if (badge) {
            badge.textContent = enginesApi.formatEngineBadgeForStage(stageKey) || "";
          }
          try {
            document.dispatchEvent(
              new CustomEvent("cssmv:engine-selection-changed", {
                detail: { stage: stageKey, engine: engine || null, version: version || null }
              })
            );
          } catch (_err) {
            /* ignore */
          }
          // Also mirror into the panel-behavior settings so admin savePanelDefaults
          // round-trips the per-stage selection when the admin clicks save.
          try {
            if (typeof collectAdvancedPanelSettingsFromDom === "function") {
              const next = collectAdvancedPanelSettingsFromDom();
              applyPanelBehaviorSettings(next);
            }
          } catch (_err) {
            /* ignore */
          }
        });
      });
    };
    // Paint immediately from whatever we already have cached, then refresh on
    // fetch completion. This keeps the panel feeling instant even on first open.
    const cached = enginesApi.getCatalog();
    if (cached && Array.isArray(cached.stages) && cached.stages.length > 0) {
      hydrate(cached);
    }
    Promise.resolve(enginesApi.fetchCatalog(false))
      .then((catalog) => hydrate(catalog))
      .catch(() => {
        anchor.dataset.mvEnginesState = "error";
        const placeholder = anchor.querySelector("[data-mv-engines-placeholder]");
        if (placeholder) {
          placeholder.textContent = mvT(
            "mv.engines.catalog_load_failed",
            "Could not load engine catalog."
          );
        }
      });
  });
  if (deferHeavy) {
    if (advancedPanelSettingsHeavyFrame) {
      cancelAnimationFrame(advancedPanelSettingsHeavyFrame);
    }
    advancedPanelSettingsHeavyFrame = requestAnimationFrame(() => {
      advancedPanelSettingsHeavyFrame = 0;
      void renderAdvancedPanelSettingsBridge({ force: true });
    });
  }
}

Object.assign(globalThis, {
  renderAdvancedPanelSettingsBridge
});

// CSSOS_PHASE2_APPLY_RENDER_SAFETY_NET 20260504 — Jing
// Global delegation safety-net for the Apply & Render button. The bound
// handler above runs once at panel-render time; if the panel is later
// re-rendered or the button gets re-created via innerHTML (which DOES
// happen in advanced-panel-settings-render's render path), the original
// listener is lost. A document-level capture-phase delegate guarantees
// that ANY click on a [data-advanced-apply-render] element routes
// through cssmvUnifiedEntry — even if the bound handler is gone.
//
// Also serves as a diagnostic: the log "[entry:apply-render] click —
// delegated safety net" makes it obvious in DevTools whether the bound
// handler ran first (logs "bound handler") or the safety net caught it.
(function installApplyRenderSafetyNet() {
  if (globalThis.__cssosApplyRenderSafetyNetInstalled) return;
  globalThis.__cssosApplyRenderSafetyNetInstalled = true;
  document.addEventListener("click", function (e) {
    const btn = e.target && e.target.closest && e.target.closest("[data-advanced-apply-render]");
    if (!btn) return;
    // If the bound handler fired in the same tick, it sets a flag we
    // can read. Otherwise this delegate kicks the unified entry.
    if (btn.dataset.__applyRenderHandled === "1") {
      btn.dataset.__applyRenderHandled = "";
      return;
    }
    console.info(
      "%c[entry:apply-render] click — delegated safety net",
      "color:#08f;font-weight:bold"
    );
    const title = String(document.getElementById("title-input")?.value || "").trim();
    const lyrics = String(document.getElementById("lyrics-input")?.value || "").trim();
    const seed = {
      prompt: title || undefined,
      lyrics: lyrics || undefined
    };
    if (typeof globalThis.cssmvUnifiedEntry === "function") {
      void globalThis.cssmvUnifiedEntry({
        source: "apply-render-safety-net",
        seed,
        preferredTab: "mv",
        force: true,
        focus: true,
        hidden: false
      });
    } else if (typeof globalThis.invokeUniversalCreationEntry === "function") {
      void globalThis.invokeUniversalCreationEntry({
        origin: "apply-render",
        preferredTab: "mv"
      });
    }
  }, true);
})();
