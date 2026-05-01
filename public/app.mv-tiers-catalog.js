/* CSSOS_PHASE2_MV_TIERS_CATALOG 20260419 —
 * Frontend adapter around the Rust `/api/mv/tiers` catalog route.
 *
 * Design philosophy (from Jing, 2026-04-19):
 *   一切参数化 (default tier read from server, overridable per user)
 *   一切i18n全球化 (tier labels use backend-supplied i18n keys)
 *   一切可扩展 (three tiers today; server can add more without UI change)
 *
 * Responsibilities:
 *  - Fetch & cache the three MV tiers (Lite / Hybrid / Cinematic) with
 *    live gen cost, creator credit, suggested retail, break-even listens
 *  - Persist the user's picked tier in localStorage so the cost label and
 *    the future tier slider both show the same active bucket
 *  - Classify an arbitrary ai-video-share % into a tier id (mirrors the
 *    backend classifier in billing_matrix.rs so we don't drift)
 *  - Expose a formatter for the "常驻 cost label" near the Generate button
 *
 * Default behaviour: if the server returns a default_tier we respect it
 * (see CSSMV_DEFAULT_TIER in billing_matrix.rs, defaulting to "hybrid"
 * per Jing's 2026-04-19 decision — "就默认Hybrid吧"). The local override
 * only wins for users who've explicitly picked a different tier in the UI.
 */

(function () {
  "use strict";

  const STORAGE_KEY = "cssmv.tier-selection.v1";
  const CATALOG_TTL_MS = 5 * 60 * 1000; // same TTL as mv-engines-catalog
  const CATALOG_URL = "/api/mv/tiers";

  // Fallback tier list used for the very first paint if the catalog fetch
  // hasn't come back yet (or if the user is offline). Keep this lean — just
  // enough to render a placeholder label without claiming specific prices.
  // Real prices + engine hints always come from the server.
  const FALLBACK_TIERS = [
    {
      id: "lite",
      default_label: "Lite",
      ai_video_ratio_pct: 0,
      cost_breakdown: { total_usd: 0 },
      pricing: { gen_cost_usd: 0, creator_credit_usd: 0, suggested_buyout_usd: 0, suggested_listen_usd: 0, listen_royalty_usd: 0, breakeven_listens: 0 },
      // CSSOS_PHASE2_MV_PRICELESS 20260419 — all three tiers ship as 无价之宝
      // (listens-only) until the backend says otherwise.
      priceless: true,
    },
    {
      id: "hybrid",
      default_label: "Hybrid",
      ai_video_ratio_pct: 20,
      cost_breakdown: { total_usd: 0 },
      pricing: { gen_cost_usd: 0, creator_credit_usd: 0, suggested_buyout_usd: 0, suggested_listen_usd: 0, listen_royalty_usd: 0, breakeven_listens: 0 },
      priceless: true,
    },
    {
      id: "cinematic",
      default_label: "Cinematic",
      ai_video_ratio_pct: 100,
      cost_breakdown: { total_usd: 0 },
      pricing: { gen_cost_usd: 0, creator_credit_usd: 0, suggested_buyout_usd: 0, suggested_listen_usd: 0, listen_royalty_usd: 0, breakeven_listens: 0 },
      priceless: true,
    },
  ];

  const state = {
    catalog: null, // { tiers: [...], default_tier: "hybrid", classification: {lite_max, hybrid_max} }
    fetchedAt: 0,
    loading: null,
    selection: undefined, // tier id the user last picked (empty = use server default)
  };

  function now() { return Date.now(); }

  function readSelection() {
    if (state.selection !== undefined) return state.selection;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && typeof parsed.tier === "string") {
          state.selection = parsed.tier;
          return state.selection;
        }
      }
    } catch (_err) { /* ignore */ }
    state.selection = "";
    return state.selection;
  }

  function writeSelection() {
    try {
      if (!state.selection) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ tier: state.selection }));
      }
    } catch (_err) { /* ignore */ }
  }

  function ensureFallbackCatalog() {
    if (state.catalog) return;
    state.catalog = {
      ok: false,
      tiers: FALLBACK_TIERS,
      default_tier: "hybrid",
      classification: { lite_max: 5, hybrid_max: 60 },
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
        // Anon 401/403 — backend currently doesn't gate /api/mv/tiers, but
        // mirror mv-engines-catalog's tolerance in case ops later adds auth.
        if (res.status === 401 || res.status === 403) {
          ensureFallbackCatalog();
          return state.catalog;
        }
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        const json = await res.json();
        if (!json || !Array.isArray(json.tiers) || json.tiers.length === 0) {
          throw new Error("malformed tiers catalog");
        }
        state.catalog = json;
        state.fetchedAt = now();
        return state.catalog;
      } catch (err) {
        ensureFallbackCatalog();
        console.warn("[mv-tiers-catalog] fetch failed:", err);
        return state.catalog;
      } finally {
        state.loading = null;
      }
    })();
    return state.loading;
  }

  function getCatalog() { return state.catalog; }

  function getTiers() {
    return (state.catalog && Array.isArray(state.catalog.tiers))
      ? state.catalog.tiers
      : FALLBACK_TIERS;
  }

  function findTier(id) {
    const list = getTiers();
    const key = String(id || "").toLowerCase();
    for (let i = 0; i < list.length; i++) {
      if (String(list[i].id || "").toLowerCase() === key) return list[i];
    }
    return null;
  }

  function defaultTierId() {
    if (state.catalog && typeof state.catalog.default_tier === "string" && state.catalog.default_tier) {
      return state.catalog.default_tier;
    }
    return "hybrid";
  }

  function currentTierId() {
    const stored = readSelection();
    if (stored && findTier(stored)) return stored;
    return defaultTierId();
  }

  function currentTier() {
    return findTier(currentTierId()) || findTier("hybrid") || getTiers()[0] || null;
  }

  function setTier(id) {
    const next = String(id || "").toLowerCase();
    if (!next) {
      state.selection = "";
    } else {
      if (!findTier(next)) return false;
      state.selection = next;
    }
    writeSelection();
    try {
      globalThis.dispatchEvent(new CustomEvent("cssmv:tier-changed", { detail: { tierId: state.selection || defaultTierId() } }));
    } catch (_err) { /* ignore */ }
    return true;
  }

  function classifyByRatio(ratioPct) {
    const cls = state.catalog && state.catalog.classification
      ? state.catalog.classification
      : { lite_max: 5, hybrid_max: 60 };
    const pct = Math.max(0, Math.min(100, Math.round(Number(ratioPct) || 0)));
    if (pct <= (cls.lite_max || 5)) return "lite";
    if (pct <= (cls.hybrid_max || 60)) return "hybrid";
    return "cinematic";
  }

  function classifyBySeconds(aiSecs, totalSecs) {
    const total = Number(totalSecs) || 0;
    if (total <= 0) return { ratioPct: 0, tierId: "lite" };
    const ratio = Math.max(0, Math.min(100, Math.round((Number(aiSecs) || 0) / total * 100)));
    return { ratioPct: ratio, tierId: classifyByRatio(ratio) };
  }

  function resolveTierLabel(tier) {
    if (!tier) return "";
    const key = tier.i18n_key;
    if (key && typeof globalThis.t === "function") {
      const translated = globalThis.t(key);
      if (translated && translated !== key) return translated;
    }
    return tier.default_label || tier.id || "";
  }

  function resolveTierDesc(tier) {
    if (!tier) return "";
    const key = tier.description_i18n_key;
    if (key && typeof globalThis.t === "function") {
      const translated = globalThis.t(key);
      if (translated && translated !== key) return translated;
    }
    return tier.default_description || "";
  }

  function formatUsd(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return "$" + n.toFixed(2);
  }

  // Format the "常驻 cost label" rendered next to the Generate button.
  // Returns a pre-escaped object the caller can slot into the panel DOM; the
  // caller is responsible for HTML-escaping tier name + copy strings if it
  // consumes .text (we return safe plain text here).
  function formatCostLabel(tier, lang) {
    const t = tier || currentTier();
    if (!t) return { text: "", title: "" };
    const name = resolveTierLabel(t);
    const credit = formatUsd(t.pricing && t.pricing.creator_credit_usd);
    const breakeven = Number(t.pricing && t.pricing.breakeven_listens) || 0;
    const zh = lang === "zh" || (typeof globalThis.getUiLanguage === "function" && globalThis.getUiLanguage() === "zh");
    // CSSOS_PHASE2_MV_NAMING 20260419 — MV tiers are sold as 观看权
    // (Watching Rights), so break-even copy is measured in views, not listens.
    const creditCopy = zh ? "credit消耗" : "credit cost";
    const breakevenCopy = zh ? (breakeven + " 次观看回本") : (breakeven + " views to break even");
    return {
      tierId: String(t.id || ""),
      tierName: name,
      creditUsd: credit,
      breakevenListens: breakeven,
      text: name + " · " + creditCopy + " " + credit + " · " + breakevenCopy,
      title: resolveTierDesc(t),
    };
  }

  function clearSelection() {
    state.selection = "";
    try { localStorage.removeItem(STORAGE_KEY); } catch (_err) { /* ignore */ }
  }

  // CSSOS_PHASE2_MV_PRICELESS 20260419 — truthy when this tier forbids
  // buyout. The tier-picker modal keys off this to hide the buyout row
  // entirely and swap the CTA copy to "Publish for listens only".
  function isPriceless(tier) {
    const t = tier || currentTier();
    return !!(t && t.priceless);
  }

  // CSSOS_PHASE2_MV_MODAL 20260419 — whether the user has explicitly picked
  // a tier (vs. relying on the server default). The first-time-user modal
  // opens when this returns false on panel open.
  function hasExplicitSelection() {
    const sel = readSelection();
    return typeof sel === "string" && sel.length > 0 && !!findTier(sel);
  }

  const api = {
    fetchCatalog,
    getCatalog,
    getTiers,
    findTier,
    defaultTierId,
    currentTierId,
    currentTier,
    setTier,
    classifyByRatio,
    classifyBySeconds,
    resolveTierLabel,
    resolveTierDesc,
    formatCostLabel,
    clearSelection,
    isPriceless,
    hasExplicitSelection,
    STORAGE_KEY,
    CATALOG_TTL_MS,
    CATALOG_URL,
  };

  globalThis.cssmvTiers = api;

  // Warm fetch so the panel paints the cost label on first open without a
  // blank flicker. Mirrors mv-engines-catalog's idle-callback pattern.
  const warm = function () {
    try { void fetchCatalog(false).then(() => {
      try { globalThis.dispatchEvent(new CustomEvent("cssmv:tiers-ready")); } catch (_err) { /* ignore */ }
    }); } catch (_err) { /* ignore */ }
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(warm, { timeout: 3000 });
  } else {
    setTimeout(warm, 1200);
  }
})();
