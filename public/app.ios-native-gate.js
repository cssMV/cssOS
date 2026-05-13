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
      // ── Notifications panel "Buy background" Alipay/WeChat/UnionPay row ──
      ', html[data-ios-native="1"] [data-notification-buy-background-nihaopay]',
      // ── Advanced panel "Creator boost" Alipay/WeChat boost ──
      ', html[data-ios-native="1"] [data-creator-boost-nihaopay-vendor]',
      // ── Generic catch-all: any data-* containing "nihaopay" ──
      ', html[data-ios-native="1"] [data-payment-vendor="alipay"]',
      ', html[data-ios-native="1"] [data-payment-vendor="wechatpay"]',
      ', html[data-ios-native="1"] [data-payment-vendor="unionpay"]',
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
      ? e.target.closest('[data-market-action="tip-nihaopay"], [data-notification-buy-background-nihaopay], [data-creator-boost-nihaopay-vendor]')
      : null;
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(
          "Tipping via WeChat/Alipay is not available in the iOS app. Visit cssstudio.app on web."
        );
      }
    }
  }, true /* capture phase — beat any other handler */);
})();
