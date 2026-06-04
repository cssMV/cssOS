/* CSSOS_WAVE_587 20260602 — Jing「用我的声音唱」: 录音/上传 → 同意 → 训练个人声纹(RVC) → 入库。
 * 全球首创: 用户用自己的声音演唱平台输出的任意歌曲(跨语言)。
 * 公开: globalThis.cssosOpenVoiceCloneModal()。后端: POST /api/voice-models (multipart audio+consent+label[+gender])。 */
(function () {
  "use strict";
  if (globalThis.__cssosVoiceCloneWired) return;
  globalThis.__cssosVoiceCloneWired = true;

  function lc(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    try { return String(document.documentElement.lang || navigator.language || "").toLowerCase().indexOf("zh") === 0 ? zh : en; } catch (_e) { return en; }
  }
  function toast(m) { try { if (typeof globalThis.showToast === "function") globalThis.showToast(m); } catch (_e) {} }

  function injectStyle() {
    if (document.getElementById("cssos-vc-style")) return;
    var st = document.createElement("style"); st.id = "cssos-vc-style";
    st.textContent = [
      "#cssos-vc-modal{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:var(--cssos-overlay);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}",
      "#cssos-vc-modal[hidden]{display:none;}",
      "#cssos-vc-card{width:min(520px,92vw);max-height:88vh;overflow:auto;border-radius:18px;padding:20px;background:var(--cssos-surface);border:1px solid var(--cssos-border);box-shadow:0 16px 48px rgba(0,0,0,0.5);color:#eafff6;}",
      "#cssos-vc-card h3{margin:0 0 4px;font-size:17px;font-weight:700;}",
      "#cssos-vc-card .vc-sub{font-size:12.5px;opacity:0.8;margin-bottom:14px;line-height:1.5;}",
      "#cssos-vc-card .vc-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0;}",
      ".vc-btn{border:0;border-radius:999px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;}",
      ".vc-rec{background:hsla(0,70%,52%,0.92);color:#fff;}",
      ".vc-rec.is-rec{background:#333;}",
      ".vc-file{background:hsla(155,58%,52%,0.14);color:#eafff6;border:1px solid hsla(155,100%,65%,0.26);}",
      "#cssos-vc-card .vc-status{font-size:12.5px;opacity:0.85;min-height:16px;margin:4px 0;}",
      "#cssos-vc-card input[type=text]{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid hsla(155,100%,65%,0.26);background:#0a160f;color:#eafff6;font:inherit;}",
      "#cssos-vc-card .vc-consent{display:flex;gap:8px;align-items:flex-start;font-size:12px;opacity:0.92;margin:12px 0;line-height:1.5;}",
      "#cssos-vc-card .vc-consent input{margin-top:2px;}",
      "#cssos-vc-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:10px;}",
      "#cssos-vc-actions button{border:0;border-radius:999px;padding:9px 18px;font:inherit;font-weight:600;cursor:pointer;}",
      // CSSOS_WAVE_587 — Close 看着像禁用(灰字淡底)→ 提高对比, 一眼可点(不是暗黑设计, 关闭永远可用)。
      "#cssos-vc-actions .vc-cancel{background:rgba(255,255,255,0.18) !important;color:#ffffff !important;border:1px solid rgba(255,255,255,0.35) !important;opacity:1 !important;cursor:pointer !important;}",
      "#cssos-vc-actions .vc-cancel:hover{background:rgba(255,255,255,0.28) !important;}",
      "#cssos-vc-actions .vc-go{background:hsl(155,66%,46%) !important;color:#ffffff !important;}",
      "#cssos-vc-actions .vc-go:not([disabled]){opacity:1 !important;cursor:pointer !important;}",
      "#cssos-vc-actions .vc-go[disabled]{opacity:0.45;cursor:default;}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  var _rec = null, _chunks = [], _blob = null, _stream = null, _pollTimer = null;
  // CSSOS_WAVE_587 — 录音进度(3分钟)+ 音量 合一条: 随机色、随音量波动、3 分钟自动结束。
  var _raf = null, _audioCtx = null, _recStartMs = 0, _autoStop = null, _REC_MAX_MS = 180000;
  function stopMeter() {
    if (_raf) { try { cancelAnimationFrame(_raf); } catch (_e) {} _raf = null; }
    if (_autoStop) { try { clearTimeout(_autoStop); } catch (_e) {} _autoStop = null; }
    if (_audioCtx) { try { _audioCtx.close(); } catch (_e) {} _audioCtx = null; }
    var fill = document.querySelector(".vc-meter-fill"); var m = document.querySelector(".vc-meter");
    if (fill) fill.style.transform = "scaleX(0)";
    if (m) m.style.transform = "scaleY(1)";
  }
  function startMeter(btn) {
    try {
      var host = (btn && btn.closest && btn.closest("#cssos-vc-card")) || (btn && btn.parentElement) || document.body;
      var m = host.querySelector(".vc-meter");
      if (!m) {
        m = document.createElement("div"); m.className = "vc-meter";
        m.style.cssText = "position:relative;height:12px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,0.14);margin:10px 0;transform-origin:center;will-change:transform;";
        m.innerHTML = '<div class="vc-meter-fill" style="position:absolute;inset:0;border-radius:999px;transform-origin:left center;transform:scaleX(0);will-change:transform,background;background:hsl(155,85%,55%);"></div>';
        // 插到录音按钮那一行之后
        var anchor = (btn && btn.parentElement) || host.firstChild;
        if (anchor && anchor.insertAdjacentElement) anchor.insertAdjacentElement("afterend", m);
        else host.appendChild(m);
      }
      var fill = m.querySelector(".vc-meter-fill");
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var src = _audioCtx.createMediaStreamSource(_stream);
      var an = _audioCtx.createAnalyser(); an.fftSize = 256; src.connect(an);
      var data = new Uint8Array(an.frequencyBinCount);
      var hue = (typeof performance !== "undefined" ? performance.now() : 0) % 360;
      _recStartMs = Date.now();
      var tick = function () {
        if (!_rec || _rec.state !== "recording") return;
        var pct = Math.min(1, (Date.now() - _recStartMs) / _REC_MAX_MS);
        an.getByteTimeDomainData(data);
        var sum = 0; for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
        var rms = Math.sqrt(sum / data.length); // 0..~1
        hue = (hue + 1.5) % 360; // 随机色流动
        if (fill) {
          fill.style.transform = "scaleX(" + pct.toFixed(4) + ")";              // 进度(3分钟)
          fill.style.background = "hsl(" + hue.toFixed(0) + ",88%," + (45 + rms * 35).toFixed(0) + "%)"; // 音量越大越亮
          fill.style.opacity = (0.65 + rms * 0.35).toFixed(2);
        }
        m.style.transform = "scaleY(" + (1 + Math.min(0.7, rms * 1.2)).toFixed(2) + ")"; // 随音量起伏(compositor-safe)
        _raf = requestAnimationFrame(tick);
      };
      _raf = requestAnimationFrame(tick);
      _autoStop = setTimeout(function () { if (_rec && _rec.state === "recording") { try { _rec.stop(); } catch (_e) {} } }, _REC_MAX_MS); // 3 分钟自动结束
    } catch (_e) { /* meter best-effort; recording still works */ }
  }

  function close() {
    var m = document.getElementById("cssos-vc-modal"); if (m) m.hidden = true;
    try { if (_rec && _rec.state === "recording") _rec.stop(); } catch (_e) {}
    try { if (_stream) _stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_e) {}
    _rec = null; _chunks = []; _stream = null;
    clearTimeout(_pollTimer);
  }

  function setStatus(t) { var s = document.querySelector("#cssos-vc-card .vc-status"); if (s) s.textContent = t || ""; }
  function refreshGo() {
    var go = document.querySelector("#cssos-vc-actions .vc-go");
    var consent = document.getElementById("cssos-vc-consent");
    if (go) go.disabled = !(_blob && consent && consent.checked);
  }

  async function startRec() {
    var btn = document.querySelector(".vc-rec");
    if (_rec && _rec.state === "recording") { try { _rec.stop(); } catch (_e) {} return; }
    try {
      _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (_e) { setStatus(lc("Mic blocked — allow microphone, or upload a file.", "麦克风被拒 —— 请允许麦克风,或改为上传文件。")); return; }
    _chunks = [];
    try { _rec = new MediaRecorder(_stream); } catch (_e) { setStatus(lc("Recording not supported — upload a file.", "此设备不支持录音 —— 请上传文件。")); return; }
    _rec.ondataavailable = function (e) { if (e.data && e.data.size) _chunks.push(e.data); };
    _rec.onstop = function () {
      stopMeter();
      _blob = new Blob(_chunks, { type: _chunks[0] && _chunks[0].type || "audio/webm" });
      try { _stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_e) {}
      var dur = 0; try { dur = 0; } catch (_e) {}
      setStatus(lc("Recorded ✓ — ", "已录制 ✓ —— ") + Math.round((_blob.size / 1024)) + " KB. " + lc("Sing more = better.", "唱得越多越好。"));
      if (btn) { btn.classList.remove("is-rec"); btn.textContent = "● " + lc("Record again", "重新录"); }
      refreshGo();
    };
    _rec.start();
    startMeter(btn); // 进度+音量合一条, 3 分钟自动停
    if (btn) { btn.classList.add("is-rec"); btn.textContent = "■ " + lc("Stop", "停止"); }
    setStatus(lc("Recording… sing up to 3 min (a cappella best). Auto-stops at 3:00.", "录音中…清唱最多 3 分钟(清唱最佳)。满 3 分钟自动结束。"));
  }

  function pollStatus(voiceKey) {
    clearTimeout(_pollTimer);
    fetch("/api/voice-models", { credentials: "include" }).then(function (r) { return r.json(); }).then(function (j) {
      var v = (j && j.voices || []).find(function (x) { return x.voice_key === voiceKey; });
      if (!v) { _pollTimer = setTimeout(function () { pollStatus(voiceKey); }, 8000); return; }
      if (v.status === "ready") {
        setStatus(lc("✅ Your voice is ready! Add it to any song from the 🎤 menu.", "✅ 你的声线训练完成!在 🎤 多声线里给任意歌曲加上它。"));
        toast(lc("Your voice is ready 🎙️", "你的声线训练完成 🎙️"));
        return;
      }
      if (v.status === "failed") { setStatus(lc("Training failed — try a longer, cleaner clip.", "训练失败 —— 换一段更长更干净的清唱再试。") + (v.error ? " (" + v.error + ")" : "")); return; }
      setStatus(lc("Training your voice… (~20–40 min). You can close this; it runs in the background.", "正在训练你的声线…(约 20–40 分钟)。可以关闭,后台继续跑。"));
      _pollTimer = setTimeout(function () { pollStatus(voiceKey); }, 12000);
    }).catch(function () { _pollTimer = setTimeout(function () { pollStatus(voiceKey); }, 12000); });
  }

  async function submit() {
    var consent = document.getElementById("cssos-vc-consent");
    if (!_blob || !consent || !consent.checked) return;
    var go = document.querySelector("#cssos-vc-actions .vc-go");
    if (go) { go.disabled = true; go.textContent = lc("Uploading…", "上传中…"); }
    var label = (document.getElementById("cssos-vc-label") || {}).value || "My Voice";
    var fd = new FormData();
    fd.append("audio", _blob, "myvoice.webm");
    fd.append("consent", "true");
    fd.append("label", String(label).slice(0, 40));
    try {
      var r = await fetch("/api/voice-models", { method: "POST", credentials: "include", body: fd });
      var j = await r.json();
      if (j && j.ok && j.voice_key) {
        try { if (typeof globalThis.cssosMountLanguagePill === "function" && globalThis.__cssosCurrentWorkId) globalThis.cssosMountLanguagePill(globalThis.__cssosCurrentWorkId); } catch (_e) {}
        if (go) { go.textContent = lc("Training…", "训练中…"); }
        pollStatus(j.voice_key);
      } else {
        var code = (j && j.error) || "error";
        setStatus(code === "sign_in_required" ? lc("Please sign in first.", "请先登录。")
          : code === "consent_required" ? lc("Please confirm the consent box.", "请先勾选同意。")
            : lc("Upload failed: ", "上传失败:") + code);
        if (go) { go.disabled = false; go.textContent = lc("Train my voice", "训练我的声线"); }
      }
    } catch (_e) {
      setStatus(lc("Network error — try again.", "网络错误,请重试。"));
      if (go) { go.disabled = false; go.textContent = lc("Train my voice", "训练我的声线"); }
    }
  }

  globalThis.cssosOpenVoiceCloneModal = function () {
    injectStyle();
    _blob = null; _chunks = [];
    var m = document.getElementById("cssos-vc-modal");
    if (!m) {
      m = document.createElement("div"); m.id = "cssos-vc-modal";
      m.innerHTML =
        '<div id="cssos-vc-card" role="dialog" aria-modal="true">' +
          "<h3>🎙️ " + lc("Sing in your own voice", "用我的声音唱") + "</h3>" +
          '<div class="vc-sub">' + lc("Record 1–3 minutes of your voice (singing a cappella works best). We train a private voice model so any song can be re-sung in YOUR voice — in any language. Melody, lyrics and timing stay the same; only the timbre becomes yours.",
            "录 1–3 分钟你的声音(清唱最佳)。我们为你训练一个私密声线模型,任意歌曲都能用【你的声音】重唱、跨语言。旋律/歌词/节奏不变,只把音色换成你。") + "</div>" +
          '<div class="vc-row"><button type="button" class="vc-btn vc-rec">● ' + lc("Record", "录音") + "</button>" +
            '<label class="vc-btn vc-file">📁 ' + lc("Upload audio", "上传音频") + '<input type="file" accept="audio/*" style="display:none"></label></div>' +
          '<div class="vc-status"></div>' +
          '<div class="vc-row"><input id="cssos-vc-label" type="text" maxlength="40" placeholder="' + lc("Name this voice (e.g. My Voice)", "给声线起个名(如 我的声音)") + '"></div>' +
          '<label class="vc-consent"><input type="checkbox" id="cssos-vc-consent">' +
            '<span>' + lc("This is my own voice. I authorize CSS Studio to use it to sing my works. I will NOT upload anyone else’s or a celebrity’s voice. I can delete it anytime.",
              "这是我本人的声音。我授权 CSS Studio 用它演唱我的作品。我不会上传他人/名人的声音。我可随时删除。") + "</span></label>" +
          '<div id="cssos-vc-actions"><button type="button" class="vc-cancel"></button><button type="button" class="vc-go" disabled></button></div>' +
        "</div>";
      document.body.appendChild(m);
      m.addEventListener("click", function (e) { if (e.target === m) close(); });
      m.querySelector(".vc-cancel").addEventListener("click", close);
      m.querySelector(".vc-go").addEventListener("click", submit);
      m.querySelector(".vc-rec").addEventListener("click", startRec);
      m.querySelector("#cssos-vc-consent").addEventListener("change", refreshGo);
      m.querySelector(".vc-file input").addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0]; if (!f) return;
        _blob = f; setStatus(lc("Loaded ✓ ", "已载入 ✓ ") + Math.round(f.size / 1024) + " KB"); refreshGo();
      });
    }
    m.querySelector(".vc-cancel").textContent = lc("Cancel", "取消");
    m.querySelector(".vc-go").textContent = lc("Train my voice", "训练我的声线");
    setStatus("");
    m.hidden = false;
  };

  // CSSOS_WAVE_587 — 全局「我的声线」管理: 列出/训练/删除个人声纹(不绑某首歌)。
  globalThis.cssosOpenMyVoicesModal = function () {
    injectStyle();
    var m = document.getElementById("cssos-mv-mgr");
    if (!m) {
      m = document.createElement("div"); m.id = "cssos-mv-mgr";
      m.style.cssText = "position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:var(--cssos-overlay);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);";
      m.innerHTML =
        '<div id="cssos-vc-card" role="dialog" aria-modal="true">' +
          "<h3>🎙️ " + lc("My Voices", "我的声线") + "</h3>" +
          '<div class="vc-sub">' + lc("Your private voice models. Train once — use to sing any song, in any language.",
            "你的私密声线模型。训一次,任意歌曲、任意语言都能用你的声音唱。") + "</div>" +
          '<div id="cssos-mv-list" style="margin:8px 0;"></div>' +
          '<div id="cssos-vc-actions"><button type="button" class="vc-cancel"></button><button type="button" class="vc-go"></button></div>' +
        "</div>";
      document.body.appendChild(m);
      m.addEventListener("click", function (e) { if (e.target === m) m.hidden = true; });
      m.querySelector(".vc-cancel").addEventListener("click", function () { m.hidden = true; });
      m.querySelector(".vc-go").addEventListener("click", function () { m.hidden = true; globalThis.cssosOpenVoiceCloneModal(); });
    }
    m.querySelector(".vc-cancel").textContent = lc("Close", "关闭");
    m.querySelector(".vc-go").textContent = "➕ " + lc("Train a new voice", "训练新声线");
    var list = m.querySelector("#cssos-mv-list");
    list.innerHTML = '<div class="vc-status">' + lc("Loading…", "加载中…") + "</div>";
    fetch("/api/voice-models", { credentials: "include" }).then(function (r) { return r.json(); }).then(function (j) {
      var mine = (j && j.voices || []).filter(function (v) { return /^u_/.test(v.voice_key); });
      if (!mine.length) {
        // CSSOS_WAVE_588 线4 — 统一空态组件 + 引导 CTA(训练第一个声线)。
        if (typeof globalThis.cssosMountEmptyState === "function") {
          globalThis.cssosMountEmptyState(list, {
            icon: "🎙️",
            title: lc("No voices yet", "还没有声线"),
            sub: lc("Train your voice once — then sing any song, in any language, in YOUR voice.", "训一次你的声音 —— 任意歌曲、任意语言,都能用你自己的声音唱。"),
            ctaLabel: "➕ " + lc("Train a new voice", "训练新声线"),
            onCta: function () { var m = document.getElementById("cssos-mv-mgr"); if (m) m.hidden = true; globalThis.cssosOpenVoiceCloneModal && globalThis.cssosOpenVoiceCloneModal(); },
          });
        } else { list.innerHTML = '<div class="vc-status">' + lc("No voices yet — train your first one below.", "还没有声线 —— 在下方训练你的第一个。") + "</div>"; }
        return;
      }
      list.innerHTML = "";
      mine.forEach(function (v) {
        var row = document.createElement("div"); row.className = "vc-row"; row.style.justifyContent = "space-between";
        var st = v.status === "ready" ? "✅" : v.status === "failed" ? "⚠️" : "⏳";
        row.innerHTML = '<span>🎙️ ' + (v.label || lc("My Voice", "我的声音")) + ' <span style="opacity:.6">' + st + " " + v.status + "</span></span>";
        var del = document.createElement("button"); del.className = "vc-btn vc-file"; del.textContent = "🗑 " + lc("Delete", "删除");
        del.addEventListener("click", function () {
          if (!confirm(lc("Delete this voice model?", "删除这个声线模型?"))) return;
          fetch("/api/voice-models/" + encodeURIComponent(v.voice_key), { method: "DELETE", credentials: "include" })
            .then(function () { globalThis.cssosOpenMyVoicesModal(); });
        });
        row.appendChild(del); list.appendChild(row);
      });
    }).catch(function () { list.innerHTML = '<div class="vc-status">' + lc("Could not load.", "加载失败。") + "</div>"; });
    m.hidden = false;
  };
})();
