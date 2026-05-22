/* CSSOS_WAVE_320 20260521 — Jing: 全局缩略图助手. 把大封面 URL 换成后端缩放代理
 * /api/img-thumb?u=…&w=… (sharp 缩放 + 缓存). 列表/卡片/背景/poster 统一用它, 把
 * 1.3MB 全图降到几十 KB. data:/svg/已是缩略图/相对路径 一律原样返回. */
globalThis.cssosThumb = function (url, w) {
  try {
    var s = String(url == null ? "" : url).trim();
    if (!s) return s;
    if (/^data:/i.test(s)) return s;
    if (/\.svg(\?|$)/i.test(s)) return s;
    if (s.indexOf("/api/img-thumb") !== -1) return s;
    if (!/^https?:\/\//i.test(s)) return s;
    var ww = Math.max(48, Math.min(parseInt(w, 10) || 400, 1024));
    return "/api/img-thumb?u=" + encodeURIComponent(s) + "&w=" + ww;
  } catch (_e) { return url; }
};

(() => {
  const dock = document.getElementById("dock");
  const toast = document.getElementById("toast");
  const logoPanel = document.getElementById("logo-panel");
  const foryouPanel = document.getElementById("foryou-panel");
  const watchPanel = document.getElementById("watch-panel");
  const notificationsPanel = document.getElementById("notifications-panel");
  const cssmvPanel = document.getElementById("cssmv-panel");
  const lyricsPanel = document.getElementById("lyrics-panel");
  const musicPanel = document.getElementById("music-panel");
  const videoPanel = document.getElementById("video-panel");
  const settingsPanel = document.getElementById("settings-panel");
  const languagePanel = document.getElementById("language-panel");
  const loginPanel = document.getElementById("login-panel");
  const profilePanel = document.getElementById("profile-panel");
  const subscriptionPanel = document.getElementById("subscription-panel");
  const userAdminPanel = document.getElementById("user-admin-panel");
  const creditPanel = document.getElementById("credit-panel");
  const workspacesPanel = document.getElementById("workspaces-panel");
  const worksPanel = document.getElementById("works-panel");
  const sellerPanel = document.getElementById("seller-panel");
  const aboutPanel = document.getElementById("about-panel");
  const apiPanel = document.getElementById("api-panel");
  const deliveryReportsPanel = document.getElementById("delivery-reports-panel");
  const deliveryOpsPanel = document.getElementById("delivery-ops-panel");
  const watchScreen = document.getElementById("watch-screen");
  const watchOverlayPlay = document.getElementById("watch-overlay-play");

  globalThis.cssosDom = {
    dock,
    toast,
    logoPanel,
    foryouPanel,
    watchPanel,
    notificationsPanel,
    cssmvPanel,
    lyricsPanel,
    musicPanel,
    videoPanel,
    settingsPanel,
    languagePanel,
    loginPanel,
    profilePanel,
    subscriptionPanel,
    userAdminPanel,
    creditPanel,
    workspacesPanel,
    worksPanel,
    sellerPanel,
    aboutPanel,
    apiPanel,
    deliveryReportsPanel,
    deliveryOpsPanel,
    watchScreen,
    watchOverlayPlay,
  };

  globalThis.watchScreen ??= watchScreen;
  globalThis.watchOverlayPlay ??= watchOverlayPlay;
  globalThis.notificationsPanel ??= notificationsPanel;
  globalThis.subscriptionPanel ??= subscriptionPanel;
  globalThis.userAdminPanel ??= userAdminPanel;
  globalThis.creditPanel ??= creditPanel;
  globalThis.workspacesPanel ??= workspacesPanel;
  globalThis.renderDeliveryDigestSummary ??= () => null;
  // CSSOS_PHASE2_CONTEXT_MENU_FIX 20260427 #152 — Jing
  // "右键菜单 open language, open one-tab MV, open for you, open settings 不工作。"
  // The context menu (app.context-menu.js) calls
  //   global.openPanel?.(global.languagePanel)
  //   global.openPanel?.(global.foryouPanel)
  //   global.openPanel?.(global.settingsPanel)
  //   global.openPanel?.(global.loginPanel)
  // But these four panel globals were NEVER published to `globalThis`
  // (only to cssosDom.{...}). openPanel(undefined) silently noops, so
  // the menu items rendered correctly but did nothing when clicked.
  // Publish them now alongside the panels that already worked.
  globalThis.languagePanel ??= languagePanel;
  globalThis.foryouPanel   ??= foryouPanel;
  globalThis.settingsPanel ??= settingsPanel;
  globalThis.loginPanel    ??= loginPanel;
  globalThis.profilePanel  ??= profilePanel;
  globalThis.worksPanel    ??= worksPanel;
  globalThis.sellerPanel   ??= sellerPanel;
  globalThis.aboutPanel    ??= aboutPanel;
  globalThis.apiPanel      ??= apiPanel;
})();
