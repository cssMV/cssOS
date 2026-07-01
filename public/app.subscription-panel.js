// CSSOS_PHASE2_I18N_ENGLISH_AS_SSOT 20260419
//
// English is the SINGLE source of truth. Translations for every other
// locale — es, fr, ja, ko, de, ru, zh, ar, pt, hi, ... — are derived at
// runtime through the i18n runtime (public/i18n/runtime.js, backed by
// POST /api/i18n/translate + IndexedDB cache). No language is privileged;
// every locale flows through the exact same code path.
//
// We route through the global `tr(english, vars?)` helper defined in
// app.js, which itself wraps `window.CSSOS_I18N.tr()`. If that runtime
// is unavailable the call returns the English source verbatim. On cache
// miss, the runtime dispatches `cssos:i18n-translation-ready` once the
// async batch resolves, and the subscription panel re-renders below.
//
// CALL CONVENTION: `tr("Change Plan")` — ONE argument, always English.
// For interpolation: `tr("Plan: {label}", { label: tierLabel })`.
//
// NB: `tr` is a GLOBAL function declared in app.js (which loads before this
// file per index.html). We must NOT re-declare it here — doing so creates a
// Safari SyntaxError "Can't create duplicate variable that shadows a global
// property: 'tr'". Instead we read the global directly, and fall back to a
// local helper only if someone loads this file without app.js.
if (typeof globalThis.tr !== "function") {
  globalThis.tr = function trFallback(english, vars) {
    const source = typeof english === "string" ? english : String(english == null ? "" : english);
    try {
      const i18n = globalThis.CSSOS_I18N;
      if (i18n && typeof i18n.tr === "function") {
        const translated = i18n.tr(source, vars);
        if (typeof translated === "string") return translated;
      }
    } catch (_) { /* fall through */ }
    if (vars && typeof vars === "object") {
      return source.replace(/\{(\w+)\}/g, (_m, key) =>
        vars[key] != null ? String(vars[key]) : `{${key}}`
      );
    }
    return source;
  };
}

function buildSubscriptionPanelMarkupModule() {
  const tier = typeof getAccessTier === "function" ? getAccessTier() : "guest";
  const preset = typeof getMembershipPreset === "function" ? getMembershipPreset(tier) : null;
  const tierLabel = typeof describeMembershipTier === "function"
    ? describeMembershipTier(tier)
    : String(tier || "Guest");
  const currentPlanLine = tr("Current plan: {tierLabel}", { tierLabel });
  const boostAvailability = typeof getCreatorBoostAvailability === "function"
    ? getCreatorBoostAvailability()
    : { generation: 0, language: 0, voice: 0, thumbnail: 0, preview_video: 0, background_job: 0 };
  const behaviorBoosts = (typeof readPanelBehaviorSettingsLocal === "function"
    ? readPanelBehaviorSettingsLocal()?.creator_boost
    : null) || {};
  const generationUnitPrice = Math.max(0, Number(behaviorBoosts.generation_unit_cents || 99)) / 100;
  const backgroundJobUnitPrice = Math.max(0, Number(behaviorBoosts.background_job_unit_cents || 199)) / 100;
  const languageUnitPrice = Math.max(0, Number(behaviorBoosts.language_unit_cents || 300)) / 100;
  const voiceUnitPrice = Math.max(0, Number(behaviorBoosts.voice_unit_cents || 500)) / 100;
  const isAdmin = typeof hasPanelPermission === "function"
    ? hasPanelPermission("admin.panel")
    : false;
  const includedBackgroundSlots =
    preset?.backgroundJobLimit === null
      ? tr("Unlimited")
      : String(Math.max(0, Number(preset?.backgroundJobLimit || 0)));
  const concurrentBackgroundSlots = Math.max(0, Number(preset?.backgroundConcurrentJobLimit || 0));
  const price = (amount) => `$${Number(amount || 0).toFixed(2)}`;
  const maxDurationMin = (Number(preset?.maxDurationSec || 180) / 60).toFixed(0);
  const queueLane = preset?.queuePriority || "guest";
  const pendingHoldAmount = Number(billingState?.pending_balance_cents || 0);
  const pendingHoldDate = billingState?.pending_balance_release_at
    ? new Date(String(billingState.pending_balance_release_at)).toLocaleDateString()
    : "";
  const plans = [
    {
      tier: "free",
      price: 0,
      label: tr("Basic / Free"),
      note: tr("Browse and try lightweight creation."),
      limit: tr("3 creations / month")
    },
    {
      tier: "starter",
      price: 9.99,
      label: tr("Starter"),
      note: tr("Longer generation and paid creation lane."),
      limit: tr("30 creations / month")
    },
    {
      tier: "pro",
      price: 29.99,
      label: tr("Pro"),
      note: tr("Opera, triptych, advanced settings, longer video."),
      limit: tr("100 creations / month")
    },
    {
      tier: "studio",
      price: 99.99,
      label: tr("Studio"),
      note: tr("Studio lanes, team workflow, heavier output."),
      limit: tr("300 creations / month")
    }
  ];
  return `
    <div class="subscription-panel-stack" style="display:grid; gap:16px;">
    <div class="works-section">
      <div class="section-title">${escapeHtml(tr("Membership Lane"))}</div>
      <div class="comment-card">
        <div class="comment-meta">
          <span>${escapeHtml(tr("Purpose"))}</span>
          <span>${escapeHtml(tr("Subscribe · Upgrade · Creator Boost"))}</span>
        </div>
        <div class="comment-text">
          ${escapeHtml(tr("New users should upgrade here first. Advanced Settings can still link here, but this panel is now the direct subscription entrance."))}
        </div>
        <div class="works-note">
          ${escapeHtml(tr("System defaults stay in code for now. User changes stay local to the current browser session profile."))}
        </div>
      </div>
    </div>
    <div class="works-section">
      <div class="section-title">${escapeHtml(tr("Current Membership"))}</div>
      <div class="comment-card">
        <div class="comment-meta">
          <span>${escapeHtml(tr("Tier"))}</span>
          <span>${escapeHtml(tierLabel)}</span>
        </div>
        <div class="comment-text">
          ${authState.user
            ? escapeHtml(tr("Your subscription, Creator Boost balance, and upgrade actions live here now."))
            : escapeHtml(tr("Guests can browse plans here first, then sign in to upgrade."))}
        </div>
        <div class="works-note">${escapeHtml(currentPlanLine)}</div>
        <div class="works-note">
          ${escapeHtml(tr("Queue lane · {queueLane} · Max duration {maxDurationMin} min", { queueLane, maxDurationMin }))}
        </div>
        <div class="works-note">
          ${escapeHtml(tr("Background queue slots · {includedBackgroundSlots} total · {concurrentBackgroundSlots} concurrent", { includedBackgroundSlots, concurrentBackgroundSlots }))}
        </div>
        <div class="works-note">
          ${escapeHtml(tr("Default audio delivery is MP3. Pro+ can request WAV manually, but lossless files are temporary and auto-clean after 24 hours."))}
        </div>
        ${pendingHoldAmount > 0 ? `
          <div class="works-note">
            ${escapeHtml(pendingHoldDate
              ? tr("Refund on hold: {amount} unlocks on {date}.", { amount: price(pendingHoldAmount / 100), date: pendingHoldDate })
              : tr("Refund on hold: {amount} is still in the 14-day platform hold.", { amount: price(pendingHoldAmount / 100) }))}
          </div>
        ` : ""}
        <!-- CSSOS_PHASE2_PAYMENTS 20260419 — top-right "Change Plan" entry removed per
             user feedback ("放到右上角太隐蔽了"). Plan selection now lives inline on
             each plan card below, where both the Stripe (international) and NihaoPay
             (domestic: Alipay / WeChat Pay / UnionPay) paths are surfaced side-by-side. -->
      </div>
    </div>
    <div class="subscription-plans-grid" style="display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));">
      <div class="works-section">
        <div class="section-title">${escapeHtml(tr("Plans"))}</div>
        <div class="works-list">
          ${plans.map((plan) => {
            const isCurrent = plan.tier === tier;
            const isPaid = Number(plan.price) > 0;
            const priceCents = Math.round(Number(plan.price) * 100);
            return `
            <article class="work-card">
              <div class="work-cover">${escapeHtml(plan.tier.slice(0, 1).toUpperCase())}</div>
              <div class="work-info">
                <div class="work-title">${escapeHtml(plan.label)}</div>
                <div class="work-tags">${escapeHtml(plan.price > 0 ? tr("${price}/month", { price: plan.price }) : tr("Free"))}</div>
                <div class="work-tags">${escapeHtml(plan.limit)}</div>
                <div class="works-note">${escapeHtml(plan.note)}</div>
              </div>
              ${isCurrent
                ? `<div class="work-actions">
                     <button class="mini-btn ghost" type="button" disabled>${escapeHtml(tr("Current plan"))}</button>
                   </div>`
                : (!isPaid
                  ? `<div class="work-actions">
                       <button class="mini-btn" type="button" data-subscription-direct-tier="${escapeHtml(plan.tier)}">${escapeHtml(tr("Switch to Free"))}</button>
                     </div>`
                  : `
                  <div class="pay-group">
                    <div class="pay-group-head">
                      <span class="pay-group-dot intl"></span>
                      <span>${escapeHtml(tr("International · Stripe"))}</span>
                    </div>
                    <div class="pay-group-body">
                      <button class="mini-btn pay-stripe" type="button" data-subscription-direct-tier="${escapeHtml(plan.tier)}">${escapeHtml(tr("Pay with card"))}</button>
                    </div>
                  </div>
                  <div class="pay-group" data-subscription-panel-nihaopay-row="${escapeHtml(plan.tier)}">
                    <div class="pay-group-head">
                      <span class="pay-group-dot cn"></span>
                      <span>${escapeHtml(tr("China · NihaoPay"))}</span>
                    </div>
                    <div class="pay-group-body">
                      <button class="mini-btn pay-vendor alipay" type="button" data-subscription-panel-nihaopay-vendor="alipay" data-subscription-panel-nihaopay-tier="${escapeHtml(plan.tier)}" data-subscription-panel-nihaopay-price="${priceCents}">${escapeHtml(tr("Alipay"))}</button>
                      <button class="mini-btn pay-vendor wechatpay" type="button" data-subscription-panel-nihaopay-vendor="wechatpay" data-subscription-panel-nihaopay-tier="${escapeHtml(plan.tier)}" data-subscription-panel-nihaopay-price="${priceCents}">${escapeHtml(tr("WeChat Pay"))}</button>
                      <button class="mini-btn pay-vendor unionpay" type="button" data-subscription-panel-nihaopay-vendor="unionpay" data-subscription-panel-nihaopay-tier="${escapeHtml(plan.tier)}" data-subscription-panel-nihaopay-price="${priceCents}">${escapeHtml(tr("UnionPay"))}</button>
                    </div>
                  </div>
                `)}
            </article>
          `;
          }).join("")}
        </div>
      </div>
      <div class="works-section">
        <div class="section-title">${escapeHtml(tr("Creator Boost"))}</div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-label">${escapeHtml(tr("Extra generations"))}</div><div class="stat-value">${Number(boostAvailability.generation || 0)}</div></div>
          <div class="stat-card"><div class="stat-label">${escapeHtml(tr("Background queue slots"))}</div><div class="stat-value">${Number(boostAvailability.background_job || 0)}</div></div>
          <div class="stat-card"><div class="stat-label">${escapeHtml(tr("Extra lyric languages"))}</div><div class="stat-value">${Number(boostAvailability.language || 0)}</div></div>
          <div class="stat-card"><div class="stat-label">${escapeHtml(tr("Extra voice lanes"))}</div><div class="stat-value">${Number(boostAvailability.voice || 0)}</div></div>
          <div class="stat-card"><div class="stat-label">${escapeHtml(tr("Thumbnail reruns"))}</div><div class="stat-value">${Number(boostAvailability.thumbnail || 0)}</div></div>
          <div class="stat-card"><div class="stat-label">${escapeHtml(tr("Preview video reruns"))}</div><div class="stat-value">${Number(boostAvailability.preview_video || 0)}</div></div>
        </div>
        <!-- CSSOS_PHASE2_PAYMENTS 20260419 — Creator Boost: each row now offers
             BOTH international Stripe and domestic NihaoPay (Alipay/WeChat/UnionPay).
             Amounts are kept in cents client-side so we can pass them straight
             into /api/payments/intents without any extra conversion. -->
        <div class="boost-shop-grid">
          ${[
            { kind: "generation", quantity: 10, unitCents: Math.max(0, Number(behaviorBoosts.generation_unit_cents || 99)) * 10, title: tr("10 Extra Generations") },
            { kind: "background_job", quantity: 1, unitCents: Math.max(0, Number(behaviorBoosts.background_job_unit_cents || 199)), title: tr("Background Queue Slot") },
            { kind: "language", quantity: 1, unitCents: Math.max(0, Number(behaviorBoosts.language_unit_cents || 300)), title: tr("Language Boost") },
            { kind: "voice", quantity: 1, unitCents: Math.max(0, Number(behaviorBoosts.voice_unit_cents || 500)), title: tr("Voice Lane Boost") }
          ].map((item) => `
            <div class="boost-shop-card">
              <div class="boost-shop-head">
                <span class="boost-shop-title">${escapeHtml(item.title)}</span>
                <span class="boost-shop-price">${escapeHtml(price(item.unitCents / 100))}</span>
              </div>
              <div class="pay-group">
                <div class="pay-group-head">
                  <span class="pay-group-dot intl"></span>
                  <span>${escapeHtml(tr("International · Stripe"))}</span>
                </div>
                <div class="pay-group-body">
                  <button class="mini-btn pay-stripe" type="button" data-subscription-buy-boost="${escapeHtml(item.kind)}" data-subscription-boost-quantity="${item.quantity}">${escapeHtml(tr("Pay with card"))}</button>
                </div>
              </div>
              <div class="pay-group">
                <div class="pay-group-head">
                  <span class="pay-group-dot cn"></span>
                  <span>${escapeHtml(tr("China · NihaoPay"))}</span>
                </div>
                <div class="pay-group-body">
                  <button class="mini-btn pay-vendor alipay" type="button" data-subscription-boost-nihaopay-vendor="alipay" data-subscription-boost-nihaopay-kind="${escapeHtml(item.kind)}" data-subscription-boost-nihaopay-quantity="${item.quantity}" data-subscription-boost-nihaopay-price="${item.unitCents}">${escapeHtml(tr("Alipay"))}</button>
                  <button class="mini-btn pay-vendor wechatpay" type="button" data-subscription-boost-nihaopay-vendor="wechatpay" data-subscription-boost-nihaopay-kind="${escapeHtml(item.kind)}" data-subscription-boost-nihaopay-quantity="${item.quantity}" data-subscription-boost-nihaopay-price="${item.unitCents}">${escapeHtml(tr("WeChat Pay"))}</button>
                  <button class="mini-btn pay-vendor unionpay" type="button" data-subscription-boost-nihaopay-vendor="unionpay" data-subscription-boost-nihaopay-kind="${escapeHtml(item.kind)}" data-subscription-boost-nihaopay-quantity="${item.quantity}" data-subscription-boost-nihaopay-price="${item.unitCents}">${escapeHtml(tr("UnionPay"))}</button>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="works-section">
        <div class="section-title">${escapeHtml(tr("Permissions and lanes"))}</div>
        <div class="comment-card">
          <div class="comment-text">
            ${escapeHtml(tr("Membership controls creation limits and output lanes. Creator Boost adds temporary capability without changing your base tier."))}
          </div>
          <div class="works-note">
            ${escapeHtml(tr("Action-level permission overview should stay in its own governance/admin panel instead of mixing into the buyer path."))}
          </div>
          ${isAdmin ? `
            <div class="work-actions" style="margin-top:12px;">
              <button class="mini-btn ghost" type="button" data-subscription-open-governance>
                ${escapeHtml(tr("Open permission overview"))}
              </button>
            </div>
          ` : ""}
          <!-- CSSOS_WAVE_537 — Apple 3.1.2(c) 合规: App 内订阅页须含 自动续订声明 + 使用条款(EULA) + 隐私政策 功能性链接. -->
          <div class="subscription-legal" style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.14);font-size:12px;line-height:1.55;opacity:0.85;">
            <p style="margin:0 0 8px;">${escapeHtml(tr("Subscriptions are auto-renewable. Each plan's name, length, and price are shown above. Payment is charged to your Apple ID at confirmation of purchase. It renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your Apple ID account settings."))}</p>
            <!-- CSSOS_WAVE_1515/1520 — Jing: 胶囊宪法(2 段均分 50/50, 图标+标签, 激活段在前满圆凸,
                 轨道共边)。两段【永远都可见】(flex:1 1 0), 不横向滑动隐藏。 -->
            <!-- CSSOS_WAVE_1521 — 色调宪法(黑+绿): 激活段翠绿渐变+深墨字, 未激活段深绿字(浅底)。 -->
            <div style="display:flex;align-items:stretch;gap:6px;border-radius:999px;overflow:hidden;border:1px solid rgba(10,143,95,0.30);max-width:440px;">
              <a href="/terms.html" target="_blank" rel="noopener" style="flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:999px;background:linear-gradient(120deg,#00f5a0,#0bf7ff);color:#04120c;padding:10px 10px;font:600 12.5px/1 -apple-system,system-ui,sans-serif;text-decoration:none;"><span style="font-size:13px;">📄</span>${escapeHtml(tr("Terms of Use (EULA)"))}</a>
              <a href="/privacy.html" target="_blank" rel="noopener" style="flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:999px;background:transparent;color:#0a8f5f;padding:10px 10px;font:600 12.5px/1 -apple-system,system-ui,sans-serif;text-decoration:none;"><span style="font-size:13px;">🔒</span>${escapeHtml(tr("Privacy Policy"))}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  `;
}

if (!globalThis.subscriptionPanel) {
  globalThis.subscriptionPanel = document.getElementById("subscription-panel");
}

function ensureSubscriptionPlanModalModule() {
  let modal = document.getElementById("subscription-plan-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "subscription-plan-modal";
  modal.className = "provider-login-modal hidden subscription-plan-modal";
  modal.innerHTML = `
    <div class="provider-login-dialog subscription-plan-dialog">
      <div class="subscription-plan-header">
        <div>
          <div class="advanced-panel-card-title">${escapeHtml(tr("Change Plan"))}</div>
          <div class="advanced-panel-note" data-subscription-plan-subtitle></div>
        </div>
        <button class="mini-btn ghost tiny" type="button" data-subscription-plan-close>${escapeHtml(t("overlay.close"))}</button>
      </div>
      <div class="subscription-plan-list" data-subscription-plan-list></div>
      <div class="advanced-panel-note" data-subscription-plan-status></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-subscription-plan-close]")) {
      modal.classList.add("hidden");
    }
  });
  return modal;
}

function subscriptionPlansCatalogModule() {
  return [
    {
      tier: "free",
      price: 0,
      label: tr("Basic / Free"),
      limit: tr("3 creations / month"),
      note: tr("Lightweight creation and browsing.")
    },
    {
      tier: "starter",
      price: 9.99,
      label: tr("Starter"),
      limit: tr("30 creations / month"),
      note: tr("Longer duration and paid creation lane.")
    },
    {
      tier: "pro",
      price: 29.99,
      label: tr("Pro"),
      limit: tr("100 creations / month"),
      note: tr("Structured works and advanced settings.")
    },
    {
      tier: "studio",
      price: 99.99,
      label: tr("Studio"),
      limit: tr("300 creations / month"),
      note: tr("Workspace lanes and team workflow.")
    }
    // CSSOS_WAVE_1448 — Enterprise retired as a purchasable tier (Jing).
  ];
}

function renderSubscriptionPlanModalModule(targetTier = "") {
  const modal = ensureSubscriptionPlanModalModule();
  const list = modal?.querySelector("[data-subscription-plan-list]");
  const subtitle = modal?.querySelector("[data-subscription-plan-subtitle]");
  const status = modal?.querySelector("[data-subscription-plan-status]");
  if (!(list instanceof HTMLElement) || !(subtitle instanceof HTMLElement) || !(status instanceof HTMLElement)) {
    return false;
  }
  const currentTier = typeof getAccessTier === "function" ? getAccessTier() : "guest";
  const currentTierLabel = typeof describeMembershipTier === "function"
    ? describeMembershipTier(currentTier)
    : String(currentTier || "");
  const plans = subscriptionPlansCatalogModule();
  subtitle.textContent = authState.user
    ? tr("Choose a higher or lower membership tier here. Current plan: {currentTierLabel}.", { currentTierLabel })
    : tr("Browse the full plan ladder first, then sign in to continue.");
  status.textContent = "";
  list.innerHTML = plans
    .map((plan) => {
      const isCurrent = plan.tier === currentTier;
      const isTarget = targetTier && plan.tier === targetTier;
      return `
        <article class="workspace-card subscription-plan-card${isCurrent ? " is-current" : ""}${isTarget ? " is-target" : ""}">
          <div class="workspace-card-head">
            <div>
              <div class="work-title">${escapeHtml(plan.label)}</div>
              <div class="work-tags">${escapeHtml(plan.price > 0 ? tr("${price}/month", { price: plan.price }) : tr("Free"))}</div>
              <div class="work-tags">${escapeHtml(plan.limit)}</div>
            </div>
            <div class="report-badge ${isCurrent ? "success" : "warning"}">${escapeHtml(isCurrent ? tr("Current") : plan.tier.toUpperCase())}</div>
          </div>
          <div class="works-note">${escapeHtml(plan.note)}</div>
          ${isCurrent
            ? `<div class="work-actions">
                 <button class="mini-btn ghost" type="button" disabled>${escapeHtml(tr("Current plan"))}</button>
               </div>`
            : (Number(plan.price) > 0
              ? `
              <div class="pay-group">
                <div class="pay-group-head">
                  <span class="pay-group-dot intl"></span>
                  <span>${escapeHtml(tr("International · Stripe"))}</span>
                </div>
                <div class="pay-group-body">
                  <button class="mini-btn pay-stripe" type="button" data-subscription-select-tier="${escapeHtml(plan.tier)}">${escapeHtml(tr("Pay with card"))}</button>
                </div>
              </div>
              <div class="pay-group" data-subscription-nihaopay-row="${escapeHtml(plan.tier)}">
                <div class="pay-group-head">
                  <span class="pay-group-dot cn"></span>
                  <span>${escapeHtml(tr("China · NihaoPay"))}</span>
                </div>
                <div class="pay-group-body">
                  <button class="mini-btn pay-vendor alipay" type="button" data-subscription-nihaopay-vendor="alipay" data-subscription-nihaopay-tier="${escapeHtml(plan.tier)}" data-subscription-nihaopay-price="${Number(plan.price) * 100}">${escapeHtml(tr("Alipay"))}</button>
                  <button class="mini-btn pay-vendor wechatpay" type="button" data-subscription-nihaopay-vendor="wechatpay" data-subscription-nihaopay-tier="${escapeHtml(plan.tier)}" data-subscription-nihaopay-price="${Number(plan.price) * 100}">${escapeHtml(tr("WeChat Pay"))}</button>
                  <button class="mini-btn pay-vendor unionpay" type="button" data-subscription-nihaopay-vendor="unionpay" data-subscription-nihaopay-tier="${escapeHtml(plan.tier)}" data-subscription-nihaopay-price="${Number(plan.price) * 100}">${escapeHtml(tr("UnionPay"))}</button>
                </div>
              </div>
            `
              : `<div class="work-actions">
                   <button class="mini-btn" type="button" data-subscription-select-tier="${escapeHtml(plan.tier)}">${escapeHtml(tr("Switch to Free"))}</button>
                 </div>`)}
        </article>
      `;
    })
    .join("");
  list.querySelectorAll("[data-subscription-select-tier]").forEach((button) => {
    button.addEventListener("click", async () => {
      const nextTier = String(button.getAttribute("data-subscription-select-tier") || "").trim();
      await requestMembershipPlanChange(nextTier, button, status);
    });
  });
  list.querySelectorAll("[data-subscription-nihaopay-vendor]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.cssPaymentsCheckout || typeof window.cssPaymentsCheckout.startCheckout !== "function") {
        if (typeof showToast === "function") showToast(tr("Payment gateway not ready. Please refresh and try again."));
        return;
      }
      const tier = String(button.getAttribute("data-subscription-nihaopay-tier") || "").trim().toLowerCase();
      const vendor = String(button.getAttribute("data-subscription-nihaopay-vendor") || "alipay").trim().toLowerCase();
      const amountCents = Math.max(0, Math.round(Number(button.getAttribute("data-subscription-nihaopay-price") || 0)));
      if (!tier || !amountCents) return;
      if (status instanceof HTMLElement) {
        status.textContent = tr("Redirecting to the payment page...");
      }
      await window.cssPaymentsCheckout.startCheckout({
        kind: "subscription",
        vendor,
        amount_cents: amountCents,
        tier,
        trigger: button,
        note: `subscription:${tier}`
      });
    });
  });
  modal.classList.remove("hidden");
  return true;
}

async function requestMembershipPlanChangeModule(targetTier, trigger = null, statusNode = null) {
  const nextTier = String(targetTier || "").trim().toLowerCase();
  if (!nextTier) return false;
  if (!authState.user) {
    const msg = tr("Sign in first to change your membership plan.");
    if (typeof openLoginForCreation === "function") {
      openLoginForCreation(msg);
    } else if (typeof showToast === "function") {
      showToast(msg);
    }
    return false;
  }
  const updateStatus = (message) => {
    const text = String(message || "");
    if (statusNode instanceof HTMLElement) {
      statusNode.textContent = text;
    } else if (text && typeof showToast === "function") {
      // Fallback when no statusNode: make sure the user SEES something on click
      showToast(text);
    }
  };

  /* CSSOS_WAVE_123 20260513 — iOS native: route through StoreKit IAP
   * instead of the Stripe-backed /api/billing/membership/change.
   * Apple Guideline 3.1.1: digital subscriptions must use IAP. The
   * StoreKit dialog handles the user-facing payment UX; we just kick
   * it off here and let the receipt verify endpoint flip the tier
   * server-side.
   *
   * Default to monthly period for v1 (we don't have an annual toggle
   * in this modal yet; the user can upgrade to annual via the App
   * Store's standard "Manage Subscriptions" flow). */
  const iosNative = typeof globalThis.cssosIsIosNative === "function"
    ? globalThis.cssosIsIosNative()
    : false;
  if (iosNative && globalThis.cssosIapNative && nextTier !== "free") {
    try {
      setButtonBusy(trigger, true);
      updateStatus(tr("Opening App Store…"));
      const result = await globalThis.cssosIapNative.purchaseSubscriptionTier(nextTier, "monthly");
      if (result && result.ok) {
        if (typeof fetchBillingStatus === "function") {
          await fetchBillingStatus().catch(() => null);
        }
        await renderSubscriptionPanelModule();
        updateStatus(tr("Subscription activated."));
        return true;
      }
      const err = String(result?.error || "");
      if (err === "user_cancelled") {
        updateStatus(tr("Cancelled."));
      } else {
        updateStatus(tr("Could not complete the purchase: ") + err);
      }
      return false;
    } catch (err) {
      updateStatus(tr("Purchase error: ") + String(err?.message || err));
      return false;
    } finally {
      setButtonBusy(trigger, false);
    }
  }

  try {
    setButtonBusy(trigger, true);
    updateStatus(tr("Updating your membership plan..."));
    const res = await fetch("/api/billing/membership/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ target_tier: nextTier, requested_from: "subscription_plan_modal" })
    });
    const payload = await res.json().catch(() => null);
    const data = payload?.data || payload;
    if (res.ok && payload?.ok !== false && data?.checkout_url) {
      window.location.href = String(data.checkout_url);
      return true;
    }
    if (res.ok && payload?.ok !== false && data?.tier) {
      authState.tier = String(data.tier || authState.tier || "");
      if (typeof fetchBillingStatus === "function") {
        await fetchBillingStatus().catch(() => null);
      }
      await renderSubscriptionPanelModule();
      if (Number(data.refunded_cents || 0) > 0) {
        const refundAmount = `$${(Number(data.refunded_cents || 0) / 100).toFixed(2)}`;
        const holdDate = data.hold_release_at
          ? new Date(String(data.hold_release_at)).toLocaleDateString()
          : "";
        updateStatus(
          holdDate
            ? tr("Plan updated. {amount} is now in your 14-day platform hold and will unlock on {date}.", { amount: refundAmount, date: holdDate })
            : tr("Plan updated. {amount} is now in your 14-day platform hold before it becomes available.", { amount: refundAmount })
        );
      } else if (Number(data.charged_cents || 0) > 0) {
        const chargedAmount = `$${(Number(data.charged_cents || 0) / 100).toFixed(2)}`;
        updateStatus(tr("Plan updated. Charged {amount} from your balance.", { amount: chargedAmount }));
      } else {
        updateStatus(tr("Plan updated."));
      }
      return true;
    }
    // Non-OK response path — preserve the server code so the catch can branch on it
    const serverCode = String(payload?.code || "").trim();
    if (serverCode === "INSUFFICIENT_BALANCE") {
      throw new Error("INSUFFICIENT_BALANCE");
    }
    throw new Error(serverCode || `membership_plan_change_failed:${res.status}`);
  } catch (_error) {
    const fallbackCode = String(_error?.message || "");
    if (fallbackCode === "INSUFFICIENT_BALANCE") {
      await handleMembershipInsufficientBalanceModule(nextTier, trigger, updateStatus);
      return false;
    }
    updateStatus(tr("Plan change is not available on this billing backend yet. Please try again or contact support."));
    return false;
  } finally {
    setButtonBusy(trigger, false);
  }
}

// Offer the user a direct path to pay via Stripe when their balance is too low.
// Short-term: reuse the existing /api/cssmv/boosts/checkout/create endpoint
// (a Stripe Checkout session) so we actually get the user into a real payment
// flow, plus show a clear toast explaining the situation.
async function handleMembershipInsufficientBalanceModule(targetTier, trigger, updateStatus) {
  const tierLabel = typeof describeMembershipTier === "function"
    ? describeMembershipTier(targetTier)
    : String(targetTier || "");
  updateStatus(tr("Your in-app balance is not enough to switch to {tierLabel} yet. Choose a payment method to top up 10 generations.", { tierLabel }));

  const picker = window.cssPaymentsCheckout && typeof window.cssPaymentsCheckout.openPicker === "function"
    ? window.cssPaymentsCheckout.openPicker
    : null;
  const pricing = (typeof readPanelBehaviorSettingsLocal === "function"
    ? (readPanelBehaviorSettingsLocal()?.creator_boost || {})
    : {}) || {};
  const unitCents = Math.max(25, Number(pricing.generation_unit_cents || 99) || 99);
  const qty = 10;
  const totalCents = unitCents * qty;

  if (!picker) {
    if (typeof createCreatorBoostCheckout === "function") {
      try {
        await createCreatorBoostCheckout("generation", qty, trigger);
        return true;
      } catch (_err) {
        /* fall through */
      }
    }
    updateStatus(tr("Stripe checkout is not reachable right now. Please try again later or contact support."));
    return false;
  }

  return await new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    picker({
      title: tr("Top up 10 extra generations"),
      subtitle: tr("Required to switch to {tierLabel}", { tierLabel }),
      amountCents: totalCents,
      stripe: {
        label: tr("Pay with card"),
        onSelect: async () => {
          try {
            if (typeof createCreatorBoostCheckout === "function") {
              await createCreatorBoostCheckout("generation", qty, trigger);
              finish(true);
              return;
            }
          } catch (_err) {}
          updateStatus(tr("Stripe checkout is not reachable right now. Please try again later or contact support."));
          finish(false);
        }
      },
      nihaopay: {
        onSelect: (vendor) => {
          try {
            window.cssPaymentsCheckout.startCheckout({
              kind: "purchase",
              vendor,
              amount_cents: totalCents,
              trigger,
              note: `boost:generation:${qty}`
            });
            finish(true);
          } catch (_err) {
            finish(false);
          }
        }
      },
      onCancel: () => {
        updateStatus(tr("Top-up cancelled. You can try again any time."));
        finish(false);
      }
    });
  });
}

async function requestMembershipPlanChange(targetTier, trigger = null, statusNode = null) {
  return requestMembershipPlanChangeModule(targetTier, trigger, statusNode);
}

function getSubscriptionPanelModule() {
  const panel = document.getElementById("subscription-panel");
  return panel instanceof HTMLElement ? panel : null;
}

async function renderSubscriptionPanelModule() {
  const content = document.getElementById("subscription-panel-content");
  if (!(content instanceof HTMLElement)) return false;
  // CSSOS_PHASE2_P2_57E 20260419 — preserve the `panel-body subscription-body`
  // classes declared in index.html. The previous line blew them away on every
  // re-render, which detached the container from the base `.panel-body`
  // flex+overflow rules and killed scroll. Keep the historical marker class at
  // the end for any code that searches for it.
  content.className = "panel-body subscription-body subscription-panel-content";
  if (authState.user && !creatorBoostState.loaded && typeof loadCreatorBoostState === "function") {
    await loadCreatorBoostState().catch(() => null);
  }
  content.innerHTML = buildSubscriptionPanelMarkupModule();
  // CSSOS_WAVE_840 — "账户" hub: API/订阅/积分 三个同主题面板归一成一个 Dock 入口(账户)。
  // 订阅是主视图; 积分(信用奖惩)和 API(密钥/计费)从这条顶部导航进入(它们各自仍是独立面板,
  // 点开即覆盖在上层, 关掉回到账户)。随渲染生成→不被 re-render 擦掉; 用真实事件、不用内联 onclick。
  try {
    const hub = document.createElement("div");
    hub.className = "account-hub-nav";
    hub.innerHTML =
      '<button type="button" class="account-hub-tab is-active" disabled>' + tr("Subscription", "订阅") + "</button>" +
      '<button type="button" class="account-hub-tab" data-hub="credit">' + tr("Credits", "积分") + "</button>" +
      '<button type="button" class="account-hub-tab" data-hub="api">' + tr("API", "API") + "</button>" +
      // CSSOS_WAVE_1107 20260622 — Jing/App Store 5.1.1(v) 拒因(找不到账户删除入口): 账户中枢加
      //   "Account" 标签直达 Profile(删除账户所在), 让审核员/用户从订阅页一步到达删除流程。
      '<button type="button" class="account-hub-tab" data-hub="account">' + tr("Account", "账户") + "</button>";
    content.insertBefore(hub, content.firstChild);
    const _creditBtn = hub.querySelector('[data-hub="credit"]');
    if (_creditBtn) _creditBtn.addEventListener("click", () => {
      if (typeof globalThis.openCreditPanelModule === "function") globalThis.openCreditPanelModule();
      else if (typeof globalThis.handleGlobalAction === "function") globalThis.handleGlobalAction("credit");
    });
    const _apiBtn = hub.querySelector('[data-hub="api"]');
    if (_apiBtn) _apiBtn.addEventListener("click", () => {
      if (typeof globalThis.handleGlobalAction === "function") globalThis.handleGlobalAction("api");
    });
    const _acctBtn = hub.querySelector('[data-hub="account"]');
    if (_acctBtn) _acctBtn.addEventListener("click", () => {
      if (typeof globalThis.handleGlobalAction === "function") globalThis.handleGlobalAction("profile");
    });
  } catch (_hubErr) { /* non-fatal */ }

  // CSSOS_WAVE_1107c 20260622 — Jing「删除入口提一层 + 放正规说明(苹果 5.1.1 要好找)」: 登录用户在
  //   订阅面板(💎 Account 一进来)底部直接看到显眼的「删除账号」区 + 30天清除/7天可恢复说明, 点击
  //   走共享的 cssosRunDeleteAccountFlow(与 Profile 里那颗同一套逻辑)。访客不显。
  try {
    if (authState.user && !content.querySelector("[data-subscription-delete-account]")) {
      const dz = document.createElement("div");
      dz.className = "subscription-account-danger-zone";
      dz.style.cssText = "margin-top:22px;padding-top:16px;border-top:1px solid rgba(255,80,80,0.18);";
      dz.innerHTML =
        // CSSOS_WAVE_1518 — Jing: 单个操作按钮也套胶囊风格(两头半圆 pill + 图标), 全平台统一。
        //   iOS 上此按钮会被 app.ios-subscription-iap-button.js 注入进 Restore/Delete 双段胶囊,
        //   桌面/其它端保持这颗独立圆头胶囊。
        '<button type="button" data-subscription-delete-account ' +
        'style="display:inline-flex;align-items:center;gap:7px;background:transparent;border:1px solid rgba(229,72,77,0.5);color:#e5484d;padding:10px 20px;' +
        'border-radius:999px;font:600 13px/1.2 -apple-system,system-ui,sans-serif;cursor:pointer;">' +
        '<span style="font-size:14px;">🗑</span>' + tr("Delete account", "删除账号") + "</button>" +
        '<div style="margin-top:8px;font-size:11.5px;line-height:1.5;color:rgba(255,255,255,0.55);max-width:520px;">' +
        tr("Permanently delete your account and all generated works. 30-day purge with a 7-day grace window — sign in again within 7 days to cancel.",
           "永久删除你的账号和所有生成的作品。30 天彻底清除,前 7 天内重新登录可取消恢复。") +
        "</div>";
      content.appendChild(dz);
      const _delBtn = dz.querySelector("[data-subscription-delete-account]");
      if (_delBtn) _delBtn.addEventListener("click", () => {
        if (typeof globalThis.cssosRunDeleteAccountFlow === "function") globalThis.cssosRunDeleteAccountFlow(_delBtn);
        else if (typeof globalThis.handleGlobalAction === "function") globalThis.handleGlobalAction("profile");
      });
    }
  } catch (_dzErr) { /* non-fatal */ }
  content.querySelectorAll("[data-subscription-open-plan-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      renderSubscriptionPlanModalModule(String(button.getAttribute("data-target-tier") || "").trim());
    });
  });
  content.querySelectorAll("[data-subscription-direct-tier]").forEach((button) => {
    button.addEventListener("click", async () => {
      const nextTier = String(button.getAttribute("data-subscription-direct-tier") || "").trim();
      if (!nextTier) return;
      await requestMembershipPlanChange(nextTier, button);
    });
  });
  // CSSOS_PHASE2_PAYMENTS 20260419 — NihaoPay entry on the main subscription panel
  // (parallel to the Stripe-backed Change Plan flow). Prompts the user for a vendor
  // and hands off to window.cssPaymentsCheckout with kind="subscription", which
  // creates a payment_intent and redirects to NihaoPay SecurePay. Auto-FX is handled
  // server-side by NihaoPay (USD amount auto-converted at checkout).
  content.querySelectorAll("[data-subscription-panel-nihaopay-vendor]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!authState.user) {
        const msg = tr("Sign in first to subscribe.");
        if (typeof openLoginForCreation === "function") openLoginForCreation(msg);
        else if (typeof showToast === "function") showToast(msg);
        return;
      }
      if (!window.cssPaymentsCheckout || typeof window.cssPaymentsCheckout.startCheckout !== "function") {
        if (typeof showToast === "function") showToast(tr("Payment gateway not ready. Please refresh and try again."));
        return;
      }
      const nextTier = String(button.getAttribute("data-subscription-panel-nihaopay-tier") || "").trim().toLowerCase();
      const vendor = String(button.getAttribute("data-subscription-panel-nihaopay-vendor") || "alipay").trim().toLowerCase();
      const amountCents = Math.max(0, Math.round(Number(button.getAttribute("data-subscription-panel-nihaopay-price") || 0)));
      if (!nextTier || !amountCents) return;
      if (typeof showToast === "function") showToast(tr("Redirecting to the payment page..."));
      await window.cssPaymentsCheckout.startCheckout({
        kind: "subscription",
        vendor,
        amount_cents: amountCents,
        tier: nextTier,
        trigger: button,
        note: `subscription:${nextTier}`
      });
    });
  });
  content.querySelectorAll("[data-subscription-open-api]").forEach((button) => {
    button.addEventListener("click", () => {
      openPanel?.(apiPanel);
      renderApiBillingPanel?.();
    });
  });
  content.querySelectorAll("[data-subscription-open-governance]").forEach((button) => {
    button.addEventListener("click", () => {
      openPanel?.(cssmvPanel);
      renderCssmvGovernancePanel?.();
    });
  });
  content.querySelectorAll("[data-subscription-buy-boost]").forEach((button) => {
    button.addEventListener("click", async () => {
      const kind = String(button.getAttribute("data-subscription-buy-boost") || "").trim();
      const quantity = Math.max(1, Number(button.getAttribute("data-subscription-boost-quantity") || 1) || 1);
      if (!kind) return;
      if (!authState.user) {
        openLoginForCreation?.(tr("Sign in first to purchase Creator Boost."));
        return;
      }
      // CSSOS_WAVE_1513 20260701 — Jing「10 Extra Generations 点了没反应」根治。真凶:
      //   点击确实调到 createCreatorBoostCheckout, 但 /api/cssmv/boosts/checkout/create
      //   失败(多为会话过期 401 / Stripe 临时不可用)时, 旧代码 .catch(()=>null) 把错误
      //   【静默吞掉】→ 表现就是"点了毫无反应"= 死胡同(违反 guided-ux 铁律)。改: 显式
      //   surface 真实原因(401 引导重新登录, 其它给可读错误 + 建议改用支付宝/微信)。
      const _toast = (m) => { try { (globalThis.showToast || globalThis.cssosGuidedToast || function(){})(m); } catch (_e) {} };
      const fn = (typeof createCreatorBoostCheckout === "function")
        ? createCreatorBoostCheckout
        : (typeof globalThis.createCreatorBoostCheckout === "function" ? globalThis.createCreatorBoostCheckout : null);
      if (!fn) { _toast(tr("Checkout isn't ready yet. Please refresh and try again.")); return; }
      try {
        await fn(kind, quantity, button); // 成功会 window.location 跳 Stripe 结账页
        await loadCreatorBoostState?.(true).catch(() => null);
        await renderSubscriptionPanelModule();
      } catch (err) {
        const msg = String((err && err.message) || err || "");
        if (/:401\b/.test(msg) || /AUTH_REQUIRED/i.test(msg)) {
          openLoginForCreation?.(tr("Your session expired. Please sign in again to purchase."));
        } else if (/STRIPE_NOT_CONFIGURED/i.test(msg)) {
          _toast(tr("Card checkout is temporarily unavailable — please try Alipay / WeChat Pay, or try again shortly."));
        } else if (/BOOST_KIND_DISABLED|BOOST_PURCHASE_ADMIN_ONLY/i.test(msg)) {
          _toast(tr("This top-up isn't available for purchase right now."));
        } else if (/Load failed|Failed to fetch|NetworkError/i.test(msg)) {
          _toast(tr("Network hiccup — couldn't reach checkout. Please check your connection and try again."));
        } else {
          _toast(tr("Couldn't open checkout: ") + (msg || tr("unknown error")));
        }
        try { console.warn("[boost-buy] checkout failed:", msg); } catch (_e) {}
      }
    });
  });
  // CSSOS_PHASE2_PAYMENTS 20260419 — NihaoPay entry for Creator Boost (Alipay /
  // WeChat Pay / UnionPay). Routes through the same /api/payments/intents
  // endpoint with kind="purchase"; the note carries the boost kind/quantity so
  // the backend can settle the correct boost bucket after the IPN verifies.
  content.querySelectorAll("[data-subscription-boost-nihaopay-vendor]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!authState.user) {
        const msg = tr("Sign in first to purchase Creator Boost.");
        if (typeof openLoginForCreation === "function") openLoginForCreation(msg);
        else if (typeof showToast === "function") showToast(msg);
        return;
      }
      if (!window.cssPaymentsCheckout || typeof window.cssPaymentsCheckout.startCheckout !== "function") {
        if (typeof showToast === "function") showToast(tr("Payment gateway not ready. Please refresh and try again."));
        return;
      }
      const boostKind = String(button.getAttribute("data-subscription-boost-nihaopay-kind") || "").trim().toLowerCase();
      const vendor = String(button.getAttribute("data-subscription-boost-nihaopay-vendor") || "alipay").trim().toLowerCase();
      const quantity = Math.max(1, Number(button.getAttribute("data-subscription-boost-nihaopay-quantity") || 1) || 1);
      const amountCents = Math.max(0, Math.round(Number(button.getAttribute("data-subscription-boost-nihaopay-price") || 0)));
      if (!boostKind || !amountCents) return;
      if (typeof showToast === "function") showToast(tr("Redirecting to the payment page..."));
      // CSSOS_PHASE2_BOOST_KIND 20260419 — use the new "boost" kind so the
      // checkout skips the target_creator_id guard that was throwing
      // "缺少收款人 / Missing creator" on self-purchase boost rows.
      await window.cssPaymentsCheckout.startCheckout({
        kind: "boost",
        vendor,
        amount_cents: amountCents,
        trigger: button,
        note: `boost:${boostKind}:${quantity}`
      }).catch(() => null);
    });
  });
  content.querySelectorAll("[data-subscription-stripe-topup]").forEach((button) => {
    button.addEventListener("click", async () => {
      const kind = String(button.getAttribute("data-subscription-stripe-topup") || "").trim() || "generation";
      const quantity = Math.max(1, Number(button.getAttribute("data-subscription-boost-quantity") || 10) || 10);
      if (!authState.user) {
        const msg = tr("Sign in first to open Stripe checkout.");
        if (typeof openLoginForCreation === "function") openLoginForCreation(msg);
        else if (typeof showToast === "function") showToast(msg);
        return;
      }
      if (typeof showToast === "function") {
        showToast(tr("Opening Stripe checkout..."));
      }
      if (typeof createCreatorBoostCheckout === "function") {
        try {
          await createCreatorBoostCheckout(kind, quantity, button);
        } catch (_err) {
          // CSSOS_WAVE_588 — 引导式: 结账打不开 → [重试](重触该按钮)。
          if (typeof globalThis.cssosToastRetry === "function")
            globalThis.cssosToastRetry(tr("Stripe checkout failed to open.", "Stripe 结账打不开。"), function () { try { button && button.click && button.click(); } catch (_e) {} });
          else if (typeof showToast === "function") showToast(tr("Stripe checkout failed to open. Please try again."));
        }
      }
    });
  });
  return true;
}

function isSubscriptionPanelOffscreenModule(panel) {
  if (!(panel instanceof HTMLElement)) return true;
  const rect = panel.getBoundingClientRect?.();
  if (!rect) return true;
  if (rect.width < 220 || rect.height < 180) return true;
  return (
    rect.right < 120 ||
    rect.bottom < 120 ||
    rect.left > window.innerWidth - 120 ||
    rect.top > window.innerHeight - 120
  );
}

function normalizeSubscriptionPanelLayoutModule(panel) {
  if (!(panel instanceof HTMLElement)) return false;
  if (typeof clearStoredPanelLayout === "function") {
    clearStoredPanelLayout(panel.id);
  }
  panel.dataset.userMoved = "false";
  panel.dataset.positioned = "false";
  panel.dataset.minimized = "false";
  panel.classList.remove("hidden");
  panel.style.left = "";
  panel.style.top = "";
  panel.style.transform = "";
  panel.style.width = "";
  panel.style.height = "";
  if (typeof placePanelFromTopLeft === "function") {
    placePanelFromTopLeft(panel);
  }
  if (typeof clampPanelInViewport === "function") {
    clampPanelInViewport(panel);
  }
  return true;
}

/* CSSOS_SUBSCRIPTION_CLOSE_FIX 20260506 — Jing
 * The shared panel-bar handler in app.panel-shell-actions.js binds
 * once on init via panel.dataset.panelBarActionsBound. For reasons
 * still unclear (possibly the panel's hidden state at first paint, or
 * the .panel-actions getting re-laid-out by bringPanelToFrontBridge),
 * the close/minimize/maximize buttons stopped responding for this
 * panel specifically. Defensive direct binding below — runs on every
 * open and short-circuits via dataset flag so it only attaches once. */
function ensureSubscriptionPanelBarBindings(panel) {
  if (!(panel instanceof HTMLElement)) return;
  if (panel.dataset.cssosSubBarBound === "1") return;
  panel.dataset.cssosSubBarBound = "1";
  const actions = panel.querySelector(".panel-actions");
  if (!actions) return;
  // Bind directly to each button by aria-label so we don't depend on
  // the data-action being set by the shared normalizer.
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

function openSubscriptionPanelModule() {
  const panel = getSubscriptionPanelModule();
  if (!(panel instanceof HTMLElement)) return false;
  openPanel?.(panel, { focus: true, layout: true });
  if (isSubscriptionPanelOffscreenModule(panel)) {
    normalizeSubscriptionPanelLayoutModule(panel);
    openPanel?.(panel, { focus: true, layout: true });
  }
  panel.classList.remove("hidden");
  panel.dataset.minimized = "false";
  globalThis.focusPanelBridge?.(panel);
  globalThis.bringPanelToFrontBridge?.(panel, { repeatPasses: 3 });
  ensureSubscriptionPanelBarBindings(panel);
  void renderSubscriptionPanelModule();
  return true;
}

Object.assign(globalThis, {
  buildSubscriptionPanelMarkupModule,
  ensureSubscriptionPlanModalModule,
  getSubscriptionPanelModule,
  isSubscriptionPanelOffscreenModule,
  normalizeSubscriptionPanelLayoutModule,
  renderSubscriptionPlanModalModule,
  renderSubscriptionPanelModule,
  requestMembershipPlanChangeModule,
  openSubscriptionPanelModule
});

// CSSOS_PHASE2_I18N_SUBSCRIPTION_REFLOW 20260419
// When the i18n runtime finishes fetching a batch of async translations it
// dispatches `cssos:i18n-translation-ready` on `window`. We use that to
// re-render the subscription panel so strings that returned English during
// the first paint (cache miss) flip to the translated copy. The handler is
// a no-op when the panel is hidden/minimised.
(function wireSubscriptionI18nReflow() {
  let reflowTimer = null;
  function scheduleReflow() {
    if (reflowTimer) return;
    reflowTimer = setTimeout(() => {
      reflowTimer = null;
      try {
        const panel = document.getElementById("subscription-panel");
        if (!(panel instanceof HTMLElement)) return;
        if (panel.classList.contains("hidden")) return;
        if (panel.dataset.minimized === "true") return;
        void renderSubscriptionPanelModule();
      } catch (_) { /* ignore */ }
    }, 60);
  }
  try {
    window.addEventListener("cssos:i18n-translation-ready", scheduleReflow, { passive: true });
    window.addEventListener("cssos:locale-changed", scheduleReflow, { passive: true });
  } catch (_) { /* SSR or frozen env — ignore */ }
})();
