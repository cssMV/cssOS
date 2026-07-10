/* CSSOS_WAVE_996 20260618 — Jing「逐字波形精修(第二期b)」
 * 一行实时波形 + 一行可拖字幕:哪个字咬哪,就把那个字拖到波形那个位置,保存=绝对对齐。
 *   - 波形 = 整曲音量包络(globalThis.cssosSongVolumeCurve, 后端已算好)。
 *   - 每个【字】是一颗可横向拖动的 chip, 拖到歌声咬字处即时生效(听+看对照)。
 *   - 播放头跟随 #watch-audio-preview, 点波形 seek; ▶/⏸ 控同一首歌(影院在播)。
 *   - 保存 → cssosEmotionSubtitle.saveTokenOffsets()(逐字偏移整表落库, 非破坏性)。
 * 数据来自 globalThis.cssosEmotionSubtitle.getEditorModel()。 */
(function () {
  "use strict";
  var PX_PER_SEC = 110;
  var WAVE_H = 92;   // W1679 — 波形高度(原 120, 压扁以便整条塞进黑边)
  var overlay = null, strip = null, playhead = null, raf = 0, model = null, _restore = null;
  var _guardAu = null, _guardFn = null; // W1049 — 暂停守卫的音频元素 + 回调(close 时摘除)
  var _onFit = null;                    // W1680 — 贴黑边的 resize/转屏回调(close 时摘除)
  var _onKey = null;                    // W1684 — 键盘快捷键(close 时摘除)

  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    return (globalThis.currentLocale === "zh") ? zh : en;
  }
  // W1684 — 本文件原先没有转义器(说明浮层改用 innerHTML 后必须有, 否则文案里的 < & 会破坏结构)。
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function eng() { return globalThis.cssosEmotionSubtitle; }
  function audioEl() { try { return document.getElementById("watch-audio-preview"); } catch (_e) { return null; } }
  function toast(m) { try { if (typeof globalThis.cssosGuidedToast === "function") globalThis.cssosGuidedToast(m); } catch (_e) {} }

  function close() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    // W1676 — 必须交还方向盘: 否则音频权威永远不再救活卡死源(退出后影院再也不会自动出声)。
    try { globalThis.cssosAudioIntentPaused = false; } catch (_e) {}
    // W1680 — 摘除贴黑边监听(否则关闭后 resize 仍在动已卸载的 DOM)。
    try { if (_onFit) { window.removeEventListener("resize", _onFit); window.removeEventListener("orientationchange", _onFit); } } catch (_e) {}
    _onFit = null;
    // W1684 — 摘除快捷键, 否则关闭后空格/Esc 仍被本面板吞掉。
    try { if (_onKey) window.removeEventListener("keydown", _onKey, true); } catch (_e) {}
    _onKey = null;
    // CSSOS_WAVE_1046 — 还原被强制的「单曲循环 + 播放速度」(微调期间强制 loop=true, 退出复原)。
    try { if (_guardAu && _guardFn) _guardAu.removeEventListener("play", _guardFn); } catch (_e) {}
    _guardAu = null; _guardFn = null;
    try {
      var au = audioEl();
      if (au && _restore) { au.loop = _restore.loop; au.playbackRate = _restore.rate; }
    } catch (_e) {}
    _restore = null;
    if (overlay) { try { overlay.remove(); } catch (_e) {} overlay = null; }
    strip = null; playhead = null; model = null;
  }

  /* CSSOS_WAVE_1679 — Jing「之前还有音频波形图, 按那个微调很好用」。两个真 bug 叠加:
   *  ① 数据缺失: upsertSubtitleJson 有 7 处调用, 只有 1 处传了 volCurve → 绝大多数作品的字幕
   *     JSON 里根本没有 vol_curve, 编辑器只能画 else 分支那条兜底直线。
   *  ② 就算有也不够用: 后端 STEP=0.5s(2Hz), 看不出音节起点; 且画布宽 = dur×pps, 一首 3 分钟歌
   *     ≈19800px, 超过 Safari 的 16384px 画布上限 → 整块画不出来。
   * 治本: 客户端解码音频算真波形(10ms 一峰), 并把波形切成多块画布铺开(每块 ≤8192px)。
   *   解码走 8kHz 单声道 OfflineAudioContext: 4 分钟 ≈7.7MB, 远低于原生 44.1k 立体声(~84MB),
   *   不会重演 Safari GPU/内存 OOM。后端 vol_curve 若在, 先用它秒画, 真波形算好再覆盖。 */
  var TILE_MAX = 8192;

  function paintWave(wrap, durSec, vc, pps) {
    pps = pps || PX_PER_SEC;
    var total = Math.max(320, Math.round(durSec * pps));
    wrap.innerHTML = "";
    var has = !!(vc && vc.values && vc.values.length && vc.step_ms > 0);
    var step = has ? vc.step_ms / 1000 : 0;
    var max = 0;
    if (has) { for (var i = 0; i < vc.values.length; i++) if (vc.values[i] > max) max = vc.values[i]; }
    if (!(max > 0)) max = 1;
    // W1685 — 优先用 99 分位做基准(loadPeaks 算好); 后端粗包络没有 norm → 退回 max。
    var norm = (vc && vc.norm > 0) ? vc.norm : max;

    for (var x0 = 0; x0 < total; x0 += TILE_MAX) {
      var w = Math.min(TILE_MAX, total - x0);
      var cv = document.createElement("canvas");
      cv.width = w; cv.height = WAVE_H;
      cv.style.cssText = "display:block;position:absolute;left:" + x0 + "px;top:0;width:" + w + "px;height:" + WAVE_H + "px";
      var ctx = cv.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "rgba(94,234,212,0.22)";
      if (has) {
        // 只画落在本块里的采样点(整曲线性扫描一次由外层 tile 循环摊掉, 数量级 ~2.4万, 无压力)。
        var jA = Math.max(0, Math.floor((x0 / pps) / step) - 1);
        var jB = Math.min(vc.values.length, Math.ceil(((x0 + w) / pps) / step) + 1);
        var bw = Math.max(1, Math.round(step * pps));
        for (var j = jA; j < jB; j++) {
          var x = Math.round(j * step * pps) - x0;
          // W1685 — 99 分位归一 + 0.72 次幂提亮: 让常规唱段撑满波形带, 而不是缩在中线附近。
          //   超过 99 分位的爆音夹到满幅(不会溢出带外)。
          var v = Math.min(1, vc.values[j] / norm);
          var bh = Math.round(Math.pow(v, 0.72) * (WAVE_H - 2));
          // W1682 — 静音处不再强行拉到 1px: 原来的 `if (bh<1) bh=1` 会让整条波形底下永远
          //   拖着一根贯穿全宽的细线(Jing「删掉那个细细的线」)。静音就该是空的。
          if (bh < 1) continue;
          ctx.fillRect(x, (WAVE_H - bh) / 2, bw, bh);
        }
      }
      // W1682 — 解码前不再画基线(那正是被误认成"波形"的那根细线); 留空即可, 真波形随后覆盖。
      wrap.appendChild(cv);
    }
  }

  /* 客户端真波形: fetch 音频 → 8kHz 单声道解码 → 每 10ms 取峰值。解完即释放 AudioBuffer。 */
  var _peaks = null, _peaksFor = "";
  function loadPeaks(url, durSec) {
    if (!url || !(durSec > 0)) return Promise.resolve(null);
    if (_peaksFor === url && _peaks) return Promise.resolve(_peaks);
    var AC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!AC || typeof fetch !== "function") return Promise.resolve(null);
    // W1680 — 绝不能带 credentials: cdn.cssstudio.app 回的是具名 Allow-Origin 且【没有】
    //   Allow-Credentials → 带凭证的跨域请求会被浏览器判死, 波形永远退回基线。音频不需要 cookie。
    return fetch(url, { credentials: "omit", mode: "cors" })
      .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
      .then(function (buf) {
        if (!buf) return null;
        var ctx = new AC(1, Math.max(1, Math.ceil(durSec * 8000)), 8000);
        return new Promise(function (ok) {
          var done = false;
          var fin = function (ab) { if (!done) { done = true; ok(ab || null); } };
          try {
            var p = ctx.decodeAudioData(buf, fin, function () { fin(null); });
            if (p && p.then) p.then(fin, function () { fin(null); });
          } catch (_e) { fin(null); }
        });
      })
      .then(function (audio) {
        if (!audio || !audio.getChannelData) return null;
        var ch = audio.getChannelData(0);
        var hop = Math.max(1, Math.round(audio.sampleRate * 0.01)); // 10ms
        var out = new Float32Array(Math.ceil(ch.length / hop));
        for (var i = 0, k = 0; i < ch.length; i += hop, k++) {
          var m = 0, e = Math.min(i + hop, ch.length);
          for (var j = i; j < e; j++) { var v = ch[j] < 0 ? -ch[j] : ch[j]; if (v > m) m = v; }
          out[k] = m;
        }
        /* W1685 — 归一化基准取【99 分位】而非绝对峰值: 全曲只要有一处爆音, 用 max 归一会把
         * 其余部分全压扁成中间一条细线, 上下各空一大截黑(Jing「波形下方还留很高的黑边」)。 */
        var srt = Float32Array.from(out); srt.sort();
        var p99 = srt[Math.min(srt.length - 1, Math.floor(srt.length * 0.99))] || 0;
        _peaks = { step_ms: 10, values: out, norm: (p99 > 0 ? p99 : 0) }; _peaksFor = url;
        return _peaks;
      })
      .catch(function () { return null; });
  }
  // 真波形优先; 没解码好就用后端粗包络; 都没有 → paintWave 画基线。
  function curCurve() { return _peaks || (model && model.volCurve) || null; }

  /* W1680 — Jing「到波形那根线就刚好在黑边区」: 量出【视口顶 → 画面上沿】的真实黑边高度。
   *   视频元素盒 vs 视频内容盒(object-fit:contain 的信箱)之差 ÷2 = 上黑边。拿不到元数据 → 0(回退固定高)。*/
  function letterboxTop() {
    try {
      // ① 有视频且已拿到元数据 → 真信箱: 元素盒与内容盒(object-fit:contain)之差 ÷2。
      var v = document.getElementById("watch-video");
      if (v && v.videoWidth && v.videoHeight) {
        var rv = v.getBoundingClientRect();
        if (rv.width > 0 && rv.height > 0 && rv.bottom > 0) {
          var scale = Math.min(rv.width / v.videoWidth, rv.height / v.videoHeight);
          return Math.max(0, Math.round(rv.top + (rv.height - v.videoHeight * scale) / 2));
        }
      }
      /* ② W1682 — 静图封面/幻灯(KaraOKe MV 这类)根本没有视频元数据, 上面必然返回 0 → 顶条
       *   回退固定 186 → 压到画面上。封面 <img> 是 object-fit:cover(铺满无信箱), 所以
       *   "画面上沿" = 该元素自身的 top。取它即可, 对静图/幻灯同样精准贴边。 */
      var im = document.querySelector("#watch-panel .watch-svg, #watch-svg");
      if (im) {
        var ri = im.getBoundingClientRect();
        if (ri.height > 0 && ri.bottom > 0) return Math.max(0, Math.round(ri.top));
      }
      return 0;
    } catch (_e) { return 0; }
  }

  /* W1684 — 紧凑版工具条样式。【只作用于 #cssos-wave-editor】: .cssfx-btn 是与
   * app.emotion-fx-panel 共用的类, 全局改会误伤那个面板, 所以整段作用域限死在本面板内。 */
  function injectEditorStyle() {
    if (document.getElementById("cssos-wave-editor-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-wave-editor-style";
    st.textContent = [
      // nowrap 是关键: 「Phrase loop」原来折成两行, 把整个头部撑高了一倍。
      "#cssos-wave-editor .cssfx-btn{padding:4px 9px;font-size:12px;line-height:1.25;min-height:26px;",
      "  border-radius:8px;white-space:nowrap;}",
      /* W1686 — 原先手写的 .wv-seg 连体分段样式已删除: 宪法明令「Do NOT write bespoke
       * tab/pill CSS」。凸嵌凹几何、色相、40px 高度一律由 app.pill-bar.js 统一供给。 */
      "#cssos-wave-editor .wv-title{font-weight:700;font-size:13px;cursor:grab;user-select:none;",
      "  touch-action:none;white-space:nowrap;}",
      // 窄屏只留手柄图标, 标题文字让位给按钮。
      "@media (max-width:900px){#cssos-wave-editor .wv-title>span{display:none;}}",
      "#cssos-wave-editor kbd{background:rgba(255,255,255,0.12);border-radius:4px;padding:0 4px;",
      "  font:600 11px/1.5 ui-monospace,monospace;}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function open() {
    injectEditorStyle();
    var e = eng();
    if (!e || typeof e.getEditorModel !== "function") { toast(lc("Play a song first", "请先播放一首歌")); return; }
    // CSSOS_WAVE_1041 20260620 — Jing「点波形精修没反应/崩 Cannot read 'duration' of null」根治:
    //   原顺序 model=getEditorModel() → close() → 用 model。但 close() 内部把【模块级 model 置 null】(清理
    //   上一个编辑器)→ 紧接着读 model.duration = null 崩溃。修: close() 提到取 model 之前, 先清理再取值。
    close();
    model = e.getEditorModel();
    if (!model || !model.tokens || !model.tokens.length) { toast(lc("No subtitle to edit yet", "这首还没有可编辑的字幕")); return; }
    var dur = model.duration || (model.tokens[model.tokens.length - 1].curEnd + 4);
    var pps = PX_PER_SEC; // CSSOS_WAVE_1046 — 动态像素/秒(缩放)
    // CSSOS_WAVE_1046 — 强制单曲循环: 微调期间整首歌反复播, 退出(close)还原原值。
    try {
      var auF = audioEl();
      if (auF) { _restore = { loop: auF.loop, rate: auF.playbackRate }; auF.loop = true; }
    } catch (_e) {}

    overlay = document.createElement("div");
    overlay.id = "cssos-wave-editor";
    // CSSOS_WAVE_1676 — Jing「不要全屏, 只占顶部, 别遮画面」: 从 inset:0 全屏罩改成【顶部窄条】。
    //   不设 bottom → 高度 = 内容(工具条 + 提示 + 波形带), max-height 兜底; 半透明 + 模糊,
    //   画面在下方照常可见可播。吞噬指针的监听只覆盖这条带, 影院区域重新可用。
    overlay.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:100095;" +
      /* W1687 — 背景改回半透明 + 模糊(Jing:「原来那样」)。W1682 那版为了消接缝改成了纯黑,
       * 现恢复渐变毛玻璃; 但【底部那道 1px 绿线和投影不回来】—— 它横在画面上沿, 正是你要我
       * 删掉的"细细的线"之一。 */
      "background:linear-gradient(180deg,rgba(4,12,9,0.97) 0%,rgba(4,12,9,0.93) 74%,rgba(4,12,9,0.78) 100%);" +
      "-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);" +
      "max-height:46vh;display:flex;flex-direction:column;color:#e8fff7;font-size:14px";
    // swallow all pointer events so cinema swipe/pause never fire underneath
    ["pointerdown", "click", "touchstart", "contextmenu"].forEach(function (ev) {
      overlay.addEventListener(ev, function (e2) { e2.stopPropagation(); }, false);
    });

    // Header
    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;gap:10px;padding:5px 14px 5px;flex:0 0 auto";
    head.innerHTML =
      // W1683 — 标题 = 拖拽手柄(面板宪法: titlebar 即 handle)。
      // W1683 — 标题 = 拖拽手柄(面板宪法: titlebar 即 handle)。
      '<div data-act="title" class="wv-title" title="' + lc("Drag to move this panel", "拖动移动本面板") + '">' +
      '🎚 <span>' + lc("Waveform fine-tune", "波形逐字精修") + '</span></div>' +
      '<div style="flex:1"></div>' +
      /* W1686 — 胶囊宪法迁移(方案 A, Jing 批准, 并豁免 W497 的 120px 列宽地板)。
       * 【Speed】是本工具条里【唯一的互斥选择器】(一座 active 岛, 其余凹向它) → 走真正的
       *   data-pill-bar + cssosMakePillBar, 凸嵌凹在这里才名正言顺。
       * 【其余】是动作/开关(Save、✕、➖➕…), 不是并列选项。若并入同一 bar, 凸嵌凹会把
       *   「保存」「关闭」碾成「1× 的备选项」—— 那不是不好看, 是说错话。它们只上胶囊妆
       *   (data-pill-bar 被 stampOne 自动上色; 无 .active → 宪法的「no-active 规则」给每颗
       *    凸侧 1px 边, 仍是可点边界预览), 点击仍由本文件自管。
       * 豁免说明: 不写 grid-auto-columns 地板 → 用工具默认 minmax(max-content,1fr)。
       * W497 图标律照守: 三档速度与 Save 原本无图标, 现补上。 */
      '<span id="wv-speed" data-pill-bar data-pill-compact title="' + lc("Playback speed", "播放速度") + '">' +
        '<button data-pill-key="0.5" class="cssfx-btn cssfx-spd">🐢 0.5×</button>' +
        '<button data-pill-key="0.75" class="cssfx-btn cssfx-spd">🚶 0.75×</button>' +
        '<button data-pill-key="1" class="cssfx-btn cssfx-spd active">🏃 1×</button>' +
      '</span>' +
      '<span id="wv-acts" data-pill-bar data-pill-compact>' +
        '<button data-act="loop" class="cssfx-btn" title="' + lc("Loop just this phrase", "只循环这一句") + '">🔁 ' + lc("Loop", "段循环") + '</button>' +
        '<button data-act="zoomout" class="cssfx-btn" title="' + lc("Shrink waveform", "缩短波形") + '">➖</button>' +
        '<button data-act="zoomin" class="cssfx-btn" title="' + lc("Stretch waveform", "拉长波形") + '">➕</button>' +
        '<button data-act="addtok" class="cssfx-btn" title="' + lc("Add a word at playhead", "在播放头处加字") + '">＋ ' + lc("Word", "字") + '</button>' +
        '<button data-act="play" class="cssfx-btn">▶</button>' +
        '<button data-act="save" class="cssfx-btn primary">💾 ' + lc("Save", "保存") + '</button>' +
        // W1679 — 说明文字不再独占一行; 收进这个 ? 里, 按需弹出(快捷键也在里面)。
        '<button data-act="help" class="cssfx-btn" title="' + lc("How to use", "怎么用") + '">❓</button>' +
        '<button data-act="close" class="cssfx-btn" title="' + lc("Close", "关闭") + '">✕</button>' +
      '</span>';
    overlay.appendChild(head);

    // W1679 — 绝对定位在顶条【下方】(top:100%), 不占顶条高度; 默认收起。
    var hint = document.createElement("div");
    hint.style.cssText = "position:absolute;left:14px;right:14px;top:100%;z-index:3;display:none;" +
      "margin-top:6px;padding:9px 13px;border-radius:11px;line-height:1.55;" +
      "background:rgba(8,18,16,0.97);border:1px solid rgba(0,245,160,0.30);" +
      "box-shadow:0 10px 28px rgba(0,0,0,0.5);opacity:0.95;font-size:12px";
    hint.innerHTML = "<div>" + esc(lc(
      "Click waveform = move bar there + pause \u00b7 \u25b6 to play. Tap a word = edit mode, then drag to align \u00b7 drag \u283f handle = move whole line \u00b7 \u2715 = delete \u00b7 \uff0b/double-click = add word \u00b7 \u2796\u2795 zoom \u00b7 slow + loop for precision. Save when done.",
      "\u70b9\u6ce2\u5f62\u4efb\u610f\u5904=\u7ea2\u6761\u79fb\u5230\u8be5\u5904\u5e76\u6682\u505c,\u70b9\u25b6\u624d\u64ad\u653e(\u817e\u65f6\u95f4\u5fae\u8c03)\u3002\u70b9\u67d0\u4e2a\u5b57=\u8fdb\u7f16\u8f91\u6a21\u5f0f\u518d\u62d6\u5bf9\u9f50 \u00b7 \u62d6 \u283f \u624b\u67c4=\u6574\u53e5\u79fb\u52a8 \u00b7 \u2715=\u5220\u5b57 \u00b7 \uff0b\u6216\u53cc\u51fb=\u52a0\u5b57 \u00b7 \u2796\u2795\u7f29\u653e \u00b7 \u653e\u6162+\u6bb5\u5faa\u73af=\u7cbe\u4fee\u3002\u5b8c\u6210\u70b9\u4fdd\u5b58\u3002")) + "</div>" +
      '<div style="margin-top:7px;opacity:.85">' + esc(lc("Shortcuts", "\u5feb\u6377\u952e")) + ': ' +
      '<kbd>Space</kbd> ' + esc(lc("play/pause", "\u64ad/\u505c")) + ' \u00b7 <kbd>\u2190</kbd><kbd>\u2192</kbd> ' + esc(lc("seek 0.1s (Shift = 0.02s)", "\u524d\u540e 0.1s (Shift = 0.02s)")) + ' \u00b7 ' +
      '<kbd>+</kbd><kbd>\u2212</kbd> ' + esc(lc("zoom", "\u7f29\u653e")) + ' \u00b7 <kbd>\u2318S</kbd> ' + esc(lc("save", "\u4fdd\u5b58")) + ' \u00b7 <kbd>Esc</kbd> ' + esc(lc("close", "\u5173\u95ed")) + '</div>';

    overlay.appendChild(hint);

    // Scrollable strip
    var scroller = document.createElement("div");
    // W1676 — 顶部窄条模式下父容器高度=内容, flex:1 会塌成 0; 给波形带一个确定高度
    //   (= strip 的 min-height 220 + 一点余量), 顶条总高 ≈ 工具条 + 提示 + 232px。
    scroller.style.cssText = "flex:0 0 auto;height:186px;overflow-x:auto;overflow-y:hidden;position:relative;-webkit-overflow-scrolling:touch";
    strip = document.createElement("div");
    // W1679 — 压扁: 字块 0..92 + 波形 90..182 → 186 足够, 顶条整体 ≈ 工具条 + 186, 可落进黑边。
    strip.style.cssText = "position:relative;height:100%;min-height:186px;width:" +
      Math.max(320, Math.round(dur * pps)) + "px";
    // waveform
    var waveWrap = document.createElement("div");
    waveWrap.style.cssText = "position:absolute;left:0;right:0;top:47px;height:" + WAVE_H + "px";
    paintWave(waveWrap, dur, curCurve(), pps);
    strip.appendChild(waveWrap);
    // W1680 — 把顶条压进真实黑边: 可用高 = 上黑边 − 工具条。字块固定占 90, 余下全给波形。
    //   量不到(视频还没元数据 / 幻灯无视频)→ 回退 186。resize / 转屏 / 元数据到位都重算。
    var _moved = false;   // W1683 — 用户拖过面板 → 自动贴黑边让位于用户意图
    function fitBand() {
      if (!overlay || _moved) return;
      var avail = letterboxTop();
      var headH = head.offsetHeight || 44;
      var h = avail > 0 ? Math.round(avail - headH - 2) : 186;
      h = Math.max(120, Math.min(186, h));
      WAVE_H = Math.max(44, h - 52);
      scroller.style.height = h + "px";
      strip.style.minHeight = h + "px";
      waveWrap.style.height = WAVE_H + "px";
      try { paintWave(waveWrap, dur, curCurve(), pps); } catch (_e) {}
    }
    _onFit = fitBand;
    window.addEventListener("resize", _onFit);
    window.addEventListener("orientationchange", _onFit);
    fitBand();
    setTimeout(function () { if (overlay) fitBand(); }, 600);  // 视频元数据可能晚到

    // W1679 — 真波形异步解码; 先用后端 vol_curve(或基线)占位, 不阻塞打开。算好即覆盖重画。
    try {
      var _au0 = audioEl(), _src0 = _au0 && (_au0.currentSrc || _au0.src);
      loadPeaks(_src0, dur).then(function (pk) {
        if (pk && overlay && waveWrap.isConnected) { try { paintWave(waveWrap, dur, pk, pps); } catch (_e) {} }
      });
    } catch (_e) {}
    // CSSOS_WAVE_1049 — Jing「无法暂停 + 点哪暂停在哪」: 编辑器自管播放意图(wantPlaying),
    //   并装一个 'play' 守卫——任何外部模块(影院音频权威/卡顿看门狗)偷偷 au.play() 时, 若用户
    //   想暂停就立刻再 pause 回去, 保证"暂停得住"。点波形任意处 = 移红条到该处 + 暂停(腾时间微调)。
    var seeking = false;
    var wantPlaying = false;        // 用户的播放意图(true=要播, false=要停)
    var editingChip = null;         // W1049 — 当前进入编辑模式的字 chip(点字进入, 才可拖)
    function seekToClientX(cx) {
      var rect = strip.getBoundingClientRect();
      var x = cx - rect.left + scroller.scrollLeft;
      var t = Math.max(0, Math.min(dur, x / pps));
      var au = audioEl(); if (au) { try { au.currentTime = t; } catch (_e) {} }
    }
    // CSSOS_WAVE_1676 — Jing「现在无法暂停」根因: app.watch-audio-authority.js 的 1.5s 安全 tick
    //   把 a.paused 当作"源卡死"并 tryPlay() 救活(还带 320ms 重试), 和本编辑器的暂停守卫抢方向盘。
    //   立一个全局意图契约: 谁明确要停, 就置 cssosAudioIntentPaused=true, 权威见此让位、不再救活。
    function pausePlayback() {
      wantPlaying = false;
      try { globalThis.cssosAudioIntentPaused = true; } catch (_e) {}
      var au = audioEl(); if (au) { try { au.pause(); } catch (_e) {} }
    }
    function resumePlayback() {
      wantPlaying = true;
      try { globalThis.cssosAudioIntentPaused = false; } catch (_e) {}
      var au = audioEl(); if (au) { try { au.play().catch(function () {}); } catch (_e) {} }
    }
    waveWrap.addEventListener("pointerdown", function (ev) {
      seeking = true; pausePlayback(); seekToClientX(ev.clientX); // 点哪 = 停在哪
      try { waveWrap.setPointerCapture(ev.pointerId); } catch (_e) {}
      ev.preventDefault(); ev.stopPropagation();
    }, false);
    waveWrap.addEventListener("pointermove", function (ev) {
      if (!seeking) return; seekToClientX(ev.clientX); ev.preventDefault(); ev.stopPropagation();
    }, false);
    var seekEnd = function (ev) { seeking = false; if (ev) ev.stopPropagation(); };
    waveWrap.addEventListener("pointerup", seekEnd, false);
    waveWrap.addEventListener("pointercancel", seekEnd, false);

    // CSSOS_WAVE_1043 v2① — 整句拖动: 按 lineIndex 分组所有 chip/stem, Shift+拖 = 整行一起移
    //   (setLineOffset), 普通拖 = 单字(setTokenOffset)。
    // CSSOS_WAVE_1048 v2② — 加/删 token: chip 放进可重建的 chipLayer; ✕ 删字、＋加字后重绘。
    var linesMap = {};   // lineIndex → [{chip, stem, tok, baseLeft}]
    var allRecs = [];    // 扁平所有 chip 记录(缩放重排用)
    var chipLayer = document.createElement("div");
    chipLayer.style.cssText = "position:absolute;inset:0;pointer-events:none";
    strip.appendChild(chipLayer);
    function chipBaseLeft(tok) { return Math.round(tok.curStart * pps); }
    function buildChip(tok) {
      var added = !!tok.added;
      var chip = document.createElement("div");
      chip.className = "cssos-wave-chip" + (added ? " is-added" : "");
      chip.style.cssText = "position:absolute;top:18px;transform:translateX(-50%);pointer-events:auto;" +
        "background:" + (added ? "linear-gradient(135deg,#fcd34d,#fb923c)" : "linear-gradient(135deg,#5eead4,#38bdf8)") + ";" +
        "color:#042f2e;font-weight:700;padding:5px 22px 5px 9px;border-radius:8px;white-space:nowrap;" +
        "cursor:ew-resize;touch-action:none;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:14px;user-select:none";
      var label = document.createElement("span"); label.textContent = tok.text; chip.appendChild(label);
      // ✕ 删除按钮
      var del = document.createElement("button");
      del.textContent = "✕"; del.title = lc("Delete this word", "删除这个字");
      del.style.cssText = "position:absolute;top:1px;right:2px;border:0;background:transparent;color:rgba(4,47,46,0.7);" +
        "font-size:11px;line-height:1;cursor:pointer;padding:2px 3px";
      del.addEventListener("pointerdown", function (e2) { e2.stopPropagation(); }, false);
      del.addEventListener("click", function (e2) {
        e2.stopPropagation(); e2.preventDefault();
        try {
          if (added && eng().removeAddedToken) eng().removeAddedToken(tok.addId);
          else if (eng().deleteToken) eng().deleteToken(tok.rawStartMs);
        } catch (_e) {}
        renderChips();
        toast(lc("Word removed (Save to keep)", "已删字（保存后生效）"));
      }, false);
      chip.appendChild(del);
      chip.style.left = chipBaseLeft(tok) + "px";
      /* W1683 — Jing「删掉细线」: 字下那根竖线(stem)不再入 DOM。它本就是冗余的 ——
       * chip 是 translateX(-50%) 居中的, 它的【中心】就是该字的时间点, 竖线只是重复标注。
       * 仍保留这个游离元素: 整句拖动 / 单字拖动 / 缩放重排都在写 stem.style.left, 留着它
       * 引用不炸, 且不渲染、不占布局(不 appendChild)。 */
      var stem = document.createElement("div");
      stem.style.left = chipBaseLeft(tok) + "px";

      var li = tok.lineIndex;
      if (!linesMap[li]) linesMap[li] = [];
      var rec = { chip: chip, stem: stem, tok: tok };
      linesMap[li].push(rec);
      allRecs.push(rec);

      // CSSOS_WAVE_1049 — Jing「点字进编辑模式才可拖」: 默认点 chip = 选中进入编辑模式(金框),
      //   只有处于编辑模式的字才可拖动对齐。避免误拖; 整句移动改走可见「移动手柄」(见 buildLineHandles)。
      chip.style.cursor = "pointer";
      var dragging = false, startX = 0, baseOff = 0, startLeft = 0, moved = false;
      function enterEdit() {
        if (editingChip && editingChip !== chip) { editingChip.style.outline = ""; editingChip.style.cursor = "pointer"; }
        editingChip = chip; chip.style.outline = "3px solid #fde047"; chip.style.cursor = "ew-resize";
        toast(lc("Edit mode: drag to align this word", "编辑模式:拖动对齐这个字"));
      }
      function exitEdit() { chip.style.outline = ""; chip.style.cursor = "pointer"; if (editingChip === chip) editingChip = null; }
      chip.addEventListener("pointerdown", function (ev) {
        startX = ev.clientX; moved = false; baseOff = tok.tokenOffsetMs; startLeft = parseFloat(chip.style.left) || 0;
        dragging = (editingChip === chip); // 仅编辑模式下本次按下才进入拖动
        try { chip.setPointerCapture(ev.pointerId); } catch (_e) {}
        chip.style.zIndex = "5";
        ev.preventDefault(); ev.stopPropagation();
      }, false);
      chip.addEventListener("pointermove", function (ev) {
        var dx = ev.clientX - startX;
        if (Math.abs(dx) > 4) moved = true;
        if (!dragging || !moved) { return; }
        var newLeft = startLeft + dx;
        chip.style.left = newLeft + "px"; stem.style.left = newLeft + "px";
        var ms = Math.max(-30000, Math.min(30000, baseOff + Math.round((dx / pps) * 1000)));
        tok.tokenOffsetMs = ms;
        try { if (eng().setTokenOffset) eng().setTokenOffset(tok.rawStartMs, ms, { persist: false }); } catch (_e) {}
        ev.preventDefault(); ev.stopPropagation();
      }, false);
      var end = function (ev) {
        chip.style.zIndex = "";
        if (!moved) {
          // 纯点击(没拖动): 切换编辑模式
          if (editingChip === chip) exitEdit(); else enterEdit();
        } else if (dragging) {
          // 拖动结束 → 落盘逐字偏移
          try { if (eng().setTokenOffset) eng().setTokenOffset(tok.rawStartMs, tok.tokenOffsetMs, { persist: true }); } catch (_e) {}
        }
        dragging = false;
        if (ev) { ev.stopPropagation(); }
      };
      chip.addEventListener("pointerup", end, false);
      chip.addEventListener("pointercancel", end, false);
      chipLayer.appendChild(chip);
    }
    // CSSOS_WAVE_1049 — 每句一个可见「移动手柄」(⠿): 拖它 = 整句一起前后移(setLineOffset)。
    //   放在该句最左字上方, 不需 Shift, 触屏/Vision Pro 都好用。
    function buildLineHandles() {
      Object.keys(linesMap).forEach(function (liStr) {
        var li = parseInt(liStr, 10);
        var members = linesMap[li]; if (!members || !members.length) return;
        var minLeft = Math.min.apply(null, members.map(function (m) { return parseFloat(m.chip.style.left) || 0; }));
        var h = document.createElement("div");
        h.textContent = "⠿"; h.title = lc("Drag to move this whole line", "拖动整句移动");
        h.style.cssText = "position:absolute;top:0px;transform:translateX(-50%);pointer-events:auto;cursor:grab;" +
          "background:rgba(56,189,248,0.95);color:#042f2e;font-weight:800;padding:1px 9px;border-radius:6px;" +
          "font-size:13px;user-select:none;touch-action:none;box-shadow:0 1px 5px rgba(0,0,0,0.4)";
        h.style.left = minLeft + "px";
        var dragging = false, startX = 0, baseLefts = null, baseLineOffMs = 0, lastDelta = 0, handleBaseLeft = 0;
        h.addEventListener("pointerdown", function (ev) {
          dragging = true; startX = ev.clientX; lastDelta = 0;
          baseLefts = members.map(function (m) { return parseFloat(m.chip.style.left) || 0; });
          handleBaseLeft = parseFloat(h.style.left) || 0;
          baseLineOffMs = (eng().getLineOffset ? (eng().getLineOffset(li) || 0) : 0);
          members.forEach(function (m) { m.chip.style.outline = "2px solid #38bdf8"; });
          h.style.cursor = "grabbing";
          try { h.setPointerCapture(ev.pointerId); } catch (_e) {}
          ev.preventDefault(); ev.stopPropagation();
        }, false);
        h.addEventListener("pointermove", function (ev) {
          if (!dragging) return;
          var dx = ev.clientX - startX; lastDelta = Math.round((dx / pps) * 1000);
          members.forEach(function (m, k) { var nl = baseLefts[k] + dx; m.chip.style.left = nl + "px"; m.stem.style.left = nl + "px"; });
          h.style.left = (handleBaseLeft + dx) + "px";
          var labs = Math.max(-30000, Math.min(30000, baseLineOffMs + lastDelta));
          try { if (eng().setLineOffset) eng().setLineOffset(li, labs, { persist: false }); } catch (_e) {}
          ev.preventDefault(); ev.stopPropagation();
        }, false);
        var endH = function (ev) {
          if (!dragging) return; dragging = false; h.style.cursor = "grab";
          members.forEach(function (m) { m.chip.style.outline = ""; });
          var labs = Math.max(-30000, Math.min(30000, baseLineOffMs + lastDelta));
          try { if (eng().setLineOffset) eng().setLineOffset(li, labs, { persist: true }); } catch (_e) {}
          if (ev) { ev.stopPropagation(); }
        };
        h.addEventListener("pointerup", endH, false);
        h.addEventListener("pointercancel", endH, false);
        chipLayer.appendChild(h);
      });
    }
    // 重建整层 chip(增删后调用)。从引擎最新 model 取(已反映 add/删)。
    function renderChips() {
      try { var fresh = eng().getEditorModel && eng().getEditorModel(); if (fresh && fresh.tokens) model = fresh; } catch (_e) {}
      chipLayer.innerHTML = ""; linesMap = {}; allRecs = []; editingChip = null;
      (model.tokens || []).forEach(buildChip);
      buildLineHandles();
    }
    renderChips();
    // ＋加字: 在当前播放头位置加一个 token(用于《Jerusalem》间奏拟声词"咿呀")。
    function addTokenAtPlayhead() {
      var au = audioEl(); var t = au ? (au.currentTime || 0) : 0;
      var txt = "";
      try { txt = window.prompt(lc("New word/onomatopoeia at " + t.toFixed(1) + "s (e.g. 咿呀)", "在 " + t.toFixed(1) + "s 处加字/拟声词(如 咿呀)"), ""); } catch (_e) {}
      txt = String(txt == null ? "" : txt).trim();
      if (!txt) return;
      try { if (eng().addToken) eng().addToken({ text: txt, t: t, line: null }); } catch (_e) {}
      renderChips();
      toast(lc("Word added at " + t.toFixed(1) + "s — drag to align, Save to keep", "已在 " + t.toFixed(1) + "s 加字——拖动对齐,保存后生效"));
    }

    // playhead (red bar) — W1049 可拖: hover 显示旋钮+ew-resize, 拖动=暂停并移到该处。
    playhead = document.createElement("div");
    playhead.style.cssText = "position:absolute;top:0;bottom:0;width:2px;background:#f87171;left:0;pointer-events:none;z-index:7";
    var phGrab = document.createElement("div");
    phGrab.title = lc("Drag to move playback position", "拖动调整播放位置");
    phGrab.style.cssText = "position:absolute;top:0;bottom:0;left:-9px;width:20px;cursor:ew-resize;pointer-events:auto";
    var phKnob = document.createElement("div");
    phKnob.style.cssText = "position:absolute;top:2px;left:50%;transform:translateX(-50%);width:15px;height:15px;border-radius:50%;" +
      "background:#f87171;box-shadow:0 1px 5px rgba(0,0,0,0.6);pointer-events:none;transition:transform .12s ease";
    phGrab.appendChild(phKnob);
    phGrab.addEventListener("mouseenter", function () { phKnob.style.transform = "translateX(-50%) scale(1.35)"; });
    phGrab.addEventListener("mouseleave", function () { phKnob.style.transform = "translateX(-50%)"; });
    playhead.appendChild(phGrab);
    strip.appendChild(playhead);
    var phDrag = false;
    phGrab.addEventListener("pointerdown", function (ev) {
      phDrag = true; seeking = true; pausePlayback(); seekToClientX(ev.clientX);
      try { phGrab.setPointerCapture(ev.pointerId); } catch (_e) {}
      ev.preventDefault(); ev.stopPropagation();
    }, false);
    phGrab.addEventListener("pointermove", function (ev) {
      if (!phDrag) return; seekToClientX(ev.clientX); ev.preventDefault(); ev.stopPropagation();
    }, false);
    var phEnd = function (ev) { phDrag = false; seeking = false; if (ev) ev.stopPropagation(); };
    phGrab.addEventListener("pointerup", phEnd, false);
    phGrab.addEventListener("pointercancel", phEnd, false);

    scroller.appendChild(strip);
    overlay.appendChild(scroller);
    (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(overlay);

    // wire header buttons
    var playBtn = head.querySelector('[data-act="play"]');
    head.querySelector('[data-act="close"]').addEventListener("click", function () { close(); });
    head.querySelector('[data-act="save"]').addEventListener("click", function () {
      try { if (eng().saveTokenOffsets) eng().saveTokenOffsets(); } catch (_e) {}
      try { if (eng().saveTokenEdits) eng().saveTokenEdits(); } catch (_e) {} // W1048 — 同存加/删
      toast(lc("Alignment + edits saved", "对齐与增删已保存"));
    });
    // W1048 — ＋加字(播放头) + 双击波形某处加字。
    var addBtn = head.querySelector('[data-act="addtok"]');
    if (addBtn) addBtn.addEventListener("click", function () { addTokenAtPlayhead(); });
    waveWrap.addEventListener("dblclick", function (ev) {
      var rect = strip.getBoundingClientRect();
      var t = Math.max(0, Math.min(dur, (ev.clientX - rect.left + scroller.scrollLeft) / pps));
      var txt = "";
      try { txt = window.prompt(lc("New word at " + t.toFixed(1) + "s (e.g. 咿呀)", "在 " + t.toFixed(1) + "s 处加字(如 咿呀)"), ""); } catch (_e) {}
      txt = String(txt == null ? "" : txt).trim();
      if (!txt) return;
      try { if (eng().addToken) eng().addToken({ text: txt, t: t, line: null }); } catch (_e) {}
      renderChips();
      ev.preventDefault(); ev.stopPropagation();
    }, false);
    playBtn.addEventListener("click", function () {
      var au = audioEl(); if (!au) return;
      if (au.paused) resumePlayback(); else pausePlayback();
    });
    /* W1683 — 标题栏拖拽: 竖向移动整条面板(它本就通栏, 横向无意义)。夹在视口内,
     *   至少留 60px 可抓, 绝不拖出屏幕(面板宪法 Article 2 的边界钳制)。 */
    var titleEl = head.querySelector('[data-act="title"]');
    if (titleEl) {
      var _dragging = false, _sy = 0, _sTop = 0;
      titleEl.addEventListener("pointerdown", function (ev) {
        _dragging = true; _sy = ev.clientY;
        _sTop = overlay.getBoundingClientRect().top;
        try { titleEl.setPointerCapture(ev.pointerId); } catch (_e) {}
        titleEl.style.cursor = "grabbing";
        ev.preventDefault(); ev.stopPropagation();
      });
      titleEl.addEventListener("pointermove", function (ev) {
        if (!_dragging) return;
        var maxTop = Math.max(0, window.innerHeight - 60);
        var t = Math.max(0, Math.min(maxTop, Math.round(_sTop + (ev.clientY - _sy))));
        overlay.style.top = t + "px";
        _moved = true;
        ev.preventDefault();
      });
      var _endDrag = function (ev) {
        if (!_dragging) return;
        _dragging = false; titleEl.style.cursor = "grab";
        try { titleEl.releasePointerCapture(ev.pointerId); } catch (_e) {}
      };
      titleEl.addEventListener("pointerup", _endDrag);
      titleEl.addEventListener("pointercancel", _endDrag);
    }

    /* W1684 — 键盘快捷键(对齐工作最费手: 一手拖字、一手够按钮)。
     *   空格=播/停 · ←→=退/进 0.1s(按住 Shift = 0.02s 精调) · +/−=缩放 · ⌘/Ctrl+S=保存 · Esc=关闭。
     *   捕获阶段绑定, 但遇到输入框/可编辑元素一律让行, 绝不吞用户打字。 */
    function onKey(ev) {
      if (!overlay) return;
      var t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      var au = audioEl(), k = ev.key;
      if (k === " " || k === "Spacebar") {
        ev.preventDefault();
        if (au) { if (au.paused) resumePlayback(); else pausePlayback(); }
      } else if (k === "Escape") {
        ev.preventDefault(); close();
      } else if ((ev.metaKey || ev.ctrlKey) && (k === "s" || k === "S")) {
        ev.preventDefault();
        var sb = head.querySelector('[data-act="save"]'); if (sb) sb.click();
      } else if (k === "ArrowLeft" || k === "ArrowRight") {
        ev.preventDefault();
        var d = (ev.shiftKey ? 0.02 : 0.1) * (k === "ArrowRight" ? 1 : -1);
        if (au) { try { au.currentTime = Math.max(0, Math.min(dur, (au.currentTime || 0) + d)); } catch (_e) {} }
      } else if (k === "+" || k === "=") {
        ev.preventDefault(); relayout(pps * 1.5);
      } else if (k === "-" || k === "_") {
        ev.preventDefault(); relayout(pps / 1.5);
      }
    }
    _onKey = onKey;
    window.addEventListener("keydown", _onKey, true);

    // W1679 — ? 切换说明浮层。
    var helpBtn = head.querySelector('[data-act="help"]');
    if (helpBtn) helpBtn.addEventListener("click", function () {
      var on = hint.style.display === "none";
      hint.style.display = on ? "block" : "none";
      helpBtn.classList.toggle("is-on", on);
    });
    // W1049 — 暂停守卫: 影院音频权威/卡顿看门狗可能偷偷 au.play() 夺回; 用户想停时立刻再停回去,
    //   保证编辑期间"暂停得住"。overlay 已关则失效(close 也会摘除监听, 双保险, 绝不关闭后误停)。
    (function () {
      var au = audioEl(); if (!au) return;
      wantPlaying = !au.paused;
      _guardAu = au;
      _guardFn = function () { if (!overlay) return; if (!wantPlaying) { try { au.pause(); } catch (_e) {} } };
      au.addEventListener("play", _guardFn);
    })();
    // CSSOS_WAVE_1045 v2 — 放慢速度微调: 设 audio.playbackRate。
    // CSSOS_WAVE_1045 v2 — 放慢速度微调: 设 audio.playbackRate。
    function setSpeed(r) {
      var au = audioEl(); if (au) { try { au.playbackRate = r; } catch (_e) {} }
    }
    /* W1686 — active 状态【交给平台工具独占管理】。本文件不再自己 toggle .is-on ——
     * 两套状态并存正是这类组件后来必然回归的根源。工具没加载时退回原生点击兜底。 */
    var speedBar = head.querySelector("#wv-speed");
    if (speedBar && typeof globalThis.cssosMakePillBar === "function") {
      globalThis.cssosMakePillBar(speedBar, {
        compact: true,
        textColor: "light",
        onActivate: function (key) { setSpeed(parseFloat(key) || 1); },
      });
    } else if (speedBar) {
      speedBar.querySelectorAll("[data-pill-key]").forEach(function (b) {
        b.addEventListener("click", function () {
          speedBar.querySelectorAll("[data-pill-key]").forEach(function (o) { o.classList.remove("active"); });
          b.classList.add("active");
          setSpeed(parseFloat(b.getAttribute("data-pill-key")) || 1);
        });
      });
    }
    // 动作条: 只上妆(色相 + 凸侧边界), 不接管点击 —— stampOne 不会加任何 click 监听。
    var actsBar = head.querySelector("#wv-acts");
    if (actsBar && typeof globalThis.cssosPillBarStamp === "function") {
      try { globalThis.cssosPillBarStamp(actsBar, "light"); } catch (_e) {}
    }
    // CSSOS_WAVE_1045 v2 — 对齐循环: 开启时以当前播放头为中心循环一小段(±2.5s), 反复听同一处对齐。
    var loopOn = false, loopA = 0, loopB = 0;
    var loopBtn = head.querySelector('[data-act="loop"]');
    if (loopBtn) loopBtn.addEventListener("click", function () {
      var au = audioEl();
      loopOn = !loopOn;
      loopBtn.classList.toggle("is-on", loopOn);
      if (loopOn && au) {
        var c = au.currentTime || 0;
        loopA = Math.max(0, c - 2.5); loopB = Math.min(dur, c + 2.5);
        try { au.currentTime = loopA; } catch (_e) {}
        resumePlayback(); // 段循环 = 要播放, 设意图防守卫停掉
        toast(lc("Looping a 5s window — drag the waveform to move it", "循环 5 秒小段——拖波形可换位置"));
      }
    });

    // CSSOS_WAVE_1046 — 波形缩放: 改 pps 后等比重排(strip 宽 / 波形 / 每颗 chip+stem),
    //   按 chip 当前像素位 × 比例算新位 → 已拖好的对齐位置零丢失; 播放头由 tick 用新 pps 自动跟。
    function relayout(newPps) {
      newPps = Math.max(40, Math.min(440, newPps));
      if (Math.abs(newPps - pps) < 0.5) return;
      pps = newPps;
      strip.style.width = Math.max(320, Math.round(dur * pps)) + "px";
      try { paintWave(waveWrap, dur, curCurve(), pps); } catch (_e) {}
      // W1049 — 整层重绘(chip+句柄)按新 pps + 引擎最新偏移定位: 缩放后对齐位置/句柄全部精确, 不丢。
      renderChips();
    }
    var zi = head.querySelector('[data-act="zoomin"]'), zo = head.querySelector('[data-act="zoomout"]');
    if (zi) zi.addEventListener("click", function () { relayout(pps * 1.5); });
    if (zo) zo.addEventListener("click", function () { relayout(pps / 1.5); });

    // playhead follow loop + auto-scroll
    function tick() {
      var au = audioEl();
      if (au) {
        // W1049 — 锁死本曲: 影院自动切歌会偷偷清掉 loop, 每帧重新强制; 并在临近结尾手动回卷,
        //   抢在影院 ended/预载切歌之前, 保证微调期间永远是这一首(不会跑到下一首)。
        if (au.loop !== true) { try { au.loop = true; } catch (_e) {} }
        var realDur = (au.duration && isFinite(au.duration) && au.duration > 1) ? au.duration : dur;
        // 对齐循环: 超出 loopB 就回到 loopA
        if (loopOn && au.currentTime >= loopB) { try { au.currentTime = loopA; } catch (_e) {} }
        else if (!loopOn && realDur && au.currentTime >= realDur - 0.45) { try { au.currentTime = 0; } catch (_e) {} }
        var x = Math.round(au.currentTime * pps);
        playhead.style.left = x + "px";
        playBtn.textContent = au.paused ? "▶" : "⏸";
        // keep playhead ~35% from left while playing
        if (!au.paused && !seeking) {
          var target = x - scroller.clientWidth * 0.35;
          scroller.scrollLeft = Math.max(0, target);
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    // initial scroll to current playhead
    try { var au0 = audioEl(); if (au0) scroller.scrollLeft = Math.max(0, au0.currentTime * pps - scroller.clientWidth * 0.35); } catch (_e) {}

    // Esc closes
    setTimeout(function () {
      var onKey = function (ev) { if (ev.key === "Escape") { close(); document.removeEventListener("keydown", onKey, true); } };
      document.addEventListener("keydown", onKey, true);
    }, 0);
  }

  globalThis.cssosOpenWaveEditor = open;
})();
