/* CSSOS_WAVE_668 #44 — 情绪字幕特效【拉杆小窗】(在哪里用在哪里改).
 * 右击(或长按)「多语言/多声线」胶囊条 #watch-language-pill → 弹出拉杆面板:
 *   - 拉杆即调即生效(用户偏好, 本人)。
 *   - 每根拉杆有【中位刻度 = 平台默认】(管理员设的值)。
 *   - 「设为平台默认」按钮: 管理员把当前值存为全平台默认(后端 session 鉴权; 非管理员 → 提示)。
 *   - 「恢复默认」: 清掉本人覆盖, 回到平台默认。
 */
(function () {
  "use strict";
  // CSSOS_WAVE_926 20260617 — Jing「中文硬编码」根治(i18n 铁律): 本面板原全中文, iPad Safari
  // (苹果审核环境)非 zh locale 露中文 = 拒因。改: 所有用户可见文案走 lc(en, zh), 默认英文。
  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    try { var l = (navigator.language || "en").toLowerCase(); if (l.indexOf("zh") === 0 && zh) return zh; } catch (_e) {}
    return en;
  }
  var SLIDERS = [
    { key: "pitchSpread", en: "Pitch melody drift", zh: "音高旋律浮动", min: 0, max: 40, step: 1, unit: "px" },
    { key: "bounce", en: "Per-word bounce", zh: "每字蹦动", min: 0, max: 0.8, step: 0.02 },
    { key: "lift", en: "Per-word lift", zh: "每字上跳", min: 0, max: 24, step: 1, unit: "px" },
    { key: "burstThreshold", en: "Burst threshold (lower = more)", zh: "爆字阈值(越低越多)", min: 0.4, max: 1, step: 0.02 },
    { key: "burstScale", en: "Burst scale", zh: "爆字放大", min: 1, max: 3, step: 0.05, unit: "×" },
    { key: "flash", en: "Fullscreen flash strength", zh: "全屏闪强度", min: 0, max: 1, step: 0.02 }
  ];
  var pop = null;

  // CSSOS_WAVE_715 — 新增开关参数(中央爆/天女散花/每字都爆)。这几个是 emotion-fx 的全局开关,
  // 自身不持久化, 这里统一记 localStorage 并启动时应用。
  var K_TOG = "cssos.emotionfx.toggles";
  function readTog() { try { var v = JSON.parse(localStorage.getItem(K_TOG) || "{}"); return (v && typeof v === "object") ? v : {}; } catch (e) { return {}; } }
  function applyTog() {
    var t = readTog();
    // W725 — 情绪字幕【主开关】(默认开)。关 = 关掉全部情绪特效(爆/emoji/烟花/闪/边框飘进), 只留普通卡拉OK字幕。
    globalThis.cssosEmotionSubtitlesOff = (t.master === false);
    if (t.center === false) globalThis.cssosEmotionCenter = false; else globalThis.cssosEmotionCenter = undefined;
    globalThis.cssosConfettiTopDown = (t.confetti === true);   // W726 — 天女散花(从天而降)默认关, 用户可开
    if (t.musicgap === false) globalThis.cssosMusicGapEmoji = false; else globalThis.cssosMusicGapEmoji = undefined;
    globalThis.cssosBurstDemo = (t.demo === true);
    // W729 — 三个新参数(默认开)
    globalThis.cssosSubRandomColor = (t.randomcolor !== false); // 底部卡拉OK字幕: 每次播放一对随机色
    globalThis.cssosBurstScalePunch = (t.burstpunch !== false);
    globalThis.cssosSubSizeByEmotion = (t.sizebyemotion !== false);
    // W731r — 中央爆大字: 每字随机色(默认开)
    globalThis.cssosBurstCharColor = (t.burstcolor !== false);
  }
  function setTog(k, on) { var t = readTog(); t[k] = on; try { localStorage.setItem(K_TOG, JSON.stringify(t)); } catch (e) {} applyTog(); }
  applyTog();

  function fxLayers() {
    try { return globalThis.cssosEmotionFXLayers ? globalThis.cssosEmotionFXLayers() : null; } catch (e) { return null; }
  }
  function platformVal(key, hard) {
    var L = fxLayers();
    if (L && L.platform && L.platform[key] != null) return Number(L.platform[key]);
    return Number(hard);
  }
  function effVal(key, hard) {
    var L = fxLayers();
    if (L && L.effective && L.effective[key] != null) return Number(L.effective[key]);
    return Number(hard);
  }

  function close() { if (pop) { try { pop.remove(); } catch (e) {} pop = null; } }

  function toast(msg) {
    try { if (typeof globalThis.cssosGuidedToast === "function") return globalThis.cssosGuidedToast(msg); } catch (e) {}
    try { console.log("[emotion-fx]", msg); } catch (e) {}
  }

  function build(anchorRect) {
    close();
    var hard = (globalThis.cssosEmotionFXDefaultsHardcoded ? globalThis.cssosEmotionFXDefaultsHardcoded() : {});
    pop = document.createElement("div");
    pop.className = "cssfx-panel";
    pop.setAttribute("role", "dialog");
    var TT = readTog();
    // W725 — 主开关放面板最顶, 一眼可关。
    // CSSOS_WAVE_715 铁律(Jing): MV 面板任何操作不触发媒体暂停 → 弹窗吞掉所有指针事件, 绝不冒泡。
    ["pointerdown", "mousedown", "click", "touchstart", "contextmenu"].forEach(function (ev) {
      pop.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
    });
    var rows = SLIDERS.map(function (s) {
      var v = effVal(s.key, hard[s.key]);
      var mid = platformVal(s.key, hard[s.key]);
      var midPct = ((mid - s.min) / (s.max - s.min) * 100);
      return '<label class="cssfx-row" data-key="' + s.key + '">' +
        '<span class="cssfx-row-top"><span class="cssfx-lbl">' + lc(s.en, s.zh) + '</span>' +
        '<span class="cssfx-val">' + v.toFixed(s.step < 0.1 ? 2 : (s.step < 1 ? 2 : 0)) + (s.unit || "") + '</span></span>' +
        '<span class="cssfx-track"><span class="cssfx-mid" style="left:' + midPct.toFixed(1) + '%" title="' + lc("Platform default", "平台默认") + '"></span>' +
        '<input type="range" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + v + '"></span>' +
        '</label>';
    }).join("");
    var fsOn = !!effVal("fullscreen", hard.fullscreen ? 1 : 0);
    pop.innerHTML =
      '<div class="cssfx-head">' + lc("Emotion subtitle FX", "情绪字幕特效") + '</div>' +
      '<label class="cssfx-toggle" style="font-weight:700;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:8px;margin-bottom:4px"><input type="checkbox" ' + (TT.master !== false ? "checked" : "") + ' data-tog="master"> 🎆 ' + lc("Emotion subtitles (off = plain subtitles only)", "情绪字幕(关闭=只留普通字幕)") + '</label>' +
      rows +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (fsOn ? "checked" : "") + ' data-key="fullscreen"> ' + lc("Fullscreen flash", "全屏爆闪") + '</label>' +
      // CSSOS_WAVE_715 — 新开关
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.center !== false ? "checked" : "") + ' data-tog="center"> ' + lc("Center burst", "中央爆") + '</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.confetti === true ? "checked" : "") + ' data-tog="confetti"> ' + lc("Petal rain (top-down · off by default)", "天女散花(从天而降·默认关)") + '</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.musicgap !== false ? "checked" : "") + ' data-tog="musicgap"> ' + lc("Instrumental emoji (intro/interlude)", "器乐段 emoji(前奏/间奏)") + '</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.randomcolor !== false ? "checked" : "") + ' data-tog="randomcolor"> ' + lc("Bottom subtitle random color (a pair per play)", "底部字幕随机色(每次播放一对)") + '</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.burstcolor !== false ? "checked" : "") + ' data-tog="burstcolor"> ' + lc("Burst random color (per word)", "爆字随机色(每字不同)") + '</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.burstpunch !== false ? "checked" : "") + ' data-tog="burstpunch"> ' + lc("Burst scale-up → settle", "爆字放大→收回") + '</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.sizebyemotion !== false ? "checked" : "") + ' data-tog="sizebyemotion"> ' + lc("Font size by emotion (per word)", "字号随情绪(每字不同)") + '</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.demo === true ? "checked" : "") + ' data-tog="demo"> ' + lc("Burst every word (demo)", "每字都爆(演示)") + '</label>' +
      // CSSOS_WAVE_994 — Jing「字幕整体偏移微调(第一期)」: drag the whole subtitle
      // track earlier(−)/later(+) until it hugs the vocal. Live + saved per work.
      '<label class="cssfx-row cssfx-suboffset" style="border-top:1px solid rgba(255,255,255,0.12);padding-top:8px;margin-top:4px">' +
        '<span class="cssfx-row-top"><span class="cssfx-lbl">⏱ ' + lc("Subtitle sync (subtitles early ◂ / late ▸)", "字幕对齐(早了 ◂ / 晚了 ▸)") + '</span>' +
        '<span class="cssfx-val" data-suboff-val>0.00s</span></span>' +
        '<span class="cssfx-track"><span class="cssfx-mid" style="left:50%" title="0"></span>' +
        '<input type="range" min="-3000" max="3000" step="50" value="0" data-suboff></span>' +
      '</label>' +
      // CSSOS_WAVE_995 — per-line live tuning: turn on, then drag a subtitle line
      // ◂ ▸ during playback to hug the vocal (saved per line). Beyond the global
      // slider above — most fixes are per-line nudges, not whole-track shifts.
      '<label class="cssfx-toggle"><input type="checkbox" ' + (globalThis.cssosSubtitleTuneMode ? "checked" : "") + ' data-tog="subtune"> ✎ ' + lc("Subtitle fine-tune (drag each line to the vocal)", "字幕微调(拖每句对齐歌声)") + '</label>' +
      // CSSOS_WAVE_996 — open the waveform per-word editor (precision: drag each字 onto its onset).
      '<button type="button" class="cssfx-btn" data-act="waveedit" style="width:100%;margin-top:4px">🎚 ' + lc("Waveform fine-tune (per word)", "波形逐字精修") + '</button>' +
      '<button type="button" class="cssfx-btn" data-act="reroll" style="width:100%;margin-top:8px">🎨 ' + lc("Reroll subtitle color pair", "字幕换一对随机色") + '</button>' +
      '<div class="cssfx-actions">' +
        '<button type="button" class="cssfx-btn" data-act="reset">' + lc("Reset to default", "恢复默认") + '</button>' +
        '<button type="button" class="cssfx-btn primary" data-act="platform">' + lc("Set as platform default", "设为平台默认") + '</button>' +
      '</div>' +
      '<div class="cssfx-hint">' + lc("Drag to apply live (your preference). Midline = platform default.", "拉杆即调即生效(本人偏好)。中线 = 平台默认。") + '</div>';
    // CSSOS_WAVE_850 — Jing「真全屏被挡住, 退出才显示」: 原生全屏只渲染全屏元素子树, 挂 body 的
    // 弹层被剔除。改挂【全屏元素】(在全屏子树内→可见); 非全屏挂 body。同 W741。
    (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(pop);

    // 定位: 锚点上方, 不出屏。
    var pr = pop.getBoundingClientRect();
    var top = Math.max(8, (anchorRect ? anchorRect.top : 80) - pr.height - 10);
    var left = Math.min(Math.max(8, (anchorRect ? anchorRect.left : 12)), window.innerWidth - pr.width - 8);
    pop.style.top = top + "px";
    pop.style.left = left + "px";

    // 拉杆联动。
    SLIDERS.forEach(function (s) {
      var row = pop.querySelector('.cssfx-row[data-key="' + s.key + '"]');
      if (!row) return;
      var input = row.querySelector("input");
      var valEl = row.querySelector(".cssfx-val");
      input.addEventListener("input", function () {
        var nv = Number(input.value);
        valEl.textContent = nv.toFixed(s.step < 1 ? 2 : 0) + (s.unit || "");
        var patch = {}; patch[s.key] = nv;
        try { globalThis.cssosSetEmotionFX(patch); } catch (e) {}
      });
    });
    var fsBox = pop.querySelector('input[data-key="fullscreen"]');
    if (fsBox) fsBox.addEventListener("change", function () { try { globalThis.cssosSetEmotionFX({ fullscreen: fsBox.checked }); } catch (e) {} });

    // CSSOS_WAVE_715 — 新开关接线(即时生效 + 落盘)。
    ["master", "center", "confetti", "musicgap", "randomcolor", "burstcolor", "burstpunch", "sizebyemotion", "demo"].forEach(function (k) {
      var box = pop.querySelector('input[data-tog="' + k + '"]');
      if (box) box.addEventListener("change", function () { setTog(k, box.checked); });
    });
    // CSSOS_WAVE_994 — subtitle-sync slider: live on drag (no save), persist on
    // release. Reads the work's saved offset so it opens at the current value.
    var offIn = pop.querySelector('input[data-suboff]');
    var offVal = pop.querySelector('[data-suboff-val]');
    if (offIn) {
      var eng = globalThis.cssosEmotionSubtitle;
      var fmtOff = function (ms) { var s = ms / 1000; return (s > 0 ? "+" : "") + s.toFixed(2) + "s"; };
      var cur = 0;
      try { cur = (eng && typeof eng.getOffsetMs === "function") ? eng.getOffsetMs() : 0; } catch (e) {}
      offIn.value = String(cur);
      if (offVal) offVal.textContent = fmtOff(cur);
      offIn.addEventListener("input", function () {
        var ms = Number(offIn.value) || 0;
        if (offVal) offVal.textContent = fmtOff(ms);
        try { if (eng && eng.setOffset) eng.setOffset(ms, { persist: false }); } catch (e) {}
      });
      offIn.addEventListener("change", function () {
        var ms = Number(offIn.value) || 0;
        try { if (eng && eng.setOffset) eng.setOffset(ms, { persist: true }); } catch (e) {}
        try { if (typeof globalThis.cssosGuidedToast === "function") globalThis.cssosGuidedToast(lc("Subtitle sync saved", "字幕对齐已保存")); } catch (e) {}
      });
    }
    // CSSOS_WAVE_995 — subtitle fine-tune mode (transient, session-only).
    var stBox = pop.querySelector('input[data-tog="subtune"]');
    if (stBox) stBox.addEventListener("change", function () {
      try { if (typeof globalThis.cssosSetSubtitleTuneMode === "function") globalThis.cssosSetSubtitleTuneMode(stBox.checked); else globalThis.cssosSubtitleTuneMode = stBox.checked; } catch (e) {}
    });
    // CSSOS_WAVE_996 — open the waveform per-word editor (closes this popover first).
    var weBtn = pop.querySelector('[data-act="waveedit"]');
    if (weBtn) weBtn.addEventListener("click", function () {
      close();
      try { if (typeof globalThis.cssosOpenWaveEditor === "function") globalThis.cssosOpenWaveEditor(); } catch (e) {}
    });
    var rrBtn = pop.querySelector('[data-act="reroll"]');
    if (rrBtn) rrBtn.addEventListener("click", function () { try { if (typeof globalThis.cssosRollSubtitleColors === "function") globalThis.cssosRollSubtitleColors(); } catch (e) {} });

    pop.querySelector('[data-act="reset"]').addEventListener("click", function () {
      try { globalThis.cssosResetEmotionFX(); } catch (e) {}
      try { localStorage.removeItem(K_TOG); } catch (e) {} applyTog();  // W715 也重置新开关
      var r0 = anchorRect; close(); build(r0);  // 重建以反映回退后的值
    });
    pop.querySelector('[data-act="platform"]').addEventListener("click", function () {
      var L = fxLayers();
      var eff = (L && L.effective) ? L.effective : {};
      fetch("/api/emotion-fx-defaults", {
        method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaults: eff })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j && res.j.ok) {
            try { globalThis.cssosSetEmotionPlatformDefaults(res.j.defaults || eff); } catch (e) {}
            toast("✅ " + lc("Set as platform default for everyone", "已设为全平台默认"));
          } else {
            toast(res.j && res.j.code === "ADMIN_ONLY" ? lc("Admins only can set the platform default", "仅管理员可设平台默认") : lc("Save failed", "保存失败"));
          }
        }).catch(function () { toast(lc("Network error — not saved", "网络错误, 未保存")); });
    });

    // 点外部 / Esc 关闭。
    setTimeout(function () {
      var onDoc = function (ev) { if (pop && !pop.contains(ev.target)) { close(); document.removeEventListener("pointerdown", onDoc, true); } };
      document.addEventListener("pointerdown", onDoc, true);
      var onKey = function (ev) { if (ev.key === "Escape") { close(); document.removeEventListener("keydown", onKey, true); } };
      document.addEventListener("keydown", onKey, true);
    }, 0);
  }

  function openFor(target) {
    var rect = null; try { rect = target.getBoundingClientRect(); } catch (e) {}
    build(rect);
  }

  // 委托绑定: #watch-language-pill 是动态创建的, 用文档级捕获判断命中。
  document.addEventListener("contextmenu", function (ev) {
    var bar = ev.target && ev.target.closest && ev.target.closest("#watch-language-pill");
    if (!bar) return;
    ev.preventDefault();
    ev.stopPropagation();   // CSSOS_WAVE_715 — 绝不冒泡 → 不触发媒体暂停
    openFor(bar);
  }, true);

  // 触屏长按(550ms)。
  var lpTimer = null, lpTarget = null;
  document.addEventListener("touchstart", function (ev) {
    var bar = ev.target && ev.target.closest && ev.target.closest("#watch-language-pill");
    if (!bar) return;
    lpTarget = bar;
    lpTimer = setTimeout(function () { if (lpTarget) openFor(lpTarget); }, 550);
  }, { capture: true, passive: true });
  ["touchend", "touchmove", "touchcancel"].forEach(function (evt) {
    document.addEventListener(evt, function () { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }, { capture: true, passive: true });
  });

  globalThis.cssosOpenEmotionFXPanel = function () { var b = document.getElementById("watch-language-pill"); openFor(b || document.body); };

  /* CSSOS_WAVE_731t 20260612 — Jing「右击难(被视频层遮住, 触屏也没右键)」: 给「多语言/多声线」
   * 胶囊条加一个【可见 ⚙ 按钮, 左键一点即开】情绪字幕设置面板(右击 + 长按仍保留)。胶囊是动态
   * 创建的, 用轻量轮询(幂等)确保 ⚙ 始终在。所有事件 stopPropagation → 绝不冒泡触发媒体暂停。 */
  // CSSOS_WAVE_1109 20260622 — Jing: 这条轨道做成【四胶囊】= ⚙设置 / ✎微调 / 🌐多语言 / 🎤多声线。
  //   ⚙ 与 ✎ 都照 W754 同款机制(非 .cssos-mode-cap → 不进 paintConcave 凹咬数学, 零几何风险),
  //   靠 order 置于多语言/多声线之前。i18n 走本文件统一 lc()(绝不硬编码)。
  //   B: ⚙ 补「设置」文字(原来只有图标, 用户几乎不知道点哪)。
  //   C: ✎微调 提为独立胶囊, 直开波形逐字精修(cssosOpenWaveEditor), 不可用则退回 FX 面板。
  function makeCapButton(cls, ico, label, title, order, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls + " cssos-cc-right";
    b.innerHTML = '<span class="cssfx-cap-ico">' + ico + '</span>' +
      '<span class="cssfx-cap-lbl" style="font-size:11px;margin-left:4px;font-weight:600;">' + label + '</span>';
    b.title = title;
    b.setAttribute("aria-label", title);
    b.style.cssText = "order:" + order + ";color:#eafff6;font-size:13px;line-height:1;cursor:pointer;flex:0 0 auto;display:inline-flex;align-items:center;";
    ["pointerdown", "mousedown", "touchstart", "contextmenu"].forEach(function (ev) {
      b.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
    });
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); onClick(); }, false);
    return b;
  }
  function ensureFxGear() {
    try {
      var bar = document.getElementById("watch-language-pill");
      if (!bar) return;
      // ⚙ 设置(order:-2 → 最左)
      if (!bar.querySelector(".cssfx-fx-gear")) {
        var g = makeCapButton("cssfx-fx-gear", "⚙", lc("Settings", "设置"),
          lc("Emotion subtitle settings", "情绪字幕设置"), -2, function () { openFor(bar); });
        bar.insertBefore(g, bar.firstChild);
      }
      // ✎ 微调(order:-1 → ⚙ 之后、多语言之前)→ 直开波形逐字精修
      if (!bar.querySelector(".cssfx-fx-tune")) {
        var t = makeCapButton("cssfx-fx-tune", "✎", lc("Fine-tune", "微调"),
          lc("Subtitle fine-tune (per word) · T", "字幕逐字微调 · T"), -1, function () {
            try {
              if (typeof globalThis.cssosOpenWaveEditor === "function") globalThis.cssosOpenWaveEditor();
              else openFor(bar);
            } catch (_e) { openFor(bar); }
          });
        var gear = bar.querySelector(".cssfx-fx-gear");
        if (gear && gear.nextSibling) bar.insertBefore(t, gear.nextSibling);
        else bar.insertBefore(t, bar.firstChild);
      }
    } catch (_e) {}
  }
  setInterval(ensureFxGear, 1500);
  ensureFxGear();
})();
