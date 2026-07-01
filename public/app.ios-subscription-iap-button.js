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
      /* CSSOS_WAVE_1152 — Jing: admin / free / 当前套餐 → 置灰不可订阅(防苹果审核点了报错)。 */
      '.cssos-ios-iap-btn.is-locked{background:#3a3a3c;color:rgba(255,255,255,.55);cursor:not-allowed;opacity:1;}',
      '.cssos-ios-iap-btn.is-locked:hover{background:#3a3a3c;transform:none;}',
      '.cssos-ios-iap-btn .apple-glyph{font-size:18px;line-height:1;}',
      /* CSSOS_WAVE_1510 — Apple Guideline 4「字太小」: 11px→13px 提可读性。 */
      '.cssos-ios-iap-hint{font:500 13px/1.5 -apple-system,system-ui,sans-serif;color:rgba(0,0,0,.62);margin-top:6px;text-align:center;}',
      /* CSSOS_WAVE_1510 — Apple 3.1.1「恢复购买」按钮(逻辑 cssosIapNative.restorePurchases 早有, 缺可见按钮)。 */
      /* CSSOS_WAVE_1512 — 回退态(未登录)底部留足 Dock 高度, 别和话筒/底栏打架。 */
      '.cssos-ios-restore-wrap{padding:8px 0 104px;}',
      '.cssos-ios-restore{display:block;width:100%;padding:15px 18px;border-radius:14px;background:transparent;color:#0a84ff;border:1.5px solid #0a84ff;cursor:pointer;font:600 16px/1.2 -apple-system,system-ui,sans-serif;}',
      '.cssos-ios-restore:active{background:rgba(10,132,255,.12);}',
      '.cssos-ios-restore:disabled{opacity:.6;cursor:wait;}',
      /* CSSOS_WAVE_1512 — 与 Delete account 并排的紧凑蓝框变体(同尺寸的一对)。 */
      '.cssos-ios-restore.cssos-ios-restore--inline{display:inline-block;width:auto;margin-right:10px;vertical-align:top;padding:9px 16px;border-radius:8px;border:1px solid rgba(10,132,255,.6);font:600 13px/1.2 -apple-system,system-ui,sans-serif;}',
      '.cssos-ios-restore-hint{text-align:center;font:400 14px/1.5 -apple-system,system-ui,sans-serif;color:rgba(90,100,110,.9);margin-bottom:10px;}',
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
    button.innerHTML = '<span class="apple-glyph"></span> ' + esc(tr("Opening App Store…", "正在打开 App Store…"));
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
            "In-App Purchase isn't available in this build. Please try again later.",
            "本版本暂不支持内购，请稍后再试。"
          ));
        }
      } else if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tr("Could not complete the purchase: ", "购买未完成：") + err);
      }
    } catch (e) {
      console.warn("[ios-iap-btn] purchase threw:", e);
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tr("Purchase error: ", "购买出错：") + (e && e.message ? e.message : String(e)));
      }
    } finally {
      button.disabled = false;
      button.innerHTML = orig;
    }
  }

  // CSSOS_WAVE_1152 — Jing 指令: 已拥有/不可购买的等级, 订阅按钮置灰不可点(苹果审核 demo 账号若是
  //   admin, 点 "Subscribe with Apple" 会报错/无响应 → 2.1 拒因)。admin & free & 当前套餐都锁。
  function currentTier() {
    try { return (typeof globalThis.getAccessTier === "function") ? String(globalThis.getAccessTier() || "").toLowerCase() : ""; } catch (_e) { return ""; }
  }
  function isAdminTier() {
    var t = currentTier();
    if (t === "admin") return true;
    try { if (typeof globalThis.hasPanelPermission === "function" && globalThis.hasPanelPermission("admin.panel")) return true; } catch (_e) {}
    return false;
  }

  function injectButtons() {
    var cards = findUninjectedCards();
    if (!cards.length) return;
    injectStyles();
    var admin = isAdminTier();
    var cur = currentTier();
    cards.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cssos-ios-iap-btn";
      btn.setAttribute("data-iap-tier", c.tier);
      var lockReason = admin ? "admin" : (String(c.tier).toLowerCase() === "free" ? "free" : (String(c.tier).toLowerCase() === cur ? "current" : ""));
      if (lockReason) {
        btn.classList.add("is-locked");
        btn.disabled = true;
        btn.innerHTML = esc(
          lockReason === "admin" ? tr("Included with Admin", "管理员已包含")
            : lockReason === "free" ? tr("Free — no subscription", "免费 · 无需订阅")
              : tr("Current plan", "当前套餐")
        );
      } else {
        btn.innerHTML = '<span class="apple-glyph"></span> ' + esc(tr("Subscribe with Apple", "通过 Apple 订阅"));
        btn.addEventListener("click", function () { startPurchase(btn, c.tier); });
      }
      // Insert immediately after the (hidden) pay-group so the layout
      // is still under the tier description.
      if (c.anchor.parentElement) {
        c.anchor.parentElement.insertBefore(btn, c.anchor.nextSibling);
      } else {
        c.anchor.appendChild(btn);
      }
    });
  }

  /* CSSOS_WAVE_814 20260616 — rewrite each tier card's price label to the
   * REAL localized StoreKit price (e.g. "$14.99/month"), so the in-app
   * display matches exactly what Apple charges (Jing: 网页价 $15 vs 内购
   * $14.99 不一致). Pulls live from StoreKit → always correct currency &
   * amount, no hardcode drift. Web is untouched (its $15 display == its
   * Stripe charge, internally consistent). */
  var TIER_PRODUCT = {
    starter: "app.cssstudio.studio.starter.monthly",
    pro: "app.cssstudio.studio.pro.monthly",
    studio: "app.cssstudio.studio.studio.monthly",
    enterprise: "app.cssstudio.studio.enterprise.monthly"
  };
  var _skPrices = null, _skFetching = false;
  async function ensurePrices() {
    if (_skPrices) return _skPrices;
    if (_skFetching) return null;
    _skFetching = true;
    try {
      if (globalThis.cssosIapNative && typeof globalThis.cssosIapNative.getStoreKitPrices === "function") {
        var ids = Object.keys(TIER_PRODUCT).map(function (k) { return TIER_PRODUCT[k]; });
        _skPrices = await globalThis.cssosIapNative.getStoreKitPrices(ids);
      }
    } catch (_) {}
    _skFetching = false;
    return _skPrices;
  }
  async function fixPrices() {
    var prices = await ensurePrices();
    if (!prices) return;
    var perMo = tr("/month", "/月");
    var btns = document.querySelectorAll('[data-subscription-select-tier], [data-subscription-direct-tier]');
    for (var i = 0; i < btns.length; i++) {
      var el = btns[i];
      var tier = el.getAttribute("data-subscription-select-tier") || el.getAttribute("data-subscription-direct-tier");
      var pid = TIER_PRODUCT[tier];
      if (!pid || !prices[pid]) continue;
      var card = el.closest(".work-card");
      if (!card) continue;
      var info = card.querySelector(".work-info");
      if (!info) continue;
      var priceEl = info.querySelector(".work-tags"); // first .work-tags = price line
      if (!priceEl || priceEl.getAttribute("data-iap-priced") === "1") continue;
      priceEl.textContent = prices[pid] + perMo;
      priceEl.setAttribute("data-iap-priced", "1");
    }
  }
  /* CSSOS_WAVE_1510 — Apple 3.1.1: 触发已有的 restorePurchases() 恢复流程。 */
  async function runRestore(btn) {
    if (!globalThis.cssosIapNative || typeof globalThis.cssosIapNative.restorePurchases !== "function") {
      if (typeof globalThis.showToast === "function") globalThis.showToast(tr("Restore isn't available. Reopen the app and try again.", "恢复暂不可用，请重开 App 再试。"));
      return;
    }
    btn.disabled = true;
    var orig = btn.textContent;
    btn.textContent = tr("Restoring…", "正在恢复…");
    try {
      var r = await globalThis.cssosIapNative.restorePurchases();
      if (r && r.ok) {
        // CSSOS_WAVE_1514 — 恢复成功但 0 笔 → 明确告知"没有可恢复的购买"(别误报"已恢复")。
        var count = Number(r.restored != null ? r.restored : (r.transactions ? r.transactions.length : 1)) || 0;
        var okMsg = count > 0
          ? tr("Purchases restored.", "购买已恢复。")
          : tr("No previous purchases to restore.", "没有可恢复的历史购买。");
        if (typeof globalThis.showToast === "function") globalThis.showToast(okMsg);
        if (typeof globalThis.fetchBillingStatus === "function") await globalThis.fetchBillingStatus().catch(function () {});
        if (typeof globalThis.renderSubscriptionPanelModule === "function") await globalThis.renderSubscriptionPanelModule();
        // CSSOS_WAVE_1516 — Jing「点完 Restore 按钮消失」根因: renderSubscriptionPanelModule
        //   重建面板会冲掉注入的 Restore 胶囊, 而 watcher 可能已停(8 passes 后)→ 不再补回。
        //   修: 重渲染后立即重新注入(即时 + 250ms 兜底)。
        try { refreshIosSubUi(); } catch (_e) {}
        setTimeout(function () { try { refreshIosSubUi(); } catch (_e2) {} }, 250);
      } else {
        var e = String((r && r.error) || "");
        if (typeof globalThis.showToast === "function") globalThis.showToast(
          e === "no_purchases" ? tr("No previous purchases to restore.", "没有可恢复的历史购买。")
            : tr("Restore did not complete: ", "恢复未完成：") + (e || "unknown"));
      }
    } catch (e) {
      if (typeof globalThis.showToast === "function") globalThis.showToast(tr("Restore error: ", "恢复出错：") + (e && e.message ? e.message : String(e)));
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  /* CSSOS_WAVE_1510 — Apple 3.1.1: 订阅面板注入一个显眼的「Restore Purchases」按钮(整面板一个)。
   * CSSOS_WAVE_1512 20260701 — Jing: ①之前贴在面板最底和 Dock(话筒排)打架, 违反「每个面板底部
   * 留 Dock 高度」铁律 ②Jing 建议和「Delete account」并排。修: 优先把 Restore 按钮插到
   * Delete account 按钮【右边并排】(同一 danger-zone 行内), 并给该区加 Dock 高度底部留白;
   * 未登录(无 delete 区)时才回退到面板底部, 同样留足底部空间清 Dock。 */
  function makeRestoreBtn() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cssos-ios-restore";
    btn.textContent = tr("Restore Purchases", "恢复购买");
    btn.addEventListener("click", function () { runRestore(btn); });
    return btn;
  }

  /* CSSOS_WAVE_1512b 20260701 — 自我纠正, 防时序竞态: 若 Restore 先于 Delete account 渲染而落到
   * 底部回退位, 一旦 Delete 出现就把它【挪到 Delete 旁边并排】(旧版 dedup 锁死会永远留底部)。 */
  function injectRestoreButton() {
    var panel = document.getElementById("subscription-panel");
    if (!panel) return;
    injectStyles();
    var existing = panel.querySelector(".cssos-ios-restore");
    var delBtn = panel.querySelector("[data-subscription-delete-account]");

    // 期望态: 和 Delete account 组成【胶囊宪法】2 段均分胶囊(Jing W1515)。
    //   激活段 = Restore(在前, 满圆凸, 蓝渐变填充); 未激活段 = Delete(在后, 透明红字)。
    //   轨道与胶囊共用边框零间隙, 只两段间留 6px 缝。Restore 是正常操作放前, Delete 危险放后。
    if (delBtn) {
      // CSSOS_WAVE_1519 — 稳健重构: 不再【移动线上的原始 delBtn】(重渲染/多次注入/滚动交织
      //   会把它冲掉或挤出滚动区 → Delete 消失)。改为: 隐藏原始 delBtn, 注入器在轨道里放
      //   【自己的一对全新按钮】(Restore + Delete), Delete 直接调删号流程。注入器完全自持胶囊,
      //   重渲染再多次也稳。paddingBottom 永远加在危险区(closest), 绝不加到轨道。
      var dz = delBtn.closest(".subscription-account-danger-zone") || delBtn.parentElement || panel;
      delBtn.style.display = "none"; // 藏起原始按钮, 由我们的胶囊呈现
      if (panel.querySelector("#cssos-account-caps")) { dz.style.paddingBottom = "104px"; return; }
      // 清掉任何旧的独立 Restore 实例(底部回退 wrap / 早期 inline)。
      if (existing) { var staleWrap = existing.closest("#cssos-ios-restore-wrap"); (staleWrap || existing).remove(); }
      var track = document.createElement("div");
      track.id = "cssos-account-caps";
      // CSSOS_WAVE_1520 — Jing: 删除账号必须【始终可见】(横向滑动会把 Delete 藏到右边 → 苹果判
      //   无删号功能, 合规红线)。改真·均分 50/50(flex:1 1 0), 两段永远都在, 不滑动不隐藏。
      // CSSOS_WAVE_1521 — 色调宪法: 品牌黑+绿。激活段=翠绿渐变填充+深墨字(不再用蓝!),
      //   危险段=透明+红描边字。见 memory/color_and_type_constitution。
      track.style.cssText = "display:flex;align-items:stretch;gap:6px;border-radius:999px;overflow:hidden;border:1px solid rgba(10,143,95,.30);max-width:440px;";
      var segStyle = "flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:999px;padding:11px 10px;cursor:pointer;";
      // 激活段: Restore(满圆凸, 翠绿渐变 + 深墨字)。makeRestoreBtn 已挂点击→runRestore。
      var rBtn = makeRestoreBtn();
      rBtn.className = "cssos-ios-restore"; // 保留基类供去重查询
      rBtn.innerHTML = '<span style="font-size:14px;">🔄</span> ' + esc(tr("Restore Purchases", "恢复购买"));
      rBtn.style.cssText = segStyle + "background:linear-gradient(120deg,#00f5a0,#0bf7ff);color:#04120c;font:700 13px/1 -apple-system,system-ui,sans-serif;";
      // 未激活段: Delete(透明, 红字)—— 全新按钮, 点击直调删号流程(与原始按钮同一逻辑)。
      var dBtn = document.createElement("button");
      dBtn.type = "button";
      dBtn.className = "cssos-account-caps-delete";
      dBtn.innerHTML = '<span style="font-size:14px;">🗑</span> ' + esc(tr("Delete account", "删除账号"));
      dBtn.style.cssText = segStyle + "background:transparent;color:#e5484d;font:600 13px/1 -apple-system,system-ui,sans-serif;";
      dBtn.addEventListener("click", function () {
        if (typeof globalThis.cssosRunDeleteAccountFlow === "function") globalThis.cssosRunDeleteAccountFlow(dBtn);
        else if (typeof globalThis.handleGlobalAction === "function") globalThis.handleGlobalAction("profile");
      });
      track.appendChild(rBtn);
      track.appendChild(dBtn);
      dz.insertBefore(track, delBtn); // 放在(已隐藏的)原始按钮前
      dz.style.paddingBottom = "104px"; // 清 Dock(话筒/底栏)
      return;
    }

    // 回退: 未登录/无 delete 区 → 面板底部, 带 hint + Dock 底部留白。只放一次。
    if (existing) return;
    var anyTier = panel.querySelector("[data-subscription-select-tier], [data-subscription-direct-tier]");
    var card = anyTier && anyTier.closest(".work-card");
    var host = (card && card.parentElement) || panel;
    if (!host) return;
    var wrap = document.createElement("div");
    wrap.id = "cssos-ios-restore-wrap";
    wrap.className = "cssos-ios-restore-wrap";
    var hint = document.createElement("div");
    hint.className = "cssos-ios-restore-hint";
    hint.textContent = tr("Already subscribed on another device? Restore it here.", "在其他设备已订阅？点此恢复购买。");
    wrap.appendChild(hint);
    wrap.appendChild(makeRestoreBtn());
    host.appendChild(wrap);
  }

  /* CSSOS_WAVE_1511 20260701 — Jing: 「10 Extra Generations 一直无法购买」。
   * 真凶: Creator Boost 卡的 Stripe/NihaoPay 按钮在 iOS 被 ios-native-gate
   * 全隐藏, 而 boost 档【没有】预注册的 StoreKit 产品(IAP_PRODUCT_CATALOG
   * 只有 4 个积分包 + 订阅), 所以卡上两个付款按钮都没了 → 无处可点。
   * 修: iOS 上给「10 Extra Generations」卡注入一个可用的 Apple 按钮, 打开
   * 已上架、能用的积分包 IAP(cssosOpenCreditsTopup)。生成本就扣积分,
   * 买积分 = 拿生成额度, 同一结果, 且无需向 App Store 新增产品(审核期不
   * 能新建产品)。只碰 generation 这张卡, 其它 boost 卡不动。 */
  function injectBoostIapButton() {
    var genBtn = document.querySelector('[data-subscription-buy-boost="generation"]');
    if (!genBtn) return;
    var card = genBtn.closest(".boost-shop-card") || genBtn.closest(".pay-group") || genBtn.parentElement;
    if (!card) return;
    if (card.querySelector(".cssos-ios-iap-btn[data-iap-boost=\"generation\"]")) return;
    injectStyles();
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cssos-ios-iap-btn";
    btn.setAttribute("data-iap-boost", "generation");
    btn.innerHTML = '<span class="apple-glyph"></span> ' + esc(tr("Get generations with Apple", "通过 Apple 获取生成额度"));
    btn.addEventListener("click", function () {
      if (typeof globalThis.cssosOpenCreditsTopup === "function") {
        globalThis.cssosOpenCreditsTopup();
      } else if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tr("Top-up isn't ready. Reopen the app and try again.", "充值暂不可用，请重开 App 再试。"));
      }
    });
    card.appendChild(btn);
    var hint = document.createElement("div");
    hint.className = "cssos-ios-iap-hint";
    hint.textContent = tr("Buy a credit pack — credits fund your generations.", "购买积分包 · 积分即可用于生成。");
    card.appendChild(hint);
  }

  function refreshIosSubUi() { injectButtons(); fixPrices(); injectRestoreButton(); injectBoostIapButton(); }

  // Re-scan whenever the subscription panel renders (it lazy-loads
  // and re-renders after tier changes). Cheap: 8s × 30s = 4 passes.
  function startWatcher() {
    refreshIosSubUi();
    var passes = 0;
    var tick = setInterval(function () {
      passes++;
      refreshIosSubUi();
      if (passes >= 8) clearInterval(tick);
    }, 1200);
    // Also re-scan on focus + when panel close/open events fire.
    window.addEventListener("focus", refreshIosSubUi);
    document.addEventListener("click", function () { setTimeout(refreshIosSubUi, 200); }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatcher);
  } else {
    startWatcher();
  }
})();
