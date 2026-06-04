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
    // CSSOS_WAVE_524 — src 真相源 = app.panel-manifest.js 的 CSSOS_PANEL_SRC[name]。
    // index.html 不再保留任何面板 <script>(连惰性标签也删了)。仅为向后兼容, 清单缺失时
    // 才回退去查残留的 <script type="cssos-lazy"> 标签。
    let src = (globalThis.CSSOS_PANEL_SRC && globalThis.CSSOS_PANEL_SRC[name]) || null;
    if (!src) {
      const tag = document.querySelector(
        `script[type="cssos-lazy"][data-panel="${CSS.escape(name)}"]`,
      );
      if (tag) src = tag.getAttribute("src");
    }
    if (!src) {
      const err = new Error(`cssosLoadPanel: no manifest entry / lazy tag for "${name}"`);
      console.warn(err.message);
      // Don't cache failures — the manifest/tag might appear later.
      return Promise.reject(err);
    }
    // CSSOS_WAVE_525 — 先注入面板专用 CSS(若清单登记了, 且尚未注入)。index.html 不再 eager 引入面板样式表。
    try {
      const cssHref = globalThis.CSSOS_PANEL_CSS && globalThis.CSSOS_PANEL_CSS[name];
      if (cssHref && !document.querySelector(`link[data-cssos-panel-css="${CSS.escape(name)}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = cssHref;
        link.setAttribute("data-cssos-panel-css", name);
        document.head.appendChild(link);
      }
    } catch (_cssErr) { /* 非致命: CSS 注入失败不挡 JS 加载 */ }
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
      s.onload = () => {
        clearTimeout(slowTimer);
        // CSSOS_WAVE_527 — 面板加载完, 按需连带加载其声明的卫星模块(也已移出首屏)。Fire-and-forget,
        // 不阻塞本面板 resolve; 卫星失败不影响主面板。
        try {
          const deps = (globalThis.CSSOS_PANEL_DEPS && globalThis.CSSOS_PANEL_DEPS[name]) || null;
          if (deps && deps.length) {
            deps.forEach((d) => { try { loadOne(d).catch(() => {}); } catch (_e) {} });
          }
        } catch (_e) {}
        resolve();
      };
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

  // CSSOS_WAVE_129 20260514 — the market-commerce lazy-shim block was
  // REMOVED. app.market-commerce.js is back to eager loading: it's not
  // an island (33+ functions bare-called from 14+ files) and partial
  // shimming caused a ReferenceError crash storm. See index.html
  // CSSOS_WAVE_129 note. mv-pipeline-panel (a true island) stays lazy.

  // CSSOS_WAVE_120B 20260513 — mv-pipeline-panel.js bootstrap.
  // The 444 KB script only adds UI to the MV Pipeline panel (cinema /
  // storm mode, tier label, engine-selection event listeners). The
  // real pipeline runs from app.js / app.mv-import.js. Strategy: on
  // first user click of any `[data-action="mv-pipeline"]` dock item /
  // launcher, fetch the script. Subsequent clicks hit the now-resident
  // cssmvWave6 + event listeners normally.
  function bootstrapMvPipelineLazy() {
    document.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      const trigger = t.closest("[data-action='mv-pipeline'], [data-panel-id='mv-pipeline'], [data-msrc-apply]");
      if (!trigger) return;
      // Fire-and-forget; existing click handlers continue normally.
      globalThis.cssosLoadPanel("mv-pipeline").catch((err) => {
        console.warn("[lazy-panel] mv-pipeline failed:", err);
      });
    }, true);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapMvPipelineLazy);
  } else {
    bootstrapMvPipelineLazy();
  }

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
