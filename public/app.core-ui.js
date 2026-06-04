/* CSSOS_WAVE_588 线4 — 极简未来感视觉内核: 统一空态助手。
 * cssosEmptyStateMarkup({icon,title,sub,ctaLabel,ctaHref}) → HTML 字符串(供 innerHTML)。
 * cssosMountEmptyState(container,{...,onCta}) → 写入 + 绑定 CTA 点击(带处理器时用这个)。 */
(function () {
  "use strict";
  if (globalThis.cssosEmptyStateMarkup) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  globalThis.cssosEmptyStateMarkup = function (opts) {
    opts = opts || {};
    var icon = opts.icon || "✨";
    var title = esc(opts.title || "");
    var sub = esc(opts.sub || "");
    var cta = "";
    if (opts.ctaLabel) {
      if (opts.ctaHref) {
        cta = '<a class="cssos-empty-cta" href="' + esc(opts.ctaHref) + '"' + (opts.ctaTarget ? ' target="' + esc(opts.ctaTarget) + '"' : "") + '>' + esc(opts.ctaLabel) + "</a>";
      } else {
        // ctaOnclick = 内联 JS 字符串(供 markup-string 场景, 无法用 onCta 绑处理器时)。
        cta = '<button type="button" class="cssos-empty-cta" data-cssos-empty-cta="1"' + (opts.ctaOnclick ? ' onclick="' + esc(opts.ctaOnclick) + '"' : "") + ">" + esc(opts.ctaLabel) + "</button>";
      }
    }
    return '<div class="cssos-empty">' +
      '<div class="cssos-empty-icon">' + icon + "</div>" +
      (title ? '<div class="cssos-empty-title">' + title + "</div>" : "") +
      (sub ? '<div class="cssos-empty-sub">' + sub + "</div>" : "") +
      cta + "</div>";
  };
  globalThis.cssosMountEmptyState = function (container, opts) {
    if (!container) return;
    container.innerHTML = globalThis.cssosEmptyStateMarkup(opts);
    if (opts && typeof opts.onCta === "function") {
      var b = container.querySelector("[data-cssos-empty-cta]");
      if (b) b.addEventListener("click", function (e) { e.preventDefault(); opts.onCta(); }, false);
    }
  };
})();
