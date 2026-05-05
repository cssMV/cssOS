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
  // Any logged-in user (free, starter, pro, ...) may view their own Works
  // Center. Selling / pricing / payout tools remain individually gated by
  // their own per-action permissions (works.sell, works.price.edit, etc.)
  // inside finalizeWorksPanelReady — no need to block the whole panel here.
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

// CSSOS_PHASE2_NO_REFETCH_ON_SCROLL 20260504 — Jing
// "作品中心面板一打开，经常引发系统崩溃". Inflight + cache guards so
// scroll-driven "load more" doesn't re-fetch 500 rows + re-hydrate
// every thumbnail per scroll tick.
let __cssosLoadMyWorksInflight = null;
async function loadMyWorksModule(options = {}) {
  const list = document.getElementById("works-list-dynamic");
  if (!list) return;
  // CSSOS_PHASE2_LOADING_STUCK_FIX 20260505 — Jing
  // "作品中心一直在loading，很久很久都无法loading出内容". The
  // function previously returned silently if authState.user wasn't
  // yet populated (which happens when the panel opens during the
  // tiny window before auth finishes hydrating). Nothing rescheduled
  // a retry, so the "Loading works..." text from the shell markup
  // sat forever. Retry once auth lands; show a tappable retry chip
  // if the network fetch fails.
  if (!authState.user) {
    if (!list.dataset.cssosAuthWaitBound) {
      list.dataset.cssosAuthWaitBound = "1";
      const retry = () => {
        if (!authState.user) return;
        list.dataset.cssosAuthWaitBound = "";
        document.removeEventListener("cssos:auth-state-changed", retry);
        document.removeEventListener("cssos:auth_ready", retry);
        void loadMyWorksModule(options);
      };
      document.addEventListener("cssos:auth-state-changed", retry);
      document.addEventListener("cssos:auth_ready", retry);
      // Short polling fallback in case neither event fires (some
      // legacy auth paths).
      let polls = 0;
      const pollIv = setInterval(() => {
        if (authState.user) {
          clearInterval(pollIv);
          retry();
        } else if (++polls > 30) {
          clearInterval(pollIv);
          // 15s × 1s = give up. Surface a sign-in prompt instead of
          // leaving the user stuck on "Loading...".
          list.innerHTML = `<div class="works-note">${loginCopy("Sign in to see your works.")}</div>`;
        }
      }, 500);
    }
    return;
  }
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
    // Expose for playlist scoping in openMarketWorkPreview.
    globalThis.latestResolvedWorksCollection = latestResolvedWorksCollection;
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

  // CSSOS_PHASE2_NO_REFETCH_ON_SCROLL 20260504 — when paging-only
  // (resetVisible=false) AND we already have a resolved collection,
  // just re-slice + re-render. Avoids hitting /api/works/mine on
  // every scroll tick and re-hydrating every thumbnail.
  // CSSOS_PHASE2_PROGRESSIVE_LOAD 20260505 — exception: when the
  // caller passes `force: true`, we skip the cache short-circuit
  // and re-fetch (used to top up with a higher fetch limit).
  if (!resetVisible && !options?.force &&
      Array.isArray(latestResolvedWorksCollection) && latestResolvedWorksCollection.length) {
    renderWorksList(latestResolvedWorksCollection);
    return;
  }
  // Inflight guard: collapse concurrent loads into one request so
  // rapid scrolling / repeated panel opens don't fan out to multiple
  // 500-row fetches in parallel.
  if (__cssosLoadMyWorksInflight) {
    return __cssosLoadMyWorksInflight;
  }
  const localWorks = listLocalWorksForCurrentUser();
  if (localWorks.length) {
    renderWorksList(localWorks);
  } else {
    list.innerHTML = buildWorksLoadingMarkup();
  }
  __cssosLoadMyWorksInflight = (async () => {
    try {
      const resolved = await loadResolvedWorksCollection(localWorks);
      if (!resolved.ok && !resolved.usedLocalFallback) {
        list.innerHTML = buildWorksLoadFailedMarkup();
        return;
      }
      renderWorksList(Array.isArray(resolved.works) ? resolved.works : []);
    } finally {
      __cssosLoadMyWorksInflight = null;
    }
  })();
  return __cssosLoadMyWorksInflight;
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
    // CSSOS_PHASE2_PROGRESSIVE_LOAD 20260505 — Jing
    // "loading太久，是不是载入太多了？请载入10卡片即可，再拖动，再
    //  加载10卡片". Start with a small batch (30) so the panel paints
    // in well under a second on mobile. Subsequent scrolls bump the
    // requested limit by another batch via ensureWorksInfinitePaging.
    // The server caps at 1000 so we never exceed that.
    const fetchLimit = Math.max(30, Math.min(1000, Number(globalThis.__cssosWorksFetchLimit || 30)));
    const res = await fetch("/api/works/mine?limit=" + fetchLimit, {
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
  // CSSOS_PHASE2_NO_REFETCH_ON_SCROLL 20260504 — coalesce scroll-driven
  // load-more bursts. tryLoadMore was firing on every threshold cross
  // (≥1 per scroll event); with limit=500 that meant 500-row refetches
  // and full thumbnail re-hydration on every flick. Now: debounce to
  // 150ms, skip when already at end, never re-fetch (paging is purely
  // a re-slice of the already-loaded collection).
  let scrollDebounce = null;
  const tryLoadMore = () => {
    // CSSOS_PHASE2_PROGRESSIVE_LOAD 20260505 — Jing
    // Two cases on scroll-to-bottom:
    //   (a) we have more locally-resolved works than visibleCount —
    //       just expand the slice (no network).
    //   (b) we've shown all loaded works AND the server might have
    //       more — bump the fetch limit and ask again.
    const have = latestResolvedWorksCollection.length;
    if (have > worksVisibleCount) {
      const remaining = have - worksVisibleCount;
      worksVisibleCount += Math.min(WORKS_PAGE_SIZE, remaining);
      void loadMyWorksModule({ resetVisible: false });
      return;
    }
    // We've already shown everything we have locally. If the last
    // fetch returned exactly what was requested, the server probably
    // has more — bump the limit and re-fetch (preserving the
    // visible-count so the user doesn't snap back to the top).
    const lastFetched = Number(globalThis.__cssosWorksFetchLimit || 30);
    if (have >= lastFetched) {
      globalThis.__cssosWorksFetchLimit = Math.min(1000, lastFetched + 30);
      worksVisibleCount += WORKS_PAGE_SIZE;
      void loadMyWorksModule({ resetVisible: false, force: true });
    }
  };
  body.addEventListener(
    "scroll",
    () => {
      const threshold = 120;
      if (body.scrollTop + body.clientHeight < body.scrollHeight - threshold) return;
      if (scrollDebounce) return;
      scrollDebounce = setTimeout(() => {
        scrollDebounce = null;
        tryLoadMore();
      }, 150);
    },
    { passive: true }
  );
  worksAutoPagingBound = true;
}
