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
      return "";   // W770 — Jing「请把 "Pull down to search · N per page" 删掉」
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
  // CSSOS_WAVE_220A 20260517 — Jing: "作品中心还是loading，搜索框输入
  // 任何内容（哪怕空格）内容才刷得出来". Root cause empirically isolated:
  // the limit=30 initial fetch path doesn't paint, but the limit=1000
  // force-refetch path (the one search inputs trigger via
  // ensureFullCorpusThenFilter at line ~469) does. Until we land
  // the proper diagnosis in W220.B with telemetry data, mirror the
  // search-triggered path on first open so users never get stuck on
  // "Loading works...". A ~200ms cost on first paint vs. permanently
  // stuck is a no-brainer trade.
  globalThis.__cssosWorksFetchLimit = 1000;
  void loadMyWorksModule({ resetVisible: true, force: true });
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
  // W460 — a forced reload (retry button / panel re-open) must never be blocked
  // by a stuck inflight promise; clear it so the fetch always re-fires.
  if (options?.force) { __cssosLoadMyWorksInflight = null; }
  // CSSOS_PHASE2_LOADING_STUCK_FIX 20260505 — Jing
  // "作品中心一直在loading，很久很久都无法loading出内容". The
  // function previously returned silently if authState.user wasn't
  // yet populated (which happens when the panel opens during the
  // tiny window before auth finishes hydrating). Nothing rescheduled
  // a retry, so the "Loading works..." text from the shell markup
  // sat forever. Retry once auth lands; show a tappable retry chip
  // if the network fetch fails.
  // CSSOS_WAVE_460 20260526 — Jing「作品中心大部分时候无法 loading 数据, 彻底修复」根因:
  // 之前只要客户端 authState.user 还没 hydrate 就【硬 return】, 把请求挡住, 卡在 shell
  // 的 "Loading works..." 死文字。但 /api/works/mine 是用 credentials:include(会话 cookie)
  // 鉴权的 —— 即便客户端 authState.user 因水合时序还是 null, 只要 cookie 有效, 请求就能成
  // 功。所以这里【不再硬挡】: 先铺骨架(让用户看到在加载), 直接尝试 cookie 鉴权的 fetch;
  // 只有服务器真的返回 401 时才退回到"请登录"。彻底消除水合竞态导致的永久卡死。
  if (!authState.user && !list.querySelector(".work-card, [data-work-id]")) {
    try { list.innerHTML = buildWorksLoadingMarkup(); } catch (_e) {}
    // continue — the cookie-authenticated fetch below decides the outcome.
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
    // CSSOS_WAVE_220A 20260517 — Jing: ALWAYS show a visible retry
    // button next to the loading text. Previous attempts (W111E, W211,
    // PHASE2_LOADING_*) all relied on setTimeout safety nets — but on
    // iOS WKWebView under memory pressure, setTimeout itself gets
    // throttled / dropped, so the timer never fires and the abort
    // controller's 8s never triggers, and the panel sits on "Loading…"
    // forever. The only escape that does NOT depend on timers firing
    // correctly is a user-triggered retry. The button is wired below
    // (works-list-retry-btn) and always present.
    list.innerHTML = `
      <div class="works-note" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px;">
        <div>${loginCopy("Loading works...")}</div>
        <button type="button" id="works-list-retry-btn"
                style="appearance:none;border:1px solid currentColor;background:transparent;color:inherit;padding:6px 14px;border-radius:999px;font:inherit;cursor:pointer;opacity:.7;">
          ${loginCopy("Tap to retry")}
        </button>
      </div>`;
    var retryBtn = list.querySelector("#works-list-retry-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", function () {
        // Force-reset every guard so a stuck inflight can't block us.
        __cssosLoadMyWorksInflight = null;
        latestResolvedWorksCollection = null;
        try { globalThis.cssmemProbe && globalThis.cssmemProbe.beacon("works_retry_clicked"); } catch (_) {}
        list.innerHTML = buildWorksLoadingMarkup();
        void loadMyWorksModule({ force: true, resetVisible: true });
      });
    }
    // Tightened safety net (7s — fail-fast). Best-effort only; the
    // visible retry button is the real escape hatch.
    var hardTimeout = setTimeout(function () {
      try {
        if (!list) return;
        var hasPlaceholder = !!list.querySelector(".works-note");
        var hasCards = !!list.querySelector(".work-card, .work-row, [data-work-id]");
        if (hasPlaceholder && !hasCards) {
          // Beacon the failure so we know it happened (telemetry survives
          // even if timer fires late — we still want the data point).
          try { globalThis.cssmemProbe && globalThis.cssmemProbe.beacon("works_load_stuck_7s"); } catch (_) {}
          // Show "Failed to load works" + an obvious retry button.
          list.innerHTML = `
            <div class="works-note" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px;">
              <div>${loginCopy("Failed to load works.")}</div>
              <button type="button" id="works-list-retry-btn-late"
                      style="appearance:none;border:1px solid currentColor;background:transparent;color:inherit;padding:6px 14px;border-radius:999px;font:inherit;cursor:pointer;">
                ${loginCopy("Retry")}
              </button>
            </div>`;
          var lateBtn = list.querySelector("#works-list-retry-btn-late");
          if (lateBtn) {
            lateBtn.addEventListener("click", function () {
              __cssosLoadMyWorksInflight = null;
              latestResolvedWorksCollection = null;
              list.innerHTML = buildWorksLoadingMarkup();
              void loadMyWorksModule({ force: true, resetVisible: true });
            });
          }
        }
      } catch (_e) {}
    }, 7000);
    list.dataset.cssosLoadingTimeoutId = String(hardTimeout);
  }
  __cssosLoadMyWorksInflight = (async () => {
    try {
      const resolved = await loadResolvedWorksCollection(localWorks);
      if (!resolved.ok && !resolved.usedLocalFallback) {
        // W460 — only a real 401 means "signed out"; everything else gets the
        // retry affordance (buildWorksLoadFailedMarkup carries a retry path).
        if (resolved.needsAuth) {
          try { list.innerHTML = `<div class="works-note">${loginCopy("Sign in to see your works.")}</div>`; } catch (_e) {}
          return;
        }
        try { list.innerHTML = buildWorksLoadFailedMarkup(); } catch (_e) {
          list.innerHTML = `<div class="works-note">Failed to load works.</div>`;
        }
        return;
      }
      renderWorksList(Array.isArray(resolved.works) ? resolved.works : []);
    } catch (err) {
      console.error("[works-center] load failed:", err);
      try { list.innerHTML = buildWorksLoadFailedMarkup(); } catch (_e) {
        list.innerHTML = `<div class="works-note">Failed to load works.</div>`;
      }
    } finally {
      __cssosLoadMyWorksInflight = null;
      try {
        var t = list && list.dataset && Number(list.dataset.cssosLoadingTimeoutId || 0);
        if (t) { clearTimeout(t); list.dataset.cssosLoadingTimeoutId = ""; }
      } catch (_e) {}
    }
  })();
  return __cssosLoadMyWorksInflight;
}

globalThis.loadMyWorksModule = loadMyWorksModule;
globalThis.loadMyWorks = loadMyWorksModule;
globalThis.renderWorksPanelModule = renderWorksPanelModule;
globalThis.openWorksPanelModule = openWorksPanelModule;

/* CSSOS_WAVE_111D 20260512 — Jing
 * Global fingerprint push opt-in row. Surfaced inline in Works Center
 * (creators' control panel) so the consent is visible exactly where
 * the creator manages the works that would be pushed.
 *
 * Three states:
 *   (a) ACRCloud Mgmt OFF on the server (operator hasn't enabled) →
 *       show row as info-only, "Currently disabled by operator".
 *   (b) Mgmt ON + user not opted in → checkbox unchecked, copy
 *       explains the trade-off (anti-piracy attribution vs global
 *       indexing of public works).
 *   (c) Mgmt ON + user opted in → checked + month-to-date counter.
 */
function buildFingerprintOptinRowMarkup() {
  return `
    <div class="works-fp-optin-row" id="works-fp-optin-row" hidden>
      <label class="works-fp-optin-label">
        <input type="checkbox" id="works-fp-optin-toggle" />
        <span class="works-fp-optin-title">🔐 ${escapeHtml(loginCopy(
          "Allow global fingerprint push",
          "允许全球指纹推送"
        ))}</span>
      </label>
      <div class="works-fp-optin-desc" id="works-fp-optin-desc">${escapeHtml(loginCopy(
        "Loading…",
        "加载中…"
      ))}</div>
    </div>
  `;
}

async function hydrateFingerprintOptinRow(worksBody) {
  const row = worksBody.querySelector("#works-fp-optin-row");
  const toggle = worksBody.querySelector("#works-fp-optin-toggle");
  const desc = worksBody.querySelector("#works-fp-optin-desc");
  if (!(row instanceof HTMLElement) || !(toggle instanceof HTMLInputElement) || !(desc instanceof HTMLElement)) return;
  let state = null;
  try {
    const r = await fetch("/api/account/fingerprint-optin", { credentials: "include" });
    state = await r.json().catch(() => null);
  } catch (_) { state = null; }
  if (!state || !state.ok) {
    // Not signed in / endpoint not reachable — hide the row.
    row.hidden = true;
    return;
  }
  row.hidden = false;
  toggle.checked = !!state.allow_global_push;
  function refreshDesc() {
    const mgmt = !!state.mgmt_enabled;
    const used = Number(state.monthly_used || 0);
    const cap = Number(state.monthly_cap || 0);
    const optedIn = !!state.allow_global_push;
    if (!mgmt) {
      desc.innerHTML = `<em>${escapeHtml(loginCopy(
        "Currently disabled by operator — your consent is stored but no pushes will happen until ACRCLOUD_AUTOUPLOAD_ENABLED=1 on the server. You can opt in now to be ready when it flips on.",
        "目前由运营方关闭 —— 你的同意已保存但不会触发任何推送，直到服务器开启 ACRCLOUD_AUTOUPLOAD_ENABLED=1。可以提前勾选，等开关打开后自动生效。"
      ))}</em>`;
    } else if (optedIn) {
      desc.innerHTML = escapeHtml(loginCopy(
        `On. Your public, cleared works get their reference audio pushed to ACRCloud's global archive so reposts on any platform attribute back to you. Used ${used}/${cap} this month.`,
        `已开启。你的公开、已清版作品会自动推送到 ACRCloud 全球库；任何平台的转发都能反向归因到你。本月已用 ${used}/${cap}。`
      ));
    } else {
      desc.innerHTML = escapeHtml(loginCopy(
        "Off. Turn on if you want copies of your public, cleared works reposted on TikTok/YouTube/etc. to be attributable back to you. Private works are never pushed. Tips are non-refundable but you can revoke this consent anytime.",
        "未开启。开启后，转发到 TikTok / YouTube 等平台的副本可被反向归因到你。私有作品不会被推送。你可随时撤销此授权。"
      ));
    }
  }
  refreshDesc();
  toggle.addEventListener("change", async () => {
    const want = toggle.checked;
    toggle.disabled = true;
    try {
      const r = await fetch("/api/account/fingerprint-optin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ allow_global_push: want }),
      });
      const j = await r.json();
      if (j && j.ok) {
        state.allow_global_push = !!j.allow_global_push;
        toggle.checked = !!j.allow_global_push;
        refreshDesc();
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(
            j.allow_global_push
              ? loginCopy("🔐 Global fingerprint push: on", "🔐 全球指纹推送：已开启")
              : loginCopy("🔐 Global fingerprint push: off", "🔐 全球指纹推送：已关闭")
          );
        }
      } else {
        toggle.checked = !want;
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(loginCopy("Save failed.", "保存失败。"));
        }
      }
    } catch (_) {
      toggle.checked = !want;
    } finally {
      toggle.disabled = false;
    }
  });
}

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
    ${buildFingerprintOptinRowMarkup()}
    ${buildWorksSearchShellMarkup(behavior)}
    ${buildWorksListShellMarkup()}
  `;
  /* CSSOS_WAVE_111D 20260512 — Jing
   * Wire the global-fingerprint-push opt-in toggle. Reads current
   * state from the server, lets the creator flip it, and surfaces
   * the operator-side gating ({mgmt_enabled, monthly_used/cap}) so
   * the user understands when their consent is actually actionable. */
  hydrateFingerprintOptinRow(worksBody);
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
  // CSSOS_WAVE_113C 20260511 — Jing
  // "搜索是否真正可用?". The main #works-search-input was never
  // wired to a re-render handler — typing in it filtered nothing.
  const worksInput = worksBody.querySelector("#works-search-input");
  const worksFilter = worksBody.querySelector("#works-search-filter");
  const worksSort = worksBody.querySelector("#works-search-sort");
  const worksAuthor = worksBody.querySelector("#works-search-author");
  const worksPrice = worksBody.querySelector("#works-search-price");
  const worksTime = worksBody.querySelector("#works-search-time");
  const worksFilterBar = worksBody.querySelector("#works-filter-bar");
  // CSSOS_WAVE_291 — ⋯ 切换"高级搜索"区(作者/类型/排序/价格/时间默认收起).
  const worksAdvToggle = worksBody.querySelector("#works-search-advanced-toggle");
  const worksAdvPanel = worksBody.querySelector("#works-search-advanced");
  if (worksAdvToggle && worksAdvPanel && !worksAdvToggle.dataset.cssosWired) {
    worksAdvToggle.dataset.cssosWired = "1";
    worksAdvToggle.addEventListener("click", function () {
      const open = worksAdvPanel.hasAttribute("hidden");
      if (open) worksAdvPanel.removeAttribute("hidden"); else worksAdvPanel.setAttribute("hidden", "");
      worksAdvToggle.setAttribute("aria-expanded", open ? "true" : "false");
      worksAdvToggle.classList.toggle("is-open", open);
    });
  }
  if (worksFilter) worksFilter.value = behavior?.works?.default_filter || "all";
  if (worksSort) worksSort.value = behavior?.works?.default_sort || "newest";
  // CSSOS_WAVE_113D 20260511 — Jing
  // "我确认 Jerusalem 这个作品是有的，可是搜索不出来". The progressive
  // loader starts at 30 works; client-side filter can't see anything
  // outside that window. When the user types in either search box,
  // raise the fetch ceiling to the server cap (1000) and force a
  // full reload once — subsequent keystrokes filter the full set
  // in-memory.
  const ensureFullCorpusThenFilter = () => {
    if (Number(globalThis.__cssosWorksFetchLimit || 30) < 1000) {
      globalThis.__cssosWorksFetchLimit = 1000;
      void loadMyWorksModule({ resetVisible: true, force: true });
    } else {
      void loadMyWorksModule({ resetVisible: true });
    }
  };
  worksInput?.addEventListener("input", ensureFullCorpusThenFilter);
  worksAuthor?.addEventListener("input", ensureFullCorpusThenFilter);
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
  const _result = sortWorkCollection(filterWorkCollection(filterDisplayWorkRoots(buildWorkHierarchy(works)), filterMode), sortMode)
    .filter((work) => {
      if (!query) return true;
      const haystack = [
        work?.title,
        work?.style,
        work?.lyrics_text,
        work?.lyrics_preview,
        work?.description,
        work?.raw_transcript,
        work?.source_run_id,
        work?.id,                                   // W769 — Jing「可用 ID 搜索, 哪怕只前 8 位」
        work?.work_id,
        String(work?.id || work?.work_id || "").replace(/-/g, "")  // 去连字符也能搜
      ].map((value) => String(value || "").toLowerCase()).join("\n");
      // ID 前缀匹配(去连字符比较, 兼顾用户复制带/不带连字符)
      const _qNoDash = query.replace(/-/g, "");
      // W770 — Jing「哪怕包含一个 emoji」: 从查询里抽出 ID 片段(去掉 🆔/空格等, 只留 hex+dash)再匹配。
      const _idQ = query.replace(/[^0-9a-f-]/g, "");
      const _idQND = _idQ.replace(/-/g, "");
      return haystack.includes(query)
        || (_qNoDash && haystack.includes(_qNoDash))
        || (_idQ.length >= 4 && haystack.includes(_idQ))
        || (_idQND.length >= 4 && haystack.includes(_idQND));
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
  // CSSOS_WAVE_480 20260527 — Jing「置顶」: pinned_at 非空的作品浮到最前(按 pinned_at 倒序),
  // 其余保持原排序(JS sort 稳定)。置顶在「最新/搜索结果」之上, 搜索时也是命中关键词里的置顶在前。
  const _pinTs = (w) => {
    const v = w && (w.pinned_at || w.admin_pinned_at);
    return v ? (Date.parse(v) || 1) : 0;
  };
  _result.sort((a, b) => _pinTs(b) - _pinTs(a)); // pinned (个人或全平台) 浮顶; 新置顶在前

  return _result;
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
  /* CSSOS_NO_REFLOW_PAGING 20260506 — Jing
   * "往下拖动…又刷新了一下，造成用户已经拖到下面了，刷新了一下，
   *  用户又要从头滚动". Replacing list.innerHTML on every page-add
   * blew away every card + thumbnail + scroll-position. New flow:
   * snapshot prev count via list.dataset.renderedCount; if the new
   * sortedWorks is a strict superset of what we already painted,
   * append only the deltas to .works-list-results and update the
   * footer in-place. Falls back to full rebuild for sort/filter
   * changes (where order may have shuffled). */
  const prevRendered = Number(list.dataset.renderedCount || 0);
  const resultsContainer = list.querySelector(".works-list-results");
  // Detect "pure append" — we have a previous render, the new list
  // length grew, and the head matches what we already showed (by id).
  const headMatches = (() => {
    if (!resultsContainer || prevRendered <= 0) return false;
    if (sortedWorks.length <= prevRendered) return false;
    const cards = resultsContainer.children;
    if (cards.length !== prevRendered) return false;
    for (let i = 0; i < Math.min(8, prevRendered); i++) {
      const expected = String((sortedWorks[i] && (sortedWorks[i].id || sortedWorks[i].work_id)) || "");
      const actual = String((cards[i] && cards[i].dataset && cards[i].dataset.workId) || "");
      if (expected && actual && expected !== actual) return false;
    }
    return true;
  })();
  if (headMatches && resultsContainer) {
    // Pure append — render only the new tail.
    const tail = sortedWorks.slice(prevRendered);
    const tailHtml = buildWorksCardsMarkup(tail, {
      usageEvents,
      canEditWorkPrices,
      canEditWorkVisibility,
      canEditWorkType,
      canWatchWorks,
      canRegenerateThumbnail,
      canRegeneratePreviewVideo
    });
    const tmp = document.createElement("div");
    tmp.innerHTML = tailHtml;
    while (tmp.firstChild) resultsContainer.appendChild(tmp.firstChild);
    // Update footer count without disturbing scroll.
    const footerNote = list.querySelector(".works-list-footer .works-note");
    if (footerNote) {
      footerNote.textContent = worksPanelCopyModule("showingCount", { visibleCount, allCount });
    }
    list.dataset.renderedCount = String(sortedWorks.length);
    void hydrateWorksCardThumbnails(list, tail);
    injectWorksPinButtons(resultsContainer, tail);
    if (canEditAnyWorkSetting) bindInlineChipEditors(resultsContainer);
    bindWorksCardExpandToggle(resultsContainer);
    bindWorksCardActionButtons(resultsContainer, tail, {
      canWatchWorks,
      canRegenerateThumbnail,
      canRegeneratePreviewVideo
    });
    bindWorksCardEditorControls(resultsContainer, {
      canEditWorkType,
      canEditWorkPrices,
      canEditWorkVisibility
    });
    return;
  }
  // Full rebuild — first render OR sort/filter changed.
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
  list.dataset.renderedCount = String(sortedWorks.length);
  void hydrateWorksCardThumbnails(list, sortedWorks);
  injectWorksPinButtons(list, sortedWorks);
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

// CSSOS_WAVE_480 20260527 — Jing「作品置顶 pin(最多 3 个)」: 渲染后给每张作品卡注入一个
// 📌 置顶/取消按钮(右上角)。置顶作品由 buildVisibleWorks 排到最前(pinned_at 优先);后端
// /api/works/:id/pin 强制上限 3。点击 → 调接口 → 成功后重载列表更新顺序;超限提示。
function injectWorksPinButtons(container, worksArr) {
  try {
    if (!(container instanceof Element)) return;
    const byId = new Map();
    (Array.isArray(worksArr) ? worksArr : []).forEach((w) => {
      const id = String((w && (w.id || w.work_id)) || "").trim();
      if (id) byId.set(id, w);
    });
    container.querySelectorAll(".work-card[data-work-id]").forEach((card) => {
      if (card.querySelector("[data-work-pin]")) return; // idempotent
      const id = String(card.dataset.workId || "").trim();
      if (!id) return;
      const w = byId.get(id);
      // CSSOS_WAVE_481 — 分层置顶: 管理员可对任意作品全平台置顶; 普通用户只能置顶自己的作品。
      const _isAdmin = String((globalThis.authState && globalThis.authState.role) || "").toLowerCase() === "admin";
      if (!_isAdmin && w && (w.is_received_gift || w.owned === false)) return; // 非管理员: 礼物/他人作品不可置顶
      const pinned = !!(w && (w.pinned_at || w.admin_pinned_at));
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-work-pin", id);
      btn.setAttribute("data-pinned", pinned ? "1" : "0");
      btn.setAttribute("aria-label", pinned ? loginCopy("Unpin", "取消置顶") : loginCopy("Pin to top", "置顶"));
      btn.title = _isAdmin
        ? (pinned ? loginCopy("Platform-pinned — tap to unpin", "全平台置顶,点按取消") : loginCopy("Pin platform-wide (admin)", "全平台置顶(管理员)"))
        : (pinned ? loginCopy("Pinned — tap to unpin", "已置顶,点按取消") : loginCopy("Pin to top (max 3)", "置顶(最多 3 个)"));
      btn.textContent = "📌";
      btn.style.cssText =
        "position:absolute;top:8px;left:8px;z-index:6;width:30px;height:30px;border-radius:999px;" +
        "display:grid;place-items:center;font-size:15px;line-height:1;cursor:pointer;border:1px solid " +
        (pinned ? "rgba(0,245,160,0.85);background:rgba(0,245,160,0.22);" : "rgba(255,255,255,0.22);background:rgba(0,0,0,0.42);") +
        "filter:" + (pinned ? "none" : "grayscale(1) opacity(0.7)") + ";transition:filter .15s ease;";
      const cover = card.querySelector(".work-cover") || card;
      if (getComputedStyle(cover).position === "static") cover.style.position = "relative";
      cover.appendChild(btn);
    });
  } catch (_e) { /* non-fatal */ }
}

// One-time delegated handler for pin toggle.
(function installWorksPinHandler() {
  if (typeof document === "undefined" || globalThis.__cssosWorksPinInstalled) return;
  globalThis.__cssosWorksPinInstalled = true;
  document.addEventListener("click", async (ev) => {
    const btn = ev.target instanceof Element ? ev.target.closest("[data-work-pin]") : null;
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const id = String(btn.getAttribute("data-work-pin") || "").trim();
    if (!id) return;
    const wantPinned = btn.getAttribute("data-pinned") !== "1";
    btn.disabled = true;
    try {
      const r = await fetch("/api/works/" + encodeURIComponent(id) + "/pin", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: wantPinned }),
      });
      if (r.status === 409) {
        const j = await r.json().catch(() => ({}));
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(loginCopy("You can pin up to " + (j.limit || 3) + " works — unpin one first.", "最多置顶 " + (j.limit || 3) + " 个作品,请先取消一个。"));
        }
        btn.disabled = false;
        return;
      }
      if (!r.ok) { btn.disabled = false; return; }
      // Success → reload so pinned-first order + button states refresh.
      if (typeof loadMyWorksModule === "function") {
        loadMyWorksModule({ force: true, resetVisible: false });
      }
    } catch (_e) { btn.disabled = false; }
  }, true);
})();

// CSSOS_WAVE_597 — Jing「作品中心也要显示三部曲/歌剧的树形」: 之前过滤用的
// isOperaRootWorkModule【从未定义】→ 此区永远空 = 全是散卡。这里补上【多部根】判定
// (opera/triptych/series/film/shortplay 的根, 排除子节点 act/scene/part/episode),
// 并泛化标题(不止歌剧)。全程 guarded: 缺渲染器/单卡抛错都只是少一个 section, 不崩。
function isMultiPartRootWorkLocalModule(work) {
  if (!work) return false;
  var role = String(work.structure_role || "").trim().toLowerCase();
  var wt = String(work.work_type || "").trim().toLowerCase();
  var multi = ["opera", "triptych", "series", "film", "shortplay"].indexOf(wt) !== -1;
  return multi && role !== "act" && role !== "scene" && role !== "part" && role !== "episode";
}
function buildWorksScoreOverviewMarkupModule(works = []) {
  const roots = (Array.isArray(works) ? works : []).filter((work) =>
    (typeof globalThis.isOperaRootWorkModule === "function")
      ? globalThis.isOperaRootWorkModule(work)
      : isMultiPartRootWorkLocalModule(work)
  );
  if (!roots.length || typeof globalThis.buildOperaScoreOverviewMarkupModule !== "function") {
    return "";
  }
  return `
    <div class="works-section">
      <div class="section-title">${escapeHtml(loginCopy("Multi-part works · opera · triptych · series"))}</div>
      <div class="workspace-grid">
        ${roots.map((work) => { try { return globalThis.buildOperaScoreOverviewMarkupModule(work); } catch (_e) { return ""; } }).join("")}
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
    const timeoutId = controller ? window.setTimeout(() => controller.abort(), 6000) : null;
    // CSSOS_PHASE2_PROGRESSIVE_LOAD 20260505 — Jing
    // "loading太久，是不是载入太多了？请载入10卡片即可，再拖动，再
    //  加载10卡片". Start with a small batch (30) so the panel paints
    // in well under a second on mobile. Subsequent scrolls bump the
    // requested limit by another batch via ensureWorksInfinitePaging.
    // The server caps at 1000 so we never exceed that.
    const fetchLimit = Math.max(30, Math.min(1000, Number(globalThis.__cssosWorksFetchLimit || 30)));
    // CSSOS_WAVE_220A 20260517 — Jing: belt-and-suspenders timeout.
    // AbortController.setTimeout can be throttled on iOS WKWebView
    // under memory pressure, leaving the fetch hung indefinitely.
    // Promise.race with a hard reject guarantees we never await past
    // 7s even if setTimeout fires late — the race resolves on whichever
    // settles first. The fetch promise that "loses" the race is left
    // to be GC'd (the response, if it ever lands, is ignored).
    const fetchP = fetch("/api/works/mine?limit=" + fetchLimit, {
      credentials: "include",
      signal: controller?.signal
    });
    const hardKillP = new Promise(function (_resolve, reject) {
      window.setTimeout(function () {
        reject(new Error("fetch_hard_timeout_7s"));
      }, 7000);
    });
    let res;
    try {
      res = await Promise.race([fetchP, hardKillP]);
    } catch (raceErr) {
      // Hard-timeout path. Tell the caller we failed; the panel will
      // show the retry button.
      try { controller?.abort(); } catch (_) {}
      throw raceErr;
    }
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      return {
        ok: false,
        status: res?.status || 0,
        needsAuth: res?.status === 401,
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

/* CSSOS_PHASE2_WORKS_LOADFAIL_RESTORE 20260505 — Jing
   Restored after the dead-code sweep on 2026-05-05 nuked the only
   definition (in a deleted helper). Without it, the call site at line
   222 hit ReferenceError when /api/works/mine returned 401, the async
   chain rejected unhandled, and the panel sat on "Loading works..."
   forever. */
function buildWorksLoadFailedMarkup() {
  // W460 — failure must always carry a visible retry (previously plain text =
  // dead end). The click handler resets guards and re-fetches.
  return `
    <div class="works-note" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px;">
      <div>${loginCopy("Failed to load works.", "加载作品失败。")}</div>
      <button type="button" id="works-list-retry-btn-fail"
              style="appearance:none;border:1px solid currentColor;background:transparent;color:inherit;padding:6px 14px;border-radius:999px;font:inherit;cursor:pointer;"
              onclick="(function(){var l=document.getElementById('works-list-dynamic');if(l&&typeof cssosSkeletonListMarkup==='function')l.innerHTML=cssosSkeletonListMarkup(5,'Loading…');if(typeof loadMyWorksModule==='function')loadMyWorksModule({force:true,resetVisible:true});})()">
        ${loginCopy("Retry", "重试")}
      </button>
    </div>`;
}

function buildWorksLoadingMarkup() {
  // W459/W460 — unified skeleton placeholder while works load.
  if (typeof globalThis.cssosSkeletonListMarkup === "function") {
    return globalThis.cssosSkeletonListMarkup(5, loginCopy("Loading works..."));
  }
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
    /* CSSOS_WAVE_211 ROLLBACK 20260516 — Jing: works-center stuck on
     * "Loading works…". My over-eager `lastFetched < 1000` gate caused
     * a fetch storm at panel mount: scroll-near-bottom triggered as
     * soon as the initial 10 fit the viewport, bumping limit to 60 →
     * 90 → ... → 1000 with full refetch each step. Restored the
     * original gate (`have >= lastFetched`) which only paginates after
     * the user has actually seen everything cached locally. */
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
