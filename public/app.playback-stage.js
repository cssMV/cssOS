/* CSSOS_WAVE_108B_PLAYBACK_STAGE 20260509 — Jing
 *
 * "Don't yank the user out of what they're watching."
 *
 * When a card / tab is tapped WHILE media is currently playing, the
 * action should be STAGED, not executed. The current MV finishes,
 * THEN we switch to the staged target. The user can re-stage at any
 * time before that — only the LAST staged action wins.
 *
 * Cards that opt in:
 *   cssosPlaybackStage.run(target, runner, label?)
 *
 *   target: any opaque ID (the tab id, person_id, work_id, etc.) —
 *           used to dedupe re-stages and surface a label in the UI.
 *   runner: the function that actually performs the switch
 *           (e.g., () => globalThis.openPersonMvLeaderboard())
 *   label:  human-readable name shown in the "next up" pill.
 *
 * If nothing is currently playing, runner fires immediately. If
 * media IS playing, the runner is queued, the user sees a small
 * floating "下一首：<label> · 媒体结束后切换" pill, and on the next
 * `ended` event we drain the queue.
 *
 * Detection of "is media playing":
 *   - any <video> or <audio> in the document with duration > 0,
 *     not paused, not ended.
 *   - watchQueueState.active (if available) is also checked.
 *
 * Implementation note: we attach a single global `ended` listener at
 * capture phase on the document. When ended fires, we wait one tick
 * (the watch-ui auto-advance may also be running — we let it win if
 * it tries to load the next queue item; otherwise our staged runner
 * fires).
 *
 * Loaded after app.tap-guard.js, before app.home-activity-bar.js.
 */
(function () {
  "use strict";
  if (globalThis.cssosPlaybackStage && globalThis.cssosPlaybackStage.__v >= 1) return;

  var PILL_ID = "cssos-playback-stage-pill";
  var STYLE_ID = "cssos-playback-stage-style";

  var staged = null; // { target, runner, label, stagedAt }

  function tr(en, zh) {
    try {
      var fn = globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.tr;
      if (typeof fn === "function") {
        var t = fn(en);
        if (typeof t === "string") return t;
      }
    } catch (_) {}
    var loc = globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale();
    return /^zh/i.test(String(loc || "")) && zh ? zh : en;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#" + PILL_ID + "{",
      "  position:fixed;",
      "  left:50%;",
      "  bottom:160px;",
      "  transform:translateX(-50%);",
      "  z-index:80;",
      "  display:flex;",
      "  align-items:center;",
      "  gap:8px;",
      "  padding:8px 14px 8px 12px;",
      "  border-radius:999px;",
      "  background:var(--panel-strong);",
      "  backdrop-filter: blur(18px) saturate(140%);",
      "  -webkit-backdrop-filter: blur(18px) saturate(140%);",
      "  border:1px solid rgba(0,245,160,0.45);",
      "  box-shadow:0 6px 24px rgba(0,0,0,0.4);",
      "  color:var(--text);",
      "  font:600 12.5px/1.2 -apple-system,system-ui,sans-serif;",
      "  pointer-events:auto;",
      "  cursor:default;",
      "  opacity:0;",
      "  transition: opacity 220ms ease, transform 220ms ease;",
      "}",
      "#" + PILL_ID + ".visible{ opacity:1; transform:translateX(-50%) translateY(0); }",
      "#" + PILL_ID + " .cssos-stage-icon{ font-size:14px; }",
      "#" + PILL_ID + " .cssos-stage-label{ max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }",
      "#" + PILL_ID + " .cssos-stage-cancel{",
      "  background:transparent;",
      "  border:1px solid var(--border);",
      "  color:var(--muted);",
      "  padding:3px 9px;",
      "  border-radius:999px;",
      "  font:600 11px/1.2 -apple-system,system-ui,sans-serif;",
      "  cursor:pointer;",
      "  user-select:none;",
      "}",
      "#" + PILL_ID + " .cssos-stage-cancel:hover{ border-color:rgba(255,255,255,0.6); }",
      "#" + PILL_ID + " .cssos-stage-now{",
      "  background:rgba(0,245,160,0.20);",
      "  border:1px solid rgba(0,245,160,0.55);",
      "  color:#fff;",
      "  padding:3px 10px;",
      "  border-radius:999px;",
      "  font:700 11px/1.2 -apple-system,system-ui,sans-serif;",
      "  cursor:pointer;",
      "}",
      "#" + PILL_ID + " .cssos-stage-now:hover{ background:rgba(0,245,160,0.35); }",
      "@media (prefers-reduced-motion: reduce){",
      "  #" + PILL_ID + "{ transition:none; }",
      "}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function isMediaPlaying() {
    try {
      var medias = document.querySelectorAll("video, audio");
      for (var i = 0; i < medias.length; i += 1) {
        var m = medias[i];
        if (!m) continue;
        if (m.paused) continue;
        if (m.ended) continue;
        if (!m.duration || isNaN(m.duration)) continue;
        // Treat as playing if it has data and a non-trivial duration.
        return true;
      }
    } catch (_) {}
    try {
      // Watch queue may indicate active even between media swaps.
      var ws = globalThis.watchQueueState;
      if (ws && ws.active === true) return true;
    } catch (_) {}
    return false;
  }

  function ensurePill() {
    var p = document.getElementById(PILL_ID);
    if (p) return p;
    injectStyle();
    p = document.createElement("div");
    p.id = PILL_ID;
    p.setAttribute("role", "status");
    p.setAttribute("aria-live", "polite");
    document.body.appendChild(p);
    return p;
  }

  function renderPill() {
    var p = ensurePill();
    if (!staged) {
      p.classList.remove("visible");
      // Defer DOM removal so the fade-out plays.
      setTimeout(function () {
        if (!staged && p && p.parentNode) {
          p.innerHTML = "";
        }
      }, 240);
      return;
    }
    var label = staged.label || tr("Selected card", "已选卡片");
    p.innerHTML =
      '<span class="cssos-stage-icon">⏭️</span>' +
      '<span class="cssos-stage-label">' +
        escapeHtml(tr("Up next: ", "下一首：")) + escapeHtml(label) +
      '</span>' +
      '<button type="button" class="cssos-stage-now" data-stage-act="now">' +
        escapeHtml(tr("Play now", "立即播放")) +
      '</button>' +
      '<button type="button" class="cssos-stage-cancel" data-stage-act="cancel">' +
        escapeHtml(tr("Cancel", "取消")) +
      '</button>';
    p.classList.add("visible");
    /* Wire the two actions via tap-guard to immune them from swipe. */
    var bind = (globalThis.cssosTapGuard && globalThis.cssosTapGuard.bindDelegated) ||
               (function (host, sel, fn) {
                 host.addEventListener("click", function (ev) {
                   var t = ev.target && ev.target.closest && ev.target.closest(sel);
                   if (t) fn(t, ev);
                 });
                 return function () {};
               });
    if (!p.__bound) {
      bind(p, '[data-stage-act]', function (target) {
        var act = target.getAttribute("data-stage-act");
        if (act === "now") drain(true);
        else if (act === "cancel") cancel();
      });
      p.__bound = true;
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }

  function stage(target, runner, label) {
    staged = { target: target, runner: runner, label: label || "", stagedAt: Date.now() };
    renderPill();
    try {
      document.dispatchEvent(new CustomEvent("cssos:playback-stage", {
        detail: { target: target, label: label || "" },
      }));
    } catch (_) {}
  }

  function cancel() {
    var prev = staged;
    staged = null;
    renderPill();
    if (prev) {
      try {
        document.dispatchEvent(new CustomEvent("cssos:playback-stage-cancel", {
          detail: { target: prev.target },
        }));
      } catch (_) {}
    }
  }

  function drain(force) {
    if (!staged) return;
    var s = staged;
    staged = null;
    renderPill();
    /* Defer one tick so the natural watch-queue auto-advance has a
     * chance to run first if it wants to. Force=true skips the
     * deferral (user clicked "Play now"). */
    var doRun = function () {
      try { s.runner(); } catch (err) {
        try { console.warn("[playback-stage] runner threw", err); } catch (_) {}
      }
    };
    if (force) doRun();
    else setTimeout(doRun, 50);
  }

  /* Global capture-phase ended listener. Drains staged queue. */
  document.addEventListener("ended", function () {
    if (staged) {
      // tiny delay so any auto-advance can fire its own thing first
      setTimeout(function () {
        if (staged) drain(false);
      }, 250);
    }
  }, true);

  /** Public API */
  function run(target, runner, label) {
    if (typeof runner !== "function") return;
    if (!isMediaPlaying()) {
      try { runner(); } catch (err) { try { console.warn("[playback-stage] runner threw", err); } catch (_) {} }
      return;
    }
    stage(target, runner, label);
  }

  globalThis.cssosPlaybackStage = {
    __v: 1,
    run: run,
    stage: stage,
    cancel: cancel,
    drain: drain,
    isMediaPlaying: isMediaPlaying,
    getStaged: function () { return staged ? { target: staged.target, label: staged.label } : null; },
  };
})();
