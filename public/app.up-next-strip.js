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
    // CSSOS_WAVE_894 — Jing: N 秒/N 卡【本就用户自定义】(⚙ 里调 lead_seconds + count), 系统默认 10 卡,
    //   有人(Jing)偏好 30。撤回 W892 擅改的 5, 恢复默认 10 + 保留自定义(1–40)。
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

  /* CSSOS_WAVE_126 20260514 — Jing: "点切歌只是预选，当前歌放完才自然切".
   * Preselect state. Clicking an up-next card no longer interrupts the
   * current song — it marks that work as "待播 / Queued". When the
   * current song's media fires `ended`, we switch to the preselected
   * work. Clicking a different card before `ended` just replaces the
   * preselection (and re-preloads). All switches go through
   * switchToWorkById() which fetches canonical data by ID — never
   * trusts the stale playlist item shape. */
  var preselectedId = null;       // work_id of the queued-next work
  var preselectedItem = null;     // last-known shape (for thumb only)
  var preloadEls = [];            // hidden <audio>/<video>/Image refs to release
  var preloadForId = "";          // which work_id the current preload belongs to

  // CSSOS_WAVE_251 20260520 — Jing: 倒计时/即将播放上限加到 30秒/30首.
  var LEAD_OPTIONS = [5, 8, 10, 15, 30];
  var COUNT_OPTIONS = [5, 8, 10, 15, 30];

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
    /* CSSOS_WAVE_375 20260523 — Jing「卡片压在媒体上, 背景透明」: 这条 UP NEXT
     * 是 position:fixed 浮层(不占布局), 但之前内层是一块不透明深色药丸 = 底部黑块感.
     * 改为【整条透明】, 仅在底部铺一层很淡的渐变 scrim(纯为文字/缩略图在亮画面上
     * 可读), 媒体继续铺满全屏、卡片浮在其上。每张缩略图仍有自己的淡底, 看得出是卡片。 */
    stripEl.style.cssText =
      "position:fixed;left:0;right:0;bottom:max(18px,env(safe-area-inset-bottom,0px));z-index:2147483645;" +
      "display:flex;justify-content:center;pointer-events:none;" +
      // CSSOS_WAVE_893 — Jing「去掉 CTA 通栏半透明背景」: 撤掉从下往上的黑色渐变 scrim, 整条透明,
      //   只靠每张卡自己的淡底, 画面 100% 留给 MV。
      "padding-top:40px;" +
      // CSSOS_WAVE_896 — 更顺的淡入 + 轻微上浮(ease-out 缓动, 16px 起跳)。
      "opacity:0;transform:translateY(16px);transition:opacity .42s cubic-bezier(.22,.7,.2,1),transform .42s cubic-bezier(.22,.7,.2,1);";
    var bar = document.createElement("div");
    // CSSOS_WAVE_1165 — Jing 指令: 只显示 ~6 张卡(6×140 + 5×8gap + 内边距 ≈ 920px), 其余左右滑动加载;
    //   窄一点 → 居中后两侧留白, 不再蹭到右轨/左下标题(防苹果判拥挤)。listEl 本就 overflow-x:auto 可滑。
    bar.style.cssText =
      "max-width:min(92vw,920px);padding:10px 14px;border-radius:14px;" +
      "background:transparent;" +
      "pointer-events:auto;display:flex;flex-direction:column;gap:6px;";
    var hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;";
    // CSSOS_WAVE_896 — Jing「UP NEXT 缩成极小图标 ▸」: 省掉文字, 更克制未来感。
    var ttl = document.createElement("div");
    ttl.textContent = "▸";
    ttl.title = tt("Up Next", "即将播放");
    ttl.style.cssText = "color:rgba(0,245,160,0.85);font:600 13px/1 ui-monospace,monospace;opacity:.8;";
    // CSSOS_WAVE_265 — 倒计时不再放条头, 改放在用户选中的那张卡的徽章上.
    var hdrRight = document.createElement("div");
    hdrRight.style.cssText = "display:flex;align-items:center;gap:10px;";
    // CSSOS_WAVE_892 — Jing「极简」: 去掉啰嗦的"Tap to queue…"长提示(卡片可点本就自明), 只留 ⚙。
    var hint = document.createElement("div");
    hint.style.cssText = "display:none;";
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
    /* CSSOS_UP_NEXT_ORDER_FIX 20260506 — Jing
     * Previously we just filtered out the current item and returned
     * the head of the playlist — so the strip always showed the same
     * "newest" cards regardless of where in the queue the user was.
     * Now slice strictly AFTER the current index. If loop_all is on
     * (or we're near the tail), wrap to the head so the strip is
     * never empty mid-queue. Items still skip the current one. */
    var items = active.items.slice();
    var idx = -1;
    if (currentId) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var id = it && (it.id || it.work_id);
        if (id === currentId) { idx = i; break; }
      }
    }
    var ordered;
    if (idx >= 0) {
      var loopAll = active.mode === "loop_all" || active.loop === "all" || active.loop === true;
      if (loopAll) {
        // Concat tail-after-current + head-before-current.
        ordered = items.slice(idx + 1).concat(items.slice(0, idx));
      } else {
        ordered = items.slice(idx + 1);
      }
    } else {
      // Couldn't locate current item — fall back to the playlist as-is
      // minus any duplicate of currentId, preserving order.
      ordered = items.filter(function (it) {
        var id = it && (it.id || it.work_id);
        return id !== currentId;
      });
    }
    return ordered.slice(0, countItems());
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
    // CSSOS_WAVE_896 — Jing「玻璃片卡」: 不再实色深块, 改 1px 细边 + 极淡半透明填充 + 背景模糊(悬浮光卡感)。
    //   下一首(index 0)用薄荷强调边/淡薄荷玻璃; 其余中性淡玻璃。和四边框进度光呼应, 未来感。
    card.style.cssText =
      "display:flex;flex-direction:column;align-items:flex-start;gap:6px;flex:0 0 auto;" +
      "width:140px;padding:6px;border-radius:12px;border:1px solid " +
      (index === 0 ? "rgba(0,245,160,0.45)" : "rgba(255,255,255,0.14)") + ";" +
      "background:" + (index === 0 ? "rgba(0,245,160,0.07)" : "rgba(255,255,255,0.05)") + ";" +
      "-webkit-backdrop-filter:blur(10px) saturate(1.15);backdrop-filter:blur(10px) saturate(1.15);" +
      "box-shadow:0 4px 18px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.10);" +
      "color:#eafff6;cursor:pointer;text-align:left;transition:transform .16s ease,border-color .16s ease,background .16s ease;";
    card.onmouseenter = function () { card.style.transform = "translateY(-2px)"; };
    card.onmouseleave = function () { card.style.transform = ""; };

    var thumb = document.createElement("div");
    /* CSSOS_UP_NEXT_THUMB_FIELD 20260506 — Jing
     * "缩略图还是没有出来". Root cause: playlist items go through
     * normaliseItem() in app.playlists.js, which stores the cover URL
     * ONLY in `cover_url` (line 134). My lookup chain missed that key.
     * Now read cover_url first, then fall back to the original-shape
     * keys for any work passed in directly (share-link / market). */
    var thumbUrl = String(
      item.cover_url ||
      item.cover_image ||
      item.preview_image_url ||
      item.cover_image_url ||
      ""
    ).trim();
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
    /* CSSOS_WAVE_126 — badge logic:
     *   • A preselected card always wins the badge ("待播 / Queued",
     *     amber) regardless of position.
     *   • Otherwise index 0 shows the default auto-advance "下一首"
     *     (green) — but ONLY when nothing is preselected, so the user
     *     isn't confused about which one actually plays next. */
    var cardId = String((item && (item.id || item.work_id)) || "").trim();
    var isPreselected = !!preselectedId && cardId === preselectedId;
    /* CSSOS_WAVE_265 20260521 — Jing: 倒计时加在"将要播放的那张卡"上 (用户选
     * 谁就在谁身上; 默认 index0). 徽章带 class + data-base 文案, timeUpdate
     * 每帧把它更新成 "待播 · 8s" / "下一首 · 8s". 改选时徽章随预选卡移动. */
    if (isPreselected) {
      var queuedBadge = document.createElement("span");
      queuedBadge.className = "cssos-up-next-countdown-badge";
      queuedBadge.dataset.baseLabel = tt("Queued", "待播");
      queuedBadge.textContent = queuedBadge.dataset.baseLabel;
      queuedBadge.style.cssText =
        "position:absolute;top:4px;left:4px;padding:2px 6px;border-radius:4px;" +
        "background:rgba(255,200,60,0.92);color:#1a1300;font:700 9px/1 ui-monospace,monospace;letter-spacing:.06em;font-variant-numeric:tabular-nums;";
      thumb.appendChild(queuedBadge);
      // Amber ring on the whole card so it's unmistakable.
      card.style.borderColor = "rgba(255,200,60,0.85)";
      card.style.background = "rgba(255,200,60,0.10)";
    } else if (index === 0 && !preselectedId) {
      var nextBadge = document.createElement("span");
      nextBadge.className = "cssos-up-next-countdown-badge";
      nextBadge.dataset.baseLabel = tt("Next", "下一首");
      nextBadge.textContent = nextBadge.dataset.baseLabel;
      nextBadge.style.cssText =
        "position:absolute;top:4px;left:4px;padding:2px 6px;border-radius:4px;" +
        "background:rgba(0,245,160,0.85);color:#001b14;font:700 9px/1 ui-monospace,monospace;letter-spacing:.06em;font-variant-numeric:tabular-nums;";
      thumb.appendChild(nextBadge);
    }
    // CSSOS_WAVE_891 — Jing「右下角那个'0'按钮不知道干什么, 删掉」: 撤掉 W277 的大号居中倒计时数字。
    // 它在移动端浮成一个莫名的"0"方块(图1/2), 让人困惑, 且属于 CTA 切歌那套(本就要收敛)。整块删除。
    card.appendChild(thumb);

    // CSSOS_WAVE_1092 — Jing「Next-up 卡显示多部作品」: 多部(三部曲/歌剧/剧集/短剧/电影)→
    //   叠卡边(=一套) + 类型徽章(=是什么) + 章节位「类型 · N/M」(=第几枝)。单曲不变。
    var _wt = String(item.root_work_type || item.work_type || "").toLowerCase();
    var _pi = Number(item.part_index || 0), _pt = Number(item.part_total || 0);
    var _multi = _pt > 1 || ["triptych", "opera", "series", "shortplay", "film"].indexOf(_wt) >= 0;
    if (_multi) {
      var _m = ({
        triptych: ["🎬", "三部曲", "Triptych"], opera: ["🎭", "歌剧", "Opera"],
        series: ["📺", "剧集", "Series"], shortplay: ["🎬", "短剧", "Short"], film: ["🎞️", "电影", "Film"],
      })[_wt] || ["🎬", "合集", "Set"];
      thumb.style.boxShadow = "3px -3px 0 -1px rgba(255,255,255,0.18), 6px -6px 0 -2px rgba(255,255,255,0.10)";
      var tb = document.createElement("span");
      tb.textContent = _m[0] + " " + tt(_m[2], _m[1]);
      tb.style.cssText = "position:absolute;top:4px;right:4px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,0.6);color:#9fe9d4;font:600 9px/1 -apple-system,system-ui,sans-serif;";
      thumb.appendChild(tb);
    }

    var title = document.createElement("div");
    title.textContent = truncateTitle(item.title, 32) || "—";
    title.title = String(item.title || "");
    title.style.cssText = "font:500 12px/1.25 -apple-system,system-ui,sans-serif;color:#daffee;width:100%;";
    card.appendChild(title);

    if (_multi) {
      var pc = document.createElement("div");
      pc.textContent = (_pi && _pt) ? (tt(_m[2], _m[1]) + " · " + _pi + "/" + _pt) : tt(_m[2], _m[1]);
      pc.style.cssText = "font:600 10px/1.2 -apple-system,system-ui,sans-serif;color:#5effc9;width:100%;";
      card.appendChild(pc);
    }

    /* CSSOS_WAVE_205 20260516 — Jing: "人物MV进入MV面板，每次播放结束前
     * 显示的另一个人物的卡片，要标注人物名称。为你创作/作品中心每次
     * 播放结束前显示的待播卡片，要显示作品时长". Two new bottom rows:
     *   - person line (when item carries a person_name from person-MV)
     *   - meta line: duration (mm:ss) on the left, style on the right */
    var personName = String(
      item.person_name || item.personName || item.__personName ||
      item.person_display_name || ""
    ).trim();
    if (personName) {
      var personEl = document.createElement("div");
      personEl.textContent = "👤 " + truncateTitle(personName, 24);
      personEl.title = personName;
      personEl.style.cssText = "font:600 10.5px/1.2 -apple-system,system-ui,sans-serif;color:#ffd28d;width:100%;";
      card.appendChild(personEl);
    }
    var metaEl = document.createElement("div");
    metaEl.style.cssText =
      "display:flex;align-items:center;gap:6px;width:100%;" +
      "font:400 10px/1.2 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,0.55);";
    var durSecs = Number(
      item.duration_secs ?? item.audio_duration_secs ??
      item.preview_duration_secs ?? item.total_duration_secs ?? 0
    ) || 0;
    if (durSecs > 0) {
      var durEl = document.createElement("span");
      durEl.textContent =
        Math.floor(durSecs / 60) + ":" +
        String(Math.floor(durSecs % 60)).padStart(2, "0");
      durEl.style.cssText = "font-variant-numeric:tabular-nums;font-weight:600;color:rgba(218,255,238,0.78);";
      metaEl.appendChild(durEl);
    }
    if (item.style) {
      var style = document.createElement("span");
      style.textContent = truncateTitle(String(item.style).split(/[,，\n]/)[0], 18);
      style.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;";
      metaEl.appendChild(style);
    }
    if (metaEl.children.length) card.appendChild(metaEl);

    card.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      // CSSOS_WAVE_126 — click = preselect, NOT an immediate jump. The
      // current song keeps playing; this work becomes 待播 / Queued.
      preselect(item);
    });
    return card;
  }

  /* CSSOS_WAVE_126 — release any hidden preload elements from a prior
   * preselection so we don't leak <audio>/<video> nodes or keep
   * downloading a work the user changed their mind about. */
  function releasePreload() {
    preloadEls.forEach(function (el) {
      try {
        if (el && el.tagName) {
          el.removeAttribute("src");
          if (typeof el.load === "function") el.load();
          if (el.parentNode) el.parentNode.removeChild(el);
        }
      } catch (_e) {}
    });
    preloadEls = [];
    preloadForId = "";
  }

  /* CSSOS_WAVE_126 — warm the browser cache for the queued work's heavy
   * assets (audio + video + cover) so the eventual switch is instant.
   * `work` is canonical data already fetched by ID. */
  function preloadWork(work) {
    releasePreload();
    if (!work) return;
    var wid = String(work.id || work.work_id || "").trim();
    preloadForId = wid;
    var audioUrl = String(
      work.audio_track_1_url || work.audio_url || work.final_mv_url || ""
    ).trim();
    var videoUrl = String(
      work.preview_video_url || work.final_mv_url || work.video_url || ""
    ).trim();
    var coverUrl = String(
      work.cover_image || work.preview_image_url || work.cover_url || ""
    ).trim();
    try {
      if (audioUrl) {
        var a = document.createElement("audio");
        a.preload = "auto";
        a.muted = true;
        a.style.display = "none";
        a.src = audioUrl;
        document.body.appendChild(a);
        preloadEls.push(a);
      }
      if (videoUrl) {
        var v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.style.display = "none";
        v.src = videoUrl;
        document.body.appendChild(v);
        preloadEls.push(v);
      }
      if (coverUrl) {
        var img = new Image();
        img.decoding = "async";
        img.src = coverUrl;
        preloadEls.push(img);
      }
    } catch (_e) {}
  }

  /* CSSOS_WAVE_126 — preselect (NOT jump). Marks `item` as queued-next,
   * fetches its canonical data by ID, kicks the preload, and repaints
   * the strip so the chosen card shows the 待播 badge. Does NOT touch
   * the currently-playing media. */
  function preselect(item) {
    var id = String(item && (item.id || item.work_id) || "").trim();
    if (!id) return;
    // Toggle off if the user taps the already-preselected card again.
    if (preselectedId === id) {
      preselectedId = null;
      preselectedItem = null;
      releasePreload();
      refresh();
      toast(tt("Queued song cleared", "已取消预选"));
      return;
    }
    preselectedId = id;
    preselectedItem = item;
    refresh(); // immediate visual feedback (待播 badge)
    // Canonical fetch by ID — never trust the stale playlist item shape.
    fetch("/api/works/public/" + encodeURIComponent(id), {
      credentials: "include",
      headers: { Accept: "application/json" },
    }).then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        var data = (j && (j.data || j)) || null;
        // Ownership guard: user may have re-picked while this was in flight.
        if (preselectedId !== id) return;
        if (data && data.id) {
          preselectedItem = data; // upgrade to canonical shape
          preloadWork(data);
        }
        refresh();
      })
      .catch(function () { /* preload is best-effort */ });
    var label = truncateTitle(String(item.title || ""), 24) || tt("this song", "这首歌");
    toast(tt("Queued: " + label + " — plays when the current song ends",
             "已预选「" + label + "」— 当前歌放完自动切"));
  }

  /* CSSOS_WAVE_126 — the ONE canonical switch path. Always re-fetches
   * the full work record by ID so title / lyrics / cover / music /
   * video / subtitles / suggested price ALL belong to this exact work.
   * Binds Wave 121's work-id contract before opening. */
  function switchToWorkById(id, fallbackItem) {
    var workId = String(id || "").trim();
    if (!workId) return;
    try {
      var pl = globalThis.cssosPlaylists;
      if (pl && typeof pl.seekTo === "function") pl.seekTo(workId);
    } catch (_e) {}
    fetch("/api/works/public/" + encodeURIComponent(workId), {
      credentials: "include",
      headers: { Accept: "application/json" },
    }).then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        var data = (j && (j.data || j)) || null;
        var fresh = (data && data.id) ? data : (fallbackItem || { id: workId });
        try {
          // Wave 121: flush stale asset caches + stamp the new work-id
          // BEFORE the open flow paints anything.
          if (typeof globalThis.cssosBindToWorkId === "function") {
            globalThis.cssosBindToWorkId(fresh);
          }
        } catch (_e) {}
        try {
          if (typeof globalThis.openMarketWorkPreview === "function") {
            globalThis.openMarketWorkPreview(fresh);
          }
        } catch (_e) {}
      })
      .catch(function () {
        try {
          if (fallbackItem && typeof globalThis.openMarketWorkPreview === "function") {
            globalThis.openMarketWorkPreview(fallbackItem);
          }
        } catch (_e) {}
      });
  }

  function toast(msg) {
    try {
      if (typeof globalThis.showToast === "function") globalThis.showToast(msg);
    } catch (_e) {}
  }

  function refresh() {
    if (!listEl) ensureStrip();
    if (!listEl) return;
    listEl.innerHTML = "";
    var items = pickNextItems();
    items.forEach(function (it, i) { listEl.appendChild(buildCard(it, i)); });
    // CSSOS_WAVE_841 20260616 — Jing(D 批): "Want an MV like this" 合进 CTA 队列【最后一格】
    // (作品卡片形态), 不再单独占一行 → CTA 与 Want 不再【同时显示打架】。空队列时也至少有
    // Want 卡, 所以不再 hide()。独立 #cssos-create-cta 行由 CSS 隐藏(W841)。
    try { appendWantCard(); } catch (_e) {}
  }

  // CSSOS_WAVE_841 — Want 卡(CTA 队列最后一格)。点它走通用创作入口。
  function appendWantCard() {
    if (!listEl) return;
    var lc = (typeof globalThis.loginCopy === "function") ? globalThis.loginCopy : function (en) { return en; };
    var card = document.createElement("button");
    card.type = "button";
    card.className = "cssos-up-next-card cssos-up-next-want";
    // CSSOS_WAVE_845 — Jing「Want 整合到 CTA 最后一格」: position:sticky right:0 让它永远贴在
    // 横向滚动队列的【最右、始终可见】(否则队列长时它滚出屏外, 用户看不到)。
    card.style.cssText =
      "position:sticky;right:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;flex:0 0 auto;" +
      "width:140px;padding:6px;border-radius:12px;border:1px dashed rgba(0,245,160,0.5);" +
      // CSSOS_WAVE_896 — 玻璃片(虚线边保留=可创作的暗示), 淡薄荷玻璃 + 模糊, 与其它卡一致。
      "background:rgba(0,245,160,0.06);-webkit-backdrop-filter:blur(10px) saturate(1.15);backdrop-filter:blur(10px) saturate(1.15);box-shadow:0 4px 18px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.10);color:#eafff6;cursor:pointer;text-align:center;" +
      "box-shadow:-12px 0 16px rgba(0,0,0,0.45);transition:transform .12s ease,border-color .12s ease;";
    card.onmouseenter = function () { card.style.transform = "translateY(-2px)"; };
    card.onmouseleave = function () { card.style.transform = ""; };
    // CSSOS_WAVE_1129b — Jing 指令: 统一平台特色「爆」风格。每次出现 = 随机【大 emoji】居中,
    //   再从它【中心爆出随机色小 emoji】(复用情绪字幕字心烟花 cssosFireworkAt)。
    var bigEmo = BIG_WANT_EMOJI[(Math.random() * BIG_WANT_EMOJI.length) | 0];
    card.innerHTML =
      '<div class="cssos-want-bigemo" style="width:100%;aspect-ratio:16/9;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:36px;background:rgba(0,0,0,0.32);">' + bigEmo + "</div>" +
      '<div style="font:600 11px/1.25 -apple-system,system-ui,sans-serif;">' +
      lc("Want an MV like this?", "也想要这样一支 MV?") + "</div>";
    card.addEventListener("click", function () {
      try {
        if (typeof globalThis.startInPlaceCreation === "function") globalThis.startInPlaceCreation();
        else if (typeof globalThis.invokeUniversalCreationEntry === "function") globalThis.invokeUniversalCreationEntry();
        else {
          var go = document.querySelector("#cssos-create-cta .cssos-create-cta-go, #cssos-create-cta button");
          if (go) go.click();
        }
      } catch (_e) {}
    });
    listEl.appendChild(card);
    // CSSOS_WAVE_1139 — Jing 指令: Want 卡片【持续爆】(播放快结束的创作召唤), 从大 emoji【正中心】爆。
    ensureWantBurstLoop();
  }

  // 持续从 Want 卡片大 emoji 正中心爆出随机色小 emoji(平台特色字心烟花)。单一定时器, 自检卡片是否可见。
  var _wantBurstTimer = null;
  var _EMO_KEYS = ["joy", "ignite", "resolve", "intimate", "calm"];
  // CSSOS_WAVE_1142 — Jing 指令: 大 emoji 也要随机变, 别总是同一个。每次爆都换一枚。
  var BIG_WANT_EMOJI = ["✨", "🎉", "💫", "🌟", "💖", "🔥", "🎇", "🌈", "⚡", "🎆", "💥", "🪄", "🎶", "🌠", "💎", "🦄"];
  function fireWantBurstOnce() {
    try {
      if (typeof globalThis.cssosFireworkAt !== "function") return;
      var box = document.querySelector(".cssos-up-next-want .cssos-want-bigemo");
      if (!box) return;
      // 每次续爆前换一枚随机大 emoji(不再固定 ✨)。
      try { box.textContent = BIG_WANT_EMOJI[(Math.random() * BIG_WANT_EMOJI.length) | 0]; } catch (_e) {}
      var r = box.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > (window.innerHeight || 0)) return;   // 不可见就不爆
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;     // 正中心, 不再偏移
      var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
      var emo = _EMO_KEYS[(Math.random() * _EMO_KEYS.length) | 0];
      globalThis.cssosFireworkAt(cx / vw * 100, cy / vh * 100, emo, 14 + ((Math.random() * 8) | 0));
    } catch (_e) {}
  }
  function ensureWantBurstLoop() {
    if (_wantBurstTimer) return;
    setTimeout(fireWantBurstOnce, 180);                  // 卡片滑入定位后先爆一发
    _wantBurstTimer = setInterval(function () {
      // 卡片不存在了(切歌/关面板) → 停掉定时器, 不空转。
      if (!document.querySelector(".cssos-up-next-want .cssos-want-bigemo")) {
        clearInterval(_wantBurstTimer); _wantBurstTimer = null; return;
      }
      fireWantBurstOnce();
    }, 2200);                                            // 每 2.2s 续爆 = "一直爆"
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
    // CSSOS_WAVE_377 20260523 — Jing「Want an MV 和 UP NEXT 打架」: 两张端尾 CTA
    // 都浮在底部会叠. UP NEXT 出现时(更主要的"接下来播"),让 "Want an MV" 创作 CTA
    // 让位隐藏, 高度无关、彻底不重叠. UP NEXT 收起后它自然恢复。
    try { document.documentElement.classList.add("cssos-upnext-visible"); } catch (_e) {}
  }

  function hide() {
    // CSSOS_WAVE_1143 — Jing 指令: Next up 不提前注入。隐藏时必须【立即不可点击 + 从 DOM 移除】,
    //   否则隐形的卡片条仍浮在底部 → 点黑边误触切歌。只在 lead 窗口内 show() 才动态注入。
    if (!stripEl) { visible = false; return; }
    visible = false;
    try { document.documentElement.classList.remove("cssos-upnext-visible"); } catch (_e) {}
    // 立即掐断点击(连内层 bar 的 pointer-events:auto 一起关掉), 防淡出期间误触。
    try {
      stripEl.style.pointerEvents = "none";
      var bar = stripEl.firstElementChild; if (bar) bar.style.pointerEvents = "none";
    } catch (_e) {}
    stripEl.style.opacity = "0";
    stripEl.style.transform = "translateY(12px)";
    // 淡出后真正从 DOM 摘除(若期间没再 show)。下次 show() 经 ensureStrip 重新构建注入。
    var el = stripEl;
    setTimeout(function () { try { if (!visible && el && el.parentNode) el.parentNode.removeChild(el); } catch (_e) {} }, 460);
  }

  function timeUpdateHandler(e) {
    // CSSOS_WAVE_277 20260521 — Jing: 之前倒计时卡在 "1s" 不动. 原因: 直接用
    // timeupdate 事件源 v 的 duration-currentTime, 但 MV 模式下视频是静音的,
    // 歌曲在 #watch-audio-preview, 而视频常是【短循环预览片】(duration 仅几秒)
    // → remaining 永远≈1s 且让条一直显示. 改为按"歌曲时间轴"算: 优先用正在
    // 播放、时长有效、非循环的 audio; 否则退回事件源(同样跳过 loop 短片).
    var a = document.getElementById("watch-audio-preview");
    var primary = (a && isFinite(a.duration) && a.duration > 1 && !a.paused && !a.loop &&
      String(a.currentSrc || a.src || "").trim()) ? a : (e && e.target);
    if (!primary || !primary.duration || !isFinite(primary.duration) || primary.duration < 1) return;
    if (primary.loop) return; // 循环短片不是歌曲时间轴
    var remaining = primary.duration - primary.currentTime;
    if (remaining <= leadSeconds() && remaining > 0.3) {
      show();
      var secs = Math.max(1, Math.ceil(remaining));
      if (stripEl) {
        var badge = stripEl.querySelector(".cssos-up-next-countdown-badge");
        if (badge && badge.dataset.baseLabel) badge.textContent = badge.dataset.baseLabel + " · " + secs + "s";
        // CSSOS_WAVE_1112 — Jing「大号倒计时数字应显示在【默认卡/用户选中的卡】上, 不要固定在中间」。
        //   目标卡 = 带 .cssos-up-next-countdown-badge 的那张(render 已按 预选卡 / 默认 index0 放好,
        //   badge 挂在该卡缩略图 thumb 上)。把大数字钉在该 thumb 正中(thumb 已 position:relative),
        //   随每秒变色; 用户改选 → 下一帧 badge 随卡移动 → 大数字自动跟到新卡。清掉任何残留在别处的旧数字。
        var hostThumb = badge ? badge.parentElement : null;
        var _olds = stripEl.querySelectorAll(".cssos-up-next-countdown-big");
        for (var _o = 0; _o < _olds.length; _o++) {
          if (!hostThumb || _olds[_o].parentElement !== hostThumb) _olds[_o].remove();
        }
        if (hostThumb) {
          var big = hostThumb.querySelector(".cssos-up-next-countdown-big");
          if (!big) {
            big = document.createElement("div");
            big.className = "cssos-up-next-countdown-big";
            big.style.cssText =
              "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:7;pointer-events:none;" +
              "min-width:1.4em;height:1.4em;display:flex;align-items:center;justify-content:center;" +
              "font:800 30px/1 ui-monospace,monospace;font-variant-numeric:tabular-nums;letter-spacing:.02em;" +
              "border-radius:12px;background:radial-gradient(circle,rgba(0,0,0,0.55),rgba(0,0,0,0.10));" +
              "text-shadow:0 2px 12px rgba(0,0,0,0.9);transition:color .18s ease;";
            hostThumb.appendChild(big);
          }
          if (big.dataset.lastSec !== String(secs)) {
            big.dataset.lastSec = String(secs);
            big.style.color = "hsl(" + Math.floor(Math.random() * 360) + ",92%,62%)";
          }
          big.textContent = String(secs);
        }
      }
    } else if (remaining > leadSeconds() + 0.5) {
      hide();
    }
  }

  /* CSSOS_WAVE_126 — when the current song's media ends, if the user
   * has preselected a work, switch to it NOW (the natural moment — no
   * mid-song interruption). If nothing is preselected, fall through to
   * whatever the playlist's own auto-advance does (unchanged behavior).
   * Guard against double-fire: `ended` can fire on both the <audio> and
   * <video> for the same track. */
  // CSSOS_WAVE_895 — 单点切歌锁: 暴露"是否有 CTA 预选"给自动前进路, 让它在预选时让位(CTA 优先)。
  globalThis.__cssosUpNextHasPreselect = function () { return !!preselectedId; };
  var __lastEndedSwitchAt = 0;
  function endedHandler() {
    var now = Date.now();
    if (now - __lastEndedSwitchAt < 1500) { hide(); return; }
    if (preselectedId) {
      __lastEndedSwitchAt = now;
      // CSSOS_WAVE_895 — claim 全局切歌锁: 这次 ended 由 CTA 接管, onMediaEnded/queueStructured 全部让位,
      // 杜绝"CTA 切 A 歌 + 自动前进切 B 歌"同时开火 → 双 bind 竞态 → 后到 flush 清黑新视频。
      globalThis.__cssosEndedSwitchLock = now;
      var targetId = preselectedId;
      var fallback = preselectedItem;
      // Clear preselect state BEFORE the switch so the new track's
      // up-next strip starts clean.
      preselectedId = null;
      preselectedItem = null;
      releasePreload();
      switchToWorkById(targetId, fallback);
    }
    hide();
  }
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

  /* Canonical "open work by ID" path — fresh fetch, never trust the
   * caller's possibly-stale shape. Other modules (share-link router,
   * works-grid, dock now-playing tooltip) can call this to be sure
   * the audio + video + cover + lyric all match the requested ID. */
  globalThis.cssosOpenWorkById = function (id, fallbackItem) {
    var workId = String(id || "").trim();
    if (!workId) return Promise.resolve(false);
    return fetch("/api/works/public/" + encodeURIComponent(workId), {
      credentials: "include",
      headers: { Accept: "application/json" },
    }).then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        var data = (j && (j.data || j)) || null;
        var fresh = (data && data.id) ? data : (fallbackItem || { id: workId });
        // CSSOS_WAVE_126 — bind the work-id contract (Wave 121) so the
        // open flow flushes stale caches before painting. Belt-and-
        // suspenders against 张冠李戴 on this external entry path too.
        try {
          if (typeof globalThis.cssosBindToWorkId === "function") {
            globalThis.cssosBindToWorkId(fresh);
          }
        } catch (_e) {}
        if (typeof globalThis.openMarketWorkPreview === "function") {
          globalThis.openMarketWorkPreview(fresh);
          return true;
        }
        return false;
      })
      .catch(function () {
        if (fallbackItem && typeof globalThis.openMarketWorkPreview === "function") {
          globalThis.openMarketWorkPreview(fallbackItem);
          return true;
        }
        return false;
      });
  };

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
    countItems: countItems,
    // CSSOS_WAVE_126 — preselect API for debugging / external callers.
    preselect: preselect,
    preselectedId: function () { return preselectedId; },
    clearPreselect: function () {
      preselectedId = null; preselectedItem = null;
      releasePreload(); refresh();
    }
  };

  // CSSOS_WAVE_997 20260619 — Jing「端尾 CTA/预选绝不能带进下一首开场」: 切歌时
  // 彻底重置 up-next —— 清预选 + 释放预载媒体(省内存) + 收起条 + 关倒计时。否则
  // 上一首结束前预选的「Queued: X」会残留到新歌开头(误触 + 提前耗内存)。end-of-song
  // 体验只在结束前 LEAD 秒(timeUpdateHandler 门控)出现, 新歌从干净状态开始。
  try {
    window.addEventListener("cssos:work-id-changed", function () {
      preselectedId = null;
      preselectedItem = null;
      try { releasePreload(); } catch (_e) {}
      try { hide(); } catch (_e) {}
    });
  } catch (_e) {}
})();
