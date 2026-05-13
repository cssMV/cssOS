/* CSSOS_WAVE_120A_CRASH_DASHBOARD 20260513 — Jing
 * "把 crash-guard 的遥测做成 admin UI 横幅 + 列表"
 *
 * Polls /api/admin/crash-log/recent every 30s (admin viewers only).
 * Surfaces two layers:
 *
 *   1. A persistent floating BUTTON in the bottom-left corner showing
 *      the count of `kind = "window.error" | "unhandledrejection"`
 *      events in the last hour. Yellow at 1–4, red at 5+. Click → opens
 *      a slide-in panel with full timeline.
 *
 *   2. A SLIDE-IN PANEL (right side, 420px wide) listing all crash-log
 *      entries grouped by kind, newest first. Each entry shows: kind,
 *      timestamp, message, last-click target, UA. Tap → expand.
 *      One-tap "Clear telemetry" (best-effort; server keeps last 500).
 *
 * Visibility gated on admin email — non-admin viewers don't see the
 * floating button at all. Polling interval cheap (~1KB / 30s).
 */
(function () {
  "use strict";
  if (globalThis.__cssosCrashDashWired) return;
  globalThis.__cssosCrashDashWired = true;

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

  // ── State ─────────────────────────────────────────────────────────
  let panelOpen = false;
  let entries = []; // newest first
  const POLL_MS = 30_000;

  // ── DOM construction ─────────────────────────────────────────────
  function ensureBtn() {
    let btn = document.getElementById("cssos-crash-dash-btn");
    if (btn) return btn;
    btn = document.createElement("button");
    btn.id = "cssos-crash-dash-btn";
    btn.type = "button";
    btn.title = "Crash telemetry (admin)";
    btn.style.cssText = [
      "position:fixed",
      "left:14px",
      "bottom:calc(env(safe-area-inset-bottom,0px) + 14px)",
      "z-index:9700",
      "min-width:42px",
      "height:32px",
      "padding:0 10px",
      "border-radius:999px",
      "background:rgba(8,18,14,0.92)",
      "color:#daffee",
      "border:1px solid rgba(0,245,160,0.4)",
      "font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace",
      "letter-spacing:.04em",
      "cursor:pointer",
      "box-shadow:0 4px 14px rgba(0,0,0,0.4)",
      "display:none",
      "align-items:center",
      "justify-content:center",
      "gap:4px",
      "transition:background .15s ease,border-color .15s ease,transform .12s ease",
    ].join(";");
    btn.innerHTML = '<span style="font-size:13px;">🪲</span><span class="cnt">0</span>';
    btn.addEventListener("click", openPanel);
    btn.addEventListener("mouseenter", () => { btn.style.transform = "scale(1.05)"; });
    btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
    document.body.appendChild(btn);
    return btn;
  }

  function ensurePanel() {
    let p = document.getElementById("cssos-crash-dash-panel");
    if (p) return p;
    p = document.createElement("div");
    p.id = "cssos-crash-dash-panel";
    p.style.cssText = [
      "position:fixed",
      "top:0",
      "right:0",
      "bottom:0",
      "width:min(440px,90vw)",
      "z-index:9701",
      "background:rgba(6,12,10,0.97)",
      "color:#daffee",
      "border-left:1px solid rgba(0,245,160,0.25)",
      "box-shadow:-12px 0 32px rgba(0,0,0,0.5)",
      "display:flex",
      "flex-direction:column",
      "transform:translateX(100%)",
      "transition:transform .28s cubic-bezier(.4,0,.2,1)",
      "font:13px/1.45 -apple-system,system-ui,sans-serif",
    ].join(";");
    p.innerHTML = `
      <div style="padding:14px 16px;border-bottom:1px solid rgba(0,245,160,0.15);display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <span style="font-size:18px;">🪲</span>
        <strong style="flex:1;font-size:14px;letter-spacing:.04em;">CRASH TELEMETRY</strong>
        <button type="button" data-cd-refresh title="Refresh"
          style="background:transparent;border:1px solid rgba(0,245,160,0.35);color:#daffee;font-size:13px;padding:4px 10px;border-radius:6px;cursor:pointer;">↻</button>
        <button type="button" data-cd-close aria-label="Close"
          style="background:transparent;border:none;color:#daffee;font-size:22px;cursor:pointer;padding:0 4px;line-height:1;">×</button>
      </div>
      <div data-cd-summary style="padding:12px 16px;border-bottom:1px solid rgba(0,245,160,0.08);font:500 11.5px/1.5 ui-monospace,monospace;color:rgba(218,255,238,0.85);display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex-shrink:0;"></div>
      <div data-cd-list style="flex:1;overflow-y:auto;padding:8px 0;"></div>
      <div style="padding:10px 16px;border-top:1px solid rgba(0,245,160,0.12);font:500 11px/1.3 ui-monospace,monospace;color:rgba(218,255,238,0.5);text-align:center;flex-shrink:0;">
        Polls every 30s · server keeps last 500
      </div>
    `;
    p.querySelector("[data-cd-close]").addEventListener("click", closePanel);
    p.querySelector("[data-cd-refresh]").addEventListener("click", () => { poll(true); });
    document.body.appendChild(p);
    return p;
  }

  function openPanel() {
    panelOpen = true;
    const p = ensurePanel();
    requestAnimationFrame(() => { p.style.transform = "translateX(0)"; });
    poll(true);
  }
  function closePanel() {
    panelOpen = false;
    const p = document.getElementById("cssos-crash-dash-panel");
    if (p) p.style.transform = "translateX(100%)";
  }

  // ── Render ───────────────────────────────────────────────────────
  function relativeTime(ts) {
    const n = Date.now();
    const dt = Math.max(0, Math.round((n - ts) / 1000));
    if (dt < 60) return `${dt}s ago`;
    if (dt < 3600) return `${Math.round(dt / 60)}m ago`;
    if (dt < 86400) return `${Math.round(dt / 3600)}h ago`;
    return `${Math.round(dt / 86400)}d ago`;
  }

  function parseLine(line) {
    // Format: "[crash-guard] KIND | MSG | URL | LASTCLICK | UA"
    const stripped = String(line || "").replace(/^\[crash-guard\]\s*/, "");
    const parts = stripped.split(" | ").map((s) => s.trim());
    return {
      kind: parts[0] || "unknown",
      message: parts[1] || "",
      url: parts[2] || "",
      lastClick: parts[3] || "",
      ua: parts[4] || "",
    };
  }

  function kindColor(kind) {
    if (kind === "window.error") return "#ff8c8c";
    if (kind === "unhandledrejection") return "#ffb56b";
    if (kind === "location.reload") return "#ffd56b";
    if (kind === "location.assign") return "#ffd56b";
    if (kind === "beforeunload") return "rgba(218,255,238,0.6)";
    return "#daffee";
  }

  function renderSummary(items) {
    const oneHour = Date.now() - 3_600_000;
    const recent = items.filter((e) => e.ts >= oneHour);
    const errors = recent.filter((e) => e.parsed.kind === "window.error" || e.parsed.kind === "unhandledrejection").length;
    const reloads = recent.filter((e) => e.parsed.kind === "location.reload" || e.parsed.kind === "location.assign").length;
    const unloads = recent.filter((e) => e.parsed.kind === "beforeunload").length;
    const total = recent.length;
    const sum = document.querySelector("#cssos-crash-dash-panel [data-cd-summary]");
    if (!sum) return;
    const cell = (n, label, color) => `<div style="text-align:center;">
      <div style="color:${color};font:700 18px/1.1 -apple-system,system-ui,sans-serif;">${n}</div>
      <div style="color:rgba(218,255,238,0.55);font-size:9.5px;letter-spacing:.06em;margin-top:2px;">${label}</div>
    </div>`;
    sum.innerHTML =
      cell(errors, "ERRORS · 1h", errors > 0 ? "#ff8c8c" : "#daffee") +
      cell(reloads, "RELOADS · 1h", reloads > 0 ? "#ffd56b" : "#daffee") +
      cell(unloads, "UNLOADS · 1h", "#daffee") +
      cell(total, "TOTAL · 1h", "#daffee");
    // Update floating button badge
    const btn = document.getElementById("cssos-crash-dash-btn");
    if (btn) {
      const c = btn.querySelector(".cnt");
      const seriousNow = errors + reloads;
      if (c) c.textContent = String(seriousNow);
      btn.style.background = seriousNow >= 5 ? "rgba(80,15,15,0.95)"
        : seriousNow > 0 ? "rgba(60,45,10,0.95)" : "rgba(8,18,14,0.92)";
      btn.style.borderColor = seriousNow >= 5 ? "rgba(255,120,120,0.7)"
        : seriousNow > 0 ? "rgba(255,210,100,0.6)" : "rgba(0,245,160,0.4)";
      btn.style.color = seriousNow >= 5 ? "#ffd6d6"
        : seriousNow > 0 ? "#ffe0a0" : "#daffee";
    }
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function renderList(items) {
    const list = document.querySelector("#cssos-crash-dash-panel [data-cd-list]");
    if (!list) return;
    if (!items.length) {
      list.innerHTML = `<div style="padding:40px 16px;text-align:center;color:rgba(218,255,238,0.5);font:500 12px/1.4 ui-monospace,monospace;">
        No crash events yet — clean run.
      </div>`;
      return;
    }
    list.innerHTML = items.map((e) => {
      const p = e.parsed;
      const c = kindColor(p.kind);
      const isUA = p.ua.length > 0;
      const uaShort = isUA ? p.ua.slice(0, 60) + (p.ua.length > 60 ? "…" : "") : "";
      return `<div style="padding:10px 16px;border-bottom:1px solid rgba(0,245,160,0.06);">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
          <span style="color:${c};font:700 11.5px/1 ui-monospace,monospace;letter-spacing:.04em;">${escapeHtml(p.kind)}</span>
          <span style="color:rgba(218,255,238,0.5);font:500 10.5px/1 ui-monospace,monospace;">${relativeTime(e.ts)}</span>
        </div>
        ${p.message ? `<div style="color:#daffee;font:400 12px/1.45 ui-monospace,monospace;word-break:break-word;margin-bottom:3px;">${escapeHtml(p.message)}</div>` : ""}
        ${p.lastClick ? `<div style="color:rgba(218,255,238,0.6);font:400 10.5px/1.4 ui-monospace,monospace;word-break:break-word;margin-bottom:3px;">📍 ${escapeHtml(p.lastClick)}</div>` : ""}
        ${p.url && p.url !== "https://cssstudio.app/" ? `<div style="color:rgba(218,255,238,0.45);font:400 10px/1.3 ui-monospace,monospace;word-break:break-all;">${escapeHtml(p.url)}</div>` : ""}
        ${uaShort ? `<div style="color:rgba(218,255,238,0.35);font:400 9.5px/1.3 ui-monospace,monospace;margin-top:3px;">${escapeHtml(uaShort)}</div>` : ""}
      </div>`;
    }).join("");
  }

  // ── Polling ──────────────────────────────────────────────────────
  async function poll(force) {
    if (!viewerIsAdmin()) return;
    try {
      const r = await fetch("/api/admin/crash-log/recent", { credentials: "include" });
      if (!r.ok) return;
      const j = await r.json();
      const raw = Array.isArray(j?.entries) ? j.entries : [];
      entries = raw
        .map((e) => ({ ts: Number(e.ts || 0), line: String(e.line || ""), parsed: parseLine(e.line) }))
        .sort((a, b) => b.ts - a.ts);
      // Always show the button (badge updates with summary)
      const btn = ensureBtn();
      btn.style.display = "inline-flex";
      renderSummary(entries);
      if (panelOpen) renderList(entries);
    } catch (_) { /* network blip, ignore */ }
  }

  // ── Boot ─────────────────────────────────────────────────────────
  function start() {
    if (!viewerIsAdmin()) {
      // Re-check periodically in case user signs in later
      setTimeout(start, 5000);
      return;
    }
    ensureBtn();
    poll(true);
    setInterval(() => poll(false), POLL_MS);
    try {
      window.addEventListener("cssos:auth-changed", () => poll(true));
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
