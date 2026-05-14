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
      /* Animated emerald orb — same breathing rhythm as the brand
         mirror, scaled tiny. Pure CSS so no asset load delay. */
      ".cssos-buffering-mirror .orb{width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 35% 30%, rgba(94,255,201,0.95), rgba(0,180,140,0.7) 45%, rgba(0,80,60,0.4) 75%, rgba(0,30,20,0.0) 100%);box-shadow:0 0 28px rgba(0,245,160,0.55), inset 0 0 18px rgba(255,255,255,0.18);animation:cssosBufBreath 1.4s ease-in-out infinite;}",
      "@keyframes cssosBufBreath{0%,100%{transform:scale(0.86);opacity:0.62;}50%{transform:scale(1.04);opacity:1;}}",
      ".cssos-buffering-mirror .label{position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);font:600 10.5px/1 ui-monospace,monospace;color:rgba(255,255,255,0.7);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,0.7);}",
    ].join("\n");
    document.head.appendChild(st);
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
    overlay.innerHTML = '<div class="orb"></div><div class="label">BUFFERING</div>';
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
