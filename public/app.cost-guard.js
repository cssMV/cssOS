/* CSSOS_WAVE_115 — 开工前钱包总价闸 + 成本提示(数字演员/大制作保护)。
 * 用法: 在任何"开工生成"按钮点击前 await cssosCostGateCheck({work_type, parts, video_mode, duration_sec, video_tier}).
 *   返回 {ok:true} 放行; {ok:false, blocked, html} 表示余额不足, 已弹充值引导, 应中止开工。
 * 现有【逐 stage preflight】已保证绝不透支(没钱就停, 无债); 本闸是【开工前】UX 提醒 + 大制作拦截, 防半成品。 */
(function () {
  "use strict";
  if (window.cssosCostGateCheck) return;

  function fmt(usd) { return usd || "$0.00"; }

  // 估算 + 提示(不拦截), 返回估算数据供 UI 展示"预计成本 $X · 建议售价 $Y"。
  window.cssosEstimateWork = function (params) {
    return fetch("/api/mv/estimate-total", {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify(params || {}),
    }).then(function (r) { return r.json(); }).catch(function () { return null; });
  };

  // 开工前闸: 估算 → 余额不足则弹充值引导 + 返回 blocked。
  window.cssosCostGateCheck = function (params) {
    return window.cssosEstimateWork(params).then(function (e) {
      if (!e || !e.ok) return { ok: true };   // 估算失败不阻断(逐stage preflight 兜底)
      // 小制作(总价低)直接放行, 不打扰。
      if (e.sufficient) return { ok: true, estimate: e };
      // 余额不足 → 弹引导。
      var msg = (typeof T === "function")
        ? T('This production is estimated at ' + fmt(e.total_usd) + '. Your balance is ' + fmt(e.balance_usd) + '. Please top up ' + fmt(e.need_topup_usd) + ' (incl. 20% buffer) so it doesn\'t stop halfway.',
            '本片预计需 ' + fmt(e.total_usd) + '。你的余额 ' + fmt(e.balance_usd) + '。请先充值 ' + fmt(e.need_topup_usd) + '(含 20% 缓冲),以免生成到一半没钱。')
        : ('Estimated ' + fmt(e.total_usd) + ', balance ' + fmt(e.balance_usd) + '. Top up ' + fmt(e.need_topup_usd) + '.');
      try {
        if (typeof window.cssosGuidedToast === "function") {
          window.cssosGuidedToast(msg, { actions: [{ label: (typeof T === "function" ? T("Top up", "去充值") : "Top up"), onClick: function () { try { location.hash = "#subscription"; } catch (_e) {} } }] });
        } else { window.alert(msg); }
      } catch (_e) { try { window.alert(msg); } catch (_e2) {} }
      return { ok: false, blocked: true, estimate: e };
    });
  };
})();
