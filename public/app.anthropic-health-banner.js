/* CSSOS_WAVE_111D_VISION_HEALTH 20260512 — Jing
 * "在 admin dashboard 挂一个红色横幅：⚠️ Anthropic 余额耗尽，已影响 Vision 功能".
 *
 * Polls /api/admin/anthropic/health every 60s. When lowBalance is true
 * (and the viewer is an admin), shows a fixed-top red banner with a
 * direct "Top up" link to Anthropic billing. Auto-hides on next
 * successful Vision call (reportAnthropicOk in src/index.ts clears
 * the sticky flag).
 *
 * The endpoint is unauthenticated, so we gate the *display* on the
 * viewer's email matching the cssOS admin set. Non-admins still see
 * useful per-upload toasts driven by the same server-side hint string.
 */
(function () {
  "use strict";
  if (globalThis.__cssosAnthropicBannerWired) return;
  globalThis.__cssosAnthropicBannerWired = true;

  const ADMIN_EMAILS = new Set([
    "admin@cssstudio.app",
    "jingdudc@gmail.com",
    "jing@cssstudio.app",
    "vip@cssstudio.app",
  ]);

  function viewerIsAdmin() {
    try {
      const email = String(globalThis.authState?.user?.email || "").trim().toLowerCase();
      if (!email) return false;
      if (ADMIN_EMAILS.has(email)) return true;
      if (typeof globalThis.isAdminEmailModule === "function") {
        return !!globalThis.isAdminEmailModule(email);
      }
    } catch (_) {}
    return false;
  }

  function buildBanner() {
    let el = document.getElementById("cssos-anthropic-banner");
    if (el) return el;
    el = document.createElement("div");
    el.id = "cssos-anthropic-banner";
    el.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:9999",
      "background:linear-gradient(90deg,#3a0d0d,#5a1414)",
      "color:#ffdada",
      "font:600 13px/1.4 -apple-system,system-ui,sans-serif",
      "padding:10px 16px",
      "display:none",
      "align-items:center",
      "justify-content:center",
      "gap:14px",
      "border-bottom:1px solid rgba(255,140,140,0.4)",
      "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
      "letter-spacing:.01em",
    ].join(";");
    el.innerHTML = [
      '<span style="font-size:16px;">⚠️</span>',
      '<span class="banner-msg"></span>',
      '<a class="banner-cta" href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer" ',
      '   style="color:#fff;background:rgba(255,255,255,0.18);padding:5px 11px;border-radius:6px;text-decoration:none;border:1px solid rgba(255,255,255,0.32);font-weight:700;">',
      "Top up Anthropic →",
      "</a>",
      '<button type="button" class="banner-dismiss" ',
      '   style="background:transparent;border:none;color:#ffbcbc;font-size:18px;cursor:pointer;margin-left:8px;">',
      "&times;",
      "</button>",
    ].join("");
    document.body.appendChild(el);
    el.querySelector(".banner-dismiss").addEventListener("click", () => {
      el.style.display = "none";
      // Re-show next poll if condition still true (clear dismiss on next bad state)
      try { sessionStorage.setItem("cssos.anthropic.banner.dismissed", String(Date.now())); } catch (_) {}
    });
    return el;
  }

  function recentlyDismissed() {
    try {
      const t = Number(sessionStorage.getItem("cssos.anthropic.banner.dismissed") || 0);
      // Re-show after 10 minutes even if dismissed
      return t && Date.now() - t < 10 * 60 * 1000;
    } catch (_) { return false; }
  }

  async function poll() {
    if (!viewerIsAdmin()) return;
    try {
      const r = await fetch("/api/admin/anthropic/health", { credentials: "include" });
      if (!r.ok) return;
      const j = await r.json();
      const snap = j && j.snapshot;
      if (!snap) return;
      const el = buildBanner();
      const msg = el.querySelector(".banner-msg");
      if (snap.lowBalance) {
        if (recentlyDismissed()) return;
        const since = snap.lowBalanceSince
          ? ` · since ${new Date(snap.lowBalanceSince).toLocaleTimeString()}`
          : "";
        msg.textContent =
          `Anthropic API credit balance is exhausted — Vision features (sheet OCR, image analysis) are blocked${since}.`;
        el.style.display = "flex";
        return;
      }
      if (snap.rateLimited) {
        if (recentlyDismissed()) return;
        msg.textContent =
          "Anthropic API is rate-limiting requests — Vision features may be slow.";
        el.style.background = "linear-gradient(90deg,#3a2a0d,#5a4314)";
        el.style.display = "flex";
        return;
      }
      // Healthy — hide
      el.style.display = "none";
      try { sessionStorage.removeItem("cssos.anthropic.banner.dismissed"); } catch (_) {}
    } catch (_) { /* network blip — try again next tick */ }
  }

  function start() {
    poll();
    setInterval(poll, 60 * 1000);
    // Re-poll after auth state changes (user signs in as admin)
    try {
      window.addEventListener("cssos:auth-changed", poll);
      window.addEventListener("cssos:user-signed-in", poll);
    } catch (_) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
