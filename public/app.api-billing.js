if (!globalThis.authState) {
  globalThis.authState = {
    user: null,
    role: "guest",
    tier: "guest",
    linkedProviders: [],
    loginProvider: null,
    authDiagnostics: null,
    sessionDays: 90,
    sessionExpiresAt: null,
    permissionSnapshot: null
  };
}
if (!globalThis.creatorBoostState) {
  globalThis.creatorBoostState = {
    loaded: false,
    loading: false,
    payload: { entitlements: {} }
  };
}

function renderApiBillingPanelModule() {
  const apiBody = apiPanel ? apiPanel.querySelector(".api-body") : null;
  if (!apiBody || !apiCreditBalance) return;
  const canUseBilling = hasPanelPermission("api.billing.view");
  const canManageBilling = hasPanelPermission("api.billing.manage");

  const guestNoticeClass = "api-guest-notice";
  let guestNotice = apiBody.querySelector(`.${guestNoticeClass}`);
  if (!canUseBilling) {
    if (!guestNotice) {
      guestNotice = document.createElement("div");
      guestNotice.className = guestNoticeClass;
      apiBody.prepend(guestNotice);
    }
    guestNotice.innerHTML = `
      <strong>${loginCopy("Sign in to access billing controls.")}</strong>
      <div>${loginCopy("You can still browse API docs as a guest.")}</div>
    `;
  } else if (guestNotice) {
    guestNotice.remove();
  }
  renderApiBillingCommerceSections(apiBody, { canUseBilling, canManageBilling });
}

function renderApiBillingPanel() {
  renderApiBillingPanelModule();
}

function seedCinemaBookingFormModule(apiBody) {
  if (!(apiBody instanceof Element)) return;
  const titleField = apiBody.querySelector('[data-cinema-booking="title"]');
  const durationField = apiBody.querySelector('[data-cinema-booking="duration"]');
  const briefField = apiBody.querySelector('[data-cinema-booking="brief"]');
  const budgetField = apiBody.querySelector('[data-cinema-booking="budget"]');
  const explicitCinemaText = [
    typeof hasCreationFieldTouched === "function" && hasCreationFieldTouched("prompt") ? creationState.prompt : "",
    typeof hasCreationFieldTouched === "function" && hasCreationFieldTouched("inspirationNotes") ? creationState.inspirationNotes : ""
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  const shouldSeedCinemaBrief =
    Number(creationState.duration || 0) > 480 ||
    /(cinema-grade|feature film|feature-length|movie project|film project|院线|电影项目|影视长片|长片|定制电影)/.test(explicitCinemaText);
  if (titleField instanceof HTMLInputElement && !titleField.value.trim()) {
    titleField.value = String(titleInput?.value || state.title || "").trim().slice(0, 160);
  }
  if (durationField instanceof HTMLInputElement && !durationField.value.trim()) {
    const creationDurationSec = Math.max(0, Number(creationState.duration || 0) || 0);
    const suggestedMinutes = creationDurationSec > 0 ? Math.max(180, Math.min(1440, Math.round(creationDurationSec / 60))) : 180;
    durationField.value = String(suggestedMinutes);
  }
  if (briefField instanceof HTMLTextAreaElement && !briefField.value.trim() && shouldSeedCinemaBrief) {
    const summary = [creationState.prompt, creationState.inspirationNotes, lyricsInput?.value]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join("\n\n");
    briefField.value = summary.slice(0, 1200);
  }
  if (budgetField instanceof HTMLInputElement && !budgetField.value.trim()) {
    budgetField.value = "5000000";
  }
}

function seedCinemaBookingForm(apiBody) {
  seedCinemaBookingFormModule(apiBody);
}

async function submitCinemaBookingRequestModule(trigger = null) {
  const apiBody = apiPanel ? apiPanel.querySelector(".api-body") : null;
  if (!(apiBody instanceof Element)) return false;
  if (!authState.user) {
    openLoginForCreation(loginCopy("Sign in first to submit a cinema-grade booking request."));
    return false;
  }
  const titleField = apiBody.querySelector('[data-cinema-booking="title"]');
  const durationField = apiBody.querySelector('[data-cinema-booking="duration"]');
  const briefField = apiBody.querySelector('[data-cinema-booking="brief"]');
  const emailField = apiBody.querySelector('[data-cinema-booking="email"]');
  const handleField = apiBody.querySelector('[data-cinema-booking="handle"]');
  const budgetField = apiBody.querySelector('[data-cinema-booking="budget"]');
  const statusField = apiBody.querySelector('[data-cinema-booking-status]');
  const title = String(titleField?.value || "").trim().slice(0, 160);
  const brief = String(briefField?.value || "").trim().slice(0, 4000);
  const requestedMinutes = Math.max(1, Math.min(1440, Number(durationField?.value || 180) || 180));
  const durationSec = Math.round(requestedMinutes * 60);
  const budgetUsd = Math.max(0, Number(budgetField?.value || 0) || 0);
  const payload = {
    project_title: title,
    requested_mode: "cinema",
    requested_duration_sec: durationSec,
    contact_email: String(emailField?.value || authState.user?.email || "").trim(),
    contact_handle: String(handleField?.value || "").trim(),
    budget_cents: Math.round(budgetUsd * 100),
    brief,
    needs_contract: true
  };
  if (!payload.project_title || !payload.brief) {
    if (statusField instanceof HTMLElement) {
      statusField.textContent = loginCopy("Please fill in project title and booking brief first.");
    }
    return false;
  }
  try {
    setButtonBusy(trigger, true);
    if (statusField instanceof HTMLElement) {
      statusField.textContent = loginCopy("Submitting booking request...");
    }
    const res = await fetch("/api/cinema/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    const raw = await res.json().catch(() => null);
    const data = getApiData(raw);
    if (!res.ok || raw?.ok === false || !data?.booking) {
      throw new Error(raw?.code || `cinema_booking_failed:${res.status}`);
    }
    if (statusField instanceof HTMLElement) {
      statusField.textContent = loginCopy("Cinema booking submitted. The studio can now follow up with scoping, contract, and scheduling.");
    }
    await loadWatchCommerce(true).catch(() => null);
    renderApiBillingPanel();
    showToast(loginCopy("Cinema booking submitted."));
    return true;
  } catch (_err) {
    if (statusField instanceof HTMLElement) {
      statusField.textContent = loginCopy("Cinema booking submit failed. Please try again.");
    }
    return false;
  } finally {
    setButtonBusy(trigger, false);
  }
}

async function submitCinemaBookingRequest(trigger = null) {
  return submitCinemaBookingRequestModule(trigger);
}

async function fetchBillingStatusModule() {
  try {
    const res = await fetch("/api/billing/status", { credentials: "include" });
    if (res.ok) {
      const raw = await res.json();
      const data = getApiData(raw);
      billingState.tier = data.tier || billingState.tier;
      billingState.remaining = data.remaining;
      billingState.limit = data.limit;
      billingState.balance_cents = data.balance_cents ?? billingState.balance_cents ?? 0;
      billingState.pending_balance_cents = data.pending_balance_cents ?? billingState.pending_balance_cents ?? 0;
      billingState.pending_balance_release_at = data.pending_balance_release_at ?? billingState.pending_balance_release_at ?? null;
      billingState.latest_membership_change = data.latest_membership_change ?? billingState.latest_membership_change ?? null;
      billingState.recent_fund_holds = Array.isArray(data.recent_fund_holds) ? data.recent_fund_holds : [];
      billingState.monthly_limit_cents = data.monthly_limit_cents ?? billingState.monthly_limit_cents ?? 0;
      billingState.auto_recharge = data.auto_recharge ?? billingState.auto_recharge ?? null;
      renderApiBillingPanel();
    }
  } catch (_err) {
    // ignore
  }
}

async function fetchBillingStatus() {
  return fetchBillingStatusModule();
}

function consumeLocalUsageModule() {
  const tier = getAccessTier();
  if (tier === "admin" || tier === "vip") {
    return true;
  }
  const monthKey = new Date().toISOString().slice(0, 7);
  const raw = localStorage.getItem(getUsageKey());
  const data = raw ? JSON.parse(raw) : { month: monthKey, count: 0 };
  if (data.month !== monthKey) {
    data.month = monthKey;
    data.count = 0;
  }
  const limit = getDailyLimit(tier);
  if (limit !== Infinity && data.count >= limit) {
    const tierLabel = describeMembershipTier(tier);
    showToast(loginCopy(`${tierLabel} monthly limit reached.`));
    return false;
  }
  data.count += 1;
  localStorage.setItem(getUsageKey(), JSON.stringify(data));
  return true;
}

function consumeLocalUsage() {
  return consumeLocalUsageModule();
}

async function consumeGenerationModule() {
  const derivedDurationSec = resolveCreationDurationValue();
  const result = await consumeBillableAction("video_generate", {
    meta: {
      source: "legacy_consume_generation",
      source_run_id: getMicJobId(),
      title: String(titleInput?.value || state.title || "").trim().slice(0, 120),
      work_type: normalizeWorkTypeClient(creationState.workType || "single"),
      duration_sec:
        Number.isFinite(Number(derivedDurationSec)) && Number(derivedDurationSec) > 0
          ? Number(derivedDurationSec)
          : null
    }
  });
  if (!result) return false;
  billingState.tier = result.tier || billingState.tier;
  billingState.remaining = result.remaining ?? null;
  billingState.limit = result.limit ?? null;
  return true;
}

async function consumeGeneration() {
  return consumeGenerationModule();
}

function openLoginForCreationModule(message) {
  safeShowToast(message || loginCopy("Sign in to start creating."));
  if (loginPanel) openPanel(loginPanel);
}

function showMembershipUpsellModule(targetTier, reason) {
  const tierLabel = describeMembershipTier(targetTier);
  const message = reason
    ? `${reason} ${loginCopy(`Upgrade to ${tierLabel} to continue.`)}`
    : loginCopy(`Upgrade to ${tierLabel} to continue.`);
  safeShowToast(message);
  setTimeout(() => {
    openSubscriptionPanelModule?.();
  }, 120);
}

function showCreatorBoostPromptModule(kind, count) {
  const countLabel = Number(count || 0);
  const panelParameterCenter = t("settings.panel.parameterCenter");
  if (kind === "language") {
    safeShowToast(
      loginCopy(
        `This creation currently includes ${countLabel} lyric languages. The plan includes 1 language by default; each extra language is charged as a one-time Creator Boost. Open ${panelParameterCenter} if you want to buy it.`
      )
    );
    setTimeout(() => {
      openSubscriptionPanelModule?.();
    }, 120);
    return;
  }
  safeShowToast(
    loginCopy(
      `This creation currently includes ${countLabel} voice lanes. The plan includes 1 voice lane by default; each extra voice lane is charged as a one-time Creator Boost. Open ${panelParameterCenter} if you want to buy it.`
    )
  );
  setTimeout(() => {
    openSubscriptionPanelModule?.();
  }, 120);
}

function showCinemaBookingPromptModule() {
  safeShowToast(
    loginCopy(
      "Cinema-grade generation now opens the booking intake form in the API panel."
    )
  );
  if (apiPanel) {
    openPanel(apiPanel);
    renderApiBillingPanel();
    const apiBody = apiPanel.querySelector(".api-body");
    seedCinemaBookingForm(apiBody);
    const bookingCard = apiBody?.querySelector(".api-cinema-booking-card");
    bookingCard?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }
}

function openLoginForCreation(message) {
  openLoginForCreationModule(message);
}

function showMembershipUpsell(targetTier, reason) {
  showMembershipUpsellModule(targetTier, reason);
}

function showCreatorBoostPrompt(kind, count) {
  showCreatorBoostPromptModule(kind, count);
}

async function showGenerationBoostPromptModule(tier = getAccessTier(), result = null) {
  const pricing = readPanelBehaviorSettingsLocal()?.creator_boost || {};
  const unitCents = Math.max(25, Number(pricing.generation_unit_cents || 99) || 99);
  const recommendedQuantity =
    Math.max(1, Number(result?.topup_recommended_quantity || (tier === "starter" ? 10 : 20)) || 1);
  const totalCents = unitCents * recommendedQuantity;
  const totalLabel = formatUsdFromCents(totalCents, "$0.00");
  const unitLabel = formatUsdFromCents(unitCents, "$0.00");

  const picker = window.cssPaymentsCheckout && typeof window.cssPaymentsCheckout.openPicker === "function"
    ? window.cssPaymentsCheckout.openPicker
    : null;
  if (!picker) {
    // fallback — keep legacy confirm path if helper is missing
    const confirmed = window.confirm(
      loginCopy(
        `Your included monthly generations are used up. Temporary top-up is ${unitLabel} per extra generation. Open checkout for ${recommendedQuantity} extra generations (${totalLabel}) now?`
      )
    );
    if (!confirmed) return false;
    if (typeof createCreatorBoostCheckout === "function") {
      await createCreatorBoostCheckout("generation", recommendedQuantity, null);
      return true;
    }
    openPanel?.(subscriptionPanel);
    return false;
  }

  return await new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    picker({
      title: loginCopy(`Buy ${recommendedQuantity} extra generations`),
      subtitle: `${totalLabel} (${unitLabel} × ${recommendedQuantity})`,
      amountCents: totalCents,
      stripe: {
        label: loginCopy("Pay with card"),
        onSelect: async () => {
          try {
            if (typeof createCreatorBoostCheckout === "function") {
              await createCreatorBoostCheckout("generation", recommendedQuantity, null);
              finish(true);
              return;
            }
            openPanel?.(subscriptionPanel);
          } catch (_e) {}
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
              note: `boost:generation:${recommendedQuantity}`
            });
            finish(true);
          } catch (_e) {
            finish(false);
          }
        }
      },
      onCancel: () => finish(false)
    });
  });
}

function showCinemaBookingPrompt() {
  showCinemaBookingPromptModule();
}

function getCreatorBoostAvailabilityModule() {
  const payload = creatorBoostState.payload || {};
  const entitlements = payload?.entitlements || {};
  return {
    generation: Math.max(0, Number(entitlements?.generation?.available || 0)),
    language: Math.max(0, Number(entitlements?.language?.available || 0)),
    voice: Math.max(0, Number(entitlements?.voice?.available || 0)),
    thumbnail: Math.max(0, Number(entitlements?.thumbnail?.available || 0)),
    preview_video: Math.max(0, Number(entitlements?.preview_video?.available || 0)),
    background_job: Math.max(0, Number(entitlements?.background_job?.available || 0))
  };
}

function getCreatorBoostAvailability() {
  return getCreatorBoostAvailabilityModule();
}

function getBillableActionPricingModule() {
  const billing = readPanelBehaviorSettingsLocal().billing_actions || {};
  const boosts = readPanelBehaviorSettingsLocal().creator_boost || {};
  return {
    lyrics_generate: Math.max(0, Number(billing.lyrics_generate_cents || 20)),
    music_generate: Math.max(0, Number(billing.music_generate_cents || 40)),
    video_generate: Math.max(0, Number(billing.video_generate_cents || 60)),
    thumbnail_regenerate: Math.max(0, Number(boosts.thumbnail_unit_cents || 79)),
    preview_video_regenerate: Math.max(0, Number(boosts.preview_video_unit_cents || 249)),
    extra_generation: Math.max(0, Number(boosts.generation_unit_cents || 99)),
    multi_language: Math.max(0, Number(boosts.language_unit_cents || 300)),
    multi_voice: Math.max(0, Number(boosts.voice_unit_cents || 500)),
    enterprise_route: Math.max(0, Number(billing.enterprise_route_cents || 5)),
    cinema_booking: Math.max(0, Number(billing.cinema_booking_cents || 0))
  };
}

function getBillableActionPricing() {
  return getBillableActionPricingModule();
}

function estimateCreationEconomicsModule() {
  const workType = normalizeWorkTypeClient(creationState.workType || "single");
  const durationSec = Math.max(24, Math.min(1800, Number(resolveCreationDurationValue() || 24) || 24));
  const counts = getCreationSelectionCounts();
  const typeMultiplier = workType === "opera" ? 3.2 : workType === "triptych" ? 2.1 : 1;
  const computeUnits = Math.max(1, Math.round((durationSec / 30) * typeMultiplier * (1 + (counts.languageCount - 1) * 0.35 + (counts.voiceLaneCount - 1) * 0.45)));
  const computeCostCents = Math.max(1, Math.round(computeUnits * 2));
  const pricingDefaults = workTypePricingDefaults(workType);
  return {
    computeUnits,
    computeCostCents,
    suggestedListenPriceCents: Math.max(pricingDefaults.listenCents, Math.round(computeCostCents * 2.4)),
    suggestedBuyoutPriceCents: Math.max(pricingDefaults.buyoutCents, Math.round(computeCostCents * 8.5))
  };
}

function estimateCreationEconomics() {
  return estimateCreationEconomicsModule();
}

async function consumeBillableActionModule(actionKey, options = {}) {
  const normalized = String(actionKey || "").trim().toLowerCase();
  if (!normalized) return false;
  if (!authState.user) {
    openLoginForCreation(loginCopy("Sign in first to use billable creation actions."));
    return false;
  }
  try {
    const res = await fetch("/api/billing/actions/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action_key: normalized,
        units: Math.max(1, Number(options.units || 1) || 1),
        meta: options.meta && typeof options.meta === "object" ? options.meta : {}
      })
    });
    const raw = await res.json().catch(() => null);
    const data = getApiData(raw);
    if (!res.ok || raw?.ok === false) {
      throw new Error(raw?.code || `billable_action_failed:${res.status}`);
    }
    if (data?.allowed === false) {
      const tier = normalizeAccessTier(data?.tier || getAccessTier());
      if (normalized === "video_generate") {
        if (tier === "free") {
          showToast(loginCopy("Free membership includes 3 creations per month. Upgrade to Starter or Pro to continue."));
        } else if (tier === "starter") {
          await showGenerationBoostPromptModule(tier, data);
        } else if (tier === "pro") {
          await showGenerationBoostPromptModule(tier, data);
        } else if (tier === "studio") {
          await showGenerationBoostPromptModule(tier, data);
        } else {
          showToast(t("billing.limitReached") || "Monthly limit reached");
        }
      } else if (normalized === "enterprise_route") {
        showToast(loginCopy("Enterprise API action is blocked by the current enterprise billing policy."));
      } else {
        showToast(loginCopy("This billable action is temporarily unavailable."));
      }
      return false;
    }
    return data || true;
  } catch (_err) {
    showToast(loginCopy("Unable to authorize this billable action right now."));
    return false;
  }
}

async function consumeBillableAction(actionKey, options = {}) {
  return consumeBillableActionModule(actionKey, options);
}

function enforceCreationCapabilityModule(options = {}) {
  const tier = getAccessTier();
  const preset = getMembershipPreset(tier);
  const requestedWorkType = normalizeWorkTypeClient(options.workType || creationState.workType || "single");
  const requestedDurationSec = Math.max(0, Number(options.durationSec ?? creationState.duration ?? 0));
  const requestedMode = String(options.mode || "").trim().toLowerCase();
  const allowCinemaBookingPrompt = options.allowCinemaBookingPrompt === true || requestedMode === "cinema";
  const { languageCount, voiceLaneCount } = getCreationSelectionCounts();
  const boostAvailability = getCreatorBoostAvailability();
  const advancedFieldsRequested = [
    creationState.licensedStylePack,
    creationState.externalAudioAdapter,
    creationState.sectionForm,
    creationState.expressionCcBias,
    creationState.voicingRegister
  ].some((value) => String(value || "").trim());
  const userExplicitCinemaText = [
    hasCreationFieldTouched("prompt") ? options.prompt || creationState.prompt : "",
    hasCreationFieldTouched("inspirationNotes") ? creationState.inspirationNotes : ""
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  const cinemaRequested =
    requestedMode === "cinema" ||
    requestedDurationSec > 480 ||
    /(cinema-grade|feature film|feature-length|movie project|film project|院线|电影项目|影视长片|长片|定制电影)/.test(userExplicitCinemaText);

  if (!authState.user) {
    if (!options.skipLoginPrompt) {
      openLoginForCreation(options.guestMessage || loginCopy("Guests can browse, but sign in is required before generating works."));
    }
    return { ok: false, reason: "login_required", preset, tier };
  }

  if (requestedDurationSec > preset.maxDurationSec) {
    if (tier === "free") {
      showMembershipUpsell("starter", loginCopy("Basic members can only generate videos up to 3 minutes."));
    } else if (tier === "starter") {
      showMembershipUpsell("pro", loginCopy("Starter members can only generate videos up to 6 minutes and 720p."));
    } else {
      safeShowToast(loginCopy("The requested duration exceeds your current plan."));
    }
    return { ok: false, reason: "duration_limit", preset, tier };
  }

  if (!preset.allowStructuredWorks && requestedWorkType !== "single") {
    showMembershipUpsell(
      "pro",
      requestedWorkType === "opera"
        ? loginCopy("Opera generation is available from Pro and above.")
        : loginCopy("Triptych generation is available from Pro and above.")
    );
    return { ok: false, reason: "work_type_limit", preset, tier };
  }

  if (languageCount > preset.maxIncludedLanguages) {
    const extraLanguages = Math.max(0, languageCount - preset.maxIncludedLanguages);
    if (boostAvailability.language < extraLanguages) {
      showCreatorBoostPrompt("language", languageCount);
      return { ok: false, reason: "creator_boost_language", preset, tier, missing: extraLanguages - boostAvailability.language };
    }
  }

  if (voiceLaneCount > preset.maxIncludedVoiceLanes) {
    const extraVoices = Math.max(0, voiceLaneCount - preset.maxIncludedVoiceLanes);
    if (boostAvailability.voice < extraVoices) {
      showCreatorBoostPrompt("voice", voiceLaneCount);
      return { ok: false, reason: "creator_boost_voice", preset, tier, missing: extraVoices - boostAvailability.voice };
    }
  }

  if (advancedFieldsRequested && !preset.allowAdvancedSettings) {
    showMembershipUpsell("pro", loginCopy("These advanced creation controls are available from Pro and above."));
    return { ok: false, reason: "advanced_settings_limit", preset, tier };
  }

  if (cinemaRequested && allowCinemaBookingPrompt) {
    showCinemaBookingPrompt();
    return { ok: false, reason: "cinema_booking", preset, tier };
  }

  return { ok: true, preset, tier };
}

function enforceCreationCapability(options = {}) {
  return enforceCreationCapabilityModule(options);
}

function normalizeAccessTierModule(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "free") return "free";
  if (raw === "starter") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "studio") return "studio";
  if (raw === "enterprise") return "enterprise";
  if (raw === "vip") return "vip";
  if (raw === "admin") return "admin";
  return "guest";
}

function getUsageKeyModule() {
  const id = authState.user?.id || "guest";
  return `cssos.usage.${id}`;
}

function getUsageKey() {
  return getUsageKeyModule();
}

function getAccessTierModule() {
  const email = String(authState.user?.email || "").trim().toLowerCase();
  if (email && SYSTEM_ADMIN_EMAILS.has(email)) return "admin";
  if (authState.user) {
    const explicitTier = normalizeAccessTier(authState.tier || authState.role);
    return explicitTier === "guest" ? "free" : explicitTier;
  }
  return "guest";
}

function getAccessTier() {
  return getAccessTierModule();
}

function normalizeAccessTier(value) {
  return normalizeAccessTierModule(value);
}

function isPaidMemberTierModule(tier = getAccessTier()) {
  return ["starter", "pro", "studio", "enterprise", "vip", "admin"].includes(normalizeAccessTier(tier));
}

function isPaidMemberTier(tier = getAccessTier()) {
  return isPaidMemberTierModule(tier);
}

function isVipOrAdminTierModule(tier = getAccessTier()) {
  return ["vip", "admin"].includes(normalizeAccessTier(tier));
}

function isVipOrAdminTier(tier = getAccessTier()) {
  return isVipOrAdminTierModule(tier);
}

function getDailyLimitModule(role) {
  const tier = normalizeAccessTier(role);
  const preset = getMembershipPreset(tier);
  return preset.monthlyGenerationLimit ?? DAILY_LIMITS[tier] ?? DAILY_LIMITS.guest;
}

function getDailyLimit(role) {
  return getDailyLimitModule(role);
}

function getMembershipPresetModule(tier = getAccessTier()) {
  const normalized = normalizeAccessTier(tier);
  const behavior = readPanelBehaviorSettingsLocal();
  if (normalized === "admin") {
    return {
      tier: normalized,
      monthlyGenerationLimit: null,
      maxDurationSec: 1800,
      maxResolution: "4k",
      allowStructuredWorks: true,
      allowThumbnailRegenerate: true,
      allowLoopThumbnail: true,
      watermark: "none",
      queuePriority: "admin_override",
      maxIncludedLanguages: Infinity,
      maxIncludedVoiceLanes: Infinity,
      allowAdvancedSettings: true,
      allowCinemaMode: true,
      cinemaRequiresBooking: false,
      canSellWorks: true,
      canUseBackgroundJobs: true,
      backgroundJobLimit: null,
      backgroundConcurrentJobLimit: 8
    };
  }
  if (normalized === "vip") {
    return {
      tier: normalized,
      monthlyGenerationLimit: null,
      maxDurationSec: 1800,
      maxResolution: "4k",
      allowStructuredWorks: true,
      allowThumbnailRegenerate: true,
      allowLoopThumbnail: true,
      watermark: "none",
      queuePriority: "vip_private",
      maxIncludedLanguages: Infinity,
      maxIncludedVoiceLanes: Infinity,
      allowAdvancedSettings: true,
      allowCinemaMode: true,
      cinemaRequiresBooking: false,
      canSellWorks: true,
      canUseBackgroundJobs: true,
      backgroundJobLimit: 24,
      backgroundConcurrentJobLimit: 6
    };
  }
  if (normalized === "pro") {
    return {
      tier: normalized,
      monthlyGenerationLimit: behavior.membership.pro_monthly_limit,
      maxDurationSec: 480,
      maxResolution: "1080p",
      allowStructuredWorks: true,
      allowThumbnailRegenerate: true,
      allowLoopThumbnail: true,
      watermark: "custom_or_none",
      queuePriority: "pro_pipeline",
      maxIncludedLanguages: 1,
      maxIncludedVoiceLanes: 1,
      allowAdvancedSettings: true,
      allowCinemaMode: false,
      cinemaRequiresBooking: true,
      canSellWorks: true,
      canUseBackgroundJobs: true,
      backgroundJobLimit: 2,
      backgroundConcurrentJobLimit: 1
    };
  }
  if (normalized === "studio") {
    return {
      tier: normalized,
      monthlyGenerationLimit: behavior.membership.studio_monthly_limit,
      maxDurationSec: 900,
      maxResolution: "1440p",
      allowStructuredWorks: true,
      allowThumbnailRegenerate: true,
      allowLoopThumbnail: true,
      watermark: "custom_or_none",
      queuePriority: "studio_pipeline",
      maxIncludedLanguages: 1 + Number(behavior.creator_boost.studio_includes_extra_languages || 0),
      maxIncludedVoiceLanes: 1 + Number(behavior.creator_boost.studio_includes_extra_voices || 0),
      allowAdvancedSettings: true,
      allowCinemaMode: false,
      cinemaRequiresBooking: true,
      canSellWorks: true,
      canUseBackgroundJobs: true,
      backgroundJobLimit: 6,
      backgroundConcurrentJobLimit: 2
    };
  }
  if (normalized === "enterprise") {
    return {
      tier: normalized,
      monthlyGenerationLimit: Number(behavior.membership.enterprise_monthly_limit || 0) > 0 ? Number(behavior.membership.enterprise_monthly_limit) : null,
      maxDurationSec: 1800,
      maxResolution: "4k",
      allowStructuredWorks: true,
      allowThumbnailRegenerate: true,
      allowLoopThumbnail: true,
      watermark: "custom_or_none",
      queuePriority: "enterprise_dedicated",
      maxIncludedLanguages: 1 + Number(behavior.creator_boost.enterprise_includes_extra_languages || 0),
      maxIncludedVoiceLanes: 1 + Number(behavior.creator_boost.enterprise_includes_extra_voices || 0),
      allowAdvancedSettings: true,
      allowCinemaMode: true,
      cinemaRequiresBooking: false,
      canSellWorks: true,
      canUseBackgroundJobs: true,
      backgroundJobLimit: 20,
      backgroundConcurrentJobLimit: 4
    };
  }
  if (normalized === "starter") {
    return {
      tier: normalized,
      monthlyGenerationLimit: behavior.membership.starter_monthly_limit,
      maxDurationSec: 360,
      maxResolution: "720p",
      allowStructuredWorks: false,
      allowThumbnailRegenerate: false,
      allowLoopThumbnail: false,
      watermark: "default",
      queuePriority: "starter_paid",
      maxIncludedLanguages: 1,
      maxIncludedVoiceLanes: 1,
      allowAdvancedSettings: false,
      allowCinemaMode: false,
      cinemaRequiresBooking: true,
      canSellWorks: true,
      canUseBackgroundJobs: false,
      backgroundJobLimit: 0,
      backgroundConcurrentJobLimit: 0
    };
  }
  if (normalized === "free") {
    return {
      tier: normalized,
      monthlyGenerationLimit: 3,
      maxDurationSec: 180,
      maxResolution: "standard",
      allowStructuredWorks: false,
      allowThumbnailRegenerate: false,
      allowLoopThumbnail: false,
      watermark: "default",
      queuePriority: "free_standard",
      maxIncludedLanguages: 1,
      maxIncludedVoiceLanes: 1,
      allowAdvancedSettings: false,
      allowCinemaMode: false,
      cinemaRequiresBooking: true,
      canSellWorks: false,
      canUseBackgroundJobs: false,
      backgroundJobLimit: 0,
      backgroundConcurrentJobLimit: 0
    };
  }
  return {
    tier: "guest",
    monthlyGenerationLimit: 0,
    maxDurationSec: 0,
    maxResolution: "none",
    allowStructuredWorks: false,
    allowThumbnailRegenerate: false,
    allowLoopThumbnail: false,
    watermark: "default",
    queuePriority: "guest_preview",
    maxIncludedLanguages: 0,
    maxIncludedVoiceLanes: 0,
    allowAdvancedSettings: false,
    allowCinemaMode: false,
    cinemaRequiresBooking: true,
    canSellWorks: false,
    canUseBackgroundJobs: false,
    backgroundJobLimit: 0,
    backgroundConcurrentJobLimit: 0
  };
}

function getMembershipPreset(tier = getAccessTier()) {
  return getMembershipPresetModule(tier);
}

function describeMembershipTierModule(tier = getAccessTier()) {
  const normalized = normalizeAccessTier(tier);
  if (normalized === "free") return loginCopy("Basic");
  if (normalized === "starter") return loginCopy("Starter");
  if (normalized === "pro") return loginCopy("Pro");
  if (normalized === "studio") return loginCopy("Studio");
  if (normalized === "enterprise") return loginCopy("Enterprise");
  if (normalized === "vip") return "VIP";
  if (normalized === "admin") return loginCopy("Admin");
  return loginCopy("Guest");
}

function describeMembershipTier(tier = getAccessTier()) {
  return describeMembershipTierModule(tier);
}

function getCreationSelectionCountsModule() {
  const languageParts = globalThis.getSelectedCreationLanguages?.() || [];
  const voiceTracks = globalThis.getSelectedCreationVoiceTracks?.() || [];
  return {
    languageCount: Math.max(1, languageParts.length || 1),
    voiceLaneCount: Math.min(Math.max(1, voiceTracks.length || 1), 6)
  };
}

function getCreationSelectionCounts() {
  return getCreationSelectionCountsModule();
}

function permissionPromptModule(scope) {
  const normalized = String(scope || "").trim().toLowerCase();
  const tier = getAccessTier();
  if (normalized === "seller.view" || normalized === "works.sell" || normalized === "works.payout" || normalized === "works.price.edit" || normalized === "works.type.edit" || normalized === "works.visibility.edit" || normalized === "seller.payout") {
    return isLoggedInUser()
      ? loginCopy("Upgrade to a paid membership to list works and use seller tools.")
      : loginCopy("Sign in first, then upgrade to a paid membership to sell works.");
  }
  if (normalized === "works.thumbnail.regen" || normalized === "works.preview_video.regen") {
    return isLoggedInUser()
      ? loginCopy("This action is billed per regeneration through Creator Boost.")
      : loginCopy("Sign in first, then buy a Creator Boost to regenerate assets.");
  }
  if (normalized.startsWith("reports.export.") || normalized.startsWith("reports.history.")) {
    if (!isLoggedInUser()) {
      return loginCopy("Sign in to open report history and export tools.");
    }
    if (normalized === "reports.export.generate" || normalized === "reports.export.source.select" || normalized === "reports.export.format.select" || normalized === "reports.history.delete" || normalized === "reports.history.bulk.delete" || normalized === "reports.history.clear") {
      return loginCopy("VIP or admin access is required for advanced report export controls.");
    }
  }
  if (normalized.startsWith("cssmv.action.")) {
    if (!isLoggedInUser()) {
      return loginCopy("Sign in first to use CSSMV operational actions.");
    }
    if (normalized === "cssmv.action.require_manual_intervention") {
      return loginCopy("Manual intervention is reserved for VIP and admin workflows.");
    }
    if (normalized === "cssmv.action.escalate_ops") {
      return loginCopy("Escalating CSSMV operations requires Enterprise, VIP, or admin access.");
    }
    if (normalized === "cssmv.action.force_refresh_signals" || normalized === "cssmv.action.capture_snapshot") {
      return loginCopy("Studio and above can use live CSSMV signal controls.");
    }
    if (normalized === "cssmv.action.retry") {
      return loginCopy("Retry is available from Pro and above.");
    }
  }
  if (normalized.startsWith("delivery.")) {
    if (!isLoggedInUser()) {
      return loginCopy("Sign in first to use delivery report and ops actions.");
    }
    if (normalized === "delivery.watch.case") return loginCopy("Watch case actions are available after login.");
    if (normalized === "delivery.watch.archive") return loginCopy("Watch archive actions are available after login.");
    if (normalized === "delivery.watch.compare") return loginCopy("Watch compare actions are available for Basic and above.");
    if (normalized === "delivery.watch.saved_view") return loginCopy("Watch saved-view actions are available after login.");
    if (normalized === "delivery.watch.standard") return loginCopy("Watch actions are available after login.");
    if (normalized === "delivery.compliance.standard") return loginCopy("Compliance actions are available after login.");
    if (normalized === "delivery.compliance.refresh") return loginCopy("Compliance refresh actions are available after login.");
    if (normalized === "delivery.compliance.open") return loginCopy("Compliance open actions are available after login.");
    if (normalized === "delivery.compliance.registry") return loginCopy("Compliance registry actions require Pro or above.");
    if (normalized === "delivery.compliance.approval") return loginCopy("Compliance approval actions require Enterprise, VIP, or admin access.");
    if (normalized === "delivery.compliance.signer") return loginCopy("Compliance signer actions require Enterprise, VIP, or admin access.");
    if (normalized === "delivery.compliance.quorum") return loginCopy("Compliance quorum actions require Enterprise, VIP, or admin access.");
    if (normalized === "delivery.rewrite.standard") return loginCopy("Rewrite actions are available after login.");
    if (normalized === "delivery.rewrite.bundle") return loginCopy("Rewrite bundle actions require Pro or above.");
    if (normalized === "delivery.rewrite.sandbox") return loginCopy("Rewrite sandbox actions require Pro or above.");
    if (normalized === "delivery.rewrite.diff") return loginCopy("Rewrite diff actions require Pro or above.");
    if (normalized === "delivery.rewrite.playback") return loginCopy("Rewrite playback actions are available for Basic and above.");
    if (normalized === "delivery.probe.standard") return loginCopy("Probe actions are available after login.");
    if (normalized === "delivery.probe.dispatch") return loginCopy("Probe dispatch actions require Pro or above.");
    if (normalized === "delivery.probe.export") return loginCopy("Probe export actions require Pro or above.");
    if (normalized === "delivery.probe.handoff") return loginCopy("Probe handoff actions require Pro or above.");
    if (normalized === "delivery.probe.compare") return loginCopy("Probe compare actions are available for Basic and above.");
    if (normalized === "delivery.publish.standard") return loginCopy("Publish actions are available after login.");
    if (normalized === "delivery.publish.simulate") return loginCopy("Publish simulate actions are available after login.");
    if (normalized === "delivery.publish.route") return loginCopy("Publish route actions require Pro or above.");
    if (normalized === "delivery.publish.confirm") return loginCopy("Publish confirm actions require Enterprise, VIP, or admin access.");
    if (normalized === "delivery.publish.finalize") return loginCopy("Publish finalize actions require Enterprise, VIP, or admin access.");
    if (normalized === "delivery.post_publish.standard") return loginCopy("Post-publish actions are available after login.");
    if (normalized === "delivery.arrangement.standard") return loginCopy("Arrangement actions are available after login.");
    if (normalized === "delivery.mixer.standard") return loginCopy("Mixer actions are available after login.");
    if (normalized === "delivery.ops.standard") return loginCopy("Ops actions are available after login.");
    if (normalized === "delivery.action.standard") return loginCopy("This delivery action is available after login.");
    return loginCopy("This delivery action is reserved for administrators.");
  }
  if (normalized === "profile.passkey.enable") {
    return loginCopy("Sign in first to bind a passkey.");
  }
  if (!isLoggedInUser()) {
    return loginCopy("Sign in to continue.");
  }
  if (tier === "free") {
    return loginCopy("This action requires a higher membership tier.");
  }
  if (tier === "starter") {
    return loginCopy("Upgrade to Pro to unlock this advanced action.");
  }
  return loginCopy("You do not have permission for this action.");
}

function permissionPrompt(scope) {
  return permissionPromptModule(scope);
}

// CSSOS_P2_14 20260418 — explicit global exports (belt-and-suspenders).
// Classic <script> function declarations *should* land on window automatically,
// but in production we observed `ReferenceError: Can't find variable:
// enforceCreationCapability` at runtime. Forcing the bindings here removes
// any ambiguity from parse/load ordering or Safari quirks.
if (typeof globalThis !== "undefined") {
  try {
    globalThis.enforceCreationCapability = enforceCreationCapability;
    globalThis.enforceCreationCapabilityModule = enforceCreationCapabilityModule;
    globalThis.getAccessTier = getAccessTier;
    globalThis.getAccessTierModule = getAccessTierModule;
    globalThis.normalizeAccessTier = normalizeAccessTier;
    globalThis.isPaidMemberTier = isPaidMemberTier;
    globalThis.isVipOrAdminTier = isVipOrAdminTier;
    globalThis.getDailyLimit = getDailyLimit;
    globalThis.getUsageKey = getUsageKey;
    globalThis.getMembershipPreset = getMembershipPresetModule;
    globalThis.renderApiBillingPanel = renderApiBillingPanel;
    globalThis.permissionPrompt = permissionPrompt;
  } catch (_e) {
    // Swallow — if any of these identifiers aren't defined in this build,
    // the module-level function still exists for same-file callers.
  }
}
