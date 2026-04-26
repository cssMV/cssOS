function safeTModule(key, localeOverride) {
  const locale = localeOverride || currentLocale || DEFAULT_LOCALE;
  const table = (I18N && I18N[locale]) || {};
  const fallback = (I18N && I18N[DEFAULT_LOCALE]) || {};
  const template = table[key] || fallback[key];
  if (!template) return `TODO_i18n(${key})`;
  return interpolate(template, {});
}

function applyI18nModule() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    const text = t(key, { spell: state.spell });
    if (text) {
      el.textContent = text;
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (!key) return;
    const text = t(key);
    if (text) {
      el.setAttribute("placeholder", text);
    }
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.dataset.i18nAria;
    if (!key) return;
    const text = t(key);
    if (text) {
      el.setAttribute("aria-label", text);
    }
  });

  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.dataset.i18nHtml;
    if (!key) return;
    const text = t(key, { spell: state.spell });
    if (text) {
      el.innerHTML = text;
    }
  });

  document.querySelectorAll(".dock-item").forEach((item) => {
    const labelEl = item.querySelector(".dock-label, .label, .dock-text");
    const label = labelEl ? labelEl.textContent.trim() : "";
    if (label) item.setAttribute("data-label", label);
    if (!item.hasAttribute("tabindex")) item.tabIndex = 0;
  });

  globalThis.renderAboutSubSectionModule?.();
}

function loginCopyModule(en, zh) {
  return currentLocale === "zh" ? zh : en;
}

function flattenHierarchyWorksModule(items) {
  const list = Array.isArray(items) ? items : [];
  const flat = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    flat.push(node);
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach(walk);
  };
  list.forEach(walk);
  return flat;
}

function sortHierarchyNodesModule(nodes) {
  return [...(Array.isArray(nodes) ? nodes : [])].sort((a, b) => {
    const seqDelta = Number(a?.sequence_index || 0) - Number(b?.sequence_index || 0);
    if (seqDelta !== 0) return seqDelta;
    const timeDelta = workCreatedTimestamp(b) - workCreatedTimestamp(a);
    if (timeDelta !== 0) return timeDelta;
    return String(a?.title || "").localeCompare(String(b?.title || ""));
  });
}

function buildWorkHierarchyModule(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const nodesById = new Map();
  list.forEach((item) => {
    const id = String(item?.work_id || item?.id || item?.local_id || "").trim();
    if (!id) return;
    const existing = nodesById.get(id) || {};
    nodesById.set(id, {
      ...existing,
      ...item,
      children: [...(Array.isArray(existing.children) ? existing.children : []), ...(Array.isArray(item?.children) ? item.children : [])]
    });
  });
  nodesById.forEach((node) => {
    node.children = buildWorkHierarchyModule(node.children || []);
  });
  const roots = [];
  nodesById.forEach((node) => {
    const parentId = String(node?.parent_work_id || "").trim();
    if (!parentId || !nodesById.has(parentId)) {
      roots.push(node);
      return;
    }
    const parent = nodesById.get(parentId);
    parent.children = Array.isArray(parent.children) ? parent.children : [];
    const nodeId = String(node?.work_id || node?.id || node?.local_id || "").trim();
    if (!parent.children.some((child) => String(child?.work_id || child?.id || child?.local_id || "").trim() === nodeId)) {
      parent.children.push(node);
    }
  });
  const walk = (nodes) =>
    sortHierarchyNodesModule(nodes).map((node) => ({
      ...node,
      children: walk(node.children || [])
    }));
  return walk(roots);
}

function filterDisplayWorkRootsModule(nodes) {
  const roots = Array.isArray(nodes) ? nodes : [];
  const allIds = new Set(
    flattenHierarchyWorksModule(roots)
      .map((node) => String(node?.work_id || node?.id || node?.local_id || "").trim())
      .filter(Boolean)
  );
  return roots.filter((node) => {
    const nodeId = String(node?.work_id || node?.id || node?.local_id || "").trim();
    const rootId = String(node?.root_work_id || "").trim();
    const parentId = String(node?.parent_work_id || "").trim();
    if (parentId) return false;
    if (rootId && rootId !== nodeId && allIds.has(rootId)) return false;
    return true;
  });
}

function renderHierarchyTreeModule(nodes, context = "market") {
  const items = Array.isArray(nodes) ? nodes : [];
  if (!items.length) return "";
  return `
    <div class="work-hierarchy">
      ${items
        .map((node, index) => {
          const title = escapeHtml(String(node?.title || "").trim() || loginCopy("Untitled"));
          const role = escapeHtml(workStructureRoleLabel(node?.structure_role, node?.work_type));
          const nodeRole = String(node?.structure_role || "").trim().toLowerCase();
          const summary = escapeHtml(
            context === "works" && ["opera", "triptych", "act"].includes(nodeRole)
              ? ""
              : String(node?.style || node?.lyrics_preview || "").trim()
          );
          const createdAt = formatDateTime(node?.created_at);
          const children = renderHierarchyTreeModule(node?.children || [], context);
          const workId = escapeHtml(String(node?.id || "").trim());
          const isOwnedByViewer =
            Boolean(authState.user?.id) && String(node?.owner_user_id || "").trim() === String(authState.user?.id || "").trim();
          const canTransact = !!authState.user && !isOwnedByViewer;
          const listenCents = Number(node?.current_listen_price_cents || 0);
          const buyoutCents = Number(node?.current_buyout_price_cents || 0);
          const buyoutEnabled = Boolean(node?.buyout_enabled) && buyoutCents > 0;
          const tipsEnabled = canReceiveTips(node);
          const orderState = resolveViewerOrderState(node?.viewer_orders);
          const listenDisabled = Boolean(
            isOwnedByViewer || orderState.paidBuyout || orderState.paidListen || orderState.pendingListen || orderState.pendingBuyout
          );
          const buyoutDisabled = Boolean(isOwnedByViewer || orderState.paidBuyout || orderState.pendingBuyout);
          const tipDisabled = Boolean(!tipsEnabled || orderState.pendingTip);
          const wholeBuyoutChild = ["act", "scene", "part"].includes(nodeRole);
          const wholeBuyoutRoot =
            !wholeBuyoutChild &&
            (normalizeWorkTypeClient(node?.work_type) === "opera" || normalizeWorkTypeClient(node?.work_type) === "triptych");
          const actions =
            context === "market" && workId
              ? `
                <div class="work-hierarchy-actions">
                  <button class="mini-btn ghost tiny" type="button" data-market-action="preview" data-market-child-id="${workId}">${loginCopy("Preview")}</button>
                  ${canTransact ? `<button class="mini-btn ghost tiny" type="button" data-market-action="listen" data-market-child-id="${workId}" ${(listenCents > 0 && !listenDisabled) ? "" : "disabled"}>${marketActionCopy("listen", orderState)}</button>` : ""}
                  ${canTransact && !wholeBuyoutChild ? `<button class="mini-btn market-buyout-btn tiny" type="button" data-market-action="buyout" data-market-child-id="${workId}" ${(!buyoutEnabled || buyoutDisabled) ? "disabled" : ""}>${wholeBuyoutRoot ? loginCopy("Whole buyout") : marketActionCopy("buyout", orderState)}</button>` : ""}
                  ${canTransact ? `<span class="market-inline-action"><button class="mini-btn ghost tiny" type="button" data-market-action="tip" data-market-child-id="${workId}" ${tipDisabled ? "disabled" : ""}>${marketActionCopy("tip", orderState)}</button><input class="inline-chip-input market-tip-input" type="number" min="1" step="1" inputmode="decimal" placeholder="${escapeHtml(loginCopy("Tip $"))}" data-market-tip-input="${workId}" hidden /></span>` : ""}
                </div>
              `
              : context === "works" && workId
                ? `
                <div class="work-hierarchy-actions">
                  <button class="mini-btn ghost tiny" type="button" data-work-action="watch" data-work-child-id="${workId}" ${hasPanelPermission("works.watch") ? "" : "disabled"}>${loginCopy("Enjoy")}</button>
                </div>
              `
                : "";
          return `
            <details class="work-hierarchy-item" data-work-child-id="${workId}" ${index === 0 ? "open" : ""}>
              <summary data-foryou-summary data-node-key="${escapeHtml(String(node?.foryou_key || ""))}" data-structure-role="${escapeHtml(String(node?.structure_role || ""))}" data-has-children="${Array.isArray(node?.children) && node.children.length ? "1" : "0"}" data-work-child-id="${workId}">
                <span class="work-hierarchy-role">${role}</span>
                <span class="work-hierarchy-title">${title}</span>
                ${createdAt ? `<span class="work-hierarchy-time">${escapeHtml(createdAt)}</span>` : ""}
              </summary>
              ${summary ? `<div class="work-hierarchy-summary">${summary}</div>` : ""}
              ${actions}
              ${children}
            </details>
          `;
        })
        .join("")}
    </div>
  `;
}

function workTypePricingDefaultsModule(workType) {
  return globalThis.workTypePricingDefaultsModule?.(workType) || { listenCents: 99, buyoutCents: 299 };
}

function buildCurrentCreationDefaultsPayloadModuleBridge() {
  return globalThis.buildCurrentCreationDefaultsPayloadModule?.() || null;
}

function applyCreationDefaultsModuleBridge(template) {
  return globalThis.applyCreationDefaultsModule?.(template);
}

async function loadCreationPanelDefaultsModule(force = false) {
  return globalThis.loadCreationPanelDefaultsModule?.(force) || panelDefaultsState.creation;
}

async function saveCreationPanelDefaultsModule(trigger) {
  return globalThis.saveCreationPanelDefaultsModule?.(trigger);
}

function creationSummaryTextModule() {
  const s = creationState.selections;
  const styleSummary = String(styleInput?.value || "").trim();
  // CSSOS_PHASE2_GET_MEMBERSHIP_PRESET_GUARD 20260426 #136 — load-order safe.
  const _gmp = (typeof globalThis.getMembershipPreset === "function")
    ? globalThis.getMembershipPreset
    : (typeof getMembershipPreset === "function" ? getMembershipPreset : null);
  const preset = _gmp ? _gmp() : { tier: "guest", monthlyGenerationLimit: 0, maxDurationSec: 60, maxResolution: "720p", watermark: "default", queuePriority: "standard" };
  const membershipSummary = [
    `${loginCopy("Tier")}: ${describeMembershipTier(preset.tier)}`,
    preset.monthlyGenerationLimit === null
      ? loginCopy("Monthly Limit: Unlimited")
      : loginCopy(`Monthly Limit: ${preset.monthlyGenerationLimit}`),
    `${loginCopy("Max Video")}: ${preset.maxDurationSec}s / ${preset.maxResolution}`,
    `${loginCopy("Watermark")}: ${
      preset.watermark === "none"
        ? loginCopy("Off")
        : preset.watermark === "custom_or_none"
          ? loginCopy("Custom or off")
          : loginCopy("Default")
    }`
  ];
  const parts = [
    ...membershipSummary,
    styleSummary && `${t("settings.musicStyle")}: ${styleSummary}`,
    s.genre && `${creationTabLabel("genre")}: ${creationChipLabel("genre", s.genre)}`,
    s.mood && `${creationTabLabel("mood")}: ${creationChipLabel("mood", s.mood)}`,
    s.instrument && `${creationTabLabel("instrument")}: ${creationChipLabel("instrument", s.instrument)}`,
    s.ambience && `${creationTabLabel("ambience")}: ${creationChipLabel("ambience", s.ambience)}`,
    s.vocalGender && `${creationTabLabel("vocalGender")}: ${creationChipLabel("vocalGender", s.vocalGender)}`,
    creationState.instrumentation && `${loginCopy("Instrumentation")}: ${creationState.instrumentation}`,
    creationState.vocalStyle && `${loginCopy("Vocal Style")}: ${creationState.vocalStyle}`,
    creationState.ensembleStyle && `${loginCopy("Ensemble")}: ${creationState.ensembleStyle}`,
    creationState.licensedStylePack && `${loginCopy("Licensed Pack")}: ${creationState.licensedStylePack}`,
    creationState.externalAudioAdapter && `${loginCopy("Audio Adapter")}: ${creationState.externalAudioAdapter}`,
    creationState.voicingRegister && `${loginCopy("Register")}: ${creationState.voicingRegister}`,
    creationState.expressionCcBias && `${loginCopy("Expression")}: ${creationState.expressionCcBias}`,
    `${loginCopy("Percussion")}: ${Math.round(Number(creationState.percussionActivity || 0) * 100)}%`,
    `${loginCopy("Humanization")}: ${Math.round(Number(creationState.humanization || 0) * 100)}%`,
    `${loginCopy("Work Type")}: ${workTypeLabel(creationState.workType)}`,
    `${t("settings.tempoBpm")}: ${creationState.tempo} BPM`,
    `${t("settings.key")}: ${creationState.key}`,
    resolveCreationDurationValue() ? `${t("settings.durationSec")}: ${resolveCreationDurationValue()}s` : "",
    `${t("settings.language")}: ${getSelectedCreationLanguages().join(" / ")}`,
    `${loginCopy("Voice Tracks")}: ${getSelectedCreationVoiceTracks().join(" / ")}`
  ].filter(Boolean);
  return parts.join(" | ");
}

function readPanelDefaultStoreModule() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PANEL_SETTINGS_DEFAULTS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePanelDefaultStoreModule(store) {
  try {
    localStorage.setItem(PANEL_SETTINGS_DEFAULTS_KEY, JSON.stringify(store || {}));
  } catch {
    // ignore
  }
}

function getStoredPanelDefaultSnapshotModule(panelId) {
  const store = readPanelDefaultStoreModule();
  const snapshot = store?.[panelId];
  return snapshot && typeof snapshot === "object" ? snapshot : null;
}

function savePanelDefaultSnapshotModule(panelId, snapshot) {
  const store = readPanelDefaultStoreModule();
  store[panelId] = snapshot;
  writePanelDefaultStoreModule(store);
}

function readPanelLayoutStoreModule() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PANEL_LAYOUT_STATE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePanelLayoutStoreModule(store) {
  try {
    localStorage.setItem(PANEL_LAYOUT_STATE_KEY, JSON.stringify(store || {}));
  } catch {
    // ignore
  }
}

function getStoredPanelLayoutModule(panelId) {
  const store = readPanelLayoutStoreModule();
  const snapshot = store?.[panelId];
  return snapshot && typeof snapshot === "object" ? snapshot : null;
}

function saveStoredPanelLayoutModule(panelId, snapshot) {
  if (!panelId || !snapshot || typeof snapshot !== "object") return;
  const store = readPanelLayoutStoreModule();
  store[panelId] = snapshot;
  writePanelLayoutStoreModule(store);
}

function clearStoredPanelLayoutModule(panelId) {
  if (!panelId) return;
  const store = readPanelLayoutStoreModule();
  if (!(panelId in store)) return;
  delete store[panelId];
  writePanelLayoutStoreModule(store);
}

function persistPanelLayoutModule(panel) {
  if (!panel || !panel.id || panel.id === "logo-panel") return;
  const rect = panel.getBoundingClientRect();
  const width =
    Math.round(rect.width || Number(panel.dataset.panelWidth || 0) || Number.parseFloat(panel.style.width) || 0);
  const height =
    Math.round(
      rect.height || Number(panel.dataset.panelHeight || 0) || Number.parseFloat(panel.style.height) || 0
    );
  const left = Math.round(rect.left || Number.parseFloat(panel.style.left) || 0);
  const top = Math.round(rect.top || Number.parseFloat(panel.style.top) || 0);
  if (!width || !height) return;
  panel.dataset.panelWidth = String(width);
  panel.dataset.panelHeight = String(height);
  panel.dataset.positioned = "true";
  panel.dataset.userMoved = "true";
  saveStoredPanelLayoutModule(panel.id, {
    width,
    height,
    left,
    top
  });
}

function applyStoredPanelLayoutModule(panel, layout = null) {
  if (!panel || panel.id === "logo-panel") return false;
  const snapshot = layout || getStoredPanelLayoutModule(panel.id);
  if (!snapshot || typeof snapshot !== "object") return false;
  const clamped = clampPanelSizeValue(panel, snapshot.width || panel.dataset.panelWidth || 0, snapshot.height || panel.dataset.panelHeight || 0);
  const width = clamped.width;
  const height = clamped.height;
  const left = Number(snapshot.left || 0);
  const top = Number(snapshot.top || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(left) || !Number.isFinite(top)) {
    return false;
  }
  panel.dataset.panelWidth = String(width);
  panel.dataset.panelHeight = String(height);
  panel.dataset.maximized = "false";
  panel.style.width = `${width}px`;
  panel.style.height = `${height}px`;
  panel.style.transform = "none";
  panel.classList.remove("maximized");
  setPanelPosition(panel, left, top);
  panel.dataset.userMoved = "true";
  panel.dataset.positioned = "true";
  panel.classList.remove("showcase-panel");
  return true;
}

function panelDefaultsApiKeyModule(panelOrId) {
  const id = typeof panelOrId === "string" ? panelOrId : panelOrId?.id;
  const normalized = String(id || "").trim().toLowerCase();
  const map = {
    "logo-panel": "logo",
    "dock-panel": "dock",
    "foryou-panel": "foryou",
    "watch-panel": "watch",
    "lyrics-panel": "lyrics",
    "music-panel": "music",
    "video-panel": "video",
    "about-panel": "about",
    "api-panel": "api",
    "delivery-reports-panel": "delivery_reports",
    "delivery-ops-panel": "delivery_ops",
    "cssmv-panel": "cssmv",
    "language-panel": "language",
    "login-panel": "login",
    "profile-panel": "profile",
    "works-panel": "works",
    "seller-panel": "seller"
  };
  return map[normalized] || "";
}

function panelElementByDefaultKeyModule(panelKey) {
  const map = {
    logo: logoPanel,
    foryou: foryouPanel,
    watch: watchPanel,
    lyrics: lyricsPanel,
    music: musicPanel,
    video: videoPanel,
    about: aboutPanel,
    api: apiPanel,
    delivery_reports: deliveryReportsPanel,
    delivery_ops: deliveryOpsPanel,
    cssmv: cssmvPanel,
    language: languagePanel,
    login: loginPanel,
    profile: profilePanel,
    works: worksPanel,
    seller: sellerPanel
  };
  return map[String(panelKey || "").trim().toLowerCase()] || null;
}

Object.assign(globalThis, {
  safeTModule,
  applyI18nModule,
  loginCopyModule,
  flattenHierarchyWorksModule,
  sortHierarchyNodesModule,
  buildWorkHierarchyModule,
  filterDisplayWorkRootsModule,
  renderHierarchyTreeModule,
  workTypePricingDefaultsModuleBridge: workTypePricingDefaultsModule,
  buildCurrentCreationDefaultsPayloadModuleBridge,
  applyCreationDefaultsModuleBridge,
  loadCreationPanelDefaultsModule,
  saveCreationPanelDefaultsModule,
  creationSummaryTextModule,
  readPanelDefaultStoreModule,
  writePanelDefaultStoreModule,
  getStoredPanelDefaultSnapshotModule,
  savePanelDefaultSnapshotModule,
  readPanelLayoutStoreModule,
  writePanelLayoutStoreModule,
  getStoredPanelLayoutModule,
  saveStoredPanelLayoutModule,
  clearStoredPanelLayoutModule,
  persistPanelLayoutModule,
  applyStoredPanelLayoutModule,
  panelDefaultsApiKeyModule,
  panelElementByDefaultKeyModule
});
