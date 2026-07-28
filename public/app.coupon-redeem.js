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
  globalThis.cssosOpenCouponRedeem = function () { var c = window.prompt("Enter your coupon code:"); if (c) redeem(c); };

  function auto() {
    if (_pendingCode) { redeem(_pendingCode); _pendingCode = ""; return; }
    try { var pend = sessionStorage.getItem("cssos_pending_coupon"); if (pend) redeem(pend); } catch (_e) {}
  }
  if (document.readyState !== "loading") setTimeout(auto, 900);
  else window.addEventListener("DOMContentLoaded", function () { setTimeout(auto, 900); });
})();
