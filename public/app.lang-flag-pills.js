/* CSSOS_WAVE_561/566 20260531 — Jing「多语言/声线胶囊 = 国旗 + 凹凸镶嵌; 折叠成🌐多语言, hover 展开轨道」。
 * 语言按钮真实结构: #watch-language-pill > button[data-lang][data-take], 激活态 class=.active。
 * 折叠态(默认)只显一颗合成的【🌐 多语言】引导胶囊; hover(桌面)/.is-open(轻触)展开整条语言胶囊轨道。
 * 附加式: 不改 mv-language-pill 构建器; 只注入样式 + 前置国旗 + 折叠交互。胶囊宪法: min-width=高度×3。 */
(function () {
  "use strict";
  if (globalThis.__cssosLangFlagWired) return;
  globalThis.__cssosLangFlagWired = true;

  var FLAG = {
    en: "🇬🇧", english: "🇬🇧", "英": "🇬🇧",
    zh: "🇨🇳", cn: "🇨🇳", "中": "🇨🇳", chinese: "🇨🇳",
    ja: "🇯🇵", jp: "🇯🇵", "日": "🇯🇵", japanese: "🇯🇵",
    ko: "🇰🇷", kr: "🇰🇷", "한": "🇰🇷", "韩": "🇰🇷", korean: "🇰🇷",
    fr: "🇫🇷", "法": "🇫🇷", french: "🇫🇷",
    de: "🇩🇪", "德": "🇩🇪", german: "🇩🇪",
    es: "🇪🇸", "西": "🇪🇸", spanish: "🇪🇸",
    it: "🇮🇹", "意": "🇮🇹", italian: "🇮🇹",
    ru: "🇷🇺", "俄": "🇷🇺", russian: "🇷🇺",
    pt: "🇵🇹", "葡": "🇵🇹", portuguese: "🇵🇹",
    ar: "🇸🇦", "阿": "🇸🇦", arabic: "🇸🇦",
    hi: "🇮🇳", "印": "🇮🇳", hindi: "🇮🇳",
    el: "🇬🇷", "希": "🇬🇷", greek: "🇬🇷",
    la: "🏛", latin: "🏛", "拉": "🏛",
    peo: "🏺", fa: "🇮🇷", sa: "🕉", bo: "☸", ur: "🇵🇰",
    vi: "🇻🇳", is: "🇮🇸", sv: "🇸🇪", sw: "🇰🇪", tr: "🇹🇷", he: "🇮🇱"
  };

  // CSSOS_WAVE_567 — 语言完整单词(用本语言自称, 正好让胶囊较宽、符合宽=高×3)。
  var NAME = {
    en: "English", zh: "中文", ja: "日本語", ko: "한국어", fr: "Français",
    de: "Deutsch", es: "Español", it: "Italiano", ru: "Русский", pt: "Português",
    ar: "العربية", hi: "हिन्दी", el: "Ελληνικά", la: "Latina",
    peo: "𐎠𐎭", fa: "فارسی", sa: "संस्कृत", bo: "བོད", ur: "اردو",
    vi: "Tiếng Việt", is: "Íslenska", sv: "Svenska", sw: "Kiswahili", tr: "Türkçe", he: "עברית"
  };
  function nameFor(code) {
    var s = String(code || "").trim().toLowerCase().replace(/[0-9０-９]+$/, "").trim();
    return NAME[s] || NAME[s.slice(0, 2)] || NAME[s.slice(0, 1)] || code;
  }

  // CSSOS_WAVE_587 — 声线 glyph + 双语名(与 app.add-voice-modal.js 的 VOICES 对齐; auto=原声)。
  var VOICE_GLYPH = {
    auto: "🎙", feminine: "👩", masculine: "👨", childlike: "🧒", duet: "👫",
    androgynous: "🧑", polyphonic_choir: "🎶", raspy: "🔥", operatic: "🎭",
    whisper: "🌬", robotic: "🤖",
    jing: "🎙", // CSSOS_WAVE_587 — 创始人声线(RVC 真人声纹)
    jing_tenor: "🎤" // Jing 男高音版(同声纹 + 升调)
  };
  var VOICE_NAME_EN = {
    auto: "Original", feminine: "Feminine", masculine: "Masculine", childlike: "Childlike",
    duet: "Duet", androgynous: "Androgynous", polyphonic_choir: "Choir", raspy: "Raspy",
    operatic: "Operatic", whisper: "Whisper", robotic: "Robotic",
    jing: "Jing's Voice", jing_tenor: "Jing (Tenor)"
  };
  var VOICE_NAME_ZH = {
    auto: "原声", feminine: "女声", masculine: "男声", childlike: "童声", duet: "二重唱",
    androgynous: "中性声", polyphonic_choir: "合唱", raspy: "沙哑", operatic: "美声",
    whisper: "气声", robotic: "电子声",
    jing: "Jing 声线", jing_tenor: "Jing 男高音"
  };
  function voiceGlyph(v) { return VOICE_GLYPH[String(v || "auto").toLowerCase()] || "🎤"; }
  function voiceName(v) {
    var k = String(v || "auto").toLowerCase();
    var zh = String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0;
    return (zh ? VOICE_NAME_ZH[k] : VOICE_NAME_EN[k]) || k;
  }
  function curMode() {
    var m = globalThis.__cssosLangPillMode;
    return (m === "voice") ? "voice" : "lang";
  }

  function flagFor(txt) {
    var s = String(txt || "").trim().toLowerCase();
    var base = s.replace(/[0-9０-９]+$/, "").trim();
    if (FLAG[base]) return FLAG[base];
    var two = base.slice(0, 2);
    if (FLAG[two]) return FLAG[two];
    var one = base.slice(0, 1);
    if (FLAG[one]) return FLAG[one];
    return "🌐";
  }

  function foldedLabel() {
    try {
      if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy("Languages", "多语言");
      var l = String(document.documentElement.lang || navigator.language || "").toLowerCase();
      return l.indexOf("zh") === 0 ? "多语言" : "Languages";
    } catch (_e) { return "Languages"; }
  }

  function injectStyle() {
    if (document.getElementById("cssos-lang-flag-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-lang-flag-style";
    st.textContent = [
      // CSSOS_WAVE_587 — 单行布局: [模式胶囊 🌐多语言 | 🎤多声线] + [一条 cell 轨道]。
      // 不再折叠成单颗; 两个模式胶囊常显, 点谁就只显谁那一类 cell(lang/voice)。
      // CSSOS_WAVE_587 — z-index 抬到 40 + pointer-events:auto: 之前两颗模式胶囊很难点(被字幕/Dock 等层盖住或层级不够)。
      "#cssos-lang-fold{position:absolute;left:50%;bottom:60px;transform:translateX(-50%);z-index:40;display:inline-flex;align-items:center;max-width:92vw;pointer-events:auto;}",
      "#cssos-lang-fold .cssos-mode-cap,#cssos-lang-fold #watch-language-pill,#cssos-lang-fold #watch-language-pill>button{pointer-events:auto !important;}",
      // CSSOS_WAVE_587 — 难点击根因: 宪法凹凸咬合用【负margin+透明遮罩】让相邻胶囊盒子伸进激活胶囊 20px,
      // 那块透明咬口仍然捕获点击 → 偷走激活/模式胶囊边缘的点击。把它们的 z 抬高于相邻咬口, 点击就落自己身上。
      "#cssos-lang-fold #watch-language-pill>button{position:relative;z-index:1;}",
      "#cssos-lang-fold .cssos-mode-cap{z-index:3 !important;}",
      "#cssos-lang-fold #watch-language-pill>button.active{z-index:5 !important;}",
      // CSSOS_WAVE_587d — Jing「只要一条轨道」: 两颗模式胶囊 + cell 全在【同一条】pill-bar(#watch-language-pill)里,
      // 一条连续凹凸镶嵌轨: [🌐多语言·N][🎤多声线·N][cell…]。模式胶囊(.cssos-mode-cap)常显, cell 折叠时隐藏。
      "#watch-language-pill .cssos-mode-cap .cssos-mode-ico{font-size:0.95em;line-height:1;}",
      "#watch-language-pill .cssos-mode-cap .cssos-mode-n{opacity:0.7;font-weight:700;margin-left:2px;}",
      // 折叠/展开: data-expanded 决定显哪类 cell; 模式胶囊永不隐藏(它们不是 .cssos-cell)。
      //  · none → 只剩两颗模式胶囊。 · lang → 接着展开语言 cell。 · voice → 接着展开声线 cell。
      //  · 选了 cell → 收回 none。未选不收。太多横滑。
      // CSSOS_WAVE_587h — 默认收起【只要不是明确 lang/voice 展开就收】: 覆盖 data-expanded=none/缺失/任何非展开值,
      // 防止渲染时机里属性未设 → cell 全露(语言声线混一起)。只有 lang/voice 才放对应 cell 出来。
      "#cssos-lang-fold:not([data-expanded=\"lang\"]):not([data-expanded=\"voice\"]) #watch-language-pill .cssos-cell{display:none !important;}",
      "#cssos-lang-fold[data-expanded=\"lang\"]  #watch-language-pill .cssos-cell-voice,",
      "#cssos-lang-fold[data-expanded=\"lang\"]  #watch-language-pill .cssos-voice-guide{display:none !important;}",
      "#cssos-lang-fold[data-expanded=\"voice\"] #watch-language-pill .cssos-cell-lang,",
      "#cssos-lang-fold[data-expanded=\"voice\"] #watch-language-pill .cssos-lang-guide{display:none !important;}",
      // cell 紧接着模式胶囊向右展开(transform-origin 左 = 从🎤胶囊处长出); 仅 transform/opacity(合规)。
      "#watch-language-pill{transform-origin:left center;}",
      "#cssos-lang-fold[data-expanded=\"lang\"] #watch-language-pill,",
      "#cssos-lang-fold[data-expanded=\"voice\"] #watch-language-pill{animation:cssosExpandTrack .24s cubic-bezier(.2,.7,.2,1);}",
      "@keyframes cssosExpandTrack{from{transform:scaleX(.55);opacity:0.2}to{transform:scaleX(1);opacity:1}}",
      // CSSOS_WAVE_571 — 不要覆盖宪法 button 的 width/min-width! 宪法用 width:calc(100%+20px) 做左右咬合,
      // 我之前的 min-width:90px !important 把它压死 → 左侧凹口算不出来(只有右侧对)。这里【只】补图标排版。
      "#watch-language-pill > button .lang-flag{font-size:0.95em;line-height:1;}",
      // CSSOS_WAVE_579 — Jing「没凹就是子弹」根治: 上一版我加 grid-auto-columns:max-content 覆盖了宪法的
      // 列定义 minmax(max-content,1fr) → 宪法凹凸咬合的列数学(width:calc(100%+20px)+负margin)崩了 → 变子弹。
      // 【绝不覆盖宪法 grid 列】。宪法 minmax 下限本就是 max-content, 完整单词不会被压; 只需容器可横滑 + 文字不省略。
      // CSSOS_WAVE_587j — Jing「胶囊撑满轨道, 别空一截; Want an MV 别被截断」:
      //  · 轨道高度=胶囊高度(40px)+ 子胶囊撑满(height:100%, 居中), 消除宪法 42px 容器底部的空缝。
      //  · max-width 放宽到 min(96vw,980px), 桌面端 6 颗满文字胶囊放得下不被圆角裁切; 窄屏仍可横滑。
      "#watch-language-pill{overflow-x:auto !important;max-width:min(96vw,980px) !important;height:40px !important;min-height:40px !important;align-items:center !important;scrollbar-width:none;}",
      "#watch-language-pill > button{height:40px !important;min-height:40px !important;max-height:40px !important;align-self:center !important;}",
      "#watch-language-pill::-webkit-scrollbar{display:none;}",
      // CSSOS_WAVE_587f — 根因: 全局 @media(pointer:coarse){.lang-name{display:none}} 在【触屏=App】上把所有
      // .lang-name 隐藏 → 胶囊只剩国旗/图标(中文「日本語」「多语言」都没了)。这里强制语言轨内的 .lang-name 常显。
      // CSSOS_WAVE_587g — 根因有二: 全局 .lang-name 基样式是【opacity:0 + translateY】(只在 .lang-card:hover 才显),
      // 且触屏 media query 还 display:none。我的胶囊复用了 .lang-name → 文字一直透明/隐藏。这里全部强制可见。
      "#watch-language-pill .lang-name{display:inline-flex !important;align-items:center !important;margin-left:5px !important;opacity:1 !important;transform:none !important;overflow:visible !important;text-overflow:clip !important;}",
      // CSSOS_WAVE_574 — 不依赖 :has 的【左凹】(JS 给激活左侧的胶囊打 .cssos-laft)。镜像宪法左凹规则,
      // 让左侧胶囊也凹向激活(右边缘咬出弧口), 与右侧 .active~ 对称。",
      "#watch-language-pill > button.cssos-laft{",
      "border-radius:999px 0 0 999px !important;margin-right:-20px !important;width:calc(100% + 20px) !important;",
      "padding-right:36px !important;z-index:0 !important;",
      "-webkit-mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;",
      "mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;}"
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  // 作者本人判定 + workId 解析(多处复用)。
  function resolveOwn() {
    var isOwn = false, wid = "";
    try {
      var w = (typeof globalThis.cssosCurrentWork === "function") ? globalThis.cssosCurrentWork() : null;
      if (w) { isOwn = !!w.is_own; wid = w.id || w.work_id || ""; }
    } catch (_e) {}
    if (!isOwn || !wid) {
      try {
        var ps = (typeof globalThis.cssosMvPipelinePanelState === "function") ? globalThis.cssosMvPipelinePanelState() : null;
        if (ps) { isOwn = isOwn || !!(ps.is_own || (ps.work && ps.work.is_own)); wid = wid || (ps.workId ? String(ps.workId).split("|")[0] : ""); }
      } catch (_e2) {}
    }
    return { isOwn: isOwn, wid: wid };
  }

  // CSSOS_WAVE_587c — 折叠/展开状态: 'none'(只两颗胶囊) | 'lang' | 'voice'。默认折叠。
  var _expanded = "none";

  // CSSOS_WAVE_587d — 两颗模式胶囊塞进【同一条】轨道(#watch-language-pill)的最前面, 与 cell 同属一条 pill-bar。
  // render() 每次会清空 bar → 这里在 enhance 中保证它们作为前两颗常驻(没有就 prepend)。
  function ensureModeSwitch(fold, bar) {
    if (bar.querySelector(".cssos-mode-cap")) return; // 已在
    var caps = [];
    ["voice", "lang"].forEach(function (mode) { // prepend 逆序 → 最终顺序 lang, voice
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cssos-mode-cap";
      b.dataset.mode = mode;
      b.setAttribute("data-pill-key", "m-" + mode);
      b.innerHTML = '<span class="cssos-mode-ico"></span><span class="lang-name"></span><span class="cssos-mode-n"></span>';
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        // 点同一个已展开的模式 → 收回折叠; 否则激活该模式并展开它的轨道。
        if (curMode() === mode && _expanded === mode) { _expanded = "none"; }
        else { globalThis.__cssosLangPillMode = mode; _expanded = mode; }
        applyState(fold);
        paintModeSwitch(bar);
      }, false);
      bar.insertBefore(b, bar.firstChild);
      caps.push(b);
    });
    return caps;
  }
  // data-mode = 激活高亮的模式; data-expanded = 当前展开的轨道('none' 为折叠)。
  function applyState(fold) {
    fold.setAttribute("data-mode", curMode());
    fold.setAttribute("data-expanded", _expanded);
  }
  function paintModeSwitch(bar) {
    var caps = bar.querySelectorAll(".cssos-mode-cap");
    if (!caps.length) return;
    var zh = String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0;
    // CSSOS_WAVE_587 — 双向计数: 🌐=当前声线有几种语言(bar.dataset.nLang); 🎤=当前语言有几种声线(nVoice)。
    // render() 已算好写进 dataset; 拿不到才回落到 DOM cell 计数。
    var nLang = Number(bar.dataset.nLang || 0) || bar.querySelectorAll(".cssos-cell-lang").length;
    var nVoice = Number(bar.dataset.nVoice || 0) || bar.querySelectorAll(".cssos-cell-voice").length;
    [].slice.call(caps).forEach(function (b) {
      var mode = b.dataset.mode;
      var ico = b.querySelector(".cssos-mode-ico");
      var nm = b.querySelector(".lang-name");
      var nn = b.querySelector(".cssos-mode-n");
      if (mode === "lang") { ico.textContent = "🌐"; nm.textContent = zh ? "多语言" : "Languages"; nn.textContent = nLang > 1 ? ("· " + nLang) : ""; }
      else { ico.textContent = "🎤"; nm.textContent = zh ? "多声线" : "Voices"; nn.textContent = nVoice > 1 ? ("· " + nVoice) : ""; }
      b.classList.toggle("active", curMode() === mode);
      // CSSOS_WAVE_587c — 短 title(长串原生 tooltip 浮在轨道上很乱, 见图2)。
      b.title = mode === "lang" ? (zh ? "多语言" : "Languages") : (zh ? "多声线" : "Voices");
    });
  }

  function enhance() {
    var bar = document.getElementById("watch-language-pill");
    if (!bar) return;
    injectStyle();
    // 胶囊宪法: cell 轨道容器。
    bar.setAttribute("data-pill-bar", "");
    bar.setAttribute("data-pill-compact", "");
    bar.setAttribute("data-pill-mono", "");
    bar.style.position = "static";
    bar.style.transform = "none";
    bar.style.left = "auto";
    // 外层单行包装: [模式胶囊][cell 轨道]。
    var fold = document.getElementById("cssos-lang-fold");
    if (!fold) {
      fold = document.createElement("div");
      fold.id = "cssos-lang-fold";
      bar.parentNode.insertBefore(fold, bar);
      fold.appendChild(bar);
    }
    // CSSOS_WAVE_587 — Jing「多语言/多声线也要 hover 就显示, 选中就收回」: 桌面 hover 展开当前模式的轨道,
    // 移出收回两胶囊; 移动端仍靠点击模式胶囊展开(无 hover)。
    if (fold.dataset.hoverWired !== "1") {
      fold.dataset.hoverWired = "1";
      var canHover = false;
      try { canHover = window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches; } catch (_e) {}
      if (canHover) {
        fold.addEventListener("mouseenter", function () {
          if (_expanded === "none") { _expanded = curMode(); applyState(fold); }
        });
        fold.addEventListener("mouseleave", function () {
          _expanded = "none"; applyState(fold);
        });
      }
    }
    // CSSOS_WAVE_587c — 选了某颗真实 cell(非引导胶囊) → 收回折叠(回到两胶囊)。委托一次即可(bar 元素常驻)。
    if (bar.dataset.collapseWired !== "1") {
      bar.dataset.collapseWired = "1";
      bar.addEventListener("click", function (e) {
        var cell = e.target && e.target.closest && e.target.closest("button.cssos-cell");
        if (!cell) return;
        if (cell.classList.contains("cssos-lang-guide") || cell.classList.contains("cssos-voice-guide")) return;
        _expanded = "none";
        var f = document.getElementById("cssos-lang-fold");
        if (f) applyState(f);
      }, false);
    }
    ensureModeSwitch(fold, bar);
    applyState(fold);

    // ── cell 标签重排(语言 cell=国旗+语言名; 声线 cell=声线 glyph+声线名) ──
    var cells = bar.querySelectorAll("button.cssos-cell");
    cells.forEach(function (p) {
      var lang = p.dataset.lang || "";
      var voice = p.dataset.voice || "auto";
      var isVoice = p.classList.contains("cssos-cell-voice");
      if (!p.getAttribute("data-pill-key")) {
        p.setAttribute("data-pill-key", (isVoice ? "v-" : "l-") + lang + "-" + voice);
      }
      var glyph, label, tip;
      if (isVoice) {
        // CSSOS_WAVE_587 — 「原声(auto)」用作品真实声线名显示(如中文女声→「女声」); 未知才退回「原声」。
        var ov = String(bar.dataset.originVoice || "").toLowerCase();
        var effVoice = (voice === "auto" && ov) ? ov : voice;
        glyph = voiceGlyph(effVoice); label = voiceName(effVoice); tip = label + " · " + nameFor(lang);
      }
      else { glyph = flagFor(lang); label = nameFor(lang); tip = label; }
      var sig = glyph + "|" + label;
      if (p.dataset.cellSig !== sig) {
        p.dataset.cellSig = sig;
        p.innerHTML = "";
        var fs = document.createElement("span"); fs.className = "lang-flag"; fs.textContent = glyph;
        var ls = document.createElement("span"); ls.className = "lang-name"; ls.textContent = label;
        p.appendChild(fs); p.appendChild(ls);
      }
      p.title = tip;
    });
    // ── 上下文引导胶囊(CSS 按模式 show/hide; 语言模式显➕加语言, 声线模式显🎤加声线) ──
    var zh = String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0;
    var own = resolveOwn();
    // 语言引导: 作者→➕加语言; 非作者→✨做多语言MV。始终保留一颗(单/多语言都显, 引导收入)。
    (function langGuide() {
      var g = bar.querySelector(".cssos-lang-guide");
      if (!g) {
        g = document.createElement("button"); g.type = "button"; g.className = "cssos-cell cssos-cell-lang cssos-lang-guide";
        g.setAttribute("data-pill-key", "lang-guide");
        g.innerHTML = '<span class="lang-flag"></span><span class="lang-name"></span>';
        g.addEventListener("click", function (e) {
          e.stopPropagation();
          var o = resolveOwn();
          if (o.isOwn && o.wid && typeof globalThis.cssosOpenAddLanguageModal === "function") { globalThis.cssosOpenAddLanguageModal(o.wid); return; }
          if (typeof globalThis.invokeUniversalCreationEntry === "function") globalThis.invokeUniversalCreationEntry({ origin: "lang-guide", preferredTab: "mv" });
          else if (typeof globalThis.openMvPipelinePanel === "function") globalThis.openMvPipelinePanel({ focus: true });
        }, false);
        bar.appendChild(g);
      }
      // CSSOS_WAVE_587g — Jing 指定文案: 作者→「添加更多语言」; 非作者→「Want an MV like this」。
      g.querySelector(".lang-flag").textContent = own.isOwn ? "➕" : "✨";
      g.querySelector(".lang-name").textContent = own.isOwn ? (zh ? "添加更多语言" : "Add a language") : (zh ? "想要这样的MV?" : "Want an MV like this");
      g.title = own.isOwn ? (zh ? "为这首作品添加多一种语言" : "Add another language to this MV") : (zh ? "创作你自己的多语言 MV" : "Create your own MV like this");
    })();
    // 声线引导: 作者→🎤添加更多声线; 非作者→✨Want an MV like this(语言/声线两个模式都给非作者一颗引导)。
    (function voiceGuide() {
      var gv = bar.querySelector(".cssos-voice-guide");
      if (!gv) {
        gv = document.createElement("button"); gv.type = "button"; gv.className = "cssos-cell cssos-cell-voice cssos-voice-guide";
        gv.setAttribute("data-pill-key", "voice-guide");
        gv.innerHTML = '<span class="lang-flag"></span><span class="lang-name"></span>';
        gv.addEventListener("click", function (e) {
          e.stopPropagation();
          var o = resolveOwn();
          if (o.isOwn && o.wid && typeof globalThis.cssosOpenAddVoiceModal === "function") { globalThis.cssosOpenAddVoiceModal(o.wid); return; }
          if (typeof globalThis.invokeUniversalCreationEntry === "function") globalThis.invokeUniversalCreationEntry({ origin: "voice-guide", preferredTab: "mv" });
          else if (typeof globalThis.openMvPipelinePanel === "function") globalThis.openMvPipelinePanel({ focus: true });
        }, false);
        bar.appendChild(gv);
      }
      gv.querySelector(".lang-flag").textContent = own.isOwn ? "🎤" : "✨";
      gv.querySelector(".lang-name").textContent = own.isOwn ? (zh ? "添加更多声线" : "Add a voice") : (zh ? "想要这样的MV?" : "Want an MV like this");
      gv.title = own.isOwn ? (zh ? "为这首作品添加多一种声线(旋律不变, 换声线重唱)" : "Add another voice (same melody, re-sung)") : (zh ? "创作你自己的 MV" : "Create your own MV like this");
    })();

    paintModeSwitch(bar);

    // CSSOS_WAVE_588 — 左凹统一: 不再用本组件自己的 .cssos-laft(会与全局兜底 .cssos-pill-laft 双重咬合)。
    // 改为完全交给全局 app.pill-left-concave.js(已统一取【最右 active】作锚点)。这里只清掉历史遗留的 .cssos-laft。
    [].forEach.call(bar.querySelectorAll("button.cssos-laft"), function (p) { p.classList.remove("cssos-laft"); });
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; try { enhance(); } catch (_e) {} }, 120);
  }
  function start() {
    var host = document.getElementById("watch-panel") || document.body;
    try { new MutationObserver(schedule).observe(host, { childList: true, subtree: true }); } catch (_e) {}
    schedule();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
})();
