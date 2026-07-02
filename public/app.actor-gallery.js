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
  // i18n: 走平台 loginCopy(默认英文), 无则英文兜底(绝不硬编码中文, 见平台 i18n 铁律)。
  var T = function (en, zh) { try { return (typeof window.loginCopy === "function") ? window.loginCopy(en, zh) : en; } catch (_e) { return en; } };
  // 懒加载 <model-viewer>(Google 官方 web component, 交互旋转 GLB)。
  var mvLoaded = false;
  function ensureModelViewer(cb) {
    if (mvLoaded || window.customElements && customElements.get("model-viewer")) { mvLoaded = true; return cb && cb(); }
    var s = document.createElement("script"); s.type = "module";
    s.src = "/vendor/model-viewer.min.js";   // 自托管(同源, 避 CSP 拦外链)
    s.onload = function () { mvLoaded = true; cb && cb(); };
    s.onerror = function () { cb && cb(); };
    document.head.appendChild(s);
  }

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
      /* 5 个筛选=一条胶囊轨道(不断行, 窄屏可横滑), 激活凸绿, 胶囊宪法 */
      "#" + ROOT_ID + " .ag-filters{display:flex;gap:8px;padding:14px 26px 4px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}" +
      "#" + ROOT_ID + " .ag-filters::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-chip{flex:0 0 auto;white-space:nowrap;background:rgba(255,255,255,.08);border:1px solid rgba(0,245,160,.22);color:#cfeee0;border-radius:999px;padding:8px 16px;font-size:14px;font-weight:600;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-chip.on{background:" + GREEN + ";color:" + INK + ";border-color:" + GREEN + ";box-shadow:0 0 14px rgba(0,245,160,.4);}" +
      /* 平台胶囊接管时: 去本地 chip 底色; 强制色调宪法(全绿 --ph:155, 激活深墨字, 未激活浅绿字可读) */
      "#" + ROOT_ID + " .ag-pillbar .ag-chip,#" + ROOT_ID + " .ag-pillbar .ag-sc-btn{background:transparent;border:none;box-shadow:none;}" +
      "#" + ROOT_ID + " .ag-pillbar [data-pill-key]{--ph:155 !important;--pill-hue:155 !important;color:#bff5e0 !important;font-weight:700;}" +
      "#" + ROOT_ID + " .ag-pillbar [data-pill-key].active{color:" + INK + " !important;}" +
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
      "#" + ROOT_ID + " .ag-form{max-width:560px;display:flex;flex-direction:column;gap:14px;}" +
      "#" + ROOT_ID + " .ag-form label{display:flex;flex-direction:column;gap:6px;font-size:14px;color:rgba(207,238,224,.85);}" +
      "#" + ROOT_ID + " .ag-in{background:rgba(0,245,160,.07);border:1px solid rgba(0,245,160,.3);color:#e8fff5;border-radius:12px;padding:10px 14px;font-size:15px;font-family:inherit;outline:none;}" +
      /* 就地展开 = 同一个框: 展开的卡横跨整行, 封面变大(显 3D/视频), 详情接着信息往下排 */
      "#" + ROOT_ID + " .ag-card.expanded{grid-column:1/-1;border-color:" + GREEN + ";box-shadow:0 0 26px rgba(0,245,160,.4);}" +
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover{aspect-ratio:auto;height:min(58vh,420px);cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover .ag-mv-wrap,#" + ROOT_ID + " .ag-card.expanded .ag-cover model-viewer{width:100%;height:100%;}" +
      "#" + ROOT_ID + " .ag-inline{animation:agfade .22s ease;}" +
      "@keyframes agfade{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}" +
      "#" + ROOT_ID + " .ag-sub-grid{margin-top:4px;}" +
      /* 创建+搜索 = 一个胶囊(两头圆, 共用轮廓): Create 绿填充左段, 搜索透明右段 */
      "#" + ROOT_ID + " .ag-searchcap{display:flex;align-items:stretch;height:46px;border:1px solid rgba(0,245,160,.4);border-radius:999px;overflow:hidden;background:rgba(0,245,160,.06);box-shadow:0 0 14px rgba(0,245,160,.18);}" +
      "#" + ROOT_ID + " .ag-searchcap .ag-create{border:none;background:" + GREEN + ";color:" + INK + ";font-weight:800;padding:0 22px;white-space:nowrap;border-radius:999px 0 0 999px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-searchcap .ag-search{border:none;background:transparent;color:#e8fff5;min-width:150px;padding:0 18px;border-radius:0 999px 999px 0;outline:none;font-size:15px;}" +
      "#" + ROOT_ID + " .ag-3d{margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-ar{display:inline-block;text-decoration:none;}" +
      "#" + ROOT_ID + " .ag-owner{display:flex;gap:10px;margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-del{background:rgba(255,80,80,.15);border:1px solid rgba(255,80,80,.5);color:#ffb3b3;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:600;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-empty{color:rgba(207,238,224,.55);font-size:14px;padding:8px 0;}";
    document.head.appendChild(st);
  }

  var state = { filter: "all", search: "", actors: [], rows: 1, ownedSet: {} };

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
      '<div class="ag-cover" data-cover>' + coverInner(a, false) +
        '<div class="ag-badges"><span class="ag-badge">' + originBadge + '</span>' + priceBadge + '</div>' +
      '</div>' +
      '<div class="ag-meta">' +
        '<div class="ag-name">' + esc(a.name_zh || a.name_en) + '</div>' +
        '<div class="ag-sub">' + esc(a.name_en) + (a.civilization ? ' · ' + esc(a.civilization) : "") + '</div>' +
        '<div class="ag-row"><span>' + esc(a.voice_style || a.style_descriptor || "") + '</span></div>' +
        '<div class="ag-inline"></div>' +   // 就地展开: 同一框内接着显示详情(不另开框)
      '</div></div>';
  }

  function applyFilter(list) {
    return list.filter(function (a) {
      if (state.filter === "synthetic" && a.origin_type !== "synthetic") return false;
      if (state.filter === "civilization" && a.origin_type !== "civilization") return false;
      if (state.filter === "premium" && !a.is_premium) return false;
      if (state.filter === "owned" && !state.ownedSet[a.actor_id]) return false;
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
    if (!list.length) { scroll.innerHTML = '<div class="ag-empty">' + esc(state.actors.length ? T("No matching actors.", "没有匹配的演员。") : T("No actors yet.", "暂无演员。")) + '</div>'; return; }
    // 默认显示一行, 点「加载更多一行」逐行追加。
    var cols = colsFor(scroll);
    var show = Math.min(list.length, Math.max(cols, state.rows * cols));
    var more = list.length - show;
    scroll.innerHTML =
      '<div class="ag-grid">' + list.slice(0, show).map(actorCard).join("") + '</div>' +
      (more > 0 ? '<div style="text-align:center;margin-top:20px;"><button class="ag-chip ag-more">' + esc(T("Load one more row", "加载更多一行")) + ' ▾ (' + more + ')</button></div>' : "");
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
    // 我创建的演员 id 集合(供「我的演员」筛选 + 作者控件)。
    fetch("/api/actors?owned=1&limit=100", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var set = {}; ((j && j.data && j.data.actors) || []).forEach(function (a) { set[a.actor_id] = true; });
        state.ownedSet = set;
      }).catch(function () {});
  }

  function renderCreateForm() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (!scroll) return;
    scroll.innerHTML = '<div class="ag-detail">' +
      '<button class="ag-back">‹ ' + esc(T("Back", "返回")) + '</button>' +
      '<div class="ag-hero-name" style="margin-bottom:6px">' + esc(T("Create your digital actor", "创建你的数字演员")) + '</div>' +
      '<div class="ag-sub" style="margin-bottom:16px">' + esc(T("Describe the look in words — we generate an original synthetic face (no real-person photos). Others can cast your actor for a fee and you earn 70% royalty.", "用文字描述外貌气质,我们生成一张【原创合成脸】(不上传真人照片)。你的演员可被他人付费选用,你拿 70% 版税。")) + '</div>' +
      '<div class="ag-form">' +
        '<label>' + esc(T("Stage name *", "艺名 *")) + '<input class="ag-in" data-k="name_en" maxlength="60" placeholder="Nova Sky" /></label>' +
        '<label>' + esc(T("Appearance / vibe description *", "外貌 / 气质描述 *")) + '<textarea class="ag-in" data-k="description" maxlength="600" rows="3" placeholder="' + esc(T("e.g. a silver-haired violet-eyed futuristic diva, cold and mysterious", "如: 银发碧眼的未来感歌姬,冷冽而神秘")) + '"></textarea></label>' +
        '<label>' + esc(T("Voice gender", "声线性别")) + '<select class="ag-in" data-k="gender"><option value="female">' + esc(T("Female", "女声")) + '</option><option value="male">' + esc(T("Male", "男声")) + '</option><option value="neutral">' + esc(T("Neutral", "中性")) + '</option></select></label>' +
        '<label>' + esc(T("Style", "风格")) + '<input class="ag-in" data-k="style_descriptor" maxlength="120" placeholder="synthwave" /></label>' +
        '<label>' + esc(T("Cast price (¢, 0=free; you earn 70%)", "选角价(¢, 0=免费; 你得 70%)")) + '<input class="ag-in" data-k="cast_price_cents" type="number" min="0" max="500" value="0" /></label>' +
        '<button class="ag-cast ag-submit">✨ ' + esc(T("Generate & publish", "生成并发布演员")) + '</button>' +
        '<div class="ag-form-msg ag-empty"></div>' +
      '</div></div>';
    scroll.querySelector(".ag-back").onclick = function () { renderGrid(); };
    var submit = scroll.querySelector(".ag-submit");
    var msg = scroll.querySelector(".ag-form-msg");
    submit.onclick = function () {
      var payload = {};
      scroll.querySelectorAll(".ag-in").forEach(function (el) { payload[el.getAttribute("data-k")] = el.value; });
      if (!payload.name_en || String(payload.name_en).trim().length < 2) { msg.textContent = T("Please enter a stage name.", "请填艺名。"); return; }
      if (!payload.description || String(payload.description).trim().length < 10) { msg.textContent = T("Description too short (≥10 chars).", "描述太短(≥10 字)。"); return; }
      submit.disabled = true; msg.textContent = "⏳ " + T("Generating the actor's face… (~10-20s)", "正在生成演员的脸…(约 10-20 秒)");
      fetch("/api/actors", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          submit.disabled = false;
          if (j && j.ok) {
            state.ownedSet[j.actor_id] = true;
            // 静默刷新演员列表(让新演员出现在图鉴), 不打断详情展示。
            fetch("/api/actors?limit=500", { credentials: "include" }).then(function (r) { return r.json(); })
              .then(function (jj) { state.actors = (jj && jj.data && jj.data.actors) || state.actors; }).catch(function () {});
            renderDetail(j.actor_id);
          }
          else { msg.textContent = (j && j.hint) || "创建失败,请重试。"; }
        })
        .catch(function () { submit.disabled = false; msg.textContent = "网络错误,请重试。"; });
    };
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

  // 点卡片 → 在【同一个框内】接着展开(不另开框, 不重复标题): 详情填进卡片的 .ag-inline。
  function toggleExpand(cardEl) {
    stopShowcase();
    var id = cardEl.getAttribute("data-actor");
    var grid = cardEl.parentElement;
    var wasThis = cardEl.classList.contains("expanded");
    // 先收起所有(含把封面切回 2D)。
    grid.querySelectorAll(".ag-card.expanded").forEach(function (c) {
      c.classList.remove("expanded");
      var inl = c.querySelector(".ag-inline"); if (inl) inl.innerHTML = "";
      restoreCover2D(c);
    });
    if (wasThis) return;   // 再点一次 = 收起
    cardEl.classList.add("expanded");
    var inline = cardEl.querySelector(".ag-inline");
    inline.innerHTML = '<div class="ag-skel" style="height:120px;margin-top:10px"></div>';
    cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    fillExpand(cardEl, id);
  }
  function restoreCover2D(cardEl) {
    var cov = cardEl.querySelector("[data-cover]");
    if (cov && cov.__cover2d != null) { cov.innerHTML = cov.__cover2d; cov.__cover2d = null; }
  }
  function fillExpand(cardEl, id) {
    var inline = cardEl.querySelector(".ag-inline");
    fetch("/api/actors/" + encodeURIComponent(id) + "/codex", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var d = (j && j.data) || {}, a = d.actor;
        if (!a) { inline.innerHTML = '<div class="ag-empty">' + esc(T("Actor not found.", "未找到该演员。")) + '</div>'; return; }
        var tags = [].concat(a.appearance_tags || [], a.tags || []).filter(Boolean).slice(0, 8);
        var mvs = d.mvs || [];
        // 详情【接着上一行】显示在同一框里, 不重复姓名/风格。
        inline.innerHTML =
          '<div class="ag-sub" style="margin-top:8px">' + (a.origin_type === "civilization" ? "🏛 " + esc(T("Legend", "文明演员")) : "✨ " + esc(T("Original", "原创合成"))) +
            (a.is_premium ? ' · 💎 ' + cents(a.cast_price_cents) : " · " + esc(T("Free", "免费"))) + ' · ▶ ' + (a.cast_count || 0) + "</div>" +
          (a.persona ? '<div class="ag-persona">' + esc(a.persona) + '</div>' : "") +
          (tags.length ? '<div class="ag-tags">' + tags.map(function (t) { return '<span class="ag-tag">' + esc(t) + '</span>'; }).join("") + '</div>' : "") +
          '<div class="ag-showcase">' +
            '<button class="ag-sc-btn" data-seg="intro">▶ ' + esc(T("Intro", "自我介绍")) + '</button>' +
            '<button class="ag-sc-btn" data-seg="hero">😇 ' + esc(T("Hero", "正派")) + '</button>' +
            '<button class="ag-sc-btn" data-seg="villain">😈 ' + esc(T("Villain", "反派")) + '</button>' +
          '</div>' +
          '<div class="ag-stage" aria-live="polite"></div>' +
          '<button class="ag-cast">🎬 ' + esc(T("Cast in an MV", "选 TA 主演")) + '</button>' +
          (mvs.length ? '<div class="ag-sec"><h3>' + esc(T("Appearances", "出演作品")) + '</h3><div class="ag-grid ag-sub-grid">' +
            mvs.map(function (m) { return '<div class="ag-card"><div class="ag-cover">' + coverInner({ cover_image: m.cover_url, name_en: m.title, cover_focal_x: m.cover_focal_x, cover_focal_y: m.cover_focal_y }, false) +
              '</div><div class="ag-meta"><div class="ag-name">' + esc(m.title || "Untitled") + '</div></div></div>'; }).join("") + '</div></div>' : "");
        // 封面切成 3D(正面旋转), 点封面在 2D↔3D 间切换。
        cardEl.__actor = a;
        showCover3D(cardEl, a);
        var castBtn = inline.querySelector(".ag-cast");
        if (castBtn) castBtn.onclick = function () { openCast(a); };
        wireShowcase(inline, a.actor_id);
        if (state.ownedSet[a.actor_id]) {
          var own = document.createElement("div"); own.className = "ag-owner";
          own.innerHTML = '<span class="ag-tag">🎬 ' + esc(T("Mine", "我的演员")) + ' · ' + esc(T("royalty", "版税")) + ' ' + Math.round((a.creator_royalty || 0.7) * 100) + '%</span><button class="ag-del">' + esc(T("Delete", "删除")) + '</button>';
          inline.appendChild(own);
          own.querySelector(".ag-del").onclick = function () {
            if (!window.confirm(T("Delete this actor? This cannot be undone.", "删除此演员?此操作不可撤销。"))) return;
            fetch("/api/actors/" + encodeURIComponent(a.actor_id), { method: "DELETE", credentials: "include" }).then(function (r) { return r.json(); }).then(function (jj) {
              if (jj && jj.ok) { delete state.ownedSet[a.actor_id]; state.actors = state.actors.filter(function (x) { return x.actor_id !== a.actor_id; }); renderGrid(); }
              else window.alert(T("Delete failed.", "删除失败。"));
            }).catch(function () { window.alert(T("Network error.", "网络错误。")); });
          };
        }
      })
      .catch(function () { inline.innerHTML = '<div class="ag-empty">' + esc(T("Load failed.", "加载失败。")) + '</div>'; });
  }
  // 封面区显示 3D(可切回 2D)。存 2D 原始 HTML 以便切回。
  function showCover3D(cardEl, a) {
    var cov = cardEl.querySelector("[data-cover]");
    if (!cov) return;
    if (cov.__cover2d == null) cov.__cover2d = cov.innerHTML;
    render3D(cov, a);   // render3D 会把 3D/model-viewer 填进这个容器
  }
  window.__agToggleCover = function (cardEl, a) {
    var cov = cardEl.querySelector("[data-cover]");
    if (!cov) return;
    if (cov.querySelector("model-viewer") || cov.querySelector(".ag-mv-wrap")) { restoreCover2D(cardEl); }   // 3D→2D
    else showCover3D(cardEl, a);                                                                              // 2D→3D
  };
  // 兼容: 创建演员成功后仍可"打开"该演员——重渲染网格并展开对应卡。
  function renderDetail(id) {
    renderGrid();
    setTimeout(function () {
      var card = document.querySelector("#" + ROOT_ID + ' .ag-card[data-actor="' + id + '"]');
      if (card) toggleExpand(card);
    }, 60);
  }

  /* ── 开口说话 showcase 播放器 ─────────────────────────────────────── */
  var scAudio = null, scRAF = 0, scCache = {}, sc3dBox = null, sc3dSaved = null;
  function restore3D() {
    // 恢复被会说话视频替换掉的旋转 3D。
    if (sc3dBox && sc3dSaved != null) { sc3dBox.innerHTML = sc3dSaved; }
    sc3dBox = null; sc3dSaved = null;
  }
  function stopShowcase() {
    if (scAudio) { try { scAudio.pause(); } catch (_e) {} scAudio = null; }
    if (scRAF) { cancelAnimationFrame(scRAF); scRAF = 0; }
    restore3D();
    var root = document.getElementById(ROOT_ID);
    if (root) root.querySelectorAll(".ag-sc-btn.playing").forEach(function (b) { b.classList.remove("playing"); });
  }
  function playClip(clip, btn, stage) {
    stopShowcase();
    if (!clip || !clip.voice_url) { stage.textContent = T("(missing)", "(此段暂缺)"); return; }
    var toks = (clip.subtitle && clip.subtitle.tokens) || [];
    var karaoke = toks.length
      ? toks.map(function (t, i) { return '<span class="tk" data-i="' + i + '">' + esc(t.char) + '</span>'; }).join("")
      : esc(clip.text || "");
    // 字幕(母语+英文)固定在 stage; 会说话视频【就地替换主视觉区的旋转 3D】—— 演员在原位可动可说话。
    stage.innerHTML = '<div class="ag-native">' + karaoke + '</div>' +
      (clip.text_en ? '<div class="ag-trans">' + esc(clip.text_en) + '</div>' : "");
    var spans = stage.querySelectorAll(".tk");
    btn.classList.add("playing");
    var timeSrc;
    var card = stage.closest && stage.closest(".ag-card");
    var box3d = clip.video_url && card ? card.querySelector("[data-cover]") : null;
    if (clip.video_url && box3d) {
      sc3dBox = box3d; sc3dSaved = box3d.innerHTML;   // 存旋转3D以便播完恢复
      box3d.innerHTML = '<video class="ag-talkvid" playsinline autoplay src="' + esc(clip.video_url) + '" style="width:100%;height:100%;object-fit:cover;display:block;"></video>';
      var v = box3d.querySelector(".ag-talkvid"); scAudio = v;
      v.play().catch(function () {});
      timeSrc = function () { return v.currentTime; };
      v.onended = function () { btn.classList.remove("playing"); if (scRAF) cancelAnimationFrame(scRAF); restore3D(); };
    } else if (clip.video_url) {
      // 无 3D 框(如子网格)→ 视频放 stage。
      stage.insertAdjacentHTML("afterbegin", '<video class="ag-talkvid" playsinline autoplay src="' + esc(clip.video_url) + '" style="width:100%;max-width:340px;border-radius:14px;display:block;margin-bottom:10px;border:1px solid rgba(0,245,160,.4);"></video>');
      var v2 = stage.querySelector(".ag-talkvid"); scAudio = v2; v2.play().catch(function () {});
      timeSrc = function () { return v2.currentTime; };
      v2.onended = function () { btn.classList.remove("playing"); if (scRAF) cancelAnimationFrame(scRAF); };
    } else {
      scAudio = new Audio(clip.voice_url);
      scAudio.play().catch(function () { stage.insertAdjacentHTML("beforeend", '<div class="ag-empty">▶ ' + esc(T("Tap to allow sound", "点一下允许播放声音")) + '</div>'); });
      timeSrc = function () { return scAudio ? scAudio.currentTime : 0; };
      scAudio.onended = function () { btn.classList.remove("playing"); if (scRAF) cancelAnimationFrame(scRAF); };
    }
    function tick() {
      if (!scAudio) return;
      var ms = timeSrc() * 1000;
      for (var i = 0; i < spans.length; i++) { var t = toks[i]; if (!t) continue; spans[i].classList.toggle("on", ms >= t.t_start - 40); }
      scRAF = requestAnimationFrame(tick);
    }
    scRAF = requestAnimationFrame(tick);
  }
  // 点「自我介绍/正派/反派」= 数字演员【开口说话的视频】直接播放; 无视频则先生成(懒), 无语音则先生成语音。
  function wireShowcase(scroll, actorId) {
    var stage = scroll.querySelector(".ag-stage");
    var segBtns = scroll.querySelectorAll(".ag-sc-btn[data-seg]");
    function busy(on) { segBtns.forEach(function (b) { b.disabled = on; }); }
    function playSeg(btn, seg) {
      var sc = scCache[actorId], clip = sc && sc.clips && sc.clips[seg];
      // 有会说话视频→就地开口演; 否则播【真人声 + 旋转 3D】(海选体验)。
      // 不再每点必烧对口型视频(omnihuman 不稳/贵): 视频=已生成缓存才播, 生成由作者/管理员显式触发。
      if (clip) playClip(clip, btn, stage);
      else stage.textContent = T("(missing)", "(此段暂缺)");
    }
    function trigger(btn, seg) {
      if (scCache[actorId]) { playSeg(btn, seg); return; }
      stage.textContent = "⏳ " + T("The actor is preparing…", "演员正在准备…");
      busy(true);
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/showcase", { credentials: "include" })
        .then(function (r) { return r.json(); }).then(function (j) {
          busy(false);
          if (j && j.ok && j.data && j.data.showcase) { scCache[actorId] = j.data.showcase; playSeg(btn, seg); }
          else { stage.textContent = (j && j.code === "TTS_UNAVAILABLE") ? T("Voice feature not configured.", "语音功能未配置。") : T("Failed, retry.", "生成失败,请重试。"); }
        })
        .catch(function () { busy(false); stage.textContent = T("Network error, retry.", "网络错误,请重试。"); });
    }
    // Intro/Hero/Villain 也套胶囊(凹凸镶嵌绿); pill-bar 接管点击 → 触发对应段。
    var showcaseBar = scroll.querySelector(".ag-showcase");
    segBtns.forEach(function (b) { b.setAttribute("data-pill-key", b.getAttribute("data-seg")); });
    if (showcaseBar && typeof window.cssosMakePillBar === "function") {
      showcaseBar.classList.add("ag-pillbar");
      window.cssosMakePillBar(showcaseBar, { mono: true, compact: true, textColor: "dark", onActivate: function (key, pill) { trigger(pill, key); } });
    } else {
      segBtns.forEach(function (btn) { btn.onclick = function () { trigger(btn, btn.getAttribute("data-seg")); }; });
    }
  }

  /* 3D 头像: 有 model_3d_url → AR Quick Look「在 AR 中查看」(iPhone/iPad/Vision Pro);
   * 作者/无模型 → 「生成 3D 头像(免费)」按钮。 */
  function render3D(scroll, a) {
    // box = 传入元素本身若是封面容器(data-cover), 否则找 .ag-3d 子。
    var box = (scroll.hasAttribute && scroll.hasAttribute("data-cover")) ? scroll : (scroll.querySelector ? scroll.querySelector(".ag-3d") : null);
    if (!box) return;
    var inCover = box.hasAttribute && box.hasAttribute("data-cover");
    var owned = state.ownedSet[a.actor_id];
    var url = a.model_3d_url || "";
    if (url && /\.glb($|\?)/i.test(url)) {
      // GLB → 正面朝前、自动旋转、可拖拽的 3D(像《时间帝国》预告页)。iOS AR 用同名 .usdz。
      var usdz = url.replace(/\.glb($|\?)/i, ".usdz$1");
      box.innerHTML = '<div class="ag-mv-wrap"></div>';
      var mvStyle = inCover
        ? "width:100%;height:100%;background:radial-gradient(circle at 50% 42%,rgba(0,245,160,.12),transparent 68%);"
        : "width:100%;max-width:340px;height:340px;background:radial-gradient(circle at 50% 42%,rgba(0,245,160,.12),transparent 68%);border:1px solid rgba(0,245,160,.35);border-radius:16px;";
      ensureModelViewer(function () {
        var wrap = box.querySelector(".ag-mv-wrap"); if (!wrap) return;
        wrap.innerHTML = '<model-viewer src="' + esc(url) + '" ios-src="' + esc(usdz) + '" poster="' + esc(a.cover_image || "") + '" ' +
          'camera-controls touch-action="pan-y" auto-rotate auto-rotate-delay="0" rotation-per-second="24deg" ' +
          'camera-orbit="0deg 82deg 100%" min-camera-orbit="auto 55deg auto" max-camera-orbit="auto 105deg auto" field-of-view="30deg" ' +
          'interaction-prompt="none" ar ar-modes="quick-look webxr" environment-image="neutral" exposure="1.15" shadow-intensity="0.35" ' +
          'style="' + mvStyle + '"></model-viewer>';
      });
    } else if (url) {
      // 旧 USDZ(无 GLB): AR Quick Look 兜底(仅 Apple)。
      box.innerHTML = '<a class="ag-sc-btn ag-ar" rel="ar" href="' + esc(url) + '">🧊 ' + esc(T("View in AR", "在 AR 中查看")) + '<img src="' + esc(a.cover_image || "") + '" style="display:none"></a>';
    } else if (owned) {
      box.innerHTML = '<button class="ag-sc-btn ag-gen3d">🧊 ' + esc(T("Generate 3D head (free)", "生成 3D 头像（免费）")) + '</button><div class="ag-empty ag-3d-msg" style="font-size:12px"></div>';
      var btn = box.querySelector(".ag-gen3d"), msg = box.querySelector(".ag-3d-msg");
      btn.onclick = function () {
        btn.disabled = true; msg.textContent = "⏳ " + T("Turning into 3D… (~20s)", "正在立体化…(约 20 秒)");
        fetch("/api/actors/" + encodeURIComponent(a.actor_id) + "/generate-3d", { method: "POST", credentials: "include" })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.ok && j.model_3d_url) { a.model_3d_url = j.model_3d_url; render3D(scroll, a); }
            else { btn.disabled = false; msg.textContent = (j && j.hint) || T("Failed, please retry.", "生成失败,请重试。"); }
          })
          .catch(function () { btn.disabled = false; msg.textContent = T("Network error, retry.", "网络错误,请重试。"); });
      };
    } else { box.innerHTML = ""; }
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
        '<div class="ag-title">🎭 <b>' + esc(T("Digital Actors", "数字演员")) + '</b></div>' +
        '<div class="ag-spacer"></div>' +
        '<div class="ag-searchcap">' +
          '<button class="ag-create">＋ ' + esc(T("Create", "创建演员")) + '</button>' +
          '<input class="ag-search" type="search" placeholder="' + esc(T("Search actors…", "搜索演员 / 文明 / 风格…")) + '">' +
        '</div>' +
        '<button class="ag-x" aria-label="close">×</button>' +
      '</div>' +
      '<div class="ag-filters" data-pill-bar>' +
        '<button class="ag-chip on" data-f="all">' + esc(T("All", "全部")) + '</button>' +
        '<button class="ag-chip" data-f="synthetic">✨ ' + esc(T("Original", "原创合成")) + '</button>' +
        '<button class="ag-chip" data-f="civilization">🏛 ' + esc(T("Legends", "文明名角")) + '</button>' +
        '<button class="ag-chip" data-f="premium">💎 ' + esc(T("Premium", "溢价")) + '</button>' +
        '<button class="ag-chip" data-f="owned">🎬 ' + esc(T("Mine", "我的演员")) + '</button>' +
      '</div>' +
      '<div class="ag-scroll"></div>';
    document.body.appendChild(el);
    el.querySelector(".ag-x").onclick = close;
    var createBtn = el.querySelector(".ag-create");
    if (createBtn) createBtn.onclick = function () { renderCreateForm(); };
    // 5 个筛选 = 凹凸镶嵌胶囊轨道: 优先用平台 cssosMakePillBar(胶囊宪法), 否则退回普通 chip。
    var filterBar = el.querySelector(".ag-filters");
    el.querySelectorAll(".ag-chip").forEach(function (c) { c.setAttribute("data-pill-key", c.getAttribute("data-f")); });
    function applyFilterKey(key) { state.filter = key; resetRows(); renderGrid(); }
    if (typeof window.cssosMakePillBar === "function") {
      filterBar.classList.add("ag-pillbar");
      window.cssosMakePillBar(filterBar, { mono: true, compact: true, textColor: "dark", activeKey: "all", onActivate: applyFilterKey });
    } else {
      el.querySelectorAll(".ag-chip").forEach(function (c) {
        c.onclick = function () {
          el.querySelectorAll(".ag-chip").forEach(function (x) { x.classList.toggle("on", x === c); });
          applyFilterKey(c.getAttribute("data-f"));
        };
      });
    }
    var si = el.querySelector(".ag-search");
    si.oninput = function () { state.search = si.value.trim(); resetRows(); renderGrid(); };
    el.querySelector(".ag-scroll").addEventListener("click", function (e) {
      var t = e.target;
      // 展开区内的交互元素(台词胶囊/选角/作者/出演子卡/model-viewer)不劫持。
      if (t.closest && (t.closest(".ag-showcase") || t.closest(".ag-cast") || t.closest(".ag-owner") || t.closest(".ag-sub-grid") || t.closest("model-viewer") || t.closest(".ag-stage"))) return;
      var card = t.closest && t.closest(".ag-card[data-actor]");
      if (!card || !card.parentElement || !card.parentElement.classList.contains("ag-grid")) return;
      var onCover = !!(t.closest && t.closest("[data-cover]"));
      if (card.classList.contains("expanded")) {
        if (onCover && card.__actor) window.__agToggleCover(card, card.__actor);   // 封面 2D↔3D 切换
        else toggleExpand(card);                                                   // 点信息区 = 收起
      } else {
        toggleExpand(card);                                                        // 展开(封面转 3D)
      }
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
