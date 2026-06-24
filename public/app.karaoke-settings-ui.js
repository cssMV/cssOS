/* CSSOS_KARAOKE_SETTINGS_UI 20260507 — Jing
 *
 * "用户不关心我们背后付出多少技术血汗，只关心好用吗". Slider panel
 * exposes every karaoke fancy-effect param without making the user
 * type into a console. Triggered by right-clicking the loop button
 * (low-key entry, doesn't bloat the cluster) or by calling
 * globalThis.cssosKaraokeSettings.open().
 *
 * Each control binds straight to cssosKaraokeWord.setConfig({...}),
 * so changes take effect instantly. Reset button → resetConfig.
 */
(function () {
  "use strict";

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    return lang.indexOf("zh") === 0 && zh ? zh : en;
  }

  var panelEl = null;

  function ensureStyles() {
    if (document.getElementById("cssos-karaoke-settings-style")) return;
    var s = document.createElement("style");
    s.id = "cssos-karaoke-settings-style";
    s.textContent =
      "#cssos-karaoke-settings{" +
        "position:fixed;right:24px;bottom:24px;width:min(340px,90vw);" +
        "max-height:min(70vh,560px);overflow:auto;padding:18px 18px 14px;" +
        "z-index:2147483646;border-radius:14px;" +
        "background:var(--panel-strong);" +
        "border:1px solid rgba(0,245,160,0.35);" +
        "box-shadow:0 18px 38px rgba(0,0,0,0.55);" +
        "color:var(--text);font:13px/1.4 -apple-system,system-ui,sans-serif;" +
      "}" +
      "#cssos-karaoke-settings h3{" +
        "margin:0 0 12px;font:700 14px/1.2 ui-monospace,monospace;" +
        "letter-spacing:.06em;text-transform:uppercase;color:#00f5a0;" +
      "}" +
      "#cssos-karaoke-settings .row{" +
        "display:grid;grid-template-columns:1fr auto;gap:6px 10px;" +
        "padding:6px 0;align-items:center;" +
      "}" +
      "#cssos-karaoke-settings label{font-size:11px;color:var(--muted);}" +
      "#cssos-karaoke-settings .val{" +
        "font:600 11px/1 ui-monospace,monospace;color:#00f5a0;min-width:48px;text-align:right;" +
      "}" +
      "#cssos-karaoke-settings input[type=range]{" +
        "grid-column:1/-1;width:100%;accent-color:#00f5a0;" +
      "}" +
      "#cssos-karaoke-settings .ftrow{" +
        "display:flex;gap:8px;margin-top:14px;" +
      "}" +
      "#cssos-karaoke-settings button{" +
        "all:unset;cursor:pointer;padding:8px 14px;border-radius:8px;" +
        "background:rgba(0,245,160,0.16);border:1px solid rgba(0,245,160,0.3);" +
        "color:#daffee;font:600 12px/1 ui-monospace,monospace;flex:1;text-align:center;" +
      "}" +
      "#cssos-karaoke-settings button.primary{" +
        "background:rgba(0,245,160,0.85);color:#001b14;border-color:transparent;" +
      "}" +
      "#cssos-karaoke-settings .close{" +
        "position:absolute;top:8px;right:10px;" +
        "background:transparent;border:0;color:var(--muted);" +
        "font:600 18px/1 ui-monospace,monospace;cursor:pointer;padding:2px 6px;flex:0;" +
      "}";
    document.head.appendChild(s);
  }

  function buildSlider(opts) {
    var wrap = document.createElement("div");
    wrap.className = "row";
    var lab = document.createElement("label");
    lab.textContent = opts.label;
    var val = document.createElement("span");
    val.className = "val";
    var input = document.createElement("input");
    input.type = "range";
    input.min = String(opts.min);
    input.max = String(opts.max);
    input.step = String(opts.step);
    input.value = String(opts.value);
    var fmt = opts.fmt || function (v) { return Number(v).toFixed(2); };
    val.textContent = fmt(opts.value);
    input.addEventListener("input", function () {
      val.textContent = fmt(input.value);
      var patch = {};
      patch[opts.key] = Number(input.value);
      try { globalThis.cssosKaraokeWord.setConfig(patch); } catch (_e) {}
    });
    wrap.appendChild(lab);
    wrap.appendChild(val);
    wrap.appendChild(input);
    return wrap;
  }

  function buildToggle(label, key, value) {
    var wrap = document.createElement("div");
    wrap.className = "row";
    var lab = document.createElement("label");
    lab.textContent = label;
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!value;
    input.style.cursor = "pointer";
    input.addEventListener("change", function () {
      var patch = {};
      patch[key] = !!input.checked;
      try { globalThis.cssosKaraokeWord.setConfig(patch); } catch (_e) {}
    });
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  function pickMount() {
    /* In fullscreen, the only visible content is descendants of
     * document.fullscreenElement. Anything appended to body is hidden.
     * Mount the panel inside the fullscreen element so it stays
     * visible while the user is in cinema/Immersive mode. */
    return document.fullscreenElement || document.webkitFullscreenElement || document.body;
  }
  function moveToCurrentMount() {
    if (!panelEl) return;
    var mount = pickMount();
    if (panelEl.parentNode !== mount) {
      mount.appendChild(panelEl);
    }
  }

  function buildPanel() {
    if (panelEl) {
      moveToCurrentMount();
      return panelEl;
    }
    ensureStyles();
    var cfg = (globalThis.cssosKaraokeWord && globalThis.cssosKaraokeWord.config()) || {};
    panelEl = document.createElement("div");
    panelEl.id = "cssos-karaoke-settings";
    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-label", tt("Karaoke fancy effects", "字幕特效"));
    var close = document.createElement("button");
    close.className = "close";
    close.textContent = "×";
    close.setAttribute("aria-label", tt("Close", "关闭"));
    close.addEventListener("click", hide);
    panelEl.appendChild(close);
    var h = document.createElement("h3");
    h.textContent = tt("Karaoke fancy", "字幕特效");
    panelEl.appendChild(h);
    panelEl.appendChild(buildToggle(tt("Enabled", "启用"), "enabled", cfg.enabled !== false));
    panelEl.appendChild(buildSlider({
      label: tt("Sync offset (s)", "同步提前 (秒)"),
      key: "lookahead_s", min: 0, max: 0.5, step: 0.01, value: cfg.lookahead_s,
      fmt: function (v) { return Number(v).toFixed(2) + "s"; },
    }));
    panelEl.appendChild(buildSlider({
      label: tt("Hot word scale", "高亮放大"),
      key: "scale_base", min: 1.0, max: 2.5, step: 0.05, value: cfg.scale_base,
      fmt: function (v) { return Number(v).toFixed(2) + "×"; },
    }));
    panelEl.appendChild(buildSlider({
      label: tt("Breath low", "呼吸最小"),
      key: "scale_breath_min", min: 1.0, max: 2.5, step: 0.05, value: cfg.scale_breath_min,
      fmt: function (v) { return Number(v).toFixed(2) + "×"; },
    }));
    panelEl.appendChild(buildSlider({
      label: tt("Breath high", "呼吸最大"),
      key: "scale_breath_max", min: 1.0, max: 3.0, step: 0.05, value: cfg.scale_breath_max,
      fmt: function (v) { return Number(v).toFixed(2) + "×"; },
    }));
    panelEl.appendChild(buildSlider({
      label: tt("Explode peak", "爆炸顶点"),
      key: "scale_explode", min: 1.0, max: 3.5, step: 0.05, value: cfg.scale_explode,
      fmt: function (v) { return Number(v).toFixed(2) + "×"; },
    }));
    panelEl.appendChild(buildSlider({
      label: tt("Breath cycle (ms)", "呼吸周期"),
      key: "breath_ms", min: 300, max: 3000, step: 50, value: cfg.breath_ms,
      fmt: function (v) { return Math.round(v) + "ms"; },
    }));
    panelEl.appendChild(buildSlider({
      label: tt("Glow cycle (ms)", "霓虹周期"),
      key: "glow_ms", min: 200, max: 2000, step: 50, value: cfg.glow_ms,
      fmt: function (v) { return Math.round(v) + "ms"; },
    }));
    panelEl.appendChild(buildSlider({
      label: tt("Explode duration (ms)", "爆炸时长"),
      key: "explode_ms", min: 100, max: 800, step: 20, value: cfg.explode_ms,
      fmt: function (v) { return Math.round(v) + "ms"; },
    }));
    var ftrow = document.createElement("div");
    ftrow.className = "ftrow";
    var resetBtn = document.createElement("button");
    resetBtn.textContent = tt("Reset", "重置");
    resetBtn.addEventListener("click", function () {
      try { globalThis.cssosKaraokeWord.resetConfig(); } catch (_e) {}
      hide();
      setTimeout(open, 80);
    });
    ftrow.appendChild(resetBtn);
    var doneBtn = document.createElement("button");
    doneBtn.className = "primary";
    doneBtn.textContent = tt("Done", "完成");
    doneBtn.addEventListener("click", hide);
    ftrow.appendChild(doneBtn);
    panelEl.appendChild(ftrow);
    /* Block any clicks inside the panel from bubbling out to the
     * frame click-toggle (which would pause the media). All UI
     * controls inside the panel call setConfig() on their own input
     * events; we don't need clicks to escape. */
    ["click", "pointerdown", "mousedown"].forEach(function (ev) {
      panelEl.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    pickMount().appendChild(panelEl);
    /* Re-parent on fullscreen change so the panel stays visible
     * whether the user is in cinema mode or browsing normally. */
    if (!panelEl.dataset.cssosFsBound) {
      panelEl.dataset.cssosFsBound = "1";
      document.addEventListener("fullscreenchange", moveToCurrentMount);
      document.addEventListener("webkitfullscreenchange", moveToCurrentMount);
    }
    return panelEl;
  }

  function open() {
    buildPanel();
    panelEl.style.display = "block";
  }
  function hide() {
    if (panelEl) panelEl.style.display = "none";
  }

  /* Right-click on the loop button (⟳) opens the settings — discoverable
   * but doesn't bloat the cluster with another button. */
  function bindLoopBtnRightClick() {
    var btn = document.querySelector(".cssmv-loop-btn");
    if (!btn || btn.dataset.cssosKwSettingsBound === "1") return;
    btn.dataset.cssosKwSettingsBound = "1";
    btn.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      open();
    });
    btn.title = (btn.title || "Loop") + " · " + tt("right-click for fancy settings", "右键打开字幕特效设置");
  }

  function init() {
    bindLoopBtnRightClick();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(bindLoopBtnRightClick).observe(document.body, { childList: true, subtree: true });
  }

  globalThis.cssosKaraokeSettings = { open: open, hide: hide };
})();
