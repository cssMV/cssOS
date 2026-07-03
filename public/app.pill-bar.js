/* app.pill-bar.js — cssOS Pill Bar Constitution v28 + Chromatic Edition
 * ============================================================================
 * USAGE
 *   var bar = cssosMakePillBar(containerEl, {
 *     onActivate : function(key, btnEl) {},  // called when user clicks a pill
 *     activeKey  : 'system',                 // initial active key (optional)
 *     textColor  : 'light',                  // 'light'(default)|'dark'
 *     compact    : false,                    // true = no outer margin (toolbar)
 *     mono       : false,                    // true = single brand-green (classic)
 *   });
 *   bar.setActive('dark');    // programmatic activation
 *   bar.show() / bar.hide()
 *   bar.destroy();            // restore original DOM state
 *
 * By default every pill gets its own hue from a 12-step spectrum palette.
 * The track border + background follows the active pill's hue automatically.
 * Pass  mono:true  to revert to single brand-green (classic mode).
 *
 * cssosPillBarStamp(el, textColor)  — CSS-only stamp, no click/active JS.
 *
 * Implementation notes:
 *   1. <style> injected AFTER all <link> sheets → source-order wins all ties.
 *   2. [data-pill-bar] on container, [data-pill-key] on each child.
 *   3. --ph (pill hue) set inline per child; --th (track hue) set on container.
 *   4. all !important so all:unset / component CSS cannot win.
 * ============================================================================ */
(function () {
  "use strict";

  /* ── Chromatic palette — 12 evenly-spaced perceptually-varied hues ────────
   * Index  0   1    2    3    4    5    6   7   8    9   10   11
   * Color  teal aqua blue viol pink red  org yel lime grn mint sky         */
  var HUES = [155, 192, 235, 268, 310, 342, 22, 48, 82, 118, 168, 210];

  /* ── CSS injected once ────────────────────────────────────────────────── */
  var STYLE_ID = "cssos-pill-bar-constitution";

  var CSS = (function () {
    /* All geometry via !important; colors reference CSS custom props --ph / --th
     * so a single CSS block handles every hue without duplication.            */
    var LIGHT_TEXT = "rgba(218,255,238,0.82)";
    var DARK_TEXT  = "rgba(14,40,28,0.88)";

    return [
      /* ── TRACK — CSS Grid so 100% in children = CELL width, not container.
       * Flex made calc(100%+20px) resolve to container-width+20px → 通栏.
       * Grid cell 100% = that pill's own column → calc(100%+20px) correct. ── */
      "[data-pill-bar]{",
        "display:grid !important;",
        "grid-auto-flow:column !important;",
        "grid-auto-columns:minmax(max-content,1fr) !important;",
        "gap:0 !important;",
        "padding:0 !important;margin:14px 0 !important;",
        "height:42px !important;min-height:42px !important;",
        "background:hsla(var(--th,155),60%,20%,0.10) !important;",
        "border:1px solid hsla(var(--th,155),100%,65%,0.30) !important;",
        "border-radius:999px !important;",
        "overflow-x:auto !important;overflow-y:clip !important;",
        "scrollbar-width:none;-webkit-overflow-scrolling:touch;",
        "align-items:stretch !important;position:relative;",
        "transition:background 260ms ease,border-color 260ms ease;",
      "}",
      "[data-pill-bar]::-webkit-scrollbar{display:none}",

      /* hidden — beats display:flex !important */
      "[data-pill-bar][hidden],[data-pill-bar].is-hidden{display:none !important}",

      /* compact toolbar variant: no outer margin */
      "[data-pill-bar][data-pill-compact]{margin:0 !important}",

      /* ── HERO mode: one oversized pill pokes out of the track ──────────────
       * When the track contains a [data-pill-hero] child:
       *   1. Container switches to overflow:visible so the hero can protrude.
       *   2. The track's visual background/border moves to ::before so the
       *      pill-shaped outline stays contained while content overflows.
       *   3. The hero child grows taller and uses negative y-margins to break
       *      out of the track bounds on both sides.                           */
      "[data-pill-bar]:has([data-pill-hero]){",
        "overflow:visible !important;",
        "background:transparent !important;",
        "border:none !important;",
      "}",
      "[data-pill-bar]:has([data-pill-hero])::before{",
        "content:'' !important;",
        "position:absolute !important;inset:0 !important;",
        "background:hsla(var(--th,155),60%,20%,0.10) !important;",
        "border:1px solid hsla(var(--th,155),100%,65%,0.30) !important;",
        "border-radius:999px !important;",
        "pointer-events:none !important;z-index:0 !important;",
        "transition:background 260ms ease,border-color 260ms ease !important;",
      "}",
      /* Hero pill: protrudes above+below by --pill-hero-overhang (default 8px) */
      "[data-pill-bar]>[data-pill-hero]{",
        "margin-top:calc(-1 * var(--pill-hero-overhang,8px)) !important;",
        "margin-bottom:calc(-1 * var(--pill-hero-overhang,8px)) !important;",
        "height:calc(40px + 2 * var(--pill-hero-overhang,8px)) !important;",
        "min-height:calc(40px + 2 * var(--pill-hero-overhang,8px)) !important;",
        "max-height:none !important;",
        "z-index:3 !important;",
        "border-radius:999px !important;",
        "align-items:center !important;",
      "}",

      /* equal-width mode: all chips share space equally (progress strips) */
      "[data-pill-bar][data-pill-equal]>[data-pill-key]{",
        "flex:1 1 0 !important;min-width:0 !important;",
      "}",

      /* ── VERTICAL mode (left/right Dock) ── */
      "[data-pill-bar][data-pill-vertical]{",
        "flex-direction:column !important;",
        "width:42px !important;height:auto !important;",
        "overflow-x:hidden !important;overflow-y:auto !important;",
        "border-radius:999px !important;",
        "margin:0 !important;",
      "}",
      "[data-pill-bar][data-pill-vertical]>[data-pill-key]{",
        "width:40px !important;min-width:40px !important;max-width:40px !important;",
        "height:auto !important;min-height:40px !important;max-height:none !important;",
        "line-height:1.2 !important;padding:12px 0 !important;",
        "writing-mode:vertical-lr !important;",
      "}",
      /* vertical: active bites above neighbor — concave on BOTTOM of chip above active */
      "[data-pill-bar][data-pill-vertical]>[data-pill-key]:has(+[data-pill-key].active){",
        "margin-right:0 !important;width:40px !important;padding-right:0 !important;",
        "margin-bottom:-20px !important;",
        "height:calc(100% + 20px) !important;padding-bottom:32px !important;",
        "border-radius:999px 999px 0 0 !important;",
        "border-left:0 !important;border-top:1px solid hsla(var(--ph,155),100%,65%,0.32) !important;",
        "-webkit-mask-image:radial-gradient(circle 20px at 20px calc(100% - 20px),transparent 19.5px,#000 20px) !important;",
        "mask-image:radial-gradient(circle 20px at 20px calc(100% - 20px),transparent 19.5px,#000 20px) !important;",
      "}",
      /* vertical: active bites below neighbor — concave on TOP of chip after active */
      "[data-pill-bar][data-pill-vertical]>[data-pill-key].active+[data-pill-key]{",
        "margin-left:0 !important;width:40px !important;padding-left:0 !important;",
        "margin-top:-20px !important;",
        "height:calc(100% + 20px) !important;padding-top:32px !important;",
        "border-radius:0 0 999px 999px !important;",
        "border-left:0 !important;border-bottom:1px solid hsla(var(--ph,155),100%,65%,0.32) !important;",
        "-webkit-mask-image:radial-gradient(circle 20px at 20px 20px,transparent 19.5px,#000 20px) !important;",
        "mask-image:radial-gradient(circle 20px at 20px 20px,transparent 19.5px,#000 20px) !important;",
      "}",

      /* ── CHILD BASE — works on ANY element: button, input, div, span, label… ── */
      "[data-pill-bar]>[data-pill-key]{",
        /* strip native form-control rendering */
        "-webkit-appearance:none !important;appearance:none !important;",
        /* strip native focus ring — we rely on the active bg instead */
        "outline:none !important;",
        "resize:none !important;",          /* textarea */
        "user-select:none !important;-webkit-user-select:none !important;",
        "vertical-align:middle !important;",
        "position:relative !important;z-index:1 !important;",
        "width:100% !important;min-width:max-content !important;",
        "height:40px !important;min-height:40px !important;max-height:40px !important;",
        "line-height:40px !important;padding:0 16px !important;",
        "border:0 !important;margin:0 !important;",
        "border-radius:999px !important;",
        /* subtle own-color tint so pill boundaries are always visible */
        "background:hsla(var(--ph,155),58%,52%,0.09) !important;",
        "-webkit-mask-image:none !important;mask-image:none !important;",
        "box-shadow:none !important;",
        "cursor:pointer !important;font-size:12px;font-weight:500;",
        "white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;",
        "display:inline-flex !important;align-items:center !important;",
        "justify-content:center !important;",
        "transition:background 180ms ease,color 180ms ease;",
        "box-sizing:border-box !important;",
        "color:" + LIGHT_TEXT + " !important;",
        /* inputs / textareas: remove inner padding the browser adds */
        "text-align:center !important;",
      "}",
      /* hide the native checkbox/radio dot — the pill background IS the indicator */
      "[data-pill-bar]>input[type=checkbox][data-pill-key],",
      "[data-pill-bar]>input[type=radio][data-pill-key]{",
        "width:auto !important;",          /* don't shrink to tiny square */
      "}",
      /* select: strip native arrow; dropdown still opens on click */
      "[data-pill-bar]>select[data-pill-key]{",
        "-webkit-appearance:none !important;appearance:none !important;",
        "background-image:none !important;",  /* remove any injected arrow */
      "}",
      /* read-only text nodes (div/span/p): ensure they're clickable */
      "[data-pill-bar]>:not(button):not(a)[data-pill-key]{",
        "pointer-events:auto !important;",
      "}",

      /* dark-text context (light-background panels) */
      "[data-pill-bar][data-pill-text=dark]>[data-pill-key]{",
        "color:" + DARK_TEXT + " !important;",
      "}",

      /* ── ACTIVE — 凸 full pill, saturated own hue ── */
      "[data-pill-bar]>[data-pill-key].active{",
        "border-radius:999px !important;",
        "font-weight:700 !important;",
        "color:#fff !important;",
        "z-index:2 !important;",
        "border:0 !important;",
        "border-left:1px solid hsla(var(--ph,155),100%,68%,0.38) !important;",
        "border-right:1px solid hsla(var(--ph,155),100%,68%,0.38) !important;",
        "background:hsla(var(--ph,155),68%,34%,0.92) !important;",
        "box-shadow:0 0 14px hsla(var(--ph,155),65%,48%,0.50),0 2px 10px rgba(0,0,0,0.22) !important;",
        "margin:0 !important;",
        "-webkit-mask-image:none !important;mask-image:none !important;",
      "}",

      /* ── 活跃右侧所有 (~ 通用兄弟) — 左平右圆，凹向左，每对相邻咬合 ── */
      "[data-pill-bar]>[data-pill-key].active~[data-pill-key]{",
        "border-radius:0 999px 999px 0 !important;",
        "margin-left:-20px !important;",
        "width:calc(100% + 20px) !important;",
        "padding-left:36px !important;",
        "z-index:0 !important;",
        "border-right:1px solid hsla(var(--ph,155),100%,65%,0.32) !important;",
        "-webkit-mask-image:radial-gradient(circle 20px at 0px 50%,transparent 19.5px,#000 20px) !important;",
        "mask-image:radial-gradient(circle 20px at 0px 50%,transparent 19.5px,#000 20px) !important;",
      "}",

      /* ── 活跃左侧所有 (~ 通用兄弟) — 左圆右平，凹向右，每对相邻咬合 ── */
      "[data-pill-bar]>[data-pill-key]:has(~[data-pill-key].active){",
        "border-radius:999px 0 0 999px !important;",
        "margin-right:-20px !important;",
        "width:calc(100% + 20px) !important;",
        "padding-right:36px !important;",
        "z-index:0 !important;",
        "border-left:1px solid hsla(var(--ph,155),100%,65%,0.32) !important;",
        "-webkit-mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;",
        "mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;",
      "}",

      /* ── HERO neighbors (紧邻 only) ── */
      "[data-pill-bar]>[data-pill-hero].active+[data-pill-key]{",
        "-webkit-mask-image:radial-gradient(circle 20px at 0px 50%,transparent 19.5px,#000 20px) !important;",
        "mask-image:radial-gradient(circle 20px at 0px 50%,transparent 19.5px,#000 20px) !important;",
      "}",
      "[data-pill-bar]>[data-pill-key]:has(+[data-pill-hero].active){",
        "-webkit-mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;",
        "mask-image:radial-gradient(circle 20px at 100% 50%,transparent 19.5px,#000 20px) !important;",
      "}",

      /* ── NO-ACTIVE: right border per pill (click-boundary preview) ── */
      "[data-pill-bar]:not(:has(>[data-pill-key].active))>[data-pill-key]{",
        "border-right:1px solid hsla(var(--ph,155),100%,65%,0.28) !important;",
      "}",
      "[data-pill-bar]:not(:has(>[data-pill-key].active))>[data-pill-key]:last-child{",
        "border-right:0 !important;",
      "}",

      /* ── HOVER (inactive only) ── */
      "[data-pill-bar]>[data-pill-key]:not(.active):hover{",
        "background:hsla(var(--ph,155),60%,52%,0.20) !important;",
      "}",
      "[data-pill-bar][data-pill-text=dark]>[data-pill-key]:not(.active):hover{",
        "background:hsla(var(--ph,155),60%,40%,0.22) !important;",
        "color:rgba(4,24,14,0.95) !important;",
      "}",

      /* ── MULTI-SELECT mode (opts.multi) — several pills lit at once ─────────
       * Uses the SAME .active class + concave-convex interlock as single mode
       * (胶囊宪法第⑤条: 靠凹凸镶嵌, 不是各自留缝的圆胶囊). Multiple .active pills
       * simply all light up and mesh; unselected pills are separated by the same
       * hairline border. So NO special visual here — only the JS selection logic
       * differs. Kept data-pill-multi purely so stampOne skips forcing .active.  */

      /* ── DIVIDER between two adjacent INACTIVE pills ───────────────────────
       * 胶囊宪法⑤: 未激活胶囊之间靠一根细边分隔。The concave interlock covers
       * pills AFTER the active (.active~, mask survives), but the BEFORE-active
       * side needs :has(~.active) which is stripped for WebKit crash-safety →
       * left-of-active pills would show NO separator. This `+` rule (no :has,
       * survives the strip) draws the hairline for any inactive-after-inactive
       * pair, so the divider is present no matter which segment is active.      */
      "[data-pill-bar]>[data-pill-key]+[data-pill-key]{",
        "border-left:1px solid hsla(var(--th,155),100%,65%,0.30) !important;",
      "}",

      /* ── INPUT / TEXTAREA pill segment — a search box living inside the track.
       * The child base sets user-select:none + text-align:center + not-text
       * cursor which break typing/editing; restore them for form fields.        */
      "[data-pill-bar]>input[data-pill-key],[data-pill-bar]>textarea[data-pill-key]{",
        "user-select:text !important;-webkit-user-select:text !important;",
        "text-align:left !important;cursor:text !important;",
        /* an <input> can't be concave-masked reliably → never let it overlap a
         * neighbor (would show as 头顶头). It sits flush with the hairline divider. */
        "margin-left:0 !important;margin-right:0 !important;",
        "-webkit-mask-image:none !important;mask-image:none !important;",
        "width:100% !important;",
      "}",
      "[data-pill-bar]>input[data-pill-key].active,[data-pill-bar]>input[data-pill-key].on{cursor:text !important;}",

      /* ── MONO MODE: pin everything to brand green (--ph forced to 155) ─ */
      /* Achieved by JS setting --ph:155 on every child when mono:true.      */

      /* ── :has() FALLBACK (Safari <15.4, Chrome <105) ── */
      "@supports not (selector(:has(*))) {",
        "[data-pill-bar]>[data-pill-key]{",
          "margin:0 !important;width:100% !important;",
          "mask-image:none !important;-webkit-mask-image:none !important;",
        "}",
        "[data-pill-bar]>[data-pill-key]:first-child{border-radius:999px 0 0 999px !important}",
        "[data-pill-bar]>[data-pill-key]:last-child {border-radius:0 999px 999px 0 !important}",
      "}",
    ].join("");
  }());

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    /* CSSOS_WAVE_513b 20260530 — Jing「手机闪退真凶: 注入的 :has() 在 iOS/macOS WebKit 崩」.
     * 这些 :has(~/+ .active) 级联作用在【永远显示的 Dock】等满屏胶囊上, iOS WebKit 样式重算
     * 时匹配它们会进程级崩溃(Mac 勉强扛住, iPhone 必崩; Vision Pro 的 visionOS WebKit 能扛 →
     * 那边正常)。在注入到 DOM 之前, 把每一条【含 :has( 的整条规则】剥掉 —— 浏览器从此看不到
     * :has, 无从崩起。胶囊退化为普通矩形(功能完全无损)。比运行时 observer 更稳(零时序风险)。 */
    var __css = CSS;
    if (__css.indexOf(":has(") !== -1) {
      __css = __css.replace(/[^{}]*:has\([^{}]*\{[^{}]*\}/g, "");
    }
    s.textContent = __css;
    (document.head || document.body).appendChild(s);
  }

  /* ── Key extraction ─────────────────────────────────────────────────────── */
  var KEY_ATTRS = [
    "data-pill-key", "data-theme-mode", "data-civ-mode", "data-tab",
    "data-style-tab", "data-tier", "data-realm", "data-ctier",
    "data-lyrics-input-tab", "data-msrc-tab", "data-panel",
    "data-watch-tab", "data-seed-tab", "data-action", "data-stage",
  ];
  function extractKey(el, idx) {
    for (var i = 0; i < KEY_ATTRS.length; i++) {
      var v = el.getAttribute(KEY_ATTRS[i]);
      if (v) return v;
    }
    return String(idx);
  }

  /* ── Hue assignment ────────────────────────────────────────────────────── */
  function assignHues(children, mono) {
    children.forEach(function (child, idx) {
      var hue = mono ? 155 : HUES[idx % HUES.length];
      child.style.setProperty("--ph", hue);
    });
  }

  /* ── Main API ───────────────────────────────────────────────────────────── */
  function cssosMakePillBar(containerEl, opts) {
    if (!containerEl) return null;
    opts = opts || {};
    var onActivate = typeof opts.onActivate === "function" ? opts.onActivate : null;
    var textColor  = opts.textColor || "light";  // 'light' | 'dark'
    var compact    = !!opts.compact;
    var mono       = !!opts.mono;               // true = single brand green
    var multi      = !!opts.multi;              // true = several pills lit at once (.on)
    var allKey     = opts.allKey != null ? String(opts.allKey) : null; // key that means "all" (collapses others)

    ensureStyle();

    /* Mark container */
    containerEl.setAttribute("data-pill-bar", "");
    if (textColor === "dark") containerEl.setAttribute("data-pill-text", "dark");
    else                      containerEl.removeAttribute("data-pill-text");
    if (compact)              containerEl.setAttribute("data-pill-compact", "");
    else                      containerEl.removeAttribute("data-pill-compact");
    if (multi)                containerEl.setAttribute("data-pill-multi", "");
    else                      containerEl.removeAttribute("data-pill-multi");
    // ★ 必须落成属性: 否则 MutationObserver 的 stampOne(读 data-pill-mono 判定)会在本函数之后
    //   用彩虹色重刷一遍 → mono 绿被覆盖(激活段非第0个时最明显, 如搜索段变蓝)。
    if (mono)                 containerEl.setAttribute("data-pill-mono", "");
    else                      containerEl.removeAttribute("data-pill-mono");

    /* Key + hue every direct child */
    var children = Array.from(containerEl.children);
    children.forEach(function (child, idx) {
      if (!child.getAttribute("data-pill-key")) {
        child.setAttribute("data-pill-key", extractKey(child, idx));
      }
    });
    assignHues(children, mono);

    function childByKey(k) {
      for (var i = 0; i < children.length; i++) {
        if (children[i].getAttribute("data-pill-key") === String(k)) return children[i];
      }
      return null;
    }

    /* ── MULTI-SELECT management ── several .active at once (same class + 凹凸镶嵌
     * as single mode); optional allKey collapses. Selection logic only; visuals
     * are the shared .active CSS.                                              */
    function multiSelected() {
      return children.filter(function (c) {
        return c.classList.contains("active") && !(allKey != null && c.getAttribute("data-pill-key") === allKey);
      }).map(function (c) { return c.getAttribute("data-pill-key"); });
    }
    function multiTrackHue() {
      var onIdx = -1;
      children.forEach(function (c, i) { if (onIdx < 0 && c.classList.contains("active")) onIdx = i; });
      containerEl.style.setProperty("--th", mono ? 155 : HUES[(onIdx < 0 ? 0 : onIdx) % HUES.length]);
    }
    function toggleMulti(pill) {
      var key = pill.getAttribute("data-pill-key");
      if (allKey != null && key === allKey) {
        children.forEach(function (c) { c.classList.toggle("active", c === pill); });
      } else {
        pill.classList.toggle("active");
        if (allKey != null) { var a = childByKey(allKey); if (a) a.classList.remove("active"); }
        // 全不选 或 全选满 → 塌缩回 All 唯一激活(胶囊宪法: 等价"全部")。
        if (allKey != null) {
          var specifics = children.filter(function (c) { return c.getAttribute("data-pill-key") !== allKey; });
          var onCount = specifics.filter(function (c) { return c.classList.contains("active"); }).length;
          if (onCount === 0 || onCount === specifics.length) {
            specifics.forEach(function (c) { c.classList.remove("active"); });
            var a2 = childByKey(allKey); if (a2) a2.classList.add("active");
          }
        }
      }
      multiTrackHue();
      if (onActivate) onActivate(key, pill, multiSelected());
    }
    /* Programmatic multi setter: array of keys (empty ⇒ All). */
    function setSelected(keys) {
      var set = {}; (keys || []).forEach(function (k) { set[String(k)] = true; });
      var any = false;
      children.forEach(function (c) {
        var k = c.getAttribute("data-pill-key");
        if (allKey != null && k === allKey) { c.classList.remove("active"); return; }
        var on = !!set[k]; c.classList.toggle("active", on); if (on) any = true;
      });
      if (!any && allKey != null) { var a = childByKey(allKey); if (a) a.classList.add("active"); }
      multiTrackHue();
    }

    /* Active management */
    function setActive(key) {
      var found = false;
      var activeHue = mono ? 155 : HUES[0];
      children.forEach(function (child, idx) {
        var isActive = child.getAttribute("data-pill-key") === String(key);
        if (isActive) {
          found = true;
          activeHue = mono ? 155 : HUES[idx % HUES.length];
        }
        child.classList.toggle("active", isActive);
      });
      /* Update track hue to match active pill */
      if (found) {
        containerEl.style.setProperty("--th", activeHue);
        requestAnimationFrame(function () {
          var a = containerEl.querySelector("[data-pill-key].active");
          if (a && containerEl.scrollWidth > containerEl.clientWidth) {
            containerEl.scrollLeft = a.offsetLeft - (containerEl.clientWidth - a.offsetWidth) / 2;
          }
        });
      } else {
        containerEl.style.removeProperty("--th");
      }
      return found;
    }

    /* Initial state */
    if (multi) {
      // 多选: 初始点亮 activeKey(可为数组)或默认 All。
      if (Array.isArray(opts.activeKey)) setSelected(opts.activeKey);
      else if (opts.activeKey != null) setSelected([opts.activeKey]);
      else if (allKey != null) { var a0 = childByKey(allKey); if (a0) a0.classList.add("active"); multiTrackHue(); }
      else multiTrackHue();
    } else {
      /* 胶囊宪法: 没指定默认激活就激活第一个(否则剥 :has 后无凹凸镶嵌, 整条散)。 */
      if (opts.activeKey != null) setActive(opts.activeKey);
      else if (children.length) setActive(children[0].getAttribute("data-pill-key"));
    }

    /* Delegated click — works on button / div / span / label / a / textarea */
    function handleClick(e) {
      var pill = e.target.closest("[data-pill-key]");
      if (!pill || pill.parentElement !== containerEl) return;
      /* For radio/checkbox let the browser toggle checked first, then we sync
         via handleChange below — but for everything else activate immediately. */
      var tag = pill.tagName.toLowerCase();
      var isNativeToggle = (tag === "input" &&
        (pill.type === "checkbox" || pill.type === "radio"));
      if (!isNativeToggle) {
        if (multi) { toggleMulti(pill); return; }
        var key = pill.getAttribute("data-pill-key");
        setActive(key);
        if (onActivate) onActivate(key, pill);
      }
    }
    /* Delegated change — radio / checkbox / select */
    function handleChange(e) {
      var pill = e.target.closest("[data-pill-key]");
      if (!pill || pill.parentElement !== containerEl) return;
      var tag = pill.tagName.toLowerCase();
      /* input[radio|checkbox] or select — all drive activation via change */
      if (tag !== "input" && tag !== "select") return;
      var key = pill.getAttribute("data-pill-key");
      setActive(key);
      if (onActivate) onActivate(key, pill);
    }
    containerEl.addEventListener("click", handleClick);
    containerEl.addEventListener("change", handleChange);

    /* Show / hide */
    function show() { containerEl.classList.remove("is-hidden"); containerEl.removeAttribute("hidden"); }
    function hide() { containerEl.classList.add("is-hidden"); }

    /* Teardown */
    function destroy() {
      containerEl.removeEventListener("click", handleClick);
      containerEl.removeEventListener("change", handleChange);
      containerEl.removeAttribute("data-pill-bar");
      containerEl.removeAttribute("data-pill-text");
      containerEl.removeAttribute("data-pill-compact");
      containerEl.removeAttribute("data-pill-multi");
      containerEl.style.removeProperty("--th");
      children.forEach(function (child) {
        child.classList.remove("active");
        child.classList.remove("on");
        child.style.removeProperty("--ph");
      });
    }

    return {
      setActive: setActive, show: show, hide: hide, destroy: destroy, container: containerEl,
      getSelected: multiSelected, setSelected: setSelected,
    };
  }

  /* ── Pure-CSS stamp: geometry only, caller manages .active ─────────────── */
  function cssosPillBarStamp(containerEl, textColor, mono) {
    if (!containerEl) return;
    ensureStyle();
    containerEl.setAttribute("data-pill-bar", "");
    if (textColor === "dark") containerEl.setAttribute("data-pill-text", "dark");
    var children = Array.from(containerEl.children);
    children.forEach(function (child, idx) {
      if (!child.getAttribute("data-pill-key")) {
        child.setAttribute("data-pill-key", extractKey(child, idx));
      }
    });
    assignHues(children, !!mono);
    /* Sync track hue to whichever child already has .active — 没有则默认激活第一个(胶囊宪法)。 */
    var activeIdx = children.findIndex(function (c) { return c.classList.contains("active"); });
    if (activeIdx < 0 && children.length) { children[0].classList.add("active"); activeIdx = 0; }
    if (activeIdx >= 0) {
      containerEl.style.setProperty("--th", mono ? 155 : HUES[activeIdx % HUES.length]);
    }
  }

  globalThis.cssosMakePillBar  = cssosMakePillBar;
  globalThis.cssosPillBarStamp = cssosPillBarStamp;
  globalThis.CSSOS_PILL_HUES   = HUES; /* exported for external use */

  /* ── autoStamp: key + hue one [data-pill-bar] container ────────────────── */
  function stampOne(el) {
    ensureStyle();
    var mono = el.hasAttribute("data-pill-mono");
    var children = Array.from(el.children);
    children.forEach(function (child, idx) {
      if (!child.getAttribute("data-pill-key")) {
        child.setAttribute("data-pill-key", extractKey(child, idx));
      }
    });
    assignHues(children, mono);
    // 多选轨道(cssosMakePillBar multi)自己管 .active(可多个)— stampOne 别再强加/重置,
    // 只同步轨道色到首个 .active。
    if (el.hasAttribute("data-pill-multi")) {
      var onIdx = children.findIndex(function (c) { return c.classList.contains("active"); });
      el.style.setProperty("--th", mono ? 155 : HUES[(onIdx < 0 ? 0 : onIdx) % HUES.length]);
      return;
    }
    var activeIdx = children.findIndex(function (c) { return c.classList.contains("active"); });
    if (activeIdx < 0 && children.length) { children[0].classList.add("active"); activeIdx = 0; }
    if (activeIdx >= 0) {
      el.style.setProperty("--th", mono ? 155 : HUES[activeIdx % HUES.length]);
    }
  }

  /* Stamp all [data-pill-bar] currently in the DOM */
  function autoStampAll() {
    document.querySelectorAll("[data-pill-bar]").forEach(stampOne);
  }

  /* ── MutationObserver — catches popups / modals / dynamic panels ─────────
   * Any time new nodes are added to the document (弹窗打开、面板注入、
   * lazy-loaded component mount), if they contain [data-pill-bar] we
   * stamp them immediately — no manual call needed.                          */
  function observeDynamic() {
    if (!window.MutationObserver) return;
    var mo = new MutationObserver(function (records) {
      records.forEach(function (rec) {
        rec.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return; /* elements only */
          /* The node itself might be a pill bar */
          if (node.hasAttribute && node.hasAttribute("data-pill-bar")) {
            stampOne(node);
          }
          /* Or it might contain pill bars (e.g. a modal wrapper) */
          if (node.querySelectorAll) {
            node.querySelectorAll("[data-pill-bar]").forEach(stampOne);
          }
        });
      });
    });
    mo.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /* Boot — ensureStyle() runs IMMEDIATELY (before DOMContentLoaded) so the
   * <style> tag exists from the first paint and there is zero FOUC. */
  ensureStyle();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      autoStampAll();
      observeDynamic();
    });
  } else {
    autoStampAll();
    observeDynamic();
  }
})();
