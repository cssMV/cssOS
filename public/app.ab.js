/* CSSOS_PERSON_MV_WAVE27 20260508 — Jing
 * Lightweight A/B helper. Two globals:
 *   await cssosAbVariant(experimentId, callback?)  → resolves with variant
 *     and (if callback) invokes callback(variant). Auto-fires "exposure"
 *     server-side as part of the assignment endpoint.
 *   cssosAbConvert(experimentId, payload?)         → fire-and-forget
 *     conversion event.
 * Variants are cached per page-load; the server is the source of truth
 * (deterministic by user_id+experiment_id), so re-asking inside the same
 * session never reshuffles. */
(function () {
  "use strict";
  if (globalThis.cssosAbVariant) return;

  const cache = new Map(); // experimentId → Promise<variant|null>

  async function fetchVariant(experimentId) {
    try {
      const res = await fetch(
        "/api/ab/assignment/" + encodeURIComponent(experimentId),
        { credentials: "include", headers: { Accept: "application/json" } },
      );
      if (!res.ok) return null;
      const j = await res.json().catch(() => null);
      if (!j || j.ok !== true) return null;
      return String(j.variant || "") || null;
    } catch {
      return null;
    }
  }

  async function cssosAbVariant(experimentId, callback) {
    const id = String(experimentId || "").trim();
    if (!id) return null;
    if (!cache.has(id)) cache.set(id, fetchVariant(id));
    const variant = await cache.get(id);
    if (variant && typeof callback === "function") {
      try { callback(variant); } catch (err) { console.warn("[ab] callback failed:", err); }
    }
    return variant;
  }

  function cssosAbConvert(experimentId, payload) {
    const id = String(experimentId || "").trim();
    if (!id) return;
    try {
      fetch("/api/ab/event", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experiment_id: id,
          event_kind: "conversion",
          payload: (payload && typeof payload === "object") ? payload : {},
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  globalThis.cssosAbVariant = cssosAbVariant;
  globalThis.cssosAbConvert = cssosAbConvert;
})();
