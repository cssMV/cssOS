/* CSSOS_MV_KEYS 20260506 — Jing
 *
 * YouTube-style keyboard controls for the MV player. Only active when
 * the watch panel is visible AND the user isn't typing into a field.
 *
 *   Space         play / pause
 *   J / L         seek -10s / +10s
 *   ← / →         seek -5s / +5s
 *   ↑ / ↓         volume +/- 5%
 *   0..9          jump to 0..90% of duration
 *   S             save current frame as PNG
 *
 * Gating: only active when the document is in real browser fullscreen
 * (document.fullscreenElement is non-null). This avoids stealing keys
 * from the global panel-shortcut layer (F/W/C/L/M/V/K/P/U/G/B/A/R/O/E)
 * which fires when the MV panel is merely visible. In cinema/full-
 * screen there's no ambiguity about what the user is doing.
 *
 * Skips when the active element is input/textarea/contentEditable, or
 * the keystroke has cmd/ctrl/alt — that lets browser shortcuts pass
 * through unchanged.
 */
(function () {
  "use strict";

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function getMedia() {
    var v = document.getElementById("watch-video");
    if (v && v.readyState >= 1 && isFinite(v.duration) && v.duration > 0) return v;
    var a = document.getElementById("watch-audio-preview");
    if (a && a.readyState >= 1 && isFinite(a.duration) && a.duration > 0) return a;
    return v || a || null;
  }

  function isWatchActive() {
    // Only fire keys when in real fullscreen. That's the unambiguous
    // "I'm watching the MV" state — no risk of stealing F/M/K from
    // the panel-shortcut layer.
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) return false;
    var p = document.getElementById("watch-panel");
    return !!(p && (fs === p || p.contains(fs) || fs.contains(p)));
  }

  function flashHint(text) {
    var t = document.getElementById("cssos-mv-keys-hint");
    if (!t) {
      t = document.createElement("div");
      t.id = "cssos-mv-keys-hint";
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

  function fmtTime(sec) {
    if (!isFinite(sec)) return "0:00";
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    var ss = String(s % 60).padStart(2, "0");
    return m + ":" + ss;
  }

  // W1766 — handler body unchanged; attached via the unified hub below.
  var __cssosMvKeysHandler = function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    if (!isWatchActive()) return;
    var m = getMedia();
    if (!m) return;

    var key = e.key;
    var k = key.toLowerCase();

    // Space — play/pause
    if (key === " ") {
      e.preventDefault();
      if (m.paused) { m.play().catch(function () {}); flashHint("▶"); }
      else { m.pause(); flashHint("❚❚"); }
      return;
    }
    // j / l — seek 10s
    if (k === "j" || k === "l") {
      e.preventDefault();
      var d = k === "j" ? -10 : 10;
      m.currentTime = Math.max(0, Math.min((m.duration || 0) - 0.1, (m.currentTime || 0) + d));
      flashHint((d > 0 ? "+10s · " : "-10s · ") + fmtTime(m.currentTime));
      return;
    }
    // arrow seek
    if (key === "ArrowLeft" || key === "ArrowRight") {
      e.preventDefault();
      var dx = key === "ArrowLeft" ? -5 : 5;
      m.currentTime = Math.max(0, Math.min((m.duration || 0) - 0.1, (m.currentTime || 0) + dx));
      flashHint((dx > 0 ? "+5s · " : "-5s · ") + fmtTime(m.currentTime));
      return;
    }
    // arrow volume
    if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault();
      var dv = key === "ArrowUp" ? 0.05 : -0.05;
      m.volume = Math.max(0, Math.min(1, (m.volume || 0) + dv));
      if (m.volume > 0 && m.muted) m.muted = false;
      flashHint("🔊 " + Math.round(m.volume * 100) + "%");
      return;
    }
    // m — mute
    if (k === "m") {
      e.preventDefault();
      m.muted = !m.muted;
      flashHint(m.muted ? "🔇 Muted" : "🔊 " + Math.round(m.volume * 100) + "%");
      return;
    }
    // s — snapshot current frame as PNG
    if (k === "s") {
      e.preventDefault();
      var vid = document.getElementById("watch-video");
      if (!vid || !vid.videoWidth) { flashHint("⚠ no video"); return; }
      try {
        var c = document.createElement("canvas");
        c.width = vid.videoWidth;
        c.height = vid.videoHeight;
        c.getContext("2d").drawImage(vid, 0, 0);
        c.toBlob(function (blob) {
          if (!blob) { flashHint("⚠ snapshot failed"); return; }
          var a = document.createElement("a");
          var ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          a.href = URL.createObjectURL(blob);
          a.download = "cssos-frame-" + ts + ".png";
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
          flashHint("📸 Saved");
        }, "image/png");
      } catch (err) {
        // Cross-origin video without CORS will throw on toBlob — explain it.
        flashHint("⚠ " + (err && err.name === "SecurityError" ? "CORS blocked" : "failed"));
      }
      return;
    }
    // 0..9 — jump to %
    if (key >= "0" && key <= "9") {
      e.preventDefault();
      var pct = parseInt(key, 10) / 10;
      if (isFinite(m.duration) && m.duration > 0) {
        m.currentTime = m.duration * pct;
        flashHint(Math.round(pct * 100) + "% · " + fmtTime(m.currentTime));
      }
      return;
    }
  };
  // W1766 — dispatch via unified hub at the SAME window/bubble phase; fallback
  // keeps the raw listener if the hub is absent (zero behavior change).
  if (globalThis.cssosShortcuts && globalThis.cssosShortcuts.register) {
    globalThis.cssosShortcuts.register({
      id: "player-keys", owned: true, target: "window", phase: "bubble",
      handler: __cssosMvKeysHandler, keys: "J/L/M/S/↑↓←→/0-9", source: "app.mv-keys.js",
      desc: function () { return globalThis.cssosShortcuts.lc("Media player keys (seek/mute/snapshot/volume/jump)", "播放器键 (快进/静音/截帧/音量/跳转)"); }
    });
  } else {
    window.addEventListener("keydown", __cssosMvKeysHandler, false);
  }

  globalThis.cssosMvKeys = { active: function () { return isWatchVisible(); } };
})();
