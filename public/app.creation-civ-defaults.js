/**
 * CSSMV_CREATION_CIV_DEFAULTS 20260425 #101 — Jing
 * ------------------------------------------------------------------
 * The Advanced Settings BPM / Key / Work Type / Vocal Style /
 * Instrumentation / Ensemble Style fields rendered as either empty or
 * hardcoded English defaults ("88", "Pop", "Feminine"). Today's spec
 * (2026-04-25):
 *   "进阶：把 BPM / 调式 / WORK TYPE / 演唱风格 / 编制风格 等字段也根据
 *    文明随机推导填充"
 *
 * This module pre-populates those inputs from the civilization bank
 * (app.civilization-bank.js) on:
 *   1. DOMContentLoaded (initial paint)
 *   2. cssos:locale-changed (UI flips, e.g. user picks Korean from
 *      the language panel — fields should re-roll under the Sinosphere
 *      Korean civilization rather than the previous Anglophone defaults)
 *   3. Watch panel close + re-open (defensive — covers the case where
 *      another module has wiped the values back to hardcoded defaults)
 *
 * IMPORTANT:
 *   - Defaults are NEVER marked as "touched" so the lyrics-refresh
 *     wand still re-rolls them on demand. They are visual hints, not
 *     locked-in user choices.
 *   - User-typed values always win. Once a field's `data-cssmv-civ-
 *     default` flag is removed (by user input), we never overwrite.
 *   - Random picks are seeded by (civilization-key + day) so a user
 *     sees the same suggestion within a session, but it changes day
 *     to day for variety.
 */
(function attachCreationCivDefaults(global) {
  "use strict";

  function bank() {
    return global.CSSOS_CIVILIZATION_BANK || null;
  }

  function resolvePrimaryLocale() {
    if (typeof global.resolveUiPrimaryLanguageModule === "function") {
      try {
        const v = global.resolveUiPrimaryLanguageModule();
        if (v) return String(v).toLowerCase();
      } catch (_e) { /* no-op */ }
    }
    let raw = "";
    try {
      raw = String(
        global.currentLocale ||
        (document.documentElement && document.documentElement.lang) ||
        (typeof localStorage !== "undefined" && (localStorage.getItem("CSSOS_LANG") || localStorage.getItem("cssos.locale"))) ||
        ""
      );
    } catch (_e) { /* no-op */ }
    return raw.trim().toLowerCase().split(/[-_]/)[0].replace(/[^a-z]/g, "") || "en";
  }

  function dayHash(seedKey) {
    const day = new Date().toISOString().slice(0, 10);
    let h = 0;
    const s = `${seedKey}::${day}`;
    for (let i = 0; i < s.length; i += 1) {
      h = ((h * 31) + s.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  function pickFrom(arr, hashSeed, salt) {
    if (!Array.isArray(arr) || !arr.length) return "";
    const h = ((hashSeed >>> 0) ^ ((salt + 1) * 2654435761)) >>> 0;
    return String(arr[h % arr.length] || "");
  }

  function rangeFrom(min, max, hashSeed, salt) {
    const h = ((hashSeed >>> 0) ^ ((salt + 1) * 1597334677)) >>> 0;
    const span = Math.max(1, Math.floor(max) - Math.floor(min));
    return Math.floor(min) + (h % span);
  }

  // Civilization-aware tempo/key picks. The civilization bank exposes
  // COMMON_KEYS as a pool of major+minor keys — that's the right pool.
  // Tempo isn't currently civilization-bound in the bank, so we use a
  // sensible spread (68–168 BPM matches what randomizeCreationForLyrics
  // already does) and bias by civilization key.
  const TEMPO_BIAS_BY_CIV = Object.freeze({
    sinosphere_zh: { min: 70, max: 132 },
    sinosphere_ja: { min: 76, max: 140 },
    sinosphere_ko: { min: 80, max: 132 },
    indic: { min: 80, max: 144 },
    arab: { min: 76, max: 132 },
    persianate: { min: 72, max: 124 },
    levant: { min: 80, max: 128 },
    anglophone: { min: 80, max: 152 },
    iberoamerica: { min: 90, max: 156 },
    lusophone: { min: 90, max: 152 },
    francophonie: { min: 80, max: 140 },
    italianate: { min: 80, max: 132 },
    germanic: { min: 80, max: 144 },
    slavic: { min: 84, max: 140 },
    anatolia: { min: 80, max: 136 },
    east_african: { min: 96, max: 156 },
    west_african: { min: 96, max: 160 },
    southern_african: { min: 92, max: 152 },
    nusantara: { min: 88, max: 144 },
    southeast_asia_mainland: { min: 80, max: 136 },
    roam: { min: 76, max: 152 }
  });

  const WORK_TYPES = ["single", "triptych", "opera"];

  function getCivilization() {
    const b = bank();
    if (!b || typeof b.getCivilization !== "function") return null;
    try {
      return b.getCivilization(resolvePrimaryLocale()) || null;
    } catch (_e) {
      return null;
    }
  }

  function getCivKey() {
    const b = bank();
    if (!b || typeof b.resolveCivilizationKey !== "function") return "anglophone";
    try {
      return b.resolveCivilizationKey(resolvePrimaryLocale()) || "anglophone";
    } catch (_e) {
      return "anglophone";
    }
  }

  // ---------------------------------------------------------------- field setters
  // Each setter returns true if it successfully populated the field.
  // The "touched-by-user" check is conservative: if the value differs from
  // a previously-stamped civ default AND from empty, the user typed
  // something — leave it alone.

  function isVirgin(el) {
    if (!el) return false;
    const stamp = el.dataset && el.dataset.cssmvCivDefault;
    const val = String(el.value || "").trim();
    if (!val) return true; // empty → virgin (we can populate)
    if (stamp && val === stamp) return true; // still equal to our last stamp → not user-typed
    return false;
  }

  function stampValue(el, value) {
    if (!el) return;
    el.value = value;
    if (el.dataset) el.dataset.cssmvCivDefault = String(value);
  }

  function applyCivDefaultsOnce() {
    const civ = getCivilization();
    const civKey = getCivKey();
    const seed = dayHash(civKey);

    // BPM
    const bpmEl = document.getElementById("creation-tempo");
    if (bpmEl && isVirgin(bpmEl)) {
      const range = TEMPO_BIAS_BY_CIV[civKey] || TEMPO_BIAS_BY_CIV.roam;
      const bpm = rangeFrom(range.min, range.max + 1, seed, 1);
      stampValue(bpmEl, String(bpm));
    }

    // Key
    const keyEl = document.getElementById("creation-key");
    if (keyEl && isVirgin(keyEl)) {
      const pool = (bank() && Array.isArray(bank().COMMON_KEYS) && bank().COMMON_KEYS.length)
        ? bank().COMMON_KEYS
        : ["C", "D", "E", "F", "G", "A", "B"];
      // The <select id="creation-key"> only has 7 options (C–B). We can
      // only pick a key that exists in the dropdown. Filter the pool to
      // those values so we don't silently pick a non-rendered minor key.
      const renderedKeys = Array.from(keyEl.options || []).map((o) => o.value);
      const availableKeys = renderedKeys.length
        ? pool.filter((k) => renderedKeys.includes(String(k).slice(0, 1).toUpperCase()))
        : pool;
      const compactPool = (availableKeys.length ? availableKeys : renderedKeys).map((k) => String(k).slice(0, 1).toUpperCase());
      const key = pickFrom(compactPool, seed, 2);
      if (key) stampValue(keyEl, key);
    }

    // Work Type — civilization-agnostic, just rotate by day.
    const wtEl = document.getElementById("creation-work-type");
    if (wtEl && isVirgin(wtEl)) {
      const renderedWt = Array.from(wtEl.options || []).map((o) => o.value).filter(Boolean);
      const pool = renderedWt.length ? renderedWt : WORK_TYPES;
      stampValue(wtEl, pickFrom(pool, seed, 3) || pool[0]);
    }

    // Vocal Style — civ.vocalStyles bank
    const vsEl = document.getElementById("creation-vocal-style");
    if (vsEl && isVirgin(vsEl) && civ && Array.isArray(civ.vocalStyles) && civ.vocalStyles.length) {
      stampValue(vsEl, pickFrom(civ.vocalStyles, seed, 4));
    }

    // Instrumentation — civ.instrumentation bank (CSV phrase or instruments)
    const insEl = document.getElementById("creation-instrumentation");
    if (insEl && isVirgin(insEl) && civ) {
      const pool = Array.isArray(civ.instrumentation) && civ.instrumentation.length
        ? civ.instrumentation
        : (Array.isArray(civ.instruments) ? civ.instruments : []);
      if (pool.length) stampValue(insEl, pickFrom(pool, seed, 5));
    }

    // Ensemble Style — civ.ensembles bank
    const enEl = document.getElementById("creation-ensemble-style");
    if (enEl && isVirgin(enEl) && civ && Array.isArray(civ.ensembles) && civ.ensembles.length) {
      stampValue(enEl, pickFrom(civ.ensembles, seed, 6));
    }

    // Mirror into creationState if it exists, but DON'T mark as touched
    // — the wand can still re-roll. We just want the value visible.
    try {
      const cs = global.creationState;
      if (cs && typeof cs === "object") {
        if (bpmEl) cs.tempo = Number(bpmEl.value) || cs.tempo;
        if (keyEl) cs.key = String(keyEl.value || cs.key || "").trim();
        if (wtEl) cs.workType = String(wtEl.value || cs.workType || "").trim();
        if (vsEl) cs.vocalStyle = String(vsEl.value || cs.vocalStyle || "");
        if (insEl) cs.instrumentation = String(insEl.value || cs.instrumentation || "");
        if (enEl) cs.ensembleStyle = String(enEl.value || cs.ensembleStyle || "");
      }
    } catch (_e) { /* no-op */ }
  }

  // Track which fields have been overwritten by user input so we don't
  // re-stamp them on the next locale flip.
  function attachUserTouchClears() {
    const ids = [
      "creation-tempo", "creation-key", "creation-work-type",
      "creation-vocal-style", "creation-instrumentation", "creation-ensemble-style"
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.dataset && el.dataset.cssmvCivClearAttached === "1") return;
      const clear = () => {
        try { delete el.dataset.cssmvCivDefault; } catch (_e) { /* no-op */ }
      };
      el.addEventListener("input", clear);
      el.addEventListener("change", clear);
      if (el.dataset) el.dataset.cssmvCivClearAttached = "1";
    });
  }

  function applyAndAttach() {
    try { applyCivDefaultsOnce(); } catch (_e) { /* no-op */ }
    try { attachUserTouchClears(); } catch (_e) { /* no-op */ }
  }

  // CSSOS_PHASE2_EMPTY_DEFAULTS 20260429 #181 — Jing
  // "高级设置面板里的那些选项，默认应该是留空，只有用户干预之后，才能有数据".
  // The auto-stamp on DOMContentLoaded / locale-changed / setTimeout is now
  // disabled. The wand button (random-lyrics trigger) is the only path that
  // calls applyAndAttach via the exposed global, plus runAll's derive-only
  // call writes the LLM-derived values directly. The touch-clear listeners
  // still attach lazily so any user input clears the stamp.
  try { attachUserTouchClears(); } catch (_e) { /* no-op */ }
  document.addEventListener("DOMContentLoaded", () => {
    try { attachUserTouchClears(); } catch (_e) { /* no-op */ }
  });

  // Locale flip wipes stamped (still-virgin) values back to empty so the
  // user always sees a clean slate after a language change.
  try {
    document.addEventListener("cssos:locale-changed", () => {
      ["creation-tempo", "creation-key", "creation-work-type",
       "creation-vocal-style", "creation-instrumentation", "creation-ensemble-style"]
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.dataset && el.dataset.cssmvCivDefault) {
          if (String(el.value || "").trim() === el.dataset.cssmvCivDefault) {
            el.value = "";
            delete el.dataset.cssmvCivDefault;
          }
        }
      });
      try { attachUserTouchClears(); } catch (_e) { /* no-op */ }
    });
  } catch (_e) { /* no-op */ }

  // Expose so the wand button can opt-in to the civ-derived fill.
  global.cssosApplyCivDefaultsForLyrics = applyAndAttach;

  // Expose for debugging / forced reapply
  global.CSSMV_applyCreationCivDefaults = applyAndAttach;
})(typeof globalThis !== "undefined" ? globalThis : window);
