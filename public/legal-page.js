/* CSS Studio — shared renderer for standalone legal/info pages.
 * Pages define globalThis.LEGAL_DOC = { en: {...}, zh: {...}, ja: {...} }
 * then call renderLegalDoc(). Locale follows the same keys used by the
 * main app (CSSOS_LANG / cssos.locale) so the language panel choice
 * persists when users navigate to /privacy.html etc.
 */
(function () {
  function pickLocale() {
    try {
      var q = new URLSearchParams(location.search).get("lang");
      if (q) return q.toLowerCase();
    } catch (_) {}
    try {
      var v = localStorage.getItem("CSSOS_LANG") || localStorage.getItem("cssos.locale");
      if (v) return String(v).toLowerCase();
    } catch (_) {}
    var nav = (navigator.language || "en").toLowerCase();
    if (nav.indexOf("zh") === 0) return "zh";
    if (nav.indexOf("ja") === 0) return "ja";
    return "en";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderSection(sec) {
    var body = (sec.body || []).map(function (block) {
      if (typeof block === "string") return "<p>" + esc(block) + "</p>";
      if (block && block.ul) {
        return "<ul>" + block.ul.map(function (li) { return "<li>" + esc(li) + "</li>"; }).join("") + "</ul>";
      }
      return "";
    }).join("");
    return "<h2>" + esc(sec.title) + "</h2>" + body;
  }

  function renderLegalDoc() {
    var doc = globalThis.LEGAL_DOC || {};
    var locale = pickLocale();
    var data = doc[locale] || doc.en;
    if (!data) return;
    document.documentElement.lang = locale;
    document.title = data.title + " · CSS Studio";
    var root = document.getElementById("doc-root");
    if (!root) return;
    var langSwitcher = ["en", "zh", "ja"].map(function (lc) {
      var active = lc === locale;
      var label = { en: "English", zh: "中文", ja: "日本語" }[lc];
      return '<a href="?lang=' + lc + '"' +
        ' style="margin-right:10px;text-decoration:none;' +
        (active ? "font-weight:600;color:#fff;" : "color:#9aa;") + '">' +
        label + "</a>";
    }).join("");
    var sections = (data.sections || []).map(renderSection).join("");
    root.innerHTML =
      '<div class="lang-bar">' + langSwitcher + '</div>' +
      "<h1>" + esc(data.title) + "</h1>" +
      (data.subtitle ? '<p class="subtitle">' + esc(data.subtitle) + "</p>" : "") +
      (data.updated ? '<p class="updated">' + esc(data.updated) + "</p>" : "") +
      "<hr/>" +
      sections +
      '<hr/><p class="footer">' + esc(data.contactLine || "admin@cssstudio.app") + "</p>" +
      '<p class="footer"><a href="/">← CSS Studio</a></p>';
  }

  globalThis.renderLegalDoc = renderLegalDoc;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderLegalDoc);
  } else {
    renderLegalDoc();
  }
})();
