/* CSSOS_WAVE_123 20260513 — Jing
 *
 * iOS native — inject an "Apple Pay (In-App Purchase)" button into
 * every subscription-panel tier card. The original Stripe + NihaoPay
 * buttons are CSS-hidden by app.ios-native-gate.js; this module
 * supplies the replacement.
 *
 * On click: calls cssosIapNative.purchaseSubscriptionTier(tier, "monthly")
 * which triggers the StoreKit dialog and POSTs the receipt to
 * /api/iap/apple/verify on completion.
 *
 * No-op on web/Android/macOS Safari.
 */
(function () {
  if (globalThis.__cssosIosSubscriptionIapButtonWired) return;
  globalThis.__cssosIosSubscriptionIapButtonWired = true;

  function isIosNative() {
    try {
      var cap = globalThis.Capacitor;
      if (!cap) return false;
      if (typeof cap.isNativePlatform === "function" && !cap.isNativePlatform()) return false;
      var p = typeof cap.getPlatform === "function" ? cap.getPlatform() : "";
      return String(p).toLowerCase() === "ios";
    } catch (_) { return false; }
  }
  if (!isIosNative()) return;

  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en) : en;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function injectStyles() {
    if (document.getElementById("cssos-ios-iap-btn-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-ios-iap-btn-style";
    st.textContent = [
      '.cssos-ios-iap-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px 18px;border-radius:14px;background:#000;color:#fff;border:none;cursor:pointer;font:700 15px/1.2 -apple-system,system-ui,sans-serif;letter-spacing:.02em;margin-top:10px;transition:transform 120ms ease, background 120ms ease;}',
      '.cssos-ios-iap-btn:hover{background:#1a1a1a;transform:translateY(-1px);}',
      '.cssos-ios-iap-btn:active{transform:translateY(0);background:#000;}',
      '.cssos-ios-iap-btn:disabled{opacity:.6;cursor:wait;}',
      '.cssos-ios-iap-btn .apple-glyph{font-size:18px;line-height:1;}',
      '.cssos-ios-iap-hint{font:500 11px/1.4 -apple-system,system-ui,sans-serif;color:rgba(0,0,0,.55);margin-top:6px;text-align:center;}',
    ].join("\n");
    document.head.appendChild(st);
  }

  function findUninjectedCards() {
    // Each subscription tier card holds either [data-subscription-select-tier]
    // (the "switch plan" Stripe button) or [data-subscription-direct-tier]
    // (the "direct purchase" Stripe button). Both carry the tier name.
    // Find the card root by walking up; inject our button next to the
    // hidden Stripe button.
    var tierEls = document.querySelectorAll('[data-subscription-select-tier], [data-subscription-direct-tier]');
    var out = [];
    for (var i = 0; i < tierEls.length; i++) {
      var el = tierEls[i];
      var tier = el.getAttribute("data-subscription-select-tier") || el.getAttribute("data-subscription-direct-tier");
      if (!tier) continue;
      // Find the closest tier card. The Stripe button is inside
      // <div class="pay-group">; we attach our button after the parent
      // pay-group. If we already attached one to this card, skip.
      var payGroup = el.closest(".pay-group") || el.parentElement;
      if (!payGroup) continue;
      // De-dupe: look for our marker as a sibling.
      var existing = payGroup.parentElement
        && payGroup.parentElement.querySelector('.cssos-ios-iap-btn[data-iap-tier="' + tier + '"]');
      if (existing) continue;
      out.push({ tier: tier, anchor: payGroup });
    }
    return out;
  }

  async function startPurchase(button, tier) {
    if (!globalThis.cssosIapNative || typeof globalThis.cssosIapNative.purchaseSubscriptionTier !== "function") {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast("In-App Purchase bridge not ready. Please reopen the app and try again.");
      }
      return;
    }
    button.disabled = true;
    var orig = button.innerHTML;
    button.innerHTML = '<span class="apple-glyph"></span> ' + esc(tr("Opening Apple Pay…", "正在打开 Apple Pay…"));
    try {
      var result = await globalThis.cssosIapNative.purchaseSubscriptionTier(tier, "monthly");
      if (result && result.ok) {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(tr("Subscription activated.", "订阅已激活。"));
        }
        if (typeof globalThis.fetchBillingStatus === "function") {
          await globalThis.fetchBillingStatus().catch(function () {});
        }
        if (typeof globalThis.renderSubscriptionPanelModule === "function") {
          await globalThis.renderSubscriptionPanelModule();
        }
        return;
      }
      var err = String((result && result.error) || "unknown");
      if (err === "user_cancelled") {
        // Silent — user closed the dialog.
      } else if (err === "iap_plugin_missing") {
        // CSSOS_WAVE_125_FIX 20260513 — Jing: the raw "registerPlugin=...
        // available=[...]" diagnostic was being shown as a sticky toast
        // covering the SUBSCRIPTION title. End users don't need internals.
        // Show a clean message; full detail stays in console + telemetry.
        var diag = String((result && result.detail) || "no detail");
        console.warn("[ios-iap-btn] plugin missing detail:", diag);
        // Send to crash-log too for admin diagnostics
        try {
          if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/admin/crash-log",
              new Blob([JSON.stringify({ kind: "iap_plugin_missing", message: diag.slice(0, 300) })],
              { type: "application/json" }));
          }
        } catch (_) {}
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(tr(
            "Apple Pay isn't available in this build. Please use the web checkout for now.",
            "本版本暂不支持 Apple Pay，请通过网页端付费。"
          ));
        }
      } else if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tr("Could not complete the purchase: ", "购买未完成：") + err);
      }
    } catch (e) {
      console.warn("[ios-iap-btn] purchase threw:", e);
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tr("Apple Pay error: ", "Apple Pay 错误：") + (e && e.message ? e.message : String(e)));
      }
    } finally {
      button.disabled = false;
      button.innerHTML = orig;
    }
  }

  function injectButtons() {
    var cards = findUninjectedCards();
    if (!cards.length) return;
    injectStyles();
    cards.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cssos-ios-iap-btn";
      btn.setAttribute("data-iap-tier", c.tier);
      btn.innerHTML = '<span class="apple-glyph"></span> '
        + esc(tr("Subscribe with Apple", "通过 Apple 订阅"));
      btn.addEventListener("click", function () { startPurchase(btn, c.tier); });
      // Insert immediately after the (hidden) pay-group so the layout
      // is still under the tier description.
      if (c.anchor.parentElement) {
        c.anchor.parentElement.insertBefore(btn, c.anchor.nextSibling);
      } else {
        c.anchor.appendChild(btn);
      }
    });
  }

  // Re-scan whenever the subscription panel renders (it lazy-loads
  // and re-renders after tier changes). Cheap: 8s × 30s = 4 passes.
  function startWatcher() {
    injectButtons();
    var passes = 0;
    var tick = setInterval(function () {
      passes++;
      injectButtons();
      if (passes >= 8) clearInterval(tick);
    }, 1200);
    // Also re-scan on focus + when panel close/open events fire.
    window.addEventListener("focus", injectButtons);
    document.addEventListener("click", function () { setTimeout(injectButtons, 200); }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatcher);
  } else {
    startWatcher();
  }
})();
