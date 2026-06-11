/* CSSOS_PHASE2_MV_ENGINES_CATALOG 20260418 —
 * Frontend adapter around the Rust `/api/mv/engines` catalog route.
 *
 * Design philosophy (from Jing, 2026-04-18):
 *   一切参数化 (everything parameterized)
 *   一切i18n全球化 (i18n everywhere)
 *   一切可扩展 (leave extension points; never hardcode engine names)
 *
 * Responsibilities:
 *  - Fetch & cache the full engines catalog (stage → engines[] with price/i18n)
 *  - Persist per-stage user selections in localStorage (+ hydrate defaults from
 *    the catalog so the selections survive a server restart that adds/removes
 *    engines)
 *  - Provide a tiny render helper that formats an engine label for a <select>
 *    option (engine/version + localized price badge)
 *  - Leave room for a future server-side sync endpoint; selections currently
 *    live client-side only to keep the route surface stable.
 */

(function () {
  "use strict";

  const STORAGE_KEY = "cssmv.engine-selections.v1";
  const CATALOG_TTL_MS = 5 * 60 * 1000; // 5 minutes, same as other light caches
  const CATALOG_URL = "/api/mv/engines";

  // Fallback metadata used when the catalog fetch fails (e.g. offline). Keep
  // this list in sync with billing_matrix.rs::builtin_registry — but since the
  // server is authoritative, this is only the very first paint before
  // hydration; do not add labels/prices here.
  const FALLBACK_STAGES = [
    "cover",
    "lyrics",
    "music",
    "video",
    "subtitles",
    "compose",
  ];

  const state = {
    catalog: null, // { stages: [{stage, engines, default_engine, default_version, stage_i18n_key}], flat: [...] }
    fetchedAt: 0,
    loading: null, // in-flight Promise
    selections: null, // { [stage]: { engine, version } }
  };

  function readSelections() {
    if (state.selections) return state.selections;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          state.selections = parsed;
          return state.selections;
        }
      }
    } catch (_err) {
      /* ignore */
    }
    state.selections = {};
    return state.selections;
  }

  function writeSelections() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selections || {}));
    } catch (_err) {
      /* ignore */
    }
  }

  function now() {
    return Date.now();
  }

  function ensureFallbackCatalog() {
    if (state.catalog) return;
    state.catalog = {
      ok: false,
      stages: FALLBACK_STAGES.map((stage) => ({
        stage,
        engines: [],
        default_engine: null,
        default_version: null,
        stage_i18n_key: "mv.stage." + stage,
      })),
      flat: [],
    };
  }

  async function fetchCatalog(force) {
    if (!force && state.catalog && now() - state.fetchedAt < CATALOG_TTL_MS) {
      return state.catalog;
    }
    if (!force && state.loading) return state.loading;
    state.loading = (async () => {
      try {
        const res = await fetch(CATALOG_URL, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        // CSSOS_PHASE2_P2_57D 20260419 — anon 401/403 is expected when the
        // user isn't signed in; fall back silently so the browser console
        // stays clean on the marketing / guest views. Other errors still
        // bubble up to the catch below for visibility.
        if (res.status === 401 || res.status === 403) {
          ensureFallbackCatalog();
          return state.catalog;
        }
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        const json = await res.json();
        if (!json || !Array.isArray(json.stages)) {
          throw new Error("malformed catalog");
        }
        state.catalog = json;
        state.fetchedAt = now();
        return state.catalog;
      } catch (err) {
        // Keep previous catalog if we had one; otherwise synthesise an empty
        // shell so the UI doesn't crash.
        ensureFallbackCatalog();
        console.warn("[mv-engines-catalog] fetch failed:", err);
        return state.catalog;
      } finally {
        state.loading = null;
      }
    })();
    return state.loading;
  }

  function getCatalog() {
    return state.catalog;
  }

  function getStage(stageKey) {
    const cat = state.catalog;
    if (!cat || !Array.isArray(cat.stages)) return null;
    const key = String(stageKey || "").toLowerCase();
    for (let i = 0; i < cat.stages.length; i++) {
      if (String(cat.stages[i].stage || "").toLowerCase() === key) {
        return cat.stages[i];
      }
    }
    return null;
  }

  function catalogDefault(stageKey) {
    const stage = getStage(stageKey);
    if (!stage) return { engine: null, version: null };
    return {
      engine: stage.default_engine || null,
      version: stage.default_version || null,
    };
  }

  function getSelection(stageKey) {
    const stage = String(stageKey || "").toLowerCase();
    const stored = readSelections()[stage];
    const fallback = catalogDefault(stage);
    if (
      stored &&
      typeof stored === "object" &&
      typeof stored.engine === "string" &&
      typeof stored.version === "string" &&
      stored.engine.length > 0 &&
      stored.version.length > 0
    ) {
      // Validate the stored selection still exists in the catalog; if not, fall
      // back to the catalog default so removed engines don't break pipelines.
      const stageDef = getStage(stage);
      if (stageDef && Array.isArray(stageDef.engines)) {
        const found = stageDef.engines.some(
          (e) =>
            String(e.engine || "") === stored.engine &&
            String(e.version || "") === stored.version
        );
        if (found) return { engine: stored.engine, version: stored.version };
      } else {
        // No catalog yet — trust the stored selection optimistically.
        return { engine: stored.engine, version: stored.version };
      }
    }
    return fallback;
  }

  function setSelection(stageKey, engine, version) {
    const stage = String(stageKey || "").toLowerCase();
    if (!stage) return;
    const store = readSelections();
    if (!engine || !version) {
      delete store[stage];
    } else {
      store[stage] = { engine: String(engine), version: String(version) };
    }
    state.selections = store;
    writeSelections();
    /* CSSOS_WAVE_520 20260606 — Jing「任一面板改引擎, 全平台实时同步」。广播收进
     * setSelection 本身 → 单一真源: 无论高级设置 / MV 管线 / 人物 MV 哪个面板改,
     * 都触发同一事件, 所有引擎选择器订阅后实时重渲染。detail 带 stage/engine/version。 */
    try {
      document.dispatchEvent(new CustomEvent("cssmv:engine-selection-changed", {
        detail: { stage: stage, engine: engine || null, version: version || null },
      }));
    } catch (_e) {}
  }

  function getAllSelections() {
    const cat = state.catalog;
    const out = {};
    if (cat && Array.isArray(cat.stages)) {
      for (const s of cat.stages) {
        const stage = String(s.stage || "").toLowerCase();
        if (!stage) continue;
        out[stage] = getSelection(stage);
      }
    } else {
      // Catalog not ready — return only whatever's stored.
      const stored = readSelections();
      for (const k of Object.keys(stored)) {
        out[k] = { engine: stored[k].engine, version: stored[k].version };
      }
    }
    return out;
  }

  function formatEngineOptionLabel(entry) {
    if (!entry) return "";
    const engine = String(entry.engine || "");
    const version = String(entry.version || "");
    const label = String(entry.default_label || engine + "/" + version);
    const priceCents = Number(
      entry.price?.unit_price_cents != null ? entry.price.unit_price_cents : 0
    );
    const priceLabel =
      typeof globalThis.formatUsdFromCents === "function"
        ? globalThis.formatUsdFromCents(priceCents, "—")
        : priceCents
        ? "$" + (priceCents / 100).toFixed(2)
        : "—";
    return label + " · " + engine + "/" + version + " · " + priceLabel;
  }

  function resolveStageI18nLabel(stage) {
    // CSSOS_PHASE2_P2_41_I18N_CLEANUP 20260418 —
    // Removed the hardcoded {cover:"封面图",...} zh/en fallback map. The dict.js
    // entries "mv.stage.*" now live in every locale table (English strings are
    // the universal fallback for locales without a translation via t()'s
    // locale→DEFAULT_LOCALE fallback chain). This keeps the module free of
    // inline Chinese and makes new locales drop-in.
    if (!stage) return "";
    const slug = String(stage.stage || "").toLowerCase();
    const key = stage.stage_i18n_key || "mv.stage." + slug;
    if (typeof globalThis.t === "function") {
      const translated = globalThis.t(key);
      if (translated && translated !== key) return translated;
    }
    // Last resort — return the raw slug. Never hardcode locale copy here; if
    // a stage slug genuinely has no dict entry the slug itself (e.g. "cover")
    // is still readable and a missing-key telemetry event will fire inside t().
    return slug;
  }

  function formatEngineBadgeForStage(stageKey) {
    const stage = getStage(stageKey);
    if (!stage) return "";
    const sel = getSelection(stageKey);
    const match =
      Array.isArray(stage.engines) &&
      stage.engines.find(
        (e) =>
          String(e.engine || "") === sel.engine &&
          String(e.version || "") === sel.version
      );
    if (!match) return "";
    return formatEngineOptionLabel(match);
  }

  function getFlat() {
    return (state.catalog && Array.isArray(state.catalog.flat))
      ? state.catalog.flat
      : [];
  }

  function clearSelections() {
    state.selections = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_err) {
      /* ignore */
    }
  }

  const api = {
    fetchCatalog,
    getCatalog,
    getStage,
    getFlat,
    catalogDefault,
    getSelection,
    setSelection,
    getAllSelections,
    clearSelections,
    formatEngineOptionLabel,
    formatEngineBadgeForStage,
    resolveStageI18nLabel,
    STORAGE_KEY,
    CATALOG_TTL_MS,
    CATALOG_URL,
  };

  globalThis.cssmvEngines = api;

  // Kick off a warm fetch after the page idles so the advanced-settings panel
  // paints instantly when opened for the first time. Wrapped in a safety net
  // because this file can be included on pages that never open the panel.
  const warm = function () {
    try {
      void fetchCatalog(false);
    } catch (_err) {
      /* ignore */
    }
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(warm, { timeout: 3000 });
  } else {
    setTimeout(warm, 1200);
  }
})();
