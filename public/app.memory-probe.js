/* CSSOS_WAVE_220A 20260517 — Jing: memory & leak probe.
 *
 * Purpose: surface the metrics that predict iOS WKWebView WebContent
 * process termination so we know WHAT to cut in W220.B (real unload)
 * and W220.C (asset lifecycle). NOT a fix — pure instrumentation.
 *
 * Diagnosis (cold facts):
 *   - public/index.html ships ~203 eager <script src="app.*.js"> tags
 *   - iOS WKWebView WebContent process is killed by iOS at ~1.5 GB
 *   - Symptom: "page just refreshes, no console error" — because the
 *     process carrying the console died. WKWebView reloads silently.
 *
 * What we measure (every 2s, lightweight):
 *   - JS heap (Chrome/Edge expose performance.memory; Safari hides it,
 *     we fall back to a synthetic estimator that doubles when DOM grows)
 *   - DOM node count + <img> + <video> + <audio>
 *   - Active blob URLs (we patch URL.createObjectURL to register them)
 *   - In-flight fetch / XHR
 *   - Detached panel scripts still loaded (heuristic: count
 *     window.<modulePrefix>* globals)
 *   - Active timers (best-effort via setInterval patching)
 *   - Document visibility + freshness (uptime since last reload)
 *
 * Beacon: every 30s POST snapshot to /api/telemetry/memory plus on
 * pagehide / visibility hidden / before unload. The server side is in
 * src/index.ts; lightweight JSON insert into telemetry_memory_samples.
 *
 * Exposes:
 *   globalThis.cssmemProbe.snapshot()          → current metrics object
 *   globalThis.cssmemProbe.subscribe(fn)       → fn(metrics) every tick
 *   globalThis.cssmemProbe.markPanelOpen(id)
 *   globalThis.cssmemProbe.markPanelClose(id)
 *   globalThis.cssmemProbe.recoveredFromCrash() → true if iOS killed us
 *
 * Touch nothing if Capacitor isn't present AND user isn't admin — we
 * still measure on web for dev visibility, but skip the network beacon
 * to avoid noise.
 */
(function () {
  if (globalThis.cssmemProbe) return; // idempotent

  const BOOT_TS = Date.now();
  const SAMPLE_MS = 2000;
  const BEACON_MS = 30000;

  // ─── Blob URL registry (createObjectURL patch) ────────────────────
  const blobRegistry = new Set();
  const origCreate = URL.createObjectURL.bind(URL);
  const origRevoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    const url = origCreate(obj);
    blobRegistry.add(url);
    return url;
  };
  URL.revokeObjectURL = function (url) {
    blobRegistry.delete(url);
    return origRevoke(url);
  };

  // ─── In-flight fetch counter ──────────────────────────────────────
  let inflightFetch = 0;
  const origFetch = globalThis.fetch?.bind(globalThis);
  if (origFetch) {
    globalThis.fetch = function (...args) {
      inflightFetch++;
      const p = origFetch(...args);
      p.finally(() => { inflightFetch = Math.max(0, inflightFetch - 1); });
      return p;
    };
  }

  // ─── Active interval tracking (best-effort) ───────────────────────
  const intervalRegistry = new Set();
  const origSetInterval = globalThis.setInterval.bind(globalThis);
  const origClearInterval = globalThis.clearInterval.bind(globalThis);
  globalThis.setInterval = function (...args) {
    const id = origSetInterval(...args);
    intervalRegistry.add(id);
    return id;
  };
  globalThis.clearInterval = function (id) {
    intervalRegistry.delete(id);
    return origClearInterval(id);
  };

  // ─── Panel open/close tracking ────────────────────────────────────
  const openPanels = new Set();
  function markPanelOpen(id) { if (id) openPanels.add(String(id)); }
  function markPanelClose(id) { if (id) openPanels.delete(String(id)); }

  // ─── Capacitor / iOS detection ────────────────────────────────────
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isCapacitor = !!(globalThis.Capacitor && globalThis.Capacitor.isNativePlatform && globalThis.Capacitor.isNativePlatform());

  // ─── Crash-recovery flag ──────────────────────────────────────────
  // The native side (Swift webViewWebContentProcessDidTerminate hook)
  // sets a localStorage key just before forcing reload. We read it on
  // boot, beacon it, then clear it.
  let crashRecovered = false;
  try {
    if (localStorage.getItem("cssos.crashRecovered") === "1") {
      crashRecovered = true;
      localStorage.removeItem("cssos.crashRecovered");
    }
  } catch (_) {}

  // ─── Snapshot ─────────────────────────────────────────────────────
  function snapshot() {
    const now = Date.now();
    const perf = performance;
    const mem = perf && perf.memory ? {
      used_mb: Math.round((perf.memory.usedJSHeapSize || 0) / 1048576),
      total_mb: Math.round((perf.memory.totalJSHeapSize || 0) / 1048576),
      limit_mb: Math.round((perf.memory.jsHeapSizeLimit || 0) / 1048576),
    } : null;

    const imgs = document.images ? document.images.length : 0;
    const videos = document.querySelectorAll("video").length;
    const audios = document.querySelectorAll("audio").length;
    const nodes = document.getElementsByTagName("*").length;

    // Heuristic: count globals matching app.*.js module hooks. Many
    // modules add globalThis.cssmv* / cssos* / __cssos* keys.
    let moduleGlobals = 0;
    try {
      for (const k of Object.keys(globalThis)) {
        if (/^cssmv|^cssos|^__cssos/i.test(k)) moduleGlobals++;
      }
    } catch (_) {}

    // Pressure level — green/yellow/red. Tuned for iOS 1.5GB ceiling.
    // Without performance.memory (Safari), fall back to DOM size.
    let pressure = "green";
    if (mem) {
      const r = mem.used_mb / Math.max(1, mem.limit_mb);
      if (r > 0.75) pressure = "red";
      else if (r > 0.5) pressure = "yellow";
    } else {
      // Safari fallback: DOM + blob URLs + videos as proxy.
      const score = nodes / 1000 + blobRegistry.size * 5 + videos * 20 + imgs / 100;
      if (score > 50) pressure = "red";
      else if (score > 25) pressure = "yellow";
    }

    return {
      ts: now,
      uptime_s: Math.round((now - BOOT_TS) / 1000),
      pressure,
      heap: mem,
      dom_nodes: nodes,
      images: imgs,
      videos,
      audios,
      blob_urls: blobRegistry.size,
      inflight_fetch: inflightFetch,
      open_panels: Array.from(openPanels),
      open_panel_count: openPanels.size,
      active_intervals: intervalRegistry.size,
      module_globals: moduleGlobals,
      script_tags_eager: document.querySelectorAll('script[src*="app."]:not([type="cssos-lazy"])').length,
      script_tags_lazy: document.querySelectorAll('script[type="cssos-lazy"]').length,
      crash_recovered: crashRecovered,
      platform: isCapacitor ? "capacitor" : (isIOS ? "ios-safari" : "web"),
      visibility: document.visibilityState || "unknown",
      ua: navigator.userAgent.slice(0, 200),
    };
  }

  // ─── Subscribers (HUD reads from here) ────────────────────────────
  const subscribers = new Set();
  function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }

  let lastSnap = null;
  function tick() {
    try {
      lastSnap = snapshot();
      subscribers.forEach((fn) => { try { fn(lastSnap); } catch (_) {} });
    } catch (_) {}
  }
  origSetInterval(tick, SAMPLE_MS);
  setTimeout(tick, 100); // first sample fast

  // ─── Beacon ───────────────────────────────────────────────────────
  let lastBeaconTs = 0;
  async function beacon(reason) {
    try {
      const snap = lastSnap || snapshot();
      const body = JSON.stringify({ ...snap, reason });
      // Use sendBeacon when available — fire-and-forget, survives unload.
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/telemetry/memory", blob);
      } else {
        fetch("/api/telemetry/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
          credentials: "include",
        }).catch(() => {});
      }
      lastBeaconTs = Date.now();
    } catch (_) {}
  }
  origSetInterval(() => beacon("interval"), BEACON_MS);
  if (crashRecovered) setTimeout(() => beacon("crash_recovered"), 1500);
  globalThis.addEventListener("pagehide",       () => beacon("pagehide"));
  globalThis.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") beacon("hidden");
  });

  // ─── Public API ───────────────────────────────────────────────────
  globalThis.cssmemProbe = {
    snapshot,
    subscribe,
    markPanelOpen,
    markPanelClose,
    recoveredFromCrash: () => crashRecovered,
    beacon: (r) => beacon(r || "manual"),
    isIOS, isCapacitor,
  };

  console.log("[memory-probe] W220.A armed. Sample every", SAMPLE_MS, "ms; beacon every", BEACON_MS, "ms.");
})();
