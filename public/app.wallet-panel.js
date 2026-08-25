// CSSOS_WAVE_1950 20260825 — 平台钱包面板。
//
// Jing:「我们经常提到平台钱包, 我没有亲眼见过…我想象中的平台, 应该是可以充值,
// 有支出收入等明细可查, 有一般钱包的实用功能。是吗?」
//
// 查下来: 后端是齐的, 前端只有半个 ——
//   /api/credits/balance      查余额          ✅
//   /api/credits/topup/start  充值            ✅ (已有弹窗 cssosOpenCreditsTopup)
//   /api/billing/ledger       收支明细        ✅ 接口在, 但【前端没有任何地方调它】
//   提现                       ❌ 宪法写了($20 起 / 两周到账), 端点还没有
// 所以 Jing 从来没见过钱包不是他漏看 —— 是它没有入口。
//
// 这块为什么必须先做(它不只是"给 Jing 看一眼"):
//   付费漏斗的第一步就撞在这里。用户想付钱找不到钱包在哪; 充了钱看不到有没有进账;
//   被扣了费不知道扣在哪一笔; 想提现没有入口。**没有人会往一个看不见的钱包里放钱。**
//
// 两条不粉饰的规矩:
//   ① 提现还没做 → 就明说"开放中", 不放一个点了没反应的假按钮。假按钮比没按钮更伤信任。
//   ② 账目里大量 amount=0 的条目是真的免费步骤(engine=cssmv-local), 不是漏记 ——
//      所以照实显示 $0.00 并标注"免费", 不藏起来。藏起来用户会以为系统吞了钱。

(function () {
  "use strict";
  if (globalThis.__cssosWalletPanelWired) return;
  globalThis.__cssosWalletPanelWired = true;

  function lc(en, zh) {
    try { if (typeof globalThis.tr === "function") return globalThis.tr(en); } catch (_e) {}
    return en;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(cents) {
    var n = Number(cents || 0) / 100;
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function when(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
             " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch (_e) { return String(iso).slice(0, 16); }
  }

  function injectStyles() {
    if (document.getElementById("cssos-wallet-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-wallet-style";
    st.textContent = [
      "#cssos-wallet-overlay{position:fixed;inset:0;z-index:100060;display:flex;align-items:center;justify-content:center;",
      "  background:rgba(2,11,8,.72);backdrop-filter:blur(10px);}",
      ".wl-card{position:relative;width:min(680px,94vw);max-height:88vh;overflow:auto;border-radius:22px;",
      "  background:linear-gradient(160deg,rgba(10,34,26,.98),rgba(4,16,12,.98));",
      "  border:1px solid rgba(0,245,160,.30);box-shadow:0 24px 80px rgba(0,0,0,.6);padding:26px 24px 20px;}",
      ".wl-x{position:absolute;top:12px;right:14px;width:34px;height:34px;border-radius:999px;border:0;",
      "  background:rgba(255,255,255,.08);color:#eafff6;font-size:19px;cursor:pointer;}",
      ".wl-x:hover{background:rgba(255,255,255,.16);}",
      ".wl-title{font-size:15px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:rgba(234,255,246,.62);}",
      ".wl-bal{margin:6px 0 2px;font-size:44px;font-weight:800;color:#00f5a0;letter-spacing:-1px;}",
      ".wl-balsub{font-size:13px;color:rgba(234,255,246,.55);}",
      ".wl-acts{display:flex;gap:10px;margin:18px 0 6px;flex-wrap:wrap;}",
      ".wl-btn{flex:1 1 160px;min-height:44px;border-radius:999px;border:1px solid rgba(0,245,160,.35);",
      "  background:rgba(0,245,160,.16);color:#eafff6;font-size:15px;font-weight:650;cursor:pointer;}",
      ".wl-btn:hover{background:rgba(0,245,160,.26);}",
      ".wl-btn[disabled]{opacity:.5;cursor:not-allowed;border-style:dashed;background:transparent;}",
      ".wl-sec{margin-top:20px;font-size:13px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;",
      "  color:rgba(234,255,246,.5);}",
      ".wl-rows{margin-top:8px;border-top:1px solid rgba(255,255,255,.07);}",
      ".wl-row{display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid rgba(255,255,255,.06);}",
      ".wl-ico{width:30px;height:30px;flex:0 0 30px;border-radius:9px;display:flex;align-items:center;justify-content:center;",
      "  background:rgba(255,255,255,.07);font-size:15px;}",
      ".wl-mid{flex:1;min-width:0;}",
      ".wl-what{font-size:14px;color:#eafff6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".wl-when{font-size:12px;color:rgba(234,255,246,.45);}",
      ".wl-amt{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;}",
      ".wl-amt.in{color:#00f5a0;} .wl-amt.out{color:#ffb4a2;} .wl-amt.free{color:rgba(234,255,246,.42);}",
      ".wl-empty{padding:22px 4px;color:rgba(234,255,246,.5);font-size:14px;text-align:center;}",
      ".wl-note{margin-top:14px;font-size:12px;line-height:1.6;color:rgba(234,255,246,.42);}",
    ].join("\n");
    document.head.appendChild(st);
  }

  /* 一条账目长什么样。
   * type=credit 进账 / debit 支出; amount 为 0 的是平台本地免费步骤 —— 照实显示并标"免费",
   * 不藏。藏起来用户会以为系统吞了钱。 */
  function rowHtml(e) {
    var amt = Number(e.amount_cents || 0);
    var isCredit = String(e.type || "").toLowerCase() === "credit" || amt > 0;
    var cls = amt === 0 ? "free" : (isCredit ? "in" : "out");
    var sign = amt === 0 ? "" : (isCredit ? "+" : "−");
    var ico = amt === 0 ? "○" : (isCredit ? "↓" : "↑");
    var meta = e.meta || {};
    var what = e.note || meta.engine || meta.action || (isCredit ? lc("Top-up", "充值") : lc("Usage", "用量"));
    if (amt === 0) what = what + " · " + lc("free", "免费");
    return '<div class="wl-row">' +
      '<div class="wl-ico">' + ico + "</div>" +
      '<div class="wl-mid"><div class="wl-what">' + esc(what) + "</div>" +
      '<div class="wl-when">' + esc(when(e.created_at)) + "</div></div>" +
      '<div class="wl-amt ' + cls + '">' + sign + money(Math.abs(amt)) + "</div>" +
      "</div>";
  }

  function close() {
    var o = document.getElementById("cssos-wallet-overlay");
    if (o) o.remove();
  }

  async function open() {
    if (document.getElementById("cssos-wallet-overlay")) return;
    injectStyles();
    var overlay = document.createElement("div");
    overlay.id = "cssos-wallet-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", lc("Wallet", "钱包"));
    overlay.innerHTML =
      '<div class="wl-card">' +
        '<button type="button" class="wl-x" aria-label="' + esc(lc("Close", "关闭")) + '">×</button>' +
        '<div class="wl-title">' + esc(lc("Wallet", "钱包")) + "</div>" +
        '<div class="wl-bal" id="wl-balance">—</div>' +
        '<div class="wl-balsub" id="wl-balsub">' + esc(lc("Loading…", "读取中…")) + "</div>" +
        '<div class="wl-acts">' +
          '<button type="button" class="wl-btn" id="wl-topup">＋ ' + esc(lc("Add funds", "充值")) + "</button>" +
          '<button type="button" class="wl-btn" id="wl-withdraw" disabled>' +
            esc(lc("Withdraw", "提现")) + "</button>" +
        "</div>" +
        '<div class="wl-sec">' + esc(lc("Activity", "收支明细")) + "</div>" +
        '<div class="wl-rows" id="wl-rows"><div class="wl-empty">' + esc(lc("Loading…", "读取中…")) + "</div></div>" +
        '<div class="wl-note">' + esc(lc(
          "Balance is pay-as-you-go, charged at exact engine cost. Withdrawals require $20 minimum and settle in about two weeks; only funds you deposited are withdrawable.",
          "余额按量计费, 按第三方引擎的实际成本扣除。提现 $20 起、约两周到账; 只有你自己充入的资金可提现。")) +
        "</div>" +
      "</div>";
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector(".wl-x").addEventListener("click", close);
    overlay.querySelector("#wl-topup").addEventListener("click", function () {
      try {
        if (typeof globalThis.cssosOpenCreditsTopup === "function") { globalThis.cssosOpenCreditsTopup(); return; }
      } catch (_e) {}
      // 充值弹窗没加载出来时不假装成功 —— 明说, 而不是点了没反应。
      var sub = document.getElementById("wl-balsub");
      if (sub) sub.textContent = lc("Top-up is unavailable right now.", "充值暂时不可用。");
    });

    // 余额
    try {
      var r = await fetch("/api/credits/balance", { credentials: "include" });
      var j = await r.json();
      var cents = Number(j.balance_cents != null ? j.balance_cents : j.balance || 0);
      var authed = j.authenticated !== false;
      document.getElementById("wl-balance").textContent = authed ? money(cents) : "—";
      /* CSSOS_WAVE_1953 — 分桶显示。总余额里能提走的只有【创作者分成】那一部分:
       * 赠送/优惠券按宪法不可提现, 用户自己充的可退但有反洗钱延迟。
       * 不说清楚, 用户会以为总余额都能拿走 —— 到提现那天才发现拿不走, 那是最伤的。 */
      var sub = document.getElementById("wl-balsub");
      if (!authed) {
        sub.textContent = lc("Sign in to see your wallet", "登录后查看你的钱包");
      } else {
        var earned = Number(j.earned_cents || 0);
        var bonus = Number(j.bonus_cents || 0);
        var parts = [lc("Available balance", "可用余额")];
        if (earned > 0) parts.push(money(earned) + " " + lc("withdrawable", "可提现"));
        if (bonus > 0) parts.push(money(bonus) + " " + lc("bonus · not withdrawable", "赠送 · 不可提现"));
        sub.textContent = parts.join(" · ");
      }
    } catch (_e) {
      document.getElementById("wl-balsub").textContent = lc("Could not read balance.", "余额读取失败。");
    }

    /* CSSOS_WAVE_1955 — 提现: 按资格接口决定按钮能不能点, 并把【为什么不能】直说。
     *
     * 之前这个按钮是恒置灰的"开放中"。现在后端通了(W1955), 但能不能提取决于四件事:
     * 有没有绑收款账户、账户 onboarding 走没走完、earning 桶够不够 $20、有没有在
     * 反洗钱冷却期内。任何一条不满足都直接写在按钮上 —— 用户不该点了才知道为什么不行。 */
    try {
      var er = await fetch("/api/wallet/withdraw/eligibility", { credentials: "include" });
      var ej = await er.json();
      var wb = document.getElementById("wl-withdraw");
      if (wb && ej && ej.authenticated) {
        var reasons = ej.reasons || [];
        if (ej.eligible) {
          wb.disabled = false;
          wb.textContent = lc("Withdraw", "提现") + " " + money(ej.withdrawable_cents);
          wb.addEventListener("click", function () { void doWithdraw(ej); });
        } else if (reasons.indexOf("no_payout_account") >= 0) {
          wb.disabled = false;
          wb.textContent = lc("Set up payouts", "绑定收款账户");
          wb.addEventListener("click", function () { void startConnectOnboarding(); });
        } else if (reasons.indexOf("payout_account_incomplete") >= 0) {
          wb.disabled = false;
          wb.textContent = lc("Finish payout setup", "完成收款设置");
          wb.addEventListener("click", function () { void startConnectOnboarding(); });
        } else if (reasons.indexOf("below_minimum") >= 0) {
          wb.textContent = lc("Withdraw · min", "提现 · 满") + " " + money(ej.minimum_cents);
        } else if (reasons.indexOf("deposit_cooldown") >= 0) {
          wb.textContent = lc("Withdraw · wait", "提现 · 还需") + " " + ej.deposit_cooldown_days + lc("d", " 天");
        }
      }
    } catch (_e) { /* 资格读不到就保持置灰, 不给一个点了会失败的按钮 */ }

    // 明细 —— 这是全平台第一次真正把 /api/billing/ledger 呈现出来
    try {
      var lr = await fetch("/api/billing/ledger?limit=40", { credentials: "include" });
      var lj = await lr.json();
      var d = (lj && (lj.data || lj)) || {};
      var entries = d.entries || [];
      var box = document.getElementById("wl-rows");
      if (!entries.length) {
        box.innerHTML = '<div class="wl-empty">' + esc(d.authenticated === false
          ? lc("Sign in to see your activity", "登录后查看收支明细")
          : lc("No activity yet", "还没有收支记录")) + "</div>";
      } else {
        box.innerHTML = entries.map(rowHtml).join("");
      }
    } catch (_e) {
      document.getElementById("wl-rows").innerHTML =
        '<div class="wl-empty">' + esc(lc("Could not load activity.", "明细读取失败。")) + "</div>";
    }
  }

  /* W1955 — 绑定收款账户: 跳 Stripe 托管的 onboarding。
   * 银行账号/身份/税务信息都在 Stripe 页面上填, 我们和 Jing 都碰不到 —— 这是对的,
   * 也是合规的做法(平台不该接触这些)。 */
  async function startConnectOnboarding() {
    try {
      var r = await fetch("/api/stripe/connect/start", { method: "POST", credentials: "include" });
      var j = await r.json();
      var url = (j && (j.url || (j.data && j.data.url))) || "";
      if (url) { window.location.href = url; return; }
      alert(lc("Could not start payout setup.", "无法开始收款设置。"));
    } catch (_e) {
      alert(lc("Could not start payout setup.", "无法开始收款设置。"));
    }
  }

  /* W1955 — 发起提现。带 request_id 幂等 —— 重复点击/网络重试不能提两次。 */
  async function doWithdraw(elig) {
    var maxC = Number(elig.withdrawable_cents || 0);
    var input = prompt(
      lc("How much to withdraw? (USD)", "提现多少?(美元)") + "  " +
      lc("Available", "可提") + " " + money(maxC),
      (maxC / 100).toFixed(2));
    if (input == null) return;
    var cents = Math.round(parseFloat(String(input).replace(/[^0-9.]/g, "")) * 100);
    if (!isFinite(cents) || cents <= 0) return;
    if (cents > maxC) { alert(lc("More than available.", "超过可提金额。")); return; }
    var rid = "w" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    try {
      var r = await fetch("/api/wallet/withdraw", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount_cents: cents, request_id: rid }),
      });
      var j = await r.json();
      if (j && j.ok) {
        alert(lc("Withdrawal sent. Stripe usually settles to your bank in a few business days.",
                 "提现已发出。Stripe 结算到银行通常需要数个工作日。"));
        close(); open();
        return;
      }
      var m = {
        no_payout_account: lc("Set up payouts first.", "请先绑定收款账户。"),
        payout_account_incomplete: lc("Finish payout setup first.", "请先完成收款设置。"),
        deposit_cooldown: lc("Recent top-up — withdrawals unlock 30 days after.", "近期有充值 —— 充值满 30 天后才可提现。"),
        below_minimum: lc("Below the $20 minimum.", "低于 $20 起提额。"),
        exceeds_withdrawable: lc("More than your withdrawable earnings.", "超过可提现收入。"),
        kyc_required: lc("Tax info required past $600/yr.", "年累计超 $600 需先完成税务信息。"),
        transfer_failed_refunded: lc("Transfer failed — refunded to your wallet.", "转账失败 —— 已退回钱包。"),
      };
      alert(m[j && j.error] || lc("Withdrawal could not be completed.", "提现未能完成。"));
    } catch (_e) {
      alert(lc("Withdrawal could not be completed.", "提现未能完成。"));
    }
  }

  globalThis.cssosOpenWallet = open;

  // ── Dock 入口 ───────────────────────────────────────────────────────────
  // 图标用 emoji 💳(Jing 定, 👛 看着怪), 不用苹果 Wallet 图标 —— 那是苹果的注册商标 + 版权美术,
  // 第三方 App 使用会被 App Store 4.1(仿冒)/5.2.5 拒。SF Symbols 只授权在苹果平台的
  // App 界面内用, 网页端不适用。emoji 零风险, 且符合 Dock 宪法「每个胶囊必须带图标」。
  function registerDockAction() {
    try {
      var map = globalThis.__cssosDockActionMap = globalThis.__cssosDockActionMap || {};
      map["wallet"] = function () { open(); };
      globalThis.dockActionMap = globalThis.__cssosDockActionMap;
    } catch (_e) {}
  }
  function mountDockItem(force) {
    var dock = document.querySelector(".dock") || document.querySelector("#dock");
    if (!dock) return false;
    if (dock.querySelector('[data-action="wallet"]')) return true;
    /* W1956b — Jing:「钱包图标请放到 works 附近」。
     * 钱包是买卖的落点, 挨着作品才说得通; 挨着 App 下载那一栏是我上一版随手挂的。 */
    var anchor = dock.querySelector('[data-action="works"]') ||
                 dock.querySelector('[data-action="market"]') ||
                 dock.querySelector('[data-action="appstore"]') ||
                 dock.querySelector('[data-action="actors"]');
    if (!anchor && !force) return false;
    var item = document.createElement("button");
    item.className = "dock-item"; item.type = "button";
    item.setAttribute("data-action", "wallet");
    item.setAttribute("data-actions", "click");
    item.setAttribute("data-tooltip", lc("Wallet", "钱包"));
    item.setAttribute("aria-label", lc("Wallet", "钱包"));
    item.innerHTML = '<span class="dock-ico" aria-hidden="true">💳</span><span class="dock-label">' +
      esc(lc("Wallet", "钱包")) + "</span>";
    if (anchor) dock.insertBefore(item, anchor.nextSibling); else dock.appendChild(item);
    item.addEventListener("click", function () { open(); });
    return true;
  }
  function ensureDockItem(retries) {
    if (mountDockItem(retries <= 0)) return;
    if (retries <= 0) return;
    setTimeout(function () { ensureDockItem(retries - 1); }, 400);
  }
  registerDockAction();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { ensureDockItem(20); });
  } else {
    ensureDockItem(20);
  }
})();
