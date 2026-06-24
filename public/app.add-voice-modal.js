/* CSSOS_WAVE_584 20260531 — Jing「多声线」: 给现有作品加【不同声线】(同语言/同旋律, 换音色重唱,
 * 调性自动适配新声线音域)。与多语言同价、同交互(选→报价→提交→新轨亮起)。
 * 公开: globalThis.cssosOpenAddVoiceModal(workId)。后端 POST /api/works/:id/voice-tracks {voices:[]}。 */
(function () {
  "use strict";
  if (globalThis.__cssosAddVoiceModalWired) return;
  globalThis.__cssosAddVoiceModalWired = true;

  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    try { var l = String(document.documentElement.lang || navigator.language || "").toLowerCase();
      return l.indexOf("zh") === 0 ? zh : en; } catch (_e) { return en; }
  }
  function fmtCents(c) { var n = Number(c || 0); if (n <= 0) return lc("Free", "免费"); return n >= 100 ? "$" + (n / 100).toFixed(2) : "¢" + n; }

  // 声线集(与后端 CSSOS_SUPPORTED_VOICES 一致; auto=原声不在可加列表)。带 emoji 图标 + 双语标签。
  var VOICES = [
    { id: "feminine",        ico: "👩", en: "Feminine",        zh: "女声" },
    { id: "masculine",       ico: "👨", en: "Masculine",       zh: "男声" },
    { id: "childlike",       ico: "🧒", en: "Childlike",       zh: "童声" },
    { id: "duet",            ico: "👫", en: "Duet",            zh: "二重唱" },
    { id: "androgynous",     ico: "🧑", en: "Androgynous",     zh: "中性声" },
    { id: "polyphonic_choir",ico: "🎶", en: "Polyphonic Choir",zh: "复调合唱" },
    { id: "raspy",           ico: "🔥", en: "Raspy",           zh: "沙哑声" },
    { id: "operatic",        ico: "🎭", en: "Operatic",        zh: "美声" },
    { id: "whisper",         ico: "🌬", en: "Whisper",         zh: "气声" },
    { id: "robotic",         ico: "🤖", en: "Robotic",         zh: "电子声" },
  ];

  function injectStyle() {
    if (document.getElementById("cssos-add-voice-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-add-voice-style";
    st.textContent = [
      "#cssos-add-voice-modal{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:var(--cssos-overlay);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}",
      "#cssos-add-voice-modal[hidden]{display:none;}",
      "#cssos-add-voice-card{width:min(560px,92vw);max-height:86vh;overflow:auto;border-radius:18px;padding:20px;background:var(--cssos-surface);border:1px solid var(--cssos-border);box-shadow:0 16px 48px rgba(0,0,0,0.5);color:var(--text);}",
      "#cssos-add-voice-card h3{margin:0 0 4px;font-size:17px;font-weight:700;}",
      "#cssos-add-voice-card .avm-sub{font-size:12.5px;opacity:0.8;margin-bottom:14px;}",
      "#cssos-add-voice-grid{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 14px;}",
      ".avm-chip{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--text);background:hsla(155,58%,52%,0.10);border:1px solid hsla(155,100%,65%,0.26);}",
      ".avm-chip.sel{background:hsla(155,68%,40%,0.92);color:#fff;border-color:hsla(155,100%,68%,0.5);}",
      "#cssos-add-voice-card .avm-quote{font-size:13px;font-weight:600;margin:10px 0;min-height:18px;}",
      "#cssos-add-voice-card .avm-quote .avm-insuf{color:#ff9b9b;}",
      "#cssos-add-voice-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:8px;}",
      "#cssos-add-voice-actions button{border:0;border-radius:999px;padding:9px 18px;font:inherit;font-weight:600;cursor:pointer;}",
      "#cssos-add-voice-actions .avm-cancel{background:rgba(255,255,255,0.10);color:#cfd3dc;}",
      "#cssos-add-voice-actions .avm-go{background:hsla(155,68%,42%,0.95);color:#fff;}",
      "#cssos-add-voice-actions .avm-go[disabled]{opacity:0.5;cursor:default;}"
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var MAX_BATCH = 5; // CSSOS_WAVE_587 — 与后端 MV_TRACK_MAX_BATCH 一致。
  var _workId = null, _sel = [], _qTimer = null;

  async function refreshQuote() {
    var q = document.querySelector("#cssos-add-voice-card .avm-quote");
    var go = document.querySelector("#cssos-add-voice-actions .avm-go");
    if (!q) return;
    if (!_sel.length) {
      q.textContent = lc("Pick one or more voices to add.", "选择要添加的声线（可多选）。");
      if (go) { go.disabled = true; go.textContent = lc("Add", "添加"); }
      return;
    }
    try {
      // 复用多语言报价(同价): 数量 → 价格。
      var r = await fetch("/api/mv/language-tracks/quote", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ languages: _sel.map(function (_, i) { return "vx" + i; }) })
      });
      var j = await r.json();
      var total = Number((j && j.total_cents) || 0);
      var insuf = j && j.sufficient === false;
      q.innerHTML = lc("Adding", "添加") + " " + _sel.length + " " + lc("voices", "种声线") + " · <b>" + fmtCents(total) + "</b>" +
        (insuf ? " · <span class=\"avm-insuf\">" + lc("insufficient balance", "余额不足") + "</span>" : "");
      if (go) { go.disabled = !!insuf; go.textContent = total > 0 ? (lc("Add for ", "添加 · ") + fmtCents(total)) : lc("Add (free)", "免费添加"); }
    } catch (_e) {
      q.textContent = lc("Could not load price — try again.", "价格加载失败，请重试。");
    }
  }
  function scheduleQuote() { clearTimeout(_qTimer); _qTimer = setTimeout(refreshQuote, 200); }

  async function submit() {
    if (!_sel.length || !_workId) return;
    var go = document.querySelector("#cssos-add-voice-actions .avm-go");
    if (go) { go.disabled = true; go.textContent = lc("Adding…", "添加中…"); }
    try {
      var r = await fetch("/api/works/" + encodeURIComponent(_workId) + "/voice-tracks", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ voices: _sel })
      });
      var j = await r.json();
      if (j && j.ok) {
        if (typeof globalThis.showToast === "function") globalThis.showToast(lc("Voices queued — rendering now.", "已加入队列，正在生成。"));
        try { if (typeof globalThis.cssosMountLanguagePill === "function") globalThis.cssosMountLanguagePill(_workId); } catch (_e) {}
        close();
      } else {
        var code = (j && j.code) || "";
        // CSSOS_WAVE_588 — 引导式: 余额不足→[去充值]; 其它失败→[重试]。不再死胡同。
        if (code === "INSUFFICIENT_BALANCE" && typeof globalThis.cssosToastInsufficientBalance === "function") globalThis.cssosToastInsufficientBalance();
        else if (typeof globalThis.cssosToastRetry === "function") globalThis.cssosToastRetry(lc("Add failed: ", "添加失败：") + (code || "unknown"), submit);
        else if (typeof globalThis.showToast === "function") globalThis.showToast(lc("Add failed: ", "添加失败：") + (code || "unknown"));
        if (go) { go.disabled = false; refreshQuote(); }
      }
    } catch (_e) {
      if (go) go.disabled = false;
      if (typeof globalThis.cssosToastRetry === "function") globalThis.cssosToastRetry(lc("Network error.", "网络错误。"), submit);
      else if (typeof globalThis.showToast === "function") globalThis.showToast(lc("Network error — try again.", "网络错误，请重试。"));
    }
  }

  function close() { var m = document.getElementById("cssos-add-voice-modal"); if (m) m.hidden = true; _workId = null; _sel = []; }

  globalThis.cssosOpenAddVoiceModal = function (workId) {
    workId = String(workId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(workId)) { if (typeof globalThis.showToast === "function") globalThis.showToast(lc("Open the work first.", "请先打开作品。")); return; }
    injectStyle();
    _workId = workId; _sel = [];
    var m = document.getElementById("cssos-add-voice-modal");
    if (!m) {
      m = document.createElement("div");
      m.id = "cssos-add-voice-modal";
      m.innerHTML =
        '<div id="cssos-add-voice-card" role="dialog" aria-modal="true">' +
          "<h3>" + lc("Add voices to this MV", "为这首作品添加声线") + "</h3>" +
          '<div class="avm-sub">' + lc("Same melody, re-sung in a new voice — key auto-fits the new range. Each voice is a new track.",
                                       "旋律不变，换一种声线重唱 —— 调性自动适配新音域。每种声线都是一条新轨。") + "</div>" +
          // CSSOS_WAVE_587 — 「用我的声音唱」入口: 录音训练个人声纹。
          '<button type="button" id="cssos-avm-myvoice" class="avm-chip" style="width:100%;justify-content:center;background:hsla(155,68%,40%,0.22);border-color:hsla(155,100%,68%,0.45);margin-bottom:10px;">🎙️ ' +
            lc("Sing in your own voice", "用我的声音唱") + "</button>" +
          '<div id="cssos-add-voice-grid"></div>' +
          '<div class="avm-quote"></div>' +
          '<div id="cssos-add-voice-actions"><button type="button" class="avm-cancel"></button><button type="button" class="avm-go" disabled></button></div>' +
        "</div>";
      document.body.appendChild(m);
      m.addEventListener("click", function (e) { if (e.target === m) close(); });
      m.querySelector(".avm-cancel").addEventListener("click", close);
      m.querySelector(".avm-go").addEventListener("click", submit);
      m.querySelector("#cssos-avm-myvoice").addEventListener("click", function () {
        // 打开「我的声线」管理器(看已有声纹 + 训练新的); 没有管理器则退回直接训练。
        if (typeof globalThis.cssosOpenMyVoicesModal === "function") globalThis.cssosOpenMyVoicesModal();
        else if (typeof globalThis.cssosOpenVoiceCloneModal === "function") globalThis.cssosOpenVoiceCloneModal();
      });
    }
    var zh = String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0;
    m.querySelector(".avm-cancel").textContent = lc("Cancel", "取消");
    m.querySelector(".avm-go").textContent = lc("Add", "添加");
    var grid = document.getElementById("cssos-add-voice-grid");
    grid.innerHTML = "";
    VOICES.forEach(function (v) {
      var c = document.createElement("button");
      c.type = "button"; c.className = "avm-chip"; c.dataset.voice = v.id;
      c.innerHTML = v.ico + " " + (zh ? v.zh : v.en);
      c.addEventListener("click", function () {
        var i = _sel.indexOf(v.id);
        if (i >= 0) { _sel.splice(i, 1); c.classList.remove("sel"); }
        else {
          // CSSOS_WAVE_587 — 算力硬闸: 单次最多 MAX_BATCH 个(后端同限, 超出 400 BATCH_TOO_LARGE)。
          if (_sel.length >= MAX_BATCH) {
            if (typeof globalThis.showToast === "function") globalThis.showToast(lc("Up to " + MAX_BATCH + " per batch.", "一次最多 " + MAX_BATCH + " 个。"));
            return;
          }
          _sel.push(v.id); c.classList.add("sel");
        }
        scheduleQuote();
      });
      grid.appendChild(c);
    });
    // CSSOS_WAVE_587 — 追加【本人已就绪的个人声纹】(用我的声音唱训练完成的), 可直接勾选加到作品。
    (function appendPersonalVoices() {
      fetch("/api/voice-models", { credentials: "include" }).then(function (r) { return r.json(); }).then(function (j) {
        (j && j.voices || []).filter(function (v) { return v.ready && v.status === "ready" && /^u_/.test(v.voice_key); }).forEach(function (v) {
          if (grid.querySelector('[data-voice="' + v.voice_key + '"]')) return;
          var c = document.createElement("button");
          c.type = "button"; c.className = "avm-chip"; c.dataset.voice = v.voice_key;
          c.innerHTML = "🎙️ " + (v.label || lc("My Voice", "我的声音"));
          c.addEventListener("click", function () {
            var i = _sel.indexOf(v.voice_key);
            if (i >= 0) { _sel.splice(i, 1); c.classList.remove("sel"); }
            else {
              if (_sel.length >= MAX_BATCH) { if (typeof globalThis.showToast === "function") globalThis.showToast(lc("Up to " + MAX_BATCH + " per batch.", "一次最多 " + MAX_BATCH + " 个。")); return; }
              _sel.push(v.voice_key); c.classList.add("sel");
            }
            scheduleQuote();
          });
          grid.appendChild(c);
        });
      }).catch(function () { /* best-effort */ });
    })();
    m.hidden = false;
    refreshQuote();
  };
})();
