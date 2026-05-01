/*
 * app.payments-checkout.js
 *
 * Self-contained NihaoPay (SecurePay hosted page) checkout bridge.
 * Exposes window.cssPaymentsCheckout.startCheckout({ kind, vendor, amount_cents, ... }).
 *
 * Tracks 4 intent kinds agreed with backend:
 *   topup         — user tops up their billing balance
 *   subscription  — upgrade membership_tier (needs { tier })
 *   purchase      — marketplace item purchase (needs { target_creator_id, target_item_id })
 *   tip           — tip another user (needs { target_creator_id })
 *
 * Vendors: 'alipay' | 'wechatpay' | 'unionpay'.
 *
 * Redirect modes (from backend):
 *   { mode: "url",  url: "https://..." }      -> window.location.href = url
 *   { mode: "form", action: "...", method: "POST", fields: {..} } -> build+submit <form>
 *
 * Intentionally isolated from app.subscription-panel.js / app.market-commerce.js
 * so existing Stripe flows stay untouched.
 */
(function () {
  "use strict";

  const VENDOR_COPY = {
    alipay: { label_zh: "支付宝", label_en: "Alipay" },
    wechatpay: { label_zh: "微信支付", label_en: "WeChat Pay" },
    unionpay: { label_zh: "银联", label_en: "UnionPay" }
  };

  function toast(msg) {
    try {
      if (typeof window.showToast === "function") {
        window.showToast(String(msg || ""));
        return;
      }
    } catch (_e) {}
    try { console.warn("[cssPaymentsCheckout]", msg); } catch (_e) {}
  }

  function setBusy(el, busy) {
    if (!(el instanceof HTMLElement)) return;
    try {
      if (busy) {
        el.setAttribute("disabled", "disabled");
        el.setAttribute("data-css-pay-busy", "1");
      } else {
        el.removeAttribute("disabled");
        el.removeAttribute("data-css-pay-busy");
      }
    } catch (_e) {}
  }

  function submitAutoForm(redirect) {
    const action = String(redirect?.action || "").trim();
    if (!action) {
      toast("支付网关未返回跳转地址 / Payment gateway returned no URL");
      return false;
    }
    const method = String(redirect?.method || "POST").toUpperCase();
    const form = document.createElement("form");
    form.action = action;
    form.method = method;
    form.style.display = "none";
    const fields = redirect?.fields || redirect?.params || {};
    Object.keys(fields).forEach((k) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = String(k);
      input.value = String(fields[k] == null ? "" : fields[k]);
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    return true;
  }

  async function startCheckout(opts) {
    const options = opts || {};
    const kind = String(options.kind || "").trim().toLowerCase();
    const vendor = String(options.vendor || "alipay").trim().toLowerCase();
    const amountCents = Math.max(0, Math.round(Number(options.amount_cents || 0)));
    const trigger = options.trigger || null;

    // CSSOS_PHASE2_BOOST_KIND 20260419 — "boost" is a self-purchase kind
    // used by Creator Boost shop rows (10 Extra Generations, Background
    // Queue Slot, Language/Voice Lane Boost, …). Unlike "purchase" or
    // "tip" it has NO target_creator_id — the buyer is the beneficiary.
    // The backend /api/payments/checkout handler reads the boost kind and
    // quantity out of `note` ("boost:<kind>:<quantity>") so no schema
    // change is required on the backend.
    if (!kind || !["topup", "subscription", "purchase", "tip", "boost"].includes(kind)) {
      toast("支付类型错误 / Invalid payment kind");
      return null;
    }
    if (!["alipay", "wechatpay", "unionpay"].includes(vendor)) {
      toast("请选择支付宝、微信支付或银联 / Pick Alipay, WeChat Pay, or UnionPay");
      return null;
    }
    if (!amountCents || amountCents <= 0) {
      toast("金额必须大于 0 / Amount must be > 0");
      return null;
    }

    // Auth gate — mirror what the existing subscription/market flows do.
    try {
      const authed = !!(window.authState && window.authState.user);
      if (!authed) {
        toast("请先登录 / Please sign in first");
        if (typeof window.openPanel === "function" && window.loginPanel) {
          try { window.openPanel(window.loginPanel); } catch (_e) {}
        }
        return null;
      }
    } catch (_e) {}

    const body = {
      kind,
      vendor,
      amount_cents: amountCents,
      note: typeof options.note === "string" ? options.note : undefined,
      metadata: options.metadata && typeof options.metadata === "object" ? options.metadata : undefined
    };
    if (kind === "subscription") {
      const tier = String(options.tier || "").trim().toLowerCase();
      if (!tier) {
        toast("请选择会员套餐 / Please pick a tier");
        return null;
      }
      body.tier = tier;
    }
    if (kind === "tip" || kind === "purchase") {
      const creatorId = String(options.target_creator_id || "").trim();
      if (!creatorId) {
        toast("缺少收款人 / Missing creator");
        return null;
      }
      body.target_creator_id = creatorId;
    }
    if (kind === "purchase") {
      const itemId = String(options.target_item_id || "").trim();
      if (!itemId) {
        toast("缺少作品信息 / Missing item");
        return null;
      }
      body.target_item_id = itemId;
    }

    setBusy(trigger, true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      const payload = await res.json().catch(() => null);
      const data = (payload && typeof payload === "object" && payload.data && typeof payload.data === "object")
        ? payload.data
        : payload;
      if (!res.ok || (payload && payload.ok === false) || !data) {
        const msg = (payload && (payload.message || payload.error)) || `checkout_failed:${res.status}`;
        throw new Error(String(msg));
      }
      const redirect = data.redirect || {};
      const mode = String(redirect.mode || "").toLowerCase();
      if (mode === "url") {
        const url = String(redirect.url || "").trim();
        if (!url) throw new Error("missing_redirect_url");
        window.location.href = url;
        return data;
      }
      if (mode === "form") {
        if (!submitAutoForm(redirect)) {
          throw new Error("form_redirect_failed");
        }
        return data;
      }
      throw new Error("unsupported_redirect_mode");
    } catch (err) {
      const msg = String((err && err.message) || err || "");
      if (msg.includes("SELF_TIP_NOT_ALLOWED") || msg.includes("SELF_PURCHASE_NOT_ALLOWED")) {
        toast("不能给自己付款 / You can't pay yourself");
      } else if (msg.includes("payments_disabled")) {
        toast("支付通道暂未开启 / Payment gateway not configured");
      } else {
        toast(`支付创建失败 / Checkout failed: ${msg}`);
      }
      return null;
    } finally {
      setBusy(trigger, false);
    }
  }

  async function fetchIntentStatus(intentId) {
    const id = String(intentId || "").trim();
    if (!id) return null;
    try {
      const res = await fetch(`/api/payments/intents/${encodeURIComponent(id)}`, {
        method: "GET",
        credentials: "include"
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || (payload && payload.ok === false)) return null;
      return (payload && payload.data) || payload;
    } catch (_e) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Unified dual-gateway picker modal
  //
  // Presents the user with Stripe (international) + NihaoPay (China) choices
  // in a single dialog. Designed to replace every remaining window.confirm /
  // window.prompt based payment-vendor selection in the app.
  //
  // Usage:
  //   window.cssPaymentsCheckout.openPicker({
  //     title: "Buy 10 extra generations",
  //     subtitle: "$9.90 — one-time",        // optional
  //     amountCents: 990,                    // optional, used for display hint
  //     stripe: {
  //       label: "Pay with card",            // optional override
  //       onSelect: (btn) => { ... }         // required if stripe section shown
  //     },
  //     nihaopay: {
  //       onSelect: (vendor, btn) => { ... } // required if nihaopay shown
  //     },
  //     allowAmountEdit: false,              // if true, shows amount input
  //     amountMinCents: 100,                 // when allowAmountEdit=true
  //     onAmountChange: (cents) => { ... },  // optional live callback
  //     onCancel: () => { ... }              // optional
  //   });
  //
  // Returns a handle { close() } so callers can dismiss programmatically.
  // ---------------------------------------------------------------------------

  let __picker_open = null;

  function tr(key, fallback) {
    try {
      if (typeof window.tr === "function") {
        const v = window.tr(key);
        if (v && v !== key) return v;
      }
    } catch (_e) {}
    return fallback == null ? key : fallback;
  }

  function formatUsd(cents) {
    const n = Math.max(0, Math.round(Number(cents || 0)));
    if (!n) return "";
    return "$" + (n / 100).toFixed(2);
  }

  function closePicker() {
    if (!__picker_open) return;
    const el = __picker_open.root;
    try { document.removeEventListener("keydown", __picker_open.onKey, true); } catch (_e) {}
    try { el && el.parentNode && el.parentNode.removeChild(el); } catch (_e) {}
    __picker_open = null;
  }

  function openPicker(opts) {
    const options = opts || {};
    closePicker();

    const root = document.createElement("div");
    root.className = "css-pay-picker-backdrop";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML = [
      '<div class="css-pay-picker-card" role="document">',
      '  <button type="button" class="css-pay-picker-close" data-pay-picker-close aria-label="',
      tr("common.close", "Close"),
      '">&times;</button>',
      '  <div class="css-pay-picker-head">',
      '    <div class="css-pay-picker-title"></div>',
      '    <div class="css-pay-picker-subtitle"></div>',
      '  </div>',
      '  <div class="css-pay-picker-amount" hidden>',
      '    <label class="css-pay-picker-amount-label"></label>',
      '    <div class="css-pay-picker-amount-row">',
      '      <span class="css-pay-picker-amount-prefix">$</span>',
      '      <input type="number" step="0.01" min="1" class="css-pay-picker-amount-input" />',
      '    </div>',
      '  </div>',
      '  <div class="css-pay-picker-groups"></div>',
      '  <div class="css-pay-picker-foot">',
      '    <button type="button" class="mini-btn css-pay-picker-cancel" data-pay-picker-close></button>',
      '  </div>',
      '</div>'
    ].join("");

    const card = root.querySelector(".css-pay-picker-card");
    const titleEl = root.querySelector(".css-pay-picker-title");
    const subEl = root.querySelector(".css-pay-picker-subtitle");
    const groupsEl = root.querySelector(".css-pay-picker-groups");
    const amountWrap = root.querySelector(".css-pay-picker-amount");
    const amountLabel = root.querySelector(".css-pay-picker-amount-label");
    const amountInput = root.querySelector(".css-pay-picker-amount-input");
    const cancelBtn = root.querySelector(".css-pay-picker-cancel");

    titleEl.textContent = String(options.title || tr("payments.picker.title", "Choose payment method"));
    const subtitle = options.subtitle || formatUsd(options.amountCents);
    if (subtitle) {
      subEl.textContent = String(subtitle);
    } else {
      subEl.remove();
    }

    cancelBtn.textContent = tr("common.cancel", "Cancel");

    // Optional amount input (tip flow etc.)
    let currentCents = Math.max(0, Math.round(Number(options.amountCents || 0)));
    if (options.allowAmountEdit) {
      amountWrap.hidden = false;
      amountLabel.textContent = tr("payments.picker.amountLabel", "Amount (USD)");
      amountInput.value = currentCents ? (currentCents / 100).toFixed(2) : "";
      amountInput.min = Math.max(1, Math.round(Number(options.amountMinCents || 100)) / 100).toFixed(2);
      amountInput.addEventListener("input", () => {
        const parsed = Math.round(Number(amountInput.value || 0) * 100);
        currentCents = parsed > 0 ? parsed : 0;
        try {
          if (typeof options.onAmountChange === "function") options.onAmountChange(currentCents);
        } catch (_e) {}
      });
    }

    function ensureAmountOk() {
      if (!options.allowAmountEdit) return true;
      const minCents = Math.max(1, Math.round(Number(options.amountMinCents || 100)));
      if (!currentCents || currentCents < minCents) {
        toast(tr("payments.picker.amountTooLow", "Please enter a valid amount."));
        try { amountInput.focus(); } catch (_e) {}
        return false;
      }
      return true;
    }

    // Build groups
    const hasStripe = options.stripe && typeof options.stripe.onSelect === "function";
    const hasNihao = options.nihaopay && typeof options.nihaopay.onSelect === "function";

    if (hasStripe) {
      const g = document.createElement("div");
      g.className = "pay-group";
      g.innerHTML = [
        '<div class="pay-group-head"><span class="pay-group-dot intl"></span><span class="pay-group-label">',
        tr("payments.picker.intl", "International · Stripe"),
        '</span></div>',
        '<div class="pay-group-body">',
        '  <button type="button" class="mini-btn pay-stripe" data-pay-stripe>',
        String(options.stripe.label || tr("payments.picker.payWithCard", "Pay with card")),
        '  </button>',
        '</div>'
      ].join("");
      g.querySelector("[data-pay-stripe]").addEventListener("click", (ev) => {
        ev.preventDefault();
        if (!ensureAmountOk()) return;
        const btn = ev.currentTarget;
        try { options.stripe.onSelect(btn, { amount_cents: currentCents }); } catch (e) { console.error(e); }
        closePicker();
      });
      groupsEl.appendChild(g);
    }

    if (hasNihao) {
      const g = document.createElement("div");
      g.className = "pay-group";
      g.innerHTML = [
        '<div class="pay-group-head"><span class="pay-group-dot cn"></span><span class="pay-group-label">',
        tr("payments.picker.cn", "China · NihaoPay"),
        '</span></div>',
        '<div class="pay-group-body">',
        '  <button type="button" class="mini-btn pay-vendor alipay" data-pay-nihao="alipay">',
        VENDOR_COPY.alipay.label_en, ' / ', VENDOR_COPY.alipay.label_zh,
        '  </button>',
        '  <button type="button" class="mini-btn pay-vendor wechatpay" data-pay-nihao="wechatpay">',
        VENDOR_COPY.wechatpay.label_en, ' / ', VENDOR_COPY.wechatpay.label_zh,
        '  </button>',
        '  <button type="button" class="mini-btn pay-vendor unionpay" data-pay-nihao="unionpay">',
        VENDOR_COPY.unionpay.label_en, ' / ', VENDOR_COPY.unionpay.label_zh,
        '  </button>',
        '</div>'
      ].join("");
      g.querySelectorAll("[data-pay-nihao]").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          if (!ensureAmountOk()) return;
          const vendor = String(btn.getAttribute("data-pay-nihao") || "").toLowerCase();
          try { options.nihaopay.onSelect(vendor, btn, { amount_cents: currentCents }); } catch (e) { console.error(e); }
          closePicker();
        });
      });
      groupsEl.appendChild(g);
    }

    if (!hasStripe && !hasNihao) {
      const msg = document.createElement("div");
      msg.className = "css-pay-picker-empty";
      msg.textContent = tr("payments.picker.empty", "No payment methods configured.");
      groupsEl.appendChild(msg);
    }

    // Wire close buttons and backdrop click + ESC
    root.querySelectorAll("[data-pay-picker-close]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        try { if (typeof options.onCancel === "function") options.onCancel(); } catch (_e) {}
        closePicker();
      });
    });
    root.addEventListener("click", (ev) => {
      if (ev.target === root) {
        try { if (typeof options.onCancel === "function") options.onCancel(); } catch (_e) {}
        closePicker();
      }
    });
    const onKey = (ev) => {
      if (ev.key === "Escape" || ev.keyCode === 27) {
        ev.preventDefault();
        try { if (typeof options.onCancel === "function") options.onCancel(); } catch (_e) {}
        closePicker();
      }
    };
    document.addEventListener("keydown", onKey, true);

    document.body.appendChild(root);
    __picker_open = { root, onKey };

    // Focus first actionable button
    try {
      const first = root.querySelector(".pay-group-body .mini-btn");
      if (first && typeof first.focus === "function") first.focus();
    } catch (_e) {}

    return { close: closePicker };
  }

  window.cssPaymentsCheckout = Object.freeze({
    VENDOR_COPY,
    startCheckout,
    fetchIntentStatus,
    openPicker,
    closePicker
  });
})();
