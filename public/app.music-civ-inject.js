/* CSSOS_WAVE_123 20260514 — Jing
 * "音乐引擎，为什么每个人物的MV都是女声抒情的？每个文明的人物应该
 *  音乐风格都不一样才对。"
 *
 * Central fetch interceptor: whenever the MV pipeline POSTs to
 * /api/mv/music, we inject `civilization`, `era`, `gender` into the JSON
 * body (if not already present) so the Rust music handler's Wave 123
 * civilization×era→style enrichment can fire. Without these fields the
 * enrichment is skipped and Suno falls back to its soft-female-ballad
 * house style.
 *
 * Signal sources, in priority order:
 *   1. body already has the field      → leave it (explicit wins)
 *   2. globalThis.cssosCurrentWork()    → the Wave 121 bound work object
 *   3. globalThis.creationState         → civilization/era stuffed by
 *                                         the person-MV seed + others
 *   4. globalThis.state.songSeed        → legacy seed bag
 *
 * Pure additive — never removes or overrides caller-supplied values, and
 * silently no-ops for every non-music endpoint.
 */
(function () {
  "use strict";
  if (globalThis.__cssosMusicCivInjectWired) return;
  globalThis.__cssosMusicCivInjectWired = true;

  function pick(...vals) {
    for (const v of vals) {
      const s = (v == null ? "" : String(v)).trim();
      if (s) return s;
    }
    return "";
  }

  // Pull the best available cultural signal at call time.
  function resolveCulturalSignal() {
    let work = null;
    try {
      work = (typeof globalThis.cssosCurrentWork === "function" && globalThis.cssosCurrentWork()) || null;
    } catch (_) {}
    const cs = globalThis.creationState || {};
    const seed = (globalThis.state && globalThis.state.songSeed) || {};
    return {
      civilization: pick(
        work && (work.civilization || work.personCiv || work.civ),
        cs.civilization, cs.personCiv, cs.civ,
        seed.civilization, seed.personCiv,
      ),
      era: pick(
        work && (work.era || work.personEra),
        cs.era, cs.personEra,
        seed.era, seed.personEra,
      ),
      gender: pick(
        work && (work.gender || work.personGender || work.sex),
        cs.gender, cs.personGender,
        seed.gender, seed.personGender,
      ),
    };
  }

  const _origFetch = globalThis.fetch;
  if (typeof _origFetch !== "function") return;

  globalThis.fetch = function patchedFetch(input, init) {
    try {
      const url = typeof input === "string"
        ? input
        : (input && input.url) || "";
      const method = String(
        (init && init.method) ||
        (typeof input === "object" && input && input.method) ||
        "GET",
      ).toUpperCase();

      // Only touch POSTs to the music endpoint with a JSON string body.
      if (
        method === "POST" &&
        /\/api\/mv\/music(\?|$)/.test(String(url)) &&
        init && typeof init.body === "string"
      ) {
        let body = null;
        try { body = JSON.parse(init.body); } catch (_) { body = null; }
        if (body && typeof body === "object") {
          const sig = resolveCulturalSignal();
          let touched = false;
          if (!body.civilization && sig.civilization) {
            body.civilization = sig.civilization; touched = true;
          }
          if (!body.era && sig.era) {
            body.era = sig.era; touched = true;
          }
          if (!body.gender && sig.gender) {
            body.gender = sig.gender; touched = true;
          }
          if (touched) {
            const newInit = Object.assign({}, init, { body: JSON.stringify(body) });
            console.info(
              "%c[music-civ] injected cultural signal → " +
                [sig.civilization, sig.era, sig.gender].filter(Boolean).join(" / "),
              "color:#0a0;font-weight:bold",
            );
            return _origFetch.call(this, input, newInit);
          }
        }
      }
    } catch (_) {
      /* never let the interceptor break a request */
    }
    return _origFetch.call(this, input, init);
  };
})();
