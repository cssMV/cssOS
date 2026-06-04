/* CSSOS_WAVE_220A step 31 — Jing: replace static "Background Color N"
 * labels with the actual color name (e.g. Mint / Onyx / Jade) sourced
 * via i18n. Updates live as user changes the color. */
(function () {
  // 18 named anchors covering common hue/lightness combinations. Each
  // anchor maps to an i18n key under "color.name.*". The closest anchor
  // (smallest squared RGB distance) wins. English is authored in
  // dict.js; other locales come from the W210 lazy LLM pipeline.
  const ANCHORS = [
    { hex: "#000000", key: "color.name.black" },
    { hex: "#ffffff", key: "color.name.white" },
    { hex: "#808080", key: "color.name.gray" },
    { hex: "#1f1f1f", key: "color.name.onyx" },
    { hex: "#f8f5ea", key: "color.name.ivory" },
    { hex: "#00f5a0", key: "color.name.mint" },
    { hex: "#00b07a", key: "color.name.emerald" },
    { hex: "#008c64", key: "color.name.jade" },
    { hex: "#0a3a2a", key: "color.name.forest" },
    { hex: "#00bcd4", key: "color.name.teal" },
    { hex: "#2196f3", key: "color.name.azure" },
    { hex: "#3f51b5", key: "color.name.indigo" },
    { hex: "#9c27b0", key: "color.name.violet" },
    { hex: "#e91e63", key: "color.name.crimson" },
    { hex: "#f44336", key: "color.name.scarlet" },
    { hex: "#ff9800", key: "color.name.amber" },
    { hex: "#ffeb3b", key: "color.name.gold" },
    { hex: "#795548", key: "color.name.umber" }
  ];

  function hexToRgb(h) {
    const s = String(h || "").replace("#", "").trim();
    if (s.length !== 6) return null;
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16)
    };
  }

  function closestAnchor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    let best = null;
    let bestDist = Infinity;
    for (const a of ANCHORS) {
      const ar = hexToRgb(a.hex);
      const d =
        (rgb.r - ar.r) ** 2 +
        (rgb.g - ar.g) ** 2 +
        (rgb.b - ar.b) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }

  function tSafe(key, fallback) {
    try {
      const fn = window.CSSOS_I18N && window.CSSOS_I18N.t;
      const v = typeof fn === "function" ? fn(key) : null;
      if (!v || v === key) return fallback;
      return v;
    } catch {
      return fallback;
    }
  }

  function refreshOne(input) {
    if (!(input instanceof HTMLInputElement)) return;
    const id = input.id;
    if (!id) return;
    const span = document.querySelector(`[data-color-name-for="${id}"]`);
    if (!span) return;
    const card = input.closest(".palette-color-card");
    const hex = input.value || "";
    if (card) {
      card.style.setProperty("--card-color", hex);
      const rgb = hexToRgb(hex);
      if (rgb) {
        const luma = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
        card.style.setProperty("--card-text", luma > 0.55 ? "#111" : "#fff");
      }
    }
    const a = closestAnchor(hex);
    if (!a) {
      span.textContent = hex || "—";
      return;
    }
    const fallback = a.key
      .split(".")
      .pop()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    span.textContent = tSafe(a.key, fallback);
  }

  function refreshAll() {
    document.querySelectorAll("input[type=color][id^=bg-color-]").forEach(refreshOne);
  }

  function init() {
    document.querySelectorAll("input[type=color][id^=bg-color-]").forEach((input) => {
      input.addEventListener("input", () => refreshOne(input));
      input.addEventListener("change", () => refreshOne(input));
    });
    refreshAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // Re-run on locale change if any.
  window.addEventListener("cssos:locale-changed", refreshAll);
})();
