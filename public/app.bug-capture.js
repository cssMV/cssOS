/* CSSOS_WAVE_120C 20260513 — Jing
 * "看到 bug 或者看不顺眼的地方，马上提交给你修复".
 *
 * Floating "🐛" button (top-right, away from Dock and crash dash).
 * Tap → small modal:
 *   - Auto-fills: timestamp, current URL, last 3 visible panels, last
 *     click target from the crash-guard sentinel, viewport size, UA.
 *   - One free-text box for the user's description.
 *   - "Send" → POST /api/admin/bug-report → server appends to a
 *     dedicated buffer + writes to journalctl with kind="bug-report"
 *     so we can grep it later.
 *
 * Visible to admin emails only (same gate as the crash dashboard).
 */
(function () {
  "use strict";
  if (globalThis.__cssosBugCaptureWired) return;
  globalThis.__cssosBugCaptureWired = true;

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
      if (typeof globalThis.isAdminEmailModule === "function") return !!globalThis.isAdminEmailModule(email);
    } catch (_) {}
    return false;
  }

  function ensureBtn() {
    let b = document.getElementById("cssos-bug-fab");
    if (b) return b;
    b = document.createElement("button");
    b.id = "cssos-bug-fab";
    b.type = "button";
    b.title = "Report what you see (admin)";
    b.textContent = "🐛";
    b.style.cssText = [
      "position:fixed",
      "right:14px",
      "top:calc(env(safe-area-inset-top,0px) + 60px)",
      "z-index:9700",
      "width:42px",
      "height:42px",
      "border-radius:50%",
      "background:rgba(8,18,14,0.92)",
      "color:#fff",
      "border:1.5px solid rgba(255,200,0,0.55)",
      "font-size:20px",
      "cursor:pointer",
      "box-shadow:0 4px 14px rgba(0,0,0,0.45)",
      "display:none",
      "align-items:center",
      "justify-content:center",
      "transition:transform .12s ease",
    ].join(";");
    b.addEventListener("click", openModal);
    b.addEventListener("mouseenter", () => { b.style.transform = "scale(1.08)"; });
    b.addEventListener("mouseleave", () => { b.style.transform = ""; });
    document.body.appendChild(b);
    return b;
  }

  function snapshot() {
    const panels = Array.from(document.querySelectorAll(".panel:not([hidden])"))
      .filter((p) => p.offsetParent !== null)
      .slice(0, 5)
      .map((p) => p.id || p.className.split(" ")[0])
      .join(", ");
    return {
      ts: Date.now(),
      url: location.href,
      panels,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      ua: navigator.userAgent,
      lastClick: globalThis.__cssosLastClick || null,
    };
  }

  function openModal() {
    closeModal();
    const snap = snapshot();
    const root = document.createElement("div");
    root.id = "cssos-bug-modal";
    root.style.cssText = [
      "position:fixed", "inset:0", "z-index:9750",
      "background:rgba(0,0,0,0.55)",
      "display:flex", "align-items:flex-start", "justify-content:center",
      "padding:80px 16px 16px",
    ].join(";");
    root.innerHTML = `
      <div style="background:var(--panel-strong);color:var(--text);border:1px solid rgba(255,200,0,0.4);border-radius:14px;
                  padding:18px;width:min(440px,92vw);max-height:80vh;overflow-y:auto;
                  box-shadow:0 16px 48px rgba(0,0,0,0.6);font:14px/1.5 -apple-system,system-ui,sans-serif;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:24px;">🐛</span>
          <strong style="flex:1;letter-spacing:.04em;">REPORT WHAT YOU SEE</strong>
          <button type="button" data-bug-close style="background:transparent;border:none;color:var(--text);font-size:24px;cursor:pointer;line-height:1;padding:0 4px;">×</button>
        </div>
        <div style="font:500 11px/1.4 ui-monospace,monospace;color:rgba(218,255,238,0.55);margin-bottom:10px;
                    background:rgba(0,0,0,0.3);padding:8px 10px;border-radius:6px;word-break:break-all;">
          📍 ${snap.panels || "main"} · ${snap.viewport}<br/>
          🔗 ${snap.url.replace(/^https?:\/\/[^/]+/, "")}<br/>
          ${snap.lastClick ? `👆 ${(snap.lastClick.text || snap.lastClick.id || snap.lastClick.tag).slice(0,60)}` : ""}
        </div>
        <textarea data-bug-text rows="6" placeholder="什么不对？哪里看不顺眼？看到什么 bug？随便写、随便骂、随便吐槽。"
          style="width:100%;background:rgba(0,0,0,0.32);color:#daffee;border:1px solid rgba(255,200,0,0.3);
                 border-radius:8px;padding:10px;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
                 resize:vertical;min-height:120px;outline:none;box-sizing:border-box;"></textarea>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button type="button" data-bug-cancel style="flex:1;background:transparent;color:var(--text);
                  border:1px solid var(--border);border-radius:8px;padding:10px;cursor:pointer;font-weight:600;">取消</button>
          <button type="button" data-bug-send style="flex:2;background:rgba(255,200,0,0.18);color:#fff;
                  border:1px solid rgba(255,200,0,0.55);border-radius:8px;padding:10px;cursor:pointer;font-weight:700;">提交 →</button>
        </div>
        <div data-bug-status style="margin-top:8px;font:500 11px/1.4 ui-monospace,monospace;text-align:center;min-height:14px;"></div>
      </div>
    `;
    document.body.appendChild(root);
    const text = root.querySelector("[data-bug-text]");
    setTimeout(() => text?.focus(), 50);
    root.querySelector("[data-bug-close]").onclick = closeModal;
    root.querySelector("[data-bug-cancel]").onclick = closeModal;
    root.addEventListener("click", (e) => { if (e.target === root) closeModal(); });
    root.querySelector("[data-bug-send]").onclick = async () => {
      const status = root.querySelector("[data-bug-status]");
      const body = String(text.value || "").trim();
      if (!body) { status.textContent = "请先写点什么 🙂"; status.style.color = "#ffd56b"; return; }
      status.textContent = "发送中…"; status.style.color = "var(--text)";
      try {
        const r = await fetch("/api/admin/bug-report", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...snap, message: body, email: globalThis.authState?.user?.email || "" }),
        });
        if (r.ok) {
          status.textContent = "已提交 ✓";
          status.style.color = "#00f5a0";
          setTimeout(closeModal, 700);
        } else {
          status.textContent = `失败: HTTP ${r.status}`;
          status.style.color = "#ff8c8c";
        }
      } catch (err) {
        status.textContent = "网络错误";
        status.style.color = "#ff8c8c";
      }
    };
  }
  function closeModal() {
    const m = document.getElementById("cssos-bug-modal");
    if (m) m.remove();
  }

  // Track last click for snapshot context
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const a = t.closest("button, a, [role=button], .icon-btn, .dock-icon");
    globalThis.__cssosLastClick = {
      tag: (a || t).tagName,
      id: (a || t).id || "",
      text: ((a || t).textContent || "").trim().slice(0, 80),
    };
  }, true);

  // CSSOS_WAVE_130 20260514 — Jing: "把这个毛毛虫整合进 AI 助理".
  // Expose the report-modal opener globally so the AI Assistant panel
  // (app.agent-chat.js) can trigger it from a 🐛 button in its header.
  // The standalone bottom-right FAB is now suppressed — one entry point
  // (inside the assistant) is cleaner than two floating balls fighting
  // for the same corner.
  globalThis.cssosOpenBugReport = function () {
    if (!viewerIsAdmin()) return false;
    openModal();
    return true;
  };
  // CSSOS_WAVE_163 — alias under the name some callers historically used
  // (app.agent-overflow-menu.js was calling cssosOpenBugReportModal).
  globalThis.cssosOpenBugReportModal = globalThis.cssosOpenBugReport;
  globalThis.cssosBugReportAvailable = viewerIsAdmin;

  function start() {
    if (!viewerIsAdmin()) { setTimeout(start, 5000); return; }
    // Standalone FAB intentionally NOT shown — the 🐛 entry now lives
    // in the AI Assistant header. ensureBtn()/the old FAB code stays
    // in the file as a fallback but is never displayed.
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
