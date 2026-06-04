/* CSSOS_WAVE_513 20260530 — Jing「手机闪退真凶: JS 动态注入的 :has() 选择器」.
 * 背景: W512 已门控 style.css 里的 :has; 但 app.pill-bar.js / app.dock-pill.js 等在运行时
 * 用 <style> 动态注入 [data-pill-bar]:has(...) 级联到【永远显示的 Dock】。iOS/macOS WebKit
 * 在样式重算时匹配这些 :has 会崩溃(进程级, JS 来不及上报)。Mac 被 style.css 门控救了,
 * 但动态注入的不在 style.css → 手机一开主屏即崩。Vision Pro 的 visionOS WebKit 能扛 :has →
 * 那边正常 (实锤: VP 幻灯/胶囊效果全出、不崩; iPhone+Mac 崩)。
 *
 * 修法(最早、最稳): 监听 <head> 新增 <style>, 一旦其文本含 ":has(" 就把含 :has 的【整条规则】
 * 剥掉再写回 —— 在浏览器下一帧样式重算(崩溃点)之前完成。胶囊退化为普通矩形(功能无损)。
 * 必须在所有注入器之前加载(index 里放到最前)。 */
(function () {
  "use strict";
  if (window.__cssosHasNeutralizerInstalled) return;
  window.__cssosHasNeutralizerInstalled = true;

  // 把一段 CSS 文本里【包含 :has( 的整条规则】删掉(规则 = 选择器 { ... })。
  function stripHasRules(css) {
    if (!css || css.indexOf(":has(") === -1) return css;
    var out = "";
    var i = 0, n = css.length;
    while (i < n) {
      // 找下一个规则块的 '{' 和配对 '}'
      var brace = css.indexOf("{", i);
      if (brace === -1) { out += css.slice(i); break; }
      // 选择器文本 = 从 i 到 brace
      var selector = css.slice(i, brace);
      // 找配对 '}'(简单计数, 胶囊规则无嵌套, 但兼容 @media 用深度)
      var depth = 1, j = brace + 1;
      while (j < n && depth > 0) {
        var c = css[j];
        if (c === "{") depth++;
        else if (c === "}") depth--;
        j++;
      }
      var block = css.slice(i, j); // 完整规则(含选择器+{...})
      // @media / @supports 等 at-rule: 递归处理内部, 保留外壳
      var trimmedSel = selector.replace(/^[\s;]+/, "");
      if (trimmedSel.charAt(0) === "@") {
        var inner = css.slice(brace + 1, j - 1);
        out += css.slice(i, brace + 1) + stripHasRules(inner) + "}";
      } else if (selector.indexOf(":has(") !== -1) {
        // 选择器含 :has → 丢弃整条规则
      } else {
        out += block;
      }
      i = j;
    }
    return out;
  }

  // CSSOS_WAVE_515 20260530 — Jing「点 People MV 闪退」: 启动探针实锤 Safari 主界面其实不崩
  // (每次都活过 alive-3s), 真正崩点是【打开 person-mv 面板那一刻】。person-mv 注入的 <style>
  // 含 backdrop-filter:blur(8px)/blur(6px) —— iOS/macOS WebKit 在大面板上叠加 backdrop-filter
  // 实时模糊 → 进程级崩溃(Vision Pro 的 visionOS WebKit 能扛 → 那边正常)。style.css 的
  // backdrop-filter 早已被移动端全局禁用(W490g), 但 JS 注入的没覆盖。这里在中和器里一并剥掉
  // 所有注入 <style> 的 backdrop-filter(移动端 + App), 一处覆盖全部 20+ 注入器。
  var IS_MOBILE = false;
  try {
    IS_MOBILE = document.documentElement.classList.contains("cssos-app")
      || /iPhone|iPad|iPod/i.test(navigator.userAgent || "")
      || /Macintosh/i.test(navigator.userAgent || "")   // macOS Safari WebKit 同样崩
      || (window.matchMedia && window.matchMedia("(max-width: 820px)").matches);
  } catch (_e) {}

  function stripBackdrop(css) {
    if (!css) return css;
    if (css.indexOf("backdrop-filter") === -1) return css;
    // 删掉所有 (-webkit-)backdrop-filter: ...; 声明(保留其余样式)。
    return css.replace(/(?:-webkit-)?backdrop-filter\s*:[^;}]*;?/gi, "");
  }

  function sanitize(styleEl) {
    try {
      if (!styleEl || styleEl.dataset.cssosHasClean === "1") return;
      var css = styleEl.textContent || "";
      var cleaned = css;
      if (cleaned.indexOf(":has(") !== -1) cleaned = stripHasRules(cleaned);
      if (IS_MOBILE && cleaned.indexOf("backdrop-filter") !== -1) cleaned = stripBackdrop(cleaned);
      if (cleaned !== css) styleEl.textContent = cleaned;
      styleEl.dataset.cssosHasClean = "1";
    } catch (_e) {}
  }

  // 1) 处理已存在的 <style>
  function sweepAll() {
    try {
      var styles = document.querySelectorAll("style");
      for (var k = 0; k < styles.length; k++) sanitize(styles[k]);
    } catch (_e) {}
  }

  // 2) 监听后续注入的 <style>(同步在变更回调里清, 抢在下一帧重算前)
  try {
    var mo = new MutationObserver(function (muts) {
      for (var m = 0; m < muts.length; m++) {
        var added = muts[m].addedNodes;
        for (var a = 0; a < added.length; a++) {
          var node = added[a];
          if (node && node.nodeType === 1) {
            if (node.tagName === "STYLE") sanitize(node);
            else if (node.querySelectorAll) {
              var inner = node.querySelectorAll("style");
              for (var q = 0; q < inner.length; q++) sanitize(inner[q]);
            }
          }
        }
        // <style> 文本被后写入(textContent 在 append 后赋值)→ 也处理 target
        if (muts[m].target && muts[m].target.tagName === "STYLE") sanitize(muts[m].target);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  } catch (_e) {}

  sweepAll();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sweepAll);
  }
})();
