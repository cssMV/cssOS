/* CSSOS_PERSON_MV_WAVE64C 20260508 — Jing — content rating badges.
 * Decorator: any element bearing data-content-rating="PG|13+|18+" gets
 * a small chip in the top-right corner. Lives next to the cards it
 * decorates (project memory: feature-specific UI lives near the
 * feature). MutationObserver keeps shelves / feeds in sync as cards
 * stream in. Uses CSSOS_I18N when present; the visual chip is just an
 * emoji + numeric rating so localization is mostly cosmetic. */
(function () {
  "use strict";

  var STYLE_ID = "cssos-rating-badge-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "[data-content-rating]{position:relative;}",
      ".cssos-rating-chip{position:absolute;top:6px;right:6px;height:16px;min-width:16px;padding:0 6px;border-radius:8px;font-size:10px;line-height:16px;font-weight:600;color:#fff;pointer-events:none;text-align:center;letter-spacing:0.3px;box-shadow:0 1px 3px rgba(0,0,0,0.5);z-index:5;}",
      ".cssos-rating-chip[data-r='PG']{background:#137a3b;}",
      ".cssos-rating-chip[data-r='13']{background:#c79100;color:#1a1100;}",
      ".cssos-rating-chip[data-r='18']{background:#b1311e;}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function chipHtml(rating) {
    if (rating === "PG")  return { r: "PG", emoji: "🟢", text: "PG" };
    if (rating === "13+") return { r: "13", emoji: "🟡", text: "13+" };
    if (rating === "18+") return { r: "18", emoji: "🔴", text: "18+" };
    return null;
  }

  function decorate(node) {
    if (!(node instanceof HTMLElement)) return;
    var rating = node.getAttribute("data-content-rating");
    if (!rating) return;
    if (node.querySelector(":scope > .cssos-rating-chip")) return;
    var meta = chipHtml(rating);
    if (!meta) return;
    var chip = document.createElement("span");
    chip.className = "cssos-rating-chip";
    chip.setAttribute("data-r", meta.r);
    chip.textContent = meta.emoji + " " + meta.text;
    node.appendChild(chip);
  }

  function scan(root) {
    (root || document).querySelectorAll("[data-content-rating]").forEach(decorate);
  }

  injectStyle();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { scan(document); });
  } else {
    scan(document);
  }

  var mo = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (!(n instanceof HTMLElement)) return;
        if (n.hasAttribute && n.hasAttribute("data-content-rating")) decorate(n);
        scan(n);
      });
      if (m.type === "attributes" && m.target instanceof HTMLElement) decorate(m.target);
    });
  });
  mo.observe(document.documentElement, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ["data-content-rating"],
  });

  globalThis.cssosRatingBadgesScan = scan;
})();
