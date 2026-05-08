/* CSSOS_PERSON_MV_WAVE74 20260508 — Jing
 *
 * Creation tutorial system. Hash routes:
 *   #tutorials        — card grid (public).
 *   #tutorials/:id    — tutorial detail (rendered server-side
 *                       markdown, sticky "Use this template" CTA).
 * Admin (when CSSOS_ME.role === "admin") sees a "+ New tutorial"
 * button and an inline edit form.
 *
 * Project rules — strictly applied:
 *   - i18n: every visible string flows through tt(en, zh).
 *   - dual-theme: light theme uses the forest-green palette
 *     (#0f3a2a / #00a060 / rgba(0,160,100,*)); dark theme uses
 *     pale teal #daffee.
 *   - server-side markdown rendering is the sole source of HTML
 *     (sanitised whitelist on the backend); client uses
 *     innerHTML on body_html only — never on user-supplied md.
 */
(function () {
  "use strict";

  function tt(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    return lang.indexOf("zh") === 0 && zh ? zh : en;
  }
  function isZh() {
    return (navigator.language || "en").toLowerCase().indexOf("zh") === 0;
  }
  function isAdmin() {
    try {
      var me = globalThis.CSSOS_ME || {};
      return me.role === "admin" || me.tier === "admin";
    } catch (_e) { return false; }
  }

  var STYLE_ID = "cssos-tutorials-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#cssos-tutorials-page{position:fixed;inset:0;z-index:9000;",
      "  background:rgba(8,16,12,0.96);color:#daffee;overflow:auto;",
      "  font-family:inherit;padding:48px 24px 64px;}",
      "#cssos-tutorials-page .cssos-tut-inner{max-width:900px;margin:0 auto;}",
      "#cssos-tutorials-page .cssos-tut-close{position:fixed;top:16px;right:20px;",
      "  background:rgba(0,160,100,0.12);color:#daffee;border:1px solid #0a8;",
      "  border-radius:999px;padding:6px 14px;cursor:pointer;font-size:14px;}",
      "#cssos-tutorials-page h1{font-size:32px;margin:0 0 8px;color:#daffee;}",
      "#cssos-tutorials-page .cssos-tut-meta{opacity:0.75;margin-bottom:24px;}",
      "#cssos-tutorials-page .cssos-tut-grid{display:grid;",
      "  grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}",
      "#cssos-tutorials-page .cssos-tut-card{background:rgba(0,160,100,0.08);",
      "  border:1px solid rgba(0,160,100,0.25);border-radius:14px;padding:16px;",
      "  cursor:pointer;transition:transform 120ms ease, background 120ms ease;}",
      "#cssos-tutorials-page .cssos-tut-card:hover{transform:translateY(-2px);",
      "  background:rgba(0,160,100,0.16);}",
      "#cssos-tutorials-page .cssos-tut-card .tut-emoji{font-size:30px;}",
      "#cssos-tutorials-page .cssos-tut-card .tut-title{font-size:16px;",
      "  font-weight:600;margin-top:6px;}",
      "#cssos-tutorials-page .cssos-tut-card .tut-sub{opacity:0.7;",
      "  font-size:12px;margin-top:6px;display:flex;gap:8px;}",
      "#cssos-tutorials-page .cssos-tut-badge{background:rgba(0,160,100,0.25);",
      "  border-radius:6px;padding:2px 8px;font-size:11px;}",
      "#cssos-tutorials-page .cssos-tut-body{line-height:1.6;font-size:15px;}",
      "#cssos-tutorials-page .cssos-tut-body h1,",
      "#cssos-tutorials-page .cssos-tut-body h2,",
      "#cssos-tutorials-page .cssos-tut-body h3{margin-top:24px;}",
      "#cssos-tutorials-page .cssos-tut-body code{background:rgba(0,160,100,0.16);",
      "  padding:2px 6px;border-radius:4px;font-size:13px;}",
      "#cssos-tutorials-page .cssos-tut-body pre{background:rgba(0,0,0,0.30);",
      "  padding:12px;border-radius:8px;overflow:auto;}",
      "#cssos-tutorials-page .cssos-tut-body a{color:#7fffd4;}",
      "#cssos-tutorials-page .cssos-tut-cta{position:sticky;bottom:16px;display:flex;",
      "  justify-content:center;margin-top:32px;}",
      "#cssos-tutorials-page .cssos-tut-cta button{background:#00a060;color:#fff;",
      "  border:none;border-radius:999px;padding:12px 28px;font-size:15px;",
      "  font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(0,160,100,0.4);}",
      "#cssos-tutorials-page .cssos-tut-admin{margin:8px 0 24px;}",
      "#cssos-tutorials-page .cssos-tut-admin button{background:rgba(0,160,100,0.18);",
      "  color:#daffee;border:1px solid #0a8;border-radius:8px;padding:6px 14px;cursor:pointer;}",
      "#cssos-tutorials-page .cssos-tut-form{display:flex;flex-direction:column;gap:8px;",
      "  background:rgba(0,160,100,0.06);border:1px solid rgba(0,160,100,0.25);",
      "  border-radius:12px;padding:16px;margin-bottom:24px;}",
      "#cssos-tutorials-page .cssos-tut-form input,",
      "#cssos-tutorials-page .cssos-tut-form textarea,",
      "#cssos-tutorials-page .cssos-tut-form select{background:rgba(0,0,0,0.25);",
      "  color:#daffee;border:1px solid rgba(0,160,100,0.40);border-radius:6px;",
      "  padding:8px;font-family:inherit;font-size:14px;}",
      "#cssos-tutorials-page .cssos-tut-form textarea{min-height:200px;font-family:monospace;}",
      /* Forest-green light-theme palette */
      "html[data-theme=\"light\"] #cssos-tutorials-page{",
      "  background:rgba(245,250,247,0.98);color:#0f3a2a;}",
      "html[data-theme=\"light\"] #cssos-tutorials-page h1,",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-close{color:#0f3a2a;}",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-close{",
      "  background:rgba(0,160,100,0.10);border-color:#00a060;}",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-card{",
      "  background:rgba(0,160,100,0.06);border-color:rgba(0,160,100,0.30);}",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-card:hover{",
      "  background:rgba(0,160,100,0.14);}",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-body code{",
      "  background:rgba(0,160,100,0.14);color:#0f3a2a;}",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-body pre{",
      "  background:rgba(0,0,0,0.06);}",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-body a{color:#00a060;}",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-admin button{",
      "  background:rgba(0,160,100,0.10);color:#0f3a2a;border-color:#00a060;}",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-form{",
      "  background:rgba(0,160,100,0.04);border-color:rgba(0,160,100,0.30);}",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-form input,",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-form textarea,",
      "html[data-theme=\"light\"] #cssos-tutorials-page .cssos-tut-form select{",
      "  background:#fff;color:#0f3a2a;border-color:rgba(0,160,100,0.40);}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function getOrMakeRoot() {
    var root = document.getElementById("cssos-tutorials-page");
    if (root) return root;
    root = document.createElement("div");
    root.id = "cssos-tutorials-page";
    root.style.display = "none";
    document.body.appendChild(root);
    return root;
  }
  function show() { ensureStyle(); getOrMakeRoot().style.display = "block"; }
  function hide() {
    var r = document.getElementById("cssos-tutorials-page");
    if (r) r.style.display = "none";
  }

  async function fetchJSON(url, opts) {
    var r = await fetch(url, Object.assign({ credentials: "include", headers: { Accept: "application/json" } }, opts || {}));
    var j;
    try { j = await r.json(); } catch (_e) { j = null; }
    if (!r.ok) throw new Error((j && j.code) || ("HTTP " + r.status));
    return j;
  }

  function diffBadge(d) {
    return d === "advanced" ? tt("Advanced", "进阶")
         : d === "intermediate" ? tt("Intermediate", "中级")
         : tt("Beginner", "入门");
  }

  function renderList(items) {
    var root = getOrMakeRoot();
    root.replaceChildren();
    var inner = el("div", "cssos-tut-inner");
    var close = el("button", "cssos-tut-close", tt("Close", "关闭"));
    close.addEventListener("click", function () {
      try { history.replaceState(null, "", "#"); } catch (_e) {}
      hide();
    });
    root.appendChild(close);

    inner.appendChild(el("h1", null, tt("Tutorials", "教程")));
    inner.appendChild(el("div", "cssos-tut-meta",
      tt("Step-by-step guides for building MVs.", "一步一步带你做出 MV。")));

    if (isAdmin()) {
      var bar = el("div", "cssos-tut-admin");
      var btn = el("button", null, tt("+ New tutorial", "+ 新建教程"));
      btn.addEventListener("click", function () { renderEditor(null); });
      bar.appendChild(btn);
      inner.appendChild(bar);
    }

    var grid = el("div", "cssos-tut-grid");
    if (!items.length) {
      grid.appendChild(el("div", null, tt("No tutorials yet.", "暂无教程。")));
    }
    items.forEach(function (t) {
      var card = el("div", "cssos-tut-card");
      card.appendChild(el("div", "tut-emoji", t.emoji || "📘"));
      card.appendChild(el("div", "tut-title", isZh() ? (t.title_zh || t.title_en) : (t.title_en || t.title_zh)));
      var sub = el("div", "tut-sub");
      sub.appendChild(el("span", "cssos-tut-badge", diffBadge(t.difficulty)));
      sub.appendChild(el("span", null, "👁 " + (t.view_count || 0)));
      card.appendChild(sub);
      card.addEventListener("click", function () {
        location.hash = "#tutorials/" + encodeURIComponent(t.tutorial_id);
      });
      grid.appendChild(card);
    });
    inner.appendChild(grid);
    root.appendChild(inner);
    show();
  }

  function renderDetail(t) {
    var root = getOrMakeRoot();
    root.replaceChildren();
    var inner = el("div", "cssos-tut-inner");
    var close = el("button", "cssos-tut-close", tt("Close", "关闭"));
    close.addEventListener("click", function () {
      location.hash = "#tutorials";
    });
    root.appendChild(close);

    var title = isZh() ? (t.title_zh || t.title_en) : (t.title_en || t.title_zh);
    inner.appendChild(el("h1", null, (t.emoji || "📘") + "  " + title));

    var meta = el("div", "cssos-tut-meta");
    meta.textContent = diffBadge(t.difficulty) + "  ·  👁 " + (t.view_count || 0);
    inner.appendChild(meta);

    if (isAdmin()) {
      var bar = el("div", "cssos-tut-admin");
      var editBtn = el("button", null, tt("Edit", "编辑"));
      editBtn.addEventListener("click", function () { renderEditor(t); });
      bar.appendChild(editBtn);
      if (!t.published_at) {
        var pubBtn = el("button", null, tt("Publish", "发布"));
        pubBtn.style.marginLeft = "8px";
        pubBtn.addEventListener("click", async function () {
          try {
            await fetchJSON("/api/admin/tutorials/" + encodeURIComponent(t.tutorial_id) + "/publish", { method: "POST" });
            alert(tt("Published.", "已发布。"));
            loadDetail(t.tutorial_id);
          } catch (err) { alert(String(err)); }
        });
        bar.appendChild(pubBtn);
      }
      inner.appendChild(bar);
    }

    var body = el("div", "cssos-tut-body");
    /* body_html is generated by the server's strict-whitelist
     * markdown renderer (no <script>, no on*= handlers). Safe to
     * innerHTML — never use raw body_md here. */
    var html = isZh()
      ? (t.body_html || t.body_en_html || "")
      : (t.body_en_html || t.body_html || "");
    body.innerHTML = html;
    inner.appendChild(body);

    if (t.template_id) {
      var cta = el("div", "cssos-tut-cta");
      var useBtn = el("button", null, tt("Use this template", "使用此模板"));
      useBtn.addEventListener("click", function () {
        location.hash = "#person-mv/template/" + encodeURIComponent(t.template_id) + "/fork";
      });
      cta.appendChild(useBtn);
      inner.appendChild(cta);
    }
    root.appendChild(inner);
    show();
  }

  function renderEditor(existing) {
    var root = getOrMakeRoot();
    root.replaceChildren();
    var inner = el("div", "cssos-tut-inner");
    var close = el("button", "cssos-tut-close", tt("Close", "关闭"));
    close.addEventListener("click", function () { location.hash = "#tutorials"; });
    root.appendChild(close);

    inner.appendChild(el("h1", null, existing ? tt("Edit tutorial", "编辑教程") : tt("New tutorial", "新建教程")));

    var form = el("div", "cssos-tut-form");
    function row(labelEn, labelZh, input) {
      var lbl = el("label", null, tt(labelEn, labelZh));
      form.appendChild(lbl);
      form.appendChild(input);
    }
    var titleZh = el("input"); titleZh.type = "text"; titleZh.value = existing ? (existing.title_zh || "") : "";
    var titleEn = el("input"); titleEn.type = "text"; titleEn.value = existing ? (existing.title_en || "") : "";
    var emoji   = el("input"); emoji.type = "text"; emoji.maxLength = 4; emoji.value = existing ? (existing.emoji || "") : "📘";
    var tplId   = el("input"); tplId.type = "text"; tplId.value = existing ? (existing.template_id || "") : "";
    var diff    = el("select");
    [["beginner", "入门"], ["intermediate", "中级"], ["advanced", "进阶"]].forEach(function (p) {
      var o = document.createElement("option"); o.value = p[0];
      o.textContent = isZh() ? p[1] : p[0];
      if (existing && existing.difficulty === p[0]) o.selected = true;
      diff.appendChild(o);
    });
    var bodyZh = el("textarea"); bodyZh.value = existing ? (existing.body_md || "") : "";
    var bodyEn = el("textarea"); bodyEn.value = existing ? (existing.body_en_md || "") : "";

    row("Title (中文)", "标题（中文）", titleZh);
    row("Title (English)", "标题（英文）", titleEn);
    row("Emoji", "表情", emoji);
    row("Template ID (optional)", "模板 ID（可选）", tplId);
    row("Difficulty", "难度", diff);
    row("Body — Chinese (markdown)", "正文 — 中文（Markdown）", bodyZh);
    row("Body — English (markdown, optional)", "正文 — 英文（可选）", bodyEn);

    var save = el("button", null, tt("Save", "保存"));
    save.style.alignSelf = "flex-start";
    save.style.background = "#00a060";
    save.style.color = "#fff";
    save.style.border = "none";
    save.style.borderRadius = "8px";
    save.style.padding = "8px 18px";
    save.style.cursor = "pointer";
    save.addEventListener("click", async function () {
      var body = {
        title_zh: titleZh.value.trim(),
        title_en: titleEn.value.trim(),
        emoji: emoji.value.trim() || null,
        difficulty: diff.value,
        template_id: tplId.value.trim() || null,
        body_md: bodyZh.value,
        body_en_md: bodyEn.value || null,
      };
      try {
        if (existing) {
          await fetchJSON("/api/admin/tutorials/" + encodeURIComponent(existing.tutorial_id), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body),
          });
          location.hash = "#tutorials/" + encodeURIComponent(existing.tutorial_id);
        } else {
          var j = await fetchJSON("/api/admin/tutorials", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body),
          });
          var id = j && j.data && j.data.tutorial_id;
          if (id) location.hash = "#tutorials/" + encodeURIComponent(id);
          else location.hash = "#tutorials";
        }
      } catch (err) { alert(String(err)); }
    });
    form.appendChild(save);
    inner.appendChild(form);
    root.appendChild(inner);
    show();
  }

  async function loadList() {
    show();
    try {
      var j = await fetchJSON("/api/tutorials");
      var items = (j && j.data && j.data.tutorials) || [];
      renderList(items);
    } catch (err) {
      var root = getOrMakeRoot();
      root.replaceChildren();
      var inner = el("div", "cssos-tut-inner");
      inner.appendChild(el("h1", null, tt("Failed to load", "加载失败")));
      inner.appendChild(el("div", "cssos-tut-meta", String(err && err.message || err)));
      root.appendChild(inner);
    }
  }

  async function loadDetail(id) {
    show();
    try {
      var j = await fetchJSON("/api/tutorials/" + encodeURIComponent(id));
      renderDetail((j && j.data) || {});
    } catch (err) {
      var root = getOrMakeRoot();
      root.replaceChildren();
      var inner = el("div", "cssos-tut-inner");
      inner.appendChild(el("h1", null, tt("Failed to load", "加载失败")));
      inner.appendChild(el("div", "cssos-tut-meta", String(err && err.message || err)));
      root.appendChild(inner);
    }
  }

  function onHash() {
    var h = String(location.hash || "").replace(/^#/, "");
    if (h === "tutorials") { loadList(); return; }
    var m = h.match(/^tutorials\/(.+)$/);
    if (m) { loadDetail(decodeURIComponent(m[1])); return; }
    hide();
  }

  window.addEventListener("hashchange", onHash);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onHash, { once: true });
  } else {
    onHash();
  }
})();
