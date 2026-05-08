/* CSSOS_WAVE99 20260508 — Jing — admin daily OPS report panel.
 * Hash route: #admin/ops
 * Renders the latest report inline (subset of dashboard signal). i18n via
 * CSSOS_I18N.tr(). Dual theme via prefers-color-scheme + html[data-theme=light].
 */
(function () {
  if (globalThis.__cssosAdminOpsPanelInit) return;
  globalThis.__cssosAdminOpsPanelInit = true;

  const HASH = "#admin/ops";

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
    if (document.getElementById("cssos-admin-ops-style")) return;
    const css = `
#cssos-admin-ops-overlay{position:fixed;inset:0;z-index:9999;background:rgba(8,12,20,0.78);
  display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:32px 16px;}
#cssos-admin-ops-card{background:#101720;color:#e7eef7;border:1px solid #1f2a38;border-radius:14px;
  width:min(900px,100%);padding:18px 20px;box-shadow:0 18px 60px rgba(0,0,0,0.45);}
#cssos-admin-ops-card .ao-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;}
#cssos-admin-ops-card .ao-title{font-size:16px;font-weight:600;}
#cssos-admin-ops-card .ao-close{margin-left:auto;background:#2a1818;border:1px solid #5a2424;
  color:#f8b6b6;border-radius:8px;padding:5px 10px;cursor:pointer;}
#cssos-admin-ops-card .ao-mini{background:#1a2330;border:1px solid #29384a;color:#cbd6e4;
  border-radius:6px;padding:3px 10px;cursor:pointer;font-size:12px;}
#cssos-admin-ops-card .ao-kpis{display:flex;gap:8px;margin:10px 0 14px;flex-wrap:wrap;}
#cssos-admin-ops-card .ao-kpi{flex:1;min-width:120px;background:#0d141d;border:1px solid #1c2734;
  border-radius:10px;padding:10px 12px;}
#cssos-admin-ops-card .ao-kpi-label{font-size:11px;color:#9fb1c8;}
#cssos-admin-ops-card .ao-kpi-value{font-size:22px;font-weight:700;}
#cssos-admin-ops-card h3{margin:14px 0 4px;font-size:13px;color:#9fb1c8;font-weight:500;}
#cssos-admin-ops-card table{width:100%;border-collapse:collapse;font-size:12.5px;}
#cssos-admin-ops-card th,#cssos-admin-ops-card td{
  text-align:left;padding:5px 8px;border-bottom:1px solid #1c2734;vertical-align:top;}
#cssos-admin-ops-card th{color:#9fb1c8;font-weight:500;background:#0d141d;}
#cssos-admin-ops-card .ao-fail{color:#fca5a5;font-weight:600;}
#cssos-admin-ops-card .ao-msg{font-family:ui-monospace,Menlo,monospace;color:#f5d6c6;
  white-space:pre-wrap;word-break:break-word;max-width:520px;}
#cssos-admin-ops-card .ao-status{color:#9fb1c8;font-size:12px;}
html[data-theme="light"] #cssos-admin-ops-overlay{background:rgba(228,238,224,0.85);}
html[data-theme="light"] #cssos-admin-ops-card{background:#f4f9f1;color:#143a1c;border-color:#bfd9b9;
  box-shadow:0 12px 40px rgba(20,58,28,0.18);}
html[data-theme="light"] #cssos-admin-ops-card th{color:#3a6647;background:#e6f1de;}
html[data-theme="light"] #cssos-admin-ops-card th,html[data-theme="light"] #cssos-admin-ops-card td{
  border-color:#cfe2c4;}
html[data-theme="light"] #cssos-admin-ops-card .ao-kpi{background:#e6f1de;border-color:#bfd9b9;}
html[data-theme="light"] #cssos-admin-ops-card .ao-kpi-label{color:#3a6647;}
html[data-theme="light"] #cssos-admin-ops-card .ao-mini{background:#e6f1de;border-color:#bfd9b9;color:#2c5435;}
html[data-theme="light"] #cssos-admin-ops-card .ao-close{background:#fbe7e0;border-color:#e0a99a;color:#7a2a14;}
html[data-theme="light"] #cssos-admin-ops-card .ao-msg{color:#7a3018;}
html[data-theme="light"] #cssos-admin-ops-card .ao-status{color:#5b6b58;}
html[data-theme="light"] #cssos-admin-ops-card .ao-fail{color:#a82424;}
`;
    const tag = document.createElement("style");
    tag.id = "cssos-admin-ops-style";
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function fmtBytes(n) {
    if (n == null) return "—";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
    return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }

  function renderMetrics(m) {
    const probesRows = (m.health_probes || []).map((p) =>
      `<tr><td>${esc(p.probe_kind)}</td><td align="right">${p.ok}/${p.total}</td>
        <td align="right" class="${p.pass_rate < 0.95 ? "ao-fail" : ""}">${(p.pass_rate * 100).toFixed(1)}%</td></tr>`,
    ).join("") || `<tr><td colspan="3" class="ao-status">${esc(tr("No probes", "暂无探针"))}</td></tr>`;

    const errorsRows = (m.top_errors || []).map((e) =>
      `<tr><td class="ao-msg">${esc(e.message)}</td><td>${esc(e.source)}</td><td align="right">${e.count}</td></tr>`,
    ).join("") || `<tr><td colspan="3" class="ao-status">${esc(tr("No errors", "无错误"))}</td></tr>`;

    const usageRows = (m.engine_usage || []).map((u) =>
      `<tr><td>${esc(u.engine_id)}</td><td align="right">${u.calls}</td>
        <td align="right">$${(u.cost_cents / 100).toFixed(2)}</td>
        <td align="right" class="${u.failure_rate > 0.05 ? "ao-fail" : ""}">${(u.failure_rate * 100).toFixed(1)}%</td></tr>`,
    ).join("") || `<tr><td colspan="4" class="ao-status">${esc(tr("No usage", "无使用"))}</td></tr>`;

    const vitalsRows = (m.web_vitals || []).map((v) =>
      `<tr><td>${esc(v.metric)}</td><td align="right">${Number(v.p75 || 0).toFixed(2)}</td>
        <td align="right" class="ao-status">${v.samples}</td></tr>`,
    ).join("") || `<tr><td colspan="3" class="ao-status">${esc(tr("No samples", "无采样"))}</td></tr>`;

    return `
      <div class="ao-kpis">
        <div class="ao-kpi"><div class="ao-kpi-label">${esc(tr("DAU", "日活"))}</div><div class="ao-kpi-value">${m.dau || 0}</div></div>
        <div class="ao-kpi"><div class="ao-kpi-label">${esc(tr("New signups", "新注册"))}</div><div class="ao-kpi-value">${m.new_signups || 0}</div></div>
        <div class="ao-kpi"><div class="ao-kpi-label">${esc(tr("New MVs", "新建 MV"))}</div><div class="ao-kpi-value">${m.new_mvs || 0}</div></div>
      </div>
      <h3>${esc(tr("Health probes (24h)", "健康探针 24h"))}</h3>
      <table><thead><tr><th>${esc(tr("Kind", "类型"))}</th><th align="right">${esc(tr("OK / Total", "通过 / 总数"))}</th><th align="right">${esc(tr("Pass", "通过率"))}</th></tr></thead><tbody>${probesRows}</tbody></table>
      <h3>${esc(tr("Top errors", "高频错误"))}</h3>
      <table><thead><tr><th>${esc(tr("Message", "信息"))}</th><th>${esc(tr("Source", "来源"))}</th><th align="right">${esc(tr("Count", "次数"))}</th></tr></thead><tbody>${errorsRows}</tbody></table>
      <h3>${esc(tr("Engine usage", "引擎使用"))}</h3>
      <table><thead><tr><th>${esc(tr("Engine", "引擎"))}</th><th align="right">${esc(tr("Calls", "调用"))}</th><th align="right">${esc(tr("Cost", "成本"))}</th><th align="right">${esc(tr("Fail %", "失败率"))}</th></tr></thead><tbody>${usageRows}</tbody></table>
      <h3>${esc(tr("Web vitals (p75)", "Web Vitals p75"))}</h3>
      <table><thead><tr><th>${esc(tr("Metric", "指标"))}</th><th align="right">p75</th><th align="right">${esc(tr("Samples", "采样"))}</th></tr></thead><tbody>${vitalsRows}</tbody></table>
      <div class="ao-status" style="margin-top:12px;">
        ${esc(tr("DB rows ~", "数据库行数 ≈"))} ${(m.storage && m.storage.db_row_estimate || 0).toLocaleString()}
        · ${esc(tr("artifacts", "工件目录"))} ${esc(fmtBytes(m.storage && m.storage.artifact_dir_bytes))}
        · ${esc(tr("generated", "生成于"))} ${esc(m.generated_at || "")}
      </div>
    `;
  }

  async function load() {
    const body = document.getElementById("cssos-admin-ops-body");
    const status = document.getElementById("cssos-admin-ops-status");
    if (!body || !status) return;
    status.textContent = tr("Loading…", "加载中…");
    try {
      const r = await fetch("/api/admin/ops/preview", { credentials: "include" });
      if (r.status === 403) {
        body.innerHTML = `<div class="ao-status">${esc(tr("Admin only.", "仅限管理员。"))}</div>`;
        status.textContent = "";
        return;
      }
      const j = await r.json();
      if (!j || !j.ok) {
        body.innerHTML = `<div class="ao-status">${esc(tr("Failed to load.", "加载失败。"))}</div>`;
        status.textContent = "";
        return;
      }
      body.innerHTML = renderMetrics(j.metrics || {});
      status.textContent = "";
    } catch (err) {
      body.innerHTML = `<div class="ao-status">${esc(tr("Failed to load.", "加载失败。"))} ${esc(String(err && err.message || err))}</div>`;
      status.textContent = "";
    }
  }

  async function sendNow() {
    const status = document.getElementById("cssos-admin-ops-status");
    if (!status) return;
    status.textContent = tr("Sending…", "发送中…");
    try {
      const r = await fetch("/api/admin/ops/send-now", { method: "POST", credentials: "include" });
      const j = await r.json();
      if (j && j.ok) {
        status.textContent = j.skipped
          ? tr("Skipped (no email transport)", "已跳过（未配置邮件）")
          : tr("Sent: ", "已发送：") + (j.sent || 0);
      } else {
        status.textContent = tr("Send failed", "发送失败");
      }
    } catch {
      status.textContent = tr("Send failed", "发送失败");
    }
  }

  function open() {
    if (document.getElementById("cssos-admin-ops-overlay")) return;
    styleTag();
    const overlay = document.createElement("div");
    overlay.id = "cssos-admin-ops-overlay";
    overlay.innerHTML = `
      <div id="cssos-admin-ops-card" role="dialog" aria-modal="true">
        <div class="ao-head">
          <div class="ao-title">${esc(tr("Daily OPS report", "每日运维报告"))}</div>
          <button type="button" class="ao-mini" id="cssos-admin-ops-refresh">${esc(tr("Refresh", "刷新"))}</button>
          <button type="button" class="ao-mini" id="cssos-admin-ops-send">${esc(tr("Send now", "立即发送"))}</button>
          <span id="cssos-admin-ops-status" class="ao-status"></span>
          <button type="button" class="ao-close" id="cssos-admin-ops-close">${esc(tr("Close", "关闭"))}</button>
        </div>
        <div id="cssos-admin-ops-body"><div class="ao-status">${esc(tr("Loading…", "加载中…"))}</div></div>
      </div>`;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeAndClearHash();
    });
    document.body.appendChild(overlay);
    document.getElementById("cssos-admin-ops-close")?.addEventListener("click", closeAndClearHash);
    document.getElementById("cssos-admin-ops-refresh")?.addEventListener("click", load);
    document.getElementById("cssos-admin-ops-send")?.addEventListener("click", sendNow);
    load();
  }

  function close() {
    const el = document.getElementById("cssos-admin-ops-overlay");
    if (el) el.remove();
  }

  function closeAndClearHash() {
    close();
    try {
      if (location.hash === HASH) location.hash = "";
    } catch { /* ignore */ }
  }

  function syncFromHash() {
    if (location.hash === HASH) open();
    else close();
  }

  window.addEventListener("hashchange", syncFromHash);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncFromHash);
  } else {
    syncFromHash();
  }
})();
