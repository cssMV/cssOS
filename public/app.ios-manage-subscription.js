/* CSSOS_WAVE_127 20260513 — Jing
 *
 * iOS native — Apple Guideline 3.1.2 requires every IAP-subscribed app
 * to provide a clear path to "Manage Subscription". This module:
 *   1. Hides "Subscribe with Apple" buttons on the tier the user is
 *      ALREADY on (no point re-subscribing to the same plan).
 *   2. Injects a "Manage subscription in App Store" banner at the top
 *      of the subscription panel when running iOS native. Clicking it
 *      opens https://apps.apple.com/account/subscriptions in
 *      SFSafariViewController (via @capacitor/browser); iOS routes that
 *      URL through to the system Subscriptions UI in Settings.
 *
 * No-op on web/Android/macOS Safari.
 */
(function () {
  if (globalThis.__cssosIosManageSubWired) return;
  globalThis.__cssosIosManageSubWired = true;

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
  function currentTier() {
    try {
      return String((globalThis.authState && globalThis.authState.tier) || "free").toLowerCase();
    } catch (_) { return "free"; }
  }

  function injectStyles() {
    if (document.getElementById("cssos-ios-manage-sub-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-ios-manage-sub-style";
    st.textContent = [
      ".cssos-ios-manage-banner{display:flex;align-items:center;gap:10px;padding:11px 14px;margin:10px 14px 14px;border-radius:12px;background:linear-gradient(135deg,rgba(0,122,255,0.12),rgba(0,90,200,0.05));border:1px solid rgba(0,122,255,0.32);cursor:pointer;transition:background 120ms ease;}",
      ".cssos-ios-manage-banner:hover{background:linear-gradient(135deg,rgba(0,122,255,0.18),rgba(0,90,200,0.08));}",
      ".cssos-ios-manage-banner .icon{font-size:22px;line-height:1;}",
      ".cssos-ios-manage-banner .body{flex:1;display:flex;flex-direction:column;}",
      ".cssos-ios-manage-banner .title{font:700 13.5px/1.2 -apple-system,system-ui,sans-serif;color:#cfe1ff;}",
      ".cssos-ios-manage-banner .sub{font:500 11.5px/1.35 -apple-system,system-ui,sans-serif;color:rgba(207,225,255,0.7);margin-top:2px;}",
      ".cssos-ios-manage-banner .chevron{color:rgba(207,225,255,0.6);font-size:18px;}",
      /* Hide the Subscribe-with-Apple button on tiers the user is already on. */
      '.cssos-ios-iap-btn[data-on-current-tier="1"]{display:none !important;}',
    ].join("\n");
    document.head.appendChild(st);
  }

  async function openManageSubscriptions() {
    var url = "https://apps.apple.com/account/subscriptions";
    try {
      var cap = globalThis.Capacitor;
      var Browser = cap && cap.Plugins && cap.Plugins.Browser;
      if (Browser && typeof Browser.open === "function") {
        await Browser.open({ url: url, presentationStyle: "popover" });
        return;
      }
    } catch (err) {
      console.warn("[ios-manage-sub] Browser.open failed:", err);
    }
    // Fallback: navigate the webview itself.
    try { window.location.href = url; } catch (_) {}
  }

  function ensureBanner() {
    var panelBody = document.querySelector("#subscription-panel .panel-body, #subscription-panel-content");
    if (!panelBody) return;
    if (panelBody.querySelector(".cssos-ios-manage-banner")) return;
    injectStyles();
    var banner = document.createElement("button");
    banner.type = "button";
    banner.className = "cssos-ios-manage-banner";
    banner.innerHTML = ''
      + '<span class="icon"></span>'
      + '<span class="body">'
      + '  <span class="title">' + esc(tr("Manage subscription in App Store", "在 App Store 管理订阅")) + '</span>'
      + '  <span class="sub">' + esc(tr(
            "Apple handles cancellation, refunds, and tier changes for in-app purchases.",
            "Apple 负责处理 IAP 订阅的取消、退款和档位变更。"
          )) + '</span>'
      + '</span>'
      + '<span class="chevron">›</span>';
    banner.addEventListener("click", openManageSubscriptions);
    panelBody.insertBefore(banner, panelBody.firstChild);
  }

  function markCurrentTierButtons() {
    var tier = currentTier();
    if (!tier || tier === "free") return;
    // Apple-Pay buttons added by app.ios-subscription-iap-button.js carry
    // data-iap-tier. Mark the one matching the user's active tier.
    var btns = document.querySelectorAll('.cssos-ios-iap-btn');
    btns.forEach(function (btn) {
      var t = String(btn.getAttribute("data-iap-tier") || "").toLowerCase();
      if (t && t === tier) {
        btn.setAttribute("data-on-current-tier", "1");
      } else {
        btn.removeAttribute("data-on-current-tier");
      }
    });
  }

  function refresh() {
    var panel = document.getElementById("subscription-panel");
    if (!panel) return;
    if (panel.hidden || panel.classList.contains("hidden")) return;
    ensureBanner();
    markCurrentTierButtons();
  }

  // Drive off the same panel-open cadence as the Apple-Pay button injector.
  function startWatching() {
    refresh();
    var passes = 0;
    var tick = setInterval(function () {
      passes++;
      refresh();
      if (passes >= 12) clearInterval(tick);
    }, 1200);
    window.addEventListener("focus", refresh);
    document.addEventListener("click", function () { setTimeout(refresh, 250); }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatching);
  } else {
    startWatching();
  }
})();
