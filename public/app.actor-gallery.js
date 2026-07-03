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
      "#" + ROOT_ID + " .ag-pillbar .ag-chip,#" + ROOT_ID + " .ag-pillbar .ag-sc-btn,#" + ROOT_ID + " .ag-pillbar .ag-capchip{background:transparent;border:none;box-shadow:none;}" +
      "#" + ROOT_ID + " .ag-pillbar [data-pill-key]{--ph:155 !important;--pill-hue:155 !important;color:#bff5e0 !important;font-weight:700;}" +
      "#" + ROOT_ID + " .ag-pillbar [data-pill-key].active{color:" + INK + " !important;}" +
      "#" + ROOT_ID + " .ag-scroll{flex:1;overflow:auto;padding:16px 26px 40px;}" +
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
      "#" + ROOT_ID + " .ag-tag{background:rgba(0,245,160,.12);border:1px solid rgba(0,245,160,.3);color:#bff5e0;border-radius:999px;padding:4px 12px;font-size:12px;}" +
      "#" + ROOT_ID + " .ag-persona{color:rgba(232,255,245,.88);margin:10px 0;}" +
      "#" + ROOT_ID + " .ag-cast{background:" + GREEN + ";color:" + INK + ";border:none;border-radius:999px;padding:12px 26px;font-size:16px;font-weight:800;cursor:pointer;margin-top:8px;box-shadow:0 0 20px rgba(0,245,160,.35);}" +
      "#" + ROOT_ID + " .ag-cast:hover{filter:brightness(1.08);}" +
      "#" + ROOT_ID + " .ag-cta-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}" +
      "#" + ROOT_ID + " .ag-share{background:transparent;color:#bff5e0;border:1px solid rgba(0,245,160,.45);border-radius:999px;padding:12px 22px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;}" +
      "#" + ROOT_ID + " .ag-share:hover{background:rgba(0,245,160,.12);}" +
      // 选角/评论/分享 三段胶囊 = 胶囊宪法【凹凸镶嵌】(照台词胶囊: 轨道共用边框零间隙, 主操作凸全圆绿, 其余凹咬合)。
      "#" + ROOT_ID + " .ag-cta-cap{display:flex;align-items:stretch;height:46px;margin-top:14px;border:1px solid rgba(0,245,160,.35);border-radius:999px;overflow:hidden;background:rgba(0,245,160,.05);}" +
      "#" + ROOT_ID + " .ag-cta-cap button{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:6px;border:0;background:transparent;color:#d6ffee;font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;position:relative;box-sizing:border-box;padding:0 22px;}" +
      // 选角(Cast)= 凸: 两头圆全 pill 绿填充
      "#" + ROOT_ID + " .ag-cta-cap .ag-cast{background:" + GREEN + ";color:" + INK + ";font-weight:800;border-radius:999px;z-index:2;box-shadow:0 4px 18px rgba(0,0,0,.28);padding:0 24px;}" +
      // 评论/分享 = 凹在左, 依次咬合前一段的凸圆头
      "#" + ROOT_ID + " .ag-cta-cap .ag-cast ~ button{margin-left:-23px;padding-left:40px;border-radius:0 999px 999px 0;z-index:1;-webkit-mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);}" +
      "#" + ROOT_ID + " .ag-cta-cap .ag-cast ~ button:hover{background:rgba(0,245,160,.12);}" +
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
      "#" + ROOT_ID + " .ag-slogan{font-size:12.5px;color:#8fe9c8;font-style:italic;margin:3px 0;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
      "#" + ROOT_ID + " .ag-castmodal{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(2,10,7,.72);backdrop-filter:blur(3px);}" +
      "#" + ROOT_ID + " .ag-castmodal .box{background:#0a1712;border:1px solid rgba(0,245,160,.35);border-radius:20px;padding:22px;max-width:440px;width:88%;box-shadow:0 20px 60px rgba(0,0,0,.5);}" +
      "#" + ROOT_ID + " .ag-castmodal h3{font-size:18px;font-weight:800;margin:0 0 4px;color:#e8fff5;}" +
      "#" + ROOT_ID + " .ag-castmodal .sub{font-size:13px;color:#a9e9cf;margin:0 0 16px;}" +
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
      "#" + ROOT_ID + " .ag-recbtn:disabled{background:rgba(0,245,160,.18);color:rgba(207,238,224,.7);box-shadow:none;cursor:default;}" +
      "#" + ROOT_ID + " .ag-recbtn.recording{background:#ff5a6a;color:#fff;}" +
      "#" + ROOT_ID + " .ag-capchip{flex:1 1 0;border:1px solid rgba(0,245,160,.4);background:rgba(0,245,160,.06);color:#d6ffee;font-size:14px;font-weight:700;padding:9px 0;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-archfilters{margin-top:0 !important;}" +   // 两行筛选间距 = 单个 14px(跟上一个间隔等高), 别叠成双倍
      "#" + ROOT_ID + " .ag-rt-label{font-size:13px;color:#a9e9cf;margin:8px 0;font-weight:600;}" +
      "#" + ROOT_ID + " .ag-arch-row{display:flex;flex-wrap:wrap;gap:8px;}" +
      "#" + ROOT_ID + " .ag-arch{border:1px solid rgba(0,245,160,.35);background:rgba(0,245,160,.06);color:#d6ffee;font-size:13px;font-weight:700;padding:7px 13px;border-radius:999px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-arch.on{background:" + GREEN + ";color:" + INK + ";border-color:" + GREEN + ";}" +
      "#" + ROOT_ID + " .ag-subgroup{margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-subgroup-t{font-size:12px;color:#8fdcc0;margin:0 0 6px;}" +
      "#" + ROOT_ID + " .ag-subrow{display:flex;flex-wrap:wrap;gap:6px;}" +
      "#" + ROOT_ID + " .ag-sub{border:1px solid rgba(0,245,160,.25);background:transparent;color:#bff5e0;font-size:12.5px;padding:5px 11px;border-radius:999px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-sub.on{background:rgba(0,245,160,.85);color:" + INK + ";border-color:transparent;font-weight:700;}" +
      /* 就地展开 = 同一个框: 展开的卡横跨整行, 封面变大(显 3D/视频), 详情接着信息往下排 */
      "#" + ROOT_ID + " .ag-card.expanded{grid-column:1/-1;border-color:" + GREEN + ";box-shadow:0 0 26px rgba(0,245,160,.4);}" +
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover{aspect-ratio:auto;height:min(58vh,420px);cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover .ag-mv-wrap,#" + ROOT_ID + " .ag-card.expanded .ag-cover model-viewer{width:100%;height:100%;}" +
      "#" + ROOT_ID + " .ag-cover{position:relative;}" +
      "#" + ROOT_ID + " .ag-3d-badge{position:absolute;right:12px;bottom:12px;z-index:3;background:rgba(4,18,12,.72);color:#bff5e0;border:1px solid rgba(0,245,160,.5);border-radius:999px;padding:6px 13px;font-size:13px;font-weight:700;cursor:pointer;backdrop-filter:blur(4px);}" +
      "#" + ROOT_ID + " .ag-3d-badge:hover{background:rgba(0,245,160,.9);color:#04120c;}" +
      "#" + ROOT_ID + " .ag-inline{animation:agfade .22s ease;}" +
      "@keyframes agfade{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}" +
      "#" + ROOT_ID + " .ag-sub-grid{margin-top:4px;}" +
      /* 创建+搜索 = 凹凸镶嵌: Create 绿全圆胶囊(右端半圆【凸】)负边距【咬进】搜索框; 搜索框左侧【凹】容纳 */
      /* 三胶囊 = 胶囊宪法凹凸镶嵌: 🙋成为演员(凹右)| ＋创建(绿凸中)| 搜索(凹左) */
      "#" + ROOT_ID + " .ag-topcap{display:flex;align-items:stretch;height:46px;position:relative;max-width:100%;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;}" +
      "#" + ROOT_ID + " .ag-topcap::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-topcap>*{flex:0 0 auto;}" +   // 胶囊各自不收缩, 溢出靠横滑
      "@media(max-width:760px){#" + ROOT_ID + " .ag-bar{flex-wrap:wrap;}#" + ROOT_ID + " .ag-topcap{order:3;flex:1 1 100%;width:100%;margin-top:10px;}}" +
      "#" + ROOT_ID + " .ag-topcap .ag-signup{position:relative;z-index:2;border:0;background:" + GREEN + ";color:" + INK + ";font-weight:800;padding:0 24px;white-space:nowrap;border-radius:999px;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.28);}" +
      "#" + ROOT_ID + " .ag-topcap .ag-create{z-index:1;border:1px solid rgba(0,245,160,.4);border-left:0;background:rgba(0,245,160,.06);color:#e8fff5;font-weight:700;padding:0 22px 0 40px;white-space:nowrap;border-radius:0 999px 999px 0;cursor:pointer;margin-left:-23px;-webkit-mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);}" +
      "#" + ROOT_ID + " .ag-topcap .ag-search{z-index:1;border:1px solid rgba(0,245,160,.4);border-left:0;background:rgba(0,245,160,.06);color:#e8fff5;min-width:150px;padding:0 20px 0 40px;border-radius:0 999px 999px 0;outline:none;font-size:15px;height:100%;box-sizing:border-box;margin-left:-23px;-webkit-mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);}" +
      "#" + ROOT_ID + " .ag-3d{margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-ar{display:inline-block;text-decoration:none;}" +
      "#" + ROOT_ID + " .ag-owner{display:flex;gap:10px;margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-del{background:rgba(255,80,80,.15);border:1px solid rgba(255,80,80,.5);color:#ffb3b3;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:600;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-empty{color:rgba(207,238,224,.55);font-size:14px;padding:8px 0;}";
    document.head.appendChild(st);
  }

  var state = { filter: "all", search: "", actors: [], rows: 1, ownedSet: {}, archetype: "" };

  function coverInner(a, big) {
    var foc = (a.cover_focal_x != null && a.cover_focal_x >= 0)
      ? (a.cover_focal_x * 100).toFixed(1) + "% " + (a.cover_focal_y * 100).toFixed(1) + "%" : "center 30%";
    if (a.cover_image) {
      return '<img src="' + esc(a.cover_image) + '" alt="' + esc(a.name_en) + '" loading="lazy" decoding="async" style="--foc:' + foc + '">';
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
    var row = ROLE_TAXONOMY.map(function (a) {
      return '<button type="button" class="ag-arch" data-arch="' + a.key + '">' + a.emoji + ' ' + esc(T(a.en, a.zh)) + '</button>';
    }).join("");
    return '<div class="ag-roletax">' +
      '<div class="ag-rt-label">' + esc(T("Role range — pick your archetypes (multi-select)", "戏路 —— 选大类(可多选)")) + '</div>' +
      '<div class="ag-arch-row">' + row + '</div>' +
      '<div class="ag-subroles"></div>' +
    '</div>';
  }
  // 绑定戏路选择器; 返回 { archetypes(), subRoles() } getters。
  function wireRoleTaxonomy(scope) {
    var subWrap = scope.querySelector(".ag-subroles");
    var chosenSubs = {};   // key: en-label -> true
    function rebuildSubs() {
      var selected = [].slice.call(scope.querySelectorAll(".ag-arch.on")).map(function (b) { return b.getAttribute("data-arch"); });
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
    scope.querySelectorAll(".ag-arch").forEach(function (b) {
      b.onclick = function () { b.classList.toggle("on"); rebuildSubs(); };
    });
    return {
      archetypes: function () { return [].slice.call(scope.querySelectorAll(".ag-arch.on")).map(function (b) { return b.getAttribute("data-arch"); }); },
      subRoles: function () {
        var sel = {}; scope.querySelectorAll(".ag-arch.on").forEach(function (b) { sel[b.getAttribute("data-arch")] = true; });
        // 只保留仍属于已选大类的细分。
        var valid = {}; ROLE_TAXONOMY.forEach(function (a) { if (sel[a.key]) a.subs.forEach(function (s) { valid[s[0]] = true; }); });
        return Object.keys(chosenSubs).filter(function (k) { return valid[k]; });
      },
    };
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
        roleTaxonomyMarkup() +
        '<label>' + esc(T("Cast price (¢, 0=free; you earn 70%)", "选角价(¢, 0=免费; 你得 70%)")) + '<input class="ag-in" data-k="cast_price_cents" type="number" min="0" max="500" value="0" /></label>' +
        '<button class="ag-cast ag-submit">✨ ' + esc(T("Generate & publish", "生成并发布演员")) + '</button>' +
        '<div class="ag-form-msg ag-empty"></div>' +
      '</div></div>';
    scroll.querySelector(".ag-back").onclick = function () { renderGrid(); };
    var roleTax = wireRoleTaxonomy(scroll);
    var submit = scroll.querySelector(".ag-submit");
    var msg = scroll.querySelector(".ag-form-msg");
    submit.onclick = function () {
      var payload = {};
      scroll.querySelectorAll(".ag-in").forEach(function (el) { payload[el.getAttribute("data-k")] = el.value; });
      payload.archetypes = roleTax.archetypes(); payload.sub_roles = roleTax.subRoles();
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
    var captured = { face_video: null, speech: null };
    scroll.innerHTML = '<div class="ag-detail">' +
      '<button class="ag-back">‹ ' + esc(T("Back", "返回")) + '</button>' +
      '<div class="ag-hero-name" style="margin-bottom:6px">🙋 ' + esc(T("Become a real digital actor", "签约成为真人数字演员")) + '</div>' +
      '<div class="ag-sub" style="margin-bottom:14px;max-width:640px">' + esc(T("Clone yourself into a digital actor — no scheduling limits, works 24/7. Use yourself free; when others cast you, you earn 80% (platform 20%). You watch every work you're in for free, and can report or revoke anytime. Verified before going public.", "把自己变成数字演员 —— 分身有术、不受档期阻拦、24/7 接戏。自选自演免费;别人选用你,你拿 80%(平台 20%)。你参演的每支作品都免费欣赏,随时可举报/撤权。核验通过才公开。")) + '</div>' +
      '<div class="ag-form">' +
        '<label>' + esc(T("Your name / stage name *", "你的名字 / 艺名 *")) + '<input class="ag-in" data-k="name_en" maxlength="80" /></label>' +
        roleTaxonomyMarkup() +
        '<label>' + esc(T("A one-line vibe (optional — e.g. “commanding presence, eyes that speak”)", "一句 vibe(选填 —— 如「气场强、眼神会说话」)")) + '<textarea class="ag-in" data-k="role_range" maxlength="300" rows="2"></textarea></label>' +
        '<label>' + esc(T("Voice gender", "声线性别")) + '<select class="ag-in" data-k="gender"><option value="female">' + esc(T("Female", "女声")) + '</option><option value="male">' + esc(T("Male", "男声")) + '</option><option value="neutral">' + esc(T("Neutral", "中性")) + '</option></select></label>' +
        '<label>' + esc(T("Cast price others pay (¢, 0=free; you keep 80%)", "他人选用你的价(¢, 0=免费; 你留 80%)")) + '<input class="ag-in" data-k="cast_price_cents" type="number" min="0" max="9999" value="0" /></label>' +
        '<label class="ag-check"><input type="checkbox" data-k="is_public_figure"> ' + esc(T("I'm a public figure / celebrity (needs agency verification)", "我是公众人物/明星(需经纪公司核验)")) + '</label>' +
        '<div class="ag-consent">' +
          '<div style="font-weight:700;margin-bottom:6px">' + esc(T("Rights I grant (consent) *", "我授予的权利(同意)*")) + '</div>' +
          '<label class="ag-check"><input type="checkbox" data-k="grant_likeness" checked> ' + esc(T("Use my likeness (face) as a digital actor", "将我的肖像(脸)用作数字演员")) + '</label>' +
          '<label class="ag-check"><input type="checkbox" data-k="grant_voice"> ' + esc(T("Use my speaking voice", "使用我的说话声音")) + '</label>' +
          '<label class="ag-check"><input type="checkbox" data-k="grant_singing"> ' + esc(T("Use my singing voice", "使用我的歌唱声音")) + '</label>' +
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
              '<video class="ag-cam" autoplay muted playsinline style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;background:#000;border:1px solid rgba(0,245,160,.4);display:block;"></video>' +
              '<button class="ag-cam-start" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:' + GREEN + ';color:' + INK + ';font-weight:800;border:0;border-radius:999px;padding:12px 22px;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.4);white-space:nowrap;">🎥 ' + esc(T("Start camera", "开启摄像头")) + '</button>' +
            '</div>' +
            '<button class="ag-cam-rec ag-recbtn" disabled>⏺ ' + esc(T("Record 8s turn-around", "录 8 秒转头")) + '</button>' +
          '</div>' +
          // 🎙 声音舞台 (波形/音量条)
          '<div class="ag-stage-audio" style="display:none">' +
            '<div class="ag-consent-script" style="margin:2px 0 10px;padding:10px 14px;background:rgba(0,245,160,.08);border:1px dashed rgba(0,245,160,.4);border-radius:10px;font-size:14px;color:#e8fff5;"></div>' +
            '<canvas class="ag-meter" width="1040" height="180" style="width:100%;max-width:520px;height:90px;border-radius:14px;background:#0a1512;border:1px solid rgba(0,245,160,.4);display:block;"></canvas>' +
            '<button class="ag-voice-rec ag-recbtn" disabled>🎙 ' + esc(T("Record 8s speech / singing", "录 8 秒 说话/歌声")) + '</button>' +
          '</div>' +
          '<div class="ag-cap-status ag-empty" style="font-size:12px;margin-top:10px"></div>' +
        '</div>' +
        '<button class="ag-cast ag-rp-submit">🎬 ' + esc(T("Sign & submit for verification", "签约并提交核验")) + '</button>' +
        '<div class="ag-form-msg ag-empty"></div>' +
      '</div></div>';
    var vid = scroll.querySelector(".ag-cam"), capStatus = scroll.querySelector(".ag-cap-status");
    var startBtn = scroll.querySelector(".ag-cam-start"), recBtn = scroll.querySelector(".ag-cam-rec"), voiceBtn = scroll.querySelector(".ag-voice-rec");
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
    function ensureStream() {
      if (rpStream && rpStream.active) return Promise.resolve(rpStream);
      capStatus.textContent = T("Opening camera & mic…", "正在开启摄像头和麦克风…");
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: true }).then(function (s) {
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
        window.cssosMakePillBar(capBar, { mono: true, compact: true, textColor: "dark", activeKey: "video", onActivate: switchMode });
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
    recBtn.onclick = function () { recordTrack("face_video", "face_video", { videoOnly: false }, 8, recBtn); };
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
      if (!captured.face_video) { msg.textContent = T("Please capture your face first.", "请先采集你的脸。"); return; }
      p.likeness_capture = { face_video_url: captured.face_video };
      if (captured.speech) p.voice_capture = { speech_url: captured.speech, spoken_consent: consentScript(), consented_at: new Date().toISOString() };
      submit.disabled = true; msg.textContent = "⏳ " + T("Signing…", "签约中…");
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
  function renderComments(listEl, actorId, comments) {
    if (!comments.length) { listEl.innerHTML = '<div class="ag-cmt-empty">' + esc(T("No comments yet. Be the first!", "还没有评论,来抢沙发!")) + '</div>'; return; }
    listEl.innerHTML = comments.map(function (c) {
      return '<div class="ag-cmt" data-cid="' + esc(c.id) + '"><div class="who"><span>' + esc(c.author_name || "Guest") + ' · ' + esc(fmtWhen(c.created_at)) + '</span>' +
        (c.mine ? '<button class="del" data-cid="' + esc(c.id) + '">' + esc(T("Delete", "删除")) + '</button>' : '') +
        '</div><div class="body">' + esc(c.body) + '</div></div>';
    }).join("");
    listEl.querySelectorAll(".del").forEach(function (b) {
      b.onclick = function () {
        var cid = b.getAttribute("data-cid");
        fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments/" + encodeURIComponent(cid), { method: "DELETE", credentials: "include" })
          .then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) { var n = listEl.querySelector('.ag-cmt[data-cid="' + cid + '"]'); if (n) n.remove(); if (!listEl.querySelector(".ag-cmt")) renderComments(listEl, actorId, []); } });
      };
    });
  }
  function toggleComments(inline, actorId) {
    var box = inline.querySelector(".ag-comments");
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    var listEl = box.querySelector(".ag-cmt-list");
    var textEl = box.querySelector(".ag-cmt-text");
    var sendEl = box.querySelector(".ag-cmt-send");
    if (!box.__loaded) {
      box.__loaded = true;
      listEl.innerHTML = '<div class="ag-cmt-empty">' + esc(T("Loading…", "加载中…")) + '</div>';
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments", { credentials: "include" })
        .then(function (r) { return r.json(); }).then(function (j) { renderComments(listEl, actorId, (j && j.comments) || []); })
        .catch(function () { listEl.innerHTML = '<div class="ag-cmt-empty">' + esc(T("Failed to load.", "加载失败。")) + '</div>'; });
      sendEl.onclick = function () {
        var body = String(textEl.value || "").trim();
        if (!body) return;
        sendEl.disabled = true;
        fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: body }) })
          .then(function (r) { return r.json(); }).then(function (j) {
            sendEl.disabled = false;
            if (j && j.ok && j.comment) {
              textEl.value = "";
              var empty = listEl.querySelector(".ag-cmt-empty"); if (empty) empty.remove();
              var c = j.comment;
              var node = document.createElement("div"); node.className = "ag-cmt"; node.setAttribute("data-cid", c.id);
              node.innerHTML = '<div class="who"><span>' + esc(c.author_name || "Guest") + ' · ' + esc(fmtWhen(c.created_at)) + '</span><button class="del" data-cid="' + esc(c.id) + '">' + esc(T("Delete", "删除")) + '</button></div><div class="body">' + esc(c.body) + '</div>';
              node.querySelector(".del").onclick = function () {
                fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments/" + encodeURIComponent(c.id), { method: "DELETE", credentials: "include" })
                  .then(function (r) { return r.json(); }).then(function (jj) { if (jj && jj.ok) { node.remove(); if (!listEl.querySelector(".ag-cmt")) renderComments(listEl, actorId, []); } });
              };
              listEl.insertBefore(node, listEl.firstChild);
            } else if (j && j.code === "AUTH_REQUIRED") {
              if (window.cssosGuidedToast) window.cssosGuidedToast(T("Sign in to comment.", "登录后即可评论。"), { actions: [{ label: T("Sign in", "登录"), onClick: function () { if (window.cssosOpenLogin) window.cssosOpenLogin(); } }] });
              else window.alert(T("Sign in to comment.", "登录后即可评论。"));
            } else window.alert(T("Failed to post.", "发布失败。"));
          }).catch(function () { sendEl.disabled = false; window.alert(T("Failed to post.", "发布失败。")); });
      };
      textEl.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendEl.click(); });
    }
  }
  function shareActor(a) {
    var name = a.name_en || a.name_zh || "Digital Actor";
    var url = "https://cssstudio.app/a/" + encodeURIComponent(a.actor_id);
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
    if (typeof window.cssosOpenAssistantWithPrompt === "function") {
      close();
      window.cssosOpenAssistantWithPrompt(prompt, { actorId: actor.actor_id });
    } else if (typeof window.cssosGuidedToast === "function") {
      window.cssosGuidedToast(T("Cast " + name + " — opening the creation panel", "已选定 " + name + " — 创作入口即将打开"), {});
    } else { alert(T("Cast actor: ", "已选定演员: ") + name); }
  }
  // 选角时先选作品类型(叙事类先锁)。
  function openCast(actor) {
    var root = document.getElementById(ROOT_ID); if (!root) { castRun(actor, "single"); return; }
    var name = esc(actor.name_en || actor.name_zh);
    var modal = document.createElement("div"); modal.className = "ag-castmodal";
    modal.innerHTML = '<div class="box"><h3>🎬 ' + esc(T("Cast ", "选 ")) + name + esc(T(" — pick a format", " —— 选作品类型")) + '</h3>' +
      '<div class="sub">' + esc(T("Music-driven works are ready now. Scripted drama (short play / series / film) auto-writes a screenplay — coming soon.", "音乐类现在就能做。叙事类(短剧/剧集/电影)会自动编剧 —— 敬请期待。")) + '</div>' +
      '<div class="ag-wt">' + CAST_WORK_TYPES.map(function (w) {
        return '<button data-wt="' + w.key + '"' + (w.ready ? "" : " disabled") + '>' + (w.ready ? "" : "🔒 ") + w.emoji + ' ' + esc(T(w.en, w.zh)) + '<small>' + esc(T(w.descEn, w.descZh)) + '</small></button>';
      }).join("") + '</div></div>';
    modal.addEventListener("click", function (e) {
      if (e.target === modal) { modal.remove(); return; }
      var btn = e.target.closest && e.target.closest("button[data-wt]");
      if (!btn || btn.disabled) return;
      var wt = btn.getAttribute("data-wt");
      modal.remove();
      castRun(actor, wt);
    });
    root.appendChild(modal);
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
    });
    if (wasThis) return;   // 再点一次 = 收起
    cardEl.classList.add("expanded");
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
            '<button class="ag-cast">🎬 ' + esc(T("Cast in an MV", "选 TA 主演")) + '</button>' +
            '<button class="ag-comment">💬 ' + esc(T("Comment", "评论")) + '</button>' +
            '<button class="ag-share" title="' + esc(T("Share this actor", "分享这位演员")) + '">↗ ' + esc(T("Share", "分享")) + '</button>' +
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
        if (cov0 && a.model_3d_url) {
          var b3d = document.createElement("button");
          b3d.className = "ag-3d-badge"; b3d.type = "button";
          b3d.textContent = "🧊 " + T("View in 3D", "看 3D");
          b3d.onclick = function (ev) { ev.stopPropagation(); window.__agToggleCover(cardEl, a); };
          cov0.appendChild(b3d);
        }
        var castBtn = inline.querySelector(".ag-cast");
        if (castBtn) castBtn.onclick = function () { openCast(a); };
        var shareBtn = inline.querySelector(".ag-share");
        if (shareBtn) shareBtn.onclick = function () { shareActor(a); };
        var cmtBtn = inline.querySelector(".ag-comment");
        if (cmtBtn) cmtBtn.onclick = function () { toggleComments(inline, a.actor_id); };
        wireShowcase(inline, a.actor_id);
        if (state.ownedSet[a.actor_id]) {
          var own = document.createElement("div"); own.className = "ag-owner";
          own.innerHTML = '<span class="ag-tag">🎬 ' + esc(T("Mine", "我的演员")) + ' · ' + esc(T("royalty", "版税")) + ' ' + Math.round((a.creator_royalty || 0.7) * 100) + '%</span>' +
            (a.is_real_person ? '<button class="ag-revoke ag-del">' + esc(T("Revoke consent", "撤回授权")) + '</button>' : '') +
            '<button class="ag-del ag-del-actor">' + esc(T("Delete", "删除")) + '</button>';
          inline.appendChild(own);
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
        '<div class="ag-topcap">' +   // 三胶囊: 🙋成为演员 | +创建(绿凸) | 搜索  凹凸镶嵌
          '<button class="ag-signup">🙋 ' + esc(T("Become an actor", "成为真人演员")) + '</button>' +
          '<button class="ag-create">＋ ' + esc(T("Create", "创建演员")) + '</button>' +
          '<input class="ag-search" type="search" placeholder="' + esc(T("Search actors…", "搜索演员…")) + '">' +
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
      // 戏路大类筛选(横滑)
      '<div class="ag-filters ag-archfilters">' +
        '<button class="ag-chip ag-af on" data-arch="">' + esc(T("All roles", "全部戏路")) + '</button>' +
        ROLE_TAXONOMY.map(function (a) { return '<button class="ag-chip ag-af" data-arch="' + a.key + '">' + a.emoji + ' ' + esc(T(a.en, a.zh)) + '</button>'; }).join("") +
      '</div>' +
      '<div class="ag-scroll"></div>';
    document.body.appendChild(el);
    el.querySelector(".ag-x").onclick = close;
    var createBtn = el.querySelector(".ag-create");
    if (createBtn) createBtn.onclick = function () { renderCreateForm(); };
    var signupBtn = el.querySelector(".ag-signup");
    if (signupBtn) signupBtn.onclick = function () { renderRealPersonSignup(); };
    // 5 个筛选 = 凹凸镶嵌胶囊轨道: 优先用平台 cssosMakePillBar(胶囊宪法), 否则退回普通 chip。
    var filterBar = el.querySelector(".ag-filters");
    filterBar.querySelectorAll(".ag-chip").forEach(function (c) { c.setAttribute("data-pill-key", c.getAttribute("data-f")); });
    function applyFilterKey(key) { state.filter = key; resetRows(); renderGrid(); }
    if (typeof window.cssosMakePillBar === "function") {
      filterBar.classList.add("ag-pillbar");
      window.cssosMakePillBar(filterBar, { mono: true, textColor: "dark", activeKey: "all", onActivate: applyFilterKey });
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
      function applyArch(key) { state.archetype = key === "all" ? "" : key; resetRows(); renderGrid(); }
      archBar.querySelectorAll(".ag-af").forEach(function (c) { c.setAttribute("data-pill-key", c.getAttribute("data-arch") || "all"); });
      if (typeof window.cssosMakePillBar === "function") {
        archBar.classList.add("ag-pillbar");
        window.cssosMakePillBar(archBar, { mono: true, textColor: "dark", activeKey: "all", onActivate: applyArch });
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
    si.oninput = function () { state.search = si.value.trim(); resetRows(); renderGrid(); };
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
  // 分享深链 /?actor=<id>: 打开图鉴并展开该演员(网格异步加载, 轮询到卡片再展开; 不在已加载行内则扩行)。
  window.cssosOpenActor = function (id) {
    if (!id) { open(1); return; }
    open(1);
    var tries = 0;
    (function tryExpand() {
      var root = document.getElementById(ROOT_ID); if (!root) { if (tries++ < 40) setTimeout(tryExpand, 150); return; }
      var card = root.querySelector('.ag-card[data-actor="' + id + '"]');
      if (card) { if (!card.classList.contains("expanded")) toggleExpand(card); card.scrollIntoView({ block: "center" }); return; }
      // 演员已在数据里但未渲染(超出已加载行)→ 扩行再找。
      if (state.actors && state.actors.some(function (a) { return a.actor_id === id; })) { state.rows += 5; renderGrid(); }
      if (tries++ < 40) setTimeout(tryExpand, 150);
    })();
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
