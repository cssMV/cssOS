/* CSSOS_WAVE_594 #10 20260603 — Jing「让免疫系统自己抓 i18n 回归」: 运行时 i18n 泄漏自检。
 *
 * 思路: 平台英文默认、全球化。非中文 locale 下, UI【控件层】(按钮/标签/胶囊/选项/标题…)若出现中文字符,
 * 极可能是硬编码或 DB taxonomy 泄漏(如未经 civDisplayName 的"印度文明")。扫到就 beacon 进 digest
 * (code=i18n_leak), 让自愈例程下次能直接看到"哪个选择器漏了中文"。
 *
 * 严格避免误报母语真迹: 只扫【chrome 控件】, 排除【内容/卡片/人名/歌词/字幕/生成文本】——那些 CJK 是
 * 合法的(印度角色的 theme 本就该是母语)。中文用户(zh locale)整体跳过。每会话封顶 3 条 + 去重。
 * 仅诊断, 绝不改 DOM、绝不打扰用户。 */
(function () {
  "use strict";
  if (globalThis.__cssosI18nLeakProbe) return;
  globalThis.__cssosI18nLeakProbe = true;

  // locale 判定: 中文用户跳过(中文 UI 合法)。
  function isZh() {
    try {
      var l = String(document.documentElement.lang || navigator.language || "").toLowerCase();
      return l.indexOf("zh") === 0;
    } catch (_e) { return false; }
  }
  if (isZh()) return;

  var CJK = /[一-鿿㐀-䶿]/; // 中日韩统一表意文字(中文为主)
  // 只扫这些"控件层"元素 —— 它们必须本地化。
  var CHROME_SEL = [
    "button", "a[role=button]", "[role=button]", "[role=tab]", "label",
    "option", "[data-pill-key]", ".cssos-pill", ".pill", "nav a", "summary",
    ".panel-title", ".cssos-dialog h3", ".cssos-empty-title", ".cssos-empty-cta"
  ].join(",");
  // 排除: 内容/卡片/人名/歌词/字幕/生成文本/允许 CJK 的容器(母语真迹合法)。
  var SKIP_CLOSEST = [
    ".work-card", "[data-work-id]", "[data-person-id]", ".pmv-card", ".person-mv-card",
    ".lyrics", ".karaoke", ".subtitle", ".cssmv-lyrics", "[data-cjk-ok]", "[lang^=zh]",
    ".cssos-agent-msg", ".msrc-vision-row", ".person-mv-theme", ".pmv-mv-angle",
    "#cssos-pmm", "#cssos-agent-panel .body"
  ].join(",");

  var _reported = {}, _count = 0, MAX = 3;

  function cssPath(el) {
    try {
      var parts = [], n = el, hops = 0;
      while (n && n.nodeType === 1 && hops < 4) {
        var seg = n.tagName.toLowerCase();
        if (n.id) { seg += "#" + n.id; parts.unshift(seg); break; }
        if (n.className && typeof n.className === "string") {
          var c = n.className.trim().split(/\s+/).slice(0, 2).join(".");
          if (c) seg += "." + c;
        }
        parts.unshift(seg); n = n.parentElement; hops++;
      }
      return parts.join(">").slice(0, 120);
    } catch (_e) { return "?"; }
  }

  function ownText(el) {
    // 只取本元素直属文本(不含子元素), 避免把内层人名/内容算进来。
    try {
      var t = "";
      for (var i = 0; i < el.childNodes.length; i++) {
        var c = el.childNodes[i];
        if (c.nodeType === 3) t += c.nodeValue;
      }
      return t.trim();
    } catch (_e) { return ""; }
  }

  function scan() {
    if (_count >= MAX) return;
    try {
      var els = document.querySelectorAll(CHROME_SEL);
      for (var i = 0; i < els.length && _count < MAX; i++) {
        var el = els[i];
        if (!el || (el.offsetParent === null && el.tagName !== "OPTION")) continue; // 不可见跳过(option 例外)
        try { if (el.closest && el.closest(SKIP_CLOSEST)) continue; } catch (_e) {}
        var txt = ownText(el) || (el.tagName === "OPTION" ? (el.textContent || "").trim() : "");
        if (!txt || !CJK.test(txt)) continue;
        var sel = cssPath(el);
        var key = sel + "|" + txt.slice(0, 16);
        if (_reported[key]) continue;
        _reported[key] = 1; _count++;
        if (typeof globalThis.cssosReportError === "function") {
          globalThis.cssosReportError(
            "i18n leak (non-zh locale): \"" + txt.slice(0, 40) + "\" @ " + sel,
            "i18n_leak"
          );
        }
      }
    } catch (_e) {}
  }

  // UI 落定后扫一次; 之后切面板(点击)防抖再扫, 抓动态渲染的泄漏。每会话封顶 MAX 条。
  setTimeout(scan, 12000);
  var _deb = null;
  document.addEventListener("click", function () {
    if (_count >= MAX) return;
    clearTimeout(_deb);
    _deb = setTimeout(scan, 2500);
  }, true);
})();
