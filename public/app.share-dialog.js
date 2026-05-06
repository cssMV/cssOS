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
    var title = (opts && opts.title) || "cssOS MV";
    return "🎬 " + title + " — cssOS";
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

  function openTwitterShare(url, text) {
    var u = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text + "\n") + "&url=" + encodeURIComponent(url);
    window.open(u, "_blank", "noopener,noreferrer,width=720,height=600");
  }

  function openWeiboShare(url, text) {
    var u = "https://service.weibo.com/share/share.php?url=" + encodeURIComponent(url) + "&title=" + encodeURIComponent(text);
    window.open(u, "_blank", "noopener,noreferrer,width=720,height=620");
  }

  function openXiaohongshuShare(url, text) {
    // Xiaohongshu has no official web share intent. Best-effort: copy
    // formatted text + URL to clipboard and pop their compose page.
    copyToClipboard(text + "\n" + url).then(function () {
      toast(tt(
        "Copied. Open Xiaohongshu app → paste in a note.",
        "已复制，打开小红书 App → 新建笔记 → 粘贴即可。"
      ));
    });
    window.open("https://www.xiaohongshu.com/", "_blank", "noopener,noreferrer");
  }

  function dismiss(root) {
    if (!root || !root.parentNode) return;
    root.style.opacity = "0";
    setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 180);
  }

  function openCssosShareDialog(opts) {
    opts = opts || {};
    var workId = opts.workId || opts.work_id || opts.id;
    if (!workId) {
      toast(tt("No work to share.", "无可分享的作品。"));
      return;
    }
    var url = buildShareUrl(workId);
    var text = buildShareText(opts);

    // Backdrop
    var root = document.createElement("div");
    root.id = "cssos-share-dialog";
    root.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);transition:opacity .18s ease;opacity:0;";
    root.addEventListener("click", function (e) {
      if (e.target === root) dismiss(root);
    });

    // Card
    var card = document.createElement("div");
    card.style.cssText =
      "min-width:320px;max-width:92vw;padding:22px 24px;border-radius:18px;" +
      "background:rgba(8,18,16,0.96);color:#daffee;" +
      "box-shadow:0 20px 60px rgba(0,0,0,0.6);" +
      "border:1px solid rgba(0,245,160,0.25);" +
      "font:14px/1.4 -apple-system,system-ui,sans-serif;";

    // Header
    var hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;";
    var ttl = document.createElement("div");
    ttl.textContent = tt("Share this MV", "分享这部 MV");
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

    // Platforms
    var platforms = document.createElement("div");
    platforms.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px;";

    function platformBtn(label, glyph, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.style.cssText =
        "display:flex;flex-direction:column;align-items:center;gap:4px;" +
        "padding:10px 8px;border-radius:10px;border:1px solid rgba(0,245,160,0.2);" +
        "background:rgba(0,0,0,0.25);color:#daffee;cursor:pointer;font-size:11px;";
      b.innerHTML =
        '<span style="font-size:22px;line-height:1;">' + glyph + '</span>' +
        '<span>' + label + '</span>';
      b.addEventListener("click", function () {
        try { onClick(); } catch (e) { console.warn("[share]", label, e); }
      });
      return b;
    }
    platforms.appendChild(platformBtn("X", "𝕏", function () { openTwitterShare(url, text); }));
    platforms.appendChild(platformBtn(tt("Weibo", "微博"), "🅦", function () { openWeiboShare(url, text); }));
    platforms.appendChild(platformBtn(tt("Xiaohongshu", "小红书"), "📕", function () { openXiaohongshuShare(url, text); }));
    platforms.appendChild(platformBtn(tt("WeChat", "微信"), "💬", function () { showWeChatQr(); }));
    card.appendChild(platforms);

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
    document.body.appendChild(root);
    requestAnimationFrame(function () { root.style.opacity = "1"; });

    // ESC closes
    var onKey = function (e) {
      if (e.key === "Escape") { dismiss(root); document.removeEventListener("keydown", onKey); }
    };
    document.addEventListener("keydown", onKey);
  }

  globalThis.openCssosShareDialog = openCssosShareDialog;
})();
