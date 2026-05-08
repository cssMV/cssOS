/* CSSOS_PERSON_MV_WAVE57 20260508 — Jing
 * Self-contained webhook settings panel. Mounts on hash "#settings/webhooks".
 * No framework — minimal vanilla DOM. Uses the same /api/webhooks
 * REST surface (session-cookie auth). Plain `fetch`; relies on the
 * page already being on the cssOS origin so credentials flow.
 *
 * Per the cssOS "use it where you change it" rule we'd normally tuck
 * features near the page that consumes them, but webhooks are
 * cross-cutting (delivery is server-side fan-out) and the natural
 * surface IS a settings page, so we ship a dedicated panel at
 * #settings/webhooks. The launcher chip into this panel can be
 * embedded inline by feature owners as they grow webhooks usage.
 */
(function () {
  if (typeof window === "undefined") return;
  const PANEL_HASH = "#settings/webhooks";
  const ROOT_ID = "cssos-webhooks-panel-root";

  const KIND_OPTIONS = [
    ["mv_created",     "MV 创建"],
    ["mv_liked",       "MV 被点赞"],
    ["mv_commented",   "MV 收到评论"],
    ["follower_added", "新增粉丝"],
  ];

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  async function jfetch(url, opts) {
    const r = await fetch(url, Object.assign({ credentials: "include" }, opts || {}));
    let data = null;
    try { data = await r.json(); } catch (_) { data = null; }
    return { status: r.status, ok: r.ok, data };
  }

  function ensureRoot() {
    let el = document.getElementById(ROOT_ID);
    if (el) return el;
    el = document.createElement("div");
    el.id = ROOT_ID;
    el.style.cssText = [
      "position:fixed", "inset:0", "background:rgba(0,0,0,0.78)",
      "color:#e9fff5", "z-index:9999", "overflow:auto",
      "font-family:-apple-system,system-ui,sans-serif",
      "display:none", "padding:24px",
    ].join(";");
    el.addEventListener("click", (ev) => {
      if (ev.target === el) closePanel();
    });
    document.body.appendChild(el);
    return el;
  }

  function closePanel() {
    const el = document.getElementById(ROOT_ID);
    if (el) el.style.display = "none";
    if (location.hash === PANEL_HASH) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  async function render() {
    const root = ensureRoot();
    root.style.display = "block";
    root.innerHTML = `<div style="max-width:780px;margin:0 auto;background:#0c1410;border:1px solid #1f2c25;
      border-radius:12px;padding:20px 22px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="margin:0;font-size:18px">Webhooks</h2>
        <button id="cssos-wh-close" style="background:transparent;color:#9af0c0;border:1px solid #2a3b32;padding:4px 12px;border-radius:6px;cursor:pointer">关闭</button>
      </div>
      <p style="margin:0 0 14px;color:#9eb8a8;font-size:13px">
        注册一个 HTTPS 端点,我们会在事件发生时 POST 一个 JSON 负载到该地址。
        每次投递都会带上 <code>X-CssOS-Signature: sha256=&lt;hex&gt;</code> 头,
        请使用对应的 secret 做 HMAC-SHA256 校验(secret 仅在创建时返回一次)。
      </p>
      <div id="cssos-wh-list" style="margin-bottom:18px">加载中...</div>
      <div style="border-top:1px solid #1f2c25;padding-top:14px">
        <h3 style="margin:0 0 10px;font-size:14px">新增 webhook</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="cssos-wh-url" placeholder="https://example.com/hook" style="flex:1;min-width:260px;padding:6px 10px;border-radius:6px;border:1px solid #2a3b32;background:#06100c;color:#e9fff5"/>
        </div>
        <div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap">
          ${KIND_OPTIONS.map(([k, label]) =>
            `<label style="font-size:12px;color:#cfeede"><input type="checkbox" class="cssos-wh-kind" value="${esc(k)}" checked /> ${esc(label)}</label>`
          ).join("")}
        </div>
        <button id="cssos-wh-create" style="background:#00f5a0;color:#062a1c;border:0;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:600">创建</button>
        <div id="cssos-wh-create-msg" style="margin-top:8px;font-size:12px;color:#ffd27a"></div>
      </div>
    </div>`;
    document.getElementById("cssos-wh-close").addEventListener("click", closePanel);
    document.getElementById("cssos-wh-create").addEventListener("click", onCreate);
    await refreshList();
  }

  async function refreshList() {
    const host = document.getElementById("cssos-wh-list");
    if (!host) return;
    host.textContent = "加载中...";
    const { ok, status, data } = await jfetch("/api/webhooks");
    if (status === 401) { host.innerHTML = `<div style="color:#ffb0b0">需要登录后才能管理 webhooks。</div>`; return; }
    if (!ok || !data?.ok) { host.innerHTML = `<div style="color:#ffb0b0">加载失败。</div>`; return; }
    const rows = data.webhooks || [];
    if (!rows.length) {
      host.innerHTML = `<div style="color:#9eb8a8;font-size:13px">还没有任何 webhook。在下面新增一个吧。</div>`;
      return;
    }
    host.innerHTML = rows.map((w) => `
      <div data-id="${esc(w.webhook_id)}" style="border:1px solid #1f2c25;border-radius:8px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
          <div style="font-size:13px;word-break:break-all">
            <strong style="color:#cfeede">${esc(w.url)}</strong>
            ${w.enabled ? "" : `<span style="color:#ff8c8c;margin-left:6px">(已禁用)</span>`}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="cssos-wh-test" style="background:transparent;color:#9af0c0;border:1px solid #2a3b32;padding:3px 10px;border-radius:6px;cursor:pointer;font-size:12px">测试</button>
            <button class="cssos-wh-log" style="background:transparent;color:#9af0c0;border:1px solid #2a3b32;padding:3px 10px;border-radius:6px;cursor:pointer;font-size:12px">日志</button>
            <button class="cssos-wh-del" style="background:transparent;color:#ffa0a0;border:1px solid #4a2a2a;padding:3px 10px;border-radius:6px;cursor:pointer;font-size:12px">删除</button>
          </div>
        </div>
        <div style="font-size:12px;color:#9eb8a8;margin-top:6px">
          事件: ${(w.event_kinds || []).map(esc).join(", ") || "(无)"}<br/>
          Secret: <code>${esc(w.secret_masked)}</code>
          · 失败计数: ${w.failure_count}
          ${w.last_status_code != null ? `· 最近状态: ${w.last_status_code}` : ""}
        </div>
        <div class="cssos-wh-log-host" style="margin-top:8px"></div>
      </div>
    `).join("");

    host.querySelectorAll(".cssos-wh-test").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        const card = ev.currentTarget.closest("[data-id]");
        const id = card.getAttribute("data-id");
        ev.currentTarget.disabled = true;
        const { data } = await jfetch(`/api/webhooks/${encodeURIComponent(id)}/test`, { method: "POST" });
        ev.currentTarget.disabled = false;
        const msg = data?.ok
          ? `测试已发送 — HTTP ${data.status} · ${data.duration_ms}ms`
          : `测试失败: ${data?.code || "未知"}`;
        alert(msg);
      });
    });
    host.querySelectorAll(".cssos-wh-del").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        const card = ev.currentTarget.closest("[data-id]");
        const id = card.getAttribute("data-id");
        if (!confirm("确认删除此 webhook?")) return;
        await jfetch(`/api/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });
        await refreshList();
      });
    });
    host.querySelectorAll(".cssos-wh-log").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        const card = ev.currentTarget.closest("[data-id]");
        const id = card.getAttribute("data-id");
        const logHost = card.querySelector(".cssos-wh-log-host");
        if (!logHost) return;
        if (logHost.dataset.open === "1") { logHost.innerHTML = ""; logHost.dataset.open = ""; return; }
        logHost.textContent = "加载中...";
        logHost.dataset.open = "1";
        const { data } = await jfetch(`/api/webhooks/${encodeURIComponent(id)}/deliveries?limit=20`);
        const items = data?.deliveries || [];
        if (!items.length) { logHost.innerHTML = `<div style="font-size:12px;color:#9eb8a8">暂无投递记录。</div>`; return; }
        logHost.innerHTML = `<table style="width:100%;font-size:11px;color:#cfeede;border-collapse:collapse">
          <thead><tr style="opacity:.7"><th style="text-align:left">时间</th><th style="text-align:left">事件</th><th>尝试</th><th>状态</th><th>耗时</th></tr></thead>
          <tbody>${items.map((d) => `<tr>
            <td>${esc(new Date(d.delivered_at).toLocaleString())}</td>
            <td>${esc(d.event_kind)}</td>
            <td style="text-align:center">${esc(d.attempt)}</td>
            <td style="text-align:center">${d.status_code == null ? "—" : esc(d.status_code)}</td>
            <td style="text-align:center">${d.duration_ms == null ? "—" : esc(d.duration_ms) + "ms"}</td>
          </tr>`).join("")}</tbody></table>`;
      });
    });
  }

  async function onCreate() {
    const urlInput = document.getElementById("cssos-wh-url");
    const msg = document.getElementById("cssos-wh-create-msg");
    const kinds = Array.from(document.querySelectorAll(".cssos-wh-kind"))
      .filter((c) => c.checked).map((c) => c.value);
    const url = (urlInput.value || "").trim();
    if (!url || !/^https:\/\//i.test(url)) { msg.textContent = "需要 https URL。"; return; }
    if (!kinds.length) { msg.textContent = "请至少勾选一种事件。"; return; }
    msg.textContent = "创建中...";
    const { data } = await jfetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, event_kinds: kinds }),
    });
    if (!data?.ok) { msg.textContent = "创建失败: " + (data?.code || data?.message || "未知"); return; }
    msg.innerHTML = `创建成功!请保存 secret(仅显示一次):<br/><code style="user-select:all">${esc(data.webhook.secret)}</code>`;
    urlInput.value = "";
    await refreshList();
  }

  function maybeOpen() {
    if (location.hash === PANEL_HASH) {
      render().catch(() => {});
    }
  }
  window.addEventListener("hashchange", maybeOpen);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybeOpen);
  } else {
    maybeOpen();
  }
  // Expose programmatic open for other panels to chip into.
  window.openCssosWebhooksPanel = function () {
    location.hash = PANEL_HASH;
    maybeOpen();
  };
})();
