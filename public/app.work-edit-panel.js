/* CSSOS_WAVE_544 20260531 — Jing「作品中心要让用户编辑自己作品的基础+展示信息,
 * 否则改不了笔误 / 画幅不对」。自包含三件套模块: 自建 HTML + 自注入 CSS + JS 动作。
 * 入口: globalThis.openWorkEditPanel(work)。保存走 POST /api/works/:id/edit (owner-only)。
 * 字段(基础+展示): 标题 / 风格 / 歌词 / 封面URL / 宽高比 / 朝向 / 试听价 / 买断价。
 * i18n 铁律: 文案走 wecCopy(en, zh) 按 html[lang] 切换, 不硬编码单一语言。 */
(function () {
  "use strict";
  if (globalThis.__cssosWorkEditPanelWired) return;
  globalThis.__cssosWorkEditPanelWired = true;

  function isZh() {
    try {
      return String(document.documentElement.lang || "").toLowerCase().startsWith("zh");
    } catch (_e) { return false; }
  }
  function wecCopy(en, zh) {
    // 优先用平台统一 tr(); 否则按 html[lang] 在 en/zh 间选。绝不硬编码单一语言。
    try {
      if (typeof globalThis.tr === "function") {
        const k = "workEdit." + en.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
        const v = globalThis.tr(k);
        if (v && v !== k) return v;
      }
    } catch (_e) {}
    return isZh() ? zh : en;
  }
  function toast(msg) {
    try { if (typeof globalThis.showToast === "function") return globalThis.showToast(msg); } catch (_e) {}
  }

  function injectStyles() {
    if (document.getElementById("cssos-work-edit-style")) return;
    const st = document.createElement("style");
    st.id = "cssos-work-edit-style";
    st.textContent = [
      "#cssos-work-edit-overlay{position:fixed;inset:0;z-index:2147483600;display:flex;",
      "align-items:center;justify-content:center;background:rgba(8,10,16,0.62);}",
      "#cssos-work-edit-overlay[hidden]{display:none;}",
      "#cssos-work-edit-card{width:min(520px,92vw);max-height:88vh;overflow:auto;border-radius:18px;",
      "background:#15171f;color:#f4f5f8;border:1px solid rgba(255,255,255,0.10);",
      "box-shadow:0 24px 80px rgba(0,0,0,0.55);padding:20px 20px 16px;}",
      "#cssos-work-edit-card h3{margin:0 0 12px;font-size:16px;font-weight:650;letter-spacing:0.01em;}",
      ".cssos-wec-row{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}",
      ".cssos-wec-row label{font-size:12px;opacity:0.72;}",
      ".cssos-wec-row input,.cssos-wec-row select,.cssos-wec-row textarea{width:100%;box-sizing:border-box;",
      "background:#1f2330;border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;",
      "padding:9px 11px;font-size:14px;font-family:inherit;}",
      ".cssos-wec-row textarea{min-height:90px;resize:vertical;line-height:1.5;}",
      ".cssos-wec-2col{display:flex;gap:10px;}.cssos-wec-2col>.cssos-wec-row{flex:1 1 0;min-width:0;}",
      ".cssos-wec-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:6px;}",
      ".cssos-wec-btn{border:0;border-radius:11px;padding:10px 16px;font-size:14px;cursor:pointer;font-family:inherit;}",
      ".cssos-wec-btn.primary{background:#5b8cff;color:#fff;font-weight:600;}",
      ".cssos-wec-btn.ghost{background:transparent;color:#cfd3dc;border:1px solid rgba(255,255,255,0.14);}",
      ".cssos-wec-btn[disabled]{opacity:0.55;cursor:default;}"
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function close() {
    const ov = document.getElementById("cssos-work-edit-overlay");
    if (ov) ov.hidden = true;
  }

  function buildOverlay() {
    let ov = document.getElementById("cssos-work-edit-overlay");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "cssos-work-edit-overlay";
    ov.hidden = true;
    ov.innerHTML =
      '<div id="cssos-work-edit-card" role="dialog" aria-modal="true">' +
        '<h3 id="cssos-wec-title"></h3>' +
        '<div class="cssos-wec-row"><label id="cssos-wec-l-title"></label><input id="cssos-wec-f-title" maxlength="80" type="text"></div>' +
        '<div class="cssos-wec-row"><label id="cssos-wec-l-style"></label><input id="cssos-wec-f-style" maxlength="200" type="text"></div>' +
        '<div class="cssos-wec-row"><label id="cssos-wec-l-lyrics"></label><textarea id="cssos-wec-f-lyrics" maxlength="8000"></textarea></div>' +
        '<div class="cssos-wec-row"><label id="cssos-wec-l-cover"></label><input id="cssos-wec-f-cover" type="text" placeholder="https://…"></div>' +
        '<div class="cssos-wec-2col">' +
          '<div class="cssos-wec-row"><label id="cssos-wec-l-aspect"></label><select id="cssos-wec-f-aspect">' +
            '<option value="2.39:1">2.39:1 · Anamorphic</option><option value="16:9">16:9</option>' +
            '<option value="1:1">1:1</option><option value="9:16">9:16</option></select></div>' +
          '<div class="cssos-wec-row"><label id="cssos-wec-l-orient"></label><select id="cssos-wec-f-orient">' +
            '<option value="ultra-wide">ultra-wide</option><option value="landscape">landscape</option>' +
            '<option value="square">square</option><option value="portrait">portrait</option></select></div>' +
        '</div>' +
        '<div class="cssos-wec-2col">' +
          '<div class="cssos-wec-row"><label id="cssos-wec-l-listen"></label><input id="cssos-wec-f-listen" type="number" min="0" step="1"></div>' +
          '<div class="cssos-wec-row"><label id="cssos-wec-l-buyout"></label><input id="cssos-wec-f-buyout" type="number" min="0" step="1"></div>' +
        '</div>' +
        '<div class="cssos-wec-actions">' +
          '<button type="button" class="cssos-wec-btn ghost" id="cssos-wec-cancel"></button>' +
          '<button type="button" class="cssos-wec-btn primary" id="cssos-wec-save"></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !ov.hidden) close();
    });
    return ov;
  }

  function applyLabels() {
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set("cssos-wec-title", wecCopy("Edit work info", "编辑作品信息"));
    set("cssos-wec-l-title", wecCopy("Title", "标题"));
    set("cssos-wec-l-style", wecCopy("Style", "风格"));
    set("cssos-wec-l-lyrics", wecCopy("Lyrics", "歌词"));
    set("cssos-wec-l-cover", wecCopy("Cover image URL", "封面图链接"));
    set("cssos-wec-l-aspect", wecCopy("Aspect ratio", "宽高比"));
    set("cssos-wec-l-orient", wecCopy("Orientation", "朝向"));
    set("cssos-wec-l-listen", wecCopy("Listen price (¢)", "试听价(分)"));
    set("cssos-wec-l-buyout", wecCopy("Buyout price (¢)", "买断价(分)"));
    set("cssos-wec-cancel", wecCopy("Cancel", "取消"));
    set("cssos-wec-save", wecCopy("Save", "保存"));
  }

  function fill(work) {
    const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val == null ? "" : String(val)); };
    v("cssos-wec-f-title", work.title || "");
    v("cssos-wec-f-style", work.style || "");
    v("cssos-wec-f-lyrics", work.lyrics_preview || work.lyrics_full || "");
    v("cssos-wec-f-cover", work.cover_image || "");
    const asp = document.getElementById("cssos-wec-f-aspect");
    if (asp) asp.value = (work.aspect_ratio && /^(2\.39:1|16:9|1:1|9:16)$/.test(work.aspect_ratio)) ? work.aspect_ratio : "2.39:1";
    const ori = document.getElementById("cssos-wec-f-orient");
    if (ori) ori.value = ["ultra-wide", "landscape", "square", "portrait"].includes(work.orientation) ? work.orientation : "ultra-wide";
    v("cssos-wec-f-listen", work.suggested_listen_price_cents != null ? work.suggested_listen_price_cents : "");
    v("cssos-wec-f-buyout", work.suggested_buyout_price_cents != null ? work.suggested_buyout_price_cents : "");
  }

  async function save(workId) {
    const get = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
    const payload = {
      title: get("cssos-wec-f-title").trim(),
      style: get("cssos-wec-f-style").trim(),
      lyrics_preview: get("cssos-wec-f-lyrics"),
      cover_image: get("cssos-wec-f-cover").trim(),
      aspect_ratio: get("cssos-wec-f-aspect"),
      orientation: get("cssos-wec-f-orient")
    };
    const lp = get("cssos-wec-f-listen").trim();
    const bp = get("cssos-wec-f-buyout").trim();
    if (lp !== "") payload.suggested_listen_price_cents = Number(lp);
    if (bp !== "") payload.suggested_buyout_price_cents = Number(bp);
    if (!payload.title) { toast(wecCopy("Title is required", "标题不能为空")); return; }

    const saveBtn = document.getElementById("cssos-wec-save");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = wecCopy("Saving…", "保存中…"); }
    try {
      const r = await fetch("/api/works/" + encodeURIComponent(workId) + "/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok) {
        toast("✓ " + wecCopy("Saved", "已保存"));
        close();
        // 刷新作品中心列表(强制重拉, 显示新字段)。
        try { if (typeof globalThis.loadMyWorksModule === "function") globalThis.loadMyWorksModule({ force: true }); } catch (_e) {}
        try { document.dispatchEvent(new CustomEvent("cssos:work-edited", { detail: { work: j.work } })); } catch (_e) {}
      } else {
        toast(wecCopy("Save failed", "保存失败") + ": " + ((j && j.error) || r.status));
      }
    } catch (err) {
      toast(wecCopy("Save failed", "保存失败") + ": " + (err && err.message));
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = wecCopy("Save", "保存"); }
    }
  }

  globalThis.openWorkEditPanel = function openWorkEditPanel(work) {
    work = (work && typeof work === "object") ? work : {};
    const workId = String(work.id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(workId)) { toast(wecCopy("Cannot edit: missing work id", "无法编辑: 缺少作品ID")); return; }
    injectStyles();
    const ov = buildOverlay();
    applyLabels();
    fill(work);
    const saveBtn = document.getElementById("cssos-wec-save");
    const cancelBtn = document.getElementById("cssos-wec-cancel");
    // 重新绑定(每次打开换 workId), 用 onclick 覆盖避免重复监听堆积。
    if (saveBtn) saveBtn.onclick = () => save(workId);
    if (cancelBtn) cancelBtn.onclick = () => close();
    ov.hidden = false;
    try { document.getElementById("cssos-wec-f-title").focus(); } catch (_e) {}
  };
})();
