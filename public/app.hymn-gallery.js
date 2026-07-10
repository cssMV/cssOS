/* CSSOS_WAVE_1710 — 圣诗画廊: 一排排乐谱, 点进去 → 庄严播放器。
 *
 * Jing 的设想:「圣诗反解这一块, 显示的都是一排排乐谱, 点进去就可以欣赏 MV。」
 * 卡片做成【乐谱纸】质感(米色纸 + 五线谱纹) —— 视觉上就是一沓沓圣诗谱, 不是普通缩略图。
 * 点卡片 → cssosOpenHymn(id) → app.hymn-player.js。
 *
 * 公开: globalThis.cssosOpenHymnGallery();  深链: ?hymns=1
 */
(function () {
  "use strict";
  if (globalThis.cssosOpenHymnGallery) return;

  function injectStyle() {
    if (document.getElementById("cssos-hymngal-style")) return;
    var st = document.createElement("style"); st.id = "cssos-hymngal-style";
    /* W1713 — Jing「HYMN 面板设计成教堂风格」。大教堂内景:
     *   · 夜色石殿底 + 顶部玫瑰花窗辉光 + 两侧烛光。
     *   · 每张卡片 = 一扇【彩绘拱窗】(罗曼式圆拱顶), 窗内是羊皮谱面(五线谱纹 + 谱号)。
     *   · 拱顶一道【彩窗色带】—— 每扇窗宝石色相各异(红蓝绿金紫), 像真教堂一排排彩窗。
     *   · 借数字演员的圣殿标 🏛 作章首。烛光金 + 彩窗色, 庄严不冷。 */
    st.textContent = [
      "#cssos-hymngal{position:fixed;inset:0;z-index:2147482900;overflow-y:auto;color:#f0e6cf;",
      "  background:",
      "    radial-gradient(60% 42% at 50% -6%,rgba(255,214,130,0.14),transparent 60%),",  // 玫瑰窗辉光
      "    radial-gradient(30% 60% at 3% 30%,rgba(255,180,90,0.06),transparent 70%),",     // 左侧烛光
      "    radial-gradient(30% 60% at 97% 30%,rgba(120,150,255,0.06),transparent 70%),",   // 右侧冷光
      "    linear-gradient(180deg,#141b28,#0d1420 55%,#070b12);",
      "  font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Songti SC',serif;}",
      // 顶部石拱阴影(像大殿穹顶)
      "#cssos-hymngal::before{content:'';position:fixed;top:0;left:0;right:0;height:120px;pointer-events:none;z-index:1;",
      "  background:radial-gradient(120% 100% at 50% -60%,rgba(0,0,0,0.55),transparent 70%);}",
      "#cssos-hymngal .hg-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:14px;",
      "  padding:22px 28px;background:linear-gradient(180deg,rgba(9,13,20,0.96),rgba(9,13,20,0.55) 72%,transparent);}",
      "#cssos-hymngal .hg-ico{font-size:24px;filter:drop-shadow(0 0 10px rgba(255,214,130,0.4));}",
      "#cssos-hymngal .hg-title{font-size:23px;font-weight:600;letter-spacing:0.4px;",
      "  background:linear-gradient(180deg,#fff3d6,#e6c98d);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}",
      "#cssos-hymngal .hg-sub{font-size:12.5px;opacity:0.62;font-style:italic;}",
      "#cssos-hymngal .hg-x{width:42px;height:42px;border-radius:50%;border:1px solid rgba(240,230,207,0.28);",
      "  background:rgba(0,0,0,0.32);color:#f0e6cf;font-size:20px;cursor:pointer;}",
      // W1721 — 搜索框(不能少)
      "#cssos-hymngal .hg-search{margin-left:auto;width:min(300px,34vw);height:40px;border-radius:999px;",
      "  border:1px solid rgba(240,230,207,0.28);background:rgba(0,0,0,0.32);color:#f0e6cf;",
      "  padding:0 16px;font-size:14px;font-family:inherit;outline:none;}",
      "#cssos-hymngal .hg-search::placeholder{color:rgba(240,230,207,0.5);}",
      // W1721 — 头部「分享本教派总链接」按钮(⤴): 分享当前筛选的教派 (?hymns=<trad>)。
      "#cssos-hymngal .hg-share-all{width:42px;height:42px;border-radius:50%;border:1px solid rgba(240,230,207,0.28);",
      "  background:rgba(0,0,0,0.32);color:#e6c98d;font-size:17px;cursor:pointer;}",
      // W1721 — 教派筛选胶囊条: 走平台【胶囊宪法】(data-pill-bar → cssosMakePillBar), 不另造一套。
      "#cssos-hymngal .hg-tabs{margin:2px 30px 6px;}",
      "#cssos-hymngal .hg-body{position:relative;z-index:2;padding:10px 30px 70px;}",
      "#cssos-hymngal .hg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:26px 22px;position:relative;z-index:2;}",
      // W1721 — 「加载更多一行」(和数字演员画廊同款: 默认一行, 每次追加一行; App 端 3)。
      "#cssos-hymngal .hg-morewrap{text-align:center;margin-top:24px;position:relative;z-index:2;}",
      "#cssos-hymngal .hg-more{padding:9px 20px;border-radius:999px;border:1px solid rgba(240,230,207,0.28);",
      "  background:rgba(0,0,0,0.32);color:#f0e6cf;font-size:13px;font-family:inherit;cursor:pointer;}",
      "#cssos-hymngal .hg-more:hover{background:rgba(0,0,0,0.5);}",
      // 彩绘拱窗卡片
      // W1719 — 去掉方形边框: border-image 无视 border-radius, 会画成矩形(= Jing 看到的方框)。
      //   改成跟随圆角的细金边, 只保留罗曼式圆拱顶。
      "#cssos-hymngal .hg-card{position:relative;overflow:hidden;cursor:pointer;aspect-ratio:2/3;",
      "  border-radius:999px 999px 10px 10px;",   // 罗曼式圆拱顶
      "  background:linear-gradient(180deg,#f2e9d2,#e4d7b8);",
      "  box-shadow:0 14px 34px rgba(0,0,0,0.55),inset 0 0 0 1px rgba(202,168,95,0.55);",   // 细金边跟随圆角
      "  transition:transform .2s ease,box-shadow .2s ease,filter .2s ease;}",
      "#cssos-hymngal .hg-card:hover{transform:translateY(-5px);filter:brightness(1.05);",
      "  box-shadow:0 20px 48px rgba(0,0,0,0.62),0 0 26px rgba(255,200,110,0.28);}",   // 烛光晕
      // 拱顶彩窗色带(每扇不同宝石色, 由 --gh 控制色相)
      "#cssos-hymngal .hg-glass{position:absolute;left:0;right:0;top:0;height:34%;",
      "  background:radial-gradient(120% 120% at 50% 120%,hsla(var(--gh,42),85%,62%,0.9),hsla(var(--gh,42),70%,42%,0.75));",
      "  border-radius:999px 999px 0 0;box-shadow:inset 0 -6px 14px rgba(0,0,0,0.35);}",
      "#cssos-hymngal .hg-glass::after{content:'';position:absolute;inset:0;border-radius:999px 999px 0 0;",   // 铅条格纹
      "  background:repeating-linear-gradient(90deg,transparent 0 22px,rgba(20,14,4,0.28) 22px 24px);opacity:0.5;}",
      /* W1721 — 2.39:1 影院封面放在【卡身这一块】(拱窗下, 标题上), 统一 MV 那套风格。
       *   有封面 → 铺满卡身(object-fit:cover), 播放钮浮其上; 无封面 → 退回谱线占位。
       *   拱顶彩窗仍是本传统识别色带, 不动。 */
      "#cssos-hymngal .hg-cover{position:absolute;left:0;right:0;top:34%;bottom:56px;object-fit:cover;z-index:1;",
      "  background:#0c0a06;box-shadow:inset 0 2px 8px rgba(0,0,0,0.4);}",
      "#cssos-hymngal .hg-card[data-cover] .hg-staff{display:none;}",
      "#cssos-hymngal .hg-card[data-cover] .hg-clef{display:none;}",
      // W1720 — 拱心传统符号(✝/☸/۞/🕉/✡/☬/♪), 取代之前的 🏛。
      "#cssos-hymngal .hg-sym{position:absolute;top:9%;left:50%;transform:translateX(-50%);font-size:26px;z-index:2;",
      "  color:rgba(20,14,4,0.72);filter:drop-shadow(0 1px 3px rgba(255,255,255,0.3));}",
      /* 每传统各自主题:
       *  · 尖拱(islamic/hindu/sikh): 拱顶收成尖顶, 更像清真寺/庙宇拱。
       *  · islamic 无具象: 玻璃纹样改成【几何星格】(arabesque), 而非铅条竖纹。
       * W1723 — 尖顶【和圆顶一样铺满宽度, 去掉两边留白】(Jing): 把尖顶裁在【整张卡】上,
       *   而不是只裁彩窗。这样尖角两侧露出的是深色背景(和圆顶露背景同理), 不再露米色卡底空白;
       *   彩窗则铺满卡顶全宽, 由卡片外形收成尖角。 */
      "#cssos-hymngal .hg-card[data-arch='point']{border-radius:0;",
      "  clip-path:polygon(50% 0,100% 15%,100% 100%,0 100%,0 15%);}",
      "#cssos-hymngal .hg-card[data-arch='point'] .hg-glass{clip-path:none;border-radius:0;}",
      "#cssos-hymngal .hg-card[data-arch='point'] .hg-glass::after{clip-path:none;border-radius:0;}",
      "#cssos-hymngal .hg-card[data-trad='islamic'] .hg-glass::after{",
      "  background:repeating-conic-gradient(from 0deg at 50% 40%,rgba(20,30,20,0.22) 0deg 15deg,transparent 15deg 30deg);opacity:0.6;}",
      // 谱面(拱窗下半)
      "#cssos-hymngal .hg-staff{position:absolute;left:16px;right:16px;top:37%;bottom:70px;opacity:0.5;",
      "  background:repeating-linear-gradient(180deg,transparent 0 12px,rgba(60,45,20,0.55) 12px 13px);}",
      "#cssos-hymngal .hg-clef{position:absolute;left:18px;top:calc(37% - 4px);font-size:26px;color:rgba(60,45,20,0.6);}",
      "#cssos-hymngal .hg-ct{position:absolute;left:16px;right:16px;bottom:14px;color:#2b2110;text-align:center;}",
      "#cssos-hymngal .hg-cn{font-size:15px;font-weight:700;line-height:1.25;",
      "  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}",
      "#cssos-hymngal .hg-cm{font-size:11px;opacity:0.62;margin-top:3px;font-style:italic;}",
      "#cssos-hymngal .hg-play{position:absolute;top:calc(34% + 8px);left:50%;transform:translateX(-50%);z-index:2;",
      "  width:38px;height:38px;border-radius:50%;background:rgba(20,16,8,0.8);color:#ffe6a8;",
      "  display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 10px rgba(0,0,0,0.5);}",
      "#cssos-hymngal .hg-dur{position:absolute;bottom:12px;right:14px;font-size:10.5px;color:rgba(60,45,20,0.7);font-family:ui-monospace,monospace;}",
      "#cssos-hymngal .hg-empty{padding:70px 26px;text-align:center;opacity:0.62;font-size:15px;font-style:italic;position:relative;z-index:2;}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(sec) { sec = Math.max(0, sec | 0); return ((sec / 60) | 0) + ":" + (sec % 60 < 10 ? "0" : "") + (sec % 60); }

  /* W1720 — 每信仰各自主题(Jing)。引擎对任意 MusicXML 一视同仁; 这里只按 tradition 换外观:
   *   彩窗色相 + 符号 + 纹样。christian 保留大教堂彩窗(一排排宝石色, 最正宗); 其余各按自身传统。
   *   ⚠️ 内容红线在 MV 生成侧(score-visuals)守: 伊斯兰只做 nasheed、绝不碰古兰经诵读、绝不描绘先知。 */
  var CHRISTIAN_HUES = [4, 214, 145, 42, 275, 190, 32, 100];   // 彩窗一排排宝石色
  var TRADITIONS = {
    christian: { sym: "✝", hue: null, arch: "round" },       // ✝ · 彩窗轮换
    buddhist:  { sym: "☸", hue: 42,  arch: "round" },        // ☸ 法轮 · 金/藏红
    islamic:   { sym: "۞", hue: 158, arch: "point" },        // ۞ 几何星 · 翠绿/金(无具象)
    hindu:     { sym: "🕉", hue: 26, arch: "point" },   // 🕉 · 藏红/朱
    jewish:    { sym: "✡", hue: 220, arch: "round" },        // ✡ · 蓝/金
    sikh:      { sym: "☬", hue: 30,  arch: "point" },        // ☬ · 蓝/橙
    secular:   { sym: "♪", hue: 265, arch: "round" },        // ♪ · 中性
    other:     { sym: "◈", hue: 200, arch: "round" },
  };
  function cardHtml(h, i) {
    var trad = String(h.tradition || "secular").toLowerCase();
    var th = TRADITIONS[trad] || TRADITIONS.secular;
    // christian 保留彩窗轮换; 其余用本传统色相 + 每卡 ±14° 微变(成一族, 不雷同)。
    var hue = (th.hue == null) ? CHRISTIAN_HUES[i % CHRISTIAN_HUES.length] : (th.hue + ((i % 3) - 1) * 14);
    // W1721 — 2.39:1 影院封面放在【卡身这一块】(拱窗下、标题上); 无封面 → 退回谱线占位。
    var cover = h.cover_url ? String(h.cover_url) : "";
    return '<div class="hg-card" data-id="' + esc(h.id) + '" data-trad="' + esc(trad) + '" data-arch="' + th.arch + '"' +
      (cover ? ' data-cover="1"' : '') +
      ' title="' + esc(h.title) + '" style="--gh:' + hue + '">' +
      '<div class="hg-glass"><span class="hg-sym">' + th.sym + '</span></div>' +
      (cover ? '<img class="hg-cover" src="' + esc(cover) + '" alt="" loading="lazy" />' : '') +
      '<div class="hg-play">▶</div>' +
      '<div class="hg-clef">𝄞</div>' +
      '<div class="hg-staff"></div>' +
      (h.duration_secs ? '<div class="hg-dur">' + fmt(h.duration_secs) + '</div>' : '') +
      '<div class="hg-ct"><div class="hg-cn">' + esc(h.title) + '</div>' +
        '<div class="hg-cm">' + (h.has_mv ? "♪ + MV" : "♪ audio") + ' · faithful to the score</div></div>' +
    '</div>';
  }

  /* W1721 — 教派分类 + 搜索 + 每传统一个总分享链接。
   *   传统展示名 + 排序; christian 在前(当前内容), 其余随内容加入自然出现。 */
  var TRADITION_META = {
    christian: { name: "Christian · 基督教" }, catholic: { name: "Catholic · 天主教" },
    orthodox: { name: "Orthodox · 东正教" }, buddhist: { name: "Buddhist · 佛教" },
    taoist: { name: "Taoist · 道教" }, islamic: { name: "Islamic · 伊斯兰" },
    hindu: { name: "Hindu · 印度教" }, jewish: { name: "Jewish · 犹太教" },
    sikh: { name: "Sikh · 锡克教" }, bahai: { name: "Baháʼí · 巴哈伊" },
    secular: { name: "Secular · 世俗" }, other: { name: "Other · 其它" },
  };
  var TRADITION_ORDER = ["christian", "catholic", "orthodox", "buddhist", "taoist", "islamic", "hindu", "jewish", "sikh", "bahai", "secular", "other"];
  function tradName(t) { return (TRADITION_META[t] && TRADITION_META[t].name) || t; }
  function tradSym(t) { return (TRADITIONS[t] && TRADITIONS[t].sym) || "◈"; }

  globalThis.cssosOpenHymnGallery = function (filterTradition) {
    injectStyle();
    var ov = document.getElementById("cssos-hymngal");
    if (ov) { try { ov.remove(); } catch (_e) {} }
    ov = document.createElement("div"); ov.id = "cssos-hymngal";
    ov.innerHTML =
      '<div class="hg-head"><span class="hg-ico">🏛</span><div>' +
        '<div class="hg-title">Sacred Scores</div>' +
        '<div class="hg-sub">Faithful transcription — every note, every word, exact to the score.</div></div>' +
        '<input class="hg-search" type="search" placeholder="' + esc(lc("Search…", "搜索…")) + '" />' +
        '<button class="hg-share-all" title="' + esc(lc("Share this collection", "分享这一整辑")) + '">⤴</button>' +
        '<button class="hg-x" title="Close">×</button></div>' +
      '<div class="hg-tabs" data-pill-bar></div>' +   // 教派筛选胶囊(平台胶囊宪法)
      '<div class="hg-body"><div class="hg-empty">Loading…</div></div>';
    document.body.appendChild(ov);

    ov.querySelector(".hg-x").onclick = function () { try { ov.remove(); } catch (_e) {} };
    document.addEventListener("keydown", function esc2(e) {
      if (e.key === "Escape" && document.getElementById("cssos-hymngal")) { try { ov.remove(); } catch (_e) {} document.removeEventListener("keydown", esc2); }
    });

    var body = ov.querySelector(".hg-body");
    var searchEl = ov.querySelector(".hg-search");
    var tabsEl = ov.querySelector(".hg-tabs");
    var allHymns = [];
    var activeTrad = filterTradition ? String(filterTradition).toLowerCase() : "";   // "" = 全部
    var state = { rows: 1 };

    // 卡片打开 + 「加载更多一行」委托
    body.addEventListener("click", function (e) {
      var more = e.target.closest && e.target.closest(".hg-more");
      if (more) { appendMoreRows(); return; }
      var card = e.target.closest && e.target.closest(".hg-card");
      if (card && globalThis.cssosOpenHymn) globalThis.cssosOpenHymn(card.getAttribute("data-id"));
    });

    // 头部「⤴」= 分享当前筛选教派的总链接 (?hymns=<trad>; 全部 → ?hymns=1)。每个教派一个总链接。
    ov.querySelector(".hg-share-all").onclick = function () {
      var url = "/?hymns=" + (activeTrad ? encodeURIComponent(activeTrad) : "1");
      var nm = activeTrad ? tradName(activeTrad).split(" · ")[0] : "Sacred";
      if (typeof globalThis.openCssosShareDialog === "function") {
        globalThis.openCssosShareDialog({
          url: url, title: nm + " · Sacred Music",
          text: "🏛 " + nm + " sacred music on CSS Studio — faithfully transcribed from the score, every note and every word exact.",
        });
      } else { try { navigator.clipboard.writeText(location.origin + url); } catch (_e2) {} }
    };

    /* 桌面: 一行 = 网格列数; App / 单列: 3。与数字演员画廊同一公式(minmax 210 + gap 22)。 */
    function colsFor(el) {
      var w = (el && (el.clientWidth || el.offsetWidth)) || 600;
      return Math.max(1, Math.floor((w + 22) / (210 + 22)));
    }
    function filtered() {
      var q = String(searchEl.value || "").trim().toLowerCase();
      return allHymns.filter(function (h) {
        if (activeTrad && String(h.tradition || "secular").toLowerCase() !== activeTrad) return false;
        if (q && String(h.title || "").toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
    }
    function moreBtnHtml(more) {
      return more > 0 ? '<div class="hg-morewrap"><button class="hg-more">' +
        esc(lc("Load one more row", "加载更多一行")) + " ▾ (" + more + ")</button></div>" : "";
    }
    // 全量重建(筛选/搜索/首次): 默认只渲一行(App 端 3)。
    function renderGrid() {
      var list = filtered();
      if (!list.length) {
        var q = String(searchEl.value || "").trim();
        body.innerHTML = '<div class="hg-empty">' +
          (q ? esc(lc("No matches.", "无匹配。")) : esc(lc("No sacred music yet. Upload a MusicXML score to begin.", "还没有圣乐。上传乐谱即可开始。"))) + '</div>';
        return;
      }
      var cols = colsFor(body);
      var batch = cols <= 1 ? 3 : cols;
      var show = Math.min(list.length, Math.max(batch, state.rows * batch));
      body.innerHTML = '<div class="hg-grid">' +
        list.slice(0, show).map(function (h, i) { return cardHtml(h, i); }).join("") + "</div>" +
        moreBtnHtml(list.length - show);
    }
    // 加载更多 = 末尾追加一行, 不整刷、不跳顶(保留滚动位置)。
    function appendMoreRows() {
      var grid = body.querySelector(".hg-grid");
      if (!grid) { state.rows += 1; renderGrid(); return; }
      var list = filtered();
      var cols = colsFor(body);
      var batch = cols <= 1 ? 3 : cols;
      var prevShow = grid.children.length;
      state.rows += 1;
      var show = Math.min(list.length, Math.max(batch, state.rows * batch));
      if (show > prevShow) {
        grid.insertAdjacentHTML("beforeend",
          list.slice(prevShow, show).map(function (h, i) { return cardHtml(h, prevShow + i); }).join(""));
      }
      var more = list.length - show;
      var mb = body.querySelector(".hg-more");
      if (mb) {
        if (more > 0) mb.innerHTML = esc(lc("Load one more row", "加载更多一行")) + " ▾ (" + more + ")";
        else if (mb.parentNode && mb.parentNode.parentNode) mb.parentNode.remove();
      }
    }

    /* 教派筛选胶囊条 —— 走平台【胶囊宪法】(cssosMakePillBar / data-pill-bar), 绝不另造一套。
     * 每个胶囊: 传统符号(=图标) + <span>名称</span>。"全部" 置首。只列【有内容】的教派 + 全部。 */
    function presentTraditions() {
      var set = {};
      allHymns.forEach(function (h) { set[String(h.tradition || "secular").toLowerCase()] = true; });
      return TRADITION_ORDER.filter(function (t) { return set[t]; })
        .concat(Object.keys(set).filter(function (t) { return TRADITION_ORDER.indexOf(t) < 0; }));
    }
    var _bar = null;
    function buildTabs() {
      var trads = presentTraditions();
      var html = '<button data-pill-key="all">✦ <span>' + esc(lc("All", "全部")) + "</span></button>";
      trads.forEach(function (t) {
        html += '<button data-pill-key="' + esc(t) + '">' + tradSym(t) +
          " <span>" + esc(tradName(t).split(" · ")[0]) + "</span></button>";
      });
      tabsEl.innerHTML = html;
      var initial = (activeTrad && trads.indexOf(activeTrad) >= 0) ? activeTrad : "all";
      if (typeof globalThis.cssosMakePillBar === "function") {
        try { if (_bar && _bar.destroy) _bar.destroy(); } catch (_e) {}
        _bar = globalThis.cssosMakePillBar(tabsEl, {
          activeKey: initial, textColor: "light",
          onActivate: function (key) { activeTrad = (key === "all") ? "" : key; state.rows = 1; renderGrid(); },
        });
      } else {
        // 胶囊工具缺席(极端情况): 退化成可点按钮, 仍能筛选。
        Array.prototype.forEach.call(tabsEl.children, function (b) {
          if (b.getAttribute("data-pill-key") === initial) b.classList.add("active");
          b.onclick = function () {
            Array.prototype.forEach.call(tabsEl.children, function (x) { x.classList.remove("active"); });
            b.classList.add("active");
            var k = b.getAttribute("data-pill-key"); activeTrad = (k === "all") ? "" : k; state.rows = 1; renderGrid();
          };
        });
      }
    }

    var _t = null;
    searchEl.addEventListener("input", function () { clearTimeout(_t); _t = setTimeout(function () { state.rows = 1; renderGrid(); }, 140); });
    // 视口变化 → 列数变 → 重排(保持当前展开的行数)。
    var _rz = null;
    var onResize = function () { clearTimeout(_rz); _rz = setTimeout(function () { if (document.getElementById("cssos-hymngal")) renderGrid(); }, 160); };
    window.addEventListener("resize", onResize);
    var _mo = new MutationObserver(function () { if (!document.getElementById("cssos-hymngal")) { window.removeEventListener("resize", onResize); _mo.disconnect(); } });
    try { _mo.observe(document.body, { childList: true }); } catch (_e) {}

    fetch("/api/hymns", { credentials: "omit" }).then(function (r) { return r.json(); })
      .then(function (j) { allHymns = (j && j.ok && Array.isArray(j.hymns)) ? j.hymns : []; buildTabs(); renderGrid(); })
      .catch(function () { body.innerHTML = '<div class="hg-empty">Could not load.</div>'; });
  };

  /* ── Dock 入口: 🏛 Sacred Scores ───────────────────────────────────────
   * Jing:「安静的躺在最后一个即可」→ 追加到 Dock 末尾(append, 不 insertBefore)。
   * 照 app.appstore-panel.js 的形制: 登记 dockActionMap["hymns"] + 注入 .dock-item。 */
  function registerDockAction() {
    try {
      var map = window.__cssosDockActionMap = window.__cssosDockActionMap || {};
      map["hymns"] = function () { globalThis.cssosOpenHymnGallery(); };
      window.dockActionMap = window.__cssosDockActionMap;
    } catch (_e) {}
  }
  function lc(en, zh) { try { return (typeof window.loginCopy === "function") ? window.loginCopy(en, zh) : en; } catch (_e) { return en; } }
  function mountDockItem() {
    var dock = document.querySelector(".dock") || document.querySelector("#dock");
    if (!dock) return false;
    if (dock.querySelector('[data-action="hymns"]')) return true;
    var item = document.createElement("button");
    item.className = "dock-item"; item.type = "button";
    item.setAttribute("data-action", "hymns");
    item.setAttribute("data-pill-key", "hymns");   // W1717 — 显式 pill key, 让 dock 胶囊上妆认它
    item.setAttribute("data-actions", "click");
    item.setAttribute("data-tooltip", lc("Sacred Scores", "圣乐乐谱"));
    item.setAttribute("aria-label", lc("Sacred Scores", "圣乐乐谱"));
    // W1715 — Jing: 用圣殿标 🏛(与数字演员同款; 📜 在部分字体渲染成方块)。走标准 .dock-item, 不自造胶囊。
    item.innerHTML = '<span class="dock-ico" aria-hidden="true">🏛</span><span class="dock-label">' +
      esc(lc("Sacred Music", "圣乐")) + '</span>';
    dock.appendChild(item);   // 末尾, 安静躺着
    item.addEventListener("click", function () { globalThis.cssosOpenHymnGallery(); });
    /* W1717 — Jing「圣殿也要套上胶囊风格」。dock 的 childList observer 只 syncActive、不重新上妆,
     * 而末尾 append 没触发重排 → 我的项没被 cssosMakePillBar 上妆(App 靠 insertBefore 插进轨内才有)。
     * 派发 cssos:settingschange → 触发 app.dock-pill.js 的 _onSettingsChange 整条重妆(含新项), 用它
     * 自己的正确 onActivate 配置, 不自造 pill CSS(守宪法)。 */
    try { document.dispatchEvent(new CustomEvent("cssos:settingschange")); } catch (_e) {}
    return true;
  }
  function ensureDockItem(retries) {
    if (mountDockItem()) return;
    if (retries <= 0) return;
    setTimeout(function () { ensureDockItem(retries - 1); }, 400);
  }

  registerDockAction();

  // 深链 ?hymns=1 → 打开画廊(第三类下方链接 ?hymn=<id> 是单首; ?hymns=1 是画廊)。
  function boot() {
    ensureDockItem(20);
    try { if (/[?&]hymns=1/.test(location.search || "")) globalThis.cssosOpenHymnGallery(); } catch (_e) {}
  }
  if (document.readyState !== "loading") setTimeout(boot, 650);
  else window.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 650); });
})();
