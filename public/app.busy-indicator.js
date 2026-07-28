/* CSSOS — 全平台「加载/播放卡顿」指示灯 · 统一控制层 (Jing 单独一波, 方案 A)
 *
 * 一个大脑, 两只手:
 *   · 大脑 = 本文件的单一 token 登记表 + 唯一销毁权威(三重保险 + 看门狗全收归此处);
 *   · 两只手(渲染面) =
 *       ① logo 魔镜随机色光芒(enterLyricSpellcast/exitLyricSpellcast, in app.js)
 *          —— 面向【加载/创作】卡顿, 用户眼睛在主界面中央 logo;
 *       ② 媒体小魔镜(app.media-buffering-mirror.js 的 overlay)
 *          —— 面向【播放】卡顿, 叠在正在播的画面上(watch 前台时 logo 被遮/暂停,
 *             播放卡顿必须就地可见, 所以不能塌成单一 logo)。
 *
 * 所有触发点都经过大脑, 不再各自直呼 enter/exit:
 *   · 魔法棒 / 生成运行 / 麦克风 → cssosBusyBeginNamed(name)/cssosBusyEndNamed(name)(logo 手);
 *   · 网络加载卡顿(fetch >900ms) → 内部 fetch 拦截(logo 手);
 *   · 媒体 waiting/stalled → buffering-mirror 走 cssosBusyBeginMedia/EndMedia(媒体手);
 *   · 任意其它加载点 → cssosBusyBegin(name)/cssosBusyEnd(token)(logo 手)。
 * logo 手的所有 token 【合流】成一个视觉(引用计数, 0↔1 才碰 enter/exit, 全程非 force
 * → depth 永远平衡, 消除了旧的 force-exit 与计数错拍)。媒体手每元素一个 overlay。
 *
 * ★ Jing 铁律: 顺畅 / 加载完毕后【立即销毁占用的内存】。三重销毁保险, 对两只手一视同仁:
 *     ① token settle 立即 end() → 该 token 的手立即收起(logo 归零→exitLyricSpellcast 全拆
 *        清 220ms interval + class + 内联变量; 媒体→overlay 去 is-active, display:none 停动画);
 *     ② 单-token 45s 硬顶(卡死的请求/卡死的 spinner 都不许赖着);
 *     ③ 5s 周期清扫孤儿 + 页面转后台(visibilitychange hidden)全清。
 *   再加 enterLyricSpellcast 内的 90s 全局看门狗兜底 —— 绝不漏、绝不泄漏。
 */
(function () {
  "use strict";
  if (globalThis.__cssosBusyIndicatorInstalled) return;
  globalThis.__cssosBusyIndicatorInstalled = true;

  var win = globalThis;
  var active = new Map();     // token -> { since, onHide? }  (onHide 存在=媒体手; 无=logo 手)
  var pending = new Map();    // token -> debounce timeout id (fetch 判"慢"前的等待)
  var named = new Map();      // name  -> token (魔法棒/生成/麦克风 等具名流, 便于异地配对 end)
  var logoCount = 0;          // 当前活跃的 logo 手 token 数(合流计数)
  var seq = 0;
  var FETCH_SLOW_MS = 900;    // 只有慢过这个才算"卡顿"点灯
  var TOKEN_MAX_MS = 45000;   // 单 token 硬顶

  // CSSOS — Jing「进入平台、等 logo 魔镜首次显示时不要 spinner —— 给自己的 logo 加载 spinner
  //   会形成一大一小的尴尬场面」: 首屏 booting 期间【压制 logo 手】(魔镜本身就是正在加载/显示
  //   的东西, 别再在它身上叠一个小魔镜)。媒体手 / 麦克风 / 魔法棒都是 boot 后用户交互才发生,
  //   不受影响; 只挡首屏那批 fetch 卡顿。boot 完成(window load + 缓冲)后恢复正常。
  var booted = false;
  function markBooted() { booted = true; }
  if (document.readyState === "complete") setTimeout(markBooted, 900);
  else win.addEventListener("load", function () { setTimeout(markBooted, 900); });

  function nowMs() { try { return Date.now(); } catch (e) { return 0; } }

  // logo 手渲染原语(非 force → 只在合流计数真正归零时熄灭, 不误伤任何并发流)。
  function logoOn() { try { if (typeof enterLyricSpellcast === "function") enterLyricSpellcast(); } catch (e) {} }
  function logoOff() { try { if (typeof exitLyricSpellcast === "function") exitLyricSpellcast(); } catch (e) {} }

  // 统一入册。meta.onShow/onHide 存在 = 媒体手(每元素独立渲染, 不合流);
  // 否则 = logo 手(合流计数)。
  function begin(token, meta) {
    if (active.has(token)) return;
    meta = meta || {};
    meta.since = nowMs();
    active.set(token, meta);
    if (meta.onHide) { if (typeof meta.onShow === "function") { try { meta.onShow(); } catch (e) {} } }
    else { logoCount += 1; if (logoCount === 1 && booted) logoOn(); }  // booted 前压制 logo 手(首屏不叠 spinner)
  }
  function end(token) {
    var p = pending.get(token);
    if (p) { clearTimeout(p); pending.delete(token); }
    var meta = active.get(token);
    if (!meta) return;
    active.delete(token);
    if (meta.onHide) { try { meta.onHide(); } catch (e) {} }
    else { logoCount = Math.max(0, logoCount - 1); if (logoCount === 0) logoOff(); }
  }

  // 后台轮询 / 心跳 / 埋点 / 崩溃日志等非用户可感知的加载不点灯。
  var SKIP_RE = /(crash-log|\/analytics|\/beacon|\/heartbeat|\/ping\b|\/api\/health|\/api\/admin\/|favicon)/i;
  function urlOf(input) {
    try {
      if (typeof input === "string") return input;
      if (input && typeof input.url === "string") return input.url;
    } catch (e) {}
    return "";
  }

  // ---- 拦截 window.fetch: 慢请求点亮 logo 手, settle 立即熄灭 ----
  if (typeof win.fetch === "function" && !win.fetch.__cssosBusyWrapped) {
    var _origFetch = win.fetch.bind(win);
    var wrapped = function (input, init) {
      var url = urlOf(input);
      if (SKIP_RE.test(url)) return _origFetch(input, init);
      var token = "fetch#" + (++seq);
      pending.set(token, setTimeout(function () { pending.delete(token); begin(token); }, FETCH_SLOW_MS));
      var done = function () { end(token); };
      var pr;
      try { pr = _origFetch(input, init); } catch (e) { done(); throw e; }
      return pr.then(function (r) { done(); return r; }, function (err) { done(); throw err; });
    };
    wrapped.__cssosBusyWrapped = true;
    try { win.fetch = wrapped; } catch (e) {}
  }

  // ---- 销毁保险网(两只手一视同仁) ----
  setInterval(function () {           // ① 45s 单-token 硬顶
    if (active.size === 0) return;
    var now = nowMs();
    var expired = [];
    active.forEach(function (meta, token) { if (now - (meta && meta.since || now) > TOKEN_MAX_MS) expired.push(token); });
    expired.forEach(end);
  }, 5000);
  document.addEventListener("visibilitychange", function () {   // ② 后台全清
    if (document.hidden && active.size) {
      var tokens = []; active.forEach(function (_m, t) { tokens.push(t); });
      tokens.forEach(end);
    }
  });

  // ---- 公开 API ----
  // 通用 token 手动接入(logo 手):
  win.cssosBusyBegin = function (name) { var t = "manual:" + (name || "") + "#" + (++seq); begin(t); return t; };
  win.cssosBusyEnd = function (token) { if (token) end(token); };
  // 具名流(logo 手): enter/exit 在异地也能靠 name 配对, 幂等, 免穿 token 变量。
  win.cssosBusyBeginNamed = function (name) {
    var key = String(name || "anon");
    if (named.has(key)) return named.get(key);
    var t = "named:" + key;
    named.set(key, t);
    begin(t);
    return t;
  };
  win.cssosBusyEndNamed = function (name) {
    var key = String(name || "anon");
    var t = named.get(key);
    if (!t) return;
    named.delete(key);
    end(t);
  };
  // 媒体手: 每元素一个 overlay, 由 buffering-mirror 提供 onShow/onHide 渲染钩子。
  win.cssosBusyBeginMedia = function (key, onShow, onHide) {
    begin("media:" + String(key), { onShow: onShow, onHide: onHide });
  };
  win.cssosBusyEndMedia = function (key) { end("media:" + String(key)); };
  win.cssosBusyEndAllMedia = function () {
    var tokens = [];
    active.forEach(function (meta, t) { if (meta && meta.onHide) tokens.push(t); });
    tokens.forEach(end);
  };
  win.cssosBusyActiveCount = function () { return active.size; };
})();
