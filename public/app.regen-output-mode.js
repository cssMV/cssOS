/* CSSOS_WAVE_255 20260520 — Jing: 相同输入重生成时, "覆盖旧作品 vs 输出
 * 新作品" 的选择 + 记忆.
 *
 * 背景: 早期高级设置面板里有过这个开关, 被某次回滚连同"胶囊宪法"一起
 * 滚掉了. 重建为独立模块, 不依赖高级设置面板的渲染(那块仍在回滚动荡中).
 *
 * 行为:
 *   • 设置键 cssos.regen.output_mode: "ask"(默认) | "overwrite" | "new".
 *   • cssosResolveRegenOutputMode() → Promise<"overwrite"|"new">:
 *       - mode==="ask": 弹出选择框(覆盖旧作品 / 输出新作品) + "记住我的
 *         选择，下次不再问"勾选框; 勾了就把选择持久化, 下次直接返回, 不再弹.
 *       - mode==="overwrite"/"new": 直接返回, 不弹.
 *   • cssosRegenOutputMode.get()/set(v)/reset(): 供高级设置面板读写/恢复;
 *     reset() 改回 "ask"(下次重新询问).
 *
 * 纯前端, 零依赖, 自带样式. forceNew=true 对应 "new", false 对应 "overwrite". */
(function () {
  "use strict";
  if (globalThis.cssosResolveRegenOutputMode) return;

  var KEY = "cssos.regen.output_mode";
  var VALID = { ask: 1, overwrite: 1, new: 1 };

  function readMode() {
    try {
      var v = String(localStorage.getItem(KEY) || "ask").trim();
      return VALID[v] ? v : "ask";
    } catch (_) { return "ask"; }
  }
  function writeMode(v) {
    try {
      if (v === "ask") localStorage.removeItem(KEY);
      else if (VALID[v]) localStorage.setItem(KEY, v);
    } catch (_) {}
  }

  function tr(en, zh) {
    var loc = String(globalThis.currentLocale || "").toLowerCase();
    return loc === "zh" ? zh : en;
  }

  function ensureStyle() {
    if (document.getElementById("cssos-regen-mode-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-regen-mode-style";
    st.textContent =
      ".cssos-regen-mask{position:fixed;inset:0;z-index:10056;display:flex;" + /* CSSOS_WAVE_351 收敛: 99999 → 10056 */
      "align-items:center;justify-content:center;background:rgba(4,12,10,.72);" +
      "backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}" +
      ".cssos-regen-card{width:min(420px,88vw);background:#0f1c17;border:1px solid " +
      "rgba(255,255,255,.12);border-radius:18px;padding:22px 20px 18px;color:#eaf3ee;" +
      "box-shadow:0 24px 64px rgba(0,0,0,.5);font-family:inherit;}" +
      ".cssos-regen-card h3{margin:0 0 6px;font-size:17px;font-weight:700;}" +
      ".cssos-regen-card p{margin:0 0 16px;font-size:13px;line-height:1.5;opacity:.72;}" +
      ".cssos-regen-btns{display:flex;flex-direction:column;gap:10px;}" +
      ".cssos-regen-btn{appearance:none;border:1px solid rgba(255,255,255,.16);" +
      "background:#16261f;color:#eaf3ee;border-radius:12px;padding:13px 14px;" +
      "font-size:14px;font-weight:600;text-align:left;cursor:pointer;line-height:1.35;}" +
      ".cssos-regen-btn small{display:block;font-weight:400;opacity:.6;font-size:12px;margin-top:2px;}" +
      ".cssos-regen-btn.is-new{border-color:#2fbf83;background:#152c22;}" +
      ".cssos-regen-btn:active{transform:scale(.98);}" +
      ".cssos-regen-remember{display:flex;align-items:center;gap:8px;margin-top:14px;" +
      "font-size:12.5px;opacity:.82;cursor:pointer;user-select:none;}" +
      ".cssos-regen-remember input{width:16px;height:16px;accent-color:#2fbf83;}";
    document.head.appendChild(st);
  }

  function showChooser() {
    return new Promise(function (resolve) {
      ensureStyle();
      var mask = document.createElement("div");
      mask.className = "cssos-regen-mask";
      mask.innerHTML =
        '<div class="cssos-regen-card" role="dialog" aria-modal="true">' +
        "<h3>" + tr("Regenerate this work?", "重新生成这首作品？") + "</h3>" +
        "<p>" + tr(
          "You're regenerating with the same input. Where should the new result go?",
          "你正在用相同输入重新生成。新结果要放到哪里？") + "</p>" +
        '<div class="cssos-regen-btns">' +
        '<button type="button" class="cssos-regen-btn is-new" data-mode="new">' +
        tr("Output as a NEW work", "输出为新作品") +
        "<small>" + tr("Keeps the old one; adds a new version.", "保留旧作品，新增一个版本。") + "</small></button>" +
        '<button type="button" class="cssos-regen-btn" data-mode="overwrite">' +
        tr("Overwrite the old work", "覆盖旧作品") +
        "<small>" + tr("Replaces the existing result in place.", "原地替换现有结果。") + "</small></button>" +
        "</div>" +
        '<label class="cssos-regen-remember"><input type="checkbox" id="cssos-regen-remember-cb">' +
        tr("Remember my choice — don't ask again", "记住我的选择，下次不再问") +
        "</label></div>";
      document.body.appendChild(mask);

      var done = false;
      function pick(mode) {
        if (done) return;
        done = true;
        var remember = !!mask.querySelector("#cssos-regen-remember-cb")?.checked;
        if (remember) writeMode(mode);
        try { mask.remove(); } catch (_) {}
        resolve(mode);
      }
      mask.querySelectorAll(".cssos-regen-btn").forEach(function (b) {
        b.addEventListener("click", function () { pick(b.getAttribute("data-mode")); });
      });
      // 点遮罩空白不关闭(强制选择), 但 Esc 视为"新作品"(更安全, 不毁旧作).
      mask.addEventListener("keydown", function (e) { if (e.key === "Escape") pick("new"); });
      mask.tabIndex = -1;
      setTimeout(function () { try { mask.focus(); } catch (_) {} }, 0);
    });
  }

  globalThis.cssosResolveRegenOutputMode = function () {
    var mode = readMode();
    if (mode === "overwrite" || mode === "new") return Promise.resolve(mode);
    return showChooser();
  };

  // CSSOS_WAVE_255 — 偏好设置入口 (贴在"创作新版本"按钮旁的 ⚙ 调用).
  // 三选: 新作品 / 覆盖 / 每次问我; 选了立即持久化(含"每次问我"=恢复询问).
  globalThis.cssosOpenRegenModeSettings = function () {
    ensureStyle();
    var cur = readMode();
    var mask = document.createElement("div");
    mask.className = "cssos-regen-mask";
    function row(mode, title, sub) {
      var on = cur === mode;
      return '<button type="button" class="cssos-regen-btn' + (mode === "new" ? " is-new" : "") +
        '" data-mode="' + mode + '">' + (on ? "✓ " : "") + title +
        "<small>" + sub + "</small></button>";
    }
    mask.innerHTML =
      '<div class="cssos-regen-card" role="dialog" aria-modal="true">' +
      "<h3>" + tr("Regenerate behaviour", "重新生成默认行为") + "</h3>" +
      "<p>" + tr("When you regenerate with the same input:", "当你用相同输入重新生成时：") + "</p>" +
      '<div class="cssos-regen-btns">' +
      row("new", tr("Always output a new work", "总是输出新作品"), tr("Keeps the old one.", "保留旧作品。")) +
      row("overwrite", tr("Always overwrite the old work", "总是覆盖旧作品"), tr("Replaces in place.", "原地替换。")) +
      row("ask", tr("Ask me each time", "每次都问我"), tr("Show the chooser every time.", "每次都弹出选择框。")) +
      "</div></div>";
    document.body.appendChild(mask);
    var done = false;
    function pick(mode) {
      if (done) return; done = true;
      writeMode(mode);
      try { mask.remove(); } catch (_) {}
      try { globalThis.showToast?.(tr("Saved.", "已保存。")); } catch (_) {}
    }
    mask.querySelectorAll(".cssos-regen-btn").forEach(function (b) {
      b.addEventListener("click", function () { pick(b.getAttribute("data-mode")); });
    });
    mask.addEventListener("click", function (e) { if (e.target === mask) { try { mask.remove(); } catch (_) {} } });
  };

  globalThis.cssosRegenOutputMode = Object.freeze({
    get: readMode,
    set: writeMode,
    reset: function () { writeMode("ask"); },
  });
})();
