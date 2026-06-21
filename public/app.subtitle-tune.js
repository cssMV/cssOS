/* CSSOS_WAVE_995 20260618 — Jing「逐句字幕微调(第二期a)」
 * 影院/MV 面板里【边播边拖】当前字幕对齐歌声:
 *   - 编辑模式开(globalThis.cssosSubtitleTuneMode, 由情绪字幕设置 ⚙ 面板里的
 *     「✎ 字幕微调」开关切)→ 横向拖动底部字幕 #watch-subtitle:
 *     往左 = 字幕提前, 往右 = 字幕延后。拖的是【按下那一刻在屏的那一句】。
 *   - 实时生效(拖着就看到字幕相对歌声移动), 松手按【作品+句】保存(非破坏性)。
 *   - 所有指针事件 stopPropagation → 绝不触发影院上滑切歌 / 媒体暂停(W715 铁律)。
 * 引擎接口: globalThis.cssosEmotionSubtitle.{currentLineIndex,getLineOffset,setLineOffset}.
 * 文档级委托(capture): #watch-subtitle 每帧被渲染器重写 innerHTML, 直绑会丢, 故委托。 */
(function () {
  "use strict";
  var MS_PER_PX = 3;           // drag sensitivity: 3ms per pixel (fine).
  var dragging = false, startX = 0, lineIdx = -1, baseMs = 0, moved = false;

  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    return (globalThis.currentLocale === "zh") ? zh : en;
  }
  function eng() { return globalThis.cssosEmotionSubtitle; }
  function inTuneMode() { return !!globalThis.cssosSubtitleTuneMode; }

  // Tiny HUD shown while dragging: "第3句 +120ms".
  var hud = null;
  function showHud(text) {
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "cssos-subtune-hud";
      hud.style.cssText = "position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:100090;" +
        "background:rgba(8,20,16,0.86);color:#5eead4;font-weight:700;font-size:15px;" +
        "padding:8px 16px;border-radius:999px;pointer-events:none;letter-spacing:0.5px;" +
        "box-shadow:0 4px 24px rgba(0,0,0,0.45);white-space:nowrap";
    }
    hud.textContent = text;
    (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(hud);
  }
  function hideHud() { if (hud) { try { hud.remove(); } catch (_e) {} } }
  function fmt(ms) { var s = ms / 1000; return (s > 0 ? "+" : "") + s.toFixed(2) + "s"; }
  function lineLabel(i, ms) {
    return (globalThis.currentLocale === "zh")
      ? ("第 " + (i + 1) + " 句  " + fmt(ms))
      : ("Line " + (i + 1) + "  " + fmt(ms));
  }

  function onDown(ev) {
    if (!inTuneMode()) return;
    var el = ev.target && ev.target.closest && ev.target.closest("#watch-subtitle");
    if (!el) return;
    var e = eng();
    if (!e || typeof e.currentLineIndex !== "function") return;
    var i = e.currentLineIndex();
    if (i < 0) return;
    // Engage drag — and from here swallow everything so cinema swipe / pause never fire.
    ev.preventDefault();
    ev.stopPropagation();
    dragging = true; moved = false;
    startX = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
    lineIdx = i;
    baseMs = (typeof e.getLineOffset === "function") ? e.getLineOffset(i) : 0;
    showHud(lineLabel(i, baseMs));
  }
  function onMove(ev) {
    if (!dragging) return;
    ev.preventDefault();
    ev.stopPropagation();
    var x = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
    var dx = x - startX;
    if (Math.abs(dx) > 2) moved = true;
    var ms = Math.max(-30000, Math.min(30000, Math.round(baseMs + dx * MS_PER_PX)));
    var e = eng();
    try { if (e && e.setLineOffset) e.setLineOffset(lineIdx, ms, { persist: false }); } catch (_e) {}
    showHud(lineLabel(lineIdx, ms));
  }
  function onUp(ev) {
    if (!dragging) return;
    ev.preventDefault();
    ev.stopPropagation();
    dragging = false;
    var e = eng();
    // Persist final value for this line (read it back from the engine).
    try {
      if (e && e.setLineOffset && e.getLineOffset) {
        e.setLineOffset(lineIdx, e.getLineOffset(lineIdx), { persist: true });
      }
    } catch (_e) {}
    if (moved) {
      try { if (typeof globalThis.cssosGuidedToast === "function") globalThis.cssosGuidedToast(lc("Line timing saved", "该句对齐已保存")); } catch (_e) {}
    }
    setTimeout(hideHud, 600);
    lineIdx = -1;
  }

  // Document-level capture so re-rendered #watch-subtitle keeps working, and so
  // we intercept BEFORE the cinema swipe/pause handlers (which also listen here).
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("pointermove", onMove, true);
  document.addEventListener("pointerup", onUp, true);
  document.addEventListener("pointercancel", onUp, true);
  // Touch fallback for older WebViews.
  document.addEventListener("touchstart", onDown, { capture: true, passive: false });
  document.addEventListener("touchmove", onMove, { capture: true, passive: false });
  document.addEventListener("touchend", onUp, { capture: true, passive: false });

  // When tune mode turns on, hint the subtitle is now draggable (subtle).
  globalThis.cssosSetSubtitleTuneMode = function (on) {
    globalThis.cssosSubtitleTuneMode = !!on;
    try {
      var el = document.getElementById("watch-subtitle");
      if (el) {
        el.style.cursor = on ? "ew-resize" : "";
        el.style.touchAction = on ? "none" : "";   // let us own horizontal drag
        if (on) el.classList.add("cssos-subtune-on"); else el.classList.remove("cssos-subtune-on");
      }
    } catch (_e) {}
    if (on) {
      try { if (typeof globalThis.cssosGuidedToast === "function") globalThis.cssosGuidedToast(lc("Drag a subtitle line ◂ ▸ to align it to the vocal", "拖动字幕 ◂ ▸ 让它咬住歌声(松手保存)")); } catch (_e) {}
    }
  };
})();
