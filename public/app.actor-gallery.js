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
      "#" + ROOT_ID + " .ag-showcase{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}" +
      "#" + ROOT_ID + " .ag-sc-btn{background:rgba(0,245,160,.1);border:1px solid rgba(0,245,160,.35);color:#d6ffee;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:700;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-sc-btn:hover{background:rgba(0,245,160,.2);}" +
      "#" + ROOT_ID + " .ag-sc-btn.playing{background:" + GREEN + ";color:" + INK + ";}" +
      "#" + ROOT_ID + " .ag-stage{min-height:44px;margin-top:14px;font-size:26px;font-weight:800;line-height:1.35;letter-spacing:.5px;}" +
      "#" + ROOT_ID + " .ag-stage .tk{color:rgba(255,255,255,.28);transition:color .08s,text-shadow .08s;}" +
      "#" + ROOT_ID + " .ag-stage .tk.on{color:" + GREEN + ";text-shadow:0 0 16px rgba(0,245,160,.7);}" +
      "#" + ROOT_ID + " .ag-trans{font-size:16px;font-weight:500;color:rgba(207,238,224,.72);margin-top:8px;font-style:italic;}" +
      "#" + ROOT_ID + " .ag-sec{margin-top:30px;}" +
      "#" + ROOT_ID + " .ag-sec h3{font-size:16px;color:" + GREEN + ";margin:0 0 12px;}" +
      "#" + ROOT_ID + " .ag-empty{color:rgba(207,238,224,.55);font-size:14px;padding:8px 0;}";
    document.head.appendChild(st);
  }

  var state = { filter: "all", search: "", actors: [], rows: 1 };

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

  function colsFor(scroll) {
    // 网格 minmax(210px) + gap 18 → 估算每行列数(与 CSS 同步)。
    var w = (scroll && scroll.clientWidth) || 800;
    return Math.max(1, Math.floor((w + 18) / (210 + 18)));
  }
  function renderGrid() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (!scroll) return;
    var list = applyFilter(state.actors);
    if (!list.length) { scroll.innerHTML = '<div class="ag-empty">' + (state.actors.length ? "没有匹配的演员。" : "暂无演员。") + '</div>'; return; }
    // 默认显示一行, 点「加载更多一行」逐行追加。
    var cols = colsFor(scroll);
    var show = Math.min(list.length, Math.max(cols, state.rows * cols));
    var more = list.length - show;
    scroll.innerHTML =
      '<div class="ag-grid">' + list.slice(0, show).map(actorCard).join("") + '</div>' +
      (more > 0 ? '<div style="text-align:center;margin-top:20px;"><button class="ag-chip ag-more">加载更多一行 ▾（还有 ' + more + ' 位）</button></div>' : "");
    var mb = scroll.querySelector(".ag-more");
    if (mb) mb.onclick = function () { state.rows += 1; renderGrid(); };
  }
  function resetRows() { state.rows = 1; }

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
    // C 选角注入: 记下待选角演员 → fetch 拦截器把 actor_id 注入生成/建档调用, 后端注入锁定形象+记选角。
    window.__cssosCastActorId = actor.actor_id;
    window.__cssosCastActorName = name;
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

  /* C 选角注入拦截器: 待选角期间, 给生成/建档调用体注入 actor_id → 后端把演员锁定形象
   * 注入封面/视频 + 记 actor_castings。work 建档成功后清掉待选角(避免泄漏到无关创作)。 */
  (function installCastInterceptor() {
    if (window.__cssosActorFetchPatched) return;
    window.__cssosActorFetchPatched = true;
    var INJECT = /\/api\/mv\/(cover|video|lyrics)\b/;
    var CREATE = /\/api\/works(\?|$)/;
    var orig = window.fetch;
    window.fetch = function (input, init) {
      try {
        var aid = window.__cssosCastActorId;
        if (aid && init && typeof init.body === "string") {
          var url = (typeof input === "string") ? input : (input && input.url) || "";
          var method = String((init.method || "GET")).toUpperCase();
          var isCreate = CREATE.test(url) && method === "POST";
          if ((INJECT.test(url) || isCreate)) {
            var b = JSON.parse(init.body);
            if (b && typeof b === "object" && !Array.isArray(b)) {
              if (!b.actor_id) b.actor_id = aid;
              if (isCreate) { b.__actorId = aid; }
              init = Object.assign({}, init, { body: JSON.stringify(b) });
              if (isCreate) {
                // 建档完成即视为选角落定, 清待选角。
                var p = orig.call(this, input, init);
                return p.then(function (res) { try { window.__cssosCastActorId = null; } catch (_e) {} return res; });
              }
            }
          }
        }
      } catch (_e) { /* 注入失败不影响原请求 */ }
      return orig.call(this, input, init);
    };
  })();

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
              '<div class="ag-showcase">' +
                '<button class="ag-sc-btn" data-seg="intro">▶ 自我介绍</button>' +
                '<button class="ag-sc-btn" data-seg="hero">😇 正派</button>' +
                '<button class="ag-sc-btn" data-seg="villain">😈 反派</button>' +
              '</div>' +
              '<div class="ag-stage" aria-live="polite"></div>' +
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
        scroll.querySelector(".ag-back").onclick = function () { stopShowcase(); renderGrid(); };
        var castBtn = scroll.querySelector(".ag-cast");
        if (castBtn) castBtn.onclick = function () { openCast(a); };
        wireShowcase(scroll, a.actor_id);
      })
      .catch(function () { scroll.innerHTML = '<div class="ag-empty">加载失败。</div>'; });
  }

  /* ── 开口说话 showcase 播放器 ─────────────────────────────────────── */
  var scAudio = null, scRAF = 0, scCache = {};
  function stopShowcase() {
    if (scAudio) { try { scAudio.pause(); } catch (_e) {} scAudio = null; }
    if (scRAF) { cancelAnimationFrame(scRAF); scRAF = 0; }
    var root = document.getElementById(ROOT_ID);
    if (root) root.querySelectorAll(".ag-sc-btn.playing").forEach(function (b) { b.classList.remove("playing"); });
  }
  function playClip(clip, btn, stage) {
    stopShowcase();
    if (!clip || !clip.voice_url) { stage.textContent = "(此段暂缺)"; return; }
    var toks = (clip.subtitle && clip.subtitle.tokens) || [];
    // 逐字 token span(t_start/t_end 毫秒), 播放时按音频时间点亮(卡拉OK)。
    var karaoke = toks.length
      ? toks.map(function (t, i) { return '<span class="tk" data-i="' + i + '">' + esc(t.char) + '</span>'; }).join("")
      : esc(clip.text || "");
    // 非英文母语 → 母语原文下方显示英文翻译。
    stage.innerHTML = '<div class="ag-native">' + karaoke + '</div>' +
      (clip.text_en ? '<div class="ag-trans">' + esc(clip.text_en) + '</div>' : "");
    var spans = stage.querySelectorAll(".tk");
    btn.classList.add("playing");
    scAudio = new Audio(clip.voice_url);
    scAudio.play().catch(function () { stage.textContent = "▶ 点一下允许播放声音"; });
    function tick() {
      if (!scAudio) return;
      var ms = scAudio.currentTime * 1000;
      for (var i = 0; i < spans.length; i++) {
        var t = toks[i]; if (!t) continue;
        spans[i].classList.toggle("on", ms >= t.t_start - 40);
      }
      scRAF = requestAnimationFrame(tick);
    }
    scRAF = requestAnimationFrame(tick);
    scAudio.onended = function () { btn.classList.remove("playing"); if (scRAF) cancelAnimationFrame(scRAF); };
  }
  function wireShowcase(scroll, actorId) {
    var stage = scroll.querySelector(".ag-stage");
    var btns = scroll.querySelectorAll(".ag-sc-btn");
    btns.forEach(function (btn) {
      btn.onclick = function () {
        var seg = btn.getAttribute("data-seg");
        function go(sc) {
          var clips = (sc && sc.clips) || {};
          playClip(clips[seg], btn, stage);
        }
        if (scCache[actorId]) { go(scCache[actorId]); return; }
        stage.textContent = "⏳ 演员正在准备台词…(首次约 10-20 秒)";
        btns.forEach(function (b) { b.disabled = true; });
        fetch("/api/actors/" + encodeURIComponent(actorId) + "/showcase", { credentials: "include" })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            btns.forEach(function (b) { b.disabled = false; });
            if (j && j.ok && j.data && j.data.showcase) { scCache[actorId] = j.data.showcase; go(j.data.showcase); }
            else { stage.textContent = (j && j.code === "TTS_UNAVAILABLE") ? "语音功能未配置。" : "台词生成失败,请重试。"; }
          })
          .catch(function () { btns.forEach(function (b) { b.disabled = false; }); stage.textContent = "网络错误,请重试。"; });
      };
    });
  }

  function close() {
    stopShowcase();
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
        resetRows(); renderGrid();
      };
    });
    var si = el.querySelector(".ag-search");
    si.oninput = function () { state.search = si.value.trim(); resetRows(); renderGrid(); };
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

  /* ── 永久入口: 🎭 Dock 按钮(照搬 person-mv-open-shim 模式)─────────────── */
  function registerDockAction() {
    try {
      var map = window.__cssosDockActionMap = window.__cssosDockActionMap || {};
      map["actors"] = function () { open(); };
      window.dockActionMap = window.__cssosDockActionMap;
    } catch (_e) {}
  }
  function mountDockItem() {
    var dock = document.querySelector(".dock") || document.querySelector("#dock");
    if (!dock) return false;
    if (dock.querySelector('[data-action="actors"]')) return true;
    var item = document.createElement("button");
    item.className = "dock-item"; item.type = "button";
    item.setAttribute("data-action", "actors");
    item.setAttribute("data-actions", "click");
    item.setAttribute("data-tooltip", "Digital Actors");
    item.setAttribute("aria-label", "Digital Actors");
    item.innerHTML = '<span class="dock-ico" aria-hidden="true">🎭</span><span class="dock-label">Actors</span>';
    // 挂在人物 MV(person-mv)之后, 与文明宇宙相邻。
    var ref = dock.querySelector('[data-action="person-mv"], [data-action="cssmv"], [data-action="watch"]');
    if (ref && ref.nextSibling) dock.insertBefore(item, ref.nextSibling); else dock.appendChild(item);
    item.addEventListener("click", function () { open(); });   // 直连兜底(dock 分发未接管时也能开)
    return true;
  }
  function ensureDockItem(retries) {
    if (mountDockItem()) return;
    if (retries <= 0) return;
    setTimeout(function () { ensureDockItem(retries - 1); }, 400);
  }
  registerDockAction();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { ensureDockItem(20); });
  else ensureDockItem(20);
  // dock 若重渲染把按钮抹掉 → 观察补回(防御式, 同其他模块做法)。
  try {
    var mo = new MutationObserver(function () { mountDockItem(); });
    var dockEl = document.querySelector(".dock") || document.querySelector("#dock");
    if (dockEl) mo.observe(dockEl, { childList: true });
  } catch (_e) {}
})();
