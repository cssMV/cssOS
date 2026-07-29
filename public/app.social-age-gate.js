/* CSSOS_WAVE_1790 20260728 — Jing: 13 岁以下关社交(前端一侧)。
 *
 * 背景: 苹果年龄分级问卷「社交媒体能力 → 对 13 岁以下禁用」的豁免要求【真的禁用】。
 * 权威判定在后端 (src/index.ts denySocialForMinor → 403 SOCIAL_DISABLED_MINOR)。
 * 这个模块不是安全边界, 只负责体验层的两件事:
 *   1. 把社交入口藏起来 —— 别摆出点了没反应的按钮;
 *   2. 兜底提示 —— 任何 /api 请求被后端以 SOCIAL_DISABLED_MINOR 挡下时给一句可见的话,
 *      不让它退化成"点了没反应"的静默失败。
 *
 * 判定来源: GET /api/user/age-gate → data.social_enabled。
 * 【fail-open】拿不到判定一律按"允许"处理 —— 网络抖动绝不能把成年用户锁进儿童模式;
 * 真要拦的那一下, 后端 403 永远在。
 *
 * 关的是【发】的方向(评论/弹幕/私信/关注/点赞/公开上架/二创), 【看】的方向不动。
 *
 * 对外 API:
 *   globalThis.cssosSocialAllowed()    → boolean(未判定完也返回 true, 见 fail-open)
 *   globalThis.cssosRefreshSocialGate() → 重新拉一次判定(登录态变化时自动调用) */
(function () {
  "use strict";
  if (globalThis.__cssosSocialAgeGateWired) return;
  globalThis.__cssosSocialAgeGateWired = true;

  var allowed = true;   // fail-open 默认值
  var resolved = false;

  function tr(en) {
    try {
      if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en);
    } catch (_e) {}
    return en;
  }
  function toast(msg) {
    try { if (typeof globalThis.showToast === "function") globalThis.showToast(msg); } catch (_e) {}
  }
  function notice() {
    return tr("Social features are turned off for accounts under 13. You can still watch, listen and create.");
  }

  /* 被限制时藏起来的入口。只列【发/放大/再分发】的控件 —— 看的控件一个都不碰。
   * 后端守卫是权威; 这里漏掉一个只是会多弹一次提示, 不会真的放行。 */
  var HIDE_SELECTORS = [
    ".cwc-composer",            // 作品评论 输入框 + 发送
    ".cssos-dm-host",           // 私信面板(整块)
    ".cssos-dm-overlay",
    ".cssos-dm-newgroup-btn",
    ".csr-follow",              // 右轨头像上的 ➕关注
    "[data-social-gated]"       // 右轨 💬评论 / 📤分享 等由 JS 标记的按钮
  ];

  function injectCss() {
    if (document.getElementById("cssos-social-age-gate-css")) return;
    var s = document.createElement("style");
    s.id = "cssos-social-age-gate-css";
    s.textContent =
      ".cssos-social-restricted " + HIDE_SELECTORS.join(",.cssos-social-restricted ") +
      "{display:none !important;}";
    (document.head || document.documentElement).appendChild(s);
  }

  function apply() {
    var root = document.documentElement;
    if (allowed) {
      try { root.classList.remove("cssos-social-restricted"); } catch (_e) {}
      return;
    }
    injectCss();
    try { root.classList.add("cssos-social-restricted"); } catch (_e) {}
  }

  /* 捕获阶段拦点击: 覆盖动态注入、CSS 没盖到的社交触发器(如评论里的「回复」小chip)。 */
  function onClickCapture(e) {
    if (allowed) return;
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;
    if (!t.closest("[data-social-gated],.cwc-replychip,.csr-follow,.cssos-dm-newgroup-btn")) return;
    e.preventDefault();
    e.stopPropagation();
    toast(notice());
  }

  /* 兜底: 后端把任何社交写操作以 403 SOCIAL_DISABLED_MINOR 挡下时给一句提示。
   * 只在 403 时 clone 读 body(403 很少见, 开销可忽略), 且不吞掉响应本身。 */
  function wrapFetch() {
    if (typeof globalThis.fetch !== "function" || globalThis.__cssosSocialFetchWrapped) return;
    globalThis.__cssosSocialFetchWrapped = true;
    var orig = globalThis.fetch.bind(globalThis);
    globalThis.fetch = function (input, init) {
      return orig(input, init).then(function (res) {
        try {
          if (res && res.status === 403) {
            res.clone().json().then(function (d) {
              if (d && d.code === "SOCIAL_DISABLED_MINOR") {
                allowed = false; resolved = true; apply();
                toast(notice());
              }
            }).catch(function () {});
          }
        } catch (_e) {}
        return res;
      });
    };
  }

  function refresh() {
    try {
      return fetch("/api/user/age-gate", { credentials: "include" })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (j) {
          // 后端形状: { ok, empty, data: { birth_year, max_rating, locked, social_enabled } }
          var d = (j && j.data) || null;
          // 只有明确收到 social_enabled === false 才限制; 其余一律放行(fail-open)。
          allowed = !(d && d.social_enabled === false);
          resolved = true;
          apply();
          return allowed;
        })
        .catch(function () { resolved = true; return allowed; });
    } catch (_e) {
      resolved = true;
      return Promise.resolve(allowed);
    }
  }

  globalThis.cssosSocialAllowed = function () { return allowed; };
  globalThis.cssosSocialGateResolved = function () { return resolved; };
  globalThis.cssosRefreshSocialGate = refresh;

  wrapFetch();
  document.addEventListener("click", onClickCapture, true);
  // 登录/登出后重新判定(两个事件名在仓库里都有人用, 都听)。
  try {
    globalThis.addEventListener("cssos:auth-change", refresh);
    globalThis.addEventListener("cssos:auth-changed", refresh);
  } catch (_e) {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { refresh(); });
  } else {
    refresh();
  }
})();
