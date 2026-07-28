/* CSSOS_WAVE_587 20260602 — Jing「在所有需要输入信息的万能入口都显示『我的声线』」。
 * 集中注入器: 往创建台 / 高级设置 / 人物 MV 等入口插一个「🎙️ 用我的声音唱」按钮 → 打开个人声纹管理器。
 * 幂等(已插不再插), 随面板动态出现自动补插(MutationObserver + 兜底轮询)。 */
(function () {
  "use strict";
  if (globalThis.__cssosMyVoiceEntryWired) return;
  globalThis.__cssosMyVoiceEntryWired = true;

  // CSSOS_WAVE_587 — 白天主题文字看不清修复: 默认深色主题用浅字; 白天主题用深绿字 + 浅绿底。
  (function injectStyle() {
    if (document.getElementById("cssos-myvoice-entry-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-myvoice-entry-style";
    st.textContent = [
      "html[data-theme=\"light\"] .cssos-myvoice-entry,body[data-theme=\"light\"] .cssos-myvoice-entry{",
      "color:#0a6b46 !important;background:hsla(155,70%,42%,0.14) !important;border-color:hsla(155,55%,38%,0.6) !important;}",
      "html[data-theme=\"light\"] .cssos-myvoice-entry:hover,body[data-theme=\"light\"] .cssos-myvoice-entry:hover{background:hsla(155,70%,42%,0.22) !important;}"
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  })();

  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    try { return String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0 ? zh : en; } catch (_e) { return en; }
  }
  function openMgr() {
    if (typeof globalThis.cssosOpenMyVoicesModal === "function") globalThis.cssosOpenMyVoicesModal();
    else if (typeof globalThis.cssosOpenVoiceCloneModal === "function") globalThis.cssosOpenVoiceCloneModal();
  }
  function makeBtn() {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "cssos-myvoice-entry";
    b.textContent = "🎙️ " + lc("Sing in my voice", "用我的声音唱");
    b.style.cssText = "display:inline-flex;align-items:center;gap:6px;margin:8px 0;padding:8px 14px;border:1px solid hsla(155,100%,68%,0.45);border-radius:999px;background:hsla(155,68%,40%,0.18);color:#eafff6;font:600 12.5px/1 inherit;cursor:pointer;";
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openMgr(); }, false);
    return b;
  }

  // 各入口: find=找锚点; place=插法。已插标记在锚点最近容器上。
  var TARGETS = [
    /* CSSOS_WAVE_1768 — Jing「图4: 声线输入旁乱入一个 Sing in my voice, 删除掉」。
     * 移除 creation 入口(原插在 #creation-vocal-style 之后): 高级设置的「多语言声轨」排里
     * 第一颗本就是 🎙️ My Voice(injectLangRow 插的), 声线输入旁再来一颗纯属重复 —— 与下方
     * W1693 撤掉标题上那颗声线胶囊同理。
     *   移除: { key:"creation", find:()=>#creation-vocal-style 的 label, place:"after" } */
    /* CSSOS_WAVE_1693 — Jing「撤掉标题上的声线胶囊, 下面已经有一个, 重复」。
     * 高级设置里「多语言声轨」那排的第一颗本来就是 🎙️ My Voice(W587 的 injectLangRow 插的),
     * 面板顶部再飘一颗纯属重复。这跟 W587 自己那句注释("别让它孤单飘在上面, 跟语言胶囊在一起")
     * 是同一条道理 —— 当时只是漏删了这个入口。
     *   移除: { key: "settings", find: () => #settings-panel, place: "prepend-body" } */
    // 人物 MV: 第一块 shelf 之前。
    { key: "personmv", find: function () { return document.querySelector('[data-shelf^="person-mv"], [id^="person-mv-"]'); }, place: "before" },
    // (MV Pipeline 的「我的声线」改为插进语言胶囊排做第 1 颗 —— 见 injectLangRow, 不再单独飘在面板顶部。)
  ];

  // CSSOS_WAVE_587 — Jing「别让它孤单飘在上面, 跟语言胶囊在一起」: 把「🎙️ 我的声线」做成和语言同款胶囊,
  // 插进每个语言选择网格(MV Pipeline / 加语言弹窗 / 人物 MV)的【第一颗】。picker 重渲会清空 → 这里自动补回首位。
  function injectLangRow() {
    [].forEach.call(document.querySelectorAll(".cssos-lang-picker-grid"), function (grid) {
      try {
        if (grid.querySelector(":scope > .cssos-myvoice-cell")) return; // 已在(且重渲后会被清掉, 不在就补)
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cssos-lang-cell cssos-myvoice-cell";
        // CSSOS_WAVE_1734 — 语言胶囊排改走平台 data-pill-bar 工具 → 首颗「My Voice」也得带 data-pill-key
        // 才吃得到宪法胶囊皮(否则 [data-pill-bar]>[data-pill-key] 选择器命不中它, 变成裸按钮)。
        // 它排在第 0 位 → paintPillBar 给它谱色 index 0 = 155 = 品牌绿, 正合「My Voice 保持品牌绿」。
        cell.setAttribute("data-pill-key", "myvoice");
        cell.innerHTML = '<span class="cssos-myvoice-ico">🎙️</span><span class="cssos-lang-name" style="opacity:1;transform:none;">' + lc("My Voice", "我的声线") + "</span>";
        cell.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openMgr(); }, false);
        grid.insertBefore(cell, grid.firstChild);
        // 插入首颗后, 若 picker 暴露了重绘钩子, 立刻让整条轨道重算谱色/凹咬(把 My Voice 纳入镶嵌)。
        try { if (typeof grid.__cssosPillPaint === "function") grid.__cssosPillPaint(); } catch (_e) {}
      } catch (_e) {}
    });
  }

  function injectAll() {
    TARGETS.forEach(function (t) {
      try {
        var anchor = t.find();
        if (!anchor) return;
        // 幂等: 用一个就近标记防重复。
        var scope = (t.place === "prepend-body" || t.place === "before") ? anchor.parentElement || anchor : anchor.parentElement;
        if (!scope) scope = anchor;
        if (scope.querySelector(":scope > .cssos-myvoice-entry") || (anchor.previousElementSibling && anchor.previousElementSibling.classList && anchor.previousElementSibling.classList.contains("cssos-myvoice-entry"))) return;
        if (document.querySelector('.cssos-myvoice-entry[data-mve="' + t.key + '"]')) return;
        var btn = makeBtn(); btn.setAttribute("data-mve", t.key);
        if (t.place === "after") { anchor.insertAdjacentElement("afterend", btn); }
        else if (t.place === "before") { anchor.parentElement && anchor.parentElement.insertBefore(btn, anchor); }
        else if (t.place === "prepend-body") {
          var body = anchor.querySelector(".panel-body, .panel-content, .flow") || anchor;
          body.insertBefore(btn, body.firstChild);
        }
      } catch (_e) { /* best-effort per target */ }
    });
    injectLangRow();
  }

  var _t = null;
  function schedule() { clearTimeout(_t); _t = setTimeout(injectAll, 150); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectAll);
  else injectAll();
  try { new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); } catch (_e) {}
  setInterval(injectAll, 2000); // 兜底: 面板懒加载/重建后补插
})();
