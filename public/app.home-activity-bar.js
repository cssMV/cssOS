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
  var STYLE_TABS = [
    { id: "leaderboard", icon: "🏆", en: "Top",       zh: "排行榜" },
    { id: "epic",        icon: "⚔️",  en: "Epic",      zh: "史诗" },
    { id: "tang",        icon: "🐉", en: "Tang",      zh: "唐风" },
    { id: "ambient",     icon: "🌫️", en: "Ambient",   zh: "氛围" },
    { id: "cinematic",   icon: "🎬", en: "Cinematic", zh: "电影感" },
    { id: "rock",        icon: "🎸", en: "Rock",      zh: "摇滚" },
  ];

  var BAR_ID = "cssos-activity-bar";
  var SCHOOLS_ID = "cssos-schools-row";
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
  };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      /* The bar is fixed-position; transitions on opacity/transform.
       * `pointer-events:none` while hidden so it never eats clicks. */
      "#" + BAR_ID + "{",
      "  position:fixed;",
      "  left:50%;",
      "  transform:translateX(-50%) translateY(0);",
      "  z-index:55;",                          /* above logo (z=1), below dock (z=70) */
      "  display:flex;",
      "  align-items:center;",
      "  gap:0;",
      "  padding:6px 10px;",
      "  border-radius:999px;",
      "  background:rgba(8, 18, 14, 0.72);",
      "  backdrop-filter: blur(20px) saturate(140%);",
      "  -webkit-backdrop-filter: blur(20px) saturate(140%);",
      "  border:1px solid rgba(255,255,255,0.10);",
      "  box-shadow:0 8px 28px rgba(0,0,0,0.35);",
      "  max-width:min(720px, calc(100vw - 64px));",
      "  overflow-x:auto;",
      "  scroll-behavior:smooth;",
      "  scrollbar-width:none;",                /* Firefox */
      "  -ms-overflow-style:none;",             /* IE/Edge */
      "  contain: layout paint;",
      "  will-change: opacity, transform;",
      "  transition: opacity 280ms ease, transform 280ms ease;",
      "}",
      "#" + BAR_ID + "::-webkit-scrollbar{display:none;}",  /* WebKit */
      "#" + BAR_ID + "[data-position='top']{ top:60px; }",
      "#" + BAR_ID + "[data-position='bottom']{ bottom:80px; }",
      "#" + BAR_ID + "[data-hidden='1']{ opacity:0; pointer-events:none; }",
      "#" + BAR_ID + "[data-hidden='1'][data-position='top']{ transform:translateX(-50%) translateY(-12px); }",
      "#" + BAR_ID + "[data-hidden='1'][data-position='bottom']{ transform:translateX(-50%) translateY(12px); }",
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
      ".cssos-act-sep{",
      "  flex:0 0 auto;",
      "  padding:0 4px;",
      "  font:500 13px/1 ui-monospace,monospace;",
      "  color:rgba(255,255,255,0.30);",
      "  user-select:none;",
      "}",

      /* Schools row — sits adjacent to the bar (above when bar at bottom). */
      "#" + SCHOOLS_ID + "{",
      "  position:fixed;",
      "  left:50%;",
      "  transform:translateX(-50%);",
      "  z-index:54;",
      "  display:flex;",
      "  gap:6px;",
      "  padding:4px 8px;",
      "  max-width:min(820px, calc(100vw - 64px));",
      "  overflow-x:auto;",
      "  scrollbar-width:none;",
      "  transition: opacity 280ms ease, transform 280ms ease;",
      "}",
      "#" + SCHOOLS_ID + "::-webkit-scrollbar{display:none;}",
      "#" + SCHOOLS_ID + "[data-position='top']{ top:108px; }",
      "#" + SCHOOLS_ID + "[data-position='bottom']{ bottom:128px; }",
      "#" + SCHOOLS_ID + "[data-hidden='1']{ opacity:0; pointer-events:none; }",
      ".cssos-school-pill{",
      "  flex:0 0 auto;",
      "  padding:5px 11px;",
      "  border-radius:999px;",
      "  background:rgba(8, 18, 14, 0.72);",
      "  backdrop-filter: blur(14px) saturate(130%);",
      "  -webkit-backdrop-filter: blur(14px) saturate(130%);",
      "  border:1px solid rgba(0,245,160,0.22);",
      "  color:#daffee;",
      "  font:600 12px/1.2 -apple-system,system-ui,sans-serif;",
      "  cursor:pointer;",
      "  user-select:none;",
      "  white-space:nowrap;",
      "  transition: border-color 180ms ease, background 180ms ease;",
      "}",
      ".cssos-school-pill:hover{ border-color:rgba(0,245,160,0.5); background:rgba(8,28,22,0.8); }",

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
      "#" + TOOLTIP_ID + "[data-position='top']{ top:104px; }",
      "#" + TOOLTIP_ID + "[data-position='bottom']{ bottom:124px; }",

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
    var html = "";
    tabs.forEach(function (t, i) {
      if (i > 0) html += '<span class="cssos-act-sep">/</span>';
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
    persistLastTab(tabId);
    /* Visual active state */
    if (state.bar) {
      Array.prototype.forEach.call(state.bar.querySelectorAll(".cssos-act-tab"), function (b) {
        b.classList.toggle("active", b.getAttribute("data-tab") === tabId);
      });
    }
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
      /* Festival → open Person-MV panel scoped by the active festival.
       * Since we don't have a dedicated openFestival API, fall back to
       * opening the Person-MV panel; the festival-shelf hot persons
       * will surface there. */
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
    /* Style tabs → call the existing style-shelf playlist enterer.
     * The shelf module exposes its enterPlaylist via a CustomEvent
     * we dispatch; falling back to a direct fetch path. */
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

  function renderSchools(groups) {
    if (!state.schools) return;
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    var isZh = /^zh/i.test(String(locale));
    var html = (groups || []).map(function (g) {
      var icon = (g.visual_theme && g.visual_theme.icon) ? String(g.visual_theme.icon) + " " : "🏛 ";
      var name = isZh ? (g.name_zh || g.name_en || g.group_id) : (g.name_en || g.name_zh || g.group_id);
      return '<button type="button" class="cssos-school-pill" data-group-id="' + escapeHtml(g.group_id || "") + '">' +
        escapeHtml(icon + name) + '</button>';
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
    state.bar.setAttribute("data-hidden", "0");
    if (state.schools) state.schools.setAttribute("data-hidden", "0");
    state.visible = true;
    state.lastInteraction = Date.now();
    armHideTimer();
  }
  function hide() {
    if (!state.bar) return;
    state.bar.setAttribute("data-hidden", "1");
    if (state.schools) state.schools.setAttribute("data-hidden", "1");
    state.visible = false;
  }
  function armHideTimer() {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(function () {
      if (Date.now() - state.lastInteraction >= IDLE_HIDE_MS - 100) hide();
    }, IDLE_HIDE_MS);
  }
  function bumpActivity() {
    state.lastInteraction = Date.now();
    if (!state.visible) show();
    else armHideTimer();
  }

  /* Re-position when dock setting changes */
  function refreshPosition() {
    var pos = effectiveBarPosition();
    if (state.bar) state.bar.setAttribute("data-position", pos);
    if (state.schools) state.schools.setAttribute("data-position", pos);
    var tip = document.getElementById(TOOLTIP_ID);
    if (tip) tip.setAttribute("data-position", pos);
  }

  function showFirstVisitTooltip() {
    try {
      if (localStorage.getItem(FIRST_VISIT_KEY)) return;
      localStorage.setItem(FIRST_VISIT_KEY, String(Date.now()));
    } catch (_) {}
    var tip = document.createElement("div");
    tip.id = TOOLTIP_ID;
    tip.setAttribute("data-position", effectiveBarPosition());
    tip.textContent = tr(
      "Move here to see top picks & style stations · auto-hides after 10s",
      "鼠标移到这里查看排行榜与风格电台 · 10 秒无操作自动隐藏",
    );
    document.body.appendChild(tip);
    setTimeout(function () { tip.classList.add("visible"); }, 50);
    setTimeout(function () { tip.classList.remove("visible"); }, 4500);
    setTimeout(function () { try { tip.remove(); } catch (_) {} }, 5200);
  }

  function bindReshowZone() {
    /* Edge-detection re-show: cursor near the bar's expected location
     * brings it back. Threshold is 80px from screen edge on the bar's
     * side. */
    document.addEventListener("pointermove", function (event) {
      var pos = effectiveBarPosition();
      var near = pos === "top"
        ? event.clientY <= 120
        : event.clientY >= window.innerHeight - 140;
      if (near) bumpActivity();
    }, { passive: true });
  }

  function init() {
    if (document.getElementById(BAR_ID)) return;
    injectStyle();

    state.bar = document.createElement("div");
    state.bar.id = BAR_ID;
    state.bar.setAttribute("data-position", effectiveBarPosition());
    state.bar.setAttribute("data-hidden", "1");
    state.bar.setAttribute("aria-label", tr("Activity bar", "活动栏"));
    state.bar.setAttribute("role", "tablist");
    document.body.appendChild(state.bar);

    state.schools = document.createElement("div");
    state.schools.id = SCHOOLS_ID;
    state.schools.setAttribute("data-position", effectiveBarPosition());
    state.schools.setAttribute("data-hidden", "1");
    state.schools.setAttribute("aria-label", tr("Schools of thought", "文明流派"));
    document.body.appendChild(state.schools);

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

    /* Listen for dock-position changes to re-flip our position. */
    document.addEventListener("cssos:panel-behavior-changed", refreshPosition);
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
