/* CSSOS_WAVE_117_STEP_2 20260513 — Jing
 * "启动哪个面板，就加载哪个面板"
 *
 * Public lazy-panel API. Future panel modules opt in by adding two
 * things to index.html:
 *
 *   <script type="cssos-lazy" data-panel="market" src="app.market-commerce.js"></script>
 *
 * That `type="cssos-lazy"` is an unrecognized MIME, so the browser
 * downloads NOTHING and executes NOTHING — the tag is inert metadata.
 * The first time someone calls
 *
 *   cssosLoadPanel("market")
 *
 * we look up the matching <script type="cssos-lazy" data-panel="market">,
 * read its src, inject a real <script src=...> into <head>, and resolve
 * with a Promise that fires when the script finishes executing.
 *
 * Subsequent calls return the same cached promise → idempotent.
 *
 * MIGRATION STRATEGY:
 *   - This file ships the API now. Zero existing scripts use it yet.
 *   - Over the next few rounds we migrate one panel at a time by
 *     flipping `<script src=...>` → `<script type="cssos-lazy" data-panel=...>`
 *     and adding a `cssosLoadPanel(...)` call at the panel's entry point
 *     (the click handler that opens it).
 *   - Heaviest panels first: mv-pipeline (444 KB), watch-ui (392 KB),
 *     person-mv (188 KB), market (184 KB) = 1.2 MB removed from
 *     first-paint on mobile.
 */
(function () {
  "use strict";
  if (globalThis.cssosLoadPanel) return;

  const cache = new Map(); // name → Promise<void>

  function loadOne(name) {
    if (cache.has(name)) return cache.get(name);
    const tag = document.querySelector(
      `script[type="cssos-lazy"][data-panel="${CSS.escape(name)}"]`,
    );
    if (!tag) {
      const err = new Error(`cssosLoadPanel: no <script type="cssos-lazy" data-panel="${name}"> found`);
      console.warn(err.message);
      const rejected = Promise.reject(err);
      // Don't cache failures — the tag might appear later via DOM injection
      return rejected;
    }
    const src = tag.getAttribute("src");
    if (!src) {
      const err = new Error(`cssosLoadPanel: lazy tag for "${name}" has no src`);
      return Promise.reject(err);
    }
    // Show a tiny progress toast on first load so the user knows
    // something is happening on slow networks.
    let toastShown = false;
    const showLoadingToast = () => {
      if (toastShown) return;
      toastShown = true;
      try {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(`Loading ${name}…`);
        }
      } catch (_) {}
    };
    const slowTimer = setTimeout(showLoadingToast, 400);
    const p = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = false; // preserve execution-order semantics within a panel
      s.dataset.cssosPanel = name;
      s.onload = () => { clearTimeout(slowTimer); resolve(); };
      s.onerror = (e) => {
        clearTimeout(slowTimer);
        cache.delete(name); // allow retry
        reject(new Error(`script_load_failed:${src}`));
      };
      document.head.appendChild(s);
    });
    cache.set(name, p);
    return p;
  }

  /* Public API. Returns a Promise that resolves AFTER every lazy
   * script bound to that panel name has loaded and executed. Accepts
   * a single name string OR an array of names (loaded in parallel). */
  globalThis.cssosLoadPanel = function (nameOrNames) {
    if (Array.isArray(nameOrNames)) {
      return Promise.all(nameOrNames.map(loadOne));
    }
    return loadOne(String(nameOrNames));
  };

  /* Convenience helper: wire a click on `el` to load `panel` then call
   * `onReady()`. Useful for dock icons / nav buttons that should
   * lazily mount the panel on first click. */
  globalThis.cssosBindLazyPanelTrigger = function (el, panel, onReady) {
    if (!(el instanceof Element)) return;
    if (el.dataset.cgLazyBound === "1") return;
    el.dataset.cgLazyBound = "1";
    el.addEventListener("click", async (ev) => {
      try {
        await globalThis.cssosLoadPanel(panel);
        if (typeof onReady === "function") onReady(ev);
      } catch (err) {
        console.warn(`[lazy-panel] ${panel} failed:`, err);
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(`Couldn't load ${panel} — please retry.`);
        }
      }
    });
  };

  /* Shim helper: register a global function name that lazy-loads a panel
   * on first call, then forwards to the real function the panel installs.
   * Lets us flip a panel to lazy in index.html without touching the
   * ~50 call sites scattered through app.js / context-menu-fallbacks /
   * dock builders that already invoke `globalThis.fooModule?.()`. */
  globalThis.cssosRegisterLazyShim = function (fnName, panelName) {
    if (typeof globalThis[fnName] === "function") return; // real fn already loaded
    globalThis[fnName] = async function (...args) {
      await globalThis.cssosLoadPanel(panelName);
      const real = globalThis[fnName];
      // The real script overwrote the shim during load. If not, bail.
      if (typeof real !== "function" || real === globalThis.cssosRegisterLazyShim) {
        console.warn(`[lazy-shim] panel "${panelName}" loaded but ${fnName} still missing`);
        return undefined;
      }
      return real.apply(this, args);
    };
  };

  // First-batch lazy registrations. Each panel must declare a
  // <script type="cssos-lazy" data-panel="..."> tag in index.html.
  // Wave 117 Step 2 Phase 1: notifications-panel (cleanest island).
  globalThis.cssosRegisterLazyShim("openNotificationsPanelModule", "notifications");

  // Wave 117 Step 2 Phase 2: market-commerce (184 KB). Touched by many
  // surfaces (price-strip Listen/Buyout/Tip, foryou panel, watch
  // queue preview, works-center pricing). Each shimmed function
  // lazy-loads the whole module on first call; subsequent calls hit
  // the real fn directly (shim overwritten by the real export). The
  // first call sees a Promise — most callers fire-and-forget, the
  // one sync caller (works-center pricing filter) falls back to
  // direct work.* fields for that first render and self-heals.
  [
    "dispatchMarketWorkPayment",
    "renderForyouMarketplace",
    "loadPublicMarketWorks",
    "openMarketWorkPreview",
    "resolveDisplayedWorkPricingModule",
    "startNihaoPayTipFromButton",
    "buildWorksCardDeepDetailsMarkupModule",
    "buildWorksCardEngineBreakdownMarkupModule",
  ].forEach((fn) => globalThis.cssosRegisterLazyShim(fn, "market"));

  // Diagnostic: list what's lazy-registered and what's loaded.
  globalThis.cssosLazyPanelDebug = function () {
    const declared = Array.from(
      document.querySelectorAll('script[type="cssos-lazy"][data-panel]'),
    ).map((t) => ({
      panel: t.getAttribute("data-panel"),
      src: t.getAttribute("src"),
      loaded: cache.has(String(t.getAttribute("data-panel"))),
    }));
    return { declared, loadedCount: cache.size };
  };
})();
