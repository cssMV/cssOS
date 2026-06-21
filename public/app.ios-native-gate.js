/* CSSOS_WAVE_115 20260511 — Jing
 * App Store Guideline 3.1.1 hard gate.
 *
 * Apple rejects any iOS app that lets users buy "digital goods or
 * services" through external payment systems (WeChat Pay, Alipay,
 * Stripe-direct, anything that isn't In-App Purchase). Our website
 * has 微信/支付宝 打赏 chips, creator-boost vendor buttons, and
 * notification background-buy buttons that route to NihaoPay — all
 * legal on web/Android/macOS Safari but **immediate rejection** in
 * the iOS App Store build.
 *
 * This module runs as early as possible (loaded BEFORE every other
 * app script in index.html), detects Capacitor's iOS runtime, and:
 *   1. Sets `document.documentElement.dataset.iosNative = "1"`
 *   2. Sets `globalThis.cssosIsIosNative` for runtime checks
 *   3. Injects a `<style>` block that hides every external-payment
 *      surface via CSS — covers current AND future buttons we may
 *      add, as long as they keep the existing `data-*` attributes.
 *
 * Web users see no change. iOS-native users see all NihaoPay UI
 * removed. Side effect: international Stripe-tip stays visible
 * because that one needs IAP integration before re-enabling (v1.1).
 */
(function () {
  function detect() {
    try {
      var cap = globalThis.Capacitor;
      if (!cap) return false;
      var isNative = typeof cap.isNativePlatform === "function"
        ? cap.isNativePlatform()
        : false;
      if (!isNative) return false;
      var platform = (typeof cap.getPlatform === "function" ? cap.getPlatform() : "") || "";
      return String(platform).toLowerCase() === "ios";
    } catch (_) { return false; }
  }

  var ios = detect();
  globalThis.cssosIsIosNative = function () { return ios; };

  if (!ios) return; // Web / Android / macOS Safari — no-op

  try {
    document.documentElement.setAttribute("data-ios-native", "1");
  } catch (_) {}

  // Inject the hide-all-external-payment CSS as early as possible
  // so buttons never even paint to screen. Use !important so we
  // win against any inline display:inline / display:flex.
  function injectHideCss() {
    if (document.getElementById("cssos-ios-payment-gate-style")) return;
    var s = document.createElement("style");
    s.id = "cssos-ios-payment-gate-style";
    s.textContent = [
      // ── Price strip (Wave 113G WeChat chip) — JS gate already
      // hides this, but belt-and-suspenders. ──
      'html[data-ios-native="1"] #cssos-watch-price-strip [data-kind="wechat"]',
      // ── Marketplace card per-row "Tip · 支付宝/微信" button ──
      ', html[data-ios-native="1"] [data-market-action="tip-nihaopay"]',
      // ── CSSOS_WAVE_813 20260616 — the PLAIN "Tip" button opens an
      // amount picker whose pay-method buttons (Stripe/NihaoPay) are
      // hidden on iOS → dead-end modal (amount + Cancel only). Apple
      // forbids external payment for digital tips here & a dead-end =
      // broken feature (2.1). v1: hide the Tip entry entirely on iOS
      // (same strategy as buyout/listen). Re-enable later via StoreKit
      // consumable IAP. ──
      ', html[data-ios-native="1"] [data-market-action="tip"]',
      ', html[data-ios-native="1"] [data-watch-market-action="tip"]',
      ', html[data-ios-native="1"] [data-market-tip-input]',
      // ── Notifications panel "Buy background" Alipay/WeChat/UnionPay row ──
      ', html[data-ios-native="1"] [data-notification-buy-background-nihaopay]',
      // ── Advanced panel "Creator boost" Alipay/WeChat boost ──
      ', html[data-ios-native="1"] [data-creator-boost-nihaopay-vendor]',
      // ── Generic catch-all: any data-* containing "nihaopay" ──
      ', html[data-ios-native="1"] [data-payment-vendor="alipay"]',
      ', html[data-ios-native="1"] [data-payment-vendor="wechatpay"]',
      ', html[data-ios-native="1"] [data-payment-vendor="unionpay"]',
      // ── CSSOS_WAVE_123 20260513 — also hide per-work Stripe paths.
      // Apple Guideline 3.1.1 forbids ANY external payment for digital
      // goods, including Stripe direct. Per-work LISTEN/BUYOUT both
      // unlock digital content → must route through StoreKit IAP, but
      // we don't have per-work pre-registered product IDs (App Store
      // requires static product catalog), so v1 simply hides them on
      // iOS native. System anniversary/festival works are FREE so
      // they auto-play without needing either button. For other paid
      // works the user must visit cssstudio.app on web. ──
      ', html[data-ios-native="1"] [data-watch-market-action="buyout"]',
      ', html[data-ios-native="1"] [data-watch-market-action="listen"]',
      ', html[data-ios-native="1"] [data-market-action="buyout"]',
      ', html[data-ios-native="1"] [data-market-action="listen-paid"]',
      // ── Subscription panel: hide Stripe ("Pay with card") + NihaoPay
      // (Alipay/WeChat/UnionPay) rows entirely. Apple's "in-app digital
      // subscription" requirement means we only show the Apple-Pay
      // button (injected by app.ios-subscription-iap-button.js). ──
      ', html[data-ios-native="1"] [data-subscription-direct-tier]',
      ', html[data-ios-native="1"] [data-subscription-select-tier]',
      ', html[data-ios-native="1"] [data-subscription-panel-nihaopay-row]',
      ', html[data-ios-native="1"] [data-subscription-nihaopay-row]',
      ', html[data-ios-native="1"] [data-subscription-buy-boost]',
      ', html[data-ios-native="1"] [data-subscription-boost-nihaopay-vendor]',
      ', html[data-ios-native="1"] .pay-group',
      // ── CSSOS_WAVE_837 20260616 — Apple 1.1.6: the web Stripe checkout's
      // wallet buttons literally say "Apple Pay" (data-pay-stripe-wallet=
      // apple_pay). IAP ≠ Apple Pay; never show these on iOS native. ──
      ', html[data-ios-native="1"] [data-pay-stripe-wallet]',
      ', html[data-ios-native="1"] .pay-wallet',
      ', html[data-ios-native="1"] .pay-stripe',
      "{ display: none !important; visibility: hidden !important; }",
      "",
      // Hide entire payment-vendor row container if it was the only child.
      'html[data-ios-native="1"] .pay-vendors-row:empty,',
      'html[data-ios-native="1"] .nihaopay-row:empty',
      "{ display: none !important; }",
    ].join("\n");
    (document.head || document.documentElement).appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectHideCss);
  } else {
    injectHideCss();
  }

  // Defensive: block JS-level click handlers that might still try
  // to invoke NihaoPay programmatically (e.g. our existing
  // dispatchMarketWorkPayment can be called from the playlist row
  // without going through a visible button). On iOS native, neuter
  // the tip-nihaopay path entirely.
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest
      ? e.target.closest('[data-market-action="tip"], [data-watch-market-action="tip"], [data-market-action="tip-nihaopay"], [data-notification-buy-background-nihaopay], [data-creator-boost-nihaopay-vendor]')
      : null;
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(
          "Tipping via WeChat/Alipay is not available in the iOS app. Visit cssstudio.app on web."
        );
      }
      return;
    }
    // CSSOS_WAVE_123 — also block per-work Stripe checkout. CSS hides
    // the buttons but a stray programmatic invocation (or a card we
    // forgot to tag) could still reach the Stripe path; capture-phase
    // click handler is the last line of defense before /api/checkout.
    var paid = e.target && e.target.closest
      ? e.target.closest('[data-watch-market-action="buyout"], [data-watch-market-action="listen"], [data-market-action="buyout"], [data-market-action="listen-paid"]')
      : null;
    if (paid) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(
          "Purchases for individual works are available on the web. Visit cssstudio.app to listen or buyout. Subscriptions and credit packs are available in-app via the Apple Store."
        );
      }
    }
  }, true /* capture phase — beat any other handler */);
})();
