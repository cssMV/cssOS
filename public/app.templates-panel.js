/* CSSOS_PERSON_MV_WAVE28 20260508 — Jing
 * Creation template market — a self-mounting panel that:
 *   1. lists public templates as cards (name + desc + creator + counts),
 *   2. lets users 「✨ 用此模板」 → loads seed into MV PIPELINE,
 *   3. renders 「💾 存为模板」 in MV PIPELINE → save current seed.
 *
 * Templates link from creator profile pages (/u/:handle): if a
 * `data-cssos-user-id` is present on document.body or
 * globalThis.cssosProfileUserId is set, we render an inline
 * "Templates by this creator" rail.
 *
 * Seed gathering for "save as template" reads, in order:
 *   globalThis.cssosCurrentMvSeed (preferred — set by mv-pipeline-panel)
 *   localStorage["cssos.mv.lastSeed"] (fallback)
 *   user-pasted JSON in the dialog (fallback) */
(function () {
  "use strict";
  if (window.__cssosTemplatesMounted) return;
  window.__cssosTemplatesMounted = true;

  const ZH = /^zh/i.test(String(globalThis.currentLocale || navigator.language || "en"));
  const T = (en, zh) => (ZH ? zh : en);

  // ─── styles ──────────────────────────────────────────────────────────
  const css = `
    .cssos-tpl-panel { padding:16px; max-width:1100px; margin:0 auto; }
    .cssos-tpl-toolbar { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
    .cssos-tpl-toolbar button { padding:6px 12px; border:1px solid #444; background:#1a1a1a; color:#eee; border-radius:6px; cursor:pointer; }
    .cssos-tpl-toolbar button.active { background:#2a4a8a; border-color:#5a7acc; }
    .cssos-tpl-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:12px; }
    .cssos-tpl-card { background:#161616; border:1px solid #2a2a2a; border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:8px; }
    .cssos-tpl-card h4 { margin:0; font-size:15px; color:#fff; }
    .cssos-tpl-card .desc { font-size:13px; color:#aaa; line-height:1.4; flex:1; min-height:32px; }
    .cssos-tpl-card .meta { font-size:12px; color:#888; display:flex; justify-content:space-between; gap:6px; }
    .cssos-tpl-card .actions { display:flex; gap:6px; flex-wrap:wrap; }
    .cssos-tpl-card button { padding:5px 10px; border:1px solid #444; background:#222; color:#eee; border-radius:5px; cursor:pointer; font-size:12px; }
    .cssos-tpl-card button.primary { background:#2a6a3a; border-color:#4a8a5a; }
    .cssos-tpl-card button.danger  { background:#6a2a2a; border-color:#8a4a4a; }
    .cssos-tpl-empty { padding:32px; text-align:center; color:#888; }
    .cssos-tpl-dialog { position:fixed; inset:0; background:rgba(0,0,0,.7); display:flex; align-items:center; justify-content:center; z-index:9999; }
    .cssos-tpl-dialog .box { background:#181818; border:1px solid #333; border-radius:10px; padding:20px; width:min(520px, 92vw); display:flex; flex-direction:column; gap:10px; }
    .cssos-tpl-dialog input, .cssos-tpl-dialog textarea { background:#0e0e0e; border:1px solid #333; color:#eee; border-radius:6px; padding:8px; font-family:inherit; }
    .cssos-tpl-dialog textarea { min-height:80px; resize:vertical; }
    .cssos-tpl-dialog .row { display:flex; gap:8px; justify-content:flex-end; }
    .cssos-tpl-dialog button { padding:6px 14px; border:1px solid #444; background:#222; color:#eee; border-radius:6px; cursor:pointer; }
    .cssos-tpl-dialog button.primary { background:#2a6a3a; border-color:#4a8a5a; }
    .cssos-tpl-creator-rail { margin:16px 0; padding:12px; background:#121212; border:1px solid #222; border-radius:8px; }
    .cssos-tpl-creator-rail h4 { margin:0 0 8px; font-size:14px; color:#ccc; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ─── helpers ─────────────────────────────────────────────────────────
  function api(path, opts) {
    return fetch(path, Object.assign({ credentials: "include", headers: { Accept: "application/json" } }, opts || {}))
      .then((r) => r.json().catch(() => null));
  }

  function gatherCurrentSeed() {
    try {
      if (globalThis.cssosCurrentMvSeed && typeof globalThis.cssosCurrentMvSeed === "object") {
        return globalThis.cssosCurrentMvSeed;
      }
      const fn = globalThis.cssosGetCurrentMvSeed;
      if (typeof fn === "function") {
        const s = fn();
        if (s && typeof s === "object") return s;
      }
      const ls = localStorage.getItem("cssos.mv.lastSeed");
      if (ls) return JSON.parse(ls);
    } catch {}
    return null;
  }

  function applySeedToPipeline(seed) {
    try {
      globalThis.cssosCurrentMvSeed = seed;
      const fn = globalThis.cssosLoadMvSeed;
      if (typeof fn === "function") { fn(seed); return true; }
      // Fallback: dispatch event the pipeline panel can subscribe to.
      window.dispatchEvent(new CustomEvent("cssos:mv-load-seed", { detail: seed }));
      return true;
    } catch {
      return false;
    }
  }

  // ─── card rendering ──────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function renderCard(tpl, opts) {
    const owned = !!(opts && opts.owned);
    const creator = tpl.username
      ? `<a href="/u/${encodeURIComponent(tpl.username)}" style="color:#7ab">@${escapeHtml(tpl.username)}</a>`
      : escapeHtml(tpl.display_name || T("anonymous", "匿名"));
    // CSSOS_PERSON_MV_WAVE73 — green chip = parameter slot, yellow = default.
    const params = Array.isArray(tpl.parameters) ? tpl.parameters : [];
    const chips = params.length
      ? `<div class="cssos-tpl-chips" style="display:flex;flex-wrap:wrap;gap:4px;">` +
        params.map((p) => {
          const filled = p.default != null && p.default !== "";
          const bg = filled ? "#5a4a1a" : "#1a4a2a";
          const bd = filled ? "#aa8c2a" : "#3a8a4a";
          const label = ZH ? (p.label_zh || p.key) : (p.label_en || p.key);
          return `<span style="font-size:11px;background:${bg};border:1px solid ${bd};color:#fff;padding:2px 6px;border-radius:4px;">{{${escapeHtml(p.key)}}}<span style="opacity:.7;"> · ${escapeHtml(label)}</span></span>`;
        }).join("") + `</div>`
      : "";
    return `
      <div class="cssos-tpl-card" data-tpl-id="${escapeHtml(tpl.template_id)}">
        <h4>${escapeHtml(tpl.name)}</h4>
        <div class="desc">${escapeHtml(tpl.description || "")}</div>
        ${chips}
        <div class="meta">
          <span>${creator}</span>
          <span>🔁 ${tpl.fork_count || 0} · 📈 ${tpl.use_count || 0}</span>
        </div>
        <div class="actions">
          <button class="primary" data-act="use">${T("✨ Use this template", "✨ 用此模板")}</button>
          <button data-act="fork">${T("🔱 Fork", "🔱 分叉")}</button>
          ${owned ? `<button class="danger" data-act="delete">${T("🗑 Delete", "🗑 删除")}</button>` : ""}
        </div>
      </div>`;
  }

  async function loadList(sort, container) {
    container.innerHTML = (globalThis.cssosSkeletonListMarkup
      ? globalThis.cssosSkeletonListMarkup(6, T("Loading…", "加载中…"), "card")
      : `<div class="cssos-tpl-empty">${T("Loading…", "加载中…")}</div>`);
    const j = await api(`/api/person-mv/templates?sort=${encodeURIComponent(sort)}&limit=40`);
    if (!j || !j.ok) {
      container.innerHTML = `<div class="cssos-tpl-empty">${T("Could not load templates.", "模板加载失败。")}</div>`;
      return;
    }
    const list = j.templates || [];
    if (!list.length) {
      container.innerHTML = `<div class="cssos-tpl-empty">${T("No templates yet — be the first to publish one.", "暂无模板 — 第一个发布吧。")}</div>`;
      return;
    }
    container.innerHTML = list.map((t) => renderCard(t, { owned: sort === "my" })).join("");
    container.querySelectorAll(".cssos-tpl-card").forEach((card) => {
      card.addEventListener("click", async (ev) => {
        const btn = ev.target && ev.target.closest("button");
        if (!btn) return;
        const id = card.getAttribute("data-tpl-id");
        const act = btn.getAttribute("data-act");
        if (act === "use") {
          const detail = await api(`/api/person-mv/templates/${encodeURIComponent(id)}`);
          if (!detail || !detail.ok) { alert(T("Template not available.", "模板不可用。")); return; }
          // CSSOS_PERSON_MV_WAVE73 — parameterized templates: prompt the
          // user, then call /instantiate to substitute {{key}} into the seed.
          const paramDefs = Array.isArray(detail.template.parameters) ? detail.template.parameters : [];
          let seedToLoad = detail.template.seed;
          if (paramDefs.length) {
            const values = await openParamsDialog(paramDefs);
            if (!values) return;
            const inst = await api(`/api/person-mv/templates/${encodeURIComponent(id)}/instantiate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ values }),
            });
            if (!inst || !inst.ok) { alert(T("Could not resolve template.", "模板解析失败。")); return; }
            seedToLoad = inst.seed;
          }
          if (applySeedToPipeline(seedToLoad)) {
            await api(`/api/person-mv/templates/${encodeURIComponent(id)}/use`, { method: "POST" });
            alert(T("Loaded into MV PIPELINE.", "已载入 MV 创作流。"));
          }
        } else if (act === "fork") {
          const r = await api(`/api/person-mv/templates/${encodeURIComponent(id)}/fork`, { method: "POST" });
          if (r && r.ok) {
            alert(T("Forked into your private templates.", "已分叉到你的私有模板。"));
          } else if (r && r.code === "AUTH_REQUIRED") {
            alert(T("Sign in to fork.", "请登录以分叉。"));
          } else {
            alert(T("Fork failed.", "分叉失败。"));
          }
        } else if (act === "delete") {
          if (!confirm(T("Delete this template?", "删除该模板?"))) return;
          const r = await api(`/api/person-mv/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
          if (r && r.ok) card.remove();
        }
      });
    });
  }

  // ─── panel mount ─────────────────────────────────────────────────────
  function ensurePanel() {
    let panel = document.getElementById("templates");
    if (panel && panel.__cssosBuilt) return panel;
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "templates";
      panel.className = "cssos-tpl-panel panel hidden";
      const host = document.querySelector("main") || document.body;
      host.appendChild(panel);
    }
    panel.__cssosBuilt = true;
    let sort = "hot";
    panel.innerHTML = `
      <h2 style="margin:0 0 12px;">${T("Creation Template Market", "创作模板市场")}</h2>
      <div class="cssos-tpl-toolbar">
        <button data-sort="hot" class="active">${T("🔥 Hot", "🔥 热门")}</button>
        <button data-sort="new">${T("🆕 New", "🆕 最新")}</button>
        <button data-sort="my">${T("📁 My templates", "📁 我的模板")}</button>
      </div>
      <div class="cssos-tpl-grid"></div>`;
    const grid = panel.querySelector(".cssos-tpl-grid");
    panel.querySelectorAll(".cssos-tpl-toolbar button").forEach((b) => {
      b.addEventListener("click", () => {
        sort = b.getAttribute("data-sort");
        panel.querySelectorAll(".cssos-tpl-toolbar button").forEach((x) => x.classList.toggle("active", x === b));
        loadList(sort, grid);
      });
    });
    loadList(sort, grid);
    return panel;
  }

  // ─── CSSOS_PERSON_MV_WAVE73 — parameter dialogs ─────────────────────
  function openParamsDialog(paramDefs) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "cssos-tpl-dialog";
      const rows = paramDefs.map((p) => {
        const label = ZH ? (p.label_zh || p.key) : (p.label_en || p.key);
        const def = p.default == null ? "" : escapeHtml(String(p.default));
        if (p.type === "select" && Array.isArray(p.options)) {
          const opts = p.options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
          return `<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#bbb;">${escapeHtml(label)} <span style="color:#888;">{{${escapeHtml(p.key)}}}</span>
            <select data-pkey="${escapeHtml(p.key)}">${opts}</select></label>`;
        }
        const inputType = p.type === "number" ? "number" : "text";
        return `<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#bbb;">${escapeHtml(label)} <span style="color:#888;">{{${escapeHtml(p.key)}}}</span>
          <input type="${inputType}" data-pkey="${escapeHtml(p.key)}" value="${def}" /></label>`;
      }).join("");
      overlay.innerHTML = `
        <div class="box">
          <h3 style="margin:0;">${T("Fill template parameters", "填写模板参数")}</h3>
          ${rows}
          <div class="row">
            <button data-act="cancel">${T("Cancel", "取消")}</button>
            <button class="primary" data-act="ok">${T("Continue", "继续")}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (ev) => {
        const btn = ev.target && ev.target.closest("button");
        if (!btn) { if (ev.target === overlay) { overlay.remove(); resolve(null); } return; }
        const act = btn.getAttribute("data-act");
        if (act === "cancel") { overlay.remove(); resolve(null); return; }
        if (act === "ok") {
          const values = {};
          overlay.querySelectorAll("[data-pkey]").forEach((el) => {
            values[el.getAttribute("data-pkey")] = el.value;
          });
          overlay.remove();
          resolve(values);
        }
      });
    });
  }

  // ─── save dialog ─────────────────────────────────────────────────────
  function openSaveDialog() {
    const seed = gatherCurrentSeed();
    const overlay = document.createElement("div");
    overlay.className = "cssos-tpl-dialog";
    // CSSOS_PERSON_MV_WAVE73 — parameter editor inline.
    const params = [];
    function paramRowHtml(p, idx) {
      return `<div data-pidx="${idx}" style="display:grid;grid-template-columns:1fr 1fr 80px 80px auto;gap:4px;align-items:center;font-size:12px;">
        <input data-pf="key" placeholder="key" value="${escapeHtml(p.key || "")}" />
        <input data-pf="label_en" placeholder="${T("Label (EN)", "英文标签")}" value="${escapeHtml(p.label_en || "")}" />
        <select data-pf="type">
          <option value="text" ${p.type === "text" ? "selected" : ""}>text</option>
          <option value="number" ${p.type === "number" ? "selected" : ""}>number</option>
          <option value="select" ${p.type === "select" ? "selected" : ""}>select</option>
        </select>
        <input data-pf="default" placeholder="${T("default", "默认")}" value="${escapeHtml(p.default || "")}" />
        <button data-pf="remove" type="button">✕</button>
      </div>`;
    }
    overlay.innerHTML = `
      <div class="box" style="width:min(640px,92vw);">
        <h3 style="margin:0;">${T("💾 Save as template", "💾 存为模板")}</h3>
        <input id="tpl-name" placeholder="${T("Template name", "模板名称")}" maxlength="120" />
        <textarea id="tpl-desc" placeholder="${T("Optional description", "描述(可选)")}" maxlength="1000"></textarea>
        <textarea id="tpl-seed" placeholder='${T("Seed JSON — use {{key}} placeholders", "种子 JSON — 用 {{key}} 占位")}'>${seed ? escapeHtml(JSON.stringify(seed, null, 2)) : ""}</textarea>
        <div style="font-size:12px;color:#bbb;">${T("Parameters (others fill {{key}} placeholders)", "参数(他人将填入 {{key}})")}</div>
        <div id="tpl-params-rows" style="display:flex;flex-direction:column;gap:4px;"></div>
        <button type="button" id="tpl-params-add" style="align-self:flex-start;font-size:12px;padding:4px 10px;">${T("+ Add parameter", "+ 新增参数")}</button>
        <label style="font-size:12px; color:#aaa;">
          <input type="checkbox" id="tpl-public" checked /> ${T("Publish publicly", "公开发布")}
        </label>
        <div class="row">
          <button data-act="cancel">${T("Cancel", "取消")}</button>
          <button class="primary" data-act="save">${T("Save", "保存")}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const rowsHost = overlay.querySelector("#tpl-params-rows");
    function renderParamRows() {
      rowsHost.innerHTML = params.map(paramRowHtml).join("");
    }
    overlay.querySelector("#tpl-params-add").addEventListener("click", () => {
      params.push({ key: "", label_en: "", label_zh: "", type: "text", default: "" });
      renderParamRows();
    });
    rowsHost.addEventListener("click", (ev) => {
      const btn = ev.target && ev.target.closest("[data-pf=remove]");
      if (!btn) return;
      const idx = Number(btn.parentElement.getAttribute("data-pidx"));
      params.splice(idx, 1);
      renderParamRows();
    });
    overlay.addEventListener("click", async (ev) => {
      const btn = ev.target && ev.target.closest("button");
      if (!btn) {
        if (ev.target === overlay) overlay.remove();
        return;
      }
      const act = btn.getAttribute("data-act");
      if (act === "cancel") { overlay.remove(); return; }
      if (act === "save") {
        const name = overlay.querySelector("#tpl-name").value.trim();
        const desc = overlay.querySelector("#tpl-desc").value.trim();
        const seedText = overlay.querySelector("#tpl-seed").value.trim();
        const isPublic = overlay.querySelector("#tpl-public").checked;
        if (!name) { alert(T("Name is required.", "请填写名称。")); return; }
        let parsed = null;
        try { parsed = JSON.parse(seedText); } catch {
          alert(T("Seed JSON is invalid.", "种子 JSON 无效。")); return;
        }
        // Collect parameter rows from DOM.
        const collected = [];
        rowsHost.querySelectorAll("[data-pidx]").forEach((row) => {
          const get = (f) => row.querySelector(`[data-pf="${f}"]`).value.trim();
          const key = get("key");
          if (!key) return;
          collected.push({
            key,
            label_en: get("label_en") || key,
            label_zh: get("label_en") || key,
            type: get("type") || "text",
            default: get("default") || undefined,
          });
        });
        const r = await api("/api/person-mv/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: desc || null,
            seed: parsed,
            visibility: isPublic ? "public" : "private",
            parameters: collected,
          }),
        });
        if (r && r.ok) { overlay.remove(); alert(T("Saved.", "已保存。")); }
        else if (r && r.code === "AUTH_REQUIRED") alert(T("Sign in to save templates.", "请登录以保存模板。"));
        else alert(T("Save failed.", "保存失败。"));
      }
    });
  }

  // ─── floating "save as template" button on MV pipeline ──────────────
  function ensureSaveButton() {
    if (document.getElementById("cssos-tpl-save-btn")) return;
    const btn = document.createElement("button");
    btn.id = "cssos-tpl-save-btn";
    btn.type = "button";
    btn.textContent = T("💾 Save as template", "💾 存为模板");
    btn.style.cssText = "position:fixed; right:18px; bottom:18px; z-index:1000; padding:10px 14px; background:#2a6a3a; color:#fff; border:1px solid #4a8a5a; border-radius:8px; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,.4); display:none;";
    btn.addEventListener("click", openSaveDialog);
    document.body.appendChild(btn);
    // Show button only when MV pipeline panel is visible.
    const update = () => {
      const pipe = document.getElementById("mv-pipeline-panel") || document.querySelector("[data-panel=\"mv-pipeline\"]");
      const visible = pipe && !pipe.classList.contains("hidden") && pipe.offsetParent !== null;
      btn.style.display = visible ? "" : "none";
    };
    setInterval(update, 1000);
    window.addEventListener("cssos:panel-changed", update);
  }

  // ─── creator profile rail (/u/:handle) ───────────────────────────────
  async function ensureCreatorRail() {
    const userId = String(globalThis.cssosProfileUserId || (document.body && document.body.getAttribute("data-cssos-user-id")) || "").trim();
    if (!userId) return;
    if (document.getElementById("cssos-tpl-creator-rail")) return;
    const j = await api(`/api/person-mv/templates?user_id=${encodeURIComponent(userId)}&limit=12`);
    if (!j || !j.ok || !j.templates || !j.templates.length) return;
    const rail = document.createElement("div");
    rail.id = "cssos-tpl-creator-rail";
    rail.className = "cssos-tpl-creator-rail";
    rail.innerHTML = `<h4>${T("📁 Templates by this creator", "📁 该创作者的模板")}</h4>
      <div class="cssos-tpl-grid">${j.templates.map((t) => renderCard(t, {})).join("")}</div>`;
    const host = document.querySelector("main") || document.body;
    host.appendChild(rail);
  }

  // ─── boot ────────────────────────────────────────────────────────────
  function boot() {
    ensurePanel();
    ensureSaveButton();
    ensureCreatorRail();
    // Hash routing: #templates → ensure panel & toggle visible.
    const onHash = () => {
      const tplPanel = document.getElementById("templates");
      if (!tplPanel) return;
      if (location.hash === "#templates") {
        document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
        tplPanel.classList.remove("hidden");
      }
    };
    window.addEventListener("hashchange", onHash);
    onHash();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // Expose so other modules can trigger save dialog programmatically.
  globalThis.cssosOpenSaveTemplateDialog = openSaveDialog;
})();
