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
      // 对称: 所有行(顶部胶囊/两条筛选/卡片区)统一左右内缩 12px; 行间统一 8px(ROOT gap)。
      "#" + ROOT_ID + "{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;gap:8px;background:rgba(2,10,7,.94);backdrop-filter:blur(6px);color:#e8fff5;font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;}" +
      "#" + ROOT_ID + " .ag-bar{display:flex;align-items:center;gap:14px;padding:16px 12px 6px;border-bottom:1px solid rgba(0,245,160,.18);}" +
      "#" + ROOT_ID + " .ag-title{font-size:22px;font-weight:800;letter-spacing:.3px;}" +
      "#" + ROOT_ID + " .ag-title b{color:" + GREEN + ";}" +
      "#" + ROOT_ID + " .ag-spacer{flex:1;}" +
      "#" + ROOT_ID + " .ag-search{background:rgba(0,245,160,.08);border:1px solid rgba(0,245,160,.3);color:#e8fff5;border-radius:999px;padding:8px 16px;font-size:14px;min-width:220px;outline:none;}" +
      "#" + ROOT_ID + " .ag-x{background:rgba(255,255,255,.08);border:none;color:#e8fff5;width:38px;height:38px;border-radius:50%;font-size:20px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-x:hover{background:rgba(255,255,255,.16);}" +
      /* 5 个筛选=一条胶囊轨道(不断行, 窄屏可横滑), 激活凸绿, 胶囊宪法 */
      "#" + ROOT_ID + " .ag-filters{display:flex;gap:8px;padding:0;margin:0 12px !important;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}" +
      "#" + ROOT_ID + " .ag-filters::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-chip{flex:0 0 auto;white-space:nowrap;background:rgba(255,255,255,.08);border:1px solid rgba(0,245,160,.22);color:#cfeee0;border-radius:999px;padding:8px 16px;font-size:14px;font-weight:600;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-chip.on{background:" + GREEN + ";color:" + INK + ";border-color:" + GREEN + ";box-shadow:0 0 14px rgba(0,245,160,.4);}" +
      /* 平台胶囊接管时: 去本地 chip 底色; 强制色调宪法(全绿 --ph:155, 激活深墨字, 未激活浅绿字可读) */
      "#" + ROOT_ID + " .ag-pillbar .ag-chip,#" + ROOT_ID + " .ag-pillbar .ag-sc-btn,#" + ROOT_ID + " .ag-pillbar .ag-capchip{background:transparent;border:none;box-shadow:none;}" +
      "#" + ROOT_ID + " .ag-pillbar [data-pill-key]{--ph:155 !important;--pill-hue:155 !important;color:#bff5e0 !important;font-weight:700;}" +
      "#" + ROOT_ID + " .ag-pillbar [data-pill-key].active{color:" + INK + " !important;}" +
      "#" + ROOT_ID + " .ag-scroll{flex:1;overflow:auto;padding:2px 12px 40px;}" +
      "#" + ROOT_ID + " .ag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px;}" +
      "#" + ROOT_ID + " .ag-card{background:rgba(255,255,255,.04);border:1px solid rgba(0,245,160,.14);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;content-visibility:auto;contain-intrinsic-size:auto 300px;}" +
      "#" + ROOT_ID + " .ag-card.expanded{content-visibility:visible;}" +   // 展开卡强制渲染(别被离屏优化藏了)
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
      "#" + ROOT_ID + " .ag-stats{display:flex;flex-wrap:wrap;gap:8px 18px;margin:10px 0 2px;font-size:13px;color:#9ec3b4;}" +
      "#" + ROOT_ID + " .ag-stats span{display:inline-flex;align-items:center;gap:5px;}" +
      "#" + ROOT_ID + " .ag-stats b{color:#eafff6;font-weight:800;font-variant-numeric:tabular-nums;}" +
      "#" + ROOT_ID + " .ag-cta-cap .ag-cnt{font-weight:800;font-variant-numeric:tabular-nums;opacity:.85;margin-left:3px;}" +
      "#" + ROOT_ID + " .ag-tag{background:rgba(0,245,160,.12);border:1px solid rgba(0,245,160,.3);color:#bff5e0;border-radius:999px;padding:4px 12px;font-size:12px;}" +
      "#" + ROOT_ID + " .ag-persona{color:rgba(232,255,245,.88);margin:10px 0;}" +
      "#" + ROOT_ID + " .ag-cast{background:" + GREEN + ";color:" + INK + ";border:none;border-radius:999px;padding:12px 26px;font-size:16px;font-weight:800;cursor:pointer;margin-top:8px;box-shadow:0 0 20px rgba(0,245,160,.35);}" +
      "#" + ROOT_ID + " .ag-cast:hover{filter:brightness(1.08);}" +
      "#" + ROOT_ID + " .ag-cta-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}" +
      "#" + ROOT_ID + " .ag-share{background:transparent;color:#bff5e0;border:1px solid rgba(0,245,160,.45);border-radius:999px;padding:12px 22px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;}" +
      "#" + ROOT_ID + " .ag-share:hover{background:rgba(0,245,160,.12);}" +
      // 选角/评论/分享 胶囊走平台 cssosMakePillBar(与顶部筛选条同源凹凸镶嵌), 无需本地几何; 仅留上边距。
      "#" + ROOT_ID + " .ag-cta-cap{margin-top:6px;}" +
      // 评论面板
      "#" + ROOT_ID + " .ag-comments{margin-top:16px;border-top:1px solid rgba(0,245,160,.15);padding-top:14px;}" +
      "#" + ROOT_ID + " .ag-comments h3{font-size:15px;font-weight:800;color:#e8fff5;margin:0 0 10px;}" +
      "#" + ROOT_ID + " .ag-cmt-input{display:flex;gap:8px;align-items:flex-end;margin-bottom:14px;}" +
      "#" + ROOT_ID + " .ag-cmt-input textarea{flex:1;background:rgba(4,20,14,.6);border:1px solid rgba(0,245,160,.3);border-radius:14px;color:#e8fff5;padding:10px 12px;font-size:14px;font-family:inherit;resize:vertical;min-height:42px;}" +
      "#" + ROOT_ID + " .ag-cmt-send{background:" + GREEN + ";color:" + INK + ";border:0;border-radius:999px;padding:10px 18px;font-weight:800;font-size:14px;cursor:pointer;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-cmt{padding:10px 0;border-bottom:1px solid rgba(0,245,160,.1);}" +
      "#" + ROOT_ID + " .ag-cmt .who{font-size:12.5px;color:#8fe9c8;font-weight:700;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center;}" +
      "#" + ROOT_ID + " .ag-cmt .body{font-size:14px;color:#dff7ec;line-height:1.45;white-space:pre-wrap;word-break:break-word;}" +
      "#" + ROOT_ID + " .ag-cmt .del{background:none;border:0;color:#ff9a9a;font-size:11px;cursor:pointer;padding:2px 6px;}" +
      "#" + ROOT_ID + " .ag-cmt-empty{font-size:13px;color:#7fb8a3;padding:8px 0;}" +
      "#" + ROOT_ID + " .ag-cmt-actions{display:flex;gap:10px;align-items:center;}" +
      "#" + ROOT_ID + " .ag-reply-btn{background:none;border:0;color:#8fe9c8;font-size:11px;cursor:pointer;padding:2px 6px;}" +
      "#" + ROOT_ID + " .ag-cmt-kids{margin-left:16px;border-left:2px solid rgba(0,245,160,.16);padding-left:12px;margin-top:6px;}" +
      "#" + ROOT_ID + " .ag-reply-box{display:flex;gap:8px;align-items:flex-end;margin:8px 0;}" +
      "#" + ROOT_ID + " .ag-reply-box textarea{flex:1;background:rgba(4,20,14,.6);border:1px solid rgba(0,245,160,.3);border-radius:12px;color:#e8fff5;padding:8px 10px;font-size:13px;font-family:inherit;resize:vertical;min-height:36px;}" +
      "#" + ROOT_ID + " .ag-reply-send{background:" + GREEN + ";color:" + INK + ";border:0;border-radius:999px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-slogan{font-size:12.5px;color:#8fe9c8;font-style:italic;margin:3px 0;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
      "#" + ROOT_ID + " .ag-castmodal{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(2,10,7,.72);backdrop-filter:blur(3px);}" +
      "#" + ROOT_ID + " .ag-castmodal .box{background:#0a1712;border:1px solid rgba(0,245,160,.35);border-radius:20px;padding:22px;max-width:440px;width:88%;box-shadow:0 20px 60px rgba(0,0,0,.5);}" +
      "#" + ROOT_ID + " .ag-castmodal h3{font-size:18px;font-weight:800;margin:0 0 4px;color:#e8fff5;}" +
      "#" + ROOT_ID + " .ag-castmodal .sub{font-size:13px;color:#a9e9cf;margin:0 0 16px;}" +
      // ④ P1 选角面板
      "#" + ROOT_ID + " .ag-cs-box{max-width:520px;max-height:86vh;overflow:auto;}" +
      "#" + ROOT_ID + " .ag-cs-slots{display:flex;flex-direction:column;gap:12px;}" +
      "#" + ROOT_ID + " .ag-cs-slot{border:1px solid rgba(0,245,160,.22);border-radius:14px;padding:10px 12px;background:rgba(0,245,160,.04);}" +
      "#" + ROOT_ID + " .ag-cs-role{font-size:13px;font-weight:800;color:#bff5e0;margin-bottom:8px;}" +
      "#" + ROOT_ID + " .ag-cs-roled{background:rgba(0,245,160,.12);border:1px solid rgba(0,245,160,.4);color:#e8fff5;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;cursor:pointer;outline:none;}" +
      "#" + ROOT_ID + " .ag-cs-lock{font-size:11px;font-weight:600;color:#7fb8a3;margin-left:6px;}" +
      "#" + ROOT_ID + " .ag-cs-pick{display:flex;align-items:center;gap:10px;}" +
      "#" + ROOT_ID + " .ag-cs-pick>img,#" + ROOT_ID + " .ag-cs-empty,#" + ROOT_ID + " .ag-cs-ini{width:46px;height:46px;border-radius:10px;object-fit:cover;flex:0 0 auto;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-weight:800;color:#bff5e0;}" +
      "#" + ROOT_ID + " .ag-cs-info{flex:1 1 auto;min-width:0;}" +
      "#" + ROOT_ID + " .ag-cs-name{font-size:14px;font-weight:700;color:#e8fff5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#" + ROOT_ID + " .ag-cs-sub{font-size:11.5px;color:#8fdcc0;}" +
      "#" + ROOT_ID + " .ag-cs-swap{background:rgba(0,245,160,.1);border:1px solid rgba(0,245,160,.35);color:#bff5e0;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;flex:0 0 auto;}" +
      "#" + ROOT_ID + " .ag-cs-pool{display:flex;gap:6px;overflow-x:auto;margin-top:8px;scrollbar-width:none;}" +
      "#" + ROOT_ID + " .ag-cs-pool::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-cs-cand{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:3px;width:56px;background:transparent;border:1px solid transparent;border-radius:10px;padding:4px;cursor:pointer;color:#cfeee0;}" +
      "#" + ROOT_ID + " .ag-cs-cand>img,#" + ROOT_ID + " .ag-cs-cand .ag-cs-ini{width:44px;height:44px;}" +
      "#" + ROOT_ID + " .ag-cs-cand.on{border-color:" + GREEN + ";background:rgba(0,245,160,.12);}" +
      "#" + ROOT_ID + " .ag-cs-cand.used{opacity:.32;cursor:not-allowed;filter:grayscale(.6);}" +
      "#" + ROOT_ID + " .ag-cs-cand span{font-size:10px;max-width:52px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#" + ROOT_ID + " .ag-cs-extras{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0;font-size:13px;font-weight:700;color:#bff5e0;}" +
      "#" + ROOT_ID + " .ag-cs-extrabtns{display:flex;gap:0;}" +
      "#" + ROOT_ID + " .ag-cs-cost{text-align:center;font-size:13px;font-weight:700;color:#bff5e0;margin:10px 0 6px;}" +
      "#" + ROOT_ID + " .ag-cs-go{width:100%;margin-top:4px;}" +
      // ⑤ 导演入口
      "#" + ROOT_ID + " .ag-director .ag-dg-box{max-width:540px;max-height:88vh;overflow:auto;}" +
      "#" + ROOT_ID + " .ag-dg-fmts{display:flex;gap:0;overflow-x:auto;scrollbar-width:none;margin:4px 0 14px;}" +
      "#" + ROOT_ID + " .ag-dg-fmts::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-dg-fmt{flex:0 0 auto;white-space:nowrap;background:rgba(0,245,160,.08);border:1px solid rgba(0,245,160,.25);color:#d6ffee;border-radius:999px;padding:8px 15px;font-size:13px;font-weight:700;cursor:pointer;margin-right:6px;}" +
      "#" + ROOT_ID + " .ag-dg-fmt.on{background:" + GREEN + ";color:" + INK + ";}" +
      "#" + ROOT_ID + " .ag-dg-civs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}" +
      "#" + ROOT_ID + " .ag-dg-civ{background:rgba(0,245,160,.06);border:1px solid rgba(0,245,160,.22);color:#cfeee0;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-dg-civ.on{background:rgba(0,245,160,.85);color:" + INK + ";border-color:transparent;}" +
      "#" + ROOT_ID + " .ag-dg-style{width:100%;box-sizing:border-box;margin:0 0 12px;}" +
      "#" + ROOT_ID + " .ag-dg-title{width:100%;box-sizing:border-box;margin:0 0 12px;}" +
      "#" + ROOT_ID + " .ag-dg-label{font-size:12.5px;font-weight:700;color:#8fdcc0;margin:0 0 8px;}" +
      "#" + ROOT_ID + " .ag-dg-cast{display:flex;flex-direction:column;gap:8px;margin-bottom:16px;}" +
      "#" + ROOT_ID + " .ag-dg-role{display:flex;align-items:center;gap:8px;font-size:13.5px;color:#e8fff5;}" +
      "#" + ROOT_ID + " .ag-dg-role b{color:#bff5e0;min-width:52px;}" +
      "#" + ROOT_ID + " .ag-dg-actor{display:inline-flex;align-items:center;gap:6px;font-weight:700;}" +
      "#" + ROOT_ID + " .ag-dg-actor img{width:30px;height:30px;border-radius:7px;object-fit:cover;}" +
      "#" + ROOT_ID + " .ag-dg-swap{background:rgba(0,245,160,.1);border:1px solid rgba(0,245,160,.3);border-radius:999px;padding:2px 8px;font-size:11px;cursor:pointer;color:#bff5e0;}" +
      "#" + ROOT_ID + " .ag-dg-row{display:flex;align-items:center;gap:12px;}" +
      "#" + ROOT_ID + " .ag-dg-go{flex:1;}" +
      "#" + ROOT_ID + " .ag-dg-cd{font-size:12.5px;color:#8fdcc0;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-dg-cd b{color:#00f5a0;}" +
      "#" + ROOT_ID + " .ag-dg-pause{background:transparent;border:1px solid rgba(0,245,160,.35);border-radius:999px;padding:2px 8px;cursor:pointer;color:#bff5e0;}" +
      "#" + ROOT_ID + " .ag-direct{background:linear-gradient(120deg,#00f5a0,#0bf7ff);color:#012;border:none;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:800;cursor:pointer;margin-left:12px;box-shadow:0 0 18px rgba(0,245,160,.4);white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-direct:hover{filter:brightness(1.08);}" +
      "#" + ROOT_ID + " .ag-wt{display:grid;grid-template-columns:1fr 1fr;gap:10px;}" +
      "#" + ROOT_ID + " .ag-wt button{display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;background:rgba(0,245,160,.06);border:1px solid rgba(0,245,160,.3);color:#e8fff5;border-radius:14px;padding:12px 14px;cursor:pointer;font-size:14px;font-weight:700;}" +
      "#" + ROOT_ID + " .ag-wt button:hover:not(:disabled){background:rgba(0,245,160,.16);}" +
      "#" + ROOT_ID + " .ag-wt button small{font-size:11px;font-weight:500;color:#8fdcc0;}" +
      "#" + ROOT_ID + " .ag-wt button:disabled{opacity:.5;cursor:default;}" +
      /* 台词胶囊 = 胶囊宪法凹凸镶嵌(照 style.css ~2307-2343): 轨道共用边框零间隙, 激活凸全圆, 其余凹咬合 */
      "#" + ROOT_ID + " .ag-showcase{display:flex;align-items:stretch;height:46px;margin-top:14px;border:1px solid rgba(0,245,160,.35);border-radius:999px;overflow:hidden;background:rgba(0,245,160,.05);}" +
      "#" + ROOT_ID + " .ag-sc-btn{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;border:0;background:transparent;color:#d6ffee;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;position:relative;box-sizing:border-box;}" +
      /* 激活(playing)= 凸: 两头圆全 pill 绿填充 */
      "#" + ROOT_ID + " .ag-showcase .ag-sc-btn.playing{background:" + GREEN + ";color:" + INK + ";border-radius:999px;z-index:2;box-shadow:0 4px 18px rgba(0,0,0,.28);}" +
      /* 激活【右侧】未激活: 凹在左, 咬合激活右圆头 */
      "#" + ROOT_ID + " .ag-showcase .ag-sc-btn.playing ~ .ag-sc-btn{margin-left:-23px;border-radius:0 999px 999px 0;z-index:1;-webkit-mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);}" +
      /* 激活【左侧】未激活: 凹在右 */
      "#" + ROOT_ID + " .ag-showcase .ag-sc-btn:has(~ .ag-sc-btn.playing){margin-right:-23px;border-radius:999px 0 0 999px;z-index:1;-webkit-mask:radial-gradient(circle 23px at 100% 50%,transparent 22.5px,#000 23px);mask:radial-gradient(circle 23px at 100% 50%,transparent 22.5px,#000 23px);}" +
      /* 无激活(默认): 第一段(Intro)凸, 其后凹在左 —— 永远呈一条凹凸镶嵌轨道 */
      "#" + ROOT_ID + " .ag-showcase:not(:has(.playing)) .ag-sc-btn:first-child{background:" + GREEN + ";color:" + INK + ";border-radius:999px;z-index:2;box-shadow:0 4px 18px rgba(0,0,0,.28);}" +
      "#" + ROOT_ID + " .ag-showcase:not(:has(.playing)) .ag-sc-btn:first-child ~ .ag-sc-btn{margin-left:-23px;border-radius:0 999px 999px 0;z-index:1;-webkit-mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);}" +
      "#" + ROOT_ID + " .ag-stage{min-height:44px;margin-top:14px;font-size:26px;font-weight:800;line-height:1.35;letter-spacing:.5px;}" +
      "#" + ROOT_ID + " .ag-native{white-space:pre-wrap;word-break:normal;overflow-wrap:break-word;}" +
      "#" + ROOT_ID + " .ag-stage .tk{color:rgba(255,255,255,.28);transition:color .08s,text-shadow .08s;white-space:pre-wrap;}" +
      "#" + ROOT_ID + " .ag-stage .tk.on{color:" + GREEN + ";text-shadow:0 0 16px rgba(0,245,160,.7);}" +
      "#" + ROOT_ID + " .ag-trans{font-size:16px;font-weight:500;color:rgba(207,238,224,.72);margin-top:8px;font-style:italic;}" +
      "#" + ROOT_ID + " .ag-sec{margin-top:30px;}" +
      "#" + ROOT_ID + " .ag-sec h3{font-size:16px;color:" + GREEN + ";margin:0 0 12px;}" +
      "#" + ROOT_ID + " .ag-form{max-width:560px;display:flex;flex-direction:column;gap:14px;}" +
      "#" + ROOT_ID + " .ag-form label{display:flex;flex-direction:column;gap:6px;font-size:14px;color:rgba(207,238,224,.85);}" +
      "#" + ROOT_ID + " .ag-in{background:rgba(0,245,160,.07);border:1px solid rgba(0,245,160,.3);color:#e8fff5;border-radius:12px;padding:10px 14px;font-size:15px;font-family:inherit;outline:none;}" +
      "#" + ROOT_ID + " .ag-check{display:flex;align-items:center;gap:8px;font-size:14px;color:rgba(207,238,224,.9);cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-consent{background:rgba(0,245,160,.05);border:1px solid rgba(0,245,160,.25);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;}" +
      "#" + ROOT_ID + " .ag-capture{background:rgba(0,0,0,.25);border:1px solid rgba(0,245,160,.2);border-radius:14px;padding:14px;}" +
      "#" + ROOT_ID + " .ag-recbtn{width:100%;max-width:520px;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:8px;height:46px;border:0;border-radius:999px;background:" + GREEN + ";color:" + INK + ";font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.28);}" +
      "#" + ROOT_ID + " .ag-recbtn:disabled{opacity:.5;cursor:default;}" +
      // 倒数/快门 overlay(压在摄像头预览上)
      "#" + ROOT_ID + " .ag-countdown{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:96px;font-weight:900;color:#fff;text-shadow:0 4px 30px rgba(0,0,0,.6);background:rgba(0,0,0,.18);border-radius:14px;pointer-events:none;}" +
      // Vision Pro 式面部对齐圈
      "#" + ROOT_ID + " .ag-facering{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);width:54%;aspect-ratio:3/4;border:2.5px dashed rgba(0,245,160,.55);border-radius:50%;pointer-events:none;display:flex;align-items:flex-end;justify-content:center;transition:border-color .2s,box-shadow .2s;}" +
      "#" + ROOT_ID + " .ag-facering span{transform:translateY(150%);font-size:12px;color:#bff5e0;background:rgba(0,0,0,.45);padding:2px 10px;border-radius:999px;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-facering.aligned{border-style:solid;border-color:" + GREEN + ";box-shadow:0 0 26px rgba(0,245,160,.5);}" +
      "#" + ROOT_ID + " .ag-guide-auto{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#9ec3b4;margin-bottom:10px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-guide-auto input{width:16px;height:16px;accent-color:" + GREEN + ";}" +
      "#" + ROOT_ID + " .ag-guide-thumbs .gthumb .gretake{position:absolute;left:1px;top:1px;background:rgba(0,0,0,.6);color:#bff5e0;border:0;border-radius:7px;font-size:12px;line-height:1;padding:2px 4px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-countdown.flash{background:#fff;color:#fff;}" +
      // 引导采集
      "#" + ROOT_ID + " .ag-guide{max-width:520px;margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-guide-dots{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;}" +
      "#" + ROOT_ID + " .ag-guide-dots .gd{width:100%;flex:1 1 0;min-width:8px;height:5px;border-radius:999px;background:rgba(0,245,160,.18);transition:background .2s;}" +
      "#" + ROOT_ID + " .ag-guide-dots .gd.done{background:" + GREEN + ";}" +
      "#" + ROOT_ID + " .ag-guide-dots .gd.cur{background:rgba(0,245,160,.55);animation:agPulse 1s ease-in-out infinite;}" +
      "@keyframes agPulse{0%,100%{opacity:.55}50%{opacity:1}}" +
      "#" + ROOT_ID + " .ag-guide-prompt{display:flex;align-items:center;gap:12px;min-height:44px;font-size:14px;color:#cfeee0;line-height:1.4;}" +
      "#" + ROOT_ID + " .ag-guide-prompt .gemoji{font-size:38px;line-height:1;flex:0 0 auto;}" +
      "#" + ROOT_ID + " .ag-guide-prompt .glabel b{display:block;font-size:18px;color:#eafff6;font-weight:800;}" +
      "#" + ROOT_ID + " .ag-guide-prompt .glabel em{display:block;font-style:normal;font-size:12.5px;color:#8fe9c8;margin:2px 0 3px;line-height:1.35;}" +
      "#" + ROOT_ID + " .ag-guide-prompt .glabel small{color:#7fb8a3;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;letter-spacing:.06em;}" +
      "#" + ROOT_ID + " .ag-guide-prompt .glabel .gstepc{display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:.06em;color:" + INK + ";background:" + GREEN + ";border-radius:999px;padding:2px 9px;margin-bottom:4px;}" +
      "#" + ROOT_ID + " .ag-guide-thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-guide-thumbs .gthumb{position:relative;width:46px;height:46px;border-radius:9px;overflow:hidden;border:1px solid rgba(0,245,160,.4);}" +
      "#" + ROOT_ID + " .ag-guide-thumbs .gthumb img{width:100%;height:100%;object-fit:cover;display:block;}" +
      "#" + ROOT_ID + " .ag-guide-thumbs .gthumb span{position:absolute;right:1px;bottom:0;font-size:13px;text-shadow:0 1px 3px #000;}" +
      "#" + ROOT_ID + " .ag-guide-thumbs .gthumb.pending{opacity:.5;}" +
      "#" + ROOT_ID + " .ag-recbtn:disabled{background:rgba(0,245,160,.18);color:rgba(207,238,224,.7);box-shadow:none;cursor:default;}" +
      "#" + ROOT_ID + " .ag-recbtn.recording{background:#ff5a6a;color:#fff;}" +
      "#" + ROOT_ID + " .ag-capchip{flex:1 1 0;border:1px solid rgba(0,245,160,.4);background:rgba(0,245,160,.06);color:#d6ffee;font-size:14px;font-weight:700;padding:9px 0;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-archfilters{margin-top:0 !important;}" +   // 两行筛选间距 = 单个 14px(跟上一个间隔等高), 别叠成双倍
      "#" + ROOT_ID + " .ag-rt-label{font-size:13px;color:#a9e9cf;margin:8px 0;font-weight:600;}" +
      // 胶囊轨道铁律: 永远单行可横滑(不 wrap), 不管数量多少 —— 宽/窄屏显示不同。共用边框零间隙轨道(贴紧)。
      // 胶囊宪法 轨道4/5(文明·戏路, 多选): 外层一条 999px 边框轨道, 子胶囊贴满、零缝、激活在前。
      // ★根治: 以前 .ag-arch/.ag-mi 各自带边框(见下方已删)特异性等同却在后 → 覆盖了贴合轨道样式 → 变成散颗带框胶囊。现在文字样式并进轨道子项, 独立带框规则删除。
      "#" + ROOT_ID + " .ag-arch-row,#" + ROOT_ID + " .ag-multi-row{display:flex;flex-wrap:nowrap;gap:3px;align-items:stretch;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:3px;box-sizing:border-box;border:1px solid rgba(0,245,160,.35);border-radius:999px;background:rgba(0,245,160,.05);height:44px;}" +
      "#" + ROOT_ID + " .ag-arch-row::-webkit-scrollbar,#" + ROOT_ID + " .ag-multi-row::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-arch-row>*,#" + ROOT_ID + " .ag-multi-row>*{flex:0 0 auto;border:0;background:transparent;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0 15px;font-size:13px;font-weight:700;color:#d6ffee;white-space:nowrap;cursor:pointer;order:1;}" +
      // 谁激活谁排到最前(active-first, 用 flex order 免重排 DOM); 激活凸绿两头圆贴满轨道高。
      "#" + ROOT_ID + " .ag-arch-row .ag-arch.on,#" + ROOT_ID + " .ag-multi-row .ag-mi.on{order:0;background:" + GREEN + " !important;color:" + INK + " !important;box-shadow:0 2px 10px rgba(0,0,0,.28);}" +
      "#" + ROOT_ID + " .ag-multi{margin:2px 0;}" +
      "#" + ROOT_ID + " .ag-subgroup{margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-subgroup-t{font-size:12px;color:#8fdcc0;margin:0 0 6px;}" +
      "#" + ROOT_ID + " .ag-subrow{display:flex;flex-wrap:wrap;gap:6px;}" +
      "#" + ROOT_ID + " .ag-sub{border:1px solid rgba(0,245,160,.25);background:transparent;color:#bff5e0;font-size:12.5px;padding:5px 11px;border-radius:999px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-sub.on{background:rgba(0,245,160,.85);color:" + INK + ";border-color:transparent;font-weight:700;}" +
      /* 就地展开 = 同一个框: 展开的卡横跨整行, 封面变大(显 3D/视频), 详情接着信息往下排 */
      "#" + ROOT_ID + " .ag-card.expanded{grid-column:1/-1;border-color:" + GREEN + ";box-shadow:0 0 26px rgba(0,245,160,.4);}" +
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover{aspect-ratio:auto;height:min(58vh,420px);cursor:pointer;}" +
      // 「Full cover」态: 满框显整张 —— 宽度铺满不留黑边, 框高随原图比例往下自适应拉高, 完整不裁切(去掉 max-height 上限, 框继续往下长)。
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover.ag-cover-full{display:block !important;height:auto !important;max-height:none !important;overflow:visible !important;}" +
      "#" + ROOT_ID + " .ag-cover.ag-cover-full img{width:100% !important;height:auto !important;max-height:none !important;object-fit:contain !important;display:block !important;}" +
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover .ag-mv-wrap,#" + ROOT_ID + " .ag-card.expanded .ag-cover model-viewer{width:100%;height:100%;}" +
      "#" + ROOT_ID + " .ag-cover{position:relative;}" +
      "#" + ROOT_ID + " .ag-3d-badge{position:absolute;right:12px;bottom:12px;z-index:3;background:rgba(4,18,12,.72);color:#bff5e0;border:1px solid rgba(0,245,160,.5);border-radius:999px;padding:6px 13px;font-size:13px;font-weight:700;cursor:pointer;backdrop-filter:blur(4px);}" +
      "#" + ROOT_ID + " .ag-3d-badge:hover{background:rgba(0,245,160,.9);color:#04120c;}" +
      "#" + ROOT_ID + " .ag-inline{animation:agfade .22s ease;}" +
      "@keyframes agfade{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}" +
      "#" + ROOT_ID + " .ag-sub-grid{margin-top:4px;}" +
      /* 创建+搜索 = 凹凸镶嵌: Create 绿全圆胶囊(右端半圆【凸】)负边距【咬进】搜索框; 搜索框左侧【凹】容纳 */
      // 轨道1(成为演员/创建/搜索, 三段单选)已改走平台 cssosMakePillBar(见 openActorGallery), 由 [data-pill-bar] 统一样式。
      // 这里只留:窄屏时顶部胶囊换行独占一行。
      "@media(max-width:760px){#" + ROOT_ID + " .ag-bar{flex-wrap:wrap;}#" + ROOT_ID + " .ag-topcap{order:3;flex:1 1 100% !important;width:100%;}}" +
      "#" + ROOT_ID + " .ag-3d{margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-ar{display:inline-block;text-decoration:none;}" +
      "#" + ROOT_ID + " .ag-owner{display:flex;gap:10px;margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-del{background:rgba(255,80,80,.15);border:1px solid rgba(255,80,80,.5);color:#ffb3b3;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:600;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-empty{color:rgba(207,238,224,.55);font-size:14px;padding:8px 0;}";
    document.head.appendChild(st);
  }

  var state = { filter: "all", search: "", actors: [], rows: 1, ownedSet: {}, archetype: "" };

  // CSSOS_WAVE_1524 — 大封面(7MB wikimedia 原图)经 /img 缩放代理成网格尺寸 webp,
  // 避免 iOS WKWebView 解码内存爆掉崩溃。只代理白名单 host(与后端一致), 其余原样。
  function imgProxy(u, w) {
    if (!u || /^(data:|blob:)/.test(u)) return u;
    try {
      var h = new URL(u, location.href).hostname.toLowerCase();
      var ok = ["cssstudio.app", "wikimedia.org", "wikipedia.org"].some(function (s) { return h === s || h.endsWith("." + s); });
      if (!ok) return u;
    } catch (e) { return u; }
    return "/img?w=" + w + "&url=" + encodeURIComponent(u);
  }
  function coverInner(a, big) {
    var foc = (a.cover_focal_x != null && a.cover_focal_x >= 0)
      ? (a.cover_focal_x * 100).toFixed(1) + "% " + (a.cover_focal_y * 100).toFixed(1) + "%" : "center 30%";
    if (a.cover_image) {
      // onerror 兜底: 代理失败→回退原图, 再失败→透明占位(绝不露破图标)。
      return '<img src="' + esc(imgProxy(a.cover_image, big ? 1080 : 440)) + '" alt="' + esc(a.name_en) + '" loading="lazy" decoding="async"'
        + ' data-orig="' + esc(a.cover_image) + '"'
        + ' onerror="var b=+this.dataset.fb||0;this.dataset.fb=b+1;this.src=b?&quot;' + AG_BLANK + '&quot;:this.getAttribute(&quot;data-orig&quot;)"'
        + ' style="--foc:' + foc + '">';
    }
    var h = hueOf(a.name_en || a.actor_id);
    var initial = esc(String(a.name_en || a.name_zh || "?").trim().charAt(0).toUpperCase());
    return '<div style="position:absolute;inset:0;background:linear-gradient(135deg,hsl(' + h + ',60%,26%),hsl(' + ((h + 50) % 360) + ',65%,14%));"></div>' +
           '<div class="ag-initial">' + (big ? '<span style="font-size:96px">' + initial + '</span>' : initial) + '</div>';
  }

  // 一句话招牌 slogan(配脸最勾人): 取 persona 破折号/中点前的主句, 截断。
  function sloganOf(a) {
    var p = String(a.persona || "").trim();
    if (!p) return "";
    var m = (p.split(/\s*[—–·]\s*/)[0] || p).replace(/[。.．]$/, "").trim();
    if (m.length > 46) m = m.slice(0, 44).replace(/\s+\S*$/, "") + "…";
    return m;
  }
  function actorCard(a) {
    var originBadge = a.origin_type === "civilization" ? "🏛" : "✨";
    var priceBadge = a.is_premium ? '<span class="ag-badge prem">💎 ' + cents(a.cast_price_cents) + '</span>' : '<span class="ag-badge">Free</span>';
    return '<div class="ag-card" data-actor="' + esc(a.actor_id) + '">' +
      '<div class="ag-cover" data-cover>' + coverInner(a, false) +
        '<div class="ag-badges"><span class="ag-badge">' + originBadge + '</span>' + priceBadge + '</div>' +
      '</div>' +
      '<div class="ag-meta">' +
        '<div class="ag-name">' + esc(a.name_en || a.name_zh) + '</div>' +
        '<div class="ag-sub">' + (a.name_native && a.name_native !== a.name_en ? esc(a.name_native) + ' · ' : "") + (a.civilization ? esc(civDisplay(a.civilization)) : esc(T("Original", "原创合成"))) + '</div>' +
        (sloganOf(a) ? '<div class="ag-slogan">' + esc(sloganOf(a)) + '</div>' : "") +
        '<div class="ag-row"><span>' + esc(a.voice_style || a.style_descriptor || "") + '</span></div>' +
        '<div class="ag-inline"></div>' +   // 就地展开: 同一框内接着显示详情(不另开框)
      '</div></div>';
  }

  function applyFilter(list) {
    return list.filter(function (a) {
      if (state.filter === "synthetic" && a.origin_type !== "synthetic") return false;
      if (state.filter === "civilization" && a.origin_type !== "civilization") return false;
      if (state.filter === "premium" && !a.is_premium) return false;
      if (state.filter === "female" && a.gender !== "female") return false;
      if (state.filter === "male" && a.gender !== "male") return false;
      if (state.filter === "neutral" && a.gender !== "neutral") return false;
      if (state.filter === "owned" && !state.ownedSet[a.actor_id]) return false;
      if (state.archetype && !(Array.isArray(a.archetypes) && a.archetypes.indexOf(state.archetype) >= 0)) return false;
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
    // App 端(单列)默认显示 3 张、每次也加载 3 张; 桌面端保持"一行(cols 张)"。
    var cols = colsFor(scroll);
    var batch = cols <= 1 ? 3 : cols;
    var show = Math.min(list.length, Math.max(batch, state.rows * batch));
    var more = list.length - show;
    // 分享单人态: 顶部一条"浏览全部演员"出口(点了才全量加载)。
    var soloBar = state.solo ? '<div style="margin:0 0 14px;"><button class="ag-chip ag-browse-all">🎭 ' + esc(T("Browse all actors", "浏览全部演员")) + ' →</button></div>' : "";
    scroll.innerHTML = soloBar +
      '<div class="ag-grid">' + list.slice(0, show).map(actorCard).join("") + '</div>' +
      (more > 0 ? '<div style="text-align:center;margin-top:20px;"><button class="ag-chip ag-more">' + esc(T("Load one more row", "加载更多一行")) + ' ▾ (' + more + ')</button></div>' : "");
    var mb = scroll.querySelector(".ag-more");
    if (mb) mb.onclick = function () { appendMoreRows(); };
    var ba = scroll.querySelector(".ag-browse-all");
    if (ba) ba.onclick = function () { state.solo = null; state.filter = "all"; resetRows(); loadActors(); };
    agSetupImgRecycle(scroll);
  }
  // 加载更多 = 只在末尾【追加】新一批卡, 不整刷、不跳回顶部(保留滚动位置)。
  // renderGrid() 全量重建只留给 筛选/搜索/首次(那些本就该重排)。
  function appendMoreRows() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    var grid = scroll && scroll.querySelector(".ag-grid");
    if (!grid) { state.rows += 1; renderGrid(); return; }  // 无网格 → 退回整渲
    var list = applyFilter(state.actors);
    var cols = colsFor(scroll);
    var batch = cols <= 1 ? 3 : cols;
    var prevShow = grid.children.length;
    state.rows += 1;
    var show = Math.min(list.length, Math.max(batch, state.rows * batch));
    if (show > prevShow) grid.insertAdjacentHTML("beforeend", list.slice(prevShow, show).map(actorCard).join(""));
    var more = list.length - show;
    var mb = scroll.querySelector(".ag-more");
    if (mb) {
      if (more > 0) mb.innerHTML = esc(T("Load one more row", "加载更多一行")) + " ▾ (" + more + ")";
      else if (mb.parentNode) mb.parentNode.remove();  // 到底 = 移除按钮
    }
    agSetupImgRecycle(scroll);  // 新追加的卡也纳入离屏回收
  }
  // CSSOS_WAVE_1524 — 离屏图卸载: 滚出视口 (上下各 800px 缓冲) 的封面 <img> 清掉 src
  // 释放已解码位图内存, 滚回来再恢复。配合 content-visibility:auto + /img 缩略, 让
  // 无限翻页的搜索结果内存有界, 不再 OOM 崩溃。展开卡(.expanded)不卸载。
  // 1x1 透明 GIF 占位: 卸载时换成它, 既释放大图解码内存, 又不像无 src 那样露出破图标(蓝?)。
  var AG_BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  var _agImgObs = null;
  function agSetupImgRecycle(scroll) {
    if (!("IntersectionObserver" in window) || !scroll) return;
    if (_agImgObs) _agImgObs.disconnect();
    _agImgObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var img = en.target;
        if (img.closest && img.closest(".ag-card.expanded")) return; // 展开卡不动
        var cur = img.getAttribute("src");
        if (en.isIntersecting) {
          if (img.dataset.agSrc && cur === AG_BLANK) { img.src = img.dataset.agSrc; }
        } else if (cur && cur !== AG_BLANK) {
          img.dataset.agSrc = cur;
          img.src = AG_BLANK; // 释放解码内存; .ag-cover 有 aspect-ratio 占位不塌
        }
      });
    }, { root: scroll, rootMargin: "800px 0px 800px 0px" });
    scroll.querySelectorAll(".ag-cover img").forEach(function (img) { _agImgObs.observe(img); });
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
        if (scroll) scroll.innerHTML = '<div class="ag-empty">' + esc(T("Load failed.", "加载失败。")) + ' <button class="ag-chip" onclick="cssosOpenActorGallery(1)">' + esc(T("Retry", "重试")) + '</button></div>';
      });
    // 我创建的演员 id 集合(供「我的演员」筛选 + 作者控件)。
    fetch("/api/actors?owned=1&limit=100", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var set = {}; ((j && j.data && j.data.actors) || []).forEach(function (a) { set[a.actor_id] = true; });
        state.ownedSet = set;
      }).catch(function () {});
  }
  // 分享深链: 只拉这一位演员(不全量 500, 省内存/带宽), 展开显示; 顶部给"浏览全部"出口。
  function loadSoloActor(id) {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (scroll) skeleton(scroll);
    fetch("/api/actors/" + encodeURIComponent(id), { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var a = j && j.data && j.data.actor;
        if (!a || !a.actor_id) { state.solo = null; loadActors(); return; }  // 隐藏/不存在 → 退回全量
        state.actors = [a]; renderGrid();
        var root = document.getElementById(ROOT_ID);
        var card = root && root.querySelector('.ag-card[data-actor="' + id + '"]');
        if (card && !card.classList.contains("expanded")) toggleExpand(card);
      })
      .catch(function () { state.solo = null; loadActors(); });
    fetch("/api/actors?owned=1&limit=100", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) { var set = {}; ((j && j.data && j.data.actors) || []).forEach(function (a) { set[a.actor_id] = true; }); state.ownedSet = set; }).catch(function () {});
  }

  /* CSSOS_WAVE_116 戏路 taxonomy —— 单一数据源。增减戏路只改这张表(key 与后端一致)。
     每项: key(后端认) · emoji · [en,zh] 大类名 · subs=[[en,zh]...] 细分。 */
  var ROLE_TAXONOMY = [
    { key: "hero", emoji: "🦸", en: "Hero", zh: "正派", subs: [["Hero / Knight", "英雄/骑士"], ["Guardian", "守护者"], ["Boy/Girl-next-door", "邻家/暖男"], ["Idealist", "理想主义者"]] },
    { key: "villain", emoji: "😈", en: "Villain", zh: "反派", subs: [["Tyrant", "枭雄"], ["Schemer", "阴谋家"], ["Maniac", "疯批"], ["Cold killer", "冷面杀手"], ["Fallen one", "堕落者"]] },
    { key: "antihero", emoji: "⚖️", en: "Anti-hero", zh: "亦正亦邪", subs: [["Anti-hero", "反英雄"], ["Rogue", "浪子"], ["Double agent", "双面间谍"], ["Gray bounty hunter", "灰色赏金客"]] },
    { key: "ruler", emoji: "👑", en: "Ruler", zh: "王者/权谋", subs: [["Emperor", "帝王"], ["Queen", "女王"], ["Power minister", "权臣"], ["Godfather", "教父"]] },
    { key: "action", emoji: "🗡", en: "Action", zh: "动作/硬汉", subs: [["Warrior", "战士"], ["Mercenary", "佣兵"], ["Avenger", "复仇者"], ["Tough detective", "硬汉警探"]] },
    { key: "sage", emoji: "🧙", en: "Sage", zh: "智者/导师", subs: [["Mentor", "导师"], ["Scholar", "学者"], ["Prophet", "先知"], ["Hermit", "隐士"]] },
    { key: "charmer", emoji: "💃", en: "Charmer", zh: "魅力/浪漫", subs: [["Lover", "情人"], ["Muse", "缪斯"], ["Socialite", "交际花"], ["Idol", "偶像"]] },
    { key: "tragic", emoji: "💔", en: "Tragic", zh: "悲情", subs: [["Martyr", "殉道者"], ["Orphan", "弃儿"], ["Fallen noble", "落魄贵族"], ["Devoted heart", "痴情人"]] },
    { key: "comic", emoji: "🎭", en: "Comic", zh: "丑角/喜剧", subs: [["Comedian", "谐星"], ["Trickster", "捣蛋鬼"], ["Goofball", "憨憨"], ["Snarker", "毒舌吐槽"]] },
    { key: "enigma", emoji: "🧊", en: "Enigma", zh: "冷面/神秘", subs: [["Mystery figure", "神秘客"], ["Ice beauty", "冷美人"], ["Masked one", "面具人"], ["Mastermind", "幕后黑手"]] },
    { key: "youth", emoji: "🌱", en: "Youth", zh: "成长/少年", subs: [["Young hero", "少年英雄"], ["Underdog", "逆袭者"], ["Girl genius", "天才少女"], ["Beginner", "初心者"]] },
  ];
  // 合成演员可跨文明(全文明/某几个)。创建时的可选文明大类。
  var CIVS = [
    { k: "Chinese", en: "Chinese", zh: "中华" }, { k: "Japanese", en: "Japanese", zh: "日本" },
    { k: "Korean", en: "Korean", zh: "韩国" }, { k: "Indian", en: "Indian", zh: "印度" },
    { k: "Persian", en: "Persian", zh: "波斯" }, { k: "Arab", en: "Arab", zh: "阿拉伯" },
    { k: "Greek", en: "Greek", zh: "希腊" }, { k: "Roman", en: "Roman", zh: "罗马" },
    { k: "Egyptian", en: "Egyptian", zh: "埃及" }, { k: "Norse", en: "Norse", zh: "北欧" },
    { k: "Slavic", en: "Slavic", zh: "斯拉夫" }, { k: "African", en: "African", zh: "非洲" },
    { k: "Latin American", en: "Latin American", zh: "拉美" }, { k: "Southeast Asian", en: "SE Asian", zh: "东南亚" },
    { k: "Western", en: "Western", zh: "西方" },
  ];
  // 通用「全 + 多选」胶囊: 第一枚 All 默认激活; 选具体则 All 关; 全不选则 All 回到激活。
  function allMultiMarkup(cls, label, items, allIcon) {
    // 胶囊宪法: 走平台 cssosMakePillBar(multi 模式)。data-pill-key = 选择值; All = __all__。
    var btns = '<button type="button" class="ag-mi" data-v="__all__" data-pill-key="__all__">' + (allIcon ? allIcon + " " : "") + esc(T("All", "全部")) + '</button>' +
      items.map(function (it) { return '<button type="button" class="ag-mi" data-v="' + esc(it.k) + '" data-pill-key="' + esc(it.k) + '">' + (it.emoji ? it.emoji + " " : "") + esc(T(it.en, it.zh)) + '</button>'; }).join("");
    return '<div class="ag-multi" data-multi="' + cls + '"><div class="ag-rt-label">' + esc(label) + '</div><div class="ag-pbrow">' + btns + '</div></div>';
  }
  function wireAllMulti(scope, cls) {
    var wrap = scope.querySelector('.ag-multi[data-multi="' + cls + '"]'); if (!wrap) return function () { return []; };
    var row = wrap.querySelector(".ag-pbrow");
    // 多选胶囊轨道 → 平台 helper(multi + allKey 塌缩回 All)。它切换 .on, 下面 getter 读 .on。
    if (row && typeof window.cssosMakePillBar === "function") {
      window.cssosMakePillBar(row, { textColor: "light", multi: true, allKey: "__all__" });
    }
    return function () { return [].slice.call(wrap.querySelectorAll('.ag-mi.active:not([data-v="__all__"])')).map(function (b) { return b.getAttribute("data-v"); }); };
  }
  // 文明名英文显示字典(平台默认英文; 不改库, 只影响展示; 歌词母语路由仍读原 civilization)。
  var CIV_EN = {
    "中华文明": "Chinese", "中华神话": "Chinese Myth", "中华民间": "Chinese Folk", "中华佛教神话": "Chinese Buddhist Myth",
    "佛教神话": "Buddhist Myth", "北欧神话": "Norse Myth", "印加文明": "Inca", "印度教神话": "Hindu Myth", "印度文明": "Indian",
    "古典主义欧洲": "Classical Europe", "古印度文明": "Ancient India", "古埃及文明": "Ancient Egypt", "古埃及神话": "Egyptian Myth",
    "古希腊文明": "Ancient Greece", "古希腊神话": "Greek Myth", "古罗马文明": "Ancient Rome", "启蒙欧洲": "Enlightenment Europe",
    "巴洛克欧洲": "Baroque Europe", "当代": "Contemporary", "拜占庭文明": "Byzantine", "文艺复兴欧洲": "Renaissance Europe",
    "日本古典": "Classical Japan", "欧洲文明": "European", "波斯文明": "Persian", "浪漫主义欧洲": "Romantic Europe",
    "现代北欧": "Modern Nordic", "现代印度": "Modern India", "现代非洲": "Modern Africa", "美索不达米亚文明": "Mesopotamia",
    "美索不达米亚神话": "Mesopotamian Myth", "莫卧儿印度": "Mughal India", "藏文明": "Tibetan", "西方文明": "Western", "近代欧洲": "Early Modern Europe",
    "斯拉夫神话": "Slavic Myth",
  };
  // 平台默认英文时把中文文明名映射成英文; 中文环境或未知值原样返回。
  function civDisplay(civ) {
    var c = String(civ || "");
    try { if (typeof window.loginCopy === "function" && window.loginCopy("en", "zh") === "zh") return c; } catch (_e) {}
    return CIV_EN[c] || c;
  }
  function archLabel(key) { for (var i = 0; i < ROLE_TAXONOMY.length; i++) if (ROLE_TAXONOMY[i].key === key) return ROLE_TAXONOMY[i]; return null; }
  // 图鉴筛选/卡片用的 en→本地化短标签。
  function archShort(key) { var a = archLabel(key); return a ? (a.emoji + " " + T(a.en, a.zh)) : key; }
  // 戏路选择器 markup(大类多选 + 选中展开细分)。
  function roleTaxonomyMarkup() {
    var allBtn = '<button type="button" class="ag-arch" data-arch="__all__" data-pill-key="__all__">🎭 ' + esc(T("All roles", "全角色")) + '</button>';
    var row = ROLE_TAXONOMY.map(function (a) {
      return '<button type="button" class="ag-arch" data-arch="' + a.key + '" data-pill-key="' + esc(a.key) + '">' + a.emoji + ' ' + esc(T(a.en, a.zh)) + '</button>';
    }).join("");
    return '<div class="ag-roletax">' +
      '<div class="ag-rt-label">' + esc(T("Role range — plays any role by default; or pick specific archetypes", "戏路 —— 默认全角色;也可只选某几种大类")) + '</div>' +
      '<div class="ag-pbrow ag-archrow">' + allBtn + row + '</div>' +
      '<div class="ag-subroles"></div>' +
    '</div>';
  }
  // 绑定戏路选择器; 返回 { archetypes(), subRoles() } getters。
  function wireRoleTaxonomy(scope) {
    var subWrap = scope.querySelector(".ag-subroles");
    var chosenSubs = {};   // key: en-label -> true
    function rebuildSubs() {
      var selected = [].slice.call(scope.querySelectorAll(".ag-arch.active")).map(function (b) { return b.getAttribute("data-arch"); });
      subWrap.innerHTML = selected.map(function (k) {
        var a = archLabel(k); if (!a) return "";
        var chips = a.subs.map(function (s) {
          var on = chosenSubs[s[0]] ? " on" : "";
          return '<button type="button" class="ag-sub' + on + '" data-sub="' + esc(s[0]) + '">' + esc(T(s[0], s[1])) + '</button>';
        }).join("");
        return '<div class="ag-subgroup"><div class="ag-subgroup-t">' + a.emoji + ' ' + esc(T(a.en, a.zh)) + '</div><div class="ag-subrow">' + chips + '</div></div>';
      }).join("");
      subWrap.querySelectorAll(".ag-sub").forEach(function (c) {
        c.onclick = function () { var k = c.getAttribute("data-sub"); if (chosenSubs[k]) delete chosenSubs[k]; else chosenSubs[k] = true; c.classList.toggle("on"); };
      });
    }
    var allArch = scope.querySelector('.ag-arch[data-arch="__all__"]');
    // 戏路多选 → 平台 helper(multi + allKey)。它管 .on 与"全选塌缩回 All"; 每次变更回调重建细分。
    var archRow = scope.querySelector(".ag-pbrow.ag-archrow");
    if (archRow && typeof window.cssosMakePillBar === "function") {
      window.cssosMakePillBar(archRow, { textColor: "light", multi: true, allKey: "__all__", onActivate: function () { rebuildSubs(); } });
    }
    return {
      archetypes: function () { if (allArch && allArch.classList.contains("active")) return []; return [].slice.call(scope.querySelectorAll('.ag-arch.active:not([data-arch="__all__"])')).map(function (b) { return b.getAttribute("data-arch"); }); },
      subRoles: function () {
        var sel = {}; scope.querySelectorAll(".ag-arch.active").forEach(function (b) { sel[b.getAttribute("data-arch")] = true; });
        // 只保留仍属于已选大类的细分。
        var valid = {}; ROLE_TAXONOMY.forEach(function (a) { if (sel[a.key]) a.subs.forEach(function (s) { valid[s[0]] = true; }); });
        return Object.keys(chosenSubs).filter(function (k) { return valid[k]; });
      },
    };
  }

  // 顶部三胶囊激活态随视图切换(成为演员 / 创建 / 搜索)= 委托给平台 cssosMakePillBar 控制器。
  var agTopcapCtl = null;
  function setTopcapActive(key) {
    if (agTopcapCtl && typeof agTopcapCtl.setActive === "function") { agTopcapCtl.setActive(key); return; }
    // 退回(helper 不可用): 纯视觉 class。
    var cap = document.querySelector("#" + ROOT_ID + " .ag-topcap"); if (!cap) return;
    cap.querySelectorAll(".ag-signup,.ag-create,.ag-search").forEach(function (x) { x.classList.remove("active"); });
    var sel = key === "create" ? ".ag-create" : key === "search" ? ".ag-search" : ".ag-signup";
    var t = cap.querySelector(sel); if (t) t.classList.add("active");
  }
  function renderCreateForm() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (!scroll) return;
    setTopcapActive("create");
    scroll.innerHTML = '<div class="ag-detail">' +
      '<button class="ag-back">‹ ' + esc(T("Back", "返回")) + '</button>' +
      '<div class="ag-hero-name" style="margin-bottom:6px">' + esc(T("Create your digital actor", "创建你的数字演员")) + '</div>' +
      '<div class="ag-sub" style="margin-bottom:16px">' + esc(T("Pick a civilization + role and the system intelligently composes the rest — name, look and style, all authentic to that culture (a Chinese hero is East Asian; a Japanese villain looks & feels Japanese). Or fill in as much as you like. You earn 70% royalty.", "选好文明 + 戏路,系统就智能联动补全其余 —— 名字、样貌、风格,全都贴合该文化(中国英雄=东亚样貌,日本反派=日本气韵)。也可自己多填。你拿 70% 版税。")) + '</div>' +
      '<div class="ag-form">' +
        '<label>' + esc(T("Stage name (blank = system names it)", "艺名(留空 = 系统起名)")) + '<input class="ag-in" data-k="name_en" maxlength="60" placeholder="' + esc(T("Nova Sky — or leave blank", "Nova Sky —— 或留空")) + '" /></label>' +
        '<label>' + esc(T("Appearance / vibe (blank = system composes from civilization + role)", "外貌 / 气质(留空 = 系统按文明+戏路智能生成)")) + '<textarea class="ag-in" data-k="description" maxlength="600" rows="3" placeholder="' + esc(T("e.g. a silver-haired violet-eyed futuristic diva — or leave blank", "如: 银发碧眼的未来感歌姬 —— 或留空")) + '"></textarea></label>' +
        '<label>' + esc(T("Voice gender", "声线性别")) + '<select class="ag-in" data-k="gender"><option value="" selected>' + esc(T("Auto — system decides by civilization", "自动 —— 按文明智能联动")) + '</option><option value="female">' + esc(T("Female", "女声")) + '</option><option value="male">' + esc(T("Male", "男声")) + '</option><option value="neutral">' + esc(T("Neutral", "中性")) + '</option></select></label>' +
        '<label class="ag-check"><input type="checkbox" data-k="willing_extra"> 👥 ' + esc(T("Willing to play extras (background roles) — more exposure", "愿意出演群演(背景角色)—— 更多曝光")) + '</label>' +
        '<label>' + esc(T("Style (leave blank = all styles)", "风格(留空 = 全风格)")) + '<input class="ag-in" data-k="style_descriptor" maxlength="120" placeholder="' + esc(T("synthwave — or leave blank for any", "synthwave —— 留空则任意风格")) + '" /></label>' +
        allMultiMarkup("civ", T("Civilization — all by default; or pick one/several (a face can span cultures)", "文明 —— 默认全文明;也可选一个/几个(一张脸可跨文化)"), CIVS, "🌍") +
        roleTaxonomyMarkup() +
        '<label>' + esc(T("Cast price (¢, 0=free; you earn 70%)", "选角价(¢, 0=免费; 你得 70%)")) + '<input class="ag-in" data-k="cast_price_cents" type="number" min="0" max="500" value="0" /></label>' +
        '<button class="ag-cast ag-submit">✨ ' + esc(T("One-tap generate & publish", "一键生成并发布")) + '</button>' +
        '<div class="ag-form-msg ag-empty"></div>' +
      '</div></div>';
    scroll.querySelector(".ag-back").onclick = function () { renderGrid(); };
    var roleTax = wireRoleTaxonomy(scroll);
    var civGet = wireAllMulti(scroll, "civ");
    var submit = scroll.querySelector(".ag-submit");
    var msg = scroll.querySelector(".ag-form-msg");
    submit.onclick = function () {
      var payload = {};
      scroll.querySelectorAll(".ag-in").forEach(function (el) { payload[el.getAttribute("data-k")] = el.value; });
      scroll.querySelectorAll("[data-k][type=checkbox]").forEach(function (el) { payload[el.getAttribute("data-k")] = el.checked; });
      payload.archetypes = roleTax.archetypes(); payload.sub_roles = roleTax.subRoles();
      payload.civilizations = civGet();
      // 名字/描述/性别都可留空 —— 后端按 文明+戏路+风格 智能联动补全(一键合成数字演员)。
      submit.disabled = true; msg.textContent = "⏳ " + T("Composing & generating the actor… (~10-25s)", "正在智能联动生成演员…(约 10-25 秒)");
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
          else { msg.textContent = (j && j.hint) || T("Creation failed, please retry.", "创建失败,请重试。"); }
        })
        .catch(function () { submit.disabled = false; msg.textContent = T("Network error, please retry.", "网络错误,请重试。"); });
    };
  }

  /* 🙋 真人签约: 本人知情同意 + 授权 + 摄像头转圈采集脸 + 录说/唱 → 建档待核验。自选自演免费, 他用你拿 80%。 */
  var rpStream = null;
  function stopRpStream() { if (rpStream) { try { rpStream.getTracks().forEach(function (t) { t.stop(); }); } catch (_e) {} rpStream = null; } }
  function b64(blob) { return new Promise(function (res) { var r = new FileReader(); r.onloadend = function () { res(String(r.result)); }; r.readAsDataURL(blob); }); }
  function uploadCapture(kind, blob) {
    return b64(blob).then(function (d) {
      return fetch("/api/actors/capture-upload", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: kind, data_b64: d }) }).then(function (r) { return r.json(); });
    });
  }
  function renderRealPersonSignup() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (!scroll) return;
    setTopcapActive("signup");
    var captured = { face_video: null, speech: null };
    scroll.innerHTML = '<div class="ag-detail">' +
      '<button class="ag-back">‹ ' + esc(T("Back", "返回")) + '</button>' +
      '<div class="ag-hero-name" style="margin-bottom:6px">🙋 ' + esc(T("Become a real digital actor", "签约成为真人数字演员")) + '</div>' +
      '<div class="ag-sub" style="margin-bottom:14px;max-width:640px">' + esc(T("Clone yourself into a digital actor — no scheduling limits, works 24/7. Use yourself free; when others cast you, you earn 80% (platform 20%). You watch every work you're in for free, and can report or revoke anytime. Verified before going public.", "把自己变成数字演员 —— 分身有术、不受档期阻拦、24/7 接戏。自选自演免费;别人选用你,你拿 80%(平台 20%)。你参演的每支作品都免费欣赏,随时可举报/撤权。核验通过才公开。")) + '</div>' +
      '<div class="ag-form">' +
        '<label>' + esc(T("Your name *", "你的名字 *")) + '<input class="ag-in" data-k="name_en" maxlength="80" /></label>' +
        '<label>' + esc(T("Stage name (optional — shown publicly instead of your name)", "艺名(选填 —— 公开展示时用它代替你的名字)")) + '<input class="ag-in" data-k="stage_name" maxlength="80" placeholder="Nova Sky" /></label>' +
        roleTaxonomyMarkup() +
        '<label>' + esc(T("A one-line vibe (optional — e.g. “commanding presence, eyes that speak”)", "一句 vibe(选填 —— 如「气场强、眼神会说话」)")) + '<textarea class="ag-in" data-k="role_range" maxlength="300" rows="2"></textarea></label>' +
        '<label>' + esc(T("Voice gender *", "声线性别 *")) + '<select class="ag-in" data-k="gender"><option value="" selected disabled>' + esc(T("— choose —", "— 请选择 —")) + '</option><option value="female">' + esc(T("Female", "女声")) + '</option><option value="male">' + esc(T("Male", "男声")) + '</option><option value="neutral">' + esc(T("Neutral", "中性")) + '</option></select></label>' +
        '<label>' + esc(T("Cast price others pay (¢, 0=free; you keep 80%)", "他人选用你的价(¢, 0=免费; 你留 80%)")) + '<input class="ag-in" data-k="cast_price_cents" type="number" min="0" max="9999" value="0" /></label>' +
        '<label class="ag-check"><input type="checkbox" data-k="is_public_figure"> ' + esc(T("I'm a public figure / celebrity (needs agency verification)", "我是公众人物/明星(需经纪公司核验)")) + '</label>' +
        '<div class="ag-consent">' +
          '<div style="font-weight:700;margin-bottom:6px">' + esc(T("Rights I grant (consent) *", "我授予的权利(同意)*")) + '</div>' +
          '<label class="ag-check"><input type="checkbox" data-k="grant_likeness" checked> ' + esc(T("Use my likeness (face) as a digital actor", "将我的肖像(脸)用作数字演员")) + '</label>' +
          '<label class="ag-check"><input type="checkbox" data-k="grant_voice"> ' + esc(T("Use my speaking voice", "使用我的说话声音")) + '</label>' +
          '<label class="ag-check"><input type="checkbox" data-k="grant_singing"> ' + esc(T("Use my singing voice", "使用我的歌唱声音")) + '</label>' +
          '<div style="margin-top:8px;font-size:12px;color:#8fe9c8;line-height:1.5">ℹ️ ' + esc(T("Likeness is you · voice is AI-generated (a clone trained from your sample). Your face and voice are never sold or reused for anyone else.", "形象为本人 · 声线为 AI 生成(基于你的样本克隆的声音)。你的脸和声音绝不会被出售或用于他人。")) + '</div>' +
        '</div>' +
        // 采集: 两胶囊(🎥 面孔 | 🎙 声音), 各自一个舞台
        '<div class="ag-capture">' +
          '<div style="font-weight:700;margin:6px 0 10px">📸 ' + esc(T("Capture yourself", "采集你自己")) + '</div>' +
          '<div class="ag-capmode" data-pill-bar style="display:flex;gap:8px;margin-bottom:14px;max-width:340px;">' +
            '<button class="ag-capchip on" data-cap="video">🎥 ' + esc(T("Face", "面孔")) + '</button>' +
            '<button class="ag-capchip" data-cap="audio">🎙 ' + esc(T("Voice", "声音")) + '</button>' +
          '</div>' +
          // 🎥 面孔舞台
          '<div class="ag-stage-video">' +
            '<div style="font-size:12.5px;color:#a9e9cf;margin:0 0 8px;line-height:1.5">💡 ' + esc(T("Record in good lighting, with no hat, and your full face visible. Thank you.", "请在光线充足、不戴帽子、脸部完整露出的环境中录制。谢谢。")) + '</div>' +
            '<div style="position:relative;width:100%;max-width:520px;">' +
              '<video class="ag-cam" autoplay muted playsinline style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;background:#000;border:1px solid rgba(0,245,160,.4);display:block;transform:scaleX(-1);"></video>' +
              '<button class="ag-cam-start" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:' + GREEN + ';color:' + INK + ';font-weight:800;border:0;border-radius:999px;padding:12px 22px;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.4);white-space:nowrap;">🎥 ' + esc(T("Start camera", "开启摄像头")) + '</button>' +
              '<div class="ag-facering" style="display:none"><span>' + esc(T("Fit your face in the ring", "把脸对进圈里")) + '</span></div>' +
              '<div class="ag-countdown"></div>' +
            '</div>' +
            // 引导式情绪采集(Vision Pro 式逐步): 逐个提示 → 倒数 → 自动抓帧 → 下一步; 可推倒重录。
            '<div class="ag-guide">' +
              '<div class="ag-guide-dots"></div>' +
              '<div class="ag-guide-prompt">' + esc(T("Guided capture — 12 steps total, one expression at a time (~1.5s each). You always see which step you’re on; retake any single shot, or restart all.", "引导采集 —— 共 12 步,逐个表情来(每步约 1.5 秒)。全程都告诉你在第几步;可单张重拍,也可整体重录。")) + '</div>' +
              '<label class="ag-guide-auto"><input type="checkbox" checked> ' + esc(T("Auto-capture when your face is in the ring", "脸对进圈里就自动拍")) + '</label>' +
              '<button class="ag-guide-go ag-recbtn" disabled>▶ ' + esc(T("Start guided capture", "开始引导采集")) + '</button>' +
              '<button class="ag-guide-restart ag-recbtn" hidden style="background:transparent;color:#bff5e0;border:1px solid rgba(0,245,160,.45);margin-top:8px">↻ ' + esc(T("Restart", "推倒重录")) + '</button>' +
              '<div class="ag-guide-thumbs"></div>' +
            '</div>' +
          '</div>' +
          // 🎙 声音舞台 (波形/音量条)
          '<div class="ag-stage-audio" style="display:none">' +
            '<div class="ag-consent-script" style="margin:2px 0 10px;padding:10px 14px;background:rgba(0,245,160,.08);border:1px dashed rgba(0,245,160,.4);border-radius:10px;font-size:14px;color:#e8fff5;"></div>' +
            '<div style="font-size:12.5px;color:#8fe9c8;margin:0 0 10px;line-height:1.5">🎵 ' + esc(T("Read the line aloud, then hum or sing any few notes. It does NOT need to sound good — we just need a sample of your singing voice so your actor can carry a tune. Anything counts.", "先照读这句话,再随便哼唱几句。不要求唱得好听 —— 我们只需要一段你的『歌声』样本,好让你的分身能开口唱。哼两声、跑调都行。")) + '</div>' +
            '<canvas class="ag-meter" width="1040" height="180" style="width:100%;max-width:520px;height:90px;border-radius:14px;background:#0a1512;border:1px solid rgba(0,245,160,.4);display:block;"></canvas>' +
            '<button class="ag-voice-rec ag-recbtn" disabled>🎙 ' + esc(T("Record 8s — speak, then sing/hum", "录 8 秒 —— 先说话,再哼唱")) + '</button>' +
          '</div>' +
          '<div class="ag-cap-status ag-empty" style="font-size:12px;margin-top:10px"></div>' +
        '</div>' +
        '<button class="ag-cast ag-rp-submit">🎬 ' + esc(T("Sign & submit for verification", "签约并提交核验")) + '</button>' +
        '<div class="ag-form-msg ag-empty"></div>' +
      '</div></div>';
    var vid = scroll.querySelector(".ag-cam"), capStatus = scroll.querySelector(".ag-cap-status");
    var startBtn = scroll.querySelector(".ag-cam-start"), voiceBtn = scroll.querySelector(".ag-voice-rec");
    var recBtn = scroll.querySelector(".ag-guide-go");   // 引导采集的启动按钮(占用原 recBtn 启用位)
    var countdownEl = scroll.querySelector(".ag-countdown");
    var guideDots = scroll.querySelector(".ag-guide-dots"), guidePrompt = scroll.querySelector(".ag-guide-prompt");
    var guideRestart = scroll.querySelector(".ag-guide-restart"), guideThumbs = scroll.querySelector(".ag-guide-thumbs");
    var videoStage = scroll.querySelector(".ag-stage-video"), audioStage = scroll.querySelector(".ag-stage-audio");
    var meterCanvas = scroll.querySelector(".ag-meter");
    var audioCtx = null, analyser = null, meterRAF = null;
    function stopMeter() { if (meterRAF) { cancelAnimationFrame(meterRAF); meterRAF = null; } try { if (audioCtx) audioCtx.close(); } catch (_e) {} audioCtx = null; analyser = null; }
    var back = scroll.querySelector(".ag-back"); back.onclick = function () { stopMeter(); stopRpStream(); renderGrid(); };
    // 口头授权脚本(照读)= 声音样本 + 口头同意记录 + 防冒充活体(念出"我是XX本人…"还要对得上脸)。
    var nameInput = scroll.querySelector('[data-k="name_en"]'), scriptEl = scroll.querySelector(".ag-consent-script");
    function consentScript() {
      var nm = (nameInput && nameInput.value.trim()) || T("me", "本人");
      return T('📢 Read aloud: “I am ' + nm + ', and I consent to the CSS Studio platform using my likeness and voice as a digital actor. Thank you.”',
               '📢 请照读:「我是' + nm + '本人,我同意 CSS Studio 平台将我的肖像声音用作数字演员,谢谢。」');
    }
    function refreshScript() { if (scriptEl) scriptEl.textContent = consentScript(); }
    refreshScript();
    if (nameInput) nameInput.addEventListener("input", refreshScript);
    // 实时音量/波形条(麦克风电平)。喂 AnalyserNode 的是麦克风流, 不接 destination(非播放, 不违 W667)。
    function drawMeter() {
      if (!analyser || !meterCanvas) return;
      meterRAF = requestAnimationFrame(drawMeter);
      var ctx = meterCanvas.getContext("2d"); if (!ctx) return;
      var n = analyser.frequencyBinCount, data = new Uint8Array(n); analyser.getByteFrequencyData(data);
      var W = meterCanvas.width, H = meterCanvas.height; ctx.clearRect(0, 0, W, H);
      var bars = 56, step = Math.max(1, Math.floor(n / bars)), bw = W / bars;
      for (var i = 0; i < bars; i++) {
        var v = (data[i * step] || 0) / 255, bh = Math.max(3, v * H * 0.92);
        ctx.fillStyle = "rgba(0,245,160," + (0.3 + 0.65 * v) + ")";
        ctx.fillRect(i * bw + 1.5, (H - bh) / 2, bw - 3, bh);
      }
    }
    // 一次性拿流(视频+音频), 幂等; 面孔预览 + 声音波形都靠这一条流。
    function showStartAgain(label) { if (startBtn) { startBtn.style.display = ""; startBtn.textContent = "🎥 " + (label || T("Start camera", "开启摄像头")); } }
    function ensureStream() {
      if (rpStream && rpStream.active) return Promise.resolve(rpStream);
      // 某些内置浏览器(如 Facebook/微信 App 内)根本不给 getUserMedia → 别卡在"开启中"。
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        capStatus.textContent = "⚠️ " + T("This browser can't access the camera. Open cssstudio.app in Safari/Chrome or the CSS Studio app.", "此浏览器无法访问摄像头。请在 Safari/Chrome 或 CSS Studio App 里打开 cssstudio.app。");
        showStartAgain(T("Not supported here", "此环境不支持"));
        return Promise.resolve(null);
      }
      capStatus.textContent = T("Opening camera & mic…", "正在开启摄像头和麦克风…");
      if (startBtn) startBtn.style.display = "none";
      // 超时兜底: getUserMedia 若 12s 不返回(权限对话框没弹/环境卡死)→ 不再永远"开启中"。
      var timedOut = false;
      var timeout = new Promise(function (resolve) { setTimeout(function () { timedOut = true; resolve("__timeout__"); }, 12000); });
      var gum = navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: true });
      return Promise.race([gum, timeout]).then(function (s) {
        if (s === "__timeout__") {
          capStatus.textContent = "⚠️ " + T("Camera didn't respond. Allow camera/mic access, or open in Safari/the app, then tap to retry.", "摄像头无响应。请允许摄像头/麦克风权限,或在 Safari/App 里打开,然后点按重试。");
          showStartAgain(T("Retry", "重试"));
          gum.then(function (late) { try { late.getTracks().forEach(function (t) { t.stop(); }); } catch (_e) {} }).catch(function () {}); // 迟到的流别泄漏
          return null;
        }
        return handleStream(s);
      }).catch(function (err) {
        if (timedOut) return null;
        var nm = (err && err.name) || "";
        capStatus.textContent = (nm === "NotAllowedError")
          ? T("Camera/mic permission denied — allow it and tap to retry.", "摄像头/麦克风权限被拒——请允许后点按重试。")
          : (nm === "NotReadableError")
            ? T("Camera is in use by another app. Close it and retry.", "摄像头正被别的 App 占用,关掉再试。")
            : T("Camera/mic permission denied.", "摄像头/麦克风权限被拒。") + (nm ? " (" + nm + ")" : "");
        showStartAgain(T("Retry", "重试"));
        return null;
      });
    }
    function handleStream(s) {
      return Promise.resolve(s).then(function (s) {
        rpStream = s; vid.srcObject = s; vid.muted = true;
        vid.setAttribute("data-live-capture", "1");   // 全局媒体裁判跳过
        vid.onloadedmetadata = function () { try { vid.play(); } catch (_e) {} };
        vid.onpause = function () { if (rpStream && rpStream.active) { try { vid.play(); } catch (_e) {} } };  // 被裁判摁停自恢复
        vid.play().catch(function () {});
        if (startBtn) startBtn.style.display = "none";
        recBtn.disabled = false; voiceBtn.disabled = false;
        // 波形分析(麦克风电平)
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC && s.getAudioTracks().length) {
            audioCtx = new AC();
            var src = audioCtx.createMediaStreamSource(new MediaStream(s.getAudioTracks()));
            analyser = audioCtx.createAnalyser(); analyser.fftSize = 256; src.connect(analyser);
            if (!meterRAF) drawMeter();
          }
        } catch (_e) {}
        setTimeout(function () {
          var vt = (s.getVideoTracks && s.getVideoTracks()[0]) || null, w = vid.videoWidth || 0;
          if (vt && vt.readyState === "live" && w > 0) capStatus.textContent = "✅ " + T("Ready", "已就绪") + " (" + w + "×" + (vid.videoHeight || 0) + ")";
          else if (vt && vt.readyState === "live") capStatus.textContent = "⚠️ " + T("Camera live but no image — another app (Zoom/FaceTime/Photo Booth) may be using it, or the lens is covered.", "摄像头正常但无画面——可能被别的 App(Zoom/FaceTime/Photo Booth)占用,或镜头被遮挡。");
          else capStatus.textContent = "⚠️ " + T("Camera did not start. Check System Settings › Privacy › Camera.", "摄像头未启动。检查 系统设置 › 隐私 › 摄像头。");
        }, 800);
        return s;
      }).catch(function (err) {
        var nm = (err && err.name) || "";
        capStatus.textContent = (nm === "NotAllowedError")
          ? T("Camera/mic permission denied — allow it and retry.", "摄像头/麦克风权限被拒——请允许后重试。")
          : (nm === "NotReadableError")
            ? T("Camera is in use by another app. Close it and retry.", "摄像头正被别的 App 占用,关掉再试。")
            : T("Camera/mic permission denied.", "摄像头/麦克风权限被拒。") + (nm ? " (" + nm + ")" : "");
        return null;
      });
    }
    if (startBtn) startBtn.onclick = function () { ensureStream(); };
    // 两胶囊模式切换: 🎥 面孔 | 🎙 声音
    function switchMode(key) {
      var isAudio = key === "audio";
      if (videoStage) videoStage.style.display = isAudio ? "none" : "";
      if (audioStage) audioStage.style.display = isAudio ? "" : "none";
      ensureStream();   // 点胶囊即用户手势, 顺势开流(波形/预览都靠它)
    }
    var capBar = scroll.querySelector(".ag-capmode");
    if (capBar) {
      capBar.querySelectorAll(".ag-capchip").forEach(function (c) { c.setAttribute("data-pill-key", c.getAttribute("data-cap")); });
      if (typeof window.cssosMakePillBar === "function") {
        capBar.classList.add("ag-pillbar");
        window.cssosMakePillBar(capBar, { mono: true, compact: true, textColor: "light", activeKey: "video", onActivate: switchMode });
      } else {
        capBar.querySelectorAll(".ag-capchip").forEach(function (c) {
          c.onclick = function () { capBar.querySelectorAll(".ag-capchip").forEach(function (x) { x.classList.toggle("on", x === c); }); switchMode(c.getAttribute("data-cap")); };
        });
      }
    }
    function pickMime(video) {
      var cands = video ? ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9", "video/webm", "video/mp4"]
                        : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      for (var i = 0; i < cands.length; i++) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(cands[i])) return cands[i]; } catch (_e) {} }
      return "";
    }
    function recordTrack(kindKey, uploadKind, opts, seconds, btn) {
      function ensureThen() {
        if (!rpStream) { ensureStream().then(function (s) { if (s) recordTrack(kindKey, uploadKind, opts, seconds, btn); }); return false; }
        return true;
      }
      if (!ensureThen()) return;
      var isVideo = !opts.audioOnly;
      var stream = opts.audioOnly ? new MediaStream(rpStream.getAudioTracks()) : rpStream;
      var mime = pickMime(isVideo);
      var mrOpts = isVideo ? { mimeType: mime || undefined, videoBitsPerSecond: 900000, audioBitsPerSecond: 64000 } : { mimeType: mime || undefined, audioBitsPerSecond: 64000 };
      var mr, chunks = [];
      try { mr = new MediaRecorder(stream, mrOpts); } catch (e) { try { mr = new MediaRecorder(stream); } catch (e2) { capStatus.textContent = T("Recording not supported on this browser.", "此浏览器不支持录制。"); return; } }
      var label = btn ? btn.textContent : "";
      function restore() { if (btn) { btn.classList.remove("recording"); btn.disabled = false; btn.textContent = label; } }
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        restore();
        if (!chunks.length) { capStatus.textContent = T("Nothing recorded, try again.", "没录到内容,请重试。"); return; }
        var blob = new Blob(chunks, { type: chunks[0].type || (isVideo ? "video/webm" : "audio/webm") });
        capStatus.textContent = "⏳ " + T("Uploading…", "上传中…") + " (" + Math.round(blob.size / 1024) + "KB)";
        if (blob.size > 22 * 1024 * 1024) { capStatus.textContent = T("Recording too large — record a shorter clip.", "录制文件过大,请录短一点。"); return; }
        uploadCapture(uploadKind, blob).then(function (j) {
          if (j && j.ok) { captured[kindKey] = j.url; capStatus.textContent = "✅ " + T("Captured", "已采集") + " (" + kindKey + ")"; }
          else capStatus.textContent = T("Upload failed", "上传失败") + (j && j.code ? " · " + j.code : "") + ".";
        }).catch(function (e) { capStatus.textContent = T("Upload failed (network).", "上传失败(网络)。"); });
      };
      if (btn) { btn.classList.add("recording"); btn.disabled = true; }
      mr.start();
      var left = seconds;
      function tick() { if (btn) btn.textContent = "⏺ " + T("Recording", "录制中") + " " + left + "s"; capStatus.textContent = "⏺ " + T("Recording…", "录制中…") + " " + left + "s"; }
      tick();
      var iv = setInterval(function () { left--; if (left <= 0) { clearInterval(iv); } else tick(); }, 1000);
      setTimeout(function () { clearInterval(iv); try { if (mr.state !== "inactive") mr.stop(); } catch (_e) {} }, seconds * 1000);
    }
    // ── 引导式情绪采集(6 情绪通道 + 几何/活体 + 反派 + 自由鬼脸)──
    // 每步都带一句「为什么」—— 让用户明白这是必须的采集,不是刁难/耍猴。
    var GUIDE_STEPS = [
      { k: "front",    e: "🙂", en: "Face the camera · relaxed",   zh: "正对镜头 · 放松",   wen: "So your digital actor has a clear front face.", wzh: "让你的分身有一张清晰的正脸。" },
      { k: "left",     e: "⬅️", en: "Slowly turn head left",       zh: "慢慢向左转头",       wen: "So it can turn its head — not a flat cutout.", wzh: "让分身能自然转头,不是纸片人。" },
      { k: "right",    e: "➡️", en: "Slowly turn head right",      zh: "慢慢向右转头",       wen: "The other side, for a full 3D-ready face.", wzh: "另一侧,凑齐可建脸的多角度。" },
      { k: "blink",    e: "😌", en: "Close your eyes",             zh: "闭上眼睛",           wen: "Proves you're live — stops anyone faking you with a photo.", wzh: "证明是真人活体,防止别人拿一张照片冒充你。" },
      { k: "calm",     e: "😐", en: "Neutral · calm",              zh: "中性 · 平静",       wen: "The baseline every other emotion is built from.", wzh: "所有其它表情都从这张基线出发。" },
      { k: "joy",      e: "😄", en: "Laugh out loud",              zh: "哈哈大笑",           wen: "So your actor can truly smile and laugh on screen.", wzh: "让你的分身在镜头前真的会笑。" },
      { k: "grief",    e: "😢", en: "Grief · about to cry",        zh: "哭丧脸 · 快哭了",    wen: "So it can carry sad, moving scenes.", wzh: "让分身能演悲伤、催泪的戏。" },
      { k: "ignite",   e: "😠", en: "Anger · glare & roar",        zh: "怒目 · 怒吼",        wen: "For intense, powerful moments.", wzh: "撑得起激昂、爆发的段落。" },
      { k: "intimate", e: "🥰", en: "Tender, loving gaze",         zh: "深情凝视",           wen: "For love songs and tender scenes.", wzh: "情歌、深情戏靠它。" },
      { k: "resolve",  e: "😤", en: "Determined · defiant",        zh: "坚定 · 昂首挑衅",     wen: "For strong, triumphant beats.", wzh: "坚定、凯旋的高光时刻。" },
      { k: "villain",  e: "😈", en: "Villain · cold sneer",        zh: "反派 · 冷笑 / 狞笑",  wen: "So you can also play the bad guy.", wzh: "让你也能演反派坏人。" },
      { k: "grimace",  e: "🤪", en: "Freestyle · make a funny face", zh: "自由发挥 · 做个鬼脸", wen: "A spontaneous face is very hard for AI to fake — it protects the real you.", wzh: "即兴鬼脸 AI 极难伪造,保护真实的你。" }
    ];
    var guide = { i: 0, frames: {}, uploads: [], running: false, auto: true, autoTimer: null };
    var faceRing = scroll.querySelector(".ag-facering"), autoToggle = scroll.querySelector(".ag-guide-auto input");
    if (autoToggle) autoToggle.onchange = function () { guide.auto = autoToggle.checked; if (guide.running && guide.auto && GUIDE_STEPS[guide.i]) armStep(); else clearAuto(); };
    function grabFrame() {
      var w = vid.videoWidth || 640, h = vid.videoHeight || 480;
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      var cx = cv.getContext("2d"); if (!cx) return null;
      try { cx.drawImage(vid, 0, 0, w, h); } catch (_e) { return null; }
      try { return cv.toDataURL("image/jpeg", 0.85); } catch (_e) { return null; }
    }
    function uploadFrame(dataUrl) {
      return fetch("/api/actors/capture-upload", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "photo", data_b64: dataUrl }) })
        .then(function (r) { return r.json(); });
    }
    function clearAuto() { if (guide.autoTimer) { clearInterval(guide.autoTimer); clearTimeout(guide.autoTimer); guide.autoTimer = null; } }
    function persistFrame(s, dataUrl, thumb) {
      guide.frames[s.k] = "__up__";
      var up = uploadFrame(dataUrl).then(function (j) { if (j && j.ok) { guide.frames[s.k] = j.url; thumb.classList.remove("pending"); } else { guide.frames[s.k] = null; thumb.style.borderColor = "rgba(255,120,120,.6)"; } })
        .catch(function () { guide.frames[s.k] = null; });
      guide.uploads.push(up);
    }
    function wireRetake(thumb, s) { var rb = thumb.querySelector(".gretake"); if (rb) rb.onclick = function (ev) { ev.stopPropagation(); recapture(s, thumb); }; }
    // 单张重拍: 只重录这一步(不动其它已拍的), 覆盖同一缩略图与 frames[key]。
    function recapture(s, thumb) {
      clearAuto();
      runCountdown(function (url0) { if (!url0) return; var im = thumb.querySelector("img"); if (im) im.src = url0; thumb.classList.add("pending"); persistFrame(s, url0, thumb); });
    }
    // 共用倒数+快门(3-2-1 → 抓帧), cb(dataUrl)。
    function runCountdown(cb) {
      if (countdownEl.dataset.busy === "1") return; countdownEl.dataset.busy = "1"; recBtn.disabled = true;
      var n = 3; countdownEl.style.display = "flex"; countdownEl.textContent = n;
      var iv = setInterval(function () {
        n--; if (n > 0) { countdownEl.textContent = n; return; }
        clearInterval(iv);
        var url0 = grabFrame();
        countdownEl.textContent = "📸"; countdownEl.classList.add("flash");
        setTimeout(function () { countdownEl.classList.remove("flash"); countdownEl.style.display = "none"; countdownEl.dataset.busy = ""; recBtn.disabled = false; }, 200);
        cb(url0);
      }, 750);
    }
    function renderGuide() {
      guideDots.innerHTML = GUIDE_STEPS.map(function (s, idx) {
        var cls = guide.frames[s.k] ? "gd done" : (idx === guide.i ? "gd cur" : "gd");
        return '<span class="' + cls + '"></span>';
      }).join("");
      var s = GUIDE_STEPS[guide.i];
      if (!s) { guidePrompt.innerHTML = "✅ " + esc(T("All captured — retake any shot above, or sign & submit below.", "采集完成 —— 可点上方任意缩略图重拍,或到下方签约提交。")); recBtn.style.display = "none"; if (faceRing) faceRing.style.display = "none"; clearAuto(); return; }
      guidePrompt.innerHTML = '<span class="gemoji">' + s.e + '</span><span class="glabel"><span class="gstepc">' + esc(T("Step " + (guide.i + 1) + " of " + GUIDE_STEPS.length, "第 " + (guide.i + 1) + " / " + GUIDE_STEPS.length + " 步")) + '</span><b>' + esc(T(s.en, s.zh)) + '</b><em>' + esc(T(s.wen, s.wzh)) + '</em></span>';
      recBtn.style.display = ""; recBtn.disabled = false; recBtn.textContent = "📸 " + T("Capture this", "拍这张");
      if (faceRing) faceRing.style.display = "";
      armStep();
    }
    // 自动抓拍: 有 FaceDetector(Android/部分)时脸对齐即自动拍; 没有(iOS/webview)则 2.6s 后自动拍。手点「拍这张」随时可覆盖。
    function armStep() {
      clearAuto();
      var s = GUIDE_STEPS[guide.i]; if (!s) return;
      if (faceRing) faceRing.classList.remove("aligned");
      if (!guide.auto) return;
      if (window.FaceDetector) {
        var det = null; try { det = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: true }); } catch (_e) { det = null; }
        if (det) {
          var stable = 0;
          guide.autoTimer = setInterval(function () {
            det.detect(vid).then(function (faces) {
              if (faces && faces.length) {
                var bb = faces[0].boundingBox || {}, ok = (bb.width || 0) > (vid.videoWidth || 640) * 0.24;
                if (faceRing) faceRing.classList.toggle("aligned", ok);
                if (ok) { stable++; if (stable >= 3) { clearAuto(); captureStep(); } } else stable = 0;
              } else { if (faceRing) faceRing.classList.remove("aligned"); stable = 0; }
            }).catch(function () {});
          }, 350);
          return;
        }
      }
      guide.autoTimer = setTimeout(function () { captureStep(); }, 2600);
    }
    function captureStep() {
      clearAuto();
      var s = GUIDE_STEPS[guide.i]; if (!s) return;
      runCountdown(function (url0) {
        if (url0) {
          var thumb = document.createElement("div"); thumb.className = "gthumb pending";
          thumb.innerHTML = '<img src="' + url0 + '"><span>' + s.e + '</span><button class="gretake" title="' + esc(T("Retake", "重拍")) + '">↻</button>';
          guideThumbs.appendChild(thumb); wireRetake(thumb, s); persistFrame(s, url0, thumb);
        } else guide.frames[s.k] = null;
        setTimeout(function () { guide.i++; if (guide.i >= GUIDE_STEPS.length) onGuideDone(); else renderGuide(); }, 550);
      });
    }
    function onGuideDone() {
      captured.guided_done = true; captured.frames = guide.frames;
      capStatus.textContent = "✅ " + T("Guided capture complete", "引导采集完成");
      renderGuide();
    }
    function resetGuide() { clearAuto(); guide = { i: 0, frames: {}, uploads: [], running: true, auto: autoToggle ? autoToggle.checked : true, autoTimer: null }; guideThumbs.innerHTML = ""; captured.guided_done = false; captured.frames = null; }
    function startGuide() {
      if (!rpStream || !rpStream.active) { ensureStream().then(function (s) { if (s) startGuide(); }); return; }
      if (!guide.running) { resetGuide(); guideRestart.hidden = false; renderGuide(); return; }
      captureStep();
    }
    recBtn.onclick = startGuide;
    guideRestart.onclick = function () { resetGuide(); renderGuide(); };
    voiceBtn.onclick = function () { recordTrack("speech", "speech", { audioOnly: true }, 8, voiceBtn); };
    var roleTax = wireRoleTaxonomy(scroll);
    var submit = scroll.querySelector(".ag-rp-submit"), msg = scroll.querySelector(".ag-form-msg");
    submit.onclick = function () {
      var p = {};
      scroll.querySelectorAll(".ag-in").forEach(function (el) { p[el.getAttribute("data-k")] = el.value; });
      scroll.querySelectorAll("[data-k][type=checkbox]").forEach(function (el) { p[el.getAttribute("data-k")] = el.checked; });
      p.archetypes = roleTax.archetypes(); p.sub_roles = roleTax.subRoles();
      if (!p.name_en || String(p.name_en).trim().length < 2) { msg.textContent = T("Please enter your name.", "请填名字。"); return; }
      if (!p.grant_likeness) { msg.textContent = T("You must grant likeness consent.", "必须勾选授权肖像。"); return; }
      if (!p.gender) { msg.textContent = T("Please choose a voice gender.", "请选择声线性别。"); return; }
      if (!captured.guided_done) { msg.textContent = T("Please finish the guided capture first (tap “Start guided capture”).", "请先完成引导采集(点「开始引导采集」)。"); return; }
      submit.disabled = true; msg.textContent = "⏳ " + T("Finishing capture…", "整理采集中…");
      // 等所有帧上传落地, 再签约(引导采集是异步上传的)。
      Promise.all((guide.uploads || []).map(function (pr) { return pr.catch(function () {}); })).then(function () {
        var frames = {}; Object.keys(guide.frames || {}).forEach(function (k) { var v = guide.frames[k]; if (v && v.indexOf && v.indexOf("http") === 0) frames[k] = v; });
        if (!Object.keys(frames).length) { submit.disabled = false; msg.textContent = T("Capture didn't upload — check connection and retry.", "采集未上传成功——检查网络后重试。"); return; }
        var liveRef = frames.front || frames.calm || frames[Object.keys(frames)[0]];
        captured.face_video = liveRef;   // 活体参考用正脸帧
        p.likeness_capture = { mode: "guided_frames", frames: frames, liveness_ref: liveRef };
        if (captured.speech) p.voice_capture = { speech_url: captured.speech, spoken_consent: consentScript(), consented_at: new Date().toISOString() };
        msg.textContent = "⏳ " + T("Signing…", "签约中…");
        doSignup(p);
      });
    };
    function doSignup(p) {
      fetch("/api/actors/real-person", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(p) })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok) {
            // 自动提交核验
            fetch("/api/actors/" + encodeURIComponent(j.actor_id) + "/submit-verification", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ method: "self_liveness", liveness_ref: captured.face_video }) })
              .then(function () {}).catch(function () {});
            stopRpStream();
            scroll.innerHTML = '<div class="ag-detail"><button class="ag-back">‹ ' + esc(T("Back", "返回")) + '</button><div class="ag-empty" style="font-size:16px;margin-top:20px">✅ ' + esc(T("Signed! Your actor is submitted for identity verification. Once approved it goes public and you start earning. Self-cast is free.", "签约成功!已提交身份核验。通过后自动公开上架、开始赚钱。自选自演免费。")) + '</div></div>';
            scroll.querySelector(".ag-back").onclick = function () { renderGrid(); };
          } else { submit.disabled = false; msg.textContent = (j && j.hint) || T("Sign-up failed, please retry.", "签约失败,请重试。"); }
        }).catch(function () { submit.disabled = false; msg.textContent = T("Network error, please retry.", "网络错误,请重试。"); });
    };
  }

  // 分享数字演员: 落地页 /a/<id>(后端给 og:image=封面 + 自荐)。有原生分享用原生, 否则开 X 意图 + 复制链接。
  function fmtWhen(ts) {
    try { var d = new Date(ts); var s = Math.max(0, (Date.now() - d.getTime()) / 1000);
      if (s < 60) return T("just now", "刚刚");
      if (s < 3600) return Math.floor(s / 60) + T("m ago", " 分钟前");
      if (s < 86400) return Math.floor(s / 3600) + T("h ago", " 小时前");
      if (s < 2592000) return Math.floor(s / 86400) + T("d ago", " 天前");
      return d.toLocaleDateString();
    } catch (e) { return ""; }
  }
  function commentHtml(c, isReply) {
    return '<div class="ag-cmt' + (isReply ? ' ag-cmt-reply' : '') + '" data-cid="' + esc(c.id) + '">' +
      '<div class="who"><span>' + esc(c.author_name || "Guest") + ' · ' + esc(fmtWhen(c.created_at)) + '</span>' +
      '<span class="ag-cmt-actions">' +
        (c.can_reply && !isReply ? '<button class="ag-reply-btn" data-cid="' + esc(c.id) + '">' + esc(T("Reply", "回复")) + '</button>' : '') +
        (c.mine ? '<button class="del" data-cid="' + esc(c.id) + '">' + esc(T("Delete", "删除")) + '</button>' : '') +
      '</span></div>' +
      '<div class="body">' + esc(c.body) + '</div>' +
      (isReply ? '' : '<div class="ag-cmt-kids"></div>') +
      '</div>';
  }
  function postComment(actorId, body, parentId) {
    return fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: body, parent_id: parentId || undefined }) }).then(function (r) { return r.json(); });
  }
  function needSignIn() {
    if (window.cssosGuidedToast) window.cssosGuidedToast(T("Sign in to comment.", "登录后即可评论。"), { actions: [{ label: T("Sign in", "登录"), onClick: function () { if (window.cssosOpenLogin) window.cssosOpenLogin(); } }] });
    else window.alert(T("Sign in to comment.", "登录后即可评论。"));
  }
  function wireCommentActions(listEl, actorId) {
    if (listEl.__wired) return; listEl.__wired = true;
    listEl.addEventListener("click", function (e) {
      var t = e.target;
      var del = t.closest && t.closest(".del");
      if (del) {
        var cid = del.getAttribute("data-cid");
        fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments/" + encodeURIComponent(cid), { method: "DELETE", credentials: "include" })
          .then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) { var n = listEl.querySelector('.ag-cmt[data-cid="' + cid + '"]'); if (n) n.remove(); if (!listEl.querySelector(".ag-cmt")) renderComments(listEl, actorId, [], listEl.__signedIn); } });
        return;
      }
      var rb = t.closest && t.closest(".ag-reply-btn");
      if (rb) {
        if (!listEl.__signedIn) { needSignIn(); return; }
        var host = rb.closest(".ag-cmt");
        var open = host.querySelector(".ag-reply-box");
        if (open) { open.remove(); return; }   // 再点 = 收起
        var rbox = document.createElement("div"); rbox.className = "ag-reply-box";
        rbox.innerHTML = '<textarea class="ag-reply-text" rows="1" placeholder="' + esc(T("Write a reply…", "写条回复…")) + '" maxlength="800"></textarea><button class="ag-reply-send">' + esc(T("Reply", "回复")) + '</button>';
        host.insertBefore(rbox, host.querySelector(".ag-cmt-kids"));
        rbox.querySelector(".ag-reply-text").focus();
        return;
      }
      var rs = t.closest && t.closest(".ag-reply-send");
      if (rs) {
        var rbox2 = rs.closest(".ag-reply-box"), host2 = rs.closest(".ag-cmt");
        var body = String(rbox2.querySelector(".ag-reply-text").value || "").trim();
        if (!body) return;
        rs.disabled = true;
        postComment(actorId, body, host2.getAttribute("data-cid")).then(function (j) {
          rs.disabled = false;
          if (j && j.ok && j.comment) { host2.querySelector(".ag-cmt-kids").insertAdjacentHTML("beforeend", commentHtml(j.comment, true)); rbox2.remove(); }
          else if (j && j.code === "AUTH_REQUIRED") needSignIn();
          else window.alert(T("Failed to post.", "发布失败。"));
        }).catch(function () { rs.disabled = false; window.alert(T("Failed to post.", "发布失败。")); });
        return;
      }
    });
  }
  function renderComments(listEl, actorId, comments, signedIn) {
    listEl.__signedIn = signedIn;
    if (!comments.length) { listEl.innerHTML = '<div class="ag-cmt-empty">' + esc(T("No comments yet. Be the first!", "还没有评论,来抢沙发!")) + '</div>'; return; }
    var tops = comments.filter(function (c) { return !c.parent_id; }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var kids = {}; comments.forEach(function (c) { if (c.parent_id) { (kids[c.parent_id] = kids[c.parent_id] || []).push(c); } });
    listEl.innerHTML = tops.map(function (c) { return commentHtml(c, false); }).join("");
    tops.forEach(function (c) {
      var arr = (kids[c.id] || []).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      if (arr.length) { var host = listEl.querySelector('.ag-cmt[data-cid="' + c.id + '"] .ag-cmt-kids'); if (host) host.innerHTML = arr.map(function (k) { return commentHtml(k, true); }).join(""); }
    });
    wireCommentActions(listEl, actorId);
  }
  function toggleComments(inline, actorId) {
    var box = inline.querySelector(".ag-comments");
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    var listEl = box.querySelector(".ag-cmt-list");
    var textEl = box.querySelector(".ag-cmt-text");
    var sendEl = box.querySelector(".ag-cmt-send");
    if (box.__loaded) return;
    box.__loaded = true;
    listEl.innerHTML = '<div class="ag-cmt-empty">' + esc(T("Loading…", "加载中…")) + '</div>';
    fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments", { credentials: "include" })
      .then(function (r) { return r.json(); }).then(function (j) { renderComments(listEl, actorId, (j && j.comments) || [], !!(j && j.signed_in)); })
      .catch(function () { listEl.innerHTML = '<div class="ag-cmt-empty">' + esc(T("Failed to load.", "加载失败。")) + '</div>'; });
    sendEl.onclick = function () {
      var body = String(textEl.value || "").trim();
      if (!body) return;
      sendEl.disabled = true;
      postComment(actorId, body, null).then(function (j) {
        sendEl.disabled = false;
        if (j && j.ok && j.comment) {
          textEl.value = "";
          var empty = listEl.querySelector(".ag-cmt-empty"); if (empty) empty.remove();
          listEl.insertAdjacentHTML("afterbegin", commentHtml(j.comment, false));
          listEl.__signedIn = true; wireCommentActions(listEl, actorId);
        } else if (j && j.code === "AUTH_REQUIRED") needSignIn();
        else window.alert(T("Failed to post.", "发布失败。"));
      }).catch(function () { sendEl.disabled = false; window.alert(T("Failed to post.", "发布失败。")); });
    };
    textEl.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendEl.click(); });
  }
  function shareActor(a) {
    var name = a.name_en || a.name_zh || "Digital Actor";
    var url = "https://cssstudio.app/a/" + encodeURIComponent(a.actor_id);
    // 分享计数 +1(点分享即算, 不阻断)。同步更新详情里的 ↗ 数字。
    fetch("/api/actors/" + encodeURIComponent(a.actor_id) + "/share", { method: "POST", credentials: "include" })
      .then(function (r) { return r.json(); }).then(function (j) {
        var root = document.getElementById(ROOT_ID);
        if (j && j.ok && root) { var sb = root.querySelector('.ag-share .ag-cnt'); if (sb) sb.textContent = j.share_count; }
      }).catch(function () {});
    var slg = sloganOf(a);
    var title = (slg ? name + " — " + slg : name + " · Digital Actor");
    // 带上数字演员的自荐/自我介绍(persona + 声线 + 风格 + CTA), 写长写足; 分享面板按各平台字数上限自动截取。
    var intro = String(a.persona || slg || "").trim();
    var vc = String(a.voice_style || "").trim(), st = String(a.style_descriptor || "").trim();
    var richText = T(
      (intro ? "“" + intro + "” — " : "") + "Meet " + name + ", a digital actor on CSS Studio. " +
        (vc ? "Voice: " + vc + ". " : "") + (st ? "Style: " + st + ". " : "") +
        "Cast them to star in your next music video — as a hero, a villain, or a legend, the choice is yours. Say CSS, and witness the miracle. 🎭",
      (intro ? "「" + intro + "」—— " : "") + "认识数字演员「" + name + "」。" +
        (vc ? "声线:" + vc + "。" : "") + (st ? "风格:" + st + "。" : "") +
        "选 TA 主演你的下一支 MV —— 正派、反派、还是名角,由你导演。一句 CSS,见证奇迹。🎭");
    // 用平台自己的分享面板(X/微博/小红书/抖音… 一整排), 不用「太苹果」的原生分享。
    if (typeof window.openCssosShareDialog === "function") {
      window.openCssosShareDialog({ url: url, title: title, text: richText, headerLabel: T("Share this actor", "分享这位演员") });
      return;
    }
    // 兜底: 复制链接。
    try { if (navigator.clipboard) navigator.clipboard.writeText(url); } catch (_e2) {}
    if (typeof window.cssosGuidedToast === "function") window.cssosGuidedToast(T("Link copied", "链接已复制"), {});
  }

  // 作品类型: 音乐驱动(现可用) vs 叙事驱动(需自动编剧, 先锁, 以后开)。
  var CAST_WORK_TYPES = [
    { key: "single",   emoji: "🎬", en: "MV (single)",  zh: "单曲 MV",  descEn: "One song, one video", descZh: "一首歌 · 一支 MV", ready: true },
    { key: "triptych", emoji: "🎼", en: "Triptych",     zh: "三部曲",   descEn: "3 connected chapters", descZh: "三段相连的乐章", ready: true },
    { key: "opera",    emoji: "🎭", en: "Opera",        zh: "歌剧",     descEn: "Multi-act musical epic", descZh: "多幕音乐史诗", ready: true },
    { key: "shortplay",emoji: "📺", en: "Short drama",  zh: "短剧",     descEn: "Auto-scripted · coming soon", descZh: "自动编剧 · 敬请期待", ready: false },
    { key: "series",   emoji: "📽", en: "TV series",    zh: "电视连续剧", descEn: "Auto-scripted · coming soon", descZh: "自动编剧 · 敬请期待", ready: false },
    { key: "film",     emoji: "🎦", en: "Film",         zh: "电影",     descEn: "Auto-scripted · coming soon", descZh: "自动编剧 · 敬请期待", ready: false },
  ];
  function castPromptFor(actor, name, workType) {
    var base;
    if (workType === "triptych") base = T("Create a 3-part triptych MV starring the digital actor “" + name + "” — three connected chapters/songs.", "用数字演员「" + name + "」主演,创作一部三部曲 MV(三段相连的乐章)。");
    else if (workType === "opera") base = T("Create a multi-act opera (grand musical MV) starring the digital actor “" + name + "”.", "用数字演员「" + name + "」主演,创作一部多幕歌剧(宏大音乐 MV)。");
    else base = T("Create an MV starring the digital actor “" + name + "”.", "用数字演员「" + name + "」主演,创作一支 MV。");
    return base +
      (actor.face_prompt ? T(" Actor look: ", " 该演员形象: ") + actor.face_prompt + "." : "") +
      (actor.voice_style ? T(" Voice: ", " 声线: ") + actor.voice_style + "." : "") +
      (actor.style_descriptor ? T(" Style: ", " 风格: ") + actor.style_descriptor + "." : "");
  }
  function castRun(actor, workType) {
    var name = actor.name_zh || actor.name_en;
    // C 选角注入: 记下待选角演员 → fetch 拦截器把 actor_id 注入生成/建档调用, 后端注入锁定形象+记选角。
    window.__cssosCastActorId = actor.actor_id;
    window.__cssosCastActorName = name;
    var prompt = castPromptFor(actor, name, workType);
    // 缺口1(W1537) — 文案带上【全体 cast】(反派/配角也进故事+歌词, 不只画面)。
    //   ⚠️ i18N: 这些是发给 LLM 的【生成指令】(英文骨架), 输出【歌词语言】仍由后端按主角文明智能联动
    //   (civToLanguageServer)决定, 与此处 UI 语言无关。角色标签走 T() 显示层。
    var castArr = (window.__cssosCast && Array.isArray(window.__cssosCast.cast)) ? window.__cssosCast.cast : [];
    var others = castArr.filter(function (m) { return m.actor_id !== actor.actor_id && m.name; });
    if (others.length) {
      prompt += " " + T("Co-starring", "同台演员") + ": " +
        others.map(function (m) { return m.name + " (" + T(m.role_label_en || m.role, m.role_label_zh || m.role) + ")"; }).join(", ") +
        ". " + T("Weave every cast member into the story and lyrics, each true to their role.", "让每位演员都进入剧情与歌词, 各司其职。");
    }
    // 缺口5 — 出炉前一句确认(主演 + 反派/配角), 让导演确定 cast 生效。全 T()。
    if (typeof window.cssosGuidedToast === "function") {
      window.cssosGuidedToast("🎬 " + T("Starring", "主演") + " " + name +
        (others.length ? " · " + others.map(function (m) { return T(m.role_label_en || m.role, m.role_label_zh || m.role) + " " + m.name; }).join(" · ") : ""), {});
    }
    if (typeof window.cssosOpenAssistantWithPrompt === "function") {
      close();
      window.cssosOpenAssistantWithPrompt(prompt, { actorId: actor.actor_id });
    } else if (typeof window.cssosGuidedToast !== "function") { alert(T("Cast actor: ", "已选定演员: ") + name); }
  }
  // 选角时先选作品类型(叙事类先锁)。
  function openCast(actor) {
    var root = document.getElementById(ROOT_ID); if (!root) { castRun(actor, "single"); return; }
    var name = esc(actor.name_en || actor.name_zh);
    var modal = document.createElement("div"); modal.className = "ag-castmodal";
    // 真人演员才有"声线档": AI 声(即时) / 本人真嗓(需 RVC 声纹, v2 点亮)。合成演员声线本就是 AI, 不显此选择。
    var voiceMarkup = actor.is_real_person
      ? '<div class="ag-voicemode"><div class="ag-rt-label">' + esc(T("Voice", "声线")) + '</div><div class="ag-multi-row">' +
          '<button class="ag-mi on" data-vm="ai">🔊 ' + esc(T("AI voice (instant)", "AI 声线(即时)")) + '</button>' +
          '<button class="ag-mi" data-vm="own" disabled title="' + esc(T("Own-voice clone — coming soon (needs the actor's trained voice print)", "本人真嗓克隆 —— 敬请期待(需该演员已训练声纹)")) + '">🎤 ' + esc(T("Own voice", "本人真嗓")) + ' 🔒</button>' +
        '</div><div style="font-size:11.5px;color:#7fb8a3;margin-top:6px">' + esc(T("Likeness is the actor · voice is AI-generated.", "形象为本人 · 声线为 AI 生成。")) + '</div></div>'
      : "";
    modal.innerHTML = '<div class="box"><h3>🎬 ' + esc(T("Cast ", "选 ")) + name + esc(T(" — pick a format", " —— 选作品类型")) + '</h3>' +
      '<div class="sub">' + esc(T("Music-driven works are ready now. Scripted drama (short play / series / film) auto-writes a screenplay — coming soon.", "音乐类现在就能做。叙事类(短剧/剧集/电影)会自动编剧 —— 敬请期待。")) + '</div>' +
      voiceMarkup +
      '<div class="ag-wt">' + CAST_WORK_TYPES.map(function (w) {
        return '<button data-wt="' + w.key + '"' + (w.ready ? "" : " disabled") + '>' + (w.ready ? "" : "🔒 ") + w.emoji + ' ' + esc(T(w.en, w.zh)) + '<small>' + esc(T(w.descEn, w.descZh)) + '</small></button>';
      }).join("") + '</div></div>';
    modal.addEventListener("click", function (e) {
      if (e.target === modal) { modal.remove(); return; }
      var vm = e.target.closest && e.target.closest("button[data-vm]");
      if (vm) { if (vm.disabled) return; modal.querySelectorAll("button[data-vm]").forEach(function (x) { x.classList.toggle("on", x === vm); }); return; }
      var btn = e.target.closest && e.target.closest("button[data-wt]");
      if (!btn || btn.disabled) return;
      var wt = btn.getAttribute("data-wt");
      var vmSel = modal.querySelector("button[data-vm].on");
      window.__cssosCastVoiceMode = vmSel ? vmSel.getAttribute("data-vm") : "ai";
      modal.remove();
      openCastPanel(actor, wt);
    });
    root.appendChild(modal);
  }

  // ④ P1 选角面板 —— 选完格式后: 主角预填 + 文明智能联动推荐补齐反派/配角 + 手选/换 + 群演开关 → 生成。
  // 群演系统随机(可改手动); 推荐端点未部署时优雅回退到 /api/actors。角色槽走随机色 data-pill-bar。
  var CAST_FORMAT_SLOTS = {
    mv:       [{ role: "protagonist", alignment: "good",    en: "Lead",    zh: "主角",  emoji: "⭐" }],
    triptych: [{ role: "protagonist", alignment: "good",    en: "Lead",    zh: "主角",  emoji: "⭐" }, { role: "antagonist", alignment: "evil", en: "Villain", zh: "反派", emoji: "😈" }],
    opera:    [{ role: "protagonist", alignment: "good",    en: "Lead",    zh: "主角",  emoji: "⭐" }, { role: "antagonist", alignment: "evil", en: "Villain", zh: "反派", emoji: "😈" }, { role: "supporting", alignment: "neutral", en: "Support", zh: "配角", emoji: "🎭" }],
  };
  function castFormatKey(wt) { return (wt === "triptych" || wt === "opera") ? wt : "mv"; }

  function openCastPanel(seedActor, workType) {
    var root = document.getElementById(ROOT_ID); if (!root) { castRun(seedActor, workType); return; }
    var fmt = castFormatKey(workType);
    var slots = CAST_FORMAT_SLOTS[fmt] || CAST_FORMAT_SLOTS.mv;
    var picked = {};            // slotIdx → actor(seed 预填)
    picked[0] = seedActor;
    // ① 配角选择: 点进来的 seed 演员可选主角/反派/配角(影响 role/alignment/计费)。
    var CAST_ROLE_OPTS = [{ r: "protagonist", a: "good", en: "Lead", zh: "主角" }, { r: "antagonist", a: "evil", en: "Villain", zh: "反派" }, { r: "supporting", a: "neutral", en: "Support", zh: "配角" }];
    var seedRole = "protagonist", seedAlign = "good";
    var pools = {};             // slotIdx → 候选数组
    var extrasMode = "auto";    // auto=系统随机群演 | manual
    var civ = seedActor.civilization || "";
    // 跨槽去重: 同一演员不能占两个角色槽。
    function usedElsewhere(aid, slotI) { return Object.keys(picked).some(function (k) { return +k !== slotI && picked[k] && picked[k].actor_id === aid; }); }
    function autoFillSlot(i) { if (picked[i]) return; var p = pools[i] || []; picked[i] = p.find(function (c) { return !usedElsewhere(c.actor_id, i); }) || p[0] || null; }

    var modal = document.createElement("div"); modal.className = "ag-castmodal ag-castpanel";
    function slotThumb(a) {
      if (!a) return '<div class="ag-cs-empty">…</div>';
      return (a.cover_image ? '<img src="' + esc(imgProxy(a.cover_image, 120)) + '" alt="">' : '<span class="ag-cs-ini">' + esc(String(a.name_en || "?").charAt(0)) + '</span>');
    }
    function slotCard(slot, i) {
      var a = picked[i];
      var ml = a ? esc(a.mother_tongue || "") : "";
      return '<div class="ag-cs-slot" data-slot="' + i + '">' +
        '<div class="ag-cs-role">' + (i === 0
          ? esc(T("Your pick plays", "你选的出演")) + ' <select class="ag-cs-roled" data-seedrole>' + CAST_ROLE_OPTS.map(function (o) { return '<option value="' + o.r + '"' + (o.r === seedRole ? " selected" : "") + '>' + esc(T(o.en, o.zh)) + '</option>'; }).join("") + '</select>'
          : slot.emoji + ' ' + esc(T(slot.en, slot.zh))) + '</div>' +
        '<div class="ag-cs-pick">' + slotThumb(a) +
          '<div class="ag-cs-info"><div class="ag-cs-name">' + (a ? esc(a.name_en || a.name_zh) : esc(T("Recommending…", "推荐中…"))) + '</div>' +
            '<div class="ag-cs-sub">' + (a ? (esc(a.civilization || "") + (ml ? " · 🌐" + ml : "")) : "") + '</div></div>' +
          (i > 0 ? '<button class="ag-cs-swap" data-swap="' + i + '">🔀 ' + esc(T("Swap", "换")) + '</button>' : '') +
        '</div>' +
        (pools[i] && pools[i].length ? '<div class="ag-cs-pool" data-pool="' + i + '">' + pools[i].slice(0, 8).map(function (c, ci) {
          var dis = usedElsewhere(c.actor_id, i);
          return '<button class="ag-cs-cand' + (a && c.actor_id === a.actor_id ? ' on' : '') + (dis ? ' used' : '') + '"' + (dis ? ' disabled title="' + esc(T("Already cast in another role", "已在别的角色里")) + '"' : '') + ' data-pick="' + i + '" data-ci="' + ci + '">' + slotThumb(c) + '<span>' + esc(c.name_en || c.name_zh) + '</span></button>';
        }).join("") + '</div>' : "") +
        '</div>';
    }
    function render() {
      modal.innerHTML = '<div class="box ag-cs-box"><h3>🎬 ' + esc(T("Casting", "选角")) + ' · ' + esc(T(fmt === "mv" ? "Music video" : fmt, fmt)) + '</h3>' +
        '<div class="sub">' + esc(T("The system suggests a cast by civilization + role. Swap anyone; extras are auto-generated (or set manually).", "系统按文明+戏路联动荐角。任意可换;群演系统随机生成(也可手动)。")) + '</div>' +
        '<div class="ag-cs-slots">' + slots.map(slotCard).join("") + '</div>' +
        '<div class="ag-cs-extras"><span>👥 ' + esc(T("Extras", "群演")) + '</span>' +
          '<div class="ag-cs-extrabtns" data-pill-bar>' +
            '<button data-ex="auto" class="' + (extrasMode === "auto" ? "active" : "") + '" data-pill-key="auto">🎲 ' + esc(T("Auto", "系统随机")) + '</button>' +
            '<button data-ex="manual" class="' + (extrasMode === "manual" ? "active" : "") + '" data-pill-key="manual">✋ ' + esc(T("Manual", "手动")) + '</button>' +
          '</div></div>' +
        '<div class="ag-cs-cost">' + (function () { var t = 0; slots.forEach(function (s, i) { var a = picked[i]; if (a && a.is_premium) { var role = i === 0 ? seedRole : s.role, al = i === 0 ? seedAlign : s.alignment; var m = (al === "evil" || role === "antagonist") ? 1.3 : (role === "supporting" ? 0.5 : 1); t += Math.round((a.cast_price_cents || 0) * m); } }); return t > 0 ? "💎 " + esc(T("Cast total", "选角合计")) + " " + cents(t) + " · " + esc(T("from your wallet", "从钱包扣")) : "✅ " + esc(T("Free cast", "免费阵容")); })() + '</div>' +
        '<button class="ag-cast ag-cs-go">🎬 ' + esc(T("Cast & generate", "定角并生成")) + '</button>' +
        '</div>';
    }
    render();
    root.appendChild(modal);

    // ① seed 角色下拉切换。
    modal.addEventListener("change", function (e) {
      var s = e.target.closest && e.target.closest("[data-seedrole]");
      if (s) { seedRole = s.value; var o = CAST_ROLE_OPTS.find(function (x) { return x.r === seedRole; }); seedAlign = o ? o.a : "neutral"; }
    });

    // 拉推荐补齐非主角槽(优雅回退)。
    (function loadRecs() {
      var need = slots.map(function (s, i) { return { i: i, role: s.role, alignment: s.alignment }; }).filter(function (x) { return x.i > 0; });
      if (!need.length) return;
      fetch("/api/cast/recommend", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: fmt, civilization: civ, needed: need.map(function (n) { return { role: n.role, alignment: n.alignment }; }) }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (j && j.ok && Array.isArray(j.results)) {
            j.results.forEach(function (res, k) { pools[need[k].i] = res.candidates || []; });
            need.forEach(function (n) { autoFillSlot(n.i); });   // 顺序填, 去重
          } else { throw new Error("fallback"); }
          render();
        })
        .catch(function () {
          // 回退: 用已加载演员池(排除主角)按顺序填。
          var fb = (state.actors || []).filter(function (a) { return a.actor_id !== seedActor.actor_id; });
          need.forEach(function (n, k) { pools[n.i] = fb.slice(k * 8, k * 8 + 8); });
          need.forEach(function (n) { autoFillSlot(n.i); });   // 顺序填, 去重
          render();
        });
    })();

    modal.addEventListener("click", function (e) {
      if (e.target === modal) { modal.remove(); return; }
      var ex = e.target.closest && e.target.closest("button[data-ex]");
      if (ex) { extrasMode = ex.getAttribute("data-ex"); render(); return; }
      var cand = e.target.closest && e.target.closest("button[data-pick]");
      if (cand) { var pi = +cand.getAttribute("data-pick"), ci = +cand.getAttribute("data-ci"); if (pools[pi] && pools[pi][ci]) { picked[pi] = pools[pi][ci]; render(); } return; }
      var sw = e.target.closest && e.target.closest("button[data-swap]");
      if (sw) { var si = +sw.getAttribute("data-swap"); var p = pools[si] || []; if (p.length) { var cur = picked[si]; var idx = cur ? p.findIndex(function (c) { return c.actor_id === cur.actor_id; }) : -1; for (var t = 1; t <= p.length; t++) { var nx = p[(idx + t) % p.length]; if (nx && !usedElsewhere(nx.actor_id, si)) { picked[si] = nx; break; } } render(); } return; }
      var go = e.target.closest && e.target.closest(".ag-cs-go");
      if (go) {
        // 组装 cast → 记 window.__cssosCast(供 P2 后端整体接收)+ 主角走现有生成流。
        var cast = slots.map(function (s, i) { var a = picked[i]; if (!a) return null; return { actor_id: a.actor_id, role: i === 0 ? seedRole : s.role, alignment: i === 0 ? seedAlign : s.alignment, billing_order: i, name: (a.name_en || a.name_zh), role_label_en: s.en, role_label_zh: s.zh }; }).filter(Boolean);
        window.__cssosCast = { format: fmt, extras_mode: extrasMode, cast: cast };
        window.__cssosCastRole = seedRole; window.__cssosCastAlign = seedAlign;   // ③ seed 角色 → 后端分层计费
        modal.remove();
        castRun(seedActor, workType);   // seed 领衔进现有 MV 管线; 完整 cast 已备好待 P2 接收
      }
    });
  }

  // ⑤ 傻瓜式【导演入口】(数字演员初心): 选戏路 → 系统文明智能联动自动组好全阵容(+标题留空自动) →
  //   30s 倒计时不干预即自动【开拍】(可暂停/改任意项/立即开拍)→ 直接 startCreation 进 MV 面板边出边播。
  //   导演最少只需两步(选戏路 + 开拍), 或倒计时内零干预 ≈ 一键。全字符串走 T() i18N。
  var DG_CD_DEFAULT = 30;
  // 文明干预项(空=系统联动全自动; 值=库里原生 civilization 字符串, 供 recommend 精确匹配)。
  var DG_CIVS = [
    { en: "System", zh: "系统联动", v: "" }, { en: "Chinese", zh: "中华", v: "中华文明" },
    { en: "Japanese", zh: "日本", v: "日本古典" }, { en: "Greek", zh: "希腊", v: "古希腊文明" },
    { en: "Egyptian", zh: "埃及", v: "古埃及文明" }, { en: "Persian", zh: "波斯", v: "波斯文明" },
    { en: "Norse", zh: "北欧", v: "北欧神话" }, { en: "Indian", zh: "印度", v: "印度教神话" },
    { en: "Roman", zh: "罗马", v: "古罗马文明" }, { en: "Mesopotamian", zh: "美索", v: "美索不达米亚神话" },
  ];
  function openDirectorGate() {
    var root = document.getElementById(ROOT_ID) || document.body;
    var fmt = "mv", title = "", civ = "", style = "";
    var slots = CAST_FORMAT_SLOTS[fmt] || CAST_FORMAT_SLOTS.mv;
    var picked = {}, pools = {}, cdLeft = DG_CD_DEFAULT, cdTimer = null, started = false;
    var modal = document.createElement("div"); modal.className = "ag-castmodal ag-director";
    function stopCd() { if (cdTimer) { clearInterval(cdTimer); cdTimer = null; var p = modal.querySelector(".ag-dg-pause"); if (p) p.textContent = "▶"; } }
    function startCd() { stopCd(); var p = modal.querySelector(".ag-dg-pause"); if (p) p.textContent = "⏸"; cdTimer = setInterval(function () { cdLeft -= 1; if (cdLeft <= 0) { action(); return; } var b = modal.querySelector(".ag-dg-cd b"); if (b) b.textContent = cdLeft + "s"; }, 1000); }
    function fmtPills() {
      return CAST_WORK_TYPES.filter(function (w) { return w.ready; }).map(function (w) {
        var on = (w.key === fmt || (fmt === "mv" && w.key === "single"));
        return '<button class="ag-dg-fmt' + (on ? " on" : "") + '" data-fmt="' + w.key + '">' + w.emoji + ' ' + esc(T(w.en, w.zh)) + '</button>';
      }).join("");
    }
    function castPreview() {
      return slots.map(function (s, i) {
        var a = picked[i];
        return '<div class="ag-dg-role">' + s.emoji + ' <b>' + esc(T(s.en, s.zh)) + '</b> ' +
          (a ? '<span class="ag-dg-actor">' + (a.cover_image ? '<img src="' + esc(imgProxy(a.cover_image, 80)) + '">' : '') + esc(a.name_en || a.name_zh) + '</span>' : '<i>' + esc(T("casting…", "联动选角中…")) + '</i>') +
          (a && i > 0 ? ' <button class="ag-dg-swap" data-dgswap="' + i + '">🔀</button>' : '') + '</div>';
      }).join("");
    }
    function render() {
      modal.innerHTML = '<div class="box ag-dg-box"><h3>🎬 ' + esc(T("Direct a work", "开拍")) + '</h3>' +
        '<div class="sub">' + esc(T("Pick a format — the system casts the actors and writes the rest. Change anything, or just let it roll.", "选个戏路 —— 系统自动选角、补齐其余(文明·风格·歌词)。可改任意项, 或直接让它开拍。")) + '</div>' +
        '<div class="ag-dg-fmts" data-pill-bar>' + fmtPills() + '</div>' +
        '<div class="ag-dg-label">🌍 ' + esc(T("Civilization (blank = system)", "文明(默认系统联动)")) + '</div>' +
        '<div class="ag-dg-civs">' + DG_CIVS.map(function (c) { return '<button class="ag-dg-civ' + (c.v === civ ? " on" : "") + '" data-dgciv="' + esc(c.v) + '">' + esc(T(c.en, c.zh)) + '</button>'; }).join("") + '</div>' +
        '<input class="ag-in ag-dg-title" placeholder="' + esc(T("Title — blank = system names it", "标题 —— 留空则系统智能命名")) + '" value="' + esc(title) + '">' +
        '<input class="ag-in ag-dg-style" placeholder="' + esc(T("Style / vibe — blank = auto", "风格 / 氛围 —— 留空自动")) + '" value="' + esc(style) + '">' +
        '<div class="ag-dg-label">🎭 ' + esc(T("Cast (system-recommended, swap freely)", "阵容(系统荐, 可换)")) + '</div>' +
        '<div class="ag-dg-cast">' + castPreview() + '</div>' +
        '<div class="ag-dg-row"><button class="ag-cast ag-dg-go">🎬 ' + esc(T("Action!", "开拍!")) + '</button>' +
          '<span class="ag-dg-cd">' + (cdTimer ? esc(T("auto in", "自动开拍")) + ' <b>' + cdLeft + 's</b>' : esc(T("paused · your call", "已停 · 你定"))) + ' <button class="ag-dg-pause">' + (cdTimer ? "⏸" : "▶") + '</button></span></div></div>';
    }
    function autoPick() {
      slots.forEach(function (s, i) {
        var used = Object.keys(picked).filter(function (k) { return +k !== i; }).map(function (k) { return picked[k] && picked[k].actor_id; });
        picked[i] = (pools[i] || []).find(function (c) { return used.indexOf(c.actor_id) < 0; }) || (pools[i] || [])[0] || null;
      });
      render();
    }
    function loadCast() {
      picked = {}; pools = {}; render();
      fetch("/api/cast/recommend", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: fmt, civilization: civ }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.ok && Array.isArray(j.results)) { j.results.forEach(function (res, i) { pools[i] = res.candidates || []; }); autoPick(); } else { throw new Error("fb"); } })
        .catch(function () { var fb = (state.actors || []); slots.forEach(function (s, i) { pools[i] = fb.slice(i * 6, i * 6 + 6); }); autoPick(); });
    }
    function action() {
      if (started) return; var proto = picked[0]; if (!proto) return; started = true; stopCd();
      var cast = slots.map(function (s, i) { var a = picked[i]; return a ? { actor_id: a.actor_id, role: s.role, alignment: s.alignment, billing_order: i, name: (a.name_en || a.name_zh), role_label_en: s.en, role_label_zh: s.zh } : null; }).filter(Boolean);
      window.__cssosCast = { format: fmt, extras_mode: "auto", cast: cast };
      window.__cssosCastActorId = proto.actor_id; window.__cssosCastActorName = proto.name_en || proto.name_zh;
      window.__cssosCastRole = "protagonist"; window.__cssosCastAlign = "good";
      var others = cast.filter(function (m) { return m.actor_id !== proto.actor_id; });
      var tv = title.trim();
      modal.remove(); try { close(); } catch (_e) {}
      if (typeof window.cssosGuidedToast === "function") window.cssosGuidedToast("🎬 " + T("Action!", "开拍!") + " " + T("Starring", "主演") + " " + (proto.name_en || proto.name_zh) + (others.length ? " · " + others.map(function (m) { return T(m.role_label_en || m.role, m.role_label_zh || m.role) + " " + m.name; }).join(" · ") : ""), {});
      if (typeof startCreation === "function") startCreation(tv, "", { source: "director", workType: fmt, style: (style.trim() || undefined), civilization: (civ || undefined) });
      else castRun(proto, fmt === "mv" ? "single" : fmt);
    }
    modal.addEventListener("click", function (e) {
      if (e.target === modal) { stopCd(); modal.remove(); return; }
      var f = e.target.closest && e.target.closest("[data-fmt]");
      if (f) { var k = f.getAttribute("data-fmt"); fmt = (k === "single") ? "mv" : k; slots = CAST_FORMAT_SLOTS[fmt] || CAST_FORMAT_SLOTS.mv; cdLeft = DG_CD_DEFAULT; loadCast(); startCd(); return; }
      var cv = e.target.closest && e.target.closest("[data-dgciv]");
      if (cv) { civ = cv.getAttribute("data-dgciv"); stopCd(); loadCast(); return; }   // 干预文明 → 停倒计时 + 按文明重荐角
      if (e.target.closest && e.target.closest(".ag-dg-go")) { action(); return; }
      if (e.target.closest && e.target.closest(".ag-dg-pause")) { if (cdTimer) stopCd(); else startCd(); return; }
      var sw = e.target.closest && e.target.closest("[data-dgswap]");
      if (sw) { stopCd(); var si = +sw.getAttribute("data-dgswap"); var p = pools[si] || []; if (p.length) { var cur = picked[si]; var idx = cur ? p.findIndex(function (c) { return c.actor_id === cur.actor_id; }) : -1; var used = Object.keys(picked).filter(function (k) { return +k !== si; }).map(function (k) { return picked[k] && picked[k].actor_id; }); for (var t = 1; t <= p.length; t++) { var nx = p[(idx + t) % p.length]; if (nx && used.indexOf(nx.actor_id) < 0) { picked[si] = nx; break; } } render(); } return; }
    });
    // 改标题 = 导演在干预 → 暂停倒计时(不重渲, 免丢焦点)。
    // 任一干预(标题/风格)→ 立即停倒计时(用户干预最高优先, 系统停下)。
    modal.addEventListener("input", function (e) {
      if (e.target.closest && e.target.closest(".ag-dg-title")) { title = e.target.value; stopCd(); }
      else if (e.target.closest && e.target.closest(".ag-dg-style")) { style = e.target.value; stopCd(); }
    });
    render(); root.appendChild(modal);
    loadCast(); startCd();
  }
  window.cssosOpenDirectorGate = openDirectorGate;

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
              if (isCreate) { b.__actorId = aid; if (window.__cssosCastRole) b.__actorRole = window.__cssosCastRole; if (window.__cssosCastAlign) b.__actorAlignment = window.__cssosCastAlign; }
              // ④ P2/P3(W1536) — 把整份多角色 cast 一并注入: 建档→记录+计费; cover/video→同框多人锁脸。
              if (window.__cssosCast && Array.isArray(window.__cssosCast.cast) && window.__cssosCast.cast.length && !b.cast) { b.cast = window.__cssosCast.cast; }
              init = Object.assign({}, init, { body: JSON.stringify(b) });
              if (isCreate) {
                // 建档完成即视为选角落定, 清待选角; 同时记下 {workId, actorName} 供作品出炉后弹分享(第2落点)。
                var p = orig.call(this, input, init);
                var castName = window.__cssosCastActorName;
                return p.then(function (res) {
                  try { window.__cssosCastActorId = null; } catch (_e) {}
                  try {
                    res.clone().json().then(function (j) {
                      var wid = j && (j.work_id || j.id || (j.work && j.work.id) || (j.data && j.data.work_id));
                      if (wid && castName) window.__cssosCastShare = { workId: String(wid), actorName: castName };
                    }).catch(function () {});
                  } catch (_e2) {}
                  return res;
                });
              }
            }
          }
        }
      } catch (_e) { /* 注入失败不影响原请求 */ }
      return orig.call(this, input, init);
    };
    // 第2落点: 选角作品一旦成为当前作品(出炉/开播)→ 弹「XX 主演的 MV 出炉了, 分享?」一次性。
    window.addEventListener("cssos:work-id-changed", function (ev) {
      var cs = window.__cssosCastShare; if (!cs) return;
      var d = (ev && ev.detail) || {};
      var wid = String(d.work_id || d.workId || d.id || "");
      if (!wid || wid !== cs.workId) return;
      window.__cssosCastShare = null;   // 一次性
      if (typeof window.cssosGuidedToast === "function") {
        window.cssosGuidedToast(T("🎬 " + cs.actorName + " is now starring in your MV! Share it?", "🎬 " + cs.actorName + " 主演的 MV 出炉了!分享一下?"), {
          actions: [{ label: T("Share", "分享"), onClick: function () { if (typeof window.openCssosShareDialog === "function") window.openCssosShareDialog({ workId: cs.workId }); } }],
        });
      }
    }, { passive: true });
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
      downgradeCoverThumb(c);   // 收起 = 封面换回 440 缩略, 释放 1080 高清解码内存
    });
    if (wasThis) return;   // 再点一次 = 收起
    cardEl.classList.add("expanded");
    upgradeCoverHiRes(cardEl); // 展开 = 封面换 1080 高清(同一张图, 代理换宽度; 收起再释放)
    var inline = cardEl.querySelector(".ag-inline");
    inline.innerHTML = '<div class="ag-skel" style="height:120px;margin-top:10px"></div>';
    cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    fillExpand(cardEl, id);
  }
  // 释放 WebGL/GLB 资源(model-viewer 不主动释放 GL 上下文, 连着浏览会撞上下文上限/OOM → 强退)。
  function disposeModelViewers(el) {
    if (!el || !el.querySelectorAll) return;
    el.querySelectorAll("model-viewer").forEach(function (m) {
      try { m.removeAttribute("src"); m.removeAttribute("ios-src"); m.removeAttribute("poster"); if (m.parentNode) m.parentNode.removeChild(m); } catch (_e) {}
    });
  }
  function restoreCover2D(cardEl) {
    var cov = cardEl.querySelector("[data-cover]");
    if (cov) { disposeModelViewers(cov); if (cov.__cover2d != null) { cov.innerHTML = cov.__cover2d; cov.__cover2d = null; } }
  }
  // 展开: 封面缩略图(/img?w=440)升到高清(/img?w=1080)。只对经代理的图有效(外链原图/占位不动)。
  // 收起时 downgradeCoverThumb 换回 440 → 浏览器丢弃 1080 解码位图, 内存回落。进出反复 = 换宽度参数,
  // 高清版命中 30 天 HTTP 缓存, 无重复下载; 任一时刻只有【当前展开的那一张】高清活在内存里。
  function upgradeCoverHiRes(cardEl) {
    var img = cardEl.querySelector("[data-cover] img");
    if (!img) return;
    var cur = (img.getAttribute("src") === AG_BLANK ? img.dataset.agSrc : img.getAttribute("src")) || "";
    if (cur.indexOf("/img?") < 0 || img.dataset.agThumb) return; // 非代理图 / 已升清
    img.dataset.agThumb = cur;
    img.src = cur.replace(/([?&])w=\d+/, "$1w=1080");
  }
  function downgradeCoverThumb(cardEl) {
    var img = cardEl.querySelector("[data-cover] img");
    if (img && img.dataset.agThumb) { img.src = img.dataset.agThumb; delete img.dataset.agThumb; }
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
        var counts = d.counts || {};
        // 详情【接着上一行】显示在同一框里, 不重复姓名/风格。
        inline.innerHTML =
          '<div class="ag-sub" style="margin-top:8px">' + (a.origin_type === "civilization" ? "🏛 " + esc(T("Legend", "文明演员")) : "✨ " + esc(T("Original", "原创合成"))) +
            (a.is_premium
              ? ' · 😇 ' + cents(a.cast_price_cents) + ' · 😈 ' + cents(Math.round((a.cast_price_cents || 0) * 1.3))
              : " · " + esc(T("Free", "免费"))) + ' · ▶ ' + (a.cast_count || 0) + "</div>" +
            (a.is_premium ? '<div class="ag-sub" style="font-size:12px;opacity:.75">' + esc(T("Villain roles +30% (harder to play, scene-stealers)", "反派角色 +30%(更难演、更抢戏)")) + '</div>' : "") +
          (a.persona ? '<div class="ag-persona">' + esc(a.persona) + '</div>' : "") +
          (tags.length ? '<div class="ag-tags">' + tags.map(function (t) { return '<span class="ag-tag">' + esc(t) + '</span>'; }).join("") + '</div>' : "") +
          '<div class="ag-showcase">' +
            '<button class="ag-sc-btn" data-seg="intro">▶ ' + esc(T("Intro", "自我介绍")) + '</button>' +
            '<button class="ag-sc-btn" data-seg="hero">😇 ' + esc(T("Hero", "正派")) + '</button>' +
            '<button class="ag-sc-btn" data-seg="villain">😈 ' + esc(T("Villain", "反派")) + '</button>' +
          '</div>' +
          '<div class="ag-stage" aria-live="polite"></div>' +
          '<div class="ag-cta-cap">' +
            '<button class="ag-cast" data-pill-key="cast" title="' + esc(T("Works performed in", "出演作品数")) + '">🎬 ' + esc(T("Cast in an MV", "选 TA 主演")) + ' <span class="ag-cnt">' + (counts.appearances || 0) + '</span></button>' +
            '<button class="ag-comment" data-pill-key="comment">💬 ' + esc(T("Comment", "评论")) + ' <span class="ag-cnt">' + (counts.comments || 0) + '</span></button>' +
            '<button class="ag-share" data-pill-key="share" title="' + esc(T("Share this actor", "分享这位演员")) + '">↗ ' + esc(T("Share", "分享")) + ' <span class="ag-cnt">' + (counts.shares || 0) + '</span></button>' +
          '</div>' +
          '<div class="ag-comments" hidden><h3>💬 ' + esc(T("Comments", "评论")) + '</h3><div class="ag-cmt-input"><textarea class="ag-cmt-text" rows="1" placeholder="' + esc(T("Say something about this actor…", "聊聊这位演员…")) + '" maxlength="800"></textarea><button class="ag-cmt-send">' + esc(T("Post", "发布")) + '</button></div><div class="ag-cmt-list"></div></div>' +
          (mvs.length ? '<div class="ag-sec"><h3>' + esc(T("Appearances", "出演作品")) + (state.ownedSet[a.actor_id] ? ' · ' + esc(T("free to watch", "本人免费欣赏")) : "") + '</h3><div class="ag-grid ag-sub-grid">' +
            mvs.map(function (m) { return '<div class="ag-card ag-appear" data-work="' + esc(m.work_id) + '" style="cursor:pointer"><div class="ag-cover">' + coverInner({ cover_image: m.cover_url, name_en: m.title, cover_focal_x: m.cover_focal_x, cover_focal_y: m.cover_focal_y }, false) +
              '</div><div class="ag-meta"><div class="ag-name">▶ ' + esc(m.title || "Untitled") + '</div>' +
              (state.ownedSet[a.actor_id] ? '<button class="ag-report" data-actor="' + esc(a.actor_id) + '" data-work="' + esc(m.work_id) + '" style="margin-top:4px;font-size:11px;background:rgba(255,120,120,.14);border:1px solid rgba(255,120,120,.4);color:#ffb3b3;border-radius:999px;padding:2px 9px;cursor:pointer">🚩 ' + esc(T("Report misuse", "举报滥用")) + '</button>' : "") +
              '</div></div>'; }).join("") + '</div></div>' : "");
        // 展开【默认显示精致 2D 封面】(不再自动加载 3D)——3D 的 WebGL/9MB GLB 很吃内存, 连着浏览会 OOM 强退。
        // 3D 改为【显式点击】按需加载(省内存 + 展示更精致的 2D 原色封面)。
        cardEl.__actor = a;
        var cov0 = cardEl.querySelector("[data-cover]");
        if (cov0) {
          // 右下角切换: 完整封面图(不裁切, 显示整张)⇄ 收起。取代之前的 3D 徽标(3D=9MB GLB 太吃内存)。
          var bCov = document.createElement("button");
          bCov.className = "ag-3d-badge"; bCov.type = "button";
          bCov.textContent = "🖼 " + T("Full cover", "完整封面");
          bCov.onclick = function (ev) {
            ev.stopPropagation();
            var full = cov0.classList.toggle("ag-cover-full");
            bCov.textContent = full ? ("🔼 " + T("Collapse", "收起")) : ("🖼 " + T("Full cover", "完整封面"));
          };
          cov0.appendChild(bCov);
        }
        // 选角/评论/分享 走平台胶囊(与顶部筛选条同一套凹凸镶嵌); Cast 恒为凸绿主段(动作条, 非筛选)。
        var ctaBar = inline.querySelector(".ag-cta-cap");
        function runCta(key) {
          if (key === "cast") openCast(a);
          else if (key === "comment") toggleComments(inline, a.actor_id);
          else if (key === "share") shareActor(a);
        }
        if (ctaBar && typeof window.cssosMakePillBar === "function") {
          var ctaCtl = window.cssosMakePillBar(ctaBar, { mono: true, compact: true, textColor: "light", activeKey: "cast", onActivate: function (key) { runCta(key); if (ctaCtl) ctaCtl.setActive("cast"); } });
        } else if (ctaBar) {
          ctaBar.querySelectorAll("button[data-pill-key]").forEach(function (b) { b.onclick = function () { runCta(b.getAttribute("data-pill-key")); }; });
        }
        // 戏路标签也套同一胶囊轨道(纯几何, 无激活/无点击) —— 与上方筛选条视觉一致。
        var tagsBar = inline.querySelector(".ag-tags");
        if (tagsBar && tagsBar.children.length && typeof window.cssosPillBarStamp === "function") window.cssosPillBarStamp(tagsBar, "light", true);
        wireShowcase(inline, a.actor_id);
        if (state.ownedSet[a.actor_id]) {
          var own = document.createElement("div"); own.className = "ag-owner";
          own.innerHTML = '<span class="ag-tag">🎬 ' + esc(T("Mine", "我的演员")) + ' · ' + esc(T("royalty", "版税")) + ' ' + Math.round((a.creator_royalty || 0.7) * 100) + '%</span>' +
            (a.is_real_person ? '<button class="ag-revoke ag-del">' + esc(T("Revoke consent", "撤回授权")) + '</button>' : '') +
            '<button class="ag-del ag-del-actor">' + esc(T("Delete", "删除")) + '</button>';
          inline.appendChild(own);
          // 左下三件套套胶囊(纯几何, Mine 首枚激活凸绿; Revoke/Delete 保留各自 onclick)。
          if (typeof window.cssosPillBarStamp === "function") window.cssosPillBarStamp(own, "light", true);
          // 「在哪用在哪改」: 点名字即可改名(仅自己的演员)。
          var nameEl = cardEl.querySelector(".ag-name");
          if (nameEl && !nameEl.__renamable) {
            nameEl.__renamable = true; nameEl.classList.add("ag-editable"); nameEl.title = T("Click to rename", "点击改名");
            // 整行都可点改名: .ag-name 撑满整行 + 手型光标(点空白处也触发)。
            nameEl.style.display = "block"; nameEl.style.width = "100%"; nameEl.style.cursor = "pointer";
            nameEl.innerHTML = '<span class="ag-nametext" style="cursor:text">' + esc(a.name_en || a.name_zh || "") + '</span> <span style="opacity:.55;font-size:12px;cursor:pointer">✎</span>';
            var textEl = nameEl.querySelector(".ag-nametext");
            function startRename() {
              if (textEl.getAttribute("contenteditable") === "true") return;
              var orig = textEl.textContent;
              textEl.setAttribute("contenteditable", "true");
              textEl.style.cssText = "cursor:text;outline:1.5px solid rgba(0,245,160,.85);border-radius:4px;padding:1px 5px;background:rgba(0,245,160,.08)";
              textEl.focus();
              try { var rg = document.createRange(); rg.selectNodeContents(textEl); var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(rg); } catch (_e) {}
              var done = false;
              function finish(save) {
                if (done) return; done = true;
                textEl.setAttribute("contenteditable", "false"); textEl.style.cssText = "cursor:text";
                var nv = String(textEl.textContent || "").trim();
                if (!save || nv.length < 2 || nv === orig) { textEl.textContent = orig; return; }
                textEl.textContent = nv;
                fetch("/api/actors/" + encodeURIComponent(a.actor_id), { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name_en: nv }) })
                  .then(function (r) { return r.json(); }).then(function (jj) {
                    if (jj && jj.ok) { a.name_en = nv; for (var i = 0; i < state.actors.length; i++) if (state.actors[i].actor_id === a.actor_id) state.actors[i].name_en = nv; if (window.cssosGuidedToast) window.cssosGuidedToast("✓ " + nv, {}); }
                    else { textEl.textContent = orig; window.alert(T("Rename failed.", "改名失败。")); }
                  }).catch(function () { textEl.textContent = orig; window.alert(T("Network error.", "网络错误。")); });
              }
              textEl.addEventListener("keydown", function onk(e) { if (e.key === "Enter") { e.preventDefault(); textEl.removeEventListener("keydown", onk); textEl.blur(); finish(true); } else if (e.key === "Escape") { e.preventDefault(); textEl.removeEventListener("keydown", onk); finish(false); textEl.blur(); } });
              textEl.addEventListener("blur", function onb() { textEl.removeEventListener("blur", onb); finish(true); });
            }
            nameEl.onclick = function (ev) { ev.stopPropagation(); startRename(); };
          }
          var revokeBtn = own.querySelector(".ag-revoke");
          if (revokeBtn) revokeBtn.onclick = function () {
            if (!window.confirm(T("Revoke consent? Your actor is taken down and can no longer be cast.", "撤回授权?演员将下架、不再可被选用。"))) return;
            fetch("/api/actors/" + encodeURIComponent(a.actor_id) + "/revoke-consent", { method: "POST", credentials: "include" }).then(function (r) { return r.json(); }).then(function (jj) {
              if (jj && jj.ok) { window.alert(T("Consent revoked. Actor taken down.", "已撤回授权,演员已下架。")); renderGrid(); } else window.alert(T("Failed.", "操作失败。"));
            }).catch(function () {});
          };
          own.querySelector(".ag-del-actor").onclick = function () {
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
    if (typeof speakStop === "function") speakStop();
    var root = document.getElementById(ROOT_ID);
    if (root) root.querySelectorAll(".ag-sc-btn.playing").forEach(function (b) { b.classList.remove("playing"); });
  }
  function playClip(clip, btn, stage) {
    stopShowcase();
    if (!clip || !clip.voice_url) { stage.textContent = T("(missing)", "(此段暂缺)"); return; }
    var toks = (clip.subtitle && clip.subtitle.tokens) || [];
    // 后端 token 跳过了空格 → 从【完整台词(含空格/断词)】逐字渲染, 非空格字符按序取 token 时间,
    //   空格沿用上一个时间。这样英文单词之间有空格、不再连成一坨。
    var fullText = clip.text || (toks.length ? toks.map(function (t) { return t.char; }).join("") : "");
    var karaoke = "", ti = 0, lastTs = 0;
    if (fullText) {
      for (var ci = 0; ci < fullText.length; ci++) {
        var ch = fullText[ci], ts;
        if (/\S/.test(ch) && ti < toks.length) { ts = toks[ti].t_start; lastTs = ts; ti++; }
        else { ts = lastTs; }
        karaoke += '<span class="tk" data-ts="' + ts + '">' + esc(ch) + '</span>';
      }
    }
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
      scAudio.onended = function () { btn.classList.remove("playing"); if (scRAF) cancelAnimationFrame(scRAF); speakStop(); };
    }
    // 让 3D「开口说话」: 播音频时, 封面里的 3D 模型跟每个音节【点头+律动】(TripoSR 静态网格不能真动嘴唇,
    //   用整体律动+旋转造出"在说话"的活感)。纯字幕 token 时间轴驱动, 不接 Web Audio(铁律)。
    var mv = card ? card.querySelector("[data-cover] model-viewer") : null;
    function tick() {
      if (!scAudio) return;
      var ms = timeSrc() * 1000;
      for (var i = 0; i < spans.length; i++) {
        var ts = +spans[i].getAttribute("data-ts") || 0;
        spans[i].classList.toggle("on", ms >= ts - 40);
      }
      // 律动: 当前是否正在发某个音节(用 token 区间判断)。
      var speaking = false, intensity = 0;
      for (var k = 0; k < toks.length; k++) { var t = toks[k]; if (ms >= t.t_start && ms < t.t_end) { speaking = true; intensity = Math.max(intensity, t.emotion_intensity || 0.5); } }
      if (mv) {
        // 说到音节时嘴部区域律动(点头 nod + 轻微竖向挤压=口型开合的错觉), 停顿时归位。
        var ph = ms / 90;   // 音节内快速开合
        var open = speaking ? (0.5 + 0.5 * Math.abs(Math.sin(ph))) * (0.5 + intensity) : 0;
        mv.style.transform = "translateY(" + (-open * 4).toFixed(2) + "px) scaleY(" + (1 + open * 0.03).toFixed(3) + ")";
        mv.style.transformOrigin = "50% 62%";
      }
      scRAF = requestAnimationFrame(tick);
    }
    scRAF = requestAnimationFrame(tick);
  }
  function speakStop() { var root = document.getElementById(ROOT_ID); if (!root) return; root.querySelectorAll("[data-cover] model-viewer").forEach(function (m) { m.style.transform = ""; }); }
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
      window.cssosMakePillBar(showcaseBar, { mono: true, compact: true, textColor: "light", activeKey: "intro", onActivate: function (key, pill) { trigger(pill, key); } });
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
          'camera-controls touch-action="pan-y" auto-rotate auto-rotate-delay="0" rotation-per-second="26deg" ' +
          'camera-orbit="0deg 90deg 100%" min-camera-orbit="auto 70deg auto" max-camera-orbit="auto 110deg auto" field-of-view="28deg" ' +
          'interaction-prompt="none" ar ar-modes="quick-look webxr" exposure="1.0" tone-mapping="neutral" shadow-intensity="0" ' +
          'style="' + mvStyle + '"></model-viewer>';
        // TripoSR 网格朝向常有偏差 → 载入后自动把【人脸】转到正前(用包围盒朝向估算不可靠, 这里给默认无偏,
        //   随 auto-rotate 会扫到正面; 如需锁定正面朝向, 见 model_3d 生成端的坐标归一)。
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
    if (typeof stopRpStream === "function") stopRpStream();
    var el = document.getElementById(ROOT_ID);
    if (el) { disposeModelViewers(el); el.remove(); }
  }

  function open(force, soloId) {
    ensureStyle();
    var existing = document.getElementById(ROOT_ID);
    if (existing && !force) return;
    if (existing) existing.remove();
    var el = document.createElement("div");
    el.id = ROOT_ID;
    el.innerHTML =
      '<div class="ag-bar">' +
        '<div class="ag-title">🎭 <b>' + esc(T("Digital Actors", "数字演员")) + '</b></div>' +
        '<button class="ag-direct" onclick="cssosOpenDirectorGate()" title="' + esc(T("Pick a format — system casts & rolls", "选戏路 —— 系统选角自动开拍")) + '">🎬 ' + esc(T("Direct", "开拍")) + '</button>' +
        '<div class="ag-spacer"></div>' +
        '<div class="ag-topcap">' +   // 三段单选(成为演员/创建/搜索)走平台 cssosMakePillBar
          '<button class="ag-signup" data-pill-key="signup">🙋 ' + esc(T("Become an actor", "成为真人演员")) + '</button>' +
          '<button class="ag-create" data-pill-key="create">＋ ' + esc(T("Create", "创建演员")) + '</button>' +
          '<input class="ag-search" type="search" data-pill-key="search" placeholder="' + esc(T("🔍 Search actors…", "🔍 搜索演员…")) + '">' +
        '</div>' +
        '<button class="ag-x" aria-label="close">×</button>' +
      '</div>' +
      '<div class="ag-filters" data-pill-bar>' +
        '<button class="ag-chip on" data-f="all">🎭 ' + esc(T("All", "全部")) + '</button>' +
        '<button class="ag-chip" data-f="synthetic">✨ ' + esc(T("Original", "原创合成")) + '</button>' +
        '<button class="ag-chip" data-f="civilization">🏛 ' + esc(T("Legends", "文明名角")) + '</button>' +
        '<button class="ag-chip" data-f="premium">💎 ' + esc(T("Premium", "溢价")) + '</button>' +
        '<button class="ag-chip" data-f="female">👩 ' + esc(T("Female", "女性")) + '</button>' +
        '<button class="ag-chip" data-f="male">👨 ' + esc(T("Male", "男性")) + '</button>' +
        '<button class="ag-chip" data-f="neutral">🧑 ' + esc(T("Neutral", "中性")) + '</button>' +
        '<button class="ag-chip" data-f="owned">🎬 ' + esc(T("Mine", "我的演员")) + '</button>' +
      '</div>' +
      // 戏路大类筛选(横滑)
      '<div class="ag-filters ag-archfilters">' +
        '<button class="ag-chip ag-af on" data-arch="">🎭 ' + esc(T("All roles", "全部戏路")) + '</button>' +
        ROLE_TAXONOMY.map(function (a) { return '<button class="ag-chip ag-af" data-arch="' + a.key + '">' + a.emoji + ' ' + esc(T(a.en, a.zh)) + '</button>'; }).join("") +
      '</div>' +
      '<div class="ag-scroll"></div>';
    document.body.appendChild(el);
    el.querySelector(".ag-x").onclick = close;
    // 顶部三段(成为演员/创建/搜索)= 单选胶囊轨道, 走平台 cssosMakePillBar(含 <input> 段)。
    var topcap = el.querySelector(".ag-topcap");
    if (topcap && typeof window.cssosMakePillBar === "function") {
      agTopcapCtl = window.cssosMakePillBar(topcap, {
        mono: true, textColor: "light", compact: true, activeKey: "signup",
        onActivate: function (key) {
          // 搜索段是 <input>, 点击即原生聚焦, 无需在此 focus(否则与 change 事件成回环卡住焦点)。
          if (key === "create") renderCreateForm();
          else if (key === "signup") renderRealPersonSignup();
        },
      });
    } else {
      var createBtn = el.querySelector(".ag-create");
      if (createBtn) createBtn.onclick = function () { renderCreateForm(); };
      var signupBtn = el.querySelector(".ag-signup");
      if (signupBtn) signupBtn.onclick = function () { renderRealPersonSignup(); };
    }
    // 5 个筛选 = 凹凸镶嵌胶囊轨道: 优先用平台 cssosMakePillBar(胶囊宪法), 否则退回普通 chip。
    var filterBar = el.querySelector(".ag-filters");
    filterBar.querySelectorAll(".ag-chip").forEach(function (c) { c.setAttribute("data-pill-key", c.getAttribute("data-f")); });
    function applyFilterKey(key) { state.filter = key; resetRows(); if (state.solo) { state.solo = null; loadActors(); return; } renderGrid(); }
    if (typeof window.cssosMakePillBar === "function") {
      filterBar.classList.add("ag-pillbar");
      window.cssosMakePillBar(filterBar, { mono: true, textColor: "light", activeKey: "all", onActivate: applyFilterKey });
    } else {
      filterBar.querySelectorAll(".ag-chip").forEach(function (c) {
        c.onclick = function () {
          filterBar.querySelectorAll(".ag-chip").forEach(function (x) { x.classList.toggle("on", x === c); });
          applyFilterKey(c.getAttribute("data-f"));
        };
      });
    }
    // 戏路大类筛选(独立行, 客户端过滤) = 凹凸镶嵌胶囊(胶囊宪法)。
    var archBar = el.querySelector(".ag-archfilters");
    if (archBar) {
      function applyArch(key) { state.archetype = key === "all" ? "" : key; resetRows(); if (state.solo) { state.solo = null; loadActors(); return; } renderGrid(); }
      archBar.querySelectorAll(".ag-af").forEach(function (c) { c.setAttribute("data-pill-key", c.getAttribute("data-arch") || "all"); });
      if (typeof window.cssosMakePillBar === "function") {
        archBar.classList.add("ag-pillbar");
        window.cssosMakePillBar(archBar, { mono: true, textColor: "light", activeKey: "all", onActivate: applyArch });
      } else {
        archBar.querySelectorAll(".ag-af").forEach(function (c) {
          c.onclick = function () {
            archBar.querySelectorAll(".ag-af").forEach(function (x) { x.classList.toggle("on", x === c); });
            applyArch(c.getAttribute("data-arch") || "all");
          };
        });
      }
    }
    var si = el.querySelector(".ag-search");
    si.oninput = function () { state.search = si.value.trim(); resetRows(); if (state.solo) { state.solo = null; loadActors(); return; } renderGrid(); };
    si.onfocus = function () { setTopcapActive("search"); };
    si.onblur = function () { if (!si.value.trim()) setTopcapActive("signup"); };
    el.querySelector(".ag-scroll").addEventListener("click", function (e) {
      var t = e.target;
      // 展开区内的交互元素(台词胶囊/选角/作者/出演子卡/model-viewer)不劫持。
      // 🚩 举报滥用(演员本人)。
      var rep = t.closest && t.closest(".ag-report");
      if (rep) {
        var rReason = window.prompt(T("Describe the misuse (e.g. defamatory / sexual / political misuse of your likeness):", "描述滥用情况(如:诽谤/色情/政治滥用你的肖像):"), "");
        if (rReason != null) {
          fetch("/api/actors/report-misuse", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ actor_id: rep.getAttribute("data-actor"), work_id: rep.getAttribute("data-work"), reason: rReason }) })
            .then(function (r) { return r.json(); }).then(function (j) { window.alert(j && j.ok ? T("Reported. The platform will review; if confirmed, that user loses trust credit.", "已举报。平台将核实;属实将扣该用户信用分。") : T("Report failed.", "举报失败。")); }).catch(function () {});
        }
        return;
      }
      // 出演作品卡 → 打开观看(演员本人对参演作品免费)。
      var appear = t.closest && t.closest(".ag-appear[data-work]");
      if (appear) {
        var wid = appear.getAttribute("data-work");
        if (wid && typeof window.cssosOpenWork === "function") { close(); window.cssosOpenWork(wid); }
        return;
      }
      if (t.closest && (t.closest(".ag-editable") || t.closest(".ag-showcase") || t.closest(".ag-cta-cap") || t.closest(".ag-comments") || t.closest(".ag-tags") || t.closest(".ag-cast") || t.closest(".ag-owner") || t.closest(".ag-sub-grid") || t.closest("model-viewer") || t.closest(".ag-stage"))) return;
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
    if (soloId) { state.solo = soloId; loadSoloActor(soloId); }   // 分享深链: 只这一位
    else { state.solo = null; loadActors(); }
  }

  window.cssosOpenActorGallery = open;
  // 分享深链 /?actor=<id>: 打开图鉴并展开该演员(网格异步加载, 轮询到卡片再展开; 不在已加载行内则扩行)。
  window.cssosOpenActor = function (id) {
    if (!id) { open(1); return; }
    open(1, id);   // solo: 只拉这一位演员并展开, 不全量加载(分享进来不会顶不住)。
  };
  function readActorDeeplink() {
    try {
      var m = (location.search || "").match(/[?&]actor=([^&]+)/);
      if (m) window.cssosOpenActor(decodeURIComponent(m[1]));
    } catch (_e) {}
  }
  if (document.readyState !== "loading") readActorDeeplink();
  else window.addEventListener("DOMContentLoaded", readActorDeeplink);
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
    item.setAttribute("data-tooltip", T("Digital Actors", "数字演员"));
    item.setAttribute("aria-label", T("Digital Actors", "数字演员"));
    item.innerHTML = '<span class="dock-ico" aria-hidden="true">🎭</span><span class="dock-label">' + esc(T("Actors", "演员")) + '</span>';
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
