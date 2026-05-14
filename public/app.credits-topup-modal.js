/* CSSOS_WAVE_139B 20260514 — Jing
 *
 * Credits top-up modal. Single source of truth for "buy credits" UX.
 * Surfaces:
 *   1. "💎 充值积分" menu item in the AI assistant ⋯ overflow (W135).
 *   2. globalThis.cssosOpenCreditsTopup() — invokable from any code
 *      path (e.g. the chat's insufficient_credit hint).
 *
 * On web: clicking a tier → POST /api/credits/topup/start → redirect
 * to Stripe Checkout.
 * On iOS native: routes through cssosIapNative.purchaseCreditPack(N).
 */
(function () {
  if (globalThis.__cssosCreditsTopupWired) return;
  globalThis.__cssosCreditsTopupWired = true;

  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en) : en;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function isIosNative() {
    try {
      var cap = globalThis.Capacitor;
      if (!cap) return false;
      if (typeof cap.isNativePlatform === "function" && !cap.isNativePlatform()) return false;
      var p = typeof cap.getPlatform === "function" ? cap.getPlatform() : "";
      return String(p).toLowerCase() === "ios";
    } catch (_) { return false; }
  }

  // Mirror of IAP_PRODUCT_CATALOG credit packs in src/index.ts. Kept in
  // sync manually for now; future cleanup: fetch from /api/iap/products
  // on first open.
  var TIERS = [
    { product_id: "app.cssstudio.studio.credits.100",   credits: 100,   price_cents: 99,    label: "$0.99" },
    { product_id: "app.cssstudio.studio.credits.500",   credits: 500,   price_cents: 499,   label: "$4.99",  bonus: "20% bonus" },
    { product_id: "app.cssstudio.studio.credits.2000",  credits: 2000,  price_cents: 1499,  label: "$14.99", bonus: "40% bonus" },
    { product_id: "app.cssstudio.studio.credits.10000", credits: 10000, price_cents: 4999,  label: "$49.99", bonus: "65% bonus" },
  ];

  function injectStyles() {
    if (document.getElementById("cssos-topup-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-topup-style";
    st.textContent = [
      ".cssos-topup-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.62);backdrop-filter:blur(4px);z-index:10600;display:flex;align-items:center;justify-content:center;padding:14px;}",
      ".cssos-topup-modal{max-width:440px;width:100%;background:#0f1219;border:1px solid rgba(255,255,255,0.12);border-radius:14px;color:#e6e8ee;display:flex;flex-direction:column;max-height:84vh;overflow:hidden;}",
      ".cssos-topup-modal .head{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);}",
      ".cssos-topup-modal .head .title{font:700 15px/1.2 -apple-system,system-ui,sans-serif;color:#fff;flex:1;}",
      ".cssos-topup-modal .head .balance{font:700 12px/1 ui-monospace,monospace;color:#5effc9;background:rgba(0,245,160,0.16);padding:5px 10px;border-radius:999px;}",
      ".cssos-topup-modal .head button.close{background:transparent;border:0;color:#9aa;font-size:18px;cursor:pointer;padding:4px 6px;}",
      ".cssos-topup-modal .body{padding:14px 16px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:10px;}",
      ".cssos-topup-modal .note{font:500 11.5px/1.45 -apple-system,system-ui,sans-serif;color:rgba(255,255,255,0.55);margin-bottom:4px;}",
      ".cssos-topup-tier{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);cursor:pointer;transition:border-color 120ms ease, background 120ms ease;}",
      ".cssos-topup-tier:hover{border-color:rgba(0,245,160,0.42);background:rgba(0,245,160,0.06);}",
      ".cssos-topup-tier .credits{font:800 18px/1 -apple-system,system-ui,sans-serif;color:#fff;}",
      ".cssos-topup-tier .meta{flex:1;display:flex;flex-direction:column;gap:3px;}",
      ".cssos-topup-tier .meta .bonus{font:700 10.5px/1 ui-monospace,monospace;color:#ffd07a;background:rgba(255,200,80,0.16);padding:2px 7px;border-radius:999px;align-self:flex-start;}",
      ".cssos-topup-tier .price{font:700 14px/1 ui-monospace,monospace;color:#5effc9;background:rgba(0,245,160,0.14);padding:7px 12px;border-radius:8px;}",
      ".cssos-topup-tier.disabled{opacity:.5;cursor:wait;}",
      ".cssos-topup-rates{font:500 11px/1.5 ui-monospace,monospace;color:rgba(255,255,255,0.4);padding:8px 0 0;border-top:1px solid rgba(255,255,255,0.06);}",
      ".cssos-topup-staff{margin:0 0 6px;padding:9px 12px;border-radius:8px;background:rgba(0,245,160,0.10);border:1px solid rgba(0,245,160,0.32);color:#5effc9;font:600 12px/1.35 -apple-system,system-ui,sans-serif;}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function isStaff() {
    try {
      var email = String((globalThis.authState?.user?.email) || "").toLowerCase();
      if (!email) return false;
      if (email.endsWith("@cssstudio.app")) return true;
      if (email === "jingdudc@gmail.com") return true;
      var role = String((globalThis.authState?.user?.role) || (globalThis.authState?.role) || "").toLowerCase();
      return role === "admin";
    } catch (_) { return false; }
  }

  async function open() {
    injectStyles();
    var backdrop = document.createElement("div");
    backdrop.className = "cssos-topup-backdrop";
    backdrop.innerHTML = ''
      + '<div class="cssos-topup-modal">'
      + '  <div class="head">'
      + '    <div class="title">💎 ' + esc(tr("Top up credits", "充值积分")) + '</div>'
      + '    <div class="balance" id="cssos-topup-balance">…</div>'
      + '    <button class="close" aria-label="Close">✕</button>'
      + '  </div>'
      + '  <div class="body">'
      + (isStaff()
          ? '    <div class="cssos-topup-staff">✓ ' + esc(tr(
              "Staff exemption active — your creations are billed but never deducted from your balance.",
              "员工豁免已激活——你的创作仍记账，但不扣余额。"
            )) + '</div>'
          : '')
      + '    <div class="note">' + esc(tr(
            "Credits are used for AI creation. Single song = 1 · triptych = 3 · opera = 5 · music = 10 · video = 50.",
            "积分用于 AI 创作。单曲 = 1 · 三部曲 = 3 · 歌剧 = 5 · 音乐 = 10 · 视频 = 50。"
          )) + '</div>'
      + (TIERS.map(function (t) {
          return ''
            + '<div class="cssos-topup-tier" data-product="' + esc(t.product_id) + '" data-credits="' + t.credits + '">'
            + '  <div class="credits">' + t.credits + '</div>'
            + '  <div class="meta">'
            + '    <div>' + esc(tr(t.credits + " credits", t.credits + " 积分")) + '</div>'
            + (t.bonus ? '    <div class="bonus">' + esc(t.bonus) + '</div>' : '')
            + '  </div>'
            + '  <div class="price">' + esc(t.label) + '</div>'
            + '</div>';
        }).join(""))
      + '    <div class="cssos-topup-rates">'
      + (isIosNative()
          ? esc(tr("Apple handles cancellation, refunds, and receipts.", "Apple 负责取消、退款和发票。"))
          : esc(tr("Stripe handles your payment. Cards, Apple Pay, Google Pay accepted.", "Stripe 处理支付：信用卡 / Apple Pay / Google Pay。")))
      + '    </div>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(backdrop);

    var close = function () { try { backdrop.remove(); } catch (_) {} };
    backdrop.querySelector(".close").addEventListener("click", close);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });

    // Load current balance.
    try {
      var r = await fetch("/api/credits/balance", { credentials: "include" });
      var j = await r.json();
      var b = backdrop.querySelector("#cssos-topup-balance");
      if (b) b.textContent = j.ok ? (j.balance + " " + tr("credits", "积分")) : "—";
    } catch (_) {}

    // Wire tier clicks.
    backdrop.querySelectorAll(".cssos-topup-tier").forEach(function (row) {
      row.addEventListener("click", async function () {
        if (row.classList.contains("disabled")) return;
        var productId = row.getAttribute("data-product");
        var credits = parseInt(row.getAttribute("data-credits"), 10) || 0;
        row.classList.add("disabled");
        if (isIosNative()) {
          // StoreKit IAP path.
          if (!globalThis.cssosIapNative || typeof globalThis.cssosIapNative.purchaseCreditPack !== "function") {
            row.classList.remove("disabled");
            if (typeof globalThis.showToast === "function") {
              globalThis.showToast(tr("IAP bridge not ready. Please update TestFlight.", "IAP 桥未就绪，请更新 TestFlight。"));
            }
            return;
          }
          try {
            var result = await globalThis.cssosIapNative.purchaseCreditPack(credits);
            if (result && result.ok) {
              close();
              if (typeof globalThis.showToast === "function") {
                globalThis.showToast(tr("Credits added: ", "积分已到账：") + credits);
              }
            } else if (result && result.error === "user_cancelled") {
              row.classList.remove("disabled");
            } else {
              row.classList.remove("disabled");
              if (typeof globalThis.showToast === "function") {
                globalThis.showToast(tr("Payment failed: ", "支付失败：") + (result?.error || "unknown"));
              }
            }
          } catch (err) {
            row.classList.remove("disabled");
            if (typeof globalThis.showToast === "function") {
              globalThis.showToast(String(err && err.message || err));
            }
          }
        } else {
          // Web Stripe path.
          try {
            var rs = await fetch("/api/credits/topup/start", {
              method: "POST", credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ product_id: productId }),
            });
            var js = await rs.json();
            if (rs.ok && js.ok && js.checkout_url) {
              window.location.href = js.checkout_url;
            } else {
              row.classList.remove("disabled");
              if (typeof globalThis.showToast === "function") {
                globalThis.showToast(tr("Couldn't start checkout: ", "结账启动失败：") + (js.error || rs.status));
              }
            }
          } catch (err) {
            row.classList.remove("disabled");
            if (typeof globalThis.showToast === "function") {
              globalThis.showToast(String(err && err.message || err));
            }
          }
        }
      });
    });
  }

  globalThis.cssosOpenCreditsTopup = open;

  // Inject into the agent ⋯ overflow menu.
  function wireMenu() {
    var menu = document.querySelector(".cssos-agent-overflow-menu");
    if (!menu) return;
    if (menu.querySelector('[data-act="topup"]')) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item";
    btn.setAttribute("data-act", "topup");
    btn.innerHTML = '<span class="glyph">💎</span><span>' + esc(tr("Top up credits", "充值积分")) + '</span>';
    btn.addEventListener("click", function () {
      menu.hidden = true;
      open();
    });
    menu.appendChild(btn);
  }
  function start() {
    var passes = 0;
    var tick = setInterval(function () {
      passes++;
      wireMenu();
      if (passes >= 30) clearInterval(tick);
    }, 1000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
