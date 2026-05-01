// CSSOS_PHASE2_I18N_MVP 20260418 — runtime LLM-backed translator (frontend).
//
// Ships two new APIs under `window.CSSOS_I18N`:
//
//   tr(englishSource, vars?) -> string (synchronous best-effort)
//       If the current locale is English, returns the English verbatim.
//       If not, and the translation is in the in-memory or IndexedDB cache,
//       returns the cached translation. If not, kicks off a batched request
//       to `/api/i18n/translate` and returns the English verbatim as a
//       placeholder. The caller may observe `cssos:i18n-translation-ready`
//       on `window` to refresh DOM nodes once the translation arrives.
//
//   trAsync(englishSource, vars?) -> Promise<string>
//       Same as `tr`, but awaits the network round-trip on cache miss.
//
// Caching tiers:
//   1. In-memory Map (process-local, fastest).
//   2. IndexedDB object store `cssos-i18n/translations` (survives reload).
//   3. Server (Rust `/api/i18n/translate` endpoint, backed by Postgres + LLM).
//
// Placeholders like `{name}` are interpolated AFTER translation, so the
// server sees the raw template and preserves tokens. A short debounce window
// batches all `tr()` calls within ~40ms into one HTTP POST — critical for
// first paint when dozens of strings ask for translation at once.

(function () {
  "use strict";
  const INDEXEDDB_NAME = "cssos-i18n";
  const INDEXEDDB_STORE = "translations";
  const INDEXEDDB_VERSION = 1;
  const ENDPOINT = "/api/i18n/translate";
  const DEBOUNCE_MS = 40;
  const MAX_BATCH = 200;
  const READY_EVENT = "cssos:i18n-translation-ready";
  // CSSMV_CONSOLE_CLEANUP 20260424 #92 — Jing: "祖国江山一片红". Persist the
  // circuit breaker across browser sessions in localStorage (was session-
  // storage) so the first 404 trips it globally instead of once per tab.
  // Extended TTL to 6 hours because backend is known-not-yet-shipped in
  // this environment; self-heals automatically when the endpoint comes
  // online (or sooner if the user manually clears local storage).
  const DISABLED_SS_KEY = "cssos.i18n.translate.disabledUntil";
  const DISABLED_TTL_MS = 6 * 60 * 60 * 1000;
  const DISABLED_STORE = (typeof localStorage !== "undefined") ? localStorage : null;

  const memoryCache = new Map();         // `${hash}:${locale}` -> translated
  const inFlight = new Map();            // `${hash}:${locale}` -> Promise<string>
  let pendingQueue = [];                 // [{ source, locale, resolve }]
  let flushTimer = null;
  let dbPromise = null;
  let disabled = false;                  // set true if IndexedDB + fetch both fail
  let flushChain = Promise.resolve();    // serializes flushQueue runs so that
                                         // the first 404 trips the circuit
                                         // breaker before subsequent batches
                                         // ever hit the network.

  // CSSMV_CONSOLE_CLEANUP 20260423 #92 — rehydrate the breaker from the
  // previous page load. If the endpoint was 404ing 30s ago, it's almost
  // certainly still 404ing now, so skip the network round-trip entirely.
  try {
    const untilStr = DISABLED_STORE ? DISABLED_STORE.getItem(DISABLED_SS_KEY) : null;
    const until = untilStr ? parseInt(untilStr, 10) : 0;
    if (until && Date.now() < until) {
      disabled = true;
    } else if (untilStr && DISABLED_STORE) {
      try { DISABLED_STORE.removeItem(DISABLED_SS_KEY); } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }

  function tripBreaker() {
    disabled = true;
    try {
      if (DISABLED_STORE) {
        DISABLED_STORE.setItem(DISABLED_SS_KEY, String(Date.now() + DISABLED_TTL_MS));
      }
    } catch (_) { /* ignore */ }
  }

  function getCurrentLocale() {
    try {
      const mod = window.CSSOS_I18N;
      if (mod && typeof mod.getCurrentLocale === "function") {
        return mod.getCurrentLocale() || "en";
      }
    } catch (_) { /* ignore */ }
    return "en";
  }

  function isEnglishLocale(locale) {
    if (!locale) return true;
    const lo = String(locale).toLowerCase();
    return lo === "en" || lo === "en-us" || lo === "en-gb";
  }

  function interpolate(template, vars) {
    if (!vars || typeof vars !== "object") return String(template || "");
    return String(template || "").replace(/\{(\w+)\}/g, function (_, key) {
      return vars[key] != null ? String(vars[key]) : "{" + key + "}";
    });
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      try {
        if (!window.indexedDB) { resolve(null); return; }
        const req = window.indexedDB.open(INDEXEDDB_NAME, INDEXEDDB_VERSION);
        req.onupgradeneeded = function () {
          const db = req.result;
          if (!db.objectStoreNames.contains(INDEXEDDB_STORE)) {
            db.createObjectStore(INDEXEDDB_STORE);
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (_) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  async function hashText(text) {
    if (!window.crypto || !window.crypto.subtle) {
      // Fallback: naive fnv1a-ish; server-side will recompute SHA-256 anyway,
      // so this only affects our local cache key when SubtleCrypto is missing.
      let h = 2166136261 >>> 0;
      for (let i = 0; i < text.length; i++) {
        h = (h ^ text.charCodeAt(i)) >>> 0;
        h = Math.imul(h, 16777619) >>> 0;
      }
      return "fnv_" + h.toString(16);
    }
    const enc = new TextEncoder().encode(text);
    const buf = await window.crypto.subtle.digest("SHA-256", enc);
    const bytes = new Uint8Array(buf);
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  }

  async function dbGet(keys) {
    const db = await openDb();
    if (!db) return {};
    return new Promise(function (resolve) {
      try {
        const tx = db.transaction(INDEXEDDB_STORE, "readonly");
        const store = tx.objectStore(INDEXEDDB_STORE);
        const out = {};
        let remaining = keys.length;
        if (!remaining) { resolve({}); return; }
        keys.forEach(function (k) {
          const rq = store.get(k);
          rq.onsuccess = function () {
            if (rq.result != null) out[k] = rq.result;
            if (--remaining === 0) resolve(out);
          };
          rq.onerror = function () {
            if (--remaining === 0) resolve(out);
          };
        });
      } catch (_) { resolve({}); }
    });
  }

  async function dbPut(entries) {
    if (!entries || !entries.length) return;
    const db = await openDb();
    if (!db) return;
    return new Promise(function (resolve) {
      try {
        const tx = db.transaction(INDEXEDDB_STORE, "readwrite");
        const store = tx.objectStore(INDEXEDDB_STORE);
        entries.forEach(function (e) {
          try { store.put(e.value, e.key); } catch (_) { /* ignore */ }
        });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
        tx.onabort = function () { resolve(); };
      } catch (_) { resolve(); }
    });
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      // Serialize flushes so the first 404 trips the circuit breaker BEFORE
      // concurrent batches hit the network. Without this, 10+ flushes fan
      // out in parallel during first paint and every one of them logs a 404.
      flushChain = flushChain.then(flushQueue).catch(function () { /* ignore */ });
    }, DEBOUNCE_MS);
  }

  async function flushQueue() {
    if (disabled) {
      pendingQueue.forEach(function (e) { e.resolve(e.source); });
      pendingQueue = [];
      return;
    }
    const batch = pendingQueue;
    pendingQueue = [];
    if (!batch.length) return;

    // Group by locale so we can issue one POST per locale.
    const byLocale = new Map();
    batch.forEach(function (entry) {
      if (!byLocale.has(entry.locale)) byLocale.set(entry.locale, []);
      byLocale.get(entry.locale).push(entry);
    });

    for (const [locale, entries] of byLocale.entries()) {
      // Server caps at MAX_BATCH; chunk to be safe.
      for (let i = 0; i < entries.length; i += MAX_BATCH) {
        if (disabled) {
          entries.slice(i).forEach(function (e) { e.resolve(e.source); });
          break;
        }
        const chunk = entries.slice(i, i + MAX_BATCH);
        const sources = chunk.map(function (e) { return e.source; });
        try {
          const response = await fetch(ENDPOINT, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: locale, sources: sources })
          });
          if (!response.ok) {
            // Endpoint not deployed or permanently rejecting — trip the
            // circuit breaker so we stop spamming the network. Falls back to
            // English for every subsequent call this session.
            if (response.status === 404 || response.status === 405 ||
                response.status === 501 || response.status === 502 ||
                response.status === 503) {
              tripBreaker();
            }
            chunk.forEach(function (e) { e.resolve(e.source); });
            continue;
          }
          const body = await response.json();
          const arr = Array.isArray(body.translations) ? body.translations : [];
          const bySource = new Map();
          const writes = [];
          arr.forEach(function (item) {
            if (!item || typeof item.source !== "string") return;
            bySource.set(item.source, {
              translated: String(item.translated || item.source),
              hash: String(item.hash || "")
            });
          });
          chunk.forEach(function (entry) {
            const hit = bySource.get(entry.source);
            const translated = hit ? hit.translated : entry.source;
            const keyHash = hit && hit.hash ? hit.hash : "";
            if (keyHash) {
              const k = keyHash + ":" + locale;
              memoryCache.set(k, translated);
              writes.push({ key: k, value: translated });
            }
            entry.resolve(translated);
          });
          if (writes.length) dbPut(writes).catch(function () { /* ignore */ });
        } catch (_) {
          // Network-level failure (DNS, refused, offline). Trip the breaker
          // — same rationale as HTTP 5xx above — so we don't pummel an
          // unavailable endpoint on every subsequent first-paint.
          tripBreaker();
          chunk.forEach(function (e) { e.resolve(e.source); });
        }
      }
    }

    try {
      window.dispatchEvent(new CustomEvent(READY_EVENT, { detail: { size: batch.length } }));
    } catch (_) { /* ignore */ }
  }

  function enqueue(source, locale) {
    return new Promise(function (resolve) {
      pendingQueue.push({ source: source, locale: locale, resolve: resolve });
      scheduleFlush();
    });
  }

  async function translateOne(source, locale) {
    if (!source) return "";
    if (isEnglishLocale(locale)) return source;
    const hash = await hashText(source);
    const key = hash + ":" + locale;
    if (memoryCache.has(key)) return memoryCache.get(key);
    if (inFlight.has(key)) return inFlight.get(key);

    const task = (async function () {
      const hits = await dbGet([key]);
      if (hits[key] != null) {
        memoryCache.set(key, hits[key]);
        return hits[key];
      }
      const fromNet = await enqueue(source, locale);
      return fromNet;
    })().finally(function () { inFlight.delete(key); });

    inFlight.set(key, task);
    return task;
  }

  function translateSync(source, locale) {
    if (!source) return "";
    if (isEnglishLocale(locale)) return source;
    // Best-effort synchronous: if we already have a memory hit, return it.
    // Otherwise trigger the async path but hand back the English source now.
    // Optimistic key lookup: we don't have the hash synchronously, so we
    // iterate recent entries. For small hot sets this is fine; for large
    // ones the first call pays the hash cost asynchronously anyway.
    for (const [k, v] of memoryCache.entries()) {
      if (k.endsWith(":" + locale) && v === source) continue;
      // We cannot reverse-lookup by English source without also tracking the
      // reverse map; keep a separate quick-lookup map for sync callers.
    }
    const quick = quickSync.get(locale + "|" + source);
    if (quick != null) return quick;
    translateOne(source, locale).then(function (translated) {
      if (translated !== source) {
        quickSync.set(locale + "|" + source, translated);
      }
    }).catch(function () { /* ignore */ });
    return source;
  }

  // Reverse cache: (locale|english) -> translated. Populated after async
  // resolution so subsequent sync calls hit immediately.
  const quickSync = new Map();

  function tr(englishSource, vars) {
    const locale = getCurrentLocale();
    if (!englishSource) return "";
    if (isEnglishLocale(locale)) return interpolate(englishSource, vars);
    const translated = translateSync(englishSource, locale);
    return interpolate(translated, vars);
  }

  async function trAsync(englishSource, vars) {
    const locale = getCurrentLocale();
    if (!englishSource) return "";
    if (isEnglishLocale(locale)) return interpolate(englishSource, vars);
    const translated = await translateOne(englishSource, locale);
    quickSync.set(locale + "|" + englishSource, translated);
    return interpolate(translated, vars);
  }

  // DOM auto-translation helper: call `tr` on every element with
  // `data-cssos-tr` and replace its textContent. Also observes future
  // nodes via MutationObserver so dynamically-inserted markup picks up
  // translations without caller changes.
  function applyDomAttribute(root) {
    const scope = root || document;
    if (!scope || typeof scope.querySelectorAll !== "function") return;
    const nodes = scope.querySelectorAll("[data-cssos-tr]");
    nodes.forEach(function (el) {
      const src = el.getAttribute("data-cssos-tr") || el.textContent || "";
      if (!src) return;
      trAsync(src).then(function (translated) {
        if (el.isConnected && el.textContent !== translated) {
          el.textContent = translated;
        }
      }).catch(function () { /* ignore */ });
    });
  }

  function observeDomAttribute() {
    try {
      const obs = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          m.addedNodes.forEach(function (n) {
            if (n.nodeType === 1) applyDomAttribute(n);
          });
        });
      });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (_) { /* ignore */ }
  }

  // Re-apply DOM translations when the locale changes (e.g., user picks a
  // new language from the menu).
  function wireLocaleChangeHook() {
    try {
      const baseMod = window.CSSOS_I18N;
      if (!baseMod || typeof baseMod.setCurrentLocale !== "function") return;
      const original = baseMod.setCurrentLocale;
      baseMod.setCurrentLocale = function (locale) {
        const prev = (typeof baseMod.getCurrentLocale === "function")
          ? baseMod.getCurrentLocale()
          : null;
        original.call(baseMod, locale);
        if (locale !== prev) {
          quickSync.clear();
          applyDomAttribute(document);
        }
      };
    } catch (_) { /* ignore */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyDomAttribute(document);
      observeDomAttribute();
      wireLocaleChangeHook();
    }, { once: true });
  } else {
    applyDomAttribute(document);
    observeDomAttribute();
    wireLocaleChangeHook();
  }

  // Attach runtime APIs to the existing i18n module if present, else to a
  // standalone namespace.
  const baseMod = window.CSSOS_I18N || {};
  baseMod.tr = tr;
  baseMod.trAsync = trAsync;
  baseMod.translateOne = translateOne;
  baseMod.applyDomAttribute = applyDomAttribute;
  window.CSSOS_I18N = baseMod;
  window.CSSOS_I18N_RUNTIME = {
    translateOne: translateOne,
    applyDomAttribute: applyDomAttribute,
    endpoint: ENDPOINT,
    version: "20260418-mvp-1"
  };
})();
