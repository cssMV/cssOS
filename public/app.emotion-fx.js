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
    if (!FX.fullscreen || !FX.flash) return;
    try {
      var el = ensureFlash();
      var rgb = EMO_RGB[String(emotion || "").toLowerCase()] || "255,224,140";
      var peak = Math.max(0, Math.min(1, Number(intensity) || 0.8)) * Number(FX.flash);
      el.style.setProperty("--cssfx-flash-rgb", rgb);
      el.style.setProperty("--cssfx-flash-peak", peak.toFixed(3));
      el.style.setProperty("--cssfx-flash-dur", (FX.burstDurMs || 520) + "ms");
      el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash");
      // CSSOS_WAVE_689 — 天女散花: 峰值字爆全屏时, 从顶部撒一阵花瓣/彩纸(像庆祝)。compositor-safe
      // (只动 transform/opacity), 自动清理。可关: cssosEmotionConfetti=false。
      spawnConfetti(emotion, peak);
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
  var _lastConfetti = 0;
  function spawnConfetti(emotion, peak) {
    if (globalThis.cssosEmotionConfetti === false) return;
    var now = (globalThis.performance && performance.now) ? performance.now() : 0;
    if (now && now - _lastConfetti < 420) return; // 节流: 别每字都撒, 保持"庆祝"的稀有感
    _lastConfetti = now;
    var layer = ensureConfettiLayer();
    var pool = EMO_PETALS[String(emotion || "").toLowerCase()] || PETALS;
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
  globalThis.cssosEmotionCenterBurst = function (text, emotion, intensity, durSec, emoji) {
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
