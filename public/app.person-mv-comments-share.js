/* CSSOS_PERSON_MV_WAVE12 20260508 — Jing
 * MV card comments drawer + share button. Self-mounting overlay UI.
 * Entry points exported on globalThis:
 *   globalThis.openPersonMvComments(mvId)
 *   globalThis.sharePersonMv(mvId)
 * Also auto-decorates any element with [data-cssos-mv-comments] /
 * [data-cssos-mv-share] attribute (carrying mv_id) on click. */
(function () {
  "use strict";
  function tr(en, zh) {
    if (typeof globalThis.CSSOS_I18N?.tr === "function") {
      try { return String(globalThis.CSSOS_I18N.tr(en)); } catch (_e) {}
    }
    var locale = (globalThis.CSSOS_I18N && globalThis.CSSOS_I18N.getCurrentLocale && globalThis.CSSOS_I18N.getCurrentLocale()) || "en";
    return /^zh/i.test(String(locale)) && zh ? zh : en;
  }

  var STYLE_ID = "cssos-mv-comments-share-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#cssos-mv-comments{position:fixed;top:0;right:0;bottom:0;width:min(420px,90vw);background:rgba(4,10,8,0.97);border-left:1px solid rgba(0,245,160,0.25);z-index:9400;display:flex;flex-direction:column;color:#daffee;font:14px/1.45 -apple-system,system-ui,sans-serif;transform:translateX(100%);transition:transform .25s ease;}",
      "#cssos-mv-comments.is-open{transform:translateX(0);}",
      "#cssos-mv-comments .cmh-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(0,245,160,0.18);}",
      "#cssos-mv-comments .cmh-title{font-weight:700;}",
      "#cssos-mv-comments .cmh-close{background:transparent;color:#00f5a0;border:0;cursor:pointer;font-size:18px;}",
      "#cssos-mv-comments .cmh-input{padding:10px 12px;border-bottom:1px solid rgba(0,245,160,0.15);}",
      "#cssos-mv-comments .cmh-input textarea{width:100%;background:#0c1d16;color:#daffee;border:1px solid rgba(0,245,160,0.25);border-radius:8px;padding:8px;font:13px/1.4 inherit;resize:vertical;min-height:60px;box-sizing:border-box;}",
      "#cssos-mv-comments .cmh-input button{margin-top:6px;background:#00f5a0;color:#06100b;border:0;border-radius:999px;padding:6px 16px;font-weight:700;cursor:pointer;}",
      "#cssos-mv-comments .cmh-input button:disabled{opacity:0.5;cursor:default;}",
      "#cssos-mv-comments .cmh-list{flex:1;overflow-y:auto;padding:10px 12px;}",
      "#cssos-mv-comments .cmh-item{display:flex;gap:10px;margin-bottom:14px;}",
      "#cssos-mv-comments .cmh-item.is-reply{margin-left:32px;}",
      "#cssos-mv-comments .cmh-avatar{width:28px;height:28px;border-radius:50%;background:#0c1d16;object-fit:cover;flex-shrink:0;}",
      "#cssos-mv-comments .cmh-name{font-weight:600;color:#fff;font-size:13px;cursor:pointer;}",
      "#cssos-mv-comments .cmh-time{font-size:11px;color:rgba(218,255,238,0.5);margin-left:6px;}",
      "#cssos-mv-comments .cmh-body{font-size:13px;color:rgba(218,255,238,0.88);margin-top:2px;white-space:pre-wrap;word-break:break-word;}",
      "#cssos-mv-comments .cmh-actions{margin-top:4px;font-size:11px;color:rgba(0,245,160,0.7);}",
      "#cssos-mv-comments .cmh-actions button{background:transparent;color:rgba(0,245,160,0.7);border:0;cursor:pointer;font-size:11px;padding:0 6px 0 0;}",
      "#cssos-mv-comments .cmh-empty{padding:30px 0;text-align:center;color:rgba(218,255,238,0.55);}",
      ".pmv-comments-summary{margin:0 0 14px;padding:10px 12px;border-radius:10px;background:linear-gradient(180deg,rgba(0,245,160,0.08),rgba(0,245,160,0.02));border:1px solid rgba(0,245,160,0.22);}",
      ".pmv-comments-summary .pmv-cs-head{display:flex;align-items:center;justify-content:space-between;font-size:12px;font-style:italic;color:rgba(0,245,160,0.85);margin-bottom:4px;}",
      ".pmv-comments-summary .pmv-cs-refresh{background:transparent;color:rgba(0,245,160,0.85);border:0;cursor:pointer;font-size:13px;padding:0 4px;}",
      ".pmv-comments-summary p{margin:0;font-size:13px;color:#daffee;}",
      ".cssos-toast{position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:rgba(0,245,160,0.95);color:#06100b;padding:8px 18px;border-radius:999px;font-weight:700;z-index:9500;box-shadow:0 6px 20px rgba(0,0,0,0.4);}",
    ].join("");
    document.head.appendChild(s);
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "onclick") n.addEventListener("click", attrs[k]);
      else if (k === "innerHTML") n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function defaultAvatar() {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%230c1d16'/><circle cx='16' cy='13' r='6' fill='%2300f5a0' opacity='0.5'/><ellipse cx='16' cy='28' rx='10' ry='6' fill='%2300f5a0' opacity='0.5'/></svg>";
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "cssos-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  /* CSSOS_PERSON_MV_WAVE39 — render @mentions as clickable links and
   * provide an autocomplete dropdown anchored to the textarea caret. */
  function escapeHtmlMention(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function renderMentions(html) {
    return String(html || "").replace(/@([a-zA-Z0-9_-]{2,32})/g, function (_m, h) {
      return '<a href="#u/' + escapeHtmlMention(h) + '" style="color:#00f5a0;text-decoration:none;font-weight:600">@' + escapeHtmlMention(h) + '</a>';
    });
  }

  /* CSSOS_PERSON_MV_WAVE40 — open a tiny report sheet for a given target. */
  globalThis.cssosReportTarget = async function reportTarget(kind, id) {
    var reasons = ["spam", "harassment", "copyright", "nsfw", "factual_error", "other"];
    var pick = window.prompt(
      tr("Report reason — type one of:", "举报原因，输入其一：") + "\n" + reasons.join(", "),
      "spam",
    );
    if (!pick) return;
    pick = String(pick).trim().toLowerCase();
    if (reasons.indexOf(pick) < 0) { toast(tr("Unknown reason", "未知原因")); return; }
    try {
      var r = await fetch("/api/reports", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_kind: kind, target_id: id, reason_code: pick }),
      });
      var j = await r.json();
      if (j.ok) toast(tr("Report submitted", "举报已提交"));
      else if (j.code === "ALREADY_REPORTED_TODAY") toast(tr("Already reported today", "今日已举报"));
      else toast(tr("Report failed", "举报失败"));
    } catch (_e) { toast(tr("Report failed", "举报失败")); }
  };

  globalThis.cssosBlockUser = async function blockUser(username) {
    if (!username) return;
    if (!window.confirm(tr("Block @" + username + "?", "屏蔽 @" + username + "？"))) return;
    try {
      var r = await fetch("/api/users/" + encodeURIComponent(username) + "/block", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: "{}",
      });
      var j = await r.json();
      if (j.ok) toast(j.blocked ? tr("Blocked", "已屏蔽") : tr("Unblocked", "已取消屏蔽"));
      else toast(tr("Block failed", "屏蔽失败"));
    } catch (_e) { toast(tr("Block failed", "屏蔽失败")); }
  };

  function attachMentionAutocomplete(ta) {
    var menu = null;
    var debounceT = null;
    function close() {
      if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
      menu = null;
    }
    function ensureMenu() {
      if (menu) return menu;
      menu = document.createElement("div");
      menu.style.cssText = "position:absolute;z-index:9600;background:#0c1d16;border:1px solid rgba(0,245,160,0.35);border-radius:8px;padding:4px;max-height:240px;overflow-y:auto;min-width:180px;font:13px/1.4 inherit;color:#daffee;box-shadow:0 6px 24px rgba(0,0,0,0.5);";
      document.body.appendChild(menu);
      return menu;
    }
    function position() {
      if (!menu) return;
      var rect = ta.getBoundingClientRect();
      menu.style.left = (window.scrollX + rect.left + 8) + "px";
      menu.style.top  = (window.scrollY + rect.bottom + 4) + "px";
    }
    function render(items) {
      var m = ensureMenu();
      m.innerHTML = "";
      if (!items.length) { close(); return; }
      items.forEach(function (u) {
        var row = document.createElement("div");
        row.style.cssText = "padding:6px 10px;border-radius:6px;cursor:pointer;display:flex;gap:8px;align-items:center;";
        row.onmouseover = function () { row.style.background = "rgba(0,245,160,0.12)"; };
        row.onmouseout  = function () { row.style.background = "transparent"; };
        row.onclick = function () { insertMention(u.username); };
        var img = document.createElement("img");
        img.src = u.avatar_url || defaultAvatar();
        img.alt = "";
        img.style.cssText = "width:20px;height:20px;border-radius:50%;";
        var label = document.createElement("span");
        label.textContent = "@" + u.username + (u.display_name && u.display_name !== u.username ? " · " + u.display_name : "");
        row.appendChild(img); row.appendChild(label);
        m.appendChild(row);
      });
      position();
    }
    function currentTokenInfo() {
      var v = ta.value || "";
      var caret = ta.selectionStart || v.length;
      var head = v.slice(0, caret);
      var match = /(^|\s)@([a-zA-Z0-9_-]{0,32})$/.exec(head);
      if (!match) return null;
      return { start: caret - match[2].length, end: caret, query: match[2] };
    }
    function insertMention(handle) {
      var info = currentTokenInfo();
      var v = ta.value || "";
      if (!info) {
        ta.value = v + (v && !/\s$/.test(v) ? " " : "") + "@" + handle + " ";
      } else {
        ta.value = v.slice(0, info.start) + handle + " " + v.slice(info.end);
        var pos = info.start + handle.length + 1;
        ta.setSelectionRange(pos, pos);
      }
      ta.focus();
      close();
    }
    async function fetchSuggestions(q) {
      try {
        var r = await fetch("/api/users/autocomplete?q=" + encodeURIComponent(q) + "&limit=10", { credentials: "include" });
        var j = await r.json();
        return (j && j.ok && Array.isArray(j.items)) ? j.items : [];
      } catch (_e) { return []; }
    }
    ta.addEventListener("input", function () {
      var info = currentTokenInfo();
      if (!info) { close(); return; }
      if (debounceT) clearTimeout(debounceT);
      debounceT = setTimeout(async function () {
        var items = await fetchSuggestions(info.query.toLowerCase() || "a");
        if (!items.length) { close(); return; }
        render(items);
      }, 200);
    });
    ta.addEventListener("keydown", function (ev) {
      if (!menu) return;
      if (ev.key === "Escape") { ev.preventDefault(); close(); }
      if (ev.key === "Tab") {
        var first = menu.firstChild;
        if (first && first.click) { ev.preventDefault(); first.click(); }
      }
    });
    ta.addEventListener("blur", function () { setTimeout(close, 200); });
  }

  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return tr("just now", "刚刚");
    if (diff < 3600) return Math.floor(diff / 60) + "m";
    if (diff < 86400) return Math.floor(diff / 3600) + "h";
    return d.toLocaleDateString();
  }

  var currentMvId = null;
  var currentReplyTo = null;

  async function fetchComments(mvId) {
    var r = await fetch("/api/person-mv/mvs/" + encodeURIComponent(mvId) + "/comments?limit=50", { credentials: "include" });
    var j = await r.json();
    return j.ok ? { items: j.items || [], summary: j.summary || null } : { items: [], summary: null };
  }

  async function refreshSummary(mvId) {
    try {
      var r = await fetch("/api/person-mv/mvs/" + encodeURIComponent(mvId) + "/comments/summarize", {
        method: "POST", credentials: "include",
      });
      var j = await r.json();
      if (j.ok) { toast(tr("Summary refreshed", "众议已刷新")); refresh(); }
      else toast(tr("Refresh failed", "刷新失败"));
    } catch (_e) { toast(tr("Refresh failed", "刷新失败")); }
  }

  function isAdminUser() {
    var u = globalThis.CSSOS_CURRENT_USER || null;
    return !!(u && (u.role === "admin" || u.is_admin));
  }

  async function postComment(mvId, body, parentId) {
    var r = await fetch("/api/person-mv/mvs/" + encodeURIComponent(mvId) + "/comments", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body, parent_id: parentId || null }),
    });
    var j = await r.json();
    if (!j.ok) throw new Error(j.code || "FAILED");
    return j.comment;
  }

  async function deleteComment(cid) {
    var r = await fetch("/api/person-mv/comments/" + encodeURIComponent(cid), {
      method: "DELETE", credentials: "include",
    });
    var j = await r.json();
    return !!j.ok;
  }

  function buildItem(c, currentUserId) {
    var item = el("div", { class: "cmh-item" + (c.parent_id ? " is-reply" : "") }, [
      el("img", { class: "cmh-avatar", src: c.avatar_url || defaultAvatar(), alt: "" }),
      el("div", { style: "flex:1;min-width:0" }, [
        el("div", {}, [
          el("span", {
            class: "cmh-name",
            onclick: function () {
              if (c.username || c.user_id) location.hash = "#u/" + (c.username || c.user_id);
            },
          }, [c.display_name || c.username || tr("Anonymous", "匿名")]),
          el("span", { class: "cmh-time" }, [fmtTime(c.created_at)]),
        ]),
        c.deleted
          ? el("div", { class: "cmh-body", style: "font-style:italic;opacity:0.5" }, [tr("(deleted)", "(已删除)")])
          : el("div", { class: "cmh-body", innerHTML: renderMentions(c.body_html || "") }, []),
        c.deleted ? null : el("div", { class: "cmh-actions" }, [
          el("button", { onclick: function () { setReplyTo(c); } }, [tr("Reply", "回复")]),
          (currentUserId && currentUserId === c.user_id)
            ? el("button", {
                onclick: async function () {
                  if (!confirm(tr("Delete this comment?", "删除此评论？"))) return;
                  if (await deleteComment(c.id)) refresh();
                },
              }, [tr("Delete", "删除")])
            : null,
          (currentUserId && currentUserId !== c.user_id)
            ? el("button", {
                onclick: function () { globalThis.cssosReportTarget("comment", c.id); },
              }, ["🚩 " + tr("Report", "举报")])
            : null,
          (currentUserId && currentUserId !== c.user_id && c.username)
            ? el("button", {
                onclick: function () { globalThis.cssosBlockUser(c.username); },
              }, ["🚫 " + tr("Block", "屏蔽")])
            : null,
        ]),
      ]),
    ]);
    return item;
  }

  function setReplyTo(c) {
    currentReplyTo = c.id;
    var ta = document.querySelector("#cssos-mv-comments textarea");
    if (ta) {
      ta.placeholder = tr("Reply to ", "回复 ") + (c.display_name || c.username || "...");
      ta.focus();
    }
  }

  async function refresh() {
    var list = document.querySelector("#cssos-mv-comments .cmh-list");
    if (!list || !currentMvId) return;
    list.innerHTML = "";
    var data = await fetchComments(currentMvId);
    var items = data.items || [];
    var summary = data.summary || null;
    if (summary && summary.text) {
      var head = el("div", { class: "pmv-cs-head" }, [
        el("span", {}, ["💬 " + tr("Crowd take", "众议") + " · " + (summary.count || items.length) + " " + tr("comments", "条评论")]),
      ]);
      if (isAdminUser()) {
        var btn = el("button", {
          class: "pmv-cs-refresh",
          title: tr("Regenerate summary", "重新生成"),
          onclick: function () { refreshSummary(currentMvId); },
        }, ["↻"]);
        head.appendChild(btn);
      }
      var sumBox = el("div", { class: "pmv-comments-summary" }, [
        head,
        el("p", {}, [String(summary.text)]),
      ]);
      list.appendChild(sumBox);
    }
    var me = (globalThis.CSSOS_CURRENT_USER && globalThis.CSSOS_CURRENT_USER.id) || null;
    if (!items.length) {
      list.appendChild(el("div", { class: "cmh-empty" }, [tr("Be the first to comment.", "抢沙发吧。")]));
      return;
    }
    items.forEach(function (c) { list.appendChild(buildItem(c, me)); });
  }

  function close() {
    var d = document.getElementById("cssos-mv-comments");
    if (d) {
      d.classList.remove("is-open");
      setTimeout(function () { if (d.parentNode) d.remove(); }, 250);
    }
    currentMvId = null;
    currentReplyTo = null;
  }

  async function open(mvId) {
    if (!mvId) return;
    injectStyle();
    var existing = document.getElementById("cssos-mv-comments");
    if (existing) existing.remove();
    currentMvId = mvId;
    currentReplyTo = null;

    var ta = el("textarea", { maxlength: "500", placeholder: tr("Write a comment…  (try @ to mention)", "写下你的评论…  (输入 @ 提及他人)") });
    attachMentionAutocomplete(ta);
    var sendBtn = el("button", {}, [tr("Post", "发送")]);
    sendBtn.addEventListener("click", async function () {
      var body = (ta.value || "").trim();
      if (!body) return;
      sendBtn.disabled = true;
      // Optimistic
      var list = document.querySelector("#cssos-mv-comments .cmh-list");
      var optimistic = el("div", { class: "cmh-item" + (currentReplyTo ? " is-reply" : ""), style: "opacity:.6" }, [
        el("img", { class: "cmh-avatar", src: defaultAvatar(), alt: "" }),
        el("div", { style: "flex:1" }, [
          el("div", {}, [el("span", { class: "cmh-name" }, [tr("Posting…", "发送中…")])]),
          el("div", { class: "cmh-body" }, [body]),
        ]),
      ]);
      if (list) list.appendChild(optimistic);
      try {
        await postComment(mvId, body, currentReplyTo);
        ta.value = "";
        currentReplyTo = null;
        ta.placeholder = tr("Write a comment…", "写下你的评论…");
        await refresh();
      } catch (e) {
        toast(tr("Post failed", "发送失败") + (e && e.message ? ": " + e.message : ""));
        if (optimistic.parentNode) optimistic.remove();
      }
      sendBtn.disabled = false;
    });

    var drawer = el("div", { id: "cssos-mv-comments" }, [
      el("div", { class: "cmh-header" }, [
        el("span", { class: "cmh-title" }, ["💬 " + tr("Comments", "评论")]),
        el("button", { class: "cmh-close", onclick: close }, ["✕"]),
      ]),
      el("div", { class: "cmh-input" }, [ta, el("br"), sendBtn]),
      el("div", { class: "cmh-list" }, [
        el("div", { class: "cmh-empty" }, [tr("Loading…", "加载中…")]),
      ]),
    ]);
    document.body.appendChild(drawer);
    // trigger transition
    requestAnimationFrame(function () { drawer.classList.add("is-open"); });
    refresh();
  }

  /* CSSOS_PERSON_MV_WAVE37 20260508 — embed-code chooser. */
  function shortcodeFromShareUrl(u) {
    try { var m = String(u || "").match(/\/m\/([0-9a-zA-Z]{4,12})/); return m ? m[1] : ""; }
    catch (_) { return ""; }
  }
  function origin() {
    try { return location.origin || ""; } catch (_) { return ""; }
  }
  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); return true; }
    catch (_) { try { prompt(tr("Copy this:", "复制："), s); return true; } catch (__) { return false; } }
  }
  function chooseShareMode(j) {
    // Tiny inline chooser: link vs embed. Locality — lives next to share trigger.
    var sc = shortcodeFromShareUrl(j.share_url);
    var embedSrc = origin() + "/embed/" + sc;
    var embedHtml = '<iframe src="' + embedSrc + '" width="640" height="360" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    var pick = (typeof window !== "undefined" && window.confirm)
      ? window.confirm(tr("OK = copy share link\nCancel = copy embed code", "确定 = 复制链接\n取消 = 复制嵌入代码"))
      : true;
    return pick ? { kind: "link", text: j.share_url } : { kind: "embed", text: embedHtml };
  }

  async function share(mvId) {
    if (!mvId) return;
    try {
      var r = await fetch("/api/person-mv/mvs/" + encodeURIComponent(mvId) + "/share", { credentials: "include" });
      var j = await r.json();
      if (!j.ok) throw new Error(j.code || "FAILED");
      var payload = {
        title: j.og_title || "CSS Studio MV",
        text: j.og_description || "",
        url: j.share_url,
      };
      if (typeof navigator.share === "function") {
        try { await navigator.share(payload); return; } catch (_e) { /* user cancelled or failed → fallback */ }
      }
      var pick = chooseShareMode(j);
      var ok = await copyText(pick.text);
      if (ok) {
        toast(pick.kind === "embed"
          ? tr("Embed code copied", "嵌入代码已复制")
          : tr("Link copied", "链接已复制"));
      }
    } catch (e) {
      toast(tr("Share failed", "分享失败"));
    }
  }

  // Auto-decorate any clickable bearing data attrs.
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    while (t && t !== document.body) {
      if (t.dataset && t.dataset.cssosMvComments) {
        ev.preventDefault();
        open(t.dataset.cssosMvComments);
        return;
      }
      if (t.dataset && t.dataset.cssosMvShare) {
        ev.preventDefault();
        share(t.dataset.cssosMvShare);
        return;
      }
      t = t.parentNode;
    }
  });

  globalThis.openPersonMvComments = open;
  globalThis.sharePersonMv = share;
})();
