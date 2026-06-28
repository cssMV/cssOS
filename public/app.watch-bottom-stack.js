/* CSSOS_WAVE_760 20260613 — Jing「每个信息在一个 div 就不会打架; 大家都用绝对定位肯定打架」。
 * 彻底改架构: 不再各自绝对定位 + JS 算 bottom(本质还是绝对, 永远抢位)。改成【唯一一个绝对定位的
 * 流式列容器 #cssos-watch-bottomflow】, 把底部所有信息(价格条 / CTA / 左下控制胶囊 / 多语言行)
 * 收编为它的【子元素】, 清掉它们各自的绝对定位 → 浏览器原生 flex 列排队:
 *   • 每行紧贴上一行(gap 固定);
 *   • 隐藏成员 display:none → 0 高度、不占位、无 gap;
 *   • 整列随 --cssos-dock-clear 一起上移(Dock 显示让位);
 *   • 永不重叠、永不打架。
 * 字幕(#watch-subtitle)居中、独立轨, 不进本列(保持自身居中定位), 仅确保它在列上方。
 *
 * 取代 W561 的绝对坐标计算器 + W744 的 calc(bottom) 栈器(均已弃用)。 */
(function () {
  "use strict";
  if (globalThis.__cssosBottomFlowWired) return;
  globalThis.__cssosBottomFlowWired = true;

  // 从下往上的成员(列容器是 column-reverse → 第一个 DOM 子 = 最底)。
  // CSSOS_WAVE_762 — Jing 拍板从下往上(每个一 div, 隐藏=0 高度):
  //   价格条 → 左下信息包 → 多语言/多声线 → CTA(播放结束前的作品卡片队列) → Want(创作引导卡)。
  // 注: CTA = #cssos-up-next-strip(队列卡片,「Tap to queue…」); Want = #cssos-create-cta(「Want an MV like this」)。
  var ORDER = [
    "#cssos-watch-priceline",                         // W845 — 传统字幕 + 价格条 + AI助理【同一行】(字幕左截断到 Tip)
    // CSSOS_WAVE_906 — Jing「多语言飘太高」根因之一: 旧 .watch-commerce-actions 仍在列里占一大块空高度,
    //   把它上面的多语言顶到屏幕中段。它是 W837 早该并入的遗留行 → 移出 ORDER, 不再进底部列(价格已在 priceline)。
    // "#watch-panel .watch-commerce-actions" — 已移除
    // W846 — 信息包(.cssmv-capsule)移出底部列, 改去左上头像之后(见 app.watch-control-capsule.js 定位)。
    // CSSOS_WAVE_862 — Jing「传统字幕/AI助理 和 多语言打架, 不是各自在自己的 div 吗?」根治:
    //   W854/857 曾把多语言移出本列、改回 absolute(bottom 60px)→ 又回到「大家都绝对定位 = 必打架」老路,
    //   且 60px 正好落进价格条(App 两行)的竖直跨度 → 与价格条/AI助理行重叠。回归 W760 本意:
    //   多语言重新【收编为本列子元素】, 排在价格条上方一行, 浏览器 flex 原生排队, 永不重叠。
    //   (lang-flag-pills.js 同步撤掉自身 absolute 钉死, 本列是唯一定位 owner。)
    // CSSOS_WAVE_1122 — Jing 指令: 传统字幕 + 多语言【同一行】(字幕左, 多语言居中)。多语言不再独立成行,
    //   改并进 priceline 的中列(见 ensurePriceLine)。故从 ORDER 移除 #cssos-lang-fold。
    "#cssos-up-next-strip",                           // CTA — 结束前作品卡片队列(全宽)
    "#cssos-create-cta"                               // Want — 创作引导卡(最上)
  ];
  // 铺满容器宽的成员(卡片条 + 价格行需全宽: 字幕 flex:1 占左, 价格条靠右)。
  var FULLWIDTH = { "cssos-up-next-strip": 1, "cssos-watch-priceline": 1 };

  function screenEl() { return document.querySelector("#watch-panel .watch-screen"); }
  // CSSOS_WAVE_927 20260617 — Jing「iPad Safari 语言条还跑中央」终极根因: bottomflow 原锚
  //   `.watch-screen`, 而它是 `aspect-ratio:16/9` 信箱盒 —— 原生 App 把它撑满全屏(底=屏底),
  //   但 iPad Safari 上它居中letterbox、底边在屏幕【中段】→ 锚在它底部的 bottomflow(语言条+
  //   价格行)就掉到中段。这正是"App 正常、Safari 中央"。改: bottomflow 锚到【全屏的 #watch-panel】
  //   (始终铺满视口), 底部 = 真正屏底, 与信箱媒体盒无关。W923 的 display 门控也跟着指向新容器。
  function hostEl() { return document.getElementById("watch-panel") || screenEl(); }

  function ensureFlow() {
    var screen = hostEl();
    if (!screen) return null;
    var f = document.getElementById("cssos-watch-bottomflow");
    if (!f) {
      f = document.createElement("div");
      f.id = "cssos-watch-bottomflow";
      f.dataset.noFrameToggle = "1";
      // 唯一的绝对定位锚点: 底部居中、坐在 Dock 上方(--cssos-dock-clear 让位), 随之上移。
      // CSSOS_WAVE_1259 — Jing「App 端底部栈不要压住右轨」。右轨(app.watch-social-rail.js)=
      //   right:14px + 46px 宽 ≈ 占右边 60px。App(窄屏)右侧让出 64px 给右轨, 整条左移避让
      //   (Jing 明确: 不一定居中, 不压右轨即可)。桌面宽屏维持 right:8px 不变。
      var _isApp = false;
      try { _isApp = document.documentElement.classList.contains("cssos-app") || (window.innerWidth || 9999) < 640; } catch (_e) {}
      f.style.cssText = [
        "position:absolute", "left:8px", _isApp ? "right:64px" : "right:8px",   // W762 全宽容器(CTA 卡片条铺开)
        // CSSOS_WAVE_883 — Jing「价格条距 home 指示条 = 指示条距底边(对称)」。
        // home 指示条约离底边 8px、自身高 ~5px(顶约离底 13px)。安全区 inset(~34)整段加上去会把价格条
        // 顶到安全区之上、离指示条一大截。改: inset - 13px(≈指示条顶位)+ 留 8px 对称间隔, 即贴指示条上方
        // ~8px。无安全区设备(老机/桌面)用 8px 下限兜底。其他行间距 = 5px(gap)。
        "bottom:calc(var(--cssos-dock-clear,0px) + max(8px, env(safe-area-inset-bottom,0px) - 13px))",
        "display:flex", "flex-direction:column-reverse",
        "align-items:center", "gap:5px",   // W882 — 各行间距 5px(多语言↔字幕/AI 等)
        "text-align:center",
        "z-index:20",
        "pointer-events:none"   // 容器穿透, 子元素各自 auto
      ].join(";");
      if (getComputedStyle(screen).position === "static") screen.style.position = "relative";
      screen.appendChild(f);
    } else if (f.parentNode !== screen) {
      screen.appendChild(f);
    }
    return f;
  }

  // 清掉成员各自的绝对定位 → 进入静态流。用 important 压过内联/CSS。
  // 幂等守卫: 仅当还没静态化(computed position !== static)才写, 否则 MutationObserver 会
  // 因每帧写 style 而自激成死循环。
  function makeFlowChild(el, force) {
    if (!el) return;
    try { if (!force && getComputedStyle(el).position === "static") return; } catch (_e) {}
    el.style.setProperty("position", "static", "important");
    ["left", "right", "top", "bottom"].forEach(function (p) { el.style.setProperty(p, "auto", "important"); });
    el.style.setProperty("transform", "none", "important");
    el.style.setProperty("margin", "0", "important");
    el.style.setProperty("pointer-events", "auto", "important");
    el.style.setProperty("z-index", "auto", "important");
    // 宽成员(CTA 作品卡片队列)铺满容器宽; 其余保持内容自然宽(靠左)。
    if (el.id && FULLWIDTH[el.id]) {
      el.style.setProperty("align-self", "stretch", "important");
      el.style.setProperty("width", "100%", "important");
      el.style.setProperty("max-width", "100%", "important");
    } else if (el.id === "cssos-lang-fold") {
      // CSSOS_WAVE_1260 — App 端多语言独立成行【居左】(容器 W1259 已 right:64px 让位右轨 → 居左即不压右轨);
      //   桌面端多语言不在本列(并入 priceline 中列), 不会走到这分支。
      var _isAppMf = false;
      try { _isAppMf = document.documentElement.classList.contains("cssos-app") || (window.innerWidth || 9999) < 640; } catch (_e) {}
      el.style.setProperty("align-self", _isAppMf ? "flex-start" : "center", "important");
      el.style.setProperty("max-width", "100%", "important");
    } else {
      el.style.setProperty("align-self", "center", "important");   // W767 — 底部居中(原 flex-start 靠左)
    }
    // CSSOS_WAVE_768 — Jing「传统普通字幕那一行请保持高度」: 它从头驻留到播放结束、不随空内容塌 0、
    // 不随 10 秒无操作隐藏(常驻三件套: 价格条/AI助理/传统普通字幕)。强制始终占一行高度 + 不被 :empty 收起。
    if (el.id === "watch-subtitle") {
      el.style.setProperty("display", "block", "important");
      el.style.setProperty("min-height", "1.5em", "important");
      el.style.setProperty("visibility", "visible", "important");
    }
  }

  // CSSOS_WAVE_845 — Jing「取消传统字幕那一行, 整合到价格条; 传统/价格条/AI助理 同一行」:
  // 建一个横行 #cssos-watch-priceline = [传统字幕(左, flex:1, 单行截断到 Tip)] [价格条(右)],
  // 右侧留出 AI 助理 FAB 的位置。字幕不再单独占一行 → 底部少一行。
  function ensurePriceLine() {
    var screen = screenEl();
    if (!screen) return null;
    var line = document.getElementById("cssos-watch-priceline");
    if (!line) {
      line = document.createElement("div");
      line.id = "cssos-watch-priceline";
      line.dataset.noFrameToggle = "1";
      // CSSOS_WAVE_847 — 必须先落进 DOM(screen), 否则 adopt 的 querySelector 取不到游离节点 →
      // 整行(含价格条/传统字幕)从不被加进底部列 = 三件套行消失。
      screen.appendChild(line);
    }
    var sub = document.getElementById("watch-subtitle");
    var price = document.getElementById("cssos-watch-price-strip");
    // CSSOS_WAVE_863 — 三件套常驻: 价格条还没建出来 → 主动催价格条模块渲染一次, 再取。
    if (!price && typeof globalThis.cssosRenderPriceStrip === "function") {
      try { globalThis.cssosRenderPriceStrip(); } catch (_e) {}
      price = document.getElementById("cssos-watch-price-strip");
    }
    if (sub && sub.parentNode !== line) line.appendChild(sub);
    if (price && price.parentNode !== line) line.appendChild(price);
    // CSSOS_WAVE_1122 — 桌面: 多语言并进本行(中列居中)。
    // CSSOS_WAVE_1260 — App: 多语言【独立成行·居左】(字幕上方), 不并进 priceline → 由 ORDER(adopt)
    //   收编为 bottomflow 独立行, 故 App 端这里【不】把 lang 收进本行。
    var _isAppPL = false;
    try { _isAppPL = document.documentElement.classList.contains("cssos-app") || (window.innerWidth || 9999) < 640; } catch (_e) {}
    var lang = document.getElementById("cssos-lang-fold");
    if (lang && !_isAppPL && lang.parentNode !== line) line.appendChild(lang);
    // CSSOS_WAVE_881 — Jing 拍板布局(按平台分):
    //   桌面端 = 三件套【一行】: [传统字幕 左] [价格条 中] [AI助理 右]  → grid 1fr auto 1fr。
    //   App 端  = 【两行】(窄屏一行塞不下): 上行 [传统字幕(左) ⟷ AI助理(右, FAB 抬高一行落此处)],
    //            下行 [价格条 独占·居中·不被 AI 遮挡]。价格条在【下】。字幕与 AI 在上行上下居中对齐。
    //   (之前 W868 误把 App 也压成一行 = 错; 这里回到 Option B。)
    var isApp = false;
    try { isApp = document.documentElement.classList.contains("cssos-app") || (window.innerWidth || 9999) < 640; } catch (_e) {}
    var AI_FAB_H = "42px";
    // CSSOS_WAVE_1020 20260619 — Jing「小屏里 AI 助理应和传统字幕/价格条【同一行】」: 撤销 W881 的
    //   窄屏两行布局(那是评估反馈"拥挤"的来源, 也非最初样子)。统一【单行】:
    //   [传统字幕 左(flex 截断)] [价格条 中] [AI 助理 右(44px 留位, fixed FAB 竖向对齐本行)]。
    //   窄屏装不下时: 字幕省略号 + 价格条宪法 overflow-x:auto 横滑, 仍一行。桌面/App 一致。
    // CSSOS_WAVE_1032 20260620 — Jing「价格条请居中」: 旧 minmax(0,1fr) auto 44px 左列撑开把价格挤到右边。
    //   改【左右对称】minmax(0,1fr) auto minmax(44px,1fr) → 价格条(中列)真正居中, 字幕左、AI 右对称留位。
    // CSSOS_WAVE_1122 — 对称三列: [字幕 左, ≥72px 防挤到0] [多语言 中, auto 居中] [备用 右]。字幕给最小宽度
    //   是吸取上次"多语言挤爆字幕只显两字"的教训 —— 字幕永远保住至少 72px, 不再归零。
    // CSSOS_WAVE_1255 — Jing「传统字幕可以长到右下角 AI 助理前面」: 右列原 minmax(72px,1fr) 对称占了半幅,
    //   把字幕卡在约一半就截断。改右列 minmax(44px,auto)(只留 AI 按钮自身宽), 字幕左列 1fr 即可一路长到
    //   价格条/AI 之前(价格条空时直抵 AI 前)。
    line.style.cssText = "display:grid;grid-template-columns:minmax(72px,1fr) auto minmax(44px,auto);align-items:center;column-gap:6px;width:100%;min-width:0;min-height:" + AI_FAB_H + ";box-sizing:border-box;";
    if (sub) {
      sub.style.setProperty("min-width", "0", "important");
      sub.style.setProperty("white-space", "nowrap", "important");
      sub.style.setProperty("overflow", "hidden", "important");
      sub.style.setProperty("text-overflow", "ellipsis", "important");
      sub.style.setProperty("text-align", "left", "important");
      sub.style.setProperty("position", "static", "important");
      ["left", "right", "bottom", "top"].forEach(function (p) { sub.style.setProperty(p, "auto", "important"); });
      sub.style.setProperty("transform", "none", "important");
      sub.style.setProperty("opacity", "1", "important");
      sub.style.setProperty("justify-self", "start", "important");
      sub.style.setProperty("align-self", "center", "important");   // 上下居中, 与 AI 平
      sub.style.setProperty("grid-row", "1", "important");          // 上行
      sub.style.setProperty("grid-column", "1", "important");       // 左列(右列 52px 留给 AI FAB)
      // CSSOS_WAVE_1126 — Jing 报「多语言整合后点不动」: 传统字幕是纯展示文字, 其左列的框(1fr)可能盖住
      //   中列多语言、拦截点击。字幕设 pointer-events:none → 点击穿过字幕落到多语言上(字幕从不需点)。
      sub.style.setProperty("pointer-events", "none", "important");
      sub.style.setProperty("max-width", "100%", "important");
      // CSSOS_WAVE_908 — Jing「字幕时有时无, AI 助理跳上跳下」根治: 把传统字幕这行【钉死固定高度 = AI FAB 42px】,
      //   空内容也不塌、有字也不长高 → alignAgentFab 测到的中心恒定, AI 助理稳定不跳。
      sub.style.setProperty("height", AI_FAB_H, "important");
      sub.style.setProperty("min-height", AI_FAB_H, "important");
      sub.style.setProperty("max-height", AI_FAB_H, "important");
      sub.style.setProperty("line-height", AI_FAB_H, "important");
      sub.style.setProperty("display", "block", "important");
    }
    if (price) {
      price.style.setProperty("position", "static", "important");
      ["left", "right", "bottom", "top"].forEach(function (p) { price.style.setProperty(p, "auto", "important"); });
      price.style.setProperty("transform", "none", "important");
      price.style.setProperty("margin", "0", "important");
      price.style.setProperty("justify-self", "center", "important");
      price.style.setProperty("align-self", "center", "important");
      // CSSOS_WAVE_864 — 价格条自适应 + 装不下横滑: min-width:0(可收缩)+ 有界 max-width → 宪法 overflow-x:auto 接管。
      price.style.setProperty("min-width", "0", "important");
      // CSSOS_WAVE_1020 — 统一单行: 价格条恒在【中列】, 窄屏靠宪法横滑收纳, 不再下沉成第二行。
      price.style.setProperty("grid-row", "1", "important");
      price.style.setProperty("grid-column", "2", "important");
      price.style.setProperty("max-width", isApp ? "min(58vw, 420px)" : "min(72vw, 640px)", "important");
    }
    // CSSOS_WAVE_1122 — 桌面: 多语言并入中列居中(清掉它自身的绝对定位, 由本行 grid 接管)。
    // CSSOS_WAVE_1260 — App 端多语言已独立成行(不在本网格), 这段中列样式仅桌面跑; App 居左由 makeFlowChild 接管。
    if (lang && !isApp) {
      lang.style.setProperty("position", "static", "important");
      ["left", "right", "bottom", "top"].forEach(function (p) { lang.style.setProperty(p, "auto", "important"); });
      lang.style.setProperty("transform", "none", "important");
      lang.style.setProperty("margin", "0", "important");
      lang.style.setProperty("grid-row", "1", "important");
      lang.style.setProperty("grid-column", "2", "important");       // 中列
      lang.style.setProperty("justify-self", "center", "important"); // 居中
      lang.style.setProperty("align-self", "center", "important");
      lang.style.setProperty("min-width", "0", "important");
      lang.style.setProperty("max-width", isApp ? "min(64vw, 460px)" : "min(70vw, 680px)", "important");
      lang.style.setProperty("pointer-events", "auto", "important");
      lang.style.setProperty("z-index", "8", "important");          // W1126 — 抬到字幕之上, 确保可点
      lang.style.setProperty("position", "relative", "important");  // z-index 生效需定位上下文(此处 relative 不脱流)
    }
    return line;
  }

  // CSSOS_WAVE_1261 — 远程布局探针(临时诊断: Chrome 被组织策略挡住 cssstudio.app, 无法本地看活 DOM)。
  //   App 进影院加载完后量一次底部各元素 + 右轨的 bounding rect, 上报遥测 → 让我精确看到谁压右轨。修对即删。
  var _layoutProbed = false;
  function layoutProbe() {
    if (_layoutProbed) return;
    try {
      var isApp = document.documentElement.classList.contains("cssos-app") || (window.innerWidth || 9999) < 640;
      var lang = document.getElementById("cssos-lang-fold") || document.getElementById("watch-language-pill");
      // 等"加载后状态": 多语言已出现再采样(此时 Settings/Fine-tune 等也已冒出)。桌面/App 都采。
      if (!lang) return;
      var vh = window.innerHeight;
      var R = function (el) { if (!el) return null; var r = el.getBoundingClientRect(); return (r.width || r.height) ? [Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)] : null; };
      // 广扫【底部 ~160px 区域】所有有框的胶囊/控件(不限容器, 这样能逮到难找的 Settings/Fine-tune),
      //   报 tag/id/class(截断)+ 左右坐标 → 我一眼看出谁伸到右轨、谁是第一颗。
      var host = document.getElementById("watch-panel") || document.body;
      var all = host.querySelectorAll("button,div,span,a");
      var items = [];
      for (var i = 0; i < all.length && items.length < 34; i++) {
        var el = all[i]; var r = el.getBoundingClientRect();
        if (r.width >= 28 && r.height >= 14 && r.bottom > vh - 160 && r.top < vh - 2) {
          var cls = (el.className && el.className.baseVal !== undefined) ? el.className.baseVal : String(el.className || "");
          var txt = (el.textContent || "").replace(/\s+/g, "").slice(0, 10);
          items.push({ t: el.tagName, id: el.id || "", c: cls.slice(0, 40), x: [Math.round(r.left), Math.round(r.right)], tx: txt });
        }
      }
      _layoutProbed = true;
      var data = { plat: isApp ? "app" : "desktop", vw: window.innerWidth, vh: vh, rail: R(document.getElementById("cssos-watch-social-rail")), flow: R(document.getElementById("cssos-watch-bottomflow")), items: items };
      fetch("/api/telemetry/error", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "layout_probe " + JSON.stringify(data), code: "layout_probe", panel: "cinema" }) }).catch(function () {});
    } catch (_e) {}
  }

  var lastSig = "";
  function adopt() {
    var f = ensureFlow();
    if (!f) return;
    try { ensurePriceLine(); } catch (_e) {}
    // 收集当前存在的成员(按 ORDER)。
    // CSSOS_WAVE_1260 — Jing「App 端: 最底=传统字幕(居左), 上一行=多语言(居左, 不压右轨)」。
    //   App 把 #cssos-lang-fold 加入 ORDER(priceline 之上一行); 桌面维持 W1122(多语言并入 priceline 中列)。
    var _isAppOrd = false;
    try { _isAppOrd = document.documentElement.classList.contains("cssos-app") || (window.innerWidth || 9999) < 640; } catch (_e) {}
    var order = _isAppOrd
      ? ["#cssos-watch-priceline", "#cssos-lang-fold", "#cssos-up-next-strip", "#cssos-create-cta"]
      : ORDER;
    var els = [];
    for (var i = 0; i < order.length; i++) {
      var el = document.querySelector(order[i]);
      if (el) els.push(el);
    }
    // 仅当【成员集合或顺序变化】时才重排, 避免每帧 appendChild churn。
    var sig = els.map(function (e) { return e.id || e.className; }).join("|");
    var childrenNow = Array.prototype.filter.call(f.children, function (c) { return true; });
    var orderRight = childrenNow.length === els.length &&
      els.every(function (e, idx) { return childrenNow[idx] === e; });
    if (sig !== lastSig || !orderRight) {
      els.forEach(function (e) { f.appendChild(e); makeFlowChild(e, true); });
      lastSig = sig;
    } else {
      // 集合未变: 仅在某成员被别的模块重置回绝对定位时才纠正(幂等守卫内部判断)。
      els.forEach(function (e) { makeFlowChild(e, false); });
    }
    // 字幕保持自身居中定位, 仅确保不被列遮挡: 它自己的 bottom 由情绪字幕引擎管, 这里不动。
    try { alignAgentFab(); } catch (_e) {}
    try { layoutProbe(); } catch (_e) {}   // W1261 — 一次性远程量尺(修对即删)
  }

  // CSSOS_WAVE_906 — Jing「传统字幕和 AI 助理不在同一行(同行则 AI 太高)」根治: AI 助理 FAB 是 position:fixed,
  //   靠固定 +54px 猜位置永远对不齐。改成【实测字幕行的竖直中心, 把 FAB 的竖直中心对齐过去】(仅 App/窄屏)。
  //   桌面端清掉内联 bottom, 回归 CSS 默认(三件套一行)。内联 !important 压过 W855 的 +54。
  function alignAgentFab() {
    var fab = document.getElementById("cssos-agent-fab");
    if (!fab) return;
    var isApp = false;
    try { isApp = document.documentElement.classList.contains("cssos-app") || (window.innerWidth || 9999) < 640; } catch (_e) {}
    if (!isApp) { fab.style.removeProperty("bottom"); return; }
    var sub = document.getElementById("watch-subtitle");
    if (!sub) return;
    var sr = sub.getBoundingClientRect();
    if (!sr || !sr.height) return;
    var fabH = fab.offsetHeight || 42;
    var subCenterFromBottom = window.innerHeight - (sr.top + sr.height / 2);
    var bottomPx = Math.max(8, Math.round(subCenterFromBottom - fabH / 2));
    fab.style.setProperty("bottom", bottomPx + "px", "important");
  }

  var rafPending = false;
  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; adopt(); });
  }
  // CSSOS_WAVE_870 — Jing「多语言久不久跑到上面」根治: 暴露 schedule 给 lang-flag-pills, 它每次重渲染
  // /重建 fold 后立刻喊一声 → 同帧 adopt 把 fold 收回底部列, 不再等 2s 安全网(那 2s 窗口 = "跑上面")。
  globalThis.cssosScheduleBottomFlow = schedule;

  function start() {
    // W803 — Jing 审计: 原 300ms forever 定时器与下面的 resize+一堆 cssos 事件+MutationObserver 高度冗余。
    // 底部栈是关键布局(价格条/字幕/AI助理), 保留一个【慢安全网】即可 → 300ms→2000ms(省 85% 空转)。
    setInterval(schedule, 2000);
    window.addEventListener("resize", schedule, { passive: true });
    ["cssos:work-changed", "cssos:work-id-changed", "cssos:playlist-advance",
     "cssos:dock-toggle", "cssos:cinema-toggle", "cssos:purchase-complete",
     "cssos:open-watch-for-run", "fullscreenchange"].forEach(function (ev) {
      document.addEventListener(ev, schedule);
      window.addEventListener(ev, schedule);
    });
    var host = document.getElementById("watch-panel") || document.body;
    try {
      new MutationObserver(schedule).observe(host, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ["class", "style", "hidden"]
      });
    } catch (_e) {}
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
  globalThis.cssosRelayoutBottomStack = schedule;   // 兼容旧调用名
})();
