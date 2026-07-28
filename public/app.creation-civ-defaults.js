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

  // ---------------------------------------------------------------- W1768 / #3
  // Jing「总魔法棒带动全部 ~30 项」: 除了上面 6 项, 高级设置其余选项也全部走文明智能联动。
  //  · 大部分按【文明】派生(civ bank 数据);
  //  · 5 个 MIDI 演奏旋钮(dynamics / articulation / voicing_register / expression_cc / humanization)
  //    更贴 genre/era 而非文明 → 由文明的【代表曲风家族】派生(Jing 批准的推荐方案)。
  function genreFamily(g) {
    var s = String(g || "").toLowerCase();
    if (/orchestr|classical|symphon|cinematic|baroque|opera|chamber|guqin|gufeng|erhu|score|hymn|sacred|liturg/.test(s)) return "orchestral";
    if (/electro|synth|edm|techno|house|trance|hyperpop|future|ambient|idm/.test(s)) return "electronic";
    if (/rock|metal|punk|grunge/.test(s)) return "rock";
    if (/jazz|blues|soul|funk|swing|r&b|rnb/.test(s)) return "jazz";
    if (/hip.?hop|rap|trap|drill/.test(s)) return "hiphop";
    if (/folk|acoustic|traditional|enka|fado|flamenco|raga|qawwali|indie|country/.test(s)) return "folk";
    return "pop";
  }
  // Per-family MIDI-performance profile. Vocabulary follows the SMART_FILL_POOLS house style.
  const MIDI_PROFILE = Object.freeze({
    orchestral: { dyn: "terraced swell · hush–build–release", art: "legato lead with marcato accents", voice: "full-range orchestral", expr: "crescendo at refrain, sustain bridge", hum: 0.74 },
    electronic: { dyn: "even pulse · sidechain compression", art: "staccato pulse, tight gate", voice: "rumble bass + crystal top", expr: "filter sweep into drops", hum: 0.22 },
    rock: { dyn: "soft verse / explosive chorus", art: "marcato chorus, palm-muted verse", voice: "mid vocal pocket, bright high lead", expr: "pick attack, release on outro", hum: 0.5 },
    jazz: { dyn: "wave-pulse, breathing swells", art: "legato with swung staccato", voice: "warm chesty baritone", expr: "vibrato lead, breath control", hum: 0.86 },
    hiphop: { dyn: "steady groove with drop accents", art: "staccato hats, sustained pads", voice: "low cinematic bed", expr: "sidechain pump, release on outro", hum: 0.34 },
    folk: { dyn: "fragile to fierce, gentle arc", art: "fingerpicked legato, pizzicato bridge", voice: "airy soprano floats", expr: "breath control verses, delay tail", hum: 0.8 },
    pop: { dyn: "rising arc · hush–build–release", art: "legato lead, staccato pre-chorus", voice: "mid vocal pocket", expr: "swell intro chorus, crescendo at refrain", hum: 0.56 }
  });
  const FORM_BY_FAMILY = Object.freeze({
    orchestral: ["through-composed", "theme and variations", "AABA", "sonata-allegro"],
    electronic: ["intro–build–drop–break–drop", "16-bar loop evolution", "verse–drop–verse"],
    rock: ["verse–chorus–verse–chorus–bridge–chorus", "verse–chorus–solo–chorus"],
    jazz: ["AABA head–solos–head", "12-bar blues"],
    hiphop: ["intro–verse–hook–verse–hook–outro", "8-bar verse / 8-bar hook"],
    folk: ["strophic verse–refrain", "ballad AAB", "call-and-response"],
    pop: ["verse–pre–chorus–verse–pre–chorus–bridge–chorus", "verse–chorus–verse–chorus–bridge"]
  });
  const DENSITY_BY_FAMILY = Object.freeze({ orchestral: 0.72, electronic: 0.74, rock: 0.68, jazz: 0.52, hiphop: 0.5, folk: 0.38, pop: 0.6 });
  const PERC_BY_FAMILY = Object.freeze({ orchestral: 0.44, electronic: 0.82, rock: 0.76, jazz: 0.6, hiphop: 0.86, folk: 0.32, pop: 0.6 });

  function repGenre(civ, seed) {
    if (civ && Array.isArray(civ.genres) && civ.genres.length) return pickFrom(civ.genres, seed, 11);
    return "pop";
  }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function isVirginRange(el) {
    return !!el && !(el.dataset && el.dataset.cssmvUserTyped === "1");
  }
  function stampRange(el, frac) {
    if (!el) return;
    const min = Number(el.min || 0), max = Number(el.max || 1), step = Number(el.step || 0);
    let v = min + clamp01(frac) * (max - min);
    if (step > 0) v = Math.round(v / step) * step;
    v = (max <= 1) ? Math.round(v * 100) / 100 : Math.round(v);
    if (el.dataset) el.dataset.cssmvStamping = "1";      // guard: our own dispatch must not mark user-typed
    el.value = String(v);
    if (el.dataset) el.dataset.cssmvCivDefault = String(v);
    try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (_e) { /* no-op */ }
    if (el.dataset) delete el.dataset.cssmvStamping;
  }

  // W1769 — Jing「再接一层让标题文字优先 = 用户干预永远优先」: 用户打了标题 → 按【标题文字】推断
  //   语言/文明(即便 UI 是英文、标题打了中文, 也走中文文明); 标题空/无法判定 → 回退 UI/显式创作语言。
  function resolveCivLocale() {
    try {
      const titleEl = document.getElementById("title-input")
        || document.getElementById("creation-title")
        || document.getElementById("mvp-title");
      const title = titleEl ? String(titleEl.value || "").trim() : "";
      if (title && typeof global.inferLanguageFromTitleText === "function") {
        const lang = String(global.inferLanguageFromTitleText(title) || "").trim().toLowerCase();
        if (lang) return lang;
      }
    } catch (_e) { /* no-op */ }
    return resolvePrimaryLocale();
  }

  function getCivilization() {
    const b = bank();
    if (!b || typeof b.getCivilization !== "function") return null;
    try {
      return b.getCivilization(resolveCivLocale()) || null;
    } catch (_e) {
      return null;
    }
  }

  function getCivKey() {
    const b = bank();
    if (!b || typeof b.resolveCivilizationKey !== "function") return "anglophone";
    try {
      return b.resolveCivilizationKey(resolveCivLocale()) || "anglophone";
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

    // -------------------------------------------------------- W1768 / #3
    // 其余高级选项也全部走文明智能联动(总魔法棒带动全部)。代表曲风 → 家族 → 演奏画像。
    const genre = repGenre(civ, seed);
    const fam = genreFamily(genre);
    const prof = MIDI_PROFILE[fam] || MIDI_PROFILE.pop;

    // (a) 文明派生 —— Inspiration ← civ.moodAccent(最具文化辨识度), 退回 titleHints。
    const inspEl = document.getElementById("creation-inspiration-notes");
    if (inspEl && isVirgin(inspEl) && civ) {
      const inspPool = (Array.isArray(civ.moodAccent) && civ.moodAccent.length)
        ? civ.moodAccent
        : (Array.isArray(civ.titleHints) ? civ.titleHints : []);
      if (inspPool.length) stampValue(inspEl, pickFrom(inspPool, seed, 12));
    }
    // (a) Section Form —— W1770 Jing: section_form 也留空 → 总魔法棒按【代表曲风家族】随机选一种结构
    //     (FORM_BY_FAMILY, 不一定京典)。勾了「京典模版」复选框 = cssmvUserTyped → isVirgin=false → 不覆盖;
    //     用户手输结构同理最高优先。空白时才填。
    const sfEl = document.getElementById("creation-section-form");
    if (sfEl && isVirgin(sfEl)) {
      stampValue(sfEl, pickFrom(FORM_BY_FAMILY[fam] || FORM_BY_FAMILY.pop, seed, 13));
    }
    // (a) Arrangement Density / Percussion Activity (range) ← 曲风家族。
    const adEl = document.getElementById("creation-arrangement-density");
    if (adEl && isVirginRange(adEl)) stampRange(adEl, DENSITY_BY_FAMILY[fam] != null ? DENSITY_BY_FAMILY[fam] : 0.6);
    const paEl = document.getElementById("creation-percussion-activity");
    if (paEl && isVirginRange(paEl)) stampRange(paEl, PERC_BY_FAMILY[fam] != null ? PERC_BY_FAMILY[fam] : 0.6);

    // (b) genre/era 派生的 5 个 MIDI 演奏旋钮(Jing 批准的推荐方案)。
    const dynEl = document.getElementById("creation-dynamics-curve");
    if (dynEl && isVirgin(dynEl)) stampValue(dynEl, prof.dyn);
    const artEl = document.getElementById("creation-articulation-bias");
    if (artEl && isVirgin(artEl)) stampValue(artEl, prof.art);
    const vrEl = document.getElementById("creation-voicing-register");
    if (vrEl && isVirgin(vrEl)) stampValue(vrEl, prof.voice);
    const exEl = document.getElementById("creation-expression-cc-bias");
    if (exEl && isVirgin(exEl)) stampValue(exEl, prof.expr);
    const humEl = document.getElementById("creation-humanization");
    if (humEl && isVirginRange(humEl)) stampRange(humEl, prof.hum);

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
        // W1768/#3 — 新增旋钮镜像进 creationState: buildSongSeedGenerationConstraints 是从 creationState 取
        //   这些字段(非 DOM), 不镜像的话总魔法棒填了 DOM 也进不了生成 payload。DOM 值(用户或戳记)即真相源。
        if (dynEl) cs.dynamicsCurve = String(dynEl.value || cs.dynamicsCurve || "");
        if (artEl) cs.articulationBias = String(artEl.value || cs.articulationBias || "");
        if (vrEl) cs.voicingRegister = String(vrEl.value || cs.voicingRegister || "");
        if (exEl) cs.expressionCcBias = String(exEl.value || cs.expressionCcBias || "");
        if (sfEl) cs.sectionForm = String(sfEl.value || cs.sectionForm || "");
        if (inspEl) cs.inspirationNotes = String(inspEl.value || cs.inspirationNotes || "");
        if (adEl && adEl.value !== "") cs.arrangementDensity = Number(adEl.value);
        if (paEl && paEl.value !== "") cs.percussionActivity = Number(paEl.value);
        if (humEl && humEl.value !== "") cs.humanization = Number(humEl.value);
      }
    } catch (_e) { /* no-op */ }
  }

  // Track which fields have been overwritten by user input so we don't
  // re-stamp them on the next locale flip.
  function attachUserTouchClears() {
    // Text/select/number fields: user input clears our civ stamp → we never re-stamp over a user choice.
    const ids = [
      "creation-tempo", "creation-key", "creation-work-type",
      "creation-vocal-style", "creation-instrumentation", "creation-ensemble-style",
      // W1768/#3 — 新增文本/选择旋钮同样纳入"用户干预→系统让位"。
      "creation-dynamics-curve", "creation-articulation-bias", "creation-voicing-register",
      "creation-expression-cc-bias", "creation-section-form", "creation-inspiration-notes"
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
    // W1768/#3 — Range 旋钮: 用户拖动即标记 cssmvUserTyped(此后 isVirginRange=false, 系统不再覆盖);
    //   我们自己 stampRange 时带 cssmvStamping 守卫, 不会误触发。
    ["creation-arrangement-density", "creation-percussion-activity", "creation-humanization"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.dataset && el.dataset.cssmvCivClearAttached === "1") return;
      const mark = () => {
        if (el.dataset && el.dataset.cssmvStamping) return; // 我们自己的戳记, 忽略
        if (el.dataset) {
          el.dataset.cssmvUserTyped = "1";
          try { delete el.dataset.cssmvCivDefault; } catch (_e) { /* no-op */ }
        }
      };
      el.addEventListener("input", mark);
      el.addEventListener("change", mark);
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
      // W1768/#3 — locale 切换清空所有【仍是戳记值】的旋钮(含新增), 回到干净留空态; 用户改过的不动。
      ["creation-tempo", "creation-key", "creation-work-type",
       "creation-vocal-style", "creation-instrumentation", "creation-ensemble-style",
       "creation-dynamics-curve", "creation-articulation-bias", "creation-voicing-register",
       "creation-expression-cc-bias", "creation-section-form", "creation-inspiration-notes",
       "creation-arrangement-density", "creation-percussion-activity", "creation-humanization"]
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.dataset && el.dataset.cssmvCivDefault) {
          if (String(el.value || "").trim() === el.dataset.cssmvCivDefault) {
            if (el.type === "range") {
              // range 无"空"值: 只撤戳记 + 复位为可再填(清 userTyped), 让下次 apply 重新按新文明派生。
              try { delete el.dataset.cssmvCivDefault; delete el.dataset.cssmvUserTyped; } catch (_e) { /* no-op */ }
            } else {
              el.value = "";
              delete el.dataset.cssmvCivDefault;
            }
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
