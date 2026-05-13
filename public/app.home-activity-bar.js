/* CSSOS_WAVE_108_ACTIVITY_BAR 20260509 — Jing
 *
 * Compact home activity bar — replaces the 5-shelf stack with one
 * single capsule containing 6 (or 7 on festival days) tabs.
 *
 * Tabs (left to right, fixed order unless festival prepends):
 *   [🎉 Festival]  ← only on festival days, prepended
 *   🏆 排行榜       → globalThis.openPersonMvLeaderboard()
 *   ⚔ Epic        → enter "epic" style playlist
 *   🐉 Tang        → enter "tang" style playlist
 *   🌫 Ambient     → enter "ambient" style playlist
 *   🎬 Cinematic   → enter "cinematic" style playlist
 *   🎸 Rock        → enter "rock" style playlist
 *
 * Design rules (per Jing, Wave 108):
 *   - Single rounded capsule, all tabs share one background frame.
 *   - Tabs separated by "/" glyph in muted color.
 *   - Each tab has its own translucent tinted background.
 *   - Horizontally scrollable when content overflows (no scrollbar).
 *   - Width clamped — never wider than the logo panel area; never
 *     covers the top corner pills (version-info / theme toggle).
 *   - Dock-position-aware: top by default, flips to bottom when
 *     dock_position === "top".
 *   - Auto-hide after 10s of no interaction, like the dock.
 *   - First visit: 6s gentle reveal + one-time tooltip
 *     ("Move your mouse here for the activity bar / 鼠标移到这里查看活动").
 *   - Last-active tab persisted to localStorage for next visit.
 *
 * All tap handling routes through cssosTapGuard so a swipe/scroll
 * never accidentally fires a tap. Required global ordering:
 *   load app.tap-guard.js → load this file.
 */
(function () {
  "use strict";

  function tr(en, zh) {
    try {
      var fn = globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.tr;
      if (typeof fn === "function") {
        var t = fn(en);
        if (typeof t === "string") return t;
      }
    } catch (_) {}
    var loc = globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale();
    return /^zh/i.test(String(loc || "")) && zh ? zh : en;
  }

  /* Tab palette — translucent hsl tints (adjust here if Jing wants
   * different colors). Keys are stable tab IDs. */
  var TAB_PALETTE = {
    festival:  "hsla(310, 80%, 60%, 0.20)",  // pink — celebratory
    leaderboard: "hsla(45, 90%, 55%, 0.20)", // gold
    epic:      "hsla(0, 70%, 55%, 0.20)",    // crimson
    tang:      "hsla(35, 80%, 55%, 0.20)",   // amber
    ambient:   "hsla(190, 70%, 55%, 0.20)",  // cyan
    cinematic: "hsla(280, 60%, 60%, 0.20)",  // violet
    rock:      "hsla(340, 75%, 55%, 0.20)",  // magenta
  };

  /* Tab labels — bilingual; "icon" is glyph or emoji rendered before label. */
  /* CSSOS_WAVE_113E 20260511 — Jing
   * "取消6大流派的相册展示，改为排行榜之后的一个6大流派胶囊按钮".
   * Schools moves from a horizontal album below the bar into a
   * single capsule button right after "Top" in the bar itself.
   * Clicking it opens a compact popover listing the schools. */
  var STYLE_TABS = [
    { id: "leaderboard", icon: "🏆", en: "Top",       zh: "排行榜" },
    { id: "schools",     icon: "🏛", en: "Schools",   zh: "流派" },
    { id: "epic",        icon: "⚔️",  en: "Epic",      zh: "史诗" },
    { id: "tang",        icon: "🐉", en: "Tang",      zh: "唐风" },
    { id: "ambient",     icon: "🌫️", en: "Ambient",   zh: "氛围" },
    { id: "cinematic",   icon: "🎬", en: "Cinematic", zh: "电影感" },
    { id: "rock",        icon: "🎸", en: "Rock",      zh: "摇滚" },
  ];

  var BAR_ID = "cssos-activity-bar";
  var SCHOOLS_ID = "cssos-schools-row";
  var CLOSE_ID = "cssos-schools-close";
  var STYLE_ID = "cssos-activity-bar-style";
  var TOOLTIP_ID = "cssos-activity-bar-tooltip";
  var FIRST_VISIT_KEY = "cssos:wave108:activityBarSeen";
  var LAST_TAB_KEY = "cssos:wave108:lastActiveTab";
  var IDLE_HIDE_MS = 10000;
  var FIRST_REVEAL_MS = 6000;

  var state = {
    visible: false,
    hideTimer: 0,
    festivalActive: false,
    festivals: [],
    lastInteraction: 0,
    bar: null,
    schools: null,
    closeBtn: null,
    /* CSSOS_WAVE_108K 20260509 — Jing
     * User-dismissed flag. When the small × button on the schools
     * row is clicked, the entire bar+schools+close cluster goes
     * away for the rest of the page session — bumpActivity stops
     * showing it. Reload to bring it back. Avoids the row fighting
     * other panels for screen real estate. */
    userDismissed: false,
  };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      /* The bar is fixed-position; transitions on opacity/transform.
       * `pointer-events:none` while hidden so it never eats clicks. */
      /* CSSOS_WAVE_108D 20260509 — Jing
       * Bar is now a "notch" — flush with the screen edge it's
       * anchored to, with only the OPPOSITE side rounded. Looks
       * like the iPhone notch when at top, or an inverted notch
       * when at bottom. Padding asymmetric so content doesn't
       * crowd the flush edge. */
      "#" + BAR_ID + "{",
      "  position:fixed;",
      "  left:50%;",
      "  transform:translateX(-50%) translateY(0);",
      "  z-index:55;",                          /* above logo (z=1), below dock (z=70) */
      "  display:flex;",
      "  align-items:center;",
      "  justify-content:center;",
      /* CSSOS_WAVE_108F 20260509 — gap replaces the "/" separator. */
      "  gap:8px;",
      "  padding:8px 14px;",
      "  background:rgba(8, 18, 14, 0.78);",
      "  backdrop-filter: blur(22px) saturate(145%);",
      "  -webkit-backdrop-filter: blur(22px) saturate(145%);",
      "  border:1px solid rgba(255,255,255,0.10);",
      "  box-shadow:0 8px 28px rgba(0,0,0,0.45);",
      /* width is set via inline JS (refreshPosition) so we win
       * against any conflicting CSS reliably. Defaults here just
       * in case JS hasn't run yet. */
      "  width:1016px;",
      "  box-sizing:border-box;",
      "  overflow-x:auto;",
      "  scroll-behavior:smooth;",
      "  scrollbar-width:none;",
      "  -ms-overflow-style:none;",
      "  contain: layout paint;",
      "  will-change: opacity, transform;",
      "  transition: opacity 280ms ease, transform 280ms ease;",
      "}",
      "#" + BAR_ID + "::-webkit-scrollbar{display:none;}",
      /* Notch shape — flush with anchor edge, rounded only on the
       * opposite side. Border-top-width zero on top-anchor (so the
       * bar appears to "extend" from the edge) and analogously for
       * bottom-anchor. */
      "#" + BAR_ID + "[data-anchor='top']{",
      "  top:0;",
      "  bottom:auto;",
      "  border-radius:0 0 28px 28px;",
      "  border-top:none;",
      "  padding-top:max(8px, env(safe-area-inset-top));",
      "}",
      "#" + BAR_ID + "[data-anchor='bottom']{",
      "  bottom:0;",
      "  top:auto;",
      "  border-radius:28px 28px 0 0;",
      "  border-bottom:none;",
      "  padding-bottom:max(8px, env(safe-area-inset-bottom));",
      "}",
      "#" + BAR_ID + "[data-hidden='1']{ opacity:0; pointer-events:none; }",
      "#" + BAR_ID + "[data-hidden='1'][data-anchor='top']{ transform:translateX(-50%) translateY(-100%); }",
      "#" + BAR_ID + "[data-hidden='1'][data-anchor='bottom']{ transform:translateX(-50%) translateY(100%); }",
      ".cssos-act-tab{",
      "  flex:0 0 auto;",
      "  display:inline-flex;",
      "  align-items:center;",
      "  gap:4px;",
      "  padding:6px 12px;",
      "  border-radius:999px;",
      "  font:600 12.5px/1.2 -apple-system,system-ui,sans-serif;",
      "  color:#daffee;",
      "  border:1px solid rgba(255,255,255,0.08);",
      "  cursor:pointer;",
      "  user-select:none;",
      "  -webkit-user-select:none;",
      "  white-space:nowrap;",
      "  transition: filter 180ms ease, border-color 180ms ease;",
      "}",
      ".cssos-act-tab:hover{ filter:brightness(1.18); border-color:rgba(255,255,255,0.22); }",
      ".cssos-act-tab.active{ filter:brightness(1.25); border-color:rgba(255,255,255,0.45); box-shadow:0 0 0 1px rgba(0,245,160,0.55) inset; }",
      ".cssos-act-tab .cssos-act-icon{ font-size:13px; line-height:1; }",

      /* Schools row — picture cards (album style), horizontal scroll.
       * CSSOS_WAVE_108C 20260509 — Jing: restored album cards (was
       * text pills); position is now dynamically computed against
       * the actual <footer.dock> bounding box so they never collide.
       * `--cssos-schools-top` and `--cssos-schools-bottom` are set
       * by placeBarsAndSchools() at runtime. */
      "#" + SCHOOLS_ID + "{",
      "  position:fixed;",
      "  left:50%;",
      "  transform:translateX(-50%);",
      "  z-index:54;",
      "  display:flex;",
      "  gap:8px;",
      "  padding:4px 8px;",
      "  width:1016px;",
      "  box-sizing:border-box;",
      "  overflow-x:auto;",
      "  -webkit-overflow-scrolling: touch;",
      "  scroll-snap-type:x proximity;",
      "  scrollbar-width:none;",
      "  contain: layout paint;",
      "  transition: opacity 280ms ease, transform 280ms ease;",
      "}",
      "#" + SCHOOLS_ID + "::-webkit-scrollbar{display:none;}",
      "#" + SCHOOLS_ID + "[data-anchor='top']{ top: var(--cssos-schools-top, 108px); bottom:auto; }",
      "#" + SCHOOLS_ID + "[data-anchor='bottom']{ bottom: var(--cssos-schools-bottom, 200px); top:auto; }",
      "#" + SCHOOLS_ID + "[data-hidden='1']{ opacity:0; pointer-events:none; }",

      /* CSSOS_WAVE_108E 20260509 — Jing
       * Album-style school cards bumped to 160 × 220 (~2.5×
       * taller than the 108D compact pill). Matches the original
       * 180×240 ViewWall design while staying narrow enough that
       * 6+ cards fit in the horizontal scroll without crowding the
       * notch or the logo. Stats row added back for parity. */
      ".cssos-school-card{",
      "  flex:0 0 160px;",
      "  height:220px;",
      "  border-radius:14px;",
      "  position:relative;",
      "  overflow:hidden;",
      "  cursor:pointer;",
      "  scroll-snap-align:start;",
      "  background:rgba(8,18,14,0.6);",
      "  border:1px solid rgba(0,245,160,0.22);",
      "  transition: transform 160ms ease, border-color 160ms ease;",
      "  user-select:none;",
      "  -webkit-user-select:none;",
      "}",
      ".cssos-school-card:hover{ transform:translateY(-3px); border-color:rgba(0,245,160,0.6); }",
      ".cssos-school-card .cover{",
      "  position:absolute;",
      "  inset:0;",
      "  display:flex;",
      "  align-items:center;",
      "  justify-content:center;",
      "  font-size:64px;",
      "}",
      ".cssos-school-card .cover::after{",
      "  content:'';",
      "  position:absolute;",
      "  inset:0;",
      "  background:linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.82) 100%);",
      "}",
      ".cssos-school-card .info{",
      "  position:absolute;",
      "  left:10px;",
      "  right:10px;",
      "  bottom:10px;",
      "  color:#daffee;",
      "  text-shadow:0 1px 4px rgba(0,0,0,0.85);",
      "  pointer-events:none;",
      "}",
      ".cssos-school-card .name{",
      "  font:700 15px/1.2 -apple-system,system-ui,sans-serif;",
      "}",
      ".cssos-school-card .meta{",
      "  font:500 10px/1.3 ui-monospace,monospace;",
      "  color:rgba(0,245,160,0.85);",
      "  letter-spacing:.04em;",
      "  margin-top:3px;",
      "}",
      ".cssos-school-card .stats{",
      "  font:500 10px/1 ui-monospace,monospace;",
      "  color:rgba(218,255,238,0.7);",
      "  margin-top:5px;",
      "}",
      ".cssos-school-card *{ pointer-events:none; }",

      /* CSSOS_WAVE_108K 20260509 — small close × on the schools
       * row. Sits at the top-right corner of the row's bbox, just
       * outside the cards so it never sits on top of one. Clicking
       * dismisses the bar+schools for the rest of the session. */
      "#" + CLOSE_ID + "{",
      "  position:fixed;",
      "  z-index:56;",
      "  width:24px;",
      "  height:24px;",
      "  display:flex;",
      "  align-items:center;",
      "  justify-content:center;",
      "  border-radius:50%;",
      "  background:rgba(8,18,14,0.85);",
      "  backdrop-filter: blur(14px) saturate(140%);",
      "  -webkit-backdrop-filter: blur(14px) saturate(140%);",
      "  border:1px solid rgba(255,255,255,0.18);",
      "  color:rgba(255,255,255,0.78);",
      "  font:600 13px/1 -apple-system,system-ui,sans-serif;",
      "  cursor:pointer;",
      "  user-select:none;",
      "  -webkit-user-select:none;",
      "  transition: opacity 220ms ease, transform 220ms ease, color 180ms ease, border-color 180ms ease;",
      "  pointer-events:auto;",
      "}",
      "#" + CLOSE_ID + ":hover{",
      "  color:#fff;",
      "  border-color:rgba(255,255,255,0.5);",
      "  transform:scale(1.08);",
      "}",
      "#" + CLOSE_ID + "[data-hidden='1']{ opacity:0; pointer-events:none; }",

      /* Tooltip for first-visit reveal */
      "#" + TOOLTIP_ID + "{",
      "  position:fixed;",
      "  left:50%;",
      "  transform:translateX(-50%);",
      "  z-index:56;",
      "  padding:6px 12px;",
      "  border-radius:8px;",
      "  background:rgba(0,0,0,0.85);",
      "  color:#fff;",
      "  font:500 11.5px/1.3 -apple-system,system-ui,sans-serif;",
      "  pointer-events:none;",
      "  opacity:0;",
      "  transition:opacity 320ms ease;",
      "}",
      "#" + TOOLTIP_ID + ".visible{ opacity:1; }",
      "#" + TOOLTIP_ID + "[data-anchor='top']{ top: calc(var(--cssos-bar-top, 24px) + 56px); bottom:auto; }",
      "#" + TOOLTIP_ID + "[data-anchor='bottom']{ bottom: calc(var(--cssos-bar-bottom, 110px) + 56px); top:auto; }",

      /* Honor reduced motion */
      "@media (prefers-reduced-motion: reduce) {",
      "  #" + BAR_ID + ", #" + SCHOOLS_ID + ", #" + TOOLTIP_ID + "{ transition: none; }",
      "}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function getDockPosition() {
    try {
      var pb = globalThis.readPanelBehaviorSettingsLocal &&
        globalThis.readPanelBehaviorSettingsLocal();
      var pos = pb && pb.dock && pb.dock.dock_position;
      return String(pos || "bottom");
    } catch (_) { return "bottom"; }
  }

  function effectiveBarPosition() {
    var dock = getDockPosition();
    /* When dock is on top, bar moves to bottom; otherwise top. */
    return dock === "top" ? "bottom" : "top";
  }

  function persistLastTab(id) {
    try { localStorage.setItem(LAST_TAB_KEY, String(id)); } catch (_) {}
  }
  function readLastTab() {
    try { return localStorage.getItem(LAST_TAB_KEY) || ""; } catch (_) { return ""; }
  }

  function buildTabs() {
    var tabs = STYLE_TABS.slice();
    if (state.festivalActive && state.festivals.length) {
      var fest = state.festivals[0];
      var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
      var label = /^zh/i.test(String(locale))
        ? (fest.name_zh || fest.name_en || fest.id)
        : (fest.name_en || fest.name_zh || fest.id);
      tabs.unshift({
        id: "festival",
        icon: "🎉",
        en: label,
        zh: label,
        festivalId: fest.id || fest.festival_id || "",
      });
    }
    return tabs;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }

  function renderBar() {
    if (!state.bar) return;
    var tabs = buildTabs();
    /* CSSOS_WAVE_108F 20260509 — Jing
     * Removed "/" separators — each tab is already its own colored
     * pill so the slash just added noise. The flex `gap` on the bar
     * is now what visually spaces them. */
    var html = "";
    tabs.forEach(function (t) {
      var label = /^zh/i.test(String((globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en"))
        ? t.zh : t.en;
      var color = TAB_PALETTE[t.id] || "rgba(255,255,255,0.05)";
      html += '<button type="button" class="cssos-act-tab" ' +
        'data-tab="' + escapeHtml(t.id) + '" ' +
        'style="background:' + color + ';">' +
        '<span class="cssos-act-icon">' + escapeHtml(t.icon) + '</span>' +
        '<span>' + escapeHtml(label) + '</span>' +
        '</button>';
    });
    state.bar.innerHTML = html;
    var lastId = readLastTab();
    if (lastId) {
      var btn = state.bar.querySelector('[data-tab="' + lastId + '"]');
      if (btn) btn.classList.add("active");
    }
  }

  function activateTab(tabId) {
    if (!tabId) return;
    /* CSSOS_WAVE_113E 20260511 — Jing
     * Schools capsule opens a compact popover instead of routing to
     * a tab content surface. */
    if (tabId === "schools") {
      toggleSchoolsPopover();
      return;
    }
    persistLastTab(tabId);
    /* Visual active state */
    if (state.bar) {
      Array.prototype.forEach.call(state.bar.querySelectorAll(".cssos-act-tab"), function (b) {
        b.classList.toggle("active", b.getAttribute("data-tab") === tabId);
      });
    }
    /* CSSOS_WAVE_108B 20260509 — Jing
     * If media is currently playing, stage the action instead of
     * yanking the user out of what they're watching. The staged
     * runner fires when the current MV ends, OR when the user
     * clicks "立即播放" on the floating pill. Re-tapping a different
     * tab during playback simply replaces the staged action. */
    var label = labelForTab(tabId);
    var runner = function () { runTabAction(tabId); };
    if (globalThis.cssosPlaybackStage && typeof globalThis.cssosPlaybackStage.run === "function") {
      globalThis.cssosPlaybackStage.run("tab:" + tabId, runner, label);
      return;
    }
    runner();
  }

  function labelForTab(tabId) {
    var tabs = buildTabs();
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    var isZh = /^zh/i.test(String(locale));
    for (var i = 0; i < tabs.length; i += 1) {
      if (tabs[i].id === tabId) return isZh ? tabs[i].zh : tabs[i].en;
    }
    return tabId;
  }

  function runTabAction(tabId) {
    /* Dispatch */
    if (tabId === "leaderboard") {
      try {
        if (typeof globalThis.openPersonMvLeaderboard === "function") {
          globalThis.openPersonMvLeaderboard();
        } else {
          location.hash = "#leaderboard";
        }
      } catch (_) {}
      return;
    }
    if (tabId === "festival") {
      try {
        if (typeof globalThis.openPersonMvCodex === "function" && state.festivals.length) {
          var f = state.festivals[0];
          var pid = f && (f.featured_person_id || f.person_id);
          if (pid) { globalThis.openPersonMvCodex(pid); return; }
        }
      } catch (_) {}
      try {
        document.dispatchEvent(new CustomEvent("cssos:open-person-mv", { detail: { reason: "festival" } }));
      } catch (_) {}
      return;
    }
    /* Style tabs */
    var tag = tabId;
    try {
      document.dispatchEvent(new CustomEvent("cssos:enter-style-playlist", { detail: { tag: tag } }));
    } catch (_) {}
    enterStylePlaylistFallback(tag);
  }

  function enterStylePlaylistFallback(tag) {
    /* Mirror app.person-mv-style-shelf.js enterPlaylist — kept here so
     * the activity bar works even if the shelf JS hasn't loaded. */
    fetch("/api/person-mv/playlists/style/" + encodeURIComponent(tag) + "?limit=20", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok) return;
        var mvs = (j.data && j.data.mvs) || [];
        if (!mvs.length) return;
        var first = mvs[0];
        try {
          document.dispatchEvent(new CustomEvent("cssos:cinema-queue", {
            detail: { tag: tag, mvs: mvs, label: tag },
          }));
        } catch (_) {}
        if (typeof globalThis.openPersonMvCodex === "function") {
          try {
            globalThis.openPersonMvCodex(first.person_id, {
              work_id: first.work_id,
              autoCinema: true,
              styleTag: tag,
            });
            return;
          } catch (_) {}
        }
        try {
          document.dispatchEvent(new CustomEvent("cssos:open-person-codex", {
            detail: { person_id: first.person_id, work_id: first.work_id || null, autoCinema: true, styleTag: tag },
          }));
        } catch (_) {}
      })
      .catch(function () {});
  }

  /* CSSOS_WAVE_113E 20260511 — Jing
   * Schools data is loaded for the popover; the album row is hidden. */
  state.schoolsData = [];

  function toggleSchoolsPopover() {
    var pop = document.getElementById("cssos-schools-popover");
    if (pop) { pop.remove(); return; }
    var groups = state.schoolsData || [];
    if (!groups.length) return;
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    var isZh = /^zh/i.test(String(locale));
    pop = document.createElement("div");
    pop.id = "cssos-schools-popover";
    pop.style.cssText = [
      "position:fixed", "z-index:60",
      "left:50%", "transform:translateX(-50%)",
      "top:calc(var(--cssos-bar-top, 24px) + 56px)",
      "max-width:min(92vw, 720px)",
      "padding:8px",
      "background:rgba(8,18,14,0.92)",
      "backdrop-filter:blur(20px) saturate(140%)",
      "-webkit-backdrop-filter:blur(20px) saturate(140%)",
      "border:1px solid rgba(0,245,160,0.28)",
      "border-radius:14px",
      "box-shadow:0 12px 36px rgba(0,0,0,0.55)",
      "display:flex", "flex-wrap:wrap", "gap:6px",
      "max-height:min(60vh, 420px)", "overflow-y:auto"
    ].join(";");
    groups.forEach(function (g) {
      var icon = (g.visual_theme && g.visual_theme.icon) ? String(g.visual_theme.icon) : "🏛";
      var name = isZh ? (g.name_zh || g.name_en || g.group_id) : (g.name_en || g.name_zh || g.group_id);
      var stats = "👥 " + (g.member_count || 0) + " · 🎼 " + (g.mv_count || 0);
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.groupId = g.group_id || "";
      b.style.cssText = [
        "display:inline-flex", "align-items:center", "gap:6px",
        "padding:6px 10px", "border-radius:999px",
        "background:rgba(0,245,160,0.10)", "color:#daffee",
        "border:1px solid rgba(0,245,160,0.32)",
        "font:600 12px/1 -apple-system,system-ui,sans-serif",
        "cursor:pointer", "white-space:nowrap"
      ].join(";");
      b.innerHTML = "<span>" + icon + "</span><span>" + escapeHtml(name) +
        "</span><span style='opacity:.7;font-weight:500;font-size:10.5px;'>" +
        escapeHtml(stats) + "</span>";
      b.addEventListener("click", function () {
        if (typeof globalThis.openPersonMvGroup === "function") {
          try { globalThis.openPersonMvGroup(g.group_id); } catch (_) {}
        }
        pop.remove();
      });
      pop.appendChild(b);
    });
    document.body.appendChild(pop);
    /* Outside-click closes. */
    setTimeout(function () {
      var off = function (e) {
        if (!pop.contains(e.target) && !e.target.closest('[data-tab="schools"]')) {
          pop.remove();
          document.removeEventListener("pointerdown", off, true);
        }
      };
      document.addEventListener("pointerdown", off, true);
    }, 0);
  }
  function renderSchools(groups) {
    state.schoolsData = Array.isArray(groups) ? groups.slice() : [];
    if (state.schools) {
      state.schools.innerHTML = "";
      state.schools.style.display = "none";
    }
    return;
    /* eslint-disable */
    if (!state.schools) return;
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    var isZh = /^zh/i.test(String(locale));
    /* Album-style cards (cover gradient + emoji + name overlay) —
     * mirror the original .cssos-discover-card layout per Jing's
     * Wave 108C ask to keep the picture-card aesthetic. */
    var html = (groups || []).map(function (g) {
      var icon = (g.visual_theme && g.visual_theme.icon) ? String(g.visual_theme.icon) : "🏛";
      var color = (g.visual_theme && g.visual_theme.color) ? String(g.visual_theme.color) : "#00f5a0";
      var name = isZh ? (g.name_zh || g.name_en || g.group_id) : (g.name_en || g.name_zh || g.group_id);
      var meta = [g.era, g.civilization].filter(Boolean).join(" · ");
      var stats = "👥 " + (g.member_count || 0) + " · 🎼 " + (g.mv_count || 0);
      var coverStyle = "background:linear-gradient(135deg,#012019," + color + "55);";
      return (
        '<article class="cssos-school-card" data-group-id="' + escapeHtml(g.group_id || "") +
          '" tabindex="0" role="button" aria-label="' + escapeHtml(name) + '">' +
          '<div class="cover" style="' + coverStyle + '">' + escapeHtml(icon) + '</div>' +
          '<div class="info">' +
            '<div class="name">' + escapeHtml(name) + '</div>' +
            (meta ? '<div class="meta">' + escapeHtml(meta) + '</div>' : '') +
            '<div class="stats">' + escapeHtml(stats) + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join("");
    state.schools.innerHTML = html;
  }

  function loadSchools() {
    if (!state.schools) return;
    fetch("/api/person-mv/groups", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok) return;
        var groups = (j.data && j.data.groups) || [];
        renderSchools(groups);
      })
      .catch(function () {});
  }

  function loadFestival() {
    fetch("/api/person-mv/festivals/today", { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var festivals = (j && j.ok && j.data && j.data.festivals) || [];
        state.festivals = festivals;
        state.festivalActive = festivals.length > 0;
        renderBar();
      })
      .catch(function () {});
  }

  /* --- Auto-hide --- */
  function show() {
    if (!state.bar) return;
    if (state.userDismissed) return; /* user closed it for this session */
    state.bar.setAttribute("data-hidden", "0");
    if (state.schools) state.schools.setAttribute("data-hidden", "0");
    if (state.closeBtn) state.closeBtn.setAttribute("data-hidden", "0");
    state.visible = true;
    state.lastInteraction = Date.now();
    armHideTimer();
    /* Keep close button position in sync with schools row. */
    refreshPosition();
  }
  function hide() {
    if (!state.bar) return;
    state.bar.setAttribute("data-hidden", "1");
    if (state.schools) state.schools.setAttribute("data-hidden", "1");
    if (state.closeBtn) state.closeBtn.setAttribute("data-hidden", "1");
    state.visible = false;
  }
  function armHideTimer() {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(function () {
      if (Date.now() - state.lastInteraction >= IDLE_HIDE_MS - 100) hide();
    }, IDLE_HIDE_MS);
  }
  function bumpActivity() {
    if (state.userDismissed) return; /* respect explicit dismiss */
    state.lastInteraction = Date.now();
    if (!state.visible) show();
    else armHideTimer();
  }

  /* CSSOS_WAVE_108D 20260509 — Jing
   * Hard rules:
   *   1. Schools row + bar are ALWAYS on the side OPPOSITE the dock.
   *      Dock at bottom → bar+schools at top. Dock at top → at bottom.
   *      Horizontal docks (left/right) → bar+schools at top by default.
   *   2. Schools row never overlaps the LOGO panel's magic mirror.
   *      We measure .logo-panel (or fallback to .title) and clamp the
   *      schools-row offset so its bottom edge stays ≥16px above the
   *      logo's top (when at top anchor) or its top edge stays ≥16px
   *      below the logo's bottom (when at bottom anchor).
   *   3. Bar is a notch — flush with the anchored edge, rounded on
   *      the opposite side (handled in CSS via [data-anchor=...]).
   */
  function detectDockSide() {
    /* CSSOS_WAVE_108J 20260509 — Jing
     * Prefer the panel-behavior SETTING over a geometry measurement.
     * When the user toggles dock_position in the settings panel, the
     * setting fires `cssos:panel-behavior-changed` synchronously,
     * but the .dock element's CSS top/bottom may not have settled
     * by the time we read it via getBoundingClientRect — so we'd
     * read the OLD position and anchor the bar wrongly. The setting
     * tells us user intent immediately. */
    try {
      var pb = globalThis.readPanelBehaviorSettingsLocal &&
        globalThis.readPanelBehaviorSettingsLocal();
      var pos = pb && pb.dock && pb.dock.dock_position;
      if (pos === "top" || pos === "bottom" || pos === "left" || pos === "right") {
        return pos;
      }
    } catch (_) {}
    /* Fallback: measure live dock geometry. */
    var dock = document.querySelector(".dock");
    if (!dock) return "bottom";
    var rect = dock.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!rect.width || !rect.height) return "bottom";
    var midY = rect.top + rect.height / 2;
    var midX = rect.left + rect.width / 2;
    if (rect.height > rect.width * 1.5) {
      return midX < vw / 2 ? "left" : "right";
    }
    return midY < vh / 2 ? "top" : "bottom";
  }

  function refreshPosition() {
    var dockSide = detectDockSide();
    /* Anchor is OPPOSITE to dock. For left/right docks we still pin
     * the bar to top (more natural reading position). */
    var anchor = dockSide === "top" ? "bottom" : "top";

    /* CSSOS_WAVE_108J 20260509 — Jing
     * Width grows with content so future additions of schools/tabs
     * stay visible without forcing horizontal scroll until really
     * necessary. Floor stays at 1016px (= 6 cards baseline) for
     * visual consistency on day-1; ceiling = viewport - 16px.
     *
     *   width = clamp(1016, naturalContentWidth, viewport - 16)
     *
     * Apply both natural sizes (schools cards: 160 each + 8 gap;
     * bar tabs: variable but we just match schools so they line up).
     */
    var CARD_W = 160, GAP = 8, PADDING = 16;
    var schoolCount = (state.schools && state.schools.children.length) || 6;
    var naturalSchools = schoolCount > 0
      ? schoolCount * CARD_W + Math.max(0, schoolCount - 1) * GAP + PADDING
      : 1016;
    var FLOOR = 6 * CARD_W + 5 * GAP + PADDING; /* = 1016 */
    var CAP = (window.innerWidth || 1200) - 16;
    var WIDTH = Math.max(FLOOR, naturalSchools);
    WIDTH = Math.min(WIDTH, CAP);
    if (state.bar) state.bar.style.width = WIDTH + "px";
    if (state.schools) state.schools.style.width = WIDTH + "px";

    var BAR_HEIGHT = 48;          /* approximate bar height incl padding */
    var GAP_BAR_TO_SCHOOLS = 14;
    /* CSSOS_WAVE_108E 20260509 — Jing wants schools cards close to
     * the magic mirror's pointed corners. Reduced guard from 16→0
     * and we measure against the visible mirror-glow box (.logo-mirror
     * if available) rather than the full .logo-panel which also
     * includes the slogan + spacing. The cards may now visually
     * graze the very tips of the outer crystals — exactly Jing's
     * intent. */
    var GAP_LOGO_GUARD = 0;
    var SCHOOLS_HEIGHT = 220;     /* matches .cssos-school-card height */

    /* Bar sits flush with edge (top:0 / bottom:0) — bar offset vars
     * are set to 0 here. Schools row offset is computed from bar
     * height + gap, then clamped so it doesn't overlap the logo. */
    var schoolsOffset;
    if (anchor === "top") {
      document.documentElement.style.setProperty("--cssos-bar-top", "0px");
      schoolsOffset = BAR_HEIGHT + GAP_BAR_TO_SCHOOLS;
    } else {
      document.documentElement.style.setProperty("--cssos-bar-bottom", "0px");
      schoolsOffset = BAR_HEIGHT + GAP_BAR_TO_SCHOOLS;
    }

    /* Clamp against logo. Prefer the inner mirror element so cards
     * can graze the outer crystal points. */
    var logo = document.querySelector(".logo-mirror")
            || document.querySelector(".logo-panel")
            || document.querySelector(".title");
    if (logo) {
      var lr = logo.getBoundingClientRect();
      var vh = window.innerHeight || 0;
      if (anchor === "top") {
        /* Schools occupies [schoolsOffset .. schoolsOffset+SCHOOLS_HEIGHT].
         * Logo top is at lr.top. We need schoolsOffset+SCHOOLS_HEIGHT < lr.top - GAP. */
        var maxTop = Math.max(BAR_HEIGHT + GAP_BAR_TO_SCHOOLS,
          Math.floor(lr.top - GAP_LOGO_GUARD - SCHOOLS_HEIGHT));
        schoolsOffset = Math.min(schoolsOffset, maxTop);
        if (schoolsOffset < BAR_HEIGHT + 4) schoolsOffset = BAR_HEIGHT + 4;
        document.documentElement.style.setProperty("--cssos-schools-top", schoolsOffset + "px");
      } else {
        /* Bottom anchor: schools sits schoolsOffset px from bottom edge.
         * Its top edge is at vh - schoolsOffset - SCHOOLS_HEIGHT. We
         * need that >= lr.bottom + GAP. So schoolsOffset <= vh - lr.bottom - GAP - SCHOOLS_HEIGHT. */
        var maxBottom = Math.max(BAR_HEIGHT + GAP_BAR_TO_SCHOOLS,
          Math.floor(vh - lr.bottom - GAP_LOGO_GUARD - SCHOOLS_HEIGHT));
        schoolsOffset = Math.min(schoolsOffset, maxBottom);
        if (schoolsOffset < BAR_HEIGHT + 4) schoolsOffset = BAR_HEIGHT + 4;
        document.documentElement.style.setProperty("--cssos-schools-bottom", schoolsOffset + "px");
      }
    } else {
      /* No logo measurement — use raw offsets. */
      if (anchor === "top") {
        document.documentElement.style.setProperty("--cssos-schools-top", schoolsOffset + "px");
      } else {
        document.documentElement.style.setProperty("--cssos-schools-bottom", schoolsOffset + "px");
      }
    }

    if (state.bar) state.bar.setAttribute("data-anchor", anchor);
    if (state.schools) state.schools.setAttribute("data-anchor", anchor);
    var tip = document.getElementById(TOOLTIP_ID);
    if (tip) tip.setAttribute("data-anchor", anchor);

    /* CSSOS_WAVE_113E 20260511 — Jing
     * "关闭按钮放到刘海右上角". The close × now hugs the top-right
     * corner of the activity bar (the "notch" / 刘海) itself,
     * regardless of whether the schools row exists. */
    if (state.closeBtn && state.bar) {
      var br = state.bar.getBoundingClientRect();
      if (br.width && br.height) {
        state.closeBtn.style.left = Math.round(br.right - 26) + "px";
        state.closeBtn.style.top = Math.round(br.top + 6) + "px";
      }
    }
  }

  function showFirstVisitTooltip() {
    try {
      if (localStorage.getItem(FIRST_VISIT_KEY)) return;
      localStorage.setItem(FIRST_VISIT_KEY, String(Date.now()));
    } catch (_) {}
    var tip = document.createElement("div");
    tip.id = TOOLTIP_ID;
    tip.setAttribute("data-anchor", state.bar ? state.bar.getAttribute("data-anchor") || "top" : "top");
    tip.textContent = tr(
      "Move here to see top picks & style stations · auto-hides after 10s",
      "鼠标移到这里查看排行榜与风格电台 · 10 秒无操作自动隐藏",
    );
    document.body.appendChild(tip);
    setTimeout(function () { tip.classList.add("visible"); }, 50);
    setTimeout(function () { tip.classList.remove("visible"); }, 4500);
    setTimeout(function () { try { tip.remove(); } catch (_) {} }, 5200);
  }

  /* CSSOS_WAVE_108E 20260509 — Jing
   * Global activity tracking: ANY pointer move / touch / key /
   * scroll anywhere in the document counts as "user is here" and
   * keeps the bar+schools visible. After 10s of total stillness
   * everywhere, the auto-hide timer fires. Mirrors Dock's pattern. */
  function bindReshowZone() {
    var throttle = 0;
    function onActivity() {
      var now = Date.now();
      if (now - throttle < 80) return; /* cheap throttle for pointermove */
      throttle = now;
      bumpActivity();
    }
    document.addEventListener("pointermove", onActivity, { passive: true, capture: true });
    document.addEventListener("touchstart", onActivity, { passive: true, capture: true });
    document.addEventListener("keydown", onActivity, { capture: true });
    document.addEventListener("wheel", onActivity, { passive: true, capture: true });
    document.addEventListener("scroll", onActivity, { passive: true, capture: true });
  }

  function init() {
    if (document.getElementById(BAR_ID)) return;
    injectStyle();

    state.bar = document.createElement("div");
    state.bar.id = BAR_ID;
    state.bar.setAttribute("data-anchor", "top");
    state.bar.setAttribute("data-hidden", "1");
    state.bar.setAttribute("aria-label", tr("Activity bar", "活动栏"));
    state.bar.setAttribute("role", "tablist");
    document.body.appendChild(state.bar);

    state.schools = document.createElement("div");
    state.schools.id = SCHOOLS_ID;
    state.schools.setAttribute("data-anchor", "top");
    state.schools.setAttribute("data-hidden", "1");
    state.schools.setAttribute("aria-label", tr("Schools of thought", "文明流派"));
    document.body.appendChild(state.schools);

    /* CSSOS_WAVE_108K 20260509 — small × at the top-right of the
     * schools row to dismiss the entire bar+schools cluster when
     * the user opens another panel and our row would otherwise
     * fight for the same screen real estate. */
    state.closeBtn = document.createElement("button");
    state.closeBtn.id = CLOSE_ID;
    state.closeBtn.type = "button";
    state.closeBtn.setAttribute("data-hidden", "1");
    state.closeBtn.setAttribute("aria-label", tr("Hide activity bar and schools", "隐藏活动栏和流派"));
    state.closeBtn.setAttribute("title", tr("Hide for this session", "本次浏览隐藏"));
    state.closeBtn.textContent = "×";
    document.body.appendChild(state.closeBtn);
    if (globalThis.cssosTapGuard && typeof globalThis.cssosTapGuard.bind === "function") {
      globalThis.cssosTapGuard.bind(state.closeBtn, function () {
        state.userDismissed = true;
        hide();
      });
    } else {
      state.closeBtn.addEventListener("click", function () {
        state.userDismissed = true;
        hide();
      });
    }

    /* Initial placement using actual dock geometry. */
    refreshPosition();
    /* Re-place on viewport resize and on dock resize (CSS scale,
     * label visibility toggle, etc.). */
    window.addEventListener("resize", refreshPosition, { passive: true });
    try {
      var dockEl = document.querySelector(".dock");
      if (dockEl && typeof ResizeObserver === "function") {
        var ro = new ResizeObserver(refreshPosition);
        ro.observe(dockEl);
      }
      /* Periodic re-check for late dock injectors (Person MV item
       * lands ~0.4-2s after load). */
      [400, 1500, 4000].forEach(function (ms) { setTimeout(refreshPosition, ms); });
    } catch (_) {}

    /* Wire up taps via the global guard so swipes never trigger. */
    if (globalThis.cssosTapGuard && typeof globalThis.cssosTapGuard.bindDelegated === "function") {
      globalThis.cssosTapGuard.bindDelegated(state.bar, "[data-tab]", function (target) {
        var tabId = target.getAttribute("data-tab");
        if (tabId) activateTab(tabId);
      });
      globalThis.cssosTapGuard.bindDelegated(state.schools, "[data-group-id]", function (target) {
        var gid = target.getAttribute("data-group-id");
        if (gid && typeof globalThis.openPersonMvGroup === "function") {
          try { globalThis.openPersonMvGroup(gid); } catch (_) {}
        }
      });
    } else {
      /* Fallback if tap-guard didn't load (shouldn't happen) — plain click. */
      state.bar.addEventListener("click", function (ev) {
        var t = ev.target && ev.target.closest && ev.target.closest("[data-tab]");
        if (!t) return;
        activateTab(t.getAttribute("data-tab"));
      });
      state.schools.addEventListener("click", function (ev) {
        var t = ev.target && ev.target.closest && ev.target.closest("[data-group-id]");
        if (!t) return;
        var gid = t.getAttribute("data-group-id");
        if (gid && typeof globalThis.openPersonMvGroup === "function") {
          try { globalThis.openPersonMvGroup(gid); } catch (_) {}
        }
      });
    }

    /* Hover within the bar resets the auto-hide timer. */
    [state.bar, state.schools].forEach(function (el) {
      el.addEventListener("pointerenter", bumpActivity);
      el.addEventListener("pointermove", bumpActivity, { passive: true });
      el.addEventListener("focus", bumpActivity, true);
      el.addEventListener("scroll", bumpActivity, { passive: true });
    });

    bindReshowZone();

    /* CSSOS_WAVE_108J 20260509 — Jing
     * Listen for dock-position changes; refresh once immediately
     * (uses the setting) and once after the next frame (catches
     * any geometry-based fallback after CSS has settled). */
    document.addEventListener("cssos:panel-behavior-changed", function () {
      refreshPosition();
      requestAnimationFrame(refreshPosition);
    });
    window.addEventListener("storage", function (e) {
      if (e.key && e.key.indexOf("panel-behavior") !== -1) refreshPosition();
    });

    /* First render */
    renderBar();
    loadSchools();
    loadFestival();

    /* First visit: gentle 6s reveal + tooltip */
    show();
    setTimeout(function () {
      if (Date.now() - state.lastInteraction >= FIRST_REVEAL_MS - 100) hide();
    }, FIRST_REVEAL_MS);
    showFirstVisitTooltip();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  /* Expose for debugging */
  globalThis.__cssosActivityBar = {
    show: show,
    hide: hide,
    refreshPosition: refreshPosition,
    state: state,
  };
})();
