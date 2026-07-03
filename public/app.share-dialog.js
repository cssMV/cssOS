/* CSSOS_PHASE_A_SHARE_DIALOG 20260506 — Jing
 *
 * Custom share modal — replaces the native navigator.share() (which
 * Jing called "太苹果"). One-click destinations:
 *   - 复制链接 (copy)
 *   - X / Twitter
 *   - 微博 (Weibo)
 *   - 小红书 (Xiaohongshu — opens compose page; clipboard fallback)
 *   - 微信 (WeChat — QR code rendered inline; user scans)
 *
 * Every link is `https://<host>/?cssMV=<id>` — opens straight into
 * cinema mode via app.share-link-router.js.
 *
 * Public API:
 *   openCssosShareDialog({ workId, title, style?, ownerName? })
 */
(function () {
  "use strict";

  function buildShareUrl(workId) {
    var origin = window.location.origin;
    return origin + "/?cssMV=" + encodeURIComponent(workId);
  }

  function buildShareText(opts) {
    /* CSSOS_SHARE_TEXT_FORMAT 20260506 — Jing
     * "长相思 · 夜雨亡国辞 — cssOS，不要；长相思 · 夜雨亡国辞 — CSS Studio要."
     * Drop the 🎬 prefix and the "CSS Studio MV" fallback so the
     * tweet/post reads exactly: <work title> — CSS Studio.
     * If somehow no title is present (defensive), still suffix CSS Studio. */
    var title = (opts && String(opts.title || "").trim()) || "";
    if (!title) return "CSS Studio";
    return title + " — CSS Studio";
  }

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("zh") === 0 && zh) return zh;
    return en;
  }

  function toast(msg) {
    if (typeof globalThis.showToast === "function") {
      try { globalThis.showToast(msg); return; } catch (_e) {}
    }
    // Fallback toast
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);" +
      "background:rgba(0,0,0,0.85);color:#fff;padding:10px 18px;" +
      "border-radius:8px;font:600 13px/1 ui-monospace,monospace;z-index:2147483646;";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  // Tiny QR encoder for WeChat — inline so we don't import a library.
  // Uses the public goQR.me API as a static-image fallback (privacy-safe:
  // only the cssMV URL itself is sent, no user data).
  function qrImageUrlFor(text, size) {
    var sz = size || 220;
    return "https://api.qrserver.com/v1/create-qr-code/?size=" + sz + "x" + sz + "&data=" + encodeURIComponent(text);
  }

  /* CSSOS_SHARE_POPUP_FOCUS 20260506 — Jing
   * Pre-share house-keeping so the popup isn't hidden behind cinema:
   *   1. Exit browser fullscreen if active (popups can't render above
   *      a fullscreened element).
   *   2. Open as a NEW TAB ("_blank") — no width/height ⇒ most browsers
   *      give a real tab next to ours, no detached popup window to be
   *      occluded.
   *   3. Listen once for visibilitychange. When the user returns to
   *      our tab (closed the share tab, or just switched back),
   *      re-enter cinema if we were in it before.
   */
  function exitFullscreenIfAny() {
    try {
      if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
        document.exitFullscreen().catch(function () {});
      } else if (document.webkitFullscreenElement && typeof document.webkitExitFullscreen === "function") {
        document.webkitExitFullscreen();
      }
    } catch (_e) {}
  }
  var __cssosCinemaWasOn = false;
  function rememberCinemaState() {
    __cssosCinemaWasOn = !!(
      document.body && document.body.classList.contains("cssos-cinema-mode")
    );
  }
  function armCinemaResume() {
    if (!__cssosCinemaWasOn) return;
    var done = false;
    var resume = function () {
      if (done) return;
      if (document.visibilityState !== "visible") return;
      done = true;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      try {
        if (typeof globalThis.cssosRequestBrowserFullscreen === "function") {
          globalThis.cssosRequestBrowserFullscreen();
        } else if (typeof globalThis.cssosEnterCinemaMode === "function") {
          globalThis.cssosEnterCinemaMode();
        }
      } catch (_e) {}
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    // Failsafe: 5 minutes of no return → drop the listener so we never
    // surprise-fullscreen on some unrelated future tab focus.
    setTimeout(function () {
      done = true;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    }, 5 * 60 * 1000);
  }
  function popup(u) {
    rememberCinemaState();
    exitFullscreenIfAny();
    var w = window.open(u, "_blank", "noopener,noreferrer");
    if (w) {
      try { w.focus(); } catch (_e) {}
    }
    armCinemaResume();
    return w;
  }
  function copyAndNudge(url, text, en, zh, openUrl) {
    copyToClipboard(text + "\n" + url).then(function () {
      toast(tt(en, zh));
    });
    if (openUrl) {
      rememberCinemaState();
      exitFullscreenIfAny();
      var w = window.open(openUrl, "_blank", "noopener,noreferrer");
      if (w) { try { w.focus(); } catch (_e) {} }
      armCinemaResume();
    }
  }

  function openTwitterShare(url, text) {
    popup("https://twitter.com/intent/tweet?text=" + encodeURIComponent(text + "\n") + "&url=" + encodeURIComponent(url));
  }
  function openFacebookShare(url) {
    popup("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url));
  }
  function openInstagramShare(url, text) {
    copyAndNudge(url, text,
      "Copied. Open Instagram → DM or Story → paste.",
      "已复制，打开 Instagram → DM/Story → 粘贴即可。");
  }
  function openWhatsAppShare(url, text) {
    popup("https://api.whatsapp.com/send?text=" + encodeURIComponent(text + " " + url));
  }
  function openTelegramShare(url, text) {
    popup("https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(text));
  }
  function openRedditShare(url, text) {
    popup("https://www.reddit.com/submit?url=" + encodeURIComponent(url) + "&title=" + encodeURIComponent(text));
  }
  function openLinkedInShare(url) {
    popup("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url));
  }
  function openEmailShare(url, text) {
    window.open("mailto:?subject=" + encodeURIComponent(text) + "&body=" + encodeURIComponent(text + "\n\n" + url), "_self");
  }
  function openBlueskyShare(url, text) {
    popup("https://bsky.app/intent/compose?text=" + encodeURIComponent(text + "\n" + url));
  }
  function openThreadsShare(url, text) {
    popup("https://threads.net/intent/post?text=" + encodeURIComponent(text + "\n" + url));
  }
  function openTruthSocialShare(url, text) {
    // Truth Social has no documented intent endpoint. Copy + nudge.
    copyAndNudge(url, text,
      "Copied. Open Truth Social → New Post → paste.",
      "已复制，打开 Truth Social → 新帖子 → 粘贴。");
    window.open("https://truthsocial.com/", "_blank", "noopener,noreferrer");
  }
  function openTikTokShare(url, text) {
    copyAndNudge(url, text,
      "Copied. Open TikTok app → caption / DM → paste.",
      "已复制，打开 TikTok → 发布/私信 → 粘贴。");
    window.open("https://www.tiktok.com/", "_blank", "noopener,noreferrer");
  }
  function openPinterestShare(url, text) {
    popup("https://pinterest.com/pin/create/button/?url=" + encodeURIComponent(url) + "&description=" + encodeURIComponent(text));
  }
  function openTumblrShare(url, text) {
    popup("https://www.tumblr.com/widgets/share/tool?canonicalUrl=" + encodeURIComponent(url) + "&caption=" + encodeURIComponent(text));
  }
  function openYouTubeShare(url, text) {
    copyAndNudge(url, text,
      "Copied. Open YouTube → community / comment → paste.",
      "已复制，打开 YouTube → 社区/评论 → 粘贴。");
    window.open("https://studio.youtube.com/", "_blank", "noopener,noreferrer");
  }
  function openDiscordShare(url, text) {
    copyAndNudge(url, text,
      "Copied. Switch to Discord → paste in any channel / DM.",
      "已复制，切到 Discord → 任意频道/私信粘贴。");
  }
  function openMastodonShare(url, text) {
    // No central instance — copy + nudge so user pastes into their server.
    copyAndNudge(url, text,
      "Copied. Open your Mastodon instance → New post → paste.",
      "已复制，打开你的 Mastodon 实例 → 新嘟文 → 粘贴。");
  }

  // Chinese platforms (rendered last per Jing 2026-05-06).
  function openWeiboShare(url, text) {
    popup("https://service.weibo.com/share/share.php?url=" + encodeURIComponent(url) + "&title=" + encodeURIComponent(text));
  }
  function openXiaohongshuShare(url, text) {
    copyAndNudge(url, text,
      "Copied. Open Xiaohongshu app → paste in a note.",
      "已复制，打开小红书 App → 新建笔记 → 粘贴即可。");
    window.open("https://www.xiaohongshu.com/", "_blank", "noopener,noreferrer");
  }
  function openDouyinShare(url, text) {
    copyAndNudge(url, text,
      "Copied. Open Douyin → caption / DM → paste.",
      "已复制，打开抖音 → 发布/私信 → 粘贴。");
    window.open("https://www.douyin.com/", "_blank", "noopener,noreferrer");
  }
  function openQQShare(url, text) {
    popup("https://connect.qq.com/widget/shareqq/index.html?url=" + encodeURIComponent(url) + "&title=" + encodeURIComponent(text));
  }

  function dismiss(root) {
    if (!root || !root.parentNode) return;
    root.style.opacity = "0";
    setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 180);
  }

  function openCssosShareDialog(opts) {
    opts = opts || {};
    var workId = opts.workId || opts.work_id || opts.id;
    // CSSOS_WAVE_118 — 支持自定义链接(数字演员分享 /a/<id> 等非作品), 传 opts.url 即用它, 不要求 workId。
    var url = opts.url ? String(opts.url) : (workId ? buildShareUrl(workId) : "");
    if (!url) {
      toast(tt("Nothing to share.", "无可分享的内容。"));
      return;
    }
    try { if (typeof globalThis.cssosCloseOtherPopups === "function") globalThis.cssosCloseOtherPopups("#cssos-share-dialog"); } catch (_e) {}   // W1158 单弹窗
    var text = buildShareText(opts);

    // Backdrop
    var root = document.createElement("div");
    root.id = "cssos-share-dialog";
    // CSSOS_WAVE_1193 — Jing: 不遮右轨 → 背景层透明(仅作点外面关闭的捕获层, 不再 dim/blur 盖住右轨)。
    root.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:block;" +
      "background:transparent;transition:opacity .18s ease;opacity:0;";
    root.addEventListener("click", function (e) {
      if (e.target === root) dismiss(root);
    });

    // Card — width hugs the share link length per Jing 2026-05-06
    // ("小窗口宽度到分享链接长度即可"). 520px fits the typical
    // https://cssstudio.app/?cssMV=<UUID> string with a small margin
    // on either side; platform row scrolls horizontally for overflow.
    var card = document.createElement("div");
    // CSSOS_WAVE_1193 — Jing: 改由 cssosAnchorPopupToRail 统一定位(顶对齐右轨、和右轨等高、不遮右轨);
    //   内容比右轨矮 → overflow-y:auto 顶对齐 + 可滚。宽度/位置交给 helper, 这里不再写死 520px 居中。
    // CSSOS_WAVE_1198 — Jing: 背景设为【透明玻璃】(不再黑底), 浮在 MV 上; 文字靠阴影保可读。
    card.style.cssText =
      "padding:18px 18px;border-radius:18px;overflow-y:auto;-webkit-overflow-scrolling:touch;" +
      "background:rgba(10,14,20,0.42);color:rgba(255,255,255,0.95);" +
      "text-shadow:0 1px 4px rgba(0,0,0,0.7);box-shadow:0 18px 60px rgba(0,0,0,0.5);" +
      "border:1px solid rgba(255,255,255,0.14);" +
      "font:14px/1.4 -apple-system,system-ui,sans-serif;" +
      "box-sizing:border-box;";

    // Header
    var hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;";
    var ttl = document.createElement("div");
    ttl.textContent = opts.headerLabel || tt("Share this MV", "分享这部 MV");
    ttl.style.cssText = "font-weight:600;font-size:15px;color:#daffee;";
    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close");
    close.style.cssText =
      "background:transparent;border:0;color:rgba(218,255,238,0.7);cursor:pointer;" +
      "font:600 22px/1 ui-monospace,monospace;padding:0 6px;";
    close.addEventListener("click", function () { dismiss(root); });
    hdr.appendChild(ttl);
    hdr.appendChild(close);
    card.appendChild(hdr);

    // Title row
    if (opts.title) {
      var sub = document.createElement("div");
      sub.textContent = opts.title;
      sub.style.cssText = "font-size:13px;color:rgba(218,255,238,0.7);margin-bottom:14px;word-break:break-word;";
      card.appendChild(sub);
    }

    // Link row
    var linkRow = document.createElement("div");
    linkRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:14px;";
    var linkInput = document.createElement("input");
    linkInput.type = "text";
    linkInput.readOnly = true;
    linkInput.value = url;
    linkInput.style.cssText =
      "flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(0,245,160,0.3);" +
      "background:rgba(0,0,0,0.3);color:#daffee;font:12px/1 ui-monospace,monospace;";
    linkInput.addEventListener("focus", function () { linkInput.select(); });
    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = tt("Copy", "复制");
    copyBtn.style.cssText =
      "padding:8px 14px;border-radius:8px;border:1px solid rgba(0,245,160,0.45);" +
      "background:rgba(0,245,160,0.18);color:#daffee;cursor:pointer;font-weight:600;";
    copyBtn.addEventListener("click", function () {
      copyToClipboard(url).then(function () {
        copyBtn.textContent = tt("Copied!", "已复制");
        setTimeout(function () { copyBtn.textContent = tt("Copy", "复制"); }, 1800);
      });
    });
    linkRow.appendChild(linkInput);
    linkRow.appendChild(copyBtn);
    card.appendChild(linkRow);

    // Note about cinema mode
    var note = document.createElement("div");
    note.textContent = tt(
      "Anyone opening this link lands straight in cinema mode.",
      "点击链接的人将直接进入影院模式。"
    );
    note.style.cssText = "font-size:11px;color:rgba(218,255,238,0.5);margin-bottom:14px;";
    card.appendChild(note);

    // Platforms — Western first (X, Facebook, Instagram, WhatsApp, Telegram,
    // Reddit, LinkedIn, Email), then CN (Weibo, Xiaohongshu, WeChat).
    // Horizontal scroll so we can keep adding without crowding the card.
    var scroller = document.createElement("div");
    scroller.style.cssText =
      "overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;" +
      "scrollbar-width:thin;scrollbar-color:rgba(0,245,160,0.4) transparent;" +
      "padding-bottom:6px;margin-bottom:6px;";
    var platforms = document.createElement("div");
    platforms.style.cssText = "display:flex;gap:8px;flex-wrap:nowrap;width:max-content;";

    function platformBtn(label, glyph, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.style.cssText =
        "display:flex;flex-direction:column;align-items:center;gap:4px;" +
        "padding:10px 8px;border-radius:10px;border:1px solid rgba(0,245,160,0.2);" +
        "background:rgba(0,0,0,0.25);color:#daffee;cursor:pointer;font-size:11px;" +
        "min-width:74px;flex:0 0 auto;";
      b.innerHTML =
        '<span style="font-size:22px;line-height:1;">' + glyph + '</span>' +
        '<span>' + label + '</span>';
      b.addEventListener("click", function () {
        try { onClick(); } catch (e) { console.warn("[share]", label, e); }
      });
      return b;
    }
    /* CSSOS_SHARE_PLATFORMS_FULL 20260506 — Jing
     * Western platforms first; CN platforms last. Login providers
     * (Apple, Google, GitHub, Facebook, Discord) appear here so the
     * share surface is at least as broad as the sign-in surface. */
    // Western — mainstream
    platforms.appendChild(platformBtn("X", "𝕏", function () { openTwitterShare(url, text); }));
    platforms.appendChild(platformBtn("Facebook", "f", function () { openFacebookShare(url); }));
    platforms.appendChild(platformBtn("Instagram", "📷", function () { openInstagramShare(url, text); }));
    platforms.appendChild(platformBtn("Threads", "@", function () { openThreadsShare(url, text); }));
    platforms.appendChild(platformBtn("Bluesky", "🦋", function () { openBlueskyShare(url, text); }));
    platforms.appendChild(platformBtn("TikTok", "🎵", function () { openTikTokShare(url, text); }));
    platforms.appendChild(platformBtn("YouTube", "▶", function () { openYouTubeShare(url, text); }));
    platforms.appendChild(platformBtn("Reddit", "🟠", function () { openRedditShare(url, text); }));
    platforms.appendChild(platformBtn("Pinterest", "📌", function () { openPinterestShare(url, text); }));
    platforms.appendChild(platformBtn("Tumblr", "T", function () { openTumblrShare(url, text); }));
    platforms.appendChild(platformBtn("LinkedIn", "in", function () { openLinkedInShare(url); }));
    platforms.appendChild(platformBtn("Mastodon", "🐘", function () { openMastodonShare(url, text); }));
    // Western — messaging
    platforms.appendChild(platformBtn("WhatsApp", "🟢", function () { openWhatsAppShare(url, text); }));
    platforms.appendChild(platformBtn("Telegram", "✈️", function () { openTelegramShare(url, text); }));
    platforms.appendChild(platformBtn("Discord", "🎮", function () { openDiscordShare(url, text); }));
    // Western — political / niche
    platforms.appendChild(platformBtn("Truth Social", "🇺🇸", function () { openTruthSocialShare(url, text); }));
    platforms.appendChild(platformBtn(tt("Email", "邮件"), "✉️", function () { openEmailShare(url, text); }));
    // Chinese — last per Jing 2026-05-06
    platforms.appendChild(platformBtn(tt("Weibo", "微博"), "🅦", function () { openWeiboShare(url, text); }));
    platforms.appendChild(platformBtn(tt("Xiaohongshu", "小红书"), "📕", function () { openXiaohongshuShare(url, text); }));
    platforms.appendChild(platformBtn(tt("Douyin", "抖音"), "🎶", function () { openDouyinShare(url, text); }));
    platforms.appendChild(platformBtn("QQ", "🐧", function () { openQQShare(url, text); }));
    platforms.appendChild(platformBtn(tt("WeChat", "微信"), "💬", function () { showWeChatQr(); }));
    scroller.appendChild(platforms);
    card.appendChild(scroller);

    // WeChat QR area (initially hidden — appended on demand)
    var wechatBox = document.createElement("div");
    wechatBox.style.cssText = "display:none;margin-top:14px;text-align:center;";
    function showWeChatQr() {
      wechatBox.innerHTML = "";
      var img = document.createElement("img");
      img.src = qrImageUrlFor(url, 220);
      img.alt = "WeChat QR";
      img.style.cssText = "width:220px;height:220px;border-radius:10px;background:#fff;padding:8px;";
      wechatBox.appendChild(img);
      var hint = document.createElement("div");
      hint.textContent = tt(
        "Open WeChat → scan to share.",
        "打开微信 → 扫一扫 → 即可分享。"
      );
      hint.style.cssText = "font-size:11px;color:rgba(218,255,238,0.65);margin-top:8px;";
      wechatBox.appendChild(hint);
      wechatBox.style.display = "block";
    }
    card.appendChild(wechatBox);

    root.appendChild(card);
    /* CSSOS_SHARE_OVER_CINEMA 20260506 — Jing
     * "在影院模式被遮住了". When the watch panel is in browser fullscreen
     * (panel.requestFullscreen()), only descendants of the fullscreen
     * element are rendered. Appending to document.body invisibly stuffs
     * the dialog behind the fullscreen surface. Mount inside the active
     * fullscreen element instead so the dialog floats above the cinema. */
    var mount = document.fullscreenElement
      || document.webkitFullscreenElement
      || document.body;
    mount.appendChild(root);
    // CSSOS_WAVE_1193 — Jing: 统一定位到右轨(顶对齐、等高、不遮右轨)。
    try { if (typeof globalThis.cssosAnchorPopupToRail === "function") globalThis.cssosAnchorPopupToRail(card, { gap: 12 }); } catch (_e) {}
    // CSSOS_WAVE_118 — Jing「分享面板和 Dock 打架, 留出话筒高度」: 分享卡底部绝不压到 Dock, 上方留一个 Dock 高度的间隙。
    try {
      var dock = document.querySelector(".dock") || document.querySelector("#dock");
      var dockTop = dock ? dock.getBoundingClientRect().top : (window.innerHeight - 92);
      var cardTop = card.getBoundingClientRect().top || 60;
      var avail = Math.max(180, dockTop - cardTop - 14);
      card.style.maxHeight = avail + "px";
    } catch (_e2) {}
    requestAnimationFrame(function () { root.style.opacity = "1"; });

    // ESC closes
    var onKey = function (e) {
      if (e.key === "Escape") { dismiss(root); document.removeEventListener("keydown", onKey); }
    };
    document.addEventListener("keydown", onKey);
  }

  globalThis.openCssosShareDialog = openCssosShareDialog;
})();
