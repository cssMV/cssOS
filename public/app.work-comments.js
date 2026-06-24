/* CSSOS_WAVE_1138 20260623 — Jing 指令: 通用作品评论(影院 user_works 可评论)。
 *   · 文字评论 + 回复(parent_id) + 作者/作品作者可删。
 *   · 富内容 = 【安全结构化嵌入】一首作品(封面/标题/▶链接), 不开放裸 HTML(防 XSS)。
 *   入口: globalThis.cssosOpenWorkComments(workId)。后端: /api/works/:id/comments (GET/POST/DELETE)。 */
(function () {
  "use strict";
  if (globalThis.__cssosWorkCommentsWired) return;
  globalThis.__cssosWorkCommentsWired = true;

  function tr(en, zh) {
    try { if (typeof globalThis.loginCopy === "function") return globalThis.loginCopy(en, zh); } catch (_e) {}
    var zhLoc = false; try { zhLoc = String(document.documentElement.lang || "").slice(0, 2) === "zh"; } catch (_e) {}
    return zhLoc ? zh : en;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]; }); }
  // CSSOS_WAVE_1150 — Jing 铁律: 有作品/卡片处必显时长。♪ m:ss。
  function fmtDur(s) { s = Math.round(Number(s) || 0); if (s <= 0) return ""; return "♪ " + Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function toast(m) { try { if (typeof globalThis.showToast === "function") globalThis.showToast(m); } catch (_e) {} }
  // CSSOS_WAVE_1144 — Jing 指令: 评论增删后通知右轨立即刷新计数(同步显示)。
  function notifyChanged() { try { document.dispatchEvent(new CustomEvent("cssos:comments-changed", { detail: { workId: currentWorkId } })); } catch (_e) {} }

  function injectCss() {
    if (document.getElementById("cssos-work-comments-css")) return;
    var s = document.createElement("style"); s.id = "cssos-work-comments-css";
    s.textContent =
      // CSSOS_WAVE_1144/1146 — Jing 指令: 评论窗【依附右轨】右侧停靠; 顶部不高于右轨(JS 设 top 对齐右轨顶)。
      "#cssos-work-comments{position:fixed;inset:0;z-index:10058;display:flex;align-items:flex-start;justify-content:flex-end;" +
      "background:rgba(0,0,0,0.32);backdrop-filter:blur(3px);font:500 14px/1.45 -apple-system,system-ui,sans-serif;}" +
      "#cssos-work-comments .cwc-sheet{width:min(400px,84vw);max-height:78vh;margin:0 76px 0 0;display:flex;flex-direction:column;" +   /* margin-right 76px 让出右轨图标; top 由 JS 对齐右轨 */
      "background:rgba(15,18,24,0.99);border:1px solid rgba(255,255,255,0.12);border-radius:18px;" +
      "box-shadow:0 18px 60px rgba(0,0,0,0.6);color:rgba(255,255,255,0.95);}" +
      "@media (max-width:560px){#cssos-work-comments{align-items:flex-end;justify-content:center;}" +
      "#cssos-work-comments .cwc-sheet{width:100%;margin:0;border-radius:18px 18px 0 0;}}" +   /* 窄屏回退底部 */
      "#cssos-work-comments .cwc-head{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);}" +
      "#cssos-work-comments .cwc-head b{flex:1;font-size:15px;}" +
      "#cssos-work-comments .cwc-x{background:transparent;border:0;color:#fff;font-size:20px;cursor:pointer;width:32px;height:32px;border-radius:50%;}" +
      "#cssos-work-comments .cwc-list{flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:12px;min-height:120px;}" +
      "#cssos-work-comments .cwc-item{display:flex;gap:10px;}" +
      "#cssos-work-comments .cwc-item.is-reply{margin-left:38px;}" +
      "#cssos-work-comments .cwc-av{width:32px;height:32px;border-radius:50%;object-fit:cover;flex:0 0 auto;background:#2a6cf0;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;overflow:hidden;}" +
      "#cssos-work-comments .cwc-av img{width:100%;height:100%;object-fit:cover;}" +
      "#cssos-work-comments .cwc-name{font-weight:600;font-size:12.5px;color:#dfe7ff;}" +
      "#cssos-work-comments .cwc-text{font-size:13.5px;color:#eee;margin-top:1px;word-break:break-word;white-space:pre-wrap;}" +
      "#cssos-work-comments .cwc-text.is-deleted{opacity:0.5;font-style:italic;}" +
      "#cssos-work-comments .cwc-embed{margin-top:6px;display:flex;align-items:center;gap:9px;background:rgba(255,255,255,0.05);" +
      "border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:7px;cursor:pointer;max-width:300px;}" +
      "#cssos-work-comments .cwc-embed img,#cssos-work-comments .cwc-embed .cwc-embed-ph{width:42px;height:42px;border-radius:7px;object-fit:cover;flex:0 0 auto;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;}" +
      "#cssos-work-comments .cwc-embed .cwc-embed-t{flex:1;min-width:0;font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      "#cssos-work-comments .cwc-embed .cwc-embed-play{color:#00f5a0;font-size:16px;}" +
      "#cssos-work-comments .cwc-actions{margin-top:3px;display:flex;gap:14px;}" +
      "#cssos-work-comments .cwc-actions button{background:transparent;border:0;color:#9aa3b2;font-size:11.5px;cursor:pointer;padding:0;}" +
      "#cssos-work-comments .cwc-actions button:hover{color:#fff;}" +
      "#cssos-work-comments .cwc-foot{border-top:1px solid rgba(255,255,255,0.08);padding:10px 14px;display:flex;flex-direction:column;gap:8px;}" +
      "#cssos-work-comments .cwc-replychip,#cssos-work-comments .cwc-embedchip{display:none;align-items:center;gap:6px;font-size:11.5px;color:#bcd;background:rgba(0,245,160,0.1);border:1px solid rgba(0,245,160,0.3);border-radius:999px;padding:3px 10px;align-self:flex-start;}" +
      "#cssos-work-comments .cwc-replychip button,#cssos-work-comments .cwc-embedchip button{background:transparent;border:0;color:#9aa3b2;cursor:pointer;font-size:13px;}" +
      "#cssos-work-comments .cwc-composer{display:flex;gap:8px;align-items:flex-end;}" +
      // CSSOS_WAVE_1146 — Jing 指令: 输入框默认一行, 随内容增高(box-sizing+1行基准高, 配合 input 自增)。
      "#cssos-work-comments textarea{flex:1;resize:none;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.16);border-radius:10px;padding:9px 11px;color:#fff;font:inherit;height:38px;min-height:38px;max-height:120px;overflow-y:auto;line-height:1.35;}" +
      "#cssos-work-comments .cwc-attach{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16);color:#fff;border-radius:10px;padding:9px 11px;cursor:pointer;font-size:16px;flex:0 0 auto;}" +
      "#cssos-work-comments .cwc-post{background:rgba(0,245,160,0.22);border:1px solid rgba(0,245,160,0.6);color:#fff;border-radius:10px;padding:9px 14px;cursor:pointer;font-weight:700;flex:0 0 auto;}" +
      "#cssos-work-comments .cwc-empty{opacity:0.55;text-align:center;font-size:12.5px;padding:26px 0;}";
    document.head.appendChild(s);
  }

  var currentWorkId = "", currentReplyTo = null, embedWorkId = "", embedWorkTitle = "";

  function avatarNode(name, url) {
    var av = document.createElement("div"); av.className = "cwc-av";
    if (url) { var im = document.createElement("img"); im.src = url; im.alt = ""; av.appendChild(im); }
    else av.textContent = (String(name || "?").trim().charAt(0) || "?").toUpperCase();
    return av;
  }

  function playEmbed(workId) {
    try {
      if (typeof globalThis.openMarketWorkPreview === "function") { globalThis.openMarketWorkPreview(workId); return; }
      if (typeof globalThis.cssosOpenAssistantWithPrompt === "function") return;
    } catch (_e) {}
  }

  async function refresh() {
    var listEl = document.querySelector("#cssos-work-comments .cwc-list");
    if (!listEl) return;
    try {
      var r = await fetch("/api/works/" + encodeURIComponent(currentWorkId) + "/comments?limit=200", { credentials: "include" });
      var j = await r.json().catch(function () { return null; });
      var items = (j && j.items) || [];
      listEl.innerHTML = "";
      if (!items.length) {
        var em = document.createElement("div"); em.className = "cwc-empty";
        em.textContent = tr("No comments yet — be the first.", "还没有评论 — 来抢沙发。");
        listEl.appendChild(em);
        return;
      }
      items.forEach(function (c) {
        var item = document.createElement("div");
        item.className = "cwc-item" + (c.parent_id ? " is-reply" : "");
        item.appendChild(avatarNode(c.display_name || c.username, c.avatar_url));
        var main = document.createElement("div"); main.style.flex = "1"; main.style.minWidth = "0";
        var nm = document.createElement("div"); nm.className = "cwc-name";
        nm.textContent = c.display_name || c.username || tr("User", "用户");
        main.appendChild(nm);
        var tx = document.createElement("div"); tx.className = "cwc-text" + (c.deleted ? " is-deleted" : "");
        if (c.deleted) tx.textContent = tr("[deleted]", "[已删除]");
        else tx.innerHTML = c.body_html || "";   // body_html 后端已转义, 安全
        main.appendChild(tx);
        if (c.embed && c.embed.work_id) {
          var emb = document.createElement("div"); emb.className = "cwc-embed";
          var edur = fmtDur(c.embed.duration_secs);
          emb.innerHTML =
            (c.embed.cover ? '<img src="' + esc(c.embed.cover) + '" alt="">' : '<span class="cwc-embed-ph">🎵</span>') +
            '<span class="cwc-embed-t">' + esc(c.embed.title || tr("A work", "一首作品")) +
              (edur ? '<span style="display:block;font-weight:500;font-size:10.5px;color:#9aa3b2;">' + esc(edur) + "</span>" : "") +
            "</span>" +
            '<span class="cwc-embed-play">▶</span>';
          emb.addEventListener("click", function () { playEmbed(c.embed.work_id); });
          main.appendChild(emb);
        }
        var acts = document.createElement("div"); acts.className = "cwc-actions";
        if (!c.deleted) {
          var rep = document.createElement("button"); rep.textContent = tr("Reply", "回复");
          rep.addEventListener("click", function () { setReplyTo(c.id, c.display_name || c.username); });
          acts.appendChild(rep);
        }
        if (c.can_delete && !c.deleted) {
          var del = document.createElement("button"); del.textContent = tr("Delete", "删除");
          del.addEventListener("click", async function () {
            try {
              var dr = await fetch("/api/works/" + encodeURIComponent(currentWorkId) + "/comments/" + encodeURIComponent(c.id), { method: "DELETE", credentials: "include" });
              if (dr.ok) { await refresh(); notifyChanged(); } else toast(tr("Delete failed", "删除失败"));
            } catch (_e) { toast(tr("Delete failed", "删除失败")); }
          });
          acts.appendChild(del);
        }
        main.appendChild(acts);
        item.appendChild(main);
        listEl.appendChild(item);
      });
    } catch (_e) {
      listEl.innerHTML = '<div class="cwc-empty">' + esc(tr("Failed to load comments.", "评论加载失败。")) + "</div>";
    }
  }

  function setReplyTo(id, name) {
    currentReplyTo = id;
    var chip = document.querySelector("#cssos-work-comments .cwc-replychip");
    if (chip) { chip.style.display = "flex"; chip.querySelector("[data-rt]").textContent = tr("Replying to ", "回复 ") + (name || ""); }
    var ta = document.querySelector("#cssos-work-comments textarea"); if (ta) ta.focus();
  }
  function clearReplyTo() { currentReplyTo = null; var chip = document.querySelector("#cssos-work-comments .cwc-replychip"); if (chip) chip.style.display = "none"; }
  function setEmbed(id, title) {
    embedWorkId = id; embedWorkTitle = title || "";
    var chip = document.querySelector("#cssos-work-comments .cwc-embedchip");
    if (chip) { chip.style.display = "flex"; chip.querySelector("[data-et]").textContent = "🎵 " + (title || tr("A work", "一首作品")); }
  }
  function clearEmbed() { embedWorkId = ""; embedWorkTitle = ""; var chip = document.querySelector("#cssos-work-comments .cwc-embedchip"); if (chip) chip.style.display = "none"; }

  // 选一首【我的作品】嵌入(安全卡片, 非裸 HTML)。CSSOS_WAVE_1148 — Jing 指令:
  //   弹窗【锚在 🎵 按钮上方/评论框左侧】, 不再屏幕中央; 加载更稳健(失败给重试, 不死)。
  async function loadMyWorks(pl) {
    pl.innerHTML = '<div style="opacity:.6;text-align:center;padding:16px;">' + esc(tr("Loading…", "加载中…")) + "</div>";
    var items = [];
    // 优先用内存里已加载的"我的"歌单(零网络, 最稳); 否则退回 /api/works/mine。
    try {
      var st = globalThis.cssosPlaylists && globalThis.cssosPlaylists._state;
      var mine = st && st.lists && st.lists.mine && st.lists.mine.items;
      if (mine && mine.length) items = mine.slice();
    } catch (_e) {}
    if (!items.length) {
      try {
        var r = await fetch("/api/works/mine?limit=60", { credentials: "include" });
        var j = await r.json().catch(function () { return null; });
        items = ((j && (j.works || j.items || j.data)) || []);
      } catch (_e) {
        pl.innerHTML = '<div style="opacity:.7;text-align:center;padding:16px;">' + esc(tr("Failed to load.", "加载失败。")) +
          ' <button data-retry style="background:transparent;border:0;color:#00f5a0;cursor:pointer;font:inherit;text-decoration:underline;">' + esc(tr("Retry", "重试")) + "</button></div>";
        var rb = pl.querySelector("[data-retry]"); if (rb) rb.addEventListener("click", function () { loadMyWorks(pl); });
        return;
      }
    }
    items = items.filter(function (w) { return w && !w.parent_work_id && (w.id || w.work_id); });
    if (!items.length) { pl.innerHTML = '<div style="opacity:.6;text-align:center;padding:16px;">' + esc(tr("No works.", "暂无作品。")) + "</div>"; return; }
    pl.innerHTML = "";
    items.forEach(function (w) {
      var cover = String(w.cover_image || w.preview_image_url || w.cover_url || "");
      var row = document.createElement("button");
      row.type = "button";
      row.style.cssText = "display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:7px;cursor:pointer;color:#fff;font:inherit;";
      var dur = fmtDur(w.duration_secs || w.duration || w.audio_duration_secs);
      row.innerHTML = (cover ? '<img src="' + esc(cover) + '" style="width:42px;height:42px;border-radius:7px;object-fit:cover;">' : '<span style="width:42px;height:42px;border-radius:7px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">🎵</span>') +
        '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">' + esc(w.title || "Untitled") + "</span>" +
        (dur ? '<span style="flex:0 0 auto;font-size:11px;color:#9aa3b2;">' + esc(dur) + "</span>" : "");
      row.addEventListener("click", function () { setEmbed(String(w.id || w.work_id), String(w.title || "")); var pk = document.getElementById("cssos-embed-pick"); if (pk) pk.remove(); });
      pl.appendChild(row);
    });
  }
  function openEmbedPicker() {
    var old = document.getElementById("cssos-embed-pick"); if (old) old.remove();
    var pick = document.createElement("div"); pick.id = "cssos-embed-pick";
    pick.style.cssText = "position:fixed;inset:0;z-index:10062;background:transparent;";   // 透明捕获层, 点外面关闭
    var card = document.createElement("div");
    card.style.cssText = "position:fixed;width:min(300px,76vw);max-height:54vh;display:flex;flex-direction:column;" +
      "background:rgba(15,18,24,0.99);border:1px solid rgba(255,255,255,0.16);border-radius:14px;padding:14px;color:#fff;" +
      "box-shadow:0 14px 44px rgba(0,0,0,0.6);font:500 14px/1.4 -apple-system,system-ui,sans-serif;";
    card.innerHTML = '<div style="font-weight:700;margin-bottom:8px;font-size:13px;">' + esc(tr("Attach a work", "嵌入一首作品")) + '</div><div data-pl style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:7px;min-height:80px;"></div>';
    pick.appendChild(card);
    pick.addEventListener("click", function (e) { if (e.target === pick) pick.remove(); });
    (globalThis.cssosMountInCinema || function (el) { (document.fullscreenElement || document.body).appendChild(el); })(pick);
    // 锚在 🎵 按钮上方(评论框左侧)。
    try {
      var btn = document.querySelector("#cssos-work-comments .cwc-attach");
      var vw = window.innerWidth || 360, vh = window.innerHeight || 640, cw = Math.min(300, vw * 0.76);
      if (btn) {
        var br = btn.getBoundingClientRect();
        card.style.left = Math.max(8, Math.min(br.left, vw - cw - 8)) + "px";
        card.style.bottom = Math.max(8, vh - br.top + 8) + "px";   // 浮在按钮正上方
      } else { card.style.left = "12px"; card.style.bottom = "80px"; }
    } catch (_e) { card.style.left = "12px"; card.style.bottom = "80px"; }
    loadMyWorks(card.querySelector("[data-pl]"));
  }

  async function postComment() {
    var ta = document.querySelector("#cssos-work-comments textarea");
    var body = ta ? (ta.value || "").trim() : "";
    if (!body && !embedWorkId) return;
    var postBtn = document.querySelector("#cssos-work-comments .cwc-post");
    if (postBtn) postBtn.disabled = true;
    try {
      var r = await fetch("/api/works/" + encodeURIComponent(currentWorkId) + "/comments", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body, parent_id: currentReplyTo || undefined, embed_work_id: embedWorkId || undefined }),
      });
      var j = await r.json().catch(function () { return null; });
      if (r.ok && j && j.ok) {
        if (ta) ta.value = "";
        clearReplyTo(); clearEmbed();
        await refresh();
        notifyChanged();
      } else {
        toast((j && j.code === "AUTH_REQUIRED") ? tr("Sign in to comment.", "登录后才能评论。") : tr("Post failed", "发送失败"));
      }
    } catch (_e) { toast(tr("Network error", "网络错误")); }
    if (postBtn) postBtn.disabled = false;
  }

  function open(workId) {
    workId = String(workId || "").trim();
    if (!workId) return;
    try { if (typeof globalThis.cssosCloseOtherPopups === "function") globalThis.cssosCloseOtherPopups("#cssos-work-comments"); } catch (_e) {}   // W1158 单弹窗
    injectCss();
    var old = document.getElementById("cssos-work-comments"); if (old) old.remove();
    currentWorkId = workId; currentReplyTo = null; embedWorkId = ""; embedWorkTitle = "";

    var overlay = document.createElement("div"); overlay.id = "cssos-work-comments";
    overlay.innerHTML =
      '<div class="cwc-sheet">' +
        '<div class="cwc-head"><b>' + esc(tr("Comments", "评论")) + '</b><button class="cwc-x" aria-label="close">✕</button></div>' +
        '<div class="cwc-list"></div>' +
        '<div class="cwc-foot">' +
          '<div class="cwc-replychip"><span data-rt></span><button data-rt-x>✕</button></div>' +
          '<div class="cwc-embedchip"><span data-et></span><button data-et-x>✕</button></div>' +
          '<div class="cwc-composer">' +
            '<button class="cwc-attach" title="' + esc(tr("Attach a work", "嵌入作品")) + '">🎵</button>' +
            '<textarea rows="1" maxlength="2000" placeholder="' + esc(tr("Write a comment…", "写下你的评论…")) + '"></textarea>' +
            '<button class="cwc-post">' + esc(tr("Post", "发送")) + "</button>" +
          "</div>" +
        "</div>" +
      "</div>";
    (globalThis.cssosMountInCinema || function (el) { (document.fullscreenElement || document.body).appendChild(el); })(overlay);   // W1147 统一影院挂载
    // CSSOS_WAVE_1146 — Jing 指令: 顶部不高于右轨 → sheet 顶对齐右轨顶(找不到右轨则给个合理上边距)。
    try {
      var sheet = overlay.querySelector(".cwc-sheet");
      var rail = document.getElementById("cssos-watch-social-rail");
      var topPx = rail ? Math.max(8, Math.round(rail.getBoundingClientRect().top)) : Math.round((window.innerHeight || 600) * 0.18);
      if (sheet) {
        sheet.style.marginTop = topPx + "px";
        // CSSOS_WAVE_1160 — 高度封顶到视口底, 不溢出 → 评论列表内部可上下滚(之前 78vh+marginTop 溢出导致滚不动)。
        sheet.style.maxHeight = "calc(100vh - " + topPx + "px - 14px)";
      }
    } catch (_e) {}

    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector(".cwc-x").addEventListener("click", function () { overlay.remove(); });
    overlay.querySelector(".cwc-attach").addEventListener("click", openEmbedPicker);
    overlay.querySelector(".cwc-post").addEventListener("click", postComment);
    overlay.querySelector("[data-rt-x]").addEventListener("click", clearReplyTo);
    overlay.querySelector("[data-et-x]").addEventListener("click", clearEmbed);
    var ta = overlay.querySelector("textarea");
    ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(90, ta.scrollHeight) + "px"; });
    ta.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") postComment(); });

    refresh();
  }

  globalThis.cssosOpenWorkComments = open;
})();
