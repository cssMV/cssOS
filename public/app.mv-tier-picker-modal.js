/* CSSOS_PHASE2_MV_TIER_PICKER_MODAL 20260419 —
 * Second layer of the MV cost-transparency UX (after the persistent cost
 * label near the Generate button).
 *
 * Design philosophy (from Jing, 2026-04-19):
 *   一切参数化 (tier math comes from /api/mv/tiers, not hardcoded here)
 *   一切i18n全球化 (copy uses globalThis.t(); English fallback strings inline)
 *   一切可扩展 (server can add more tiers and the modal keeps rendering)
 *   无价之宝 (priceless) — hide the buyout row for priceless tiers
 *
 * Triggers:
 *   1. First-time: fired by the pipeline panel when it opens AND
 *      cssmvTiers.hasExplicitSelection() is false AND the user hasn't
 *      dismissed the first-time modal in this session (storage flag
 *      MODAL_SEEN_KEY). Dispatched as CustomEvent `cssmv:request-tier-picker`.
 *
 *   2. Low-balance: fired by the Generate-button click handler when
 *      /api/billing/status reports balance_cents < 50% of the current
 *      tier's creator_credit_usd. Dispatched as CustomEvent
 *      `cssmv:request-low-balance-prompt` with detail {
 *        balanceUsd, neededUsd, tierId
 *      }. The panel then waits for `cssmv:tier-picker-resolved` before
 *      kicking off /api/mv/start.
 *
 * The modal is a simple DOM overlay (no shadow-root, no web component) so
 * it picks up the existing theme variables (--text, --accent, etc) and
 * can be escape-closed / click-outside-dismissed by the ambient chrome
 * that wraps every other cssOS modal.
 */

(function () {
  "use strict";

  const MODAL_ID = "mv-tier-picker-modal";
  const MODAL_SEEN_KEY = "cssmv.tier-picker-seen.v1";
  const OPEN_EVENT_FIRST_TIME = "cssmv:request-tier-picker";
  const OPEN_EVENT_LOW_BALANCE = "cssmv:request-low-balance-prompt";
  const RESOLVED_EVENT = "cssmv:tier-picker-resolved";

  const state = {
    mode: null,        // "first-time" | "low-balance" | null
    pendingDetail: null, // whatever was passed to the open event
    resolved: false,   // whether this open was resolved (picked/confirmed/cancelled)
  };

  // ---------- helpers ----------

  function tr(key, fallback) {
    if (typeof globalThis.t === "function") {
      const v = globalThis.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function isZh() {
    return (
      (typeof globalThis.getUiLanguage === "function" && globalThis.getUiLanguage() === "zh") ||
      (globalThis.document && document.documentElement && document.documentElement.lang === "zh")
    );
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtUsd(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return "$" + n.toFixed(2);
  }

  function hasSeenFirstTime() {
    try {
      return localStorage.getItem(MODAL_SEEN_KEY) === "1";
    } catch (_err) {
      return false;
    }
  }

  function markFirstTimeSeen() {
    try { localStorage.setItem(MODAL_SEEN_KEY, "1"); } catch (_err) { /* ignore */ }
  }

  function dispatchResolved(detail) {
    state.resolved = true;
    try {
      globalThis.dispatchEvent(
        new CustomEvent(RESOLVED_EVENT, { detail: detail || {} })
      );
    } catch (_err) { /* ignore */ }
  }

  // ---------- DOM ----------

  function ensureRoot() {
    let root = document.getElementById(MODAL_ID);
    if (root) return root;
    root = document.createElement("div");
    root.id = MODAL_ID;
    root.className = "mvp-tier-modal-root";
    root.setAttribute("hidden", "");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", MODAL_ID + "-title");
    document.body.appendChild(root);
    return root;
  }

  function renderTierCard(tier, activeId) {
    const api = globalThis.cssmvTiers;
    const label = api && api.resolveTierLabel ? api.resolveTierLabel(tier) : (tier.default_label || tier.id);
    const desc = api && api.resolveTierDesc ? api.resolveTierDesc(tier) : (tier.default_description || "");
    const pricing = tier.pricing || {};
    const priceless = !!tier.priceless;
    const active = String(tier.id || "").toLowerCase() === String(activeId || "").toLowerCase();

    // CSSOS_PHASE2_MV_NAMING 20260419 — 观看权 / Watching Right replaces
    // 聆听权 / Listening Right as the per-play noun for MV tiers, since an
    // MV contains video (not just audio). Pricing slot $1.99 (between
    // 聆听权 $0.99 and 买断权 $2.99). See app.mv-pricing-vocab.md decision.
    const creditCopy = isZh() ? "生成credit" : "Credit to generate";
    const listenCopy = isZh() ? "每次观看（观看权）" : "Per view (Watching Right)";
    const breakevenCopy = isZh() ? "回本观看次数" : "Break-even views";
    const pricelessBadge = isZh() ? "无价之宝 · 仅售观看权" : "Priceless · views only";
    const ratioCopy = isZh()
      ? `AI视频占比 ${tier.ai_video_ratio_pct || 0}%`
      : `${tier.ai_video_ratio_pct || 0}% AI video`;

    return (
      '<button type="button" class="mvp-tier-card' +
      (active ? " is-active" : "") +
      '" data-tier-id="' + escapeHtml(tier.id || "") + '">' +
      '<div class="mvp-tier-card-head">' +
        '<span class="mvp-tier-card-name">' + escapeHtml(label) + '</span>' +
        '<span class="mvp-tier-card-ratio">' + escapeHtml(ratioCopy) + '</span>' +
      '</div>' +
      (priceless
        ? '<div class="mvp-tier-card-priceless">' + escapeHtml(pricelessBadge) + '</div>'
        : '') +
      '<div class="mvp-tier-card-desc">' + escapeHtml(desc) + '</div>' +
      '<dl class="mvp-tier-card-pricing">' +
        '<div><dt>' + escapeHtml(creditCopy) + '</dt><dd>' + fmtUsd(pricing.creator_credit_usd) + '</dd></div>' +
        '<div><dt>' + escapeHtml(listenCopy) + '</dt><dd>' + fmtUsd(pricing.suggested_listen_usd) + '</dd></div>' +
        '<div><dt>' + escapeHtml(breakevenCopy) + '</dt><dd>' + escapeHtml(String(pricing.breakeven_listens || 0)) + '</dd></div>' +
      '</dl>' +
      '</button>'
    );
  }

  function renderMarkup() {
    const api = globalThis.cssmvTiers;
    const tiers = (api && api.getTiers && api.getTiers()) || [];
    const activeId = (api && api.currentTierId && api.currentTierId()) || "";

    const lowBalance = state.mode === "low-balance";
    const detail = state.pendingDetail || {};
    const zh = isZh();

    const title = lowBalance
      ? (zh ? "余额偏低 — 要生成哪一档？" : "Balance is low — which tier?")
      : (zh ? "选择您要生成的MV档次" : "Choose your MV tier");

    const subtitle = lowBalance
      ? (zh
          ? `当前余额 ${fmtUsd(detail.balanceUsd)}，Hybrid档预计需要 ${fmtUsd(detail.neededUsd)}。如果想省credit，可以切到 Lite。`
          : `Balance ${fmtUsd(detail.balanceUsd)}, Hybrid needs ~${fmtUsd(detail.neededUsd)}. Switch to Lite to save credit, or confirm to continue.`)
      : (zh
          ? "所有三档都是「无价之宝」 —— 只卖观看权，不卖买断。选中后可以随时在面板上切换。"
          // CSSOS_WAVE_484 — i18n 铁律: 英文文案不得硬编码中文「无价之宝」, 用 priceless。
          : "All three tiers are priceless — Watching Rights only, no buyout. You can switch tiers from the panel at any time.");

    const primaryCopy = lowBalance
      ? (zh ? "就用当前档次生成" : "Generate with current tier")
      : (zh ? "用默认档次（Hybrid）开始" : "Start with default (Hybrid)");

    const closeCopy = lowBalance
      ? (zh ? "取消" : "Cancel")
      : (zh ? "稍后再说" : "Maybe later");

    return (
      '<div class="mvp-tier-modal-backdrop" data-tier-modal-dismiss></div>' +
      '<div class="mvp-tier-modal-panel" role="document">' +
        '<button type="button" class="mvp-tier-modal-close" data-tier-modal-dismiss aria-label="Close">×</button>' +
        '<h2 id="' + MODAL_ID + '-title" class="mvp-tier-modal-title">' + escapeHtml(title) + '</h2>' +
        '<p class="mvp-tier-modal-subtitle">' + escapeHtml(subtitle) + '</p>' +
        '<div class="mvp-tier-modal-cards">' +
          tiers.map(function (t) { return renderTierCard(t, activeId); }).join("") +
        '</div>' +
        '<div class="mvp-tier-modal-actions" data-segmented="2">' +
          '<button type="button" class="mvp-tier-modal-secondary" data-tier-modal-cancel>' + escapeHtml(closeCopy) + '</button>' +
          '<button type="button" class="mvp-tier-modal-primary active" data-tier-modal-primary>' + escapeHtml(primaryCopy) + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function close(reason) {
    const root = document.getElementById(MODAL_ID);
    if (!root) return;
    root.setAttribute("hidden", "");
    root.innerHTML = "";
    // If we closed without picking, still dispatch resolved so the caller
    // (e.g. Generate handler) isn't left hanging.
    if (!state.resolved) {
      dispatchResolved({ mode: state.mode, reason: reason || "dismissed", picked: false });
    }
    state.mode = null;
    state.pendingDetail = null;
    state.resolved = false;
  }

  function bindEvents(root) {
    // Click outside / × button / cancel button — all dismiss.
    root.addEventListener("click", function (ev) {
      const target = ev.target;
      if (!target || !target.closest) return;
      if (target.closest("[data-tier-modal-dismiss]")) {
        close("dismissed");
        return;
      }
      if (target.closest("[data-tier-modal-cancel]")) {
        close("cancel");
        return;
      }
      const card = target.closest(".mvp-tier-card");
      if (card && card.dataset && card.dataset.tierId) {
        pickTier(card.dataset.tierId);
        return;
      }
      if (target.closest("[data-tier-modal-primary]")) {
        // First-time: honor whatever tier is currently selected (default).
        // Low-balance: proceed with current tier (user acknowledged warning).
        const api = globalThis.cssmvTiers;
        const currentId = api && api.currentTierId ? api.currentTierId() : null;
        dispatchResolved({
          mode: state.mode,
          reason: "confirmed",
          picked: true,
          tierId: currentId,
        });
        if (state.mode === "first-time") markFirstTimeSeen();
        close("confirmed");
        return;
      }
    });

    // Escape closes.
    function onKey(ev) {
      if (ev.key === "Escape") {
        const cur = document.getElementById(MODAL_ID);
        if (cur && !cur.hasAttribute("hidden")) {
          ev.preventDefault();
          close("escape");
        }
      }
    }
    // Bind once per modal root; cleaned up when close() empties innerHTML.
    if (!root.__mvpKeyBound) {
      document.addEventListener("keydown", onKey);
      root.__mvpKeyBound = true;
    }
  }

  function pickTier(id) {
    const api = globalThis.cssmvTiers;
    if (api && typeof api.setTier === "function") api.setTier(id);
    dispatchResolved({
      mode: state.mode,
      reason: "picked",
      picked: true,
      tierId: id,
    });
    if (state.mode === "first-time") markFirstTimeSeen();
    close("picked");
  }

  function openFirstTime() {
    // Gate on session flag — don't badger a returning user who dismissed
    // the modal in a prior open, but DO respect explicit re-open events
    // (e.g. a future Settings → "Change MV tier" entry point that can
    // always re-open).
    if (hasSeenFirstTime()) return;
    open("first-time", null);
  }

  function openLowBalance(detail) {
    open("low-balance", detail || {});
  }

  function open(mode, detail) {
    // Ensure the catalog is populated before we render the cards.
    const api = globalThis.cssmvTiers;
    if (!api) return;
    state.mode = mode;
    state.pendingDetail = detail;
    state.resolved = false;
    const root = ensureRoot();

    const render = function () {
      root.innerHTML = renderMarkup();
      root.removeAttribute("hidden");
      bindEvents(root);
      // Focus the primary action for keyboard users.
      const primary = root.querySelector("[data-tier-modal-primary]");
      if (primary && typeof primary.focus === "function") {
        try { primary.focus(); } catch (_err) { /* ignore */ }
      }
    };

    if (api.getTiers && api.getTiers().length > 0) {
      render();
      // Kick off a background fetch to refresh prices without blocking.
      if (typeof api.fetchCatalog === "function") {
        api.fetchCatalog(false).then(function () {
          // If the modal is still open, re-render with fresh prices.
          const cur = document.getElementById(MODAL_ID);
          if (cur && !cur.hasAttribute("hidden")) render();
        });
      }
    } else if (typeof api.fetchCatalog === "function") {
      // No fallback tiers yet — wait for the first fetch.
      api.fetchCatalog(false).then(render);
    } else {
      render();
    }
  }

  // ---------- public API ----------

  globalThis.cssmvTierPickerModal = {
    open: open,
    openFirstTime: openFirstTime,
    openLowBalance: openLowBalance,
    close: close,
    hasSeenFirstTime: hasSeenFirstTime,
    markFirstTimeSeen: markFirstTimeSeen,
    MODAL_ID: MODAL_ID,
    MODAL_SEEN_KEY: MODAL_SEEN_KEY,
    OPEN_EVENT_FIRST_TIME: OPEN_EVENT_FIRST_TIME,
    OPEN_EVENT_LOW_BALANCE: OPEN_EVENT_LOW_BALANCE,
    RESOLVED_EVENT: RESOLVED_EVENT,
  };

  // ---------- event listeners ----------

  globalThis.addEventListener(OPEN_EVENT_FIRST_TIME, function () {
    openFirstTime();
  });

  globalThis.addEventListener(OPEN_EVENT_LOW_BALANCE, function (ev) {
    const detail = (ev && ev.detail) || {};
    openLowBalance(detail);
  });
})();
