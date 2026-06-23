/* CSSOS_WAVE_1115 20260622 — 影院左下【标题摘要】+【弹幕(评论)】。
 *  · 标题摘要(#cssos-watch-caption): 在底部胶囊行【上方一行】, 左下角。
 *      标题 · 多部进度徽章(2/3) · @作者·类型·时长 · 一句摘要(TikTok caption)。
 *  · 弹幕(#cssos-watch-danmu): 左下角【窄道】, 评论【弹入(爆)→上飘→淡出】, 小字半透明,
 *      只占左下 ~35% 宽, 绝不进中央 —— 不与情绪字幕(中央/四边爆字)抢戏。Jing: 先试是否抢戏。
 *  只在 watch 打开时显; 跟 cssos:work-id-changed 刷新。 */
(function () {
  "use strict";
  if (globalThis.__cssosCinemaCaptionWired) return;
  globalThis.__cssosCinemaCaptionWired = true;

  function copy(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    var zhLoc = false; try { zhLoc = String(document.documentElement.lang || "").slice(0, 2) === "zh"; } catch (_e) {}
    return zhLoc ? zh : en;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function host() { return document.getElementById("watch-panel"); }
  function watchOpen() {
    var p = host(); if (!p) return false;
    if (p.hidden || p.classList.contains("hidden")) return false;
    try { var cs = getComputedStyle(p); return cs.display !== "none" && cs.visibility !== "hidden"; } catch (_e) { return true; }
  }
  function currentWork() {
    try {
      return (globalThis.currentStructuredWatchQueue && globalThis.currentStructuredWatchQueue.items && globalThis.currentStructuredWatchQueue.items[0])
        || (globalThis.__cssosWatchQueue && globalThis.__cssosWatchQueue.items && globalThis.__cssosWatchQueue.items[0])
        || globalThis.currentWatchPreviewWork || null;
    } catch (_e) { return null; }
  }
  function workId() { var w = currentWork(); return w ? String(w.id || w.work_id || "").trim() : ""; }
  function fmtDur(s) { s = Number(s) || 0; if (!s) return ""; return "♪ " + Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

  function injectCss() {
    if (document.getElementById("cssos-cinema-caption-css")) return;
    var s = document.createElement("style"); s.id = "cssos-cinema-caption-css";
    s.textContent =
      "#cssos-watch-caption{position:absolute;left:14px;bottom:58px;max-width:min(46vw,440px);z-index:22;" +
      "pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,0.7);}" +
      "#cssos-watch-caption .cwc-title{font:600 15px/1.25 -apple-system,system-ui,sans-serif;color:#fff;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#cssos-watch-caption .cwc-badge{display:inline-block;font:600 10px/1 -apple-system,system-ui;color:#04241a;" +
      "background:#00f5a0;border-radius:5px;padding:2px 6px;margin-left:6px;vertical-align:1px;}" +
      "#cssos-watch-caption .cwc-meta{font:500 11.5px/1.3 -apple-system,system-ui;color:#c7bdb1;margin-top:2px;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#cssos-watch-caption .cwc-sum{font:500 11.5px/1.35 -apple-system,system-ui;color:#ddd4c8;margin-top:1px;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      // 弹幕窄道: 左下, caption 上方; 子弹幕弹入→上飘→淡出。
      "#cssos-watch-danmu{position:absolute;left:14px;bottom:120px;width:min(36vw,360px);height:260px;z-index:21;" +
      "pointer-events:none;overflow:hidden;}" +
      ".cwd-item{position:absolute;left:0;bottom:0;max-width:100%;background:rgba(0,0,0,0.42);border-radius:999px;" +
      "padding:4px 11px;font:500 12px/1.4 -apple-system,system-ui;color:#fff;white-space:nowrap;overflow:hidden;" +
      "text-overflow:ellipsis;opacity:0;transform:translateY(0) scale(0.6);" +
      "animation:cwd-pop 0.34s cubic-bezier(.2,1.5,.3,1) forwards, cwd-float 6.4s linear 0.34s forwards;}" +
      ".cwd-item b{color:#9effa0;font-weight:500;margin-right:5px;}" +
      // CSSOS_WAVE_1124 — Jing 指令③: 弹幕加随机 emoji 背景(∝评论长短)+ 从它字心爆小 emoji(仿情绪字幕)。
      ".cwd-em{margin-right:5px;vertical-align:-2px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));}" +
      "@keyframes cwd-pop{0%{opacity:0;transform:translateY(0) scale(0.6);}100%{opacity:0.92;transform:translateY(0) scale(1);}}" +
      "@keyframes cwd-float{0%{opacity:0.92;}70%{opacity:0.8;}100%{opacity:0;transform:translateY(-230px) scale(1);}}";
    document.head.appendChild(s);
  }

  // ── 标题摘要 ──
  function renderCaption() {
    var h = host(); if (!h) return;
    var cap = document.getElementById("cssos-watch-caption");
    if (!watchOpen()) { if (cap) cap.style.display = "none"; return; }
    if (!cap) {
      cap = document.createElement("div"); cap.id = "cssos-watch-caption"; cap.dataset.noFrameToggle = "1";
      if (getComputedStyle(h).position === "static") h.style.position = "relative";
      h.appendChild(cap);
    }
    cap.style.display = "block";
    var w = currentWork() || {};
    var title = String(w.title || w.name || "").trim();
    if (!title) { cap.style.display = "none"; return; }
    var pIdx = Number(w._part_index || w.part_index || 0), pTot = Number(w._part_total || w.part_total || 0);
    var badge = (pTot > 1 && pIdx > 0) ? '<span class="cwc-badge">' + pIdx + "/" + pTot + "</span>" : "";
    var who = String(w.owner_display_name || w.owner_handle || "").trim();
    var metaBits = [];
    if (who) metaBits.push("@" + who);
    var typ = String(w._root_work_type || w.work_type || w.style || "").trim();
    if (typ) metaBits.push(typ);
    var dur = fmtDur(w.duration_secs || w.duration);
    if (dur) metaBits.push(dur);
    var summary = String(w.summary || w.description || w.lyrics_preview || "").replace(/\s+/g, " ").trim();
    cap.innerHTML =
      '<div class="cwc-title">' + esc(title) + badge + "</div>" +
      (metaBits.length ? '<div class="cwc-meta">' + esc(metaBits.join(" · ")) + "</div>" : "") +
      (summary ? '<div class="cwc-sum">' + esc(summary.slice(0, 60)) + "</div>" : "");
  }

  // ── 弹幕(评论) ──
  var _danmuCache = {};   // workId → [{name, body}]
  var _danmuTimer = null, _danmuIdx = 0, _danmuWorkId = "";
  // CSSOS_WAVE_1124 — 弹幕 emoji 背景默认池(无 theme_emoji 时用)。
  var DANMU_EMOJI = ["💬", "✨", "🌟", "💖", "🔥", "🎵", "🌸", "💫", "👏", "🎉", "😍", "🥹"];
  function fetchDanmu(id) {
    if (!id || _danmuCache[id]) return;
    _danmuCache[id] = [];
    try {
      fetch("/api/person-mv/mvs/" + encodeURIComponent(id) + "/comments?limit=40", { credentials: "include" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          var arr = Array.isArray(d) ? d : (d && (d.data || d.comments)) || [];
          _danmuCache[id] = arr.filter(function (c) { return c && !c.deleted && !c.deleted_at; })
            .map(function (c) {
              var body = String(c.body || c.body_text || "").trim();
              if (!body) { try { body = String(c.body_html || "").replace(/<[^>]*>/g, "").trim(); } catch (_e) {} }
              return { name: String(c.display_name || c.username || "").trim(), body: body };
            }).filter(function (c) { return c.body; });
        }).catch(function () {});
    } catch (_e) {}
  }
  function spawnDanmu() {
    if (!watchOpen()) return;
    var lane = document.getElementById("cssos-watch-danmu"); if (!lane) return;
    var list = _danmuCache[_danmuWorkId] || [];
    if (!list.length) return;
    var c = list[_danmuIdx % list.length]; _danmuIdx++;
    var bodyTxt = c.body.slice(0, 48);
    var len = bodyTxt.length;
    // CSSOS_WAVE_1124 — Jing 指令③: 按评论长短选随机 emoji 背景(越长越大)+ 从它字心爆小 emoji(仿情绪字幕)。
    var pool = (globalThis.cssosWorkThemeEmoji && globalThis.cssosWorkThemeEmoji.length)
      ? globalThis.cssosWorkThemeEmoji : DANMU_EMOJI;
    var bemo = pool[(Math.random() * pool.length) | 0];
    var emSize = (1.3 + Math.min(1.8, len / 14)).toFixed(2);   // 1.3–3.1em ∝ 评论长度
    var el = document.createElement("div"); el.className = "cwd-item";
    el.innerHTML = '<span class="cwd-em" style="font-size:' + emSize + 'em;">' + esc(bemo) + "</span>"
      + (c.name ? "<b>" + esc(c.name) + "</b>" : "") + esc(bodyTxt);
    lane.appendChild(el);
    // 从弹幕处字心爆小 emoji, 数量 ∝ 评论长度(短 4 颗 → 长 16 颗)。位置取弹幕轨左下区。
    try {
      if (typeof globalThis.cssosFireworkAt === "function") {
        var lr = lane.getBoundingClientRect();
        var xPct = (lr.left + lr.width * (0.15 + Math.random() * 0.4)) / (window.innerWidth || 1) * 100;
        var yPct = (lr.bottom - 24 - Math.random() * 40) / (window.innerHeight || 1) * 100;
        globalThis.cssosFireworkAt(xPct, yPct, "joy", Math.max(4, Math.min(16, Math.round(len / 3))));
      }
    } catch (_e) {}
    setTimeout(function () { try { el.remove(); } catch (_e) {} }, 7200);
  }
  function ensureDanmuLane() {
    var h = host(); if (!h) return;
    var lane = document.getElementById("cssos-watch-danmu");
    if (!watchOpen()) { if (lane) lane.style.display = "none"; if (_danmuTimer) { clearInterval(_danmuTimer); _danmuTimer = null; } return; }
    if (!lane) { lane = document.createElement("div"); lane.id = "cssos-watch-danmu"; lane.dataset.noFrameToggle = "1"; h.appendChild(lane); }
    lane.style.display = "block";
    var id = workId();
    if (id && id !== _danmuWorkId) { _danmuWorkId = id; _danmuIdx = 0; lane.textContent = ""; fetchDanmu(id); }
    if (!_danmuTimer) _danmuTimer = setInterval(spawnDanmu, 3400);   // 每 ~3.4s 弹一条
  }

  var raf = false;
  function schedule() { if (raf) return; raf = true; requestAnimationFrame(function () { raf = false; try { injectCss(); renderCaption(); ensureDanmuLane(); } catch (e) { console.warn("[cinema-caption]", e); } }); }
  globalThis.cssosRenderCinemaCaption = schedule;

  function start() {
    schedule();
    setInterval(schedule, 2500);
    ["cssos:work-changed", "cssos:work-id-changed", "cssos:playlist-advance",
     "cssos:open-watch-for-run", "cssos:cinema-toggle", "fullscreenchange"].forEach(function (ev) {
      document.addEventListener(ev, schedule); window.addEventListener(ev, schedule);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
