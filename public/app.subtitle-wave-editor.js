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
  var overlay = null, strip = null, playhead = null, raf = 0, model = null, _restore = null;
  var _guardAu = null, _guardFn = null; // W1049 — 暂停守卫的音频元素 + 回调(close 时摘除)

  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    return (globalThis.currentLocale === "zh") ? zh : en;
  }
  function eng() { return globalThis.cssosEmotionSubtitle; }
  function audioEl() { try { return document.getElementById("watch-audio-preview"); } catch (_e) { return null; } }
  function toast(m) { try { if (typeof globalThis.cssosGuidedToast === "function") globalThis.cssosGuidedToast(m); } catch (_e) {} }

  function close() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
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

  function buildWaveformCanvas(durSec, vc, pps) {
    pps = pps || PX_PER_SEC;
    var w = Math.max(320, Math.round(durSec * pps));
    var h = 120;
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.style.cssText = "display:block;width:" + w + "px;height:" + h + "px";
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "rgba(94,234,212,0.20)";
    if (vc && vc.values && vc.values.length && vc.step_ms > 0) {
      var step = vc.step_ms / 1000; // sec per sample
      var max = 0; for (var i = 0; i < vc.values.length; i++) if (vc.values[i] > max) max = vc.values[i];
      if (max <= 0) max = 1;
      for (var j = 0; j < vc.values.length; j++) {
        var t = j * step;
        var x = Math.round(t * pps);
        var bh = Math.round((vc.values[j] / max) * (h - 8));
        ctx.fillRect(x, (h - bh) / 2, Math.max(1, Math.round(step * pps) - 1), bh);
      }
    } else {
      ctx.fillRect(0, h / 2 - 1, w, 2); // flat baseline if no curve
    }
    return cv;
  }

  function open() {
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
    overlay.style.cssText = "position:fixed;inset:0;z-index:100095;background:rgba(4,12,9,0.96);" +
      "display:flex;flex-direction:column;color:#e8fff7;font-size:14px";
    // swallow all pointer events so cinema swipe/pause never fire underneath
    ["pointerdown", "click", "touchstart", "contextmenu"].forEach(function (ev) {
      overlay.addEventListener(ev, function (e2) { e2.stopPropagation(); }, false);
    });

    // Header
    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;gap:10px;padding:12px 14px;flex:0 0 auto";
    head.innerHTML =
      '<div style="font-weight:700;font-size:16px">🎚 ' + lc("Waveform fine-tune", "波形逐字精修") + '</div>' +
      '<div style="flex:1"></div>' +
      // CSSOS_WAVE_1045 v2 — 放慢速度微调 + 对齐循环
      '<span style="opacity:0.7;font-size:12px;margin-right:2px">' + lc("Speed", "速度") + '</span>' +
      '<button data-spd="0.5" class="cssfx-btn cssfx-spd">0.5×</button>' +
      '<button data-spd="0.75" class="cssfx-btn cssfx-spd">0.75×</button>' +
      '<button data-spd="1" class="cssfx-btn cssfx-spd is-on">1×</button>' +
      '<button data-act="loop" class="cssfx-btn" title="' + lc("Loop just this phrase", "只循环这一句") + '">🔁 ' + lc("Phrase loop", "段循环") + '</button>' +
      // CSSOS_WAVE_1046 — 波形缩放: 拉长/缩短像素密度, 精修时放大、纵览时缩小。
      '<span style="opacity:0.7;font-size:12px;margin:0 -2px 0 4px">' + lc("Zoom", "缩放") + '</span>' +
      '<button data-act="zoomout" class="cssfx-btn" title="' + lc("Shrink waveform", "缩短波形") + '">➖</button>' +
      '<button data-act="zoomin" class="cssfx-btn" title="' + lc("Stretch waveform", "拉长波形") + '">➕</button>' +
      '<button data-act="addtok" class="cssfx-btn" title="' + lc("Add a word at playhead", "在播放头处加字") + '">＋ ' + lc("Add word", "加字") + '</button>' +
      '<button data-act="play" class="cssfx-btn" style="min-width:64px">▶</button>' +
      '<button data-act="save" class="cssfx-btn primary">' + lc("Save", "保存") + '</button>' +
      '<button data-act="close" class="cssfx-btn">✕</button>';
    overlay.appendChild(head);

    var hint = document.createElement("div");
    hint.style.cssText = "padding:0 14px 8px;opacity:0.65;font-size:12px;flex:0 0 auto";
    hint.textContent = lc("Click waveform = move bar there + pause · ▶ to play. Tap a word = edit mode, then drag to align · drag ⠿ handle = move whole line · ✕ = delete · ＋/double-click = add word · ➖➕ zoom · slow + loop for precision. Save when done.",
      "点波形任意处=红条移到该处并暂停,点▶才播放(腾时间微调)。点某个字=进编辑模式再拖对齐 · 拖 ⠿ 手柄=整句移动 · ✕=删字 · ＋或双击=加字(间奏拟声词) · ➖➕缩放 · 放慢+段循环=精修。完成点保存。");
    overlay.appendChild(hint);

    // Scrollable strip
    var scroller = document.createElement("div");
    scroller.style.cssText = "flex:1;overflow-x:auto;overflow-y:hidden;position:relative;-webkit-overflow-scrolling:touch";
    strip = document.createElement("div");
    strip.style.cssText = "position:relative;height:100%;min-height:220px;width:" +
      Math.max(320, Math.round(dur * pps)) + "px";
    // waveform
    var waveWrap = document.createElement("div");
    waveWrap.style.cssText = "position:absolute;left:0;right:0;top:90px;height:120px";
    waveWrap.appendChild(buildWaveformCanvas(dur, model.volCurve, pps));
    strip.appendChild(waveWrap);
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
    function pausePlayback() {
      wantPlaying = false;
      var au = audioEl(); if (au) { try { au.pause(); } catch (_e) {} }
    }
    function resumePlayback() {
      wantPlaying = true;
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
      chip.style.cssText = "position:absolute;top:30px;transform:translateX(-50%);pointer-events:auto;" +
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
      var stem = document.createElement("div");
      stem.style.cssText = "position:absolute;top:58px;width:2px;height:34px;pointer-events:none;transform:translateX(-50%);" +
        "background:" + (added ? "rgba(251,146,60,0.7)" : "rgba(94,234,212,0.6)");
      stem.style.left = chipBaseLeft(tok) + "px";
      chipLayer.appendChild(stem);

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
        h.style.cssText = "position:absolute;top:6px;transform:translateX(-50%);pointer-events:auto;cursor:grab;" +
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
    function setSpeed(r) {
      var au = audioEl(); if (au) { try { au.playbackRate = r; } catch (_e) {} }
      try {
        head.querySelectorAll(".cssfx-spd").forEach(function (b) {
          b.classList.toggle("is-on", Math.abs(parseFloat(b.getAttribute("data-spd")) - r) < 0.001);
        });
      } catch (_e) {}
    }
    head.querySelectorAll(".cssfx-spd").forEach(function (b) {
      b.addEventListener("click", function () { setSpeed(parseFloat(b.getAttribute("data-spd")) || 1); });
    });
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
      try { waveWrap.innerHTML = ""; waveWrap.appendChild(buildWaveformCanvas(dur, model.volCurve, pps)); } catch (_e) {}
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
