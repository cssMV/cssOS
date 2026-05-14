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
    overlay.innerHTML = ''
      + '<div class="bg" style="background:' + randomMirrorBgGradient() + ';"></div>'
      + '<img class="mirror-img a" src="assets/mirror-1.webp" alt="" aria-hidden="true">'
      + '<img class="mirror-img b" src="assets/mirror-2.webp" alt="" aria-hidden="true">'
      + '<div class="label">BUFFERING</div>';
    parent.appendChild(overlay);
    var show = function () { overlay.classList.add("is-active"); };
    var hide = function () { overlay.classList.remove("is-active"); };
    media.addEventListener("waiting", show);
    media.addEventListener("stalled", show);
    media.addEventListener("loadstart", show);
    media.addEventListener("seeking", show);
    media.addEventListener("playing", hide);
    media.addEventListener("canplay", hide);
    media.addEventListener("canplaythrough", hide);
    media.addEventListener("pause", hide);
    media.addEventListener("ended", hide);
    media.addEventListener("error", hide);
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
