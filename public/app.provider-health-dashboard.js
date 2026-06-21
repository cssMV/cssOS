/* CSSOS_WAVE_139C 20260514 — Jing
 *
 * Admin-only "Provider health" modal. Fetches /api/admin/engine-usage
 * (existing endpoint that aggregates the in-memory engineUsageWindow:
 * calls in 5min / 1h / 24h, avg latency, failure rate, cost) and
 * renders one row per engine with a color-coded status pill.
 *
 *   green   — failure_rate < 10% over 24h
 *   amber   — 10–50%
 *   red     — > 50%  or 0 calls in last 5 min when the router said it
 *             was "disabled until …"
 *
 * Surface: 🩺 Provider health item in the AI assistant ⋯ overflow
 * menu (admin only). One-click refresh + auto-poll every 30 s while
 * open.
 */
(function () {
  if (globalThis.__cssosProviderHealthWired) return;
  globalThis.__cssosProviderHealthWired = true;

  function tr(en, zh) {
    return typeof globalThis.loginCopy === "function"
      ? globalThis.loginCopy(en, zh || en) : en;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function viewerIsAdmin() {
    try {
      var email = String((globalThis.authState?.user?.email) || "").toLowerCase();
      if (!email) return false;
      if (email.endsWith("@cssstudio.app")) return true;
      if (email === "jingdudc@gmail.com") return true;
      var role = String((globalThis.authState?.user?.role) || (globalThis.authState?.role) || "").toLowerCase();
      return role === "admin";
    } catch (_) { return false; }
  }

  function injectStyles() {
    if (document.getElementById("cssos-provhealth-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-provhealth-style";
    st.textContent = [
      ".cssos-provhealth-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.62);backdrop-filter:blur(4px);z-index:10700;display:flex;align-items:center;justify-content:center;padding:14px;}",
      ".cssos-provhealth-modal{max-width:560px;width:100%;background:#0f1219;border:1px solid rgba(255,255,255,0.12);border-radius:14px;color:#e6e8ee;display:flex;flex-direction:column;max-height:84vh;overflow:hidden;}",
      ".cssos-provhealth-modal .head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);}",
      ".cssos-provhealth-modal .head .title{font:700 15px/1.2 -apple-system,system-ui,sans-serif;color:#fff;flex:1;}",
      ".cssos-provhealth-modal .head .updated{font:500 11px/1 ui-monospace,monospace;color:rgba(255,255,255,0.45);}",
      ".cssos-provhealth-modal .head button{background:transparent;border:0;color:#9aa;font-size:18px;cursor:pointer;padding:4px 6px;}",
      ".cssos-provhealth-modal .head button:hover{color:#fff;}",
      ".cssos-provhealth-modal .body{padding:10px 12px;overflow-y:auto;flex:1;}",
      ".cssos-provhealth-table{width:100%;border-collapse:collapse;font-size:12px;}",
      ".cssos-provhealth-table th{font:500 10.5px/1.2 ui-monospace,monospace;color:rgba(255,255,255,0.5);letter-spacing:.04em;text-transform:uppercase;text-align:left;padding:6px 6px;border-bottom:1px solid rgba(255,255,255,0.08);}",
      ".cssos-provhealth-table td{padding:7px 6px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:top;}",
      ".cssos-provhealth-table tbody tr:hover{background:rgba(255,255,255,0.02);}",
      ".cssos-provhealth-engine{font:600 12px/1.2 -apple-system,system-ui,sans-serif;color:#fff;}",
      ".cssos-provhealth-pill{display:inline-block;padding:2px 8px;border-radius:999px;font:700 10px/1 ui-monospace,monospace;letter-spacing:.04em;text-transform:uppercase;}",
      ".cssos-provhealth-pill.ok{background:rgba(0,245,160,0.18);color:#5effc9;}",
      ".cssos-provhealth-pill.warn{background:rgba(255,200,80,0.18);color:#ffd07a;}",
      ".cssos-provhealth-pill.bad{background:rgba(255,80,90,0.20);color:#ffb0b8;}",
      ".cssos-provhealth-pill.idle{background:rgba(160,160,160,0.16);color:#9aa;}",
      ".cssos-provhealth-num{font:500 11.5px/1.2 ui-monospace,monospace;color:rgba(255,255,255,0.78);}",
      ".cssos-provhealth-cost{font:600 11.5px/1.2 ui-monospace,monospace;color:#5effc9;}",
      ".cssos-provhealth-empty{padding:28px 16px;text-align:center;color:rgba(255,255,255,0.4);font-size:12.5px;font-style:italic;}",
      ".cssos-provhealth-foot{padding:10px 16px;border-top:1px solid rgba(255,255,255,0.08);font:500 11px/1.45 -apple-system,system-ui,sans-serif;color:rgba(255,255,255,0.5);}",
      ".cssos-provhealth-actions{display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);}",
      ".cssos-provhealth-actions button{background:transparent;border:1px solid rgba(255,255,255,0.16);color:#e6e8ee;padding:6px 12px;border-radius:8px;font:600 12px/1.2 -apple-system,system-ui,sans-serif;cursor:pointer;}",
      ".cssos-provhealth-actions button:hover{border-color:rgba(0,245,160,0.5);color:#5effc9;}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function classify(failureRate, calls5min, calls24h) {
    if (calls24h === 0) return { cls: "idle", label: tr("IDLE","闲置") };
    if (failureRate > 50) return { cls: "bad", label: tr("DOWN","挂了") };
    if (failureRate > 10) return { cls: "warn", label: tr("DEGRADED","劣化") };
    return { cls: "ok", label: tr("OK","正常") };
  }

  function open() {
    if (!viewerIsAdmin()) {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(tr("Admin only.","仅管理员可见。"));
      }
      return;
    }
    injectStyles();
    var backdrop = document.createElement("div");
    backdrop.className = "cssos-provhealth-backdrop";
    backdrop.innerHTML = ''
      + '<div class="cssos-provhealth-modal">'
      + '  <div class="head">'
      + '    <div class="title">🩺 ' + esc(tr("Provider health","供应商健康状况")) + '</div>'
      + '    <div class="updated" id="cssos-provhealth-updated"></div>'
      + '    <button class="close" aria-label="Close">✕</button>'
      + '  </div>'
      + '  <div class="cssos-provhealth-actions">'
      + '    <button type="button" data-act="refresh">↻ ' + esc(tr("Refresh","刷新")) + '</button>'
      + '  </div>'
      + '  <div class="body" id="cssos-provhealth-body">'
      + '    <div class="cssos-provhealth-empty">' + esc(tr("Loading…","加载中…")) + '</div>'
      + '  </div>'
      + '  <div class="cssos-provhealth-foot">'
      + esc(tr(
          "OK < 10% failures · DEGRADED 10-50% · DOWN > 50%. Window: last 24h of in-process calls.",
          "OK 失败率 < 10% · 劣化 10-50% · 挂了 > 50%。窗口：进程内最近 24 小时调用。"
        ))
      + '  </div>'
      + '</div>';
    document.body.appendChild(backdrop);
    var close = function () {
      try { backdrop.remove(); } catch (_) {}
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    };
    backdrop.querySelector(".close").addEventListener("click", close);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
    backdrop.querySelector('[data-act="refresh"]').addEventListener("click", load);

    var pollTimer = null;
    async function load() {
      try {
        var r = await fetch("/api/admin/engine-usage", { credentials: "include" });
        if (r.status === 401 || r.status === 403) {
          backdrop.querySelector("#cssos-provhealth-body").innerHTML =
            '<div class="cssos-provhealth-empty">' + esc(tr("Admin only — sign in as admin first.","仅管理员可见 —— 请用管理员账户登录。")) + '</div>';
          return;
        }
        var j = await r.json();
        if (!r.ok || !j.ok) {
          backdrop.querySelector("#cssos-provhealth-body").innerHTML =
            '<div class="cssos-provhealth-empty">' + esc(tr("Couldn't load.","加载失败。")) + '</div>';
          return;
        }
        var engines = (j.data && j.data.engines) || j.engines || [];
        var updated = backdrop.querySelector("#cssos-provhealth-updated");
        if (updated) updated.textContent = tr("updated ","更新于 ") + new Date().toLocaleTimeString();
        if (!engines.length) {
          backdrop.querySelector("#cssos-provhealth-body").innerHTML =
            '<div class="cssos-provhealth-empty">'
            + esc(tr("No engine calls recorded yet. Trigger a creation to populate this dashboard.",
                    "暂无引擎调用记录。触发一次创作即可填充。"))
            + '</div>';
          return;
        }
        var rows = engines.map(function (e) {
          var c = classify(Number(e.failure_rate || 0), Number(e.calls_5min || 0), Number(e.calls_24h || 0));
          var cost = Number(e.total_cost_cents || 0);
          var costStr = cost ? '$' + (cost / 100).toFixed(2) : '—';
          return '<tr>'
            + '<td><div class="cssos-provhealth-engine">' + esc(e.engine || "—") + '</div></td>'
            + '<td><span class="cssos-provhealth-pill ' + c.cls + '">' + esc(c.label) + '</span></td>'
            + '<td><span class="cssos-provhealth-num">' + Number(e.calls_5min || 0) + '</span></td>'
            + '<td><span class="cssos-provhealth-num">' + Number(e.calls_1h || 0) + '</span></td>'
            + '<td><span class="cssos-provhealth-num">' + Number(e.calls_24h || 0) + '</span></td>'
            + '<td><span class="cssos-provhealth-num">' + (Number(e.failure_rate || 0).toFixed(1)) + '%</span></td>'
            + '<td><span class="cssos-provhealth-num">' + Number(e.avg_latency_ms || 0) + ' ms</span></td>'
            + '<td><span class="cssos-provhealth-cost">' + costStr + '</span></td>'
            + '</tr>';
        }).join("");
        backdrop.querySelector("#cssos-provhealth-body").innerHTML =
          '<table class="cssos-provhealth-table">'
          + '<thead><tr>'
          + '<th>' + esc(tr("Engine","引擎")) + '</th>'
          + '<th>' + esc(tr("Status","状态")) + '</th>'
          + '<th>5m</th><th>1h</th><th>24h</th>'
          + '<th>' + esc(tr("Fail %","失败率")) + '</th>'
          + '<th>' + esc(tr("Latency","延迟")) + '</th>'
          + '<th>' + esc(tr("Cost 24h","24h 成本")) + '</th>'
          + '</tr></thead>'
          + '<tbody>' + rows + '</tbody>'
          + '</table>';
      } catch (err) {
        backdrop.querySelector("#cssos-provhealth-body").innerHTML =
          '<div class="cssos-provhealth-empty">' + esc(String(err && err.message || err)) + '</div>';
      }
    }
    load();
    // CSSOS_WAVE_1000 — Jing「揪后台吸血鬼」: dashboard 关闭(backdrop 移除)或标签隐藏时停止 30s 轮询;
    // backdrop 不在 DOM 时自取消, 不在后台空跑网络。
    pollTimer = setInterval(function () {
      if (!document.body.contains(backdrop)) { try { clearInterval(pollTimer); } catch (_e) {} pollTimer = null; return; }
      if (document.hidden) return;
      load();
    }, 30000);
  }

  globalThis.cssosOpenProviderHealth = open;

  function wireMenu() {
    var menu = document.querySelector(".cssos-agent-overflow-menu");
    if (!menu) return;
    if (!viewerIsAdmin()) return;
    if (menu.querySelector('[data-act="prov-health"]')) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item";
    btn.setAttribute("data-act", "prov-health");
    btn.innerHTML = '<span class="glyph">🩺</span><span>' + esc(tr("Provider health","供应商健康")) + '</span>';
    btn.addEventListener("click", function () {
      menu.hidden = true;
      open();
    });
    menu.appendChild(btn);
  }

  function start() {
    var passes = 0;
    var tick = setInterval(function () {
      passes++;
      wireMenu();
      if (passes >= 30) clearInterval(tick);
    }, 1000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
