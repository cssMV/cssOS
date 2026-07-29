/* CSSOS_WAVE_1791 20260728 — Jing: 生日申报(一处填写, 两处生效)。
 *
 * 为什么做: 仓库里 user_preferences.birthday(生日 MV)和 users.birth_year(年龄门)
 * 早就都在, 但【从来没有任何入口能写】—— 生日 MV 守护进程每 6 小时扫的一直是空集。
 * 这个模块就是缺失的那个输入口。一次填写同时喂两个功能。
 *
 * 三条产品原则(Jing 定的方向, 别改回定时弹窗):
 *  1. 【奖励驱动, 不是合规驱动】。文案说的是"生日当天送你一支专属 MV",
 *     不是"请申报年龄以便我们限制你"。强制填最容易换来一堆 1900-01-01,
 *     假数据比没数据更糟 —— 它会让年龄门产生"我知道了"的错觉。
 *  2. 【事件驱动 + 硬上限】。绝不做一周一次的定时弹窗(最招人烦的一类打扰,
 *     也和平台调性冲突)。自动提醒【一生最多 2 次】且间隔 ≥7 天;
 *     其余靠用户主动进入生日 MV 入口时触发。
 *  3. 【年份锁, 月日可改一次】。后端强制; 这里只是把状态如实显示出来。
 *
 * 对外 API:
 *   globalThis.cssosOpenBirthdayPrompt(reason)  → 打开填写弹窗(任何入口可调)
 *   globalThis.cssosBirthdayState()             → 最近一次拉到的状态(可能为 null)
 *   globalThis.cssosRefreshBirthdayState()      → 重新拉状态 */
(function () {
  "use strict";
  if (globalThis.__cssosBirthdayDeclarationWired) return;
  globalThis.__cssosBirthdayDeclarationWired = true;

  var MAX_AUTO_PROMPTS = 2;
  var MIN_GAP_MS = 7 * 24 * 60 * 60 * 1000;
  var K_COUNT = "cssos.birthday.autoPromptCount";
  var K_LAST = "cssos.birthday.autoPromptAt";
  var K_NEVER = "cssos.birthday.neverAsk";

  var state = null;

  function tr(en) {
    try {
      if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en);
    } catch (_e) {}
    return en;
  }
  function toast(m) {
    try { if (typeof globalThis.showToast === "function") globalThis.showToast(m); } catch (_e) {}
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (_e) {} }

  function guessTimezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (_e) { return null; }
  }

  function injectCss() {
    if (document.getElementById("cssos-birthday-css")) return;
    var s = document.createElement("style");
    s.id = "cssos-birthday-css";
    s.textContent =
      "#cssos-birthday-modal{position:fixed;inset:0;z-index:10070;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,0.46);backdrop-filter:blur(4px);font:500 14px/1.5 -apple-system,system-ui,sans-serif;}" +
      "#cssos-birthday-modal .cbd-card{width:min(92vw,420px);background:#0d1512;color:#e8fff5;border:1px solid rgba(0,245,160,0.30);" +
      "border-radius:18px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,0.55);}" +
      "#cssos-birthday-modal h3{margin:0 0 6px;font-size:19px;font-weight:700;}" +
      "#cssos-birthday-modal .cbd-sub{opacity:0.78;font-size:13px;margin-bottom:16px;}" +
      "#cssos-birthday-modal input[type=date]{width:100%;padding:11px 12px;border-radius:12px;background:rgba(0,245,160,0.07);" +
      "border:1px solid rgba(0,245,160,0.28);color:#e8fff5;font-size:15px;}" +
      "#cssos-birthday-modal .cbd-note{font-size:12px;opacity:0.62;margin-top:9px;line-height:1.5;}" +
      "#cssos-birthday-modal .cbd-optin{display:flex;gap:9px;align-items:flex-start;margin-top:14px;font-size:13px;opacity:0.88;cursor:pointer;}" +
      "#cssos-birthday-modal .cbd-row{display:flex;gap:10px;margin-top:18px;}" +
      "#cssos-birthday-modal button{flex:1;padding:11px 14px;border-radius:999px;border:1px solid rgba(0,245,160,0.30);" +
      "background:rgba(0,245,160,0.10);color:#e8fff5;font-size:14px;font-weight:600;cursor:pointer;}" +
      "#cssos-birthday-modal button.cbd-primary{background:rgba(0,245,160,0.34);}" +
      "#cssos-birthday-modal button:disabled{opacity:0.5;cursor:default;}" +
      "#cssos-birthday-modal .cbd-never{margin-top:12px;text-align:center;font-size:12px;opacity:0.5;cursor:pointer;text-decoration:underline;}";
    (document.head || document.documentElement).appendChild(s);
  }

  function close() {
    var el = document.getElementById("cssos-birthday-modal");
    if (el) el.remove();
  }

  function open(reason) {
    injectCss();
    close();

    var ov = document.createElement("div");
    ov.id = "cssos-birthday-modal";
    var card = document.createElement("div");
    card.className = "cbd-card";
    ov.appendChild(card);

    var h = document.createElement("h3");
    // 奖励驱动的文案 —— 说清楚用户得到什么, 而不是我们需要什么。
    h.textContent = tr("Get a birthday MV, made just for you");
    card.appendChild(h);

    var sub = document.createElement("div");
    sub.className = "cbd-sub";
    sub.textContent = tr("Tell us your birthday and cssOS will compose an original MV for you on the day.");
    card.appendChild(sub);

    var input = document.createElement("input");
    input.type = "date";
    var todayIso = new Date().toISOString().slice(0, 10);
    input.max = todayIso;
    input.min = "1900-01-01";
    if (state && state.birthday) input.value = state.birthday;
    card.appendChild(input);

    var note = document.createElement("div");
    note.className = "cbd-note";
    var noteLines = [tr("Your birth year is saved once and can't be changed. The month and day can be corrected once.")];
    if (state && state.year_locked) {
      noteLines.push(tr("Your birth year is already locked — only the month and day can be corrected."));
    }
    if (state && state.md_edits_left === 0 && state.birthday) {
      noteLines.push(tr("You've already used your one correction, so this can no longer be changed here."));
    }
    note.textContent = noteLines.join(" ");
    card.appendChild(note);

    var optLabel = document.createElement("label");
    optLabel.className = "cbd-optin";
    var opt = document.createElement("input");
    opt.type = "checkbox";
    opt.checked = !(state && state.opt_in === false);
    var optText = document.createElement("span");
    optText.textContent = tr("Send me a birthday MV each year");
    optLabel.appendChild(opt);
    optLabel.appendChild(optText);
    card.appendChild(optLabel);

    var row = document.createElement("div");
    row.className = "cbd-row";
    var later = document.createElement("button");
    later.textContent = tr("Not now");
    var save = document.createElement("button");
    save.className = "cbd-primary";
    save.textContent = tr("Save");
    row.appendChild(later);
    row.appendChild(save);
    card.appendChild(row);

    var never = document.createElement("div");
    never.className = "cbd-never";
    never.textContent = tr("Don't ask me again");
    card.appendChild(never);

    later.addEventListener("click", function () { close(); });
    never.addEventListener("click", function () {
      lsSet(K_NEVER, "1");
      close();
      toast(tr("We won't ask again. You can still add it from your profile."));
    });
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });

    save.addEventListener("click", function () {
      var v = String(input.value || "").trim();
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      if (!m) { toast(tr("Please pick a valid date.")); return; }
      save.disabled = true;
      save.textContent = tr("Saving…");
      fetch("/api/user/birthday", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
          timezone: guessTimezone(), opt_in: !!opt.checked
        })
      })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (out) {
          if (out.status === 200 && out.body && out.body.ok) {
            state = (out.body.data) || null;
            close();
            toast(tr("Saved. See you on your birthday."));
            try {
              // 生日一填, 年龄门的判定也变了 —— 让 W1790 那个模块重新拉一次。
              if (typeof globalThis.cssosRefreshSocialGate === "function") globalThis.cssosRefreshSocialGate();
            } catch (_e) {}
            try { globalThis.dispatchEvent(new CustomEvent("cssos:birthday-declared", { detail: state })); } catch (_e) {}
            return;
          }
          var code = out.body && out.body.code;
          if (code === "BIRTH_YEAR_LOCKED") toast(tr("Your birth year is already set and can't be changed."));
          else if (code === "BIRTHDAY_MD_LOCKED") toast(tr("You've already used your one correction."));
          else if (out.status === 401) toast(tr("Please sign in first."));
          else toast(tr("Couldn't save that. Please try again."));
          save.disabled = false;
          save.textContent = tr("Save");
        })
        .catch(function () {
          toast(tr("Couldn't save that. Please try again."));
          save.disabled = false;
          save.textContent = tr("Save");
        });
    });

    document.body.appendChild(ov);
    try { input.focus(); } catch (_e) {}
    try { globalThis.dispatchEvent(new CustomEvent("cssos:birthday-prompt-shown", { detail: { reason: reason || "manual" } })); } catch (_e) {}
  }

  function refresh() {
    return fetch("/api/user/birthday", { credentials: "include" })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) { state = (j && j.data) || null; return state; })
      .catch(function () { return null; });
  }

  /* 自动提醒: 一生最多 2 次, 间隔 ≥7 天, 已申报/已说"别再问"就永不打扰。
   * 这不是定时器 —— 只在页面加载后判断一次, 不会在使用过程中冷不丁弹出来。 */
  function maybeAutoPrompt() {
    if (lsGet(K_NEVER) === "1") return;
    if (!state || state.declared) return;
    var count = Number(lsGet(K_COUNT) || 0);
    if (count >= MAX_AUTO_PROMPTS) return;
    var last = Number(lsGet(K_LAST) || 0);
    if (last && Date.now() - last < MIN_GAP_MS) return;
    lsSet(K_COUNT, count + 1);
    lsSet(K_LAST, Date.now());
    open("auto");
  }

  globalThis.cssosOpenBirthdayPrompt = function (reason) {
    // 主动入口(生日 MV 按钮、Profile 那一行)不受自动提醒的次数上限约束。
    return refresh().then(function () { open(reason || "manual"); });
  };
  globalThis.cssosBirthdayState = function () { return state; };
  globalThis.cssosRefreshBirthdayState = refresh;

  function boot() {
    // 未登录不打扰(端点会 401, state 保持 null → maybeAutoPrompt 直接返回)。
    refresh().then(function () { setTimeout(maybeAutoPrompt, 2500); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  try {
    globalThis.addEventListener("cssos:auth-change", refresh);
    globalThis.addEventListener("cssos:auth-changed", refresh);
  } catch (_e) {}
})();
