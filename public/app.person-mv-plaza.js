/* CSSOS_PERSON_MV_WAVE69 20260508 — Jing — Content plaza (TikTok-style feed).
 * Hash route #plaza opens a fullscreen vertical snap-scroll feed of public
 * MVs ranked by view+like+recency. #plaza/style/<tag> filters by Wave 21
 * style chip. Each card autoplays muted; click to unmute. Right rail has
 * like / comment / share / dm-creator overlays. Pre-fetches the next page
 * on scroll. Mobile-first; safe-area padding; dual-theme (light + dark).
 * i18n via CSSOS_I18N.tr. Vanilla JS, no deps. */
(function () {
  "use strict";
  var STYLE_ID = "cssos-plaza-style";
  var ROOT_ID  = "cssos-plaza-root";
  var FEED_ID  = "cssos-plaza-feed";

  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    // Dual-theme: dark uses pale teal, light uses forest green.
    s.textContent = [
      "#" + ROOT_ID + "{position:fixed;inset:0;z-index:9100;background:#000;display:none;}",
      "#" + ROOT_ID + ".open{display:block;}",
      "#" + ROOT_ID + " .plaza-feed{position:absolute;inset:0;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;-ms-overflow-style:none;}",
      "#" + ROOT_ID + " .plaza-feed::-webkit-scrollbar{display:none;}",
      "#" + ROOT_ID + " .plaza-card{position:relative;width:100%;height:100vh;height:100dvh;scroll-snap-align:start;scroll-snap-stop:always;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;}",
      "#" + ROOT_ID + " .plaza-card video,#" + ROOT_ID + " .plaza-card img.poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}",
      "#" + ROOT_ID + " .plaza-card .scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(0,0,0,0.55) 100%);pointer-events:none;}",
      "#" + ROOT_ID + " .plaza-overlay{position:absolute;left:0;right:0;bottom:0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.85);}",
      "#" + ROOT_ID + " .plaza-title{font:600 17px -apple-system,system-ui,sans-serif;line-height:1.3;margin:0 0 4px;color:#fff;}",
      "#" + ROOT_ID + " .plaza-sub{font:500 13px -apple-system,system-ui,sans-serif;color:rgba(255,255,255,0.92);margin:0 0 6px;}",
      "#" + ROOT_ID + " .plaza-tags{display:flex;flex-wrap:wrap;gap:6px;}",
      "#" + ROOT_ID + " .plaza-tag{background:rgba(255,255,255,0.18);color:#fff;padding:3px 8px;border-radius:999px;font:500 11px ui-monospace,monospace;}",
      "#" + ROOT_ID + " .plaza-rail{position:absolute;right:8px;bottom:120px;display:flex;flex-direction:column;gap:14px;align-items:center;padding-bottom:env(safe-area-inset-bottom,0px);}",
      "#" + ROOT_ID + " .plaza-btn{width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,0.45);color:#fff;border:1px solid rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font:600 22px -apple-system,system-ui,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;}",
      "#" + ROOT_ID + " .plaza-btn:active{transform:scale(0.92);}",
      "#" + ROOT_ID + " .plaza-btn.on{background:rgba(255,72,120,0.85);border-color:#fff;}",
      "#" + ROOT_ID + " .plaza-btn-label{font:500 11px ui-monospace,monospace;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.9);margin-top:2px;}",
      "#" + ROOT_ID + " .plaza-topbar{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;background:linear-gradient(180deg,rgba(0,0,0,0.5),rgba(0,0,0,0));}",
      "#" + ROOT_ID + " .plaza-close{background:rgba(0,0,0,0.55);color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:8px;padding:6px 12px;font:500 12px ui-monospace,monospace;cursor:pointer;}",
      "#" + ROOT_ID + " .plaza-style-select{background:rgba(0,0,0,0.55);color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:8px;padding:6px 10px;font:500 12px ui-monospace,monospace;}",
      "#" + ROOT_ID + " .plaza-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.85);font:500 14px -apple-system,system-ui,sans-serif;text-align:center;padding:24px;}",
      "#" + ROOT_ID + " .plaza-mute{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.55);color:#fff;border-radius:50%;width:64px;height:64px;display:flex;align-items:center;justify-content:center;font:600 28px -apple-system,system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .25s ease;}",
      "#" + ROOT_ID + " .plaza-card.muted .plaza-mute{opacity:1;}",
      // Light-theme overrides — still primarily dark since video plays
      // best on black; forest-green pill accents replace pale teal.
      'html[data-theme="light"] #' + ROOT_ID + ' .plaza-tag{background:rgba(34,90,52,0.92);}',
      'html[data-theme="light"] #' + ROOT_ID + ' .plaza-btn.on{background:rgba(34,90,52,0.92);}',
      'html[data-theme="light"] #' + ROOT_ID + ' .plaza-style-select{background:rgba(34,90,52,0.85);}',
    ].join("");
    document.head.appendChild(s);
  }

  function ensureRoot() {
    var root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = [
      '<div class="plaza-topbar">',
      '  <button class="plaza-close" type="button" id="cssos-plaza-close">' + escHtml(tr("Close", "关闭")) + '</button>',
      '  <select class="plaza-style-select" id="cssos-plaza-style"></select>',
      '</div>',
      '<div class="plaza-feed" id="' + FEED_ID + '"></div>',
    ].join("");
    document.body.appendChild(root);
    document.getElementById("cssos-plaza-close").addEventListener("click", close);
    document.getElementById("cssos-plaza-style").addEventListener("change", onStyleChange);
    return root;
  }

  var state = {
    items: [],
    nextCursor: null,
    style: "",
    fetching: false,
    exhausted: false,
    seen: Object.create(null),
    io: null,
    activeCard: null,
  };

  function buildStyleOptions(currentStyle) {
    var sel = document.getElementById("cssos-plaza-style");
    if (!sel) return;
    fetch("/api/person-mv/playlists", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var opts = ['<option value="">' + escHtml(tr("All styles", "全部风格")) + '</option>'];
        var rows = (j && j.data && j.data.playlists) || [];
        rows.forEach(function (p) {
          var sel = currentStyle === p.tag ? " selected" : "";
          opts.push('<option value="' + escHtml(p.tag) + '"' + sel + '>' + escHtml(p.tag) + ' (' + p.mv_count + ')</option>');
        });
        sel.innerHTML = opts.join("");
        sel.value = currentStyle || "";
      })
      .catch(function () {});
  }

  function onStyleChange(e) {
    var v = String(e.target.value || "").trim();
    if (v) location.hash = "#plaza/style/" + encodeURIComponent(v);
    else location.hash = "#plaza";
  }

  function fetchPage() {
    if (state.fetching || state.exhausted) return Promise.resolve();
    state.fetching = true;
    var qs = "limit=10";
    if (state.nextCursor) qs += "&cursor=" + encodeURIComponent(state.nextCursor);
    if (state.style) qs += "&style=" + encodeURIComponent(state.style);
    return fetch("/api/person-mv/plaza?" + qs, { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : { ok: false }; })
      .then(function (j) {
        state.fetching = false;
        if (!j || !j.ok) return;
        var fresh = (j.items || []).filter(function (it) {
          if (state.seen[it.mv_id]) return false;
          state.seen[it.mv_id] = 1;
          return true;
        });
        state.items = state.items.concat(fresh);
        state.nextCursor = j.next_cursor || null;
        if (!j.next_cursor) state.exhausted = true;
        renderAppend(fresh);
      })
      .catch(function () { state.fetching = false; });
  }

  function escapeURL(u) { return String(u || ""); }

  function cardHtml(it) {
    var poster = it.cover_image || "";
    var video  = it.final_mv_url || "";
    var personName = it.person && (it.person.name_zh || it.person.name_en) || "";
    var creator = it.creator && (it.creator.display_name || it.creator.handle) || "";
    var subParts = [];
    if (personName) subParts.push(personName);
    if (creator) subParts.push("@" + creator);
    var sub = subParts.join(" · ");
    var tags = (it.style_tags || []).slice(0, 4).map(function (t) {
      return '<span class="plaza-tag">' + escHtml(t) + '</span>';
    }).join("");
    var likeLabel = tr("Like", "赞");
    var commentLabel = tr("Comment", "评论");
    var shareLabel = tr("Share", "分享");
    var dmLabel = tr("DM", "私信");
    return [
      '<div class="plaza-card muted" data-mv-id="' + escHtml(it.mv_id) + '" data-creator-id="' + escHtml((it.creator && it.creator.user_id) || "") + '">',
      video
        ? '<video preload="metadata" playsinline muted loop poster="' + escHtml(poster) + '" src="' + escHtml(video) + '"></video>'
        : (poster ? '<img class="poster" src="' + escHtml(poster) + '" alt="" loading="lazy" decoding="async">' : ""),
      '<div class="scrim"></div>',
      '<div class="plaza-mute">🔇</div>',
      '<div class="plaza-overlay">',
      '  <p class="plaza-title">' + escHtml(it.title || personName || tr("Untitled", "无标题")) + '</p>',
      '  <p class="plaza-sub">' + escHtml(sub) + '</p>',
      '  <div class="plaza-tags">' + tags + '</div>',
      '</div>',
      '<div class="plaza-rail">',
      '  <button class="plaza-btn" data-act="like" aria-label="' + escHtml(likeLabel) + '">♥</button>',
      '  <span class="plaza-btn-label" data-bind="like_count">' + (Number(it.like_count) || 0) + '</span>',
      '  <button class="plaza-btn" data-act="comment" aria-label="' + escHtml(commentLabel) + '">💬</button>',
      '  <button class="plaza-btn" data-act="share" aria-label="' + escHtml(shareLabel) + '">↗</button>',
      (it.creator && it.creator.user_id ? '  <button class="plaza-btn" data-act="dm" aria-label="' + escHtml(dmLabel) + '">✉</button>' : ''),
      '</div>',
      '</div>',
    ].join("");
  }

  function renderAppend(items) {
    var feed = document.getElementById(FEED_ID);
    if (!feed) return;
    if (!feed.children.length && (!items || !items.length)) {
      feed.innerHTML = '<div class="plaza-empty">' + escHtml(tr(
        "No MVs in the plaza yet. Create one and it will appear here.",
        "广场暂无作品。创建一支 MV 即可出现在这里。"
      )) + '</div>';
      return;
    }
    var frag = document.createElement("div");
    frag.innerHTML = items.map(cardHtml).join("");
    while (frag.firstChild) {
      var card = frag.firstChild;
      feed.appendChild(card);
      observeCard(card);
      bindCardEvents(card);
    }
  }

  function bindCardEvents(card) {
    var video = card.querySelector("video");
    if (video) {
      card.addEventListener("click", function (e) {
        // Don't toggle mute when clicking rail buttons.
        if (e.target.closest(".plaza-rail")) return;
        if (video.muted) {
          video.muted = false;
          card.classList.remove("muted");
        } else {
          video.muted = true;
          card.classList.add("muted");
        }
      });
    }
    var rail = card.querySelector(".plaza-rail");
    if (!rail) return;
    rail.addEventListener("click", function (e) {
      var btn = e.target.closest(".plaza-btn");
      if (!btn) return;
      e.stopPropagation();
      var act = btn.getAttribute("data-act");
      var mvId = card.getAttribute("data-mv-id");
      if (act === "like") onLike(mvId, card, btn);
      else if (act === "comment") onComment(mvId);
      else if (act === "share") onShare(mvId);
      else if (act === "dm") onDm(card.getAttribute("data-creator-id"));
    });
  }

  function onLike(mvId, card, btn) {
    fetch("/api/person-mv/mvs/" + encodeURIComponent(mvId) + "/like", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.ok) {
          btn.classList.add("on");
          var label = card.querySelector('[data-bind="like_count"]');
          if (label && typeof j.like_count === "number") label.textContent = j.like_count;
        }
      })
      .catch(function () {});
  }

  function onComment(mvId) {
    location.hash = "#person-mv-comments/" + encodeURIComponent(mvId);
  }

  function onShare(mvId) {
    var url = location.origin + "/#person-mv-watch/" + encodeURIComponent(mvId);
    if (navigator.share) {
      navigator.share({ url: url, title: tr("CSS MV", "CSS MV") }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        try { window.cssosToast && window.cssosToast(tr("Link copied", "已复制链接")); } catch (_e) {}
      });
    }
  }

  function onDm(userId) {
    if (!userId) return;
    location.hash = "#dm/" + encodeURIComponent(userId);
  }

  function observeCard(card) {
    if (!state.io) {
      state.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var v = en.target.querySelector("video");
          if (en.isIntersecting && en.intersectionRatio > 0.6) {
            state.activeCard = en.target;
            if (v) {
              try { v.play().catch(function(){}); } catch (_e) {}
              // Wave 21 view counter — fire-and-forget.
              var mvId = en.target.getAttribute("data-mv-id");
              if (mvId && !en.target.__viewSent) {
                en.target.__viewSent = true;
                fetch("/api/person-mv/mvs/" + encodeURIComponent(mvId) + "/view", {
                  method: "POST", credentials: "same-origin",
                  headers: { "content-type": "application/json" }, body: "{}",
                }).catch(function () {});
              }
            }
            // Pre-fetch if near end.
            var feed = document.getElementById(FEED_ID);
            if (feed && feed.lastElementChild) {
              var rect = feed.lastElementChild.getBoundingClientRect();
              if (rect.top < window.innerHeight * 5) fetchPage();
            }
          } else if (v) {
            try { v.pause(); } catch (_e) {}
          }
        });
      }, { threshold: [0, 0.6, 1] });
    }
    state.io.observe(card);
  }

  function open() {
    injectStyle();
    var root = ensureRoot();
    if (root.classList.contains("open")) return;
    document.body.style.overflow = "hidden";
    root.classList.add("open");
    buildStyleOptions(state.style);
    if (!state.items.length) fetchPage();
  }

  function close() {
    var root = document.getElementById(ROOT_ID);
    if (root) root.classList.remove("open");
    document.body.style.overflow = "";
    if (location.hash.indexOf("#plaza") === 0) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (_e) {}
    }
    // Pause every video.
    if (root) {
      Array.prototype.forEach.call(root.querySelectorAll("video"), function (v) {
        try { v.pause(); } catch (_e) {}
      });
    }
  }

  function reset() {
    state.items = [];
    state.nextCursor = null;
    state.fetching = false;
    state.exhausted = false;
    state.seen = Object.create(null);
    var feed = document.getElementById(FEED_ID);
    if (feed) feed.innerHTML = "";
  }

  function applyHash() {
    var h = String(location.hash || "");
    if (h === "#plaza" || h.indexOf("#plaza/") === 0) {
      var m = h.match(/^#plaza\/style\/(.+)$/);
      var nextStyle = m && m[1] ? decodeURIComponent(m[1]) : "";
      if (nextStyle !== state.style) {
        state.style = nextStyle;
        reset();
      }
      open();
    } else {
      close();
    }
  }

  function init() {
    window.addEventListener("hashchange", applyHash);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", applyHash, { once: true });
    } else {
      applyHash();
    }
  }
  init();
})();
