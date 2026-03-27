const WATCH_ACTIVE_TAB_STORAGE_KEY = "cssos.watch.activeTab";
let watchActiveTab = localStorage.getItem(WATCH_ACTIVE_TAB_STORAGE_KEY) || "mv";
let currentPreviewVideoIsLocalFallback = false;
globalThis.currentPreviewFrameDataUrl ??= "";
globalThis.currentPreviewFrameSequence ??= [];
let currentForyouThumbFallbackDataUrl = "";
let watchVideoUrl = null;
let watchPreviewLimitSec = 0;
let watchPreviewLimitReason = "";
let watchPreviewLimitNoticeShown = false;
globalThis.watchFrameLoopTimer ??= null;
globalThis.watchFrameCache ??= new Map();
globalThis.watchFrameSequenceCache ??= new Map();
globalThis.watchManualPlayHinted ??= false;
globalThis.watchPlaybackRetry ??= 0;
globalThis.watchPlaybackTimer ??= null;
globalThis.currentPreviewVideoDurationSec ??= 0;
globalThis.currentPreviewVideoSourceKind ??= "none";
globalThis.currentPreviewVideoHasUsableFrame ??= false;
globalThis.currentPreviewMotionClipUrl ??= "";
globalThis.watchExplicitPreviewAllowedUntil ??= 0;

function armWatchExplicitPreviewIntent(ms = 15000) {
  globalThis.watchExplicitPreviewAllowedUntil = Date.now() + Math.max(1000, Number(ms) || 15000);
}

function syncForyouThumbFallbackModule(mode) {
  if (foryouThumbFallback) {
    foryouThumbFallback.style.display = mode === "fallback" ? "grid" : "none";
  }
  if (foryouThumbVideo) {
    foryouThumbVideo.style.display = mode === "video" ? "block" : "none";
  }
  if (foryouThumbImage) {
    foryouThumbImage.style.display = mode === "image" ? "block" : "none";
  }
}

function getForyouPreviewModeModule() {
  const raw = String(
    foryouPanel?.dataset?.previewMode ||
      localStorage.getItem(FORYOU_PREVIEW_MODE_KEY) ||
      FORYOU_PREVIEW_MODES.AUTO
  ).trim().toLowerCase();
  if (Object.values(FORYOU_PREVIEW_MODES).includes(raw)) return raw;
  return FORYOU_PREVIEW_MODES.AUTO;
}

function buildForyouThumbSvgModule(title, subtitle, lines = []) {
  const safeTitle = String(title || "CSS MV").replace(/</g, "&lt;");
  const safeSubtitle = String(subtitle || "").replace(/</g, "&lt;");
  const safeLine = String(lines.find((line) => String(line || "").trim()) || "")
    .replace(/</g, "&lt;")
    .slice(0, 56);
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
  <defs>
    <radialGradient id="foryouG" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="#12ffd2" stop-opacity="0.95"/>
      <stop offset="52%" stop-color="#0f6d5e" stop-opacity="0.68"/>
      <stop offset="100%" stop-color="#020302" stop-opacity="0.98"/>
    </radialGradient>
  </defs>
  <rect width="720" height="720" rx="80" fill="#020302"/>
  <circle cx="360" cy="296" r="214" fill="url(#foryouG)"/>
  <text x="50%" y="44%" text-anchor="middle" font-family="Syne, sans-serif" font-size="68" fill="#f4fffb" letter-spacing="6">${safeTitle}</text>
  <text x="50%" y="55%" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="22" fill="#9fead1" letter-spacing="4">${safeSubtitle}</text>
  <text x="50%" y="66%" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="20" fill="#dffef4" opacity="0.9">${safeLine}</text>
</svg>`
    )
  );
}

function syncForyouThumbFromLyricsModule(title, lines = []) {
  const subtitle = `${state.style || ""} · ${state.voice || ""}`.replace(/^ · | · $/g, "");
  const fallback = buildForyouThumbSvgModule(title, subtitle, lines);
  currentForyouThumbFallbackDataUrl = fallback;
  setForyouThumbImage(fallback);
  syncWatchPlaceholderFromCurrentState();
  return true;
}

function setForyouThumbImageModule(uri) {
  if (!foryouThumbImage || !uri) return false;
  foryouThumbImage.src = uri;
  setForyouBackgroundImage(uri);
  syncForyouThumbFallbackModule("image");
  schedulePersistCurrentWorkAssets();
  return true;
}

function restoreForyouThumbFallbackModule() {
  if (!currentForyouThumbFallbackDataUrl) {
    syncForyouThumbFallbackModule("fallback");
    return false;
  }
  setForyouThumbImageModule(currentForyouThumbFallbackDataUrl);
  return true;
}

function setForyouBackgroundImageModule(uri) {
  if (!foryouPanel) return;
  if (!uri) {
    foryouPanel.classList.remove("has-preview-background");
    return;
  }
  foryouPanel.classList.add("has-preview-background");
}

function resetForyouThumbModule() {
  if (foryouThumbVideo) {
    foryouThumbVideo.pause?.();
    foryouThumbVideo.removeAttribute("src");
    foryouThumbVideo.load?.();
  }
  if (foryouThumbImage) {
    foryouThumbImage.removeAttribute("src");
  }
  setForyouBackgroundImageModule("");
  syncForyouThumbFallbackModule("fallback");
}

function cancelAutoEnjoyModule() {
  autoEnjoyArmed = false;
  if (autoEnjoyTimer) {
    clearTimeout(autoEnjoyTimer);
    autoEnjoyTimer = null;
  }
}

function setForyouCompactModule(enabled, options = {}) {
  const armAuto = options?.armAuto === true;
  if (!foryouPanel) return;
  if (enabled) {
    foryouPanel.classList.add("foryou-panel-compact");
    foryouPanel.classList.remove("foryou-lyrics-expanded");
    if (
      !String(foryouThumbImage?.src || "").trim() &&
      !String(foryouThumbVideo?.src || "").trim() &&
      state.title &&
      Array.isArray(state.lines) &&
      state.lines.length
    ) {
      syncForyouThumbFromLyricsModule(state.title, state.lines);
    }
    if (armAuto) {
      armAutoEnjoy();
    } else {
      cancelAutoEnjoyModule();
    }
  } else {
    foryouPanel.classList.remove("foryou-panel-compact");
    foryouPanel.classList.remove("foryou-lyrics-expanded");
    cancelAutoEnjoyModule();
  }
}

function maybeCompactForyouAfterLyricsModule(options = {}) {
  const behavior = readPanelBehaviorSettingsLocal();
  if (behavior.foryou.compact_after_lyrics === false) return;
  setForyouCompactModule(true, options);
}

function clearForyouStructureModule() {
  if (foryouStructure) foryouStructure.innerHTML = "";
  currentForyouHierarchy = [];
  currentForyouLeafKey = "";
  foryouStructureNodeMap = new Map();
  if (foryouSelection) foryouSelection.hidden = true;
}

function syncForyouActionButtonsModule() {
  if (watchButton) {
    watchButton.textContent = loginCopy("Enjoy", "欣赏");
  }
}

function armAutoEnjoyModule(delayMs = 10000) {
  cancelAutoEnjoyModule();
  autoEnjoyArmed = true;
  autoEnjoyTimer = setTimeout(async () => {
    if (!autoEnjoyArmed) return;
    autoEnjoyArmed = false;
    autoEnjoyTimer = null;
    await openWatchPreviewFlowModule({ tryRegistry: true });
  }, Math.max(0, Number(delayMs ?? FORYOU_AUTO_ENJOY_DELAY_MS)));
}

function toggleForyouLyricsExpandedModule() {
  if (!foryouPanel || !state.lines?.length) return;
  if (!foryouPanel.classList.contains("foryou-panel-compact")) return;
  const nextExpanded = !foryouPanel.classList.contains("foryou-lyrics-expanded");
  if (nextExpanded && foryouSelectionTitle) {
    foryouSelectionTitle.textContent = String(state.title || "CSS MV").trim() || loginCopy("Untitled", "未命名");
  }
  if (nextExpanded && foryouSelectionKicker) {
    foryouSelectionKicker.textContent = loginCopy("Single Lyrics", "单曲歌词");
  }
  if (nextExpanded && foryouSelectionLyrics) {
    foryouSelectionLyrics.textContent = Array.isArray(state.lines) ? state.lines.join("\n") : "";
  }
  if (foryouSelection) {
    foryouSelection.hidden = !nextExpanded;
  }
  foryouPanel.classList.toggle("foryou-lyrics-expanded", nextExpanded);
  cancelAutoEnjoyModule();
}

function maybeFinalizeForyouPresentationModule() {
  if (foryouCompletionCommitted) return;
  if (
    !(
      typingState.completed &&
      engineProgressState.music >= 100 &&
      engineProgressState.video >= 100 &&
      engineProgressState.kara >= 100 &&
      karaCompletionAt > 0
    )
  ) {
    return;
  }
  foryouCompletionCommitted = true;
  stopPipelineProgressPolling();
  renderKaraEngineSnapshot(null, {
    currentStage: loginCopy("Karaoke locked", "卡拉 OK 已锁定"),
    artifactDetail: loginCopy("Ready for watch", "可以进入欣赏")
  });
  finishCreationSession();
  clearTimeout(foryouCompletionHoldTimer);
  const delayMs = Math.max(0, FORYOU_POST_COMPLETE_HOLD_MS - (Date.now() - karaCompletionAt));
  foryouCompletionHoldTimer = setTimeout(() => {
    clearInterval(progressTimer);
    setEngineProgressVisible("lyrics", false);
    armAutoEnjoyModule(0);
    layoutShowcasePanels();
    foryouCompletionHoldTimer = null;
  }, delayMs);
}

function buildMarketPreviewSeedModule(work = {}) {
  const title = String(work?.title || "").trim() || loginCopy("Untitled", "未命名");
  const lyrics = readWorkLyricsSourceTextModule(work);
  const musicStyle = String(work?.style || "").trim() || loginCopy("Creator preview", "创作者预览");
  const baseLines = lyrics
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const sectionTitles = baseLines.length
    ? baseLines.slice(0, 4)
    : [loginCopy("Verse preview", "主歌预览"), loginCopy("Hook preview", "副歌预览")];
  const sectionBeats = sectionTitles.map((line, index) => ({
    section: index === 0 ? "Intro" : index === 1 ? "Verse" : index === 2 ? "Chorus" : `Section ${index + 1}`,
    title: line.slice(0, 48),
    bars: index === 2 ? 8 : 6,
    energy: index === 2 ? "high" : index === 0 ? "medium-low" : "medium",
    focus: line.slice(0, 36),
    visual_role: index === 2 ? "hook moment" : "character setup"
  }));
  return {
    title,
    lyrics,
    musicStyle,
    musicStructure: sectionBeats.map((item) => item.section).join(" · "),
    videoOutline: loginCopy(
      `30-second buyer preview for ${title} by ${String(work?.owner_name || work?.owner_email || "creator").trim() || "creator"}.`,
      `${title} 的 30 秒买家预览，来自 ${String(work?.owner_name || work?.owner_email || "创作者").trim() || "创作者"}。`
    ),
    references: [],
    sectionPrompts: sectionBeats.map((item, index) => ({
      section: item.section,
      prompt: loginCopy(
        `Shot ${index + 1}: ${item.focus}. Keep it teaser-length and purchase-oriented.`,
        `镜头 ${index + 1}：${item.focus}。保持预告片长度，并突出购买意图。`
      )
    })),
    sectionBeats,
    styleTags: [musicStyle]
  };
}

function readWorkLyricsSourceTextModule(work = {}) {
  const direct = String(work?.lyrics_text || work?.lyrics_preview || "").trim();
  if (direct) return direct;
  const childLyrics = (Array.isArray(work?.children) ? work.children : [])
    .map((child) => readWorkLyricsSourceTextModule(child))
    .filter(Boolean);
  return childLyrics.join("\n").trim();
}

function workLyricsLinesModule(work = {}) {
  return extractDisplayLyricLinesModule(readWorkLyricsSourceTextModule(work));
}

function isInstructionalLyricLineModule(line) {
  const text = String(line || "").trim();
  if (!text) return true;
  const normalized = text.toLowerCase();
  if (/^#{1,6}\s+/.test(text)) return true;
  if (/^\[(intro|verse|chorus|bridge|outro|pre-chorus|hook)/i.test(text)) return true;
  if (/^(把《.+》写成|写成一首|write .+ as a song|turn .+ into a song)/i.test(text)) return true;
  if (/^(保留|主歌先|副歌|结尾|让|避免|不要|先用|open with|keep the |let the |close the |push the |repeat the |describe )/i.test(text)) {
    return true;
  }
  if (/(示例模板标题|用户输入优先|建立这首歌的主场景|形成记忆点|不要离开原本题目|镜头慢慢拉远|camera pulling away)/i.test(normalized)) {
    return true;
  }
  return false;
}

function extractDisplayLyricLinesModule(raw) {
  return String(raw || "")
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .filter((line) => !isInstructionalLyricLineModule(line));
}

function buildDisplayLyricsPreviewTextModule(work = {}) {
  const lyricLines = workLyricsLinesModule(work);
  if (lyricLines.length) {
    return lyricLines.join("\n");
  }
  const title = String(work?.title || "").trim() || loginCopy("Untitled", "未命名");
  const style = String(work?.style || "").trim();
  return loginCopy(
    `${title}${style ? ` · ${style}` : ""}`,
    `${title}${style ? ` · ${style}` : ""}`
  );
}

function getWorkCommerceDetailsModule(workId) {
  const commerce = watchCommerceState.payload || null;
  const market = commerce?.market || null;
  const profiles = Array.isArray(market?.profiles) ? market.profiles : [];
  const profile = profiles.find((entry) => String(entry?.work_id || "") === String(workId || ""));
  const listenCents = Number(profile?.current_listen_price_cents || 0);
  const buyoutCents = Number(profile?.current_buyout_price_cents || 0);
  return {
    listenCents,
    buyoutCents,
    buyoutEnabled: Boolean(profile?.buyout_enabled) && buyoutCents > 0
  };
}

function canReceiveTipsModule(work = {}) {
  return Boolean(work?.tips_enabled !== false);
}

function resolveViewerOrderStateModule(viewerOrders = []) {
  const orders = Array.isArray(viewerOrders) ? viewerOrders : [];
  const hasPaid = (kind) =>
    orders.some((entry) => String(entry?.order_kind || "") === kind && String(entry?.status || "") === "paid");
  const hasPending = (kind) =>
    orders.some(
      (entry) =>
        String(entry?.order_kind || "") === kind &&
        ["pending", "processing"].includes(String(entry?.status || ""))
    );
  return {
    paidListen: hasPaid("listen"),
    paidBuyout: hasPaid("buyout"),
    paidTip: hasPaid("tip"),
    pendingListen: hasPending("listen"),
    pendingBuyout: hasPending("buyout"),
    pendingTip: hasPending("tip")
  };
}

function renderUsageHistoryMarkupModule(entries = [], emptyCopy, limit = 8) {
  const rows = Array.isArray(entries) ? entries.slice(0, limit) : [];
  if (!rows.length) {
    return `<div class="watch-activity-empty">${escapeHtml(emptyCopy || loginCopy("No action charge history yet.", "还没有动作收费历史。"))}</div>`;
  }
  return rows
    .map((entry) => {
      const actionKey = resolveUsageActionKeyModule(entry);
      const estimatedCost = Math.max(0, Number(entry?.meta?.estimated_cost_cents || entry?.cost_cents || 0));
      const actualCost = Number(entry?.cost_cents || 0);
      const blocked = String(entry?.meta?.blocked || "").trim();
      const title = blocked
        ? `${billableActionLabelModule(actionKey)} · ${loginCopy("blocked", "已拦截")}`
        : billableActionLabelModule(actionKey);
      const detailParts = [
        loginCopy(`Actual ${formatUsdFromCents(actualCost, "$0.00")}`, `实际 ${formatUsdFromCents(actualCost, "$0.00")}`),
        loginCopy(`Estimate ${formatUsdFromCents(estimatedCost, "$0.00")}`, `估算 ${formatUsdFromCents(estimatedCost, "$0.00")}`),
        entry?.meta?.covered_by ? loginCopy(`covered by ${entry.meta.covered_by}`, `覆盖方式 ${entry.meta.covered_by}`) : "",
        blocked ? loginCopy(`reason ${blocked}`, `原因 ${blocked}`) : ""
      ].filter(Boolean);
      return `
        <div class="watch-activity-item">
          <div class="watch-activity-title">${escapeHtml(title)}</div>
          <div class="watch-activity-meta">${escapeHtml(`${detailParts.join(" · ")} · ${formatDateTime(entry?.created_at)}`)}</div>
        </div>
      `;
    })
    .join("");
}

function billableActionLabelModule(actionKey = "") {
  const normalized = String(actionKey || "").trim().toLowerCase();
  const labels = {
    lyrics_generate: loginCopy("Lyrics generate", "歌词生成"),
    music_generate: loginCopy("Music generate", "音乐生成"),
    video_generate: loginCopy("Video generate", "视频生成"),
    thumbnail_regenerate: loginCopy("Thumbnail regenerate", "重生缩略图"),
    preview_video_regenerate: loginCopy("Preview clip regenerate", "重生缩略视频"),
    multi_language: loginCopy("Extra lyric language", "额外歌词语言"),
    multi_voice: loginCopy("Extra voice lane", "额外声线"),
    enterprise_route: loginCopy("Enterprise API route", "企业 API 路由"),
    cinema_booking: loginCopy("Cinema booking", "电影级预约")
  };
  return labels[normalized] || normalized || loginCopy("Action", "动作");
}

function resolveUsageActionKeyModule(entry = {}) {
  return String(entry?.meta?.action_key || entry?.note || entry?.kind || "").trim().toLowerCase();
}

function getWorkMatchedUsageEventsModule(work = {}, entries = []) {
  const workId = String(work?.id || work?.work_id || work?.local_id || "").trim();
  const sourceRunId = String(work?.source_run_id || "").trim();
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const metaWorkId = String(entry?.meta?.work_id || "").trim();
    const metaRunId = String(entry?.meta?.source_run_id || entry?.meta?.job_id || "").trim();
    return !!((workId && metaWorkId && metaWorkId === workId) || (sourceRunId && metaRunId && metaRunId === sourceRunId));
  });
}

function renderLedgerHistoryMarkupModule(entries = [], emptyCopy, limit = 8) {
  const rows = Array.isArray(entries) ? entries.slice(0, limit) : [];
  if (!rows.length) {
    return `<div class="watch-activity-empty">${escapeHtml(emptyCopy || loginCopy("No ledger entries yet.", "还没有账本记录。"))}</div>`;
  }
  return rows
    .map((entry) => `
      <div class="watch-activity-item">
        <div class="watch-activity-title">${escapeHtml(String(entry?.note || entry?.kind || loginCopy("Ledger entry", "账本记录")))}</div>
        <div class="watch-activity-meta">${escapeHtml(`${formatUsdFromCents(Number(entry?.amount_cents || 0), "$0.00")} · ${formatDateTime(entry?.created_at)}`)}</div>
      </div>
    `)
    .join("");
}

function renderWorkCostBillMarkupModule(work = {}, entries = []) {
  const computeUnits = Math.max(0, Number(work?.compute_units_estimate || 0));
  const computeCost = Math.max(0, Number(work?.compute_cost_cents_estimate || 0));
  const suggestedListen = Math.max(0, Number(work?.suggested_listen_price_cents || 0));
  const suggestedBuyout = Math.max(0, Number(work?.suggested_buyout_price_cents || 0));
  const historyMarkup = renderUsageHistoryMarkupModule(
    getWorkMatchedUsageEventsModule(work, entries),
    loginCopy("This work does not yet have linked billable action rows.", "这个作品暂时还没有关联到动作计费明细。"),
    4
  );
  return `
    <div class="work-billing-card">
      <div class="work-billing-title">${loginCopy("Work cost bill", "作品成本账单")}</div>
      <div class="work-billing-grid">
        <div class="work-billing-stat"><span>${loginCopy("Compute", "算力")}</span><strong>${escapeHtml(`${computeUnits}u`)}</strong></div>
        <div class="work-billing-stat"><span>${loginCopy("Estimated cost", "估算成本")}</span><strong>${escapeHtml(formatUsdFromCents(computeCost, "$0.00"))}</strong></div>
        <div class="work-billing-stat"><span>${loginCopy("Suggested listen", "建议聆听价")}</span><strong>${escapeHtml(formatUsdFromCents(suggestedListen, "$0.00"))}</strong></div>
        <div class="work-billing-stat"><span>${loginCopy("Suggested buyout", "建议买断价")}</span><strong>${escapeHtml(formatUsdFromCents(suggestedBuyout, "$0.00"))}</strong></div>
      </div>
      <div class="work-extra">${escapeHtml(loginCopy("Pricing can be higher or lower than the system suggestion, but the cost bill stays visible for creators.", "你的定价可以高于或低于系统建议价，但创作者始终能看到这张成本账单。"))}</div>
      <div class="watch-activity compact">${historyMarkup}</div>
    </div>
  `;
}

function revealEnginePanelModule(engine) {
  const panel =
    engine === "lyrics"
      ? lyricsPanel
      : engine === "music"
        ? musicPanel
        : engine === "video"
          ? videoPanel
          : watchPanel;
  if (!panel) return;
  if (!enginePanelRevealState[engine]) {
    enginePanelRevealState[engine] = true;
  }
  if (engine === "kara") {
    openWatchPreviewShellModule({ fallbackTab: "mv" });
  } else {
    openPanel(panel);
  }
  focusPanel(panel);
}

function pinLyricsViewportToLiveEdgeModule() {
  if (!lyricsEl) return;
  requestAnimationFrame(() => {
    lyricsEl.scrollTop = lyricsEl.scrollHeight;
  });
}

function getEngineProgressShellModule(engine) {
  return engine === "lyrics"
    ? lyricsProgressShell
    : engine === "music"
      ? musicProgressShell
      : engine === "video"
        ? videoProgressShell
        : karaProgressShell;
}

function getEngineProgressBarModule(engine) {
  return engine === "lyrics"
    ? lyricsProgress
    : engine === "music"
      ? musicProgress
      : engine === "video"
        ? videoProgress
        : karaProgress;
}

function getEngineProgressTitleModule(engine) {
  return getEngineProgressShellModule(engine)?.querySelector(".engine-progress-title") || null;
}

function setEngineProgressVisibleModule(engine, visible, options = {}) {
  const shell = getEngineProgressShellModule(engine);
  if (!shell) return;
  clearTimeout(engineProgressHideTimers[engine]);
  engineProgressHideTimers[engine] = null;
  const immediate = options?.immediate === true;
  if (visible) {
    shell.hidden = false;
    shell.classList.remove("is-fading");
    return;
  }
  if (immediate) {
    shell.hidden = true;
    shell.classList.remove("is-fading");
    return;
  }
  shell.classList.add("is-fading");
  engineProgressHideTimers[engine] = setTimeout(() => {
    shell.hidden = true;
    shell.classList.remove("is-fading");
    engineProgressHideTimers[engine] = null;
  }, 1400);
}

function setEngineDetailModule(engine, detail) {
  engineDetailState[engine] = String(detail || "").trim();
  const target =
    engine === "lyrics"
      ? lyricsProgressDetail
      : engine === "music"
        ? musicProgressDetail
        : engine === "video"
          ? videoProgressDetail
          : karaProgressDetail;
  if (!target) return;
  target.textContent = engineDetailState[engine];
  syncWatchEngineGrid();
}

function setEngineStateModule(engine, state) {
  engineStates[engine] = state;
  const shell = getEngineProgressShellModule(engine);
  if (!shell) return;
  const titleEl = getEngineProgressTitleModule(engine);
  if (!shell.dataset.baseTitle && titleEl) {
    shell.dataset.baseTitle = titleEl.textContent;
  }
  shell.classList.remove("paused", "canceled", "running");
  if (state === "paused") {
    shell.classList.add("paused");
    setEngineProgressVisibleModule(engine, true, { immediate: true });
  }
  if (state === "running") {
    shell.classList.add("running");
    setEngineProgressVisibleModule(engine, true, { immediate: true });
  }
  if (state === "canceled") {
    shell.classList.add("canceled");
    const progressEl = getEngineProgressBarModule(engine);
    if (progressEl) setProgress(progressEl, 0);
    setEngineProgressVisibleModule(engine, false);
  }
  if (titleEl) {
    const base = shell.dataset.baseTitle || titleEl.textContent;
    const suffix =
      state === "paused" ? " · Paused" : state === "canceled" ? " · Canceled" : "";
    titleEl.textContent = `${base}${suffix}`;
  }
  if (engine === "video" && state === "canceled") {
    pruneSceneRows();
    sceneRows.forEach((entry) => {
      const current = entry?.statusEl?.dataset?.state || "queued";
      if (["done", "delete", "canceled"].includes(current)) return;
      setSceneState(entry.row, entry.statusEl, "canceled");
    });
  }
  syncWatchEngineGrid();
}

function cycleEngineStateModule(engine) {
  if (engine === "lyrics") {
    cycleLyricsState();
    return;
  }
  const state = engineStates[engine];
  if (state === "running") {
    setEngineStateModule(engine, "paused");
    showToast(`${engine} paused`);
    return;
  }
  if (state === "paused") {
    setEngineStateModule(engine, "canceled");
    showToast(`${engine} canceled`);
  }
}

function initEngineControlsModule() {
  document.querySelectorAll("[data-engine-progress]").forEach((shell) => {
    const engine = shell.getAttribute("data-engine-progress");
    if (!engine) return;
    shell.addEventListener("click", () => cycleEngineStateModule(engine));
  });
}

function resetEngineStatesModule() {
  setEngineStateModule("lyrics", "running");
  setEngineStateModule("music", "pending");
  setEngineStateModule("video", "pending");
  setEngineStateModule("kara", "pending");
  setEngineProgressVisibleModule("lyrics", true, { immediate: true });
}

function animateProgressModule() {
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (engineStates.lyrics === "running" && lyricsProgress) {
      const current = lyricsEl?.textContent?.length || 0;
      const pct = lyricsTargetLength ? Math.min(100, (current / lyricsTargetLength) * 100) : 0;
      setProgress(lyricsProgress, pct);
    }
    if (!activePipelineRunId) {
      setProgress(musicProgress, engineProgressState.music);
      setProgress(videoProgress, engineProgressState.video);
      setProgress(karaProgress, engineProgressState.kara);
      syncSceneProgress(engineProgressState.video);
    }
    if (typingState.completed) setEngineProgressVisibleModule("lyrics", false);
    if (engineProgressState.music >= 100) setEngineProgressVisibleModule("music", false);
    if (engineProgressState.video >= 100) setEngineProgressVisibleModule("video", false);
    if (engineProgressState.kara >= 100) setEngineProgressVisibleModule("kara", false);
    syncWatchEngineGrid();
    maybeFinalizeForyouPresentationModule();
  }, 420);
}

function resetTypingStateModule() {
  typingState = { paused: false, canceled: false, completed: false };
  foryouCompletionCommitted = false;
  karaCompletionAt = 0;
  clearTimeout(foryouCompletionHoldTimer);
  foryouCompletionHoldTimer = null;
  stopPipelineProgressPolling();
  enginePanelRevealState.lyrics = false;
  enginePanelRevealState.music = false;
  enginePanelRevealState.video = false;
  enginePanelRevealState.kara = false;
  engineProgressState.music = 0;
  engineProgressState.video = 0;
  engineProgressState.kara = 0;
  if (musicProgress) setProgress(musicProgress, 0);
  if (videoProgress) setProgress(videoProgress, 0);
  if (karaProgress) setProgress(karaProgress, 0);
  if (lyricsEl) {
    lyricsEl.classList.remove("paused", "canceled");
    lyricsEl.textContent = "";
    lyricsEl.scrollTop = 0;
  }
  enterLyricSpellcast();
  setEngineProgressVisibleModule("lyrics", true, { immediate: true });
  setEngineProgressVisibleModule("music", false, { immediate: true });
  setEngineProgressVisibleModule("video", false, { immediate: true });
  setEngineProgressVisibleModule("kara", false, { immediate: true });
  setEngineStateModule("lyrics", "running");
  setEngineStateModule("music", "pending");
  setEngineStateModule("video", "pending");
  setEngineStateModule("kara", "pending");
  setEngineDetailModule("lyrics", "stage: typing");
  setEngineDetailModule("music", "waiting for audio engine");
  setEngineDetailModule("video", "waiting for video engine");
  setEngineDetailModule("kara", "waiting for karaoke sync");
  if (lyricsProgress) setProgress(lyricsProgress, 0);
  revealEnginePanelModule("lyrics");
  syncWatchEngineGrid();
  renderWatchKaraokeOverlay(0);
}

function cycleLyricsStateModule() {
  if (!lyricsEl || typingState.canceled) return;
  if (!typingState.paused) {
    typingState.paused = true;
    lyricsEl.classList.add("paused");
    setEngineStateModule("lyrics", "paused");
    setEngineDetailModule("lyrics", "stage: paused");
    showToast("Lyrics paused");
    return;
  }
  typingState.canceled = true;
  lyricsEl.classList.remove("paused");
  lyricsEl.classList.add("canceled");
  clearTimeout(typingTimer);
  setEngineProgressVisibleModule("lyrics", false);
  exitLyricSpellcast(true);
  setEngineStateModule("lyrics", "canceled");
  setEngineDetailModule("lyrics", "stage: canceled");
  showToast("Lyrics canceled");
}

function initLyricsControlsModule() {
  if (!lyricsEl) return;
  lyricsEl.addEventListener("click", cycleLyricsStateModule);
}

function setProgressModule(el, value) {
  if (!el) return;
  el.style.width = `${value}%`;
}

function currentLyricsProgressPercentModule() {
  const current = lyricsEl?.textContent?.length || 0;
  return lyricsTargetLength ? Math.min(100, (current / lyricsTargetLength) * 100) : 0;
}

function syncWatchEngineGridModule() {
  if (!watchEngineGrid) return;
  clearChildren(watchEngineGrid);
  const behavior = readPanelBehaviorSettingsLocal();
  const compactDetail = behavior.watch.engine_detail === "compact";
  const cards = [
    {
      engine: "lyrics",
      title: loginCopy("Lyrics Engine", "歌词引擎"),
      progress: currentLyricsProgressPercentModule(),
      detail: engineDetailState.lyrics || loginCopy("Waiting", "等待中")
    },
    {
      engine: "music",
      title: loginCopy("Audio Engine", "音频引擎"),
      progress: engineProgressState.music,
      detail: engineDetailState.music || loginCopy("Waiting", "等待中")
    },
    {
      engine: "video",
      title: loginCopy("Video Engine", "视频引擎"),
      progress: engineProgressState.video,
      detail: engineDetailState.video || loginCopy("Waiting", "等待中")
    },
    {
      engine: "kara",
      title: loginCopy("Karaoke Sync", "卡拉 OK 同步"),
      progress: engineProgressState.kara,
      detail: engineDetailState.kara || loginCopy("Waiting", "等待中")
    }
  ];
  cards.forEach((cardInfo) => {
    const card = document.createElement("div");
    card.className = "watch-engine-card";
    const title = document.createElement("div");
    title.className = "watch-engine-title";
    title.textContent = cardInfo.title;
    const progress = document.createElement("div");
    progress.className = "watch-engine-progress";
    const fill = document.createElement("span");
    fill.style.width = `${Math.round(clampPercent(cardInfo.progress || 0))}%`;
    progress.appendChild(fill);
    const detail = document.createElement("div");
    detail.className = "watch-engine-detail";
    detail.textContent = cardInfo.detail;
    if (compactDetail) detail.hidden = true;
    card.appendChild(title);
    card.appendChild(progress);
    card.appendChild(detail);
    watchEngineGrid.appendChild(card);
  });
}

function renderWatchKaraokeOverlayModule(progress = 0) {
  if (!watchKaraokeLine) return;
  const lines = compactLyricLines(state.lines || []).filter(Boolean);
  if (!lines.length) {
    watchKaraokeLine.innerHTML = "";
    return;
  }
  const normalizedProgress = clampPercent(progress);
  const currentIndex = Math.min(lines.length - 1, Math.floor((normalizedProgress / 100) * lines.length));
  const prev = lines[Math.max(0, currentIndex - 1)] || "";
  const current = lines[currentIndex] || lines[0] || "";
  const next = lines[Math.min(lines.length - 1, currentIndex + 1)] || "";
  watchKaraokeLine.innerHTML = `
    ${prev && prev !== current ? `<div class="watch-karaoke-prev">${escapeHtml(prev)}</div>` : ""}
    <div class="watch-karaoke-current ${normalizedProgress > 0 ? "is-active" : ""}">${escapeHtml(current)}</div>
    ${next && next !== current ? `<div class="watch-karaoke-next">${escapeHtml(next)}</div>` : ""}
  `;
}

function hasWatchExplicitPreviewIntent() {
  return Number(globalThis.watchExplicitPreviewAllowedUntil || 0) > Date.now();
}

function canUseWatchDemoFallback() {
  return !!watchPanel && !watchPanel.classList.contains("hidden") && hasWatchExplicitPreviewIntent();
}

const closeEnjoyOverlay = () => {
  const overlay = document.getElementById("mv-overlay");
  if (!overlay) return;
  const video = overlay.querySelector("video");
  if (video) {
    video.pause?.();
    video.removeAttribute("src");
    video.load?.();
  }
  overlay.classList.remove("show");
};

const showEnjoyOverlay = (url, labelText = "") => {
  let overlay = document.getElementById("mv-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "mv-overlay";
    overlay.className = "mv-overlay";
    overlay.innerHTML = `
      <div class="mv-overlay-inner">
        <div class="mv-overlay-label" style="position:absolute;top:10px;left:14px;color:rgba(255,255,255,0.85);font-size:12px;letter-spacing:0.18em;text-transform:uppercase;display:none;">demo</div>
        <button type="button" class="mv-overlay-close">${t("overlay.close")}</button>
        <video class="mv-overlay-video" autoplay loop playsinline controls></video>
      </div>
    `;
    document.body.appendChild(overlay);
    const closeBtn = overlay.querySelector(".mv-overlay-close");
    closeBtn?.addEventListener("click", closeEnjoyOverlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeEnjoyOverlay();
    });
  }
  const label = overlay.querySelector(".mv-overlay-label");
  if (label) {
    if (labelText) {
      label.textContent = labelText;
      label.style.display = "block";
    } else {
      label.style.display = "none";
    }
  }
  const video = overlay.querySelector("video");
  if (video) {
    video.src = url;
    video.muted = false;
    video.playsInline = true;
    video.load?.();
    video.play?.().catch(() => {});
  }
  overlay.classList.add("show");
};

const DEMO_BASES = ["/assets/examples/", "/examples/"];
const DEMO_MANIFESTS = ["/api/example-assets/manifest?kind=all"];
const DEMO_MV_FILES = [
  "19700121_0706_69982ff105c48191a0e4f69bdf19f49e.mp4",
  "M6N0t1rbV74_002_720p.mp4",
  "The.Curse.mp4",
  "The.Register.of.Souls.mp4",
  "YTDown.com_YouTube_Media_M6N0t1rbV74_002_720p.mp4",
  "YTDown.com_YouTube_Media_dKWwe0hbKvc_002_720p.mp4",
  "YTDown.com_YouTube_Media_pKnnjgJTwhU_002_720p.mp4",
  "YTDown.com_YouTube_Media_y1EBKVq5N9Q_002_720p.mp4",
  "YTDown.com_YouTube_Real-Frontier-17_Media_mFGFzCP_fYM_002_720p.mp4",
  "mirror-video.MP4"
];
const DEMO_AUDIO_FILES = [
  "Nvwa.and.the.Sundering.of.Chaos.wav",
  "The.Mount.Hermon.Oath.wav",
  "The.Cleaving.of.Chaos.混沌之破.wav",
  "Brothers.Sacred.Song.我替你挡住世界.mp3",
  "Cai.Wei.采薇.mp3",
  "The.Arrival.at.the.Celestial.Court .登天庭问道.mp3",
  "The.Door.That.Smelled.of.Ink.墨香之门.mp3",
  "Weeping.Down.The.Wall.哭倒长城.mp3",
  "长相思·一重山.mp3"
];

let demoMvCache = null;
let demoAudioCache = null;
const normalizeDemoManifestEntries = (payload) => {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
      ? payload.map((value) => ({ name: String(value || "").trim() }))
      : Array.isArray(payload?.files)
        ? payload.files.map((value) => ({ name: String(value || "").trim() }))
        : [];
  return items
    .map((entry) => {
      const name = String(entry?.name || entry?.file || "").trim();
      const url = String(entry?.url || "").trim();
      if (!name) return null;
      return { name, url };
    })
    .filter(Boolean);
};
const getDemoMvFiles = async () => {
  if (demoMvCache && Array.isArray(demoMvCache) && demoMvCache.length) return demoMvCache;
  for (const url of DEMO_MANIFESTS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const mp4s = normalizeDemoManifestEntries(data).filter((entry) => entry.name.toLowerCase().endsWith(".mp4"));
      if (mp4s.length) {
        demoMvCache = mp4s;
        return demoMvCache;
      }
    } catch (_err) {
      // ignore manifest errors
    }
  }
  demoMvCache = DEMO_MV_FILES.map((name) => ({ name, url: "" }));
  return demoMvCache;
};

const getDemoAudioFiles = async () => {
  if (demoAudioCache && Array.isArray(demoAudioCache) && demoAudioCache.length) return demoAudioCache;
  for (const url of DEMO_MANIFESTS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const audioFiles = normalizeDemoManifestEntries(data).filter((entry) => /\.(wav|mp3|m4a|aac|flac|ogg)$/i.test(entry.name));
      if (audioFiles.length) {
        demoAudioCache = audioFiles;
        return demoAudioCache;
      }
    } catch (_err) {
      // ignore manifest errors
    }
  }
  demoAudioCache = DEMO_AUDIO_FILES.map((name) => ({ name, url: "" }));
  return demoAudioCache;
};

const buildExampleAssetCandidates = (entry) => {
  const directUrl = String(entry?.url || "").trim();
  const name = String(entry?.name || "").trim();
  if (directUrl) return [directUrl];
  return [buildExampleAssetProxyUrl(name), ...DEMO_BASES.map((base) => `${base}${name}`)].filter(Boolean);
};

const pickFirstWorkingUrl = async (files) => {
  const shuffled = files.slice().sort(() => Math.random() - 0.5);
  for (const entry of shuffled) {
    const candidates = buildExampleAssetCandidates(entry);
    for (const url of candidates) {
      try {
        let res = await fetch(url, { method: "HEAD" });
        if (!res.ok) {
          res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
        }
        if (res.status === 200 || res.status === 206) return url;
      } catch (_err) {
        // ignore
      }
    }
  }
  return "";
};

const isMediaReachable = async (url) => {
  if (!url) return false;
  try {
    let res = await fetch(url, { method: "HEAD" });
    if (!res.ok) {
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
    }
    return res.status === 200 || res.status === 206;
  } catch (_err) {
    return false;
  }
};

const showEnjoyOverlaySafe = async (url, labelText = "") => {
  const ok = await isMediaReachable(url);
  if (!ok) return false;
  showEnjoyOverlay(url, labelText);
  return true;
};

const playDemoMV = async () => {
  showToast(t("mic.no_data_demo"));
  const files = await getDemoMvFiles();
  const url = await pickFirstWorkingUrl(files);
  if (url) {
    showEnjoyOverlay(url, t("mic.demo_label"));
    return;
  }
  showToast(t("mic.no_demo_found"));
};

const playDemoMedia = () => {
  useLocalWatchVideoFallbackModule(state.title, `${state.style} ${state.voice} cinematic mv`);
  showToast(t("mic.generation_failed_playing_demo"));
};

function resolvePreferredWatchOpenTab(fallback = "mv") {
  const configured = String(readPanelBehaviorSettingsLocal()?.watch?.default_tab || watchActiveTab || fallback || "mv").trim();
  if (["mv", "music", "lyrics", "script", "comments", "revenue", "ownership"].includes(configured)) {
    return configured;
  }
  return "mv";
}

function activateWatchTab(tab) {
  const active = ["mv", "music", "lyrics", "script", "comments", "revenue", "ownership"].includes(tab) ? tab : "mv";
  watchActiveTab = active;
  localStorage.setItem(WATCH_ACTIVE_TAB_STORAGE_KEY, active);
  watchTabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.watchTab === active);
  });
  watchPanes.forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.watchPane === active);
  });
  if (active === "music" && watchAudioPreview) {
    watchAudioPreview.style.display = "block";
    if (
      (!String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim() ||
        String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim().startsWith("data:audio/")) &&
      getRememberedWatchFinalAudio()
    ) {
      restoreRememberedWatchFinalAudio();
    }
    if (currentWatchAudioSourceKind === "final-artifact" || getRememberedWatchFinalAudio()) {
      syncWatchAudioPresentation();
      updateWatchAudioDebug();
    }
  }
  if (active === "comments" || active === "revenue" || active === "ownership") {
    renderWatchMetaPanelsModule();
  }
}

function shouldKeepWatchInMusicModeModule() {
  const preferred = resolvePreferredWatchOpenTab("mv");
  return (watchActiveTab === "music" || preferred === "music") && !!getRememberedWatchFinalAudio();
}

function stopWatchMusicVisualizerModule() {
  if (watchMusicAnalyserFrame) {
    cancelAnimationFrame(watchMusicAnalyserFrame);
    watchMusicAnalyserFrame = 0;
  }
  if (watchMusicStage) {
    watchMusicStage.style.setProperty("--watch-aura-scale", "1");
    watchMusicStage.style.setProperty("--watch-aura-opacity", "0.86");
    watchMusicStage.style.setProperty("--watch-ring-glow", "0.22");
    watchMusicStage.style.setProperty("--watch-progress-glow", "0.4");
    watchMusicStage.style.setProperty("--watch-disc-lift", "0px");
    watchMusicStage.style.setProperty("--watch-music-shadow-live", "var(--watch-music-shadow)");
    watchMusicStage.style.setProperty("--watch-music-secondary-shadow-live", "var(--watch-music-secondary-shadow)");
  }
}

function tickWatchMusicVisualizerModule() {
  if (!watchMusicAnalyser || !watchMusicStage || !watchAudioPreview || watchAudioPreview.paused) {
    stopWatchMusicVisualizerModule();
    return;
  }
  if (!watchMusicAnalyserData) {
    watchMusicAnalyserData = new Uint8Array(watchMusicAnalyser.frequencyBinCount);
  }
  watchMusicAnalyser.getByteFrequencyData(watchMusicAnalyserData);
  const sum = watchMusicAnalyserData.reduce((acc, value) => acc + value, 0);
  const avg = watchMusicAnalyserData.length ? sum / watchMusicAnalyserData.length : 0;
  const energy = Math.max(0, Math.min(1, avg / 160));
  watchMusicStage.style.setProperty("--watch-aura-scale", `${(1 + energy * 0.11).toFixed(3)}`);
  watchMusicStage.style.setProperty("--watch-aura-opacity", `${(0.78 + energy * 0.36).toFixed(3)}`);
  watchMusicStage.style.setProperty("--watch-ring-glow", `${(0.22 + energy * 0.4).toFixed(3)}`);
  watchMusicStage.style.setProperty("--watch-progress-glow", `${(0.42 + energy * 0.5).toFixed(3)}`);
  watchMusicStage.style.setProperty("--watch-disc-lift", `${(energy * 2.8).toFixed(2)}px`);
  watchMusicStage.style.setProperty("--watch-music-shadow-live", `rgba(var(--watch-music-accent-1-rgb), ${(0.18 + energy * 0.26).toFixed(3)})`);
  watchMusicStage.style.setProperty("--watch-music-secondary-shadow-live", `rgba(var(--watch-music-accent-2-rgb), ${(0.12 + energy * 0.24).toFixed(3)})`);
  watchMusicAnalyserFrame = requestAnimationFrame(tickWatchMusicVisualizerModule);
}

async function ensureWatchMusicVisualizerModule() {
  if (!watchAudioPreview || typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!watchMusicAudioContext) {
    watchMusicAudioContext = new AudioCtx();
  }
  if (watchMusicAudioContext.state === "suspended") {
    await watchMusicAudioContext.resume().catch(() => {});
  }
  if (!watchMusicSourceNode) {
    watchMusicSourceNode = watchMusicAudioContext.createMediaElementSource(watchAudioPreview);
    watchMusicAnalyser = watchMusicAudioContext.createAnalyser();
    watchMusicAnalyser.fftSize = 128;
    watchMusicSourceNode.connect(watchMusicAnalyser);
    watchMusicAnalyser.connect(watchMusicAudioContext.destination);
  }
  if (!watchMusicAnalyserFrame) {
    tickWatchMusicVisualizerModule();
  }
}

function syncWatchMusicStateModule() {
  if (!watchMusicStage || !watchMusicPlayIcon) return;
  const playing = !!(watchAudioPreview && !watchAudioPreview.paused && !watchAudioPreview.ended);
  watchMusicStage.classList.toggle("is-playing", playing);
  watchMusicPlayIcon.textContent = playing ? "❚❚" : "▶";
  if (watchMusicRing && watchAudioPreview) {
    const duration = Number.isFinite(watchAudioPreview.duration) ? watchAudioPreview.duration : 0;
    const current = Number.isFinite(watchAudioPreview.currentTime) ? watchAudioPreview.currentTime : 0;
    const progress = duration > 0 ? Math.max(0, Math.min(1, current / duration)) : 0;
    watchMusicRing.style.setProperty("--watch-progress", `${Math.round(progress * 360)}deg`);
  }
  if (playing) {
    void ensureWatchMusicVisualizerModule();
  } else {
    stopWatchMusicVisualizerModule();
  }
}

function syncWatchEditorsFromSettingsModule() {
  if (watchLyricsEditor && lyricsInput) watchLyricsEditor.value = lyricsInput.value || "";
  if (watchOutlineEditor && videoOutlineInput) watchOutlineEditor.value = videoOutlineInput.value || "";
  if (watchScriptEditor && sectionPromptsInput) watchScriptEditor.value = sectionPromptsInput.value || "";
}

function renderWatchMetaPanelsModule() {
  if (watchCommentsCopy) {
    watchCommentsCopy.textContent = t("watch.comments.empty");
  }
  const commerce = watchCommerceState.payload || null;
  const account = commerce?.account || null;
  const ownership = commerce?.ownership || null;
  const market = commerce?.market || null;
  const ledgerEntries = Array.isArray(commerce?.ledger_entries) ? commerce.ledger_entries : [];
  const works = Array.isArray(ownership?.works) ? ownership.works : [];
  const orders = Array.isArray(market?.orders) ? market.orders : [];
  const tipsList = Array.isArray(market?.tips) ? market.tips : [];
  const transfers = Array.isArray(market?.ownership_transfers) ? market.ownership_transfers : [];

  if (watchOwnershipCopy) {
    const owner = commerce?.profile?.email || authState.user?.email || t("watch.ownership.guest");
    const source = state.title || "CSS MV";
    const worksCount = Number(ownership?.works_count || works.length || 0);
    const latestTransfer = transfers[0] || null;
    const latestTransferAmount = latestTransfer ? formatUsdFromCents(latestTransfer.transfer_amount_cents, "$0.00") : "—";
    watchOwnershipCopy.textContent =
      `${t("watch.ownership.current")}: ${owner}\n` +
      `${t("watch.ownership.source")}: ${source}\n` +
      `${t("watch.ownership.worksCount")}: ${worksCount}\n` +
      `${t("watch.revenue.buyouts")}: ${transfers.length} · ${latestTransferAmount}`;
  }
  if (watchOwnershipList) {
    if (!authState.user || !works.length) {
      watchOwnershipList.innerHTML = `<div class="watch-activity-empty">${t("watch.ownership.none")}</div>`;
    } else {
      const ownershipItems = [
        ...transfers.map((transfer) => ({
          title: `${t("watch.ownership.buyout")} · ${formatUsdFromCents(transfer?.transfer_amount_cents, "$0.00")}`,
          meta: `${escapeHtml(String(transfer?.transfer_kind || t("watch.ownership.buyout")))} · ${escapeHtml(formatDateTime(transfer?.effective_at || transfer?.created_at))}`
        })),
        ...works.map((work) => ({
          title: String(work?.title || "").trim() || "CSS MV",
          meta: `${escapeHtml(String(work?.status || "draft"))} · ${escapeHtml(formatDateTime(work?.updated_at || work?.created_at))}`
        }))
      ].slice(0, 8);
      watchOwnershipList.innerHTML = ownershipItems
        .map((item) => `
          <div class="watch-activity-item">
            <div class="watch-activity-title">${escapeHtml(item.title)}</div>
            <div class="watch-activity-meta">${item.meta}</div>
          </div>
        `)
        .join("");
    }
  }
  if (watchRevenueGrid) {
    const subscription = commerce?.profile?.tier || billingState.tier || authState.tier || authState.role || DEFAULT_ROLE;
    const balance = account?.balance_cents ?? billingState.balance_cents;
    const monthSpent = account?.month_spent_cents ?? 0;
    const monthLimit = account?.monthly_limit_cents ?? billingState.monthly_limit_cents;
    const listeners = orders.filter((entry) => String(entry?.order_kind || "") === "listen" && String(entry?.status || "") === "paid").length || works.length;
    const tips = tipsList.reduce((sum, entry) => sum + Math.max(0, Number(entry?.amount_cents || 0)), 0);
    const buyouts = transfers.length;
    const earningsFromOrders = orders.reduce((sum, entry) => sum + Math.max(0, Number(entry?.seller_net_cents || 0)), 0);
    const earnings = Math.max(
      earningsFromOrders + tips,
      ledgerEntries.filter((entry) => Number(entry?.amount_cents) > 0).reduce((sum, entry) => sum + Number(entry?.amount_cents || 0), 0)
    );
    watchRevenueGrid.innerHTML = `
      <div class="watch-metric">
        <div class="watch-metric-label">${t("works.subscription")}</div>
        <div class="watch-metric-value">${escapeHtml(String(subscription || DEFAULT_ROLE))}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.balance")}</div>
        <div class="watch-metric-value">${escapeHtml(formatUsdFromCents(balance, t("watch.revenue.unlimited")))}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.monthSpent")}</div>
        <div class="watch-metric-value">${escapeHtml(formatUsdFromCents(monthSpent, "$0.00"))}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.monthlyLimit")}</div>
        <div class="watch-metric-value">${escapeHtml(formatUsdFromCents(monthLimit, t("watch.revenue.unlimited")))}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.listeners")}</div>
        <div class="watch-metric-value">${listeners}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.tips")}</div>
        <div class="watch-metric-value">${escapeHtml(formatUsdFromCents(tips, "$0.00"))}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.buyouts")}</div>
        <div class="watch-metric-value">${buyouts}</div>
      </div>
      <div class="watch-metric">
        <div class="watch-metric-label">${t("watch.revenue.earnings")}</div>
        <div class="watch-metric-value">${escapeHtml(formatUsdFromCents(earnings, "$0.00"))}</div>
      </div>
    `;
  }
  if (watchRevenueActivity) {
    if (!authState.user) {
      watchRevenueActivity.innerHTML = `<div class="watch-activity-empty">${t("watch.revenue.noActivity")}</div>`;
    } else if (!ledgerEntries.length && !orders.length && !tipsList.length) {
      watchRevenueActivity.innerHTML = `<div class="watch-activity-empty">${t("watch.revenue.noActivity")}</div>`;
    } else {
      const activityRows = [
        ...orders.map((entry) => ({
          title: `${t("watch.revenue.order")} · ${String(entry?.order_kind || t("watch.revenue.listeners")).trim()}`,
          amount: Number(entry?.seller_net_cents || entry?.gross_amount_cents || 0),
          at: entry?.updated_at || entry?.created_at
        })),
        ...tipsList.map((entry) => ({
          title: `${t("watch.revenue.tipEntry")}${entry?.message ? ` · ${String(entry.message)}` : ""}`,
          amount: Number(entry?.amount_cents || 0),
          at: entry?.created_at
        })),
        ...ledgerEntries.map((entry) => ({
          title: String(entry?.note || entry?.kind || "entry"),
          amount: Number(entry?.amount_cents || 0),
          at: entry?.created_at
        }))
      ]
        .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
        .slice(0, 12);
      watchRevenueActivity.innerHTML = activityRows
        .map((entry) => {
          const amount = Number(entry?.amount || 0);
          const sign = amount > 0 ? "+" : "";
          return `
            <div class="watch-activity-item">
              <div class="watch-activity-title">${escapeHtml(String(entry?.title || "entry"))}</div>
              <div class="watch-activity-meta">${escapeHtml(`${sign}${formatUsdFromCents(amount, "$0.00")} · ${formatDateTime(entry?.at)}`)}</div>
            </div>
          `;
        })
        .join("");
    }
  }
  if (authState.user && !watchCommerceState.loaded && !watchCommerceState.loading) {
    void loadWatchCommerce().then(() => renderWatchMetaPanelsModule());
  }
}

function renderWatchCommerceActionsModule(work = currentWatchPreviewWork) {
  if (!watchCommerceActions) return;
  const workId = String(work?.id || work?.work_id || "").trim();
  if (!workId) {
    watchCommerceActions.hidden = true;
    watchCommerceActions.innerHTML = "";
    return;
  }
  const isOwnedByViewer =
    Boolean(authState.user?.id) && String(work?.owner_user_id || "").trim() === String(authState.user?.id || "").trim();
  const canTransact = isLoggedInUser() && !isOwnedByViewer;
  const listenCents = Number(work?.current_listen_price_cents || work?.listen_price_cents || 0);
  const buyoutCents = Number(work?.current_buyout_price_cents || 0);
  const buyoutEnabled = Boolean(work?.buyout_enabled) && buyoutCents > 0;
  const tipsEnabled = canReceiveTips(work);
  const orderState = resolveViewerOrderState(work?.viewer_orders);
  const commerce = watchCommerceState.payload || null;
  const usageEvents = Array.isArray(commerce?.usage_events) ? commerce.usage_events : [];
  const computeUnits = Math.max(0, Number(work?.compute_units_estimate || 0));
  const computeCost = Math.max(0, Number(work?.compute_cost_cents_estimate || 0));
  const suggestedListen = Math.max(0, Number(work?.suggested_listen_price_cents || listenCents || 0));
  const suggestedBuyout = Math.max(0, Number(work?.suggested_buyout_price_cents || buyoutCents || 0));
  const listenDisabled = Boolean(
    orderState.paidBuyout || orderState.paidListen || orderState.pendingListen || orderState.pendingBuyout || listenCents <= 0
  );
  const buyoutDisabled = Boolean(orderState.paidBuyout || orderState.pendingBuyout || !buyoutEnabled);
  const tipDisabled = Boolean(!tipsEnabled || orderState.pendingTip);
  watchCommerceActions.hidden = false;
  watchCommerceActions.innerHTML = `
    <button class="mini-btn ghost" type="button" data-watch-market-action="preview">${loginCopy("Enjoy", "欣赏")}</button>
    ${canTransact ? `<button class="mini-btn ghost" type="button" data-watch-market-action="listen" ${listenDisabled ? "disabled" : ""}>${marketActionCopy("listen", orderState)}</button>` : ""}
    ${canTransact ? `<button class="mini-btn ghost" type="button" data-watch-market-action="buyout" ${buyoutDisabled ? "disabled" : ""}>${marketActionCopy("buyout", orderState)}</button>` : ""}
    ${canTransact ? `<span class="market-inline-action"><button class="mini-btn ghost" type="button" data-watch-market-action="tip" ${tipDisabled ? "disabled" : ""}>${marketActionCopy("tip", orderState)}</button><input class="inline-chip-input market-tip-input" type="number" min="1" step="1" inputmode="decimal" placeholder="${escapeHtml(loginCopy("Tip $", "打赏金额"))}" data-market-tip-input="${escapeHtml(workId)}" hidden /></span>` : ""}
    <div class="watch-billing-card">
      <div class="work-billing-title">${escapeHtml(loginCopy("Work cost bill", "作品成本账单"))}</div>
      <div class="work-billing-grid">
        <div class="work-billing-stat"><span>${escapeHtml(loginCopy("Compute", "算力"))}</span><strong>${escapeHtml(`${computeUnits}u`)}</strong></div>
        <div class="work-billing-stat"><span>${escapeHtml(loginCopy("Estimated cost", "估算成本"))}</span><strong>${escapeHtml(formatUsdFromCents(computeCost, "$0.00"))}</strong></div>
        <div class="work-billing-stat"><span>${escapeHtml(loginCopy("Suggested listen", "建议聆听价"))}</span><strong>${escapeHtml(formatUsdFromCents(suggestedListen, "$0.00"))}</strong></div>
        <div class="work-billing-stat"><span>${escapeHtml(loginCopy("Suggested buyout", "建议买断价"))}</span><strong>${escapeHtml(formatUsdFromCents(suggestedBuyout, "$0.00"))}</strong></div>
      </div>
      <div class="watch-activity compact">${renderUsageHistoryMarkup(getWorkMatchedUsageEvents(work, usageEvents), loginCopy("No matched billable actions for this work yet.", "这个作品暂时还没有匹配到动作计费记录。"), 4)}</div>
    </div>
  `;
  watchCommerceActions.querySelector('[data-watch-market-action="listen"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    void startStripeCheckoutForWork(workId, "listen", event.currentTarget);
  });
  watchCommerceActions.querySelector('[data-watch-market-action="buyout"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    void startStripeCheckoutForWork(workId, "buyout", event.currentTarget);
  });
  watchCommerceActions.querySelector('[data-watch-market-action="tip"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMarketTipInput(watchCommerceActions, true);
  });
  watchCommerceActions.querySelector('[data-watch-market-action="preview"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    armWatchExplicitPreviewIntent();
    void openWatchPreviewFlowModule({ clearLimit: true, allowDemoFallback: true });
  });
  const input = watchCommerceActions.querySelector('[data-market-tip-input]');
  if (input instanceof HTMLInputElement) {
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
      const trigger = watchCommerceActions.querySelector('[data-watch-market-action="tip"]');
      void handleMarketTipBlur(target, trigger);
    });
  }
}

function ensureWatchCentered() {
  if (!watchPanel) return;
  if (!guardPanelAccess(watchPanel.id)) return;
  const restoredLayout = applyStoredPanelLayout(watchPanel);
  openWatchPanelShellModule(restoredLayout);
  focusPanel(watchPanel);
  if (!watchPanel.dataset.positioned) {
    watchPanel.style.left = "50%";
    watchPanel.style.top = "50%";
    watchPanel.style.transform = "translate(-50%, -50%)";
    watchPanel.dataset.positioned = "true";
  }
  if (logoPanel) logoPanel.classList.add("dimmed");
}

function setWatchCenterStage(active) {
  if (!watchPanel) return;
  if (active) {
    watchPanel.classList.add("center-stage");
    if (logoPanel) logoPanel.classList.add("dimmed");
    return;
  }
  watchPanel.classList.remove("center-stage");
  if (logoPanel) logoPanel.classList.remove("dimmed");
}

function dismissBlockingWatchOverlay() {
  const overlay = document.getElementById("mv-overlay");
  if (!(overlay instanceof HTMLElement)) return false;
  const video = overlay.querySelector("video");
  const hasActiveMedia = !!String(video?.currentSrc || video?.getAttribute("src") || "").trim();
  if (overlay.classList.contains("show") || hasActiveMedia) {
    closeEnjoyOverlay();
    return true;
  }
  overlay.classList.remove("show");
  return false;
}

function dismissUiBlockingLayers() {
  document.querySelectorAll(".provider-login-modal").forEach((modal) => {
    modal.classList.add("hidden");
  });
  document.querySelectorAll(".dock-settings-popover").forEach((popover) => {
    popover.classList.remove("is-visible");
    popover.hidden = true;
  });
  document.querySelectorAll(".mv-overlay").forEach((overlay) => {
    overlay.classList.remove("show");
    const video = overlay.querySelector("video");
    if (video) {
      video.pause?.();
      video.removeAttribute("src");
      video.load?.();
    }
  });
}

function primeWatchPanelLayout() {
  if (!watchPanel) return;
  if (watchPanel.dataset.userMoved === "true" || watchPanel.dataset.maximized === "true") return;
  const insetX = 10;
  const insetY = 10;
  watchPanel.style.left = `${insetX}px`;
  watchPanel.style.top = `${insetY}px`;
  watchPanel.style.transform = "none";
  watchPanel.style.width = `${Math.max(MIN_PANEL_WIDTH, window.innerWidth - insetX * 2)}px`;
  watchPanel.style.height = `${Math.max(MIN_PANEL_HEIGHT, window.innerHeight - insetY * 2)}px`;
}

function prepareWatchPanelForOpen(restoredLayout = false) {
  if (!watchPanel) return;
  dismissUiBlockingLayers();
  if (!restoredLayout) {
    primeWatchPanelLayout();
  }
  if (!watchPanel.dataset.positioned) {
    watchPanel.dataset.positioned = "true";
  }
}

function openWatchPanelShellModule(restoredLayout = false) {
  if (!watchPanel) return;
  watchPanel.classList.remove("hidden");
  watchPanel.dataset.minimized = "false";
  prepareWatchPanelForOpen(restoredLayout);
}

function openWatchPreviewShellModule({ fallbackTab = "mv", restoreAudio = false, center = false } = {}) {
  openPanel(watchPanel);
  activateWatchTab(resolvePreferredWatchOpenTab(fallbackTab));
  if (restoreAudio) {
    restoreRememberedWatchFinalAudio({ preservePlayback: true });
  }
  if (center) {
    ensureWatchCentered();
  }
}

function pauseWatchPanelPlayback() {
  if (!watchVideo) return;
  watchVideo.pause?.();
}

function resumeWatchPanelPlayback() {
  if (!watchVideo || !watchVideo.src) return;
  watchVideo.play?.().catch(() => {});
}

function minimizeWatchPanelShellModule() {
  setWatchCenterStage(false);
  pauseWatchPanelPlayback();
  if (!watchVideo) return;
  watchVideo.removeAttribute("src");
  watchVideo.load?.();
}

function syncWatchPanelCollapseShellModule(isExpanded) {
  if (isExpanded) {
    resumeWatchPanelPlayback();
    return;
  }
  pauseWatchPanelPlayback();
}

function syncVisibleWatchPanelAfterPreviewReady() {
  if (watchPanel && !watchPanel.classList.contains("hidden")) {
    ensureWatchCentered();
  }
}

function handleWatchUserPlaybackGesture() {
  armWatchExplicitPreviewIntent();
  if (
    watchAudioPreview &&
    (!String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim() ||
      String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim().startsWith("data:audio/")) &&
    getRememberedWatchFinalAudio()
  ) {
    restoreRememberedWatchFinalAudio({ preservePlayback: true });
  }
  const hasAudio = !!(watchAudioPreview?.src && String(watchAudioPreview.src).trim());
  if (hasAudio) {
    playWatchAudioPreviewFromStartModule();
  }
  if (!watchVideo?.src) return hasAudio;
  revealWatchVideoLayerModule();
  if (globalThis.currentPreviewVideoSourceKind === "frame-motion") {
    watchVideo.muted = true;
    playWatchAudioPreviewFromStartModule();
  } else {
    watchVideo.muted = false;
  }
  const playPromise = watchVideo.play?.();
  if (!playPromise || typeof playPromise.then !== "function") return true;
  playPromise
    .then(() => {
      globalThis.watchManualPlayHinted = false;
      if (watchSubtitle?.textContent?.includes("Tap to play")) {
        watchSubtitle.textContent = "KaraOKe MV · Preview";
      }
    })
    .catch(() => {
      promptManualWatchPlaybackModule("Autoplay blocked · Tap to play");
    });
  return true;
}

async function handleWatchPlaybackSurfaceClick() {
  armWatchExplicitPreviewIntent();
  if (!watchVideo?.src && !(watchAudioPreview?.src && String(watchAudioPreview.src).trim())) return;
  if (currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId) {
    await attemptImmediateFinalAudioAttach();
  }
  handleWatchUserPlaybackGesture();
  if (globalThis.watchManualPlayHinted) {
    showToast("Playback resumed");
  }
}

async function openLatestRegistryPreviewInWatch() {
  if (shouldKeepWatchInMusicModeModule()) {
    openWatchPreviewShellModule({ fallbackTab: "music", restoreAudio: true });
    return true;
  }
  try {
    const res = await fetch(
      "/api/registry/v1/jobs/latest?capability_id=video.gan.v1&status=succeeded"
    );
    if (!res.ok) return false;
    const payload = await res.json();
    const job = payload?.job || payload;
    if (!job) return false;
    const artifacts = job.artifacts || [];
    const videoArtifact = artifacts.find((item) => item.name === "video_preview.mp4");
    const svgArtifact = artifacts.find((item) => item.name === "video_preview.svg");
    if (videoArtifact && setWatchVideoFromArtifact(videoArtifact.uri, { sourceKind: "registry" })) {
      watchSubtitle.textContent = "KaraOKe MV · Preview";
      attemptWatchVideoPlaybackModule({ allowFallback: true });
      return true;
    }
    if (svgArtifact) {
      setWatchSvgPreviewModule(svgArtifact.uri);
      watchSubtitle.textContent = "KaraOKe MV · Preview";
      return true;
    }
    return false;
  } catch (_err) {
    return false;
  }
}

async function ensureWatchPanelPreviewPlayback() {
  ensureWatchCentered();
  if (shouldKeepWatchInMusicModeModule()) {
    openWatchPreviewShellModule({ fallbackTab: "music", restoreAudio: true });
    playWatchAudioPreviewFromStartModule();
    return true;
  }
  if (hasCurrentWatchPreviewMedia()) {
    handleWatchUserPlaybackGesture();
    return true;
  }
  if (videoJobId) {
    handleWatchUserPlaybackGesture();
    return true;
  }
  return false;
}

async function playWatchPanelDemoFallback() {
  if (!canUseWatchDemoFallback()) return false;
  if (shouldKeepWatchInMusicModeModule()) {
    openWatchPreviewShellModule({ fallbackTab: "music", restoreAudio: true });
    return true;
  }
  const url = await pickFirstWorkingUrl(await getDemoMvFiles());
  if (url && setWatchVideoFromArtifact(url, { sourceKind: "demo" })) {
    watchSubtitle.textContent = "KaraOKe MV · Demo";
    attemptWatchVideoPlaybackModule({ allowFallback: true });
    return true;
  }
  return false;
}

async function playWatchPanelFailureFallback({ preferDemoMedia = true, allowSilence = true } = {}) {
  let usedDemo = false;
  if (preferDemoMedia && canUseWatchDemoFallback()) {
    usedDemo = (await tryAttachDemoAudioFallbackModule({ autoplay: true, allowDemoFallback: true }).catch(() => false)) || false;
    if (!usedDemo) {
      usedDemo = (await playWatchPanelDemoFallback().catch(() => false)) || false;
    }
  }
  if (!usedDemo && allowSilence) {
    useLocalWatchVideoFallbackModule(
      state.title || loginCopy("Creation pending", "创作进行中"),
      loginCopy("Graceful fallback preview", "优雅静默占位")
    );
    if (watchAudioPreview) {
      watchAudioPreview.pause?.();
      watchAudioPreview.removeAttribute("src");
      watchAudioPreview.load?.();
      watchAudioPreview.style.display = "none";
      currentWatchAudioSourceKind = "none";
      currentWatchAudioRunError = loginCopy("Silent fallback active.", "当前为静默回退。");
      updateWatchAudioDebug();
      syncWatchAudioPresentation();
    }
  }
  return usedDemo;
}

function handleWatchVideoLoadedData() {
  if (!watchVideo) return;
  if (globalThis.currentPreviewVideoSourceKind === "frame-motion") {
    globalThis.currentPreviewVideoHasUsableFrame = true;
    clearWatchFrameLoopModule();
    return;
  }
  const capturedFrame = captureWatchVideoFirstFrameModule(watchVideo);
  globalThis.currentPreviewVideoHasUsableFrame = !!capturedFrame;
  if (capturedFrame) {
    cacheWatchFrameModule(capturedFrame);
  }
  void extractWatchPreviewFramesFromSourceModule(watchVideo.currentSrc || watchVideo.src, 4).then((frames) => {
    if (!frames.length) return;
    cacheWatchFrameSequenceModule(frames);
    void buildWatchMotionClipFromFramesModule(frames, {
      durationSec: 6.2,
      fps: 8,
      beatSections: state.songSeed?.sectionBeats || []
    }).then((clipUrl) => {
      if (!clipUrl || shouldUseEffectiveWatchPreviewVideo()) return;
      if (globalThis.currentPreviewMotionClipUrl) {
        URL.revokeObjectURL(globalThis.currentPreviewMotionClipUrl);
      }
      globalThis.currentPreviewMotionClipUrl = clipUrl;
      if (watchVideo && !shouldUseEffectiveWatchPreviewVideo()) {
        clearWatchFrameLoopModule();
        watchVideo.pause?.();
        globalThis.currentPreviewVideoSourceKind = "frame-motion";
        watchVideo.src = clipUrl;
        watchVideo.muted = true;
        watchVideo.loop = true;
        watchVideo.playsInline = true;
        watchVideo.load?.();
        attemptWatchVideoPlaybackModule({ maxRetries: 1, allowFallback: false });
      }
    });
    if (!shouldUseEffectiveWatchPreviewVideo()) {
      syncWatchPlaceholderFromCurrentState();
    }
  });
  if (shouldUseEffectiveWatchPreviewVideo()) {
    clearWatchFrameLoopModule();
    watchVideo.style.display = "";
    if (watchSvg) watchSvg.style.display = "none";
  } else {
    syncWatchPlaceholderFromCurrentState();
  }
  schedulePersistCurrentWorkAssets();
}

function handleWatchVideoCanPlay() {
  if (!watchVideo) return;
  attemptWatchVideoPlaybackModule({ maxRetries: 2 });
  globalThis.currentPreviewVideoDurationSec = Number.isFinite(watchVideo.duration) ? watchVideo.duration : 0;
  if (
    getForyouPreviewMode() !== FORYOU_PREVIEW_MODES.IMAGE &&
    shouldUseEffectiveWatchPreviewVideo()
  ) {
    clearWatchFrameLoopModule();
    watchVideo.style.display = "";
    if (watchSvg) watchSvg.style.display = "none";
    setForyouThumbVideo(watchVideo.currentSrc || watchVideo.src);
  } else {
    syncWatchPlaceholderFromCurrentState();
  }
  syncVisibleWatchPanelAfterPreviewReady();
  schedulePersistCurrentWorkAssets();
}

function handleWatchVideoLoadedMetadata() {
  if (!watchVideo) return;
  globalThis.currentPreviewVideoDurationSec = Number.isFinite(watchVideo.duration) ? watchVideo.duration : 0;
  if (
    globalThis.currentPreviewVideoSourceKind !== "demo" &&
    globalThis.currentPreviewVideoDurationSec > 0 &&
    globalThis.currentPreviewVideoDurationSec <= MIN_EFFECTIVE_PREVIEW_DURATION_SEC
  ) {
    useLocalWatchVideoFallbackModule(state.title, `${state.style} ${state.voice} cinematic mv`);
    showToast("Preview too short · keeping thumbnail");
    return;
  }
  syncWatchPlaceholderFromCurrentState();
  schedulePersistCurrentWorkAssets();
}

function handleWatchVideoError() {
  useLocalWatchVideoFallbackModule(state.title, `${state.style} ${state.voice} cinematic mv`);
  attemptWatchVideoPlaybackModule({ maxRetries: 2 });
}

function syncWatchPlaybackIndicator(indicator, clickTarget) {
  if (!indicator || !watchVideo) return;
  if (watchVideo.paused) {
    indicator.textContent = "▶";
    indicator.style.opacity = "0.85";
    clickTarget?.classList.add("is-paused");
    return;
  }
  indicator.textContent = "❚❚";
  indicator.style.opacity = "0.35";
  clickTarget?.classList.remove("is-paused");
}

function handleWatchVideoPlayStateChange(indicator, clickTarget) {
  syncWatchPlaybackIndicator(indicator, clickTarget);
}

function handleWatchVideoTimeUpdate() {
  enforceWatchPreviewLimit();
}

function handleWatchAudioPreviewStateSync() {
  syncWatchMusicStateModule();
}

function handleWatchAudioPreviewTimeUpdate() {
  enforceWatchPreviewLimit();
  enforceWatchReplyWindowLoop();
  maybeRefreshReplyHarmonyHighlight();
}

function handleWatchAudioPreviewTimelineUpdate() {
  maybeRefreshReplyHarmonyHighlight();
}

function handleWatchMusicPlayClick(event) {
  void attemptImmediateFinalAudioAttach();
  event.preventDefault();
  event.stopPropagation();
  if (
    (!String(watchAudioPreview?.currentSrc || watchAudioPreview?.src || "").trim() ||
      String(watchAudioPreview?.currentSrc || watchAudioPreview?.src || "").trim().startsWith("data:audio/")) &&
    getRememberedWatchFinalAudio()
  ) {
    restoreRememberedWatchFinalAudio({ preservePlayback: true });
  }
  if (!watchAudioPreview?.src) return;
  if (watchAudioPreview.paused || watchAudioPreview.ended) {
    void ensureWatchMusicVisualizerModule();
    const playPromise = watchAudioPreview.play?.();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch(() => {});
    }
  } else {
    watchAudioPreview.pause?.();
  }
  syncWatchMusicStateModule();
}

function initWatchVideoPlaybackControlsModule() {
  if (!watchVideo) return;
  const clickTarget = document.querySelector(".watch-screen");
  const indicator = watchOverlayPlay?.querySelector(".watch-overlay-play-icon") || null;
  const syncIndicator = () => handleWatchVideoPlayStateChange(indicator, clickTarget);
  watchVideo.addEventListener("play", syncIndicator);
  watchVideo.addEventListener("pause", syncIndicator);
  watchVideo.addEventListener("timeupdate", handleWatchVideoTimeUpdate);
  syncWatchPlaybackIndicator(indicator, clickTarget);

  watchVideo.addEventListener("loadeddata", handleWatchVideoLoadedData);
  watchVideo.addEventListener("canplay", handleWatchVideoCanPlay);
  watchVideo.addEventListener("loadedmetadata", handleWatchVideoLoadedMetadata);
  watchVideo.addEventListener("error", handleWatchVideoError);
  if (clickTarget) {
    clickTarget.addEventListener("click", handleWatchPlaybackSurfaceClick);
  }
}

function initWatchMusicControlsModule() {
  if (!watchAudioPreview) return;
  ["play", "pause", "ended", "loadedmetadata", "timeupdate", "canplay"].forEach((eventName) => {
    watchAudioPreview.addEventListener(eventName, handleWatchAudioPreviewStateSync);
  });
  watchAudioPreview.addEventListener("timeupdate", handleWatchAudioPreviewTimeUpdate);
  ["play", "pause", "ended", "loadedmetadata", "canplay", "seeked"].forEach((eventName) => {
    watchAudioPreview.addEventListener(eventName, handleWatchAudioPreviewTimelineUpdate);
  });
  watchMusicPlay?.addEventListener("click", handleWatchMusicPlayClick);
  watchAudioPreview.addEventListener("emptied", stopWatchMusicVisualizerModule);
  syncWatchMusicArtworkModule();
  syncWatchMusicStateModule();
}

function resetWatchVideoPreviewModule() {
  if (!watchVideo) return;
  resetForyouThumb();
  clearWatchFrameLoopModule();
  globalThis.currentPreviewVideoDurationSec = 0;
  currentPreviewVideoIsLocalFallback = false;
  globalThis.currentPreviewVideoSourceKind = "none";
  globalThis.currentPreviewVideoHasUsableFrame = false;
  globalThis.currentPreviewFrameDataUrl = "";
  globalThis.currentPreviewFrameSequence = [];
  if (globalThis.currentPreviewMotionClipUrl) {
    URL.revokeObjectURL(globalThis.currentPreviewMotionClipUrl);
    globalThis.currentPreviewMotionClipUrl = "";
  }
  watchVideo.pause?.();
  watchVideo.removeAttribute("src");
  watchVideo.load?.();
  if (watchVideoUrl) {
    URL.revokeObjectURL(watchVideoUrl);
    watchVideoUrl = null;
  }
  if (watchSvg) {
    watchSvg.removeAttribute("src");
    watchSvg.style.display = "none";
  }
  watchVideo.style.display = "";
}

function shouldUseEffectiveWatchPreviewVideo() {
  return (
    !currentPreviewVideoIsLocalFallback &&
    globalThis.currentPreviewVideoHasUsableFrame &&
    hasEffectivePreviewVideo()
  );
}

function setWatchVideoFromArtifact(uri, options = {}) {
  if (!watchVideo || !uri) return false;
  const isLocalFallback = uri === LOCAL_FALLBACK_MP4;
  const sourceKind = options.sourceKind || (isLocalFallback ? "local-fallback" : "artifact");
  currentPreviewVideoIsLocalFallback = isLocalFallback;
  globalThis.currentPreviewVideoDurationSec = 0;
  globalThis.currentPreviewVideoSourceKind = sourceKind;
  globalThis.currentPreviewVideoHasUsableFrame = false;
  syncWatchPlaceholderFromCurrentState();
  if (!uri.startsWith("data:")) {
    watchVideo.src = uri;
    watchVideo.muted = false;
    watchVideo.playsInline = true;
    watchVideo.load?.();
    return true;
  }
  const [meta, data] = uri.split(",");
  if (!meta || !data) return false;
  const mimeMatch = meta.match(/^data:([^;]+);base64$/i);
  const mime = mimeMatch ? mimeMatch[1] : "video/mp4";
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (watchVideoUrl) {
      URL.revokeObjectURL(watchVideoUrl);
      watchVideoUrl = null;
    }
    watchVideoUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    watchVideo.src = watchVideoUrl;
    watchVideo.muted = false;
    watchVideo.playsInline = true;
    watchVideo.load?.();
    return true;
  } catch (_err) {
    return false;
  }
}

function hasCurrentWatchPreviewMedia() {
  return !!(
    (watchVideo?.src && String(watchVideo.src).trim()) ||
    (watchSvg?.src && String(watchSvg.src).trim()) ||
    (globalThis.currentPreviewMotionClipUrl && String(globalThis.currentPreviewMotionClipUrl).trim())
  );
}

function showWatchFramePlaceholderModule(uri) {
  if (!watchSvg || !uri) return false;
  watchSvg.src = uri;
  watchSvg.style.display = "block";
  watchSvg.classList.add("glow");
  if (watchVideo) watchVideo.style.display = "none";
  return true;
}

function setWatchSvgPreviewModule(uri) {
  if (!watchSvg || !uri) return false;
  showWatchFramePlaceholderModule(uri);
  if (getForyouPreviewMode() !== FORYOU_PREVIEW_MODES.VIDEO) {
    setForyouThumbImage(uri);
  }
  return true;
}

function useLocalWatchVideoFallbackModule(title, subtitle) {
  setWatchSvgPreviewModule(buildLocalVideoPreviewSvg(title, subtitle));
  currentPreviewVideoIsLocalFallback = true;
  globalThis.currentPreviewVideoDurationSec = 0;
  globalThis.currentPreviewVideoSourceKind = "local-fallback";
  watchSubtitle.textContent = "KaraOKe MV · Internal Debug Artifact";
}

function promptManualWatchPlaybackModule(message) {
  globalThis.watchManualPlayHinted = true;
  if (watchSubtitle) watchSubtitle.textContent = message;
  showToast(message);
}

function clearWatchPlaybackRetryModule() {
  if (globalThis.watchPlaybackTimer) {
    clearTimeout(globalThis.watchPlaybackTimer);
    globalThis.watchPlaybackTimer = null;
  }
  globalThis.watchPlaybackRetry = 0;
}

function revealWatchVideoLayerModule() {
  if (!watchVideo?.src) return false;
  if (watchSvg) watchSvg.style.display = "none";
  clearWatchFrameLoopModule();
  watchVideo.style.display = "";
  return true;
}

function attemptWatchVideoPlaybackModule(options = {}) {
  if (!watchVideo || !watchVideo.src) return;
  const maxRetries = options.maxRetries ?? 5;
  const interval = options.interval ?? 900;
  const allowFallback = options.allowFallback ?? false;
  clearWatchPlaybackRetryModule();

  const tryPlay = () => {
    if (!watchVideo || !watchVideo.src) return;
    const playPromise = watchVideo.play?.();
    if (!playPromise || typeof playPromise.then !== "function") return;
    playPromise
      .then(() => {
        clearWatchPlaybackRetryModule();
        globalThis.watchManualPlayHinted = false;
      })
      .catch(() => {
        globalThis.watchPlaybackRetry += 1;
        if (globalThis.watchPlaybackRetry <= maxRetries) {
          showToast(`Auto retry ${globalThis.watchPlaybackRetry}/${maxRetries}`);
          globalThis.watchPlaybackTimer = setTimeout(tryPlay, interval);
          return;
        }
        if (allowFallback) {
          useLocalWatchVideoFallbackModule(state.title, `${state.style} ${state.voice} cinematic mv`);
        }
        promptManualWatchPlaybackModule("Autoplay blocked · Tap to play");
      });
  };

  tryPlay();
}

function clearWatchPreviewLimit() {
  watchPreviewLimitSec = 0;
  watchPreviewLimitReason = "";
  watchPreviewLimitNoticeShown = false;
}

function setWatchPreviewLimit(seconds, reason = "") {
  watchPreviewLimitSec = Math.max(0, Number(seconds || 0));
  watchPreviewLimitReason = String(reason || "").trim();
  watchPreviewLimitNoticeShown = false;
}

function getWatchFrameCacheKeyModule() {
  return [
    String(state.title || "").trim().toLowerCase(),
    String(state.style || "").trim().toLowerCase(),
    String(state.voice || "").trim().toLowerCase(),
    String(globalThis.currentPreviewVideoSourceKind || "unknown").trim().toLowerCase()
  ].join("::");
}

function getCachedWatchFrameModule() {
  const key = getWatchFrameCacheKeyModule();
  if (!key) return "";
  const memory = globalThis.watchFrameCache.get(key);
  if (memory) return memory;
  try {
    const stored = localStorage.getItem(`cssos.watch.frame.${key}`);
    if (stored) {
      globalThis.watchFrameCache.set(key, stored);
      return stored;
    }
  } catch (_err) {
    // ignore storage
  }
  return "";
}

function cacheWatchFrameModule(dataUrl) {
  const key = getWatchFrameCacheKeyModule();
  if (!key || !dataUrl) return;
  globalThis.currentPreviewFrameDataUrl = dataUrl;
  globalThis.watchFrameCache.set(key, dataUrl);
  syncMediaDerivedWorkCoverImage();
  try {
    localStorage.setItem(`cssos.watch.frame.${key}`, dataUrl);
  } catch (_err) {
    // ignore storage quota
  }
}

function getCachedWatchFrameSequenceModule() {
  const key = getWatchFrameCacheKeyModule();
  if (!key) return [];
  return globalThis.watchFrameSequenceCache.get(key) || [];
}

function cacheWatchFrameSequenceModule(frames) {
  const key = getWatchFrameCacheKeyModule();
  if (!key || !Array.isArray(frames) || !frames.length) return;
  globalThis.currentPreviewFrameSequence = frames.slice();
  globalThis.watchFrameSequenceCache.set(key, globalThis.currentPreviewFrameSequence);
}

function clearWatchFrameLoopModule() {
  if (globalThis.watchFrameLoopTimer) {
    clearInterval(globalThis.watchFrameLoopTimer);
    globalThis.watchFrameLoopTimer = null;
  }
}

function startWatchFrameLoopModule(frames) {
  if (!watchSvg || !Array.isArray(frames) || !frames.length) return false;
  clearWatchFrameLoopModule();
  let index = 0;
  watchSvg.src = frames[0];
  globalThis.watchFrameLoopTimer = setInterval(() => {
    if (!watchSvg || !watchSvg.style || watchSvg.style.display === "none") return;
    index = (index + 1) % frames.length;
    watchSvg.src = frames[index];
  }, 420);
  return true;
}

function captureWatchVideoFirstFrameModule(video) {
  if (!video?.videoWidth || !video?.videoHeight) return "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(640, video.videoWidth);
    canvas.height = Math.max(1, Math.round(canvas.width * (video.videoHeight / video.videoWidth)));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const sample = ctx.getImageData(0, 0, Math.min(canvas.width, 64), Math.min(canvas.height, 36)).data;
    let lumaSum = 0;
    let brightPixels = 0;
    const pixelCount = Math.max(1, sample.length / 4);
    for (let i = 0; i < sample.length; i += 4) {
      const r = sample[i] || 0;
      const g = sample[i + 1] || 0;
      const b = sample[i + 2] || 0;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumaSum += luma;
      if (luma > 36) brightPixels += 1;
    }
    const meanLuma = lumaSum / pixelCount;
    const brightRatio = brightPixels / pixelCount;
    if (meanLuma < MIN_EFFECTIVE_PREVIEW_FRAME_LUMA || brightRatio < 0.01) {
      return "";
    }
    return canvas.toDataURL("image/webp", 0.82);
  } catch (_err) {
    return "";
  }
}

async function extractWatchPreviewFramesFromSourceModule(src, frameCount = 4) {
  if (!src) return [];
  return new Promise((resolve) => {
    const tempVideo = document.createElement("video");
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    tempVideo.preload = "auto";
    tempVideo.crossOrigin = "anonymous";
    tempVideo.src = src;
    const cleanup = () => {
      tempVideo.pause?.();
      tempVideo.removeAttribute("src");
      tempVideo.load?.();
    };
    tempVideo.addEventListener(
      "loadedmetadata",
      async () => {
        const duration = Number.isFinite(tempVideo.duration) ? tempVideo.duration : 0;
        if (!(duration > MIN_EFFECTIVE_PREVIEW_DURATION_SEC)) {
          cleanup();
          resolve([]);
          return;
        }
        const targets = Array.from({ length: frameCount }, (_, index) => {
          const ratio = (index + 1) / (frameCount + 1);
          return Math.max(0.15, Math.min(duration - 0.15, duration * ratio));
        });
        const frames = [];
        for (const target of targets) {
          try {
            await new Promise((done) => {
              const onSeeked = () => {
                tempVideo.removeEventListener("seeked", onSeeked);
                done();
              };
              tempVideo.addEventListener("seeked", onSeeked, { once: true });
              tempVideo.currentTime = target;
            });
            const frame = captureWatchVideoFirstFrameModule(tempVideo);
            if (frame) frames.push(frame);
          } catch (_err) {
            // ignore single-frame failure
          }
        }
        cleanup();
        resolve(frames);
      },
      { once: true }
    );
    tempVideo.addEventListener(
      "error",
      () => {
        cleanup();
        resolve([]);
      },
      { once: true }
    );
  });
}

async function buildWatchMotionClipFromFramesModule(frames, options = {}) {
  if (!Array.isArray(frames) || frames.length < 2) return "";
  if (typeof MediaRecorder === "undefined") return "";
  const width = options.width || 640;
  const height = options.height || 360;
  const durationSec = Math.max(3.2, Number(options.durationSec || 4.2));
  const fps = Math.max(4, Number(options.fps || 6));
  const frameIntervalMs = Math.max(120, Math.round(1000 / fps));
  const totalFrames = Math.max(frames.length, Math.round(durationSec * fps));
  const beatSections = Array.isArray(options.beatSections) ? options.beatSections : [];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const images = await Promise.all(
    frames.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        })
    )
  );
  const usable = images.filter(Boolean);
  if (usable.length < 2) return "";

  const shotDurations = (() => {
    if (!beatSections.length) {
      return usable.map(() => durationSec / usable.length);
    }
    const sections = beatSections
      .slice(0, usable.length)
      .map((item) => Math.max(0.6, Math.min(2.2, (Number(item?.bars || 4) || 4) * 0.16)));
    const rawTotal = sections.reduce((sum, value) => sum + value, 0) || durationSec;
    return sections.map((value) => (value / rawTotal) * durationSec);
  })();

  return new Promise((resolve) => {
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    const chunks = [];
    let frameIndex = 0;
    let stopped = false;
    const shotPlan = usable.map((img, index) => ({
      img,
      durationSec: shotDurations[index % shotDurations.length] || durationSec / usable.length,
      zoomFrom: 1 + (index % 2 === 0 ? 0.02 : 0.06),
      zoomTo: 1 + (index % 2 === 0 ? 0.08 : 0.03),
      panX: (index % 3 === 0 ? -1 : index % 3 === 1 ? 1 : 0) * 18,
      panY: (index % 2 === 0 ? 1 : -1) * 10
    }));
    const totalPlanSec = shotPlan.reduce((sum, shot) => sum + shot.durationSec, 0) || durationSec;
    const draw = () => {
      const timeSec = Math.min(durationSec, frameIndex / fps);
      let cursor = 0;
      let activeShot = shotPlan[shotPlan.length - 1];
      for (const shot of shotPlan) {
        cursor += shot.durationSec;
        if (timeSec <= cursor) {
          activeShot = shot;
          break;
        }
      }
      const shotStart = Math.max(0, cursor - activeShot.durationSec);
      const shotProgress = activeShot.durationSec > 0 ? Math.min(1, Math.max(0, (timeSec - shotStart) / activeShot.durationSec)) : 0;
      const zoom = activeShot.zoomFrom + (activeShot.zoomTo - activeShot.zoomFrom) * shotProgress;
      const drawWidth = width * zoom;
      const drawHeight = height * zoom;
      const offsetX = (width - drawWidth) / 2 + activeShot.panX * shotProgress;
      const offsetY = (height - drawHeight) / 2 + activeShot.panY * shotProgress;
      ctx.clearRect(0, 0, width, height);
      ctx.filter = `brightness(${1.02 + 0.04 * Math.sin((timeSec / totalPlanSec) * Math.PI * 2)}) saturate(1.08)`;
      ctx.drawImage(activeShot.img, offsetX, offsetY, drawWidth, drawHeight);
      ctx.filter = "none";
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, width, height);
      frameIndex += 1;
      if (frameIndex >= totalFrames && !stopped) {
        stopped = true;
        clearInterval(timer);
        recorder.stop();
      }
    };
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      clearInterval(timer);
      resolve("");
    };
    recorder.onstop = () => {
      try {
        const blob = new Blob(chunks, { type: "video/webm" });
        resolve(URL.createObjectURL(blob));
      } catch (_err) {
        resolve("");
      }
    };
    draw();
    recorder.start();
    const timer = setInterval(draw, frameIntervalMs);
  });
}

function getCurrentWatchArtworkModule() {
  return (
    resolveWorkCoverImage(currentWatchPreviewWork || {}) ||
    (foryouThumbImage?.src && String(foryouThumbImage.src).trim()) ||
    getCachedWatchFrameModule() ||
    globalThis.currentPreviewFrameDataUrl ||
    (watchSvg?.src && String(watchSvg.src).trim()) ||
    ""
  );
}

async function requestWatchVideoPreviewModule(title, lines) {
  if (shouldKeepWatchInMusicModeModule()) {
    openWatchPreviewShellModule({ fallbackTab: "music", restoreAudio: true });
    return;
  }
  if (!watchVideo) return;
  if (videoJobPoll) {
    clearInterval(videoJobPoll);
    videoJobPoll = null;
  }
  videoJobId = null;
  resetWatchVideoPreviewModule();
  const prompt = `${state.style} ${state.voice} cinematic mv`;
  const payload = {
    capability_id: "video.gan.v1",
    inputs: [],
    params: {
      v: 1,
      title,
      prompt,
      duration_sec: 6,
      lyrics: { lines }
    }
  };
  lastRequestedVideoDurationSec = Number(payload?.params?.duration_sec || 0);
  try {
    const res = await fetch("/api/registry/v1/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      useLocalWatchVideoFallbackModule(title, prompt);
      showToast(`Video offline · Local preview (${res.status})`);
      return;
    }
    const body = await res.json();
    const jobId = body?.job?.id || body?.id;
    if (!jobId) {
      useLocalWatchVideoFallbackModule(title, prompt);
      return;
    }
    videoJobId = jobId;
    pollWatchVideoJobModule(videoJobId);
  } catch (_err) {
    useLocalWatchVideoFallbackModule(title, prompt);
    showToast("Video offline · Local preview");
  }
}

function pollWatchVideoJobModule(jobId) {
  if (!jobId) return;
  let busy = false;
  videoJobPoll = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch(`/api/registry/v1/jobs/${jobId}`);
      if (!res.ok) {
        busy = false;
        return;
      }
      const payload = await res.json();
      const job = payload?.job || payload;
      if (job.status === "succeeded") {
        const artifacts = job.artifacts || [];
        const videoArtifact = artifacts.find((item) => item.name === "video_preview.mp4");
        const svgArtifact = artifacts.find((item) => item.name === "video_preview.svg");
        if (videoArtifact && watchVideo) {
          if (setWatchVideoFromArtifact(videoArtifact.uri, { sourceKind: "job-artifact" })) {
            attemptWatchVideoPlaybackModule({ allowFallback: true });
          } else {
            useLocalWatchVideoFallbackModule(state.title, `${state.style} ${state.voice} cinematic mv`);
          }
          watchSubtitle.textContent = "KaraOKe MV · Preview";
        } else if (svgArtifact) {
          setWatchSvgPreviewModule(svgArtifact.uri);
          watchSubtitle.textContent = "KaraOKe MV · Preview";
        } else {
          watchSubtitle.textContent = "KaraOKe MV · Ready";
        }
        clearInterval(videoJobPoll);
        videoJobPoll = null;
      } else if (job.status === "failed") {
        watchSubtitle.textContent = "KaraOKe MV · Failed";
        clearInterval(videoJobPoll);
        videoJobPoll = null;
      }
    } catch (_err) {
      // keep polling
    } finally {
      busy = false;
    }
  }, 1200);
}

async function openWatchPreviewFlowModule({
  preferredTab = "",
  clearLimit = true,
  tryRegistry = false,
  showEmptyToast = false,
  allowDemoFallback = false
} = {}) {
  if (clearLimit) {
    clearWatchPreviewLimit();
  }
  if (preferredTab) {
    activateWatchTab(resolvePreferredWatchOpenTab(preferredTab));
  }
  const usedCurrent = await ensureWatchPanelPreviewPlayback();
  if (usedCurrent) return true;
  if (tryRegistry) {
    const registryOk = await openLatestRegistryPreviewInWatch();
    if (registryOk) return true;
  }
  const demoOk = allowDemoFallback ? await playWatchPanelDemoFallback() : false;
  if (!demoOk && showEmptyToast) {
    showToast("No video ready yet");
  }
  return demoOk;
}

function refreshWatchPresentationFromSettingsModule(seed = state.songSeed) {
  if (watchTabButtons.length) {
    activateWatchTab(watchActiveTab);
  }
  renderSongSeedPreviewModule(seed);
}

function syncWatchPlaceholderAfterForyouThumbModule() {
  if (!shouldUseEffectiveWatchPreviewVideo()) {
    syncWatchPlaceholderFromCurrentState();
  }
}

function syncWatchMusicArtworkModule() {
  if (!watchMusicStage) return;
  const artwork = getCurrentWatchArtworkModule();
  const safe = artwork ? `url("${String(artwork).replace(/"/g, '\\"')}")` : "none";
  watchMusicStage.style.setProperty("--watch-music-art-image", safe);
}

function playWatchAudioPreviewFromStartModule() {
  if (
    watchAudioPreview &&
    String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim().startsWith("data:audio/") &&
    getRememberedWatchFinalAudio()
  ) {
    restoreRememberedWatchFinalAudio({ preservePlayback: true });
  }
  if (
    watchAudioPreview &&
    (!String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim() ||
      String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim().startsWith("data:audio/")) &&
    !getRememberedWatchFinalAudio() &&
    canUseWatchDemoFallback()
  ) {
    void tryAttachDemoAudioFallbackModule({ autoplay: true, allowDemoFallback: true });
  }
  if (!watchAudioPreview || watchAudioPreview.style.display === "none" || !watchAudioPreview.src) {
    updateWatchAudioDebug();
    return false;
  }
  watchAudioPreview.autoplay = true;
  watchAudioPreview.playsInline = true;
  try {
    watchAudioPreview.currentTime = 0;
  } catch (_err) {
    // ignore seek errors
  }
  const playPromise = watchAudioPreview.play?.();
  if (!playPromise || typeof playPromise.then !== "function") return true;
  playPromise
    .then(() => {
      watchAudioAutoplayArmed = true;
      if (currentWatchAudioSourceKind === "final-artifact" && watchAudioPreview.muted) {
        window.setTimeout(() => {
          watchAudioPreview.muted = false;
          watchAudioPreview.volume = 1;
          updateWatchAudioDebug();
        }, 180);
      }
    })
    .catch(() => {});
  syncWatchMusicStateModule();
  enforceWatchPreviewLimit();
  updateWatchAudioDebug();
  return true;
}

function openWatchMusicPlaybackSurfaceModule({ clearLimit = false, autoplay = false } = {}) {
  if (clearLimit) {
    clearWatchPreviewLimit();
  }
  openWatchPreviewShellModule({ fallbackTab: "music" });
  if (!autoplay) return true;
  if (playWatchAudioPreviewFromStartModule()) return true;
  const retryPlay = () => {
    watchAudioPreview?.removeEventListener("canplay", retryPlay);
    playWatchAudioPreviewFromStartModule();
  };
  watchAudioPreview?.addEventListener("canplay", retryPlay, { once: true });
  return false;
}

function openCreationShowcasePanelsModule(options = {}) {
  [foryouPanel, lyricsPanel, musicPanel, videoPanel, watchPanel]
    .filter(Boolean)
    .forEach((panel) => openPanel(panel, { focus: false, layout: false }));
  if (options.focusTop !== false && watchPanel) {
    focusPanel(watchPanel);
  }
  layoutShowcasePanels();
}

function openCreationAdvancedSettingsPanelModule() {
  if (!settingsPanel) return;
  openPanel(settingsPanel, { focus: false, layout: false });
  if (advancedPanelSettings?.hidden) {
    advancedPanelSettings.hidden = false;
    advancedPanelSettingsToggle?.classList.add("is-active");
    void renderAdvancedPanelSettings({ force: true, deferHeavy: true });
  }
  focusPanel(settingsPanel);
  layoutShowcasePanels();
}

function resolveCreationSurfaceModeModule(origin = "logo") {
  const behavior = readPanelBehaviorSettingsLocal();
  const micBehavior = behavior?.mic || {};
  if (origin === "dock") return micBehavior.dock_surface_mode || "showcase";
  if (origin === "settings") return micBehavior.settings_surface_mode || micBehavior.logo_surface_mode || "showcase";
  return micBehavior.logo_surface_mode || "showcase";
}

function showCreationSurfaceModule(origin = "logo") {
  const mode = resolveCreationSurfaceModeModule(origin);
  if (mode === "mv_only") {
    ensureWatchCentered();
    return;
  }
  openCreationShowcasePanelsModule();
}

Object.assign(globalThis, {
  openCreationShowcasePanelsModule,
  openCreationAdvancedSettingsPanelModule,
  resolveCreationSurfaceModeModule,
  showCreationSurfaceModule
});

function primeZeroThresholdAudioPreviewModule(seedLike = {}) {
  if (!watchAudioPreview) return false;
  if (restoreRememberedWatchFinalAudio({ preservePlayback: true })) {
    return openWatchMusicPlaybackSurfaceModule({ autoplay: true });
  }
  watchAudioAutoplayArmed = true;
  if (canUseWatchDemoFallback()) {
    void tryAttachDemoAudioFallbackModule({ autoplay: true, allowDemoFallback: true });
  }
  return false;
}

async function tryAttachDemoAudioFallbackModule({ autoplay = false, allowDemoFallback = false } = {}) {
  if (!allowDemoFallback && !canUseWatchDemoFallback()) return false;
  if (!watchAudioPreview || getRememberedWatchFinalAudio()) return false;
  const url = await pickFirstWorkingUrl(await getDemoAudioFiles());
  if (!url) return false;
  const preservePlayback = autoplay || !!(!watchAudioPreview.paused && !watchAudioPreview.ended);
  watchAudioPreview.autoplay = true;
  watchAudioPreview.playsInline = true;
  watchAudioPreview.loop = false;
  watchAudioPreview.muted = false;
  watchAudioPreview.volume = 1;
  watchAudioPreview.src = url;
  watchAudioPreview.style.display = "block";
  watchAudioPreview.load?.();
  currentWatchAudioSourceKind = "demo-audio";
  currentWatchAudioRunError = "";
  updateWatchAudioDebug();
  syncWatchAudioPresentation();
  openWatchPreviewShellModule({ fallbackTab: "music" });
  if (preservePlayback && !playWatchAudioPreviewFromStartModule()) {
    const retryPlay = () => {
      watchAudioPreview.removeEventListener("canplay", retryPlay);
      playWatchAudioPreviewFromStartModule();
    };
    watchAudioPreview.addEventListener("canplay", retryPlay, { once: true });
  }
  return true;
}

function renderSongSeedPreviewModule(seed = state.songSeed) {
  if (!currentWatchPreviewWork) {
    renderWatchCommerceActionsModule(null);
  }
  const summary = buildSeedPreviewSummary(seed);
  renderCreationUniverseCard(seed);
  const compactSummary =
    summary.compact ||
    String(seed?.creativeSummary?.compact || "").trim() ||
    String(foryouStyle?.textContent || "").trim();
  if (foryouSeedCopy) {
    foryouSeedCopy.textContent = compactSummary;
    foryouSeedCopy.style.display = compactSummary ? "block" : "none";
  }
  if (watchSeedCopy) {
    watchSeedCopy.textContent = summary.watch || "";
    watchSeedCopy.style.display = summary.watch ? "block" : "none";
  }
  const candidateRunId = String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim();
  if (candidateRunId && currentWatchAudioSourceKind !== "final-artifact" && !getRememberedWatchFinalAudio()) {
    void attemptImmediateFinalAudioAttach(candidateRunId);
  }
  if (watchAudioPreview) {
    if (restoreRememberedWatchFinalAudio()) {
      watchAudioPreview.style.display = "block";
    } else if (currentWatchAudioSourceKind !== "final-artifact") {
      void tryAttachDemoAudioFallbackModule({ autoplay: !!zeroThresholdAutoplayRequested }).then((attached) => {
        if (attached || !watchAudioPreview) return;
        if (currentWatchAudioSourceKind !== "final-artifact") {
          watchAudioPreview.pause?.();
          watchAudioPreview.removeAttribute("src");
          watchAudioPreview.load?.();
          watchAudioPreview.style.display = "none";
          currentWatchAudioSourceKind = "none";
          currentWatchAudioRunError = loginCopy("No mix or demo audio available.", "没有可用的混音或 demo 音频。");
          updateWatchAudioDebug();
          syncWatchAudioPresentation();
        }
      });
    }
  }
  syncWatchMusicArtworkModule();
  syncWatchMusicStateModule();
  if (seed && zeroThresholdAutoplayRequested) {
    openWatchPreviewShellModule({ fallbackTab: "music" });
    playWatchAudioPreviewFromStartModule();
    zeroThresholdAutoplayRequested = false;
  }
  syncWatchEditorsFromSettingsModule();
  renderWatchMetaPanelsModule();
  renderForyouStructure(seed);
  if (
    seed?.title &&
    !hasEffectivePreviewVideo() &&
    !String(foryouThumbImage?.src || "").trim() &&
    !String(currentForyouThumbFallbackDataUrl || "").trim()
  ) {
    syncForyouThumbFromLyrics(seed.title, compactLyricLines(String(seed.lyrics || "").split("\n")));
  }
}

async function renderMarketWorkPreviewIntoWatchModule({
  work = null,
  seed = {},
  previewUnlimited = false
} = {}) {
  openWatchPreviewShellModule({ fallbackTab: "mv" });
  clearWatchPreviewLimit();
  renderSongSeedPreviewModule(seed);
  renderWatchCommerceActionsModule(work);
  if (watchLyricsEditor) watchLyricsEditor.value = seed.lyrics || "";
  if (watchOutlineEditor) watchOutlineEditor.value = seed.videoOutline || "";
  if (watchScriptEditor) {
    watchScriptEditor.value = Array.isArray(seed.sectionPrompts)
      ? seed.sectionPrompts.map((item) => `${item.section}\n${item.prompt}`).join("\n\n")
      : "";
  }
  if (watchCommentsCopy) {
    watchCommentsCopy.textContent = loginCopy(
      previewUnlimited
        ? "Privileged preview. Full playback is available for admin, VIP, or the work owner."
        : "Buyer preview only. Playback stops at 30 seconds until the full release is unlocked.",
      previewUnlimited
        ? "当前是特权预览。管理员、VIP 或作品作者本人可完整播放。"
        : "这是买家预览版。播放会在 30 秒时自动停止，完整版本需解锁后观看。"
    );
  }
  const creator = String(work?.owner_name || work?.owner_email || "Creator").trim() || "Creator";
  if (watchOwnershipCopy) {
    watchOwnershipCopy.textContent = loginCopy(
      `Previewing ${seed.title} by ${creator}. Purchase listen or buyout to unlock the commerce flow.`,
      `正在预览 ${creator} 的《${seed.title}》。购买试听或买断后可继续完整交易流程。`
    );
  }
  const subtitle = previewUnlimited
    ? loginCopy("Privileged preview · Full access", "特权预览 · 完整播放")
    : loginCopy("Buyer preview · 30s max", "买家预览 · 最长 30 秒");
  const artworkSubtitle = `${creator} · ${seed.musicStyle || loginCopy("Preview", "预览")}`;
  setWatchSvgPreviewModule(buildLocalVideoPreviewSvg(seed.title, artworkSubtitle));
  if (watchSubtitle) watchSubtitle.textContent = subtitle;
  if (!previewUnlimited) {
    setWatchPreviewLimit(
      MARKET_WATCH_PREVIEW_LIMIT_SEC,
      loginCopy("Preview ended at 30 seconds.", "预览已在 30 秒处停止。")
    );
  }
  await openWatchPreviewFlowModule({ preferredTab: "mv", clearLimit: false });
  if (watchSubtitle && watchSubtitle.textContent && !watchSubtitle.textContent.includes("30")) {
    watchSubtitle.textContent = subtitle;
  }
}

function syncWatchPlaceholderFromCurrentState() {
  const persistedCoverImage = String(resolveWorkCoverImage(currentWatchPreviewWork || {}) || "").trim();
  if (persistedCoverImage && !isSyntheticWorkCoverImage(persistedCoverImage)) {
    clearWatchFrameLoopModule();
    setForyouBackgroundImage(persistedCoverImage);
    return showWatchFramePlaceholderModule(persistedCoverImage);
  }
  const cachedSequence = globalThis.currentPreviewFrameSequence.length
    ? globalThis.currentPreviewFrameSequence
    : getCachedWatchFrameSequenceModule();
  if (cachedSequence.length) {
    showWatchFramePlaceholderModule(cachedSequence[0]);
    startWatchFrameLoopModule(cachedSequence);
    return true;
  }
  const cachedFrame = globalThis.currentPreviewFrameDataUrl || getCachedWatchFrameModule();
  if (cachedFrame) {
    clearWatchFrameLoopModule();
    return showWatchFramePlaceholderModule(cachedFrame);
  }
  const imageSrc = foryouThumbImage?.src || "";
  if (imageSrc) {
    clearWatchFrameLoopModule();
    setForyouBackgroundImage(imageSrc);
    return showWatchFramePlaceholderModule(imageSrc);
  }
  clearWatchFrameLoopModule();
  if (watchSvg) watchSvg.style.display = "none";
  return false;
}
const buildExampleAssetProxyUrl = (name) => {
  const safeName = String(name || "").trim();
  if (!safeName) return "";
  return `/api/example-assets/blob?name=${encodeURIComponent(safeName)}`;
};
