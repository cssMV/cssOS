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
        "温馨提示：请完成收款方式设置，以免错过粉丝打赏、赏金与卖家收入。"
      ),
      action: loginCopy("Finish setup", "完成设置")
    };
  }
  if (!chargesEnabled) {
    return {
      message: loginCopy(
        "Your payout account is connected, but Stripe still needs a few details. Please review and update your payout information.",
        "你的收款账户已经连接，但 Stripe 仍需要补充一些资料，请检查并更新收款信息。"
      ),
      action: loginCopy("Update info", "更新信息")
    };
  }
  return {
    message: loginCopy(
      "Your payout account is already connected. Please review the payout status and update details if Stripe still shows pending steps.",
      "你的收款账户已经连接，请检查收款状态；如果 Stripe 仍显示待完成步骤，请更新资料。"
    ),
    action: loginCopy("Check status", "检查状态")
  };
}

function marketActionCopy(kind, state = {}) {
  if (kind === "listen") {
    if (state.pendingBuyout || state.pendingListen) return loginCopy("Listen pending", "聆听处理中");
    if (state.paidBuyout || state.paidListen) return loginCopy("Owned listen", "已购聆听");
    return loginCopy("Listen", "聆听");
  }
  if (kind === "buyout") {
    if (state.pendingBuyout) return loginCopy("Buyout pending", "买断处理中");
    if (state.paidBuyout) return loginCopy("Owned", "已买断");
    return loginCopy("Buyout", "买断");
  }
  if (kind === "tip") {
    if (state.pendingTip) return loginCopy("Tip pending", "打赏处理中");
    if (state.paidTip) return loginCopy("Tipped", "已打赏");
    return loginCopy("Tip", "打赏");
  }
  return "";
}

function renderSellerPanel() {
  if (!sellerMetrics || !sellerOrdersList || !sellerLedgerList) return;
  const behavior = readPanelBehaviorSettingsLocal();
  const canViewSeller = hasPanelPermission("seller.view");
  const canOperateSeller = hasPanelPermission("seller.operate");
  const canSetupPayout = hasPanelPermission("seller.payout");
  if (!canViewSeller) {
    const upgradeCopy = isLoggedInUser()
      ? loginCopy("Upgrade to a paid membership to unlock seller orders, earnings, and payouts.", "升级到收费会员后可解锁卖家订单、收益和收款。")
      : loginCopy("Sign in first, then upgrade to a paid membership to unlock seller tools.", "请先登录，再升级到收费会员后可解锁卖家工具。");
    sellerMetrics.innerHTML = `<div class="works-note">${upgradeCopy}</div>`;
    sellerOrdersList.innerHTML = `<div class="works-note">${upgradeCopy}</div>`;
    sellerLedgerList.innerHTML = `<div class="works-note">${upgradeCopy}</div>`;
    return;
  }
  const commerce = watchCommerceState.payload || null;
  const connectedAccount = commerce?.connected_account || null;
  const payoutAction = getPayoutActionPresentation(connectedAccount);
  const payoutReminderState = getPayoutReminderPresentation(connectedAccount);
  const showPayoutReminder = watchCommerceState.loaded && isLoggedInUser() && Boolean(payoutReminderState);
  const market = commerce?.market || {};
  const orders = (Array.isArray(market.orders) ? market.orders : []).filter((row) => {
    if (behavior.seller.order_filter === "paid") return String(row?.status || "") === "paid";
    if (behavior.seller.order_filter === "pending") return ["pending", "processing"].includes(String(row?.status || ""));
    return true;
  });
  const ledgerEntries = Array.isArray(commerce?.ledger_entries) ? commerce.ledger_entries : [];
  const gross = orders.reduce((sum, row) => sum + Number(row?.gross_amount_cents || 0), 0);
  const net = orders
    .filter((row) => String(row?.status || "") === "paid")
    .reduce((sum, row) => sum + Number(row?.seller_net_cents || 0), 0);
  const pendingSettle = orders
    .filter((row) => ["pending", "processing"].includes(String(row?.status || "")))
    .reduce((sum, row) => sum + Number(row?.seller_net_cents || 0), 0);
  sellerMetrics.innerHTML = `
    <div class="stat-card"><div class="stat-label">总销售额</div><div class="stat-value">${formatUsdFromCents(gross, "$0.00")}</div></div>
    <div class="stat-card"><div class="stat-label">已确认收入</div><div class="stat-value">${formatUsdFromCents(net, "$0.00")}</div></div>
    <div class="stat-card"><div class="stat-label">待处理</div><div class="stat-value">${formatUsdFromCents(pendingSettle, "$0.00")}</div></div>
    <div class="stat-card"><div class="stat-label">${loginCopy("Mode", "模式")}</div><div class="stat-value">${escapeHtml(canOperateSeller ? loginCopy("Operator", "操作员") : loginCopy("View only", "只读查看"))}</div></div>
  `;
  const payoutReminder =
    showPayoutReminder
      ? `
        <div class="works-note seller-payout-note">
          ${loginCopy(
            payoutReminderState?.message || ""
          )}
          <button class="mini-btn ghost tiny" type="button" data-seller-connect ${canSetupPayout ? "" : "hidden"}>${escapeHtml(payoutAction.label)}</button>
        </div>
      `
      : "";
  const payoutManageAction =
    !showPayoutReminder && payoutAction.visible
      ? `
        <div class="works-note seller-payout-note">
          ${escapeHtml(loginCopy("Need to update your payout destination or review Stripe steps?", "如果你需要更新收款方式或查看 Stripe 待完成步骤，可从这里进入。"))}
          <button class="mini-btn ghost tiny" type="button" data-seller-connect ${canSetupPayout ? "" : "hidden"}>${escapeHtml(payoutAction.label)}</button>
        </div>
      `
      : "";
  sellerOrdersList.innerHTML = orders.length
    ? `${payoutReminder}${payoutManageAction}${!canOperateSeller ? `<div class="works-note">${loginCopy("Seller is currently in view-only mode. Operational actions stay in admin workflows.", "卖家面板当前为只读查看模式，操作类动作保留给管理员流程。")}</div>` : ""}` + orders.slice(0, behavior.seller.ledger_limit).map((row) => `
        <div class="seller-item">
          <div class="seller-item-title">${escapeHtml(String(row?.order_kind || "order"))} · ${formatUsdFromCents(Number(row?.gross_amount_cents || 0), "$0.00")}</div>
          <div class="seller-item-meta">${escapeHtml(String(row?.status || ""))} · ${escapeHtml(formatDateTime(row?.created_at))}</div>
        </div>
      `).join("")
    : `${payoutReminder}${payoutManageAction}<div class="works-note">${loginCopy("No seller orders yet.", "还没有卖家订单。")}</div>`;
  sellerLedgerList.innerHTML = ledgerEntries.length
    ? ledgerEntries.slice(0, behavior.seller.ledger_limit).map((row) => `
        <div class="seller-item">
          <div class="seller-item-title">${formatUsdFromCents(Number(row?.amount_cents || 0), "$0.00")}</div>
          <div class="seller-item-meta">${escapeHtml(String(row?.kind || row?.note || "entry"))} · ${escapeHtml(formatDateTime(row?.created_at))}</div>
        </div>
      `).join("")
    : `<div class="works-note">${loginCopy("No income entries yet.", "还没有收入记录。")}</div>`;
  sellerOrdersList.querySelector("[data-seller-connect]")?.addEventListener("click", (event) => {
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
  try {
    const res = await fetch("/api/works/market?limit=24", { credentials: "include" });
    const payload = await res.json().catch(() => null);
    const data = getApiData(payload);
    if (!res.ok || payload?.ok === false) {
      throw new Error(`market_load_failed:${res.status}`);
    }
    publicMarketState.works = Array.isArray(data?.works) ? data.works : [];
    publicMarketState.marketState =
      data?.market_state && typeof data.market_state === "object" ? data.market_state : null;
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
  }
}

function getPublicMarketEmptyCopy() {
  const reason = String(publicMarketState.marketState?.reason || "").trim().toLowerCase();
  if (reason === "empty_database") {
    return loginCopy(
      "This connected database is empty. No users or works have been imported yet.",
      "当前连接的数据库是空的，还没有导入任何用户或作品数据。"
    );
  }
  if (reason === "no_published_works") {
    return loginCopy(
      "Works exist, but none have been published to the marketplace yet.",
      "当前已有作品，但还没有作品发布到市场。"
    );
  }
  return loginCopy("No public works available yet.", "还没有公开作品可购买。");
}

function buildMarketLoadingNoteMarkup() {
  return `<div class="works-note">${loginCopy("Loading marketplace...", "正在加载市场...")}</div>`;
}

function buildMarketErrorNoteMarkup() {
  return `<div class="works-note">${loginCopy("Marketplace is temporarily unavailable. Please refresh and try again.", "市场暂时不可用，请刷新后再试。")}</div>`;
}

function buildMarketEmptyNoteMarkup() {
  return `<div class="works-note">${getPublicMarketEmptyCopy()}</div>`;
}

function buildMarketSearchShellMarkup() {
  return `
    <div class="panel-search-shell foryou-search-shell">
      <div class="panel-search-meta">${loginCopy("Pull down to search the market", "向下拖动显示市场搜索")}</div>
      <div class="panel-search-row">
        <input id="foryou-market-search" class="panel-search-input" type="search" placeholder="${escapeHtml(loginCopy("Search title, style, owner...", "搜索标题、风格、作者..."))}" />
        <input id="foryou-market-author" class="panel-search-input panel-search-input--narrow" type="search" placeholder="${escapeHtml(loginCopy("Author", "作者"))}" />
        <select id="foryou-market-filter" class="panel-search-select">
          <option value="all">${loginCopy("All", "全部")}</option>
          <option value="single">${loginCopy("Single", "单曲")}</option>
          <option value="triptych">${loginCopy("Triptych", "三部曲")}</option>
          <option value="opera">${loginCopy("Opera", "歌剧")}</option>
          <option value="owned">${loginCopy("Mine", "我的")}</option>
          <option value="public">${loginCopy("Others", "别人的")}</option>
        </select>
        <select id="foryou-market-sort" class="panel-search-select">
          <option value="newest">${loginCopy("Newest", "最新")}</option>
          <option value="oldest">${loginCopy("Oldest", "最早")}</option>
          <option value="title">${loginCopy("Title", "标题")}</option>
          <option value="listen_low">${loginCopy("Low price", "价格低")}</option>
          <option value="listen_high">${loginCopy("High price", "价格高")}</option>
        </select>
        <select id="foryou-market-price" class="panel-search-select">
          <option value="all">${loginCopy("Any price", "任意价格")}</option>
          <option value="free">${loginCopy("Free", "免费")}</option>
          <option value="under_1">${loginCopy("Under $1", "1 美元内")}</option>
          <option value="under_5">${loginCopy("Under $5", "5 美元内")}</option>
          <option value="above_5">${loginCopy("Above $5", "5 美元以上")}</option>
        </select>
        <select id="foryou-market-time" class="panel-search-select">
          <option value="all">${loginCopy("Any time", "任意时间")}</option>
          <option value="day">${loginCopy("24h", "24 小时")}</option>
          <option value="week">${loginCopy("7 days", "7 天")}</option>
          <option value="month">${loginCopy("30 days", "30 天")}</option>
        </select>
        <span class="panel-search-count" id="foryou-market-count"></span>
      </div>
      <div class="panel-filter-bar" id="foryou-market-filter-bar"></div>
    </div>
  `;
}

function syncMarketCountLabel(countLabel) {
  if (!(countLabel instanceof HTMLElement)) return;
  countLabel.textContent = loginCopy(`Top ${behavior.foryou.market_limit}`, `显示前 ${behavior.foryou.market_limit} 条`);
}

function bindMarketSearchControls() {
  const filterInput = document.getElementById("foryou-market-filter");
  const sortInput = document.getElementById("foryou-market-sort");
  const authorInput = document.getElementById("foryou-market-author");
  const priceInput = document.getElementById("foryou-market-price");
  const timeInput = document.getElementById("foryou-market-time");
  const filterBar = document.getElementById("foryou-market-filter-bar");
  if (filterInput) filterInput.value = String(filterInput.value || behavior.foryou.default_filter || "all");
  if (sortInput) sortInput.value = String(sortInput.value || behavior.foryou.default_sort || "newest");
  if (filterInput) filterInput.onchange = () => renderForyouMarketplace();
  if (sortInput) sortInput.onchange = () => renderForyouMarketplace();
  if (authorInput) authorInput.oninput = () => renderForyouMarketplace();
  if (priceInput) priceInput.onchange = () => renderForyouMarketplace();
  if (timeInput) timeInput.onchange = () => renderForyouMarketplace();
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
          time: ["foryou-market-time", "all"]
        };
        if (map[key]) {
          clearSingleSearchControl(map[key][0], map[key][1]);
          renderForyouMarketplace();
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
        "foryou-market-time"
      ]);
      renderForyouMarketplace();
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
    <div class="section-title">${loginCopy("Marketplace", "市场")}</div>
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
      placeholder: loginCopy("Search title, style, owner...", "搜索标题、风格、作者..."),
      hint: loginCopy(`Pull down to search · top ${behavior?.foryou?.market_limit}`, `下拉显示搜索 · 前 ${behavior?.foryou?.market_limit} 条`),
      value: document.getElementById("foryou-market-search")?.value || "",
      onInput: () => renderForyouMarketplace()
    });
  }
}

async function openMarketWorkPreview(work = {}) {
  currentWatchPreviewWork = work || null;
  const seed = buildMarketPreviewSeed(work);
  const previewUnlimited = canBypassPreviewLimit(authState.user, work);
  await renderMarketWorkPreviewIntoWatchModule({ work, seed, previewUnlimited });
}

function renderForyouMarketplace() {
  if (!foryouPanel) return;
  const body = foryouPanel.querySelector(".panel-body");
  if (!body) return;
  const behavior = readPanelBehaviorSettingsLocal();
  ensureMarketSection(body);
  ensureMarketSearchReveal(body, behavior);
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
  const marketViewOptions = readMarketListViewOptions();
  syncMarketFilterPills(marketViewOptions);
  const works = buildVisibleMarketWorks(publicMarketState.works, marketViewOptions);
  syncMarketCountLabel(countLabel);
  if (!works.length) {
    list.innerHTML = buildMarketEmptyNoteMarkup();
    return;
  }
  list.innerHTML = buildMarketCardsMarkup(works);
  void hydrateMarketCardThumbnails(list, works);
  bindMarketCardExpandToggle(list);
  bindMarketCardActionButtons(list, works);
}

function readMarketListViewOptions() {
  return {
    query: String(document.getElementById("foryou-market-search")?.value || "").trim().toLowerCase(),
    authorQuery: String(document.getElementById("foryou-market-author")?.value || "").trim().toLowerCase(),
    filterMode: String(document.getElementById("foryou-market-filter")?.value || behavior.foryou.default_filter || "all"),
    sortMode: String(document.getElementById("foryou-market-sort")?.value || behavior.foryou.default_sort || "newest"),
    priceMode: String(document.getElementById("foryou-market-price")?.value || "all"),
    timeMode: String(document.getElementById("foryou-market-time")?.value || "all")
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
    filterLabel: ({
      all: loginCopy("All", "全部"),
      single: loginCopy("Single", "单曲"),
      triptych: loginCopy("Triptych", "三部曲"),
      opera: loginCopy("Opera", "歌剧"),
      owned: loginCopy("Mine", "我的"),
      public: loginCopy("Others", "别人的")
    })[filterMode],
    sortLabel: ({
      newest: loginCopy("Newest", "最新"),
      oldest: loginCopy("Oldest", "最早"),
      title: loginCopy("Title", "标题"),
      listen_low: loginCopy("Low price", "价格低"),
      listen_high: loginCopy("High price", "价格高")
    })[sortMode],
    priceLabel: ({
      all: "",
      free: loginCopy("Free", "免费"),
      under_1: loginCopy("Under $1", "1 美元内"),
      under_5: loginCopy("Under $5", "5 美元内"),
      above_5: loginCopy("Above $5", "5 美元以上")
    })[priceMode],
    timeLabel: ({
      all: "",
      day: loginCopy("24h", "24 小时"),
      week: loginCopy("7 days", "7 天"),
      month: loginCopy("30 days", "30 天")
    })[timeMode]
  });
}

function buildVisibleMarketWorks(sourceWorks = [], options = {}) {
  const works = Array.isArray(sourceWorks) ? sourceWorks : [];
  const query = String(options.query || "").trim().toLowerCase();
  const authorQuery = String(options.authorQuery || "").trim().toLowerCase();
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
          work?.owner_handle
        ].map((value) => String(value || "").toLowerCase()).join("\n");
        return haystack.includes(query);
      }),
      filterMode
    ),
    sortMode
  ).filter((work) => {
    if (!authorQuery) return true;
    const haystack = [work?.owner_name, work?.owner_email, work?.owner_handle].map((value) => String(value || "").toLowerCase()).join("\n");
    return haystack.includes(authorQuery);
  }).filter((work) => {
    const cents = Number(work?.current_listen_price_cents || work?.listen_price_cents || 0);
    if (priceMode === "free") return cents <= 0;
    if (priceMode === "under_1") return cents > 0 && cents <= 100;
    if (priceMode === "under_5") return cents > 0 && cents <= 500;
    if (priceMode === "above_5") return cents > 500;
    return true;
  }).filter((work) => {
    if (timeMode === "all") return true;
    const created = workCreatedTimestamp(work);
    const age = Date.now() - created;
    if (timeMode === "day") return age <= 24 * 60 * 60 * 1000;
    if (timeMode === "week") return age <= 7 * 24 * 60 * 60 * 1000;
    if (timeMode === "month") return age <= 30 * 24 * 60 * 60 * 1000;
    return true;
  }).slice(0, behavior.foryou.market_limit);
}

function buildMarketCardsMarkup(works = []) {
  if (!Array.isArray(works) || !works.length) return "";
  return works
    .map((work) => {
      const workId = String(work?.id || work?.work_id || "").trim();
      const rawTitle = String(work?.title || "").trim() || loginCopy("Untitled", "未命名");
      const title = escapeHtml(rawTitle);
      const style = escapeHtml(String(work?.style || "").trim() || loginCopy("Style not set", "未设置风格"));
      const workType = normalizeWorkTypeClient(work?.work_type);
      const preview = escapeHtml(buildDisplayLyricsPreviewText(work) || rawTitle);
      const createdAt = work?.created_at ? new Date(work.created_at).toLocaleString() : "";
      const coverImage = resolveWorkCoverImage(work);
      const listenCents = Number(work?.current_listen_price_cents || work?.listen_price_cents || 0);
      const listenPrice = formatUsdFromCents(listenCents, "$0.00");
      const buyoutValue = Number(work?.current_buyout_price_cents || 0);
      const buyoutEnabled = Boolean(work?.buyout_enabled) && buyoutValue > 0;
      const buyoutPrice = buyoutEnabled ? formatUsdFromCents(buyoutValue, "$0.00") : loginCopy("Unavailable", "不可用");
      const viewerOrders = Array.isArray(work?.viewer_orders) ? work.viewer_orders : [];
      const isOwnedByViewer =
        Boolean(authState.user?.id) && String(work?.owner_user_id || "").trim() === String(authState.user?.id || "").trim();
      const canTransact = isLoggedInUser() && !isOwnedByViewer;
      const tipsEnabled = canReceiveTips(work);
      const hierarchyMarkup = renderHierarchyTree(work.children || [], "market");
      const orderState = resolveViewerOrderState(viewerOrders);
      const listenDisabled = Boolean(isOwnedByViewer || orderState.paidBuyout || orderState.paidListen || orderState.pendingListen || orderState.pendingBuyout || listenCents <= 0);
      const buyoutDisabled = Boolean(isOwnedByViewer || orderState.paidBuyout || orderState.pendingBuyout);
      const tipDisabled = Boolean(!tipsEnabled || orderState.pendingTip);
      return `
        <article class="work-card market-card foryou-shelf-card" data-market-work-id="${escapeHtml(workId)}" data-work-expand>
          <div class="work-cover" data-market-cover-key="${escapeHtml(workId)}" data-market-toggle>
            ${coverImage ? `<img src="${escapeHtml(coverImage)}" alt="${title}" />` : `<div class="work-cover-fallback">${rawTitle.slice(0, 2).toUpperCase()}</div>`}
          </div>
          <div class="work-info">
            <div class="work-title" data-market-toggle>${title}</div>
            <div class="work-tags" title="${style}">${style}</div>
            <div class="work-pricing">
              <span class="price-chip ghost-chip">${loginCopy("Type", "类型")} · ${escapeHtml(workTypeLabel(workType))}</span>
              <span class="price-chip">${loginCopy("Listen", "聆听")} · ${escapeHtml(listenPrice)}</span>
              <span class="price-chip">${loginCopy("Buyout", "买断")} · ${escapeHtml(buyoutPrice)}</span>
              ${createdAt ? `<span class="price-chip ghost-chip">${escapeHtml(createdAt)}</span>` : ""}
            </div>
          </div>
          <div class="work-actions">
            <button class="mini-btn ghost" type="button" data-market-action="preview">${loginCopy("Enjoy", "欣赏")}</button>
            ${canTransact ? `<button class="mini-btn ghost" type="button" data-market-action="listen" ${listenDisabled ? "disabled" : ""}>${marketActionCopy("listen", orderState)}</button>` : ""}
            ${canTransact ? `<button class="mini-btn ghost" type="button" data-market-action="buyout" ${buyoutDisabled || !buyoutEnabled ? "disabled" : ""}>${marketActionCopy("buyout", orderState)}</button>` : ""}
            ${canTransact ? `<span class="market-inline-action"><button class="mini-btn ghost" type="button" data-market-action="tip" ${tipDisabled ? "disabled" : ""}>${marketActionCopy("tip", orderState)}</button><input class="inline-chip-input market-tip-input" type="number" min="1" step="1" inputmode="decimal" placeholder="${escapeHtml(loginCopy("Tip $", "打赏金额"))}" data-market-tip-input="${escapeHtml(workId)}" hidden /></span>` : ""}
          </div>
          <div class="work-details">
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
      const workId = button.getAttribute("data-market-child-id") || card?.getAttribute("data-market-work-id") || "";
      if (!workId) return;
      const work = works.find((entry) => String(entry?.id || entry?.work_id || "").trim() === workId)
        || flattenHierarchyWorks(works).find((entry) => String(entry?.id || entry?.work_id || "").trim() === workId);
      if (!work) return;
      void openMarketWorkPreview(work);
    });
  });
  list.querySelectorAll("[data-market-action='listen']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = button.closest("[data-market-work-id]");
      const workId = button.getAttribute("data-market-child-id") || card?.getAttribute("data-market-work-id") || "";
      if (!workId) return;
      void startStripeCheckoutForWork(workId, "listen", button);
    });
  });
  list.querySelectorAll("[data-market-action='buyout']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = button.closest("[data-market-work-id]");
      const workId = button.getAttribute("data-market-child-id") || card?.getAttribute("data-market-work-id") || "";
      if (!workId) return;
      void startStripeCheckoutForWork(workId, "buyout", button);
    });
  });
  list.querySelectorAll("[data-market-action='tip']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = button.closest("[data-market-work-id], .work-hierarchy-item");
      toggleMarketTipInput(card, true);
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
      const card = target.closest("[data-market-work-id], .work-hierarchy-item");
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
    if (data?.permission_snapshot && typeof data.permission_snapshot === "object") {
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
      label: reminder.action
    };
  }
  if (hasAccount) {
    return {
      visible: true,
      label: loginCopy("Manage payouts", "管理收款")
    };
  }
  return {
    visible: true,
    label: loginCopy("Set up payouts", "设置收款")
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
  const displayName = String(options.displayName || authState.user?.name || authState.user?.email || "User");
  const avatarUrl = String(options.avatarUrl || "").trim();
  const canSellWorks = options.canSellWorks !== false;
  const canSetupPayout = options.canSetupPayout === true;
  const commerce = watchCommerceState.payload || null;
  const connectedAccount = commerce?.connected_account || null;
  const payoutAction = getPayoutActionPresentation(connectedAccount);
  const payoutReminder = getPayoutReminderPresentation(connectedAccount);
  const showPayoutReminder = watchCommerceState.loaded && canSetupPayout && Boolean(payoutReminder);
  return `
    <div class="works-hero">
      <div class="works-avatar">${avatarUrl ? `<img class="profile-avatar-image" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" />` : escapeHtml(displayName.slice(0, 2).toUpperCase())}</div>
      <div class="works-meta">
        <div class="works-name">${escapeHtml(displayName)}</div>
        <div class="works-role">${loginCopy("Logged in creator", "已登录创作者")}</div>
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
          !showPayoutReminder && payoutAction.visible && connectedAccount?.stripe_account_id
            ? `<div class="works-note works-payout-note">${escapeHtml(loginCopy("Need to update your payout method, payout destination, or Stripe details later? Reopen payout settings here any time.", "之后如果你要更新收款方式、收款账户或 Stripe 资料，也可以随时从这里重新进入设置。"))} <button class="mini-btn ghost tiny" type="button" data-works-connect ${canSetupPayout ? "" : "hidden"}>${escapeHtml(payoutAction.label)}</button></div>`
            : ""
        }
        ${
          !canSellWorks
            ? `<div class="works-note">${loginCopy("Free members can view works here. Upgrade when you want to publish, price, and sell them publicly.", "免费用户可以先在这里查看作品；等你准备公开上架、定价和销售时，再升级即可。")}</div>`
            : ""
        }
      </div>
    </div>
  `;
}

function buildWorksGuestEmptyMarkup() {
  return `
    <div class="panel-label">${loginCopy("Creator Works Center", "创作者作品中心")}</div>
    <div class="works-empty-card">
      <div class="works-empty-title">${loginCopy("Sign in to view your works", "登录后查看你的作品")}</div>
      <div class="works-empty-text">${loginCopy("Publishing, pricing, comment moderation, and monetization are available after login.", "发布、定价、评论管理和变现功能需要登录后使用。")}</div>
      <button class="cta tiny" type="button" data-open-login>${loginCopy("Go to Login", "去登录")}</button>
    </div>
  `;
}

function buildWorksPermissionEmptyMarkup() {
  return `
    <div class="panel-label">${loginCopy("Creator Works Center", "创作者作品中心")}</div>
    <div class="works-empty-card">
      <div class="works-empty-title">${loginCopy("Works center requires login", "作品中心需要登录")}</div>
      <div class="works-empty-text">${escapeHtml(permissionPrompt("works.open"))}</div>
      <button class="cta tiny" type="button" data-open-login>${loginCopy("Go to Login", "去登录")}</button>
    </div>
  `;
}

function buildWorksSearchShellMarkup(behavior) {
  return `
    <div class="panel-search-shell works-search-shell">
      <div class="panel-search-meta">${loginCopy("Pull down to search your works", "向下拖动显示作品搜索")}</div>
      <div class="panel-search-row">
        <input id="works-search-input" class="panel-search-input" type="search" placeholder="${escapeHtml(loginCopy("Search title, style, lyrics...", "搜索标题、风格、歌词..."))}" />
        <input id="works-search-author" class="panel-search-input panel-search-input--narrow" type="search" placeholder="${escapeHtml(loginCopy("Author", "作者"))}" />
        <select id="works-search-filter" class="panel-search-select">
          <option value="all">${loginCopy("All", "全部")}</option>
          <option value="single">${loginCopy("Single", "单曲")}</option>
          <option value="triptych">${loginCopy("Triptych", "三部曲")}</option>
          <option value="opera">${loginCopy("Opera", "歌剧")}</option>
          <option value="live">${loginCopy("Live", "上架")}</option>
          <option value="hidden">${loginCopy("Hidden", "下架")}</option>
        </select>
        <select id="works-search-sort" class="panel-search-select">
          <option value="newest">${loginCopy("Newest", "最新")}</option>
          <option value="oldest">${loginCopy("Oldest", "最早")}</option>
          <option value="title">${loginCopy("Title", "标题")}</option>
          <option value="type">${loginCopy("Type", "类型")}</option>
        </select>
        <select id="works-search-price" class="panel-search-select">
          <option value="all">${loginCopy("Any price", "任意价格")}</option>
          <option value="free">${loginCopy("Free", "免费")}</option>
          <option value="under_1">${loginCopy("Under $1", "1 美元内")}</option>
          <option value="under_5">${loginCopy("Under $5", "5 美元内")}</option>
          <option value="above_5">${loginCopy("Above $5", "5 美元以上")}</option>
        </select>
        <select id="works-search-time" class="panel-search-select">
          <option value="all">${loginCopy("Any time", "任意时间")}</option>
          <option value="day">${loginCopy("24h", "24 小时")}</option>
          <option value="week">${loginCopy("7 days", "7 天")}</option>
          <option value="month">${loginCopy("30 days", "30 天")}</option>
        </select>
        <span class="panel-search-count">${loginCopy(`Top ${behavior?.works?.search_limit || 0}`, `显示前 ${behavior?.works?.search_limit || 0} 条`)}</span>
      </div>
      <div class="panel-filter-bar" id="works-filter-bar"></div>
    </div>
  `;
}

function buildWorksListShellMarkup() {
  return `
    <div class="works-section">
      <div class="section-title">${loginCopy("Your works", "你的作品")}</div>
      <div class="works-list" id="works-list-dynamic">
        <div class="works-note">${loginCopy("Loading works...", "正在加载作品...")}</div>
      </div>
    </div>
  `;
}

function buildWorksEmptyNoteMarkup() {
  return `<div class="works-note">${loginCopy("No works yet. Create one to see it here.", "还没有作品，先创作一个吧。")}</div>`;
}

function buildWorksLoadFailedMarkup() {
  return `<div class="works-note">${loginCopy("Failed to load works.", "加载作品失败。")}</div>`;
}

function buildWorksCardPricingMarkup(options = {}) {
  const workType = normalizeWorkTypeClient(options.workType);
  const listenPrice = String(options.listenPrice || loginCopy("Not set", "未设置"));
  const buyoutPrice = String(options.buyoutPrice || loginCopy("Not set", "未设置"));
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
      <span class="price-chip ghost-chip">${loginCopy("Type", "类型")} · ${escapeHtml(workTypeLabel(workType))}</span>
      ${
        canEditWorkPrices
          ? `
            <span class="inline-chip-editor" data-inline-editor="listen">
              <button class="price-chip editable-chip" type="button" data-inline-trigger="listen">${loginCopy("Listen", "聆听")} · ${escapeHtml(listenPrice)}</button>
              <input class="inline-chip-input" type="number" min="0.99" step="0.01" value="${escapeHtml((listenPriceCents / 100).toFixed(2))}" data-work-price="listen" hidden />
            </span>
            <span class="inline-chip-editor" data-inline-editor="buyout">
              <button class="price-chip editable-chip" type="button" data-inline-trigger="buyout">${loginCopy("Buyout", "买断")} · ${escapeHtml(buyoutPrice)}</button>
              <input class="inline-chip-input" type="number" min="0" step="0.01" value="${escapeHtml((buyoutPriceCents / 100).toFixed(2))}" data-work-price="buyout" hidden />
            </span>
          `
          : `
            <span class="price-chip">${loginCopy("Listen", "聆听")} · ${escapeHtml(listenPrice)}</span>
            <span class="price-chip">${loginCopy("Buyout", "买断")} · ${escapeHtml(buyoutPrice)}</span>
          `
      }
      ${
        canEditWorkVisibility
          ? `
            <span class="inline-chip-editor" data-inline-editor="visibility">
              <button class="price-chip ghost-chip editable-chip" type="button" data-inline-trigger="visibility">${loginCopy("Status", "状态")} · ${escapeHtml(visibility === "private" ? loginCopy("Hidden", "下架") : loginCopy("Live", "上架"))}</button>
              <select class="inline-chip-select" data-work-visibility hidden>
                <option value="public" ${visibility === "public" ? "selected" : ""}>${loginCopy("Live", "上架")}</option>
                <option value="private" ${visibility === "private" ? "selected" : ""}>${loginCopy("Hidden", "下架")}</option>
              </select>
            </span>
          `
          : `<span class="price-chip ghost-chip">${loginCopy("Status", "状态")} · ${escapeHtml(visibility === "private" ? loginCopy("Hidden", "下架") : loginCopy("Live", "上架"))}</span>`
      }
      ${createdAt ? `<span class="price-chip ghost-chip">${escapeHtml(createdAt)}</span>` : ""}
      ${voiceSourceBadge ? `<span class="price-chip ghost-chip">${escapeHtml(loginCopy("Voice-derived title", "语音提炼标题"))}</span>` : ""}
      ${computeUnits > 0 ? `<span class="price-chip ghost-chip">${escapeHtml(loginCopy(`Compute ${computeUnits}u`, `算力 ${computeUnits}u`))}</span>` : ""}
      ${computeCost > 0 ? `<span class="price-chip ghost-chip">${escapeHtml(loginCopy(`Cost ${formatUsdFromCents(computeCost, "$0.00")}`, `成本 ${formatUsdFromCents(computeCost, "$0.00")}`))}</span>` : ""}
    </div>
  `;
}

function buildWorksCardInfoMarkup(options = {}) {
  const title = String(options.title || "").trim() || loginCopy("Untitled", "未命名");
  const style = String(options.style || "").trim();
  return `
    <div class="work-info">
      <div class="work-title" data-work-toggle>${escapeHtml(title)}</div>
      <div class="work-tags" title="${escapeHtml((style || loginCopy("Style not set", "未设置风格")).replace(/"/g, "&quot;"))}">${escapeHtml(style || loginCopy("Style not set", "未设置风格"))}</div>
      ${buildWorksCardPricingMarkup(options)}
    </div>
  `;
}

function buildWorksCardMarkup(options = {}) {
  const workId = String(options.workId || "").trim();
  return `
    <article class="work-card" data-work-expand data-work-id="${escapeHtml(workId)}">
      ${buildWorksCardCoverMarkup(options)}
      ${buildWorksCardInfoMarkup(options)}
      ${buildWorksCardActionsMarkup(options)}
      ${buildWorksCardDetailsMarkup(options)}
    </article>
  `;
}

function buildWorksCardsMarkup(works = [], options = {}) {
  if (!Array.isArray(works) || !works.length) return "";
  const usageEvents = Array.isArray(options.usageEvents) ? options.usageEvents : [];
  const canEditWorkPrices = options.canEditWorkPrices === true;
  const canEditWorkVisibility = options.canEditWorkVisibility === true;
  const canEditWorkType = options.canEditWorkType === true;
  const canWatchWorks = options.canWatchWorks === true;
  const canRegenerateThumbnail = options.canRegenerateThumbnail === true;
  const canRegeneratePreviewVideo = options.canRegeneratePreviewVideo === true;
  return works
    .map((work) => {
      const workId = String(work?.work_id || work?.id || work?.local_id || "").trim();
      const title = String(work.title || "").trim() || loginCopy("Untitled", "未命名");
      const style = String(work.style || "").trim();
      const workType = normalizeWorkTypeClient(work?.work_type);
      const status = String(work.status || "draft");
      const visibility = String(work.visibility || (status === "hidden" ? "private" : "public")).toLowerCase();
      const createdAt = work.created_at ? new Date(work.created_at).toLocaleString() : "";
      const lyricsPreview = buildDisplayLyricsPreviewText(work);
      const coverImage = resolveWorkCoverImage(work);
      const source = String(work?.source || "").trim().toLowerCase();
      const voiceSourceBadge = source === "voice" || work?.show_voice_source_badge;
      const hierarchyMarkup = renderHierarchyTree(work.children || [], "works");
      const commerce = getWorkCommerceDetails(workId);
      const defaults = workTypePricingDefaults(workType);
      const listenPriceCents = commerce.listenCents > 0 ? commerce.listenCents : defaults.listenCents;
      const buyoutPriceCents = commerce.buyoutCents > 0 ? commerce.buyoutCents : defaults.buyoutCents;
      const listenPrice = listenPriceCents > 0 ? formatUsdFromCents(listenPriceCents, "$0.00") : loginCopy("Not set", "未设置");
      const buyoutPrice = buyoutPriceCents > 0 ? formatUsdFromCents(buyoutPriceCents, "$0.00") : loginCopy("Not set", "未设置");
      const computeUnits = Math.max(0, Number(work?.compute_units_estimate || 0));
      const computeCost = Math.max(0, Number(work?.compute_cost_cents_estimate || 0));
      const suggestedListen = Math.max(0, Number(work?.suggested_listen_price_cents || defaults.listenCents || 0));
      const suggestedBuyout = Math.max(0, Number(work?.suggested_buyout_price_cents || defaults.buyoutCents || 0));
      return buildWorksCardMarkup({
        workId,
        coverImage,
        title,
        style,
        workType,
        listenPrice,
        buyoutPrice,
        visibility,
        createdAt,
        voiceSourceBadge,
        computeUnits,
        computeCost,
        canEditWorkPrices,
        canEditWorkVisibility,
        listenPriceCents,
        buyoutPriceCents,
        canWatchWorks,
        canRegenerateThumbnail,
        canRegeneratePreviewVideo,
        work,
        lyricsPreview,
        suggestedListen,
        suggestedBuyout,
        usageEvents,
        hierarchyMarkup,
        canEditWorkType
      });
    })
    .join("");
}

function buildWorksCardCoverMarkup(options = {}) {
  const workId = String(options.workId || "").trim();
  const coverImage = String(options.coverImage || "").trim();
  const title = String(options.title || "").trim() || loginCopy("Untitled", "未命名");
  return `
    <div class="work-cover" data-work-cover data-work-cover-key="${escapeHtml(workId)}" data-work-toggle>
      ${coverImage ? `<img src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)}" />` : `<div class="work-cover-fallback">${title.slice(0, 2).toUpperCase()}</div>`}
    </div>
  `;
}

function buildWorksCardDetailsMarkup(options = {}) {
  const hierarchyMarkup = String(options.hierarchyMarkup || "");
  const workType = String(options.workType || "single").trim() || "single";
  const canEditWorkType = options.canEditWorkType === true;
  return `
    <div class="work-details">
      ${buildWorksCardCommerceDetailsMarkup(options)}
      ${hierarchyMarkup}
      <div class="work-pricing-editor">
        <label class="work-price-field work-type-field">
          <span>${loginCopy("Work Type", "作品类型")}</span>
          <select data-work-type ${canEditWorkType ? "" : "disabled"}>
            <option value="single" ${workType === "single" ? "selected" : ""}>${loginCopy("Single", "单曲")}</option>
            <option value="triptych" ${workType === "triptych" ? "selected" : ""}>${loginCopy("Triptych", "三部曲")}</option>
            <option value="opera" ${workType === "opera" ? "selected" : ""}>${loginCopy("Opera", "歌剧")}</option>
          </select>
        </label>
      </div>
    </div>
  `;
}

function bindWorksHeroActions(container) {
  if (!(container instanceof Element)) return;
  container.querySelector("[data-works-connect]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    void startCreatorPayoutOnboarding(event.currentTarget);
  });
}

function buildWorkMarketReferenceCopy(options = {}) {
  const suggestedListen = Math.max(0, Number(options.suggestedListen || 0));
  const suggestedBuyout = Math.max(0, Number(options.suggestedBuyout || 0));
  return loginCopy(
    `Current market reference · Listen ${formatUsdFromCents(suggestedListen, "$0.00")} / Buyout ${formatUsdFromCents(suggestedBuyout, "$0.00")}`,
    `当前同类作品参考 · 聆听 ${formatUsdFromCents(suggestedListen, "$0.00")} / 买断 ${formatUsdFromCents(suggestedBuyout, "$0.00")}`
  );
}

function buildWorkAssetStatusCopy(work = {}) {
  const storedCoverImage = String(work?.cover_image || work?.thumbnail_url || "").trim();
  const previewImageUrl = String(work?.preview_image_url || "").trim();
  const previewVideoUrl = String(work?.preview_video_url || "").trim();
  const hasGeneratedCover = Boolean(storedCoverImage) && !isSyntheticWorkCoverImage(storedCoverImage);
  if (hasGeneratedCover) {
    return loginCopy(
      `OpenAI cover art is ready. Preview frame ${previewImageUrl ? "is ready" : "can be added later"} / Preview clip ${previewVideoUrl ? "is ready" : "can be added later"}.`,
      `OpenAI 封面已就绪。预览帧${previewImageUrl ? "已就绪" : "可稍后补齐"} / 缩略视频${previewVideoUrl ? "已就绪" : "可稍后补齐"}。`
    );
  }
  return loginCopy(
    `OpenAI cover art is still missing. Preview frame ${previewImageUrl ? "is ready" : "not ready"} / Preview clip ${previewVideoUrl ? "is ready" : "not ready"}.`,
    `OpenAI 封面暂未就绪。预览帧${previewImageUrl ? "已就绪" : "未就绪"} / 缩略视频${previewVideoUrl ? "已就绪" : "未就绪"}。`
  );
}

function buildWorksCardCommerceDetailsMarkup(options = {}) {
  const work = options.work || {};
  const usageEvents = Array.isArray(options.usageEvents) ? options.usageEvents : [];
  const title = String(options.title || work?.title || "").trim();
  const lyricsPreview = String(options.lyricsPreview || "").trim();
  const suggestedListen = Math.max(0, Number(options.suggestedListen || 0));
  const suggestedBuyout = Math.max(0, Number(options.suggestedBuyout || 0));
  return `
    <div class="work-extra">${escapeHtml(lyricsPreview || title)}</div>
    <div class="work-extra">${escapeHtml(buildWorkMarketReferenceCopy({ suggestedListen, suggestedBuyout }))}</div>
    <div class="work-extra">${escapeHtml(loginCopy("你可以高于参考价做精品，也可以低于参考价做传播。", "You can price above the reference for premium positioning, or below it for reach."))}</div>
    <div class="work-extra">${escapeHtml(buildWorkAssetStatusCopy(work))}</div>
    ${renderWorkCostBillMarkup(work, usageEvents)}
  `;
}

function buildWorksCardActionsMarkup(options = {}) {
  const canWatchWorks = options.canWatchWorks === true;
  const canRegenerateThumbnail = options.canRegenerateThumbnail === true;
  const canRegeneratePreviewVideo = options.canRegeneratePreviewVideo === true;
  return `
    <div class="work-actions">
      <button class="mini-btn ghost" type="button" data-work-action="watch" ${canWatchWorks ? "" : "disabled"}>${loginCopy("Enjoy", "欣赏")}</button>
      <button class="mini-btn ghost tiny" type="button" data-work-action="regen-thumbnail" ${canRegenerateThumbnail ? "" : "disabled"}>${loginCopy("Regen thumb", "重生缩略图")}</button>
      <button class="mini-btn ghost tiny" type="button" data-work-action="regen-preview-video" ${canRegeneratePreviewVideo ? "" : "disabled"}>${loginCopy("Regen clip", "重生缩略视频")}</button>
    </div>
  `;
}

function mergeLocalAndRemoteWorks(remoteWorks = [], localWorks = []) {
  const safeRemoteWorks = Array.isArray(remoteWorks) ? remoteWorks : [];
  const safeLocalWorks = Array.isArray(localWorks) ? localWorks : [];
  const merged = safeRemoteWorks.map((item) => ({ ...item }));
  safeLocalWorks.forEach((localWork) => {
    const existingIndex = merged.findIndex(
      (item) =>
        String(item?.work_id || item?.id || "") === String(localWork?.work_id || localWork?.local_id || "") ||
        (String(item?.title || "").trim() === String(localWork?.title || "").trim() &&
          String(item?.created_at || "") === String(localWork?.created_at || ""))
    );
    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...localWork,
        ...merged[existingIndex],
        cover_image: merged[existingIndex]?.cover_image || localWork?.cover_image || ""
      };
    } else {
      merged.unshift(localWork);
    }
  });
  return merged;
}

async function hydrateWorksCardThumbnails(container, works) {
  if (!(container instanceof Element) || !Array.isArray(works)) return;
  for (const work of works) {
    const workId = String(work?.work_id || work?.id || work?.local_id || "").trim();
    if (!workId) continue;
    const cover = container.querySelector(`[data-work-cover-key="${CSS.escape(workId)}"]`);
    if (!(cover instanceof HTMLElement)) continue;
    const currentImage = String(cover.querySelector("img")?.getAttribute("src") || "").trim();
    if (currentImage && !isSyntheticWorkCoverImage(currentImage)) continue;
    const title = String(work?.title || "").trim() || "CSS MV";
    const subtitle = String(work?.style || "").trim() || loginCopy("Creator work", "创作者作品");
    const lines = workLyricsLines(work);
    const image = await requestThumbnailDataUrl(title, subtitle, lines);
    if (!image) continue;
    cover.innerHTML = `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" />`;
    updateLocalWorkCoverImage(workId, image);
  }
}

async function hydrateMarketCardThumbnails(container, works) {
  if (!(container instanceof Element) || !Array.isArray(works)) return;
  for (const work of works) {
    const workId = String(work?.id || work?.work_id || "").trim();
    if (!workId) continue;
    const cover = container.querySelector(`[data-market-cover-key="${CSS.escape(workId)}"]`);
    if (!(cover instanceof HTMLElement)) continue;
    const currentImage = String(cover.querySelector("img")?.getAttribute("src") || "").trim();
    if (currentImage && !isSyntheticWorkCoverImage(currentImage)) continue;
    const title = String(work?.title || "").trim() || "CSS MV";
    const subtitle = String(work?.style || "").trim() || loginCopy("Marketplace work", "市场作品");
    const lines = workLyricsLines(work);
    const image = await requestThumbnailDataUrl(title, subtitle, lines);
    if (!image) continue;
    cover.innerHTML = `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" />`;
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

  list.querySelectorAll("[data-work-action='watch']").forEach((button) => {
    button.addEventListener("click", async (event) => {
      if (!canWatchWorks) {
        showToast(permissionPrompt("works.watch"));
        return;
      }
      event.stopPropagation();
      const childWorkId = button.getAttribute("data-work-child-id") || "";
      if (childWorkId) {
        list.querySelectorAll("[data-work-id]").forEach((card) => {
          if (card instanceof HTMLElement) card.dataset.activeChildWorkId = childWorkId;
        });
      }
      await openWatchPreviewFlowModule({ preferredTab: "mv" });
    });
  });

  list.querySelectorAll("[data-work-action='regen-thumbnail']").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!canRegenerateThumbnail) {
        showToast(permissionPrompt("works.thumbnail.regen"));
        return;
      }
      const card = button.closest("[data-work-id]");
      const workId = String(card?.getAttribute("data-work-id") || "").trim();
      const work = sortedWorks.find((item) => String(item?.work_id || item?.id || item?.local_id || "").trim() === workId);
      if (!work) return;
      await regenerateWorkThumbnail(work, button);
    });
  });

  list.querySelectorAll("[data-work-action='regen-preview-video']").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!canRegeneratePreviewVideo) {
        showToast(permissionPrompt("works.preview_video.regen"));
        return;
      }
      const card = button.closest("[data-work-id]");
      const workId = String(card?.getAttribute("data-work-id") || "").trim();
      const work = sortedWorks.find((item) => String(item?.work_id || item?.id || item?.local_id || "").trim() === workId);
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
      if (listenInput instanceof HTMLInputElement) listenInput.value = (defaults.listenCents / 100).toFixed(2);
      if (buyoutInput instanceof HTMLInputElement) buyoutInput.value = (defaults.buyoutCents / 100).toFixed(2);
      void saveWorkPricing(card?.getAttribute("data-work-id") || "", listenInput, buyoutInput, target, visibilityInput);
    });
  });

  list.querySelectorAll('[data-work-price="listen"], [data-work-price="buyout"]').forEach((input) => {
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
      void saveWorkPricing(workId, listenInput, buyoutInput, workTypeInput, visibilityInput);
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
      void saveWorkPricing(workId, listenInput, buyoutInput, workTypeInput, target);
    });
  });
}

async function saveWorkPricing(workId, listenInput, buyoutInput, workTypeInput, visibilityInput) {
  if (!workId || !(listenInput instanceof HTMLInputElement) || !(buyoutInput instanceof HTMLInputElement)) return;
  const listenPriceCents = centsFromPriceInput(listenInput.value);
  const buyoutPriceCents = centsFromPriceInput(buyoutInput.value);
  const workType = workTypeInput instanceof HTMLSelectElement ? normalizeWorkTypeClient(workTypeInput.value) : null;
  const visibility = visibilityInput instanceof HTMLSelectElement
    ? (visibilityInput.value === "private" ? "private" : "public")
    : "public";
  if (listenPriceCents <= 0) {
    showToast(loginCopy("Listen price must be greater than $0.00.", "试听价格必须大于 $0.00。"));
    listenInput.focus();
    return;
  }
  try {
    listenInput.dataset.saving = "true";
    buyoutInput.dataset.saving = "true";
    if (visibilityInput instanceof HTMLSelectElement) visibilityInput.dataset.saving = "true";
    const res = await fetch(`/api/works/${encodeURIComponent(workId)}/pricing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        listen_price_cents: listenPriceCents,
        buyout_price_cents: buyoutPriceCents,
        buyout_enabled: buyoutPriceCents > 0,
        work_type: workType,
        visibility
      })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      throw new Error(payload?.code || `pricing_save_failed:${res.status}`);
    }
    await refreshWorkSurfaces();
    broadcastWorksCommerceRefresh({ includeMarket: true });
    showToast(loginCopy("Pricing updated.", "定价已更新。"));
  } catch (_err) {
    showToast(loginCopy("Failed to save pricing.", "保存定价失败。"));
  } finally {
    delete listenInput.dataset.saving;
    delete buyoutInput.dataset.saving;
    if (visibilityInput instanceof HTMLSelectElement) delete visibilityInput.dataset.saving;
  }
}

function syncApiBillingCommerceControls(options = {}) {
  const canManageBilling = options.canManageBilling === true;
  const balanceCents = Number(billingState.balance_cents || 0);
  if (apiCreditBalance) {
    apiCreditBalance.textContent = `$${(balanceCents / 100).toFixed(2)}`;
  }
  if (apiAddFundsBtn) {
    apiAddFundsBtn.disabled = !canManageBilling;
    apiAddFundsBtn.hidden = !canManageBilling;
  }
  if (apiAutoRecharge) apiAutoRecharge.disabled = !canManageBilling;
  if (apiMonthlyLimit) apiMonthlyLimit.disabled = !canManageBilling;
  if (apiPaymentMethod) apiPaymentMethod.disabled = !canManageBilling;
  if (apiMonthlyLimit && canManageBilling && Number.isFinite(Number(billingState.monthly_limit_cents))) {
    apiMonthlyLimit.value = (Number(billingState.monthly_limit_cents) / 100).toFixed(0);
  }
}

function buildProfileCommerceMarkup(options = {}) {
  const commerce = watchCommerceState.payload || null;
  const studio = commerce?.studio || null;
  const workspace = studio?.workspace || null;
  const workspaceMembers = Array.isArray(studio?.members) ? studio.members : [];
  const workspaceProjects = Array.isArray(studio?.projects) ? studio.projects.slice(0, 5) : [];
  const workspaceEnabled = canUseStudioWorkspaceClient();
  const queueLane = studio?.workspace?.queue_lane || commerce?.profile?.queue_lane || getMembershipPreset().queuePriority;
  return workspaceEnabled
    ? `
      <div class="profile-account-latest">
        <div class="profile-mini-card">
          <div class="profile-mini-label">${loginCopy("Studio workspace", "Studio 工作区")}</div>
          <div class="profile-mini-value">${escapeHtml(String(workspace?.name || loginCopy("Preparing workspace...", "正在准备工作区...")))}</div>
          <div class="profile-account-meta">${escapeHtml(formatQueueLaneLabel(queueLane))}</div>
          <div class="profile-account-meta">${escapeHtml(loginCopy(`Members ${workspaceMembers.length}`, `成员 ${workspaceMembers.length}`))} · ${escapeHtml(loginCopy(`Projects ${workspaceProjects.length}`, `项目 ${workspaceProjects.length}`))}</div>
          <div class="profile-account-meta">${escapeHtml(loginCopy("Studio and above use dedicated production queues instead of the free/basic lanes.", "Studio 及以上会进入独立生产队列，不再与免费/基础队列混用。"))}</div>
          <div class="profile-account-meta">
            ${studio?.can_collaborate
              ? `<button class="mini-btn ghost" type="button" data-studio-member-add>${loginCopy("Add member", "添加成员")}</button>`
              : loginCopy("Team collaboration is currently disabled by the system administrator.", "团队协作当前由系统管理员关闭。")}
            ${studio?.can_create_projects
              ? `<button class="mini-btn ghost" type="button" data-studio-project-create>${loginCopy("New project", "新建项目")}</button>`
              : ""}
          </div>
        </div>
        <div class="profile-mini-card">
          <div class="profile-mini-label">${loginCopy("Latest projects", "最近项目")}</div>
          <div class="profile-mini-value">${workspaceProjects.length ? escapeHtml(String(workspaceProjects[0]?.title || "")) : escapeHtml(loginCopy("No projects yet", "还没有项目"))}</div>
          <div class="profile-account-meta">${
            workspaceProjects.length
              ? workspaceProjects
                  .map((project) => `${escapeHtml(String(project.title || ""))} · ${escapeHtml(formatQueueLaneLabel(project.queue_lane || queueLane))}`)
                  .join("<br />")
              : escapeHtml(loginCopy("Create a Studio/Enterprise project here to keep productions organized.", "在这里创建 Studio / Enterprise 项目，方便整理整套制作流程。"))
          }</div>
          <button class="mini-btn ghost" type="button" data-studio-open-api>${loginCopy("View enterprise/API lane", "查看企业/API 通道")}</button>
        </div>
      </div>
    `
    : `
      <div class="profile-account-meta">
        ${loginCopy(
          "Studio and Enterprise memberships unlock team workspace, project lists, and dedicated production lanes.",
          "Studio 与 Enterprise 会员会解锁团队工作区、项目列表和独立生产队列。"
        )}
      </div>
    `;
}

function bindProfileCommerceActions(summary) {
  if (!(summary instanceof Element)) return;
  summary.querySelector("[data-studio-open-api]")?.addEventListener("click", () => openPanel(apiPanel));
  summary.querySelector("[data-studio-project-create]")?.addEventListener("click", async () => {
    const title = window.prompt(loginCopy("New project title", "请输入新项目标题"));
    if (!title) return;
    await createStudioProject(title);
  });
  summary.querySelector("[data-studio-member-add]")?.addEventListener("click", async () => {
    const email = window.prompt(loginCopy("Invite teammate email", "请输入成员邮箱"));
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
    brief.length > 220
      ? `${brief.slice(0, 220).trimEnd()}...`
      : brief;
  const expandable = collapsed !== brief;
  return `
    <div class="api-cinema-booking-brief-preview" data-cinema-booking-brief ${expandable ? 'tabindex="0" role="button" aria-expanded="false"' : ""}>
      <div class="api-cinema-booking-brief-label">${escapeHtml(loginCopy("Creative brief", "项目说明"))}</div>
      <div class="api-cinema-booking-brief-copy" data-cinema-booking-brief-collapsed ${expandable ? "" : "hidden"}>${formatCinemaBookingBriefHtml(collapsed)}</div>
      <div class="api-cinema-booking-brief-copy" data-cinema-booking-brief-full ${expandable ? "hidden" : ""}>${formatCinemaBookingBriefHtml(brief)}</div>
      ${
        expandable
          ? `<div class="api-cinema-booking-brief-hint" data-cinema-booking-brief-hint>${escapeHtml(loginCopy("Click to show full brief", "点击查看完整说明"))}</div>`
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
  const queueLane = enterprise?.queue_lane || commerce?.profile?.queue_lane || getMembershipPreset().queuePriority;
  const usageEvents = Array.isArray(commerce?.usage_events) ? commerce.usage_events : [];
  const ledgerEntries = Array.isArray(commerce?.ledger_entries) ? commerce.ledger_entries : [];
  const cinemaBookings = Array.isArray(commerce?.cinema_bookings) ? commerce.cinema_bookings : [];

  let laneCard = apiBody.querySelector(".api-queue-card");
  if (!laneCard) {
    laneCard = document.createElement("div");
    laneCard.className = "api-guest-notice api-queue-card";
    apiBody.appendChild(laneCard);
  }
  laneCard.innerHTML = `
    <strong>${escapeHtml(loginCopy("Current production lane", "当前生产队列"))}</strong>
    <div>${escapeHtml(formatQueueLaneLabel(queueLane))}</div>
    <div>${escapeHtml(loginCopy("Pro and above now use separate queue lanes, so paid production no longer mixes with guest/basic traffic.", "Pro 及以上会员现在会进入各自独立的生产队列，不再与游客/基础流量混排。"))}</div>
  `;

  let enterpriseCard = apiBody.querySelector(".api-enterprise-card");
  if (canUseEnterpriseApiClient()) {
    if (!enterpriseCard) {
      enterpriseCard = document.createElement("div");
      enterpriseCard.className = "api-guest-notice api-enterprise-card";
      apiBody.appendChild(enterpriseCard);
    }
    const usage = enterprise?.usage || null;
    const recentRoutes = Array.isArray(usage?.recent_routes) ? usage.recent_routes.slice(0, 4) : [];
    enterpriseCard.innerHTML = `
      <strong>${escapeHtml(loginCopy("Enterprise API lane", "企业 API 通道"))}</strong>
      <div>${escapeHtml(enterprise?.enabled ? loginCopy("Enabled", "已启用") : loginCopy("Disabled by admin", "已被管理员关闭"))}</div>
      <div>${escapeHtml(loginCopy(`Rate limit ${Number(usage?.rpm_limit || 0)} req/min`, `每分钟限额 ${Number(usage?.rpm_limit || 0)} 次`))}</div>
      <div>${escapeHtml(loginCopy(`Used this minute ${Number(usage?.used_this_minute || 0)}, remaining ${Number(usage?.remaining_this_minute || 0)}`, `本分钟已用 ${Number(usage?.used_this_minute || 0)} 次，剩余 ${Number(usage?.remaining_this_minute || 0)} 次`))}</div>
      <div>${recentRoutes.length ? recentRoutes.map((entry) => escapeHtml(String(entry.route || ""))).join("<br />") : escapeHtml(loginCopy("No recent enterprise API routes yet.", "最近还没有企业 API 路由记录。"))}</div>
    `;
  } else if (enterpriseCard) {
    enterpriseCard.remove();
  }

  let billingHistoryCard = apiBody.querySelector(".api-billing-history-card");
  if (!billingHistoryCard) {
    billingHistoryCard = document.createElement("div");
    billingHistoryCard.className = "api-guest-notice api-billing-history-card";
    apiBody.appendChild(billingHistoryCard);
  }
  billingHistoryCard.innerHTML = `
    <strong>${escapeHtml(loginCopy("Action charge history", "动作收费历史"))}</strong>
    <div>${escapeHtml(loginCopy("Every billable compute action is listed here so creators can see where server cost was spent.", "所有可计费的算力动作都会列在这里，方便创作者看到服务器成本花在了哪里。"))}</div>
    <div class="watch-activity compact">${renderUsageHistoryMarkup(usageEvents, loginCopy("No billable action rows yet.", "还没有动作计费记录。"), 10)}</div>
  `;

  let ledgerHistoryCard = apiBody.querySelector(".api-ledger-history-card");
  if (!ledgerHistoryCard) {
    ledgerHistoryCard = document.createElement("div");
    ledgerHistoryCard.className = "api-guest-notice api-ledger-history-card";
    apiBody.appendChild(ledgerHistoryCard);
  }
  ledgerHistoryCard.innerHTML = `
    <strong>${escapeHtml(loginCopy("Ledger history", "账本历史"))}</strong>
    <div>${escapeHtml(loginCopy("Credits, debits, and settlement movements appear here.", "充值、扣费和结算流水会显示在这里。"))}</div>
    <div class="watch-activity compact">${renderLedgerHistoryMarkup(ledgerEntries, loginCopy("No ledger records yet.", "还没有账本流水。"), 10)}</div>
  `;

  let cinemaCard = apiBody.querySelector(".api-cinema-booking-card");
  if (!cinemaCard) {
    cinemaCard = document.createElement("div");
    cinemaCard.className = "api-guest-notice api-cinema-booking-card";
    apiBody.appendChild(cinemaCard);
  }
  const cinemaPriceCents = Math.max(0, Number(commerce?.billable_actions?.cinemaBookingCents || getBillableActionPricing().cinema_booking || 0));
  cinemaCard.innerHTML = `
    <strong>${escapeHtml(loginCopy("Cinema booking / contract intake", "电影级预约 / 签约入口"))}</strong>
    <div>${escapeHtml(loginCopy("Use this entrance for film-grade, long-form, or contract-required production. Submission creates a real intake record for studio follow-up.", "电影级、长片级、需要合同确认的制作，请走这里提交。提交后会生成真实预约记录，供工作室继续跟进。"))}</div>
    <div class="api-cinema-grid">
      <label><span>${escapeHtml(loginCopy("Project title", "项目标题"))}</span><input type="text" maxlength="160" data-cinema-booking="title" placeholder="${escapeHtml(loginCopy("Feature / campaign title", "片名 / 项目名"))}" /></label>
      <label><span>${escapeHtml(loginCopy("Requested duration (minutes)", "目标时长（分钟）"))}</span><input type="number" min="1" max="1440" step="1" data-cinema-booking="duration" /></label>
      <label><span>${escapeHtml(loginCopy("Contact email", "联系邮箱"))}</span><input type="email" maxlength="160" data-cinema-booking="email" value="${escapeHtml(String(authState.user?.email || ""))}" /></label>
      <label><span>${escapeHtml(loginCopy("Contact handle", "联系方式备注"))}</span><input type="text" maxlength="160" data-cinema-booking="handle" placeholder="${escapeHtml(loginCopy("WeChat / Telegram / phone note", "微信 / Telegram / 电话备注"))}" /></label>
      <label><span>${escapeHtml(loginCopy("Budget (USD)", "预算（美元）"))}</span><input type="number" min="0" max="1000000000" step="10000" data-cinema-booking="budget" /></label>
      <div class="api-cinema-note">${escapeHtml(loginCopy(`Current intake price policy: ${formatUsdFromCents(cinemaPriceCents, "$0.00")} configured.`, `当前预约价格策略：已配置 ${formatUsdFromCents(cinemaPriceCents, "$0.00")}。`))}</div>
    </div>
    <label class="api-cinema-brief">
      <span>${escapeHtml(loginCopy("Creative brief", "项目说明"))}</span>
      <textarea rows="5" maxlength="4000" data-cinema-booking="brief" placeholder="${escapeHtml(loginCopy("Describe story scope, style, delivery expectations, language/voice needs, and contract notes.", "请描述故事体量、风格、交付要求、多语言/多声线需求，以及合同备注。"))}"></textarea>
    </label>
    <div class="api-cinema-actions">
      <button class="mini-btn ghost" type="button" data-cinema-booking-submit ${authState.user ? "" : "disabled"}>${escapeHtml(loginCopy("Submit booking", "提交预约"))}</button>
      <div class="api-cinema-status" data-cinema-booking-status>${escapeHtml(authState.user ? loginCopy("Submission will create a real booking intake row and stay visible below.", "提交后会生成真实预约记录，并显示在下方。") : loginCopy("Sign in first to submit a cinema booking.", "请先登录后再提交电影级预约。"))}</div>
    </div>
    <div class="watch-activity compact">${
      cinemaBookings.length
        ? cinemaBookings
            .slice(0, 6)
            .map((entry) => `
              <div class="watch-activity-item">
                <div class="watch-activity-title">${escapeHtml(String(entry?.project_title || loginCopy("Cinema booking", "电影级预约")))}</div>
                <div class="watch-activity-meta">${escapeHtml(`${String(entry?.status || "submitted")} · ${formatUsdFromCents(Number(entry?.budget_cents || 0), "$0.00")} · ${formatDateTime(entry?.created_at)}`)}</div>
                ${renderCinemaBookingBriefMarkup(entry)}
              </div>
            `)
            .join("")
        : `<div class="watch-activity-empty">${escapeHtml(loginCopy("No cinema booking requests yet.", "还没有电影级预约记录。"))}</div>`
    }</div>
  `;
  seedCinemaBookingForm(apiBody);
  cinemaCard.querySelector("[data-cinema-booking-submit]")?.addEventListener("click", (event) => {
    void submitCinemaBookingRequest(event.currentTarget);
  });
  cinemaCard.querySelectorAll("[data-cinema-booking-brief]").forEach((node) => {
    if (!(node instanceof HTMLElement) || node.getAttribute("role") !== "button") return;
    const toggle = () => {
      const expanded = node.getAttribute("aria-expanded") === "true";
      const nextExpanded = !expanded;
      node.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
      node.querySelector("[data-cinema-booking-brief-collapsed]")?.toggleAttribute("hidden", nextExpanded);
      node.querySelector("[data-cinema-booking-brief-full]")?.toggleAttribute("hidden", !nextExpanded);
      const hint = node.querySelector("[data-cinema-booking-brief-hint]");
      if (hint instanceof HTMLElement) {
        hint.textContent = nextExpanded
          ? loginCopy("Click to collapse", "点击收起")
          : loginCopy("Click to show full brief", "点击查看完整说明");
      }
    };
    node.addEventListener("click", toggle);
    node.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });
  });

  if (authState.user && canUseBilling && !watchCommerceState.loaded && !watchCommerceState.loading) {
    void loadWatchCommerce().then(() => renderApiBillingPanel());
  }
}

async function createStudioProject(title) {
  const trimmed = String(title || "").trim().slice(0, 120);
  if (!trimmed) return false;
  try {
    const res = await fetch("/api/studio/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: trimmed, created_via: "profile_panel" })
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok || raw?.ok === false) {
      const code = raw?.code || "";
      if (code === "PROJECT_LIMIT_REACHED") {
        showToast(loginCopy("Project limit reached for this Studio/Enterprise workspace.", "当前 Studio / Enterprise 工作区的项目数量已达上限。"));
      } else {
        showToast(loginCopy("Unable to create project right now.", "暂时无法创建项目。"));
      }
      return false;
    }
    await loadWatchCommerce(true);
    broadcastCommerceRefresh({ includeApi: true });
    showToast(loginCopy("Project created.", "项目已创建。"));
    return true;
  } catch (_err) {
    showToast(loginCopy("Unable to create project right now.", "暂时无法创建项目。"));
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
      body: JSON.stringify({ email: normalizedEmail, role })
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok || raw?.ok === false) {
      const code = raw?.code || "";
      if (code === "TARGET_USER_NOT_FOUND") {
        showToast(loginCopy("That teammate has not signed in yet.", "该成员还没有登录过系统。"));
      } else if (code === "TEAM_MEMBER_LIMIT_REACHED") {
        showToast(loginCopy("Team member limit reached for this workspace.", "当前工作区成员数量已达上限。"));
      } else {
        showToast(loginCopy("Unable to add that member right now.", "暂时无法添加该成员。"));
      }
      return false;
    }
    await loadWatchCommerce(true);
    broadcastCommerceRefresh({ includeApi: false });
    showToast(loginCopy("Team member added.", "团队成员已添加。"));
    return true;
  } catch (_err) {
    showToast(loginCopy("Unable to add that member right now.", "暂时无法添加该成员。"));
    return false;
  }
}

async function refreshCreatorBoostSurfaces(options = {}) {
  await loadCreatorBoostState(true).catch(() => null);
  if (options.renderAdvanced !== false && !advancedPanelSettings?.hidden) {
    void renderAdvancedPanelSettings();
  }
}

async function createCreatorBoostCheckout(boostKind, quantity = 1, trigger = null) {
  if (!authState.user) {
    openLoginForCreation(loginCopy("Sign in first to buy Creator Boosts.", "请先登录后购买 Creator Boost 加购。"));
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
        work_type: creationState.workType
      }
    })
  });
  const payload = await res.json().catch(() => null);
  const data = getApiData(payload);
  if (!res.ok || payload?.ok === false || !data?.checkout_url) {
    throw new Error(payload?.message || `creator_boost_checkout_failed:${res.status}`);
  }
  if (trigger instanceof HTMLElement) {
    trigger.dataset.loading = "1";
  }
  window.location.href = String(data.checkout_url);
  return data;
}

async function consumeSpecificCreatorBoost(boostKind, quantity = 1, reason = "manual_regen") {
  const res = await fetch("/api/cssmv/boosts/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ boost_kind: boostKind, quantity, reason })
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.code || `creator_boost_consume_failed:${res.status}`);
  }
  await refreshCreatorBoostSurfaces({ renderAdvanced: true });
  return getApiData(payload);
}

async function handleStripeCheckoutReturn() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const mode = String(url.searchParams.get("stripe_checkout") || "").trim();
  const orderId = String(url.searchParams.get("order_id") || "").trim();
  const creatorBoostOrderId = String(url.searchParams.get("creator_boost_order_id") || "").trim();
  if (!mode) return;
  if (mode === "cancel" && orderId && authState.user) {
    try {
      await fetch("/api/stripe/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_id: orderId })
      });
      await loadPublicMarketWorks(true).catch(() => []);
      broadcastCommerceRefresh({ includeApi: false, includeMarket: true });
      showToast(loginCopy("Checkout canceled.", "支付已取消。"));
    } catch {
      // ignore
    }
  }
  if (mode === "success") {
    void loadPublicMarketWorks(true).then(() => broadcastCommerceRefresh({ includeApi: false, includeMarket: true }));
    if (creatorBoostOrderId && authState.user) {
      void refreshCreatorBoostSurfaces({ renderAdvanced: true });
      showToast(loginCopy("Creator Boost purchase completed. Extra capacity is now available in advanced settings.", "Creator Boost 购买已完成，额外容量已经可在高级设置里使用。"));
    }
  }
  url.searchParams.delete("stripe_checkout");
  url.searchParams.delete("order_id");
  url.searchParams.delete("creator_boost_order_id");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function grantAdminEntitlement(trigger = null) {
  const emailInput = advancedPanelSettings?.querySelector('[data-advanced-setting="admin-target-email"]');
  const kindInput = advancedPanelSettings?.querySelector('[data-advanced-setting="admin-entitlement-kind"]');
  const quantityInput = advancedPanelSettings?.querySelector('[data-advanced-setting="admin-entitlement-quantity"]');
  const noteInput = advancedPanelSettings?.querySelector('[data-advanced-setting="admin-entitlement-note"]');
  const email = String(emailInput?.value || "").trim();
  const boostKind = String(kindInput?.value || "").trim().toLowerCase();
  const quantity = Math.max(1, Number(quantityInput?.value || 1));
  const note = String(noteInput?.value || "").trim();
  if (!email || !boostKind) {
    safeShowToast(loginCopy("Enter the target email and entitlement type first.", "请先填写目标邮箱和权益类型。"));
    return;
  }
  setButtonBusy(trigger, true);
  try {
    const res = await fetch("/api/admin/entitlements/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, boost_kind: boostKind, quantity, note })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      throw new Error(payload?.message || `admin_entitlement_grant_failed:${res.status}`);
    }
    safeShowToast(loginCopy("Temporary entitlement granted.", "临时权益已发放。"));
    await refreshCreatorBoostSurfaces({ renderAdvanced: true });
  } catch (_err) {
    safeShowToast(loginCopy("Failed to grant entitlement.", "发放权益失败。"));
  } finally {
    setButtonBusy(trigger, false);
  }
}

function toggleMarketTipInput(card, forceOpen = null) {
  if (!(card instanceof Element)) return;
  const input = card.querySelector('[data-market-tip-input]');
  if (!(input instanceof HTMLInputElement)) return;
  const button = card.querySelector('[data-market-action="tip"], [data-watch-market-action="tip"]');
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
    const card = input.closest("[data-market-work-id], .work-hierarchy-item, #watch-commerce-actions");
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
  const workId = String(input.dataset.marketTipInput || card?.getAttribute("data-market-work-id") || "").trim();
  if (!workId) return;
  const amount = Number(input.value || 0);
  if (!Number.isFinite(amount) || amount < 1) {
    showToast(loginCopy("Tips start at $1.00.", "打赏金额至少为 1 美元。"));
    return;
  }
  await startStripeCheckoutForWork(workId, "tip", triggerButton || input, {
    tipAmountCents: Math.round(amount * 100)
  });
}

async function startCreatorPayoutOnboarding(trigger = null) {
  if (!isLoggedInUser()) {
    showToast(loginCopy("Please sign in first.", "请先登录。"));
    openPanel(loginPanel);
    return;
  }
  try {
    setButtonBusy(trigger, true);
    const res = await fetch("/api/stripe/connect/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ return_url: window.location.href, refresh_url: window.location.href })
    });
    const payload = await res.json().catch(() => null);
    const data = getApiData(payload);
    if (!res.ok || payload?.ok === false || !data?.onboarding_url) {
      throw new Error(payload?.code || `stripe_connect_start_failed:${res.status}`);
    }
    window.location.href = String(data.onboarding_url);
  } catch (_err) {
    showToast(
      loginCopy(
        "Open payout setup failed. Please try again.",
        "打开收款方式设置失败，请重试。"
      )
    );
  } finally {
    setButtonBusy(trigger, false);
  }
}

async function consumeCreatorBoostsIfNeeded() {
  const preset = getMembershipPreset();
  const counts = getCreationSelectionCounts();
  const extraLanguages = Math.max(0, counts.languageCount - preset.maxIncludedLanguages);
  const extraVoices = Math.max(0, counts.voiceLaneCount - preset.maxIncludedVoiceLanes);
  const tasks = [];
  if (extraLanguages > 0) {
    tasks.push(
      fetch("/api/cssmv/boosts/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ boost_kind: "language", quantity: extraLanguages, reason: "creation_run" })
      }).then((res) => res.json().catch(() => null).then((payload) => ({ res, payload })))
    );
  }
  if (extraVoices > 0) {
    tasks.push(
      fetch("/api/cssmv/boosts/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ boost_kind: "voice", quantity: extraVoices, reason: "creation_run" })
      }).then((res) => res.json().catch(() => null).then((payload) => ({ res, payload })))
    );
  }
  if (!tasks.length) return true;
  const results = await Promise.all(tasks);
  const failed = results.find(({ res, payload }) => !res.ok || payload?.ok === false);
  if (failed) {
    await loadCreatorBoostState(true);
    safeShowToast(loginCopy("Creator Boost entitlement is insufficient. Please purchase extra capacity first.", "当前 Creator Boost 额度不足，请先购买额外语言/声线容量。"));
    return false;
  }
  await loadCreatorBoostState(true);
  return true;
}

async function regenerateWorkThumbnail(work, trigger = null) {
  const workId = String(work?.work_id || work?.id || "").trim();
  if (!workId) return false;
  const availability = getCreatorBoostAvailability();
  if (availability.thumbnail < 1) {
    await createCreatorBoostCheckout("thumbnail", 1, trigger);
    return false;
  }
  setButtonBusy(trigger, true);
  try {
    await consumeSpecificCreatorBoost("thumbnail", 1, "thumbnail_regen");
    const title = String(work?.title || state.title || "CSS MV").trim();
    const subtitle = workCoverSubtitle(work);
    const image = await requestThumbnailDataUrl(title, subtitle, workLyricsLines(work));
    if (!image) throw new Error("thumbnail_regen_failed");
    updateLocalWorkAssets(workId, { cover_image: image });
    await persistWorkAssets(workId, { cover_image: image });
    if (currentPersistedRootWorkId === workId || String(currentWatchPreviewWork?.id || currentWatchPreviewWork?.work_id || "").trim() === workId) {
      setForyouThumbImage(image);
      if (currentWatchPreviewWork) currentWatchPreviewWork = { ...currentWatchPreviewWork, cover_image: image };
    }
    broadcastWorksCommerceRefresh({ includeMarket: true });
    showToast(loginCopy("Thumbnail regenerated and saved.", "缩略图已重生并保存。"));
    return true;
  } catch (_err) {
    showToast(loginCopy("Thumbnail regeneration failed.", "缩略图重生失败。"));
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
    await createCreatorBoostCheckout("preview_video", 1, trigger);
    return false;
  }
  setButtonBusy(trigger, true);
  try {
    await consumeSpecificCreatorBoost("preview_video", 1, "preview_video_regen");
    currentPersistedRootWorkId = workId;
    currentWatchPreviewWork = { ...(work || {}) };
    state.title = String(work?.title || state.title || "CSS MV").trim();
    state.lines = workLyricsLines(work);
    openWatchPreviewShellModule({ fallbackTab: "mv" });
    requestWatchVideoPreviewModule(state.title, state.lines);
    showToast(loginCopy("Preview video regeneration started.", "缩略视频重生已开始。"));
    return true;
  } catch (_err) {
    showToast(loginCopy("Preview video regeneration failed.", "缩略视频重生失败。"));
    return false;
  } finally {
    setButtonBusy(trigger, false);
  }
}
