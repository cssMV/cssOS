/* CSSOS_WAVE_118 20260513 — Jing
 *
 * iOS native In-App Purchase bridge.
 *
 * When the cssOS web bundle runs inside the Capacitor iOS native
 * shell (Capacitor.isNativePlatform()===true && platform==='ios'),
 * we route all subscription / credit-pack purchases through Apple's
 * StoreKit instead of Stripe / NihaoPay — required for App Store
 * Guideline 3.1.1 compliance.
 *
 * Architecture:
 *   - This module exposes globalThis.cssosIapNative.
 *   - On native: hijacks subscription-panel + credit-pack purchase
 *     handlers, presents the StoreKit dialog via Capacitor plugin,
 *     POSTs the resulting receipt to /api/iap/apple/verify.
 *   - On web: this module is a no-op; existing Stripe/NihaoPay path
 *     handles everything.
 *
 * Capacitor plugin: `@capacitor-community/in-app-purchases`. The
 * cssOS iOS native project (Xcode) must add this plugin via:
 *     npm i @capacitor-community/in-app-purchases
 *     npx cap sync ios
 * App Store Connect must have the product IDs from /api/iap/products
 * pre-registered (status: "Ready for Sale" or "Ready to Submit").
 */
(function () {
  if (globalThis.cssosIapNative) return;

  function isIosNative() {
    try {
      var cap = globalThis.Capacitor;
      if (!cap) return false;
      if (typeof cap.isNativePlatform === "function" && !cap.isNativePlatform()) return false;
      var platform = typeof cap.getPlatform === "function" ? cap.getPlatform() : "";
      return String(platform).toLowerCase() === "ios";
    } catch (_) { return false; }
  }

  var __nativePurchasesProxy = null;
  function getPlugin() {
    try {
      var cap = globalThis.Capacitor;
      if (!cap) return null;
      // First check the auto-registered proxy table.
      if (cap.Plugins && cap.Plugins.NativePurchases) return cap.Plugins.NativePurchases;
      if (cap.Plugins && cap.Plugins.CapgoNativePurchases) return cap.Plugins.CapgoNativePurchases;
      if (cap.Plugins && cap.Plugins.InAppPurchases) return cap.Plugins.InAppPurchases;
      if (cap.Plugins && cap.Plugins.CapacitorIAP) return cap.Plugins.CapacitorIAP;
      // CSSOS_WAVE_123 20260513 — fix iap_plugin_missing.
      // Our shell loads https://cssstudio.app/ as-is; we never bundle
      // @capgo/native-purchases' JS, so Capacitor.Plugins.NativePurchases
      // is never populated by the plugin's auto-register hook. Capacitor
      // exposes registerPlugin() globally for exactly this case — it
      // returns a proxy bridged to the native side (compiled into the
      // app via Pods) as long as the native plugin is present. Cache it.
      if (__nativePurchasesProxy) return __nativePurchasesProxy;
      if (typeof cap.registerPlugin === "function") {
        try {
          __nativePurchasesProxy = cap.registerPlugin("NativePurchases");
          if (__nativePurchasesProxy) return __nativePurchasesProxy;
        } catch (err) {
          console.warn("[iap-native] registerPlugin failed:", err);
        }
      }
      return null;
    } catch (_) { return null; }
  }

  async function fetchProducts() {
    try {
      var r = await fetch("/api/iap/products", { credentials: "include" });
      var j = await r.json();
      if (!j.ok) return [];
      return Array.isArray(j.products) ? j.products : [];
    } catch (_) { return []; }
  }

  /* Purchase a product by App Store Connect product_id. Returns
   *   { ok: true, receipt: <verify response> } on success
   *   { ok: false, error: "..." } on failure */
  async function purchase(productId) {
    if (!isIosNative()) {
      return { ok: false, error: "not_ios_native" };
    }
    var plugin = getPlugin();
    // CSSOS_WAVE_125 20260513 — diagnostics: when no proxy was obtained,
    // dump what IS on Capacitor.Plugins so the next iteration sees real
    // information instead of a generic "missing" error.
    if (!plugin) {
      var cap = globalThis.Capacitor;
      var available = [];
      try { available = cap && cap.Plugins ? Object.keys(cap.Plugins) : []; } catch (_) {}
      var hasRegFn = !!(cap && typeof cap.registerPlugin === "function");
      var detail = "Capacitor.registerPlugin=" + (hasRegFn ? "function" : typeof (cap && cap.registerPlugin))
        + "; available=" + JSON.stringify(available);
      console.warn("[iap-native] no plugin handle.", detail);
      return { ok: false, error: "iap_plugin_missing", detail: detail };
    }
    try {
      // CSSOS_WAVE_125 20260513 — call purchaseProduct via Capacitor's
      // generic proxy method regardless of typeof check. registerPlugin()
      // returns a Proxy whose `get(target, key)` always returns a function,
      // so `typeof plugin.purchaseProduct` is always "function". But on
      // older proxies, the function might be missing. So we always try
      // purchaseProduct first; if it throws "method not implemented" we
      // fall back. Any other throw bubbles up as a real error.
      var txnResult;
      try {
        // CSSOS_WAVE_118 20260513 — @capgo/native-purchases uses
        // `productType` (not `planType`). Sending both keys is safe;
        // plugins ignore unknown fields. Subscription products are
        // named like `pro.monthly` / `pro.annual` in our App Store
        // Connect catalog.
        var _productType = /\.(monthly|annual|weekly|yearly)$/.test(productId) ? "subs" : "inapp";
        txnResult = await plugin.purchaseProduct({
          productIdentifier: productId,
          productType: _productType,
          planType: _productType,  // legacy field for older plugin builds
        });
      } catch (errA) {
        var msgA = String((errA && errA.message) || errA || "");
        console.warn("[iap-native] purchaseProduct threw:", msgA);
        if (/not implemented|UNIMPLEMENTED|no method/i.test(msgA)) {
          if (typeof plugin.purchase === "function") {
            txnResult = await plugin.purchase({ productIdentifier: productId });
          } else if (typeof plugin.startPurchase === "function") {
            txnResult = await plugin.startPurchase({ productId: productId });
          } else {
            return { ok: false, error: "iap_plugin_api_unknown", detail: msgA };
          }
        } else {
          // Real StoreKit / network / cancel error — propagate the message.
          throw errA;
        }
      }
      if (!txnResult) return { ok: false, error: "iap_no_result" };
      // Extract receipt — different plugins call it different things.
      var receiptB64 = String(
        txnResult.receipt ||
        txnResult.receiptData ||
        txnResult.transactionReceipt ||
        (txnResult.transaction && txnResult.transaction.receipt) ||
        ""
      ).trim();
      if (!receiptB64) {
        // StoreKit 2 returns JWS — for v1 we still POST the wrapper and
        // let the server's structural check decide. Future 118B adds
        // proper JWS verification.
        receiptB64 = JSON.stringify(txnResult);
      }
      // POST to server for verify + grant.
      var verifyR = await fetch("/api/iap/apple/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_data: receiptB64,
          transaction_id: txnResult.transactionId || txnResult.transaction_id || "",
          product_id: productId,
          app_account_token: txnResult.appAccountToken || "",
        }),
      });
      var verifyJ = await verifyR.json();
      if (!verifyR.ok || !verifyJ.ok) {
        return { ok: false, error: verifyJ.error || "verify_failed", detail: verifyJ };
      }
      return { ok: true, receipt: verifyJ };
    } catch (err) {
      var msg = err && err.message ? err.message : String(err);
      if (/cancel/i.test(msg)) return { ok: false, error: "user_cancelled" };
      return { ok: false, error: msg };
    }
  }

  /* Open a native picker for a given product category. Convenience
   * wrapper that's called from web UI buttons; the underlying purchase
   * is handled by StoreKit's own UI. */
  async function purchaseSubscriptionTier(tier, period) {
    // tier ∈ "starter"|"pro"|"studio"; period ∈ "monthly"|"annual"
    var productId = "app.cssstudio.studio." + tier + "." + period;
    return purchase(productId);
  }

  async function purchaseCreditPack(credits) {
    var productId = "app.cssstudio.studio.credits." + credits;
    return purchase(productId);
  }

  /* Restore previous purchases (required by App Store guidelines —
   * every IAP app must have a "Restore Purchases" button). */
  async function restorePurchases() {
    if (!isIosNative()) return { ok: false, error: "not_ios_native" };
    var plugin = getPlugin();
    if (!plugin) return { ok: false, error: "iap_plugin_missing" };
    try {
      var result;
      if (typeof plugin.restorePurchases === "function") {
        result = await plugin.restorePurchases();
      } else if (typeof plugin.restore === "function") {
        result = await plugin.restore();
      } else {
        return { ok: false, error: "iap_plugin_api_unknown" };
      }
      // The plugin returns the bundle receipt; POST to server for verify.
      var receiptB64 = String(
        result.receipt || result.receiptData || result.transactionReceipt || ""
      ).trim();
      if (!receiptB64) return { ok: true, transactions: [] };
      var verifyR = await fetch("/api/iap/apple/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_data: receiptB64 }),
      });
      var verifyJ = await verifyR.json();
      return verifyR.ok && verifyJ.ok ? { ok: true, receipt: verifyJ } : { ok: false, error: verifyJ.error };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  globalThis.cssosIapNative = Object.freeze({
    isIosNative: isIosNative,
    fetchProducts: fetchProducts,
    purchase: purchase,
    purchaseSubscriptionTier: purchaseSubscriptionTier,
    purchaseCreditPack: purchaseCreditPack,
    restorePurchases: restorePurchases,
  });

  /* When running native, set a body attr so CSS / payment picker
   * components can hide non-IAP options. Used by app.ios-native-gate.js
   * to hide NihaoPay buttons. */
  if (isIosNative()) {
    try {
      document.documentElement.setAttribute("data-ios-native", "1");
    } catch (_) {}
  }
})();
