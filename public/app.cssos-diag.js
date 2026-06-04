/* CSSOS_WAVE_486c 20260529 — Jing「登录后还是闪」远程诊断探针.
 * 手机无控制台、Safari 地址栏剥离 javascript: → 改用"打开特殊网址即自动回传现场快照"。
 * 触发: URL 含 ?cssosdiag=1 (或 #cssosdiag)。每 3s 采一帧, 把认证态主屏/影院的关键
 * 负载指标 beacon 到 /api/admin/crash-log(kind=diag), 服务器侧可读。捕获崩溃前的现场。
 * 仅诊断、只读、无副作用; 不在该 flag 下则完全不运行。 */
(function () {
  "use strict";
  // W491b — auto-enable in the native App (cssos-ios) too, so we get crash/uptime telemetry
  // WITHOUT needing the ?cssosdiag URL param (the App's URL is fixed). In App mode we run
  // LIGHTWEIGHT: only performance.now()/build/dom — skip the heavy getComputedStyle scans.
  // CSSOS_WAVE_499b 20260529 — Jing「A: 先送审」: 审核/生产版【只在显式 ?cssosdiag 时运行】,
  // 不再在 App 里自动心跳(避免给所有用户跑诊断+发遥测)。验证懒加载迁移时仍可用 Safari
  // 打开 ?cssosdiag=1 取数据。需要重新打开 App 心跳时, 临时把下面改回即可。
  var APP_HEARTBEAT = false;
  try {
    var q = String(location.search || "") + " " + String(location.hash || "");
    if (!/cssosdiag/i.test(q)) return;
  } catch (_e) { return; }

  function snap() {
    var d = {};
    try {
      // W490i — decisive reload-vs-loop probe: performance.now() = ms since THIS page started.
      // If it resets to ~400-1500 each beacon → crash-reload. If it climbs (5000,10000…) → in-page loop.
      try { d.t = Math.round(performance.now()); } catch (_e) {}
      d.build = String(window.__CSSOS_BUILD || "?");
      d.app = document.documentElement.classList.contains("cssos-app");
      d.cap = !!(window.Capacitor);
      d.hash = String(location.hash || "").slice(0, 40);
      // auth signal
      try { d.authed = !!(globalThis.authState && globalThis.authState.user); } catch (_e) { d.authed = "?"; }
      // watch / cinema open?
      var wp = document.getElementById("watch-panel");
      d.watchOpen = !!(wp && wp.classList && !wp.classList.contains("hidden")
        && (wp.classList.contains("panel-front") || wp.classList.contains("is-cssmv-fullscreen") || wp.classList.contains("maximized")));
      // element load
      d.imgs = document.querySelectorAll("img").length;
      d.imgSlides = document.querySelectorAll("img[data-slides]").length;
      d.videos = document.querySelectorAll("video").length;
      d.audios = document.querySelectorAll("audio").length;
      var playingV = 0, playingA = 0;
      Array.prototype.forEach.call(document.querySelectorAll("video"), function (v) { if (!v.paused && !v.ended) playingV++; });
      Array.prototype.forEach.call(document.querySelectorAll("audio"), function (a) { if (!a.paused && !a.ended) playingA++; });
      d.playingV = playingV; d.playingA = playingA;
      d.panelsFront = document.querySelectorAll(".panel-front,.panel-active").length;
      d.workCards = document.querySelectorAll(".work-card,[data-work-id]").length;
      d.marketCards = document.querySelectorAll(".market-card,.foryou-shelf-card").length;
      d.bgBlobs = document.querySelectorAll(".bg-blob").length;
      // W486d — leak + heavy-element probes
      d.domNodes = document.getElementsByTagName("*").length;     // grows over time = leak
      // W498 — memory attribution probe: who's eating RAM?
      try {
        var pm = (performance && performance.memory) || null; // Chrome/desktop only
        if (pm) { d.heapMB = Math.round(pm.usedJSHeapSize/1048576); d.heapLimitMB = Math.round(pm.jsHeapSizeLimit/1048576); }
      } catch (_e) {}
      try { // # of app modules loaded (each app.*.js adds cssos*/cssmv*/__cssos* globals + state)
        var mg=0; for (var k in window) { if (/^(cssos|cssmv|__cssos)/i.test(k)) mg++; } d.modules = mg;
      } catch (_e) {}
      try { // CSSOM weight: total style rules + bytes (the app's style.css is ~13k lines)
        var rules=0, cssBytes=0, sheets=document.styleSheets, sc=0;
        for (var si=0; si<sheets.length; si++) { try { var rs=sheets[si].cssRules; if(rs){rules+=rs.length;} sc++; } catch(_e){} }
        Array.prototype.forEach.call(document.querySelectorAll("style"), function(st){ cssBytes += (st.textContent||"").length; });
        d.cssRules=rules; d.styleTagsKB=Math.round(cssBytes/1024); d.sheets=sc;
      } catch (_e) {}
      try { d.scripts = document.querySelectorAll("script[src]").length; } catch (_e) {}
      try { var lb=0; for (var i=0;i<localStorage.length;i++){var kk=localStorage.key(i);lb+=(kk||"").length+(localStorage.getItem(kk)||"").length;} d.lsKB=Math.round(lb/1024); } catch (_e) {}
      // W491b — App heartbeat: stop here (skip heavy getComputedStyle scans) to stay cheap.
      if (APP_HEARTBEAT) return d;
      d.canvases = document.querySelectorAll("canvas").length;
      d.skels = document.querySelectorAll("[class*='skel'],[class*='shimmer']").length;
      // W490j — image decode memory probe (prime suspect for the ~2-3s OOM crash).
      try {
        var mp = 0, maxA = 0, maxInfo = "";
        Array.prototype.forEach.call(document.querySelectorAll("img"), function (im) {
          var w = im.naturalWidth || 0, h = im.naturalHeight || 0, a = w * h;
          mp += a;
          if (a > maxA) { maxA = a; maxInfo = w + "x" + h + ":" + String(im.currentSrc || im.src || "").split("/").pop().slice(0, 28); }
        });
        d.imgMP = Math.round(mp / 1e6 * 10) / 10; // megapixels total
        d.imgBmpMB = Math.round(mp * 4 / 1048576); // approx decoded bytes (RGBA)
        d.maxImg = maxInfo;
        // also CSS background-image count (covers often use bg-image, not <img>)
        var bgCount = 0, all = document.querySelectorAll("*"), cap = Math.min(all.length, 1500);
        for (var bi = 0; bi < cap; bi++) { var b = getComputedStyle(all[bi]).backgroundImage; if (b && b.indexOf("url(") >= 0) bgCount++; }
        d.bgImgs = bgCount + (all.length > cap ? "+" : "");
      } catch (_e) {}
      var vsrc = 0, vready = 0;
      Array.prototype.forEach.call(document.querySelectorAll("video"), function (v) {
        if (v.currentSrc || v.src) vsrc++; vready += (v.readyState || 0);
      });
      d.videoSrc = vsrc; d.videoReady = vready;
      var asrc = 0;
      Array.prototype.forEach.call(document.querySelectorAll("audio"), function (a) { if (a.currentSrc || a.src) asrc++; });
      d.audioSrc = asrc;
      // W490c — locate the container that balloons (~2800 nodes built/torn repeatedly).
      // Report subtree size of major sections + the single largest direct child of <body>.
      try {
        var cands = ["#works-list-dynamic",".works-list",".works-list-results","#foryou","[id*='foryou']","[class*='foryou']","[class*='for-you']","[class*='leaderboard']","[id*='market']","[class*='market']",".workspace-grid","main.stage",".feed","[class*='shelf']"];
        var sizes = {};
        cands.forEach(function (s) {
          try { var n=0; document.querySelectorAll(s).forEach(function(el){ n+=el.getElementsByTagName("*").length; }); if(n>0) sizes[s]=n; } catch(_e){}
        });
        d.sec = sizes;
        // biggest direct subtree under body
        var big="",bigN=0;
        Array.prototype.forEach.call(document.body ? document.body.children : [], function(el){ var n=el.getElementsByTagName("*").length; if(n>bigN){bigN=n; big=(el.id||el.className||el.tagName).toString().slice(0,40);} });
        d.biggest=big; d.biggestN=bigN;
      } catch (_e) {}
      // count elements currently running a CSS animation (best-effort, capped scan)
      try {
        var anim = 0, all = document.querySelectorAll("*"), cap = Math.min(all.length, 1200);
        for (var i = 0; i < cap; i++) { var cs = getComputedStyle(all[i]); if (cs && cs.animationName && cs.animationName !== "none") anim++; }
        d.animEls = anim + (all.length > cap ? "+" : "");
      } catch (_e) {}
      // JS heap if exposed (Chrome only; Safari = undefined)
      try { if (performance && performance.memory) d.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576); } catch (_e) {}
      // any element with live backdrop-filter currently in DOM & visible-ish
      d.front = (function(){ try { var f=document.querySelector(".panel-front,.panel-active"); return f? (f.id||f.className||"").toString().slice(0,40):""; } catch(_e){return"";} })();
    } catch (_e) { d.err = String(_e && _e.message).slice(0, 80); }
    return d;
  }

  function send() {
    var d = snap();
    var msg = "MEM heap=" + d.heapMB + "/" + d.heapLimitMB + "MB modules=" + d.modules
      + " cssRules=" + d.cssRules + " styleKB=" + d.styleTagsKB + " sheets=" + d.sheets
      + " scripts=" + d.scripts + " lsKB=" + d.lsKB + " imgBmpMB=" + d.imgBmpMB + " dom=" + d.domNodes
      + " | t=" + d.t + "ms b=" + d.build + " authed=" + d.authed + " watch=" + d.watchOpen
      + " dom=" + d.domNodes + " vid=" + d.videos + "/src" + d.videoSrc + "/rdy" + d.videoReady
      + " aud=" + d.audios + "/src" + d.audioSrc + " canvas=" + d.canvases + " anim=" + d.animEls
      + " imgMP=" + d.imgMP + " bmpMB=" + d.imgBmpMB + " maxImg=" + d.maxImg + " bgImgs=" + d.bgImgs
      + " big=" + d.biggest + "(" + d.biggestN + ")";
    var stack = JSON.stringify(d);
    try {
      fetch("/api/admin/crash-log", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "diag", message: msg, stack: stack, url: location.href, ua: navigator.userAgent }),
        keepalive: true,
      }).catch(function () {});
    } catch (_e) {}
  }

  // W490e — fire VERY early (400/800ms) to capture the authenticated home's state
  // BEFORE the sub-1-second crash that hits right after login-reload. Then keep sampling.
  setTimeout(send, 400);
  setTimeout(send, 800);
  setTimeout(send, 1500);
  var n = 0;
  var t = setInterval(function () { n++; if (n > 12) { clearInterval(t); return; } send(); }, 2000);
})();
