/* CSSOS_WAVE_140 20260514 — Jing
 *
 * Show the breathing mirror logo (small, Apple-boot-logo size) over
 * any <video> or <audio> when it stalls / buffers. Disappears on the
 * playing / canplay event.
 *
 * Auto-attached to all media elements via delegated event listeners.
 * No per-element setup required — works for media added after page
 * load (chat work cards, MV panel, marketplace).
 */
(function () {
  if (globalThis.__cssosBufferingMirrorWired) return;
  globalThis.__cssosBufferingMirrorWired = true;

  function injectStyles() {
    if (document.getElementById("cssos-buffering-mirror-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-buffering-mirror-style";
    st.textContent = [
      /* The overlay floats absolutely over its parent media element.
         Parent must be position:relative — we set that on demand. */
      ".cssos-buffering-mirror{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:130px;height:130px;max-width:28vw;max-height:28vw;pointer-events:none;z-index:50;display:none;}",
      ".cssos-buffering-mirror.is-active{display:block;}",
      /* CSSOS_WAVE_144 20260514 — Jing: 不再只是 CSS orb. 用真正的魔镜
         两张图片 (mirror-1.webp + mirror-2.webp) 交替急促呼吸 + 随机色
         的径向背景。 */
      ".cssos-buffering-mirror .bg{position:absolute;inset:-10%;border-radius:50%;filter:blur(8px);opacity:0.55;animation:cssosBufBgPulse 1.4s ease-in-out infinite;}",
      /* CSSOS_WAVE_347 — Jing: 魔镜图加载失败时, 不要单独留一坨随机色背景. */
      ".cssos-buffering-mirror.img-failed .bg{display:none;}",
      ".cssos-buffering-mirror .mirror-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;}",
      ".cssos-buffering-mirror .mirror-img.a{animation:cssosBufFadeA 1.4s ease-in-out infinite;}",
      ".cssos-buffering-mirror .mirror-img.b{animation:cssosBufFadeB 1.4s ease-in-out infinite;}",
      "@keyframes cssosBufFadeA{0%,100%{opacity:1;transform:scale(0.96);}50%{opacity:0;transform:scale(1.06);}}",
      "@keyframes cssosBufFadeB{0%,100%{opacity:0;transform:scale(1.06);}50%{opacity:1;transform:scale(0.96);}}",
      "@keyframes cssosBufBgPulse{0%,100%{transform:scale(0.88);opacity:0.4;}50%{transform:scale(1.08);opacity:0.7;}}",
      ".cssos-buffering-mirror .label{position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);font:600 10.5px/1 ui-monospace,monospace;color:rgba(255,255,255,0.85);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,0.8);}",
    ].join("\n");
    document.head.appendChild(st);
  }

  // CSSOS_WAVE_144 — random color picked once per overlay instance so
  // each media element gets its own backdrop tint.
  function randomMirrorBgGradient() {
    var hue = Math.floor(Math.random() * 360);
    var hue2 = (hue + 30 + Math.floor(Math.random() * 60)) % 360;
    return "radial-gradient(circle at 35% 30%, hsl(" + hue + ", 75%, 55%), hsl("
      + hue2 + ", 70%, 30%) 60%, hsl(" + ((hue + 180) % 360) + ", 50%, 12%) 100%)";
  }

  function ensureOverlayOn(media) {
    if (!media || media.__cssosBufferingWired) return;
    media.__cssosBufferingWired = true;
    var parent = media.parentElement;
    if (!parent) return;
    // Parent must accept absolute positioning. If it's not already
    // positioned, force relative — minimal layout impact.
    try {
      var cs = window.getComputedStyle(parent);
      if (cs && cs.position === "static") parent.style.position = "relative";
    } catch (_) {}
    var overlay = document.createElement("div");
    overlay.className = "cssos-buffering-mirror";
    // CSSOS_WAVE_347 20260522 — Jing: 魔镜图老是不出来(只剩随机色背景):
    // 1) 用绝对路径 /assets/... — 相对 "assets/..." 在非根路由下会 404.
    // 2) 任一张图加载失败就把整个 overlay 标记 .img-failed, CSS 隐藏随机色
    //    背景 blob —— 宁可什么都不显示, 也不要留一坨突兀的随机色块.
    overlay.innerHTML = ''
      + '<div class="bg" style="background:' + randomMirrorBgGradient() + ';"></div>'
      + '<img class="mirror-img a" src="/assets/mirror-1.webp" alt="" aria-hidden="true">'
      + '<img class="mirror-img b" src="/assets/mirror-2.webp" alt="" aria-hidden="true">';
    // CSSOS_WAVE_144B — Jing: "Buffering 去掉". Label removed; the
    // breathing mirror + random-tint backdrop alone convey the loading
    // state.
    parent.appendChild(overlay);
    try {
      overlay.querySelectorAll("img.mirror-img").forEach(function (im) {
        im.addEventListener("error", function () { overlay.classList.add("img-failed"); });
      });
    } catch (_e) {}
    // CSSOS_WAVE_355 — Jing「魔镜从头转到尾」根因: watch 里 #watch-video 是
    // 【静音装饰画面】(W279 muted autoplay), 声音走 #watch-audio-preview. 静音
    // video 在封面式 MV 里没有真实视频帧, 一旦 'waiting' 触发就再也不会 'playing'/
    // 'timeupdate' → 魔镜永远卡在 is-active, 正常播放时也一直呼吸.
    // 规则收敛为: 【任何静音 media 都是背景/装饰, 一律不驱动魔镜】. 用户真正在
    // 欣赏的是有声那条(unmuted audio-preview 或带声视频); 真视频 MV(不静音)卡顿
    // 时仍正常显示魔镜.
    var isBackgroundMedia = function () {
      try {
        if (media.muted) return true;                       // 静音 = 背景/装饰
        if (media.id === "watch-video") return true;        // watch 视觉层, 非播放焦点
      } catch (_e) {}
      return false;
    };
    var show = function () {
      // CSSOS_WAVE_276 20260521 — Jing: 预加载魔镜只在【真正缓冲/卡顿】时显示,
      // 不能常亮挡住正在欣赏的 MV. 而且只在该 media 确实"正在播放但卡住"时才显,
      // 暂停 / 无 src / 空闲(如 MV 模式下 idle 的 audio-preview)一律不显示 ——
      // 否则会出现"两个 logo 呼吸打架"(video + 闲置 audio 各挂一个).
      try {
        if (isBackgroundMedia()) return;
        if (media.paused || media.ended) return;
        if (!String(media.currentSrc || media.src || "").trim()) return;
      } catch (_e) {}
      overlay.classList.add("is-active");
    };
    var hide = function () { overlay.classList.remove("is-active"); };
    // CSSOS_WAVE_355 — Jing: 全局兜底. 任何【有声】media 真在播放/前进时, 清掉
    // 页面上所有残留魔镜 —— 杜绝某个元素的 spinner 卡死后赖着不走.
    var hideAll = function () {
      try {
        if (media.muted) { hide(); return; }
        document.querySelectorAll(".cssos-buffering-mirror.is-active")
          .forEach(function (o) { o.classList.remove("is-active"); });
      } catch (_e) { hide(); }
    };
    // 只挂"卡顿"事件; 去掉 loadstart / seeking —— 它们在正常起播 / 设 src /
    // 拖动时也会触发, 导致魔镜常亮或卡死显示. 真正的拖动缓冲仍会触发 waiting.
    media.addEventListener("waiting", show);
    media.addEventListener("stalled", show);
    media.addEventListener("playing", hideAll);
    media.addEventListener("canplay", hide);
    media.addEventListener("canplaythrough", hide);
    media.addEventListener("pause", hide);
    media.addEventListener("ended", hide);
    media.addEventListener("error", hide);
    // CSSOS_WAVE_347/355 — 兜底: 只要时间在前进(真在播放), 立刻收起所有魔镜 ——
    // 杜绝 waiting 之后 playing 没补发导致魔镜赖着不走.
    media.addEventListener("timeupdate", hideAll);
  }

  function scan() {
    document.querySelectorAll("video,audio").forEach(ensureOverlayOn);
  }

  function start() {
    injectStyles();
    scan();
    // Mutation observer catches media added after first paint.
    try {
      var mo = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var rec = records[i];
          if (!rec.addedNodes) continue;
          for (var j = 0; j < rec.addedNodes.length; j++) {
            var n = rec.addedNodes[j];
            if (!n || n.nodeType !== 1) continue;
            if (n.tagName === "VIDEO" || n.tagName === "AUDIO") {
              ensureOverlayOn(n);
            } else if (typeof n.querySelectorAll === "function") {
              n.querySelectorAll("video,audio").forEach(ensureOverlayOn);
            }
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (_) {
      // No MutationObserver — fall back to periodic scan.
      setInterval(scan, 3000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
