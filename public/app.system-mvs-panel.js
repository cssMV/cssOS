/* CSSOS_WAVE_125 20260513 — Jing
 *
 * System MVs panel — replaces the standalone /admin/system-mvs.html
 * (Wave 124) with a proper Dock panel. Same data, same actions, but
 * integrated into the windowed shell so it can be opened/closed/moved
 * like any other panel.
 *
 * Admin-only at the API layer. Non-admins see a clear message.
 *
 * Exposes:
 *   - globalThis.renderSystemMvsPanelModule()  — fills the panel body
 *   - globalThis.openSystemMvsPanelModule()    — renders + openPanel()
 */
(function () {
  if (globalThis.__cssosSystemMvsPanelWired) return;
  globalThis.__cssosSystemMvsPanelWired = true;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en) : en;
  }
  function fmtCents(c) {
    var n = Number(c || 0);
    if (!n) return "—";
    return "$" + (n / 100).toFixed(2);
  }
  function fmtTime(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleTimeString(); } catch (_) { return iso; }
  }
  function pill(status) {
    var s = String(status || "").toLowerCase();
    return '<span class="sysmv-pill sysmv-pill-' + esc(s) + '">' + esc(s || "—") + '</span>';
  }
  function workLink(id) {
    if (!id) return "—";
    return '<a class="sysmv-link" href="/?cssMV=' + esc(id) + '" target="_blank" rel="noopener">'
      + esc(id.slice(0, 8)) + '…</a>';
  }

  function injectStyles() {
    if (document.getElementById("cssos-sysmv-panel-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-sysmv-panel-style";
    st.textContent = [
      "#system-mvs-panel .sysmv-wrap{padding:14px 16px 24px;display:flex;flex-direction:column;gap:14px;}",
      "#system-mvs-panel .sysmv-dateline{font:500 11.5px/1.2 ui-monospace,monospace;color:rgba(255,255,255,0.55);}",
      "#system-mvs-panel .sysmv-status{font:500 11px/1.2 ui-monospace,monospace;color:rgba(255,255,255,0.45);margin-left:auto;}",
      "#system-mvs-panel .sysmv-header-row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}",
      "#system-mvs-panel .sysmv-section-title{font:600 12px/1.2 -apple-system,system-ui,sans-serif;color:#00f5a0;letter-spacing:.05em;text-transform:uppercase;margin:6px 0 2px;}",
      "#system-mvs-panel .sysmv-budget{display:flex;gap:10px;flex-wrap:wrap;}",
      "#system-mvs-panel .sysmv-cell{flex:1;min-width:130px;background:rgba(0,245,160,0.06);border:1px solid rgba(0,245,160,0.18);padding:10px 12px;border-radius:10px;}",
      "#system-mvs-panel .sysmv-cell.warn{background:rgba(255,180,80,0.08);border-color:rgba(255,180,80,0.3);}",
      "#system-mvs-panel .sysmv-cell.crit{background:rgba(255,80,90,0.10);border-color:rgba(255,80,90,0.32);}",
      "#system-mvs-panel .sysmv-cell .lbl{font-size:10.5px;color:rgba(255,255,255,0.5);letter-spacing:.03em;text-transform:uppercase;}",
      "#system-mvs-panel .sysmv-cell .val{font:700 18px/1.1 ui-monospace,monospace;color:#fff;margin-top:4px;}",
      "#system-mvs-panel .sysmv-actions{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 4px;}",
      "#system-mvs-panel .sysmv-btn{background:#00f5a0;color:#0a0d12;border:0;padding:8px 14px;border-radius:8px;font:700 12.5px/1 -apple-system,system-ui,sans-serif;cursor:pointer;letter-spacing:.01em;}",
      "#system-mvs-panel .sysmv-btn:hover{background:#2dffb5;}",
      "#system-mvs-panel .sysmv-btn.ghost{background:transparent;border:1px solid rgba(255,255,255,0.18);color:#e6e8ee;}",
      "#system-mvs-panel .sysmv-btn.ghost:hover{border-color:#00f5a0;color:#00f5a0;}",
      "#system-mvs-panel .sysmv-btn:disabled{opacity:.5;cursor:wait;}",
      "#system-mvs-panel .sysmv-table{width:100%;border-collapse:collapse;font-size:11.5px;}",
      "#system-mvs-panel .sysmv-table th,#system-mvs-panel .sysmv-table td{text-align:left;padding:6px 8px;vertical-align:top;}",
      "#system-mvs-panel .sysmv-table thead th{color:rgba(255,255,255,0.5);font-weight:500;border-bottom:1px solid rgba(255,255,255,0.08);font-size:10.5px;letter-spacing:.03em;text-transform:uppercase;}",
      "#system-mvs-panel .sysmv-table tbody tr{border-bottom:1px solid rgba(255,255,255,0.04);}",
      "#system-mvs-panel .sysmv-pill{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10.5px;font-weight:600;letter-spacing:.02em;}",
      "#system-mvs-panel .sysmv-pill-ok{background:rgba(0,245,160,0.2);color:#5effc9;}",
      "#system-mvs-panel .sysmv-pill-failed{background:rgba(255,80,90,0.2);color:#ffb0b8;}",
      "#system-mvs-panel .sysmv-pill-skipped{background:rgba(160,160,160,0.2);color:#aaa;}",
      "#system-mvs-panel .sysmv-pill-queued{background:rgba(255,200,80,0.2);color:#ffd07a;}",
      "#system-mvs-panel .sysmv-link{color:#00f5a0;text-decoration:none;font-size:10.5px;}",
      "#system-mvs-panel .sysmv-link:hover{text-decoration:underline;}",
      "#system-mvs-panel .sysmv-err{color:#ffb0b8;font-size:10.5px;font-style:italic;max-width:300px;overflow:hidden;text-overflow:ellipsis;}",
      "#system-mvs-panel .sysmv-empty{text-align:center;padding:18px;color:rgba(255,255,255,0.35);font-style:italic;font-size:11.5px;}",
      "#system-mvs-panel .sysmv-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;}",
      "#system-mvs-panel .sysmv-gate{padding:24px 18px;text-align:center;color:rgba(255,255,255,0.65);font-size:13px;}",
      "#system-mvs-panel .sysmv-gate strong{display:block;font-size:15px;color:#fff;margin-bottom:6px;}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function renderShell(content) {
    var body = document.getElementById("system-mvs-panel-content");
    if (!body) return;
    body.innerHTML = content;
  }

  function renderGate(message) {
    renderShell(
      '<div class="sysmv-wrap"><div class="sysmv-gate">'
      + '<strong>' + esc(tr("System MV Dashboard", "系统 MV 监控")) + '</strong>'
      + esc(message)
      + '</div></div>'
    );
  }

  function renderLayout() {
    return ''
      + '<div class="sysmv-wrap">'
      + '  <div class="sysmv-header-row">'
      + '    <div class="sysmv-dateline" id="sysmv-dateline">' + esc(tr("Loading…", "加载中…")) + '</div>'
      + '    <div class="sysmv-status" id="sysmv-status"></div>'
      + '  </div>'
      + '  <div class="sysmv-section-title">' + esc(tr("Daily budget", "今日预算")) + '</div>'
      + '  <div class="sysmv-card sysmv-budget" id="sysmv-budget"></div>'
      + '  <div class="sysmv-actions cssmv-pill-bar">'
      + '    <button class="sysmv-btn" data-sysmv-act="anniversary">' + esc(tr("Run anniversary now", "立刻跑纪念")) + '</button>'
      + '    <button class="sysmv-btn" data-sysmv-act="festival">' + esc(tr("Run festival now", "立刻跑节日")) + '</button>'
      + '    <button class="sysmv-btn ghost" data-sysmv-act="backfill">' + esc(tr("Backfill media", "补媒体")) + '</button>'
      + '    <button class="sysmv-btn ghost" data-sysmv-act="seed-historical">' + esc(tr("Seed 365 days", "回溯 365 天")) + '</button>'
      + '    <button class="sysmv-btn ghost" data-sysmv-act="refresh">' + esc(tr("Refresh", "刷新")) + '</button>'
      + '  </div>'
      + '  <div class="sysmv-section-title">' + esc(tr("Today's anniversaries (W119)", "今日纪念 (W119)")) + '</div>'
      + '  <div class="sysmv-card"><table class="sysmv-table" id="sysmv-ann-table">'
      + '    <thead><tr><th>' + esc(tr("Person", "人物")) + '</th><th>' + esc(tr("Event", "事件")) + '</th><th>' + esc(tr("Status", "状态")) + '</th><th>' + esc(tr("Cost", "花费")) + '</th><th>' + esc(tr("Work", "作品")) + '</th><th>' + esc(tr("Time", "时间")) + '</th></tr></thead>'
      + '    <tbody></tbody>'
      + '  </table></div>'
      + '  <div class="sysmv-section-title">' + esc(tr("Today's festivals (W120)", "今日节日 (W120)")) + '</div>'
      + '  <div class="sysmv-card"><table class="sysmv-table" id="sysmv-fest-table">'
      + '    <thead><tr><th>' + esc(tr("Festival", "节日")) + '</th><th>' + esc(tr("Status", "状态")) + '</th><th>' + esc(tr("Cost", "花费")) + '</th><th>' + esc(tr("Work", "作品")) + '</th><th>' + esc(tr("Time", "时间")) + '</th></tr></thead>'
      + '    <tbody></tbody>'
      + '  </table></div>'
      + '</div>';
  }

  function renderBudget(b) {
    var el = document.getElementById("sysmv-budget");
    if (!el) return;
    var spent = Number(b && b.spent_cents || 0);
    var cap = Number(b && b.cap_cents || 0);
    var left = Number(b && b.remaining_cents || 0);
    var pct = cap > 0 ? Math.round(100 * spent / cap) : 0;
    var leftCls = pct >= 95 ? "crit" : pct >= 70 ? "warn" : "";
    el.innerHTML = ''
      + '<div class="sysmv-cell"><div class="lbl">' + esc(tr("Daily cap", "上限")) + '</div><div class="val">' + fmtCents(cap) + '</div></div>'
      + '<div class="sysmv-cell"><div class="lbl">' + esc(tr("Spent", "已用")) + '</div><div class="val">' + fmtCents(spent) + '</div></div>'
      + '<div class="sysmv-cell ' + leftCls + '"><div class="lbl">' + esc(tr("Remaining", "剩余")) + '</div><div class="val">' + fmtCents(left) + '</div></div>'
      + '<div class="sysmv-cell"><div class="lbl">' + esc(tr("Utilization", "使用率")) + '</div><div class="val">' + pct + '%</div></div>';
  }

  function renderTable(rows, kind) {
    var tbody = document.querySelector("#sysmv-" + (kind === "ann" ? "ann" : "fest") + "-table tbody");
    if (!tbody) return;
    if (!rows.length) {
      var span = kind === "ann" ? 6 : 5;
      tbody.innerHTML = '<tr><td colspan="' + span + '" class="sysmv-empty">'
        + esc(tr("No runs today.", "今日无记录。")) + '</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      var name = r.name_zh || r.name_en || r.person_id || r.festival_id || "—";
      var err = r.error_detail
        ? '<div class="sysmv-err" title="' + esc(r.error_detail) + '">' + esc(r.error_detail) + '</div>'
        : '';
      if (kind === "ann") {
        return '<tr>'
          + '<td>' + esc(name) + err + '</td>'
          + '<td>' + (r.event_type === "death" ? "🕯️ death" : "🎂 birth") + '</td>'
          + '<td>' + pill(r.status) + '</td>'
          + '<td>' + fmtCents(r.cost_cents) + '</td>'
          + '<td>' + workLink(r.work_id) + '</td>'
          + '<td>' + fmtTime(r.created_at) + '</td>'
          + '</tr>';
      }
      return '<tr>'
        + '<td>' + esc(name) + err + '</td>'
        + '<td>' + pill(r.status) + '</td>'
        + '<td>' + fmtCents(r.cost_cents) + '</td>'
        + '<td>' + workLink(r.work_id) + '</td>'
        + '<td>' + fmtTime(r.created_at) + '</td>'
        + '</tr>';
    }).join("");
  }

  function setStatus(text) {
    var s = document.getElementById("sysmv-status");
    if (s) s.textContent = text || "";
  }

  async function fetchAndRender() {
    setStatus(tr("loading…", "加载中…"));
    try {
      var r = await fetch("/api/admin/system-mvs/today", { credentials: "include" });
      if (r.status === 401) {
        renderGate(tr(
          "Sign in via the Login panel to view system MV runs.",
          "请先登录后再查看系统 MV 监控。"
        ));
        return;
      }
      if (r.status === 403) {
        renderGate(tr(
          "Admin only. Your account does not have access to this panel.",
          "仅管理员可见。当前账户没有权限。"
        ));
        return;
      }
      var j = await r.json();
      if (!j.ok || !j.data) {
        setStatus(tr("error: ", "错误：") + (j.error || r.status));
        return;
      }
      var dateline = document.getElementById("sysmv-dateline");
      if (dateline) dateline.textContent = tr("Run date: ", "运行日期：") + (j.data.date || "—");
      renderBudget(j.data.budget);
      renderTable(j.data.anniversaries || [], "ann");
      renderTable(j.data.festivals || [], "fest");
      setStatus(tr("updated ", "更新于 ") + new Date().toLocaleTimeString());
    } catch (err) {
      setStatus(tr("error: ", "错误：") + (err && err.message || err));
    }
  }

  async function postAction(url, label, btn) {
    btn.disabled = true;
    var orig = btn.textContent;
    btn.textContent = label + "…";
    try {
      var r = await fetch(url, { method: "POST", credentials: "include" });
      var j = await r.json();
      if (r.ok && j.ok) {
        setStatus(label + " " + tr("ok", "成功"));
        await fetchAndRender();
      } else {
        setStatus(label + " " + tr("failed: ", "失败：") + (j.error || r.status));
      }
    } catch (err) {
      setStatus(label + " " + tr("threw: ", "异常：") + (err && err.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  function wireButtons() {
    var body = document.getElementById("system-mvs-panel-content");
    if (!body) return;
    body.querySelectorAll('[data-sysmv-act]').forEach(function (btn) {
      if (btn.__wired) return;
      btn.__wired = true;
      var act = btn.getAttribute("data-sysmv-act");
      btn.addEventListener("click", function () {
        if (act === "anniversary") postAction("/api/anniversary/run-now", tr("Anniversary", "纪念"), btn);
        else if (act === "festival") postAction("/api/festivals/run-now", tr("Festival", "节日"), btn);
        else if (act === "backfill") postAction("/api/system-media/backfill-now", tr("Backfill", "补媒体"), btn);
        else if (act === "seed-historical") {
          if (confirm(tr(
            "Generate anniversary + festival MVs for the past 365 days? Idempotent — safe to re-run.",
            "为过去 365 天生成纪念 + 节日 MV？幂等，可重跑。"
          ))) {
            postAction("/api/system-mvs/seed-historical?days=365", tr("Seed historical", "回溯"), btn);
          }
        }
        else if (act === "refresh") fetchAndRender();
      });
    });
  }

  var refreshTimer = null;
  function startAutoRefresh() {
    if (refreshTimer) return;
    refreshTimer = setInterval(function () {
      var panel = document.getElementById("system-mvs-panel");
      if (!panel || panel.classList.contains("hidden") || panel.hidden) return;
      fetchAndRender();
    }, 30000);
  }

  globalThis.renderSystemMvsPanelModule = function () {
    injectStyles();
    if (!globalThis.authState || !globalThis.authState.user) {
      renderGate(tr(
        "Sign in via the Login panel to view system MV runs.",
        "请先登录后再查看系统 MV 监控。"
      ));
      return;
    }
    renderShell(renderLayout());
    wireButtons();
    fetchAndRender();
    startAutoRefresh();
  };

  globalThis.openSystemMvsPanelModule = function () {
    var panel = document.getElementById("system-mvs-panel");
    if (!panel) return;
    globalThis.renderSystemMvsPanelModule();
    try {
      if (typeof globalThis.openPanel === "function") globalThis.openPanel(panel);
      else { panel.hidden = false; panel.classList.remove("hidden", "is-hidden"); }
    } catch (_) { /* no-op */ }
  };
})();
