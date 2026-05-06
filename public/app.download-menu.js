/* CSSOS_PHASE_B_DOWNLOAD_MENU 20260506 — Jing
 *
 * Tier-aware download menu for the MV panel:
 *   - 📄 MP3   — anyone with full_access (free work, owner, purchaser)
 *   - 🎵 WAV   — Pro+ only, 24h-temp ticket
 *   - 🎬 MP4   — Pro+ only, 24h-temp ticket
 *
 * Reads tier flags from cssmvPipelineLastResult / share-link-router
 * payload. If the user lacks a tier for WAV/MP4, the row is dimmed and
 * shows "Pro+ only · 24h temp".
 *
 * Public API:
 *   openCssosDownloadMenu({ workId, mvUrl?, audioUrl?, tier? })
 *     workId  — UUID for the work
 *     mvUrl   — MP4 URL (optional; falls back to /api/works/<id>/download/mp4)
 *     audioUrl — MP3 URL (optional; falls back to /api/works/<id>/download/mp3)
 *     tier    — viewer access tier, defaults to globalThis.getAccessTier()
 *
 * The endpoint contract for the temp-ticket WAV/MP4 (Phase C) is:
 *   POST /api/works/<id>/download/<format>
 *     200 → { ok:true, url, expires_in }   (24h presigned)
 *     401 → { ok:false, code:"AUTH_REQUIRED" }
 *     402 → { ok:false, code:"TIER_REQUIRED", required:"pro" }
 *     404 → { ok:false, code:"NOT_AVAILABLE" }
 *
 * Phase A scope: render the menu, gate by tier, hit the existing
 * download URLs the work payload supplies. Phase C will wire the real
 * /api/works/<id>/download/<fmt> endpoint with signed-ticket bodies.
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

  function toast(msg) {
    if (typeof globalThis.showToast === "function") {
      try { globalThis.showToast(msg); return; } catch (_e) {}
    }
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);" +
      "background:rgba(0,0,0,0.85);color:#fff;padding:10px 18px;" +
      "border-radius:8px;font:600 13px/1 ui-monospace,monospace;z-index:2147483646;";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2400);
  }

  function readViewerTier() {
    if (typeof globalThis.getAccessTier === "function") {
      try { return String(globalThis.getAccessTier() || "guest").toLowerCase(); } catch (_e) {}
    }
    var u = globalThis.authState && globalThis.authState.user;
    return String((u && (u.tier || u.access_tier)) || "guest").toLowerCase();
  }

  function isProPlus(tier) {
    return ["pro", "studio", "enterprise", "vip", "admin"].indexOf(tier) >= 0;
  }
  function hasFullAccess(tier) {
    return tier !== "guest";
  }

  function dismiss(root) {
    if (!root || !root.parentNode) return;
    root.style.opacity = "0";
    setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 180);
  }

  function startDownload(url, fileName) {
    if (!url) return;
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName || "";
    a.rel = "noopener";
    // Browsers respect the download attribute only for same-origin URLs.
    // For cross-origin (CDN) URLs, the browser will navigate; we open
    // in a new tab so the cinema page isn't lost.
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 200);
  }

  async function fetchSignedDownloadUrl(workId, format) {
    try {
      var res = await fetch("/api/works/" + encodeURIComponent(workId) + "/download/" + format, {
        method: "POST",
        credentials: "include",
        headers: { "Accept": "application/json" }
      });
      var payload = await res.json().catch(function () { return null; });
      if (!res.ok || !payload || !payload.ok) {
        var code = (payload && payload.code) || ("HTTP_" + res.status);
        if (code === "AUTH_REQUIRED") {
          toast(tt("Sign in to download.", "请登录后下载。"));
        } else if (code === "TIER_REQUIRED") {
          toast(tt("Pro+ only · 24h temp file.", "仅 Pro+ 会员可下载，24h 临时文件。"));
        } else if (code === "NOT_AVAILABLE") {
          toast(tt("Not available for this work.", "此作品暂不支持该格式。"));
        } else {
          toast(tt("Download failed.", "下载失败。"));
        }
        return null;
      }
      return payload.url || null;
    } catch (err) {
      console.warn("[download-menu] fetchSignedDownloadUrl", err);
      toast(tt("Download failed.", "下载失败。"));
      return null;
    }
  }

  async function downloadFormat(workId, format, directUrl, fileName) {
    // Prefer the signed-ticket endpoint (Phase C will enforce 24h).
    // If it 404s (Phase A — endpoint not deployed yet), fall back to
    // the direct URL we already have on the work payload.
    var url = await fetchSignedDownloadUrl(workId, format);
    if (!url && directUrl) url = directUrl;
    if (!url) {
      toast(tt("Not available for this work.", "此作品暂不支持该格式。"));
      return;
    }
    startDownload(url, fileName);
  }

  function openCssosDownloadMenu(opts) {
    opts = opts || {};
    var workId = opts.workId || opts.id || opts.work_id;
    if (!workId) {
      toast(tt("No work to download.", "无可下载的作品。"));
      return;
    }
    var tier = String(opts.tier || readViewerTier()).toLowerCase();
    var fullAccess = !!opts.fullAccess || hasFullAccess(tier);
    var canMp3 = opts.canMp3 != null ? !!opts.canMp3 : fullAccess;
    var canWav = opts.canWav != null ? !!opts.canWav : (fullAccess && isProPlus(tier));
    var canMp4 = opts.canMp4 != null ? !!opts.canMp4 : (fullAccess && isProPlus(tier));
    var titleHint = String(opts.title || workId).slice(0, 80);

    var root = document.createElement("div");
    root.id = "cssos-download-menu";
    root.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);transition:opacity .18s ease;opacity:0;";
    root.addEventListener("click", function (e) {
      if (e.target === root) dismiss(root);
    });

    var card = document.createElement("div");
    card.style.cssText =
      "width:380px;max-width:92vw;padding:22px 24px;border-radius:18px;" +
      "background:rgba(8,18,16,0.96);color:#daffee;" +
      "box-shadow:0 20px 60px rgba(0,0,0,0.6);" +
      "border:1px solid rgba(0,245,160,0.25);" +
      "font:14px/1.4 -apple-system,system-ui,sans-serif;" +
      "box-sizing:border-box;";

    var hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;";
    var ttl = document.createElement("div");
    ttl.textContent = tt("Download", "下载");
    ttl.style.cssText = "font-weight:600;font-size:15px;";
    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close");
    close.style.cssText =
      "background:transparent;border:0;color:rgba(218,255,238,0.7);cursor:pointer;" +
      "font:600 22px/1 ui-monospace,monospace;padding:0 6px;";
    close.addEventListener("click", function () { dismiss(root); });
    hdr.appendChild(ttl); hdr.appendChild(close);
    card.appendChild(hdr);

    if (titleHint) {
      var sub = document.createElement("div");
      sub.textContent = titleHint;
      sub.style.cssText = "font-size:12px;color:rgba(218,255,238,0.6);margin-bottom:14px;word-break:break-word;";
      card.appendChild(sub);
    }

    function formatRow(formatLabel, glyph, sizeHint, available, gateLabel, onClick) {
      var row = document.createElement("button");
      row.type = "button";
      row.disabled = !available;
      row.style.cssText =
        "display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;margin-bottom:10px;" +
        "border-radius:12px;border:1px solid rgba(0,245,160,0.2);" +
        "background:" + (available ? "rgba(0,245,160,0.08)" : "rgba(0,0,0,0.18)") + ";" +
        "color:" + (available ? "#daffee" : "rgba(218,255,238,0.45)") + ";" +
        "cursor:" + (available ? "pointer" : "not-allowed") + ";" +
        "text-align:left;font:500 13px/1.3 -apple-system,system-ui,sans-serif;";
      row.innerHTML =
        '<span style="font-size:24px;line-height:1;flex:0 0 auto;">' + glyph + '</span>' +
        '<span style="flex:1;display:flex;flex-direction:column;gap:2px;">' +
          '<span style="font-weight:600;font-size:14px;color:inherit;">' + formatLabel + '</span>' +
          '<span style="font-size:11px;color:rgba(218,255,238,0.55);">' + (gateLabel || sizeHint || "") + '</span>' +
        '</span>' +
        (available
          ? '<span style="font-size:13px;color:rgba(0,245,160,0.85);flex:0 0 auto;">↓</span>'
          : '<span style="font-size:11px;color:rgba(218,255,238,0.4);flex:0 0 auto;">🔒</span>');
      if (available) {
        row.addEventListener("click", function () {
          dismiss(root);
          try { onClick(); } catch (e) { console.warn("[download]", formatLabel, e); }
        });
      } else {
        row.addEventListener("click", function () {
          if (gateLabel) toast(gateLabel);
        });
      }
      return row;
    }

    var safeName = (titleHint || workId).replace(/[^A-Za-z0-9_一-龥\- ]/g, "_").slice(0, 60);

    card.appendChild(formatRow(
      "MP3",
      "📄",
      tt("Audio · default format", "音频 · 默认格式"),
      canMp3,
      canMp3 ? null : tt("Sign in to download MP3.", "请登录后下载 MP3。"),
      function () { downloadFormat(workId, "mp3", opts.audioUrl, safeName + ".mp3"); }
    ));
    card.appendChild(formatRow(
      "WAV",
      "🎵",
      tt("Lossless audio · Pro+ · 24h temp", "无损音频 · Pro+ · 24h 临时"),
      canWav,
      canWav ? null : tt("Pro+ only · 24h temp file.", "仅 Pro+ 会员，24h 临时文件。"),
      function () { downloadFormat(workId, "wav", null, safeName + ".wav"); }
    ));
    card.appendChild(formatRow(
      "MP4",
      "🎬",
      tt("Video · Pro+ · 24h temp", "视频 · Pro+ · 24h 临时"),
      canMp4,
      canMp4 ? null : tt("Pro+ only · 24h temp file.", "仅 Pro+ 会员，24h 临时文件。"),
      function () { downloadFormat(workId, "mp4", opts.mvUrl, safeName + ".mp4"); }
    ));

    if (!fullAccess) {
      var nudge = document.createElement("div");
      nudge.style.cssText = "margin-top:8px;padding:10px 12px;border-radius:10px;" +
        "background:rgba(0,245,160,0.08);font-size:12px;color:rgba(218,255,238,0.85);";
      nudge.textContent = tt(
        "Sign in / subscribe to unlock downloads.",
        "登录或订阅后即可下载。"
      );
      card.appendChild(nudge);
    } else if (!isProPlus(tier)) {
      var upgrade = document.createElement("div");
      upgrade.style.cssText = "margin-top:8px;padding:10px 12px;border-radius:10px;" +
        "background:rgba(0,245,160,0.08);font-size:12px;color:rgba(218,255,238,0.85);";
      upgrade.textContent = tt(
        "Upgrade to Pro+ for WAV / MP4 downloads (24h temporary files).",
        "升级 Pro+ 解锁 WAV / MP4（24h 临时文件）。"
      );
      card.appendChild(upgrade);
    }

    root.appendChild(card);
    var mount = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    mount.appendChild(root);
    requestAnimationFrame(function () { root.style.opacity = "1"; });

    var onKey = function (e) {
      if (e.key === "Escape") { dismiss(root); document.removeEventListener("keydown", onKey); }
    };
    document.addEventListener("keydown", onKey);
  }

  globalThis.openCssosDownloadMenu = openCssosDownloadMenu;
})();
