/* CSSOS_MEDIA_ERROR_TOAST 20260506 — Jing
 *
 * Surface video / audio playback hiccups instead of letting them fail
 * silently. Watches the standard HTML5 media events:
 *
 *   error   — decode / network / src-not-supported failure
 *   stalled — bytes have stopped arriving for >3s mid-stream
 *   waiting — buffer underrun (fired right before the spinner UI)
 *
 * "waiting" is the noisiest of the three — we only toast if it lasts
 * longer than 4s, so quick rebuffers don't interrupt the user.
 *
 * Single toast at a time, bottom-center, auto-dismisses.
 */
(function () {
  "use strict";

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("zh") === 0 && zh) return zh;
    return en;
  }

  var toastEl = null;
  function showToast(msg, kind) {
    if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    toastEl = document.createElement("div");
    toastEl.style.cssText =
      "position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(8px);" +
      "z-index:2147483645;padding:9px 16px;border-radius:999px;" +
      "background:rgba(8,18,16,0.92);color:#daffee;" +
      "font:600 12px/1.2 ui-monospace,monospace;letter-spacing:.04em;" +
      "border:1px solid " + (kind === "error" ? "rgba(255,90,90,0.45)" : "rgba(0,245,160,0.35)") + ";" +
      "box-shadow:0 14px 32px rgba(0,0,0,0.5);" +
      "opacity:0;transition:opacity .2s ease,transform .2s ease;pointer-events:none;" +
      "max-width:88vw;text-align:center;";
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    requestAnimationFrame(function () {
      toastEl.style.opacity = "1";
      toastEl.style.transform = "translateX(-50%) translateY(0)";
    });
    var ttl = kind === "error" ? 4000 : 2000;
    setTimeout(function () {
      if (!toastEl) return;
      toastEl.style.opacity = "0";
      toastEl.style.transform = "translateX(-50%) translateY(8px)";
      setTimeout(function () {
        if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
        toastEl = null;
      }, 260);
    }, ttl);
  }

  function explainErrorCode(code) {
    switch (code) {
      case 1: return tt("Playback aborted", "播放被中止");
      case 2: return tt("Network error — check your connection", "网络错误 — 请检查网络");
      case 3: return tt("Decode error — file may be corrupted", "解码错误 — 文件可能已损坏");
      case 4: return tt("Source not supported by this browser", "当前浏览器不支持此格式");
      default: return tt("Playback error", "播放出错");
    }
  }

  function bind(el) {
    if (!el || el.dataset.cssosErrToastBound === "1") return;
    el.dataset.cssosErrToastBound = "1";

    el.addEventListener("error", function () {
      var c = el.error && el.error.code;
      showToast(explainErrorCode(c), "error");
    }, { passive: true });

    el.addEventListener("stalled", function () {
      // stalled fires when bytes haven't arrived for ~3s. Worth a hint.
      if (el.paused || el.ended) return;
      showToast(tt("Buffering…", "缓冲中…"));
    }, { passive: true });

    var waitingTimer = 0;
    el.addEventListener("waiting", function () {
      clearTimeout(waitingTimer);
      waitingTimer = setTimeout(function () {
        if (!el.paused && !el.ended && el.readyState < 3) {
          showToast(tt("Slow connection — buffering…", "网络较慢 — 正在缓冲…"));
        }
      }, 4000);
    }, { passive: true });
    var clearWait = function () { clearTimeout(waitingTimer); };
    el.addEventListener("playing", clearWait, { passive: true });
    el.addEventListener("canplay", clearWait, { passive: true });
    el.addEventListener("pause", clearWait, { passive: true });
  }

  function init() {
    bind(document.getElementById("watch-video"));
    bind(document.getElementById("watch-audio-preview"));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(function () {
      bind(document.getElementById("watch-video"));
      bind(document.getElementById("watch-audio-preview"));
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
