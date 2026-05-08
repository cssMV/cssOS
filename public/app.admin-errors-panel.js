/* CSSOS_WAVE82 20260508 — Jing — admin error log panel.
 * Hash route: #admin/errors
 * Mounts into <body> as a fixed overlay when hash matches; admin-only.
 *
 * Filters by source (pipeline/auth/payment/engine/http/other), shows
 * last 50 errors, supports "Mark resolved". All strings i18n via
 * loginCopy()/CSSOS_I18N.tr() (uses loginCopy already exposed by app.js).
 */
(function () {
  if (globalThis.__cssosAdminErrorsPanelInit) return;
  globalThis.__cssosAdminErrorsPanelInit = true;

  const HASH = "#admin/errors";
  const SOURCES = ["", "pipeline", "auth", "payment", "engine", "http", "other"];

  function tr(en, zh) {
    try {
      if (globalThis.CSSOS_I18N && typeof globalThis.CSSOS_I18N.tr === "function") {
        return globalThis.CSSOS_I18N.tr(en, zh);
      }
    } catch { /* fall through */ }
    if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en);
    return en;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function styleTag() {
    if (document.getElementById("cssos-admin-errors-style")) return;
    const css = `
#cssos-admin-errors-overlay{position:fixed;inset:0;z-index:9999;background:rgba(8,12,20,0.78);
  display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:32px 16px;}
#cssos-admin-errors-card{background:#101720;color:#e7eef7;border:1px solid #1f2a38;border-radius:14px;
  width:min(1040px,100%);padding:18px 20px;box-shadow:0 18px 60px rgba(0,0,0,0.45);}
#cssos-admin-errors-card .ae-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;}
#cssos-admin-errors-card .ae-title{font-size:16px;font-weight:600;}
#cssos-admin-errors-card .ae-chip{display:inline-block;padding:4px 10px;border-radius:999px;
  background:#1a2330;border:1px solid #29384a;color:#cbd6e4;font-size:12px;cursor:pointer;}
#cssos-admin-errors-card .ae-chip[data-active="1"]{background:#2c4664;border-color:#3e6b9a;color:#fff;}
#cssos-admin-errors-card table{width:100%;border-collapse:collapse;font-size:12.5px;}
#cssos-admin-errors-card th,#cssos-admin-errors-card td{
  text-align:left;padding:6px 8px;border-bottom:1px solid #1c2734;vertical-align:top;}
#cssos-admin-errors-card th{color:#9fb1c8;font-weight:500;background:#0d141d;}
#cssos-admin-errors-card .ae-msg{font-family:ui-monospace,Menlo,monospace;color:#f5d6c6;
  white-space:pre-wrap;word-break:break-word;max-width:520px;}
#cssos-admin-errors-card .ae-stack{color:#7d8a9c;white-space:pre;font-family:ui-monospace,Menlo,monospace;
  font-size:11px;max-height:90px;overflow:auto;}
#cssos-admin-errors-card .ae-resolved{color:#34d399;}
#cssos-admin-errors-card .ae-close{margin-left:auto;background:#2a1818;border:1px solid #5a2424;
  color:#f8b6b6;border-radius:8px;padding:5px 10px;cursor:pointer;}
#cssos-admin-errors-card .ae-mini{background:#1a2330;border:1px solid #29384a;color:#cbd6e4;
  border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11.5px;}
html[data-theme="light"] #cssos-admin-errors-overlay{background:rgba(228,238,224,0.85);}
html[data-theme="light"] #cssos-admin-errors-card{background:#f4f9f1;color:#143a1c;border-color:#bfd9b9;
  box-shadow:0 12px 40px rgba(20,58,28,0.18);}
html[data-theme="light"] #cssos-admin-errors-card th{color:#3a6647;background:#e6f1de;}
html[data-theme="light"] #cssos-admin-errors-card th,html[data-theme="light"] #cssos-admin-errors-card td{
  border-color:#cfe2c4;}
html[data-theme="light"] #cssos-admin-errors-card .ae-chip{background:#e6f1de;border-color:#bfd9b9;color:#2c5435;}
html[data-theme="light"] #cssos-admin-errors-card .ae-chip[data-active="1"]{background:#3e7a4d;border-color:#2c5435;color:#fff;}
html[data-theme="light"] #cssos-admin-errors-card .ae-msg{color:#7a3018;}
html[data-theme="light"] #cssos-admin-errors-card .ae-stack{color:#5b6b58;}
html[data-theme="light"] #cssos-admin-errors-card .ae-close{background:#fbe7e0;border-color:#e0a99a;color:#7a2a14;}
html[data-theme="light"] #cssos-admin-errors-card .ae-mini{background:#e6f1de;border-color:#bfd9b9;color:#2c5435;}
`;
    const tag = document.createElement("style");
    tag.id = "cssos-admin-errors-style";
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  let _activeSource = "";

  async function load() {
    const tbody = document.getElementById("cssos-admin-errors-tbody");
    const status = document.getElementById("cssos-admin-errors-status");
    if (!tbody || !status) return;
    status.textContent = tr("Loading…", "加载中…");
    try {
      const qs = _activeSource ? `?source=${encodeURIComponent(_activeSource)}&limit=50` : "?limit=50";
      const r = await fetch(`/api/admin/errors${qs}`, { credentials: "include" }).then((res) => res.json());
      if (r && r.ok === false && r.code === "FORBIDDEN") {
        tbody.innerHTML = `<tr><td colspan="6">${esc(tr("Admin only.", "仅限管理员。"))}</td></tr>`;
        status.textContent = "";
        return;
      }
      const errs = (r && r.data && r.data.errors) || [];
      if (!errs.length) {
        tbody.innerHTML = `<tr><td colspan="6">${esc(tr("No errors recorded.", "暂无错误记录。"))}</td></tr>`;
      } else {
        tbody.innerHTML = errs.map((e) => {
          const when = e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "—";
          const resolved = e.resolved_at
            ? `<span class="ae-resolved">✓ ${esc(tr("Resolved", "已解决"))}</span>`
            : `<button class="ae-mini" data-resolve-id="${esc(e.id)}">${esc(tr("Mark resolved", "标记已解决"))}</button>`;
          return `<tr>
            <td>${esc(when)}</td>
            <td>${esc(e.level || "")}</td>
            <td>${esc(e.source || "")}</td>
            <td><div class="ae-msg">${esc(e.message || "")}</div>${
              e.stack_snippet ? `<div class="ae-stack">${esc(e.stack_snippet)}</div>` : ""
            }</td>
            <td>${esc(e.request_path || "—")}</td>
            <td>${resolved}</td>
          </tr>`;
        }).join("");
      }
      status.textContent = `${tr("Updated", "已更新")} ${new Date().toLocaleTimeString()} · ${errs.length}`;
      tbody.querySelectorAll("button[data-resolve-id]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-resolve-id");
          if (!id) return;
          btn.disabled = true;
          try {
            await fetch(`/api/admin/errors/${encodeURIComponent(id)}/resolve`, {
              method: "POST", credentials: "include",
            });
            await load();
          } catch (err) {
            alert(String(err));
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      status.textContent = String(err);
    }
  }

  function open() {
    styleTag();
    if (document.getElementById("cssos-admin-errors-overlay")) {
      void load();
      return;
    }
    const overlay = document.createElement("div");
    overlay.id = "cssos-admin-errors-overlay";
    overlay.innerHTML = `
      <div id="cssos-admin-errors-card" role="dialog" aria-modal="true">
        <div class="ae-head">
          <div class="ae-title">${esc(tr("Server error log", "服务器错误日志"))}</div>
          ${SOURCES.map((s) => {
            const label = s === "" ? tr("All", "全部") : s;
            return `<span class="ae-chip" data-source="${esc(s)}">${esc(label)}</span>`;
          }).join("")}
          <button class="ae-mini" id="cssos-admin-errors-refresh" type="button">${esc(tr("Refresh", "刷新"))}</button>
          <span id="cssos-admin-errors-status" style="opacity:0.7;font-size:12px;"></span>
          <button class="ae-close" type="button" id="cssos-admin-errors-close">${esc(tr("Close", "关闭"))}</button>
        </div>
        <div style="overflow:auto;max-height:70vh;">
          <table>
            <thead><tr>
              <th>${esc(tr("When", "时间"))}</th>
              <th>${esc(tr("Level", "级别"))}</th>
              <th>${esc(tr("Source", "来源"))}</th>
              <th>${esc(tr("Message / stack", "消息 / 栈"))}</th>
              <th>${esc(tr("Path", "路径"))}</th>
              <th>${esc(tr("Action", "操作"))}</th>
            </tr></thead>
            <tbody id="cssos-admin-errors-tbody"></tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) close();
    });
    document.getElementById("cssos-admin-errors-close")?.addEventListener("click", close);
    document.getElementById("cssos-admin-errors-refresh")?.addEventListener("click", () => void load());
    overlay.querySelectorAll(".ae-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        _activeSource = chip.getAttribute("data-source") || "";
        overlay.querySelectorAll(".ae-chip").forEach((c) =>
          c.setAttribute("data-active", c.getAttribute("data-source") === _activeSource ? "1" : "0"),
        );
        void load();
      });
    });
    const initial = overlay.querySelector(`.ae-chip[data-source=""]`);
    if (initial) initial.setAttribute("data-active", "1");
    void load();
  }

  function close() {
    const el = document.getElementById("cssos-admin-errors-overlay");
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (window.location.hash === HASH) {
      try {
        history.replaceState({}, document.title, `${location.pathname}${location.search}`);
      } catch { /* ignore */ }
    }
  }

  function checkHash() {
    if (window.location.hash === HASH) open();
    else close();
  }

  window.addEventListener("hashchange", checkHash);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkHash);
  } else {
    checkHash();
  }
})();
