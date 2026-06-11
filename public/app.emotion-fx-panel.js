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
      rows +
      '<label class="cssfx-toggle"><input type="checkbox" ' + (fsOn ? "checked" : "") + ' data-key="fullscreen"> 全屏爆闪</label>' +
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

    pop.querySelector('[data-act="reset"]').addEventListener("click", function () {
      try { globalThis.cssosResetEmotionFX(); } catch (e) {}
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
})();
