/* CSSOS_PLAYBACK_SPEED 20260506 — Jing
 *
 * Speed picker on the MV button cluster. ⚡ button cycles through
 * 0.75 / 1 / 1.25 / 1.5 / 2× on click; right-click opens a tiny popup
 * for direct selection. Same affordance YouTube/Vimeo have.
 *
 * Persisted: localStorage.cssos_playback_rate (default "1").
 *
 * Lives next to the existing .cssmv-fr-btn cluster, pinned at
 * right:164px (one button-width left of the PiP ⊞).
 */
(function () {
  "use strict";

  var KEY = "cssos_playback_rate";
  var RATES = [0.75, 1, 1.25, 1.5, 2];

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("zh") === 0 && zh) return zh;
    return en;
  }

  function readRate() {
    var v = parseFloat(localStorage.getItem(KEY));
    if (!isFinite(v) || v <= 0 || v > 4) return 1;
    return v;
  }
  function writeRate(r) {
    try { localStorage.setItem(KEY, String(r)); } catch (_e) {}
  }

  function fmt(r) {
    return (Math.round(r * 100) / 100).toString().replace(/\.0+$/, "") + "×";
  }

  function applyRate(r) {
    ["watch-video", "watch-audio-preview"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        try { el.playbackRate = r; el.defaultPlaybackRate = r; } catch (_e) {}
      }
    });
  }

  function flashHint(text) {
    var t = document.getElementById("cssos-speed-hint");
    if (!t) {
      t = document.createElement("div");
      t.id = "cssos-speed-hint";
      t.style.cssText =
        "position:fixed;left:50%;top:24px;transform:translateX(-50%) translateY(-6px);" +
        "z-index:2147483645;padding:6px 12px;border-radius:999px;" +
        "background:rgba(8,18,16,0.92);color:#daffee;" +
        "font:600 12px/1 ui-monospace,monospace;letter-spacing:.04em;" +
        "border:1px solid rgba(0,245,160,0.3);" +
        "box-shadow:0 8px 24px rgba(0,0,0,0.45);" +
        "opacity:0;transition:opacity .15s ease,transform .15s ease;pointer-events:none;";
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.style.opacity = "1";
    t.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(t._h);
    t._h = setTimeout(function () {
      t.style.opacity = "0";
      t.style.transform = "translateX(-50%) translateY(-6px)";
    }, 800);
  }

  function showMenu(btn) {
    var existing = document.getElementById("cssos-speed-menu");
    if (existing) { existing.remove(); return; }
    var rect = btn.getBoundingClientRect();
    var menu = document.createElement("div");
    menu.id = "cssos-speed-menu";
    menu.style.cssText =
      "position:fixed;z-index:2147483646;" +
      "top:" + (rect.top - 8) + "px;left:" + (rect.left + rect.width / 2) + "px;" +
      "transform:translate(-50%,-100%);" +
      "padding:6px;border-radius:10px;" +
      "background:rgba(8,18,16,0.96);" +
      "border:1px solid rgba(0,245,160,0.35);" +
      "box-shadow:0 12px 28px rgba(0,0,0,0.45);" +
      "display:flex;flex-direction:column;gap:2px;min-width:80px;";
    var current = readRate();
    RATES.forEach(function (r) {
      var item = document.createElement("button");
      item.type = "button";
      item.textContent = fmt(r);
      item.style.cssText =
        "all:unset;cursor:pointer;padding:6px 12px;border-radius:6px;" +
        "font:500 12px/1 ui-monospace,monospace;color:#daffee;text-align:center;" +
        (Math.abs(r - current) < 0.01
          ? "background:rgba(0,245,160,0.18);color:#00f5a0;font-weight:700;"
          : "");
      item.addEventListener("mouseenter", function () {
        if (Math.abs(r - current) > 0.01) item.style.background = "rgba(0,245,160,0.08)";
      });
      item.addEventListener("mouseleave", function () {
        if (Math.abs(r - current) > 0.01) item.style.background = "";
      });
      item.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        writeRate(r);
        applyRate(r);
        btn.textContent = fmt(r);
        flashHint(tt("Speed", "速度") + " " + fmt(r));
        menu.remove();
      });
      menu.appendChild(item);
    });
    document.body.appendChild(menu);
    var off = function (e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener("mousedown", off, true);
      }
    };
    setTimeout(function () { document.addEventListener("mousedown", off, true); }, 0);
  }

  function ensureButton() {
    var screen = document.querySelector("#watch-panel .watch-screen");
    if (!screen) return null;
    var existing = screen.querySelector(".cssmv-speed-btn");
    if (existing) return existing;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cssmv-fr-btn cssmv-speed-btn";
    btn.setAttribute("aria-label", tt("Playback speed", "播放速度"));
    btn.title = tt("Click: cycle speed · Right-click: pick", "点击: 循环切换 · 右键: 选择");
    btn.textContent = fmt(readRate());
    btn.style.cssText = "right:164px;font-size:12px;font-weight:700;letter-spacing:.02em;";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var cur = readRate();
      var idx = RATES.findIndex(function (r) { return Math.abs(r - cur) < 0.01; });
      var next = RATES[(idx + 1) % RATES.length];
      writeRate(next);
      applyRate(next);
      btn.textContent = fmt(next);
      flashHint(tt("Speed", "速度") + " " + fmt(next));
    });
    btn.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      showMenu(btn);
    });
    screen.appendChild(btn);
    return btn;
  }

  function bindMedia(el) {
    if (!el || el.dataset.cssosSpeedBound === "1") return;
    el.dataset.cssosSpeedBound = "1";
    var apply = function () { applyRate(readRate()); };
    apply();
    el.addEventListener("loadedmetadata", apply, { passive: true });
    // If something else changes the rate (browser DevTools, future feature),
    // mirror it back into the button label so the UI stays honest.
    el.addEventListener("ratechange", function () {
      var btn = document.querySelector(".cssmv-speed-btn");
      if (btn && el.playbackRate > 0) btn.textContent = fmt(el.playbackRate);
    }, { passive: true });
  }

  function init() {
    ensureButton();
    bindMedia(document.getElementById("watch-video"));
    bindMedia(document.getElementById("watch-audio-preview"));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(function () {
      ensureButton();
      bindMedia(document.getElementById("watch-video"));
      bindMedia(document.getElementById("watch-audio-preview"));
    }).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosPlaybackSpeed = {
    get: readRate,
    set: function (r) { writeRate(r); applyRate(r); },
  };
})();
