/* CSSOS_WAVE_220A 20260517 — Jing: floating memory HUD.
 *
 * Visible to admin only (and to anyone who explicitly enables it via
 * localStorage.setItem("cssos.memHud", "1")). Renders in the bottom-
 * left corner above the agent FAB. Single-row pill:
 *
 *   🟢 HEAP 312/1500MB · DOM 2.4k · IMG 84 · VID 2 · BLOB 6 · 3 panels
 *
 * Click → expands to a full diagnostic card with every metric the
 * probe collects, plus a "Beacon now" button to force-send.
 *
 * Implementation note: we MUST NOT load this on cold boot if user
 * isn't admin — the HUD itself shouldn't add to the leak we're
 * measuring. Cold-path bail at the top.
 */
(function () {
  if (globalThis.cssmemHud) return;
  if (!globalThis.cssmemProbe) {
    console.warn("[memory-hud] cssmemProbe not loaded yet — HUD will skip.");
    return;
  }

  // Visibility gate.
  function shouldShow() {
    try {
      if (localStorage.getItem("cssos.memHud") === "1") return true;
    } catch (_) {}
    /* CSSOS_WAVE_233 20260519 — Jing: 审核员 VIP 账号曾被判为 admin,
     * 看到了 HUD. 收紧: 只信任 isAdminEmailModule(email) 的严格邮箱
     * 白名单 (jingdudc / admin@cssstudio.app), 不再听信
     * __cssosIsAdmin 全局标志 (它可能被域名通配或 VIP role 误置). */
    try {
      var email = String(globalThis.authState?.user?.email || "").trim().toLowerCase();
      if (email && typeof globalThis.isAdminEmailModule === "function"
          && globalThis.isAdminEmailModule(email)) {
        return true;
      }
    } catch (_) {}
    return false;
  }
  if (!shouldShow()) return;

  // ─── Pill DOM ─────────────────────────────────────────────────────
  const pill = document.createElement("div");
  pill.id = "cssos-mem-hud";
  pill.style.cssText = [
    "position:fixed",
    "left:8px",
    "bottom:8px",
    "z-index:2147483646",
    "padding:4px 26px 4px 8px",  /* extra right padding for the × button */
    "background:rgba(0,0,0,0.78)",
    "color:#fff",
    "font:11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace",
    "border-radius:999px",
    "cursor:pointer",
    "user-select:none",
    "-webkit-user-select:none",
    "box-shadow:0 2px 8px rgba(0,0,0,.25)",
    "pointer-events:auto",
    "max-width:60vw",
    "white-space:nowrap",
    "overflow:hidden",
    "text-overflow:ellipsis",
  ].join(";");
  pill.title = "Tap to expand memory diagnostics (W220.A)";

  // CSSOS_WAVE_220A 20260517 — Jing: dismiss button on the pill's
  // top-right so the HUD can be closed without expanding the card.
  // stopPropagation prevents the pill's click-to-expand from firing.
  // Persists to localStorage so the choice survives reloads.
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Hide memory HUD");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = [
    "position:absolute",
    "top:-4px",
    "right:-4px",
    "width:18px",
    "height:18px",
    "border-radius:50%",
    "border:0",
    "background:rgba(255,255,255,0.92)",
    "color:#000",
    "font:bold 13px/1 system-ui",
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:0",
    "box-shadow:0 1px 3px rgba(0,0,0,.3)",
    "z-index:1",
  ].join(";");
  closeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    try { localStorage.setItem("cssos.memHud", "0"); } catch (_) {}
    pill.remove();
    card.remove();
  });
  // Text label as a child span so paint() can update text without
  // wiping the close button.
  const pillText = document.createElement("span");
  pillText.id = "cssos-mem-hud-text";
  pill.appendChild(pillText);
  pill.appendChild(closeBtn);

  // ─── Expanded card ────────────────────────────────────────────────
  const card = document.createElement("div");
  card.id = "cssos-mem-hud-card";
  card.hidden = true;
  card.style.cssText = [
    "position:fixed",
    "left:8px",
    "bottom:36px",
    "z-index:2147483646",
    "padding:10px 12px",
    "background:rgba(0,0,0,0.92)",
    "color:#fff",
    "font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace",
    "border-radius:8px",
    "min-width:280px",
    "max-width:90vw",
    "max-height:60vh",
    "overflow:auto",
    "box-shadow:0 6px 24px rgba(0,0,0,.4)",
  ].join(";");

  function emojiFor(p) { return p === "red" ? "🔴" : p === "yellow" ? "🟡" : "🟢"; }
  function fmtBytes(n) {
    if (n == null) return "?";
    if (n >= 1024) return (n / 1024).toFixed(1) + "G";
    return n + "M";
  }

  function paint(s) {
    if (!s) return;
    const heap = s.heap
      ? `${emojiFor(s.pressure)} HEAP ${s.heap.used_mb}/${s.heap.limit_mb}MB`
      : `${emojiFor(s.pressure)} DOM ${(s.dom_nodes/1000).toFixed(1)}k`;
    pillText.textContent =
      `${heap} · IMG ${s.images} · VID ${s.videos} · BLOB ${s.blob_urls} · ${s.open_panel_count} panels`;

    if (!card.hidden) {
      card.innerHTML = `
<div style="font-weight:600;font-size:12px;margin-bottom:6px;letter-spacing:.5px;">
  W220.A · MEMORY PROBE · ${s.platform.toUpperCase()}
</div>
<div>uptime: ${s.uptime_s}s ${s.crash_recovered ? "<span style='color:#f66'>· recovered from crash</span>" : ""}</div>
<div>pressure: ${emojiFor(s.pressure)} ${s.pressure}</div>
<div>heap: ${s.heap ? `${s.heap.used_mb} / ${s.heap.total_mb} / ${s.heap.limit_mb} MB (used / total / limit)` : "<span style='color:#fa0'>not exposed on Safari</span>"}</div>
<div>DOM nodes: ${s.dom_nodes.toLocaleString()}</div>
<div>&lt;img&gt;: ${s.images} · &lt;video&gt;: ${s.videos} · &lt;audio&gt;: ${s.audios}</div>
<div>blob URLs: ${s.blob_urls}</div>
<div>in-flight fetch: ${s.inflight_fetch}</div>
<div>active intervals: ${s.active_intervals}</div>
<div>module globals (cssmv/cssos*): ${s.module_globals}</div>
<div>script tags: ${s.script_tags_eager} eager · ${s.script_tags_lazy} lazy</div>
<div>open panels (${s.open_panel_count}): ${s.open_panels.join(", ") || "<em>none</em>"}</div>
<div>visibility: ${s.visibility}</div>
<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
  <button data-act="beacon" style="background:#2a7;color:#fff;border:0;border-radius:4px;padding:4px 8px;font:inherit;cursor:pointer;">Beacon now</button>
  <button data-act="gc"     style="background:#444;color:#fff;border:0;border-radius:4px;padding:4px 8px;font:inherit;cursor:pointer;">Force snapshot</button>
  <button data-act="hide"   style="background:#822;color:#fff;border:0;border-radius:4px;padding:4px 8px;font:inherit;cursor:pointer;">Hide HUD</button>
</div>
<div style="margin-top:6px;font-size:10px;opacity:.6;">
  Persist: <code>localStorage.cssos.memHud = "1"</code> to keep showing for non-admins.
</div>`;
    }
  }

  pill.addEventListener("click", function () {
    card.hidden = !card.hidden;
    paint(globalThis.cssmemProbe.snapshot());
  });

  card.addEventListener("click", function (e) {
    const act = e.target && e.target.getAttribute && e.target.getAttribute("data-act");
    if (act === "beacon") {
      globalThis.cssmemProbe.beacon("hud_manual");
      e.target.textContent = "Sent ✓";
      setTimeout(() => { e.target.textContent = "Beacon now"; }, 1500);
    } else if (act === "gc") {
      paint(globalThis.cssmemProbe.snapshot());
    } else if (act === "hide") {
      try { localStorage.setItem("cssos.memHud", "0"); } catch (_) {}
      pill.remove();
      card.remove();
    }
  });

  function mount() {
    if (!document.body) { setTimeout(mount, 100); return; }
    document.body.appendChild(pill);
    document.body.appendChild(card);
    globalThis.cssmemProbe.subscribe(paint);
    paint(globalThis.cssmemProbe.snapshot());
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  globalThis.cssmemHud = { pill, card };
})();
