const FORYOU_MARKET_PAGE_SIZE = 10;
let foryouMarketVisibleCount = FORYOU_MARKET_PAGE_SIZE;
let latestVisibleMarketWorks = [];
let foryouMarketAutoPagingBound = false;

function getPayoutReminderPresentation(connectedAccount) {
  const hasAccount = Boolean(connectedAccount?.stripe_account_id);
  const payoutsEnabled = Boolean(connectedAccount?.payouts_enabled);
  const detailsSubmitted = Boolean(connectedAccount?.details_submitted);
  const chargesEnabled = Boolean(connectedAccount?.charges_enabled);
  if (!hasAccount || payoutsEnabled) return null;
  if (!detailsSubmitted) {
    return {
      message: loginCopy(
        "Warm reminder: finish your payout setup so you do not miss fan tips, bounty income, and seller earnings.",
      ),
      action: loginCopy("Finish setup"),
    };
  }
  if (!chargesEnabled) {
    return {
      message: loginCopy(
        "Your payout account is connected, but Stripe still needs a few details. Please review and update your payout information.",
      ),
      action: loginCopy("Update info"),
    };
  }
  return {
    message: loginCopy(
      "Your payout account is already connected. Please review the payout status and update details if Stripe still shows pending steps.",
    ),
    action: loginCopy("Check status"),
  };
}

function marketActionCopy(kind, state = {}) {
  if (kind === "listen") {
    if (state.pendingBuyout || state.pendingListen)
      return loginCopy("Listen pending");
    if (state.paidBuyout || state.paidListen)
      return loginCopy("Owned listen");
    return loginCopy("Listen");
  }
  if (kind === "buyout") {
    if (state.pendingBuyout) return loginCopy("Buyout pending");
    if (state.paidBuyout) return loginCopy("Owned");
    return loginCopy("Buyout");
  }
  if (kind === "tip") {
    if (state.pendingTip) return loginCopy("Tip pending");
    if (state.paidTip) return loginCopy("Tipped");
    return loginCopy("Tip");
  }
  return "";
}

function workRequiresWholeBuyoutModule(work = {}) {
  const workType = normalizeWorkTypeClient(work?.work_type);
  const role = String(work?.structure_role || "")
    .trim()
    .toLowerCase();
  if (workType === "opera" || workType === "triptych") return true;
  return role === "act" || role === "scene" || role === "part";
}

function workIsWholeBuyoutChildModule(work = {}) {
  const role = String(work?.structure_role || "")
    .trim()
    .toLowerCase();
  return role === "act" || role === "scene" || role === "part";
}

function buyoutLabelForWorkModule(work = {}) {
  const workType = normalizeWorkTypeClient(work?.work_type);
  if (workType === "opera") return loginCopy("Opera buyout");
  if (workType === "triptych")
    return loginCopy("Triptych buyout");
  return loginCopy("Buyout");
}

function resolveDisplayedWorkPricingModule(work = {}, commerce = {}) {
  // P2-57b: Do NOT fall back to work-type default prices (e.g., $0.99/$2.99) for
  // display — doing so caused a "price flash" where partially-hydrated works in
  // the Works Center briefly rendered fake $0.99/$2.99 before real prices
  // arrived from the server. We now only return real, user-/server-set prices
  // for the display fields (`listenPriceCents` / `buyoutPriceCents`). The
  // editor-oriented fields `suggestedListen` / `suggestedBuyout` still expose
  // the work-type default as a fallback so editor UIs can pre-fill sensibly.
  const defaults = workTypePricingDefaults(normalizeWorkTypeClient(work?.work_type));
  const rawListen = Math.max(
    0,
    Number(
      commerce?.listenCents ||
        work?.current_listen_price_cents ||
        work?.listen_price_cents ||
        0
    )
  );
  const rawBuyout = Math.max(
    0,
    Number(
      commerce?.buyoutCents ||
        work?.current_buyout_price_cents ||
        work?.buyout_price_cents ||
        0
    )
  );
  // `suggestedListen`/`suggestedBuyout` are the creator's explicit suggestions
  // (without defaults as a pollutant) for the pricing-decision logic below.
  const suggestedListenRaw = Math.max(
    0,
    Number(work?.suggested_listen_price_cents || 0)
  );
  const suggestedBuyoutRaw = Math.max(
    0,
    Number(work?.suggested_buyout_price_cents || 0)
  );
  const shouldPreferSuggestedListen = suggestedListenRaw > 0 && !rawListen;
  const shouldPreferSuggestedBuyout = suggestedBuyoutRaw > 0 && !rawBuyout;
  return {
    // Display price — 0 if truly unset (render layer will show "Not set").
    listenPriceCents: shouldPreferSuggestedListen ? suggestedListenRaw : rawListen,
    buyoutPriceCents: shouldPreferSuggestedBuyout ? suggestedBuyoutRaw : rawBuyout,
    // Editor / reference hint — falls back to work-type default when the
    // creator hasn't explicitly suggested a price, so editors can pre-fill.
    suggestedListen: suggestedListenRaw || defaults.listenCents,
    suggestedBuyout: suggestedBuyoutRaw || defaults.buyoutCents
  };
}

function renderSellerPanel() {
  if (!sellerMetrics || !sellerOrdersList || !sellerLedgerList) return;
  const behavior = readPanelBehaviorSettingsLocal();
  const canViewSeller = hasPanelPermission("seller.view");
  const canOperateSeller = hasPanelPermission("seller.operate");
  const canSetupPayout = hasPanelPermission("seller.payout");
  if (!canViewSeller) {
    const upgradeCopy = isLoggedInUser()
      ? loginCopy(
          "Upgrade to a paid membership to unlock seller orders, earnings, and payouts.",
        )
      : loginCopy(
          "Sign in first, then upgrade to a paid membership to unlock seller tools.",
        );
    sellerMetrics.innerHTML = `<div class="works-note">${upgradeCopy}</div>`;
    sellerOrdersList.innerHTML = `<div class="works-note">${upgradeCopy}</div>`;
    sellerLedgerList.innerHTML = `<div class="works-note">${upgradeCopy}</div>`;
    return;
  }
  const commerce = watchCommerceState.payload || null;
  const connectedAccount = commerce?.connected_account || null;
  const payoutAction = getPayoutActionPresentation(connectedAccount);
  const payoutReminderState = getPayoutReminderPresentation(connectedAccount);
  const showPayoutReminder =
    watchCommerceState.loaded &&
    isLoggedInUser() &&
    Boolean(payoutReminderState);
  const market = commerce?.market || {};
  const orders = (Array.isArray(market.orders) ? market.orders : []).filter(
    (row) => {
      if (behavior.seller.order_filter === "paid")
        return String(row?.status || "") === "paid";
      if (behavior.seller.order_filter === "pending")
        return ["pending", "processing"].includes(String(row?.status || ""));
      return true;
    },
  );
  const ledgerEntries = Array.isArray(commerce?.ledger_entries)
    ? commerce.ledger_entries
    : [];
  const gross = orders.reduce(
    (sum, row) => sum + Number(row?.gross_amount_cents || 0),
    0,
  );
  const net = orders
    .filter((row) => String(row?.status || "") === "paid")
    .reduce((sum, row) => sum + Number(row?.seller_net_cents || 0), 0);
  const pendingSettle = orders
    .filter((row) =>
      ["pending", "processing"].includes(String(row?.status || "")),
    )
    .reduce((sum, row) => sum + Number(row?.seller_net_cents || 0), 0);
  sellerMetrics.innerHTML = `
    <div class="stat-card"><div class="stat-label">${loginCopy("Gross sales")}</div><div class="stat-value">${formatUsdFromCents(gross, "$0.00")}</div></div>
    <div class="stat-card"><div class="stat-label">${loginCopy("Confirmed income")}</div><div class="stat-value">${formatUsdFromCents(net, "$0.00")}</div></div>
    <div class="stat-card"><div class="stat-label">${loginCopy("Pending settlement")}</div><div class="stat-value">${formatUsdFromCents(pendingSettle, "$0.00")}</div></div>
    <div class="stat-card"><div class="stat-label">${loginCopy("Mode")}</div><div class="stat-value">${escapeHtml(canOperateSeller ? loginCopy("Operator") : loginCopy("View only"))}</div></div>
  `;
  const payoutReminder = showPayoutReminder
    ? `
        <div class="works-note seller-payout-note">
          ${loginCopy(payoutReminderState?.message || "")}
          <button class="mini-btn ghost tiny" type="button" data-seller-connect ${canSetupPayout ? "" : "hidden"}>${escapeHtml(payoutAction.label)}</button>
        </div>
      `
    : "";
  const payoutManageAction =
    !showPayoutReminder && payoutAction.visible
      ? `
        <div class="works-note seller-payout-note">
          ${escapeHtml(loginCopy("Need to update your payout destination or review Stripe steps?"))}
          <button class="mini-btn ghost tiny" type="button" data-seller-connect ${canSetupPayout ? "" : "hidden"}>${escapeHtml(payoutAction.label)}</button>
        </div>
      `
      : "";
  sellerOrdersList.innerHTML = orders.length
    ? `${payoutReminder}${payoutManageAction}${!canOperateSeller ? `<div class="works-note">${loginCopy("Seller is currently in view-only mode. Operational actions stay in admin workflows.")}</div>` : ""}` +
      orders
        .slice(0, behavior.seller.ledger_limit)
        .map(
          (row) => `
        <div class="seller-item">
          <div class="seller-item-title">${escapeHtml(String(row?.order_kind || "order"))} · ${formatUsdFromCents(Number(row?.gross_amount_cents || 0), "$0.00")}</div>
          <div class="seller-item-meta">${escapeHtml(String(row?.status || ""))} · ${escapeHtml(formatDateTime(row?.created_at))}</div>
        </div>
      `,
        )
        .join("")
    : `${payoutReminder}${payoutManageAction}<div class="works-note">${loginCopy("No seller orders yet.")}</div>`;
  sellerLedgerList.innerHTML = ledgerEntries.length
    ? ledgerEntries
        .slice(0, behavior.seller.ledger_limit)
        .map(
          (row) => `
        <div class="seller-item">
          <div class="seller-item-title">${formatUsdFromCents(Number(row?.amount_cents || 0), "$0.00")}</div>
          <div class="seller-item-meta">${escapeHtml(String(row?.kind || row?.note || "entry"))} · ${escapeHtml(formatDateTime(row?.created_at))}</div>
        </div>
      `,
        )
        .join("")
    : `<div class="works-note">${loginCopy("No income entries yet.")}</div>`;
  sellerOrdersList
    .querySelector("[data-seller-connect]")
    ?.addEventListener("click", (event) => {
      event.stopPropagation();
      void startCreatorPayoutOnboarding(event.currentTarget);
    });
  if (!watchCommerceState.loaded && !watchCommerceState.loading) {
    void loadWatchCommerce().then(() => renderSellerPanel());
  }
}

async function loadPublicMarketWorks(force = false) {
  if (publicMarketState.loading) return publicMarketState.works;
  if (!force && publicMarketState.loaded) return publicMarketState.works;
  publicMarketState.loading = true;
  publicMarketState.error = null;
  publicMarketState.marketState = null;
  renderForyouMarketplace();
  try {
    // CSSOS_PHASE2_PROGRESSIVE_LOAD 20260505 — Jing
    // Start small (30) so first paint is fast on mobile; the scroll
    // handler bumps the limit by 30 each time the user reaches the
    // end of the loaded set, all the way up to the 1000 server cap.
    const fetchLimit = Math.max(30, Math.min(1000, Number(globalThis.__cssosMarketFetchLimit || 30)));
    const res = await fetch("/api/works/market?limit=" + fetchLimit, {
      credentials: "include",
    });
    const payload = await res.json().catch(() => null);
    const data = getApiData(payload);
    if (!res.ok || payload?.ok === false) {
      throw new Error(`market_load_failed:${res.status}`);
    }
    publicMarketState.works = Array.isArray(data?.works) ? data.works : [];
    publicMarketState.marketState =
      data?.market_state && typeof data.market_state === "object"
        ? data.market_state
        : null;
    publicMarketState.loaded = true;
    return publicMarketState.works;
  } catch (err) {
    publicMarketState.error = err;
    publicMarketState.works = [];
    publicMarketState.marketState = null;
    publicMarketState.loaded = false;
    return [];
  } finally {
    publicMarketState.loading = false;
    renderForyouMarketplace();
  }
}

function getPublicMarketEmptyCopy() {
  const reason = String(publicMarketState.marketState?.reason || "")
    .trim()
    .toLowerCase();
  if (reason === "empty_database") {
    return loginCopy(
      "This connected database is empty. No users or works have been imported yet.",
    );
  }
  if (reason === "no_published_works") {
    return loginCopy(
      "Works exist, but none have been published to the marketplace yet.",
    );
  }
  return loginCopy("No public works available yet.");
}

function buildMarketLoadingNoteMarkup() {
  return `<div class="works-note">${loginCopy("Loading marketplace...")}</div>`;
}

function buildMarketErrorNoteMarkup() {
  return `<div class="works-note">${loginCopy("Marketplace is temporarily unavailable. Please refresh and try again.")}</div>`;
}

function buildMarketEmptyNoteMarkup() {
  return `<div class="works-note">${getPublicMarketEmptyCopy()}</div>`;
}

function buildMarketSearchShellMarkup() {
  return `
    <div class="panel-search-shell foryou-search-shell">
      <div class="panel-search-meta">${loginCopy("Pull down to search the market")}</div>
      <div class="panel-search-row">
        <input id="foryou-market-search" class="panel-search-input" type="search" placeholder="${escapeHtml(loginCopy("Search title, style, owner..."))}" />
        <input id="foryou-market-author" class="panel-search-input panel-search-input--narrow" type="search" placeholder="${escapeHtml(loginCopy("Author"))}" />
        <select id="foryou-market-filter" class="panel-search-select">
          <option value="all">${loginCopy("All")}</option>
          <option value="single">${loginCopy("Single")}</option>
          <option value="triptych">${loginCopy("Triptych")}</option>
          <option value="opera">${loginCopy("Opera")}</option>
          <option value="owned">${loginCopy("Mine")}</option>
          <option value="public">${loginCopy("Others")}</option>
        </select>
        <select id="foryou-market-sort" class="panel-search-select">
          <option value="newest">${loginCopy("Newest")}</option>
          <option value="oldest">${loginCopy("Oldest")}</option>
          <option value="title">${loginCopy("Title")}</option>
          <option value="listen_low">${loginCopy("Low price")}</option>
          <option value="listen_high">${loginCopy("High price")}</option>
        </select>
        <select id="foryou-market-price" class="panel-search-select">
          <option value="all">${loginCopy("Any price")}</option>
          <option value="free">${loginCopy("Free")}</option>
          <option value="under_1">${loginCopy("Under $1")}</option>
          <option value="under_5">${loginCopy("Under $5")}</option>
          <option value="above_5">${loginCopy("Above $5")}</option>
        </select>
        <select id="foryou-market-time" class="panel-search-select">
          <option value="all">${loginCopy("Any time")}</option>
          <option value="day">${loginCopy("24h")}</option>
          <option value="week">${loginCopy("7 days")}</option>
          <option value="month">${loginCopy("30 days")}</option>
        </select>
        <span class="panel-search-count" id="foryou-market-count"></span>
      </div>
      <div class="panel-filter-bar" id="foryou-market-filter-bar"></div>
    </div>
  `;
}

function syncMarketCountLabel(countLabel) {
  if (!(countLabel instanceof HTMLElement)) return;
  countLabel.textContent = loginCopy(`10 per page`);
}

function bindMarketSearchControls() {
  const behavior = readPanelBehaviorSettingsLocal();
  // CSSOS_WAVE_113C 20260511 — Jing
  // "搜索是否真正可用?". The main #foryou-market-search input was
  // never bound to a re-render handler — typing in it had no effect.
  // Wire `oninput` here so the visible search bar actually filters.
  const searchInput = document.getElementById("foryou-market-search");
  const filterInput = document.getElementById("foryou-market-filter");
  const sortInput = document.getElementById("foryou-market-sort");
  const authorInput = document.getElementById("foryou-market-author");
  const priceInput = document.getElementById("foryou-market-price");
  const timeInput = document.getElementById("foryou-market-time");
  const filterBar = document.getElementById("foryou-market-filter-bar");
  if (filterInput)
    filterInput.value = String(
      filterInput.value || behavior.foryou.default_filter || "all",
    );
  if (sortInput)
    sortInput.value = String(
      sortInput.value || behavior.foryou.default_sort || "newest",
    );
  if (filterInput)
    filterInput.onchange = () =>
      renderForyouMarketplace({ resetVisible: true });
  if (sortInput)
    sortInput.onchange = () => renderForyouMarketplace({ resetVisible: true });
  // CSSOS_WAVE_113D 20260511 — Jing
  // Same fix as works-center: client-side filter can't reach works
  // beyond the progressively-loaded window. On first keystroke,
  // bump the fetch ceiling to the server cap (1000) and force one
  // full reload; subsequent keystrokes filter the corpus in-memory.
  const ensureMarketFullCorpusThenFilter = () => {
    if (Number(globalThis.__cssosMarketFetchLimit || 30) < 1000) {
      globalThis.__cssosMarketFetchLimit = 1000;
      void loadPublicMarketWorks(true).then(() => renderForyouMarketplace({ resetVisible: true }));
    } else {
      renderForyouMarketplace({ resetVisible: true });
    }
  };
  if (searchInput)
    searchInput.oninput = ensureMarketFullCorpusThenFilter;
  if (authorInput)
    authorInput.oninput = ensureMarketFullCorpusThenFilter;
  if (priceInput)
    priceInput.onchange = () => renderForyouMarketplace({ resetVisible: true });
  if (timeInput)
    timeInput.onchange = () => renderForyouMarketplace({ resetVisible: true });
  if (filterBar && !filterBar.dataset.boundClear) {
    filterBar.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const removeButton = event.target.closest(".panel-filter-pill-remove");
      if (removeButton) {
        const pill = removeButton.closest("[data-filter-key]");
        const key = String(pill?.getAttribute("data-filter-key") || "").trim();
        const defaults = readPanelBehaviorSettingsLocal().foryou;
        const map = {
          query: ["foryou-market-search", ""],
          author: ["foryou-market-author", ""],
          filter: ["foryou-market-filter", defaults.default_filter || "all"],
          sort: ["foryou-market-sort", defaults.default_sort || "newest"],
          price: ["foryou-market-price", "all"],
          time: ["foryou-market-time", "all"],
        };
        if (map[key]) {
          clearSingleSearchControl(map[key][0], map[key][1]);
          renderForyouMarketplace({ resetVisible: true });
        }
        return;
      }
      if (!event.target.closest(".panel-filter-clear")) return;
      clearSearchControls([
        "foryou-market-search",
        "foryou-market-author",
        "foryou-market-filter",
        "foryou-market-sort",
        "foryou-market-price",
        "foryou-market-time",
      ]);
      renderForyouMarketplace({ resetVisible: true });
    });
    filterBar.dataset.boundClear = "true";
  }
}

function ensureMarketSection(body) {
  if (!(body instanceof Element)) return null;
  let section = document.getElementById("foryou-market-section");
  if (section) return section;
  section = document.createElement("div");
  section.id = "foryou-market-section";
  section.className = "works-section";
  section.innerHTML = `
    <div class="section-title">${loginCopy("Marketplace")}</div>
    ${buildMarketSearchShellMarkup()}
    <div class="works-list" id="foryou-market-list">
      ${buildMarketLoadingNoteMarkup()}
    </div>
  `;
  body.appendChild(section);
  return section;
}

function ensureMarketSearchReveal(body, behavior) {
  if (!foryouPanel || !(body instanceof Element)) return;
  const ensurePullRevealSearchModule = globalThis.ensurePullRevealSearchModule;
  if (typeof ensurePullRevealSearchModule === "function") {
    ensurePullRevealSearchModule(foryouPanel, body, {
      enabled: behavior?.foryou?.search_enabled,
      placeholder: loginCopy(
        "Search title, style, owner...",
      ),
      hint: loginCopy(
        `Pull down to search · ${FORYOU_MARKET_PAGE_SIZE} per page`,
      ),
      value: document.getElementById("foryou-market-search")?.value || "",
      onInput: () => renderForyouMarketplace({ resetVisible: true }),
    });
  }
}

async function openMarketWorkPreview(work = {}) {
  /* CSSOS_SHARE_LINK_SINGLE_SOURCE 20260506 — Jing
   * "用户点击进来，好像要经过几道关卡，这个UUID好像也不是唯一真源,
   *  面板跳来跳去，最终播放了一个不是分享的那个标题的作品."
   *
   * Share-link openings (?cssMV=<id>) come in with __cssosShareLink:true
   * on the work. For those:
   *   - skip the structured-playback resolver (which can swap the work
   *     to a child leaf if work has children/scenes)
   *   - skip "scoped playlist seed from For You / Works Center"
   *   - skip the draft-hydration block (which would trigger a fresh
   *     pipeline run when final_mv_url is missing — wrong for share)
   *   - replace any existing playlist with a SINGLE-entry "share-link"
   *     list in loop_single mode so auto-advance can't hop to a sibling
   *
   * The UUID in the URL is the single source of truth: that exact work
   * plays, that exact title shows, nothing else. */
  const isShareLink = !!work?.__cssosShareLink;
  const playback = isShareLink
    ? { targetWork: work, queue: null }
    : resolveStructuredPlaybackRequestModule(work);
  const targetWork = playback.targetWork || work || null;
  currentWatchPreviewWork = targetWork;
  globalThis.cssosBindToWorkId?.(targetWork); // CSSOS_WAVE_121 Step 2
  // CSSOS_PHASE2_PLAYED_INDICATOR 20260504 — mark this work + its
  // siblings/children as played the moment a watch session opens for
  // them, so the unplayed-dot disappears immediately.
  try {
    const ids = new Set();
    const collect = (w) => {
      if (!w || typeof w !== "object") return;
      [w.work_id, w.id, w.local_id, w.requested_start_work_id, w.sibling_work_id, w.root_work_id]
        .filter(Boolean).forEach((v) => ids.add(String(v).trim()));
    };
    collect(targetWork);
    collect(work);
    if (Array.isArray(playback?.queue)) playback.queue.forEach(collect);
    ids.forEach((id) => globalThis.cssosMarkWorkPlayedModule?.(id));
  } catch (_e) {}
  // CSSOS_PHASE2_SCOPED_PLAYLIST 20260504 — Jing
  // Share-link branch: a single-entry list in loop_single mode so
  // auto-advance can't hop to a sibling. Bypasses the "scoped playlist
  // from panel" logic below.
  if (isShareLink) {
    try {
      const pl = globalThis.cssosPlaylists;
      if (pl && typeof pl.populate === "function") {
        pl.populate("share-link", [targetWork]);
        pl.setActive && pl.setActive("share-link");
        pl.setMode && pl.setMode("loop_single");
      }
    } catch (_e) {}
  }
  try {
    if (isShareLink) throw new Error("CSSOS_SHARE_LINK_SKIP_SCOPED_PLAYLIST");
    const pl = globalThis.cssosPlaylists;
    if (pl && typeof pl.populate === "function") {
      const source = String(work?.__cssosOpenedFrom || "").trim();
      const clickedId = String(targetWork?.id || targetWork?.work_id || "").trim();
      if (source === "for-you") {
        const visible = Array.isArray(globalThis.latestVisibleMarketWorks)
          ? globalThis.latestVisibleMarketWorks
          : (typeof latestVisibleMarketWorks !== "undefined" ? latestVisibleMarketWorks : []);
        pl.populate("for-you", visible);
        pl.setActive("for-you");
        if (clickedId) pl.seekTo(clickedId);
      } else if (source === "works-center") {
        const visible = Array.isArray(globalThis.latestResolvedWorksCollection)
          ? globalThis.latestResolvedWorksCollection
          : [];
        pl.populate("mine", visible);
        pl.setActive("mine");
        if (clickedId) pl.seekTo(clickedId);
      }
      // Default sensible mode for "play through everything once and loop".
      // Don't override if user already picked a non-default mode this session.
      if (pl.getMode && pl.getMode() === "sequential") {
        // sequential stops at end — we want continuous through the panel.
        pl.setMode("loop_all");
      }
    }
  } catch (_e) {}
  globalThis.currentStructuredWatchQueue = playback.queue;
  const sourceRunId = String(targetWork?.source_run_id || "").trim();
  if (sourceRunId) {
    currentWatchAudioRunId = sourceRunId;
  }
  // CSSOS_PHASE2_HYDRATE_LAST_RESULT 20260429 #169 — Jing
  // "出现在为你创作面板和作品中心面板的应该是完整的作品了，可是点击欣赏，
  //  启动Watch之后，又再重新从头开始输出歌词一整套流程？为什么现成的作品
  //  不播放却要重新输出一个新的呢？"
  //
  // When user clicks 欣赏 on a saved work, the work record already contains
  // final_mv_url + the original lyrics — there's nothing to regenerate.
  // Hydrate `cssmvPipelineLastResult` so every universal entry's freshness
  // short-circuit (#137) adopts THIS work's MV instead of kicking a new
  // pipeline run with random lyrics.
  try {
    const finalMvUrl =
      String(targetWork?.final_mv_url || targetWork?.preview_video_url || "").trim();
    // CSSOS_PHASE2_DRAFT_HYDRATION 20260430 #216 — Jing
    // "找回旧作品的歌词/脚本/音频/视频等完整的作品信息，如果缺少哪项就补上."
    // 498 of the user's saved works are pre-MV-pipeline drafts: they have
    // lyrics + cover but no audio/video. Without this branch, clicking
    // them triggered a fresh pipeline that generated RANDOM new lyrics —
    // losing the user's draft. Now: hydrate cssmvPipelineLastResult with
    // the SAVED lyrics + title + style + cover so the (eventual) re-run
    // inherits the draft's content. The next pipeline produces an MV of
    // THIS draft, not a stranger.
    if (!finalMvUrl && !isShareLink) {
      // Share-link guard: if we landed here from /?cssMV=<id> and the
      // server returned no final_mv_url (preview-only / guest), DO NOT
      // trigger the draft-hydration → pipeline-regen path. Show whatever
      // preview URL we have and stop. The cinema viewer is observing.
      const draftLyrics = String(targetWork?.lyrics_full || targetWork?.lyrics_preview || "").trim();
      const draftTitle = String(targetWork?.title || "").trim();
      const draftStyle = String(targetWork?.style || "").trim();
      const draftCover =
        String(targetWork?.cover_image_url || targetWork?.preview_image_url || targetWork?.cover_image || "").trim();
      if (draftLyrics || draftTitle) {
        // Lower freshMs (10 min) so the user can still click the wand to
        // re-roll lyrics if they want — but the pipeline auto-run that
        // happens on Watch open inherits this draft's content.
        globalThis.cssmvPipelineLastResult = {
          mvUrl: null,
          coverUrl: draftCover || null,
          title: draftTitle || null,
          lyrics: draftLyrics || null,
          style: draftStyle || null,
          runId: sourceRunId || null,
          tsAt: Date.now(),
          freshMs: 10 * 60 * 1000,
          source: "openMarketWorkPreview:draft"
        };
        // Push into pipeline panel state so it shows the draft when run.
        try {
          const pipelineState = globalThis.cssosMvPipelinePanelState
            ? globalThis.cssosMvPipelinePanelState()
            : null;
          if (pipelineState) {
            pipelineState.title = draftTitle;
            pipelineState.lyrics = (typeof globalThis.cssosNormalizeLyricsText === "function")
              ? globalThis.cssosNormalizeLyricsText(draftLyrics)
              : draftLyrics;
            pipelineState.style = draftStyle;
            pipelineState.coverUrl = draftCover;
            pipelineState.prompt = draftTitle || (draftLyrics.split("\n")[0] || "");
          }
        } catch (_e) { /* draft state hydration best-effort */ }
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(
            "Draft hydrated — your saved lyrics are loaded. Press Start Pipeline to render the MV."
          );
        }
      }
    }
    if (finalMvUrl) {
      const fullLyrics =
        String(targetWork?.lyrics_full || targetWork?.lyrics_preview || "").trim();
      // CSSOS_PHASE2_PERSIST_PLAYABLE 20260430 #214 — Jing
      // Hydrate audio_url + alt_audio_url + duration_secs + aligned_lyrics
      // so the Watch panel's Take 1/Take 2 toggle, duration overlay, and
      // synced subtitles all work for saved works without re-running the
      // pipeline. /api/works/mine now LEFT JOINs work_assets to surface
      // these.
      let audioUrl = String(targetWork?.audio_track_1_url || "").trim() || null;
      let altAudioUrl = String(targetWork?.audio_track_2_url || "").trim() || null;
      const subtitleUrl = String(targetWork?.subtitle_srt_url || "").trim() || null;
      const durationSecs = Number(targetWork?.duration_secs || 0) || null;
      // CSSOS_PHASE2_DUAL_TRACK 20260430 #221b — Jing
      // "用户欣赏第一首,右上角的胶囊要出现,也就是说,欣赏一首,
      //  另一首必须是下一首。如果是打开第二首,右上角胶囊也要显示
      //  第一首,也是要欣赏完两首,才会继续别的用户的作品."
      //
      // Sibling discovery: each take's row carries `sibling_work_id` in
      // its final_mv meta (pipeline_mv_api.rs writes both ways). When the
      // user opens Take 2's card directly, we won't have audio_track_2 in
      // the row's own assets (Take 2 stores only its own audio_track_1).
      // Fetch the sibling's asset URLs and synthesize altAudioUrl so the
      // toggle pill shows the other take regardless of which card the
      // user clicked.
      const siblingId = String(
        targetWork?.sibling_work_id || targetWork?.final_mv_meta?.sibling_work_id || ""
      ).trim();
      const takeIndex = Number(
        targetWork?.take_index || targetWork?.final_mv_meta?.take_index || 1
      );
      if (siblingId && (!altAudioUrl || takeIndex === 2)) {
        try {
          const sibRes = await fetch(`/api/works/${encodeURIComponent(siblingId)}`, {
            credentials: "include",
          });
          const sibPayload = await sibRes.json().catch(() => null);
          const sibling = sibPayload?.data?.work || sibPayload?.work || null;
          const sibAudio = String(
            sibling?.audio_track_1_url || sibling?.preview_audio_url || ""
          ).trim();
          if (sibAudio) {
            if (takeIndex === 2) {
              // Opening Take 2 — its own audio is "audio", and the
              // SIBLING (Take 1) supplies the alt slot. The toggle pill
              // will let the user flip back to Take 1 mid-watch.
              altAudioUrl = sibAudio;
            } else if (!altAudioUrl) {
              // Opening Take 1 but its row didn't have audio_track_2
              // (rare — older works); pull from sibling.
              altAudioUrl = sibAudio;
            }
          }
        } catch (_e) { /* sibling fetch best-effort */ }
      }
      globalThis.cssmvPipelineLastResult = {
        mvUrl: finalMvUrl,
        coverUrl: String(targetWork?.cover_image_url || targetWork?.preview_image_url || targetWork?.cover_image || "").trim() || null,
        title: String(targetWork?.title || "").trim() || null,
        lyrics: fullLyrics || null,
        runId: sourceRunId || null,
        audioUrl,
        altAudioUrl,
        subtitleUrl,
        durationSecs,
        alignedLyrics: targetWork?.aligned_lyrics || null,
        // CSSOS_PHASE2_HYDRATION_TTL 20260430 #215 — Jing
        // "高级设置面板的自定义歌词魔法棒又无法施展魔法了."
        // Previously freshMs was 24h, which silently hijacked every
        // lyrics-generate call for an entire day after clicking ANY saved
        // work. Cut it to 90s — long enough for the hydrated Watch panel
        // to play uninterrupted, short enough that a follow-up wand press
        // hits the LLM normally instead of replaying the saved lyrics.
        tsAt: Date.now(),
        freshMs: 90 * 1000,
        source: "openMarketWorkPreview"
      };
      // Push these into the pipeline panel state too so the Take 1/Take 2
      // toggle reappears after reload.
      try {
        const pipelineState = globalThis.cssosMvPipelinePanelState
          ? globalThis.cssosMvPipelinePanelState()
          : null;
        if (pipelineState) {
          pipelineState.mvUrl = finalMvUrl;
          pipelineState.audioUrl = audioUrl;
          pipelineState.altAudioUrl = altAudioUrl;
          pipelineState.duration = durationSecs || 0;
          // CSSOS_PHASE2_KARAOKE_LIVE 20260430 #199 — Jing
          // Propagate aligned_lyrics into pipelineState so the live
          // karaoke timeupdate handler (in app.watch-ui.js) can find
          // per-line timing without round-tripping through the SRT.
          pipelineState.alignedLyrics = targetWork?.aligned_lyrics || null;
          // CSSOS_PHASE2_SUBTITLE_FALLBACK 20260504 — Jing
          // "从作品中心进入 MV 面板，有时候显示字幕，大部分时候不显示".
          // Push subtitleUrl into pipelineState so the karaoke wire in
          // app.watch-ui.js can fall back to fetching+parsing the SRT
          // when aligned_lyrics is null. Older works persisted before
          // the aligned_lyrics column existed only have subtitle_srt_url.
          pipelineState.subtitleUrl = subtitleUrl || null;
          pipelineState.title = String(targetWork?.title || "").trim();
          pipelineState.lyrics = (typeof globalThis.cssosNormalizeLyricsText === "function")
            ? globalThis.cssosNormalizeLyricsText(fullLyrics || "")
            : (fullLyrics || "");
          // CSSOS_PHASE2_DUAL_TRACK 20260430 #221b — currentTake
          // reflects which row the user clicked: Take 1 row → 1, Take
          // 2 row → 2. Watch ended-handler tracks played takes per
          // session and only advances queue when both are consumed.
          pipelineState.currentTake = takeIndex === 2 ? 2 : 1;
          pipelineState.siblingWorkId = siblingId || null;
          // CSSOS_PHASE2_TAKE2_BACKSTOP_FIX 20260501 #245 — Jing
          // "总是只播放第一首，忽略第二首而播放下一对歌."
          // Without altDuration set, the take-switch backstop falls back
          // to a 60s minimum and prematurely advances mid-Take 2. Mirror
          // duration as a sane upper bound when alt_duration_secs isn't
          // present on the row (Suno takes are usually similar length).
          pipelineState.altDuration = Number(
            targetWork?.alt_duration_secs || durationSecs || 0
          ) || 0;
          // CSSOS_PHASE2_AUTHOR_AVATAR 20260501 #246 — propagate author
          // identity so the avatar widget can render initials / image
          // and the per-author playlist filter has an id to pivot on.
          pipelineState.ownerId = String(
            targetWork?.owner_id || targetWork?.user_id || ""
          ).trim();
          pipelineState.ownerName = String(
            targetWork?.owner_name || targetWork?.owner_email || "Creator"
          ).trim();
          pipelineState.ownerAvatarUrl = String(targetWork?.owner_avatar_url || "").trim();
          // CSSOS_PHASE2_DUAL_TRACK 20260430 #221b — pairKey for the
          // played-takes map. Use the LOWER of (workId, siblingWorkId)
          // so both takes resolve to the same key regardless of which
          // card the user opens first. Falls back to title when no
          // sibling exists (single-take engines like ElevenLabs).
          const ownId = String(targetWork?.id || targetWork?.work_id || "").trim();
          const siblingNorm = siblingId || "";
          const pairKey = ownId && siblingNorm
            ? [ownId, siblingNorm].sort().join("|")
            : ownId || (targetWork?.title || "");
          pipelineState.workId = pairKey;
        }
      } catch (_e) { /* state hydration best-effort */ }
    }
  } catch (_hydrationErr) { /* non-fatal */ }
  const seed = buildMarketPreviewSeed(targetWork);
  const previewUnlimited = canBypassPreviewLimit(authState.user, targetWork);
  await renderMarketWorkPreviewIntoWatchModule({
    work: targetWork,
    seed,
    previewUnlimited,
  });
  // CSSOS_PHASE2_DUAL_TRACK 20260430 #229 — Jing
  // "媒体框右上角的♪1 ♪2不显示了。请修复。用户切换到哪首（对）歌,
  //  就播放哪首（对）歌."
  // Re-inject the ♪1/♪2 toggle pill every time the user clicks a saved
  // work. The pipeline-panel injector reads from the live pipelineState
  // bridges, which we just hydrated above, so it'll find the right alt
  // URL + current take and render the pill in the watch frame.
  try {
    if (typeof globalThis.__cssosInjectTakeToggle === "function") {
      const ps = globalThis.cssosMvPipelinePanelState
        ? globalThis.cssosMvPipelinePanelState()
        : null;
      globalThis.__cssosInjectTakeToggle({
        altAudioUrl: ps?.altAudioUrl || null,
        currentTake: ps?.currentTake || 1,
      });
    }
  } catch (_e) { /* toggle inject best-effort */ }
  // CSSOS_PHASE2_TITLE_REFRESH 20260501 #244 / #264 — Jing
  // "标题里的标题变了，媒体框里的标题还是旧的，两个标题在打架."
  //
  // The karaoke overlay calls splitLyricsTitleAndBodyModule(title, lyrics)
  // — when the lyrics' first line still has the previous song's title
  // baked in (saved as a heading in the body), the splitter returns the
  // OLD first line as `titleLine` and the overlay shows it. So syncing
  // only state.title isn't enough — we MUST also update state.songSeed.lyrics
  // and watchLyricsEditor.value so the splitter has the new song's text
  // as its source.
  try {
    const newTitle = String(targetWork?.title || "").trim();
    const newLyrics = String(
      targetWork?.lyrics_full || targetWork?.lyrics_preview || ""
    ).trim();
    if (newTitle) {
      const ps = globalThis.cssosMvPipelinePanelState
        ? globalThis.cssosMvPipelinePanelState()
        : null;
      if (ps) {
        ps.title = newTitle;
        if (ps.songSeed && typeof ps.songSeed === "object") {
          ps.songSeed.title = newTitle;
          if (newLyrics) {
            ps.songSeed.lyrics = (typeof globalThis.cssosNormalizeLyricsText === "function")
              ? globalThis.cssosNormalizeLyricsText(newLyrics)
              : newLyrics;
          }
        } else {
          ps.songSeed = { title: newTitle, lyrics: newLyrics || "" };
        }
      }
      // Sync the watch lyrics editor so renderWatchKaraokeOverlayModule
      // (which reads watchLyricsEditor.value FIRST) picks up the new song.
      try {
        const editor = document.getElementById("watch-lyrics-editor")
          || document.querySelector(".watch-lyrics-editor");
        if (editor && newLyrics) {
          const norm = (typeof globalThis.cssosNormalizeLyricsText === "function")
            ? globalThis.cssosNormalizeLyricsText
            : (s) => s;
          editor.value = norm(newLyrics);
        }
      } catch (_e) {}
      // Also invalidate the karaoke timeline cache so the live tick
      // rebuilds from the new song's data.
      try {
        if (globalThis.watchKaraokeTimelineCache) {
          globalThis.watchKaraokeTimelineCache.runId = "";
          globalThis.watchKaraokeTimelineCache.data = null;
        }
      } catch (_e) {}
      // Hard-update visible title surfaces so we don't depend on a
      // re-render call missing one of them.
      const titleEls = document.querySelectorAll(
        "#watch-title-text, .watch-title-text, .watch-frame-title, #watch-frame-title"
      );
      titleEls.forEach((el) => { el.textContent = newTitle; });
      // CSSOS_PHASE2_TITLE_BAR_REFRESH 20260501 #254 — Jing
      // "标题还是第一对的标题."
      // The watch panel's title bar (#watch-panel .panel-title) shows
      // "WATCH · {TITLE} · {STATUS}". On queue advance, the title
      // segment didn't refresh (only the body / overlay did). Splice
      // the new title into whatever pattern is already there.
      // CSSOS_PHASE2_FULL_TITLE_SWAP 20260505 — Jing
      // "歌曲切换，如果标题有2+截，下一首歌的标题只切换前面一截而已…
      //  请改进，换标题就全部换". Old logic split on · and only
      //  replaced parts[1], so a song whose own title contained ·
      //  ("长相思 · 夜雨亡国辞" → ["WATCH","长相思","夜雨亡国辞"])
      //  left the trailing 夜雨亡国辞 dangling on the next song.
      //  Now we keep ONLY the brand prefix (parts[0], typically
      //  "WATCH"/"Watch") and append the new title — anything after
      //  is dropped wholesale, regardless of how many · the old
      //  title had baked in.
      try {
        const panelTitle = document.querySelector("#watch-panel .panel-title");
        if (panelTitle) {
          const cur = String(panelTitle.textContent || "").trim();
          let brandPrefix = "Watch";
          if (cur && cur.includes("·")) {
            const firstSep = cur.indexOf("·");
            brandPrefix = cur.slice(0, firstSep).trim() || brandPrefix;
          }
          panelTitle.textContent = `${brandPrefix} · ${newTitle}`;
        }
      } catch (_e) {}
      // Re-render the karaoke overlay so the title typography (font,
      // stroke, layout) repaints with the new text.
      if (typeof globalThis.renderWatchKaraokeOverlayModule === "function") {
        globalThis.renderWatchKaraokeOverlayModule();
      }
      // CSSOS_PHASE2_MV_ART_TITLE_REFRESH 20260503 — Jing
      // "切换歌曲时媒体框里的字幕标题永远不变."
      // The big in-frame title overlay (.cssmv-mv-title) lives in
      // app.watch-media-overlays.js and only re-renders when explicitly
      // told to. The queue-advance/card-click path was updating the
      // text-line title surfaces and the karaoke overlay but never
      // poking the art-title overlay, so the FIRST song's title froze
      // on screen for the rest of the session.
      if (typeof globalThis.cssmvRenderMvArtTitle === "function" && newTitle) {
        try { globalThis.cssmvRenderMvArtTitle(newTitle); } catch (_e) {}
      }
      // Refresh author avatar widget (owner ID / name may have changed).
      if (typeof globalThis.__cssosRefreshAuthorAvatar === "function") {
        globalThis.__cssosRefreshAuthorAvatar();
      }
    }
  } catch (_e) {}
  // CSSOS_PHASE2_PRESERVE_ASPECT 20260430 #235 — Jing
  // "第一次播放也是这种格式，可是第二次再去播放的时候，全部变成了16:9.
  //  请修复，不要fallback回到16:9，输出时是什么就保持什么."
  // Clear the previous work's source-aspect tag so the new work's video
  // metadata can re-shape the frame. Then trigger the dimension read.
  try {
    const frame = document.querySelector("#watch-panel .watch-frame");
    if (frame) delete frame.dataset.sourceAspect;
    if (typeof globalThis.applyVideoSourceAspectModule === "function") {
      globalThis.applyVideoSourceAspectModule();
    }
  } catch (_e) {}
  // CSSOS_PHASE2_AUTO_ADVANCE 20260430 #231 — Jing
  // "随便点击播放一首歌，播放完毕，没有自动播放下一首. 请修复."
  // Schedule an absolute-time backstop the moment the user opens a work.
  // If the media chain stalls (autoplay-blocked Take 2, missing audio
  // assets on legacy works, video.ended never firing on a loaded-but-
  // not-played video), this still advances to the next song.
  try {
    const sched = globalThis.__cssosScheduleAutoAdvanceBackstop;
    if (typeof sched === "function") {
      const dur = Number(targetWork?.duration_secs || 0);
      const altDur = Number(targetWork?.alt_duration_secs || dur || 0);
      const total = (dur > 0 ? dur : 0) + (altDur > 0 ? altDur : 0);
      sched(total > 0 ? total : 240);
    }
  } catch (_e) {}
  // CSSOS_PHASE2_DUAL_TRACK 20260430 #228 — Jing
  // "自动播放完毕之后，也要自动播放'为你创作'面板接下来个作品,
  //  也就是说，从最新到最旧自动播放."
  //
  // After both takes of THIS work finish playing, the watch ended-handler
  // calls watchQueueAdvanceModule(+1) which walks __cssosWatchQueue.items.
  // For that walk to chronologically continue from the clicked work, we
  // sync the queue's cursor to wherever this work sits in the queue. If
  // the clicked work isn't in the queue yet (older than the prefetched
  // page), we fetch more pages until we find it OR the self-scope is
  // exhausted (then the queue advance falls through to others' works).
  try {
    const targetId = String(targetWork?.id || targetWork?.work_id || "").trim();
    if (targetId && globalThis.cssosWatchQueuePrefetch) {
      const q = globalThis.__cssosWatchQueue;
      if (q && Array.isArray(q.items)) {
        const findIdx = () => q.items.findIndex((it) => String(it?.id || "") === targetId);
        let idx = findIdx();
        // Pull additional pages up to a sensible cap if the work isn't
        // in the prefetched window.
        let pages = 0;
        while (idx < 0 && !q.exhausted && pages < 8) {
          await globalThis.cssosWatchQueuePrefetch();
          idx = findIdx();
          pages += 1;
        }
        if (idx >= 0) {
          q.index = idx;
        }
      }
    }
  } catch (_e) { /* queue-sync best-effort */ }
  // CSSOS_PHASE2_PLAYLIST_SOURCE 20260501 #245 — Jing
  // "如果这首歌是自己的，比如从'作品中心'开始播放的，那就默认从新到旧
  //  循环播放自己'作品中心'面板的音乐列表（只播自己的作品）...
  //  如果这首歌是别人的，比如从'为你创作'面板开始播放的，那就默认从新到旧
  //  循环播放'为你创作'面板的音乐列表（播放所有用户的作品，包括自己的）..."
  //
  // Source resolution priority:
  //   1. Explicit options.source ('mine' | 'for-you' | author id) wins —
  //      callers from each panel pass this directly.
  //   2. Custom list active → leave alone, the user is in their list.
  //   3. Robust ownership: targetWork.is_own OR (owner_id == authState.user.id).
  //      Defends against missing is_own flag on legacy rows.
  //   4. Fallback: own → "mine", other → "for-you".
  // Mode (loop_all / sequential / reverse / shuffle) is preserved across
  // list switches so a user who picked shuffle stays shuffled.
  try {
    const pl = globalThis.cssosPlaylists;
    if (pl) {
      const targetWorkLocal = targetWork || {};
      const explicitSource = String(options?.source || work?.__source || "").trim();
      const ownerId = String(
        targetWorkLocal?.owner_id ||
        targetWorkLocal?.user_id ||
        ""
      ).trim();
      const viewerId = String(authState?.user?.id || "").trim();
      const isOwn =
        targetWorkLocal?.is_own === true ||
        (viewerId && ownerId && viewerId === ownerId);
      const activeId = pl.getActive()?.id || "";
      const isCustom = activeId.startsWith("custom-");
      let desired = activeId;
      if (explicitSource) {
        desired = explicitSource;
      } else if (!isCustom) {
        desired = isOwn ? "mine" : "for-you";
      }
      if (desired !== activeId && pl.lists().some((l) => l.id === desired)) {
        pl.setActive(desired);
        console.warn(
          "[playlist] source-aware switch → %s (was %s, isOwn=%s, ownerMatch=%s)",
          desired, activeId, String(isOwn), ownerId === viewerId
        );
      }
      const wid = String(targetWorkLocal?.id || targetWorkLocal?.work_id || "").trim();
      if (wid) {
        const ok = pl.seekTo(wid);
        if (!ok) {
          await pl.refresh().catch(() => {});
          pl.seekTo(wid);
        }
      }
    }
  } catch (_e) {}
  // CSSOS_PHASE2_PREVIEW_CAP 20260430 #240 — REMOVED 20260506 — Jing
  // The old 30s setTimeout + toast + playlist-advance lived here and
  // was pre-empting the new tier-aware paywall overlay built in
  // app.preview-cap.js (which reads X-Preview-Limit-Seconds from the
  // signed media URL and shows login/subscribe/buy buttons with a
  // 10s auto-advance countdown). Clear any in-flight legacy timer so
  // a stale schedule from before this deploy doesn't fire.
  try { clearTimeout(globalThis.__cssosPreviewCapId); } catch (_e) {}
  delete globalThis.__cssosPreviewCapId;
  // CSSOS_PHASE2_AUDIO_PRIME_ON_OPEN 20260430 #238 — Jing
  // "自动进入第2首歌，但是静音播放？为什么不继续有声播放呢？"
  //
  // Root cause: when the user first opens a work, the video plays
  // unmuted (with Take 1 audio baked in), but the <audio> element is
  // never primed by a user gesture. When Take 1 ends → onMediaEnded →
  // switchToTake(2) → mutes video + sets audio.src + audio.play() —
  // but the autoplay policy treats this as a fresh first-play because
  // <audio> was never user-activated. play() is rejected silently and
  // both elements end up muted.
  //
  // Fix: route Take 1 through the <audio> element from the very start.
  // The card click (this very call stack) IS a user gesture, so
  // audio.play() succeeds and registers the element as user-activated
  // for the rest of the session. Then on take 2 swap, just changing
  // audio.src + calling play() works without policy interference.
  try {
    const audioEl = document.getElementById("watch-audio-preview");
    const videoEl = document.getElementById("watch-video");
    const ps = globalThis.cssosMvPipelinePanelState
      ? globalThis.cssosMvPipelinePanelState()
      : null;
    const audioUrl = String(ps?.audioUrl || "").trim();
    if (audioEl && audioUrl) {
      // CSSOS_PHASE2_NEXT_PAIR_UNMUTED 20260501 #262 — Jing
      // "下一对歌曲还是被静音，请修复为开启."
      // Prime <audio> SILENTLY (muted) so it's user-activated for the
      // future Take 2 swap. Don't unmute it here — and especially don't
      // mute the video. Video plays Take 1 baked-in audio = next pair
      // arrives audible immediately.
      audioEl.src = audioUrl;
      audioEl.muted = true;
      audioEl.load && audioEl.load();
      if (audioEl.play) {
        audioEl.play().catch(() => { /* silent prime; video has sound */ });
      }
      // Keep video unmuted — its baked-in audio is the actual sound
      // source for Take 1 / standard playback.
      if (videoEl) videoEl.muted = false;
    }
  } catch (_primeErr) { /* prime best-effort */ }
  // CSSOS_PHASE2_AUTO_FULLSCREEN_ON_PLAY 20260501 #264 — Jing
  // "播放媒体时，请帮用户点击一下媒体框右下角的全屏按钮，进入真正全屏，
  //  即媒体左右撑满屏幕左右边缘.谢谢."
  //
  // We're inside the click-handler chain (openMarketWorkPreview was
  // called from a card click / queue advance triggered by a tap), so
  // requestFullscreen is allowed by the user-activation gate. Target
  // the watch frame so chrome/title overlay come along; if that's
  // blocked (Safari quirks), fall back to the <video> element using
  // webkitEnterFullscreen which works on iOS too.
  //
  // Respect three opt-outs:
  //   • document.fullscreenElement already set → already fullscreen
  //   • localStorage('cssos:noAutoFullscreen') === '1' → user disabled
  //   • The opening was a programmatic queue-advance with
  //     options.skipFullscreen (set by silent prefetch paths).
  try {
    const skip = options && options.skipFullscreen === true;
    const userOptOut = (() => {
      try { return localStorage.getItem("cssos:noAutoFullscreen") === "1"; }
      catch (_e) { return false; }
    })();
    if (!skip && !userOptOut && !document.fullscreenElement
        && !document.webkitFullscreenElement) {
      const frame = document.querySelector("#watch-panel .watch-frame")
        || document.getElementById("watch-frame");
      const videoEl = document.getElementById("watch-video");
      // Prefer the frame so the title overlay + author avatar come along.
      // If the frame's request is rejected, try the bare video element
      // (useful on iOS where webkitEnterFullscreen lives on <video>).
      const tryFs = (el) => {
        if (!el) return false;
        const fn = el.requestFullscreen
          || el.webkitRequestFullscreen
          || el.webkitEnterFullscreen
          || el.mozRequestFullScreen
          || el.msRequestFullscreen;
        if (!fn) return false;
        try {
          const result = fn.call(el);
          if (result && typeof result.catch === "function") {
            result.catch(() => {
              // First choice failed (often Safari frame-not-allowed).
              // Fall through to video element on next try.
              if (el !== videoEl && videoEl) tryFs(videoEl);
            });
          }
          return true;
        } catch (_e) { return false; }
      };
      const ok = tryFs(frame);
      if (!ok && videoEl) tryFs(videoEl);
    }
  } catch (_fsErr) { /* auto-fullscreen best-effort */ }
}

// CSSOS_PHASE2_FULL_SWAP_ON_NAV 20260430 #236 — Jing
// "切换歌的时候，只是切换视频而已，音频还是旧的，连标题也是旧的，
//  歌词也是旧的。应该全部切换."
// Expose openMarketWorkPreview so the watch queue's swipe/wheel/key
// advance path can re-run the FULL render flow (cover, title overlay,
// lyrics editor, seed preview, take toggle, audio + video, watchPanel
// state) instead of doing a partial swap. The same async work shape is
// fed in — for a /cssapi/v1/mv item or a /api/works/mine row — both
// resolve through resolveStructuredPlaybackRequestModule and end up
// calling renderMarketWorkPreviewIntoWatchModule.
try {
  globalThis.openMarketWorkPreview = openMarketWorkPreview;
} catch (_e) {}

function getStructuredWorkNodeIdModule(work = {}) {
  return String(work?.work_id || work?.id || work?.local_id || "").trim();
}

function sortStructuredChildrenForPlaybackModule(children = []) {
  return [...(Array.isArray(children) ? children : [])].sort((left, right) => {
    const leftTime = Date.parse(String(left?.updated_at || left?.created_at || "")) || 0;
    const rightTime = Date.parse(String(right?.updated_at || right?.created_at || "")) || 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    const seqDelta = Number(right?.sequence_index || 0) - Number(left?.sequence_index || 0);
    if (seqDelta !== 0) return seqDelta;
    return String(right?.title || "").localeCompare(String(left?.title || ""));
  });
}

function flattenStructuredPlaybackLeavesModule(work = {}) {
  const normalizedType = normalizeWorkTypeClient(work?.work_type);
  const role = String(work?.structure_role || normalizedType || "").trim().toLowerCase();
  const children = sortStructuredChildrenForPlaybackModule(resolveRenderableWorkChildren(work));
  if (!children.length) return [work].filter(Boolean);
  if (!["opera", "triptych", "act", "part"].includes(role) && normalizedType !== "opera" && normalizedType !== "triptych") {
    return [work].filter(Boolean);
  }
  return children.flatMap((child) => flattenStructuredPlaybackLeavesModule(child));
}

function resolveStructuredPlaybackRequestModule(work = {}) {
  const rootWork = work || {};
  const requestedStartId =
    String(rootWork?.requested_start_work_id || rootWork?.activeChildWorkId || "").trim();
  const leaves = flattenStructuredPlaybackLeavesModule(rootWork).filter(
    (item) => getStructuredWorkNodeIdModule(item),
  );
  if (!leaves.length) {
    return { targetWork: rootWork, queue: null };
  }
  const startIndex = requestedStartId
    ? Math.max(
        0,
        leaves.findIndex((item) => getStructuredWorkNodeIdModule(item) === requestedStartId),
      )
    : 0;
  const safeStartIndex = startIndex >= 0 ? startIndex : 0;
  const queueItems = leaves.slice(safeStartIndex);
  const rootId = getStructuredWorkNodeIdModule(rootWork);
  return {
    targetWork: queueItems[0] || rootWork,
    queue: queueItems.length > 1 || getStructuredWorkNodeIdModule(queueItems[0]) !== rootId
      ? {
          rootWork: { ...(rootWork || {}) },
          items: queueItems.map((item) => ({ ...(item || {}) })),
          index: 0,
        }
      : null,
  };
}

function findRootWorkForPlaybackModule(works = [], targetWorkId = "") {
  const safeWorks = Array.isArray(works) ? works : [];
  const targetId = String(targetWorkId || "").trim();
  if (!targetId) return null;
  return (
    safeWorks.find((work) => {
      const rootId = getStructuredWorkNodeIdModule(work);
      if (rootId === targetId) return true;
      return flattenStructuredPlaybackLeavesModule(work).some(
        (leaf) => getStructuredWorkNodeIdModule(leaf) === targetId,
      );
    }) || null
  );
}

async function advanceStructuredWorkPlaybackModule() {
  const queue = globalThis.currentStructuredWatchQueue;
  if (!queue || !Array.isArray(queue.items) || queue.items.length < 2) return false;
  const nextIndex = Number(queue.index || 0) + 1;
  const nextWork = queue.items[nextIndex];
  if (!nextWork) {
    globalThis.currentStructuredWatchQueue = null;
    return false;
  }
  globalThis.currentStructuredWatchQueue = {
    ...queue,
    index: nextIndex,
  };
  currentWatchPreviewWork = { ...(nextWork || {}) };
  globalThis.cssosBindToWorkId?.(currentWatchPreviewWork); // CSSOS_WAVE_121 Step 2
  const sourceRunId = String(nextWork?.source_run_id || "").trim();
  if (sourceRunId) currentWatchAudioRunId = sourceRunId;
  await renderMarketWorkPreviewIntoWatchModule({
    work: nextWork,
    seed: buildMarketPreviewSeed(nextWork),
    previewUnlimited: canBypassPreviewLimit(authState.user, nextWork),
  });
  return true;
}

/* CSSOS_FORYOU_CLOSE_FIX 20260507 — Jing
 * "为你创作 panel close button doesn't work, total fish-net escape".
 * Same root cause as subscription-panel: the shared panel-bar handler
 * binds via dataset.panelBarActionsBound on init; for hidden-at-init
 * panels (foryou starts with .hidden) the binding can drift. Defensive
 * direct binding by aria-label survives all edge cases. */
function ensureForyouPanelBarBindings(panel) {
  if (!(panel instanceof HTMLElement)) return;
  if (panel.dataset.cssosFyBarBound === "1") return;
  panel.dataset.cssosFyBarBound = "1";
  const actions = panel.querySelector(".panel-actions");
  if (!actions) return;
  const byLabel = (label) => Array.from(actions.querySelectorAll(".icon-btn"))
    .find((b) => String(b.getAttribute("aria-label") || "").trim().toLowerCase() === label);
  const closeBtn = byLabel("close");
  const minBtn = byLabel("minimize");
  const maxBtn = byLabel("maximize");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof globalThis.minimizeToDockBridge === "function") {
        globalThis.minimizeToDockBridge(panel);
      } else {
        panel.classList.add("hidden");
        panel.dataset.minimized = "true";
      }
    });
  }
  if (minBtn) {
    minBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof globalThis.togglePanelCollapse === "function") {
        globalThis.togglePanelCollapse(panel);
      }
    });
  }
  if (maxBtn) {
    maxBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof globalThis.togglePanelMaximize === "function") {
        globalThis.togglePanelMaximize(panel);
      }
    });
  }
}

function renderForyouMarketplace(options = {}) {
  if (!foryouPanel) return;
  ensureForyouPanelBarBindings(foryouPanel);
  const body = foryouPanel.querySelector(".panel-body");
  if (!body) return;
  const behavior = readPanelBehaviorSettingsLocal();
  ensureMarketSection(body);
  ensureMarketSearchReveal(body, behavior);
  ensureForyouInfinitePaging();
  bindMarketSearchControls();
  const list = document.getElementById("foryou-market-list");
  const countLabel = document.getElementById("foryou-market-count");
  if (!list) return;
  if (publicMarketState.loading && !publicMarketState.loaded) {
    list.innerHTML = buildMarketLoadingNoteMarkup();
    return;
  }
  if (publicMarketState.error && !publicMarketState.loaded) {
    list.innerHTML = buildMarketErrorNoteMarkup();
    return;
  }
  if (options?.resetVisible !== false) {
    foryouMarketVisibleCount = FORYOU_MARKET_PAGE_SIZE;
  }
  const marketViewOptions = readMarketListViewOptions();
  syncMarketFilterPills(marketViewOptions);
  // CSSOS_PHASE2_ADMIN_PUBLIC_WORK 20260504 — Jing clarification:
  // "肯定要显示的，而且还是免费显示，免费聆听，免费欣赏的，但不能
  //  买断。因为这属于公共作品，系统作品". Admin works DO appear in
  // the marketplace — they're free public works the platform offers.
  // The only difference is transactional: no listen-fee, no buyout,
  // no tip — handled per-card in buildMarketCardsMarkup below.
  const works = buildVisibleMarketWorks(
    publicMarketState.works,
    marketViewOptions,
  );
  latestVisibleMarketWorks = Array.isArray(works) ? works : [];
  // Expose for the playlist scoping in openMarketWorkPreview.
  globalThis.latestVisibleMarketWorks = latestVisibleMarketWorks;
  syncMarketCountLabel(countLabel);
  if (!works.length) {
    list.innerHTML = buildMarketEmptyNoteMarkup();
    return;
  }
  const pageWorks = works.slice(0, foryouMarketVisibleCount);
  /* CSSOS_NO_REFLOW_PAGING 20260506 — Jing
   * Same fix as works-center: avoid wiping list.innerHTML on every
   * page-add (which scrolled the user back to the top). Detect a
   * pure append (head matches by work-id) and only insert the new
   * tail; full rebuild reserved for sort/filter changes. */
  const prevRendered = Number(list.dataset.renderedCount || 0);
  const resultsContainer = list.querySelector(".works-list-results");
  const headMatches = (() => {
    if (!resultsContainer || prevRendered <= 0) return false;
    if (pageWorks.length <= prevRendered) return false;
    const cards = resultsContainer.children;
    if (cards.length !== prevRendered) return false;
    for (let i = 0; i < Math.min(8, prevRendered); i++) {
      const expected = String((pageWorks[i] && (pageWorks[i].id || pageWorks[i].work_id)) || "");
      const actual = String((cards[i] && cards[i].dataset && cards[i].dataset.workId) || "");
      if (expected && actual && expected !== actual) return false;
    }
    return true;
  })();
  if (headMatches && resultsContainer) {
    const tail = pageWorks.slice(prevRendered);
    const tmp = document.createElement("div");
    tmp.innerHTML = buildMarketCardsMarkup(tail);
    while (tmp.firstChild) resultsContainer.appendChild(tmp.firstChild);
    const footerNote = list.querySelector(".works-list-footer .works-note");
    if (footerNote) {
      footerNote.textContent = loginCopy(`Showing ${pageWorks.length} of ${works.length} works`);
    }
    list.dataset.renderedCount = String(pageWorks.length);
    void hydrateMarketCardThumbnails(list, tail);
    bindMarketCardExpandToggle(resultsContainer);
    bindMarketCardActionButtons(resultsContainer, tail);
    return;
  }
  list.innerHTML = `
    <div class="works-list-results">${buildMarketCardsMarkup(pageWorks)}</div>
    <div class="works-list-footer">
      <div class="works-note">${escapeHtml(loginCopy(`Showing ${pageWorks.length} of ${works.length} works`))}</div>
    </div>
  `;
  list.dataset.renderedCount = String(pageWorks.length);
  void hydrateMarketCardThumbnails(list, pageWorks);
  bindMarketCardExpandToggle(list);
  bindMarketCardActionButtons(list, pageWorks);
}

function readMarketListViewOptions() {
  const behavior = readPanelBehaviorSettingsLocal();
  return {
    query: String(document.getElementById("foryou-market-search")?.value || "")
      .trim()
      .toLowerCase(),
    authorQuery: String(
      document.getElementById("foryou-market-author")?.value || "",
    )
      .trim()
      .toLowerCase(),
    filterMode: String(
      document.getElementById("foryou-market-filter")?.value ||
        behavior.foryou.default_filter ||
        "all",
    ),
    sortMode: String(
      document.getElementById("foryou-market-sort")?.value ||
        behavior.foryou.default_sort ||
        "newest",
    ),
    priceMode: String(
      document.getElementById("foryou-market-price")?.value || "all",
    ),
    timeMode: String(
      document.getElementById("foryou-market-time")?.value || "all",
    ),
  };
}

function syncMarketFilterPills(options = {}) {
  const filterMode = String(options.filterMode || "all");
  const sortMode = String(options.sortMode || "newest");
  const priceMode = String(options.priceMode || "all");
  const timeMode = String(options.timeMode || "all");
  renderSearchFilterPills(document.getElementById("foryou-market-filter-bar"), {
    query: String(options.query || ""),
    author: String(options.authorQuery || ""),
    filterLabel: {
      all: loginCopy("All"),
      single: loginCopy("Single"),
      triptych: loginCopy("Triptych"),
      opera: loginCopy("Opera"),
      owned: loginCopy("Mine"),
      public: loginCopy("Others"),
    }[filterMode],
    sortLabel: {
      newest: loginCopy("Newest"),
      oldest: loginCopy("Oldest"),
      title: loginCopy("Title"),
      listen_low: loginCopy("Low price"),
      listen_high: loginCopy("High price"),
    }[sortMode],
    priceLabel: {
      all: "",
      free: loginCopy("Free"),
      under_1: loginCopy("Under $1"),
      under_5: loginCopy("Under $5"),
      above_5: loginCopy("Above $5"),
    }[priceMode],
    timeLabel: {
      all: "",
      day: loginCopy("24h"),
      week: loginCopy("7 days"),
      month: loginCopy("30 days"),
    }[timeMode],
  });
}

function buildVisibleMarketWorks(sourceWorks = [], options = {}) {
  const works = Array.isArray(sourceWorks) ? sourceWorks : [];
  const query = String(options.query || "")
    .trim()
    .toLowerCase();
  const authorQuery = String(options.authorQuery || "")
    .trim()
    .toLowerCase();
  const filterMode = String(options.filterMode || "all");
  const sortMode = String(options.sortMode || "newest");
  const priceMode = String(options.priceMode || "all");
  const timeMode = String(options.timeMode || "all");
  return sortWorkCollection(
    filterWorkCollection(
      works.filter((work) => {
        if (!query) return true;
        const haystack = [
          work?.title,
          work?.style,
          work?.lyrics_text,
          work?.lyrics_preview,
          work?.owner_name,
          work?.owner_handle,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join("\n");
        return haystack.includes(query);
      }),
      filterMode,
    ),
    sortMode,
  )
    .filter((work) => {
      if (!authorQuery) return true;
      const haystack = [work?.owner_name, work?.owner_email, work?.owner_handle]
        .map((value) => String(value || "").toLowerCase())
        .join("\n");
      return haystack.includes(authorQuery);
    })
    .filter((work) => {
      const cents = Number(
        work?.current_listen_price_cents || work?.listen_price_cents || 0,
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

function looksLikeVisualPromptSummaryForWorks(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const commaCount = (raw.match(/,/g) || []).length;
  const promptishTokens = [
    "android",
    "heroine",
    "neon",
    "memory loop",
    "metallic",
    "couture",
    "desert",
    "temple",
    "ballroom",
    "control room",
    "mist",
    "horizon",
    "warrior",
    "finale",
    "moonlit",
    "mirrored",
    "opera,",
  ];
  if (promptishTokens.some((token) => lower.includes(token)) && commaCount >= 3) {
    return true;
  }
  return (
    lower.includes("camera:") ||
    lower.includes("lighting:") ||
    lower.includes("environment:") ||
    lower.includes("shot brief") ||
    lower.includes("visual role") ||
    lower.includes("directing goals") ||
    lower.includes("bars:") ||
    lower.includes("focus:") ||
    lower.includes("energy:")
  );
}

function resolveWorkLyricsTextForDisplay(work = {}) {
  const candidates = [
    work?.lyrics_text,
    work?.lyrics_preview,
    work?.lyrics,
    work?.creative?.lyric_versions?.zh,
  ];
  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (!text) continue;
    if (looksLikeVisualPromptSummaryForWorks(text)) continue;
    return text;
  }
  return "";
}

function buildDisplayLyricsPreviewText(work = {}) {
  const text = resolveWorkLyricsTextForDisplay(work);
  if (!text) return "";
  return text;
}

function ensureForyouInfinitePaging() {
  if (foryouMarketAutoPagingBound || !(foryouPanel instanceof HTMLElement))
    return;
  const body = foryouPanel.querySelector(".panel-body");
  if (!(body instanceof HTMLElement)) return;
  // CSSOS_PHASE2_NO_REFETCH_ON_SCROLL 20260504 — same fix as Works
  // Center: debounce scroll-driven load-more so rapid flicks don't
  // pile up dozens of re-renders + thumbnail re-hydrations in 1s.
  let scrollDebounce = null;
  const tryLoadMore = () => {
    // CSSOS_PHASE2_PROGRESSIVE_LOAD 20260505 — same two-case logic
    // as Works Center: expand the local slice first, then bump the
    // server fetch limit if local cache is exhausted.
    const have = latestVisibleMarketWorks.length;
    if (have > foryouMarketVisibleCount) {
      const remaining = have - foryouMarketVisibleCount;
      foryouMarketVisibleCount += Math.min(FORYOU_MARKET_PAGE_SIZE, remaining);
      renderForyouMarketplace({ resetVisible: false });
      return;
    }
    const lastFetched = Number(globalThis.__cssosMarketFetchLimit || 30);
    if (have >= lastFetched) {
      globalThis.__cssosMarketFetchLimit = Math.min(1000, lastFetched + 30);
      foryouMarketVisibleCount += FORYOU_MARKET_PAGE_SIZE;
      void loadPublicMarketWorks(true).then(() => renderForyouMarketplace({ resetVisible: false }));
    }
  };
  body.addEventListener(
    "scroll",
    () => {
      const threshold = 120;
      if (body.scrollTop + body.clientHeight < body.scrollHeight - threshold)
        return;
      if (scrollDebounce) return;
      scrollDebounce = setTimeout(() => {
        scrollDebounce = null;
        tryLoadMore();
      }, 150);
    },
    { passive: true },
  );
  foryouMarketAutoPagingBound = true;
}

function buildMarketCardsMarkup(works = []) {
  if (!Array.isArray(works) || !works.length) return "";
  return works
    .map((work) => {
      const workId = String(work?.id || work?.work_id || "").trim();
      const rawTitle =
        String(work?.title || "").trim() || loginCopy("Untitled");
      const title = escapeHtml(rawTitle);
      const style = escapeHtml(
        String(work?.style || "").trim() ||
          loginCopy("Style not set"),
      );
      const workType = normalizeWorkTypeClient(work?.work_type);
      const preview = escapeHtml(
        buildDisplayLyricsPreviewText(work) || rawTitle,
      );
      const createdAt = work?.created_at
        ? new Date(work.created_at).toLocaleString()
        : "";
      const coverImage =
        globalThis.resolveWorkCardThumbnailImageModule?.(work) ||
        resolveWorkCoverImage(work);
      const listenCents = Number(
        work?.current_listen_price_cents || work?.listen_price_cents || 0,
      );
      // CSSOS_PHASE2_NO_JUDGE_AS_PLAYER 20260501 #266 — Jing
      // "聆听权/观赏权为'免费'，买断权中文为'无价之宝'."
      // is_priceless / owner_is_admin are surfaced by the backend's
      // normalizeWorkTreeRow for any work owned by a cssOS staff
      // account. Show "Free" / "Priceless" instead of dollar amounts.
      const isPricelessAdminWork = Boolean(
        work?.is_priceless || work?.owner_is_admin,
      );
      const listenPrice = isPricelessAdminWork
        ? loginCopy("Free", "免费")
        : formatUsdFromCents(listenCents, "$0.00");
      const buyoutValue = Number(work?.current_buyout_price_cents || 0);
      const buyoutEnabled =
        !isPricelessAdminWork &&
        Boolean(work?.buyout_enabled) &&
        buyoutValue > 0;
      const buyoutPrice = isPricelessAdminWork
        ? loginCopy("Priceless", "无价之宝")
        : buyoutEnabled
          ? formatUsdFromCents(buyoutValue, "$0.00")
          : loginCopy("Unavailable");
      const viewerOrders = Array.isArray(work?.viewer_orders)
        ? work.viewer_orders
        : [];
      const isOwnedByViewer =
        Boolean(authState.user?.id) &&
        String(work?.owner_user_id || "").trim() ===
          String(authState.user?.id || "").trim();
      const canTransact = isLoggedInUser() && !isOwnedByViewer;
      const tipsEnabled = canReceiveTips(work);
      const hierarchyMarkup = renderHierarchyTree(
        resolveRenderableWorkChildren(work),
        "market",
      );
      const orderState = resolveViewerOrderState(viewerOrders);
      const listenDisabled = Boolean(
        isOwnedByViewer ||
        orderState.paidBuyout ||
        orderState.paidListen ||
        orderState.pendingListen ||
        orderState.pendingBuyout ||
        listenCents <= 0,
      );
      const buyoutDisabled = Boolean(
        isOwnedByViewer || orderState.paidBuyout || orderState.pendingBuyout,
      );
      const tipDisabled = Boolean(!tipsEnabled || orderState.pendingTip);
      const wholeBuyoutOnly = workRequiresWholeBuyoutModule(work);
      // P2-38: thumbnail now opens Watch preview directly (was previously
       // wired as `data-market-toggle` which only toggled the card expand);
       // title click toggles an inline detail view (lyrics + style + engines)
       // WITHOUT the cost or owner fields we show in the owner-facing
       // works-center card.
      // CSSOS_PHASE2_DURATION_OVERLAY 20260429 #170 — Jing
      // "请显示完整作品时长在为你创作面板/作品中心面板音乐卡片缩略图底部
      //  (压在图上)". Overlay the song's mm:ss duration at the bottom-right
      // corner of the cover so users know the full track length at a glance.
      // CSSOS_PHASE2_FORYOU_DURATION_FIELDS 20260504 — Jing
      // "请给作品卡片缩略图也压上作品时长". Read every field name the
      // backend has used over time so the overlay always finds a value
      // when one exists. Falls back across duration_secs / audio_*
      // / preview_* / total_* / final_* etc.
      const _durSecs = Number(
        work?.duration_secs ??
        work?.audio_duration_secs ??
        work?.preview_duration_secs ??
        work?.total_duration_secs ??
        work?.final_duration_secs ??
        work?.duration ??
        work?.audio_duration ??
        work?.duration_seconds ??
        0
      ) || 0;
      const _durOverlay = _durSecs > 0
        ? `<span class="work-cover-duration">${Math.floor(_durSecs / 60)}:${String(Math.floor(_durSecs % 60)).padStart(2, "0")}</span>`
        : "";
      // CSSOS_WAVE_111D 20260512 — 🔐 verify badge on the foryou
      // marketplace card cover too. Same UX as Works Center.
      const _fpHash = String(work?.fingerprint_hash || "").trim();
      const _fpBadge = /^[a-f0-9]{8,64}$/i.test(_fpHash)
        ? `<a class="work-cover-fp-badge" href="/verify?h=${encodeURIComponent(_fpHash)}" target="_blank" rel="noopener" title="${escapeHtml(loginCopy("Verify this MV is from CSS Studio", "验证此 MV 的 cssOS 原产证明"))} · ${escapeHtml(_fpHash)}" data-fingerprint-hash="${escapeHtml(_fpHash)}" onclick="event.stopPropagation();">🔐</a>`
        : "";
      // CSSOS_PHASE2_ADMIN_PUBLIC_WORK 20260504 — Jing
      // Admin works show in marketplace as FREE PUBLIC works:
      //   • listen / buyout / tip transactions disabled
      //   • listen chip → "Free", buyout chip → "Priceless · 无价之宝"
      //   • a "公共作品" badge replaces the transaction buttons
      // Everyone — including guests — can hit ENJOY to play for free.
      const _isAdminOwned = typeof globalThis.isAdminWorkModule === "function"
        ? globalThis.isAdminWorkModule(work) : false;
      const cardListenChip = _isAdminOwned ? loginCopy("Free") : escapeHtml(listenPrice);
      const cardBuyoutChip = _isAdminOwned ? loginCopy("Priceless · 无价之宝") : escapeHtml(buyoutPrice);
      // CSSOS_PHASE2_PLAYED_INDICATOR 20260504 — Jing
      // "已经欣赏过/播放过的作品和还没有欣赏过/播放过的作品，是否
      //  用点什么比如颜色之类的区分一下". Played-state class so CSS
      // can show an "unplayed" accent dot on the cover and quietly
      // fade played cards.
      const _played = typeof globalThis.cssosWorkIsPlayedModule === "function"
        ? globalThis.cssosWorkIsPlayedModule(workId) : false;
      const _playedClass = _played ? "is-played" : "is-unplayed";
      return `
        <article class="work-card market-card foryou-shelf-card ${_playedClass}${_isAdminOwned ? " is-admin-public" : ""}" data-market-work-id="${escapeHtml(workId)}" data-work-expand>
          <div class="work-cover" data-market-cover-key="${escapeHtml(workId)}" data-market-action="open-watch" role="button" tabindex="0" aria-label="${escapeHtml(loginCopy("Play MV"))}">
            ${coverImage ? `<img src="${escapeHtml(coverImage)}" alt="${title}" loading="lazy" decoding="async" />` : `<div class="work-cover-fallback">${rawTitle.slice(0, 2).toUpperCase()}</div>`}
            ${_fpBadge}
            ${_durOverlay}
            <span class="work-cover-played-dot" aria-hidden="true"></span>
          </div>
          <div class="work-info">
            <div class="work-title" data-market-toggle>${title}</div>
            <div class="work-tags" title="${style}">${style}</div>
            <div class="work-pricing">
              <span class="price-chip ghost-chip">${loginCopy("Type")} · ${escapeHtml(workTypeLabel(workType))}${options.albumChildCount >= 2 ? ` × ${Number(options.albumChildCount)}` : ""}</span>
              <span class="price-chip">${loginCopy("Listen")} · ${cardListenChip}</span>
              <span class="price-chip">${escapeHtml(buyoutLabelForWorkModule(work))} · ${cardBuyoutChip}</span>
              ${_isAdminOwned ? `<span class="price-chip price-chip-public">${loginCopy("Public · Free for all")}</span>` : ""}
              ${createdAt ? `<span class="price-chip ghost-chip">${escapeHtml(createdAt)}</span>` : ""}
            </div>
          </div>
          <div class="work-actions">
            <button class="mini-btn ghost" type="button" data-market-action="preview">${loginCopy("Enjoy")}</button>
            ${(!_isAdminOwned && canTransact) ? `<button class="mini-btn ghost" type="button" data-market-action="listen" ${listenDisabled ? "disabled" : ""}>${marketActionCopy("listen", orderState)}</button>` : ""}
            ${(!_isAdminOwned && canTransact && !workIsWholeBuyoutChildModule(work)) ? `<button class="mini-btn ghost" type="button" data-market-action="buyout" ${buyoutDisabled || !buyoutEnabled ? "disabled" : ""}>${wholeBuyoutOnly ? escapeHtml(loginCopy("Whole buyout")) : marketActionCopy("buyout", orderState)}</button>` : ""}
            ${canTransact ? `<span class="market-inline-action"><button class="mini-btn ghost" type="button" data-market-action="tip" ${tipDisabled ? "disabled" : ""}>${marketActionCopy("tip", orderState)}</button><input class="inline-chip-input market-tip-input" type="number" min="1" step="1" inputmode="decimal" placeholder="${escapeHtml(loginCopy("Tip $"))}" data-market-tip-input="${escapeHtml(workId)}" hidden /></span>` : ""}
            ${(canTransact && tipsEnabled) ? `<button class="mini-btn ghost" type="button" data-market-action="tip-nihaopay" data-market-nihaopay-creator="${escapeHtml(String(work?.owner_user_id || ""))}" data-market-nihaopay-work="${escapeHtml(workId)}" title="${escapeHtml(loginCopy("Tip via Alipay / WeChat Pay"))}">${escapeHtml(loginCopy("Tip · 支付宝/微信"))}</button>` : ""}
          </div>
          <div class="work-details">
            ${(globalThis.buildWorksCardDeepDetailsMarkupModule || (() => ""))(work, { hideOwnerInfo: true })}
            <div class="work-extra">${preview || title}</div>
            ${hierarchyMarkup}
          </div>
        </article>
      `;
    })
    .join("");
}

function bindMarketCardExpandToggle(list) {
  if (!(list instanceof Element)) return;
  list.querySelectorAll("[data-work-expand]").forEach((card) => {
    card.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-market-toggle]")) return;
      card.classList.toggle("is-expanded");
    });
  });
}

function bindMarketCardActionButtons(list, works = []) {
  if (!(list instanceof Element) || !Array.isArray(works)) return;
  list.querySelectorAll("[data-market-action='preview']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = button.closest("[data-market-work-id]");
      const childWorkId =
        button.getAttribute("data-market-child-id") ||
        "";
      const rootWorkId = card?.getAttribute("data-market-work-id") || "";
      const workId = childWorkId || rootWorkId;
      if (!workId) return;
      const rootWork =
        findRootWorkForPlaybackModule(works, rootWorkId || workId) ||
        findRootWorkForPlaybackModule(works, workId);
      if (!rootWork) return;
      const work = childWorkId
        ? { ...rootWork, requested_start_work_id: childWorkId }
        : rootWork;
      void openMarketWorkPreview({ ...work, __cssosOpenedFrom: "for-you" });
    });
  });
  const triggerOpenWatch = (element) => {
    const card = element.closest("[data-market-work-id]");
    const rootWorkId = card?.getAttribute("data-market-work-id") || "";
    if (!rootWorkId) return;
    const rootWork = findRootWorkForPlaybackModule(works, rootWorkId);
    if (!rootWork) return;
    void openMarketWorkPreview({ ...rootWork, __cssosOpenedFrom: "for-you" });
  };
  list.querySelectorAll("[data-market-action='open-watch']").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      triggerOpenWatch(element);
    });
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      triggerOpenWatch(element);
    });
  });
  list.querySelectorAll("[data-market-action='listen']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = button.closest("[data-market-work-id]");
      const workId =
        button.getAttribute("data-market-child-id") ||
        card?.getAttribute("data-market-work-id") ||
        "";
      if (!workId) return;
      void dispatchMarketWorkPayment(workId, "listen", button);
    });
  });
  list.querySelectorAll("[data-market-action='buyout']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = button.closest("[data-market-work-id]");
      const workId =
        button.getAttribute("data-market-child-id") ||
        card?.getAttribute("data-market-work-id") ||
        "";
      if (!workId) return;
      void dispatchMarketWorkPayment(workId, "buyout", button);
    });
  });
  list.querySelectorAll("[data-market-action='tip']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = button.closest(
        "[data-market-work-id], .work-hierarchy-item",
      );
      toggleMarketTipInput(card, true);
    });
  });
  list.querySelectorAll("[data-market-action='tip-nihaopay']").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await startNihaoPayTipFromButton(button);
    });
  });
  list.querySelectorAll("[data-market-tip-input]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget?.blur?.();
    });
    input.addEventListener("blur", (event) => {
      event.stopPropagation();
      const target = event.currentTarget;
      const card = target.closest(
        "[data-market-work-id], .work-hierarchy-item",
      );
      const trigger = card?.querySelector('[data-market-action="tip"]');
      void handleMarketTipBlur(target, trigger);
    });
  });
}

async function loadWatchCommerce(force = false) {
  if (!authState.user) {
    watchCommerceState.loaded = true;
    watchCommerceState.loading = false;
    watchCommerceState.payload = null;
    return null;
  }
  if (watchCommerceState.loading) return null;
  if (!force && watchCommerceState.loaded && watchCommerceState.payload) {
    return watchCommerceState.payload;
  }
  watchCommerceState.loading = true;
  watchCommerceState.error = null;
  try {
    const res = await fetch("/api/cssmv/commerce", { credentials: "include" });
    const raw = await res.json().catch(() => null);
    if (!res.ok || raw?.ok === false) {
      throw new Error(`watch commerce failed: ${res.status}`);
    }
    const data = getApiData(raw);
    watchCommerceState.payload = data;
    if (
      data?.permission_snapshot &&
      typeof data.permission_snapshot === "object"
    ) {
      authState.permissionSnapshot = data.permission_snapshot;
    }
    watchCommerceState.loaded = true;
    return data;
  } catch (err) {
    watchCommerceState.error = err;
    watchCommerceState.payload = null;
    watchCommerceState.loaded = false;
    return null;
  } finally {
    watchCommerceState.loading = false;
  }
}

async function loadCreatorBoostState(force = false) {
  if (!authState.user) {
    creatorBoostState.loaded = true;
    creatorBoostState.loading = false;
    creatorBoostState.payload = null;
    return null;
  }
  if (creatorBoostState.loading) return null;
  if (!force && creatorBoostState.loaded && creatorBoostState.payload) {
    return creatorBoostState.payload;
  }
  creatorBoostState.loading = true;
  creatorBoostState.error = null;
  try {
    const res = await fetch("/api/cssmv/boosts", { credentials: "include" });
    const raw = await res.json().catch(() => null);
    if (!res.ok || raw?.ok === false) {
      throw new Error(`creator boosts failed: ${res.status}`);
    }
    const data = getApiData(raw);
    creatorBoostState.payload = data;
    creatorBoostState.loaded = true;
    return data;
  } catch (err) {
    creatorBoostState.error = err;
    creatorBoostState.payload = null;
    creatorBoostState.loaded = false;
    return null;
  } finally {
    creatorBoostState.loading = false;
  }
}

function refreshCommerceLinkedPanels(options = {}) {
  const includeApi = options.includeApi !== false;
  const includeSeller = options.includeSeller === true;
  renderProfilePanel();
  if (includeApi) {
    renderApiBillingPanel();
  }
  if (includeSeller) {
    renderSellerPanel();
  }
}

function getPayoutActionPresentation(connectedAccount) {
  const hasAccount = Boolean(connectedAccount?.stripe_account_id);
  const reminder = getPayoutReminderPresentation(connectedAccount);
  if (reminder?.action) {
    return {
      visible: true,
      label: reminder.action,
    };
  }
  if (hasAccount) {
    return {
      visible: true,
      label: loginCopy("Manage payouts"),
    };
  }
  return {
    visible: true,
    label: loginCopy("Set up payouts"),
  };
}

function broadcastCommerceRefresh(options = {}) {
  const includeApi = options.includeApi !== false;
  const includeSeller = options.includeSeller === true;
  const includeWorks = options.includeWorks === true;
  const includeMarket = options.includeMarket === true;
  refreshCommerceLinkedPanels({ includeApi, includeSeller });
  if (includeWorks) {
    renderWorksPanel();
  }
  if (includeMarket) {
    renderForyouMarketplace();
  }
}

function broadcastProfileRefresh(options = {}) {
  const includeProfile = options.includeProfile !== false;
  const includeVersion = options.includeVersion !== false;
  const includeWorks = options.includeWorks === true;
  const includeSeller = options.includeSeller === true;
  if (includeProfile) {
    renderProfilePanel();
  }
  if (includeVersion) {
    renderVersionActions();
  }
  if (includeWorks) {
    renderWorksPanel();
  }
  if (includeSeller) {
    renderSellerPanel();
  }
}

function broadcastWorksCommerceRefresh(options = {}) {
  const includeSeller = options.includeSeller === true;
  const includeMarket = options.includeMarket === true;
  const includeApi = options.includeApi === true;
  broadcastProfileRefresh({ includeWorks: true, includeVersion: false });
  if (includeSeller) {
    renderSellerPanel();
  }
  if (includeMarket) {
    renderForyouMarketplace();
  }
  if (includeApi) {
    renderApiBillingPanel();
  }
}

function buildWorksHeroMarkup(options = {}) {
  const displayName = String(
    options.displayName ||
      authState.user?.name ||
      authState.user?.email ||
      "User",
  );
  const avatarUrl = String(options.avatarUrl || "").trim();
  const canSellWorks = options.canSellWorks !== false;
  const canSetupPayout = options.canSetupPayout === true;
  const commerce = watchCommerceState.payload || null;
  const connectedAccount = commerce?.connected_account || null;
  const payoutAction = getPayoutActionPresentation(connectedAccount);
  const payoutReminder = getPayoutReminderPresentation(connectedAccount);
  const showPayoutReminder =
    watchCommerceState.loaded && canSetupPayout && Boolean(payoutReminder);
  const canRunThumbnailBackfill = getUserRole() === "admin";
  return `
    <div class="works-hero">
      <div class="works-avatar">${avatarUrl ? `<img class="profile-avatar-image" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" loading="lazy" decoding="async" />` : escapeHtml(displayName.slice(0, 2).toUpperCase())}</div>
      <div class="works-meta">
        <div class="works-name">${escapeHtml(displayName)}</div>
        <div class="works-role">${loginCopy("Logged in creator")}</div>
        ${
          showPayoutReminder
            ? `
              <div class="works-note works-payout-note">
                ${loginCopy(payoutReminder?.message || "")}
                <button class="mini-btn ghost tiny" type="button" data-works-connect ${canSetupPayout ? "" : "hidden"}>${escapeHtml(payoutAction.label)}</button>
              </div>
            `
            : ""
        }
        ${
          !showPayoutReminder &&
          payoutAction.visible &&
          connectedAccount?.stripe_account_id
            ? `<div class="works-note works-payout-note">${escapeHtml(loginCopy("Need to update your payout method, payout destination, or Stripe details later? Reopen payout settings here any time."))} <button class="mini-btn ghost tiny" type="button" data-works-connect ${canSetupPayout ? "" : "hidden"}>${escapeHtml(payoutAction.label)}</button></div>`
            : ""
        }
        ${
          !canSellWorks
            ? `<div class="works-note">${loginCopy("Free members can view works here. Upgrade when you want to publish, price, and sell them publicly.")}</div>`
            : ""
        }
        ${
          canRunThumbnailBackfill
            ? `<div class="works-note"><button class="mini-btn ghost tiny" type="button" data-works-batch-regen-thumbs>${escapeHtml(loginCopy("Backfill missing thumbnails"))}</button></div>`
            : ""
        }
      </div>
    </div>
  `;
}

function buildWorksGuestEmptyMarkup() {
  return `
    <div class="panel-label">${loginCopy("Creator Works Center")}</div>
    <div class="works-empty-card">
      <div class="works-empty-title">${loginCopy("Sign in to view your works")}</div>
      <div class="works-empty-text">${loginCopy("Publishing, pricing, comment moderation, and monetization are available after login.")}</div>
      <button class="cta tiny" type="button" data-open-login>${loginCopy("Go to Login")}</button>
    </div>
  `;
}

function buildWorksPermissionEmptyMarkup() {
  return `
    <div class="panel-label">${loginCopy("Creator Works Center")}</div>
    <div class="works-empty-card">
      <div class="works-empty-title">${loginCopy("Works center requires login")}</div>
      <div class="works-empty-text">${escapeHtml(permissionPrompt("works.open"))}</div>
      <button class="cta tiny" type="button" data-open-login>${loginCopy("Go to Login")}</button>
    </div>
  `;
}

function buildWorksSearchShellMarkup(behavior) {
  return `
    <div class="panel-search-shell works-search-shell">
      <div class="panel-search-meta">${loginCopy("Pull down to search your works")}</div>
      <div class="panel-search-row">
        <input id="works-search-input" class="panel-search-input" type="search" placeholder="${escapeHtml(loginCopy("Search title, style, lyrics..."))}" />
        <input id="works-search-author" class="panel-search-input panel-search-input--narrow" type="search" placeholder="${escapeHtml(loginCopy("Author"))}" />
        <select id="works-search-filter" class="panel-search-select">
          <option value="all">${loginCopy("All")}</option>
          <option value="single">${loginCopy("Single")}</option>
          <option value="triptych">${loginCopy("Triptych")}</option>
          <option value="opera">${loginCopy("Opera")}</option>
          <option value="live">${loginCopy("Live")}</option>
          <option value="hidden">${loginCopy("Hidden")}</option>
        </select>
        <select id="works-search-sort" class="panel-search-select">
          <option value="newest">${loginCopy("Newest")}</option>
          <option value="oldest">${loginCopy("Oldest")}</option>
          <option value="title">${loginCopy("Title")}</option>
          <option value="type">${loginCopy("Type")}</option>
        </select>
        <select id="works-search-price" class="panel-search-select">
          <option value="all">${loginCopy("Any price")}</option>
          <option value="free">${loginCopy("Free")}</option>
          <option value="under_1">${loginCopy("Under $1")}</option>
          <option value="under_5">${loginCopy("Under $5")}</option>
          <option value="above_5">${loginCopy("Above $5")}</option>
        </select>
        <select id="works-search-time" class="panel-search-select">
          <option value="all">${loginCopy("Any time")}</option>
          <option value="day">${loginCopy("24h")}</option>
          <option value="week">${loginCopy("7 days")}</option>
          <option value="month">${loginCopy("30 days")}</option>
        </select>
        <span class="panel-search-count">${loginCopy(`10 per page`)}</span>
      </div>
      <div class="panel-filter-bar" id="works-filter-bar"></div>
    </div>
  `;
}

function buildWorksListShellMarkup() {
  return `
    <div class="works-section">
      <div class="section-title">${loginCopy("Your works")}</div>
      <div class="works-list" id="works-list-dynamic">
        <div class="works-note">${loginCopy("Loading works...")}</div>
      </div>
    </div>
  `;
}

function buildWorksEmptyNoteMarkup() {
  return `<div class="works-note">${loginCopy("No works yet. Create one to see it here.")}</div>`;
}

function buildWorksLoadFailedMarkup() {
  return `<div class="works-note">${loginCopy("Failed to load works.")}</div>`;
}

function buildWorksCardPricingMarkup(options = {}) {
  const workType = normalizeWorkTypeClient(options.workType);
  const wholeBuyoutOnly = options.wholeBuyoutOnly === true;
  const wholeBuyoutChild = options.wholeBuyoutChild === true;
  const listenPrice = String(
    options.listenPrice || loginCopy("Not set"),
  );
  const buyoutPrice = String(
    options.buyoutPrice || loginCopy("Not set"),
  );
  const visibility = String(options.visibility || "public").toLowerCase();
  const createdAt = String(options.createdAt || "").trim();
  const voiceSourceBadge = options.voiceSourceBadge === true;
  const computeUnits = Math.max(0, Number(options.computeUnits || 0));
  const computeCost = Math.max(0, Number(options.computeCost || 0));
  const canEditWorkPrices = options.canEditWorkPrices === true;
  const canEditWorkVisibility = options.canEditWorkVisibility === true;
  const listenPriceCents = Math.max(0, Number(options.listenPriceCents || 0));
  const buyoutPriceCents = Math.max(0, Number(options.buyoutPriceCents || 0));
  return `
    <div class="work-pricing">
      <span class="price-chip ghost-chip">${loginCopy("Type")} · ${escapeHtml(workTypeLabel(workType))}${options.albumChildCount >= 2 ? ` × ${Number(options.albumChildCount)}` : ""}</span>
      ${
        canEditWorkPrices
          ? `
            <span class="inline-chip-editor" data-inline-editor="listen">
              <button class="price-chip editable-chip" type="button" data-inline-trigger="listen">${loginCopy("Listen")} · ${escapeHtml(listenPrice)}</button>
              <input class="inline-chip-input" type="number" min="0.99" step="0.01" value="${escapeHtml((listenPriceCents / 100).toFixed(2))}" data-work-price="listen" hidden />
            </span>
            ${
              wholeBuyoutChild
                ? ""
                : `
                  <span class="inline-chip-editor" data-inline-editor="buyout">
                    <button class="price-chip editable-chip" type="button" data-inline-trigger="buyout">${escapeHtml(wholeBuyoutOnly ? buyoutLabelForWorkModule({ work_type: workType }) : loginCopy("Buyout"))} · ${escapeHtml(buyoutPrice)}</button>
                    <input class="inline-chip-input" type="number" min="0" step="0.01" value="${escapeHtml((buyoutPriceCents / 100).toFixed(2))}" data-work-price="buyout" hidden />
                  </span>
                `
            }
          `
          : `
            <span class="price-chip">${loginCopy("Listen")} · ${escapeHtml(listenPrice)}</span>
            ${wholeBuyoutChild ? "" : `<span class="price-chip">${escapeHtml(wholeBuyoutOnly ? buyoutLabelForWorkModule({ work_type: workType }) : loginCopy("Buyout"))} · ${escapeHtml(buyoutPrice)}</span>`}
          `
      }
      ${
        canEditWorkVisibility
          ? `
            <span class="inline-chip-editor" data-inline-editor="visibility">
              <button class="price-chip ghost-chip editable-chip" type="button" data-inline-trigger="visibility">${loginCopy("Status")} · ${escapeHtml(visibility === "private" ? loginCopy("Hidden") : loginCopy("Live"))}</button>
              <select class="inline-chip-select" data-work-visibility hidden>
                <option value="public" ${visibility === "public" ? "selected" : ""}>${loginCopy("Live")}</option>
                <option value="private" ${visibility === "private" ? "selected" : ""}>${loginCopy("Hidden")}</option>
              </select>
            </span>
          `
          : `<span class="price-chip ghost-chip">${loginCopy("Status")} · ${escapeHtml(visibility === "private" ? loginCopy("Hidden") : loginCopy("Live"))}</span>`
      }
      ${createdAt ? `<span class="price-chip ghost-chip">${escapeHtml(createdAt)}</span>` : ""}
      ${voiceSourceBadge ? `<span class="price-chip ghost-chip">${escapeHtml(loginCopy("Voice-derived title"))}</span>` : ""}
      ${computeUnits > 0 ? `<span class="price-chip ghost-chip">${escapeHtml(loginCopy(`Compute ${computeUnits}u`))}</span>` : ""}
      ${computeCost > 0 ? `<span class="price-chip ghost-chip">${escapeHtml(loginCopy(`Cost ${formatUsdFromCents(computeCost, "$0.00")}`))}</span>` : ""}
    </div>
  `;
}

function buildWorksCardInfoMarkup(options = {}) {
  const title =
    String(options.title || "").trim() || loginCopy("Untitled");
  const style = String(options.style || "").trim();
  return `
    <div class="work-info">
      <div class="work-title" data-work-toggle>${escapeHtml(title)}</div>
      <div class="work-tags" title="${escapeHtml((style || loginCopy("Style not set")).replace(/"/g, "&quot;"))}">${escapeHtml(style || loginCopy("Style not set"))}</div>
      ${buildWorksCardPricingMarkup(options)}
    </div>
  `;
}

function buildWorksCardMarkup(options = {}) {
  const workId = String(options.workId || "").trim();
  // CSSOS_PHASE2_PLAYED_INDICATOR 20260504 — apply played-state class
  // so the cover dot lights up for unplayed works.
  const _played = typeof globalThis.cssosWorkIsPlayedModule === "function"
    ? globalThis.cssosWorkIsPlayedModule(workId) : false;
  const _playedCls = _played ? "is-played" : "is-unplayed";
  const _adminCls = options.isAdminOwned ? " is-admin-public" : "";
  // CSSOS_WAVE_135 — received-gift badge + class.
  const _giftCls = options.isReceivedGift ? " is-received-gift" : "";
  const _giftBadge = options.isReceivedGift
    ? `<div class="work-gift-badge" title="${escapeHtml(loginCopy("A gift from CSS Studio — free forever, not for sale", "CSS Studio 送你的礼物 — 永久免费，不可出售"))}">🎁 ${escapeHtml(loginCopy("Gift", "礼物"))}</div>`
    : "";
  // CSSOS_WAVE_172 — album-card class so CSS can dress the whole card
  // (slight 3D rise, sequence chips) when the work has child parts.
  const albumCount = Math.max(0, Number(options.albumChildCount || 0));
  const _albumCls = albumCount >= 2 ? " is-album-root" : "";
  return `
    <article class="work-card ${_playedCls}${_adminCls}${_giftCls}${_albumCls}" data-work-expand data-work-id="${escapeHtml(workId)}">
      ${_giftBadge}
      ${buildWorksCardCoverMarkup(options)}
      ${buildWorksCardChildThumbsMarkup(options)}
      ${buildWorksCardInfoMarkup(options)}
      ${buildWorksCardActionsMarkup(options)}
      ${buildWorksCardDetailsMarkup(options)}
    </article>
  `;
}

// CSSOS_WAVE_172 — Jing: 树状专辑卡 thumb strip. For multi-part roots
// render a horizontal row of mini child covers right under the main
// cover; clicking a thumb opens THAT child's MV in the watch panel.
function buildWorksCardChildThumbsMarkup(options = {}) {
  const albumChildCount = Math.max(0, Number(options.albumChildCount || 0));
  const albumThumbs = Array.isArray(options.albumChildThumbs)
    ? options.albumChildThumbs : [];
  if (albumChildCount < 2 || !albumThumbs.length) return "";
  const tiles = albumThumbs.slice(0, 3).map((t, i) => {
    const cid = String(t && t.id || "").trim();
    const cover = String(t && t.cover || "").trim();
    const seq = i + 1;
    const title = String(t && t.title || "").trim();
    const bg = cover
      ? `style="background-image:url('${escapeHtml(cover).replace(/'/g, "&#39;")}');"`
      : "";
    return `<button class="work-album-thumb" type="button" data-work-album-child="${escapeHtml(cid)}" title="${escapeHtml(title)}" ${bg}>
      <span class="work-album-thumb-seq">${seq}</span>
    </button>`;
  }).join("");
  return `<div class="work-album-thumb-strip" data-work-album-strip>${tiles}</div>`;
}

function buildWorksCardsMarkup(works = [], options = {}) {
  if (!Array.isArray(works) || !works.length) return "";
  const usageEvents = Array.isArray(options.usageEvents)
    ? options.usageEvents
    : [];
  const canEditWorkPrices = options.canEditWorkPrices === true;
  const canEditWorkVisibility = options.canEditWorkVisibility === true;
  const canEditWorkType = options.canEditWorkType === true;
  const canWatchWorks = options.canWatchWorks === true;
  const canRegenerateThumbnail = options.canRegenerateThumbnail === true;
  const canRegeneratePreviewVideo = options.canRegeneratePreviewVideo === true;
  return works
    .map((work) => {
      const workId = String(
        work?.work_id || work?.id || work?.local_id || "",
      ).trim();
      const title =
        String(work.title || "").trim() || loginCopy("Untitled");
      const style = String(work.style || "").trim();
      const workType = normalizeWorkTypeClient(work?.work_type);
      const status = String(work.status || "draft");
      const visibility = String(
        work.visibility || (status === "hidden" ? "private" : "public"),
      ).toLowerCase();
      const createdAt = work.created_at
        ? new Date(work.created_at).toLocaleString()
        : "";
      const lyricsPreview = buildDisplayLyricsPreviewText(work);
      const coverImage =
        globalThis.resolveWorkCardThumbnailImageModule?.(work) ||
        resolveWorkCoverImage(work);
      const source = String(work?.source || "")
        .trim()
        .toLowerCase();
      const voiceSourceBadge =
        source === "voice" || work?.show_voice_source_badge;
      // CSSOS_WAVE_172 / 175 20260515 — Jing: 树状专辑卡 + 歌剧两层结构.
      // For multi-part roots (triptych/opera/etc., post-W169) capture
      // child count + their cover URLs + ids so the card can render an
      // album stack + child thumbnail strip + "× N" badge. Opera goes
      // one level deeper (act → scene), so we ALSO build a normalized
      // tree of {id,title,cover,sequence_index,structure_role,children}
      // that the recursive album-detail renderer can walk.
      const renderableChildren = resolveRenderableWorkChildren(work);
      const albumChildren = (Array.isArray(renderableChildren) ? renderableChildren : [])
        .slice() // sequence-ascending sort already done backend-side
        .filter((c) => c && (c.id || c.work_id));
      const albumChildCount = albumChildren.length;
      const normalizeAlbumNode = (c, idx) => ({
        id: String(c.work_id || c.id || "").trim(),
        title: String(c.title || "").trim(),
        cover: String(
          (typeof globalThis.resolveWorkCardThumbnailImageModule === "function"
            ? globalThis.resolveWorkCardThumbnailImageModule(c)
            : null) || resolveWorkCoverImage(c) || ""
        ),
        sequence_index: Number(c.sequence_index || idx + 1) || (idx + 1),
        structure_role: String(c.structure_role || "").trim().toLowerCase(),
        children: (Array.isArray(c.children) ? c.children : []).map(normalizeAlbumNode),
      });
      const albumChildTree = albumChildren.map(normalizeAlbumNode);
      // Flat top-3 thumbs for the cover-strip / stack layers (covers
      // are sampled from the FIRST playable leaf in each top-level
      // branch — for opera that's "Act I's first scene" so the strip
      // still reads visually).
      const firstLeafCover = (n) => {
        if (!n) return "";
        if (!n.children || !n.children.length) return n.cover || "";
        for (const k of n.children) {
          const c = firstLeafCover(k);
          if (c) return c;
        }
        return n.cover || "";
      };
      const albumChildThumbs = albumChildTree.slice(0, 3).map((c) => ({
        id: c.id, title: c.title,
        cover: c.cover || firstLeafCover(c),
      }));
      const hierarchyMarkup = renderHierarchyTree(renderableChildren, "works");
      const commerce = getWorkCommerceDetails(workId);
      const pricing = resolveDisplayedWorkPricingModule(work, commerce);
      const listenPriceCents = pricing.listenPriceCents;
      const buyoutPriceCents = pricing.buyoutPriceCents;
      const listenPrice =
        listenPriceCents > 0
          ? formatUsdFromCents(listenPriceCents, "$0.00")
          : loginCopy("Not set");
      const buyoutPrice =
        buyoutPriceCents > 0
          ? formatUsdFromCents(buyoutPriceCents, "$0.00")
          : loginCopy("Not set");
      const computeUnits = Math.max(
        0,
        Number(work?.compute_units_estimate || 0),
      );
      const computeCost = Math.max(
        0,
        Number(work?.compute_cost_cents_estimate || 0),
      );
      const suggestedListen = pricing.suggestedListen;
      const suggestedBuyout = pricing.suggestedBuyout;
      const wholeBuyoutOnly =
        workRequiresWholeBuyoutModule(work) &&
        !workIsWholeBuyoutChildModule(work);
      const wholeBuyoutChild = workIsWholeBuyoutChildModule(work);
      // CSSOS_PHASE2_ADMIN_NOT_FOR_SALE 20260504 — Jing
      // "请给系统管理员…的作品，聆听价格免费，买断价格'无价之宝'，
      //  而且不允许更改，处于只读". Admin-owned works don't sell on
      //  the marketplace — listen is free, buyout is priceless, and
      //  pricing/visibility editors are read-only. Suggested prices
      //  remain in the details for reference.
      const isAdminOwned = typeof globalThis.isAdminWorkModule === "function"
        ? globalThis.isAdminWorkModule(work)
        : false;
      // CSSOS_WAVE_135 20260514 — gifts the viewer received (welcome /
      // birthday MV). Backend /api/works/mine merges them in with
      // is_received_gift=true. They're admin-owned (so the isAdminOwned
      // path above already makes them Free + Priceless + read-only) —
      // we just add a 🎁 badge so the user knows it was a gift TO them.
      const isReceivedGift = work?.is_received_gift === true
        || String(work?.structure_role || "") === "gift";
      const cardListenPrice = isAdminOwned ? loginCopy("Free") : listenPrice;
      const cardBuyoutPrice = isAdminOwned ? loginCopy("Priceless · 无价之宝") : buyoutPrice;
      const cardCanEditWorkPrices = canEditWorkPrices && !isAdminOwned;
      const cardCanEditWorkVisibility = canEditWorkVisibility && !isAdminOwned;
      return buildWorksCardMarkup({
        workId,
        coverImage,
        // CSSOS_WAVE_165 20260515 — Jing: "作品时长被误删除了还是怎么了
        // 不显示了". The narrow `duration_secs || audio_duration_secs`
        // fallback missed the field names used elsewhere
        // (preview_duration_secs / total_duration_secs / final_duration_secs
        // / duration / duration_seconds). Use the same broad fallback as
        // the foryou shelf so the mm:ss overlay always shows when ANY of
        // the duration fields is populated.
        durationSecs: Number(
          work?.duration_secs ??
          work?.audio_duration_secs ??
          work?.preview_duration_secs ??
          work?.total_duration_secs ??
          work?.final_duration_secs ??
          work?.duration ??
          work?.audio_duration ??
          work?.duration_seconds ??
          0
        ) || 0,
        // CSSOS_WAVE_111D 20260512 — thread fingerprint_hash through
        // so the cover renders the 🔐 verify badge.
        fingerprintHash: String(work?.fingerprint_hash || "").trim(),
        // CSSOS_WAVE_172 / 175 — album-card data: count + flat thumb
        // sample for the cover strip + full normalized tree for the
        // recursive album-detail panel (opera goes act → scene).
        albumChildCount,
        albumChildThumbs,
        albumChildTree,
        title,
        style,
        workType,
        listenPrice: cardListenPrice,
        buyoutPrice: cardBuyoutPrice,
        visibility,
        createdAt,
        voiceSourceBadge,
        computeUnits,
        computeCost,
        canEditWorkPrices: cardCanEditWorkPrices,
        canEditWorkVisibility: cardCanEditWorkVisibility,
        isAdminOwned,
        listenPriceCents,
        buyoutPriceCents,
        wholeBuyoutOnly,
        wholeBuyoutChild,
        canWatchWorks,
        canRegenerateThumbnail,
        canRegeneratePreviewVideo,
        isReceivedGift,
        work,
        lyricsPreview,
        suggestedListen,
        suggestedBuyout,
        usageEvents,
        hierarchyMarkup,
        canEditWorkType,
      });
    })
    .join("");
}

window.resolveDisplayedWorkPricingModule = resolveDisplayedWorkPricingModule;

function buildWorksCardCoverMarkup(options = {}) {
  const workId = String(options.workId || "").trim();
  const coverImage = String(options.coverImage || "").trim();
  const title =
    String(options.title || "").trim() || loginCopy("Untitled");
  // CSSOS_PHASE2_DURATION_OVERLAY 20260429 #170 — Jing
  // Overlay total work duration at the bottom-right of the cover thumbnail.
  const durSecs = Number(options.durationSecs || 0) || 0;
  const durOverlay = durSecs > 0
    ? `<span class="work-cover-duration">${Math.floor(durSecs / 60)}:${String(Math.floor(durSecs % 60)).padStart(2, "0")}</span>`
    : "";
  // CSSOS_WAVE_111D 20260512 — Jing
  // 🔐 fingerprint badge top-left of the cover thumbnail. Click opens
  // /verify?h=<hash> in a new tab. Shown only when fingerprint_hash
  // exists in DB (auto-fingerprint hook runs after compose-finalize,
  // so most works land with the hash within ~10s of being saved).
  const fpHash = String(options.fingerprintHash || "").trim();
  const fpBadge = /^[a-f0-9]{8,64}$/i.test(fpHash)
    ? `<a class="work-cover-fp-badge" href="/verify?h=${encodeURIComponent(fpHash)}" target="_blank" rel="noopener" title="${escapeHtml(loginCopy("Verify this MV is from CSS Studio", "验证此 MV 的 cssOS 原产证明"))} · ${escapeHtml(fpHash)}" data-fingerprint-hash="${escapeHtml(fpHash)}" onclick="event.stopPropagation();">🔐</a>`
    : "";
  // CSSOS_WAVE_172 20260515 — Jing: album-style root card. Multi-part
  // roots get two offset "stack" layers behind the main cover that hint
  // at the children sitting underneath, plus a top-right "× N" badge.
  const albumChildCount = Math.max(0, Number(options.albumChildCount || 0));
  const albumThumbs = Array.isArray(options.albumChildThumbs)
    ? options.albumChildThumbs.filter((t) => t && (t.id || t.cover))
    : [];
  const stackLayers = albumChildCount >= 2
    ? (function () {
        // Take up to 2 distinct child covers for the rear/middle stack
        // layers. Fall back to the root cover so the silhouette stays
        // legible even if a child has no cover yet.
        const pool = albumThumbs
          .map((t) => String(t.cover || ""))
          .filter(Boolean);
        const rear  = pool[1] || pool[0] || coverImage;
        const mid   = pool[0] || coverImage;
        const mk = (url, cls) => url
          ? `<div class="work-cover-stack-layer ${cls}" style="background-image:url('${escapeHtml(url).replace(/'/g, "&#39;")}');" aria-hidden="true"></div>`
          : `<div class="work-cover-stack-layer ${cls}" aria-hidden="true"></div>`;
        return mk(rear, "is-rear") + mk(mid, "is-mid");
      })()
    : "";
  const albumCountBadge = albumChildCount >= 2
    ? `<span class="work-cover-album-count" aria-label="${escapeHtml(loginCopy(`${albumChildCount} parts`, `${albumChildCount} 部`))}">× ${albumChildCount}</span>`
    : "";
  const isAlbumCls = albumChildCount >= 2 ? " is-album" : "";
  return `
    <div class="work-cover${isAlbumCls}" data-work-cover data-work-cover-key="${escapeHtml(workId)}" data-work-open-watch>
      ${stackLayers}
      ${coverImage ? `<img class="work-cover-img" src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" />` : `<div class="work-cover-fallback">${title.slice(0, 2).toUpperCase()}</div>`}
      ${fpBadge}
      ${durOverlay}
      ${albumCountBadge}
      <span class="work-cover-played-dot" aria-hidden="true"></span>
    </div>
  `;
}

function buildWorksCardDetailsMarkup(options = {}) {
  const hierarchyMarkup = String(options.hierarchyMarkup || "");
  return `
    <div class="work-details">
      ${buildWorksCardAlbumDetailMarkup(options)}
      ${buildWorksCardCommerceDetailsMarkup(options)}
      ${hierarchyMarkup}
    </div>
  `;
}

// CSSOS_WAVE_173 / 175 20260515 — Jing: 完整唱片背面 + 歌剧三层结构.
//   Triptych: title → 3 parts (single-level)
//   Opera:    title → acts → scenes  (two levels — each scene is a single)
// The renderer walks the tree recursively: any node whose children
// themselves have children becomes an expandable <details> "section"
// row (Acts in opera); leaf nodes (parts in triptych, scenes in opera)
// become clickable single-track rows that open in the watch panel.
// Single-part works skip this block entirely.
function buildWorksCardAlbumDetailMarkup(options = {}) {
  const albumChildCount = Math.max(0, Number(options.albumChildCount || 0));
  if (albumChildCount < 2) return "";
  const albumThumbs = Array.isArray(options.albumChildThumbs)
    ? options.albumChildThumbs : [];
  if (!albumThumbs.length) return "";
  const title = String(options.title || "").trim() || loginCopy("Untitled");
  const cover = String(options.coverImage || "").trim();
  const workTypeLbl = workTypeLabel(options.workType);
  const renderableTree = Array.isArray(options.albumChildTree) && options.albumChildTree.length
    ? options.albumChildTree
    : albumThumbs.map((t, i) => ({
        id: t.id, title: t.title, cover: t.cover,
        sequence_index: i + 1, children: [],
        structure_role: "part",
      }));
  const tracks = renderableAlbumNodes(renderableTree, 0);
  return `
    <div class="work-album-detail" data-work-album-detail>
      <div class="work-album-detail-cover">
        ${cover
          ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" />`
          : `<div class="work-album-detail-fallback">${escapeHtml(title.slice(0, 2).toUpperCase())}</div>`}
        <span class="work-album-detail-badge">${escapeHtml(workTypeLbl)} × ${albumChildCount}</span>
      </div>
      <div class="work-album-detail-tracks">
        <div class="work-album-detail-tracks-head">${escapeHtml(loginCopy("Tracks", "曲目"))}</div>
        ${tracks}
      </div>
    </div>
  `;
}

// Recursive renderer for the album-detail tracks column. depth=0 for
// top-level children of the root; depth>0 for nested scenes etc. Each
// leaf is a click-to-open <button>; each inner node is a collapsible
// <details> that holds further rows. Acts get a small "× N scenes"
// counter so the user sees structure at a glance before expanding.
function renderableAlbumNodes(nodes, depth) {
  return (Array.isArray(nodes) ? nodes : [])
    .map((node, idx) => {
      const cid = String(node && (node.id || node.work_id) || "").trim();
      const ntitle = String(node && node.title || "").trim()
        || `Section ${idx + 1}`;
      const cover = String(node && node.cover || node.cover_image || node.preview_image_url || "").trim();
      const seq = Number(node && (node.sequence_index || idx + 1)) || (idx + 1);
      const role = String(node && node.structure_role || "").trim().toLowerCase();
      const children = Array.isArray(node && node.children) ? node.children : [];
      const isInner = children.length > 0;
      const bg = cover
        ? `style="background-image:url('${escapeHtml(cover).replace(/'/g, "&#39;")}');"`
        : "";
      if (!isInner) {
        // Leaf — playable track row.
        return `<button class="work-album-track depth-${depth}" type="button" data-work-album-child="${escapeHtml(cid)}" title="${escapeHtml(ntitle)}">
          <span class="work-album-track-seq">${seq}</span>
          <span class="work-album-track-thumb" ${bg} aria-hidden="true"></span>
          <span class="work-album-track-title">${escapeHtml(ntitle)}</span>
          <span class="work-album-track-go" aria-hidden="true">▶</span>
        </button>`;
      }
      // Inner node (an Act, etc.) — collapsible section. The first
      // act at depth 0 opens by default so the user sees structure
      // without clicking; deeper or later acts stay collapsed.
      const openAttr = (depth === 0 && idx === 0) ? " open" : "";
      const sceneCountCopy = `× ${children.length}`;
      return `<details class="work-album-section depth-${depth}" data-album-section${openAttr}>
        <summary>
          <span class="work-album-section-seq">${seq}</span>
          <span class="work-album-section-title">${escapeHtml(ntitle)}</span>
          <span class="work-album-section-meta">${escapeHtml(sceneCountCopy)}</span>
        </summary>
        <div class="work-album-section-body">
          ${renderableAlbumNodes(children, depth + 1)}
        </div>
      </details>`;
    })
    .join("");
}

function normalizeStructuredPlanForDisplay(work = {}) {
  const plan = work?.structure_plan;
  if (!plan || typeof plan !== "object") return null;
  const readInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    totalActs: readInt(plan.totalActs, 0),
    scenesPerAct: readInt(plan.scenesPerAct, 0),
    totalParts: readInt(plan.totalParts, 0),
  };
}

function splitLyricsLinesForHierarchy(work = {}, count = 1) {
  const lines = String(resolveWorkLyricsTextForDisplay(work) || "")
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const safeCount = Math.max(1, Number(count || 1));
  if (!lines.length) {
    return Array.from({ length: safeCount }, () => []);
  }
  const chunkSize = Math.max(1, Math.ceil(lines.length / safeCount));
  const buckets = [];
  for (let index = 0; index < safeCount; index += 1) {
    buckets.push(lines.slice(index * chunkSize, (index + 1) * chunkSize));
  }
  return buckets;
}

function buildFallbackHierarchyChildren(work = {}) {
  const existingChildren = Array.isArray(work?.children) ? work.children : [];
  if (existingChildren.length) return existingChildren;
  const workType = normalizeWorkTypeClient(work?.work_type);
  const plan = normalizeStructuredPlanForDisplay(work);
  const rootTitle =
    String(work?.title || "").trim() || loginCopy("Untitled");
  const style = String(work?.style || "").trim();
  if (workType === "triptych") {
    const totalParts = Math.max(1, Number(plan?.totalParts || 3));
    const segments = splitLyricsLinesForHierarchy(work, totalParts);
    return segments.map((lines, index) => ({
      id: `${String(work?.work_id || work?.id || work?.local_id || rootTitle)}__part_${index + 1}`,
      title: `${rootTitle} · ${loginCopy("Part")} ${index + 1}`,
      work_type: "single",
      structure_role: "part",
      sequence_index: index + 1,
      lyrics_preview: lines.join("\n"),
      lyrics_text: lines.join("\n"),
      style,
      children: [],
    }));
  }
  if (workType === "opera") {
    const estimatedShape =
      globalThis.estimateOperaShapeModule?.(
        {
          title: rootTitle,
          lyrics: String(work?.lyrics_text || work?.lyrics_preview || ""),
          sectionPrompts: [],
          structurePlan: plan,
        },
        work,
        rootTitle,
      ) || {};
    const totalActs = Math.max(
      1,
      Number(plan?.totalActs || estimatedShape.totalActs || 1),
    );
    const scenesPerAct = Math.max(
      1,
      Number(plan?.scenesPerAct || estimatedShape.scenesPerAct || 1),
    );
    const totalScenes = totalActs * scenesPerAct;
    const segments = splitLyricsLinesForHierarchy(work, totalScenes);
    const acts = [];
    let cursor = 0;
    for (let actIndex = 1; actIndex <= totalActs; actIndex += 1) {
      const scenes = [];
      for (let sceneIndex = 1; sceneIndex <= scenesPerAct; sceneIndex += 1) {
        const lines = segments[cursor] || [];
        scenes.push({
          id: `${String(work?.work_id || work?.id || work?.local_id || rootTitle)}__act_${actIndex}_scene_${sceneIndex}`,
          title: `${rootTitle} · Scene ${sceneIndex}`,
          work_type: "single",
          structure_role: "scene",
          sequence_index: sceneIndex,
          lyrics_preview: lines.join("\n"),
          lyrics_text: lines.join("\n"),
          style,
          children: [],
        });
        cursor += 1;
      }
      acts.push({
        id: `${String(work?.work_id || work?.id || work?.local_id || rootTitle)}__act_${actIndex}`,
        title: `${rootTitle} · ${typeof globalThis.formatActLabelModuleBridge === "function" ? globalThis.formatActLabelModuleBridge(actIndex) : `第${actIndex}幕`}`,
        work_type: "opera",
        structure_role: "act",
        sequence_index: actIndex,
        lyrics_preview: scenes
          .map((scene) => scene.lyrics_preview)
          .join("\n"),
        style,
        children: scenes,
      });
    }
    return acts;
  }
  return [];
}

function resolveRenderableWorkChildren(work = {}) {
  const directChildren = Array.isArray(work?.children) ? work.children : [];
  if (directChildren.length) return directChildren;
  return buildFallbackHierarchyChildren(work);
}

function bindWorksHeroActions(container) {
  if (!(container instanceof Element)) return;
  container
    .querySelector("[data-works-connect]")
    ?.addEventListener("click", (event) => {
      event.stopPropagation();
      void startCreatorPayoutOnboarding(event.currentTarget);
    });
}

function buildWorkMarketReferenceCopy(options = {}) {
  const listenCents = Math.max(
    0,
    Number(options.listenCents || options.suggestedListen || 0),
  );
  const buyoutCents = Math.max(
    0,
    Number(options.buyoutCents || options.suggestedBuyout || 0),
  );
  const buyoutLabel = options.wholeBuyoutOnly
    ? loginCopy("Whole buyout")
    : loginCopy("Buyout");
  return loginCopy(
    `Current pricing · Listen ${formatUsdFromCents(listenCents, "$0.00")} / ${buyoutLabel} ${formatUsdFromCents(buyoutCents, "$0.00")}`,
  );
}

function buildWorkAssetStatusCopy(work = {}) {
  const storedCoverImage = String(
    work?.cover_image || work?.thumbnail_url || "",
  ).trim();
  const previewImageUrl = String(work?.preview_image_url || "").trim();
  const previewVideoUrl = String(work?.preview_video_url || "").trim();
  const hasGeneratedCover =
    Boolean(storedCoverImage) && !isSyntheticWorkCoverImage(storedCoverImage);
  if (hasGeneratedCover) {
    return loginCopy(
      `OpenAI cover art is ready. Preview frame ${previewImageUrl ? "is ready" : "can be added later"} / Preview clip ${previewVideoUrl ? "is ready" : "can be added later"}.`,
    );
  }
  return loginCopy(
    `OpenAI cover art is still missing. Preview frame ${previewImageUrl ? "is ready" : "not ready"} / Preview clip ${previewVideoUrl ? "is ready" : "not ready"}.`,
  );
}

// P2-37: Build the deep details block rendered inside an expanded work card.
// Shows the *full* lyrics (not just the preview), the music style, any wiki /
// source info, and a per-stage engine breakdown (cover / lyrics / music /
// video / subtitles / MV compose) including engine name + version + cost. This
// answers the "which engines were used?" question from creators directly in
// the works center without them needing to open another panel.
//
// Stages are resolved against `work.engine_meta` (new, structured) with a
// fallback to `work.engine_costs_cents` (older per-stage cost field). Any
// stage without data is skipped rather than showing a confusing "$0.00".
const WORKS_ENGINE_STAGE_ORDER = [
  { id: "cover",     labelEn: "Cover art",  labelZh: "封面图",   costKey: "cover_cents" },
  { id: "lyrics",    labelEn: "Lyrics",     labelZh: "歌词",     costKey: "lyrics_cents" },
  { id: "music",     labelEn: "Music",      labelZh: "音乐",     costKey: "music_cents" },
  { id: "video",     labelEn: "Video",      labelZh: "视频",     costKey: "video_cents" },
  { id: "subtitles", labelEn: "Subtitles",  labelZh: "字幕",     costKey: "subtitles_cents" },
  { id: "compose",   labelEn: "MV compose", labelZh: "MV 合成",  costKey: "compose_cents" }
];

// Pull a stage engine fingerprint out of the work record. Shape is roughly:
//   { engine, version, provider_model, cost_cents, input_tokens, output_tokens }
// but all fields are optional — older works may only have cost_cents via
// engine_costs_cents.
function readWorkStageEngineEntryModule(work = {}, stage = {}) {
  const meta =
    work && typeof work.engine_meta === "object" && work.engine_meta !== null
      ? work.engine_meta
      : null;
  const entry = meta && typeof meta[stage.id] === "object" && meta[stage.id] !== null
    ? meta[stage.id]
    : {};
  const fallbackCosts =
    work && typeof work.engine_costs_cents === "object" && work.engine_costs_cents !== null
      ? work.engine_costs_cents
      : {};
  const rawCost =
    entry?.cost_cents != null ? entry.cost_cents : fallbackCosts?.[stage.costKey];
  const costCents = Math.max(0, Number(rawCost || 0));
  const engineName = String(entry?.engine || "").trim();
  const version = String(entry?.version || "").trim();
  const providerModel = String(entry?.provider_model || "").trim();
  const hasAnySignal = Boolean(engineName || version || providerModel || costCents > 0);
  return {
    stageId: stage.id,
    labelEn: stage.labelEn,
    labelZh: stage.labelZh,
    engineName,
    version,
    providerModel,
    costCents,
    hasAnySignal
  };
}

function buildWorksCardEngineBreakdownMarkup(work = {}, options = {}) {
  const entries = WORKS_ENGINE_STAGE_ORDER.map((stage) =>
    readWorkStageEngineEntryModule(work, stage)
  );
  const visible = entries.filter((entry) => entry.hasAnySignal);
  if (!visible.length) return "";
  const includeCost = options.includeCost !== false; // default true
  const totalCents = visible.reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.costCents || 0)),
    0
  );
  const rowsMarkup = visible
    .map((entry) => {
      const stageLabel = loginCopy(entry.labelEn);
      const engineLabel = entry.engineName
        ? entry.engineName
        : loginCopy("Unknown engine");
      const versionLabel = entry.version
        ? ` · ${entry.version}`
        : "";
      const providerLabel = entry.providerModel
        ? ` · ${entry.providerModel}`
        : "";
      const costLabel = includeCost
        ? formatUsdFromCents(entry.costCents, "$0.00")
        : "";
      return `
        <div class="work-engine-row">
          <span class="work-engine-stage">${escapeHtml(stageLabel)}</span>
          <span class="work-engine-info">${escapeHtml(`${engineLabel}${versionLabel}${providerLabel}`)}</span>
          ${includeCost ? `<span class="work-engine-cost">${escapeHtml(costLabel)}</span>` : ""}
        </div>
      `;
    })
    .join("");
  const totalMarkup = includeCost
    ? `
        <div class="work-engine-row work-engine-total">
          <span class="work-engine-stage">${escapeHtml(loginCopy("Total"))}</span>
          <span class="work-engine-info"></span>
          <span class="work-engine-cost">${escapeHtml(formatUsdFromCents(totalCents, "$0.00"))}</span>
        </div>
      `
    : "";
  return `
    <div class="work-engine-breakdown">
      <div class="work-engine-heading">${escapeHtml(loginCopy("Engines used"))}</div>
      <div class="work-engine-rows">
        ${rowsMarkup}
        ${totalMarkup}
      </div>
    </div>
  `;
}

// Full lyrics + style + source/wiki info. Pass `{ hideOwnerInfo: true }` from
// the For You panel where we don't want to reveal owner / cost fields; the
// works center owner view uses defaults (all fields shown).
function buildWorksCardDeepDetailsMarkup(work = {}, options = {}) {
  const hideOwnerInfo = options.hideOwnerInfo === true;
  const fullLyrics = String(resolveWorkLyricsTextForDisplay(work) || "").trim();
  const style = String(work?.style || "").trim();
  const description = String(work?.description || "").trim();
  const rawTranscript = String(work?.raw_transcript || "").trim();
  const sourceRunId = String(work?.source_run_id || "").trim();
  const workType = normalizeWorkTypeClient(work?.work_type);
  const createdAt = work?.created_at
    ? new Date(work.created_at).toLocaleString()
    : "";
  const lyricsMarkup = fullLyrics
    ? `
        <div class="work-deep-section">
          <div class="work-deep-heading">${escapeHtml(loginCopy("Full lyrics"))}</div>
          <div class="work-deep-lyrics">${escapeHtml(fullLyrics)}</div>
        </div>
      `
    : "";
  const styleMarkup = style
    ? `
        <div class="work-deep-section">
          <div class="work-deep-heading">${escapeHtml(loginCopy("Music style"))}</div>
          <div class="work-deep-body">${escapeHtml(style)}</div>
        </div>
      `
    : "";
  const descriptionMarkup = description
    ? `
        <div class="work-deep-section">
          <div class="work-deep-heading">${escapeHtml(loginCopy("Description"))}</div>
          <div class="work-deep-body">${escapeHtml(description)}</div>
        </div>
      `
    : "";
  const transcriptMarkup = !hideOwnerInfo && rawTranscript
    ? `
        <div class="work-deep-section">
          <div class="work-deep-heading">${escapeHtml(loginCopy("Source transcript"))}</div>
          <div class="work-deep-body">${escapeHtml(rawTranscript)}</div>
        </div>
      `
    : "";
  const metaRows = [];
  if (workType) {
    metaRows.push(
      `<span class="work-deep-meta-chip">${escapeHtml(loginCopy("Type"))} · ${escapeHtml(workTypeLabel(workType))}</span>`
    );
  }
  if (createdAt) {
    metaRows.push(
      `<span class="work-deep-meta-chip">${escapeHtml(loginCopy("Created"))} · ${escapeHtml(createdAt)}</span>`
    );
  }
  if (!hideOwnerInfo && sourceRunId) {
    metaRows.push(
      `<span class="work-deep-meta-chip">${escapeHtml(loginCopy("Run"))} · ${escapeHtml(sourceRunId.slice(0, 12))}</span>`
    );
  }
  const metaMarkup = metaRows.length
    ? `<div class="work-deep-meta">${metaRows.join("")}</div>`
    : "";
  const engineMarkup = buildWorksCardEngineBreakdownMarkup(work, {
    includeCost: !hideOwnerInfo
  });
  return `
    <div class="work-deep-details">
      ${metaMarkup}
      ${lyricsMarkup}
      ${styleMarkup}
      ${descriptionMarkup}
      ${transcriptMarkup}
      ${engineMarkup}
    </div>
  `;
}

function buildWorksCardCommerceDetailsMarkup(options = {}) {
  const work = options.work || {};
  const usageEvents = Array.isArray(options.usageEvents)
    ? options.usageEvents
    : [];
  const title = String(options.title || work?.title || "").trim();
  const lyricsPreview = String(options.lyricsPreview || "").trim();
  const suggestedListen = Math.max(0, Number(options.suggestedListen || 0));
  const suggestedBuyout = Math.max(0, Number(options.suggestedBuyout || 0));
  const listenCents = Math.max(0, Number(options.listenPriceCents || 0));
  const buyoutCents = Math.max(0, Number(options.buyoutPriceCents || 0));
  const wholeBuyoutOnly = options.wholeBuyoutOnly === true;
  return `
    ${buildWorksCardDeepDetailsMarkup(work, { hideOwnerInfo: false })}
    <div class="work-extra">${escapeHtml(lyricsPreview || title)}</div>
    <div class="work-extra">${escapeHtml(buildWorkMarketReferenceCopy({ suggestedListen, suggestedBuyout, listenCents, buyoutCents, wholeBuyoutOnly }))}</div>
    <div class="work-extra">${escapeHtml(loginCopy("You can price above the reference for premium positioning, or below it for reach."))}</div>
    <div class="work-extra">${escapeHtml(buildWorkAssetStatusCopy(work))}</div>
    ${renderWorkCostBillMarkup(work, usageEvents)}
  `;
}

// Expose the deep-details renderer for other panels (e.g. P2-38 For You
// panel) that want to reuse the layout without the owner-only fields.
globalThis.buildWorksCardDeepDetailsMarkupModule = buildWorksCardDeepDetailsMarkup;
globalThis.buildWorksCardEngineBreakdownMarkupModule = buildWorksCardEngineBreakdownMarkup;

function buildWorksCardActionsMarkup(options = {}) {
  const canWatchWorks = options.canWatchWorks === true;
  const canRegenerateThumbnail = options.canRegenerateThumbnail === true;
  const canRegeneratePreviewVideo = options.canRegeneratePreviewVideo === true;
  return `
    <div class="work-actions">
      <button class="mini-btn ghost" type="button" data-work-action="watch" ${canWatchWorks ? "" : "disabled"}>${loginCopy("Enjoy")}</button>
      <button class="mini-btn ghost tiny" type="button" data-work-action="regen-thumbnail" ${canRegenerateThumbnail ? "" : "disabled"}>${loginCopy("Regen thumb")}</button>
      <button class="mini-btn ghost tiny" type="button" data-work-action="regen-preview-video" ${canRegeneratePreviewVideo ? "" : "disabled"}>${loginCopy("Regen clip")}</button>
    </div>
  `;
}

function mergeLocalAndRemoteWorks(remoteWorks = [], localWorks = []) {
  const safeRemoteWorks = Array.isArray(remoteWorks) ? remoteWorks : [];
  const safeLocalWorks = Array.isArray(localWorks) ? localWorks : [];
  const readWorkIdentity = (work = {}) => ({
    workId: String(work?.work_id || work?.id || work?.local_id || "").trim(),
    sourceRunId: String(work?.source_run_id || "").trim(),
    title: String(work?.title || "").trim(),
    createdAt: String(work?.created_at || "").trim(),
  });
  const sameStructuredRoot = (left = {}, right = {}) => {
    const leftType = normalizeWorkTypeClient(left?.work_type);
    const rightType = normalizeWorkTypeClient(right?.work_type);
    const leftRole = String(left?.structure_role || leftType || "")
      .trim()
      .toLowerCase();
    const rightRole = String(right?.structure_role || rightType || "")
      .trim()
      .toLowerCase();
    if (!["opera", "triptych"].includes(leftRole) || leftRole !== rightRole)
      return false;
    return (
      String(left?.title || "").trim() &&
      String(left?.title || "").trim() === String(right?.title || "").trim()
    );
  };
  const pickPreferredString = (...values) => {
    for (const value of values) {
      const normalized = String(value || "").trim();
      if (normalized) return normalized;
    }
    return "";
  };
  const merged = safeRemoteWorks.map((item) => ({ ...item }));
  safeLocalWorks.forEach((localWork) => {
    const localIdentity = readWorkIdentity(localWork);
    const existingIndex = merged.findIndex((item) => {
      const remoteIdentity = readWorkIdentity(item);
      if (
        remoteIdentity.workId &&
        localIdentity.workId &&
        remoteIdentity.workId === localIdentity.workId
      ) {
        return true;
      }
      if (
        remoteIdentity.sourceRunId &&
        localIdentity.sourceRunId &&
        remoteIdentity.sourceRunId === localIdentity.sourceRunId
      ) {
        return true;
      }
      return Boolean(
        remoteIdentity.title &&
        localIdentity.title &&
        remoteIdentity.createdAt &&
        localIdentity.createdAt &&
        remoteIdentity.title === localIdentity.title &&
        remoteIdentity.createdAt === localIdentity.createdAt,
      );
    });
    if (existingIndex >= 0) {
      const remoteWork = merged[existingIndex] || {};
      merged[existingIndex] = {
        ...localWork,
        ...remoteWork,
        work_id: pickPreferredString(
          remoteWork?.work_id,
          localWork?.work_id,
          localWork?.local_id,
        ),
        local_id: pickPreferredString(
          localWork?.local_id,
          remoteWork?.local_id,
          remoteWork?.work_id,
        ),
        source_run_id: pickPreferredString(
          remoteWork?.source_run_id,
          localWork?.source_run_id,
        ),
        title: pickPreferredString(remoteWork?.title, localWork?.title),
        style: pickPreferredString(remoteWork?.style, localWork?.style),
        description: pickPreferredString(
          remoteWork?.description,
          localWork?.description,
        ),
        lyrics_text: pickPreferredString(
          localWork?.lyrics_text,
          remoteWork?.lyrics_text,
        ),
        lyrics_preview: pickPreferredString(
          localWork?.lyrics_preview,
          remoteWork?.lyrics_preview,
        ),
        cover_image: pickPreferredString(
          remoteWork?.cover_image,
          localWork?.cover_image,
        ),
        preview_image_url: pickPreferredString(
          remoteWork?.preview_image_url,
          localWork?.preview_image_url,
        ),
        preview_video_url: pickPreferredString(
          remoteWork?.preview_video_url,
          localWork?.preview_video_url,
        ),
        preview_video_asset_key: pickPreferredString(
          remoteWork?.preview_video_asset_key,
          localWork?.preview_video_asset_key,
        ),
        owner_name: pickPreferredString(
          remoteWork?.owner_name,
          localWork?.owner_name,
        ),
        owner_email: pickPreferredString(
          remoteWork?.owner_email,
          localWork?.owner_email,
        ),
        owner_handle: pickPreferredString(
          remoteWork?.owner_handle,
          localWork?.owner_handle,
        ),
        created_at: pickPreferredString(
          remoteWork?.created_at,
          localWork?.created_at,
        ),
        parent_work_id: pickPreferredString(
          remoteWork?.parent_work_id,
          localWork?.parent_work_id,
        ),
        root_work_id: pickPreferredString(
          remoteWork?.root_work_id,
          localWork?.root_work_id,
        ),
        structure_plan:
          remoteWork?.structure_plan &&
          typeof remoteWork.structure_plan === "object"
            ? remoteWork.structure_plan
            : localWork?.structure_plan,
        children:
          Array.isArray(remoteWork?.children) && remoteWork.children.length
            ? remoteWork.children
            : Array.isArray(localWork?.children)
              ? localWork.children
              : [],
      };
    } else {
      const shadowsRemoteStructuredRoot = merged.some((remoteWork) =>
        sameStructuredRoot(remoteWork, localWork),
      );
      if (shadowsRemoteStructuredRoot) {
        return;
      }
      merged.unshift(localWork);
    }
  });
  return merged;
}

// CSSOS_PHASE2_NO_AUTO_THUMB_GEN 20260505 — Jing
// "请取消重新生成所有可见的缩略图功能，怪不得，乱耗费那么多的算力，
//  金钱…那些旧的测试用的作品，缺啥就缺啥啦，不再补救".
// Auto thumbnail generation removed entirely. The hydrator now ONLY
// promotes a real cover (server-provided URL or locally-cached image)
// when one is available; works without a cover keep whatever the
// initial render put there (text fallback). No more /api/cssmv/thumbnail
// OpenAI calls fanned out per scroll. The "Regen Thumb" per-card button
// stays so the user can still manually regenerate one work at a time.
async function hydrateWorksCardThumbnails(container, works) {
  if (!(container instanceof Element) || !Array.isArray(works)) return;
  for (const work of works) {
    const workId = String(
      work?.work_id || work?.id || work?.local_id || "",
    ).trim();
    if (!workId) continue;
    const cover = container.querySelector(
      `[data-work-cover-key="${CSS.escape(workId)}"]`,
    );
    if (!(cover instanceof HTMLElement)) continue;
    const title = String(work?.title || "").trim() || "CSS MV";
    const currentImage = String(
      cover.querySelector("img")?.getAttribute("src") || "",
    ).trim();
    const fastImage = globalThis.resolveWorkCardThumbnailImageModule?.(work) || "";
    if (fastImage && currentImage !== fastImage) {
      cover.innerHTML = `<img src="${escapeHtml(fastImage)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" />`;
    }
    // Note: previously, when fastImage was missing OR was a synthetic
    // placeholder, we'd fall through to OpenAI image-gen. That is the
    // path Jing asked us to kill — every test work without a cover
    // stays a text-fallback tile, no OpenAI calls.
  }
}

async function hydrateMarketCardThumbnails(container, works) {
  // CSSOS_PHASE2_NO_AUTO_THUMB_GEN 20260505 — same removal as the
  // Works Center hydrator. Marketplace covers are promoted from the
  // server-provided image only; never OpenAI-generated on scroll.
  if (!(container instanceof Element) || !Array.isArray(works)) return;
  for (const work of works) {
    const workId = String(work?.id || work?.work_id || "").trim();
    if (!workId) continue;
    const cover = container.querySelector(
      `[data-market-cover-key="${CSS.escape(workId)}"]`,
    );
    if (!(cover instanceof HTMLElement)) continue;
    const title = String(work?.title || "").trim() || "CSS MV";
    const currentImage = String(
      cover.querySelector("img")?.getAttribute("src") || "",
    ).trim();
    const fastImage = globalThis.resolveWorkCardThumbnailImageModule?.(work) || "";
    if (fastImage && currentImage !== fastImage) {
      cover.innerHTML = `<img src="${escapeHtml(fastImage)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" />`;
    }
  }
}

function bindWorksCardExpandToggle(list) {
  if (!(list instanceof Element)) return;
  list.querySelectorAll("[data-work-expand]").forEach((card) => {
    card.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-work-toggle]")) return;
      card.classList.toggle("is-expanded");
    });
  });
}

function bindWorksCardActionButtons(list, sortedWorks, options = {}) {
  if (!(list instanceof Element) || !Array.isArray(sortedWorks)) return;
  const canWatchWorks = options.canWatchWorks === true;
  const canRegenerateThumbnail = options.canRegenerateThumbnail === true;
  const canRegeneratePreviewVideo = options.canRegeneratePreviewVideo === true;
  const openWatchFromCard = async (target) => {
    if (!canWatchWorks) {
      showToast(permissionPrompt("works.watch"));
      return;
    }
    const card = target?.closest?.("[data-work-id]");
    const rootWorkId = String(card?.getAttribute("data-work-id") || "").trim();
    const childWorkId = String(target?.getAttribute?.("data-work-child-id") || "").trim();
    const rootWork =
      findRootWorkForPlaybackModule(sortedWorks, rootWorkId || childWorkId) ||
      findRootWorkForPlaybackModule(sortedWorks, childWorkId);
    if (!rootWork) {
      await openWatchPreviewFlowModule({ preferredTab: "mv" });
      return;
    }
    const playbackWork = childWorkId
      ? { ...rootWork, requested_start_work_id: childWorkId }
      : { ...rootWork };
    playbackWork.__cssosOpenedFrom = "works-center";
    await openMarketWorkPreview(playbackWork);
  };

  list.querySelectorAll("[data-work-action='watch']").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await openWatchFromCard(button);
    });
  });

  list.querySelectorAll("[data-work-open-watch]").forEach((cover) => {
    cover.addEventListener("click", async (event) => {
      event.stopPropagation();
      await openWatchFromCard(cover);
    });
  });

  // CSSOS_WAVE_172 — album thumb-strip: each button opens the
  // specific CHILD part in the watch panel (not the umbrella root).
  list.querySelectorAll("[data-work-album-child]").forEach((thumb) => {
    thumb.addEventListener("click", async (event) => {
      event.stopPropagation();
      event.preventDefault();
      const cid = String(thumb.getAttribute("data-work-album-child") || "").trim();
      if (!cid) return;
      try {
        if (typeof globalThis.openMarketWorkPreview === "function") {
          globalThis.openMarketWorkPreview({ id: cid, work_id: cid });
          return;
        }
      } catch (_) { /* fall through */ }
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("cssMV", cid);
        window.location.href = url.toString();
      } catch (_) {
        window.location.href = "/?cssMV=" + encodeURIComponent(cid);
      }
    });
  });

  list
    .querySelectorAll("[data-work-action='regen-thumbnail']")
    .forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (!canRegenerateThumbnail) {
          showToast(permissionPrompt("works.thumbnail.regen"));
          return;
        }
        const card = button.closest("[data-work-id]");
        const workId = String(card?.getAttribute("data-work-id") || "").trim();
        const work = sortedWorks.find(
          (item) =>
            String(item?.work_id || item?.id || item?.local_id || "").trim() ===
            workId,
        );
        if (!work) return;
        await regenerateWorkThumbnail(work, button);
      });
    });

  list
    .querySelectorAll("[data-work-action='regen-preview-video']")
    .forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (!canRegeneratePreviewVideo) {
          showToast(permissionPrompt("works.preview_video.regen"));
          return;
        }
        const card = button.closest("[data-work-id]");
        const workId = String(card?.getAttribute("data-work-id") || "").trim();
        const work = sortedWorks.find(
          (item) =>
            String(item?.work_id || item?.id || item?.local_id || "").trim() ===
            workId,
        );
        if (!work) return;
        await regenerateWorkPreviewVideo(work, button);
      });
    });
}

function bindWorksCardEditorControls(list, options = {}) {
  if (!(list instanceof Element)) return;
  const canEditWorkType = options.canEditWorkType === true;
  const canEditWorkPrices = options.canEditWorkPrices === true;
  const canEditWorkVisibility = options.canEditWorkVisibility === true;

  list.querySelectorAll("[data-work-type]").forEach((select) => {
    select.addEventListener("change", (event) => {
      if (!canEditWorkType) return;
      event.stopPropagation();
      const target = event.currentTarget;
      if (!(target instanceof HTMLSelectElement)) return;
      const defaults = workTypePricingDefaults(target.value);
      const card = target.closest("[data-work-id]");
      const listenInput = card?.querySelector('[data-work-price="listen"]');
      const buyoutInput = card?.querySelector('[data-work-price="buyout"]');
      const visibilityInput = card?.querySelector("[data-work-visibility]");
      if (listenInput instanceof HTMLInputElement)
        listenInput.value = (defaults.listenCents / 100).toFixed(2);
      if (buyoutInput instanceof HTMLInputElement)
        buyoutInput.value = (defaults.buyoutCents / 100).toFixed(2);
      void saveWorkPricing(
        card?.getAttribute("data-work-id") || "",
        listenInput,
        buyoutInput,
        target,
        visibilityInput,
      );
    });
  });

  list
    .querySelectorAll('[data-work-price="listen"], [data-work-price="buyout"]')
    .forEach((input) => {
      input.addEventListener("blur", (event) => {
        if (!canEditWorkPrices) return;
        event.stopPropagation();
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        const card = target.closest("[data-work-id]");
        const workId = card?.getAttribute("data-work-id") || "";
        if (!workId) return;
        const listenInput = card?.querySelector('[data-work-price="listen"]');
        const buyoutInput = card?.querySelector('[data-work-price="buyout"]');
        const workTypeInput = card?.querySelector("[data-work-type]");
        const visibilityInput = card?.querySelector("[data-work-visibility]");
        void saveWorkPricing(
          workId,
          listenInput,
          buyoutInput,
          workTypeInput,
          visibilityInput,
        );
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget?.blur?.();
      });
    });

  list.querySelectorAll("[data-work-visibility]").forEach((select) => {
    select.addEventListener("change", (event) => {
      if (!canEditWorkVisibility) return;
      event.stopPropagation();
      const target = event.currentTarget;
      if (!(target instanceof HTMLSelectElement)) return;
      const card = target.closest("[data-work-id]");
      const workId = card?.getAttribute("data-work-id") || "";
      if (!workId) return;
      const listenInput = card?.querySelector('[data-work-price="listen"]');
      const buyoutInput = card?.querySelector('[data-work-price="buyout"]');
      const workTypeInput = card?.querySelector("[data-work-type]");
      void saveWorkPricing(
        workId,
        listenInput,
        buyoutInput,
        workTypeInput,
        target,
      );
    });
  });
}

async function saveWorkPricing(
  workId,
  listenInput,
  buyoutInput,
  workTypeInput,
  visibilityInput,
) {
  if (!workId || !(listenInput instanceof HTMLInputElement)) return;
  const listenPriceCents = centsFromPriceInput(listenInput.value);
  const buyoutPriceCents =
    buyoutInput instanceof HTMLInputElement
      ? centsFromPriceInput(buyoutInput.value)
      : 0;
  const workType =
    workTypeInput instanceof HTMLSelectElement
      ? normalizeWorkTypeClient(workTypeInput.value)
      : null;
  const visibility =
    visibilityInput instanceof HTMLSelectElement
      ? visibilityInput.value === "private"
        ? "private"
        : "public"
      : "public";
  if (listenPriceCents <= 0) {
    showToast(
      loginCopy(
        "Listen price must be greater than $0.00.",
      ),
    );
    listenInput.focus();
    return;
  }
  try {
    listenInput.dataset.saving = "true";
    if (buyoutInput instanceof HTMLInputElement)
      buyoutInput.dataset.saving = "true";
    if (visibilityInput instanceof HTMLSelectElement)
      visibilityInput.dataset.saving = "true";
    const res = await fetch(
      `/api/works/${encodeURIComponent(workId)}/pricing`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          listen_price_cents: listenPriceCents,
          buyout_price_cents: buyoutPriceCents,
          buyout_enabled: buyoutPriceCents > 0,
          work_type: workType,
          visibility,
        }),
      },
    );
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      throw new Error(payload?.code || `pricing_save_failed:${res.status}`);
    }
    await refreshWorkSurfaces();
    broadcastWorksCommerceRefresh({ includeMarket: true });
    showToast(loginCopy("Pricing updated."));
  } catch (_err) {
    showToast(loginCopy("Failed to save pricing."));
  } finally {
    delete listenInput.dataset.saving;
    if (buyoutInput instanceof HTMLInputElement)
      delete buyoutInput.dataset.saving;
    if (visibilityInput instanceof HTMLSelectElement)
      delete visibilityInput.dataset.saving;
  }
}

function syncApiBillingCommerceControls(options = {}) {
  const canManageBilling = options.canManageBilling === true;
  const balanceCents = Number(billingState.balance_cents || 0);
  const pendingBalanceCents = Number(billingState.pending_balance_cents || 0);
  if (apiCreditBalance) {
    const availableText = `$${(balanceCents / 100).toFixed(2)}`;
    if (pendingBalanceCents > 0) {
      const releaseDate = billingState.pending_balance_release_at
        ? new Date(String(billingState.pending_balance_release_at)).toLocaleDateString()
        : "";
      apiCreditBalance.innerHTML = `
        <div>${escapeHtml(availableText)}</div>
        <div class="works-note">${escapeHtml(
          releaseDate
            ? loginCopy(
                `Pending release: $${(pendingBalanceCents / 100).toFixed(2)} on ${releaseDate}`
              )
            : loginCopy(
                `Pending release: $${(pendingBalanceCents / 100).toFixed(2)}`
              )
        )}</div>
      `;
    } else {
      apiCreditBalance.textContent = availableText;
    }
  }
  if (apiAddFundsBtn) {
    apiAddFundsBtn.disabled = !canManageBilling;
    apiAddFundsBtn.hidden = !canManageBilling;
  }
  if (apiAutoRecharge) apiAutoRecharge.disabled = !canManageBilling;
  if (apiMonthlyLimit) apiMonthlyLimit.disabled = !canManageBilling;
  if (apiPaymentMethod) apiPaymentMethod.disabled = !canManageBilling;
  if (
    apiMonthlyLimit &&
    canManageBilling &&
    Number.isFinite(Number(billingState.monthly_limit_cents))
  ) {
    apiMonthlyLimit.value = (
      Number(billingState.monthly_limit_cents) / 100
    ).toFixed(0);
  }
}

function buildProfileCommerceMarkup(options = {}) {
  const commerce = watchCommerceState.payload || null;
  const studio = commerce?.studio || null;
  const workspace = studio?.workspace || null;
  const workspaceMembers = Array.isArray(studio?.members) ? studio.members : [];
  const workspaceProjects = Array.isArray(studio?.projects)
    ? studio.projects.slice(0, 5)
    : [];
  const workspaceEnabled = canUseStudioWorkspaceClient();
  const queueLane =
    studio?.workspace?.queue_lane ||
    commerce?.profile?.queue_lane ||
    getMembershipPreset().queuePriority;
  return workspaceEnabled
    ? `
      <div class="profile-account-latest">
        <div class="profile-mini-card">
          <div class="profile-mini-label">${loginCopy("Studio workspace")}</div>
          <div class="profile-mini-value">${escapeHtml(String(workspace?.name || loginCopy("Preparing workspace...")))}</div>
          <div class="profile-account-meta">${escapeHtml(formatQueueLaneLabel(queueLane))}</div>
          <div class="profile-account-meta">${escapeHtml(loginCopy(`Members ${workspaceMembers.length}`))} · ${escapeHtml(loginCopy(`Projects ${workspaceProjects.length}`))}</div>
          <div class="profile-account-meta">${escapeHtml(loginCopy("Studio and above use dedicated production queues instead of the free/basic lanes."))}</div>
          <div class="profile-account-meta">
            ${
              studio?.can_collaborate
                ? `<button class="mini-btn ghost" type="button" data-studio-member-add>${loginCopy("Add member")}</button>`
                : loginCopy(
                    "Team collaboration is currently disabled by the system administrator.",
                  )
            }
            ${
              studio?.can_create_projects
                ? `<button class="mini-btn ghost" type="button" data-studio-project-create>${loginCopy("New project")}</button>`
                : ""
            }
          </div>
        </div>
        <div class="profile-mini-card">
          <div class="profile-mini-label">${loginCopy("Latest projects")}</div>
          <div class="profile-mini-value">${workspaceProjects.length ? escapeHtml(String(workspaceProjects[0]?.title || "")) : escapeHtml(loginCopy("No projects yet"))}</div>
          <div class="profile-account-meta">${
            workspaceProjects.length
              ? workspaceProjects
                  .map(
                    (project) =>
                      `${escapeHtml(String(project.title || ""))} · ${escapeHtml(formatQueueLaneLabel(project.queue_lane || queueLane))}`,
                  )
                  .join("<br />")
              : escapeHtml(
                  loginCopy(
                    "Create a Studio/Enterprise project here to keep productions organized.",
                  ),
                )
          }</div>
          <button class="mini-btn ghost" type="button" data-studio-open-api>${loginCopy("View enterprise/API lane")}</button>
        </div>
      </div>
    `
    : `
      <div class="profile-account-meta">
        ${loginCopy(
          "Studio and Enterprise memberships unlock team workspace, project lists, and dedicated production lanes.",
        )}
      </div>
    `;
}

function bindProfileCommerceActions(summary) {
  if (!(summary instanceof Element)) return;
  summary
    .querySelector("[data-studio-open-api]")
    ?.addEventListener("click", () => openPanel(apiPanel));
  summary
    .querySelector("[data-studio-project-create]")
    ?.addEventListener("click", async () => {
      const title = window.prompt(
        loginCopy("New project title"),
      );
      if (!title) return;
      await createStudioProject(title);
    });
  summary
    .querySelector("[data-studio-member-add]")
    ?.addEventListener("click", async () => {
      const email = window.prompt(
        loginCopy("Invite teammate email"),
      );
      if (!email) return;
      await inviteStudioWorkspaceMember(email);
    });
}

function ensureProfileCommerceLoaded() {
  if (!watchCommerceState.loaded && !watchCommerceState.loading) {
    void loadWatchCommerce().then(() => renderProfilePanel());
  }
}

function formatCinemaBookingBriefHtml(value) {
  return escapeHtml(String(value || "").trim()).replace(/\n/g, "<br />");
}

function renderCinemaBookingBriefMarkup(entry) {
  const brief = String(entry?.brief || "").trim();
  if (!brief) return "";
  const collapsed =
    brief.length > 220 ? `${brief.slice(0, 220).trimEnd()}...` : brief;
  const expandable = collapsed !== brief;
  return `
    <div class="api-cinema-booking-brief-preview" data-cinema-booking-brief ${expandable ? 'tabindex="0" role="button" aria-expanded="false"' : ""}>
      <div class="api-cinema-booking-brief-label">${escapeHtml(loginCopy("Creative brief"))}</div>
      <div class="api-cinema-booking-brief-copy" data-cinema-booking-brief-collapsed ${expandable ? "" : "hidden"}>${formatCinemaBookingBriefHtml(collapsed)}</div>
      <div class="api-cinema-booking-brief-copy" data-cinema-booking-brief-full ${expandable ? "hidden" : ""}>${formatCinemaBookingBriefHtml(brief)}</div>
      ${
        expandable
          ? `<div class="api-cinema-booking-brief-hint" data-cinema-booking-brief-hint>${escapeHtml(loginCopy("Click to show full brief"))}</div>`
          : ""
      }
    </div>
  `;
}

function renderApiBillingCommerceSections(apiBody, options = {}) {
  if (!(apiBody instanceof Element)) return;
  const canUseBilling = options.canUseBilling !== false;
  syncApiBillingCommerceControls(options);
  const commerce = watchCommerceState.payload || null;
  const enterprise = commerce?.enterprise_api || null;
  const queueLane =
    enterprise?.queue_lane ||
    commerce?.profile?.queue_lane ||
    getMembershipPreset().queuePriority;
  const usageEvents = Array.isArray(commerce?.usage_events)
    ? commerce.usage_events
    : [];
  const ledgerEntries = Array.isArray(commerce?.ledger_entries)
    ? commerce.ledger_entries
    : [];
  const cinemaBookings = Array.isArray(commerce?.cinema_bookings)
    ? commerce.cinema_bookings
    : [];

  let laneCard = apiBody.querySelector(".api-queue-card");
  if (!laneCard) {
    laneCard = document.createElement("div");
    laneCard.className = "api-guest-notice api-queue-card";
    apiBody.appendChild(laneCard);
  }
  laneCard.innerHTML = `
    <strong>${escapeHtml(loginCopy("Current production lane"))}</strong>
    <div>${escapeHtml(formatQueueLaneLabel(queueLane))}</div>
    <div>${escapeHtml(loginCopy("Pro and above now use separate queue lanes, so paid production no longer mixes with guest/basic traffic."))}</div>
  `;

  let enterpriseCard = apiBody.querySelector(".api-enterprise-card");
  if (canUseEnterpriseApiClient()) {
    if (!enterpriseCard) {
      enterpriseCard = document.createElement("div");
      enterpriseCard.className = "api-guest-notice api-enterprise-card";
      apiBody.appendChild(enterpriseCard);
    }
    const usage = enterprise?.usage || null;
    const recentRoutes = Array.isArray(usage?.recent_routes)
      ? usage.recent_routes.slice(0, 4)
      : [];
    enterpriseCard.innerHTML = `
      <strong>${escapeHtml(loginCopy("Enterprise API lane"))}</strong>
      <div>${escapeHtml(enterprise?.enabled ? loginCopy("Enabled") : loginCopy("Disabled by admin"))}</div>
      <div>${escapeHtml(loginCopy(`Rate limit ${Number(usage?.rpm_limit || 0)} req/min`))}</div>
      <div>${escapeHtml(loginCopy(`Used this minute ${Number(usage?.used_this_minute || 0)}, remaining ${Number(usage?.remaining_this_minute || 0)}`))}</div>
      <div>${recentRoutes.length ? recentRoutes.map((entry) => escapeHtml(String(entry.route || ""))).join("<br />") : escapeHtml(loginCopy("No recent enterprise API routes yet."))}</div>
    `;
  } else if (enterpriseCard) {
    enterpriseCard.remove();
  }

  // CSSOS_PHASE2_BYOK 20260420 — Task #70: Runway / ElevenLabs / Stability
  // BYOK entrance lives in the API panel, right after the queue / enterprise
  // status cards, so creators who care about cost see it next to their plan
  // and balance. `renderEngineAccountsCard` is defined in
  // public/app.engine-accounts.js and hits /api/settings/engine-keys.
  if (typeof renderEngineAccountsCard === "function") {
    // fire-and-forget — the card handles its own loading skeleton.
    renderEngineAccountsCard(apiBody);
  }

  let billingHistoryCard = apiBody.querySelector(".api-billing-history-card");
  if (!billingHistoryCard) {
    billingHistoryCard = document.createElement("div");
    billingHistoryCard.className = "api-guest-notice api-billing-history-card";
    apiBody.appendChild(billingHistoryCard);
  }
  billingHistoryCard.innerHTML = `
    <strong>${escapeHtml(loginCopy("Action charge history"))}</strong>
    <div>${escapeHtml(loginCopy("Every billable compute action is listed here so creators can see where server cost was spent."))}</div>
    <div class="watch-activity compact">${renderUsageHistoryMarkup(usageEvents, loginCopy("No billable action rows yet."), 10)}</div>
  `;

  let ledgerHistoryCard = apiBody.querySelector(".api-ledger-history-card");
  if (!ledgerHistoryCard) {
    ledgerHistoryCard = document.createElement("div");
    ledgerHistoryCard.className = "api-guest-notice api-ledger-history-card";
    apiBody.appendChild(ledgerHistoryCard);
  }
  ledgerHistoryCard.innerHTML = `
    <strong>${escapeHtml(loginCopy("Ledger history"))}</strong>
    <div>${escapeHtml(loginCopy("Credits, debits, and settlement movements appear here."))}</div>
    <div class="watch-activity compact">${renderLedgerHistoryMarkup(ledgerEntries, loginCopy("No ledger records yet."), 10)}</div>
  `;

  let cinemaCard = apiBody.querySelector(".api-cinema-booking-card");
  if (!cinemaCard) {
    cinemaCard = document.createElement("div");
    cinemaCard.className = "api-guest-notice api-cinema-booking-card";
    apiBody.appendChild(cinemaCard);
  }
  const cinemaPriceCents = Math.max(
    0,
    Number(
      commerce?.billable_actions?.cinemaBookingCents ||
        getBillableActionPricing().cinema_booking ||
        0,
    ),
  );
  cinemaCard.innerHTML = `
    <strong>${escapeHtml(loginCopy("Cinema booking / contract intake"))}</strong>
    <div>${escapeHtml(loginCopy("Use this entrance for film-grade, long-form, or contract-required production. Submission creates a real intake record for studio follow-up."))}</div>
    <div class="api-cinema-grid">
      <label><span>${escapeHtml(loginCopy("Project title"))}</span><input type="text" maxlength="160" data-cinema-booking="title" placeholder="${escapeHtml(loginCopy("Feature / campaign title"))}" /></label>
      <label><span>${escapeHtml(loginCopy("Requested duration (minutes)"))}</span><input type="number" min="1" max="1440" step="1" data-cinema-booking="duration" /></label>
      <label><span>${escapeHtml(loginCopy("Contact email"))}</span><input type="email" maxlength="160" data-cinema-booking="email" value="${escapeHtml(String(authState.user?.email || ""))}" /></label>
      <label><span>${escapeHtml(loginCopy("Contact handle"))}</span><input type="text" maxlength="160" data-cinema-booking="handle" placeholder="${escapeHtml(loginCopy("WeChat / Telegram / phone note"))}" /></label>
      <label><span>${escapeHtml(loginCopy("Budget (USD)"))}</span><input type="number" min="0" max="1000000000" step="10000" data-cinema-booking="budget" /></label>
      <div class="api-cinema-note">${escapeHtml(loginCopy(`Current intake price policy: ${formatUsdFromCents(cinemaPriceCents, "$0.00")} configured.`))}</div>
    </div>
    <label class="api-cinema-brief">
      <span>${escapeHtml(loginCopy("Creative brief"))}</span>
      <textarea rows="5" maxlength="4000" data-cinema-booking="brief" placeholder="${escapeHtml(loginCopy("Describe story scope, style, delivery expectations, language/voice needs, and contract notes."))}"></textarea>
    </label>
    <div class="api-cinema-actions">
      <button class="mini-btn ghost" type="button" data-cinema-booking-submit ${authState.user ? "" : "disabled"}>${escapeHtml(loginCopy("Submit booking"))}</button>
      <div class="api-cinema-status" data-cinema-booking-status>${escapeHtml(authState.user ? loginCopy("Submission will create a real booking intake row and stay visible below.") : loginCopy("Sign in first to submit a cinema booking."))}</div>
    </div>
    <div class="watch-activity compact">${
      cinemaBookings.length
        ? cinemaBookings
            .slice(0, 6)
            .map(
              (entry) => `
              <div class="watch-activity-item">
                <div class="watch-activity-title">${escapeHtml(String(entry?.project_title || loginCopy("Cinema booking")))}</div>
                <div class="watch-activity-meta">${escapeHtml(`${String(entry?.status || "submitted")} · ${formatUsdFromCents(Number(entry?.budget_cents || 0), "$0.00")} · ${formatDateTime(entry?.created_at)}`)}</div>
                ${renderCinemaBookingBriefMarkup(entry)}
              </div>
            `,
            )
            .join("")
        : `<div class="watch-activity-empty">${escapeHtml(loginCopy("No cinema booking requests yet."))}</div>`
    }</div>
  `;
  seedCinemaBookingForm(apiBody);
  cinemaCard
    .querySelector("[data-cinema-booking-submit]")
    ?.addEventListener("click", (event) => {
      void submitCinemaBookingRequest(event.currentTarget);
    });
  cinemaCard.querySelectorAll("[data-cinema-booking-brief]").forEach((node) => {
    if (
      !(node instanceof HTMLElement) ||
      node.getAttribute("role") !== "button"
    )
      return;
    const toggle = () => {
      const expanded = node.getAttribute("aria-expanded") === "true";
      const nextExpanded = !expanded;
      node.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
      node
        .querySelector("[data-cinema-booking-brief-collapsed]")
        ?.toggleAttribute("hidden", nextExpanded);
      node
        .querySelector("[data-cinema-booking-brief-full]")
        ?.toggleAttribute("hidden", !nextExpanded);
      const hint = node.querySelector("[data-cinema-booking-brief-hint]");
      if (hint instanceof HTMLElement) {
        hint.textContent = nextExpanded
          ? loginCopy("Click to collapse")
          : loginCopy("Click to show full brief");
      }
    };
    node.addEventListener("click", toggle);
    node.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });
  });

  if (
    authState.user &&
    canUseBilling &&
    !watchCommerceState.loaded &&
    !watchCommerceState.loading
  ) {
    void loadWatchCommerce().then(() => renderApiBillingPanel());
  }
}

async function createStudioProject(title) {
  const trimmed = String(title || "")
    .trim()
    .slice(0, 120);
  if (!trimmed) return false;
  try {
    const res = await fetch("/api/studio/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: trimmed, created_via: "profile_panel" }),
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok || raw?.ok === false) {
      const code = raw?.code || "";
      if (code === "PROJECT_LIMIT_REACHED") {
        showToast(
          loginCopy(
            "Project limit reached for this Studio/Enterprise workspace.",
          ),
        );
      } else {
        showToast(
          loginCopy(
            "Unable to create project right now.",
          ),
        );
      }
      return false;
    }
    await loadWatchCommerce(true);
    broadcastCommerceRefresh({ includeApi: true });
    showToast(loginCopy("Project created."));
    return true;
  } catch (_err) {
    showToast(
      loginCopy("Unable to create project right now."),
    );
    return false;
  }
}

async function inviteStudioWorkspaceMember(email, role = "member") {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) return false;
  try {
    const res = await fetch("/api/studio/workspace/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: normalizedEmail, role }),
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok || raw?.ok === false) {
      const code = raw?.code || "";
      if (code === "TARGET_USER_NOT_FOUND") {
        showToast(
          loginCopy(
            "That teammate has not signed in yet.",
          ),
        );
      } else if (code === "TEAM_MEMBER_LIMIT_REACHED") {
        showToast(
          loginCopy(
            "Team member limit reached for this workspace.",
          ),
        );
      } else {
        showToast(
          loginCopy(
            "Unable to add that member right now.",
          ),
        );
      }
      return false;
    }
    await loadWatchCommerce(true);
    broadcastCommerceRefresh({ includeApi: false });
    showToast(loginCopy("Team member added."));
    return true;
  } catch (_err) {
    showToast(
      loginCopy("Unable to add that member right now."),
    );
    return false;
  }
}

async function refreshCreatorBoostSurfaces(options = {}) {
  await loadCreatorBoostState(true).catch(() => null);
  if (options.renderAdvanced !== false && !advancedPanelSettings?.hidden) {
    void renderAdvancedPanelSettings();
  }
}

async function createCreatorBoostCheckout(
  boostKind,
  quantity = 1,
  trigger = null,
) {
  if (!authState.user) {
    openLoginForCreation(
      loginCopy(
        "Sign in first to buy Creator Boosts.",
      ),
    );
    return null;
  }
  const res = await fetch("/api/cssmv/boosts/checkout/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      boost_kind: boostKind,
      quantity,
      requested_from: "advanced_settings",
      creation_snapshot: {
        tier: getAccessTier(),
        language: creationState.language,
        duration_s: creationState.duration,
        work_type: creationState.workType,
      },
    }),
  });
  const payload = await res.json().catch(() => null);
  const data = getApiData(payload);
  if (!res.ok || payload?.ok === false || !data?.checkout_url) {
    throw new Error(
      payload?.message || `creator_boost_checkout_failed:${res.status}`,
    );
  }
  if (trigger instanceof HTMLElement) {
    trigger.dataset.loading = "1";
  }
  window.location.href = String(data.checkout_url);
  return data;
}

// CSSOS_PHASE2_PAYMENTS 20260419 — Dual-gateway dispatcher for Creator Boost
// auto-prompts (thumbnail regen, preview video regen, etc.). When availability
// runs out mid-flow we need to offer both Stripe and NihaoPay vendors instead
// of going straight to Stripe. Returns true if a checkout was opened and the
// browser is navigating away (so callers should abort), false otherwise.
async function dispatchCreatorBoostPayment(boostKind, quantity = 1, trigger = null) {
  const picker = window.cssPaymentsCheckout && typeof window.cssPaymentsCheckout.openPicker === "function"
    ? window.cssPaymentsCheckout.openPicker
    : null;
  const qty = Math.max(1, Math.round(Number(quantity || 1)));
  const pricing = (typeof readPanelBehaviorSettingsLocal === "function"
    ? (readPanelBehaviorSettingsLocal()?.creator_boost || {})
    : {}) || {};
  const unitKey = `${String(boostKind || "").trim().toLowerCase()}_unit_cents`;
  const unitCents = Math.max(1, Math.round(Number(pricing[unitKey] || 0)));
  const totalCents = unitCents * qty;
  const prettyKind = String(boostKind || "").replace(/_/g, " ");
  const title = loginCopy(`Buy ${qty} extra ${prettyKind}`);

  if (!picker) {
    try {
      await createCreatorBoostCheckout(boostKind, qty, trigger);
      return true;
    } catch (_err) {
      return false;
    }
  }
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    picker({
      title,
      amountCents: totalCents,
      stripe: {
        label: loginCopy("Pay with card"),
        onSelect: async () => {
          try {
            await createCreatorBoostCheckout(boostKind, qty, trigger);
            finish(true);
          } catch (_err) {
            finish(false);
          }
        }
      },
      nihaopay: {
        onSelect: (vendor) => {
          try {
            // CSSOS_PHASE2_BOOST_KIND 20260419 — "boost" kind skips the
            // target_creator_id guard (self-purchase, no recipient
            // required). Backend reads boostKind/qty from note.
            window.cssPaymentsCheckout.startCheckout({
              kind: "boost",
              vendor,
              amount_cents: totalCents,
              trigger,
              note: `boost:${boostKind}:${qty}`
            });
            finish(true);
          } catch (_err) {
            finish(false);
          }
        }
      },
      onCancel: () => finish(false)
    });
  });
}

async function consumeSpecificCreatorBoost(
  boostKind,
  quantity = 1,
  reason = "manual_regen",
) {
  const res = await fetch("/api/cssmv/boosts/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ boost_kind: boostKind, quantity, reason }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok === false) {
    throw new Error(
      payload?.code || `creator_boost_consume_failed:${res.status}`,
    );
  }
  await refreshCreatorBoostSurfaces({ renderAdvanced: true });
  return getApiData(payload);
}

async function handleStripeCheckoutReturn() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const mode = String(url.searchParams.get("stripe_checkout") || "").trim();
  const orderId = String(url.searchParams.get("order_id") || "").trim();
  const creatorBoostOrderId = String(
    url.searchParams.get("creator_boost_order_id") || "",
  ).trim();
  if (!mode) return;
  if (mode === "cancel" && orderId && authState.user) {
    try {
      await fetch("/api/stripe/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_id: orderId }),
      });
      await loadPublicMarketWorks(true).catch(() => []);
      broadcastCommerceRefresh({ includeApi: false, includeMarket: true });
      showToast(loginCopy("Checkout canceled."));
    } catch {
      // ignore
    }
  }
  if (mode === "success") {
    void loadPublicMarketWorks(true).then(() =>
      broadcastCommerceRefresh({ includeApi: false, includeMarket: true }),
    );
    if (creatorBoostOrderId && authState.user) {
      void refreshCreatorBoostSurfaces({ renderAdvanced: true });
      showToast(
        loginCopy(
          "Creator Boost purchase completed. Extra capacity is now available in advanced settings.",
        ),
      );
    }
  }
  url.searchParams.delete("stripe_checkout");
  url.searchParams.delete("order_id");
  url.searchParams.delete("creator_boost_order_id");
  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${url.search}${url.hash}`,
  );
}

async function grantAdminEntitlement(trigger = null) {
  const emailInput = advancedPanelSettings?.querySelector(
    '[data-advanced-setting="admin-target-email"]',
  );
  const kindInput = advancedPanelSettings?.querySelector(
    '[data-advanced-setting="admin-entitlement-kind"]',
  );
  const quantityInput = advancedPanelSettings?.querySelector(
    '[data-advanced-setting="admin-entitlement-quantity"]',
  );
  const noteInput = advancedPanelSettings?.querySelector(
    '[data-advanced-setting="admin-entitlement-note"]',
  );
  const email = String(emailInput?.value || "").trim();
  const boostKind = String(kindInput?.value || "")
    .trim()
    .toLowerCase();
  const quantity = Math.max(1, Number(quantityInput?.value || 1));
  const note = String(noteInput?.value || "").trim();
  if (!email || !boostKind) {
    safeShowToast(
      loginCopy(
        "Enter the target email and entitlement type first.",
      ),
    );
    return;
  }
  setButtonBusy(trigger, true);
  try {
    const res = await fetch("/api/admin/entitlements/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, boost_kind: boostKind, quantity, note }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      throw new Error(
        payload?.message || `admin_entitlement_grant_failed:${res.status}`,
      );
    }
    safeShowToast(
      loginCopy("Temporary entitlement granted."),
    );
    await refreshCreatorBoostSurfaces({ renderAdvanced: true });
  } catch (_err) {
    safeShowToast(loginCopy("Failed to grant entitlement."));
  } finally {
    setButtonBusy(trigger, false);
  }
}

function toggleMarketTipInput(card, forceOpen = null) {
  if (!(card instanceof Element)) return;
  const input = card.querySelector("[data-market-tip-input]");
  if (!(input instanceof HTMLInputElement)) return;
  const button = card.querySelector(
    '[data-market-action="tip"], [data-watch-market-action="tip"]',
  );
  const shouldOpen = forceOpen === null ? input.hidden : !!forceOpen;
  input.hidden = !shouldOpen;
  if (button instanceof HTMLButtonElement) button.hidden = shouldOpen;
  if (shouldOpen) {
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 24);
  }
}

async function handleMarketTipBlur(input, triggerButton = null) {
  if (!(input instanceof HTMLInputElement)) return;
  window.setTimeout(async () => {
    const active = document.activeElement;
    if (active === input) return;
    const card = input.closest(
      "[data-market-work-id], .work-hierarchy-item, #watch-commerce-actions",
    );
    const amount = Number(input.value || 0);
    if (Number.isFinite(amount) && amount >= 1) {
      await submitMarketTipFromInput(input, triggerButton);
    }
    toggleMarketTipInput(card, false);
    input.value = "";
  }, 32);
}

async function submitMarketTipFromInput(input, triggerButton = null) {
  if (!(input instanceof HTMLInputElement)) return;
  const card = input.closest("[data-market-work-id]");
  const workId = String(
    input.dataset.marketTipInput ||
      card?.getAttribute("data-market-work-id") ||
      "",
  ).trim();
  if (!workId) return;
  const amount = Number(input.value || 0);
  if (!Number.isFinite(amount) || amount < 1) {
    showToast(loginCopy("Tips start at $1.00."));
    return;
  }
  const amountCents = Math.round(amount * 100);
  const work = findPublicMarketWorkByIdModule(workId);
  const creatorId = String(work?.owner_user_id || "").trim();
  const picker = window.cssPaymentsCheckout && typeof window.cssPaymentsCheckout.openPicker === "function"
    ? window.cssPaymentsCheckout.openPicker
    : null;
  if (!picker) {
    await startStripeCheckoutForWork(workId, "tip", triggerButton || input, {
      tipAmountCents: amountCents,
    });
    return;
  }
  picker({
    title: loginCopy("Tip the creator"),
    amountCents,
    stripe: {
      label: loginCopy("Pay with card"),
      onSelect: () => {
        void startStripeCheckoutForWork(workId, "tip", triggerButton || input, {
          tipAmountCents: amountCents,
        });
      }
    },
    nihaopay: creatorId ? {
      onSelect: (vendor) => {
        window.cssPaymentsCheckout.startCheckout({
          kind: "tip",
          vendor,
          amount_cents: amountCents,
          target_creator_id: creatorId,
          trigger: triggerButton || input,
          note: `tip:${workId}`,
          metadata: { work_id: workId }
        });
      }
    } : undefined
  });
}

// CSSOS_PHASE2_PAYMENTS 20260419 — Dual-gateway dispatcher for listen/buyout.
// Pops the pay-method picker, then routes Stripe through the legacy
// startStripeCheckoutForWork() and NihaoPay through cssPaymentsCheckout.
// The backend already resolves price server-side for Stripe; for NihaoPay we
// must pass an explicit amount_cents, so we look up the current work price
// from publicMarketState (which is kept fresh by the marketplace renderer).
function findPublicMarketWorkByIdModule(workId) {
  const needle = String(workId || "").trim();
  if (!needle) return null;
  const works = Array.isArray(publicMarketState?.works) ? publicMarketState.works : [];
  const flat = typeof flattenHierarchyWorks === "function"
    ? flattenHierarchyWorks(works)
    : works;
  for (const entry of flat) {
    const id = String(entry?.id || entry?.work_id || "").trim();
    if (id && id === needle) return entry;
  }
  return null;
}

async function dispatchMarketWorkPayment(workId, orderKind, button) {
  const id = String(workId || "").trim();
  if (!id) return;
  const kind = String(orderKind || "").trim().toLowerCase();
  // CSSOS_WAVE_113B3 20260512 — Tip flow: open a unified picker with
  // amount input + Stripe (international) + NihaoPay (Alipay/WeChat/
  // UnionPay) so the user never leaves cinema/fullscreen mode.
  if (kind === "tip" || kind === "tip-nihaopay") {
    if (!isLoggedInUser()) {
      showToast(loginCopy("Please sign in first."));
      try { openPanel(loginPanel); } catch (_e) {}
      return;
    }
    const tipWork = findPublicMarketWorkByIdModule(id) || {};
    const tipCreatorId = String(tipWork?.owner_user_id || "").trim();
    const tipPicker = window.cssPaymentsCheckout && typeof window.cssPaymentsCheckout.openPicker === "function"
      ? window.cssPaymentsCheckout.openPicker
      : null;
    if (!tipPicker) {
      await startStripeCheckoutForWork(id, "tip", button, { tipAmountCents: 200 });
      return;
    }
    // Default suggested tip: $2.00. User can override.
    const defaultTipCents = 200;
    tipPicker({
      title: loginCopy("Tip the creator"),
      subtitle: loginCopy("Choose an amount and a payment method."),
      amountCents: defaultTipCents,
      allowAmountEdit: true,
      amountMinCents: 100,
      stripe: {
        label: loginCopy("Pay with card"),
        // CSSOS_WAVE_116 — Stripe Payment Element inline (no redirect).
        // confirmPayment runs with redirect:"if_required", so non-3DS
        // cards complete without leaving cinema/fullscreen mode.
        inline: true,
        intentRequest: {
          work_id: id,
          order_kind: "tip",
          tip_amount_cents: defaultTipCents,
        },
        onSelect: (btn, ctx) => {
          // Legacy fallback if Stripe.js fails to load
          void startStripeCheckoutForWork(id, "tip", btn || button, {
            tipAmountCents: (ctx && ctx.amount_cents) || defaultTipCents,
          });
        }
      },
      nihaopay: tipCreatorId ? {
        onSelect: (vendor, btn, ctx) => {
          window.cssPaymentsCheckout.startCheckout({
            kind: "tip",
            vendor,
            amount_cents: (ctx && ctx.amount_cents) || defaultTipCents,
            target_creator_id: tipCreatorId,
            trigger: btn || button,
            note: `tip:${id}`,
            metadata: { work_id: id }
          });
        }
      } : undefined
    });
    return;
  }
  if (kind !== "listen" && kind !== "buyout") {
    await startStripeCheckoutForWork(id, orderKind, button);
    return;
  }
  if (!isLoggedInUser()) {
    showToast(loginCopy("Please sign in first."));
    try { openPanel(loginPanel); } catch (_e) {}
    return;
  }
  const work = findPublicMarketWorkByIdModule(id);
  const creatorId = String(work?.owner_user_id || "").trim();
  const listenCents = Math.max(0, Number(work?.current_listen_price_cents || work?.listen_price_cents || 0));
  const buyoutCents = Math.max(0, Number(work?.current_buyout_price_cents || work?.buyout_price_cents || 0));
  const amountCents = kind === "buyout" ? buyoutCents : listenCents;
  const title = loginCopy(
    kind === "buyout" ? "Buy out this work" : "Unlock listen access",
  );

  const picker = window.cssPaymentsCheckout && typeof window.cssPaymentsCheckout.openPicker === "function"
    ? window.cssPaymentsCheckout.openPicker
    : null;
  if (!picker) {
    await startStripeCheckoutForWork(id, orderKind, button);
    return;
  }
  picker({
    title,
    amountCents,
    stripe: {
      label: loginCopy("Pay with card"),
      onSelect: () => { void startStripeCheckoutForWork(id, orderKind, button); }
    },
    nihaopay: {
      onSelect: (vendor) => {
        if (!creatorId) {
          showToast(loginCopy("Missing creator — please refresh and try again."));
          return;
        }
        if (!(amountCents > 0)) {
          showToast(loginCopy("This work is not priced yet."));
          return;
        }
        window.cssPaymentsCheckout.startCheckout({
          kind: "purchase",
          vendor,
          amount_cents: amountCents,
          target_creator_id: creatorId,
          target_item_id: id,
          trigger: button,
          note: `${kind}:${id}`,
          metadata: { order_kind: kind, work_id: id }
        });
      }
    }
  });
}

// CSSOS_PHASE2_PAYMENTS 20260419 — NihaoPay tip path (Alipay/WeChat Pay/UnionPay).
// Runs parallel to the existing Stripe tip flow. Triggered by the dedicated
// "Tip · 支付宝/微信" button rendered in renderForyouMarketplace.
async function startNihaoPayTipFromButton(button) {
  if (!(button instanceof HTMLElement)) return;
  if (!window.cssPaymentsCheckout || typeof window.cssPaymentsCheckout.startCheckout !== "function") {
    showToast(loginCopy("Payment gateway not ready. Please refresh."));
    return;
  }
  if (!isLoggedInUser()) {
    showToast(loginCopy("Please sign in first."));
    try { openPanel(loginPanel); } catch (_e) {}
    return;
  }
  const creatorId = String(button.getAttribute("data-market-nihaopay-creator") || "").trim();
  const workId = String(button.getAttribute("data-market-nihaopay-work") || "").trim();
  if (!creatorId) {
    showToast(loginCopy("Missing creator for this tip."));
    return;
  }
  const viewerId = String(authState?.user?.id || "").trim();
  if (viewerId && creatorId === viewerId) {
    showToast(loginCopy("You can't tip yourself."));
    return;
  }
  const picker = typeof window.cssPaymentsCheckout.openPicker === "function"
    ? window.cssPaymentsCheckout.openPicker
    : null;
  if (!picker) {
    showToast(loginCopy("Payment gateway not ready. Please refresh."));
    return;
  }
  picker({
    title: loginCopy("Tip the creator"),
    subtitle: loginCopy("Enter an amount, then choose a payment method."),
    amountCents: 100,
    allowAmountEdit: true,
    amountMinCents: 100,
    // Tips currently only support NihaoPay in this entry point; the standard
    // in-card tip input (blur handler below) offers Stripe alongside the
    // picker, so we don't duplicate it here.
    nihaopay: {
      onSelect: (vendor, _btn, ctx) => {
        const amountCents = Math.max(100, Math.round(Number(ctx?.amount_cents || 0)));
        window.cssPaymentsCheckout.startCheckout({
          kind: "tip",
          vendor,
          amount_cents: amountCents,
          target_creator_id: creatorId,
          trigger: button,
          note: workId ? `tip:${workId}` : "tip",
          metadata: workId ? { work_id: workId } : undefined
        });
      }
    }
  });
}

async function startCreatorPayoutOnboarding(trigger = null) {
  if (!isLoggedInUser()) {
    showToast(loginCopy("Please sign in first."));
    openPanel(loginPanel);
    return;
  }
  try {
    setButtonBusy(trigger, true);
    const res = await fetch("/api/stripe/connect/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        return_url: window.location.href,
        refresh_url: window.location.href,
      }),
    });
    const payload = await res.json().catch(() => null);
    const data = getApiData(payload);
    if (!res.ok || payload?.ok === false || !data?.onboarding_url) {
      throw new Error(
        payload?.code || `stripe_connect_start_failed:${res.status}`,
      );
    }
    window.location.href = String(data.onboarding_url);
  } catch (_err) {
    showToast(
      loginCopy(
        "Open payout setup failed. Please try again.",
      ),
    );
  } finally {
    setButtonBusy(trigger, false);
  }
}

async function consumeCreatorBoostsIfNeeded() {
  const preset = getMembershipPreset();
  const counts = getCreationSelectionCounts();
  const extraLanguages = Math.max(
    0,
    counts.languageCount - preset.maxIncludedLanguages,
  );
  const extraVoices = Math.max(
    0,
    counts.voiceLaneCount - preset.maxIncludedVoiceLanes,
  );
  const tasks = [];
  if (extraLanguages > 0) {
    tasks.push(
      fetch("/api/cssmv/boosts/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          boost_kind: "language",
          quantity: extraLanguages,
          reason: "creation_run",
        }),
      }).then((res) =>
        res
          .json()
          .catch(() => null)
          .then((payload) => ({ res, payload })),
      ),
    );
  }
  if (extraVoices > 0) {
    tasks.push(
      fetch("/api/cssmv/boosts/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          boost_kind: "voice",
          quantity: extraVoices,
          reason: "creation_run",
        }),
      }).then((res) =>
        res
          .json()
          .catch(() => null)
          .then((payload) => ({ res, payload })),
      ),
    );
  }
  if (!tasks.length) return true;
  const results = await Promise.all(tasks);
  const failed = results.find(
    ({ res, payload }) => !res.ok || payload?.ok === false,
  );
  if (failed) {
    await loadCreatorBoostState(true);
    safeShowToast(
      loginCopy(
        "Creator Boost entitlement is insufficient. Please purchase extra capacity first.",
      ),
    );
    return false;
  }
  await loadCreatorBoostState(true);
  return true;
}

async function regenerateWorkThumbnail(work, trigger = null, options = {}) {
  const workId = String(work?.work_id || work?.id || "").trim();
  if (!workId) return false;
  const systemBackfill = options?.systemBackfill === true;
  const suppressToast = options?.suppressToast === true;
  if (!systemBackfill) {
    const availability = getCreatorBoostAvailability();
    if (availability.thumbnail < 1) {
      await dispatchCreatorBoostPayment("thumbnail", 1, trigger);
      return false;
    }
  }
  setButtonBusy(trigger, true);
  try {
    if (!systemBackfill) {
      await consumeSpecificCreatorBoost("thumbnail", 1, "thumbnail_regen");
    }
    const title = String(work?.title || state.title || "CSS MV").trim();
    const subtitle = workCoverSubtitle(work);
    const image = await requestThumbnailDataUrl(
      title,
      subtitle,
      workLyricsLines(work),
    );
    if (!image) throw new Error("thumbnail_regen_failed");
    updateLocalWorkAssets(workId, { cover_image: image });
    await persistWorkAssets(workId, { cover_image: image });
    if (
      currentPersistedRootWorkId === workId ||
      String(
        currentWatchPreviewWork?.id || currentWatchPreviewWork?.work_id || "",
      ).trim() === workId
    ) {
      setForyouThumbImage(image);
      if (currentWatchPreviewWork)
        currentWatchPreviewWork = {
          ...currentWatchPreviewWork,
          cover_image: image,
        };
    }
    broadcastWorksCommerceRefresh({ includeMarket: true });
    if (!suppressToast) {
      showToast(
        systemBackfill
          ? loginCopy("Thumbnail backfilled and saved.")
          : loginCopy("Thumbnail regenerated and saved."),
      );
    }
    return true;
  } catch (_err) {
    if (!suppressToast) {
      showToast(
        systemBackfill
          ? loginCopy("Thumbnail backfill failed.")
          : loginCopy("Thumbnail regeneration failed."),
      );
    }
    return false;
  } finally {
    setButtonBusy(trigger, false);
  }
}

async function regenerateWorkPreviewVideo(work, trigger = null) {
  const workId = String(work?.work_id || work?.id || "").trim();
  if (!workId) return false;
  const availability = getCreatorBoostAvailability();
  if (availability.preview_video < 1) {
    await dispatchCreatorBoostPayment("preview_video", 1, trigger);
    return false;
  }
  setButtonBusy(trigger, true);
  try {
    await consumeSpecificCreatorBoost(
      "preview_video",
      1,
      "preview_video_regen",
    );
    currentPersistedRootWorkId = workId;
    currentWatchPreviewWork = { ...(work || {}) };
    globalThis.cssosBindToWorkId?.(currentWatchPreviewWork); // CSSOS_WAVE_121 Step 2
    state.title = String(work?.title || state.title || "CSS MV").trim();
    state.lines = workLyricsLines(work);
    openWatchPreviewShellModule({ fallbackTab: "mv" });
    requestWatchVideoPreviewModule(state.title, state.lines);
    showToast(
      loginCopy("Preview video regeneration started."),
    );
    return true;
  } catch (_err) {
    showToast(
      loginCopy("Preview video regeneration failed."),
    );
    return false;
  } finally {
    setButtonBusy(trigger, false);
  }
}
