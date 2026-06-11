/* CSSOS_WAVE_662 线B预备步 — 全站首屏 i18n 应用编排, 从 app.language-panel.js 抽出的独立 eager 小文件.
 *
 * 原先这段(language-panel.js initLanguagePanelModule 161-187)是【全站第一次 applyI18n()】, 却被锁在
 * 一个面板模块体内 → language-panel 无法懒加载(懒了首屏所有 [data-i18n] 不翻译)。抽成独立
 * globalThis.cssosApplyBootI18n 后, boot 首帧 i18n 不再依赖任何面板模块 —— 为将来 language-panel 懒加载
 * 铺路。【当前零行为变化】: initLanguagePanelModule 仍委托调本函数, 逻辑/顺序与原来逐字一致。
 *
 * 依赖均为 bundle 共享作用域裸符号(app.js 核心 currentLocale/I18N/applyI18n/updateComposingText/
 * version* DOM 句柄 + 面板函数 renderLoginPlatforms/renderProfilePanel/refreshProfileVersionSurface/
 * update*Module)。全部用 typeof 守卫(防御式: 任一缺失/将来懒加载也不抛 ReferenceError, 优雅降级)。 */
(function () {
  "use strict";
  globalThis.cssosApplyBootI18n = function () {
    try {
      if (typeof currentLocale === "undefined" || !currentLocale) return;
      if (typeof I18N === "undefined" || !I18N[currentLocale]) return;
      document.documentElement.lang = currentLocale;
      var ensure = (window.CSSOS_I18N && window.CSSOS_I18N.ensureGeneratedLocale)
        ? window.CSSOS_I18N.ensureGeneratedLocale(currentLocale) : null;
      Promise.resolve(ensure).catch(function () { return null; }).finally(function () {
        try { if (typeof applyI18n === "function") applyI18n(); } catch (_e) {}
        try { if (typeof updateComposingText === "function") updateComposingText(); } catch (_e) {}
        try { if (typeof renderLoginPlatforms === "function") renderLoginPlatforms(); } catch (_e) {}
        try { if (typeof renderProfilePanel === "function") renderProfilePanel(); } catch (_e) {}
        try {
          if (typeof refreshProfileVersionSurface === "function") {
            refreshProfileVersionSurface({
              versionToggle: typeof versionToggle !== "undefined" ? versionToggle : undefined,
              versionMenu: typeof versionMenu !== "undefined" ? versionMenu : undefined,
              versionList: typeof versionList !== "undefined" ? versionList : undefined,
              versionCurrentLabel: typeof versionCurrentLabel !== "undefined" ? versionCurrentLabel : undefined,
              versionHero: typeof versionHero !== "undefined" ? versionHero : undefined,
              versionHighlights: typeof versionHighlights !== "undefined" ? versionHighlights : undefined,
              versionTechSummary: typeof versionTechSummary !== "undefined" ? versionTechSummary : undefined
            });
          }
        } catch (_e) {}
        try { if (typeof updateLanguageStatusModule === "function") updateLanguageStatusModule("language.ready"); } catch (_e) {}
        try { if (typeof updateLanguageSelectionModule === "function") updateLanguageSelectionModule(); } catch (_e) {}
        try { if (typeof updateLanguageCurrentModule === "function") updateLanguageCurrentModule(); } catch (_e) {}
        try { if (typeof updateLanguagePendingBannerModule === "function") updateLanguagePendingBannerModule(); } catch (_e) {}
        try { if (typeof updateLanguageSettingsLabelsModule === "function") updateLanguageSettingsLabelsModule(); } catch (_e) {}
      });
    } catch (_e) {}
  };
})();
