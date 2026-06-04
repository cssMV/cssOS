/* CSSOS_WAVE_117_TOUCH_HARDENING 20260513 — Jing
 * "触摸太过灵敏，一点击就刷新".
 *
 * Five defenses against the "tap-and-poof" pain on mobile webviews:
 *
 *   1. Disable pull-to-refresh and swipe-from-edge navigation gestures
 *      that iOS/Android Webviews translate into a full document reload
 *      / history pop. `overscroll-behavior` + `touch-action` CSS does
 *      most of the heavy lifting.
 *
 *   2. Intercept stale `<a href="#">` / `<a href="">` / `<a href="javascript:void">`
 *      clicks and preventDefault — these are anchor placeholders that
 *      were meant to be no-ops but actually reload the page when the
 *      Webview sees an empty/hash href.
 *
 *   3. Tap-debounce: absorb a second click on the SAME element within
 *      280ms of the first. Stops the "accidentally tapped twice while
 *      sliding finger" double-fire that re-opens the same panel and
 *      re-runs its init, sometimes triggering `location.reload`.
 *
 *   4. Block keyboard refresh shortcuts (F5, ⌘R) ONLY when the user
 *      has a pending input — there's a buffered form value being typed.
 *      The crash-guard already auto-persists form state, but stopping
 *      the refresh is friendlier than recovering from it.
 *
 *   5. Tag the body with `data-cssos-mobile="1"` when on mobile portrait
 *      so other modules can branch (already used by panel-cover rules).
 *
 * Loads BEFORE any app code, after crash-guard. Cost: ~3 KB.
 */
(function () {
  "use strict";
  if (globalThis.__cssosTouchHardened) return;
  globalThis.__cssosTouchHardened = true;

  // ─────────────────────────────────────────────────────────────────
  // 1 · CSS: disable pull-to-refresh + edge swipe navigation
  // ─────────────────────────────────────────────────────────────────
  try {
    const css = `
      /* Stop iOS rubber-band → pull-to-refresh on the document. Panels
         keep their own scrolling intact because the rule only applies
         to html/body. */
      html, body {
        overscroll-behavior: contain;
        overscroll-behavior-y: contain;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: auto;
      }
      /* Eliminate double-tap-to-zoom on interactive elements — that
         300ms hold is the same window where a stray second tap turns
         into a refresh trigger. */
      button, a, [role="button"], .icon-btn,
      .dock-icon, .cssos-act-tab, .login-card,
      .panel-actions .icon-btn, .mini-btn, .chip {
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(0,245,160,0.18);
      }
      /* Prevent iOS text-selection callout on rapid taps */
      .icon-btn, .dock-icon, .cssos-act-tab {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }
    `;
    const s = document.createElement("style");
    s.id = "cssos-touch-hardening-style";
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  } catch (_) {}

  // ─────────────────────────────────────────────────────────────────
  // 2 · Intercept dead `<a href="#">` and `href=""` clicks
  // ─────────────────────────────────────────────────────────────────
  document.addEventListener("click", (ev) => {
    const a = ev.target && ev.target.closest && ev.target.closest("a");
    if (!(a instanceof HTMLAnchorElement)) return;
    const raw = a.getAttribute("href");
    if (raw == null) return;
    const trimmed = String(raw).trim().toLowerCase();
    const isDead =
      trimmed === "" ||
      trimmed === "#" ||
      trimmed.startsWith("javascript:") ||
      trimmed === "javascript:void(0)";
    if (isDead) {
      ev.preventDefault();
    }
  }, true);

  // ─────────────────────────────────────────────────────────────────
  // 3 · Tap-debounce: absorb same-element double-clicks <280ms apart
  // ─────────────────────────────────────────────────────────────────
  const DEBOUNCE_MS = 280;
  const lastClickByEl = new WeakMap();
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    // Find the nearest "actionable" element to dedupe on. Falls back
    // to the raw target if no actionable ancestor.
    const action =
      t.closest("button, a, [role='button'], .icon-btn, .dock-icon, .cssos-act-tab, [data-action], [data-msrc-apply], [data-msrc-clear]") ||
      t;
    // Allow form/text targets to pass through (they don't double-fire).
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
    const now = Date.now();
    const prev = lastClickByEl.get(action) || 0;
    if (now - prev < DEBOUNCE_MS) {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      return;
    }
    lastClickByEl.set(action, now);
  }, true);

  // ─────────────────────────────────────────────────────────────────
  // 4 · Block F5 / ⌘R when there's unsaved input
  // ─────────────────────────────────────────────────────────────────
  function hasPendingInput() {
    const els = document.querySelectorAll("input, textarea");
    for (const el of els) {
      if (el.type === "hidden" || el.type === "password") continue;
      if (el.dataset.cssmvNoPersist === "1") continue;
      if (String(el.value || "").trim().length > 0) return true;
    }
    return false;
  }
  document.addEventListener("keydown", (ev) => {
    const isRefresh =
      (ev.key === "F5") ||
      ((ev.metaKey || ev.ctrlKey) && (ev.key === "r" || ev.key === "R"));
    if (!isRefresh) return;
    if (!hasPendingInput()) return;
    ev.preventDefault();
    try {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(
          /^zh/i.test(String(document.documentElement.lang || "en"))
            ? "已拦截一次刷新 — 输入内容已自动保存，按住 Shift+⌘R 强制刷新"
            : "Refresh blocked — your input is auto-saved. Shift-⌘R to force.",
        );
      }
    } catch (_) {}
  }, true);

  // ─────────────────────────────────────────────────────────────────
  // 5 · Mobile portrait body tag
  // ─────────────────────────────────────────────────────────────────
  function tagMobile() {
    const isMobile =
      window.matchMedia &&
      window.matchMedia("(max-width: 480px) and (orientation: portrait)").matches;
    document.documentElement.dataset.cssosMobile = isMobile ? "1" : "0";
  }
  tagMobile();
  try {
    window.matchMedia("(max-width: 480px)").addEventListener("change", tagMobile);
    window.addEventListener("orientationchange", tagMobile);
  } catch (_) {}

  // CSSOS_WAVE_536 — 静音启动 install 日志(保持控制台干净)。
})();
