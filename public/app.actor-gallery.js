/* CSSOS_WAVE_113 20260702 — Jing「数字演员(Digital Actor)」图鉴页(Phase 1)。
 * 自成一体的演员图鉴 overlay: 浏览平台演员(合成/文明), 看详情(codex), 一键"选角"
 * (接 cssosOpenAssistantWithPrompt 创作入口, 绝不死胡同)。读后端 /api/actors + /:id/codex。
 * 宪法: 黑+翠绿(#00F5A0 填充配深墨字)/ skeleton-first / 引导式无死胡同。
 * 入口: 全局 cssosOpenActorGallery(); 或 hash #actors。 */
(function () {
  "use strict";
  var GREEN = "#00F5A0", INK = "#04120C";
  var ROOT_ID = "cssos-actor-gallery";
  // W1647 — 分享链接 /?actor=<id> 进来 → 立刻钉下"分享会话"旗标, 抑制 10s 自动进 MV 连播的倒计时
  //   (autoplay-feed 的守卫优先看此旗标)。在模块解析时(远早于 1500ms 倒计时)就设, 不怕 URL 被清空。
  try { if (/[?&]actor=/.test(location.search || "")) globalThis.__cssosShareLinkActive = true; } catch (_e) {}
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var cents = function (c) { return "¢" + Math.round(Number(c || 0)); };
  // W1637 (C) — 录音→上传→服务端 Whisper 转写(替代 Safari 没有的 webkitSpeechRecognition)。
  //   开始录音, 把 recorder 存到 micBtn.__rec; 调用方 micBtn.__rec.stop() 停止 → 转写 → onText(文字)。
  //   onState(state): recording/transcribing/done/empty/signin/ratelimit/denied/unsupported/error。
  function agStartRecord(micBtn, lang, onText, onState) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") { if (onState) onState("unsupported"); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], mime = "";
      try { ["audio/webm", "audio/mp4", "audio/ogg"].some(function (m) { if (MediaRecorder.isTypeSupported(m)) { mime = m; return true; } return false; }); } catch (e) {}
      var mr; try { mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); } catch (e) { try { mr = new MediaRecorder(stream); } catch (e2) { stream.getTracks().forEach(function (t) { t.stop(); }); if (onState) onState("unsupported"); return; } }
      micBtn.__rec = mr;
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      // W1648 — 免提 VAD: 说话后静音持续 ~1.1s → 自动停(= 发送); 封顶 15s。让「免提唠嗑」名副其实(停顿即发),
      //   不必再点第二下。用 AnalyserNode 测音量: 先检测到说话(_spoke)才在静音后触发, 避免一开口前的静默就停。
      var _vac = null, _vraf = 0, _spoke = false, _sil = 0, _t0 = Date.now();
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          _vac = new AC();
          var _sn = _vac.createMediaStreamSource(stream), _an = _vac.createAnalyser();
          _an.fftSize = 512; _sn.connect(_an); var _buf = new Uint8Array(_an.frequencyBinCount);
          var _vad = function () {
            if (!micBtn.__rec) return;   // 已停
            try { _an.getByteFrequencyData(_buf); } catch (e) { return; }
            var s = 0; for (var i = 0; i < _buf.length; i++) s += _buf[i]; var avg = s / _buf.length; var now = Date.now();
            if (avg > 9) { _spoke = true; _sil = 0; }   // W1653 — 门槛 13→9(Safari Analyser 读数偏低, 免得说了话不算数)
            else if (_spoke && (now - _t0) > 1200) { if (!_sil) _sil = now; else if (now - _sil > 1300) { try { mr.stop(); } catch (e) {} return; } }   // 至少录 1.2s 再允许静音停; 停顿窗 1.1→1.3s(别切太早)
            if (now - _t0 > 15000) { try { mr.stop(); } catch (e) {} return; }   // 兜底封顶
            _vraf = requestAnimationFrame(_vad);
          };
          _vraf = requestAnimationFrame(_vad);
        }
      } catch (e) {}
      mr.onstop = function () {
        try { if (_vraf) cancelAnimationFrame(_vraf); } catch (e) {}
        try { if (_vac) _vac.close(); } catch (e) {}
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        micBtn.__rec = null;
        var blob = new Blob(chunks, { type: mime || "audio/webm" });
        if (!blob.size) { if (onState) onState("empty"); return; }
        if (onState) onState("transcribing");
        fetch("/api/actors/stt" + (lang ? "?lang=" + encodeURIComponent(lang) : ""), { method: "POST", headers: { "Content-Type": blob.type }, body: blob, credentials: "include" })
          .then(function (r) { var st = r.status; return r.json().catch(function () { return {}; }).then(function (j) { return { st: st, j: j }; }); })
          .then(function (o) {
            var txt = o.j && o.j.data && o.j.data.text;
            try { _f2fBeacon({ type: "stt", blob: blob.size, ct: (blob.type || mime || ""), st: o.st, code: (o.j && o.j.code) || "", tlen: (txt || "").length }); } catch (e) {}   // W1653 — 远程看清 "Didn't catch that": 录音多大? 空转还是 NO_AUDIO?
            if (o.st === 401 || (o.j && o.j.code === "SIGN_IN_REQUIRED")) { if (onState) onState("signin"); return; }
            if (o.j && o.j.code === "RATE_LIMIT") { if (onState) onState("ratelimit"); return; }
            if (txt && txt.trim()) { if (onState) onState("done"); onText(txt.trim()); }
            else { if (onState) onState("empty"); }
          }).catch(function (e) { try { _f2fBeacon({ type: "stt", blob: blob.size, err: String((e && e.message) || e).slice(0, 80) }); } catch (e2) {} if (onState) onState("error"); });
      };
      if (onState) onState("recording");
      try { mr.start(); } catch (e) { if (onState) onState("error"); }
    }).catch(function () { if (onState) onState("denied"); });
  }
  function agStopRecord(micBtn) { try { if (micBtn && micBtn.__rec && micBtn.__rec.state !== "inactive") micBtn.__rec.stop(); } catch (e) {} }
  function agIsRecording(micBtn) { return !!(micBtn && micBtn.__rec && micBtn.__rec.state && micBtn.__rec.state !== "inactive"); }
  // W1653 — 同框遥测: SPIKE / STT 结果打点上报服务端(不劳人肉 copy localStorage)。sendBeacon 优先(即便页面崩/退也发得出)。
  var _f2fLastTele = 0;
  function _f2fBeacon(obj) {
    try {
      var s = JSON.stringify(obj);
      if (navigator.sendBeacon) navigator.sendBeacon("/api/f2f-telemetry", new Blob([s], { type: "application/json" }));
      else fetch("/api/f2f-telemetry", { method: "POST", headers: { "Content-Type": "application/json" }, body: s, keepalive: true, credentials: "include" }).catch(function () {});
    } catch (e) {}
  }
  // ── CSSOS_WAVE_1670 — 常驻内存探针 + 崩溃自动上报 (Jing: 别再手动 copy localStorage) ─────────
  //   进演员专页/面对面即每 1.5s 采样: DOM 节点 · 活动媒体解码器 · emotion-fx 层 · heap。
  //   越界 → 落盘 localStorage["cssos_probe"] + beacon 服务端(节流)。硬崩(无 pagehide)→ 下次启动
  //   检测到【未干净卸载】→ 自动 beacon 崩前样本(type:"crash-report"), 无需人肉 copy。
  var _agProbeTimer = 0, _agMemPeak = 0, _agProbeLastTele = 0, _agF2fRec = false, _agProbeLastLine = "";
  globalThis.cssosSetF2fRec = function (on) { _agF2fRec = !!on; };   // f2f 录制态推给探针
  function _agProbeCnt(sel) { try { return document.querySelectorAll(sel).length; } catch (e) { return -1; } }
  function _agProbeLiveMedia() { try { var ms = document.querySelectorAll("audio,video"), n = 0; for (var i = 0; i < ms.length; i++) { var m = ms[i]; if ((m.currentSrc && m.currentSrc.length) || m.srcObject) n++; } return n; } catch (e) { return -1; } }
  function _agProbeTick() {
    try {
      var all = document.getElementsByTagName("*").length; if (all > _agMemPeak) _agMemPeak = all;
      var pet = _agProbeCnt(".cssfx-petal"), grp = _agProbeCnt(".cssfx-center-grp"), med = _agProbeLiveMedia();
      var sparkEl = document.getElementById("cssfx-spark"), spark = sparkEl ? sparkEl.childElementCount : 0;
      var load = med * 15 + grp * 3 + pet * 2 + spark;
      var mem = (window.performance && performance.memory) ? Math.round(performance.memory.usedJSHeapSize / 1048576) + "MB" : "n/a";
      var line = "DOM " + all + " (peak " + _agMemPeak + ") · GPU~" + load + " · burst " + grp + " · petal " + pet + " · spark " + spark + " · media " + med + " · rec " + (_agF2fRec ? "ON" : "off") + " · heap " + mem;
      var spike = (all > 9000 || load > 250 || med > 4 || spark > 220 || grp > 22);
      // W1671 — 只在【数值变化或越界】时才写盘: 静息(同一行反复)零写入 → 省 Safari 同步 IO,
      //   且崩前爆发帧一定在变、照样留证。滚动最近 20 帧 + 心跳时间戳。
      if (spike || line !== _agProbeLastLine) {
        _agProbeLastLine = line;
        try {
          var b = JSON.parse(localStorage.getItem("cssos_probe") || "[]");
          b.push({ t: Date.now(), line: line, spike: spike });
          while (b.length > 20) b.shift();
          localStorage.setItem("cssos_probe", JSON.stringify(b));
          localStorage.setItem("cssos_probe_alive", String(Date.now()));
        } catch (e) {}
      }
      if (spike) {
        try { console.warn("[probe] ⚠ SPIKE — " + line); } catch (e) {}
        var now = Date.now();
        if (now - _agProbeLastTele > 3000) { _agProbeLastTele = now; _f2fBeacon({ type: "spike", line: line }); }
      }
    } catch (e) {}
  }
  function _agProbeStart() {
    if (_agProbeTimer) return;
    try { localStorage.removeItem("cssos_probe_clean"); } catch (e) {}   // 会话开始=未干净卸载(pagehide 才置回)
    try { _agProbeTimer = setInterval(_agProbeTick, 2500); } catch (e) {}   // W1671 — 1.5s→2.5s, 够抓崩前帧且更省
    _agProbeTick();
  }
  try {
    // 正常关页/切走 → 置 clean 标记, 下次启动不误报崩溃。
    var _agMarkClean = function () { try { localStorage.setItem("cssos_probe_clean", "1"); } catch (e) {} };
    window.addEventListener("pagehide", _agMarkClean, { passive: true });
    window.addEventListener("beforeunload", _agMarkClean);
  } catch (e) {}
  // 启动即检查: 上次会话有样本且【未干净卸载】= 硬崩 → 自动上报崩前样本, 再清空本次会话状态。
  (function _agReportPriorCrash() {
    try {
      var raw = localStorage.getItem("cssos_probe");
      var clean = localStorage.getItem("cssos_probe_clean") === "1";
      if (raw && !clean) {
        var samples = JSON.parse(raw || "[]");
        if (samples && samples.length) {
          var last = samples[samples.length - 1] || {};
          _f2fBeacon({ type: "crash-report", last: last.line || "", n: samples.length, alive: Number(localStorage.getItem("cssos_probe_alive") || 0), tail: samples.slice(-8).map(function (s) { return s.line; }) });
        }
      }
      localStorage.removeItem("cssos_probe");
      localStorage.removeItem("cssos_probe_clean");
    } catch (e) {}
  })();
  // W1638 — 柔性提醒的【可点链接】(不跳转): signin→去登录; 其它(balance/last_free…)→去充值。
  //   就地打开登录/充值弹层, 绝不强制跳走(Jing: 有链接、不建议直接跳转)。
  function agNudgeLink(code) {
    var topup = code !== "signin";
    var a = document.createElement("a");
    a.href = "#"; a.className = "ag-nudge-link";
    a.textContent = topup ? T("Top up", "去充值") : T("Sign in", "去登录");
    a.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        if (topup) { if (typeof globalThis.cssosOpenCreditsTopup === "function") globalThis.cssosOpenCreditsTopup(); }
        else { if (typeof window.cssosOpenLogin === "function") window.cssosOpenLogin(); }
      } catch (er) {}
    });
    return a;
  }
  // W1644 — 真·面部识别框脸(跨浏览器, 含 Safari)。让面部完整显示 —— Jing 硬要求。
  //   关键1: 封面走【同源】/api/img-thumb 代理加载 → canvas 不被跨域污染 → Safari 也能读像素。
  //   关键2: 优先 Chromium FaceDetector; 无则【肤色质心】启发式(与 app.face-safe-overlay 同思路, 全浏览器可用)。
  //   命中 → 居中人脸 + 嘴落脸中心下方; 全落空才保留 focal 框。
  function _agApplyFaceFrame(faceEl, tileEl, cx, cy) {
    try {
      cx = Math.min(0.98, Math.max(0.02, cx)); cy = Math.min(0.96, Math.max(0.06, cy));
      var cyUp = Math.min(0.94, cy + 0.08);   // W1652 — 取景略下移(bg-pos-y 增大=显示更低部分)→ 脸/嘴上移, 露更多下巴、少些额头(Jing)
      faceEl.style.backgroundPosition = (cx * 100).toFixed(1) + "% " + (cyUp * 100).toFixed(1) + "%";
      if (tileEl) tileEl.style.setProperty("--mouthy", Math.min(86, Math.max(28, cy * 100 + 4)).toFixed(0) + "%");
    } catch (e) {}
  }
  function frameFaceF2F(faceEl, tileEl, url) {
    if (!url || !faceEl) return;
    // 同源代理(jpg, 220 宽)→ 无污染, 可读像素; 失败也只是不精修。
    var proxied = "/api/img-thumb?fmt=jpg&w=220&u=" + encodeURIComponent(url);
    var img = new Image();
    img.onload = function () {
      var W = img.naturalWidth || 1, H = img.naturalHeight || 1;
      function skinDetect() {
        try {
          var sw = Math.min(120, W), sh = Math.max(1, Math.round(sw * H / W));
          var cv = document.createElement("canvas"); cv.width = sw; cv.height = sh;
          var g = cv.getContext("2d", { willReadFrequently: true }); if (!g) return;
          g.drawImage(img, 0, 0, sw, sh);
          var d = g.getImageData(0, 0, sw, sh).data;
          var sx = 0, sy = 0, n = 0;
          for (var y = 0; y < sh; y++) for (var x = 0; x < sw; x++) {
            var i = (y * sw + x) * 4, r = d[i], gg = d[i + 1], bb = d[i + 2];
            // 肤色经验判据(覆盖多种肤色, 排除纯灰/背景)。上半权重更高(脸通常在上方)。
            if (r > 60 && gg > 40 && bb > 20 && r > gg && gg >= bb && (r - bb) > 14 && (r - gg) > 3 && (r - gg) < 130) {
              var w = 1 + (1 - y / sh);   // 越靠上权重越大 → 偏向脸而非手/脖
              sx += x * w; sy += y * w; n += w;
            }
          }
          if (n < 8) return;   // 肤色太少 → 放弃, 留 focal
          _agApplyFaceFrame(faceEl, tileEl, (sx / n) / sw, (sy / n) / sh);
        } catch (e) {}
      }
      if (window.FaceDetector) {
        try {
          new window.FaceDetector({ maxDetectedFaces: 1, fastMode: true }).detect(img).then(function (faces) {
            if (faces && faces.length) {
              var b = faces[0].boundingBox;
              _agApplyFaceFrame(faceEl, tileEl, (b.x + b.width / 2) / W, (b.y + b.height / 2) / H);
            } else { skinDetect(); }
          }).catch(function () { skinDetect(); });
          return;
        } catch (e) {}
      }
      skinDetect();
    };
    img.onerror = function () {};
    img.src = proxied;
  }
  // W1644 — 进演员专页: 关闭 MV/watch 面板(Jing: 特别是 MV 面板要关掉, 不只是静音)。走面板自己的 × 逻辑(收进 Dock)。
  function _agCloseWatchPanel() {
    try {
      var wp = document.getElementById("watch-panel");
      if (!wp) return;
      var cs = getComputedStyle(wp);
      if (wp.classList.contains("hidden") || wp.classList.contains("is-hidden") || cs.display === "none" || cs.visibility === "hidden") return;
      var btn = wp.querySelector('[data-i18n-aria="action.close"]') || wp.querySelector('[aria-label="Close"]');
      if (btn) btn.click();
    } catch (e) {}
  }
  // W1646 — 进演员专页 → 关闭【所有其它面板】, 只剩专页(Jing)。走各面板自己的 × 逻辑(收进 Dock)。
  //   演员画廊本身是全屏 overlay(#ROOT_ID, 非 .panel)→ 不会被关; logo 底座保留。
  function _agCloseAllPanels() {
    try {
      var root = document.getElementById(ROOT_ID);
      document.querySelectorAll(".panel:not(.hidden)").forEach(function (p) {
        if (root && root.contains(p)) return;              // 别关演员画廊自身
        if (p.classList.contains("logo-panel")) return;    // 保留主界面 logo 底座
        var btn = p.querySelector('[data-i18n-aria="action.close"]') || p.querySelector('[aria-label="Close"]');
        if (btn) { try { btn.click(); } catch (e) {} }
        else { try { p.classList.add("hidden"); } catch (e2) {} }   // 无关闭钮兜底
      });
    } catch (e) {}
  }
  // W1643 — 进演员专页/同框: 暂停+静音所有【其它面板】的媒体(不含演员画廊自身/同框层)。
  //   修「分享链接进来 → MV 仍在背景续播 + 情绪字幕穿透」+ 减一路视频解码内存(缓解崩溃)。
  function _agPauseBgMedia() {
    try {
      var root = document.getElementById(ROOT_ID);
      var ov = document.querySelector(".ag-f2f-ov");
      document.querySelectorAll("video,audio").forEach(function (m) {
        if (root && root.contains(m)) return;
        if (ov && ov.contains(m)) return;
        try { if (!m.paused) m.pause(); } catch (e) {}
        try { if (!m.muted) m.muted = true; } catch (e2) {}
        // W1645 — 断源释放解码器(只 pause 不够, 6 路视频常驻内存 → OOM)。背景媒体本就该停。
        try { if (m.srcObject) m.srcObject = null; } catch (e3) {}
        var had = false;
        try { if (m.getAttribute("src")) { m.removeAttribute("src"); had = true; } } catch (e4) {}
        try { var ss = m.querySelectorAll("source"); for (var k = 0; k < ss.length; k++) { ss[k].removeAttribute("src"); had = true; } } catch (e5) {}
        try { if (had) m.load(); } catch (e6) {}
      });
    } catch (e) {}
  }
  var hueOf = function (s) { var h = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
  // i18n: 走平台 loginCopy(默认英文), 无则英文兜底(绝不硬编码中文, 见平台 i18n 铁律)。
  var T = function (en, zh) { try { return (typeof window.loginCopy === "function") ? window.loginCopy(en, zh) : en; } catch (_e) { return en; } };
  // 懒加载 <model-viewer>(Google 官方 web component, 交互旋转 GLB)。
  var mvLoaded = false;
  function ensureModelViewer(cb) {
    if (mvLoaded || window.customElements && customElements.get("model-viewer")) { mvLoaded = true; return cb && cb(); }
    var s = document.createElement("script"); s.type = "module";
    s.src = "/vendor/model-viewer.min.js";   // 自托管(同源, 避 CSP 拦外链)
    s.onload = function () { mvLoaded = true; cb && cb(); };
    s.onerror = function () { cb && cb(); };
    document.head.appendChild(s);
  }

  function ensureStyle() {
    if (document.getElementById(ROOT_ID + "-css")) return;
    var st = document.createElement("style");
    st.id = ROOT_ID + "-css";
    st.textContent =
      // 对称: 所有行(顶部胶囊/两条筛选/卡片区)统一左右内缩 12px; 行间统一 8px(ROOT gap)。
      "#" + ROOT_ID + "{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;gap:8px;background:rgba(2,10,7,.94);backdrop-filter:blur(6px);color:#e8fff5;font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;}" +
      "#" + ROOT_ID + " .ag-bar{display:flex;align-items:center;gap:14px;padding:16px 12px 6px;border-bottom:1px solid rgba(0,245,160,.18);}" +
      "#" + ROOT_ID + " .ag-title{font-size:22px;font-weight:800;letter-spacing:.3px;white-space:nowrap;flex:0 0 auto;}" +   // W1577 — 总标题永不折行
      "#" + ROOT_ID + " .ag-title b{color:" + GREEN + ";}" +
      "#" + ROOT_ID + " .ag-spacer{flex:1;}" +
      // W1577 — 胶囊轨道: 窄屏可缩+横滑, 把空间让给不折行的标题(760px 以下走下面的 @media 换行规则)
      "#" + ROOT_ID + " .ag-topcap{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;overflow-x:auto;scrollbar-width:none;}" +
      "#" + ROOT_ID + " .ag-topcap::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-topcap>*{flex:0 0 auto;}" +
      "#" + ROOT_ID + " .ag-search{background:rgba(0,245,160,.08);border:1px solid rgba(0,245,160,.3);color:#e8fff5;border-radius:999px;padding:8px 16px;font-size:14px;min-width:220px;outline:none;}" +
      "#" + ROOT_ID + " .ag-x{background:rgba(255,255,255,.08);border:none;color:#e8fff5;width:38px;height:38px;border-radius:50%;font-size:20px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-x:hover{background:rgba(255,255,255,.16);}" +
      /* 5 个筛选=一条胶囊轨道(不断行, 窄屏可横滑), 激活凸绿, 胶囊宪法 */
      "#" + ROOT_ID + " .ag-filters{display:flex;gap:8px;padding:0;margin:0 12px !important;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}" +
      "#" + ROOT_ID + " .ag-filters::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-chip{flex:0 0 auto;white-space:nowrap;background:rgba(255,255,255,.08);border:1px solid rgba(0,245,160,.22);color:#cfeee0;border-radius:999px;padding:8px 16px;font-size:14px;font-weight:600;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-chip.on{background:" + GREEN + ";color:" + INK + ";border-color:" + GREEN + ";box-shadow:0 0 14px rgba(0,245,160,.4);}" +
      /* 平台胶囊接管时: 去本地 chip 底色; 强制色调宪法(全绿 --ph:155, 激活深墨字, 未激活浅绿字可读) */
      "#" + ROOT_ID + " .ag-pillbar .ag-chip,#" + ROOT_ID + " .ag-pillbar .ag-sc-btn,#" + ROOT_ID + " .ag-pillbar .ag-capchip{background:transparent;border:none;box-shadow:none;}" +
      "#" + ROOT_ID + " .ag-pillbar [data-pill-key]{--ph:155 !important;--pill-hue:155 !important;color:#bff5e0 !important;font-weight:700;}" +
      "#" + ROOT_ID + " .ag-pillbar [data-pill-key].active{color:" + INK + " !important;}" +
      "#" + ROOT_ID + " .ag-scroll{flex:1;overflow:auto;padding:2px 12px 40px;}" +
      "#" + ROOT_ID + " .ag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px;}" +
      "#" + ROOT_ID + " .ag-card{background:rgba(255,255,255,.04);border:1px solid rgba(0,245,160,.14);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;content-visibility:auto;contain-intrinsic-size:auto 300px;}" +
      "#" + ROOT_ID + " .ag-card.expanded{content-visibility:visible;}" +   // 展开卡强制渲染(别被离屏优化藏了)
      "#" + ROOT_ID + " .ag-card:hover{transform:translateY(-3px);border-color:rgba(0,245,160,.55);box-shadow:0 0 22px rgba(0,245,160,.22);}" +
      "#" + ROOT_ID + " .ag-cover{aspect-ratio:1/1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;}" +
      "#" + ROOT_ID + " .ag-cover img{width:100%;height:100%;object-fit:cover;object-position:var(--foc,center 30%);display:block;}" +
      "#" + ROOT_ID + " .ag-initial{font-size:56px;font-weight:800;color:rgba(255,255,255,.9);text-shadow:0 2px 12px rgba(0,0,0,.5);}" +
      "#" + ROOT_ID + " .ag-badges{position:absolute;top:8px;left:8px;right:8px;display:flex;justify-content:space-between;gap:6px;pointer-events:none;}" +
      "#" + ROOT_ID + " .ag-badge{background:rgba(0,0,0,.55);border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;color:#daffee;}" +
      "#" + ROOT_ID + " .ag-badge.prem{background:" + GREEN + ";color:" + INK + ";}" +
      "#" + ROOT_ID + " .ag-meta{padding:11px 13px 13px;}" +
      "#" + ROOT_ID + " .ag-name{font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#" + ROOT_ID + " .ag-sub{font-size:12px;color:rgba(207,238,224,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}" +
      "#" + ROOT_ID + " .ag-row{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:rgba(207,238,224,.8);}" +
      "#" + ROOT_ID + " .ag-skel{background:linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.11),rgba(255,255,255,.05));background-size:200% 100%;animation:agsk 1.2s infinite;border-radius:16px;height:280px;}" +
      "@keyframes agsk{0%{background-position:200% 0;}100%{background-position:-200% 0;}}" +
      /* detail */
      "#" + ROOT_ID + " .ag-detail{max-width:1000px;margin:0 auto;}" +
      "#" + ROOT_ID + " .ag-back{background:rgba(255,255,255,.08);border:none;color:#e8fff5;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:18px;}" +
      "#" + ROOT_ID + " .ag-hero{display:flex;gap:24px;flex-wrap:wrap;}" +
      "#" + ROOT_ID + " .ag-hero-cover{width:260px;height:260px;border-radius:20px;overflow:hidden;flex:none;border:1px solid rgba(0,245,160,.3);display:flex;align-items:center;justify-content:center;}" +
      "#" + ROOT_ID + " .ag-hero-cover img{width:100%;height:100%;object-fit:cover;object-position:var(--foc,center 30%);}" +
      "#" + ROOT_ID + " .ag-hero-body{flex:1;min-width:260px;}" +
      "#" + ROOT_ID + " .ag-hero-name{font-size:30px;font-weight:800;}" +
      "#" + ROOT_ID + " .ag-hero-name small{font-size:16px;color:rgba(207,238,224,.7);font-weight:500;margin-left:10px;}" +
      "#" + ROOT_ID + " .ag-tags{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0;}" +
      "#" + ROOT_ID + " .ag-stats{display:flex;flex-wrap:wrap;gap:8px 18px;margin:10px 0 2px;font-size:13px;color:#9ec3b4;}" +
      "#" + ROOT_ID + " .ag-stats span{display:inline-flex;align-items:center;gap:5px;}" +
      "#" + ROOT_ID + " .ag-stats b{color:#eafff6;font-weight:800;font-variant-numeric:tabular-nums;}" +
      "#" + ROOT_ID + " .ag-cta-cap .ag-cnt{font-weight:800;font-variant-numeric:tabular-nums;opacity:.85;margin-left:3px;}" +
      "#" + ROOT_ID + " .ag-tag{background:rgba(0,245,160,.12);border:1px solid rgba(0,245,160,.3);color:#bff5e0;border-radius:999px;padding:4px 12px;font-size:12px;}" +
      "#" + ROOT_ID + " .ag-persona{color:rgba(232,255,245,.88);margin:10px 0;}" +
      // 《问道》W1582 — 对话框
      "#" + ROOT_ID + " .ag-wendao{position:relative;margin:4px 0 12px;padding:12px;border:1px solid rgba(0,245,160,.22);border-radius:16px;background:rgba(0,20,14,.35);}" +
      "#" + ROOT_ID + " .ag-wd-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;}" +
      "#" + ROOT_ID + " .ag-wd-headright{display:flex;align-items:center;gap:10px;}" +
      "#" + ROOT_ID + " .ag-wd-mute,#" + ROOT_ID + " .ag-wd-reset{border:1px solid rgba(0,245,160,.3);background:rgba(0,245,160,.1);border-radius:999px;cursor:pointer;font-size:15px;padding:4px 9px;line-height:1;color:inherit;}" +
      "#" + ROOT_ID + " .ag-wd-chips{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0 2px;}" +
      "#" + ROOT_ID + " .ag-wd-chip{border:1px solid rgba(0,245,160,.3);background:rgba(0,245,160,.08);color:#cfffe9;border-radius:999px;padding:5px 12px;font-size:13px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-wd-chip:hover{background:rgba(0,245,160,.18);}" +
      "#" + ROOT_ID + " .ag-wd-actor.ag-wd-hasav{position:relative;padding-left:56px;min-height:46px;}" +
      "#" + ROOT_ID + " .ag-wd-bav{position:absolute;left:10px;top:9px;width:38px;height:38px;border-radius:50%;background-size:cover;background-position:center top;border:1.5px solid rgba(0,245,160,.45);box-shadow:0 4px 14px rgba(0,0,0,.5);will-change:transform;}" +
      "#" + ROOT_ID + " .ag-wd-note{color:#FFD54A;font-size:13px;text-align:center;padding:6px 8px;opacity:.9;}" +
      "#" + ROOT_ID + " .ag-nudge-link{display:inline-block;margin-left:8px;padding:2px 11px;border-radius:999px;background:rgba(0,245,160,.18);border:1px solid rgba(0,245,160,.5);color:#7CFFC4;font-size:12px;font-weight:700;text-decoration:none;cursor:pointer;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-nudge-link:hover{background:rgba(0,245,160,.3);}" +
      ".ag-f2f-flash .ag-nudge-link{color:#eafff6;border-color:rgba(255,255,255,.6);}" +
      "#" + ROOT_ID + " .ag-wd-title{font-weight:800;font-size:15px;color:#7CFFC4;}" +
      "#" + ROOT_ID + " .ag-wd-lang{display:inline-flex;min-width:160px;}" +
      "#" + ROOT_ID + " .ag-wd-log{display:flex;flex-direction:column;gap:8px;max-height:340px;overflow-y:auto;padding:4px 2px;}" +
      "#" + ROOT_ID + " .ag-wd-msg{box-sizing:border-box;max-width:86%;padding:9px 13px;border-radius:14px;font-size:15px;line-height:1.5;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;}" +
      "#" + ROOT_ID + " .ag-wd-user{align-self:flex-end;background:rgba(0,245,160,.16);border:1px solid rgba(0,245,160,.32);color:#eafff6;border-bottom-right-radius:4px;}" +
      "#" + ROOT_ID + " .ag-wd-actor{align-self:flex-start;max-width:100%;background:rgba(8,26,20,.9);border:1px solid rgba(0,245,160,.28);color:#f2fff9;border-bottom-left-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,.35);}" +
      "#" + ROOT_ID + " .ag-wd-speak,#" + ROOT_ID + " .ag-wd-copy,#" + ROOT_ID + " .ag-wd-save,#" + ROOT_ID + " .ag-wd-share{margin-left:8px;border:0;background:transparent;cursor:pointer;font-size:15px;opacity:.65;padding:0 2px;vertical-align:baseline;line-height:1;}" +
      "#" + ROOT_ID + " .ag-wd-speak:hover,#" + ROOT_ID + " .ag-wd-copy:hover,#" + ROOT_ID + " .ag-wd-save:hover,#" + ROOT_ID + " .ag-wd-share:hover{opacity:1;}" +
      "#" + ROOT_ID + " .ag-wd-save.on{opacity:1;color:#FFD54A;}" +
      // 《问道》我的收藏弹窗(挂 body, 全局规则不加 ROOT_ID 前缀)
      ".ag-mycol-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;}" +
      ".ag-mycol-box{background:#0b1512;border:1px solid rgba(0,245,160,.3);border-radius:18px;max-width:640px;width:100%;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.6);}" +
      ".ag-mycol-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);color:#eafff6;font-size:18px;}" +
      ".ag-mycol-x{border:0;background:transparent;color:#eafff6;font-size:24px;cursor:pointer;line-height:1;}" +
      ".ag-mycol-list{overflow-y:auto;padding:14px 20px;display:flex;flex-direction:column;gap:12px;}" +
      ".ag-mycol-empty{color:rgba(232,255,245,.6);text-align:center;padding:30px 10px;}" +
      ".ag-mycol-item{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 14px;background:rgba(255,255,255,.03);}" +
      ".ag-mycol-who{display:flex;align-items:center;justify-content:space-between;color:#7CFFC4;font-size:14px;margin-bottom:6px;}" +
      ".ag-mycol-del{border:0;background:transparent;cursor:pointer;font-size:15px;opacity:.6;}" +
      ".ag-mycol-del:hover{opacity:1;}" +
      ".ag-mycol-q{color:rgba(232,255,245,.7);font-size:14px;margin-bottom:6px;font-style:italic;}" +
      ".ag-mycol-a{color:#f2fff9;font-size:15px;line-height:1.55;white-space:pre-wrap;}" +
      // 同框视频通话(全局, 挂 body)
      ".ag-f2f-ov{position:fixed;inset:0;z-index:2147483000;background:#050a08;display:flex;flex-direction:column;}" +
      ".ag-f2f-stage{position:relative;flex:1;overflow:hidden;background:#04100b;}" +
      // W1641 — 纯 CSS 抽象演播厅背景(零成本): 顶光 + 双侧色光 + 地面渐变 + 缓慢漂移。两人镜/推拉时从画面边缘透出, 像演员端坐演播厅。
      ".ag-f2f-stage::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(130% 90% at 50% -12%,rgba(0,245,160,.13),transparent 55%),radial-gradient(70% 60% at 18% 26%,rgba(70,130,220,.11),transparent 70%),radial-gradient(70% 60% at 84% 38%,rgba(180,70,170,.10),transparent 72%),linear-gradient(180deg,#0a1712,#05100c 55%,#020906);}" +
      ".ag-f2f-stage::after{content:'';position:absolute;left:0;right:0;bottom:0;height:40%;z-index:0;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(0,245,160,.045) 55%,rgba(0,0,0,.55));}" +
      ".ag-f2f-actor,.ag-f2f-me{position:absolute;z-index:1;border-radius:16px;overflow:hidden;background:#111;box-shadow:0 8px 30px rgba(0,0,0,.6);transition:all .45s cubic-bezier(.4,0,.2,1);touch-action:none;will-change:transform;}" +
      // W1613 — 修"你大屏时妲己小窗被盖住": 当前小窗(PiP)永远置顶(两画面本是 position:absolute 无 z-index, 靠 DOM 顺序 → me 恒在上, 你大屏时压住妲己小窗)。
      ".ag-f2f-stage[data-speaker='actor'] .ag-f2f-me,.ag-f2f-stage[data-speaker='me'] .ag-f2f-actor{cursor:grab;z-index:6 !important;}" +
      /* W1695 — PiP 缩放抓手(FaceTime 式): 只出现在【当前小屏】的左上角, 往左上拖=变大。 */
      ".ag-f2f-grip{position:absolute;left:0;top:0;width:26px;height:26px;z-index:9;display:none;cursor:nwse-resize;touch-action:none;" +
        "background:linear-gradient(135deg,rgba(0,0,0,.55),transparent 62%);border-radius:16px 0 0 0;}" +
      ".ag-f2f-grip::after{content:'';position:absolute;left:6px;top:6px;width:11px;height:11px;border-left:2px solid rgba(255,255,255,.9);border-top:2px solid rgba(255,255,255,.9);border-radius:3px 0 0 0;}" +
      ".ag-f2f-stage[data-speaker='actor'] .ag-f2f-me>.ag-f2f-grip,.ag-f2f-stage[data-speaker='me'] .ag-f2f-actor>.ag-f2f-grip{display:block;}" +
      ".ag-f2f-actor{background-size:cover;background-position:center top;}" +
      ".ag-f2f-video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1);}" +
      // W1652 — 手机/App: 收窄画面边缘空白(inset 12→3) + 用户摄像头【完整显示】(object-fit:contain, 不裁掉人)。
      "@media(max-width:640px){" +
        ".ag-f2f-stage[data-speaker='actor'] .ag-f2f-actor{inset:3px;}" +
        ".ag-f2f-stage[data-speaker='me'] .ag-f2f-me{inset:3px;}" +
        ".ag-f2f-video{object-fit:contain;background:#0a1512;}" +
      "}" +
      ".ag-f2f-stage[data-speaker='actor'] .ag-f2f-actor{inset:12px;}" +
      ".ag-f2f-stage[data-speaker='actor'] .ag-f2f-me{width:22vw;max-width:220px;height:28vh;max-height:280px;right:24px;bottom:24px;}" +
      ".ag-f2f-stage[data-speaker='me'] .ag-f2f-me{inset:12px;}" +
      ".ag-f2f-stage[data-speaker='me'] .ag-f2f-actor{width:22vw;max-width:220px;height:28vh;max-height:280px;right:24px;bottom:24px;}" +
      ".ag-f2f-actor.speaking{box-shadow:0 8px 30px rgba(0,0,0,.6),0 0 calc(18px + var(--lip,0)*46px) rgba(0,245,160,.55);}" +
      // ===== W1642 D-1「会说话的头像」: 脸层 + 嘴层, 由已有的逐音节 --lip(0..1)驱动。纯 CSS, 零 GPU。
      //   脸层 .ag-f2f-face 承载封面图 + 说话时极轻的"活着"呼吸/微颔首(keyframe); 嘴层 .ag-f2f-mouth 随
      //   --lip 张合(柔和阴影, multiply 融进脸, 位置近似 → 轻量版; 真·GPU 口型/人脸关键点后续接同一 --lip)。
      //   脸层/嘴层各自 transform → 与导演运镜(actorTile.transform)、拖拽(inline left/top)互不打架。
      ".ag-f2f-face{position:absolute;inset:0;background-size:cover;background-position:center top;border-radius:inherit;will-change:transform;backface-visibility:hidden;}" +
      ".ag-f2f-actor.speaking .ag-f2f-face{animation:agFaceAlive 3.6s ease-in-out infinite;}" +
      "@keyframes agFaceAlive{0%,100%{transform:translateY(0) rotate(0deg) scale(1.006)}30%{transform:translateY(-.5%) rotate(-.35deg) scale(1.012)}65%{transform:translateY(.35%) rotate(.3deg) scale(1.008)}}" +
      ".ag-f2f-mouth{position:absolute;left:var(--mouthx,50%);top:var(--mouthy,54%);width:14%;height:8%;transform:translate(-50%,-50%) scaleY(var(--lip,0));transform-origin:50% 42%;border-radius:50%;background:radial-gradient(ellipse at 50% 42%,rgba(18,4,7,.5),rgba(30,8,12,.2) 55%,transparent 76%);opacity:calc(.06 + var(--lip,0)*.34);pointer-events:none;}" +
      ".ag-f2f-actor:not(.speaking) .ag-f2f-mouth{opacity:0;}" +
      // W1610 — 标题移到 stage 级后要补回舒适内距(大框 inset:12, 原先在 tile 内还有 14 → 现在合计 ~26)。
      ".ag-f2f-title{position:absolute;left:26px;top:24px;z-index:2;text-shadow:0 2px 8px #000;text-align:center;}" +
      ".ag-f2f-names{display:flex;align-items:center;gap:8px;justify-content:center;}" +
      ".ag-f2f-n{color:#eafff6;font-weight:800;font-size:17px;white-space:nowrap;}" +
      ".ag-f2f-n:first-child{color:#7CFFC4;}" +
      ".ag-f2f-ic{width:24px;height:17px;flex:none;filter:drop-shadow(0 1px 3px #000);cursor:pointer;}" +
      ".ag-f2f-brand{color:rgba(255,255,255,.72);font-size:12px;font-weight:600;letter-spacing:.5px;margin-top:2px;text-align:center;}" +
      ".ag-f2f-nocam{display:flex;align-items:center;justify-content:center;}" +
      ".ag-f2f-nocam::before{content:'📷';font-size:28px;opacity:.6;}" +
      ".ag-f2f-caption{position:absolute;left:0;right:0;bottom:0;padding:16px 20px;background:linear-gradient(transparent,rgba(0,0,0,.78));color:#fff;font-size:20px;line-height:1.5;white-space:pre-wrap;max-height:44%;overflow-y:auto;}" +
      // #4 底部保留传统整句字幕(纯白, 见 .ag-f2f-caption); 情绪字幕爆走平台 MV 引擎(cssosLineBurstWord), 全屏中心炸开。
      ".ag-f2f-caption{font-weight:700;text-shadow:0 2px 12px rgba(0,0,0,.7);}" +
      // 内存探针 HUD + 📊 开关
      ".ag-f2f-mem{position:absolute;top:54px;left:14px;z-index:7;max-width:72%;font:600 11px/1.5 ui-monospace,Menlo,monospace;color:#7CFFC4;background:rgba(2,10,7,.74);border:1px solid rgba(0,245,160,.4);border-radius:8px;padding:4px 8px;cursor:pointer;}" +
      // 录制结果持久卡 —— 居中显眼(避开右下角摄像头画中画)。
      ".ag-f2f-clip{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9;width:360px;max-width:88%;background:rgba(4,16,11,.98);border:1px solid rgba(0,245,160,.6);border-radius:16px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.7);}" +
      ".ag-f2f-clip-h{font-size:13px;font-weight:800;color:#eafff6;margin-bottom:8px;}" +
      ".ag-f2f-clip-v{width:100%;border-radius:8px;background:#000;display:block;margin-bottom:8px;max-height:180px;}" +
      // 图1 place1 — URL 链接框做成胶囊(999px)。
      ".ag-f2f-clip-url{font:600 10px/1.4 ui-monospace,Menlo,monospace;color:#8fd8bf;word-break:break-all;background:rgba(0,245,160,.08);border:1px solid rgba(0,245,160,.28);border-radius:999px;padding:6px 12px;margin-bottom:8px;text-align:center;}" +
      // 图1 place2 — 按钮行走平台凸嵌凹胶囊(cssosMakePillBar 接管 grid/gap/bg/border/mask 几何)。
      //   凸嵌凹的 mask 需 40px 高才成形 → 给 40px; 不设 bg/圆角(交给宪法), 只留内容排布。
      ".ag-f2f-clip-btns{display:flex;flex-wrap:wrap;}" +
      ".ag-f2f-clip-btns>[data-pill-key]{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:5px;color:#eafff6;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;}" +
      // 平台分享卡: 各社交平台胶囊格
      ".ag-f2f-share-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;}" +
      ".ag-f2f-share-t{display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 4px;border:1px solid rgba(0,245,160,.3);background:rgba(0,245,160,.09);border-radius:12px;color:#eafff6;font-size:10px;font-weight:700;cursor:pointer;transition:background .12s;}" +
      ".ag-f2f-share-t:hover{background:rgba(0,245,160,.22);}" +
      ".ag-f2f-share-ic{font-size:19px;line-height:1;font-weight:800;}" +
      ".ag-f2f-melabel{position:absolute;left:10px;bottom:8px;color:#fff;font-size:12px;text-shadow:0 1px 4px #000;z-index:2;}" +
      ".ag-f2f-me.ag-f2f-nocam{background:#1a2420;}" +
      ".ag-f2f-me.ag-f2f-nocam .ag-f2f-video{display:none;}" +
      ".ag-f2f-bar{display:flex;padding:12px 16px;background:#0b1512;align-items:stretch;}" +
      // 单条凸嵌凹胶囊轨道: 输入段(say)靠 cssosMakePillBar 的 input-fills-rest 吃满剩余; 3 按钮 max-content。
      ".ag-f2f-track{width:100%;}" +
      // 输入段: 不吃凸嵌凹 mask(否则右边凹进去切掉输入区)+ 保留可读深色底 + 左对齐。
      ".ag-f2f-track>.ag-f2f-text{-webkit-mask:none !important;mask:none !important;margin:0 !important;width:auto !important;border-radius:999px 0 0 999px !important;background:rgba(0,0,0,.42) !important;color:#eafff6 !important;min-height:44px;max-height:100px;resize:none;font-size:16px;font-family:inherit;text-align:left;padding:11px 16px !important;}" +
      ".ag-f2f-track>.ag-f2f-mic,.ag-f2f-track>.ag-f2f-rec,.ag-f2f-track>.ag-f2f-send{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:5px;color:#eafff6;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;}" +
      ".ag-f2f-rec>span{font-size:13px;}" +
      // 录制/免手中的红色态: !important 压过 pill 宪法的绿。
      ".ag-f2f-track>.ag-f2f-mic.rec,.ag-f2f-track>.ag-f2f-rec.rec{background:rgba(255,70,70,.55) !important;color:#fff !important;}" +
      ".ag-f2f-track>.ag-f2f-rec.rec{animation:agf2fpulse 1.1s ease-in-out infinite;}" +
      ".ag-f2f-track>.ag-f2f-rec:disabled{opacity:.6;cursor:default;}" +
      "@keyframes agf2fpulse{0%,100%{box-shadow:0 0 0 0 rgba(255,70,70,.5);}50%{box-shadow:0 0 0 7px rgba(255,70,70,0);}}" +
      ".ag-f2f-flash{position:absolute;left:50%;bottom:82px;transform:translateX(-50%);z-index:6;max-width:82%;background:rgba(3,14,9,.92);border:1px solid rgba(0,245,160,.5);color:#eafff6;padding:9px 16px;border-radius:999px;font-size:14px;font-weight:600;box-shadow:0 6px 22px rgba(0,0,0,.5);word-break:break-all;text-align:center;}" +
      ".ag-f2f-x{position:absolute;top:16px;right:20px;z-index:5;border:0;background:rgba(0,0,0,.5);color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;cursor:pointer;line-height:1;}" +
      "#" + ROOT_ID + " .ag-wd-speak.ag-wd-playing{animation:agWdPulse .7s ease-in-out infinite;}" +
      "#" + ROOT_ID + " .ag-cmt-copy,#" + ROOT_ID + " .ag-cmt-pin{border:0;background:transparent;cursor:pointer;font-size:13px;opacity:.55;padding:0 5px;}" +
      "#" + ROOT_ID + " .ag-cmt-copy:hover,#" + ROOT_ID + " .ag-cmt-pin:hover,#" + ROOT_ID + " .ag-cmt-pin.on{opacity:1;}" +
      "#" + ROOT_ID + " .ag-cmt-pinned{border-left:3px solid " + GREEN + ";padding-left:9px;background:rgba(0,245,160,.05);border-radius:6px;}" +
      "#" + ROOT_ID + " .ag-cmt-pin-badge{color:" + GREEN + ";font-weight:700;font-size:12px;margin-right:4px;}" +
      "#" + ROOT_ID + " .ag-wd-think{opacity:.6;animation:agWdPulse 1s ease-in-out infinite;}" +
      "@keyframes agWdPulse{0%,100%{opacity:.35}50%{opacity:.85}}" +
      "#" + ROOT_ID + " .ag-wd-input{display:flex;gap:8px;align-items:flex-end;margin-top:16px !important;}" +   // W1629 — 两行胶囊轨道别粘在一起: 显式加间距(!important + id 特异性压过宪法的 margin:14px 0 !important)。
      "#" + ROOT_ID + " .ag-wd-text{flex:1;min-height:40px;max-height:120px;resize:none;background:rgba(0,0,0,.3);border:1px solid rgba(0,245,160,.3);border-radius:12px;color:#eafff6;padding:9px 12px;font-size:15px;font-family:inherit;}" +
      "#" + ROOT_ID + " .ag-wd-text:focus{outline:none;border-color:rgba(0,245,160,.6);}" +
      "#" + ROOT_ID + " .ag-wd-mic,#" + ROOT_ID + " .ag-wd-send{border:1px solid rgba(0,245,160,.4);border-radius:12px;background:rgba(0,245,160,.14);color:#eafff6;padding:9px 14px;font-size:15px;cursor:pointer;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-wd-send{background:rgba(0,245,160,.28);font-weight:700;}" +
      "#" + ROOT_ID + " .ag-wd-send:disabled{opacity:.5;cursor:default;}" +
      "#" + ROOT_ID + " .ag-wd-mic.ag-wd-listening{background:rgba(255,80,80,.35);border-color:rgba(255,80,80,.7);animation:agWdPulse .8s ease-in-out infinite;}" +
      "#" + ROOT_ID + " .ag-willing{display:flex;align-items:center;gap:8px;margin:10px 2px 2px;font-size:13px;color:#bff5e0;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-willing input{width:16px;height:16px;accent-color:#00f5a0;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-cast{background:" + GREEN + ";color:" + INK + ";border:none;border-radius:999px;padding:12px 26px;font-size:16px;font-weight:800;cursor:pointer;margin-top:8px;box-shadow:0 0 20px rgba(0,245,160,.35);}" +
      "#" + ROOT_ID + " .ag-cast:hover{filter:brightness(1.08);}" +
      "#" + ROOT_ID + " .ag-cta-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}" +
      "#" + ROOT_ID + " .ag-share{background:transparent;color:#bff5e0;border:1px solid rgba(0,245,160,.45);border-radius:999px;padding:12px 22px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;}" +
      "#" + ROOT_ID + " .ag-share:hover{background:rgba(0,245,160,.12);}" +
      // 选角/评论/分享 胶囊走平台 cssosMakePillBar(与顶部筛选条同源凹凸镶嵌), 无需本地几何; 仅留上边距。
      "#" + ROOT_ID + " .ag-cta-cap{margin-top:6px;}" +
      // 评论面板
      "#" + ROOT_ID + " .ag-comments{margin-top:16px;border-top:1px solid rgba(0,245,160,.15);padding-top:14px;}" +
      "#" + ROOT_ID + " .ag-comments h3{font-size:15px;font-weight:800;color:#e8fff5;margin:0 0 10px;}" +
      "#" + ROOT_ID + " .ag-cmt-input{display:flex;gap:8px;align-items:flex-end;margin-bottom:14px;}" +
      "#" + ROOT_ID + " .ag-cmt-input textarea{flex:1;background:rgba(4,20,14,.6);border:1px solid rgba(0,245,160,.3);border-radius:14px;color:#e8fff5;padding:10px 12px;font-size:14px;font-family:inherit;resize:vertical;min-height:42px;}" +
      "#" + ROOT_ID + " .ag-cmt-send{background:" + GREEN + ";color:" + INK + ";border:0;border-radius:999px;padding:10px 18px;font-weight:800;font-size:14px;cursor:pointer;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-cmt{padding:10px 0;border-bottom:1px solid rgba(0,245,160,.1);}" +
      "#" + ROOT_ID + " .ag-cmt .who{font-size:12.5px;color:#8fe9c8;font-weight:700;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center;}" +
      "#" + ROOT_ID + " .ag-cmt .body{font-size:14px;color:#dff7ec;line-height:1.45;white-space:pre-wrap;word-break:break-word;}" +
      "#" + ROOT_ID + " .ag-cmt .del{background:none;border:0;color:#ff9a9a;font-size:11px;cursor:pointer;padding:2px 6px;}" +
      "#" + ROOT_ID + " .ag-cmt-empty{font-size:13px;color:#7fb8a3;padding:8px 0;}" +
      "#" + ROOT_ID + " .ag-cmt-actions{display:flex;gap:10px;align-items:center;}" +
      "#" + ROOT_ID + " .ag-cmt-meta{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:6px;}" +
      "#" + ROOT_ID + " .ag-cmt-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;line-height:1.6;color:#8fd8bf;background:rgba(0,245,160,.08);border:1px solid rgba(0,245,160,.22);border-radius:999px;padding:1px 9px;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-reply-btn{background:none;border:0;color:#8fe9c8;font-size:11px;cursor:pointer;padding:2px 6px;}" +
      "#" + ROOT_ID + " .ag-cmt-kids{margin-left:16px;border-left:2px solid rgba(0,245,160,.16);padding-left:12px;margin-top:6px;}" +
      "#" + ROOT_ID + " .ag-reply-box{display:flex;gap:8px;align-items:flex-end;margin:8px 0;}" +
      "#" + ROOT_ID + " .ag-reply-box textarea{flex:1;background:rgba(4,20,14,.6);border:1px solid rgba(0,245,160,.3);border-radius:12px;color:#e8fff5;padding:8px 10px;font-size:13px;font-family:inherit;resize:vertical;min-height:36px;}" +
      "#" + ROOT_ID + " .ag-reply-send{background:" + GREEN + ";color:" + INK + ";border:0;border-radius:999px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-slogan{font-size:12.5px;color:#8fe9c8;font-style:italic;margin:3px 0;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
      // 弹窗太宽→内部胶囊左右滑动; 太高→窗体上下滑动(同一套逻辑)。容器也允许滚动兜底(极矮屏)。
      "#" + ROOT_ID + " .ag-castmodal{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(2,10,7,.72);backdrop-filter:blur(3px);overflow-y:auto;padding:2vh 0;box-sizing:border-box;}" +
      "#" + ROOT_ID + " .ag-castmodal .box{background:#0a1712;border:1px solid rgba(0,245,160,.35);border-radius:20px;padding:22px;max-width:440px;width:88%;box-shadow:0 20px 60px rgba(0,0,0,.5);max-height:92vh;overflow-y:auto;overflow-x:hidden;}" +
      "#" + ROOT_ID + " .ag-castmodal h3{font-size:18px;font-weight:800;margin:0 0 4px;color:#e8fff5;}" +
      "#" + ROOT_ID + " .ag-castmodal .sub{font-size:13px;color:#a9e9cf;margin:0 0 16px;}" +
      // ④ P1 选角面板
      "#" + ROOT_ID + " .ag-cs-box{max-width:520px;max-height:86vh;overflow:auto;}" +
      "#" + ROOT_ID + " .ag-cs-slots{display:flex;flex-direction:column;gap:12px;}" +
      "#" + ROOT_ID + " .ag-cs-slot{border:1px solid rgba(0,245,160,.22);border-radius:14px;padding:10px 12px;background:rgba(0,245,160,.04);}" +
      "#" + ROOT_ID + " .ag-cs-role{font-size:13px;font-weight:800;color:#bff5e0;margin-bottom:8px;}" +
      "#" + ROOT_ID + " .ag-cs-roled{background:rgba(0,245,160,.12);border:1px solid rgba(0,245,160,.4);color:#e8fff5;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;cursor:pointer;outline:none;}" +
      "#" + ROOT_ID + " .ag-cs-lock{font-size:11px;font-weight:600;color:#7fb8a3;margin-left:6px;}" +
      "#" + ROOT_ID + " .ag-cs-pick{display:flex;align-items:center;gap:10px;}" +
      "#" + ROOT_ID + " .ag-cs-pick>img,#" + ROOT_ID + " .ag-cs-empty,#" + ROOT_ID + " .ag-cs-ini{width:46px;height:46px;border-radius:10px;object-fit:cover;flex:0 0 auto;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-weight:800;color:#bff5e0;}" +
      "#" + ROOT_ID + " .ag-cs-info{flex:1 1 auto;min-width:0;}" +
      "#" + ROOT_ID + " .ag-cs-name{font-size:14px;font-weight:700;color:#e8fff5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#" + ROOT_ID + " .ag-cs-sub{font-size:11.5px;color:#8fdcc0;}" +
      "#" + ROOT_ID + " .ag-cs-swap{background:rgba(0,245,160,.1);border:1px solid rgba(0,245,160,.35);color:#bff5e0;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;flex:0 0 auto;}" +
      "#" + ROOT_ID + " .ag-cs-pool{display:flex;gap:6px;overflow-x:auto;margin-top:8px;scrollbar-width:none;}" +
      "#" + ROOT_ID + " .ag-cs-pool::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-cs-cand{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:3px;width:56px;background:transparent;border:1px solid transparent;border-radius:10px;padding:4px;cursor:pointer;color:#cfeee0;}" +
      "#" + ROOT_ID + " .ag-cs-cand>img,#" + ROOT_ID + " .ag-cs-cand .ag-cs-ini{width:44px;height:44px;}" +
      "#" + ROOT_ID + " .ag-cs-cand.on{border-color:" + GREEN + ";background:rgba(0,245,160,.12);}" +
      "#" + ROOT_ID + " .ag-cs-cand.used{opacity:.32;cursor:not-allowed;filter:grayscale(.6);}" +
      "#" + ROOT_ID + " .ag-cs-cand span{font-size:10px;max-width:52px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#" + ROOT_ID + " .ag-cs-extras{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0;font-size:13px;font-weight:700;color:#bff5e0;}" +
      "#" + ROOT_ID + " .ag-cs-extrabtns{display:flex;gap:0;}" +
      "#" + ROOT_ID + " .ag-cs-extras small{font-weight:600;color:#7fb8a3;}" +
      // 自愿群演池(手动模式): 多选切换, 复用候选卡样式。
      "#" + ROOT_ID + " .ag-cs-expool{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;}" +
      "#" + ROOT_ID + " .ag-cs-excand{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:3px;width:56px;background:transparent;border:1px solid rgba(0,245,160,.22);border-radius:10px;padding:4px;cursor:pointer;color:#cfeee0;}" +
      "#" + ROOT_ID + " .ag-cs-excand>img,#" + ROOT_ID + " .ag-cs-excand .ag-cs-ini{width:44px;height:44px;border-radius:7px;object-fit:cover;}" +
      "#" + ROOT_ID + " .ag-cs-excand.on{border-color:" + GREEN + ";background:rgba(0,245,160,.14);}" +
      "#" + ROOT_ID + " .ag-cs-excand span{font-size:10px;max-width:52px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#" + ROOT_ID + " .ag-cs-exempty{font-size:12px;color:#7fb8a3;font-style:normal;}" +
      "#" + ROOT_ID + " .ag-cs-cost{text-align:center;font-size:13px;font-weight:700;color:#bff5e0;margin:10px 0 6px;}" +
      "#" + ROOT_ID + " .ag-cs-go{width:100%;margin-top:4px;}" +
      // ⑤ 导演入口
      "#" + ROOT_ID + " .ag-director .ag-dg-box{max-width:540px;max-height:88vh;overflow:auto;}" +
      "#" + ROOT_ID + " .ag-dg-fmts{display:flex;gap:0;overflow-x:auto;scrollbar-width:none;margin:4px 0 14px;}" +
      "#" + ROOT_ID + " .ag-dg-fmts::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-dg-fmt{flex:0 0 auto;white-space:nowrap;background:rgba(0,245,160,.08);border:1px solid rgba(0,245,160,.25);color:#d6ffee;border-radius:999px;padding:8px 15px;font-size:13px;font-weight:700;cursor:pointer;margin-right:6px;}" +
      "#" + ROOT_ID + " .ag-dg-fmt.on{background:" + GREEN + ";color:" + INK + ";}" +
      // 短剧/系列/电影 = 不可用锁态占位(敬请期待)。
      "#" + ROOT_ID + " .ag-dg-fmt.locked{opacity:.45;cursor:not-allowed;background:rgba(255,255,255,.04);border-style:dashed;border-color:rgba(0,245,160,.2);color:#9fc6b8;}" +
      "#" + ROOT_ID + " .ag-dg-civs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}" +
      "#" + ROOT_ID + " .ag-dg-civ{background:rgba(0,245,160,.06);border:1px solid rgba(0,245,160,.22);color:#cfeee0;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-dg-civ.on{background:rgba(0,245,160,.85);color:" + INK + ";border-color:transparent;}" +
      "#" + ROOT_ID + " .ag-dg-style{width:100%;box-sizing:border-box;margin:0 0 12px;}" +
      "#" + ROOT_ID + " .ag-dg-synopsis{width:100%;box-sizing:border-box;margin:0 0 12px;min-height:64px;resize:vertical;font-family:inherit;}" +
      // D — App 端隐藏故事梗概输入(后台仍有: 留空则系统智能生成)。桌面/网页正常显示。
      "html.cssos-app #" + ROOT_ID + " .ag-dg-synopsis{display:none !important;}" +
      "#" + ROOT_ID + " .ag-dg-titlerow{display:flex;gap:8px;align-items:stretch;margin:0 0 12px;}" +
      "#" + ROOT_ID + " .ag-dg-titlerow .ag-dg-title{flex:1;margin:0;}" +
      "#" + ROOT_ID + " .ag-dg-title{width:100%;box-sizing:border-box;margin:0 0 12px;}" +
      // ✨联动 起草故事梗概按钮(与标题同排)。App 端随梗概一起隐藏(其目标文本框在 App 隐藏)。
      "#" + ROOT_ID + " .ag-dg-syndraft{flex:0 0 auto;white-space:nowrap;background:rgba(0,245,160,.14);border:1px solid rgba(0,245,160,.4);color:#d6ffee;border-radius:10px;padding:0 12px;font-size:12.5px;font-weight:700;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-dg-syndraft:disabled{opacity:.6;cursor:progress;}" +
      "html.cssos-app #" + ROOT_ID + " .ag-dg-syndraft{display:none !important;}" +
      "#" + ROOT_ID + " .ag-dg-label{font-size:12.5px;font-weight:700;color:#8fdcc0;margin:0 0 8px;}" +
      "#" + ROOT_ID + " .ag-dg-cast{display:flex;flex-direction:column;gap:8px;margin-bottom:16px;}" +
      "#" + ROOT_ID + " .ag-dg-role{display:flex;align-items:center;gap:8px;font-size:13.5px;color:#e8fff5;}" +
      "#" + ROOT_ID + " .ag-dg-role b{color:#bff5e0;min-width:52px;}" +
      "#" + ROOT_ID + " .ag-dg-actor{display:inline-flex;align-items:center;gap:6px;font-weight:700;}" +
      "#" + ROOT_ID + " .ag-dg-actor img{width:30px;height:30px;border-radius:7px;object-fit:cover;}" +
      // 封面加载失败(如 Wikimedia 429)时的首字母兜底, 不再露破图 ?。
      "#" + ROOT_ID + " .ag-dg-ini{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:7px;background:rgba(0,245,160,.16);color:#bff5e0;font-weight:800;font-size:14px;}" +
      // 可搜索选角器。
      "#" + ROOT_ID + " .ag-ap-box{max-width:520px;}" +
      "#" + ROOT_ID + " .ag-ap-search{width:100%;box-sizing:border-box;margin:4px 0 12px;}" +
      "#" + ROOT_ID + " .ag-ap-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;max-height:48vh;overflow-y:auto;}" +
      "#" + ROOT_ID + " .ag-ap-cand{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(0,245,160,.05);border:1px solid rgba(0,245,160,.2);border-radius:12px;padding:8px 4px;cursor:pointer;color:#d6ffee;}" +
      "#" + ROOT_ID + " .ag-ap-cand:hover{background:rgba(0,245,160,.14);border-color:" + GREEN + ";}" +
      "#" + ROOT_ID + " .ag-ap-cand>img,#" + ROOT_ID + " .ag-ap-cand .ag-cs-ini{width:56px;height:56px;border-radius:9px;object-fit:cover;}" +
      "#" + ROOT_ID + " .ag-ap-cand>span{font-size:11px;text-align:center;line-height:1.2;max-width:78px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}" +
      "#" + ROOT_ID + " .ag-dg-swap{background:rgba(0,245,160,.1);border:1px solid rgba(0,245,160,.3);border-radius:999px;padding:2px 8px;font-size:11px;cursor:pointer;color:#bff5e0;}" +
      "#" + ROOT_ID + " .ag-dg-row{display:flex;align-items:center;gap:12px;}" +
      "#" + ROOT_ID + " .ag-dg-go{flex:1;}" +
      "#" + ROOT_ID + " .ag-dg-cd{font-size:12.5px;color:#8fdcc0;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-dg-cd b{color:#00f5a0;}" +
      // 自定义开拍倒计时秒数(可调)。
      "#" + ROOT_ID + " .ag-dg-cdset-w{display:inline-flex;align-items:center;gap:2px;margin-left:6px;font-size:12px;color:#8fdcc0;}" +
      "#" + ROOT_ID + " .ag-dg-cdset{width:44px;box-sizing:border-box;background:rgba(0,245,160,.06);border:1px solid rgba(0,245,160,.3);border-radius:7px;color:#d6ffee;padding:2px 4px;font-size:12px;text-align:center;}" +
      "#" + ROOT_ID + " .ag-dg-pause{background:transparent;border:1px solid rgba(0,245,160,.35);border-radius:999px;padding:2px 8px;cursor:pointer;color:#bff5e0;}" +
      "#" + ROOT_ID + " .ag-direct{background:linear-gradient(120deg,#00f5a0,#0bf7ff);color:#012;border:none;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:800;cursor:pointer;margin-left:12px;box-shadow:0 0 18px rgba(0,245,160,.4);white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-direct:hover{filter:brightness(1.08);}" +
      "#" + ROOT_ID + " .ag-wt{display:grid;grid-template-columns:1fr 1fr;gap:10px;}" +
      "#" + ROOT_ID + " .ag-wt button{display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;background:rgba(0,245,160,.06);border:1px solid rgba(0,245,160,.3);color:#e8fff5;border-radius:14px;padding:12px 14px;cursor:pointer;font-size:14px;font-weight:700;}" +
      "#" + ROOT_ID + " .ag-wt button:hover:not(:disabled){background:rgba(0,245,160,.16);}" +
      "#" + ROOT_ID + " .ag-wt button small{font-size:11px;font-weight:500;color:#8fdcc0;}" +
      "#" + ROOT_ID + " .ag-wt button:disabled{opacity:.5;cursor:default;}" +
      /* 台词胶囊 = 胶囊宪法凹凸镶嵌(照 style.css ~2307-2343): 轨道共用边框零间隙, 激活凸全圆, 其余凹咬合 */
      "#" + ROOT_ID + " .ag-showcase{display:flex;align-items:stretch;height:46px;margin-top:14px;border:1px solid rgba(0,245,160,.35);border-radius:999px;overflow:hidden;background:rgba(0,245,160,.05);}" +
      "#" + ROOT_ID + " .ag-sc-btn{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;border:0;background:transparent;color:#d6ffee;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;position:relative;box-sizing:border-box;}" +
      /* 激活(playing)= 凸: 两头圆全 pill 绿填充 */
      "#" + ROOT_ID + " .ag-showcase .ag-sc-btn.playing{background:" + GREEN + ";color:" + INK + ";border-radius:999px;z-index:2;box-shadow:0 4px 18px rgba(0,0,0,.28);}" +
      /* 激活【右侧】未激活: 凹在左, 咬合激活右圆头 */
      "#" + ROOT_ID + " .ag-showcase .ag-sc-btn.playing ~ .ag-sc-btn{margin-left:-23px;border-radius:0 999px 999px 0;z-index:1;-webkit-mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);}" +
      /* 激活【左侧】未激活: 凹在右 */
      "#" + ROOT_ID + " .ag-showcase .ag-sc-btn:has(~ .ag-sc-btn.playing){margin-right:-23px;border-radius:999px 0 0 999px;z-index:1;-webkit-mask:radial-gradient(circle 23px at 100% 50%,transparent 22.5px,#000 23px);mask:radial-gradient(circle 23px at 100% 50%,transparent 22.5px,#000 23px);}" +
      /* 无激活(默认): 第一段(Intro)凸, 其后凹在左 —— 永远呈一条凹凸镶嵌轨道 */
      "#" + ROOT_ID + " .ag-showcase:not(:has(.playing)) .ag-sc-btn:first-child{background:" + GREEN + ";color:" + INK + ";border-radius:999px;z-index:2;box-shadow:0 4px 18px rgba(0,0,0,.28);}" +
      "#" + ROOT_ID + " .ag-showcase:not(:has(.playing)) .ag-sc-btn:first-child ~ .ag-sc-btn{margin-left:-23px;border-radius:0 999px 999px 0;z-index:1;-webkit-mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);mask:radial-gradient(circle 23px at 0 50%,transparent 22.5px,#000 23px);}" +
      "#" + ROOT_ID + " .ag-stage{min-height:44px;margin-top:14px;font-size:26px;font-weight:800;line-height:1.35;letter-spacing:.5px;}" +
      "#" + ROOT_ID + " .ag-sc-f2f{display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:7px 15px;border:1px solid rgba(0,245,160,.4);border-radius:999px;background:rgba(0,245,160,.12);color:#eafff6;font-size:13px;font-weight:800;cursor:pointer;transition:background .15s ease,transform .12s ease;}" +
      "#" + ROOT_ID + " .ag-sc-f2f:hover{background:rgba(0,245,160,.24);transform:translateY(-1px);}" +
      "#" + ROOT_ID + " .ag-sc-f2f .ag-f2f-ic2{width:22px;height:16px;flex:0 0 auto;}" +
      "#" + ROOT_ID + " .ag-native{white-space:pre-wrap;word-break:normal;overflow-wrap:break-word;}" +
      "#" + ROOT_ID + " .ag-stage .tk{color:rgba(255,255,255,.28);transition:color .08s,text-shadow .08s;white-space:pre-wrap;}" +
      "#" + ROOT_ID + " .ag-stage .tk.on{color:" + GREEN + ";text-shadow:0 0 16px rgba(0,245,160,.7);}" +
      "#" + ROOT_ID + " .ag-trans{font-size:16px;font-weight:500;color:rgba(207,238,224,.72);margin-top:8px;font-style:italic;}" +
      "#" + ROOT_ID + " .ag-sec{margin-top:30px;}" +
      "#" + ROOT_ID + " .ag-sec h3{font-size:16px;color:" + GREEN + ";margin:0 0 12px;}" +
      "#" + ROOT_ID + " .ag-form{max-width:560px;display:flex;flex-direction:column;gap:14px;}" +
      "#" + ROOT_ID + " .ag-form label{display:flex;flex-direction:column;gap:6px;font-size:14px;color:rgba(207,238,224,.85);}" +
      "#" + ROOT_ID + " .ag-in{background:rgba(0,245,160,.07);border:1px solid rgba(0,245,160,.3);color:#e8fff5;border-radius:12px;padding:10px 14px;font-size:15px;font-family:inherit;outline:none;}" +
      "#" + ROOT_ID + " .ag-check{display:flex;align-items:center;gap:8px;font-size:14px;color:rgba(207,238,224,.9);cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-consent{background:rgba(0,245,160,.05);border:1px solid rgba(0,245,160,.25);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;}" +
      "#" + ROOT_ID + " .ag-capture{background:rgba(0,0,0,.25);border:1px solid rgba(0,245,160,.2);border-radius:14px;padding:14px;}" +
      "#" + ROOT_ID + " .ag-recbtn{width:100%;max-width:520px;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:8px;height:46px;border:0;border-radius:999px;background:" + GREEN + ";color:" + INK + ";font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.28);}" +
      "#" + ROOT_ID + " .ag-recbtn:disabled{opacity:.5;cursor:default;}" +
      // 倒数/快门 overlay(压在摄像头预览上)
      "#" + ROOT_ID + " .ag-countdown{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:96px;font-weight:900;color:#fff;text-shadow:0 4px 30px rgba(0,0,0,.6);background:rgba(0,0,0,.18);border-radius:14px;pointer-events:none;}" +
      // Vision Pro 式面部对齐圈
      "#" + ROOT_ID + " .ag-facering{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);width:54%;aspect-ratio:3/4;border:2.5px dashed rgba(0,245,160,.55);border-radius:50%;pointer-events:none;display:flex;align-items:flex-end;justify-content:center;transition:border-color .2s,box-shadow .2s;}" +
      "#" + ROOT_ID + " .ag-facering span{transform:translateY(150%);font-size:12px;color:#bff5e0;background:rgba(0,0,0,.45);padding:2px 10px;border-radius:999px;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-facering.aligned{border-style:solid;border-color:" + GREEN + ";box-shadow:0 0 26px rgba(0,245,160,.5);}" +
      "#" + ROOT_ID + " .ag-guide-auto{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#9ec3b4;margin-bottom:10px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-guide-auto input{width:16px;height:16px;accent-color:" + GREEN + ";}" +
      "#" + ROOT_ID + " .ag-guide-thumbs .gthumb .gretake{position:absolute;left:1px;top:1px;background:rgba(0,0,0,.6);color:#bff5e0;border:0;border-radius:7px;font-size:12px;line-height:1;padding:2px 4px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-countdown.flash{background:#fff;color:#fff;}" +
      // 引导采集
      "#" + ROOT_ID + " .ag-guide{max-width:520px;margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-guide-dots{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;}" +
      "#" + ROOT_ID + " .ag-guide-dots .gd{width:100%;flex:1 1 0;min-width:8px;height:5px;border-radius:999px;background:rgba(0,245,160,.18);transition:background .2s;}" +
      "#" + ROOT_ID + " .ag-guide-dots .gd.done{background:" + GREEN + ";}" +
      "#" + ROOT_ID + " .ag-guide-dots .gd.cur{background:rgba(0,245,160,.55);animation:agPulse 1s ease-in-out infinite;}" +
      "@keyframes agPulse{0%,100%{opacity:.55}50%{opacity:1}}" +
      "#" + ROOT_ID + " .ag-guide-prompt{display:flex;align-items:center;gap:12px;min-height:44px;font-size:14px;color:#cfeee0;line-height:1.4;}" +
      "#" + ROOT_ID + " .ag-guide-prompt .gemoji{font-size:38px;line-height:1;flex:0 0 auto;}" +
      "#" + ROOT_ID + " .ag-guide-prompt .glabel b{display:block;font-size:18px;color:#eafff6;font-weight:800;}" +
      "#" + ROOT_ID + " .ag-guide-prompt .glabel em{display:block;font-style:normal;font-size:12.5px;color:#8fe9c8;margin:2px 0 3px;line-height:1.35;}" +
      "#" + ROOT_ID + " .ag-guide-prompt .glabel small{color:#7fb8a3;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;letter-spacing:.06em;}" +
      "#" + ROOT_ID + " .ag-guide-prompt .glabel .gstepc{display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:.06em;color:" + INK + ";background:" + GREEN + ";border-radius:999px;padding:2px 9px;margin-bottom:4px;}" +
      "#" + ROOT_ID + " .ag-guide-thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-guide-thumbs .gthumb{position:relative;width:46px;height:46px;border-radius:9px;overflow:hidden;border:1px solid rgba(0,245,160,.4);}" +
      "#" + ROOT_ID + " .ag-guide-thumbs .gthumb img{width:100%;height:100%;object-fit:cover;display:block;}" +
      "#" + ROOT_ID + " .ag-guide-thumbs .gthumb span{position:absolute;right:1px;bottom:0;font-size:13px;text-shadow:0 1px 3px #000;}" +
      "#" + ROOT_ID + " .ag-guide-thumbs .gthumb.pending{opacity:.5;}" +
      "#" + ROOT_ID + " .ag-recbtn:disabled{background:rgba(0,245,160,.18);color:rgba(207,238,224,.7);box-shadow:none;cursor:default;}" +
      "#" + ROOT_ID + " .ag-recbtn.recording{background:#ff5a6a;color:#fff;}" +
      "#" + ROOT_ID + " .ag-capchip{flex:1 1 0;border:1px solid rgba(0,245,160,.4);background:rgba(0,245,160,.06);color:#d6ffee;font-size:14px;font-weight:700;padding:9px 0;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-archfilters{margin-top:0 !important;}" +   // 两行筛选间距 = 单个 14px(跟上一个间隔等高), 别叠成双倍
      "#" + ROOT_ID + " .ag-rt-label{font-size:13px;color:#a9e9cf;margin:8px 0;font-weight:600;}" +
      // 胶囊轨道铁律: 永远单行可横滑(不 wrap), 不管数量多少 —— 宽/窄屏显示不同。共用边框零间隙轨道(贴紧)。
      // 胶囊宪法 轨道4/5(文明·戏路, 多选): 外层一条 999px 边框轨道, 子胶囊贴满、零缝、激活在前。
      // ★根治: 以前 .ag-arch/.ag-mi 各自带边框(见下方已删)特异性等同却在后 → 覆盖了贴合轨道样式 → 变成散颗带框胶囊。现在文字样式并进轨道子项, 独立带框规则删除。
      "#" + ROOT_ID + " .ag-arch-row,#" + ROOT_ID + " .ag-multi-row{display:flex;flex-wrap:nowrap;gap:3px;align-items:stretch;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:3px;box-sizing:border-box;border:1px solid rgba(0,245,160,.35);border-radius:999px;background:rgba(0,245,160,.05);height:44px;}" +
      "#" + ROOT_ID + " .ag-arch-row::-webkit-scrollbar,#" + ROOT_ID + " .ag-multi-row::-webkit-scrollbar{display:none;}" +
      "#" + ROOT_ID + " .ag-arch-row>*,#" + ROOT_ID + " .ag-multi-row>*{flex:0 0 auto;border:0;background:transparent;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0 15px;font-size:13px;font-weight:700;color:#d6ffee;white-space:nowrap;cursor:pointer;order:1;}" +
      // 谁激活谁排到最前(active-first, 用 flex order 免重排 DOM); 激活凸绿两头圆贴满轨道高。
      "#" + ROOT_ID + " .ag-arch-row .ag-arch.on,#" + ROOT_ID + " .ag-multi-row .ag-mi.on{order:0;background:" + GREEN + " !important;color:" + INK + " !important;box-shadow:0 2px 10px rgba(0,0,0,.28);}" +
      "#" + ROOT_ID + " .ag-multi{margin:2px 0;}" +
      "#" + ROOT_ID + " .ag-subgroup{margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-subgroup-t{font-size:12px;color:#8fdcc0;margin:0 0 6px;}" +
      "#" + ROOT_ID + " .ag-subrow{display:flex;flex-wrap:wrap;gap:6px;}" +
      "#" + ROOT_ID + " .ag-sub{border:1px solid rgba(0,245,160,.25);background:transparent;color:#bff5e0;font-size:12.5px;padding:5px 11px;border-radius:999px;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-sub.on{background:rgba(0,245,160,.85);color:" + INK + ";border-color:transparent;font-weight:700;}" +
      /* 就地展开 = 同一个框: 展开的卡横跨整行, 封面变大(显 3D/视频), 详情接着信息往下排 */
      "#" + ROOT_ID + " .ag-card.expanded{grid-column:1/-1;border-color:" + GREEN + ";box-shadow:0 0 26px rgba(0,245,160,.4);}" +
      // W1618c — Jing: 展开封面改 2.39:1 超宽银幕(CinemaScope)。原先 height:min(58vh,420px)+满宽 在宽屏上≈4.5:1(过宽、只剩眼睛)。焦点上移露脸。
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover{aspect-ratio:2.39/1;height:auto;max-height:min(70vh,760px);cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover img{object-position:var(--foc,center 22%) !important;}" +
      // 「Full cover」态: 满框显整张 —— 宽度铺满不留黑边, 框高随原图比例往下自适应拉高, 完整不裁切(去掉 max-height 上限, 框继续往下长)。
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover.ag-cover-full{display:block !important;height:auto !important;max-height:none !important;overflow:visible !important;}" +
      "#" + ROOT_ID + " .ag-cover.ag-cover-full img{width:100% !important;height:auto !important;max-height:none !important;object-fit:contain !important;display:block !important;}" +
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover .ag-mv-wrap,#" + ROOT_ID + " .ag-card.expanded .ag-cover model-viewer{width:100%;height:100%;}" +
      "#" + ROOT_ID + " .ag-cover{position:relative;}" +
      "#" + ROOT_ID + " .ag-3d-badge{position:absolute;right:12px;bottom:12px;z-index:3;background:rgba(4,18,12,.72);color:#bff5e0;border:1px solid rgba(0,245,160,.5);border-radius:999px;padding:6px 13px;font-size:13px;font-weight:700;cursor:pointer;backdrop-filter:blur(4px);}" +
      "#" + ROOT_ID + " .ag-3d-badge:hover{background:rgba(0,245,160,.9);color:#04120c;}" +
      // 封面左下角一条胶囊轨道(Face on Face | Full cover)—— 视觉走平台 cssosMakePillBar 凸嵌凹; 此处仅定位 + 仅展开态显示。
      // W1619 — Jing: 恢复旧的短覆盖胶囊(叠封面左下角, 不要长条)。
      "#" + ROOT_ID + " .ag-cover-track{position:absolute;left:10px;bottom:10px;z-index:4;display:none;backdrop-filter:blur(4px);box-shadow:0 4px 16px rgba(0,0,0,.3);}" +
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover-track{display:inline-flex;}" +
      // W1619 — 详情信息合成【一行浮在封面左上顶部】: 🏛 名字 · Legend · 文明 · 价 · ▶数。
      "#" + ROOT_ID + " .ag-cover-head{position:absolute;left:0;top:0;right:0;z-index:4;display:none;align-items:center;gap:6px;flex-wrap:wrap;padding:9px 14px;background:linear-gradient(180deg,rgba(0,0,0,.62),transparent);color:#fff;font-size:13.5px;font-weight:700;text-shadow:0 1px 3px #000;}" +
      "#" + ROOT_ID + " .ag-card.expanded .ag-cover-head{display:flex;}" +
      "#" + ROOT_ID + " .ag-cover-head .ag-ch-name{font-weight:800;}" +
      // W1620 — 定时展开信息: 纯 CSS 动画(无 JS 定时器 → 零内存)。平时只显名字(rest 收起), 每 10s 亮全信息 ~1.2s。
      "#" + ROOT_ID + " .ag-cover-head .ag-ch-rest{display:inline;}" +   // W1628 — 取消 10s 闪烁动画, 信息驻留在名字之后(像左下角同框标签)。零服务器成本, 纯 UX 取舍。
      // W1619 — 展开态: 隐藏旧的 meta 详情(名字/文明/短描述/音色 —— 已合进封面左上一行), 问道紧接封面。
      "#" + ROOT_ID + " .ag-card.expanded .ag-meta>.ag-name,#" + ROOT_ID + " .ag-card.expanded .ag-meta>.ag-sub,#" + ROOT_ID + " .ag-card.expanded .ag-meta>.ag-slogan,#" + ROOT_ID + " .ag-card.expanded .ag-meta>.ag-row{display:none !important;}" +
      // W1626 — 展开态封面紧接问道: 去掉 meta 顶部留白, 收紧封面→问道间隙。
      "#" + ROOT_ID + " .ag-card.expanded .ag-meta{padding-top:2px;}" +
      "#" + ROOT_ID + " .ag-cover-track [data-pill-key]{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}" +
      "#" + ROOT_ID + " .ag-cover-track .ag-f2f-ic2{width:22px;height:16px;flex:0 0 auto;}" +
      "#" + ROOT_ID + " .ag-inline{animation:agfade .22s ease;}" +
      "@keyframes agfade{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}" +
      "#" + ROOT_ID + " .ag-sub-grid{margin-top:4px;}" +
      /* 创建+搜索 = 凹凸镶嵌: Create 绿全圆胶囊(右端半圆【凸】)负边距【咬进】搜索框; 搜索框左侧【凹】容纳 */
      // 轨道1(成为演员/创建/搜索, 三段单选)已改走平台 cssosMakePillBar(见 openActorGallery), 由 [data-pill-bar] 统一样式。
      // 这里只留:窄屏时顶部胶囊换行独占一行。
      "@media(max-width:760px){#" + ROOT_ID + " .ag-bar{flex-wrap:wrap;}#" + ROOT_ID + " .ag-topcap{order:3;flex:1 1 100% !important;width:100%;}}" +
      "#" + ROOT_ID + " .ag-3d{margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-ar{display:inline-block;text-decoration:none;}" +
      "#" + ROOT_ID + " .ag-owner{display:flex;gap:10px;margin-top:12px;}" +
      "#" + ROOT_ID + " .ag-del{background:rgba(255,80,80,.15);border:1px solid rgba(255,80,80,.5);color:#ffb3b3;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:600;cursor:pointer;}" +
      "#" + ROOT_ID + " .ag-empty{color:rgba(207,238,224,.55);font-size:14px;padding:8px 0;}";
    document.head.appendChild(st);
  }

  var state = { filter: "all", search: "", actors: [], rows: 1, ownedSet: {}, archetype: "" };

  // CSSOS_WAVE_1524 — 大封面(7MB wikimedia 原图)经 /img 缩放代理成网格尺寸 webp,
  // 避免 iOS WKWebView 解码内存爆掉崩溃。只代理白名单 host(与后端一致), 其余原样。
  function imgProxy(u, w) {
    if (!u || /^(data:|blob:)/.test(u)) return u;
    try {
      var h = new URL(u, location.href).hostname.toLowerCase();
      var ok = ["cssstudio.app", "wikimedia.org", "wikipedia.org"].some(function (s) { return h === s || h.endsWith("." + s); });
      if (!ok) return u;
    } catch (e) { return u; }
    return "/img?w=" + w + "&url=" + encodeURIComponent(u);
  }
  function coverInner(a, big) {
    var foc = (a.cover_focal_x != null && a.cover_focal_x >= 0)
      ? (a.cover_focal_x * 100).toFixed(1) + "% " + (a.cover_focal_y * 100).toFixed(1) + "%" : "center 30%";
    if (a.cover_image) {
      // onerror 兜底: 代理失败→回退原图, 再失败→透明占位(绝不露破图标)。
      return '<img src="' + esc(imgProxy(a.cover_image, big ? 1080 : 440)) + '" alt="' + esc(a.name_en) + '" loading="lazy" decoding="async"'
        + ' data-orig="' + esc(a.cover_image) + '"'
        + ' onerror="var b=+this.dataset.fb||0;this.dataset.fb=b+1;this.src=b?&quot;' + AG_BLANK + '&quot;:this.getAttribute(&quot;data-orig&quot;)"'
        + ' style="--foc:' + foc + '">';
    }
    var h = hueOf(a.name_en || a.actor_id);
    var initial = esc(String(a.name_en || a.name_zh || "?").trim().charAt(0).toUpperCase());
    return '<div style="position:absolute;inset:0;background:linear-gradient(135deg,hsl(' + h + ',60%,26%),hsl(' + ((h + 50) % 360) + ',65%,14%));"></div>' +
           '<div class="ag-initial">' + (big ? '<span style="font-size:96px">' + initial + '</span>' : initial) + '</div>';
  }

  // 一句话招牌 slogan(配脸最勾人): 取 persona 破折号/中点前的主句, 截断。
  function sloganOf(a) {
    var p = String(a.persona || "").trim();
    if (!p) return "";
    var m = (p.split(/\s*[—–·]\s*/)[0] || p).replace(/[。.．]$/, "").trim();
    if (m.length > 46) m = m.slice(0, 44).replace(/\s+\S*$/, "") + "…";
    return m;
  }
  function actorCard(a) {
    var originBadge = a.origin_type === "civilization" ? "🏛" : "✨";
    var priceBadge = a.is_premium ? '<span class="ag-badge prem">💎 ' + cents(a.cast_price_cents) + '</span>' : '<span class="ag-badge">Free</span>';
    return '<div class="ag-card" data-actor="' + esc(a.actor_id) + '">' +
      '<div class="ag-cover" data-cover>' + coverInner(a, false) +
        '<div class="ag-badges"><span class="ag-badge">' + originBadge + '</span>' + priceBadge + '</div>' +
      '</div>' +
      '<div class="ag-meta">' +
        '<div class="ag-name">' + esc(a.name_en || a.name_zh) + '</div>' +
        '<div class="ag-sub">' + (a.name_native && a.name_native !== a.name_en ? esc(a.name_native) + ' · ' : "") + (a.civilization ? esc(civDisplay(a.civilization)) : esc(T("Original", "原创合成"))) + '</div>' +
        (sloganOf(a) ? '<div class="ag-slogan">' + esc(sloganOf(a)) + '</div>' : "") +
        '<div class="ag-row"><span>' + esc(a.voice_style || a.style_descriptor || "") + '</span></div>' +
        '<div class="ag-inline"></div>' +   // 就地展开: 同一框内接着显示详情(不另开框)
      '</div></div>';
  }

  function applyFilter(list) {
    return list.filter(function (a) {
      if (state.filter === "synthetic" && a.origin_type !== "synthetic") return false;
      if (state.filter === "civilization" && a.origin_type !== "civilization") return false;
      if (state.filter === "premium" && !a.is_premium) return false;
      if (state.filter === "female" && a.gender !== "female") return false;
      if (state.filter === "male" && a.gender !== "male") return false;
      if (state.filter === "neutral" && a.gender !== "neutral") return false;
      if (state.filter === "owned" && !state.ownedSet[a.actor_id]) return false;
      if (state.archetype && !(Array.isArray(a.archetypes) && a.archetypes.indexOf(state.archetype) >= 0)) return false;
      if (state.search) {
        var q = state.search.toLowerCase();
        var hay = (a.name_zh + " " + a.name_en + " " + (a.civilization || "") + " " + (a.persona || "")).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function colsFor(scroll) {
    // 网格 minmax(210px) + gap 18 → 估算每行列数(与 CSS 同步)。
    var w = (scroll && scroll.clientWidth) || 800;
    return Math.max(1, Math.floor((w + 18) / (210 + 18)));
  }
  function renderGrid() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (!scroll) return;
    var list = applyFilter(state.actors);
    if (!list.length) { scroll.innerHTML = '<div class="ag-empty">' + esc(state.actors.length ? T("No matching actors.", "没有匹配的演员。") : T("No actors yet.", "暂无演员。")) + '</div>'; return; }
    // 默认显示一行, 点「加载更多一行」逐行追加。
    // App 端(单列)默认显示 3 张、每次也加载 3 张; 桌面端保持"一行(cols 张)"。
    var cols = colsFor(scroll);
    var batch = cols <= 1 ? 3 : cols;
    var show = Math.min(list.length, Math.max(batch, state.rows * batch));
    var more = list.length - show;
    // W1577 — 删除"浏览全部演员"胶囊(与上方筛选胶囊重复; 点任一筛选即 applyFilterKey→清 solo→全量)。
    scroll.innerHTML =
      '<div class="ag-grid">' + list.slice(0, show).map(actorCard).join("") + '</div>' +
      (more > 0 ? '<div style="text-align:center;margin-top:20px;"><button class="ag-chip ag-more">' + esc(T("Load one more row", "加载更多一行")) + ' ▾ (' + more + ')</button></div>' : "");
    var mb = scroll.querySelector(".ag-more");
    if (mb) mb.onclick = function () { appendMoreRows(); };
    agSetupImgRecycle(scroll);
  }
  // 加载更多 = 只在末尾【追加】新一批卡, 不整刷、不跳回顶部(保留滚动位置)。
  // renderGrid() 全量重建只留给 筛选/搜索/首次(那些本就该重排)。
  function appendMoreRows() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    var grid = scroll && scroll.querySelector(".ag-grid");
    if (!grid) { state.rows += 1; renderGrid(); return; }  // 无网格 → 退回整渲
    var list = applyFilter(state.actors);
    var cols = colsFor(scroll);
    var batch = cols <= 1 ? 3 : cols;
    var prevShow = grid.children.length;
    state.rows += 1;
    var show = Math.min(list.length, Math.max(batch, state.rows * batch));
    if (show > prevShow) grid.insertAdjacentHTML("beforeend", list.slice(prevShow, show).map(actorCard).join(""));
    var more = list.length - show;
    var mb = scroll.querySelector(".ag-more");
    if (mb) {
      if (more > 0) mb.innerHTML = esc(T("Load one more row", "加载更多一行")) + " ▾ (" + more + ")";
      else if (mb.parentNode) mb.parentNode.remove();  // 到底 = 移除按钮
    }
    agSetupImgRecycle(scroll);  // 新追加的卡也纳入离屏回收
  }
  // CSSOS_WAVE_1524 — 离屏图卸载: 滚出视口 (上下各 800px 缓冲) 的封面 <img> 清掉 src
  // 释放已解码位图内存, 滚回来再恢复。配合 content-visibility:auto + /img 缩略, 让
  // 无限翻页的搜索结果内存有界, 不再 OOM 崩溃。展开卡(.expanded)不卸载。
  // 1x1 透明 GIF 占位: 卸载时换成它, 既释放大图解码内存, 又不像无 src 那样露出破图标(蓝?)。
  var AG_BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  var _agImgObs = null;
  // CSSOS_WAVE_1669 — 进【面对面】即掐掉专页正在播的自我介绍/朗读(哪怕播到一半)。
  //   已听完 → audio 已 ended, 停止=空操作(天然满足"除非听完再进")。同时少一路音频解码器 + RAF,
  //   缓解与 f2f 摄像头/AudioContext 的并发媒体内存压力。由当前 wireWendao 注册停止器。
  var _agActiveWendaoStop = null;
  function agSetupImgRecycle(scroll) {
    if (!("IntersectionObserver" in window) || !scroll) return;
    if (_agImgObs) _agImgObs.disconnect();
    _agImgObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var img = en.target;
        if (img.closest && img.closest(".ag-card.expanded")) return; // 展开卡不动
        var cur = img.getAttribute("src");
        if (en.isIntersecting) {
          if (img.dataset.agSrc && cur === AG_BLANK) { img.src = img.dataset.agSrc; }
        } else if (cur && cur !== AG_BLANK) {
          img.dataset.agSrc = cur;
          img.src = AG_BLANK; // 释放解码内存; .ag-cover 有 aspect-ratio 占位不塌
        }
      });
    }, { root: scroll, rootMargin: "800px 0px 800px 0px" });
    scroll.querySelectorAll(".ag-cover img").forEach(function (img) { _agImgObs.observe(img); });
  }
  function resetRows() { state.rows = 1; }

  function skeleton(scroll) {
    var s = "";
    for (var i = 0; i < 10; i++) s += '<div class="ag-skel"></div>';
    scroll.innerHTML = '<div class="ag-grid">' + s + '</div>';
  }

  function loadActors() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (scroll) skeleton(scroll);
    fetch("/api/actors?limit=500", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        state.actors = (j && j.data && j.data.actors) || [];
        renderGrid();
      })
      .catch(function () {
        if (scroll) scroll.innerHTML = '<div class="ag-empty">' + esc(T("Load failed.", "加载失败。")) + ' <button class="ag-chip" onclick="cssosOpenActorGallery(1)">' + esc(T("Retry", "重试")) + '</button></div>';
      });
    // 我创建的演员 id 集合(供「我的演员」筛选 + 作者控件)。
    fetch("/api/actors?owned=1&limit=100", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var set = {}; ((j && j.data && j.data.actors) || []).forEach(function (a) { set[a.actor_id] = true; });
        state.ownedSet = set;
      }).catch(function () {});
  }
  // 分享深链: 只拉这一位演员(不全量 500, 省内存/带宽), 展开显示; 顶部给"浏览全部"出口。
  function loadSoloActor(id) {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (scroll) skeleton(scroll);
    fetch("/api/actors/" + encodeURIComponent(id), { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var a = j && j.data && j.data.actor;
        if (!a || !a.actor_id) { state.solo = null; loadActors(); return; }  // 隐藏/不存在 → 退回全量
        state.actors = [a]; renderGrid();
        var root = document.getElementById(ROOT_ID);
        var card = root && root.querySelector('.ag-card[data-actor="' + id + '"]');
        if (card && !card.classList.contains("expanded")) toggleExpand(card);
      })
      .catch(function () { state.solo = null; loadActors(); });
    fetch("/api/actors?owned=1&limit=100", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) { var set = {}; ((j && j.data && j.data.actors) || []).forEach(function (a) { set[a.actor_id] = true; }); state.ownedSet = set; }).catch(function () {});
  }

  /* CSSOS_WAVE_116 戏路 taxonomy —— 单一数据源。增减戏路只改这张表(key 与后端一致)。
     每项: key(后端认) · emoji · [en,zh] 大类名 · subs=[[en,zh]...] 细分。 */
  var ROLE_TAXONOMY = [
    { key: "hero", emoji: "🦸", en: "Hero", zh: "正派", subs: [["Hero / Knight", "英雄/骑士"], ["Guardian", "守护者"], ["Boy/Girl-next-door", "邻家/暖男"], ["Idealist", "理想主义者"]] },
    { key: "villain", emoji: "😈", en: "Villain", zh: "反派", subs: [["Tyrant", "枭雄"], ["Schemer", "阴谋家"], ["Maniac", "疯批"], ["Cold killer", "冷面杀手"], ["Fallen one", "堕落者"]] },
    { key: "antihero", emoji: "⚖️", en: "Anti-hero", zh: "亦正亦邪", subs: [["Anti-hero", "反英雄"], ["Rogue", "浪子"], ["Double agent", "双面间谍"], ["Gray bounty hunter", "灰色赏金客"]] },
    { key: "ruler", emoji: "👑", en: "Ruler", zh: "王者/权谋", subs: [["Emperor", "帝王"], ["Queen", "女王"], ["Power minister", "权臣"], ["Godfather", "教父"]] },
    { key: "action", emoji: "🗡", en: "Action", zh: "动作/硬汉", subs: [["Warrior", "战士"], ["Mercenary", "佣兵"], ["Avenger", "复仇者"], ["Tough detective", "硬汉警探"]] },
    { key: "sage", emoji: "🧙", en: "Sage", zh: "智者/导师", subs: [["Mentor", "导师"], ["Scholar", "学者"], ["Prophet", "先知"], ["Hermit", "隐士"]] },
    { key: "charmer", emoji: "💃", en: "Charmer", zh: "魅力/浪漫", subs: [["Lover", "情人"], ["Muse", "缪斯"], ["Socialite", "交际花"], ["Idol", "偶像"]] },
    { key: "tragic", emoji: "💔", en: "Tragic", zh: "悲情", subs: [["Martyr", "殉道者"], ["Orphan", "弃儿"], ["Fallen noble", "落魄贵族"], ["Devoted heart", "痴情人"]] },
    { key: "comic", emoji: "🎭", en: "Comic", zh: "丑角/喜剧", subs: [["Comedian", "谐星"], ["Trickster", "捣蛋鬼"], ["Goofball", "憨憨"], ["Snarker", "毒舌吐槽"]] },
    { key: "enigma", emoji: "🧊", en: "Enigma", zh: "冷面/神秘", subs: [["Mystery figure", "神秘客"], ["Ice beauty", "冷美人"], ["Masked one", "面具人"], ["Mastermind", "幕后黑手"]] },
    { key: "youth", emoji: "🌱", en: "Youth", zh: "成长/少年", subs: [["Young hero", "少年英雄"], ["Underdog", "逆袭者"], ["Girl genius", "天才少女"], ["Beginner", "初心者"]] },
  ];
  // 合成演员可跨文明(全文明/某几个)。创建时的可选文明大类。
  var CIVS = [
    { k: "Chinese", en: "Chinese", zh: "中华" }, { k: "Japanese", en: "Japanese", zh: "日本" },
    { k: "Korean", en: "Korean", zh: "韩国" }, { k: "Indian", en: "Indian", zh: "印度" },
    { k: "Persian", en: "Persian", zh: "波斯" }, { k: "Arab", en: "Arab", zh: "阿拉伯" },
    { k: "Greek", en: "Greek", zh: "希腊" }, { k: "Roman", en: "Roman", zh: "罗马" },
    { k: "Egyptian", en: "Egyptian", zh: "埃及" }, { k: "Norse", en: "Norse", zh: "北欧" },
    { k: "Slavic", en: "Slavic", zh: "斯拉夫" }, { k: "African", en: "African", zh: "非洲" },
    { k: "Latin American", en: "Latin American", zh: "拉美" }, { k: "Southeast Asian", en: "SE Asian", zh: "东南亚" },
    { k: "Western", en: "Western", zh: "西方" },
  ];
  // 通用「全 + 多选」胶囊: 第一枚 All 默认激活; 选具体则 All 关; 全不选则 All 回到激活。
  function allMultiMarkup(cls, label, items, allIcon) {
    // 胶囊宪法: 走平台 cssosMakePillBar(multi 模式)。data-pill-key = 选择值; All = __all__。
    var btns = '<button type="button" class="ag-mi" data-v="__all__" data-pill-key="__all__">' + (allIcon ? allIcon + " " : "") + esc(T("All", "全部")) + '</button>' +
      items.map(function (it) { return '<button type="button" class="ag-mi" data-v="' + esc(it.k) + '" data-pill-key="' + esc(it.k) + '">' + (it.emoji ? it.emoji + " " : "") + esc(T(it.en, it.zh)) + '</button>'; }).join("");
    return '<div class="ag-multi" data-multi="' + cls + '"><div class="ag-rt-label">' + esc(label) + '</div><div class="ag-pbrow">' + btns + '</div></div>';
  }
  function wireAllMulti(scope, cls) {
    var wrap = scope.querySelector('.ag-multi[data-multi="' + cls + '"]'); if (!wrap) return function () { return []; };
    var row = wrap.querySelector(".ag-pbrow");
    // 多选胶囊轨道 → 平台 helper(multi + allKey 塌缩回 All)。它切换 .on, 下面 getter 读 .on。
    if (row && typeof window.cssosMakePillBar === "function") {
      window.cssosMakePillBar(row, { textColor: "light", multi: true, allKey: "__all__" });
    }
    return function () { return [].slice.call(wrap.querySelectorAll('.ag-mi.active:not([data-v="__all__"])')).map(function (b) { return b.getAttribute("data-v"); }); };
  }
  // 文明名英文显示字典(平台默认英文; 不改库, 只影响展示; 歌词母语路由仍读原 civilization)。
  var CIV_EN = {
    "中华文明": "Chinese", "中华神话": "Chinese Myth", "中华民间": "Chinese Folk", "中华佛教神话": "Chinese Buddhist Myth",
    "佛教神话": "Buddhist Myth", "北欧神话": "Norse Myth", "印加文明": "Inca", "印度教神话": "Hindu Myth", "印度文明": "Indian",
    "古典主义欧洲": "Classical Europe", "古印度文明": "Ancient India", "古埃及文明": "Ancient Egypt", "古埃及神话": "Egyptian Myth",
    "古希腊文明": "Ancient Greece", "古希腊神话": "Greek Myth", "古罗马文明": "Ancient Rome", "启蒙欧洲": "Enlightenment Europe",
    "巴洛克欧洲": "Baroque Europe", "当代": "Contemporary", "拜占庭文明": "Byzantine", "文艺复兴欧洲": "Renaissance Europe",
    "日本古典": "Classical Japan", "欧洲文明": "European", "波斯文明": "Persian", "浪漫主义欧洲": "Romantic Europe",
    "现代北欧": "Modern Nordic", "现代印度": "Modern India", "现代非洲": "Modern Africa", "美索不达米亚文明": "Mesopotamia",
    "美索不达米亚神话": "Mesopotamian Myth", "莫卧儿印度": "Mughal India", "藏文明": "Tibetan", "西方文明": "Western", "近代欧洲": "Early Modern Europe",
    "斯拉夫神话": "Slavic Myth",
    // W1674 — 补齐缺失 4 种(Einstein/Lincoln/Bartholdi 的 civ 就在其中, 之前露中文)。
    "朝鲜古典": "Classical Korea", "近现代北美": "Modern North America", "近现代欧洲": "Modern Europe", "近现代科学": "Modern Science",
    // W1730 — 一千零一夜 + 北欧/玛雅/凯尔特新阵容的文明(之前 CIV_EN 没有 → 英文用户露中文)。
    "阿拉伯文明": "Arabian", "北欧文明": "Norse", "玛雅文明": "Maya", "凯尔特文明": "Celtic",
    // W1732 — 斯拉夫/约鲁巴/波利尼西亚/日本神话新阵容(斯拉夫神话 CIV_EN 已有 → Slavic Myth)。
    "约鲁巴文明": "Yoruba", "波利尼西亚文明": "Polynesian", "日本神话": "Japanese Myth",
  };
  // 平台默认英文时把中文文明名映射成英文; 中文环境或未知值原样返回。
  function civDisplay(civ) {
    var c = String(civ || "");
    try { if (typeof window.loginCopy === "function" && window.loginCopy("en", "zh") === "zh") return c; } catch (_e) {}
    return CIV_EN[c] || c;
  }
  function archLabel(key) { for (var i = 0; i < ROLE_TAXONOMY.length; i++) if (ROLE_TAXONOMY[i].key === key) return ROLE_TAXONOMY[i]; return null; }
  // 图鉴筛选/卡片用的 en→本地化短标签。
  function archShort(key) { var a = archLabel(key); return a ? (a.emoji + " " + T(a.en, a.zh)) : key; }
  // 戏路选择器 markup(大类多选 + 选中展开细分)。
  function roleTaxonomyMarkup() {
    var allBtn = '<button type="button" class="ag-arch" data-arch="__all__" data-pill-key="__all__">🎭 ' + esc(T("All roles", "全角色")) + '</button>';
    var row = ROLE_TAXONOMY.map(function (a) {
      return '<button type="button" class="ag-arch" data-arch="' + a.key + '" data-pill-key="' + esc(a.key) + '">' + a.emoji + ' ' + esc(T(a.en, a.zh)) + '</button>';
    }).join("");
    return '<div class="ag-roletax">' +
      '<div class="ag-rt-label">' + esc(T("Role range — plays any role by default; or pick specific archetypes", "戏路 —— 默认全角色;也可只选某几种大类")) + '</div>' +
      '<div class="ag-pbrow ag-archrow">' + allBtn + row + '</div>' +
      '<div class="ag-subroles"></div>' +
    '</div>';
  }
  // 绑定戏路选择器; 返回 { archetypes(), subRoles() } getters。
  function wireRoleTaxonomy(scope) {
    var subWrap = scope.querySelector(".ag-subroles");
    var chosenSubs = {};   // key: en-label -> true
    function rebuildSubs() {
      var selected = [].slice.call(scope.querySelectorAll(".ag-arch.active")).map(function (b) { return b.getAttribute("data-arch"); });
      subWrap.innerHTML = selected.map(function (k) {
        var a = archLabel(k); if (!a) return "";
        var chips = a.subs.map(function (s) {
          var on = chosenSubs[s[0]] ? " on" : "";
          return '<button type="button" class="ag-sub' + on + '" data-sub="' + esc(s[0]) + '">' + esc(T(s[0], s[1])) + '</button>';
        }).join("");
        return '<div class="ag-subgroup"><div class="ag-subgroup-t">' + a.emoji + ' ' + esc(T(a.en, a.zh)) + '</div><div class="ag-subrow">' + chips + '</div></div>';
      }).join("");
      subWrap.querySelectorAll(".ag-sub").forEach(function (c) {
        c.onclick = function () { var k = c.getAttribute("data-sub"); if (chosenSubs[k]) delete chosenSubs[k]; else chosenSubs[k] = true; c.classList.toggle("on"); };
      });
    }
    var allArch = scope.querySelector('.ag-arch[data-arch="__all__"]');
    // 戏路多选 → 平台 helper(multi + allKey)。它管 .on 与"全选塌缩回 All"; 每次变更回调重建细分。
    var archRow = scope.querySelector(".ag-pbrow.ag-archrow");
    if (archRow && typeof window.cssosMakePillBar === "function") {
      window.cssosMakePillBar(archRow, { textColor: "light", multi: true, allKey: "__all__", onActivate: function () { rebuildSubs(); } });
    }
    return {
      archetypes: function () { if (allArch && allArch.classList.contains("active")) return []; return [].slice.call(scope.querySelectorAll('.ag-arch.active:not([data-arch="__all__"])')).map(function (b) { return b.getAttribute("data-arch"); }); },
      subRoles: function () {
        var sel = {}; scope.querySelectorAll(".ag-arch.active").forEach(function (b) { sel[b.getAttribute("data-arch")] = true; });
        // 只保留仍属于已选大类的细分。
        var valid = {}; ROLE_TAXONOMY.forEach(function (a) { if (sel[a.key]) a.subs.forEach(function (s) { valid[s[0]] = true; }); });
        return Object.keys(chosenSubs).filter(function (k) { return valid[k]; });
      },
    };
  }

  // 顶部三胶囊激活态随视图切换(成为演员 / 创建 / 搜索)= 委托给平台 cssosMakePillBar 控制器。
  var agTopcapCtl = null;
  function setTopcapActive(key) {
    if (agTopcapCtl && typeof agTopcapCtl.setActive === "function") { agTopcapCtl.setActive(key); return; }
    // 退回(helper 不可用): 纯视觉 class。
    var cap = document.querySelector("#" + ROOT_ID + " .ag-topcap"); if (!cap) return;
    cap.querySelectorAll(".ag-signup,.ag-create,.ag-search").forEach(function (x) { x.classList.remove("active"); });
    var sel = key === "create" ? ".ag-create" : key === "search" ? ".ag-search" : ".ag-signup";
    var t = cap.querySelector(sel); if (t) t.classList.add("active");
  }
  function renderCreateForm() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (!scroll) return;
    setTopcapActive("create");
    scroll.innerHTML = '<div class="ag-detail">' +
      '<button class="ag-back">‹ ' + esc(T("Back", "返回")) + '</button>' +
      '<div class="ag-hero-name" style="margin-bottom:6px">' + esc(T("Create your digital actor", "创建你的数字演员")) + '</div>' +
      '<div class="ag-sub" style="margin-bottom:16px">' + esc(T("Pick a civilization + role and the system intelligently composes the rest — name, look and style, all authentic to that culture (a Chinese hero is East Asian; a Japanese villain looks & feels Japanese). Or fill in as much as you like. You earn 70% royalty.", "选好文明 + 戏路,系统就智能联动补全其余 —— 名字、样貌、风格,全都贴合该文化(中国英雄=东亚样貌,日本反派=日本气韵)。也可自己多填。你拿 70% 版税。")) + '</div>' +
      '<div class="ag-form">' +
        '<label>' + esc(T("Stage name (blank = system names it)", "艺名(留空 = 系统起名)")) + '<input class="ag-in" data-k="name_en" maxlength="60" placeholder="' + esc(T("Nova Sky — or leave blank", "Nova Sky —— 或留空")) + '" /></label>' +
        '<label>' + esc(T("Appearance / vibe (blank = system composes from civilization + role)", "外貌 / 气质(留空 = 系统按文明+戏路智能生成)")) + '<textarea class="ag-in" data-k="description" maxlength="600" rows="3" placeholder="' + esc(T("e.g. a silver-haired violet-eyed futuristic diva — or leave blank", "如: 银发碧眼的未来感歌姬 —— 或留空")) + '"></textarea></label>' +
        '<label>' + esc(T("Voice gender", "声线性别")) + '<select class="ag-in" data-k="gender"><option value="" selected>' + esc(T("Auto — system decides by civilization", "自动 —— 按文明智能联动")) + '</option><option value="female">' + esc(T("Female", "女声")) + '</option><option value="male">' + esc(T("Male", "男声")) + '</option><option value="neutral">' + esc(T("Neutral", "中性")) + '</option></select></label>' +
        '<label class="ag-check"><input type="checkbox" data-k="willing_extra"> 👥 ' + esc(T("Willing to play extras (background roles) — more exposure", "愿意出演群演(背景角色)—— 更多曝光")) + '</label>' +
        '<label>' + esc(T("Style (leave blank = all styles)", "风格(留空 = 全风格)")) + '<input class="ag-in" data-k="style_descriptor" maxlength="120" placeholder="' + esc(T("synthwave — or leave blank for any", "synthwave —— 留空则任意风格")) + '" /></label>' +
        allMultiMarkup("civ", T("Civilization — all by default; or pick one/several (a face can span cultures)", "文明 —— 默认全文明;也可选一个/几个(一张脸可跨文化)"), CIVS, "🌍") +
        roleTaxonomyMarkup() +
        '<label>' + esc(T("Cast price (¢, 0=free; you earn 70%)", "选角价(¢, 0=免费; 你得 70%)")) + '<input class="ag-in" data-k="cast_price_cents" type="number" min="0" max="500" value="0" /></label>' +
        '<button class="ag-cast ag-submit">✨ ' + esc(T("One-tap generate & publish", "一键生成并发布")) + '</button>' +
        '<div class="ag-form-msg ag-empty"></div>' +
      '</div></div>';
    scroll.querySelector(".ag-back").onclick = function () { renderGrid(); };
    var roleTax = wireRoleTaxonomy(scroll);
    var civGet = wireAllMulti(scroll, "civ");
    var submit = scroll.querySelector(".ag-submit");
    var msg = scroll.querySelector(".ag-form-msg");
    submit.onclick = function () {
      var payload = {};
      scroll.querySelectorAll(".ag-in").forEach(function (el) { payload[el.getAttribute("data-k")] = el.value; });
      scroll.querySelectorAll("[data-k][type=checkbox]").forEach(function (el) { payload[el.getAttribute("data-k")] = el.checked; });
      payload.archetypes = roleTax.archetypes(); payload.sub_roles = roleTax.subRoles();
      payload.civilizations = civGet();
      // 名字/描述/性别都可留空 —— 后端按 文明+戏路+风格 智能联动补全(一键合成数字演员)。
      submit.disabled = true; msg.textContent = "⏳ " + T("Composing & generating the actor… (~10-25s)", "正在智能联动生成演员…(约 10-25 秒)");
      fetch("/api/actors", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          submit.disabled = false;
          if (j && j.ok) {
            state.ownedSet[j.actor_id] = true;
            // 静默刷新演员列表(让新演员出现在图鉴), 不打断详情展示。
            fetch("/api/actors?limit=500", { credentials: "include" }).then(function (r) { return r.json(); })
              .then(function (jj) { state.actors = (jj && jj.data && jj.data.actors) || state.actors; }).catch(function () {});
            renderDetail(j.actor_id);
          }
          else { msg.textContent = (j && j.hint) || T("Creation failed, please retry.", "创建失败,请重试。"); }
        })
        .catch(function () { submit.disabled = false; msg.textContent = T("Network error, please retry.", "网络错误,请重试。"); });
    };
  }

  /* 🙋 真人签约: 本人知情同意 + 授权 + 摄像头转圈采集脸 + 录说/唱 → 建档待核验。自选自演免费, 他用你拿 80%。 */
  var rpStream = null;
  function stopRpStream() { if (rpStream) { try { rpStream.getTracks().forEach(function (t) { t.stop(); }); } catch (_e) {} rpStream = null; } }
  function b64(blob) { return new Promise(function (res) { var r = new FileReader(); r.onloadend = function () { res(String(r.result)); }; r.readAsDataURL(blob); }); }
  function uploadCapture(kind, blob) {
    return b64(blob).then(function (d) {
      return fetch("/api/actors/capture-upload", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: kind, data_b64: d }) }).then(function (r) { return r.json(); });
    });
  }
  function renderRealPersonSignup() {
    var scroll = document.querySelector("#" + ROOT_ID + " .ag-scroll");
    if (!scroll) return;
    setTopcapActive("signup");
    var captured = { face_video: null, speech: null };
    scroll.innerHTML = '<div class="ag-detail">' +
      '<button class="ag-back">‹ ' + esc(T("Back", "返回")) + '</button>' +
      '<div class="ag-hero-name" style="margin-bottom:6px">🙋 ' + esc(T("Become a real digital actor", "签约成为真人数字演员")) + '</div>' +
      '<div class="ag-sub" style="margin-bottom:14px;max-width:640px">' + esc(T("Clone yourself into a digital actor — no scheduling limits, works 24/7. Use yourself free; when others cast you, you earn 80% (platform 20%). You watch every work you're in for free, and can report or revoke anytime. Verified before going public.", "把自己变成数字演员 —— 分身有术、不受档期阻拦、24/7 接戏。自选自演免费;别人选用你,你拿 80%(平台 20%)。你参演的每支作品都免费欣赏,随时可举报/撤权。核验通过才公开。")) + '</div>' +
      '<div class="ag-form">' +
        '<label>' + esc(T("Your name *", "你的名字 *")) + '<input class="ag-in" data-k="name_en" maxlength="80" /></label>' +
        '<label>' + esc(T("Stage name (optional — shown publicly instead of your name)", "艺名(选填 —— 公开展示时用它代替你的名字)")) + '<input class="ag-in" data-k="stage_name" maxlength="80" placeholder="Nova Sky" /></label>' +
        roleTaxonomyMarkup() +
        '<label>' + esc(T("A one-line vibe (optional — e.g. “commanding presence, eyes that speak”)", "一句 vibe(选填 —— 如「气场强、眼神会说话」)")) + '<textarea class="ag-in" data-k="role_range" maxlength="300" rows="2"></textarea></label>' +
        '<label>' + esc(T("Voice gender *", "声线性别 *")) + '<select class="ag-in" data-k="gender"><option value="" selected disabled>' + esc(T("— choose —", "— 请选择 —")) + '</option><option value="female">' + esc(T("Female", "女声")) + '</option><option value="male">' + esc(T("Male", "男声")) + '</option><option value="neutral">' + esc(T("Neutral", "中性")) + '</option></select></label>' +
        '<label>' + esc(T("Cast price others pay (¢, 0=free; you keep 80%)", "他人选用你的价(¢, 0=免费; 你留 80%)")) + '<input class="ag-in" data-k="cast_price_cents" type="number" min="0" max="9999" value="0" /></label>' +
        '<label class="ag-check"><input type="checkbox" data-k="is_public_figure"> ' + esc(T("I'm a public figure / celebrity (needs agency verification)", "我是公众人物/明星(需经纪公司核验)")) + '</label>' +
        '<div class="ag-consent">' +
          '<div style="font-weight:700;margin-bottom:6px">' + esc(T("Rights I grant (consent) *", "我授予的权利(同意)*")) + '</div>' +
          '<label class="ag-check"><input type="checkbox" data-k="grant_likeness" checked> ' + esc(T("Use my likeness (face) as a digital actor", "将我的肖像(脸)用作数字演员")) + '</label>' +
          '<label class="ag-check"><input type="checkbox" data-k="grant_voice"> ' + esc(T("Use my speaking voice", "使用我的说话声音")) + '</label>' +
          '<label class="ag-check"><input type="checkbox" data-k="grant_singing"> ' + esc(T("Use my singing voice", "使用我的歌唱声音")) + '</label>' +
          '<div style="margin-top:8px;font-size:12px;color:#8fe9c8;line-height:1.5">ℹ️ ' + esc(T("Likeness is you · voice is AI-generated (a clone trained from your sample). Your face and voice are never sold or reused for anyone else.", "形象为本人 · 声线为 AI 生成(基于你的样本克隆的声音)。你的脸和声音绝不会被出售或用于他人。")) + '</div>' +
        '</div>' +
        // 采集: 两胶囊(🎥 面孔 | 🎙 声音), 各自一个舞台
        '<div class="ag-capture">' +
          '<div style="font-weight:700;margin:6px 0 10px">📸 ' + esc(T("Capture yourself", "采集你自己")) + '</div>' +
          '<div class="ag-capmode" data-pill-bar style="display:flex;gap:8px;margin-bottom:14px;max-width:340px;">' +
            '<button class="ag-capchip on" data-cap="video">🎥 ' + esc(T("Face", "面孔")) + '</button>' +
            '<button class="ag-capchip" data-cap="audio">🎙 ' + esc(T("Voice", "声音")) + '</button>' +
          '</div>' +
          // 🎥 面孔舞台
          '<div class="ag-stage-video">' +
            '<div style="font-size:12.5px;color:#a9e9cf;margin:0 0 8px;line-height:1.5">💡 ' + esc(T("Record in good lighting, with no hat, and your full face visible. Thank you.", "请在光线充足、不戴帽子、脸部完整露出的环境中录制。谢谢。")) + '</div>' +
            '<div style="position:relative;width:100%;max-width:520px;">' +
              '<video class="ag-cam" autoplay muted playsinline style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;background:#000;border:1px solid rgba(0,245,160,.4);display:block;transform:scaleX(-1);"></video>' +
              '<button class="ag-cam-start" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:' + GREEN + ';color:' + INK + ';font-weight:800;border:0;border-radius:999px;padding:12px 22px;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.4);white-space:nowrap;">🎥 ' + esc(T("Start camera", "开启摄像头")) + '</button>' +
              '<div class="ag-facering" style="display:none"><span>' + esc(T("Fit your face in the ring", "把脸对进圈里")) + '</span></div>' +
              '<div class="ag-countdown"></div>' +
            '</div>' +
            // 引导式情绪采集(Vision Pro 式逐步): 逐个提示 → 倒数 → 自动抓帧 → 下一步; 可推倒重录。
            '<div class="ag-guide">' +
              '<div class="ag-guide-dots"></div>' +
              '<div class="ag-guide-prompt">' + esc(T("Guided capture — 12 steps total, one expression at a time (~1.5s each). You always see which step you’re on; retake any single shot, or restart all.", "引导采集 —— 共 12 步,逐个表情来(每步约 1.5 秒)。全程都告诉你在第几步;可单张重拍,也可整体重录。")) + '</div>' +
              '<label class="ag-guide-auto"><input type="checkbox" checked> ' + esc(T("Auto-capture when your face is in the ring", "脸对进圈里就自动拍")) + '</label>' +
              '<button class="ag-guide-go ag-recbtn" disabled>▶ ' + esc(T("Start guided capture", "开始引导采集")) + '</button>' +
              '<button class="ag-guide-restart ag-recbtn" hidden style="background:transparent;color:#bff5e0;border:1px solid rgba(0,245,160,.45);margin-top:8px">↻ ' + esc(T("Restart", "推倒重录")) + '</button>' +
              '<div class="ag-guide-thumbs"></div>' +
            '</div>' +
          '</div>' +
          // 🎙 声音舞台 (波形/音量条)
          '<div class="ag-stage-audio" style="display:none">' +
            '<div class="ag-consent-script" style="margin:2px 0 10px;padding:10px 14px;background:rgba(0,245,160,.08);border:1px dashed rgba(0,245,160,.4);border-radius:10px;font-size:14px;color:#e8fff5;"></div>' +
            '<div style="font-size:12.5px;color:#8fe9c8;margin:0 0 10px;line-height:1.5">🎵 ' + esc(T("Read the line aloud, then hum or sing any few notes. It does NOT need to sound good — we just need a sample of your singing voice so your actor can carry a tune. Anything counts.", "先照读这句话,再随便哼唱几句。不要求唱得好听 —— 我们只需要一段你的『歌声』样本,好让你的分身能开口唱。哼两声、跑调都行。")) + '</div>' +
            '<canvas class="ag-meter" width="1040" height="180" style="width:100%;max-width:520px;height:90px;border-radius:14px;background:#0a1512;border:1px solid rgba(0,245,160,.4);display:block;"></canvas>' +
            '<button class="ag-voice-rec ag-recbtn" disabled>🎙 ' + esc(T("Record 8s — speak, then sing/hum", "录 8 秒 —— 先说话,再哼唱")) + '</button>' +
          '</div>' +
          '<div class="ag-cap-status ag-empty" style="font-size:12px;margin-top:10px"></div>' +
        '</div>' +
        '<button class="ag-cast ag-rp-submit">🎬 ' + esc(T("Sign & submit for verification", "签约并提交核验")) + '</button>' +
        '<div class="ag-form-msg ag-empty"></div>' +
      '</div></div>';
    var vid = scroll.querySelector(".ag-cam"), capStatus = scroll.querySelector(".ag-cap-status");
    var startBtn = scroll.querySelector(".ag-cam-start"), voiceBtn = scroll.querySelector(".ag-voice-rec");
    var recBtn = scroll.querySelector(".ag-guide-go");   // 引导采集的启动按钮(占用原 recBtn 启用位)
    var countdownEl = scroll.querySelector(".ag-countdown");
    var guideDots = scroll.querySelector(".ag-guide-dots"), guidePrompt = scroll.querySelector(".ag-guide-prompt");
    var guideRestart = scroll.querySelector(".ag-guide-restart"), guideThumbs = scroll.querySelector(".ag-guide-thumbs");
    var videoStage = scroll.querySelector(".ag-stage-video"), audioStage = scroll.querySelector(".ag-stage-audio");
    var meterCanvas = scroll.querySelector(".ag-meter");
    var audioCtx = null, analyser = null, meterRAF = null;
    function stopMeter() { if (meterRAF) { cancelAnimationFrame(meterRAF); meterRAF = null; } try { if (audioCtx) audioCtx.close(); } catch (_e) {} audioCtx = null; analyser = null; }
    var back = scroll.querySelector(".ag-back"); back.onclick = function () { stopMeter(); stopRpStream(); renderGrid(); };
    // 口头授权脚本(照读)= 声音样本 + 口头同意记录 + 防冒充活体(念出"我是XX本人…"还要对得上脸)。
    var nameInput = scroll.querySelector('[data-k="name_en"]'), scriptEl = scroll.querySelector(".ag-consent-script");
    function consentScript() {
      var nm = (nameInput && nameInput.value.trim()) || T("me", "本人");
      return T('📢 Read aloud: “I am ' + nm + ', and I consent to the CSS Studio platform using my likeness and voice as a digital actor. Thank you.”',
               '📢 请照读:「我是' + nm + '本人,我同意 CSS Studio 平台将我的肖像声音用作数字演员,谢谢。」');
    }
    function refreshScript() { if (scriptEl) scriptEl.textContent = consentScript(); }
    refreshScript();
    if (nameInput) nameInput.addEventListener("input", refreshScript);
    // 实时音量/波形条(麦克风电平)。喂 AnalyserNode 的是麦克风流, 不接 destination(非播放, 不违 W667)。
    function drawMeter() {
      if (!analyser || !meterCanvas) return;
      meterRAF = requestAnimationFrame(drawMeter);
      var ctx = meterCanvas.getContext("2d"); if (!ctx) return;
      var n = analyser.frequencyBinCount, data = new Uint8Array(n); analyser.getByteFrequencyData(data);
      var W = meterCanvas.width, H = meterCanvas.height; ctx.clearRect(0, 0, W, H);
      var bars = 56, step = Math.max(1, Math.floor(n / bars)), bw = W / bars;
      for (var i = 0; i < bars; i++) {
        var v = (data[i * step] || 0) / 255, bh = Math.max(3, v * H * 0.92);
        ctx.fillStyle = "rgba(0,245,160," + (0.3 + 0.65 * v) + ")";
        ctx.fillRect(i * bw + 1.5, (H - bh) / 2, bw - 3, bh);
      }
    }
    // 一次性拿流(视频+音频), 幂等; 面孔预览 + 声音波形都靠这一条流。
    function showStartAgain(label) { if (startBtn) { startBtn.style.display = ""; startBtn.textContent = "🎥 " + (label || T("Start camera", "开启摄像头")); } }
    function ensureStream() {
      if (rpStream && rpStream.active) return Promise.resolve(rpStream);
      // 某些内置浏览器(如 Facebook/微信 App 内)根本不给 getUserMedia → 别卡在"开启中"。
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        capStatus.textContent = "⚠️ " + T("This browser can't access the camera. Open cssstudio.app in Safari/Chrome or the CSS Studio app.", "此浏览器无法访问摄像头。请在 Safari/Chrome 或 CSS Studio App 里打开 cssstudio.app。");
        showStartAgain(T("Not supported here", "此环境不支持"));
        return Promise.resolve(null);
      }
      capStatus.textContent = T("Opening camera & mic…", "正在开启摄像头和麦克风…");
      if (startBtn) startBtn.style.display = "none";
      // 超时兜底: getUserMedia 若 12s 不返回(权限对话框没弹/环境卡死)→ 不再永远"开启中"。
      var timedOut = false;
      var timeout = new Promise(function (resolve) { setTimeout(function () { timedOut = true; resolve("__timeout__"); }, 12000); });
      var gum = navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: true });
      return Promise.race([gum, timeout]).then(function (s) {
        if (s === "__timeout__") {
          capStatus.textContent = "⚠️ " + T("Camera didn't respond. Allow camera/mic access, or open in Safari/the app, then tap to retry.", "摄像头无响应。请允许摄像头/麦克风权限,或在 Safari/App 里打开,然后点按重试。");
          showStartAgain(T("Retry", "重试"));
          gum.then(function (late) { try { late.getTracks().forEach(function (t) { t.stop(); }); } catch (_e) {} }).catch(function () {}); // 迟到的流别泄漏
          return null;
        }
        return handleStream(s);
      }).catch(function (err) {
        if (timedOut) return null;
        var nm = (err && err.name) || "";
        capStatus.textContent = (nm === "NotAllowedError")
          ? T("Camera/mic permission denied — allow it and tap to retry.", "摄像头/麦克风权限被拒——请允许后点按重试。")
          : (nm === "NotReadableError")
            ? T("Camera is in use by another app. Close it and retry.", "摄像头正被别的 App 占用,关掉再试。")
            : T("Camera/mic permission denied.", "摄像头/麦克风权限被拒。") + (nm ? " (" + nm + ")" : "");
        showStartAgain(T("Retry", "重试"));
        return null;
      });
    }
    function handleStream(s) {
      return Promise.resolve(s).then(function (s) {
        rpStream = s; vid.srcObject = s; vid.muted = true;
        vid.setAttribute("data-live-capture", "1");   // 全局媒体裁判跳过
        vid.onloadedmetadata = function () { try { vid.play(); } catch (_e) {} };
        vid.onpause = function () { if (rpStream && rpStream.active) { try { vid.play(); } catch (_e) {} } };  // 被裁判摁停自恢复
        vid.play().catch(function () {});
        if (startBtn) startBtn.style.display = "none";
        recBtn.disabled = false; voiceBtn.disabled = false;
        // 波形分析(麦克风电平)
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC && s.getAudioTracks().length) {
            audioCtx = new AC();
            var src = audioCtx.createMediaStreamSource(new MediaStream(s.getAudioTracks()));
            analyser = audioCtx.createAnalyser(); analyser.fftSize = 256; src.connect(analyser);
            if (!meterRAF) drawMeter();
          }
        } catch (_e) {}
        setTimeout(function () {
          var vt = (s.getVideoTracks && s.getVideoTracks()[0]) || null, w = vid.videoWidth || 0;
          if (vt && vt.readyState === "live" && w > 0) capStatus.textContent = "✅ " + T("Ready", "已就绪") + " (" + w + "×" + (vid.videoHeight || 0) + ")";
          else if (vt && vt.readyState === "live") capStatus.textContent = "⚠️ " + T("Camera live but no image — another app (Zoom/FaceTime/Photo Booth) may be using it, or the lens is covered.", "摄像头正常但无画面——可能被别的 App(Zoom/FaceTime/Photo Booth)占用,或镜头被遮挡。");
          else capStatus.textContent = "⚠️ " + T("Camera did not start. Check System Settings › Privacy › Camera.", "摄像头未启动。检查 系统设置 › 隐私 › 摄像头。");
        }, 800);
        return s;
      }).catch(function (err) {
        var nm = (err && err.name) || "";
        capStatus.textContent = (nm === "NotAllowedError")
          ? T("Camera/mic permission denied — allow it and retry.", "摄像头/麦克风权限被拒——请允许后重试。")
          : (nm === "NotReadableError")
            ? T("Camera is in use by another app. Close it and retry.", "摄像头正被别的 App 占用,关掉再试。")
            : T("Camera/mic permission denied.", "摄像头/麦克风权限被拒。") + (nm ? " (" + nm + ")" : "");
        return null;
      });
    }
    if (startBtn) startBtn.onclick = function () { ensureStream(); };
    // 两胶囊模式切换: 🎥 面孔 | 🎙 声音
    function switchMode(key) {
      var isAudio = key === "audio";
      if (videoStage) videoStage.style.display = isAudio ? "none" : "";
      if (audioStage) audioStage.style.display = isAudio ? "" : "none";
      ensureStream();   // 点胶囊即用户手势, 顺势开流(波形/预览都靠它)
    }
    var capBar = scroll.querySelector(".ag-capmode");
    if (capBar) {
      capBar.querySelectorAll(".ag-capchip").forEach(function (c) { c.setAttribute("data-pill-key", c.getAttribute("data-cap")); });
      if (typeof window.cssosMakePillBar === "function") {
        capBar.classList.add("ag-pillbar");
        window.cssosMakePillBar(capBar, { mono: true, compact: true, textColor: "light", activeKey: "video", onActivate: switchMode });
      } else {
        capBar.querySelectorAll(".ag-capchip").forEach(function (c) {
          c.onclick = function () { capBar.querySelectorAll(".ag-capchip").forEach(function (x) { x.classList.toggle("on", x === c); }); switchMode(c.getAttribute("data-cap")); };
        });
      }
    }
    function pickMime(video) {
      var cands = video ? ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9", "video/webm", "video/mp4"]
                        : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      for (var i = 0; i < cands.length; i++) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(cands[i])) return cands[i]; } catch (_e) {} }
      return "";
    }
    function recordTrack(kindKey, uploadKind, opts, seconds, btn) {
      function ensureThen() {
        if (!rpStream) { ensureStream().then(function (s) { if (s) recordTrack(kindKey, uploadKind, opts, seconds, btn); }); return false; }
        return true;
      }
      if (!ensureThen()) return;
      var isVideo = !opts.audioOnly;
      var stream = opts.audioOnly ? new MediaStream(rpStream.getAudioTracks()) : rpStream;
      var mime = pickMime(isVideo);
      var mrOpts = isVideo ? { mimeType: mime || undefined, videoBitsPerSecond: 900000, audioBitsPerSecond: 64000 } : { mimeType: mime || undefined, audioBitsPerSecond: 64000 };
      var mr, chunks = [];
      try { mr = new MediaRecorder(stream, mrOpts); } catch (e) { try { mr = new MediaRecorder(stream); } catch (e2) { capStatus.textContent = T("Recording not supported on this browser.", "此浏览器不支持录制。"); return; } }
      var label = btn ? btn.textContent : "";
      function restore() { if (btn) { btn.classList.remove("recording"); btn.disabled = false; btn.textContent = label; } }
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        restore();
        if (!chunks.length) { capStatus.textContent = T("Nothing recorded, try again.", "没录到内容,请重试。"); return; }
        var blob = new Blob(chunks, { type: chunks[0].type || (isVideo ? "video/webm" : "audio/webm") });
        capStatus.textContent = "⏳ " + T("Uploading…", "上传中…") + " (" + Math.round(blob.size / 1024) + "KB)";
        if (blob.size > 22 * 1024 * 1024) { capStatus.textContent = T("Recording too large — record a shorter clip.", "录制文件过大,请录短一点。"); return; }
        uploadCapture(uploadKind, blob).then(function (j) {
          if (j && j.ok) { captured[kindKey] = j.url; capStatus.textContent = "✅ " + T("Captured", "已采集") + " (" + kindKey + ")"; }
          else capStatus.textContent = T("Upload failed", "上传失败") + (j && j.code ? " · " + j.code : "") + ".";
        }).catch(function (e) { capStatus.textContent = T("Upload failed (network).", "上传失败(网络)。"); });
      };
      if (btn) { btn.classList.add("recording"); btn.disabled = true; }
      mr.start();
      var left = seconds;
      function tick() { if (btn) btn.textContent = "⏺ " + T("Recording", "录制中") + " " + left + "s"; capStatus.textContent = "⏺ " + T("Recording…", "录制中…") + " " + left + "s"; }
      tick();
      var iv = setInterval(function () { left--; if (left <= 0) { clearInterval(iv); } else tick(); }, 1000);
      setTimeout(function () { clearInterval(iv); try { if (mr.state !== "inactive") mr.stop(); } catch (_e) {} }, seconds * 1000);
    }
    // ── 引导式情绪采集(6 情绪通道 + 几何/活体 + 反派 + 自由鬼脸)──
    // 每步都带一句「为什么」—— 让用户明白这是必须的采集,不是刁难/耍猴。
    var GUIDE_STEPS = [
      { k: "front",    e: "🙂", en: "Face the camera · relaxed",   zh: "正对镜头 · 放松",   wen: "So your digital actor has a clear front face.", wzh: "让你的分身有一张清晰的正脸。" },
      { k: "left",     e: "⬅️", en: "Slowly turn head left",       zh: "慢慢向左转头",       wen: "So it can turn its head — not a flat cutout.", wzh: "让分身能自然转头,不是纸片人。" },
      { k: "right",    e: "➡️", en: "Slowly turn head right",      zh: "慢慢向右转头",       wen: "The other side, for a full 3D-ready face.", wzh: "另一侧,凑齐可建脸的多角度。" },
      { k: "blink",    e: "😌", en: "Close your eyes",             zh: "闭上眼睛",           wen: "Proves you're live — stops anyone faking you with a photo.", wzh: "证明是真人活体,防止别人拿一张照片冒充你。" },
      { k: "calm",     e: "😐", en: "Neutral · calm",              zh: "中性 · 平静",       wen: "The baseline every other emotion is built from.", wzh: "所有其它表情都从这张基线出发。" },
      { k: "joy",      e: "😄", en: "Laugh out loud",              zh: "哈哈大笑",           wen: "So your actor can truly smile and laugh on screen.", wzh: "让你的分身在镜头前真的会笑。" },
      { k: "grief",    e: "😢", en: "Grief · about to cry",        zh: "哭丧脸 · 快哭了",    wen: "So it can carry sad, moving scenes.", wzh: "让分身能演悲伤、催泪的戏。" },
      { k: "ignite",   e: "😠", en: "Anger · glare & roar",        zh: "怒目 · 怒吼",        wen: "For intense, powerful moments.", wzh: "撑得起激昂、爆发的段落。" },
      { k: "intimate", e: "🥰", en: "Tender, loving gaze",         zh: "深情凝视",           wen: "For love songs and tender scenes.", wzh: "情歌、深情戏靠它。" },
      { k: "resolve",  e: "😤", en: "Determined · defiant",        zh: "坚定 · 昂首挑衅",     wen: "For strong, triumphant beats.", wzh: "坚定、凯旋的高光时刻。" },
      { k: "villain",  e: "😈", en: "Villain · cold sneer",        zh: "反派 · 冷笑 / 狞笑",  wen: "So you can also play the bad guy.", wzh: "让你也能演反派坏人。" },
      { k: "grimace",  e: "🤪", en: "Freestyle · make a funny face", zh: "自由发挥 · 做个鬼脸", wen: "A spontaneous face is very hard for AI to fake — it protects the real you.", wzh: "即兴鬼脸 AI 极难伪造,保护真实的你。" }
    ];
    var guide = { i: 0, frames: {}, uploads: [], running: false, auto: true, autoTimer: null };
    var faceRing = scroll.querySelector(".ag-facering"), autoToggle = scroll.querySelector(".ag-guide-auto input");
    if (autoToggle) autoToggle.onchange = function () { guide.auto = autoToggle.checked; if (guide.running && guide.auto && GUIDE_STEPS[guide.i]) armStep(); else clearAuto(); };
    function grabFrame() {
      var w = vid.videoWidth || 640, h = vid.videoHeight || 480;
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      var cx = cv.getContext("2d"); if (!cx) return null;
      try { cx.drawImage(vid, 0, 0, w, h); } catch (_e) { return null; }
      try { return cv.toDataURL("image/jpeg", 0.85); } catch (_e) { return null; }
    }
    function uploadFrame(dataUrl) {
      return fetch("/api/actors/capture-upload", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "photo", data_b64: dataUrl }) })
        .then(function (r) { return r.json(); });
    }
    function clearAuto() { if (guide.autoTimer) { clearInterval(guide.autoTimer); clearTimeout(guide.autoTimer); guide.autoTimer = null; } }
    function persistFrame(s, dataUrl, thumb) {
      guide.frames[s.k] = "__up__";
      var up = uploadFrame(dataUrl).then(function (j) { if (j && j.ok) { guide.frames[s.k] = j.url; thumb.classList.remove("pending"); } else { guide.frames[s.k] = null; thumb.style.borderColor = "rgba(255,120,120,.6)"; } })
        .catch(function () { guide.frames[s.k] = null; });
      guide.uploads.push(up);
    }
    function wireRetake(thumb, s) { var rb = thumb.querySelector(".gretake"); if (rb) rb.onclick = function (ev) { ev.stopPropagation(); recapture(s, thumb); }; }
    // 单张重拍: 只重录这一步(不动其它已拍的), 覆盖同一缩略图与 frames[key]。
    function recapture(s, thumb) {
      clearAuto();
      runCountdown(function (url0) { if (!url0) return; var im = thumb.querySelector("img"); if (im) im.src = url0; thumb.classList.add("pending"); persistFrame(s, url0, thumb); });
    }
    // 共用倒数+快门(3-2-1 → 抓帧), cb(dataUrl)。
    function runCountdown(cb) {
      if (countdownEl.dataset.busy === "1") return; countdownEl.dataset.busy = "1"; recBtn.disabled = true;
      var n = 3; countdownEl.style.display = "flex"; countdownEl.textContent = n;
      var iv = setInterval(function () {
        n--; if (n > 0) { countdownEl.textContent = n; return; }
        clearInterval(iv);
        var url0 = grabFrame();
        countdownEl.textContent = "📸"; countdownEl.classList.add("flash");
        setTimeout(function () { countdownEl.classList.remove("flash"); countdownEl.style.display = "none"; countdownEl.dataset.busy = ""; recBtn.disabled = false; }, 200);
        cb(url0);
      }, 750);
    }
    function renderGuide() {
      guideDots.innerHTML = GUIDE_STEPS.map(function (s, idx) {
        var cls = guide.frames[s.k] ? "gd done" : (idx === guide.i ? "gd cur" : "gd");
        return '<span class="' + cls + '"></span>';
      }).join("");
      var s = GUIDE_STEPS[guide.i];
      if (!s) { guidePrompt.innerHTML = "✅ " + esc(T("All captured — retake any shot above, or sign & submit below.", "采集完成 —— 可点上方任意缩略图重拍,或到下方签约提交。")); recBtn.style.display = "none"; if (faceRing) faceRing.style.display = "none"; clearAuto(); return; }
      guidePrompt.innerHTML = '<span class="gemoji">' + s.e + '</span><span class="glabel"><span class="gstepc">' + esc(T("Step " + (guide.i + 1) + " of " + GUIDE_STEPS.length, "第 " + (guide.i + 1) + " / " + GUIDE_STEPS.length + " 步")) + '</span><b>' + esc(T(s.en, s.zh)) + '</b><em>' + esc(T(s.wen, s.wzh)) + '</em></span>';
      recBtn.style.display = ""; recBtn.disabled = false; recBtn.textContent = "📸 " + T("Capture this", "拍这张");
      if (faceRing) faceRing.style.display = "";
      armStep();
    }
    // 自动抓拍: 有 FaceDetector(Android/部分)时脸对齐即自动拍; 没有(iOS/webview)则 2.6s 后自动拍。手点「拍这张」随时可覆盖。
    function armStep() {
      clearAuto();
      var s = GUIDE_STEPS[guide.i]; if (!s) return;
      if (faceRing) faceRing.classList.remove("aligned");
      if (!guide.auto) return;
      if (window.FaceDetector) {
        var det = null; try { det = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: true }); } catch (_e) { det = null; }
        if (det) {
          var stable = 0;
          guide.autoTimer = setInterval(function () {
            det.detect(vid).then(function (faces) {
              if (faces && faces.length) {
                var bb = faces[0].boundingBox || {}, ok = (bb.width || 0) > (vid.videoWidth || 640) * 0.24;
                if (faceRing) faceRing.classList.toggle("aligned", ok);
                if (ok) { stable++; if (stable >= 3) { clearAuto(); captureStep(); } } else stable = 0;
              } else { if (faceRing) faceRing.classList.remove("aligned"); stable = 0; }
            }).catch(function () {});
          }, 350);
          return;
        }
      }
      guide.autoTimer = setTimeout(function () { captureStep(); }, 2600);
    }
    function captureStep() {
      clearAuto();
      var s = GUIDE_STEPS[guide.i]; if (!s) return;
      runCountdown(function (url0) {
        if (url0) {
          var thumb = document.createElement("div"); thumb.className = "gthumb pending";
          thumb.innerHTML = '<img src="' + url0 + '"><span>' + s.e + '</span><button class="gretake" title="' + esc(T("Retake", "重拍")) + '">↻</button>';
          guideThumbs.appendChild(thumb); wireRetake(thumb, s); persistFrame(s, url0, thumb);
        } else guide.frames[s.k] = null;
        setTimeout(function () { guide.i++; if (guide.i >= GUIDE_STEPS.length) onGuideDone(); else renderGuide(); }, 550);
      });
    }
    function onGuideDone() {
      captured.guided_done = true; captured.frames = guide.frames;
      capStatus.textContent = "✅ " + T("Guided capture complete", "引导采集完成");
      renderGuide();
    }
    function resetGuide() { clearAuto(); guide = { i: 0, frames: {}, uploads: [], running: true, auto: autoToggle ? autoToggle.checked : true, autoTimer: null }; guideThumbs.innerHTML = ""; captured.guided_done = false; captured.frames = null; }
    function startGuide() {
      if (!rpStream || !rpStream.active) { ensureStream().then(function (s) { if (s) startGuide(); }); return; }
      if (!guide.running) { resetGuide(); guideRestart.hidden = false; renderGuide(); return; }
      captureStep();
    }
    recBtn.onclick = startGuide;
    guideRestart.onclick = function () { resetGuide(); renderGuide(); };
    voiceBtn.onclick = function () { recordTrack("speech", "speech", { audioOnly: true }, 8, voiceBtn); };
    var roleTax = wireRoleTaxonomy(scroll);
    var submit = scroll.querySelector(".ag-rp-submit"), msg = scroll.querySelector(".ag-form-msg");
    submit.onclick = function () {
      var p = {};
      scroll.querySelectorAll(".ag-in").forEach(function (el) { p[el.getAttribute("data-k")] = el.value; });
      scroll.querySelectorAll("[data-k][type=checkbox]").forEach(function (el) { p[el.getAttribute("data-k")] = el.checked; });
      p.archetypes = roleTax.archetypes(); p.sub_roles = roleTax.subRoles();
      if (!p.name_en || String(p.name_en).trim().length < 2) { msg.textContent = T("Please enter your name.", "请填名字。"); return; }
      if (!p.grant_likeness) { msg.textContent = T("You must grant likeness consent.", "必须勾选授权肖像。"); return; }
      if (!p.gender) { msg.textContent = T("Please choose a voice gender.", "请选择声线性别。"); return; }
      if (!captured.guided_done) { msg.textContent = T("Please finish the guided capture first (tap “Start guided capture”).", "请先完成引导采集(点「开始引导采集」)。"); return; }
      submit.disabled = true; msg.textContent = "⏳ " + T("Finishing capture…", "整理采集中…");
      // 等所有帧上传落地, 再签约(引导采集是异步上传的)。
      Promise.all((guide.uploads || []).map(function (pr) { return pr.catch(function () {}); })).then(function () {
        var frames = {}; Object.keys(guide.frames || {}).forEach(function (k) { var v = guide.frames[k]; if (v && v.indexOf && v.indexOf("http") === 0) frames[k] = v; });
        if (!Object.keys(frames).length) { submit.disabled = false; msg.textContent = T("Capture didn't upload — check connection and retry.", "采集未上传成功——检查网络后重试。"); return; }
        var liveRef = frames.front || frames.calm || frames[Object.keys(frames)[0]];
        captured.face_video = liveRef;   // 活体参考用正脸帧
        p.likeness_capture = { mode: "guided_frames", frames: frames, liveness_ref: liveRef };
        if (captured.speech) p.voice_capture = { speech_url: captured.speech, spoken_consent: consentScript(), consented_at: new Date().toISOString() };
        msg.textContent = "⏳ " + T("Signing…", "签约中…");
        doSignup(p);
      });
    };
    function doSignup(p) {
      fetch("/api/actors/real-person", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(p) })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok) {
            // 自动提交核验
            fetch("/api/actors/" + encodeURIComponent(j.actor_id) + "/submit-verification", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ method: "self_liveness", liveness_ref: captured.face_video }) })
              .then(function () {}).catch(function () {});
            stopRpStream();
            scroll.innerHTML = '<div class="ag-detail"><button class="ag-back">‹ ' + esc(T("Back", "返回")) + '</button><div class="ag-empty" style="font-size:16px;margin-top:20px">✅ ' + esc(T("Signed! Your actor is submitted for identity verification. Once approved it goes public and you start earning. Self-cast is free.", "签约成功!已提交身份核验。通过后自动公开上架、开始赚钱。自选自演免费。")) + '</div></div>';
            scroll.querySelector(".ag-back").onclick = function () { renderGrid(); };
          } else { submit.disabled = false; msg.textContent = (j && j.hint) || T("Sign-up failed, please retry.", "签约失败,请重试。"); }
        }).catch(function () { submit.disabled = false; msg.textContent = T("Network error, please retry.", "网络错误,请重试。"); });
    };
  }

  // 分享数字演员: 落地页 /a/<id>(后端给 og:image=封面 + 自荐)。有原生分享用原生, 否则开 X 意图 + 复制链接。
  function fmtWhen(ts) {
    try { var d = new Date(ts); var s = Math.max(0, (Date.now() - d.getTime()) / 1000);
      if (s < 60) return T("just now", "刚刚");
      if (s < 3600) return Math.floor(s / 60) + T("m ago", " 分钟前");
      if (s < 86400) return Math.floor(s / 3600) + T("h ago", " 小时前");
      if (s < 2592000) return Math.floor(s / 86400) + T("d ago", " 天前");
      return d.toLocaleDateString();
    } catch (e) { return ""; }
  }
  // 绝对时间戳: 时间在前、日期在后 —— H:MMAM/PM MM-DD-YYYY(如 4:53PM 07-07-2026)。
  function fmtStamp(ts) {
    try {
      var d = new Date(ts);
      var mm = ("0" + (d.getMonth() + 1)).slice(-2), dd = ("0" + d.getDate()).slice(-2), yy = d.getFullYear();
      var h = d.getHours(), ap = h >= 12 ? "PM" : "AM"; h = h % 12; if (h === 0) h = 12;
      var mi = ("0" + d.getMinutes()).slice(-2);
      return h + ":" + mi + ap + " " + mm + "-" + dd + "-" + yy;
    } catch (e) { return ""; }
  }
  function commentHtml(c, isReply) {
    var pinned = !isReply && c.pinned;
    return '<div class="ag-cmt' + (isReply ? ' ag-cmt-reply' : '') + (pinned ? ' ag-cmt-pinned' : '') + '" data-cid="' + esc(c.id) + '">' +
      '<div class="who"><span>' + (pinned ? '<span class="ag-cmt-pin-badge">📌 ' + esc(T("Pinned", "置顶")) + '</span> ' : '') + esc(c.author_name || "Guest") + '</span>' +
      '<span class="ag-cmt-actions">' +
        '<button class="ag-cmt-copy" title="' + esc(T("Copy", "复制")) + '">📋</button>' +
        (c.can_pin && !isReply ? '<button class="ag-cmt-pin' + (pinned ? ' on' : '') + '" data-cid="' + esc(c.id) + '" title="' + esc(pinned ? T("Unpin", "取消置顶") : T("Pin to top", "置顶")) + '">' + (pinned ? '📌' : '📍') + '</button>' : '') +
        (c.can_reply && !isReply ? '<button class="ag-reply-btn" data-cid="' + esc(c.id) + '">' + esc(T("Reply", "回复")) + '</button>' : '') +
        (c.mine ? '<button class="del" data-cid="' + esc(c.id) + '">' + esc(T("Delete", "删除")) + '</button>' : '') +
      '</span></div>' +
      '<div class="body">' + esc(c.body) + '</div>' +
      // W1593 — 右下角只读胶囊: 绝对时间 + 地区(无标签, 如「07-07-2026 4:53PM USA」)。
      '<div class="ag-cmt-meta">' +
        '<span class="ag-cmt-chip">' + esc(fmtStamp(c.created_at)) + (c.region ? ' ' + esc(c.region) : '') + '</span>' +
      '</div>' +
      (isReply ? '' : '<div class="ag-cmt-kids"></div>') +
      '</div>';
  }
  function postComment(actorId, body, parentId) {
    return fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: body, parent_id: parentId || undefined }) }).then(function (r) { return r.json(); });
  }
  function needSignIn() {
    if (window.cssosGuidedToast) window.cssosGuidedToast(T("Sign in to comment.", "登录后即可评论。"), { actions: [{ label: T("Sign in", "登录"), onClick: function () { if (window.cssosOpenLogin) window.cssosOpenLogin(); } }] });
    else window.alert(T("Sign in to comment.", "登录后即可评论。"));
  }
  function wireCommentActions(listEl, actorId) {
    if (listEl.__wired) return; listEl.__wired = true;
    listEl.addEventListener("click", function (e) {
      var t = e.target;
      var cp = t.closest && t.closest(".ag-cmt-copy");
      if (cp) {
        var chost = cp.closest(".ag-cmt");
        var bodyEl = chost && chost.querySelector(":scope > .body");
        if (bodyEl) agCopy(bodyEl.textContent || "", cp);
        return;
      }
      var pin = t.closest && t.closest(".ag-cmt-pin");
      if (pin) {
        var pid = pin.getAttribute("data-cid");
        pin.disabled = true;
        fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments/" + encodeURIComponent(pid) + "/pin", { method: "POST", credentials: "include" })
          .then(function (r) { return r.json(); }).then(function (j) {
            pin.disabled = false;
            if (j && j.ok) {
              fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments", { credentials: "include" })
                .then(function (r2) { return r2.json(); }).then(function (jj) { renderComments(listEl, actorId, (jj && jj.comments) || [], !!(jj && jj.signed_in)); });
            } else if (j && j.code === "NOT_OWNER") { window.alert(T("Only the actor's owner can pin.", "只有演员主人能置顶。")); }
          }).catch(function () { pin.disabled = false; });
        return;
      }
      var del = t.closest && t.closest(".del");
      if (del) {
        var cid = del.getAttribute("data-cid");
        fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments/" + encodeURIComponent(cid), { method: "DELETE", credentials: "include" })
          .then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) { var n = listEl.querySelector('.ag-cmt[data-cid="' + cid + '"]'); if (n) n.remove(); if (!listEl.querySelector(".ag-cmt")) renderComments(listEl, actorId, [], listEl.__signedIn); } });
        return;
      }
      var rb = t.closest && t.closest(".ag-reply-btn");
      if (rb) {
        if (!listEl.__signedIn) { needSignIn(); return; }
        var host = rb.closest(".ag-cmt");
        var open = host.querySelector(".ag-reply-box");
        if (open) { open.remove(); return; }   // 再点 = 收起
        var rbox = document.createElement("div"); rbox.className = "ag-reply-box";
        rbox.innerHTML = '<textarea class="ag-reply-text" rows="1" placeholder="' + esc(T("Write a reply…", "写条回复…")) + '" maxlength="800"></textarea><button class="ag-reply-send">' + esc(T("Reply", "回复")) + '</button>';
        host.insertBefore(rbox, host.querySelector(".ag-cmt-kids"));
        rbox.querySelector(".ag-reply-text").focus();
        return;
      }
      var rs = t.closest && t.closest(".ag-reply-send");
      if (rs) {
        var rbox2 = rs.closest(".ag-reply-box"), host2 = rs.closest(".ag-cmt");
        var body = String(rbox2.querySelector(".ag-reply-text").value || "").trim();
        if (!body) return;
        rs.disabled = true;
        postComment(actorId, body, host2.getAttribute("data-cid")).then(function (j) {
          rs.disabled = false;
          if (j && j.ok && j.comment) { host2.querySelector(".ag-cmt-kids").insertAdjacentHTML("beforeend", commentHtml(j.comment, true)); rbox2.remove(); }
          else if (j && j.code === "AUTH_REQUIRED") needSignIn();
          else window.alert(T("Failed to post.", "发布失败。"));
        }).catch(function () { rs.disabled = false; window.alert(T("Failed to post.", "发布失败。")); });
        return;
      }
    });
  }
  function renderComments(listEl, actorId, comments, signedIn) {
    listEl.__signedIn = signedIn;
    if (!comments.length) { listEl.innerHTML = '<div class="ag-cmt-empty">' + esc(T("No comments yet. Be the first!", "还没有评论,来抢沙发!")) + '</div>'; return; }
    var tops = comments.filter(function (c) { return !c.parent_id; }).sort(function (a, b) { return ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (new Date(b.created_at) - new Date(a.created_at)); });   // 置顶优先, 再按时间
    var kids = {}; comments.forEach(function (c) { if (c.parent_id) { (kids[c.parent_id] = kids[c.parent_id] || []).push(c); } });
    listEl.innerHTML = tops.map(function (c) { return commentHtml(c, false); }).join("");
    tops.forEach(function (c) {
      var arr = (kids[c.id] || []).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      if (arr.length) { var host = listEl.querySelector('.ag-cmt[data-cid="' + c.id + '"] .ag-cmt-kids'); if (host) host.innerHTML = arr.map(function (k) { return commentHtml(k, true); }).join(""); }
    });
    wireCommentActions(listEl, actorId);
  }
  function toggleComments(inline, actorId) {
    var box = inline.querySelector(".ag-comments");
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    var listEl = box.querySelector(".ag-cmt-list");
    var textEl = box.querySelector(".ag-cmt-text");
    var sendEl = box.querySelector(".ag-cmt-send");
    if (box.__loaded) return;
    box.__loaded = true;
    listEl.innerHTML = '<div class="ag-cmt-empty">' + esc(T("Loading…", "加载中…")) + '</div>';
    fetch("/api/actors/" + encodeURIComponent(actorId) + "/comments", { credentials: "include" })
      .then(function (r) { return r.json(); }).then(function (j) { renderComments(listEl, actorId, (j && j.comments) || [], !!(j && j.signed_in)); })
      .catch(function () { listEl.innerHTML = '<div class="ag-cmt-empty">' + esc(T("Failed to load.", "加载失败。")) + '</div>'; });
    sendEl.onclick = function () {
      var body = String(textEl.value || "").trim();
      if (!body) return;
      sendEl.disabled = true;
      postComment(actorId, body, null).then(function (j) {
        sendEl.disabled = false;
        if (j && j.ok && j.comment) {
          textEl.value = "";
          var empty = listEl.querySelector(".ag-cmt-empty"); if (empty) empty.remove();
          listEl.insertAdjacentHTML("afterbegin", commentHtml(j.comment, false));
          listEl.__signedIn = true; wireCommentActions(listEl, actorId);
        } else if (j && j.code === "AUTH_REQUIRED") needSignIn();
        else window.alert(T("Failed to post.", "发布失败。"));
      }).catch(function () { sendEl.disabled = false; window.alert(T("Failed to post.", "发布失败。")); });
    };
    textEl.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendEl.click(); } });   // 回车=发送, Shift+回车=换行
  }
  function shareActor(a) {
    var name = a.name_en || a.name_zh || "Digital Actor";
    var url = "https://cssstudio.app/a/" + encodeURIComponent(a.actor_id);
    // 分享计数 +1(点分享即算, 不阻断)。同步更新详情里的 ↗ 数字。
    fetch("/api/actors/" + encodeURIComponent(a.actor_id) + "/share", { method: "POST", credentials: "include" })
      .then(function (r) { return r.json(); }).then(function (j) {
        var root = document.getElementById(ROOT_ID);
        if (j && j.ok && root) { var sb = root.querySelector('.ag-share .ag-cnt'); if (sb) sb.textContent = j.share_count; }
      }).catch(function () {});
    var slg = sloganOf(a);
    var title = (slg ? name + " — " + slg : name + " · Digital Actor");
    // 带上数字演员的自荐/自我介绍(persona + 声线 + 风格 + CTA), 写长写足; 分享面板按各平台字数上限自动截取。
    var intro = String(a.persona || slg || "").trim();
    var vc = String(a.voice_style || "").trim(), st = String(a.style_descriptor || "").trim();
    var richText = T(
      (intro ? "“" + intro + "” — " : "") + "Meet " + name + ", a digital actor on CSS Studio. " +
        (vc ? "Voice: " + vc + ". " : "") + (st ? "Style: " + st + ". " : "") +
        "Cast them to star in your next music video — as a hero, a villain, or a legend, the choice is yours. Say CSS, and witness the miracle. 🎭",
      (intro ? "「" + intro + "」—— " : "") + "认识数字演员「" + name + "」。" +
        (vc ? "声线:" + vc + "。" : "") + (st ? "风格:" + st + "。" : "") +
        "选 TA 主演你的下一支 MV —— 正派、反派、还是名角,由你导演。一句 CSS,见证奇迹。🎭");
    // 用平台自己的分享面板(X/微博/小红书/抖音… 一整排), 不用「太苹果」的原生分享。
    if (typeof window.openCssosShareDialog === "function") {
      window.openCssosShareDialog({ url: url, title: title, text: richText, headerLabel: T("Share this actor", "分享这位演员") });
      return;
    }
    // 兜底: 复制链接。
    try { if (navigator.clipboard) navigator.clipboard.writeText(url); } catch (_e2) {}
    if (typeof window.cssosGuidedToast === "function") window.cssosGuidedToast(T("Link copied", "链接已复制"), {});
  }

  /* W1787 — 单份作品的估算成本(分)。与 AI 助理的 CENTS_PER_WORK 同一口径,
   * 两处必须一致, 否则同一部电影在两个入口报出两个价。 */
  var CAST_CENTS_PER_WORK = 250;

  // 作品类型: 音乐驱动 + 叙事驱动(W1787 起全部开放, 但一律走 castGate 钱包刹车)。
  var CAST_WORK_TYPES = [
    { key: "single",   emoji: "🎬", en: "MV (single)",  zh: "单曲 MV",  descEn: "One song, one video", descZh: "一首歌 · 一支 MV", ready: true, works: 1 },
    { key: "triptych", emoji: "🎼", en: "Triptych",     zh: "三部曲",   descEn: "3 connected chapters", descZh: "三段相连的乐章", ready: true, works: 3 },
    { key: "opera",    emoji: "🎭", en: "Opera",        zh: "歌剧",     descEn: "Multi-act musical epic", descZh: "多幕音乐史诗", ready: true, works: 5 },
    /* CSSOS_WAVE_1787 20260727 — Jing 指令:开放短剧/电视连续剧/电影。
     * 之前锁着是因为"自动编剧还没就绪";现在开放,但【必须走钱包刹车】——
     * 估算 × 1.2 的余额门槛 + 二次确认,读不到余额一律拦住。见 castGate()。
     * 这三档 heavy:true,确认框会额外警告体量与费用。 */
    { key: "shortplay",emoji: "📺", en: "Short drama",  zh: "短剧",     descEn: "Auto-scripted · 12 works", descZh: "自动编剧 · 约 12 段", ready: true, works: 12, heavy: true },
    { key: "series",   emoji: "📽", en: "TV series",    zh: "电视连续剧", descEn: "Auto-scripted · 24 works", descZh: "自动编剧 · 约 24 段", ready: true, works: 24, heavy: true },
    { key: "film",     emoji: "🎦", en: "Film",         zh: "电影",     descEn: "Auto-scripted · 40 works", descZh: "自动编剧 · 约 40 段", ready: true, works: 40, heavy: true },
  ];
  function castPromptFor(actor, name, workType) {
    var base;
    if (workType === "triptych") base = T("Create a 3-part triptych MV starring the digital actor “" + name + "” — three connected chapters/songs.", "用数字演员「" + name + "」主演,创作一部三部曲 MV(三段相连的乐章)。");
    else if (workType === "opera") base = T("Create a multi-act opera (grand musical MV) starring the digital actor “" + name + "”.", "用数字演员「" + name + "」主演,创作一部多幕歌剧(宏大音乐 MV)。");
    else base = T("Create an MV starring the digital actor “" + name + "”.", "用数字演员「" + name + "」主演,创作一支 MV。");
    return base +
      (actor.face_prompt ? T(" Actor look: ", " 该演员形象: ") + actor.face_prompt + "." : "") +
      (actor.voice_style ? T(" Voice: ", " 声线: ") + actor.voice_style + "." : "") +
      (actor.style_descriptor ? T(" Style: ", " 风格: ") + actor.style_descriptor + "." : "");
  }
  function castRun(actor, workType) {
    var name = actor.name_zh || actor.name_en;
    // C 选角注入: 记下待选角演员 → fetch 拦截器把 actor_id 注入生成/建档调用, 后端注入锁定形象+记选角。
    window.__cssosCastActorId = actor.actor_id;
    window.__cssosCastActorName = name;
    var prompt = castPromptFor(actor, name, workType);
    // 缺口1(W1537) — 文案带上【全体 cast】(反派/配角也进故事+歌词, 不只画面)。
    //   ⚠️ i18N: 这些是发给 LLM 的【生成指令】(英文骨架), 输出【歌词语言】仍由后端按主角文明智能联动
    //   (civToLanguageServer)决定, 与此处 UI 语言无关。角色标签走 T() 显示层。
    var castArr = (window.__cssosCast && Array.isArray(window.__cssosCast.cast)) ? window.__cssosCast.cast : [];
    var others = castArr.filter(function (m) { return m.actor_id !== actor.actor_id && m.name; });
    if (others.length) {
      prompt += " " + T("Co-starring", "同台演员") + ": " +
        others.map(function (m) { return m.name + " (" + T(m.role_label_en || m.role, m.role_label_zh || m.role) + ")"; }).join(", ") +
        ". " + T("Weave every cast member into the story and lyrics, each true to their role.", "让每位演员都进入剧情与歌词, 各司其职。");
    }
    // 缺口5 — 出炉前一句确认(主演 + 反派/配角), 让导演确定 cast 生效。全 T()。
    if (typeof window.cssosGuidedToast === "function") {
      window.cssosGuidedToast("🎬 " + T("Starring", "主演") + " " + name +
        (others.length ? " · " + others.map(function (m) { return T(m.role_label_en || m.role, m.role_label_zh || m.role) + " " + m.name; }).join(" · ") : ""), {});
    }
    if (typeof window.cssosOpenAssistantWithPrompt === "function") {
      close();
      window.cssosOpenAssistantWithPrompt(prompt, { actorId: actor.actor_id });
    } else if (typeof window.cssosGuidedToast !== "function") { alert(T("Cast actor: ", "已选定演员: ") + name); }
  }
  // 选角时先选作品类型(叙事类先锁)。
  function openCast(actor) {
    var root = document.getElementById(ROOT_ID); if (!root) { castRun(actor, "single"); return; }
    var name = esc(actor.name_en || actor.name_zh);
    var modal = document.createElement("div"); modal.className = "ag-castmodal";
    // 真人演员才有"声线档": AI 声(即时) / 本人真嗓(需 RVC 声纹, v2 点亮)。合成演员声线本就是 AI, 不显此选择。
    var voiceMarkup = actor.is_real_person
      ? '<div class="ag-voicemode"><div class="ag-rt-label">' + esc(T("Voice", "声线")) + '</div><div class="ag-multi-row">' +
          '<button class="ag-mi on" data-vm="ai">🔊 ' + esc(T("AI voice (instant)", "AI 声线(即时)")) + '</button>' +
          '<button class="ag-mi" data-vm="own" disabled title="' + esc(T("Own-voice clone — coming soon (needs the actor's trained voice print)", "本人真嗓克隆 —— 敬请期待(需该演员已训练声纹)")) + '">🎤 ' + esc(T("Own voice", "本人真嗓")) + ' 🔒</button>' +
        '</div><div style="font-size:11.5px;color:#7fb8a3;margin-top:6px">' + esc(T("Likeness is the actor · voice is AI-generated.", "形象为本人 · 声线为 AI 生成。")) + '</div></div>'
      : "";
    modal.innerHTML = '<div class="box"><h3>🎬 ' + esc(T("Cast ", "选 ")) + name + esc(T(" — pick a format", " —— 选作品类型")) + '</h3>' +
      '<div class="sub">' + esc(T("Music-driven works are ready now. Scripted drama (short play / series / film) auto-writes a screenplay — coming soon.", "音乐类现在就能做。叙事类(短剧/剧集/电影)会自动编剧 —— 敬请期待。")) + '</div>' +
      voiceMarkup +
      '<div class="ag-wt">' + CAST_WORK_TYPES.map(function (w) {
        return '<button data-wt="' + w.key + '"' + (w.ready ? "" : " disabled") + '>' + (w.ready ? "" : "🔒 ") + w.emoji + ' ' + esc(T(w.en, w.zh)) + '<small>' + esc(T(w.descEn, w.descZh)) + '</small></button>';
      }).join("") + '</div></div>';
    modal.addEventListener("click", function (e) {
      if (e.target === modal) { modal.remove(); return; }
      var vm = e.target.closest && e.target.closest("button[data-vm]");
      if (vm) { if (vm.disabled) return; modal.querySelectorAll("button[data-vm]").forEach(function (x) { x.classList.toggle("on", x === vm); }); return; }
      var btn = e.target.closest && e.target.closest("button[data-wt]");
      if (!btn || btn.disabled) return;
      var wt = btn.getAttribute("data-wt");
      var vmSel = modal.querySelector("button[data-vm].on");
      window.__cssosCastVoiceMode = vmSel ? vmSel.getAttribute("data-vm") : "ai";
      modal.remove();
      openCastPanel(actor, wt);
    });
    root.appendChild(modal);
  }

  // ④ P1 选角面板 —— 选完格式后: 主角预填 + 文明智能联动推荐补齐反派/配角 + 手选/换 + 群演开关 → 生成。
  // 群演系统随机(可改手动); 推荐端点未部署时优雅回退到 /api/actors。角色槽走随机色 data-pill-bar。
  var CAST_FORMAT_SLOTS = {
    mv:       [{ role: "protagonist", alignment: "good",    en: "Lead",    zh: "主角",  emoji: "⭐" }, { role: "antagonist", alignment: "evil", en: "Villain", zh: "反派", emoji: "😈" }],
    triptych: [{ role: "protagonist", alignment: "good",    en: "Lead",    zh: "主角",  emoji: "⭐" }, { role: "antagonist", alignment: "evil", en: "Villain", zh: "反派", emoji: "😈" }],
    opera:    [{ role: "protagonist", alignment: "good",    en: "Lead",    zh: "主角",  emoji: "⭐" }, { role: "antagonist", alignment: "evil", en: "Villain", zh: "反派", emoji: "😈" }, { role: "supporting", alignment: "neutral", en: "Support", zh: "配角", emoji: "🎭" }],
  };
  function castFormatKey(wt) { return (wt === "triptych" || wt === "opera") ? wt : "mv"; }

  function openCastPanel(seedActor, workType) {
    var root = document.getElementById(ROOT_ID); if (!root) { castRun(seedActor, workType); return; }
    var fmt = castFormatKey(workType);
    var slots = CAST_FORMAT_SLOTS[fmt] || CAST_FORMAT_SLOTS.mv;
    var picked = {};            // slotIdx → actor(seed 预填)
    picked[0] = seedActor;
    // ① 配角选择: 点进来的 seed 演员可选主角/反派/配角(影响 role/alignment/计费)。
    var CAST_ROLE_OPTS = [{ r: "protagonist", a: "good", en: "Lead", zh: "主角" }, { r: "antagonist", a: "evil", en: "Villain", zh: "反派" }, { r: "supporting", a: "neutral", en: "Support", zh: "配角" }];
    var seedRole = "protagonist", seedAlign = "good";
    var pools = {};             // slotIdx → 候选数组
    var extrasMode = "auto";    // auto=系统随机群演 | manual=从自愿群演池手选
    var extrasPool = [];        // willing_extra=true 的演员(recommend 返回), 手动模式可挑
    var pickedExtras = {};      // actor_id → true(已选群演; role=extra 免费)
    var civ = seedActor.civilization || "";
    // 跨槽去重: 同一演员不能占两个角色槽。
    function usedElsewhere(aid, slotI) { return Object.keys(picked).some(function (k) { return +k !== slotI && picked[k] && picked[k].actor_id === aid; }); }
    function autoFillSlot(i) { if (picked[i]) return; var p = pools[i] || []; picked[i] = p.find(function (c) { return !usedElsewhere(c.actor_id, i); }) || p[0] || null; }

    var modal = document.createElement("div"); modal.className = "ag-castmodal ag-castpanel";
    function slotThumb(a) {
      if (!a) return '<div class="ag-cs-empty">…</div>';
      return (a.cover_image ? '<img src="' + esc(imgProxy(a.cover_image, 120)) + '" alt="">' : '<span class="ag-cs-ini">' + esc(String(a.name_en || "?").charAt(0)) + '</span>');
    }
    function slotCard(slot, i) {
      var a = picked[i];
      var ml = a ? esc(a.mother_tongue || "") : "";
      return '<div class="ag-cs-slot" data-slot="' + i + '">' +
        '<div class="ag-cs-role">' + (i === 0
          ? esc(T("Your pick plays", "你选的出演")) + ' <select class="ag-cs-roled" data-seedrole>' + CAST_ROLE_OPTS.map(function (o) { return '<option value="' + o.r + '"' + (o.r === seedRole ? " selected" : "") + '>' + esc(T(o.en, o.zh)) + '</option>'; }).join("") + '</select>'
          : slot.emoji + ' ' + esc(T(slot.en, slot.zh))) + '</div>' +
        '<div class="ag-cs-pick">' + slotThumb(a) +
          '<div class="ag-cs-info"><div class="ag-cs-name">' + (a ? esc(a.name_en || a.name_zh) : esc(T("Recommending…", "推荐中…"))) + '</div>' +
            '<div class="ag-cs-sub">' + (a ? (esc(a.civilization || "") + (ml ? " · 🌐" + ml : "")) : "") + '</div></div>' +
          (i > 0 ? '<button class="ag-cs-swap" data-swap="' + i + '">🔀 ' + esc(T("Swap", "换")) + '</button>' : '') +
        '</div>' +
        (pools[i] && pools[i].length ? '<div class="ag-cs-pool" data-pool="' + i + '">' + pools[i].slice(0, 8).map(function (c, ci) {
          var dis = usedElsewhere(c.actor_id, i);
          return '<button class="ag-cs-cand' + (a && c.actor_id === a.actor_id ? ' on' : '') + (dis ? ' used' : '') + '"' + (dis ? ' disabled title="' + esc(T("Already cast in another role", "已在别的角色里")) + '"' : '') + ' data-pick="' + i + '" data-ci="' + ci + '">' + slotThumb(c) + '<span>' + esc(c.name_en || c.name_zh) + '</span></button>';
        }).join("") + '</div>' : "") +
        '</div>';
    }
    function render() {
      modal.innerHTML = '<div class="box ag-cs-box"><h3>🎬 ' + esc(T("Casting", "选角")) + ' · ' + esc(T(fmt === "mv" ? "Music video" : fmt, fmt)) + '</h3>' +
        '<div class="sub">' + esc(T("The system suggests a cast by civilization + role. Swap anyone; extras are auto-generated (or set manually).", "系统按文明+戏路联动荐角。任意可换;群演系统随机生成(也可手动)。")) + '</div>' +
        '<div class="ag-cs-slots">' + slots.map(slotCard).join("") + '</div>' +
        '<div class="ag-cs-extras"><span>👥 ' + esc(T("Extras", "群演")) + ' <small>' + esc(T("(free)", "(免费)")) + '</small></span>' +
          '<div class="ag-cs-extrabtns" data-pill-bar>' +
            '<button data-ex="auto" class="' + (extrasMode === "auto" ? "active" : "") + '" data-pill-key="auto">🎲 ' + esc(T("Auto", "系统随机")) + '</button>' +
            '<button data-ex="manual" class="' + (extrasMode === "manual" ? "active" : "") + '" data-pill-key="manual">✋ ' + esc(T("Manual", "手动")) + '</button>' +
          '</div></div>' +
        // 手动模式: 从自愿群演(willing_extra)池挑; 群演免费(role=extra, ×0)。空池 → 系统自动生成兜底。
        (extrasMode === "manual"
          ? '<div class="ag-cs-expool">' + (extrasPool.length
              ? extrasPool.map(function (a) { return '<button class="ag-cs-excand' + (pickedExtras[a.actor_id] ? ' on' : '') + '" data-exar="' + esc(a.actor_id) + '">' + slotThumb(a) + '<span>' + esc(a.name_en || a.name_zh) + '</span></button>'; }).join("")
              : '<i class="ag-cs-exempty">' + esc(T("No willing extras yet — the system will auto-generate background actors.", "暂无自愿群演 —— 系统将自动生成背景演员。")) + '</i>') + '</div>'
          : "") +
        '<div class="ag-cs-cost">' + (function () { var t = 0; slots.forEach(function (s, i) { var a = picked[i]; if (a && a.is_premium) { var role = i === 0 ? seedRole : s.role, al = i === 0 ? seedAlign : s.alignment; var m = (al === "evil" || role === "antagonist") ? 1.3 : (role === "supporting" ? 0.5 : 1); t += Math.round((a.cast_price_cents || 0) * m); } }); return t > 0 ? "💎 " + esc(T("Cast total", "选角合计")) + " " + cents(t) + " · " + esc(T("from your wallet", "从钱包扣")) : "✅ " + esc(T("Free cast", "免费阵容")); })() + '</div>' +
        '<button class="ag-cast ag-cs-go">🎬 ' + esc(T("Cast & generate", "定角并生成")) + '</button>' +
        '</div>';
    }
    render();
    root.appendChild(modal);

    // ① seed 角色下拉切换。
    modal.addEventListener("change", function (e) {
      var s = e.target.closest && e.target.closest("[data-seedrole]");
      if (s) { seedRole = s.value; var o = CAST_ROLE_OPTS.find(function (x) { return x.r === seedRole; }); seedAlign = o ? o.a : "neutral"; }
    });

    // 拉推荐补齐非主角槽(优雅回退)。
    (function loadRecs() {
      var need = slots.map(function (s, i) { return { i: i, role: s.role, alignment: s.alignment }; }).filter(function (x) { return x.i > 0; });
      if (!need.length) return;
      fetch("/api/cast/recommend", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: fmt, civilization: civ, needed: need.map(function (n) { return { role: n.role, alignment: n.alignment }; }) }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (j && j.ok && Array.isArray(j.results)) {
            j.results.forEach(function (res, k) { pools[need[k].i] = res.candidates || []; });
            if (Array.isArray(j.extras)) extrasPool = j.extras;   // 自愿群演池
            need.forEach(function (n) { autoFillSlot(n.i); });   // 顺序填, 去重
          } else { throw new Error("fallback"); }
          render();
        })
        .catch(function () {
          // 回退: 用已加载演员池(排除主角)按顺序填。
          var fb = (state.actors || []).filter(function (a) { return a.actor_id !== seedActor.actor_id; });
          need.forEach(function (n, k) { pools[n.i] = fb.slice(k * 8, k * 8 + 8); });
          need.forEach(function (n) { autoFillSlot(n.i); });   // 顺序填, 去重
          render();
        });
    })();

    modal.addEventListener("click", function (e) {
      if (e.target === modal) { modal.remove(); return; }
      var ex = e.target.closest && e.target.closest("button[data-ex]");
      if (ex) { extrasMode = ex.getAttribute("data-ex"); render(); return; }
      var exar = e.target.closest && e.target.closest("button[data-exar]");
      if (exar) { var xid = exar.getAttribute("data-exar"); if (pickedExtras[xid]) delete pickedExtras[xid]; else pickedExtras[xid] = true; render(); return; }
      var cand = e.target.closest && e.target.closest("button[data-pick]");
      if (cand) { var pi = +cand.getAttribute("data-pick"), ci = +cand.getAttribute("data-ci"); if (pools[pi] && pools[pi][ci]) { picked[pi] = pools[pi][ci]; render(); } return; }
      var sw = e.target.closest && e.target.closest("button[data-swap]");
      if (sw) { var si = +sw.getAttribute("data-swap"); var p = pools[si] || []; if (p.length) { var cur = picked[si]; var idx = cur ? p.findIndex(function (c) { return c.actor_id === cur.actor_id; }) : -1; for (var t = 1; t <= p.length; t++) { var nx = p[(idx + t) % p.length]; if (nx && !usedElsewhere(nx.actor_id, si)) { picked[si] = nx; break; } } render(); } return; }
      var go = e.target.closest && e.target.closest(".ag-cs-go");
      if (go) {
        // 组装 cast → 记 window.__cssosCast(供 P2 后端整体接收)+ 主角走现有生成流。
        var cast = slots.map(function (s, i) { var a = picked[i]; if (!a) return null; return { actor_id: a.actor_id, role: i === 0 ? seedRole : s.role, alignment: i === 0 ? seedAlign : s.alignment, billing_order: i, name: (a.name_en || a.name_zh), role_label_en: s.en, role_label_zh: s.zh }; }).filter(Boolean);
        // 手选群演(role=extra, 免费)接到 cast 末尾; 跨槽去重(已当主/配角者不重复计为群演)。
        var takenIds = cast.map(function (m) { return m.actor_id; });
        var extraCast = extrasPool.filter(function (a) { return pickedExtras[a.actor_id] && takenIds.indexOf(a.actor_id) < 0; })
          .map(function (a, k) { return { actor_id: a.actor_id, role: "extra", alignment: "neutral", billing_order: cast.length + k, name: (a.name_en || a.name_zh), role_label_en: "Extra", role_label_zh: "群演" }; });
        cast = cast.concat(extraCast);
        window.__cssosCast = { format: fmt, extras_mode: extrasMode, cast: cast };
        window.__cssosCastRole = seedRole; window.__cssosCastAlign = seedAlign;   // ③ seed 角色 → 后端分层计费
        modal.remove();
        castRun(seedActor, workType);   // seed 领衔进现有 MV 管线; 完整 cast 已备好待 P2 接收
      }
    });
  }

  // ⑤ 傻瓜式【导演入口】(数字演员初心): 选戏路 → 系统文明智能联动自动组好全阵容(+标题留空自动) →
  //   30s 倒计时不干预即自动【开拍】(可暂停/改任意项/立即开拍)→ 直接 startCreation 进 MV 面板边出边播。
  //   导演最少只需两步(选戏路 + 开拍), 或倒计时内零干预 ≈ 一键。全字符串走 T() i18N。
  // 开拍倒计时: 默认 60s, 可自定义(存 localStorage, 5–600s)。零干预到点自动开拍。
  function dgCdDefault() { var v = parseInt(localStorage.getItem("cssos.dg.countdown"), 10); return (v && v >= 5 && v <= 600) ? v : 60; }
  function dgCdSet(v) { v = Math.max(5, Math.min(600, parseInt(v, 10) || 60)); try { localStorage.setItem("cssos.dg.countdown", String(v)); } catch (_e) {} return v; }
  // 文明干预项(空=系统联动全自动; 值=库里原生 civilization 字符串, 供 recommend 精确匹配)。
  // 每项带图标(胶囊宪法 W497: 每个胶囊必须有图标锚点)。v="" = 系统联动。
  var DG_CIVS = [
    { en: "System", zh: "系统联动", v: "", ic: "🌐" }, { en: "Chinese", zh: "中华", v: "中华文明", ic: "🐉" },
    { en: "Japanese", zh: "日本", v: "日本古典", ic: "⛩️" }, { en: "Greek", zh: "希腊", v: "古希腊文明", ic: "🏛️" },
    { en: "Egyptian", zh: "埃及", v: "古埃及文明", ic: "🔺" }, { en: "Persian", zh: "波斯", v: "波斯文明", ic: "🦁" },
    { en: "Norse", zh: "北欧", v: "北欧神话", ic: "⚔️" }, { en: "Indian", zh: "印度", v: "印度教神话", ic: "🕉️" },
    { en: "Roman", zh: "罗马", v: "古罗马文明", ic: "🦅" }, { en: "Mesopotamian", zh: "美索", v: "美索不达米亚神话", ic: "🏺" },
  ];
  // 导演入口 seed 演员可出演的角色(影响 role/alignment/分层计费)。
  var DG_ROLE_OPTS = [{ r: "protagonist", a: "good", en: "Lead", zh: "主角" }, { r: "antagonist", a: "evil", en: "Villain", zh: "反派" }, { r: "supporting", a: "neutral", en: "Support", zh: "配角" }];
  // 文明智能联动: 从标题(用户输入或系统推荐)推断文明 → 联动选角/风格/歌词语言。
  // 命中即回库里原生 civilization 字符串(供 recommend 精确匹配 + 后端 civToLanguageServer)。
  var DG_CIV_KEYWORDS = [
    { v: "日本古典", re: /japan|japanese|samurai|nippon|tokyo|kyoto|shogun|geisha|ninja|日本|武士|忍者|和风|浮世|樱花|京都|江户/i },
    { v: "中华文明", re: /china|chinese|tang|song dynasty|confucius|beijing|中华|中国|大唐|盛唐|汉|宋|孔子|长安|江湖|武侠|仙侠|古风/i },
    { v: "古希腊文明", re: /greek|greece|athena|zeus|olymp|sparta|troy|hellen|希腊|雅典|斯巴达|奥林匹斯|特洛伊/i },
    { v: "古埃及文明", re: /egypt|egyptian|pharaoh|nile|pyramid|cleopatra|埃及|法老|尼罗|金字塔|艳后/i },
    { v: "波斯文明", re: /persia|persian|iran|zoroaster|shahnameh|波斯|伊朗|萨珊/i },
    { v: "北欧神话", re: /norse|viking|odin|thor|valhalla|nordic|北欧|维京|奥丁|诸神黄昏/i },
    { v: "印度教神话", re: /india|indian|hindu|vedic|krishna|mahabharata|印度|吠陀|梵/i },
    { v: "古罗马文明", re: /roman|rome|caesar|gladiator|latin|colosseum|罗马|凯撒|角斗|拉丁/i },
    { v: "美索不达米亚神话", re: /mesopotam|babylon|sumer|assyria|gilgamesh|ishtar|美索|巴比伦|苏美尔|亚述/i },
  ];
  function dgInferCiv(text) {
    var s = String(text || ""); if (!s.trim()) return "";
    for (var i = 0; i < DG_CIV_KEYWORDS.length; i++) { if (DG_CIV_KEYWORDS[i].re.test(s)) return DG_CIV_KEYWORDS[i].v; }
    return "";
  }
  // 可搜索选角器: 从全量已加载演员(state.actors, /api/actors?limit=500)按 名字/文明 即时搜索,
  //   点选即回调替换该角色(旧的取消)。替代"点一下随机换一个"的盲切。opts: {title, excludeIds, onPick}。
  function openActorPicker(opts) {
    opts = opts || {};
    var root = document.getElementById(ROOT_ID) || document.body;
    var q = "", exclude = opts.excludeIds || {};
    var modal = document.createElement("div"); modal.className = "ag-castmodal ag-actorpicker";
    function pickThumb(a) { return a.cover_image ? '<img src="' + esc(imgProxy(a.cover_image, 80)) + '" alt="' + esc(String(a.name_en || a.name_zh || "?").charAt(0)) + '" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'ag-cs-ini\',textContent:(this.alt||\'?\')}))">' : '<span class="ag-cs-ini">' + esc(String(a.name_en || a.name_zh || "?").charAt(0)) + '</span>'; }
    function results() {
      var all = (state.actors || []).filter(function (a) { return a && a.actor_id && !exclude[a.actor_id]; });
      var ql = q.trim().toLowerCase();
      if (ql) all = all.filter(function (a) { return ((a.name_en || "") + " " + (a.name_zh || "") + " " + (a.civilization || "")).toLowerCase().indexOf(ql) >= 0; });
      return all.slice(0, 60);
    }
    function gridHtml() {
      var list = results();
      return list.length
        ? list.map(function (a) { return '<button class="ag-ap-cand" data-pickid="' + esc(a.actor_id) + '">' + pickThumb(a) + '<span>' + esc(a.name_en || a.name_zh) + '</span></button>'; }).join("")
        : '<div class="ag-empty">' + esc(T("No matching actors.", "没有匹配的演员。")) + '</div>';
    }
    modal.innerHTML = '<div class="box ag-ap-box"><h3>🔍 ' + esc(opts.title || T("Pick an actor", "选一位演员")) + '</h3>' +
      '<input class="ag-in ag-ap-search" placeholder="' + esc(T("Search by name or civilization…", "按名字或文明搜索…")) + '">' +
      '<div class="ag-ap-grid">' + gridHtml() + '</div></div>';
    root.appendChild(modal);
    var s = modal.querySelector(".ag-ap-search"); if (s) setTimeout(function () { try { s.focus(); } catch (_e) {} }, 30);
    // 只刷新结果网格, 保住搜索框焦点。
    modal.addEventListener("input", function (e) {
      if (e.target.closest && e.target.closest(".ag-ap-search")) { q = e.target.value; var g = modal.querySelector(".ag-ap-grid"); if (g) g.innerHTML = gridHtml(); }
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) { modal.remove(); return; }
      var c = e.target.closest && e.target.closest("[data-pickid]");
      if (c) { var id = c.getAttribute("data-pickid"); var a = (state.actors || []).find(function (x) { return x.actor_id === id; }); modal.remove(); if (a && opts.onPick) opts.onPick(a); }
    });
  }

  function openDirectorGate(seedActor) {
    // 从闸/Dock 打开时图鉴可能没开 → 先开(否则 #ROOT_ID 作用域样式失效)。
    var root = document.getElementById(ROOT_ID);
    if (!root && typeof open === "function") { try { open(1); } catch (_o) {} }
    root = document.getElementById(ROOT_ID) || document.body;
    var fmt = "mv", title = "", civ = "", style = "", synopsis = "", civManual = false;
    var seedRole = "protagonist", seedAlign = "good";           // seed 演员出演角色(可改, 影响分层计费)
    var extrasMode = "auto", extrasPool = [], pickedExtras = {}; // 群演: 系统随机 / 手选自愿群演池
    var slots = CAST_FORMAT_SLOTS[fmt] || CAST_FORMAT_SLOTS.mv;
    var picked = seedActor ? { 0: seedActor } : {}, pools = {}, cdLeft = dgCdDefault(), cdTimer = null, started = false;
    var modal = document.createElement("div"); modal.className = "ag-castmodal ag-director";
    function stopCd() { if (cdTimer) { clearInterval(cdTimer); cdTimer = null; var p = modal.querySelector(".ag-dg-pause"); if (p) p.textContent = "▶"; } }
    function startCd() { stopCd(); var p = modal.querySelector(".ag-dg-pause"); if (p) p.textContent = "⏸"; cdTimer = setInterval(function () { cdLeft -= 1; if (cdLeft <= 0) { action(); return; } var b = modal.querySelector(".ag-dg-cd b"); if (b) b.textContent = cdLeft + "s"; }, 1000); }
    function fmtPills() {
      // 全部戏路都显示: 可用(单曲/三部曲/歌剧)可选; 短剧/系列/电影为【不可用】锁态占位(敬请期待)。
      return CAST_WORK_TYPES.map(function (w) {
        var on = w.ready && (w.key === fmt || (fmt === "mv" && w.key === "single"));
        var lock = w.ready ? "" : " locked";
        return '<button class="ag-dg-fmt' + (on ? " on" : "") + lock + '" data-fmt="' + w.key + '"' + (w.ready ? "" : ' disabled title="' + esc(T("Auto-scripted · coming soon", "自动编剧 · 敬请期待")) + '"') + '>' + (w.ready ? "" : "🔒 ") + w.emoji + ' ' + esc(T(w.en, w.zh)) + '</button>';
      }).join("");
    }
    // 导演入口 Lead 区 = 完整选角块(图6): 每角色槽 = 头像 + 名字/文明/母语 + 换(可搜索) + 候选行;
    //   seed(从卡片点入)=主角槽带"出演角色"下拉; 末尾 = 群演 系统随机/手选(自愿群演池, 免费)。
    function slotThumb(a) {
      if (!a) return '<div class="ag-cs-empty">…</div>';
      return a.cover_image
        ? '<img src="' + esc(imgProxy(a.cover_image, 120)) + '" alt="' + esc(String(a.name_en || a.name_zh || "?").charAt(0)) + '" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'ag-cs-ini\',textContent:(this.alt||\'?\')}))">'
        : '<span class="ag-cs-ini">' + esc(String(a.name_en || a.name_zh || "?").charAt(0)) + '</span>';
    }
    function dgSlotCard(slot, i) {
      var a = picked[i];
      var ml = a ? esc(a.mother_tongue || "") : "";
      var isSeed = !!(seedActor && i === 0);
      return '<div class="ag-cs-slot" data-slot="' + i + '">' +
        '<div class="ag-cs-role">' + (isSeed
          ? esc(T("Your pick plays", "你选的出演")) + ' <select class="ag-cs-roled" data-seedrole>' + DG_ROLE_OPTS.map(function (o) { return '<option value="' + o.r + '"' + (o.r === seedRole ? " selected" : "") + '>' + esc(T(o.en, o.zh)) + '</option>'; }).join("") + '</select>'
          : slot.emoji + ' ' + esc(T(slot.en, slot.zh))) + '</div>' +
        '<div class="ag-cs-pick">' + slotThumb(a) +
          '<div class="ag-cs-info"><div class="ag-cs-name">' + (a ? esc(a.name_en || a.name_zh) : esc(T("Recommending…", "推荐中…"))) + '</div>' +
            '<div class="ag-cs-sub">' + (a ? (esc(a.civilization || "") + (ml ? " · 🌐" + ml : "")) : "") + '</div></div>' +
          '<button class="ag-cs-swap" data-dgswap="' + i + '">🔀 ' + esc(T("Swap", "换")) + '</button>' +
        '</div>' +
        (!isSeed && pools[i] && pools[i].length ? '<div class="ag-cs-pool" data-pool="' + i + '">' + pools[i].slice(0, 8).map(function (c, ci) {
          var used = Object.keys(picked).some(function (k) { return +k !== i && picked[k] && picked[k].actor_id === c.actor_id; });
          return '<button class="ag-cs-cand' + (a && c.actor_id === a.actor_id ? ' on' : '') + (used ? ' used' : '') + '"' + (used ? ' disabled title="' + esc(T("Already cast in another role", "已在别的角色里")) + '"' : '') + ' data-dgpick="' + i + '" data-ci="' + ci + '">' + slotThumb(c) + '<span>' + esc(c.name_en || c.name_zh) + '</span></button>';
        }).join("") + '</div>' : "") +
        '</div>';
    }
    function castBlock() {
      return slots.map(dgSlotCard).join("") +
        '<div class="ag-cs-extras"><span>👥 ' + esc(T("Extras", "群演")) + ' <small>' + esc(T("(free)", "(免费)")) + '</small></span>' +
          '<div class="ag-cs-extrabtns" data-pill-bar>' +
            '<button data-ex="auto" class="' + (extrasMode === "auto" ? "active" : "") + '" data-pill-key="auto">🎲 ' + esc(T("Auto", "系统随机")) + '</button>' +
            '<button data-ex="manual" class="' + (extrasMode === "manual" ? "active" : "") + '" data-pill-key="manual">✋ ' + esc(T("Manual", "手动")) + '</button>' +
          '</div></div>' +
        (extrasMode === "manual"
          ? '<div class="ag-cs-expool">' + (extrasPool.length
              ? extrasPool.map(function (a) { return '<button class="ag-cs-excand' + (pickedExtras[a.actor_id] ? ' on' : '') + '" data-dgexar="' + esc(a.actor_id) + '">' + slotThumb(a) + '<span>' + esc(a.name_en || a.name_zh) + '</span></button>'; }).join("")
              : '<i class="ag-cs-exempty">' + esc(T("No willing extras yet — the system will auto-generate background actors.", "暂无自愿群演 —— 系统将自动生成背景演员。")) + '</i>') + '</div>'
          : "");
    }
    function render() {
      modal.innerHTML = '<div class="box ag-dg-box"><h3>🎬 ' + esc(T("Direct a work", "开拍")) + '</h3>' +
        '<div class="sub">' + esc(T("Pick a format — the system casts the actors and writes the rest. Change anything, or just let it roll.", "选个戏路 —— 系统自动选角、补齐其余(文明·风格·歌词)。可改任意项, 或直接让它开拍。")) + '</div>' +
        '<div class="ag-dg-fmts" data-pill-bar>' + fmtPills() + '</div>' +
        '<div class="ag-dg-label">🌍 ' + esc(T("Civilization (blank = system)", "文明(默认系统联动)")) + '</div>' +
        // 文明套上胶囊(v28 data-pill-bar): 选中=active(满凸), 其余凹向选中; 每胶囊带图标(W497)。
        '<div class="ag-dg-civs" data-pill-bar>' + DG_CIVS.map(function (c) { return '<button class="ag-dg-civ' + (c.v === civ ? " active" : "") + '" data-pill-key="' + (c.v || "system") + '" data-dgciv="' + esc(c.v) + '"><span>' + c.ic + ' ' + esc(T(c.en, c.zh)) + '</span></button>'; }).join("") + '</div>' +
        '<div class="ag-dg-titlerow"><input class="ag-in ag-dg-title" placeholder="' + esc(T("Title — blank = system names it", "标题 —— 留空则系统智能命名")) + '" value="' + esc(title) + '">' +
          '<button class="ag-dg-syndraft" type="button" title="' + esc(T("Draft a story synopsis from the title + civilization", "按标题+文明智能起草故事梗概")) + '">✨ ' + esc(T("Draft", "联动")) + '</button></div>' +
        '<textarea class="ag-in ag-dg-synopsis" maxlength="2000" rows="3" placeholder="' + esc(T("Story synopsis (≤2000 chars) — blank = system writes it", "故事梗概(≤2000 字)—— 留空则系统智能生成")) + '">' + esc(synopsis) + '</textarea>' +
        '<input class="ag-in ag-dg-style" placeholder="' + esc(T("Style / vibe — blank = auto", "风格 / 氛围 —— 留空自动")) + '" value="' + esc(style) + '">' +
        '<div class="ag-dg-label">🎭 ' + esc(T("Cast (system-recommended, swap freely)", "阵容(系统荐, 可换)")) + '</div>' +
        '<div class="ag-dg-cast ag-cs-slots">' + castBlock() + '</div>' +
        '<div class="ag-dg-row"><button class="ag-cast ag-dg-go">🎬 ' + esc(T("Action!", "开拍!")) + '</button>' +
          '<span class="ag-dg-cd">' + (cdTimer ? esc(T("auto in", "自动开拍")) + ' <b>' + cdLeft + 's</b>' : esc(T("paused · your call", "已停 · 你定"))) + ' <button class="ag-dg-pause">' + (cdTimer ? "⏸" : "▶") + '</button>' +
            ' <label class="ag-dg-cdset-w" title="' + esc(T("Auto-Action countdown seconds", "开拍倒计时秒数")) + '">⏱<input class="ag-dg-cdset" type="number" min="5" max="600" step="5" value="' + dgCdDefault() + '">s</label></span></div></div>';
    }
    function autoPick() {
      slots.forEach(function (s, i) {
        if (i === 0 && seedActor && picked[0]) return;   // seed 锁定主角槽, 不自动替换
        var used = Object.keys(picked).filter(function (k) { return +k !== i; }).map(function (k) { return picked[k] && picked[k].actor_id; });
        picked[i] = (pools[i] || []).find(function (c) { return used.indexOf(c.actor_id) < 0; }) || (pools[i] || [])[0] || null;
      });
      render();
    }
    function loadCast() {
      picked = seedActor ? { 0: seedActor } : {}; pools = {}; render();
      // 显式 needed = 前端槽位(seed 占的主角槽不荐), 让后端每槽候选与前端槽一一对应(opera 3 槽等)。
      var need = slots.map(function (s, i) { return { i: i, role: s.role, alignment: s.alignment }; })
        .filter(function (x) { return !(seedActor && x.i === 0); });
      fetch("/api/cast/recommend", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: fmt, civilization: civ, needed: need.map(function (n) { return { role: n.role, alignment: n.alignment }; }) }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (j && j.ok && Array.isArray(j.results)) {
            j.results.forEach(function (res, k) { if (need[k]) pools[need[k].i] = res.candidates || []; });
            if (Array.isArray(j.extras)) extrasPool = j.extras;
            autoPick();
          } else { throw new Error("fb"); }
        })
        .catch(function () { var fb = (state.actors || []).filter(function (a) { return !seedActor || a.actor_id !== seedActor.actor_id; }); need.forEach(function (n, k) { pools[n.i] = fb.slice(k * 8, k * 8 + 8); }); autoPick(); });
    }
    function action() {
      if (started) return; var proto = picked[0]; if (!proto) return; started = true; stopCd();
      if (!civManual && !civ) { var _g = dgInferCiv(title + " " + synopsis); if (_g) civ = _g; }   // 兜底: 开拍前按标题/梗概联动文明
      var cast = slots.map(function (s, i) { var a = picked[i]; return a ? { actor_id: a.actor_id, role: i === 0 ? seedRole : s.role, alignment: i === 0 ? seedAlign : s.alignment, billing_order: i, name: (a.name_en || a.name_zh), role_label_en: s.en, role_label_zh: s.zh } : null; }).filter(Boolean);
      // 手选群演(role=extra, 免费 ×0)接到 cast 末尾, 跨槽去重。
      var takenIds = cast.map(function (m) { return m.actor_id; });
      var extraCast = extrasPool.filter(function (a) { return pickedExtras[a.actor_id] && takenIds.indexOf(a.actor_id) < 0; })
        .map(function (a, k) { return { actor_id: a.actor_id, role: "extra", alignment: "neutral", billing_order: cast.length + k, name: (a.name_en || a.name_zh), role_label_en: "Extra", role_label_zh: "群演" }; });
      cast = cast.concat(extraCast);
      window.__cssosCast = { format: fmt, extras_mode: extrasMode, cast: cast };
      window.__cssosCastActorId = proto.actor_id; window.__cssosCastActorName = proto.name_en || proto.name_zh;
      window.__cssosCastRole = seedRole; window.__cssosCastAlign = seedAlign;
      // W1537 — 故事梗概驱动剧情 + 文明/风格联动: 存全局, 由选角拦截器注入 /api/mv/* + /api/works。
      window.__cssosDirectorSynopsis = synopsis.trim() || null;
      window.__cssosDirectorCiv = civ || null;
      window.__cssosDirectorStyle = style.trim() || null;
      var others = cast.filter(function (m) { return m.actor_id !== proto.actor_id; });
      var tv = title.trim();

      /* CSSOS_WAVE_1787 20260727 — 钱包刹车。Jing:「不要让用户一点击,也不验证平台钱包,
       * 也不要求再次确认,是不行的。特别是对长片电影,必须比估算多 20% 缓冲。
       * 读不到余额 = 拦住,让用户重试。全系列,从单曲到电影。」
       * 这是导演面板唯一的开火点 —— 闸装在这里,任何格式都绕不过去。 */
      castGate(fmt, proto, function () {
        modal.remove(); try { close(); } catch (_e) {}
        if (typeof window.cssosGuidedToast === "function") window.cssosGuidedToast("🎬 " + T("Action!", "开拍!") + " " + T("Starring", "主演") + " " + (proto.name_en || proto.name_zh) + (others.length ? " · " + others.map(function (m) { return T(m.role_label_en || m.role, m.role_label_zh || m.role) + " " + m.name; }).join(" · ") : ""), {});
        if (typeof startCreation === "function") startCreation(tv, "", { source: "director", workType: fmt, style: (style.trim() || undefined), civilization: (civ || undefined), synopsis: (synopsis.trim() || undefined) });
        else castRun(proto, fmt === "mv" ? "single" : fmt);
      });
      return;
    }

    /* ---- W1787 钱包刹车 ---- 与 AI 助理里的 confirmHeavySurprise 同一套口径:
     *   估算 = 份数 × CAST_CENTS_PER_WORK
     *   门槛 = 估算 × 1.2(20% 缓冲, 引擎按实付结账, 长片最容易超)
     *   读不到余额 → 只给「重试」, 绝不放行
     * onOk 只在用户明确确认且余额足够时才被调用。 */
    async function castGate(fmtKey, proto, onOk) {
      var key = (fmtKey === "mv") ? "single" : fmtKey;
      var spec = CAST_WORK_TYPES.filter(function (w) { return w.key === key; })[0] || {};
      var works = Number(spec.works || 1);
      var cost = works * CAST_CENTS_PER_WORK;
      var need = Math.ceil(cost * 1.2);
      var bal = await castFetchBalance();
      var unknown = (bal == null);
      var enough = !unknown && (bal >= need);
      var money = function (c) { return "$" + (Math.max(0, c) / 100).toFixed(2); };

      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;z-index:10097;display:flex;align-items:center;justify-content:center;background:rgba(2,10,7,.74);backdrop-filter:blur(3px);";
      var rows = [];
      rows.push('<div style="font:700 16px/1.3 inherit;margin-bottom:10px;">' + (spec.emoji || "🎬") + "  " + esc(T("Confirm before generating", "生成前请确认")) + "</div>");
      rows.push('<div style="font:500 13px/1.6 inherit;color:#bfe9d8;margin-bottom:12px;">' +
        esc(T("This starts a paid generation. It costs real money and cannot be undone.",
              "这会启动一次付费生成。它花的是真钱，且无法撤销。")) + "</div>");
      rows.push('<div style="display:flex;flex-direction:column;gap:7px;font:600 13px/1 inherit;background:rgba(0,245,160,.07);border:1px solid rgba(0,245,160,.2);border-radius:12px;padding:12px 14px;margin-bottom:14px;">');
      rows.push('<div style="display:flex;justify-content:space-between;"><span>' + esc(T("Format", "格式")) + '</span><span>' + esc(T(spec.en || key, spec.zh || key)) + '</span></div>');
      rows.push('<div style="display:flex;justify-content:space-between;"><span>' + esc(T("Works", "份数")) + '</span><span>' + works + '</span></div>');
      rows.push('<div style="display:flex;justify-content:space-between;"><span>' + esc(T("Estimated cost", "预估花费")) + '</span><span style="color:#00f5a0;">' + money(cost) + '</span></div>');
      rows.push('<div style="display:flex;justify-content:space-between;"><span>' + esc(T("Wallet must hold (+20% buffer)", "钱包需备（含 20% 缓冲）")) + '</span><span style="color:#ffcf6a;">' + money(need) + '</span></div>');
      rows.push('<div style="display:flex;justify-content:space-between;"><span>' + esc(T("Your wallet", "钱包余额")) + '</span><span style="color:' + (enough ? "#eafff6" : "#ff8a8a") + ';">' + (unknown ? esc(T("could not read", "读取失败")) : money(bal)) + '</span></div>');
      rows.push("</div>");
      if (unknown) {
        rows.push('<div style="font:600 12.5px/1.5 inherit;color:#ff8a8a;margin-bottom:12px;">' +
          esc(T("We could not read your wallet balance, so we will not start a paid job. Please retry.",
                "我们暂时读不到你的钱包余额，因此不会启动付费生成。请重试。")) + "</div>");
      } else if (!enough) {
        rows.push('<div style="font:600 12.5px/1.5 inherit;color:#ff8a8a;margin-bottom:12px;">' +
          esc(T("Not enough balance — top up first.", "余额不足 —— 请先充值。")) + "</div>");
      }
      if (spec.heavy) {
        rows.push('<div style="font:700 12.5px/1.5 inherit;color:#ffcf6a;margin-bottom:12px;">⚠️ ' +
          esc(T("This is a long-form job — many works, long runtime, high cost.",
                "这是长片体量的生成 —— 份数多、耗时长、开销高。")) + "</div>");
      }
      rows.push('<div style="display:flex;gap:8px;justify-content:flex-end;">');
      rows.push('<button type="button" data-g="cancel" style="background:transparent;border:1px solid rgba(255,255,255,.22);color:#cfeee0;font:600 13px/1 inherit;padding:10px 16px;border-radius:999px;cursor:pointer;">' + esc(T("Cancel", "取消")) + "</button>");
      if (unknown) rows.push('<button type="button" data-g="retry" style="background:linear-gradient(135deg,#00f5a0,#00b87a);color:#0a0d12;border:0;font:700 13px/1 inherit;padding:10px 18px;border-radius:999px;cursor:pointer;">' + esc(T("Retry", "重试")) + "</button>");
      else if (!enough) rows.push('<button type="button" data-g="topup" style="background:linear-gradient(135deg,#00f5a0,#00b87a);color:#0a0d12;border:0;font:700 13px/1 inherit;padding:10px 18px;border-radius:999px;cursor:pointer;">' + esc(T("Top up", "去充值")) + "</button>");
      else rows.push('<button type="button" data-g="go" style="background:linear-gradient(135deg,#00f5a0,#00b87a);color:#0a0d12;border:0;font:700 13px/1 inherit;padding:10px 18px;border-radius:999px;cursor:pointer;">' + esc(T("Generate", "确认生成")) + "</button>");
      rows.push("</div>");

      var box = document.createElement("div");
      box.style.cssText = "width:min(440px,calc(100vw - 32px));background:linear-gradient(148deg,#07130e,#0d1a14 60%,#020806);border:1px solid rgba(0,245,160,.32);border-radius:18px;padding:20px 22px;color:#eafff6;box-shadow:0 20px 60px rgba(2,10,7,.75);";
      box.innerHTML = rows.join("");
      box.addEventListener("click", function (e) {
        var b = e.target && e.target.closest ? e.target.closest("[data-g]") : null;
        if (!b) return;
        var a = b.getAttribute("data-g");
        ov.remove();
        if (a === "go") { try { onOk(); } catch (_e) {} }
        else if (a === "retry") castGate(fmtKey, proto, onOk);       // 重新读余额, 不放行
        else if (a === "topup") {
          try {
            if (typeof window.cssosOpenCreditsTopup === "function") window.cssosOpenCreditsTopup();
            else if (typeof window.openCreditsTopupModal === "function") window.openCreditsTopupModal();
          } catch (_e) {}
        }
      });
      ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });  // 点遮罩 = 不花钱
      ov.appendChild(box);
      document.body.appendChild(ov);
    }

    async function castFetchBalance() {
      try {
        var r = await fetch("/api/credits/balance", { credentials: "include" });
        if (!r.ok) return null;
        var j = await r.json();
        var b = (j && (j.balance != null ? j.balance : (j.data && j.data.balance)));
        return (typeof b === "number") ? b : null;
      } catch (_e) { return null; }
    }

    modal.addEventListener("click", function (e) {
      if (e.target === modal) { stopCd(); modal.remove(); return; }
      var f = e.target.closest && e.target.closest("[data-fmt]");
      if (f) { if (f.disabled || f.classList.contains("locked")) return; var k = f.getAttribute("data-fmt"); fmt = (k === "single") ? "mv" : k; slots = CAST_FORMAT_SLOTS[fmt] || CAST_FORMAT_SLOTS.mv; cdLeft = dgCdDefault(); loadCast(); startCd(); return; }
      var cv = e.target.closest && e.target.closest("[data-dgciv]");
      if (cv) { civ = cv.getAttribute("data-dgciv"); civManual = (civ !== ""); stopCd(); loadCast(); return; }   // 干预文明 → 停倒计时 + 按文明重荐角; 选「系统联动」= 交回系统(可由标题联动)
      if (e.target.closest && e.target.closest(".ag-dg-go")) { action(); return; }
      if (e.target.closest && e.target.closest(".ag-dg-pause")) { if (cdTimer) stopCd(); else startCd(); return; }
      var draft = e.target.closest && e.target.closest(".ag-dg-syndraft");
      if (draft) {   // ✨ 联动: 按标题+文明起草梗概填入(用户干预 → 停倒计时; 可改可清空)
        stopCd();
        if (draft.disabled) return;
        var tEl = modal.querySelector(".ag-dg-title"); if (tEl) title = tEl.value;
        var cEff = civ || (!civManual ? dgInferCiv(title) : "");
        draft.disabled = true; draft.innerHTML = "⏳ " + esc(T("Drafting…", "起草中…"));
        var loc = (typeof window.cssosLocale === "string" && window.cssosLocale) || (document.documentElement.lang || "en");
        fetch("/api/director/synopsis", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title, civilization: cEff, format: fmt, locale: loc }) })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            if (j && j.ok && (j.title || j.synopsis)) {
              // 系统算法推荐: 标题 + 梗概一起填入(标题原为空也能推荐)。可再改可清空。
              if (j.title) title = j.title;
              if (j.synopsis) synopsis = j.synopsis;
              var civChanged = false;
              if (!civManual && j.title) { var g = dgInferCiv((j.title || "") + " " + (j.synopsis || "")); if (g && g !== civ) { civ = g; civChanged = true; } }
              if (civChanged) loadCast(); else render();   // 重渲反映新标题/梗概(+文明变了则重荐角)
            } else {
              draft.disabled = false; draft.innerHTML = "✨ " + esc(T("Draft", "联动"));
              if (typeof window.cssosGuidedToast === "function") window.cssosGuidedToast(T("Couldn't draft — try again or write your own.", "起草失败,请重试或自己写。"), {});
            }
          })
          .catch(function () { draft.disabled = false; draft.innerHTML = "✨ " + esc(T("Draft", "联动")); });
        return;
      }
      var sw = e.target.closest && e.target.closest("[data-dgswap]");
      if (sw) {   // 换角 → 打开可搜索选角器, 精确挑到想要的演员(替换旧的), 而非盲目随机切换。
        stopCd();
        var si = +sw.getAttribute("data-dgswap");
        var excl = {}; Object.keys(picked).forEach(function (k) { if (+k !== si && picked[k]) excl[picked[k].actor_id] = true; });
        openActorPicker({
          title: (slots[si] ? T(slots[si].en, slots[si].zh) + " · " : "") + T("pick an actor", "选演员"),
          excludeIds: excl,
          onPick: function (a) { picked[si] = a; render(); },
        });
        return;
      }
      var pk = e.target.closest && e.target.closest("[data-dgpick]");
      if (pk) { stopCd(); var pi = +pk.getAttribute("data-dgpick"), ci = +pk.getAttribute("data-ci"); if (pools[pi] && pools[pi][ci]) { picked[pi] = pools[pi][ci]; render(); } return; }
      var ex = e.target.closest && e.target.closest("button[data-ex]");
      if (ex) { stopCd(); extrasMode = ex.getAttribute("data-ex"); render(); return; }
      var exar = e.target.closest && e.target.closest("button[data-dgexar]");
      if (exar) { stopCd(); var xid = exar.getAttribute("data-dgexar"); if (pickedExtras[xid]) delete pickedExtras[xid]; else pickedExtras[xid] = true; render(); return; }
    });
    // 改标题 = 导演在干预 → 暂停倒计时(不重渲, 免丢焦点)。
    // 任一干预(标题/风格)→ 立即停倒计时(用户干预最高优先, 系统停下)。
    modal.addEventListener("input", function (e) {
      if (e.target.closest && e.target.closest(".ag-dg-title")) { title = e.target.value; stopCd(); }
      else if (e.target.closest && e.target.closest(".ag-dg-synopsis")) { synopsis = e.target.value; stopCd(); }
      else if (e.target.closest && e.target.closest(".ag-dg-style")) { style = e.target.value; stopCd(); }
    });
    // change(失焦/回车): 标题定稿 → 文明智能联动(未手选文明时按标题推断文明 → 重荐角);
    //   自定义倒计时秒数 → 持久化 + 刷新剩余秒。不在 input 每键触发, 免打字丢焦点。
    modal.addEventListener("change", function (e) {
      if (e.target.closest && e.target.closest("[data-seedrole]")) {   // seed 出演角色 → 影响分层计费
        stopCd(); seedRole = e.target.value; var o = DG_ROLE_OPTS.find(function (x) { return x.r === seedRole; }); seedAlign = o ? o.a : "neutral"; render(); return;
      }
      if (e.target.closest && e.target.closest(".ag-dg-cdset")) {
        var nv = dgCdSet(e.target.value); cdLeft = nv; e.target.value = nv;
        var b = modal.querySelector(".ag-dg-cd b"); if (b) b.textContent = cdLeft + "s"; return;
      }
      if (e.target.closest && e.target.closest(".ag-dg-title")) {
        title = e.target.value;
        if (!civManual) { var g = dgInferCiv(title); if (g && g !== civ) { civ = g; loadCast(); } }   // 标题联动文明(仅未手选时)
      }
    });
    render(); root.appendChild(modal);
    loadCast(); startCd();
  }
  window.cssosOpenDirectorGate = openDirectorGate;

  /* C 选角注入拦截器: 待选角期间, 给生成/建档调用体注入 actor_id → 后端把演员锁定形象
   * 注入封面/视频 + 记 actor_castings。work 建档成功后清掉待选角(避免泄漏到无关创作)。 */
  (function installCastInterceptor() {
    if (window.__cssosActorFetchPatched) return;
    window.__cssosActorFetchPatched = true;
    var INJECT = /\/api\/mv\/(cover|video|lyrics)\b/;
    var CREATE = /\/api\/works(\?|$)/;
    var orig = window.fetch;
    window.fetch = function (input, init) {
      try {
        var aid = window.__cssosCastActorId;
        if (aid && init && typeof init.body === "string") {
          var url = (typeof input === "string") ? input : (input && input.url) || "";
          var method = String((init.method || "GET")).toUpperCase();
          var isCreate = CREATE.test(url) && method === "POST";
          if ((INJECT.test(url) || isCreate)) {
            var b = JSON.parse(init.body);
            if (b && typeof b === "object" && !Array.isArray(b)) {
              if (!b.actor_id) b.actor_id = aid;
              if (isCreate) { b.__actorId = aid; if (window.__cssosCastRole) b.__actorRole = window.__cssosCastRole; if (window.__cssosCastAlign) b.__actorAlignment = window.__cssosCastAlign; }
              // W1537 导演入口: 故事梗概【决定剧情】+ 文明/风格智能联动 → 注入生成体(不覆盖已有值)。
              if (window.__cssosDirectorSynopsis && !b.synopsis) b.synopsis = window.__cssosDirectorSynopsis;
              if (window.__cssosDirectorCiv && !b.civilization && !b.civ) b.civilization = window.__cssosDirectorCiv;
              if (window.__cssosDirectorStyle && !b.style) b.style = window.__cssosDirectorStyle;
              // ④ P2/P3(W1536) — 把整份多角色 cast 一并注入: 建档→记录+计费; cover/video→同框多人锁脸。
              if (window.__cssosCast && Array.isArray(window.__cssosCast.cast) && window.__cssosCast.cast.length && !b.cast) { b.cast = window.__cssosCast.cast; }
              init = Object.assign({}, init, { body: JSON.stringify(b) });
              if (isCreate) {
                // 建档完成即视为选角落定, 清待选角; 同时记下 {workId, actorName} 供作品出炉后弹分享(第2落点)。
                var p = orig.call(this, input, init);
                var castName = window.__cssosCastActorName;
                return p.then(function (res) {
                  try { window.__cssosCastActorId = null; window.__cssosDirectorSynopsis = null; window.__cssosDirectorCiv = null; window.__cssosDirectorStyle = null; } catch (_e) {}
                  try {
                    res.clone().json().then(function (j) {
                      var wid = j && (j.work_id || j.id || (j.work && j.work.id) || (j.data && j.data.work_id));
                      if (wid && castName) window.__cssosCastShare = { workId: String(wid), actorName: castName };
                    }).catch(function () {});
                  } catch (_e2) {}
                  return res;
                });
              }
            }
          }
        }
      } catch (_e) { /* 注入失败不影响原请求 */ }
      return orig.call(this, input, init);
    };
    // 第2落点: 选角作品一旦成为当前作品(出炉/开播)→ 弹「XX 主演的 MV 出炉了, 分享?」一次性。
    window.addEventListener("cssos:work-id-changed", function (ev) {
      var cs = window.__cssosCastShare; if (!cs) return;
      var d = (ev && ev.detail) || {};
      var wid = String(d.work_id || d.workId || d.id || "");
      if (!wid || wid !== cs.workId) return;
      window.__cssosCastShare = null;   // 一次性
      if (typeof window.cssosGuidedToast === "function") {
        window.cssosGuidedToast(T("🎬 " + cs.actorName + " is now starring in your MV! Share it?", "🎬 " + cs.actorName + " 主演的 MV 出炉了!分享一下?"), {
          actions: [{ label: T("Share", "分享"), onClick: function () { if (typeof window.openCssosShareDialog === "function") window.openCssosShareDialog({ workId: cs.workId }); } }],
        });
      }
    }, { passive: true });
  })();

  // 点卡片 → 在【同一个框内】接着展开(不另开框, 不重复标题): 详情填进卡片的 .ag-inline。
  function toggleExpand(cardEl) {
    stopShowcase();
    var id = cardEl.getAttribute("data-actor");
    var grid = cardEl.parentElement;
    var wasThis = cardEl.classList.contains("expanded");
    // 先收起所有(含把封面切回 2D)。
    grid.querySelectorAll(".ag-card.expanded").forEach(function (c) {
      c.classList.remove("expanded");
      var inl = c.querySelector(".ag-inline"); if (inl) inl.innerHTML = "";
      restoreCover2D(c);
      downgradeCoverThumb(c);   // 收起 = 封面换回 440 缩略, 释放 1080 高清解码内存
    });
    if (wasThis) return;   // 再点一次 = 收起
    cardEl.classList.add("expanded");
    _agCloseAllPanels();   // W1646 — 进专页 → 关闭所有其它面板, 只剩专页
    _agPauseBgMedia(); setTimeout(function () { _agCloseAllPanels(); _agPauseBgMedia(); }, 700);   // W1643/1646 — 补一刀治自动续播/重开的面板
    upgradeCoverHiRes(cardEl); // 展开 = 封面换 1080 高清(同一张图, 代理换宽度; 收起再释放)
    var inline = cardEl.querySelector(".ag-inline");
    inline.innerHTML = '<div class="ag-skel" style="height:120px;margin-top:10px"></div>';
    cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    fillExpand(cardEl, id);
  }
  // 释放 WebGL/GLB 资源(model-viewer 不主动释放 GL 上下文, 连着浏览会撞上下文上限/OOM → 强退)。
  function disposeModelViewers(el) {
    if (!el || !el.querySelectorAll) return;
    el.querySelectorAll("model-viewer").forEach(function (m) {
      try { m.removeAttribute("src"); m.removeAttribute("ios-src"); m.removeAttribute("poster"); if (m.parentNode) m.parentNode.removeChild(m); } catch (_e) {}
    });
  }
  function restoreCover2D(cardEl) {
    var cov = cardEl.querySelector("[data-cover]");
    if (cov) { disposeModelViewers(cov); if (cov.__cover2d != null) { cov.innerHTML = cov.__cover2d; cov.__cover2d = null; } }
  }
  // 展开: 封面缩略图(/img?w=440)升到高清(/img?w=1080)。只对经代理的图有效(外链原图/占位不动)。
  // 收起时 downgradeCoverThumb 换回 440 → 浏览器丢弃 1080 解码位图, 内存回落。进出反复 = 换宽度参数,
  // 高清版命中 30 天 HTTP 缓存, 无重复下载; 任一时刻只有【当前展开的那一张】高清活在内存里。
  function upgradeCoverHiRes(cardEl) {
    var img = cardEl.querySelector("[data-cover] img");
    if (!img) return;
    var cur = (img.getAttribute("src") === AG_BLANK ? img.dataset.agSrc : img.getAttribute("src")) || "";
    if (cur.indexOf("/img?") < 0 || img.dataset.agThumb) return; // 非代理图 / 已升清
    img.dataset.agThumb = cur;
    img.src = cur.replace(/([?&])w=\d+/, "$1w=1080");
  }
  function downgradeCoverThumb(cardEl) {
    var img = cardEl.querySelector("[data-cover] img");
    if (img && img.dataset.agThumb) { img.src = img.dataset.agThumb; delete img.dataset.agThumb; }
  }
  function fillExpand(cardEl, id) {
    var inline = cardEl.querySelector(".ag-inline");
    fetch("/api/actors/" + encodeURIComponent(id) + "/codex", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var d = (j && j.data) || {}, a = d.actor;
        if (!a) { inline.innerHTML = '<div class="ag-empty">' + esc(T("Actor not found.", "未找到该演员。")) + '</div>'; return; }
        var tags = [].concat(a.appearance_tags || [], a.tags || []).filter(Boolean).slice(0, 8);
        var mvs = d.mvs || [];
        var counts = d.counts || {};
        // 详情【接着上一行】显示在同一框里, 不重复姓名/风格。
        // W1619 — Jing: 徽章/价格/文明/Villain 全合进【封面左上一行】(见上 .ag-cover-head); 旧详情块删除, 问道紧接封面。
        inline.innerHTML =
          // 《问道》W1582 — 与本演员第一人称对话(母语·古 / 现代 胶囊切换; 逐字流式)。
          '<div class="ag-wendao">' +
            '<div class="ag-wd-head">' +
              '<span class="ag-wd-title">🗣 ' + esc(T("Ask", "问道")) + ' · ' + esc(a.name_zh || a.name_en || "") + '</span>' +
              // W1607 — 头部控件并成一条凸嵌凹胶囊: 🔊静音 · ↻重来 · 母语古/现代(动作键点完弹回语言锚点)。
              '<div class="ag-wd-headright" data-pill-bar>' +
                '<button class="ag-wd-mute" data-pill-key="mute" title="' + esc(T("Voice on / off", "语音 开/关")) + '">🔊</button>' +
                '<button class="ag-wd-reset" data-pill-key="reset" title="' + esc(T("Restart conversation", "重新开始对话")) + '">↻ <span>' + esc(T("Reset", "重来")) + '</span></button>' +
                '<button data-pill-key="native" class="active">📜 ' + esc(T("Native · old", "母语·古")) + '</button>' +
                '<button data-pill-key="modern">🌐 ' + esc(T("Modern", "现代")) + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="ag-wd-log" aria-live="polite"></div>' +
            '<div class="ag-wd-chips" data-pill-bar>' +
              '<button class="ag-wd-chip" data-pill-key="q-life" data-q="' + esc(T("Tell me about your life.", "聊聊你的生平。")) + '">📖 ' + esc(T("Your life", "生平")) + '</button>' +
              '<button class="ag-wd-chip" data-pill-key="q-proud" data-q="' + esc(T("What are you most proud of?", "你最骄傲的一件事是什么?")) + '">🏆 ' + esc(T("Proudest", "最骄傲")) + '</button>' +
              '<button class="ag-wd-chip" data-pill-key="q-regret" data-q="' + esc(T("Do you have any regrets?", "你有什么遗憾吗?")) + '">💭 ' + esc(T("Regrets", "遗憾")) + '</button>' +
              '<button class="ag-wd-chip" data-pill-key="q-future" data-q="' + esc(T("A word for future generations?", "对后世说句话吧?")) + '">🌱 ' + esc(T("To the future", "对后世")) + '</button>' +
            '</div>' +
            '<div class="ag-wd-input" data-pill-bar>' +
              '<textarea class="ag-wd-text" data-pill-key="say" rows="1" placeholder="' + esc(T("Ask them anything…", "问 TA 一句…")) + '" maxlength="800"></textarea>' +
              '<button class="ag-wd-mic" data-pill-key="mic" title="' + esc(T("Voice", "语音")) + '">🎤 <span>' + esc(T("Voice", "语音")) + '</span></button>' +
              '<button class="ag-wd-send" data-pill-key="ask">💬 ' + esc(T("Ask", "问")) + '</button>' +
            '</div>' +
          '</div>' +
          (tags.length ? '<div class="ag-tags">' + tags.map(function (t) { return '<span class="ag-tag">' + esc(t) + '</span>'; }).join("") + '</div>' : "") +
          '<div class="ag-showcase">' +
            '<button class="ag-sc-btn" data-seg="intro">▶ ' + esc(T("Intro", "自我介绍")) + '</button>' +
            '<button class="ag-sc-btn" data-seg="hero">😇 ' + esc(T("Hero", "正派")) + '</button>' +
            '<button class="ag-sc-btn" data-seg="villain">😈 ' + esc(T("Villain", "反派")) + '</button>' +
            '<button class="ag-sc-btn" data-seg="extra">👥 ' + esc(T("Extra", "群演")) + '</button>' +
          '</div>' +
          '<div class="ag-stage" aria-live="polite"></div>' +
          // #1 — 自我介绍/正派/反派内容框下方: 两人图标 Face on Face 入口(搬进问道内容区)。
          '<button class="ag-sc-f2f" type="button" title="' + esc(T("Talk with them face to face", "和 TA 面对面聊")) + '">' +
            '<svg class="ag-f2f-ic2" viewBox="0 0 28 20" aria-hidden="true"><circle cx="5" cy="8" r="3.2" fill="#FF5A5A"/><path d="M0.5 18c0-3 2-4.6 4.5-4.6S9.5 15 9.5 18z" fill="#FF5A5A"/><circle cx="23" cy="8" r="3.2" fill="#3E8BFF"/><path d="M18.5 18c0-3 2-4.6 4.5-4.6S27.5 15 27.5 18z" fill="#3E8BFF"/><rect x="10.5" y="3.5" width="7" height="5" rx="2.5" fill="#fff"/></svg>' +
            '<span>' + esc(T("Face on Face", "面对面")) + '</span>' +
          '</button>' +
          // 群演 opt-in(仅演员主人可设): 愿意当群众演员 → 进自愿群演池。
          (state.ownedSet[a.actor_id] ? '<label class="ag-willing"><input type="checkbox" class="ag-willing-cb"' + (a.willing_extra ? " checked" : "") + '> 👥 ' + esc(T("Willing to appear as an extra (background roles)", "是否愿意当群众演员(背景角色)")) + '</label>' : "") +
          '<div class="ag-cta-cap">' +
            '<button class="ag-cast" data-pill-key="cast" title="' + esc(T("Works performed in", "出演作品数")) + '">🎬 ' + esc(T("Cast in an MV", "选 TA 主演")) + ' <span class="ag-cnt">' + (counts.appearances || 0) + '</span></button>' +
            '<button class="ag-comment" data-pill-key="comment">💬 ' + esc(T("Comment", "评论")) + ' <span class="ag-cnt">' + (counts.comments || 0) + '</span></button>' +
            '<button class="ag-share" data-pill-key="share" title="' + esc(T("Share this actor", "分享这位演员")) + '">↗ ' + esc(T("Share", "分享")) + ' <span class="ag-cnt">' + (counts.shares || 0) + '</span></button>' +
          '</div>' +
          '<div class="ag-comments" hidden><h3>💬 ' + esc(T("Comments", "评论")) + '</h3><div class="ag-cmt-input"><textarea class="ag-cmt-text" rows="1" placeholder="' + esc(T("Say something about this actor…", "聊聊这位演员…")) + '" maxlength="800"></textarea><button class="ag-cmt-send">' + esc(T("Post", "发布")) + '</button></div><div class="ag-cmt-list"></div></div>' +
          (mvs.length ? '<div class="ag-sec"><h3>' + esc(T("Appearances", "出演作品")) + (state.ownedSet[a.actor_id] ? ' · ' + esc(T("free to watch", "本人免费欣赏")) : "") + '</h3><div class="ag-grid ag-sub-grid">' +
            mvs.map(function (m) { return '<div class="ag-card ag-appear" data-work="' + esc(m.work_id) + '" style="cursor:pointer"><div class="ag-cover">' + coverInner({ cover_image: m.cover_url, name_en: m.title, cover_focal_x: m.cover_focal_x, cover_focal_y: m.cover_focal_y }, false) +
              '</div><div class="ag-meta"><div class="ag-name">▶ ' + esc(m.title || "Untitled") + '</div>' +
              (state.ownedSet[a.actor_id] ? '<button class="ag-report" data-actor="' + esc(a.actor_id) + '" data-work="' + esc(m.work_id) + '" style="margin-top:4px;font-size:11px;background:rgba(255,120,120,.14);border:1px solid rgba(255,120,120,.4);color:#ffb3b3;border-radius:999px;padding:2px 9px;cursor:pointer">🚩 ' + esc(T("Report misuse", "举报滥用")) + '</button>' : "") +
              '</div></div>'; }).join("") + '</div></div>' : "");
        // 展开【默认显示精致 2D 封面】(不再自动加载 3D)——3D 的 WebGL/9MB GLB 很吃内存, 连着浏览会 OOM 强退。
        // 3D 改为【显式点击】按需加载(省内存 + 展示更精致的 2D 原色封面)。
        cardEl.__actor = a;
        var cov0 = cardEl.querySelector("[data-cover]");
        if (cov0 && !cardEl.querySelector(".ag-cover-track")) {   // W1618b — track 现在是 cov0 的兄弟节点, 去重要查整张卡(否则每次展开重建 → 叠多条)
          // 封面左下角一条胶囊轨道 [👥 Face on Face | 🖼 Full cover] —— 走平台 cssosMakePillBar
          // (凸嵌凹胶囊宪法, 与选角/评论/分享同款), Face on Face 恒为凸绿主段(动作条, 非筛选)。
          // CSS 仅在 .ag-card.expanded 时显示 → 折叠小卡不再挤成一团。
          var track = document.createElement("div"); track.className = "ag-cover-track"; track.setAttribute("data-pill-bar", "");
          var bF2f = document.createElement("button"); bF2f.type = "button"; bF2f.setAttribute("data-pill-key", "f2f");
          bF2f.innerHTML = '<svg class="ag-f2f-ic2" viewBox="0 0 28 20" aria-hidden="true"><circle cx="5" cy="8" r="3.2" fill="#FF5A5A"/><path d="M0.5 18c0-3 2-4.6 4.5-4.6S9.5 15 9.5 18z" fill="#FF5A5A"/><circle cx="23" cy="8" r="3.2" fill="#3E8BFF"/><path d="M18.5 18c0-3 2-4.6 4.5-4.6S27.5 15 27.5 18z" fill="#3E8BFF"/><rect x="10.5" y="3.5" width="7" height="5" rx="2.5" fill="#fff"/></svg><span>' + esc(T("Face on Face", "面对面")) + '</span>';
          var bCov = document.createElement("button"); bCov.type = "button"; bCov.setAttribute("data-pill-key", "cov");
          bCov.innerHTML = '<span class="ag-covt-ico">🖼</span><span>' + esc(T("Full cover", "完整封面")) + '</span>';
          track.appendChild(bF2f); track.appendChild(bCov);
          cov0.appendChild(track);   // W1619 — 恢复旧短覆盖胶囊(叠封面左下角)
          // W1619 — 封面左上一行信息(名字 + Legend + 文明 + 价 + 播放数), 取代下方旧 meta 详情。
          var _orig = a.origin_type === "civilization";
          var _priceTxt = a.is_premium ? (" · 😇 " + cents(a.cast_price_cents) + " · 😈 " + cents(Math.round((a.cast_price_cents || 0) * 1.3))) : (" · " + T("Free", "免费"));
          var head = document.createElement("div"); head.className = "ag-cover-head";
          // W1620 — 平时只显"🏛 名字"; 每 10 秒亮出完整信息一次(纯 CSS 动画, 无 JS 定时器 → 零内存/零泄漏)。
          head.innerHTML = (_orig ? "🏛" : "✨") + ' <span class="ag-ch-name">' + esc(a.name_en || a.name_zh || "") + '</span>' +
            '<span class="ag-ch-rest"> · ' + esc(_orig ? T("Legend", "文明") : T("Original", "原创")) + (a.civilization ? ' · ' + esc(civDisplay(a.civilization)) : "") + _priceTxt + ' · ▶ ' + (a.cast_count || 0) + '</span>';
          cov0.insertBefore(head, cov0.firstChild);
          track.addEventListener("click", function (ev) { ev.stopPropagation(); });   // 点胶囊不折叠卡片
          var covToggle = function () {
            var full = cov0.classList.toggle("ag-cover-full");
            bCov.querySelector(".ag-covt-ico").textContent = full ? "🔼" : "🖼";
            bCov.lastChild.textContent = full ? T("Collapse", "收起") : T("Full cover", "完整封面");
          };
          if (typeof window.cssosMakePillBar === "function") {
            var covCtl = window.cssosMakePillBar(track, { mono: true, compact: true, textColor: "light", activeKey: "f2f", onActivate: function (key) { if (key === "cov") covToggle(); else openFaceToFace(a.actor_id, a); if (covCtl) covCtl.setActive("f2f"); } });
          } else {
            bF2f.onclick = function () { openFaceToFace(a.actor_id, a); };
            bCov.onclick = covToggle;
          }
        }
        // 选角/评论/分享 走平台胶囊(与顶部筛选条同一套凹凸镶嵌); Cast 恒为凸绿主段(动作条, 非筛选)。
        var ctaBar = inline.querySelector(".ag-cta-cap");
        function runCta(key) {
          if (key === "cast") openDirectorGate(a);   // 点卡片选角 → 直接进导演入口(seed 为主角), 取代旧的格式弹窗
          else if (key === "comment") toggleComments(inline, a.actor_id);
          else if (key === "share") shareActor(a);
        }
        if (ctaBar && typeof window.cssosMakePillBar === "function") {
          var ctaCtl = window.cssosMakePillBar(ctaBar, { mono: true, compact: true, textColor: "light", activeKey: "cast", onActivate: function (key) { runCta(key); if (ctaCtl) ctaCtl.setActive("cast"); } });
        } else if (ctaBar) {
          ctaBar.querySelectorAll("button[data-pill-key]").forEach(function (b) { b.onclick = function () { runCta(b.getAttribute("data-pill-key")); }; });
        }
        // 戏路标签也套同一胶囊轨道(纯几何, 无激活/无点击) —— 与上方筛选条视觉一致。
        var tagsBar = inline.querySelector(".ag-tags");
        if (tagsBar && tagsBar.children.length && typeof window.cssosPillBarStamp === "function") window.cssosPillBarStamp(tagsBar, "light", true);
        wireShowcase(inline, a.actor_id, a);
        wireWendao(inline, a.actor_id, a);   // 《问道》W1582 — 第一人称对话
        if (state.ownedSet[a.actor_id]) {
          var own = document.createElement("div"); own.className = "ag-owner";
          own.innerHTML = '<span class="ag-tag">🎬 ' + esc(T("Mine", "我的演员")) + ' · ' + esc(T("royalty", "版税")) + ' ' + Math.round((a.creator_royalty || 0.7) * 100) + '%</span>' +
            (a.is_real_person ? '<button class="ag-revoke ag-del">' + esc(T("Revoke consent", "撤回授权")) + '</button>' : '') +
            '<button class="ag-del ag-del-actor">' + esc(T("Delete", "删除")) + '</button>';
          inline.appendChild(own);
          // 左下三件套套胶囊(纯几何, Mine 首枚激活凸绿; Revoke/Delete 保留各自 onclick)。
          if (typeof window.cssosPillBarStamp === "function") window.cssosPillBarStamp(own, "light", true);
          // 「在哪用在哪改」: 点名字即可改名(仅自己的演员)。
          var nameEl = cardEl.querySelector(".ag-name");
          if (nameEl && !nameEl.__renamable) {
            nameEl.__renamable = true; nameEl.classList.add("ag-editable"); nameEl.title = T("Click to rename", "点击改名");
            // 整行都可点改名: .ag-name 撑满整行 + 手型光标(点空白处也触发)。
            nameEl.style.display = "block"; nameEl.style.width = "100%"; nameEl.style.cursor = "pointer";
            nameEl.innerHTML = '<span class="ag-nametext" style="cursor:text">' + esc(a.name_en || a.name_zh || "") + '</span> <span style="opacity:.55;font-size:12px;cursor:pointer">✎</span>';
            var textEl = nameEl.querySelector(".ag-nametext");
            function startRename() {
              if (textEl.getAttribute("contenteditable") === "true") return;
              var orig = textEl.textContent;
              textEl.setAttribute("contenteditable", "true");
              textEl.style.cssText = "cursor:text;outline:1.5px solid rgba(0,245,160,.85);border-radius:4px;padding:1px 5px;background:rgba(0,245,160,.08)";
              textEl.focus();
              try { var rg = document.createRange(); rg.selectNodeContents(textEl); var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(rg); } catch (_e) {}
              var done = false;
              function finish(save) {
                if (done) return; done = true;
                textEl.setAttribute("contenteditable", "false"); textEl.style.cssText = "cursor:text";
                var nv = String(textEl.textContent || "").trim();
                if (!save || nv.length < 2 || nv === orig) { textEl.textContent = orig; return; }
                textEl.textContent = nv;
                fetch("/api/actors/" + encodeURIComponent(a.actor_id), { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name_en: nv }) })
                  .then(function (r) { return r.json(); }).then(function (jj) {
                    if (jj && jj.ok) { a.name_en = nv; for (var i = 0; i < state.actors.length; i++) if (state.actors[i].actor_id === a.actor_id) state.actors[i].name_en = nv; if (window.cssosGuidedToast) window.cssosGuidedToast("✓ " + nv, {}); }
                    else { textEl.textContent = orig; window.alert(T("Rename failed.", "改名失败。")); }
                  }).catch(function () { textEl.textContent = orig; window.alert(T("Network error.", "网络错误。")); });
              }
              textEl.addEventListener("keydown", function onk(e) { if (e.key === "Enter") { e.preventDefault(); textEl.removeEventListener("keydown", onk); textEl.blur(); finish(true); } else if (e.key === "Escape") { e.preventDefault(); textEl.removeEventListener("keydown", onk); finish(false); textEl.blur(); } });
              textEl.addEventListener("blur", function onb() { textEl.removeEventListener("blur", onb); finish(true); });
            }
            nameEl.onclick = function (ev) { ev.stopPropagation(); startRename(); };
          }
          var revokeBtn = own.querySelector(".ag-revoke");
          if (revokeBtn) revokeBtn.onclick = function () {
            if (!window.confirm(T("Revoke consent? Your actor is taken down and can no longer be cast.", "撤回授权?演员将下架、不再可被选用。"))) return;
            fetch("/api/actors/" + encodeURIComponent(a.actor_id) + "/revoke-consent", { method: "POST", credentials: "include" }).then(function (r) { return r.json(); }).then(function (jj) {
              if (jj && jj.ok) { window.alert(T("Consent revoked. Actor taken down.", "已撤回授权,演员已下架。")); renderGrid(); } else window.alert(T("Failed.", "操作失败。"));
            }).catch(function () {});
          };
          own.querySelector(".ag-del-actor").onclick = function () {
            if (!window.confirm(T("Delete this actor? This cannot be undone.", "删除此演员?此操作不可撤销。"))) return;
            fetch("/api/actors/" + encodeURIComponent(a.actor_id), { method: "DELETE", credentials: "include" }).then(function (r) { return r.json(); }).then(function (jj) {
              if (jj && jj.ok) { delete state.ownedSet[a.actor_id]; state.actors = state.actors.filter(function (x) { return x.actor_id !== a.actor_id; }); renderGrid(); }
              else window.alert(T("Delete failed.", "删除失败。"));
            }).catch(function () { window.alert(T("Network error.", "网络错误。")); });
          };
        }
      })
      .catch(function () { inline.innerHTML = '<div class="ag-empty">' + esc(T("Load failed.", "加载失败。")) + '</div>'; });
  }
  // 封面区显示 3D(可切回 2D)。存 2D 原始 HTML 以便切回。
  function showCover3D(cardEl, a) {
    var cov = cardEl.querySelector("[data-cover]");
    if (!cov) return;
    if (cov.__cover2d == null) cov.__cover2d = cov.innerHTML;
    render3D(cov, a);   // render3D 会把 3D/model-viewer 填进这个容器
  }
  window.__agToggleCover = function (cardEl, a) {
    var cov = cardEl.querySelector("[data-cover]");
    if (!cov) return;
    if (cov.querySelector("model-viewer") || cov.querySelector(".ag-mv-wrap")) { restoreCover2D(cardEl); }   // 3D→2D
    else showCover3D(cardEl, a);                                                                              // 2D→3D
  };
  // 兼容: 创建演员成功后仍可"打开"该演员——重渲染网格并展开对应卡。
  function renderDetail(id) {
    renderGrid();
    setTimeout(function () {
      var card = document.querySelector("#" + ROOT_ID + ' .ag-card[data-actor="' + id + '"]');
      if (card) toggleExpand(card);
    }, 60);
  }

  /* ── 开口说话 showcase 播放器 ─────────────────────────────────────── */
  var scAudio = null, scRAF = 0, scCache = {}, sc3dBox = null, sc3dSaved = null;
  function restore3D() {
    // 恢复被会说话视频替换掉的旋转 3D。
    if (sc3dBox && sc3dSaved != null) { sc3dBox.innerHTML = sc3dSaved; }
    sc3dBox = null; sc3dSaved = null;
  }
  function stopShowcase() {
    if (scAudio) { try { scAudio.pause(); } catch (_e) {} scAudio = null; }
    if (scRAF) { cancelAnimationFrame(scRAF); scRAF = 0; }
    restore3D();
    if (typeof speakStop === "function") speakStop();
    var root = document.getElementById(ROOT_ID);
    if (root) root.querySelectorAll(".ag-sc-btn.playing").forEach(function (b) { b.classList.remove("playing"); });
  }
  function playClip(clip, btn, stage) {
    stopShowcase();
    if (!clip || !clip.voice_url) { stage.textContent = T("(missing)", "(此段暂缺)"); return; }
    var toks = (clip.subtitle && clip.subtitle.tokens) || [];
    // 后端 token 跳过了空格 → 从【完整台词(含空格/断词)】逐字渲染, 非空格字符按序取 token 时间,
    //   空格沿用上一个时间。这样英文单词之间有空格、不再连成一坨。
    var fullText = clip.text || (toks.length ? toks.map(function (t) { return t.char; }).join("") : "");
    var karaoke = "", ti = 0, lastTs = 0;
    if (fullText) {
      for (var ci = 0; ci < fullText.length; ci++) {
        var ch = fullText[ci], ts;
        if (/\S/.test(ch) && ti < toks.length) { ts = toks[ti].t_start; lastTs = ts; ti++; }
        else { ts = lastTs; }
        karaoke += '<span class="tk" data-ts="' + ts + '">' + esc(ch) + '</span>';
      }
    }
    // 字幕(母语+英文)固定在 stage; 会说话视频【就地替换主视觉区的旋转 3D】—— 演员在原位可动可说话。
    stage.innerHTML = '<div class="ag-native">' + karaoke + '</div>' +
      (clip.text_en ? '<div class="ag-trans">' + esc(clip.text_en) + '</div>' : "");
    var spans = stage.querySelectorAll(".tk");
    btn.classList.add("playing");
    var timeSrc;
    var card = stage.closest && stage.closest(".ag-card");
    var box3d = clip.video_url && card ? card.querySelector("[data-cover]") : null;
    if (clip.video_url && box3d) {
      sc3dBox = box3d; sc3dSaved = box3d.innerHTML;   // 存旋转3D以便播完恢复
      box3d.innerHTML = '<video class="ag-talkvid" playsinline autoplay src="' + esc(clip.video_url) + '" style="width:100%;height:100%;object-fit:cover;display:block;"></video>';
      var v = box3d.querySelector(".ag-talkvid"); scAudio = v;
      v.play().catch(function () {});
      timeSrc = function () { return v.currentTime; };
      v.onended = function () { btn.classList.remove("playing"); if (scRAF) cancelAnimationFrame(scRAF); restore3D(); };
    } else if (clip.video_url) {
      // 无 3D 框(如子网格)→ 视频放 stage。
      stage.insertAdjacentHTML("afterbegin", '<video class="ag-talkvid" playsinline autoplay src="' + esc(clip.video_url) + '" style="width:100%;max-width:340px;border-radius:14px;display:block;margin-bottom:10px;border:1px solid rgba(0,245,160,.4);"></video>');
      var v2 = stage.querySelector(".ag-talkvid"); scAudio = v2; v2.play().catch(function () {});
      timeSrc = function () { return v2.currentTime; };
      v2.onended = function () { btn.classList.remove("playing"); if (scRAF) cancelAnimationFrame(scRAF); };
    } else {
      scAudio = new Audio(clip.voice_url);
      scAudio.play().catch(function () { stage.insertAdjacentHTML("beforeend", '<div class="ag-empty">▶ ' + esc(T("Tap to allow sound", "点一下允许播放声音")) + '</div>'); });
      timeSrc = function () { return scAudio ? scAudio.currentTime : 0; };
      scAudio.onended = function () { btn.classList.remove("playing"); if (scRAF) cancelAnimationFrame(scRAF); speakStop(); };
    }
    // 让 3D「开口说话」: 播音频时, 封面里的 3D 模型跟每个音节【点头+律动】(TripoSR 静态网格不能真动嘴唇,
    //   用整体律动+旋转造出"在说话"的活感)。纯字幕 token 时间轴驱动, 不接 Web Audio(铁律)。
    var mv = card ? card.querySelector("[data-cover] model-viewer") : null;
    function tick() {
      if (!scAudio) return;
      var ms = timeSrc() * 1000;
      for (var i = 0; i < spans.length; i++) {
        var ts = +spans[i].getAttribute("data-ts") || 0;
        spans[i].classList.toggle("on", ms >= ts - 40);
      }
      // 律动: 当前是否正在发某个音节(用 token 区间判断)。
      var speaking = false, intensity = 0;
      for (var k = 0; k < toks.length; k++) { var t = toks[k]; if (ms >= t.t_start && ms < t.t_end) { speaking = true; intensity = Math.max(intensity, t.emotion_intensity || 0.5); } }
      if (mv) {
        // 说到音节时嘴部区域律动(点头 nod + 轻微竖向挤压=口型开合的错觉), 停顿时归位。
        var ph = ms / 90;   // 音节内快速开合
        var open = speaking ? (0.5 + 0.5 * Math.abs(Math.sin(ph))) * (0.5 + intensity) : 0;
        mv.style.transform = "translateY(" + (-open * 4).toFixed(2) + "px) scaleY(" + (1 + open * 0.03).toFixed(3) + ")";
        mv.style.transformOrigin = "50% 62%";
      }
      scRAF = requestAnimationFrame(tick);
    }
    scRAF = requestAnimationFrame(tick);
  }
  function speakStop() { var root = document.getElementById(ROOT_ID); if (!root) return; root.querySelectorAll("[data-cover] model-viewer").forEach(function (m) { m.style.transform = ""; }); }
  // 点「自我介绍/正派/反派」= 数字演员【开口说话的视频】直接播放; 无视频则先生成(懒), 无语音则先生成语音。
  // 通用【复制内容】: 写剪贴板 + 按钮闪一下 ✓。问道回复 + 评论共用。
  function agCopy(text, btn) {
    function flash() { if (!btn) return; var o = btn.getAttribute("data-glyph") || btn.textContent; btn.textContent = "✓"; setTimeout(function () { btn.textContent = o; }, 900); }
    function fallback() { try { var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); } catch (e) {} }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(flash, function () { fallback(); flash(); });
      } else { fallback(); flash(); }
    } catch (e) { fallback(); flash(); }
  }

  // 《问道》W1586 — 「我的收藏」弹窗: 列出用户收藏的问答, 可删除。
  function openMyCollection() {
    var ov = document.createElement("div"); ov.className = "ag-mycol-ov";
    ov.innerHTML = '<div class="ag-mycol-box"><div class="ag-mycol-head"><b>⭐ ' + esc(T("My Collection", "我的收藏")) + '</b><button class="ag-mycol-x" aria-label="close">×</button></div><div class="ag-mycol-list">' + esc(T("Loading…", "加载中…")) + '</div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.querySelector(".ag-mycol-x").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    var list = ov.querySelector(".ag-mycol-list");
    fetch("/api/wendao/saves", { credentials: "include" }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.code === "AUTH_REQUIRED") { list.innerHTML = '<div class="ag-mycol-empty">' + esc(T("Sign in to see your collection.", "登录后查看收藏。")) + '</div>'; return; }
      var saves = (j && j.saves) || [];
      if (!saves.length) { list.innerHTML = '<div class="ag-mycol-empty">' + esc(T("Nothing saved yet. Tap ☆ on a reply in Ask.", "还没有收藏。在问道回复上点 ☆ 即可收藏。")) + '</div>'; return; }
      list.innerHTML = saves.map(function (s) {
        return '<div class="ag-mycol-item" data-sid="' + esc(s.id) + '">' +
          '<div class="ag-mycol-who">🗣 <b>' + esc(s.actor_name || "") + '</b><button class="ag-mycol-del" data-sid="' + esc(s.id) + '" title="' + esc(T("Remove", "移除")) + '">🗑</button></div>' +
          (s.question ? '<div class="ag-mycol-q">' + esc(s.question) + '</div>' : '') +
          '<div class="ag-mycol-a">' + esc(s.answer) + '</div>' +
        '</div>';
      }).join("");
    }).catch(function () { list.innerHTML = '<div class="ag-mycol-empty">' + esc(T("Failed to load.", "加载失败。")) + '</div>'; });
    list.addEventListener("click", function (e) {
      var del = e.target.closest && e.target.closest(".ag-mycol-del");
      if (!del) return;
      var sid = del.getAttribute("data-sid");
      del.disabled = true;
      fetch("/api/wendao/saves/" + encodeURIComponent(sid), { method: "DELETE", credentials: "include" }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { var it = list.querySelector('.ag-mycol-item[data-sid="' + sid + '"]'); if (it) it.remove(); if (!list.querySelector(".ag-mycol-item")) list.innerHTML = '<div class="ag-mycol-empty">' + esc(T("Nothing saved yet.", "还没有收藏。")) + '</div>'; }
        else del.disabled = false;
      }).catch(function () { del.disabled = false; });
    });
  }

  // 同框视频通话(W1589) — 摄像头 + 演员同框, 谁说话谁大屏、听者画中画; 演员头像逐音节对口型。网页先行, Vision 端另做空间面对面。
  function openFaceToFace(actorId, a) {
    // CSSOS_WAVE_1669 — Jing: 进面对面就掐掉专页正在播的【自我介绍】(哪怕播到一半);
    //   已听完则 audio 已 ended → 空操作。顺带少一路音频解码器/RAF, 缓解并发媒体内存。
    try { if (typeof _agActiveWendaoStop === "function") _agActiveWendaoStop(); } catch (e) {}
    // W1669 — 进 f2f 彻底清场: 关其它面板 + 停背景媒体, 让面对面独占, 不受任何无关内容/内存干扰。
    try { _agCloseAllPanels(); _agPauseBgMedia(); } catch (e) {}
    _agProbeStart();   // W1670 — 常驻探针(若未起则起)
    var cover = (a && a.cover_image) || "";
    // W1643 — 用人脸焦点框住脸 → 面部完整显示(修 center-top 只露头顶 / 切掉嘴)。嘴层落在脸中心下方。
    //   FaceDetector 可用时再精修(异步覆盖 focal)。
    var _fy = (a && a.cover_focal_y != null && a.cover_focal_y >= 0) ? a.cover_focal_y : 0.42;
    var _fx = (a && a.cover_focal_x != null && a.cover_focal_x >= 0) ? a.cover_focal_x : 0.5;
    var _fyUp = Math.min(0.94, _fy + 0.08);   // W1652 — 脸略上移(露更多下巴/嘴, 少额头)
    var f2fFacePos = (_fx * 100).toFixed(1) + "% " + (_fyUp * 100).toFixed(1) + "%";
    var f2fMouthY = Math.min(86, _fy * 100 + 4).toFixed(0) + "%";
    var name = (a && T(a.name_en || a.name_zh || "", a.name_zh || a.name_en || "")) || "";   // W1730 — locale-aware(英文 UI 不再露中文名)
    var uiLoc = (typeof window.cssosLocale === "string" && window.cssosLocale) || (document.documentElement.lang || "en");
    var ov = document.createElement("div"); ov.className = "ag-f2f-ov";
    ov.innerHTML =
      '<div class="ag-f2f-stage" data-speaker="actor">' +
        // W1607 — 面对面标题钉在 stage 左上角(不再挂在妲己 tile 里, 否则她变小窗时标题跟着跑进小框)。
        '<div class="ag-f2f-title"><div class="ag-f2f-names"></div><div class="ag-f2f-brand">Face on Face</div></div>' +
        '<div class="ag-f2f-actor" style="--mouthy:' + f2fMouthY + '"><div class="ag-f2f-face" style="background-image:url(\'' + cover + '\');background-position:' + f2fFacePos + '"></div><div class="ag-f2f-mouth"></div><div class="ag-f2f-caption"></div></div>' +
        '<div class="ag-f2f-me"><video class="ag-f2f-video" autoplay muted playsinline></video><div class="ag-f2f-melabel">' + esc(T("You", "你")) + '</div></div>' +
      '</div>' +
      // 单条凸嵌凹胶囊轨道: 输入框(field)靠 cssosMakePillBar 的 input-fills-rest 吃满剩余长度, 3 按钮按内容自适应。
      '<div class="ag-f2f-bar"><div class="ag-f2f-track" data-pill-bar>' +
        '<textarea class="ag-f2f-text" data-pill-key="say" rows="1" placeholder="' + esc(T("Say something to them…", "对 TA 说点什么…")) + '"></textarea>' +
        '<button class="ag-f2f-mic" data-pill-key="mic" title="' + esc(T("Talk hands-free", "免提唠嗑")) + '"><span class="ag-f2f-mic-ic">🎤</span><span>' + esc(T("Talk", "唠")) + '</span></button>' +
        '<button class="ag-f2f-rec" data-pill-key="rec" title="' + esc(T("Record a clip to share", "录制片段分享")) + '">⏺ <span>' + esc(T("Rec", "录")) + '</span></button>' +
        '<button class="ag-f2f-send" data-pill-key="speak">💬 <span>' + esc(T("Send", "发")) + '</span></button>' +
      '</div></div>' +
      '<button class="ag-f2f-x" aria-label="close">×</button>';
    document.body.appendChild(ov);
    var stage = ov.querySelector(".ag-f2f-stage"), actorTile = ov.querySelector(".ag-f2f-actor"), caption = ov.querySelector(".ag-f2f-caption");
    try { frameFaceF2F(ov.querySelector(".ag-f2f-face"), actorTile, cover); } catch (e) {}   // W1643 — FaceDetector 精修脸框(异步)
    var video = ov.querySelector(".ag-f2f-video"), input = ov.querySelector(".ag-f2f-text"), sendBtn = ov.querySelector(".ag-f2f-send"), micBtn = ov.querySelector(".ag-f2f-mic"), recBtn = ov.querySelector(".ag-f2f-rec");
    // 底部输入条: 输入框最长(flex:1) + 三个胶囊按钮按内容自适应(不等宽), 每个都带图标+文字。
    var history = [], busy = false, audio = null, stream = null, listening = false, micPaused = false, rec = null;
    var lastQ = "", lastA = "";   // 最近一问一答(录制片段的社交卡文案)
    // W1617 — 崩溃根因(探针实锤: media 一直是 6): 同框全屏覆盖层【背后】首页的一堆 video/audio
    //   仍在持续解码(镜面视频 / 自动播放 feed 的 MV / …), 叠加妲己 TTS + 情绪 FX → Safari 媒体
    //   解码器/进程资源耗尽 → 硬崩(无提示)。这些媒体被遮住、根本看不见 → 进同框就暂停 overlay
    //   【之外】所有在播媒体(close() 恢复), 把 6 个并发解码砍到 1-2 个。这是对症根治。
    var _pausedMedia = [], _bgGuardTimer = 0;
    // W1627 — 杂音根治: 只 pause 不够 —— MV 影院是 <audio id=watch-audio-preview> + feed 会
    //   自动换首/看门狗重播 → 声音卷土重来, 情绪字幕(共用 cssosLineBurstWord 引擎)也随 MV
    //   currentTime 继续爆、穿透到同框。对策: 进同框 → 后台每个媒体【暂停 + 静音】(静音即便被
    //   重新 play 也无声), 再挂 1s 守卫持续压制自动续播; 关闭时只还原【我们静音过的】并续播。
    //   同框自己的 TTS 是 detached new Audio(), 不在 DOM → querySelectorAll 选不到, 不受影响。
    function _pauseBgMedia() {
      try {
        var ms = document.querySelectorAll("video,audio");
        for (var i = 0; i < ms.length; i++) {
          var m = ms[i];
          if (ov.contains(m)) continue;
          try {
            if (!m.muted) { m.muted = true; m.__cssosF2fMuted = true; }   // 静音优先(抗重播)
            if (!m.paused) m.pause();
            if (_pausedMedia.indexOf(m) < 0) _pausedMedia.push(m);
            // W1645 — 崩溃根治(探针实锤 media 恒=6): 只 pause 不释放解码器 → 6 路视频解码常驻
            //   内存 → 叠加妲己 TTS + 情绪 FX → Safari 媒体进程 OOM 硬崩。进同框 → 背景媒体【断源】
            //   释放解码器(srcObject 置空 / 移除 src + <source> 并 load)。背景 MV 本就该停, 不还原。
            try { if (m.srcObject) m.srcObject = null; } catch (e2) {}
            var _had = false;
            try { if (m.getAttribute("src")) { m.removeAttribute("src"); _had = true; } } catch (e3) {}
            try { var _ss = m.querySelectorAll("source"); for (var k = 0; k < _ss.length; k++) { _ss[k].removeAttribute("src"); _had = true; } } catch (e4) {}
            try { if (_had) m.load(); } catch (e5) {}   // load() 真正丢弃已解码帧, 释放显存/内存
          } catch (e) {}
        }
      } catch (e) {}
    }
    _pauseBgMedia();
    setTimeout(_pauseBgMedia, 600);                     // 兜底: 打开后才自动播的(如 feed)也压
    _bgGuardTimer = setInterval(_pauseBgMedia, 1000);   // 守卫: 后台自动续播 → 1s 内再压, 直到关闭同框
    var _prevBothSides = window.cssosBurstBothSides; window.cssosBurstBothSides = true;   // W1591 — 同框英文情绪字幕四边环绕爆(视觉保留; 关闭时还原)
    var _prevConfetti = window.cssosConfettiTopDown; window.cssosConfettiTopDown = false;   // W1649 — 同框【关】天女散花: petal 层是额外 GPU 合成负担, 是硬崩推手之一(探针看不见 GPU 内存)
    var _prevNoAccum = window.cssosBurstNoAccumulate; window.cssosBurstNoAccumulate = false;   // W1591 — 同框: 整句累积, 换句一起淡出(爆完一整句然后消失); 关闭还原
    var _prevSparkCap = window.cssosSparkCapOverride; window.cssosSparkCapOverride = 60;   // W1671 — 同框字心烟花 spark 硬顶再 90→60(Jing 授权 GPU 减负): Safari GPU 合成进程是硬崩真凶, 探针照不到, 主动砍粒子(60 与 90 肉眼几乎无差)
    // B 档录制状态(仅录制期分配, finishRec 全部释放 —— 内存红线)。
    var recording = false, mediaRec = null, recChunks = [], recCanvas = null, recG = null, recRaf = 0, recAC = null, recDest = null, coverImg = null, recTimer = 0;
    function releaseRec() {   // 彻底释放录制资源(画布/音频图/分片)。
      recording = false; _agF2fRec = false;
      if (recTimer) { clearTimeout(recTimer); recTimer = 0; }
      try { cancelAnimationFrame(recRaf); } catch (e) {}
      try { if (mediaRec && mediaRec.state !== "inactive") mediaRec.stop(); } catch (e) {}
      recChunks = []; try { if (recAC) recAC.close(); } catch (e) {} recAC = null; recDest = null;
      recG = null; recCanvas = null; mediaRec = null; coverImg = null;
    }
    function close() {
      try { if (memTimer) clearInterval(memTimer); } catch (e) {}                                   // 停内存探针
      try { window.cssosBurstBothSides = _prevBothSides; window.cssosConfettiTopDown = _prevConfetti; window.cssosBurstNoAccumulate = _prevNoAccum; window.cssosSparkCapOverride = _prevSparkCap; } catch (e) {}   // 还原环绕爆/天女散花/不累积/spark 上限
      try { stopSubtitle(); } catch (e) {}                                                          // 停字幕爆 + 清字节点
      try { stopDirector(); } catch (e) {}                                                          // 停导演运镜定时器
      try { if (rec) { listening = false; rec.onend = null; rec.stop(); } } catch (e) {}           // 停语音识别(放麦)
      try { agStopRecord(micBtn); } catch (e) {}   // W1649 — 停 Talk 录音 → 触发 onstop 关掉 VAD AudioContext + 放麦(防 Safari AudioContext 泄漏累积崩)
      releaseRec();                                                                                 // 停录制 + 释放画布/音频图
      try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}   // 停摄像头
      try { video.srcObject = null; } catch (e) {}                                                 // 释放视频内存
      if (audio) { try { audio.pause(); audio.src = ""; } catch (e) {} audio = null; }             // 停音频 + 释放
      try { if (_bgGuardTimer) { clearInterval(_bgGuardTimer); _bgGuardTimer = 0; } } catch (e) {}   // 停后台媒体守卫
      try { _pausedMedia.forEach(function (m) { try { if (m.__cssosF2fMuted) { m.muted = false; delete m.__cssosF2fMuted; } } catch (e2) {} try { var pr = m.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e3) {} }); _pausedMedia = []; } catch (e) {}   // W1627 — 还原静音 + 续播后台媒体
      stream = null; rec = null; ov.remove();
    }
    ov.querySelector(".ag-f2f-x").onclick = close;
    var meTile = ov.querySelector(".ag-f2f-me");
    var pipPos = null;   // 画中画被拖到的位置(px), null=默认右下角
    var pipSize = null;  // W1695 — 画中画被缩放后的尺寸(px), null=默认 CSS 尺寸
    function layout() {
      var sp = stage.getAttribute("data-speaker");
      var big = (sp === "me") ? meTile : actorTile, pip = (sp === "me") ? actorTile : meTile;
      ["left", "top", "right", "bottom", "width", "height"].forEach(function (k) { big.style[k] = ""; });   // 大屏清内联 → 走 CSS inset
      if (pipPos) { pip.style.left = pipPos.left + "px"; pip.style.top = pipPos.top + "px"; pip.style.right = "auto"; pip.style.bottom = "auto"; }
      else { pip.style.left = pip.style.top = pip.style.right = pip.style.bottom = ""; }
      // W1695 — 缩放后的尺寸【跟着 PiP 这个角色走】, 而不是跟着某个 tile。交换后仍是小屏的尺寸。
      if (pipSize) { pip.style.width = pipSize.w + "px"; pip.style.height = pipSize.h + "px"; }
      else { pip.style.width = pip.style.height = ""; }
    }
    /* W1695 — Jing「小屏总是瘦瘦高高的, 能不能像 FaceTime 一样改尺寸? 但不可和大屏一样大,
     *   小屏永远在大屏里」。左上角抓手, 往左上拖变大。三条硬约束:
     *     ① 上限 = 舞台的 45% 宽/高 —— 永远小于大屏, 绝不会"一样大"。
     *     ② 下限 90×110 —— 不会缩成看不见的一粒。
     *     ③ 缩放后仍夹在舞台内(默认锚右下角; 若拖过就按 left/top 夹)。
     *   尺寸存在 pipSize 里, 由 layout() 在每次 speaker 交换后重新贴到【新的小屏】上。 */
    function resizeTile(tile, isActor) {
      var g = tile.querySelector(".ag-f2f-grip");
      if (!g) return;
      var rz = false, sx = 0, sy = 0, sw = 0, sh = 0;
      g.addEventListener("pointerdown", function (e) {
        var sp = stage.getAttribute("data-speaker");
        if (!((sp === "me") ? isActor : !isActor)) return;   // 只有【当前小屏】可缩放
        rz = true; sx = e.clientX; sy = e.clientY;
        var r = tile.getBoundingClientRect(); sw = r.width; sh = r.height;
        tile.style.transition = "none";
        try { g.setPointerCapture(e.pointerId); } catch (er) {}
        e.preventDefault(); e.stopPropagation();
      });
      g.addEventListener("pointermove", function (e) {
        if (!rz) return;
        var st = stage.getBoundingClientRect();
        var w = sw + (sx - e.clientX), h = sh + (sy - e.clientY);   // 往左上拖 = 变大
        w = Math.max(90, Math.min(st.width * 0.45, w));
        h = Math.max(110, Math.min(st.height * 0.45, h));
        pipSize = { w: Math.round(w), h: Math.round(h) };
        tile.style.width = pipSize.w + "px"; tile.style.height = pipSize.h + "px";
        if (pipPos) {   // 已被拖走 → 夹回舞台内
          pipPos.left = Math.max(0, Math.min(st.width - pipSize.w, pipPos.left));
          pipPos.top = Math.max(0, Math.min(st.height - pipSize.h, pipPos.top));
          tile.style.left = pipPos.left + "px"; tile.style.top = pipPos.top + "px";
        }
        e.preventDefault();
      });
      function endRz(e) {
        if (!rz) return; rz = false;
        tile.style.transition = "";
        try { g.releasePointerCapture(e.pointerId); } catch (er) {}
      }
      g.addEventListener("pointerup", endRz);
      g.addEventListener("pointercancel", endRz);
    }
    var namesEl = ov.querySelector(".ag-f2f-names");
    var myName = T("You", "你");
    var f2fIcon = '<svg class="ag-f2f-ic" viewBox="0 0 28 20" aria-hidden="true"><circle cx="5" cy="8" r="3.2" fill="#FF5A5A"/><path d="M0.5 18c0-3 2-4.6 4.5-4.6S9.5 15 9.5 18z" fill="#FF5A5A"/><circle cx="23" cy="8" r="3.2" fill="#3E8BFF"/><path d="M18.5 18c0-3 2-4.6 4.5-4.6S27.5 15 27.5 18z" fill="#3E8BFF"/><rect x="10.5" y="3.5" width="7" height="5" rx="2.5" fill="#fff"/></svg>';
    function updateTitle() {   // 谁大屏(说话)谁的名字在前; 中间是「两人对话」图标。
      if (!namesEl) return;
      var actorBig = stage.getAttribute("data-speaker") !== "me";
      var first = actorBig ? name : myName, second = actorBig ? myName : name;
      namesEl.innerHTML = '<span class="ag-f2f-n">' + esc(first) + '</span>' + f2fIcon + '<span class="ag-f2f-n">' + esc(second) + '</span>';
    }
    function setSpeaker(w) {
      var prev = stage.getAttribute("data-speaker");
      stage.setAttribute("data-speaker", w);
      try { actorTile.style.transform = ""; meTile.style.transform = ""; } catch (e) {}
      layout(); updateTitle();
      /* W1691 — Jing「切换视图时大屏闪过就缩成小屏, 两个都成小屏」根因: W1641 导演的「两人镜」
       * 分支会把大屏缩到 0.52 倍、小窗放到 1.7 倍, 尺寸被拉平。它若恰好落在一次切换之后, 就把
       * 用户刚做的「谁大谁小」当场抹掉。治本: 每次切换都重排导演时钟并强制归位一段时间 ——
       * 先把大小屏这件事说清楚, 镜头语言随后再来。运镜绝不盖过用户刚做的切换。 */
      if (prev !== w) { _holdUntil = Date.now() + 2600; stopDirector(); startDirector(); }
    }
    updateTitle();
    // ===== W1641 导演: 纯 transform 随机多视角运镜(不动布局盒 → 不与 data-speaker 尺寸 / 拖拽冲突)。
    //   视角 / 时机 / 过渡【全随机、绝不模板化】: 每次连续随机 scale/translate/rotate/焦点/缓动/时长。
    //   情绪字幕正在爆时(_burstUntil 窗口内)【不切镜】, 延后到爆完 —— 切镜绝不打断正在炸开的情绪字幕。 =====
    var _burstUntil = 0, _dirTimer = null;
    var _holdUntil = 0;   // W1691 — speaker 刚切换 → 在此时间前不许运镜(先把大小屏说清楚)
    function _dr(a, b) { return a + Math.random() * (b - a); }
    var _EZ = ["cubic-bezier(.4,0,.2,1)", "cubic-bezier(.22,1,.36,1)", "cubic-bezier(.65,0,.35,1)", "cubic-bezier(.16,1,.3,1)", "ease-in-out"];
    function applyShot() {
      if (!actorTile || !meTile) return;
      var speakerActor = stage.getAttribute("data-speaker") !== "me";
      var big = speakerActor ? actorTile : meTile, small = speakerActor ? meTile : actorTile;
      var dur = _dr(0.7, 1.5).toFixed(2), ez = _EZ[Math.floor(Math.random() * _EZ.length)];
      big.style.transition = "transform " + dur + "s " + ez;
      small.style.transition = "transform " + dur + "s " + ez;
      var fam = Math.random();
      if (fam < 0.14) {                       // 归位: 平稳无角度(留白, 免得一直炫)
        big.style.transformOrigin = "50% 50%"; big.style.transform = "scale(1)"; small.style.transform = "scale(1)";
      } else if (fam < 0.40) {                // 两人镜: 大屏缩小让出演播厅, 双方并置端坐
        big.style.transformOrigin = "50% 50%";
        // W1691 — 收窄幅度: 原 big 0.52–0.66 / small 1.28–1.70 会把大小屏拉平, 层级消失。
        //   两人并置的镜头语言保留, 但【大屏永远还是大屏】—— 这是这块界面的基本可读性。
        big.style.transform = "translate(" + _dr(-20, -10).toFixed(1) + "%," + _dr(-5, 5).toFixed(1) + "%) scale(" + _dr(0.74, 0.86).toFixed(2) + ") rotate(" + _dr(-1.6, 1.6).toFixed(2) + "deg)";
        small.style.transform = "translate(" + _dr(7, 18).toFixed(1) + "%," + _dr(-7, 3).toFixed(1) + "%) scale(" + _dr(1.10, 1.30).toFixed(2) + ") rotate(" + _dr(-1.6, 1.6).toFixed(2) + "deg)";
      } else if (fam < 0.66) {                // 推近 push-in + 随机焦点
        big.style.transformOrigin = _dr(28, 72).toFixed(0) + "% " + _dr(26, 62).toFixed(0) + "%";
        big.style.transform = "scale(" + _dr(1.03, 1.13).toFixed(3) + ") rotate(" + _dr(-1, 1).toFixed(2) + "deg)";
        small.style.transform = "scale(" + _dr(0.94, 1.05).toFixed(2) + ") rotate(" + _dr(-2, 2).toFixed(2) + "deg)";
      } else if (fam < 0.85) {                // 斜角 Dutch tilt + 轻推
        big.style.transformOrigin = "50% 55%";
        big.style.transform = "scale(" + _dr(1.01, 1.08).toFixed(3) + ") rotate(" + _dr(-3.2, 3.2).toFixed(2) + "deg) translate(" + _dr(-3, 3).toFixed(1) + "%," + _dr(-2, 2).toFixed(1) + "%)";
        small.style.transform = "scale(" + _dr(0.95, 1.06).toFixed(2) + ") rotate(" + _dr(-3, 3).toFixed(2) + "deg)";
      } else {                                // 越肩 / 焦点转移: 小窗放大成前景, 大屏稍退
        big.style.transformOrigin = _dr(30, 70).toFixed(0) + "% 50%";
        big.style.transform = "scale(" + _dr(0.9, 1.0).toFixed(2) + ") translate(" + _dr(-6, 6).toFixed(1) + "%,0) rotate(" + _dr(-1.5, 1.5).toFixed(2) + "deg)";
        small.style.transform = "scale(" + _dr(1.15, 1.5).toFixed(2) + ") translate(" + _dr(-8, 0).toFixed(1) + "%," + _dr(-4, 4).toFixed(1) + "%) rotate(" + _dr(-2, 2).toFixed(2) + "deg)";
      }
    }
    function scheduleShot() {
      var delay = _dr(3500, 8000);
      _dirTimer = setTimeout(function tick() {
        if (Date.now() < _burstUntil || Date.now() < _holdUntil) { _dirTimer = setTimeout(tick, 700); return; }   // 情绪字幕正在爆 / 刚切过视图 → 延后切镜
        applyShot(); scheduleShot();
      }, delay);
    }
    function startDirector() { if (_dirTimer) return; scheduleShot(); }
    function stopDirector() { if (_dirTimer) { clearTimeout(_dirTimer); _dirTimer = null; } }
    startDirector();
    fetch("/api/me", { credentials: "include" }).then(function (r) { return r.json(); }).then(function (j) { var dn = (j && (j.display_name || (j.user && j.user.display_name) || j.name)) || ""; if (dn) { myName = dn; updateTitle(); } }).catch(function () {});
    function dragTile(tile, isActor) {
      var d = false, sx = 0, sy = 0, sl = 0, st = 0;
      tile.addEventListener("pointerdown", function (e) {
        var sp = stage.getAttribute("data-speaker");
        if (!((sp === "me") ? isActor : !isActor)) return;   // 只拖【当前画中画】那个
        d = true; sx = e.clientX; sy = e.clientY; var r = tile.getBoundingClientRect(); sl = r.left; st = r.top;
        tile.style.transition = "none";   // 拖拽时关过渡, 跟手
        try { tile.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault();
      });
      tile.addEventListener("pointermove", function (e) {
        if (!d) return;
        pipPos = { left: Math.max(4, sl + (e.clientX - sx)), top: Math.max(4, st + (e.clientY - sy)) };
        tile.style.left = pipPos.left + "px"; tile.style.top = pipPos.top + "px"; tile.style.right = "auto"; tile.style.bottom = "auto";
      });
      tile.addEventListener("pointerup", function (e) { d = false; tile.style.transition = ""; try { tile.releasePointerCapture(e.pointerId); } catch (er) {} });
    }
    dragTile(actorTile, true); dragTile(meTile, false);
    // W1695 — 给两个 tile 各挂一个缩放抓手; CSS 只让【当前小屏】那个显示出来。
    [[actorTile, true], [meTile, false]].forEach(function (pair) {
      var g = document.createElement("div");
      g.className = "ag-f2f-grip";
      g.title = T("Drag to resize", "拖动改变大小");
      pair[0].appendChild(g);
      resizeTile(pair[0], pair[1]);
    });
    // 摄像头(首次弹权限, 之后记住; 拒绝则占位)。
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }).then(function (s) {
        stream = s; video.srcObject = s; video.muted = true; video.autoplay = true; video.playsInline = true; video.setAttribute("playsinline", "");
        var tryPlay = function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); };
        video.onloadedmetadata = tryPlay;
        video.onpause = function () { if (video.srcObject) tryPlay(); };   // Safari 偶尔暂停 → 立即续播(治冻帧)
        tryPlay(); setTimeout(tryPlay, 300); setTimeout(tryPlay, 1200);   // 多次 nudge
      }).catch(function () { ov.querySelector(".ag-f2f-me").classList.add("ag-f2f-nocam"); });
    } else { ov.querySelector(".ag-f2f-me").classList.add("ag-f2f-nocam"); }
    function lip(aud, tokens) {
      var raf = 0, _lt = 0;   // W1643 — 节流到 ~30fps: 逐帧 setProperty(--lip) 会触发全 --lip 用户样式重算, 聊天+录制并发时砍一半开销。
      function stop() { cancelAnimationFrame(raf); actorTile.style.setProperty("--lip", "0"); actorTile.classList.remove("speaking"); }
      function tick() {
        if (aud.paused || aud.ended) { stop(); return; }
        raf = requestAnimationFrame(tick);
        var ms = Date.now(); if (ms - _lt < 33) return; _lt = ms;
        var now = aud.currentTime * 1000, open = 0;
        if (tokens && tokens.length) { for (var i = 0; i < tokens.length; i++) { var tk = tokens[i]; if (now >= tk.t_start && now < tk.t_end) { open = Math.sin(((now - tk.t_start) / Math.max(1, tk.t_end - tk.t_start)) * Math.PI); break; } } }
        actorTile.style.setProperty("--lip", open.toFixed(3));
      }
      aud.addEventListener("ended", stop); aud.addEventListener("pause", stop);
      raf = requestAnimationFrame(tick);
    }
    function lipClock(startMs, durMs, tokens) {   // 无 currentTime 的对口型(录制用 WebAudio BufferSource, 靠时钟)。
      var raf = 0, _lt = 0;
      function stop() { cancelAnimationFrame(raf); actorTile.style.setProperty("--lip", "0"); actorTile.classList.remove("speaking"); }
      function tick() {
        var now = Date.now() - startMs, open = 0;
        if (now > durMs) { stop(); return; }
        raf = requestAnimationFrame(tick);
        var ms = Date.now(); if (ms - _lt < 33) return; _lt = ms;
        if (tokens && tokens.length) { for (var i = 0; i < tokens.length; i++) { var tk = tokens[i]; if (now >= tk.t_start && now < tk.t_end) { open = Math.sin(((now - tk.t_start) / Math.max(1, tk.t_end - tk.t_start)) * Math.PI); break; } } }
        actorTile.style.setProperty("--lip", open.toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    }
    // ── #4 情绪字幕(招牌): 底部保留【传统整句字幕】+ 叠加平台【情绪字幕爆】(大字从字心炸开 + 主题 emoji,
    //   复用 MV 引擎 cssosLineBurstWord)。逐字随 TTS 时间轴爆; 换句 fade 上句; 停/关 cssosClearAllBurstFx 硬清空。
    //   内存红线: 用引擎自带的硬清空(它就是为"连播累积上千 SPAN → OOM"造的)。
    var subCancel = null;
    function boostFx() {   // 情绪爆/天女散花/字心烟花 三层顶到同框(z 2147483000)之上 + 强制显示(行内!important 压过隐藏规则)。
      [["cssfx-center-burst", "flex"], ["cssfx-confetti", "block"], ["cssfx-spark", "block"]].forEach(function (p) {
        var el = document.getElementById(p[0]);
        if (el && !el.__f2fBoost) { el.__f2fBoost = 1; el.style.setProperty("z-index", "2147483600", "important"); el.style.setProperty("display", p[1], "important"); }
      });
    }
    function unboostFx() {
      ["cssfx-center-burst", "cssfx-confetti", "cssfx-spark"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.__f2fBoost = 0; el.style.removeProperty("z-index"); el.style.removeProperty("display"); }
      });
    }
    function emoInten(e) { var m = { anger: 0.9, joy: 0.82, playful: 0.8, awe: 0.78, fear: 0.72, sadness: 0.6, tender: 0.6 }; return m[String(e || "").toLowerCase()] || 0.62; }
    function stopSubtitle() {
      if (subCancel) { try { subCancel(); } catch (e) {} subCancel = null; }
      caption.textContent = ""; caption.className = "ag-f2f-caption";
      try { if (window.cssosFadeBurstLine) window.cssosFadeBurstLine(); } catch (e) {}
      try { if (window.cssosClearAllBurstFx) window.cssosClearAllBurstFx(); } catch (e) {}   // 硬清空爆层 → 释放内存
      unboostFx();
    }
    function splitSentences(t) {   // 句子切分 + 超长硬断(≤30 字)。
      var out = [], s = 0, n = t.length;
      for (var i = 0; i < n; i++) { if (/[。！？!?\n]/.test(t[i]) || (i - s) >= 30) { out.push([s, i + 1]); s = i + 1; } }
      if (s < n) out.push([s, n]);
      return out.filter(function (r) { return t.slice(r[0], r[1]).trim(); });
    }
    function tailSentence(t) { var s = splitSentences(t); return s.length ? t.slice(s[s.length - 1][0]) : t; }
    var _CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;
    function burstTokens(text, s, e) {   // 爆发单元: CJK 单字爆, 拉丁【整词】爆(不再一个字母一个字母)。含各自起始字符索引(取时间用)。
      var out = [], i = s;
      while (i < e) {
        var ch = text.charAt(i);
        if (/\s/.test(ch)) { i++; continue; }                       // 跳空白
        if (_CJK.test(ch)) { out.push({ t: ch, at: i }); i++; }      // CJK 单字
        else { var j = i; while (j < e && !/\s/.test(text.charAt(j)) && !_CJK.test(text.charAt(j))) j++; out.push({ t: text.slice(i, j), at: i }); i = j; }   // 拉丁/其它连续 = 一整词
      }
      return out;
    }
    function startSubtitle(text, tokens, getTimeMs, emotion) {
      stopSubtitle();
      text = String(text || ""); if (!text) return;
      var toks = (tokens && tokens.length === text.length) ? tokens : null;   // 对齐才用真时间轴, 否则自计时
      var SP = 62, t0 = null, inten = emoInten(emotion);
      var clock = getTimeMs || function () { if (t0 === null) t0 = Date.now(); return Date.now() - t0; };
      function tStart(i) { return toks ? toks[i].t_start : i * SP; }
      var sents = splitSentences(text);
      if (!sents.length) return;
      caption.className = "ag-f2f-caption";   // 底部 = 传统整句字幕(纯)
      var seq = (window.__f2fBurstSeq = (window.__f2fBurstSeq || 0) + 1);
      var cur = -1, raf = 0, curTok = [], tfired = {};
      function tick() {
        var now = clock(), si = 0;
        for (var k = 0; k < sents.length; k++) { if (tStart(sents[k][0]) <= now + 1) si = k; else break; }
        if (si !== cur) {   // 换句: 底部整句替换(上句消失) + 重算本句爆发单元 + 撒一次天女散花
          caption.textContent = text.slice(sents[si][0], sents[si][1]).replace(/^\s+/, ""); cur = si;
          curTok = burstTokens(text, sents[si][0], sents[si][1]); tfired = {};
          try { if (window.cssosEmotionConfettiBurst) { window.cssosEmotionConfettiBurst(emotion || "", Math.min(1, inten + 0.15)); boostFx(); } } catch (e) {}
        }
        // 情绪字幕爆: 本句每个【单元(CJK 单字 / 拉丁整词)】到点即从字心炸开; 整句累积, 换句时一起淡出。
        var lineKey = "f2f-" + seq + "-" + si;
        for (var ti = 0; ti < curTok.length; ti++) {
          if (!tfired[ti] && tStart(curTok[ti].at) <= now) {
            tfired[ti] = 1;
            if (typeof window.cssosLineBurstWord === "function") { try { window.cssosLineBurstWord(lineKey, ti, curTok.length, curTok[ti].t, emotion || "", inten); boostFx(); _burstUntil = Date.now() + 1500; } catch (e2) {} }   // W1641 — 情绪字幕正在爆 → 未来 1.5s 内导演不切镜
          }
        }
        var lastT = toks ? toks[toks.length - 1].t_end : text.length * SP;
        if (now > lastT + 700) { stopSubtitle(); return; }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      subCancel = function () { cancelAnimationFrame(raf); };
    }
    function playPlain(url, tokens, text, emotion) {   // 常规: <audio> 元素播放(不录制时走这条)。
      if (audio) { try { audio.pause(); audio.src = ""; audio.load(); } catch (e) {} audio = null; }   // 完整释放旧音频(防累积)
      audio = new Audio(url); setSpeaker("actor"); actorTile.classList.add("speaking");
      audio.onended = function () { actorTile.classList.remove("speaking"); micPaused = false; };   // 演员说完 → 恢复收音
      audio.play().catch(function () { actorTile.classList.remove("speaking"); micPaused = false; });
      lip(audio, tokens || []);
      startSubtitle(text, tokens, function () { return audio.currentTime * 1000; }, emotion);   // 字幕跟声音爆
    }
    function playForRecord(url, tokens, text, emotion) {   // 录制中: WebAudio 播放, 声音进录制流(BufferSource)。
      setSpeaker("actor"); actorTile.classList.add("speaking");
      fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (ab) { return recAC.decodeAudioData(ab); }).then(function (buf) {
        if (!recAC) throw new Error("closed");
        var src = recAC.createBufferSource(); src.buffer = buf;
        src.connect(recAC.destination); if (recDest) src.connect(recDest);   // 扬声器 + 录制流
        var t0 = Date.now();
        src.onended = function () { actorTile.classList.remove("speaking"); actorTile.style.setProperty("--lip", "0"); micPaused = false; };
        src.start();
        lipClock(t0, buf.duration * 1000, tokens || []);
        startSubtitle(text, tokens, function () { return Date.now() - t0; }, emotion);
      }).catch(function () { playPlain(url, tokens, text, emotion); });   // 跨域取不到 → 退回普通播放
    }
    function afterReply(full, emotion) {
      if (full) { history.push({ role: "assistant", content: full }); lastA = full; }
      busy = false; sendBtn.disabled = false;
      if (!full) { micPaused = false; return; }
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/say", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: full, emotion: emotion || "" }) })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (!j || j.code === "RATE_LIMIT") { micPaused = false; startSubtitle(full, [], null, emotion); return; }   // 无声也逐字爆(自计时)
          var _nb = j.data && j.data.billing;   // W1634 — 柔性额度提醒(演员口吻底部闪现)
          if (_nb && _nb.nudge) { try { var _fl = document.createElement("div"); _fl.className = "ag-f2f-flash"; _fl.textContent = (_nb.nudge === "last_free" ? T("(That was our last free voice this month — add a little and I'll keep speaking; our words stay free.)", "(这月你我最后一句有声之言了 —— 添一炷香火,我便续说;文字之交不断。)") : _nb.nudge === "balance" ? T("(My voice needs a little credit to go on — top up to hear me; text stays free.)", "(我的声音需一点香火方能再续 —— 充值即可听我说话;文字永远免费。)") : T("(Sign in and top up to hear me speak — text is always free.)", "(登录并充值,便可听我说话 —— 文字永远免费。)")); try { _fl.appendChild(agNudgeLink(_nb.nudge)); } catch (_e2) {} stage.appendChild(_fl); setTimeout(function () { try { _fl.remove(); } catch (_e) {} }, 12000); } catch (_e) {} }
          var url = j.data && j.data.voice_url; if (!url) { micPaused = false; startSubtitle(full, [], null, emotion); return; }
          var tokens = (j.data && j.data.tokens) || [];
          if (recording && recAC) playForRecord(url, tokens, full, emotion); else playPlain(url, tokens, full, emotion);
        }).catch(function () { micPaused = false; startSubtitle(full, [], null, emotion); });
    }
    function ask(text) {
      if (busy) return; busy = true; micPaused = true; sendBtn.disabled = true;
      if (text) { history.push({ role: "user", content: text }); lastQ = text; }
      stopSubtitle(); caption.textContent = "…"; var full = "", emo = "";
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/ask", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "text/event-stream" }, body: JSON.stringify({ mode: "modern", uiLocale: uiLoc, messages: history }) })
        .then(function (resp) {
          if (!resp.body || !resp.body.getReader) { return resp.json().then(function (j) { full = (j && j.data && (j.data.full || j.data.reply)) || ""; emo = (j && j.data && j.data.emotion) || ""; caption.textContent = tailSentence(full); afterReply(full, emo); }); }
          var reader = resp.body.getReader(), dec = new TextDecoder(), buf = ""; caption.textContent = "";
          function pump() {
            return reader.read().then(function (r2) {
              if (r2.done) { afterReply(full, emo); return; }
              buf += dec.decode(r2.value, { stream: true }); var nl;
              while ((nl = buf.indexOf("\n\n")) >= 0) {
                var blk = buf.slice(0, nl); buf = buf.slice(nl + 2); var dl = null, parts = blk.split("\n");
                for (var i = 0; i < parts.length; i++) { if (parts[i].indexOf("data:") === 0) { dl = parts[i]; break; } }
                if (!dl) continue; var js = dl.slice(5).trim(); if (!js) continue; var ev; try { ev = JSON.parse(js); } catch (e) { continue; }
                if (ev.delta) { full += ev.delta; caption.textContent = tailSentence(full); }   // 生成期只显尾句(不盖脸)
                else if (ev.done) { if (ev.full) { full = ev.full; caption.textContent = tailSentence(full); } if (ev.emotion) emo = ev.emotion; if (ev.billing && ev.billing.nudge) { try { var _nl = document.createElement("div"); _nl.className = "ag-f2f-flash"; _nl.appendChild(agNudgeLink(ev.billing.nudge)); stage.appendChild(_nl); setTimeout(function () { try { _nl.remove(); } catch (_e) {} }, 12000); } catch (_e) {} } }   // W1638 柔性提醒可点链接
              }
              return pump();
            });
          }
          return pump();
        }).catch(function () { afterReply(full, emo); });
    }
    function submit() { var t = (input.value || "").trim(); if (!t) return; input.value = ""; ask(t); }
    input.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };
    // 底栏单轨道走平台凸嵌凹胶囊(cssosMakePillBar), onActivate 按 key 派发(say=输入, 点击只聚焦不派发动作)。
    var f2fTrack = ov.querySelector(".ag-f2f-track"), f2fCtl = null;
    function f2fDispatch(key) {
      if (key === "mic") { if (listening) stopListening(); else startListening(); }
      else if (key === "rec") { if (recording) stopRec(); else startRec(); }
      else if (key === "speak") submit();
      else if (key === "say") { try { input.focus(); } catch (e) {} }
    }
    if (f2fTrack && typeof window.cssosMakePillBar === "function") {
      try { f2fCtl = window.cssosMakePillBar(f2fTrack, { mono: true, compact: true, textColor: "light", onActivate: f2fDispatch }); } catch (e) {}
    }
    // W1637 (C) — 点麦克风开始录音(Safari 支持 MediaRecorder), 再点停止 → 上传 Whisper 转写 →
    //   我(用户)的话逐字爆情绪字幕 + 发给演员。取代 Safari 没有的 webkitSpeechRecognition。
    function startListening() {
      if (listening) return;
      listening = true; micBtn.classList.add("rec"); var _mi1 = micBtn.querySelector(".ag-f2f-mic-ic"); if (_mi1) _mi1.textContent = "🔴"; setSpeaker("me");
      agStartRecord(micBtn, "", function (t) {   // W1650 — 不强制语言 → Whisper 自动检测(你说中文 UI 是英文时, 强制 en 会转成空 "Didn't catch that")
        try { startSubtitle(t, null, null, ""); } catch (e) {}   // W1611 我说的话也爆情绪字幕
        ask(t);
      }, function (state) {
        var _mi2 = micBtn.querySelector(".ag-f2f-mic-ic");
        if (state === "recording") { f2fFlash(T("Listening… just speak, then pause.", "在听…说完停顿一下就发。")); return; }
        if (state === "transcribing") { if (_mi2) _mi2.textContent = "💬"; return; }   // 识别中
        listening = false; micBtn.classList.remove("rec"); if (_mi2) _mi2.textContent = "🎤"; if (state !== "done") setSpeaker("actor");
        if (state === "signin") f2fFlash(T("Sign in to talk by voice — text stays free.", "登录后即可语音对话 —— 文字免费。"));
        else if (state === "denied" || state === "unsupported") f2fFlash(T("Microphone unavailable.", "麦克风不可用。"));
        else if (state === "ratelimit") f2fFlash(T("Too many voice inputs — try again shortly.", "语音输入过于频繁,稍后再试。"));
        else if (state === "empty") f2fFlash(T("Didn't catch that — try again.", "没听清,再说一次。"));
        else if (state === "error") f2fFlash(T("Voice input failed — try again.", "语音识别出错,再试一次。"));
      });
    }
    function stopListening() {
      if (agIsRecording(micBtn)) { agStopRecord(micBtn); return; }   // 录音中 → 停止 → 触发转写
      listening = false; micBtn.classList.remove("rec"); var _mi3 = micBtn.querySelector(".ag-f2f-mic-ic"); if (_mi3) _mi3.textContent = "🎤"; setSpeaker("actor");
    }
    if (micBtn && !f2fCtl) micBtn.onclick = function () { f2fDispatch("mic"); };

    // ── B 档: 录制同框片段 → 上传 → 生成可分享的社交视频卡(og:video)。────────
    function f2fFlash(msg) {   // 轻量提示条(3s 自动消失)。
      var t = document.createElement("div"); t.className = "ag-f2f-flash"; t.textContent = msg;
      ov.appendChild(t); setTimeout(function () { try { t.remove(); } catch (e) {} }, 3000);
    }
    function recMime() {
      var cands = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
      if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
      for (var i = 0; i < cands.length; i++) { if (MediaRecorder.isTypeSupported(cands[i])) return cands[i]; }
      return "";
    }
    function drawFit(src, sw, sh, x, y, w, h) {   // object-fit: cover, 裁到 (x,y,w,h)。
      if (!sw || !sh) { recG.fillStyle = "#0b1f16"; recG.fillRect(x, y, w, h); return; }
      var ir = sw / sh, rr = w / h, dw, dh; if (ir > rr) { dh = h; dw = h * ir; } else { dw = w; dh = w / ir; }
      var dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
      recG.save(); recG.beginPath(); recG.rect(x, y, w, h); recG.clip(); recG.drawImage(src, dx, dy, dw, dh); recG.restore();
    }
    function wrapText(txt, x, y, maxW, lh, maxLines) {
      var words = String(txt || "").split(/(\s+)/), line = "", lines = [];
      for (var i = 0; i < words.length; i++) { var test = line + words[i]; if (recG.measureText(test).width > maxW && line) { lines.push(line); line = words[i].replace(/^\s+/, ""); } else line = test; }
      if (line) lines.push(line);
      if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1,3}$/, "…"); }
      for (var k = 0; k < lines.length; k++) recG.fillText(lines[k], x, y + k * lh);
    }
    function drawRec() {
      if (!recording || !recG) return;
      var W = recCanvas.width, H = recCanvas.height, s = W / 1280;   // 分辨率自适应(360p 时 s=0.5)
      var sp = stage.getAttribute("data-speaker"), actorBig = sp !== "me";
      recG.fillStyle = "#04120c"; recG.fillRect(0, 0, W, H);
      // 大屏 = 当前说话者; 画中画 = 另一方(右下角)。
      if (actorBig) drawFit(coverImg, coverImg && coverImg.naturalWidth, coverImg && coverImg.naturalHeight, 0, 0, W, H);
      else drawFit(video, video.videoWidth, video.videoHeight, 0, 0, W, H);
      var pw = 300 * s, ph = 169 * s, m = 28 * s, px = W - pw - m, py = H - ph - m;
      recG.save(); recG.strokeStyle = "rgba(0,245,160,.9)"; recG.lineWidth = Math.max(1, 3 * s);
      if (actorBig) drawFit(video, video.videoWidth, video.videoHeight, px, py, pw, ph);
      else drawFit(coverImg, coverImg && coverImg.naturalWidth, coverImg && coverImg.naturalHeight, px, py, pw, ph);
      recG.strokeRect(px, py, pw, ph); recG.restore();
      // 标题(左上) + 品牌(右上)。
      recG.textBaseline = "top"; recG.fillStyle = "#eafff6"; recG.font = "700 " + Math.round(34 * s) + "px system-ui,-apple-system,sans-serif";
      recG.fillText((actorBig ? name : myName) + "  ·  Face on Face", 34 * s, 28 * s);
      recG.textAlign = "right"; recG.fillStyle = "rgba(0,245,160,.9)"; recG.font = "700 " + Math.round(24 * s) + "px system-ui,sans-serif";
      recG.fillText("cssOS · 问道", W - 30 * s, 32 * s); recG.textAlign = "left";
      // 字幕(底部, 半透明衬底)。
      var cap = (caption.textContent || "").trim();
      if (cap) {
        recG.font = "600 " + Math.round(30 * s) + "px system-ui,-apple-system,sans-serif";
        recG.fillStyle = "rgba(3,14,9,.55)"; recG.fillRect(28 * s, H - 132 * s, W - 56 * s - pw - 20 * s, 104 * s);
        recG.fillStyle = "#ffffff"; recG.textBaseline = "alphabetic";
        wrapText(cap, 48 * s, H - 92 * s, W - 96 * s - pw - 20 * s, 38 * s, 2);
      }
    }
    // W1614 — 录制绘制节流到 ~30fps(captureStream(30) 本就按 30 采样, 画 60 白费一半)→ 录制+聊天并发时砍一半绘制开销, 画质零损失。
    var _lastDrawTs = 0;
    function drawLoop(ts) {
      if (!recording) return;
      var now = ts || (window.performance ? performance.now() : 0);
      if (now - _lastDrawTs >= 32) { _lastDrawTs = now; drawRec(); }
      recRaf = requestAnimationFrame(drawLoop);
    }
    function startRec() {
      if (recording) return;
      if (recMime() === "" && typeof MediaRecorder === "undefined") { f2fFlash(T("Recording isn’t supported on this browser.", "此浏览器不支持录制。")); return; }
      // 分享小窗只是引子(勾用户点链接进平台看高清正片)→ 低分辨率省内存/上传。360p 即可。
      recCanvas = document.createElement("canvas"); recCanvas.width = 640; recCanvas.height = 360; recG = recCanvas.getContext("2d");
      coverImg = new Image(); coverImg.crossOrigin = "anonymous"; coverImg.src = cover;   // 封面同源 → 不污染画布
      try { recAC = new (window.AudioContext || window.webkitAudioContext)(); recDest = recAC.createMediaStreamDestination(); } catch (e) { recAC = null; recDest = null; }
      var vs = recCanvas.captureStream(30), tracks = vs.getVideoTracks();
      if (recDest) recDest.stream.getAudioTracks().forEach(function (t) { tracks.push(t); });
      var mstream = (typeof MediaStream !== "undefined") ? new MediaStream(tracks) : vs;
      var mime = recMime();
      var mrOpts = { videoBitsPerSecond: 800000, audioBitsPerSecond: 64000 };   // 360p 引子码率 → 90s≈9MB, 内存/上传都轻
      if (mime) mrOpts.mimeType = mime;
      try { mediaRec = new MediaRecorder(mstream, mrOpts); } catch (e) { try { mediaRec = new MediaRecorder(mstream); } catch (e2) { f2fFlash(T("Recording failed to start.", "录制启动失败。")); releaseRec(); resetRecBtn(); return; } }
      recChunks = [];
      mediaRec.ondataavailable = function (ev) { if (ev.data && ev.data.size) recChunks.push(ev.data); };
      mediaRec.onstop = function () { finishRec(); };
      recording = true; _agF2fRec = true; try { mediaRec.start(1000); } catch (e) {}   // 1s 分片 → 内存有界
      drawLoop();
      recBtn.classList.add("rec"); recBtn.innerHTML = '⏹ <span>' + esc(T("Stop", "停")) + '</span>';
      recTimer = setTimeout(function () { if (recording) stopRec(); }, 90000);   // 90s 上限, 护内存
      f2fFlash(T("Recording… up to 90s. Tap ⏹ to finish & share.", "录制中… 最长 90 秒。点 ⏹ 结束并分享。"));
    }
    function resetRecBtn() { if (!recBtn) return; recBtn.disabled = false; recBtn.classList.remove("rec"); recBtn.innerHTML = '⏺ <span>' + esc(T("Rec", "录")) + '</span>'; }
    function stopRec() {
      if (!recording) return; recording = false;
      if (recTimer) { clearTimeout(recTimer); recTimer = 0; }
      try { cancelAnimationFrame(recRaf); } catch (e) {}
      recBtn.disabled = true; recBtn.classList.remove("rec"); recBtn.innerHTML = '⏳';
      try { if (mediaRec && mediaRec.state !== "inactive") mediaRec.stop(); else finishRec(); } catch (e) { finishRec(); }
    }
    function finishRec() {
      var type = (mediaRec && mediaRec.mimeType) || "video/webm";
      var blob = recChunks.length ? new Blob(recChunks, { type: type }) : null;
      recChunks = []; try { if (recAC) recAC.close(); } catch (e) {} recAC = null; recDest = null; recG = null; recCanvas = null; coverImg = null; mediaRec = null;
      if (!blob || blob.size < 2048) { f2fFlash(T("Nothing recorded.", "没有录到内容。")); resetRecBtn(); return; }
      uploadClip(blob);
    }
    function uploadClip(blob) {
      f2fFlash(T("Uploading your clip…", "上传片段中…"));
      var fd = new FormData();
      fd.append("clip", blob, "faceonface." + (/mp4/.test(blob.type) ? "mp4" : "webm"));
      if (lastQ) fd.append("question", lastQ.slice(0, 500));
      if (lastA) fd.append("answer", lastA.slice(0, 800));
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/wendao/clip", { method: "POST", body: fd })
        .then(function (r) { return r.json(); }).then(function (j) {
          resetRecBtn();
          if (!j || !j.ok || !j.data || !j.data.url) { f2fFlash(T("Upload failed — try again.", "上传失败,请重试。")); return; }
          showClipResult(j.data.url, j.data.video_url);   // 持久结果卡: 预览(直链mp4) + 复制 + 分享
        }).catch(function () { resetRecBtn(); f2fFlash(T("Upload failed — try again.", "上传失败,请重试。")); });
    }
    // 录制成功后的【持久分享卡】: 两步 —— 结果视图(预览) ⇄ 平台分享卡(各社交平台, 可【返回上一步】)。
    function showClipResult(url, videoUrl) {
      var old = ov.querySelector(".ag-f2f-clip"); if (old) old.remove();
      var card = document.createElement("div"); card.className = "ag-f2f-clip";
      ov.appendChild(card);
      var vsrc = videoUrl || url;   // 预览用直链 mp4(video_url); 缺省退回 url
      var txt = name + " · Face on Face · 问道";
      function firstSent(s) { var m = String(s || "").match(/^[^。！？!?\n]*[。！？!?]?/); return (m ? m[0] : String(s || "")).trim().slice(0, 120); }
      // 分享文案 = 标题行 + 下方一段正文(有问答→带引子; 没有→号召文案)。让推文正文完整、勾人点进平台。
      var titleLine = name + " · Face on Face · " + T("Ask", "问道");
      var body = (lastQ && lastA)
        ? (T("I asked", "我问") + " " + name + ": " + String(lastQ).slice(0, 80) + " — " + name + ": “" + firstSent(lastA).slice(0, 90) + "”")
        : (T("I just went face to face with", "刚和") + " " + name + " " + T("on CSS Studio. Come talk with the legends of history — watch, then start your own conversation.", "在 CSS Studio 面对面聊了聊。来和历史人物对话吧 —— 看完,你也来聊。"));
      var shareText = titleLine + "\n\n" + body + " 🎬";
      function killVid() { var v = card.querySelector("video"); if (v) { try { v.pause(); v.src = ""; v.load(); } catch (e) {} } }
      function copyLink() { try { if (navigator.clipboard) navigator.clipboard.writeText(url); } catch (e) {} f2fFlash(T("Link copied.", "链接已复制。")); }
      // share-dialog 是按需动态加载模块(app.share-dialog.js)→ 先确保加载再调用(否则 cssosShareTo/openCssosShareDialog 未定义)。
      function ensureShare(cb) {
        if (typeof window.cssosShareTo === "function" && typeof window.openCssosShareDialog === "function") { cb(); return; }
        if (typeof window.cssosLoadPanel === "function") { try { window.cssosLoadPanel("share-dialog").then(cb).catch(function () { cb(); }); return; } catch (e) {} }
        cb();
      }
      function openFullShare() { ensureShare(function () { if (typeof window.openCssosShareDialog === "function") window.openCssosShareDialog({ url: url, title: name + " · Face on Face", text: shareText, headerLabel: T("Share this clip", "分享这段片段") }); else copyLink(); }); }
      // 图1 place2 — 按钮行走平台凸嵌凹胶囊(cssosMakePillBar), onActivate 按 key 派发。
      function pillifyBtns(dispatch) {
        var el = card.querySelector(".ag-f2f-clip-btns");
        if (el && typeof window.cssosMakePillBar === "function") { try { window.cssosMakePillBar(el, { mono: true, compact: true, textColor: "light", onActivate: dispatch }); } catch (e) {} }
        else if (el) { el.querySelectorAll("[data-pill-key]").forEach(function (b) { b.onclick = function () { dispatch(b.getAttribute("data-pill-key")); }; }); }
      }
      // 空间小 → 只放 8 个(Jing 指定); 其余走「More…」→ 平台旧全卡。
      // 【直接导航】各平台 intent 页(同步 window.open, 在点击手势内 → 不被 Safari 弹窗拦截)。
      var eu = encodeURIComponent(url), et = encodeURIComponent(shareText), etu = encodeURIComponent(shareText + "\n" + url);
      var TARGETS = [
        { label: "X", ic: "𝕏", u: "https://twitter.com/intent/tweet?text=" + et + "&url=" + eu },
        { label: "Facebook", ic: "f", u: "https://www.facebook.com/sharer/sharer.php?u=" + eu },
        { label: "BlueSky", ic: "🦋", u: "https://bsky.app/intent/compose?text=" + etu },
        { label: "Threads", ic: "@", u: "https://www.threads.net/intent/post?text=" + etu },
        { label: "LinkedIn", ic: "in", u: "https://www.linkedin.com/sharing/share-offsite/?url=" + eu },
        { label: "Pinterest", ic: "📌", u: "https://pinterest.com/pin/create/button/?url=" + eu + "&description=" + et },
        { label: "Tumblr", ic: "T", u: "https://www.tumblr.com/widgets/share/tool?canonicalUrl=" + eu + "&caption=" + et },
        { label: "Discord", ic: "🎮", copy: true },   // Discord 无 intent → 复制链接 + 提示去粘贴
      ];
      function renderResult() {
        killVid();
        card.innerHTML =
          '<div class="ag-f2f-clip-h">🎬 ' + esc(T("Your Face-on-Face clip is ready", "面对面片段已生成")) + '</div>' +
          '<video class="ag-f2f-clip-v" src="' + esc(vsrc) + '" controls playsinline preload="metadata"></video>' +
          '<div class="ag-f2f-clip-url">' + esc(url) + '</div>' +
          '<div class="ag-f2f-clip-btns" data-pill-bar>' +
            '<button data-pill-key="share" class="active">↗ ' + esc(T("Share", "分享")) + '</button>' +
            '<button data-pill-key="copy">📋 ' + esc(T("Copy link", "复制链接")) + '</button>' +
            '<button data-pill-key="close">✕ ' + esc(T("Close", "关闭")) + '</button>' +
          '</div>';
        pillifyBtns(function (key) {
          if (key === "share") renderShare();
          else if (key === "copy") copyLink();
          else if (key === "close") { killVid(); card.remove(); }
        });
      }
      function renderShare() {
        killVid();
        card.innerHTML =
          '<div class="ag-f2f-clip-h">↗ ' + esc(T("Share this clip", "分享这段片段")) + '</div>' +
          '<div class="ag-f2f-share-grid"></div>' +
          '<div class="ag-f2f-clip-url">' + esc(url) + '</div>' +
          '<div class="ag-f2f-clip-btns" data-pill-bar>' +
            '<button data-pill-key="back" class="active">‹ ' + esc(T("Back", "上一步")) + '</button>' +
            '<button data-pill-key="copy">📋 ' + esc(T("Copy link", "复制链接")) + '</button>' +
            '<button data-pill-key="more">⋯ ' + esc(T("More…", "更多…")) + '</button>' +
          '</div>';
        var grid = card.querySelector(".ag-f2f-share-grid");
        TARGETS.forEach(function (t) {
          var b = document.createElement("button"); b.className = "ag-f2f-share-t"; b.title = t.label;
          b.innerHTML = '<span class="ag-f2f-share-ic">' + t.ic + '</span><span>' + esc(t.label) + '</span>';
          b.onclick = function () {   // 同步直接导航(用户手势内, 不被拦); Discord 无 intent → 复制+提示
            if (t.copy) { copyLink(); f2fFlash(T("Link copied — paste in Discord.", "链接已复制,去 Discord 粘贴。")); return; }
            window.open(t.u, "_blank", "noopener,noreferrer");
          };
          grid.appendChild(b);
        });
        pillifyBtns(function (key) {
          if (key === "back") renderResult();   // 退回上一步(结果小窗)
          else if (key === "copy") copyLink();
          else if (key === "more") openFullShare();   // 更多 → 平台旧全卡(所有平台)
        });
      }
      renderResult();
    }
    if (recBtn && !f2fCtl) { recBtn.onclick = function () { f2fDispatch("rec"); }; }

    // ── 内存探针(诊断 OOM): 每 1.5s 报 DOM/爆层/花瓣/媒体/面板 节点计数。默认隐藏, 📊 开关切换(localStorage 记忆)。──────
    //   Safari 无 performance.memory, 故盯【DOM 节点数】—— WKWebView 的 OOM 正是节点爆炸。(TODO: 稳定确认后整块移除)
    var memHud = document.createElement("div"); memHud.className = "ag-f2f-mem"; ov.appendChild(memHud);
    var hudOn = false; try { hudOn = localStorage.getItem("cssos_f2f_hud") === "1"; } catch (e) {}
    function applyHud() { memHud.style.display = hudOn ? "" : "none"; }
    function setHud(on) { hudOn = on; try { localStorage.setItem("cssos_f2f_hud", on ? "1" : "0"); } catch (e) {} applyHud(); }
    // 内部隐藏手势: 点标题栏的【面对面图标】切换内存探针(不暴露给公众; 无独立按钮)。
    if (namesEl) namesEl.addEventListener("click", function (e) { if (e.target && e.target.closest && e.target.closest(".ag-f2f-ic")) setHud(!hudOn); });
    memHud.title = T("Tap to hide", "点击隐藏"); memHud.onclick = function () { setHud(false); };
    applyHud();
    function _cnt(sel) { try { return document.querySelectorAll(sel).length; } catch (e) { return -1; } }
    function _kids(id) { var e = document.getElementById(id); return e ? e.childElementCount : 0; }
    // W1645 — media 只数【仍带活动源】的(currentSrc / srcObject): 断源释放解码器后应降到 ~1(同框摄像头), 不再虚高触发 SPIKE。
    function _liveMedia() { try { var ms = document.querySelectorAll("audio,video"), n = 0; for (var i = 0; i < ms.length; i++) { var m = ms[i]; if ((m.currentSrc && m.currentSrc.length) || m.srcObject) n++; } return n; } catch (e) { return -1; } }
    var _memPeak = 0;
    // W1612 — 崩溃探针: 【常驻记录】(不再只在 HUD 开时算), 每秒把 DOM/FX/媒体/heap 打到 console;
    //   任一指标越阈值 → console.warn。这样即使硬崩(无提示直接退出), Web Inspector 里【崩前最后
    //   一条 [f2f-probe]/⚠SPIKE】就直接指认主凶(DOM 节点爆? spark 爆? petal 爆? 媒体元素泄漏?)。
    var memTimer = setInterval(function () {
      var all = document.getElementsByTagName("*").length; if (all > _memPeak) _memPeak = all;
      var pet = _cnt(".cssfx-petal"), grp = _cnt(".cssfx-center-grp"), med = _liveMedia();
      var spark = _kids("cssfx-spark");
      // W1651 — GPU 合成负载代理: DOM 探针照不到 GPU 进程内存(硬崩的真凶), 用【可数的合成层】估。
      //   每路活动媒体(视频解码器)最重 ×15, 中心爆组 ×3, 天女散花 ×2, 字心烟花 ×1。之前每次硬崩
      //   此值都 >400(spark 300/media 6…), 这条能提前拉响。
      var load = med * 15 + grp * 3 + pet * 2 + spark;
      var mem = (window.performance && performance.memory) ? Math.round(performance.memory.usedJSHeapSize / 1048576) + "MB" : "n/a";
      var line = "DOM " + all + " (peak " + _memPeak + ") · GPU~" + load + " · burst " + grp + " · petal " + pet + " · spark " + spark + " · media " + med + " · rec " + (recording ? "ON" : "off") + " · heap " + mem;
      var spike = (all > 9000 || load > 250 || med > 4 || spark > 220 || grp > 22);
      if (hudOn) memHud.textContent = line;
      try { console.log("[f2f-probe] " + line); } catch (e) {}
      try { if (spike) { console.warn("[f2f-probe] ⚠ SPIKE — " + line); var _tn = Date.now(); if (_tn - _f2fLastTele > 3000) { _f2fLastTele = _tn; _f2fBeacon({ type: "spike", line: line }); } } } catch (e) {}   // W1653 — SPIKE 自动上报服务端(不劳人肉 copy)
      // W1615 — 探针落盘: 硬崩(无提示、Console 未必开着)后仍能取回崩前状态。
      //   重开 app 后控制台跑一行:  copy(localStorage.getItem("cssos_f2f_probe"))  → 粘给我。
      try {
        var _b = JSON.parse(localStorage.getItem("cssos_f2f_probe") || "[]");
        _b.push(line + (spike ? " ⚠SPIKE" : ""));
        while (_b.length > 15) _b.shift();
        localStorage.setItem("cssos_f2f_probe", JSON.stringify(_b));
      } catch (e) {}
    }, 1000);

    try { setTimeout(function () { if (input) input.focus({ preventScroll: true }); }, 120); } catch (e) {}   // 输入框默认焦点(进来即可打字)
    ask("");   // 首条: 演员打招呼
  }

  // 《问道》W1582 — 与本演员第一人称对话。母语·古(默认)/ 现代 胶囊切换; 逐字流式(流流流); 语音输入(Web Speech)。
  function wireWendao(root, actorId, a) {
    _agProbeStart();   // W1670 — 进演员专页(问道)即启动常驻内存探针
    var box = root.querySelector(".ag-wendao");
    if (!box || box.__wired) return;
    box.__wired = true;
    var log = box.querySelector(".ag-wd-log");
    var input = box.querySelector(".ag-wd-text");
    var sendBtn = box.querySelector(".ag-wd-send");
    var micBtn = box.querySelector(".ag-wd-mic");
    var history = [];
    // 切换胶囊要有记性: 进来时【读取】上次的语言模式(之前只保存不读取 → 每次回到 native, 这就是 bug)。
    var mode = "native";
    try { var _sm = localStorage.getItem("cssos_wd_mode"); if (_sm === "native" || _sm === "modern") mode = _sm; } catch (e) {}
    var busy = false;
    // 语音开关也记性: 读上次的静音选择(默认开)。
    var autoVoice = true;
    try { autoVoice = localStorage.getItem("cssos_wd_voice") !== "0"; } catch (e) {}
    // CSSOS_WAVE_1669 — 专页语音停止器(供 openFaceToFace 调用): 停当前朗读音频 +
    //   置 voiceKilled 抑制【自我介绍】的自动朗读(哪怕回复还在流式生成时进 f2f)。真人再提问会重置。
    var voiceKilled = false;
    _agActiveWendaoStop = function () {
      voiceKilled = true;
      if (audio) { try { audio.pause(); audio.src = ""; audio.load(); } catch (e) {} audio = null; }
      try { document.querySelectorAll(".ag-wd-playing").forEach(function (b) { b.classList.remove("ag-wd-playing"); }); } catch (e) {}
    };

    // 语音 开/关(静音)—— 记住选择; 点击统一由头部胶囊条 onActivate 分发(见下)。
    var muteBtn = box.querySelector(".ag-wd-mute");
    function applyMuteUI() { if (muteBtn) { muteBtn.textContent = autoVoice ? "🔊" : "🔇"; muteBtn.title = autoVoice ? T("Voice on", "语音开") : T("Voice off", "语音关"); } }
    applyMuteUI();

    // C 档(W1588) — 头像嵌进每条气泡左上角; 【正在说话那条】的头像用 TTS 逐字时间轴(t_start/t_end ms)
    //   逐音节张合(对口型-ish), 其余静止。2D 封面做不到真嘴型(需 3D 头/生成视频), 这是时间轴驱动的最像版。
    var coverURL = (a && a.cover_image) || "";
    function lipSync(avEl, aud, tokens) {
      if (!avEl) return;
      var raf = 0;
      function stop() { cancelAnimationFrame(raf); avEl.style.transform = ""; avEl.style.boxShadow = ""; }
      function tick() {
        if (aud.paused || aud.ended) { stop(); return; }
        var now = aud.currentTime * 1000, open = 0;
        if (tokens && tokens.length) {
          for (var i = 0; i < tokens.length; i++) {
            var tk = tokens[i];
            if (now >= tk.t_start && now < tk.t_end) { open = Math.sin(((now - tk.t_start) / Math.max(1, tk.t_end - tk.t_start)) * Math.PI); break; }
          }
        } else { open = 0.5 + 0.5 * Math.sin(now / 90); }   // 无时间轴兜底: 匀速张合
        avEl.style.transform = "scale(" + (1 + open * 0.13).toFixed(3) + ")";
        avEl.style.boxShadow = "0 4px 14px rgba(0,0,0,.5),0 0 " + (7 + open * 24).toFixed(0) + "px rgba(0,245,160," + (0.25 + open * 0.5).toFixed(2) + ")";
        raf = requestAnimationFrame(tick);
      }
      aud.addEventListener("ended", stop); aud.addEventListener("pause", stop);
      raf = requestAnimationFrame(tick);
    }

    function uiLocale() {
      return (typeof window.cssosLocale === "string" && window.cssosLocale) || (document.documentElement.lang || "en");
    }
    // 头部控件条(🔊静音 · ↻重来 · 母语古/现代)= 一条凸嵌凹胶囊。母语/现代=单选语言锚点;
    //   静音/重来=动作键: 执行后 setActive 弹回语言锚点, 不抢 active。全局记住语言选择。
    try { var _sm = localStorage.getItem("cssos_wd_mode"); if (_sm === "modern" || _sm === "native") mode = _sm; } catch (e) {}
    var headRight = box.querySelector(".ag-wd-headright");
    var hrCtl = null;
    // ↻ 重来 = 真的从头: 摘要也要清, 否则演员"忘了对话却记得摘要", 比不清更怪。
    function doReset() { if (busy) return; try { localStorage.removeItem(STOREKEY); } catch (e) {} history = []; convSummary = ""; convSumAt = 0; pendingBridgeDays = 0; log.innerHTML = ""; ask(""); }
    if (headRight && typeof window.cssosMakePillBar === "function") {
      hrCtl = window.cssosMakePillBar(headRight, { mono: true, compact: true, textColor: "light", activeKey: mode, onActivate: function (key) {
        if (key === "native" || key === "modern") { mode = key; try { localStorage.setItem("cssos_wd_mode", key); } catch (e) {} }
        else if (key === "mute") { autoVoice = !autoVoice; try { localStorage.setItem("cssos_wd_voice", autoVoice ? "1" : "0"); } catch (e) {} applyMuteUI(); if (hrCtl) hrCtl.setActive(mode); }
        else if (key === "reset") { doReset(); if (hrCtl) hrCtl.setActive(mode); }
      } });
    }
    function bubble(role) {
      var d = document.createElement("div");
      d.className = "ag-wd-msg ag-wd-" + role;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }
    function typewriter(el, text) {
      var i = 0; el.textContent = "";
      (function step() {
        if (i >= text.length) { log.scrollTop = log.scrollHeight; return; }
        el.textContent += text.charAt(i++);
        log.scrollTop = log.scrollHeight;
        setTimeout(step, 16);
      })();
    }
    // Phase 2 — 用【本演员音色】朗读一段回复(ElevenLabs, 后端 /say)。
    var audio = null;
    function speak(btn, text, avEl, emotion) {
      if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
      if (btn.__loading) return;
      btn.__loading = true; btn.classList.add("ag-wd-loading"); btn.textContent = "⏳";
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/say", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text, emotion: emotion || "" }),
      }).then(function (r) { return r.json(); }).then(function (j) {
        btn.__loading = false; btn.classList.remove("ag-wd-loading"); btn.textContent = "🔊";
        var _nb = j && j.data && j.data.billing;   // W1634 — 柔性额度提醒(演员口吻黄条)
        if (_nb && _nb.nudge) { var _nn = document.createElement("div"); _nn.className = "ag-wd-note"; _nn.textContent = (_nb.nudge === "last_free" ? T("(That was our last free voice this month — add a little and I'll keep speaking; our words stay free.)", "(这月你我最后一句有声之言了 —— 添一炷香火,我便续说;文字之交不断。)") : _nb.nudge === "balance" ? T("(My voice needs a little credit to go on — top up to hear me; text stays free.)", "(我的声音需一点香火方能再续 —— 充值即可听我说话;文字永远免费。)") : T("(Sign in and top up to hear me speak — text is always free.)", "(登录并充值,便可听我说话 —— 文字永远免费。)")); try { _nn.appendChild(agNudgeLink(_nb.nudge)); } catch (e) {} log.appendChild(_nn); log.scrollTop = log.scrollHeight; }
        if (j && j.code === "RATE_LIMIT") {   // 成本闸命中 → 关自动朗读 + 一次性提示
          autoVoice = false; if (muteBtn) muteBtn.textContent = "🔇";
          if (!box.__rateNote) { box.__rateNote = true; var n = document.createElement("div"); n.className = "ag-wd-note"; n.textContent = T("Voice paused (hourly limit reached). Tap 🔊 to hear a reply.", "语音已达每小时上限,已暂停自动朗读。点 🔊 可手动听一条。"); log.appendChild(n); log.scrollTop = log.scrollHeight; }
          return;
        }
        var url = j && j.data && j.data.voice_url;
        if (!url) return;
        audio = new Audio(url);
        btn.classList.add("ag-wd-playing");
        audio.onended = function () { btn.classList.remove("ag-wd-playing"); };
        audio.play().catch(function () { btn.classList.remove("ag-wd-playing"); });
        lipSync(avEl, audio, (j.data && j.data.tokens) || []);   // C 档: 逐音节张合
      }).catch(function () { btn.__loading = false; btn.classList.remove("ag-wd-loading"); btn.textContent = "🔊"; });
    }
    // Phase 2 — 收藏一条问答到「我的收藏」(需登录, 后端持久)。
    function saveWendao(question, answer, btn) {
      if (btn.__saved) return;
      btn.disabled = true;
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/wendao/save", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ question: question, answer: answer, lang: (mode === "modern" ? uiLocale() : "") }),
      }).then(function (r) { return r.json(); }).then(function (j) {
        btn.disabled = false;
        if (j && j.ok) { btn.__saved = true; btn.textContent = "★"; btn.classList.add("on"); btn.title = T("Saved", "已收藏"); }
        else if (j && j.code === "AUTH_REQUIRED") { if (window.cssosOpenLogin) window.cssosOpenLogin(); else window.alert(T("Sign in to save.", "登录后可收藏。")); }
      }).catch(function () { btn.disabled = false; });
    }
    // 分享一段问答: 创建 /w/:sid 分享链接(社交显示封面+Q&A卡)→ 原生分享 / 复制。
    function shareWendao(question, answer, btn) {
      var nm = (a && (a.name_zh || a.name_en)) || "";
      var fallbackUrl = "https://cssstudio.app/a/" + encodeURIComponent(actorId);
      btn.disabled = true;
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/wendao/share", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question, answer: answer }),
      }).then(function (r) { return r.json(); }).then(function (j) {
        btn.disabled = false;
        var url = (j && j.data && j.data.url) || fallbackUrl;
        var text = (question ? T("I asked ", "我问了 ") + nm + "：" + question + "\n" : "") + nm + "：" + answer;
        if (navigator.share) { navigator.share({ title: nm + " · 问道", text: text, url: url }).catch(function () {}); }
        else { agCopy(text + "\n" + url, btn); }
      }).catch(function () {
        btn.disabled = false;
        if (navigator.share) navigator.share({ url: fallbackUrl }).catch(function () {}); else agCopy(fallbackUrl, btn);
      });
    }
    function ask(userText) {
      if (busy) return;
      busy = true; if (sendBtn) sendBtn.disabled = true;
      if (userText) voiceKilled = false;   // W1669 — 真人提问 → 恢复自动朗读(仅"自我介绍"被 f2f 抑制)
      if (userText) { var u = bubble("user"); u.textContent = userText; history.push({ role: "user", content: userText }); }
      var reply = bubble("actor"); reply.classList.add("ag-wd-think"); reply.textContent = "…";
      var q = userText || "", full = "", emo = "", started = false, finished = false, txtEl = null, spk = null, cpy = null, star = null, sh = null, replyAv = null;
      function ensureBody() {
        if (started) return; started = true;
        reply.classList.remove("ag-wd-think"); reply.textContent = "";
        if (coverURL) { replyAv = document.createElement("div"); replyAv.className = "ag-wd-bav"; replyAv.style.backgroundImage = "url('" + coverURL + "')"; reply.appendChild(replyAv); reply.classList.add("ag-wd-hasav"); }
        txtEl = document.createElement("span"); txtEl.className = "ag-wd-txt"; reply.appendChild(txtEl);
        spk = document.createElement("button"); spk.type = "button"; spk.className = "ag-wd-speak"; spk.setAttribute("data-glyph", "🔊"); spk.textContent = "🔊"; spk.title = T("Replay voice", "重听");
        cpy = document.createElement("button"); cpy.type = "button"; cpy.className = "ag-wd-copy"; cpy.setAttribute("data-glyph", "📋"); cpy.textContent = "📋"; cpy.title = T("Copy", "复制");
        star = document.createElement("button"); star.type = "button"; star.className = "ag-wd-save"; star.setAttribute("data-glyph", "☆"); star.textContent = "☆"; star.title = T("Save to My Collection", "收藏到我的收藏");
        sh = document.createElement("button"); sh.type = "button"; sh.className = "ag-wd-share"; sh.setAttribute("data-glyph", "↗"); sh.textContent = "↗"; sh.title = T("Share this exchange", "分享这段问答");
        reply.appendChild(spk); reply.appendChild(cpy); reply.appendChild(star); reply.appendChild(sh);
      }
      function finish() {
        if (finished) return; finished = true;
        if (!started) { ensureBody(); if (txtEl) txtEl.textContent = T("(silence)", "(沉默)"); }
        if (full) history.push({ role: "assistant", content: full });
        saveHist();   // #1 对话续: 每轮存一次
        if (spk) spk.addEventListener("click", function () { speak(spk, full, replyAv, emo); });
        if (cpy) cpy.addEventListener("click", function () { agCopy(full, cpy); });
        if (star) star.addEventListener("click", function () { saveWendao(q, full, star); });
        if (sh) sh.addEventListener("click", function () { shareWendao(q, full, sh); });
        if (full && spk && autoVoice && !voiceKilled) speak(spk, full, replyAv, emo);   // Phase 2 — 默认自动朗读(可静音/限频自动降级) + W1592 情绪音色; W1669 进 f2f 抑制自我介绍
        busy = false; if (sendBtn) sendBtn.disabled = false;
      }
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/ask", {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        /* W1803 — bridge_days 只在"久别重逢"的那一次带上, 发出即清零, 之后回到普通问答。
         * W1804 — 只发最近 SEND_WINDOW 条 + 一句摘要, 不再整段重发。
         *   want_summary: 仅当【逐字窗口已经滑过内容】(history 比上次生成摘要时长出至少一个窗口)
         *   才请演员顺带更新摘要 —— 短对话完全在窗口内, 一句都不用多写。 */
        body: JSON.stringify({
          mode: mode, uiLocale: uiLocale(),
          messages: history.slice(-SEND_WINDOW),
          summary: convSummary,
          want_summary: history.length > SEND_WINDOW && (history.length - convSumAt) >= SEND_WINDOW,
          bridge_days: pendingBridgeDays,
        }),
      }).then(function (resp) {
        pendingBridgeDays = 0;
        if (!resp.body || !resp.body.getReader) {   // 环境不支持流 → 退回整段
          return resp.json().then(function (j) { ensureBody(); full = (j && j.data && (j.data.full || j.data.reply)) || ""; emo = (j && j.data && j.data.emotion) || ""; if (txtEl) txtEl.textContent = full; finish(); });
        }
        var reader = resp.body.getReader(), dec = new TextDecoder(), buf = "";
        function pump() {
          return reader.read().then(function (r2) {
            if (r2.done) { finish(); return; }
            buf += dec.decode(r2.value, { stream: true });
            var nl;
            while ((nl = buf.indexOf("\n\n")) >= 0) {
              var blk = buf.slice(0, nl); buf = buf.slice(nl + 2);
              var dl = null, parts = blk.split("\n");
              for (var i = 0; i < parts.length; i++) { if (parts[i].indexOf("data:") === 0) { dl = parts[i]; break; } }
              if (!dl) continue;
              var js = dl.slice(5).trim(); if (!js) continue;
              var ev; try { ev = JSON.parse(js); } catch (e) { continue; }
              // W1806 — 上游吐了空壳(只剩标点), 后端已判失败并重来; 把已经画上去的擦掉, 让重试的字重新流进来。
              if (ev.reset) { full = ""; if (txtEl) txtEl.textContent = ""; }
              else if (ev.delta) { ensureBody(); full += ev.delta; if (txtEl) txtEl.textContent += ev.delta; log.scrollTop = log.scrollHeight; }
              else if (ev.done) { ensureBody(); if (ev.full) { full = ev.full; if (txtEl) txtEl.textContent = full; } if (ev.emotion) emo = ev.emotion; if (ev.summary && ev.summary !== convSummary) { convSummary = String(ev.summary); convSumAt = history.length; }   /* W1804 滚动摘要回存(saveHist 在 finish 里落盘) */ if (ev.billing && ev.billing.nudge && txtEl && txtEl.parentNode) { try { txtEl.parentNode.appendChild(document.createTextNode(" ")); txtEl.parentNode.appendChild(agNudgeLink(ev.billing.nudge)); } catch (e) {} } }   // W1592 干净全文 + 情绪; W1638 柔性提醒可点链接(不跳转)
              else if (ev.error && !full) { ensureBody(); if (txtEl) txtEl.textContent = T("(the connection faltered)", "(连接中断了)"); }
            }
            return pump();
          });
        }
        return pump();
      }).catch(function () {
        if (!full) { ensureBody(); if (txtEl) txtEl.textContent = T("(the connection faltered)", "(连接中断了)"); }
        finish();
      });
    }
    function submit() {
      if (!input) return;
      var t = (input.value || "").trim();
      if (!t) return;
      input.value = "";
      ask(t);
    }
    if (sendBtn) sendBtn.addEventListener("click", submit);
    if (input) input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    // W1637 (C) — 语音输入: 点麦克风录音, 再点停止 → 上传 Whisper 转写 → 填入输入框并发送。
    //   取代 Safari 没有的 webkitSpeechRecognition(之前 Safari 直接隐藏麦克风 → "没生效")。
    if (micBtn) {
      micBtn.addEventListener("click", function () {
        if (agIsRecording(micBtn)) { agStopRecord(micBtn); return; }   // 录音中 → 停止转写
        agStartRecord(micBtn, "", function (t) {   // W1650 — 问道语音同样自动检测语言(不强制 UI 语言)
          if (input) input.value = t;
          submit();
        }, function (state) {
          if (state === "recording") { micBtn.classList.add("ag-wd-listening"); return; }
          if (state === "transcribing") return;   // 保持高亮, 识别中
          micBtn.classList.remove("ag-wd-listening");
          if (state === "signin") {
            if (!box.__sttNote) { box.__sttNote = true; var n = document.createElement("div"); n.className = "ag-wd-note"; n.textContent = T("Sign in to talk by voice — text stays free.", "登录后即可语音输入 —— 文字免费。"); log.appendChild(n); log.scrollTop = log.scrollHeight; }
          } else if (state === "denied" || state === "unsupported") {
            var n2 = document.createElement("div"); n2.className = "ag-wd-note"; n2.textContent = T("Microphone unavailable.", "麦克风不可用。"); log.appendChild(n2); log.scrollTop = log.scrollHeight;
          }
        });
      });
    }
    // #1 对话续 — 按演员存/取对话历史(localStorage), 下次进来接着聊(不再每次重新自我介绍)。
    var STOREKEY = "cssos_wd_" + actorId;
    // W1803 — 除了历史本身, 还要记【上次说话是什么时候】, 否则无从判断该不该打招呼。
    //   存 v2 结构 {v,t,h}; 老用户存的是裸数组 → 读的时候兼容, 当作"没有时间戳"处理(不触发衔接语)。
    var pendingBridgeDays = 0;   // >0 时, 下一次 ask 带上, 让演员先说一句衔接语; 用完即清
    /* W1804 — 滚动摘要。history 本地全留(用户要能翻回去看), 但【发给后端的只有最近 4 轮 + 这一句摘要】。
     *   s     = 摘要正文; sumAt = 生成这句摘要时 history 的长度, 用来判断"逐字窗口是否已经滑过新内容"。
     *   摘要由回复顺带吐出(⟦sum:…⟧), 不额外调用 LLM, 所以刷新频率只影响输出长度, 不影响调用次数。 */
    var convSummary = "", convSumAt = 0;
    var SEND_WINDOW = 8;   // 与后端 slice(-8) 对齐: 逐字回传的最近 8 条 = 4 轮问答
    function saveHist() {
      try { localStorage.setItem(STOREKEY, JSON.stringify({ v: 3, t: Date.now(), h: history.slice(-40), s: convSummary, sa: convSumAt })); } catch (e) {}
    }
    function renderPastMsg(m) {
      if (m.role === "user") { var u = bubble("user"); u.textContent = m.content; return; }
      var reply = bubble("actor"), av = null;
      if (coverURL) { av = document.createElement("div"); av.className = "ag-wd-bav"; av.style.backgroundImage = "url('" + coverURL + "')"; reply.appendChild(av); reply.classList.add("ag-wd-hasav"); }
      var txtEl = document.createElement("span"); txtEl.className = "ag-wd-txt"; txtEl.textContent = m.content; reply.appendChild(txtEl);
      var spk = document.createElement("button"); spk.type = "button"; spk.className = "ag-wd-speak"; spk.setAttribute("data-glyph", "🔊"); spk.textContent = "🔊"; spk.title = T("Replay voice", "重听");
      var cpy = document.createElement("button"); cpy.type = "button"; cpy.className = "ag-wd-copy"; cpy.setAttribute("data-glyph", "📋"); cpy.textContent = "📋"; cpy.title = T("Copy", "复制");
      var star = document.createElement("button"); star.type = "button"; star.className = "ag-wd-save"; star.setAttribute("data-glyph", "☆"); star.textContent = "☆"; star.title = T("Save to My Collection", "收藏到我的收藏");
      reply.appendChild(spk); reply.appendChild(cpy); reply.appendChild(star);
      var txt = m.content;
      spk.addEventListener("click", function () { speak(spk, txt, av); });
      cpy.addEventListener("click", function () { agCopy(txt, cpy); });
      star.addEventListener("click", function () { saveWendao("", txt, star); });
    }
    // #3 推荐问题 chips → 直接问。
    // 建议 chip 各自发问(handleClick 不阻断原生 click, 所以套胶囊后点击仍生效)。
    box.querySelectorAll(".ag-wd-chip").forEach(function (ch) { ch.addEventListener("click", function () { var q = ch.getAttribute("data-q") || ""; if (q && !busy) ask(q); }); });
    // 建议 chip 行 + 输入行 = 凸嵌凹胶囊(视觉几何由平台宪法接管; 输入框吃满剩余长度)。
    var wdChips = box.querySelector(".ag-wd-chips");
    if (wdChips && typeof window.cssosMakePillBar === "function") { try { window.cssosMakePillBar(wdChips, { mono: true, compact: true, textColor: "light" }); } catch (e) {} }
    var wdInput = box.querySelector(".ag-wd-input");
    if (wdInput && typeof window.cssosMakePillBar === "function") { try { window.cssosMakePillBar(wdInput, { mono: true, compact: true, textColor: "light" }); } catch (e) {} }
    // ↻ 重来现由头部胶囊条 onActivate 分发(见上 doReset), 不再单独绑定 .ag-wd-reset。

    // 首条: 有历史 → 渲染并接着聊; 无历史 → 演员主动自我介绍。
    var savedRaw = null; try { savedRaw = JSON.parse(localStorage.getItem(STOREKEY) || "null"); } catch (e) {}
    // 兼容三代格式: 裸数组(旧) / {v:2,t,h} / {v:3,…,s,sa}。旧格式没有时间戳 → lastSeen 为 0 → 不触发衔接语。
    var savedHist = Array.isArray(savedRaw) ? savedRaw : (savedRaw && Array.isArray(savedRaw.h) ? savedRaw.h : null);
    var lastSeen = (savedRaw && !Array.isArray(savedRaw) && Number(savedRaw.t)) || 0;
    if (savedRaw && !Array.isArray(savedRaw)) { convSummary = String(savedRaw.s || ""); convSumAt = Number(savedRaw.sa) || 0; }
    if (savedHist && savedHist.length) {
      history = savedHist; savedHist.forEach(renderPastMsg); log.scrollTop = log.scrollHeight;
      // W1803 — 隔了 ≥7 天才回来 → 让演员先说一句衔接语(具体点出上次聊到哪儿), 而不是干接上文。
      //   门槛 7 天(Jing): 当天/几天内回来还寒暄反而生分, 直接续更自然。
      var gapDays = lastSeen ? Math.floor((Date.now() - lastSeen) / 86400000) : 0;
      if (gapDays >= 7) { pendingBridgeDays = gapDays; ask(""); }
    }
    else { ask(""); }
    // 进演员专页 → 焦点自动落到问道输入框(打字即问)。preventScroll: 不跳动页面。
    if (input) { try { input.focus({ preventScroll: true }); } catch (e) { try { input.focus(); } catch (e2) {} } }
  }

  function wireShowcase(scroll, actorId, a) {
    var stage = scroll.querySelector(".ag-stage");
    var scF2f = scroll.querySelector(".ag-sc-f2f");   // #1 — 内容框下方的 Face on Face 入口
    if (scF2f) scF2f.addEventListener("click", function (ev) { ev.stopPropagation(); openFaceToFace(actorId, a); });
    var segBtns = scroll.querySelectorAll(".ag-sc-btn[data-seg]");
    function busy(on) { segBtns.forEach(function (b) { b.disabled = on; }); }
    // 群演段: 按规则说明该演员当群众演员时的表现(不占用会说话视频)。
    //   系统随机群演=路人甲(无台词/无特写); 大牌(premium/高人气)愿演群演→偶尔特写或一句台词。
    function extraText() {
      var big = !!(a && (a.is_premium || (a.cast_count || 0) >= 5));
      if (!a || !a.willing_extra) return "👥 " + T("Not in the extras pool yet.", "尚未加入群演池。") + (a && state.ownedSet[a.actor_id] ? " " + T("Tick the box below to appear as a background extra.", "勾选下方即可作为群众演员出镜。") : "");
      if (big) return "🎬 " + T("A big name who’ll do extras — the system slips in an occasional cameo: a close-up or a throwaway line.", "大牌也愿当群演 —— 系统会偶尔给个特写、或一句台词(哪怕无关紧要)。");
      return "👥 " + T("Background extra (a passerby) — no lines, no close-up.", "背景群演(路人甲)—— 无台词、无特写。");
    }
    function playSeg(btn, seg) {
      if (seg === "extra") { stage.textContent = extraText(); return; }   // 群演=说明, 非会说话视频
      var sc = scCache[actorId], clip = sc && sc.clips && sc.clips[seg];
      // 有会说话视频→就地开口演; 否则播【真人声 + 旋转 3D】(海选体验)。
      // 不再每点必烧对口型视频(omnihuman 不稳/贵): 视频=已生成缓存才播, 生成由作者/管理员显式触发。
      if (clip) playClip(clip, btn, stage);
      else stage.textContent = T("(missing)", "(此段暂缺)");
    }
    // 群演 opt-in 复选框(演员主人): 勾选 → 进自愿群演池。
    var wcb = scroll.querySelector(".ag-willing-cb");
    if (wcb) wcb.addEventListener("change", function () {
      var on = wcb.checked; wcb.disabled = true;
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/willing-extra", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ willing: on }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          wcb.disabled = false;
          if (j && j.ok) { if (a) a.willing_extra = j.willing_extra; if (window.cssosGuidedToast) window.cssosGuidedToast(j.willing_extra ? T("You’re in the extras pool.", "已加入群演池。") : T("Removed from the extras pool.", "已退出群演池。"), {}); }
          else { wcb.checked = !on; if (window.cssosGuidedToast) window.cssosGuidedToast(T("Couldn’t update — try again.", "设置失败,请重试。"), {}); }
        })
        .catch(function () { wcb.disabled = false; wcb.checked = !on; });
    });
    function trigger(btn, seg) {
      if (seg === "extra") { playSeg(btn, seg); return; }   // 群演不需要拉 showcase 台词
      if (scCache[actorId]) { playSeg(btn, seg); return; }
      stage.textContent = "⏳ " + T("The actor is preparing…", "演员正在准备…");
      busy(true);
      fetch("/api/actors/" + encodeURIComponent(actorId) + "/showcase", { credentials: "include" })
        .then(function (r) { return r.json(); }).then(function (j) {
          busy(false);
          if (j && j.ok && j.data && j.data.showcase) { scCache[actorId] = j.data.showcase; playSeg(btn, seg); }
          else { stage.textContent = (j && j.code === "TTS_UNAVAILABLE") ? T("Voice feature not configured.", "语音功能未配置。") : T("Failed, retry.", "生成失败,请重试。"); }
        })
        .catch(function () { busy(false); stage.textContent = T("Network error, retry.", "网络错误,请重试。"); });
    }
    // Intro/Hero/Villain 也套胶囊(凹凸镶嵌绿); pill-bar 接管点击 → 触发对应段。
    var showcaseBar = scroll.querySelector(".ag-showcase");
    segBtns.forEach(function (b) { b.setAttribute("data-pill-key", b.getAttribute("data-seg")); });
    if (showcaseBar && typeof window.cssosMakePillBar === "function") {
      showcaseBar.classList.add("ag-pillbar");
      window.cssosMakePillBar(showcaseBar, { mono: true, compact: true, textColor: "light", activeKey: "intro", onActivate: function (key, pill) { trigger(pill, key); } });
    } else {
      segBtns.forEach(function (btn) { btn.onclick = function () { trigger(btn, btn.getAttribute("data-seg")); }; });
    }
  }

  /* 3D 头像: 有 model_3d_url → AR Quick Look「在 AR 中查看」(iPhone/iPad/Vision Pro);
   * 作者/无模型 → 「生成 3D 头像(免费)」按钮。 */
  function render3D(scroll, a) {
    // box = 传入元素本身若是封面容器(data-cover), 否则找 .ag-3d 子。
    var box = (scroll.hasAttribute && scroll.hasAttribute("data-cover")) ? scroll : (scroll.querySelector ? scroll.querySelector(".ag-3d") : null);
    if (!box) return;
    var inCover = box.hasAttribute && box.hasAttribute("data-cover");
    var owned = state.ownedSet[a.actor_id];
    var url = a.model_3d_url || "";
    if (url && /\.glb($|\?)/i.test(url)) {
      // GLB → 正面朝前、自动旋转、可拖拽的 3D(像《时间帝国》预告页)。iOS AR 用同名 .usdz。
      var usdz = url.replace(/\.glb($|\?)/i, ".usdz$1");
      box.innerHTML = '<div class="ag-mv-wrap"></div>';
      var mvStyle = inCover
        ? "width:100%;height:100%;background:radial-gradient(circle at 50% 42%,rgba(0,245,160,.12),transparent 68%);"
        : "width:100%;max-width:340px;height:340px;background:radial-gradient(circle at 50% 42%,rgba(0,245,160,.12),transparent 68%);border:1px solid rgba(0,245,160,.35);border-radius:16px;";
      ensureModelViewer(function () {
        var wrap = box.querySelector(".ag-mv-wrap"); if (!wrap) return;
        wrap.innerHTML = '<model-viewer src="' + esc(url) + '" ios-src="' + esc(usdz) + '" poster="' + esc(a.cover_image || "") + '" ' +
          'camera-controls touch-action="pan-y" auto-rotate auto-rotate-delay="0" rotation-per-second="26deg" ' +
          'camera-orbit="0deg 90deg 100%" min-camera-orbit="auto 70deg auto" max-camera-orbit="auto 110deg auto" field-of-view="28deg" ' +
          'interaction-prompt="none" ar ar-modes="quick-look webxr" exposure="1.0" tone-mapping="neutral" shadow-intensity="0" ' +
          'style="' + mvStyle + '"></model-viewer>';
        // TripoSR 网格朝向常有偏差 → 载入后自动把【人脸】转到正前(用包围盒朝向估算不可靠, 这里给默认无偏,
        //   随 auto-rotate 会扫到正面; 如需锁定正面朝向, 见 model_3d 生成端的坐标归一)。
      });
    } else if (url) {
      // 旧 USDZ(无 GLB): AR Quick Look 兜底(仅 Apple)。
      box.innerHTML = '<a class="ag-sc-btn ag-ar" rel="ar" href="' + esc(url) + '">🧊 ' + esc(T("View in AR", "在 AR 中查看")) + '<img src="' + esc(a.cover_image || "") + '" style="display:none"></a>';
    } else if (owned) {
      box.innerHTML = '<button class="ag-sc-btn ag-gen3d">🧊 ' + esc(T("Generate 3D head (free)", "生成 3D 头像（免费）")) + '</button><div class="ag-empty ag-3d-msg" style="font-size:12px"></div>';
      var btn = box.querySelector(".ag-gen3d"), msg = box.querySelector(".ag-3d-msg");
      btn.onclick = function () {
        btn.disabled = true; msg.textContent = "⏳ " + T("Turning into 3D… (~20s)", "正在立体化…(约 20 秒)");
        fetch("/api/actors/" + encodeURIComponent(a.actor_id) + "/generate-3d", { method: "POST", credentials: "include" })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.ok && j.model_3d_url) { a.model_3d_url = j.model_3d_url; render3D(scroll, a); }
            else { btn.disabled = false; msg.textContent = (j && j.hint) || T("Failed, please retry.", "生成失败,请重试。"); }
          })
          .catch(function () { btn.disabled = false; msg.textContent = T("Network error, retry.", "网络错误,请重试。"); });
      };
    } else { box.innerHTML = ""; }
  }

  function close() {
    stopShowcase();
    if (typeof stopRpStream === "function") stopRpStream();
    var el = document.getElementById(ROOT_ID);
    if (el) { disposeModelViewers(el); el.remove(); }
  }

  function open(force, soloId) {
    ensureStyle();
    var existing = document.getElementById(ROOT_ID);
    if (existing && !force) return;
    if (existing) existing.remove();
    var el = document.createElement("div");
    el.id = ROOT_ID;
    el.innerHTML =
      '<div class="ag-bar">' +
        '<div class="ag-title">🎭 <b>' + esc(T("Digital Actors", "数字演员")) + '</b></div>' +
        '<div class="ag-spacer"></div>' +
        '<div class="ag-topcap">' +   // 导演入口 + 三段(成为演员/创建/搜索)同一胶囊轨道; 导演首位默认激活。
          '<button class="ag-directcap" data-pill-key="direct">🎬 ' + esc(T("Direct", "开拍")) + '</button>' +
          '<button class="ag-signup" data-pill-key="signup">🙋 ' + esc(T("Become an actor", "成为真人演员")) + '</button>' +
          '<button class="ag-create" data-pill-key="create">＋ ' + esc(T("Create", "创建演员")) + '</button>' +
          '<button class="ag-mycol" data-pill-key="mycol">⭐ ' + esc(T("Saved", "我的收藏")) + '</button>' +
          '<input class="ag-search" type="search" data-pill-key="search" placeholder="' + esc(T("🔍 Search actors…", "🔍 搜索演员…")) + '">' +
        '</div>' +
        '<button class="ag-x" aria-label="close">×</button>' +
      '</div>' +
      '<div class="ag-filters" data-pill-bar>' +
        '<button class="ag-chip on" data-f="all">🎭 ' + esc(T("All", "全部")) + '</button>' +
        '<button class="ag-chip" data-f="synthetic">✨ ' + esc(T("Original", "原创合成")) + '</button>' +
        '<button class="ag-chip" data-f="civilization">🏛 ' + esc(T("Legends", "文明名角")) + '</button>' +
        '<button class="ag-chip" data-f="premium">💎 ' + esc(T("Premium", "溢价")) + '</button>' +
        '<button class="ag-chip" data-f="female">👩 ' + esc(T("Female", "女性")) + '</button>' +
        '<button class="ag-chip" data-f="male">👨 ' + esc(T("Male", "男性")) + '</button>' +
        '<button class="ag-chip" data-f="neutral">🧑 ' + esc(T("Neutral", "中性")) + '</button>' +
        '<button class="ag-chip" data-f="owned">🎬 ' + esc(T("Mine", "我的演员")) + '</button>' +
      '</div>' +
      // 戏路大类筛选(横滑)
      '<div class="ag-filters ag-archfilters">' +
        '<button class="ag-chip ag-af on" data-arch="">🎭 ' + esc(T("All roles", "全部戏路")) + '</button>' +
        ROLE_TAXONOMY.map(function (a) { return '<button class="ag-chip ag-af" data-arch="' + a.key + '">' + a.emoji + ' ' + esc(T(a.en, a.zh)) + '</button>'; }).join("") +
      '</div>' +
      '<div class="ag-scroll"></div>';
    document.body.appendChild(el);
    el.querySelector(".ag-x").onclick = close;
    // 顶部三段(成为演员/创建/搜索)= 单选胶囊轨道, 走平台 cssosMakePillBar(含 <input> 段)。
    var topcap = el.querySelector(".ag-topcap");
    if (topcap && typeof window.cssosMakePillBar === "function") {
      agTopcapCtl = window.cssosMakePillBar(topcap, {
        mono: true, textColor: "light", compact: true, activeKey: "direct",
        onActivate: function (key) {
          // 搜索段是 <input>, 点击即原生聚焦, 无需在此 focus(否则与 change 事件成回环卡住焦点)。
          if (key === "direct") openDirectorGate();
          else if (key === "create") renderCreateForm();
          else if (key === "signup") renderRealPersonSignup();
          else if (key === "mycol") openMyCollection();   // 《问道》W1586 — 我的收藏
        },
      });
    } else {
      var createBtn = el.querySelector(".ag-create");
      if (createBtn) createBtn.onclick = function () { renderCreateForm(); };
      var signupBtn = el.querySelector(".ag-signup");
      if (signupBtn) signupBtn.onclick = function () { renderRealPersonSignup(); };
    }
    // 5 个筛选 = 凹凸镶嵌胶囊轨道: 优先用平台 cssosMakePillBar(胶囊宪法), 否则退回普通 chip。
    var filterBar = el.querySelector(".ag-filters");
    filterBar.querySelectorAll(".ag-chip").forEach(function (c) { c.setAttribute("data-pill-key", c.getAttribute("data-f")); });
    function applyFilterKey(key) { state.filter = key; resetRows(); if (state.solo) { state.solo = null; loadActors(); return; } renderGrid(); }
    if (typeof window.cssosMakePillBar === "function") {
      filterBar.classList.add("ag-pillbar");
      window.cssosMakePillBar(filterBar, { mono: true, textColor: "light", activeKey: "all", onActivate: applyFilterKey });
    } else {
      filterBar.querySelectorAll(".ag-chip").forEach(function (c) {
        c.onclick = function () {
          filterBar.querySelectorAll(".ag-chip").forEach(function (x) { x.classList.toggle("on", x === c); });
          applyFilterKey(c.getAttribute("data-f"));
        };
      });
    }
    // 戏路大类筛选(独立行, 客户端过滤) = 凹凸镶嵌胶囊(胶囊宪法)。
    var archBar = el.querySelector(".ag-archfilters");
    if (archBar) {
      function applyArch(key) { state.archetype = key === "all" ? "" : key; resetRows(); if (state.solo) { state.solo = null; loadActors(); return; } renderGrid(); }
      archBar.querySelectorAll(".ag-af").forEach(function (c) { c.setAttribute("data-pill-key", c.getAttribute("data-arch") || "all"); });
      if (typeof window.cssosMakePillBar === "function") {
        archBar.classList.add("ag-pillbar");
        window.cssosMakePillBar(archBar, { mono: true, textColor: "light", activeKey: "all", onActivate: applyArch });
      } else {
        archBar.querySelectorAll(".ag-af").forEach(function (c) {
          c.onclick = function () {
            archBar.querySelectorAll(".ag-af").forEach(function (x) { x.classList.toggle("on", x === c); });
            applyArch(c.getAttribute("data-arch") || "all");
          };
        });
      }
    }
    var si = el.querySelector(".ag-search");
    si.oninput = function () { state.search = si.value.trim(); resetRows(); if (state.solo) { state.solo = null; loadActors(); return; } renderGrid(); };
    si.onfocus = function () { setTopcapActive("search"); };
    si.onblur = function () { if (!si.value.trim()) setTopcapActive("signup"); };
    el.querySelector(".ag-scroll").addEventListener("click", function (e) {
      var t = e.target;
      // 展开区内的交互元素(台词胶囊/选角/作者/出演子卡/model-viewer)不劫持。
      // 🚩 举报滥用(演员本人)。
      var rep = t.closest && t.closest(".ag-report");
      if (rep) {
        var rReason = window.prompt(T("Describe the misuse (e.g. defamatory / sexual / political misuse of your likeness):", "描述滥用情况(如:诽谤/色情/政治滥用你的肖像):"), "");
        if (rReason != null) {
          fetch("/api/actors/report-misuse", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ actor_id: rep.getAttribute("data-actor"), work_id: rep.getAttribute("data-work"), reason: rReason }) })
            .then(function (r) { return r.json(); }).then(function (j) { window.alert(j && j.ok ? T("Reported. The platform will review; if confirmed, that user loses trust credit.", "已举报。平台将核实;属实将扣该用户信用分。") : T("Report failed.", "举报失败。")); }).catch(function () {});
        }
        return;
      }
      // 出演作品卡 → 打开观看(演员本人对参演作品免费)。
      var appear = t.closest && t.closest(".ag-appear[data-work]");
      if (appear) {
        var wid = appear.getAttribute("data-work");
        if (wid && typeof window.cssosOpenWork === "function") { close(); window.cssosOpenWork(wid); }
        return;
      }
      if (t.closest && (t.closest(".ag-editable") || t.closest(".ag-showcase") || t.closest(".ag-cta-cap") || t.closest(".ag-comments") || t.closest(".ag-wendao") || t.closest(".ag-tags") || t.closest(".ag-cast") || t.closest(".ag-owner") || t.closest(".ag-sub-grid") || t.closest("model-viewer") || t.closest(".ag-stage"))) return;
      var card = t.closest && t.closest(".ag-card[data-actor]");
      if (!card || !card.parentElement || !card.parentElement.classList.contains("ag-grid")) return;
      var onCover = !!(t.closest && t.closest("[data-cover]"));
      if (card.classList.contains("expanded")) {
        if (onCover && card.__actor) window.__agToggleCover(card, card.__actor);   // 封面 2D↔3D 切换
        else toggleExpand(card);                                                   // 点信息区 = 收起
      } else {
        toggleExpand(card);                                                        // 展开(封面转 3D)
      }
    });
    document.addEventListener("keydown", function onKey(ev) {
      if (ev.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
    });
    if (soloId) { state.solo = soloId; loadSoloActor(soloId); }   // 分享深链: 只这一位
    else { state.solo = null; loadActors(); }
  }

  window.cssosOpenActorGallery = open;
  // 分享深链 /?actor=<id>: 打开图鉴并展开该演员(网格异步加载, 轮询到卡片再展开; 不在已加载行内则扩行)。
  window.cssosOpenActor = function (id) {
    if (!id) { open(1); return; }
    open(1, id);   // solo: 只拉这一位演员并展开, 不全量加载(分享进来不会顶不住)。
  };
  function readActorDeeplink() {
    try {
      var m = (location.search || "").match(/[?&]actor=([^&]+)/);
      if (m) {
        try { globalThis.__cssosShareLinkActive = true; } catch (_e2) {}   // W1647 — 再钉一次(DOMContentLoaded 路径)
        try { _agCloseAllPanels(); } catch (_e3) {}                        // W1647 — 分享进来直接关掉已开的 MV/其它面板
        window.cssosOpenActor(decodeURIComponent(m[1]));
      }
    } catch (_e) {}
  }
  if (document.readyState !== "loading") readActorDeeplink();
  else window.addEventListener("DOMContentLoaded", readActorDeeplink);
  // hash 触发(#actors)。
  function checkHash() { if ((location.hash || "").replace(/^#/, "") === "actors") open(); }
  window.addEventListener("hashchange", checkHash);
  if (document.readyState !== "loading") checkHash();
  else window.addEventListener("DOMContentLoaded", checkHash);

  /* ── 永久入口: 🎭 Dock 按钮(照搬 person-mv-open-shim 模式)─────────────── */
  function registerDockAction() {
    try {
      var map = window.__cssosDockActionMap = window.__cssosDockActionMap || {};
      map["actors"] = function () { open(); };
      map["director"] = function () { openDirectorGate(); };   // 🎬 导演入口(数字演员之后)
      window.dockActionMap = window.__cssosDockActionMap;
    } catch (_e) {}
  }
  function mountDockItem() {
    var dock = document.querySelector(".dock") || document.querySelector("#dock");
    if (!dock) return false;
    if (dock.querySelector('[data-action="actors"]')) return true;
    var item = document.createElement("button");
    item.className = "dock-item"; item.type = "button";
    item.setAttribute("data-action", "actors");
    item.setAttribute("data-actions", "click");
    item.setAttribute("data-tooltip", T("Digital Actors", "数字演员"));
    item.setAttribute("aria-label", T("Digital Actors", "数字演员"));
    item.innerHTML = '<span class="dock-ico" aria-hidden="true">🎭</span><span class="dock-label">' + esc(T("Actors", "演员")) + '</span>';
    // W1733 排序 数字演员→导演入口→App, 且与 dock-priority 的 PRIORITY 完全一致(mic,foryou,actors,…)
    //   → 注入即终态、无需重排, 减少首屏抖动。actors 插在 foryou 之后; 无 foryou 再退回 mic 之后。
    var ref = dock.querySelector('[data-action="foryou"]') || dock.querySelector('[data-action="mic"]') || dock.querySelector('[data-action="person-mv"], [data-action="cssmv"], [data-action="watch"]');
    if (ref && ref.nextSibling) dock.insertBefore(item, ref.nextSibling); else dock.appendChild(item);
    item.addEventListener("click", function () { open(); });   // 直连兜底(dock 分发未接管时也能开)
    mountDirectorDockItem(dock);   // actors 之后紧跟 🎬 导演入口(App 再跟其后)
    return true;
  }
  // 🎬 导演入口 dock 项 —— W1544: 紧跟话筒(话筒 → 导演入口 → 数字演员)。
  function mountDirectorDockItem(dock) {
    if (!dock) dock = document.querySelector(".dock") || document.querySelector("#dock");
    if (!dock) return false;
    if (dock.querySelector('[data-action="director"]')) return true;
    var d = document.createElement("button");
    d.className = "dock-item"; d.type = "button";
    d.setAttribute("data-action", "director");
    d.setAttribute("data-actions", "click");
    d.setAttribute("data-tooltip", T("Director", "导演开拍"));
    d.setAttribute("aria-label", T("Director", "导演开拍"));
    d.innerHTML = '<span class="dock-ico" aria-hidden="true">🎬</span><span class="dock-label">' + esc(T("Direct", "开拍")) + '</span>';
    // W1733 — Jing: 数字演员 → 导演入口 → App 相邻同序。director 插在 actors 【之后】。
    //   (旧 W1544 把 director 插在 actors 之前, 与新顺序相反 → 和 dock-priority 排序互相打架,
    //    表现为"刷新时闪一下对了又弹回"。源头理顺成 actors→director 一条链, 不再有竞态。)
    var actorsEl = dock.querySelector('[data-action="actors"]');
    var mic = dock.querySelector('[data-action="mic"]');
    if (actorsEl) dock.insertBefore(d, actorsEl.nextSibling);        // actors → director(nextSibling 为 null 时等于追加)
    else if (mic && mic.nextSibling) dock.insertBefore(d, mic.nextSibling);
    else dock.appendChild(d);
    d.addEventListener("click", function () { openDirectorGate(); });   // 直连兜底
    return true;
  }
  function ensureDockItem(retries) {
    if (mountDockItem()) return;
    if (retries <= 0) return;
    setTimeout(function () { ensureDockItem(retries - 1); }, 400);
  }
  registerDockAction();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { ensureDockItem(20); });
  else ensureDockItem(20);
  // dock 若重渲染把按钮抹掉 → 观察补回(防御式, 同其他模块做法)。
  try {
    var mo = new MutationObserver(function () { mountDockItem(); });
    var dockEl = document.querySelector(".dock") || document.querySelector("#dock");
    if (dockEl) mo.observe(dockEl, { childList: true });
  } catch (_e) {}
})();
