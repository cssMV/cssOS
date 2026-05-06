/* CSSOS_TITLE_COPY_SHARE 20260506 — Jing
 *
 * Click the MV panel title (`.panel-title` inside `#watch-panel`) to
 * copy the share link to clipboard. Same affordance Notion / Linear
 * have for "click the page title to copy a deep link".
 *
 * The URL uses the existing share-link router contract:
 *   <origin>/?cssMV=<work_id>
 *
 * Visual: a small toast confirms the copy, and the title flashes
 * emerald briefly so the user knows their click registered.
 *
 * Skips if there's no current work (e.g. empty MV panel).
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

  function getCurrentWorkId() {
    var w = globalThis.currentWatchPreviewWork;
    if (w && (w.id || w.work_id)) return String(w.id || w.work_id).trim();
    var lr = globalThis.cssmvPipelineLastResult;
    if (lr && lr.id) return String(lr.id).trim();
    try {
      var sp = new URLSearchParams(window.location.search);
      var fromUrl = String(sp.get("cssMV") || "").trim();
      if (fromUrl) return fromUrl;
    } catch (_e) {}
    return "";
  }

  function buildShareUrl(workId) {
    var origin = window.location.origin || ("https://" + window.location.host);
    return origin + "/?cssMV=" + encodeURIComponent(workId);
  }

  function flashToast(text) {
    var t = document.createElement("div");
    t.style.cssText =
      "position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(8px);" +
      "z-index:2147483645;padding:9px 16px;border-radius:999px;" +
      "background:rgba(8,18,16,0.92);color:#daffee;" +
      "font:600 12px/1 ui-monospace,monospace;letter-spacing:.04em;" +
      "border:1px solid rgba(0,245,160,0.35);" +
      "box-shadow:0 14px 32px rgba(0,0,0,0.5);" +
      "opacity:0;transition:opacity .2s ease,transform .2s ease;pointer-events:none;";
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(function () {
      t.style.opacity = "1";
      t.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(function () {
      t.style.opacity = "0";
      t.style.transform = "translateX(-50%) translateY(8px)";
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 250);
    }, 1600);
  }

  function flashTitle(el) {
    var prevColor = el.style.color;
    var prevTransition = el.style.transition;
    el.style.transition = "color .15s ease";
    el.style.color = "#00f5a0";
    setTimeout(function () {
      el.style.color = prevColor;
      setTimeout(function () { el.style.transition = prevTransition; }, 200);
    }, 220);
  }

  async function copy(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(url); return true; } catch (_e) {}
    }
    // Fallback for older / non-secure-context browsers.
    try {
      var ta = document.createElement("textarea");
      ta.value = url;
      ta.style.cssText = "position:fixed;top:-100px;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (_e) { return false; }
  }

  function bindTitle() {
    var el = document.querySelector("#watch-panel .panel-title");
    if (!el || el.dataset.cssosCopyShareBound === "1") return;
    el.dataset.cssosCopyShareBound = "1";
    el.style.cursor = "pointer";
    el.title = tt("Click to copy share link", "点击复制分享链接");
    el.addEventListener("click", async function (e) {
      var workId = getCurrentWorkId();
      if (!workId) return; // No work — let the click pass through.
      e.preventDefault();
      e.stopPropagation();
      var url = buildShareUrl(workId);
      var ok = await copy(url);
      if (ok) {
        flashTitle(el);
        flashToast(tt("Share link copied", "分享链接已复制"));
      } else {
        flashToast(tt("Copy failed — try again", "复制失败 — 请重试"));
      }
    });
  }

  function init() { bindTitle(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  if (document.body) {
    new MutationObserver(bindTitle).observe(document.body, { childList: true, subtree: true });
  }
})();
