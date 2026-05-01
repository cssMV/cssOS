async function startStripeCheckoutForWork(workId, orderKind, trigger, options = {}) {
  if (!authState.user) {
    showToast(loginCopy("Please sign in first."));
    openPanel(loginPanel);
    return;
  }
  if (String(orderKind || "").trim() === "tip") {
    const amountCents = Number(options?.tipAmountCents || 0);
    if (!Number.isFinite(amountCents) || amountCents < 100) {
      showToast(loginCopy("Tips start at $1.00."));
      return;
    }
  }
  const lockKey = `${String(workId || "").trim()}:${String(orderKind || "").trim()}`;
  if (checkoutLocks.has(lockKey)) return;
  let retryAfterUnlock = false;
  try {
    checkoutLocks.add(lockKey);
    setButtonBusy(trigger, true);
    const res = await fetch("/api/stripe/checkout/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        work_id: workId,
        order_kind: orderKind,
        tip_amount_cents: Number(options?.tipAmountCents || 0) > 0 ? Number(options.tipAmountCents) : undefined
      })
    });
    const payload = await res.json().catch(() => null);
    const data = getApiData(payload);
    if (!res.ok || payload?.ok === false || !data?.checkout_url) {
      throw new Error(payload?.message || `checkout_create_failed:${res.status}`);
    }
    window.location.href = String(data.checkout_url);
  } catch (err) {
    const message = String(err || "");
    if (message.includes("SELF_PURCHASE_NOT_ALLOWED")) {
      showToast(loginCopy("You can't buy your own work."));
      return;
    }
    if (message.includes("ORDER_ALREADY_PENDING") || message.includes("ORDER_BUYOUT_PENDING")) {
      showToast(loginCopy("This order is already processing."));
      void loadPublicMarketWorks(true).then(() => renderForyouMarketplace());
      return;
    }
    if (message.includes("ORDER_ALREADY_PAID")) {
      showToast(loginCopy("You already own this access."));
      void loadPublicMarketWorks(true).then(() => renderForyouMarketplace());
      return;
    }
    if (message.includes("ORDER_ALREADY_OWNED_BUYOUT")) {
      showToast(loginCopy("You already own the buyout."));
      void loadPublicMarketWorks(true).then(() => renderForyouMarketplace());
      return;
    }
    if (message.includes("product_not_priced")) {
      await loadPublicMarketWorks(true).catch(() => []);
      renderForyouMarketplace();
      const refreshed = flattenHierarchyWorks(Array.isArray(publicMarketState.works) ? publicMarketState.works : []);
      const targetWork = refreshed.find((entry) => String(entry?.id || entry?.work_id || "").trim() === String(workId || "").trim());
      const hasDisplayedPrice =
        orderKind === "buyout"
          ? Number(targetWork?.current_buyout_price_cents || 0) > 0
          : Number(targetWork?.current_listen_price_cents || 0) > 0;
      if (hasDisplayedPrice && !options?.retriedAfterRefresh) {
        retryAfterUnlock = true;
        return;
      }
      showToast(loginCopy("This work is not priced yet."));
      return;
    }
    if (message.includes("buyout_not_enabled")) {
      showToast(loginCopy("Buyout is not enabled for this work."));
      return;
    }
    if (message.includes("tips_not_enabled")) {
      showToast(loginCopy("Tips are not enabled for this work."));
      return;
    }
    showToast(loginCopy("Checkout failed. Please try again."));
  } finally {
    checkoutLocks.delete(lockKey);
    setButtonBusy(trigger, false);
  }
  if (retryAfterUnlock) {
    await startStripeCheckoutForWork(workId, orderKind, trigger, { retriedAfterRefresh: true });
  }
}

function enforceWatchPreviewLimit() {
  if (!(watchPreviewLimitSec > 0)) return false;
  if (currentWatchAudioSourceKind === "demo-audio") return false;
  if (canBypassPreviewLimit(authState.user, currentWatchPreviewWork)) {
    return false;
  }
  const audioTime =
    watchAudioPreview && !watchAudioPreview.paused && !watchAudioPreview.ended
      ? Number(watchAudioPreview.currentTime || 0)
      : 0;
  const videoTime = watchVideo && !watchVideo.paused ? Number(watchVideo.currentTime || 0) : 0;
  const current = Math.max(audioTime, videoTime);
  if (current < watchPreviewLimitSec) return false;
  watchVideo?.pause?.();
  watchAudioPreview?.pause?.();
  try {
    if (watchVideo) watchVideo.currentTime = 0;
  } catch (_err) {}
  try {
    if (watchAudioPreview) watchAudioPreview.currentTime = 0;
  } catch (_err) {}
  if (!watchPreviewLimitNoticeShown) {
    watchPreviewLimitNoticeShown = true;
    const message = watchPreviewLimitReason || loginCopy("Preview ended at 30 seconds.");
    if (watchSubtitle) watchSubtitle.textContent = message;
    showToast(message);
  }
  return true;
}

async function applyAdminMembershipAssignment(trigger = null) {
  const emailInput = advancedPanelSettings?.querySelector('[data-advanced-setting="admin-target-email"]');
  const tierInput = advancedPanelSettings?.querySelector('[data-advanced-setting="admin-target-tier"]');
  const email = String(emailInput?.value || "").trim();
  const tier = String(tierInput?.value || "").trim().toLowerCase();
  if (!email || !tier) {
    safeShowToast(loginCopy("Enter the target email and membership tier first."));
    return;
  }
  setButtonBusy(trigger, true);
  try {
    const res = await fetch("/api/admin/membership/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, tier })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.ok === false) {
      throw new Error(payload?.message || `admin_membership_set_failed:${res.status}`);
    }
    safeShowToast(loginCopy("Membership updated. VIP remains admin-only and is not publicly self-serve."));
  } catch (_err) {
    safeShowToast(loginCopy("Failed to update membership."));
  } finally {
    setButtonBusy(trigger, false);
  }
}
