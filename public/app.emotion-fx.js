/* CSSOS_WAVE_668 #44 — 情绪字幕特效层(参数化, 三层优先级).
 *
 * 逐字情绪字幕真"有情绪": 每字【蹦】(pop, 幅度∝该字 emotion_intensity), 峰值字【爆】(burst),
 * 并可【全屏闪】(夸张)。全部吃后端逐字 emotion_intensity(subtitle token), 零实时音频、永不掉声
 * (见记忆: 播放元素永不接 Web Audio)。
 *
 * 三层优先级("在哪里用在哪里改" + "管理员设的值=中位"):
 *   硬默认 DEFAULTS  <  平台默认 platform(管理员设, 后端下发, =拉杆中位)  <  用户偏好 user(本人覆盖)
 *   有效值 = {...DEFAULTS, ...platform, ...user}
 *
 * API(右击「多语言/多声线」拉杆小窗用, 也可控制台直调):
 *   cssosSetEmotionFX({bounce:0.5})            // 设【用户偏好】(本人), 即时生效+落盘
 *   cssosSetEmotionPlatformDefaults({...})      // 设【平台默认】(管理员保存后端后同步本地)
 *   CSSOS_EMOTION_FX  / cssosEmotionFXLayers()  // 查有效值 / 查三层
 */
(function () {
  "use strict";
  // CSSOS_WAVE_688 — 硬默认拔到「疯牛」档(Jing: 必须像疯牛一样爆)。这是保底地板, 即使后端
  // /api/emotion-fx-defaults 拉不到, 字幕也已经狂暴。burstThreshold 降到 0.5 → 逐字情绪强度
  // 均值 0.65, 大量字越线触发「爆」+ 全屏闪。平台默认(管理员)仍可在此之上微调。
  var DEFAULTS = {
    bounce: 0.7, lift: 20, popDurMs: 360, glow: 1.8,
    burstThreshold: 0.5, burstScale: 2.8, burstDurMs: 600,
    flash: 0.95, fullscreen: true,
    pitchSpread: 26   // ③ 音高旋律线: 字随音高上下浮动的最大幅度(px); 0 = 关
  };
  var EMO_RGB = {
    ignite: "255,150,60", joy: "255,214,96", calm: "120,224,212",
    intimate: "255,170,150", resolve: "150,200,255", grief: "150,150,230"
  };
  var K_PLATFORM = "cssos.emotionfx.platform";
  var K_USER = "cssos.emotionfx.user";

  function readJson(k) { try { var v = JSON.parse(localStorage.getItem(k) || "{}"); return (v && typeof v === "object") ? v : {}; } catch (e) { return {}; } }
  var platform = readJson(K_PLATFORM);   // 管理员设的平台默认(本地缓存, 后端为准)
  var userPref = readJson(K_USER);       // 用户本人覆盖(仅存其改过的键)
  var FX = {};

  function recompute() {
    FX = Object.assign({}, DEFAULTS, platform, userPref);
    globalThis.CSSOS_EMOTION_FX = FX;
    apply();
  }
  function apply() {
    var r = document.documentElement.style;
    r.setProperty("--cssfx-bounce", String(FX.bounce));
    r.setProperty("--cssfx-lift", String(FX.lift));
    r.setProperty("--cssfx-pop-dur", FX.popDurMs + "ms");
    r.setProperty("--cssfx-glow", String(FX.glow));
    r.setProperty("--cssfx-burst-scale", String(FX.burstScale));
    r.setProperty("--cssfx-burst-dur", FX.burstDurMs + "ms");
    r.setProperty("--cssfx-flash", String(FX.flash));
    r.setProperty("--cssfx-pitch-spread", (FX.pitchSpread != null ? FX.pitchSpread : 14) + "px");
    try { document.documentElement.classList.toggle("cssfx-fullscreen-on", !!FX.fullscreen); } catch (e) {}
  }

  // CSSOS_WAVE_705 — 关键修复: 桌面影院用 panel.requestFullscreen() → #watch-panel 成全屏元素,
  // 挂在 body 上的特效层在【全屏元素之外 → 完全不可见】(Jing 一直"看不到爆"的真因)。
  // 解决: 特效层挂到【当前全屏元素】(没有就 #watch-panel, 再没有才 body), 并在全屏切换时重新归位。
  function fxHost() {
    // 原生全屏时【必须】挂到全屏元素(否则不渲染); 否则挂 body(页面级, z-index 10088 压全场,
    // 不被影院层 10052-10080 盖住)。不要在非全屏时挂 #watch-panel —— 会困在其层叠上下文里。
    return document.fullscreenElement
        || document.webkitFullscreenElement
        || document.body
        || document.documentElement;
  }
  function homeLayer(el) {
    try {
      var host = fxHost();
      if (el && host && el.parentNode !== host) host.appendChild(el);
    } catch (_e) {}
  }
  // 全屏进/出时把三层都搬到新宿主, 保证任何模式下都可见。
  function rehomeAll() {
    [document.getElementById("cssfx-flash-overlay"),
     document.getElementById("cssfx-confetti"),
     document.getElementById("cssfx-center-burst")].forEach(function (el) { if (el) homeLayer(el); });
  }
  try {
    document.addEventListener("fullscreenchange", rehomeAll);
    document.addEventListener("webkitfullscreenchange", rehomeAll);
  } catch (e) {}

  var flashEl = null;
  function ensureFlash() {
    if (!flashEl) flashEl = document.getElementById("cssfx-flash-overlay");
    if (!flashEl) {
      flashEl = document.createElement("div");
      flashEl.id = "cssfx-flash-overlay";
      flashEl.setAttribute("aria-hidden", "true");
    }
    homeLayer(flashEl);   // 每次都确认挂在当前全屏宿主下
    return flashEl;
  }
  globalThis.cssosEmotionFlash = function (emotion, intensity) {
    if (globalThis.cssosEmotionSubtitlesOff === true) return;   // W725 — 情绪字幕主开关(关 = 只留普通字幕)
    if (!FX.fullscreen || !FX.flash) return;
    try {
      var el = ensureFlash();
      var rgb = EMO_RGB[String(emotion || "").toLowerCase()] || "255,224,140";
      var peak = Math.max(0, Math.min(1, Number(intensity) || 0.8)) * Number(FX.flash);
      el.style.setProperty("--cssfx-flash-rgb", rgb);
      el.style.setProperty("--cssfx-flash-peak", peak.toFixed(3));
      el.style.setProperty("--cssfx-flash-dur", (FX.burstDurMs || 520) + "ms");
      el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash");
      // CSSOS_WAVE_726 — 天女散花(从天而降)做成可选: 默认关; 用户在面板开启后, 峰值字时才撒。
      spawnConfetti(emotion, peak);   // 内部 cssosConfettiTopDown !== true 直接 return
    } catch (e) {}
  };

  // ── 天女散花 confetti(峰值庆祝)──────────────────────────────────────────
  var PETALS = ["🌸", "🌺", "🌷", "💮", "✨", "🎉", "💖", "🌟"];
  var EMO_PETALS = {
    joy: ["🌸","🌟","✨","🎉"], ignite: ["🎉","💥","✨","🌟"], resolve: ["🌸","💮","✨","💖"],
    grief: ["🤍","💧","✨"], calm: ["🌸","💮","✨"], intimate: ["💖","🌸","✨"],
  };
  var confettiLayer = null;
  function ensureConfettiLayer() {
    if (!confettiLayer) confettiLayer = document.getElementById("cssfx-confetti");
    if (!confettiLayer) {
      confettiLayer = document.createElement("div");
      confettiLayer.id = "cssfx-confetti";
      confettiLayer.setAttribute("aria-hidden", "true");
    }
    homeLayer(confettiLayer);
    return confettiLayer;
  }
  // CSSOS_WAVE_721 — 内容联动 emoji 池: 优先用本曲 AI 生成的 theme_emoji(西部→🤠🐎🔫, 圣城→🕊️🏛️🌟),
  // 没有才回退情绪默认/花。让 confetti + 器乐 emoji 都"长在歌曲内容里", 不再千篇一律。
  function _themePool(fallback) {
    try {
      var th = globalThis.cssosWorkThemeEmoji;
      if (Array.isArray(th) && th.length >= 3) return th;
    } catch (e) {}
    return fallback;
  }
  var _lastConfetti = 0;
  function spawnConfetti(emotion, peak) {
    if (globalThis.cssosEmotionSubtitlesOff === true) return;
    if (globalThis.cssosConfettiTopDown !== true) return;   // W726 — 天女散花(从天而降)默认关, 用户可开
    var now = (globalThis.performance && performance.now) ? performance.now() : 0;
    if (now && now - _lastConfetti < 420) return; // 节流: 别每字都撒, 保持"庆祝"的稀有感
    _lastConfetti = now;
    var layer = ensureConfettiLayer();
    var pool = _themePool(EMO_PETALS[String(emotion || "").toLowerCase()] || PETALS);
    // 数量 ∝ 峰值强度(0.8→16, 1.0→26), 越激动撒越多。
    var n = Math.round(14 + 12 * Math.max(0, Math.min(1, Number(peak) || 0.8)));
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var p = document.createElement("span");
      p.className = "cssfx-petal";
      p.textContent = pool[(Math.random() * pool.length) | 0];
      var startX = (Math.random() * 100).toFixed(2);        // vw 起点
      var drift = (Math.random() * 36 - 18).toFixed(1);     // 横向飘移 vw
      var rot = ((Math.random() * 720 - 360)).toFixed(0);   // 旋转
      var dur = (1.7 + Math.random() * 1.4).toFixed(2);     // 1.7–3.1s
      var delay = (Math.random() * 0.26).toFixed(2);
      var sz = (0.9 + Math.random() * 1.5).toFixed(2);      // em
      p.style.cssText =
        "left:" + startX + "vw;" +
        "--pf-drift:" + drift + "vw;" +
        "--pf-rot:" + rot + "deg;" +
        "--pf-dur:" + dur + "s;" +
        "--pf-delay:" + delay + "s;" +
        "font-size:" + sz + "em;";
      frag.appendChild(p);
    }
    layer.appendChild(frag);
    // 清理: 最长 ~3.4s 后移除本批
    setTimeout(function () {
      try { while (layer.firstChild && layer.childNodes.length > 240) layer.removeChild(layer.firstChild); } catch (_e) {}
    }, 60);
    setTimeout(function () {
      try {
        var kids = layer.querySelectorAll(".cssfx-petal");
        for (var k = 0; k < Math.min(kids.length, n); k++) { if (kids[k]) layer.removeChild(kids[k]); }
      } catch (_e) {}
    }, 3600);
  }
  globalThis.cssosEmotionConfettiBurst = spawnConfetti; // 供调试/手动触发

  // ── 屏幕中央爆(情绪字幕)──────────────────────────────────────────────────
  // CSSOS_WAVE_692 — Jing: 唱到的字/词在【屏幕中央】爆一下(一闪), 大小/时长按【唱腔时长×强度】。
  // 不一定套圈圈(气泡偶尔)。左下角普通字幕照常安静; 这是【叠加】的情绪层。compositor-safe。
  var centerLayer = null;
  function ensureCenterLayer() {
    if (!centerLayer) centerLayer = document.getElementById("cssfx-center-burst");
    if (!centerLayer) {
      centerLayer = document.createElement("div");
      centerLayer.id = "cssfx-center-burst";
      centerLayer.setAttribute("aria-hidden", "true");
    }
    homeLayer(centerLayer);
    return centerLayer;
  }
  // text=要爆的字/词; emotion=情绪(配色); intensity=0..1(决定大小); durSec=唱腔时长(决定停留);
  // emoji=该情绪 emoji(可选)→ 渲染在大字【背后】做柔光背景(Jing: 字幕在上, 背景是 emoji, 全屏爆)。
  // CSSOS_WAVE_702 — 重做: 一个 burst = 【emoji 背景层(后)+ 发光大字(前)】的组合, emoji 不再占字幕轨。
  globalThis.cssosEmotionCenterBurst = function (text, emotion, intensity, durSec, emoji, scatter) {
    try {
      if (globalThis.cssosEmotionCenter === false) return;
      var t = String(text || "").trim();
      if (!t) return;
      var layer = ensureCenterLayer();
      var rgb = EMO_RGB[String(emotion || "").toLowerCase()] || "255,224,140";
      var inten = Math.max(0, Math.min(1, Number(intensity) || 0.6));
      // 字号: 强度 0.5→3.2rem, 1.0→7.5rem(越激动越大)。中文字少可更大。
      var sz = (2.6 + inten * 5.0).toFixed(2);
      // CSSOS_WAVE_705 — Jing: 爆入瞬间咬中唱点(快), 之后【延时淡出】(不必严格唱腔时长)。
      // 停留拉长: 0.9s 起、上限 2.4s, 让中央那个字"爆完慢慢透明隐去", 截图也抓得住。
      var dwell = Math.max(0.9, Math.min(2.4, (Number(durSec) || 0.5) * 1.0 + 0.6));
      // 组合容器: emoji 背景 + 大字前景, 共用同一缩放/淡出节奏。
      var grp = document.createElement("div");
      grp.className = "cssfx-center-grp";
      grp.style.cssText = "--cb-rgb:" + rgb + ";--cb-dur:" + dwell.toFixed(2) + "s;";
      // CSSOS_WAVE_716 — scatter: 不在中央, 全屏随机一个安全位置爆(避开顶部搜索/底部胶囊区)。
      if (scatter) {
        grp.classList.add("is-scatter");
        grp.style.left = (8 + Math.random() * 74).toFixed(1) + "%";
        grp.style.top = (14 + Math.random() * 58).toFixed(1) + "%";
      }
      var emo = String(emoji || "").trim();
      if (emo) {
        var bg = document.createElement("div");
        bg.className = "cssfx-center-emoji";
        bg.textContent = emo;
        // emoji 背景比大字更大(2.4×), 柔光/半透明, 衬在字后。
        bg.style.cssText = "font-size:" + (parseFloat(sz) * 2.35).toFixed(2) + "rem;";
        grp.appendChild(bg);
      }
      var el = document.createElement("div");
      el.className = "cssfx-center-word";
      el.textContent = t;
      el.style.cssText =
        "font-size:" + sz + "rem;" +
        "--cb-glow:" + (0.4 + inten * 0.6).toFixed(2) + ";";
      grp.appendChild(el);
      layer.appendChild(grp);
      setTimeout(function () { try { if (grp && grp.parentNode) grp.parentNode.removeChild(grp); } catch (_e) {} }, Math.round(dwell * 1000) + 280);
    } catch (e) {}
  };

  // ── 整句累积爆(W720)──────────────────────────────────────────────────────────
  // Jing: 不再"单字一爆就消失"。一句字幕从第一个字开始, 逐字在【智能随机位置】爆出并【驻留+轻呼吸】,
  // 直到整句铺完(看起来是完整一句, 不死板但能读), 再【整句一起慢慢淡出】; 然后下一句。
  // "智能随机"= 按阅读顺序铺成松散网格(左→右、上→下)+ 抖动, 不是乱撒。字号 ∝ 情绪强度(每字不同)。
  var _lineStage = { key: null, els: [], spawned: null };
  // 返回【中心点】坐标(% of viewport)。CSS 用 translate(-50%,-50%) 以此为中心 → 贴边的字会
  // 超出屏幕约一半(媒体框只显示半个字), 但中心点 clamp 永远不会完全出屏。
  // CSSOS_WAVE_721 — 竖排(vertical): 拉丁语/移动端用竖排(横排会挤爆窄屏); CJK 桌面横排网格。
  function _stagePos(i, n, vertical, side, band, oneCol) {
    if (vertical) {
      // CSSOS_WAVE_731v 20260613 — Jing: 英文(非CJK)无论横竖屏, 中央爆的词【一律单列竖排、
      // 一个单词一行】, 随机靠左/右。oneCol=true 时强制单列(不再长句分两列)。
      var cols = oneCol ? 1 : Math.max(1, Math.min(2, Math.round(n / 9)));
      var perCol = Math.ceil(n / cols);
      var col = Math.floor(i / perCol), within = i % perCol;
      var ySpan = 76, y0 = 50 - ySpan / 2;
      var yStep = perCol > 1 ? ySpan / (perCol - 1) : 0;
      // CSSOS_WAVE_727 — 竖排【靠左 or 靠右】(每句固定一侧, 不在中间)。
      var base = (side === "right") ? 71 : 29;
      var xCenter = cols > 1 ? (base + col * 13 - 6.5) : base;
      var x = xCenter + (Math.random() * 6 - 3);
      var y = y0 + within * yStep + (Math.random() * 4 - 2);
      return { x: Math.max(6, Math.min(94, x)), y: Math.max(7, Math.min(93, y)) };
    }
    // 横排: 像横向流动的一整句, 短句单行, 长句折 2-3 行, 允许部分重叠("看得出是一整句")。
    // CSSOS_WAVE_726 — Jing: 桌面横排字间距太疏 → 改【固定紧凑步距 ~9.5%/字, 整句居中】, 字更抱团;
    // 长句才撑宽(封顶 88%), 抖动收小到 ±3, 不再各自飘远。
    var rows = Math.max(1, Math.min(3, Math.round(n / 7)));
    var perRow = Math.ceil(n / rows);
    var row = Math.floor(i / perRow), col2 = i % perRow;
    var STEP = 7.0;                                             // W729 — 更紧(背景大 emoji 允许部分重叠)
    var xSpan = Math.min(86, Math.max(0, (perRow - 1) * STEP));
    var ySpan2 = Math.min(44, Math.max(0, (rows - 1) * 15));
    // CSSOS_WAVE_736B 20260613 — Jing「取消中央位置, 它遮挡人物/主景」: 横排只在【上/下边框】,
    // 不再有中间档。上推到 22%、下压到 78%, 让出中央主景。(band 已只发 0/2, 这里 1 兜底也归上。)
    var bandY = band === 2 ? 78 : 22;
    var x0 = 50 - xSpan / 2, y02 = bandY - ySpan2 / 2;
    var colStep = perRow > 1 ? xSpan / (perRow - 1) : 0;
    var rowStep = rows > 1 ? ySpan2 / (rows - 1) : 0;
    var x2 = x0 + col2 * colStep + (Math.random() * 6 - 3);
    var y2 = y02 + row * rowStep + (Math.random() * 6 - 3);
    return { x: Math.max(4, Math.min(96, x2)), y: Math.max(10, Math.min(88, y2)) };
  }
  function _fadeLine(stage) {
    if (!stage || !stage.els || !stage.els.length) return;
    var els = stage.els.slice();
    els.forEach(function (el) { try { el.classList.add("is-line-fade"); } catch (e) {} });
    setTimeout(function () { els.forEach(function (el) { try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e) {} }); }, 1600);
  }
  globalThis.cssosFadeBurstLine = function () {
    if (_lineStage.key !== null) { _fadeLine(_lineStage); _lineStage = { key: null, els: [], spawned: null }; }
  };
  // ── 以某点为中心的【小烟花】: 小 emoji 从该点向四周炸开, 不透明→透明消失(替代从天而降)。───
  var _sparkLayer = null;
  function ensureSparkLayer() {
    if (!_sparkLayer) _sparkLayer = document.getElementById("cssfx-spark");
    if (!_sparkLayer) {
      _sparkLayer = document.createElement("div");
      _sparkLayer.id = "cssfx-spark";
      _sparkLayer.setAttribute("aria-hidden", "true");
    }
    homeLayer(_sparkLayer);
    return _sparkLayer;
  }
  function _fireworkAt(xPct, yPct, emotion, count) {
    try {
      if (globalThis.cssosEmotionSubtitlesOff === true) return;   // W726 — 字心烟花只受主开关管(不再被"天女散花"开关误关)
      var layer = ensureSparkLayer();
      var pool = _themePool(EMO_PETALS[String(emotion || "").toLowerCase()] || PETALS);
      var nn = Math.max(3, Math.min(16, count || 6));
      var frag = document.createDocumentFragment();
      for (var k = 0; k < nn; k++) {
        var p = document.createElement("span");
        p.className = "cssfx-spark-dot";
        p.textContent = pool[(Math.random() * pool.length) | 0];
        var ang = Math.random() * Math.PI * 2;
        var dist = 7 + Math.random() * 22;        // vmin
        p.style.cssText =
          "left:" + xPct.toFixed(1) + "%;top:" + yPct.toFixed(1) + "%;" +
          "font-size:" + (0.6 + Math.random() * 0.9).toFixed(2) + "em;" +
          "--sk-dx:" + (Math.cos(ang) * dist).toFixed(1) + "vmin;" +
          "--sk-dy:" + (Math.sin(ang) * dist).toFixed(1) + "vmin;" +
          "--sk-dur:" + (1.7 + Math.random() * 1.3).toFixed(2) + "s;";   // W726 — 慢一点淡出(延时, 别太快消失)
        frag.appendChild(p);
      }
      layer.appendChild(frag);
      setTimeout(function () {
        try { var kids = layer.querySelectorAll(".cssfx-spark-dot"); for (var z = 0; z < Math.min(kids.length, nn); z++) if (kids[z]) layer.removeChild(kids[z]); } catch (_e) {}
      }, 3400);
    } catch (e) {}
  }
  globalThis.cssosFireworkAt = _fireworkAt;
  globalThis.cssosLineBurstWord = function (lineKey, i, n, text, emotion, intensity) {
    try {
      if (globalThis.cssosEmotionSubtitlesOff === true) return;   // W725 — 情绪字幕主开关
      if (globalThis.cssosEmotionCenter === false) return;
      var t = String(text || "").trim();
      if (!t) return;
      if (_lineStage.key !== lineKey) {        // 新句: 上一句一起淡出, 起新句; 【按本句首字 + 屏幕方向定方位】
        _fadeLine(_lineStage);
        // CSSOS_WAVE_736 20260613 — Jing 排版规则(整句一致, 非逐字):
        //  · 竖屏 / App端: 所有语言【必须竖排左/右】, 绝不横排(否则撑破屏幕);
        //  · 桌面/横屏 + 拉丁(长单词): 只能竖排左/右(无论横竖屏);
        //  · 桌面/横屏 + CJK/方块字: 5 种 —— 横排(上/中/下) + 竖排(左/右), 随机。
        var _isCJK0 = /[぀-ヿ㐀-鿿가-힯]/.test(t);
        var _isApp = false, _portrait = false;
        try { _isApp = document.documentElement.classList.contains("cssos-app"); } catch (_e) {}
        try { _portrait = (window.innerHeight || 0) >= (window.innerWidth || 1); } catch (_e) {}
        var _mustVert = _isApp || _portrait || !_isCJK0;   // 竖屏/App/拉丁 → 必竖排
        var _vert = _mustVert ? true : (Math.random() < 0.4); // CJK横屏: 40%竖 / 60%横(共5种)
        _lineStage = {
          key: lineKey, els: [], spawned: {},
          vertical: _vert,
          side: (Math.random() < 0.5 ? "left" : "right"),  // 竖排用: 左/右(边框)
          band: (Math.random() < 0.5 ? 0 : 2),             // 横排用: 上/下(边框, W736B 去掉中间, 不遮主景)
        };
      }
      if (_lineStage.spawned[i]) return;       // 每句每字只爆一次
      _lineStage.spawned[i] = 1;
      var layer = ensureCenterLayer();
      var rgb = EMO_RGB[String(emotion || "").toLowerCase()] || "255,224,140";
      var inten = Math.max(0, Math.min(1, Number(intensity) || 0.5));
      // CSSOS_WAVE_729 ③ — 字号按情绪(每字不同, 默认开); 关 = 统一字号。
      // W765 — Jing「文本/emoji 字体更小一些, 不要那么显眼」: 缩小爆字尺寸(1.8+2.6→1.2+1.7; 固定 3.0→2.2)。
      var sz = (globalThis.cssosSubSizeByEmotion === false) ? "2.20" : (1.2 + inten * 1.7).toFixed(2);
      // W736 — 方位由本句首字一次定好(_lineStage.vertical), 整句一致, 不再逐字重判。
      var isCJK = /[぀-ヿ㐀-鿿가-힯]/.test(t);
      var vertical = _lineStage.vertical;
      // W731v — 非 CJK(拉丁)竖排强制单列(一词一行); CJK 竖排可双列。
      var pos = _stagePos(i, Math.max(1, n), vertical, _lineStage.side, _lineStage.band, !isCJK);
      var grp = document.createElement("div");
      // CSSOS_WAVE_729 ② — 爆大→延迟→收回(默认开); 关 = 直接到本身大小(加 is-nopunch)。
      grp.className = "cssfx-center-grp is-line" + (globalThis.cssosBurstScalePunch === false ? " is-nopunch" : "");
      grp.style.cssText = "--cb-rgb:" + rgb + ";left:" + pos.x.toFixed(1) + "%;top:" + pos.y.toFixed(1) + "%;";
      // CSSOS_WAVE_731r/s 20260612 — Jing 定义: 中央爆大字 = 【每字随机色】(不是每句)。每个字滚
      // 一个新随机色, 字用它上色 + 该字的【背景 emoji 用同色发光晕】(emoji 多色字形 color 改不动,
      // 但同色 halo 让字和它的专属背景 emoji 呼应)。参数化: globalThis.cssosBurstCharColor(默认开,
      // 面板「爆字随机色·每字」可关; 关了字保持白、emoji 无彩晕)。
      var _charColor = (globalThis.cssosBurstCharColor !== false)
        ? "hsl(" + ((Math.random() * 360) | 0) + ",92%,72%)"
        : null;
      // CSSOS_WAVE_721 #2 — 每字【大背景 emoji】: 比字大、半透明、随字驻留(不消失), 衬在字后。
      var bpool = _themePool(EMO_PETALS[String(emotion || "").toLowerCase()] || PETALS);
      var bemo = bpool[(Math.random() * bpool.length) | 0];
      if (bemo) {
        var bg = document.createElement("div");
        bg.className = "cssfx-center-emoji";
        bg.textContent = bemo;
        bg.style.cssText = "font-size:" + (parseFloat(sz) * 1.8).toFixed(2) + "rem;"
          + (_charColor ? "text-shadow:0 0 18px " + _charColor + ",0 0 38px " + _charColor + ";" : "");
        grp.appendChild(bg);
      }
      var el = document.createElement("div");
      el.className = "cssfx-center-word";
      el.textContent = t;
      // CSSOS_WAVE_745 — Jing「爆字幕/情绪字幕逐字随机切换字体」: 每字从脚本感知的字体池随机取
      // 一个字体(CJK→中日韩字体, 拉丁→那 92 个 Google fancy)。globalThis.cssosBurstRandomFont
      // 默认开, 面板「爆字随机字体·每字」可关(关 = 统一默认字体)。
      // CSSOS_WAVE_747 — 情绪字幕跟随字体切换总开关 cssosEmotionFontFollow(默认开, 字体设置菜单可关)
      // ∧ 逐字随机字体开关 cssosBurstRandomFont(默认开)。任一关 → 爆字用统一默认字体(冻结)。
      var _burstFont = (globalThis.cssosBurstRandomFont !== false &&
                        globalThis.cssosEmotionFontFollow !== false &&
                        typeof globalThis.cssosPickFontForChar === "function")
        ? (function () { try { return globalThis.cssosPickFontForChar(t) || ""; } catch (_e) { return ""; } })()
        : "";
      el.style.cssText = "font-size:" + sz + "rem;--cb-glow:" + (0.4 + inten * 0.6).toFixed(2) + ";"
        + (_burstFont ? "font-family:" + _burstFont + ";" : "");
      if (_charColor) el.style.color = _charColor;
      grp.appendChild(el);
      layer.appendChild(grp);
      _lineStage.els.push(grp);
      // CSSOS_WAVE_721 #3 — 以【该字为中心】炸开小烟花(小 emoji 向四周扩散, 不透明→透明),
      // 取代"从天而降"。数量 ∝ 情绪强度。
      _fireworkAt(pos.x, pos.y, emotion, 5 + Math.round(inten * 7));
    } catch (e) {}
  };

  // ── 器乐段 emoji 脉冲(前奏/间奏/尾声: 有音乐没歌词, 也别浪费高音)──────────────────
  // CSSOS_WAVE_716 — Jing: "前奏那段虽然没歌词, 但有音乐呀, 不是应该爆一些 emoji 吗?"
  //   [Music...] 段播放时, 让 emoji 跟着节奏闪/飘(天女散花 + 偶尔中央爆一个音乐 emoji), 半透明
  //   不遮画面。节流 ~1.4s, 随机大小/停留/emoji → 有"跳动/呼吸"感而不喧宾夺主。
  var _lastMusicPulse = 0;
  var MUSIC_EMOJI = ["🎵", "🎶", "✨", "🌟", "💫", "🎼", "🎷", "🎻", "🪕", "🥁", "🌸", "💖"];
  // CSSOS_WAVE_721 #6 — 器乐段(前奏/间奏/尾声): emoji 从【四边框向内飘进】(取代从天而降),
  // 密度【响应音量】(globalThis.cssosCurrentVolume 0..1: 大→多, 小→少)。无音量数据时用中等随机。
  globalThis.cssosMusicGapPulse = function (emotion) {
    try {
      if (globalThis.cssosEmotionSubtitlesOff === true) return;   // W725 — 情绪字幕主开关
      if (globalThis.cssosMusicGapEmoji === false) return;        // 仅吃自己的开关(不再被"天女散花"开关误关)
      var now = (globalThis.performance && performance.now) ? performance.now() : 0;
      if (now && _lastMusicPulse && now - _lastMusicPulse < 700) return; // 节流
      _lastMusicPulse = now;
      var vol = Number(globalThis.cssosCurrentVolume);
      if (!(vol >= 0 && vol <= 1)) vol = 0.4 + Math.random() * 0.4; // 没音量数据 → 中等随机
      var nn = 1 + Math.round(vol * 6);                              // 音量大 → 飘得多
      var layer = ensureSparkLayer();
      var pool = _themePool(EMO_PETALS[String(emotion || "").toLowerCase()] || MUSIC_EMOJI);
      var frag = document.createDocumentFragment();
      for (var k = 0; k < nn; k++) {
        var edge = (Math.random() * 4) | 0;   // 0上 1右 2下 3左
        var sx, sy, dx, dy;
        var along = 8 + Math.random() * 84;    // 沿边位置 %
        var into = 14 + Math.random() * 26;    // 向内飘进距离 vmin
        if (edge === 0) { sx = along; sy = 2;  dx = 0; dy = into; }
        else if (edge === 1) { sx = 98; sy = along; dx = -into; dy = 0; }
        else if (edge === 2) { sx = along; sy = 98; dx = 0; dy = -into; }
        else { sx = 2; sy = along; dx = into; dy = 0; }
        var p = document.createElement("span");
        p.className = "cssfx-edge-dot";
        p.textContent = pool[(Math.random() * pool.length) | 0];
        p.style.cssText =
          "left:" + sx.toFixed(1) + "%;top:" + sy.toFixed(1) + "%;" +
          "font-size:" + (0.8 + Math.random() * 1.1).toFixed(2) + "em;" +
          "--ed-dx:" + dx.toFixed(1) + "vmin;--ed-dy:" + dy.toFixed(1) + "vmin;" +
          "--ed-dur:" + (2.0 + Math.random() * 1.6).toFixed(2) + "s;";
        frag.appendChild(p);
      }
      layer.appendChild(frag);
      setTimeout(function () {
        try { var kids = layer.querySelectorAll(".cssfx-edge-dot"); for (var z = 0; z < Math.min(kids.length, nn); z++) if (kids[z]) layer.removeChild(kids[z]); } catch (_e) {}
      }, 3800);
    } catch (e) {}
  };

  // ── 普通字幕级: 每次播放【未唱色/已唱色】各随机一种 ───────────────────────────
  // CSSOS_WAVE_702 — Jing: 普通字幕脱离情绪上色, 改成卡拉OK双色擦除; 每次【从头播放】随机换一对色
  //   (未唱=柔和, 已唱=鲜亮), 续播/暂停恢复不换。色相相距≥90°保证对比, 亮度/饱和保证暗底上可读。
  var _lastRoll = 0;
  function rollSubtitleColors() {
    try {
      // 防抖: 起播瞬间 media 可能连发多次 play(缓冲/试播)→ 别每次都换色(否则刚播就闪色)。
      var now = (globalThis.performance && performance.now) ? performance.now() : 0;
      if (now && _lastRoll && now - _lastRoll < 2500) return;
      _lastRoll = now;
      var h1 = Math.floor(Math.random() * 360);
      var h2 = (h1 + 100 + Math.floor(Math.random() * 160)) % 360;   // 距 h1 100~260°
      // 未唱: 较低饱和 + 半透明(安静); 已唱: 高饱和高亮(点亮)。
      var unsung = "hsla(" + h1 + ",62%,74%,0.60)";
      var sung   = "hsla(" + h2 + ",92%,66%,0.96)";
      var r = document.documentElement.style;
      r.setProperty("--sub-unsung", unsung);
      r.setProperty("--sub-sung", sung);
      // 已唱色的 RGB 三元(给 active 字光晕用, 跟随本次随机色)。
      r.setProperty("--sub-sung-h", String(h2));
    } catch (e) {}
  }
  globalThis.cssosRollSubtitleColors = rollSubtitleColors;
  rollSubtitleColors(); // 初值, 保证总有一对色
  // 从头播放(currentTime<0.6)→ 换一对随机色。play 不冒泡, 用捕获。
  try {
    document.addEventListener("play", function (ev) {
      var el = ev && ev.target;
      if (!el || (el.tagName !== "VIDEO" && el.tagName !== "AUDIO")) return;
      try { if (Number(el.currentTime || 0) < 0.6) rollSubtitleColors(); } catch (_e) {}
    }, true);
  } catch (e) {}

  globalThis.cssosEmotionBurstThreshold = function () { return Number(FX.burstThreshold) || 0.8; };
  // 用户偏好(本人)
  globalThis.cssosSetEmotionFX = function (partial) {
    Object.assign(userPref, partial || {});
    try { localStorage.setItem(K_USER, JSON.stringify(userPref)); } catch (e) {}
    recompute(); return FX;
  };
  globalThis.cssosResetEmotionFX = function () {   // 清掉本人覆盖 → 回到平台默认
    userPref = {}; try { localStorage.removeItem(K_USER); } catch (e) {}
    recompute(); return FX;
  };
  // 平台默认(管理员)
  globalThis.cssosSetEmotionPlatformDefaults = function (obj) {
    platform = Object.assign({}, obj || {});
    try { localStorage.setItem(K_PLATFORM, JSON.stringify(platform)); } catch (e) {}
    recompute(); return platform;
  };
  globalThis.cssosEmotionFXLayers = function () {
    return { DEFAULTS: DEFAULTS, platform: platform, user: userPref, effective: FX };
  };
  globalThis.cssosEmotionFXDefaultsHardcoded = function () { return Object.assign({}, DEFAULTS); };

  recompute();

  // 启动: 拉后端平台默认(公开 GET), 同步本地 platform 层。用户偏好优先, 不被覆盖。
  try {
    fetch("/api/emotion-fx-defaults", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.ok && j.defaults && typeof j.defaults === "object") {
          platform = Object.assign({}, j.defaults);
          try { localStorage.setItem(K_PLATFORM, JSON.stringify(platform)); } catch (e) {}
          recompute();
        }
      }).catch(function () {});
  } catch (e) {}
})();
