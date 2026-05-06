/* CSSOS_SHORTCUTS_OVERLAY 20260506 — Jing
 *
 * Press `?` (Shift + /) anywhere → fullscreen-overlay cheatsheet that
 * lists every panel-shortcut + cinema control. Press `?` or Esc again
 * to close.
 *
 * Discoverability win: cssOS already wires 14+ panel shortcuts via
 * app.panel-shortcuts.js (single keystroke opens For-You / Watch /
 * CSSMV / Profile etc.) plus cinema-mode keys, but a first-time user
 * has no way to find them. This overlay surfaces the whole table at
 * the cost of one keystroke.
 *
 * Lives outside cinema's idle-hide CSS — overlay is content the user
 * just opened, not chrome.
 */
(function () {
  "use strict";

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("zh") === 0 && zh) return zh;
    return en;
  }

  var SHORTCUTS = [
    { section: tt("Panels", "面板") },
    { keys: "F", desc: tt("For You", "为你创作") },
    { keys: "W", desc: tt("Watch (MV panel)", "Watch (MV 面板)") },
    { keys: "C", desc: tt("CSSMV pipeline", "CSSMV 流水线") },
    { keys: "L", desc: tt("Lyrics", "歌词") },
    { keys: "M", desc: tt("Music", "音乐") },
    { keys: "V", desc: tt("Video", "视频") },
    { keys: "K", desc: tt("Works center", "作品中心") },
    { keys: "P", desc: tt("Profile", "个人资料") },
    { keys: "U", desc: tt("Subscription", "订阅") },
    { keys: "G", desc: tt("Settings", "设置") },
    { keys: "B", desc: tt("About", "关于") },
    { keys: "A", desc: tt("API", "API") },
    { keys: "R", desc: tt("Reports", "报表") },
    { keys: "O", desc: tt("Delivery ops", "交付运维") },
    { keys: "E", desc: tt("Seller", "商家") },
    { section: tt("Cinema", "影院模式") },
    { keys: "Esc", desc: tt("Exit cinema fullscreen", "退出影院全屏") },
    { keys: tt("Mouse move", "鼠标移动"), desc: tt("Reveal title bar (1.5s)", "短暂显示标题栏 (1.5 秒)") },
    { keys: tt("Click ⤢", "点击 ⤢"), desc: tt("Toggle cinema fullscreen", "切换影院全屏") },
    { keys: tt("Click —", "点击 —"), desc: tt("Collapse media frame, pause", "折叠媒体框 + 暂停") },
    { keys: tt("Click ✕", "点击 ✕"), desc: tt("Close MV, exit cinema", "关闭 MV 退出影院") },
    { section: tt("MV (in fullscreen)", "MV (全屏时)") },
    { keys: "Space", desc: tt("Play / Pause", "播放 / 暂停") },
    { keys: "J / L", desc: tt("Seek -10s / +10s", "后退 10 秒 / 前进 10 秒") },
    { keys: "← / →", desc: tt("Seek -5s / +5s", "后退 5 秒 / 前进 5 秒") },
    { keys: "↑ / ↓", desc: tt("Volume +/- 5%", "音量 +/- 5%") },
    { keys: "0..9", desc: tt("Jump to 0..90% of duration", "跳到 0..90% 进度") },
    { keys: "S", desc: tt("Save current frame as PNG", "保存当前帧为 PNG") },
    { section: tt("Discovery", "查询") },
    { keys: "?", desc: tt("Show this cheat sheet", "显示这个快捷键速查") },
  ];

  var overlay = null;

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "cssos-shortcuts-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", tt("Keyboard shortcuts", "键盘快捷键"));
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,8,6,0.78);backdrop-filter:blur(12px);" +
      "opacity:0;transition:opacity .18s ease;" +
      "font:14px/1.4 -apple-system,system-ui,sans-serif;color:#daffee;";
    overlay.addEventListener("click", function (e) {
      // Click backdrop dismisses; clicks inside the card don't.
      if (e.target === overlay) hide();
    });
    var card = document.createElement("div");
    card.style.cssText =
      "max-width:min(720px,92vw);max-height:82vh;overflow:auto;" +
      "padding:24px 28px;border-radius:18px;" +
      "background:rgba(8,18,16,0.96);" +
      "border:1px solid rgba(0,245,160,0.35);" +
      "box-shadow:0 30px 80px rgba(0,0,0,0.6);";
    var head = document.createElement("div");
    head.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px;";
    var title = document.createElement("div");
    title.textContent = tt("Keyboard Shortcuts", "键盘快捷键");
    title.style.cssText = "font:700 16px/1 -apple-system,system-ui,sans-serif;letter-spacing:.04em;";
    var hint = document.createElement("div");
    hint.textContent = tt("Press ? or Esc to close", "按 ? 或 Esc 关闭");
    hint.style.cssText = "font:400 11px/1 ui-monospace,monospace;color:rgba(218,255,238,0.55);";
    head.appendChild(title);
    head.appendChild(hint);
    card.appendChild(head);
    var grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:0 24px;";
    var leftCol = document.createElement("div");
    var rightCol = document.createElement("div");
    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    card.appendChild(grid);
    var col = leftCol;
    SHORTCUTS.forEach(function (item, i) {
      // After the panels section (16 items in our list) flip to right column.
      if (i === Math.ceil(SHORTCUTS.length / 2)) col = rightCol;
      if (item.section) {
        var s = document.createElement("div");
        s.textContent = item.section;
        s.style.cssText =
          "margin:14px 0 8px;font:600 11px/1 ui-monospace,monospace;" +
          "letter-spacing:.08em;text-transform:uppercase;color:rgba(0,245,160,0.85);";
        col.appendChild(s);
        return;
      }
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:10px;padding:5px 0;";
      var kbd = document.createElement("kbd");
      kbd.textContent = item.keys;
      kbd.style.cssText =
        "min-width:48px;padding:3px 8px;border-radius:6px;text-align:center;" +
        "background:rgba(0,245,160,0.14);border:1px solid rgba(0,245,160,0.3);" +
        "font:600 11px/1.2 ui-monospace,monospace;color:#daffee;flex:0 0 auto;";
      var desc = document.createElement("div");
      desc.textContent = item.desc;
      desc.style.cssText = "font:400 13px/1.3 -apple-system,system-ui,sans-serif;flex:1;";
      row.appendChild(kbd);
      row.appendChild(desc);
      col.appendChild(row);
    });
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    return overlay;
  }

  function show() {
    var el = build();
    el.style.display = "flex";
    requestAnimationFrame(function () { el.style.opacity = "1"; });
  }
  function hide() {
    if (!overlay) return;
    overlay.style.opacity = "0";
    setTimeout(function () { if (overlay) overlay.style.display = "none"; }, 200);
  }
  function toggle() {
    if (!overlay || overlay.style.opacity !== "1") show();
    else hide();
  }

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  window.addEventListener("keydown", function (e) {
    // `?` is Shift+/ on most layouts. Match by .key for resilience.
    if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      toggle();
      return;
    }
    if (e.key === "Escape" && overlay && overlay.style.opacity === "1") {
      e.preventDefault();
      hide();
    }
  });

  globalThis.cssosShortcutsOverlay = { show: show, hide: hide, toggle: toggle };
})();
