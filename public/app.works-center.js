const WORKS_PAGE_SIZE = 10;
let worksVisibleCount = WORKS_PAGE_SIZE;
let latestResolvedWorksCollection = [];
let worksAutoPagingBound = false;
let worksBatchThumbRegenerationPending = false;

function worksPanelCopyModule(kind, detail = {}) {
  switch (String(kind || "").trim()) {
    case "recovering":
      return loginCopy(
        "Works Center is recovering. Refresh once if the panel looks incomplete."
      );
    case "searchHint":
      return loginCopy(
        `Pull down to search · ${WORKS_PAGE_SIZE} per page`
      );
    case "showingCount":
      return loginCopy(
        `Showing ${Number(detail.visibleCount || 0)} of ${Number(detail.allCount || 0)} works`
      );
    default:
      return "";
  }
}

function buildWorksPanelRenderContextModule() {
  const behavior = readPanelBehaviorSettingsLocal();
  return {
    behavior,
    guest: !authState.user,
    displayName: authState.user?.name || authState.user?.email || "User",
    avatarUrl: readProfileAvatarOverride() || authState.user?.avatar || "",
    canOpenWorks: hasPanelPermission("works.open"),
    canViewOwnWorks: hasPanelPermission("works.own.view"),
    canSellWorks: hasPanelPermission("works.sell"),
    canSetupPayout: hasPanelPermission("works.payout")
  };
}

function renderWorksPanelModule() {
  const worksBody = worksPanel ? worksPanel.querySelector(".works-body") : null;
  if (!worksBody) return;
  const context = buildWorksPanelRenderContextModule();
  worksBody.classList.toggle("is-guest", context.guest);
  if (context.guest) {
    renderWorksGuestState(worksBody);
    return;
  }
  if (!context.canOpenWorks || !context.canViewOwnWorks) {
    renderWorksPermissionState(worksBody);
    return;
  }
  finalizeWorksPanelReady(worksBody, {
    displayName: context.displayName,
    avatarUrl: context.avatarUrl,
    canSellWorks: context.canSellWorks,
    canSetupPayout: context.canSetupPayout,
    behavior: context.behavior
  });
  ensureWorksInfinitePaging();
  ensureWorksCommercePreload();
  void loadMyWorksModule();
}

function openWorksPanelModule() {
  if (!(worksPanel instanceof HTMLElement)) return false;
  const worksBody = worksPanel.querySelector(".works-body");
  try {
    worksPanel.classList.remove("hidden");
    worksPanel.dataset.minimized = "false";
    worksPanel.classList.remove("search-revealed");
    renderWorksPanelModule();
  } catch (error) {
    console.error("[works-panel] render failed", error);
    if (worksBody instanceof HTMLElement) {
      worksBody.innerHTML = `
        <div class="panel-label">${loginCopy("Creator Works Center")}</div>
        <div class="report-empty">${worksPanelCopyModule("recovering")}</div>
      `;
    }
  }
  try {
    if (typeof openPanel === "function") {
      openPanel(worksPanel);
    } else if (typeof globalThis.openPanelBridge === "function") {
      globalThis.openPanelBridge(worksPanel);
    } else {
      if (!worksPanel.dataset.positioned && typeof globalThis.placePanelFromTopLeft === "function") {
        globalThis.placePanelFromTopLeft(worksPanel);
      }
      if (typeof globalThis.focusPanelBridge === "function") {
        globalThis.focusPanelBridge(worksPanel);
      }
    }
  } catch (error) {
    console.error("[works-panel] open failed", error);
  }
  worksPanel.classList.remove("hidden");
  worksPanel.dataset.minimized = "false";
  if (typeof globalThis.clampPanelInViewport === "function") {
    globalThis.clampPanelInViewport(worksPanel);
  }
  if (typeof globalThis.focusPanelBridge === "function") {
    globalThis.focusPanelBridge(worksPanel);
  }
  return !worksPanel.classList.contains("hidden");
}

async function loadMyWorksModule(options = {}) {
  const list = document.getElementById("works-list-dynamic");
  if (!list || !authState.user) return;
  const resetVisible = options?.resetVisible !== false;
  if (resetVisible) {
    worksVisibleCount = WORKS_PAGE_SIZE;
  }
  const renderWorksList = (works) => {
    const {
      usageEvents,
      canWatchWorks,
      canRegenerateThumbnail,
      canRegeneratePreviewVideo,
      canEditWorkType,
      canEditWorkPrices,
      canEditWorkVisibility,
      canEditAnyWorkSetting
    } = readWorksRenderContext();
    const worksViewOptions = readWorksListViewOptions();
    syncWorksFilterPills(worksViewOptions);
    const allVisibleWorks = buildVisibleWorks(works, worksViewOptions);
    latestResolvedWorksCollection = Array.isArray(allVisibleWorks) ? allVisibleWorks : [];
    if (!allVisibleWorks.length) {
      list.innerHTML = buildWorksEmptyNoteMarkup();
      return;
    }
    const pageWorks = allVisibleWorks.slice(0, worksVisibleCount);
    finalizeWorksListRender(list, pageWorks, {
      allCount: allVisibleWorks.length,
      visibleCount: pageWorks.length,
      usageEvents,
      canWatchWorks,
      canRegenerateThumbnail,
      canRegeneratePreviewVideo,
      canEditWorkType,
      canEditWorkPrices,
      canEditWorkVisibility,
      canEditAnyWorkSetting
    });
  };

  const localWorks = listLocalWorksForCurrentUser();
  if (localWorks.length) {
    renderWorksList(localWorks);
  } else {
    list.innerHTML = buildWorksLoadingMarkup();
  }
  const resolved = await loadResolvedWorksCollection(localWorks);
  if (!resolved.ok && !resolved.usedLocalFallback) {
    list.innerHTML = buildWorksLoadFailedMarkup();
    return;
  }
  renderWorksList(Array.isArray(resolved.works) ? resolved.works : []);
}

globalThis.loadMyWorksModule = loadMyWorksModule;
globalThis.loadMyWorks = loadMyWorksModule;
globalThis.renderWorksPanelModule = renderWorksPanelModule;
globalThis.openWorksPanelModule = openWorksPanelModule;

function ensureWorksPanelShell(worksBody, options = {}) {
  if (!(worksBody instanceof Element)) return;
  const displayName = String(options.displayName || "").trim() || "User";
  const avatarUrl = String(options.avatarUrl || "").trim();
  const canSellWorks = options.canSellWorks === true;
  const canSetupPayout = options.canSetupPayout === true;
  const behavior = options.behavior || readPanelBehaviorSettingsLocal();
  worksBody.innerHTML = `
    <div class="panel-label">${loginCopy("Creator Works Center")}</div>
    ${buildWorksHeroMarkup({ displayName, avatarUrl, canSellWorks, canSetupPayout })}
    ${buildWorksSearchShellMarkup(behavior)}
    ${buildWorksListShellMarkup()}
  `;
  const ensurePullRevealSearchModule = globalThis.ensurePullRevealSearchModule;
  if (typeof ensurePullRevealSearchModule === "function") {
    ensurePullRevealSearchModule(worksPanel, worksBody, {
      enabled: behavior?.works?.search_enabled,
      placeholder: loginCopy("Search title, style, lyrics..."),
      hint: worksPanelCopyModule("searchHint"),
      onInput: () => void loadMyWorksModule({ resetVisible: true })
    });
  }
}

function bindWorksSearchControls(worksBody, options = {}) {
  if (!(worksBody instanceof Element)) return;
  const behavior = options.behavior || readPanelBehaviorSettingsLocal();
  const worksFilter = worksBody.querySelector("#works-search-filter");
  const worksSort = worksBody.querySelector("#works-search-sort");
  const worksAuthor = worksBody.querySelector("#works-search-author");
  const worksPrice = worksBody.querySelector("#works-search-price");
  const worksTime = worksBody.querySelector("#works-search-time");
  const worksFilterBar = worksBody.querySelector("#works-filter-bar");
  if (worksFilter) worksFilter.value = behavior?.works?.default_filter || "all";
  if (worksSort) worksSort.value = behavior?.works?.default_sort || "newest";
  worksAuthor?.addEventListener("input", () => void loadMyWorksModule({ resetVisible: true }));
  worksFilter?.addEventListener("change", () => void loadMyWorksModule({ resetVisible: true }));
  worksSort?.addEventListener("change", () => void loadMyWorksModule({ resetVisible: true }));
  worksPrice?.addEventListener("change", () => void loadMyWorksModule({ resetVisible: true }));
  worksTime?.addEventListener("change", () => void loadMyWorksModule({ resetVisible: true }));
  worksFilterBar?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const removeButton = event.target.closest(".panel-filter-pill-remove");
    if (removeButton) {
      const pill = removeButton.closest("[data-filter-key]");
      const key = String(pill?.getAttribute("data-filter-key") || "").trim();
      const defaults = readPanelBehaviorSettingsLocal().works;
      const map = {
        query: ["works-search-input", ""],
        author: ["works-search-author", ""],
        filter: ["works-search-filter", defaults.default_filter || "all"],
        sort: ["works-search-sort", defaults.default_sort || "newest"],
        price: ["works-search-price", "all"],
        time: ["works-search-time", "all"]
      };
      if (map[key]) {
        clearSingleSearchControl(map[key][0], map[key][1]);
        void loadMyWorksModule({ resetVisible: true });
      }
      return;
    }
    if (!event.target.closest(".panel-filter-clear")) return;
    clearSearchControls([
      "works-search-input",
      "works-search-author",
      "works-search-filter",
      "works-search-sort",
      "works-search-price",
      "works-search-time"
    ]);
    void loadMyWorksModule({ resetVisible: true });
  });
}

function renderWorksGuestState(worksBody) {
  if (!(worksBody instanceof Element)) return true;
  worksBody.innerHTML = buildWorksGuestEmptyMarkup();
  worksBody.querySelector("[data-open-login]")?.addEventListener("click", () => openPanel(loginPanel));
  return true;
}

function renderWorksPermissionState(worksBody) {
  if (!(worksBody instanceof Element)) return true;
  worksBody.innerHTML = buildWorksPermissionEmptyMarkup();
  worksBody.querySelector("[data-open-login]")?.addEventListener("click", () => openPanel(loginPanel));
  return true;
}

function finalizeWorksPanelReady(worksBody, options = {}) {
  if (!(worksBody instanceof Element)) return;
  const behavior = options.behavior || readPanelBehaviorSettingsLocal();
  ensureWorksPanelShell(worksBody, {
    displayName: options.displayName,
    avatarUrl: options.avatarUrl,
    canSellWorks: options.canSellWorks,
    canSetupPayout: options.canSetupPayout,
    behavior
  });
  bindWorksSearchControls(worksBody, { behavior });
  bindWorksHeroActions(worksBody);
  worksBody.querySelector("[data-works-batch-regen-thumbs]")?.addEventListener("click", async (event) => {
    event.preventDefault();
    if (worksBatchThumbRegenerationPending) return;
    if (getUserRole() !== "admin") {
      showToast(loginCopy("Only admin maintenance can backfill missing thumbnails."));
      return;
    }
    const candidates = latestResolvedWorksCollection.filter((work) => {
      const fastImage = globalThis.resolveWorkCardThumbnailImageModule?.(work) || "";
      return !fastImage || isSyntheticWorkCoverImage(fastImage);
    });
    if (!candidates.length) {
      showToast(loginCopy("All visible works already have thumbnails."));
      return;
    }
    worksBatchThumbRegenerationPending = true;
    const trigger = event.currentTarget;
    if (trigger instanceof HTMLButtonElement) trigger.disabled = true;
    try {
      let completed = 0;
      for (const work of candidates) {
        const ok = await regenerateWorkThumbnail(work, trigger, {
          systemBackfill: true,
          suppressToast: true
        });
        if (ok) completed += 1;
      }
      showToast(loginCopy(`Backfilled ${completed} missing thumbnails without charging creators.`));
      void loadMyWorksModule({ resetVisible: false });
    } finally {
      worksBatchThumbRegenerationPending = false;
      if (trigger instanceof HTMLButtonElement) trigger.disabled = false;
    }
  });
}

function ensureWorksCommercePreload() {
  if (!watchCommerceState.loaded && !watchCommerceState.loading) {
    void loadWatchCommerce().then(() => broadcastWorksCommerceRefresh());
  }
}

function readWorksListViewOptions() {
  const behavior = readPanelBehaviorSettingsLocal();
  return {
    query: String(document.getElementById("works-search-input")?.value || "").trim().toLowerCase(),
    authorQuery: String(document.getElementById("works-search-author")?.value || "").trim().toLowerCase(),
    filterMode: String(document.getElementById("works-search-filter")?.value || behavior.works.default_filter || "all"),
    sortMode: String(document.getElementById("works-search-sort")?.value || behavior.works.default_sort || "newest"),
    priceMode: String(document.getElementById("works-search-price")?.value || "all"),
    timeMode: String(document.getElementById("works-search-time")?.value || "all")
  };
}

function syncWorksFilterPills(options = {}) {
  const filterMode = String(options.filterMode || "all");
  const sortMode = String(options.sortMode || "newest");
  const priceMode = String(options.priceMode || "all");
  const timeMode = String(options.timeMode || "all");
  renderSearchFilterPills(document.getElementById("works-filter-bar"), {
    query: String(options.query || ""),
    author: String(options.authorQuery || ""),
    filterLabel: ({
      all: loginCopy("All"),
      single: loginCopy("Single"),
      triptych: loginCopy("Triptych"),
      opera: loginCopy("Opera"),
      live: loginCopy("Live"),
      hidden: loginCopy("Hidden")
    })[filterMode],
    sortLabel: ({
      newest: loginCopy("Newest"),
      oldest: loginCopy("Oldest"),
      title: loginCopy("Title"),
      type: loginCopy("Type")
    })[sortMode],
    priceLabel: ({
      all: "",
      free: loginCopy("Free"),
      under_1: loginCopy("Under $1"),
      under_5: loginCopy("Under $5"),
      above_5: loginCopy("Above $5")
    })[priceMode],
    timeLabel: ({
      all: "",
      day: loginCopy("24h"),
      week: loginCopy("7 days"),
      month: loginCopy("30 days")
    })[timeMode]
  });
}

function buildVisibleWorks(works = [], options = {}) {
  const query = String(options.query || "").trim().toLowerCase();
  const authorQuery = String(options.authorQuery || "").trim().toLowerCase();
  const filterMode = String(options.filterMode || "all");
  const sortMode = String(options.sortMode || "newest");
  const priceMode = String(options.priceMode || "all");
  const timeMode = String(options.timeMode || "all");
  return sortWorkCollection(filterWorkCollection(filterDisplayWorkRoots(buildWorkHierarchy(works)), filterMode), sortMode)
    .filter((work) => {
      if (!query) return true;
      const haystack = [
        work?.title,
        work?.style,
        work?.lyrics_text,
        work?.lyrics_preview,
        work?.description,
        work?.raw_transcript,
        work?.source_run_id
      ].map((value) => String(value || "").toLowerCase()).join("\n");
      return haystack.includes(query);
    })
    .filter((work) => {
      if (!authorQuery) return true;
      const haystack = [work?.owner_name, work?.owner_email, work?.owner_handle].map((value) => String(value || "").toLowerCase()).join("\n");
      return haystack.includes(authorQuery);
    })
    .filter((work) => {
      const pricing =
        globalThis.resolveDisplayedWorkPricingModule?.(work, getWorkCommerceDetails(String(work?.id || work?.work_id || ""))) ||
        null;
      const cents = Number(
        pricing?.listenPriceCents ||
          work?.listen_price_cents ||
          work?.current_listen_price_cents ||
          0
      );
      if (priceMode === "free") return cents <= 0;
      if (priceMode === "under_1") return cents > 0 && cents <= 100;
      if (priceMode === "under_5") return cents > 0 && cents <= 500;
      if (priceMode === "above_5") return cents > 500;
      return true;
    })
    .filter((work) => {
      if (timeMode === "all") return true;
      const created = workCreatedTimestamp(work);
      const age = Date.now() - created;
      if (timeMode === "day") return age <= 24 * 60 * 60 * 1000;
      if (timeMode === "week") return age <= 7 * 24 * 60 * 60 * 1000;
      if (timeMode === "month") return age <= 30 * 24 * 60 * 60 * 1000;
      return true;
    });
}

function readWorksRenderContext() {
  const commerce = watchCommerceState.payload || null;
  const usageEvents = Array.isArray(commerce?.usage_events) ? commerce.usage_events : [];
  const canWatchWorks = hasPanelPermission("works.watch");
  const canRegenerateThumbnail = hasPanelPermission("works.thumbnail.regen");
  const canRegeneratePreviewVideo = hasPanelPermission("works.preview_video.regen");
  const canEditWorkType = hasPanelPermission("works.type.edit");
  const canEditWorkPrices = hasPanelPermission("works.price.edit");
  const canEditWorkVisibility = hasPanelPermission("works.visibility.edit");
  const canEditAnyWorkSetting = canEditWorkType || canEditWorkPrices || canEditWorkVisibility;
  return {
    usageEvents,
    canWatchWorks,
    canRegenerateThumbnail,
    canRegeneratePreviewVideo,
    canEditWorkType,
    canEditWorkPrices,
    canEditWorkVisibility,
    canEditAnyWorkSetting
  };
}

function finalizeWorksListRender(list, sortedWorks, context = {}) {
  if (!(list instanceof Element) || !Array.isArray(sortedWorks)) return;
  const usageEvents = Array.isArray(context.usageEvents) ? context.usageEvents : [];
  const canWatchWorks = context.canWatchWorks === true;
  const canRegenerateThumbnail = context.canRegenerateThumbnail === true;
  const canRegeneratePreviewVideo = context.canRegeneratePreviewVideo === true;
  const canEditWorkType = context.canEditWorkType === true;
  const canEditWorkPrices = context.canEditWorkPrices === true;
  const canEditWorkVisibility = context.canEditWorkVisibility === true;
  const canEditAnyWorkSetting = context.canEditAnyWorkSetting === true;
  const allCount = Math.max(0, Number(context.allCount || sortedWorks.length) || sortedWorks.length);
  const visibleCount = Math.max(0, Number(context.visibleCount || sortedWorks.length) || sortedWorks.length);
  const scoreOverviewMarkup = buildWorksScoreOverviewMarkupModule(sortedWorks);
  list.innerHTML = `
    ${scoreOverviewMarkup}
    <div class="works-list-results">${buildWorksCardsMarkup(sortedWorks, {
      usageEvents,
      canEditWorkPrices,
      canEditWorkVisibility,
      canEditWorkType,
      canWatchWorks,
      canRegenerateThumbnail,
      canRegeneratePreviewVideo
    })}</div>
    <div class="works-list-footer">
      <div class="works-note">${escapeHtml(worksPanelCopyModule("showingCount", { visibleCount, allCount }))}</div>
    </div>
  `;
  void hydrateWorksCardThumbnails(list, sortedWorks);
  globalThis.bindOperaScoreJumpTargetsModule?.(list);
  if (canEditAnyWorkSetting) bindInlineChipEditors(list);
  bindWorksCardExpandToggle(list);
  bindWorksCardActionButtons(list, sortedWorks, {
    canWatchWorks,
    canRegenerateThumbnail,
    canRegeneratePreviewVideo
  });
  bindWorksCardEditorControls(list, {
    canEditWorkType,
    canEditWorkPrices,
    canEditWorkVisibility
  });
}

function buildWorksScoreOverviewMarkupModule(works = []) {
  const operaRoots = (Array.isArray(works) ? works : []).filter((work) =>
    globalThis.isOperaRootWorkModule?.(work)
  );
  if (!operaRoots.length || typeof globalThis.buildOperaScoreOverviewMarkupModule !== "function") {
    return "";
  }
  return `
    <div class="works-section">
      <div class="section-title">${escapeHtml(loginCopy("Opera Full Score"))}</div>
      <div class="workspace-grid">
        ${operaRoots.map((work) => globalThis.buildOperaScoreOverviewMarkupModule(work)).join("")}
      </div>
    </div>
  `;
}

async function loadResolvedWorksCollection(localWorks = []) {
  const safeLocalWorks = Array.isArray(localWorks) ? localWorks : [];
  try {
    if (!watchCommerceState.loaded && !watchCommerceState.loading) {
      void loadWatchCommerce(true).catch(() => null);
    }
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller ? window.setTimeout(() => controller.abort(), 8000) : null;
    const res = await fetch("/api/works/mine?limit=120", {
      credentials: "include",
      signal: controller?.signal
    });
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      return {
        ok: false,
        works: safeLocalWorks,
        usedLocalFallback: safeLocalWorks.length > 0
      };
    }
    const data = payload?.data || payload || {};
    const remoteWorks = Array.isArray(data.works) ? data.works : [];
    const mergedWorks = mergeLocalAndRemoteWorks(remoteWorks, safeLocalWorks);
    mergedWorks.forEach((work) => {
      try {
        upsertLocalWorkRecord({
          ...work,
          ownerKey: getCurrentWorksOwnerKey?.()
        });
      } catch (_err) {
        // keep rendering even if local cache sync fails
      }
    });
    return {
      ok: true,
      works: mergedWorks,
      usedLocalFallback: false
    };
  } catch {
    return {
      ok: false,
      works: safeLocalWorks,
      usedLocalFallback: safeLocalWorks.length > 0
    };
  }
}

function buildWorksLoadingMarkup() {
  return `<div class="works-note">${loginCopy("Loading works...")}</div>`;
}

function ensureWorksInfinitePaging() {
  if (worksAutoPagingBound || !(worksPanel instanceof HTMLElement)) return;
  const body = worksPanel.querySelector(".works-body");
  if (!(body instanceof HTMLElement)) return;
  const tryLoadMore = () => {
    if (latestResolvedWorksCollection.length <= worksVisibleCount) return;
    const remaining = latestResolvedWorksCollection.length - worksVisibleCount;
    if (remaining <= 0) return;
    worksVisibleCount += Math.min(WORKS_PAGE_SIZE, remaining);
    void loadMyWorksModule({ resetVisible: false });
  };
  body.addEventListener(
    "scroll",
    () => {
      const threshold = 120;
      if (body.scrollTop + body.clientHeight < body.scrollHeight - threshold) return;
      tryLoadMore();
    },
    { passive: true }
  );
  worksAutoPagingBound = true;
}
