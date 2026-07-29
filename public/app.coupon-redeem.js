/* CSSOS_WAVE_1660 — 优惠码兑换 (前端 Phase 1)。
 *  - globalThis.cssosRedeemCoupon(code) → POST /api/coupons/redeem → toast 结果。
 *  - globalThis.cssosOpenCouponRedeem() → 简易输入弹框(供 UI 挂钩)。
 *  - 深链 ?coupon=CODE → 自动兑换(未登录先存 sessionStorage, 弹登录, 登录后再兑)。
 *    PH 专属链接示例: https://cssstudio.app/?coupon=PHUNT
 */
(function () {
  "use strict";
  if (globalThis.__cssosCouponInstalled) return;
  globalThis.__cssosCouponInstalled = true;

  // CSSOS_WAVE_1795 — 本文件原来没有 i18n 助手(只有深链兑换,无 UI)。
  //   加上 W1795 的兑换弹窗后需要它;沿用平台惯例:英文是唯一真源,
  //   loginCopy 会忽略第二个参数并路由到 tr(en)。
  function tr(en, _zhIgnoredLegacy) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en); } catch (_e) {}
    return en;
  }

  // 模块解析即抓 URL 里的码(远早于 URL 被清空)。
  var _pendingCode = "";
  try { var m0 = (location.search || "").match(/[?&]coupon=([^&]+)/i); if (m0) _pendingCode = decodeURIComponent(m0[1]); } catch (_e) {}

  function toast(msg, ok) {
    try { if (typeof globalThis.cssosToast === "function") { globalThis.cssosToast(msg); return; } } catch (_e) {}
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:2147483600;" +
      "background:" + (ok ? "linear-gradient(135deg,#00f5a0,#00c884)" : "rgba(18,18,22,.96)") + ";" +
      "color:" + (ok ? "#052018" : "#fff") + ";padding:12px 20px;border-radius:999px;" +
      "font:700 14px/1.35 -apple-system,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45);max-width:90vw;text-align:center;";
    document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (_e) {} }, 4400);
  }

  function describe(g) {
    if (!g) return "🎉 Coupon redeemed!";
    if (g.type === "subscription") return "🎉 " + String(g.tier || "").toUpperCase() + " unlocked for " + g.days + " days!";
    if (g.type === "credits") return "🎉 $" + (Number(g.credits_cents || 0) / 100).toFixed(2) + " added to your wallet!";
    if (g.type === "gen_rights") return "🎉 " + g.gen_rights + " generation rights added!";
    return "🎉 Coupon redeemed!";
  }

  function redeem(code) {
    code = String(code || "").trim().toUpperCase();
    if (!code) return;
    fetch("/api/coupons/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code }), credentials: "include" })
      .then(function (r) { return r.json().then(function (j) { return { st: r.status, j: j }; }); })
      .then(function (o) {
        if (o.st === 401 || (o.j && o.j.code === "SIGN_IN_REQUIRED")) {
          try { sessionStorage.setItem("cssos_pending_coupon", code); } catch (_e) {}
          toast("Sign in first — your code will apply right after.", false);
          try { if (window.cssosOpenLogin) window.cssosOpenLogin(); } catch (_e) {}
          return;
        }
        if (o.j && o.j.ok) { try { sessionStorage.removeItem("cssos_pending_coupon"); } catch (_e) {} toast(describe(o.j.granted), true); return; }
        var map = { COUPON_NOT_FOUND: "That code isn't valid.", COUPON_EXPIRED: "That code has expired.", COUPON_EXHAUSTED: "That code is fully claimed.", ALREADY_REDEEMED: "You've already redeemed this code.", BAD_TIER: "That code is misconfigured.", GRANT_FAILED: "Couldn't apply that code." };
        toast((o.j && map[o.j.code]) || "Couldn't redeem that code.", false);
      }).catch(function () { toast("Network error — try again.", false); });
  }
  globalThis.cssosRedeemCoupon = redeem;

  /* CSSOS_WAVE_1795 20260729 — 原来这里是 window.prompt("Enter your coupon code:")。
   * 两个问题:①原生 prompt 在 App(WKWebView)里体验很差、也不受 i18n 管;
   * ②【全平台没有任何按钮调用它】—— 优惠码此前只能靠 ?coupon=CODE 深链兑换,
   * 手里拿着码但没走深链的人在平台上找不到任何地方输入(扫描 W1795 发现)。
   * 改成正经小弹窗,并由 app.profile-account-rows.js 在 Profile 面板挂常驻入口。 */
  function openCouponModal() {
    var old = document.getElementById("cssos-coupon-modal");
    if (old) old.remove();
    if (!document.getElementById("cssos-coupon-css")) {
      var st = document.createElement("style");
      st.id = "cssos-coupon-css";
      st.textContent =
        "#cssos-coupon-modal{position:fixed;inset:0;z-index:10072;display:flex;align-items:center;justify-content:center;" +
        "background:rgba(0,0,0,0.46);backdrop-filter:blur(4px);font:500 14px/1.5 -apple-system,system-ui,sans-serif;}" +
        "#cssos-coupon-modal .ccp-card{width:min(92vw,380px);background:#0d1512;color:#e8fff5;" +
        "border:1px solid rgba(0,245,160,0.30);border-radius:18px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,0.55);}" +
        "#cssos-coupon-modal h3{margin:0 0 14px;font-size:18px;font-weight:700;}" +
        "#cssos-coupon-modal input{width:100%;padding:11px 12px;border-radius:12px;background:rgba(0,245,160,0.07);" +
        "border:1px solid rgba(0,245,160,0.28);color:#e8fff5;font-size:15px;letter-spacing:0.08em;text-transform:uppercase;}" +
        "#cssos-coupon-modal .ccp-row{display:flex;gap:10px;margin-top:16px;}" +
        "#cssos-coupon-modal button{flex:1;padding:11px;border-radius:999px;border:1px solid rgba(0,245,160,0.30);" +
        "background:rgba(0,245,160,0.10);color:#e8fff5;font-size:14px;font-weight:600;cursor:pointer;}" +
        "#cssos-coupon-modal button.ccp-go{background:rgba(0,245,160,0.34);}";
      (document.head || document.documentElement).appendChild(st);
    }
    var ov = document.createElement("div");
    ov.id = "cssos-coupon-modal";
    var card = document.createElement("div");
    card.className = "ccp-card";
    var h = document.createElement("h3");
    h.textContent = tr("Redeem a promo code", "兑换优惠码");
    var inp = document.createElement("input");
    inp.type = "text";
    inp.autocapitalize = "characters";
    inp.spellcheck = false;
    inp.placeholder = tr("Enter your code", "输入优惠码");
    var row = document.createElement("div");
    row.className = "ccp-row";
    var cancel = document.createElement("button");
    cancel.textContent = tr("Cancel", "取消");
    var go = document.createElement("button");
    go.className = "ccp-go";
    go.textContent = tr("Redeem", "兑换");
    row.appendChild(cancel); row.appendChild(go);
    card.appendChild(h); card.appendChild(inp); card.appendChild(row);
    ov.appendChild(card);
    function shut() { ov.remove(); }
    function submit() {
      var c = String(inp.value || "").trim();
      if (!c) return;
      shut();
      redeem(c);
    }
    cancel.addEventListener("click", shut);
    go.addEventListener("click", submit);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    ov.addEventListener("click", function (e) { if (e.target === ov) shut(); });
    document.body.appendChild(ov);
    try { inp.focus(); } catch (_e) {}
  }
  globalThis.cssosOpenCouponRedeem = openCouponModal;

  function auto() {
    if (_pendingCode) { redeem(_pendingCode); _pendingCode = ""; return; }
    try { var pend = sessionStorage.getItem("cssos_pending_coupon"); if (pend) redeem(pend); } catch (_e) {}
  }
  if (document.readyState !== "loading") setTimeout(auto, 900);
  else window.addEventListener("DOMContentLoaded", function () { setTimeout(auto, 900); });
})();
