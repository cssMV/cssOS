/* CSSOS_WAVE_421 20260525 — Jing「游客在 For You 翻到老作品 → 黑屏/纯色块, 像坏了」
 *
 * Root cause: pre-persistence works stored their video / slideshow frames as
 * third-party TEMP links (replicate.delivery / *.fal.media) that have since
 * expired (404). When such a work plays, #watch-video errors and #watch-svg's
 * frame fails to load → the frame goes BLACK, or only the theme accent shows
 * (a solid colored block). To a guest that reads as "broken".
 *
 * This module is PURELY ADDITIVE — it never sets a src, never mutes/plays, never
 * touches the W406/407 audio/video authority. It only REACTS to genuine load
 * failures:
 *   • #watch-video 'error'  → hide the dead <video>, reveal the frame layer.
 *   • #watch-svg   'error'  → that frame URL is dead → show a branded placeholder.
 *   • #watch-svg   'load'   → a real frame is showing → hide the placeholder.
 *   • debounced check on watch activity → if NEITHER the video nor the frame has
 *     any pixels (the "solid color block / no media at all" case), show the
 *     placeholder so the screen is never an empty black/colored void.
 * The placeholder is a branded gradient card (魔镜 + CSS Studio), so a dead old
 * work degrades gracefully instead of looking broken.
 */
(function () {
  "use strict";
  if (window.__cssosDeadMediaInstalled) return;
  window.__cssosDeadMediaInstalled = true;

  var STYLE_ID = "cssmv-deadmedia-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = [
      "#watch-panel .watch-screen .cssmv-deadmedia{",
      "  position:absolute;inset:0;z-index:3;display:none;",
      "  align-items:center;justify-content:center;flex-direction:column;gap:10px;",
      "  background:radial-gradient(120% 120% at 50% 30%,",
      "    color-mix(in srgb, var(--watch-frame-accent-1, #00f5a0) 22%, #0a1512) 0%,",
      "    #0a1512 70%);",
      "  pointer-events:none;text-align:center;padding:24px;",
      "}",
      "#watch-panel .watch-screen .cssmv-deadmedia.is-on{display:flex;}",
      ".cssmv-deadmedia-logo{width:76px;height:76px;line-height:0;filter:drop-shadow(0 2px 12px rgba(0,0,0,0.5));}",
      ".cssmv-deadmedia-logo img{width:100%;height:100%;object-fit:contain;display:block;}",
      ".cssmv-deadmedia-text{font:700 17px/1.3 \"Syne\",system-ui,sans-serif;",
      "  color:rgba(255,255,255,0.92);letter-spacing:0.04em;text-shadow:0 1px 8px rgba(0,0,0,0.6);}",
      ".cssmv-deadmedia-sub{font:500 12px/1.4 system-ui,sans-serif;color:rgba(255,255,255,0.62);max-width:240px;}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function screenEl() { return document.querySelector("#watch-panel .watch-screen"); }
  function ensurePlaceholder() {
    var screen = screenEl();
    if (!screen) return null;
    var p = screen.querySelector(".cssmv-deadmedia");
    if (!p) {
      injectStyle();
      p = document.createElement("div");
      p.className = "cssmv-deadmedia";
      // i18n via loginCopy/tr when available; English-default platform.
      var t1 = "CSS Studio";
      var sub = "Preview unavailable — tap ✨ to make one like this";
      try {
        if (typeof globalThis.loginCopy === "function") {
          sub = globalThis.loginCopy("Preview unavailable — tap ✨ to make one like this");
        } else if (typeof globalThis.tr === "function") {
          sub = globalThis.tr("Preview unavailable — tap ✨ to make one like this");
        }
      } catch (_e) {}
      /* CSSOS_WAVE_1842 (Jing 走查:「这个不是我们的 logo, 为什么不使用我们平台的 logo?」)
       * 原来这里放的是 emoji 🪞 —— 它由【系统字体】渲染, iOS 上是一面带红棕色手柄的小镜子,
       * 和我们的魔镜毫无关系。而这个占位恰恰出现在【画面加载失败】的时刻 —— 用户最需要
       * 认出"这是 CSS Studio 而不是坏了"的那一刻, 看到的却是苹果的美术。
       * 换成平台真身 assets/mirror-1.webp(logo 用的同一张)。
       * onerror 直接把节点移除, 退化成纯文字, 绝不退回 emoji —— 品牌位宁可空着,
       * 也不能长成别人的样子。 */
      p.innerHTML =
        '<div class="cssmv-deadmedia-logo">' +
          '<img src="assets/mirror-1.webp" alt="CSS Studio" ' +
               'onerror="this.parentNode &amp;&amp; this.parentNode.remove()" />' +
        '</div>' +
        '<div class="cssmv-deadmedia-text">' + t1 + '</div>' +
        '<div class="cssmv-deadmedia-sub">' + sub + '</div>';
      screen.appendChild(p);
    }
    return p;
  }
  function setPlaceholder(on) {
    var p = ensurePlaceholder();
    if (p) p.classList.toggle("is-on", !!on);
  }

  function videoHasPixels(v) {
    return !!(v && !v.error && v.videoWidth > 0 && v.style.display !== "none");
  }
  function svgHasPixels(s) {
    return !!(s && s.style.display !== "none" && s.getAttribute("src") &&
      (s.naturalWidth > 0 || s.complete === false /* still loading → optimistic */));
  }

  // Decide placeholder visibility from current media reality. CONSERVATIVE:
  // only assert "dead" on real failure evidence — never flash during normal load.
  function reassess() {
    var v = document.getElementById("watch-video");
    var s = document.getElementById("watch-svg");
    var videoOk = videoHasPixels(v);
    var svgOk = !!(s && s.naturalWidth > 0 && s.style.display !== "none");
    if (videoOk || svgOk) { setPlaceholder(false); return; } // something real is showing

    // Is the video still legitimately loading (has a source, no error, not enough
    // data yet)? If so, do NOT show the placeholder — wait for it.
    var videoLoading = !!(v && v.currentSrc && !v.error && v.readyState < 2 && v.style.display !== "none");
    // Is the frame image still fetching its src?
    var svgSrc = s && s.getAttribute("src");
    var svgLoading = !!(svgSrc && s && !s.complete);
    if (videoLoading || svgLoading) return; // mid-load — give it time

    // Real failure evidence: video errored / has no source, AND no frame pixels.
    var videoDead = !v || v.error || !v.currentSrc || v.style.display === "none";
    if (videoDead && !svgOk) setPlaceholder(true);
  }

  function bind() {
    var v = document.getElementById("watch-video");
    var s = document.getElementById("watch-svg");
    if (v && !v.__cssosDeadBound) {
      v.__cssosDeadBound = true;
      v.addEventListener("error", function () {
        try { v.style.display = "none"; } catch (_e) {}
        if (s) { try { s.style.display = ""; } catch (_e) {} }
        setTimeout(reassess, 50);
      }, true);
      // a healthy video playing should clear any placeholder
      v.addEventListener("playing", function () { setPlaceholder(false); });
      v.addEventListener("loadeddata", function () { if (videoHasPixels(v)) setPlaceholder(false); });
    }
    if (s && !s.__cssosDeadBound) {
      s.__cssosDeadBound = true;
      s.addEventListener("error", function () { setTimeout(reassess, 50); }, true);
      s.addEventListener("load", function () {
        if (s.naturalWidth > 0) setPlaceholder(false);
      });
    }
  }

  // Debounced reassessment when the watch subtree mutates (new work loaded, src
  // swapped, etc.). Never runs while nothing is happening.
  var pending = 0;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = 0; try { bind(); reassess(); } catch (_e) {} }, 400);
  }

  function boot() {
    bind();
    var host = document.getElementById("watch-panel") || document.body;
    try {
      var mo = new MutationObserver(schedule);
      mo.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "style"] });
    } catch (_e) {}
    // a couple of delayed passes as the watch wires up
    [600, 1800, 4000].forEach(function (ms) { setTimeout(function () { try { bind(); reassess(); } catch (_e) {} }, ms); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
