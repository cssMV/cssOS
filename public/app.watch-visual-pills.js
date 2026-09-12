/* CSSOS_WAVE_1880 20260823 — 多画面胶囊 (Jing)
 *
 * Jing:「请给多语言胶囊/多声线胶囊加上多画面胶囊。」
 *      「胶囊轨道里必须标记画面的类型: 幻灯 / 混合视频 / 真视频三种。
 *        如果是幻灯, 还必须标记是多少张封面图做的幻灯(默认 3, 用户可自定义 1-8)。
 *        如果是真视频, 是否还可以标记视频的清晰度? 720P/1080P/4K/8K」
 *      「像多语言/多声线一样, 默认使用最新生成的, 但是只要用户手动选择过的, 下次就用用户选择过的。」
 *
 * ── 为什么这个胶囊是必需的, 而不是装饰 ─────────────────────────────────────
 * 平台的画面从来不是一个成品文件(见 CLAUDE.md /「永不烧录·四轨分离」): 画面层可以是
 * 封面幻灯、混合、或真视频, 由播放端实时选。既然它本来就是可切换的, 用户就该看得见、
 * 换得动 —— 而不是画面一失败就只剩一句 "Preview unavailable"。
 *
 * ── 清晰度为什么在前端读, 不查库 ────────────────────────────────────────────
 * user_works.frame_width/frame_height 在 146 首已发布作品里【全是 NULL】(实测), 拿不到。
 * 而 <video>.videoWidth/videoHeight 是解码器给的真值, 免费、即时、永不过期。所以清晰度
 * 一律运行时读; 读不到就【不标】—— 宁可不标, 绝不标错。
 *
 * ── 三种形态怎么判定(全部基于当前作品真实拥有的东西, 不猜) ──────────────────
 *   真视频   video URL 存在                     → 🎬 + 清晰度(读到才标)
 *   混合视频 video URL 存在 且 幻灯帧 ≥ 1        → 🎞
 *   幻灯     幻灯帧 ≥ 1                          → 🖼 + N 张
 * N = min(可用帧数, cssos_mvp_param_cover_count[0..8]) —— 与创作侧同一个 key, 但 W2087 起
 * 【两端语义不同】: 创作端 0 = 不生成专辑封面(交给定妆照), 播放端 0 = 不限张数。
 * 用户调过几张(≥1), 这里仍然就标几张。
 *
 * ── 默认 / 记忆 ────────────────────────────────────────────────────────────
 * 没选过 → 用"最新生成的"= 该作品能给出的最高形态(真视频 > 混合 > 幻灯);
 * 选过一次 → 存 localStorage, 之后每首都优先用用户选过的那种, 该作品没有这种才回落。
 * 这与「导演自动流默认法」同一条: 不选不填→系统推荐; 用户干预→系统让位。
 */
(function () {
  "use strict";
  if (globalThis.__cssosVisualPillsInstalled) return;
  globalThis.__cssosVisualPillsInstalled = true;

  var PREF_KEY = "cssos.visual.mode";        // "video" | "hybrid" | "slides"
  var COVER_N_KEY = "cssos_mvp_param_cover_count";

  function zhUI() {
    try { return String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0; }
    catch (_e) { return false; }
  }
  function T(en, zh) { return zhUI() ? zh : en; }

  function pref() { try { return localStorage.getItem(PREF_KEY) || ""; } catch (_e) { return ""; } }
  function setPref(v) { try { localStorage.setItem(PREF_KEY, v); } catch (_e) {} }

  /* CSSOS_WAVE_2087 20260912 — 这个 key 现在在两端【语义不同】, 必须分开读。
   *
   * 创作端: "生成几张专辑封面图", 默认改成 0 —— 封面交给定妆照(mv_plate)。
   * 播放端(这里): "幻灯最多标/放几张", 0 张是没有意义的(会变成「🖼 0 张」、slice 出空数组)。
   *
   * 所以这里把 0 读作【不限张数】→ 放开到上限 8, 有几帧就用几帧。
   * (原写法 `Math.max(1, n || 3)` 靠 `0 || 3` 把 0 悄悄变成 3 才没炸 —— 那是巧合不是设计,
   *  而且 3 是个凭空的上限。写成明确语义, 别再靠 falsy 兜底。) */
  function coverCount() {
    try {
      var raw = localStorage.getItem(COVER_N_KEY);
      var n = parseInt(raw == null ? "" : raw, 10);
      if (!isFinite(n) || n <= 0) return 8;        // 0 / 未设置 = 不限
      return Math.min(8, n);
    } catch (_e) { return 8; }
  }

  /* CSSOS_WAVE_1882 20260823 — 修 W1880 的致命假设。
   *
   * Jing:「为什么新加的多画面胶囊, 每次都不按照胶囊宪法套上胶囊风格? 为什么总是先做一个假的占位?」
   *
   * 真相是更难看的那种: 不是"假占位", 是【一颗都没画出来】。W1880 假设
   * globalThis.cssosCurrentWork() 能拿到当前作品 —— 该函数确实存在, 但播放中调用
   * 【返回 null】(2026-08-23 浏览器实测)。forms() 于是恒返回 [], 容器上留下
   * data-n-visual=0, 屏幕上空无一物。容器本来就有 data-pill-bar, 只要真画出来
   * 宪法样式自动就套上了 —— "没套上胶囊风格"只是"没渲染"的表象。
   *
   * 根本过错不在这段代码, 在流程: 我写完就部署, 一次都没在浏览器里看它有没有出现。
   *
   * 改法: 不再依赖那个会返回 null 的函数。作品 id 从平台真正可靠的来源拿
   * (__cssosCurrentWorkId / cssosCurrentWorkId()), 作品数据按 id 拉一次并缓存;
   * 拉之前先用 DOM 里的既有事实(video/幻灯层)兜底, 保证胶囊【任何时候都有得画】。 */
  var _wCache = Object.create(null);
  var _wPending = Object.create(null);

  function curWorkId() {
    try {
      if (typeof globalThis.cssosCurrentWorkId === "function") {
        var a = globalThis.cssosCurrentWorkId();
        if (a && String(a).trim()) return String(a).trim();
      }
    } catch (_e) {}
    try {
      var b = globalThis.__cssosCurrentWorkId;
      if (b && String(b).trim()) return String(b).trim();
    } catch (_e) {}
    try {
      var el = document.getElementById("watch-work-id");
      var t = el && (el.textContent || "").trim();
      if (t && /^[0-9a-f-]{16,}$/i.test(t)) return t;
    } catch (_e) {}
    return "";
  }

  /* DOM 兜底: 就算一次网络都没回来, 画面形态也能从屏幕上的既有事实读出来。 */
  function domWork() {
    var v = document.getElementById("watch-video");
    var vu = "";
    try { vu = String((v && (v.currentSrc || v.getAttribute("src"))) || "").trim(); } catch (_e) {}
    var frames = 0;
    try {
      if (typeof globalThis.cssmvCoverSlidesCount === "function") frames = Number(globalThis.cssmvCoverSlidesCount()) || 0;
    } catch (_e) {}
    var cover = "";
    try {
      var a = document.getElementById("watch-music-art");
      cover = String((a && a.getAttribute("src")) || "").trim();
    } catch (_e) {}
    /* 没有后端 visual_kind 时一律按【幻灯】—— 宁可少标, 绝不错标(W1880 原则不变)。 */
    return { preview_video_url: vu, cover_image: cover, visual_frames: frames, visual_kind: "" };
  }

  function curWork() {
    var id = curWorkId();
    if (!id) return domWork();
    var hit = _wCache[id];
    if (hit) return hit;
    if (!_wPending[id]) {
      _wPending[id] = 1;
      try {
        fetch("/api/works/public/" + encodeURIComponent(id), { credentials: "omit" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            var d = j && (j.data || j); var w = d && (d.work || d);
            if (w && typeof w === "object") {
              _wCache[id] = w;
              try { var bar = document.getElementById("watch-language-pill"); if (bar) bar.dataset.visualSig = ""; } catch (_e) {}
              try { sync(); } catch (_e) {}
            }
          })
          .catch(function () {})
          .then(function () { delete _wPending[id]; });
      } catch (_e) { delete _wPending[id]; }
    }
    return domWork();   // 网络回来之前先用 DOM 事实, 绝不返回 null
  }

  function videoUrl(w) {
    try { return String((w && (w.final_mv_url || w.preview_video_url)) || "").trim(); } catch (_e) { return ""; }
  }
  function slideList(w) {
    try {
      var a = (w && Array.isArray(w.cover_slides)) ? w.cover_slides : [];
      a = a.filter(function (u) { return typeof u === "string" && u.trim(); });
      if (!a.length) {
        var c = w && (w.cover_image || w.cover_url || w.preview_image_url);
        if (c && String(c).trim()) a = [String(c).trim()];
      }
      return a;
    } catch (_e) { return []; }
  }

  /* 清晰度: 只信解码器。读不到 → 返回 "" → 不标。 */
  function resLabel() {
    try {
      var v = document.getElementById("watch-video");
      if (!v || !v.videoWidth || !v.videoHeight) return "";
      var h = Math.min(v.videoWidth, v.videoHeight);   // 竖屏作品按短边算, 才不会把 1080x1920 误标成 4K
      if (h >= 4320) return "8K";
      if (h >= 2160) return "4K";
      if (h >= 1440) return "1440P";
      if (h >= 1080) return "1080P";
      if (h >= 720) return "720P";
      if (h >= 480) return "480P";
      return h + "P";
    } catch (_e) { return ""; }
  }

  /* 当前作品真实可用的画面形态。
   *
   * ⚠ 判据必须来自后端 visual_kind, 【绝不】用"有没有 mp4"来猜 —— 实测(2026-08-23):
   * 已发布作品里 engines.video_cents > 0 的数量 = 0, 也就是说平台今天那 99 个 mp4
   * 全是我们自己用封面拼出来的幻灯片视频, 一个真视频都没有。按"有 mp4 = 真视频"来标,
   * 屏幕上就是在撒谎。后端没给 visual_kind 时一律按【幻灯】处理 —— 宁可少标, 绝不错标。
   * 等用户以后真的加了视频, 后端把 kind 升成 video/hybrid, 这里自然长出三颗。 */
  function forms() {
    var w = curWork();
    if (!w) return [];
    var vu = videoUrl(w), slides = slideList(w);
    var kind = String((w.visual_kind || "")).toLowerCase();
    var nFrames = Number(w.visual_frames || 0) || 0;
    var n = nFrames || slides.length || 1;
    n = Math.min(Math.max(n, 1), Math.max(coverCount(), nFrames || 1));
    var out = [];
    if (kind === "video") {
      out.push({ key: "video", glyph: "🎬", label: T("Real video", "真视频"), spec: resLabel() });
    } else if (kind === "hybrid") {
      out.push({ key: "hybrid", glyph: "🎞", label: T("Hybrid video", "混合视频"), spec: resLabel() });
      out.push({ key: "slides", glyph: "🖼", label: T("Slideshow", "幻灯"), spec: T(n + " img", n + "\u5f20"), n: n });
    } else {
      /* 今天所有作品都落在这里。画面就是那条拼出来的幻灯(可能已渲染成 mp4, 也可能是实时幻灯层)。 */
      out.push({ key: "slides", glyph: "\ud83d\uddbc", label: T("Slideshow", "\u5e7b\u706f"), spec: T(n + " img", n + "\u5f20"), n: n, rendered: !!vu });
    }
    return out;
  }

  /* 选中哪一种: 用户选过的优先, 否则最高形态(= 最新生成的那一层)。 */
  function chosen(list) {
    var p = pref();
    for (var i = 0; i < list.length; i++) if (list[i].key === p) return p;
    return list.length ? list[0].key : "";
  }

  /* 真正切换画面层。幻灯/混合都要把帧喂给幻灯模块; 真视频要把幻灯撤下来。 */
  function applyForm(key) {
    var w = curWork();
    var ws = document.querySelector("#watch-panel .watch-screen") || document.querySelector(".watch-screen");
    var slides = slideList(w);
    try {
      if (key === "slides") {
        /* ⚠ 幻灯若【已渲染成 mp4】(今天绝大多数作品), 那条 mp4 本身就是幻灯 ——
         * 此时挂 audio-fallback 会把 video 压到 opacity:0.1, 等于把幻灯本体关掉,
         * 屏幕反而变空。只有没有渲染视频、需要实时放封面时才挂。 */
        var renderedSlideshow = !!videoUrl(w);
        if (ws) {
          if (renderedSlideshow) ws.classList.remove("watch-screen-audio-fallback");
          else ws.classList.add("watch-screen-audio-fallback");
        }
        if (typeof globalThis.cssmvSetCoverSlides === "function") {
          globalThis.cssmvSetCoverSlides(slides.slice(0, Math.min(slides.length, coverCount())));
        }
      } else if (key === "hybrid") {
        /* 混合: 视频照放, 幻灯层留着垫底 —— 视频有空档/放不出时画面不会塌成黑屏。 */
        if (ws) ws.classList.remove("watch-screen-audio-fallback");
        if (typeof globalThis.cssmvSetCoverSlides === "function") {
          globalThis.cssmvSetCoverSlides(slides.slice(0, Math.min(slides.length, coverCount())));
        }
      } else {
        /* 真视频: 撤掉幻灯回落层, 画面完全交给视频。 */
        if (ws) ws.classList.remove("watch-screen-audio-fallback");
      }
    } catch (_e) {}
  }

  /* 把画面 cell 同步进多语言/多声线那条同一轨道(复用 .cssos-cell → 自动继承胶囊宪法凸嵌凹)。 */
  function sync() {
    var bar = document.getElementById("watch-language-pill");
    if (!bar) return;
    var list = forms();
    var sel = chosen(list);

    // 签名: 形态集合 + 选中项 + 规格文字。没变就不动 DOM(避免 MutationObserver 自激)。
    var sig = list.map(function (f) { return f.key + ":" + (f.spec || ""); }).join(",") + "|" + sel;
    if (bar.dataset.visualSig === sig) return;
    bar.dataset.visualSig = sig;

    // 清掉旧的画面 cell
    [].slice.call(bar.querySelectorAll(".cssos-cell-visual")).forEach(function (el) { el.remove(); });

    list.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cssos-cell cssos-cell-visual" + (f.key === sel ? " active" : "");
      b.dataset.visual = f.key;
      b.setAttribute("data-pill-key", "vis-" + f.key);
      var g = document.createElement("span"); g.className = "lang-flag"; g.textContent = f.glyph;
      var n = document.createElement("span"); n.className = "lang-name"; n.textContent = f.label;
      b.appendChild(g); b.appendChild(n);
      if (f.spec) { var sp = document.createElement("span"); sp.className = "cssos-vspec"; sp.textContent = "· " + f.spec; b.appendChild(sp); }
      b.title = f.label + (f.spec ? " · " + f.spec : "");
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        setPref(f.key);                 // ← 用户手动选过 → 从此以它为准
        bar.dataset.visualSig = "";     // 强制下一次 sync 重画选中态
        applyForm(f.key);
        sync();
        if (typeof globalThis.cssosLangPillRepaint === "function") globalThis.cssosLangPillRepaint();
      }, false);
      bar.appendChild(b);
    });

    bar.dataset.nVisual = String(list.length);
    if (sel) applyForm(sel);
    if (typeof globalThis.cssosLangPillRepaint === "function") globalThis.cssosLangPillRepaint();
  }

  globalThis.cssosSyncVisualPills = sync;

  /* 作品换了 / 视频元数据到了(清晰度这时才知道) → 重算。 */
  function wire() {
    var v = document.getElementById("watch-video");
    if (v && !v.__cssosVisPillWired) {
      v.__cssosVisPillWired = true;
      ["loadedmetadata", "resize"].forEach(function (ev) {
        try { v.addEventListener(ev, function () { try { document.getElementById("watch-language-pill").dataset.visualSig = ""; } catch (_e) {} sync(); }, { passive: true }); } catch (_e) {}
      });
    }
  }
  try { window.addEventListener("cssos:work-id-changed", function () {
    try { document.getElementById("watch-language-pill").dataset.visualSig = ""; } catch (_e) {}
    wire(); sync();
  }, { passive: true }); } catch (_e) {}

  function start() { wire(); sync(); setInterval(function () { try { wire(); sync(); } catch (_e) {} }, 2000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
