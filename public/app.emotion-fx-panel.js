/* CSSOS_WAVE_668 #44 — 情绪字幕特效【拉杆小窗】(在哪里用在哪里改).
 * 右击(或长按)「多语言/多声线」胶囊条 #watch-language-pill → 弹出拉杆面板:
 *   - 拉杆即调即生效(用户偏好, 本人)。
 *   - 每根拉杆有【中位刻度 = 平台默认】(管理员设的值)。
 *   - 「设为平台默认」按钮: 管理员把当前值存为全平台默认(后端 session 鉴权; 非管理员 → 提示)。
 *   - 「恢复默认」: 清掉本人覆盖, 回到平台默认。
 */
(function () {
  "use strict";
  var SLIDERS = [
    { key: "pitchSpread", label: "音高旋律浮动", min: 0, max: 40, step: 1, unit: "px" },
    { key: "bounce", label: "每字蹦动", min: 0, max: 0.8, step: 0.02 },
    { key: "lift", label: "每字上跳", min: 0, max: 24, step: 1, unit: "px" },
    { key: "burstThreshold", label: "爆字阈值(越低越多)", min: 0.4, max: 1, step: 0.02 },
    { key: "burstScale", label: "爆字放大", min: 1, max: 3, step: 0.05, unit: "×" },
    { key: "flash", label: "全屏闪强度", min: 0, max: 1, step: 0.02 }
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
        '<span class="cssfx-row-top"><span class="cssfx-lbl">' + s.label + '</span>' +
        '<span class="cssfx-val">' + v.toFixed(s.step < 0.1 ? 2 : (s.step < 1 ? 2 : 0)) + (s.unit || "") + '</span></span>' +
        '<span class="cssfx-track"><span class="cssfx-mid" style="left:' + midPct.toFixed(1) + '%" title="平台默认"></span>' +
        '<input type="range" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + v + '"></span>' +
        '</label>';
    }).join("");
    var fsOn = !!effVal("fullscreen", hard.fullscreen ? 1 : 0);
    pop.innerHTML =
      '<div class="cssfx-head">情绪字幕特效</div>' +
      '<label class="cssfx-toggle" style="font-weight:700;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:8px;margin-bottom:4px"><input type="checkbox" ' + (TT.master !== false ? "checked" : "") + ' data-tog="master"> 🎆 情绪字幕(关闭=只留普通字幕)</label>' +
      rows +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (fsOn ? "checked" : "") + ' data-key="fullscreen"> 全屏爆闪</label>' +
      // CSSOS_WAVE_715 — 新开关
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.center !== false ? "checked" : "") + ' data-tog="center"> 中央爆</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.confetti === true ? "checked" : "") + ' data-tog="confetti"> 天女散花(从天而降·默认关)</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.musicgap !== false ? "checked" : "") + ' data-tog="musicgap"> 器乐段 emoji(前奏/间奏)</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.randomcolor !== false ? "checked" : "") + ' data-tog="randomcolor"> 底部字幕随机色(每次播放一对)</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.burstcolor !== false ? "checked" : "") + ' data-tog="burstcolor"> 爆字随机色(每字不同)</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.burstpunch !== false ? "checked" : "") + ' data-tog="burstpunch"> 爆字放大→收回</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.sizebyemotion !== false ? "checked" : "") + ' data-tog="sizebyemotion"> 字号随情绪(每字不同)</label>' +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (TT.demo === true ? "checked" : "") + ' data-tog="demo"> 每字都爆(演示)</label>' +
      '<button type="button" class="cssfx-btn" data-act="reroll" style="width:100%;margin-top:8px">🎨 字幕换一对随机色</button>' +
      '<div class="cssfx-actions">' +
        '<button type="button" class="cssfx-btn" data-act="reset">恢复默认</button>' +
        '<button type="button" class="cssfx-btn primary" data-act="platform">设为平台默认</button>' +
      '</div>' +
      '<div class="cssfx-hint">拉杆即调即生效(本人偏好)。中线 = 平台默认。</div>';
    document.body.appendChild(pop);

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
            toast("✅ 已设为全平台默认");
          } else {
            toast(res.j && res.j.code === "ADMIN_ONLY" ? "仅管理员可设平台默认" : "保存失败");
          }
        }).catch(function () { toast("网络错误, 未保存"); });
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
  function ensureFxGear() {
    try {
      var bar = document.getElementById("watch-language-pill");
      if (!bar || bar.querySelector(".cssfx-fx-gear")) return;
      var g = document.createElement("button");
      g.type = "button";
      g.className = "cssfx-fx-gear";
      g.textContent = "⚙";
      g.title = "情绪字幕设置";
      g.setAttribute("aria-label", "情绪字幕设置");
      // CSSOS_WAVE_754b — Jing「套上胶囊风格即可」。最干净做法: 不自带任何底色/边框/mask,
      // 只留 order:-1 置首 → 让【胶囊宪法 .cssmv-pill-bar > *】完全接管(透明融入轨道绿、同高 40px、
      // 同内距、hover 自动变色; 且作为"激活前一颗"被宪法 *:has(~.active) 自动右侧凹咬, 包住 Languages)。
      // 绝不自加 mask 碗口(=W753 透明轨道元凶)。color 给浅色保证图标在绿轨道上可见。
      g.style.cssText = "order:-1;color:#eafff6;font-size:15px;line-height:1;cursor:pointer;flex:0 0 auto;";
      ["pointerdown", "mousedown", "touchstart", "contextmenu"].forEach(function (ev) {
        g.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
      });
      g.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();   // 不冒泡 → 不暂停媒体
        openFor(bar);
      }, false);
      bar.insertBefore(g, bar.firstChild);   // W754 — DOM 也置首(配合 order:-1 双保险)
    } catch (_e) {}
  }
  setInterval(ensureFxGear, 1500);
  ensureFxGear();
})();
