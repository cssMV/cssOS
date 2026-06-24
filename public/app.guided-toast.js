/* CSSOS_WAVE_588 20260602 — Jing「每个弹出信息都要有好的界面 + 引导用户下一步, 别让用户卡死」。
 * 引导式 toast: 可点击、带 CTA 按钮(最多2个)+ 关闭。失败提示从"只报错"升级为"报错 + 指路"。
 * 公开: globalThis.cssosGuidedToast(message, { kind, actions:[{label,onClick|href,primary}], duration })
 * 语义快捷: cssosToastInsufficientBalance() / cssosToastSignIn() / cssosToastRetry(msg, retryFn) */
(function () {
  "use strict";
  if (globalThis.cssosGuidedToast) return;
  var el = null, timer = null;
  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    try { return String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0 ? zh : en; } catch (_e) { return en; }
  }
  function dismiss() {
    if (timer) { clearTimeout(timer); timer = null; }
    var x = el; el = null;
    if (x && x.parentNode) {
      x.style.opacity = "0"; x.style.transform = "translateX(-50%) translateY(8px)";
      setTimeout(function () { if (x && x.parentNode) x.parentNode.removeChild(x); }, 220);
    }
  }
  globalThis.cssosDismissGuidedToast = dismiss;
  globalThis.cssosGuidedToast = function (message, opts) {
    opts = opts || {};
    dismiss();
    var err = opts.kind === "error";
    // CSSOS_WAVE_588 — 平台免疫系统: 每条错误提示自动上报(去重在 cssosReportError 里), 喂给自愈 digest。
    if (err) { try { if (typeof globalThis.cssosReportError === "function") globalThis.cssosReportError(String(message || ""), opts.code || "guided_toast"); } catch (_e) {} }
    el = document.createElement("div");
    el.className = "cssos-guided-toast";
    el.style.cssText = "position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(8px);z-index:2147483646;" +
      "display:flex;align-items:center;gap:10px;padding:11px 12px 11px 16px;border-radius:16px;" +
      "background:var(--panel-strong);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--text);" +
      "font:600 12.5px/1.35 -apple-system,system-ui,sans-serif;" +
      "border:1px solid " + (err ? "rgba(255,120,120,0.5)" : "rgba(0,245,160,0.4)") + ";" +
      "box-shadow:0 16px 40px rgba(0,0,0,0.5);opacity:0;transition:opacity .2s ease,transform .2s ease;" +
      "max-width:min(92vw,560px);pointer-events:auto;";
    var msg = document.createElement("span");
    msg.textContent = String(message || ""); msg.style.cssText = "flex:1 1 auto;min-width:0;";
    el.appendChild(msg);
    (Array.isArray(opts.actions) ? opts.actions : []).slice(0, 2).forEach(function (a) {
      if (!a || !a.label) return;
      var b = document.createElement(a.href ? "a" : "button");
      if (!a.href) b.type = "button";
      b.textContent = a.label;
      var primary = a.primary !== false;
      b.style.cssText = "flex:0 0 auto;border:0;border-radius:999px;padding:7px 14px;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap;text-decoration:none;" +
        (primary ? "background:hsl(155,66%,46%);color:#04130c;" : "background:rgba(255,255,255,0.16);color:var(--text);");
      if (a.href) { b.href = a.href; b.target = a.target || "_self"; }
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        try { if (typeof a.onClick === "function") a.onClick(); } catch (_e) {}
        if (a.keepOpen !== true) dismiss();
      }, false);
      el.appendChild(b);
    });
    var x = document.createElement("button");
    x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "close");
    x.style.cssText = "flex:0 0 auto;border:0;background:transparent;color:#9fdcc6;font-size:13px;cursor:pointer;padding:2px 6px;";
    x.addEventListener("click", function (e) { e.stopPropagation(); dismiss(); }, false);
    el.appendChild(x);
    document.body.appendChild(el);
    var e2 = el;
    requestAnimationFrame(function () { if (e2) { e2.style.opacity = "1"; e2.style.transform = "translateX(-50%) translateY(0)"; } });
    var hasActions = (Array.isArray(opts.actions) && opts.actions.length);
    var dur = opts.duration != null ? opts.duration : (hasActions ? 9000 : 4200);
    if (dur > 0) timer = setTimeout(dismiss, dur);
    return el;
  };
  // ── 常见死胡同的语义快捷方式 ──
  globalThis.cssosToastInsufficientBalance = function (extra) {
    globalThis.cssosGuidedToast(lc("Not enough credits.", "余额不足。") + (extra ? " " + extra : ""), {
      kind: "error",
      actions: [{ label: "💎 " + lc("Top up", "去充值"), onClick: function () { try { if (typeof globalThis.cssosOpenCreditsTopup === "function") globalThis.cssosOpenCreditsTopup(); } catch (_e) {} } }],
    });
  };
  globalThis.cssosToastSignIn = function (msg) {
    globalThis.cssosGuidedToast(msg || lc("Please sign in to continue.", "请先登录后继续。"), {
      kind: "error",
      actions: [{ label: "🔑 " + lc("Sign in", "登录"), onClick: function () {
        try { if (typeof globalThis.cssosOpenLogin === "function") { globalThis.cssosOpenLogin(); return; } } catch (_e) {}
        try { var f = document.getElementById("login-fab") || document.querySelector("[data-action=login],.login-fab"); if (f) f.click(); } catch (_e) {}
      } }],
    });
  };
  globalThis.cssosToastRetry = function (msg, retryFn) {
    globalThis.cssosGuidedToast(msg || lc("Something went wrong.", "出错了。"), {
      kind: "error",
      actions: [{ label: "↻ " + lc("Retry", "重试"), onClick: function () { try { if (typeof retryFn === "function") retryFn(); } catch (_e) {} } }],
    });
  };
})();
