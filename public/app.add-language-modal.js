/* CSSOS_WAVE_581 20260531 — Jing「给现有作品加语言」的功能+UI(此前只有后端端点+创作流里的 picker,
 * 没有"对一首已有作品 选语言→报价→提交"的入口; W580 那颗 ➕加语言 胶囊是空头支票)。
 *
 * 本模块 = 独立弹窗: 挂 cssosMountLanguagePicker → 实时调 /api/mv/language-tracks/quote 显示价格 →
 * 提交 POST /api/works/:id/language-tracks {languages:[]} → 成功后刷新该作品的语言条(cssosMountLanguagePill)。
 * 公开: globalThis.cssosOpenAddLanguageModal(workId)。后端已做 owner 校验 + 计费(admin 免费)。
 * i18n: lc(en, zh)。 */
(function () {
  "use strict";
  if (globalThis.__cssosAddLangModalWired) return;
  globalThis.__cssosAddLangModalWired = true;

  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    try {
      var l = String(document.documentElement.lang || navigator.language || "").toLowerCase();
      return l.indexOf("zh") === 0 ? zh : en;
    } catch (_e) { return en; }
  }
  function fmtCents(c) {
    var n = Number(c || 0);
    if (n <= 0) return lc("Free", "免费");
    return n >= 100 ? "$" + (n / 100).toFixed(2) : "¢" + n;
  }

  function injectStyle() {
    if (document.getElementById("cssos-add-lang-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-add-lang-style";
    st.textContent = [
      "#cssos-add-lang-modal{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;",
      "background:var(--cssos-overlay);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}",
      "#cssos-add-lang-modal[hidden]{display:none;}",
      "#cssos-add-lang-card{width:min(560px,92vw);max-height:86vh;overflow:auto;border-radius:18px;padding:20px;",
      "background:var(--cssos-surface);border:1px solid var(--cssos-border);box-shadow:0 16px 48px rgba(0,0,0,0.5);color:var(--text);}",
      "#cssos-add-lang-card h3{margin:0 0 4px;font-size:17px;font-weight:700;}",
      "#cssos-add-lang-card .alm-sub{font-size:12.5px;opacity:0.8;margin-bottom:14px;}",
      "#cssos-add-lang-picker{margin:8px 0 14px;}",
      "#cssos-add-lang-card .alm-quote{font-size:13px;font-weight:600;margin:10px 0;min-height:18px;}",
      "#cssos-add-lang-card .alm-quote .alm-insufficient{color:#ff9b9b;}",
      "#cssos-add-lang-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:8px;}",
      "#cssos-add-lang-actions button{border:0;border-radius:999px;padding:9px 18px;font:inherit;font-weight:600;cursor:pointer;}",
      "#cssos-add-lang-actions .alm-cancel{background:rgba(255,255,255,0.10);color:#cfd3dc;}",
      "#cssos-add-lang-actions .alm-go{background:hsla(155,68%,42%,0.95);color:#fff;}",
      "#cssos-add-lang-actions .alm-go[disabled]{opacity:0.5;cursor:default;}"
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var MAX_BATCH = 5; // CSSOS_WAVE_587 — 与后端 MV_TRACK_MAX_BATCH 一致(单次最多新增 5 个版本)。
  var _picker = null, _workId = null, _quoteTimer = null;

  function currentSelectedLangs() {
    try { return (_picker && typeof _picker.getSelected === "function") ? (_picker.getSelected() || []) : []; }
    catch (_e) { return []; }
  }

  async function refreshQuote() {
    var q = document.querySelector("#cssos-add-lang-card .alm-quote");
    var go = document.querySelector("#cssos-add-lang-actions .alm-go");
    var langs = currentSelectedLangs();
    if (!q) return;
    if (!langs.length) {
      q.textContent = lc("Pick one or more languages to add.", "选择要添加的语言（可多选）。");
      if (go) { go.disabled = true; go.textContent = lc("Add", "添加"); }
      return;
    }
    // CSSOS_WAVE_587 — 算力硬闸: 单次最多 MAX_BATCH 个(后端同限)。超出禁用提交并提示。
    if (langs.length > MAX_BATCH) {
      q.innerHTML = "<span class=\"alm-insufficient\">" +
        lc("Up to " + MAX_BATCH + " languages per batch — deselect " + (langs.length - MAX_BATCH) + ".",
           "一次最多 " + MAX_BATCH + " 种语言 —— 请取消 " + (langs.length - MAX_BATCH) + " 个。") + "</span>";
      if (go) { go.disabled = true; go.textContent = lc("Add", "添加"); }
      return;
    }
    try {
      var r = await fetch("/api/mv/language-tracks/quote", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ languages: langs })
      });
      var j = await r.json();
      if (!j || j.ok === false) throw new Error("quote_failed");
      var total = Number(j.total_cents || 0);
      var insufficient = j.sufficient === false;
      q.innerHTML = lc("Adding", "添加") + " " + langs.length + " " +
        lc(langs.length > 1 ? "languages" : "language", "种语言") + " · " +
        "<b>" + fmtCents(total) + "</b>" +
        (insufficient ? " · <span class=\"alm-insufficient\">" + lc("insufficient balance", "余额不足") + "</span>" : "");
      if (go) {
        go.disabled = insufficient;
        go.textContent = total > 0 ? (lc("Add for ", "添加 · ") + fmtCents(total)) : lc("Add (free)", "免费添加");
      }
    } catch (_e) {
      q.textContent = lc("Could not load price — try again.", "价格加载失败，请重试。");
      if (go) go.disabled = false;
    }
  }

  function scheduleQuote() {
    clearTimeout(_quoteTimer);
    _quoteTimer = setTimeout(refreshQuote, 250);
  }

  async function submit() {
    var langs = currentSelectedLangs();
    if (!langs.length || !_workId) return;
    var go = document.querySelector("#cssos-add-lang-actions .alm-go");
    if (go) { go.disabled = true; go.textContent = lc("Adding…", "添加中…"); }
    try {
      var r = await fetch("/api/works/" + encodeURIComponent(_workId) + "/language-tracks", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ languages: langs })
      });
      var j = await r.json();
      if (j && j.ok) {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(lc("Languages queued — rendering now.", "已加入队列，正在生成。"));
        }
        // 刷新该作品的语言条(轮询会显示新轨的生成进度, 完成自动亮起)。
        try { if (typeof globalThis.cssosMountLanguagePill === "function") globalThis.cssosMountLanguagePill(_workId); } catch (_e) {}
        close();
      } else {
        var code = (j && j.code) || "";
        // CSSOS_WAVE_588 — 引导式: 余额不足→[去充值]; 其它失败→[重试]。
        if ((code === "INSUFFICIENT_CREDIT" || code === "INSUFFICIENT_BALANCE") && typeof globalThis.cssosToastInsufficientBalance === "function") {
          globalThis.cssosToastInsufficientBalance();
        } else if (typeof globalThis.cssosToastRetry === "function") {
          globalThis.cssosToastRetry(lc("Add failed: ", "添加失败：") + (code || "unknown"), submit);
        } else if (typeof globalThis.showToast === "function") {
          globalThis.showToast(lc("Add failed: ", "添加失败：") + (code || "unknown"));
        }
        if (go) { go.disabled = false; refreshQuote(); }
      }
    } catch (_e) {
      if (go) { go.disabled = false; }
      if (typeof globalThis.cssosToastRetry === "function") globalThis.cssosToastRetry(lc("Network error.", "网络错误。"), submit);
      else if (typeof globalThis.showToast === "function") globalThis.showToast(lc("Network error — try again.", "网络错误，请重试。"));
    }
  }

  function close() {
    var m = document.getElementById("cssos-add-lang-modal");
    if (m) m.hidden = true;
    try { if (_picker && _picker.destroy) _picker.destroy(); } catch (_e) {}
    _picker = null; _workId = null;
  }

  globalThis.cssosOpenAddLanguageModal = function (workId) {
    workId = String(workId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(workId)) {
      if (typeof globalThis.showToast === "function") globalThis.showToast(lc("Open the work first.", "请先打开作品。"));
      return;
    }
    injectStyle();
    _workId = workId;
    var m = document.getElementById("cssos-add-lang-modal");
    if (!m) {
      m = document.createElement("div");
      m.id = "cssos-add-lang-modal";
      m.innerHTML =
        '<div id="cssos-add-lang-card" role="dialog" aria-modal="true">' +
          "<h3>" + lc("Add languages to this MV", "为这首作品添加语言") + "</h3>" +
          '<div class="alm-sub">' + lc("Reach fans worldwide — each language is a new voice track + synced subtitles.",
                                       "触达全球粉丝 —— 每种语言都是一条新声线 + 同步字幕。") + "</div>" +
          '<div id="cssos-add-lang-picker"></div>' +
          '<div class="alm-quote"></div>' +
          '<div id="cssos-add-lang-actions">' +
            '<button type="button" class="alm-cancel"></button>' +
            '<button type="button" class="alm-go" disabled></button>' +
          "</div>" +
        "</div>";
      document.body.appendChild(m);
      m.addEventListener("click", function (e) { if (e.target === m) close(); });
      m.querySelector(".alm-cancel").textContent = lc("Cancel", "取消");
      m.querySelector(".alm-cancel").addEventListener("click", close);
      m.querySelector(".alm-go").addEventListener("click", submit);
      m.querySelector(".alm-go").textContent = lc("Add", "添加");
    }
    m.hidden = false;
    // 挂 picker(复用创作流同款), 选择变化时刷新报价。
    var host = document.getElementById("cssos-add-lang-picker");
    host.innerHTML = "";
    if (typeof globalThis.cssosMountLanguagePicker === "function") {
      _picker = globalThis.cssosMountLanguagePicker(host, {
        onChange: scheduleQuote,
        // 排除作品已有的语言(避免重复付费): 后端也会去重, 这里仅传给 picker 做禁选(若支持)。
        excludeWorkId: workId,
        // CSSOS_WAVE_587 — 算力闸: 单次最多选 MAX_BATCH 个, 其余置灰/禁选(土豪要全部, 分批来)。
        maxSelections: MAX_BATCH
      });
    }
    // picker 无 onChange 时, 兜底轮询选择变化。
    var lastSig = "";
    clearInterval(globalThis.__almPollSel);
    globalThis.__almPollSel = setInterval(function () {
      if (m.hidden) { clearInterval(globalThis.__almPollSel); return; }
      var sig = currentSelectedLangs().join(",");
      if (sig !== lastSig) { lastSig = sig; refreshQuote(); }
    }, 400);
    refreshQuote();
  };
})();
