/* CSSOS_PERSON_MV_WAVE65 20260508 — Jing — keyboard shortcuts cheatsheet.
 * `?` (Shift+/) opens a centered modal listing all shortcuts; `Esc`
 * closes. Skips when focus is in an input / textarea / contenteditable.
 * Uses chord detection for `g h | g p | g f | g d`. Wires actual
 * navigations for the chord shortcuts; non-functional ones are still
 * displayed so users discover what's coming.
 *
 * Coexistence: the existing `/` handler in app.global-search.js stays
 * untouched — we don't claim `/`. Cinema and other panels keep their
 * own keydown handlers; we only consume `?` and `Esc` (Esc only when
 * the cheatsheet is open, so we never steal Esc from other modals). */
(function () {
  "use strict";

  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  function isTypingTarget(t) {
    if (!t) return false;
    var tag = t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (t.isContentEditable) return true;
    return false;
  }

  var STYLE_ID = "cssos-shortcuts-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#cssos-shortcuts-overlay{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.78);display:none;align-items:center;justify-content:center;font-family:ui-monospace,Menlo,monospace;}",
      "#cssos-shortcuts-overlay.open{display:flex;}",
      "#cssos-shortcuts-overlay .cssos-sc-modal{background:#0a1814;color:#daffee;border:1px solid rgba(0,200,140,0.35);border-radius:10px;padding:24px 28px;max-width:min(720px,94vw);max-height:88vh;overflow:auto;box-shadow:0 18px 40px rgba(0,0,0,0.6);}",
      "#cssos-shortcuts-overlay h2{margin:0 0 16px;font-size:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;}",
      "#cssos-shortcuts-overlay .cssos-sc-grid{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:18px 24px;}",
      "#cssos-shortcuts-overlay .cssos-sc-col h3{margin:0 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:0.7;}",
      "#cssos-shortcuts-overlay .cssos-sc-col ul{list-style:none;margin:0;padding:0;}",
      "#cssos-shortcuts-overlay .cssos-sc-col li{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:3px 0;}",
      "#cssos-shortcuts-overlay kbd{background:rgba(0,200,140,0.15);border:1px solid rgba(0,200,140,0.35);border-bottom-width:2px;border-radius:4px;padding:1px 6px;font-size:12px;font-family:inherit;}",
      "#cssos-shortcuts-overlay .cssos-sc-keys{flex:0 0 auto;}",
      "#cssos-shortcuts-overlay .cssos-sc-label{flex:1;text-align:right;opacity:0.85;}",
      "#cssos-shortcuts-overlay .cssos-sc-close{background:transparent;color:#daffee;border:1px solid rgba(0,200,140,0.35);border-radius:5px;padding:4px 10px;cursor:pointer;font-family:inherit;}",
      "#cssos-shortcuts-overlay .cssos-sc-foot{margin-top:14px;font-size:11px;opacity:0.6;text-align:center;}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function colHTML(title, rows) {
    var lis = rows.map(function (r) {
      var keys = r.keys.map(function (k) { return "<kbd>" + k + "</kbd>"; }).join(" ");
      return '<li><span class="cssos-sc-keys">' + keys + '</span><span class="cssos-sc-label">' + r.label + '</span></li>';
    }).join("");
    return '<div class="cssos-sc-col"><h3>' + title + '</h3><ul>' + lis + '</ul></div>';
  }

  function ensureOverlay() {
    var el = document.getElementById("cssos-shortcuts-overlay");
    if (el) return el;
    injectStyle();
    el = document.createElement("div");
    el.id = "cssos-shortcuts-overlay";
    var nav = colHTML(tr("Navigation", "导航"), [
      { keys: ["g","h"], label: tr("Home", "首页") },
      { keys: ["g","p"], label: tr("Profile", "个人") },
      { keys: ["g","f"], label: tr("Feed", "动态") },
      { keys: ["g","d"], label: tr("DMs", "私信") },
    ]);
    var creation = colHTML(tr("Creation", "创作"), [
      { keys: ["/"],     label: tr("Search", "搜索") },
      { keys: ["n"],     label: tr("New MV", "新建 MV") },
      { keys: ["c"],     label: tr("Cinema mode", "影院模式") },
      { keys: ["Esc"],   label: tr("Close", "关闭") },
    ]);
    var discovery = colHTML(tr("Discovery", "发现"), [
      { keys: ["["],     label: tr("Share", "分享") },
      { keys: ["]"],     label: tr("Bookmark", "收藏") },
      { keys: ["?"],     label: tr("Shortcuts", "快捷键") },
      { keys: [","],     label: tr("Settings", "设置") },
    ]);
    el.innerHTML =
      '<div class="cssos-sc-modal" role="dialog" aria-modal="true">' +
        '<h2><span>⌨ ' + tr("Keyboard shortcuts", "键盘快捷键") + '</span>' +
          '<button type="button" class="cssos-sc-close">' + tr("Close", "关闭") + ' (Esc)</button>' +
        '</h2>' +
        '<div class="cssos-sc-grid">' + nav + creation + discovery + '</div>' +
        '<div class="cssos-sc-foot">' + tr("Tip: press ? anywhere to reopen this.", "提示：在任意位置按 ? 重新打开。") + '</div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector(".cssos-sc-close").addEventListener("click", close);
    el.addEventListener("click", function (e) { if (e.target === el) close(); });
    return el;
  }

  function open() { ensureOverlay().classList.add("open"); }
  function close() {
    var el = document.getElementById("cssos-shortcuts-overlay");
    if (el) el.classList.remove("open");
  }
  function isOpen() {
    var el = document.getElementById("cssos-shortcuts-overlay");
    return !!(el && el.classList.contains("open"));
  }

  // Chord state.
  var chord = null;
  var chordTimer = 0;
  function setChord(k) {
    chord = k;
    if (chordTimer) clearTimeout(chordTimer);
    chordTimer = setTimeout(function () { chord = null; }, 1500);
  }
  function clearChord() {
    chord = null;
    if (chordTimer) { clearTimeout(chordTimer); chordTimer = 0; }
  }

  document.addEventListener("keydown", function (e) {
    // Esc closes only when our overlay is open — never steal Esc otherwise.
    if (e.key === "Escape" && isOpen()) {
      e.preventDefault();
      close();
      return;
    }
    if (isTypingTarget(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // `?` (Shift + /) opens cheatsheet.
    if (e.key === "?") {
      e.preventDefault();
      open();
      return;
    }

    // Chord: `g` then nav letter.
    if (chord === "g") {
      var k = String(e.key || "").toLowerCase();
      if (k === "h" || k === "p" || k === "f" || k === "d") {
        e.preventDefault();
        clearChord();
        if (k === "h") { try { location.href = "/"; } catch (_e) {} }
        else if (k === "p") { location.hash = "#profile"; }
        else if (k === "f") { location.hash = "#feed"; }
        else if (k === "d") { location.hash = "#dm"; }
        return;
      }
      // Any non-matching key resets the chord.
      clearChord();
    }
    if (e.key === "g" || e.key === "G") {
      // Don't preempt — just arm the chord.
      setChord("g");
    }
  });

  globalThis.cssosOpenShortcutsCheatsheet = open;
})();
