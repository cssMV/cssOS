/* CSSOS_WAVE_1795 20260729 — Jing 的「入口埋太深」扫描结果之二、之三。
 *
 * 扫描发现两个跟钱直接相关的入口位置不合理:
 *  ① 充值(cssosOpenCreditsTopup)埋在 AI 助理右上角的 ⋯ 菜单里。
 *     用户想给我们钱,得先想到去点 AI 助理 —— 这是条收入路径,不该这么放。
 *  ② 优惠码兑换【全平台没有任何 UI 入口】,只能靠 ?coupon=CODE 深链;
 *     手里拿着码(比如 PHUNT)但没走深链的人,在平台上找不到任何地方输入。
 *
 * 两者都属于「账户 / 钱」,Profile 面板才是它们的语义归属。这里给 Profile 各挂一行
 * 常驻入口。不进 Dock —— Dock 已有 19 项,每项还有 120px 最小宽度硬底线(W490)。
 *
 * 实现沿用 W1791 生日行的同一套路:Profile 面板会整块重渲,所以
 *  · 点击用【事件委托】(挂 document,不挂会被冲掉的 DOM)
 *  · 文案用【MutationObserver】回填
 * 锚点是 app.profile-panel.js 模板里的 data-cssos-account-row="topup|coupon"。 */
(function () {
  "use strict";
  if (globalThis.__cssosProfileAccountRowsWired) return;
  globalThis.__cssosProfileAccountRowsWired = true;

  function tr(en) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en); } catch (_e) {}
    return en;
  }
  function toast(m) {
    try { if (typeof globalThis.showToast === "function") globalThis.showToast(m); } catch (_e) {}
  }

  var LABELS = {
    topup: function () { return tr("Top up credits"); },
    coupon: function () { return tr("Redeem a promo code"); }
  };

  function paintRows() {
    var rows = document.querySelectorAll("[data-cssos-account-row]");
    for (var i = 0; i < rows.length; i++) {
      var k = rows[i].getAttribute("data-cssos-account-row");
      var f = LABELS[k];
      if (!f) continue;
      var want = f();
      if (rows[i].textContent.trim() !== want) rows[i].textContent = want;
    }
  }

  function openTopup() {
    if (typeof globalThis.cssosOpenCreditsTopup === "function") { globalThis.cssosOpenCreditsTopup(); return; }
    if (typeof globalThis.openCreditsTopupModal === "function") { globalThis.openCreditsTopupModal(); return; }
    toast(tr("Top-up is still loading — try again in a moment."));
  }

  function openCoupon() {
    if (typeof globalThis.cssosOpenCouponRedeem === "function") { globalThis.cssosOpenCouponRedeem(); return; }
    toast(tr("Promo codes are still loading — try again in a moment."));
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;
    var row = t.closest("[data-cssos-account-row]");
    if (!row) return;
    e.preventDefault();
    var k = row.getAttribute("data-cssos-account-row");
    if (k === "topup") openTopup();
    else if (k === "coupon") openCoupon();
  });

  function observe() {
    if (typeof MutationObserver !== "function") return;
    var pending = false;
    var mo = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; paintRows(); }, 120);
    });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { observe(); paintRows(); });
  } else {
    observe();
    paintRows();
  }
})();
