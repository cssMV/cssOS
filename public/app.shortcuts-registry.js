/* CSSOS_WAVE_1765 20260720 — Jing「统一快捷键控制中枢」(W1766 全量迁移)
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Global keyboard shortcuts used to be scattered across ~6 files. This is the
 * ONE place to add / change / look up a global shortcut.
 *
 * TWO responsibilities:
 *   1. DISPATCH — owns the real document/window keydown listeners. Feature
 *      files register their EXISTING handler here (body unchanged) with the
 *      SAME event phase (capture/bubble) + target (window/document) they used
 *      before, so browser event ordering is byte-for-byte preserved. The hub
 *      attaches at most one real listener per (target, phase) combo and runs
 *      that combo's registered handlers in registration (script-load) order —
 *      identical to the old world of separate listeners at the same phase.
 *   2. CATALOG — a single declarative table of EVERY global shortcut, incl.
 *      ones that can't be hub-dispatched (lazy-loaded cheatsheet, modal-scoped
 *      ⌘S save) which stay owned by their file but are indexed here.
 *
 * BEHAVIOR-PRESERVING CONTRACT (W1766): migrating a handler must NOT change
 * its logic — only WHERE it is attached. Each feature file wraps its handler:
 *     if (cssosShortcuts?.register) cssosShortcuts.register({owned:true, handler, target, phase, ...})
 *     else <node>.addEventListener("keydown", handler, capture)   // fallback = zero regression
 * The fallback means even if this hub fails to load, every shortcut still works
 * exactly as before.
 *
 * TO ADD A NEW GLOBAL SHORTCUT: register it here (owned:true) or from your file.
 */
(function () {
  "use strict";
  if (globalThis.cssosShortcuts) return;

  var registry = [];
  var boundCombos = {}; // "target|phase" -> true (one real listener per combo)

  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    return (globalThis.currentLocale === "zh") ? zh : en;
  }

  function ensureCombo(target, phase) {
    var key = target + "|" + phase;
    if (boundCombos[key]) return;
    boundCombos[key] = true;
    var node = (target === "window") ? window : document;
    var capture = (phase === "capture");
    node.addEventListener("keydown", function (e) {
      // Run every owned handler registered for THIS exact (target, phase),
      // in registration order — equivalent to the old separate listeners.
      for (var i = 0; i < registry.length; i++) {
        var s = registry[i];
        if (!s.owned || typeof s.handler !== "function") continue;
        if ((s.target || "document") !== target) continue;
        if ((s.phase || "bubble") !== phase) continue;
        if (typeof s.when === "function") { try { if (!s.when()) continue; } catch (_w) { continue; } }
        try { s.handler(e); } catch (_e2) {}
      }
    }, capture);
  }

  function register(def) {
    if (!def || !def.id) return;
    for (var i = registry.length - 1; i >= 0; i--) {
      if (registry[i].id === def.id) registry.splice(i, 1);
    }
    registry.push(def);
    if (def.owned && typeof def.handler === "function") {
      ensureCombo(def.target || "document", def.phase || "bubble");
    }
  }
  function unregister(id) {
    for (var i = registry.length - 1; i >= 0; i--) {
      if (registry[i].id === id) registry.splice(i, 1);
    }
  }
  function list() { return registry.slice(); }

  globalThis.cssosShortcuts = {
    register: register,
    unregister: unregister,
    list: list,
    lc: lc
  };

  // ---- CATALOG-ONLY entries (owned by their file, NOT hub-dispatched) -----
  //   cheatsheet + nav-chord: lazy-loaded by app.shortcuts-shim.js on `?` press,
  //   so their listener may not exist yet at hub-init — left in place.
  //   wave-editor-save: added/removed with the wave-editor modal lifecycle.
  //   The owned (hub-dispatched) shortcuts are registered by their own files:
  //     create-mv (N) ......... app.boot.js
  //     player-keys (j/l/m/s/↑↓←→/0-9) app.mv-keys.js
  //     karaoke-nudge (←→↑↓ 0) app.watch-ui.js
  //     queue-advance (PgUp/PgDn) app.watch-ui.js
  //     panel-chord (C-S-x) ... app.panel-shortcuts.js
  //     subtitle-fine-tune-toggle (T) app.subtitle-wave-editor.js
  register({ id: "cheatsheet",       keys: "?",              owned: false, source: "app.shortcuts-cheatsheet.js (lazy via shim)", desc: function () { return lc("Show keyboard cheatsheet", "显示快捷键表"); } });
  register({ id: "nav-chord",        keys: "G then h/p/f/d", owned: false, source: "app.shortcuts-cheatsheet.js (lazy)",           desc: function () { return lc("Go to home / profile / feed / dm", "跳转 主页/资料/信息流/私信"); } });
  register({ id: "wave-editor-save", keys: "⌘/Ctrl+S",       owned: false, source: "app.subtitle-wave-editor.js (modal-scoped)",   desc: function () { return lc("Save subtitle timing (wave editor)", "保存字幕时间轴 (波形编辑器)"); } });
})();
