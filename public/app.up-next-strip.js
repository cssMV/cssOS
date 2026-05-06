/* CSSOS_PHASE_UP_NEXT_STRIP 20260506 — Jing
 *
 * "正在播放的作品，在最后的 5 秒，10 秒，或者多少秒结束之前，MV 的底部
 *  显示 10 个即将播放的作品，如果用户不干预，他们将按照相应的播放模式
 *  继续，如果用户干预，比如点击某个作品，那就是下一个要播放的作品."
 *
 * Behavior:
 *   - Fade in when (currentVideo.duration - currentVideo.currentTime) ≤
 *     LEAD_SECONDS. Fade out on `ended` / `pause-then-resume`.
 *   - Render the next COUNT items from the active playlist, skipping
 *     the currently-playing entry. Each card is a tiny thumbnail + the
 *     work title, click to "set as next".
 *   - Lives ABOVE the cinema chrome-hide rules (this strip is content,
 *     not chrome — so the idle-hide selector list does NOT include it).
 *   - Mounted INSIDE #watch-panel so browser fullscreen on the panel
 *     keeps the strip visible.
 *
 * Parameters (both runtime-tunable, defaults match Jing's brief):
 *   localStorage.cssos_up_next_lead_seconds   default 10
 *   localStorage.cssos_up_next_count          default 10
 *   globalThis.__cssosUpNextLead              code-level override
 *   globalThis.__cssosUpNextCount             code-level override
 *
 * Public API:
 *   globalThis.cssosUpNext.setLead(seconds)
 *   globalThis.cssosUpNext.setCount(n)
 *   globalThis.cssosUpNext.show()             force show now
 *   globalThis.cssosUpNext.hide()             force hide now
 *   globalThis.cssosUpNext.refresh()          rebuild from playlist
 */
(function () {
  "use strict";

  function readNumberSetting(key, globalKey, fallback) {
    var fromGlobal = Number(globalThis[globalKey] || 0);
    if (fromGlobal > 0) return fromGlobal;
    try {
      var raw = Number(localStorage.getItem(key) || 0);
      if (raw > 0) return raw;
    } catch (_e) {}
    return fallback;
  }
  function leadSeconds() {
    return readNumberSetting("cssos_up_next_lead_seconds", "__cssosUpNextLead", 10);
  }
  function countItems() {
    return Math.max(1, Math.min(40, readNumberSetting("cssos_up_next_count", "__cssosUpNextCount", 10)));
  }

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("zh") === 0 && zh) return zh;
    return en;
  }

  /* The strip itself — built once, lazily appended into the watch panel. */
  var stripEl = null;
  var listEl = null;
  var visible = false;
  var settingsPopover = null;

  var LEAD_OPTIONS = [5, 10, 15];
  var COUNT_OPTIONS = [5, 8, 10, 15];

  function dismissSettings() {
    if (!settingsPopover || !settingsPopover.parentNode) return;
    settingsPopover.style.opacity = "0";
    setTimeout(function () {
      if (settingsPopover && settingsPopover.parentNode) {
        settingsPopover.parentNode.removeChild(settingsPopover);
      }
      settingsPopover = null;
    }, 160);
  }

  function buildOptionRow(label, options, currentValue, unit, onChoose) {
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:6px;";
    var lbl = document.createElement("div");
    lbl.textContent = label;
    lbl.style.cssText = "color:#daffee;font:600 11px/1 ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;opacity:.78;";
    wrap.appendChild(lbl);
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px;";
    options.forEach(function (val) {
      var b = document.createElement("button");
      b.type = "button";
      var active = Number(val) === Number(currentValue);
      b.textContent = String(val) + unit;
      b.style.cssText =
        "padding:6px 10px;border-radius:8px;cursor:pointer;flex:1 1 auto;" +
        "font:600 12px/1 ui-monospace,monospace;" +
        "border:1px solid " + (active ? "rgba(0,245,160,0.65)" : "rgba(0,245,160,0.18)") + ";" +
        "background:" + (active ? "rgba(0,245,160,0.2)" : "rgba(0,0,0,0.32)") + ";" +
        "color:#daffee;";
      b.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        onChoose(val);
      });
      row.appendChild(b);
    });
    wrap.appendChild(row);
    return wrap;
  }

  function toggleSettingsPopover(anchor) {
    if (settingsPopover) { dismissSettings(); return; }
    settingsPopover = document.createElement("div");
    settingsPopover.style.cssText =
      "position:fixed;z-index:2147483647;min-width:240px;padding:14px 16px;" +
      "border-radius:12px;background:rgba(8,18,16,0.96);color:#daffee;" +
      "border:1px solid rgba(0,245,160,0.3);" +
      "box-shadow:0 16px 40px rgba(0,0,0,0.55);" +
      "display:flex;flex-direction:column;gap:14px;" +
      "transition:opacity .14s ease;opacity:0;font:14px/1.4 -apple-system,system-ui,sans-serif;";
    var rect = anchor.getBoundingClientRect();
    var top = Math.max(8, rect.top - 230);
    var right = Math.max(16, window.innerWidth - rect.right - 6);
    settingsPopover.style.top = top + "px";
    settingsPopover.style.right = right + "px";
    settingsPopover.appendChild(buildOptionRow(
      tt("Lead time", "提前露出"),
      LEAD_OPTIONS,
      leadSeconds(),
      "s",
      function (v) {
        try { localStorage.setItem("cssos_up_next_lead_seconds", String(v)); } catch (_e) {}
        dismissSettings();
        toggleSettingsPopover(anchor); // rebuild with new active highlight
      }
    ));
    settingsPopover.appendChild(buildOptionRow(
      tt("Count", "条目数"),
      COUNT_OPTIONS,
      countItems(),
      "",
      function (v) {
        try { localStorage.setItem("cssos_up_next_count", String(v)); } catch (_e) {}
        refresh();
        dismissSettings();
        toggleSettingsPopover(anchor);
      }
    ));
    var note = document.createElement("div");
    note.textContent = tt(
      "Saved to this browser. Refresh keeps the choice.",
      "保存在本浏览器，刷新后保留。"
    );
    note.style.cssText = "font:400 10px/1.3 ui-monospace,monospace;color:rgba(218,255,238,0.5);";
    settingsPopover.appendChild(note);
    var mount = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    mount.appendChild(settingsPopover);
    requestAnimationFrame(function () { settingsPopover.style.opacity = "1"; });
    var onAway = function (e) {
      if (!settingsPopover) return;
      if (settingsPopover.contains(e.target)) return;
      if (anchor && anchor.contains(e.target)) return;
      dismissSettings();
      document.removeEventListener("click", onAway, true);
    };
    setTimeout(function () { document.addEventListener("click", onAway, true); }, 0);
  }
  function ensureStrip() {
    if (stripEl && document.body.contains(stripEl)) return stripEl;
    stripEl = document.createElement("div");
    stripEl.id = "cssos-up-next-strip";
    stripEl.style.cssText =
      "position:fixed;left:0;right:0;bottom:24px;z-index:2147483645;" +
      "display:flex;justify-content:center;pointer-events:none;" +
      "opacity:0;transform:translateY(12px);transition:opacity .35s ease,transform .35s ease;";
    var bar = document.createElement("div");
    bar.style.cssText =
      "max-width:min(96vw,1400px);padding:10px 14px;border-radius:14px;" +
      "background:rgba(8,18,16,0.78);backdrop-filter:blur(10px);" +
      "border:1px solid rgba(0,245,160,0.22);" +
      "box-shadow:0 18px 48px rgba(0,0,0,0.55);" +
      "pointer-events:auto;display:flex;flex-direction:column;gap:6px;";
    var hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;";
    var ttl = document.createElement("div");
    ttl.textContent = tt("Up Next", "即将播放");
    ttl.style.cssText = "color:#daffee;font:600 11px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;opacity:.78;";
    var hdrRight = document.createElement("div");
    hdrRight.style.cssText = "display:flex;align-items:center;gap:10px;";
    var hint = document.createElement("div");
    hint.textContent = tt("Tap any to play it next", "点击任意一首立即播放");
    hint.style.cssText = "color:rgba(218,255,238,0.55);font:400 11px/1 -apple-system,system-ui,sans-serif;";
    hdrRight.appendChild(hint);
    /* CSSOS_UP_NEXT_GEAR 20260506 — tunable lead/count sliders right
     * inside the strip header. Cleaner than threading two new rows
     * into the (already crowded) Advanced Settings panel. */
    var gear = document.createElement("button");
    gear.type = "button";
    gear.setAttribute("aria-label", "Up Next settings");
    gear.textContent = "⚙";
    gear.style.cssText =
      "background:transparent;border:0;color:rgba(218,255,238,0.7);" +
      "cursor:pointer;font:400 14px/1 ui-monospace,monospace;padding:0 4px;";
    gear.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      toggleSettingsPopover(gear);
    });
    hdrRight.appendChild(gear);
    hdr.appendChild(ttl);
    hdr.appendChild(hdrRight);
    bar.appendChild(hdr);
    listEl = document.createElement("div");
    listEl.style.cssText =
      "display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;" +
      "scrollbar-width:thin;scrollbar-color:rgba(0,245,160,0.4) transparent;" +
      "padding-bottom:4px;";
    bar.appendChild(listEl);
    stripEl.appendChild(bar);
    return stripEl;
  }

  function pickNextItems() {
    var pl = globalThis.cssosPlaylists;
    if (!pl || typeof pl.getActive !== "function") return [];
    var active = null;
    try { active = pl.getActive(); } catch (_e) { return []; }
    if (!active || !Array.isArray(active.items) || active.items.length === 0) return [];
    var current = null;
    try { current = pl.current && pl.current(); } catch (_e) {}
    var currentId = current && (current.id || current.work_id);
    var items = active.items.filter(function (it) {
      var id = it && (it.id || it.work_id);
      return id && id !== currentId;
    });
    return items.slice(0, countItems());
  }

  function truncateTitle(s, n) {
    s = String(s || "").trim();
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + "…";
  }

  function buildCard(item, index) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "cssos-up-next-card";
    card.dataset.workId = String(item.id || item.work_id || "");
    card.style.cssText =
      "display:flex;flex-direction:column;align-items:flex-start;gap:6px;flex:0 0 auto;" +
      "width:140px;padding:6px;border-radius:10px;border:1px solid " +
      (index === 0 ? "rgba(0,245,160,0.55)" : "rgba(0,245,160,0.18)") + ";" +
      "background:" + (index === 0 ? "rgba(0,245,160,0.12)" : "rgba(0,0,0,0.32)") + ";" +
      "color:#daffee;cursor:pointer;text-align:left;transition:transform .12s ease,border-color .12s ease;";
    card.onmouseenter = function () { card.style.transform = "translateY(-2px)"; };
    card.onmouseleave = function () { card.style.transform = ""; };

    var thumb = document.createElement("div");
    var thumbUrl = String(item.cover_image || item.preview_image_url || item.cover_image_url || "").trim();
    thumb.style.cssText =
      "width:100%;aspect-ratio:16/9;border-radius:6px;background:#000 center/cover no-repeat;" +
      "position:relative;";
    /* CSSOS_UP_NEXT_THUMB_PRELOAD 20260506 — Jing
     * "请提前缓冲，让缩略图都显示". Background-image isn't aggressively
     * prefetched. Force-load via new Image() the moment the card builds;
     * paint via inline style only after the bytes are in the cache so the
     * card never flashes black. */
    if (thumbUrl) {
      var preloader = new Image();
      preloader.decoding = "async";
      preloader.onload = function () {
        thumb.style.backgroundImage = "url('" + thumbUrl.replace(/'/g, "%27") + "')";
      };
      // If load fails, leave the black box — better than a broken-img
      // glyph in the corner.
      preloader.src = thumbUrl;
      // Some hosts honour <link rel=preload>; cheaper to just kick the
      // GET above. If the browser already has it, the onload fires sync.
    }
    if (index === 0) {
      var nextBadge = document.createElement("span");
      nextBadge.textContent = tt("Next", "下一首");
      nextBadge.style.cssText =
        "position:absolute;top:4px;left:4px;padding:2px 6px;border-radius:4px;" +
        "background:rgba(0,245,160,0.85);color:#001b14;font:700 9px/1 ui-monospace,monospace;letter-spacing:.06em;";
      thumb.appendChild(nextBadge);
    }
    card.appendChild(thumb);

    var title = document.createElement("div");
    title.textContent = truncateTitle(item.title, 32) || "—";
    title.title = String(item.title || "");
    title.style.cssText = "font:500 12px/1.25 -apple-system,system-ui,sans-serif;color:#daffee;width:100%;";
    card.appendChild(title);

    if (item.style) {
      var style = document.createElement("div");
      style.textContent = truncateTitle(String(item.style).split(/[,，\n]/)[0], 24);
      style.style.cssText = "font:400 10px/1.2 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,0.55);width:100%;";
      card.appendChild(style);
    }

    card.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      jumpTo(item);
    });
    return card;
  }

  function jumpTo(item) {
    var id = String(item && (item.id || item.work_id) || "").trim();
    if (!id) return;
    try {
      var pl = globalThis.cssosPlaylists;
      if (pl && typeof pl.seekTo === "function") {
        pl.seekTo(id);
      }
    } catch (_e) {}
    // Trigger the existing "open work" flow. openMarketWorkPreview is the
    // universal entry — it'll honour playlist scope set above.
    try {
      if (typeof globalThis.openMarketWorkPreview === "function") {
        globalThis.openMarketWorkPreview(item);
      }
    } catch (_e) {}
    hide();
  }

  function refresh() {
    if (!listEl) ensureStrip();
    if (!listEl) return;
    listEl.innerHTML = "";
    var items = pickNextItems();
    if (!items.length) {
      hide();
      return;
    }
    items.forEach(function (it, i) { listEl.appendChild(buildCard(it, i)); });
  }

  function show() {
    if (visible) return;
    var watchPanel = document.getElementById("watch-panel");
    if (!watchPanel || watchPanel.classList.contains("hidden")) return;
    var el = ensureStrip();
    refresh();
    if (!el.querySelector(".cssos-up-next-card")) return; // empty list, nothing to do
    var mount = document.fullscreenElement || document.webkitFullscreenElement || watchPanel || document.body;
    mount.appendChild(el);
    requestAnimationFrame(function () {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    visible = true;
  }

  function hide() {
    if (!visible || !stripEl) return;
    stripEl.style.opacity = "0";
    stripEl.style.transform = "translateY(12px)";
    visible = false;
  }

  function timeUpdateHandler(e) {
    var v = e && e.target;
    if (!v || !v.duration || !isFinite(v.duration) || v.duration < 1) return;
    var remaining = v.duration - v.currentTime;
    if (remaining <= leadSeconds() && remaining > 0.3) {
      show();
    } else if (remaining > leadSeconds() + 0.5) {
      hide();
    }
  }

  function endedHandler() { hide(); }
  function emptiedHandler() { hide(); }

  function bindMedia() {
    var v = document.getElementById("watch-video");
    var a = document.getElementById("watch-audio-preview");
    [v, a].forEach(function (el) {
      if (!el) return;
      if (el.dataset.cssosUpNextBound === "1") return;
      el.dataset.cssosUpNextBound = "1";
      el.addEventListener("timeupdate", timeUpdateHandler, { passive: true });
      el.addEventListener("ended", endedHandler, { passive: true });
      el.addEventListener("emptied", emptiedHandler, { passive: true });
    });
  }
  function bindWatchPanelClose() {
    var wp = document.getElementById("watch-panel");
    if (!wp || wp.dataset.cssosUpNextWPBound === "1") return;
    wp.dataset.cssosUpNextWPBound = "1";
    new MutationObserver(function () {
      if (wp.classList.contains("hidden")) hide();
    }).observe(wp, { attributes: true, attributeFilter: ["class"] });
  }

  function init() {
    bindMedia();
    bindWatchPanelClose();
    // re-bind whenever new media elements show up (e.g. after panel rebuild).
    var bodyObs = new MutationObserver(function () {
      bindMedia();
      bindWatchPanelClose();
    });
    if (document.body) bodyObs.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  globalThis.cssosUpNext = {
    setLead: function (n) {
      try { localStorage.setItem("cssos_up_next_lead_seconds", String(Math.max(1, Number(n) || 10))); } catch (_e) {}
    },
    setCount: function (n) {
      try { localStorage.setItem("cssos_up_next_count", String(Math.max(1, Math.min(40, Number(n) || 10)))); } catch (_e) {}
    },
    show: show,
    hide: hide,
    refresh: refresh,
    leadSeconds: leadSeconds,
    countItems: countItems
  };
})();
