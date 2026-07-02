/* CSSOS_WAVE_113 20260702 — Jing「数字演员(Digital Actor)」图鉴页(Phase 1)。
 * 自成一体的演员图鉴 overlay: 浏览平台演员(合成/文明), 看详情(codex), 一键"选角"
 * (接 cssosOpenAssistantWithPrompt 创作入口, 绝不死胡同)。读后端 /api/actors + /:id/codex。
 * 宪法: 黑+翠绿(#00F5A0 填充配深墨字)/ skeleton-first / 引导式无死胡同。
 * 入口: 全局 cssosOpenActorGallery(); 或 hash #actors。 */
(function () {
  "use strict";
  var GREEN = "#00F5A0", INK = "#04120C";
  var ROOT_ID = "cssos-actor-gallery";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var cents = function (c) { return "¢" + Math.round(Number(c || 0)); };
  var hueOf = function (s) { var h = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };

  function ensureStyle() {
    if (document.getElementById(ROOT_ID + "-css")) return;
    var st = document.createElement("style");
    st.id = ROOT_ID + "-css";
    st.textContent =
      "#" + ROOT_ID + "{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;background:rgba(2,10,7,.94);backdrop-filter:blur(6px);color:#e8fff5;font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;}" +
      "#" + ROOT_ID + " .ag-bar{display:flex;align-items:center;gap:14px;padding:18px 26px;border-bottom:1px solid rgba(0,245,160,.18);}" +
      "#" + ROOT_ID + " .ag-title{font-size:22px;font-weight:800;letter-spacing:.3px;}" +
      "#" + ROOT_ID + " .ag-title b{color:" + GREEN + ";}" +
      "#" + ROOT_ID + " .ag-spacer{flex:1;}" +
      "#" + ROOT_ID + " .ag-search{background:rgba(0,245,160,.08);border:1px solid rgba(0,245,160,.3);color:#e8fff5;border-radius:999px;padding:8px 16px;font-size:14px;min-width:220px;outline:none;}" +
      "#" + ROOT_ID + " .ag-x{background:rgba(255,255,255,.08);border:none;color:#e8fff5;width:38px;height:38px;border-radius:50%;font-size:20px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-x:hover{background:rgba(255,255,255,.16);}" +
      "#" + ROOT_ID + " .ag-filters{display:flex;gap:8px;padding:14px 26px 4px;flex-wrap:wrap;}" +
      "#" + ROOT_ID + " .ag-chip{background:rgba(255,255,255,.08);border:1px solid rgba(0,245,160,.22);color:#cfeee0;border-radius:999px;padding:6px 15px;font-size:13px;font-weight:600;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-chip.on{background:" + GREEN + ";color:" + INK + ";border-color:" + GREEN + ";}" +
      "#" + ROOT_ID + " .ag-scroll{flex:1;overflow:auto;padding:16px 26px 40px;}" +
      "#" + ROOT_ID + " .ag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px;}" +
      "#" + ROOT_ID + " .ag-card{background:rgba(255,255,255,.04);border:1px solid rgba(0,245,160,.14);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;}" +
      "#" + ROOT_ID + " .ag-card:hover{transform:translateY(-3px);border-color:rgba(0,245,160,.55);box-shadow:0 0 22px rgba(0,245,160,.22);}" +
      "#" + ROOT_ID + " .ag-cover{aspect-ratio:1/1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;}" +
      "#" + ROOT_ID + " .ag-cover img{width:100%;height:100%;object-fit:cover;object-position:var(--foc,center 30%);display:block;}" +
      "#" + ROOT_ID + " .ag-initial{font-size:56px;font-weight:800;color:rgba(255,255,255,.9);text-shadow:0 2px 12px rgba(0,0,0,.5);}" +
      "#" + ROOT_ID + " .ag-badges{position:absolute;top:8px;left:8px;right:8px;display:flex;justify-content:space-between;gap:6px;pointer-events:none;}" +
      "#" + ROOT_ID + " .ag-badge{background:rgba(0,0,0,.55);border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;color:#daffee;}" +
      "#" + ROOT_ID + " .ag-badge.prem{background:" + GREEN + ";color:" + INK + ";}" +
      "#" + ROOT_ID + " .ag-meta{padding:11px 13px 13px;}" +
      "#" + ROOT_ID + " .ag-name{font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#" + ROOT_ID + " .ag-sub{font-size:12px;color:rgba(207,238,224,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}" +
      "#" + ROOT_ID + " .ag-row{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:rgba(207,238,224,.8);}" +
      "#" + ROOT_ID + " .ag-skel{background:linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.11),rgba(255,255,255,.05));background-size:200% 100%;animation:agsk 1.2s infinite;border-radius:16px;height:280px;}" +
      "@keyframes agsk{0%{background-position:200% 0;}100%{background-position:-200% 0;}}" +
      /* detail */
      "#" + ROOT_ID + " .ag-detail{max-width:1000px;margin:0 auto;}" +
      "#" + ROOT_ID + " .ag-back{background:rgba(255,255,255,.08);border:none;color:#e8fff5;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:18px;}" +
      "#" + ROOT_ID + " .ag-hero{display:flex;gap:24px;flex-wrap:wrap;}" +
      "#" + ROOT_ID + " .ag-hero-cover{width:260px;height:260px;border-radius:20px;overflow:hidden;flex:none;border:1px solid rgba(0,245,160,.3);display:flex;align-items:center;justify-content:center;}" +
      "#" + ROOT_ID + " .ag-hero-cover img{width:100%;height:100%;object-fit:cover;object-position:var(--foc,center 30%);}" +
      "#" + ROOT_ID + " .ag-hero-body{flex:1;min-width:260px;}" +
      "#" + ROOT_ID + " .ag-hero-name{font-size:30px;font-weight:800;}" +
      "#" + ROOT_ID + " .ag-hero-name small{font-size:16px;color:rgba(207,238,224,.7);font-weight:500;margin-left:10px;}" +
      "#" + ROOT_ID + " .ag-tags{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0;}" +
      "#" + ROOT_ID + " .ag-tag{background:rgba(0,245,160,.12);border:1px solid rgba(0,245,160,.3);color:#bff5e0;border-radius:999px;padding:4px 12px;font-size:12px;}" +
      "#" + ROOT_ID + " .ag-persona{color:rgba(232,255,245,.88);margin:10px 0;}" +
      "#" + ROOT_ID + " .ag-cast{background:" + GREEN + ";color:" + INK + ";border:none;border-radius:999px;padding:12px 26px;font-size:16px;font-weight:800;cursor:pointer;margin-top:8px;box-shadow:0 0 20px rgba(0,245,160,.35);}" +
      "#" + ROOT_ID + " .ag-cast:hover{filter:brightness(1.08);}" +
      "#" + ROOT_ID + " .ag-sec{margin-top:30px;}" +
      "#" + ROOT_ID + " .ag-sec h3{font-size:16px;color:" + GREEN + ";margin:0 0 12px;}" +
      "#" + ROOT_ID + " .ag-empty{color:rgba(207,238,224,.55);font-size:14px;padding:8px 0;}";
    document.head.appendChild(st);
  }

  var state = { filter: "all", search: "", actors: [] };

  function coverInner(a, big) {
    var foc = (a.cover_focal_x != null && a.cover_focal_x >= 0)
      ? (a.cover_focal_x * 100).toFixed(1) + "% " + (a.cover_focal_y * 100).toFixed(1) + "%" : "center 30%";
    if (a.cover_image) {
      return '<img src="' + esc(a.cover_image) + '" alt="' + esc(a.name_en) + '" loading="lazy" style="--foc:' + foc + '">';
    }
    var h = hueOf(a.name_en || a.actor_id);
    var initial = esc(String(a.name_en || a.name_zh || "?").trim().charAt(0).toUpperCase());
    return '<div style="position:absolute;inset:0;background:linear-gradient(135deg,hsl(' + h + ',60%,26%),hsl(' + ((h + 50) % 360) + ',65%,14%));"></div>' +
           '<div class="ag-initial">' + (big ? '<span style="font-size:96px">' + initial + '</span>' : initial) + '</div>';
  }

  function actorCard(a) {
    var originBadge = a.origin_type === "civilization" ? "🏛" : "✨";
    var priceBadge = a.is_premium ? '<span class="ag-badge prem">💎 ' + cents(a.cast_price_cents) + '</span>' : '<span class="ag-badge">Free</span>';
    return '<div class="ag-card" data-actor="' + esc(a.actor_id) + '">' +
      '<div class="ag-cover">' + coverInner(a, false) +
        '<div class="ag-badges"><span class="ag-badge">' + originBadge + '</span>' + priceBadge + '</div>' +
      '</div>' +
      '<div class="ag-meta">' +
        '<div class="ag-name">' + esc(a.name_zh || a.name_en) + '</div>' +
        '<div class="ag-sub">' + esc(a.name_en) + (a.civilization ? ' · ' + esc(a.civilization) : "") + '</div>' +
        '<div class="ag-row"><span>' + esc(a.voice_style || a.style_descriptor || "") + '</span></div>' +
      '</div></div>';
  }

  function applyFilter(list) {
    return list.filter(function (a) {
      if (state.filter === "synthetic" && a.origin_type !== "synthetic") return false;
      if (state.filter === "civilization" && a.origin_type !== "civilization") return false;
      if (state.filter === "premium" && !a.is_premium) return false;
      if (state.search) {
        var q = state.search.toLowerCase();
        var hay = (a.name_zh + " " + a.name_en + " " + (a.civilization || "") + " " + (a.persona || "")).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function renderGrid() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (!scroll) return;
    var list = applyFilter(state.actors);
    if (!list.length) { scroll.innerHTML = '<div class="ag-empty">' + (state.actors.length ? "没有匹配的演员。" : "暂无演员。") + '</div>'; return; }
    scroll.innerHTML = '<div class="ag-grid">' + list.map(actorCard).join("") + '</div>';
  }

  function skeleton(scroll) {
    var s = "";
    for (var i = 0; i < 10; i++) s += '<div class="ag-skel"></div>';
    scroll.innerHTML = '<div class="ag-grid">' + s + '</div>';
  }

  function loadActors() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (scroll) skeleton(scroll);
    fetch("/api/actors?limit=500", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        state.actors = (j && j.data && j.data.actors) || [];
        renderGrid();
      })
      .catch(function () {
        if (scroll) scroll.innerHTML = '<div class="ag-empty">加载失败。<button class="ag-chip" onclick="cssosOpenActorGallery(1)">重试</button></div>';
      });
  }

  function openCast(actor) {
    var name = actor.name_zh || actor.name_en;
    var prompt = "用数字演员「" + name + "」主演,创作一支 MV。" +
      (actor.face_prompt ? "该演员形象: " + actor.face_prompt + "。" : "") +
      (actor.voice_style ? "声线: " + actor.voice_style + "。" : "") +
      (actor.style_descriptor ? "风格: " + actor.style_descriptor + "。" : "");
    if (typeof window.cssosOpenAssistantWithPrompt === "function") {
      close();
      window.cssosOpenAssistantWithPrompt(prompt, { actorId: actor.actor_id });
    } else if (typeof window.cssosGuidedToast === "function") {
      window.cssosGuidedToast("已选定 " + name + " — 创作入口即将打开", {});
    } else {
      alert("已选定演员: " + name);
    }
  }

  function renderDetail(id) {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (!scroll) return;
    scroll.innerHTML = '<div class="ag-detail"><div class="ag-skel" style="height:260px;max-width:260px"></div></div>';
    fetch("/api/actors/" + encodeURIComponent(id) + "/codex", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var d = (j && j.data) || {}, a = d.actor;
        if (!a) { scroll.innerHTML = '<div class="ag-empty">未找到该演员。</div>'; return; }
        var foc = (a.cover_focal_x != null && a.cover_focal_x >= 0)
          ? (a.cover_focal_x * 100).toFixed(1) + "% " + (a.cover_focal_y * 100).toFixed(1) + "%" : "center 30%";
        var tags = [].concat(a.appearance_tags || [], a.tags || []).filter(Boolean).slice(0, 10);
        var mvs = d.mvs || [], rel = d.related_actors || [];
        var html = '<div class="ag-detail">' +
          '<button class="ag-back">‹ 返回图鉴</button>' +
          '<div class="ag-hero">' +
            '<div class="ag-hero-cover" style="--foc:' + foc + '">' + coverInner(a, true) + '</div>' +
            '<div class="ag-hero-body">' +
              '<div class="ag-hero-name">' + esc(a.name_zh || a.name_en) + '<small>' + esc(a.name_en) + '</small></div>' +
              '<div class="ag-sub" style="margin-top:6px">' + (a.origin_type === "civilization" ? "🏛 文明演员" : "✨ 原创合成") +
                (a.civilization ? " · " + esc(a.civilization) : "") +
                (a.is_premium ? ' · 💎 ' + cents(a.cast_price_cents) + "/选角" : " · Free") +
                ' · ▶ ' + (a.cast_count || 0) + " 次出演</div>" +
              (a.persona ? '<div class="ag-persona">' + esc(a.persona) + '</div>' : "") +
              (a.voice_style ? '<div class="ag-sub">🎙 ' + esc(a.voice_style) + '</div>' : "") +
              (tags.length ? '<div class="ag-tags">' + tags.map(function (t) { return '<span class="ag-tag">' + esc(t) + '</span>'; }).join("") + '</div>' : "") +
              '<button class="ag-cast">🎬 选 ' + esc(a.name_zh || a.name_en) + ' 主演</button>' +
            '</div>' +
          '</div>' +
          '<div class="ag-sec"><h3>出演作品</h3>' +
            (mvs.length ? '<div class="ag-grid">' + mvs.map(function (m) {
              return '<div class="ag-card"><div class="ag-cover">' + coverInner({ cover_image: m.cover_url, name_en: m.title, cover_focal_x: m.cover_focal_x, cover_focal_y: m.cover_focal_y }, false) +
                '</div><div class="ag-meta"><div class="ag-name">' + esc(m.title || "Untitled") + '</div>' +
                (m.role_name ? '<div class="ag-sub">饰 ' + esc(m.role_name) + '</div>' : "") + '</div></div>';
            }).join("") + '</div>' : '<div class="ag-empty">这位演员还没有出演作品 — 点上方按钮让 TA 首次登场。</div>') +
          '</div>' +
          (rel.length ? '<div class="ag-sec"><h3>同世界其他演员</h3><div class="ag-grid">' +
            rel.map(function (r2) { return actorCard(r2); }).join("") + '</div></div>' : "") +
          '</div>';
        scroll.innerHTML = html;
        scroll.querySelector(".ag-back").onclick = function () { renderGrid(); };
        var castBtn = scroll.querySelector(".ag-cast");
        if (castBtn) castBtn.onclick = function () { openCast(a); };
      })
      .catch(function () { scroll.innerHTML = '<div class="ag-empty">加载失败。</div>'; });
  }

  function close() {
    var el = document.getElementById(ROOT_ID);
    if (el) el.remove();
  }

  function open(force) {
    ensureStyle();
    var existing = document.getElementById(ROOT_ID);
    if (existing && !force) return;
    if (existing) existing.remove();
    var el = document.createElement("div");
    el.id = ROOT_ID;
    el.innerHTML =
      '<div class="ag-bar">' +
        '<div class="ag-title">🎭 数字<b>演员</b> · Digital Actors</div>' +
        '<div class="ag-spacer"></div>' +
        '<input class="ag-search" type="search" placeholder="搜索演员 / 文明 / 风格…">' +
        '<button class="ag-x" aria-label="close">×</button>' +
      '</div>' +
      '<div class="ag-filters">' +
        '<button class="ag-chip on" data-f="all">全部</button>' +
        '<button class="ag-chip" data-f="synthetic">✨ 原创合成</button>' +
        '<button class="ag-chip" data-f="civilization">🏛 文明名角</button>' +
        '<button class="ag-chip" data-f="premium">💎 溢价</button>' +
      '</div>' +
      '<div class="ag-scroll"></div>';
    document.body.appendChild(el);
    el.querySelector(".ag-x").onclick = close;
    el.querySelectorAll(".ag-chip").forEach(function (c) {
      c.onclick = function () {
        state.filter = c.getAttribute("data-f");
        el.querySelectorAll(".ag-chip").forEach(function (x) { x.classList.toggle("on", x === c); });
        renderGrid();
      };
    });
    var si = el.querySelector(".ag-search");
    si.oninput = function () { state.search = si.value.trim(); renderGrid(); };
    el.querySelector(".ag-scroll").addEventListener("click", function (e) {
      var card = e.target.closest && e.target.closest(".ag-card[data-actor]");
      if (card) renderDetail(card.getAttribute("data-actor"));
    });
    document.addEventListener("keydown", function onKey(ev) {
      if (ev.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
    });
    loadActors();
  }

  window.cssosOpenActorGallery = open;
  // hash 触发(#actors)。
  function checkHash() { if ((location.hash || "").replace(/^#/, "") === "actors") open(); }
  window.addEventListener("hashchange", checkHash);
  if (document.readyState !== "loading") checkHash();
  else window.addEventListener("DOMContentLoaded", checkHash);
})();
